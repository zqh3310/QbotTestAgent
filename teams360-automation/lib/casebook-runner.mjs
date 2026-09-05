#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
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
  settleRelaunchedLiveTeamsSession,
  stopIsolatedTeams,
  waitForCdp,
} from './launcher.mjs';
import { qworkRuntimeBridgeSource, startCdpWebviewProxy } from './cdp-webview-proxy.mjs';
import { buildTeamsRunMetadata, writePinnedRunMetadata } from './run-metadata.mjs';
import { summarizeRuntimeReleaseStatus } from './cdp-webview.mjs';
import {
  assessQworkReleaseIdentity,
  assertStableQworkReleaseIdentity,
  readQworkReleaseIdentity,
} from './qwork-release-identity.mjs';
import {
  applyManagedQbotProfileConfig,
  waitForStagedQbotServer,
} from './teams-profile-qbot-config.mjs';
import { remountPinnedManagedQworkUi } from './managed-qwork-ui.mjs';
import {
  createNewManagedOutputDirectory,
  executeUnderManagedRunnerLock,
  inspectNewManagedOutputPath,
} from './managed-runner-lock.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const TEAMS_OUTPUT_ROOT = path.resolve(HERE, '../output');
const TEAMS_RUNTIME_ROOT = path.resolve(HERE, '../runtime');
const TEAMS_CONTROL_PLANE_HOME = path.resolve(HERE, '../state/control-plane-home');
const TEAMS_RESTART_SHIM = path.join(
  TEAMS_RUNTIME_ROOT,
  'scripts',
  'restart-qbot-electron-control-plane.sh',
);
const CURRENT_FIXTURE_DEEPBANK_ROOT = path.resolve(ROOT, '.runtime/deepbankV2-origin-main');
const LEGACY_FIXTURE_DEEPBANK_ROOT = path.resolve(ROOT, '.runtime/deepbankV2-main-b408a07a');
const DEEPBANK_ROOT = process.env.QBOT_TEAMS_FIXTURE_QBOT_ROOT
  || (fs.existsSync(path.join(CURRENT_FIXTURE_DEEPBANK_ROOT, 'package.json'))
    ? CURRENT_FIXTURE_DEEPBANK_ROOT
    : fs.existsSync(path.join(LEGACY_FIXTURE_DEEPBANK_ROOT, 'package.json'))
      ? LEGACY_FIXTURE_DEEPBANK_ROOT
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
  const selectedCaseIds = String(options.case).split(',').map((item) => item.trim()).filter(Boolean);
  const productionGate = /^(?:1|true|yes)$/i.test(String(options['production-gate'] || ''));
  const productionCoreBeta = productionGate
    && selectedCaseIds.some((id) => /^BETA-/.test(id));
  if (productionGate) {
    const requiredReleaseInputs = [
      'backend-version',
      'prompt-policy-version',
      'feature-flags-hash',
      'qwork-ui-git-commit',
      'qwork-build-id',
      'qwork-release-manifest-sha256',
    ];
    const missing = requiredReleaseInputs.filter((name) => !String(options[name] || '').trim());
    if (missing.length) {
      throw new Error(`Production Teams runs require authoritative release assertions: ${missing.map((name) => `--${name}`).join(', ')}.`);
    }
    if (!/^[a-f0-9]{64}$/i.test(String(options['feature-flags-hash']))
      || !/^[a-f0-9]{64}$/i.test(String(options['qwork-release-manifest-sha256']))) {
      throw new Error('Production Teams release hash assertions must be 64-character SHA-256 hex values.');
    }
  }
  if (productionGate && !String(options['control-plane-url'] || '').trim()) {
    throw new Error('Production Teams runs require --control-plane-url from the matching READY pretest.');
  }
  if (
    productionCoreBeta
    && selectedCaseIds.includes('BETA-CHAT-010')
    && !String(options['native-ime-command'] || process.env.QBOT_CORE_BETA_NATIVE_IME_COMMAND || '').trim()
  ) {
    throw new Error(
      'Production Core Beta Teams runs containing BETA-CHAT-010 require '
      + '--native-ime-command (or QBOT_CORE_BETA_NATIVE_IME_COMMAND) from the matching READY pretest.',
    );
  }
  if (options['control-plane-url']) {
    const controlPlane = new URL(String(options['control-plane-url']));
    if (!['http:', 'https:'].includes(controlPlane.protocol)
      || controlPlane.username || controlPlane.password) {
      throw new Error('--control-plane-url must be a credential-free HTTP(S) URL.');
    }
    options['control-plane-url'] = controlPlane.origin;
  }
  if (options['resume-from']) {
    if (!options['impact-case'] && !/^(?:1|true|yes)$/i.test(String(options['impact-all'] || ''))) {
      throw new Error('Cross-framework resume requires --impact-case or --impact-all true.');
    }
  } else if (options['impact-case'] || options['impact-all']) {
    throw new Error('--impact-case/--impact-all require --resume-from.');
  }
  if (options['core-beta-cleanup-from'] && options['resume-from']) {
    throw new Error('--core-beta-cleanup-from cannot be combined with cross-run resume.');
  }
  const cleanupReleaseMigration = options['core-beta-cleanup-release-migration'];
  if (cleanupReleaseMigration && !options['core-beta-cleanup-from']) {
    throw new Error('--core-beta-cleanup-release-migration requires --core-beta-cleanup-from.');
  }
  if (
    cleanupReleaseMigration
    && !/^(?:1|true|yes)$/i.test(String(cleanupReleaseMigration))
  ) {
    throw new Error('--core-beta-cleanup-release-migration must be explicitly true.');
  }
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
  inspectNewManagedOutputPath({ outDir: out, outputRoot: TEAMS_OUTPUT_ROOT });
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
  if (options['core-beta-cleanup-from']) {
    const rawCleanupFrom = String(options['core-beta-cleanup-from']);
    const cleanupFrom = path.isAbsolute(rawCleanupFrom)
      ? path.resolve(rawCleanupFrom)
      : path.resolve(ROOT, rawCleanupFrom);
    const cleanupRelative = path.relative(TEAMS_OUTPUT_ROOT, cleanupFrom);
    if (cleanupRelative.startsWith('..') || path.isAbsolute(cleanupRelative) || cleanupFrom === out) {
      throw new Error(`--core-beta-cleanup-from must be a different frozen batch under ${TEAMS_OUTPUT_ROOT}.`);
    }
    options['core-beta-cleanup-from'] = cleanupFrom;
  }
  if (options['resume-from']) {
    const resumeFrom = path.resolve(String(options['resume-from']));
    const resumeRelative = path.relative(TEAMS_OUTPUT_ROOT, resumeFrom);
    if (resumeRelative.startsWith('..') || path.isAbsolute(resumeRelative) || resumeFrom === out) {
      throw new Error(`--resume-from must be a different immutable batch under ${TEAMS_OUTPUT_ROOT}.`);
    }
    options['resume-from'] = resumeFrom;
  }
  return options;
}

