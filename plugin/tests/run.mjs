import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { fixture, bundle, until, syntheticModel } from '../../core/tests/helpers.mjs';
import { validate } from '../../core/validate.mjs';
import { modelFor } from '../../core/fixtures/model.mjs';
import { badCases } from '../../core/fixtures/cases.mjs';
import { errorMessage, EMPTY_WORKTREE_MESSAGE } from '../shared/contracts.ts';
import { freezeMethod } from '../../core/lib/method.mjs';
import { loadBundle, projectFor, SyntheticAdapter } from '../../core/index.mjs';
import { ClientBridge } from '../host/bridge.ts';
import { DshAdapter, reviewPrompt, parseReviewResponse } from '../host/dsh-adapter.ts';
import { PluginService } from '../host/service.ts';
import { ClientRuntime } from '../client/runtime.ts';
import { NativeClient } from '../client/native.ts';
import { fakeHost, nativeFixture } from './fakes.mjs';
import { installed } from '../scripts/toolchain.mjs';
import { captureChecks } from './capture.mjs';
import { hostRaceChecks } from './host-races.mjs';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const output = path.resolve(process.argv[2] || path.join(os.tmpdir(), 'evidentloop-plugin-tests-' + Date.now()));
if (fs.existsSync(output)) throw Error('Refusing to overwrite evidence'); fs.mkdirSync(output, { recursive: true });
const results = [], failures = [];
async function test(name, action) { try { await action(); results.push({ name, status: 'passed' }); } catch (error) { failures.push({ name, error: error.stack }); results.push({ name, status: 'failed' }); } }
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'evidentloop-plugin-fixture-')), repo = fixture(scratch), methodRoot = path.join(root, 'skills/evidentloop-review'), bundleRoot = bundle(scratch, repo, 'bundle');
const input = loadBundle(bundleRoot), key = projectFor(repo.root).projectKey;
const request = { runId: 'run-fixture', snapshot: { ...input.snapshot, projectKey: key, deliveryId: 'delivery-fixture' }, bundleRoot, modules: freezeMethod(methodRoot, input.snapshot, bundleRoot), reviewPaths: input.targets, carriedPaths: [], tools: [] };
const cid = crypto.randomUUID();
await captureChecks(test, scratch);
await hostRaceChecks(test, scratch, methodRoot, path.join(root, 'plugin/dist'));
function adapterFor(name, options = {}) {
  const host = fakeHost({ repo, ...options }), adapter = new DshAdapter(host.ctx, { root: path.join(scratch, name), bridge: new ClientBridge() });
  adapter.core = { store: { delivery: () => ({ title: 'Fixture', sessionIds: ['dev'] }) } };
  const approve = fields => fs.writeFileSync(adapter.approvalFile, JSON.stringify({ approvedBy: 'synthetic-test', taskId: 'fixture-only', expiresAt: new Date(Date.now() + 60000).toISOString(), maxCalls: 2, ...host.selection, projectKey: request.snapshot.projectKey, inputSha: request.snapshot.inputSha, promptVersion: request.snapshot.promptVersion, ...fields }));
  return { ...host, adapter, approve };
}
await test('bridge rejects a composer operation without its initiating client', async () => { const b = new ClientBridge(); assert.throws(() => b.call('getDraft', {}), /initiating client/); });
await test('bridge rejects disconnected clients and invalid heartbeat identity', async () => { const b = new ClientBridge(); assert.throws(() => b.withClient(cid, () => b.call('getDraft', {})), /disconnected/); assert.throws(() => b.next('bad'), /identity/); });
await test('bridge acknowledges only matching client and nonce', async () => { const b = new ClientBridge(); b.next(cid); const p = b.withClient(cid, () => b.call('getDraft', { sessionId: 'dev' })); const [job] = b.next(cid); assert.equal(b.next(cid).length, 0); assert.throws(() => b.answer(crypto.randomUUID(), job), /Unknown/); assert.throws(() => b.answer(cid, { ...job, nonce: 'wrong' }), /Unknown/); b.answer(cid, { ...job, result: { text: 'real acknowledgement' } }); assert.equal((await p).text, 'real acknowledgement'); b.close(); });
await test('bridge timeout is failure and a late answer is rejected', async () => { const b = new ClientBridge({ timeoutMs: 5 }); b.next(cid); const p = b.withClient(cid, () => b.call('writeDraft', {})), [job] = b.next(cid); await assert.rejects(p, /timed out/); assert.throws(() => b.answer(cid, job), /Unknown/); b.close(); });
await test('unload rejects pending and future composer actions', async () => { const b = new ClientBridge(); b.next(cid); const p = b.withClient(cid, () => b.call('getDraft', {})); b.close(); await assert.rejects(p, /unloaded/); assert.throws(() => b.withClient(cid, () => b.call('getDraft', {})), /unloaded/); });
await test('no model approval means zero native agents or prompts', async () => { const h = adapterFor('no-approval'); await assert.rejects(h.adapter.review(request, { signal: new AbortController().signal }), /预算/); assert.equal(h.calls.create.length, 0); assert.equal(h.calls.prompts.length, 0); });
await test('expired model approval fails before native agent creation', async () => { const h = adapterFor('expired'); h.approve({ expiresAt: '2000-01-01T00:00:00Z' }); await assert.rejects(h.adapter.review(request, { signal: new AbortController().signal }), /预算/); assert.equal(h.calls.create.length, 0); });
await test('selection and input-size mismatches do not call a model', async () => { const h = adapterFor('mismatch'); h.approve({ model: 'wrong' }); await assert.rejects(h.adapter.review(request, { signal: new AbortController().signal }), /模型/); h.approve({ maxInputBytes: 1 }); await assert.rejects(h.adapter.review(request, { signal: new AbortController().signal }), /输入预算/); assert.equal(h.calls.create.length, 0); });
await test('budget scope rejects a different repository, frozen input or method before creating an agent', async () => { for (const field of ['projectKey','inputSha','promptVersion']) { const h=adapterFor('scope-'+field); h.approve({[field]:'a'.repeat(64)}); await assert.rejects(h.adapter.review(request,{signal:new AbortController().signal}),/预算/); assert.equal(h.calls.create.length,0); } });
await test('malformed usage counters fail closed instead of bypassing the model budget', async () => { for (const used of ['bad',-1,1.5]) { const h=adapterFor('usage-'+String(used)); h.approve({used}); await assert.rejects(h.adapter.review(request,{signal:new AbortController().signal}),/预算/); assert.equal(h.calls.prompts.length,0); } });
await test('host initialization failure does not consume a model request budget', async () => { const h=adapterFor('title-unavailable');h.approve();const get=h.ctx.get;h.ctx.get=name=>name==='sessionTitle'?null:get(name);await assert.rejects(h.adapter.review(request,{signal:new AbortController().signal}),/标题/);assert.equal(JSON.parse(fs.readFileSync(h.adapter.approvalFile)).used||0,0);assert.equal(h.calls.prompts.length,0); });
await test('native review uses frozen cwd, inherited model, zero tools and canonical prompt', async () => { const h = adapterFor('native'); h.approve(); assert.deepEqual(await h.adapter.review(request, { signal: new AbortController().signal }), { ok: true }); const created = h.calls.create[0]; assert.equal(created.meta.cwd, bundleRoot); assert.equal(created.agentOptions.provider, h.selection.provider); assert.equal(created.agentOptions.reasoningEffort, 'high'); assert.equal(h.calls.prompts[0].requestId, request.runId); assert.equal(h.calls.prompts[0].mode, 'queue'); assert.equal(h.calls.titles.length, 1); assert.deepEqual(h.handles.get(created.sessionId).agent.allowed, []); assert.equal(h.ctx.tools.schemas().length, 1); assert.equal(h.calls.disposed.length, 1); assert.equal(h.listeners.size, 0); assert.equal(JSON.parse(fs.readFileSync(h.adapter.approvalFile)).used, 1); });
await test('approved context and output limits reach native request and persisted model identity', async () => { const h = adapterFor('large-output'); h.approve({ contextWindow: 1000000, maxOutputTokens: 393216 }); await h.adapter.review(request, { signal: new AbortController().signal }); const config = h.calls.create[0].agentOptions, saved = h.adapter.registry[h.calls.create[0].sessionId].model; assert.equal(config.maxTokens, 393216); assert.equal(saved.contextWindow, 1000000); assert.equal(saved.maxTokens, 393216); assert.equal(saved.provider, h.selection.provider); assert.equal(saved.model, h.selection.model); });
await test('invalid context budget is rejected before agent creation', async () => { const h = adapterFor('invalid-context'); h.approve({ contextWindow: -1 }); await assert.rejects(h.adapter.review(request, { signal: new AbortController().signal }), /预算/); assert.equal(h.calls.create.length, 0); });
await test('context mismatch fails before model creation or budget claim', async () => { const h = adapterFor('mismatched-context'); h.approve({ contextWindow: 1000000 }); h.ctx.llm.resolveModelInfo = async () => ({ context: { contextWindow: 1048576 } }); await assert.rejects(h.adapter.review(request, { signal: new AbortController().signal }), /上下文/); assert.equal(h.calls.create.length, 0); assert.equal(h.calls.prompts.length, 0); assert.equal(JSON.parse(fs.readFileSync(h.adapter.approvalFile)).used || 0, 0); });
await test('review session registry excludes its own turn from development', async () => { const h = adapterFor('registry'); h.approve(); await h.adapter.review(request, { signal: new AbortController().signal }); const id = h.calls.create[0].sessionId; h.rows.push({ sessionId: id, cwd: bundleRoot }); assert.equal((await h.adapter.session(id)).kind, 'review'); assert.equal((await h.adapter.session(id)).projectKey, key); });
await test('invalid JSON remains byte-for-byte raw instead of repaired fixture', async () => { const h = adapterFor('bad-json', { mode: 'invalid-json' }); h.approve(); await assert.rejects(h.adapter.review(request, { signal: new AbortController().signal }), /合法JSON/); assert.equal(fs.readFileSync(path.join(h.adapter.root, 'model-output/run-fixture.raw.txt'), 'utf8'), 'not JSON'); assert.equal(h.calls.disposed.length, 1); });
await test('review response accepts old JSON and exactly one presentation envelope', () => {
  const value = { note: 'Literal ``` inside JSON stays intact', items: [1, 2] }, raw = JSON.stringify(value);
  for (const text of [raw, '\uFEFF  ' + raw, '```json\n' + raw + '\n```', '审查了 2 个文件，发现 1 个问题。\n\n```json\n' + raw + '\n```', '摘要。\r\n\r\n```json\r\n' + raw + '\r\n```']) assert.deepEqual(parseReviewResponse(text), value);
});
await test('review envelope rejects ambiguous, malformed and unfinished output without repair', () => {
  for (const raw of ['说明 {"ok":true}', '```json\n{"ok":true}', '```json\n{"ok":true}\n```\ntrailing', '```json\n{}\n```\n```json\n{}\n```', '```js\n{}\n```', 'x'.repeat(501) + '\n```json\n{}\n```', 'a\nb\nc\nd\n```json\n{}\n```', '```json\n{invalid}\n```']) assert.throws(() => parseReviewResponse(raw), /合法JSON/);
});
await test('fenced native review preserves the original response and spends only one synthetic call', async () => {
  const raw = '检查了冻结改动，结果见结构化数据。\n\n```json\n{"ok":true}\n```', h = adapterFor('fenced-json', { responseText: raw }); h.approve();
  assert.deepEqual(await h.adapter.review(request, { signal: new AbortController().signal }), { ok: true });
  assert.equal(fs.readFileSync(path.join(h.adapter.root, 'model-output/run-fixture.raw.txt'), 'utf8'), raw); assert.equal(h.calls.prompts.length, 1); assert.equal(h.calls.disposed.length, 1);
});
await test('presentation envelopes preserve every existing four-layer rejection and withholding result', () => {
  const models = [modelFor(bundleRoot), ...badCases.map(([, mutate]) => { const m = modelFor(bundleRoot); mutate(m); return m; })];
  for (const model of models) {
    const raw = JSON.stringify(model), direct = validate(bundleRoot, JSON.parse(raw), {runId:'same'}), fenced = validate(bundleRoot, parseReviewResponse('摘要只供阅读。\n\n```json\n'+raw+'\n```'), {runId:'same'});
    assert.deepEqual(fenced, direct);
  }
});
await test('empty working trees retain a friendly message through the shared host and UI formatter', () => {
  assert.equal(errorMessage(new Error(EMPTY_WORKTREE_MESSAGE)), '当前仓库还没有文件。');
  assert.equal(errorMessage(new Error('An unrelated filesystem failure')), 'An unrelated filesystem failure');
});
await test('conversation capture failure stays in the conversation; success reveals only the ready review panel', async () => {
  let shown = 0, opened = null; const runtime = new ClientRuntime({showPanel:()=>shown++});
  runtime.api = async()=>({available:true,workspaceId:'w1',sessionId:'dev'});
  runtime.run = async()=>({status:'incomplete',code:'empty-worktree',reason:EMPTY_WORKTREE_MESSAGE});
  await assert.rejects(runtime.openFromSession('dev'), e=>e.message===EMPTY_WORKTREE_MESSAGE);
  assert.equal(shown,0); assert.equal(runtime.state.page,'list'); assert.equal(runtime.state.error,'');
  runtime.run = async()=>({status:'pending',deliveryId:'delivery',snapshotId:'snapshot'});
  runtime.open = async (...args)=>{assert.equal(shown,0);opened=args;};
  await runtime.openFromSession('dev'); assert.equal(shown,1); assert.deepEqual(opened,['delivery','overview','snapshot']);
});
await test('transport failure cancels without automatic extra requests', async () => { const h = adapterFor('transport', { mode: 'transport' }); h.approve(); await assert.rejects(h.adapter.review(request, { signal: new AbortController().signal }), /TRANSPORT/); assert.equal(h.calls.prompts.length, 1); assert.equal(h.calls.cancel.length, 1); assert.equal(h.calls.disposed.length, 1); });
await test('abort waits for native cancellation then disposes its session lease', async () => { const h = adapterFor('cancel', { mode: 'wait' }); h.approve(); const c = new AbortController(), p = h.adapter.review(request, { signal: c.signal }); p.catch(() => {}); await until(() => h.calls.prompts.length); c.abort(); await assert.rejects(p, /abort/i); assert.equal(h.calls.cancel.length, 1); assert.equal(h.calls.disposed.length, 1); assert.equal(h.adapter.active.size, 0); });
await test('frozen review prompt injects all nine exact method modules and actual target files', () => { const prompt = reviewPrompt(request); for (const m of request.modules.filter(m => !m.path.startsWith('bundle/'))) { assert.ok(prompt.includes(m.text)); assert.ok(prompt.includes(m.sha256)); } for (const target of input.targets) assert.ok(prompt.includes('--- BUNDLE head/' + target + ' ---')); assert.ok(!prompt.includes('Existing handwritten draft')); });
await test('review prompt refuses a symlink in input instead of following outside files', () => { const p = path.join(bundleRoot, 'illegal-link'); fs.symlinkSync('/etc/hosts', p); try { assert.throws(() => reviewPrompt(request), /symlink/); } finally { fs.unlinkSync(p); } });
const oldFrame = globalThis.requestAnimationFrame;
for (const [name, options] of [['normal', {}], ['concurrent', { concurrent: true }], ['corrupt', { corrupt: true }]]) await test('native composer ' + name + ' preserves target metadata and reports actual result', async () => {
  const f = nativeFixture(options), client = new NativeClient(f.ctx); globalThis.requestAnimationFrame = f.frame;
  const before = await client.execute('getDraft', { sessionId: 'dev' }); const value = await client.execute('writeDraft', { sessionId: 'dev', expectedRevision: before.revision, text: 'Appended text' });
  if (name === 'normal') { assert.equal(value.written, true); assert.equal(f.input.draftSnapshot.text, 'Appended text'); assert.deepEqual(f.input.draftSnapshot.quotes, before.quotes); assert.deepEqual(f.input.draftSnapshot.references, before.references); }
  else if (name === 'concurrent') { assert.equal(value.written, false); assert.equal(f.input.draftSnapshot.text, 'Appended text + user typed'); }
  else { assert.equal(value.written, false); assert.equal(f.input.draftSnapshot.text, before.text); assert.deepEqual(f.input.draftSnapshot.references, before.references); assert.deepEqual(f.input.draftSnapshot.quotes, before.quotes); }
  assert.deepEqual(f.input.state.getSnapshot().attachmentIds, before.attachments); assert.equal(f.released, 2); assert.equal(f.persisted, 1);
});
await test('stale composer revision never overwrites existing user draft', async () => { const f = nativeFixture(), c = new NativeClient(f.ctx); globalThis.requestAnimationFrame = f.frame; assert.equal((await c.execute('writeDraft', { sessionId: 'dev', expectedRevision: 0, text: 'BAD' })).written, false); assert.equal(f.input.draftSnapshot.text, 'Existing handwritten draft'); assert.equal(f.persisted, 0); });
await test('expired composer task releases no lease and writes nothing', async () => { const f = nativeFixture(), c = new NativeClient(f.ctx); await assert.rejects(c.execute('writeDraft', { sessionId: 'dev', expectedRevision: 7, text: 'BAD' }, Date.now() - 1), /过期/); assert.equal(f.released, 0); assert.equal(f.input.draftSnapshot.text, 'Existing handwritten draft'); });
globalThis.requestAnimationFrame = oldFrame;
const h = fakeHost({ repo }), service = await new PluginService(h.ctx, { storageRoot: path.join(scratch, 'service-state'), methodRoot, assetRoot: path.join(root, 'plugin/dist') }).initialize();
const call = async (name, body, query) => { const result = await h.fetchRoute(name, body, query); return { ...result, data: JSON.parse(result.text) }; };
await test('exact IPC routes register without opening a separate server', () => { assert.ok(h.routes.has('/api/dsh-evidentloop/bootstrap')); assert.ok(h.routes.has('/api/dsh-evidentloop/draft/commit')); assert.ok(!h.routes.has('/api/dsh-evidentloop/*')); assert.equal(service.modelGate().approved, false); });
await test('unknown workspace cannot address repository settings', async () => { const r = await call('settings', { workspaceId: 'foreign', settings: {} }); assert.equal(r.status, 400); assert.match(r.data.error, /工作区不存在/); });
await test('four settings save to the same repo, normalize LF and do not trigger review', async () => { const settings = { autoMode: true, targetBranch: ' main ', extensionPrompt: '第一行\r\n第二行😀', exportEmbedDiff: false }; const r = await call('settings', { workspaceId: 'w1', settings }); assert.equal(r.status, 200); const data = await service.bootstrap('w2'); assert.deepEqual(data.settings, { ...settings, targetBranch: 'main', extensionPrompt: '第一行\n第二行😀' }); assert.equal(h.calls.create.length, 0); });
await test('extension code-point boundary rejects overflow without altering saved settings', async () => { const s = (await service.bootstrap('w1')).settings; assert.equal((await call('settings', { workspaceId: 'w1', settings: { ...s, extensionPrompt: '😀'.repeat(20000) } })).status, 200); assert.equal((await call('settings', { workspaceId: 'w1', settings: { ...s, extensionPrompt: '😀'.repeat(20001) } })).status, 400); assert.equal(Array.from((await service.bootstrap('w1')).settings.extensionPrompt).length, 20000); await call('settings', { workspaceId: 'w1', settings: { ...s, autoMode: false, extensionPrompt: '' } }); });
const otherRepo = fixture(scratch, 'other-repo'); h.workspaces.push({ id: 'other', title: 'Another repo', path: otherRepo.root, sessionIds: [] });
await test('different repositories isolate settings and switching back restores values', async () => { assert.equal((await service.bootstrap('other')).settings.extensionPrompt, ''); const s = (await service.bootstrap('other')).settings; await call('settings', { workspaceId: 'other', settings: { ...s, targetBranch: 'another' } }); assert.equal((await service.bootstrap('w1')).settings.targetBranch, 'main'); assert.equal((await service.bootstrap('other')).settings.targetBranch, 'another'); });
await test('non-Git workspace is explicit and cannot start a review', async () => { const dir = path.join(scratch, 'plain'); fs.mkdirSync(dir); h.workspaces.push({ id: 'plain', path: dir, title: 'Non-Git', sessionIds: [] }); assert.equal((await service.bootstrap('plain')).project.notGit, true); await assert.rejects(service.review({ workspaceId: 'plain' }), /不是Git/); });
const synthetic = new SyntheticAdapter({ model: syntheticModel, sessions: [{ id: 'dev', projectKey: key, kind: 'development', title: 'Fixture development' }] }); service.core.adapter = synthetic;
const run = await service.core.trigger({ repo: repo.root, target: 'main', sessionId: 'dev' });
if (run.status !== 'succeeded') throw Error('Synthetic record seed failed: ' + JSON.stringify(run));
const current = service.core.store.delivery(key, run.deliveryId), params = '?workspaceId=w1&deliveryId=' + run.deliveryId;
await test('record API returns actual core result and hides its private bundle root', async () => { const r = await call('record', undefined, params); assert.equal(r.status, 200); assert.equal(r.data.run.runId, run.runId); assert.equal('bundleRoot' in r.data, false); assert.equal(r.data.readOnly, false); });
await test('running record without findings rejects an unknown quote identity without dereferencing findings', async () => { const original = service.selected.bind(service); service.selected = (...args) => { const selected = original(...args); const pending = { ...selected.run, status: 'running' }; delete pending.findings; return { ...selected, run: pending }; }; try { const result = await call('quote', { workspaceId: 'w1', deliveryId: run.deliveryId, snapshotId: run.snapshotId, findingId: 'missing', clientId: cid }); assert.equal(result.status, 400); assert.equal(result.data.error, '问题不属于当前记录'); } finally { service.selected = original; } });
await test('frozen file route stays frozen when live worktree changes', async () => { const before = fs.readFileSync(path.join(repo.root, 'code.js'), 'utf8'); fs.writeFileSync(path.join(repo.root, 'code.js'), 'LIVE_MUTATION_NOT_REVIEWED'); try { const r = await call('file', undefined, params + '&path=code.js'); assert.equal(r.data.head, before); assert.ok(!r.text.includes('LIVE_MUTATION_NOT_REVIEWED')); } finally { fs.writeFileSync(path.join(repo.root, 'code.js'), before); } });
await test('file route cannot escape frozen target paths', async () => { const r = await call('file', undefined, params + '&path=..%2F..%2Fetc%2Fhosts'); assert.equal(r.status, 400); });
await test('mark and restore use core finding identity and update active count', async () => { const f = run.findings[0]; await call('mark', { workspaceId: 'w1', deliveryId: run.deliveryId, snapshotId: run.snapshotId, findingId: f.findingId, suppressed: true }); assert.equal((await service.bootstrap('w1')).deliveries[0].activeFindingCount, run.findings.length - 1); await call('mark', { workspaceId: 'w1', deliveryId: run.deliveryId, snapshotId: run.snapshotId, findingId: f.findingId, suppressed: false }); assert.equal((await service.bootstrap('w1')).deliveries[0].activeFindingCount, run.findings.length); });
await test('MD and HTML download selected frozen facts with attachment headers', async () => { const md = await h.fetchRoute('download', undefined, params + '&format=md'), html = await h.fetchRoute('download', undefined, params + '&format=html'); assert.equal(md.status, 200); assert.match(md.headers['content-disposition'], /attachment;/); assert.ok(md.text.includes('合成测试')); assert.ok(html.text.includes('Content-Security-Policy')); assert.ok(html.text.includes('合成测试')); });
await test('delete requires explicit confirmation and does not delete on cancellation', async () => { const r = await call('delivery', { workspaceId: 'w1', deliveryId: run.deliveryId, action: 'delete' }); assert.equal(r.status, 400); assert.ok(service.core.store.delivery(key, run.deliveryId)); });
await test('history rejects annotation and mark writes through core', async () => { await service.core.trigger({ repo: repo.root, target: 'main', sessionId: 'dev' }); const b = { workspaceId: 'w1', deliveryId: run.deliveryId, snapshotId: run.snapshotId }; assert.equal((await call('mark', { ...b, findingId: run.findings[0].findingId, suppressed: true })).status, 400); assert.equal((await call('annotation', { ...b, findingId: run.findings[0].findingId, text: 'History write' })).status, 400); });
await test('requirements messages use a pinned cursor and authoritative event sequence', async () => { const requests = []; h.ctx.sessionController.events = async opts => { requests.push(opts); return opts.beforeSeq === undefined ? { cursor: 9, hasMore: true, records: [{ type: 'event', event: { seq: 8, type: 'user/message', data: { id: 'b', source: { kind: 'user' }, content: [{ type: 'text', text: 'Second' }] } } }] } : { cursor: 9, hasMore: false, records: [{ type: 'event', event: { seq: 2, type: 'user/message', data: { id: 'a', source: { kind: 'user' }, content: [{ type: 'text', text: 'First' }] } } }, { type: 'event', event: { seq: 3, type: 'user/message', data: { id: 'review', source: { kind: 'evidentloop-review' }, content: [{ type: 'text', text: 'Excluded' }] } } }] }; }; assert.deepEqual((await service.messages('dev')).map(m => m.text), ['First', 'Second']); assert.equal(requests[1].throughSeq, 9); assert.equal(requests[1].beforeSeq, 8); });
await service.close();
await test('production bundle has no prototype business code and packages exact method nine', () => { const m = JSON.parse(fs.readFileSync(path.join(root, 'plugin/dist/build-manifest.json'))); assert.equal(m.noPrototypeBusinessJs, true); assert.equal(m.methodFiles.length, 9); assert.ok(!m.inputs.some(i => /tests|fixtures|prototype\/src/.test(i.path))); assert.ok(m.coreImported.length > 0); });
await test('built host cold-loads and registers exact routes through public Cordis entry', async () => {
  const entry = await import('../dist/host.mjs'), host = fakeHost({ repo }); let dispose;
  host.ctx.effect = factory => { dispose = factory(); };
  const returned = await entry.apply(host.ctx, { storageRoot: path.join(scratch, 'built-host') });
  assert.equal(entry.name, 'dsh-evidentloop'); assert.ok(entry.inject.includes('connection')); assert.ok(host.routes.has('/api/dsh-evidentloop/bootstrap'));
  assert.equal(returned, undefined, 'Cordis rejects a plain object effect'); await dispose();
});
await test('native workspace list observes its actual list store and follows the selected session', () => {
  const subscribed = [], store = { getSnapshot: () => ({ items: [{ workspaceId: 'actual-workspace', sessionIds: ['actual-session'] }] }), subscribe: fn => { subscribed.push(fn); return () => {}; } };
  const w = { workspaces: { list: store }, selection: { getSnapshot: () => ({ sessionId: 'actual-session' }), subscribe: store.subscribe } }, session = { current: { getSnapshot: () => ({ key: 'actual-session' }), subscribe: store.subscribe } };
  const c = new NativeClient({ get: k => k === 'uiWorkspace' ? w : session }); assert.equal(c.workspaceId(), 'actual-workspace'); const off = c.subscribe(() => {}); assert.equal(subscribed.length, 3); off();
});
await test('built client ModuleLoader exports public entry using host React only', () => {
  const rt = installed('react', process.env.REACT_PACKAGE); let entry;
  vm.runInNewContext(fs.readFileSync(path.join(root, 'plugin/dist/client.js'), 'utf8'), { window: { __ModuleLoader__: { load: module => { assert.equal(module.id, '@evidentloop/dsh-evidentloop'); entry = module.factory(name => { assert.ok(['react', 'react-dom'].includes(name)); return rt.require(name); }); } } } });
  assert.equal(entry.name, 'dsh-evidentloop'); assert.equal(typeof entry.apply, 'function'); assert.ok(entry.inject.includes('uiWorkspace'));
});
await test('React component renders real props and escapes user controlled titles', async () => {
  const es = installed('esbuild').require('esbuild'), rt = installed('react', process.env.REACT_PACKAGE);
  const React = rt.require('react'), { renderToStaticMarkup } = rt.require('react-dom/server');
  const compiled = await es.build({ absWorkingDir: root, entryPoints: ['plugin/client/app.tsx'], jsx: 'transform', tsconfigRaw: { compilerOptions: { jsx: 'react' } }, bundle: true, format: 'cjs', platform: 'node', external: ['react', 'react-dom'], write: false, logLevel: 'silent' });
  const sandbox = { module: { exports: {} }, require: name => { assert.ok(['react', 'react-dom'].includes(name)); return rt.require(name); } }; sandbox.exports = sandbox.module.exports; vm.runInNewContext(compiled.outputFiles[0].text, sandbox);
  const data = await service.bootstrap('w1'); data.deliveries[0].title = '<script>alert(1)</script>'; const state = { loading: false, workspaceId: 'w1', data, page: 'list' }, runtime = { subscribe: () => () => {}, getSnapshot: () => state, native: { sessionId: () => 'dev' } };
  const markup = renderToStaticMarkup(React.createElement(sandbox.module.exports.Panel, { runtime })); assert.ok(markup.includes('&lt;script&gt;')); assert.ok(!markup.includes('<script>')); assert.ok(markup.includes('Fixture repository')); assert.ok(markup.includes('演示模式')); fs.writeFileSync(path.join(output, 'component-ssr.html'), markup);
});
fs.writeFileSync(path.join(output, 'results.json'), JSON.stringify({ results, failures, namedCases: results.length, passed: results.filter(r => r.status === 'passed').length, realModelCalls: 0, nativeDshIntegration: false, fixtures: 'Synthetic public API contract only; not a P4 end-to-end result' }, null, 2) + '\n');
console.log(JSON.stringify({ output, namedCases: results.length, passed: results.filter(r => r.status === 'passed').length, failures: failures.map(f => ({ name: f.name, error: f.error.split('\n').slice(0, 3).join('\n') })), realModelCalls: 0 }));
if (!process.env.KEEP_PLUGIN_FIXTURES) fs.rmSync(scratch, { recursive: true, force: true });
process.exitCode = failures.length ? 1 : 0;
