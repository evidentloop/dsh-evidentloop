import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { ReviewCore, SyntheticAdapter, projectFor, markdown, html, loadBundle } from '../index.mjs';
import { createGit } from '../lib/git.mjs';
import { treeDigest } from './helpers.mjs';
const repo = fs.realpathSync(process.argv[2] || '.'), output = path.resolve(process.argv[3]);
if (!process.argv[3] || fs.existsSync(output)) throw Error('Pass a new external dogfood directory'); fs.mkdirSync(output, { recursive: true });
const git = createGit(repo), project = projectFor(git.root), before = treeDigest(git.gitDir), groups = [
  ['core/lib/store', '实现私有存储和恢复'], ['core/lib/engine', '实现审查调度与写回保护'], ['core/lib/scheduler', '实现仓库串行调度'], ['core/lib/export', '生成离线变更报告'], ['core/lib/drafts', '生成锁定的发回草稿'], ['core/tests/', '增加核心库夹具'], ['core/', '承接核心库合同与适配接口'], ['prototype/', '记录既有原型变更'], ['skills/', '记录既有方法文件'], ['trial/', '记录既有准备器与质量试验'], ['p2-probe/', '记录既有宿主能力探针'], ['', '记录其余真实文件变化'] ];
function model(request) {
  const b = loadBundle(request.bundleRoot), byGroup = new Map(), refs = new Map();
  for (const name of b.targets) {
    const file = b.files.get(name), side = b.texts.has('head:' + name) ? 'head' : 'base', actual = side === 'base' ? file.oldPath || name : name, source = b.texts.get(side + ':' + actual);
    const changed = b.changed.get(name)[side === 'base' ? 'oldLines' : 'newLines'], line = [...changed][0] || 1;
    if (source?.lines.length) refs.set(name, { path: actual, side, startLine: line, endLine: line });
    const title = groups.find(([prefix]) => name.startsWith(prefix))[1]; if (!byGroup.has(title)) byGroup.set(title, []); byGroup.get(title).push(name);
  }
  const features = [...byGroup].map(([title, files], i) => ({ featureId: 'F' + i, title, purpose: `记录${files.length}个真实冻结文件`, approach: '按路径归组，逐文件引用冻结差异；这是合成适配器的合同验证，不是AI代码审查结论。', files, refs: files.map(n => refs.get(n)).filter(Boolean) })).filter(f => f.refs.length);
  return { schemaVersion: 1, inputSha: b.snapshot.inputSha, promptVersion: b.snapshot.promptVersion,
    overview: { purpose: '本仓真实diff的核心库dogfood（合成说明、未调用真实模型）；其中也包含本任务之前已存在的未提交内容，不能全部归因于本轮。', requirementStatus: 'no-requirement' },
    features, files: b.targets.map(name => ({ path: name, featureIds: features.filter(f => f.files.includes(name)).map(f => f.featureId), semantic: { status: refs.has(name) ? 'stated' : 'unclear', items: refs.has(name) ? [{ text: '此文件存在真实冻结差异；具体行为需后续真实模型或人工复核。', refs: [refs.get(name)] }] : [] } })), impacts: [], alignment: [], extras: [], findings: [] };
}
const adapter = new SyntheticAdapter({ model, sessions: [{ id: 'dogfood-development', kind: 'development', title: '核心库dogfood', projectKey: project.projectKey }] });
const core = await new ReviewCore({ storageRoot: path.join(output, 'state'), adapter }).initialize();
const run = await core.trigger({ repo: git.root, sessionId: 'dogfood-development', scope: 'incremental' });
if (!run.snapshotId) throw Error(JSON.stringify(run));
const selected = core.selected(project.projectKey, run.snapshotId);
const md = markdown(selected), report = html(selected, { embedDiff: true });
fs.writeFileSync(path.join(output, 'CHANGELOG.md'), md); fs.writeFileSync(path.join(output, 'review.html'), report);
const after = treeDigest(git.gitDir); if (JSON.stringify(before) !== JSON.stringify(after)) throw Error('Input Git metadata changed');
const sha = data => crypto.createHash('sha256').update(data).digest('hex');
const result = { repo: git.root, node: process.version, adapter: 'synthetic; not an actual AI review', realModelCalls: 0, status: run.status, complete: run.complete,
  deliveryId: run.deliveryId, snapshotId: run.snapshotId, runId: run.runId, inputSha: selected.snapshot.inputSha, promptVersion: selected.snapshot.promptVersion, rulesVersion: selected.snapshot.rulesVersion,
  files: selected.snapshot.files.length, targets: run.coverage.reviewed.length, metadataEntriesCompared: Object.keys(before).length, inputGitUnchanged: true,
  markdownSha256: sha(md), htmlSha256: sha(report), htmlBytes: Buffer.byteLength(report), withheld: run.coverage.withheld, command: [process.execPath, ...process.argv.slice(1)] };
fs.writeFileSync(path.join(output, 'git-before.json'), JSON.stringify(before, null, 2)); fs.writeFileSync(path.join(output, 'git-after.json'), JSON.stringify(after, null, 2)); fs.writeFileSync(path.join(output, 'result.json'), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result)); if (run.status !== 'succeeded') process.exitCode = 1;
