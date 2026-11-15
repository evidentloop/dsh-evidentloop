/** Missing findings is the real core running/failed shape; no model calls. */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { installed } from '../scripts/toolchain.mjs';

const out = path.resolve(process.argv[2]); fs.mkdirSync(out);
const child = spawn(process.execPath, [...process.execArgv, 'plugin/tests/browser-server.mjs', out + '/fixture'], { stdio: ['ignore', 'pipe', 'pipe'] });
let ready = '', browser, page; const results = [], errors = [];
child.stdout.on('data', b => ready += b); child.stderr.on('data', b => fs.appendFileSync(out + '/fixture.log', b));
try {
  const deadline = Date.now() + 30000;
  while (!ready.includes('"url"')) { if (Date.now() > deadline || child.exitCode !== null) throw Error('Fixture unavailable'); await new Promise(r => setTimeout(r, 40)); }
  const server = JSON.parse(ready.trim().split('\n').find(s => s.includes('"url"')));
  browser = await installed('playwright').require('playwright').chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
  page = await browser.newPage(); page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(server.url); await page.waitForFunction(() => window.__READY__ && window.__UI__?.runtime.state.data);
  const record = await page.evaluate(async () => {
    const r = __UI__.runtime, d = r.state.data.deliveries[0];
    return r.api('record?' + new URLSearchParams({ workspaceId: r.state.workspaceId, deliveryId: d.deliveryId }));
  });
  const rt = installed('react'), entry = `import React from 'react';import {renderToString} from 'react-dom/server';import {Review} from '${path.resolve('plugin/client/review.tsx')}';export const render=record=>renderToString(React.createElement(Review,{runtime:{},state:{record,view:'overview',data:{modelTestGate:{approved:false},settings:{exportEmbedDiff:false}}},openSettings(){}}));`;
  await installed('esbuild').require('esbuild').build({ stdin: { contents: entry, resolveDir: process.cwd(), loader: 'jsx' }, bundle: true, platform: 'node', format: 'cjs', alias: { react: rt.root, 'react-dom': path.dirname(rt.require.resolve('react-dom/package.json')) }, outfile: out + '/ssr.cjs', logLevel: 'silent' });
  const { render } = await import(out + '/ssr.cjs');
  for (const status of ['running', 'queued', 'failed', 'cancelled']) {
    const value = structuredClone(record); value.run = { runId: 'missing-findings', status, complete: false, coverage: { reviewed: [], skipped: [], failed: [], withheld: [] }, model: { adapter: 'dsh' } }; value.statusText = status;
    assert.equal(Object.hasOwn(value.run, 'findings'), false);
    assert.match(render(value), /el-review/); results.push({ name: 'Node render ' + status + ' without findings', passed: true });
    await page.evaluate(value => { const r = __UI__.runtime; window.__runningRecord = value; if (!window.__originalApi) { window.__originalApi = r.api.bind(r); r.api = (route, body) => route.startsWith('record?') ? Promise.resolve(structuredClone(__runningRecord)) : __originalApi(route, body); } }, value);
    for (const mount of ['mount', 'remount']) {
      await page.evaluate(() => __UI__.runtime.update({ page: 'list', record: null })); await page.waitForSelector('.el-title-link');
      await page.locator('.el-title-link').first().click(); await page.waitForSelector('.el-review', { timeout: 3000 });
      assert.equal(await page.locator('.el-review-toolbar button').filter({ hasText: '取消审查' }).count(), ['running', 'queued'].includes(status) ? 1 : 0);
      assert.equal(await page.locator('.el-tree-file').count(), record.snapshot.files.length);
      results.push({ name: 'Browser ' + mount + ' ' + status + ' without findings', passed: true });
    }
  }
  assert.deepEqual(errors, []);
} catch (error) { results.push({ name: 'running record regression', passed: false, error: error.stack }); process.exitCode = 1; }
finally {
  if (browser) await browser.close(); child.kill('SIGTERM');
  await new Promise(resolve => { if (child.exitCode !== null || child.signalCode !== null) resolve(); else { child.once('exit', resolve); setTimeout(resolve, 3000); } });
  const resources = { browserClosed: !browser?.isConnected(), fixtureStopped: child.exitCode !== null || child.signalCode !== null, realModelCalls: 0 };
  if (!resources.browserClosed || !resources.fixtureStopped || errors.length) process.exitCode = 1;
  const summary = { results, checks: results.length, errors, resources, exitCode: process.exitCode || 0 };
  fs.writeFileSync(out + '/summary.json', JSON.stringify(summary, null, 2)); console.log(JSON.stringify(summary));
}
