/** Disposable React + actual host/core integration fixture. Not part of the installed package. */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { installed } from '../scripts/toolchain.mjs';
import { browserEntry } from './browser-entry.mjs';
import { repository } from '../../core/tests/repo-fixture.mjs';
import { SyntheticAdapter, projectFor, loadBundle } from '../../core/index.mjs';
import { modelFor } from '../../core/fixtures/model.mjs';
import { fakeHost } from './fakes.mjs';
import { PluginService } from '../host/service.ts';
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..'), out = path.resolve(process.argv[2]); fs.mkdirSync(out, { recursive: true });
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'evidentloop-browser-fixture-')), repo = repository(path.join(scratch, 'repo'));
process.once('exit',()=>{try{fs.rmSync(scratch,{recursive:true,force:true})}catch{}});
const before = Array.from({ length: 90 }, (_, i) => 'export const value' + (i + 1) + ' = ' + (i + 1) + ';').join('\n') + '\n';
const after = before.replace('value2 = 2;', 'value2 = 200;'); const base = repo.commit({ 'src/code.js': before, 'src/other.js': 'export const other = 1;\n' }, [], 'Fixture baseline'); repo.ref('main', base); fs.mkdirSync(path.join(repo.root, '.git/refs/heads/feature'), { recursive: true }); repo.ref('feature/' + 'evidence-review-'.repeat(12), base); fs.writeFileSync(path.join(repo.root,'.git/HEAD'),'ref: refs/heads/feature/'+'evidence-review-'.repeat(12)+'\n'); repo.worktree({ 'src/code.js': after, 'src/other.js': 'export const other = 2;\n', ...(process.env.PLUGIN_FIXTURE_ADDED_FILE === '1' ? { 'src/added.js': '// 中文注释与 Latin\nexport const added = 1;\n' } : {}) });
const host = fakeHost({ repo }), key = projectFor(repo.root).projectKey;
const service = await new PluginService(host.ctx, { storageRoot: path.join(scratch, 'state'), methodRoot: path.join(repoRoot, 'skills/evidentloop-review'), assetRoot: path.join(repoRoot, 'plugin/dist') }).initialize();
await service.core.store.setSettings(key, { ...service.core.store.settings(key), targetBranch: 'main' });
const adapter = new SyntheticAdapter({ sessions: [{ id: 'dev', kind: 'development', projectKey: key, title: 'Fixture development session' }], model: request => {
  const model = modelFor(request.bundleRoot), source = model.findings[0], data = loadBundle(request.bundleRoot), head = data.texts.get('head:src/code.js'), old = data.texts.get('base:src/code.js');
  const make = (title, side = 'head', line = 2, suggestion = 'both') => { const row = structuredClone(source); row.title = title; row.anchor = { path: 'src/code.js', side, line }; const start = 2, end = line === null ? 2 : Math.max(2, line); row.evidence = [{ path: 'src/code.js', side, startLine: start, endLine: end, quote: (side === 'head' ? head : old).lines.slice(start - 1, end).join('\n') }]; if (suggestion === 'none') delete row.suggestion; else if (suggestion === 'text') row.suggestion = { text: '仅文字建议：保留必要约束，不删除解释。' }; else row.suggestion = { text: '建议说明：保持输入边界，代码只是示例。', code: 'export const value2 = 200;\n' + 'x'.repeat(800) }; return row; };
  model.findings = [make('合成：说明与代码建议'), make('合成：仅文字建议', 'head', 2, 'text'), make('合成：无建议', 'head', 2, 'none'), make('合成：旧侧定位', 'base', 2), make('合成：文件级问题', 'head', null), make('合成：超出Diff片段', 'head', 70), make('矩阵：文件级-仅文字', 'head', null, 'text'), make('矩阵：文件级-无建议', 'head', null, 'none'), make('矩阵：超出片段-仅文字', 'head', 70, 'text'), make('矩阵：超出片段-无建议', 'head', 70, 'none')];
  model.impacts.push({kind:'behavior',text:'合成坏引用条目，应被扣下',refs:[{path:'src/code.js',side:'head',startLine:99999,endLine:100000}]});
  model.findings[2].severity = 'P2'; model.findings[2].title += ' <img src=x onerror="window.__XSS__=true">'; return model;
} });
service.core.adapter = adapter;
const run = await service.core.trigger({ repo: repo.root, target: 'main', sessionId: 'dev' }); if (!['succeeded','partial'].includes(run.status) || run.findings.length !== 10 || !run.coverage.withheld.length) throw Error('Invalid browser fixture: ' + JSON.stringify(run));
await service.core.annotate(key, { snapshotId: run.snapshotId, anchor: { path: 'src/code.js', side: 'head', startLine: 2, endLine: 2, sha256: service.core.store.snapshot(key, run.snapshotId).files.find(f => f.path === 'src/code.js').headSha256 }, text: '合成测试中的人工行批注' });
await service.core.annotate(key, { snapshotId: run.snapshotId, anchor: { path: 'src/code.js', side: 'head', startLine: null, endLine: null, sha256: service.core.store.snapshot(key, run.snapshotId).files.find(f => f.path === 'src/code.js').headSha256 }, text: '合成测试中的人工文件批注' });
fs.writeFileSync(path.join(out, 'fixture.json'), JSON.stringify({ runId: run.runId, deliveryId: run.deliveryId, snapshotId: run.snapshotId, projectKey: key, findings: run.findings.length, complete: run.complete, synthetic: true, realModelCalls: 0 }, null, 2));
if(process.env.PLUGIN_FIXTURE_VALIDATE_ONLY==='1'){console.log(JSON.stringify({fixtureValidated:true,status:run.status,findings:run.findings.length,withheld:run.coverage.withheld.length,complete:run.complete,realModelCalls:0}));await service.close();process.exit(0)}
const rt = installed('react', process.env.REACT_PACKAGE), dom = path.dirname(rt.require.resolve('react-dom/package.json')), esbuild = installed('esbuild').require('esbuild');
const harness = browserEntry(repoRoot);
fs.writeFileSync(path.join(out, 'fixture-entry.jsx'), harness);
await esbuild.build({ absWorkingDir: repoRoot, stdin: { contents: harness, resolveDir: repoRoot, sourcefile: 'fixture-entry.jsx', loader: 'jsx' }, bundle: true, platform: 'browser', format: 'esm', alias: { react: rt.root, 'react-dom': dom }, outfile: path.join(out, 'fixture-client.js'), logLevel: 'silent' });
const server = http.createServer(async (req, res) => {
  try {
    if (req.url === '/favicon.ico') { res.writeHead(204); res.end(); return; }
    if (req.url === '/') { res.setHeader('content-type', 'text/html'); res.end('<!doctype html><meta charset="utf-8"><title>P4合成浏览器测试（0真实模型）</title><link rel="stylesheet" href="/style.css"><style>html,body,#app{height:100%;margin:0}body{overflow:hidden}</style><div id="app"></div><script type="module" src="/fixture-client.js"></script>'); return; }
    if (req.url === '/fixture-client.js') { res.setHeader('content-type', 'application/javascript'); res.end(fs.readFileSync(path.join(out, 'fixture-client.js'))); return; }
    if (req.url === '/style.css') { res.setHeader('content-type', 'text/css'); res.end(fs.readFileSync(path.join(repoRoot, 'plugin/client/styles.css'))); return; }
    const url = new URL(req.url, 'http://fixture.invalid'), route = host.routes.get(url.pathname); if (!route) { res.statusCode = 404; res.end('Fixture route not found'); return; }
    const chunks = []; for await (const c of req) chunks.push(c); const body = Buffer.concat(chunks); const request = new Request(url, { method: req.method, headers: req.headers, ...(!['GET', 'HEAD'].includes(req.method) ? { body } : {}) });
    const response = await route.fetch(request); res.writeHead(response.status, Object.fromEntries(response.headers)); res.end(Buffer.from(await response.arrayBuffer()));
  } catch (error) { res.statusCode = 500; res.end(error.stack); }
});
server.listen(0, '127.0.0.1', () => { const value = { pid: process.pid, url: 'http://127.0.0.1:' + server.address().port + '/', synthetic: true, realModelCalls: 0 }; fs.writeFileSync(path.join(out, 'server.json'), JSON.stringify(value, null, 2)); console.log(JSON.stringify(value)); });
const close = () => { server.close(async () => { await service.close(); fs.rmSync(scratch, { recursive: true, force: true }); process.exit(0); }); };
process.on('SIGTERM', close); process.on('SIGINT', close);
