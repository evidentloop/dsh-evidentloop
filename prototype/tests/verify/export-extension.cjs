/* verify module: export-extension */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
module.exports = {
  id: 'export-extension',
  order: 3,
  scenarios: ['extension-configured', 'extension-changed', 'extension-none'],
  async run(rt) {
    const { page, context, output, data, scoped, selectedScenarios, SCENARIOS, ONLY } = rt;
    const { open, state, shot, check, markStep, ensureOverview, filterByMode, brandButtons, blueUiColors, contrastSamples, assertReadable, auditIconButtons, currentData, parseEmbeddedData } = rt;
    let s;
    markStep('export during forced re-review');
    if (scoped('reviewed', 'no-requirement', 'running', 'incomplete', 'unreviewed')) {
    await open({ scenario: 'reviewed' });
    const staleSample = await page.evaluate(() => {
      const app = CRPrototype.app;
      const item = (app.understanding?.alignment || []).find(entry => entry.note && ['partial', 'not-found', 'unclear'].includes(entry.status));
      return { note: item?.note || '', purpose: app.understanding?.overview?.purpose || '' };
    });
    await page.getByRole('button', { name: '导出与发回', exact: true }).click();
    await page.locator('.export-menu .wb-menu-item--danger').click();
    await page.waitForTimeout(320);
    const runningReview = await page.evaluate(() => {
      const app = CRPrototype.app;
      const context = app.exportContext();
      const md = CRPrototype.exports.buildMarkdown(context);
      const html = CRPrototype.exports.buildHtml(context).html;
      const draft = app.buildSendBackContent();
      return {
        runStatus: app.run?.status,
        stale: Boolean(app.understanding?.stale),
        exportDisabled: document.querySelector('.focus-export-icon-btn')?.disabled,
        md, html, draft,
      };
    });
    check('a forced re-review invalidates the old batch explanation immediately', runningReview.runStatus === 'running' &&
      runningReview.stale && runningReview.exportDisabled === false &&
      runningReview.md.includes('变更说明尚未生成') && runningReview.html.includes('变更说明尚未生成') &&
      runningReview.md.includes('变更说明尚未生成，未对齐条目未参与本次整理。') &&
      runningReview.html.includes('变更说明尚未生成，未对齐条目未参与本次整理。') &&
      !runningReview.md.includes('没有未对齐条目') && !runningReview.html.includes('没有未对齐条目') &&
      !runningReview.md.includes(staleSample.purpose) &&
      !runningReview.html.replace(/<script type="application\/json"[\s\S]*?<\/script>/g, '').includes(staleSample.purpose) &&
      runningReview.md.includes('审查结论：—') && runningReview.html.includes('审查结论：—') &&
      !runningReview.draft.includes(staleSample.note) &&
      runningReview.draft.includes('变更说明尚未生成，未对齐条目未参与本次整理。') &&
      runningReview.draft.includes('本次审查尚未完成，未列出未处置问题。') &&
      !runningReview.draft.includes('没有未处置的问题。'));
    await page.getByRole('button', { name: '导出与发回', exact: true }).click();
    await page.waitForTimeout(120);
    const runningMenu = await page.locator('.export-menu .wb-menu-item').evaluateAll(items => items.map(item => ({
      text: item.innerText.replace(/\s+/g, ' ').trim(), disabled: item.disabled, title: item.title,
    })));
    check('the export menu opens while running and only blocks what cannot run', runningMenu.length === 5 &&
      runningMenu[0].disabled === false && runningMenu[1].disabled === false &&
      runningMenu[3].disabled === true && runningMenu[3].text.includes('审查进行中') &&
      runningMenu[4].disabled === true && runningMenu[4].title.includes('审查进行中'));
    const disabledReasonContrast = await page.evaluate(() => {
      const parse = value => {
        const match = String(value).match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
        return match ? [+match[1], +match[2], +match[3], match[4] === undefined ? 1 : +match[4]] : null;
      };
      const luminance = color => color.slice(0, 3).map(value => {
        const channel = value / 255;
        return channel <= 0.03928 ? channel / 12.92 : Math.pow((channel + 0.055) / 1.055, 2.4);
      }).reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
      const item = [...document.querySelectorAll('.export-menu .wb-menu-item')].find(entry => entry.disabled && entry.querySelector('small'));
      const small = item?.querySelector('small');
      if (!small) return 0;
      let node = item, background = null;
      while (node) {
        const color = parse(getComputedStyle(node).backgroundColor);
        if (color && color[3] > 0.5) { background = color; break; }
        node = node.parentElement;
      }
      const foreground = parse(getComputedStyle(small).color);
      if (!foreground || !background) return 0;
      return (Math.max(luminance(foreground), luminance(background)) + 0.05) / (Math.min(luminance(foreground), luminance(background)) + 0.05);
    });
    check('disabled export reasons keep at least 4.5:1 contrast', disabledReasonContrast >= 4.5);
    await shot('30c-export-running');
    await page.keyboard.press('Escape');
    await page.locator('.run-state__action').click();
    await page.waitForTimeout(320);
    const cancelledReview = await page.evaluate(() => {
      const app = CRPrototype.app;
      const context = app.exportContext();
      const md = CRPrototype.exports.buildMarkdown(context);
      const html = CRPrototype.exports.buildHtml(context).html;
      const draft = app.buildSendBackContent();
      return {
        runStatus: app.run?.status,
        stale: Boolean(app.understanding?.stale),
        exportDisabled: document.querySelector('.focus-export-icon-btn')?.disabled,
        md, html, draft,
      };
    });
    check('cancelling a forced re-review keeps facts and status without the old explanation', cancelledReview.runStatus === 'cancelled' &&
      cancelledReview.stale && cancelledReview.exportDisabled === false &&
      cancelledReview.md.includes('变更说明尚未生成') && cancelledReview.html.includes('变更说明尚未生成') &&
      cancelledReview.md.includes('变更说明尚未生成，未对齐条目未参与本次整理。') &&
      cancelledReview.html.includes('变更说明尚未生成，未对齐条目未参与本次整理。') &&
      !cancelledReview.md.includes('没有未对齐条目') && !cancelledReview.html.includes('没有未对齐条目') &&
      !cancelledReview.md.includes(staleSample.purpose) &&
      !cancelledReview.html.replace(/<script type="application\/json"[\s\S]*?<\/script>/g, '').includes(staleSample.purpose) &&
      /审查结论：不完整（\d+ 个文件待审）/.test(cancelledReview.md) && /审查结论：不完整（\d+ 个文件待审）/.test(cancelledReview.html) &&
      !cancelledReview.draft.includes(staleSample.note) &&
      cancelledReview.draft.includes('本次审查尚未完成，未列出未处置问题。') &&
      !cancelledReview.draft.includes('没有未处置的问题。'));
    await page.getByRole('tab', { name: '变更说明' }).click();
    await page.waitForFunction(() => window.CRPrototype.app.mainView === 'overview', null, { timeout: 5000 });
    await page.waitForTimeout(180);
    const cancelledOverview = await page.evaluate(() => ({
      featureEmpty: document.querySelector('#overview-features .overview-muted')?.innerText || '',
      alignment: document.querySelector('#overview-alignment .overview-muted')?.innerText || '',
      basisCount: document.querySelectorAll('#overview-conclusion .basis-tag, #overview-features .basis-tag, #overview-alignment .basis-tag').length,
      banner: document.querySelector('.panel-status')?.innerText || '',
      reviewed: CRPrototype.app.coverage?.reviewed?.length ?? 0,
      problemGroups: CRPrototype.app.problemGroups.length,
      problemDom: document.querySelectorAll('#overview-problems .overview-problem-group').length,
    }));
    check('cancelled overview shows the current status instead of the old explanation', /^\d+ 个文件待审；只显示已通过校验的部分。/.test(cancelledOverview.featureEmpty.trim()) &&
      !cancelledOverview.featureEmpty.includes('本次没有可展开的功能条目') &&
      cancelledOverview.alignment.includes('审查已取消') && cancelledOverview.basisCount === 0 &&
      cancelledOverview.problemDom === cancelledOverview.problemGroups &&
      /^\d+ 个文件待审/.test(cancelledOverview.banner.trim()) &&
      cancelledOverview.banner.includes('点 Review All 审查剩下的文件'));    await page.getByRole('tab', { name: '文件对比' }).click();
    await page.waitForTimeout(150);
    await page.getByRole('button', { name: '导出与发回', exact: true }).click();
    await page.waitForTimeout(120);
    const cancelledMenu = await page.locator('.export-menu .wb-menu-item').evaluateAll(items => items.map(item => ({
      text: item.innerText.replace(/\s+/g, ' ').trim(), disabled: item.disabled, title: item.title,
    })));
    check('after cancelling, exports stay available and re-review becomes available', cancelledMenu.length === 5 &&
      cancelledMenu[0].disabled === false && cancelledMenu[1].disabled === false &&
      cancelledMenu[3].disabled === true && cancelledMenu[3].text.includes('先完成审查') &&
      cancelledMenu[4].disabled === false);
    await shot('30d-export-cancelled');
    await page.keyboard.press('Escape');
    for (const scenario of ['unreviewed', 'failed', 'cancelled', 'running']) {
      await open({ scenario });
      const staleFacts = await page.evaluate(() => {
        const app = CRPrototype.app;
        const context = app.exportContext();
        const md = CRPrototype.exports.buildMarkdown(context);
        const html = CRPrototype.exports.buildHtml(context).html;
        const draft = app.buildSendBackContent();
        return {
          stale: Boolean(app.understanding?.stale),
          active: app.activeFindingCount,
          md, html, draft,
        };
      });
      check('stale ' + scenario + ': both exports and the fix draft use facts and current status', staleFacts.stale &&
        staleFacts.md.includes('变更说明尚未生成') && staleFacts.html.includes('变更说明尚未生成') &&
        staleFacts.md.includes('变更说明尚未生成，未对齐条目未参与本次整理。') &&
        staleFacts.html.includes('变更说明尚未生成，未对齐条目未参与本次整理。') &&
        !staleFacts.md.includes('没有未对齐条目') && !staleFacts.html.includes('没有未对齐条目') &&
        (staleFacts.active > 0 || (staleFacts.draft.includes('本次审查尚未完成，未列出未处置问题。') &&
          !staleFacts.draft.includes('没有未处置的问题。'))));
    }
    await open({ scenario: 'no-requirement' });
    const noRequirementDraft = await page.evaluate(() => CRPrototype.app.buildSendBackContent());
    check('a no-requirement fix draft says the requirement source is missing', noRequirementDraft.includes('未提供需求依据。') &&
      !noRequirementDraft.includes('没有未对齐或待确认条目。'));
    await open({ scenario: 'running' });
    await page.getByRole('tab', { name: '变更说明' }).click();
    await page.waitForFunction(() => window.CRPrototype.app.mainView === 'overview', null, { timeout: 5000 });
    await page.waitForTimeout(180);
    const runningOverview = await page.evaluate(() => ({
      show: CRPrototype.app.showUnderstanding,
      groups: CRPrototype.app.problemGroups.length,
      dom: document.querySelectorAll('#overview-problems .overview-problem-group').length,
      basisCount: document.querySelectorAll('#overview-conclusion .basis-tag, #overview-features .basis-tag, #overview-alignment .basis-tag').length,
      featureEmpty: document.querySelector('#overview-features .overview-muted')?.innerText || '',
      alignment: document.querySelector('#overview-alignment .overview-muted')?.innerText || '',
    }));
    check('a running record shows completed findings without the old explanation', runningOverview.show === false &&
      runningOverview.groups > 0 && runningOverview.dom === runningOverview.groups &&
      runningOverview.basisCount === 0 && runningOverview.featureEmpty.includes('审查进行中') &&
      runningOverview.alignment.includes('审查进行中'));
    await open({ scenario: 'incomplete' });
    const incompletePurpose = await page.evaluate(() => CRPrototype.app.understanding?.overview?.purpose || '');
    const beforeSyntheticForce = await page.evaluate(() => ({
      runId: CRPrototype.app.run?.runId || '', endedAt: CRPrototype.app.run?.endedAt || '',
    }));
    await page.getByRole('button', { name: '导出与发回', exact: true }).click();
    await page.locator('.export-menu .wb-menu-item--danger').click();
    await page.waitForFunction(previous => window.CRPrototype.app.run?.runId !== previous &&
      window.CRPrototype.app.run?.status === 'succeeded', beforeSyntheticForce.runId, { timeout: 40000 });
    await page.waitForTimeout(300);
    const syntheticForce = await page.evaluate(({ purpose, previous }) => {
      const app = CRPrototype.app;
      const context = app.exportContext();
      return {
        purpose: app.understanding?.overview?.purpose || '',
        mainPurpose: window.CR_PROTOTYPE_DATA.understanding?.overview?.purpose || '',
        features: (app.understanding?.features || []).length,
        stale: Boolean(app.understanding?.stale),
        runId: app.run?.runId || '',
        endedAt: app.run?.endedAt || '',
        scope: app.run?.scope || '',
        previousRunId: previous.runId,
        previousEndedAt: previous.endedAt,
        mdHasPurpose: CRPrototype.exports.buildMarkdown(context).includes(purpose),
        htmlHasPurpose: CRPrototype.exports.buildHtml(context).html.includes(purpose),
        expected: purpose,
      };
    }, { purpose: incompletePurpose, previous: beforeSyntheticForce });
    check('a forced re-review of a synthetic record keeps its own explanation', syntheticForce.expected !== syntheticForce.mainPurpose &&
      syntheticForce.purpose === syntheticForce.expected && syntheticForce.purpose !== syntheticForce.mainPurpose &&
      syntheticForce.features === 0 && syntheticForce.stale === false &&
      syntheticForce.runId !== syntheticForce.previousRunId && syntheticForce.scope === 'all' &&
      syntheticForce.endedAt !== syntheticForce.previousEndedAt &&
      syntheticForce.mdHasPurpose && syntheticForce.htmlHasPurpose);
    await open({ scenario: 'no-requirement' });
    const noRequirementBefore = await page.evaluate(() => ({ runId: CRPrototype.app.run?.runId || '' }));
    await page.getByRole('button', { name: '导出与发回', exact: true }).click();
    await page.locator('.export-menu .wb-menu-item--danger').click();
    await page.waitForFunction(previous => window.CRPrototype.app.run?.runId !== previous &&
      window.CRPrototype.app.run?.status === 'succeeded', noRequirementBefore.runId, { timeout: 40000 });
    await page.waitForTimeout(300);
    const noRequirementAfter = await page.evaluate(() => {
      const app = CRPrototype.app;
      const context = app.exportContext();
      const draft = app.buildSendBackContent();
      const md = CRPrototype.exports.buildMarkdown(context);
      return {
        runId: app.run?.runId || '',
        alignment: (app.understanding?.alignment || []).length,
        requirements: app.requirementsList.length,
        draft,
        md,
      };
    });
    check('a forced re-review of a no-requirement record does not inject alignment', noRequirementAfter.runId !== noRequirementBefore.runId &&
      noRequirementAfter.alignment === 0 && noRequirementAfter.requirements === 0 &&
      noRequirementAfter.draft.includes('未提供需求依据。') &&
      !noRequirementAfter.draft.includes('需求条目') && !noRequirementAfter.draft.includes('## 未对齐 / 待确认（3）') &&
      noRequirementAfter.md.includes('未提供需求依据。') && !noRequirementAfter.md.includes('需求条目'));

    await open({ scenario: 'unreviewed' });
    check('the export menu opens whenever a frozen record exists', !(await page.getByRole('button', { name: '导出与发回', exact: true }).isDisabled()));
    await page.getByRole('button', { name: '导出与发回', exact: true }).click();
    await page.waitForTimeout(120);
    const unreviewedItems = await page.locator('.export-menu .wb-menu-item').evaluateAll(items => items.map(item => ({
      text: item.innerText,
      disabled: item.disabled,
    })));
    check('each export item decides on its own before the first review', unreviewedItems.length === 5 &&
      unreviewedItems[0].disabled === false && unreviewedItems[1].disabled === false &&
      unreviewedItems[2].disabled === false &&
      unreviewedItems[3].disabled === true && unreviewedItems[3].text.includes('先完成审查'));
    check('a pending record exports facts and status without stale explanation', await page.evaluate(() => {
      const markdown = CRPrototype.exports.buildMarkdown(CRPrototype.app.exportContext());
      return markdown.includes('变更说明尚未生成；以下只列文件事实与审查结论。') &&
        !markdown.includes('DSH 外壳与双入口');
    }));
    await page.keyboard.press('Escape');
    await shot('30b-sendback-supplement-unavailable');

    await open({ scenario: 'incomplete' });
    const incompleteDraft = await page.evaluate(() => CRPrototype.app.buildSendBackContent());
    check('the fix draft derives the incomplete state and withheld count from the review', incompleteDraft.includes('审查结论：发现 7 个问题；不完整（3 条结论未通过校验）') &&
      incompleteDraft.includes('未提供需求依据。') &&
      !incompleteDraft.includes('没有未对齐或待确认条目。'));
    const incompleteSupplement = await page.evaluate(() => {
      const app = CRPrototype.app;
      app.currentDelivery.sessionIds = ['sess-prototype'];
      const context = app.exportContext();
      return {
        valid: app.understandingValid,
        workbench: app.showUnderstanding,
        description: app.hasValidatedDescription,
        disabled: app.supplementDisabled,
        hasSession: Boolean(app.sendBackTarget),
        content: app.buildSupplementContent(),
        md: CRPrototype.exports.buildMarkdown(context),
        html: CRPrototype.exports.buildHtml(context).html,
      };
    });
    await page.getByRole('button', { name: '导出与发回', exact: true }).click();
    await page.waitForTimeout(120);
    const supplementItem = page.getByRole('menuitem', { name: /补充说明/ });
    check('supplement follows the same explanation validity as the workbench and exports', incompleteSupplement.valid &&
      incompleteSupplement.workbench && incompleteSupplement.description && !incompleteSupplement.disabled &&
      incompleteSupplement.hasSession && !(await supplementItem.isDisabled()) &&
      incompleteSupplement.content.includes('## 覆盖不足') &&
      incompleteSupplement.content.includes('3 条结论证据未通过校验') &&
      incompleteSupplement.md.includes('验证证据未通过校验时只展示通过校验的部分。') &&
      incompleteSupplement.html.includes('验证证据未通过校验时只展示通过校验的部分。') &&
      !incompleteSupplement.md.includes('变更说明尚未生成') &&
      !incompleteSupplement.html.includes('变更说明尚未生成'));
    await page.keyboard.press('Escape');

    await open({ scenario: 'extension-configured' });
    const supplementWithExtension = await page.evaluate(() => {
      const app = CRPrototype.app;
      return { content: app.buildSupplementContent(), extension: app.snapshot.extensionPrompt?.text || '' };
    });
    check('supplement draft omits the extension prompt body', supplementWithExtension.extension.length > 0 &&
      !supplementWithExtension.content.includes(supplementWithExtension.extension));

    }
    markStep('extension prompt');
    // ---------- extension prompt ----------
    if (scoped('extension-configured', 'extension-changed', 'extension-none')) {
    await open({ scenario: 'extension-configured' });
    check('configured extension scenario shows its size and no change banner', (await page.locator('.settings-menu .wb-setting-row').filter({ hasText: '扩展提示词' }).innerText()).includes('已配置 · 52 字') &&
      await page.locator('.wb-extension-banner').count() === 0 &&
      await page.evaluate(() => CRPrototype.app.snapshot.extensionPrompt?.length === 52));
    const configuredExport = await page.evaluate(() => {
      const context = CRPrototype.exports.buildExportContext(CRPrototype.app);
      return { markdown: CRPrototype.exports.buildMarkdown(context), html: CRPrototype.exports.buildHtml(context).html };
    });
    check('configured extension is written into both exports', configuredExport.markdown.includes('扩展提示词：已使用 · 52 字') &&
      configuredExport.html.includes('扩展提示词：已使用 · 52 字'));
    const configuredPayload = parseEmbeddedData(configuredExport.html);
    const configuredText = await page.evaluate(() => CRPrototype.app.snapshot.extensionPrompt.text);
    const configuredMeta = await page.evaluate(text => ({
      sha256: CRPrototype.sha256(text), length: CRPrototype.codePointLength(text),
    }), configuredText);
    check('html extension data separates original identity from the redacted body',
      configuredPayload.snapshot.extensionPrompt.sha256 === configuredMeta.sha256 &&
      configuredPayload.snapshot.extensionPrompt.originalLength === configuredMeta.length &&
      configuredPayload.snapshot.extensionPrompt.text === configuredText &&
      configuredPayload.snapshot.extensionPrompt.redacted === false &&
      configuredPayload.snapshot.extensionPrompt.truncated === false);
    check('markdown export writes only the extension settings summary',
      configuredExport.markdown.includes('扩展提示词：已使用 · 52 字') &&
      !configuredExport.markdown.includes(configuredText.trim()));
    const extensionBoundary = await page.evaluate(() => {
      const app = CRPrototype.app;
      const dialog = { ...app.extensionDialog };
      const overBefore = app.extensionOverLimit;
      app.extensionDialog = { ...dialog, draft: '😀'.repeat(20000) };
      const atLimit = { length: app.extensionDraftLength, over: app.extensionOverLimit };
      app.extensionDialog = { ...dialog, draft: '😀'.repeat(20001) };
      const aboveLimit = { length: app.extensionDraftLength, over: app.extensionOverLimit };
      app.extensionDialog = dialog;
      return { overBefore, atLimit, aboveLimit };
    });
    check('extension limits count Unicode code points, not UTF-16 units',
      extensionBoundary.atLimit.length === 20000 && extensionBoundary.atLimit.over === false &&
      extensionBoundary.aboveLimit.length === 20001 && extensionBoundary.aboveLimit.over === true);
    const crlfMeta = await page.evaluate(() => {
      const text = CRPrototype.app.snapshot.extensionPrompt.text.replace(/\n/g, '\r\n');
      const normalized = CRPrototype.normalizeNewlines(text);
      return {
        same: CRPrototype.sha256(normalized) === CRPrototype.app.snapshot.extensionPrompt.sha256,
        length: CRPrototype.codePointLength(normalized) === CRPrototype.app.snapshot.extensionPrompt.length,
      };
    });
    check('CRLF and LF extension prompts share one normalized identity', crlfMeta.same && crlfMeta.length);
    const extensionB = '团队规范：\n\n- 未校验的外部输入一律按 P1。\n';
    const saveExtension = async text => {
      if (!(await page.locator('.settings-menu .osw-text-link').filter({ hasText: '编辑' }).count())) {
        await page.getByRole('button', { name: '工作区设置', exact: true }).click();
        await page.waitForTimeout(120);
      }
      await page.locator('.settings-menu .osw-text-link').filter({ hasText: '编辑' }).click();
      await page.waitForTimeout(120);
      await page.locator('.extension-textarea').fill(text);
      await page.getByRole('button', { name: '保存', exact: true }).click();
      await page.waitForTimeout(150);
    };
    await saveExtension(extensionB);
    const changedAfterB = await page.evaluate(() => CRPrototype.app.extensionPromptChanged) &&
      await page.locator('.wb-extension-banner').count() === 1;
    await saveExtension(configuredText);
    const restoredAfterA = await page.evaluate(() => CRPrototype.app.extensionPromptChanged) === false &&
      await page.locator('.wb-extension-banner').count() === 0;
    await saveExtension('');
    const changedAfterClear = await page.evaluate(() => CRPrototype.app.extensionPromptChanged) &&
      await page.locator('.wb-extension-banner').count() === 1;
    await saveExtension(configuredText);
    const restoredAgain = await page.evaluate(() => CRPrototype.app.extensionPromptChanged) === false;
    check('extension change notice is derived from a hash mismatch across A → B → A and clear',
      changedAfterB && restoredAfterA && changedAfterClear && restoredAgain);
    if (!(await page.locator('.settings-menu .osw-text-link').filter({ hasText: '编辑' }).count())) {
      await page.getByRole('button', { name: '工作区设置', exact: true }).click();
      await page.waitForTimeout(120);
    }
    await page.locator('.settings-menu .osw-text-link').filter({ hasText: '编辑' }).click();
    await page.waitForTimeout(150);
    await page.locator('.extension-textarea').fill(configuredText.slice(0, -1));
    await page.getByRole('button', { name: '保存', exact: true }).click();
    await page.waitForTimeout(150);
    check('whitespace-only prompt changes still trigger review', await page.evaluate(() =>
      CRPrototype.app.extensionPromptChanged && CRPrototype.app.extensionPrompt.length === 51) &&
      await page.locator('.wb-extension-banner').count() === 1);
    const extensionMaskProbe = await page.evaluate(() => {
      const sentinel = 'token="AUDIT_SENTINEL_123456"';
      const context = CRPrototype.exports.buildExportContext(CRPrototype.app);
      context.snapshot.extensionPrompt = {
        text: sentinel, sha256: CRPrototype.sha256(sentinel), length: CRPrototype.codePointLength(sentinel),
      };
      const app = CRPrototype.app;
      const item = app.normalizedDiffItems.find(entry => entry.reviewStatus === 'reviewed');
      const raw = app.diffDict[item.md5_str];
      const originalFindings = raw.findings;
      raw.findings = [...originalFindings, {
        findingId: 'audit-sendback-mask', runId: 'run-audit', category: 'logic', severity: 'P2',
        ruleSource: { kind: 'builtin', id: 'logic-state-consistency' }, title: '发回脱敏样例',
        problem: sentinel, impact: '', anchor: { path: item.path, side: 'head', line: 1 }, evidence: [],
      }];
      const draft = app.buildSendBackContent();
      raw.findings = originalFindings;
      return {
        markdown: CRPrototype.exports.buildMarkdown(context),
        html: CRPrototype.exports.buildHtml(context).html,
        draft,
        sha256: CRPrototype.sha256(sentinel),
        length: CRPrototype.codePointLength(sentinel),
      };
    });
    const extensionMaskPayload = parseEmbeddedData(extensionMaskProbe.html);
    check('html extension prompt data uses the same masking', !extensionMaskProbe.markdown.includes('AUDIT_SENTINEL_123456') &&
      !extensionMaskProbe.html.includes('AUDIT_SENTINEL_123456') &&
      extensionMaskPayload.snapshot.extensionPrompt.text.includes('token="***"'));
    check('html data keeps original extension identity while the body is redacted',
      extensionMaskPayload.snapshot.extensionPrompt.sha256 === extensionMaskProbe.sha256 &&
      extensionMaskPayload.snapshot.extensionPrompt.originalLength === extensionMaskProbe.length &&
      extensionMaskPayload.snapshot.extensionPrompt.redacted === true &&
      extensionMaskPayload.snapshot.extensionPrompt.truncated === false);
    check('send-back draft uses the same field-level redaction and omits the extension body',
      !extensionMaskProbe.draft.includes('AUDIT_SENTINEL_123456') &&
      extensionMaskProbe.draft.includes('token="***"') &&
      !extensionMaskProbe.draft.includes(configuredText.trim()));
    const extensionBudget = await page.evaluate(() => {
      const context = CRPrototype.exports.buildExportContext(CRPrototype.app);
      const text = '审'.repeat(1500000);
      context.snapshot.extensionPrompt = {
        text, sha256: CRPrototype.sha256(text), length: CRPrototype.codePointLength(text),
      };
      const result = CRPrototype.exports.buildHtml(context);
      const match = result.html.match(/<script type="application\/json" id="evidentloop-data" nonce="[^"]*">([\s\S]*?)<\/script>/);
      const payload = match ? JSON.parse(match[1]) : null;
      return {
        bytes: CRPrototype.exports.byteLength(result.html),
        limit: CRPrototype.exports.MAX_HTML_BYTES,
        omitted: result.omitted,
        extension: payload?.snapshot?.extensionPrompt || null,
        originalSha: CRPrototype.sha256(text),
        originalLength: CRPrototype.codePointLength(text),
      };
    });
    check('extension body participates in the whole-report UTF-8 budget and falls back to a summary',
      extensionBudget.bytes <= extensionBudget.limit &&
      extensionBudget.omitted.some(item => item.path === '扩展提示词' && item.reason.includes('已省略正文')) &&
      extensionBudget.extension.text === '' && extensionBudget.extension.truncated === true &&
      extensionBudget.extension.sha256 === extensionBudget.originalSha &&
      extensionBudget.extension.originalLength === extensionBudget.originalLength);
    await open({ scenario: 'extension-changed' });
    check('changed extension scenario shows the review banner', (await page.locator('.wb-extension-banner').innerText()).includes('扩展提示词已更改，Review All 后按新要求审查') &&
      await page.evaluate(() => CRPrototype.app.extensionPromptChanged) === true);

    await open({ scenario: 'extension-none' });
    check('unconfigured extension is reported as unused in both exports', await page.evaluate(() => {
      const context = CRPrototype.exports.buildExportContext(CRPrototype.app);
      return CRPrototype.exports.buildMarkdown(context).includes('扩展提示词：未使用') &&
        CRPrototype.exports.buildHtml(context).html.includes('扩展提示词：未使用');
    }));
    await page.locator('.settings-menu .osw-text-link').filter({ hasText: '编辑' }).click();
    await page.waitForTimeout(200);
    const extensionDialogState = await page.evaluate(() => ({
      open: CRPrototype.app.extensionDialog.open,
      panes: document.querySelectorAll('.extension-pane').length,
      count: document.querySelector('.extension-count')?.innerText || '',
      width: document.querySelector('.extension-modal')?.getBoundingClientRect().width || 0,
    }));
    check('extension dialog opens with edit and preview panes at 960px', extensionDialogState.open &&
      extensionDialogState.panes === 2 && extensionDialogState.count === '0 / 20000' && extensionDialogState.width === 960);
    await auditIconButtons('the extension dialog', '.extension-modal');
    const extensionFile = path.join(output, 'extension-source.md');
    fs.writeFileSync(extensionFile, '# 团队规范\n\n日志缺失按 P2。\n');
    await page.locator('.extension-import input[type="file"]').setInputFiles(extensionFile);
    await page.waitForFunction(() => document.querySelector('.extension-textarea')?.value.includes('日志缺失按 P2'), null, { timeout: 5000 });
    check('extension dialog imports a local .md file', (await page.locator('.extension-count').innerText()).startsWith('18 / 20000'));
    const previewPayload = '[打开](javascript:globalThis.__EXT_LINK__=1)\n\n<img src=x onerror="globalThis.__EXT_LINK__=2">\n\n<script>globalThis.__EXT_LINK__=3</script>';
    await page.locator('.extension-textarea').fill(previewPayload);
    await page.waitForTimeout(150);
    const extensionPreview = await page.evaluate(payload => ({
      elements: document.querySelectorAll('.extension-preview img, .extension-preview script').length,
      anchors: document.querySelectorAll('.extension-preview a').length,
      sentinel: globalThis.__EXT_LINK__,
      html: document.querySelector('.extension-preview').innerHTML,
      expected: CRPrototype.convertToMarkdown(payload),
    }), previewPayload);
    check('extension preview uses the sanitized markdown renderer', extensionPreview.elements === 0 &&
      extensionPreview.anchors === 0 && extensionPreview.sentinel === undefined &&
      extensionPreview.html === extensionPreview.expected && extensionPreview.html.includes('打开'));
    await page.locator('.extension-textarea').fill('x'.repeat(20001));
    await page.waitForTimeout(100);
    check('extension save is disabled above 20000 characters', await page.getByRole('button', { name: '保存', exact: true }).isDisabled() &&
      (await page.locator('.extension-count').getAttribute('class')).includes('is-over'));
    await page.locator('.osw-text-link').filter({ hasText: '清空' }).click();
    await page.waitForTimeout(100);
    check('clear empties the extension editor', (await page.locator('.extension-count').innerText()) === '0 / 20000');
    const savedExtension = '团队规范：\n\n- 日志缺失按 P2。\n- 重点关注权限校验。\n';
    await page.locator('.extension-textarea').fill(savedExtension);
    await page.getByRole('button', { name: '保存', exact: true }).click();
    await page.waitForTimeout(200);
    check('saving a changed extension shows the review banner', (await page.locator('.wb-extension-banner').innerText()).includes('扩展提示词已更改，Review All 后按新要求审查') &&
      await page.evaluate(() => CRPrototype.app.extensionPromptChanged) === true);
    await page.locator('.wb-extension-banner button').click();
    await page.waitForTimeout(150);
    const extensionDuringReview = await page.evaluate(() => ({
      changed: CRPrototype.app.extensionPromptChanged,
      pending: CRPrototype.app.pendingCount,
      banner: document.querySelectorAll('.wb-extension-banner').length,
      run: CRPrototype.app.run?.status,
    }));
    check('Review All applies the extension snapshot and clears the banner', extensionDuringReview.changed === false &&
      extensionDuringReview.pending === data.reviewable && extensionDuringReview.banner === 0 && extensionDuringReview.run === 'running');
    await page.waitForFunction(() => window.CRPrototype.app.run?.status === 'succeeded', null, { timeout: 30000 });
    await page.waitForTimeout(150);
    const extensionApplied = await page.evaluate(() => {
      const app = CRPrototype.app;
      const context = CRPrototype.exports.buildExportContext(app);
      return {
        text: app.snapshot.extensionPrompt?.text,
        length: app.snapshot.extensionPrompt?.length,
        rules: app.snapshot.rulesVersion,
        complete: app.reviewCompleteNow,
        markdown: CRPrototype.exports.buildMarkdown(context),
        html: CRPrototype.exports.buildHtml(context).html,
      };
    });
    check('Review All freezes the extension prompt into the snapshot', extensionApplied.text === savedExtension &&
      extensionApplied.length === savedExtension.length && extensionApplied.rules.includes('evidentloop-rules-v0.1+') &&
      extensionApplied.complete === true);
    check('applied extension appears in both exports', extensionApplied.markdown.includes(`扩展提示词：已使用 · ${savedExtension.length} 字`) &&
      extensionApplied.html.includes(`扩展提示词：已使用 · ${savedExtension.length} 字`) &&
      parseEmbeddedData(extensionApplied.html).snapshot.extensionPrompt.text === savedExtension);
    check('extension Review All exports compare against the pre-change snapshot', await page.evaluate(() =>
      CRPrototype.exports.buildMarkdown(CRPrototype.app.exportContext()).includes('与上次审查相比，文件清单与内容没有变化。') &&
      !CRPrototype.exports.buildMarkdown(CRPrototype.app.exportContext()).includes('这是该交付的第一份审查记录。')));
    await page.locator('.wb-back').click();
    await page.waitForTimeout(150);
    await page.locator(`.delivery-row[data-delivery-id="${data.deliveries[0].id}"] .delivery-main`).click();
    await page.waitForTimeout(200);
    const extensionReopened = await page.evaluate(() => {
      const app = CRPrototype.app;
      const context = app.deliverySourceContext(app.currentDelivery);
      return {
        text: app.snapshot.extensionPrompt?.text,
        changed: app.extensionPromptChanged,
        banner: document.querySelectorAll('.wb-extension-banner').length,
        cardMarkdown: CRPrototype.exports.buildMarkdown(context),
      };
    });
    check('extension prompt survives re-entry and card export', extensionReopened.text === savedExtension &&
      extensionReopened.changed === false && extensionReopened.banner === 0 &&
      extensionReopened.cardMarkdown.includes(`扩展提示词：已使用 · ${savedExtension.length} 字`));
    check('reopened delivery card export keeps the extension baseline',
      extensionReopened.cardMarkdown.includes('与上次审查相比，文件清单与内容没有变化。') &&
      !extensionReopened.cardMarkdown.includes('这是该交付的第一份审查记录。'));

    }
    markStep('annotation exports');
    if (scoped('reviewed')) {
      await page.evaluate(() => localStorage.removeItem(CRPrototype.annotations.STORAGE_KEY));
      await open({ scenario: 'reviewed' });
      const annotationExport = await page.evaluate(() => {
        const app = CRPrototype.app;
        const file = app.snapshot.files.find(entry => entry.kind === 'text' && entry.headSha256 && entry.headLineCount > 0);
        const added = CRPrototype.annotations.add({
          snapshotId: app.snapshot.snapshotId,
          anchor: { path: file.path, side: 'head', startLine: 1, endLine: 1, sha256: file.headSha256 },
          text: '</script><b>注入</b>',
        });
        const context = app.exportContext();
        const markdown = CRPrototype.exports.buildMarkdown(context);
        const html = CRPrototype.exports.buildHtml(context).html;
        const embedded = CRPrototype.exports.buildHtml(context).html.match(/<script type="application\/json" id="evidentloop-data" nonce="[^"]*">([\s\S]*?)<\/script>/);
        return { ok: added.ok, count: CRPrototype.annotations.list(app.snapshot.snapshotId).length, markdown, html, data: embedded ? JSON.parse(embedded[1]) : null };
      });
      check('both exports carry an annotation section with the reviewer note', annotationExport.ok &&
        annotationExport.markdown.includes('## 批注') && annotationExport.markdown.includes('评审人意见，未经模型校验') &&
        annotationExport.html.includes('批注</h2>') && annotationExport.html.includes('评审人意见，未经模型校验') &&
        annotationExport.data?.annotations.length === annotationExport.count);
      check('annotation text is escaped as plain text in the HTML report', !annotationExport.html.includes('<b>注入</b>') &&
        !annotationExport.html.includes('</script><b>') && annotationExport.html.includes('&lt;b&gt;注入&lt;/b&gt;'));
      check('the embedded report data keeps annotation fields without raw markup', annotationExport.data.annotations.some(entry =>
        entry.text.includes('</script><b>注入</b>')) && annotationExport.data.annotations.every(entry =>
        Object.prototype.hasOwnProperty.call(entry, 'path') && Object.prototype.hasOwnProperty.call(entry, 'startLine')));
    }
  },
};
