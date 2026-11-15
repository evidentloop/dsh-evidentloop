/* verify module: sendback */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
module.exports = {
  id: 'sendback',
  order: 2,
  scenarios: ['sendback-draft', 'sendback-no-session', 'reviewed'],
  async run(rt) {
    const { page, context, output, data, scoped, selectedScenarios, SCENARIOS, ONLY } = rt;
    const { open, state, shot, check, markStep, ensureOverview, filterByMode, brandButtons, blueUiColors, contrastSamples, assertReadable, auditIconButtons, currentData, parseEmbeddedData } = rt;
    let s;
    markStep('send back to session');
    // ---------- send back to session ----------
    if (scoped('sendback-draft', 'sendback-no-session', 'reviewed')) {
    await open({ scenario: 'sendback-draft', view: 'conversation' });
    await page.locator('.dsh-send').click();
    await page.waitForTimeout(100);
    const sendSpy = await page.evaluate(() => ({
      sends: CRPrototype.sendBack.sends, modelCalls: CRPrototype.sendBack.modelCalls,
      draft: CRPrototype.app.dshDraft,
    }));
    check('send counter records a real send action', sendSpy.sends === 1 && sendSpy.modelCalls === 1 && sendSpy.draft === '');

    await open({ scenario: 'reviewed' });
    await page.getByRole('button', { name: '导出与发回', exact: true }).click();
    const sendBackItem = page.getByRole('menuitem', { name: /修改问题/ });
    check('send-back is enabled for a delivery with a dev session', await sendBackItem.isEnabled());
    await sendBackItem.click();
    await page.waitForTimeout(200);
    const written = await page.evaluate(() => ({
      view: CRPrototype.app.view,
      draft: CRPrototype.app.dshDraft,
      writes: CRPrototype.sendBack.writes,
      copies: CRPrototype.sendBack.copies,
      sends: CRPrototype.sendBack.sends,
      modelCalls: CRPrototype.sendBack.modelCalls,
      locked: CRPrototype.sendBack.lockedSnapshotId,
      snapshot: CRPrototype.app.snapshot.snapshotId,
      target: CRPrototype.app.sendBackTarget?.sessionId || '',
      active: CRPrototype.app.activeSessionId,
    }));
    check('empty composer receives the locked draft and opens that session', written.view === 'conversation' &&
      written.draft.includes('## 待处理问题（7）') && written.draft.includes('## 未对齐 / 待确认（3）') &&
      written.draft.includes('无代码定位') && written.draft.includes('审查时间：') &&
      written.locked === written.snapshot && written.writes === 1);
    check('subagent sessions normalize to the main dev session', written.target === 'sess-prototype' &&
      written.active === 'sess-prototype');
    check('the fix draft states the review conclusion', written.draft.includes('审查结论：发现 7 个问题'));
    check('send-back never sends a message or calls the model', written.sends === 0 && written.modelCalls === 0 &&
      await page.locator('textarea[aria-label="会话输入框"]').inputValue() === written.draft);
    await shot('28-sendback-written');

    await page.locator('.dsh-primary-btn').click();
    await page.waitForTimeout(200);
    await page.getByRole('button', { name: '导出与发回', exact: true }).click();
    await page.getByRole('menuitem', { name: /修改问题/ }).click();
    await page.waitForTimeout(150);
    check('existing draft opens the preview with append and copy actions', await page.locator('.sendback-modal').count() === 1 &&
      await page.getByRole('button', { name: '追加到草稿末尾' }).count() === 1 &&
      await page.getByRole('button', { name: '复制到剪贴板' }).count() === 1);
    check('preview content matches the locked click-time content', (await page.locator('.sendback-content').innerText()).trim() ===
      (await page.evaluate(() => CRPrototype.sendBack.lockedContent)).trim());
    await page.getByRole('button', { name: '追加到草稿末尾' }).click();
    await page.waitForTimeout(200);
    const afterRepeat = await page.evaluate(() => ({
      draft: CRPrototype.app.dshDraft,
      writes: CRPrototype.sendBack.writes,
      sends: CRPrototype.sendBack.sends,
      modelCalls: CRPrototype.sendBack.modelCalls,
      view: CRPrototype.app.view,
    }));
    check('repeated identical send-back does not append twice', (afterRepeat.draft.match(/## 待处理问题（7）/g) || []).length === 1 &&
      afterRepeat.writes === 1 && afterRepeat.view === 'conversation');
    check('preview append never sends or calls the model', afterRepeat.sends === 0 && afterRepeat.modelCalls === 0);

    await open({ scenario: 'sendback-draft' });
    await page.getByRole('button', { name: '导出与发回', exact: true }).click();
    await page.getByRole('menuitem', { name: /修改问题/ }).click();
    await page.waitForTimeout(150);
    await shot('29-sendback-draft');
    const lockedBefore = await page.evaluate(() => ({
      content: CRPrototype.sendBack.lockedContent,
      snapshot: CRPrototype.sendBack.lockedSnapshotId,
      current: CRPrototype.app.snapshot.snapshotId,
      draft: CRPrototype.app.dshDraft,
      copies: CRPrototype.sendBack.copies,
      writes: CRPrototype.sendBack.writes,
    }));
    await page.evaluate(() => {
      CRPrototype.app.snapshot = CRPrototype.createScenario('history').snapshot;
    });
    await page.waitForTimeout(200);
    const switched = await page.evaluate(() => ({
      content: CRPrototype.sendBack.lockedContent,
      current: CRPrototype.app.snapshot.snapshotId,
      dom: document.querySelector('.sendback-content')?.textContent || '',
    }));
    check('send-back content stays locked after a real snapshot switch', switched.current !== lockedBefore.snapshot &&
      switched.content === lockedBefore.content && switched.dom.trim() === lockedBefore.content.trim());
    await page.getByRole('button', { name: '追加到草稿末尾' }).click();
    await page.waitForTimeout(150);
    const snapshotFallback = await page.evaluate(() => ({
      copies: CRPrototype.sendBack.copies,
      writes: CRPrototype.sendBack.writes,
      draft: CRPrototype.app.dshDraft,
      message: CRPrototype.ui.message,
    }));
    check('snapshot switch degrades to clipboard and never writes the draft', snapshotFallback.copies === lockedBefore.copies + 1 &&
      snapshotFallback.writes === lockedBefore.writes && snapshotFallback.draft === lockedBefore.draft &&
      snapshotFallback.message.includes('已切换审查记录'));
    const copied = await page.evaluate(() => navigator.clipboard.readText());
    check('copy fallback copies the locked content without touching the draft', copied.trim() === lockedBefore.content.trim());
    await page.getByRole('button', { name: '复制到剪贴板' }).click();
    await page.waitForTimeout(150);
    check('copy action increments its own call record', await page.evaluate(() => CRPrototype.sendBack.copies) === lockedBefore.copies + 2 &&
      await page.evaluate(() => CRPrototype.app.dshDraft) === lockedBefore.draft);

    await open({ scenario: 'sendback-draft' });
    await page.getByRole('button', { name: '导出与发回', exact: true }).click();
    await page.getByRole('menuitem', { name: /修改问题/ }).click();
    await page.waitForTimeout(150);
    const beforeDelete = await page.evaluate(() => ({
      copies: CRPrototype.sendBack.copies,
      writes: CRPrototype.sendBack.writes,
      draft: CRPrototype.app.dshDraft,
    }));
    await page.evaluate(() => {
      const app = CRPrototype.app;
      const delivery = app.currentDelivery;
      app.sessions.push({
        sessionId: 'audit-backup', projectKey: delivery.projectKey, title: '备用会话',
        kind: 'dev', updatedAt: new Date().toISOString(),
      });
      delivery.sessionIds.push('audit-backup');
      app.sessions = app.sessions.filter(session => session.sessionId !== 'sess-prototype');
    });
    await page.waitForTimeout(100);
    await page.getByRole('button', { name: '追加到草稿末尾' }).click();
    await page.waitForTimeout(150);
    const deletedTarget = await page.evaluate(() => ({
      copies: CRPrototype.sendBack.copies,
      writes: CRPrototype.sendBack.writes,
      draft: CRPrototype.app.dshDraft,
      message: CRPrototype.ui.message,
      view: CRPrototype.app.view,
      active: CRPrototype.app.activeSessionId,
    }));
    check('deleted target falls back to copy and never switches to another session', deletedTarget.copies === beforeDelete.copies + 1 &&
      deletedTarget.writes === beforeDelete.writes && deletedTarget.draft === beforeDelete.draft &&
      deletedTarget.message.includes('目标会话已不存在') && deletedTarget.view === 'review' &&
      deletedTarget.active !== 'audit-backup');

    await open({ scenario: 'sendback-draft' });
    await page.getByRole('button', { name: '导出与发回', exact: true }).click();
    await page.getByRole('menuitem', { name: /修改问题/ }).click();
    await page.waitForTimeout(150);
    const beforeProjectMismatch = await page.evaluate(() => ({
      copies: CRPrototype.sendBack.copies,
      writes: CRPrototype.sendBack.writes,
      draft: CRPrototype.app.dshDraft,
    }));
    await page.evaluate(() => {
      const session = CRPrototype.app.sessions.find(item => item.sessionId === 'sess-prototype');
      session.projectKey = 'other-project';
    });
    await page.getByRole('button', { name: '追加到草稿末尾' }).click();
    await page.waitForTimeout(150);
    const projectMismatch = await page.evaluate(() => ({
      copies: CRPrototype.sendBack.copies,
      writes: CRPrototype.sendBack.writes,
      draft: CRPrototype.app.dshDraft,
      message: CRPrototype.ui.message,
    }));
    check('repository mismatch falls back to copy without writing', projectMismatch.copies === beforeProjectMismatch.copies + 1 &&
      projectMismatch.writes === beforeProjectMismatch.writes && projectMismatch.draft === beforeProjectMismatch.draft &&
      projectMismatch.message.includes('其他仓库'));

    await open({ scenario: 'sendback-draft' });
    await page.getByRole('button', { name: '导出与发回', exact: true }).click();
    await page.getByRole('menuitem', { name: /修改问题/ }).click();
    await page.waitForTimeout(150);
    const beforeDeliveryDelete = await page.evaluate(() => ({
      copies: CRPrototype.sendBack.copies,
      writes: CRPrototype.sendBack.writes,
      draft: CRPrototype.app.dshDraft,
    }));
    await page.evaluate(() => {
      const app = CRPrototype.app;
      const currentId = app.currentDeliveryId;
      app.deliveries = app.deliveries.filter(delivery => delivery.deliveryId !== currentId);
    });
    await page.waitForTimeout(100);
    await page.getByRole('button', { name: '追加到草稿末尾' }).click();
    await page.waitForTimeout(150);
    const deletedDelivery = await page.evaluate(() => ({
      copies: CRPrototype.sendBack.copies,
      writes: CRPrototype.sendBack.writes,
      draft: CRPrototype.app.dshDraft,
      message: CRPrototype.ui.message,
    }));
    check('deleted delivery falls back to copy without retargeting', deletedDelivery.copies === beforeDeliveryDelete.copies + 1 &&
      deletedDelivery.writes === beforeDeliveryDelete.writes && deletedDelivery.draft === beforeDeliveryDelete.draft &&
      deletedDelivery.message.includes('交付已不存在'));

    await open({ scenario: 'sendback-draft' });
    await page.getByRole('button', { name: '导出与发回', exact: true }).click();
    await page.getByRole('menuitem', { name: /修改问题/ }).click();
    await page.waitForTimeout(150);
    const beforeUiSwitch = await page.evaluate(() => ({
      snapshot: CRPrototype.app.snapshot.snapshotId,
      writes: CRPrototype.sendBack.writes,
      copies: CRPrototype.sendBack.copies,
    }));
    await page.evaluate(() => {
      const app = CRPrototype.app;
      const delivery = app.currentDelivery;
      const earlier = delivery.snapshots.find(snapshot => snapshot.snapshotId !== delivery.latestSnapshotId);
      app.openDeliverySnapshot(delivery, earlier);
    });
    await page.waitForTimeout(250);
    const afterUiSwitch = await page.evaluate(() => ({
      snapshot: CRPrototype.app.snapshot.snapshotId,
      dialog: Boolean(document.querySelector('.sendback-modal')),
      writes: CRPrototype.sendBack.writes,
      copies: CRPrototype.sendBack.copies,
    }));
    check('a real UI snapshot switch closes the stale preview without writing', afterUiSwitch.snapshot !== beforeUiSwitch.snapshot &&
      afterUiSwitch.dialog === false && afterUiSwitch.writes === beforeUiSwitch.writes && afterUiSwitch.copies === beforeUiSwitch.copies);

    await open({ scenario: 'sendback-draft' });
    const originalDraft = await page.evaluate(() => CRPrototype.app.dshDraft);
    await page.getByRole('button', { name: '导出与发回', exact: true }).click();
    await page.getByRole('menuitem', { name: /修改问题/ }).click();
    await page.waitForTimeout(150);
    await page.getByRole('button', { name: '追加到草稿末尾' }).click();
    await page.waitForTimeout(200);
    const appended = await page.evaluate(() => ({
      view: CRPrototype.app.view,
      draft: CRPrototype.app.dshDraft,
      writes: CRPrototype.sendBack.writes,
      sends: CRPrototype.sendBack.sends,
      modelCalls: CRPrototype.sendBack.modelCalls,
    }));
    check('append adds the locked content once and keeps the original draft', appended.view === 'conversation' &&
      appended.draft.startsWith(originalDraft) && appended.draft.includes('## 待处理问题（7）') &&
      (appended.draft.match(/## 待处理问题（7）/g) || []).length === 1 &&
      appended.writes === 1 && appended.sends === 0 && appended.modelCalls === 0);

    await open({ scenario: 'sendback-no-session' });
    await page.getByRole('button', { name: '导出与发回', exact: true }).click();
    const noSessionItem = page.getByRole('menuitem', { name: /修改问题/ });
    check('send-back is disabled without a dev session', await noSessionItem.isDisabled() &&
      await noSessionItem.getAttribute('title') === '本次交付无关联会话');
    await noSessionItem.click({ force: true });
    await page.waitForTimeout(150);
    check('disabled send-back does not write or open a preview', await page.locator('.sendback-modal').count() === 0 &&
      await page.evaluate(() => CRPrototype.sendBack.writes) === 0);
    await shot('30-sendback-no-session');
    await page.locator('.dsh-nav-item--plugin').click();
    await page.waitForTimeout(220);
    await page.locator('.delivery-row[data-delivery-id="del-demo-zero"] .delivery-session-link').click();
    await page.waitForTimeout(220);
    await page.locator('.dsh-nav-item--plugin').click();
    await page.waitForTimeout(220);
    await page.locator(`.delivery-row[data-delivery-id="${data.deliveries[0].id}"] .delivery-main`).click();
    await page.waitForTimeout(280);
    await page.locator('.dsh-chat-row').first().click();
    await page.waitForTimeout(220);
    const sessionlessConversation = await page.evaluate(() => ({
      title: CRPrototype.app.conversationTitle,
      active: CRPrototype.app.activeSessionId,
      value: document.querySelector('textarea[aria-label="会话输入框"]')?.value || '',
      header: document.querySelector('.dsh-chat-title-row h1')?.innerText || '',
    }));
    check('opening a sessionless delivery clears the previous conversation title and draft', sessionlessConversation.title === '' &&
      sessionlessConversation.active === '' && sessionlessConversation.value === '' &&
      sessionlessConversation.header.includes('接入 EvidentLoop 变更评审'));

    await open({ scenario: 'sendback-draft' });
    const supplementProbe = await page.evaluate(() => {
      const app = CRPrototype.app;
      const content = app.buildSupplementContent();
      return {
        content,
        sends: CRPrototype.sendBack.sends,
        modelCalls: CRPrototype.sendBack.modelCalls,
        requirementText: (app.snapshot.requirements || []).map(source => source.text).join('\n'),
        sourceSample: 'const app = Vue.createApp',
        extension: app.snapshot.extensionPrompt?.text || '',
      };
    });
    check('supplement draft starts with its source and the fixed instruction', supplementProbe.content.trim().startsWith('## 来源') &&
      supplementProbe.content.indexOf('## 来源') < supplementProbe.content.indexOf('## 请求') &&
      supplementProbe.content.indexOf('## 请求') < supplementProbe.content.indexOf('## 已有变更说明') &&
      supplementProbe.content.includes('交付：P1 变更评审适配') &&
      supplementProbe.content.includes('审查时间：') &&
      supplementProbe.content.includes('对比范围：') &&
      supplementProbe.content.includes('基于的提交：') &&
      supplementProbe.content.includes('含未提交改动') &&
      supplementProbe.content.includes('以所附说明为输入，资料不足请指出；不改写审查结论；本任务不修改业务代码。') &&
      supplementProbe.content.includes('Skill 名称：（在此填写）'));
    check('supplement draft excludes requirement text, source and the extension body', supplementProbe.requirementText.length > 0 &&
      !supplementProbe.content.includes(supplementProbe.requirementText) &&
      !supplementProbe.content.includes(supplementProbe.sourceSample) &&
      !supplementProbe.content.includes('## 待处理问题'));
    await page.getByRole('button', { name: '导出与发回', exact: true }).click();
    await page.getByRole('menuitem', { name: /补充说明/ }).click();
    await page.waitForTimeout(150);
    check('supplement opens the same preview and never sends', await page.locator('.sendback-modal').count() === 1 &&
      await page.evaluate(() => CRPrototype.sendBack.sends + CRPrototype.sendBack.modelCalls) === 0 &&
      (await page.locator('.sendback-modal').innerText()).includes('补充说明'));
    await page.getByRole('button', { name: '追加到草稿末尾' }).click();
    await page.waitForTimeout(200);
    const supplementOnce = await page.evaluate(() => ({
      draft: CRPrototype.app.dshDraft,
      writes: CRPrototype.sendBack.writes,
      sends: CRPrototype.sendBack.sends,
    }));
    check('supplement appends once without sending', supplementOnce.draft.includes('## 来源') &&
      (supplementOnce.draft.match(/## 来源/g) || []).length === 1 && supplementOnce.sends === 0);
    await page.locator('.dsh-primary-btn').click();
    await page.waitForTimeout(200);
    await page.getByRole('button', { name: '导出与发回', exact: true }).click();
    await page.getByRole('menuitem', { name: /补充说明/ }).click();
    await page.waitForTimeout(150);
    await page.getByRole('button', { name: '追加到草稿末尾' }).click();
    await page.waitForTimeout(200);
    check('repeating the same send-back does not append twice', await page.evaluate(() => {
      const draft = CRPrototype.app.dshDraft;
      return (draft.match(/## 来源/g) || []).length === 1 && CRPrototype.sendBack.writes === 1;
    }));

    await page.locator('.dsh-primary-btn').click();
    await page.waitForTimeout(150);
    await page.evaluate(() => { CRPrototype.app.dshDraft = '只保留手写草稿'; });
    await page.waitForTimeout(120);
    await page.getByRole('button', { name: '导出与发回', exact: true }).click();
    await page.getByRole('menuitem', { name: /补充说明/ }).click();
    await page.waitForTimeout(150);
    await page.getByRole('button', { name: '追加到草稿末尾' }).click();
    await page.waitForTimeout(200);
    check('deleting the generated body from the draft allows appending it again', await page.evaluate(() => {
      const draft = CRPrototype.app.dshDraft;
      return draft.includes('只保留手写草稿') && draft.includes('## 来源') && CRPrototype.sendBack.writes === 2;
    }));
    await page.locator('.dsh-primary-btn').click();
    await page.waitForTimeout(150);
    await page.evaluate(() => { CRPrototype.app.dshDraft = '待发送消息'; CRPrototype.app.handleSend(); });
    await page.waitForTimeout(120);
    await page.getByRole('button', { name: '导出与发回', exact: true }).click();
    await page.getByRole('menuitem', { name: /补充说明/ }).click();
    await page.waitForTimeout(200);
    check('a sent draft starts empty and accepts the same body again', await page.evaluate(() =>
      CRPrototype.app.dshDraft.includes('## 来源') && CRPrototype.sendBack.writes === 3 && CRPrototype.sendBack.sends === 1));
    await page.locator('.dsh-primary-btn').click();
    await page.waitForTimeout(150);
    await page.evaluate(() => {
      CRPrototype.app.currentDelivery.sessionIds = ['sess-prototype-alt'];
    });
    await page.waitForTimeout(120);
    await page.getByRole('button', { name: '导出与发回', exact: true }).click();
    await page.getByRole('menuitem', { name: /修改问题/ }).click();
    await page.waitForTimeout(200);
    check('dedupe follows the target session draft, not a global registry', await page.evaluate(() => {
      const app = CRPrototype.app;
      return app.dshDraft.includes('## 待处理问题') && CRPrototype.sendBack.writes === 4 &&
        app.activeSessionId === 'sess-prototype-alt' &&
        app.sessionDrafts['sess-prototype-alt'].includes('## 待处理问题') &&
        !app.sessionDrafts['sess-prototype'].includes('## 待处理问题');
    }));

    }
    markStep('conversation draft isolation');
    if (scoped('list')) {
    await open({ scenario: 'list' });
    const navList = async () => { await page.locator('.dsh-nav-item--plugin').click(); await page.waitForTimeout(220); };
    const composerInput = page.locator('textarea[aria-label="会话输入框"]');
    await page.locator(`.delivery-row[data-delivery-id="${data.deliveries[0].id}"] .delivery-session-link`).click();
    await page.waitForTimeout(220);
    await composerInput.fill('PRIVATE_A_MUST_NOT_ENTER_B');
    await page.waitForTimeout(220);
    await navList();
    await page.locator('.delivery-row[data-delivery-id="del-demo-zero"] .delivery-session-link').click();
    await page.waitForTimeout(260);
    const firstEntry = await page.evaluate(() => ({
      value: document.querySelector('textarea[aria-label="会话输入框"]')?.value || '',
      active: CRPrototype.app.activeSessionId,
      drafts: { ...CRPrototype.app.sessionDrafts },
    }));
    check('first entry into a second session starts from its own empty draft', firstEntry.value === '' &&
      firstEntry.active === 'sess-zero' && firstEntry.drafts['sess-prototype'] === 'PRIVATE_A_MUST_NOT_ENTER_B');

    await composerInput.fill('EXISTING_B_DRAFT');
    await page.waitForTimeout(220);
    await navList();
    await page.locator(`.delivery-row[data-delivery-id="${data.deliveries[0].id}"] .delivery-session-link`).click();
    await page.waitForTimeout(220);
    await composerInput.fill('PRIVATE_A_MUST_NOT_ENTER_B');
    await page.waitForTimeout(220);
    await navList();
    await page.locator('.delivery-row[data-delivery-id="del-demo-zero"] .delivery-main').click();
    await page.waitForTimeout(320);
    const openedB = await page.evaluate(() => ({
      view: CRPrototype.app.view,
      active: CRPrototype.app.activeSessionId,
      draft: CRPrototype.app.dshDraft,
      drafts: { ...CRPrototype.app.sessionDrafts },
    }));
    check('opening a review keeps the target session draft and switches the active session', openedB.view === 'review' &&
      openedB.active === 'sess-zero' && openedB.draft === 'EXISTING_B_DRAFT' &&
      openedB.drafts['sess-zero'] === 'EXISTING_B_DRAFT' &&
      openedB.drafts['sess-prototype'] === 'PRIVATE_A_MUST_NOT_ENTER_B');
    await page.getByRole('button', { name: '导出与发回', exact: true }).click();
    await page.getByRole('menuitem', { name: /修改问题/ }).click();
    await page.waitForTimeout(220);
    const appendPreview = await page.locator('.sendback-modal').count() === 1;
    if (appendPreview) await page.getByRole('button', { name: '追加到草稿末尾' }).click();
    await page.waitForTimeout(280);
    const appendedB = await page.evaluate(() => ({
      draft: CRPrototype.app.dshDraft,
      active: CRPrototype.app.activeSessionId,
      bDraft: CRPrototype.app.sessionDrafts['sess-zero'] || '',
      aDraft: CRPrototype.app.sessionDrafts['sess-prototype'] || '',
    }));
    check('appending from B review starts from B draft and never imports A text', appendPreview &&
      appendedB.active === 'sess-zero' && appendedB.draft.startsWith('EXISTING_B_DRAFT') &&
      appendedB.bDraft.startsWith('EXISTING_B_DRAFT') && appendedB.draft.includes('## 待处理问题') &&
      !appendedB.draft.includes('PRIVATE_A_MUST_NOT_ENTER_B') &&
      appendedB.aDraft === 'PRIVATE_A_MUST_NOT_ENTER_B');

    await page.getByRole('button', { name: '发送', exact: true }).click();
    await page.waitForTimeout(220);
    await navList();
    await page.locator(`.delivery-row[data-delivery-id="${data.deliveries[0].id}"] .delivery-session-link`).click();
    await page.waitForTimeout(240);
    const backToA = await page.evaluate(() => ({ value: document.querySelector('textarea[aria-label="会话输入框"]')?.value || '', active: CRPrototype.app.activeSessionId }));
    await page.getByRole('button', { name: '发送', exact: true }).click();
    await page.waitForTimeout(220);
    await navList();
    await page.locator('.delivery-row[data-delivery-id="del-demo-zero"] .delivery-session-link').click();
    await page.waitForTimeout(240);
    const afterBothSends = await page.evaluate(() => ({
      value: document.querySelector('textarea[aria-label="会话输入框"]')?.value || '',
      active: CRPrototype.app.activeSessionId,
      drafts: { ...CRPrototype.app.sessionDrafts },
    }));
    check('switching and sending keeps A and B drafts isolated', backToA.active === 'sess-prototype' &&
      backToA.value === 'PRIVATE_A_MUST_NOT_ENTER_B' &&
      afterBothSends.active === 'sess-zero' && afterBothSends.value === '' &&
      !String(afterBothSends.drafts['sess-prototype'] || '').trim() &&
      !String(afterBothSends.drafts['sess-zero'] || '').trim());
    await composerInput.fill('DRAFT_NOT_PERSISTED');
    await page.waitForTimeout(180);
    await navList();
    await page.locator(`.delivery-row[data-delivery-id="${data.deliveries[0].id}"] .delivery-session-link`).click();
    await page.waitForTimeout(200);
    await composerInput.fill('A_RELOAD_STAYS');
    await page.waitForTimeout(180);
    await navList();
    await page.locator('.delivery-row[data-delivery-id="del-demo-zero"] .delivery-session-link').click();
    await page.waitForTimeout(220);
    await open({ scenario: 'list' });
    await page.locator('.delivery-row[data-delivery-id="del-demo-zero"] .delivery-session-link').click();
    await page.waitForTimeout(260);
    const afterReloadDraft = await page.evaluate(() => ({
      value: document.querySelector('textarea[aria-label="会话输入框"]')?.value || '',
      storage: (() => { try { return Object.values(localStorage).join('\n'); } catch { return ''; } })(),
    }));
    check('drafts are not persisted into another session after a reload', afterReloadDraft.value === '' &&
      !afterReloadDraft.storage.includes('DRAFT_NOT_PERSISTED') &&
      !afterReloadDraft.storage.includes('A_RELOAD_STAYS'));

    }
    markStep('annotation send-back');
    if (scoped('reviewed')) {
      await page.evaluate(() => localStorage.removeItem(CRPrototype.annotations.STORAGE_KEY));
      await open({ scenario: 'reviewed' });
      const linkedProbe = await page.evaluate(() => {
        const app = CRPrototype.app;
        const issue = Object.values(app.issueItemsByFile).flat().find(entry => !entry.suppressed && entry.lineNumber > 0);
        const added = CRPrototype.annotations.add({
          snapshotId: app.snapshot.snapshotId, findingId: issue.issueKey,
          text: 'token=AUDIT_SENTINEL_123456 请把这里的失败分支补上',
        });
        if (added.ok) app.annotationVersion++;
        return { ok: added.ok, id: added.annotation?.annotationId || '', issueId: issue.issueKey, title: issue.title, count: CRPrototype.annotations.list(app.snapshot.snapshotId).length };
      });
      const draftProbe = await page.evaluate(() => CRPrototype.app.buildSendBackContent());
      const annotationIndex = draftProbe.indexOf('## 批注（');
      const findingIndex = draftProbe.indexOf('## 待处理问题（');
      const titleCount = draftProbe.split(linkedProbe.title).length - 1;
      check('the fix draft puts annotations first, masks their text and dedupes the linked problem',
        linkedProbe.ok && annotationIndex >= 0 && findingIndex > annotationIndex &&
        draftProbe.includes(`## 批注（${linkedProbe.count}）`) && draftProbe.includes('## 待处理问题（6）') &&
        !draftProbe.includes('AUDIT_SENTINEL_123456') && draftProbe.includes('token=***') &&
        titleCount === 1);
      const suppressProbe = await page.evaluate(async issueId => {
        const app = CRPrototype.app;
        const issue = app.selectedIssues.find(entry => entry.issueKey === issueId);
        await app.toggleIssueSuppression(issue);
        return app.buildSendBackContent();
      }, linkedProbe.issueId);
      check('a linked annotation notes when its problem was marked non-issue', suppressProbe.includes('原问题已标记为非问题'));

      const lockedProbe = await page.evaluate(async () => {
        const app = CRPrototype.app;
        const target = app.sendBackTarget;
        app.sessionDrafts[target.sessionId] = '已有草稿';
        app.dshDraft = '已有草稿';
        app.sendBackToSession('fix');
        const content = app.sendBackDialog.content;
        const annotation = CRPrototype.annotations.list(app.snapshot.snapshotId).find(entry => entry.findingId);
        CRPrototype.annotations.update(annotation.annotationId, { text: '锁定后修改的批注文字' });
        return { opened: app.sendBackDialog.open, content, changed: app.sendBackDialog.content };
      });
      check('a previewed annotation draft is locked against later annotation edits', lockedProbe.opened &&
        lockedProbe.content === lockedProbe.changed && !lockedProbe.content.includes('锁定后修改的批注文字'));
      const supplement = await page.evaluate(() => CRPrototype.app.buildSupplementContent());
      check('the supplement template never includes annotations', !supplement.includes('## 批注') &&
        !supplement.includes('AUDIT_SENTINEL_123456') && !supplement.includes('锁定后修改的批注文字'));
    }
  },
};
