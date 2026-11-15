/* Run: node tests/verify.cjs <installed-playwright-module> <screenshot-directory>
 * Opens the prototype offline via file://, walks every scenario, screenshots each,
 * and asserts the P1 interface rules. No packages are installed and no network is used.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const crypto = require('node:crypto');
const path = require('node:path');
const { execFileSync, spawnSync } = require('node:child_process');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.argv[2] || 'playwright');
const output = process.argv[3];
if (!output) throw new Error('Pass a screenshot directory as the second argument.');
fs.mkdirSync(output, { recursive: true });

const RAW_TOTAL_TIMEOUT = process.env.VERIFY_TOTAL_TIMEOUT_MS;
const TOTAL_TIMEOUT_MS = RAW_TOTAL_TIMEOUT === undefined ? 15 * 60 * 1000 : Number(RAW_TOTAL_TIMEOUT);
if (!Number.isFinite(TOTAL_TIMEOUT_MS) || TOTAL_TIMEOUT_MS <= 0) {
  console.error(`CONFIG ERROR: VERIFY_TOTAL_TIMEOUT_MS must be a finite positive number, got "${RAW_TOTAL_TIMEOUT}"`);
  process.exit(2);
}
const DEFAULT_ACTION_TIMEOUT_MS = 12000;
const CLEANUP_TIMEOUT_MS = Number(process.env.VERIFY_CLEANUP_TIMEOUT_MS) > 0
  ? Number(process.env.VERIFY_CLEANUP_TIMEOUT_MS)
  : 5000;
const FAULT = process.env.VERIFY_FAULT || '';
const logFile = path.join(output, 'verify.log');
fs.writeFileSync(logFile, '');
function logLine(line = '') {
  const text = String(line);
  console.log(text);
  try { fs.appendFileSync(logFile, text + '\n'); } catch { /* the log file is best-effort */ }
}

const url = pathToFileURL(path.resolve(__dirname, '../index.html')).href;
const snapshotPath = path.resolve(__dirname, '../data/snapshot.js');
const snapshotMtime = fs.statSync(snapshotPath).mtimeMs;
const SCENARIOS = [
  'list', 'list-empty', 'list-history',
  'reviewed', 'partial', 'unreviewed', 'zero', 'incomplete', 'incremental', 'history', 'records',
  'running', 'cancelled', 'failed', 'no-requirement', 'added-requirement',
  'sendback-draft', 'sendback-no-session',
  'extension-none', 'extension-configured', 'extension-changed',
  'auto-on', 'auto-off',
  'preflight-not-git', 'preflight-no-target', 'preflight-no-model', 'preflight-split-index',
];
const RAW_ONLY = process.env.VERIFY_ONLY;
const ONLY = (() => {
  if (RAW_ONLY === undefined) return null;
  const names = RAW_ONLY.split(',').map(name => name.trim()).filter(Boolean);
  const invalid = names.filter(name => !SCENARIOS.includes(name));
  if (!names.length || invalid.length) {
    console.error(`CONFIG ERROR: VERIFY_ONLY must list scenario names separated by commas${invalid.length ? `; unknown: ${invalid.join(', ')}` : '; got an empty list'}. Known scenarios: ${SCENARIOS.join(', ')}`);
    process.exit(2);
  }
  return new Set(names);
})();
const selectedScenarios = ONLY === null ? SCENARIOS : SCENARIOS.filter(name => ONLY.has(name));
// A section runs when the selection is empty (full run) or lists one of its scenarios.
const scoped = (...names) => ONLY === null || names.some(name => ONLY.has(name));
const SCREENSHOTS = [];
const executedScenarios = new Set();
const results = [], errors = [], requests = new Set(), failedRequests = [], sockets = [];
const PROTOTYPE_WORD = '\u539f\u578b';
const UNCOMPUTED_WORD = '\u672a\u8ba1\u7b97';

