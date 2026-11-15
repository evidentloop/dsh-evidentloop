import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { repository } from './repo-fixture.mjs';
import { prepare, projectFor, ReviewCore, SyntheticAdapter } from '../index.mjs';
import { modelFor } from '../fixtures/model.mjs';
export const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
export async function until(predicate, message = 'condition') {
  const limit = Date.now() + 5000;
  while (!predicate()) { if (Date.now() > limit) throw Error('Timed out: ' + message); await new Promise(r => setImmediate(r)); }
}
export function treeDigest(root) {
  const result = {};
  if (!fs.existsSync(root)) return result;
  const visit = (file, rel) => {
    const s = fs.lstatSync(file);
    result[rel] = { mode: s.mode, mtime: s.mtimeMs, ctime: s.ctimeMs, ino: s.ino, dev: s.dev, size: s.size, bytes: s.isSymbolicLink() ? fs.readlinkSync(file) : s.isFile() ? crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex') : null };
    if (s.isDirectory() && !s.isSymbolicLink()) for (const n of fs.readdirSync(file).sort()) visit(path.join(file, n), rel + '/' + n);
  }; visit(root, '.'); return result;
}
export function fixture(root, name = 'repo') {
  const repo = repository(path.join(root, name));
  const baseFiles = { 'code.js': 'export function value() {\n  return 1;\n}\n', 'other.js': 'export const other = 1;\n' };
  const base = repo.commit(baseFiles, [], 'baseline'); repo.ref('main', base); repo.ref('feature', base);
  repo.worktree({ ...baseFiles, 'code.js': 'export function value() {\n  return 2;\n}\n', 'other.js': 'export const other = 2;\n' });
  return { ...repo, baseFiles, base };
}
export function bundle(root, repo, name, options = {}) {
  const out = path.join(root, name); const result = prepare({ repo: repo.root, out, target: 'main', requirements: [{ order: 0, kind: 'paste', text: '试验需求：保持值和边界。' }], ...options });
  if (result.status !== 'complete') throw Error(JSON.stringify(result)); return out;
}
export function syntheticModel(request) {
  const model = modelFor(request.bundleRoot);
  model.findings = model.findings.filter(f => request.reviewPaths.includes(request.snapshot.files.find(x => x.path === f.anchor.path || x.oldPath === f.anchor.path)?.path));
  return model;
}
export async function setup(root, { model = syntheticModel, repo = fixture(root), methodRoot } = {}) {
  const project = projectFor(repo.root), adapter = new SyntheticAdapter({ model, sessions: [{ id: 'dev', title: '开发会话', kind: 'development', projectKey: project.projectKey }] });
  const core = await new ReviewCore({ storageRoot: path.join(root, 'state'), adapter, methodRoot }).initialize();
  const observation = await core.deliveries.observe(project, { branch: 'feature', targetBranch: 'main', session: await adapter.session('dev'), requirements: [], headSha: repo.base, baseSha: repo.base, targetSha: repo.base, reachable: async () => false });
  return { core, adapter, project, repo, delivery: observation.delivery, key: project.projectKey };
}
