#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { runUiAgentCasebookCommand } from '../../src/lib/ui-agent-casebook-runner.mjs';
import { DEFAULT_SESSION, normalizeCdpUrl, validatePinnedQworkUiUrl } from './config.mjs';
import {
  adoptRelaunchedLiveTeamsSession,
  launchLiveTeams,
  managedTeamsProcessLog,
  processMatchesSession,
  readSession,
  stopIsolatedTeams,
  waitForCdp,
} from './launcher.mjs';
import { qworkRuntimeBridgeSource, startCdpWebviewProxy } from './cdp-webview-proxy.mjs';
import { buildTeamsRunMetadata, writePinnedRunMetadata } from './run-metadata.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const TEAMS_OUTPUT_ROOT = path.resolve(HERE, '../output');
const TEAMS_RUNTIME_ROOT = path.resolve(HERE, '../runtime');
const TEAMS_CONTROL_PLANE_HOME = path.resolve(HERE, '../state/control-plane-home');
const DEFAULT_FIXTURE_DEEPBANK_ROOT = path.resolve(ROOT, '.runtime/deepbankV2-main-b408a07a');
const DEEPBANK_ROOT = process.env.QBOT_TEAMS_FIXTURE_QBOT_ROOT
  || (fs.existsSync(path.join(DEFAULT_FIXTURE_DEEPBANK_ROOT, 'package.json'))
    ? DEFAULT_FIXTURE_DEEPBANK_ROOT
    : path.resolve(ROOT, '../deepbankV2'));
const RECOVERABLE_TEAMS_FRAMEWORK_PATTERNS = [
  /Target page, context or browser has been closed/i,
  /QBot CDP\/page 已断开/i,
  /QWork reply-poll operation timed out/i,
  /teams360-automation\/testfixtures\/skillhub-regression\/manifest\.json/i,
];

export function parseCasebookRunnerOptions(argv = []) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token?.startsWith('--')) throw new Error(`Unexpected argument: ${token || ''}`);
    const [name, inline] = token.slice(2).split(/=(.*)/s, 2);
    const next = argv[index + 1];
    if (inline != null) options[name] = inline;
    else if (next != null && !next.startsWith('--')) {
      options[name] = next;
      index += 1;
    } else options[name] = true;
  }
  return options;
}

export function validateTeamsCasebookOptions(options) {
  if (!options.casebook) throw new Error('--casebook is required.');
  if (!options.case) throw new Error('--case is required.');
  if (options['restart-command']) {
    throw new Error('360Teams Casebook runs must not configure a local-QBot restart-command.');
  }
  if (options.cdp) {
    const cdp = new URL(String(options.cdp));
    if (!['127.0.0.1', 'localhost', '::1', '[::1]'].includes(cdp.hostname)) {
      throw new Error('360Teams CDP must be loopback-only.');
    }
  }
  const rawOut = String(options.out || '');
  const out = path.isAbsolute(rawOut) ? path.resolve(rawOut) : path.resolve(ROOT, rawOut);
  const relative = path.relative(TEAMS_OUTPUT_ROOT, out);
  if (!options.out || relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`360Teams output must stay under ${TEAMS_OUTPUT_ROOT}.`);
  }
  options.casebook = path.isAbsolute(String(options.casebook))
    ? path.resolve(String(options.casebook))
    : path.resolve(ROOT, String(options.casebook));
  if (options.fixtures) {
    options.fixtures = path.isAbsolute(String(options.fixtures))
      ? path.resolve(String(options.fixtures))
      : path.resolve(ROOT, String(options.fixtures));
  }
  options.session = path.resolve(String(options.session || DEFAULT_SESSION));
  options.out = out;
  return options;
}

export function validateLiveCasebookSession(session) {
  if (!session || typeof session !== 'object') {
    throw new Error('No managed 360Teams session exists. Quit the regular client, then run launch:live.');
  }
  if (session.profile_mode !== 'live') {
    throw new Error(
      '360Teams functional Casebook verification requires the existing signed-in live profile. '
      + 'Isolated profiles and OAuth/token seeding are not accepted.',
    );
  }
  if (!session.cdp_url) throw new Error('The managed 360Teams live session has no CDP URL. Run launch:live again.');
  return normalizeCdpUrl(session.cdp_url);
}

