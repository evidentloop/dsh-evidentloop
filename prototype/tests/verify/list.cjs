/* verify module: list */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
module.exports = {
  id: 'list',
  order: 0,
  scenarios: ['list', 'list-empty', 'list-history'],
  async run(rt) {
    const { page, context, output, data, scoped, selectedScenarios, SCENARIOS, ONLY } = rt;
    const { open, state, shot, check, markStep, ensureOverview, filterByMode, brandButtons, blueUiColors, contrastSamples, assertReadable, auditIconButtons, currentData, parseEmbeddedData } = rt;
    let s;
    markStep('delivery list');
    // ---------- delivery list ----------
    if (scoped('list')) {
    await open({ scenario: 'list' });
    s = await state();
    const mainRepoDeliveries = data.deliveries.filter(delivery => delivery.projectKey === data.projectKey);
    const activeWorkspace = data.workspaces.find(workspace => workspace.id === data.currentWorkspaceId) || data.workspaces[0];
    const activeMainCount = await page.evaluate(() => CRPrototype.app.deliveryRows.length);
    check('default view is the delivery list', s.view === 'list' && await page.locator('.dsh-list-view').count() === 1 &&
      await page.locator('.delivery-row').count() === activeMainCount);
    check('list header has a workspace switcher, search and settings and no project dropdown',
      await page.locator('.list-workspace-switch').count() === 1 &&
      await page.locator('select[aria-label="项目"]').count() === 0 &&
      await page.locator('.list-project-select').count() === 0 &&
      await page.locator('input[aria-label="搜索交付"]').count() === 1 &&
      await page.locator('button[aria-label="工作区设置"]').count() === 1);
    const switcherChrome = await page.evaluate(() => {
      const button = document.querySelector('.list-workspace-switch');
      const caret = button.querySelector('.list-workspace-caret');
      return {
        label: button.getAttribute('aria-label') || '',
        title: button.getAttribute('title') || '',
        caretColor: getComputedStyle(caret).color,
        textColor: getComputedStyle(button).color,
        caretSize: getComputedStyle(caret).fontSize,
      };
    });
    check('the workspace switcher keeps an accessible name, no hover tooltip and a matching caret',
      switcherChrome.label === '切换工作区' && switcherChrome.title === '' &&
      switcherChrome.caretColor === switcherChrome.textColor && switcherChrome.caretSize === '12px');
    const switcherAlign = await page.evaluate(() => {
      const heading = document.querySelector('.list-heading h1').getBoundingClientRect();
      const button = document.querySelector('.list-workspace-switch');
      const range = document.createRange();
      range.selectNodeContents(button);
      return { titleLeft: heading.left, textLeft: range.getBoundingClientRect().left, centerDelta: Math.abs(heading.top + heading.height / 2 - (button.getBoundingClientRect().top + button.getBoundingClientRect().height / 2)) };
    });
    check('the workspace switcher shares the title row and follows the title',
      switcherAlign.textLeft > switcherAlign.titleLeft && switcherAlign.centerDelta <= 3);
    const headerText = (await page.locator('.list-header').innerText()).replace(/\s+/g, ' ');
    check('the workspace name appears once and active counts live only in scope controls',
      headerText.split(activeWorkspace.name).length - 1 === 1 &&
      !headerText.includes('个进行中') && !headerText.includes('交付列表') &&
      (await page.locator('.delivery-scope-all').innerText()).includes(String(activeMainCount)));
    check('list rows show title, branch, time and status without requirement chips', await page.locator('.delivery-title').count() === activeMainCount &&
      await page.locator('.delivery-ref').count() === 0 && await page.locator('.delivery-meta').count() === activeMainCount);
    const listGrid = await page.evaluate(() => {
      const list = document.querySelector('.delivery-grid');
      const cards = [...document.querySelectorAll('.delivery-row')].map(card => card.getBoundingClientRect().height);
      return {
        display: getComputedStyle(list).display,
        tracks: getComputedStyle(list).gridTemplateColumns.split(' ').map(parseFloat),
        heights: cards,
      };
    });
    check('delivery list is an adaptive card grid with equal-height rows', listGrid.display === 'grid' &&
      listGrid.tracks.length >= 2 && new Set(listGrid.heights.slice(0, 2)).size === 1);
    check('delivery grid tracks are fluid with a 320px minimum', listGrid.tracks.every(width => width >= 319.5));
    for (const width of [1440, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      await page.waitForTimeout(100);
      const gridProbe = await page.evaluate(() => {
        const list = document.querySelector('.delivery-grid');
        const cards = [...document.querySelectorAll('.delivery-row')];
        const listRect = list.getBoundingClientRect();
        const rightmost = Math.max(...cards.map(card => card.getBoundingClientRect().right));
        const column = cards[0]?.getBoundingClientRect().width || 0;
        return { blank: listRect.right - rightmost, column, cards: cards.length,
          overflow: rightmost > listRect.right + 0.5, maxWidth: getComputedStyle(document.querySelector('.delivery-list')).maxWidth,
          listWidth: document.querySelector('.delivery-list').getBoundingClientRect().width,
          parentWidth: document.querySelector('.delivery-list').parentElement.getBoundingClientRect().width,
          centerDelta: Math.abs(document.querySelector('.delivery-list').getBoundingClientRect().left - document.querySelector('.delivery-list').parentElement.getBoundingClientRect().left - (document.querySelector('.delivery-list').parentElement.getBoundingClientRect().right - document.querySelector('.delivery-list').getBoundingClientRect().right)) };
      });
      check('list grid fills the workspace without an empty-column gap at ' + width, gridProbe.cards >= 2 &&
        gridProbe.column >= 320 && gridProbe.blank >= 0 && gridProbe.blank < gridProbe.column &&
        gridProbe.overflow === false && gridProbe.maxWidth === 'none' && Math.abs(gridProbe.listWidth - gridProbe.parentWidth) <= 1 && gridProbe.centerDelta <= 1);
    }
    await page.setViewportSize({ width: 1176, height: 834 });
    await page.waitForTimeout(100);
    const cardHeadMetrics = await page.evaluate(() => {
      const more = document.querySelector('.delivery-more');
      const tag = document.querySelector('.delivery-closed');
      const title = document.querySelector('.delivery-title');
      const titleStyle = getComputedStyle(title.querySelector('[data-truncate]'));
      return {
        moreWidth: more?.getBoundingClientRect().width || 0,
        tagShrink: tag ? getComputedStyle(tag).flexShrink : '1',
        textOverflow: titleStyle.textOverflow, whiteSpace: titleStyle.whiteSpace, overflow: titleStyle.overflow,
        headAlign: getComputedStyle(document.querySelector('.delivery-card__head')).alignItems,
        metaAlign: getComputedStyle(document.querySelector('.delivery-meta')).alignItems,
        purposeGap: parseFloat(getComputedStyle(document.querySelector('.delivery-purpose')).marginBottom),
        searchHeight: document.querySelector('.list-search').getBoundingClientRect().height,
        workspaceHeight: document.querySelector('.list-workspace-switch').getBoundingClientRect().height,
      };
    });
    check('delivery card header, metadata and search controls follow the list spec', cardHeadMetrics.moreWidth === 32 &&
      cardHeadMetrics.tagShrink === '0' && cardHeadMetrics.textOverflow === 'ellipsis' &&
      cardHeadMetrics.whiteSpace === 'nowrap' && cardHeadMetrics.overflow === 'hidden' &&
      cardHeadMetrics.headAlign === 'center' && cardHeadMetrics.metaAlign === 'baseline' &&
      cardHeadMetrics.purposeGap === 12 && cardHeadMetrics.searchHeight === 32 && cardHeadMetrics.workspaceHeight === 32);
    const cardAffordance = await page.evaluate(() => {
      const row = document.querySelector('.delivery-row');
      const footer = row.querySelector('.delivery-footer').getBoundingClientRect();
      const changes = row.querySelector('.delivery-changes').getBoundingClientRect();
      const more = row.querySelector('.delivery-more');
      const purpose = row.querySelector('.delivery-purpose');
      return {
        cursor: getComputedStyle(row).cursor,
        actionText: row.querySelector('.delivery-actions').innerText.replace(/\s+/g, ' ').trim(),
        enterCount: row.querySelectorAll('.delivery-enter').length,
        icon: document.querySelector('.dsh-nav-item--plugin .dsh-nav-icon')?.innerHTML || '',
        navColor: getComputedStyle(document.querySelector('.dsh-nav-item--plugin .dsh-nav-icon')).color,
        changesRightGap: Math.abs(footer.right - changes.right),
        moreSvg: more ? more.querySelectorAll(':scope > svg').length : 0,
        moreText: more ? more.innerText.trim() : '…',
        purposeClamp: purpose ? getComputedStyle(purpose).webkitLineClamp : '',
        hasSessionPrefix: row.innerText.includes('最近会话：'),
      };
    });
    check('delivery card shows pointer, one changes action and the line product icon', cardAffordance.cursor === 'pointer' &&
      cardAffordance.actionText.replace(/→/g,'').trim() === '变更说明' && cardAffordance.enterCount === 0 && cardAffordance.changesRightGap <= 2 &&
      cardAffordance.icon.includes('m9 8.5') && cardAffordance.icon.includes('M13 8.5') && cardAffordance.icon.includes('m21 21-4.3-4.3') &&
      !cardAffordance.icon.includes('rect x="3.5"') &&
      !['rgb(72, 104, 178)', 'rgb(122, 170, 255)'].includes(cardAffordance.navColor) &&
      cardAffordance.moreSvg === 1 && cardAffordance.moreText === '' && cardAffordance.purposeClamp === '2' &&
      cardAffordance.hasSessionPrefix === false);
    const hoverBefore = await page.evaluate(() => {
      const row = document.querySelector('.delivery-row');
      return { color: getComputedStyle(row.querySelector('.delivery-title')).color, border: getComputedStyle(row).borderTopColor };
    });
    await page.locator('.delivery-row').first().hover();
    await page.waitForTimeout(120);
    const hoverAfter = await page.evaluate(() => {
      const row = document.querySelector('.delivery-row');
      const style = getComputedStyle(row);
      return { color: getComputedStyle(row.querySelector('.delivery-title')).color, border: style.borderTopColor, shadow: style.boxShadow };
    });
    check('hovering a card keeps the title color and only lifts the border and shadow',
      hoverAfter.color === hoverBefore.color && hoverAfter.border !== hoverBefore.border &&
      hoverAfter.border === 'rgba(0, 0, 0, 0.14)' && hoverAfter.shadow !== 'none');
    await page.locator('.delivery-row').first().locator('.delivery-changes').click();
    await page.waitForTimeout(150);
    check('the changes entry opens the overview from the card', (await state()).view === 'review' &&
      (await state()).mainView === 'overview');
    await page.locator('.wb-back').click();
    await page.waitForTimeout(120);
    await page.locator('.delivery-title').first().click();
    await page.waitForTimeout(150);
    check('clicking the card title opens the review', (await state()).view === 'review');
    await page.locator('.wb-back').click();
    await page.waitForTimeout(120);
    await page.locator('.delivery-row').first().click({ position: { x: 8, y: 8 } });
    await page.waitForTimeout(150);
    check('clicking blank card space opens the review', (await state()).view === 'review');
    await page.locator('.wb-back').click();
    await page.waitForTimeout(120);
    await page.locator('.delivery-row[data-delivery-id="del-demo-zero"] .delivery-title').click();
    await page.waitForTimeout(150);
    const syntheticOverview = await page.evaluate(() => {
      const app = CRPrototype.app;
      const ownFiles = new Set((app.snapshot?.files || []).map(file => file.path));
      return {
        title: app.currentDelivery?.title,
        purpose: app.understanding?.overview?.purpose,
        deliveryPurpose: app.currentDelivery?.purpose,
        requirements: app.snapshot?.requirements?.length,
        features: app.allFeatures.length,
        ownFilesOnly: app.allFeatures.every(feature => feature.refs?.length &&
          feature.refs.every(ref => ownFiles.has(ref.path))) &&
          app.allFeatures.every(feature => feature.files.every(path => ownFiles.has(path))),
        recordEntries: app.recordEntries.length,
        changedMode: app.filterModes.includes('changed'),
      };
    });
    check('synthetic deliveries carry their own description and features', syntheticOverview.title === '空状态示例' &&
      syntheticOverview.purpose === syntheticOverview.deliveryPurpose && syntheticOverview.requirements === 0 &&
      syntheticOverview.features > 0 && syntheticOverview.ownFilesOnly === true &&
      syntheticOverview.recordEntries === 1 && syntheticOverview.changedMode === false);
    await page.locator('.wb-back').click();
    await page.waitForTimeout(120);
    check('delivery cards expose a recent-session entry without the retired prefix', await page.locator('.delivery-session-link').count() >= 1 &&
      /.+ · .+/.test((await page.locator('.delivery-session-link').first().innerText()).replace(/\s+/g, ' ')) &&
      !(await page.locator('.delivery-session-link').first().innerText()).includes('最近会话：'));
    await page.setViewportSize({ width: 1000, height: 800 });
    await page.waitForTimeout(150);
    const sessionLine = await page.evaluate(() => {
      const link = document.querySelector('.delivery-session-link');
      const icon = link.querySelector('svg');
      const title = link.querySelector('.delivery-session-title');
      const titleRect = title.getBoundingClientRect();
      const time = link.querySelector('.delivery-session-time').getBoundingClientRect();
      const actions = link.closest('.delivery-row').querySelector('.delivery-actions').getBoundingClientRect();
      const card = link.closest('.delivery-row').getBoundingClientRect();
      return {
        oneLine: icon && Math.abs(icon.getBoundingClientRect().top + icon.getBoundingClientRect().height / 2 - (titleRect.top + titleRect.height / 2)) < 3 &&
          Math.abs(time.top - titleRect.top) < 3,
        titleOverflow: getComputedStyle(title).textOverflow,
        timeNowrap: getComputedStyle(link.querySelector('.delivery-session-time')).whiteSpace,
        slotWidth: link.getBoundingClientRect().width,
        noOverlap: link.getBoundingClientRect().right <= actions.left + 1,
        cardWidth: card.width,
      };
    });
    check('a narrow grid card keeps the session line on one line with a readable width', sessionLine.oneLine &&
      sessionLine.titleOverflow === 'ellipsis' && sessionLine.timeNowrap === 'nowrap' &&
      sessionLine.slotWidth >= 130 && sessionLine.noOverlap &&
      sessionLine.cardWidth >= 320 && sessionLine.cardWidth <= 380);
    await page.setViewportSize({ width: 1176, height: 834 });
    await page.waitForTimeout(120);
    check('card entries stay at the bottom right even without a session', await page.evaluate(() =>
      [...document.querySelectorAll('.delivery-row')].every(row => {
        const footer = row.querySelector('.delivery-footer').getBoundingClientRect();
        const actions = row.querySelector('.delivery-actions').getBoundingClientRect();
        return Math.abs(footer.right - actions.right) <= 2;
      })));
    const activeCardStates = await page.evaluate(() => [...document.querySelectorAll('.delivery-row')].map(row => ({
      id: row.dataset.deliveryId,
      title: row.querySelector('.delivery-title')?.innerText.trim() || '',
      pills: [...row.querySelectorAll('.delivery-status')].map(pill => pill.innerText.trim()),
    })));
    await page.locator('.delivery-archive-toggle').click();
    await page.waitForTimeout(120);
    const cardStates = [...activeCardStates, ...await page.evaluate(() => [...document.querySelectorAll('.delivery-row')].map(row => ({
      id: row.dataset.deliveryId,
      title: row.querySelector('.delivery-title')?.innerText.trim() || '',
      pills: [...row.querySelectorAll('.delivery-status')].map(pill => pill.innerText.trim()),
    })))];
    const pillsOf = id => cardStates.find(card => card.id === id)?.pills || [];
    check('main card shows the finding pill and the withholding reason side by side',
      JSON.stringify(pillsOf(mainRepoDeliveries[0].id)) === JSON.stringify(['发现 7 个问题', '3 条结论未通过校验']));
    check('cards cover every incomplete row of the review-status table',
      JSON.stringify(pillsOf('del-demo-partial-pending')) === JSON.stringify(['3 个文件待审']) &&
      JSON.stringify(pillsOf('del-demo-partial-failed')) === JSON.stringify(['1 个文件审查失败']) &&
      JSON.stringify(pillsOf('del-demo-run-failed')) === JSON.stringify(['审查失败']) &&
      JSON.stringify(pillsOf('del-demo-withheld-only')) === JSON.stringify(['2 条结论未通过校验']) &&
      JSON.stringify(pillsOf('del-demo-incomplete')) === JSON.stringify(['发现 1 个问题', '3 条结论未通过校验']) &&
      JSON.stringify(pillsOf('del-demo-read-incomplete')) === JSON.stringify(['代码读取不完整']) &&
      JSON.stringify(pillsOf('del-demo-multi')) === JSON.stringify(['2 项待处理']) &&
      JSON.stringify(pillsOf('del-demo-zero')) === JSON.stringify(['未发现问题']) &&
      /^发现 [1-9]\d* 个问题$/.test(pillsOf('del-demo-merged')[0] || ''));
    check('status pills stay within ten characters', cardStates.every(card =>
      card.pills.every(pill => [...pill].length <= 10)));
    check('list page text has no retired project, review-incomplete or pending-review wording', await page.evaluate(() => {
      const text = document.querySelector('.dsh-list-view').innerText;
      return !text.includes('项目') && !text.includes('审查不完整') && !text.includes('待评审');
    }));
    await page.setViewportSize({ width: 1000, height: 800 });
    await page.waitForTimeout(120);
    const narrowPills = await page.evaluate(() => [...document.querySelectorAll('.delivery-status-row')].map(row => {
      const card = row.closest('.delivery-row').getBoundingClientRect();
      const pills = [...row.querySelectorAll('.delivery-status')];
      return {
        wrapped: pills.some(pill => pill.getBoundingClientRect().height > 22 ||
          pill.scrollWidth > pill.clientWidth + 1 || pill.scrollHeight > pill.clientHeight + 1),
        overflow: row.getBoundingClientRect().right > card.right + 1,
      };
    }));
    check('status pills never wrap at a 1000px window with the narrowest cards',
      narrowPills.length > 0 && narrowPills.every(entry => entry.wrapped === false && entry.overflow === false));
    await page.setViewportSize({ width: 1176, height: 834 });
    await page.waitForTimeout(120);
    if (await page.locator('.delivery-archive-toggle').getAttribute('aria-expanded') === 'true') {
      await page.locator('.delivery-scope-all').click();
      await page.waitForTimeout(100);
    }
    check('list has no solid brand main button', (await brandButtons()).length === 0);
    await auditIconButtons('the delivery list');
    await shot('00-list');

    await page.locator('.list-workspace-switch').click();
    await page.waitForTimeout(120);
    const popoverNames = await page.locator('.workspace-item-name').allInnerTexts();
    check('the workspace popover lists every workspace in data order', JSON.stringify(popoverNames) ===
      JSON.stringify(data.workspaces.map(workspace => workspace.name)) && popoverNames.length >= 4);
    const sidebarNames = await page.evaluate(names => {
      const text = document.querySelector('.dsh-sidebar').innerText;
      return names.map(name => ({ name, count: text.split(name).length - 1 }));
    }, data.workspaces.map(workspace => workspace.name));
    check('each workspace name appears exactly once in the sidebar',
      sidebarNames.every(entry => entry.count === 1) &&
      await page.locator('.dsh-sidebar .dsh-project-row').count() === data.workspaces.length &&
      await page.locator('.dsh-sidebar .dsh-chat-row').count() >= 1);
    check('the popover marks subfolders, other repos and non-git folders',
      (await page.locator('.workspace-item').filter({ hasText: 'prototype' }).innerText()).includes('所属仓库：demo-app') &&
      (await page.locator('.workspace-item').filter({ hasText: 'demo-notes' }).innerText()).includes('所属仓库：demo-notes') &&
      (await page.locator('.workspace-item').filter({ hasText: 'scratch' }).innerText()).includes('不是 Git 仓库'));
    check('the current workspace is checked and highlighted', await page.evaluate(id => {
      const current = document.querySelector(`.workspace-item.is-current`);
      return Boolean(current) && current.getAttribute('aria-selected') === 'true' &&
        current.innerText.includes(id) && Boolean(current.querySelector('.workspace-item-check'));
    }, activeWorkspace.name));
    await page.locator('input[aria-label="搜索工作区"]').fill('scr');
    await page.waitForTimeout(100);
    check('the workspace search filters the list', await page.locator('.workspace-item').count() === 1 &&
      (await page.locator('.workspace-item').innerText()).includes('scratch'));
    await page.locator('input[aria-label="搜索工作区"]').fill('');
    await page.waitForTimeout(100);
    await shot('36-list-popover-light');
    await page.locator('.workspace-item').filter({ hasText: 'prototype' }).click();
    await page.waitForTimeout(150);
    check('two workspaces of the same repository see the same deliveries',
      await page.locator('.delivery-row').count() === (await page.evaluate(() => CRPrototype.app.deliveryRows.length)) &&
      (await page.locator('.list-workspace-switch').innerText()).includes('prototype'));
    await page.locator('.list-workspace-switch').click();
    await page.locator('.workspace-item').filter({ hasText: 'demo-notes' }).click();
    await page.waitForTimeout(150);
    check('another repository shows only its own delivery',
      await page.locator('.delivery-row').count() === 1 &&
      await page.locator('.delivery-row').first().innerText().then(text => text.includes('演示：需求模板整理')));
    await page.locator('.list-workspace-switch').click();
    await page.locator('.workspace-item').filter({ hasText: 'scratch' }).click();
    await page.waitForTimeout(150);
    check('a non-git workspace shows the existing not-a-git-repository prompt',
      await page.locator('.list-preflight-wrap').count() === 1 &&
      (await page.locator('.list-preflight-wrap h2').innerText()).includes('当前目录不是 Git 仓库') &&
      await page.locator('.delivery-row').count() === 0);
    await page.locator('.list-workspace-switch').click();
    await page.locator('.workspace-item').filter({ hasText: /^demo-app/ }).click();
    await page.waitForTimeout(150);
    check('switching back to a git workspace restores the deliveries',
      await page.locator('.delivery-row').count() === (await page.evaluate(() => CRPrototype.app.deliveryRows.length)));
    const archivedSession = await page.evaluate(() => {
      const row = document.querySelector('[data-delivery-id="del-demo-partial-pending"]');
      const slot = row?.querySelector('.delivery-session-static');
      return {
        readonly: slot?.tagName || '',
        link: Boolean(row?.querySelector('.delivery-session-link')),
        text: slot?.innerText.replace(/\s+/g, ' ') || '',
        tip: slot?.getAttribute('title') || '',
      };
    });
    check('an archived recent session is plain text with a suffix and a tooltip',
      archivedSession.readonly === 'SPAN' && archivedSession.link === false &&
      archivedSession.text.includes('（会话已归档）') &&
      archivedSession.tip === '该会话已归档，取消归档后查看');
    const archivedStyle = await page.evaluate(() => {
      const row = document.querySelector('[data-delivery-id="del-demo-partial-pending"]');
      const title = row?.querySelector('.delivery-session-title');
      const slot = row?.querySelector('.delivery-session-static');
      const style = title ? getComputedStyle(title) : null;
      return {
        color: style?.color || '',
        decoration: style?.textDecorationLine || '',
        titleCursor: style?.cursor || '',
        slotCursor: slot ? getComputedStyle(slot).cursor : '',
      };
    });
    check('an archived session title is neutral, not underlined and not a pointer',
      !['rgb(72, 104, 178)', 'rgb(122, 170, 255)'].includes(archivedStyle.color) &&
      archivedStyle.decoration === 'none' &&
      archivedStyle.titleCursor !== 'pointer' && archivedStyle.slotCursor !== 'pointer');
    check('a deleted recent session is hidden', await page.evaluate(() =>
      !document.querySelector('[data-delivery-id="del-demo-merged"] .delivery-session-slot')));
    await page.locator('button[aria-label="工作区设置"]').click();
    await page.waitForTimeout(120);
    check('settings explain that they apply to every workspace of the repository',
      await page.locator('.workspace-settings-note').count() === 1 &&
      (await page.locator('.workspace-settings-note').innerText()) === '这些设置对同一仓库的所有工作区生效');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(100);
    await open({ scenario: 'list', theme: 'light' });
    await shot('35-list-header-light');
    await page.locator('.list-workspace-switch').click();
    await page.waitForTimeout(120);
    await shot('36-list-popover-light');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(100);
    await shot('37-list-grid-light');
    await open({ scenario: 'list', theme: 'dark' });
    await shot('35-list-header-dark');
    await page.locator('.list-workspace-switch').click();
    await page.waitForTimeout(120);
    await shot('36-list-popover-dark');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(100);
    await shot('37-list-grid-dark');
    await page.locator('input[aria-label="搜索交付"]').fill('withheld-only');
    await page.waitForTimeout(120);
    check('list search filters by branch/title', await page.locator('.delivery-row').count() === 1);
    await page.locator('input[aria-label="搜索交付"]').fill('');
    await page.waitForTimeout(120);
    await page.locator('.delivery-more').first().click();
    check('the menu button does not open the review', (await state()).view === 'list');
    const menuGap = await page.evaluate(() => {
      const button = document.querySelector('.delivery-more').getBoundingClientRect();
      const menu = document.querySelector('.delivery-menu').getBoundingClientRect();
      return menu.top - button.bottom;
    });
    check('card menu leaves a visible gap below the trigger', menuGap >= 3);
    const cardMenu = await page.locator('.delivery-menu').innerText();
    check('card menu holds pin, archive and delete without review entries', cardMenu.includes('取消置顶') &&
      cardMenu.includes('归档') && cardMenu.includes('删除') && !cardMenu.includes('删除…') && !cardMenu.includes('下载') && !cardMenu.includes('查看评审') &&
      !cardMenu.includes('删除交付及其审查记录'));
    await page.keyboard.press('Escape');
    await page.waitForTimeout(100);
    await page.locator(`.delivery-row[data-delivery-id="${data.deliveries[0].id}"] .delivery-session-link`).click();
    await page.waitForTimeout(150);
    s = await state();
    check('recent-session entry returns to that conversation', s.view === 'conversation' &&
      (await page.locator('.dsh-chat-title-row h1').innerText()) === '接入 EvidentLoop 变更评审');
    const zeroSessionLink = page.locator('.delivery-row').nth(1).locator('.delivery-session-link');
    await page.locator('.dsh-nav-item--plugin').click();
    await page.waitForTimeout(150);
    if (await zeroSessionLink.count()) {
      await zeroSessionLink.click();
      await page.waitForTimeout(150);
      check('recent-session entry switches to that delivery', await page.evaluate(() =>
        CRPrototype.app.currentDeliveryId === CRPrototype.app.deliveries[1].deliveryId &&
        CRPrototype.app.conversationTitle === '收敛空状态交付'));
      await page.locator('.dsh-nav-item--plugin').click();
      await page.waitForTimeout(150);
    }
    check('returning from a recent session lands on the list', (await state()).view === 'list');
    await page.locator(`.delivery-row[data-delivery-id="${data.deliveries[0].id}"] .delivery-main`).click();
    await page.waitForTimeout(200);
    s = await state();
    check('list row opens the review and back returns to list', s.view === 'review' && s.reviewOrigin === 'list' &&
      s.deliveryTitle === 'P1 变更评审适配' && await page.locator('.wb-back').innerText() === '返回');
    check('review header shows delivery title, branch, range wording and a record dropdown',
      (await page.locator('.wb-meta').innerText()).replace(/\s+/g, ' ').trim() === 'main · 未提交的改动' &&
      (await page.locator('.wb-record-trigger').innerText()).includes('审查记录 · 最新') &&
      /\d{2}-\d{2} \d{2}:\d{2}/.test(await page.locator('.wb-record-trigger').innerText()) &&
      (await page.locator('.wb-record-trigger').getAttribute('aria-label')) === '切换审查记录（共 4 次）');
    const headerAlignment = await page.evaluate(() => {
      const back = document.querySelector('.wb-back').getBoundingClientRect();
      const title = document.querySelector('.wb-title-wrap').getBoundingClientRect();
      return Math.abs((back.top + back.height / 2) - (title.top + title.height / 2));
    });
    check('review header back and title share a vertical center', headerAlignment <= 1);
    const listSnapshot = await page.evaluate(() => window.CRPrototype.app.snapshot.snapshotId);
    await page.locator('.wb-back').click();
    await page.waitForTimeout(150);
    check('review back from list returns to list', (await state()).view === 'list');

    }
    markStep('conversation and delivery card');
    // ---------- conversation and card ----------
    if (scoped('list')) {
    await open({ view: 'conversation' });
    s = await state();
    check('conversation card has status, requirement and one primary action', s.view === 'conversation' &&
      (await page.locator('.dsh-conversation-view').count()) === 1 &&
      (await page.locator('.dsh-delivery-card').innerText()).includes('发现 7 个问题') &&
      (await page.locator('.dsh-delivery-card').innerText()).includes('需求待确认 3 项') &&
      !(await page.locator('.dsh-delivery-card').innerText()).includes('个文件') &&
      !(await page.locator('.dsh-delivery-card').innerText()).includes('有效问题') &&
      !(await page.locator('.dsh-delivery-card').innerText()).includes('就绪') &&
      !(await page.locator('.dsh-delivery-card').innerText()).includes('0 问题'));
    const primaryProbe = () => page.evaluate(() => {
      const button = document.querySelector('.dsh-primary-btn');
      if (!button) return null;
      const style = getComputedStyle(button);
      const parse = value => {
        const match = String(value).match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
        return match ? [+match[1], +match[2], +match[3], match[4] === undefined ? 1 : +match[4]] : null;
      };
      const luminance = color => color.slice(0, 3).map(value => {
        const channel = value / 255;
        return channel <= 0.03928 ? channel / 12.92 : Math.pow((channel + 0.055) / 1.055, 2.4);
      }).reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
      const ratio = (a, b) => (Math.max(luminance(a), luminance(b)) + 0.05) / (Math.min(luminance(a), luminance(b)) + 0.05);
      const background = parse(style.backgroundColor), foreground = parse(style.color);
      return {
        className: String(button.className), background: style.backgroundColor, color: style.color,
        border: style.borderTopColor, borderWidth: style.borderTopWidth, radius: style.borderTopLeftRadius,
        height: style.height, font: [style.fontSize, style.fontWeight].join(' '), shadow: style.boxShadow,
        ratio: background && foreground ? ratio(foreground, background) : 0,
        solidPurple: style.backgroundColor === 'rgb(65, 118, 230)' || style.backgroundColor === 'rgb(122, 170, 255)',
      };
    });
    const conversationPrimary = await primaryProbe();
    check('conversation primary button uses a neutral fill, brand text and brand border',
      conversationPrimary && conversationPrimary.className.includes('dsh-primary-btn') &&
      conversationPrimary.background === 'rgb(255, 255, 255)' && conversationPrimary.color === 'rgb(72, 104, 178)' &&
      conversationPrimary.border === 'rgb(65, 118, 230)' && conversationPrimary.borderWidth === '1px' &&
      conversationPrimary.radius === '8px' && conversationPrimary.height === '32px' &&
      conversationPrimary.font === '13px 600' && conversationPrimary.shadow === 'none' &&
      conversationPrimary.solidPurple === false && conversationPrimary.ratio >= 4.5);
    await page.locator('.dsh-primary-btn').hover();
    await page.waitForTimeout(120);
    const conversationHover = await primaryProbe();
    check('conversation primary button hover uses the brand tint and hover text',
      conversationHover.background === 'rgb(228, 237, 253)' && conversationHover.color === 'rgb(72, 104, 178)' &&
      conversationHover.ratio >= 4.5);
    await shot('44-conversation-primary-light');
    await page.mouse.move(0, 0);
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.waitForTimeout(150);
    const conversationDark = await primaryProbe();
    check('conversation primary button keeps the same scheme in dark mode',
      conversationDark.color === 'rgb(122, 170, 255)' && conversationDark.border === 'rgb(122, 170, 255)' &&
      conversationDark.background === 'rgb(35, 37, 42)' && conversationDark.ratio >= 4.5 &&
      conversationDark.solidPurple === false);
    await shot('44-conversation-primary-dark');
    await page.emulateMedia({ colorScheme: 'light' });
    await page.waitForTimeout(100);
    const deliveryIconMetrics = await page.evaluate(() => {
      const icon = document.querySelector('.dsh-delivery-icon').getBoundingClientRect();
      const main = getComputedStyle(document.querySelector('.dsh-delivery-card__main'));
      const html = document.querySelector('.dsh-delivery-icon')?.innerHTML || '';
      const iconStyle = getComputedStyle(document.querySelector('.dsh-delivery-icon'));
      return { width: icon.width, height: icon.height, gap: parseFloat(main.columnGap || main.gap), html,
        color: iconStyle.color, background: iconStyle.backgroundColor };
    });
    check('conversation delivery icon is 32px with a 10px gap and the line product icon', deliveryIconMetrics.width === 32 &&
      deliveryIconMetrics.height === 32 && deliveryIconMetrics.gap === 10 &&
      deliveryIconMetrics.html.includes('m9 8.5') && deliveryIconMetrics.html.includes('M13 8.5') && deliveryIconMetrics.html.includes('m21 21-4.3-4.3') &&
      !['rgb(72, 104, 178)', 'rgb(122, 170, 255)'].includes(deliveryIconMetrics.color) &&
      deliveryIconMetrics.background !== 'rgb(228, 237, 253)');
    await shot('00-conversation');
    await page.locator('.dsh-primary-btn').click();
    await page.waitForTimeout(200);
    s = await state();
    check('delivery card opens full-page review from conversation', s.view === 'review' && s.reviewOrigin === 'conversation' &&
      s.deliveryTitle === 'P1 变更评审适配' && s.mainView === 'overview' && s.panelMode === null);
    await page.locator('.wb-back').click();
    await page.waitForTimeout(150);
    check('card back returns to conversation', (await state()).view === 'conversation');
    await page.locator('.dsh-nav-item--plugin').click();
    await page.waitForTimeout(150);
    check('sidebar entry opens the delivery list', (await state()).view === 'list');
    check('list and review share the delivery', (await page.evaluate(() => window.CRPrototype.app.deliveries[0].deliveryId)) ===
      (await page.evaluate(() => window.CRPrototype.app.currentDeliveryId)));

    }
    if (scoped('list-empty')) {
    await open({ scenario: 'list-empty' });
    check('list-empty shows no deliveries but keeps settings', await page.locator('.delivery-row').count() === 0 &&
      (await page.locator('.delivery-empty').innerText()).includes('还没有交付') &&
      await page.locator('button[aria-label="工作区设置"]').count() === 1);
    await page.locator('button[aria-label="工作区设置"]').click();
    await page.waitForTimeout(100);
    check('list-empty settings has four fields', await page.locator('.list-settings-menu .wb-setting-row').count() === 4);
    await shot('26-list-empty');

    }
    if (scoped('list-history')) {
    await open({ scenario: 'list-history' });
    check('list-history shows the delivery without inline history rows',
      await page.locator('.delivery-row').count() === (await page.evaluate(() => CRPrototype.app.deliveryRows.length)) &&
      await page.locator('.delivery-snapshot').count() === 0);
    await shot('27-list-history');
    await page.locator(`.delivery-row[data-delivery-id="${data.deliveries[0].id}"] .delivery-main`).click();
    await page.waitForTimeout(200);
    check('the delivery carries four review records in its header dropdown', await page.evaluate(() =>
      CRPrototype.app.recordEntries.length === 4) &&
      /\d{2}-\d{2} \d{2}:\d{2}/.test(await page.locator('.wb-record-trigger').innerText()));
    await page.locator('.wb-record-trigger').click();
    await page.waitForTimeout(100);
    const recordRows = await page.locator('.record-menu .record-item').evaluateAll(items => items.map(item => item.innerText));
    check('records dropdown lists time, code source, conclusion and dirty marker', recordRows.length === 4 &&
      recordRows.every(text => /\d{2}-\d{2} \d{2}:\d{2}/.test(text) && /(提交「|未提交的改动)/.test(text) && /(发现 \d+ 个问题|未发现问题)/.test(text)) &&
      recordRows.some(text => text.includes('未提交改动')) && recordRows.some(text => text.includes('merge(dev): 合入双端调试')));
    check('records from a deleted session hide the source-session entry',
      await page.locator('.record-menu .record-item__session, .record-menu .record-item__session-link').count() === 3);
    await page.locator('.record-menu .record-item').nth(1).click();
    await page.waitForTimeout(250);
    const earlierRecord = await page.evaluate(() => ({
      position: CRPrototype.app.recordPosition,
      readonly: CRPrototype.app.readonly,
      banner: document.querySelector('.wb-history-banner')?.innerText || '',
      runControls: document.querySelectorAll('.run-primary,.run-state__action').length,
      paths: CRPrototype.app.normalizedDiffItems.map(item => item.path),
      issues: CRPrototype.app.activeFindingCount,
      filterModes: CRPrototype.app.filterModes,
    }));
    check('selecting an earlier record switches in place and shows the read-only banner', earlierRecord.position === 1 &&
      earlierRecord.readonly === true && earlierRecord.banner.includes('（只读）') && earlierRecord.banner.includes('打开最新审查') &&
      !/\d{2}-\d{2} \d{2}:\d{2}/.test(earlierRecord.banner));
    check('earlier records hide disposition controls instead of disabling them', earlierRecord.runControls === 0 &&
      await page.locator('.gpt-risk-marker .file-risk-item__suppress-btn, .gpt-risk-marker__restore').count() === 0 &&
      await page.locator('.wb-readonly-chip').count() === 0);
    check('earlier records use their own file identities and issues', earlierRecord.paths.length === data.files &&
      earlierRecord.paths.includes('prototype/src/app.js') &&
      earlierRecord.paths.includes('prototype/src/demo/withdrawn.js') && earlierRecord.issues === 3);
    check('the earlier record keeps only all/risk/pending filters', !earlierRecord.filterModes.includes('changed') &&
      await page.evaluate(() => !('changed' in CRPrototype.app.riskAdjustedCount)) &&
      await page.locator('.file-filter-label--changed').count() === 0);
    check('the middle record exports its comparison against the oldest record', await page.evaluate(() => {
      const markdown = CRPrototype.exports.buildMarkdown(CRPrototype.app.exportContext());
      return markdown.includes('新增 prototype/src/demo/withdrawn.js') &&
        markdown.includes('移除 prototype/src/coverage.js');
    }));
    await page.locator('.wb-link').filter({ hasText: '打开最新审查' }).click();
    await page.waitForTimeout(250);
    check('open latest returns to the newest record and clears the banner', await page.evaluate(() => CRPrototype.app.recordPosition === 0) &&
      await page.locator('.wb-history-banner').count() === 0);
    check('the adjacent-review delta stays available to export without a header tab', await page.evaluate(() => {
      const app = CRPrototype.app;
      const previous = app.previousRecordEntry;
      const record = app.recordDataFor(app.currentDelivery, previous.snapshotId);
      const delta = CRPrototype.coverage.diffFileIdentities(record.snapshot.files || [], app.snapshot.files || []);
      const current = new Set(app.normalizedDiffItems.map(item => item.path));
      const changedCount = [...delta.changed, ...delta.added].filter(entry => current.has(entry.path)).length;
      return changedCount === 4 && delta.removed.some(entry => entry.path === 'prototype/src/demo/withdrawn.js') &&
        delta.changed.some(entry => entry.path === 'prototype/src/app.js');
    }));
    check('the export lists a reverted file while the current delta only lists current files', await page.evaluate(() => {
      const app = CRPrototype.app;
      const markdown = CRPrototype.exports.buildMarkdown(app.exportContext());
      const previous = app.previousRecordEntry;
      const record = app.recordDataFor(app.currentDelivery, previous.snapshotId);
      const delta = CRPrototype.coverage.diffFileIdentities(record.snapshot.files || [], app.snapshot.files || []);
      const currentPaths = [...delta.changed, ...delta.added].map(entry => entry.path);
      return markdown.includes('移除 prototype/src/demo/withdrawn.js') &&
        !currentPaths.includes('prototype/src/demo/withdrawn.js') &&
        currentPaths.includes('prototype/src/coverage.js');
    }));
    const topology = await page.evaluate(() => {
      const data = window.CR_PROTOTYPE_DATA;
      const delivery = data.deliveries[0];
      const record = entry => data.records[entry.snapshotId]?.snapshot || data.snapshot;
      const [latest, middle, oldest] = delivery.snapshots.map(record);
      const summarize = (before, after) => {
        const delta = CRPrototype.coverage.diffFileIdentities(before.files, after.files);
        return {
          total: delta.changed.length + delta.added.length + delta.removed.length,
          changed: delta.changed.map(item => item.path),
          added: delta.added.map(item => item.path),
          removed: delta.removed.map(item => item.path),
        };
      };
      return { latestMiddle: summarize(middle, latest), middleOldest: summarize(oldest, middle), records: delivery.snapshots.length };
    });
    check('the four records are continuous versions, not unrelated file sets', topology.records === 4 &&
      topology.latestMiddle.total >= 3 &&
      topology.latestMiddle.total <= 5 && topology.middleOldest.total >= 3 && topology.middleOldest.total <= 5 &&
      topology.latestMiddle.added.includes('prototype/src/coverage.js') &&
      topology.latestMiddle.removed.includes('prototype/src/demo/withdrawn.js') &&
      topology.latestMiddle.changed.includes('prototype/src/app.js') &&
      topology.latestMiddle.changed.includes('prototype/src/dsh-shell.js') &&
      topology.latestMiddle.changed.includes('prototype/src/ui.js'));
    check('the changed filter stays gone even when the adjacent delta is partial', await page.evaluate(() => {
      const app = CRPrototype.app;
      const previous = app.previousRecordEntry;
      const record = app.recordDataFor(app.currentDelivery, previous.snapshotId);
      const delta = CRPrototype.coverage.diffFileIdentities(record.snapshot.files || [], app.snapshot.files || []);
      const current = new Set(app.normalizedDiffItems.map(item => item.path));
      const changedCount = [...delta.changed, ...delta.added].filter(entry => current.has(entry.path)).length;
      return !app.filterModes.includes('changed') && changedCount > 0 && changedCount < app.normalizedDiffItems.length;
    }) && await page.locator('.file-filter-label--changed').count() === 0);
    await page.evaluate(() => {
      const app = CRPrototype.app;
      const delivery = app.currentDelivery;
      app.openDeliverySnapshot(delivery, delivery.snapshots[3]);
    });
    await page.waitForTimeout(300);
    check('the oldest record has no previous record and no changed state', await page.evaluate(() =>
      CRPrototype.app.filterModes.includes('changed') === false && !('changedFilePaths' in CRPrototype.app)) &&
      await page.evaluate(() => CRPrototype.exports.buildMarkdown(CRPrototype.app.exportContext()).includes('这是该交付的第一份审查记录。')));
    await page.locator('.wb-back').click();
    await page.waitForTimeout(150);
    check('earlier record back returns to list', (await state()).view === 'list');

    }
    if (scoped('list')) {
    await open();
    await page.locator(`.delivery-row[data-delivery-id="${data.deliveries[0].id}"] .delivery-main`).click();
    await page.waitForTimeout(200);
    await ensureOverview();
    await page.locator('.overview-requirements > summary').click();
    await page.waitForTimeout(100);
    await page.locator('.req-ref-row input').fill('REQ-7777');
    await page.waitForTimeout(120);
    check('requirement number is stored on the current delivery', await page.evaluate(() =>
      CRPrototype.app.currentDelivery.externalRef === 'REQ-7777'));
    await page.locator('.wb-back').click();
    await page.waitForTimeout(150);
    await page.locator('input[aria-label="搜索交付"]').fill('REQ-7777');
    await page.waitForTimeout(120);
    check('requirement number is searchable but not shown on the card', await page.locator('.delivery-row').count() === 1 &&
      await page.locator('.delivery-ref').count() === 0 && (await page.locator('.delivery-title').first().innerText()) === 'P1 变更评审适配');
    await page.locator('input[aria-label="搜索交付"]').fill('');
    await page.waitForTimeout(120);
    await page.locator('.delivery-changes').first().click();
    await page.waitForTimeout(150);
    check('the changes entry opens the overview', (await state()).mainView === 'overview' &&
      (await state()).view === 'review');
    await page.locator('.wb-back').click();
    await page.waitForTimeout(120);
    await page.locator(`.delivery-row[data-delivery-id="${data.deliveries[0].id}"] .delivery-main`).click();
    await page.waitForTimeout(150);
    check('clicking the card body opens the diff directly', (await state()).mainView === 'diff');
    await page.locator('.focus-tree-row').filter({ hasText: 'build-data.mjs' }).first().click();
    await page.waitForTimeout(150);
    check('clicking a tree file switches to diff', (await state()).mainView === 'diff');
    await page.locator('.wb-back').click();
    await page.waitForTimeout(120);
    await page.locator(`.delivery-row[data-delivery-id="${data.deliveries[0].id}"] .delivery-main`).click();
    await page.waitForTimeout(150);
    check('the enter entry opens the file diff', (await state()).mainView === 'diff');
    await page.locator('.wb-back').click();
    await page.waitForTimeout(120);
    await page.locator(`.delivery-row[data-delivery-id="${data.deliveries[0].id}"] .delivery-more`).click();
    check('card menu exposes no downloads; exports live in the workbench', await page.getByRole('menuitem', { name: /下载/ }).count() === 0 &&
      await page.getByRole('menuitem', { name: /删除/ }).count() === 1);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(100);

    }
  },
};
