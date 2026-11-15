import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
export const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const METHOD_ROOT = path.join(PROJECT_ROOT, 'skills/evidentloop-review');
export const METHOD_FILES = Object.freeze(['SKILL.md', 'references/alignment.md', 'references/findings.md', 'references/quality-rules.md', 'references/understanding.md', 'rubric.md', 'rules/builtin.json', 'rules/p1-ux-spec.md', 'schema/run.schema.json'].sort());
export const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');
export const normalizeLF = text => String(text ?? '').replace(/\r\n/g, '\n');
export const linesOf = text => { const clean = normalizeLF(text); if (!clean) return []; const lines = clean.split('\n'); if (lines.at(-1) === '') lines.pop(); return lines; };
export function canonical(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  return '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + canonical(value[key])).join(',') + '}';
}
export function safeRelative(value) {
  if (typeof value !== 'string' || !value || value.includes('\0') || value.includes('\\') || /^[A-Za-z]:/.test(value) || path.posix.isAbsolute(value) || path.posix.normalize(value) !== value || value.split('/').some(part => ['.', '..', '.git'].includes(part.toLowerCase()))) throw new Error('Unsafe repository path: ' + JSON.stringify(value));
  return value;
}
export function inside(root, candidate) { const relative = path.relative(root, candidate); return relative === '' || (!relative.startsWith('..' + path.sep) && relative !== '..' && !path.isAbsolute(relative)); }
export function physicalDestination(file) {
  let parent=path.dirname(path.resolve(file));const missing=[];
  while(!fs.existsSync(parent)){missing.unshift(path.basename(parent));const next=path.dirname(parent);if(next===parent)throw Error('No existing output ancestor');parent=next;}
  return path.join(fs.realpathSync(parent),...missing,path.basename(file));
}
export function externalDestination(file) {
  const destination = physicalDestination(file);
  let current = fs.existsSync(destination) ? fs.realpathSync(destination) : destination;
  if (!fs.existsSync(current) || !fs.statSync(current).isDirectory()) current = path.dirname(current);
  for (;;) {
    if (path.basename(current) === '.git' || fs.existsSync(path.join(current, '.git')) ||
      ['HEAD', 'config', 'objects', 'refs'].every(name => fs.existsSync(path.join(current, name)))) throw Error('Output/storage must not enter a Git repository');
    const parent = path.dirname(current); if (parent === current) break; current = parent;
  }
  return destination;
}
export function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  if(fs.constants.O_NOFOLLOW===undefined)throw Error('O_NOFOLLOW required for report writes');
  const fd=fs.openSync(file,fs.constants.O_WRONLY|fs.constants.O_CREAT|fs.constants.O_TRUNC|fs.constants.O_NOFOLLOW,0o600);
  try{fs.writeFileSync(fd,JSON.stringify(value,null,2)+'\n');}finally{fs.closeSync(fd);}
}
export function methodVersion(methodRoot = METHOD_ROOT) {
  const files = METHOD_FILES.map(name => {
    const file = path.join(methodRoot, name); const stat = fs.lstatSync(file);
    if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('Required method file is not a regular file: ' + name);
    return { path: name, sha256: sha256(fs.readFileSync(file)) };
  });
  return { promptVersion: sha256(canonical(files)), files };
}
export const fileIdentity = file => [file.path, file.oldPath ?? null, file.change, file.kind, file.baseMode ?? null, file.headMode ?? null, file.baseSha256 ?? null, file.headSha256 ?? null];
export const requirementDigest = sources => sha256(canonical([...sources].sort((a, b) => a.order - b.order).map(source => ({ order: source.order, kind: source.kind, sha256: source.sha256, items: source.items.map(({ start, end }) => ({ start, end })) }))));
export const inputFingerprint = ({ files, requirements, rulesVersion, promptVersion, range }) => sha256(canonical({ files: [...files].sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0).map(fileIdentity), requirements: requirementDigest(requirements), rulesVersion, promptVersion, baseSha: range.baseSha ?? null }));
export const isTarget = file => !['binary','oversize','excluded','submodule','conflicted'].includes(file.kind) && file.change !== 'mode-changed' && !(file.change === 'renamed' && file.baseSha256 === file.headSha256);
export function prepareRequirements(sources = []) {
  const orders = new Set(); const ids = new Set();
  return [...sources].map(source => {
    if (source.origin !== undefined && typeof source.origin !== 'string') throw new Error('Requirement origin must be text');
    if (!Number.isSafeInteger(source.order) || orders.has(source.order)) throw new Error('Each requirement source needs a unique, explicit stable integer order'); orders.add(source.order);
    if (!['session-message', 'file', 'paste'].includes(source.kind)) throw new Error('Invalid requirement source kind');
    let raw = source.text;
    if (source.kind === 'file' && source.file) { const stat = fs.lstatSync(source.file); if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('Requirement file must be a regular file'); raw = fs.readFileSync(source.file, 'utf8'); }
    if (typeof raw !== 'string' || !raw.trim()) throw new Error('Requirement text must be nonblank');
    const text = normalizeLF(raw), length = Array.from(text).length, hash = sha256(text);
    const intervals = source.items ?? [{ start: 0, end: length }];
    if (!Array.isArray(intervals) || !intervals.length) throw new Error('Requirement source must have at least one item');
    let previousEnd = -1;
    const items = [...intervals].sort((a, b) => a.start - b.start).map(({ start, end }) => {
      if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || end <= start || end > length || start < previousEnd) throw new Error('Invalid/overlapping requirement code-point interval');
      previousEnd = end;
      const itemId = sha256(canonical([source.order, hash, start, end])).slice(0, 12);
      if (ids.has(itemId)) throw new Error('Duplicate requirement item id'); ids.add(itemId);
      return { itemId, start, end };
    });
    return { reqId: 'req-' + sha256(canonical([source.order, source.kind, hash])).slice(0, 12), kind: source.kind, origin: source.origin || (source.file ? path.basename(source.file) : source.kind), capturedAt: source.capturedAt || new Date().toISOString(), order: source.order, text, sha256: hash, originalLength: length, truncated: false, items };
  }).sort((a, b) => a.order - b.order);
}
