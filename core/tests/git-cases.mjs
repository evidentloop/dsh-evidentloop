import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { prepare, loadBundle, ReviewCore, SyntheticAdapter } from '../index.mjs';
import { fixture, treeDigest, setup, bundle } from './helpers.mjs';
import { repository } from './repo-fixture.mjs';

export function writeIndex(repo, entries, extension = null) {
  const header = Buffer.alloc(12); header.write('DIRC'); header.writeUInt32BE(2, 4); header.writeUInt32BE(entries.length, 8);
  const rows = entries.sort((a, b) => a.name.localeCompare(b.name) || a.stage - b.stage).map(e => {
    const fixed = Buffer.alloc(62); fixed.writeUInt32BE(parseInt(e.mode || '100644', 8), 24); Buffer.from(e.oid, 'hex').copy(fixed, 40);
    fixed.writeUInt16BE((e.stage << 12) | Math.min(Buffer.byteLength(e.name), 4095), 60);
    const value = Buffer.concat([fixed, Buffer.from(e.name + '\0')]); return Buffer.concat([value, Buffer.alloc((8 - value.length % 8) % 8)]);
  });
  const body = Buffer.concat([header, ...rows, ...(extension ? [extension] : [])]);
  fs.writeFileSync(path.join(repo.root, '.git/index'), Buffer.concat([body, crypto.createHash('sha1').update(body).digest()]));
}
function capture(dir, repo, name, artifact, options = {}) {
  const before = treeDigest(path.join(repo.root, '.git'));
  const result = prepare({ repo: repo.root, target: 'main', out: path.join(dir, name), ...options });
  const after = treeDigest(path.join(repo.root, '.git')); assert.deepEqual(after, before);
  assert(result.commands.every(c => ['rev-parse', 'merge-base', 'ls-tree', 'ls-files', 'cat-file', 'diff-tree'].includes(c.command) && c.optionalLocks === 0 && c.lazyFetch === 0 && c.fsmonitor === false));
  if (artifact) {
    fs.writeFileSync(path.join(artifact, name + '-readonly.json'), JSON.stringify({ before, after, result }, null, 2));
    if (result.status === 'complete') fs.copyFileSync(path.join(result.bundle, 'snapshot.json'), path.join(artifact, name + '-snapshot.json'));
  }
  return result;
}
export async function runGit(test) {
  await test('Git: untracked/deleted/binary/oversize/symlink/sensitive/metadata preserve index refs objects lfs', async (dir, artifact) => {
    const r = fixture(dir); fs.unlinkSync(path.join(r.root, 'other.js')); fs.writeFileSync(path.join(r.root, 'untracked.txt'), 'actual new text\n');
    fs.writeFileSync(path.join(r.root, 'binary.bin'), Buffer.from([1, 0, 2])); fs.writeFileSync(path.join(r.root, 'large.txt'), 'x'.repeat(262145));
    fs.writeFileSync(path.join(dir, 'external-secret'), 'EXTERNAL_BYTES_MUST_NOT_BE_READ'); fs.symlinkSync('../external-secret', path.join(r.root, 'link'));
    fs.writeFileSync(path.join(r.root, '.env'), 'SECRET_NOT_FROZEN'); fs.mkdirSync(path.join(r.root, '.git/lfs'), { recursive: true }); fs.writeFileSync(path.join(r.root, '.git/lfs/sentinel'), 'no writes');
    const result = capture(dir, r, 'bundle', artifact); assert.equal(result.status, 'complete'); const b = loadBundle(result.bundle);
    assert(b.targets.includes('untracked.txt')); assert.equal(b.files.get('other.js').change, 'deleted'); assert.equal(fs.readFileSync(path.join(result.bundle, 'head/link'), 'utf8'), '../external-secret');
    for (const n of ['binary.bin', 'large.txt', '.env']) assert(!b.targets.includes(n));
    const bytes = b.targets.flatMap(n => ['base', 'head'].map(side => { const f = b.files.get(n), name = side === 'base' ? f.oldPath || n : n; const p = path.join(result.bundle, side, name); return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : ''; })).join('');
    assert(!bytes.includes('EXTERNAL_BYTES_MUST_NOT_BE_READ')); assert(!bytes.includes('SECRET_NOT_FROZEN'));
  });
  await test('Git: committed rename maps old/base new/head while unstaged rename is delete plus add', async (dir, artifact) => {
    const r = repository(path.join(dir, 'repo')), text = 'first\n' + Array.from({ length: 100 }, (_, i) => 'stable ' + i).join('\n') + '\n';
    const base = r.commit({ 'old.txt': text }, []), head = r.commit({ 'new.txt': text.replace('first', 'changed') }, [base]); r.ref('main', base); r.ref('feature', head); r.worktree({ 'new.txt': text.replace('first', 'changed') });
    const a = capture(dir, r, 'committed', artifact); assert.equal(a.status, 'complete'); assert.equal(loadBundle(a.bundle).snapshot.files[0].oldPath, 'old.txt');
    const u = fixture(dir, 'unstaged'); fs.renameSync(path.join(u.root, 'code.js'), path.join(u.root, 'moved.js'));
    const b = capture(dir, u, 'unstaged-bundle', artifact); assert.equal(b.status, 'complete'); const files = loadBundle(b.bundle).snapshot.files;
    assert.equal(files.find(f => f.path === 'code.js').change, 'deleted'); assert.equal(files.find(f => f.path === 'moved.js').change, 'added'); assert(!files.find(f => f.path === 'moved.js').oldPath);
  });
  await test('Git: mode-only and content-identical rename never call model', async (dir, artifact) => {
    const r = repository(path.join(dir, 'repo')); const base = r.commit({ 'a.txt': 'same\n' }, []), head = r.commit({ 'b.txt': 'same\n' }, [base]); r.ref('main', base); r.ref('feature', head); r.worktree({ 'b.txt': 'same\n' }); fs.chmodSync(path.join(r.root, 'b.txt'), 0o755);
    const result = capture(dir, r, 'meta', artifact); assert.equal(result.status, 'complete'); assert.equal(loadBundle(result.bundle).targets.length, 0);
    const t = await setup(path.join(dir, 'engine'), { repo: r }); const run = await t.core.requestBundle({ projectKey: t.key, deliveryId: t.delivery.deliveryId, bundle: result.bundle }); assert.equal(t.adapter.calls.length, 0); assert.equal(run.status, 'succeeded');
    const m = fixture(dir, 'chmod'); fs.writeFileSync(path.join(m.root, 'code.js'), m.baseFiles['code.js']); fs.writeFileSync(path.join(m.root, 'other.js'), m.baseFiles['other.js']); fs.chmodSync(path.join(m.root, 'code.js'), 0o755);
    const mode = capture(dir, m, 'chmod-bundle', artifact); assert.equal(mode.status, 'complete'); assert.equal(loadBundle(mode.bundle).targets.length, 0); assert.equal(loadBundle(mode.bundle).snapshot.files[0].change, 'mode-changed');
  });
  await test('Git: submodule gitlink is metadata and nested worktree is never traversed', async (dir, artifact) => {
    const r = repository(path.join(dir, 'repo')); const c = r.commit({ 'inside': 'one\n' }, []), d = r.commit({ 'inside': 'two\n' }, [c]);
    const base = r.commit({ sub: { mode: '160000', oid: c } }, []), head = r.commit({ sub: { mode: '160000', oid: d } }, [base]); r.ref('main', base); r.ref('feature', head); r.worktree({ sub: { mode: '160000' } });
    fs.symlinkSync('/nonexistent-p2-core-probe', path.join(r.root, 'sub/danger'));
    const result = capture(dir, r, 'submodule', artifact); const b = loadBundle(result.bundle);
    assert.equal(b.targets.length, 0); assert.equal(b.snapshot.files[0].kind, 'submodule'); assert.equal(b.snapshot.files[0].headGitlink, d);
  });
  await test('Git: conflict stages fail incomplete without changing index', async (dir, artifact) => {
    const r = fixture(dir), oid = r.object('blob', 'conflict\n'); writeIndex(r, [1, 2, 3].map(stage => ({ name: 'code.js', stage, oid })));
    const result = capture(dir, r, 'conflict', artifact); assert.equal(result.status, 'incomplete'); assert.equal(result.code, 'unmerged-index');
  });
  for (const kind of ['split-config', 'split-shared', 'split-link', 'missing-index', 'corrupt-index', 'unknown-required-extension']) await test('Git: pre-index exit ' + kind, async (dir, artifact) => {
    const r = fixture(dir);
    if (kind === 'split-config') fs.appendFileSync(path.join(r.root, '.git/config'), '[core]\n splitIndex = true\n');
    if (kind === 'split-shared') fs.writeFileSync(path.join(r.root, '.git/sharedindex.fixture'), 'do not freshen');
    if (kind === 'split-link' || kind === 'unknown-required-extension') { const e = Buffer.alloc(kind === 'split-link' ? 28 : 8); e.write(kind === 'split-link' ? 'link' : 'abcd'); e.writeUInt32BE(e.length - 8, 4); writeIndex(r, [], e); }
    if (kind === 'missing-index') fs.unlinkSync(path.join(r.root, '.git/index'));
    if (kind === 'corrupt-index') fs.writeFileSync(path.join(r.root, '.git/index'), 'broken');
    const result = capture(dir, r, 'preflight', artifact); assert.equal(result.status, 'incomplete'); assert(!result.commands.some(c => c.command === 'ls-files')); assert(!fs.existsSync(path.join(dir, 'preflight')));
  });
  for (const kind of ['shallow', 'no-base', 'multi-base']) await test('Git: history boundary ' + kind, async (dir, artifact) => {
    const r = fixture(dir);
    if (kind === 'shallow') fs.writeFileSync(path.join(r.root, '.git/shallow'), r.base + '\n');
    if (kind === 'no-base') r.ref('main', r.commit(r.baseFiles, [], 'unrelated'));
    if (kind === 'multi-base') { const a = r.commit(r.baseFiles, [r.base], 'a'), b = r.commit(r.baseFiles, [r.base], 'b'); r.ref('main', r.commit(r.baseFiles, [a, b], 'left')); r.ref('feature', r.commit(r.baseFiles, [b, a], 'right')); }
    const result = capture(dir, r, kind, artifact); assert.equal(result.status, 'incomplete'); assert.equal(result.code, { shallow: 'shallow-history', 'no-base': 'no-merge-base', 'multi-base': 'multiple-merge-bases' }[kind]);
  });
  await test('Git: clean/textconv/LFS hooks never execute and .git/lfs stays unchanged', async (dir, artifact) => {
    const r = fixture(dir), marker = path.join(dir, 'FILTER_EXECUTED');
    fs.appendFileSync(path.join(r.root, '.git/config'), `[filter "lfs"]\n clean = touch ${marker}\n smudge = touch ${marker}\n[diff "evil"]\n textconv = touch ${marker}\n`);
    fs.writeFileSync(path.join(r.root, '.gitattributes'), '*.js filter=lfs diff=evil\n'); fs.mkdirSync(path.join(r.root, '.git/lfs/objects'), { recursive: true }); fs.writeFileSync(path.join(r.root, '.git/lfs/objects/sentinel'), 'no-lfs-write');
    const result = capture(dir, r, 'filters', artifact); assert.equal(result.status, 'complete'); assert(!fs.existsSync(marker)); assert(fs.readFileSync(path.join(result.bundle, 'head/code.js'), 'utf8').includes('return 2'));
  });
  await test('Git: promisor missing object never starts lazy fetch helper', async (dir, artifact) => {
    const r = fixture(dir), oid = crypto.createHash('sha1').update('blob ' + Buffer.byteLength(r.baseFiles['code.js']) + '\0').update(r.baseFiles['code.js']).digest('hex');
    fs.unlinkSync(path.join(r.root, '.git/objects', oid.slice(0, 2), oid.slice(2))); fs.appendFileSync(path.join(r.root, '.git/config'), '[extensions]\n partialClone = origin\n[remote "origin"]\n url = core-sentinel::dummy\n promisor = true\n');
    const bin = path.join(dir, 'bin'), marker = path.join(dir, 'FETCH_CALLED'); fs.mkdirSync(bin); fs.writeFileSync(path.join(bin, 'git-remote-core-sentinel'), '#!/bin/sh\ntouch ' + marker + '\nexit 1\n'); fs.chmodSync(path.join(bin, 'git-remote-core-sentinel'), 0o755);
    const previous = process.env.PATH; process.env.PATH = bin + path.delimiter + previous;
    try { const result = capture(dir, r, 'promisor', artifact); assert.equal(result.status, 'incomplete'); assert(!fs.existsSync(marker)); } finally { process.env.PATH = previous; }
  });
  for (const mutation of ['add', 'delete', 'rename', 'same-size-same-mtime']) await test('Git: consistency detects ' + mutation, async (dir, artifact) => {
    const r = fixture(dir), file = path.join(r.root, 'code.js');
    if (mutation === 'same-size-same-mtime') fs.utimesSync(file, 1700000000, 1700000000);
    const original = fs.statSync(file);
    const result = capture(dir, r, 'mutation', artifact, { _testAfterRead: ({ attempt }) => {
      if (attempt !== 0) return;
      if (mutation === 'add') fs.writeFileSync(path.join(r.root, 'new.txt'), 'new\n');
      if (mutation === 'delete') fs.unlinkSync(path.join(r.root, 'other.js'));
      if (mutation === 'rename') fs.renameSync(path.join(r.root, 'other.js'), path.join(r.root, 'renamed.js'));
      if (mutation === 'same-size-same-mtime') { fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace('return 2', 'return 9')); fs.utimesSync(file, original.atimeMs / 1000, original.mtimeMs / 1000); assert.equal(fs.statSync(file).mtimeMs, original.mtimeMs); assert.equal(fs.statSync(file).size, original.size); }
    } });
    assert.equal(result.status, 'complete'); assert.equal(result.attempts.length, 2);
    if (mutation === 'same-size-same-mtime') assert(fs.readFileSync(path.join(result.bundle, 'head/code.js'), 'utf8').includes('return 9'));
  });
}
