#!/usr/bin/env node
/**
 * P1 prototype data builder.
 *
 * Real side: read-only Git metadata + working-tree bytes from THIS repository.
 * Synthetic side: change explanation, per-file semantics, impacts, alignment,
 * extras, findings and evidence quotes (validated against the generated snapshot).
 *
 * Only these Git commands are used:
 *   rev-parse, merge-base, ls-tree, ls-files, cat-file
 * Commands that read/refresh the index or touch the worktree (status, diff,
 * add, update-index) are deliberately not used.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, '../..');
const OUT_FILE = path.resolve(SCRIPT_DIR, '../data/snapshot.js');
const GIT_DIR_PATH = path.join(REPO_ROOT, '.git');
const REPO_GIT_ARGS = fs.existsSync(GIT_DIR_PATH) ? [`--git-dir=${GIT_DIR_PATH}`, `--work-tree=${REPO_ROOT}`] : [];
const GIT_LOCATION_ENV = new Set([
  'GIT_DIR', 'GIT_WORK_TREE', 'GIT_INDEX_FILE', 'GIT_OBJECT_DIRECTORY',
  'GIT_ALTERNATE_OBJECT_DIRECTORIES', 'GIT_COMMON_DIR', 'GIT_NAMESPACE',
]);
const EMPTY_TREE = '4b825dc642cb6eb9a060e54bf8d69288fbee4904';
const SIZE_LIMIT = 256 * 1024;
const RULES_VERSION = 'evidentloop-rules-v0.1';
const PROMPT_VERSION = 'evidentloop-prompt-v0.1';
const MODEL = 'DeepSeek-V4.1-Flash';
const ALLOWED_GIT = new Set(['rev-parse', 'merge-base', 'ls-tree', 'ls-files', 'cat-file']);
const DEMO_SOURCE_PATHS = ['prototype/src/app.js', 'prototype/src/scenarios.js', 'prototype/src/focus-review.js'];
const DEMO_SOURCE_COUNT = DEMO_SOURCE_PATHS.filter(filePath => fs.existsSync(path.join(REPO_ROOT, filePath))).length;
const HAS_DEMO_SOURCES = DEMO_SOURCE_COUNT === DEMO_SOURCE_PATHS.length;
if (DEMO_SOURCE_COUNT > 0 && !HAS_DEMO_SOURCES) {
  throw new Error('[annotation seed] the demo source tree is incomplete; refusing to build without its annotations');
}

// Workspace metadata and generated output are not part of a delivery snapshot.
const OMIT_PREFIXES = ['.sopify/', 'docs/', 'prototype/data/', '.git/', 'node_modules/', 'test-evidence/'];
const EXCLUDED_PREFIXES = [
  { prefix: 'prototype/vendor/', note: '第三方依赖目录，按工作区规则排除（LICENSES.txt 保留在演示目录）' },
];
const SENSITIVE_PATTERNS = [
  /(^|\/)\.env(\.|$)/i,
  /\.(pem|key|p12|pfx|jks|keystore)$/i,
  /(^|\/)id_(rsa|dsa|ecdsa|ed25519)(\.|$)/i,
  /(^|\/)(credentials?|secrets?)(\.|$)/i,
];

const now = new Date();
const isoAt = date => {
  const pad = value => String(value).padStart(2, '0');
  const offset = -date.getTimezoneOffset();
  const sign = offset >= 0 ? '+' : '-';
  const abs = Math.abs(offset);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`;
};
const sha256 = buffer => crypto.createHash('sha256').update(buffer).digest('hex');
const gitBlobSha = buffer => crypto.createHash('sha1').update(Buffer.from(`blob ${buffer.length}\0`)).update(buffer).digest('hex');
const splitLines = text => {
  const normalized = String(text ?? '').replace(/\r\n/g, '\n');
  if (!normalized) return [];
  const lines = normalized.split('\n');
  if (lines[lines.length - 1] === '') lines.pop();
  return lines;
};
const lineCount = text => splitLines(text).length;
const isOmitted = filePath => OMIT_PREFIXES.some(prefix => filePath === prefix.slice(0, -1) || filePath.startsWith(prefix));
const excludedReason = filePath => {
  const vendor = EXCLUDED_PREFIXES.find(rule => filePath.startsWith(rule.prefix));
  if (vendor) return vendor.note;
  if (SENSITIVE_PATTERNS.some(pattern => pattern.test(filePath))) return '命中敏感路径规则，仅保留元数据';
  return '';
};

function runGit(args, { input, text = false } = {}) {
  if (!ALLOWED_GIT.has(args[0])) throw new Error(`Refusing non-whitelisted Git command: git ${args[0]}`);
  const env = { ...process.env };
  // Drop inherited repository-location, tracing and config-redirection variables.
  for (const key of Object.keys(env)) {
    if (GIT_LOCATION_ENV.has(key) || key.startsWith('GIT_TRACE') || key.startsWith('GIT_CONFIG')) delete env[key];
  }
  Object.assign(env, {
    GIT_OPTIONAL_LOCKS: '0',
    GIT_NO_LAZY_FETCH: '1',
    GIT_TERMINAL_PROMPT: '0',
  });
  const output = execFileSync('git', [...REPO_GIT_ARGS, '-c', 'core.fsmonitor=false', ...args], {
    cwd: REPO_ROOT, env, input, maxBuffer: 256 * 1024 * 1024,
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  return text ? output.toString('utf8') : output;
}
const runGitText = args => runGit(args, { text: true });

function revParse(ref) {
  try {
    const value = runGitText(['rev-parse', '--verify', '--quiet', ref]).trim();
    return value || null;
  } catch { return null; }
}

function resolveTarget() {
  const override = process.argv.find(arg => arg.startsWith('--target='))?.slice('--target='.length) || '';
  if (override) {
    const sha = revParse(override);
    if (sha) return { ref: override, sha, source: 'override' };
  }
  const originHead = revParse('origin/HEAD');
  if (originHead) return { ref: 'origin/HEAD', sha: originHead, source: 'origin-head' };
  for (const branch of ['main', 'master']) {
    const sha = revParse(`refs/heads/${branch}`);
    if (sha) return { ref: branch, sha, source: 'branch' };
  }
  return null;
}

function resolveBranch() {
  try {
    const branch = runGitText(['rev-parse', '--abbrev-ref', 'HEAD']).trim();
    return branch && branch !== 'HEAD' ? branch : null;
  } catch { return null; }
}

function resolveRange() {
  const headSha = revParse('HEAD');
  const target = resolveTarget();
  if (!headSha) {
    return {
      kind: 'merge-base-worktree', targetRef: '(unborn)', targetSha: null,
      baseSha: EMPTY_TREE, headSha: null, dirty: true, unborn: true,
      note: '仓库尚无提交（unborn HEAD）；以空树 4b825dc 为基线，新侧为本仓当前文件。', status: 'complete',
    };
  }
  if (!target) {
    return {
      kind: 'merge-base-worktree', targetRef: null, targetSha: null,
      baseSha: null, headSha, dirty: true, unborn: false,
      note: '无法确定目标分支（未找到 origin/HEAD、main、master）；快照不完整。', status: 'incomplete',
    };
  }
  let baseSha = null;
  try { baseSha = runGitText(['merge-base', target.sha, headSha]).trim() || null; } catch { baseSha = null; }
  return {
    kind: 'merge-base-worktree', targetRef: target.ref, targetSha: target.sha,
    baseSha, headSha, dirty: true, unborn: false,
    note: baseSha ? '' : '目标分支与 HEAD 没有 merge-base；快照不完整。',
    status: baseSha ? 'complete' : 'incomplete',
  };
}

function parseNulRecords(buffer) {
  return buffer.toString('utf8').split('\0').filter(Boolean);
}

function commitSubjectOf(sha) {
  if (!sha || sha === EMPTY_TREE) return '';
  try {
    const raw = runGitText(['cat-file', 'commit', sha]);
    const body = raw.split(/\n\n/).slice(1).join('\n\n');
    return body.split('\n')[0].replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 200);
  } catch { return ''; }
}

function readTree(rev) {
  const map = new Map();
  if (!rev || rev === EMPTY_TREE) return map;
  const records = parseNulRecords(runGit(['ls-tree', '-r', '-z', rev]));
  for (const record of records) {
    const tab = record.indexOf('\t');
    if (tab < 0) continue;
    const meta = record.slice(0, tab).split(' ');
    const filePath = record.slice(tab + 1);
    if (meta.length < 3) continue;
    map.set(filePath, { mode: meta[0], type: meta[1], sha: meta[2] });
  }
  return map;
}

function readIndex() {
  const map = new Map();
  const records = parseNulRecords(runGit(['ls-files', '-z', '-s']));
  for (const record of records) {
    const tab = record.indexOf('\t');
    if (tab < 0) continue;
    const meta = record.slice(0, tab).match(/^(\d+) ([0-9a-f]+) (\d)$/);
    if (!meta) continue;
    const filePath = record.slice(tab + 1);
    if (!map.has(filePath)) map.set(filePath, []);
    map.get(filePath).push({ mode: meta[1], sha: meta[2], stage: Number(meta[3]) });
  }
  return map;
}

function readUntracked() {
  return parseNulRecords(runGit(['ls-files', '-z', '-o', '--exclude-standard']));
}

function readBlobs(shas) {
  const map = new Map();
  const unique = [...new Set(shas.filter(Boolean))];
  if (!unique.length) return map;
  const output = runGit(['cat-file', '--batch'], { input: unique.join('\n') + '\n' });
  let offset = 0;
  for (const sha of unique) {
    const headerEnd = output.indexOf(10, offset);
    if (headerEnd < 0) throw new Error('Unexpected git cat-file output');
    const header = output.slice(offset, headerEnd).toString('utf8');
    offset = headerEnd + 1;
    const parts = header.split(' ');
    if (parts[1] === 'missing') throw new Error(`Missing Git object ${sha}; refusing to fetch`);
    const size = Number(parts[2]);
    if (!Number.isFinite(size)) throw new Error('Unexpected git cat-file header: ' + header);
    map.set(sha, output.subarray(offset, offset + size));
    offset += size + 1;
  }
  return map;
}

function splitIndexPreflight() {
  const gitDirRaw = runGitText(['rev-parse', '--git-dir']).trim();
  const gitDir = path.isAbsolute(gitDirRaw) ? gitDirRaw : path.join(REPO_ROOT, gitDirRaw);
  const indexFile = path.join(gitDir, 'index');
  if (fs.existsSync(path.join(gitDir)) && fs.readdirSync(gitDir).some(name => name.startsWith('sharedindex.'))) {
    return { hit: true, reason: '存在 sharedindex.* 文件' };
  }
  const configFile = path.join(gitDir, 'config');
  if (fs.existsSync(configFile)) {
    let section = '';
    for (const line of fs.readFileSync(configFile, 'utf8').split('\n')) {
      const trimmed = line.trim();
      const header = trimmed.match(/^\[([^\]]+)\]$/);
      if (header) { section = header[1].toLowerCase(); continue; }
      if (section === 'core') {
        const match = trimmed.match(/^([A-Za-z]+)\s*=\s*(.*)$/);
        if (match && match[1].toLowerCase() === 'splitindex' && /^(true|yes|on|1)$/i.test(match[2].trim())) {
          return { hit: true, reason: 'core.splitIndex 已启用' };
        }
      }
    }
  }
  if (!fs.existsSync(indexFile)) return { hit: false, reason: '' };
  const buffer = fs.readFileSync(indexFile);
  try {
    if (buffer.length < 32) return { hit: true, reason: 'index 文件过短，无法确认格式' };
    const version = buffer.readUInt32BE(4);
    const count = buffer.readUInt32BE(8);
    let offset = 12;
    for (let i = 0; i < count; i++) {
      const entryStart = offset;
      if (offset + 62 > buffer.length) return { hit: true, reason: 'index 条目解析失败' };
      const flags = buffer.readUInt16BE(offset + 60);
      offset += 62;
      if (version >= 3 && (flags & 0x4000)) {
        if (offset + 2 > buffer.length) return { hit: true, reason: 'index 扩展标记解析失败' };
        offset += 2;
      }
      if (version === 4) {
        let byte = buffer[offset++];
        if (byte === undefined) return { hit: true, reason: 'index v4 路径解析失败' };
        let length = byte & 0x7f;
        while (byte & 0x80) {
          byte = buffer[offset++];
          if (byte === undefined) return { hit: true, reason: 'index v4 路径解析失败' };
          length = ((length + 1) << 7) | (byte & 0x7f);
        }
        offset += length;
      } else {
        while (offset < buffer.length && buffer[offset] !== 0) offset++;
        if (offset >= buffer.length) return { hit: true, reason: 'index 路径解析失败' };
        offset += 1;
        const entryLength = offset - entryStart;
        offset += (8 - (entryLength % 8)) % 8;
      }
    }
    const end = buffer.length - 20;
    while (offset + 8 <= end) {
      const signature = buffer.toString('ascii', offset, offset + 4);
      const size = buffer.readUInt32BE(offset + 4);
      if (signature === 'link') return { hit: true, reason: 'index 含 link 扩展' };
      if (size < 0 || offset + 8 + size > end) return { hit: true, reason: 'index 扩展区解析失败' };
      offset += 8 + size;
    }
    return { hit: false, reason: '' };
  } catch {
    return { hit: true, reason: 'index 解析失败，按 split index 处理' };
  }
}

function detectBinary(buffer) {
  return buffer.includes(0);
}

function diffLines(oldText, newText) {
  const oldLines = splitLines(oldText);
  const newLines = splitLines(newText);
  let prefix = 0;
  while (prefix < oldLines.length && prefix < newLines.length && oldLines[prefix] === newLines[prefix]) prefix++;
  let suffix = 0;
  while (suffix < oldLines.length - prefix && suffix < newLines.length - prefix &&
    oldLines[oldLines.length - 1 - suffix] === newLines[newLines.length - 1 - suffix]) suffix++;
  const a = oldLines.slice(prefix, oldLines.length - suffix);
  const b = newLines.slice(prefix, newLines.length - suffix);
  const ops = [];
  for (let i = 0; i < prefix; i++) ops.push({ t: ' ', old: i + 1, new: i + 1, text: oldLines[i] });
  let oldLine = prefix + 1, newLine = prefix + 1;
  if (a.length * b.length > 4_000_000) {
    for (const line of a) { ops.push({ t: '-', old: oldLine++, text: line }); }
    for (const line of b) { ops.push({ t: '+', new: newLine++, text: line }); }
  } else if (a.length && b.length) {
    const width = b.length + 1;
    const dp = new Uint32Array((a.length + 1) * width);
    for (let i = a.length - 1; i >= 0; i--) {
      for (let j = b.length - 1; j >= 0; j--) {
        dp[i * width + j] = a[i] === b[j] ? dp[(i + 1) * width + j + 1] + 1
          : Math.max(dp[(i + 1) * width + j], dp[i * width + j + 1]);
      }
    }
    let i = 0, j = 0;
    while (i < a.length && j < b.length) {
      if (a[i] === b[j]) { ops.push({ t: ' ', old: oldLine++, new: newLine++, text: a[i] }); i++; j++; }
      else if (dp[(i + 1) * width + j] >= dp[i * width + j + 1]) { ops.push({ t: '-', old: oldLine++, text: a[i] }); i++; }
      else { ops.push({ t: '+', new: newLine++, text: b[j] }); j++; }
    }
    while (i < a.length) { ops.push({ t: '-', old: oldLine++, text: a[i++] }); }
    while (j < b.length) { ops.push({ t: '+', new: newLine++, text: b[j++] }); }
  } else {
    for (const line of a) { ops.push({ t: '-', old: oldLine++, text: line }); }
    for (const line of b) { ops.push({ t: '+', new: newLine++, text: line }); }
  }
  for (let i = 0; i < suffix; i++) {
    ops.push({ t: ' ', old: oldLines.length - suffix + i + 1, new: newLines.length - suffix + i + 1, text: oldLines[oldLines.length - suffix + i] });
  }
  return { ops, additions: b.length, deletions: a.length };
}

function unifiedDiff(filePath, oldText, newText) {
  const { ops } = diffLines(oldText, newText);
  const changes = [];
  ops.forEach((op, index) => { if (op.t !== ' ') changes.push(index); });
  if (!changes.length) return '';
  const hunks = [];
  let start = changes[0], end = changes[0];
  for (const index of changes.slice(1)) {
    if (index - end <= 6) end = index;
    else { hunks.push([Math.max(0, start - 3), Math.min(ops.length - 1, end + 3)]); start = index; end = index; }
  }
  hunks.push([Math.max(0, start - 3), Math.min(ops.length - 1, end + 3)]);
  const out = [`--- a/${filePath}`, `+++ b/${filePath}`];
  for (const [hunkStart, hunkEnd] of hunks) {
    const slice = ops.slice(hunkStart, hunkEnd + 1);
    const oldCount = slice.filter(op => op.t !== '+').length;
    const newCount = slice.filter(op => op.t !== '-').length;
    const before = ops[hunkStart - 1];
    const oldStart = oldCount ? slice.find(op => op.t !== '+').old : (before?.old ?? 0);
    const newStart = newCount ? slice.find(op => op.t !== '-').new : (before?.new ?? 0);
    out.push(`@@ -${oldStart},${oldCount} +${newStart},${newCount} @@`);
    for (const op of slice) out.push(op.t + op.text);
  }
  return out.join('\n') + '\n';
}

function changedLineSets(diff) {
  const oldLines = new Set(), newLines = new Set();
  let oldLine = 0, newLine = 0;
  for (const line of String(diff || '').split('\n')) {
    const hunk = line.match(/^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
    if (hunk) { oldLine = Number(hunk[1]); newLine = Number(hunk[2]); continue; }
    if (!oldLine && !newLine) continue;
    if (line.startsWith('\\')) continue;
    if (line.startsWith('-')) { oldLines.add(oldLine); oldLine++; }
    else if (line.startsWith('+')) { newLines.add(newLine); newLine++; }
    else if (line.startsWith(' ')) { oldLine++; newLine++; }
  }
  return { oldLines, newLines };
}

function collectFiles(range, preflight) {
  const baseEntries = range.baseSha && range.baseSha !== EMPTY_TREE ? readTree(range.baseSha) : new Map();
  const headEntries = range.headSha ? readTree(range.headSha) : new Map();
  const index = readIndex();
  const untracked = readUntracked();
  const paths = new Set([...baseEntries.keys(), ...headEntries.keys(), ...index.keys(), ...untracked]);
  const candidates = [];
  for (const filePath of [...paths].sort()) {
    if (isOmitted(filePath)) continue;
    const baseEntry = baseEntries.get(filePath) || null;
    const headEntry = headEntries.get(filePath) || null;
    const indexEntries = index.get(filePath) || [];
    const indexEntry = indexEntries.find(entry => entry.stage === 0) || indexEntries[0] || null;
    const conflicted = indexEntries.some(entry => entry.stage !== 0) || indexEntries.length > 1;
    const fullPath = path.join(REPO_ROOT, filePath);
    let stat = null;
    try { stat = fs.lstatSync(fullPath); } catch { stat = null; }
    const modes = [baseEntry?.mode, headEntry?.mode, indexEntry?.mode].filter(Boolean);
    const isSubmodule = modes.includes('160000') || (stat?.isDirectory() && indexEntry?.mode === '160000');
    const isSymlink = Boolean(stat?.isSymbolicLink()) || modes.includes('120000');
    if (stat?.isDirectory() && !isSubmodule) continue;
    const exists = Boolean(stat && (stat.isFile() || stat.isSymbolicLink() || isSubmodule));
    if (!exists && !baseEntry) continue;
    let buffer = null, target = '';
    if (exists) {
      if (isSubmodule) {
        buffer = null;
      } else if (isSymlink) {
        target = fs.readlinkSync(fullPath);
        buffer = Buffer.from(target);
      } else if (stat.isFile()) {
        buffer = fs.readFileSync(fullPath);
      }
    }
    const headMode = !exists ? null : isSubmodule ? '160000' : isSymlink ? '120000'
      : (stat.mode & 0o111) ? '100755' : '100644';
    const baseExists = Boolean(baseEntry);
    let change = null;
    let modeChanged = false;
    if (!baseExists && exists) change = 'added';
    else if (baseExists && !exists && !isSubmodule) change = 'deleted';
    else if (baseExists && !exists && isSubmodule) change = 'deleted';
    else if (baseExists && exists) {
      if (isSubmodule) {
        const headSha = indexEntry?.sha || headEntry?.sha || '';
        if (baseEntry.sha !== headSha) change = 'modified';
      } else {
        const headBlob = gitBlobSha(buffer);
        if (headBlob !== baseEntry.sha) change = 'modified';
        else if (baseEntry.mode !== headMode) { change = 'mode-changed'; modeChanged = true; }
      }
    }
    if (!change) continue;
    const excluded = excludedReason(filePath);
    let kind = 'text';
    let note = '';
    if (conflicted) { kind = 'conflicted'; note = '存在未解决的合并冲突，仅保留元数据'; }
    else if (isSubmodule) { kind = 'submodule'; note = `子模块提交 ${indexEntry?.sha || baseEntry?.sha || ''}`; }
    else if (isSymlink) { kind = 'symlink'; note = `符号链接 → ${target}`; }
    else if (excluded) { kind = 'excluded'; note = excluded; }
    else if (buffer && detectBinary(buffer)) { kind = 'binary'; note = '二进制文件，仅保留元数据'; }
    else if (buffer && buffer.length > SIZE_LIMIT) { kind = 'oversize'; note = `超过 256 KB 上限（${buffer.length} 字节），仅保留元数据`; }
    candidates.push({
      path: filePath, baseEntry, headEntry, indexEntry, indexEntries, stat, buffer, target,
      change, kind, note, headMode, baseExists, exists, modeChanged, conflicted,
      needBase: Boolean(baseEntry && baseEntry.type === 'blob' && (change === 'modified' || change === 'deleted' || kind === 'text' || kind === 'binary' || kind === 'oversize' || kind === 'excluded' || kind === 'symlink')),
      baseText: '', headText: '', baseSha256: null, headSha256: null,
      diff: '', additions: undefined, deletions: undefined,
    });
  }
  // Read the base blobs only for paths that need comparison text.
  const baseBlobs = readBlobs(candidates.filter(candidate => candidate.needBase && candidate.baseEntry?.type === 'blob').map(candidate => candidate.baseEntry.sha));
  const files = [];
  for (const candidate of candidates) {
    const { path: filePath, baseEntry, buffer, target } = candidate;
    const baseBlob = candidate.baseExists && baseEntry?.type === 'blob' ? baseBlobs.get(baseEntry.sha) : null;
    if (candidate.baseExists && baseEntry?.type === 'blob' && !baseBlob) throw new Error(`Missing base blob for ${filePath}`);
    const baseBuffer = baseBlob || null;
    const headBuffer = buffer;
    const baseMode = candidate.baseExists ? baseEntry.mode : null;
    const headMode = candidate.headMode;
    const baseSha256 = baseBuffer ? sha256(baseBuffer) : null;
    const headSha256 = headBuffer ? sha256(headBuffer) : null;
    let diff = '';
    let additions = undefined, deletions = undefined;
    let note = candidate.note;
    if (candidate.kind === 'text' && candidate.change !== 'mode-changed') {
      const baseText = baseBuffer ? baseBuffer.toString('utf8') : '';
      const headText = headBuffer ? headBuffer.toString('utf8') : '';
      diff = unifiedDiff(filePath, baseText, headText);
      const stats = diffStats(diff);
      additions = stats.additions;
      deletions = stats.deletions;
      candidate.baseText = baseText.replace(/\r\n/g, '\n');
      candidate.headText = headText.replace(/\r\n/g, '\n');
    } else if (candidate.kind === 'text' && candidate.change === 'mode-changed') {
      const text = (headBuffer || baseBuffer || Buffer.alloc(0)).toString('utf8');
      candidate.baseText = text.replace(/\r\n/g, '\n');
      candidate.headText = candidate.baseText;
      additions = 0; deletions = 0;
      note = note || `权限 ${baseMode} → ${headMode}`;
    }
    if (candidate.kind === 'symlink') {
      note = note || `符号链接 → ${target}`;
    }
    const file = {
      path: filePath, change: candidate.change, kind: candidate.kind,
      baseMode, headMode, baseSha256, headSha256,
      baseLineCount: lineCount(candidate.baseText), headLineCount: lineCount(candidate.headText),
      ...(additions === undefined ? {} : { additions, deletions }),
      ...(note ? { note } : {}),
      ...(diff ? { diff } : {}),
      _headText: candidate.headText, _baseText: candidate.baseText,
      _changed: changedLineSets(diff),
    };
    files.push(file);
  }
  return files;
}

function diffStats(diff) {
  let additions = 0, deletions = 0;
  for (const line of String(diff || '').split('\n')) {
    if (line.startsWith('+++') || line.startsWith('---')) continue;
    if (line.startsWith('+')) additions++;
    else if (line.startsWith('-')) deletions++;
  }
  return { additions, deletions };
}

function publicFile(file) {
  const { _headText, _baseText, _changed, ...rest } = file;
  return rest;
}

function isReviewableFile(file) {
  const metadataOnly = file.change === 'mode-changed' ||
    (file.change === 'renamed' && Boolean(file.baseSha256) && file.baseSha256 === file.headSha256);
  return file.kind === 'text' && !metadataOnly;
}

function skipReason(file) {
  if (file.change === 'mode-changed') return file.note || '仅元数据变化，无需模型审查。';
  return file.note || {
    binary: '二进制文件，仅保留元数据', oversize: '超过大小限制，仅保留元数据',
    excluded: '按工作区规则排除，仅保留元数据', symlink: '符号链接，仅记录链接目标',
    submodule: '子模块，仅记录提交指针', conflicted: '存在未解决的合并冲突',
  }[file.kind] || '不在审查范围内';
}

function requirementItemsOf(requirements) {
  return requirements.flatMap(source => source.items.map(item => ({
    ...item, source, text: source.text.slice(item.start, item.end),
  })));
}

function makeRequirement({ text, kind, origin, capturedAt, order, itemTexts }) {
  const clean = text.replace(/\r\n/g, '\n');
  const hash = sha256(Buffer.from(clean));
  const items = itemTexts.map(itemText => {
    const start = clean.indexOf(itemText);
    if (start < 0) return null;
    const end = start + itemText.length;
    return { itemId: sha256(Buffer.from(hash + start + end)).slice(0, 12), start, end };
  }).filter(Boolean);
  return {
    reqId: 'req-' + hash.slice(0, 12), kind, origin, capturedAt,
    text: clean, truncated: false, originalLength: clean.length,
    sha256: hash, order, items,
  };
}

function anchorLine(file, anchor) {
  if (!file?._headText || !anchor) return null;
  const index = file._headText.indexOf(anchor);
  if (index < 0) return null;
  return file._headText.slice(0, index).split('\n').length;
}

function diffLineOf(file, needle) {
  let newLine = 0;
  for (const line of String(file?.diff || '').split('\n')) {
    const hunk = line.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
    if (hunk) { newLine = Number(hunk[1]); continue; }
    if (!newLine) continue;
    if (line.startsWith('+')) {
      if (line.slice(1).includes(needle)) return newLine;
      newLine++;
    } else if (line.startsWith(' ')) newLine++;
  }
  return null;
}

function buildEvidence(findingConfig, file) {
  const line = anchorLine(file, findingConfig.anchor);
  if (!line) return null;
  const lines = splitLines(file._headText);
  const startLine = Math.min(Math.max(1, line + (findingConfig.evidenceOffset || 0)), lines.length);
  const endLine = Math.min(lines.length, startLine + Math.max(0, (findingConfig.span || 1) - 1));
  const quote = lines.slice(startLine - 1, endLine).join('\n');
  const findingLine = findingConfig.fileLevel ? null
    : Math.min(endLine, Math.max(startLine, startLine + (findingConfig.lineOffset || 0)));
  return {
    path: file.path, side: 'head', sha256: file.headSha256,
    startLine, endLine, quote,
    line: findingLine,
  };
}

function validateEvidence(evidence, findingLine, file) {
  if (!file) return { code: 'evidence-path-missing', reason: '证据路径不在快照中' };
  if (file.kind !== 'text') return { code: 'evidence-not-text', reason: '证据指向非文本文件' };
  if (evidence.sha256 !== file.headSha256) return { code: 'evidence-sha-mismatch', reason: '证据哈希与快照文件哈希不一致' };
  const lines = splitLines(file._headText);
  const quote = lines.slice(evidence.startLine - 1, evidence.endLine).join('\n');
  if (quote !== evidence.quote) return { code: 'evidence-quote-mismatch', reason: '证据引文与该行区间文本不一致' };
  const changed = file._changed?.newLines || new Set();
  let intersects = false;
  for (let line = evidence.startLine; line <= evidence.endLine; line++) {
    if (changed.has(line)) { intersects = true; break; }
  }
  if (!intersects) return { code: 'evidence-not-in-changed-lines', reason: '主证据未与变更行相交' };
  if (findingLine !== null && (findingLine < evidence.startLine || findingLine > evidence.endLine)) {
    return { code: 'evidence-line-not-covered', reason: '主证据未覆盖问题的行号' };
  }
  return null;
}

const RULE_SOURCES = [
  { kind: 'builtin', id: 'logic-state-consistency' },
  { kind: 'builtin', id: 'logic-failure-path' },
  { kind: 'builtin', id: 'security-secret-content' },
  { kind: 'builtin', id: 'performance-diff-fallback' },
  { kind: 'builtin', id: 'performance-dom-rebuild' },
];

const FINDING_CONFIGS = [
  {
    path: 'prototype/src/app.js', anchor: "async startReview({ scope = 'all', file = null, force = false } = {})",
    span: 3, lineOffset: 1, category: 'logic', severity: 'P2',
    ruleSource: { kind: 'builtin', id: 'logic-state-consistency' },
    title: '单文件运行会清空整批 coverage',
    problem: 'startReview 无论 scope 是什么都先把 coverage.reviewed 清空，文件级审查结束后只写回当前文件。',
    impact: '界面仍按文件状态显示已完成，但 coverage 与当前快照的实际结果不一致，后续去重和 complete 推导会失真。',
    suggestion: { text: '基于快照内全部结果重建 coverage，而不是只记录本次运行范围。' },
  },
  {
    path: 'prototype/src/scenarios.js', anchor: 'function buildState(name, opts = {})',
    span: 2, lineOffset: 1, category: 'logic', severity: 'P2',
    ruleSource: { kind: 'builtin', id: 'logic-state-consistency' },
    title: '场景复用没有重新绑定问题与处置记录',
    problem: 'buildState 用 JSON 深拷贝复用同一份问题与处置记录，问题编号在派生快照中保持不变。',
    impact: '当前演示只用于展示；后续阶段复制运行结果时必须重建运行编号、快照编号与处置记录关联，否则「沿用」记录会指向旧快照。',
    suggestion: { text: '复制结果时同时生成新的问题编号，并把处置记录重新关联到新问题。' },
  },
  {
    path: 'prototype/scripts/build-data.mjs', anchor: 'function resolveRange()',
    span: 4, lineOffset: null, fileLevel: true, category: 'logic', severity: 'P2',
    ruleSource: { kind: 'builtin', id: 'logic-failure-path' },
    title: 'unborn HEAD 的 range 仍标为 merge-base-worktree',
    problem: '仓库没有提交时把空树 4b825dc 作为 baseSha，但 range.kind 仍是 merge-base-worktree，targetSha 与 headSha 为空。',
    impact: '下游若按 commit 解析 baseSha 会失败，快照范围无法被可靠解释。',
    suggestion: { text: '为 unborn 仓库明确 range 表达，或在冻结前走前置提示。' },
  },
  {
    path: 'prototype/scripts/build-data.mjs', anchor: 'function diffLines(oldText, newText)',
    span: 3, lineOffset: 1, category: 'performance', severity: 'P1',
    ruleSource: { kind: 'builtin', id: 'performance-diff-fallback' },
    title: 'LCS 差分的回退会退化成整文件替换',
    problem: 'diffLines 在 old×new 超过 400 万格时直接整段删除再整段插入，不保证与 Git 的 hunk 边界一致。',
    impact: '超大文件会产生可读性很差的 diff，审查者难以定位真实变更。',
    suggestion: { text: '改用与 Git 一致的算法或流式处理。' },
  },
  {
    path: 'prototype/src/diff-view.js', anchor: 'renderDiff() {',
    span: 3, lineOffset: 2, category: 'performance', severity: 'P2',
    ruleSource: { kind: 'builtin', id: 'performance-dom-rebuild' },
    title: '每次切换单双栏都重建整个 Diff DOM',
    problem: 'renderDiff 清空 body 后重新实例化 Diff2HtmlUI，并重新注入全部问题卡片。',
    impact: '上千行文件在单双栏切换时会产生明显卡顿。',
    suggestion: { text: '缓存两种布局的渲染结果，或在切换时保留行锚点与卡片高度。' },
  },
  {
    path: 'prototype/src/focus-review.js', anchor: 'persistFocusPreferences() {',
    span: 3, lineOffset: 2, category: 'logic', severity: 'P2',
    ruleSource: { kind: 'builtin', id: 'logic-failure-path' },
    title: '偏好写入失败被静默吞掉',
    problem: 'localStorage 不可用或写入失败时没有反馈，刷新后单双栏与文件栏状态回到默认值。',
    impact: '用户会以为偏好已经保存，重复设置会反复失效。',
    suggestion: { text: '降级到内存并提示一次，或在设置中展示存储状态。' },
    suppressed: true,
  },
  {
    path: 'prototype/index.html', anchor: '<meta name="color-scheme" content="light dark">',
    span: 2, lineOffset: 0, category: 'logic', severity: 'P2',
    ruleSource: { kind: 'builtin', id: 'logic-failure-path' },
    title: '离线页面未阻止 Service Worker 缓存命中',
    problem: '页面只声明使用本地资源，没有在运行时拒绝 Service Worker 注册；宿主注入缓存后，离线结论可能命中旧资源。',
    impact: 'file:// 演示不受影响；在 HTTP 环境复用同一页面时，离线断言可能高估实际加载内容。',
    suggestion: { text: '在 CDP 层阻断网络并断言零流量。' },
  },
  {
    path: 'prototype/scripts/build-data.mjs', anchor: 'const SENSITIVE_PATTERNS = [',
    span: 4, lineOffset: 1, category: 'security', severity: 'P0',
    ruleSource: { kind: 'builtin', id: 'security-secret-content' },
    title: '敏感排除只按路径，未检查文件内容中的密钥',
    problem: 'SENSITIVE_PATTERNS 只匹配文件名与扩展名，文件正文即使包含密钥形态也会进入文本快照。',
    impact: '一旦快照或导出被共享，可能泄露凭据；这是阻断级的安全问题。',
    suggestion: { text: '在读取文本后增加内容级密钥扫描，命中时降级为只保留元数据。', code: "if (looksLikeSecret(buffer.toString('utf8'))) { kind = 'excluded'; note = '命中内容级敏感规则'; }" },
  },
];

const WITHHELD_CONFIGS = [
  {
    path: 'prototype/src/app.js', anchor: 'this.snapshot.inputSha = P.sha256(JSON.stringify({ previous:',
    span: 2, lineOffset: 0, category: 'logic', severity: 'P2',
    ruleSource: { kind: 'builtin', id: 'logic-state-consistency' },
    title: '需求依据更新后快照标识由客户端拼接',
    problem: '添加需求依据后只重写快照标识与时间，标识用字符串拼接生成。',
    impact: '去重与沿用可能命中旧结果；应由 host 按合同重算并校验。',
    suggestion: { text: '按文件身份与需求摘要重建快照标识。' },
    corrupt: 'quote',
  },
  {
    path: 'prototype/scripts/build-data.mjs', anchor: 'function validateEvidence(evidence, findingLine, file)',
    span: 3, lineOffset: 1, category: 'logic', severity: 'P2',
    ruleSource: { kind: 'builtin', id: 'logic-failure-path' },
    title: '证据校验没有覆盖改名文件的旧路径映射',
    problem: '证据校验只按当前路径读取文本，没有按旧路径与新路径的映射读取基线侧。',
    impact: '改名文件的主证据可能指向错误的行区间。',
    suggestion: { text: '补侧路径映射后再放行证据。' },
    corrupt: 'sha',
  },
  {
    path: 'prototype/src/scenarios.js', anchor: 'function buildState(name, opts = {})',
    span: 2, lineOffset: 0, category: 'logic', severity: 'P2',
    ruleSource: { kind: 'builtin', id: 'logic-state-consistency' },
    title: '变更说明缺少可核对引用',
    problem: '派生场景直接复用说明对象，部分条目没有携带代码引用。',
    impact: '缺少引用的说明无法通过校验；这类结论不展示，并计入审查不完整。',
    suggestion: { text: '为每条说明生成至少一个 refs。' },
    missingRef: true,
  },
];

function findingIdOf(pathValue, line, title, prefix = 'f') {
  return prefix + '-' + sha256(Buffer.from(pathValue + ':' + (line ?? 'file') + ':' + title)).slice(0, 12);
}

function buildFindings(files, runId) {
  const fileByPath = new Map(files.map(file => [file.path, file]));
  const filesOrder = new Map(files.map((file, index) => [file.path, index]));
  const findings = [];
  const withheld = [];
  for (const config of FINDING_CONFIGS) {
    const file = fileByPath.get(config.path);
    if (!file) { console.warn(`[skip finding] file not in snapshot: ${config.path}`); continue; }
    const evidence = buildEvidence(config, file);
    if (!evidence) { console.warn(`[skip finding] anchor not found: ${config.anchor}`); continue; }
    const findingAnchorLine = config.fileLevel ? null : evidence.line;
    const error = validateEvidence(evidence, findingAnchorLine, file);
    if (error) { console.warn(`[skip finding] evidence invalid: ${config.path} ${error.code}`); continue; }
    findings.push({
      findingId: findingIdOf(config.path, findingAnchorLine, config.title),
      runId, category: config.category, severity: config.severity, ruleSource: config.ruleSource,
      title: config.title, problem: config.problem, impact: config.impact,
      suggestion: config.suggestion,
      anchor: { path: config.path, side: 'head', line: findingAnchorLine },
      evidence: [{ path: evidence.path, side: 'head', sha256: evidence.sha256, startLine: evidence.startLine, endLine: evidence.endLine, quote: evidence.quote }],
    });
  }
  for (const config of WITHHELD_CONFIGS) {
    const file = fileByPath.get(config.path);
    if (!file) continue;
    if (config.missingRef) {
      const line = anchorLine(file, config.anchor);
      if (!line) continue;
      const findingId = findingIdOf(config.path, line, config.title, 'w');
      withheld.push({
        kind: 'statement', findingId, title: config.title, category: config.category,
        severity: config.severity, ruleSource: config.ruleSource, problem: config.problem,
        impact: config.impact, suggestion: config.suggestion,
        anchor: { path: config.path, side: 'head', line },
        code: 'missing-ref', reason: '说明缺少可核对的代码引用',
        evidence: [],
      });
      continue;
    }
    const evidence = buildEvidence(config, file);
    if (!evidence) continue;
    if (config.corrupt === 'quote') evidence.quote += '\n（引文已篡改）';
    if (config.corrupt === 'sha') evidence.sha256 = (evidence.sha256[0] === 'a' ? 'b' : 'a') + evidence.sha256.slice(1);
    const findingAnchorLine = config.fileLevel ? null : evidence.line;
    const error = validateEvidence(evidence, findingAnchorLine, file);
    if (!error) { console.warn(`[withheld] unexpectedly valid: ${config.path}`); continue; }
    const findingId = findingIdOf(config.path, findingAnchorLine, config.title, 'w');
    withheld.push({
      kind: 'finding', findingId, title: config.title, category: config.category,
      severity: config.severity, ruleSource: config.ruleSource, problem: config.problem,
      impact: config.impact, suggestion: config.suggestion,
      anchor: { path: config.path, side: 'head', line: findingAnchorLine },
      code: error.code, reason: error.reason,
      evidence: [{ path: evidence.path, side: 'head', sha256: evidence.sha256, startLine: evidence.startLine, endLine: evidence.endLine, quote: evidence.quote }],
    });
  }
  const severityRank = { P0: 0, P1: 1, P2: 2 };
  findings.sort((a, b) =>
    severityRank[a.severity] - severityRank[b.severity] ||
    (filesOrder.get(a.anchor.path) ?? 0) - (filesOrder.get(b.anchor.path) ?? 0) ||
    (a.anchor.line ?? Number.MAX_SAFE_INTEGER) - (b.anchor.line ?? Number.MAX_SAFE_INTEGER));
  return { findings, withheld };
}

const SEMANTICS = {
  'prototype/index.html': '演示入口：按固定顺序加载 Vue、Diff2Html、Splitpanes、本地数据、场景推导、diff 视图、DSH 外壳与根组件；不引用外部字体或脚本。',
  'prototype/README.md': '演示说明：打开方式、URL 参数、场景清单、与基线 §1.1/§1.2 的逐项差异、验证命令和已知限制。',
  'prototype/scripts/build-data.mjs': '只读 Git 快照生成器：先做 split index 预检，再枚举本仓当前改动、生成文本 diff，并叠加合成的审查说明与证据。',
  'prototype/src/app.js': 'DSH 全页评审台与对话入口的 Vue 根组件；管理场景状态、文件筛选、说明面板、运行状态、需求依据、对齐分组与导出菜单。',
  'prototype/src/diff-view.js': 'Diff 渲染与问题卡片：把问题插到变更行下，保留证据、依据、标记非问题、行号定位与单双栏。',
  'prototype/src/dsh-shell.js': 'DSH Desktop 外壳模拟：侧栏插件入口、对话流、交付区卡片与底部输入区；两个入口都触发同一个评审台。',
  'prototype/src/focus-review.js': '基线继承的文件树、图标、行号定位、上一个/下一个文件与单双栏偏好；新增沿用、跳过与证据未通过校验的状态提示。',
  'prototype/src/issues.js': '把结构化问题映射为问题卡片模型，类别为中性标签、严重度单独着色，正文使用问题/影响/建议与证据引文。',
  'prototype/src/scenarios.js': '场景派生：已有结论、部分待审、待审、未发现问题、审查不完整、增量、历史只读、运行中、取消、失败、无需求、添加需求、自动模式与前置提示。',
  'prototype/src/ui.js': '共享工具：离线内联 SVG、tooltip/message、Markdown 渲染、时间格式化与紧凑 SHA-256。',
  'prototype/styles/diff.css': 'Diff 行、问题卡片、双栏占位与定位高亮的基线样式。',
  'prototype/styles/focus-review.css': '评审台优化态的细节样式；本演示保持默认全开，不提供关闭开关。',
  'prototype/styles/markdown.css': '评审说明、问题卡片与证据代码块的 Markdown 排版。',
  'prototype/styles/plugin.css': '工具栏、文件栏、Diff 容器与过滤器的基线几何；全页布局由 shell.css 覆盖高度。',
  'prototype/styles/shell.css': 'DSH Desktop 外壳、全页评审台、说明面板、导出/设置菜单、需求依据弹窗与前置提示的样式。',
  'prototype/styles/ui.css': '基础控件、tooltip、message 与演示控制台；已移除外部字体声明，改用系统字体。',
  'prototype/tests/verify.cjs': 'Playwright 离线校验：覆盖全部场景、双入口、§1.4 两项新增、标签与对齐分组、运行状态，逐场景截图并断言无网络请求。',
  'prototype/assets/material-icons-manifest.json': '基线演示附带的 Material Icon Theme 清单，本次只随演示复制，未修改内容。',
};

const SYMBOLS = {
  'prototype/src/app.js': [['startReview', 'async startReview({'], ['toggleOverviewPanel', 'toggleOverviewPanel() {'], ['confirmRequirement', 'confirmRequirement() {']],
  'prototype/src/scenarios.js': [['buildState', 'function buildState(name, opts = {})'], ['makeRequirementSource', 'P.makeRequirementSource = function']],
  'prototype/scripts/build-data.mjs': [['collectFiles', 'function collectFiles(range, preflight)'], ['diffLines', 'function diffLines(oldText, newText)']],
  'prototype/src/diff-view.js': [['renderDiff', 'renderDiff() {'], ['createRiskMarkerElement', 'createRiskMarkerElement(issue) {']],
  'prototype/src/focus-review.js': [['fileMenuRows', 'fileMenuRows() {'], ['treeRowTip', 'treeRowTip(entry) {']],
  'prototype/src/issues.js': [['parseIssues', 'function parseIssues(item)']],
  'prototype/src/ui.js': [['sha256', 'P.sha256 = function'], ['tooltipDirective', 'P.tooltipDirective = {']],
  'prototype/src/dsh-shell.js': [['DshSidebar', 'P.DshSidebar = {'], ['DshConversation', 'P.DshConversation = {']],
  'prototype/tests/verify.cjs': [['SCENARIOS', 'const SCENARIOS'], ['assertNoNetwork', 'function assertNoNetwork']],
  'prototype/index.html': [['snapshot.js', 'data/snapshot.js']],
  'prototype/README.md': [['build-data', 'node prototype/scripts/build-data.mjs']],
  'prototype/styles/shell.css': [['wb-body', '.wb-body {'], ['review-panel', '.review-panel {']],
  'prototype/styles/plugin.css': [['file-filter-group', '.file-filter-group {']],
  'prototype/styles/ui.css': [['base font', 'font:14px/21px']],
};

function makeRef(filesByPath, filePath, anchor, lineOffset = 0) {
  const file = filesByPath.get(filePath);
  const line = anchorLine(file, anchor);
  if (!line) return null;
  const lineNumber = Math.max(1, Math.min(lineCount(file._headText), line + lineOffset));
  return { path: filePath, side: 'head', startLine: lineNumber, endLine: lineNumber };
}

function anyRef(filesByPath, filePath) {
  const file = filesByPath.get(filePath);
  if (!file) return null;
  return { path: filePath, side: 'head', startLine: null, endLine: null };
}

function semanticRefFor(filesByPath, filePath) {
  const symbol = (SYMBOLS[filePath] || [])[0];
  const ref = symbol ? makeRef(filesByPath, filePath, symbol[1]) : null;
  return ref || anyRef(filesByPath, filePath);
}

function buildUnderstanding(files, findings, requirements) {
  const filesByPath = new Map(files.map(file => [file.path, file]));
  const reviewable = files.filter(isReviewableFile);
  const unclearPaths = new Set(['prototype/assets/material-icons-manifest.json']);
  const featureDefs = [
    {
      featureId: 'feat-explanation', title: '整批说明、导出与需求依据',
      purpose: '整批说明在主区域阅读、单文件说明在下方；导出与需求依据沿用同一份审查结果。',
      approach: '工具栏切换整批说明，文件树与引用切到 Diff；文件头打开单文件说明；追加需求依据生成新快照。',
      files: ['prototype/src/app.js', 'prototype/src/scenarios.js', 'prototype/styles/shell.css', 'prototype/src/export.js'],
    },
    {
      featureId: 'feat-shell', title: '双入口与全页评审台',
      purpose: '左侧入口与对话交付卡片打开同一个全页评审台，返回路径按来源区分。',
      approach: 'DSH Desktop 外壳模拟承载侧栏与交付卡片；交付列表整卡可进入评审台。',
      files: ['prototype/src/app.js', 'prototype/src/dsh-shell.js', 'prototype/styles/shell.css'],
    },
    {
      featureId: 'feat-incremental', title: '增量沿用与运行状态',
      purpose: '沿用文件保留上次结论，运行状态只出现在 Review All 位置。',
      approach: '文件级沿用标记来源快照；排队、运行中、已取消、失败与审查不完整使用同一位置。',
      files: ['prototype/src/scenarios.js', 'prototype/src/diff-view.js', 'prototype/src/app.js'],
    },
    {
      featureId: 'feat-data', title: '本仓真实 diff 数据',
      purpose: '用本仓真实改动生成审查记录，并叠加合成审查层。',
      approach: '只读 Git 命令枚举改动并生成 diff；大文件与第三方目录只留元数据。',
      files: ['prototype/scripts/build-data.mjs', 'prototype/index.html'],
    },
    {
      featureId: 'feat-verification', title: '离线场景验证',
      purpose: '在 file:// 下逐场景验证界面与规则。',
      approach: 'Playwright 截图每个场景并断言无网络请求；入口名称固定为「变更评审」。',
      files: ['prototype/README.md'],
    },
  ];
  const features = featureDefs.map(feature => {
    const featureFiles = feature.files.filter(filePath => filesByPath.has(filePath));
    const refs = featureFiles.map(filePath => anyRef(filesByPath, filePath)).filter(Boolean).slice(0, 2);
    return { ...feature, files: featureFiles, refs, basis: 'model' };
  }).filter(feature => feature.files.length && feature.refs.length);
  const featureIdsByPath = new Map();
  for (const feature of features) {
    for (const filePath of feature.files) {
      if (!featureIdsByPath.has(filePath)) featureIdsByPath.set(filePath, []);
      featureIdsByPath.get(filePath).push(feature.featureId);
    }
  }
  const semanticItemsFor = file => {
    const unclear = unclearPaths.has(file.path);
    const symbols = (SYMBOLS[file.path] || []).map(([name, anchor]) => {
      const ref = makeRef(filesByPath, file.path, anchor);
      return ref ? { name, ref } : null;
    }).filter(Boolean);
    const refs = symbols.map(symbol => symbol.ref).filter(Boolean);
    if (unclear) {
      return { items: [{ text: '未能核对该文件的逐条语义；需要补充可核对的引用。', refs: [] }], status: 'unclear' };
    }
    const baseText = SEMANTICS[file.path] || '本次变更新增了该文件；演示数据提供通用说明，未对其内部实现做逐行模型解释。';
    const symbolText = symbols.length ? `关键符号：${symbols.map(symbol => `\`${symbol.name}\``).join('、')}。` : '';
    const fallbackRef = semanticRefFor(filesByPath, file.path);
    return {
      items: [{ text: symbolText ? `${baseText} ${symbolText}` : baseText, refs: refs.length ? refs : [fallbackRef].filter(Boolean) }],
      status: 'stated',
    };
  };
  const understandingFiles = reviewable.map(file => ({
    path: file.path,
    featureIds: featureIdsByPath.get(file.path) || [],
    semantic: semanticItemsFor(file),
    basis: 'model',
  }));
  const impacts = [
    {
      kind: 'behavior',
      text: '整批说明与文件 Diff 在主区域切换；文件树和说明中的文件、行引用会切到对应 Diff 并定位。',
      refs: [makeRef(filesByPath, 'prototype/src/app.js', 'mainView'), makeRef(filesByPath, 'prototype/src/app.js', 'jumpToRef(ref)')].filter(Boolean),
      basis: 'model',
    },
    {
      kind: 'behavior',
      text: '从交付卡片进入先看整批说明；从交付列表进入保留上次的主区域视图。',
      refs: [anyRef(filesByPath, 'prototype/src/dsh-shell.js')].filter(Boolean),
      basis: 'model',
    },
    {
      kind: 'behavior',
      text: '审查不完整状态跳到整批说明的问题与审查覆盖，便于就地查看原因。',
      refs: [makeRef(filesByPath, 'prototype/src/app.js', 'showOverviewProblems()'), makeRef(filesByPath, 'prototype/src/app.js', 'overview-problems')].filter(Boolean),
      basis: 'model',
    },
    {
      kind: 'behavior',
      text: '下方面板只承载当前文件说明，默认收起；单文件说明保持变更摘要与代码评审两段。',
      refs: [makeRef(filesByPath, 'prototype/src/app.js', 'toggleFilePanel()'), makeRef(filesByPath, 'prototype/src/app.js', 'panelMode')].filter(Boolean),
      basis: 'model',
    },
    {
      kind: 'data',
      text: '审查覆盖按合同记录已审、跳过与失败；覆盖记录不一致时按审查不完整处理。',
      refs: [makeRef(filesByPath, 'prototype/src/export.js', 'exportReview(context)'), makeRef(filesByPath, 'prototype/src/scenarios.js', 'coverageOf(files')].filter(Boolean),
      basis: 'model',
    },
    {
      kind: 'ui',
      text: '交付列表整卡可进入评审台，卡片菜单与最近会话保持独立操作。',
      refs: [anyRef(filesByPath, 'prototype/src/dsh-shell.js'), makeRef(filesByPath, 'prototype/index.html', 'doctype')].filter(Boolean),
      basis: 'model',
    },
    {
      kind: 'behavior',
      text: '沿用文件保留上次结论，运行状态只出现在 Review All 位置。',
      refs: [anyRef(filesByPath, 'prototype/src/diff-view.js')].filter(Boolean),
      basis: 'model',
    },
    {
      kind: 'data',
      text: '快照只读枚举本仓改动，二进制与第三方目录只留元数据。',
      refs: [anyRef(filesByPath, 'prototype/scripts/build-data.mjs')].filter(Boolean),
      basis: 'model',
    },
    {
      kind: 'behavior',
      text: '离线验证覆盖场景、无网络与报告图标。',
      refs: [anyRef(filesByPath, 'prototype/tests/verify.cjs')].filter(Boolean),
      basis: 'model',
    },
  ];
  const overviewHighlights = [
    {
      text: 'DSH 外壳与双入口：侧栏「变更评审」与交付卡片进入同一个全页评审台。',
      refs: [anyRef(filesByPath, 'prototype/src/dsh-shell.js'), anyRef(filesByPath, 'prototype/src/app.js')].filter(Boolean),
    },
    {
      text: '评审台保留基线的文件树、Diff、问题卡片、行号定位与标记非问题。',
      refs: [anyRef(filesByPath, 'prototype/src/diff-view.js'), anyRef(filesByPath, 'prototype/src/focus-review.js')].filter(Boolean),
    },
    {
      text: '整批说明先给结论，再按需求对齐、问题、功能、审查覆盖与需求依据展开。',
      refs: [makeRef(filesByPath, 'prototype/src/app.js', 'overview-conclusion')].filter(Boolean),
    },
  ];
  const items = requirementItemsOf(requirements);
  const alignmentPlans = [
    { match: '把现有评审台复制到本仓 prototype/', status: 'implemented', note: '演示目录已建立并保留基线资源。', refs: [anyRef(filesByPath, 'prototype/README.md')] },
    { match: '按 design.md §4 适配成 DSH 插件', status: 'partial', note: '§1.1/§1.2/§1.3 已落实，视觉细节仍待用户验收。', refs: [makeRef(filesByPath, 'prototype/src/app.js', 'review-surface evidentloop-review-surface')] },
    { match: '双入口打开同一评审台', status: 'implemented', note: '交付卡片与左侧入口进入同一全页评审台。', refs: [anyRef(filesByPath, 'prototype/src/dsh-shell.js')] },
    { match: '新增变更说明与需求依据', status: 'implemented', note: '整批/文件说明与需求依据入口均已提供。', refs: [makeRef(filesByPath, 'prototype/src/app.js', 'showOverview() {')] },
    { match: '覆盖已审、待审、运行中、增量与前置提示场景', status: 'partial', note: '场景已覆盖；自动模式与真实运行仍属后续阶段。', refs: [anyRef(filesByPath, 'prototype/src/scenarios.js')] },
    { match: '只写 prototype/，不安装、不联网、不提交', status: 'unclear', note: '由执行过程保证，代码中没有可直接引用的约束。', refs: [] },
    { match: '左侧入口名称固定为「变更评审」，不做名称切换', status: 'implemented', note: '侧栏与标题均固定为「变更评审」。', refs: [anyRef(filesByPath, 'prototype/src/dsh-shell.js')] },
    { match: '控制台不再提供入口名称对比', status: 'implemented', note: '控制台已移除入口名称选择。', refs: [makeRef(filesByPath, 'prototype/src/app.js', 'consoleVisible:')] },
  ];
  const alignment = items.map(item => {
    const plan = alignmentPlans.find(entry => item.text.includes(entry.match) || entry.match.includes(item.text));
    const codeRefs = (plan?.refs || []).filter(Boolean);
    let status = plan?.status || 'unclear';
    if ((status === 'implemented' || status === 'partial') && !codeRefs.length) status = 'unclear';
    return {
      requirementItemId: item.itemId,
      status,
      codeRefs,
      note: plan?.note || '未在本次检查范围内确认。',
      basis: 'model',
    };
  });
  const extras = [
    {
      text: '新增交付列表整卡进入、右下角「进入评审」提示与最近会话入口。',
      refs: [makeRef(filesByPath, 'prototype/src/app.js', 'delivery-card__head'), makeRef(filesByPath, 'prototype/src/app.js', 'delivery-enter')].filter(Boolean),
      basis: 'model',
    },
    {
      text: '新增整批说明主区域与下方面板分离，工具栏「变更说明」切回整批说明。',
      refs: [makeRef(filesByPath, 'prototype/src/app.js', 'overview-main'), makeRef(filesByPath, 'prototype/src/app.js', 'showOverview()')].filter(Boolean),
      basis: 'model',
    },
  ];
  return {
    overview: {
      purpose: '把现有评审台适配为 DSH 插件：新增桌面外壳与交付区入口，补齐变更说明、需求依据、沿用与运行状态，并用本仓真实 diff 生成演示数据。',
      highlights: overviewHighlights.filter(item => item.refs.length),
      requirementStatus: 'checked',
      basis: 'model',
    },
    features,
    files: understandingFiles,
    impacts,
    alignment,
    extras: extras.filter(item => item.refs.length),
  };
}

function computeInputSha(files, requirements, baseSha) {
  const identity = [...files].sort((a, b) => a.path.localeCompare(b.path)).map(file => [
    file.path, file.oldPath || null, file.change, file.kind,
    file.baseMode || null, file.headMode || null,
    file.baseSha256 || null, file.headSha256 || null,
  ]);
  return sha256(Buffer.from(JSON.stringify({
    files: identity,
    requirements: requirements.map(source => source.sha256),
    rulesVersion: RULES_VERSION,
    promptVersion: PROMPT_VERSION,
    baseSha: baseSha || null,
  })));
}

function coverageFor(files) {
  return {
    reviewed: files.filter(isReviewableFile).map(file => file.path),
    skipped: files.filter(file => !isReviewableFile(file)).map(file => ({ path: file.path, reason: skipReason(file) })),
    failed: [],
    withheld: [],
  };
}

function filterUnderstandingForPaths(understanding, allowedPaths) {
  const clone = JSON.parse(JSON.stringify(understanding));
  const features = clone.features
    .map(feature => ({
      ...feature,
      files: feature.files.filter(filePath => allowedPaths.has(filePath)),
      refs: (feature.refs || []).filter(ref => allowedPaths.has(ref.path)),
    }))
    .filter(feature => feature.files.length && feature.refs.length);
  const featureIds = new Set(features.map(feature => feature.featureId));
  clone.features = features;
  clone.files = clone.files
    .filter(file => allowedPaths.has(file.path))
    .map(file => ({
      ...file,
      featureIds: (file.featureIds || []).filter(featureId => featureIds.has(featureId)),
      semantic: {
        ...file.semantic,
        items: (file.semantic.items || []).map(item => ({
          ...item,
          refs: (item.refs || []).filter(ref => allowedPaths.has(ref.path)),
        })).filter(item => item.refs.length || file.semantic.status === 'unclear'),
      },
    }));
  clone.overview.highlights = (clone.overview.highlights || [])
    .map(highlight => ({ ...highlight, refs: (highlight.refs || []).filter(ref => allowedPaths.has(ref.path)) }))
    .filter(highlight => highlight.refs.length);
  clone.impacts = (clone.impacts || [])
    .map(impact => ({ ...impact, refs: (impact.refs || []).filter(ref => allowedPaths.has(ref.path)) }))
    .filter(impact => impact.refs.length);
  clone.alignment = (clone.alignment || []).map(item => ({
    ...item,
    codeRefs: (item.codeRefs || []).filter(ref => allowedPaths.has(ref.path)),
    status: (item.status === 'implemented' || item.status === 'partial') && !(item.codeRefs || []).some(ref => allowedPaths.has(ref.path))
      ? 'unclear' : item.status,
  }));
  clone.extras = (clone.extras || [])
    .map(extra => ({ ...extra, refs: (extra.refs || []).filter(ref => allowedPaths.has(ref.path)) }))
    .filter(extra => extra.refs.length);
  return clone;
}

function syntheticFile(path, key) {
  const oldText = `// ${key}\nconst value = '${key}-old';\nexport default value;\n`;
  const newText = `// ${key}\nconst value = '${key}-new';\nexport default value;\n`;
  const diff = unifiedDiff(path, oldText, newText);
  const stats = diffStats(diff);
  return {
    path, change: 'modified', kind: 'text',
    baseMode: '100644', headMode: '100644',
    baseSha256: sha256(oldText), headSha256: sha256(newText),
    baseLineCount: lineCount(oldText), headLineCount: lineCount(newText),
    additions: stats.additions, deletions: stats.deletions, diff,
  };
}

function syntheticBinaryFile(path, bytes) {
  return {
    path, change: 'added', kind: 'binary',
    baseMode: null, headMode: '100644',
    baseSha256: null, headSha256: sha256(Buffer.from(bytes)),
    baseLineCount: 0, headLineCount: 0,
    note: '二进制文件，仅保留元数据',
  };
}

function syntheticRenamedFile(path, oldPath, key) {
  const oldText = `// ${key}\nconst value = '${key}-old';\nexport default value;\n`;
  const newText = `// ${key}\nconst value = '${key}-new';\nexport default value;\n`;
  const diff = unifiedDiff(path, oldText, newText);
  const stats = diffStats(diff);
  return {
    path, oldPath, change: 'renamed', kind: 'text',
    baseMode: '100644', headMode: '100644',
    baseSha256: sha256(oldText), headSha256: sha256(newText),
    baseLineCount: lineCount(oldText), headLineCount: lineCount(newText),
    additions: stats.additions, deletions: stats.deletions, diff,
  };
}

function syntheticUnderstanding(purpose, featureDefs) {
  const features = featureDefs.map((definition, index) => ({
    featureId: definition.featureId || `feat-demo-${String(index + 1).padStart(2, '0')}`,
    title: definition.title, purpose: definition.purpose, approach: definition.approach,
    files: definition.files,
    refs: definition.files.map(path => ({ path, side: 'head', startLine: 2, endLine: 2 })),
    basis: 'model',
  }));
  const paths = [...new Set(features.flatMap(feature => feature.files))];
  const files = paths.map(path => ({
    path,
    featureIds: features.filter(feature => feature.files.includes(path)).map(feature => feature.featureId),
    semantic: {
      status: 'stated',
      items: [{ text: `${path} 的示例实现说明。`, refs: [{ path, side: 'head', startLine: 2, endLine: 2 }] }],
    },
    basis: 'model',
  }));
  const impacts = features.map(feature => ({
    kind: 'behavior', text: `${feature.title} 带来的示例行为影响。`,
    refs: [{ path: feature.files[0], side: 'head', startLine: 2, endLine: 2 }], basis: 'model',
  }));
  return {
    overview: { purpose, highlights: [], requirementStatus: 'no-requirement', basis: 'model' },
    features, files, impacts, alignment: [], extras: [],
  };
}

function syntheticFindings(prefix, defs) {
  return defs.map((definition, index) => {
    const quote = `const value = '${definition.key}-new';`;
    return {
      findingId: `f-${prefix}-${index}`, runId: `run-${prefix}`,
      category: definition.category || 'logic', severity: definition.severity || 'P2',
      ruleSource: { kind: 'builtin', id: definition.rule || 'logic-state-consistency' },
      title: definition.title, problem: definition.problem || definition.title,
      impact: definition.impact || '示例影响。',
      suggestion: { text: definition.suggestion || '示例建议。' },
      anchor: { path: definition.path, side: 'head', line: 2 },
      evidence: [{ path: definition.path, side: 'head', sha256: definition.sha256, startLine: 2, endLine: 2, quote }],
    };
  });
}

function makeSyntheticRecord({
  id, deliveryId, projectKey, branch, targetRef = 'main', createdAt, dirty,
  headSha, baseSha, headSubject = '', baseSubject = '',
  fileDefs, findingDefs = [], featureDefs = [], purpose, reviewedPaths, failedPaths = [], withheld = [], notice = '',
  runStatus = 'succeeded', snapshotStatus = 'complete', snapshotNote = '',
}) {
  const files = fileDefs.map(item => item.kind === 'binary'
    ? syntheticBinaryFile(item.path, item.bytes || 'BINARY')
    : item.kind === 'renamed'
      ? syntheticRenamedFile(item.path, item.oldPath, item.key)
      : syntheticFile(item.path, item.key));
  const byPath = new Map(files.map(file => [file.path, file]));
  const findings = syntheticFindings(id, findingDefs.map(definition => ({
    ...definition, sha256: byPath.get(definition.path)?.headSha256 || null,
  })));
  const reviewable = files.filter(isReviewableFile).map(file => file.path);
  const reviewed = reviewedPaths ? reviewedPaths.filter(path => reviewable.includes(path)) : reviewable;
  const coverage = {
    reviewed,
    skipped: files.filter(file => !isReviewableFile(file)).map(file => ({ path: file.path, reason: skipReason(file) })),
    failed: failedPaths.map(path => ({ path, reason: '模型输出未通过合同校验（缺少 evidence）' })),
    withheld: withheld.map(entry => ({ kind: entry.kind || 'finding', ref: entry.findingId, code: entry.code })),
  };
  const snapshot = {
    snapshotId: id, deliveryId, projectKey, createdAt: isoAt(createdAt), trigger: 'manual', status: snapshotStatus,
    range: {
      kind: 'merge-base-worktree', targetRef, targetSha: sha256('target:' + id).slice(0, 40),
      baseSha: baseSha || sha256('base:' + id).slice(0, 40), headSha: headSha || sha256('head:' + id).slice(0, 40),
      headSubject, baseSubject,
      dirty: Boolean(dirty), unborn: false, note: snapshotNote || '示例审查记录',
    },
    files, requirements: [], rulesVersion: RULES_VERSION, promptVersion: PROMPT_VERSION,
    inputSha: sha256('synthetic:' + id),
  };
  const understanding = syntheticUnderstanding(purpose, featureDefs);
  const runId = 'run-' + sha256(id + ':run').slice(0, 12);
  const run = runStatus === null ? null : {
    runId, generation: 1, snapshotId: id, scope: 'all',
    startedAt: isoAt(new Date(createdAt.getTime() - 60000)), endedAt: isoAt(createdAt),
    status: runStatus, model: MODEL, coverage,
  };
  const withheldFindings = withheld.map(entry => ({ ...entry, snapshotId: id, runId }));
  return { snapshot, understanding, run, findings, marks: [], seedAnnotations: [], coverage, withheldFindings, notice };
}

function replaceSnapshotWording(value) {
  if (typeof value === 'string') return value.replace(/快照/g, '审查记录');
  if (Array.isArray(value)) return value.map(replaceSnapshotWording);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, replaceSnapshotWording(entry)]));
  }
  return value;
}

function makeVersionRecord({ id, deliveryId, projectKey, branch, targetRef = 'main', createdAt, dirty, headSha, headSubject = '', baseSubject = '', baseFiles, mutate, removePaths = [], addedFiles = [], findingDefs, featureDefs, purpose }) {
  let files = JSON.parse(JSON.stringify(baseFiles));
  if (removePaths.length) files = files.filter(file => !removePaths.includes(file.path));
  files = files.map(file => mutate[file.path] ? { ...file, ...mutate[file.path] } : file);
  for (const file of addedFiles) if (!files.some(entry => entry.path === file.path)) files.push(JSON.parse(JSON.stringify(file)));
  const byPath = new Map(files.map(file => [file.path, file]));
  const findings = syntheticFindings(id, findingDefs.map(definition => ({
    ...definition, sha256: byPath.get(definition.path)?.headSha256 || null,
  })));
  const reviewed = files.filter(isReviewableFile).map(file => file.path);
  const coverage = {
    reviewed,
    skipped: files.filter(file => !isReviewableFile(file)).map(file => ({ path: file.path, reason: skipReason(file) })),
    failed: [], withheld: [],
  };
  const snapshot = {
    snapshotId: id, deliveryId, projectKey, createdAt: isoAt(createdAt), trigger: 'manual', status: 'complete',
    range: {
      kind: 'merge-base-worktree', targetRef, targetSha: sha256('target:' + id).slice(0, 40),
      baseSha: sha256('base:' + id).slice(0, 40), headSha: headSha || sha256('head:' + id).slice(0, 40),
      headSubject, baseSubject,
      dirty: Boolean(dirty), unborn: false, note: '示例审查记录',
    },
    files, requirements: [], rulesVersion: RULES_VERSION, promptVersion: PROMPT_VERSION,
    inputSha: sha256('synthetic:' + id),
  };
  const understanding = syntheticUnderstanding(purpose, featureDefs);
  const runId = 'run-' + sha256(id + ':run').slice(0, 12);
  const run = {
    runId, generation: 1, snapshotId: id, scope: 'all',
    startedAt: isoAt(new Date(createdAt.getTime() - 60000)), endedAt: isoAt(createdAt),
    status: 'succeeded', model: MODEL, coverage,
  };
  return { snapshot, understanding, run, findings, marks: [], seedAnnotations: [], coverage, withheldFindings: [], notice: '' };
}

function makeAnnotation({ snapshotId, file, side = 'head', startLine = null, endLine = startLine, text, findingId = null, createdAt, updatedAt = createdAt }) {
  const lineCountValue = side === 'base' ? file?.baseLineCount : file?.headLineCount;
  const sha = side === 'base' ? file?.baseSha256 : file?.headSha256;
  if (!file || file.kind !== 'text' || !sha || !Number.isInteger(lineCountValue)) {
    throw new Error(`[annotation] invalid anchor file: ${file?.path || '(missing)'}`);
  }
  if (startLine !== null && !(Number.isInteger(startLine) && Number.isInteger(endLine) && startLine >= 1 && endLine >= startLine && endLine <= lineCountValue)) {
    throw new Error(`[annotation] line out of range: ${file.path} ${side} ${startLine}-${endLine} / ${lineCountValue}`);
  }
  const normalized = String(text).replace(/\r\n/g, '\n');
  return {
    annotationId: 'ann-' + sha256(Buffer.from(snapshotId + '|' + file.path + '|' + side + '|' + startLine + '|' + normalized)).slice(0, 12),
    snapshotId,
    anchor: { path: file.path, side, startLine, endLine: startLine === null ? null : endLine, sha256: sha },
    text: normalized,
    ...(findingId ? { findingId } : {}),
    createdAt: isoAt(createdAt),
    updatedAt: isoAt(updatedAt),
  };
}

function createDemoRecords(projectKey, branch, now, currentDeliveryId, baseFiles) {
  const ago = hours => new Date(now.getTime() - hours * 60 * 60 * 1000);
  const recordPath = letter => `prototype/src/demo/record-${letter}.js`;
  const letters = ['a', 'b', 'c', 'd', 'e', 'f'];
  const appFile = baseFiles.find(file => file.path === 'prototype/src/app.js');
  const shellFile = baseFiles.find(file => file.path === 'prototype/src/dsh-shell.js');
  const uiFile = baseFiles.find(file => file.path === 'prototype/src/ui.js');
  const readmeFile = baseFiles.find(file => file.path === 'prototype/README.md');
  const withdrawnFile = syntheticFile('prototype/src/demo/withdrawn.js', 'withdrawn');
  const appVersion = (salt) => ({
    ...appFile, change: 'modified',
    baseSha256: appFile?.headSha256 || sha256('app-base'),
    headSha256: sha256('version:' + salt),
    baseLineCount: appFile?.headLineCount || 0, headLineCount: appFile?.headLineCount || 0,
    additions: appFile?.additions || 1, deletions: (appFile?.deletions || 0) + 1,
  });
  const shellVersion = (oldPath) => ({
    ...shellFile, change: 'renamed', oldPath,
    baseSha256: shellFile?.baseSha256 || sha256('shell-base'),
    headSha256: shellFile?.headSha256 || sha256('shell-head'),
    baseLineCount: shellFile?.headLineCount || 0, headLineCount: shellFile?.headLineCount || 0,
  });
  const uiVersion = (patch) => ({
    ...uiFile, ...patch,
    ...(patch.change === 'mode-changed'
      ? { baseLineCount: uiFile?.headLineCount || 0, headLineCount: uiFile?.headLineCount || 0 }
      : {}),
  });

  const sharedHead = sha256('demo-head-shared').slice(0, 40);
  const sharedSubject = 'fix(评审台): 收尾顶栏、审查记录下拉与导出结论的文案统一，并补齐演示数据与检查';
  const mergeHead = sha256('demo-head-merge').slice(0, 40);
  const mergeSubject = 'merge(dev): 合入双端调试';
  const olderTwo = makeVersionRecord({
    id: 'snap-' + sha256('demo-record-3').slice(0, 12),
    deliveryId: currentDeliveryId, projectKey, branch, createdAt: ago(5), dirty: false,
    headSha: sharedHead, headSubject: sharedSubject,
    baseFiles,
    mutate: {
      'prototype/src/app.js': appVersion('app-v1'),
      'prototype/src/dsh-shell.js': shellVersion('prototype/src/shell-legacy.js'),
      'prototype/src/ui.js': uiVersion({ change: 'added' }),
    },
    removePaths: ['prototype/src/demo/withdrawn.js'],
    findingDefs: [
      { path: 'prototype/src/app.js', key: 'app-v1', severity: 'P1', category: 'security', title: '演示：旧版本中的权限校验缺口', rule: 'security-secret-content' },
      { path: 'prototype/src/dsh-shell.js', key: 'shell-v1', severity: 'P2', title: '演示：旧版本中的状态不一致' },
    ],
    featureDefs: [
      { title: '旧版本的入口', purpose: '说明最早一版审查记录中的入口变化。', approach: '先渲染记录头部，再挂载文件列表。', files: ['prototype/src/app.js', 'prototype/src/dsh-shell.js', 'prototype/src/ui.js'] },
      { title: '旧版本的说明', purpose: '展示最早一版审查记录的范围与文件状态。', approach: '范围与文件身份来自冻结记录。', files: ['prototype/README.md', 'prototype/src/dsh-shell.js'] },
    ],
    purpose: '验证最早一版审查记录的文件身份与问题数据。',
  });
  const olderOne = makeVersionRecord({
    id: 'snap-' + sha256('demo-record-2').slice(0, 12),
    deliveryId: currentDeliveryId, projectKey, branch, createdAt: ago(3), dirty: true,
    headSha: sharedHead, headSubject: sharedSubject,
    baseFiles,
    mutate: {
      'prototype/src/app.js': appVersion('app-v2'),
      'prototype/src/dsh-shell.js': shellVersion('prototype/src/shell-entry.js'),
      'prototype/src/ui.js': uiVersion({ change: 'mode-changed', baseMode: '100644', headMode: '100755' }),
    },
    removePaths: ['prototype/src/coverage.js'],
    addedFiles: [withdrawnFile],
    findingDefs: [
      { path: 'prototype/src/app.js', key: 'app-v2', severity: 'P1', title: '演示：记录切换后仍显示旧问题' },
      { path: 'prototype/src/demo/withdrawn.js', key: 'withdrawn', severity: 'P2', title: '演示：撤回文件缺少说明' },
      { path: 'prototype/src/dsh-shell.js', key: 'shell-v2', severity: 'P2', category: 'performance', title: '演示：重复调用定位逻辑' },
    ],
    featureDefs: [
      { title: '记录切换', purpose: '在顶栏切换同一交付的审查记录。', approach: '按记录标识重新加载冻结结果。', files: ['prototype/src/app.js', 'prototype/src/dsh-shell.js', 'prototype/src/demo/withdrawn.js'] },
      { title: '记录文件清单', purpose: '让每条审查记录拥有自己的文件身份。', approach: '文件清单来自所选记录，不借用最新结果。', files: ['prototype/src/ui.js', 'prototype/README.md'] },
    ],
    purpose: '验证中间一版审查记录的文件身份与问题数据。',
  });
  if (HAS_DEMO_SOURCES) {
    const olderAnnotationFile = olderOne.snapshot.files.find(file => file.path === 'prototype/src/app.js');
    if (!olderAnnotationFile) throw new Error('[annotation seed] previous record is missing prototype/src/app.js');
    const olderAnnotationLine = diffLineOf(olderAnnotationFile, 'const preferredFiles = [');
    if (!olderAnnotationLine) throw new Error('[annotation seed] previous record line anchor is missing');
    olderOne.seedAnnotations = [makeAnnotation({
      snapshotId: olderOne.snapshot.snapshotId, file: olderAnnotationFile, side: 'head', startLine: olderAnnotationLine,
      text: '旧记录里的批注：这里的优先文件列表后续要连同测试一起更新。',
      createdAt: new Date(new Date(olderOne.snapshot.createdAt).getTime() + 6 * 60 * 1000),
    })];
    if (olderOne.seedAnnotations.length !== 1) throw new Error('[annotation seed] previous record should carry exactly one annotation');
  }
  const olderThree = makeVersionRecord({
    id: 'snap-' + sha256('demo-record-4').slice(0, 12),
    deliveryId: currentDeliveryId, projectKey, branch, createdAt: ago(7), dirty: false,
    headSha: mergeHead, headSubject: mergeSubject, baseSubject: 'chore: 双端调试前的基线',
    baseFiles,
    mutate: {
      'prototype/src/app.js': appVersion('app-v0'),
      'prototype/src/ui.js': uiVersion({ change: 'added' }),
    },
    findingDefs: [
      { path: 'prototype/src/app.js', key: 'app-v0', severity: 'P2', title: '演示：合并前的入口说明缺失' },
    ],
    featureDefs: [
      { title: '合并提交的记录', purpose: '展示合并提交在审查记录中的来源写法。', approach: '提交标题按原样保存并显示。', files: ['prototype/src/app.js', 'prototype/src/ui.js'] },
    ],
    purpose: '验证合并提交在审查记录下拉中的标题写法。',
  });
  const zero = makeSyntheticRecord({
    id: 'snap-demo-zero', deliveryId: 'del-demo-zero', projectKey, branch: 'feat/empty-state',
    createdAt: ago(72), dirty: false,
    fileDefs: [
      { path: 'prototype/src/demo/zero/summary.js', key: 'zero-summary' },
      { path: 'prototype/src/demo/zero/panel.js', key: 'zero-panel' },
      { path: 'prototype/src/demo/zero/labels.js', key: 'zero-labels' },
      { path: 'prototype/src/demo/zero/index.js', key: 'zero-index' },
      { path: 'prototype/src/demo/zero/legacy.js', oldPath: 'prototype/src/demo/zero/legacy-old.js', kind: 'renamed', key: 'zero-legacy' },
      { path: 'prototype/src/demo/zero/logo.png', kind: 'binary', bytes: 'PNG-ZERO-DEMO' },
    ],
    findingDefs: [],
    featureDefs: [
      { title: '空状态摘要', purpose: '把无问题的交付收敛为一条状态摘要。', approach: '摘要只读取审查结果，空态不显示问题数。', files: ['prototype/src/demo/zero/summary.js', 'prototype/src/demo/zero/index.js'] },
      { title: '空面板说明', purpose: '在文件面板说明无需处置的原因。', approach: '说明文案由覆盖状态生成，不补写结论。', files: ['prototype/src/demo/zero/panel.js', 'prototype/src/demo/zero/labels.js'] },
    ],
    purpose: '验证无问题交付的卡片状态与只读审查记录入口。',
  });
  const incomplete = makeSyntheticRecord({
    id: 'snap-demo-withheld', deliveryId: 'del-demo-incomplete', projectKey, branch: 'feat/withheld',
    createdAt: ago(48), dirty: false,
    fileDefs: [
      { path: 'prototype/src/demo/incomplete/api.js', key: 'incomplete-api' },
      { path: 'prototype/src/demo/incomplete/view.js', key: 'incomplete-view' },
      { path: 'prototype/src/demo/incomplete/evidence.js', key: 'incomplete-evidence' },
    ],
    reviewedPaths: ['prototype/src/demo/incomplete/api.js', 'prototype/src/demo/incomplete/view.js'],
    findingDefs: [
      { path: 'prototype/src/demo/incomplete/api.js', key: 'incomplete-api', severity: 'P1', title: '演示：未处理的失败分支' },
    ],
    featureDefs: [
      { title: '证据不足时的说明', purpose: '只展示通过校验的变更说明。', approach: '未通过校验的结论进入审查不完整。', files: ['prototype/src/demo/incomplete/api.js', 'prototype/src/demo/incomplete/view.js'] },
    ],
    withheld: [{
      kind: 'finding', findingId: 'w-demo-incomplete', title: '演示：证据引文不一致的结论',
      category: 'logic', severity: 'P2', ruleSource: { kind: 'builtin', id: 'logic-state-consistency' },
      problem: '示例问题。', impact: '示例影响。', suggestion: { text: '示例建议。' },
      anchor: { path: 'prototype/src/demo/incomplete/evidence.js', side: 'head', line: 2 },
      code: 'evidence-quote-mismatch', reason: '证据引文与该行区间文本不一致', evidence: [],
    }],
    purpose: '验证证据未通过校验时只展示通过校验的部分。',
    notice: '审查不完整：1 条结论证据未通过校验，未展示。',
  });
  const merged = makeSyntheticRecord({
    id: 'snap-demo-merged', deliveryId: 'del-demo-merged', projectKey, branch: 'feat/merged',
    createdAt: ago(120), dirty: false,
    fileDefs: [
      { path: 'prototype/src/demo/merged/entry.js', key: 'merged-entry' },
      { path: 'prototype/src/demo/merged/list.js', key: 'merged-list' },
      { path: 'prototype/src/demo/merged/readonly.js', key: 'merged-readonly' },
      { path: 'prototype/src/demo/merged/labels.js', key: 'merged-labels' },
      { path: 'prototype/src/demo/merged/index.js', key: 'merged-index' },
    ],
    findingDefs: [
      { path: 'prototype/src/demo/merged/list.js', key: 'merged-list', severity: 'P1', title: '演示：已合并记录的入口仍可处置' },
      { path: 'prototype/src/demo/merged/readonly.js', key: 'merged-readonly', severity: 'P2', title: '演示：只读提示不稳定' },
    ],
    featureDefs: [
      { title: '合并后的入口收敛', purpose: '已合并交付保留只读入口。', approach: '入口只打开记录，不提供处置。', files: ['prototype/src/demo/merged/entry.js', 'prototype/src/demo/merged/list.js'] },
      { title: '只读提示', purpose: '在只读记录中说明不可处置。', approach: '提示由交付状态推导。', files: ['prototype/src/demo/merged/readonly.js', 'prototype/src/demo/merged/labels.js', 'prototype/src/demo/merged/index.js'] },
    ],
    purpose: '验证已合并交付的只读列表与审查记录。',
  });
  return {
    records: { [olderOne.snapshot.snapshotId]: olderOne, [olderTwo.snapshot.snapshotId]: olderTwo, [olderThree.snapshot.snapshotId]: olderThree, [zero.snapshot.snapshotId]: zero, [incomplete.snapshot.snapshotId]: incomplete, [merged.snapshot.snapshotId]: merged },
    olderOne, olderTwo, olderThree, zero, incomplete, merged,
  };
}

function demoWithheldEntry(snapshotId, index, path) {
  return {
    kind: 'finding', findingId: `w-${snapshotId}-${index}`,
    title: `演示：未通过校验的结论 ${index}`,
    category: 'logic', severity: 'P2',
    ruleSource: { kind: 'builtin', id: 'logic-state-consistency' },
    problem: '示例问题。', impact: '示例影响。', suggestion: { text: '示例建议。' },
    anchor: { path, side: 'head', line: 2 },
    code: index === 1 ? 'evidence-quote-mismatch' : 'evidence-sha-mismatch',
    reason: index === 1 ? '证据引文与该行区间文本不一致' : '证据哈希与冻结文件不一致',
    evidence: [],
  };
}

function createDeliveryDemoRecords(projectKey, atIso, otherProjectKey2) {
  const records = {};
  const at = minutes => new Date(atIso(minutes));
  const defs = items => items.map((path, index) => ({ path, key: `${path.split('/').pop().replace(/\W/g, '')}-${index}` }));
  const partialPendingFiles = defs([
    'prototype/src/demo/partial/entry.js', 'prototype/src/demo/partial/list.js',
    'prototype/src/demo/partial/detail.js', 'prototype/src/demo/partial/labels.js', 'prototype/src/demo/partial/index.js',
  ]);
  const make = options => {
    const record = makeSyntheticRecord({ ...options, projectKey: options.projectKey || projectKey });
    records[record.snapshot.snapshotId] = record;
    return record;
  };
  make({
    id: 'snap-del-demo-partial-pending', deliveryId: 'del-demo-partial-pending',
    branch: 'feat/partial-pending', createdAt: at(180), dirty: false,
    headSubject: 'feat(partial): 演示部分文件待审',
    fileDefs: partialPendingFiles,
    reviewedPaths: partialPendingFiles.slice(0, 2).map(file => file.path),
    runStatus: 'partial',
    featureDefs: [{ title: '部分待审的入口', purpose: '演示部分文件待审。', approach: '只展示已完成文件的结果。', files: partialPendingFiles.map(file => file.path) }],
    purpose: '演示部分文件待审时的评审台状态。',
  });
  const failedFiles = defs(['prototype/src/demo/failed/api.js', 'prototype/src/demo/failed/view.js', 'prototype/src/demo/failed/store.js']);
  make({
    id: 'snap-del-demo-partial-failed', deliveryId: 'del-demo-partial-failed',
    branch: 'feat/partial-failed', createdAt: at(240), dirty: false,
    headSubject: 'fix(failed): 演示单个文件审查失败',
    fileDefs: failedFiles,
    failedPaths: [failedFiles[1].path],
    featureDefs: [{ title: '单文件失败', purpose: '演示单个文件审查失败。', approach: '其余文件的结果保留。', files: failedFiles.map(file => file.path) }],
    purpose: '演示单个文件审查失败时的评审台状态。',
  });
  const withheldFiles = defs(['prototype/src/demo/withheld/api.js', 'prototype/src/demo/withheld/view.js', 'prototype/src/demo/withheld/store.js']);
  make({
    id: 'snap-del-demo-withheld-only', deliveryId: 'del-demo-withheld-only',
    branch: 'feat/withheld-only', createdAt: at(270), dirty: false,
    headSubject: 'fix(evidence): 演示两条结论未通过校验',
    fileDefs: withheldFiles,
    findingDefs: [],
    withheld: [demoWithheldEntry('del-demo-withheld-only', 1, withheldFiles[0].path), demoWithheldEntry('del-demo-withheld-only', 2, withheldFiles[1].path)],
    featureDefs: [{ title: '证据未通过校验', purpose: '只展示通过校验的结论。', approach: '未通过校验的结论单独列出。', files: withheldFiles.map(file => file.path) }],
    purpose: '演示只有结论证据未通过校验时的评审台状态。',
  });
  const runFailedFiles = defs(['prototype/src/demo/run-failed/entry.js', 'prototype/src/demo/run-failed/view.js', 'prototype/src/demo/run-failed/index.js']);
  make({
    id: 'snap-del-demo-run-failed', deliveryId: 'del-demo-run-failed',
    branch: 'feat/run-failed', createdAt: at(300), dirty: false,
    headSubject: 'fix(run): 演示整次审查失败',
    fileDefs: runFailedFiles,
    reviewedPaths: [],
    runStatus: 'failed',
    featureDefs: [{ title: '整次失败', purpose: '演示整次审查失败。', approach: '不展示未通过校验的结果。', files: runFailedFiles.map(file => file.path) }],
    purpose: '演示整次审查失败时的评审台状态。',
  });
  const readFiles = defs(['prototype/src/demo/read/entry.js', 'prototype/src/demo/read/view.js', 'prototype/src/demo/read/index.js']);
  make({
    id: 'snap-del-demo-read-incomplete', deliveryId: 'del-demo-read-incomplete',
    branch: 'feat/read-incomplete', createdAt: at(360), dirty: false,
    headSubject: 'fix(read): 演示代码读取不完整',
    fileDefs: readFiles,
    snapshotStatus: 'incomplete',
    snapshotNote: '读取时代码有改动，改完后重新审查。',
    featureDefs: [{ title: '读取时代码有改动', purpose: '演示代码读取不完整。', approach: '按成因给出下一步。', files: readFiles.map(file => file.path) }],
    purpose: '演示代码读取不完整时的评审台状态。',
  });
  const multiFiles = defs(['prototype/src/demo/multi/entry.js', 'prototype/src/demo/multi/view.js', 'prototype/src/demo/multi/index.js']);
  make({
    id: 'snap-del-demo-multi', deliveryId: 'del-demo-multi',
    branch: 'feat/multi-reason', createdAt: at(420), dirty: false,
    headSubject: 'fix(multi): 演示多个未完成原因',
    fileDefs: multiFiles,
    reviewedPaths: [multiFiles[0].path],
    failedPaths: [multiFiles[1].path],
    featureDefs: [{ title: '多个原因', purpose: '演示同时存在待审与失败。', approach: '结论行按优先级逐行说明。', files: multiFiles.map(file => file.path) }],
    purpose: '演示多个原因时的评审台状态。',
  });
  const notesFiles = defs(['prototype/src/demo/notes/entry.js', 'prototype/src/demo/notes/view.js', 'prototype/src/demo/notes/index.js']);
  make({
    id: 'snap-del-demo-notes', deliveryId: 'del-demo-notes',
    branch: 'feat/notes-template', createdAt: at(480), dirty: false,
    headSubject: 'docs(notes): 演示另一个仓库的待审交付',
    fileDefs: notesFiles,
    reviewedPaths: [],
    runStatus: null,
    featureDefs: [],
    purpose: '演示另一个仓库的待审交付。',
    projectKey: sha256(Buffer.from('demo-notes repository')),
  });
  const onTargetFiles = defs(['prototype/src/demo/on-target/entry.js', 'prototype/src/demo/on-target/view.js']);
  make({
    id: 'snap-del-demo-on-target', deliveryId: 'del-demo-on-target',
    branch: 'main', targetRef: 'main', createdAt: at(540), dirty: true,
    headSha: sha256('demo-on-target-head').slice(0, 40),
    baseSha: sha256('demo-on-target-head').slice(0, 40),
    headSubject: 'fix(on-target): 目标分支上的未提交改动',
    baseSubject: 'fix(on-target): 目标分支上的未提交改动',
    fileDefs: onTargetFiles,
    featureDefs: [{ title: '目标分支上的改动', purpose: '演示只在目标分支上的未提交改动。', approach: '范围写「未提交的改动」。', files: onTargetFiles.map(file => file.path) }],
    purpose: '演示当前就在目标分支上的交付。',
  });
  const longBranchFiles = defs(['prototype/src/demo/long-branch/entry.js', 'prototype/src/demo/long-branch/view.js']);
  make({
    id: 'snap-del-demo-long-branch', deliveryId: 'del-demo-long-branch',
    branch: 'feat/topbar-record-menu-layout', createdAt: at(600), dirty: false,
    headSubject: 'feat(layout): 30 字符分支名下的顶栏排布',
    fileDefs: longBranchFiles,
    featureDefs: [{ title: '长分支名的顶栏', purpose: '演示 30 字符分支名。', approach: '范围文字不截断。', files: longBranchFiles.map(file => file.path) }],
    purpose: '演示 30 字符分支名下的顶栏布局。',
  });
  const manualArchivedFiles = defs(['prototype/src/demo/manual/entry.js', 'prototype/src/demo/manual/view.js']);
  make({
    id: 'snap-del-demo-manual-archived', deliveryId: 'del-demo-manual-archived',
    branch: 'feat/manual-archive', createdAt: at(720), dirty: false,
    headSubject: 'chore(archive): 手动归档的演示',
    fileDefs: manualArchivedFiles,
    findingDefs: [{ path: manualArchivedFiles[0].path, key: 'manual-0', severity: 'P2', title: '演示：归档前的遗留提示' }],
    featureDefs: [{ title: '手动归档', purpose: '演示用户手动归档。', approach: '归档时清除置顶。', files: manualArchivedFiles.map(file => file.path) }],
    purpose: '演示用户手动归档的交付。',
  });
  const mergedUnarchivedFiles = defs(['prototype/src/demo/merged-unarchived/entry.js', 'prototype/src/demo/merged-unarchived/view.js']);
  make({
    id: 'snap-del-demo-merged-unarchived', deliveryId: 'del-demo-merged-unarchived',
    branch: 'feat/merged-unarchived', createdAt: at(840), dirty: false,
    headSubject: 'merge(pr): 合并后取消归档',
    fileDefs: mergedUnarchivedFiles,
    featureDefs: [{ title: '合并后取消归档', purpose: '演示合并归档后又被取消。', approach: '不再自动收回。', files: mergedUnarchivedFiles.map(file => file.path) }],
    purpose: '演示合并后取消归档的交付。',
  });
  const archiveOnlyFiles = defs(['prototype/src/demo/archive-only/entry.js', 'prototype/src/demo/archive-only/view.js']);
  make({
    id: 'snap-del-demo-archive-only', deliveryId: 'del-demo-archive-only',
    branch: 'feat/archive-only', createdAt: at(900), dirty: false,
    headSubject: 'chore(archive): 只有已归档交付的工作区',
    fileDefs: archiveOnlyFiles,
    featureDefs: [{ title: '只有已归档交付', purpose: '演示空态与归档分组。', approach: '主区域写没有进行中的交付。', files: archiveOnlyFiles.map(file => file.path) }],
    purpose: '演示只有已归档交付的工作区。',
    projectKey: otherProjectKey2,
  });
  return records;
}

function main() {
  const range = resolveRange();
  const preflight = splitIndexPreflight();
  if (preflight.hit) {
    console.error(`[build-data] 停止：${preflight.reason}。split index 预检在任何读取 index 的命令之前完成，未生成快照。`);
    process.exit(2);
  }
  const files = collectFiles(range, preflight);
  range.dirty = files.length > 0 || range.unborn;
  const requirements = [
    makeRequirement({
      kind: 'session-message', origin: '对话 · 用户消息',
      capturedAt: isoAt(new Date(now.getTime() - 52 * 60 * 1000)), order: 0,
      text: '请把现有评审台复制到本仓 prototype/，按 design.md §4 适配成 DSH 插件：双入口打开同一评审台，新增变更说明与需求依据，覆盖已审、待审、运行中、增量与前置提示场景。只写 prototype/，不安装、不联网、不提交。',
      itemTexts: [
        '把现有评审台复制到本仓 prototype/',
        '按 design.md §4 适配成 DSH 插件',
        '双入口打开同一评审台',
        '新增变更说明与需求依据',
        '覆盖已审、待审、运行中、增量与前置提示场景',
        '只写 prototype/，不安装、不联网、不提交',
      ],
    }),
    makeRequirement({
      kind: 'paste', origin: '粘贴 · 需求补充',
      capturedAt: isoAt(new Date(now.getTime() - 24 * 60 * 1000)), order: 1,
      text: '左侧入口名称固定为「变更评审」，不做名称切换；控制台不再提供入口名称对比。',
      itemTexts: [
        '左侧入口名称固定为「变更评审」，不做名称切换',
        '控制台不再提供入口名称对比',
      ],
    }),
  ];
  const inputSha = computeInputSha(files, requirements, range.baseSha);
  const snapshotId = 'snap-' + inputSha.slice(0, 12);
  const createdAt = isoAt(new Date(now.getTime() - 3 * 60 * 1000));
  const projectKey = sha256(Buffer.from(fs.realpathSync(REPO_ROOT)));
  const currentDeliveryId = 'del-' + sha256(Buffer.from('delivery:' + inputSha)).slice(0, 12);
  const branch = resolveBranch() || (range.targetRef && !range.targetRef.startsWith('(') ? range.targetRef : 'main');
  const demoRecords = createDemoRecords(projectKey, branch, now, currentDeliveryId, files.map(publicFile));
  const latestBasedSha = (range.headSha || range.baseSha || '').slice(0, 7) || '—';
  const publicFiles = files.map(publicFile);
  const snapshot = {
    snapshotId,
    deliveryId: currentDeliveryId,
    projectKey,
    createdAt,
    trigger: 'manual',
    status: range.status,
    range: {
      kind: range.kind, targetRef: range.targetRef, targetSha: range.targetSha,
      baseSha: range.baseSha, headSha: range.headSha, dirty: range.dirty,
      headSubject: commitSubjectOf(range.headSha), baseSubject: commitSubjectOf(range.baseSha),
      unborn: range.unborn, note: range.note,
    },
    files: publicFiles,
    requirements,
    rulesVersion: RULES_VERSION,
    promptVersion: PROMPT_VERSION,
    inputSha,
  };
  const runId = 'run-' + sha256(Buffer.from(snapshotId + ':run')).slice(0, 12);
  const coverage = coverageFor(files);
  const run = {
    runId, generation: 1, snapshotId, scope: 'all',
    startedAt: isoAt(new Date(now.getTime() - 2 * 60 * 1000)),
    endedAt: isoAt(new Date(now.getTime() - 60 * 1000)),
    status: 'succeeded', model: MODEL, coverage,
  };
  const { findings, withheld } = buildFindings(files, runId);
  const mainWithheld = withheld.map(entry => ({ ...entry, snapshotId, runId }));
  const incompleteSnapshotId = 'snap-demo-withheld';
  const incompleteRunId = 'run-' + sha256(Buffer.from(incompleteSnapshotId + ':run')).slice(0, 12);
  const withheldForDemo = withheld.map(entry => ({ ...entry, snapshotId: incompleteSnapshotId, runId: incompleteRunId }));
  // Keep the incomplete demo record exactly as complete as its delivery summary claims.
  demoRecords.incomplete.withheldFindings = withheldForDemo.map(entry => ({ ...entry }));
  demoRecords.incomplete.coverage.withheld = withheldForDemo.map(entry => ({ kind: entry.kind || 'finding', ref: entry.findingId, code: entry.code }));
  demoRecords.incomplete.coverage.reviewed = demoRecords.incomplete.snapshot.files.filter(isReviewableFile).map(file => file.path);
  const understanding = buildUnderstanding(files, findings, requirements);
  const marked = findings.find(finding => finding.anchor.path === 'prototype/src/focus-review.js') || null;
  const marks = marked ? [{
    findingId: marked.findingId, snapshotId, suppressed: true,
    by: '用户（演示）', at: isoAt(new Date(now.getTime() - 30 * 1000)),
  }] : [];
  const annotationAt = seconds => new Date(now.getTime() + seconds * 1000);
  // Seed annotations only; every runtime read goes through CRPrototype.annotations.list().
  const annotations = [];
  if (HAS_DEMO_SOURCES) {
    const appAnnotationFile = files.find(file => file.path === 'prototype/src/app.js');
    const scenariosAnnotationFile = files.find(file => file.path === 'prototype/src/scenarios.js');
    const markedAnnotationFile = marked ? files.find(file => file.path === marked.anchor.path) : null;
    if (!appAnnotationFile || !scenariosAnnotationFile || !marked || !marked.anchor.line || !markedAnnotationFile) {
      throw new Error('[annotation seed] demo anchor files or the suppressed finding are missing');
    }
    const appAnnotationLine = anchorLine(appAnnotationFile, "async startReview({ scope = 'all', file = null, force = false } = {})");
    const scenariosAnnotationLine = anchorLine(scenariosAnnotationFile, 'function buildState(name, opts = {})');
    if (!appAnnotationLine || !scenariosAnnotationLine) {
      throw new Error('[annotation seed] demo line anchors are missing');
    }
    annotations.push(makeAnnotation({
      snapshotId, file: appAnnotationFile, side: 'head', startLine: appAnnotationLine, endLine: appAnnotationLine,
      text: '这里先保留当前文件的结果，其他文件的结果不要清空。',
      createdAt: annotationAt(-20),
    }));
    annotations.push(makeAnnotation({
      snapshotId, file: scenariosAnnotationFile, side: 'head', startLine: scenariosAnnotationLine, endLine: scenariosAnnotationLine,
      text: '场景切换后请重新绑定问题与处置记录，避免沿用指向旧审查记录。',
      createdAt: annotationAt(-10),
    }));
    annotations.push(makeAnnotation({
      snapshotId, file: markedAnnotationFile, side: marked.anchor.side, startLine: marked.anchor.line,
      endLine: marked.anchor.line, findingId: marked.findingId,
      text: '这个先不处理；后续若要提示，统一放在设置里说明。',
      createdAt: annotationAt(0),
    }));
    const linkedAnnotation = annotations.find(annotation => annotation.findingId === marked.findingId);
    if (annotations.length !== 3 || !linkedAnnotation || !marks.some(mark => mark.findingId === marked.findingId && mark.suppressed)) {
      throw new Error('[annotation seed] expected two line annotations plus one annotation on the suppressed finding');
    }
  }
  const activeFindings = findings.filter(finding => !marks.some(mark => mark.findingId === finding.findingId));
  const highestSeverity = ['P0', 'P1', 'P2'].find(severity =>
    activeFindings.some(finding => finding.severity === severity)) || null;
  const requirementPending = understanding.alignment.filter(item => item.status !== 'implemented').length;
  const sessions = [
    { sessionId: 'sess-prototype', projectKey, title: '接入 EvidentLoop 变更评审', kind: 'dev', updatedAt: isoAt(new Date(now.getTime() - 60 * 60 * 1000)) },
    { sessionId: 'sess-prototype-child', projectKey, title: '接入 EvidentLoop 变更评审 · 子代理', kind: 'dev', parentSessionId: 'sess-prototype', updatedAt: isoAt(new Date(now.getTime() - 30 * 60 * 1000)) },
    { sessionId: 'sess-prototype-alt', projectKey, title: '接入 EvidentLoop 变更评审 · 备用会话', kind: 'dev', updatedAt: isoAt(new Date(now.getTime() - 90 * 60 * 1000)) },
    { sessionId: 'sess-review-demo', projectKey, title: '评审本次变更', kind: 'review', updatedAt: isoAt(new Date(now.getTime() - 10 * 60 * 1000)) },
    { sessionId: 'sess-zero', projectKey, title: '收敛空状态交付', kind: 'dev', updatedAt: isoAt(new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000)) },
    { sessionId: 'sess-archived', projectKey, title: '导出模板整理（旧）', kind: 'dev', archived: true, updatedAt: isoAt(new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000)) },
  ];
  const zeroAt = new Date(demoRecords.zero.snapshot.createdAt);
  const incompleteAt = new Date(demoRecords.incomplete.snapshot.createdAt);
  const mergedAt = new Date(demoRecords.merged.snapshot.createdAt);
  const recordEntry = (record, { mode, sessionId = null, basedSha, dirty, findingCount }) => {
    const snap = record.snapshot;
    const reviewable = snap.files.filter(isReviewableFile).map(file => file.path);
    const reviewed = new Set(record.coverage?.reviewed || []);
    const pendingCount = reviewable.filter(filePath => !reviewed.has(filePath)).length;
    const failedCount = (record.coverage?.failed || []).length;
    const withheldCount = (record.withheldFindings || []).length;
    const markMap = new Map((record.marks || []).filter(mark => mark.suppressed).map(mark => [mark.findingId, mark]));
    const activeFindings = (record.findings || []).filter(finding => !markMap.has(finding.findingId));
    const complete = Boolean(snap.status === 'complete' && record.run?.status === 'succeeded' &&
      !pendingCount && !failedCount && !withheldCount);
    return {
      snapshotId: snap.snapshotId, createdAt: snap.createdAt, mode,
      basedSha: basedSha || String(snap.range.headSha || '').slice(0, 7) || '—',
      dirty: Boolean(dirty), findingCount: findingCount ?? activeFindings.length, sessionId,
      headSha: snap.range.headSha || '', baseSha: snap.range.baseSha || '',
      headSubject: snap.range.headSubject || '', baseSubject: snap.range.baseSubject || '',
      targetRef: snap.range.targetRef || '',
      runStatus: record.run?.status || null,
      snapshotStatus: snap.status,
      pendingCount, failedCount, withheldCount,
      validFindingCount: activeFindings.length,
      highestSeverity: ['P0', 'P1', 'P2'].find(severity => activeFindings.some(finding => finding.severity === severity)) || null,
      complete,
    };
  };
  const highestOf = list => ['P0', 'P1', 'P2'].find(severity => list.some(finding => finding.severity === severity)) || null;
  const currentDelivery = {
    deliveryId: currentDeliveryId, projectKey,
    bindKey: { kind: 'branch', value: branch },
    title: 'P1 变更评审适配', titleSource: 'branch', externalRef: '',
    branch, sessionIds: ['sess-prototype', 'sess-prototype-child', 'sess-prototype-alt'],
    purpose: understanding.overview.purpose,
    createdAt, latestSnapshotId: snapshotId, everAhead: true, snapshots: [
      recordEntry({ snapshot, findings, marks, run, coverage, withheldFindings: mainWithheld }, { mode: 'reviewed', basedSha: latestBasedSha, dirty: snapshot.range.dirty, sessionId: 'sess-prototype' }),
      recordEntry(demoRecords.olderOne, { mode: 'history', sessionId: 'sess-deleted', dirty: true, findingCount: demoRecords.olderOne.findings.length }),
      recordEntry(demoRecords.olderTwo, { mode: 'history', sessionId: 'sess-prototype', dirty: false, findingCount: demoRecords.olderTwo.findings.length }),
      recordEntry(demoRecords.olderThree, { mode: 'history', sessionId: 'sess-prototype', dirty: false, findingCount: demoRecords.olderThree.findings.length }),
    ],
    latest: {
      status: 'issues', validFindingCount: activeFindings.length, highestSeverity, requirementPending,
      complete: false, runStatus: 'succeeded', snapshotStatus: 'complete',
      pendingCount: 0, failedCount: 0, withheldCount: mainWithheld.length,
      createdAt,
    },
  };
  const zeroDelivery = {
    deliveryId: 'del-demo-zero', projectKey,
    bindKey: { kind: 'branch', value: 'feat/empty-state' },
    title: '空状态示例', titleSource: 'requirement', externalRef: 'REQ-1042',
    branch: 'feat/empty-state', sessionIds: ['sess-zero'],
    purpose: demoRecords.zero.understanding.overview.purpose,
    createdAt: demoRecords.zero.snapshot.createdAt, latestSnapshotId: demoRecords.zero.snapshot.snapshotId, everAhead: true,
    pinnedAt: isoAt(new Date(now.getTime() - 90 * 60 * 1000)),
    snapshots: [recordEntry(demoRecords.zero, { mode: 'zero', sessionId: 'sess-zero', dirty: false, findingCount: 0 })],
    latest: { status: 'zero', validFindingCount: 0, highestSeverity: null, requirementPending: 0, complete: true, runStatus: 'succeeded', snapshotStatus: 'complete', pendingCount: 0, failedCount: 0, withheldCount: 0, createdAt: demoRecords.zero.snapshot.createdAt },
    synthetic: true,
  };
  const incompleteDelivery = {
    deliveryId: 'del-demo-incomplete', projectKey,
    bindKey: { kind: 'branch', value: 'feat/withheld' },
    title: '证据待复核示例', titleSource: 'requirement', externalRef: 'REQ-1043',
    branch: 'feat/withheld', sessionIds: [],
    purpose: demoRecords.incomplete.understanding.overview.purpose,
    createdAt: demoRecords.incomplete.snapshot.createdAt, latestSnapshotId: demoRecords.incomplete.snapshot.snapshotId, everAhead: true,
    snapshots: [recordEntry(demoRecords.incomplete, { mode: 'incomplete', dirty: false, findingCount: demoRecords.incomplete.findings.length })],
    latest: {
      status: 'incomplete', validFindingCount: demoRecords.incomplete.findings.length,
      highestSeverity: highestOf(demoRecords.incomplete.findings),
      requirementPending: 0, complete: false, runStatus: 'succeeded', snapshotStatus: 'complete',
      pendingCount: 0, failedCount: 0, withheldCount: withheldForDemo.length,
      createdAt: demoRecords.incomplete.snapshot.createdAt,
    },
    synthetic: true,
  };
  const mergedDelivery = {
    deliveryId: 'del-demo-merged', projectKey,
    bindKey: { kind: 'branch', value: 'feat/merged' },
    title: '已合并交付示例', titleSource: 'requirement', externalRef: 'REQ-1038',
    branch: 'feat/merged', sessionIds: ['sess-deleted'],
    purpose: demoRecords.merged.understanding.overview.purpose,
    createdAt: demoRecords.merged.snapshot.createdAt, latestSnapshotId: demoRecords.merged.snapshot.snapshotId, everAhead: true,
    snapshots: [recordEntry(demoRecords.merged, { mode: 'reviewed', dirty: false, findingCount: demoRecords.merged.findings.length })],
    latest: {
      status: 'issues', validFindingCount: demoRecords.merged.findings.length,
      highestSeverity: highestOf(demoRecords.merged.findings),
      requirementPending: 0, complete: true, runStatus: 'succeeded', snapshotStatus: 'complete',
      pendingCount: 0, failedCount: 0, withheldCount: 0,
      createdAt: demoRecords.merged.snapshot.createdAt,
    },
    closedAt: isoAt(new Date(mergedAt.getTime() + 24 * 60 * 60 * 1000)),
    synthetic: true,
  };
  const otherProjectKey = sha256(Buffer.from('demo-notes repository'));
  const otherProjectKey2 = sha256(Buffer.from('demo-archive repository'));
  const at = minutes => isoAt(new Date(now.getTime() - minutes * 60 * 1000));
  const demoDelivery = ({ id, title, branch, status, latest, sessionIds = [], project = projectKey, offset, purpose = '', externalRef = '', pinnedAt = '', archivedAt, closedAt = '' }) => ({
    deliveryId: id, projectKey: project,
    bindKey: { kind: 'branch', value: branch },
    title, titleSource: 'branch', externalRef,
    branch, sessionIds,
    purpose, pinnedAt, ...(archivedAt === undefined ? {} : { archivedAt }), ...(closedAt ? { closedAt } : {}),
    createdAt: at(offset), latestSnapshotId: 'snap-' + id, everAhead: true,
    snapshots: [],
    latest: { status, validFindingCount: 0, highestSeverity: null, requirementPending: 0, complete: false, ...latest, createdAt: at(offset) },
    synthetic: true,
  });
  const demoDeliveries = [
    demoDelivery({
      id: 'del-demo-partial-pending', title: '演示：部分待审', branch: 'feat/partial-pending',
      status: 'partial', offset: 180, sessionIds: ['sess-archived'], pinnedAt: at(150),
      purpose: '演示部分文件待审时的列表胶囊与卡片状态。',
      latest: { runStatus: 'partial', snapshotStatus: 'complete', pendingCount: 3, failedCount: 0, withheldCount: 0 },
    }),
    demoDelivery({
      id: 'del-demo-partial-failed', title: '演示：部分文件失败', branch: 'feat/partial-failed',
      status: 'incomplete', offset: 240,
      purpose: '演示单个文件审查失败时的列表状态。',
      latest: { runStatus: 'succeeded', snapshotStatus: 'complete', pendingCount: 0, failedCount: 1, withheldCount: 0 },
    }),
    demoDelivery({
      id: 'del-demo-withheld-only', title: '演示：证据未通过校验', branch: 'feat/withheld-only',
      status: 'incomplete', offset: 270,
      purpose: '演示只有结论证据未通过校验的列表状态。',
      latest: { runStatus: 'succeeded', snapshotStatus: 'complete', pendingCount: 0, failedCount: 0, withheldCount: 2 },
    }),
    demoDelivery({
      id: 'del-demo-run-failed', title: '演示：整次失败', branch: 'feat/run-failed',
      status: 'failed', offset: 300,
      purpose: '演示整次审查失败时的列表状态。',
      latest: { runStatus: 'failed', snapshotStatus: 'complete', pendingCount: 0, failedCount: 0, withheldCount: 0 },
    }),
    demoDelivery({
      id: 'del-demo-read-incomplete', title: '演示：代码读取不完整', branch: 'feat/read-incomplete',
      status: 'incomplete', offset: 360,
      purpose: '演示代码读取不完整时的列表状态。',
      latest: {
        runStatus: 'succeeded', snapshotStatus: 'incomplete', codeReadReason: 'changed-during-read',
        pendingCount: 0, failedCount: 0, withheldCount: 0,
      },
    }),
    demoDelivery({
      id: 'del-demo-multi', title: '演示：多个原因', branch: 'feat/multi-reason',
      status: 'incomplete', offset: 420,
      purpose: '演示同时存在多个未完成原因时的列表状态。',
      latest: { runStatus: 'succeeded', snapshotStatus: 'complete', pendingCount: 1, failedCount: 1, withheldCount: 0 },
    }),
    demoDelivery({
      id: 'del-demo-notes', title: '演示：需求模板整理', branch: 'feat/notes-template',
      project: otherProjectKey, status: 'pending', offset: 480, externalRef: 'REQ-2001',
      purpose: '演示另一个仓库的待审交付。',
      latest: { runStatus: null, snapshotStatus: 'complete', pendingCount: 3, failedCount: 0, withheldCount: 0 },
    }),
    demoDelivery({
      id: 'del-demo-on-target', title: '演示：目标分支上的改动', branch: 'main',
      status: 'issues', offset: 540,
      purpose: '演示当前就在目标分支上的交付：范围写「未提交的改动」。',
      latest: { runStatus: 'succeeded', snapshotStatus: 'complete', pendingCount: 0, failedCount: 0, withheldCount: 0 },
    }),
    demoDelivery({
      id: 'del-demo-long-branch', title: '演示：长分支名', branch: 'feat/topbar-record-menu-layout',
      status: 'issues', offset: 600,
      purpose: '演示 30 字符分支名下的顶栏布局。',
      latest: { runStatus: 'succeeded', snapshotStatus: 'complete', pendingCount: 0, failedCount: 0, withheldCount: 0 },
    }),
    demoDelivery({
      id: 'del-demo-manual-archived', title: '演示：手动归档', branch: 'feat/manual-archive',
      status: 'issues', offset: 720, archivedAt: at(700),
      purpose: '演示用户手动归档的交付，默认折叠在已归档分组。',
      latest: { runStatus: 'succeeded', snapshotStatus: 'complete', pendingCount: 0, failedCount: 0, withheldCount: 0 },
    }),
    demoDelivery({
      id: 'del-demo-merged-unarchived', title: '演示：合并后取消归档', branch: 'feat/merged-unarchived',
      status: 'zero', offset: 840, closedAt: at(820), archivedAt: '',
      purpose: '演示合并后自动归档、又被取消归档的交付；留在进行中列表。',
      latest: { runStatus: 'succeeded', snapshotStatus: 'complete', pendingCount: 0, failedCount: 0, withheldCount: 0 },
    }),
    demoDelivery({
      id: 'del-demo-archive-only', title: '演示：只有已归档交付', branch: 'feat/archive-only',
      project: otherProjectKey2, status: 'zero', offset: 900, archivedAt: at(880),
      purpose: '演示只有已归档交付的工作区。',
      latest: { runStatus: 'succeeded', snapshotStatus: 'complete', pendingCount: 0, failedCount: 0, withheldCount: 0 },
    }),
  ];
  const deliveryDemoRecords = createDeliveryDemoRecords(projectKey, at, otherProjectKey2);
  for (const delivery of demoDeliveries) {
    const record = deliveryDemoRecords['snap-' + delivery.deliveryId];
    if (!record) continue;
    const entry = recordEntry(record, { mode: 'reviewed', sessionId: delivery.sessionIds[0] || null, dirty: record.snapshot.range.dirty });
    entry.mode = entry.complete ? 'reviewed' : 'incomplete';
    delivery.latestSnapshotId = record.snapshot.snapshotId;
    delivery.snapshots = [entry];
    delivery.latest = {
      ...delivery.latest,
      validFindingCount: entry.validFindingCount, highestSeverity: entry.highestSeverity,
      complete: entry.complete, runStatus: entry.runStatus, snapshotStatus: entry.snapshotStatus,
      pendingCount: entry.pendingCount, failedCount: entry.failedCount, withheldCount: entry.withheldCount,
    };
  }
  const workspaces = [
    { workspaceId: 'ws-demo-app', name: 'demo-app', path: '.', repoKey: projectKey, repoName: 'demo-app' },
    { workspaceId: 'ws-demo-app-prototype', name: 'prototype', path: 'prototype', repoKey: projectKey, repoName: 'demo-app' },
    { workspaceId: 'ws-demo-notes', name: 'demo-notes', path: '~/demo/demo-notes', repoKey: otherProjectKey, repoName: 'demo-notes' },
    { workspaceId: 'ws-demo-archive', name: 'demo-archive', path: '~/demo/demo-archive', repoKey: otherProjectKey2, repoName: 'demo-archive' },
    { workspaceId: 'ws-scratch', name: 'scratch', path: '~/demo/scratch', repoKey: '', repoName: '' },
  ];
  const deliveries = [currentDelivery, zeroDelivery, incompleteDelivery, mergedDelivery, ...demoDeliveries];
  const data = replaceSnapshotWording({
    meta: {
      generatedAt: isoAt(now),
      generator: 'prototype/scripts/build-data.mjs',
      baseline: range.unborn ? 'unborn HEAD → empty tree 4b825dc; head side is the working tree'
        : `merge-base ${range.baseSha || 'unresolved'} → working tree`,
      repoRoot: '.',
      repoRootSanitized: true,
      rulesVersion: RULES_VERSION,
      promptVersion: PROMPT_VERSION,
      ruleSources: RULE_SOURCES,
      syntheticReview: true,
      exclusions: {
        omitted: OMIT_PREFIXES,
        excludedPrefixes: EXCLUDED_PREFIXES.map(rule => ({ prefix: rule.prefix, note: rule.note })),
        sensitivePatterns: SENSITIVE_PATTERNS.map(pattern => String(pattern)),
        sizeLimitBytes: SIZE_LIMIT,
      },
      notes: [
        '真实 diff 来自本仓的只读枚举；审查说明、问题、证据与更早的审查记录为示例结果。',
        '合成交付与更早的审查记录使用演示文件，文件清单、功能说明与引用取自各自记录。',
        '已提交改名检测、clean/process 过滤器与 LFS 检测尚未实现。',
      ],
    },
    project: {
      projectKey,
      displayName: 'demo-app',
      repoRoot: '.',
    },
    workspaces,
    currentWorkspaceId: 'ws-demo-app',
    deliveries,
    sessions,
    snapshot,
    understanding,
    run,
    findings,
    marks,
    seedAnnotations: annotations,
    withheldFindings: [...mainWithheld, ...withheldForDemo],
    records: { ...demoRecords.records, ...deliveryDemoRecords },
    history: {
      snapshot: demoRecords.olderOne.snapshot,
      understanding: demoRecords.olderOne.understanding,
      run: demoRecords.olderOne.run,
      findings: demoRecords.olderOne.findings,
      marks: demoRecords.olderOne.marks,
      seedAnnotations: demoRecords.olderOne.seedAnnotations,
      withheldFindings: demoRecords.olderOne.withheldFindings,
    },
  });
  fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
  const banner = `// Generated by prototype/scripts/build-data.mjs. Do not edit by hand.\n// Real Git snapshot of this repository + synthetic review layer; no internal company data.\n`;
  fs.writeFileSync(OUT_FILE, banner + 'window.CR_PROTOTYPE_DATA = ' + JSON.stringify(data, null, 2) + ';\n');
  console.log(JSON.stringify({
    output: path.relative(REPO_ROOT, OUT_FILE),
    files: files.length,
    reviewable: coverage.reviewed.length,
    skipped: coverage.skipped.length,
    findings: findings.length,
    withheld: withheld.length,
    unborn: range.unborn,
    status: range.status,
  }, null, 2));
}

try {
  main();
} catch (error) {
  console.error('[build-data] ' + error.message);
  process.exitCode = 1;
}
