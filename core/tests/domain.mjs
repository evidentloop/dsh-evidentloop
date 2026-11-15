import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { setup, bundle, syntheticModel, fixture, deferred, until } from './helpers.mjs';
import { FileStore, ReviewCore, SyntheticAdapter, Drafts, markdown, html, reviewStatus, methodVersion } from '../index.mjs';
import { repository } from './repo-fixture.mjs';
import { createGit, preflight, rangeOf, currentBranchOf, EMPTY_WORKTREE_MESSAGE } from '../lib/git.mjs';
import { writeIndex } from './git-cases.mjs';
import { prepare, loadBundle, projectFor } from '../index.mjs';
import { treeDigest } from './helpers.mjs';
import { METHOD_ROOT } from '../lib/common.mjs';
export async function runDomain(test, root) {
  await test('unborn repositories freeze staged and untracked working-tree bytes against an empty tree without Git writes', async dir => {
    for (const withIndex of [true, false]) {
      const repo = repository(path.join(dir, withIndex ? 'indexed' : 'no-index'));
      repo.worktree({'code.js':'export const value = 2;\n','other.js':'export const other = 1;\n','.env':'PRIVATE_NOT_FROZEN'});
      if (withIndex) writeIndex(repo,[{name:'code.js',oid:repo.object('blob','export const value = 1;\n'),stage:0}]);
      else fs.unlinkSync(path.join(repo.root,'.git/index'));
      const key=projectFor(repo.root).projectKey, adapter=new SyntheticAdapter({model:syntheticModel,sessions:[{id:'dev',kind:'development',projectKey:key}]}),core=await new ReviewCore({storageRoot:path.join(dir,withIndex?'state-indexed':'state-no-index'),adapter}).initialize();
      const before=treeDigest(repo.root),git=createGit(repo.root);assert.equal(currentBranchOf(git),'feature');preflight(git);
      const frozen=await core.trigger({repo:repo.root,target:'main',sessionId:'dev',captureOnly:true});assert.equal(frozen.status,'pending');assert.equal(adapter.calls.length,0);
      const snapshot=core.store.snapshot(key,frozen.snapshotId);assert.equal(snapshot.range.kind,'empty-tree-worktree');assert.equal(snapshot.range.headSha,null);assert.equal(snapshot.range.baseSha,'4b825dc642cb6eb9a060e54bf8d69288fbee4904');assert.ok(snapshot.files.every(f=>f.change==='added'&&f.baseSha256===null));
      const view=core.selected(key,frozen.snapshotId),data=loadBundle(view.bundleRoot);assert.equal(data.texts.get('head:code.js').text,'export const value = 2;\n');assert.equal(data.texts.has('base:code.js'),false);assert.deepEqual(data.targets,['code.js','other.js']);assert.deepEqual(treeDigest(repo.root),before);
      const reviewed=await core.reviewCurrent(key,frozen.deliveryId);assert.equal(reviewed.complete,true);assert.equal(adapter.calls.length,1);assert.ok(markdown(core.selected(key,frozen.snapshotId)).includes('无历史提交，全部视为新增'));
      const replay=await core.trigger({repo:repo.root,target:'main',sessionId:'dev'});assert.equal(replay.inputSha,reviewed.inputSha);assert.equal(adapter.calls.length,1);
      fs.writeFileSync(path.join(repo.root,'code.js'),'export const value = 3;\n');const next=await core.trigger({repo:repo.root,target:'main',sessionId:'dev'});assert.equal(next.complete,true);assert.equal(adapter.calls.length,2);assert.ok(next.understanding.files.find(f=>f.path==='other.js').carriedFrom);
      const base=repo.commit({'code.js':'export const value = 3;\n','other.js':'export const other = 1;\n'});repo.ref('main',base);repo.ref('feature',base);fs.writeFileSync(path.join(repo.root,'code.js'),'export const value = 4;\n');if(!withIndex)writeIndex(repo,[]);
      const normal=await core.trigger({repo:repo.root,target:'main',sessionId:'dev',captureOnly:true});assert.equal(normal.status,'pending');assert.equal(core.store.snapshot(key,normal.snapshotId).range.kind,'merge-base-worktree');assert.equal(core.store.snapshot(key,normal.snapshotId).range.headSha,base);
    }
  });
  await test('empty unborn repositories have a friendly empty state; SHA-256 unborn repositories freeze without materializing a tree object',async dir=>{
    for(const format of ['sha1','sha256']){
      const repo=repository(path.join(dir,format),{format});fs.unlinkSync(path.join(repo.root,'.git/index'));const adapter=new SyntheticAdapter(),core=await new ReviewCore({storageRoot:path.join(dir,format+'-state'),adapter}).initialize(),before=treeDigest(repo.root);
      const empty=await core.trigger({repo:repo.root,captureOnly:true});assert.deepEqual(empty,{status:'incomplete',code:'empty-worktree',reason:EMPTY_WORKTREE_MESSAGE});assert.equal(adapter.calls.length,0);assert.deepEqual(treeDigest(repo.root),before);
      const output=path.join(dir,format+'-empty-bundle');assert.equal(prepare({repo:repo.root,out:output}).code,'empty-worktree');assert.equal(fs.existsSync(output),false);
      repo.worktree({'example.js':'export const example = 1;\n'});const withFile=prepare({repo:repo.root,out:path.join(dir,format+'-bundle')});assert.equal(withFile.status,'complete');const data=loadBundle(withFile.bundle);assert.equal(data.snapshot.range.headSha,null);assert.equal(data.snapshot.range.baseSha.length,format==='sha1'?40:64);assert.equal(data.files.get('example.js').change,'added');
    }
  });
  await test('missing HEAD objects are rejected instead of being mistaken for a new repository',async dir=>{
    const repo=repository(path.join(dir,'repo'));repo.ref('feature','f'.repeat(40));repo.worktree({'example.js':'export const example = 1;\n'});assert.throws(()=>rangeOf(createGit(repo.root)),e=>e.code==='head-unavailable');
  });

  await test('single-file coverage stays partial; subsequent file review accumulates coverage', async dir => {
    const t = await setup(dir), b = bundle(dir, t.repo, 'bundle');
    const a = await t.core.requestBundle({ projectKey: t.key, deliveryId: t.delivery.deliveryId, bundle: b, scope: 'file:code.js' });
    assert.equal(a.status, 'partial'); assert.equal(a.complete, false); assert.deepEqual(a.coverage.reviewed, ['code.js']); assert(a.understanding.alignment.every(r => r.status === 'unclear'));
    const second = await t.core.reviewCurrent(t.key, t.delivery.deliveryId, { scope: 'file:other.js' });
    assert.equal(second.complete, true); assert.equal(second.findings.length, 1); assert.equal(second.understanding.files.find(f => f.path === 'code.js').carriedFrom.runId, a.runId);
  });
  await test('same-input successful replay deduplicates; force all really calls model', async dir => {
    const t = await setup(dir), b = bundle(dir, t.repo, 'bundle');
    const a = await t.core.requestBundle({ projectKey: t.key, deliveryId: t.delivery.deliveryId, bundle: b });
    const same = await t.core.requestBundle({ projectKey: t.key, deliveryId: t.delivery.deliveryId, bundle: b, trigger: 'auto' });
    assert.equal(a.runId, same.runId); assert.equal(t.adapter.calls.length, 1); assert.equal(t.core.store.delivery(t.key, t.delivery.deliveryId).snapshotIds.length, 1);
    await t.core.reviewCurrent(t.key, t.delivery.deliveryId, { force: true }); assert.equal(t.adapter.calls.length, 2);
  });
  await test('A success, B running, return A cancels B before copy; source deletion cannot break result/Mark/export', async dir => {
    const started = deferred(), aborted = deferred(), release = deferred(); let bInput;
    const t = await setup(dir, { model: async (req, { signal }) => { if (req.snapshot.inputSha === bInput) { started.resolve(); signal.addEventListener('abort', () => aborted.resolve(), { once: true }); await release.promise; } return syntheticModel(req); } });
    const aBundle = bundle(dir, t.repo, 'a'), a = await t.core.requestBundle({ projectKey: t.key, deliveryId: t.delivery.deliveryId, bundle: aBundle });
    await t.core.mark(t.key, { snapshotId: a.snapshotId, findingId: a.findings[0].findingId, suppressed: true });
    await t.core.annotate(t.key, { snapshotId: a.snapshotId, findingId: a.findings[0].findingId, text: '不会沿用的批注' });
    fs.writeFileSync(path.join(t.repo.root, 'code.js'), 'export function value() {\n  return 3;\n}\n');
    const bBundle = bundle(dir, t.repo, 'b'); bInput = JSON.parse(fs.readFileSync(path.join(bBundle, 'snapshot.json'))).inputSha;
    const b = t.core.requestBundle({ projectKey: t.key, deliveryId: t.delivery.deliveryId, bundle: bBundle }); await started.promise;
    const back = t.core.requestBundle({ projectKey: t.key, deliveryId: t.delivery.deliveryId, bundle: aBundle }); await aborted.promise;
    assert.equal(t.core.store.delivery(t.key, t.delivery.deliveryId).current.inputSha, a.inputSha); release.resolve();
    assert.equal((await b).status, 'cancelled'); const current = await back;
    assert.equal(current.complete, true); assert.notEqual(current.runId, a.runId); assert.equal(current.carriedFrom.runId, a.runId); assert.equal(t.adapter.calls.length, 2);
    assert.equal(t.core.store.annotations(t.key, current.snapshotId).length, 0); assert.equal(t.core.store.marks(t.key, current.snapshotId)[0].suppressed, true);
    await t.core.deleteSnapshot(t.key, a.snapshotId);
    assert(markdown(t.core.selected(t.key, current.snapshotId)).includes('已标记为非问题'));
    assert(html(t.core.selected(t.key, current.snapshotId)).includes('evidentloop-data'));
  });
  await test('B/C changes during cancellation wait bind final generation C and suppress stale writeback', async dir => {
    const began = deferred(), abort = deferred(), release = deferred(); let blocked;
    const t = await setup(dir, { model: async (req, { signal }) => { if (req.snapshot.inputSha === blocked) { began.resolve(); signal.addEventListener('abort', () => abort.resolve(), { once: true }); await release.promise; } return syntheticModel(req); } });
    const a = bundle(dir, t.repo, 'a'); blocked = JSON.parse(fs.readFileSync(path.join(a, 'snapshot.json'))).inputSha;
    const first = t.core.requestBundle({ projectKey: t.key, deliveryId: t.delivery.deliveryId, bundle: a }); await began.promise;
    fs.writeFileSync(path.join(t.repo.root, 'code.js'), 'export const value = 3;\n'); const b = bundle(dir, t.repo, 'b');
    const second = t.core.requestBundle({ projectKey: t.key, deliveryId: t.delivery.deliveryId, bundle: b }); await abort.promise;
    fs.writeFileSync(path.join(t.repo.root, 'code.js'), 'export const value = 4;\n'); const c = bundle(dir, t.repo, 'c');
    const last = t.core.requestBundle({ projectKey: t.key, deliveryId: t.delivery.deliveryId, bundle: c });
    const expected = JSON.parse(fs.readFileSync(path.join(c, 'snapshot.json'))).inputSha;
    await until(() => t.core.store.delivery(t.key, t.delivery.deliveryId).current.inputSha === expected);
    release.resolve(); const results = await Promise.all([first, second, last]);
    assert.equal(results[0].status, 'cancelled'); assert.equal(results[1].runId, results[2].runId); assert.equal(results[2].inputSha, expected);
    const d = t.core.store.delivery(t.key, t.delivery.deliveryId); assert.equal(d.latestResultRunId, results[2].runId); assert.equal(d.current.generation, 3); assert.equal(t.adapter.calls.length, 2);
  });
  await test('project serial queue merges another delivery file scopes without cancelling or deduplicating across deliveries', async dir => {
    const began = deferred(), release = deferred(); let first = true; let active = 0, peak = 0;
    const t = await setup(dir, { model: async req => { active++; peak = Math.max(peak, active); if (first) { first = false; began.resolve(); await release.promise; } const m = syntheticModel(req); active--; return m; } });
    const b = bundle(dir, t.repo, 'bundle');
    const d2 = (await t.core.deliveries.observe(t.project, { branch: 'second', targetBranch: 'main', headSha: t.repo.base, baseSha: t.repo.base, targetSha: t.repo.base, reachable: async () => false })).delivery;
    const a = t.core.requestBundle({ projectKey: t.key, deliveryId: t.delivery.deliveryId, bundle: b }); await began.promise;
    const one = t.core.requestBundle({ projectKey: t.key, deliveryId: d2.deliveryId, bundle: b, scope: 'file:code.js' });
    const two = t.core.requestBundle({ projectKey: t.key, deliveryId: d2.deliveryId, bundle: b, scope: 'file:other.js' });
    await until(() => t.core.scheduler.state(t.key).pending.get(d2.deliveryId)?.paths.size === 2); release.resolve();
    const [r1, r2, r3] = await Promise.all([a, one, two]); assert.equal(peak, 1); assert.equal(r2.runId, r3.runId); assert.notEqual(r1.runId, r2.runId); assert.equal(t.adapter.calls.length, 2); assert.equal(r2.complete, true);
    await t.core.mark(t.key, { snapshotId: r1.snapshotId, findingId: r1.findings[0].findingId, suppressed: true }); assert.equal(t.core.store.marks(t.key, r2.snapshotId).length, 0);
    const again = await t.core.reviewCurrent(t.key, t.delivery.deliveryId); assert.equal(again.runId, r1.runId); assert.equal(t.adapter.calls.length, 2);
  });
  await test('incremental copies unchanged files and marks; requirement order and method versions invalidate reuse', async dir => {
    const t = await setup(dir), a = bundle(dir, t.repo, 'a'); const first = await t.core.requestBundle({ projectKey: t.key, deliveryId: t.delivery.deliveryId, bundle: a });
    fs.writeFileSync(path.join(t.repo.root, 'other.js'), 'export const other = 3;\n'); const b = bundle(dir, t.repo, 'b');
    const second = await t.core.requestBundle({ projectKey: t.key, deliveryId: t.delivery.deliveryId, bundle: b });
    assert.deepEqual(t.adapter.calls.at(-1).scope, ['other.js']); assert.equal(second.findings[0].carriedFrom.findingId, first.findings[0].findingId); assert.equal(second.complete, true);
    const c = bundle(dir, t.repo, 'c', { requirements: [{ kind: 'paste', order: 1, text: '试验需求：保持值和边界。' }] });
    await t.core.requestBundle({ projectKey: t.key, deliveryId: t.delivery.deliveryId, bundle: c }); assert.equal(t.adapter.calls.at(-1).scope.length, 2);
  });
  await test('withheld evidence and incomplete snapshots never say no issues', async dir => {
    const t = await setup(dir, { model: req => { const m = syntheticModel(req); m.findings[0].evidence[0].quote = 'wrong'; return m; } });
    const b = bundle(dir, t.repo, 'b'), run = await t.core.requestBundle({ projectKey: t.key, deliveryId: t.delivery.deliveryId, bundle: b });
    assert.equal(run.complete, false); assert.equal(run.findings.length, 0); assert(!reviewStatus(t.core.store.snapshot(t.key, run.snapshotId), run).includes('未发现问题'));
    const s = t.core.store.snapshot(t.key, run.snapshotId); s.status = 'incomplete'; assert(!reviewStatus(s, { ...run, complete: true, coverage: { ...run.coverage, withheld: [] } }).includes('未发现问题'));
  });
  await test('missing or changed method/extension fails before model and injected byte manifest matches', async dir => {
    const method = path.join(dir, 'method'); fs.cpSync(METHOD_ROOT, method, { recursive: true });
    const t = await setup(dir, { methodRoot: method }); const b = bundle(dir, t.repo, 'bundle', { methodRoot: method, extension: '关注边界\r\n' });
    const first = await t.core.requestBundle({ projectKey: t.key, deliveryId: t.delivery.deliveryId, bundle: b }); assert.equal(first.injectedModules.length, 10);
    assert.equal(first.injectedModules.at(-1).path, 'bundle/extension.md');
    fs.unlinkSync(path.join(method, 'references/findings.md'));
    const failed = await t.core.reviewCurrent(t.key, t.delivery.deliveryId, { force: true }); assert.equal(failed.status, 'failed'); assert.equal(t.adapter.calls.length, 1);
    fs.copyFileSync(path.join(METHOD_ROOT, 'references/findings.md'), path.join(method, 'references/findings.md'));
    fs.appendFileSync(path.join(method, 'references/findings.md'), '\nnew method\n'); assert.notEqual(methodVersion(method).promptVersion, first.promptVersion);
    const next = bundle(dir, t.repo, 'new-method', { methodRoot: method }); await t.core.requestBundle({ projectKey: t.key, deliveryId: t.delivery.deliveryId, bundle: next }); assert.equal(t.adapter.calls.at(-1).scope.length, 2);
  });
  await test('append-tail recovery, interrupted runs, settings and pinned/archive close-once rules', async dir => {
    const t = await setup(dir), b = bundle(dir, t.repo, 'bundle'), run = await t.core.requestBundle({ projectKey: t.key, deliveryId: t.delivery.deliveryId, bundle: b });
    await t.core.store.setSettings(t.key, { autoMode: true, targetBranch: 'main', extensionPrompt: '', exportEmbedDiff: true });
    await t.core.mark(t.key, { snapshotId: run.snapshotId, findingId: run.findings[0].findingId, suppressed: true });
    const marks = t.core.store.location(t.key, 'marks.jsonl'); fs.appendFileSync(marks, '{"incomplete":');
    await t.core.store.putRun(t.key, { ...run, runId: 'interrupted-run', status: 'running' });
    const reopened = await new ReviewCore({ storageRoot: t.core.store.root, adapter: t.adapter }).initialize();
    assert.equal(reopened.store.marks(t.key, run.snapshotId).length, 1); assert.equal(reopened.store.runs(t.key).find(r => r.runId === 'interrupted-run').errorCode, 'interrupted'); assert.equal(reopened.store.settings(t.key).autoMode, true);
    await reopened.store.pin(t.key, t.delivery.deliveryId, true); await reopened.store.archive(t.key, t.delivery.deliveryId, true);
    assert(!reopened.store.delivery(t.key, t.delivery.deliveryId).pinnedAt); await assert.rejects(() => reopened.store.pin(t.key, t.delivery.deliveryId, true));
    await reopened.store.archive(t.key, t.delivery.deliveryId, false); assert(!reopened.store.delivery(t.key, t.delivery.deliveryId).archivedAt);
  });
  await test('delete running snapshot waits cancellation and drops every late record; last snapshot deletes delivery', async dir => {
    const began = deferred(), cancelled = deferred(), release = deferred();
    const t = await setup(dir, { model: async (req, { signal }) => { began.resolve(); signal.addEventListener('abort', () => cancelled.resolve(), { once: true }); await release.promise; return syntheticModel(req); } });
    const b = bundle(dir, t.repo, 'bundle'), pending = t.core.requestBundle({ projectKey: t.key, deliveryId: t.delivery.deliveryId, bundle: b }); await began.promise;
    const snapshotId = t.core.store.delivery(t.key, t.delivery.deliveryId).current.snapshotId;
    const deleted = t.core.deleteSnapshot(t.key, snapshotId); await cancelled.promise; assert(t.core.store.snapshot(t.key, snapshotId)); release.resolve(); await Promise.all([pending, deleted]);
    assert.equal(t.core.store.snapshot(t.key, snapshotId), null); assert.equal(t.core.store.delivery(t.key, t.delivery.deliveryId), null); assert.equal(t.core.store.runs(t.key).length, 0);
  });
  await test('delete a historical snapshot updates latest/current pointers and cascades its notes/marks/runs', async dir => {
    const t = await setup(dir), b = bundle(dir, t.repo, 'bundle'), a = await t.core.requestBundle({ projectKey: t.key, deliveryId: t.delivery.deliveryId, bundle: b });
    const c = await t.core.requestBundle({ projectKey: t.key, deliveryId: t.delivery.deliveryId, bundle: b });
    await t.core.deleteSnapshot(t.key, c.snapshotId); const d = t.core.store.delivery(t.key, t.delivery.deliveryId);
    assert.equal(d.latestSnapshotId, a.snapshotId); assert.equal(d.current.snapshotId, a.snapshotId); assert(!t.core.store.runs(t.key).some(r => r.snapshotId === c.snapshotId));
    const reopened = await new ReviewCore({ storageRoot: t.core.store.root, adapter: t.adapter }).initialize(); assert(markdown(reopened.selected(t.key, a.snapshotId)).includes('文件清单'));
    await t.core.deleteDelivery(t.key, t.delivery.deliveryId); assert.equal(t.core.store.runs(t.key).length, 0); assert.equal(t.core.store.marks(t.key, a.snapshotId).length, 0);
  });
  await test('annotation host validation, update identity, no review invalidation and history readonly', async dir => {
    const t = await setup(dir), b = bundle(dir, t.repo, 'bundle'), run = await t.core.requestBundle({ projectKey: t.key, deliveryId: t.delivery.deliveryId, bundle: b });
    const current = structuredClone(t.core.store.delivery(t.key, t.delivery.deliveryId).current), finding = run.findings[0];
    const note = await t.core.annotate(t.key, { snapshotId: run.snapshotId, findingId: finding.findingId, text: '😀意见\r\n第二行' });
    assert.equal(note.text, '😀意见\n第二行'); await t.core.annotate(t.key, { snapshotId: run.snapshotId, findingId: finding.findingId, annotationId: note.annotationId, text: '更新' }); assert.equal(t.core.store.annotations(t.key, run.snapshotId).length, 1);
    await assert.rejects(() => t.core.annotate(t.key, { snapshotId: run.snapshotId, findingId: finding.findingId, text: ' ' }));
    await assert.rejects(() => t.core.annotate(t.key, { snapshotId: run.snapshotId, findingId: finding.findingId, text: '😀'.repeat(2001) }));
    await assert.rejects(() => t.core.annotate(t.key, { snapshotId: run.snapshotId, anchor: { path: 'code.js', side: 'head', startLine: 1, endLine: 1, sha256: '0'.repeat(64) }, text: 'bad' }));
    assert.deepEqual(t.core.store.delivery(t.key, t.delivery.deliveryId).current, current); assert.equal(t.adapter.calls.length, 1);
    await t.core.requestBundle({ projectKey: t.key, deliveryId: t.delivery.deliveryId, bundle: b }); await assert.rejects(() => t.core.annotate(t.key, { snapshotId: run.snapshotId, findingId: finding.findingId, text: 'old' }));
  });
}
