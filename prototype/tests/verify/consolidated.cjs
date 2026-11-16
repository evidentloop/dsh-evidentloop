/* Approved P1 UI contract, using the real Vue model and original event methods. */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
module.exports = {
  id: 'consolidated', order: 10, scenarios: ['list', 'reviewed', 'extension-none'],
  async run(rt) {
    const { page, open, check, shot, scoped, markStep } = rt;
    if (!scoped('list', 'reviewed', 'extension-none')) return;
    const ids = () => page.locator('.delivery-row').evaluateAll(nodes => nodes.map(node => node.dataset.deliveryId));
    const chooseWorkspace = async name => {
      await page.locator('.list-workspace-switch').click();
      await page.locator('.workspace-item').filter({ has: page.locator('.workspace-item-name', { hasText: new RegExp('^' + name + '$') }) }).click();
    };
    const settings = async () => {
      if (!await page.locator('.settings-menu').count()) await page.getByRole('button', { name: '工作区设置', exact: true }).click();
    };
    const contentWidth = async target => {
      // Exercise a narrow embedded list while keeping the desktop viewport usable.
      await page.setViewportSize({ width: Math.max(1100, target + 252 + 64), height: 1000 });
      const padding = await page.locator('.delivery-list').evaluate(node => parseFloat(getComputedStyle(node).paddingLeft) + parseFloat(getComputedStyle(node).paddingRight));
      await page.locator('.list-header,.list-rail,.delivery-list').evaluateAll((nodes, width) => {
        for (const node of nodes) { node.style.width = width + 'px'; node.style.maxWidth = '100%'; }
      }, target + padding);
      return target;
    };
    markStep('P1 A/B: live list data, scope, filter and layout');
    await open({ scenario: 'list', console: '1' });
    check('A01 host sidebar and independent demo console are retained', await page.locator('.dsh-sidebar').isVisible() && await page.locator('.prototype-console').count() === 1);
    check('A02 header has one functional workspace picker and search without a decorative logo', await page.locator('.list-workspace-switch').count() === 1 &&
      await page.locator('.list-header input[aria-label="搜索交付"]').count() === 1 && await page.locator('.list-header .brandmark').count() === 0 &&
      !(await page.locator('.list-header').innerText()).includes('个进行中'));
    await open({ scenario: 'list' });
    check('A03 effective-issue filter defaults off and scope counts use the real workspace', !await page.locator('.list-problem-filter input').isChecked() &&
      await page.locator('.delivery-scope-all').evaluate(node => node.textContent.includes(String(CRPrototype.app.workspaceActiveCount))));
    const gridIds = await ids();
    await page.getByRole('button', { name: '紧凑视图', exact: true }).click();
    check('A04 grid and compact render the same delivery identities and real table headers', JSON.stringify(await ids()) === JSON.stringify(gridIds) &&
      await page.locator('.delivery-table thead th[scope="col"]').count() === 7 && await page.locator('.delivery-table thead[aria-hidden="true"]').count() === 0);
    const sessionRow = page.locator('.delivery-row').filter({ has: page.locator('.delivery-session-link') }).first();
    const tabOrder = await sessionRow.locator('button').evaluateAll(nodes => nodes.map(node => node.className));
    check('B01 compact DOM order is title, session, explanation, menu', tabOrder.length === 4 &&
      tabOrder[0].includes('delivery-title') && tabOrder[1].includes('delivery-session-link') && tabOrder[2].includes('delivery-changes') && tabOrder[3].includes('delivery-more'));
    await sessionRow.locator('.delivery-title').focus(); await page.keyboard.press('Tab');
    check('B02 Tab reaches the real session entry after title', await sessionRow.locator('.delivery-session-link').evaluate(node => document.activeElement === node));
    await page.keyboard.press('Tab');
    check('B03 Tab reaches explanation before the menu', await sessionRow.locator('.delivery-changes').evaluate(node => document.activeElement === node));
    await page.keyboard.press('Tab');
    check('B04 Tab reaches the menu last', await sessionRow.locator('.delivery-more').evaluate(node => document.activeElement === node));
    await page.keyboard.press('ArrowDown');
    check('B05 menu ArrowDown opens and focuses an enabled item', await page.locator('.delivery-menu [role="menuitem"]').evaluateAll(nodes => nodes.some(node => document.activeElement === node && !node.disabled)));
    await page.keyboard.press('End');
    check('B06 End reaches destructive text without changing the delivery', await page.locator('.delivery-menu .wb-menu-item--danger').evaluate(node => document.activeElement === node && node.textContent.trim() === '删除'));
    await page.keyboard.press('Escape');
    check('B07 Escape closes the menu and restores its trigger', await page.locator('.delivery-menu').count() === 0 && await sessionRow.locator('.delivery-more').evaluate(node => document.activeElement === node));
    await page.locator('.list-sort-trigger').focus(); await page.keyboard.press('ArrowDown');
    check('A05 sort menu has only the approved two options and an expanded upward caret', await page.locator('.list-sort-menu [role="menuitemradio"]').count() === 2 &&
      await page.locator('.list-sort-trigger .menu-caret').evaluate(node => node.classList.contains('is-open')));
    await page.keyboard.press('End'); await page.keyboard.press('Enter');
    check('A06 issue-count sort keeps pins first and restores focus', await page.evaluate(() => {
      const app = CRPrototype.app, rows = app.visibleDeliveryRows, unpinned = rows.filter(row => !app.listMeta(row).pinned);
      return app.listSort === 'problems' && rows.slice(0, rows.filter(row => app.listMeta(row).pinned).length).every(row => app.listMeta(row).pinned) &&
        unpinned.every((row, index) => !index || Number(unpinned[index - 1].latest?.validFindingCount || 0) >= Number(row.latest?.validFindingCount || 0)) &&
        document.activeElement === document.querySelector('.list-sort-trigger');
    }));
    await page.locator('.list-problem-filter input').check();
    check('A07 only effective findings are filtered; zero-withheld is not called clean', await page.evaluate(() => {
      const app = CRPrototype.app;
      const withheld = app.deliveries.find(row => row.deliveryId === 'del-demo-withheld-only');
      return app.visibleDeliveryRows.every(row => Number(row.latest.validFindingCount) > 0) &&
        !app.deliveryStatusLabel(withheld).includes('未发现问题');
    }));
    await page.locator('input[aria-label="搜索交付"]').fill('no-such-delivery-P1');
    const beforeClear = await page.evaluate(() => ({ workspace: CRPrototype.app.currentWorkspaceId, sort: CRPrototype.app.listSort, scope: CRPrototype.app.archiveExpanded, count: CRPrototype.app.deliveries.length }));
    await page.getByRole('button', { name: '清空搜索与筛选', exact: true }).click();
    check('A08 empty-state clear resets only query and issue filter', await page.evaluate(before => {
      const app = CRPrototype.app; return !app.deliverySearch && !app.listProblemOnly && app.currentWorkspaceId === before.workspace &&
        app.listSort === before.sort && app.archiveExpanded === before.scope && app.deliveries.length === before.count;
    }, beforeClear));
    await shot('A-list-compact-controls');
    await page.locator('.delivery-archive-toggle').click();
    check('A09 archive scope has no pin indicator or pin action', await page.locator('.delivery-pin').count() === 0 &&
      await page.locator('.delivery-row').count() > 0);
    await page.locator('.delivery-more').first().click();
    check('A10 archive menu stays plain text unarchive/delete', JSON.stringify((await page.locator('.delivery-menu .wb-menu-item').allInnerTexts()).map(s => s.trim())) === JSON.stringify(['取消归档', '删除']));
    await page.keyboard.press('Escape'); await shot('A-list-compact-archived'); await page.locator('.delivery-scope-all').click();
    await page.locator('.delivery-more').first().click(); await page.locator('.delivery-menu .wb-menu-item--danger').click();
    const countBeforeDelete = await page.evaluate(() => CRPrototype.app.deliveries.length);
    await shot('A-delete-confirmation'); await page.getByRole('button', { name: '取消', exact: true }).click();
    check('A11 deleting still requires confirmation and cancel preserves data', await page.evaluate(count => CRPrototype.app.deliveries.length === count && !CRPrototype.app.deleteDialog.open, countBeforeDelete));

    markStep('P1 B: measured content containers and session states');
    const responsive = [];
    for (const theme of ['light', 'dark']) {
      await open({ scenario: 'list', theme }); await page.getByRole('button', { name: '紧凑视图', exact: true }).click();
      await page.evaluate(() => {
        const app = CRPrototype.app;
        const row = app.deliveries.find(row => row.projectKey === app.activeWorkspace.repoKey && !app.listMeta(row).archived && !app.devSessionFor(row));
        if (row) { row.title = '需要完整保留的长交付标题'.repeat(8); row.branch = 'feature/' + 'long-branch-'.repeat(18); }
      });
      for (const width of [667, 800, 1000, 1200, 1600]) {
        const expectedWidth = await contentWidth(width); await page.waitForTimeout(100);
        const sample = await page.evaluate(() => {
          const list = document.querySelector('.delivery-list'), wrapper = document.querySelector('.delivery-table-scroll');
          const content = list.clientWidth - parseFloat(getComputedStyle(list).paddingLeft) - parseFloat(getComputedStyle(list).paddingRight);
          const rows = [...document.querySelectorAll('.delivery-table tbody tr')];
          return { content, viewport: innerWidth, overflow: wrapper.scrollWidth > wrapper.clientWidth + 1,
            globalOverflow: document.documentElement.scrollWidth > innerWidth,
            maxHeight: Math.max(...rows.map(row => row.getBoundingClientRect().height)),
            visibleHeads: [...document.querySelectorAll('.delivery-table th')].filter(node => getComputedStyle(node).display !== 'none').length,
            branchVisible: rows.every(row => [...row.querySelectorAll('.delivery-branch')].some(node => node.getClientRects().length && node.getBoundingClientRect().height > 0)),
            noSticky: rows.every(row => getComputedStyle(row.querySelector('.delivery-name-cell')).position !== 'sticky'),
            sidebar: Boolean(document.querySelector('.dsh-sidebar')?.getClientRects().length) };
        });
        check('B08 ' + theme + '/' + width + ': measured real content width, branch retained, no overflow or fixed first column', Math.abs(sample.content - expectedWidth) < .6 &&
          sample.sidebar && sample.branchVisible && !sample.overflow && !sample.globalOverflow && sample.noSticky);
        check('B09 ' + theme + '/' + width + ': 7/6/5 columns and compact rows at most 52px', sample.maxHeight <= 52 && sample.visibleHeads === (sample.content >= 1050 ? 7 : sample.content >= 850 ? 6 : 5));
        responsive.push({ theme, requested: width, expectedContent: expectedWidth, ...sample });
        await shot('B-compact-' + width + '-' + theme);
      }
      const compactIdentity = await ids();
      await page.getByRole('button', { name: '网格视图', exact: true }).click(); await page.mouse.move(0, 0);
      for (const width of [667, 800, 1000, 1200, 1600]) {
        await contentWidth(width); await page.waitForTimeout(100);
        check('A14 ' + theme + '/' + width + ': grid shares identities and keeps footer actions aligned without global overflow',
          JSON.stringify(await ids()) === JSON.stringify(compactIdentity) && await page.evaluate(() =>
            document.documentElement.scrollWidth <= innerWidth && [...document.querySelectorAll('.delivery-row')].every(row => {
              const footer = row.querySelector('.delivery-footer').getBoundingClientRect(), actions = row.querySelector('.delivery-actions').getBoundingClientRect();
              return Math.abs(footer.right - actions.right) < 2;
            })));
        await shot('A-grid-' + width + '-' + theme);
      }
      await page.getByRole('button', { name: '紧凑视图', exact: true }).click(); await page.mouse.move(0, 0);
    }
    fs.writeFileSync(path.join(rt.output, 'responsive-cases.json'), JSON.stringify(responsive, null, 2));
    await contentWidth(450); await page.waitForTimeout(100);
    check('B10 extreme container uses real local scrolling and a truthful hint', await page.locator('.delivery-table-scroll').evaluate(node => node.scrollWidth > node.clientWidth + 1) &&
      await page.locator('.delivery-scroll-hint').isVisible() && await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.locator('.delivery-table-scroll').evaluate(node => { node.scrollLeft = node.scrollWidth; }); await shot('B-compact-extreme-scrolled');
    await contentWidth(1200);
    await page.evaluate(() => {
      const app = CRPrototype.app;
      const row = app.deliveries.find(row => row.deliveryId === 'del-demo-zero');
      app.sessions.push({ sessionId: '', projectKey: row.projectKey, kind: 'dev', title: '不可寻址会话', updatedAt: '2026-11-10T00:00:00+08:00' });
      row.sessionIds = [''];
      const multi = app.deliveries.find(row => row.deliveryId === 'del-demo-multi');
      multi.latest = { ...multi.latest, snapshotStatus: 'incomplete', runStatus: 'failed', validFindingCount: 7, withheldCount: 3 };
    });
    check('B11 normal, archived, unavailable and no-session presentations remain distinct', await page.locator('.delivery-session-link').count() > 0 &&
      await page.locator('.delivery-session-static').filter({ hasText: '已归档' }).count() > 0 &&
      await page.locator('.delivery-session-static').filter({ hasText: '不可用' }).count() > 0 && await page.locator('.delivery-session-empty').count() > 0);
    const viewBefore = await page.evaluate(() => CRPrototype.app.view);
    await page.locator('.delivery-session-static').filter({ hasText: '已归档' }).first().click();
    await page.locator('.delivery-session-static').filter({ hasText: '不可用' }).first().click();
    check('B12 static sessions stop propagation and never open a diff', await page.evaluate(view => CRPrototype.app.view === view && CRPrototype.app.mainView !== 'overview', viewBefore));
    check('B13 multiple review reasons remain accessible as full facts', await page.locator('[data-delivery-id="del-demo-multi"] .delivery-status-row').evaluate(node =>
      node.getAttribute('aria-label').includes('代码读取不完整') && node.getAttribute('aria-label').includes('审查失败') && node.getAttribute('aria-label').includes('3 条结论未通过校验')));
    await shot('B-session-states-and-full-reasons');
    const link = page.locator('.delivery-session-link').first(); await link.hover(); await page.waitForTimeout(330);
    check('B14 internal links reveal a right arrow without changing layout width', await link.locator('.delivery-link-arrow').evaluate(node => getComputedStyle(node).opacity === '1' && node.textContent === '→'));
    await shot('B-session-hover'); await page.keyboard.press('Tab'); await link.focus();
    check('B15 internal link keyboard focus is visible and reveals its arrow', await link.evaluate(node => getComputedStyle(node).outlineWidth === '2px') &&
      await link.locator('.delivery-link-arrow').evaluate(node => getComputedStyle(node).opacity === '1'));
    await shot('B-session-focus');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    check('B16 reduced motion removes link displacement and transition', await link.locator('.delivery-link-arrow').evaluate(node => getComputedStyle(node).transitionDuration === '0s'));
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    const actual = page.locator('.delivery-row').filter({ has: page.locator('.delivery-session-link') }).first();
    const targetId = await actual.getAttribute('data-delivery-id'); await actual.locator('.delivery-session-link').click();
    check('B17 session invokes the original delivery-associated conversation method', await page.evaluate(id => CRPrototype.app.view === 'conversation' && CRPrototype.app.currentDeliveryId === id, targetId));
    await page.locator('.dsh-nav-item--plugin').click(); await page.locator('.delivery-changes').first().click();
    check('B18 explanation opens overview directly without a diff detour', await page.evaluate(() => CRPrototype.app.view === 'review' && CRPrototype.app.mainView === 'overview'));

    markStep('P1 C: real settings, repository scope and dirty edit protection');
    await open({ scenario: 'list' }); await settings();
    const initialSnapshot = await page.evaluate(() => [CRPrototype.app.snapshot?.snapshotId, CRPrototype.app.snapshot?.inputSha, CRPrototype.app.run?.status]);
    await page.locator('.settings-menu input[type="checkbox"]').first().check();
    await page.locator('.settings-menu input[type="text"]').fill('feature/next-review');
    await page.locator('.settings-menu input[type="checkbox"]').last().check();
    check('C01 target branch changes the next-review setting without regenerating the frozen diff', await page.evaluate(initial => JSON.stringify([CRPrototype.app.snapshot?.snapshotId, CRPrototype.app.snapshot?.inputSha, CRPrototype.app.run?.status]) === JSON.stringify(initial), initialSnapshot));
    await page.locator('.settings-menu .osw-text-link').click();
    await page.locator('.extension-textarea').fill('# 仓库规则\n保留必要约束 😀');
    await page.getByRole('button', { name: '保存', exact: true }).click();
    const savedSettings = await page.evaluate(() => ({ auto: CRPrototype.app.autoMode, branch: CRPrototype.app.targetBranchOverride, embed: CRPrototype.app.exportEmbedDiff, prompt: CRPrototype.app.extensionPrompt }));
    check('C02 all four real settings save and return focus to the settings edit entry', savedSettings.auto && savedSettings.embed && savedSettings.branch === 'feature/next-review' && savedSettings.prompt.includes('😀') &&
      await page.locator('.settings-menu .osw-text-link').evaluate(node => document.activeElement === node));
    await shot('C-real-settings-saved');
    await chooseWorkspace('prototype');
    check('C03 same-repository workspace shares all four settings and sidebar selection', await page.evaluate(saved => {
      const app = CRPrototype.app; return app.autoMode === saved.auto && app.targetBranchOverride === saved.branch && app.exportEmbedDiff === saved.embed && app.extensionPrompt === saved.prompt &&
        document.querySelector('.dsh-project-row--workspace.is-current').textContent.trim() === 'prototype';
    }, savedSettings));
    await chooseWorkspace('demo-notes');
    check('C04 another repository has isolated settings and its real delivery', await page.evaluate(() => !CRPrototype.app.autoMode && !CRPrototype.app.targetBranchOverride && !CRPrototype.app.exportEmbedDiff && !CRPrototype.app.extensionPrompt && CRPrototype.app.visibleDeliveryRows.length === 1));
    await settings(); await page.locator('.settings-menu input[type="text"]').fill('notes/target');
    await chooseWorkspace('demo-app');
    check('C05 switching back restores the original repository settings', await page.evaluate(saved => {
      const app = CRPrototype.app; return app.autoMode === saved.auto && app.targetBranchOverride === saved.branch && app.exportEmbedDiff === saved.embed && app.extensionPrompt === saved.prompt;
    }, savedSettings));
    await page.locator('.list-workspace-switch').focus(); await page.keyboard.press('ArrowDown');
    check('C06 workspace arrow opens upward and focuses a real option', await page.locator('.list-workspace-caret').evaluate(node => node.classList.contains('is-open')) &&
      await page.locator('.workspace-item').evaluateAll(nodes => nodes.some(node => document.activeElement === node)));
    await shot('C-workspace-keyboard-menu'); await page.keyboard.press('Escape');
    check('C07 workspace Escape restores picker focus and downward arrow', await page.locator('.list-workspace-switch').evaluate(node => document.activeElement === node) &&
      await page.locator('.list-workspace-caret').evaluate(node => !node.classList.contains('is-open')));
    await settings(); await page.locator('.settings-menu .osw-text-link').click();
    await page.locator('.extension-textarea').fill('未保存 😀 草稿');
    await page.locator('.extension-textarea').dispatchEvent('compositionstart');
    await page.locator('.extension-textarea').dispatchEvent('keydown', { key: 'Escape', code: 'Escape', isComposing: true });
    check('C08 IME composition Escape cannot close or discard extension input', await page.locator('.extension-modal').count() === 1 && await page.locator('.extension-discard-dialog').count() === 0);
    await page.locator('.extension-textarea').dispatchEvent('compositionend'); await page.keyboard.press('Escape');
    check('C09 dirty Escape opens guarded discard confirmation with safe initial focus', await page.locator('.extension-discard-dialog').count() === 1 &&
      await page.getByRole('button', { name: '继续编辑', exact: true }).evaluate(node => document.activeElement === node));
    await shot('C-extension-dirty-confirm'); await page.keyboard.press('Shift+Tab');
    check('C10 confirmation traps Shift+Tab on its two actions', await page.getByRole('button', { name: '放弃修改', exact: true }).evaluate(node => document.activeElement === node));
    await page.keyboard.press('Escape');
    check('C11 confirmation Escape keeps the draft and returns to editing', await page.locator('.extension-discard-dialog').count() === 0 &&
      await page.locator('.extension-textarea').inputValue() === '未保存 😀 草稿' && await page.locator('.extension-textarea').evaluate(node => document.activeElement === node));
    await shot('C-extension-dirty-kept');
    await page.getByRole('button', { name: '取消', exact: true }).click(); await page.getByRole('button', { name: '放弃修改', exact: true }).click();
    check('C12 discard returns to original settings without losing the saved prompt', await page.locator('.extension-modal').count() === 0 &&
      await page.evaluate(saved => CRPrototype.app.extensionPrompt === saved.prompt, savedSettings) && await page.locator('.settings-menu .osw-text-link').evaluate(node => document.activeElement === node));
    await page.locator('.settings-menu .osw-text-link').click(); await page.locator('.extension-textarea').fill('遮罩关闭草稿');
    await page.locator('.req-modal-backdrop').filter({ has: page.locator('.extension-modal') }).click({ position: { x: 3, y: 3 } });
    check('C13 clicking editor backdrop also protects unsaved input', await page.locator('.extension-discard-dialog').count() === 1);
    await page.getByRole('button', { name: '继续编辑', exact: true }).click();
    await page.locator('.extension-textarea').fill('😀'.repeat(20001));
    check('C14 extension Unicode limit still disables save above 20000 code points', await page.getByRole('button', { name: '保存', exact: true }).isDisabled() && (await page.locator('.extension-count').innerText()).startsWith('20001 /'));
    const imported = path.join(rt.output, 'consolidated-extension.md'); fs.writeFileSync(imported, '# 导入规则\n😀\n');
    await page.locator('.extension-import input[type="file"]').setInputFiles(imported);
    await page.waitForFunction(() => document.querySelector('.extension-textarea')?.value.includes('导入规则'));
    check('C15 import and normalized code-point counter retain the original editor chain', await page.locator('.extension-textarea').inputValue() === '# 导入规则\n😀\n' &&
      await page.locator('.extension-count').evaluate(node => node.textContent.startsWith(String(CRPrototype.codePointLength(CRPrototype.app.extensionDialog.draft)) + ' /')));
    await shot('C-extension-import-edit'); await page.getByRole('button', { name: '保存', exact: true }).click();
    check('C16 imported prompt saves in the original repository bucket', await page.evaluate(() => CRPrototype.app.repoSettingsByKey[CRPrototype.app.settingsBucketKey()].extensionPrompt.includes('导入规则')));
    await chooseWorkspace('scratch'); await settings();
    check('C17 non-Git workspace keeps preflight and truthful temporary settings scope', await page.locator('.list-preflight-wrap').isVisible() &&
      (await page.locator('.workspace-settings-note').innerText()).includes('不是 Git 仓库'));
    await shot('C-non-git-workspace');
    await open({ scenario: 'list-empty' });
    check('C18 empty real workspace retains guide rather than fabricated deliveries', await page.locator('.delivery-row').count() === 0 && await page.locator('.delivery-empty-link').count() === 1);
    await shot('C-empty-workspace');

    markStep('P1 D: inline annotation, IME, host validation and focus');
    await open({ scenario: 'reviewed', file: 'prototype/scripts/build-data.mjs' });
    const annotationBefore = await page.evaluate(() => CRPrototype.annotations.list(CRPrototype.app.snapshot.snapshotId).length);
    const comment = page.locator('.issue-card-comment').first(); await comment.click();
    check('D01 inline editor removes repeated association chrome and disables blank save', await page.locator('.annotation-editor--inline').count() === 1 &&
      await page.locator('.annotation-editor__subtitle').count() === 0 && await page.locator('.annotation-editor__save').isDisabled());
    const input = page.locator('.annotation-editor__input'); await input.fill('😀批注');
    check('D02 annotation count uses code points and shortcut wording matches save/collapse', (await page.locator('.annotation-editor__count').innerText()).startsWith('3 / 2000') &&
      (await page.locator('.annotation-editor__hint').innerText()).includes('Enter 保存') && (await page.locator('.annotation-editor__cancel').innerText()) === '收起');
    await input.dispatchEvent('compositionstart');
    await input.dispatchEvent('keydown', { key: 'Escape', code: 'Escape', isComposing: true });
    await input.dispatchEvent('keydown', { key: 'Enter', code: 'Enter', ctrlKey: true, isComposing: true });
    check('D03 synthetic composing Escape/shortcut cannot collapse or save annotation', await page.locator('.annotation-editor').count() === 1 &&
      await page.evaluate(before => CRPrototype.annotations.list(CRPrototype.app.snapshot.snapshotId).length === before, annotationBefore));
    await input.dispatchEvent('compositionend'); await shot('D-annotation-ime-protected'); await input.press('Escape');
    check('D04 Escape collapses with draft retained and returns to the correct entry', await page.locator('.annotation-editor').count() === 0 && await comment.evaluate(node => document.activeElement === node));
    await comment.click();
    check('D05 reopening restores draft without extra persistence semantics', await page.locator('.annotation-editor__input').inputValue() === '😀批注');
    await input.fill('   ');
    check('D06 whitespace save is unavailable while host validation remains active', await page.locator('.annotation-editor__save').isDisabled());
    await page.evaluate(() => CRPrototype.app.saveAnnotation());
    check('D07 direct host save still rejects blank text', (await page.locator('.annotation-editor__error').innerText()).trim().length > 0 &&
      await page.evaluate(before => CRPrototype.annotations.list(CRPrototype.app.snapshot.snapshotId).length === before, annotationBefore));
    await input.fill('😀'.repeat(2001));
    check('D08 over-limit annotation has accurate counter and disabled save', await page.locator('.annotation-editor__save').isDisabled() && (await page.locator('.annotation-editor__count').innerText()).startsWith('2001 /'));
    await input.fill('真实保存的关联批注，保留必要约束。'); await shot('D-annotation-valid-edit'); await page.locator('.annotation-editor__save').click();
    await page.waitForFunction(() => document.activeElement?.matches('.annotation-card__action[data-action="edit"]'));
    check('D09 valid save persists the real model and focuses the new annotation action', await page.evaluate(before => CRPrototype.annotations.list(CRPrototype.app.snapshot.snapshotId).length === before + 1, annotationBefore));
    check('D10 inline association remains in data/export although duplicate title is visually omitted', await page.evaluate(() => {
      const app = CRPrototype.app, notes = CRPrototype.annotations.list(app.snapshot.snapshotId), last = notes.find(note => note.text.includes('真实保存的关联批注'));
      const link = document.querySelector(`.annotation-card[data-annotation-id="${last.annotationId}"] .annotation-card__link`);
      return Boolean(last.findingId) && getComputedStyle(link).display === 'none' && CRPrototype.exports.buildMarkdown(app.exportContext()).includes(last.text);
    }));
    await shot('D-annotation-saved-focused');

    markStep('P1 E: overview inline flow and six-section invariants');
    await page.getByRole('tab', { name: '变更说明', exact: true }).click();
    await page.evaluate(() => { const feature = CRPrototype.app.understanding.features[0]; feature.approach = '多行摘要内容，需要让文件数量自然跟随最后一句文字。'.repeat(7); });
    const flow = await page.locator('.overview-change').first().evaluate(node => {
      const desc = node.querySelector('.overview-change__desc'), count = node.querySelector('.overview-change__count');
      const range = document.createRange(); range.selectNodeContents(desc); const lines = [...range.getClientRects()], last = lines[lines.length - 1], box = count.getBoundingClientRect();
      return { display: getComputedStyle(node).display, descDisplay: getComputedStyle(desc).display, countDisplay: getComputedStyle(count).display, lineCount: lines.length,
        follows: box.top >= last.top - 2 && box.top <= last.bottom + 30, margin: getComputedStyle(count).marginLeft };
    });
    check('E01 multiline summary and file count share actual inline text flow', flow.display === 'block' && flow.descDisplay === 'inline' && flow.countDisplay === 'inline' && flow.lineCount > 1 && flow.follows && flow.margin === '4px');
    check('E02 overview keeps six ordered sections, direct details summary and reading tokens', await page.evaluate(() => {
      const root = document.querySelector('.overview-main'), inner = document.querySelector('.overview-inner'), hero = document.querySelector('.overview-hero');
      return [...document.querySelectorAll('.overview-inner > .overview-section')].map(node => node.id).join(',') === 'overview-conclusion,overview-features,overview-alignment,overview-problems,overview-coverage,overview-requirements' &&
        Boolean(document.querySelector('details.overview-requirements > summary')) && getComputedStyle(root).padding === '12px 12px 32px' && getComputedStyle(inner).maxWidth === '1080px' &&
        getComputedStyle(inner).marginLeft === '0px' && getComputedStyle(hero).padding === '16px';
    }));
    await shot('E-overview-multiline-hero');
    for (const section of ['features','alignment','problems','coverage','requirements']) {
      if (section === 'requirements') await page.locator('.overview-requirements > summary').click();
      await page.locator('#overview-' + section).scrollIntoViewIfNeeded(); await shot('E-overview-' + section);
    }
    await open({ scenario: 'list' }); await page.evaluate(() => { CRPrototype.app.deliveries.find(row => row.deliveryId === CRPrototype.app.currentDeliveryId).externalRef = 'REQ-CONSOLIDATED-42'; });
    await page.locator('input[aria-label="搜索交付"]').fill('REQ-CONSOLIDATED-42');
    check('A12 requirement-number search remains real and branch absence is never replaced with targetRef', await page.locator('.delivery-row').count() === 1);
    await page.evaluate(() => { CRPrototype.app.visibleDeliveryRows[0].branch = ''; });
    check('A13 missing branch is stated accurately', (await page.locator('.delivery-branch').innerText()) === '分支信息不可用');
  },
};