export async function resolveTeamsCasebookConnection(options) {
  if (options.cdp) {
    return {
      cdpUrl: normalizeCdpUrl(String(options.cdp)),
      authMode: 'caller-managed-cdp',
      close: async () => {},
    };
  }

  let session = readSession(options.session);
  let upstream = validateLiveCasebookSession(session);
  if (!processMatchesSession(session)) {
    session = await adoptRelaunchedLiveTeamsSession(options.session, {
      timeoutMs: Number(options['timeout-ms'] || 30_000),
    });
    if (session) upstream = validateLiveCasebookSession(session);
  }
  if (!session || !processMatchesSession(session)) {
    throw new Error(
      'The recorded 360Teams live session is stale. Quit any regular client, run launch:live, '
      + 'and confirm QWork is signed in before retrying.',
    );
  }
  await waitForCdp({ cdpUrl: upstream, timeoutMs: Number(options['timeout-ms'] || 30_000) });
  const proxy = await startCdpWebviewProxy({ upstream });
  return {
    cdpUrl: proxy.url,
    upstreamCdpUrl: upstream,
    authMode: 'existing-live-profile',
    reset: proxy.reset,
    close: proxy.close,
  };
}

export async function connectTeamsCasebookBrowser(cdpUrl, {
  attempts = 12,
  timeoutMs = 15_000,
  retryDelayMs = 1_500,
  recoveryCdpUrl = '',
  resetConnection = null,
} = {}) {
  let lastError = null;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    let browser = null;
    const startedAt = Date.now();
    try {
      browser = await chromium.connectOverCDP(cdpUrl, { timeout: timeoutMs });
      const page = browser.contexts().flatMap((context) => context.pages())
        .find((candidate) => /\/\.deepbank\/ui\//.test(candidate.url()));
      if (!page) throw new Error('CDP connected, but the full QWork QBot page is unavailable.');
      await page.evaluate(qworkRuntimeBridgeSource());
      const tier = await page.evaluate(async () => {
        const deadline = Date.now() + 30_000;
        while (Date.now() < deadline) {
          const bridge = window.__qbotE2E || window.__deepbankE2E;
          const view = await bridge?.getConnectionView?.();
          const selected = String(view?.runtimeOptions?.selected?.complianceTier || '').toUpperCase();
          if (/^M[1-4]$/.test(selected)) return selected;
          const visible = String(document.querySelector('[data-testid="composer-safety-level-menu"]')?.textContent || '')
            .trim()
            .toUpperCase();
          if (/^M[1-4]$/.test(visible)) return visible;
          await new Promise((resolve) => setTimeout(resolve, 250));
        }
        return '';
      });
      if (!tier) throw new Error('QWork connected, but the visible model tier could not be read back.');
      const capabilitiesHealth = await page.evaluate(async () => {
        try {
          const value = await window.agent?.capabilities?.();
          return { ok: Boolean(value && typeof value === 'object'), reason: value ? '' : 'empty capabilities' };
        } catch (error) {
          return { ok: false, reason: String(error?.message || error) };
        }
      });
      if (!capabilitiesHealth.ok) {
        throw new Error(`QWork capabilities IPC is unavailable: ${capabilitiesHealth.reason || 'unknown error'}`);
      }
      installTeamsPageGuards(page);
      console.log(JSON.stringify({
        teams_casebook_preconnect: 'ready',
        attempt,
        elapsed_ms: Date.now() - startedAt,
        qwork_url: page.url(),
        model_tier: tier,
        capabilities_ipc: 'ready',
      }));
      return browser;
    } catch (error) {
      lastError = error;
      if (browser) await browser.close().catch(() => {});
      console.error(JSON.stringify({
        teams_casebook_preconnect: 'retry',
        attempt,
        elapsed_ms: Date.now() - startedAt,
        reason: String(error?.message || error).split('\n')[0],
      }));
      if (recoveryCdpUrl && attempt < attempts) {
        await resetConnection?.().catch(() => {});
        const recovery = await recoverTeamsQworkWorkbench(recoveryCdpUrl).catch((recoveryError) => ({
          recovered: false,
          reason: String(recoveryError?.message || recoveryError).split('\n')[0],
        }));
        console.error(JSON.stringify({
          teams_casebook_preconnect_recovery: recovery.recovered ? 'ready' : 'skipped',
          attempt,
          reason: recovery.reason || '',
        }));
      }
      if (attempt < attempts) await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
    }
  }
  throw new Error(`360Teams QWork CDP preconnect failed after ${attempts} attempts: ${lastError?.message || lastError}`);
}

