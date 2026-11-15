/* verify module: reviewed */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
module.exports = {
  id: 'reviewed',
  order: 1,
  scenarios: ['reviewed', 'zero', 'extension-changed', 'partial'],
  async run(rt) {
    const { page, context, output, data, scoped, selectedScenarios, SCENARIOS, ONLY } = rt;
    const { open, state, shot, check, markStep, ensureOverview, filterByMode, brandButtons, blueUiColors, contrastSamples, assertReadable, auditIconButtons, currentData, parseEmbeddedData, PROTOTYPE_WORD, UNCOMPUTED_WORD } = rt;
    let s;
    markStep('reviewed workbench');
    // ---------- reviewed: rules, panels, menus, marks ----------
    if (scoped('reviewed')) {
    await open({ scenario: 'reviewed' });
    const controlPositions = () => page.evaluate(() => {
      const rect = selector => document.querySelector(selector)?.getBoundingClientRect();
      return {
        exportLeft: rect('[aria-label="导出与发回"]')?.left || null,
        settingsLeft: rect('[aria-label="工作区设置"]')?.left || null,
        reviewLeft: rect('.run-primary')?.left || null,
        filterLeft: rect('.file-filter-group')?.left || null,
        splitLeft: rect('.wb-split-toggle')?.left || null,
      };
    });
    const selectedBeforeSwitch = await page.evaluate(() => CRPrototype.app.selectedFileItem.path);
    await page.getByRole('tab', { name: '变更说明' }).click();
    await page.waitForTimeout(120);
    const overviewControls = await controlPositions();
    check('two-segment view switch shows overview and weakens the selected file', (await state()).mainView === 'overview' &&
      await page.locator('.view-switch [aria-selected="true"]').innerText() === '变更说明' &&
      await page.locator('.focus-tree-row.is-selected.is-weak-selected').count() === 1 &&
      await page.evaluate(() => getComputedStyle(document.querySelector('.wb-split-toggle')).visibility) === 'hidden' &&
      await page.evaluate(() => getComputedStyle(document.querySelector('.file-filter-group')).visibility) === 'hidden' &&
      await page.locator('.file-filter-group[aria-hidden="true"]').count() === 1);
    check('view switch keeps two text tabs in order without icons', await page.evaluate(() => {
      const tabs = [...document.querySelectorAll('.view-switch [role="tab"]')];
      return tabs.length === 2 && tabs[0].innerText.trim() === '变更说明' && tabs[1].innerText.trim() === '文件对比' &&
        tabs.every(tab => tab.querySelectorAll('svg').length === 0);
    }));
    await page.getByRole('tab', { name: '文件对比' }).click();
    await page.waitForTimeout(120);
    const diffControls = await controlPositions();
    check('view switch returns to the last file and keeps control positions', (await state()).mainView === 'diff' &&
      (await state()).selected === selectedBeforeSwitch &&
      overviewControls.exportLeft === diffControls.exportLeft && overviewControls.settingsLeft === diffControls.settingsLeft &&
      overviewControls.filterLeft === diffControls.filterLeft && overviewControls.splitLeft === diffControls.splitLeft &&
      await page.evaluate(() => getComputedStyle(document.querySelector('.wb-split-toggle')).visibility) === 'visible' &&
      await page.evaluate(() => getComputedStyle(document.querySelector('.file-filter-group')).visibility) === 'visible');
    const toolbarMetrics = await page.evaluate(() => {
      const height = selector => document.querySelector(selector)?.getBoundingClientRect().height ?? null;
      return {
        bar: height('.wb-toolbar'),
        collapse: height('.focus-toggle-file-pane'),
        view: height('.view-switch'),
        filter: height('.file-filter-group'),
        split: height('.wb-split-toggle'),
        exportButton: height('[aria-label="导出与发回"]'),
        settingsButton: height('[aria-label="工作区设置"]'),
      };
    });
    check('toolbar is 40px and its control rows are 32px', toolbarMetrics.bar === 40 &&
      ['collapse', 'view', 'filter', 'split', 'exportButton', 'settingsButton'].every(key => toolbarMetrics[key] === 32));
    const toolbarSpacing = await page.evaluate(() => {
      const bar = document.querySelector('.wb-toolbar');
      const body = bar.getBoundingClientRect();
      const controls = [...bar.querySelectorAll('.focus-toggle-file-pane,.view-switch,.run-primary,.file-filter-group,.wb-split-toggle,[aria-label="导出与发回"],[aria-label="工作区设置"]')]
        .filter(element => element.getClientRects().length);
      return {
        gaps: controls.map(element => {
          const rect = element.getBoundingClientRect();
          return { top: rect.top - body.top, bottom: body.bottom - rect.bottom, height: rect.height };
        }),
        searchGap: document.querySelector('.file-search-input').getBoundingClientRect().top - body.bottom,
      };
    });
    check('toolbar controls sit 4px inside the bar and clear the divider', toolbarSpacing.gaps.length > 0 &&
      toolbarSpacing.gaps.every(gap => Math.abs(gap.top - gap.bottom) <= 1 && gap.top >= 3 && gap.bottom >= 3) &&
      toolbarSpacing.searchGap >= 7.5);
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.waitForTimeout(150);
    const darkToolbarSpacing = await page.evaluate(() => {
      const body = document.querySelector('.wb-toolbar').getBoundingClientRect();
      return [...document.querySelectorAll('.wb-toolbar .focus-icon-button,.wb-toolbar .view-switch')]
        .filter(element => element.getClientRects().length)
        .map(element => {
          const rect = element.getBoundingClientRect();
          return { top: rect.top - body.top, bottom: body.bottom - rect.bottom };
        });
    });
    check('dark toolbar keeps the same vertical centering', darkToolbarSpacing.length > 0 &&
      darkToolbarSpacing.every(gap => Math.abs(gap.top - gap.bottom) <= 1 && gap.bottom >= 3));
    await page.emulateMedia({ colorScheme: 'light' });
    await page.waitForTimeout(120);
    check('file-pane toggle stays flat like the other toolbar icons', await page.evaluate(() =>
      getComputedStyle(document.querySelector('.focus-toggle-file-pane')).backgroundColor) === 'rgba(0, 0, 0, 0)');
    const selectedBeforeOverview = await page.evaluate(() => CRPrototype.app.selectedFileItem.path);
    await page.getByRole('tab', { name: '变更说明' }).click();
    await page.waitForTimeout(120);
    await page.locator('.focus-tree-row.is-selected').click();
    await page.waitForTimeout(120);
    check('clicking the current file returns to its diff', (await state()).mainView === 'diff' &&
      (await state()).selected === selectedBeforeOverview);
    await page.evaluate(() => { CRPrototype.app.selectedFileItem = {}; });
    await page.getByRole('tab', { name: '变更说明' }).click();
    await page.waitForTimeout(100);
    await page.getByRole('tab', { name: '文件对比' }).click();
    await page.waitForTimeout(120);
    check('switching to diff without a selection opens the first file', (await state()).mainView === 'diff' &&
      Boolean((await state()).selected));
    await page.locator('.focus-tree-row').filter({ hasText: 'build-data.mjs' }).first().click();
    await page.waitForTimeout(120);
    await auditIconButtons('the workbench');
    s = await state();
    check('reviewed: succeeded and complete', s.runStatus === 'succeeded' && s.reviewComplete === true && s.pending === 0);
    check('reviewed: complete leaves the Review All position empty', s.runState === '' &&
      await page.locator('.run-state').count() === 0 && await page.locator('.run-primary').count() === 0);
    check('reviewed: no completion label anywhere', !(await page.locator('body').innerText()).includes('审查完成'));
    check('reviewed: file count appears once, only in filters', await page.locator('.file-filter-count--total').count() === 1 &&
      !s.titleText.includes('个文件'));
    check('reviewed: filter counts match state', s.filterPairs.every(pair =>
      pair.count === s.counts[pair.mode === 'all' ? 'total' : pair.mode]));
    check('reviewed: filters are all/risk with no turn or changed tabs', s.filterModes.join(',') === 'all,risk' &&
      await page.locator('input[name="file-filter"][value="turn"]').count() === 0 &&
      await page.locator('.file-filter-label--changed').count() === 0 &&
      !(await page.locator('body').innerText()).includes('本轮'));
    check('reviewed: active findings exist', s.active > 0 && s.withheld === 0);
    const cardLabels = (await page.locator('.gpt-risk-marker__type').allInnerTexts()).map(label => label.replace(/\s+/g, ' ').trim());
    check('finding labels keep category and severity pills without a separator', cardLabels.length > 0 &&
      cardLabels.every(label => /^(逻辑|安全|性能) ?P[012](?: · (阻断|严重|一般))?$/.test(label)) &&
      await page.locator('.gpt-risk-marker__type-sep').count() === 0);
    check('security and file-level findings are visible', cardLabels.some(label => /^安全 ?P0/.test(label)) &&
      await page.locator('.gpt-risk-marker__scope').filter({ hasText: '文件级' }).count() > 0);
    const severityStyles = await page.evaluate(() => [...document.querySelectorAll('.gpt-risk-marker:not(.gpt-risk-marker--suppressed)')].map(card => ({
      p2: card.classList.contains('gpt-risk-marker--p2'),
      chip: getComputedStyle(card.querySelector('.gpt-risk-marker__severity')).color,
      border: getComputedStyle(card).borderLeftColor,
    })));
    check('severity colors follow P0/P1 red and P2 orange', severityStyles.length > 0 && severityStyles.every(item =>
      item.p2 ? item.chip === 'rgb(217, 119, 6)' && item.border === 'rgb(217, 119, 6)'
        : item.chip === 'rgb(223, 42, 63)' && item.border === 'rgb(223, 42, 63)'));
    const everyCardStyle = await page.evaluate(() => {
      const probe = document.createElement('span');
      document.body.append(probe);
      const token = name => { probe.style.color = `var(${name})`; return getComputedStyle(probe).color; };
      const tokens = { bgL2: token('--el-bg-l2'), borderL2: token('--el-border-l2'), error: token('--el-state-error'), warn: token('--el-state-warn'), bgL3: token('--el-bg-l3') };
      probe.remove();
      return {
        tokens,
        cards: [...document.querySelectorAll('.gpt-risk-marker:not(.gpt-risk-marker--suppressed)')].map(card => {
          const cardStyle = getComputedStyle(card);
          const headerStyle = getComputedStyle(card.querySelector('.gpt-risk-marker__header'));
          const panel = card.querySelector('.gpt-risk-marker__code-panel');
          return {
            background: cardStyle.backgroundColor,
            border: cardStyle.borderTopColor,
            leftWidth: cardStyle.borderLeftWidth,
            left: cardStyle.borderLeftColor,
            header: headerStyle.backgroundColor,
            code: panel ? getComputedStyle(panel).backgroundColor : tokens.bgL3,
            p2: card.classList.contains('gpt-risk-marker--p2'),
          };
        }),
      };
    });
    check('every card keeps neutral surfaces and only a 3px severity rail', everyCardStyle.cards.length > 0 &&
      everyCardStyle.cards.every(card => card.background === everyCardStyle.tokens.bgL2 &&
        card.border === everyCardStyle.tokens.borderL2 && card.header === everyCardStyle.tokens.bgL2 &&
        card.code === everyCardStyle.tokens.bgL3 && card.leftWidth === '3px' &&
        card.left === (card.p2 ? everyCardStyle.tokens.warn : everyCardStyle.tokens.error)));
    await page.locator('.focus-tree-row').filter({ hasText: 'app.js' }).first().click();
    await page.waitForTimeout(200);
    const headerActions = await page.evaluate(() => [...document.querySelectorAll('.gpt-risk-marker:not(.gpt-risk-marker--suppressed)')].map(card => ({
      nextExpected: CRPrototype.app.$refs.codeReview.activeIssues.length > 1,
      copy: Boolean(card.querySelector('.gpt-risk-marker__copy-btn')),
      bottomBar: Boolean(card.querySelector('.issue-card-actions')),
      actions: [...card.querySelectorAll('.gpt-risk-marker__header-right > button')].map(button => ({
        className: button.className,
        label: button.getAttribute('aria-label') || '',
      })),
    })));
    check('card header appends O2 after the three actions only for multiple issues', headerActions.length > 0 && headerActions.every(card => card.copy === false && card.bottomBar === false &&
      card.actions.length === (card.nextExpected ? 4 : 3) &&
      /annotation-add/.test(card.actions[0].className) && card.actions[0].label === '添加批注' &&
      /issue-card-ask/.test(card.actions[1].className) && card.actions[1].label === '在会话中追问' &&
      /issue-card-suppress/.test(card.actions[2].className) && card.actions[2].label === '忽略问题' &&
      (!card.nextExpected || (/issue-card-next/.test(card.actions[3].className) && card.actions[3].label === '下一个问题'))));
    const hoverProbe = async selector => {
      await page.locator(selector).first().hover();
      await page.waitForTimeout(220);
      const result = await page.evaluate(selector => {
        const probe = document.createElement('span');
        document.body.append(probe);
        const token = name => { probe.style.color = `var(${name})`; return getComputedStyle(probe).color; };
        const tokens = { brand: token('--el-brand'), brandTint: token('--el-brand-tint'), error: token('--el-state-error'), errorTint: token('--el-state-error-tint') };
        probe.remove();
        const style = getComputedStyle(document.querySelector(selector));
        return { background: style.backgroundColor, color: style.color, tokens };
      }, selector);
      return result;
    };
    const askHover = await hoverProbe('.gpt-risk-marker__header-right > .issue-card-ask');
    check('ask hover uses the brand tint instead of the generic hover', askHover.background === askHover.tokens.brandTint && askHover.color === askHover.tokens.brand);
    const suppressHover = await hoverProbe('.gpt-risk-marker__header-right > .issue-card-suppress');
    check('suppress hover uses the error tint instead of the generic hover', suppressHover.background === suppressHover.tokens.errorTint && suppressHover.color === suppressHover.tokens.error);
    await page.mouse.move(0, 0);
    await page.locator('.focus-tree-row').filter({ hasText: 'focus-review.js' }).first().click();
    await page.waitForTimeout(250);
    check('suppressed findings live on the gutter instead of inline cards',
      await page.locator('.focus-suppressed-marker').count() === 1 &&
      await page.locator('.gpt-risk-marker--suppressed').count() === 0 &&
      await page.locator('.focus-suppressed-holder').count() === 0);
    const suppressedMarkerState = await page.evaluate(() => {
      const marker = document.querySelector('.focus-suppressed-marker');
      return { expanded: marker?.getAttribute('aria-expanded'), label: marker?.getAttribute('aria-label') || '', title: marker?.title || '' };
    });
    check('suppressed gutter marker starts collapsed with the ignore tooltip', suppressedMarkerState.expanded === 'false' &&
      suppressedMarkerState.label.includes('已忽略') && suppressedMarkerState.label.includes('逻辑') &&
      suppressedMarkerState.label.includes('P2') && suppressedMarkerState.label.includes('点击查看，可撤销') &&
      suppressedMarkerState.title === suppressedMarkerState.label);
    const suppressedOptics = await page.evaluate(() => {
      const marker = document.querySelector('.focus-suppressed-marker');
      const svg = marker?.querySelector('svg');
      return { markerWidth: marker ? getComputedStyle(marker).width : '', svgWidth: svg ? getComputedStyle(svg).width : '', svgHeight: svg ? getComputedStyle(svg).height : '' };
    });
    check('suppressed gutter icon matches the 14px gutter box', suppressedOptics.markerWidth === '24px' &&
      suppressedOptics.svgWidth === '14px' && suppressedOptics.svgHeight === '14px');
    const fileSuppressedChip = await page.evaluate(() => {
      const chip = document.querySelector('.focus-file-suppressed-chip');
      return { text: chip?.innerText || '', expanded: chip?.getAttribute('aria-expanded') };
    });
    check('the file header exposes one aggregate suppressed chip', fileSuppressedChip.text.includes('已标记非问题 (1)') &&
      fileSuppressedChip.expanded === 'false');
    const gutterNear = page.locator('.annotation-add-btn[data-annotation-side="head"][data-annotation-line="293"]');
    const gutterTarget = await gutterNear.count() ? gutterNear.first() : page.locator('.annotation-add-btn[data-annotation-side="head"]').first();
    await gutterTarget.locator('xpath=ancestor::td').hover();
    await page.waitForTimeout(260);
    await shot('02a-gutter-alignment-light');
    await page.mouse.move(0, 0);
    await page.locator('.focus-suppressed-marker').click();
    await page.waitForTimeout(250);
    const suppressedStyles = await page.evaluate(() => {
      const marker = document.querySelector('.focus-suppressed-marker');
      const card = document.querySelector('.gpt-risk-marker--suppressed');
      if (!card) return null;
      const content = card.querySelector('.gpt-risk-marker__content');
      return {
        expanded: marker?.getAttribute('aria-expanded'),
        label: marker?.getAttribute('aria-label') || '',
        collapsed: card.classList.contains('is-collapsed'),
        chip: card.querySelector('.gpt-risk-marker__marked')?.innerText || '',
        restore: card.querySelector('.gpt-risk-marker__restore')?.innerText || '',
        copy: Boolean(card.querySelector('.gpt-risk-marker__copy-btn')),
        content: content ? getComputedStyle(content).display : '',
        holder: document.querySelectorAll('.focus-suppressed-holder').length,
      };
    });
    check('clicking the gutter marker expands the neutral ignored card', suppressedStyles && suppressedStyles.expanded === 'true' &&
      suppressedStyles.label.includes('点击收起') && suppressedStyles.collapsed && suppressedStyles.chip === '已忽略' &&
      suppressedStyles.restore === '恢复' && suppressedStyles.copy === false && suppressedStyles.content === 'none' && suppressedStyles.holder === 1);
    const restoreGeometry = await page.evaluate(() => {
      const button = document.querySelector('.gpt-risk-marker--suppressed .gpt-risk-marker__restore');
      const probe = document.createElement('span');
      document.body.append(probe);
      probe.style.color = 'var(--el-brand-link)';
      const brand = getComputedStyle(probe).color;
      probe.remove();
      const rect = button?.getBoundingClientRect();
      return { width: rect?.width || 0, height: rect?.height || 0, color: button ? getComputedStyle(button).color : '', brand };
    });
    check('restore keeps a text-sized brand button in the header', restoreGeometry.width >= 28 && restoreGeometry.height === 24 &&
      restoreGeometry.color === restoreGeometry.brand);
    await page.locator('.gpt-risk-marker--suppressed .gpt-risk-marker__restore').first().click();
    await page.waitForTimeout(150);
    check('restore asks for confirmation from the expanded ignored card', await page.locator('.gpt-risk-marker--suppressed').count() === 1 &&
      (await page.locator('.n-popconfirm').innerText()).includes('确认恢复为有效问题？'));
    await page.keyboard.press('Escape');
    await page.waitForTimeout(100);
    await page.locator('.focus-suppressed-marker').click();
    await page.waitForTimeout(200);
    const collapsedAgain = await page.evaluate(() => ({
      cards: document.querySelectorAll('.gpt-risk-marker--suppressed').length,
      holders: document.querySelectorAll('.focus-suppressed-holder').length,
      expanded: document.querySelector('.focus-suppressed-marker')?.getAttribute('aria-expanded'),
      label: document.querySelector('.focus-suppressed-marker')?.getAttribute('aria-label') || '',
    }));
    check('clicking the suppressed marker again collapses the ignored card', collapsedAgain.cards === 0 && collapsedAgain.holders === 0 &&
      collapsedAgain.expanded === 'false' && collapsedAgain.label.includes('点击查看，可撤销'));
    await page.locator('.focus-suppressed-marker').click();
    await page.waitForTimeout(200);
    await page.locator('.gpt-risk-marker--suppressed .gpt-risk-marker__marked').first().click();
    await page.waitForTimeout(120);
    check('clicking the ignored chip keeps the expanded card open', await page.locator('.gpt-risk-marker--suppressed').count() === 1 &&
      await page.locator('.focus-suppressed-marker').getAttribute('aria-expanded') === 'true');
    const resolvedTreeRow = page.locator('.focus-tree-row[data-path="prototype/src/focus-review.js"]').first();
    await page.mouse.move(0, 0);
    await page.waitForTimeout(80);
    await resolvedTreeRow.hover();
    await page.waitForTimeout(380);
    check('a file whose findings are all marked shows one check and explains it', await page.locator('.focus-tree-carried, .focus-tree-suppressed').count() === 0 &&
      (await page.locator('[role="tooltip"]').innerText()).includes('已审 · 问题已全部标记为非问题'));
    await page.locator('.focus-tree-row').filter({ hasText: 'build-data.mjs' }).first().click();
    await page.waitForTimeout(200);
    await page.evaluate(() => { CRPrototype.app.formattedDiffStyle = false; });
    await page.waitForTimeout(300);
    const narrowHeader = await page.evaluate(() => {
      const card = document.querySelector('.gpt-risk-marker:not(.gpt-risk-marker--suppressed):not(.focus-file-level-card)');
      const header = card?.querySelector('.gpt-risk-marker__header');
      return header ? {
        height: header.getBoundingClientRect().height,
        wrap: getComputedStyle(header).flexWrap,
        headerLeft: getComputedStyle(card.querySelector('.gpt-risk-marker__header-left')).flexWrap,
        width: header.getBoundingClientRect().width,
      } : null;
    });
    check('card header stays 34px and single-line in the 420px double pane ' + JSON.stringify(narrowHeader), narrowHeader && narrowHeader.height === 34 &&
      narrowHeader.wrap === 'nowrap' && narrowHeader.headerLeft === 'nowrap' && narrowHeader.width < 420);
    await page.evaluate(() => { CRPrototype.app.formattedDiffStyle = true; });
    await page.waitForTimeout(250);
    await page.locator('.focus-tree-row').filter({ hasText: 'build-data.mjs' }).first().click();
    await page.waitForTimeout(150);
    const actionSlots = await page.evaluate(() => [...document.querySelectorAll('.gpt-risk-marker__header-right > button')].slice(0, 4).map(button => {
      const rect = button.getBoundingClientRect();
      const svg = button.querySelector('svg');
      const svgRect = svg?.getBoundingClientRect();
      return { width: rect.width, height: rect.height, icon: svgRect ? Math.max(svgRect.width, svgRect.height) : 0 };
    }));
    check('finding header action slots are 24px with 16px icons', actionSlots.length > 0 && actionSlots.every(slot =>
      slot.width === 24 && slot.height === 24 && slot.icon === 16));
    check('finding cards have no duplicated severity or verified tag', await page.locator('.gpt-risk-marker .level-tag').count() === 0 &&
      await page.locator('.gpt-risk-marker .basis-tag').count() === 0 &&
      !(await page.locator('body').innerText()).includes('已验证'));
    const cardProbe = await page.evaluate(() => {
      const card = document.querySelector('.gpt-risk-marker:not(.gpt-risk-marker--suppressed)');
      const narrative = card?.querySelector('.gpt-risk-marker__narrative');
      const solution = card?.querySelector('.gpt-risk-marker__text-solution');
      const panel = card?.querySelector('.gpt-risk-marker__code-panel') || document.querySelector('.gpt-risk-marker__code-panel');
      const tokenProbe = document.createElement('div');
      tokenProbe.style.cssText = 'background: var(--el-bg-l3); color: var(--el-label-2)';
      document.body.append(tokenProbe);
      const neutralCodeBg = getComputedStyle(tokenProbe).backgroundColor;
      const neutralLabel = getComputedStyle(tokenProbe).color;
      tokenProbe.remove();
      return {
        narrative: narrative?.innerText || '',
        narrativeLabels: [...(card?.querySelectorAll('.gpt-risk-marker__narrative strong') || [])].map(node => node.textContent.trim()),
        suggestionHeadings: card ? [...card.querySelectorAll('.gpt-risk-marker__suggestion-heading,.gpt-risk-marker__code-head-left')].map(node => node.textContent.trim()) : [],
        solutionColor: solution ? getComputedStyle(solution).color : '',
        evidence: card?.querySelectorAll('.gpt-evidence-block').length || 0,
        bottomBar: card?.querySelectorAll('.issue-card-actions').length || 0,
        codePanel: Boolean(panel),
        codeBg: panel ? getComputedStyle(panel).backgroundColor : '',
        neutralCodeBg,
        neutralLabel,
      };
    });
    check('card narrative merges cause and impact without label pills', cardProbe.narrative.includes('；') &&
      cardProbe.narrativeLabels.length === 0 && cardProbe.evidence === 0 && cardProbe.bottomBar === 0);
    check('suggestions use one neutral modification heading and preserve secondary copy', cardProbe.suggestionHeadings.length === 1 && cardProbe.suggestionHeadings[0] === '修改建议' &&
      cardProbe.solutionColor === cardProbe.neutralLabel);
    const allCardBodies = (await page.locator('.gpt-risk-marker__content').allInnerTexts()).join('\n');
    check('severity is not repeated in card bodies', !/\bP[0-3]\b/.test(allCardBodies));
    check('suggestion code uses the neutral bg-l3 panel', cardProbe.codePanel && cardProbe.codeBg === cardProbe.neutralCodeBg);
    const codeToggle = await page.evaluate(() => {
      const panel = document.querySelector('.gpt-risk-marker__code-panel');
      const head = panel?.querySelector('.gpt-risk-marker__code-head');
      const body = panel?.querySelector('.gpt-risk-marker__code-body');
      if (!head || !body) return null;
      const before = !body.hidden;
      head.click();
      const collapsed = { hidden: body.hidden, expanded: head.getAttribute('aria-expanded'), classed: panel.classList.contains('is-collapsed') };
      head.click();
      return { before, collapsed, after: !body.hidden };
    });
    check('suggestion code collapses and expands from its neutral header', codeToggle && codeToggle.before &&
      codeToggle.collapsed.hidden && codeToggle.collapsed.expanded === 'false' && codeToggle.collapsed.classed && codeToggle.after);
    await page.locator('.gpt-risk-marker__code-copy').first().click();
    await page.waitForTimeout(120);
    check('copy suggestion copies the code panel body', await page.evaluate(async () => {
      const text = await navigator.clipboard.readText();
      const code = document.querySelector('.gpt-risk-marker__code-body')?.innerText.trim() || '';
      return Boolean(code) && text.trim() === code;
    }));
    await ensureOverview();
    const overviewText = await page.locator('.overview-main').innerText();
    check('overview lives in the main area with no bottom panel', (await state()).mainView === 'overview' &&
      (await state()).panelCount === 0 && (await state()).overviewCount === 1 &&
      (await state()).overviewSections.join(',') === 'overview-conclusion,overview-features,overview-alignment,overview-problems,overview-coverage,overview-requirements');
    check('overview keeps the six blocks in conclusion-first order', ['结论', '按功能的变更', '需求对齐', '问题', '审查覆盖', '需求依据'].every(text => overviewText.includes(text)) &&
      (await page.locator('.overview-section').count()) === 6 &&
      (await page.locator('.overview-inner > .overview-section, .overview-inner > details.overview-section').evaluateAll(items => items.map(item => item.id))).join(',') ===
        'overview-conclusion,overview-features,overview-alignment,overview-problems,overview-coverage,overview-requirements');
    const overviewStyles = await page.evaluate(() => {
      const style = selector => getComputedStyle(document.querySelector(selector));
      const h2 = style('.overview-head h2');
      const list = style('.overview-list');
      return {
        maxWidth: style('.overview-inner').maxWidth,
        sectionMargin: style('.overview-section').marginBottom,
        h2: [h2.fontSize, h2.lineHeight, h2.fontWeight].join(' '),
        h3: (() => { const s = style('.overview-section h3'); return [s.fontSize, s.lineHeight, s.fontWeight].join(' '); })(),
        list: [list.fontSize, list.lineHeight, list.listStyleType].join(' '),
        alignBorder: style('.align-row').borderTopWidth,
        alignBackground: style('.align-row').backgroundColor,
        featureBorder: style('.overview-feature').borderTopWidth,
        requirementsBorder: style('.overview-requirements').borderTopWidth,
        summary: (() => { const s = style('.overview-requirements > summary'); return [s.fontSize, s.lineHeight, s.fontWeight].join(' '); })(),
        statusBorder: style('#overview-conclusion .panel-status').borderLeftWidth,
        statusTitle: style('#overview-conclusion .panel-status b').color,
        statusText: (() => {
          const element = document.querySelector('#overview-conclusion .panel-status p');
          return element ? getComputedStyle(element).color : '';
        })(),
        refLink: (() => { const s = style('.overview-refs .ref-link'); return [s.color, s.backgroundColor, s.borderRadius, s.fontFamily].join('|'); })(),
        alignCopy: (() => { const s = style('.align-req'); return [s.fontSize, s.lineHeight].join(' '); })(),
        featureCopy: (() => { const s = style('.overview-feature p'); return [s.fontSize, s.lineHeight].join(' '); })(),
        reqCopy: (() => { const s = style('.req-text'); return [s.fontSize, s.lineHeight].join(' '); })(),
        summaryHeight: style('.overview-requirements > summary').height,
        featureRefLink: style('.feature-card .ref-link').backgroundColor,
      };
    });
    check('overview follows the 1080px hero and comfortable card typography spec', overviewStyles.maxWidth === '1080px' &&
      overviewStyles.sectionMargin === '24px' && overviewStyles.h2 === '17px 24px 680' && overviewStyles.h3 === '12.5px 20px 600' && overviewStyles.list === '12.5px 22px none' &&
      overviewStyles.alignBorder === '1px' && overviewStyles.featureBorder === '1px' && overviewStyles.requirementsBorder === '0px' &&
      overviewStyles.summary === '15px 24px 650' && overviewStyles.statusBorder === '3px' &&
      overviewStyles.statusTitle !== overviewStyles.statusText && overviewStyles.refLink.includes('rgb(72, 104, 178)') &&
      overviewStyles.refLink.includes('rgb(228, 237, 253)') && overviewStyles.refLink.includes('5px') &&
      /mono/i.test(overviewStyles.refLink) &&
      overviewStyles.alignCopy === '13px 22px' && overviewStyles.featureCopy === '13px 22px' &&
      overviewStyles.reqCopy === '13px 22px' && overviewStyles.summaryHeight === '24px' &&
      overviewStyles.featureRefLink === 'rgb(228, 237, 253)');
    const referenceLabels = await page.locator('.overview-main .ref-link').evaluateAll(elements => elements.map(element => ({
      text: element.innerText.trim(), title: element.title, disabled: element.disabled,
    })));
    check('overview references show file[:line], full-path titles and no disabled pseudo-buttons', referenceLabels.length > 0 &&
      referenceLabels.every(ref => ref.title.includes('/') && !ref.text.includes('/') && ref.disabled === false) &&
      referenceLabels.some(ref => /:\d+$/.test(ref.text)) && referenceLabels.some(ref => !/:\d+$/.test(ref.text)) &&
      await page.locator('.overview-main button:disabled').count() === 0);
    const realLineOneRefs = await page.evaluate(() => {
      const app = CRPrototype.app;
      const refs = [];
      const collect = list => (list || []).forEach(ref => { if (ref?.startLine === 1) refs.push(ref.path); });
      (app.understanding?.overview?.highlights || []).forEach(item => collect(item.refs));
      (app.understanding?.features || []).forEach(item => collect(item.refs));
      (app.understanding?.impacts || []).forEach(item => collect(item.refs));
      (app.understanding?.extras || []).forEach(item => collect(item.refs));
      (app.understanding?.alignment || []).forEach(item => collect(item.codeRefs));
      return [...new Set(refs)];
    });
    check('real first-line references are allowed while pseudo :1 references are rejected',
      referenceLabels.filter(ref => ref.text.endsWith(':1'))
        .every(ref => realLineOneRefs.includes(ref.title.replace(/:1$/, ''))));
    let allVisibleRefsJump = true;
    const visibleRefCount = await page.locator('.overview-main .ref-link:visible').count();
    for (let index = 0; index < visibleRefCount; index += 1) {
      const link = page.locator('.overview-main .ref-link:visible').nth(index);
      const refPath = (await link.getAttribute('title') || '').replace(/:\d+$/, '');
      await link.click();
      await page.waitForTimeout(100);
      const jumped = await state();
      if (jumped.mainView !== 'diff' || jumped.selected !== refPath) allVisibleRefsJump = false;
      await ensureOverview();
    }
    check('visible overview references all jump to the file diff', visibleRefCount > 0 && allVisibleRefsJump);
    const sideProbe = await page.evaluate(async () => {
      const app = CRPrototype.app;
      const item = app.selectedFileItem;
      const origin = app.originDiffDict[item.md5_str];
      const backup = {
        diff: origin.diff, old_path: origin.old_path, new_path: origin.new_path,
        renamed_file: origin.renamed_file, deleted_file: origin.deleted_file,
      };
      const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
      const read = () => {
        const row = document.querySelector('.diff-line-highlight-row');
        return {
          side: row?.dataset.side || null,
          text: row?.innerText || '',
          message: document.querySelector('.n-message')?.innerText || '',
        };
      };
      const jump = async (side, line = 1) => {
        await app.jumpToRef({ path: item.path, side, startLine: line });
        await wait(160);
        return read();
      };
      origin.diff = '@@ -1,1 +1,1 @@\n-oldValue\n+newValue\n';
      origin.deleted_file = false; origin.renamed_file = false;
      origin.old_path = item.path; origin.new_path = item.path;
      await wait(280);
      const single = { base: await jump('base'), head: await jump('head') };
      app.formattedDiffStyle = false;
      await wait(320);
      const double = { base: await jump('base'), head: await jump('head') };
      app.formattedDiffStyle = true;
      origin.diff = '@@ -1 +0,0 @@\n-onlyOld\n';
      origin.deleted_file = true;
      await wait(280);
      const missing = await jump('head');
      origin.deleted_file = false;
      origin.renamed_file = true;
      origin.diff = '@@ -1,1 +1,1 @@\n-oldValue\n+newValue\n';
      origin.old_path = 'prototype/src/old-name.js';
      origin.new_path = item.path;
      await wait(280);
      const renamed = await jump('head');
      Object.assign(origin, backup);
      app.formattedDiffStyle = true;
      await wait(280);
      return { single, double, missing, renamed };
    });
    check('single-pane references honor base/head sides',
      sideProbe.single.base.side === 'left' && sideProbe.single.base.text.includes('oldValue') &&
      sideProbe.single.head.side === 'right' && sideProbe.single.head.text.includes('newValue'));
    check('double-pane references honor base/head sides',
      sideProbe.double.base.side === 'left' && sideProbe.double.base.text.includes('oldValue') &&
      sideProbe.double.head.side === 'right' && sideProbe.double.head.text.includes('newValue'));
    check('a missing side reports cannot-locate and never falls back to the other side',
      sideProbe.missing.side === null && sideProbe.missing.message.includes('无法定位'));
    check('renamed files still locate the requested head-side line',
      sideProbe.renamed.side === 'right' && sideProbe.renamed.text.includes('newValue'));
    await ensureOverview();
    check('overview lists are unordered', await page.locator('.overview-main ol').count() === 0 &&
      await page.locator('.overview-changes, .overview-list').count() >= 5);
    check('conclusion lists at most five changes from the same feature list', await page.locator('.overview-changes > li').count() <= 5 &&
      await page.locator('.overview-changes > li').count() > 0 &&
      await page.evaluate(() => {
        const app = CRPrototype.app;
        const rows = [...document.querySelectorAll('.overview-changes .overview-change')].map(node => node.textContent.trim());
        const first = document.querySelector('.overview-change');
        const titleColor = getComputedStyle(first.querySelector('.overview-change__title')).color;
        const descColor = getComputedStyle(first.querySelector('.overview-change__desc')).color;
        const countColor = getComputedStyle(first.querySelector('.overview-change__count')).color;
        return rows.length === Math.min(5, app.allFeatures.length) && rows.every((text, index) =>
          text.startsWith(app.allFeatures[index].title + '：') && /（\d+ 个文件）$/.test(text) && !/。\s*（/.test(text)) &&
          titleColor === 'rgb(72, 104, 178)' && descColor !== titleColor && countColor !== titleColor && countColor !== descColor;
      }));
    check('alignment lists pending first and folds implemented', await page.locator('.align-group').count() === 2 &&
      await page.locator('.align-row').count() >= 5 &&
      (await page.locator('.align-group').first().innerText()).includes('未对齐 / 待确认') &&
      await page.locator('.overview-requirements').evaluate(details => !details.open) &&
      await page.locator('.overview-details').filter({ hasText: '已对齐' }).evaluate(details => !details.open));
    check('basis tags live on section titles only', await page.locator('.overview-head .basis-tag').count() >= 2 &&
      await page.locator('.feature-card .basis-tag').count() === 0 &&
      await page.locator('.impact-list .basis-tag').count() === 0 &&
      await page.locator('.align-row .basis-tag').count() === 0);
    check('behavior impacts are model inference and stay under features', await page.evaluate(() =>
      CRPrototype.app.allImpacts.every(impact => impact.basis === 'model')) &&
      await page.locator('.impact-list li').count() > 0 &&
      await page.locator('#overview-features .impact-list').count() >= 1 &&
      await page.locator('#overview-conclusion .impact-list, #overview-alignment .impact-list').count() === 0);
    check('basis tags stay in section titles and requirements remain last', await page.locator('.basis-legend').count() === 0 &&
      await page.locator('.overview-main .basis-tag').count() === await page.locator('.overview-head .basis-tag').count() &&
      await page.locator('.overview-inner > .overview-section').last().getAttribute('id') === 'overview-requirements');
    const uiCompleteness = await page.evaluate(() => {
      const app = CRPrototype.app;
      const item = app.normalizedDiffItems.find(entry => entry.reviewStatus === 'reviewed');
      const raw = app.diffDict[item.md5_str];
      const previousStatus = raw.reviewStatus;
      raw.reviewStatus = 'failed';
      const failed = { complete: app.reviewCompleteNow, reason: app.incompleteReasonNow };
      raw.reviewStatus = previousStatus;
      const original = app.coverage.reviewed;
      const cases = {};
      const probe = (name, reviewed) => {
        app.coverage = { ...app.coverage, reviewed };
        cases[name] = app.reviewCompleteNow;
      };
      probe('empty', []);
      probe('missing', original.slice(1));
      probe('duplicate', [...original, original[0]]);
      probe('outside', [...original, 'outside/path.js']);
      app.coverage = { ...app.coverage, reviewed: original };
      return { failed, cases };
    });
    check('UI completeness rejects failed files and inconsistent coverage.reviewed',
      uiCompleteness.failed.complete === false && uiCompleteness.failed.reason.includes('审查失败') &&
      Object.values(uiCompleteness.cases).every(value => value === false));
    const targetForgery = await page.evaluate(() => {
      const app = CRPrototype.app;
      const results = {};
      const item = app.normalizedDiffItems.find(entry => entry.reviewStatus === 'reviewed');
      const raw = app.diffDict[item.md5_str];
      const previousStatus = raw.reviewStatus;
      const previousCoverage = JSON.parse(JSON.stringify(app.coverage));
      const previousKeys = Object.keys(app.diffDict);
      const targetsBeforeDiff = CRPrototype.coverage.reviewTargetsOf(app.snapshot);
      try {
        raw.reviewStatus = 'skipped';
        app.coverage = { ...app.coverage, reviewed: app.coverage.reviewed.filter(path => path !== item.path) };
        results.statusForgery = app.reviewCompleteNow;

        raw.reviewStatus = 'metadata';
        results.metadataForgery = app.reviewCompleteNow;

        raw.reviewStatus = previousStatus;
        app.coverage = JSON.parse(JSON.stringify(previousCoverage));
        const removedKey = item.md5_str;
        const removedPath = item.path;
        const removedOrigin = app.originDiffDict[removedKey];
        delete app.originDiffDict[removedKey];
        delete app.diffDict[removedKey];
        app.coverage = { ...app.coverage, reviewed: app.coverage.reviewed.filter(path => path !== removedPath) };
        results.removedTarget = app.reviewCompleteNow;
        app.originDiffDict[removedKey] = removedOrigin;
        app.diffDict[removedKey] = raw;
        const targetFile = app.snapshot.files.find(file => file.path === removedPath);
        const savedDiff = targetFile?.diff;
        if (targetFile) targetFile.diff = '';
        results.diffBlindTargets = app.reviewTargets.includes(removedPath) &&
          app.reviewTargets.length === targetsBeforeDiff.length;
        if (targetFile) targetFile.diff = savedDiff;
        const metadataSnapshot = { files: [
          { path: 'renamed-same.js', change: 'renamed', kind: 'text', baseSha256: 'same', headSha256: 'same' },
          { path: 'renamed-different.js', change: 'renamed', kind: 'text', baseSha256: 'old', headSha256: 'new' },
          { path: 'mode-only.js', change: 'mode-changed', kind: 'text', baseSha256: 'x', headSha256: 'x' },
        ] };
        results.metadataTargets = CRPrototype.coverage.reviewTargetsOf(metadataSnapshot);
      } finally {
        raw.reviewStatus = previousStatus;
        app.coverage = previousCoverage;
        if (Object.keys(app.diffDict).length !== previousKeys.length) {
          app.originDiffDict[item.md5_str] = app.originDiffDict[item.md5_str] || app.files.find(file => file.md5_str === item.md5_str)?.origin;
          app.diffDict[item.md5_str] = app.diffDict[item.md5_str] || app.files.find(file => file.md5_str === item.md5_str);
        }
      }
      const zero = CRPrototype.createScenario('zero');
      const exportTarget = zero.files.find(file => file.reviewStatus === 'reviewed');
      const targets = CRPrototype.coverage.reviewTargetsOf(zero.snapshot);
      const contextStatus = CRPrototype.exports.buildExportContext(zero);
      contextStatus.coverage = {
        ...contextStatus.coverage,
        reviewed: contextStatus.coverage.reviewed.filter(path => path !== exportTarget.path),
      };
      contextStatus.files.find(file => file.path === exportTarget.path).reviewStatus = 'skipped';
      const statusReview = CRPrototype.exports.exportReview(contextStatus);
      const statusMarkdown = CRPrototype.exports.buildMarkdown(contextStatus);
      const statusHtml = CRPrototype.exports.buildHtml(contextStatus).html;

      const contextRemoved = CRPrototype.exports.buildExportContext(CRPrototype.createScenario('zero'));
      contextRemoved.files = contextRemoved.files.filter(file => file.path !== exportTarget.path);
      contextRemoved.coverage = {
        ...contextRemoved.coverage,
        reviewed: contextRemoved.coverage.reviewed.filter(path => path !== exportTarget.path),
      };
      const removedReview = CRPrototype.exports.exportReview(contextRemoved);
      const removedMarkdown = CRPrototype.exports.buildMarkdown(contextRemoved);
      const removedHtml = CRPrototype.exports.buildHtml(contextRemoved).html;
      return {
        ...results,
        targetCount: targets.length,
        reviewedCount: zero.coverage.reviewed.length,
        exportStatus: { complete: statusReview.complete, markdown: statusMarkdown, html: statusHtml },
        exportRemoved: { complete: removedReview.complete, markdown: removedMarkdown, html: removedHtml },
      };
    });
    check('completeness targets come from the frozen snapshot, not display status',
      targetForgery.statusForgery === false && targetForgery.metadataForgery === false &&
      targetForgery.removedTarget === false && targetForgery.targetCount === targetForgery.reviewedCount);
    check('targets ignore display diff and metadata-only renames', targetForgery.diffBlindTargets === true &&
      targetForgery.metadataTargets.length === 1 && targetForgery.metadataTargets[0] === 'renamed-different.js');
    check('both exports reject skipped/metadata target forgery',
      targetForgery.exportStatus.complete === false &&
      !targetForgery.exportStatus.markdown.includes('本次未发现问题') &&
      !targetForgery.exportStatus.html.includes('本次未发现问题'));
    check('both exports reject a deleted target even when coverage shrinks with it',
      targetForgery.exportRemoved.complete === false &&
      !targetForgery.exportRemoved.markdown.includes('本次未发现问题') &&
      !targetForgery.exportRemoved.html.includes('本次未发现问题'));
    check('requirements are listed and the block is folded by default', await page.locator('.req-card').count() === data.requirements.length &&
      await page.locator('.overview-requirements').evaluate(details => !details.open));
    check('feature files show a count and stay folded', await page.locator('.feature-card details').count() === data.featureRefs.length &&
      await page.locator('.feature-card details').evaluateAll(details => details.every(item => !item.open)) &&
      (await page.locator('.feature-card details summary').allInnerTexts()).every(text => /^文件 \d+ 个$/.test(text.trim())));
    const problemHeadings = await page.locator('#overview-problems .overview-problem-group h3').allInnerTexts();
    check('problems are grouped by severity', problemHeadings.length === 3 &&
      problemHeadings[0].includes('阻断') && problemHeadings[1].includes('严重') && problemHeadings[2].includes('一般'));
    check('overview problem cards mark new and carried findings', await page.evaluate(() =>
      [...document.querySelectorAll('.overview-problem')].length > 0 &&
      [...document.querySelectorAll('.overview-problem')].every(card =>
        /^(本次更新|沿用上版)$/.test(card.querySelector('.overview-delta-badge')?.textContent.trim() || ''))));
    const coverageSummary = await page.locator('#overview-coverage > .overview-muted').first().innerText();
    check('coverage summarizes reviewed, skipped and failed files', coverageSummary.includes(`已审 ${data.reviewable}`) &&
      coverageSummary.includes(`跳过 ${data.files - data.reviewable}`) && coverageSummary.includes('失败 0') &&
      await page.locator('#overview-coverage details').filter({ hasText: '跳过' }).evaluate(details => !details.open));
    await page.locator('#overview-coverage details').filter({ hasText: '跳过' }).locator('summary').click();
    await page.waitForTimeout(100);
    check('coverage skipped files list their reasons', await page.locator('.coverage-row').count() === data.files - data.reviewable &&
      (await page.locator('.coverage-row .coverage-reason').allInnerTexts()).every(text => text.trim().length > 0));
    const firstProblem = page.locator('.overview-problem').first();
    const firstProblemKey = await firstProblem.getAttribute('data-issue-key');
    const firstProblemTitle = await firstProblem.locator('.overview-problem__title-text').innerText();
    const firstProblemPath = await firstProblem.locator('.overview-file-path').getAttribute('title');
    await firstProblem.scrollIntoViewIfNeeded();
    await page.waitForTimeout(120);
    await shot('01b-overview-problems-light');
    await firstProblem.locator('.overview-file-path').hover();
    await page.waitForTimeout(260);
    check('overview file path reveals the jump hint on hover', (await firstProblem.locator('.overview-file-path__hint').innerText()).trim() === '↗ 跳转文件' &&
      await firstProblem.locator('.overview-file-path__hint').evaluate(node => getComputedStyle(node).opacity) === '1');
    await shot('01c-overview-file-hover-light');
    await firstProblem.locator('.overview-problem__title').hover();
    await page.waitForTimeout(260);
    const problemHint = await page.evaluate(key => {
      const issue = CRPrototype.app.activeFindingsList.find(entry => entry.issueKey === key);
      const hint = document.querySelector('.overview-problem[data-issue-key="' + CSS.escape(key) + '"] .overview-problem__jump');
      return { line: issue?.lineNumber || 0, text: hint?.textContent.trim() || '', opacity: hint ? getComputedStyle(hint).opacity : '' };
    }, firstProblemKey);
    check('overview problem title reveals only the jump arrow on hover', problemHint.line > 0 &&
      problemHint.text === '↗' && problemHint.opacity === '1');
    await shot('01d-overview-problem-hover-light');
    await firstProblem.locator('.overview-problem__title').click();
    await page.waitForTimeout(320);
    const locatedProblem = await page.evaluate(({ key, title }) => {
      const issue = CRPrototype.app.activeFindingsList.find(entry => entry.issueKey === key);
      const card = [...document.querySelectorAll('.gpt-risk-marker')].find(node =>
        node.querySelector('.gpt-risk-marker__title')?.textContent.trim() === title);
      const body = card?.closest('.code-review-lite__body');
      const bodyRect = body?.getBoundingClientRect(), cardRect = card?.getBoundingClientRect();
      const highlight = document.querySelector('.diff-line-highlight-row');
      return {
        mainView: CRPrototype.app.mainView,
        selected: CRPrototype.app.selectedFileItem?.path || '',
        pulse: Boolean(card?.classList.contains('card-highlight-pulse')),
        collapsed: Boolean(card?.classList.contains('is-collapsed')),
        expectedLine: String(issue?.lineNumber || ''),
        highlightLine: highlight?.dataset.line || '',
        cardInView: Boolean(bodyRect && cardRect && cardRect.top >= bodyRect.top - 2 && cardRect.top < bodyRect.bottom - 8),
      };
    }, { key: firstProblemKey, title: firstProblemTitle });
    check('clicking a problem jumps to its file, line and expanded pulsing card', locatedProblem.mainView === 'diff' &&
      locatedProblem.selected === firstProblemPath && locatedProblem.pulse && locatedProblem.collapsed === false &&
      locatedProblem.expectedLine && locatedProblem.highlightLine === locatedProblem.expectedLine && locatedProblem.cardInView);
    await ensureOverview();
    const pathJump = page.locator('.overview-problem .overview-file-path').first();
    const pathJumpPath = await pathJump.getAttribute('title');
    await page.evaluate(() => { CRPrototype.app.fileFilterMode = 'pending'; });
    await pathJump.click();
    await page.waitForTimeout(620);
    check('clicking an overview file path clears a hiding filter and opens the file top', await page.evaluate(path => {
      const app = CRPrototype.app;
      const body = document.querySelector('.code-review-lite__body');
      return app.mainView === 'diff' && app.selectedFileItem?.path === path && app.fileFilterMode === 'all' &&
        !document.querySelector('.diff-line-highlight-row, .focus-defect-highlight') &&
        (body?.scrollTop || 0) <= 2;
    }, pathJumpPath));
    await ensureOverview();
    const pendingProblem = page.locator('.overview-problem').first();
    const pendingProblemKey = await pendingProblem.getAttribute('data-issue-key');
    await page.evaluate(() => { CRPrototype.app.fileFilterMode = 'pending'; });
    await pendingProblem.locator('.overview-problem__title').click();
    await page.waitForTimeout(360);
    check('problem jump reveals the target tree row under a hiding filter', await page.evaluate(key => {
      const app = CRPrototype.app;
      const issue = app.activeFindingsList.find(entry => entry.issueKey === key);
      const path = issue ? app.issuePath(issue) : '';
      const row = [...document.querySelectorAll('.focus-tree-row')].find(entry => entry.dataset.path === path);
      return app.fileFilterMode === 'all' && app.selectedFileItem.path === path && Boolean(row?.classList.contains('is-selected'));
    }, pendingProblemKey));
    await ensureOverview();
    await open({ scenario: 'reviewed', opt: 'none' });
    await ensureOverview();
    const offProblem = page.locator('.overview-problem').first();
    const offProblemKey = await offProblem.getAttribute('data-issue-key');
    await offProblem.locator('.overview-problem__title').click();
    await page.waitForTimeout(360);
    check('overview problem jump still opens the card when line links are off', await page.evaluate(key => {
      const card = document.querySelector(`.gpt-risk-marker[data-issue-key="${CSS.escape(key)}"]`);
      return CRPrototype.app.mainView === 'diff' && Boolean(card) && !card.classList.contains('is-collapsed') &&
        card.classList.contains('card-highlight-pulse') && CRPrototype.ui.message.includes('当前模式未启用行号定位');
    }, offProblemKey));
    await open({ scenario: 'reviewed' });
    await ensureOverview();
    check('add requirement is enabled on current snapshot', await page.locator('.req-add').isEnabled());
    await shot('01-reviewed-overview');
    await page.locator('.overview-changes .overview-change').first().click();
    await page.waitForTimeout(400);
    const scrolledChange = await page.evaluate(() => {
      const target = document.querySelector('.overview-section--target');
      return {
        id: target?.id || '',
        top: target?.getBoundingClientRect().top ?? -1,
        viewport: window.innerHeight,
      };
    });
    check('a conclusion change scrolls to its feature block', (await state()).mainView === 'overview' &&
      /^feature-/.test(scrolledChange.id) && scrolledChange.top >= 0 && scrolledChange.top < scrolledChange.viewport);
    await ensureOverview();
    const firstOverviewRef = page.locator('.overview-main .ref-link').first();
    const firstOverviewRefPath = (await firstOverviewRef.getAttribute('title') || '').replace(/:\d+$/, '');
    await firstOverviewRef.click();
    await page.waitForTimeout(150);
    check('an overview file reference switches to the file diff', (await state()).mainView === 'diff' &&
      (await state()).selected === firstOverviewRefPath);
    await ensureOverview();
    await page.locator('.focus-tree-row').filter({ hasText: 'build-data.mjs' }).first().click();
    await page.waitForTimeout(150);
    check('clicking a file from the overview switches to its diff', (await state()).mainView === 'diff' &&
      (await state()).selected === 'prototype/scripts/build-data.mjs');
    await page.locator('.review-toggle-btn').filter({ hasText: '查看说明' }).first().click();
    await page.waitForTimeout(150);
    s = await state();
    check('file explanation opens as the only panel', s.panelMode === 'file' && s.panelCount === 1 && s.mainView === 'diff');
    check('file panel uses the current-file title without the type chip', await page.locator('.review-panel__title h2').count() === 1 &&
      (await page.locator('.review-panel__title h2').innerText()) === '当前文件说明' &&
      await page.locator('.review-panel__kind').count() === 0 &&
      await page.locator('.symbol-row').count() === 0 && s.semanticItems > 0);
    check('file panel uses summary then code review', (await page.locator('.file-panel').innerText()).includes('变更摘要') &&
      (await page.locator('.file-panel').innerText()).includes('代码评审') &&
      await page.locator('.semantic-item').count() === s.semanticItems &&
      await page.locator('.file-panel .basis-tag').count() === 0);
    check('file panel code review is one line per finding', s.selectedIssues > 0 &&
      await page.locator('.finding-line').count() === s.selectedIssues &&
      await page.locator('.file-panel .evidence-box').count() === 0 &&
      await page.locator('.file-panel .finding-desc').count() === 0 &&
      await page.locator('.file-panel .finding-jump').count() === 0);
    const findingLineLabels = (await page.locator('.finding-line').allInnerTexts()).map(text => text.replace(/\s+/g, ' ').trim());
    check('file panel finding lines show severity and title only', findingLineLabels.length > 0 &&
      findingLineLabels.every(text => /^P[012] · (阻断|严重|一般).+/.test(text)) &&
      await page.locator('.finding-line .level-tag').count() === 0 &&
      await page.locator('.finding-line .basis-tag').count() === 0);
    const findingTitleStyle = await page.evaluate(() => {
      const style = getComputedStyle(document.querySelector('.finding-line__title'));
      return [style.whiteSpace, style.overflow, style.textOverflow].join('|');
    });
    check('finding titles stay on one line with an ellipsis', findingTitleStyle === 'nowrap|hidden|ellipsis');
    const filePanelText = await page.locator('.file-panel').innerText();
    check('no validation data or disabled explanation buttons remain', await page.locator('.trace-info').count() === 0 &&
      !filePanelText.includes('sha256') && !filePanelText.includes('追溯信息') &&
      await page.locator('.semantic-item[disabled]').count() === 0);
    const uiText = await page.evaluate(() => {
      const clone = document.body.cloneNode(true);
      clone.querySelectorAll('.d2h-wrapper,pre,code,.sendback-content,.extension-preview').forEach(node => node.remove());
      return clone.innerText;
    });
    const uiAttributes = await page.evaluate(() => [...document.querySelectorAll('[title]')].map(element => element.title).join('\n'));
    const realSnapshotId = await page.evaluate(() => CRPrototype.app.snapshot.snapshotId);
    check('interface text omits hashes, snapshot ids and validation labels', !/sha-?256/i.test(uiText) &&
      !uiText.includes('追溯信息') && !/inputsha/i.test(uiText) && !/promptversion/i.test(uiText) &&
      !/snap-[0-9a-f]{8,}/i.test(uiText) && !/snap-[0-9a-f]{8,}/i.test(uiAttributes) &&
      !uiText.includes(realSnapshotId) && !uiAttributes.includes(realSnapshotId) &&
      !/sha-?256/i.test(uiAttributes));
    const firstFindingLine = page.locator('button.finding-line').first();
    const firstFindingTitle = (await firstFindingLine.innerText()).replace(/^P[012] · (阻断|严重|一般)/, '').trim();
    await firstFindingLine.click();
    await page.waitForTimeout(450);
    check('clicking a finding line locates its problem card', (await state()).mainView === 'diff' &&
      (await state()).selected === 'prototype/scripts/build-data.mjs' &&
      await page.locator('.gpt-risk-marker__title').filter({ hasText: firstFindingTitle }).count() > 0 &&
      await page.locator('.diff-line-highlight-row, .focus-defect-highlight').count() > 0);
    check('locating a finding keeps its slim card in the diff viewport', await page.evaluate(title => {
      const card = [...document.querySelectorAll('.gpt-risk-marker')].find(node =>
        node.querySelector('.gpt-risk-marker__title')?.textContent.trim() === title);
      const body = card?.closest('.code-review-lite__body');
      if (!card || !body) return false;
      const bodyRect = body.getBoundingClientRect();
      const rect = card.getBoundingClientRect();
      return card.querySelector('.gpt-evidence-block') === null &&
        rect.top >= bodyRect.top - 2 && rect.top < bodyRect.bottom - 8;
    }, firstFindingTitle));
    await shot('02-reviewed-file-panel');
    await page.locator('.focus-tree-row').filter({ hasText: 'focus-review.js' }).first().click();
    await page.waitForTimeout(150);
    check('suppressed findings are plain lines without a dead locate button', await page.locator('.finding-line--static').count() === 1 &&
      await page.locator('.finding-line--static .suppressed-chip').innerText() === '已标记非问题' &&
      await page.locator('.file-panel button.finding-line').count() === 0);
    const lightContrast = await contrastSamples();
    assertReadable('light mode', lightContrast);
    check('light mode uses the light highlight theme', lightContrast.darkClass === false && lightContrast.darkTheme === 'not all' &&
      lightContrast.lightTheme === 'all');
    await ensureOverview();
    check('toolbar returns to the main overview', (await state()).mainView === 'overview' && (await state()).panelCount === 0);
    await page.locator('.focus-tree-row').filter({ hasText: 'build-data.mjs' }).first().click();
    await page.waitForTimeout(120);
    await page.locator('.code-review-lite__file-name').click();
    await page.waitForTimeout(80);
    check('file name link records open-in-editor intent', await page.evaluate(() =>
      CRPrototype.openedLinks?.length === 1 && CRPrototype.openedLinks[0].action === 'open-in-editor'));
    check('file name link shows a local message', (await page.locator('.n-message').innerText()).includes('模拟在编辑器中打开'));
    check('file name link has no external href', await page.locator('.code-review-lite__file-name').getAttribute('href') === null);

    await page.getByRole('button', { name: '导出与发回', exact: true }).click();
    await page.waitForTimeout(100);
    const exportItems = await page.locator('.export-menu .wb-menu-item').allInnerTexts();
    check('export menu has two exports, two send-back templates and re-review', exportItems.length === 5 &&
      exportItems.some(text => text.includes('变更日志（Markdown）')) &&
      exportItems.some(text => text.includes('评审报告（HTML）')) &&
      exportItems.some(text => text.includes('修改问题')) &&
      exportItems.some(text => text.includes('补充说明')) &&
      exportItems.some(text => text.includes('全部重新审查')));
    check('export menu has embedded-diff checkbox', await page.locator('.export-menu .wb-menu-check input[type="checkbox"]').count() === 1);
    const menuLineHeights = await page.evaluate(() => {
      const menu = document.querySelector('.export-menu');
      const title = menu?.querySelector('.wb-menu-item b');
      return {
        menu: parseFloat(getComputedStyle(menu).lineHeight),
        item: parseFloat(getComputedStyle(title).lineHeight),
      };
    });
    check('export menu rows keep a readable line height', menuLineHeights.menu > 8 && menuLineHeights.item > 8);
    check('export menu does not show a tooltip', await page.locator('[role="tooltip"]').count() === 0);
    await page.getByRole('button', { name: '导出与发回', exact: true }).hover();
    await page.waitForTimeout(500);
    check('an open export menu suppresses the export tooltip', await page.locator('[role="tooltip"]').count() === 0);
    await shot('03-export-menu');
    const [mdDownload] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('menuitem', { name: /变更日志（Markdown）/ }).click(),
    ]);
    const markdown = fs.readFileSync(await mdDownload.path(), 'utf8');
    check('markdown export has all required sections', ['# 变更日志', '## 需求依据', '## 变更概览', '## 按功能变更',
      '## 文件清单', '## 行为影响', '## 未对齐 / 待确认', '## 问题与处置', '## 与上次审查相比', '## 局限']
      .every(text => markdown.includes(text)) && markdown.includes('安全 · P0'));
    check('markdown export has no development-status wording', !markdown.includes(PROTOTYPE_WORD) && !markdown.includes(UNCOMPUTED_WORD) &&
      markdown.includes('## 与上次审查相比') && !markdown.includes('这是该交付的第一份审查记录。'));
    await page.getByRole('button', { name: '导出与发回', exact: true }).click();
    const [htmlDownload, preview] = await Promise.all([
      page.waitForEvent('download'),
      page.waitForEvent('popup'),
      page.getByRole('menuitem', { name: /评审报告（HTML）/ }).click(),
    ]);
    const html = fs.readFileSync(await htmlDownload.path(), 'utf8');
    check('html export is self-contained and offline', html.includes('Content-Security-Policy') &&
      html.includes('application/json') && html.includes('nonce=') &&
      !/<script[^>]+src=/i.test(html) && !/<link[^>]+href=/i.test(html));
    check('html export has all report sections', ['需求依据', '变更概览', '按功能变更', '文件清单', '行为影响',
      '未对齐 / 待确认', '问题与处置', '局限', '省略清单'].every(text => html.includes(text)));
    check('html export has no development-status wording and uses the brand header', !html.includes(PROTOTYPE_WORD) &&
      !html.includes(UNCOMPUTED_WORD) && html.includes('#4176e6'));
    check('visible exports keep snapshot ids out of the report body', !/snap-[0-9a-f]{8,}/i.test(markdown) &&
      !/snap-[0-9a-f]{8,}/i.test(html.replace(/<script type="application\/json"[\s\S]*?<\/script>/g, '')));
    check('html report uses inline light/dark app icons', html.includes('report-icon report-icon--light') &&
      html.includes('report-icon report-icon--dark') && html.includes('#7aaaff') &&
      html.includes('viewBox="0 0 512 512"') && !html.includes('viewBox="0 0 120 120"') &&
      !/<img[^>]+evidentloop/i.test(html) && !/<image[^>]+href=/i.test(html));
    const reportPage = await context.newPage();
    await reportPage.setContent(html);
    await reportPage.emulateMedia({ colorScheme: 'dark' });
    const reportIconDisplay = await reportPage.evaluate(() => ({
      light: getComputedStyle(document.querySelector('.report-icon--light')).display,
      dark: getComputedStyle(document.querySelector('.report-icon--dark')).display,
    }));
    await reportPage.close();
    check('report tile icons follow the system theme', reportIconDisplay.light === 'none' && reportIconDisplay.dark !== 'none');
    check('export masks secret-like text', await page.evaluate(() =>
      CRPrototype.exports.maskSecrets('token=supersecretvalue') === 'token=***'));
    const omittedSection = (html.match(/<h2 id="report-omissions">省略清单（\d+ 项）<\/h2>([\s\S]*?)<\/section>/) || [])[1] || '';
    check('html export includes omitted list and preview', omittedSection.includes('vendor') && preview.url().startsWith('blob:'));
    await preview.close();
    check('export menu closes after an export', await page.locator('.export-menu').count() === 0);
    await page.getByRole('button', { name: '导出与发回', exact: true }).click();
    await page.locator('.export-menu .wb-menu-check input[type="checkbox"]').check({ force: true });
    await page.waitForTimeout(80);
    const [embedDownload, embedPreview] = await Promise.all([
      page.waitForEvent('download'), page.waitForEvent('popup'),
      page.getByRole('menuitem', { name: /评审报告（HTML）/ }).click(),
    ]);
    const embeddedHtml = fs.readFileSync(await embedDownload.path(), 'utf8');
    check('embedded diff option changes the HTML report', embeddedHtml.length > html.length && embeddedHtml.includes('评审报告'));
    await embedPreview.close();

    const embedded = parseEmbeddedData(html);
    check('html embedded data block parses and carries review status', embedded.snapshot?.snapshotId &&
      embedded.review?.complete === true && embedded.coverage && embedded.files.length > 0);

    const linkProbe = await page.evaluate(() => {
      delete globalThis.__AUDIT_LINK__;
      const finding = {
        title: '链接审计样例', impact: '', evidence: [],
        problem: '[打开](javascript:globalThis.__AUDIT_LINK__=1) [安全](https://example.com/a) [锚点](#section) [数据](data:text/html,<b>x</b>)',
      };
      const rendered = CRPrototype.convertToMarkdown(CRPrototype.issues.renderFinding(finding));
      const host = document.createElement('div');
      host.addEventListener('click', event => event.preventDefault(), true);
      host.innerHTML = rendered;
      document.body.append(host);
      const anchors = [...host.querySelectorAll('a')].map(anchor => anchor.getAttribute('href'));
      [...host.querySelectorAll('a')].forEach(anchor => anchor.click());
      const sentinel = globalThis.__AUDIT_LINK__;
      host.remove();
      return { anchors, sentinel };
    });
    check('problem markdown strips executable links and keeps safe protocols', linkProbe.sentinel === undefined &&
      !linkProbe.anchors.some(href => /^(?:javascript|data):/i.test(href || '')) &&
      linkProbe.anchors.some(href => href === 'https://example.com/a') && linkProbe.anchors.includes('#section'));

    const exportProbe = await page.evaluate(() => {
      const context = CRPrototype.exports.buildExportContext(CRPrototype.app);
      context.requirements = [...(context.requirements || []), {
        reqId: 'req-audit-export', kind: 'paste', origin: '审计样例',
        capturedAt: '2026-11-07T00:00:00+08:00', sha256: 'audit', order: 99, items: [],
        text: 'const token="AUDIT_SENTINEL_123456";\n{"token": "AUDIT_SENTINEL_123456"}\n</script><img src=x onerror=alert(1)>',
      }];
      const target = context.files.find(file => (file.findings || []).length) || context.files[0];
      target.findings = [...(target.findings || []), {
        findingId: 'f-audit-export', runId: 'run-audit', category: 'logic', severity: 'P2',
        ruleSource: { kind: 'builtin', id: 'audit' }, title: '导出审计样例',
        problem: '[打开](javascript:globalThis.__AUDIT_LINK__=1)', impact: '影响',
        suggestion: { text: '建议' }, anchor: { path: target.path, side: 'head', line: null }, evidence: [],
      }];
      const markdown = CRPrototype.exports.buildMarkdown(context);
      const htmlText = CRPrototype.exports.buildHtml(context).html;
      return { markdown, htmlText };
    });
    const exportPayload = parseEmbeddedData(exportProbe.htmlText);
    const secretForms = await page.evaluate(() => ({
      quoted: CRPrototype.exports.maskSecrets('{"token": "AUDIT_SENTINEL_123456"}'),
      bearer: CRPrototype.exports.maskSecrets('Authorization: Bearer AUDIT_SENTINEL_123456'),
      array: CRPrototype.exports.maskSecrets('{"secret": ["AUDIT_SENTINEL_123456"]}'),
      prose: CRPrototype.exports.maskSecrets('Token: 过期处理'),
      structured: CRPrototype.exports.maskDeep({ token: 'AUDIT_SENTINEL_123456', nested: { secret: ['AUDIT_SENTINEL_123456'] } }),
    }));
    check('export masks field values before serialization and keeps JSON parseable',
      !exportProbe.markdown.includes('AUDIT_SENTINEL_123456') && !exportProbe.htmlText.includes('AUDIT_SENTINEL_123456') &&
      !JSON.stringify(exportPayload).includes('AUDIT_SENTINEL_123456') &&
      exportProbe.markdown.includes('token="***"') && exportProbe.htmlText.includes('token=&quot;***&quot;') &&
      exportProbe.markdown.includes('"token": "***"') &&
      !exportProbe.htmlText.includes('<img src=x') &&
      exportPayload.requirements.some(source => source.text.includes('</script><img')));
    check('masking covers quoted keys, bearer values, arrays and structured field names',
      !secretForms.quoted.includes('AUDIT_SENTINEL_123456') && !secretForms.bearer.includes('AUDIT_SENTINEL_123456') &&
      !secretForms.bearer.includes('*** ***') && !secretForms.array.includes('AUDIT_SENTINEL_123456') &&
      secretForms.prose === 'Token: 过期处理' &&
      !JSON.stringify(secretForms.structured).includes('AUDIT_SENTINEL_123456') &&
      secretForms.structured.token === '***' && secretForms.structured.nested.secret[0] === '***');

    const incompleteExports = await page.evaluate(() => ['unreviewed', 'running', 'cancelled', 'failed', 'incomplete'].map(name => {
      const scenario = CRPrototype.createScenario(name);
      const context = CRPrototype.exports.buildExportContext(scenario);
      context.delivery = scenario.deliveries?.[0] || {};
      return { name, markdown: CRPrototype.exports.buildMarkdown(context), html: CRPrototype.exports.buildHtml(context).html };
    }));
    for (const sample of incompleteExports) {
      check('incomplete export never claims no findings: ' + sample.name,
        !sample.markdown.includes('本次未发现问题') && !sample.html.includes('本次未发现问题') &&
        sample.markdown.includes('- 审查结论：') && sample.html.includes('审查结论：') &&
        !sample.markdown.includes('审查不完整') && !sample.html.includes('审查不完整'));
    }
    const exportByName = Object.fromEntries(incompleteExports.map(sample => [sample.name, sample]));
    const conclusionOf = markdown => (markdown.match(/^- 审查结论：(.*)$/m) || [])[1] || '';
    check('incomplete export names the run or coverage reason',
      conclusionOf(exportByName.unreviewed.markdown) === '待审' &&
      conclusionOf(exportByName.running.markdown) === '—' &&
      /^不完整（\d+ 个文件待审）$/.test(conclusionOf(exportByName.cancelled.markdown)) &&
      conclusionOf(exportByName.failed.markdown) === '审查失败' &&
      conclusionOf(exportByName.incomplete.markdown) === '发现 7 个问题；不完整（3 条结论未通过校验）');

    const completenessProbes = await page.evaluate(() => {
      const base = CRPrototype.exports.buildExportContext(CRPrototype.app);
      const withheldContext = JSON.parse(JSON.stringify(base));
      withheldContext.coverage = { reviewed: [], skipped: [], failed: [], withheld: [] };
      const target = withheldContext.files.find(file => file.reviewStatus === 'reviewed') || withheldContext.files[0];
      target.withheld = [{ findingId: 'w-audit', kind: 'finding', code: 'evidence-sha-mismatch' }];
      const withheldReview = CRPrototype.exports.exportReview(withheldContext);
      const failedContext = JSON.parse(JSON.stringify(base));
      failedContext.files[0].reviewStatus = 'failed';
      const failedReview = CRPrototype.exports.exportReview(failedContext);
      return {
        withheldComplete: withheldReview.complete, withheldReason: withheldReview.reason,
        failedComplete: failedReview.complete, failedReason: failedReview.reason,
      };
    });
    check('file-level withheld and failed statuses make the export incomplete',
      !completenessProbes.withheldComplete && completenessProbes.withheldReason.includes('未通过校验') &&
      !completenessProbes.failedComplete && completenessProbes.failedReason.includes('审查失败'));

    const coverageProbes = await page.evaluate(() => {
      const base = CRPrototype.exports.buildExportContext(CRPrototype.app);
      const cases = [];
      const mutate = (name, change) => {
        const context = JSON.parse(JSON.stringify(base));
        change(context);
        const review = CRPrototype.exports.exportReview(context);
        cases.push({
          name, complete: review.complete, reason: review.reason,
          markdown: CRPrototype.exports.buildMarkdown(context),
          html: CRPrototype.exports.buildHtml(context).html,
        });
      };
      mutate('empty', context => { context.coverage.reviewed = []; });
      mutate('missing', context => { context.coverage.reviewed = context.coverage.reviewed.slice(1); });
      mutate('duplicate', context => { context.coverage.reviewed = [...context.coverage.reviewed, context.coverage.reviewed[0]]; });
      mutate('outside', context => { context.coverage.reviewed = [...context.coverage.reviewed, 'outside/path.js']; });
      return cases;
    });
    for (const probe of coverageProbes) {
      check('coverage ' + probe.name + ' is incomplete with a reason', probe.complete === false &&
        probe.reason.includes('审查覆盖记录不完整') && !probe.markdown.includes('本次未发现问题') &&
        !probe.html.includes('本次未发现问题'));
    }

    const sizeProbe = await page.evaluate(() => {
      const context = CRPrototype.exports.buildExportContext(CRPrototype.app);
      context.requirements = [...(context.requirements || []), {
        reqId: 'req-audit-size', kind: 'paste', origin: '压力样例',
        capturedAt: '2026-11-07T00:00:00+08:00', sha256: 'size', order: 98, items: [],
        text: '审'.repeat(2 * 1024 * 1024),
      }];
      const result = CRPrototype.exports.buildHtml(context, { embedDiff: true });
      return {
        bytes: CRPrototype.exports.byteLength(result.html),
        limit: CRPrototype.exports.MAX_HTML_BYTES,
        omitted: result.omitted,
      };
    });
    check('html export enforces the 3 MiB UTF-8 budget with omitted reasons',
      sizeProbe.bytes <= sizeProbe.limit && sizeProbe.omitted.some(item => item.reason.includes('64 KiB')));

    const totalCapProbe = await page.evaluate(() => {
      const context = CRPrototype.exports.buildExportContext(CRPrototype.app);
      context.delivery = { ...(context.delivery || {}), purpose: '密'.repeat(2 * 1024 * 1024) };
      context.requirements = Array.from({ length: 60 }, (_, index) => ({
        reqId: 'req-cap-' + index, kind: 'paste', origin: '压力样例',
        capturedAt: '2026-11-07T00:00:00+08:00', sha256: 'cap-' + index, order: index, items: [],
        text: '审'.repeat(30000),
      }));
      const result = CRPrototype.exports.buildHtml(context);
      return {
        html: result.html,
        bytes: CRPrototype.exports.byteLength(result.html),
        limit: CRPrototype.exports.MAX_HTML_BYTES,
        hasOverflowReason: result.omitted.some(item => item.reason.includes('已省略正文')),
      };
    });
    const totalCapPayload = parseEmbeddedData(totalCapProbe.html);
    check('total HTML cap falls back with an accurate omission reason',
      totalCapProbe.bytes <= totalCapProbe.limit && totalCapProbe.hasOverflowReason &&
      Boolean(totalCapPayload.review) && Boolean(totalCapPayload.snapshot?.snapshotId));

    await page.getByRole('button', { name: '工作区设置', exact: true }).click();
    await page.waitForTimeout(100);
    const settingRows = await page.locator('.settings-menu .wb-setting-row').allInnerTexts();
    check('gear has four workspace settings', settingRows.length === 4 &&
      ['自动审查', '目标分支', '扩展提示词', 'HTML报告导出'].every(label => settingRows.some(text => text.includes(label))) &&
      !settingRows.some(text => text.includes('需求编号')));
    check('auto-mode description uses the approved wording', settingRows.some(text => text.includes('agent 每轮结束、代码有改动时自动审查')));
    const settingLine = await page.evaluate(() => parseFloat(getComputedStyle(document.querySelector('.settings-menu .wb-setting-row b')).lineHeight));
    check('settings form rows keep a readable line height', settingLine > 8);
    const autoSwitch = page.locator('.settings-menu .wb-setting-row input[type="checkbox"]').first();
    const autoBefore = (await state()).autoMode;
    if (autoBefore) await autoSwitch.uncheck(); else await autoSwitch.check();
    await page.waitForTimeout(100);
    check('auto mode toggles from gear', (await state()).autoMode === !autoBefore);
    await shot('04-settings-menu');
    if (autoBefore) await autoSwitch.check(); else await autoSwitch.uncheck();
    await page.keyboard.press('Escape');

    if ((await state()).counts.risk > 0) {
      await filterByMode('risk');
      s = await state();
      check('risk filter matches risk count', s.fileFilterMode === 'risk' && s.displayed === s.counts.risk);
      await shot('05-filter-risk');
    }
    await filterByMode('all');

    const activeBefore = (await state()).active;
    const suppressedBefore = (await state()).suppressed;
    const markerButton = page.locator('.gpt-risk-marker:not(.gpt-risk-marker--suppressed) .file-risk-item__suppress-btn').first();
    if (await markerButton.count()) {
      await markerButton.click();
      await page.waitForTimeout(150);
      check('marking opens the approved confirmation', (await page.locator('.n-popconfirm').innerText()).includes('确认标记为非问题？'));
      await page.locator('.n-popconfirm .n-button').filter({ hasText: '标记' }).click();
      await page.waitForTimeout(400);
      s = await state();
      check('confirmed mark changes counts', s.active === activeBefore - 1 &&
        s.suppressed === suppressedBefore + 1 && await page.locator('.n-popconfirm').count() === 0);
      const ignoredMarker = page.locator('.focus-suppressed-marker').first();
      if (await ignoredMarker.count()) {
        await ignoredMarker.click();
        await page.waitForTimeout(150);
        const restoreButton = page.locator('.gpt-risk-marker--suppressed .file-risk-item__suppress-btn').first();
        await restoreButton.click();
        await page.waitForTimeout(150);
        check('restore opens the approved confirmation', (await page.locator('.n-popconfirm').innerText()).includes('确认恢复为有效问题？'));
        await page.locator('.n-popconfirm .n-button').filter({ hasText: '恢复' }).click();
        await page.waitForTimeout(400);
        s = await state();
        check('confirmed restore returns the count', s.active === activeBefore && s.suppressed === suppressedBefore);
      }
    }


    await page.locator('.focus-tree-row').filter({ hasText: 'build-data.mjs' }).first().click();
    await page.waitForTimeout(120);
    if (!(await state()).panelMode) {
      await page.locator('.review-toggle-btn').filter({ hasText: '查看说明' }).first().click();
      await page.waitForTimeout(120);
    }
    const layout = await page.evaluate(() => {
      const style = selector => { const element = document.querySelector(selector); return element ? getComputedStyle(element) : null; };
      const rect = selector => document.querySelector(selector)?.getBoundingClientRect();
      return {
        pageScroll: [document.documentElement.scrollHeight, document.documentElement.clientHeight],
        surfaceBorder: style('.review-surface')?.borderTopWidth || '',
        surfaceHeight: rect('.review-surface')?.height || 0,
        surfaceBg: style('.review-surface')?.backgroundColor || '',
        fileBg: style('.focus-file-browser')?.backgroundColor || '',
        diffBg: style('.diff-container')?.backgroundColor || '',
        splitterWidth: rect('.review-surface .splitpanes--vertical > .splitpanes__splitter')?.width || 0,
        horizontalSplitterHeight: rect('.review-surface .splitpanes--horizontal > .splitpanes__splitter')?.height || 0,
        panelBorder: style('.review-panel')?.borderTopWidth || '',
        treeOverflow: style('.focus-tree-navigation')?.overflowY || '',
        diffOverflow: style('.code-review-lite__body')?.overflowY || '',
        panelOverflow: style('.review-panel__body')?.overflowY || '',
      };
    });
    check('review is full-page without the card shell', layout.surfaceBorder === '0px' && layout.surfaceHeight > 600 &&
      layout.surfaceBg === 'rgb(255, 255, 255)' && layout.fileBg === 'rgb(255, 255, 255)' && layout.diffBg === 'rgb(255, 255, 255)');
    check('panels use a 1px divider and no page scroll', layout.splitterWidth === 1 && layout.horizontalSplitterHeight <= 1 &&
      layout.panelBorder === '1px' && layout.pageScroll[0] === layout.pageScroll[1]);
    check('tree, diff and panel are the only scroll regions', layout.treeOverflow === 'auto' &&
      layout.diffOverflow === 'auto' && layout.panelOverflow === 'auto');
    check('fullscreen control is removed', await page.locator('[aria-label="全屏"]').count() === 0 &&
      await page.locator('.dsh-app--fullscreen').count() === 0);
    await page.getByRole('button', { name: '关闭说明' }).click();

    check('diff style toggle is a 32px icon button with action tooltips', await page.locator('.wb-split-toggle').getAttribute('aria-label') === '切换为双栏' &&
      await page.locator('.wb-split-toggle').evaluate(button => button.getBoundingClientRect().width === 32 && button.getBoundingClientRect().height === 32));
    await page.locator('.wb-split-toggle').click();
    await page.waitForTimeout(200);
    check('diff style toggles to side-by-side', await page.locator('.code-review-lite--side-by-side').count() === 1 &&
      await page.locator('.wb-split-toggle').getAttribute('aria-label') === '切换为单栏');
    await page.locator('.wb-split-toggle').click();
    await page.waitForTimeout(200);
    check('diff style returns to line-by-line', await page.locator('.code-review-lite--line-by-line').count() === 1 &&
      await page.locator('.wb-split-toggle').getAttribute('aria-label') === '切换为双栏');
    const fileBeforeNext = (await state()).selected;
    await page.getByRole('button', { name: '下一个文件' }).click();
    await page.waitForTimeout(150);
    check('next-file navigation changes selection', (await state()).selected !== fileBeforeNext);
    await page.getByRole('button', { name: '上一个文件' }).click();
    await page.waitForTimeout(150);
    check('previous-file navigation returns', (await state()).selected === fileBeforeNext);

    await page.locator('.file-search-input input').fill('dsh-shell');
    await page.waitForTimeout(150);
    check('file search filters the tree', (await state()).displayed === 1);
    await page.getByRole('button', { name: '清空搜索' }).click();
    await page.waitForTimeout(120);
    check('clearing search restores the list', (await state()).displayed === (await state()).counts.total);
    const excludedRow = page.locator('.focus-tree-row').filter({ hasText: 'LICENSES.txt' }).first();
    if (await excludedRow.count()) {
      await excludedRow.click();
      await page.waitForTimeout(150);
      check('excluded file shows a local reason instead of a diff', (await page.locator('.experience-diff-empty').innerText()).includes('第三方依赖目录') &&
        await page.locator('.gpt-risk-marker').count() === 0);
    }
    await page.getByRole('button', { name: '导出与发回', exact: true }).click();
    await page.locator('.export-menu .wb-menu-item--danger').click();
    await page.waitForTimeout(200);
    s = await state();
    check('re-review resets every reviewable file and starts a run', s.runStatus === 'running' &&
      s.pending === data.reviewable && s.active === 0);
    await page.locator('.run-state__action').click();
    await page.waitForTimeout(120);

    // ---------- disposition truth ----------
    await open({ scenario: 'reviewed' });
    await page.locator('.focus-tree-row').filter({ hasText: 'focus-review.js' }).first().click();
    await page.waitForTimeout(250);
    const seedMark = await page.evaluate(() => {
      const app = CRPrototype.app;
      const issue = app.selectedIssues.find(entry => entry.suppressed);
      return { id: issue.issueKey, title: issue.title, active: app.activeFindingCount, latest: app.currentDelivery.latest.validFindingCount };
    });
    await page.locator('.focus-suppressed-marker').click();
    await page.waitForTimeout(150);
    await page.locator(`.gpt-risk-marker[data-issue-key="${seedMark.id}"] .gpt-risk-marker__restore`).click();
    await page.waitForTimeout(80);
    await page.locator('.n-popconfirm .n-button').filter({ hasText: '恢复' }).click();
    await page.waitForTimeout(450);
    const restoredMark = await page.evaluate(({ id, title }) => {
      const app = CRPrototype.app;
      const context = app.exportContext();
      const markdown = CRPrototype.exports.buildMarkdown(context);
      const html = CRPrototype.exports.buildHtml(context).html;
      const draft = app.buildSendBackContent();
      const record = app.currentDelivery.records?.[app.snapshot.snapshotId];
      const finding = (record?.findings || []).find(entry => entry.findingId === id);
      const mark = (record?.marks || []).find(entry => entry.findingId === id);
      const uiMark = (app.marks || []).find(entry => entry.findingId === id);
      const override = Object.values(app.diffDict).map(item => item.issue_overrides?.[id]).find(Boolean);
      const exportFinding = context.files.flatMap(file => file.findings).find(entry => entry.findingId === id);
      const mdSlice = markdown.slice(Math.max(0, markdown.indexOf(title) - 80), markdown.indexOf(title) + 220);
      return {
        active: app.activeFindingCount,
        latest: app.currentDelivery.latest.validFindingCount,
        exportActive: context.files.flatMap(file => file.findings).filter(entry => !entry.suppressed).length,
        exportSuppressed: exportFinding?.suppressed,
        recordSuppressed: finding?.suppressed,
        markSuppressed: mark?.suppressed,
        mdPending: mdSlice.includes('待处理问题') && !mdSlice.includes('已标记为非问题'),
        htmlHasTitle: html.includes(title),
        draftHasTitle: draft.includes(title),
        markBy: mark?.by || '', markAt: mark?.at || '',
        uiMarkBy: uiMark?.by || '', uiMarkAt: uiMark?.at || '',
        overrideBy: override?.updatedBy || '', overrideAt: override?.updatedAt || '',
      };
    }, { id: seedMark.id, title: seedMark.title });
    check('restoring a seed mark is the single truth across UI, list, exports and draft', restoredMark.active === seedMark.active + 1 &&
      restoredMark.latest === seedMark.active + 1 && restoredMark.exportActive === seedMark.active + 1 &&
      restoredMark.exportSuppressed === false && restoredMark.recordSuppressed === false && restoredMark.markSuppressed === false &&
      restoredMark.mdPending && restoredMark.htmlHasTitle && restoredMark.draftHasTitle &&
      restoredMark.markBy !== '' && restoredMark.markAt !== '' &&
      restoredMark.markBy === restoredMark.uiMarkBy && restoredMark.markAt === restoredMark.uiMarkAt &&
      restoredMark.markBy === restoredMark.overrideBy && restoredMark.markAt === restoredMark.overrideAt);

    await page.locator('.focus-tree-row').filter({ hasText: 'build-data.mjs' }).first().click();
    await page.waitForTimeout(200);
    const markTarget = await page.evaluate(() => {
      const app = CRPrototype.app;
      const issue = app.selectedIssues.find(entry => !entry.suppressed && entry.lineNumber > 0);
      return { id: issue.issueKey, title: issue.title, active: app.activeFindingCount, latest: app.currentDelivery.latest.validFindingCount };
    });
    await page.locator(`.gpt-risk-marker[data-issue-key="${markTarget.id}"] .file-risk-item__suppress-btn`).click();
    await page.waitForTimeout(80);
    await page.locator('.n-popconfirm .n-button').filter({ hasText: '标记' }).click();
    await page.waitForTimeout(450);
    const markedTruth = await page.evaluate(({ id, title }) => {
      const app = CRPrototype.app;
      const context = app.exportContext();
      const markdown = CRPrototype.exports.buildMarkdown(context);
      const html = CRPrototype.exports.buildHtml(context).html;
      const draft = app.buildSendBackContent();
      const exportFinding = context.files.flatMap(file => file.findings).find(entry => entry.findingId === id);
      const record = app.currentDelivery.records?.[app.snapshot.snapshotId];
      const mark = (record?.marks || []).find(entry => entry.findingId === id);
      const uiMark = (app.marks || []).find(entry => entry.findingId === id);
      const override = Object.values(app.diffDict).map(item => item.issue_overrides?.[id]).find(Boolean);
      const mdSlice = markdown.slice(Math.max(0, markdown.indexOf(title) - 80), markdown.indexOf(title) + 220);
      return {
        active: app.activeFindingCount,
        latest: app.currentDelivery.latest.validFindingCount,
        exportActive: context.files.flatMap(file => file.findings).filter(entry => !entry.suppressed).length,
        exportSuppressed: exportFinding?.suppressed,
        mdSuppressed: mdSlice.includes('已标记为非问题'),
        htmlHasTitle: html.includes(title),
        draftHasTitle: draft.includes(title),
        markBy: mark?.by || '', markAt: mark?.at || '',
        uiMarkBy: uiMark?.by || '', uiMarkAt: uiMark?.at || '',
        overrideBy: override?.updatedBy || '', overrideAt: override?.updatedAt || '',
      };
    }, { id: markTarget.id, title: markTarget.title });
    check('marking one finding updates every consumer from one projection', markedTruth.active === markTarget.active - 1 &&
      markedTruth.latest === markTarget.active - 1 && markedTruth.exportActive === markTarget.active - 1 &&
      markedTruth.exportSuppressed === true && markedTruth.mdSuppressed && markedTruth.htmlHasTitle && markedTruth.draftHasTitle === false &&
      markedTruth.markBy !== '' && markedTruth.markAt !== '' &&
      markedTruth.markBy === markedTruth.uiMarkBy && markedTruth.markAt === markedTruth.uiMarkAt &&
      markedTruth.markBy === markedTruth.overrideBy && markedTruth.markAt === markedTruth.overrideAt);
    await page.evaluate(() => {
      const app = CRPrototype.app;
      const delivery = app.currentDelivery;
      const older = delivery.snapshots.find(entry => entry.snapshotId !== delivery.latestSnapshotId);
      app.openDeliverySnapshot(delivery, older);
    });
    await page.waitForTimeout(300);
    await page.evaluate(() => CRPrototype.app.openLatest());
    await page.waitForTimeout(300);
    check('the mark survives switching to another record and back', await page.evaluate(({ id }) => {
      const app = CRPrototype.app;
      const issue = Object.values(app.issueItemsByFile).flat().find(entry => entry.issueKey === id);
      return Boolean(issue?.suppressed) && app.currentDelivery.latest.validFindingCount === app.activeFindingCount;
    }, { id: markTarget.id }));
    check('mark operator and time survive a record switch', await page.evaluate(({ seed, target }) => {
      const record = CRPrototype.app.currentDelivery.records?.[CRPrototype.app.snapshot.snapshotId];
      const pick = id => (record?.marks || []).find(entry => entry.findingId === id) || {};
      const seedMark = pick(seed.id), targetMark = pick(target.id);
      return seedMark.by === seed.by && seedMark.at === seed.at &&
        targetMark.by === target.by && targetMark.at === target.at;
    }, {
      seed: { id: seedMark.id, by: restoredMark.markBy, at: restoredMark.markAt },
      target: { id: markTarget.id, by: markedTruth.markBy, at: markedTruth.markAt },
    }));
    const beforeForce = await page.evaluate(() => ({
      runId: CRPrototype.app.run?.runId || '', endedAt: CRPrototype.app.run?.endedAt || '',
      active: CRPrototype.app.activeFindingCount,
    }));
    await page.getByRole('button', { name: '导出与发回', exact: true }).click();
    await page.locator('.export-menu .wb-menu-item--danger').click();
    await page.waitForFunction(() => window.CRPrototype.app.run?.status === 'succeeded', null, { timeout: 40000 });
    await page.waitForTimeout(300);
    const forcedDispositions = await page.evaluate(({ seed, target }) => {
      const app = CRPrototype.app;
      const record = app.currentDelivery.records?.[app.snapshot.snapshotId];
      const pick = id => (record?.marks || []).find(entry => entry.findingId === id) || {};
      const ui = id => (app.marks || []).find(entry => entry.findingId === id) || {};
      const issue = id => Object.values(app.issueItemsByFile).flat().find(entry => entry.issueKey === id) || {};
      const exported = id => app.exportContext().files.flatMap(file => file.findings).find(entry => entry.findingId === id) || {};
      const override = id => Object.values(app.diffDict).map(file => file.issue_overrides?.[id]).find(Boolean) || {};
      const draft = app.buildSendBackContent();
      return {
        seed: pick(seed.id), target: pick(target.id),
        uiSeed: ui(seed.id), uiTarget: ui(target.id),
        issueSeed: issue(seed.id), issueTarget: issue(target.id),
        exportSeed: exported(seed.id), exportTarget: exported(target.id),
        overrideTarget: override(target.id),
        active: app.activeFindingCount,
        runId: app.run?.runId || '', endedAt: app.run?.endedAt || '', scope: app.run?.scope || '',
        draftHasSeed: draft.includes(seed.title), draftHasTarget: draft.includes(target.title),
      };
    }, {
      seed: { id: seedMark.id, title: seedMark.title, by: restoredMark.markBy, at: restoredMark.markAt },
      target: { id: markTarget.id, title: markTarget.title, by: markedTruth.markBy, at: markedTruth.markAt },
    });
    check('a completed forced re-review keeps dispositions and their single by/at', forcedDispositions.runId !== beforeForce.runId &&
      forcedDispositions.scope === 'all' && forcedDispositions.endedAt !== beforeForce.endedAt &&
      forcedDispositions.active === markedTruth.active &&
      forcedDispositions.seed.by === restoredMark.markBy &&
      forcedDispositions.seed.at === restoredMark.markAt && forcedDispositions.seed.suppressed === false &&
      forcedDispositions.target.by === markedTruth.markBy && forcedDispositions.target.at === markedTruth.markAt &&
      forcedDispositions.target.suppressed === true &&
      forcedDispositions.uiSeed.by === restoredMark.markBy && forcedDispositions.uiTarget.by === markedTruth.markBy &&
      forcedDispositions.issueSeed.suppressed === false && forcedDispositions.issueTarget.suppressed === true &&
      forcedDispositions.exportSeed.suppressed === false && forcedDispositions.exportTarget.suppressed === true &&
      forcedDispositions.overrideTarget.updatedBy === markedTruth.markBy &&
      forcedDispositions.overrideTarget.updatedAt === markedTruth.markAt &&
      forcedDispositions.draftHasSeed && !forcedDispositions.draftHasTarget);

    await page.locator('.focus-tree-row[data-path="prototype/index.html"]').first().click();
    await page.waitForTimeout(180);
    const riskTarget = await page.evaluate(() => {
      const app = CRPrototype.app;
      const issue = app.selectedIssues.find(entry => !entry.suppressed && entry.lineNumber > 0);
      return { id: issue.issueKey, active: app.activeFindingCount, risk: app.riskAdjustedCount.risk, fileKey: issue.fileKey };
    });
    await page.locator(`.gpt-risk-marker[data-issue-key="${riskTarget.id}"] .file-risk-item__suppress-btn`).click();
    await page.waitForTimeout(80);
    await page.locator('.n-popconfirm .n-button').filter({ hasText: '标记' }).click();
    await page.waitForTimeout(450);
    check('marking the last issue of a file removes it from risk files', await page.evaluate(({ id, active, risk, fileKey }) => {
      const app = CRPrototype.app;
      return app.activeFindingCount === active - 1 && app.riskAdjustedCount.risk === risk - 1 &&
        app.hasRiskFlag(app.diffDict[fileKey]) === false;
    }, riskTarget));

    }
    markStep('annotation data layer');
    // ---------- annotation data layer ----------
    if (scoped('reviewed', 'zero', 'extension-changed', 'partial')) {
    await open({ scenario: 'reviewed' });
    const derivedCapture = await page.evaluate(() => {
      const app = CRPrototype.app;
      const mainDeliveryId = app.currentDeliveryId;
      const mainSnapshotId = app.snapshot.snapshotId;
      const canonical = {
        active: app.activeFindingCount,
        suppressed: app.suppressedCount,
        latest: app.currentDelivery.latest.validFindingCount,
        withheld: app.withheldCount,
        complete: app.reviewCompleteNow,
      };
      app.applyConsoleScenario('zero');
      const zero = { active: app.activeFindingCount, scenario: app.scenario };
      app.openList();
      app.setView('review');
      const afterViewSwitch = app.scenario;
      app.openList();
      app.openDelivery(app.deliveries.find(delivery => delivery.deliveryId === mainDeliveryId));
      const data = window.CR_PROTOTYPE_DATA;
      data.withheldFindings.push({ kind: 'finding', findingId: 'withheld-own', code: 'missing-ref', snapshotId: mainSnapshotId });
      const keptWithheld = app.recordDataFor(app.currentDelivery, mainSnapshotId)
        .withheldFindings.filter(entry => entry.findingId === 'withheld-own').length;
      data.withheldFindings.pop();
      const frozenWithheld = data.withheldFindings.filter(entry => entry.snapshotId === mainSnapshotId).length;
      return {
        zero,
        afterViewSwitch,
        keptWithheld,
        canonical,
        frozenWithheld,
        reopened: {
          scenario: app.scenario,
          active: app.activeFindingCount,
          suppressed: app.suppressedCount,
          latest: app.currentDelivery.latest.validFindingCount,
          withheld: app.withheldCount,
          complete: app.reviewCompleteNow,
          recordsHasDerived: Boolean(app.currentDelivery?.records?.[mainSnapshotId]),
        },
      };
    });
    check('leaving a derived demo scenario restores the frozen record counts',
      derivedCapture.zero.scenario === 'zero' && derivedCapture.zero.active === 0 &&
      derivedCapture.afterViewSwitch === 'zero' &&
      derivedCapture.reopened.scenario !== 'zero' &&
      derivedCapture.reopened.active === derivedCapture.canonical.active &&
      derivedCapture.reopened.suppressed === derivedCapture.canonical.suppressed &&
      derivedCapture.reopened.latest === derivedCapture.canonical.latest &&
      derivedCapture.reopened.withheld === derivedCapture.frozenWithheld &&
      derivedCapture.reopened.complete === (derivedCapture.frozenWithheld === 0) &&
      derivedCapture.keptWithheld === 1 &&
      derivedCapture.reopened.recordsHasDerived === false);

    const precedenceGuard = await page.evaluate(() => {
      const app = CRPrototype.app;
      const data = window.CR_PROTOTYPE_DATA;
      const delivery = app.currentDelivery;
      const snapshotId = app.snapshot.snapshotId;
      const seedMark = (data.marks || [])[0] || null;
      const capturedMark = { findingId: 'captured-only', snapshotId, suppressed: true, by: '捕获', at: data.snapshot.createdAt };
      const poisoned = {
        snapshot: { ...JSON.parse(JSON.stringify(data.snapshot)), requirements: [], files: [] },
        understanding: data.understanding,
        run: data.run,
        findings: [{ findingId: 'captured-only', severity: 'P2', title: '捕获记录', anchor: { path: 'x', side: 'head', line: 1 } }],
        withheldFindings: [],
        coverage: data.run?.coverage || null,
      };
      delivery.records = delivery.records || {};
      const resolve = marks => {
        delivery.records[snapshotId] = { ...poisoned, marks };
        return app.recordDataFor(delivery, snapshotId);
      };
      const resolved = resolve([capturedMark]);
      const flipped = seedMark ? resolve([capturedMark, { ...seedMark, suppressed: !seedMark.suppressed }]) : null;
      delete delivery.records[snapshotId];
      return {
        canonicalFindings: data.findings.length,
        canonicalFiles: data.snapshot.files.length,
        canonicalRequirements: data.snapshot.requirements.length,
        poisonedFindings: poisoned.findings.length,
        poisonedRun: poisoned.run?.status || null,
        poisonedCoverageReviewed: poisoned.coverage?.reviewed?.length ?? -1,
        resolvedFindings: resolved.findings.length,
        resolvedRun: resolved.run?.status || null,
        resolvedCoverageReviewed: resolved.coverage?.reviewed?.length ?? -1,
        resolvedFiles: resolved.snapshot.files.length,
        resolvedRequirements: resolved.snapshot.requirements.length,
        resolvedSnapshot: resolved.snapshot.snapshotId === snapshotId,
        captureCarried: resolved.marks.some(mark => mark.findingId === 'captured-only'),
        seedKept: !seedMark || resolved.marks.some(mark => mark.findingId === seedMark.findingId),
        flipApplied: !seedMark || Boolean(flipped.marks.find(mark => mark.findingId === seedMark.findingId)?.suppressed) === !Boolean(seedMark.suppressed),
      };
    });
    check('record reads keep the frozen snapshot and restore captured run, coverage and marks',
      precedenceGuard.canonicalFindings > 0 && precedenceGuard.resolvedFindings === precedenceGuard.poisonedFindings &&
      precedenceGuard.resolvedRun === precedenceGuard.poisonedRun &&
      precedenceGuard.resolvedCoverageReviewed === precedenceGuard.poisonedCoverageReviewed &&
      precedenceGuard.resolvedFiles === precedenceGuard.canonicalFiles &&
      precedenceGuard.resolvedRequirements === precedenceGuard.canonicalRequirements &&
      precedenceGuard.resolvedSnapshot && precedenceGuard.captureCarried &&
      precedenceGuard.seedKept && precedenceGuard.flipApplied);

    const markFallback = await page.evaluate(() => {
      const app = CRPrototype.app;
      const data = window.CR_PROTOTYPE_DATA;
      const record = app.recordDataFor(app.currentDelivery, app.snapshot.snapshotId);
      const findings = JSON.parse(JSON.stringify(record.findings.map(finding => ({ ...finding, suppressed: false }))));
      const target = findings.find(finding => finding.anchor && finding.findingId);
      target.suppressed = true;
      const scenario = CRPrototype.createRecordScenario({ ...record, findings, marks: [] });
      const suppressed = scenario.files.flatMap(file => file.findings || []).filter(finding => finding.suppressed);
      const sample = data.findings.find(finding => !finding.suppressed);
      sample.suppressed = true;
      const built = CRPrototype.createScenario('reviewed');
      const kept = built.files.flatMap(file => file.findings || []).some(finding =>
        finding.findingId === sample.findingId && finding.suppressed);
      delete sample.suppressed;
      return { count: suppressed.length, sameId: suppressed[0]?.findingId === target.findingId, kept };
    });
    check('a review record keeps a suppressed finding even without a mark entry',
      markFallback.count === 1 && markFallback.sameId && markFallback.kept);

    const runtimeSnapshot = await page.evaluate(async () => {
      const app = CRPrototype.app;
      const delivery = app.currentDelivery;
      const suppressedTotal = () => app.normalizedDiffItems.reduce((sum, item) => {
        const raw = app.diffDict[item.md5_str];
        return sum + [...(raw?.findings || []), ...(raw?.pendingFindings || [])].filter(finding => finding.suppressed).length;
      }, 0);
      const suppressedBefore = suppressedTotal();
      const beforeRequirements = app.snapshot.requirements.length;
      const beforeFindings = app.normalizedDiffItems.reduce((sum, item) => {
        const raw = app.diffDict[item.md5_str];
        return sum + (raw?.findings || []).length + (raw?.pendingFindings || []).length;
      }, 0);
      app.openRequirementDialog();
      app.requirementDialog.text = '需求：运行时新增的依据必须保留。';
      app.requirementDialog.kind = 'paste';
      app.confirmRequirement();
      const createdId = app.snapshot.snapshotId;
      app.openDelivery(delivery, delivery.snapshots.find(entry => entry.snapshotId !== createdId));
      const older = app.snapshot.snapshotId;
      app.openDelivery(delivery, delivery.snapshots.find(entry => entry.snapshotId === createdId));
      const reopenedPending = app.normalizedDiffItems.reduce((sum, item) =>
        sum + (app.diffDict[item.md5_str]?.pendingFindings || []).length, 0);
      return {
        createdId,
        older,
        suppressedBefore,
        reopenedSuppressed: suppressedTotal(),
        beforeFindings,
        reopenedPending,
        reopened: app.snapshot.snapshotId === createdId,
        requirements: app.snapshot.requirements.length,
        expectedRequirements: beforeRequirements + 1,
        captured: Boolean(delivery.records?.[createdId]),
      };
    });
    check('a runtime snapshot created from a record reopens after switching records',
      runtimeSnapshot.reopened && runtimeSnapshot.captured && runtimeSnapshot.older !== runtimeSnapshot.createdId &&
      runtimeSnapshot.requirements === runtimeSnapshot.expectedRequirements &&
      runtimeSnapshot.beforeFindings > 0 && runtimeSnapshot.reopenedPending === runtimeSnapshot.beforeFindings &&
      runtimeSnapshot.suppressedBefore > 0 && runtimeSnapshot.reopenedSuppressed === runtimeSnapshot.suppressedBefore);

    await open({ scenario: 'zero' });
    const derivedRequirement = await page.evaluate(() => {
      const app = CRPrototype.app;
      const delivery = app.currentDelivery;
      const canonical = app.recordDataFor(delivery, delivery.latestSnapshotId);
      const suppressedIds = new Set((canonical.marks || []).filter(mark => mark.suppressed).map(mark => mark.findingId));
      const canonicalActive = canonical.findings.filter(finding => !suppressedIds.has(finding.findingId)).length;
      const beforeRequirements = canonical.snapshot.requirements.length;
      app.openRequirementDialog();
      app.requirementDialog.text = '需求：从派生预览新增的依据必须基于冻结记录。';
      app.requirementDialog.kind = 'paste';
      app.confirmRequirement();
      const createdId = app.snapshot.snapshotId;
      const previousEntry = delivery.snapshots.find(entry => entry.snapshotId !== createdId && entry.findingCount !== undefined);
      const pendingAfterAdd = app.normalizedDiffItems.reduce((sum, item) =>
        sum + (app.diffDict[item.md5_str]?.pendingFindings || []).length, 0);
      app.openDelivery(delivery, delivery.snapshots.find(entry => entry.snapshotId !== createdId));
      app.openDelivery(delivery, delivery.snapshots.find(entry => entry.snapshotId === createdId));
      const reopenedPending = app.normalizedDiffItems.reduce((sum, item) =>
        sum + (app.diffDict[item.md5_str]?.pendingFindings || []).length, 0);
      return {
        canonicalActive,
        beforeRequirements,
        createdId,
        previousCount: previousEntry?.findingCount,
        pendingAfterAdd,
        canonicalFindings: canonical.findings.length,
        reopenedPending,
        reopened: app.snapshot.snapshotId === createdId,
        captured: Boolean(delivery.records?.[createdId]),
        requirements: app.snapshot.requirements.length,
        latest: delivery.latestSnapshotId === createdId,
      };
    });
    check('adding a requirement from a derived preview starts from the frozen record',
      derivedRequirement.previousCount === derivedRequirement.canonicalActive &&
      derivedRequirement.pendingAfterAdd === derivedRequirement.canonicalFindings &&
      derivedRequirement.reopened && derivedRequirement.captured &&
      derivedRequirement.reopenedPending === derivedRequirement.canonicalFindings &&
      derivedRequirement.requirements === derivedRequirement.beforeRequirements + 1 &&
      derivedRequirement.latest);

    await open({ scenario: 'extension-changed' });
    const keptExtension = await page.evaluate(() => {
      const app = CRPrototype.app;
      const before = app.extensionPrompt;
      const frozen = app.snapshot.extensionPrompt?.text || '';
      app.openRequirementDialog();
      app.requirementDialog.text = '需求：扩展提示词必须保留。';
      app.requirementDialog.kind = 'paste';
      app.confirmRequirement();
      return {
        before,
        frozen,
        after: app.extensionPrompt,
        requirements: app.snapshot.requirements.length,
        created: app.snapshot.snapshotId,
      };
    });
    check('adding a requirement keeps the workspace extension prompt',
      keptExtension.before.length > 0 && keptExtension.before !== keptExtension.frozen &&
      keptExtension.after === keptExtension.before && keptExtension.requirements > 0);

    await open({ scenario: 'reviewed' });
    const runningRequirement = await page.evaluate(() => {
      const app = CRPrototype.app;
      const results = [];
      for (const status of ['running', 'queued']) {
        const before = { snapshot: app.snapshot.snapshotId, requirements: app.snapshot.requirements.length };
        app.run = { ...app.run, status };
        app.openRequirementDialog();
        app.requirementDialog.text = '运行中不应添加需求。';
        app.requirementDialog.kind = 'paste';
        app.confirmRequirement();
        results.push({
          status,
          snapshot: app.snapshot.snapshotId,
          requirements: app.snapshot.requirements.length,
          run: app.run?.status,
          message: CRPrototype.ui.message,
          before,
        });
      }
      return results;
    });
    check('adding a requirement is refused while a review is running',
      runningRequirement.length === 2 && runningRequirement.every(entry =>
        entry.snapshot === entry.before.snapshot &&
        entry.requirements === entry.before.requirements &&
        entry.run === entry.status &&
        entry.message.includes('审查进行中')));

    const derivedVariants = await page.evaluate(() => {
      const app = CRPrototype.app;
      const names = [
        'partial', 'unreviewed', 'zero', 'incomplete', 'incremental', 'running', 'cancelled', 'failed',
        'no-requirement', 'extension-configured', 'extension-changed',
      ];
      const results = names.map(name => {
        app.applyConsoleScenario(name);
        const deliveryId = app.currentDeliveryId;
        const snapshotId = app.snapshot?.snapshotId || '';
        app.openDelivery(app.deliveries.find(delivery => delivery.deliveryId !== deliveryId));
        const delivery = app.deliveries.find(entry => entry.deliveryId === deliveryId);
        app.openDelivery(delivery);
        return { name, snapshotId, captured: Boolean(delivery.records?.[snapshotId]) };
      });
      const fake = {
        deliveryId: 'del-fallback-demo', title: '回退示例', branch: 'feat/fallback',
        sessionIds: [], latestSnapshotId: 'snap-fallback-demo',
        snapshots: [{ snapshotId: 'snap-fallback-demo', createdAt: new Date().toISOString(), mode: 'reviewed', findingCount: 0 }],
        latest: { status: 'issues', validFindingCount: 0 },
      };
      app.deliveries.push(fake);
      app.openDelivery(fake);
      const fallbackDerived = app.recordDerived;
      const fallbackSnapshot = app.snapshot?.snapshotId || '';
      app.openDelivery(app.deliveries[0]);
      app.deliveries = app.deliveries.filter(delivery => delivery.deliveryId !== 'del-fallback-demo');
      return {
        results,
        fallback: { derived: fallbackDerived, snapshot: fallbackSnapshot, captured: Boolean(fake.records?.['snap-fallback-demo']) },
      };
    });
    check('every derived console scenario stays out of the delivery records',
      derivedVariants.results.length === 11 && derivedVariants.results.every(entry => entry.captured === false) &&
      derivedVariants.fallback.derived === true && derivedVariants.fallback.snapshot === 'snap-fallback-demo' &&
      derivedVariants.fallback.captured === false);

    await open({ scenario: 'extension-changed' });
    const extensionSnapshot = await page.evaluate(async () => {
      const app = CRPrototype.app;
      const delivery = app.currentDelivery;
      const text = '团队规范：\n\n- 日志缺失按 P2。\n';
      app.extensionPrompt = text;
      await app.startReview({ scope: 'all' });
      const createdId = app.snapshot.snapshotId;
      const frozen = app.snapshot.extensionPrompt?.text || '';
      app.openDelivery(delivery, delivery.snapshots.find(entry => entry.snapshotId !== createdId));
      app.openDelivery(delivery, delivery.snapshots.find(entry => entry.snapshotId === createdId));
      return {
        frozen,
        expected: text,
        reopened: app.snapshot.snapshotId === createdId,
        prompt: app.snapshot.extensionPrompt?.text || '',
        captured: Boolean(delivery.records?.[createdId]),
        run: app.run?.status,
      };
    });
    check('an extension review snapshot survives a record switch',
      extensionSnapshot.frozen === extensionSnapshot.expected &&
      extensionSnapshot.reopened && extensionSnapshot.captured &&
      extensionSnapshot.prompt === extensionSnapshot.expected && extensionSnapshot.run === 'succeeded');

    await open({ scenario: 'partial' });
    const derivedLatest = await page.evaluate(async () => {
      const app = CRPrototype.app;
      const delivery = app.currentDelivery;
      const before = { latest: delivery.latest.validFindingCount, status: delivery.latest.status };
      const issue = Object.values(app.issueItemsByFile).flat().find(entry => !entry.suppressed);
      await app.toggleIssueSuppression(issue);
      await new Promise(resolve => setTimeout(resolve, 350));
      return {
        before,
        after: { latest: delivery.latest.validFindingCount, status: delivery.latest.status },
        active: app.activeFindingCount,
      };
    });
    check('a derived scenario leaves the delivery summary untouched',
      derivedLatest.after.latest === derivedLatest.before.latest &&
      derivedLatest.after.status === derivedLatest.before.status &&
      derivedLatest.active === derivedLatest.before.latest - 1);

    await open({ scenario: 'reviewed' });
    const deletionFirst = await page.evaluate(() => {
      const A = CRPrototype.annotations;
      const app = CRPrototype.app;
      const zero = app.deliveries.find(delivery => delivery.deliveryId === 'del-demo-zero');
      const snapshotId = zero.latestSnapshotId;
      const record = app.recordDataFor(zero, snapshotId);
      const file = record.snapshot.files.find(entry => entry.kind === 'text' &&
        entry.headSha256 && Number.isInteger(entry.headLineCount) && entry.headLineCount > 0);
      const anchor = { path: file.path, side: 'head', startLine: 1, endLine: 1, sha256: file.headSha256 };
      const added = A.add({ snapshotId, anchor, text: '删除前写入的批注' });
      const addedSecond = A.add({ snapshotId, anchor, text: '删除前写入的第二条批注' });
      const removed = A.remove(addedSecond.annotation.annotationId);
      const restored = A.restore(removed.annotation);
      const listedAfterRestore = A.list(snapshotId).length;
      const knownIds = listedAfterRestore;
      const before = A.eventsFor(snapshotId).length;
      A.deleteSnapshot(snapshotId, 'snapshot');
      const first = A.eventsFor(snapshotId).length;
      A.deleteSnapshot(snapshotId, 'snapshot');
      const second = A.eventsFor(snapshotId).length;
      const cascadeRestore = A.restore(restored.annotation);
      const retry = A.add({ snapshotId, anchor, text: '删除后再写入' });
      const emptyId = 'snap-demo-merged';
      const emptyBefore = A.eventsFor(emptyId).length;
      A.deleteSnapshot(emptyId, 'snapshot');
      A.deleteSnapshot(emptyId, 'snapshot');
      const emptyAfter = A.eventsFor(emptyId).length;
      const emptyRetry = A.add({
        snapshotId: emptyId,
        anchor: { path: 'x', side: 'head', startLine: null, endLine: null, sha256: 'x' },
        text: '空记录删除后写入',
      });
      const mainDelivery = app.deliveries[0];
      const mainId = mainDelivery.latestSnapshotId;
      const historyId = mainDelivery.snapshots.find(entry => entry.snapshotId !== mainId)?.snapshotId || '';
      const mainBefore = A.list(mainId).length;
      const historyBefore = historyId ? A.list(historyId).length : 0;
      A.deleteDelivery(mainDelivery);
      const mainAfter = A.list(mainId).length;
      const historyAfter = historyId ? A.list(historyId).length : 0;
      const cascadeEvents = A.eventsFor(mainId).length;
      A.deleteDelivery(mainDelivery);
      const cascadeAgain = A.eventsFor(mainId).length;
      return {
        snapshotId, anchor, mainId, historyId,
        added: added.ok, before, first, second, knownIds,
        removed: removed.ok, restored: restored.ok,
        cascadeRestore: { ok: cascadeRestore.ok, code: cascadeRestore.code },
        listedAfterRestore,
        retry: { ok: retry.ok, code: retry.code },
        listed: A.list(snapshotId).length,
        editable: A.isEditable(snapshotId),
        emptyBefore, emptyAfter,
        emptyRetry: { ok: emptyRetry.ok, code: emptyRetry.code },
        mainBefore, mainAfter, historyBefore, historyAfter,
        cascadeEvents, cascadeAgain,
      };
    });
    await page.reload();
    await page.waitForFunction(
      () => window.CRPrototype?.app && document.documentElement.dataset.ready === 'true',
      null, { timeout: 10000 },
    );
    await page.waitForTimeout(220);
    const deletionAfter = await page.evaluate(({ snapshotId, anchor, mainId, historyId }) => {
      const A = CRPrototype.annotations;
      const app = CRPrototype.app;
      const fakeAnchor = { path: 'x', side: 'head', startLine: null, endLine: null, sha256: 'x' };
      const retry = A.add({ snapshotId, anchor, text: '刷新之后再写入' });
      const mainRetry = A.add({ snapshotId: mainId, anchor: fakeAnchor, text: '主记录刷新后写入' });
      const historyRetry = historyId
        ? A.add({ snapshotId: historyId, anchor: fakeAnchor, text: '历史记录刷新后写入' })
        : { ok: true, code: '' };
      const eventsBeforeRepeat = A.eventsFor(snapshotId).length;
      A.deleteSnapshot(snapshotId, 'snapshot');
      A.deleteDelivery(app.deliveries[0]);
      const eventsAfterRepeat = A.eventsFor(snapshotId).length;
      const raw = localStorage.getItem(A.STORAGE_KEY) || '';
      const foreign = {
        event: 'add',
        annotation: {
          annotationId: 'ann-foreign', snapshotId, anchor: fakeAnchor, text: '外来批注',
          createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
        },
      };
      localStorage.setItem(A.STORAGE_KEY, raw + JSON.stringify(foreign) + '\n');
      return {
        retry: { ok: retry.ok, code: retry.code },
        mainRetry: { ok: mainRetry.ok, code: mainRetry.code },
        historyRetry: { ok: historyRetry.ok, code: historyRetry.code },
        listed: A.list(snapshotId).length,
        mainListed: A.list(mainId).length,
        historyListed: historyId ? A.list(historyId).length : 0,
        eventsBeforeRepeat, eventsAfterRepeat,
      };
    }, {
      snapshotId: deletionFirst.snapshotId, anchor: deletionFirst.anchor,
      mainId: deletionFirst.mainId, historyId: deletionFirst.historyId,
    });
    await page.reload();
    await page.waitForFunction(
      () => window.CRPrototype?.app && document.documentElement.dataset.ready === 'true',
      null, { timeout: 10000 },
    );
    await page.waitForTimeout(220);
    const deletionForeign = await page.evaluate(snapshotId => {
      const A = CRPrototype.annotations;
      const listed = A.list(snapshotId).length;
      const retry = A.add({
        snapshotId,
        anchor: { path: 'x', side: 'head', startLine: null, endLine: null, sha256: 'x' },
        text: '外来事件后写入',
      });
      try { localStorage.removeItem(A.STORAGE_KEY); } catch { /* the next page load starts clean */ }
      return { listed, retry: { ok: retry.ok, code: retry.code } };
    }, deletionFirst.snapshotId);
    check('a deleted snapshot rejects new annotations, cascades once and stays deleted after reload',
      deletionFirst.added === true && deletionFirst.removed && deletionFirst.restored &&
      deletionFirst.listedAfterRestore === 2 &&
      deletionFirst.first === deletionFirst.before + deletionFirst.knownIds + 1 &&
      deletionFirst.second === deletionFirst.first &&
      deletionFirst.cascadeRestore.ok === false &&
      deletionFirst.retry.ok === false && deletionFirst.retry.code === 'snapshot-deleted' &&
      deletionFirst.listed === 0 && deletionFirst.editable === false &&
      deletionFirst.emptyAfter === deletionFirst.emptyBefore + 1 &&
      deletionFirst.emptyRetry.ok === false && deletionFirst.emptyRetry.code === 'snapshot-deleted' &&
      deletionFirst.mainBefore > 0 && deletionFirst.mainAfter === 0 &&
      deletionFirst.historyBefore > 0 && deletionFirst.historyAfter === 0 &&
      deletionFirst.cascadeAgain === deletionFirst.cascadeEvents &&
      deletionAfter.retry.ok === false && deletionAfter.retry.code === 'snapshot-deleted' &&
      deletionAfter.mainRetry.ok === false && deletionAfter.mainRetry.code === 'snapshot-deleted' &&
      deletionAfter.historyRetry.ok === false && deletionAfter.historyRetry.code === 'snapshot-deleted' &&
      deletionAfter.listed === 0 && deletionAfter.mainListed === 0 && deletionAfter.historyListed === 0 &&
      deletionAfter.eventsBeforeRepeat === deletionFirst.first &&
      deletionAfter.eventsAfterRepeat === deletionAfter.eventsBeforeRepeat &&
      deletionForeign.listed === 0 && deletionForeign.retry.ok === false &&
      deletionForeign.retry.code === 'snapshot-deleted');

    }
    markStep('annotation UI');
    if (scoped('reviewed')) {
      await page.evaluate(() => localStorage.removeItem(CRPrototype.annotations.STORAGE_KEY));
      await open({ scenario: 'list' });
      await page.locator('.delivery-row[data-delivery-id="del-demo-zero"] .delivery-main').click();
      await page.waitForTimeout(280);
      const baseFile = await page.evaluate(() => {
        const app = CRPrototype.app;
        const file = app.normalizedDiffItems.find(item => item.file?.kind === 'text' && item.file?.baseSha256 && item.file?.headSha256);
        if (!file) return '';
        app.selectByPath(file.path);
        return file.path;
      });
      await page.waitForTimeout(250);
      if (await page.evaluate(() => CRPrototype.app.formattedDiffStyle)) {
        await page.locator('.wb-split-toggle').click();
        await page.waitForTimeout(220);
      }
      const baseButtonCount = await page.locator('.annotation-add-btn[data-annotation-side="base"]').count();
      const baseButton = page.locator('.annotation-add-btn[data-annotation-side="base"]').first();
      await baseButton.locator('xpath=ancestor::td').hover();
      await baseButton.click();
      await page.waitForTimeout(250);
      const baseAsk = await page.evaluate(() => ({
        view: CRPrototype.app.view,
        editor: document.querySelectorAll('.annotation-editor').length,
        draft: CRPrototype.app.dshDraft,
        message: CRPrototype.ui.message,
      }));
      check('a base-side line entry asks the conversation without an inline editor', Boolean(baseFile) && baseButtonCount > 0 &&
        baseAsk.editor === 0 && baseAsk.view === 'conversation' && baseAsk.draft.includes('的代码段') &&
        baseAsk.draft.includes('请结合上下文分析这段代码'));

      await open({ scenario: 'reviewed', style: 'double' });
      await page.locator('.focus-tree-row').filter({ hasText: 'app.js' }).first().click();
      await page.waitForTimeout(280);
      const before = await page.evaluate(() => {
        const app = CRPrototype.app;
        return {
          inputSha: app.snapshot.inputSha, active: app.activeFindingCount, risk: app.riskAdjustedCount.risk,
          complete: app.reviewCompleteNow, run: app.run?.runId || '', count: CRPrototype.annotations.list(app.snapshot.snapshotId).length,
        };
      });
      const plusCounts = await page.evaluate(() => document.querySelectorAll('.annotation-add-btn').length);
      check('frozen text lines expose annotation add buttons', plusCounts > 0);
      const headButton = page.locator('.annotation-add-btn[data-annotation-side="head"]').first();
      const quietGutter = await page.evaluate(() => {
        const button = document.querySelector('.annotation-add-btn');
        const svg = button?.querySelector('svg');
        return { opacity: button ? getComputedStyle(button).opacity : '', width: button ? getComputedStyle(button).width : '', svg: svg ? getComputedStyle(svg).width : '', svgMargin: svg ? getComputedStyle(svg).marginLeft : '', label: button?.getAttribute('aria-label') };
      });
      check('gutter Sparkles stays quiet until the line-number cell is hovered', quietGutter.opacity === '0' &&
        quietGutter.width === '24px' && quietGutter.svg === '14px' && quietGutter.svgMargin === '1px' &&
        quietGutter.label === '在会话中追问此代码段');
      await headButton.locator('xpath=ancestor::td').hover();
      await page.waitForTimeout(180);
      const shownGutter = await page.evaluate(() => getComputedStyle(document.querySelector('.annotation-add-btn')).opacity);
      check('gutter Sparkles fades in on precise number-cell hover', shownGutter === '1');
      await headButton.click();
      await page.waitForTimeout(250);
      const headAsk = await page.evaluate(() => ({
        view: CRPrototype.app.view,
        editor: document.querySelectorAll('.annotation-editor').length,
        draft: CRPrototype.app.dshDraft,
      }));
      check('a new-code line entry asks the conversation with the code hunk', headAsk.editor === 0 &&
        headAsk.view === 'conversation' && headAsk.draft.includes('关于 `prototype/src/app.js:') &&
        headAsk.draft.includes('```') && headAsk.draft.includes('请结合上下文分析这段代码'));

      await open({ scenario: 'reviewed', style: 'double' });
      await page.locator('.focus-tree-row').filter({ hasText: 'app.js' }).first().click();
      await page.waitForTimeout(280);
      const draftIssue = await page.evaluate(() => {
        const issue = CRPrototype.app.selectedIssues.find(entry => !entry.suppressed && entry.lineNumber > 0);
        return { id: issue?.issueKey || '' };
      });
      const lineDraftFile = await page.evaluate(() => CRPrototype.app.selectedFileItem.path);
      await page.locator(`.gpt-risk-marker[data-issue-key="${draftIssue.id}"] .annotation-add`).click();
      await page.waitForTimeout(120);
      await page.locator('.annotation-editor__input').fill('切换文件后应保留这段未保存文字。');
      await page.locator('.focus-tree-row').filter({ hasText: 'scenarios.js' }).first().click();
      await page.waitForTimeout(200);
      await page.locator('.focus-tree-row').filter({ hasText: 'app.js' }).first().click();
      await page.waitForTimeout(250);
      await page.locator(`.gpt-risk-marker[data-issue-key="${draftIssue.id}"] .annotation-add`).click();
      await page.waitForTimeout(150);
      const restoredDraft = await page.locator('.annotation-editor__input').inputValue();
      const countBeforeEscape = await page.evaluate(() => CRPrototype.annotations.list(CRPrototype.app.snapshot.snapshotId).length);
      await page.locator('.annotation-editor__input').press('Escape');
      await page.waitForTimeout(120);
      const afterEscape = await page.evaluate(() => ({
        editors: document.querySelectorAll('.annotation-editor').length,
        count: CRPrototype.annotations.list(CRPrototype.app.snapshot.snapshotId).length,
      }));
      check('unsaved annotation text survives a file switch and Esc cancels without writing',
        lineDraftFile.endsWith('app.js') && restoredDraft === '切换文件后应保留这段未保存文字。' &&
        afterEscape.editors === 0 && afterEscape.count === countBeforeEscape);

      await page.locator('.wb-split-toggle').click();
      await page.waitForTimeout(250);
      const singleTitle = await page.evaluate(async () => {
        const app = CRPrototype.app;
        app.openAnnotationEditor({ side: 'head', line: 1 });
        await new Promise(resolve => setTimeout(resolve, 150));
        const title = document.querySelector('.annotation-editor__head b')?.innerText || '';
        document.querySelector('.annotation-editor__cancel')?.click();
        return title;
      });
      check('single-column annotation editor writes the short line title', /^批注 · 第 \d+ 行$/.test(singleTitle));

      const issueProbe = await page.evaluate(() => {
        const app = CRPrototype.app;
        const issue = app.selectedIssues.find(entry => !entry.suppressed && entry.lineNumber > 0);
        return issue ? { id: issue.issueKey, title: issue.title } : null;
      });
      await page.locator(`.gpt-risk-marker[data-issue-key="${issueProbe.id}"] .annotation-add`).click();
      await page.waitForTimeout(150);
      const linkedEditor = await page.evaluate(() => ({
        title: document.querySelector('.annotation-editor__head b')?.innerText || '',
        subtitle: document.querySelector('.annotation-editor__subtitle')?.innerText || '',
      }));
      await page.locator('.annotation-editor__input').fill('这个问题请在下个提交里一起改。');
      await page.locator('.annotation-editor__save').click();
      await page.waitForTimeout(200);
      const linkedSaved = await page.evaluate(issueId => {
        const app = CRPrototype.app;
        const linked = CRPrototype.annotations.list(app.snapshot.snapshotId).filter(entry => entry.findingId === issueId);
        const marker = document.querySelector(`.gpt-risk-marker[data-issue-key="${CSS.escape(issueId)}"]`);
        return { count: linked.length, holderCards: marker?.parentElement.querySelectorAll('.annotation-holder .annotation-card').length || 0 };
      }, issueProbe.id);
      check('the problem card entry creates one linked annotation under that card',
        /^(批注 · 第 \d+ 行|批注 · (新|旧)代码第 \d+ 行)$/.test(linkedEditor.title) &&
        linkedEditor.subtitle === '' &&
        linkedSaved.count === 1 && linkedSaved.holderCards === 1);
      await page.locator(`.gpt-risk-marker[data-issue-key="${issueProbe.id}"] .annotation-add`).click();
      await page.waitForTimeout(150);
      const cancelLinked = await page.evaluate(async issueId => {
        const app = CRPrototype.app;
        const beforeCount = CRPrototype.annotations.list(app.snapshot.snapshotId).length;
        document.querySelector('.annotation-editor__cancel')?.click();
        await new Promise(resolve => setTimeout(resolve, 150));
        return {
          open: app.annotationEditor.open,
          editors: document.querySelectorAll('.annotation-editor').length,
          count: CRPrototype.annotations.list(app.snapshot.snapshotId).length,
          beforeCount,
        };
      }, issueProbe.id);
      check('the linked annotation editor closes on cancel without writing',
        cancelLinked.open === false && cancelLinked.editors === 0 && cancelLinked.count === cancelLinked.beforeCount);

      await page.evaluate(async issueId => {
        const app = CRPrototype.app;
        const issue = app.selectedIssues.find(entry => entry.issueKey === issueId);
        await app.toggleIssueSuppression(issue);
      }, issueProbe.id);
      await page.waitForTimeout(350);
      const suppressedCard = await page.evaluate(() => ({
        cards: document.querySelectorAll('.annotation-card').length,
        markers: document.querySelectorAll('.focus-suppressed-marker').length,
        inlineCards: document.querySelectorAll('.gpt-risk-marker--suppressed').length,
      }));
      check('annotations stay visible when the linked problem is marked non-issue',
        suppressedCard.cards >= 1 && suppressedCard.markers === 1 && suppressedCard.inlineCards === 0);
      await page.evaluate(async issueId => {
        const app = CRPrototype.app;
        const issue = app.selectedIssues.find(entry => entry.issueKey === issueId);
        await app.toggleIssueSuppression(issue);
      }, issueProbe.id);
      await page.waitForTimeout(350);

      const deleteProbe = await page.evaluate(() => {
        const app = CRPrototype.app;
        const card = [...document.querySelectorAll('.annotation-card')]
          .find(entry => entry.querySelector('.annotation-card__action[data-action="delete"]'));
        return card
          ? { id: card.dataset.annotationId, count: CRPrototype.annotations.list(app.snapshot.snapshotId).length }
          : { id: '', count: CRPrototype.annotations.list(app.snapshot.snapshotId).length };
      });
      await page.locator(`.annotation-card[data-annotation-id="${deleteProbe.id}"] .annotation-card__action[data-action="delete"]`).click();
      await page.waitForTimeout(150);
      const afterDelete = await page.evaluate(() => ({
        toast: document.querySelector('.annotation-undo')?.innerText.replace(/\s+/g, ' ').trim() || '',
        count: CRPrototype.annotations.list(CRPrototype.app.snapshot.snapshotId).length,
      }));
      await page.locator('.annotation-undo .wb-link').click();
      await page.waitForTimeout(200);
      const afterUndo = await page.evaluate(() => CRPrototype.annotations.list(CRPrototype.app.snapshot.snapshotId).length);
      check('deleting an annotation offers a six-second undo and restores it', afterDelete.toast.includes('已删除批注') &&
        afterDelete.toast.includes('撤销') && afterDelete.count === deleteProbe.count - 1 && afterUndo === deleteProbe.count);

      await page.locator('.gpt-risk-marker .annotation-add').first().click();
      await page.waitForTimeout(120);
      await page.locator('.annotation-editor__input').fill('x'.repeat(2001));
      check('a 2001-code-point annotation disables the save control', await page.locator('.annotation-editor__save').isDisabled());
      await page.evaluate(() => CRPrototype.app.saveAnnotation());
      await page.waitForTimeout(150);
      const tooLong = await page.evaluate(() => ({
        error: document.querySelector('.annotation-editor__error')?.innerText || '',
        editors: document.querySelectorAll('.annotation-editor').length,
      }));
      check('a 2001-code-point annotation is rejected in the editor', tooLong.error.includes('最多 2000 字') && tooLong.editors === 1);
      await page.locator('.annotation-editor__cancel').click();
      await page.waitForTimeout(100);

      await open({ scenario: 'reviewed' });
      await page.getByRole('tab', { name: '变更说明' }).click();
      await page.waitForTimeout(180);
      const overviewAnnotations = await page.evaluate(() => ({
        count: document.querySelector('.overview-annotation-jump')?.innerText.trim() || '',
        previous: document.querySelector('.overview-previous-annotations')?.innerText.trim() || '',
      }));
      check('the overview counts annotations and points to the previous record annotations', /^批注 \d+$/.test(overviewAnnotations.count) &&
        /的审查有 \d+ 条批注 · 查看$/.test(overviewAnnotations.previous));
      const annotationTarget = await page.evaluate(() => {
        const annotation = CRPrototype.app.snapshotAnnotations[0];
        return annotation?.anchor ? { path: annotation.anchor.path, line: annotation.anchor.startLine || 0, side: annotation.anchor.side || 'head' } : null;
      });
      await page.locator('.overview-annotation-jump').click();
      await page.waitForFunction(target => {
        if (!target?.line) return false;
        const app = CRPrototype.app;
        const side = target.side === 'base' ? 'left' : 'right';
        const row = document.getElementById(`risk-issue-line-${app.selectedFileItem.md5_str}-${side}-${target.line}`);
        const body = document.querySelector('.code-review-lite__body');
        const bodyRect = body?.getBoundingClientRect(), rowRect = row?.getBoundingClientRect();
        return app.mainView === 'diff' && app.selectedFileItem.path === target.path && Boolean(row) &&
          Boolean(rowRect && bodyRect && rowRect.top >= bodyRect.top - 2 && rowRect.top < bodyRect.bottom - 8);
      }, annotationTarget, { timeout: 2500 }).catch(() => {});
      check('the overview annotation jump lands on the annotated line', await page.evaluate(target => {
        if (!target?.line) return false;
        const app = CRPrototype.app;
        const side = target.side === 'base' ? 'left' : 'right';
        const row = document.getElementById(`risk-issue-line-${app.selectedFileItem.md5_str}-${side}-${target.line}`);
        const body = document.querySelector('.code-review-lite__body');
        const bodyRect = body?.getBoundingClientRect(), rowRect = row?.getBoundingClientRect();
        return app.mainView === 'diff' && app.selectedFileItem.path === target.path && Boolean(row) &&
          Boolean(rowRect && bodyRect && rowRect.top >= bodyRect.top - 2 && rowRect.top < bodyRect.bottom - 8);
      }, annotationTarget));
      const crossAnnotation = await page.evaluate(() => {
        const annotation = CRPrototype.app.snapshotAnnotations.find(entry =>
          entry.anchor?.path && entry.anchor.startLine && entry.anchor.path !== 'prototype/src/app.js');
        return annotation ? { path: annotation.anchor.path, line: annotation.anchor.startLine, side: annotation.anchor.side || 'head' } : null;
      });
      await page.evaluate(annotation => CRPrototype.app.jumpToAnnotation(annotation), crossAnnotation);
      await page.waitForFunction(target => {
        if (!target?.line) return false;
        const app = CRPrototype.app;
        const side = target.side === 'base' ? 'left' : 'right';
        const row = document.getElementById(`risk-issue-line-${app.selectedFileItem.md5_str}-${side}-${target.line}`);
        const body = document.querySelector('.code-review-lite__body');
        const bodyRect = body?.getBoundingClientRect(), rowRect = row?.getBoundingClientRect();
        return app.mainView === 'diff' && app.selectedFileItem.path === target.path && Boolean(row) &&
          Boolean(rowRect && bodyRect && rowRect.top >= bodyRect.top - 2 && rowRect.top < bodyRect.bottom - 8);
      }, crossAnnotation, { timeout: 2500 }).catch(() => {});
      check('annotation jump maps head/base to the diff side on another file', await page.evaluate(target => {
        if (!target?.line) return false;
        const app = CRPrototype.app;
        const side = target.side === 'base' ? 'left' : 'right';
        const row = document.getElementById(`risk-issue-line-${app.selectedFileItem.md5_str}-${side}-${target.line}`);
        const body = document.querySelector('.code-review-lite__body');
        const bodyRect = body?.getBoundingClientRect(), rowRect = row?.getBoundingClientRect();
        return app.mainView === 'diff' && app.selectedFileItem.path === target.path && Boolean(row) &&
          Boolean(rowRect && bodyRect && rowRect.top >= bodyRect.top - 2 && rowRect.top < bodyRect.bottom - 8);
      }, crossAnnotation));
      const rapidJump = await page.evaluate(async () => {
        const app = CRPrototype.app;
        const pool = app.normalizedDiffItems.flatMap(item => (app.issueItemsByFile[item.md5_str] || [])
          .filter(issue => !issue.suppressed && issue.lineNumber > 0)
          .map(issue => ({ item, issue })));
        const first = pool[0];
        const second = pool.find(entry => entry.item.path !== first.item.path) || pool[1];
        app.jumpToFinding(first.issue.finding);
        app.jumpToFinding(second.issue.finding);
        await new Promise(resolve => setTimeout(resolve, 650));
        const pulsing = [...document.querySelectorAll('.gpt-risk-marker.card-highlight-pulse')];
        return {
          selected: app.selectedFileItem.path, expectedPath: second.item.path,
          pulseKey: pulsing[0]?.dataset.issueKey || '', expectedKey: second.issue.issueKey, pulseCount: pulsing.length,
        };
      });
      check('rapid overview jumps keep only the latest target pulsing', rapidJump.selected === rapidJump.expectedPath &&
        rapidJump.pulseCount === 1 && rapidJump.pulseKey === rapidJump.expectedKey);

      await open({ scenario: 'history' });
      await page.locator('.focus-tree-row').filter({ hasText: 'app.js' }).first().click();
      await page.waitForTimeout(250);
      check('readonly cards keep only the ask action', await page.evaluate(() => {
        const cards = [...document.querySelectorAll('.gpt-risk-marker')];
        return cards.length > 0 && cards.every(card =>
          card.querySelectorAll('.gpt-risk-marker__header-right > button').length === 1 &&
          Boolean(card.querySelector('.issue-card-ask')) &&
          !card.querySelector('.annotation-add') && !card.querySelector('.issue-card-suppress'));
      }));
      const readonlyAnnotations = await page.evaluate(() => ({
        editors: document.querySelectorAll('.annotation-add-btn, .annotation-add, .annotation-editor').length,
        cards: document.querySelectorAll('.annotation-card').length,
        editDelete: document.querySelectorAll('.annotation-card__action[data-action="edit"], .annotation-card__action[data-action="delete"]').length,
      }));
      check('earlier records show annotations without any write entry', readonlyAnnotations.editors === 0 &&
        readonlyAnnotations.cards > 0 && readonlyAnnotations.editDelete === 0);

      await open({ scenario: 'reviewed' });
      const skippedPath = await page.evaluate(() => {
        const data = window.CR_PROTOTYPE_DATA;
        const file = data.snapshot.files.find(entry => entry.kind !== 'text');
        if (!file) return '';
        CRPrototype.app.selectByPath(file.path);
        return file.path;
      });
      await page.waitForTimeout(250);
      const skippedPlus = await page.evaluate(() => document.querySelectorAll('.annotation-add-btn').length);
      check('binary or excluded files expose no annotation add button', Boolean(skippedPath) && skippedPlus === 0);

      const afterAll = await page.evaluate(() => {
        const app = CRPrototype.app;
        return { inputSha: app.snapshot.inputSha, active: app.activeFindingCount, risk: app.riskAdjustedCount.risk, complete: app.reviewCompleteNow, run: app.run?.runId || '' };
      });
      check('annotations never change the frozen input, findings, risk files or completeness',
        afterAll.inputSha === before.inputSha && afterAll.active === before.active &&
        afterAll.risk === before.risk && afterAll.complete === before.complete && afterAll.run === before.run);
    }
  },
};
