import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { Drafts, markdown, html, exportData, reviewStatus } from '../index.mjs';
import { setup, bundle, syntheticModel } from './helpers.mjs';

const embedded = document => JSON.parse(document.match(/<script[^>]*id="evidentloop-data"[^>]*>(.*?)<\/script>/s)[1]);
async function reviewed(dir, options = {}) {
  const t = await setup(dir, options), b = bundle(dir, t.repo, 'bundle', options.bundleOptions);
  const run = await t.core.requestBundle({ projectKey: t.key, deliveryId: t.delivery.deliveryId, bundle: b });
  return { ...t, run, context: t.core.selected(t.key, run.snapshotId), drafts: new Drafts(t.adapter) };
}
export async function runExportDrafts(test) {
  await test('export: HTML text and script-close data injection are escaped; report is self-contained with nonce CSP', async (dir, artifact) => {
    const attack = '</script><img src="https://evil.invalid/x" onerror="globalThis.PWNED=1"><script>';
    const t = await reviewed(dir, { model: req => { const m = syntheticModel(req); m.overview.purpose = attack; m.features[0].title = attack; return m; } });
    await t.core.annotate(t.key, { snapshotId: t.run.snapshotId, findingId: t.run.findings[0].findingId, text: attack });
    const context = t.core.selected(t.key, t.run.snapshotId), report = html(context, { embedDiff: true });
    fs.writeFileSync(path.join(artifact, 'injection.html'), report);
    assert(!report.includes('<img src="https://evil')); assert(report.includes('\\u003c/script')); assert(report.includes('connect-src \'none\'')); assert(report.includes('nonce='));
    const data = embedded(report); assert.equal(data.run.understanding.overview.purpose, attack); assert.equal(data.annotations[0].text, attack); assert.equal(data.annotations[0].snapshotId, t.run.snapshotId);
    assert(!/<(?:link|iframe|img)\b/i.test(report));
  });
  await test('export: extension original hash/length retained separately from redacted or omitted text; Markdown excludes extension body', async (dir, artifact) => {
    const extension = 'EXTENSION_ONLY_MARKER\napiKey=PRIVATE_EXTENSION_VALUE\n';
    const t = await reviewed(dir, { bundleOptions: { extension } });
    const document = html(t.context), data = embedded(document), snapshot = t.context.snapshot;
    assert.equal(data.snapshot.extensionPrompt.sha256, snapshot.extensionPrompt.sha256); assert.equal(data.snapshot.extensionPrompt.originalLength, snapshot.extensionPrompt.length);
    assert(data.snapshot.extensionPrompt.redacted); assert(!document.includes('PRIVATE_EXTENSION_VALUE')); assert(!markdown(t.context).includes('EXTENSION_ONLY_MARKER'));
    assert(markdown(t.context).includes('已使用'));
    fs.writeFileSync(path.join(artifact, 'extension.html'), document);
  });
  await test('export: snippet lines, diff byte caps and total UTF-8 budget produce explicit omission lists', async (dir, artifact) => {
    const t = await reviewed(dir, { bundleOptions: { extension: '长扩展'.repeat(7000) } });
    const report = html(t.context, { embedDiff: true, maxSnippetBytes: 1, maxDiffBytes: 1, maxReportBytes: 16000 });
    fs.writeFileSync(path.join(artifact, 'bounded.html'), report); assert(Buffer.byteLength(report) <= 16000);
    const data = embedded(report); assert(data.omissions.some(o => o.reason.includes('扩展正文'))); assert(data.omissions.some(o => o.path === 'code.js'));
    assert(data.snapshot.extensionPrompt.truncated); assert(!('text' in data.snapshot.extensionPrompt));
    const huge = structuredClone(t.context); huge.run.understanding.overview.purpose = '特别长'.repeat(20000);
    const summary = html(huge, { maxReportBytes: 16000 }); assert(Buffer.byteLength(summary) <= 16000); assert(embedded(summary).summaryOnly); assert(embedded(summary).omissions.some(o => o.reason.includes('问题正文')));
  });
  await test('export: field redaction preserves requirement item text independently of original code-point ranges', async dir => {
    const t = await reviewed(dir, { bundleOptions: { requirements: [{ order: 0, kind: 'paste', text: 'apiKey=SECRET_VALUE 第二条要求', items: [{ start: 0, end: 19 }, { start: 19, end: 25 }] }] } });
    const data = exportData(t.context); assert(data.snapshot.requirements[0].redacted); assert(!JSON.stringify(data).includes('SECRET_VALUE'));
    assert(data.snapshot.requirements[0].rangesReferToOriginal); assert(data.snapshot.requirements[0].items[1].text);
  });
  await test('draft: linked annotation prevents duplicate finding, suppressed note is labelled, not-found has no invented line', async dir => {
    const t = await reviewed(dir, { model: req => { const m = syntheticModel(req); m.alignment[0] = { ...m.alignment[0], status: 'not-found', codeRefs: [], note: '未找到实现' }; return m; } });
    const finding = t.run.findings[0]; await t.core.annotate(t.key, { snapshotId: t.run.snapshotId, findingId: finding.findingId, text: '修改意见' });
    await t.core.mark(t.key, { snapshotId: t.run.snapshotId, findingId: finding.findingId, suppressed: true });
    const locked = await t.drafts.lock(t.core.selected(t.key, t.run.snapshotId), 'issues');
    assert(locked.text.includes('原问题已标记为非问题')); assert(!locked.text.includes('## 待处理问题')); assert(locked.text.includes('无代码定位')); assert.equal(locked.text.split(finding.title).length - 1, 1);
  });
  await test('draft: valid superseded omitted; rejected superseded remains unclear with reason', async dir => {
    let invalid = false;
    const t = await reviewed(dir, { bundleOptions: { requirements: [{ order: 0, kind: 'paste', text: 'OLD_REQUIRED' }, { order: 1, kind: 'paste', text: '取消OLD_REQUIRED，改为NEW_REQUIRED' }] },
      model: req => { const m = syntheticModel(req); m.alignment[0] = { requirementItemId: m.alignment[0].requirementItemId, status: 'superseded', codeRefs: [], note: '被后续要求调整', supersededBy: m.alignment[1].requirementItemId, supersededQuote: invalid ? '不存在的引文' : '取消OLD_REQUIRED，改为NEW_REQUIRED' }; return m; } });
    const first = await t.drafts.lock(t.context, 'issues'); assert(!first.text.includes('## 未对齐'));
    invalid = true; const run = await t.core.reviewCurrent(t.key, t.delivery.deliveryId, { force: true }); const locked = await t.drafts.lock(t.core.selected(t.key, run.snapshotId), 'issues');
    assert(locked.text.includes('OLD_REQUIRED')); assert(locked.text.includes('调整依据未通过校验'));
  });
  await test('draft: lock freezes Mark/annotation/body, existing text/quote/attachment preserved, repeats never append twice', async dir => {
    const t = await reviewed(dir); const note = await t.core.annotate(t.key, { snapshotId: t.run.snapshotId, findingId: t.run.findings[0].findingId, text: '锁定旧批注' });
    const locked = await t.drafts.lock(t.core.selected(t.key, t.run.snapshotId), 'issues'), original = locked.text;
    await t.core.annotate(t.key, { snapshotId: t.run.snapshotId, findingId: t.run.findings[0].findingId, annotationId: note.annotationId, text: '后来编辑内容' });
    await t.core.mark(t.key, { snapshotId: t.run.snapshotId, findingId: t.run.findings[0].findingId, suppressed: true });
    const draft = { text: 'EXISTING   \n', revision: 4, quotes: [{ id: 'quote', text: 'code' }], attachments: [{ id: 'attachment' }] }; t.adapter.drafts.set('dev', structuredClone(draft));
    locked.text = 'caller mutation'; const preview = await t.drafts.commit(locked.token, { displayedSnapshotId: t.run.snapshotId }); assert.equal(preview.status, 'preview'); assert.equal((await t.adapter.getDraft('dev')).text, draft.text);
    const written = await t.drafts.commit(locked.token, { displayedSnapshotId: t.run.snapshotId, choice: 'append' }); assert.equal(written.text, original); assert(written.text.includes('锁定旧批注')); assert(!written.text.includes('后来编辑内容'));
    const after = await t.adapter.getDraft('dev'); assert.equal(after.text, draft.text + '\n\n' + original); assert.deepEqual(after.quotes, draft.quotes); assert.deepEqual(after.attachments, draft.attachments);
    assert.equal((await t.drafts.commit(locked.token, { displayedSnapshotId: t.run.snapshotId, choice: 'append' })).status, 'unchanged'); assert.equal((await t.adapter.getDraft('dev')).revision, after.revision); assert.equal(t.adapter.calls.length, 1);
  });
  for (const state of ['deleted', 'archived', 'cross-project', 'snapshot-changed', 'draft-raced']) await test('draft: safe clipboard fallback ' + state, async dir => {
    const t = await reviewed(dir), lock = await t.drafts.lock(t.context, 'issues');
    if (state === 'deleted') t.adapter.sessionRows.delete('dev');
    if (state === 'archived') t.adapter.sessionRows.get('dev').archived = true;
    if (state === 'cross-project') t.adapter.sessionRows.get('dev').projectKey = 'f'.repeat(64);
    if (state === 'draft-raced') t.adapter.writeDraft = async () => false;
    const result = await t.drafts.commit(lock.token, { displayedSnapshotId: state === 'snapshot-changed' ? 'another' : t.run.snapshotId });
    assert.equal(result.status, 'copied'); assert.equal(t.adapter.clipboard, lock.text); assert.equal((await t.adapter.getDraft('dev')).text, ''); assert.equal(t.adapter.calls.length, 1);
  });
  await test('draft: root development target, no-session disabled, supplement only validated structured explanation', async dir => {
    const t = await reviewed(dir, { bundleOptions: { requirements: [{ order: 0, kind: 'paste', text: 'REQUIREMENT_ONLY_MARKER' }], extension: 'EXTENSION_ONLY_MARKER' } });
    t.adapter.sessionRows.set('child', { id: 'child', origin: 'subagent', parentSession: 'dev', projectKey: t.key }); t.adapter.sessionRows.set('review', { id: 'review', kind: 'review', projectKey: t.key });
    const context = structuredClone(t.context); context.delivery.sessionIds = ['child', 'review']; const lock = await t.drafts.lock(context, 'understanding', { skillName: 'example' }); assert.equal(lock.targetId, 'dev');
    assert(lock.text.includes('本任务不修改业务代码')); assert(!lock.text.includes('REQUIREMENT_ONLY_MARKER')); assert(!lock.text.includes('EXTENSION_ONLY_MARKER')); assert(!lock.text.includes('return 2;'));
    context.delivery.sessionIds = []; assert.equal((await t.drafts.lock(context, 'issues')).available, false);
    context.delivery.sessionIds = ['dev']; context.run.understanding.features = []; context.run.understanding.files.forEach(f => { f.semantic.items = []; }); context.run.understanding.impacts = [];
    assert.equal((await t.drafts.lock(context, 'understanding')).available, false);
  });
  await test('draft: common Unicode length cap lists omitted items and redacts sensitive fields', async dir => {
    const t = await reviewed(dir); await t.core.annotate(t.key, { snapshotId: t.run.snapshotId, findingId: t.run.findings[0].findingId, text: 'secret=HIDDEN_VALUE\n' + '😀'.repeat(1500) });
    const service = new Drafts(t.adapter, { maxCodePoints: 500 }), lock = await service.lock(t.core.selected(t.key, t.run.snapshotId), 'issues');
    assert(Array.from(lock.text).length <= 500); assert(lock.omitted.length > 0); assert(lock.text.includes('省略清单')); assert(!lock.text.includes('HIDDEN_VALUE'));
  });
}