function assertBrandPaletteInSource() {
  const root = path.resolve(__dirname, '..');
  const files = [path.join(root, 'index.html'), ...['src','styles'].flatMap(dir => fs.readdirSync(path.join(root, dir)).map(name => path.join(root, dir, name)))].filter(file => /\.(js|css|html)$/.test(file));
  const offenders = files.filter(file => /#(?:6754c8|b5a4f2|5946b7|c8baff|eeeafe|f6f3ff)\b|rgba\((?:103,\s*84,\s*200|181,\s*164,\s*242),/i.test(fs.readFileSync(file, 'utf8')));
  assert.deepEqual(offenders, [], 'Retired brand palette found');
  const tokens = fs.readFileSync(path.join(root, 'styles/tokens.css'), 'utf8');
  assert.match(tokens, /--el-brand: var\(--dsw-alias-state-business-primary, #4176e6\)/);
  assert.match(tokens, /--el-brand-link: var\(--dsw-static-deepseek-600, #4868b2\)/);
  assert.match(tokens, /--d2h-info-bg-color: var\(--el-bg-l3\)/);
  return files.length;
}

function assertNoNetwork() {
  const remote = [...requests].filter(request => /^https?:/i.test(request));
  assert.equal(remote.length, 0, 'No http(s) requests: ' + remote.join(', '));
  assert.equal(sockets.length, 0, 'No WebSocket connections: ' + sockets.join(', '));
  assert.equal(
    failedRequests.filter(request => /^https?:/i.test(request)).length, 0,
    'No failed http(s) requests: ' + failedRequests.join(', '),
  );
  return remote.length;
}

const SENSITIVE_PATTERNS = [
  { name: 'absolute user path', regex: /\/Users\/[A-Za-z0-9._-]+/g },
  { name: 'home path', regex: /\/home\/[A-Za-z0-9._-]+/g },
  { name: 'email', regex: /[A-Za-z0-9._%+-]+@[A-Za-z][A-Za-z0-9.-]*\.[A-Za-z]{2,}/g, allow: /@(?:example\.(?:com|org|net)|localhost)$/i },
  { name: 'phone number', regex: /\b1[3-9]\d{9}\b/g },
  { name: 'secret format', regex: /\b(?:sk-[A-Za-z0-9_-]{16,}|gh[pousr]_[A-Za-z0-9]{20,}|AKIA[0-9A-Z]{16})\b/g },
];

function sensitiveOffenders(text) {
  const found = [];
  for (const pattern of SENSITIVE_PATTERNS) {
    pattern.regex.lastIndex = 0;
    for (const match of String(text || '').matchAll(pattern.regex)) {
      if (pattern.allow && pattern.allow.test(match[0])) continue;
      found.push(pattern.name);
      break;
    }
  }
  return found;
}

function internalAssetOffenders(text, relative, allowed = new Set()) {
  return sensitiveOffenders(text).map(name => `${relative}: ${name}`);
}

function assertNoInternalAssets() {
  const root = path.resolve(__dirname, '..');
  const offenders = [];
  let scanned = 0;
  const walk = directory => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === 'vendor' || entry.name === '.git' || entry.name === 'node_modules') continue;
        walk(file); continue;
      }
      const buffer = fs.readFileSync(file);
      if (buffer.includes(0)) continue;
      const text = buffer.toString('utf8');
      scanned++;
      offenders.push(...internalAssetOffenders(text, path.relative(root, file)));
    }
  };
  walk(root);
  assert.deepEqual(offenders, [], 'Sensitive asset text found: ' + offenders.join(', '));
  return scanned;
}

function loadPrivateDenylistConfig() {
  const configured = process.env.EVIDENTLOOP_PRIVATE_DENYLIST;
  if (configured === undefined) return { enabled: false, rules: [], source: '' };
  const requested = String(configured).trim();
  if (!requested) return { error: 'EVIDENTLOOP_PRIVATE_DENYLIST is empty' };
  const file = requested.startsWith('~') ? path.join(process.env.HOME || '', requested.slice(1)) : requested;
  let raw = '';
  try { raw = fs.readFileSync(file, 'utf8'); } catch { return { error: `private denylist is not readable: ${file}` }; }
  const rules = [];
  const lines = raw.split(/\r?\n/);
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index].trim();
    if (!line || line.startsWith('#')) continue;
    try { rules.push({ index: rules.length + 1, pattern: new RegExp(line, 'i'), sourceLine: index + 1 }); }
    catch { return { error: `private denylist rule ${index + 1} is not a valid regular expression` }; }
  }
  if (!rules.length) return { error: 'private denylist has no effective rules' };
  return { enabled: true, rules, source: file };
}

function privateTextOffenders(text, config) {
  if (!config.enabled) return [];
  const hits = [];
  for (const rule of config.rules) {
    rule.pattern.lastIndex = 0;
    if (rule.pattern.test(String(text || ''))) hits.push(rule.index);
  }
  return hits;
}

