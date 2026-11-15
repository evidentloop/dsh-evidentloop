/* O2 and overview landing guards: real clicks plus negative fixtures. */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
module.exports = {
  id: 'landing', order: 8, scenarios: ['reviewed'],
  async run(rt) {
    const { page, open, check, shot, markStep, scoped } = rt;
    if (!scoped('reviewed')) return;
    markStep('P1 O2 and overview landing');
    await open({ scenario: 'reviewed' });
    await page.evaluate(() => CRPrototype.app.selectByPath('prototype/scripts/build-data.mjs'));
    await page.waitForTimeout(250);
    await page.mouse.move(0, 0);
    const buttonSample = await page.locator('.issue-card-next').first().evaluate(button => {
      const probe = document.createElement('span'); document.body.append(probe);
      probe.style.color = 'var(--el-label-2)'; const neutral = getComputedStyle(probe).color; probe.remove();
      const box = button.getBoundingClientRect(), icon = button.querySelector('svg').getBoundingClientRect();
      return { width: box.width, height: box.height, iw: icon.width, ih: icon.height, radius: getComputedStyle(button).borderRadius,
        text: button.textContent, path: button.querySelector('path')?.getAttribute('d'), color: getComputedStyle(button).color, neutral,
        last: button === button.parentElement.lastElementChild };
    });
    check('O2 fourth icon is last, icon-only, shaft arrow and 24/16px neutral geometry',
      buttonSample.last && !buttonSample.text.trim() && buttonSample.path === 'M12 4v16M6 14l6 6 6-6' &&
      buttonSample.width === 24 && buttonSample.height === 24 && buttonSample.iw === 16 && buttonSample.ih === 16 &&
      buttonSample.radius === '4px' && buttonSample.color === buttonSample.neutral);
    await page.locator('.issue-card-next').first().hover();
    check('O2 hover uses brand and brand-tint tokens', await page.locator('.issue-card-next').first().evaluate(button => {
      const probe = document.createElement('span'); document.body.append(probe);
      const token = name => { probe.style.color = `var(${name})`; return getComputedStyle(probe).color; };
      const style = getComputedStyle(button), ok = style.color === token('--el-brand') && style.backgroundColor === token('--el-brand-tint');
      probe.remove(); return ok;
    }));
    const keys = await page.locator('.gpt-risk-marker:not(.gpt-risk-marker--suppressed)').evaluateAll(cards => cards.map(card => card.dataset.issueKey));
    check('O2 loop fixture has multiple distinct cards', keys.length > 1 && new Set(keys).size === keys.length);
    let loopOK = true;
    for (let step = 0; step < keys.length * 2; step++) {
      const index = step % keys.length, next = (index + 1) % keys.length;
      // Click the current card's real button; navigation transfers focus for repeated keyboard activation.
      await page.locator('.gpt-risk-marker:not(.gpt-risk-marker--suppressed)').nth(index).locator('.issue-card-next').click();
      loopOK &&= await page.evaluate(key => {
        const card = document.querySelector('.gpt-risk-marker.card-highlight-pulse');
        return card?.dataset.issueKey === key && !card.classList.contains('is-collapsed') &&
          document.activeElement === card.querySelector('.issue-card-next') && getComputedStyle(card).animationDuration === '1.6s';
      }, keys[next]);
    }
    check('O2 completes two loops without a fixed index, expands and pulses the destination', loopOK);
    await page.waitForTimeout(1700);
    check('O2 pulse expires after 1.6s', await page.locator('.card-highlight-pulse').count() === 0);
    await page.evaluate(() => {
      const app = CRPrototype.app, key = app.selectedFileItem.md5_str;
      window.__landingStaleNext = document.querySelector('.issue-card-next');
      app.diffDict[key].findings = app.diffDict[key].findings.filter(finding => !finding.suppressed).slice(0, 1);
    });
    await page.waitForTimeout(200);
    check('O2 negative: a single issue hides the navigation arrow', await page.locator('.gpt-risk-marker:not(.gpt-risk-marker--suppressed)').count() === 1 &&
      await page.locator('.issue-card-next').count() === 0);
    await page.evaluate(() => { CRPrototype.app.diffDict[CRPrototype.app.selectedFileItem.md5_str].findings = []; });
    await page.waitForTimeout(200);
    await page.evaluate(() => { window.__landingStaleNext.click(); delete window.__landingStaleNext; });
    check('O2 negative: zero issues hide navigation and stale clicks safely no-op', await page.locator('.gpt-risk-marker,.issue-card-next').count() === 0);

    await open({ scenario: 'reviewed', main: 'overview' });
    const expectedSections = ['overview-conclusion','overview-features','overview-alignment','overview-problems','overview-coverage','overview-requirements'];
    const sectionIds = () => page.locator('.overview-inner > [id]').evaluateAll(nodes => nodes.map(node => node.id));
    check('overview keeps exactly the six section IDs in order', JSON.stringify(await sectionIds()) === JSON.stringify(expectedSections));
    check('requirements root is details with a direct summary and folded by default', await page.locator('details#overview-requirements.overview-requirements > summary').count() === 1 &&
      await page.locator('#overview-requirements').evaluate(node => !node.open));
    check('overview uses the same 12px top and side gutter as the file area', await page.locator('.overview-main').evaluate(node => {
      const style = getComputedStyle(node); return [style.paddingTop, style.paddingLeft, style.paddingRight].every(value => value === '12px');
    }));
    check('overview defaults to severity with four live statistics', await page.getByRole('button', { name: '按严重度', exact: true }).getAttribute('aria-pressed') === 'true' &&
      await page.locator('.overview-stat strong').evaluateAll(nodes => nodes.map(node => Number(node.textContent)).join(',') ===
        [CRPrototype.app.activeFindingsList.length, CRPrototype.app.allFeatures.length, CRPrototype.app.implementedAlignmentGroup?.items.length || 0, CRPrototype.app.coverage.reviewed.length].join(',')));
    for (let index = 0; index < 4; index++) {
      await page.locator('.overview-stat').nth(index).click();
      check('statistics pill jumps to ' + expectedSections[[3,1,2,4][index]],
        await page.locator('#' + expectedSections[[3,1,2,4][index]]).evaluate(node => node.classList.contains('overview-section--target')));
    }
    const issueKeys = () => page.locator('.overview-problem').evaluateAll(nodes => nodes.map(node => node.dataset.issueKey).sort());
    const severityKeys = await issueKeys();
    await page.locator('.overview-requirements > summary').click();
    await page.getByRole('button', { name: '按文件', exact: true }).click();
    check('file view groups every issue once without repeating row paths', JSON.stringify(await issueKeys()) === JSON.stringify(severityKeys) &&
      await page.locator('.overview-file-head').count() > 0 && await page.locator('.overview-problem .overview-file-path').count() === 0);
    check('file view keeps six sections and the expanded requirement state', JSON.stringify(await sectionIds()) === JSON.stringify(expectedSections) &&
      await page.locator('details.overview-requirements').evaluate(node => node.open));
    await page.getByRole('button', { name: '按严重度', exact: true }).click();
    check('severity roundtrip preserves issue identities and each row has one title target', JSON.stringify(await issueKeys()) === JSON.stringify(severityKeys) &&
      await page.locator('.overview-problem').evaluateAll(rows => rows.every(row => row.querySelectorAll('.overview-problem__title').length === 1 &&
        row.querySelector('.overview-problem__jump').textContent.trim() === '↗' && row.querySelector('.overview-problem__meta').textContent.trim())));
    await page.mouse.move(0, 0); await page.waitForTimeout(200);
    check('jump hints are hidden at rest and paths use the approved Maple font', await page.locator('.overview-file-path__hint,.overview-problem__jump').evaluateAll(nodes =>
      nodes.every(node => getComputedStyle(node).opacity === '0')) && await page.locator('.overview-file-path').first().evaluate(node => getComputedStyle(node).fontFamily.split(',')[0].replaceAll(String.fromCharCode(34), '').trim() === 'Maple Mono NF CN'));
    check('delta dots use CSS geometry, not emoji, and severity bars remain present', await page.locator('.overview-delta-badge').evaluateAll(nodes => nodes.every(node =>
      !/[●⚪]/.test(node.textContent) && getComputedStyle(node, '::before').width === '6px')) && await page.locator('.overview-severity-bar').count() === 3);
    const componentStyles = fs.readFileSync(path.resolve(__dirname, '../../styles/shell.css'), 'utf8');
    check('component stylesheet has no hardcoded hex or rgba colors', !/#[0-9a-f]{3,8}\b|rgba?\(/i.test(componentStyles));
    // Empty data must remain navigable without manufacturing findings.
    await open({ scenario: 'zero', main: 'overview' });
    await page.getByRole('button', { name: '按文件', exact: true }).click();
    check('empty negative: both problem views keep zero issues and six sections', await page.locator('.overview-problem').count() === 0 &&
      JSON.stringify(await sectionIds()) === JSON.stringify(expectedSections));
    await page.getByRole('button', { name: '按严重度', exact: true }).click();
    check('empty negative: severity switch returns safely without phantom groups', await page.locator('.overview-problem-group').count() === 0);
    // Capture both themes at the requested 1000px viewport, hero and both grouping views.
    await page.setViewportSize({ width: 1000, height: 900 });
    for (const theme of ['light', 'dark']) {
      await open({ scenario: 'reviewed', main: 'overview', theme });
      check('1000px overview keeps the 12px gutter in ' + theme, await page.locator('.overview-main').evaluate(node => {
        const style = getComputedStyle(node); return [style.paddingTop, style.paddingLeft, style.paddingRight].every(value => value === '12px');
      }));
      await shot('p1-overview-hero-1000-' + theme);
      await page.locator('#overview-problems').scrollIntoViewIfNeeded();
      await shot('p1-overview-severity-1000-' + theme);
      await page.getByRole('button', { name: '按文件', exact: true }).click();
      await shot('p1-overview-file-1000-' + theme);
      await page.evaluate(() => CRPrototype.app.selectByPath('prototype/scripts/build-data.mjs'));
      await page.waitForTimeout(250);
      await page.locator('.gpt-risk-marker').first().scrollIntoViewIfNeeded();
      await page.mouse.move(0, 0);
      check('O2 base color stays neutral in ' + theme, await page.locator('.issue-card-next').first().evaluate(button => {
        const probe = document.createElement('span'); probe.style.color = 'var(--el-label-2)'; document.body.append(probe);
        const neutral = getComputedStyle(probe).color; probe.remove(); return getComputedStyle(button).color === neutral;
      }));
      await shot('p1-o2-1000-' + theme);
      check('1000px layout has no horizontal overflow in ' + theme, await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth &&
        [...document.querySelectorAll('.overview-main,.gpt-risk-marker__header')].every(node => node.scrollWidth <= node.clientWidth + 1)));
    }
  },
};
