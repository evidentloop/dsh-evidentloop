// plugin/host/index.mjs
import path11 from "node:path";
import os from "node:os";
import { fileURLToPath as fileURLToPath2 } from "node:url";

// plugin/host/service.mjs
import fs11 from "node:fs";
import path10 from "node:path";
import crypto8 from "node:crypto";

// core/prepare.mjs
import fs3 from "node:fs";
import path3 from "node:path";
import { pathToFileURL } from "node:url";

// core/lib/common.mjs
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
var PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
var METHOD_ROOT = path.join(PROJECT_ROOT, "skills/evidentloop-review");
var METHOD_FILES = Object.freeze(["SKILL.md", "references/alignment.md", "references/findings.md", "references/quality-rules.md", "references/understanding.md", "rubric.md", "rules/builtin.json", "rules/p1-ux-spec.md", "schema/run.schema.json"].sort());
var sha256 = (value) => crypto.createHash("sha256").update(value).digest("hex");
var normalizeLF = (text) => String(text ?? "").replace(/\r\n/g, "\n");
var linesOf = (text) => {
  const clean = normalizeLF(text);
  if (!clean) return [];
  const lines = clean.split("\n");
  if (lines.at(-1) === "") lines.pop();
  return lines;
};
function canonical(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return "[" + value.map(canonical).join(",") + "]";
  return "{" + Object.keys(value).sort().map((key) => JSON.stringify(key) + ":" + canonical(value[key])).join(",") + "}";
}
function safeRelative(value) {
  if (typeof value !== "string" || !value || value.includes("\0") || value.includes("\\") || /^[A-Za-z]:/.test(value) || path.posix.isAbsolute(value) || path.posix.normalize(value) !== value || value.split("/").some((part) => [".", "..", ".git"].includes(part.toLowerCase()))) throw new Error("Unsafe repository path: " + JSON.stringify(value));
  return value;
}
function inside(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative === "" || !relative.startsWith(".." + path.sep) && relative !== ".." && !path.isAbsolute(relative);
}
function physicalDestination(file) {
  let parent = path.dirname(path.resolve(file));
  const missing = [];
  while (!fs.existsSync(parent)) {
    missing.unshift(path.basename(parent));
    const next = path.dirname(parent);
    if (next === parent) throw Error("No existing output ancestor");
    parent = next;
  }
  return path.join(fs.realpathSync(parent), ...missing, path.basename(file));
}
function externalDestination(file) {
  const destination = physicalDestination(file);
  let current = fs.existsSync(destination) ? fs.realpathSync(destination) : destination;
  if (!fs.existsSync(current) || !fs.statSync(current).isDirectory()) current = path.dirname(current);
  for (; ; ) {
    if (path.basename(current) === ".git" || fs.existsSync(path.join(current, ".git")) || ["HEAD", "config", "objects", "refs"].every((name2) => fs.existsSync(path.join(current, name2)))) throw Error("Output/storage must not enter a Git repository");
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return destination;
}
function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  if (fs.constants.O_NOFOLLOW === void 0) throw Error("O_NOFOLLOW required for report writes");
  const fd = fs.openSync(file, fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_TRUNC | fs.constants.O_NOFOLLOW, 384);
  try {
    fs.writeFileSync(fd, JSON.stringify(value, null, 2) + "\n");
  } finally {
    fs.closeSync(fd);
  }
}
function methodVersion(methodRoot = METHOD_ROOT) {
  const files = METHOD_FILES.map((name2) => {
    const file = path.join(methodRoot, name2);
    const stat = fs.lstatSync(file);
    if (!stat.isFile() || stat.isSymbolicLink()) throw new Error("Required method file is not a regular file: " + name2);
    return { path: name2, sha256: sha256(fs.readFileSync(file)) };
  });
  return { promptVersion: sha256(canonical(files)), files };
}
var fileIdentity = (file) => [file.path, file.oldPath ?? null, file.change, file.kind, file.baseMode ?? null, file.headMode ?? null, file.baseSha256 ?? null, file.headSha256 ?? null];
var requirementDigest = (sources) => sha256(canonical([...sources].sort((a, b) => a.order - b.order).map((source) => ({ order: source.order, kind: source.kind, sha256: source.sha256, items: source.items.map(({ start, end }) => ({ start, end })) }))));
var inputFingerprint = ({ files, requirements, rulesVersion, promptVersion, range }) => sha256(canonical({ files: [...files].sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0).map(fileIdentity), requirements: requirementDigest(requirements), rulesVersion, promptVersion, baseSha: range.baseSha ?? null }));
var isTarget = (file) => !["binary", "oversize", "excluded", "submodule", "conflicted"].includes(file.kind) && file.change !== "mode-changed" && !(file.change === "renamed" && file.baseSha256 === file.headSha256);
function prepareRequirements(sources = []) {
  const orders = /* @__PURE__ */ new Set();
  const ids = /* @__PURE__ */ new Set();
  return [...sources].map((source) => {
    if (source.origin !== void 0 && typeof source.origin !== "string") throw new Error("Requirement origin must be text");
    if (!Number.isSafeInteger(source.order) || orders.has(source.order)) throw new Error("Each requirement source needs a unique, explicit stable integer order");
    orders.add(source.order);
    if (!["session-message", "file", "paste"].includes(source.kind)) throw new Error("Invalid requirement source kind");
    let raw = source.text;
    if (source.kind === "file" && source.file) {
      const stat = fs.lstatSync(source.file);
      if (!stat.isFile() || stat.isSymbolicLink()) throw new Error("Requirement file must be a regular file");
      raw = fs.readFileSync(source.file, "utf8");
    }
    if (typeof raw !== "string" || !raw.trim()) throw new Error("Requirement text must be nonblank");
    const text = normalizeLF(raw), length = Array.from(text).length, hash = sha256(text);
    const intervals = source.items ?? [{ start: 0, end: length }];
    if (!Array.isArray(intervals) || !intervals.length) throw new Error("Requirement source must have at least one item");
    let previousEnd = -1;
    const items = [...intervals].sort((a, b) => a.start - b.start).map(({ start, end }) => {
      if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || end <= start || end > length || start < previousEnd) throw new Error("Invalid/overlapping requirement code-point interval");
      previousEnd = end;
      const itemId = sha256(canonical([source.order, hash, start, end])).slice(0, 12);
      if (ids.has(itemId)) throw new Error("Duplicate requirement item id");
      ids.add(itemId);
      return { itemId, start, end };
    });
    return { reqId: "req-" + sha256(canonical([source.order, source.kind, hash])).slice(0, 12), kind: source.kind, origin: source.origin || (source.file ? path.basename(source.file) : source.kind), capturedAt: source.capturedAt || (/* @__PURE__ */ new Date()).toISOString(), order: source.order, text, sha256: hash, originalLength: length, truncated: false, items };
  }).sort((a, b) => a.order - b.order);
}