export function inspectManagedTeamsRestartCapability() {
  let stat = null;
  try {
    stat = fs.statSync(TEAMS_RESTART_SHIM);
  } catch {
    // Report the missing entrypoint below without mutating the runtime.
  }
  const syntax = stat?.isFile()
    ? spawnSync('/bin/zsh', ['-n', TEAMS_RESTART_SHIM], {
      cwd: TEAMS_RUNTIME_ROOT,
      encoding: 'utf8',
      timeout: 10_000,
    })
    : null;
  const executable = Boolean(stat?.isFile() && (stat.mode & 0o111));
  return {
    ok: Boolean(stat?.isFile() && executable && syntax?.status === 0),
    mode: 'teams_wrapper_managed_restart',
    entrypoint: TEAMS_RESTART_SHIM,
    exists: Boolean(stat?.isFile()),
    executable,
    syntax_ok: syntax?.status === 0,
    syntax_error: String(syntax?.stderr || syntax?.error?.message || '').trim(),
  };
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
  const expectedControlPlane = String(options['control-plane-url'] || '').trim();
  if (expectedControlPlane) {
    const expectedOrigin = new URL(expectedControlPlane).origin;
    const sessionOrigin = String(session.control_plane_origin || '').trim();
    if (!sessionOrigin || new URL(sessionOrigin).origin !== expectedOrigin) {
      throw new Error(
        `Managed 360Teams session control plane drift: expected=${expectedOrigin} `
        + `session=${sessionOrigin || 'missing'}`,
      );
    }
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

export function extendTeamsPreconnectDeadlineAfterRecovery(
  currentDeadline,
  recoveredAt,
  verificationWindowMs = 60_000,
) {
  const deadline = Number(currentDeadline) || 0;
  const recovered = Number(recoveredAt) || Date.now();
  const verificationWindow = Math.max(1_000, Number(verificationWindowMs) || 60_000);
  return Math.max(deadline, recovered + verificationWindow);
}

export function teamsPreconnectRecoveryAllowed({
  attempt,
  attempts,
  now = Date.now(),
  readyDeadline,
  recoveryCompleted = false,
} = {}) {
  return !recoveryCompleted
    && Number(attempt) < Number(attempts)
    && Number(now) < Number(readyDeadline);
}

export function resolveTeamsPreconnectModelMode({
  selectedTier = '',
  controlTier = '',
  controlText = '',
  controlVisible = false,
} = {}) {
  const selected = String(selectedTier).trim().toUpperCase();
  const dataTier = String(controlTier).trim().toUpperCase();
  const text = String(controlText).trim().toUpperCase();
  if (controlVisible) {
    const visibleTier = /^M[1-4]$/.test(dataTier)
      ? dataTier
      : text.match(/(?:^|\s)(M[1-4])(?:\s|$)/)?.[1] || '';
    if (visibleTier) {
      return { ready: true, mode: visibleTier, tier: visibleTier, source: 'visible-control' };
    }
    if (dataTier === 'AUTO' || /^AUTO(?:\s|$)/.test(text) || /^自动(?:\s|$)/.test(text)) {
      return { ready: true, mode: 'AUTO', tier: '', source: 'visible-control' };
    }
  }
  if (/^M[1-4]$/.test(selected)) {
    return { ready: true, mode: selected, tier: selected, source: 'connection-view' };
  }
  return { ready: false, mode: '', tier: '', source: '' };
}

export async function connectTeamsCasebookBrowser(cdpUrl, {
  attempts = 80,
  timeoutMs = 15_000,
  retryDelayMs = 1_500,
  readyTimeoutMs = 120_000,
  postRecoveryReadyMs = 60_000,
  recoveryCdpUrl = '',
  resetConnection = null,
  expectedQworkUiUrl = '',
} = {}) {
  const expectedQworkUi = expectedQworkUiUrl
    ? validatePinnedQworkUiUrl(expectedQworkUiUrl)
    : null;
  let lastError = null;
  const startedWaitingAt = Date.now();
  let readyDeadline = startedWaitingAt + Math.max(timeoutMs, Number(readyTimeoutMs) || 120_000);
  let attemptsUsed = 0;
  let recoveryCompleted = false;
  for (let attempt = 1; attempt <= attempts && Date.now() < readyDeadline; attempt += 1) {
    attemptsUsed = attempt;
    let browser = null;
    const startedAt = Date.now();
    try {
      browser = await chromium.connectOverCDP(cdpUrl, { timeout: timeoutMs });
      const qworkPages = browser.contexts().flatMap((context) => context.pages())
        .filter((candidate) => /\/\.deepbank(?:-(?:dev|local|uat|sit))?\/ui\//.test(candidate.url()));
      const page = (expectedQworkUi
        ? qworkPages.find((candidate) => {
          try { return new URL(candidate.url()).href === expectedQworkUi.url; } catch { return false; }
        })
        : null) || qworkPages[0];
      if (!page) throw new Error('CDP connected, but the full QWork QBot page is unavailable.');
      if (expectedQworkUi && new URL(page.url()).href !== expectedQworkUi.url) {
        throw new Error(
          `Managed QWork release identity drift: expected=${expectedQworkUi.url} actual=${page.url()}`,
        );
      }
      await page.evaluate(qworkRuntimeBridgeSource());
      // A runner can be terminated after installing a stateful renderer
      // fixture but before its finally block restores window.agent.  Those
      // wrappers retain Playwright exposed-function bindings owned by the dead
      // Node process; the next capabilities() call then hangs forever.  At
      // preconnect there is, by definition, no active Case fixture yet and the
      // wrapper is the only runner allowed for this live profile, so restore
      // the captured public methods before performing any readiness probe.
      const staleRendererControlRecovery = await page.evaluate(() => {
        const root = globalThis;
        const originals = root.__qbotAutomationAgentOriginals;
        if (!root.agent || !originals || typeof originals !== 'object') {
          return { restored: 0, owner: '', stack_size: 0 };
        }
        const owner = String(root.__qbotAutomationAgentOriginalsOwner || '');
        const stackSize = Array.isArray(root.__qbotAutomationControlStack)
          ? root.__qbotAutomationControlStack.length
          : 0;
        let restored = 0;
        for (const [name, original] of Object.entries(originals)) {
          if (typeof original !== 'function') continue;
          root.agent[name] = original;
          restored += 1;
        }
        const bindings = root.__qbotAutomationControlPrimaryBindings || {};
        for (const binding of Object.values(bindings)) {
          try { delete root[binding]; } catch {}
        }
        delete root.__qbotAutomationAgentOriginals;
        delete root.__qbotAutomationAgentOriginalsOwner;
        delete root.__qbotAutomationControlStack;
        delete root.__qbotAutomationControlPrimaryBindings;
        delete root.__qbotAutomationControlId;
        return { restored, owner, stack_size: stackSize };
      });
      const modelDeadline = Date.now() + 30_000;
      let modelReadback = { ready: false, mode: '', tier: '', source: '' };
      while (Date.now() < modelDeadline) {
        const observation = await page.evaluate(async () => {
          const bridge = window.__qbotE2E || window.__deepbankE2E;
          let view = null;
          try {
            view = await Promise.race([
              Promise.resolve().then(() => bridge?.getConnectionView?.()),
              new Promise((_, reject) => setTimeout(
                () => reject(new Error('Teams QWork connection view timed out after 1500ms')),
                1500,
              )),
            ]);
          } catch {}
          const selected = String(view?.runtimeOptions?.selected?.complianceTier || '').toUpperCase();
          const control = document.querySelector('[data-testid="composer-safety-level-menu"]');
          const rect = control?.getBoundingClientRect?.();
          return {
            selectedTier: selected,
            controlTier: String(control?.getAttribute?.('data-tier') || ''),
            controlText: String(control?.textContent || ''),
            controlVisible: Boolean(control && rect && rect.width > 0 && rect.height > 0),
          };
        });
        modelReadback = resolveTeamsPreconnectModelMode(observation);
        if (modelReadback.ready) break;
        await new Promise((resolve) => setTimeout(resolve, 250));
      }
      if (!modelReadback.ready) {
        throw new Error('QWork connected, but the visible model mode could not be read back.');
      }
      const capabilitiesHealth = await page.evaluate(async () => {
        try {
          const value = await Promise.race([
            Promise.resolve().then(() => window.agent?.capabilities?.()),
            new Promise((_, reject) => setTimeout(
              () => reject(new Error('Teams QWork capabilities precheck timed out after 5000ms')),
              5000,
            )),
          ]);
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
        model_mode: modelReadback.mode,
        model_tier: modelReadback.tier,
        model_readback_source: modelReadback.source,
        capabilities_ipc: 'ready',
        stale_renderer_control_recovery: staleRendererControlRecovery,
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
      const canRecover = teamsPreconnectRecoveryAllowed({
        attempt,
        attempts,
        now: Date.now(),
        readyDeadline,
        recoveryCompleted,
      });
      if (recoveryCdpUrl && canRecover) {
        await resetConnection?.().catch(() => {});
        const recovery = await recoverTeamsQworkWorkbench(recoveryCdpUrl, {
          expectedUiUrl: expectedQworkUi?.url || '',
        }).catch((recoveryError) => ({
          recovered: false,
          reason: String(recoveryError?.message || recoveryError).split('\n')[0],
        }));
        if (recovery.recovered) {
          recoveryCompleted = true;
          readyDeadline = extendTeamsPreconnectDeadlineAfterRecovery(
            readyDeadline,
            Date.now(),
            Math.max(timeoutMs, Number(postRecoveryReadyMs) || 60_000),
          );
        }
        console.error(JSON.stringify({
          teams_casebook_preconnect_recovery: recovery.recovered ? 'ready' : 'skipped',
          attempt,
          reason: recovery.reason || '',
          post_recovery_ready_ms: recovery.recovered
            ? Math.max(timeoutMs, Number(postRecoveryReadyMs) || 60_000)
            : 0,
        }));
      }
      const canRetry = attempt < attempts && Date.now() < readyDeadline;
      if (canRetry) {
        await new Promise((resolve) => setTimeout(
          resolve,
          Math.min(retryDelayMs, Math.max(0, readyDeadline - Date.now())),
        ));
      }
    }
  }
  throw new Error(
    `360Teams QWork CDP preconnect failed after ${attemptsUsed} attempts / `
    + `${Date.now() - startedWaitingAt}ms: ${lastError?.message || lastError}`,
  );
}

export function resolveTeamsRecoveryQworkUi(
  expectedUiUrl,
  observedUiUrl,
  validationOptions = {},
) {
  const frozen = String(expectedUiUrl || '').trim();
  const observed = String(observedUiUrl || '').trim();
  if (!frozen && !observed) {
    throw new Error('QWork WebView is unavailable; pinned UI cannot be preserved.');
  }
  return validatePinnedQworkUiUrl(frozen || observed, validationOptions);
}

export async function recoverTeamsQworkWorkbench(cdpUrl, {
  settleMs = 8_000,
  expectedUiUrl = '',
} = {}) {
  const normalizedCdpUrl = normalizeCdpUrl(cdpUrl);
  const targetsResponse = await fetch(new URL('/json/list', normalizedCdpUrl), {
    signal: AbortSignal.timeout(5_000),
  });
  if (!targetsResponse.ok) {
    return { recovered: false, reason: `QWork CDP target discovery failed: HTTP ${targetsResponse.status}` };
  }
  const targets = await targetsResponse.json();
  const qworkTarget = Array.isArray(targets) ? targets.find((target) => (
    target?.type === 'webview'
    && (/^QWork$/i.test(String(target.title || ''))
      || /\/\.deepbank(?:-(?:dev|local|uat|sit))?\/ui\//.test(String(target.url || '')))
  )) : null;
  if (!qworkTarget?.url && !expectedUiUrl) {
    return { recovered: false, reason: 'QWork WebView is unavailable; pinned UI cannot be preserved.' };
  }
  // A renderer refresh may briefly expose the host's stale persisted URL. The
  // frozen run identity is authoritative once the Casebook run has started.
  const pinnedQworkUi = resolveTeamsRecoveryQworkUi(expectedUiUrl, qworkTarget?.url || '');
  const browser = await chromium.connectOverCDP(normalizedCdpUrl, { timeout: 10_000 });
  let browserClosed = false;
  try {
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
    let profileConfig = applyManagedQbotProfileConfig({
      profileDir: snapshot.profileDir,
      serverUrl: snapshot.controlPlane,
      uiUrl: pinnedQworkUi.url,
      backupFile: `${DEFAULT_SESSION}.qbot-profile-backup.json`,
    });
    const packagedControlPlaneOrigin = 'https://qbot-api.360shuke.com';
    const controlPlaneOrigin = new URL(snapshot.controlPlane).origin;
    let relaunched = null;
    let staged = null;
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      await launchLiveTeams({
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
      relaunched = await settleRelaunchedLiveTeamsSession(DEFAULT_SESSION);
      staged = await waitForStagedQbotServer(snapshot.profileDir, snapshot.controlPlane, 30_000);
      if (staged.ok) break;
      stopIsolatedTeams(DEFAULT_SESSION);
      if (attempt === 2) {
        return {
          recovered: false,
          reason: `Managed 360Teams self-relaunch changed the pinned control plane: expected=${staged.expected} actual=${staged.actual || 'missing'}`,
        };
      }
      profileConfig = applyManagedQbotProfileConfig({
        profileDir: snapshot.profileDir,
        serverUrl: snapshot.controlPlane,
        uiUrl: pinnedQworkUi.url,
        backupFile: `${DEFAULT_SESSION}.qbot-profile-backup.json`,
      });
    }
    await remountPinnedManagedQworkUi(relaunched.cdp_url, pinnedQworkUi.url, {
      timeoutMs: Math.max(120_000, settleMs),
      settleMs,
    });
    return {
      recovered: true,
      reason: `Managed 360Teams relaunched with pinned QWork ${pinnedQworkUi.version} (${profileConfig.mode}).`,
      cdpUrl: relaunched.cdp_url,
      qworkUiVersion: pinnedQworkUi.version,
    };
  } finally {
    if (!browserClosed) await browser.close().catch(() => {});
  }
}

export async function waitForManagedQworkUi(cdpUrl, expectedUiUrl, timeoutMs = 30_000) {
  const normalizedCdpUrl = normalizeCdpUrl(cdpUrl);
  const expected = validatePinnedQworkUiUrl(expectedUiUrl);
  const deadline = Date.now() + Math.max(1_000, Number(timeoutMs) || 30_000);
  let lastObserved = '';
  while (Date.now() < deadline) {
    try {
      const response = await fetch(new URL('/json/list', normalizedCdpUrl), {
        signal: AbortSignal.timeout(5_000),
      });
      if (response.ok) {
        const targets = await response.json();
        const qwork = (Array.isArray(targets) ? targets : []).find((target) => (
          target?.type === 'webview'
          && (/^QWork$/i.test(String(target.title || ''))
            || /\/\.deepbank(?:-(?:dev|local|uat|sit))?\/ui\//.test(String(target.url || '')))
        ));
        lastObserved = String(qwork?.url || '');
        if (lastObserved && new URL(lastObserved).href === expected.url) return expected;
      }
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(
    `Managed 360Teams did not remount pinned QWork ${expected.version}: `
    + `expected=${expected.url} actual=${lastObserved || 'missing'}`,
  );
}

export async function remountPinnedTeamsRendererInPlace({
  cdpUrl,
  expectedUiUrl,
  sessionFile = DEFAULT_SESSION,
  timeoutMs = 90_000,
} = {}, {
  remount = remountPinnedManagedQworkUi,
  readManagedSession = readSession,
  matchesManagedSession = processMatchesSession,
  validatePinnedUi = validatePinnedQworkUiUrl,
} = {}) {
  const upstreamCdpUrl = normalizeCdpUrl(cdpUrl);
  const expected = validatePinnedUi(expectedUiUrl);
  const before = readManagedSession(sessionFile);
  if (!before || before.profile_mode !== 'live' || !matchesManagedSession(before)) {
    throw new Error('Managed live 360Teams session is unavailable before in-place QWork remount.');
  }
  const beforePid = Number(before.pid);
  if (!Number.isInteger(beforePid) || beforePid <= 0) {
    throw new Error('Managed live 360Teams session has no valid host PID before in-place QWork remount.');
  }
  if (normalizeCdpUrl(before.cdp_url) !== upstreamCdpUrl) {
    throw new Error(
      `Managed 360Teams CDP changed before in-place QWork remount: `
      + `expected=${upstreamCdpUrl} actual=${before.cdp_url || 'missing'}`,
    );
  }

  const remounted = await remount(upstreamCdpUrl, expected.url, {
    timeoutMs: Math.max(10_000, Number(timeoutMs) || 90_000),
    settleMs: 3_000,
  });
  const after = readManagedSession(sessionFile);
  if (!after || after.profile_mode !== 'live' || !matchesManagedSession(after)) {
    throw new Error('Managed live 360Teams session became unavailable during in-place QWork remount.');
  }
  const afterPid = Number(after.pid);
  if (afterPid !== beforePid) {
    throw new Error(
      `Managed 360Teams host PID changed during renderer-only remount: before=${beforePid} after=${afterPid || 'missing'}`,
    );
  }
  if (normalizeCdpUrl(after.cdp_url) !== upstreamCdpUrl) {
    throw new Error(
      `Managed 360Teams CDP changed during renderer-only remount: `
      + `expected=${upstreamCdpUrl} actual=${after.cdp_url || 'missing'}`,
    );
  }
  const observed = validatePinnedUi(remounted?.qworkUiUrl || '');
  if (observed.url !== expected.url
    || remounted?.authenticated !== true
    || remounted?.capabilitiesReady !== true
    || remounted?.workbenchReady !== true) {
    throw new Error(
      `Pinned QWork renderer remount did not restore the frozen signed-in workbench: `
      + `expected=${expected.url} actual=${observed.url}`,
    );
  }
  return {
    schema_version: 'qbot-teams-in-place-pinned-renderer-remount/v1',
    valid: true,
    host_pid_before: beforePid,
    host_pid_after: afterPid,
    host_restarted: false,
    cdp_url: upstreamCdpUrl,
    qwork_ui_url: expected.url,
    qwork_ui_version: expected.version,
    remounted: remounted?.remounted === true,
    authenticated: true,
    capabilities_ready: true,
    workbench_ready: true,
  };
}

export function installTeamsPageGuards(page, { screenshotTimeoutMs = 15_000 } = {}) {
  if (!page || page.__teams360ScreenshotGuard) return page;
  const originalScreenshot = page.screenshot.bind(page);
  const sessionDetachTimeoutMs = Math.max(1, Math.min(5_000, Number(screenshotTimeoutMs) || 15_000));
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
        if (session?.detach) {
          await teamsOperationWithHardTimeout(
            Promise.resolve().then(() => session.detach()),
            sessionDetachTimeoutMs,
            'CDP screenshot session detach',
          ).catch((detachError) => {
            process.stderr.write(`[teams360-screenshot] ${String(detachError?.message || detachError)}\n`);
          });
        }
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
  createNewManagedOutputDirectory({ outDir: options.out, outputRoot: TEAMS_OUTPUT_ROOT });
  const originalConnectOverCDP = chromium.connectOverCDP;
  const callerManagedCdp = Boolean(options.cdp);
  let connection = await resolveTeamsCasebookConnection(options);
  options.cdp = connection.cdpUrl;
  const previousCwd = process.cwd();
  const maxRecoveryPasses = Math.max(0, Number(options['teams-recovery-passes'] || 20));
  const recoveryStarts = new Map();
  let summary = null;
  let recoveryPass = 0;
  let pinnedQworkUiUrl = String(options['qwork-ui-url'] || '').trim();
  let pinnedReleaseIdentityReadback = null;
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
        expectedQworkUiUrl: pinnedQworkUiUrl,
      });
      const runtimeIdentity = await configureTeamsFixtureRuntime(options, browser);
      pinnedQworkUiUrl = runtimeIdentity.qworkUiUrl;
      if (runtimeIdentity.releaseIdentityReadback) {
        if (pinnedReleaseIdentityReadback) {
          assertStableQworkReleaseIdentity(
            pinnedReleaseIdentityReadback,
            runtimeIdentity.releaseIdentityReadback,
            'Managed QWork startup release identity',
          );
        } else {
          pinnedReleaseIdentityReadback = runtimeIdentity.releaseIdentityReadback;
        }
      }
      pinManagedSessionControlPlane(options.session, runtimeIdentity.controlPlane);
      const persistRunMetadata = (identity = runtimeIdentity, phase = 'startup') => {
        const session = readSession(options.session);
        return writePinnedRunMetadata(options.out, buildTeamsRunMetadata({
          session,
          qworkUiUrl: identity.qworkUiUrl,
          controlPlane: identity.controlPlane,
          modelTier: options['model-tier'] || 'M3',
          timeoutMs: options['timeout-ms'] || 600000,
          caseIds: String(options.case || '').split(',').map((item) => item.trim()).filter(Boolean),
          casebookPath: options.casebook,
          frameworkRoot: ROOT,
          deepbankRoot: DEEPBANK_ROOT,
          releaseInputs: {
            backend_version: options['backend-version'] || process.env.QBOT_BACKEND_VERSION || '',
            prompt_policy_version: options['prompt-policy-version'] || process.env.QBOT_PROMPT_POLICY_VERSION || '',
            feature_flags_hash: options['feature-flags-hash'] || process.env.QBOT_FEATURE_FLAGS_HASH || '',
            qwork_ui_git_commit: options['qwork-ui-git-commit'] || process.env.QBOT_QWORK_UI_GIT_COMMIT || '',
            qwork_build_id: options['qwork-build-id'] || process.env.QBOT_QWORK_BUILD_ID || '',
            qwork_release_manifest_sha256: options['qwork-release-manifest-sha256'] || process.env.QBOT_QWORK_RELEASE_MANIFEST_SHA256 || '',
          },
          qworkReleaseIdentityReadback: identity.releaseIdentityReadback,
          releaseObservationPhase: phase,
        }));
      };
      persistRunMetadata(runtimeIdentity, 'startup');
      options['release-identity-check-hook'] = async ({ page, phase }) => {
        if (!pinnedReleaseIdentityReadback) return null;
        if (!page || page.isClosed()) {
          throw new Error(`Managed QWork ${phase || 'runtime'} release identity cannot be read: page closed.`);
        }
        const current = await observeQworkReleaseIdentity(page, page.url());
        assertStableQworkReleaseIdentity(
          pinnedReleaseIdentityReadback,
          current,
          `Managed QWork ${phase || 'runtime'} release identity`,
        );
        persistRunMetadata({
          ...runtimeIdentity,
          qworkUiUrl: page.url(),
          releaseIdentityReadback: current,
        }, phase || 'runtime');
        return current;
      };
      if (!callerManagedCdp) {
        options['restart-reconnect-hook'] = async () => {
          // A QWork reload may expose the host's stale persisted URL. Restore
          // the frozen renderer through the existing host WebView and reject
          // any host PID/CDP change before replacing the proxy.
          const rendererRemount = await remountPinnedTeamsRendererInPlace({
            cdpUrl: connection.upstreamCdpUrl || connection.cdpUrl,
            expectedUiUrl: runtimeIdentity.qworkUiUrl,
            sessionFile: options.session,
            timeoutMs: Number(options['restart-reconnect-timeout-ms'] || 90_000),
          });
          await connection.close().catch(() => {});
          connection = await resolveTeamsCasebookConnection({ ...options, cdp: undefined });
          options.cdp = connection.cdpUrl;
          options['teams-upstream-cdp-url'] = connection.upstreamCdpUrl || '';
          const nextBrowser = await connectTeamsCasebookBrowser(connection.cdpUrl, {
            recoveryCdpUrl: '',
            resetConnection: connection.reset,
            expectedQworkUiUrl: runtimeIdentity.qworkUiUrl,
          });
          const nextPage = nextBrowser.contexts().flatMap((context) => context.pages())
            .find((candidate) => /\/\.deepbank(?:-(?:dev|local|uat|sit))?\/ui\//.test(candidate.url()));
          if (!nextPage) {
            await nextBrowser.close().catch(() => {});
            throw new Error('Fresh Teams CDP proxy connected without a QWork page.');
          }
          const nextRuntimeIdentity = await configureTeamsFixtureRuntime(options, nextBrowser);
          if (pinnedReleaseIdentityReadback && nextRuntimeIdentity.releaseIdentityReadback) {
            assertStableQworkReleaseIdentity(
              pinnedReleaseIdentityReadback,
              nextRuntimeIdentity.releaseIdentityReadback,
              'Managed QWork replacement renderer release identity',
            );
          }
          pinManagedSessionControlPlane(options.session, nextRuntimeIdentity.controlPlane);
          persistRunMetadata(nextRuntimeIdentity, 'replacement-renderer');
          return {
            browser: nextBrowser,
            page: nextPage,
            cdpUrl: connection.cdpUrl,
            upstreamCdpUrl: connection.upstreamCdpUrl || '',
            rendererRemount,
          };
        };
      }
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

export function teamsCasebookExitCode(summary = {}) {
  const counts = summary?.counts || {};
  const planned = Number(summary?.result_accounting?.planned);
  const completed = Number(summary?.result_accounting?.completed ?? counts.total ?? 0);
  const incomplete = Number.isFinite(planned) && planned > 0 && completed < planned;
  const failed = Number(counts.failed || 0) > 0 || Number(counts.blocked || 0) > 0;
  return summary?.status === 'passed'
    && summary?.stopped !== true
    && !incomplete
    && !failed
    ? 0
    : 1;
}

function productionReleaseIdentityExpected(options = {}) {
  return {
    qwork_version: String(options['expected-qwork-version'] || '').trim(),
    prompt_policy_version: String(
      options['prompt-policy-version'] || process.env.QBOT_PROMPT_POLICY_VERSION || '',
    ).trim(),
    feature_flags_hash: String(
      options['feature-flags-hash'] || process.env.QBOT_FEATURE_FLAGS_HASH || '',
    ).trim(),
    qwork_ui_git_commit: String(
      options['qwork-ui-git-commit'] || process.env.QBOT_QWORK_UI_GIT_COMMIT || '',
    ).trim(),
    qwork_build_id: String(
      options['qwork-build-id'] || process.env.QBOT_QWORK_BUILD_ID || '',
    ).trim(),
    qwork_release_manifest_sha256: String(
      options['qwork-release-manifest-sha256']
        || process.env.QBOT_QWORK_RELEASE_MANIFEST_SHA256
        || '',
    ).trim(),
  };
}

async function observeQworkReleaseIdentity(page, qworkUiUrl) {
  const rawRuntimeReleaseStatus = await page.evaluate(async () => Promise.race([
    Promise.resolve().then(() => {
      if (typeof window.agent?.runtimeReleaseStatus !== 'function') {
        throw new Error('missing window.agent.runtimeReleaseStatus');
      }
      return window.agent.runtimeReleaseStatus();
    }),
    new Promise((_, reject) => setTimeout(
      () => reject(new Error('QWork runtimeReleaseStatus timed out after 5000ms')),
      5000,
    )),
  ]));
  return readQworkReleaseIdentity({
    qworkUiUrl,
    runtimeReleaseStatus: summarizeRuntimeReleaseStatus(rawRuntimeReleaseStatus),
  });
}

export async function configureTeamsFixtureRuntime(options, browser) {
  const page = browser.contexts().flatMap((context) => context.pages())
    .find((candidate) => /\/\.deepbank(?:-(?:dev|local|uat|sit))?\/ui\//.test(candidate.url()));
  if (!page) throw new Error('Cannot configure Teams fixture runtime without the QWork QBot page.');
  const qworkUiUrl = page.url();
  const requestedControlPlane = String(options['control-plane-url'] || '').trim();
  const observedControlPlane = String(await page.evaluate(() => (
    typeof process !== 'undefined'
      ? process.env.DEEPBANK_SERVER || process.env.QBOT_SERVER_URL || ''
      : ''
  ))).trim();
  if (
    requestedControlPlane
    && observedControlPlane
    && new URL(requestedControlPlane).origin !== new URL(observedControlPlane).origin
  ) {
    throw new Error(
      `Managed QWork control plane drift: requested=${new URL(requestedControlPlane).origin} `
      + `observed=${new URL(observedControlPlane).origin}`,
    );
  }
  const controlPlane = requestedControlPlane || observedControlPlane;
  const sessionFile = path.resolve(String(options.session || DEFAULT_SESSION));
  const session = readSession(sessionFile);
  const upstreamCdpUrl = String(session?.cdp_url || '').trim();
  if (upstreamCdpUrl) options['teams-upstream-cdp-url'] = upstreamCdpUrl;
  const teamsAppPath = String(session?.app_path || '').trim();
  if (teamsAppPath) options['teams-app-path'] = teamsAppPath;
  const managedLog = String(session?.process_log || managedTeamsProcessLog(sessionFile) || '').trim();
  if (managedLog) options['qbot-stderr-log'] = managedLog;
  applyTeamsFixtureOptions(options, controlPlane, qworkUiUrl);
  let releaseIdentityReadback = null;
  if (/^(?:1|true|yes)$/i.test(String(options['production-gate'] || ''))) {
    releaseIdentityReadback = await observeQworkReleaseIdentity(page, qworkUiUrl);
    const assessment = assessQworkReleaseIdentity(
      releaseIdentityReadback,
      {
        ...productionReleaseIdentityExpected(options),
        qwork_version: validatePinnedQworkUiUrl(qworkUiUrl).version,
      },
    );
    if (!assessment.ok) {
      throw new Error(
        `Managed QWork authoritative release identity failed: readback_ok=${assessment.readback_ok}; `
        + `mismatches=${JSON.stringify(assessment.mismatches)}; `
        + `errors=${JSON.stringify(releaseIdentityReadback.consistency?.errors || [])}`,
      );
    }
  }
  return { controlPlane, qworkUiUrl, releaseIdentityReadback };
}

export function pinManagedSessionControlPlane(sessionFile, controlPlane) {
  const file = path.resolve(String(sessionFile || DEFAULT_SESSION));
  const current = readSession(file);
  if (!current || current.profile_mode !== 'live') {
    throw new Error('Cannot pin control plane without a managed live 360Teams session.');
  }
  const origin = new URL(String(controlPlane || '')).origin;
  const currentOrigin = String(current.control_plane_origin || '').trim();
  if (currentOrigin === origin) return { file, origin, changed: false };
  if (currentOrigin) {
    throw new Error(
      `Managed 360Teams session control plane drift: pinned=${currentOrigin} observed=${origin}`,
    );
  }
  const next = {
    ...current,
    control_plane_origin: origin,
  };
  const temporary = `${file}.tmp-${process.pid}`;
  fs.writeFileSync(temporary, `${JSON.stringify(next, null, 2)}\n`, { mode: 0o600 });
  fs.renameSync(temporary, file);
  return { file, origin, changed: true };
}

function applyTeamsFixtureOptions(options, controlPlane, qworkUiUrl) {
  const normalized = String(controlPlane || '').trim();
  if (!normalized) throw new Error('QWork did not expose DEEPBANK_SERVER; fault fixtures cannot be restored safely.');
  if (!/\/\.deepbank(?:-(?:dev|local|uat|sit))?\/ui\/[^/]+\/index\.html(?:$|[?#])/.test(String(qworkUiUrl || ''))) {
    throw new Error('QWork did not expose a versioned UI URL; managed host relaunch is unsafe.');
  }
  const restartCapability = inspectManagedTeamsRestartCapability();
  if (!restartCapability.ok) {
    throw new Error(
      `Managed Teams restart capability unavailable: ${JSON.stringify(restartCapability)}`,
    );
  }
  fs.mkdirSync(TEAMS_CONTROL_PLANE_HOME, { recursive: true });
  options['control-plane-url'] = normalized;
  options['qwork-ui-url'] = String(qworkUiUrl || '').trim();
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
  }
  // Packaged QWork 0.0.11 authenticates through the Teams Lingxi bridge even
  // when DEEPBANK_E2E is enabled. Switching the whole host to a loopback
  // mock-auth control plane therefore strands the WebView on the login page.
  // Keep the external DEV control plane/login intact and inject deterministic
  // fixture behaviour at the renderer bridge. Host relaunch remains enabled
  // independently for cases that genuinely exercise restart semantics.
  options['renderer-control-adapter'] = 'teams360';
  options['qbot-root'] ||= DEEPBANK_ROOT;
  options['qbot-home'] ||= TEAMS_CONTROL_PLANE_HOME;
  options['restart-cwd'] = TEAMS_RUNTIME_ROOT;
  // A managed relaunch can legitimately consume the host launch (60s),
  // staged-control-plane (30s), signed QWork remount (120s), and rollback
  // windows. Keep the whole process group supervised instead of letting the
  // shared runner's legacy 180s shell timeout orphan a still-running relaunch.
  options['restart-timeout-ms'] ||= 480_000;
  options['restart-reconnect-timeout-ms'] ||= 90_000;
  options['restart-command'] = [
    restartCapability.entrypoint,
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
  try {
    const argv = process.argv.slice(2);
    const lock = executeUnderManagedRunnerLock({
      entrypoint: fileURLToPath(import.meta.url),
      argv,
      binding: { runner: 'teams-casebook', argv },
    });
    if (lock.reexecuted) process.exit(lock.status);
    const summary = await runTeamsCasebook(argv);
    // runTeamsCasebook has already restored cwd, closed its CDP proxy and
    // completed managed-host cleanup. Exit explicitly so stale HTTP keep-alive
    // handles cannot leave a completed runner looking alive to the monitor.
    process.exit(teamsCasebookExitCode(summary));
  } catch (error) {
    process.stderr.write(`${String(error?.stack || error?.message || error)}\n`);
    process.exit(1);
  }
}
