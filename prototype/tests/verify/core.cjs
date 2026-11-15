/* verify module: core (serial prefix and data contract) */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
module.exports = {
  id: 'core',
  order: -1,
  scenarios: [],
  async run(rt) {
    const { page, context, output, data: initialData, scoped, selectedScenarios, SCENARIOS, ONLY } = rt;
    const { open, state, shot, check, markStep, ensureOverview, filterByMode, currentData } = rt;
    const { guardIgnores, REPO_ROOT, internalAssetOffenders } = rt.helpers;
    const { logLine } = rt;
    let s;
    markStep('source and static checks');
    check('host blue palette uses separate interaction and small-text tiers', rt.helpers.assertBrandPaletteInSource() > 0);
    check('static assets contain no internal domains or unapproved internal tokens', rt.helpers.assertNoInternalAssets() > 0);
    const readmeSource = fs.readFileSync(path.join(rt.root, 'README.md'), 'utf8');
    const focusSource = fs.readFileSync(path.join(rt.root, 'src', 'focus-review.js'), 'utf8');
    const uiSource = fs.readFileSync(path.join(rt.root, 'src', 'ui.js'), 'utf8');
    check('README uses the new section numbering and compatibility paths are gone',
      !/§4\.[1-6]|§5\b|§9\b/.test(readmeSource) && !readmeSource.includes('hostExpanded') &&
      !readmeSource.includes('collapsed') && !focusSource.includes('hostExpanded') &&
      !uiSource.includes('exitFullscreen'));
    let readonlyGuard = rt.helpers.createReadonlyGuard([
      path.join(rt.root, 'data'),
      path.resolve(rt.root, '..'),
    ]);
    rt.helpers.setReadonlyGuard(readonlyGuard);
    readonlyGuard.capture();
    readonlyGuard.start();
    if (rt.FAULT === 'assert') {
      markStep('fault injection');
      logLine('[fault] reached assert');
      check('fault injection: deliberate assertion failure', false);
    }
    if (rt.FAULT === 'hang') {
      markStep('fault injection');
      logLine('[fault] hanging until the total timeout fires');
      await new Promise(() => {});
    }
    markStep('collector and readonly guards');
    check('collector isolates redirected Git environment and keeps inputSha', Boolean(rt.helpers.assertCollectorIsolation(rt.output)));
    check('readonly guard ignores main-brain directories but still covers prototype and git',
      guardIgnores(REPO_ROOT, 'docs' + path.sep + 'guide.md') &&
      guardIgnores(REPO_ROOT, '.sopify' + path.sep + 'state' + path.sep + 'active_plan.json') &&
      guardIgnores(REPO_ROOT, '.git' + path.sep + 'trae-ai-tob' + path.sep + 'last-checkpoint-head') &&
      !guardIgnores(REPO_ROOT, 'prototype' + path.sep + 'src' + path.sep + 'app.js') &&
      !guardIgnores(REPO_ROOT, '.git' + path.sep + 'index') &&
      !guardIgnores(path.join(output, 'elsewhere'), 'docs' + path.sep + 'guide.md'));
    const repoManifestKeys = Object.keys(readonlyGuard.snapshots[REPO_ROOT] || {});
    check('repository manifest excludes docs and .sopify while keeping the monitored roots',
      !repoManifestKeys.some(key => key === 'docs' || key.startsWith('docs' + path.sep) ||
        key === '.sopify' || key.startsWith('.sopify' + path.sep)) &&
      repoManifestKeys.some(key => key === path.join('tests', 'verify.cjs') || key === path.join('prototype', 'tests', 'verify.cjs')) &&
      (!fs.existsSync(path.join(REPO_ROOT, '.git')) || repoManifestKeys.includes(path.join('.git', 'HEAD'))));
    check('readonly guard detects restored-mtime overwrite and transient traces',
      Boolean(await rt.helpers.assertReadonlyGuard(rt.output)));
    check('readonly watcher close failure stays unconfirmed after a cleanup retry',
      Boolean(await rt.helpers.assertWatcherCloseFailure(rt.output)));
    markStep('verifier self-test');
    const assertFault = rt.helpers.runVerifierFault('assert');
    const assertOut = assertFault.stdout || '';
    check('verifier self-test: an assertion failure reaches the injected fault, cleans up, then exits 1',
      assertFault.status === 1 && assertFault.signal === null && assertFault.elapsedMs < 60000 &&
      /\[fault\] reached assert/.test(assertOut) &&
      /failed check: fault injection: deliberate assertion failure/.test(assertOut) &&
      /error: fault injection: deliberate assertion failure/.test(assertOut) &&
      assertOut.indexOf('[cleanup] browser and listeners closed') >= 0 &&
      assertOut.indexOf('[cleanup] browser and listeners closed') < assertOut.indexOf('=== FAILURE SUMMARY ==='));
    const hangFault = rt.helpers.runVerifierFault('hang', { VERIFY_TOTAL_TIMEOUT_MS: '4000' });
    const hangOut = hangFault.stdout || '';
    check('verifier self-test: the total timeout stops a hanging run, cleans up, then exits 1',
      hangFault.status === 1 && hangFault.signal === null && hangFault.elapsedMs < 60000 &&
      /\[fault\] hanging/.test(hangOut) &&
      /failed check: total timeout/.test(hangOut) &&
      /error: verifier exceeded 4000 ms/.test(hangOut) &&
      hangOut.indexOf('[cleanup] browser and listeners closed') >= 0 &&
      hangOut.indexOf('[cleanup] browser and listeners closed') < hangOut.indexOf('=== FAILURE SUMMARY ==='));
    const configFault = rt.helpers.runVerifierFault('assert', { VERIFY_TOTAL_TIMEOUT_MS: 'NaN' });
    check('verifier self-test: an invalid total timeout is rejected before launching',
      configFault.status === 2 && /CONFIG ERROR/.test(`${configFault.stdout || ''}${configFault.stderr || ''}`) &&
      !/FAILURE SUMMARY/.test(configFault.stdout || ''));
    const fakeLauncher = rt.helpers.fakeLauncherPlaywright();
    const launchFault = rt.helpers.runVerifierFault('hang', {}, fakeLauncher.file);
    const launchOut = launchFault.stdout || '';
    const hangPredicate = text => /\[fault\] hanging/.test(text) && /failed check: total timeout/.test(text) && /exceeded 4000 ms/.test(text);
    check('verifier self-test: a launcher error mentioning the timeout is not accepted as the hang fault',
      launchFault.status !== 0 && launchFault.signal === null && !hangPredicate(launchOut));
    fs.rmSync(fakeLauncher.directory, { recursive: true, force: true });
    const cleanupFail = rt.helpers.runVerifierFault('cleanup-fail', { VERIFY_CLEANUP_TIMEOUT_MS: '300' });
    const cleanupFailOut = cleanupFail.stdout || '';
    check('verifier self-test: a close failure is reported as unconfirmed cleanup',
      cleanupFail.status === 0 && cleanupFail.signal === null && cleanupFail.elapsedMs < 60000 &&
      /清理未确认/.test(cleanupFailOut) && /browser=failed/.test(cleanupFailOut) &&
      /listeners=failed/.test(cleanupFailOut) &&
      !/browser and listeners closed/.test(cleanupFailOut));
    const cleanupTimeout = rt.helpers.runVerifierFault('cleanup-timeout', { VERIFY_CLEANUP_TIMEOUT_MS: '300' });
    const cleanupTimeoutOut = cleanupTimeout.stdout || '';
    check('verifier self-test: a close timeout is reported as unconfirmed cleanup',
      cleanupTimeout.status === 0 && cleanupTimeout.signal === null && cleanupTimeout.elapsedMs < 60000 &&
      /清理未确认/.test(cleanupTimeoutOut) && /browser=timeout/.test(cleanupTimeoutOut) &&
      /listeners=timeout/.test(cleanupTimeoutOut) &&
      !/browser and listeners closed/.test(cleanupTimeoutOut));
    if (ONLY === null) {
      const onlyRun = rt.helpers.runVerifierOnly({ VERIFY_ONLY: 'records' });
      const onlyOut = `${onlyRun.stdout || ''}${onlyRun.stderr || ''}`;
      check('VERIFY_ONLY runs only the listed scenario and reports a partial run',
        onlyRun.status === 0 && onlyRun.signal === null &&
        /=== PARTIAL RUN ===/.test(onlyOut) && /部分运行：1 个场景（records）/.test(onlyOut) &&
        /本次只运行了所列场景的检查与截图/.test(onlyOut) &&
        !/=== PASS SUMMARY ===/.test(onlyOut) && !/scenario screenshot exists: list/.test(onlyOut));
      const onlyInvalid = rt.helpers.runVerifierOnly({ VERIFY_ONLY: 'no-such-scenario' });
      check('VERIFY_ONLY rejects unknown scenario names before launching a browser',
        onlyInvalid.status === 2 && onlyInvalid.signal === null &&
        /CONFIG ERROR: VERIFY_ONLY/.test(`${onlyInvalid.stdout || ''}${onlyInvalid.stderr || ''}`) &&
        !/FAILURE SUMMARY/.test(onlyInvalid.stdout || ''));
    }
    const fixturePath = '/' + 'Users' + '/' + 'exampleuser' + '/work';
    const fixtureEmail = 'author' + '@' + 'corp' + '.test';
    const fixturePhone = '138' + '0013' + '8000';
    const fixtureSecret = 'sk-' + 'ABCDEFGHIJKLMNOPQRSTUV';
    check('sensitive pattern scan rejects local paths, emails, phone numbers and secret formats',
      internalAssetOffenders(fixturePath, 'fixture').length === 1 &&
      internalAssetOffenders(fixtureEmail, 'fixture').length === 1 &&
      internalAssetOffenders(fixturePhone, 'fixture').length === 1 &&
      internalAssetOffenders(fixtureSecret, 'fixture').length === 1 &&
      internalAssetOffenders('contact audit@example.com', 'fixture').length === 0 &&
      internalAssetOffenders('https://example.com/path', 'fixture').length === 0);

    // ---------- data and fixed entry name ----------
    await open();
    const data = await currentData();
    check('file:// origin', await page.evaluate(() => location.protocol) === 'file:');
    check('snapshot has files', data.files > 0 && data.reviewable > 0);
    check('vendor files are excluded metadata only', data.vendor.length > 0 &&
      data.vendor.every(file => file.kind === 'excluded' && !file.hasDiff && file.hasHash));
    check('basis values stay within code fact and model inference', data.bases.every(basis => ['fact', 'model'].includes(basis)) &&
      data.bases.includes('model'));
    check('finding categories use the three contract values', data.findingCategories.length > 0 &&
      data.findingCategories.every(category => ['logic', 'security', 'performance'].includes(category)));
    check('severity uses P0/P1/P2 only', data.findingSeverities.every(severity => ['P0', 'P1', 'P2'].includes(severity)) &&
      data.findingSeverities.includes('P0'));
    check('every finding has a rule source loaded by the run', data.ruleSourceIds.every(id => data.ruleSources.includes(id)));
    check('every finding uses an anchor and one is file-level', data.findingAnchors.every(anchor =>
      anchor && anchor.path && anchor.side === 'head' && (anchor.line === null || Number.isInteger(anchor.line))) &&
      data.findingAnchors.some(anchor => anchor.line === null));
    check('at least one semantic is unclear', data.semantics.some(item => item.status === 'unclear'));
    check('stated semantic items carry refs and unclear may omit them', data.semantics.every(item =>
      item.status === 'unclear' ? item.items > 0 : item.items > 0 && item.refs > 0));
    check('key symbol table is gone from the data', data.semantics.every(item => item.hasKeySymbols === false));
    check('deliveries include real and synthetic history', data.deliveries.length >= 4 &&
      data.deliveries.some(delivery => !delivery.synthetic && delivery.snapshots > 1) &&
      data.deliveries.some(delivery => delivery.status === 'zero') &&
      data.deliveries.some(delivery => delivery.status === 'incomplete') &&
      data.deliveries.some(delivery => delivery.closedAt) &&
      data.deliverySnapshotIds === true);
    check('deliveries carry purpose, highest severity and sessions', data.deliveries.every(delivery =>
      Boolean(delivery.purpose)) && data.deliveries.every(delivery =>
      (Number(delivery.validFindingCount) > 0) === Boolean(delivery.highestSeverity)) &&
      data.sessions.some(session => session.kind === 'dev') && data.sessions.some(session => session.kind === 'review'));
    check('overview highlights and impacts carry refs', data.highlights.length > 0 &&
      data.highlights.every(count => count > 0) && data.impactRefs.every(count => count > 0));
    check('behavior impacts are model inference and extras are real out-of-scope changes',
      data.impactBases.every(basis => basis === 'model') && data.extraBases.every(basis => basis === 'model') &&
      !data.extraTexts.some(text => /离线|字体|图标字体|演示|局限/.test(text)));
    check('impacts carry contract kinds and features carry approach', data.impactKinds.every(kind =>
      ['api', 'data', 'config', 'behavior', 'dependency', 'ui'].includes(kind)) &&
      data.featureRefs.every(count => count > 0) && data.featureApproaches.every(Boolean));
    check('withheld includes missing-ref', data.withheldCodes.includes('missing-ref'));
    check('withheld follows the kind contract and drops the old findingRef alias', data.withheldKinds.every(kind => ['finding', 'statement'].includes(kind)) &&
      data.withheldKinds.includes('statement') &&
      data.withheldEntryKeys.every(keys => !keys.includes('findingRef')));
    check('withheld fixtures are scoped to the synthetic incomplete snapshot', data.withheldScoped &&
      data.withheldRunId && data.withheldRefs.every(Boolean));
    check('every delivery carries everAhead', data.deliveries.length >= 4 &&
      data.deliveries.every(delivery => typeof delivery.everAhead === 'boolean'));
    check('alignment covers every requirement item exactly once', data.alignmentCount === data.requirementItemCount &&
      new Set(data.alignmentIds).size === data.alignmentCount);
    check('implemented and partial alignment entries carry code refs', data.alignmentStatuses.every((status, index) =>
      !(['implemented', 'partial'].includes(status)) || data.alignmentRefs[index] > 0));
    check('extras and feature relations are present', data.extraCount > 0 && data.featureCheck === true);
    check('legacy gaps and turn data are gone', data.hasGaps === false && data.hasTurnData === false);
    check('old name-switch requirement removed', !data.requirements.some(text =>
      text.includes('对比开关') || text.includes('代码评审') || text.includes('交付评审') || text.includes('变更洞察')));
    check('fixed name in sidebar', (await state()).sidebarEntry === '变更评审');
    check('fixed name in document title', (await state()).title === '变更评审 · DSH Desktop 演示');
    check('no entry-name switcher', await page.locator('select[aria-label="入口名称"]').count() === 0);
    check('no old product name in visible text', !(await page.locator('body').innerText()).includes('代码评审'));

    const privateConfig = rt.privateDenylist;
    if (!privateConfig.enabled) {
      logLine('[skip] private denylist scan: EVIDENTLOOP_PRIVATE_DENYLIST not set');
    } else {
      const repoRoot = path.resolve(rt.root, '..');
      const hits = [...rt.helpers.privateAssetScan([rt.root, path.join(repoRoot, 'skills')], privateConfig).hits];
      const snapshotRaw = fs.readFileSync(path.join(rt.root, 'data', 'snapshot.js'), 'utf8');
      const snapshotValue = JSON.parse(snapshotRaw.match(/window\.CR_PROTOTYPE_DATA = ([\s\S]*);\s*$/)[1]);
      for (const hit of rt.helpers.privateValueOffenders(snapshotValue, privateConfig)) hits.push({ file: 'data/snapshot.js (decoded)', rule: hit.rule });
      await open({ scenario: 'reviewed' });
      const exportProbe = await page.evaluate(() => {
        const context = CRPrototype.app.exportContext();
        return { markdown: CRPrototype.exports.buildMarkdown(context), html: CRPrototype.exports.buildHtml(context).html };
      });
      const probeKind = process.env.VERIFY_PRIVATE_PROBE || '';
      const probeValue = process.env.VERIFY_PRIVATE_PROBE_VALUE || '';
      let markdown = exportProbe.markdown;
      let html = exportProbe.html;
      if (probeKind === 'export' && probeValue) { markdown += '\n' + probeValue + '\n'; html = html.replace('</body>', '<!--' + probeValue + '--></body>'); }
      for (const rule of rt.helpers.privateTextOffenders(markdown, privateConfig)) hits.push({ file: 'export markdown', rule });
      for (const rule of rt.helpers.privateTextOffenders(html, privateConfig)) hits.push({ file: 'export html', rule });
      for (const hit of rt.helpers.privateValueOffenders(rt.parseEmbeddedData(html), privateConfig)) hits.push({ file: 'export html (decoded)', rule: hit.rule });
      if (hits.length) console.error('Private denylist hits:', JSON.stringify(hits.slice(0, 20)));
      check('private denylist scan finds no matches in sources, decoded data and exports', hits.length === 0);
    }
    rt.coreData = data;
    return data;
  },
};
