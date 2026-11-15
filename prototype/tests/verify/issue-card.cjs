/* Issue-card-only presentation contract; runtime fixtures never change frozen data files. */
'use strict';
module.exports = {
  id: 'issue-card', order: 9, scenarios: ['reviewed'],
  async run(rt) {
    const { page, open, check, shot, markStep, scoped } = rt;
    if (!scoped('reviewed')) return;
    markStep('unified issue-card suggestion contract');
    const constraint = '只接受 true，其他值保持关闭；保留必要约束 <input> & 不自动扩展输入范围。';
    const code = 'const enabled = value === "true";\nreturn enabled;';
    for (const location of ['inline', 'file', 'beyond']) {
      for (const variant of ['text-code', 'text', 'none']) {
        await open({ scenario: 'reviewed', file: 'prototype/scripts/build-data.mjs' });
        const fixture = await page.evaluate(({ location, variant, constraint, code }) => {
          const app = CRPrototype.app, component = app.$refs.codeReview, key = app.selectedFileItem.md5_str;
          const issue = component.issues.find(entry => !entry.suppressed && entry.side === 'head' && entry.lineNumber > 2 && !component.isFileLevelIssue(entry));
          if (!issue) throw new Error('A real inline head-side issue is required');
          const finding = JSON.parse(JSON.stringify(issue.finding));
          if (variant === 'none') delete finding.suggestion;
          else finding.suggestion = variant === 'text-code' ? { text: constraint, code } : { text: constraint };
          if (location === 'file') finding.anchor.line = null;
          if (location === 'beyond') {
            // Show a smaller excerpt of the real added lines; the anchor remains a real frozen-file line.
            const added = app.originDiffDict[key].diff.split('\n').filter(line => line.startsWith('+') && !line.startsWith('+++')).slice(0, 2);
            if (added.length !== 2) throw new Error('Need two real added lines for the limited diff excerpt');
            app.originDiffDict[key].diff = '@@ -0,0 +1,2 @@\n' + added.join('\n');
          }
          app.diffDict[key].findings = [finding];
          return { key: finding.findingId, line: finding.anchor.line, location, variant };
        }, { location, variant, constraint, code });
        await page.waitForTimeout(240);
        const card = page.locator('.gpt-risk-marker[data-issue-key="' + fixture.key + '"]');
        const structure = await card.evaluate(node => ({
          suggestions: node.querySelectorAll('.gpt-risk-marker__suggestion').length,
          headings: [...node.querySelectorAll('.gpt-risk-marker__suggestion-heading,.gpt-risk-marker__code-head-left')].map(node => node.textContent.trim()),
          text: node.querySelector('.gpt-risk-marker__text-solution')?.textContent || '',
          code: node.querySelector('.gpt-risk-marker__code-body code')?.textContent || '',
          codeBlocks: node.querySelectorAll('.gpt-risk-marker__code-body').length,
          copies: node.querySelectorAll('.gpt-risk-marker__code-copy').length,
          oldHeadings: /建议方案：|建议代码/.test(node.querySelector('.gpt-risk-marker__content').textContent),
          fileLevel: node.classList.contains('focus-file-level-card'),
          repeats: node.querySelectorAll('.gpt-evidence-block,.finding-line,.gpt-risk-marker__location').length,
        }));
        check(location + '/' + variant + ': single suggestion region or none, with no old duplicated heading',
          structure.suggestions === (variant === 'none' ? 0 : 1) && !structure.oldHeadings &&
          JSON.stringify(structure.headings) === JSON.stringify(variant === 'none' ? [] : ['修改建议']));
        check(location + '/' + variant + ': necessary text and optional code are preserved without empty frames',
          structure.text === (variant === 'none' ? '' : constraint) && structure.code === (variant === 'text-code' ? code : '') &&
          structure.codeBlocks === (variant === 'text-code' ? 1 : 0) && structure.copies === (variant === 'text-code' ? 1 : 0));
        check(location + '/' + variant + ': original placement fallback, no repeated source or location chip',
          structure.fileLevel === (location !== 'inline') && structure.repeats === 0);
        if (location === 'beyond') {
          check('beyond/' + variant + ': valid frozen line outside shown excerpt never gets a fabricated diff row',
            await page.locator('.code-review-lite__body [data-line="' + fixture.line + '"]').count() === 0 && fixture.line > 2);
        }
        const header = card.locator('.gpt-risk-marker__header');
        await header.press('Enter');
        check(location + '/' + variant + ': Enter collapses the card', await header.getAttribute('aria-expanded') === 'false');
        await header.press('Space');
        check(location + '/' + variant + ': Space expands the same card', await header.getAttribute('aria-expanded') === 'true');
        if (variant === 'text-code') {
          const copy = card.locator('.gpt-risk-marker__code-copy');
          await copy.click();
          check(location + ': copying code changes neither card nor suggestion collapse state',
            await header.getAttribute('aria-expanded') === 'true' &&
            await card.locator('.gpt-risk-marker__code-head').getAttribute('aria-expanded') === 'true' &&
            await card.locator('.gpt-risk-marker__code-body').evaluate(node => !node.hidden) &&
            await page.evaluate(() => navigator.clipboard.readText()) === code);
          await card.locator('.gpt-risk-marker__code-head').press('Enter');
          check(location + ': one suggestion heading folds both text and code without collapsing the issue',
            await card.locator('.gpt-risk-marker__text-solution').isHidden() && await card.locator('.gpt-risk-marker__code-body').isHidden() &&
            await header.getAttribute('aria-expanded') === 'true');
          await card.locator('.gpt-risk-marker__code-head').press('Space');
          check(location + ': expanding suggestion restores all necessary text', await card.locator('.gpt-risk-marker__text-solution').innerText() === constraint);
        }
        if (location === 'inline') {
          await card.scrollIntoViewIfNeeded();
          await shot('issue-card-' + variant + '-light');
        }
      }
    }
    // Do not alter real data: create a runtime long-content negative after a fresh scenario.
    for (const theme of ['light', 'dark']) for (const width of [1000, 1600]) {
      await page.setViewportSize({ width, height: 900 });
      await open({ scenario: 'reviewed', file: 'prototype/scripts/build-data.mjs', theme, style: width === 1000 ? 'double' : 'single' });
      await page.evaluate(({ constraint }) => {
        const app = CRPrototype.app, key = app.selectedFileItem.md5_str;
        const finding = JSON.parse(JSON.stringify(app.$refs.codeReview.issues.find(issue => !issue.suppressed).finding));
        finding.title = '长标题边界 '.repeat(40);
        finding.suggestion = { text: constraint.repeat(3), code: 'const longValue = "' + 'x'.repeat(400) + '";\nreturn longValue;' };
        app.diffDict[key].findings = [finding];
      }, { constraint });
      await page.waitForTimeout(240);
      const card = page.locator('.gpt-risk-marker:not(.gpt-risk-marker--suppressed)').first();
      await card.scrollIntoViewIfNeeded(); await page.mouse.move(0, 0);
      const geometry = await card.evaluate(node => {
        const header = node.querySelector('.gpt-risk-marker__header'), hr = header.getBoundingClientRect();
        const title = node.querySelector('.gpt-risk-marker__title').getBoundingClientRect();
        const actions = node.querySelector('.gpt-risk-marker__header-right').getBoundingClientRect();
        const copy = node.querySelector('.gpt-risk-marker__code-copy').getBoundingClientRect();
        const head = node.querySelector('.gpt-risk-marker__code-head').getBoundingClientRect();
        return { height: hr.height, titleEnd: title.right, actionStart: actions.left,
          headerOverflow: header.scrollWidth > header.clientWidth + 1, copyFits: copy.left >= head.left && copy.right <= head.right + 1,
          cardOverflow: node.scrollWidth > node.clientWidth + 1,
          narrativeFont: getComputedStyle(node.querySelector('.gpt-risk-marker__narrative')).fontSize,
          textFont: getComputedStyle(node.querySelector('.gpt-risk-marker__text-solution')).fontSize,
          codeFont: getComputedStyle(node.querySelector('.gpt-risk-marker__code-body')).fontSize };
      });
      check(theme + '/' + width + ': long title and code keep all actions unoccluded', geometry.height === 34 &&
        geometry.titleEnd <= geometry.actionStart + 1 && !geometry.headerOverflow && geometry.copyFits && !geometry.cardOverflow);
      check(theme + '/' + width + ': body and suggestion typography follow approved reading hierarchy',
        geometry.narrativeFont === '12.5px' && geometry.textFont === '12.5px' && geometry.codeFont === '11.5px');
      await card.locator('.gpt-risk-marker__code-copy').focus();
      check(theme + '/' + width + ': copy has a visible keyboard focus indicator', await card.locator('.gpt-risk-marker__code-copy').evaluate(node =>
        getComputedStyle(node).outlineStyle !== 'none' && getComputedStyle(node).outlineWidth === '2px'));
      await page.mouse.move(0, 0);
      await shot('issue-card-long-' + width + '-' + theme);
    }
    for (const theme of ['light', 'dark']) {
      await page.setViewportSize({ width: 1000, height: 900 });
      await open({ scenario: 'reviewed', file: 'prototype/scripts/build-data.mjs', theme, style: 'double' });
      const headers = await page.locator('.gpt-risk-marker:not(.gpt-risk-marker--suppressed)').evaluateAll(cards => cards.map(card => {
        const header = card.querySelector('.gpt-risk-marker__header').getBoundingClientRect();
        const title = card.querySelector('.gpt-risk-marker__title').getBoundingClientRect();
        const actions = card.querySelector('.gpt-risk-marker__header-right').getBoundingClientRect();
        const buttons = [...card.querySelectorAll('.gpt-risk-marker__header-right > button')];
        return { titleWidth: title.width, separate: title.right <= actions.left + 1, headerHeight: header.height,
          actionsFit: buttons.every(button => { const box = button.getBoundingClientRect(); return box.width === 24 && box.left >= header.left && box.right <= header.right + 1; }) };
      }));
      check(theme + '/actual-1000: real narrow cards keep a visible title and all original action slots', headers.length > 0 &&
        headers.every(row => row.titleWidth >= 24 && row.separate && row.headerHeight === 34 && row.actionsFit));
      await page.locator('.gpt-risk-marker__code-panel').first().evaluate(node => node.closest('.gpt-risk-marker').scrollIntoView({ block: 'center' }));
      await shot('issue-card-actual-1000-' + theme);
    }
    // Original action methods and their frozen data remain in use.
    await open({ scenario: 'reviewed', file: 'prototype/scripts/build-data.mjs' });
    const card = page.locator('.gpt-risk-marker:not(.gpt-risk-marker--suppressed)').first();
    await card.locator('.issue-card-comment').click();
    check('annotation action opens the real editor without folding the card', await page.locator('.annotation-editor').count() === 1 &&
      await card.locator('.gpt-risk-marker__header').getAttribute('aria-expanded') === 'true');
    await page.locator('.annotation-editor textarea').press('Escape');
    check('Escape closes the real annotation editor', await page.locator('.annotation-editor').count() === 0);
    await card.locator('.issue-card-suppress').click();
    check('mark action opens the original confirmation without folding the card', await page.locator('.n-popconfirm').count() === 1 &&
      await card.locator('.gpt-risk-marker__header').getAttribute('aria-expanded') === 'true');
    await page.keyboard.press('Escape');
    check('Escape cancels the mark confirmation without mutating the issue', await page.locator('.n-popconfirm').count() === 0 &&
      await card.locator('.issue-card-suppress').count() === 1);
    await open({ scenario: 'history' });
    check('history still exposes no write controls on issue cards', await page.locator('.issue-card-comment,.issue-card-suppress,.gpt-risk-marker__restore').count() === 0);
  },
};
