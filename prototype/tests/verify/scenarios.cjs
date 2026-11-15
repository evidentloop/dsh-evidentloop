/* verify module: scenarios */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
module.exports = {
  id: 'scenarios',
  order: 4,
  scenarios: ['partial', 'unreviewed', 'zero', 'incomplete', 'incremental', 'history', 'records', 'running', 'cancelled', 'failed', 'no-requirement', 'added-requirement', 'auto-on', 'auto-off', 'preflight-not-git', 'preflight-no-target', 'preflight-no-model', 'preflight-split-index'],
  async run(rt) {
    const { page, context, output, data, scoped, selectedScenarios, SCENARIOS, ONLY } = rt;
    const { open, state, shot, check, markStep, ensureOverview, filterByMode, brandButtons, blueUiColors, contrastSamples, assertReadable, auditIconButtons, currentData, parseEmbeddedData } = rt;
    let s;
    markStep('remaining scenarios');
    // ---------- remaining scenarios ----------
    if (scoped('partial')) {
    await open({ scenario: 'partial' });
    s = await state();
    check('partial: pending is visible without a partial label', s.runStatus === 'partial' && s.pending > 0 &&
      s.counts.pending > 0 && s.runState === '' && await page.locator('.run-primary').innerText() === 'Review All');
    check('partial: filters stay all/risk/pending without a changed tab', s.filterModes.join(',') === 'all,risk,pending' &&
      await page.locator('input[name="file-filter"][value="turn"]').count() === 0 &&
      await page.locator('.file-filter-label--changed').count() === 0);
    await shot('06-partial');
    const pendingBefore = s.pending;
    const pendingRow = page.locator('.focus-tree-row').filter({ has: page.locator('.focus-tree-pending') }).first();
    if (await pendingRow.count()) {
      await pendingRow.click();
      await page.waitForTimeout(150);
      check('partial: single-file review is offered', await page.locator('.focus-code-review-btn').count() === 1);
      await page.locator('.focus-code-review-btn').click();
      await page.waitForTimeout(150);
      check('partial: single-file run starts', (await state()).runStatus === 'running' &&
        String((await state()).runScope).startsWith('file:'));
      await page.waitForFunction(() => window.CRPrototype.app.run?.status === 'succeeded', null, { timeout: 10000 });
      await page.waitForTimeout(100);
      check('partial: single-file run completes one file', (await state()).pending === pendingBefore - 1);
      check('partial: single-file run rebuilds coverage for every reviewed file',
        await page.evaluate(() => CRPrototype.app.coverage.reviewed.length) === data.reviewable - (pendingBefore - 1) &&
        await page.evaluate(() => CRPrototype.app.run.coverage.withheld.length) === 0);
    }

    }

    if (scoped('unreviewed')) {
    await open({ scenario: 'unreviewed' });
    s = await state();
    check('unreviewed: no run, every reviewable file pending', s.runStatus === null && s.pending === data.reviewable &&
      s.counts.pending === data.reviewable && s.active === 0);
    check('unreviewed: Review All is offered without an idle label', s.runState === '' &&
      (await page.locator('.run-primary').innerText()) === 'Review All' &&
      !(await page.getByRole('button', { name: '导出与发回', exact: true }).isDisabled()));
    const reviewLeftBefore = await page.evaluate(() => document.querySelector('.run-primary').getBoundingClientRect().left);
    await page.getByRole('tab', { name: '变更说明' }).click();
    await page.waitForTimeout(120);
    check('overview hides the diff style control without moving Review All', (await state()).mainView === 'overview' &&
      await page.evaluate(() => getComputedStyle(document.querySelector('.wb-split-toggle')).visibility) === 'hidden' &&
      await page.evaluate(() => document.querySelector('.run-primary').getBoundingClientRect().left) === reviewLeftBefore &&
      await page.locator('.view-switch').count() === 1 && await page.locator('[aria-label="变更说明"]').count() === 0);
    await page.getByRole('tab', { name: '文件对比' }).click();
    await page.waitForTimeout(120);
    check('diff view shows the style control and keeps Review All in place', (await state()).mainView === 'diff' &&
      await page.evaluate(() => getComputedStyle(document.querySelector('.wb-split-toggle')).visibility) === 'visible' &&
      await page.evaluate(() => document.querySelector('.run-primary').getBoundingClientRect().left) === reviewLeftBefore);
    await shot('07-unreviewed');
    const runPrimaryProbe = () => page.evaluate(() => {
      const button = document.querySelector('.run-primary');
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
        background: style.backgroundColor, color: style.color, border: style.borderTopColor,
        borderWidth: style.borderTopWidth, radius: style.borderTopLeftRadius, height: style.height,
        font: [style.fontSize, style.fontWeight].join(' '), shadow: style.boxShadow,
        ratio: background && foreground ? ratio(foreground, background) : 0,
      };
    });
    const runPrimary = await runPrimaryProbe();
    check('Review All uses a neutral fill, brand text and brand border',
      runPrimary.background === 'rgb(255, 255, 255)' && runPrimary.color === 'rgb(72, 104, 178)' &&
      runPrimary.border === 'rgb(65, 118, 230)' && runPrimary.borderWidth === '1px' &&
      runPrimary.radius === '8px' && runPrimary.height === '32px' && runPrimary.font === '13px 600' &&
      runPrimary.shadow === 'none' && runPrimary.ratio >= 4.5);
    await page.locator('.run-primary').hover();
    await page.waitForTimeout(120);
    const runPrimaryHover = await runPrimaryProbe();
    check('Review All hover uses the brand tint and hover text',
      runPrimaryHover.background === 'rgb(228, 237, 253)' && runPrimaryHover.color === 'rgb(72, 104, 178)' &&
      runPrimaryHover.ratio >= 4.5);
    await shot('43-primary-light');
    await page.mouse.move(0, 0);
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.waitForTimeout(150);
    const runPrimaryDark = await runPrimaryProbe();
    check('Review All keeps the same scheme in dark mode',
      runPrimaryDark.color === 'rgb(122, 170, 255)' && runPrimaryDark.border === 'rgb(122, 170, 255)' &&
      runPrimaryDark.background === 'rgb(35, 37, 42)' && runPrimaryDark.ratio >= 4.5);
    await shot('43-primary-dark');
    await page.emulateMedia({ colorScheme: 'light' });
    await page.waitForTimeout(100);
    await page.locator('.run-primary').click();
    await page.waitForTimeout(150);
    check('Review All shows running state at the button position', (await state()).runStatus === 'running' &&
      (await page.locator('.run-state').innerText()).includes('审查中') &&
      await page.locator('.run-state__action').innerText() === '取消');
    await page.waitForFunction(() => window.CRPrototype.app.run?.status === 'succeeded', null, { timeout: 30000 });
    await page.waitForTimeout(150);
    s = await state();
    check('Review All completes and leaves the position empty', s.runStatus === 'succeeded' && s.pending === 0 &&
      s.active > 0 && await page.locator('.run-state').count() === 0);
    await shot('08-unreviewed-reviewed');

    }

    if (scoped('zero')) {
    await open({ scenario: 'zero' });
    s = await state();
    check('zero: complete leaves the run position empty', s.reviewComplete === true && s.active === 0 &&
      s.runState === '' && await page.locator('.run-state').count() === 0);
    check('zero: no issue cards', await page.locator('.gpt-risk-marker').count() === 0);
    check('zero: the header stays all-only without a changed tab', s.filterModes.join(',') === 'all' &&
      await page.locator('.file-filter-label--changed').count() === 0 &&
      await page.evaluate(() => {
        const app = CRPrototype.app;
        const record = app.recordDataFor(app.currentDelivery, app.previousRecordEntry.snapshotId);
        const delta = CRPrototype.coverage.diffFileIdentities(record.snapshot.files || [], app.snapshot.files || []);
        return delta.changed.length + delta.added.length > 0;
      }));
    await ensureOverview();
    check('zero: conclusion states no findings and is not incomplete', (await page.locator('#overview-conclusion .panel-status').innerText()).includes('未发现问题') &&
      (await page.locator('#overview-conclusion .panel-status').getAttribute('class')).includes('panel-status--green') &&
      !(await page.locator('#overview-conclusion .panel-status').getAttribute('class')).includes('panel-status--amber'));
    await shot('09-zero');
    await page.getByRole('button', { name: '导出与发回', exact: true }).click();
    const [zeroMd] = await Promise.all([page.waitForEvent('download'), page.getByRole('menuitem', { name: /变更日志（Markdown）/ }).click()]);
    const zeroMarkdown = fs.readFileSync(await zeroMd.path(), 'utf8');
    check('zero-finding markdown export is complete', zeroMarkdown.includes('本次审查结论：未发现问题') &&
      zeroMarkdown.includes('- 审查结论：未发现问题') &&
      ['## 需求依据', '## 变更概览', '## 按功能变更', '## 文件清单', '## 行为影响', '## 问题与处置', '## 局限'].every(text => zeroMarkdown.includes(text)));
    await page.getByRole('button', { name: '导出与发回', exact: true }).click();
    const [zeroHtmlDownload, zeroPreview] = await Promise.all([
      page.waitForEvent('download'), page.waitForEvent('popup'), page.getByRole('menuitem', { name: /评审报告（HTML）/ }).click(),
    ]);
    const zeroHtml = fs.readFileSync(await zeroHtmlDownload.path(), 'utf8');
    check('zero-finding html export is complete', zeroHtml.includes('本次审查结论：未发现问题') &&
      zeroHtml.includes('审查结论：未发现问题') &&
      ['需求依据', '变更概览', '按功能变更', '文件清单', '行为影响', '问题与处置', '局限'].every(text => zeroHtml.includes(text)));
    await zeroPreview.close();

    }

    if (scoped('incomplete')) {
    await open({ scenario: 'incomplete' });
    s = await state();
    check('incomplete: not complete and withholds conclusions', s.reviewComplete === false && s.withheld === data.withheld &&
      (await page.locator('.wb-reason-link').innerText()) === '3 条结论未通过校验' &&
      !(await page.locator('.wb-reason-link').innerText()).includes('结论证据未通过校验') &&
      !s.runState.includes('审查不完整'));
    check('incomplete: no re-review button at the run position', await page.locator('.run-primary').count() === 0);
    check('incomplete: delivery card follows the incomplete delivery', await page.evaluate(() =>
      CRPrototype.app.currentDelivery?.deliveryId === 'del-demo-incomplete' &&
      CRPrototype.app.deliveryCard?.status === '发现 1 个问题'));
    check('incomplete: coverage withholds kind/ref/code entries and missing-ref', await page.evaluate(() =>
      CRPrototype.app.coverage.withheld.every(entry =>
        ['finding', 'statement'].includes(entry.kind) && typeof entry.ref === 'string' &&
        typeof entry.code === 'string' && !Object.prototype.hasOwnProperty.call(entry, 'findingRef')) &&
      CRPrototype.app.coverage.withheld.some(entry => entry.code === 'missing-ref')));
    check('incomplete: snapshot, run and coverage agree with the withheld fixtures', await page.evaluate(expected => {
      const app = CRPrototype.app;
      const refs = app.coverage.withheld.map(entry => entry.ref).sort().join(',');
      return app.snapshot.snapshotId === 'snap-demo-withheld' && app.run?.snapshotId === 'snap-demo-withheld' &&
        app.run?.runId === expected.runId && refs === [...expected.refs].sort().join(',');
    }, { runId: data.withheldRunId, refs: data.withheldRefs }));
    const withheldGuard = await page.evaluate(() => {
      const app = CRPrototype.app;
      app.coverage = { ...app.coverage, withheld: [] };
      if (app.run?.coverage) app.run.coverage.withheld = [];
      return {
        complete: app.reviewCompleteNow, count: app.withheldCount,
        display: app.runDisplay?.kind, reason: app.incompleteReasonNow,
      };
    });
    check('file-level withheld keeps the UI incomplete after coverage reset', withheldGuard.complete === false &&
      withheldGuard.count === data.withheld && withheldGuard.display === 'withheld' &&
      withheldGuard.reason.includes('未通过校验'));
    await page.evaluate(() => CRPrototype.app.showOverviewProblems());
    await page.waitForTimeout(250);
    check('incomplete: the semantic status opens the overview at problems and coverage', (await state()).mainView === 'overview' &&
      (await state()).panelCount === 0 &&
      await page.locator('#overview-problems.overview-section--target').count() === 1 &&
      await page.locator('#overview-coverage.overview-section--target').count() === 1);
    check('incomplete: overview lists withheld conclusions and missing-ref', await page.locator('.withheld-row').count() === data.withheld &&
      (await page.locator('.withheld-box').innerText()).includes('条结论证据未通过校验，未展示') &&
      (await page.locator('.withheld-box').innerText()).includes('缺少代码引用') &&
      !(await page.locator('.withheld-box').innerText()).includes('已扣下'));
    check('incomplete: never says no findings', (await page.locator('.panel-status b').innerText()) === '发现 7 个问题 · 3 条结论未通过校验');
    const incompleteUiText = await page.evaluate(() => {
      const clone = document.body.cloneNode(true);
      clone.querySelectorAll('.d2h-wrapper,pre,code,.sendback-content,.extension-preview').forEach(node => node.remove());
      return clone.innerText;
    });
    check('incomplete UI has no validation field names or snapshot ids', !/sha-?256/i.test(incompleteUiText) &&
      !/inputsha/i.test(incompleteUiText) && !/promptversion/i.test(incompleteUiText) &&
      !incompleteUiText.includes('追溯信息') && !/snap-[0-9a-f]{8,}/i.test(incompleteUiText));
    await shot('10-incomplete');
    const withheldLink = page.locator('.withheld-row .withheld-path--link').first();
    const withheldPath = (await withheldLink.getAttribute('title') || '').replace(/:\d+$/, '');
    check('withheld locations are clickable references', await page.locator('.withheld-row .withheld-path--link').count() === data.withheld);
    await withheldLink.click();
    await page.waitForTimeout(120);
    check('clicking a withheld location opens its file diff', (await state()).mainView === 'diff' && (await state()).selected === withheldPath);
    await ensureOverview();
    await page.getByRole('button', { name: '导出与发回', exact: true }).click();
    await page.locator('.export-menu .wb-menu-item--danger').click();
    await page.waitForTimeout(180);
    check('withheld badges clear when a new run starts', await page.evaluate(() =>
      CRPrototype.app.coverage.withheld.length === 0 &&
      CRPrototype.app.normalizedDiffItems.every(item => !(item.withheld || []).length)) &&
      await page.locator('.focus-tree-withheld').count() === 0);
    await page.waitForFunction(() => window.CRPrototype.app.run?.status === 'succeeded', null, { timeout: 30000 });
    await page.waitForTimeout(150);
    const recovered = await page.evaluate(() => ({
      complete: CRPrototype.app.reviewCompleteNow,
      withheld: CRPrototype.app.withheldCount,
      display: CRPrototype.app.runDisplay,
      banner: CRPrototype.app.reviewBanner?.label,
    }));
    check('re-review restores completeness after withheld clears', recovered.complete === true &&
      recovered.withheld === 0 && recovered.display === null && recovered.banner === '发现 7 个问题');

    }

    if (scoped('incremental')) {
    await open({ scenario: 'incremental' });
    s = await state();
    check('incremental: carried files plus pending files', s.runStatus === 'partial' && s.pending > 0 &&
      s.runState === '' && await page.locator('.run-primary').innerText() === 'Review All');
    await ensureOverview();
    check('incremental: no turn group remains', await page.locator('.carry-grid').count() === 0 &&
      !(await page.locator('.overview-main').innerText()).includes('本轮'));
    await shot('11-incremental-overview');
    const carriedPath = await page.evaluate(() => CRPrototype.app.normalizedDiffItems.find(item => item.carriedFrom)?.path || '');
    const carriedRow = page.locator(`.focus-tree-row[data-path="${carriedPath}"]`).first();
    check('incremental: tree marks carried files', Boolean(carriedPath) && await carriedRow.count() > 0 &&
      await page.locator('.focus-tree-carried').count() === 0);
    if (await carriedRow.count()) {
      await page.mouse.move(0, 0);
      await page.waitForTimeout(80);
      await carriedRow.hover();
      await page.waitForTimeout(380);
      check('carried files explain their source in the tree tooltip', /沿用自 \d{2}-\d{2} \d{2}:\d{2} 的审查/.test(
        await page.locator('[role="tooltip"]').innerText()));
    }
    if (await carriedRow.count()) {
      await carriedRow.click();
      await page.waitForTimeout(150);
      const carriedState = await state();
      check('incremental: selected carried file names its source', Boolean(carriedState.selectedCarried));
      const carriedBody = await page.locator('.gpt-risk-marker__content').allInnerTexts();
      if (carriedBody.length) {
        const carriedTagText = await page.locator('.carried-tag').first().innerText();
        check('carried findings name their relative review and never an id', /^沿用自 \d{2}-\d{2} \d{2}:\d{2} 的审查$/.test(carriedTagText.trim()) &&
          !/snap-[0-9a-f]{8,}/i.test(carriedBody.join('\n')));
      }
      await page.locator('.review-toggle-btn').filter({ hasText: '查看说明' }).first().click();
      await page.waitForTimeout(120);
      check('incremental: file panel opens for carried file', (await page.locator('.file-panel').innerText()).includes('变更摘要'));
      await page.getByRole('button', { name: '关闭说明' }).click();
    }
    await shot('12-incremental');

    }

    if (scoped('history')) {
    await open({ scenario: 'history' });
    s = await state();
    check('history: read-only banner and no run controls', s.readonly === true && s.history === true &&
      s.historyBanner.includes('审查记录（只读）') && /\s·\s打开最新审查/.test(s.historyBanner) &&
      await page.locator('.run-state').count() === 0);
    await ensureOverview();
    check('history: requirement entry is disabled', await page.locator('.req-add').isDisabled());
    await page.locator('.overview-requirements > summary').click();
    check('history: read-only note is shown', (await page.locator('.overview-main').innerText()).includes('更早的审查记录中不可添加需求依据'));
    await shot('13-history');
    await page.locator('.focus-tree-row').filter({ hasText: 'app.js' }).first().click();
    await page.waitForTimeout(150);
    check('history: disposition controls are hidden, not disabled', await page.locator('.file-risk-item__suppress-btn, .gpt-risk-marker__restore').count() === 0);
    await page.getByRole('button', { name: '打开最新' }).click();
    await page.waitForTimeout(200);
    s = await state();
    check('history: open latest returns to the newest review record', s.history === false && s.runStatus === 'succeeded');

    }

    if (scoped('records')) {
    await open({ scenario: 'records' });
    await page.waitForTimeout(200);
    check('records: latest record is dirty and each record carries its own issues', await page.evaluate(() =>
      CRPrototype.app.recordEntries.length === 4 && CRPrototype.app.recordEntries[0].dirty === true &&
      CRPrototype.app.recordEntries.map(entry => entry.findingCount).join(',') === '7,3,2,1'));
    await shot('34-records');

    }

    if (scoped('running')) {
    await open({ scenario: 'running' });
    s = await state();
    check('running: status and cancel action', s.runStatus === 'running' && s.runState.includes('审查中') &&
      await page.locator('.run-state__action').innerText() === '取消');
    await shot('14-running');
    await page.locator('.run-state__action').click();
    await page.waitForTimeout(150);
    check('running: cancel stops the run', (await state()).runStatus === 'cancelled' &&
      (await page.locator('.run-state').innerText()).includes('已取消'));

    }

    if (scoped('cancelled')) {
    await open({ scenario: 'cancelled' });
    s = await state();
    check('cancelled: retry is offered', s.runStatus === 'cancelled' && s.runState.includes('已取消') &&
      (await page.locator('.run-primary').innerText()).includes('重新审查'));
    await shot('15-cancelled');
    await page.locator('.run-primary').click();
    await page.waitForTimeout(150);
    check('cancelled: retry starts a new run', (await state()).runStatus === 'running');
    await page.locator('.run-state__action').click();
    await page.waitForTimeout(100);

    }

    if (scoped('failed')) {
    await open({ scenario: 'failed' });
    s = await state();
    check('failed: failure and retry are visible', s.runStatus === 'failed' && s.runState.includes('审查失败') &&
      (await page.locator('.run-primary').innerText()).includes('重试'));
    await ensureOverview();
    check('failed: overview lists failed files', s.failed === 2 && await page.locator('.coverage-failed > li').count() === 2);
    await shot('16-failed');

    }

    if (scoped('no-requirement')) {
    await open({ scenario: 'no-requirement' });
    s = await state();
    check('no requirement: snapshot has no requirement source', s.requirements === 0);
    await ensureOverview();
    const noReqText = await page.locator('.overview-main').innerText();
    check('no requirement: only the one-line requirement message remains', noReqText.includes('未提供需求依据') &&
      await page.locator('.align-group').count() === 0 && !noReqText.includes('缺少需求'));
    check('no requirement: the model-written conclusion stays model inference',
      (await page.locator('#overview-conclusion .basis-tag').innerText()) === '模型推断');
    await shot('17-no-requirement');

    }

    if (scoped('added-requirement')) {
    await open({ scenario: 'added-requirement' });
    s = await state();
    check('added requirement: all reviewable files return to pending', s.runStatus === null &&
      s.pending === data.reviewable && s.requirements === data.requirements.length + 1);
    check('added requirement: notice asks for Review All', await page.locator('.panel-notice').innerText() === '需求依据已更新，Review All 后更新对齐判断');
    check('added requirement scenario exports against its previous snapshot', await page.evaluate(() =>
      CRPrototype.exports.buildMarkdown(CRPrototype.app.exportContext()).includes('需求依据已更新') &&
      !CRPrototype.exports.buildMarkdown(CRPrototype.app.exportContext()).includes('这是该交付的第一份审查记录。')));
    await shot('18-added-requirement');

    }

    const preflights = [
      ['preflight-not-git', '当前目录不是 Git 仓库', '重新检测'],
      ['preflight-no-target', '无法确定目标分支', '打开设置'],
      ['preflight-no-model', '未配置可用模型', null],
      ['preflight-split-index', '仓库启用了 split index', null],
    ];

    if (scoped('auto-on', 'auto-off')) {
    for (const [scenario, expected] of [['auto-on', true], ['auto-off', false]]) {
      if (!scoped(scenario)) continue;
      await open({ scenario });
      s = await state();
      check(scenario + ': auto mode state', s.autoMode === expected &&
        await page.locator('.settings-menu .wb-setting-row input[type="checkbox"]').first().isChecked() === expected);
      await shot('19-' + scenario);
    }

    }

    if (scoped('preflight-not-git', 'preflight-no-target', 'preflight-no-model', 'preflight-split-index')) {
    for (const [scenario, title, action] of preflights) {
      if (!scoped(scenario)) continue;
      await open({ scenario });
      s = await state();
      check(scenario + ': preflight replaces the workbench', Boolean(s.preflight) &&
        (await page.locator('.wb-preflight h2').innerText()).includes(title) &&
        await page.locator('.run-state').count() === 0);
      if (action) {
        check(scenario + ': action is ' + action,
          await page.locator('.wb-preflight-actions button').filter({ hasText: action }).count() === 1);
      }
      await shot('20-' + scenario);
      if (scenario === 'preflight-not-git') {
        await page.locator('.wb-preflight-actions button').filter({ hasText: '重新检测' }).click();
        await page.waitForTimeout(100);
        check('preflight-not-git: retry is simulated locally', (await page.locator('.n-message').innerText()).includes('重新检测'));
      }
      if (scenario === 'preflight-no-target') {
        await page.locator('.wb-preflight-actions button').filter({ hasText: '打开设置' }).click();
        await page.waitForTimeout(100);
        check('preflight-no-target: settings open with three options',
          await page.locator('.wb-preflight-menu .wb-setting-row').count() === 4);
        await shot('21-preflight-no-target-settings');
      }
      if (scenario === 'preflight-split-index') {
        check('preflight-split-index: explains the untouched repository',
          (await page.locator('.wb-preflight').innerText()).includes('sharedindex'));
      }
    }

    }

  },
};
