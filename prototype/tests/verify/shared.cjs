/* Shared per-context runtime for verify modules. */
'use strict';
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

async function createRuntime({ browser, output, id, live, data, collectors, logLine, parseEmbeddedData, root }) {
  const runtime = { id, output, live: Boolean(live), data, events: [], screenshots: [], executedScenarios: new Set(), currentStep: 'startup' };
  runtime.context = await browser.newContext({ viewport: { width: 1176, height: 834 }, deviceScaleFactor: 2 });
  await runtime.context.grantPermissions(['clipboard-read', 'clipboard-write']);
  const page = await runtime.context.newPage();
  page.on('pageerror', error => collectors.errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') collectors.errors.push(message.text()); });
  page.on('request', request => collectors.requests.add(request.url()));
  page.on('requestfailed', request => collectors.failedRequests.push(request.url()));
  page.on('websocket', socket => collectors.sockets.push(socket.url()));
  page.setDefaultTimeout(12000);
  page.setDefaultNavigationTimeout(15000);
  const url = pathToFileURL(path.resolve(root, 'index.html')).href;
  const SCREENSHOTS = runtime.screenshots;
  const executedScenarios = runtime.executedScenarios;
  runtime.page = page;
  runtime.url = url;
  const check = (name, value) => {
    if (!value) {
      const error = new assert.AssertionError({ message: name, actual: value, expected: true, operator: '==' });
      error.checkName = name;
      error.step = runtime.currentStep;
      error.workerId = id;
      throw error;
    }
    if (runtime.live) {
      collectors.results.push(name);
      logLine(`ok ${collectors.results.length} - ${name}`);
    } else {
      runtime.events.push({ type: 'check', name });
    }
  };
  runtime.check = check;
  runtime.markStep = name => {
    runtime.currentStep = name;
    if (runtime.live) { logLine(`[step] ${name}`); runtime.onStep?.(name); }
    else runtime.events.push({ type: 'step', name });
  };
  const markStep = runtime.markStep;
  runtime.parseEmbeddedData = parseEmbeddedData;

    const brandButtons = () => page.evaluate(() => {
      const parse = value => {
        const match = String(value).match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
        return match ? [+match[1], +match[2], +match[3], match[4] === undefined ? 1 : +match[4]] : null;
      };
      const isBrand = color => color && color[3] > 0.5 &&
        ((color[0] === 65 && color[1] === 118 && color[2] === 230) ||
         (color[0] === 122 && color[1] === 170 && color[2] === 255));
      return [...document.querySelectorAll('button,[role="button"]')]
        .filter(element => element.getClientRects().length && isBrand(parse(getComputedStyle(element).backgroundColor)))
        .map(element => ({ className: String(element.className), text: element.innerText.trim().slice(0, 24) }));
    });
    const blueUiColors = () => page.evaluate(() => {
      const parse = value => {
        const match = String(value).match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
        return match ? [+match[1], +match[2], +match[3], match[4] === undefined ? 1 : +match[4]] : null;
      };
      const isBlue = color => color && color[3] > 0.3 && color[2] - Math.max(color[0], color[1]) > 30 && color[1] >= color[0];
      return [...document.querySelectorAll('.delivery-status,.dsh-delivery-status,.run-state__label,.panel-status b,.overview-delta-badge,.req-status')]
        .filter(element => !element.closest('.d2h-wrapper,pre,code,.focus-tree-kind-icon'))
        .filter(element => {
          const style = getComputedStyle(element);
          return ['backgroundColor', 'color', 'borderTopColor', 'borderLeftColor'].some(property => isBlue(parse(style[property])));
        })
        .map(element => ({ className: String(element.className), text: element.innerText.trim().slice(0, 24) }));
    });
    const contrastSamples = () => page.evaluate(() => {      const parse = value => {
        const match = String(value).match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
        return match ? [+match[1], +match[2], +match[3], match[4] === undefined ? 1 : +match[4]] : null;
      };
      const luminance = color => {
        const values = color.slice(0, 3).map(value => {
          const channel = value / 255;
          return channel <= 0.03928 ? channel / 12.92 : Math.pow((channel + 0.055) / 1.055, 2.4);
        });
        return 0.2126 * values[0] + 0.7152 * values[1] + 0.0722 * values[2];
      };
      const ratio = (foreground, background) => {
        const a = luminance(foreground), b = luminance(background);
        return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
      };
      const background = element => {
        let node = element;
        while (node) {
          const color = parse(getComputedStyle(node).backgroundColor);
          if (color && color[3] > 0.5) return color;
          node = node.parentElement;
        }
        return [22, 23, 26, 1];
      };
      const sample = selector => {
        const element = document.querySelector(selector);
        if (!element) return null;
        const foreground = parse(getComputedStyle(element).color);
        const bg = background(element);
        return foreground ? { ratio: ratio(foreground, bg), color: getComputedStyle(element).color, background: `rgb(${bg.slice(0, 3).join(', ')})` } : null;
      };
      return {
        diff: sample('.d2h-code-line-ctn'),
        card: sample('.gpt-risk-marker__content p'),
        evidence: sample('.evidence-box pre'),
        inline: sample('.gpt-risk-marker__content code'),
        darkClass: Boolean(document.querySelector('.d2h-dark-color-scheme')),
        darkTheme: document.getElementById('hljs-dark')?.media,
        lightTheme: document.getElementById('hljs-light')?.media,
      };
    });
    const assertReadable = (name, samples) => {
      for (const key of ['diff', 'card', 'evidence', 'inline']) {
        if (samples[key]) check(`${name}: ${key} contrast >= 4.5`, samples[key].ratio >= 4.5);
      }
    };
    const auditIconButtons = async (scope, rootSelector = 'body') => {
      const buttons = await page.evaluate(rootSelector => {
        const root = document.querySelector(rootSelector) || document.body;
        return [...root.querySelectorAll('button')]
          .filter(button => button.getClientRects().length && !button.innerText.trim() && button.querySelector('svg') && !button.classList.contains('annotation-add-btn'))
          .map((button, index) => {
            button.setAttribute('data-audit-icon', String(index));
            return { index, label: button.getAttribute('aria-label') || '', disabled: button.disabled || button.getAttribute('aria-disabled') === 'true' };
          });
      }, rootSelector);
      const failures = [];
      for (const button of buttons) {
        if (!button.label) { failures.push(`#${button.index} has no aria-label`); continue; }
        const locator = page.locator(`[data-audit-icon="${button.index}"]`);
        await page.mouse.move(0, 0);
        await page.waitForTimeout(60);
        await locator.hover();
        await page.waitForTimeout(380);
        const tip = await page.evaluate(() => document.querySelector('[role="tooltip"]')?.innerText.trim() || '');
        if (tip.replace(/\s+/g, ' ') !== button.label.replace(/\s+/g, ' ')) {
          failures.push(`#${button.index} "${button.label}" -> "${tip}"`);
        }
      }
      await page.mouse.move(0, 0);
      check('every visible icon-only button in ' + scope + ' has a matching tooltip' +
        (failures.length ? ' [' + failures.join('; ') + ']' : ''), buttons.length > 0 && failures.length === 0);
      return { count: buttons.length, failures };
    };
    const shot = async name => {
      const file = path.join(output, name + '.png');
      await page.evaluate(() => { CRPrototype.hideTip?.(); if (CRPrototype.ui) CRPrototype.ui.message = ''; });
      await page.screenshot({ path: file });
      SCREENSHOTS.push(name);
      return file;
    };
    const open = async (params = {}) => {
      executedScenarios.add(params.scenario || 'list');
      const query = new URLSearchParams({ style: 'single', sidebar: '1', console: '0', ...params });
      await page.goto(url + '?' + query.toString());
      await page.waitForFunction(
        () => window.CRPrototype?.app && document.documentElement.dataset.ready === 'true',
        null, { timeout: 10000 },
      );
      await page.waitForTimeout(220);
    };
    const state = () => page.evaluate(() => {
      const app = window.CRPrototype.app;
      const labelOf = element => element?.innerText.trim() || '';
      return {
        scenario: app.scenario,
        view: app.view,
        mainView: app.mainView,
        runStatus: app.run?.status ?? null,
        runScope: app.run?.scope ?? null,
        panelMode: app.panelMode || null,
        autoMode: app.autoMode,
        readonly: app.readonly,
        history: app.history,
        preflight: app.preflight?.code ?? null,
        counts: { ...app.riskAdjustedCount },
        filterModes: [...app.filterModes],
        fileFilterMode: app.fileFilterMode,
        filterPairs: [...document.querySelectorAll('input[name="file-filter"]')].map(input => ({
          mode: input.value,
          count: Number(input.closest('label').querySelector('.file-filter-count')?.innerText.trim() || 0),
        })),
        pending: app.pendingCount,
        active: app.activeFindingCount,
        suppressed: app.suppressedCount,
        withheld: app.coverage?.withheld?.length ?? 0,
        failed: app.coverage?.failed?.length ?? 0,
        reviewComplete: app.reviewCompleteNow,
        requirements: app.snapshot?.requirements?.length ?? 0,
        snapshotFiles: app.snapshot?.files?.length ?? 0,
        selected: app.selectedFileItem?.path || '',
        selectedCarried: app.selectedFileItem?.carriedFrom || '',
        selectedIssues: app.selectedIssues?.length ?? 0,
        semanticItems: app.selectedFileItem?.semanticItems?.length ?? 0,
        delivieries: app.deliveries?.length ?? 0,
        listExpandedId: app.listExpandedId || '',
        currentDeliveryId: app.currentDeliveryId || '',
        deliveryTitle: app.currentDelivery?.title || '',
        reviewOrigin: app.reviewOrigin || '',
        displayed: app.displayedFileList?.length ?? 0,
        historyBanner: labelOf(document.querySelector('.wb-history-banner')),
        sidebarEntry: labelOf(document.querySelector('.dsh-nav-item--plugin')),
        title: document.title,
        h1: labelOf(document.querySelector('.wb-title-line h1')),
        runState: labelOf(document.querySelector('.run-state')),
        runStateInToolbar: Boolean(document.querySelector('.run-state')?.closest('.review-button-container')),
        titleText: labelOf(document.querySelector('.wb-title-wrap')),
        deliveryText: labelOf(document.querySelector('.dsh-delivery-card')),
        panelCount: document.querySelectorAll('.review-panel').length,
        overviewCount: document.querySelectorAll('.overview-main').length,
        overviewSections: [...document.querySelectorAll('.overview-section')].map(section => section.id),
      };
    });
    const filterByMode = async mode => {
      await page.locator('label.n-radio-button', {
        has: page.locator(`input[name="file-filter"][value="${mode}"]`),
      }).click();
      await page.waitForTimeout(120);
    };
    const ensureOverview = async () => {
      if ((await state()).mainView !== 'overview') {
        await page.getByRole('tab', { name: '变更说明' }).click();
        await page.waitForTimeout(150);
      }
    };
    const currentData = () => page.evaluate(() => {
      const data = window.CR_PROTOTYPE_DATA;
      const reviewable = data.snapshot.files.filter(file =>
        file.kind === 'text' && Boolean(file.diff) && file.change !== 'mode-changed');
      return {
        files: data.snapshot.files.length,
        reviewable: reviewable.length,
        requirements: data.snapshot.requirements.map(source => source.text),
        requirementItemCount: data.snapshot.requirements.reduce((sum, source) => sum + source.items.length, 0),
        withheld: data.withheldFindings.filter(entry => entry.snapshotId === 'snap-demo-withheld').length,
        withheldCodes: data.withheldFindings.map(entry => entry.code),
        withheldKinds: data.withheldFindings.map(entry => entry.kind),
        withheldEntryKeys: data.withheldFindings.map(entry => Object.keys(entry)),
        withheldScoped: data.withheldFindings.every(entry =>
          [data.snapshot.snapshotId, 'snap-demo-withheld'].includes(entry.snapshotId) && typeof entry.runId === 'string'),
        withheldRunId: (data.withheldFindings.find(entry => entry.snapshotId === 'snap-demo-withheld') || {}).runId || '',
        withheldRefs: data.withheldFindings.filter(entry => entry.snapshotId === 'snap-demo-withheld').map(entry => entry.findingId),
        findings: data.findings.length,
        findingCategories: data.findings.map(finding => finding.category),
        findingSeverities: data.findings.map(finding => finding.severity),
        findingAnchors: data.findings.map(finding => finding.anchor),
        ruleSourceIds: data.findings.map(finding => finding.ruleSource?.id),
        ruleSources: (data.meta.ruleSources || []).map(rule => rule.id),
        vendor: data.snapshot.files
          .filter(file => file.path.startsWith('prototype/vendor/'))
          .map(file => ({ kind: file.kind, hasDiff: Boolean(file.diff), hasHash: Boolean(file.headSha256) })),
        bases: [...new Set([
          data.understanding.overview.basis,
          ...(data.understanding.files || []).map(file => file.basis),
          ...(data.understanding.impacts || []).map(impact => impact.basis),
          ...(data.understanding.extras || []).map(extra => extra.basis),
        ])],
        semantics: data.understanding.files.map(file => ({ path: file.path, status: file.semantic.status,
          items: (file.semantic.items || []).length,
          refs: (file.semantic.items || []).reduce((sum, item) => sum + (item.refs || []).length, 0),
          hasKeySymbols: Object.prototype.hasOwnProperty.call(file, 'keySymbols') })),
        deliveries: (data.deliveries || []).map(delivery => ({ id: delivery.deliveryId, title: delivery.title,
          projectKey: delivery.projectKey,
          externalRef: delivery.externalRef, branch: delivery.branch, closedAt: Boolean(delivery.closedAt),
          snapshots: delivery.snapshots?.length || 0, status: delivery.latest?.status,
          validFindingCount: delivery.latest?.validFindingCount, highestSeverity: delivery.latest?.highestSeverity,
          purpose: delivery.purpose, synthetic: Boolean(delivery.synthetic), everAhead: delivery.everAhead,
          pendingCount: delivery.latest?.pendingCount, failedCount: delivery.latest?.failedCount,
          withheldCount: delivery.latest?.withheldCount, runStatus: delivery.latest?.runStatus,
          snapshotStatus: delivery.latest?.snapshotStatus })),
        projectKey: data.project?.projectKey || '',
        currentWorkspaceId: data.currentWorkspaceId || '',
        workspaces: (data.workspaces || []).map(workspace => ({ id: workspace.workspaceId, name: workspace.name,
          repoKey: workspace.repoKey, repoName: workspace.repoName })),
        sessions: data.sessions || [],
        deliverySnapshotIds: data.deliveries?.length ? data.snapshot.deliveryId === data.deliveries[0].deliveryId : false,
        highlights: (data.understanding.overview.highlights || []).map(highlight => highlight.refs.length),
        impactKinds: (data.understanding.impacts || []).map(impact => impact.kind),
        impactBases: (data.understanding.impacts || []).map(impact => impact.basis),
        extraBases: (data.understanding.extras || []).map(extra => extra.basis),
        extraTexts: (data.understanding.extras || []).map(extra => extra.text),
        impactRefs: (data.understanding.impacts || []).map(impact => impact.refs.length),
        featureRefs: data.understanding.features.map(feature => feature.refs.length),
        featureApproaches: data.understanding.features.map(feature => Boolean(feature.approach)),
        featureCheck: (() => {
          const byPath = new Map(data.understanding.files.map(file => [file.path, new Set(file.featureIds || [])]));
          return data.understanding.features.every(feature =>
            feature.featureId && feature.files.every(path => byPath.get(path)?.has(feature.featureId))) &&
            data.understanding.files.every(file =>
              (file.featureIds || []).every(id => data.understanding.features.some(feature => feature.featureId === id)));
        })(),
        alignmentCount: (data.understanding.alignment || []).length,
        alignmentIds: (data.understanding.alignment || []).map(item => item.requirementItemId),
        alignmentStatuses: (data.understanding.alignment || []).map(item => item.status),
        alignmentRefs: (data.understanding.alignment || []).map(item => item.codeRefs.length),
        extraCount: (data.understanding.extras || []).length,
        hasGaps: Object.prototype.hasOwnProperty.call(data.understanding, 'gaps'),
        hasTurnData: Object.prototype.hasOwnProperty.call(data.snapshot, 'agentTurnPaths'),
      };
    });

  runtime.open = open;
  runtime.state = state;
  runtime.shot = shot;
  runtime.ensureOverview = ensureOverview;
  runtime.filterByMode = filterByMode;
  runtime.currentData = currentData;
  runtime.brandButtons = brandButtons;
  runtime.blueUiColors = blueUiColors;
  runtime.contrastSamples = contrastSamples;
  runtime.assertReadable = assertReadable;
  runtime.auditIconButtons = auditIconButtons;
  return runtime;
}

module.exports = { createRuntime };