// core/lib/git.mjs
import fs2 from "node:fs";
import path2 from "node:path";
import crypto2 from "node:crypto";
import { execFileSync } from "node:child_process";
var ALLOWED_GIT = /* @__PURE__ */ new Set(["rev-parse", "merge-base", "ls-tree", "ls-files", "cat-file", "diff-tree"]);
var PreparationError = class extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
};
function gitEnvironment() {
  const env = { ...process.env };
  for (const key of Object.keys(env)) if (["GIT_DIR", "GIT_WORK_TREE", "GIT_INDEX_FILE", "GIT_OBJECT_DIRECTORY", "GIT_ALTERNATE_OBJECT_DIRECTORIES", "GIT_COMMON_DIR", "GIT_NAMESPACE"].includes(key) || key.startsWith("GIT_TRACE") || key.startsWith("GIT_CONFIG")) delete env[key];
  return { ...env, GIT_OPTIONAL_LOCKS: "0", GIT_NO_LAZY_FETCH: "1", GIT_TERMINAL_PROMPT: "0" };
}
function createGit(input) {
  const log = [];
  const invoke = (cwd, location, args, { input: stdin } = {}) => {
    if (!ALLOWED_GIT.has(args[0])) throw new PreparationError("git-command-forbidden", args[0]);
    log.push({ command: args[0], args: args.slice(1), optionalLocks: 0, lazyFetch: 0, fsmonitor: false });
    try {
      return execFileSync("git", [...location, "-c", "core.fsmonitor=false", ...args], { cwd, env: gitEnvironment(), input: stdin, maxBuffer: 256 * 1024 * 1024, stdio: ["pipe", "pipe", "pipe"] });
    } catch (error) {
      throw new PreparationError("git-read-failed", "Read-only git " + args[0] + " failed: " + String(error.stderr || error.message).slice(0, 500));
    }
  };
  const inputPath = fs2.realpathSync(input);
  const root = fs2.realpathSync(invoke(inputPath, [], ["rev-parse", "--show-toplevel"]).toString().trim());
  const gitDir = invoke(root, [], ["rev-parse", "--absolute-git-dir"]).toString().trim();
  const commonRaw = invoke(root, [], ["rev-parse", "--git-common-dir"]).toString().trim();
  const commonDir = path2.resolve(root, commonRaw);
  const run = (args, options) => invoke(root, [`--git-dir=${gitDir}`, `--work-tree=${root}`], args, options);
  const objectFormat = run(["rev-parse", "--show-object-format"]).toString().trim();
  if (!["sha1", "sha256"].includes(objectFormat)) throw new PreparationError("object-format-unsupported", "Cannot identify Git object format");
  const resolve = (ref) => {
    try {
      const result = run(["rev-parse", "--verify", "--quiet", ref + "^{commit}"]).toString().trim();
      return new RegExp("^[0-9a-f]{" + (objectFormat === "sha1" ? 40 : 64) + "}$").test(result) ? result : null;
    } catch {
      return null;
    }
  };
  return { root, gitDir, commonDir, objectFormat, oidBytes: objectFormat === "sha1" ? 20 : 32, run, resolve, log };
}
function inspectIndex(buffer, oidBytes = 20) {
  const fail = (message) => {
    throw new PreparationError("index-unconfirmed", message);
  };
  if (buffer.length < 12 + oidBytes || buffer.toString("ascii", 0, 4) !== "DIRC") fail("Unrecognized or truncated index");
  const version = buffer.readUInt32BE(4), count = buffer.readUInt32BE(8), end = buffer.length - oidBytes;
  if (![2, 3, 4].includes(version)) fail("Unsupported index version");
  if (!crypto2.timingSafeEqual(crypto2.createHash(oidBytes === 20 ? "sha1" : "sha256").update(buffer.subarray(0, end)).digest(), buffer.subarray(end))) fail("Index checksum mismatch");
  let offset = 12;
  for (let i = 0; i < count; i++) {
    const start = offset, flagsAt = offset + 40 + oidBytes;
    if (flagsAt + 2 > end) fail("Truncated index entry");
    const flags = buffer.readUInt16BE(flagsAt);
    offset = flagsAt + 2;
    if (flags & 16384) {
      if (version < 3 || offset + 2 > end) fail("Invalid extended index flags");
      const extra = buffer.readUInt16BE(offset);
      offset += 2;
      if (extra & 16384) throw new PreparationError("sparse-checkout", "Sparse index/worktree is not frozen by this trial");
    }
    if (version === 4) {
      let byte;
      let length = 0;
      do {
        if (offset >= end || ++length > 10) fail("Invalid v4 prefix length");
        byte = buffer[offset++];
      } while (byte & 128);
    }
    while (offset < end && buffer[offset] !== 0) offset++;
    if (offset >= end) fail("Unterminated index path");
    offset++;
    if (version !== 4) offset = start + Math.ceil((offset - start) / 8) * 8;
    if (offset > end) fail("Invalid index padding");
  }
  let split = false;
  while (offset < end) {
    if (offset + 8 > end) fail("Truncated index extension");
    const name2 = buffer.toString("ascii", offset, offset + 4), size = buffer.readUInt32BE(offset + 4);
    if (name2 === "link") split = true;
    else if (name2 === "sdir") throw new PreparationError("sparse-checkout", "Sparse index is not frozen");
    else if (name2[0] === name2[0].toLowerCase()) fail("Unknown required index extension");
    offset += 8 + size;
    if (offset > end) fail("Invalid index extension size");
  }
  return { version, count, split };
}
function preflight(git) {
  for (const directory of /* @__PURE__ */ new Set([git.gitDir, git.commonDir])) {
    if (fs2.readdirSync(directory).some((name2) => name2.startsWith("sharedindex."))) throw new PreparationError("split-index", "sharedindex.* present; no ls-files or freeze performed");
    for (const name2 of ["config", "config.worktree"]) {
      const file = path2.join(directory, name2);
      if (!fs2.existsSync(file)) continue;
      let section = "";
      for (const raw of fs2.readFileSync(file, "utf8").split(/\r?\n/)) {
        const text = raw.trim();
        if (/^\[/.test(text)) {
          section = text.slice(1, text.indexOf("]")).toLowerCase();
          continue;
        }
        if (section.startsWith("include") && /^path\s*=/i.test(text)) throw new PreparationError("config-include-unconfirmed", "Included repository config is not expanded by the minimal split-index preflight");
        if (section === "core" && /^splitindex(?:\s*=\s*(?:"?(?:true|yes|on|1)"?)(?:\s*[#;].*)?)?$/i.test(text)) throw new PreparationError("split-index", "core.splitIndex enabled; no freeze performed");
        if (section === "core" && /^sparsecheckout\s*=\s*(true|yes|on|1)/i.test(text)) throw new PreparationError("sparse-checkout", "Sparse checkout requires a later collector");
      }
    }
  }
  const index = path2.join(git.gitDir, "index");
  if (!fs2.existsSync(index) || !fs2.lstatSync(index).isFile() || fs2.lstatSync(index).isSymbolicLink()) throw new PreparationError("index-unconfirmed", "Index absent or not a regular file; no ls-files performed");
  if (fs2.existsSync(index) && inspectIndex(fs2.readFileSync(index), git.oidBytes).split) throw new PreparationError("split-index", "Index link extension found before ls-files");
}
function rangeOf(git, target) {
  const headSha = git.resolve("HEAD"), emptyTree = crypto2.createHash(git.objectFormat).update("tree 0\0").digest("hex");
  if (!headSha) throw new PreparationError("unborn-head", "Repository has no HEAD commit; no merge-base snapshot was published");
  if (git.run(["rev-parse", "--is-shallow-repository"]).toString().trim() === "true") throw new PreparationError("shallow-history", "Repository history is shallow");
  let targetRef = target, targetSha = target && git.resolve(target);
  if (target && !targetSha) throw new PreparationError("target-missing", "Explicit target does not resolve to a commit");
  if (!target) {
    for (const ref of ["origin/HEAD", "main", "master"]) {
      const sha = git.resolve(ref);
      if (sha) {
        targetRef = ref;
        targetSha = sha;
        break;
      }
    }
  }
  if (!targetSha) throw new PreparationError("target-missing", "No target branch found; provide --target");
  let bases = [];
  try {
    bases = git.run(["merge-base", "--all", headSha, targetSha]).toString().trim().split("\n").filter(Boolean);
  } catch {
  }
  if (bases.length !== 1) throw new PreparationError(bases.length ? "multiple-merge-bases" : "no-merge-base", "Expected exactly one merge base");
  return { kind: "merge-base-worktree", targetRef, targetSha, baseSha: bases[0], headSha, dirty: false, emptyTree };
}
function branchLabelOf(git, ref) {
  let full = git.run(["rev-parse", "--symbolic-full-name", ref]).toString().trim();
  const seen = /* @__PURE__ */ new Set();
  while (full.endsWith("/HEAD")) {
    if (seen.has(full)) throw new PreparationError("target-branch-unconfirmed", "Cyclic symbolic target");
    seen.add(full);
    safeRelative(full);
    const file = path2.join(git.commonDir, full);
    if (!fs2.existsSync(file) || !fs2.lstatSync(file).isFile() || fs2.lstatSync(file).isSymbolicLink()) throw new PreparationError("target-branch-unconfirmed", "Cannot confirm symbolic target branch");
    const match = fs2.readFileSync(file, "utf8").trim().match(/^ref:\s+(refs\/(?:heads|remotes)\/[^\s]+)$/);
    if (!match) throw new PreparationError("target-branch-unconfirmed", "Invalid symbolic target branch");
    full = match[1];
  }
  if (full.startsWith("refs/heads/")) return full.slice("refs/heads/".length);
  if (full.startsWith("refs/remotes/")) {
    const names = /* @__PURE__ */ new Set(["origin"]);
    for (const dir of /* @__PURE__ */ new Set([git.gitDir, git.commonDir])) {
      const config = path2.join(dir, "config");
      if (fs2.existsSync(config)) for (const match of fs2.readFileSync(config, "utf8").matchAll(/^\s*\[remote\s+"([^"\\]+)"\]/gm)) names.add(match[1]);
    }
    const name2 = [...names].sort((a, b) => b.length - a.length).find((n) => full.startsWith("refs/remotes/" + n + "/"));
    if (name2) return full.slice(("refs/remotes/" + name2 + "/").length);
  }
  throw new PreparationError("target-branch-unconfirmed", "Target must resolve to a named branch");
}
var nul = (buffer) => buffer.toString("utf8").split("\0").filter(Boolean);
function treeOf(git, sha) {
  return new Map(nul(git.run(["ls-tree", "-r", "-z", sha])).map((record) => {
    const tab = record.indexOf("	"), [mode, type, oid] = record.slice(0, tab).split(" "), name2 = safeRelative(record.slice(tab + 1));
    return [name2, { mode, type, oid }];
  }));
}
function indexOf(git) {
  const entries = /* @__PURE__ */ new Map();
  for (const record of nul(git.run(["ls-files", "-z", "-s"]))) {
    const tab = record.indexOf("	"), [mode, oid, stage] = record.slice(0, tab).split(" "), name2 = safeRelative(record.slice(tab + 1));
    if (!entries.has(name2)) entries.set(name2, []);
    entries.get(name2).push({ mode, oid, stage: Number(stage) });
  }
  if ([...entries.values()].some((list) => list.some((entry) => entry.stage !== 0))) throw new PreparationError("unmerged-index", "Unmerged paths exist");
  return entries;
}
var untrackedOf = (git) => nul(git.run(["ls-files", "-z", "-o", "--exclude-standard"])).map(safeRelative);
function blobsOf(git, oids) {
  const ids = [...new Set(oids.filter(Boolean))], map = /* @__PURE__ */ new Map();
  if (!ids.length) return map;
  const bytes = git.run(["cat-file", "--batch"], { input: ids.join("\n") + "\n" });
  let offset = 0;
  for (const id2 of ids) {
    const end = bytes.indexOf(10, offset);
    if (end < 0) throw new PreparationError("object-missing", "Truncated cat-file output");
    const header = bytes.toString("utf8", offset, end).split(" ");
    offset = end + 1;
    if (header[1] === "missing" || header[1] !== "blob" && header[1] !== "commit") throw new PreparationError("object-missing", "Unavailable frozen Git object " + id2);
    const size = Number(header[2]);
    if (!Number.isSafeInteger(size) || size < 0 || offset + size >= bytes.length) throw new PreparationError("object-missing", "Truncated object bytes");
    const content = bytes.subarray(offset, offset + size);
    if (header[0] !== id2 || crypto2.createHash(git.objectFormat).update(header[1] + " " + size + "\0").update(content).digest("hex") !== id2) throw new PreparationError("object-corrupt", "Git object identity mismatch");
    map.set(id2, content);
    offset += size + 1;
  }
  return map;
}
function renamesOf(git, range) {
  const map = /* @__PURE__ */ new Map();
  if (range.baseSha === range.headSha) return map;
  const records = nul(git.run(["diff-tree", "--no-commit-id", "-r", "--name-status", "-z", "-M", "--no-ext-diff", "--no-textconv", range.baseSha, range.headSha]));
  for (let i = 0; i < records.length; ) {
    const status = records[i++];
    if (status.startsWith("R") || status.startsWith("C")) {
      const old = safeRelative(records[i++]), name2 = safeRelative(records[i++]);
      if (status.startsWith("R")) map.set(name2, old);
    } else safeRelative(records[i++]);
  }
  return map;
}
function readWorktree(root, name2, git, modeHint, sizeLimit) {
  const parts = safeRelative(name2).split("/"), full = path2.join(root, ...parts);
  const parentsSafe = () => {
    let here = root;
    for (const part of parts.slice(0, -1)) {
      here = path2.join(here, part);
      let stat2;
      try {
        stat2 = fs2.lstatSync(here);
      } catch (error) {
        if (error.code === "ENOENT" || error.code === "ENOTDIR") return false;
        throw error;
      }
      if (stat2.isSymbolicLink() || !stat2.isDirectory()) return false;
    }
    return true;
  };
  if (!parentsSafe()) return { exists: false };
  let stat;
  try {
    stat = fs2.lstatSync(full);
  } catch (error) {
    if (["ENOENT", "ENOTDIR"].includes(error.code)) return { exists: false };
    throw error;
  }
  if (modeHint === "160000" && stat.isDirectory()) return { exists: true, mode: "160000", kind: "submodule", gitOid: null, sha256: null };
  if (stat.isSymbolicLink()) {
    const bytes = Buffer.from(fs2.readlinkSync(full));
    return { exists: true, mode: "120000", kind: "symlink", sha256: sha256(bytes), gitOid: crypto2.createHash(git.objectFormat).update("blob " + bytes.length + "\0").update(bytes).digest("hex"), bytes };
  }
  if (!stat.isFile()) return { exists: false };
  if (fs2.constants.O_NOFOLLOW === void 0) throw new PreparationError("platform-unsupported", "O_NOFOLLOW required for working-tree reads");
  const fd = fs2.openSync(full, fs2.constants.O_RDONLY | fs2.constants.O_NOFOLLOW);
  try {
    const actual = fs2.fstatSync(fd), again = fs2.lstatSync(full);
    if (!parentsSafe() || actual.ino !== stat.ino || actual.dev !== stat.dev || actual.ino !== again.ino || actual.dev !== again.dev) throw new PreparationError("changed-during-read", "File identity changed during open");
    const hash = crypto2.createHash("sha256"), oid = crypto2.createHash(git.objectFormat).update("blob " + actual.size + "\0"), parts2 = [], chunk = Buffer.alloc(65536);
    let length = 0, binary = false, n;
    while ((n = fs2.readSync(fd, chunk, 0, chunk.length, null)) > 0) {
      const data = chunk.subarray(0, n);
      hash.update(data);
      oid.update(data);
      binary ||= data.includes(0);
      length += n;
      if (length <= sizeLimit) parts2.push(Buffer.from(data));
    }
    const final = fs2.fstatSync(fd);
    if (length !== actual.size || final.size !== actual.size) throw new PreparationError("changed-during-read", "File length changed during read");
    return { exists: true, mode: actual.mode & 73 ? "100755" : "100644", kind: binary ? "binary" : length > sizeLimit ? "oversize" : "text", sha256: hash.digest("hex"), gitOid: oid.digest("hex"), bytes: !binary && length <= sizeLimit ? Buffer.concat(parts2) : null };
  } finally {
    fs2.closeSync(fd);
  }
}

// core/lib/diff.mjs
function diffLines(oldText, newText) {
  const oldLines = linesOf(oldText);
  const newLines = linesOf(newText);
  let prefix = 0;
  while (prefix < oldLines.length && prefix < newLines.length && oldLines[prefix] === newLines[prefix]) prefix++;
  let suffix = 0;
  while (suffix < oldLines.length - prefix && suffix < newLines.length - prefix && oldLines[oldLines.length - 1 - suffix] === newLines[newLines.length - 1 - suffix]) suffix++;
  const a = oldLines.slice(prefix, oldLines.length - suffix);
  const b = newLines.slice(prefix, newLines.length - suffix);
  const ops = [];
  for (let i = 0; i < prefix; i++) ops.push({ t: " ", old: i + 1, new: i + 1, text: oldLines[i] });
  let oldLine = prefix + 1, newLine = prefix + 1;
  if (a.length * b.length > 4e6) {
    for (const line of a) {
      ops.push({ t: "-", old: oldLine++, text: line });
    }
    for (const line of b) {
      ops.push({ t: "+", new: newLine++, text: line });
    }
  } else if (a.length && b.length) {
    const width = b.length + 1;
    const dp = new Uint32Array((a.length + 1) * width);
    for (let i2 = a.length - 1; i2 >= 0; i2--) {
      for (let j2 = b.length - 1; j2 >= 0; j2--) {
        dp[i2 * width + j2] = a[i2] === b[j2] ? dp[(i2 + 1) * width + j2 + 1] + 1 : Math.max(dp[(i2 + 1) * width + j2], dp[i2 * width + j2 + 1]);
      }
    }
    let i = 0, j = 0;
    while (i < a.length && j < b.length) {
      if (a[i] === b[j]) {
        ops.push({ t: " ", old: oldLine++, new: newLine++, text: a[i] });
        i++;
        j++;
      } else if (dp[(i + 1) * width + j] >= dp[i * width + j + 1]) {
        ops.push({ t: "-", old: oldLine++, text: a[i] });
        i++;
      } else {
        ops.push({ t: "+", new: newLine++, text: b[j] });
        j++;
      }
    }
    while (i < a.length) {
      ops.push({ t: "-", old: oldLine++, text: a[i++] });
    }
    while (j < b.length) {
      ops.push({ t: "+", new: newLine++, text: b[j++] });
    }
  } else {
    for (const line of a) {
      ops.push({ t: "-", old: oldLine++, text: line });
    }
    for (const line of b) {
      ops.push({ t: "+", new: newLine++, text: line });
    }
  }
  for (let i = 0; i < suffix; i++) {
    ops.push({ t: " ", old: oldLines.length - suffix + i + 1, new: newLines.length - suffix + i + 1, text: oldLines[oldLines.length - suffix + i] });
  }
  return { ops, additions: b.length, deletions: a.length };
}
function unifiedDiff(filePath, oldText, newText) {
  const { ops } = diffLines(oldText, newText);
  const changes = [];
  ops.forEach((op, index) => {
    if (op.t !== " ") changes.push(index);
  });
  if (!changes.length) return "";
  const hunks = [];
  let start = changes[0], end = changes[0];
  for (const index of changes.slice(1)) {
    if (index - end <= 6) end = index;
    else {
      hunks.push([Math.max(0, start - 3), Math.min(ops.length - 1, end + 3)]);
      start = index;
      end = index;
    }
  }
  hunks.push([Math.max(0, start - 3), Math.min(ops.length - 1, end + 3)]);
  const out = [`--- a/${filePath}`, `+++ b/${filePath}`];
  for (const [hunkStart, hunkEnd] of hunks) {
    const slice = ops.slice(hunkStart, hunkEnd + 1);
    const oldCount = slice.filter((op) => op.t !== "+").length;
    const newCount = slice.filter((op) => op.t !== "-").length;
    const before = ops[hunkStart - 1];
    const oldStart = oldCount ? slice.find((op) => op.t !== "+").old : before?.old ?? 0;
    const newStart = newCount ? slice.find((op) => op.t !== "-").new : before?.new ?? 0;
    out.push(`@@ -${oldStart},${oldCount} +${newStart},${newCount} @@`);
    for (const op of slice) out.push(op.t + op.text);
  }
  return out.join("\n") + "\n";
}
function changedLineSets(diff) {
  const oldLines = /* @__PURE__ */ new Set(), newLines = /* @__PURE__ */ new Set();
  let oldLine = 0, newLine = 0;
  for (const line of String(diff || "").split("\n")) {
    const hunk = line.match(/^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
    if (hunk) {
      oldLine = Number(hunk[1]);
      newLine = Number(hunk[2]);
      continue;
    }
    if (!oldLine && !newLine) continue;
    if (line.startsWith("\\")) continue;
    if (line.startsWith("-")) {
      oldLines.add(oldLine);
      oldLine++;
    } else if (line.startsWith("+")) {
      newLines.add(newLine);
      newLine++;
    } else if (line.startsWith(" ")) {
      oldLine++;
      newLine++;
    }
  }
  return { oldLines, newLines };
}

// core/prepare.mjs
var SIZE_LIMIT = 256 * 1024;
var sensitive = (name2) => /(^|\/)(\.env(?:\.|$)|\.sopify(?:\/|$)|\.codex(?:\/|$)|\.agents(?:\/|$)|\.aws(?:\/|$)|\.ssh(?:\/|$)|(?:credentials?|secrets?)(?:\.|\/|$)|id_(?:rsa|dsa|ecdsa|ed25519)(?:\.|$))|\.(?:pem|key|p12|pfx|jks|keystore)$/i.test(name2);
var excluded = (name2) => sensitive(name2) || /(^|\/)(?:node_modules|vendor)(\/|$)/.test(name2);
function readState(git, target) {
  preflight(git);
  const range = rangeOf(git, target), base = treeOf(git, range.baseSha), head = treeOf(git, range.headSha), index = indexOf(git), untracked = untrackedOf(git), renames = renamesOf(git, range);
  const gitlinks = new Set([...base, ...head].filter(([, entry]) => entry.mode === "160000").map(([name2]) => name2));
  for (const [name2, entries] of index) if (entries.some((entry) => entry.mode === "160000")) gitlinks.add(name2);
  const names = [.../* @__PURE__ */ new Set([...base.keys(), ...head.keys(), ...index.keys(), ...untracked])].filter((name2) => ![...gitlinks].some((parent) => name2.startsWith(parent + "/"))).sort();
  const states = /* @__PURE__ */ new Map();
  for (const name2 of names) {
    const hint = index.get(name2)?.[0]?.mode || head.get(name2)?.mode || base.get(name2)?.mode;
    const state = readWorktree(git.root, name2, git, hint, SIZE_LIMIT);
    if (hint === "160000" && state.exists) {
      state.gitOid = index.get(name2)?.[0]?.oid || head.get(name2)?.oid || null;
      state.sha256 = state.gitOid ? sha256("gitlink:" + state.gitOid) : null;
    }
    states.set(name2, state);
  }
  range.dirty = names.some((name2) => {
    const state = states.get(name2), entry = head.get(name2);
    return entry ? !state.exists || entry.mode !== state.mode || entry.oid !== state.gitOid : state.exists;
  });
  const consumed = /* @__PURE__ */ new Set(), candidates = [];
  for (const [name2, oldPath] of renames) {
    if (states.get(name2)?.exists && !states.get(oldPath)?.exists && base.has(oldPath)) {
      consumed.add(oldPath);
      consumed.add(name2);
      candidates.push({ name: name2, oldPath, base: base.get(oldPath), state: states.get(name2), change: "renamed" });
    }
  }
  for (const name2 of names) {
    if (consumed.has(name2)) continue;
    const entry = base.get(name2), state = states.get(name2);
    if (!entry && !state.exists) continue;
    if (entry && state.exists && entry.oid === state.gitOid && entry.mode === state.mode) continue;
    const change = !entry ? "added" : !state.exists ? "deleted" : entry.oid === state.gitOid ? "mode-changed" : "modified";
    candidates.push({ name: name2, base: entry || null, state, change });
  }
  const objects = blobsOf(git, candidates.filter((c) => c.base?.type === "blob").map((c) => c.base.oid));
  const files = [], contents = /* @__PURE__ */ new Map();
  for (const candidate of candidates) {
    const { name: name2, oldPath, state, change } = candidate, entry = candidate.base;
    const oldBytes = entry?.type === "blob" ? objects.get(entry.oid) : entry?.mode === "160000" ? Buffer.from("gitlink:" + entry.oid) : null;
    const newBytes = state.bytes ?? null;
    let kind = state.kind || "text";
    if (entry?.mode === "160000" || state.mode === "160000") kind = "submodule";
    else if (entry?.mode === "120000" || state.mode === "120000") kind = "symlink";
    else if (oldBytes?.includes(0) || state.kind === "binary") kind = "binary";
    else if ((oldBytes?.length || 0) > SIZE_LIMIT || state.kind === "oversize") kind = "oversize";
    if (excluded(name2) || oldPath && excluded(oldPath)) kind = "excluded";
    if (["text", "symlink"].includes(kind)) try {
      for (const bytes of [oldBytes, newBytes]) if (bytes) new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    } catch {
      kind = "binary";
    }
    const file = {
      path: name2,
      ...oldPath ? { oldPath } : {},
      change,
      kind,
      baseMode: entry?.mode ?? null,
      headMode: state.exists ? state.mode : null,
      baseSha256: oldBytes ? sha256(oldBytes) : null,
      headSha256: state.exists ? state.sha256 : null
    };
    if (kind === "submodule") {
      file.baseGitlink = entry?.oid ?? null;
      file.headGitlink = state.gitOid;
      file.note = "Superproject gitlink metadata only; submodule worktree is not traversed";
    } else if (kind === "excluded") file.note = "Sensitive path or dependency directory; content omitted";
    else if (kind === "oversize") file.note = "Content exceeds 256 KiB; content omitted";
    else if (kind === "binary") file.note = "Binary or invalid UTF-8; content omitted";
    else if (kind === "symlink") file.note = "Link-target bytes only; symbolic link never followed";
    const oldText = oldBytes?.toString("utf8") || "", newText = newBytes?.toString("utf8") || "";
    if (["text", "symlink"].includes(kind)) {
      const patch = unifiedDiff(name2, oldText, newText), changed = changedLineSets(patch);
      file.baseLineCount = entry ? linesOf(oldText).length : 0;
      file.headLineCount = state.exists ? linesOf(newText).length : 0;
      file.additions = changed.newLines.size;
      file.deletions = changed.oldLines.size;
      if (isTarget(file)) contents.set(name2, { base: oldBytes, head: newBytes, patch });
    }
    files.push(file);
  }
  files.sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
  const fingerprint = canonical({ range: { head: range.headSha, target: range.targetSha, base: range.baseSha }, names, index: [...index], states: [...states].map(([name2, s]) => [name2, s.exists, s.mode ?? null, s.sha256 ?? null, s.gitOid ?? null]) });
  delete range.emptyTree;
  return { range, files, contents, fingerprint };
}
function externalOutput(git, value) {
  const output = path3.resolve(value), parent = fs3.realpathSync(path3.dirname(output)), resolved = path3.join(parent, path3.basename(output));
  if (inside(git.root, resolved) || inside(git.gitDir, resolved) || inside(git.commonDir, resolved)) throw new PreparationError("output-in-repository", "Output must be outside the input repository and Git metadata");
  externalDestination(resolved);
  try {
    if (fs3.lstatSync(resolved).isSymbolicLink()) throw new PreparationError("output-symlink", "Output leaf must not be a symbolic link");
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  return resolved;
}
function prepare({ repo, out, target, requirements = [], extension = "", methodRoot = METHOD_ROOT, _testAfterRead } = {}) {
  let git;
  const attempts = [];
  try {
    if (!repo || !out) throw new PreparationError("arguments", "repo and out are required");
    git = createGit(repo);
    const output = externalOutput(git, out), resolvedParent = path3.dirname(output);
    if (fs3.existsSync(output)) throw new PreparationError("output-exists", "Refusing to overwrite an existing bundle");
    const sources = prepareRequirements(requirements), method = methodVersion(methodRoot), rulesFile = JSON.parse(fs3.readFileSync(path3.join(methodRoot, "rules/builtin.json"), "utf8"));
    const rules = rulesFile.rules.map((rule) => ({ kind: "builtin", ...rule }));
    const ext = normalizeLF(extension), hasExtension = Boolean(ext.trim());
    if (hasExtension) rules.push({ kind: "project", id: "extension", sha256: sha256(ext) });
    let captured;
    for (let attempt = 0; attempt < 3; attempt++) {
      const first = readState(git, target);
      _testAfterRead?.({ attempt, root: git.root });
      const second = readState(git, target);
      if (first.fingerprint === second.fingerprint) {
        captured = first;
        attempts.push({ attempt, stable: true });
        break;
      }
      attempts.push({ attempt, stable: false });
    }
    if (!captured) throw new PreparationError("changed-during-read", "Repository did not stabilize after two retries");
    const commits = blobsOf(git, [captured.range.headSha, captured.range.baseSha]);
    const subject = (id2) => Array.from((commits.get(id2)?.toString("utf8").split(/\n\n/).slice(1).join("\n\n").split("\n")[0] || "").replace(/[\u0000-\u001f\u007f]/g, "")).slice(0, 200).join("");
    captured.range.headSubject = subject(captured.range.headSha);
    captured.range.baseSubject = subject(captured.range.baseSha);
    const rulesVersion = sha256(canonical(rules));
    const snapshot = {
      snapshotId: "",
      status: "complete",
      createdAt: (/* @__PURE__ */ new Date()).toISOString(),
      range: captured.range,
      files: captured.files,
      requirements: sources,
      rulesVersion,
      promptVersion: method.promptVersion,
      ...hasExtension ? { extensionPrompt: { text: ext, sha256: sha256(ext), length: Array.from(ext).length } } : {},
      note: "Diffs compare raw frozen bytes; no Git filters, textconv or external diff are run"
    };
    snapshot.inputSha = inputFingerprint(snapshot);
    snapshot.snapshotId = "snap-" + snapshot.inputSha.slice(0, 24);
    const targets = captured.files.filter(isTarget).map((file) => file.path);
    const stage = fs3.mkdtempSync(path3.join(resolvedParent, "." + path3.basename(output) + ".staging-"));
    try {
      writeJson(path3.join(stage, "snapshot.json"), snapshot);
      writeJson(path3.join(stage, "requirements.json"), sources);
      writeJson(path3.join(stage, "targets.json"), targets);
      writeJson(path3.join(stage, "rules.json"), rules);
      for (const file of captured.files.filter(isTarget)) {
        const content = captured.contents.get(file.path);
        for (const side of ["base", "head"]) {
          const bytes = content[side];
          if (bytes === null) continue;
          const name2 = side === "base" ? file.oldPath || file.path : file.path;
          const dest = path3.join(stage, side, safeRelative(name2));
          fs3.mkdirSync(path3.dirname(dest), { recursive: true });
          fs3.writeFileSync(dest, bytes);
        }
        const diff = path3.join(stage, "diff", file.path + ".patch");
        fs3.mkdirSync(path3.dirname(diff), { recursive: true });
        fs3.writeFileSync(diff, content.patch);
      }
      if (hasExtension) fs3.writeFileSync(path3.join(stage, "extension.md"), ext);
      fs3.renameSync(stage, output);
    } catch (error) {
      fs3.rmSync(stage, { recursive: true, force: true });
      throw error;
    }
    return { status: "complete", bundle: output, inputSha: snapshot.inputSha, promptVersion: snapshot.promptVersion, rulesVersion, targetCount: targets.length, attempts, methodFiles: method.files, commands: git.log };
  } catch (error) {
    return { status: "incomplete", code: error.code || "preparation-failed", reason: error.message, attempts, commands: git?.log || [] };
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(path3.resolve(process.argv[1])).href) {
  const options = {};
  for (let i = 2; i < process.argv.length; i++) {
    const key = process.argv[i];
    if (!["--repo", "--out", "--target", "--requirements", "--extension", "--report"].includes(key) || !process.argv[i + 1]) {
      console.error("Usage: node core/prepare.mjs --repo PATH --out EXTERNAL_BUNDLE [--target REF] [--requirements SOURCES.json] [--extension FILE] [--report REPORT.json]");
      process.exit(2);
    }
    options[key.slice(2)] = process.argv[++i];
  }
  let result;
  try {
    const reportFile = options.report ? externalOutput(createGit(options.repo), options.report) : null;
    result = prepare({ repo: options.repo, out: options.out, target: options.target, requirements: options.requirements ? JSON.parse(fs3.readFileSync(options.requirements, "utf8")) : [], extension: options.extension ? fs3.readFileSync(options.extension, "utf8") : "" });
    if (reportFile) writeJson(reportFile, result);
  } catch (error) {
    result = { status: "incomplete", code: error.code || "invalid-input", reason: error.message };
  }
  console.log(JSON.stringify(result, null, 2));
  process.exitCode = result.status === "complete" ? 0 : 2;
}

// core/validate.mjs
import fs4 from "node:fs";
import path4 from "node:path";
import crypto3 from "node:crypto";
import { pathToFileURL as pathToFileURL2 } from "node:url";

// core/lib/schema.mjs
var SUPPORTED = /* @__PURE__ */ new Set(["$schema", "$id", "$defs", "$ref", "title", "description", "type", "const", "enum", "required", "properties", "additionalProperties", "items", "minItems", "maxItems", "minLength", "pattern", "minimum", "allOf", "anyOf", "oneOf", "not", "if", "then", "else"]);
function checkSchemaSupport(schema) {
  const walk = (node) => {
    if (!node || typeof node !== "object") return;
    if (node.$ref && Object.keys(node).some((key) => !["$ref", "description", "title"].includes(key))) throw Error("Unsupported validation siblings beside $ref");
    for (const key of Object.keys(node)) if (!SUPPORTED.has(key)) throw Error("Unsupported schema keyword: " + key);
    for (const key of ["$defs", "properties"]) for (const child of Object.values(node[key] || {})) walk(child);
    for (const key of ["items", "not", "if", "then", "else"]) if (node[key]) walk(node[key]);
    for (const key of ["allOf", "anyOf", "oneOf"]) for (const child of node[key] || []) walk(child);
  };
  walk(schema);
}
function structuralErrors(value, schema) {
  checkSchemaSupport(schema);
  const resolve = (ref) => {
    if (!ref.startsWith("#/")) throw Error("Only locked local schema refs are supported");
    return ref.slice(2).split("/").reduce((node, key) => node?.[key.replace(/~1/g, "/").replace(/~0/g, "~")], schema);
  };
  const visit = (value2, rule, where, depth = 0) => {
    if (depth > 100) return [where + ": schema depth exceeded"];
    if (rule.$ref) return visit(value2, resolve(rule.$ref), where, depth + 1);
    const errors = [], add = (text) => errors.push(where + ": " + text);
    if ("const" in rule && value2 !== rule.const) add("const mismatch");
    if (rule.enum && !rule.enum.includes(value2)) add("enum mismatch");
    const object = value2 !== null && typeof value2 === "object" && !Array.isArray(value2);
    if (rule.type) {
      const matches = rule.type === "object" ? object : rule.type === "array" ? Array.isArray(value2) : rule.type === "null" ? value2 === null : rule.type === "integer" ? Number.isSafeInteger(value2) : typeof value2 === rule.type;
      if (!matches) return [...errors, where + ": expected " + rule.type];
    }
    if (object) {
      for (const key of rule.required || []) if (!Object.hasOwn(value2, key)) add("missing " + key);
      for (const key of Object.keys(value2)) {
        if (rule.additionalProperties === false && !Object.hasOwn(rule.properties || {}, key)) add("unexpected " + key);
        if (rule.properties?.[key]) errors.push(...visit(value2[key], rule.properties[key], where + "." + key, depth + 1));
      }
    }
    if (Array.isArray(value2)) {
      if (rule.minItems !== void 0 && value2.length < rule.minItems) add("too few items");
      if (rule.maxItems !== void 0 && value2.length > rule.maxItems) add("too many items");
      if (rule.items) value2.forEach((item, index) => errors.push(...visit(item, rule.items, where + "[" + index + "]", depth + 1)));
    }
    if (typeof value2 === "string") {
      if (rule.minLength !== void 0 && Array.from(value2).length < rule.minLength) add("too short");
      if (rule.pattern && !new RegExp(rule.pattern, "u").test(value2)) add("pattern mismatch");
    }
    if (typeof value2 === "number" && rule.minimum !== void 0 && value2 < rule.minimum) add("below minimum");
    for (const child of rule.allOf || []) errors.push(...visit(value2, child, where, depth + 1));
    if (rule.anyOf && !rule.anyOf.some((child) => visit(value2, child, where, depth + 1).length === 0)) add("anyOf mismatch");
    if (rule.oneOf && rule.oneOf.filter((child) => visit(value2, child, where, depth + 1).length === 0).length !== 1) add("oneOf mismatch");
    if (rule.not && visit(value2, rule.not, where, depth + 1).length === 0) add("not mismatch");
    if (rule.if) {
      const branch = visit(value2, rule.if, where, depth + 1).length === 0 ? rule.then : rule.else;
      if (branch) errors.push(...visit(value2, branch, where, depth + 1));
    }
    return errors;
  };
  return visit(value, schema, "$");
}

// core/validate.mjs
function readFrozen(root, name2) {
  const parts = safeRelative(name2).split("/");
  let file = root;
  for (const part of parts) {
    file = path4.join(file, part);
    const stat = fs4.lstatSync(file);
    if (stat.isSymbolicLink()) throw Error("Bundle contains a symbolic link: " + name2);
  }
  if (!fs4.statSync(file).isFile()) throw Error("Bundle entry is not a file: " + name2);
  return fs4.readFileSync(file);
}
function loadBundle(directory) {
  const root = fs4.realpathSync(directory), read = (name2) => JSON.parse(readFrozen(root, name2).toString("utf8"));
  const snapshot = read("snapshot.json"), requirements = read("requirements.json"), targets = read("targets.json"), rules = read("rules.json");
  if (!["complete", "incomplete"].includes(snapshot.status) || !snapshot.range || !Array.isArray(snapshot.files) || !Array.isArray(requirements) || !Array.isArray(targets) || !Array.isArray(rules)) throw Error("Malformed bundle metadata");
  if (canonical(requirements) !== canonical(snapshot.requirements) || canonical(prepareRequirements(requirements)) !== canonical(requirements)) throw Error("Frozen requirement source/item identity mismatch");
  const names = /* @__PURE__ */ new Set();
  for (const file of snapshot.files) {
    safeRelative(file.path);
    if (file.oldPath) safeRelative(file.oldPath);
    if (!["added", "modified", "deleted", "renamed", "mode-changed"].includes(file.change) || !["text", "binary", "oversize", "excluded", "submodule", "symlink", "conflicted"].includes(file.kind)) throw Error("Invalid snapshot file identity");
    if (file.change === "renamed" && !file.oldPath) throw Error("Renamed file needs oldPath");
    for (const side of ["base", "head"]) {
      const mode = file[side + "Mode"], hash = file[side + "Sha256"];
      if (!(mode === null || ["100644", "100755", "120000", "160000"].includes(mode)) || !(hash === null || typeof hash === "string" && /^[0-9a-f]{64}$/.test(hash)) || mode === null !== (hash === null)) throw Error("Invalid snapshot side identity");
    }
    if (names.has(file.path)) throw Error("Duplicate snapshot path");
    names.add(file.path);
  }
  const expectedTargets = snapshot.files.filter(isTarget).map((f) => f.path).sort();
  if (canonical([...targets].sort()) !== canonical(expectedTargets) || new Set(targets).size !== targets.length) throw Error("targets do not match snapshot-derived review scope");
  if (snapshot.inputSha !== inputFingerprint(snapshot) || snapshot.rulesVersion !== sha256(canonical(rules)) || !/^[0-9a-f]{64}$/.test(snapshot.promptVersion)) throw Error("Bundle fingerprints do not match");
  const ruleKeys = /* @__PURE__ */ new Set();
  for (const rule of rules) {
    if (!["builtin", "project", "user"].includes(rule.kind) || typeof rule.id !== "string" || !rule.id || ruleKeys.has(rule.kind + ":" + rule.id)) throw Error("Invalid/duplicate bundle rule");
    ruleKeys.add(rule.kind + ":" + rule.id);
  }
  const expected = /* @__PURE__ */ new Set(["snapshot.json", "requirements.json", "targets.json", "rules.json"]);
  const extension = rules.filter((rule) => rule.kind === "project" && rule.id === "extension");
  if (snapshot.extensionPrompt) {
    if (extension.length !== 1) throw Error("Extension rule missing");
    const bytes = readFrozen(root, "extension.md");
    expected.add("extension.md");
    const text = bytes.toString("utf8");
    if (text !== normalizeLF(text) || snapshot.extensionPrompt.text !== text || sha256(bytes) !== snapshot.extensionPrompt.sha256 || extension[0].sha256 !== sha256(bytes) || snapshot.extensionPrompt.length !== Array.from(text).length) throw Error("Extension bytes/rule/snapshot disagree");
  } else if (extension.length) throw Error("Unexpected extension rule");
  const texts = /* @__PURE__ */ new Map(), files = /* @__PURE__ */ new Map(), changed = /* @__PURE__ */ new Map();
  for (const file of snapshot.files.filter(isTarget)) {
    files.set(file.path, file);
    for (const side of ["base", "head"]) {
      const hash = file[side + "Sha256"];
      if (hash === null) continue;
      if (!/^[0-9a-f]{64}$/.test(hash)) throw Error("Invalid side hash");
      const name2 = side === "base" ? file.oldPath || file.path : file.path, relative2 = side + "/" + name2;
      expected.add(relative2);
      const bytes = readFrozen(root, relative2);
      if (sha256(bytes) !== hash) throw Error("Frozen side sha256 mismatch: " + relative2);
      const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
      texts.set(side + ":" + name2, { file, side, text, lines: linesOf(text), sha256: hash });
    }
    const old = texts.get("base:" + (file.oldPath || file.path))?.text || "", head = texts.get("head:" + file.path)?.text || "";
    const relative = "diff/" + file.path + ".patch";
    expected.add(relative);
    const patch = readFrozen(root, relative).toString("utf8");
    if (patch !== unifiedDiff(file.path, old, head)) throw Error("Frozen diff does not match frozen sides");
    changed.set(file.path, changedLineSets(patch));
  }
  const walk = (directory2, prefix = "") => {
    for (const entry of fs4.readdirSync(directory2, { withFileTypes: true })) {
      const relative = prefix + entry.name;
      if (entry.isSymbolicLink()) throw Error("Symbolic link in bundle");
      if (entry.isDirectory()) walk(path4.join(directory2, entry.name), relative + "/");
      else if (!expected.has(relative)) throw Error("Unexpected bundle file: " + relative);
    }
  };
  walk(root);
  return { root, snapshot, requirements, targets, rules, ruleKeys, texts, files, changed };
}
function validate(bundleDirectory, model, { runId = crypto3.randomUUID(), schemaPath = path4.join(METHOD_ROOT, "schema/run.schema.json"), schemaBytes } = {}) {
  const failed = (layer, errors2) => ({ status: "failed", layer, errors: errors2, withheld: [], downgrades: [], complete: false, formal: null });
  let bundle;
  try {
    bundle = loadBundle(bundleDirectory);
  } catch (error) {
    return failed("bundle-integrity", [error.message]);
  }
  let errors;
  try {
    errors = structuralErrors(model, JSON.parse(schemaBytes ?? fs4.readFileSync(schemaPath, "utf8")));
  } catch (error) {
    return failed(1, [error.message]);
  }
  if (errors.length) return failed(1, errors);
  const { snapshot, requirements, targets, ruleKeys } = bundle;
  const invariant = [];
  const sameSet = (a, b) => a.length === b.length && new Set(a).size === a.length && a.every((x) => b.includes(x));
  if (model.inputSha !== snapshot.inputSha) invariant.push("inputSha mismatch");
  if (model.promptVersion !== snapshot.promptVersion) invariant.push("promptVersion mismatch");
  if (!sameSet(model.files.map((f) => f.path), targets)) invariant.push("files must cover every target exactly once");
  const items = requirements.flatMap((source) => source.items.map((item) => ({ ...item, source, text: Array.from(source.text).slice(item.start, item.end).join("") }))), byItem = new Map(items.map((item) => [item.itemId, item]));
  if (!sameSet(model.alignment.map((row) => row.requirementItemId), items.map((item) => item.itemId))) invariant.push("alignment must cover each frozen requirement item exactly once");
  if (model.overview.requirementStatus !== (requirements.length ? "checked" : "no-requirement")) invariant.push("requirementStatus mismatch");
  if (!requirements.length && (model.alignment.length || model.extras.length)) invariant.push("alignment/extras must be empty without requirements");
  const featureById = new Map(model.features.map((f) => [f.featureId, f]));
  if (featureById.size !== model.features.length) invariant.push("duplicate featureId");
  for (const feature of model.features) {
    if (new Set(feature.files).size !== feature.files.length || feature.files.some((file) => !targets.includes(file))) invariant.push("feature files outside targets or duplicated");
    for (const file of feature.files) if (!model.files.find((entry) => entry.path === file)?.featureIds.includes(feature.featureId)) invariant.push("feature/file reverse membership mismatch");
  }
  for (const file of model.files) {
    if (new Set(file.featureIds).size !== file.featureIds.length) invariant.push("duplicate file featureIds");
    for (const id2 of file.featureIds) if (!featureById.get(id2)?.files.includes(file.path)) invariant.push("dangling/inconsistent featureId");
  }
  for (const finding of model.findings) if (!ruleKeys.has(finding.ruleSource.kind + ":" + finding.ruleSource.id)) invariant.push("unknown ruleSource kind/id");
  if (invariant.length) return failed(2, invariant);
  const withheld = [], downgrades = [];
  const hold = (kind, ref, code, reason) => withheld.push({ kind, ref, code, reason, layer: kind === "finding" ? 4 : 3 });
  const lookup = (ref) => {
    safeRelative(ref.path);
    const side = bundle.texts.get(ref.side + ":" + ref.path);
    if (!side || !Number.isSafeInteger(ref.startLine) || !Number.isSafeInteger(ref.endLine) || ref.startLine < 1 || ref.endLine < ref.startLine || ref.endLine > side.lines.length) throw Error("Path, side or frozen line range is invalid");
    return { ...side, normalized: { path: side.file.path, side: ref.side, startLine: ref.startLine, endLine: ref.endLine } };
  };
  const statement = (entry, ref) => {
    if (!entry.refs.length) {
      hold("statement", ref, "missing-ref", "Statement needs a valid frozen reference");
      return null;
    }
    try {
      return { ...entry, refs: entry.refs.map((item) => lookup(item).normalized), basis: "model" };
    } catch (error) {
      hold("statement", ref, "invalid-ref", error.message);
      return null;
    }
  };
  const features = model.features.map((f, i) => statement(structuredClone(f), "feature:" + f.featureId)).filter(Boolean);
  const retained = new Set(features.map((f) => f.featureId));
  const files = model.files.map((file) => {
    const items2 = file.semantic.items.map((entry, i) => statement(entry, "file:" + file.path + ":" + i)).filter(Boolean);
    let status = file.semantic.status;
    if (status === "stated" && !items2.length) {
      status = "unclear";
      downgrades.push({ ref: "file:" + file.path, code: "stated-without-items" });
      if (!file.semantic.items.length) hold("statement", "file:" + file.path, "missing-ref", "stated needs at least one supported item");
    }
    return { path: file.path, featureIds: file.featureIds.filter((id2) => retained.has(id2)), semantic: { status, items: items2 }, basis: "model" };
  });
  const impacts = model.impacts.map((entry, i) => statement(entry, "impact:" + i)).filter(Boolean);
  const extras = model.extras.map((entry, i) => statement(entry, "extra:" + i)).filter(Boolean);
  const alignment = model.alignment.map((entry) => {
    const row = structuredClone(entry);
    row.basis = "model";
    if (row.status === "superseded") {
      const old = byItem.get(row.requirementItemId), target = byItem.get(row.supersededBy);
      let reason = "";
      if (!target || target.itemId === old.itemId) reason = "Target requirement is missing or self";
      else if (!(target.source.order > old.source.order || target.source.order === old.source.order && target.start > old.start)) reason = "Target requirement is not strictly later";
      else if (!normalizeLF(row.supersededQuote).trim() || !target.text.includes(normalizeLF(row.supersededQuote))) reason = "Quote is not verbatim within the target requirement item";
      if (!reason) row.supersededQuote = normalizeLF(row.supersededQuote);
      if (reason) {
        row.status = "unclear";
        delete row.supersededBy;
        delete row.supersededQuote;
        row.note = "\u8C03\u6574\u4F9D\u636E\u672A\u901A\u8FC7\u6821\u9A8C\uFF0C\u9700\u786E\u8BA4\uFF1A" + reason;
        downgrades.push({ ref: "alignment:" + row.requirementItemId, code: "invalid-superseded", reason });
        hold("statement", "alignment:" + row.requirementItemId, "invalid-ref", reason);
      }
    } else {
      const valid = [];
      for (const ref of row.codeRefs) try {
        valid.push(lookup(ref).normalized);
      } catch (error) {
        hold("statement", "alignment:" + row.requirementItemId, "invalid-ref", error.message);
      }
      row.codeRefs = valid;
      if (["implemented", "partial"].includes(row.status) && snapshot.status !== "complete") {
        row.status = "unclear";
        row.note = "\u5BA1\u67E5\u8986\u76D6\u4E0D\u8DB3\uFF0C\u9700\u786E\u8BA4\uFF1A" + row.note;
        downgrades.push({ ref: "alignment:" + row.requirementItemId, code: "incomplete-coverage" });
      }
      if (["implemented", "partial"].includes(row.status) && !valid.length) {
        row.status = "unclear";
        row.note = "\u5B9E\u73B0\u4F9D\u636E\u672A\u901A\u8FC7\u6821\u9A8C\uFF0C\u9700\u786E\u8BA4\uFF1A" + row.note;
        downgrades.push({ ref: "alignment:" + row.requirementItemId, code: "missing-code-refs" });
        if (!entry.codeRefs.length) hold("statement", "alignment:" + row.requirementItemId, "missing-ref", "Implemented/partial needs valid code refs");
      }
    }
    return row;
  });
  const featureIds = Object.fromEntries(features.map((feature) => [feature.featureId, "feature-" + sha256(canonical([runId, feature.featureId])).slice(0, 24)]));
  const findings = [];
  model.findings.forEach((entry, index) => {
    try {
      const anchor = bundle.texts.get(entry.anchor.side + ":" + safeRelative(entry.anchor.path));
      if (!anchor) throw Error("Anchor path/side is absent");
      if (entry.anchor.line !== null && (entry.anchor.line < 1 || entry.anchor.line > anchor.lines.length)) throw Error("Anchor line is outside frozen text");
      const evidence = entry.evidence.map((ref) => {
        const side = lookup(ref), quote = side.lines.slice(ref.startLine - 1, ref.endLine).join("\n");
        if (normalizeLF(ref.quote) !== quote) throw Error("Evidence quote mismatch");
        return { ...side.normalized, sha256: side.sha256, quote };
      });
      const primary = evidence[0];
      if (primary.path !== anchor.file.path || primary.side !== entry.anchor.side) throw Error("Primary evidence must match anchor file and side");
      if (entry.anchor.line !== null && (entry.anchor.line < primary.startLine || entry.anchor.line > primary.endLine)) throw Error("Primary evidence does not cover anchor");
      const changed = bundle.changed.get(anchor.file.path)[entry.anchor.side === "base" ? "oldLines" : "newLines"];
      if (![...changed].some((line) => line >= primary.startLine && line <= primary.endLine)) throw Error("Primary evidence does not intersect changed lines");
      findings.push({ ...structuredClone(entry), findingId: "finding-" + sha256(canonical([runId, index])).slice(0, 24), runId, anchor: { ...entry.anchor, path: anchor.file.path }, evidence, basis: "verified" });
    } catch (error) {
      hold("finding", "finding:" + index, "invalid-evidence", error.message);
    }
  });
  const rank = { P0: 0, P1: 1, P2: 2 };
  findings.sort((a, b) => rank[a.severity] - rank[b.severity] || targets.indexOf(a.anchor.path) - targets.indexOf(b.anchor.path) || (a.anchor.line ?? Number.MAX_SAFE_INTEGER) - (b.anchor.line ?? Number.MAX_SAFE_INTEGER));
  const understanding = { overview: { ...model.overview, basis: "model" }, features: features.map((feature) => ({ ...feature, featureId: featureIds[feature.featureId] })), files: files.map((file) => ({ ...file, featureIds: file.featureIds.map((id2) => featureIds[id2]) })), impacts, alignment, extras };
  const coverage = { reviewed: [...targets], skipped: snapshot.files.filter((file) => !isTarget(file)).map((file) => ({ path: file.path, reason: file.note || "metadata-only" })), failed: [], withheld: withheld.map(({ kind, ref, code }) => ({ kind, ref, code })) };
  const complete = snapshot.status === "complete" && coverage.failed.length === 0 && withheld.length === 0 && sameSet(coverage.reviewed, targets);
  return { status: "succeeded", layer: 4, errors: [], withheld, downgrades, complete, mapping: { featureIds }, formal: { run: { runId, status: "succeeded", inputSha: snapshot.inputSha, promptVersion: snapshot.promptVersion, coverage, complete }, understanding, findings } };
}
if (process.argv[1] && import.meta.url === pathToFileURL2(path4.resolve(process.argv[1])).href) {
  const args = {};
  for (let i = 2; i < process.argv.length; i++) {
    if (!["--bundle", "--model", "--out"].includes(process.argv[i]) || !process.argv[i + 1]) {
      console.error("Usage: node core/validate.mjs --bundle DIR --model JSON [--out REPORT.json]");
      process.exit(2);
    }
    args[process.argv[i].slice(2)] = process.argv[++i];
  }
  try {
    const destination = args.out ? externalDestination(args.out) : null;
    if (destination && inside(fs4.realpathSync(args.bundle), destination)) throw Error("Validation report must not overwrite the frozen bundle");
    const raw = fs4.readFileSync(args.model, "utf8");
    let result;
    try {
      result = validate(args.bundle, JSON.parse(raw));
    } catch (error) {
      result = { status: "failed", layer: 1, errors: ["Invalid model JSON: " + error.message], withheld: [], downgrades: [], complete: false, formal: null };
    }
    if (destination) writeJson(destination, result);
    console.log(JSON.stringify(result, null, 2));
    process.exitCode = result.status === "failed" ? 1 : 0;
  } catch (error) {
    console.error(error.message);
    process.exitCode = 2;
  }
}

// core/lib/engine.mjs
import fs8 from "node:fs";
import path7 from "node:path";

// core/lib/store.mjs
import fs5 from "node:fs";
import path5 from "node:path";
import crypto4 from "node:crypto";
var clone = (value) => structuredClone(value);
var id = (value) => {
  if (typeof value !== "string" || !/^[A-Za-z0-9][A-Za-z0-9_.-]{0,180}$/.test(value) || value.includes("..")) throw Error("Invalid storage identity");
  return value;
};
var now = () => (/* @__PURE__ */ new Date()).toISOString();
var uuid = (prefix) => prefix + "-" + crypto4.randomUUID();
var FileStore = class {
  constructor(root) {
    externalDestination(root);
    fs5.mkdirSync(root, { recursive: true });
    this.root = fs5.realpathSync(root);
    this.tails = /* @__PURE__ */ new Map();
    this.poisoned = /* @__PURE__ */ new Set();
  }
  location(projectKey, ...pieces) {
    if (!/^[a-f0-9]{64}$/.test(projectKey)) throw Error("Invalid projectKey");
    const file = path5.join(this.root, projectKey, ...pieces.map(id));
    let cursor = this.root;
    for (const part of path5.relative(this.root, file).split(path5.sep)) {
      cursor = path5.join(cursor, part);
      if (fs5.existsSync(cursor) && fs5.lstatSync(cursor).isSymbolicLink()) throw Error("Storage symlink refused");
    }
    return file;
  }
  serial(key, action) {
    const next = (this.tails.get(key) ?? Promise.resolve()).catch(() => {
    }).then(action);
    this.tails.set(key, next);
    return next;
  }
  atomic(file, value, raw = false) {
    fs5.mkdirSync(path5.dirname(file), { recursive: true });
    if (fs5.existsSync(file) && !fs5.lstatSync(file).isFile()) throw Error("Storage target is not a regular file");
    const temporary = file + ".tmp-" + crypto4.randomUUID();
    const fd = fs5.openSync(temporary, fs5.constants.O_CREAT | fs5.constants.O_EXCL | fs5.constants.O_WRONLY | fs5.constants.O_NOFOLLOW, 384);
    try {
      try {
        fs5.writeFileSync(fd, raw ? value : JSON.stringify(value, null, 2) + "\n");
        fs5.fsyncSync(fd);
      } finally {
        fs5.closeSync(fd);
      }
      fs5.renameSync(temporary, file);
    } finally {
      fs5.rmSync(temporary, { force: true });
    }
  }
  read(key, directory, name2) {
    const file = this.location(key, directory, name2 + ".json");
    return fs5.existsSync(file) ? JSON.parse(fs5.readFileSync(file, "utf8")) : null;
  }
  list(key, directory) {
    const folder = this.location(key, directory);
    if (!fs5.existsSync(folder)) return [];
    return fs5.readdirSync(folder).filter((name2) => name2.endsWith(".json")).map((name2) => this.read(key, directory, name2.slice(0, -5)));
  }
  deliveries(key) {
    return this.list(key, "deliveries");
  }
  runs(key, snapshotId) {
    return this.list(key, "runs").filter((run) => !snapshotId || run.snapshotId === snapshotId);
  }
  delivery(key, deliveryId) {
    return this.read(key, "deliveries", deliveryId);
  }
  snapshot(key, snapshotId) {
    const file = this.location(key, "snapshots", snapshotId, "snapshot.json");
    return fs5.existsSync(file) ? JSON.parse(fs5.readFileSync(file, "utf8")) : null;
  }
  bundlePath(key, snapshotId) {
    return this.location(key, "snapshots", snapshotId, "blobs");
  }
  settings(key) {
    const file = this.location(key, "settings.json");
    return fs5.existsSync(file) ? JSON.parse(fs5.readFileSync(file, "utf8")) : { autoMode: false, targetBranch: "", extensionPrompt: "", exportEmbedDiff: false };
  }
  setSettings(key, settings) {
    return this.serial(key, () => this.atomic(this.location(key, "settings.json"), clone(settings)));
  }
  putDelivery(key, delivery, { create = false } = {}) {
    const data = clone(delivery);
    return this.serial(key, () => {
      if (!create && !this.delivery(key, data.deliveryId)) return false;
      this.atomic(this.location(key, "deliveries", data.deliveryId + ".json"), data);
      return true;
    });
  }
  updateDelivery(key, deliveryId, change) {
    return this.serial(key, () => {
      const data = this.delivery(key, deliveryId);
      if (!data) return null;
      change(data);
      this.atomic(this.location(key, "deliveries", deliveryId + ".json"), data);
      return data;
    });
  }
  putSnapshot(key, deliveryId, bundleDirectory, { snapshotId = uuid("snap"), trigger = "manual" } = {}) {
    const bundle = loadBundle(bundleDirectory);
    return this.serial(key, () => {
      const delivery = this.delivery(key, deliveryId);
      if (!delivery) throw Error("Delivery deleted");
      const destination = this.location(key, "snapshots", snapshotId);
      if (fs5.existsSync(destination)) throw Error("Snapshot is immutable");
      fs5.mkdirSync(path5.dirname(destination), { recursive: true });
      const stage = fs5.mkdtempSync(path5.join(path5.dirname(destination), ".staging-"));
      const snapshot = { ...clone(bundle.snapshot), snapshotId, deliveryId, projectKey: key, createdAt: now(), trigger };
      try {
        fs5.cpSync(bundle.root, path5.join(stage, "blobs"), { recursive: true });
        this.atomic(path5.join(stage, "snapshot.json"), snapshot);
        this.atomic(path5.join(stage, "blobs/snapshot.json"), snapshot);
        fs5.renameSync(stage, destination);
      } finally {
        fs5.rmSync(stage, { recursive: true, force: true });
      }
      delivery.snapshotIds = [...delivery.snapshotIds ?? [], snapshotId];
      delivery.latestSnapshotId = snapshotId;
      this.atomic(this.location(key, "deliveries", deliveryId + ".json"), delivery);
      return snapshot;
    });
  }
  putRun(key, run) {
    const data = clone(run);
    return this.serial(key, () => {
      if (!this.snapshot(key, data.snapshotId) || !this.delivery(key, data.deliveryId)) return false;
      this.atomic(this.location(key, "runs", data.runId + ".json"), data);
      return true;
    });
  }
  events(key, kind) {
    if (!["marks", "annotations"].includes(kind)) throw Error("Unknown event stream");
    const file = this.location(key, kind + ".jsonl");
    if (!fs5.existsSync(file)) return [];
    const text = fs5.readFileSync(file, "utf8"), lines = text.split("\n");
    lines.pop();
    return lines.filter(Boolean).map((line) => JSON.parse(line));
  }
  append(key, kind, event, { requireCurrent = false } = {}) {
    const value = clone(event);
    return this.serial(key, () => {
      if (!["marks", "annotations"].includes(kind)) throw Error("Unknown event stream");
      if (this.poisoned.has(key + ":" + kind)) throw Error("Event stream needs recovery after failed append");
      const snapshot = this.snapshot(key, value.snapshotId);
      if (!snapshot) throw Error("Snapshot deleted");
      if (requireCurrent && this.delivery(key, snapshot.deliveryId)?.current?.snapshotId !== value.snapshotId) throw Error("History is read-only");
      const file = this.location(key, kind + ".jsonl");
      fs5.mkdirSync(path5.dirname(file), { recursive: true });
      const fd = fs5.openSync(file, fs5.constants.O_CREAT | fs5.constants.O_APPEND | fs5.constants.O_WRONLY | fs5.constants.O_NOFOLLOW, 384);
      try {
        fs5.writeFileSync(fd, JSON.stringify(value) + "\n");
        fs5.fsyncSync(fd);
      } catch (error) {
        this.poisoned.add(key + ":" + kind);
        throw error;
      } finally {
        fs5.closeSync(fd);
      }
      return value;
    });
  }
  marks(key, snapshotId) {
    const map = /* @__PURE__ */ new Map();
    for (const event of this.events(key, "marks")) if (event.snapshotId === snapshotId) map.set(event.findingId, event);
    return [...map.values()];
  }
  annotations(key, snapshotId) {
    const map = /* @__PURE__ */ new Map();
    for (const event of this.events(key, "annotations")) if (event.snapshotId === snapshotId) {
      if (event.type === "delete") map.delete(event.annotationId);
      else map.set(event.annotationId, event);
    }
    return [...map.values()];
  }
  async recover() {
    for (const key of fs5.readdirSync(this.root).filter((name2) => /^[a-f0-9]{64}$/.test(name2))) await this.serial(key, () => {
      for (const kind of ["marks", "annotations"]) {
        const file = this.location(key, kind + ".jsonl");
        if (!fs5.existsSync(file)) continue;
        const bytes = fs5.readFileSync(file), end = bytes.lastIndexOf(10) + 1;
        const text = bytes.subarray(0, end).toString("utf8");
        text.split("\n").filter(Boolean).forEach((line) => JSON.parse(line));
        if (end !== bytes.length) this.atomic(file, text, true);
        this.poisoned.delete(key + ":" + kind);
      }
      for (const run of this.runs(key)) if (run.status === "running") {
        run.status = "failed";
        run.errorCode = "interrupted";
        run.complete = false;
        run.endedAt = now();
        this.atomic(this.location(key, "runs", run.runId + ".json"), run);
        const delivery = this.delivery(key, run.deliveryId);
        if (delivery?.activeRunId === run.runId && delivery.current?.generation === run.generation && delivery.current.snapshotId === run.snapshotId) {
          delivery.latestResultRunId = run.runId;
          this.atomic(this.location(key, "deliveries", delivery.deliveryId + ".json"), delivery);
        }
      }
      const folder = this.location(key, "runs");
      if (fs5.existsSync(folder)) {
        for (const name2 of fs5.readdirSync(folder)) if (name2.includes(".tmp-")) fs5.rmSync(this.location(key, "runs", name2));
      }
    });
  }
  _removeRecords(key, snapshots) {
    for (const run of this.runs(key)) if (snapshots.has(run.snapshotId)) fs5.rmSync(this.location(key, "runs", run.runId + ".json"), { force: true });
    for (const kind of ["marks", "annotations"]) {
      const remaining = this.events(key, kind).filter((event) => !snapshots.has(event.snapshotId));
      this.atomic(this.location(key, kind + ".jsonl"), remaining.map((event) => JSON.stringify(event) + "\n").join(""), true);
    }
    for (const snapshotId of snapshots) fs5.rmSync(this.location(key, "snapshots", snapshotId), { recursive: true, force: true });
  }
  _deleteDelivery(key, deliveryId) {
    const delivery = this.delivery(key, deliveryId);
    if (!delivery) return;
    this._removeRecords(key, new Set(delivery.snapshotIds ?? []));
    fs5.rmSync(this.location(key, "deliveries", deliveryId + ".json"), { force: true });
  }
  deleteDelivery(key, deliveryId) {
    return this.serial(key, () => this._deleteDelivery(key, deliveryId));
  }
  deleteSnapshot(key, snapshotId) {
    return this.serial(key, () => {
      const snapshot = this.snapshot(key, snapshotId);
      if (!snapshot) return;
      const delivery = this.delivery(key, snapshot.deliveryId);
      this._removeRecords(key, /* @__PURE__ */ new Set([snapshotId]));
      if (!delivery) return;
      delivery.snapshotIds = (delivery.snapshotIds ?? []).filter((id2) => id2 !== snapshotId);
      if (!delivery.snapshotIds.length) return this._deleteDelivery(key, delivery.deliveryId);
      delivery.latestSnapshotId = delivery.snapshotIds.at(-1);
      if (delivery.current?.snapshotId === snapshotId) {
        const latest = this.snapshot(key, delivery.latestSnapshotId);
        delivery.current = { snapshotId: latest.snapshotId, inputSha: latest.inputSha, generation: (delivery.current.generation ?? 0) + 1 };
        delete delivery.activeRunId;
      }
      this.atomic(this.location(key, "deliveries", delivery.deliveryId + ".json"), delivery);
    });
  }
  pin(key, deliveryId, value) {
    return this.updateDelivery(key, deliveryId, (d) => {
      if (d.archivedAt) throw Error("Archived delivery cannot be pinned");
      if (value) d.pinnedAt = now();
      else delete d.pinnedAt;
    });
  }
  archive(key, deliveryId, value) {
    return this.updateDelivery(key, deliveryId, (d) => {
      if (value) {
        d.archivedAt = now();
        delete d.pinnedAt;
      } else delete d.archivedAt;
    });
  }
  assertOutsideRepository(repoRoot) {
    if (inside(fs5.realpathSync(repoRoot), this.root)) throw Error("Storage must be outside the input repository");
  }
};

// core/lib/deliveries.mjs
import fs6 from "node:fs";
var projectFor = (repoRoot) => ({ projectKey: sha256(fs6.realpathSync(repoRoot)), repoRoot: fs6.realpathSync(repoRoot) });
async function developmentSession(adapter, sessionId) {
  const seen = /* @__PURE__ */ new Set();
  let session = sessionId ? await adapter.session(sessionId) : null;
  while (session?.origin === "subagent" && session.parentSession) {
    if (seen.has(session.id)) throw Error("Cyclic parent Session");
    seen.add(session.id);
    session = await adapter.session(session.parentSession);
  }
  return session?.kind === "review" ? null : session;
}
var Deliveries = class {
  constructor(store) {
    this.store = store;
    this.tails = /* @__PURE__ */ new Map();
  }
  binding({ branch, targetBranch, session }) {
    return branch && branch !== targetBranch ? { kind: "branch", value: branch } : session ? { kind: "session", value: session.id } : { kind: "manual", value: uuid("manual") };
  }
  findOpen(projectKey, input) {
    const bindKey = input.bindKey || this.binding(input);
    return this.store.deliveries(projectKey).find((d) => !d.closedAt && d.branch === input.branch && d.bindKey.kind === bindKey.kind && d.bindKey.value === bindKey.value);
  }
  observe(project, input) {
    const next = (this.tails.get(project.projectKey) ?? Promise.resolve()).catch(() => {
    }).then(() => this._observe(project, input));
    this.tails.set(project.projectKey, next);
    return next;
  }
  async _observe(project, { branch, targetBranch, session, requirements = [], headSha, baseSha, targetSha, reachable, hasChanges = true }) {
    const key = project.projectKey;
    const bindKey = this.binding({ branch, targetBranch, session });
    let delivery = this.findOpen(key, { branch, bindKey });
    let closed = null;
    if (delivery?.everAhead && delivery.lastHeadSha && await reachable(delivery.lastHeadSha, targetSha)) {
      closed = await this.store.updateDelivery(key, delivery.deliveryId, (d) => {
        if (!d.closedAt) {
          d.closedAt = now();
          d.archivedAt = d.closedAt;
          delete d.pinnedAt;
        }
      });
      delivery = null;
      if (!hasChanges) return { delivery: closed, closed, shouldFreeze: false };
    }
    if (!delivery && !hasChanges) {
      const previous = this.store.deliveries(key).find((d) => d.closedAt && d.branch === branch && d.bindKey.kind === bindKey.kind && d.bindKey.value === bindKey.value);
      if (previous) return { delivery: previous, closed: null, shouldFreeze: false };
    }
    if (!delivery) {
      const first = [...requirements].sort((a, b) => a.order - b.order)[0]?.text.trim().split("\n")[0];
      const titleSource = first ? "requirement" : branch ? "branch" : "session";
      delivery = {
        deliveryId: uuid("delivery"),
        projectKey: key,
        bindKey,
        title: Array.from(first || branch || session?.title || "\u672C\u6B21\u4EA4\u4ED8").slice(0, 120).join(""),
        titleSource,
        branch: branch || "",
        sessionIds: [],
        createdAt: now(),
        latestSnapshotId: null,
        snapshotIds: [],
        everAhead: false
      };
      await this.store.putDelivery(key, delivery, { create: true });
    }
    delivery = await this.store.updateDelivery(key, delivery.deliveryId, (d) => {
      d.lastHeadSha = headSha;
      d.everAhead ||= headSha !== baseSha;
      if (session) d.sessionIds = [...d.sessionIds.filter((id2) => id2 !== session.id), session.id];
    });
    return { delivery, closed, shouldFreeze: true };
  }
};

// core/lib/scheduler.mjs
var Scheduler = class {
  constructor() {
    this.projects = /* @__PURE__ */ new Map();
  }
  state(key) {
    if (!this.projects.has(key)) this.projects.set(key, { active: null, pending: /* @__PURE__ */ new Map(), draining: false, idleWaiters: [] });
    return this.projects.get(key);
  }
  submit(key, request) {
    const state = this.state(key);
    const promise = new Promise((resolve, reject) => {
      const prior = state.pending.get(request.deliveryId);
      if (prior) {
        const paths = /* @__PURE__ */ new Set([...prior.paths, ...request.paths]);
        const force = prior.force || request.force, whole = prior.whole || request.whole, incremental = prior.incremental || request.incremental;
        const waiters = [...prior.waiters, { resolve, reject }];
        Object.assign(prior, request, { paths, force, whole, incremental, scope: paths.size > 1 ? "incremental" : request.scope, waiters });
      } else state.pending.set(request.deliveryId, { ...request, paths: new Set(request.paths), waiters: [{ resolve, reject }] });
    });
    if (state.active?.deliveryId === request.deliveryId && state.active.generation !== request.generation) state.active.controller.abort(new Error("superseded"));
    this.drain(key);
    return promise;
  }
  async drain(key) {
    const state = this.state(key);
    if (state.draining) return;
    state.draining = true;
    try {
      while (state.pending.size) {
        const [deliveryId, job] = state.pending.entries().next().value;
        state.pending.delete(deliveryId);
        const controller = new AbortController();
        let settled;
        const finished = new Promise((resolve) => {
          settled = resolve;
        });
        state.active = { ...job, controller, finished };
        try {
          const result = await job.execute(job, controller.signal);
          job.waiters.forEach((w) => w.resolve(result));
        } catch (error) {
          job.waiters.forEach((w) => w.reject(error));
        } finally {
          state.active = null;
          settled();
        }
      }
    } finally {
      state.draining = false;
      for (const resolve of state.idleWaiters.splice(0)) resolve();
    }
  }
  async cancelDelivery(key, deliveryId, predicate = () => true) {
    const state = this.state(key), pending = state.pending.get(deliveryId);
    if (pending && predicate(pending)) {
      state.pending.delete(deliveryId);
      pending.waiters.forEach((w) => w.resolve({ status: "cancelled", errorCode: "deleted" }));
    }
    if (state.active?.deliveryId === deliveryId && predicate(state.active)) {
      const active = state.active;
      active.controller.abort(new Error("deleted"));
      await active.finished;
    }
  }
  idle(key) {
    const state = this.state(key);
    return !state.draining ? Promise.resolve() : new Promise((resolve) => state.idleWaiters.push(resolve));
  }
};

// core/lib/adapters.mjs
function assertAdapter(adapter) {
  for (const method of ["review", "session", "getDraft", "writeDraft", "copy"]) if (typeof adapter?.[method] !== "function") throw Error("Missing adapter capability: " + method);
  return adapter;
}

// core/lib/method.mjs
import fs7 from "node:fs";
import path6 from "node:path";
function freezeMethod(methodRoot, snapshot, bundle) {
  const manifest = methodVersion(methodRoot);
  if (manifest.promptVersion !== snapshot.promptVersion) throw Error("method-version-mismatch");
  const modules = manifest.files.map((item) => {
    const bytes = fs7.readFileSync(path6.join(methodRoot, item.path));
    if (sha256(bytes) !== item.sha256) throw Error("method-changed-during-injection");
    return Object.freeze({ ...item, text: new TextDecoder("utf-8", { fatal: true }).decode(bytes) });
  });
  if (snapshot.extensionPrompt) {
    const bytes = fs7.readFileSync(path6.join(bundle, "extension.md")), text = bytes.toString("utf8");
    if (normalizeLF(text) !== text || sha256(bytes) !== snapshot.extensionPrompt.sha256 || text !== snapshot.extensionPrompt.text) throw Error("extension-integrity");
    modules.push(Object.freeze({ path: "bundle/extension.md", sha256: sha256(bytes), text }));
  }
  return Object.freeze(modules);
}

// core/lib/incremental.mjs
var copy = (value) => structuredClone(value);
function carryable(snapshot, sourceSnapshot, sourceRun) {
  const same = sourceSnapshot && sourceRun && sourceSnapshot.deliveryId === snapshot.deliveryId && sourceRun.deliveryId === snapshot.deliveryId && ["succeeded", "partial"].includes(sourceRun.status) && snapshot.rulesVersion === sourceSnapshot.rulesVersion && snapshot.promptVersion === sourceSnapshot.promptVersion && requirementDigest(snapshot.requirements) === requirementDigest(sourceSnapshot.requirements);
  if (!same) return [];
  return snapshot.files.filter(isTarget).filter((file) => {
    const old = sourceSnapshot.files.find((f) => f.path === file.path);
    return old && canonical(fileIdentity(file)) === canonical(fileIdentity(old)) && sourceRun.coverage.reviewed.includes(file.path) && !(sourceRun.withheldDetails ?? []).some((item) => item.paths === null || item.paths.includes(file.path));
  }).map((file) => file.path);
}
function affectedWithheld(model, withheld, snapshot) {
  const normalize = (name2) => snapshot.files.find((f) => f.path === name2 || f.oldPath === name2)?.path ?? name2;
  return withheld.map((item) => {
    let paths = null;
    if (item.kind === "finding") {
      const finding = model.findings[Number(item.ref.slice("finding:".length))];
      if (finding) paths = [normalize(finding.anchor.path)];
    } else if (item.ref.startsWith("file:")) {
      const file = snapshot.files.find((f) => item.ref === "file:" + f.path || item.ref.startsWith("file:" + f.path + ":"));
      if (file) paths = [file.path];
    } else if (item.ref.startsWith("feature:")) paths = model.features.find((f) => f.featureId === item.ref.slice(8))?.files ?? null;
    return { ...copy(item), paths };
  });
}
function remapResult(source, { runId, snapshotId, generation, deliveryId }) {
  const result = copy(source), features = Object.fromEntries(result.understanding.features.map((f) => [f.featureId, "feature-" + sha256(canonical([runId, f.featureId])).slice(0, 24)]));
  const findingIds = {};
  result.understanding.features.forEach((f) => {
    f.featureId = features[f.featureId];
  });
  result.understanding.files.forEach((f) => {
    f.featureIds = f.featureIds.map((id2) => features[id2]);
    f.carriedFrom = { runId: source.runId, snapshotId: source.snapshotId };
  });
  result.findings.forEach((f) => {
    const old = f.findingId, id2 = "finding-" + sha256(canonical([runId, old])).slice(0, 24);
    findingIds[old] = id2;
    f.findingId = id2;
    f.runId = runId;
    f.carriedFrom = { runId: source.runId, snapshotId: source.snapshotId, findingId: old };
  });
  Object.assign(result, { runId, snapshotId, generation, deliveryId, carriedFrom: { runId: source.runId, snapshotId: source.snapshotId } });
  return { result, findingIds };
}
function applyScope(validation, model, snapshot, reviewedPaths, carriedPaths = [], sourceRun = null) {
  const { run, understanding, findings } = copy(validation.formal);
  const all = snapshot.files.filter(isTarget).map((f) => f.path), actual = /* @__PURE__ */ new Set([...reviewedPaths, ...carriedPaths]);
  const withheldDetails = affectedWithheld(model, validation.withheld, snapshot);
  const acceptedFindings = findings.filter((f) => reviewedPaths.includes(f.anchor.path));
  for (const finding of findings.filter((f) => !reviewedPaths.includes(f.anchor.path))) {
    run.coverage.withheld.push({ kind: "finding", ref: finding.findingId, code: "out-of-scope" });
    withheldDetails.push({ kind: "finding", ref: finding.findingId, code: "out-of-scope", paths: [finding.anchor.path] });
  }
  const inheritedMarks = [];
  if (sourceRun) for (const name2 of carriedPaths) {
    const fresh = understanding.files.find((f) => f.path === name2), old = sourceRun.understanding.files.find((f) => f.path === name2);
    if (fresh && old) Object.assign(fresh, { semantic: copy(old.semantic), basis: old.basis, carriedFrom: { runId: sourceRun.runId, snapshotId: sourceRun.snapshotId } });
    for (const oldFinding of sourceRun.findings.filter((f) => f.anchor.path === name2)) {
      const findingId = "finding-" + sha256(canonical([run.runId, oldFinding.findingId])).slice(0, 24);
      acceptedFindings.push({ ...copy(oldFinding), findingId, runId: run.runId, carriedFrom: { runId: sourceRun.runId, snapshotId: sourceRun.snapshotId, findingId: oldFinding.findingId } });
      inheritedMarks.push({ oldFindingId: oldFinding.findingId, findingId, oldSnapshotId: sourceRun.snapshotId });
    }
  }
  run.coverage.reviewed = all.filter((name2) => actual.has(name2));
  const covered = run.coverage.reviewed.length === all.length;
  if (!covered) {
    for (const row of understanding.alignment) if (["implemented", "partial"].includes(row.status)) {
      row.status = "unclear";
      row.note = "\u5BA1\u67E5\u8986\u76D6\u4E0D\u8DB3\uFF0C\u9700\u786E\u8BA4\uFF1A" + row.note;
    }
  }
  run.status = covered ? "succeeded" : "partial";
  run.complete = snapshot.status === "complete" && run.status === "succeeded" && !run.coverage.failed.length && !run.coverage.withheld.length && covered;
  const rank = { P0: 0, P1: 1, P2: 2 };
  acceptedFindings.sort((a, b) => rank[a.severity] - rank[b.severity] || all.indexOf(a.anchor.path) - all.indexOf(b.anchor.path) || (a.anchor.line ?? Infinity) - (b.anchor.line ?? Infinity));
  return { ...run, understanding, findings: acceptedFindings, withheldDetails, inheritedMarks };
}
var scopePaths = (scope, targets) => {
  if (scope === "all" || scope === "incremental") return new Set(targets);
  if (typeof scope !== "string" || !scope.startsWith("file:") || !targets.includes(scope.slice(5))) throw Error("Invalid review scope or non-target file");
  return /* @__PURE__ */ new Set([scope.slice(5)]);
};
var covers = (run, paths) => run.status === "succeeded" && run.complete && [...paths].every((p) => run.coverage.reviewed.includes(p));

// core/lib/engine.mjs
var clone2 = (x) => structuredClone(x);
var ReviewCore = class {
  constructor({ storageRoot, store = storageRoot && new FileStore(storageRoot), adapter, methodRoot = METHOD_ROOT } = {}) {
    if (!store) throw Error("A storage adapter or storageRoot is required");
    this.store = store;
    this.adapter = assertAdapter(adapter);
    this.methodRoot = methodRoot;
    this.deliveries = new Deliveries(store);
    this.scheduler = new Scheduler();
    this.deletedSnapshots = /* @__PURE__ */ new Set();
    this.deletedDeliveries = /* @__PURE__ */ new Set();
  }
  async initialize() {
    await this.store.recover();
    return this;
  }
  async trigger({ repo, target, sessionId, requirements = [], extension, scope = "incremental", force = false, trigger = "manual", captureOnly = false, expectedDeliveryId, onPrepared, _testAfterRead } = {}) {
    let temp;
    try {
      if (trigger === "auto") {
        const source = sessionId ? await this.adapter.session(sessionId) : null;
        if (!source || source.kind === "review") return { status: "skipped", code: source ? "own-review-session" : "no-development-session" };
      }
      const git = createGit(repo);
      preflight(git);
      this.store.assertOutsideRepository(git.root);
      const project = projectFor(git.root), settings = this.store.settings(project.projectKey);
      if (trigger === "auto" && !settings.autoMode && !captureOnly) return { status: "skipped", code: "auto-disabled" };
      requirements = prepareRequirements(requirements);
      const effectiveTarget = target ?? (settings.targetBranch || void 0), range = rangeOf(git, effectiveTarget);
      const branchName = git.run(["rev-parse", "--abbrev-ref", "HEAD"]).toString().trim(), branch = branchName === "HEAD" ? "" : branchName;
      if (!branch) return { status: "incomplete", code: "branch-unavailable", reason: "Cannot group a delivery without a confirmed current branch" };
      const targetBranch = branchLabelOf(git, range.targetRef);
      const observedState = readState(git, effectiveTarget);
      const session = await developmentSession(this.adapter, sessionId);
      if (trigger === "auto" && !session) return { status: "skipped", code: "own-review-or-missing-parent" };
      if (expectedDeliveryId && this.deliveries.findOpen(project.projectKey, { branch, targetBranch, session })?.deliveryId !== expectedDeliveryId) return { status: "incomplete", code: "delivery-context-changed", reason: "\u5F53\u524D\u5206\u652F\u6216\u5F00\u53D1\u4F1A\u8BDD\u5DF2\u6539\u53D8\uFF0C\u8BF7\u91CD\u65B0\u6253\u5F00\u4EA4\u4ED8" };
      const observation = await this.deliveries.observe(project, {
        branch,
        targetBranch,
        session,
        requirements,
        headSha: range.headSha,
        baseSha: range.baseSha,
        targetSha: range.targetSha,
        hasChanges: observedState.files.length > 0,
        reachable: async (a, b) => {
          try {
            git.run(["merge-base", "--is-ancestor", a, b]);
            return true;
          } catch {
            return false;
          }
        }
      });
      if (!observation.shouldFreeze) return { status: "closed", delivery: observation.delivery };
      const captures = this.store.location(project.projectKey, "captures");
      fs8.mkdirSync(captures, { recursive: true });
      temp = path7.join(captures, uuid("bundle"));
      const frozen = prepare({ repo: git.root, out: temp, target: effectiveTarget, requirements, extension: extension ?? settings.extensionPrompt, methodRoot: this.methodRoot, _testAfterRead });
      if (frozen.status !== "complete") return frozen;
      const captured = loadBundle(temp);
      if (captured.snapshot.range.headSha !== range.headSha || git.run(["rev-parse", "--abbrev-ref", "HEAD"]).toString().trim() !== branchName) return { status: "incomplete", code: "branch-or-head-changed" };
      return await this.requestBundle({ projectKey: project.projectKey, deliveryId: observation.delivery.deliveryId, bundle: temp, scope, force, trigger, captureOnly, onPrepared, sourceSessionId: session?.id });
    } catch (error) {
      return { status: "incomplete", code: error.code || "preparation-failed", reason: error.message };
    } finally {
      if (temp) fs8.rmSync(temp, { recursive: true, force: true });
    }
  }
  async requestBundle({ projectKey, deliveryId, bundle, scope = "incremental", force = false, trigger = "manual", captureOnly = false, onPrepared, sourceSessionId }) {
    if (this.deletedDeliveries.has(deliveryId)) throw Error("Delivery deleted");
    const input = loadBundle(bundle), delivery = this.store.delivery(projectKey, deliveryId);
    if (!delivery) throw Error("Delivery not found");
    const paths = scopePaths(scope, input.targets);
    let snapshot;
    if ((trigger === "auto" || captureOnly) && delivery.current?.inputSha === input.snapshot.inputSha) snapshot = this.store.snapshot(projectKey, delivery.current.snapshotId);
    else snapshot = await this.store.putSnapshot(projectKey, deliveryId, bundle, { trigger });
    const current = await this.store.updateDelivery(projectKey, deliveryId, (d) => {
      const generation = d.current ? d.current.generation + Number(d.current.inputSha !== snapshot.inputSha) : 1;
      d.current = { snapshotId: snapshot.snapshotId, inputSha: snapshot.inputSha, generation };
      d.latestSnapshotId = snapshot.snapshotId;
    });
    if (!current || this.deletedDeliveries.has(deliveryId)) return { status: "cancelled", errorCode: "deleted" };
    await onPrepared?.({ projectKey, deliveryId, snapshotId: snapshot.snapshotId, inputSha: snapshot.inputSha, generation: current.current.generation });
    if (captureOnly) {
      await this.scheduler.cancelDelivery(projectKey, deliveryId, (job) => job.inputSha !== snapshot.inputSha);
      const latest = this.store.delivery(projectKey, deliveryId)?.current;
      if (latest?.generation !== current.current.generation || latest.snapshotId !== snapshot.snapshotId) return { status: "cancelled", errorCode: "superseded" };
      return { status: "pending", projectKey, deliveryId, snapshotId: snapshot.snapshotId, inputSha: snapshot.inputSha, generation: latest.generation };
    }
    return this.scheduler.submit(projectKey, {
      projectKey,
      deliveryId,
      snapshot,
      snapshotId: snapshot.snapshotId,
      inputSha: snapshot.inputSha,
      generation: current.current.generation,
      sourceSessionId,
      paths,
      whole: scope === "all" || scope === "incremental",
      incremental: scope === "incremental",
      force,
      scope,
      execute: (job, signal) => this.execute(job, signal)
    });
  }
  async reviewCurrent(projectKey, deliveryId, { scope = "incremental", force = false } = {}) {
    const d = this.store.delivery(projectKey, deliveryId);
    if (!d?.current) throw Error("No current snapshot");
    const snapshot = this.store.snapshot(projectKey, d.current.snapshotId), targets = snapshot.files.filter(isTarget).map((f) => f.path);
    return this.scheduler.submit(projectKey, {
      projectKey,
      deliveryId,
      snapshot,
      snapshotId: snapshot.snapshotId,
      inputSha: snapshot.inputSha,
      generation: d.current.generation,
      paths: scopePaths(scope, targets),
      whole: scope === "all" || scope === "incremental",
      incremental: scope === "incremental",
      force,
      scope,
      execute: (job, signal) => this.execute(job, signal)
    });
  }
  currentMatches(job) {
    const d = this.store.delivery(job.projectKey, job.deliveryId);
    return d?.current?.generation === job.generation && d.current.snapshotId === job.snapshotId && !this.deletedSnapshots.has(job.snapshotId) && !this.deletedDeliveries.has(job.deliveryId);
  }
  async copyMarks(key, maps, newSnapshotId) {
    for (const { oldSnapshotId, oldFindingId, findingId } of maps) {
      const mark = this.store.marks(key, oldSnapshotId).find((m) => m.findingId === oldFindingId);
      if (mark) await this.store.append(key, "marks", { ...clone2(mark), snapshotId: newSnapshotId, findingId, at: now(), carriedFrom: { snapshotId: oldSnapshotId, findingId: oldFindingId } });
    }
  }
  async commit(job, run) {
    if (this.deletedSnapshots.has(job.snapshotId) || this.deletedDeliveries.has(job.deliveryId)) return run;
    if (!await this.store.putRun(job.projectKey, run)) return run;
    await this.store.updateDelivery(job.projectKey, job.deliveryId, (d) => {
      if (d.current?.generation === job.generation && d.current.snapshotId === job.snapshotId && d.activeRunId === run.runId) d.latestResultRunId = run.runId;
    });
    return run;
  }
  async execute(job, signal) {
    const key = job.projectKey;
    if (!this.currentMatches(job)) return { status: "cancelled", errorCode: "superseded" };
    const paths = job.whole ? job.snapshot.files.filter(isTarget).map((f) => f.path) : [...job.paths];
    const candidates = this.store.runs(key).filter((r) => r.deliveryId === job.deliveryId && r.understanding).sort((a, b) => (b.endedAt || "").localeCompare(a.endedAt || ""));
    const cached = !job.force && candidates.find((r) => r.inputSha === job.inputSha && covers(r, paths));
    if (cached && cached.snapshotId === job.snapshotId && cached.generation === job.generation) return { ...clone2(cached), deduplicated: true };
    const runId = uuid("run"), startedAt = now();
    let run = {
      runId,
      generation: job.generation,
      snapshotId: job.snapshotId,
      deliveryId: job.deliveryId,
      inputSha: job.inputSha,
      promptVersion: job.snapshot.promptVersion,
      scope: job.scope,
      requestedPaths: paths,
      startedAt,
      status: "running",
      complete: false,
      injectedModules: [],
      coverage: { reviewed: [], skipped: [], failed: [], withheld: [] },
      model: { adapter: this.adapter.kind || "host" }
    };
    await this.store.putRun(key, run);
    await this.store.updateDelivery(key, job.deliveryId, (d) => {
      if (d.current?.generation === job.generation && d.current.snapshotId === job.snapshotId) d.activeRunId = runId;
    });
    try {
      signal.throwIfAborted();
      if (!this.currentMatches(job)) {
        const error = Error("superseded");
        error.code = "superseded";
        throw error;
      }
      if (cached) {
        const { result, findingIds } = remapResult(cached, { runId, snapshotId: job.snapshotId, generation: job.generation, deliveryId: job.deliveryId });
        run = { ...result, startedAt, endedAt: now(), scope: job.scope, requestedPaths: paths, status: "succeeded", complete: true };
        await this.copyMarks(key, Object.entries(findingIds).map(([oldFindingId, findingId]) => ({ oldFindingId, findingId, oldSnapshotId: cached.snapshotId })), job.snapshotId);
        return await this.commit(job, run);
      }
      const bundleRoot = this.store.bundlePath(key, job.snapshotId), bundle = loadBundle(bundleRoot);
      const modules = freezeMethod(this.methodRoot, job.snapshot, bundleRoot);
      const schemaBytes = modules.find((m) => m.path === "schema/run.schema.json").text;
      checkSchemaSupport(JSON.parse(schemaBytes));
      run.injectedModules = modules.map(({ path: path12, sha256: sha2562 }) => ({ path: path12, sha256: sha2562 }));
      let source = null, carried = [];
      if (!job.force) for (const candidate of candidates) {
        const eligible = carryable(job.snapshot, this.store.snapshot(key, candidate.snapshotId), candidate).filter((p) => !paths.includes(p) || job.incremental);
        if (eligible.length > carried.length) {
          source = candidate;
          carried = eligible;
        }
      }
      const reviewed = paths.filter((p) => !carried.includes(p));
      let model;
      if (!bundle.targets.length) {
        model = {
          schemaVersion: 1,
          inputSha: job.inputSha,
          promptVersion: job.snapshot.promptVersion,
          overview: { purpose: "\u672C\u6B21\u4EC5\u5305\u542B\u6587\u4EF6\u5143\u6570\u636E\u53D8\u5316\uFF0C\u65E0\u53EF\u5BA1\u67E5\u6587\u672C\u3002", requirementStatus: bundle.requirements.length ? "checked" : "no-requirement" },
          features: [],
          files: [],
          impacts: [],
          extras: [],
          findings: [],
          alignment: bundle.requirements.flatMap((s) => s.items.map((i) => ({ requirementItemId: i.itemId, status: "unclear", codeRefs: [], note: "\u672C\u6B21\u6CA1\u6709\u53EF\u5BA1\u67E5\u6587\u672C\uFF0C\u9700\u786E\u8BA4" })))
        };
      } else model = await this.adapter.review(Object.freeze({ runId, sourceSessionId: job.sourceSessionId, snapshot: clone2(job.snapshot), bundleRoot, modules, reviewPaths: Object.freeze(reviewed), carriedPaths: Object.freeze(carried), tools: Object.freeze([]) }), { signal });
      const late = signal.aborted;
      const validation = validate(bundleRoot, model, { runId, schemaBytes });
      if (validation.status === "failed") {
        run.status = "failed";
        run.errorCode = "validation-layer-" + validation.layer;
        run.errors = validation.errors;
      } else {
        const scoped = applyScope(validation, model, job.snapshot, reviewed, carried, source);
        run = { ...run, ...scoped };
        if (!late) await this.copyMarks(key, scoped.inheritedMarks, job.snapshotId);
        delete run.inheritedMarks;
        if (!bundle.targets.length) {
          run.understanding.overview.basis = "fact";
          run.understanding.alignment.forEach((row) => {
            row.basis = "fact";
          });
          run.model = { adapter: "none-metadata-only" };
        }
      }
      if (late) {
        run.status = "cancelled";
        run.errorCode = "cancelled";
        run.complete = false;
        run.lateResult = true;
      }
    } catch (error) {
      run.status = signal.aborted || error.code === "superseded" ? "cancelled" : "failed";
      run.errorCode = signal.aborted ? "cancelled" : error.message;
      run.complete = false;
    }
    run.endedAt = now();
    return this.commit(job, run);
  }
  writable(key, snapshotId, readOnly) {
    const snapshot = this.store.snapshot(key, snapshotId);
    if (!snapshot) throw Error("Snapshot missing");
    const d = this.store.delivery(key, snapshot.deliveryId);
    if (readOnly || d?.current?.snapshotId !== snapshotId) throw Error("History is read-only");
    return snapshot;
  }
  async mark(key, { snapshotId, findingId, suppressed, by = "reviewer", readOnly = false }) {
    this.writable(key, snapshotId, readOnly);
    if (typeof suppressed !== "boolean" || !this.store.runs(key, snapshotId).some((r) => r.findings?.some((f) => f.findingId === findingId))) throw Error("Finding does not belong to snapshot");
    return this.store.append(key, "marks", { snapshotId, findingId, suppressed, by, at: now() }, { requireCurrent: true });
  }
  async annotate(key, { snapshotId, annotationId = uuid("annotation"), findingId, anchor, text, readOnly = false }) {
    this.writable(key, snapshotId, readOnly);
    if (typeof text !== "string") throw Error("Annotation text must be plain text");
    text = normalizeLF(text);
    if (!text.trim() || Array.from(text).length > 2e3) throw Error("Annotation text must contain 1..2000 code points");
    const bundle = loadBundle(this.store.bundlePath(key, snapshotId));
    if (findingId) {
      const finding = this.store.runs(key, snapshotId).flatMap((r) => r.findings ?? []).find((f) => f.findingId === findingId);
      if (!finding) throw Error("Foreign finding");
      anchor = { ...finding.anchor, startLine: finding.anchor.line, endLine: finding.anchor.line };
    }
    const file = bundle.snapshot.files.find((f) => f.path === anchor?.path);
    const side = file && bundle.texts.get(anchor.side + ":" + (anchor.side === "base" ? file.oldPath || file.path : file.path));
    if (!side || !["base", "head"].includes(anchor.side)) throw Error("No frozen text at anchor");
    if (!findingId && anchor.sha256 !== side.sha256) throw Error("Annotation hash mismatch");
    const { startLine, endLine } = anchor;
    if (!(startLine === null && endLine === null) && !(Number.isInteger(startLine) && Number.isInteger(endLine) && startLine >= 1 && endLine >= startLine && endLine <= side.lines.length)) throw Error("Annotation range invalid");
    const old = this.store.annotations(key, snapshotId).find((a) => a.annotationId === annotationId) || this.store.events(key, "annotations").find((a) => a.snapshotId === snapshotId && a.annotationId === annotationId && a.type === "upsert");
    if (this.store.events(key, "annotations").some((a) => a.annotationId === annotationId && a.snapshotId !== snapshotId)) throw Error("Annotation belongs to another snapshot");
    return this.store.append(key, "annotations", {
      type: "upsert",
      annotationId,
      snapshotId,
      anchor: { path: file.path, side: anchor.side, startLine, endLine, sha256: side.sha256 },
      text,
      ...findingId ? { findingId } : {},
      createdAt: old?.createdAt || now(),
      updatedAt: now()
    }, { requireCurrent: true });
  }
  async deleteAnnotation(key, snapshotId, annotationId, readOnly = false) {
    this.writable(key, snapshotId, readOnly);
    if (!this.store.annotations(key, snapshotId).some((a) => a.annotationId === annotationId)) throw Error("Annotation missing");
    return this.store.append(key, "annotations", { type: "delete", snapshotId, annotationId, at: now() }, { requireCurrent: true });
  }
  async deleteSnapshot(key, snapshotId) {
    const snapshot = this.store.snapshot(key, snapshotId);
    if (!snapshot) return;
    this.deletedSnapshots.add(snapshotId);
    await this.store.updateDelivery(key, snapshot.deliveryId, (d) => {
      if (d.current?.snapshotId === snapshotId) d.current.generation++;
    });
    await this.scheduler.cancelDelivery(key, snapshot.deliveryId, (job) => job.snapshotId === snapshotId);
    await this.store.deleteSnapshot(key, snapshotId);
  }
  async deleteDelivery(key, deliveryId) {
    this.deletedDeliveries.add(deliveryId);
    await this.store.updateDelivery(key, deliveryId, (d) => {
      if (d.current) d.current.generation++;
    });
    await this.scheduler.cancelDelivery(key, deliveryId);
    await this.store.deleteDelivery(key, deliveryId);
  }
  selected(key, snapshotId) {
    const snapshot = this.store.snapshot(key, snapshotId);
    if (!snapshot) throw Error("Snapshot missing");
    const delivery = this.store.delivery(key, snapshot.deliveryId);
    const candidates = this.store.runs(key, snapshotId).sort((a, b) => (b.endedAt || b.startedAt).localeCompare(a.endedAt || a.startedAt));
    const run = candidates.find((r) => r.runId === delivery.activeRunId && ["running", "queued"].includes(r.status)) || candidates.find((r) => r.runId === delivery.latestResultRunId) || candidates[0] || null;
    const annotations = this.store.annotations(key, snapshotId), linked = new Set(annotations.map((a) => a.findingId).filter(Boolean));
    const associatedFindings = candidates.flatMap((r) => r.findings ?? []).filter((f) => linked.has(f.findingId)).map(({ findingId, title, anchor }) => ({ findingId, title, anchor }));
    return { snapshot, delivery, run, marks: this.store.marks(key, snapshotId), annotations, associatedFindings, bundleRoot: this.store.bundlePath(key, snapshotId) };
  }
};

// core/lib/requirements.mjs
var RequirementLedger = class {
  constructor(rows = []) {
    this.rows = structuredClone(rows);
    if (new Set(this.rows.map((r) => r.sourceKey)).size !== this.rows.length || this.rows.some((r, i) => r.source.order !== i)) throw Error("Invalid persisted requirement ledger");
    if (canonical(prepareRequirements(this.rows.map((r) => r.source))) !== canonical(this.rows.map((r) => r.source))) throw Error("Persisted requirement identity mismatch");
  }
  captureMessages(sessionId, messages) {
    if (typeof sessionId !== "string" || !sessionId || !Array.isArray(messages)) throw Error("Requirement message order unconfirmed");
    let previous = -1;
    const staged = structuredClone(this.rows);
    for (const m of messages) {
      if (!Number.isSafeInteger(m.sequence) || m.sequence < 0 || m.sequence <= previous || typeof m.id !== "string" || !m.id || typeof m.text !== "string") throw Error("Requirement message order unconfirmed");
      previous = m.sequence;
      const sourceKey = "message:" + sessionId + ":" + m.id, old = staged.find((r) => r.sourceKey === sourceKey);
      if (old) {
        if (old.sequence !== m.sequence || old.source.text !== normalizeLF(m.text)) throw Error("Previously captured requirement identity changed");
        continue;
      }
      const latest = Math.max(-1, ...staged.filter((r) => r.sessionId === sessionId).map((r) => r.sequence));
      if (m.sequence <= latest) throw Error("Late historical message cannot be reordered behind a manual requirement");
      staged.push({ sourceKey, sessionId, sequence: m.sequence, source: prepareRequirements([{ kind: "session-message", text: m.text, origin: sessionId, order: staged.length }])[0] });
    }
    this.rows = staged;
    return this.sources();
  }
  captureManual({ id: id2, source, sessionId = null, messages = [] }) {
    const before = structuredClone(this.rows);
    try {
      if (sessionId) this.captureMessages(sessionId, messages);
      else if (messages.length) throw Error("Messages need a confirmed Session identity");
      if (typeof id2 !== "string" || !id2 || !["file", "paste"].includes(source.kind)) throw Error("Invalid manual requirement source");
      const sourceKey = "manual:" + id2, old = this.rows.find((r) => r.sourceKey === sourceKey);
      const prepared = prepareRequirements([{ ...source, order: old?.source.order ?? this.rows.length }])[0];
      if (old) {
        if (old.source.sha256 !== prepared.sha256 || old.source.kind !== prepared.kind) throw Error("Manual source identity changed");
        return structuredClone(old.source);
      }
      this.rows.push({ sourceKey, source: prepared });
      return structuredClone(prepared);
    } catch (error) {
      this.rows = before;
      throw error;
    }
  }
  sources() {
    return structuredClone(this.rows.map((r) => r.source));
  }
  state() {
    return structuredClone(this.rows);
  }
};

// core/lib/export.mjs
import fs9 from "node:fs";
import path8 from "node:path";
import crypto5 from "node:crypto";
var escapeHTML = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
var mdText = (value) => String(value ?? "").replace(/[\\`*_{}\[\]<>#|!]/g, "\\$&");
function redactText(text, patterns = []) {
  let value = String(text ?? "").replace(/\/Users\/[^\s/]+|\/home\/[^\s/]+/g, "[\u672C\u673A\u7528\u6237\u76EE\u5F55]").replace(/(^|[\s('"=])\/(?:private\/tmp|tmp|(?:private\/)?var\/folders)\/[^\s'"<>)]*/g, "$1[\u672C\u673A\u4E34\u65F6\u76EE\u5F55]").replace(/\b(?:sk-[A-Za-z0-9_-]{12,}|gh[pousr]_[A-Za-z0-9]{20,}|AKIA[A-Z0-9]{16})\b/g, "[\u5DF2\u8131\u654F]").replace(/\bBearer\s+[^\s"'<>]{8,}/gi, "Bearer [\u5DF2\u8131\u654F]").replace(/\b(api[_-]?key|access[_-]?token|refresh[_-]?token|password|secret|authorization)\s*[:=]\s*["']?[^\s"',;<>]+["']?/gi, "$1=[\u5DF2\u8131\u654F]").replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, "[\u90AE\u4EF6\u5DF2\u8131\u654F]");
  for (const pattern of patterns) value = value.replace(pattern, "[\u5DF2\u8131\u654F]");
  return value;
}
function sanitize(value, patterns = []) {
  if (typeof value === "string") return redactText(value, patterns);
  if (Array.isArray(value)) return value.map((x) => sanitize(x, patterns));
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, sanitize(v, patterns)]));
  return value;
}
function activeFindings(run, marks = []) {
  const suppressed = new Set(marks.filter((m) => m.suppressed).map((m) => m.findingId));
  return (run?.findings ?? []).filter((f) => !suppressed.has(f.findingId));
}
function reviewStatus(snapshot, run, marks = []) {
  if (!run) return "\u5C1A\u672A\u5BA1\u67E5";
  const count = activeFindings(run, marks).length;
  const complete = snapshot.status === "complete" && run.status === "succeeded" && run.complete === true && !run.coverage?.failed.length && !run.coverage?.withheld.length && snapshot.files.filter(isTarget).every((f) => run.coverage.reviewed.includes(f.path));
  if (complete) return count ? `\u53D1\u73B0 ${count} \u4E2A\u95EE\u9898` : "\u672A\u53D1\u73B0\u95EE\u9898";
  const reasons = [];
  if (snapshot.status !== "complete") reasons.push("\u5FEB\u7167\u4E0D\u5B8C\u6574");
  if (run.status === "failed") reasons.push("\u5BA1\u67E5\u5931\u8D25");
  if (run.status === "cancelled") reasons.push("\u5BA1\u67E5\u5DF2\u53D6\u6D88");
  if (run.coverage?.withheld.length) reasons.push(`${run.coverage.withheld.length} \u6761\u7ED3\u8BBA\u672A\u901A\u8FC7\u6821\u9A8C`);
  const pending = snapshot.files.filter(isTarget).filter((f) => !run.coverage?.reviewed.includes(f.path)).length;
  if (pending) reasons.push(`${pending} \u4E2A\u6587\u4EF6\u672A\u5B8C\u6210`);
  return (count ? `\u53D1\u73B0 ${count} \u4E2A\u95EE\u9898 \xB7 ` : "") + (reasons.join("\uFF1B") || "\u5BA1\u67E5\u672A\u5B8C\u6210");
}
var locationLabel = (anchor) => anchor.startLine === null || anchor.line === null ? `${anchor.path}\uFF08\u6587\u4EF6\u7EA7\uFF09` : `${anchor.path}:${anchor.startLine ?? anchor.line}${anchor.endLine && anchor.endLine !== anchor.startLine ? "\u2013" + anchor.endLine : ""}\uFF08${anchor.side}\uFF09`;
function compareSnapshots(current, previous) {
  if (!previous) return { added: [], changed: [], removed: [], note: "\u65E0\u4E0A\u4E00\u6761\u5BA1\u67E5\u8BB0\u5F55" };
  const old = new Map(previous.files.map((f) => [f.path, f]));
  return {
    added: current.files.filter((f) => !old.has(f.path)).map((f) => f.path),
    changed: current.files.filter((f) => old.has(f.path) && canonical(fileIdentity(f)) !== canonical(fileIdentity(old.get(f.path)))).map((f) => f.path),
    removed: previous.files.filter((f) => !current.files.some((n) => n.path === f.path)).map((f) => f.path)
  };
}
function exportData(context, { previousSnapshot = null, embedDiff = false, maxSnippetLines = 12, maxSnippetBytes = 8192, maxDiffBytes = 256 * 1024, patterns = [] } = {}) {
  const { snapshot, delivery, run, marks = [], annotations = [], associatedFindings = [], bundleRoot } = context;
  const data = sanitize({ version: 1, snapshot, delivery, run, marks, annotations, associatedFindings, status: reviewStatus(snapshot, run, marks), comparison: compareSnapshots(snapshot, previousSnapshot), snippets: [], fullDiff: [], omissions: [], limitations: ["\u6807\u4E3A\u6A21\u578B\u63A8\u65AD\u7684\u8BF4\u660E\u4E0D\u4EE3\u8868\u5DF2\u9A8C\u8BC1\u4E8B\u5B9E\uFF1B\u95EE\u9898\u8BC1\u636E\u6821\u9A8C\u53EA\u8BC1\u660E\u51FA\u5904\uFF0C\u4E0D\u4FDD\u8BC1\u5224\u65AD\u51C6\u786E\u3002"] }, patterns);
  data.transformedForExport = true;
  data.snapshot.requirements.forEach((source, index) => {
    const original = snapshot.requirements[index];
    source.redacted = source.text !== original.text;
    source.rangesReferToOriginal = true;
    source.items.forEach((item) => {
      item.text = redactText(Array.from(original.text).slice(item.start, item.end).join(""), patterns);
    });
  });
  if (run?.model?.adapter === "synthetic") data.limitations.unshift("\u5408\u6210\u9002\u914D\u5668\u6D4B\u8BD5\u8F93\u51FA\uFF1A\u672C\u8BB0\u5F55\u672A\u8C03\u7528\u771F\u5B9E\u6A21\u578B\uFF0C\u4E0D\u662F\u5B9E\u9645\u4EE3\u7801\u5BA1\u67E5\u7ED3\u8BBA\u3002");
  if (data.snapshot.extensionPrompt) {
    const ext = data.snapshot.extensionPrompt, original = snapshot.extensionPrompt.text;
    ext.originalLength = snapshot.extensionPrompt.length;
    ext.redacted = ext.text !== original;
    ext.truncated = false;
    if (Buffer.byteLength(ext.text) > 16 * 1024) {
      delete ext.text;
      ext.truncated = true;
      data.omissions.push({ path: "extensionPrompt.text", reason: "\u6269\u5C55\u6B63\u6587\u8D85\u8FC716KiB\uFF0C\u4EC5\u4FDD\u7559\u539F\u59CB\u54C8\u5E0C\u53CA\u957F\u5EA6\u6458\u8981" });
    }
  }
  if (!bundleRoot) return data;
  const bundle = loadBundle(bundleRoot), refs = [], seen = /* @__PURE__ */ new Set();
  for (const f of run?.understanding?.features ?? []) refs.push(...f.refs);
  for (const f of run?.findings ?? []) refs.push(...f.evidence);
  for (const ref of refs) {
    const identity = canonical([ref.path, ref.side, ref.startLine, ref.endLine]);
    if (seen.has(identity)) continue;
    seen.add(identity);
    const file = snapshot.files.find((f) => f.path === ref.path || f.oldPath === ref.path);
    const side = file && bundle.texts.get(ref.side + ":" + (ref.side === "base" ? file.oldPath || file.path : file.path));
    if (!side) {
      data.omissions.push({ path: redactText(ref.path, patterns), reason: "\u65E0\u51BB\u7ED3\u6587\u672C\u7247\u6BB5" });
      continue;
    }
    const end = Math.min(ref.endLine, ref.startLine + maxSnippetLines - 1);
    const code = redactText(side.lines.slice(ref.startLine - 1, end).join("\n"), patterns);
    if (end < ref.endLine || Buffer.byteLength(code) > maxSnippetBytes) {
      data.omissions.push({ path: redactText(ref.path, patterns), reason: "\u7247\u6BB5\u8D85\u8FC7\u884C\u6570\u6216\u5B57\u8282\u4E0A\u9650" });
      continue;
    }
    data.snippets.push({ path: redactText(file.path, patterns), side: ref.side, startLine: ref.startLine, endLine: end, text: code });
  }
  for (const file of snapshot.files.filter((f) => !isTarget(f))) data.omissions.push({ path: redactText(file.path, patterns), reason: file.note || "\u4EC5\u5143\u6570\u636E\uFF0C\u4E0D\u5D4C\u5165\u6E90\u7801" });
  if (embedDiff) for (const file of snapshot.files.filter(isTarget)) {
    const text = redactText(fs9.readFileSync(path8.join(bundleRoot, "diff", file.path + ".patch"), "utf8"), patterns);
    if (Buffer.byteLength(text) > maxDiffBytes) data.omissions.push({ path: redactText(file.path, patterns), reason: "\u5B8C\u6574Diff\u8D85\u8FC7\u7247\u6BB5\u5B57\u8282\u4E0A\u9650" });
    else data.fullDiff.push({ path: redactText(file.path, patterns), text });
  }
  return data;
}
var refsText = (refs) => refs.map((r) => `${r.path}:${r.startLine}\u2013${r.endLine}\uFF08${r.side}\uFF09`).join("\u3001");
var sourceItems = (data) => data.snapshot.requirements.flatMap((s) => s.items.map((i) => ({ ...i, text: i.text ?? Array.from(s.text).slice(i.start, i.end).join("") })));
function sections(data) {
  const u = data.run?.understanding, items = new Map(sourceItems(data).map((i) => [i.itemId, i.text]));
  const rows = [
    ["\u9700\u6C42\u4F9D\u636E", data.snapshot.requirements.map((s) => `${s.order}. ${s.origin}
${s.text}`)],
    ["\u53D8\u66F4\u6982\u89C8", u ? [u.overview.purpose, ...u.features.map((f) => `${f.title}\uFF1A${f.purpose}`)] : ["\u5C1A\u65E0\u901A\u8FC7\u6821\u9A8C\u7684\u8BF4\u660E"]],
    ["\u6309\u529F\u80FD\u53D8\u66F4", (u?.features ?? []).map((f) => `${f.title}
${f.approach}
\u6587\u4EF6\uFF1A${f.files.join("\u3001")}
\u5F15\u7528\uFF1A${refsText(f.refs)}`)],
    ["\u6587\u4EF6\u6E05\u5355", data.snapshot.files.map((f) => `${f.path} \xB7 ${f.change} \xB7 +${f.additions ?? 0}/-${f.deletions ?? 0} \xB7 ${f.kind}${f.note ? " \xB7 " + f.note : ""}`)],
    ["\u884C\u4E3A\u5F71\u54CD", (u?.impacts ?? []).map((i) => `${i.kind}\uFF1A${i.text}\uFF08${refsText(i.refs)}\uFF09`)]
  ];
  for (const [title, statuses] of [["\u672A\u5BF9\u9F50 / \u5F85\u786E\u8BA4", ["partial", "not-found", "unclear"]], ["\u5DF2\u5BF9\u9F50", ["implemented"]], ["\u5DF2\u8C03\u6574", ["superseded"]]]) {
    const group = (u?.alignment ?? []).filter((r) => statuses.includes(r.status)).map((r) => `${items.get(r.requirementItemId) ?? r.requirementItemId}
${r.status}\uFF1A${r.note}${r.status === "superseded" ? "\n\u540E\u7EED\u8981\u6C42\u5F15\u6587\uFF1A" + r.supersededQuote : "\n" + refsText(r.codeRefs)}`);
    if (group.length) rows.push([title, group]);
  }
  if (u?.extras.length) rows.push(["\u9700\u6C42\u5916\u6539\u52A8", u.extras.map((e) => `${e.text}\uFF08${refsText(e.refs)}\uFF09`)]);
  const marks = new Set(data.marks.filter((m) => m.suppressed).map((m) => m.findingId));
  rows.push(["\u95EE\u9898\u4E0E\u5904\u7F6E", (data.run?.findings ?? []).map((f) => `${f.severity} ${f.title} \xB7 ${locationLabel(f.anchor)}${marks.has(f.findingId) ? " \xB7 \u5DF2\u6807\u8BB0\u4E3A\u975E\u95EE\u9898" : ""}
${f.problem}
\u5F71\u54CD\uFF1A${f.impact}${f.suggestion ? "\n\u4FEE\u6539\u5EFA\u8BAE\uFF1A" + f.suggestion.text + (f.suggestion.code ? "\n" + f.suggestion.code : "") : ""}`)]);
  rows.push(["\u6279\u6CE8\uFF08\u8BC4\u5BA1\u4EBA\u610F\u89C1\uFF0C\u672A\u7ECF\u6A21\u578B\u6821\u9A8C\uFF09", data.annotations.map((a) => `${locationLabel(a.anchor)}${a.findingId ? " \xB7 \u5173\u8054\u95EE\u9898\uFF1A" + (data.run?.findings?.find((f) => f.findingId === a.findingId)?.title ?? data.associatedFindings?.find((f) => f.findingId === a.findingId)?.title ?? a.findingId) + (marks.has(a.findingId) ? "\uFF08\u539F\u95EE\u9898\u5DF2\u6807\u8BB0\u4E3A\u975E\u95EE\u9898\uFF09" : "") : ""}
${a.text}
${a.updatedAt}`)]);
  rows.push(["\u4E0E\u4E0A\u6B21\u5BA1\u67E5\u76F8\u6BD4", [data.comparison.note ?? `\u65B0\u589E\uFF1A${data.comparison.added.join("\u3001") || "\u65E0"}\uFF1B\u53D8\u5316\uFF1A${data.comparison.changed.join("\u3001") || "\u65E0"}\uFF1B\u79FB\u9664\uFF1A${data.comparison.removed.join("\u3001") || "\u65E0"}`]]);
  rows.push(["\u5C40\u9650", data.limitations]);
  return rows;
}
function heading(data) {
  const range = data.snapshot.range;
  return [
    `${data.delivery.title}${data.delivery.externalRef ? " \xB7 " + data.delivery.externalRef : ""}`,
    `\u5206\u652F\uFF1A${data.delivery.branch || "\u5206\u652F\u4FE1\u606F\u4E0D\u53EF\u7528"} \xB7 \u8303\u56F4\uFF1A${range.targetRef} merge-base \u2194 \u5DE5\u4F5C\u6811`,
    `\u5BA1\u67E5\u65F6\u95F4\uFF1A${data.run?.endedAt || data.snapshot.createdAt} \xB7 \u57FA\u4E8E\u63D0\u4EA4\uFF1A${range.headSubject || "\u63D0\u4EA4"}\uFF08${(range.headSha || "").slice(0, 8)}\uFF09${range.dirty ? " \xB7 \u542B\u672A\u63D0\u4EA4\u6539\u52A8" : ""}`,
    (data.summaryOnly ? "\u62A5\u544A\u4EC5\u6458\u8981\uFF08\u6B63\u6587\u6709\u7701\u7565\uFF09 \xB7 \u539F\u5BA1\u67E5\u72B6\u6001\uFF1A" : "") + (data.run?.model?.adapter === "synthetic" ? "\u5408\u6210\u6D4B\u8BD5\uFF08\u672A\u8C03\u7528\u771F\u5B9E\u6A21\u578B\uFF09 \xB7 \u5408\u540C\u63A8\u5BFC\u72B6\u6001\uFF1A" : "") + data.status,
    `\u5185\u7F6E\u89C4\u5219\u7248\u672C\uFF1A${data.snapshot.rulesVersion} \xB7 \u6269\u5C55\u63D0\u793A\u8BCD\uFF1A${data.snapshot.extensionPrompt ? "\u5DF2\u4F7F\u7528 \xB7 " + data.snapshot.extensionPrompt.originalLength + " \u5B57" : "\u672A\u4F7F\u7528"}`
  ];
}
function markdown(context, options = {}) {
  const data = exportData(context, options), header = heading(data);
  const lines = ["# " + mdText(header[0]), ...header.slice(1).map(mdText), ""];
  for (const [title, entries] of sections(data)) {
    lines.push("## " + title, "");
    for (const entry of entries.length ? entries : ["\u65E0"]) lines.push(mdText(entry), "");
  }
  if (data.omissions.length) lines.push("## \u7701\u7565\u6E05\u5355", "", ...data.omissions.map((o) => `${mdText(o.path)}\uFF1A${mdText(o.reason)}`));
  return lines.join("\n");
}
function renderHTML(data, nonce) {
  const header = heading(data), esc = escapeHTML;
  const renderDiff = (text) => '<pre class="report-diff">' + String(text).split("\n").map((line) => {
    const kind = line.startsWith("+") ? "add" : line.startsWith("-") ? "del" : line.startsWith("@@") ? "hunk" : "";
    return kind ? `<span class="report-diff-line report-diff-${kind}">${esc(line)}</span>` : esc(line);
  }).join("\n") + "</pre>";
  const sectionIds = {
    "\u9700\u6C42\u4F9D\u636E": "requirements",
    "\u53D8\u66F4\u6982\u89C8": "overview",
    "\u6309\u529F\u80FD\u53D8\u66F4": "features",
    "\u6587\u4EF6\u6E05\u5355": "files",
    "\u884C\u4E3A\u5F71\u54CD": "impacts",
    "\u672A\u5BF9\u9F50 / \u5F85\u786E\u8BA4": "pending",
    "\u5DF2\u5BF9\u9F50": "aligned",
    "\u5DF2\u8C03\u6574": "adjusted",
    "\u9700\u6C42\u5916\u6539\u52A8": "extras",
    "\u95EE\u9898\u4E0E\u5904\u7F6E": "findings",
    "\u6279\u6CE8\uFF08\u8BC4\u5BA1\u4EBA\u610F\u89C1\uFF0C\u672A\u7ECF\u6A21\u578B\u6821\u9A8C\uFF09": "annotations",
    "\u4E0E\u4E0A\u6B21\u5BA1\u67E5\u76F8\u6BD4": "comparison",
    "\u5C40\u9650": "limitations",
    "\u5173\u952E\u7247\u6BB5": "snippets",
    "\u5B8C\u6574 Diff": "diff",
    "\u7701\u7565\u6E05\u5355": "omissions"
  };
  const navigation = /* @__PURE__ */ new Map();
  const section = (title, body2, count, unit = "\u9879") => {
    const id2 = "report-" + sectionIds[title];
    const label = count === void 0 ? title : `${title}\uFF08${count} ${unit}\uFF09`;
    navigation.set(id2, id2 === "report-annotations" ? "\u6279\u6CE8" : label);
    const heading2 = `<h2 id="${id2}">${esc(label)}</h2>`;
    return `<section>${count === void 0 ? heading2 + body2 : `<details><summary>${heading2}</summary><div class="section-body">${body2}</div></details>`}</section>`;
  };
  const paragraphs = (entries) => (entries.length ? entries : ["\u65E0"]).map((s) => "<p>" + esc(s) + "</p>").join("");
  const body = sections(data).map(([title, entries]) => section(title, paragraphs(entries), title === "\u6587\u4EF6\u6E05\u5355" ? entries.length : void 0, "\u4E2A\u6587\u4EF6")).join("") + section("\u5173\u952E\u7247\u6BB5", data.snippets.map((s) => "<h3>" + esc(`${s.path}:${s.startLine}\u2013${s.endLine}\uFF08${s.side}\uFF09`) + '</h3><pre class="report-snippet">' + esc(s.text) + "</pre>").join("") || "<p>\u65E0</p>", data.snippets.length, "\u6BB5") + section("\u5B8C\u6574 Diff", data.fullDiff.map((d) => "<h3>" + esc(d.path) + "</h3>" + renderDiff(d.text)).join("") || "<p>\u65E0</p>", data.fullDiff.length, "\u4E2A\u6587\u4EF6") + section("\u7701\u7565\u6E05\u5355", paragraphs(data.omissions.map((o) => o.path + "\uFF1A" + o.reason)), data.omissions.length);
  const nav = `<nav class="report-nav" aria-label="\u62A5\u544A\u7AE0\u8282">${[...navigation].map(([id2, title]) => `<a href="#${id2}">${esc(title)}</a>`).join("")}</nav>`;
  const reportStyle = ":root{color-scheme:light;--el-bg-base:#fff;--el-bg-l3:#f4f5f7;--el-hover:rgba(38,49,72,.06);--el-border-l2:rgba(0,0,0,.10);--el-label-1:#0f1115;--el-label-2:#61666b;--el-brand:#4176e6}@media(prefers-color-scheme:dark){:root{color-scheme:dark;--el-bg-base:#16171a;--el-bg-l3:#282a30;--el-hover:rgba(255,255,255,.08);--el-border-l2:rgba(255,255,255,.12);--el-label-1:#f1f3f5;--el-label-2:#adb2b8;--el-brand:#7aaaff}}body{background:var(--el-bg-base);color:var(--el-label-1);overflow-wrap:anywhere}h1{color:var(--el-brand)}h2{border-color:var(--el-border-l2);scroll-margin-top:16px}section{margin-top:24px}small,.muted{color:var(--el-label-2)}pre,code{background:var(--el-bg-l3)}th,td{border-color:var(--el-border-l2);overflow-wrap:anywhere}.finding{background:var(--el-bg-base);border-color:var(--el-border-l2);border-left-color:#df2a3f}.report-nav{display:flex;flex-wrap:wrap;gap:4px 8px;padding:12px;margin:24px 0;border:1px solid var(--el-border-l2);border-radius:8px;background:var(--el-bg-l3);font-size:13px}.report-nav a{display:block;color:var(--el-label-2);padding:4px 8px;border-radius:4px;text-decoration:none}.report-nav a:hover{color:var(--el-label-1);background:var(--el-hover)}summary{padding:12px 14px;border:1px solid var(--el-border-l2);border-radius:8px;background:var(--el-bg-l3);color:var(--el-label-1);font-size:18px;font-weight:600;cursor:pointer;overflow-wrap:anywhere}summary h2{display:inline;font:inherit;margin:0;padding:0;border:0}details[open]>summary{margin-bottom:12px}.section-body{overflow-x:auto}.report-nav a:focus-visible,summary:focus-visible{outline:2px solid var(--el-brand);outline-offset:3px}pre.report-diff,pre.report-snippet{font:12px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace;white-space:pre;overflow-wrap:normal;word-break:normal;tab-size:4;overflow:auto;padding:12px;max-width:100%;box-sizing:border-box}.report-diff{--el-diff-add-fg:#176333;--el-diff-add-bg:#e6f4ea;--el-diff-del-fg:#a82032;--el-diff-del-bg:#fce8eb;--el-diff-hunk-fg:#50555c;--el-diff-hunk-bg:#e7e9ed}.report-diff .report-diff-line{display:inline-block;min-width:100%}.report-diff .report-diff-add{color:var(--el-diff-add-fg);background:var(--el-diff-add-bg)}.report-diff .report-diff-del{color:var(--el-diff-del-fg);background:var(--el-diff-del-bg)}.report-diff .report-diff-hunk{color:var(--el-diff-hunk-fg);background:var(--el-diff-hunk-bg)}@media(prefers-color-scheme:dark){.report-diff{--el-diff-add-fg:#9ee5b2;--el-diff-add-bg:#183b28;--el-diff-del-fg:#ffb0bb;--el-diff-del-bg:#48232c;--el-diff-hunk-fg:#c5c9d0;--el-diff-hunk-bg:#33363d}}";
  const json2 = JSON.stringify(data).replace(/[<>&\u2028\u2029]/g, (c) => "\\u" + c.charCodeAt(0).toString(16).padStart(4, "0"));
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; connect-src 'none'; img-src data:; base-uri 'none'; form-action 'none'; script-src 'nonce-${nonce}'; style-src 'nonce-${nonce}'"><title>` + esc(header[0]) + `</title><style nonce="${nonce}">body{font:15px/1.7 system-ui,sans-serif;max-width:1080px;margin:24px auto;padding:0 16px}section{border-top:1px solid var(--el-border-l2)}p,pre{white-space:pre-wrap;overflow-wrap:anywhere}pre{overflow:auto}${reportStyle}</style></head><body><header><h1>` + esc(header[0]) + "</h1>" + header.slice(1).map((s) => "<p>" + esc(s) + "</p>").join("") + "</header>" + nav + body + `<script type="application/json" id="evidentloop-data" nonce="${nonce}">${json2}</script></body></html>`;
}
function html(context, { maxReportBytes = 2 * 1024 * 1024, ...options } = {}) {
  if (maxReportBytes < 8192) throw Error("Report budget must be at least 8192 bytes");
  const data = exportData(context, options), nonce = crypto5.randomBytes(18).toString("base64");
  let output = renderHTML(data, nonce);
  if (Buffer.byteLength(output) > maxReportBytes) {
    const original = { findings: data.run?.findings?.length ?? 0, annotations: data.annotations.length, files: data.snapshot.files.length };
    data.omissions = [
      ...data.omissions,
      { path: "report", reason: `\u6574\u4EFDUTF-8\u8D85\u8FC7\u9884\u7B97\uFF1B\u5DF2\u7701\u7565\u6B63\u6587/\u6E90\u7801\uFF0C\u539F\u6709\u6587\u4EF6${original.files}\u3001\u95EE\u9898${original.findings}\u3001\u6279\u6CE8${original.annotations}\u9879\uFF1B\u8BF7\u63D0\u9AD8\u9884\u7B97\u6216\u5BFC\u51FAMarkdown` },
      ...data.snippets.map((s) => ({ path: s.path, reason: "\u6574\u4EFD\u9884\u7B97\uFF1A\u7701\u7565\u5173\u952E\u7247\u6BB5" })),
      ...data.fullDiff.map((d) => ({ path: d.path, reason: "\u6574\u4EFD\u9884\u7B97\uFF1A\u7701\u7565\u5B8C\u6574Diff" })),
      ...(data.run?.findings ?? []).map((f) => ({ path: f.findingId + " \xB7 " + f.anchor.path, reason: "\u6574\u4EFD\u9884\u7B97\uFF1A\u7701\u7565\u95EE\u9898\u6B63\u6587" })),
      ...data.annotations.map((a) => ({ path: a.annotationId + " \xB7 " + a.anchor.path, reason: "\u6574\u4EFD\u9884\u7B97\uFF1A\u7701\u7565\u6279\u6CE8\u6B63\u6587" })),
      ...data.snapshot.requirements.map((r) => ({ path: r.reqId, reason: "\u6574\u4EFD\u9884\u7B97\uFF1A\u7701\u7565\u9700\u6C42\u6B63\u6587" }))
    ];
    data.snippets = [];
    data.fullDiff = [];
    data.annotations = [];
    data.associatedFindings = [];
    data.snapshot.requirements = [];
    if (data.snapshot.extensionPrompt) {
      delete data.snapshot.extensionPrompt.text;
      data.snapshot.extensionPrompt.truncated = true;
    }
    if (data.run) {
      data.run = {
        runId: data.run.runId,
        status: data.run.status,
        complete: data.run.complete,
        endedAt: data.run.endedAt,
        model: data.run.model,
        findings: [],
        understanding: null,
        coverage: { reviewed: [], skipped: [], failed: [], withheld: [] }
      };
    }
    data.summaryOnly = true;
    data.originalCounts = original;
    output = renderHTML(data, nonce);
    if (Buffer.byteLength(output) > maxReportBytes) throw Error("Report metadata exceeds byte budget");
  }
  return output;
}

// core/lib/drafts.mjs
var Drafts = class {
  constructor(adapter, { maxCodePoints = 12e3, patterns = [] } = {}) {
    this.adapter = adapter;
    this.max = maxCodePoints;
    this.patterns = patterns;
    this.locks = /* @__PURE__ */ new Map();
  }
  async target(delivery) {
    for (const id2 of [...delivery.sessionIds].reverse()) {
      const direct = await this.adapter.session(id2);
      if (!direct) return { id: id2, session: null };
      if (direct.kind === "review") continue;
      const session = await developmentSession(this.adapter, id2);
      return { id: session?.id || id2, session };
    }
    return null;
  }
  async lock(context, template, { skillName = "____" } = {}) {
    if (!["issues", "understanding"].includes(template)) throw Error("Unknown draft template");
    const target = await this.target(context.delivery);
    if (!target) return { available: false, reason: "\u6CA1\u6709\u5173\u8054\u5F00\u53D1\u4F1A\u8BDD" };
    const data = exportData(context, { patterns: this.patterns }), run = data.run;
    if (!run) return { available: false, reason: "\u5148\u5B8C\u6210\u5BA1\u67E5" };
    const groups = [], footer = `\u4EA4\u4ED8\uFF1A${data.delivery.title}
\u5BA1\u67E5\u65F6\u95F4\uFF1A${run.endedAt || data.snapshot.createdAt}`;
    if (template === "issues") {
      const suppressed = new Set(data.marks.filter((m) => m.suppressed).map((m) => m.findingId)), linked = /* @__PURE__ */ new Set();
      const annotations = data.annotations.map((a) => {
        const finding = run.findings?.find((f) => f.findingId === a.findingId) ?? data.associatedFindings?.find((f) => f.findingId === a.findingId);
        if (finding) linked.add(finding.findingId);
        return { id: a.annotationId, text: `${locationLabel(a.anchor)}
${a.text}${finding ? "\n\u5173\u8054\u95EE\u9898\uFF1A" + finding.title + (suppressed.has(finding.findingId) ? "\uFF08\u539F\u95EE\u9898\u5DF2\u6807\u8BB0\u4E3A\u975E\u95EE\u9898\uFF09" : "") : ""}` };
      });
      const rank = { P0: 0, P1: 1, P2: 2 };
      const findings = activeFindings(run, data.marks).filter((f) => !linked.has(f.findingId)).sort((a, b) => rank[a.severity] - rank[b.severity]).map((f) => ({ id: f.findingId, text: `${f.severity} ${f.title} \xB7 ${locationLabel(f.anchor)}
${f.problem}${f.suggestion ? "\n\u5EFA\u8BAE\uFF1A" + f.suggestion.text + (f.suggestion.code ? "\n" + f.suggestion.code : "") : ""}` }));
      const sources = new Map(data.snapshot.requirements.flatMap((s) => s.items.map((i) => [i.itemId, i.text ?? Array.from(s.text).slice(i.start, i.end).join("")])));
      const alignment = (run.understanding?.alignment ?? []).filter((r) => !["implemented", "superseded"].includes(r.status)).map((r) => ({ id: r.requirementItemId, text: `${sources.get(r.requirementItemId) ?? r.requirementItemId}
${r.status}\uFF1A${r.note}
${r.codeRefs.length ? r.codeRefs.map((x) => `${x.path}:${x.startLine}\u2013${x.endLine}\uFF08${x.side}\uFF09`).join("\u3001") : "\u65E0\u4EE3\u7801\u5B9A\u4F4D"}` }));
      groups.push(["\u6279\u6CE8", annotations], ["\u5F85\u5904\u7406\u95EE\u9898", findings], ["\u672A\u5BF9\u9F50 / \u5F85\u786E\u8BA4", alignment]);
      if (groups.every(([, items]) => !items.length)) return { available: false, reason: "\u6CA1\u6709\u5F85\u53D1\u56DE\u5185\u5BB9" };
    } else {
      const u = run.understanding;
      if (!u || !(u.features.length || u.files.some((f) => f.semantic.items.length) || u.impacts.length)) return { available: false, reason: "\u5148\u5B8C\u6210\u5BA1\u67E5\uFF0C\u5C1A\u65E0\u901A\u8FC7\u6821\u9A8C\u7684\u8BF4\u660E" };
      const safeSkill = Array.from(redactText(skillName, this.patterns).replace(/[\r\n]/g, " ")).slice(0, 120).join("");
      const range = data.snapshot.range;
      groups.push(["\u8865\u5145\u8BF4\u660E", [
        { id: "source", text: `${footer}
\u8303\u56F4\uFF1A${range.targetRef} merge-base \u2194 \u5DE5\u4F5C\u6811
\u57FA\u4E8E\u63D0\u4EA4\uFF1A${range.headSubject || "\u63D0\u4EA4"}\uFF08${(range.headSha || "").slice(0, 8)}\uFF09${range.dirty ? "\uFF0C\u542B\u672A\u63D0\u4EA4\u6539\u52A8" : ""}
\u8BF7\u7528\u672C\u5730Skill\u300C${safeSkill}\u300D\u589E\u5F3A\u4EE5\u4E0B\u8BF4\u660E\u3002\u4EE5\u6240\u9644\u8BF4\u660E\u4E3A\u8F93\u5165\uFF0C\u8D44\u6599\u4E0D\u8DB3\u8BF7\u6307\u51FA\uFF1B\u4E0D\u6539\u5199\u5BA1\u67E5\u7ED3\u8BBA\uFF1B\u672C\u4EFB\u52A1\u4E0D\u4FEE\u6539\u4E1A\u52A1\u4EE3\u7801\u3002
\u4EA4\u4ED8\u76EE\u6807\uFF1A${u.overview.purpose}` },
        ...u.features.map((f) => ({ id: f.featureId, text: `${f.title}\uFF1A${f.approach}
\u6587\u4EF6\uFF1A${f.files.join("\u3001")}
\u5F15\u7528\uFF1A${f.refs.map((r) => `${r.path}:${r.startLine}\u2013${r.endLine}\uFF08${r.side}\uFF09`).join("\u3001")}` })),
        { id: "coverage", text: `\u5DF2\u5BA1\u67E5${run.coverage.reviewed.length}\u4E2A\u6587\u4EF6\uFF1B\u672A\u901A\u8FC7\u6821\u9A8C${run.coverage.withheld.length}\u6761\uFF1B\u5931\u8D25${run.coverage.failed.length}\u4E2A\u6587\u4EF6\u3002` }
      ]]);
    }
    const omitted = [];
    const render = () => groups.filter(([, items]) => items.length).map(([title, items]) => `## ${title}\uFF08${items.length}\uFF09
` + items.map((i) => i.text).join("\n\n")).join("\n\n") + "\n\n" + footer + (omitted.length ? "\n\n\u7701\u7565\u6E05\u5355\uFF1A" + omitted.slice(0, 20).join("\u3001") + (omitted.length > 20 ? `\u7B49${omitted.length}\u9879` : "") : "");
    let text = render();
    while (Array.from(text).length > this.max) {
      const group = [...groups].reverse().find(([, items]) => items.length);
      if (!group) throw Error("Draft metadata exceeds length limit");
      omitted.push(group[1].pop().id);
      text = render();
    }
    const token = uuid("draft"), row = { token, available: true, projectKey: context.snapshot.projectKey, snapshotId: context.snapshot.snapshotId, targetId: target.id, template, text, hash: sha256(text), omitted };
    this.locks.set(token, structuredClone(row));
    return structuredClone(row);
  }
  async commit(token, { displayedSnapshotId, choice = "auto" } = {}) {
    if (!["auto", "append", "copy"].includes(choice)) throw Error("Invalid draft choice");
    const locked = this.locks.get(token);
    if (!locked) throw Error("Unknown draft lock");
    const copy2 = async (reason) => {
      try {
        await this.adapter.copy(locked.text);
        return { status: "copied", reason, text: locked.text };
      } catch {
        return { status: "failed", reason: "\u526A\u8D34\u677F\u4E0D\u53EF\u7528", text: locked.text };
      }
    };
    if (choice === "copy") return copy2("\u7528\u6237\u9009\u62E9\u590D\u5236");
    if (displayedSnapshotId !== locked.snapshotId) return copy2("\u5F53\u524D\u663E\u793A\u7684\u5BA1\u67E5\u8BB0\u5F55\u5DF2\u6539\u53D8");
    const target = await this.adapter.session(locked.targetId);
    if (!target) return copy2("\u5173\u8054\u4F1A\u8BDD\u5DF2\u5220\u9664");
    if (target.archived) return copy2("\u5173\u8054\u4F1A\u8BDD\u5DF2\u5F52\u6863");
    if (target.kind === "review" || target.projectKey !== locked.projectKey) return copy2("\u76EE\u6807\u4F1A\u8BDD\u4E0D\u5C5E\u4E8E\u672C\u4ED3\u5E93\u5F00\u53D1\u4F1A\u8BDD");
    try {
      const draft = await this.adapter.getDraft(locked.targetId);
      if (draft.text.includes(locked.text)) return { status: "unchanged", reason: "\u76F8\u540C\u5185\u5BB9\u5DF2\u5728\u8349\u7A3F\u4E2D", text: locked.text };
      const existing = Boolean(draft.text || draft.quotes?.length || draft.attachments?.length);
      if (existing && choice !== "append") return { status: "preview", choices: ["append", "copy"], text: locked.text, existingDraft: draft };
      const text = draft.text ? draft.text + "\n\n" + locked.text : locked.text;
      if (!await this.adapter.writeDraft(locked.targetId, text, { expectedRevision: draft.revision, preserveQuotesAndAttachments: true })) return copy2("\u8F93\u5165\u6846\u8349\u7A3F\u5DF2\u6539\u53D8");
      return { status: "written", targetId: locked.targetId, text: locked.text };
    } catch {
      return copy2("\u5BBF\u4E3B\u65E0\u6CD5\u5199\u5165\u8349\u7A3F");
    }
  }
};

// plugin/host/bridge.mjs
import crypto6 from "node:crypto";
import { AsyncLocalStorage } from "node:async_hooks";
var ClientBridge = class {
  constructor({ timeoutMs = 12e3 } = {}) {
    this.timeout = timeoutMs;
    this.pending = /* @__PURE__ */ new Map();
    this.clients = /* @__PURE__ */ new Map();
    this.context = new AsyncLocalStorage();
  }
  withClient(clientId, action) {
    if (typeof clientId !== "string" || !/^[a-zA-Z0-9-]{20,100}$/.test(clientId)) throw Error("Invalid client identity");
    return this.context.run(clientId, action);
  }
  next(clientId) {
    if (this.closed || typeof clientId !== "string" || !/^[a-zA-Z0-9-]{20,100}$/.test(clientId)) throw Error("Invalid client identity");
    for (const [id2, seen] of this.clients) if (Date.now() - seen > 15e3) this.clients.delete(id2);
    this.clients.set(clientId, Date.now());
    return [...this.pending.values()].filter((p) => p.clientId === clientId && !p.delivered).map((p) => {
      p.delivered = true;
      return { id: p.id, nonce: p.nonce, expiresAt: p.expiresAt, action: p.action, payload: p.payload };
    });
  }
  call(action, payload) {
    if (this.closed) throw Error("Plugin unloaded");
    const clientId = this.context.getStore();
    if (!clientId) throw Error("No initiating client for composer operation");
    if (Date.now() - (this.clients.get(clientId) || 0) > 15e3) throw Error("Initiating client disconnected");
    const id2 = crypto6.randomUUID(), nonce = crypto6.randomBytes(24).toString("hex");
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id2);
        reject(Error("Client operation timed out"));
      }, this.timeout);
      this.pending.set(id2, {
        id: id2,
        nonce,
        clientId,
        action,
        expiresAt: Date.now() + this.timeout,
        payload: structuredClone(payload),
        delivered: false,
        finish: (value, error) => {
          clearTimeout(timer);
          this.pending.delete(id2);
          error ? reject(Error(String(error))) : resolve(value);
        }
      });
    });
  }
  answer(clientId, { id: id2, nonce, result, error }) {
    const pending = this.pending.get(id2);
    if (!pending || pending.clientId !== clientId || pending.nonce !== nonce) throw Error("Unknown client operation");
    pending.finish(result, error);
    return { accepted: true };
  }
  close() {
    this.closed = true;
    for (const p of [...this.pending.values()]) p.finish(null, "Plugin unloaded");
    this.clients.clear();
  }
};

// plugin/host/dsh-adapter.mjs
import fs10 from "node:fs";
import path9 from "node:path";
import crypto7 from "node:crypto";
var never = new AbortController().signal;
var textOf = (event) => event.data.message.content.filter((b) => b.type === "text").map((b) => b.text).join("");
var DshAdapter = class {
  constructor(ctx, { root, bridge, approvalFile = path9.join(root, "model-approval.json") }) {
    this.ctx = ctx;
    this.root = root;
    this.bridge = bridge;
    this.approvalFile = approvalFile;
    this.kind = "dsh";
    fs10.mkdirSync(root, { recursive: true });
    this.registryFile = path9.join(root, "review-sessions.json");
    this.registry = fs10.existsSync(this.registryFile) ? JSON.parse(fs10.readFileSync(this.registryFile)) : {};
    this.active = /* @__PURE__ */ new Map();
    this.core = null;
  }
  saveRegistry() {
    const tmp = this.registryFile + ".tmp";
    fs10.writeFileSync(tmp, JSON.stringify(this.registry, null, 2) + "\n", { mode: 384 });
    fs10.renameSync(tmp, this.registryFile);
  }
  async session(id2) {
    const list = await this.ctx.sessionController.list({}, never), row = list.items.find((r) => r.sessionId === id2);
    if (!row) return null;
    let projectKey;
    if (row.cwd) try {
      projectKey = projectFor(createGit(row.cwd).root).projectKey;
    } catch {
    }
    const live = this.ctx.sessions.get(id2), title = (live ? this.ctx.get("sessionTitle")?.get(live)?.title : null) || row.projections?.values?.title || "\u672A\u547D\u540D\u4F1A\u8BDD";
    return {
      id: id2,
      cwd: row.cwd,
      projectKey: this.registry[id2]?.projectKey || projectKey,
      title,
      origin: row.origin,
      parentSession: row.parentSessionId,
      formatStatus: row.formatStatus,
      unavailable: Boolean(row.formatStatus && row.formatStatus !== "current" || ["error", "migration-required"].includes(row.projections?.state)),
      kind: this.registry[id2] ? "review" : "development",
      archived: this.ctx.workspaceRegistry.archivedSessionIds.includes(id2),
      updatedAt: row.updatedAt,
      running: row.running
    };
  }
  async getDraft(id2) {
    const session = await this.session(id2);
    if (!session || session.unavailable) throw Error("\u5F00\u53D1\u4F1A\u8BDD\u9700\u8981\u8FC1\u79FB\u6216\u6682\u4E0D\u53EF\u7528");
    const value = await this.bridge.call("getDraft", { sessionId: id2 });
    if (!value || typeof value.text !== "string" || !Number.isSafeInteger(value.revision)) throw Error("Invalid native draft response");
    return value;
  }
  async writeDraft(id2, text, options) {
    const session = await this.session(id2);
    if (!session || session.unavailable || session.archived) return false;
    const result = await this.bridge.call("writeDraft", { sessionId: id2, text, expectedRevision: options.expectedRevision });
    return result?.written === true;
  }
  async copy(text) {
    const result = await this.bridge.call("copy", { text });
    if (result?.copied !== true) throw Error("Clipboard rejected");
    return true;
  }
  approval() {
    if (!fs10.existsSync(this.approvalFile)) throw Error("\u9694\u79BB\u9A8C\u8BC1\u5C1A\u672A\u6279\u51C6\u771F\u5B9E\u6A21\u578B\u8C03\u7528\u9884\u7B97");
    const approval = JSON.parse(fs10.readFileSync(this.approvalFile));
    const used = approval.used ?? 0;
    if (typeof approval.approvedBy !== "string" || !approval.approvedBy.trim() || typeof approval.taskId !== "string" || !approval.taskId.trim() || !Number.isFinite(Date.parse(approval.expiresAt)) || Date.parse(approval.expiresAt) < Date.now() || !Number.isSafeInteger(approval.maxCalls) || approval.maxCalls < 1 || !Number.isSafeInteger(used) || used < 0 || used >= approval.maxCalls || !["projectKey", "inputSha", "promptVersion"].every((k) => typeof approval[k] === "string" && /^[a-f0-9]{64}$/.test(approval[k])) || ["maxInputBytes", "maxOutputTokens", "contextWindow"].some((k) => approval[k] !== void 0 && (!Number.isSafeInteger(approval[k]) || approval[k] < 1))) throw Error("\u771F\u5B9E\u6A21\u578B\u8C03\u7528\u9884\u7B97\u672A\u6279\u51C6\u3001\u683C\u5F0F\u65E0\u6548\u6216\u5DF2\u7528\u5B8C");
    approval.used = used;
    return approval;
  }
  allowed(selection, bytes, snapshot) {
    const approval = this.approval();
    if (!snapshot || ["projectKey", "inputSha", "promptVersion"].some((k) => approval[k] !== snapshot[k])) throw Error("\u51BB\u7ED3\u8F93\u5165\u4E0E\u5DF2\u6279\u51C6\u9884\u7B97\u4E0D\u4E00\u81F4\uFF0C\u672A\u8C03\u7528\u6A21\u578B");
    if (approval.provider !== selection.provider || approval.model !== selection.model || approval.reasoningEffort !== selection.reasoningEffort) throw Error("\u5F53\u524D\u6A21\u578B\u4E0E\u5DF2\u6279\u51C6\u8F6E\u6B21\u4E0D\u4E00\u81F4");
    if (bytes > (approval.maxInputBytes || 1024 * 1024)) throw Error("\u5BA1\u67E5\u5305\u8D85\u8FC7\u5DF2\u6279\u51C6\u8F93\u5165\u9884\u7B97\uFF0C\u672A\u5220\u51CF\u76EE\u6807");
    return approval;
  }
  claim(selection, bytes, snapshot) {
    const approval = this.allowed(selection, bytes, snapshot);
    approval.used += 1;
    fs10.writeFileSync(this.approvalFile + ".tmp", JSON.stringify(approval, null, 2), { mode: 384 });
    fs10.renameSync(this.approvalFile + ".tmp", this.approvalFile);
    return approval;
  }
  async review(request, { signal }) {
    if (this.closed) throw Error("Plugin unloaded");
    this.approval();
    signal.throwIfAborted();
    const delivery = this.core.store.delivery(request.snapshot.projectKey, request.snapshot.deliveryId);
    const callerId = request.sourceSessionId || delivery.sessionIds.at(-1);
    let selection = this.ctx.get("agentDefaultModel").currentSelection();
    const caller = callerId ? await this.session(callerId) : null;
    if (request.sourceSessionId && (!caller || caller.archived || caller.kind === "review" || caller.projectKey !== request.snapshot.projectKey)) throw Error("\u53D1\u8D77\u5BA1\u67E5\u7684\u5F00\u53D1\u4F1A\u8BDD\u5DF2\u4E0D\u53EF\u7528\uFF0C\u672A\u8C03\u7528\u6A21\u578B");
    if (caller && !caller.archived && caller.projectKey === request.snapshot.projectKey) {
      const resolved = await this.ctx.sessionController.resolveAgent(callerId);
      if ("error" in resolved) throw resolved.error;
      selection = resolved.agent.model.current() || selection;
    }
    if (!selection?.provider || !selection.model) throw Error("\u672A\u914D\u7F6E\u53EF\u7528\u6A21\u578B");
    const info = await this.ctx.llm.resolveModelInfo(selection.provider, selection.model);
    selection = { ...selection, reasoningEffort: selection.reasoningEffort ?? info.reasoning?.defaultEffort };
    const prompt = reviewPrompt(request), promptBytes = Buffer.byteLength(prompt), approval = this.allowed(selection, promptBytes, request.snapshot), sessionId = "session-" + crypto7.randomUUID(), events = [];
    let steps = 0, failureCode;
    if (approval.contextWindow !== void 0 && info.context?.contextWindow !== approval.contextWindow) throw Error("\u6A21\u578B\u4E0A\u4E0B\u6587\u4E0E\u6279\u51C6\u914D\u7F6E\u4E0D\u7B26\uFF0C\u8BF7\u5728\u9694\u79BB\u6A21\u578B\u914D\u7F6E\u4E2D\u8BBE\u7F6E contextWindow");
    const cwd = request.bundleRoot;
    if (!cwd || !path9.isAbsolute(cwd) || !fs10.statSync(cwd).isDirectory()) throw Error("\u51BB\u7ED3\u5BA1\u67E5\u5305\u4E0D\u53EF\u7528");
    const titles = this.ctx.get("sessionTitle");
    if (!titles) throw Error("\u5BBF\u4E3B\u6807\u9898\u670D\u52A1\u4E0D\u53EF\u7528\uFF0C\u672A\u53D1\u8D77\u6A21\u578B");
    let handle;
    const off = this.ctx.on("session/event", (session, event) => {
      if (session.id !== sessionId) return;
      events.push(event);
      if (event.type === "request/header" && this.registry[sessionId]) {
        const config = event.data.header.config;
        this.registry[sessionId].model = { provider: config.provider, model: config.model, name: info.name || config.model, reasoningEffort: config.reasoningEffort, contextWindow: config.contextWindow, maxTokens: config.maxTokens };
        this.saveRegistry();
      }
      if (event.type === "request/context" && this.registry[sessionId]?.model) {
        this.registry[sessionId].model.contextWindow = event.data.contextWindow;
        this.saveRegistry();
      }
    });
    try {
      signal.throwIfAborted();
      handle = await this.ctx.agents.create({ sessionId, meta: { cwd }, agentOptions: { ...selection, maxTokens: approval.maxOutputTokens || 16384 }, setup: (agentCtx, agent) => {
        agentCtx.tools.restrict({ allow: [] });
        agentCtx.on("agent/pre-step", async (_payload, next) => {
          if (++steps > 1 || this.ctx.tools.schemas(agent).length) throw Error("Controlled review may not expose tools or start another step");
          return next();
        });
        agentCtx.on("agent/assistant-stream", ({ frame }) => {
          if (frame.type === "chunk" && frame.chunk.type === "finish" && frame.chunk.reason?.kind === "error") {
            failureCode = frame.chunk.reason.failure?.code;
            queueMicrotask(() => agent.cancel({ kind: "hook", reason: "No retry budget" }));
          }
        });
      } });
      titles.rename(handle.agent.session, "\u9605\u53D8\u5BA1\u67E5 \xB7 " + delivery.title);
      this.registry[sessionId] = { runId: request.runId, callerId, projectKey: request.snapshot.projectKey };
      this.saveRegistry();
      this.active.set(request.runId, handle.agent);
      const cancel = () => handle.agent.cancel({ kind: "user" });
      signal.addEventListener("abort", cancel, { once: true });
      try {
        if (signal.aborted) cancel();
        signal.throwIfAborted();
        if (this.ctx.tools.schemas(handle.agent).length) throw Error("Write tools were not removed");
        this.claim(selection, promptBytes, request.snapshot);
        await this.ctx.sessionController.prompt({ sessionId, requestId: request.runId, mode: "queue", content: [{ type: "text", text: prompt }] }, never);
        await handle.agent.whenIdle();
        await this.ctx.sessions.flush(handle.agent.session);
        const raw = events.filter((e) => e.type === "assistant/message").map(textOf).join("\n");
        const rawFolder = path9.join(this.root, "model-output");
        fs10.mkdirSync(rawFolder, { recursive: true });
        fs10.writeFileSync(path9.join(rawFolder, request.runId + ".raw.txt"), raw, { mode: 384 });
        signal.throwIfAborted();
        const end = events.findLast((e) => e.type === "turn/end");
        if (end?.data.reason.kind !== "completed") throw Error("\u53D7\u63A7\u5BA1\u67E5\u672A\u5B8C\u6210\uFF1A" + (failureCode || end?.data.reason.kind || "missing terminal"));
        try {
          return JSON.parse(raw.trim());
        } catch {
          throw Error("\u6A21\u578B\u672A\u8FD4\u56DE\u5355\u4E2A\u5408\u6CD5JSON\uFF0C\u539F\u59CB\u6587\u672C\u5DF2\u4FDD\u7559");
        }
      } finally {
        signal.removeEventListener("abort", cancel);
      }
    } finally {
      this.active.delete(request.runId);
      off?.();
      if (handle) await handle.dispose();
    }
  }
  async close() {
    this.closed = true;
    const agents = [...this.active.values()];
    for (const agent of agents) agent.cancel({ kind: "disposed" });
    await Promise.allSettled(agents.map((agent) => agent.whenIdle()));
  }
};
function reviewPrompt(request) {
  const parts = [
    "\u6309\u4E0B\u5217\u51BB\u7ED3\u65B9\u6CD5\u5BA1\u67E5\uFF0C\u53EA\u8BFB\u6B64\u5BA1\u67E5\u5305\uFF0C\u4E0D\u8BFB\u5B9E\u65F6\u5DE5\u4F5C\u533A\u3001\u4E0D\u8FD0\u884C\u547D\u4EE4\u3001\u4E0D\u4FEE\u6539\u4EFB\u4F55\u6587\u4EF6\u3002\u8F93\u51FA\u4E2D\u6587\u5355\u4E2AJSON\uFF0C\u4E25\u683C\u7B26\u5408schema\uFF1B\u4E0D\u52A0basis/findingId/\u8BC1\u636Esha\u7B49host\u5B57\u6BB5\u3002",
    "\u5FC5\u987B\u8FD4\u56DE\u5168\u90E8targets\u7684\u9010\u6587\u4EF6\u8BF4\u660E\u548C\u5168\u5C40features/impacts/alignment\uFF1B\u95EE\u9898\u53EA\u5BA1\u67E5reviewPaths\uFF0CcarriedPaths\u7531host\u590D\u5236\uFF0C\u4E0D\u80FD\u66FF\u4EE3\u5168\u5C40\u8BF4\u660E\u3002",
    JSON.stringify({ inputSha: request.snapshot.inputSha, promptVersion: request.snapshot.promptVersion, reviewPaths: request.reviewPaths, carriedPaths: request.carriedPaths })
  ];
  for (const m of request.modules.filter((m2) => !m2.path.startsWith("bundle/"))) parts.push(`
--- METHOD ${m.path} sha256=${m.sha256} ---
${m.text}`);
  const visit = (folder, prefix = "") => {
    for (const name2 of fs10.readdirSync(folder).sort()) {
      const file = path9.join(folder, name2), stat = fs10.lstatSync(file);
      if (stat.isSymbolicLink()) throw Error("Review bundle symlink refused");
      const relative = prefix + name2;
      if (stat.isDirectory()) visit(file, relative + "/");
      else parts.push(`
--- BUNDLE ${relative} ---
${fs10.readFileSync(file, "utf8")}`);
    }
  };
  visit(request.bundleRoot);
  return parts.join("\n");
}

// plugin/host/service.mjs
var never2 = new AbortController().signal;
var json = (value) => Response.json(value);
var PluginService = class {
  constructor(ctx, config) {
    this.ctx = ctx;
    this.config = config;
    this.projects = /* @__PURE__ */ new Map();
    this.workspaceCache = /* @__PURE__ */ new Map();
    this.operations = /* @__PURE__ */ new Map();
    this.captureTails = /* @__PURE__ */ new Map();
    this.bridge = new ClientBridge();
    const store = new FileStore(path10.join(config.storageRoot, "projects"));
    this.adapter = new DshAdapter(ctx, { root: config.storageRoot, bridge: this.bridge, approvalFile: config.approvalFile });
    this.core = new ReviewCore({ store, adapter: this.adapter, methodRoot: config.methodRoot });
    this.adapter.core = this.core;
    this.drafts = new Drafts(this.adapter);
    this.routePaths = [];
  }
  async initialize() {
    await this.core.initialize();
    this.register();
    return this;
  }
  workspace(id2) {
    const row = this.ctx.workspaceRegistry.list().find((w) => String(w.id) === String(id2));
    if (!row) throw Error("\u5DE5\u4F5C\u533A\u4E0D\u5B58\u5728");
    return row;
  }
  project(workspaceId) {
    const workspace = this.workspace(workspaceId), cached = this.workspaceCache.get(String(workspaceId));
    if (cached?.path === workspace.path) return cached;
    try {
      const git = createGit(workspace.path), project = { ...projectFor(git.root), displayName: path10.basename(git.root), workspaceId: String(workspace.id), path: workspace.path };
      this.projects.set(project.projectKey, project);
      this.workspaceCache.set(String(workspaceId), project);
      return project;
    } catch {
      return { workspaceId: String(workspace.id), path: workspace.path, notGit: true };
    }
  }
  requireProject(workspaceId) {
    const project = this.project(workspaceId);
    if (project.notGit) throw Error("\u5F53\u524D\u5DE5\u4F5C\u533A\u4E0D\u662FGit\u4ED3\u5E93");
    return project;
  }
  requireDelivery(project, deliveryId) {
    const d = this.core.store.delivery(project.projectKey, deliveryId);
    if (!d) throw Error("\u4EA4\u4ED8\u4E0D\u5B58\u5728\u6216\u4E0D\u5C5E\u4E8E\u5F53\u524D\u4ED3\u5E93");
    return d;
  }
  selected(project, deliveryId, snapshotId) {
    const d = this.requireDelivery(project, deliveryId), id2 = snapshotId || d.current?.snapshotId || d.latestSnapshotId;
    if (!id2 || !d.snapshotIds.includes(id2)) throw Error("\u5BA1\u67E5\u8BB0\u5F55\u4E0D\u5B58\u5728");
    const previousId = d.snapshotIds[d.snapshotIds.indexOf(id2) - 1];
    const view = this.core.selected(project.projectKey, id2), native = Object.values(this.adapter.registry).find((row) => row.runId === view.run?.runId)?.model;
    return { ...view, ...native && view.run?.model?.adapter === "dsh" ? { run: { ...view.run, model: { ...view.run.model, ...native } } } : {}, previousSnapshot: previousId ? this.core.store.snapshot(project.projectKey, previousId) : null };
  }
  async bootstrap(workspaceId) {
    const workspaces = this.ctx.workspaceRegistry.list().map((w) => ({ workspaceId: String(w.id), path: w.path, title: w.title, sessionIds: [...w.sessionIds], projectKey: this.project(w.id).projectKey, notGit: this.project(w.id).notGit || false }));
    const project = workspaceId ? this.project(workspaceId) : null;
    const deliveries = project?.projectKey ? this.core.store.deliveries(project.projectKey).map((d) => {
      const snapshot = d.current && this.core.store.snapshot(project.projectKey, d.current.snapshotId);
      const view = snapshot ? this.core.selected(project.projectKey, snapshot.snapshotId) : null;
      const marks = view?.marks || [], findings = view?.run?.findings || [], activeFindingCount = findings.filter((f) => !marks.some((m) => m.findingId === f.findingId && m.suppressed)).length;
      return { ...d, snapshot, run: view?.run || null, marks, activeFindingCount, statusText: snapshot ? reviewStatus(snapshot, view?.run, marks) : "\u5C1A\u672A\u5BA1\u67E5" };
    }) : [];
    const sessions = (await this.ctx.sessionController.list({}, never2)).items.map((row) => ({ sessionId: row.sessionId, formatStatus: row.formatStatus, unavailable: Boolean(row.formatStatus && row.formatStatus !== "current" || ["error", "migration-required"].includes(row.projections?.state)), cwd: row.cwd, updatedAt: row.updatedAt, title: row.projections?.values?.title || "\u672A\u547D\u540D\u4F1A\u8BDD", archived: this.ctx.workspaceRegistry.archivedSessionIds.includes(row.sessionId), review: Boolean(this.adapter.registry[row.sessionId]) }));
    return {
      workspaces,
      project: project && { projectKey: project.projectKey, displayName: project.displayName, notGit: Boolean(project.notGit) },
      deliveries,
      sessions,
      settings: project?.projectKey ? this.core.store.settings(project.projectKey) : null,
      operations: [...this.operations.values()].map(({ promise, ...o }) => o),
      modelTestGate: this.modelGate()
    };
  }
  modelGate() {
    try {
      const a = this.adapter.approval();
      return { approved: true, remaining: a.maxCalls - (a.used || 0) };
    } catch {
      return { approved: false, remaining: 0 };
    }
  }
  operation(type, action) {
    for (const [key, row2] of this.operations) if (this.operations.size > 100 && row2.status !== "running") this.operations.delete(key);
    const id2 = crypto8.randomUUID(), row = { id: id2, type, status: "running", startedAt: (/* @__PURE__ */ new Date()).toISOString() };
    this.operations.set(id2, row);
    row.promise = Promise.resolve().then(action).then((result) => {
      row.status = ["failed", "incomplete"].includes(result?.status) ? "failed" : "completed";
      row.result = result;
    }, (error) => {
      row.status = "failed";
      row.error = String(error.message || error);
    }).finally(() => {
      row.endedAt = (/* @__PURE__ */ new Date()).toISOString();
    });
    return { operationId: id2, status: "accepted" };
  }
  async messages(sessionId) {
    if (!sessionId) return [];
    let cut, beforeSeq;
    const events = /* @__PURE__ */ new Map();
    for (; ; ) {
      const page = await this.ctx.sessionController.events({ address: { kind: "session", sessionId }, maxMessages: 500, ...cut === void 0 ? {} : { throughSeq: cut }, ...beforeSeq === void 0 ? {} : { beforeSeq } }, never2);
      cut ??= page.cursor;
      const entries = page.records.filter((r) => r.type === "event").map((r) => r.event);
      for (const event of entries) events.set(event.seq, event);
      if (events.size > 1e5) throw Error("\u4F1A\u8BDD\u9700\u6C42\u6765\u6E90\u8FC7\u957F\uFF0C\u672A\u88C1\u51CF\u5185\u5BB9\uFF0C\u8BF7\u9009\u62E9\u8F83\u77ED\u7684\u5F00\u53D1\u4F1A\u8BDD");
      if (!page.hasMore) break;
      const next = Math.min(...entries.map((e) => e.seq));
      if (!Number.isSafeInteger(next) || next < 0 || next === beforeSeq) throw Error("\u65E0\u6CD5\u786E\u8BA4\u9700\u6C42\u6D88\u606F\u987A\u5E8F");
      beforeSeq = next;
    }
    return [...events.values()].sort((a, b) => a.seq - b.seq).filter((e) => e.type === "user/message" && e.data.source.kind === "user").map((e) => ({ id: e.data.id, sequence: e.seq, text: e.data.content.filter((b) => b.type === "text").map((b) => b.text).join("\n") })).filter((m) => m.text.trim());
  }
  async acquirePreparation(key) {
    const previous = this.captureTails.get(key) || Promise.resolve();
    let unlock;
    const turn = new Promise((resolve) => {
      unlock = resolve;
    }), tail = previous.catch(() => {
    }).then(() => turn);
    this.captureTails.set(key, tail);
    await previous.catch(() => {
    });
    let released = false;
    return () => {
      if (released) return;
      released = true;
      unlock();
      if (this.captureTails.get(key) === tail) this.captureTails.delete(key);
    };
  }
  async review(body, { captureOnly = false } = {}) {
    const project = this.requireProject(body.workspaceId);
    const release = await this.acquirePreparation(project.projectKey);
    try {
      let source = await developmentSession(this.adapter, body.sessionId);
      if (source && source.projectKey !== project.projectKey) source = null;
      let delivery = body.deliveryId ? this.requireDelivery(project, body.deliveryId) : null;
      if (body.snapshotId) {
        this.selected(project, body.deliveryId, body.snapshotId);
        this.core.writable(project.projectKey, body.snapshotId, false);
      }
      const git = createGit(project.repoRoot), branch = git.run(["rev-parse", "--abbrev-ref", "HEAD"]).toString().trim();
      const range = rangeOf(git, this.core.store.settings(project.projectKey).targetBranch || void 0);
      delivery ||= this.core.deliveries.findOpen(project.projectKey, { branch, targetBranch: branchLabelOf(git, range.targetRef), session: source });
      if (delivery) {
        if (branch !== delivery.branch) throw Error("\u5F53\u524D\u5DE5\u4F5C\u533A\u5206\u652F\u5DF2\u5207\u6362\uFF0C\u8BF7\u5207\u56DE\u4EA4\u4ED8\u5206\u652F\u540E\u5BA1\u67E5");
        source ||= await developmentSession(this.adapter, delivery.sessionIds.at(-1));
      }
      const ledger = new RequirementLedger(delivery?.requirementLedger || []);
      if (source && source.projectKey === project.projectKey) ledger.captureMessages(source.id, await this.messages(source.id));
      if (body.requirement) {
        if (!["paste", "file"].includes(body.requirement.kind) || typeof body.requirement.text !== "string" || !body.requirement.text.trim()) throw Error("\u9700\u6C42\u4F9D\u636E\u4E0D\u80FD\u4E3A\u7A7A");
        ledger.captureManual({ id: body.requirement.id, source: { kind: body.requirement.kind, text: body.requirement.text, origin: body.requirement.origin || body.requirement.kind } });
      }
      return await this.core.trigger({
        repo: project.repoRoot,
        sessionId: source?.id,
        requirements: ledger.sources(),
        scope: body.scope || "incremental",
        force: Boolean(body.force),
        captureOnly,
        expectedDeliveryId: delivery?.deliveryId,
        onPrepared: async (prepared) => {
          await this.core.store.updateDelivery(project.projectKey, prepared.deliveryId, (d) => {
            d.requirementLedger = ledger.state();
            if (typeof body.externalRef === "string") d.externalRef = body.externalRef.trim();
          });
          release();
        }
      });
    } finally {
      release();
    }
  }
  route(suffix, methods, handler) {
    const route = "/api/dsh-evidentloop/" + suffix;
    this.routePaths.push(route);
    this.ctx.connection.fetch.register({ path: route, methods, requestBody: "buffered", fetch: async (request) => {
      try {
        const params = Object.fromEntries(new URL(request.url).searchParams), body = request.method === "POST" ? await request.json() : {};
        return await handler({ ...params, ...body }, request);
      } catch (error) {
        return Response.json({ error: error.message || String(error) }, { status: 400 });
      }
    } });
  }
  register() {
    this.route("bootstrap", ["GET"], (b) => this.bootstrap(b.workspaceId).then(json));
    this.route("diagnostics", ["GET"], () => json({ routes: this.routePaths, modelGate: this.modelGate(), ownedReviewSessions: Object.keys(this.adapter.registry), activeReviews: [...this.adapter.active.keys()] }));
    this.route("bridge/next", ["GET"], (b) => json({ jobs: this.bridge.next(b.clientId) }));
    this.route("bridge/answer", ["POST"], (b) => json(this.bridge.answer(b.clientId, b)));
    this.route("record", ["GET"], (b) => {
      const p = this.requireProject(b.workspaceId), view = this.selected(p, b.deliveryId, b.snapshotId);
      return json({
        ...view,
        bundleRoot: void 0,
        previousSnapshot: void 0,
        reviewablePaths: view.snapshot.files.filter(isTarget).map((f) => f.path),
        comparison: compareSnapshots(view.snapshot, view.previousSnapshot),
        statusText: reviewStatus(view.snapshot, view.run, view.marks),
        history: [...view.delivery.snapshotIds].reverse().map((id2) => {
          const s = this.core.selected(p.projectKey, id2);
          return { snapshotId: id2, createdAt: s.snapshot.createdAt, range: s.snapshot.range, statusText: reviewStatus(s.snapshot, s.run, s.marks) };
        }),
        readOnly: view.delivery.current?.snapshotId !== view.snapshot.snapshotId,
        extensionChanged: (this.core.store.settings(p.projectKey).extensionPrompt.trim() ? crypto8.createHash("sha256").update(this.core.store.settings(p.projectKey).extensionPrompt).digest("hex") : null) !== (view.snapshot.extensionPrompt?.sha256 || null)
      });
    });
    this.route("file", ["GET"], (b) => {
      const p = this.requireProject(b.workspaceId), view = this.selected(p, b.deliveryId, b.snapshotId), file = view.snapshot.files.find((f) => f.path === b.path);
      if (!file) throw Error("\u51BB\u7ED3\u6587\u4EF6\u4E0D\u5B58\u5728");
      const bundle = loadBundle(view.bundleRoot), base = bundle.texts.get("base:" + (file.oldPath || file.path)), head = bundle.texts.get("head:" + file.path);
      const note = { excluded: "\u6309\u654F\u611F\u89C4\u5219\u6216\u4F9D\u8D56\u76EE\u5F55\u8DF3\u8FC7\uFF0C\u672A\u8BFB\u53D6\u6E90\u7801\u3002", binary: "\u4E8C\u8FDB\u5236\u6587\u4EF6\uFF0C\u4E0D\u663E\u793A\u6587\u672CDiff\u3002", oversize: "\u6587\u4EF6\u8D85\u8FC7\u5927\u5C0F\u4E0A\u9650\uFF0C\u672A\u8BFB\u53D6\u5168\u6587\u3002", submodule: "\u5B50\u6A21\u5757\u4EC5\u4FDD\u7559\u6307\u5411\u4FE1\u606F\uFF0C\u4E0D\u8BFB\u53D6\u5185\u90E8\u6587\u4EF6\u3002", conflicted: "\u6587\u4EF6\u5B58\u5728\u5408\u5E76\u51B2\u7A81\uFF0C\u8BF7\u5148\u5904\u7406\u51B2\u7A81\u3002" }[file.kind] || file.note || "";
      return json({ file, reviewable: isTarget(file), base: base?.text ?? null, head: head?.text ?? null, patch: bundle.targets.includes(file.path) ? fs11.readFileSync(path10.join(view.bundleRoot, "diff", file.path + ".patch"), "utf8") : "", note });
    });
    this.route("review", ["POST"], (b) => json(this.operation("review", () => this.review(b))));
    this.route("capture", ["POST"], (b) => json(this.operation("capture", () => this.review(b, { captureOnly: true }))));
    this.route("session-context", ["GET"], async (b) => {
      const source = await developmentSession(this.adapter, b.sessionId);
      if (!source?.projectKey) return json({ available: false });
      const workspace = this.ctx.workspaceRegistry.list().find((w) => w.sessionIds.includes(source.id));
      if (!workspace) return json({ available: false });
      const project = this.requireProject(workspace.id), delivery = this.core.store.deliveries(project.projectKey).filter((d) => d.sessionIds.includes(source.id)).sort((a, b2) => (b2.createdAt || "").localeCompare(a.createdAt || ""))[0];
      const view = delivery?.current ? this.core.selected(project.projectKey, delivery.current.snapshotId) : null;
      return json({ available: true, workspaceId: String(workspace.id), sessionId: source.id, deliveryId: delivery?.deliveryId, statusText: view ? reviewStatus(view.snapshot, view.run, view.marks) : "\u5F85\u5BA1", activeFindingCount: view?.run?.findings.filter((f) => !view.marks.some((m) => m.findingId === f.findingId && m.suppressed)).length || 0 });
    });
    this.route("cancel", ["POST"], (b) => {
      const p = this.requireProject(b.workspaceId);
      this.requireDelivery(p, b.deliveryId);
      return json(this.operation("cancel", () => this.core.scheduler.cancelDelivery(p.projectKey, b.deliveryId).then(() => ({ status: "cancelled" }))));
    });
    this.route("settings", ["POST"], async (b) => {
      const p = this.requireProject(b.workspaceId), s = b.settings;
      if (!s || typeof s.autoMode !== "boolean" || typeof s.targetBranch !== "string" || typeof s.extensionPrompt !== "string" || typeof s.exportEmbedDiff !== "boolean") throw Error("\u8BBE\u7F6E\u683C\u5F0F\u65E0\u6548");
      const text = s.extensionPrompt.replace(/\r\n?/g, "\n");
      if (Array.from(text).length > 2e4) throw Error("\u6269\u5C55\u63D0\u793A\u8BCD\u8D85\u8FC720000\u5B57");
      const value = { autoMode: s.autoMode, targetBranch: s.targetBranch.trim(), extensionPrompt: text, exportEmbedDiff: s.exportEmbedDiff };
      await this.core.store.setSettings(p.projectKey, value);
      return json({ saved: true, settings: value });
    });
    this.route("mark", ["POST"], async (b) => {
      const p = this.requireProject(b.workspaceId);
      this.selected(p, b.deliveryId, b.snapshotId);
      return json(await this.core.mark(p.projectKey, b));
    });
    this.route("annotation", ["POST"], async (b) => {
      const p = this.requireProject(b.workspaceId);
      this.selected(p, b.deliveryId, b.snapshotId);
      return json(b.remove ? await this.core.deleteAnnotation(p.projectKey, b.snapshotId, b.annotationId) : await this.core.annotate(p.projectKey, b));
    });
    this.route("delivery", ["POST"], async (b) => {
      const p = this.requireProject(b.workspaceId);
      this.requireDelivery(p, b.deliveryId);
      const state = this.core.scheduler.state(p.projectKey);
      if (b.action === "delete") {
        if (b.confirm !== "delete" || state.active?.deliveryId === b.deliveryId || state.pending.has(b.deliveryId)) throw Error("\u8FD0\u884C\u4E2D\u4E0D\u80FD\u5220\u9664\uFF1B\u5220\u9664\u64CD\u4F5C\u9700\u8981\u786E\u8BA4");
        await this.core.deleteDelivery(p.projectKey, b.deliveryId);
      } else if (b.action === "archive") {
        if (state.active?.deliveryId === b.deliveryId || state.pending.has(b.deliveryId)) throw Error("\u5BA1\u67E5\u8FDB\u884C\u4E2D\uFF0C\u5B8C\u6210\u540E\u53EF\u5F52\u6863");
        await this.core.store.archive(p.projectKey, b.deliveryId, Boolean(b.value));
      } else if (b.action === "pin") await this.core.store.pin(p.projectKey, b.deliveryId, Boolean(b.value));
      else throw Error("\u672A\u77E5\u4EA4\u4ED8\u64CD\u4F5C");
      return json({ saved: true });
    });
    this.route("draft/lock", ["POST"], async (b) => {
      const p = this.requireProject(b.workspaceId);
      return json(await this.drafts.lock(this.selected(p, b.deliveryId, b.snapshotId), b.template));
    });
    this.route("draft/commit", ["POST"], (b) => this.bridge.withClient(b.clientId, () => this.drafts.commit(b.token, { displayedSnapshotId: b.displayedSnapshotId, choice: b.choice })).then(json));
    this.route("open-file", ["POST"], (b) => this.bridge.withClient(b.clientId, async () => {
      const p = this.requireProject(b.workspaceId), view = this.selected(p, b.deliveryId, b.snapshotId), file = view.snapshot.files.find((f) => f.path === b.path);
      if (!file) throw Error("\u51BB\u7ED3\u6587\u4EF6\u4E0D\u5B58\u5728");
      const actual = path10.join(p.repoRoot, file.path);
      if (!fs11.existsSync(actual) || fs11.lstatSync(actual).isSymbolicLink() || !inside(p.repoRoot, fs11.realpathSync(actual))) throw Error("\u5F53\u524D\u5DE5\u4F5C\u533A\u6CA1\u6709\u53EF\u5B89\u5168\u6253\u5F00\u7684\u6587\u4EF6\uFF1B\u51BB\u7ED3\u5185\u5BB9\u4ECD\u53EF\u5728Diff\u4E2D\u9605\u8BFB");
      const result = await this.bridge.call("openFile", { path: actual });
      if (!result?.opened) throw Error("\u5BBF\u4E3B\u672A\u786E\u8BA4\u6253\u5F00\u6587\u4EF6");
      return json(result);
    }));
    this.route("quote", ["POST"], (b) => this.bridge.withClient(b.clientId, async () => {
      const p = this.requireProject(b.workspaceId), view = this.selected(p, b.deliveryId, b.snapshotId);
      this.core.writable(p.projectKey, view.snapshot.snapshotId, false);
      const finding = b.findingId ? view.run?.findings?.find((f) => f.findingId === b.findingId) : null;
      if (b.findingId && !finding) throw Error("\u95EE\u9898\u4E0D\u5C5E\u4E8E\u5F53\u524D\u8BB0\u5F55");
      const anchor = finding?.anchor || { path: b.path, side: b.side, line: b.line }, file = view.snapshot.files.find((f) => f.path === anchor.path || f.oldPath === anchor.path), bundle = loadBundle(view.bundleRoot);
      if (!file || !["base", "head"].includes(anchor.side)) throw Error("\u4EE3\u7801\u5B9A\u4F4D\u65E0\u6548");
      const side = bundle.texts.get(anchor.side + ":" + (anchor.side === "base" ? file.oldPath || file.path : file.path));
      const start = anchor.line ?? 1;
      if (!side || !Number.isInteger(start) || start < 1 || start > side.lines.length) throw Error("\u51BB\u7ED3\u4EE3\u7801\u4E2D\u6CA1\u6709\u8BE5\u884C");
      const code = redactText(side.lines.slice(start - 1, start + 11).join("\n"));
      if (!code || Buffer.byteLength(code) > 8192) throw Error("\u6B64\u5904\u65E0\u53EF\u7528\u77ED\u4EE3\u7801\u6BB5\uFF0C\u8BF7\u5728Diff\u4E2D\u9009\u62E9\u5408\u9002\u8303\u56F4");
      const summary = file.path + (anchor.line === null ? "\uFF08\u6587\u4EF6\u7EA7\uFF09" : ":" + start) + (anchor.side === "base" ? "\uFF08\u65E7\u4EE3\u7801\uFF09" : "\uFF08\u65B0\u4EE3\u7801\uFF09"), target = await this.drafts.target(view.delivery), current = target && await this.adapter.session(target.id);
      if (!current || current.archived || current.unavailable || current.projectKey !== p.projectKey || current.kind === "review") {
        await this.adapter.copy(summary + "\n" + code);
        return json({ status: "copied", reason: "\u5F00\u53D1\u4F1A\u8BDD\u4E0D\u53EF\u7528\uFF0C\u5DF2\u590D\u5236\u51BB\u7ED3\u4EE3\u7801\u6BB5" });
      }
      const content = summary + "\n```\n" + code + "\n```\n\u8BF7\u7ED3\u5408\u4E0A\u4E0B\u6587\u5206\u6790\u8FD9\u6BB5\u4EE3\u7801\uFF0C\u662F\u5426\u5B58\u5728\u5B89\u5168\u6216\u903B\u8F91\u9690\u60A3\uFF0C\u4EE5\u53CA\u5982\u4F55\u6539\u8FDB\uFF1F";
      try {
        const draft = await this.adapter.getDraft(target.id);
        if (draft.text.includes(content)) return json({ status: "written", duplicate: true, targetId: target.id });
        const text = draft.text + (draft.text ? "\n\n" : "") + content;
        if (await this.adapter.writeDraft(target.id, text, { expectedRevision: draft.revision, preserveQuotesAndAttachments: true })) return json({ status: "written", duplicate: false, targetId: target.id });
      } catch {
      }
      await this.adapter.copy(content);
      return json({ status: "copied", reason: "\u8349\u7A3F\u5DF2\u6539\u53D8\u6216\u65E0\u6CD5\u5199\u5165\uFF0C\u5DF2\u590D\u5236\u4EE3\u7801\u6BB5\uFF1B\u672A\u8986\u76D6\u539F\u8349\u7A3F\u3002" });
    }));
    this.route("download", ["GET"], (b) => {
      const p = this.requireProject(b.workspaceId), view = this.selected(p, b.deliveryId, b.snapshotId), kind = b.format === "html" ? "html" : "md";
      const body = kind === "html" ? html(view, { embedDiff: this.core.store.settings(p.projectKey).exportEmbedDiff }) : markdown(view);
      const filename = Buffer.from(view.delivery.title.replace(/[\x00-\x1f<>:"/\\|?*]/g, "_").slice(0, 80)).toString("utf8") + "." + kind;
      return new Response(body, { headers: { "content-type": kind === "html" ? "text/html; charset=utf-8" : "text/markdown; charset=utf-8", "content-disposition": "attachment; filename*=UTF-8''" + encodeURIComponent(filename) } });
    });
    const staticFiles = { "client.css": ["client.css", "text/css"], "diff.js": ["../vendor/diff2html-ui@3.4.45.min.js", "application/javascript"], "diff.css": ["../vendor/diff2html@3.4.45.min.css", "text/css"] };
    for (const [key, [file, type]] of Object.entries(staticFiles)) this.route("assets/" + key, ["GET"], () => new Response(fs11.readFileSync(path10.resolve(this.config.assetRoot, file)), { headers: { "content-type": type } }));
    const icons = JSON.parse(fs11.readFileSync(path10.resolve(this.config.assetRoot, "../vendor/material/source.json")));
    for (const file of icons.files) this.route("assets/material/" + file.name, ["GET"], () => new Response(fs11.readFileSync(path10.resolve(this.config.assetRoot, "../vendor/material", file.name)), { headers: { "content-type": "image/svg+xml" } }));
  }
  async close() {
    this.bridge.close();
    await this.adapter.close();
    for (const key of this.core.scheduler.projects.keys()) await this.core.scheduler.idle(key);
  }
};

// plugin/host/index.mjs
var name = "dsh-evidentloop";
var inject = ["connection", "sessionController", "workspaceRegistry", "sessions", "agents", "tools", "llm", "agentDefaultModel", "sessionTitle"];
async function apply(ctx, config = {}) {
  const packageRoot = path11.resolve(path11.dirname(fileURLToPath2(import.meta.url)), "..");
  const home = process.env.DSH_HOME?.trim() || path11.join(os.homedir(), ".dsh");
  const service = await new PluginService(ctx, {
    storageRoot: config.storageRoot || path11.join(home, "storages", "dsh-evidentloop"),
    approvalFile: config.approvalFile,
    methodRoot: path11.join(packageRoot, "skills/evidentloop-review"),
    assetRoot: path11.join(packageRoot, "dist")
  }).initialize();
  ctx.effect(() => () => service.close());
}
export {
  apply,
  inject,
  name
};
