import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { setup, fixture, deferred, until, syntheticModel } from '../../core/tests/helpers.mjs';
export async function captureChecks(test, root) {
  const state = await setup(path.join(root, 'capture-checks'));
  const { core, adapter, repo, key, delivery } = state;
  let first;
  await test('capture-only freezes real inputs with autoMode off and zero model invocations', async () => {
    first = await core.trigger({ repo: repo.root, target: 'main', sessionId: 'dev', captureOnly: true, trigger: 'auto' });
    assert.equal(first.status, 'pending'); assert.equal(adapter.calls.length, 0); assert.equal(core.store.runs(key).length, 0); assert.ok(core.store.snapshot(key, first.snapshotId).files.length); assert.equal(core.store.settings(key).autoMode, false);
  });
  await test('capture-only replay reuses its current snapshot without granting a review', async () => {
    const count = core.store.delivery(key, first.deliveryId).snapshotIds.length, result = await core.trigger({ repo: repo.root, target: 'main', sessionId: 'dev', captureOnly: true });
    assert.equal(result.snapshotId, first.snapshotId); assert.equal(core.store.delivery(key, first.deliveryId).snapshotIds.length, count); assert.equal(adapter.calls.length, 0);
  });
  await test('captured pending input can be reviewed later through the existing scheduler', async () => { const result = await core.reviewCurrent(key, first.deliveryId); assert.equal(result.status, 'succeeded'); assert.equal(result.complete, true); assert.equal(adapter.calls.length, 1); });
  await test('changing only requirements creates a new pending record and invalidates old writes', async () => {
    const result = await core.trigger({ repo: repo.root, target: 'main', sessionId: 'dev', requirements: [{ kind: 'paste', order: 0, text: 'New manual requirement' }], captureOnly: true });
    assert.equal(result.status, 'pending'); assert.notEqual(result.inputSha, first.inputSha); assert.notEqual(result.snapshotId, first.snapshotId); assert.equal(adapter.calls.length, 1); assert.equal(core.store.runs(key, result.snapshotId).length, 0); assert.throws(() => core.writable(key, first.snapshotId), /read-only/);
  });
  await test('capturing newer B then C cancels obsolete review and waits, binding only final C', async () => {
    const gate = deferred(); let signal;
    adapter.model = async (_r, options) => { signal = options.signal; await gate.promise; signal.throwIfAborted(); throw Error('Obsolete model must not produce a result'); };
    const old = core.reviewCurrent(key, first.deliveryId); await until(() => Boolean(signal));
    fs.writeFileSync(path.join(repo.root, 'code.js'), 'export const B = 3;\n'); let settledB = false;
    const b = core.trigger({ repo: repo.root, target: 'main', sessionId: 'dev', captureOnly: true }).then(r => { settledB = true; return r; });
    await until(() => signal.aborted); assert.equal(settledB, false);
    fs.writeFileSync(path.join(repo.root, 'code.js'), 'export const C = 4;\n'); const c = core.trigger({ repo: repo.root, target: 'main', sessionId: 'dev', captureOnly: true });
    await until(() => core.store.delivery(key, first.deliveryId).snapshotIds.length >= 4);
    gate.resolve(); const [oldResult, rb, rc] = await Promise.all([old, b, c]);
    assert.equal(oldResult.status, 'cancelled'); assert.equal(rb.status, 'cancelled'); assert.equal(rc.status, 'pending'); assert.equal(core.store.delivery(key, first.deliveryId).current.snapshotId, rc.snapshotId); assert.equal(adapter.calls.length, 2);
  });
  await test('delivery context mismatch stops before a selected operation can enter another delivery', async () => {
    const count = core.store.deliveries(key).length, result = await core.trigger({ repo: repo.root, target: 'main', sessionId: 'dev', captureOnly: true, expectedDeliveryId: 'delivery-foreign' });
    assert.equal(result.status, 'incomplete'); assert.equal(result.code, 'delivery-context-changed'); assert.equal(core.store.deliveries(key).length, count); assert.equal(adapter.calls.length, 2);
  });
  await test('open delivery lookup shares development branches but isolates target-branch sessions', async () => {
    const current = core.store.delivery(key, first.deliveryId);
    assert.equal(core.deliveries.findOpen(key, { branch: 'feature', targetBranch: 'main', session: { id: 'other-dev' } }).deliveryId, current.deliveryId);
    assert.equal(core.deliveries.findOpen(key, { branch: 'feature', targetBranch: 'feature', session: { id: 'other-dev' } }), undefined);
  });
  await test('annotation delete and undo retain original creation time and exact text', async () => {
    adapter.model = syntheticModel; const run = await core.reviewCurrent(key, first.deliveryId), finding = run.findings[0];
    const original = await core.annotate(key, { snapshotId: run.snapshotId, findingId: finding.findingId, text: 'Keep original annotation 😀' });
    await core.deleteAnnotation(key, run.snapshotId, original.annotationId);
    const restored = await core.annotate(key, { snapshotId: run.snapshotId, annotationId: original.annotationId, findingId: finding.findingId, text: original.text });
    assert.equal(restored.createdAt, original.createdAt); assert.equal(restored.text, original.text); assert.equal(restored.annotationId, original.annotationId);
  });
}