function privateValueOffenders(value, config, trail = 'root') {
  if (!config.enabled) return [];
  const hits = [];
  const visit = (entry, where) => {
    if (typeof entry === 'string') { for (const rule of privateTextOffenders(entry, config)) hits.push({ rule, where }); return; }
    if (Array.isArray(entry)) { entry.forEach((item, index) => visit(item, `${where}[${index}]`)); return; }
    if (entry && typeof entry === 'object') {
      for (const [key, item] of Object.entries(entry)) {
        for (const rule of privateTextOffenders(key, config)) hits.push({ rule, where: `${where}.${key}` });
        visit(item, `${where}.${key}`);
      }
    }
  };
  visit(value, trail);
  return hits;
}

function privateAssetScan(roots, config) {
  if (!config.enabled) return { scanned: 0, hits: [] };
  let scanned = 0;
  const hits = [];
  const walk = directory => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) { walk(file); continue; }
      const buffer = fs.readFileSync(file);
      if (buffer.includes(0)) continue;
      const text = buffer.toString('utf8');
      scanned++;
      for (const rule of privateTextOffenders(text, config)) hits.push({ file: path.relative(path.resolve(__dirname, '..', '..'), file), rule });
    }
  };
  for (const root of roots) { if (fs.existsSync(root)) walk(root); }
  return { scanned, hits };
}

function readSnapshotInputSha(file = path.resolve(__dirname, '../data/snapshot.js')) {
  const text = fs.readFileSync(file, 'utf8');
  const match = text.match(/window\.CR_PROTOTYPE_DATA = ([\s\S]*);\s*$/);
  return JSON.parse(match[1]).snapshot.inputSha;
}

function listRepositoryFiles(root) {
  const files = [];
  const walk = directory => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const file = path.join(directory, entry.name);
      if (entry.isSymbolicLink()) { files.push(path.relative(root, file)); continue; }
      if (entry.isDirectory()) walk(file);
      else files.push(path.relative(root, file));
    }
  };
  walk(root);
  return files;
}

function fileDigests(root) {
  const digests = {};
  for (const file of listRepositoryFiles(root)) {
    if (file.startsWith('.git/') || file === 'prototype/data/snapshot.js') continue;
    digests[file] = crypto.createHash('sha256').update(fs.readFileSync(path.join(root, file))).digest('hex');
  }
  return digests;
}

const REPO_ROOT = path.resolve(__dirname, '../..');
// The main brain edits these coordination directories in parallel; they are
// outside the prototype's read-only contract and must not affect its guard.
const GUARD_IGNORED_DIRS = new Set(['.sopify', 'docs', '.polish-loop']);
// The controller writes periodic checkpoints under this .git subdirectory; that is
// tool infrastructure, not a repository write. Core .git state stays monitored.
const GUARD_IGNORED_PATHS = [path.join('.git', 'trae-ai-tob'), path.join('.git', 'index.lock')];
const guardIgnores = (root, relative) => {
  const value = String(relative || '');
  if (root !== REPO_ROOT) return false;
  return GUARD_IGNORED_DIRS.has(value.split(path.sep)[0]) ||
    GUARD_IGNORED_PATHS.some(prefix => value === prefix || value.startsWith(prefix + path.sep));
};

function manifestOf(root) {
  const entries = {};
  const walk = directory => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const file = path.join(directory, entry.name);
      const relative = path.relative(root, file) || entry.name;
      if (guardIgnores(root, relative)) continue;
      if (entry.isSymbolicLink()) {
        const stat = fs.lstatSync(file, { bigint: true });
        const target = fs.readlinkSync(file);
        entries[relative] = {
          bytes: Buffer.byteLength(target),
          sha256: crypto.createHash('sha256').update(target).digest('hex'),
          mtimeNs: stat.mtimeNs.toString(),
          symlink: true,
        };
        continue;
      }
      if (entry.isDirectory()) { walk(file); continue; }
      const stat = fs.statSync(file, { bigint: true });
      entries[relative] = {
        bytes: Number(stat.size),
        sha256: crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'),
        mtimeNs: stat.mtimeNs.toString(),
        symlink: false,
      };
    }
  };
  walk(root);
  return entries;
}

function diffManifests(before, after) {
  const changes = [];
  const paths = new Set([...Object.keys(before), ...Object.keys(after)]);
  for (const file of [...paths].sort()) {
    const a = before[file], b = after[file];
    if (!a) { changes.push({ path: file, kind: 'added' }); continue; }
    if (!b) { changes.push({ path: file, kind: 'removed' }); continue; }
    if (a.sha256 !== b.sha256) changes.push({ path: file, kind: 'content' });
    else if (a.bytes !== b.bytes) changes.push({ path: file, kind: 'bytes' });
    else if (a.mtimeNs !== b.mtimeNs) changes.push({ path: file, kind: 'mtime' });
  }
  return changes;
}

