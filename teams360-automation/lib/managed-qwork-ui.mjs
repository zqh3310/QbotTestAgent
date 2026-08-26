import { chromium } from 'playwright';
import { normalizeCdpUrl, validatePinnedQworkUiUrl } from './config.mjs';

const QWORK_TARGET_PATTERN = /\/\.deepbank(?:-(?:dev|local|uat|sit))?\/ui\//;

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
        const probe = async (operation, label) => {
          try {
            return await Promise.race([
              Promise.resolve().then(operation),
              timeout(5000, label),
            ]);
          } catch {
            return null;
          }
        };
        // Probe independent guest APIs concurrently. Running the two 5s
        // probes serially races the outer 10s executeJavaScript timeout and
        // can reject a fully mounted, signed-in workbench at the boundary.
        const [auth, capabilities, runtimeReleaseStatus] = await Promise.all([
          probe(() => window.agent?.getAuthStatus?.(), 'getAuthStatus'),
          probe(() => window.agent?.capabilities?.(), 'capabilities'),
          probe(() => window.agent?.runtimeReleaseStatus?.(), 'runtimeReleaseStatus'),
        ]);
        return {
          url: location.href,
          authenticated: Boolean(auth?.authenticated),
          capabilitiesReady: Boolean(capabilities && typeof capabilities === 'object'),
          runtimeActivationAvailable: typeof window.agent?.runtimeActivatePreparedRelease === 'function',
          runtimeReleaseStatus,
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

function releaseVersion(value) {
  return String(value || '').trim();
}

export function managedQworkRuntimeActivationDecision(status, expectedVersion) {
  const expected = releaseVersion(expectedVersion);
  const valid = status != null && typeof status === 'object' && !Array.isArray(status);
  const preparedPresent = valid && Object.prototype.hasOwnProperty.call(status, 'preparedRelease');
  const prepared = valid
    && status.preparedRelease != null
    && typeof status.preparedRelease === 'object'
    && !Array.isArray(status.preparedRelease)
    ? status.preparedRelease
    : null;
  const loaded = valid
    && status.loadedRuntime != null
    && typeof status.loadedRuntime === 'object'
    && !Array.isArray(status.loadedRuntime)
    ? status.loadedRuntime
    : null;
  const compatibility = valid
    && status.hostRuntimeCompatibility != null
    && typeof status.hostRuntimeCompatibility === 'object'
    && !Array.isArray(status.hostRuntimeCompatibility)
    ? status.hostRuntimeCompatibility
    : null;
  const phase = valid ? releaseVersion(status.updatePhase) : '';
  const preparedMatches = Boolean(
    prepared
    && releaseVersion(prepared.releaseId) === expected
    && releaseVersion(prepared.version) === expected
  );
  const hostCoreMatches = Boolean(
    compatibility
    && releaseVersion(compatibility.hostCoreVersion) === expected
  );
  const runtimeMatches = Boolean(
    valid
    && releaseVersion(status.releaseId) === expected
    && releaseVersion(status.version) === expected
    && loaded
    && releaseVersion(loaded.releaseId) === expected
    && releaseVersion(loaded.version) === expected
    && compatibility
    && releaseVersion(compatibility.runtimeReleaseId) === expected
    && releaseVersion(compatibility.runtimeVersion) === expected
  );
  const ready = Boolean(
    expected
    && runtimeMatches
    && phase === 'idle'
    && preparedPresent
    && status.preparedRelease === null
  );
  const activatable = Boolean(
    expected
    && valid
    && phase === 'ready-to-activate'
    && preparedPresent
    && preparedMatches
    && hostCoreMatches
  );
  let reason = '';
  if (!expected) reason = 'target-version-missing';
  else if (!valid) reason = 'runtime-release-status-invalid';
  else if (ready) reason = 'already-active';
  else if (phase === 'restart-required') reason = 'managed-host-restart-still-required';
  else if (phase !== 'ready-to-activate') reason = `runtime-update-phase-${phase || 'missing'}`;
  else if (!preparedPresent || !preparedMatches) reason = 'prepared-release-does-not-match-target';
  else if (!hostCoreMatches) reason = 'host-core-does-not-match-target';
  else reason = 'prepared-release-ready';
  return {
    ready,
    activatable,
    reason,
    observed: {
      release_id: valid ? releaseVersion(status.releaseId) : '',
      version: valid ? releaseVersion(status.version) : '',
      loaded_release_id: loaded ? releaseVersion(loaded.releaseId) : '',
      loaded_version: loaded ? releaseVersion(loaded.version) : '',
      compatibility_runtime_release_id: compatibility ? releaseVersion(compatibility.runtimeReleaseId) : '',
      compatibility_runtime_version: compatibility ? releaseVersion(compatibility.runtimeVersion) : '',
      compatibility_host_core_version: compatibility ? releaseVersion(compatibility.hostCoreVersion) : '',
      update_phase: phase,
      prepared_release_id: prepared ? releaseVersion(prepared.releaseId) : '',
      prepared_version: prepared ? releaseVersion(prepared.version) : '',
      prepared_release_present: preparedPresent,
    },
  };
}

/**
 * A host-core update is committed by a managed Teams restart first. Once the
 * replacement host exposes the exact prepared runtime, activate it once via
 * the public bridge and follow the replacement guest until identity settles.
 */
export async function activatePreparedManagedQworkRelease(cdpUrl, expectedUiUrl, {
  timeoutMs = 120_000,
  settleMs = 1_000,
} = {}) {
  const normalizedCdpUrl = normalizeCdpUrl(cdpUrl);
  const expected = validatePinnedQworkUiUrl(expectedUiUrl);
  const deadline = Date.now() + Math.max(10_000, Number(timeoutMs) || 120_000);
  let browser = null;
  let dispatched = false;
  let lastDecision = null;
  let lastObservedUrl = '';
  let lastError = '';

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
    if (!host) throw new Error('360Teams host page is not ready for QWork runtime activation.');
    const webview = host.locator('webview#qbot-workbench, webview').first();
    if (await webview.count() < 1) throw new Error('360Teams QWork WebView is not ready for runtime activation.');

    const before = await readGuestWorkbench(webview);
    lastObservedUrl = String(before?.url || '');
    lastDecision = managedQworkRuntimeActivationDecision(before?.runtimeReleaseStatus, expected.version);
    const surfaceReady = Boolean(
      before
      && new URL(before.url).href === expected.url
      && before.authenticated
      && before.capabilitiesReady
      && before.workbenchReady
    );
    if (surfaceReady && lastDecision.ready) {
      return {
        activated: false,
        activationDispatched: false,
        qworkUiUrl: expected.url,
        qworkUiVersion: expected.version,
        runtime: lastDecision.observed,
      };
    }
    if (!surfaceReady) {
      throw new Error(`Managed QWork surface is not ready before runtime activation: url=${lastObservedUrl || 'missing'}`);
    }
    if (!before.runtimeActivationAvailable) {
      throw new Error('Managed QWork does not expose window.agent.runtimeActivatePreparedRelease.');
    }
    if (!lastDecision.activatable) {
      throw new Error(
        `Managed QWork prepared runtime cannot be activated safely: ${lastDecision.reason} `
        + JSON.stringify(lastDecision.observed),
      );
    }

    const dispatch = await withHardTimeout(
      webview.evaluate((element, version) => element.executeJavaScript(`(() => {
        const expectedVersion = ${JSON.stringify(version)};
        const activate = globalThis.window?.agent?.runtimeActivatePreparedRelease;
        if (typeof activate !== 'function') {
          return { ok: false, dispatched: false, error: 'missing-runtime-activation-api' };
        }
        try {
          const request = activate.call(globalThis.window.agent);
          globalThis.__qbotManagedPreparedReleaseActivation = {
            expectedVersion,
            dispatchedAt: new Date().toISOString(),
            settled: false,
          };
          Promise.resolve(request).then(
            (result) => {
              globalThis.__qbotManagedPreparedReleaseActivation = {
                expectedVersion,
                settled: true,
                ok: result?.ok === true,
                activated: result?.activated === true,
                updatePhase: String(result?.updatePhase || ''),
                error: String(result?.error || ''),
              };
            },
            (error) => {
              globalThis.__qbotManagedPreparedReleaseActivation = {
                expectedVersion,
                settled: true,
                ok: false,
                error: String(error?.message || error),
              };
            },
          );
          return { ok: true, dispatched: true, expectedVersion };
        } catch (error) {
          return { ok: false, dispatched: false, error: String(error?.message || error) };
        }
      })()`), expected.version),
      10_000,
      '360Teams prepared QWork runtime activation dispatch',
    );
    if (dispatch?.ok !== true || dispatch?.dispatched !== true) {
      throw new Error(`Managed QWork runtime activation was not dispatched: ${dispatch?.error || 'unknown'}`);
    }
    dispatched = true;

    let stableReady = 0;
    while (Date.now() < deadline) {
      try {
        const current = await readGuestWorkbench(webview);
        lastObservedUrl = String(current?.url || lastObservedUrl);
        lastDecision = managedQworkRuntimeActivationDecision(current?.runtimeReleaseStatus, expected.version);
        const currentSurfaceReady = Boolean(
          current
          && new URL(current.url).href === expected.url
          && current.authenticated
          && current.capabilitiesReady
          && current.workbenchReady
        );
        if (currentSurfaceReady && lastDecision.ready) {
          stableReady += 1;
          if (stableReady >= 2) {
            return {
              activated: true,
              activationDispatched: true,
              qworkUiUrl: expected.url,
              qworkUiVersion: expected.version,
              authenticated: true,
              capabilitiesReady: true,
              workbenchReady: true,
              runtime: lastDecision.observed,
            };
          }
          await sleep(Math.max(250, Number(settleMs) || 0));
          continue;
        }
        stableReady = 0;
      } catch (error) {
        lastError = String(error?.message || error);
      }
      await sleep(500);
    }
  } finally {
    await closeBrowserConnection(browser);
  }

  throw new Error(
    `Managed QWork runtime activation did not settle on ${expected.version}: `
    + `dispatched=${dispatched} url=${lastObservedUrl || 'missing'} `
    + `decision=${lastDecision ? JSON.stringify(lastDecision) : 'missing'} `
    + `reason=${lastError || 'timeout'}`,
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
