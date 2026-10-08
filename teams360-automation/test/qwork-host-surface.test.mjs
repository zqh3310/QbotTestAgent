import assert from 'node:assert/strict';
import test from 'node:test';
import { chromium } from 'playwright';
import { availableTestBrowser } from '../../scripts/prepare-test-browser.mjs';
import { ensureQworkHostSurface, inspectionIsReady } from '../lib/qwork-host-surface.mjs';
import { captureClientScreenshot, dispatchTrustedVisibleSelectorClick } from '../lib/qwork-app-sanity.mjs';

test('cached zero-size QWork WebView is blocked until a real host sidebar click restores visibility', async () => {
  const browser = await chromium.launch(availableTestBrowser());
  try {
    const page = await browser.newPage();
    await page.setContent(`<button class="sidenav-item">QWork</button>
      <webview src="file:///Users/qa/.deepbank/ui/0.1.11/index.html" style="display:none;width:900px;height:600px"></webview>
      <script>window.clicks=0;document.querySelector('button').onclick=()=>{
        window.clicks++;document.querySelector('webview').style.display='block';};</script>`);
    const host = { url: () => 'http://localhost:33013/#/main/chat', evaluate: (fn) => page.evaluate(fn),
      bringToFront: () => page.bringToFront(), locator: (selector) => page.locator(selector) };
    const hidden = await ensureQworkHostSurface([host]);
    assert.equal(hidden.status, 'blocked');
    assert.equal(hidden.before.qwork_webview_count, 1);
    assert.equal(hidden.before.visible_qwork_webview_count, 0);
    assert.equal(await page.evaluate('window.clicks'), 0);
    const restored = await ensureQworkHostSurface([host], { openQwork: true });
    assert.equal(restored.status, 'ready');
    assert.equal(restored.entry_receipt.real_sidebar_click, true);
    assert.equal(await page.evaluate('window.clicks'), 1);
    await ensureQworkHostSurface([host], { openQwork: true });
    assert.equal(await page.evaluate('window.clicks'), 1, 'already-visible workbench must not be clicked again');
    await page.evaluate(() => Object.defineProperty(document, 'visibilityState', { get: () => 'hidden' }));
    let inputs = 0;
    const client = { evaluate: (fn) => page.evaluate(fn), send: async () => { inputs++; } };
    await assert.rejects(captureClientScreenshot(client, '/unused.png'), /document is hidden/);
    await assert.rejects(dispatchTrustedVisibleSelectorClick(client, 'button', 'hidden action'), /visible/);
    assert.equal(inputs, 0, 'hidden surfaces must not receive input or attempt a timed-out screenshot');
  } finally { await browser.close(); }
});

test('doctor cannot declare ready from cached target discovery without visible host and screenshot', () => {
  const valid = { qbot_target: { surface: 'teams360-qwork-qbot' },
    host_precondition: { status: 'ready' }, screenshots: { qbot_target: '/captured.png' } };
  assert.equal(inspectionIsReady(valid), true);
  assert.equal(inspectionIsReady({ ...valid, screenshots: {} }), false);
  assert.equal(inspectionIsReady({ ...valid, host_precondition: { status: 'blocked' } }), false);
  assert.equal(inspectionIsReady({ ...valid, qbot_target: null }), false);
});