function createReadonlyGuard(roots) {
  const guard = { roots: [...roots], snapshots: {}, events: [], watchers: [], capture() {
    for (const root of guard.roots) guard.snapshots[root] = manifestOf(root);
  }, diff() {
    const changes = [];
    for (const root of guard.roots) {
      const found = diffManifests(guard.snapshots[root] || {}, manifestOf(root));
      for (const change of found) changes.push({ root, ...change });
    }
    return changes;
  }, start() {
    for (const root of guard.roots) {
      let watcher;
      try {
        watcher = fs.watch(root, { recursive: true }, (eventType, filename) => {
          if (guardIgnores(root, String(filename || ''))) return;
          guard.events.push({ root, eventType, filename: String(filename || '') });
        });
      } catch (error) {
        throw new Error(`readonly watcher could not start for ${root}: ${error.message}`);
      }
      guard.watchers.push(watcher);
    }
  }, async stop() {
    // fs.watch callbacks are queued; drain them before closing so synchronous
    // child writes that created and removed a file are still observed.
    const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
    await wait(180);
    await new Promise(resolve => setImmediate(resolve));
    await wait(60);
    let closed = true;
    for (const watcher of guard.watchers) { try { watcher.close(); } catch { closed = false; } }
    guard.closeFailure = guard.closeFailure || !closed;
    guard.watchers = [];
    await wait(40);
    if (guard.closeFailure) throw new Error('readonly watcher close failed');
  } };
  return guard;
}