export async function recoverTeamsQworkWorkbench(cdpUrl, { settleMs = 8_000 } = {}) {
  const browser = await chromium.connectOverCDP(normalizeCdpUrl(cdpUrl), { timeout: 10_000 });
  let browserClosed = false;
  try {
    const qwork = browser.contexts().flatMap((context) => context.pages())
      .find((page) => /\/\.deepbank\/ui\//.test(page.url()));
    if (!qwork) return { recovered: false, reason: 'QWork WebView is unavailable; pinned UI cannot be preserved.' };
    const pinnedQworkUi = validatePinnedQworkUiUrl(qwork.url());
    const host = browser.contexts().flatMap((context) => context.pages()).find((page) => {
      try {
        const url = new URL(page.url());
        return url.origin === 'http://localhost:33013' && url.pathname === '/';
      } catch {
        return false;
      }
    });
    if (!host) return { recovered: false, reason: '360Teams host page is unavailable.' };
    const bodyText = await host.locator('body').innerText().catch(() => '');
    if (/扫码登录|请使用移动端\s*360Teams\s*扫码登录/.test(bodyText)) {
      return { recovered: false, reason: '360Teams login expired before recovering QWork.' };
    }
    const previous = readSession(DEFAULT_SESSION);
    if (!previous || previous.profile_mode !== 'live' || !processMatchesSession(previous)) {
      return { recovered: false, reason: 'Managed live 360Teams session is unavailable for pinned QWork recovery.' };
    }
    const snapshot = {
      appPath: previous.app_path,
      profileDir: previous.profile_dir,
      profileAlias: previous.profile_alias,
      port: Number(previous.port || new URL(previous.cdp_url).port),
      controlPlane: String(previous.control_plane_origin || '').trim(),
    };
    if (!snapshot.appPath || !snapshot.profileDir || !snapshot.profileAlias || !snapshot.port || !snapshot.controlPlane) {
      return { recovered: false, reason: 'Managed live 360Teams session is missing pinned recovery identity.' };
    }
    await browser.close().catch(() => {});
    browserClosed = true;
    const stopped = stopIsolatedTeams(DEFAULT_SESSION);
    if (stopped.status !== 'stopped') {
      return { recovered: false, reason: `Managed 360Teams stop failed: ${stopped.status} ${stopped.reason || ''}`.trim() };
    }
    const packagedControlPlaneOrigin = 'https://qbot-api.360shuke.com';
    const controlPlaneOrigin = new URL(snapshot.controlPlane).origin;
    const relaunched = await launchLiveTeams({
      appPath: snapshot.appPath,
      profileDir: snapshot.profileDir,
      profileAlias: snapshot.profileAlias,
      sessionFile: DEFAULT_SESSION,
      port: snapshot.port,
      timeoutMs: 60_000,
      environment: {
        DEEPBANK_SURFACE: 'workbench',
        DEEPBANK_UI_URL: pinnedQworkUi.url,
        QBOT_SURFACE: 'workbench',
        QBOT_UI_URL: pinnedQworkUi.url,
        QBOT_SERVER_URL: snapshot.controlPlane,
        ...(controlPlaneOrigin === packagedControlPlaneOrigin ? {} : { DEEPBANK_SERVER: snapshot.controlPlane }),
      },
    });
    await new Promise((resolve) => setTimeout(resolve, Math.min(Math.max(settleMs, 0), 10_000)));
    return {
      recovered: true,
      reason: `Managed 360Teams relaunched with pinned QWork ${pinnedQworkUi.version}.`,
      cdpUrl: relaunched.cdp_url,
      qworkUiVersion: pinnedQworkUi.version,
    };
  } finally {
    if (!browserClosed) await browser.close().catch(() => {});
  }
}

export function installTeamsPageGuards(page, { screenshotTimeoutMs = 15_000 } = {}) {
  if (!page || page.__teams360ScreenshotGuard) return page;
  const originalScreenshot = page.screenshot.bind(page);
  Object.defineProperty(page, '__teams360ScreenshotGuard', { value: true, configurable: true });
  page.screenshot = async (options = {}) => {
    const requestedTimeout = Number(options?.timeout || 0);
    const hardTimeoutMs = Math.max(
      1,
      requestedTimeout > 0 ? Math.min(requestedTimeout, screenshotTimeoutMs) : screenshotTimeoutMs,
    );
    try {
      return await teamsOperationWithHardTimeout(
        originalScreenshot({ ...options, timeout: hardTimeoutMs }),
        hardTimeoutMs + 250,
        `page.screenshot after ${hardTimeoutMs}ms`,
      );
    } catch (error) {
      if (!/waiting for fonts to load|screenshot.*timeout|page\.screenshot.*timeout/i.test(String(error?.message || error))) {
        throw error;
      }
      let session = null;
      try {
        session = await teamsOperationWithHardTimeout(
          page.context().newCDPSession(page),
          5_000,
          'newCDPSession for screenshot fallback',
        );
        const captured = await teamsOperationWithHardTimeout(
          session.send('Page.captureScreenshot', {
            format: String(options?.type || '').toLowerCase() === 'jpeg' ? 'jpeg' : 'png',
            fromSurface: true,
            captureBeyondViewport: Boolean(options?.fullPage),
          }),
          15_000,
          'Page.captureScreenshot fallback',
        );
        const buffer = Buffer.from(captured.data, 'base64');
        if (options?.path) {
          fs.mkdirSync(path.dirname(path.resolve(options.path)), { recursive: true });
          fs.writeFileSync(options.path, buffer);
        }
        return buffer;
      } finally {
        await session?.detach?.().catch(() => {});
      }
    }
  };
  return page;
}

async function teamsOperationWithHardTimeout(promise, timeoutMs, label) {
  let timer = null;
  try {
    return await Promise.race([
      Promise.resolve(promise),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label}: Timeout`)), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export function repairInterruptedTeamsProgress({ outDir, pass = 1 }) {
  const progressFile = path.join(outDir, 'automation-progress.json');
  const summaryFile = path.join(outDir, 'automation-run-summary.json');
  if (!fs.existsSync(progressFile)) return { repaired: false, reason: 'progress-missing' };
  let progress;
  try {
    progress = JSON.parse(fs.readFileSync(progressFile, 'utf8'));
  } catch {
    return { repaired: false, reason: 'progress-invalid' };
  }
  const results = Array.isArray(progress.results) ? progress.results : [];
  let runSummary = null;
  if (fs.existsSync(summaryFile)) {
    try { runSummary = JSON.parse(fs.readFileSync(summaryFile, 'utf8')); } catch {}
  }
  const completed = Number(progress.completed ?? results.length);
  const total = Number(progress.total ?? results.length);
  const summaryTotal = Number(runSummary?.counts?.total ?? 0);
  // A completed Casebook run may set `progress.stopped` after the last Case
  // (for example when the final recovery fixture stops its runtime).  The
  // complete result set and an ended summary are authoritative; treating that
  // marker as an interrupted run rewinds valid results and starts duplicate
  // execution.  Explicit abort/recovery/synthetic markers still disqualify a
  // run from the completion fast path.
  const completionIsInvalid = progress.aborted === true
    || progress.synthetic === true
    || progress.recovering === true
    || runSummary?.stopped === true
    || runSummary?.aborted === true
    || runSummary?.synthetic === true
    || ['aborted', 'interrupted', 'recovering', 'stopped'].includes(String(runSummary?.status || '').toLowerCase());
  const normallyComplete = total > 0
    && completed >= total
    && results.length >= total
    && summaryTotal === total
    && Boolean(runSummary?.ended_at)
    && !completionIsInvalid;
  if (normallyComplete) return { repaired: false, reason: 'run-complete' };
  const recoverFrom = results.findIndex((result) => {
    const text = `${result?.actual_result || ''}\n${result?.conclusion || ''}`;
    return RECOVERABLE_TEAMS_FRAMEWORK_PATTERNS.some((pattern) => pattern.test(text));
  });
  if (recoverFrom < 0) return { repaired: false, reason: 'no-recoverable-framework-result' };

  const logsDir = path.join(outDir, 'logs');
  fs.mkdirSync(logsDir, { recursive: true });
  const passLabel = String(pass).padStart(2, '0');
  fs.copyFileSync(progressFile, path.join(logsDir, `teams-recovery-pass-${passLabel}-progress.json`));
  if (fs.existsSync(summaryFile)) {
    fs.copyFileSync(summaryFile, path.join(logsDir, `teams-recovery-pass-${passLabel}-summary.json`));
  }

  const kept = results.slice(0, recoverFrom);
  const first = results[recoverFrom];
  const recoveryReason = `360Teams 适配层从 ${first?.id || `index-${recoverFrom + 1}`} 的可恢复框架中断续跑。`;
  fs.writeFileSync(progressFile, `${JSON.stringify({
    updated_at: new Date().toISOString(),
    completed: kept.length,
    total: Number(progress.total || results.length),
    recovering: true,
    recovery_reason: recoveryReason,
    results: kept,
  }, null, 2)}\n`);
  fs.writeFileSync(summaryFile, `${JSON.stringify({
    schema_version: 1,
    status: 'recovering',
    generated_at: new Date().toISOString(),
    reason: recoveryReason,
    recovery_from_index: recoverFrom,
    preserved_results: kept.length,
  }, null, 2)}\n`);
  return {
    repaired: true,
    startIndex: recoverFrom,
    preservedResults: kept.length,
    firstCaseId: first?.id || '',
    reason: recoveryReason,
  };
}

export async function runTeamsCasebook(argv = process.argv.slice(2)) {
  const options = validateTeamsCasebookOptions(parseCasebookRunnerOptions(argv));
  const originalConnectOverCDP = chromium.connectOverCDP;
  const callerManagedCdp = Boolean(options.cdp);
  let connection = await resolveTeamsCasebookConnection(options);
  options.cdp = connection.cdpUrl;
  const previousCwd = process.cwd();
  const maxRecoveryPasses = Math.max(0, Number(options['teams-recovery-passes'] || 20));
  const recoveryStarts = new Map();
  let summary = null;
  let recoveryPass = 0;
  try {
    while (true) {
      // Playwright's Electron CDP handshake must start from the project root.
      // Starting it from the compatibility fixture directory can leave the
      // QWork WebView attached but never initialized. Switch to the fixture
      // root only after the browser has been handed to the shared runner.
      process.chdir(ROOT);
      const browser = await connectTeamsCasebookBrowser(connection.cdpUrl, {
        recoveryCdpUrl: connection.upstreamCdpUrl || '',
        resetConnection: connection.reset,
      });
      const runtimeIdentity = await configureTeamsFixtureRuntime(options, browser);
      const session = readSession(options.session);
      writePinnedRunMetadata(options.out, buildTeamsRunMetadata({
        session,
        qworkUiUrl: runtimeIdentity.qworkUiUrl,
        controlPlane: runtimeIdentity.controlPlane,
        modelTier: options['model-tier'] || 'M3',
        timeoutMs: options['timeout-ms'] || 600000,
        caseIds: String(options.case || '').split(',').map((item) => item.trim()).filter(Boolean),
      }));
      let handedToRunner = false;
      chromium.connectOverCDP = async (...args) => {
        if (!handedToRunner) {
          handedToRunner = true;
          return browser;
        }
        return originalConnectOverCDP.apply(chromium, args);
      };
      try {
        // The shared runner has a few legacy process.cwd()-relative fixture
        // lookups. Keep those isolated in the Teams compatibility root.
        process.chdir(TEAMS_RUNTIME_ROOT);
        summary = await runUiAgentCasebookCommand({ options, root: ROOT });
      } finally {
        chromium.connectOverCDP = originalConnectOverCDP;
        if (!handedToRunner) await browser.close().catch(() => {});
      }

      const repair = repairInterruptedTeamsProgress({ outDir: options.out, pass: recoveryPass + 1 });
      if (!repair.repaired) break;
      recoveryPass += 1;
      const repeated = (recoveryStarts.get(repair.startIndex) || 0) + 1;
      recoveryStarts.set(repair.startIndex, repeated);
      console.error(JSON.stringify({
        teams_casebook_recovery: 'resume',
        pass: recoveryPass,
        start_index: repair.startIndex,
        preserved_results: repair.preservedResults,
        first_case_id: repair.firstCaseId,
        reason: repair.reason,
      }));
      if (recoveryPass > maxRecoveryPasses || repeated > 3) {
        throw new Error(
          `360Teams Casebook recovery exhausted at ${repair.firstCaseId || repair.startIndex}: `
          + `${recoveryPass} recovery passes, repeated ${repeated} times.`,
        );
      }
      if (!callerManagedCdp) {
        // Fault/fixture cases deliberately relaunch the managed 360Teams host.
        // A proxy created for the previous browser keeps stale auto-attach
        // sessions even when the loopback port is reused, so rebuild it before
        // reconnecting the shared runner to the new QWork WebView.
        await connection.close().catch(() => {});
        connection = await resolveTeamsCasebookConnection({ ...options, cdp: undefined });
        options.cdp = connection.cdpUrl;
      }
      options.resume = true;
      await new Promise((resolve) => setTimeout(resolve, 1_000));
    }

    console.log(JSON.stringify({
      command: 'teams360-ui-agent-casebook-run',
      auth_mode: connection.authMode,
      upstream_cdp: connection.upstreamCdpUrl || '',
      recovery_passes: recoveryPass,
      out_dir: summary.out_dir,
      counts: summary.counts,
      status: summary.status,
    }, null, 2));
    return summary;
  } finally {
    chromium.connectOverCDP = originalConnectOverCDP;
    process.chdir(previousCwd);
    await connection.close().catch(() => {});
  }
}

export async function configureTeamsFixtureRuntime(options, browser) {
  const page = browser.contexts().flatMap((context) => context.pages())
    .find((candidate) => /\/\.deepbank\/ui\//.test(candidate.url()));
  if (!page) throw new Error('Cannot configure Teams fixture runtime without the QWork QBot page.');
  const qworkUiUrl = page.url();
  const controlPlane = String(options['control-plane-url'] || await page.evaluate(() => (
    typeof process !== 'undefined' ? process.env.DEEPBANK_SERVER || '' : ''
  )));
  const sessionFile = path.resolve(String(options.session || DEFAULT_SESSION));
  const session = readSession(sessionFile);
  const managedLog = String(session?.process_log || managedTeamsProcessLog(sessionFile) || '').trim();
  if (managedLog) options['qbot-stderr-log'] = managedLog;
  applyTeamsFixtureOptions(options, controlPlane, qworkUiUrl);
  return { controlPlane, qworkUiUrl };
}

function applyTeamsFixtureOptions(options, controlPlane, qworkUiUrl) {
  const normalized = String(controlPlane || '').trim();
  if (!normalized) throw new Error('QWork did not expose DEEPBANK_SERVER; fault fixtures cannot be restored safely.');
  if (!/\/\.deepbank\/ui\/[^/]+\/index\.html(?:$|[?#])/.test(String(qworkUiUrl || ''))) {
    throw new Error('QWork did not expose a versioned UI URL; managed host relaunch is unsafe.');
  }
  const restartShim = path.join(TEAMS_RUNTIME_ROOT, 'scripts', 'restart-qbot-electron-control-plane.sh');
  fs.mkdirSync(TEAMS_CONTROL_PLANE_HOME, { recursive: true });
  options['control-plane-url'] = normalized;
  // QWork backend calls are exposed through the 360Teams preload/IPC `agent`
  // object rather than renderer HTTP. Enable the shared runner's opt-in
  // renderer adapter for per-Case fault transforms; the local-QBot lane never
  // receives this option and keeps its existing control-plane proxy path.
  const selectedCases = String(options.case || options.cases || '').split(',').map((item) => item.trim()).filter(Boolean);
  const realFixtureCases = /^(?:SIT-SKILL-(?:004|005|011|012|013|015|020|022|026|027|028|029|030|031|032|033)|SIT-SKILL-SCOPE-001|SIT-CONN-(?:008|009|013|018)|SIT-TEAMS-DOC-001|SIT-HITL-002)$/i;
  const fullProfile = /^(?:full|all)$/i.test(String(options.profile || ''));
  const needsRealFixtureHost = fullProfile || selectedCases.some((id) => realFixtureCases.test(id));
  if (/^(?:1|true|yes)$/i.test(String(options['teams-fixture-host-relaunch'] || '')) || needsRealFixtureHost) {
    options['teams-fixture-host-relaunch'] = 'true';
    delete options['renderer-control-adapter'];
  } else {
    options['renderer-control-adapter'] = 'teams360';
  }
  options['qbot-root'] ||= DEEPBANK_ROOT;
  options['qbot-home'] ||= TEAMS_CONTROL_PLANE_HOME;
  options['restart-cwd'] = TEAMS_RUNTIME_ROOT;
  options['restart-command'] = [
    restartShim,
    options['qbot-root'],
    normalized,
    '0',
    options['qbot-home'],
    qworkUiUrl,
  ]
    .map(shellArgument)
    .join(' ');
}

function shellArgument(value) {
  return `'${String(value ?? '').replaceAll("'", `'\\''`)}'`;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const summary = await runTeamsCasebook();
  const counts = summary?.counts || {};
  // runTeamsCasebook has already restored cwd, closed its CDP proxy and
  // completed managed-host cleanup. Exit explicitly so stale HTTP keep-alive
  // handles cannot leave a completed runner looking alive to the monitor.
  process.exit((counts.failed || 0) > 0 || (counts.blocked || 0) > 0 ? 1 : 0);
}
