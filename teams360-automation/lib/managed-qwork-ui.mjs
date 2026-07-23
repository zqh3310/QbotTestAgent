import { chromium } from 'playwright';
import { normalizeCdpUrl, validatePinnedQworkUiUrl } from './config.mjs';

const QWORK_TARGET_PATTERN = /\/\.deepbank(?:-(?:dev|local|uat))?\/ui\//;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function withHardTimeout(promise, timeoutMs, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(
      () => reject(new Error(`${label} timed out after ${timeoutMs}ms`)),
      timeoutMs,
    )),
  ]);
}

async function closeBrowserConnection(browser, timeoutMs = 5_000) {
  if (!browser) return;
  let closed = false;
  await Promise.race([
    browser.close().then(() => { closed = true; }).catch(() => { closed = true; }),
    sleep(timeoutMs),
  ]);
  if (!closed) {
    // A guest reload can leave Playwright waiting forever for a detached
    // renderer acknowledgement. Close only the client transport; never send
    // Browser.close to the managed 360Teams process.
    browser._connection?.close?.('Managed QWork remount completed; detach CDP client.');
  }
}

async function managedQworkTarget(cdpUrl) {
  const response = await fetch(new URL('/json/list', cdpUrl), {
    signal: AbortSignal.timeout(5_000),
  });
  if (!response.ok) throw new Error(`Managed 360Teams CDP target discovery failed: HTTP ${response.status}`);
  const targets = await response.json();
  return (Array.isArray(targets) ? targets : []).find((target) => (
    target?.type === 'webview'
    && (/^QWork$/i.test(String(target.title || '')) || QWORK_TARGET_PATTERN.test(String(target.url || '')))
  )) || null;
}

export async function waitForManagedQworkUi(cdpUrl, expectedUiUrl, timeoutMs = 30_000) {
  const normalizedCdpUrl = normalizeCdpUrl(cdpUrl);
  const expected = validatePinnedQworkUiUrl(expectedUiUrl);
  const deadline = Date.now() + Math.max(1_000, Number(timeoutMs) || 30_000);
  let lastObserved = '';
  while (Date.now() < deadline) {
    try {
      const target = await managedQworkTarget(normalizedCdpUrl);
      lastObserved = String(target?.url || '');
      if (lastObserved && new URL(lastObserved).href === expected.url) return expected;
    } catch {}
    await sleep(250);
  }
  throw new Error(
    `Managed 360Teams did not mount pinned QWork ${expected.version}: `
    + `expected=${expected.url} actual=${lastObserved || 'missing'}`,
  );
}

async function readGuestWorkbench(webview) {
  return withHardTimeout(
    webview.evaluate(async (element) => element.executeJavaScript(String.raw`
      (async () => {
        const timeout = (ms, label) => new Promise((_, reject) => setTimeout(
          () => reject(new Error(label + ' timed out after ' + ms + 'ms')),
          ms,
        ));
        let auth = null;
        let capabilities = null;
        try {
          auth = await Promise.race([
            Promise.resolve().then(() => window.agent?.getAuthStatus?.()),
            timeout(5000, 'getAuthStatus'),
          ]);
        } catch {}
        try {
          capabilities = await Promise.race([
            Promise.resolve().then(() => window.agent?.capabilities?.()),
            timeout(5000, 'capabilities'),
          ]);
        } catch {}
        return {
          url: location.href,
          authenticated: Boolean(auth?.authenticated),
          capabilitiesReady: Boolean(capabilities && typeof capabilities === 'object'),
          workbenchReady: Boolean(
            document.querySelector('[data-testid="nav-new-task"]')
            || document.querySelector('[data-testid="qbot-app"]')
            || /新建任务/.test(String(document.body?.innerText || ''))
          ),
          text: String(document.body?.innerText || '').slice(0, 300),
        };
      })()
    `)),
    10_000,
    '360Teams webview.executeJavaScript workbench probe',
  );
}