async function assertReadonlyGuard(outputDirectory) {
  const temp = fs.mkdtempSync(path.join(outputDirectory, 'readonly-guard-'));
  const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
  try {
    fs.mkdirSync(path.join(temp, 'data'), { recursive: true });
    const target = path.join(temp, 'data', 'snapshot.js');
    fs.writeFileSync(target, 'original\n');
    const guard = createReadonlyGuard([temp]);
    guard.capture();
    guard.start();

    const stat = fs.statSync(target);
    fs.writeFileSync(target, 'overwritten\n');
    fs.utimesSync(target, stat.atime, stat.mtime);
    await delay(120);
    const contentFault = guard.diff();

    guard.capture();
    const trace = path.join(temp, 'audit-trace.jsonl');
    fs.writeFileSync(trace, 'trace\n');
    await delay(120);
    const traceCreate = guard.diff();

    guard.capture();
    fs.rmSync(trace);
    await delay(120);
    const traceDelete = guard.diff();
    guard.capture();
    const transient = path.join(temp, 'transient-window.trace');
    execFileSync(process.execPath, ['-e', `require('fs').writeFileSync(${JSON.stringify(transient)}, 'x'); require('fs').unlinkSync(${JSON.stringify(transient)});`], { timeout: 15000 });
    const transientStart = guard.events.length;
    await guard.stop();
    const events = guard.events.slice();
    const transientEvents = events.slice(transientStart);

    const caughtContent = contentFault.some(change => change.kind === 'content' && change.path.endsWith('snapshot.js'));
    const caughtCreate = traceCreate.some(change => change.kind === 'added' && change.path.includes('audit-trace.jsonl'));
    const caughtDelete = traceDelete.some(change => change.kind === 'removed' && change.path.includes('audit-trace.jsonl'));
    const caughtEvent = events.some(entry => entry.filename.includes('audit-trace.jsonl'));
    const caughtTransient = transientEvents.some(entry => entry.filename.includes('transient-window.trace'));
    let startFailureCaught = false;
    try { createReadonlyGuard([path.join(temp, 'missing-root')]).start(); } catch { startFailureCaught = true; }
    assert.ok(caughtContent, 'readonly guard missed an overwrite whose mtime was restored');
    assert.ok(caughtCreate, 'readonly guard missed a trace created inside the audited root');
    assert.ok(caughtDelete, 'readonly guard missed a trace deleted inside the audited root');
    assert.ok(caughtEvent, 'readonly watcher missed the transient trace');
    assert.ok(caughtTransient, 'readonly watcher missed a synchronous create-then-delete before stop');
    assert.ok(startFailureCaught, 'readonly watcher start failure was silently treated as no writes');
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
  return true;
}

async function assertWatcherCloseFailure(outputDirectory) {
  const temp = fs.mkdtempSync(path.join(outputDirectory, 'readonly-close-'));
  try {
    const guard = createReadonlyGuard([temp]);
    guard.capture();
    guard.start();
    const original = guard.watchers[0];
    guard.watchers[0] = { close() { original.close(); throw new Error('injected watcher close failure'); } };
    let firstFailure = false, secondFailure = false;
    try { await guard.stop(); } catch { firstFailure = true; }
    try { await guard.stop(); } catch { secondFailure = true; }
    return firstFailure && secondFailure;
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
}

function assertCollectorIsolation(outputDirectory) {  let temp = null;
  try {
    temp = fs.mkdtempSync(path.join(outputDirectory, 'collector-'));
    const scriptsDirectory = path.join(temp, 'prototype', 'scripts');
    const dataDirectory = path.join(temp, 'prototype', 'data');
    fs.mkdirSync(scriptsDirectory, { recursive: true });
    fs.mkdirSync(dataDirectory, { recursive: true });
    fs.copyFileSync(path.resolve(__dirname, '../scripts/build-data.mjs'), path.join(scriptsDirectory, 'build-data.mjs'));
    fs.writeFileSync(path.join(temp, 'README.md'), 'collector fixture repository\n');
    const git = args => execFileSync('git', args, { cwd: temp, stdio: 'pipe', timeout: 60000 });
    const run = env => execFileSync(process.execPath, [path.join(scriptsDirectory, 'build-data.mjs')], {
      cwd: temp, env: { ...process.env, ...env }, stdio: 'pipe', timeout: 60000,
    });
    git(['init', '-b', 'main']);
    git(['add', '.']);
    git(['-c', 'user.name=Audit', '-c', 'user.email=audit@example.com', 'commit', '-m', 'fixture']);
    run({});
    const snapshotFile = path.join(dataDirectory, 'snapshot.js');
    const cleanSha = readSnapshotInputSha(snapshotFile);
    const beforeFiles = new Set(listRepositoryFiles(temp));
    const beforeDigests = fileDigests(temp);
    const trace = path.join(dataDirectory, 'audit-trace.jsonl');
    run({
      GIT_DIR: path.join(temp, 'redirected.git'),
      GIT_WORK_TREE: path.join(temp, 'redirected-worktree'),
      GIT_INDEX_FILE: path.join(temp, 'redirected-index'),
      GIT_OBJECT_DIRECTORY: path.join(temp, 'objects'),
      GIT_ALTERNATE_OBJECT_DIRECTORIES: path.join(temp, 'alternates'),
      GIT_COMMON_DIR: path.join(temp, 'common'),
      GIT_TRACE2_EVENT: trace,
      GIT_CONFIG_COUNT: '1',
      GIT_CONFIG_KEY_0: 'core.splitIndex',
      GIT_CONFIG_VALUE_0: 'true',
    });
    assert.equal(readSnapshotInputSha(snapshotFile), cleanSha, 'collector inputSha changed under redirected Git environment');
    const added = listRepositoryFiles(temp).filter(file => !beforeFiles.has(file));
    assert.deepEqual(added, [], 'collector created new repository files under redirected Git environment');
    assert.deepEqual(fileDigests(temp), beforeDigests, 'collector modified repository files under redirected Git environment');
  } finally {
    if (temp) fs.rmSync(temp, { recursive: true, force: true });
  }
  return true;
}

function runVerifierFault(mode, environment = {}, playwrightArg = process.argv[2] || 'playwright') {
  const directory = fs.mkdtempSync(path.join(output, 'self-test-' + mode + '-'));
  const started = Date.now();
  const result = spawnSync(process.execPath, [__filename, playwrightArg, directory], {
    env: { ...process.env, VERIFY_FAULT: mode, ...environment },
    encoding: 'utf8',
    timeout: 90000,
  });
  const elapsedMs = Date.now() - started;
  fs.rmSync(directory, { recursive: true, force: true });
  return { ...result, elapsedMs };
}

function runVerifierOnly(environment = {}) {
  const directory = fs.mkdtempSync(path.join(output, 'self-test-only-'));
  const started = Date.now();
  const result = spawnSync(process.execPath, [__filename, process.argv[2] || 'playwright', directory], {
    env: { ...process.env, ...environment },
    encoding: 'utf8',
    timeout: 120000,
  });
  const elapsedMs = Date.now() - started;
  const files = fs.existsSync(directory) ? fs.readdirSync(directory) : [];
  fs.rmSync(directory, { recursive: true, force: true });
  return { ...result, elapsedMs, files };
}

function fakeLauncherPlaywright() {
  const directory = fs.mkdtempSync(path.join(output, 'self-test-launcher-'));
  const file = path.join(directory, 'fake-playwright.cjs');
  fs.writeFileSync(file, "exports.chromium = { launch: async () => { throw new Error('total timeout: injected launcher error'); } };\n");
  return { directory, file };
}

function parseEmbeddedData(html) {
  const match = html.match(/<script type="application\/json" id="evidentloop-data" nonce="[^"]*">([\s\S]*?)<\/script>/);
  assert.ok(match, 'embedded JSON data block is present');
  return JSON.parse(match[1]);
}

let browser = null;
let readonlyGuard = null;
let watchdog = null;
let finished = false;
let currentStep = 'startup';

function markStep(name) {
  currentStep = name;
  logLine(`[step] ${name}`);
}

async function closeWithTimeout(target, ms, method = 'close') {
  if (!target) return 'closed';
  let timer = null;
  try {
    return await Promise.race([
      Promise.resolve(target[method]()).then(() => 'closed', () => 'failed'),
      new Promise(resolve => { timer = setTimeout(() => resolve('timeout'), ms); }),
    ]);
  } catch {
    return 'failed';
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function shutdown() {
  const listeners = readonlyGuard ? await closeWithTimeout(readonlyGuard, CLEANUP_TIMEOUT_MS, 'stop') : 'closed';
  const browserStatus = await closeWithTimeout(browser, CLEANUP_TIMEOUT_MS);
  return { browser: browserStatus, listeners };
}

async function finish(exitCode, lines) {
  if (finished) return;
  finished = true;
  if (watchdog) clearTimeout(watchdog);
  const cleanup = await shutdown();
  if (cleanup.browser === 'closed' && cleanup.listeners === 'closed') {
    logLine('[cleanup] browser and listeners closed');
  } else {
    logLine(`[cleanup] 清理未确认：browser=${cleanup.browser} listeners=${cleanup.listeners}`);
  }
  logLine('');
  for (const line of lines) logLine(line);
  process.exit(exitCode);
}


const { createRuntime } = require('./verify/shared.cjs');
const coreModule = require('./verify/core.cjs');
const moduleList = [
  require('./verify/list.cjs'),
  require('./verify/reviewed.cjs'),
  require('./verify/sendback.cjs'),
  require('./verify/export-extension.cjs'),
  require('./verify/scenarios.cjs'),
  require('./verify/appearance.cjs'),
  require('./verify/regression-5c.cjs'),
  require('./verify/visual.cjs'),
  require('./verify/landing.cjs'),
  require('./verify/issue-card.cjs'),
  require('./verify/consolidated.cjs'),
  require('./verify/annotation-toggle.cjs'),
  require('./verify/p4-parity.cjs'),
];
const RAW_CONCURRENCY = process.env.VERIFY_CONCURRENCY;
const CONCURRENCY = RAW_CONCURRENCY === undefined ? 3 : Number(RAW_CONCURRENCY);
if (!Number.isInteger(CONCURRENCY) || CONCURRENCY < 1 || CONCURRENCY > 4) {
  console.error(`CONFIG ERROR: VERIFY_CONCURRENCY must be an integer between 1 and 4, got "${RAW_CONCURRENCY}"`);
  process.exit(2);
}
const PRIVATE_DENYLIST = loadPrivateDenylistConfig();
if (PRIVATE_DENYLIST.error) {
  console.error('CONFIG ERROR: ' + PRIVATE_DENYLIST.error);
  process.exit(2);
}

(async () => {
  watchdog = setTimeout(() => {
    finish(1, [
      '=== FAILURE SUMMARY ===',
      `checks passed: ${results.length}`,
      'failed check: total timeout',
      `last step: ${currentStep}`,
      `error: verifier exceeded ${TOTAL_TIMEOUT_MS} ms`,
    ]);
  }, TOTAL_TIMEOUT_MS);
  if (FAULT === 'cleanup-fail' || FAULT === 'cleanup-timeout') {
    markStep('cleanup fault injection');
    browser = FAULT === 'cleanup-fail'
      ? { close: async () => { throw new Error('injected browser close failure'); } }
      : { close: () => new Promise(() => {}) };
    readonlyGuard = FAULT === 'cleanup-fail'
      ? { stop: async () => { throw new Error('injected listener close failure'); } }
      : { stop: () => new Promise(() => {}) };
    await finish(0, ['cleanup fault injection finished']);
    return;
  }
  browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true, ignoreDefaultArgs: ['--headless'],
    args: ['--headless=new', '--window-size=1176,834', '--force-device-scale-factor=2', '--hide-scrollbars'],
  });
  try {
    const collectors = { results, errors, requests, failedRequests, sockets };
    const runtimeBase = { browser, output, collectors, logLine, parseEmbeddedData, root: path.resolve(__dirname, '..') };
    const coreRuntime = await createRuntime({ ...runtimeBase, id: 'core', live: true });
    coreRuntime.root = runtimeBase.root;
    coreRuntime.FAULT = FAULT;
    coreRuntime.ONLY = ONLY;
    coreRuntime.privateDenylist = PRIVATE_DENYLIST;
    coreRuntime.helpers = {
      assertBrandPaletteInSource, assertNoInternalAssets,
      assertCollectorIsolation, assertReadonlyGuard, assertWatcherCloseFailure,
      createReadonlyGuard, runVerifierFault, runVerifierOnly, fakeLauncherPlaywright, guardIgnores, REPO_ROOT, internalAssetOffenders,
      privateAssetScan, privateTextOffenders, privateValueOffenders,
      setReadonlyGuard: guard => { readonlyGuard = guard; },
    };
    coreRuntime.onStep = name => { currentStep = name; };
    coreRuntime.logLine = logLine;
    await coreModule.run(coreRuntime);
    const data = coreRuntime.coreData;
    coreRuntime.executedScenarios.forEach(name => executedScenarios.add(name));

    const selection = new Set(selectedScenarios);
    const plan = moduleList
      .map((module, index) => ({ module, order: index }))
      .filter(entry => entry.module.scenarios.some(name => selection.has(name)))
      .sort((a, b) => a.module.order - b.module.order);
    if (ONLY === null && plan.length !== moduleList.length) {
      throw new Error('full run did not schedule every verify module');
    }

    const runtimes = [];
    let next = 0;
    let failure = null;
    const runWorker = async entry => {
      const runtime = await createRuntime({ ...runtimeBase, id: entry.module.id, live: false });
      runtime.data = data;
      runtime.scoped = scoped;
      runtime.selectedScenarios = selectedScenarios;
      runtime.SCENARIOS = SCENARIOS;
      runtime.ONLY = ONLY;
      runtime.browser = browser;
      runtime.PROTOTYPE_WORD = PROTOTYPE_WORD;
      runtime.UNCOMPUTED_WORD = UNCOMPUTED_WORD;
      try {
        await entry.module.run(runtime);
      } catch (error) {
        error.moduleId = entry.module.id;
        error.moduleOrder = entry.module.order;
        if (!failure) failure = error;
      } finally {
        runtime.executedScenarios.forEach(name => executedScenarios.add(name));
        try { runtime.resourceUrls = await runtime.page.evaluate(() => performance.getEntriesByType('resource').map(entry => entry.name)); } catch { runtime.resourceUrls = []; }
        runtimes.push({ entry, runtime });
        try { await runtime.context.close(); } catch { /* closing is best-effort after the module finished */ }
      }
    };
    const worker = async () => {
      while (!failure && next < plan.length) {
        const entry = plan[next++];
        await runWorker(entry);
      }
    };
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, plan.length) }, worker));

    runtimes.sort((a, b) => a.entry.module.order - b.entry.module.order);
    for (const { entry, runtime } of runtimes) {
      if (failure && entry.module.order > failure.moduleOrder) break;
      for (const event of runtime.events) {
        if (event.type === 'step') logLine(`[step] ${event.name}`);
        else if (event.type === 'check') {
          results.push(event.name);
          logLine(`ok ${results.length} - ${event.name}`);
        } else if (event.type === 'shot') {
          SCREENSHOTS.push(event.name);
        }
      }
      for (const name of runtime.screenshots) SCREENSHOTS.push(name);
      if (failure && entry.module.order === failure.moduleOrder) break;
    }
    if (failure) {
      currentStep = failure.step || failure.moduleId || currentStep;
      throw failure;
    }

    const page = coreRuntime.page;
    const check = coreRuntime.check;
    const markStep = coreRuntime.markStep;
    markStep('final cross-cutting assertions');
    const lastScenario = selectedScenarios[selectedScenarios.length - 1];
    if (lastScenario) await coreRuntime.open({ scenario: lastScenario });
    const forbidden = ['GitLab', 'gitlab', '快照',
      '待评审', '未审', '零发现', '有问题', '有效问题', '被扣下', '已扣下', '已验证', UNCOMPUTED_WORD, PROTOTYPE_WORD];
    const bodyText = await page.evaluate(() => {
      const clone = document.body.cloneNode(true);
      clone.querySelectorAll('.d2h-wrapper,pre,code,.sendback-content,.extension-preview,.prototype-console').forEach(node => node.remove());
      return clone.innerText;
    });
    check('no GitLab, internal dataset or internal dependency text', forbidden.every(text => !bodyText.includes(text)));
    check('no old problem-count phrasing', !/有 [0-9]+ 个问题/.test(bodyText));
    check('verification keeps snapshot.js read-only', fs.statSync(snapshotPath).mtimeMs === snapshotMtime);
    await readonlyGuard.stop();
    const readonlyChanges = readonlyGuard.diff();
    if (readonlyChanges.length || readonlyGuard.events.length) {
      console.error('Readonly guard findings:', JSON.stringify({
        changes: readonlyChanges,
        events: readonlyGuard.events.slice(0, 40),
      }, null, 2));
    }
    check('data root and repository root stay unchanged during the browser run', readonlyChanges.length === 0);
    check('no transient writes happened under the data root or repository root', readonlyGuard.events.length === 0);
    const finalResources = await page.evaluate(() => performance.getEntriesByType('resource').map(entry => entry.name));
    const resourceUrls = [...new Set([...finalResources, ...runtimes.flatMap(item => item.runtime.resourceUrls || [])])];
    check('no remote resource entries', resourceUrls.every(resource => !/^https?:/i.test(resource)));
    check('no http(s) requests, WebSocket connections or failed remote requests', assertNoNetwork() === 0);
    if (errors.length) console.error('Collected browser errors:', errors);
    check('no browser console or runtime errors', errors.length === 0);
    for (const scenario of selectedScenarios) {
      check('scenario screenshot exists: ' + scenario, fs.existsSync(path.join(output, scenario + '.png')) ||
        SCREENSHOTS.some(name => name.includes(scenario)));
    }
    for (const file of SCREENSHOTS) {
      check('screenshot not empty: ' + file, fs.statSync(path.join(output, file + '.png')).size > 1000);
    }
    const executedOrder = [
      ...SCENARIOS.filter(name => executedScenarios.has(name)),
      ...[...executedScenarios].filter(name => !SCENARIOS.includes(name)).sort(),
    ];
    const report = {
      viewport: [1176, 834], deviceScaleFactor: 2,
      scenarios: selectedScenarios, partial: ONLY !== null, only: ONLY === null ? null : [...ONLY],
      executedScenarios: executedOrder,
      passed: results, errors,
      requests: [...requests], failedRequests, sockets,
      screenshots: SCREENSHOTS,
    };
    fs.writeFileSync(path.join(output, 'verification.json'), JSON.stringify(report, null, 2));
    markStep('done');
    finish(0, ONLY === null ? [
      '=== PASS SUMMARY ===',
      `checks: ${results.length}`,
      `screenshots: ${SCREENSHOTS.length}`,
      `output: ${output}`,
    ] : [
      '=== PARTIAL RUN ===',
      `部分运行：${selectedScenarios.length} 个场景（${selectedScenarios.join(', ')}）`,
      `实际打开的场景：${executedOrder.join(', ') || '（无）'}`,
      '本次只运行了所列场景的检查与截图，不代表全量通过。',
      `checks: ${results.length}`,
      `screenshots: ${SCREENSHOTS.length}`,
      `output: ${output}`,
    ]);
  } catch (error) {
    finish(1, [
      '=== FAILURE SUMMARY ===',
      `checks passed: ${results.length}`,
      `failed check: ${error.checkName || '(uncaught)'}`,
      `last step: ${currentStep}`,
      `error: ${error && error.message ? error.message : String(error)}`,
    ]);
  }
})().catch(error => {
  finish(1, [
    '=== FAILURE SUMMARY ===',
    `checks passed: ${results.length}`,
    `failed check: ${error.checkName || '(uncaught outside the browser run)'}`,
    `last step: ${currentStep}`,
    `error: ${error && error.message ? error.message : String(error)}`,
  ]);
});
