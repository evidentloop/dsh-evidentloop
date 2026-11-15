/** Toolbar parity uses the unchanged prototype as reference; no real models. */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { installed } from '../scripts/toolchain.mjs';

const out = path.resolve(process.argv[2]), before = process.argv.includes('--before'); fs.mkdirSync(out);
if (before && (!process.env.EVIDENTLOOP_BASELINE_STYLES || !process.env.EVIDENTLOOP_BASELINE_CLIENT)) throw Error('--before requires EVIDENTLOOP_BASELINE_STYLES and EVIDENTLOOP_BASELINE_CLIENT');
const child = spawn(process.execPath, [...process.execArgv, 'plugin/tests/browser-server.mjs', out + '/fixture'], { stdio: ['ignore', 'pipe', 'pipe'] });
let ready = '', browser, page; const results = [], measurements = [], errors = [];
child.stdout.on('data', chunk => ready += chunk); child.stderr.on('data', chunk => fs.appendFileSync(out + '/fixture.log', chunk));
const check = (name, actual, expected) => { try { assert.deepEqual(actual, expected); results.push({ name, passed: true }); } catch { results.push({ name, passed: false, actual, expected }); } };
const sample = (page, prototype) => page.evaluate(prototype => {
  const root = document.querySelector(prototype ? '.focus-review' : '.el-plugin');
  const resolve = (property, token) => { const probe = document.createElement('i'); probe.style[property] = 'var(' + token + ')'; root.append(probe); const value = getComputedStyle(probe)[property]; probe.remove(); return value; };
  const style = element => { const s = getComputedStyle(element); return Object.fromEntries(['color', 'backgroundColor', 'fontSize', 'fontWeight', 'lineHeight', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft', 'borderRadius'].map(k => [k, s[k]])); };
  const group = root.querySelector(prototype ? '.file-filter-group' : '.el-file-filter'), options = {};
  for (const input of group.querySelectorAll('input')) { const label = input.closest('label'), mode = input.value; options[mode] = { checked: input.checked, label: style(label.querySelector(prototype ? '.file-filter-label' : '.el-file-filter-label') || label.querySelector('span')), count: style(label.querySelector(prototype ? '.file-filter-count' : 'b')), text: label.querySelector(prototype ? '.file-filter-count' : 'b').textContent }; }
  const tabs = root.querySelector(prototype ? '.view-switch' : '.el-view-switch'), active = tabs.querySelector('[aria-selected=true]'), rect = element => { const r = element.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height, right: r.right }; }, toolbar = root.querySelector(prototype ? '.wb-toolbar' : '.el-review-toolbar');
  return { options, active: style(active), activeText: active.textContent, switch: style(tabs), tokens: { error: resolve('color', '--el-state-error'), errorTint: resolve('backgroundColor', '--el-state-error-tint'), hover: resolve('backgroundColor', '--el-hover'), label2: resolve('color', '--el-label-2'), bg2: resolve('backgroundColor', '--el-bg-l2'), brand: resolve('color', '--el-brand-link') }, layout: { viewport: innerWidth, toolbar: rect(toolbar), tabs: rect(tabs), filters: rect(group), rootOverflow: document.documentElement.scrollWidth > innerWidth } };
}, prototype);
const validate = (name, data) => {
  if (data.options.risk) {
    for (const property of ['color', 'backgroundColor']) check(name + ' risk count ' + property, data.options.risk.count[property], property === 'color' ? data.tokens.error : data.tokens.errorTint);
    check(name + ' risk label stays red', data.options.risk.label.color, data.tokens.error);
  }
  check(name + ' all count gray pill', [data.options.all.count.backgroundColor, data.options.all.count.color], [data.tokens.hover, data.tokens.label2]);
  for (const [mode, value] of Object.entries(data.options)) {
    check(name + ' ' + mode + ' label typography', [value.label.fontSize, value.label.fontWeight], ['13px', '500']);
    check(name + ' ' + mode + ' count typography/pill', [value.count.fontSize, value.count.lineHeight, value.count.paddingTop, value.count.paddingRight, value.count.paddingBottom, value.count.paddingLeft, value.count.borderRadius], ['12px', '20px', '0px', '6px', '0px', '6px', '999px']);
  }
  check(name + ' switch hover background', data.switch.backgroundColor, data.tokens.hover);
  check(name + ' active bg2 brand 600', [data.active.backgroundColor, data.active.color, data.active.fontWeight], [data.tokens.bg2, data.tokens.brand, '600']);
  check(name + ' toolbar contained', data.layout.toolbar.x >= 0 && data.layout.toolbar.right <= data.layout.viewport + 1 && !data.layout.rootOverflow, true);
  if (data.activeText === '文件对比') check(name + ' controls do not overlap', data.layout.tabs.y + data.layout.tabs.height <= data.layout.filters.y || data.layout.filters.y + data.layout.filters.height <= data.layout.tabs.y || data.layout.tabs.right <= data.layout.filters.x || data.layout.filters.right <= data.layout.tabs.x, true);
};
try {
  const deadline = Date.now() + 30000; while (!ready.includes('"url"')) { if (Date.now() > deadline || child.exitCode !== null) throw Error('Fixture unavailable'); await new Promise(r => setTimeout(r, 40)); }
  const server = JSON.parse(ready.trim().split('\n').find(s => s.includes('"url"')));
  browser = await installed('playwright').require('playwright').chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
  page = await browser.newPage(); const reference = await browser.newPage();
  for (const p of [page, reference]) { p.on('pageerror', e => errors.push(e.message)); p.on('console', m => { if (m.type() === 'error') errors.push(m.text()); }); }
  if (before) { await page.route('**/style.css', route => route.fulfill({ contentType: 'text/css', body: fs.readFileSync(process.env.EVIDENTLOOP_BASELINE_STYLES, 'utf8') })); await page.route('**/fixture-client.js', route => route.fulfill({ contentType: 'application/javascript', body: fs.readFileSync(process.env.EVIDENTLOOP_BASELINE_CLIENT, 'utf8') })); }
  await page.goto(server.url); await page.waitForFunction(() => window.__READY__); await page.locator('.el-title-link').click(); await page.waitForFunction(() => __UI__.runtime.state.page === 'review' && __UI__.runtime.state.record);
  await page.evaluate(() => { window.__toolbarOriginal = structuredClone(__UI__.runtime.state.record); window.__toolbarClicks = []; document.addEventListener('click', event => __toolbarClicks.push({ tag: event.target.tagName, text: event.target.textContent.slice(0, 40), class: String(event.target.className) }), true); __UI__.runtime.update({ view: 'diff' }); }); await page.waitForSelector('.el-file-heading');
  for (const width of before ? [1024] : [1024, 1440, 2000]) for (const theme of before ? ['light'] : ['light', 'dark']) {
    await page.setViewportSize({ width, height: 900 }); await reference.setViewportSize({ width, height: 900 });
    await page.evaluate(theme => document.body.toggleAttribute('data-ds-dark-theme', theme === 'dark'), theme);
    for (const zero of before ? [false] : [false, true]) {
      await page.evaluate(zero => { const r = structuredClone(__toolbarOriginal); if (zero) r.marks = r.run.findings.map(f => ({ findingId: f.findingId, suppressed: true })); __UI__.runtime.update({ page: 'review', record: r, view: 'diff' }); }, zero);
      const prefix = width + '-' + theme + '-' + (zero ? 'zero' : 'risk');
      for (const mode of zero ? ['all'] : ['all', 'risk']) { await page.locator('.el-file-filter label').filter({ has: page.locator('input[value="' + mode + '"]') }).click(); const data = await sample(page, false); validate('plugin ' + prefix + ' ' + mode, data); if (zero) check('plugin ' + prefix + ' hides empty risk filter', data.options.risk === undefined, true); measurements.push({ product: 'plugin', prefix, mode, data }); }
      await page.locator('.el-file-filter label').filter({ has: page.locator('input[value=all]') }).click(); await page.mouse.move(0, 0);
      await page.locator('.el-review-toolbar').screenshot({ path: out + '/plugin-' + prefix + '-toolbar.png' });
      if (!before) {
        const url = pathToFileURL(path.resolve('prototype/index.html')); url.search = new URLSearchParams({ scenario: zero ? 'zero' : 'reviewed', main: 'diff', theme, style: 'single', sidebar: '0', console: '0' });
        await reference.goto(url.href); await reference.waitForFunction(() => window.CRPrototype?.app && document.documentElement.dataset.ready === 'true');
        if (zero) { await reference.evaluate(() => { CRPrototype.app.fileFilterMode = 'risk'; }); await reference.waitForSelector('input[name=file-filter][value=risk]'); }
        const data = await sample(reference, true); validate('prototype ' + prefix, data); measurements.push({ product: 'prototype', prefix, data });
        await reference.locator('.wb-toolbar').screenshot({ path: out + '/prototype-' + prefix + '-toolbar.png' });
      }
    }
    if (!before) {
      for (const [p, prototype] of [[page, false], [reference, true]]) { await p.getByRole('tab', { name: '变更说明', exact: true }).click(); const data = await sample(p, prototype); check((prototype ? 'prototype' : 'plugin') + ' overview active ' + width + theme, [data.active.backgroundColor, data.active.color, data.active.fontWeight], [data.tokens.bg2, data.tokens.brand, '600']); await p.locator(prototype ? '.wb-toolbar' : '.el-review-toolbar').screenshot({ path: out + '/' + (prototype ? 'prototype' : 'plugin') + '-' + width + '-' + theme + '-overview-toolbar.png' }); }
    }
  }
  if (!before) {
    await page.evaluate(() => { const record = structuredClone(__toolbarOriginal); record.comparison = { added: ['src/other.js'], changed: [] }; __UI__.runtime.update({ record, view: 'diff' }); });
    await page.locator('.el-file-filter label').filter({ has: page.locator('input[value=changed]') }).click(); const data = await sample(page, false); validate('plugin changed scope', data); check('changed filter selects only the changed file', await page.locator('.el-tree-file').count(), 1);
    await page.locator('label[data-filter-mode=risk]').hover(); const hover = await sample(page, false); check('risk hover keeps red label/count pill', [hover.options.risk.label.color, hover.options.risk.count.backgroundColor], [hover.tokens.error, hover.tokens.errorTint]);
  }
} catch (error) { if (page) { fs.writeFileSync(out + '/failure-state.json', JSON.stringify(await page.evaluate(() => ({page:__UI__.runtime.state.page,clicks:window.__toolbarClicks,record:!!__UI__.runtime.state.record})).catch(() => ({})), null, 2)); fs.writeFileSync(out + '/failure.txt', await page.locator('body').innerText().catch(() => '')); fs.writeFileSync(out + '/failure.html', await page.content().catch(() => '')); } results.push({ name: 'toolbar harness', passed: false, error: error.stack }); }
finally {
  if (browser) await browser.close(); child.kill('SIGTERM'); await new Promise(resolve => { if (child.exitCode !== null || child.signalCode !== null) resolve(); else { child.once('exit', resolve); setTimeout(resolve, 3000); } });
  const resources = { browserClosed: !browser?.isConnected(), fixtureStopped: child.exitCode !== null || child.signalCode !== null, fixturePid: child.pid, userPagesTouched: false };
  const failures = results.filter(r => !r.passed), summary = { checks: results.length, passed: results.length - failures.length, failures, runtimeErrors: errors, resources, realModelCalls: 0, synthetic: true, prototypeUnmodified: true, exitCode: failures.length || errors.length || !resources.fixtureStopped || !resources.browserClosed ? 1 : 0 };
  fs.writeFileSync(out + '/measurements.json', JSON.stringify(measurements, null, 2)); fs.writeFileSync(out + '/summary.json', JSON.stringify(summary, null, 2)); console.log(JSON.stringify(summary)); process.exitCode = summary.exitCode;
}
