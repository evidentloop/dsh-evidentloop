import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { externalDestination } from '../../core/lib/common.mjs';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const target = externalDestination(process.argv[2] || path.join(os.tmpdir(), 'dsh-evidentloop-local-' + Date.now() + '.tgz'));
if (fs.existsSync(target)) throw Error('Refusing to overwrite a package artifact');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'evidentloop-package-')), folder = path.join(temp, 'package'); fs.mkdirSync(folder);
const files = [], visit = (file, relative) => { const s = fs.lstatSync(file); if (s.isSymbolicLink()) throw Error('Package symlink refused'); if (s.isDirectory()) for (const name of fs.readdirSync(file).sort()) visit(path.join(file, name), relative + '/' + name); else { const destination = path.join(folder, relative); fs.mkdirSync(path.dirname(destination), { recursive: true }); fs.copyFileSync(file, destination); files.push({ path: relative, sha256: crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex') }); } };
try {
  for (const name of ['package.json', 'README.md', 'LICENSE', 'THIRD_PARTY_NOTICES.md', 'cordis.patch.yml', 'dist', 'skills', 'vendor']) visit(path.join(root, name), name);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const metadataFlags = process.platform === 'darwin' ? ['--no-xattrs'] : [];
  const result = spawnSync('/usr/bin/tar', [...metadataFlags, '--uid', '0', '--gid', '0', '--uname', 'root', '--gname', 'root', '-czf', target, '-C', temp, 'package'], { encoding: 'utf8', env: { ...process.env, COPYFILE_DISABLE: '1' } });
  if (result.status) throw Error(result.stderr || 'Local package archive failed');
  fs.writeFileSync(target + '.manifest.json', JSON.stringify({ files, sha256: crypto.createHash('sha256').update(fs.readFileSync(target)).digest('hex'), localIsolatedInstallationOnly: true, published: false }, null, 2) + '\n');
  console.log(JSON.stringify({ artifact: target, files: files.length, sha256: crypto.createHash('sha256').update(fs.readFileSync(target)).digest('hex'), published: false }));
} finally { fs.rmSync(temp, { recursive: true, force: true }); }
