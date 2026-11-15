/* verify module: visual */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
module.exports = {
  id: 'visual',
  order: 7,
  scenarios: ['partial', 'unreviewed', 'zero', 'incomplete', 'incremental', 'history', 'records', 'running', 'cancelled', 'failed', 'no-requirement', 'added-requirement', 'auto-on', 'auto-off', 'preflight-not-git', 'preflight-no-target', 'preflight-no-model', 'preflight-split-index', 'list', 'list-empty', 'list-history', 'reviewed', 'sendback-draft', 'sendback-no-session', 'extension-configured', 'extension-changed', 'extension-none'],
  async run(rt) {
    const { page, context, output, data, scoped, selectedScenarios, SCENARIOS, ONLY } = rt;
    const { open, state, shot, check, markStep, ensureOverview, filterByMode, brandButtons, blueUiColors, contrastSamples, assertReadable, auditIconButtons, currentData, parseEmbeddedData } = rt;
    let s;
    markStep('per-scenario visual and terminology budget');
    // ---------- per-scenario visual and terminology budget ----------
    for (const scenario of selectedScenarios) {
      await open({ scenario });
      const purple = await brandButtons();
      check('at most one solid brand primary button: ' + scenario, purple.length <= 1);
      const labels = await page.evaluate(() => ({
        statuses: [...document.querySelectorAll('.delivery-status,.dsh-delivery-status,.run-state__label,.panel-status b')]
          .map(element => element.innerText.trim()).filter(Boolean),
        retired: [...document.querySelectorAll('.delivery-status,.dsh-delivery-status,.run-state__label,.panel-status b,.wb-menu-item b')]
          .map(element => element.innerText.trim()).join('\n'),
      }));
      const statusOk = labels.statuses.every(label =>
        /^(待审|发现 [1-9]\d* 个问题( · (\d+ 个文件待审|\d+ 个文件审查失败|\d+ 条结论未通过校验|代码读取不完整|\d+ 项待处理))?|未发现问题|\d+ 个文件待审|\d+ 个文件审查失败|\d+ 条结论未通过校验|代码读取不完整|\d+ 项待处理|排队中|审查中…?|正在审查|已取消|审查失败|审查进行中)$/.test(label));
      check('status wording stays within the approved set: ' + scenario, statusOk);
      check('no retired status aliases: ' + scenario, !/(待评审|未审|零发现|有问题|有效问题|被扣下|已扣下|已验证)/.test(labels.retired));
      check('no blue review-state colors: ' + scenario, (await blueUiColors()).length === 0);
      check('no snapshot wording in the UI: ' + scenario, !(await page.locator('body').innerText()).includes('快照'));
      if (scenario.startsWith('extension-')) await shot(scenario);
    }

  },
};
