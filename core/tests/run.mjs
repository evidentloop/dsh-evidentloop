import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { runDomain } from './domain.mjs';
import { runGit } from './git-cases.mjs';
import { runDeliveries } from './delivery-cases.mjs';
import { runExportDrafts } from './export-drafts.mjs';
import { runEdges } from './edge-cases.mjs';
const output = path.resolve(process.argv[2] || 'core/evidence/domain'); fs.mkdirSync(output, { recursive: true });
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'evidentloop-core-')); const results = []; let index = 0;
const test = async (name, action) => {
  const dir = path.join(temp, String(++index)); fs.mkdirSync(dir);
  const artifact = path.join(output, 'case-' + index); fs.mkdirSync(artifact);
  try { await action(dir, artifact); results.push({ name, passed: true, evidence: 'case-' + index }); console.log('ok ' + index + ' - ' + name); }
  catch (error) { results.push({ name, passed: false, error: error.stack }); console.error('FAIL ' + index + ' - ' + name + ': ' + error.message); }
};
try { await runDomain(test, temp); await runGit(test); await runDeliveries(test); await runExportDrafts(test); await runEdges(test); }
finally { fs.writeFileSync(path.join(output, 'results.json'), JSON.stringify({ assertions: results.length, passed: results.filter(r => r.passed).length, failures: results.filter(r => !r.passed), results }, null, 2) + '\n'); fs.rmSync(temp, { recursive: true, force: true }); }
if (results.some(r => !r.passed)) process.exitCode = 1;
