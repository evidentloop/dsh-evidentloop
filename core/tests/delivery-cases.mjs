import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { ReviewCore, SyntheticAdapter, projectFor, developmentSession, markdown } from '../index.mjs';
import { repository } from './repo-fixture.mjs';
import { syntheticModel, setup, bundle, deferred, until } from './helpers.mjs';
export async function runDeliveries(test) {
  await test('delivery: origin/HEAD resolves actual default branch; detached HEAD cannot invent target grouping', async dir => {
    const r = repository(path.join(dir, 'repo')), files = { 'code.js': 'export const n = 1;\n' }, base = r.commit(files, []); r.ref('main', base); r.ref('feature', base); r.worktree({ 'code.js': 'export const n = 2;\n' });
    fs.writeFileSync(path.join(r.root, '.git/HEAD'), 'ref: refs/heads/main\n'); fs.mkdirSync(path.join(r.root, '.git/refs/remotes/origin'), { recursive: true }); fs.writeFileSync(path.join(r.root, '.git/refs/remotes/origin/main'), base+'\n'); fs.writeFileSync(path.join(r.root, '.git/refs/remotes/origin/HEAD'), 'ref: refs/remotes/origin/main\n');
    const project = projectFor(r.root), adapter = new SyntheticAdapter({ model: syntheticModel, sessions: [{ id:'dev',kind:'development',projectKey:project.projectKey }] }), core = await new ReviewCore({storageRoot:path.join(dir,'state'),adapter}).initialize();
    const run = await core.trigger({repo:r.root,sessionId:'dev'}); assert.equal(run.status,'succeeded'); assert.equal(core.store.delivery(project.projectKey,run.deliveryId).bindKey.kind,'session');
    fs.writeFileSync(path.join(r.root,'.git/HEAD'),base+'\n'); const before=core.store.deliveries(project.projectKey).length; const detached=await core.trigger({repo:r.root,sessionId:'dev'}); assert.equal(detached.status,'incomplete'); assert.equal(detached.code,'branch-unavailable'); assert.equal(core.store.deliveries(project.projectKey).length,before); assert.equal(adapter.calls.length,1);
  });
  await test('delivery: branch not ahead → dirty → identical commit dedupe updates observation → merge closes once → new edit creates new delivery', async dir => {
    const r = repository(path.join(dir, 'repo')), original = { 'code.js': 'export function value(){\n return 1;\n}\n' };
    const base = r.commit(original, [], 'initial'); r.ref('main', base); r.ref('feature', base); r.worktree(original);
    const project = projectFor(r.root), adapter = new SyntheticAdapter({ model: syntheticModel, sessions: [{ id: 'dev', kind: 'development', projectKey: project.projectKey }] });
    const core = await new ReviewCore({ storageRoot: path.join(dir, 'state'), adapter }).initialize();
    await core.store.setSettings(project.projectKey, { autoMode: true, targetBranch: 'main', extensionPrompt: '', exportEmbedDiff: false });
    const clean = await core.trigger({ repo: r.root, sessionId: 'dev', trigger: 'auto' }); assert.equal(clean.status, 'succeeded'); assert.equal(adapter.calls.length, 0);
    const firstDeliveryId = clean.deliveryId; assert.equal(core.store.delivery(project.projectKey, firstDeliveryId).everAhead, false);
    const modified = { 'code.js': 'export function value(){\n return 2;\n}\n' }; fs.writeFileSync(path.join(r.root, 'code.js'), modified['code.js']);
    const dirty = await core.trigger({ repo: r.root, sessionId: 'dev', trigger: 'auto' }); assert.equal(adapter.calls.length, 1); assert.equal(dirty.deliveryId, firstDeliveryId);
    const head = r.commit(modified, [base], 'actual commit'); r.ref('feature', head);
    const committed = await core.trigger({ repo: r.root, sessionId: 'dev', trigger: 'auto' });
    assert.equal(committed.inputSha, dirty.inputSha); assert.equal(committed.snapshotId, dirty.snapshotId); assert.equal(adapter.calls.length, 1);
    const d = core.store.delivery(project.projectKey, firstDeliveryId); assert.equal(d.lastHeadSha, head); assert.equal(d.everAhead, true);
    r.ref('main', r.commit(modified, [head], 'merged'));
    const closed = await core.trigger({ repo: r.root, sessionId: 'dev', trigger: 'auto' }); assert.equal(closed.status, 'closed'); const at = closed.delivery.closedAt; assert(at);
    await core.store.archive(project.projectKey, firstDeliveryId, false);
    await core.trigger({ repo: r.root, sessionId: 'dev', trigger: 'auto' }); assert.equal(core.store.delivery(project.projectKey, firstDeliveryId).closedAt, at); assert(!core.store.delivery(project.projectKey, firstDeliveryId).archivedAt); assert.equal(core.store.deliveries(project.projectKey).length, 1);
    fs.writeFileSync(path.join(r.root, 'code.js'), 'export function value(){\n return 3;\n}\n'); const next = await core.trigger({ repo: r.root, sessionId: 'dev', trigger: 'auto' });
    assert.notEqual(next.deliveryId, firstDeliveryId); assert.equal(core.store.delivery(project.projectKey, firstDeliveryId).closedAt, at);
  });
  await test('delivery: target branch groups by root session; branch groups share sessions; title saved once; manual creates separate delivery', async dir => {
    const t = await setup(dir); t.adapter.sessionRows.set('child', { id: 'child', origin: 'subagent', parentSession: 'dev', kind: 'development', projectKey: t.key });
    t.adapter.sessionRows.set('dev2', { id: 'dev2', kind: 'development', title: '第二会话', projectKey: t.key });
    const root = await developmentSession(t.adapter, 'child'); assert.equal(root.id, 'dev');
    const input = { branch: 'main', targetBranch: 'main', session: root, requirements: [{ order: 0, text: '需求优先标题\n详情' }], headSha: t.repo.base, baseSha: t.repo.base, targetSha: t.repo.base, reachable: async () => false };
    const a = (await t.core.deliveries.observe(t.project, input)).delivery; assert.equal(a.bindKey.kind, 'session'); assert.deepEqual(a.sessionIds, ['dev']); assert.equal(a.title, '需求优先标题');
    const same = (await t.core.deliveries.observe(t.project, { ...input, requirements: [{ order: 0, text: '不能覆盖已保存标题' }] })).delivery; assert.equal(same.title, a.title);
    const other = (await t.core.deliveries.observe(t.project, { ...input, session: await t.adapter.session('dev2') })).delivery; assert.notEqual(other.deliveryId, a.deliveryId);
    const branch = (await t.core.deliveries.observe(t.project, { ...input, branch: 'feature', session: await t.adapter.session('dev2') })).delivery; assert.equal(branch.deliveryId, t.delivery.deliveryId); assert.deepEqual(branch.sessionIds, ['dev', 'dev2']); assert.equal(branch.title, 'feature');
    const m1 = (await t.core.deliveries.observe(t.project, { ...input, session: null })).delivery, m2 = (await t.core.deliveries.observe(t.project, { ...input, session: null })).delivery; assert.notEqual(m1.deliveryId, m2.deliveryId);
  });
  await test('delivery: concurrent observations create one branch group, and subfolders resolve same project/settings', async dir => {
    const t = await setup(dir), input = { branch: 'parallel', targetBranch: 'main', headSha: t.repo.base, baseSha: t.repo.base, targetSha: t.repo.base, reachable: async () => false };
    const [a, b] = await Promise.all([t.core.deliveries.observe(t.project, input), t.core.deliveries.observe(t.project, input)]); assert.equal(a.delivery.deliveryId, b.delivery.deliveryId);
    fs.mkdirSync(path.join(t.repo.root, 'nested')); await t.core.store.setSettings(t.key, { autoMode: false, targetBranch: 'main', extensionPrompt: '', exportEmbedDiff: false });
    const run = await t.core.trigger({ repo: path.join(t.repo.root, 'nested'), sessionId: 'dev' }); assert.equal(run.deliveryId, t.delivery.deliveryId); assert.equal(t.core.store.snapshot(t.key, run.snapshotId).projectKey, t.key);
    assert.notEqual(projectFor(path.join(dir, 'state')).projectKey, t.key);
  });
  await test('incremental: changed rules invalidates copied findings and marks', async dir => {
    const t = await setup(dir), a = await t.core.requestBundle({ projectKey: t.key, deliveryId: t.delivery.deliveryId, bundle: bundle(dir, t.repo, 'a') });
    await t.core.mark(t.key, { snapshotId: a.snapshotId, findingId: a.findings[0].findingId, suppressed: true });
    const b = await t.core.requestBundle({ projectKey: t.key, deliveryId: t.delivery.deliveryId, bundle: bundle(dir, t.repo, 'b', { extension: '额外关注边界' }) });
    assert.equal(t.adapter.calls.at(-1).scope.length, 2); assert(!b.findings[0].carriedFrom); assert.equal(t.core.store.marks(t.key, b.snapshotId).length, 0);
  });
  await test('incremental: withheld source file is not carried while unrelated clean file may carry', async dir => {
    let bad = true;
    const t = await setup(dir, { model: req => { const m = syntheticModel(req); if (bad && m.findings[0]) m.findings[0].evidence[0].quote = 'invalid'; return m; } });
    const a = await t.core.requestBundle({ projectKey: t.key, deliveryId: t.delivery.deliveryId, bundle: bundle(dir, t.repo, 'a') }); assert(!a.complete); bad = false;
    fs.writeFileSync(path.join(t.repo.root, 'code.js'), 'export const changed = 3;\n');
    const b = await t.core.requestBundle({ projectKey: t.key, deliveryId: t.delivery.deliveryId, bundle: bundle(dir, t.repo, 'b') });
    assert.deepEqual(t.adapter.calls.at(-1).scope, ['code.js']); assert(b.understanding.files.find(f => f.path === 'other.js').carriedFrom); assert(b.complete);
  });
  await test('storage: interrupted active run becomes selected failed record; torn annotation tail and partial temp do not replace valid data', async dir => {
    const t = await setup(dir), run = await t.core.requestBundle({ projectKey: t.key, deliveryId: t.delivery.deliveryId, bundle: bundle(dir, t.repo, 'a') });
    const note = await t.core.annotate(t.key, { snapshotId: run.snapshotId, findingId: run.findings[0].findingId, text: '保留正文' });
    fs.appendFileSync(t.core.store.location(t.key, 'annotations.jsonl'), '{"torn"');
    const interrupted = { ...run, runId: 'interrupted', status: 'running', complete: false }; await t.core.store.putRun(t.key, interrupted); await t.core.store.updateDelivery(t.key, t.delivery.deliveryId, d => { d.activeRunId = 'interrupted'; });
    fs.writeFileSync(t.core.store.location(t.key, 'runs', 'interrupted.json.tmp-dead'), '{"not complete"');
    const reopened = await new ReviewCore({ storageRoot: t.core.store.root, adapter: t.adapter }).initialize();
    assert.equal(reopened.selected(t.key, run.snapshotId).run.status, 'failed'); assert.equal(reopened.selected(t.key, run.snapshotId).run.errorCode, 'interrupted'); assert.equal(reopened.store.annotations(t.key, run.snapshotId)[0].annotationId, note.annotationId);
    assert(!fs.existsSync(t.core.store.location(t.key, 'runs', 'interrupted.json.tmp-dead')));
  });
  await test('storage: deleting running delivery cancels before cascade and cannot be revived by late model output', async dir => {
    const started = deferred(), cancelled = deferred(), release = deferred();
    const t = await setup(dir, { model: async (r, { signal }) => { started.resolve(); signal.addEventListener('abort', () => cancelled.resolve(), { once: true }); await release.promise; return syntheticModel(r); } });
    const run = t.core.requestBundle({ projectKey: t.key, deliveryId: t.delivery.deliveryId, bundle: bundle(dir, t.repo, 'a') }); await started.promise;
    const deleting = t.core.deleteDelivery(t.key, t.delivery.deliveryId); await cancelled.promise; release.resolve(); await Promise.all([run, deleting]);
    assert.equal(t.core.store.deliveries(t.key).length, 0); assert.equal(t.core.store.runs(t.key).length, 0); assert.equal(t.core.store.events(t.key, 'annotations').length, 0);
  });
}
