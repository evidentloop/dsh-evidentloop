// Pure diff routines extracted from the frozen prototype builder; no Git or synthetic layer.
import { linesOf } from './common.mjs';

export function diffLines(oldText, newText) {
  const oldLines = linesOf(oldText);
  const newLines = linesOf(newText);
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

export function unifiedDiff(filePath, oldText, newText) {
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

export function changedLineSets(diff) {
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

