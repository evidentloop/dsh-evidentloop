/* Post-delivery annotation entry toggle and the reachable saved-note focus regression. */
'use strict';
const path = require('node:path');
module.exports = {
  id: 'annotation-toggle', order: 11, scenarios: ['reviewed'],
  async run(rt) {
    const { page, open, check, shot, scoped, markStep } = rt;
    if (!scoped('reviewed')) return;
    const foldedLabel = '收起批注（保留草稿）';
    const assertState = async (button, expanded, label, name) => {
      check(name, await button.evaluate((node, expected) => node.getAttribute('aria-expanded') === String(expected.expanded) &&
        node.getAttribute('aria-label') === expected.label && node._tip === expected.label, { expanded, label }));
    };
    const focusIs = button => button.evaluate(node => document.activeElement === node && !node.matches('.annotation-add-btn'));
    markStep('annotation entry toggles, drafts and precise focus');
    for (const theme of ['light', 'dark']) {
      await page.setViewportSize({ width: 1300, height: 950 });
      await open({ scenario: 'reviewed', file: 'prototype/scripts/build-data.mjs', theme });
      const comments = page.locator('.issue-card-comment');
      check(theme + ': real issue-comment fixtures have distinct findings', await comments.count() >= 2);
      const first = comments.first(), second = comments.nth(1);
      const findingId = await first.evaluate(node => node.closest('.gpt-risk-marker').dataset.issueKey);
      const initialNotes = await page.evaluate(() => CRPrototype.annotations.list(CRPrototype.app.snapshot.snapshotId).length);
      await assertState(first, false, '添加批注', theme + ': closed new-note entry exposes its original label and tooltip');
      await first.press('Enter');
      await assertState(first, true, foldedLabel, theme + ': Enter opens new-note entry and advertises collapse');
      const draft = '新建批注草稿 ' + theme + ' 😀，必须保留。';
      await page.locator('.annotation-editor__input').fill(draft);
      await first.hover(); await page.waitForTimeout(360);
      check(theme + ': actual open-entry tooltip matches its state', (await page.getByRole('tooltip').innerText()).trim() === foldedLabel);
      const tipShot = 'toggle-issue-tooltip-' + theme;
      await page.screenshot({ path: path.join(rt.output, tipShot + '.png') }); rt.screenshots.push(tipShot);
      await shot('toggle-issue-open-' + theme);
      await first.evaluate(node => { window.__toggleFirstEntry = node; });
      await first.press('Space');
      check(theme + ': Space collapses without folding issue or replacing its entry', await page.evaluate(id => {
        const node = document.querySelector('.gpt-risk-marker[data-issue-key="' + CSS.escape(id) + '"] .issue-card-comment');
        return !CRPrototype.app.annotationEditor.open && document.activeElement === node && node === window.__toggleFirstEntry &&
          !node.closest('.gpt-risk-marker').classList.contains('is-collapsed');
      }, findingId));
      await assertState(first, false, '添加批注', theme + ': collapsed issue entry restores original aria and tooltip');
      await shot('toggle-issue-collapsed-focus-' + theme);
      await first.click();
      check(theme + ': reopening the same issue restores the exact draft', await page.locator('.annotation-editor__input').inputValue() === draft);
      await second.click();
      check(theme + ': different finding switches rather than collapsing', await page.evaluate(id => CRPrototype.app.annotationEditor.open && CRPrototype.app.annotationEditor.findingId !== id, findingId));
      await page.locator('.annotation-editor__input').fill('第二个入口的草稿 ' + theme);
      await first.click();
      check(theme + ': cross-finding roundtrip keeps both drafts', await page.locator('.annotation-editor__input').inputValue() === draft &&
        await page.evaluate(() => Object.values(CRPrototype.app.annotationDrafts).some(text => text.includes('第二个入口的草稿'))));
      const input = page.locator('.annotation-editor__input');
      await input.dispatchEvent('compositionstart');
      const composingDraft = '合成输入中暂存 ' + theme + ' 😀'; await input.fill(composingDraft);
      await input.dispatchEvent('keydown', { key: 'Escape', code: 'Escape', isComposing: true });
      check(theme + ': composing Escape still cannot collapse the editor', await page.locator('.annotation-editor').count() === 1);
      await first.click();
      check(theme + ': clicking entry during synthetic composition collapses but never saves', await page.locator('.annotation-editor').count() === 0 &&
        await page.evaluate(count => CRPrototype.annotations.list(CRPrototype.app.snapshot.snapshotId).length === count, initialNotes));
      await first.click();
      check(theme + ': composing draft survives click-collapse and reopen', await page.locator('.annotation-editor__input').inputValue() === composingDraft);
      await page.locator('.annotation-editor__input').press('Escape');
      check(theme + ': textarea Escape returns to the same issue entry', await focusIs(first));
      // A saved linked annotation and the new-note entry share a finding, but not a toggle identity.
      const linked = await page.evaluate(id => {
        const app = CRPrototype.app;
        const result = CRPrototype.annotations.add({ snapshotId: app.snapshot.snapshotId, findingId: id, text: '已存关联批注：用于切换规则核验。' });
        if (!result.ok) throw Error(result.message); app.annotationVersion++; return result.annotation.annotationId;
      }, findingId);
      const edit = page.locator('.annotation-card[data-annotation-id="' + linked + '"] [data-action="edit"]');
      await assertState(edit, false, '编辑批注', theme + ': saved entry starts with edit aria and tooltip');
      await first.click(); await page.locator('.annotation-editor__input').fill('新建与编辑互切的草稿 ' + theme);
      await edit.click();
      check(theme + ': saved-note edit opens even when its finding has a new-note editor', await page.evaluate(id => CRPrototype.app.annotationEditor.open && CRPrototype.app.annotationEditor.annotationId === id, linked));
      await assertState(edit, true, foldedLabel, theme + ': saved entry exposes collapse aria and tooltip');
      await assertState(first, false, '添加批注', theme + ': editing a saved note does not mark the new-note entry open');
      await page.locator('.annotation-editor__input').fill('已存批注未保存修改 ' + theme);
      await first.click();
      check(theme + ': issue comment switches from saved edit to new draft, not collapse', await page.locator('.annotation-editor__input').inputValue() === '新建与编辑互切的草稿 ' + theme &&
        await page.evaluate(() => CRPrototype.app.annotationEditor.open && !CRPrototype.app.annotationEditor.annotationId));
      await edit.click();
      check(theme + ': saved-edit draft is restored on cross-entry return', await page.locator('.annotation-editor__input').inputValue() === '已存批注未保存修改 ' + theme);
      await edit.hover(); await shot('toggle-saved-linked-open-' + theme);
      await edit.evaluate(node => { window.__toggleSavedEntry = node; });
      await edit.press('Enter');
      check(theme + ': Enter collapses saved edit and keeps the exact trigger DOM focused', await page.evaluate(id => {
        const node = document.querySelector('.annotation-card[data-annotation-id="' + CSS.escape(id) + '"] [data-action="edit"]');
        return !CRPrototype.app.annotationEditor.open && document.activeElement === node && node === window.__toggleSavedEntry;
      }, linked));
      await assertState(edit, false, '编辑批注', theme + ': closed saved entry restores edit label and tooltip');
      await shot('toggle-saved-linked-collapsed-focus-' + theme);
      await edit.press('Space');
      check(theme + ': Space reopens the saved edit without committing changes', await page.locator('.annotation-editor__input').inputValue() === '已存批注未保存修改 ' + theme &&
        await page.evaluate(id => CRPrototype.annotations.list(CRPrototype.app.snapshot.snapshotId).find(note => note.annotationId === id).text === '已存关联批注：用于切换规则核验。', linked));
      await page.locator('.annotation-editor__cancel').click();
      check(theme + ': explicit collapse control also focuses saved edit', await focusIs(edit));
    }
    markStep('reachable seeded line-note focus regressions');
    for (const file of ['prototype/src/app.js', 'prototype/src/scenarios.js']) {
      await open({ scenario: 'reviewed', file, theme: 'light' });
      const note = await page.evaluate(file => CRPrototype.app.snapshotAnnotations.find(note => !note.findingId && note.anchor.path === file && note.anchor.startLine), file);
      check(file + ': original no-findingId line annotation is UI reachable', Boolean(note));
      const edit = page.locator('.annotation-card[data-annotation-id="' + note.annotationId + '"] [data-action="edit"]');
      await edit.click(); await page.locator('.annotation-editor__input').fill('种子行级批注未保存草稿 ' + file);
      check(file + ': line editor has an annotation id and no finding id', await page.evaluate(id => CRPrototype.app.annotationEditor.annotationId === id && !CRPrototype.app.annotationEditor.findingId && CRPrototype.app.annotationEditor.line > 0, note.annotationId));
      await shot(file.endsWith('app.js') ? 'focus-seed-app-line-open' : 'focus-seed-scenarios-line-open');
      await page.locator('.annotation-editor__cancel').click();
      check(file + ': collapsing focuses its saved edit and never the code-question button', await focusIs(edit));
      await shot(file.endsWith('app.js') ? 'focus-seed-app-line-collapsed' : 'focus-seed-scenarios-line-collapsed');
      await page.keyboard.press('Enter');
      check(file + ': Enter after collapse edits the annotation rather than asking a session', await page.evaluate(id => CRPrototype.app.view === 'review' && CRPrototype.app.annotationEditor.open && CRPrototype.app.annotationEditor.annotationId === id, note.annotationId));
      check(file + ': seed draft is preserved without changing saved content', await page.locator('.annotation-editor__input').inputValue() === '种子行级批注未保存草稿 ' + file &&
        await page.evaluate(({ id, text }) => CRPrototype.annotations.list(CRPrototype.app.snapshot.snapshotId).find(note => note.annotationId === id).text === text, { id: note.annotationId, text: note.text }));
      await page.locator('.annotation-editor__input').press('Escape');
    }
    markStep('saved file-level focus and readonly entries');
    await open({ scenario: 'reviewed', file: 'prototype/src/app.js', theme: 'dark' });
    const fileId = await page.evaluate(() => {
      const app = CRPrototype.app, file = app.selectedFileItem.file;
      const result = CRPrototype.annotations.add({ snapshotId: app.snapshot.snapshotId, anchor: { path: app.selectedFileItem.path, side: 'head', startLine: null, endLine: null, sha256: file.headSha256 }, text: '文件级批注：不伪造行号。' });
      if (!result.ok) throw Error(result.message); app.annotationVersion++; return result.annotation.annotationId;
    });
    const fileEdit = page.locator('.annotation-card[data-annotation-id="' + fileId + '"] [data-action="edit"]');
    await fileEdit.click();
    check('file-level saved editor has null line and no finding id', await page.evaluate(id => CRPrototype.app.annotationEditor.annotationId === id && CRPrototype.app.annotationEditor.line === null && !CRPrototype.app.annotationEditor.findingId, fileId));
    await page.locator('.annotation-editor__input').fill('文件级未保存草稿 😀'); await shot('focus-file-level-open-dark');
    await fileEdit.click();
    check('file-level click-collapse focuses its own edit button', await focusIs(fileEdit));
    await assertState(fileEdit, false, '编辑批注', 'file-level collapsed edit exposes the original state');
    await shot('focus-file-level-collapsed-dark');
    await fileEdit.press('Enter');
    check('file-level Enter reopens exact retained draft', await page.locator('.annotation-editor__input').inputValue() === '文件级未保存草稿 😀');
    await page.locator('.annotation-editor__input').press('Escape');
    check('file-level Escape returns to the saved edit, not body or unrelated controls', await focusIs(fileEdit));
    await open({ scenario: 'history' });
    check('history still renders neither new-note nor saved-note edit entries', await page.locator('.issue-card-comment,.annotation-card [data-action="edit"]').count() === 0);
  },
};
