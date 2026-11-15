'use strict';
module.exports = { id: 'p4-parity', order: 14, scenarios: ['reviewed'], async run(rt) {
  const { page, open, check, shot } = rt;
  await open({ scenario: 'reviewed', file: 'prototype/scripts/build-data.mjs', main: 'diff' });
  const fonts = await page.evaluate(() => [...document.querySelectorAll('.d2h-code-line-ctn,.gpt-risk-marker__content code,.ref-link')].filter(e => e.getClientRects().length).map(e => getComputedStyle(e).fontFamily));
  check('P4 Diff, suggestions, inline code and paths share Maple code fonts', fonts.length > 0 && fonts.every(f => f.startsWith('"Maple Mono NF CN"')) && new Set(fonts).size === 1);
  const fixture = await page.evaluate(async () => {
    const app = CRPrototype.app, c = app.$refs.codeReview, key = app.selectedFileItem.md5_str;
    const first = c.issues.find(i => !i.suppressed && i.side === 'head' && !c.isFileLevelIssue(i));
    if (!first) throw Error('Need an actual head line');
    app.diffDict[key].findings = [1, 2].map(n => ({ ...JSON.parse(JSON.stringify(first.finding)), findingId: 'parity-' + n, suppressed: true }));
    await app.$nextTick(); return { key, line: first.lineNumber };
  });
  await page.waitForFunction(() => document.querySelectorAll('.focus-suppressed-marker').length === 2);
  const markers = page.locator('.focus-suppressed-marker');
  const rects = (await markers.evaluateAll(es => es.map(e => { const r=e.getBoundingClientRect(); return {left:r.left,right:r.right}; }))).sort((a,b) => a.left-b.left);
  check('P4 same-line neutral markers occupy separate reachable slots', rects[1].left >= rects[0].right - .5);
  await markers.first().click();
  const card = page.locator('.gpt-risk-marker[data-issue-key="parity-1"]');
  check('P4 suppressed card exposes recovery without comment, ask or next actions', await card.locator('.gpt-risk-marker__restore').count() === 1 && await card.locator('.issue-card-comment,.issue-card-ask,.issue-card-next').count() === 0);
  await card.locator('.gpt-risk-marker__restore').click();
  await page.getByRole('button', { name: '恢复', exact: true }).last().click();
  await page.waitForFunction(() => !document.querySelector('.gpt-risk-marker[data-issue-key="parity-1"]').classList.contains('gpt-risk-marker--suppressed'));
  check('P4 recovery leaves the other same-line marker suppressed', await page.locator('.focus-suppressed-marker').count() === 1);
  await shot('p4-same-line-recovered');
  const states = await page.evaluate(() => ['migration-required', 'unavailable', 'current'].map(formatStatus => CRPrototype.status.sessionViewOf({ sessionId: 'fixture', title: '会话', formatStatus })));
  check('P4 migration and unavailable sessions are static with a reason', states[0].state === 'unavailable' && states[1].state === 'unavailable' && states[0].tip.length > 0);
  check('P4 supported current session stays addressable', states[2].state === 'present');
  const quote = await page.evaluate(() => {
    const app=CRPrototype.app, target=app.devSessionFor(app.currentDelivery), text='手写草稿  \n\n';
    app.activeSessionId=target.sessionId; app.dshDraft=text; app.sessionDrafts[target.sessionId]=text;
    app.appendAskToSession('P4追加正文','P4追加正文'); const once=app.dshDraft;
    app.appendAskToSession('P4追加正文','P4追加正文');
    return {once,twice:app.dshDraft,expected:text+'\n\nP4追加正文'};
  });
  check('P4 quote append preserves trailing whitespace and existing draft bytes', quote.once===quote.expected);
  check('P4 repeating quote does not append twice', quote.twice===quote.once);
  await open({ scenario:'list' });
  const prefs = await page.evaluate(() => {
    const app=CRPrototype.app; app.listProblemOnly=true;app.listSort='problems';app.listLayout='compact';
    app.openReview('list');app.reviewBack();
    return {filter:app.listProblemOnly,sort:app.listSort,layout:app.listLayout,view:app.view};
  });
  check('P4 list preferences survive review and back', prefs.filter && prefs.sort==='problems' && prefs.layout==='compact' && prefs.view==='list');
}};
