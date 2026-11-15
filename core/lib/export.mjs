import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { canonical, fileIdentity, isTarget, linesOf } from './common.mjs';
import { loadBundle } from '../validate.mjs';

export const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
export const mdText = value => String(value ?? '').replace(/[\\`*_{}\[\]<>#|!]/g, '\\$&');
export function redactText(text, patterns = []) {
  let value = String(text ?? '').replace(/\/Users\/[^\s/]+|\/home\/[^\s/]+/g, '[本机用户目录]')
    .replace(/(^|[\s('"=])\/(?:private\/tmp|tmp|(?:private\/)?var\/folders)\/[^\s'"<>)]*/g, '$1[本机临时目录]')
    .replace(/\b(?:sk-[A-Za-z0-9_-]{12,}|gh[pousr]_[A-Za-z0-9]{20,}|AKIA[A-Z0-9]{16})\b/g, '[已脱敏]')
    .replace(/\bBearer\s+[^\s"'<>]{8,}/gi, 'Bearer [已脱敏]')
    .replace(/\b(api[_-]?key|access[_-]?token|refresh[_-]?token|password|secret|authorization)\s*[:=]\s*["']?[^\s"',;<>]+["']?/gi, '$1=[已脱敏]')
    .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, '[邮件已脱敏]');
  for (const pattern of patterns) value = value.replace(pattern, '[已脱敏]');
  return value;
}
export function sanitize(value, patterns = []) {
  if (typeof value === 'string') return redactText(value, patterns);
  if (Array.isArray(value)) return value.map(x => sanitize(x, patterns));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, sanitize(v, patterns)]));
  return value;
}
export function activeFindings(run, marks = []) {
  const suppressed = new Set(marks.filter(m => m.suppressed).map(m => m.findingId));
  return (run?.findings ?? []).filter(f => !suppressed.has(f.findingId));
}
export function reviewStatus(snapshot, run, marks = []) {
  if (!run) return '尚未审查';
  const count = activeFindings(run, marks).length;
  const complete = snapshot.status === 'complete' && run.status === 'succeeded' && run.complete === true &&
    !run.coverage?.failed.length && !run.coverage?.withheld.length && snapshot.files.filter(isTarget).every(f => run.coverage.reviewed.includes(f.path));
  if (complete) return count ? `发现 ${count} 个问题` : '未发现问题';
  const reasons = [];
  if (snapshot.status !== 'complete') reasons.push('快照不完整');
  if (run.status === 'failed') reasons.push('审查失败');
  if (run.status === 'cancelled') reasons.push('审查已取消');
  if (run.coverage?.withheld.length) reasons.push(`${run.coverage.withheld.length} 条结论未通过校验`);
  const pending = snapshot.files.filter(isTarget).filter(f => !run.coverage?.reviewed.includes(f.path)).length;
  if (pending) reasons.push(`${pending} 个文件未完成`);
  return (count ? `发现 ${count} 个问题 · ` : '') + (reasons.join('；') || '审查未完成');
}
export const locationLabel = anchor => anchor.startLine === null || anchor.line === null ? `${anchor.path}（文件级）`
  : `${anchor.path}:${anchor.startLine ?? anchor.line}${anchor.endLine && anchor.endLine !== anchor.startLine ? '–' + anchor.endLine : ''}（${anchor.side}）`;
export function compareSnapshots(current, previous) {
  if (!previous) return { added: [], changed: [], removed: [], note: '无上一条审查记录' };
  const old = new Map(previous.files.map(f => [f.path, f]));
  return { added: current.files.filter(f => !old.has(f.path)).map(f => f.path),
    changed: current.files.filter(f => old.has(f.path) && canonical(fileIdentity(f)) !== canonical(fileIdentity(old.get(f.path)))).map(f => f.path),
    removed: previous.files.filter(f => !current.files.some(n => n.path === f.path)).map(f => f.path) };
}
export function exportData(context, { previousSnapshot = null, embedDiff = false, maxSnippetLines = 12, maxSnippetBytes = 8192, maxDiffBytes = 256 * 1024, patterns = [] } = {}) {
  const { snapshot, delivery, run, marks = [], annotations = [], associatedFindings = [], bundleRoot } = context;
  const data = sanitize({ version: 1, snapshot, delivery, run, marks, annotations, associatedFindings, status: reviewStatus(snapshot, run, marks), comparison: compareSnapshots(snapshot, previousSnapshot), snippets: [], fullDiff: [], omissions: [], limitations: ['标为模型推断的说明不代表已验证事实；问题证据校验只证明出处，不保证判断准确。'] }, patterns);
  data.transformedForExport = true;
  data.snapshot.requirements.forEach((source, index) => {
    const original = snapshot.requirements[index]; source.redacted = source.text !== original.text; source.rangesReferToOriginal = true;
    source.items.forEach(item => { item.text = redactText(Array.from(original.text).slice(item.start, item.end).join(''), patterns); });
  });
  if (run?.model?.adapter === 'synthetic') data.limitations.unshift('合成适配器测试输出：本记录未调用真实模型，不是实际代码审查结论。');
  if (data.snapshot.extensionPrompt) {
    const ext = data.snapshot.extensionPrompt, original = snapshot.extensionPrompt.text;
    ext.originalLength = snapshot.extensionPrompt.length; ext.redacted = ext.text !== original; ext.truncated = false;
    if (Buffer.byteLength(ext.text) > 16 * 1024) { delete ext.text; ext.truncated = true; data.omissions.push({ path: 'extensionPrompt.text', reason: '扩展正文超过16KiB，仅保留原始哈希及长度摘要' }); }
  }
  if (!bundleRoot) return data;
  const bundle = loadBundle(bundleRoot), refs = [], seen = new Set();
  for (const f of run?.understanding?.features ?? []) refs.push(...f.refs);
  for (const f of run?.findings ?? []) refs.push(...f.evidence);
  for (const ref of refs) {
    const identity = canonical([ref.path, ref.side, ref.startLine, ref.endLine]); if (seen.has(identity)) continue; seen.add(identity);
    const file = snapshot.files.find(f => f.path === ref.path || f.oldPath === ref.path);
    const side = file && bundle.texts.get(ref.side + ':' + (ref.side === 'base' ? file.oldPath || file.path : file.path));
    if (!side) { data.omissions.push({ path: redactText(ref.path, patterns), reason: '无冻结文本片段' }); continue; }
    const end = Math.min(ref.endLine, ref.startLine + maxSnippetLines - 1);
    const code = redactText(side.lines.slice(ref.startLine - 1, end).join('\n'), patterns);
    if (end < ref.endLine || Buffer.byteLength(code) > maxSnippetBytes) { data.omissions.push({ path: redactText(ref.path, patterns), reason: '片段超过行数或字节上限' }); continue; }
    data.snippets.push({ path: redactText(file.path, patterns), side: ref.side, startLine: ref.startLine, endLine: end, text: code });
  }
  for (const file of snapshot.files.filter(f => !isTarget(f))) data.omissions.push({ path: redactText(file.path, patterns), reason: file.note || '仅元数据，不嵌入源码' });
  if (embedDiff) for (const file of snapshot.files.filter(isTarget)) {
    const text = redactText(fs.readFileSync(path.join(bundleRoot, 'diff', file.path + '.patch'), 'utf8'), patterns);
    if (Buffer.byteLength(text) > maxDiffBytes) data.omissions.push({ path: redactText(file.path, patterns), reason: '完整Diff超过片段字节上限' });
    else data.fullDiff.push({ path: redactText(file.path, patterns), text });
  }
  return data;
}
const refsText = refs => refs.map(r => `${r.path}:${r.startLine}–${r.endLine}（${r.side}）`).join('、');
const sourceItems = data => data.snapshot.requirements.flatMap(s => s.items.map(i => ({ ...i, text: i.text ?? Array.from(s.text).slice(i.start, i.end).join('') })));
export function sections(data) {
  const u = data.run?.understanding, items = new Map(sourceItems(data).map(i => [i.itemId, i.text]));
  const rows = [
    ['需求依据', data.snapshot.requirements.map(s => `${s.order}. ${s.origin}\n${s.text}`)],
    ['变更概览', u ? [u.overview.purpose, ...u.features.map(f => `${f.title}：${f.purpose}`)] : ['尚无通过校验的说明']],
    ['按功能变更', (u?.features ?? []).map(f => `${f.title}\n${f.approach}\n文件：${f.files.join('、')}\n引用：${refsText(f.refs)}`)],
    ['文件清单', data.snapshot.files.map(f => `${f.path} · ${f.change} · +${f.additions ?? 0}/-${f.deletions ?? 0} · ${f.kind}${f.note ? ' · ' + f.note : ''}`)],
    ['行为影响', (u?.impacts ?? []).map(i => `${i.kind}：${i.text}（${refsText(i.refs)}）`)],
  ];
  for (const [title, statuses] of [['未对齐 / 待确认', ['partial', 'not-found', 'unclear']], ['已对齐', ['implemented']], ['已调整', ['superseded']]]) {
    const group = (u?.alignment ?? []).filter(r => statuses.includes(r.status)).map(r => `${items.get(r.requirementItemId) ?? r.requirementItemId}\n${r.status}：${r.note}${r.status === 'superseded' ? '\n后续要求引文：' + r.supersededQuote : '\n' + refsText(r.codeRefs)}`);
    if (group.length) rows.push([title, group]);
  }
  if (u?.extras.length) rows.push(['需求外改动', u.extras.map(e => `${e.text}（${refsText(e.refs)}）`)]);
  const marks = new Set(data.marks.filter(m => m.suppressed).map(m => m.findingId));
  rows.push(['问题与处置', (data.run?.findings ?? []).map(f => `${f.severity} ${f.title} · ${locationLabel(f.anchor)}${marks.has(f.findingId) ? ' · 已标记为非问题' : ''}\n${f.problem}\n影响：${f.impact}${f.suggestion ? '\n修改建议：' + f.suggestion.text + (f.suggestion.code ? '\n' + f.suggestion.code : '') : ''}`)]);
  rows.push(['批注（评审人意见，未经模型校验）', data.annotations.map(a => `${locationLabel(a.anchor)}${a.findingId ? ' · 关联问题：' + (data.run?.findings?.find(f => f.findingId === a.findingId)?.title ?? data.associatedFindings?.find(f => f.findingId === a.findingId)?.title ?? a.findingId) + (marks.has(a.findingId) ? '（原问题已标记为非问题）' : '') : ''}\n${a.text}\n${a.updatedAt}`)]);
  rows.push(['与上次审查相比', [data.comparison.note ?? `新增：${data.comparison.added.join('、') || '无'}；变化：${data.comparison.changed.join('、') || '无'}；移除：${data.comparison.removed.join('、') || '无'}`]]);
  rows.push(['局限', data.limitations]); return rows;
}
function heading(data) {
  const range = data.snapshot.range;
  return [`${data.delivery.title}${data.delivery.externalRef ? ' · ' + data.delivery.externalRef : ''}`, `分支：${data.delivery.branch || '分支信息不可用'} · 范围：${range.targetRef} merge-base ↔ 工作树`,
    `审查时间：${data.run?.endedAt || data.snapshot.createdAt} · 基于提交：${range.headSubject || '提交'}（${(range.headSha || '').slice(0, 8)}）${range.dirty ? ' · 含未提交改动' : ''}`,
    (data.summaryOnly ? '报告仅摘要（正文有省略） · 原审查状态：' : '') + (data.run?.model?.adapter === 'synthetic' ? '合成测试（未调用真实模型） · 合同推导状态：' : '') + data.status, `内置规则版本：${data.snapshot.rulesVersion} · 扩展提示词：${data.snapshot.extensionPrompt ? '已使用 · ' + data.snapshot.extensionPrompt.originalLength + ' 字' : '未使用'}`];
}
export function markdown(context, options = {}) {
  const data = exportData(context, options), header = heading(data);
  const lines = ['# ' + mdText(header[0]), ...header.slice(1).map(mdText), ''];
  for (const [title, entries] of sections(data)) { lines.push('## ' + title, ''); for (const entry of entries.length ? entries : ['无']) lines.push(mdText(entry), ''); }
  if (data.omissions.length) lines.push('## 省略清单', '', ...data.omissions.map(o => `${mdText(o.path)}：${mdText(o.reason)}`));
  return lines.join('\n');
}
function renderHTML(data, nonce) {
  const header = heading(data), esc = escapeHTML;
  // Only fullDiff is patch syntax; frozen source snippets remain plain code.
  // Classify redacted physical lines without inferring source coordinates.
  const renderDiff = text => '<pre class="report-diff">' + String(text).split('\n').map(line => {
    const kind = line.startsWith('+') ? 'add' : line.startsWith('-') ? 'del' : line.startsWith('@@') ? 'hunk' : '';
    return kind ? `<span class="report-diff-line report-diff-${kind}">${esc(line)}</span>` : esc(line);
  }).join('\n') + '</pre>';
  const sectionIds = {
    '需求依据': 'requirements', '变更概览': 'overview', '按功能变更': 'features', '文件清单': 'files',
    '行为影响': 'impacts', '未对齐 / 待确认': 'pending', '已对齐': 'aligned', '已调整': 'adjusted',
    '需求外改动': 'extras', '问题与处置': 'findings', '批注（评审人意见，未经模型校验）': 'annotations',
    '与上次审查相比': 'comparison', '局限': 'limitations', '关键片段': 'snippets', '完整 Diff': 'diff', '省略清单': 'omissions',
  };
  const navigation = new Map();
  const section = (title, body, count, unit = '项') => {
    const id = 'report-' + sectionIds[title];
    const label = count === undefined ? title : `${title}（${count} ${unit}）`;
    navigation.set(id, id === 'report-annotations' ? '批注' : label);
    const heading = `<h2 id="${id}">${esc(label)}</h2>`;
    return `<section>${count === undefined ? heading + body : `<details><summary>${heading}</summary><div class="section-body">${body}</div></details>`}</section>`;
  };
  const paragraphs = entries => (entries.length ? entries : ['无']).map(s => '<p>' + esc(s) + '</p>').join('');
  const body = sections(data).map(([title, entries]) => section(title, paragraphs(entries), title === '文件清单' ? entries.length : undefined, '个文件')).join('') +
    section('关键片段', data.snippets.map(s => '<h3>' + esc(`${s.path}:${s.startLine}–${s.endLine}（${s.side}）`) + '</h3><pre class="report-snippet">' + esc(s.text) + '</pre>').join('') || '<p>无</p>', data.snippets.length, '段') +
    section('完整 Diff', data.fullDiff.map(d => '<h3>' + esc(d.path) + '</h3>' + renderDiff(d.text)).join('') || '<p>无</p>', data.fullDiff.length, '个文件') +
    section('省略清单', paragraphs(data.omissions.map(o => o.path + '：' + o.reason)), data.omissions.length);
  const nav = `<nav class="report-nav" aria-label="报告章节">${[...navigation].map(([id, title]) => `<a href="#${id}">${esc(title)}</a>`).join('')}</nav>`;
  const reportStyle = ':root{color-scheme:light;--el-bg-base:#fff;--el-bg-l3:#f4f5f7;--el-hover:rgba(38,49,72,.06);--el-border-l2:rgba(0,0,0,.10);--el-label-1:#0f1115;--el-label-2:#61666b;--el-brand:#4176e6}@media(prefers-color-scheme:dark){:root{color-scheme:dark;--el-bg-base:#16171a;--el-bg-l3:#282a30;--el-hover:rgba(255,255,255,.08);--el-border-l2:rgba(255,255,255,.12);--el-label-1:#f1f3f5;--el-label-2:#adb2b8;--el-brand:#7aaaff}}body{background:var(--el-bg-base);color:var(--el-label-1);overflow-wrap:anywhere}h1{color:var(--el-brand)}h2{border-color:var(--el-border-l2);scroll-margin-top:16px}section{margin-top:24px}small,.muted{color:var(--el-label-2)}pre,code{background:var(--el-bg-l3)}th,td{border-color:var(--el-border-l2);overflow-wrap:anywhere}.finding{background:var(--el-bg-base);border-color:var(--el-border-l2);border-left-color:#df2a3f}.report-nav{display:flex;flex-wrap:wrap;gap:4px 8px;padding:12px;margin:24px 0;border:1px solid var(--el-border-l2);border-radius:8px;background:var(--el-bg-l3);font-size:13px}.report-nav a{display:block;color:var(--el-label-2);padding:4px 8px;border-radius:4px;text-decoration:none}.report-nav a:hover{color:var(--el-label-1);background:var(--el-hover)}summary{padding:12px 14px;border:1px solid var(--el-border-l2);border-radius:8px;background:var(--el-bg-l3);color:var(--el-label-1);font-size:18px;font-weight:600;cursor:pointer;overflow-wrap:anywhere}summary h2{display:inline;font:inherit;margin:0;padding:0;border:0}details[open]>summary{margin-bottom:12px}.section-body{overflow-x:auto}.report-nav a:focus-visible,summary:focus-visible{outline:2px solid var(--el-brand);outline-offset:3px}pre.report-diff,pre.report-snippet{font:12px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace;white-space:pre;overflow-wrap:normal;word-break:normal;tab-size:4;overflow:auto;padding:12px;max-width:100%;box-sizing:border-box}.report-diff{--el-diff-add-fg:#176333;--el-diff-add-bg:#e6f4ea;--el-diff-del-fg:#a82032;--el-diff-del-bg:#fce8eb;--el-diff-hunk-fg:#50555c;--el-diff-hunk-bg:#e7e9ed}.report-diff .report-diff-line{display:inline-block;min-width:100%}.report-diff .report-diff-add{color:var(--el-diff-add-fg);background:var(--el-diff-add-bg)}.report-diff .report-diff-del{color:var(--el-diff-del-fg);background:var(--el-diff-del-bg)}.report-diff .report-diff-hunk{color:var(--el-diff-hunk-fg);background:var(--el-diff-hunk-bg)}@media(prefers-color-scheme:dark){.report-diff{--el-diff-add-fg:#9ee5b2;--el-diff-add-bg:#183b28;--el-diff-del-fg:#ffb0bb;--el-diff-del-bg:#48232c;--el-diff-hunk-fg:#c5c9d0;--el-diff-hunk-bg:#33363d}}';
  const json = JSON.stringify(data).replace(/[<>&\u2028\u2029]/g, c => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'));
  return '<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
    `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; connect-src 'none'; img-src data:; base-uri 'none'; form-action 'none'; script-src 'nonce-${nonce}'; style-src 'nonce-${nonce}'">` +
    '<title>' + esc(header[0]) + '</title>' + `<style nonce="${nonce}">body{font:15px/1.7 system-ui,sans-serif;max-width:1080px;margin:24px auto;padding:0 16px}section{border-top:1px solid var(--el-border-l2)}p,pre{white-space:pre-wrap;overflow-wrap:anywhere}pre{overflow:auto}${reportStyle}</style></head><body>` +
    '<header><h1>' + esc(header[0]) + '</h1>' + header.slice(1).map(s => '<p>' + esc(s) + '</p>').join('') + '</header>' + nav + body +
    `<script type="application/json" id="evidentloop-data" nonce="${nonce}">${json}</script></body></html>`;
}
export function html(context, { maxReportBytes = 2 * 1024 * 1024, ...options } = {}) {
  if (maxReportBytes < 8192) throw Error('Report budget must be at least 8192 bytes');
  const data = exportData(context, options), nonce = crypto.randomBytes(18).toString('base64');
  let output = renderHTML(data, nonce);
  if (Buffer.byteLength(output) > maxReportBytes) {
    const original = { findings: data.run?.findings?.length ?? 0, annotations: data.annotations.length, files: data.snapshot.files.length };
    data.omissions = [...data.omissions, { path: 'report', reason: `整份UTF-8超过预算；已省略正文/源码，原有文件${original.files}、问题${original.findings}、批注${original.annotations}项；请提高预算或导出Markdown` },
      ...data.snippets.map(s => ({ path: s.path, reason: '整份预算：省略关键片段' })), ...data.fullDiff.map(d => ({ path: d.path, reason: '整份预算：省略完整Diff' })),
      ...(data.run?.findings ?? []).map(f => ({ path: f.findingId + ' · ' + f.anchor.path, reason: '整份预算：省略问题正文' })),
      ...data.annotations.map(a => ({ path: a.annotationId + ' · ' + a.anchor.path, reason: '整份预算：省略批注正文' })),
      ...data.snapshot.requirements.map(r => ({ path: r.reqId, reason: '整份预算：省略需求正文' }))];
    data.snippets = []; data.fullDiff = []; data.annotations = []; data.associatedFindings = []; data.snapshot.requirements = [];
    if (data.snapshot.extensionPrompt) { delete data.snapshot.extensionPrompt.text; data.snapshot.extensionPrompt.truncated = true; }
    if (data.run) {
      data.run = { runId: data.run.runId, status: data.run.status, complete: data.run.complete, endedAt: data.run.endedAt, model: data.run.model,
        findings: [], understanding: null, coverage: { reviewed: [], skipped: [], failed: [], withheld: [] } };
    }
    data.summaryOnly = true; data.originalCounts = original;
    output = renderHTML(data, nonce);
    if (Buffer.byteLength(output) > maxReportBytes) throw Error('Report metadata exceeds byte budget');
  }
  return output;
}