/**
 * A packaged 360Teams host may finish its own provisioning after the managed
 * process has already exposed CDP. Its embedded manifest can then replace the
 * explicitly pinned QWork UI with an older bundled URL. Remount through the
 * host <webview>, not Page.navigate on the guest target: the host reload is
 * what replays Teams automatic-login wiring and restores the signed-in
 * workbench.
 */
export async function remountPinnedManagedQworkUi(cdpUrl, expectedUiUrl, {
  timeoutMs = 120_000,
  settleMs = 3_000,
} = {}) {
  const normalizedCdpUrl = normalizeCdpUrl(cdpUrl);
  const expected = validatePinnedQworkUiUrl(expectedUiUrl);
  const deadline = Date.now() + Math.max(10_000, Number(timeoutMs) || 120_000);
  let lastObserved = '';
  let lastError = '';

  while (Date.now() < deadline) {
    let browser = null;
    try {
      browser = await chromium.connectOverCDP(normalizedCdpUrl, { timeout: 10_000 });
      const host = browser.contexts().flatMap((context) => context.pages()).find((page) => {
        try {
          const url = new URL(page.url());
          return url.origin === 'http://localhost:33013' && url.pathname === '/';
        } catch {
          return false;
        }
      });
      if (!host) throw new Error('360Teams host page is not ready.');
      const bodyText = await host.locator('body').innerText().catch(() => '');
      if (/扫码登录|请使用移动端\s*360Teams\s*扫码登录/.test(bodyText)) {
        throw new Error('360Teams login expired before pinned QWork remount.');
      }
      const webview = host.locator('webview#qbot-workbench, webview').first();
      if (await webview.count() < 1) throw new Error('360Teams QWork WebView element is not ready.');

      const currentSrc = String(await webview.getAttribute('src') || '');
      lastObserved = currentSrc;
      let guest = null;
      if (currentSrc) guest = await readGuestWorkbench(webview).catch(() => null);
      const alreadyReady = guest
        && new URL(guest.url).href === expected.url
        && guest.authenticated
        && guest.capabilitiesReady
        && guest.workbenchReady;
      if (!alreadyReady) {
        if (!currentSrc || new URL(currentSrc).href !== expected.url) {
          await webview.evaluate((element, url) => {
            element.setAttribute('src', url);
            element.src = url;
          }, expected.url);
          await waitForManagedQworkUi(
            normalizedCdpUrl,
            expected.url,
            Math.max(10_000, deadline - Date.now()),
          );
        }
        // Loading the guest URL alone leaves newer QWork builds on
        // "正在恢复登录状态". A host-owned reload replays Teams' automatic
        // login handshake and produces the actual signed-in workbench.
        await webview.evaluate((element) => element.reload());
      }

      while (Date.now() < deadline) {
        guest = await readGuestWorkbench(webview);
        lastObserved = String(guest?.url || lastObserved);
        if (guest
          && new URL(guest.url).href === expected.url
          && guest.authenticated
          && guest.capabilitiesReady
          && guest.workbenchReady) {
          await sleep(Math.max(0, Number(settleMs) || 0));
          const stable = await readGuestWorkbench(webview);
          if (new URL(stable.url).href === expected.url
            && stable.authenticated
            && stable.capabilitiesReady
            && stable.workbenchReady) {
            return {
              remounted: !alreadyReady,
              qworkUiUrl: expected.url,
              qworkUiVersion: expected.version,
              authenticated: true,
              capabilitiesReady: true,
              workbenchReady: true,
            };
          }
        }
        await sleep(500);
      }
    } catch (error) {
      lastError = String(error?.message || error);
    } finally {
      await closeBrowserConnection(browser);
    }
    await sleep(500);
  }

  throw new Error(
    `Managed 360Teams could not remount signed-in QWork ${expected.version}: `
    + `expected=${expected.url} actual=${lastObserved || 'missing'} reason=${lastError || 'unknown'}`,
  );
}
