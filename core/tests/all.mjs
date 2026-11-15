import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import crypto from 'node:crypto';
const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const output = process.argv[2] ? path.resolve(process.argv[2]) : path.join(repo, 'core/evidence/run-' + Date.now());
if (fs.existsSync(output)) throw Error('Refusing to overwrite test evidence'); fs.mkdirSync(output, { recursive: true });
const manifest = () => {
  const result = {}; const visit = folder => { for (const e of fs.readdirSync(folder, { withFileTypes: true })) { if (e.name === 'evidence') continue; const p = path.join(folder, e.name); if (e.isDirectory()) visit(p); else if (p.endsWith('.mjs')) result[path.relative(repo, p)] = crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex'); } }; visit(path.join(repo, 'core')); return result;
};
const before = manifest();
const jobs = [['q1-q2', 'core/tests/q1-q2.mjs'], ['core', 'core/tests/run.mjs']];
const results = await Promise.all(jobs.map(([name, file]) => new Promise(resolve => {
  const args = [file, path.join(output, name)], log = fs.createWriteStream(path.join(output, name + '.log'));
  const child = spawn(process.execPath, args, { cwd: repo, stdio: ['ignore', 'pipe', 'pipe'] });
  child.stdout.pipe(log, { end: false }); child.stderr.pipe(log, { end: false });
  child.once('error', error => { log.end(); resolve({ name, command: [process.execPath, ...args], exitCode: 1, error: error.message }); });
  child.once('exit', (code, signal) => { log.end(); resolve({ name, command: [process.execPath, ...args], exitCode: code ?? 1, signal }); });
})));
const after = manifest(), stable = JSON.stringify(before) === JSON.stringify(after);
const q1 = JSON.parse(fs.readFileSync(path.join(output, 'q1-q2/test-results.json'))), core = JSON.parse(fs.readFileSync(path.join(output, 'core/results.json')));
const summary = { node: process.version, stages: results, inheritedCases: q1.passed.length, inheritedFailures: q1.failures.length, coreCases: core.results.length, coreFailures: core.failures.length,
  namedCases: q1.passed.length + core.results.length, sourceStableDuringRun: stable, sourceBefore: before, sourceAfter: after, realModelCalls: 0, dshIntegration: false,
  exitCode: results.some(r => r.exitCode !== 0) || !stable ? 1 : 0 };
fs.writeFileSync(path.join(output, 'summary.json'), JSON.stringify(summary, null, 2) + '\n');
console.log(JSON.stringify({ output, node: summary.node, namedCases: summary.namedCases, coreCases: summary.coreCases, failures: summary.coreFailures + summary.inheritedFailures, sourceStable: stable, exitCode: summary.exitCode }));
process.exitCode = summary.exitCode;
