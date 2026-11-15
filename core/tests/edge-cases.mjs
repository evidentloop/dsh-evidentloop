import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { FileStore, ReviewCore, SyntheticAdapter, Drafts, projectFor, markdown, html, reviewStatus, RequirementLedger, requirementDigest, redactText } from '../index.mjs';
import { setup, fixture, bundle, syntheticModel, deferred } from './helpers.mjs';
import { modelFor } from '../fixtures/model.mjs';
import { METHOD_ROOT, methodVersion } from '../lib/common.mjs';
export async function runEdges(test) {
  await test('failed rerun: existing annotation keeps linked finding title in exports and locked issues; empty issue draft disabled', async dir => {
    let fail=false;const t=await setup(dir,{model:req=>{const m=syntheticModel(req);if(fail)m.findings[0].severity='INVALID';return m;}});
    const run=await t.core.requestBundle({projectKey:t.key,deliveryId:t.delivery.deliveryId,bundle:bundle(dir,t.repo,'a')}); const finding=run.findings[0];
    await t.core.annotate(t.key,{snapshotId:run.snapshotId,findingId:finding.findingId,text:'保持这条关联意见'});fail=true;const failed=await t.core.reviewCurrent(t.key,t.delivery.deliveryId,{force:true});assert.equal(failed.status,'failed');
    const view=t.core.selected(t.key,run.snapshotId);assert(markdown(view).includes(finding.title));assert(html(view).includes('保持这条关联意见'));const lock=await new Drafts(t.adapter).lock(view,'issues');assert(lock.text.includes(finding.title));
    const empty={...view,annotations:[],associatedFindings:[]};assert.equal((await new Drafts(t.adapter).lock(empty,'issues')).available,false);
  });
  await test('method freeze: model response validates against injected schema bytes, never a changed live schema', async dir => {
    const method = path.join(dir,'method'); fs.cpSync(METHOD_ROOT,method,{recursive:true}); const before = methodVersion(method);
    const t = await setup(dir,{methodRoot:method,model:req=>{const model=syntheticModel(req);fs.writeFileSync(path.join(method,'schema/run.schema.json'),JSON.stringify({type:'object',required:['impossible']}));return model;}});
    const run=await t.core.requestBundle({projectKey:t.key,deliveryId:t.delivery.deliveryId,bundle:bundle(dir,t.repo,'a',{methodRoot:method})});
    assert.equal(run.complete,true); assert.equal(run.injectedModules.find(m=>m.path==='schema/run.schema.json').sha256,before.files.find(m=>m.path==='schema/run.schema.json').sha256); assert.notEqual(methodVersion(method).promptVersion,run.promptVersion);
  });
  await test('automatic eligibility: default off, unknown Session and own review never freeze or call model', async dir => {
    const t = await setup(dir); let result = await t.core.trigger({ repo: t.repo.root, sessionId: 'dev', trigger: 'auto' }); assert.equal(result.code, 'auto-disabled');
    await t.core.store.setSettings(t.key, { autoMode: true, targetBranch: 'main', extensionPrompt: '', exportEmbedDiff: false });
    t.adapter.sessionRows.set('review', { id: 'review', kind: 'review', projectKey: t.key }); result = await t.core.trigger({ repo: t.repo.root, sessionId: 'review', trigger: 'auto' }); assert.equal(result.code, 'own-review-session');
    result = await t.core.trigger({ repo: t.repo.root, sessionId: 'missing', trigger: 'auto' }); assert.equal(result.code, 'no-development-session'); assert.equal(t.adapter.calls.length, 0); assert.equal(t.core.store.delivery(t.key, t.delivery.deliveryId).snapshotIds.length, 0);
  });
  await test('requirements: authoritative message/manual order survives reread and restore; no clock sorting', async () => {
    const ledger = new RequirementLedger(), messages = [{ id: 'a', sequence: 2, text: '先前需求😀' }, { id: 'b', sequence: 5, text: '后续需求' }];
    ledger.captureManual({ id: 'paste', sessionId: 'dev', messages, source: { kind: 'paste', text: '手动需求' } });
    ledger.captureMessages('dev', [...messages, { id: 'c', sequence: 9, text: '后来的消息' }]);
    const before = ledger.sources(); ledger.captureManual({ id: 'paste', sessionId: 'dev', messages, source: { kind: 'paste', text: '手动需求' } });
    assert.deepEqual(ledger.sources(), before); assert.deepEqual(before.map(s => s.order), [0, 1, 2, 3]);
    const restored = new RequirementLedger(ledger.state()); assert.equal(requirementDigest(restored.sources()), requirementDigest(before)); assert.equal(restored.sources()[0].text, '先前需求😀');
    const stable = ledger.state(); assert.throws(() => ledger.captureMessages('dev', [{ id: 'late-old', sequence: 1, text: '迟到历史' }])); assert.deepEqual(ledger.state(), stable);
    assert.throws(() => ledger.captureManual({ id: 'invalid', sessionId: 'dev', messages: [{ id: 'new', sequence: 12, text: '新消息' }], source: { kind: 'paste', text: ' ' } })); assert.deepEqual(ledger.state(), stable);
  });
  await test('requirements: file sources title the delivery and invalid scope never mutates current', async dir => {
    const repo = fixture(dir), project = projectFor(repo.root), adapter = new SyntheticAdapter({ model: syntheticModel });
    const core = await new ReviewCore({ storageRoot: path.join(dir, 'state'), adapter }).initialize(), file = path.join(dir, 'requirements.md'); fs.writeFileSync(file, '文件需求标题\n正文');
    const run = await core.trigger({ repo: repo.root, requirements: [{ kind: 'file', file, order: 0 }] }); assert.equal(run.status, 'succeeded'); assert.equal(core.store.delivery(project.projectKey, run.deliveryId).title, '文件需求标题');
    const before = core.store.delivery(project.projectKey, run.deliveryId);
    await assert.rejects(() => core.requestBundle({ projectKey: project.projectKey, deliveryId: run.deliveryId, bundle: core.store.bundlePath(project.projectKey, run.snapshotId), scope: 'invalid' }));
    assert.deepEqual(core.store.delivery(project.projectKey, run.deliveryId), before); await assert.rejects(() => core.reviewCurrent(project.projectKey, run.deliveryId, { scope: 'file:absent' }));
  });
  await test('redaction: local temporary/user paths and key-like fields are transformed without altering original state', async () => {
    const text = 'local /private/tmp/private-dir/file.js and /Users/fixture/code apiKey=SECRET_VALUE'; const redacted = redactText(text);
    assert(!redacted.includes('private-dir')); assert(!redacted.includes('/Users/fixture')); assert(!redacted.includes('SECRET_VALUE')); assert(text.includes('SECRET_VALUE'));
  });
  await test('storage boundary: reject private state inside any Git worktree before mkdir', async dir => {
    const r = fixture(dir), target = path.join(r.root, 'must-not-create'); assert.throws(() => new FileStore(target)); assert(!fs.existsSync(target));
    const a = new SyntheticAdapter({ model: syntheticModel }); assert.equal(a.calls.length, 0);
  });
  await test('scope boundary: valid but unsolicited finding outside requested path is withheld', async dir => {
    const t = await setup(dir, { model: req => modelFor(req.bundleRoot) });
    const run = await t.core.requestBundle({ projectKey: t.key, deliveryId: t.delivery.deliveryId, bundle: bundle(dir, t.repo, 'a'), scope: 'file:other.js' });
    assert.equal(run.findings.length, 0); assert(run.coverage.withheld.some(w => w.code === 'out-of-scope')); assert(!run.complete);
  });
  await test('project isolation: different repositories can run independently without cancellation', async dir => {
    const began = deferred(), release = deferred(); const r = fixture(dir, 'one');
    const t = await setup(dir, { repo: r, model: async req => { if (req.snapshot.projectKey === t.key) { began.resolve(); await release.promise; } return syntheticModel(req); } });
    const r2 = fixture(dir, 'two'), project2 = projectFor(r2.root), d2 = (await t.core.deliveries.observe(project2, { branch: 'feature', targetBranch: 'main', headSha: r2.base, baseSha: r2.base, targetSha: r2.base, reachable: async () => false })).delivery;
    const pending = t.core.requestBundle({ projectKey: t.key, deliveryId: t.delivery.deliveryId, bundle: bundle(dir, r, 'a') }); await began.promise;
    const second = await t.core.requestBundle({ projectKey: project2.projectKey, deliveryId: d2.deliveryId, bundle: bundle(dir, r2, 'b') }); assert.equal(second.status, 'succeeded'); release.resolve(); assert.equal((await pending).status, 'succeeded');
  });
  await test('append fault: partial Mark write rejects, blocks further appends, then recovers complete prefix', async dir => {
    const t = await setup(dir), run = await t.core.requestBundle({ projectKey: t.key, deliveryId: t.delivery.deliveryId, bundle: bundle(dir, t.repo, 'a') });
    await t.core.mark(t.key, { snapshotId: run.snapshotId, findingId: run.findings[0].findingId, suppressed: true });
    const original = fs.writeFileSync; let once = true;
    fs.writeFileSync = (file, data, ...args) => { if (once && typeof file === 'number') { once = false; original(file, String(data).slice(0, 5)); const error = Error('injected partial append'); error.code = 'ENOSPC'; throw error; } return original(file, data, ...args); };
    try { await assert.rejects(() => t.core.mark(t.key, { snapshotId: run.snapshotId, findingId: run.findings[0].findingId, suppressed: false })); } finally { fs.writeFileSync = original; }
    await assert.rejects(() => t.core.mark(t.key, { snapshotId: run.snapshotId, findingId: run.findings[0].findingId, suppressed: false }));
    await t.core.store.recover(); assert.equal(t.core.store.marks(t.key, run.snapshotId)[0].suppressed, true);
    await t.core.mark(t.key, { snapshotId: run.snapshotId, findingId: run.findings[0].findingId, suppressed: false }); assert.equal(t.core.store.marks(t.key, run.snapshotId)[0].suppressed, false);
  });
  await test('atomic run fault preserves prior file and never publishes partial JSON', async dir => {
    const t = await setup(dir), run = await t.core.requestBundle({ projectKey: t.key, deliveryId: t.delivery.deliveryId, bundle: bundle(dir, t.repo, 'a') });
    const original = fs.writeFileSync; let once = true;
    fs.writeFileSync = (file, data, ...args) => { if (once && typeof file === 'number') { once = false; original(file, String(data).slice(0, 7)); throw Error('injected write interruption'); } return original(file, data, ...args); };
    try { await assert.rejects(() => t.core.store.putRun(t.key, { ...run, status: 'running' })); } finally { fs.writeFileSync = original; }
    assert.equal(t.core.store.runs(t.key, run.snapshotId)[0].status, 'succeeded'); assert(!fs.readdirSync(t.core.store.location(t.key, 'runs')).some(n => n.includes('.tmp-')));
  });
  await test('annotation: file-level, codepoint limit, delete, and foreign finding rejection', async dir => {
    const t = await setup(dir), run = await t.core.requestBundle({ projectKey: t.key, deliveryId: t.delivery.deliveryId, bundle: bundle(dir, t.repo, 'a') }); const s = t.core.store.snapshot(t.key, run.snapshotId);
    const note = await t.core.annotate(t.key, { snapshotId: run.snapshotId, text: '😀'.repeat(2000), anchor: { path: 'code.js', side: 'head', startLine: null, endLine: null, sha256: s.files.find(f => f.path === 'code.js').headSha256 } }); assert.equal(Array.from(note.text).length, 2000); assert(markdown(t.core.selected(t.key, run.snapshotId)).includes('文件级'));
    await assert.rejects(() => t.core.annotate(t.key, { snapshotId: run.snapshotId, findingId: 'foreign', text: 'x' })); await t.core.deleteAnnotation(t.key, run.snapshotId, note.annotationId); assert.equal(t.core.store.annotations(t.key, run.snapshotId).length, 0);
  });
  await test('zero findings still exports overview/files and explicit synthetic qualification', async dir => {
    const t = await setup(dir, { model: req => modelFor(req.bundleRoot, { findings: false }) }), run = await t.core.requestBundle({ projectKey: t.key, deliveryId: t.delivery.deliveryId, bundle: bundle(dir, t.repo, 'a') });
    const context = t.core.selected(t.key, run.snapshotId), text = markdown(context); assert.equal(reviewStatus(context.snapshot, run), '未发现问题'); assert(text.includes('变更概览')); assert(text.includes('文件清单')); assert(text.includes('合成测试（未调用真实模型） · 合同推导状态：'));
  });
  await test('clipboard failure reports failure instead of success while retaining locked text', async dir => {
    const t = await setup(dir), run = await t.core.requestBundle({ projectKey: t.key, deliveryId: t.delivery.deliveryId, bundle: bundle(dir, t.repo, 'a') }); const drafts = new Drafts(t.adapter), lock = await drafts.lock(t.core.selected(t.key, run.snapshotId), 'issues');
    t.adapter.copy = async () => { throw Error('denied'); }; t.adapter.sessionRows.get('dev').archived = true;
    const result = await drafts.commit(lock.token, { displayedSnapshotId: run.snapshotId }); assert.equal(result.status, 'failed'); assert.equal(result.text, lock.text); assert.equal(t.adapter.calls.length, 1);
  });
}
