/* verify module: regression-5c */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
module.exports = {
  id: 'regression-5c',
  order: 6,
  scenarios: ['reviewed', 'list'],
  async run(rt) {
    const { page, context, output, data, scoped, selectedScenarios, SCENARIOS, ONLY } = rt;
    const { open, state, shot, check, markStep, ensureOverview, filterByMode, brandButtons, blueUiColors, contrastSamples, assertReadable, auditIconButtons, currentData, parseEmbeddedData } = rt;
    let s;
    markStep('5c fix3b: review record restoration and workbench copy');
    // ---------- 5c 收尾三（下）：评审台 ----------
    if (scoped('reviewed')) {
      await open({ scenario: 'list' });
      const mainDeliveryId = await page.evaluate(() => CRPrototype.app.deliveries[0].deliveryId);
      const openCard = async id => {
        await page.locator(`.delivery-row[data-delivery-id="${id}"] .delivery-main`).click();
        await page.waitForTimeout(260);
      };
      const backToList = async () => { await page.locator('.wb-back').click(); await page.waitForTimeout(170); };
      const downloadMarkdown = async () => {
        await page.getByRole('button', { name: '导出与发回', exact: true }).click();
        const [download] = await Promise.all([
          page.waitForEvent('download'),
          page.getByRole('menuitem', { name: /变更日志（Markdown）/ }).click(),
        ]);
        return fs.readFileSync(await download.path(), 'utf8');
      };
      const downloadHtml = async () => {
        await page.getByRole('button', { name: '导出与发回', exact: true }).click();
        const [download, preview] = await Promise.all([
          page.waitForEvent('download'), page.waitForEvent('popup'),
          page.getByRole('menuitem', { name: /评审报告（HTML）/ }).click(),
        ]);
        const html = fs.readFileSync(await download.path(), 'utf8');
        await preview.close();
        return html;
      };
      const workbenchState = () => page.evaluate(() => {
        const app = CRPrototype.app;
        return {
          snapshot: app.snapshot?.snapshotId || '',
          run: app.run?.status || null,
          supplementDisabled: app.supplementDisabled,
          pending: app.pendingCount,
          withheld: app.withheldCount,
          understandingValid: app.understandingValid,
        };
      });
      await openCard(mainDeliveryId);
      const mainRecord = await workbenchState();
      await page.getByRole('button', { name: '导出与发回', exact: true }).click();
      await page.getByRole('menuitem', { name: /全部重新审查/ }).click();
      await page.waitForFunction(() => window.CRPrototype.app.run?.status === 'running', null, { timeout: 5000 });
      await page.locator('.run-state__action').click();
      await page.waitForTimeout(160);
      const cancelledState = await workbenchState();
      check('B1: cancelling a forced re-review invalidates the old result in place',
        cancelledState.snapshot === mainRecord.snapshot && cancelledState.run === 'cancelled' &&
        cancelledState.supplementDisabled === true && cancelledState.understandingValid === false &&
        cancelledState.pending > 0 && cancelledState.withheld === 0);
      const cancelledMarkdown = await downloadMarkdown();
      const cancelledHtml = await downloadHtml();
      const cancelledData = parseEmbeddedData(cancelledHtml);
      check('B1: exports after cancel say incomplete with the current reason and never complete',
        /^- 审查结论：不完整（\d+ 个文件待审）$/m.test(cancelledMarkdown) &&
        !cancelledMarkdown.includes('本次未发现问题') &&
        cancelledData.run?.status === 'cancelled' && cancelledData.review?.complete === false);
      await backToList();
      await openCard('del-demo-partial-failed');
      await backToList();
      await openCard(mainDeliveryId);
      const returnedState = await workbenchState();
      check('B1: leaving and returning to the same record restores the cancelled result',
        returnedState.snapshot === mainRecord.snapshot && returnedState.run === 'cancelled' &&
        returnedState.supplementDisabled === true && returnedState.pending === cancelledState.pending &&
        returnedState.withheld === cancelledState.withheld);
      const returnedMarkdown = await downloadMarkdown();
      const returnedData = parseEmbeddedData(await downloadHtml());
      check('B1: re-entering exports the cancelled run instead of the old success',
        /^- 审查结论：不完整（\d+ 个文件待审）$/m.test(returnedMarkdown) &&
        returnedData.run?.status === 'cancelled' && returnedData.review?.complete === false);
      await page.getByRole('button', { name: '导出与发回', exact: true }).click();
      await page.getByRole('menuitem', { name: /全部重新审查/ }).click();
      await page.waitForFunction(() => window.CRPrototype.app.run?.status === 'running', null, { timeout: 5000 });
      await backToList();
      await openCard('del-demo-partial-failed');
      await backToList();
      await openCard(mainDeliveryId);
      check('B1: leaving while running records the terminated run, not the old success',
        (await workbenchState()).run === 'cancelled');
      await page.locator('.run-primary').click();
      await page.waitForFunction(() => window.CRPrototype.app.run?.status === 'succeeded', null, { timeout: 30000 });
      await page.waitForTimeout(200);
      const succeededState = await workbenchState();
      await backToList();
      await openCard('del-demo-partial-failed');
      await backToList();
      await openCard(mainDeliveryId);
      const returnedSucceeded = await workbenchState();
      check('B1: leaving after a completed run restores the completed result',
        succeededState.run === 'succeeded' && succeededState.supplementDisabled === false &&
        returnedSucceeded.run === 'succeeded' && returnedSucceeded.supplementDisabled === false &&
        returnedSucceeded.understandingValid === true);
      const succeededMarkdown = await downloadMarkdown();
      const succeededHtml = await downloadHtml();
      const succeededData = parseEmbeddedData(succeededHtml);
      check('exports name the based commit with title and short sha and use the shared conclusion',
        /^- 基于的提交：(提交「.+」（[0-9a-f]{7}）|[0-9a-f]{7})( · 含未提交改动)?$/m.test(succeededMarkdown) &&
        /^- 审查结论：发现 \d+ 个问题$/m.test(succeededMarkdown) &&
        succeededHtml.includes('审查结论：发现 ') && !succeededMarkdown.includes('工作树') &&
        !/^- 范围：.*base /m.test(succeededMarkdown) &&
        succeededData.snapshot?.range?.headSubject === (await page.evaluate(() => CRPrototype.app.snapshot.range.headSubject)));
      await page.getByRole('tab', { name: '变更说明' }).click();
      await page.waitForFunction(() => window.CRPrototype.app.mainView === 'overview', null, { timeout: 5000 });
      await page.waitForTimeout(200);
      const statusBar = await page.evaluate(() => {
        const bar = document.querySelector('#overview-conclusion .panel-status');
        const style = getComputedStyle(bar);
        return {
          role: bar.getAttribute('role'), tabindex: bar.getAttribute('tabindex'), title: bar.getAttribute('title'),
          cursor: style.cursor, border: style.borderColor, text: bar.innerText.replace(/\s+/g, ' ').trim(),
          scrollY: window.scrollY,
        };
      });
      await page.locator('#overview-conclusion .panel-status').hover();
      await page.waitForTimeout(120);
      const statusBarHover = await page.evaluate(() => {
        const bar = document.querySelector('#overview-conclusion .panel-status');
        const style = getComputedStyle(bar);
        return {
          cursor: style.cursor, border: style.borderColor, tooltip: Boolean(document.querySelector('[role="tooltip"]')),
          classClickable: bar.classList.contains('panel-status--clickable'),
        };
      });
      await page.locator('#overview-conclusion .panel-status').click();
      await page.waitForTimeout(200);
      const statusBarClick = await page.evaluate(() => ({
        view: CRPrototype.app.mainView,
        scrollY: window.scrollY,
        expanded: document.querySelectorAll('#overview-problems.overview-section--target').length,
      }));
      check('the conclusion status bar is display-only: no role, cursor, hover border, tooltip or click effect',
        statusBar.role === null && statusBar.tabindex === null && statusBar.title === null &&
        statusBar.cursor !== 'pointer' && statusBarHover.cursor === statusBar.cursor &&
        statusBarHover.border === statusBar.border && statusBarHover.tooltip === false &&
        statusBarHover.classClickable === false && statusBarClick.expanded === 0 &&
        statusBarClick.view === 'overview' && Math.abs(statusBarClick.scrollY - statusBar.scrollY) <= 1);
      await page.evaluate(() => {
        const host = document.createElement('div');
        host.id = 'evidence-fade-probe';
        host.style.cssText = 'width:300px;padding:8px';
        host.innerHTML = CRPrototype.convertToMarkdown('```evidence:1-1\nconst x = 1;\n```', { iconButtons: true })
          + CRPrototype.convertToMarkdown('```evidence:1-3\n' + 'const veryLongIdentifierName = "0123456789012345678901234567890123456789";\n'.repeat(3) + '```', { iconButtons: true });
        document.querySelector('.overview-main').append(host);
      });
      await page.waitForTimeout(250);
      const fades = await page.evaluate(() => {
        const host = document.getElementById('evidence-fade-probe');
        return [...host.querySelectorAll('.gpt-evidence-block')].map(block => {
          const pre = block.querySelector('pre');
          const fade = block.querySelector('.gpt-evidence-fade');
          return {
            overflow: pre.scrollWidth - pre.clientWidth,
            fadeRight: block.classList.contains('is-fade-right'),
            fadeDisplay: getComputedStyle(fade).display,
            mask: getComputedStyle(pre).maskImage,
            preBg: getComputedStyle(pre).backgroundColor,
            fadeBg: getComputedStyle(fade).backgroundImage,
            preRect: pre.getBoundingClientRect().toJSON(),
            fadeRect: fade.getBoundingClientRect().toJSON(),
          };
        });
      });
      const shortFade = fades[0], longFade = fades[1];
      check('short evidence has no fade; long evidence fades only its text layer',
        shortFade.overflow <= 1 && shortFade.fadeRight === false && shortFade.fadeDisplay === 'none' &&
        longFade.overflow > 1 && longFade.fadeRight === true && longFade.fadeDisplay !== 'none' &&
        shortFade.mask === 'none' && longFade.mask === 'none' &&
        longFade.fadeRect.right <= longFade.preRect.right - 0.5 && longFade.fadeBg.includes('rgb('));
      const scrolled = await page.evaluate(() => {
        const host = document.getElementById('evidence-fade-probe');
        const block = host.querySelectorAll('.gpt-evidence-block')[1];
        const pre = block.querySelector('pre');
        pre.scrollLeft = pre.scrollWidth;
        pre.dispatchEvent(new Event('scroll', { bubbles: true }));
        return { left: pre.scrollLeft, max: pre.scrollWidth - pre.clientWidth, fade: block.classList.contains('is-fade-right') };
      });
      check('the evidence fade disappears at the far right', scrolled.left >= scrolled.max - 1 && scrolled.fade === false);
      await shot('38-evidence-blocks-light');
      await page.emulateMedia({ colorScheme: 'dark' });
      await page.waitForTimeout(120);
      await shot('38-evidence-blocks-dark');
      await page.emulateMedia({ colorScheme: 'light' });
      await page.evaluate(() => document.getElementById('evidence-fade-probe')?.remove());
    }

    if (scoped('list')) {
      await open({ scenario: 'list' });
      const tableRows = [
        ['del-demo-partial-pending', ['3 个文件待审'], 'Review All', '3 个文件待审', null, '不完整（3 个文件待审）'],
        ['del-demo-partial-failed', ['1 个文件审查失败'], '重试', '1 个文件审查失败', null, '不完整（1 个文件审查失败）'],
        ['del-demo-withheld-only', ['2 条结论未通过校验'], '2 条结论未通过校验', '2 条结论未通过校验', null, '不完整（2 条结论未通过校验）'],
        ['del-demo-run-failed', ['审查失败'], '重试', '审查失败', null, '审查失败'],
        ['del-demo-read-incomplete', ['代码读取不完整'], '代码读取不完整', '代码读取不完整', '读取时代码有改动，改完后重新审查', '不完整（代码读取不完整）'],
      ];
      for (const [deliveryId, pills, toolbarText, conclusionTitle, conclusionDetail, exportText] of tableRows) {
        await open({ scenario: 'list' });
        const cardPills = await page.evaluate(id => [...document.querySelectorAll(`.delivery-row[data-delivery-id="${id}"] .delivery-status`)].map(pill => pill.innerText.trim()), deliveryId);
        await page.locator(`.delivery-row[data-delivery-id="${deliveryId}"] .delivery-main`).click();
        await page.waitForTimeout(260);
        await page.getByRole('tab', { name: '变更说明' }).click();
        await page.waitForTimeout(180);
        const workbench = await page.evaluate(() => {
          const app = CRPrototype.app;
          return {
            reason: document.querySelector('.wb-reason-link')?.innerText.trim() || '',
            primary: document.querySelector('.run-primary')?.innerText.trim() || '',
            runLabel: document.querySelector('.run-state__label')?.innerText.trim() || '',
            title: document.querySelector('#overview-conclusion .panel-status b')?.innerText.trim() || '',
            detail: document.querySelector('#overview-conclusion .panel-status p')?.innerText.trim() || '',
            exportText: CRPrototype.exports.exportReview(CRPrototype.exports.buildExportContext(app)).label,
            pending: app.pendingCount,
          };
        });
        const toolbarShown = workbench.reason || workbench.primary;
        check('review-status table row ' + deliveryId + ' matches card, toolbar, conclusion and export',
          JSON.stringify(cardPills) === JSON.stringify(pills) && toolbarShown === toolbarText &&
          workbench.title === conclusionTitle && (conclusionDetail === null || workbench.detail === conclusionDetail) &&
          workbench.exportText === exportText);
      }
      await open({ scenario: 'list' });
      const multiPills = await page.evaluate(() => [...document.querySelectorAll('.delivery-row[data-delivery-id="del-demo-multi"] .delivery-status')].map(pill => pill.innerText.trim()));
      await page.locator('.delivery-row[data-delivery-id="del-demo-multi"] .delivery-main').click();
      await page.waitForTimeout(260);
      await page.getByRole('tab', { name: '变更说明' }).click();
      await page.waitForTimeout(180);
      const multi = await page.evaluate(() => {
        const app = CRPrototype.app;
        const bar = document.querySelector('#overview-conclusion .panel-status');
        return {
          primary: document.querySelector('.run-primary')?.innerText.trim() || '',
          reason: document.querySelector('.wb-reason-link')?.innerText.trim() || '',
          title: bar.querySelector('b').innerText.trim(),
          lines: [...bar.querySelectorAll('p')].map(node => node.innerText.trim()),
          exportText: CRPrototype.exports.exportReview(CRPrototype.exports.buildExportContext(app)).label,
        };
      });
      check('multiple reasons show one toolbar action and list every reason in priority order',
        JSON.stringify(multiPills) === JSON.stringify(['2 项待处理']) && multi.reason === '' && multi.primary === '重试' &&
        multi.title === '2 项待处理' && multi.lines.length === 2 &&
        multi.lines[0].startsWith('1 个文件审查失败：') && multi.lines[1].startsWith('2 个文件待审：') &&
        multi.exportText === '不完整（1 个文件审查失败；2 个文件待审）');
      const lengths = await page.evaluate(() => {
        const rows = [];
        document.querySelectorAll('#overview-conclusion .panel-status b').forEach(node => rows.push(node.innerText.trim()));
        return rows;
      });
      check('conclusion titles keep each status segment within twelve characters',
        lengths.every(title => title.split(' · ').every(segment => [...segment].length <= 12)));
      await shot('39-conclusion-multi-light');
      await page.emulateMedia({ colorScheme: 'dark' });
      await page.waitForTimeout(120);
      await shot('39-conclusion-multi-dark');
      await page.emulateMedia({ colorScheme: 'light' });

      await open({ scenario: 'list' });
      await page.locator('.delivery-row[data-delivery-id="del-demo-on-target"] .delivery-main').click();
      await page.waitForTimeout(260);
      const onTarget = await page.evaluate(() => ({
        meta: document.querySelector('.wb-meta')?.innerText.replace(/\s+/g, ' ').trim(),
      }));
      await page.locator('.wb-record-trigger').click();
      await page.waitForTimeout(120);
      const onTargetSource = await page.evaluate(() => document.querySelector('.record-item__code')?.innerText.trim() || '');
      check('a delivery on the target branch writes uncommitted changes', onTarget.meta === 'main · 未提交的改动' && onTargetSource === '未提交的改动');
      const onTargetMarkdown = await page.evaluate(() => CRPrototype.exports.buildMarkdown(CRPrototype.app.exportContext()));
      check('a record with a commit subject exports the title together with the short sha',
        /^- 基于的提交：提交「fix\(on-target\): 目标分支上的未提交改动」（[0-9a-f]{7}） · 含未提交改动$/m.test(onTargetMarkdown));

      await open({ scenario: 'list' });
      await page.locator('.delivery-row[data-delivery-id="del-demo-partial-pending"] .delivery-main').click();
      await page.waitForTimeout(260);
      await page.locator('.wb-record-trigger').click();
      await page.waitForTimeout(120);
      const archived = await page.evaluate(() => {
        const source = document.querySelector('.record-item__source');
        const session = document.querySelector('.record-item__session');
        return {
          text: source?.innerText.replace(/\s+/g, ' ').trim() || '',
          tag: session?.tagName || '',
          title: session?.getAttribute('title') || '',
          links: document.querySelectorAll('.record-item__session-link').length,
        };
      });
      check('an archived source session is plain text with a suffix and a tooltip',
        archived.text.includes('导出模板整理（旧） （会话已归档）') || archived.text.includes('导出模板整理（旧）（会话已归档）'));
      check('archived sessions are not clickable in the record dropdown',
        archived.tag === 'SPAN' && archived.title === '该会话已归档，取消归档后查看' && archived.links === 0);
      const beforeArchivedCopy = await page.evaluate(() => ({ copies: CRPrototype.sendBack.copies, writes: CRPrototype.sendBack.writes, draft: CRPrototype.app.dshDraft }));
      await page.locator('.record-item').first().click();
      await page.waitForTimeout(180);
      await page.getByRole('button', { name: '导出与发回', exact: true }).click();
      await page.getByRole('menuitem', { name: /修改问题/ }).click();
      await page.waitForTimeout(220);
      const archivedCopy = await page.evaluate(() => ({
        copies: CRPrototype.sendBack.copies, writes: CRPrototype.sendBack.writes,
        draft: CRPrototype.app.dshDraft, message: CRPrototype.ui.message,
      }));
      check('sending back to an archived session copies instead of writing a draft',
        archivedCopy.copies === beforeArchivedCopy.copies + 1 && archivedCopy.writes === beforeArchivedCopy.writes &&
        archivedCopy.draft === beforeArchivedCopy.draft &&
        archivedCopy.message === '关联会话已归档，已复制到剪贴板；取消归档后可直接发回');
      await shot('40-sendback-archived');

      await open({ scenario: 'list' });
      await page.locator('.delivery-row[data-delivery-id="del-demo-long-branch"] .delivery-main').click();
      await page.waitForTimeout(260);
      await page.setViewportSize({ width: 1000, height: 800 });
      await page.waitForTimeout(150);
      const narrowHeader = await page.evaluate(() => {
        const row = document.querySelector('.wb-meta-row');
        const children = [...row.children].map(node => node.getBoundingClientRect());
        const range = document.querySelector('.wb-meta-range');
        const trigger = document.querySelector('.wb-record-trigger').getBoundingClientRect();
        const toolbar = document.querySelector('.wb-toolbar');
        return {
          sameLine: children.every(rect => Math.abs(rect.top - children[0].top) < 3),
          rangeClipped: range.scrollWidth > range.clientWidth + 1,
          triggerVisible: trigger.right <= document.querySelector('.wb-header').getBoundingClientRect().right,
          toolbarWrap: toolbar.scrollWidth > toolbar.clientWidth + 1,
          headerHeight: document.querySelector('.wb-header').getBoundingClientRect().height,
        };
      });
      check('at 1000px with a 30-character branch the header stays on one line and the range is not clipped',
        narrowHeader.sameLine && narrowHeader.rangeClipped === false && narrowHeader.triggerVisible &&
        narrowHeader.toolbarWrap === false && narrowHeader.headerHeight === 52);
      await shot('41-header-1000-light');
      await page.emulateMedia({ colorScheme: 'dark' });
      await page.waitForTimeout(120);
      await shot('41-header-1000-dark');
      await page.emulateMedia({ colorScheme: 'light' });
      await page.setViewportSize({ width: 1176, height: 834 });
      await page.waitForTimeout(120);
      await page.locator('.wb-record-trigger').click();
      await page.waitForTimeout(120);
      const recordMenuMetrics = await page.evaluate(() => {
        const menu = document.querySelector('.record-menu');
        const row = menu.querySelector('.record-item');
        const items = [...menu.querySelectorAll('.record-item')];
        return {
          width: menu.getBoundingClientRect().width,
          firstLine: row.querySelector('.record-item__top')?.innerText.replace(/\s+/g, ' ').trim(),
          sources: items.map(item => item.querySelector('.record-item__source')?.innerText.replace(/\s+/g, ' ').trim() || ''),
          times: items.map(item => item.querySelector('.record-item__time')?.innerText.trim() || ''),
          hoverTitles: items.map(item => item.getAttribute('title') || ''),
          visibleText: menu.innerText,
        };
      });
      check('record dropdown rows are two lines with time, conclusion, code source and hover sha',
        Math.abs(recordMenuMetrics.width - 360) <= 1 &&
        /^(✓ )?\d{2}-\d{2} \d{2}:\d{2} 最新 未发现问题$/.test(recordMenuMetrics.firstLine) &&
        recordMenuMetrics.sources.every(source => /(提交「|未提交的改动)/.test(source)) &&
        !/[\s(（:：](?=[0-9a-f]*\d)[0-9a-f]{7,12}(?=[\s)）]|$)/i.test(recordMenuMetrics.visibleText) &&
        recordMenuMetrics.hoverTitles.every(title => /\b[0-9a-f]{7}\b/.test(title)));
      await shot('42-records-menu-light');
      await page.emulateMedia({ colorScheme: 'dark' });
      await page.waitForTimeout(120);
      await shot('42-records-menu-dark');
      await page.emulateMedia({ colorScheme: 'light' });

      }
      if (scoped('records')) {
      await open({ scenario: 'records' });
      await page.locator('.wb-record-trigger').click();
      await page.waitForTimeout(120);
      const adjacent = await page.evaluate(() => {
        const items = [...document.querySelectorAll('.record-menu .record-item')];
        return {
          times: items.map(item => item.querySelector('.record-item__time')?.innerText.trim()),
          sources: items.map(item => item.querySelector('.record-item__source')?.innerText.replace(/\s+/g, ' ').trim()),
          visible: document.querySelector('.record-menu').innerText,
          longClipped: (() => {
            const code = items[1]?.querySelector('.record-item__code');
            return code ? code.scrollWidth > code.clientWidth + 1 : false;
          })(),
        };
      });
      check('adjacent records with the same HEAD repeat the commit title on the second line',
        adjacent.times[1] !== adjacent.times[2] &&
        adjacent.sources[1].includes('收尾顶栏、审查记录下拉与导出结论') &&
        adjacent.sources[2].includes('收尾顶栏、审查记录下拉与导出结论') &&
        adjacent.sources[3].includes('merge(dev): 合入双端调试') && adjacent.longClipped === true);
      check('record rows keep every sha out of the visible text', !/[\s(（:：](?=[0-9a-f]*\d)[0-9a-f]{7,12}(?=[\s)）]|$)/i.test(adjacent.visible));
      await page.locator('.record-menu .record-item').nth(1).click();
      await page.waitForTimeout(220);
      const earlierView = await page.evaluate(() => ({
        capsule: document.querySelector('.wb-record-trigger').innerText.replace(/\s+/g, ' ').trim(),
        banner: document.querySelector('.wb-history-banner')?.innerText.replace(/\s+/g, ' ').trim() || '',
      }));
      check('an earlier record hides latest from the capsule and the time from the banner',
        !earlierView.capsule.includes('最新') && earlierView.banner === '正在查看较早的审查记录（只读） · 打开最新审查 →');
      await page.getByRole('tab', { name: '变更说明' }).click();
      await page.waitForTimeout(180);
      const earlierBar = await page.evaluate(() => document.querySelector('#overview-conclusion .panel-status')?.innerText.replace(/\s+/g, ' ').trim() || '');
      check('an earlier record still shows a conclusion without the retired wording', earlierBar.length > 0 && !earlierBar.includes('审查不完整'));
    }

    markStep('A2: codex recheck regressions');
    // ---------- A2: Codex 复验回归 ----------
    if (scoped('list')) {
      await open({ scenario: 'list' });
      await page.locator('.delivery-row[data-delivery-id="del-demo-incomplete"] .delivery-main').click();
      await page.waitForTimeout(280);
      const incompleteBefore = await page.evaluate(() => ({
        withheld: CRPrototype.app.withheldCount,
        complete: CRPrototype.app.reviewCompleteNow,
        active: CRPrototype.app.activeFindingCount,
      }));
      await page.locator('.focus-tree-row[data-path="prototype/src/demo/incomplete/api.js"]').click();
      await page.waitForTimeout(220);
      const issueId = await page.evaluate(() => {
        const issue = CRPrototype.app.selectedIssues.find(entry => !entry.suppressed);
        return issue?.issueKey || '';
      });
      await page.locator(`.gpt-risk-marker[data-issue-key="${issueId}"] .file-risk-item__suppress-btn`).click();
      await page.waitForTimeout(80);
      await page.locator('.n-popconfirm .n-button').filter({ hasText: '标记' }).click();
      await page.waitForTimeout(400);
      await page.locator('.wb-back').click();
      await page.waitForTimeout(220);
      const markedCard = await page.evaluate(() => {
        const app = CRPrototype.app;
        const row = document.querySelector('.delivery-row[data-delivery-id="del-demo-incomplete"]');
        return {
          pills: [...row.querySelectorAll('.delivery-status')].map(pill => pill.innerText.trim()),
          latest: { ...app.deliveries.find(item => item.deliveryId === 'del-demo-incomplete')?.latest },
          state: app.deliveryReviewState(app.deliveries.find(item => item.deliveryId === 'del-demo-incomplete')),
        };
      });
      check('marking the last finding keeps the withholding reason on the list card', incompleteBefore.withheld > 0 &&
        incompleteBefore.complete === false && incompleteBefore.active === 1 &&
        markedCard.state.kind !== 'zero' && !markedCard.pills.includes('未发现问题') &&
        markedCard.pills.some(pill => pill.includes('未通过校验')) &&
        markedCard.pills.every(pill => [...pill].length <= 10));
      await page.locator('.delivery-row[data-delivery-id="del-demo-incomplete"] .delivery-main').click();
      await page.waitForTimeout(280);
      const incompleteAfter = await page.evaluate(() => ({
        complete: CRPrototype.app.reviewCompleteNow,
        withheld: CRPrototype.app.withheldCount,
        state: CRPrototype.app.reviewState,
      }));
      check('re-entering a partially disposed record still withholds its conclusions', incompleteAfter.complete === false &&
        incompleteAfter.withheld > 0 && incompleteAfter.state.kind !== 'zero' &&
        !incompleteAfter.state.exportText.includes('未发现问题'));
      await page.locator('.wb-back').click();
      await page.waitForTimeout(170);

      const statusSamples = await page.evaluate(() => {
        const sample = input => CRPrototype.status.reviewStateOf(input);
        const base = { snapshotStatus: 'complete', runStatus: 'succeeded', complete: true, pendingCount: 0, failedCount: 0, withheldCount: 0, activeFindings: 0 };
        return {
          findingsWithheld: sample({ ...base, complete: false, activeFindings: 7, withheldCount: 3 }),
          runFailed: sample({ ...base, complete: false, runStatus: 'failed', activeFindings: 0, pendingCount: 4 }),
          cancelled: sample({ ...base, complete: false, runStatus: 'cancelled', activeFindings: 0, pendingCount: 5 }),
          queued: sample({ ...base, complete: false, runStatus: 'queued' }),
          noneReviewed: sample({ ...base, complete: false, runStatus: null, activeFindings: 0, pendingCount: 3 }),
          unknownCodeRead: sample({ ...base, complete: false, snapshotStatus: 'incomplete', codeReadReason: 'not-mapped' }),
          largeWithheld: sample({ ...base, complete: false, activeFindings: 0, withheldCount: 12 }),
          inconsistent: sample({ ...base, complete: false, activeFindings: 0, withheldCount: 0 }),
          sessions: {
            missingId: CRPrototype.status.sessionStateOf({ title: '无 ID 会话' }),
            missingTitle: CRPrototype.status.sessionViewOf({ sessionId: 's1' }),
            archived: CRPrototype.status.sessionViewOf({ sessionId: 's2', title: '旧会话', archived: true }),
          },
        };
      });
      check('status samples keep findings with reasons, run failure, cancel and queue wording', 
        statusSamples.findingsWithheld.conclusion.title === '发现 7 个问题 · 3 条结论未通过校验' &&
        statusSamples.findingsWithheld.exportText === '发现 7 个问题；不完整（3 条结论未通过校验）' &&
        statusSamples.runFailed.exportText === '审查失败' &&
        statusSamples.cancelled.toolbar.label === '重新审查' &&
        statusSamples.queued.pills[0].text === '审查中' && statusSamples.queued.toolbar.label === '排队中');
      check('status samples keep an unreviewed record pending and never default an unknown record to green',
        statusSamples.noneReviewed.pills[0].text === '待审' && statusSamples.noneReviewed.conclusion.title === '待审' &&
        statusSamples.inconsistent.kind !== 'zero' && !statusSamples.inconsistent.exportText.includes('未发现问题'));
      check('status samples give an unknown code-read cause a readable explanation and keep pills within ten characters',
        statusSamples.unknownCodeRead.conclusion.detail === '读取时未能取得稳定代码，请重新审查' &&
        statusSamples.largeWithheld.pills.every(pill => [...pill.text].length <= 10));
      check('session samples require an addressable id and fall back for missing titles',
        statusSamples.sessions.missingId === 'unaddressable' &&
        statusSamples.sessions.missingTitle.text === '未命名会话' &&
        statusSamples.sessions.missingTitle.suffix === '' &&
        statusSamples.sessions.archived.suffix === '（会话已归档）');

      await open({ scenario: 'list' });
      const setTarget = async value => {
        await page.getByRole('button', { name: '工作区设置', exact: true }).click();
        await page.waitForTimeout(120);
        await page.locator('.list-settings-menu .wb-setting-row--stack input').fill(value);
        await page.waitForTimeout(120);
        await page.keyboard.press('Escape');
        await page.waitForTimeout(100);
      };
      const readTarget = () => page.evaluate(() => CRPrototype.app.targetBranchOverride);
      const switchWorkspace = async name => {
        await page.locator('.list-workspace-switch').click();
        await page.waitForTimeout(100);
        await page.locator('.workspace-item').filter({ hasText: name }).first().click();
        await page.waitForTimeout(180);
      };
      await setTarget('audit-main-A');
      await switchWorkspace('demo-notes');
      const notesInitial = await readTarget();
      await setTarget('audit-notes-B');
      await switchWorkspace('demo-app');
      const backToMain = await readTarget();
      await switchWorkspace('prototype');
      const sameRepoChild = await readTarget();
      await switchWorkspace('scratch');
      const nonGitValue = await readTarget();
      await switchWorkspace('demo-notes');
      const backToNotes = await readTarget();
      check('settings are stored per repository and never leak across repositories',
        notesInitial === '' && backToMain === 'audit-main-A' && sameRepoChild === 'audit-main-A' &&
        nonGitValue === '' && backToNotes === 'audit-notes-B');
    }

    markStep('A2b: coverage.withheld restoration');
    // ---------- A2b: formal coverage.withheld survives record navigation ----------
    if (scoped('list')) {
      const withheldDelivery = 'del-demo-withheld-only';
      await open({ scenario: 'list' });
      await page.locator(`.delivery-row[data-delivery-id="${withheldDelivery}"] .delivery-main`).click();
      await page.waitForTimeout(260);
      const coverageSnapshotId = await page.evaluate(() => CRPrototype.app.snapshot.snapshotId);
      await page.locator('.wb-back').click();
      await page.waitForTimeout(200);
      await page.locator('.delivery-row[data-delivery-id="del-demo-partial-failed"] .delivery-main').click();
      await page.waitForTimeout(200);
      await page.locator('.wb-back').click();
      await page.waitForTimeout(160);
      await page.evaluate(snapshotId => {
        const app = CRPrototype.app;
        const data = window.CR_PROTOTYPE_DATA;
        const delivery = app.deliveries.find(item => item.deliveryId === 'del-demo-withheld-only');
        const fixture = JSON.parse(JSON.stringify(data.records[snapshotId]));
        fixture.coverage = {
          ...fixture.coverage,
          reviewed: fixture.snapshot.files.filter(file => file.kind === 'text').map(file => file.path),
          failed: [],
          withheld: [
            { kind: 'finding', ref: 'w-contract-finding', code: 'evidence-quote-mismatch' },
            { kind: 'statement', ref: 'w-contract-statement', code: 'missing-ref' },
          ],
        };
        fixture.withheldFindings = [];
        data.records[snapshotId] = fixture;
        if (delivery?.records) delete delivery.records[snapshotId];
      }, coverageSnapshotId);
      await page.locator(`.delivery-row[data-delivery-id="${withheldDelivery}"] .delivery-main`).click();
      await page.waitForTimeout(280);
      const restoredCoverage = await page.evaluate(snapshotId => {
        const app = CRPrototype.app;
        return {
          snapshot: app.snapshot.snapshotId,
          expected: snapshotId,
          withheld: app.withheldCount,
          coverageWithheld: (app.coverage?.withheld || []).length,
          runWithheld: (app.run?.coverage?.withheld || []).length,
          complete: app.reviewCompleteNow,
          state: app.reviewState,
        };
      }, coverageSnapshotId);
      check('restoring a record keeps formal coverage.withheld and stays incomplete',
        restoredCoverage.snapshot === restoredCoverage.expected &&
        restoredCoverage.withheld === 2 && restoredCoverage.coverageWithheld === 2 &&
        restoredCoverage.runWithheld === 2 && restoredCoverage.complete === false &&
        restoredCoverage.state.kind !== 'zero' &&
        restoredCoverage.state.conclusion.title === '2 条结论未通过校验');
      const [withheldMdDownload] = await Promise.all([
        page.waitForEvent('download'),
        page.getByRole('button', { name: '导出与发回', exact: true }).click().then(() =>
          page.getByRole('menuitem', { name: /变更日志（Markdown）/ }).click()),
      ]);
      const withheldMarkdown = fs.readFileSync(await withheldMdDownload.path(), 'utf8');
      await page.getByRole('button', { name: '导出与发回', exact: true }).click();
      const [withheldHtmlDownload, withheldPreview] = await Promise.all([
        page.waitForEvent('download'), page.waitForEvent('popup'),
        page.getByRole('menuitem', { name: /评审报告（HTML）/ }).click(),
      ]);
      const withheldHtml = fs.readFileSync(await withheldHtmlDownload.path(), 'utf8');
      await withheldPreview.close();
      const withheldData = parseEmbeddedData(withheldHtml);
      check('both exports keep the restored validation gap and stay incomplete',
        /^- 审查结论：不完整（2 条结论未通过校验）$/m.test(withheldMarkdown) &&
        withheldData.review?.complete === false && (withheldData.review?.withheld || []).length === 2 &&
        withheldData.run?.status === 'succeeded');
      const mergedWithheld = await page.evaluate(() => {
        const record = JSON.parse(JSON.stringify(window.CR_PROTOTYPE_DATA.records[CRPrototype.app.snapshot.snapshotId]));
        record.coverage.withheld = [
          { kind: 'finding', ref: 'dup-finding', code: 'q' },
          { kind: 'statement', ref: 'only-formal', code: 'missing-ref' },
        ];
        record.withheldFindings = [
          { kind: 'finding', findingId: 'dup-finding', code: 'q', anchor: { path: record.snapshot.files[0].path } },
          { kind: 'finding', findingId: 'extra-finding', code: 'x', anchor: { path: record.snapshot.files[0].path } },
        ];
        const scenario = CRPrototype.createRecordScenario(record);
        return {
          coverage: scenario.coverage.withheld.map(entry => `${entry.kind}:${entry.ref}:${entry.code}`),
          run: scenario.run.coverage.withheld.map(entry => `${entry.kind}:${entry.ref}:${entry.code}`),
          complete: scenario.reviewComplete,
        };
      });
      check('overlapping formal and auxiliary withheld entries are merged once',
        mergedWithheld.coverage.length === 3 &&
        new Set(mergedWithheld.coverage).size === 3 &&
        JSON.stringify(mergedWithheld.run) === JSON.stringify(mergedWithheld.coverage) &&
        mergedWithheld.coverage.includes('statement:only-formal:missing-ref') &&
        mergedWithheld.coverage.includes('finding:extra-finding:x') && mergedWithheld.complete === false);
    }

    markStep('B: list order, pin, archive and delete');
    // ---------- B: 交付列表排序、置顶与归档 ----------
    if (scoped('list')) {
      const listStateKey = 'evidentloop-demo-list-state';
      await page.evaluate(key => window.localStorage.removeItem(key), listStateKey);
      await open({ scenario: 'list' });
      const initialList = await page.evaluate(() => {
        const app = CRPrototype.app;
        return {
          active: app.deliveryRows.map(delivery => delivery.deliveryId),
          archived: app.archivedDeliveryRows.map(delivery => delivery.deliveryId),
          activities: app.deliveryRows.map(delivery => app.listMeta(delivery).activity),
          pinned: app.deliveryRows.filter(delivery => app.listMeta(delivery).pinned).map(delivery => delivery.deliveryId),
          header: app.listCountText,
          toggle: document.querySelector('.delivery-archive-toggle')?.innerText.replace(/\s+/g, ' ').trim() || '',
          expanded: app.archiveExpanded,
          groupCards: document.querySelectorAll('.delivery-grid--archive .delivery-row').length,
        };
      });
      check('list sorts pinned deliveries first and then by latest activity',
        JSON.stringify(initialList.pinned) === JSON.stringify(['del-demo-partial-pending', 'del-demo-zero']) &&
        initialList.active.slice(0, 2).join(',') === initialList.pinned.join(',') &&
        initialList.activities.slice(2).every((value, index, array) => index === 0 || array[index - 1] >= value) &&
        initialList.pinned.every((id, index) => index === 0 || true));
      check('merged deliveries auto-archive once and cancelled archives stay active',
        initialList.archived.includes('del-demo-merged') && initialList.archived.includes('del-demo-manual-archived') &&
        initialList.active.includes('del-demo-merged-unarchived') && !initialList.archived.includes('del-demo-merged-unarchived'));
      check('archived group starts collapsed, shows its count and hides when empty',
        initialList.toggle.includes('归档 2') && initialList.expanded === false && initialList.groupCards === 0 &&
        initialList.header === '12 个进行中');
      const pinStyle = await page.evaluate(() => {
        const pin = document.querySelector('.delivery-row[data-delivery-id="del-demo-partial-pending"] .delivery-pin');
        const title = document.querySelector('.delivery-row[data-delivery-id="del-demo-partial-pending"] .delivery-title');
        const style = pin ? getComputedStyle(pin) : null;
        return {
          size: pin ? pin.querySelector('svg').getBoundingClientRect().width : 0,
          color: style?.color || '',
          baseDelta: pin && title ? Math.abs((pin.getBoundingClientRect().top + pin.getBoundingClientRect().height / 2) - (title.getBoundingClientRect().top + title.getBoundingClientRect().height / 2)) : 99,
          gap: pin && title ? Math.round(title.getBoundingClientRect().left - pin.getBoundingClientRect().right) : 99,
          translate: style?.transform || '',
        };
      });
      check('pinned cards show a neutral 14px pin aligned with the title',
        pinStyle.size === 14 && pinStyle.color === 'rgb(97, 102, 107)' && pinStyle.baseDelta <= 1.5 &&
        pinStyle.gap === 4 && pinStyle.translate === 'none');
      check('the more menu renders the dots icon and stays above the neighbouring cards',
        await page.evaluate(() => {
          const row = document.querySelector('.delivery-row[data-delivery-id="del-demo-partial-pending"]');
          const more = row.querySelector('.delivery-more');
          more.click();
          return new Promise(resolve => setTimeout(() => {
            const menu = row.querySelector('.delivery-menu');
            const rect = menu.getBoundingClientRect();
            const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + 12);
            resolve(Boolean(menu) && more.querySelectorAll(':scope > svg').length === 1 &&
              getComputedStyle(menu).visibility === 'visible' &&
              Boolean(hit && menu.contains(hit)));
          }, 120));
        }));
      await page.keyboard.press('Escape');
      await page.waitForTimeout(80);
      const activeStyle = await page.locator('.delivery-row').first().evaluate(element => { const style = getComputedStyle(element); return [style.backgroundColor, style.borderTopColor, style.borderTopLeftRadius, style.opacity, style.color].join('|'); });
      await page.locator('.delivery-archive-toggle').click();
      await page.waitForTimeout(140);
      const expandedGroup = await page.evaluate(activeStyle => {
        const activeCard = document.querySelector('.delivery-grid:not(.delivery-grid--archive) .delivery-row');
        const archivedCard = document.querySelector('.delivery-grid--archive .delivery-row');
        const cardStyle = element => {
          const style = getComputedStyle(element);
          return [style.backgroundColor, style.borderTopColor, style.borderTopLeftRadius, style.opacity, style.color].join('|');
        };
        return {
          selected: document.querySelector('.delivery-archive-toggle')?.getAttribute('aria-pressed'),
          cards: document.querySelectorAll('.delivery-grid--archive .delivery-row').length,
          sameStyle: activeStyle === cardStyle(archivedCard),
          badges: document.querySelectorAll('.delivery-grid--archive .delivery-archived-label, .delivery-grid--archive .delivery-closed--archived').length,
        };
      }, activeStyle);
      check('archived group expands in place with the same card style and no archived badge',
        expandedGroup.selected === 'true' && expandedGroup.cards === 2 && expandedGroup.sameStyle && expandedGroup.badges === 0);
      await page.locator('.delivery-scope-all').click();
      await page.waitForTimeout(120);
      await page.locator('.delivery-row[data-delivery-id="del-demo-partial-pending"] .delivery-more').click();
      await page.waitForTimeout(100);
      const pinnedMenu = await page.locator('.delivery-row[data-delivery-id="del-demo-partial-pending"] .delivery-menu').innerText();
      await page.keyboard.press('Escape');
      await page.locator('.delivery-row[data-delivery-id="del-demo-long-branch"] .delivery-more').click();
      await page.waitForTimeout(100);
      const unpinnedMenu = await page.locator('.delivery-row[data-delivery-id="del-demo-long-branch"] .delivery-menu').innerText();
      check('active menus offer pin or unpin, archive and a separated destructive delete',
        pinnedMenu.includes('取消置顶') && unpinnedMenu.includes('置顶') && unpinnedMenu.includes('归档') &&
        unpinnedMenu.includes('删除'));
      await page.keyboard.press('Escape');
      await page.locator('.delivery-archive-toggle').click();
      await page.waitForTimeout(120);
      await page.locator('.delivery-row[data-delivery-id="del-demo-manual-archived"] .delivery-more').click();
      await page.waitForTimeout(100);
      const archivedMenu = await page.locator('.delivery-row[data-delivery-id="del-demo-manual-archived"] .delivery-menu .wb-menu-item').allInnerTexts();
      check('archived menus offer unarchive and delete without pin or archive',
        JSON.stringify(archivedMenu) === JSON.stringify(['取消归档', '删除']));
      await page.keyboard.press('Escape');
      await page.locator('.delivery-scope-all').click();
      await page.waitForTimeout(100);
      await page.locator('.delivery-row[data-delivery-id="del-demo-long-branch"] .delivery-more').click();
      await page.waitForTimeout(80);
      await page.locator('.delivery-row[data-delivery-id="del-demo-long-branch"] .delivery-menu .wb-menu-item').filter({ hasText: /^置顶/ }).click();
      await page.waitForTimeout(120);
      await page.reload();
      await page.waitForFunction(() => window.CRPrototype?.app && document.documentElement.dataset.ready === 'true');
      await page.waitForTimeout(200);
      const pinnedAfterReload = await page.evaluate(() => ({
        pinned: CRPrototype.app.deliveryRows.filter(delivery => CRPrototype.app.listMeta(delivery).pinned).map(delivery => delivery.deliveryId),
        longPinned: CRPrototype.app.listMeta(CRPrototype.app.deliveries.find(delivery => delivery.deliveryId === 'del-demo-long-branch')).pinned,
      }));
      check('pin survives a reload', pinnedAfterReload.longPinned && pinnedAfterReload.pinned.includes('del-demo-long-branch'));
      await page.evaluate(() => {
        const delivery = CRPrototype.app.deliveries.find(item => item.deliveryId === 'del-demo-long-branch');
        CRPrototype.app.archiveDelivery(delivery);
      });
      await page.waitForTimeout(120);
      const archivedLong = await page.evaluate(() => {
        const delivery = CRPrototype.app.deliveries.find(item => item.deliveryId === 'del-demo-long-branch');
        const meta = CRPrototype.app.listMeta(delivery);
        return { archived: meta.archived, pinned: meta.pinned, count: CRPrototype.app.listCountText };
      });
      check('archiving clears the pin and updates the active count', archivedLong.archived && !archivedLong.pinned && archivedLong.count === '11 个进行中');
      await page.reload();
      await page.waitForFunction(() => window.CRPrototype?.app && document.documentElement.dataset.ready === 'true');
      await page.waitForTimeout(200);
      const archivedLongReload = await page.evaluate(() => CRPrototype.app.listMeta(CRPrototype.app.deliveries.find(item => item.deliveryId === 'del-demo-long-branch')));
      check('archive survives a reload', archivedLongReload.archived === true && archivedLongReload.pinned === false);
      await page.evaluate(() => {
        const delivery = CRPrototype.app.deliveries.find(item => item.deliveryId === 'del-demo-long-branch');
        CRPrototype.app.unarchiveDelivery(delivery);
      });
      await page.reload();
      await page.waitForFunction(() => window.CRPrototype?.app && document.documentElement.dataset.ready === 'true');
      await page.waitForTimeout(200);
      const unarchivedLong = await page.evaluate(() => CRPrototype.app.listMeta(CRPrototype.app.deliveries.find(item => item.deliveryId === 'del-demo-long-branch')));
      check('unarchive restores the delivery without its old pin', unarchivedLong.archived === false && unarchivedLong.pinned === false);
      await page.evaluate(() => {
        const delivery = CRPrototype.app.deliveries.find(item => item.deliveryId === 'del-demo-merged');
        CRPrototype.app.unarchiveDelivery(delivery);
      });
      await page.reload();
      await page.waitForFunction(() => window.CRPrototype?.app && document.documentElement.dataset.ready === 'true');
      await page.waitForTimeout(200);
      const mergedUnarchived = await page.evaluate(() => CRPrototype.app.listMeta(CRPrototype.app.deliveries.find(item => item.deliveryId === 'del-demo-merged')));
      check('a cancelled auto-archive is not applied again on reload', mergedUnarchived.archived === false && mergedUnarchived.pinned === false);
      await page.evaluate(() => {
        const delivery = CRPrototype.app.deliveries.find(item => item.deliveryId === 'del-demo-merged');
        CRPrototype.app.archiveDelivery(delivery);
      });
      await page.evaluate(() => {
        const app = CRPrototype.app;
        const delivery = app.deliveries.find(item => item.deliveryId === 'del-demo-long-branch');
        const original = Storage.prototype.setItem;
        Storage.prototype.setItem = () => { throw new Error('quota'); };
        app.togglePin(delivery);
        Storage.prototype.setItem = original;
      });
      await page.waitForTimeout(100);
      const storageFailure = await page.evaluate(() => CRPrototype.app.listMeta(CRPrototype.app.deliveries.find(item => item.deliveryId === 'del-demo-long-branch')).pinned);
      check('pin still shows when browser storage rejects writes', storageFailure === true);
      await page.evaluate(() => {
        const app = CRPrototype.app;
        const delivery = app.deliveries.find(item => item.deliveryId === 'del-demo-long-branch');
        if (app.listMeta(delivery).pinned) app.togglePin(delivery);
      });

      await open({ scenario: 'list' });
      await page.locator('.delivery-row[data-delivery-id="del-demo-partial-pending"] .delivery-more').click();
      await page.waitForTimeout(80);
      await page.keyboard.press('Escape');
      await page.locator('.delivery-row[data-delivery-id="del-demo-partial-pending"] .delivery-main').click();
      await page.waitForTimeout(260);
      await page.locator('.run-primary').click();
      await page.waitForFunction(() => window.CRPrototype.app.run?.status === 'running', null, { timeout: 5000 });
      await page.locator('.dsh-nav-item--plugin').click();
      await page.waitForTimeout(200);
      await page.locator('.delivery-row[data-delivery-id="del-demo-partial-pending"] .delivery-more').click();
      await page.waitForTimeout(100);
      const runningArchive = await page.evaluate(() => {
        const menu = document.querySelector('.delivery-row[data-delivery-id="del-demo-partial-pending"] .delivery-menu');
        const archive = [...menu.querySelectorAll('.wb-menu-item')].find(item => item.innerText.includes('归档'));
        return {
          disabled: archive?.disabled, text: archive?.innerText.replace(/\s+/g, ' ').trim(), title: archive?.getAttribute('title'),
        };
      });
      check('a running delivery cannot be archived and explains why inside the item',
        runningArchive.disabled === true && runningArchive.text.includes('审查进行中，完成后可归档'));
      await page.keyboard.press('Escape');
      await page.evaluate(() => CRPrototype.app.cancelReview());
      await page.waitForTimeout(100);

      await open({ scenario: 'list' });
      await page.locator('input[aria-label="搜索交付"]').fill('手动归档');
      await page.waitForTimeout(140);
      const searchArchived = await page.evaluate(() => ({
        archivedMatches: CRPrototype.app.archivedDeliveryRows.length,
        expanded: CRPrototype.app.archiveExpanded,
        cards: document.querySelectorAll('.delivery-grid--archive .delivery-row').length,
      }));
      check('searching an archived delivery expands the archived group', searchArchived.archivedMatches === 1 &&
        searchArchived.expanded === true && searchArchived.cards === 1);
      await page.locator('.delivery-scope-all').click();
      await page.waitForTimeout(100);
      const searchCollapsed = await page.evaluate(() => CRPrototype.app.archiveExpanded);
      await page.locator('input[aria-label="搜索交付"]').fill('');
      await page.waitForTimeout(140);
      const searchCleared = await page.evaluate(() => CRPrototype.app.archiveExpanded);
      check('collapse during search is local and clearing restores the previous state', searchCollapsed === false && searchCleared === false);
      await page.locator('input[aria-label="搜索交付"]').fill('空状态');
      await page.waitForTimeout(140);
      const activeOnlySearch = await page.evaluate(() => ({ expanded: CRPrototype.app.archiveExpanded, archived: CRPrototype.app.archivedDeliveryRows.length }));
      await page.locator('input[aria-label="搜索交付"]').fill('手动归档');
      await page.waitForTimeout(140);
      const replacedSearch = await page.evaluate(() => ({
        expanded: CRPrototype.app.archiveExpanded,
        archived: CRPrototype.app.archivedDeliveryRows.length,
        cards: document.querySelectorAll('.delivery-grid--archive .delivery-row').length,
      }));
      check('replacing an active-only search with an archived match expands without a manual toggle',
        activeOnlySearch.expanded === false && activeOnlySearch.archived === 0 &&
        replacedSearch.expanded === true && replacedSearch.archived === 1 && replacedSearch.cards === 1);
      await page.locator('.delivery-scope-all').click();
      await page.waitForTimeout(100);
      await page.locator('input[aria-label="搜索交付"]').fill('已合并交付');
      await page.waitForTimeout(140);
      const manualSearch = await page.evaluate(() => CRPrototype.app.archiveExpanded);
      await page.locator('input[aria-label="搜索交付"]').fill('');
      await page.waitForTimeout(140);
      const manualCleared = await page.evaluate(() => CRPrototype.app.archiveExpanded);
      check('a manual collapse inside the search is preserved while typing and restored on clear', manualSearch === false && manualCleared === false);
      await page.locator('.delivery-archive-toggle').click();
      await page.waitForTimeout(100);
      await page.locator('input[aria-label="搜索交付"]').fill('手动归档');
      await page.waitForTimeout(140);
      const searchExpandedAgain = await page.evaluate(() => CRPrototype.app.archiveExpanded);
      await page.locator('input[aria-label="搜索交付"]').fill('');
      await page.waitForTimeout(140);
      const restoreExpanded = await page.evaluate(() => CRPrototype.app.archiveExpanded);
      check('clearing search restores the expanded state captured before the search', searchExpandedAgain === true && restoreExpanded === true);

      await open({ scenario: 'list' });
      await shot('45-list-pinned-light');
      await page.locator('.delivery-row[data-delivery-id="del-demo-partial-pending"] .delivery-more').click();
      await page.waitForTimeout(100);
      await shot('47-list-menu-light');
      await page.keyboard.press('Escape');
      await page.locator('.delivery-archive-toggle').click();
      await page.waitForTimeout(120);
      await shot('46-archive-group-light');
      await page.emulateMedia({ colorScheme: 'dark' });
      await page.waitForTimeout(120);
      await shot('46-archive-group-dark');
      await page.locator('.delivery-row[data-delivery-id="del-demo-manual-archived"] .delivery-more').click();
      await page.waitForTimeout(100);
      await shot('47-list-menu-dark');
      await page.keyboard.press('Escape');
      await page.locator('.delivery-scope-all').click();
      await page.waitForTimeout(100);
      await shot('45-list-pinned-dark');
      await page.emulateMedia({ colorScheme: 'light' });
      await page.waitForTimeout(100);
      await page.locator('.delivery-row[data-delivery-id="del-demo-multi"] .delivery-more').click();
      await page.waitForTimeout(80);
      await page.locator('.delivery-row[data-delivery-id="del-demo-multi"] .delivery-menu .wb-menu-item--danger').click();
      await page.waitForTimeout(120);
      const deleteDialog = await page.evaluate(() => {
        const modal = document.querySelector('.delete-modal');
        const title = modal.querySelector('h2');
        const body = modal.querySelector('.delete-modal__body');
        const buttons = [...modal.querySelectorAll('.n-button')];
        const cancel = buttons.find(button => button.innerText.trim() === '取消');
        const danger = buttons.find(button => button.innerText.trim() === '删除');
        return {
          title: title?.innerText.trim(), body: body?.innerText.trim(), width: getComputedStyle(modal).width,
          titleFont: [getComputedStyle(title).fontSize, getComputedStyle(title).fontWeight].join(' '),
          bodyFont: getComputedStyle(body).fontSize, bodyColor: getComputedStyle(body).color,
          cancelFocused: document.activeElement === cancel,
          cancelStyle: [cancel ? getComputedStyle(cancel).backgroundColor : '', cancel ? getComputedStyle(cancel).color : ''].join('|'),
          dangerColor: danger ? getComputedStyle(danger).color : '', dangerBackground: danger ? getComputedStyle(danger).backgroundColor : '',
        };
      });
      check('the delete dialog uses the approved copy, focus and styles', deleteDialog.title === '删除这个交付？' &&
        deleteDialog.body === '会一并删除它的审查记录、问题处置与批注，不能恢复。' &&
        deleteDialog.width === '360px' && deleteDialog.titleFont === '15px 600' &&
        deleteDialog.bodyFont === '13px' && deleteDialog.bodyColor === 'rgb(97, 102, 107)' &&
        deleteDialog.cancelFocused && deleteDialog.dangerColor === 'rgb(223, 42, 63)' &&
        deleteDialog.dangerBackground !== 'rgb(72, 104, 178)');
      await shot('48-delete-dialog-light');
      await page.emulateMedia({ colorScheme: 'dark' });
      await page.waitForTimeout(100);
      await shot('48-delete-dialog-dark');
      await page.emulateMedia({ colorScheme: 'light' });
      await page.locator('.delete-modal .n-button').filter({ hasText: '取消' }).click();
      await page.waitForTimeout(100);
      const deleteCancelled = await page.evaluate(() => ({
        delivery: CRPrototype.app.deliveries.some(item => item.deliveryId === 'del-demo-multi'),
        row: Boolean(document.querySelector('.delivery-row[data-delivery-id="del-demo-multi"]')),
      }));
      check('cancelling the delete dialog keeps the delivery', deleteCancelled.delivery && deleteCancelled.row);
      const mainDelivery = await page.evaluate(() => {
        const app = CRPrototype.app;
        const delivery = app.deliveries[0];
        return { id: delivery.deliveryId, snapshot: delivery.latestSnapshotId, annotations: CRPrototype.annotations.list(delivery.latestSnapshotId).length };
      });
      await page.locator(`.delivery-row[data-delivery-id="${mainDelivery.id}"] .delivery-more`).click();
      await page.waitForTimeout(80);
      await page.locator(`.delivery-row[data-delivery-id="${mainDelivery.id}"] .delivery-menu .wb-menu-item--danger`).click();
      await page.waitForTimeout(100);
      await page.locator('.delete-modal .n-button').filter({ hasText: '删除' }).click();
      await page.waitForTimeout(150);
      const deletedDelivery = await page.evaluate(({ id, snapshot }) => ({
        delivery: CRPrototype.app.deliveries.some(item => item.deliveryId === id),
        annotations: CRPrototype.annotations.list(snapshot).length,
      }), { id: mainDelivery.id, snapshot: mainDelivery.snapshot });
      check('deleting a delivery removes it with its annotations', mainDelivery.annotations > 0 &&
        deletedDelivery.delivery === false && deletedDelivery.annotations === 0);
      await page.reload();
      await page.waitForFunction(() => window.CRPrototype?.app && document.documentElement.dataset.ready === 'true');
      await page.waitForTimeout(200);
      check('the deleted delivery does not come back after reload',
        !(await page.evaluate(id => CRPrototype.app.deliveries.some(item => item.deliveryId === id), mainDelivery.id)));

      const clearListStorage = async () => {
        await page.evaluate(() => {
          window.localStorage.removeItem('evidentloop-demo-list-state');
          window.localStorage.removeItem('evidentloop-demo-deleted-deliveries');
        });
        await open({ scenario: 'list' });
      };
      await clearListStorage();
      await page.locator('.delivery-row[data-delivery-id="del-demo-zero"] .delivery-main').click();
      await page.waitForTimeout(240);
      await page.locator('.wb-back').click();
      await page.waitForTimeout(160);
      await page.locator('.delivery-row[data-delivery-id="del-demo-zero"] .delivery-more').click();
      await page.waitForTimeout(80);
      await page.locator('.delivery-row[data-delivery-id="del-demo-zero"] .delivery-menu .wb-menu-item--danger').click();
      await page.waitForTimeout(100);
      await page.locator('.delete-modal .n-button').filter({ hasText: '删除' }).click();
      await page.waitForTimeout(150);
      await page.locator(`.delivery-row[data-delivery-id="${data.deliveries[0].id}"] .delivery-session-link`).click();
      await page.waitForTimeout(220);
      const deletedZeroIdentity = await page.evaluate(() => ({
        view: CRPrototype.app.view,
        delivery: CRPrototype.app.currentDeliveryId,
        snapshot: CRPrototype.app.snapshot?.snapshotId || null,
        snapshotDelivery: CRPrototype.app.snapshot?.deliveryId || null,
        card: document.querySelector('.dsh-delivery-card')?.innerText.replace(/\s+/g, ' ') || '',
        tone: CRPrototype.app.deliveryCard?.statusTone || '',
      }));
      check('deleting the current zero-finding delivery never makes another delivery look clean',
        deletedZeroIdentity.view === 'conversation' && deletedZeroIdentity.card.includes('发现 7 个问题') &&
        deletedZeroIdentity.tone === 'error' && !deletedZeroIdentity.card.includes('未发现问题') &&
        (deletedZeroIdentity.snapshot === null || deletedZeroIdentity.snapshotDelivery === deletedZeroIdentity.delivery));
      await clearListStorage();
      await page.locator(`.delivery-row[data-delivery-id="${data.deliveries[0].id}"] .delivery-main`).click();
      await page.waitForTimeout(240);
      await page.locator('.wb-back').click();
      await page.waitForTimeout(160);
      await page.locator(`.delivery-row[data-delivery-id="${data.deliveries[0].id}"] .delivery-more`).click();
      await page.waitForTimeout(80);
      await page.locator(`.delivery-row[data-delivery-id="${data.deliveries[0].id}"] .delivery-menu .wb-menu-item--danger`).click();
      await page.waitForTimeout(100);
      await page.locator('.delete-modal .n-button').filter({ hasText: '删除' }).click();
      await page.waitForTimeout(150);
      await page.locator('.delivery-row[data-delivery-id="del-demo-zero"] .delivery-session-link').click();
      await page.waitForTimeout(220);
      const deletedMainIdentity = await page.evaluate(() => ({
        view: CRPrototype.app.view,
        delivery: CRPrototype.app.currentDeliveryId,
        snapshot: CRPrototype.app.snapshot?.snapshotId || null,
        snapshotDelivery: CRPrototype.app.snapshot?.deliveryId || null,
        card: document.querySelector('.dsh-delivery-card')?.innerText.replace(/\s+/g, ' ') || '',
        tone: CRPrototype.app.deliveryCard?.statusTone || '',
      }));
      check('deleting the current failing delivery never carries its findings into a zero-finding delivery',
        deletedMainIdentity.view === 'conversation' && deletedMainIdentity.card.includes('未发现问题') &&
        deletedMainIdentity.tone === 'success' && !deletedMainIdentity.card.includes('发现 7 个问题') &&
        (deletedMainIdentity.snapshot === null || deletedMainIdentity.snapshotDelivery === deletedMainIdentity.delivery));
      await clearListStorage();
      const actionsStyle = await page.evaluate(() => {
        const actions = document.querySelector('.delivery-actions');
        const row = actions.closest('.delivery-row');
        return {
          minWidth: getComputedStyle(actions).minWidth,
          changes: actions.innerText.replace(/\s+/g, ' ').trim(),
          cardWidth: row.getBoundingClientRect().width,
        };
      });
      check('the card footer actions have no 140px floor and keep only the changes entry',
        ['0px', 'auto'].includes(actionsStyle.minWidth) && actionsStyle.changes.replace(/→/g,'').trim() === '变更说明' && actionsStyle.cardWidth >= 320);

      await open({ scenario: 'list' });
      await page.getByRole('button', { name: '工作区设置', exact: true }).click();
      await page.waitForTimeout(120);
      const guideSettings = await page.evaluate(() => {
        const links = [...document.querySelectorAll('.list-settings-menu .wb-menu-foot-link')];
        return {
          count: links.length,
          text: links[0]?.innerText.trim() || '',
          href: links[0]?.getAttribute('href') || '',
          target: links[0]?.getAttribute('target') || '',
          toolbarLinks: document.querySelectorAll('.wb-toolbar .wb-menu-foot-link').length,
        };
      });
      check('settings offer the usage guide without adding a toolbar button',
        guideSettings.count === 1 && guideSettings.text === '使用说明 ↗' &&
        guideSettings.href === 'https://evidentloop.sanze.ai/guide.html' && !guideSettings.href.includes('?') &&
        guideSettings.target === '_blank' && guideSettings.toolbarLinks === 0);
      await page.keyboard.press('Escape');
      await open({ scenario: 'list-empty' });
      const emptyGuide = await page.evaluate(() => {
        const empty = document.querySelector('.delivery-empty');
        const link = empty?.querySelector('.delivery-empty-link');
        return { text: empty?.innerText.replace(/\s+/g, ' ').trim() || '', href: link?.getAttribute('href') || '', target: link?.getAttribute('target') || '' };
      });
      check('an empty workspace explains how to start and links the guide',
        emptyGuide.text.includes('当前工作区还没有交付。') && emptyGuide.text.includes('了解怎么用 ↗') &&
        emptyGuide.href === 'https://evidentloop.sanze.ai/guide.html' && !emptyGuide.href.includes('?') && emptyGuide.target === '_blank');

      await open({ scenario: 'list' });
      await page.locator('input[aria-label="搜索交付"]').fill('zzzz-no-such-delivery');
      await page.waitForTimeout(140);
      const appNoMatch = await page.evaluate(() => ({
        empty: document.querySelector('.delivery-empty')?.innerText.trim() || '',
        emptyVisible: Boolean(document.querySelector('.delivery-empty') && document.querySelector('.delivery-empty').getClientRects().length),
        cards: document.querySelectorAll('.delivery-row').length,
        archivedGroup: Boolean(document.querySelector('.delivery-archive')),
      }));
      check('a no-match search in demo-app shows the search empty state instead of blank space',
        appNoMatch.empty.startsWith('没有匹配的交付') && appNoMatch.empty.endsWith('清空搜索与筛选') && appNoMatch.emptyVisible === true &&
        appNoMatch.cards === 0 && appNoMatch.archivedGroup === false);
      await page.locator('input[aria-label="搜索交付"]').fill('');
      await page.waitForTimeout(120);
      await page.locator('.list-workspace-switch').click();
      await page.waitForTimeout(100);
      await page.locator('.workspace-item').filter({ hasText: 'demo-archive' }).first().click();
      await page.waitForTimeout(180);
      await page.locator('input[aria-label="搜索交付"]').fill('zzzz-no-such-delivery');
      await page.waitForTimeout(140);
      const archiveNoMatch = await page.evaluate(() => ({
        empty: document.querySelector('.delivery-empty')?.innerText.trim() || '',
        emptyVisible: Boolean(document.querySelector('.delivery-empty') && document.querySelector('.delivery-empty').getClientRects().length),
        cards: document.querySelectorAll('.delivery-row').length,
        archivedGroup: Boolean(document.querySelector('.delivery-archive')),
      }));
      check('a no-match search in an archived-only workspace also shows the search empty state',
        archiveNoMatch.empty.startsWith('没有匹配的交付') && archiveNoMatch.empty.endsWith('清空搜索与筛选') && archiveNoMatch.emptyVisible === true &&
        archiveNoMatch.cards === 0 && archiveNoMatch.archivedGroup === false);
      await page.locator('input[aria-label="搜索交付"]').fill('');
      await page.waitForTimeout(120);

      await open({ scenario: 'list' });
      await page.locator('.list-workspace-switch').click();
      await page.waitForTimeout(100);
      await page.locator('.workspace-item').filter({ hasText: 'demo-archive' }).first().click();
      await page.waitForTimeout(200);
      const archiveOnlyWorkspace = await page.evaluate(() => ({
        empty: document.querySelector('.delivery-empty')?.innerText.trim() || '',
        emptyVisible: Boolean(document.querySelector('.delivery-empty') && document.querySelector('.delivery-empty').getClientRects().length),
        active: document.querySelectorAll('.delivery-grid:not(.delivery-grid--archive) .delivery-row').length,
        toggle: document.querySelector('.delivery-archive-toggle')?.innerText.replace(/\s+/g, ' ').trim() || '',
        count: CRPrototype.app.listCountText,
        header: document.querySelector('.list-header').innerText.replace(/\s+/g, ' ').trim(),
        expanded: CRPrototype.app.archiveExpanded,
        cards: document.querySelectorAll('.delivery-grid--archive .delivery-row').length,
      }));
      check('a workspace with only archived deliveries shows the archive cards without an empty block',
        archiveOnlyWorkspace.empty === '' && archiveOnlyWorkspace.emptyVisible === false &&
        archiveOnlyWorkspace.active === 0 &&
        archiveOnlyWorkspace.toggle.includes('归档 1') && archiveOnlyWorkspace.count === '' &&
        !archiveOnlyWorkspace.header.includes('个进行中') && archiveOnlyWorkspace.expanded === true &&
        archiveOnlyWorkspace.cards === 1);
      await shot('49-archive-empty-light');
      await page.emulateMedia({ colorScheme: 'dark' });
      await page.waitForTimeout(120);
      await shot('49-archive-empty-dark');
      await page.emulateMedia({ colorScheme: 'light' });
      const bareArchivedSuffix = await page.evaluate(() => {
        const text = document.body.innerText;
        return { hasBare: /(?<!会话)（已归档）/.test(text), hasFull: text.includes('（会话已归档）') };
      });
      check('no bare archived suffix remains anywhere in the list text', bareArchivedSuffix.hasBare === false);
      await page.evaluate(() => {
        window.localStorage.removeItem('evidentloop-demo-list-state');
        window.localStorage.removeItem('evidentloop-demo-deleted-deliveries');
      });
      await open({ scenario: 'list' });
      await page.evaluate(() => {
        window.localStorage.removeItem('evidentloop-demo-list-state');
        window.localStorage.removeItem('evidentloop-demo-deleted-deliveries');
      });
    }

    markStep('A2c: settings separation and conservative states');
    // ---------- A2c: 交叉复验追加 ----------
    if (scoped('list')) {
      await page.evaluate(() => window.localStorage.removeItem('evidentloop-demo-list-state'));
      await open({ scenario: 'list' });
      await page.evaluate(() => {
        const app = CRPrototype.app;
        app.setAutoMode(true);
        app.setTargetBranch('audit-live-branch');
        app.setExportEmbedDiff(true);
        app.openExtensionDialog('edit');
        app.extensionDialog.draft = '实时仓库提示词：保持当前设置';
        app.saveExtensionPrompt();
      });
      const savedSettings = await page.evaluate(() => {
        const app = CRPrototype.app;
        const key = app.settingsBucketKey();
        return {
          bucketKey: key,
          live: { auto: app.autoMode, branch: app.targetBranchOverride, embed: app.exportEmbedDiff, prompt: app.extensionPrompt },
          bucket: app.repoSettingsByKey[key],
        };
      });
      const frozenRecordId = await page.evaluate(() => {
        const app = CRPrototype.app;
        const delivery = app.deliveries[0];
        const older = delivery.snapshots[1];
        const record = window.CR_PROTOTYPE_DATA.records[older.snapshotId];
        record.snapshot.extensionPrompt = { text: '冻结的旧提示词', sha256: CRPrototype.sha256('冻结的旧提示词'), length: 7 };
        return { deliveryId: delivery.deliveryId, snapshotId: older.snapshotId };
      });
      await page.locator(`.delivery-row[data-delivery-id="${frozenRecordId.deliveryId}"] .delivery-main`).click();
      await page.waitForTimeout(260);
      await page.locator('.wb-record-trigger').click();
      await page.waitForTimeout(100);
      await page.locator('.record-menu .record-item').nth(1).click();
      await page.waitForTimeout(240);
      const recordPrompt = await page.evaluate(() => {
        const app = CRPrototype.app;
        return {
          live: { auto: app.autoMode, branch: app.targetBranchOverride, embed: app.exportEmbedDiff, prompt: app.extensionPrompt },
          frozen: app.snapshot?.extensionPrompt?.text || '',
          bucket: app.repoSettingsByKey[app.settingsBucketKey()],
          banner: document.querySelector('.wb-extension-banner')?.innerText.replace(/\s+/g, ' ').trim() || '',
          changed: app.extensionPromptChanged,
        };
      });
      check('opening an old record keeps the live repo settings and reads its own frozen prompt',
        JSON.stringify(recordPrompt.live) === JSON.stringify(savedSettings.live) &&
        JSON.stringify(recordPrompt.bucket) === JSON.stringify(savedSettings.bucket) &&
        recordPrompt.frozen === '冻结的旧提示词' && recordPrompt.changed === true &&
        recordPrompt.banner.includes('扩展提示词已更改'));
      await page.locator('.wb-back').click();
      await page.waitForTimeout(180);
      await page.locator('.list-workspace-switch').click();
      await page.waitForTimeout(100);
      await page.locator('.workspace-item').filter({ hasText: 'prototype' }).first().click();
      await page.waitForTimeout(150);
      await page.locator('.list-workspace-switch').click();
      await page.waitForTimeout(100);
      await page.locator('.workspace-item').filter({ hasText: 'demo-notes' }).first().click();
      await page.waitForTimeout(150);
      await page.locator('.list-workspace-switch').click();
      await page.waitForTimeout(100);
      await page.locator('.workspace-item').filter({ hasText: /^demo-app/ }).first().click();
      await page.waitForTimeout(180);
      const settingsAfterSwitch = await page.evaluate(() => {
        const app = CRPrototype.app;
        const key = app.settingsBucketKey();
        return { live: { auto: app.autoMode, branch: app.targetBranchOverride, embed: app.exportEmbedDiff, prompt: app.extensionPrompt }, bucket: app.repoSettingsByKey[key] };
      });
      check('switching workspaces never writes a record prompt back into the settings bucket',
        JSON.stringify(settingsAfterSwitch.live) === JSON.stringify(savedSettings.live) &&
        JSON.stringify(settingsAfterSwitch.bucket) === JSON.stringify(savedSettings.bucket));

      const cappedSamples = await page.evaluate(() => {
        const base = { snapshotStatus: 'complete', runStatus: 'succeeded', complete: true, pendingCount: 0, failedCount: 0, withheldCount: 0, activeFindings: 0 };
        const largeFindings = CRPrototype.status.reviewStateOf({ ...base, activeFindings: 1000 });
        const largeFailed = CRPrototype.status.reviewStateOf({ ...base, complete: false, failedCount: 1000 });
        const largePending = CRPrototype.status.reviewStateOf({ ...base, complete: false, pendingCount: 1000 });
        const normalize = (runStatus, complete) => CRPrototype.status.reviewStateOf({ ...base, runStatus, complete });
        return {
          findingsPill: largeFindings.pills[0].text,
          failedPill: largeFailed.pills[0].text,
          pendingPill: largePending.pills[0].text,
          cancelledSuccess: normalize('cancelled', true),
          unknownSuccess: normalize('unknown', true),
          partialSuccess: normalize('partial', true),
          succeeded: normalize('succeeded', true),
        };
      });
      check('large counts stay within ten characters with capped short wording',
        cappedSamples.findingsPill === '发现 99+ 个问题' && [...cappedSamples.findingsPill].length <= 10 &&
        cappedSamples.failedPill === '99+ 个文件失败' && [...cappedSamples.failedPill].length <= 10 &&
        cappedSamples.pendingPill === '99+ 个文件待审' && [...cappedSamples.pendingPill].length <= 10);
      check('only a succeeded run may enter the success branch',
        cappedSamples.cancelledSuccess.kind !== 'zero' && cappedSamples.unknownSuccess.kind !== 'zero' &&
        cappedSamples.partialSuccess.kind !== 'zero' && cappedSamples.succeeded.kind === 'zero' &&
        !cappedSamples.cancelledSuccess.exportText.includes('未发现问题') &&
        !cappedSamples.unknownSuccess.exportText.includes('未发现问题'));

      await open({ scenario: 'list' });
      await page.locator('.delivery-row[data-delivery-id="del-demo-withheld-only"] .delivery-main').click();
      await page.waitForTimeout(260);
      const sameRefSnapshot = await page.evaluate(() => CRPrototype.app.snapshot.snapshotId);
      await page.locator('.wb-back').click();
      await page.waitForTimeout(180);
      await page.locator('.delivery-row[data-delivery-id="del-demo-partial-failed"] .delivery-main').click();
      await page.waitForTimeout(200);
      await page.locator('.wb-back').click();
      await page.waitForTimeout(160);
      await page.evaluate(snapshotId => {
        const app = CRPrototype.app;
        const data = window.CR_PROTOTYPE_DATA;
        const delivery = app.deliveries.find(item => item.deliveryId === 'del-demo-withheld-only');
        const fixture = JSON.parse(JSON.stringify(data.records[snapshotId]));
        fixture.coverage = {
          ...fixture.coverage,
          reviewed: fixture.snapshot.files.filter(file => file.kind === 'text').map(file => file.path),
          failed: [],
          withheld: [
            { kind: 'finding', ref: 'same-ref', code: 'evidence-quote-mismatch' },
            { kind: 'finding', ref: 'same-ref', code: 'evidence-sha-mismatch' },
            { kind: 'statement', ref: 'same-ref', code: 'missing-ref' },
          ],
        };
        fixture.withheldFindings = [];
        data.records[snapshotId] = fixture;
        if (delivery?.records) delete delivery.records[snapshotId];
      }, sameRefSnapshot);
      await page.locator('.delivery-row[data-delivery-id="del-demo-withheld-only"] .delivery-main').click();
      await page.waitForTimeout(280);
      const sameRefState = await page.evaluate(() => ({
        withheld: CRPrototype.app.withheldCount,
        coverage: (CRPrototype.app.coverage?.withheld || []).length,
        runCoverage: (CRPrototype.app.run?.coverage?.withheld || []).length,
        complete: CRPrototype.app.reviewCompleteNow,
      }));
      await page.getByRole('button', { name: '导出与发回', exact: true }).click();
      const [sameRefMdDownload] = await Promise.all([
        page.waitForEvent('download'),
        page.getByRole('menuitem', { name: /变更日志（Markdown）/ }).click(),
      ]);
      const sameRefMarkdown = fs.readFileSync(await sameRefMdDownload.path(), 'utf8');
      await page.getByRole('button', { name: '导出与发回', exact: true }).click();
      const [sameRefHtmlDownload, sameRefPreview] = await Promise.all([
        page.waitForEvent('download'), page.waitForEvent('popup'),
        page.getByRole('menuitem', { name: /评审报告（HTML）/ }).click(),
      ]);
      const sameRefHtml = fs.readFileSync(await sameRefHtmlDownload.path(), 'utf8');
      await sameRefPreview.close();
      const sameRefData = parseEmbeddedData(sameRefHtml);
      check('same ref with different codes counts once per kind/ref/code everywhere',
        sameRefState.withheld === 3 && sameRefState.coverage === 3 && sameRefState.runCoverage === 3 &&
        sameRefState.complete === false &&
        /^- 审查结论：不完整（3 条结论未通过校验）$/m.test(sameRefMarkdown) &&
        sameRefData.review?.complete === false && (sameRefData.review?.withheld || []).length === 3);

      await open({ scenario: 'list' });
      const untitled = await page.evaluate(() => {
        const app = CRPrototype.app;
        const projectKey = app.project?.projectKey || app.deliveries[0].projectKey;
        app.sessions.push({ sessionId: 'sess-untitled', projectKey, title: '', kind: 'dev', updatedAt: new Date().toISOString() });
        const delivery = app.deliveryRows.find(item => item.deliveryId === 'del-demo-partial-failed');
        const entry = delivery.snapshots[0];
        entry.sessionId = 'sess-untitled';
        return { deliveryId: delivery.deliveryId };
      });
      await page.locator(`.delivery-row[data-delivery-id="${untitled.deliveryId}"] .delivery-main`).click();
      await page.waitForTimeout(260);
      await page.locator('.wb-record-trigger').click();
      await page.waitForTimeout(100);
      const untitledLink = await page.locator('.record-menu .record-item__session-link').first().innerText();
      await page.locator('.record-menu .record-item__session-link').first().click();
      await page.waitForTimeout(200);
      const untitledNavigation = await page.evaluate(() => ({
        view: CRPrototype.app.view,
        title: CRPrototype.app.conversationTitle,
        message: CRPrototype.ui.message,
        linkText: document.querySelector('.record-item__session-link')?.innerText || '',
      }));
      check('an untitled session is linked and navigated with the shared fallback title',
        untitledLink === '未命名会话' && untitledNavigation.view === 'conversation' &&
        untitledNavigation.title === '未命名会话' && untitledNavigation.message.includes('未命名会话'));

      await open({ scenario: 'list' });
      const guardedNavigation = await page.evaluate(() => {
        const app = CRPrototype.app;
        const delivery = app.deliveryRows[0];
        app.sessions.push({ projectKey: delivery.projectKey, title: '无 ID 会话', kind: 'dev', updatedAt: new Date().toISOString() });
        const before = { view: app.view, title: app.conversationTitle };
        app.openRecordSession({ sessionId: 'missing-session' });
        const deletedView = app.view;
        const archived = { sessionId: 'sess-archived' };
        app.openRecordSession({ sessionId: 'sess-archived' });
        return { before, deletedView, archivedView: app.view, archivedTitle: app.conversationTitle, archived };
      });
      check('archived or unaddressable sessions never navigate from the record dropdown',
        guardedNavigation.deletedView === guardedNavigation.before.view &&
        guardedNavigation.archivedView === guardedNavigation.before.view &&
        guardedNavigation.archivedTitle === guardedNavigation.before.title);
    }

  },
};
