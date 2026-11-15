/* verify module: appearance */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
module.exports = {
  id: 'appearance',
  order: 5,
  scenarios: ['reviewed', 'list'],
  async run(rt) {
    const { page, context, browser, url, output, data, scoped, selectedScenarios, SCENARIOS, ONLY } = rt;
    const { open, state, shot, check, markStep, ensureOverview, filterByMode, brandButtons, blueUiColors, contrastSamples, assertReadable, auditIconButtons, currentData, parseEmbeddedData } = rt;
    let s;
    markStep('prototype console');
    // ---------- prototype console ----------
    if (scoped('reviewed')) {
    await open({ scenario: 'reviewed', console: '1' });
    check('console is available but has no name switcher', await page.locator('.prototype-console').count() === 1 &&
      await page.locator('select[aria-label="入口名称"]').count() === 0);
    const scenarioOptions = await page.locator('select[aria-label="场景"] option').count();
    check('console lists every scenario', scenarioOptions === SCENARIOS.length);
    await page.locator('select[aria-label="场景"]').selectOption('zero');
    await page.waitForTimeout(200);
    check('console switches scenario in place', (await state()).scenario === 'zero' &&
      (await state()).runState === '' && (await page.locator('.panel-status b').innerText()) === '未发现问题');
    check('console exposes an acceptance theme control', await page.locator('select[aria-label="主题"]').count() === 1 &&
      await page.locator('select[aria-label="主题"] option').count() === 3);
    await page.locator('select[aria-label="主题"]').selectOption('dark');
    await page.waitForTimeout(150);
    check('console theme control forces dark tokens', await page.evaluate(() =>
      CRPrototype.app.effectiveTheme === 'dark' && document.documentElement.dataset.theme === 'dark'));
    await page.locator('select[aria-label="主题"]').selectOption('auto');
    await page.waitForTimeout(150);
    check('console theme control returns to system following', await page.evaluate(() =>
      CRPrototype.app.themeMode === 'auto' && !document.documentElement.dataset.theme));
    await page.locator('.console-toggle').click();
    await page.waitForTimeout(150);
    const themeSwitch = await page.evaluate(() => {
      const group = document.querySelector('.console-theme-switch');
      const toggle = document.querySelector('.console-toggle');
      const groupRect = group?.getBoundingClientRect();
      const toggleRect = toggle?.getBoundingClientRect();
      const style = group ? getComputedStyle(group) : null;
      return {
        visible: Boolean(group && style.display !== 'none' && style.visibility !== 'hidden' &&
          Number(style.opacity) > 0 && groupRect.width > 0),
        labels: [...document.querySelectorAll('.console-theme-switch button')].map(button => button.innerText.trim()),
        inTitlebar: group?.parentElement?.classList.contains('console-titlebar') || false,
        rightOfToggle: Boolean(groupRect && toggleRect && groupRect.left >= toggleRect.right - 1),
      };
    });
    check('the collapsed console title bar offers a two-segment light/dark switch', themeSwitch.visible &&
      themeSwitch.labels.join('/') === '浅色/深色' && themeSwitch.inTitlebar && themeSwitch.rightOfToggle);
    await shot('22b-console-collapsed');
    const themeTip = async label => {
      await page.locator('.console-theme-option').filter({ hasText: label }).hover();
      await page.waitForTimeout(420);
      const text = await page.evaluate(() => document.querySelector('[role="tooltip"]')?.innerText.trim() || '');
      await page.mouse.move(0, 0);
      await page.waitForTimeout(100);
      return text;
    };
    const darkTip = await themeTip('深色');
    const lightTip = await themeTip('浅色');
    check('theme switch tooltips name the action', darkTip === '切换为深色' && lightTip === '切换为浅色');
    await page.locator('.console-theme-option').filter({ hasText: '深色' }).click();
    await page.waitForTimeout(200);
    const segmentDark = await page.evaluate(() => ({
      themeMode: CRPrototype.app.themeMode,
      dataTheme: document.documentElement.dataset.theme,
      hljsDark: document.getElementById('hljs-dark')?.media,
      hljsLight: document.getElementById('hljs-light')?.media,
      stored: (() => { try { return localStorage.getItem('evidentloop-demo-theme'); } catch { return null; } })(),
    }));
    check('the segment switch changes the page and code highlight theme and persists it', segmentDark.themeMode === 'dark' &&
      segmentDark.dataTheme === 'dark' && segmentDark.hljsDark === 'all' && segmentDark.hljsLight === 'not all' &&
      segmentDark.stored === 'dark');
    await shot('22c-console-collapsed-dark');
    await page.locator('.console-theme-option').filter({ hasText: '浅色' }).click();
    await page.waitForTimeout(180);
    check('the light segment switches back and persists the light choice', await page.evaluate(() => ({
      themeMode: CRPrototype.app.themeMode,
      dataTheme: document.documentElement.dataset.theme,
      stored: (() => { try { return localStorage.getItem('evidentloop-demo-theme'); } catch { return null; } })(),
    })).then(state => state.themeMode === 'light' && state.dataTheme === 'light' && state.stored === 'light'));
    await page.locator('.console-theme-option').filter({ hasText: '深色' }).click();
    await page.waitForTimeout(180);
    await page.reload();
    await page.waitForFunction(() => window.CRPrototype?.app && document.documentElement.dataset.ready === 'true', null, { timeout: 10000 });
    await page.waitForTimeout(220);
    check('theme choice survives a refresh', await page.evaluate(() =>
      CRPrototype.app.themeMode === 'dark' && document.documentElement.dataset.theme === 'dark' &&
      document.getElementById('hljs-dark')?.media === 'all'));
    await page.locator('select[aria-label="场景"]').selectOption('zero');
    await page.waitForTimeout(200);
    check('theme choice survives a scenario change', await page.evaluate(() =>
      CRPrototype.app.scenario === 'zero' && CRPrototype.app.themeMode === 'dark' &&
      document.documentElement.dataset.theme === 'dark'));
    await page.locator('.dsh-nav-item--plugin').click();
    await page.waitForTimeout(180);
    check('theme choice survives a view change', await page.evaluate(() =>
      CRPrototype.app.view === 'list' && CRPrototype.app.themeMode === 'dark' &&
      document.documentElement.dataset.theme === 'dark'));
    await open({ scenario: 'reviewed', theme: 'light', console: '1' });
    check('a URL theme parameter wins over the stored choice', await page.evaluate(() =>
      CRPrototype.app.themeMode === 'light' && document.documentElement.dataset.theme === 'light' &&
      document.getElementById('hljs-dark')?.media === 'not all'));
    await page.reload();
    await page.waitForFunction(() => window.CRPrototype?.app && document.documentElement.dataset.ready === 'true', null, { timeout: 10000 });
    await page.waitForTimeout(220);
    check('the URL theme parameter keeps winning after a refresh', await page.evaluate(() =>
      CRPrototype.app.themeMode === 'light' && document.documentElement.dataset.theme === 'light'));
    await page.locator('select[aria-label="主题"]').selectOption('auto');
    await page.waitForTimeout(150);
    const noStorageContext = await browser.newContext({ viewport: { width: 1176, height: 834 }, deviceScaleFactor: 2 });
    await noStorageContext.addInitScript(() => {
      Object.defineProperty(window, 'localStorage', { get() { throw new Error('storage blocked'); } });
    });
    const noStoragePage = await noStorageContext.newPage();
    const noStorageErrors = [];
    noStoragePage.on('pageerror', error => noStorageErrors.push(error.message));
    await noStoragePage.goto(url + '?' + new URLSearchParams({ scenario: 'reviewed', console: '' }).toString());
    await noStoragePage.waitForFunction(() => window.CRPrototype?.app && document.documentElement.dataset.ready === 'true', null, { timeout: 10000 });
    await noStoragePage.waitForTimeout(220);
    const noStorageBefore = await noStoragePage.evaluate(() => ({
      themeMode: CRPrototype.app.themeMode,
      dataTheme: document.documentElement.dataset.theme || '',
      appVisible: Boolean(document.querySelector('.dsh-app')),
      consoleVisible: Boolean(document.querySelector('.prototype-console')),
      switchVisible: Boolean(document.querySelector('.console-theme-switch')),
    }));
    await noStoragePage.locator('.console-theme-option').filter({ hasText: '深色' }).click();
    await noStoragePage.waitForTimeout(200);
    const noStorageAfter = await noStoragePage.evaluate(() => ({
      themeMode: CRPrototype.app.themeMode,
      dataTheme: document.documentElement.dataset.theme || '',
      message: CRPrototype.ui?.message || '',
    }));
    check('the page still works when local storage is unavailable', noStorageBefore.themeMode === 'auto' &&
      noStorageBefore.dataTheme === '' && noStorageBefore.appVisible && noStorageBefore.consoleVisible &&
      noStorageBefore.switchVisible && noStorageErrors.length === 0);
    check('a theme write failure falls back to following the system', noStorageAfter.themeMode === 'auto' &&
      noStorageAfter.dataTheme === '' && noStorageAfter.message.includes('跟随系统') && noStorageErrors.length === 0);
    await noStoragePage.locator('.console-toggle').click();
    await noStoragePage.waitForTimeout(150);
    await noStoragePage.locator('select[aria-label="主题"]').selectOption('dark');
    await noStoragePage.waitForTimeout(180);
    const noStorageSelect = await noStoragePage.evaluate(() => ({
      themeMode: CRPrototype.app.themeMode,
      selectValue: document.querySelector('select[aria-label="主题"]')?.value || '',
      message: CRPrototype.ui?.message || '',
    }));
    check('a rejected theme write resets the expanded theme control', noStorageSelect.themeMode === 'auto' &&
      noStorageSelect.selectValue === 'auto' && noStorageSelect.message.includes('跟随系统') &&
      noStorageErrors.length === 0);
    await noStorageContext.close();
    const nullStorageContext = await browser.newContext({ viewport: { width: 1176, height: 834 }, deviceScaleFactor: 2 });
    await nullStorageContext.addInitScript(() => {
      Object.defineProperty(window, 'localStorage', { value: undefined });
    });
    const nullStoragePage = await nullStorageContext.newPage();
    await nullStoragePage.goto(url + '?' + new URLSearchParams({ scenario: 'reviewed', console: '' }).toString());
    await nullStoragePage.waitForFunction(() => window.CRPrototype?.app && document.documentElement.dataset.ready === 'true', null, { timeout: 10000 });
    await nullStoragePage.waitForTimeout(200);
    await nullStoragePage.locator('.console-theme-option').filter({ hasText: '深色' }).click();
    await nullStoragePage.waitForTimeout(180);
    const nullStorage = await nullStoragePage.evaluate(() => ({
      themeMode: CRPrototype.app.themeMode,
      dataTheme: document.documentElement.dataset.theme || '',
      message: CRPrototype.ui?.message || '',
    }));
    check('a missing storage API also follows the system theme', nullStorage.themeMode === 'auto' &&
      nullStorage.dataTheme === '' && nullStorage.message.includes('跟随系统'));
    await nullStorageContext.close();
    const partialStorageContext = await browser.newContext({ viewport: { width: 1176, height: 834 }, deviceScaleFactor: 2 });
    const partialStoragePage = await partialStorageContext.newPage();
    await partialStoragePage.goto(url + '?' + new URLSearchParams({ scenario: 'reviewed', console: '1' }).toString());
    await partialStoragePage.waitForFunction(() => window.CRPrototype?.app && document.documentElement.dataset.ready === 'true', null, { timeout: 10000 });
    await partialStoragePage.evaluate(() => localStorage.setItem('evidentloop-demo-theme', 'dark'));
    await partialStoragePage.addInitScript(() => {
      Storage.prototype.setItem = function () { throw new Error('quota'); };
    });
    await partialStoragePage.reload();
    await partialStoragePage.waitForFunction(() => window.CRPrototype?.app && document.documentElement.dataset.ready === 'true', null, { timeout: 10000 });
    await partialStoragePage.waitForTimeout(220);
    const partialInitial = await partialStoragePage.evaluate(() => CRPrototype.app.themeMode);
    await partialStoragePage.locator('select[aria-label="主题"]').selectOption('auto');
    await partialStoragePage.waitForTimeout(200);
    const partialAfter = await partialStoragePage.evaluate(() => ({
      themeMode: CRPrototype.app.themeMode,
      stored: (() => { try { return localStorage.getItem('evidentloop-demo-theme'); } catch { return 'unavailable'; } })(),
    }));
    await partialStoragePage.reload();
    await partialStoragePage.waitForFunction(() => window.CRPrototype?.app && document.documentElement.dataset.ready === 'true', null, { timeout: 10000 });
    await partialStoragePage.waitForTimeout(220);
    const partialReload = await partialStoragePage.evaluate(() => CRPrototype.app.themeMode);
    check('a failed auto write clears the old stored theme and follows the system after reload', partialInitial === 'dark' &&
      partialAfter.themeMode === 'auto' && partialAfter.stored === null && partialReload === 'auto');
    await partialStoragePage.locator('select[aria-label="主题"]').selectOption('dark');
    await partialStoragePage.waitForTimeout(200);
    const partialDark = await partialStoragePage.evaluate(() => ({
      themeMode: CRPrototype.app.themeMode,
      stored: (() => { try { return localStorage.getItem('evidentloop-demo-theme'); } catch { return 'unavailable'; } })(),
    }));
    check('a failed non-auto theme write clears storage and stays on the system theme', partialDark.themeMode === 'auto' &&
      partialDark.stored === null);
    await partialStorageContext.close();
    await shot('22-console');

    }
    markStep('URL parameters');
    // ---------- URL parameters ----------
    if (scoped('reviewed')) {
    await open({ scenario: 'reviewed', panel: 'overview', menu: 'export', filter: 'risk', style: 'double' });
    s = await state();
    check('URL params: main view, menu and filter', s.mainView === 'overview' && s.panelMode === null &&
      await page.locator('.overview-main').count() === 1 &&
      await page.locator('.export-menu').count() === 1 &&
      await page.locator('input[name="file-filter"][value="risk"]').isChecked());
    await page.locator('.focus-tree-row').filter({ hasText: 'build-data.mjs' }).first().click();
    await page.waitForTimeout(150);
    check('URL diff style applies after switching to diff', await page.locator('.code-review-lite--side-by-side').count() === 1);
    await shot('23-url-params');

    }
    markStep('adding a requirement source');
    // ---------- adding a requirement source ----------
    if (scoped('reviewed')) {
    await open({ scenario: 'reviewed' });
    await ensureOverview();
    await page.locator('.overview-requirements > summary').click();
    await page.waitForTimeout(100);
    await page.getByRole('button', { name: /添加需求依据/ }).click();
    await page.waitForTimeout(100);
    check('requirement dialog has paste and file tabs', await page.locator('.req-modal').count() === 1 &&
      await page.locator('.req-modal__tabs button').count() === 2);
    await auditIconButtons('the requirement dialog', '.req-modal');
    await shot('24-requirement-dialog');
    await page.locator('.req-modal__tabs button').filter({ hasText: '选择文件' }).click();
    const requirementFile = path.join(output, 'requirement-source.txt');
    fs.writeFileSync(requirementFile, '需求：所有结论必须能指回审查记录中的文件、行与内容。\n');
    await page.locator('.req-file-pick input[type="file"]').setInputFiles(requirementFile);
    await page.waitForFunction(() => document.querySelector('.req-modal textarea')?.value.includes('所有结论'), null, { timeout: 5000 });
    check('requirement file source fills the editor', (await page.locator('.req-modal textarea').inputValue()).includes('所有结论') &&
      (await page.locator('.req-modal').innerText()).includes('requirement-source.txt'));
    await page.getByRole('button', { name: '取消', exact: true }).click();
    await page.waitForTimeout(100);
    check('requirement dialog cancels without changes', await page.locator('.req-modal').count() === 0 &&
      (await state()).requirements === data.requirements.length);
    await page.getByRole('button', { name: /添加需求依据/ }).click();
    await page.waitForTimeout(100);
    await page.locator('.req-modal textarea').fill('需求：证据不成立的结论不得显示为问题，应进入审查不完整。');
    await page.getByRole('button', { name: '添加并生成新的审查记录' }).click();
    await page.waitForTimeout(250);
    s = await state();
    check('adding a requirement creates a new pending snapshot', s.requirements === data.requirements.length + 1 &&
      s.pending === data.reviewable && s.runStatus === null && s.mainView === 'overview' && s.panelMode === null);
    check('adding a requirement shows the Review All notice', await page.locator('.panel-notice').innerText() === '需求依据已更新，Review All 后更新对齐判断');
    await shot('25-requirement-added-interactive');
    await page.locator('.run-primary').click();
    await page.waitForFunction(() => window.CRPrototype.app.run?.status === 'succeeded', null, { timeout: 30000 });
    await page.waitForTimeout(150);
    const afterRequirementReview = await page.evaluate(() => {
      const app = CRPrototype.app;
      return {
        alignmentCount: app.understanding?.alignment?.length || 0,
        itemCount: app.requirementItems.length,
        hasAddedAlignment: (app.understanding?.alignment || []).some(item => item.note.includes('新增需求依据')),
        notice: app.staleNotice,
        latestStatus: app.currentDelivery?.latest?.status,
        complete: app.reviewCompleteNow,
      };
    });
    check('Review All after adding a requirement aligns every item and refreshes the delivery', afterRequirementReview.alignmentCount === afterRequirementReview.itemCount &&
      afterRequirementReview.hasAddedAlignment && afterRequirementReview.notice === '' &&
      afterRequirementReview.latestStatus === 'issues' && afterRequirementReview.complete === true);
    const requirementExport = await page.evaluate(() => {
      const context = CRPrototype.app.exportContext();
      return CRPrototype.exports.buildMarkdown(context);
    });
    check('requirement add keeps the previous snapshot baseline in exports',
      requirementExport.includes('需求依据已更新') &&
      !requirementExport.includes('这是该交付的第一份审查记录。'));
    await page.locator('.wb-back').click();
    await page.waitForTimeout(150);
    check('added requirement updates the delivery status after review', (await page.locator(`.delivery-row[data-delivery-id="${data.deliveries[0].id}"] .delivery-status`).first().innerText()) === '发现 7 个问题');
    await page.locator(`.delivery-row[data-delivery-id="${data.deliveries[0].id}"] .delivery-main`).click();
    await page.waitForTimeout(200);
    const reentered = await state();
    check('added requirement persists on re-entry', reentered.requirements === data.requirements.length + 1 &&
      reentered.pending === 0 && reentered.runStatus === 'succeeded' &&
      await page.evaluate(() => CRPrototype.app.currentDelivery.latestSnapshotId === CRPrototype.app.snapshot.snapshotId));

    }
    markStep('dark mode');
    // ---------- dark mode ----------
    if (scoped('list')) {
    await page.emulateMedia({ colorScheme: 'dark' });
    const whiteSurfaces = () => page.evaluate(() => {
      const selectors = ['.dsh-app', '.dsh-sidebar', '.dsh-list-view', '.delivery-row', '.dsh-main',
        '.review-surface', '.overview-main', '.diff-container', '.code-review-lite', '.review-panel', '.splitpanes__pane'];
      return selectors
        .map(selector => ({ selector, color: getComputedStyle(document.querySelector(selector) || document.body).backgroundColor }))
        .filter(entry => entry.color === 'rgb(255, 255, 255)');
    });
    await open({ scenario: 'list' });
    check('dark list has no white background blocks', (await whiteSurfaces()).length === 0 &&
      await page.evaluate(() => getComputedStyle(document.body).backgroundColor) !== 'rgb(255, 255, 255)');
    check('dark list keeps the brand budget', (await brandButtons()).length === 0);
    await shot('31-dark-list');
    await page.emulateMedia({ colorScheme: 'light' });

    }
    if (scoped('reviewed')) {
    await page.emulateMedia({ colorScheme: 'dark' });
    await open({ scenario: 'reviewed' });
    await page.locator('.focus-tree-row').filter({ hasText: 'build-data.mjs' }).first().click();
    await page.waitForTimeout(200);
    const darkReview = await page.evaluate(() => ({
      white: ['.review-surface', '.diff-container', '.code-review-lite', '.review-panel']
        .map(selector => getComputedStyle(document.querySelector(selector) || document.body).backgroundColor)
        .filter(color => color === 'rgb(255, 255, 255)'),
      insert: getComputedStyle(document.querySelector('.d2h-ins') || document.body).backgroundColor,
      del: getComputedStyle(document.querySelector('.d2h-del') || document.body).backgroundColor,
      text: getComputedStyle(document.body).color,
      purple: [...document.querySelectorAll('button,[role="button"]')].filter(element => {
        const color = getComputedStyle(element).backgroundColor;
        return color === 'rgb(122, 170, 255)';
      }).length,
    }));
    await ensureOverview();
    const darkOverview = await page.evaluate(() => ({
      background: getComputedStyle(document.querySelector('.overview-main') || document.body).backgroundColor,
      view: CRPrototype.app.mainView,
    }));
    check('dark overview has no white background', darkOverview.view === 'overview' && darkOverview.background !== 'rgb(255, 255, 255)');
    await page.locator('#overview-problems').scrollIntoViewIfNeeded();
    await page.waitForTimeout(150);
    await shot('32c-dark-overview-problems');
    await page.locator('.focus-tree-row').filter({ hasText: 'build-data.mjs' }).first().click();
    await page.waitForTimeout(150);
    check('dark review has no white surfaces and keeps diff hues', darkReview.white.length === 0 &&
      darkReview.insert !== 'rgb(255, 255, 255)' && darkReview.del !== 'rgb(255, 255, 255)' &&
      darkReview.text !== 'rgb(15, 17, 21)' && darkReview.purple <= 1);
    const darkContrast = await contrastSamples();
    check('dark diff uses the official dark scheme and dark highlight theme', darkContrast.darkClass === true &&
      darkContrast.darkTheme === 'all' && darkContrast.lightTheme === 'not all');
    const darkHunk = await page.evaluate(() => {
      const element = document.querySelector('.d2h-info');
      if (!element) return null;
      const style = getComputedStyle(element);
      return { background: style.backgroundColor, border: style.borderTopColor };
    });
    check('dark hunk header stays neutral', darkHunk && !/56,\s*139,\s*253/.test(darkHunk.background) &&
      !/56,\s*139,\s*253/.test(darkHunk.border));
    assertReadable('dark mode diff', darkContrast);
    await shot('32-dark-diff');
    await page.waitForTimeout(320);
    await page.evaluate(() => {
      const card = document.querySelector('.gpt-risk-marker__code-panel')?.closest('.gpt-risk-marker') ||
        document.querySelector('.gpt-risk-marker:not(.gpt-risk-marker--suppressed)');
      const body = card?.closest('.code-review-lite__body');
      if (!card || !body) return;
      body.scrollTop += card.getBoundingClientRect().top - body.getBoundingClientRect().top - 8;
    });
    await page.waitForTimeout(120);
    const darkCardColors = await page.evaluate(() => {
      const probe = document.createElement('span');
      document.body.append(probe);
      const token = name => { probe.style.color = `var(${name})`; return getComputedStyle(probe).color; };
      const tokens = { bgL2: token('--el-bg-l2'), borderL2: token('--el-border-l2'), error: token('--el-state-error'), warn: token('--el-state-warn'), bgL3: token('--el-bg-l3') };
      probe.remove();
      return {
        tokens,
        cards: [...document.querySelectorAll('.gpt-risk-marker:not(.gpt-risk-marker--suppressed)')].map(card => {
          const style = getComputedStyle(card);
          const panel = card.querySelector('.gpt-risk-marker__code-panel');
          return {
            background: style.backgroundColor, border: style.borderTopColor, leftWidth: style.borderLeftWidth,
            left: style.borderLeftColor, header: getComputedStyle(card.querySelector('.gpt-risk-marker__header')).backgroundColor,
            code: panel ? getComputedStyle(panel).backgroundColor : tokens.bgL3,
            p2: card.classList.contains('gpt-risk-marker--p2'),
          };
        }),
      };
    });
    check('dark cards keep neutral surfaces and severity rails', darkCardColors.cards.length > 0 &&
      darkCardColors.cards.every(card => card.background === darkCardColors.tokens.bgL2 &&
        card.border === darkCardColors.tokens.borderL2 && card.header === darkCardColors.tokens.bgL2 &&
        card.code === darkCardColors.tokens.bgL3 && card.leftWidth === '3px' &&
        card.left === (card.p2 ? darkCardColors.tokens.warn : darkCardColors.tokens.error)));
    await shot('32b-dark-card');
    await page.locator('.review-toggle-btn').filter({ hasText: '查看说明' }).first().click();
    await page.waitForTimeout(200);
    const darkPanel = await contrastSamples();
    check('dark file panel keeps issue rows and diff cards readable', Boolean(darkPanel.card) && Boolean(darkPanel.inline));
    assertReadable('dark mode panel', darkPanel);
    await shot('33-dark-file-panel');
    await page.emulateMedia({ colorScheme: 'light' });

    }
    markStep('file tree icon colors');
    // ---------- file tree icons ----------
    if (scoped('reviewed')) {
    const treeIconSamples = () => page.evaluate(() => {
      const row = suffix => [...document.querySelectorAll('.focus-tree-row')].find(entry => (entry.dataset.path || '').endsWith(suffix));
      const fills = element => element ? [...element.querySelectorAll('.focus-tree-kind-icon svg path')].map(path => getComputedStyle(path).fill) : [];
      const parse = value => {
        const match = String(value).match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
        return match ? [+match[1], +match[2], +match[3], match[4] === undefined ? 1 : +match[4]] : null;
      };
      const luminance = color => color.slice(0, 3).map(value => {
        const channel = value / 255;
        return channel <= 0.03928 ? channel / 12.92 : Math.pow((channel + 0.055) / 1.055, 2.4);
      }).reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
      const folder = [...document.querySelectorAll('.focus-tree-row.is-folder')].find(entry => (entry.dataset.path || '').endsWith('/src'));
      const name = folder?.querySelector('.focus-tree-name');
      let backgroundNode = folder, background = null;
      while (backgroundNode) {
        const color = parse(getComputedStyle(backgroundNode).backgroundColor);
        if (color && color[3] > 0.5) { background = color; break; }
        backgroundNode = backgroundNode.parentElement;
      }
      const foreground = name ? parse(getComputedStyle(name).color) : null;
      const ratio = foreground && background
        ? (Math.max(luminance(foreground), luminance(background)) + 0.05) / (Math.min(luminance(foreground), luminance(background)) + 0.05)
        : 0;
      return {
        js: fills(row('/app.js')), css: fills(row('/focus-review.css')),
        json: fills(row('/material-icons-manifest.json')), md: fills(row('/README.md')),
        src: fills(folder),
        folderColor: name ? getComputedStyle(name).color : '',
        folderRatio: ratio,
        selected: row('/app.js')?.classList.contains('is-selected') || false,
      };
    });
    // Expected fills come from the frozen upstream review-workbench baseline (read-only).
    const expectedIcons = {
      js: ['rgb(255, 202, 40)'],
      css: ['rgb(126, 87, 194)', 'rgb(126, 87, 194)'],
      json: ['rgb(249, 168, 37)'],
      md: ['rgb(66, 165, 245)'],
      src: ['rgb(56, 142, 60)', 'rgb(200, 230, 201)'],
    };
    const sameIconColors = sample => Object.keys(expectedIcons).every(key => JSON.stringify(sample[key]) === JSON.stringify(expectedIcons[key]));
    await open({ scenario: 'reviewed', theme: 'light' });
    const lightIcons = await treeIconSamples();
    check('file tree icons keep the baseline Material colors in light mode', sameIconColors(lightIcons));
    check('folder names use the primary text color with 4.5:1 contrast in light mode', lightIcons.folderColor === 'rgb(15, 17, 21)' &&
      lightIcons.folderRatio >= 4.5);
    await shot('34b-tree-icons-light');
    await page.locator('.focus-tree-row').filter({ hasText: 'app.js' }).first().click();
    await page.waitForTimeout(200);
    const selectedIcons = await treeIconSamples();
    check('file tree icon colors do not change on selection', selectedIcons.selected &&
      Object.keys(expectedIcons).every(key => JSON.stringify(selectedIcons[key]) === JSON.stringify(lightIcons[key])));
    await shot('34d-tree-icons-selected-light');
    await page.getByRole('tab', { name: '变更说明' }).click();
    await page.waitForTimeout(180);
    const weakSelected = await page.evaluate(() => {
      const row = [...document.querySelectorAll('.focus-tree-row')].find(entry => (entry.dataset.path || '').endsWith('/app.js'));
      return row?.classList.contains('is-selected') && row?.classList.contains('is-weak-selected') || false;
    });
    const weakIcons = await treeIconSamples();
    check('file tree icon colors do not change in the weak overview selection', weakSelected &&
      Object.keys(expectedIcons).every(key => JSON.stringify(weakIcons[key]) === JSON.stringify(lightIcons[key])));
    await shot('34e-tree-icons-weak-selected-light');
    await open({ scenario: 'reviewed', theme: 'dark' });
    const darkIcons = await treeIconSamples();
    check('file tree icons keep the same baseline colors in dark mode', sameIconColors(darkIcons) &&
      Object.keys(expectedIcons).every(key => JSON.stringify(darkIcons[key]) === JSON.stringify(lightIcons[key])));
    check('folder names use the primary text color with 4.5:1 contrast in dark mode', darkIcons.folderColor === 'rgb(241, 243, 245)' &&
      darkIcons.folderRatio >= 4.5);
    await shot('34c-tree-icons-dark');

    }

  },
};
