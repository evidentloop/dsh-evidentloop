/** Mutation evidence in disposable copies only. Never edits delivery sources. */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..'), output = path.resolve(process.argv[2]);
if (fs.existsSync(output)) throw Error('Refusing to overwrite mutation evidence'); fs.mkdirSync(output, { recursive: true });
const mutations = [
  { name: 'budget-bypass', file: 'plugin/host/dsh-adapter.mjs', old: '    this.approval(); signal.throwIfAborted();', replacement: '    this.allowed = () => ({maxCalls:100,maxOutputTokens:4096}); this.claim = () => ({}); signal.throwIfAborted();', expected: 'no model approval means zero native agents or prompts' },
  { name: 'tools-exposed', file: 'plugin/host/dsh-adapter.mjs', old: 'agentCtx.tools.restrict({ allow: [] })', replacement: "agentCtx.tools.restrict({ allow: ['write'] })", expected: 'native review uses frozen cwd, inherited model, zero tools and canonical prompt' },
  { name: 'stale-composer-overwrite', file: 'plugin/client/native.js', old: "state.draftRev !== payload.expectedRevision || state.phase !== 'plain'", replacement: "state.phase !== 'plain'", expected: 'stale composer revision never overwrites existing user draft' },
  { name: 'live-file-substitution', file: 'plugin/host/service.mjs', old: 'head: head?.text ?? null', replacement: "head: fs.readFileSync(path.join(p.repoRoot, file.path), 'utf8')", expected: 'frozen file route stays frozen when live worktree changes' },
  { name: 'unsafe-title-html', file: 'plugin/client/list.jsx', old: '<Clip>{d.title}</Clip>', replacement: '<span dangerouslySetInnerHTML={{__html:d.title}}/>', expected: 'React component renders real props and escapes user controlled titles' }
];
const results = [];
for (const m of mutations) {
  const copy = fs.mkdtempSync(path.join(os.tmpdir(), 'evidentloop-plugin-fault-'));
  try {
    for (const name of ['core', 'plugin', 'skills']) fs.cpSync(path.join(root, name), path.join(copy, name), { recursive: true, filter: file => path.basename(file) !== 'evidence' });
    const file = path.join(copy, m.file), source = fs.readFileSync(file, 'utf8'); assert.ok(source.includes(m.old), 'Fault injection no longer matches: ' + m.name); fs.writeFileSync(file, source.replace(m.old, m.replacement));
    const destination = path.join(output, m.name), process = spawnSync(globalThis.process.execPath, [path.join(copy, 'plugin/tests/run.mjs'), destination], { encoding: 'utf8', timeout: 45000 });
    fs.writeFileSync(path.join(output, m.name + '.log'), process.stdout + process.stderr);
    const report = JSON.parse(fs.readFileSync(path.join(destination, 'results.json'))), target = report.failures.find(f => f.name === m.expected);
    assert.equal(process.status, 1, 'Fault did not make tests fail'); assert.ok(target, 'Expected target check did not detect fault: ' + m.name);
    assert.ok(!/SyntaxError|Cannot find|ERR_MODULE_NOT_FOUND/.test(target.error), 'Infrastructure failure is not a mutation detection');
    results.push({ fault: m.name, file: m.file, changedFrom: m.old, changedTo: m.replacement, exitCode: process.status, caughtBy: m.expected, targetFailure: target.error, detected: true });
  } finally { fs.rmSync(copy, { recursive: true, force: true }); }
}
fs.writeFileSync(path.join(output, 'summary.json'), JSON.stringify({ results, faultsDetected: results.length, injectedOnlyInTemporaryCopies: true }, null, 2) + '\n');
console.log(JSON.stringify({ output, faultsDetected: results.length, exitCode: 0 }));
