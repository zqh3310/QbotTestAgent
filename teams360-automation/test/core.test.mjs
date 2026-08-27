import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import test from 'node:test';
import vm from 'node:vm';
import {
  LIVE_PROFILE_ALIAS,
  PROJECT_ROOT,
  assertIsolatedProfile,
  normalizeCdpUrl,
  parseArgs,
  redactText,
  safeUrl,
  validatePinnedQworkUiUrl,
} from '../lib/config.mjs';
import {
  clearStaleChromiumSingletonLinks,
  ensureProfileAlias,
  managedControlPlaneOrigin,
  managedQbotLaunchArgs,
  managedTeamsEnvironment,
  managedTeamsProcessLog,
  matchesRelaunchedLiveSession,
  parseRunningTeamsMainProcesses,
} from '../lib/launcher.mjs';
import { isFullQbotProbe, scoreTargetProbe, selectBestTarget } from '../lib/targets.mjs';
import {
  assessRuntimeReleaseStatus,
  summarizePublicCapabilities,
  summarizeRuntimeReleaseStatus,
} from '../lib/cdp-webview.mjs';
import { sanitize } from '../lib/report.mjs';
import { qworkRuntimeBridgeSource, rewriteCdpPayload } from '../lib/cdp-webview-proxy.mjs';
import { managedQworkRuntimeActivationDecision } from '../lib/managed-qwork-ui.mjs';
import { pathInside, validateStrictReviewOverride } from '../lib/review-evidence.mjs';
import {
  assertRunMetadataHost,
  buildReleaseArtifactFingerprints,
  readMacAppBundleIdentity,
  writePinnedRunMetadata,
} from '../lib/run-metadata.mjs';
import { loadTrustedValidationSources } from '../lib/trusted-history.mjs';
import {
  applyManagedQbotProfileConfig,
  managedQworkReleaseEnv,
  stagedQbotServer,
} from '../lib/teams-profile-qbot-config.mjs';
import {
  configureTeamsFixtureRuntime,
  extendTeamsPreconnectDeadlineAfterRecovery,
  inspectManagedTeamsRestartCapability,
  installTeamsPageGuards,
  parseCasebookRunnerOptions,
  pinManagedSessionControlPlane,
  repairInterruptedTeamsProgress,
  remountPinnedTeamsRendererInPlace,
  resolveTeamsPreconnectModelMode,
  resolveTeamsRecoveryQworkUi,
  teamsPreconnectRecoveryAllowed,
  teamsCasebookExitCode,
  validateLiveCasebookSession,
  validateTeamsCasebookOptions,
} from '../lib/casebook-runner.mjs';
import {
  automationFixtureMarkerPattern,
  cleanSkillChipLabel,
  coreBetaActionStopsPlan,
  coreBetaPartialReplyReady,
  coreBetaSelectedCapabilityIdentities,
  coreBetaSkillSelectionReadbackMatches,
  coreBetaStoppedTurnTerminalEvidence,
  createTeamsConnectorFixtureController,
  createTeamsSkillFixtureController,
  selectTrustedActionScreenshot,
  unifiedConnectorModeApplied,
  workModeSelectionVerdict,
} from '../../src/lib/ui-agent-casebook-runner.mjs';
import {
  applyFailureOutcome,
  coreBetaMcpCrossSurfaceOutcome,
  coreBetaMcpCrossSurfaceReceiptEvidenceValid,
  coreBetaSelectedCapabilityIdentities as coreBetaV2SelectedCapabilityIdentities,
  installRendererControlAdapter as installCoreBetaV2RendererControlAdapter,
  installRendererControlAdapterWithRecovery,
  inspectRendererControlAdapterState,
} from '../../src/lib/ui-agent-casebook-runner-v2.mjs';

function listen(server, port = 0) {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => {
      server.off('error', reject);
      resolve(server.address().port);
    });
  });
}

function closeServer(server) {
  return new Promise((resolve) => server.close(() => resolve()));
}

function requestJson({ port, path: requestPath, headers = {}, body = '{}' }) {
  return new Promise((resolve, reject) => {
    const request = http.request({
      host: '127.0.0.1',
      port,
      path: requestPath,
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'content-length': String(Buffer.byteLength(body)),
        ...headers,
      },
    }, (response) => {
      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        resolve({ status: response.statusCode, body: JSON.parse(text || '{}') });
      });
    });
    request.on('error', reject);
    request.end(body);
  });
}

test('defaults stay inside the independent teams360 automation directory', () => {
  const options = parseArgs(['doctor']);
  assert.match(options.profileDir, /teams360-automation\/state\/profile$/);
  assert.match(options.outputDir, /teams360-automation\/output\//);
  assert.equal(options.openQbot, false);
  assert.equal(options.allowWrite, false);
});

test('launch-live uses the existing profile without accepting an override', () => {
  const options = parseArgs(['launch-live']);
  assert.equal(options.profileMode, 'live');
  assert.match(options.profileDir, /Library\/Application Support\/360Teams$/);
  assert.equal(options.profileAlias, LIVE_PROFILE_ALIAS);
  assert.throws(() => parseArgs(['launch-live', '--profile', '/tmp/other']), /not allowed/);
});

test('launch-live carries an explicit credential-free QBot control plane', () => {
  const url = 'https://deepbank-control-dev.sandbox.deepbank.daikuan.qihoo.net';
  const options = parseArgs(['launch-live', '--control-plane-url', url]);
  assert.equal(options.controlPlaneUrl, url);
  assert.deepEqual(options.environment, { DEEPBANK_SERVER: url });
  assert.throws(
    () => parseArgs(['launch-live', '--control-plane-url', 'https://user:secret@example.test']),
    /credential-free/,
  );
});

test('managed PROD relaunch persists the QBOT control plane in session identity', () => {
  assert.equal(
    managedControlPlaneOrigin({
      QBOT_SERVER_URL: 'https://qbot-api.360shuke.com/path',
    }),
    'https://qbot-api.360shuke.com',
  );
  assert.equal(
    managedControlPlaneOrigin({
      DEEPBANK_SERVER: 'https://dev.example.test/path',
      QBOT_SERVER_URL: 'https://qbot-api.360shuke.com',
    }),
    'https://dev.example.test',
  );
  assert.equal(managedControlPlaneOrigin({}), '');
});

test('relative output paths resolve from the QbotTestAgent root', () => {
  const options = parseArgs(['doctor', '--out', 'teams360-automation/output/example']);
  assert.equal(options.outputDir, path.join(PROJECT_ROOT, 'teams360-automation', 'output', 'example'));
});

test('managed QWork relaunch accepts only a ready versioned UI inside the runtime home', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'teams360-qwork-ui-'));
  const versionDir = path.join(root, 'ui', '0.0.6');
  fs.mkdirSync(versionDir, { recursive: true });
  fs.writeFileSync(path.join(versionDir, 'index.html'), '<!doctype html>');
  fs.writeFileSync(path.join(versionDir, '.installed.json'), JSON.stringify({ status: 'ready', version: '0.0.6' }));
  try {
    const pinned = validatePinnedQworkUiUrl(`file://${path.join(versionDir, 'index.html')}`, { runtimeHome: root });
    assert.equal(pinned.version, '0.0.6');
    assert.throws(
      () => validatePinnedQworkUiUrl('https://example.test/index.html', { runtimeHome: root }),
      /local file URL/,
    );
    assert.throws(
      () => validatePinnedQworkUiUrl('file:///tmp/index.html', { runtimeHome: root }),
      /must stay under/,
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('managed QWork recognizes release-isolated SIT runtime homes across target discovery and relaunch', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'teams360-qwork-release-home-'));
  const versionDir = path.join(home, '.deepbank-sit', 'ui', '0.1.2-sit.7');
  fs.mkdirSync(versionDir, { recursive: true });
  fs.writeFileSync(path.join(versionDir, 'index.html'), '<!doctype html>');
  fs.writeFileSync(path.join(versionDir, '.installed.json'), JSON.stringify({ status: 'ready', version: '0.1.2-sit.7' }));
  try {
    const pinned = validatePinnedQworkUiUrl(`file://${path.join(versionDir, 'index.html')}`, { homeDir: home });
    assert.equal(pinned.version, '0.1.2-sit.7');
    for (const file of [
      '../lib/cdp-webview.mjs',
      '../lib/cdp-webview-proxy.mjs',
      '../lib/casebook-runner.mjs',
      '../lib/relaunch-managed-host.mjs',
    ]) {
      const source = fs.readFileSync(new URL(file, import.meta.url), 'utf8');
      assert.match(source, /deepbank.*dev.*local.*uat.*sit/s);
    }
    const restart = fs.readFileSync(new URL('../runtime/scripts/restart-qbot-electron-control-plane.sh', import.meta.url), 'utf8');
    assert.match(restart, /deepbank\(-dev\|-local\|-uat\|-sit\)\?/);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('the live 360Teams profile is rejected', () => {
  const live = path.join(os.homedir(), 'Library', 'Application Support', '360Teams');
  assert.throws(() => assertIsolatedProfile(live), /live 360Teams profile/);
  assert.throws(() => assertIsolatedProfile(path.join(live, 'automation')), /live 360Teams profile/);
});

test('an isolated profile symlink cannot escape into the live profile', {
  skip: !fs.existsSync(path.join(os.homedir(), 'Library', 'Application Support', '360Teams')),
}, () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'teams360-profile-guard-'));
  const alias = path.join(root, 'profile');
  fs.symlinkSync(path.join(os.homedir(), 'Library', 'Application Support', '360Teams'), alias, 'dir');
  try {
    assert.throws(() => assertIsolatedProfile(alias), /live 360Teams profile/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('the live launcher owns and verifies its profile alias', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'teams360-live-alias-'));
  const profile = path.join(root, 'live');
  const alias = path.join(root, 'state', 'live-profile-alias');
  fs.mkdirSync(profile, { recursive: true });
  try {
    assert.equal(ensureProfileAlias({ profileDir: profile, aliasPath: alias }), alias);
    assert.equal(fs.realpathSync.native(alias), fs.realpathSync.native(profile));
    assert.equal(ensureProfileAlias({ profileDir: profile, aliasPath: alias }), alias);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('stale Chromium singleton recovery removes symlinks only', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'teams360-singleton-'));
  try {
    for (const name of ['SingletonLock', 'SingletonCookie', 'SingletonSocket']) {
      fs.symlinkSync(`stale-${name}`, path.join(root, name));
    }
    const removed = clearStaleChromiumSingletonLinks(root);
    assert.equal(removed.length, 3);
    assert.equal(fs.existsSync(path.join(root, 'SingletonLock')), false);
    fs.writeFileSync(path.join(root, 'SingletonLock'), 'unexpected');
    assert.throws(
      () => clearStaleChromiumSingletonLinks(root),
      /Refusing to remove non-symlink Chromium singleton entry/,
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('managed Teams child enables packaged QBot E2E bridges without mutating the parent', () => {
  const parent = { PATH: '/qa/bin', DEEPBANK_E2E: '0' };
  const child = managedTeamsEnvironment(parent);
  assert.equal(child.DEEPBANK_E2E, '1');
  assert.equal(child.PATH, '/qa/bin');
  assert.equal(parent.DEEPBANK_E2E, '0');
});

test('managed Teams child log stays beside the private session file', () => {
  const sessionFile = path.join('/tmp', 'qbot-teams-test', 'session.json');
  assert.equal(managedTeamsProcessLog(sessionFile), path.join('/tmp', 'qbot-teams-test', 'managed-360teams.log'));
});

test('CDP is restricted to loopback', () => {
  assert.equal(normalizeCdpUrl('9333'), 'http://127.0.0.1:9333');
  assert.equal(normalizeCdpUrl('http://localhost:9333/json/version'), 'http://localhost:9333');
  assert.throws(() => normalizeCdpUrl('http://10.0.0.8:9333'), /loopback/);
});

test('QBot runtime markers outrank generic Teams pages', () => {
  const generic = { url: 'https://im.360teams.com', title: '360Teams', markers: { teamsText: true } };
  const qbot = { url: 'file:///tmp/ui/index.html', title: 'QBot', surface: 'teams360', markers: { composer: true } };
  assert.ok(scoreTargetProbe(qbot) > scoreTargetProbe(generic));
  assert.equal(selectBestTarget([generic, qbot]).surface, 'teams360');
});

test('360Teams QR login is a host precondition, not a QBot target', () => {
  const login = { url: 'file:///teams/login.html', title: '360Teams', markers: { teamsHostLogin: true, teamsText: true } };
  assert.equal(scoreTargetProbe(login), 0);
});

test('360Teams copilot sender is only an entry, not a full QBot target', () => {
  const sender = {
    url: 'https://im.360teams.com/miniapps/deepbank/home/copilotSender',
    title: '360Teams',
    markers: { teamsQbotSender: true, composer: true },
  };
  assert.equal(isFullQbotProbe(sender), false);
});

test('the DeepBank quick chat WebView is not the full QWork QBot target', () => {
  const chat = {
    target_type: 'webview',
    url: 'https://im.360teams.com/miniapps/deepbank/home/chat/session-id',
    title: 'DeepBank',
    markers: { teamsQbotChat: true, composer: true },
  };
  assert.equal(isFullQbotProbe(chat), false);
});

test('only a bridged QWork QBot workbench is a full target', () => {
  const workbench = {
    target_type: 'webview',
    url: 'file:///Users/test/.deepbank/ui/0.0.4/index.html',
    title: 'qbot',
    surface: 'teams360-qwork-qbot',
    markers: { qbotLocalUi: true, qbotBridgeReady: true, qbotWorkbench: true, composer: true },
  };
  assert.equal(isFullQbotProbe(workbench), true);
  assert.ok(scoreTargetProbe(workbench) >= 300);
});

test('public capabilities pretest projection accepts only a structured bridge result', () => {
  const valid = summarizePublicCapabilities({
    selectedSkills: null,
    selectedConnectors: [],
    currentExpert: null,
  });
  assert.equal(valid.ok, true);
  assert.deepEqual(valid.selection_fields, {
    selectedSkills: true,
    selectedConnectors: true,
    currentExpert: true,
  });
  assert.equal(summarizePublicCapabilities(null).ok, false);
  assert.equal(summarizePublicCapabilities([]).ok, false);
  assert.equal(summarizePublicCapabilities('HTTP 500').ok, false);
});

test('runtime release pretest reports mismatched Teams host-core separately from release identity', () => {
  const matched = summarizeRuntimeReleaseStatus({
    releaseId: '0.1.4-sit.33',
    version: '0.1.4-sit.33',
    source: 'remote',
    updatePhase: 'idle',
    preparedRelease: null,
    hostCore: { version: '0.1.4-sit.33', source: 'remote', path: '/tmp/embed-host.cjs' },
    hostRuntimeCompatibility: {
      hostSource: 'remote',
      hostCoreVersion: '0.1.4-sit.33',
      runtimeReleaseId: '0.1.4-sit.33',
      runtimeVersion: '0.1.4-sit.33',
      versionsMatch: true,
    },
  });
  assert.equal(matched.ok, true);
  assert.deepEqual(assessRuntimeReleaseStatus(matched, '0.1.4-sit.33'), {
    ok: true,
    expected_version: '0.1.4-sit.33',
    release_identity_matches: true,
    host_runtime_compatible: true,
    update_activation_safe: true,
  });

  const mismatched = summarizeRuntimeReleaseStatus({
    releaseId: '0.1.4-sit.33',
    version: '0.1.4-sit.33',
    updatePhase: 'idle',
    preparedRelease: null,
    hostRuntimeCompatibility: {
      hostSource: 'remote',
      hostCoreVersion: '0.1.4-sit.32',
      runtimeReleaseId: '0.1.4-sit.33',
      runtimeVersion: '0.1.4-sit.33',
      versionsMatch: false,
    },
  });
  const verdict = assessRuntimeReleaseStatus(mismatched, '0.1.4-sit.33');
  assert.equal(verdict.release_identity_matches, true);
  assert.equal(verdict.host_runtime_compatible, false);
  assert.equal(verdict.update_activation_safe, true);
  assert.equal(verdict.ok, false);

  const pendingUpdate = summarizeRuntimeReleaseStatus({
    releaseId: '0.1.6-sit.3',
    version: '0.1.6-sit.3',
    updatePhase: 'restart-required',
    preparedRelease: {
      releaseId: '0.1.6-sit.4',
      version: '0.1.6-sit.4',
      commitId: '1695e76a',
      channel: 'stable',
    },
    hostRuntimeCompatibility: {
      hostSource: 'remote',
      hostCoreVersion: '0.1.6-sit.3',
      runtimeReleaseId: '0.1.6-sit.3',
      runtimeVersion: '0.1.6-sit.3',
      versionsMatch: true,
    },
  });
  assert.deepEqual(pendingUpdate.prepared_release, {
    release_id: '0.1.6-sit.4',
    version: '0.1.6-sit.4',
    commit_id: '1695e76a',
    channel: 'stable',
  });
  const pendingVerdict = assessRuntimeReleaseStatus(pendingUpdate, '0.1.6-sit.3');
  assert.equal(pendingVerdict.release_identity_matches, true);
  assert.equal(pendingVerdict.host_runtime_compatible, true);
  assert.equal(pendingVerdict.update_activation_safe, false);
  assert.equal(pendingVerdict.ok, false);

  const missingPreparedRelease = summarizeRuntimeReleaseStatus({
    releaseId: '0.1.6-sit.3',
    version: '0.1.6-sit.3',
    updatePhase: 'idle',
    hostRuntimeCompatibility: {
      hostSource: 'remote',
      hostCoreVersion: '0.1.6-sit.3',
      runtimeReleaseId: '0.1.6-sit.3',
      runtimeVersion: '0.1.6-sit.3',
      versionsMatch: true,
    },
  });
  assert.equal(missingPreparedRelease.prepared_release_present, false);
  assert.equal(missingPreparedRelease.prepared_release_valid, false);
  assert.equal(
    assessRuntimeReleaseStatus(missingPreparedRelease, '0.1.6-sit.3').update_activation_safe,
    false,
  );

  const malformedPreparedRelease = summarizeRuntimeReleaseStatus({
    releaseId: '0.1.6-sit.3',
    version: '0.1.6-sit.3',
    updatePhase: 'idle',
    preparedRelease: '0.1.6-sit.4',
    hostRuntimeCompatibility: {
      hostSource: 'remote',
      hostCoreVersion: '0.1.6-sit.3',
      runtimeReleaseId: '0.1.6-sit.3',
      runtimeVersion: '0.1.6-sit.3',
      versionsMatch: true,
    },
  });
  assert.equal(malformedPreparedRelease.prepared_release_present, true);
  assert.equal(malformedPreparedRelease.prepared_release_valid, false);
  assert.equal(
    assessRuntimeReleaseStatus(malformedPreparedRelease, '0.1.6-sit.3').update_activation_safe,
    false,
  );
  assert.equal(summarizeRuntimeReleaseStatus([]).ok, false);
});

test('reports and URLs redact credentials', () => {
  const secret = 'https://example.test/qbot?app_secret=abc123&access_token=def456';
  assert.equal(safeUrl(secret), 'https://example.test/qbot');
  const redacted = redactText('Bearer abc.def access_token=xyz app_secret=123');
  assert.doesNotMatch(redacted, /abc\.def|xyz|123/);
  const clean = sanitize({ nested: { value: secret }, bearer: 'Bearer token-value' });
  assert.doesNotMatch(JSON.stringify(clean), /abc123|def456|token-value/);
});

test('smoke write permission must be explicit', () => {
  const safe = parseArgs(['smoke']);
  const enabled = parseArgs(['smoke', '--allow-write', '--prompt', 'hello']);
  assert.equal(safe.allowWrite, false);
  assert.equal(enabled.allowWrite, true);
  assert.equal(enabled.prompt, 'hello');
});

test('only the 360Teams main process triggers the launch guard', () => {
  const executable = '/Applications/360Teams.app/Contents/MacOS/360Teams';
  const processes = parseRunningTeamsMainProcesses(`
  101 ${executable}
  102 ${executable} --user-data-dir=/tmp/teams-profile
  103 /Applications/360Teams.app/Contents/Frameworks/360Teams Helper.app/Contents/MacOS/360Teams Helper --type=renderer
  104 /bin/zsh -c rg 360Teams
`, executable);
  assert.deepEqual(processes.map((item) => item.pid), [101, 102]);
});

test('the CDP proxy exposes only the QWork QBot WebView as a page target', () => {
  const payload = {
    method: 'Target.targetCreated',
    params: {
      targetInfo: { type: 'webview', title: 'qbot', url: 'file:///Users/test/.deepbank/ui/0.0.4/index.html' },
    },
  };
  const rewritten = rewriteCdpPayload(payload);
  assert.equal(rewritten.params.targetInfo.type, 'page');
  assert.equal(payload.params.targetInfo.type, 'webview');
  assert.equal(rewriteCdpPayload({ type: 'webview', title: 'other', url: 'https://example.test' }).type, 'webview');
  assert.equal(rewriteCdpPayload({ targetId: 'host', type: 'page', title: '360Teams', url: 'https://host.test' }).type, 'other');
});

test('the CDP proxy leaves bridge injection to the post-connect wrapper', () => {
  const source = fs.readFileSync(new URL('../lib/cdp-webview-proxy.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /nextInjectionRequestId|injectQworkRuntimeBridge/);
  assert.match(source, /stabilizationDeadline = Date\.now\(\) \+ 3_000/);
  assert.match(source, /debugCdpMessage\('downstream', text, Date\.now\(\) < stabilizationDeadline\)/);
  const relayStart = source.indexOf('async function relayBrowserSocket');
  const downstreamListener = source.indexOf("downstream.on('message'", relayStart);
  const upstreamVersionLookup = source.indexOf("await fetchJson(new URL('/json/version'", relayStart);
  assert.ok(downstreamListener > relayStart && downstreamListener < upstreamVersionLookup,
    'the downstream listener must buffer Browser.getVersion before the async upstream lookup');
  assert.match(source.slice(relayStart), /else queued\.push\(text\)[\s\S]*for \(const data of queued\.splice\(0\)\) upstream\.send\(data\)/);
  const runner = fs.readFileSync(new URL('../lib/casebook-runner.mjs', import.meta.url), 'utf8');
  assert.match(runner, /await page\.evaluate\(qworkRuntimeBridgeSource\(\)\)/);
});

test('the Teams-only runtime bridge derives the selected model tier from visible QWork UI', () => {
  const source = qworkRuntimeBridgeSource();
  assert.match(source, /composer-safety-level-menu/);
  assert.match(source, /getConnectionView/);
  assert.match(source, /runtimeOptions/);
  assert.match(source, /teams360-qwork-ui/);
  assert.match(source, /matchingPlatformOption/);
  assert.match(source, /platformOptions\.length > 0/);
  assert.match(source, /\^M\[1-4\]\$\/\.test\(platformTier\)/);
  assert.match(source, /__teams360ConnectionViewBridge/);
  assert.match(source, /setInterval\(install, 250\)/);
  assert.match(source, /wrappedGetState/);
  assert.match(source, /session-item-/);
  assert.match(source, /bridge\.state/);
  assert.match(source, /bridge\.currentSession/);
  assert.match(source, /__teams360BridgeVersion/);
  assert.match(source, /clearInterval\(root\.__teams360ConnectionViewBridgeTimer\)/);
});

test('the Teams-only runtime bridge bounds a stalled QWork capabilities IPC call', () => {
  const source = qworkRuntimeBridgeSource();
  assert.match(source, /installAgentTimeoutGuards/);
  assert.match(source, /Teams QWork capabilities timed out after 5000ms/);
  assert.match(source, /agent\.capabilities = wrapped/);
  assert.match(source, /rendererControlWrapper = Boolean\(agent\.capabilities\.__qbotAutomationRendererControlWrapper\)/);
});

test('the Teams-only runtime bridge falls back to the visible context menu for session rename setup', () => {
  const source = qworkRuntimeBridgeSource();
  assert.match(source, /__teams360VisibleSessionRenameFallback/);
  assert.match(source, /addEventListener\('dblclick', handler, true\)/);
  assert.match(source, /new MouseEvent\('contextmenu'/);
  assert.match(source, /session-rename-action/);
  assert.doesNotMatch(source, /dispatchEvent\(new CustomEvent\('qbot-session-rename'/);
});

test('Teams screenshot guard falls back to CDP when web fonts never settle', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'teams360-shot-'));
  const screenshotPath = path.join(root, 'fallback.png');
  let detached = false;
  const page = {
    async screenshot(options) {
      assert.equal(options.timeout, 15_000);
      throw new Error('page.screenshot: Timeout 12000ms exceeded while waiting for fonts to load');
    },
    context() {
      return {
        async newCDPSession() {
          return {
            async send(method) {
              assert.equal(method, 'Page.captureScreenshot');
              return { data: Buffer.from('png-evidence').toString('base64') };
            },
            async detach() { detached = true; },
          };
        },
      };
    },
  };
  try {
    installTeamsPageGuards(page);
    const result = await page.screenshot({ path: screenshotPath, fullPage: true });
    assert.equal(result.toString(), 'png-evidence');
    assert.equal(fs.readFileSync(screenshotPath, 'utf8'), 'png-evidence');
    assert.equal(detached, true);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('Teams screenshot guard hard-times-out a screenshot promise that never settles', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'teams360-shot-hard-timeout-'));
  const screenshotPath = path.join(root, 'fallback.png');
  const page = {
    async screenshot() { return new Promise(() => {}); },
    context() {
      return {
        async newCDPSession() {
          return {
            async send() { return { data: Buffer.from('hard-timeout-evidence').toString('base64') }; },
            async detach() {},
          };
        },
      };
    },
  };
  try {
    const startedAt = Date.now();
    installTeamsPageGuards(page, { screenshotTimeoutMs: 20 });
    const result = await page.screenshot({ path: screenshotPath, fullPage: true });
    assert.equal(result.toString(), 'hard-timeout-evidence');
    assert.ok(Date.now() - startedAt < 500, 'the guard must not inherit an unbounded Playwright screenshot wait');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('Teams screenshot guard does not hang when fallback CDP session detach never settles', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'teams360-shot-detach-timeout-'));
  const screenshotPath = path.join(root, 'fallback.png');
  const page = {
    async screenshot() {
      throw new Error('page.screenshot: Timeout while waiting for fonts to load');
    },
    context() {
      return {
        async newCDPSession() {
          return {
            async send(method) {
              assert.equal(method, 'Page.captureScreenshot');
              return { data: Buffer.from('detach-timeout-evidence').toString('base64') };
            },
            async detach() { return new Promise(() => {}); },
          };
        },
      };
    },
  };
  try {
    const startedAt = Date.now();
    installTeamsPageGuards(page, { screenshotTimeoutMs: 20 });
    const result = await page.screenshot({ path: screenshotPath, fullPage: true });
    assert.equal(result.toString(), 'detach-timeout-evidence');
    assert.equal(fs.readFileSync(screenshotPath, 'utf8'), 'detach-timeout-evidence');
    assert.ok(Date.now() - startedAt < 500, 'fallback cleanup must not wait forever on CDP detach');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('the Teams Casebook wrapper keeps output isolated and rejects local-QBot restarts', () => {
  const options = parseCasebookRunnerOptions([
    '--casebook', 'PRD/cases.xlsx',
    '--case', 'SIT-HOME-001',
    '--cdp', 'http://127.0.0.1:58401',
    '--out', 'teams360-automation/output/test-run',
  ]);
  assert.equal(validateTeamsCasebookOptions(options), options);
  assert.throws(() => validateTeamsCasebookOptions({
    ...options,
    'restart-command': './restart-qbot-slim.sh',
  }), /must not configure/);
  assert.throws(() => validateTeamsCasebookOptions({
    ...options,
    out: 'autoTest/not-teams',
  }), /must stay under/);
  assert.throws(() => validateTeamsCasebookOptions({
    ...options,
    'resume-from': 'teams360-automation/output/old-run',
  }), /requires --impact-case or --impact-all/);
  assert.throws(() => validateTeamsCasebookOptions({
    ...options,
    'impact-case': 'SIT-HOME-001',
  }), /require --resume-from/);
  const productionCoreBetaOptions = parseCasebookRunnerOptions([
    '--casebook', 'PRD/cases.xlsx',
    '--case', 'BETA-INIT-001',
    '--out', 'teams360-automation/output/core-beta-production-run',
    '--production-gate', 'true',
  ]);
  assert.throws(
    () => validateTeamsCasebookOptions(productionCoreBetaOptions),
    /require --control-plane-url/,
  );
  productionCoreBetaOptions['control-plane-url'] = 'https://deepbank-control-uat.example.test/path';
  validateTeamsCasebookOptions(productionCoreBetaOptions);
  assert.equal(
    productionCoreBetaOptions['control-plane-url'],
    'https://deepbank-control-uat.example.test',
  );
  const previousNativeImeCommand = process.env.QBOT_CORE_BETA_NATIVE_IME_COMMAND;
  delete process.env.QBOT_CORE_BETA_NATIVE_IME_COMMAND;
  try {
    const imeOptions = parseCasebookRunnerOptions([
      '--casebook', 'PRD/cases.xlsx',
      '--case', 'BETA-CHAT-010,BETA-REC-001',
      '--out', 'teams360-automation/output/core-beta-ime-run',
      '--production-gate', 'true',
      '--control-plane-url', 'https://deepbank-control-uat.example.test',
    ]);
    assert.throws(
      () => validateTeamsCasebookOptions(imeOptions),
      /require --native-ime-command/,
    );
    imeOptions['native-ime-command'] = '/bin/true';
    assert.equal(validateTeamsCasebookOptions(imeOptions), imeOptions);
  } finally {
    if (previousNativeImeCommand == null) delete process.env.QBOT_CORE_BETA_NATIVE_IME_COMMAND;
    else process.env.QBOT_CORE_BETA_NATIVE_IME_COMMAND = previousNativeImeCommand;
  }
  const managedRestart = inspectManagedTeamsRestartCapability();
  assert.equal(managedRestart.ok, true);
  assert.equal(managedRestart.exists, true);
  assert.equal(managedRestart.executable, true);
  assert.equal(managedRestart.syntax_ok, true);
  assert.match(managedRestart.entrypoint, /restart-qbot-electron-control-plane\.sh$/);
  const cleanupOptions = parseCasebookRunnerOptions([
    '--casebook', 'PRD/cases.xlsx',
    '--case', 'BETA-SKILL-001',
    '--out', 'teams360-automation/output/cleanup-run',
    '--core-beta-cleanup-from', 'teams360-automation/output/frozen-run',
  ]);
  validateTeamsCasebookOptions(cleanupOptions);
  assert.equal(
    cleanupOptions['core-beta-cleanup-from'],
    path.join(PROJECT_ROOT, 'teams360-automation', 'output', 'frozen-run'),
  );
  const migrationCleanupOptions = parseCasebookRunnerOptions([
    '--casebook', 'PRD/cases.xlsx',
    '--case', 'BETA-SKILL-001',
    '--out', 'teams360-automation/output/migration-cleanup-run',
    '--core-beta-cleanup-from', 'teams360-automation/output/frozen-run',
    '--core-beta-cleanup-release-migration', 'true',
  ]);
  assert.equal(validateTeamsCasebookOptions(migrationCleanupOptions), migrationCleanupOptions);
  assert.throws(() => validateTeamsCasebookOptions({
    ...options,
    'core-beta-cleanup-release-migration': 'true',
  }), /requires --core-beta-cleanup-from/);
  assert.throws(() => validateTeamsCasebookOptions({
    ...cleanupOptions,
    'core-beta-cleanup-release-migration': 'false',
  }), /must be explicitly true/);
  assert.throws(() => validateTeamsCasebookOptions({
    ...cleanupOptions,
    'core-beta-cleanup-from': cleanupOptions.out,
  }), /must be a different frozen batch/);
  assert.throws(() => validateTeamsCasebookOptions({
    ...cleanupOptions,
    'resume-from': 'teams360-automation/output/old-run',
    'impact-all': 'true',
  }), /cannot be combined/);
});

test('Teams preconnect waits through a full managed-host QWork remount window', () => {
  const source = fs.readFileSync(new URL('../lib/casebook-runner.mjs', import.meta.url), 'utf8');
  assert.match(source, /attempts = 80/);
  assert.match(source, /readyTimeoutMs = 120_000/);
  assert.match(source, /let readyDeadline = startedWaitingAt \+ Math\.max/);
  assert.match(source, /attempt <= attempts && Date\.now\(\) < readyDeadline/);
  assert.match(source, /preconnect failed after \$\{attemptsUsed\} attempts/);
});

test('Teams preconnect re-verifies a recovered host after the original deadline expires', () => {
  assert.equal(
    extendTeamsPreconnectDeadlineAfterRecovery(10_000, 20_000, 60_000),
    80_000,
    'a completed recovery must receive one fresh bounded readiness window',
  );
  assert.equal(
    extendTeamsPreconnectDeadlineAfterRecovery(100_000, 20_000, 60_000),
    100_000,
    'recovery must not shorten an existing readiness window',
  );
  const source = fs.readFileSync(new URL('../lib/casebook-runner.mjs', import.meta.url), 'utf8');
  assert.match(source, /recovery\.recovered[\s\S]*extendTeamsPreconnectDeadlineAfterRecovery/);
  assert.match(source, /const canRetry = attempt < attempts && Date\.now\(\) < readyDeadline;[\s\S]*if \(canRetry\)/);
});

test('Teams preconnect does not relaunch a host again after one completed recovery', () => {
  const base = {
    attempt: 2,
    attempts: 80,
    now: 20_000,
    readyDeadline: 80_000,
  };
  assert.equal(teamsPreconnectRecoveryAllowed(base), true);
  assert.equal(teamsPreconnectRecoveryAllowed({ ...base, recoveryCompleted: true }), false);
  assert.equal(teamsPreconnectRecoveryAllowed({ ...base, attempt: 80 }), false);
  assert.equal(teamsPreconnectRecoveryAllowed({ ...base, now: 80_000 }), false);
  const source = fs.readFileSync(new URL('../lib/casebook-runner.mjs', import.meta.url), 'utf8');
  assert.match(source, /let recoveryCompleted = false/);
  assert.match(source, /if \(recovery\.recovered\) \{\s+recoveryCompleted = true;/);
});

test('Teams preconnect accepts visible Auto as readiness without claiming M3 evidence', () => {
  assert.deepEqual(resolveTeamsPreconnectModelMode({
    selectedTier: 'M3',
    controlTier: 'auto',
    controlText: 'Auto',
    controlVisible: true,
  }), {
    ready: true,
    mode: 'AUTO',
    tier: '',
    source: 'visible-control',
  });
  assert.deepEqual(resolveTeamsPreconnectModelMode({
    controlTier: 'M3',
    controlText: '高安全',
    controlVisible: true,
  }), {
    ready: true,
    mode: 'M3',
    tier: 'M3',
    source: 'visible-control',
  });
  assert.deepEqual(resolveTeamsPreconnectModelMode({
    selectedTier: 'm3',
  }), {
    ready: true,
    mode: 'M3',
    tier: 'M3',
    source: 'connection-view',
  });
  assert.equal(resolveTeamsPreconnectModelMode({
    controlText: '选择模型',
    controlVisible: true,
  }).ready, false);
});

test('Teams recovery keeps the frozen QWork release when the refreshed renderer exposes an uninstalled stale pin', () => {
  const runtimeHome = fs.mkdtempSync(path.join(os.tmpdir(), 'qbot-teams-frozen-qwork-'));
  const expectedDir = path.join(runtimeHome, 'ui', '0.0.30-rc.1');
  const staleDir = path.join(runtimeHome, 'ui', '0.0.29');
  fs.mkdirSync(expectedDir, { recursive: true });
  fs.mkdirSync(staleDir, { recursive: true });
  fs.writeFileSync(path.join(expectedDir, 'index.html'), '<!doctype html>');
  fs.writeFileSync(path.join(expectedDir, '.installed.json'), JSON.stringify({
    status: 'ready',
    version: '0.0.30-rc.1',
  }));
  const expectedUrl = pathToFileURL(path.join(expectedDir, 'index.html')).href;
  const staleUrl = pathToFileURL(path.join(staleDir, 'index.html')).href;
  try {
    const selected = resolveTeamsRecoveryQworkUi(expectedUrl, staleUrl, { runtimeHome });
    assert.equal(selected.version, '0.0.30-rc.1');
    assert.equal(selected.url, expectedUrl);
    assert.throws(
      () => resolveTeamsRecoveryQworkUi('', staleUrl, { runtimeHome }),
      /0\.0\.29 is not fully installed/,
    );
  } finally {
    fs.rmSync(runtimeHome, { recursive: true, force: true });
  }
});

test('Teams fixture runtime restores the packaged host and keeps the local-QBot lane untouched', async () => {
  const page = {
    url: () => 'file:///Users/test/.deepbank/ui/0.0.4/index.html',
    evaluate: async () => 'https://qbot-api.360shuke.com',
  };
  const browser = { contexts: () => [{ pages: () => [page] }] };
  const options = {};
  await configureTeamsFixtureRuntime(options, browser);
  assert.equal(options['control-plane-url'], 'https://qbot-api.360shuke.com');
  assert.equal(options['renderer-control-adapter'], 'teams360');
  assert.match(options['qbot-root'], /(?:\/deepbankV2|\.runtime\/deepbankV2-main-)/);
  assert.match(options['qbot-home'], /teams360-automation\/state\/control-plane-home$/);
  assert.match(options['restart-cwd'], /teams360-automation\/runtime$/);
  assert.match(options['restart-command'], /teams360-automation\/runtime\/scripts\/restart-qbot-electron-control-plane\.sh/);
  assert.match(options['restart-command'], /file:\/\/\/Users\/test\/\.deepbank\/ui\/0\.0\.4\/index\.html/);
  assert.doesNotMatch(options['restart-command'], /restart-qbot-slim\.sh/);
  assert.equal(options['restart-timeout-ms'], 480_000);
  assert.equal(options['restart-reconnect-timeout-ms'], 90_000);
  assert.match(options['qbot-stderr-log'], /teams360-automation\/state\/managed-360teams\.log$/);
});

test('Teams fixture runtime rejects renderer control-plane drift before Case execution', async () => {
  const page = {
    url: () => 'file:///Users/test/.deepbank/ui/0.0.30/index.html',
    evaluate: async () => 'https://qbot-api.360shuke.com',
  };
  const browser = { contexts: () => [{ pages: () => [page] }] };
  await assert.rejects(
    configureTeamsFixtureRuntime({
      'control-plane-url': 'https://deepbank-control-uat.example.test',
    }, browser),
    /Managed QWork control plane drift/,
  );
});

test('managed session pins the observed external control plane for scoped host relaunch rollback', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'teams-session-control-plane-'));
  const sessionFile = path.join(root, 'session.json');
  fs.writeFileSync(sessionFile, JSON.stringify({
    schema_version: 1,
    profile_mode: 'live',
    profile_dir: '/tmp/profile',
    profile_alias: '/tmp/profile-alias',
    port: 55960,
    control_plane_origin: '',
  }));
  try {
    const first = pinManagedSessionControlPlane(
      sessionFile,
      'https://deepbank-control-dev.sandbox.deepbank.daikuan.qihoo.net/path',
    );
    assert.equal(first.changed, true);
    assert.equal(
      JSON.parse(fs.readFileSync(sessionFile, 'utf8')).control_plane_origin,
      'https://deepbank-control-dev.sandbox.deepbank.daikuan.qihoo.net',
    );
    const second = pinManagedSessionControlPlane(
      sessionFile,
      'https://deepbank-control-dev.sandbox.deepbank.daikuan.qihoo.net',
    );
    assert.equal(second.changed, false);
    assert.throws(
      () => pinManagedSessionControlPlane(sessionFile, 'https://qbot-api.360shuke.com'),
      /session control plane drift/,
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('trusted action evidence may equal the settled final frame but not the pre-action frame', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'teams-action-evidence-'));
  const before = path.join(root, 'before.png');
  const action = path.join(root, 'action.png');
  const final = path.join(root, 'final.png');
  fs.writeFileSync(before, 'before-state');
  fs.writeFileSync(action, 'settled-action-state');
  fs.writeFileSync(final, 'settled-action-state');
  try {
    const entries = [
      ['before', before],
      ['runtime_action', action],
      ['final', final],
    ];
    assert.deepEqual(
      selectTrustedActionScreenshot(entries, entries[0], entries[2]),
      entries[1],
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('trusted action evidence accepts an explicitly named stable observation but rejects a duplicate mutable action', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'teams-stable-observation-evidence-'));
  const before = path.join(root, 'before.png');
  const observation = path.join(root, 'observation.png');
  const duplicateAction = path.join(root, 'action.png');
  const final = path.join(root, 'final.png');
  fs.writeFileSync(before, 'stable-state');
  fs.writeFileSync(observation, 'stable-state');
  fs.writeFileSync(duplicateAction, 'stable-state');
  fs.writeFileSync(final, 'stable-state');
  try {
    const observationEntries = [
      ['before', before],
      ['auth_observation', observation],
      ['final', final],
    ];
    assert.deepEqual(
      selectTrustedActionScreenshot(observationEntries, observationEntries[0], observationEntries[2]),
      observationEntries[1],
    );
    const mutableEntries = [
      ['before', before],
      ['after_send', duplicateAction],
      ['final', final],
    ];
    assert.equal(
      selectTrustedActionScreenshot(mutableEntries, mutableEntries[0], mutableEntries[2]),
      null,
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('Teams fixture runtime can opt into the host-relaunch lane for real fixture servers', async () => {
  const page = {
    url: () => 'file:///Users/test/.deepbank/ui/0.0.6/index.html',
    evaluate: async () => 'https://qbot-api.360shuke.com',
  };
  const browser = { contexts: () => [{ pages: () => [page] }] };
  const options = { 'teams-fixture-host-relaunch': 'true' };
  await configureTeamsFixtureRuntime(options, browser);
  assert.equal(options['renderer-control-adapter'], 'teams360');
  assert.match(options['restart-command'], /restart-qbot-electron-control-plane\.sh/);
});

test('Teams fixture runtime keeps host relaunch support while fixture data uses the authenticated renderer bridge', async () => {
  const page = {
    url: () => 'file:///Users/test/.deepbank/ui/0.0.8/index.html',
    evaluate: async () => 'https://qbot-api.360shuke.com',
  };
  const browser = { contexts: () => [{ pages: () => [page] }] };
  const options = { case: 'SIT-SKILL-011,SIT-SKILL-020,SIT-SKILL-026,SIT-SKILL-027,SIT-CONN-013,SIT-SKILL-SCOPE-001,SIT-TEAMS-DOC-001,SIT-HITL-002' };
  await configureTeamsFixtureRuntime(options, browser);
  assert.equal(options['teams-fixture-host-relaunch'], 'true');
  assert.equal(options['renderer-control-adapter'], 'teams360');
});

test('Teams runtime ships the complete SkillHub regression fixture set', () => {
  const runtimeManifest = JSON.parse(fs.readFileSync(new URL('../runtime/testfixtures/skillhub-regression/manifest.json', import.meta.url), 'utf8'));
  const slugs = runtimeManifest.skills.map((item) => item.slug);
  assert.equal(slugs.length, 21);
  assert.equal(new Set(slugs).size, 21);
  for (const required of [
    'qa-scope-isolation',
    'qa-install-rejected-visible',
    'qa-auto-declared',
    'qa-materialization-pending',
    'qa-install-dedupe',
    'qa-python-runtime',
    'qa-node-runtime',
  ]) {
    assert.ok(slugs.includes(required), `Teams runtime missing fixture: ${required}`);
  }
});

test('Teams full profile keeps restart coverage and the authenticated renderer fixture bridge', async () => {
  const page = {
    url: () => 'file:///Users/test/.deepbank/ui/0.0.8/index.html',
    evaluate: async () => 'https://qbot-api.360shuke.com',
  };
  const browser = { contexts: () => [{ pages: () => [page] }] };
  const options = { profile: 'full' };
  await configureTeamsFixtureRuntime(options, browser);
  assert.equal(options['teams-fixture-host-relaunch'], 'true');
  assert.equal(options['renderer-control-adapter'], 'teams360');
});

test('Teams stateful SkillHub fixture handles dependencies and materialization without host auth drift', async () => {
  const fixture = JSON.parse(fs.readFileSync(new URL('../runtime/testfixtures/skillhub-regression/manifest.json', import.meta.url), 'utf8'));
  const controller = createTeamsSkillFixtureController(fixture.skills);
  const catalog = await controller.handle({ name: 'getSkillsCatalog', args: ['qa-dep-root'] });
  assert.equal(catalog.handled, true);
  assert.ok(catalog.result.market.length >= 3);
  assert.ok(catalog.result.market.some((item) => item.slug === 'qa-dep-root-success'));
  assert.ok(catalog.result.market.some((item) => item.slug === 'qa-dep-root-failure'));

  const cascade = await controller.handle({ name: 'installSkill', args: [{ slug: 'qa-dep-root-success' }] });
  assert.equal(cascade.result.ok, true);
  assert.match(cascade.result.msg, /并级联安装依赖/);
  assert.deepEqual(
    new Set(controller.snapshot().installed.map((item) => item.slug)),
    new Set(['qa-dep-root-success', 'qa-dep-leaf-a', 'qa-dep-leaf-b']),
  );

  const dependencyFailure = await controller.handle({ name: 'installSkill', args: ['qa-dep-root-failure'] });
  assert.equal(dependencyFailure.result.ok, false);
  assert.match(dependencyFailure.result.msg, /依赖技能 qa-dep-leaf-failure 安装失败，主技能未安装/);
  assert.equal(controller.snapshot().installed.some((item) => item.slug === 'qa-dep-root-failure'), false);

  const pending = await controller.handle({ name: 'installSkill', args: ['qa-materialization-pending'] });
  assert.equal(pending.result.ok, true);
  assert.equal(
    controller.snapshot().installed.find((item) => item.slug === 'qa-materialization-pending')?.localReadiness?.status,
    'pending_materialization',
  );
  const reconciled = await controller.handle({ name: 'reconcileSkills', args: [] });
  assert.deepEqual(reconciled.result.materialized.map((item) => item.slug), ['qa-materialization-pending']);
  assert.ok(reconciled.result.ready.some((item) => item.slug === 'qa-materialization-pending'));
  assert.ok(reconciled.result.ready.every((item) => item.runtimeName && item.localReadiness?.status === 'ready_on_this_process'));
  assert.equal(
    controller.snapshot().installed.find((item) => item.slug === 'qa-materialization-pending')?.localReadiness?.status,
    'ready_on_this_process',
  );
});

function contextBridgeLikeRendererPage({ replaceableAgent = true } = {}) {
  const context = vm.createContext({
    clearTimeout,
    console,
    setTimeout,
    structuredClone,
  });
  vm.runInContext(`
    const originalAgent = Object.freeze({
      getSkillsCatalog: async () => ({ installed: [], market: [{ slug: 'real-sit-skill' }] }),
      installSkill: async () => ({ ok: true, source: 'real-sit' }),
      uninstallSkill: async () => ({ ok: true, source: 'real-sit' }),
      updateSkill: async () => ({ ok: true, source: 'real-sit' }),
      revertSkill: async () => ({ ok: true, source: 'real-sit' }),
      reconcileSkills: async () => ({ ok: true, source: 'real-sit' }),
    });
    Object.defineProperty(globalThis, 'agent', {
      value: originalAgent,
      configurable: ${replaceableAgent ? 'true' : 'false'},
      enumerable: true,
      writable: ${replaceableAgent ? 'true' : 'false'},
    });
    globalThis.__testOriginalAgent = originalAgent;
  `, context);
  return {
    __context: context,
    async exposeFunction(name, callback) {
      Object.defineProperty(context, name, {
        value: callback,
        configurable: true,
        writable: true,
      });
    },
    async evaluate(callback, argument) {
      context.__evaluateArgument = argument;
      try {
        return await vm.runInContext(`(${callback.toString()})(globalThis.__evaluateArgument)`, context);
      } finally {
        delete context.__evaluateArgument;
      }
    },
  };
}

function skillLifecycleRendererRules() {
  return [
    ['GET', '/api/skills/catalog'],
    ['POST', '/api/skills/install'],
    ['POST', '/api/skills/uninstall'],
    ['POST', '/api/skills/update'],
    ['POST', '/api/skills/revert'],
    ['POST', '/api/skills/reconcile'],
  ].map(([method, pathExact]) => ({
    id: `test-${pathExact.split('/').at(-1)}`,
    method,
    pathExact,
    mode: 'node-handler',
  }));
}

function skillLifecycleProbeCalls() {
  return [
    { name: 'getSkillsCatalog', args: ['__probe__'] },
    { name: 'installSkill', args: ['__probe_missing__'] },
    { name: 'uninstallSkill', args: ['__probe_missing__'] },
    { name: 'updateSkill', args: ['__probe_missing__'] },
    { name: 'revertSkill', args: ['__probe_missing__', '0.0.0-probe'] },
    { name: 'reconcileSkills', args: [] },
  ];
}

test('Core Beta v2 renderer adapter replaces a frozen contextBridge-like agent with a verified facade', async () => {
  const fixture = JSON.parse(fs.readFileSync(new URL('../runtime/testfixtures/skillhub-regression/manifest.json', import.meta.url), 'utf8'));
  const controller = createTeamsSkillFixtureController(fixture.skills);
  const page = contextBridgeLikeRendererPage();
  const adapter = await installCoreBetaV2RendererControlAdapter({
    page,
    rules: skillLifecycleRendererRules(),
    initiallyArmed: true,
    handler: controller.handle,
  });
  assert.equal(adapter.bindingReport.ok, true);
  assert.equal(adapter.bindingReport.strategy, 'facade');
  assert.equal(adapter.bindingReport.original_agent_frozen, true);
  assert.deepEqual(
    [...adapter.bindingReport.bound_methods],
    ['getSkillsCatalog', 'installSkill', 'uninstallSkill', 'updateSkill', 'revertSkill', 'reconcileSkills'],
  );

  const calls = skillLifecycleProbeCalls();
  const probe = await adapter.probe(calls);
  assert.equal(probe.ok, true);
  assert.deepEqual(
    controller.snapshot().events.map((event) => event.name),
    calls.map((item) => item.name),
  );
  assert.equal(
    await page.evaluate(() => globalThis.agent === globalThis.__testOriginalAgent),
    false,
  );
  await adapter.close();
  assert.equal(
    await page.evaluate(() => globalThis.agent === globalThis.__testOriginalAgent),
    true,
  );
});

test('Core Beta v2 renderer adapter fails closed when neither methods nor the global agent can be replaced', async () => {
  const fixture = JSON.parse(fs.readFileSync(new URL('../runtime/testfixtures/skillhub-regression/manifest.json', import.meta.url), 'utf8'));
  const controller = createTeamsSkillFixtureController(fixture.skills);
  const page = contextBridgeLikeRendererPage({ replaceableAgent: false });
  await assert.rejects(
    installCoreBetaV2RendererControlAdapter({
      page,
      rules: skillLifecycleRendererRules(),
      initiallyArmed: true,
      handler: controller.handle,
    }),
    /did not intercept required window\.agent methods/,
  );
  assert.deepEqual(controller.snapshot().events, []);
});

test('Core Beta v2 renderer adapter performs one clean rebind after a transient lifecycle binding failure', async () => {
  const fixture = JSON.parse(fs.readFileSync(new URL('../runtime/testfixtures/skillhub-regression/manifest.json', import.meta.url), 'utf8'));
  const controller = createTeamsSkillFixtureController(fixture.skills);
  const page = contextBridgeLikeRendererPage();
  let calls = 0;
  const handler = async (call) => {
    calls += 1;
    if (calls <= skillLifecycleProbeCalls().length) return { handled: false };
    return controller.handle(call);
  };
  const verified = await installRendererControlAdapterWithRecovery({
    page,
    rules: skillLifecycleRendererRules(),
    initiallyArmed: true,
    handler,
    probeCalls: skillLifecycleProbeCalls(),
    readProbeEvents: () => controller.snapshot().events,
    clearProbeEvents: () => controller.clearEvents(),
    maxAttempts: 2,
  });
  assert.equal(verified.ok, true);
  assert.equal(verified.recovered, true);
  assert.equal(verified.attempts.length, 2);
  assert.equal(verified.attempts[0].lifecycle_bound, false);
  assert.equal(verified.attempts[0].retry_eligible, true);
  assert.equal(verified.attempts[1].lifecycle_bound, true);
  assert.deepEqual(
    verified.observed_probe_names,
    skillLifecycleProbeCalls().map((item) => item.name),
  );
  assert.equal((await inspectRendererControlAdapterState(page)).node_registry_count, 1);
  await verified.adapter.close();
  assert.equal((await inspectRendererControlAdapterState(page)).node_registry_count, 0);
});

test('Core Beta v2 renderer adapter persistent lifecycle failure stays fail-closed with two complete diagnostics', async () => {
  const page = contextBridgeLikeRendererPage();
  const verified = await installRendererControlAdapterWithRecovery({
    page,
    rules: skillLifecycleRendererRules(),
    initiallyArmed: true,
    handler: async () => ({ handled: false }),
    probeCalls: skillLifecycleProbeCalls(),
    readProbeEvents: () => [],
    clearProbeEvents: () => {},
    maxAttempts: 2,
  });
  assert.equal(verified.ok, false);
  assert.equal(verified.attempts.length, 2);
  for (const [index, attempt] of verified.attempts.entries()) {
    assert.equal(attempt.attempt, index + 1);
    assert.equal(attempt.lifecycle_bound, false);
    assert.ok(attempt.before);
    assert.ok(attempt.after);
    assert.match(attempt.error.message, /lifecycle probe did not reach controller/);
  }
  assert.equal((await inspectRendererControlAdapterState(page)).node_registry_count, 0);
  assert.equal(
    await page.evaluate(() => globalThis.agent === globalThis.__testOriginalAgent),
    true,
  );
});

test('Core Beta v2 renderer adapter does not clean-rebind over another active Case adapter', async () => {
  const page = contextBridgeLikeRendererPage();
  const existing = await installCoreBetaV2RendererControlAdapter({
    page,
    rules: skillLifecycleRendererRules(),
    initiallyArmed: false,
    handler: async () => ({ handled: false }),
  });
  const verified = await installRendererControlAdapterWithRecovery({
    page,
    rules: skillLifecycleRendererRules(),
    initiallyArmed: true,
    handler: async () => ({ handled: false }),
    probeCalls: skillLifecycleProbeCalls(),
    readProbeEvents: () => [],
    clearProbeEvents: () => {},
    maxAttempts: 2,
  });
  assert.equal(verified.ok, false);
  assert.equal(verified.attempts.length, 1);
  assert.equal(verified.attempts[0].retry_eligible, false);
  assert.equal(verified.attempts[0].after.node_registry_count, 1);
  assert.equal((await inspectRendererControlAdapterState(page)).node_registry_count, 1);
  await existing.close();
  assert.equal((await inspectRendererControlAdapterState(page)).node_registry_count, 0);
});

test('Core Beta v2 exact early automation failure is not overwritten by generic manifest reporting', () => {
  const state = {};
  applyFailureOutcome(
    state,
    'SIT-SKILL-026 renderer adapter lifecycle probe observed no controller events',
    'automation_error',
    { source: 'renderer_adapter_setup' },
  );
  applyFailureOutcome(
    state,
    'Core Beta v2 evidence manifest is incomplete',
    'automation_error',
    { source: 'finish_case' },
  );
  assert.equal(state.result_category, 'automation_error');
  assert.equal(
    state.actual_result,
    'SIT-SKILL-026 renderer adapter lifecycle probe observed no controller events',
  );
  assert.equal(state.primary_failure.source, 'renderer_adapter_setup');
  assert.equal(state.failure_history.length, 2);
});

test('Teams stateful connector fixture exposes deterministic healthy, unreachable, and needs-auth states', async () => {
  const controller = createTeamsConnectorFixtureController();
  const snapshot = controller.snapshot();
  assert.equal(snapshot.connectors.length, 3);
  assert.deepEqual(
    new Set(snapshot.connectors.map((item) => item.key)),
    new Set(['platform:dev_healthy', 'platform:dev_unreachable', 'platform:dev_needs_auth']),
  );

  const catalog = await controller.handle({ name: 'getConnectorCatalog', args: [{ forceRefresh: true }] });
  assert.equal(catalog.handled, true);
  assert.equal(catalog.result.connectors.length, 3);
  assert.equal(
    catalog.result.connectors.find((item) => item.key === 'platform:dev_needs_auth')?.statusKind,
    'needs_auth',
  );

  const health = await controller.handle({ name: 'getConnectorHealth', args: [] });
  assert.equal(health.handled, true);
  assert.equal(
    health.result.find((item) => item.connectorKey === 'platform:dev_unreachable')?.status,
    'unreachable',
  );

  const rechecked = await controller.handle({ name: 'recheckConnector', args: ['dev_unreachable'] });
  assert.equal(rechecked.handled, true);
  assert.equal(rechecked.result.ok, true);
  assert.equal(rechecked.result.row.status, 'unreachable');

  const reconciled = await controller.handle({ name: 'reconcileConnectorHealth', args: [] });
  assert.equal(reconciled.result.ok, true);
  assert.equal(reconciled.result.health.length, 3);
  assert.deepEqual(
    controller.snapshot().events.map((event) => event.name),
    ['getConnectorCatalog', 'getConnectorHealth', 'recheckConnector', 'reconcileConnectorHealth'],
  );
});

test('Teams fixture lookup matches immutable slugs and human-readable packaged QWork titles', () => {
  const pattern = automationFixtureMarkerPattern('qa-python-runtime');
  assert.match('QA Python Runtime', pattern);
  assert.match('qa-python-runtime', pattern);
  assert.doesNotMatch('QA Node Runtime', pattern);
});

test('Teams multi-skill selection reopens the packaged unified menu after each picked skill', () => {
  const source = fs.readFileSync(new URL('../../src/lib/ui-agent-casebook-runner.mjs', import.meta.url), 'utf8');
  assert.match(source, /重新打开【技能】菜单以选择：\$\{expectedLabel\}/);
  assert.match(source, /menu = await activeMenuLocator\(page, 'skill'\)/);
  assert.equal(cleanSkillChipLabel('×QA Python Runtime'), 'QA Python Runtime');
  assert.equal(cleanSkillChipLabel('QA Python Runtime×'), 'QA Python Runtime');
  assert.equal(cleanSkillChipLabel('  × QA Python Runtime  '), 'QA Python Runtime');
});

test('Core Beta fail-closed, partial-stop, and capability identity helpers reject false positives', () => {
  assert.equal(coreBetaActionStopsPlan({ ok: false }), true);
  assert.equal(coreBetaActionStopsPlan({ ok: true }), false);
  assert.equal(coreBetaPartialReplyReady({
    running: true,
    cancelVisible: true,
    baselineAssistantBodyText: 'before',
    latestAssistantBodyText: 'beforepartial reply',
  }).ready, true);
  assert.equal(coreBetaPartialReplyReady({
    running: true,
    cancelVisible: true,
    baselineAssistantBodyText: 'same',
    latestAssistantBodyText: 'same',
  }).ready, false);
  assert.equal(coreBetaPartialReplyReady({
    running: true,
    cancelVisible: true,
    latestAssistantText: 'Long visible reasoning summary without an assistant answer body.',
    latestAssistantBodyText: '',
  }).ready, false);
  const stoppedEvidence = coreBetaStoppedTurnTerminalEvidence({
    task_id: 'task-stop-1',
    running_before: true,
    running_after: false,
    partial_reply_ready_before_click: true,
    partial_chars_before_click: 174,
    retained_chars: 0,
  });
  assert.equal(stoppedEvidence.available, true);
  assert.equal(stoppedEvidence.terminal_outcome, 'user_stopped');
  assert.equal(stoppedEvidence.assistant_reply_present, false);
  assert.equal(stoppedEvidence.retained_chars, 0);
  assert.equal(coreBetaStoppedTurnTerminalEvidence({
    task_id: 'task-stop-2',
    running_before: true,
    running_after: true,
    partial_reply_ready_before_click: true,
    partial_chars_before_click: 20,
    retained_chars: 20,
  }).available, false);
  assert.deepEqual(
    coreBetaSelectedCapabilityIdentities([{ slug: 'skill-a' }, { key: 'mcp-b' }, 'plain-c']),
    ['skill-a', 'mcp-b', 'plain-c'],
  );
  assert.deepEqual(
    coreBetaV2SelectedCapabilityIdentities([
      { key: 'mcphub:fkai-wiki-llm' },
      { id: 'mcphub:dis' },
      'mcphub:iops',
    ]),
    ['mcphub:fkai-wiki-llm', 'mcphub:dis', 'mcphub:iops'],
  );
  const mcpScreenshotRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'teams-mcp-receipts-'));
  try {
    const makeMcpReceipt = (index, key, selected, stage = 'manual_connector_selection') => {
      const screenshotPath = path.join(mcpScreenshotRoot, `${index}.png`);
      fs.writeFileSync(screenshotPath, Buffer.alloc(256, index + 1));
      const selectedConnectors = selected ? [key] : [];
      const task = { id: null, running: false, send_count: 12, message_count: 0 };
      return {
        schema_version: 'qbot-core-beta-mcp-cross-surface-receipt/v1',
        case_id: 'BETA-MCP-002',
        captured_at: '2026-08-07T00:00:02.000Z',
        index,
        key,
        reset_ok: stage !== 'manual_mode',
        selection_attempted: stage === 'manual_connector_selection',
        selected,
        capability_selected: selected,
        selected_connectors: selectedConnectors,
        tools: [{ name: `${key}-read` }],
        health: {},
        visible_text: 'connector menu',
        interaction: {
          schema_version: 'qbot-core-beta-capability-interaction/v1',
          capability_kind: 'connector',
          stage,
          expected_identity: key,
          control_located: true,
          click_dispatched: true,
          expected_state_observed: selected,
          aria_checked: selected ? 'true' : 'false',
          category: selected ? '' : 'bug',
          screenshot: screenshotPath,
          ...(stage === 'manual_connector_selection'
            ? { selected_connectors: selectedConnectors }
            : { manual_surface: { list_visible: false, option_count: 0, empty_visible: false } }),
        },
        public_readback: {
          before: { captured_at: '2026-08-07T00:00:00.000Z', case_id: 'BETA-MCP-002', task, connectors: { selected: [] }, capabilities: { selectedConnectors: [] } },
          after: { captured_at: '2026-08-07T00:00:01.000Z', case_id: 'BETA-MCP-002', task, connectors: { selected: selectedConnectors }, capabilities: { selectedConnectors } },
        },
        task_guard: {
          task_absent_before: true,
          task_absent_after: true,
          not_running_before: true,
          not_running_after: true,
          message_count_zero_before: true,
          message_count_zero_after: true,
          send_count_observed: true,
          send_count_unchanged: true,
          valid: true,
        },
        screenshot: {
          valid: true,
          path: screenshotPath,
          sha256: createHash('sha256').update(fs.readFileSync(screenshotPath)).digest('hex'),
        },
      };
    };
    const mcpReceipts = [
      makeMcpReceipt(0, 'mcphub:wiki', true),
      makeMcpReceipt(1, 'mcphub:dis', false),
      makeMcpReceipt(2, 'mcphub:iops', true),
      makeMcpReceipt(3, 'mcphub:wecom', true),
      makeMcpReceipt(4, 'mcphub:qbi', false, 'manual_mode'),
    ];
    const mcpOutcome = coreBetaMcpCrossSurfaceOutcome(mcpReceipts);
    assert.equal(mcpOutcome.evidence_valid, true);
    assert.equal(mcpOutcome.oracle_valid, false);
    assert.equal(coreBetaMcpCrossSurfaceOutcome(mcpReceipts.slice(0, 4)).evidence_valid, false);
    const missingClick = structuredClone(mcpReceipts[0]);
    missingClick.interaction.click_dispatched = false;
    assert.equal(coreBetaMcpCrossSurfaceReceiptEvidenceValid(missingClick), false);
    const incompleteGuard = structuredClone(mcpReceipts[0]);
    incompleteGuard.task_guard.task_absent_after = false;
    incompleteGuard.task_guard.valid = false;
    assert.equal(coreBetaMcpCrossSurfaceReceiptEvidenceValid(incompleteGuard), false);
  } finally {
    fs.rmSync(mcpScreenshotRoot, { recursive: true, force: true });
  }
  assert.equal(coreBetaSkillSelectionReadbackMatches({
    selectedSkillCount: 1,
    selectedSkills: [{ slug: 'skill-a' }],
    chipCount: 1,
    chipTexts: ['Skill A'],
    chipTestIds: ['composer-skill-chip-skill-a'],
  }, ['skill-a', 'Skill A']).ok, true);
  assert.equal(coreBetaSkillSelectionReadbackMatches({
    selectedSkillCount: 1,
    selectedSkills: ['skill-b'],
    chipCount: 1,
    chipTexts: ['Skill B'],
  }, ['skill-a']).ok, false);
});

test('Teams renderer fault controls stay opt-in and do not replace the local-QBot proxy lane', () => {
  const source = fs.readFileSync(new URL('../../src/lib/ui-agent-casebook-runner.mjs', import.meta.url), 'utf8');
  assert.match(source, /options\['renderer-control-adapter'\] === 'teams360'/);
  assert.match(source, /installRendererControlAdapter\(\{ page, rules, initiallyArmed \}\)/);
  assert.match(source, /const proxy = await createControlPlaneFaultProxy\(\{ upstreamUrl, rules, initiallyArmed \}\)/);
  assert.match(source, /teams360-control-\$\{process\.pid\}-\$\{Date\.now\(\)\}/);
  assert.match(source, /__qbotAutomationRendererControlWrapper/);
  assert.match(source, /__qbotAutomationControlStack/);
  assert.match(source, /for \(let index = stack\.length - 1; index >= 0; index -= 1\)/);
  assert.match(source, /priorOwnerIsLive/);
  assert.match(source, /root\.agent\[name\] = original/);
  assert.match(source, /delete root\.__qbotAutomationAgentOriginalsOwner/);
});

test('managed Teams fixture relaunch keeps the packaged production home', () => {
  const source = fs.readFileSync(new URL('../lib/relaunch-managed-host.mjs', import.meta.url), 'utf8');
  assert.match(source, /origin === packagedControlPlaneOrigin \? \{\} : \{ DEEPBANK_SERVER: serverUrl \}/);
  assert.match(source, /DEEPBANK_UI_URL: pinnedQworkUi\.url/);
  assert.match(source, /QBOT_UI_URL: pinnedQworkUi\.url/);
  assert.match(source, /QBOT_SERVER_URL: serverUrl/);
  assert.doesNotMatch(source, /DEEPBANK_ENV:\s*['"]dev['"]/);
  assert.match(source, /resolvePinnedQworkUi\(previous, expectedQworkUi\)/);
  assert.match(source, /\/json\/list/);
  assert.match(source, /Automatically rolled back to/);
  assert.match(source, /remountPinnedManagedQworkUi\(launched\.cdp_url, pinnedQworkUi\.url/);
  assert.match(source, /qwork_workbench_ready: remountedQwork\.workbenchReady/);
  assert.match(source, /activatePreparedManagedQworkRelease\(launched\.cdp_url, pinnedQworkUi\.url/);
  assert.match(source, /activatePreparedRelease: false/);
  assert.match(source, /qwork_runtime_activation_dispatched: activatedQwork\.activationDispatched/);
  assert.match(source, /process\.exit\(0\)/);
});

test('managed Teams activation only accepts the exact prepared runtime after host-core restart', () => {
  const prepared = managedQworkRuntimeActivationDecision({
    releaseId: '0.1.1',
    version: '0.1.1',
    updatePhase: 'ready-to-activate',
    preparedRelease: { releaseId: '0.1.6-sit.6', version: '0.1.6-sit.6' },
    loadedRuntime: { releaseId: '0.1.1', version: '0.1.1' },
    hostRuntimeCompatibility: {
      hostCoreVersion: '0.1.6-sit.6',
      runtimeReleaseId: '0.1.1',
      runtimeVersion: '0.1.1',
    },
  }, '0.1.6-sit.6');
  assert.equal(prepared.ready, false);
  assert.equal(prepared.activatable, true);
  assert.equal(prepared.reason, 'prepared-release-ready');

  const active = managedQworkRuntimeActivationDecision({
    releaseId: '0.1.6-sit.6',
    version: '0.1.6-sit.6',
    updatePhase: 'idle',
    preparedRelease: null,
    loadedRuntime: { releaseId: '0.1.6-sit.6', version: '0.1.6-sit.6' },
    hostRuntimeCompatibility: {
      hostCoreVersion: '0.1.6-sit.6',
      runtimeReleaseId: '0.1.6-sit.6',
      runtimeVersion: '0.1.6-sit.6',
    },
  }, '0.1.6-sit.6');
  assert.equal(active.ready, true);
  assert.equal(active.activatable, false);
  assert.equal(active.reason, 'already-active');

  const stillNeedsRestart = managedQworkRuntimeActivationDecision({
    releaseId: '0.1.6-sit.5',
    version: '0.1.6-sit.5',
    updatePhase: 'restart-required',
    preparedRelease: { releaseId: '0.1.6-sit.6', version: '0.1.6-sit.6' },
    loadedRuntime: { releaseId: '0.1.6-sit.5', version: '0.1.6-sit.5' },
    hostRuntimeCompatibility: {
      hostCoreVersion: '0.1.6-sit.5',
      runtimeReleaseId: '0.1.6-sit.5',
      runtimeVersion: '0.1.6-sit.5',
    },
  }, '0.1.6-sit.6');
  assert.equal(stillNeedsRestart.activatable, false);
  assert.equal(stillNeedsRestart.reason, 'managed-host-restart-still-required');

  const wrongCandidate = managedQworkRuntimeActivationDecision({
    releaseId: '0.1.1',
    version: '0.1.1',
    updatePhase: 'ready-to-activate',
    preparedRelease: { releaseId: '0.1.6-sit.5', version: '0.1.6-sit.5' },
    loadedRuntime: { releaseId: '0.1.1', version: '0.1.1' },
    hostRuntimeCompatibility: {
      hostCoreVersion: '0.1.6-sit.6',
      runtimeReleaseId: '0.1.1',
      runtimeVersion: '0.1.1',
    },
  }, '0.1.6-sit.6');
  assert.equal(wrongCandidate.activatable, false);
  assert.equal(wrongCandidate.reason, 'prepared-release-does-not-match-target');
});

test('managed Teams restart rebuilds stale proxy before shared runner touches the new QWork page', () => {
  const adapter = fs.readFileSync(new URL('../lib/casebook-runner.mjs', import.meta.url), 'utf8');
  const runner = fs.readFileSync(new URL('../../src/lib/ui-agent-casebook-runner.mjs', import.meta.url), 'utf8');
  assert.match(adapter, /options\['restart-reconnect-hook'\] = async \(\) =>/);
  assert.match(adapter, /persistRunMetadata\(nextRuntimeIdentity\)/);
  assert.match(adapter, /await connection\.close\(\)\.catch\(\(\) => \{\}\);[\s\S]*resolveTeamsCasebookConnection/);
  assert.match(runner, /typeof options\['restart-reconnect-hook'\] === 'function'/);
  assert.match(runner, /if \(reconnected\?\.cdpUrl\) runtime\.cdpUrl = reconnected\.cdpUrl/);
  assert.match(runner, /waitForRunningTaskEvidence\(page, 90000, \{[\s\S]*runtime,[\s\S]*screenshotName: 'teams-new-002-running-before-reopen'/);
  assert.match(runner, /恢复宿主自动重载后的 QBot CDP\/page 绑定/);
  assert.match(runner, /await reconnectQbotRuntime\(/);
});

test('Core Beta skill persistence reload reconnects to a replacement QWork renderer', () => {
  const runner = fs.readFileSync(new URL('../../src/lib/ui-agent-casebook-runner.mjs', import.meta.url), 'utf8');
  const command = runner.slice(
    runner.indexOf("if (command === 'verify_skill_selection_persistence')"),
    runner.indexOf("if (command === 'create_skill_disabled_task')"),
  );
  assert.match(command, /await ctx\.page\.reload\(\{ waitUntil: 'domcontentloaded', timeout: 30000 \}\)/);
  assert.match(command, /coreBetaNeedsRendererReconnect\(error\)/);
  assert.match(command, /Core Beta skill selection reload replacement renderer/);
  assert.match(command, /ctx\.page = reconnected\.page/);
  assert.match(command, /await waitForQbotWorkbench\(ctx\.page, 90000\)/);
  assert.match(command, /setCoreBetaEvidence\(ctx\.state, 'capability_selection'/);
  assert.match(command, /persisted_after_reload: persistent/);
});

test('Core Beta skill cleanup keeps run-owned receipts separate and drives current uninstall UI', () => {
  const runner = fs.readFileSync(new URL('../../src/lib/ui-agent-casebook-runner.mjs', import.meta.url), 'utf8');
  const cancelBranch = runner.slice(
    runner.indexOf("if (command === 'cancel_first_skill_uninstall')"),
    runner.indexOf("if (command === 'uninstall_run_skill_sample')"),
  );
  const uninstallBranch = runner.slice(
    runner.indexOf("if (command === 'uninstall_run_skill_sample')"),
    runner.indexOf("if (command === 'exercise_skill_uninstall_confirm')"),
  );
  const cleanupBranch = runner.slice(
    runner.indexOf("if (command === 'verify_skill_cleanup' || command === 'verify_skill_cleanup_across_views')"),
    runner.indexOf('throw new Error(`Core Beta skill command 未实现'),
  );
  assert.match(runner, /exact run-owned install receipt ledger/);
  assert.match(runner, /ledger\.skills\.installed = exactRunInstalled/);
  assert.match(runner, /if \(derived\.branch === 'installed'\) ctx\.ledger\.skills\.installed_view = inventory/);
  assert.match(runner, /\.skill-card-more-trigger, \[aria-label="更多"\]/);
  assert.match(runner, /\.skill-card-more-delete, \[role="menuitem"\]/);
  assert.match(runner, /custom-dialog-missing-cancel/);
  assert.match(runner, /operation: 'cleanup_current_run_installs'/);
  assert.match(runner, /skill_cleanup_cross_view_readback/);
  assert.match(runner, /history_uninstall_count/);
  assert.match(runner, /composer_targets_absent/);
  assert.match(runner, /function recordCoreBetaSkillCleanupInventoryEvidence\(ctx\)/);
  assert.match(runner, /shared deterministic Skill sample \+ exact install receipts \+ cleanup target ledger/);
  assert.match(runner, /successful_install_receipts: installResults\.filter/);
  assert.match(cancelBranch, /recordCoreBetaSkillCleanupInventoryEvidence\(ctx\)/);
  assert.match(uninstallBranch, /recordCoreBetaSkillCleanupInventoryEvidence\(ctx\)/);
  assert.match(cleanupBranch, /recordCoreBetaSkillCleanupInventoryEvidence\(ctx\)/);
});

test('Core Beta five-connector selection captures an exact negative readback before fail-closed', () => {
  const runner = fs.readFileSync(new URL('../../src/lib/ui-agent-casebook-runner.mjs', import.meta.url), 'utf8');
  const command = runner.slice(
    runner.indexOf("if (command === 'select_five_connectors_by_key')"),
    runner.indexOf("if (command === 'readback_connector_binding')"),
  );
  assert.match(command, /const expected = \(ctx\.ledger\.mcp\.sample \|\| \[\]\)\.map/);
  assert.match(command, /const selectedIdentities = coreBetaSelectedCapabilityIdentities/);
  assert.match(command, /setCoreBetaEvidence\(ctx\.state, 'capability_selection'/);
  assert.match(command, /five visible connector option clicks \+ chips \+ window\.agent\.capabilities/);
  assert.match(command, /available: exact/);
  assert.match(command, /state_readback: \{ expected, selected, snapshot:/);
});

test('pinned Teams QWork remount is host-owned and verifies signed-in workbench readiness', () => {
  const source = fs.readFileSync(new URL('../lib/managed-qwork-ui.mjs', import.meta.url), 'utf8');
  assert.match(source, /webview#qbot-workbench, webview/);
  assert.match(source, /element\.setAttribute\('src', url\)/);
  assert.match(source, /element\.reload\(\)/);
  assert.match(source, /authenticated: Boolean\(auth\?\.authenticated\)/);
  assert.match(source, /capabilitiesReady/);
  assert.match(source, /workbenchReady/);
  assert.match(source, /360Teams webview\.executeJavaScript workbench probe/);
  assert.match(source, /Promise\.all\(\[\s*probe\(\(\) => window\.agent\?\.getAuthStatus/);
  assert.match(source, /browser\._connection\?\.close\?/);
  assert.match(source, /runtimeActivatePreparedRelease/);
  assert.match(source, /stableReady >= 2/);
  assert.match(source, /phase === 'restart-required'/);
  assert.match(source, /status\.preparedRelease === null/);
});

test('managed live Teams can expose the real OAuth browser during login recovery', () => {
  assert.equal(managedTeamsEnvironment({}, { e2e: false }).DEEPBANK_E2E, '0');
  assert.equal(managedTeamsEnvironment({}, { e2e: true }).DEEPBANK_E2E, '1');
  assert.equal(managedTeamsEnvironment({ DEEPBANK_E2E: '0' }).DEEPBANK_E2E, '1');
});

test('managed live Teams keeps the packaged WebView resource home while targeting dev', () => {
  assert.deepEqual(
    managedQbotLaunchArgs({
      DEEPBANK_SERVER: 'https://deepbank-control-dev.sandbox.deepbank.daikuan.qihoo.net/',
      QBOT_RELEASE_ENV: 'DEV',
    }),
    [
      '--qbot-server=https://deepbank-control-dev.sandbox.deepbank.daikuan.qihoo.net',
    ],
  );
  assert.throws(
    () => managedQbotLaunchArgs({ DEEPBANK_SERVER: 'https://user:secret@example.test' }),
    /credential-free HTTP\(S\) URL/,
  );
});

test('Teams Electron restart shim ignores fixture URLs and auto-discovers the pinned QWork UI', () => {
  const source = fs.readFileSync(new URL('../runtime/scripts/restart-qbot-electron-control-plane.sh', import.meta.url), 'utf8');
  assert.match(source, /EXPECTED_QWORK_UI_URL="\$\{5-\}"/);
  assert.match(source, /AGENT_MOCK="\$\{6:-0\}"/);
  assert.match(source, /\.deepbank\(-dev\|-local\|-uat\|-sit\)\?\/ui/);
  assert.match(source, /relaunch-managed-host\.mjs" "\$CONTROL_PLANE_URL" "" "\$AGENT_MOCK"$/m);
});

test('Teams connector fixture pins the live QWork UI across managed host relaunches', () => {
  const runner = fs.readFileSync(new URL('../../src/lib/ui-agent-casebook-runner.mjs', import.meta.url), 'utf8');
  assert.match(
    runner,
    /const expectedQworkUiUrl = options\['renderer-control-adapter'\] === 'teams360'[\s\S]*runtime\?\.page\?\.url\?\.\(\)/,
  );
  assert.match(
    runner,
    /\[electronHelper, qbotRoot, 'http:\/\/127\.0\.0\.1:8900', cdpPort, qbotHome, expectedQworkUiUrl,/,
  );
});

test('managed Teams HITL fixture opts into mock Agent only for its controlled relaunch', () => {
  const relaunch = fs.readFileSync(new URL('../lib/relaunch-managed-host.mjs', import.meta.url), 'utf8');
  const runner = fs.readFileSync(new URL('../../src/lib/ui-agent-casebook-runner.mjs', import.meta.url), 'utf8');
  assert.match(relaunch, /DEEPBANK_AGENT_MOCK: mockFlag/);
  assert.match(relaunch, /\['0', '1'\]\.includes\(agentMock\)/);
  assert.match(runner, /restartWithHitlMockAgent[\s\S]*expectedQworkUiUrl[\s\S]*parsedControlPlane\.origin[\s\S]*qbotHome[\s\S]*expectedQworkUiUrl[\s\S]*'1'[\s\S]*\.map\(shellQuote\)/);
  assert.match(runner, /executeHitlFixtureCase[\s\S]*restartWithHitlMockAgent/);
  assert.match(runner, /executeHitlFixtureCase[\s\S]*public_e2e_state_before_fixture_restore[\s\S]*HITL 任务归属在 Fixture 恢复前固化/);
  assert.doesNotMatch(
    runner.slice(runner.indexOf('async function executeHitlFixtureCase'), runner.indexOf('async function executeSitHitlSkipDefault')),
    /createConnectorRegressionServer|restartWithConnectorRegressionFixture|127\.0\.0\.1:18900/,
  );
});

test('managed Teams fixture data stays on the authenticated renderer bridge; legacy loopback auth remains fail-closed', () => {
  const fixtureServer = fs.readFileSync(new URL('../runtime/scripts/teams-control-plane.mjs', import.meta.url), 'utf8');
  const fixtureProxy = fs.readFileSync(new URL('../runtime/scripts/teams-control-plane-proxy.mjs', import.meta.url), 'utf8');
  const relaunch = fs.readFileSync(new URL('../lib/relaunch-managed-host.mjs', import.meta.url), 'utf8');
  const runner = fs.readFileSync(new URL('../../src/lib/ui-agent-casebook-runner.mjs', import.meta.url), 'utf8');
  assert.match(fixtureServer, /DEEPBANK_AUTH_PROVIDER:\s*['"]mock['"]/);
  assert.match(fixtureServer, /portIsOpen/);
  assert.match(runner, /Teams 文档连接器已物化到本轮 Agent/);
  assert.match(
    runner,
    /const e2e = window\.__qbotE2E \|\| window\.__deepbankE2E;[\s\S]*e2e\?\.getLastTurnContextEvidence[\s\S]*window\.agent\?\.getLastTurnContextEvidence/,
  );
  assert.doesNotMatch(runner, /window\.agent\?\.e2e\?\.getLastTurnContextEvidence/);
  assert.match(fixtureServer, /if\s*\(!portClosed\)/);
  assert.match(fixtureServer, /payload\.auth\?\.provider\?\.id\s*===\s*['"]mock['"]/);
  assert.match(runner, /ensureManagedFixtureMockAuth/);
  assert.match(runner, /\/api\/auth\/mock\/authorize/);
  assert.match(runner, /\['127\.0\.0\.1', 'localhost', '\[::1\]', '::1'\]/);
  assert.match(runner, /createManagedFixtureMockSession/);
  assert.match(runner, /lingxi-credential:mock-adopt/);
  assert.match(runner, /teams-main-e2e-mock-adopt/);
  assert.match(runner, /captureManagedTeamsFixtureRuntimeRelease/);
  assert.match(runner, /lingxi-credential:control-plane-request/);
  assert.match(runner, /QBOT_QA_RUNTIME_RELEASE_ENVELOPE_FILE/);
  assert.match(runner, /signature\?\.algorithm !== 'Ed25519'/);
  assert.match(runner, /claudeAllowedToolCount/);
  assert.match(runner, /actual fixture tools\/call assertion below remains the/);
  assert.match(fixtureServer, /const upstreamPort = 18901/);
  assert.match(fixtureServer, /teams-control-plane-proxy\.mjs/);
  assert.match(fixtureProxy, /url\.pathname === '\/api\/runtime-release'/);
  assert.match(fixtureProxy, /signature\?\.algorithm !== 'Ed25519'/);
  assert.match(fixtureProxy, /url\.pathname === '\/api\/desktop-agent\/private-runtime-context'/);
  assert.match(fixtureProxy, /hasPrivateBearer\(request\)/);
  assert.match(fixtureProxy, /private_runtime_context_forbidden/);
  assert.match(fixtureProxy, /private_runtime_context_unavailable/);
  assert.match(fixtureProxy, /captureTurnContext/);
  assert.match(fixtureProxy, /platformResourcesBundle/);
  assert.match(fixtureProxy, /qbotVisionRuntime:\s*\{\}/);
  assert.doesNotMatch(fixtureProxy, /connectorRuntimeMaterialization\s*[:,]/);
  assert.match(fixtureProxy, /request\.pipe\(upstream\)/);
  assert.match(fixtureProxy, /const headers = \{ \.\.\.request\.headers \}/);
  assert.doesNotMatch(fixtureProxy, /host:\s*`127\.0\.0\.1:\$\{upstreamPort\}`/);
  assert.match(relaunch, /QBOT_CLAUDE_SDK_DEBUG: '1'/);
  assert.match(runner, /providerTokens:\s*\{[\s\S]*accessToken:\s*auth\.sessionToken/);
  assert.match(runner, /fixture-auth-control-plane-url'\]\s*=\s*'http:\/\/127\.0\.0\.1:18900'/);
  assert.match(runner, /qbot-test-agent-m3-fixture/);
  assert.match(runner, /modelTier/);
  assert.match(runner, /mock-llm\\\/v1\\\/messages/);
  assert.match(runner, /fixture\.includeDocumentFixture \? '0'/);
  assert.match(runner, /connector_regression_fixture_llm_turns/);
  assert.match(fixtureServer, /DEEPBANK_LLM_CONNECTIONS_MOCK\s*=\s*'0'/);
  assert.match(fixtureServer, /DEEPBANK_LLM_CONNECTIONS_URL/);
  assert.match(runner, /unifiedConnectorModeApplied/);
  assert.match(runner, /selectedConnectors === null/);
  assert.match(runner, /Array\.isArray\(selectedConnectors\) && selectedConnectors\.length === 0/);
  assert.match(runner, /Array\.isArray\(bridgeSelection\) && bridgeSelection\.length === 0/);
  assert.match(runner, /public-catalog-visible-label/);
  assert.match(runner, /coreBetaSelectedCapabilityIdentities\(selectedConnectors\)\.includes\(connectorKey\)/);
  assert.match(runner, /teams-upstream-cdp-url/);
  assert.match(runner, /chromium\.connectOverCDP\(upstreamCdp/);
  assert.match(runner, /ownsHostBrowser/);
  assert.match(runner, /globalThis\.ipcRenderer/);
  assert.match(runner, /fixture_mock_auth/);
  assert.match(runner, /stopManagedTeamsFixtureControlPlane/);
  assert.match(runner, /teams-control-plane-proxy\.pid/);
  assert.match(runner, /process\.kill\(-pid, 'SIGTERM'\)/);
  assert.match(runner, /connector-fixture-finished/);
  assert.match(runner, /home-capability-fixture-finished/);
  assert.match(runner, /if \(auth\?\.authenticated\)[\s\S]*const provider = String\(auth\?\.provider\?\.id \|\| ''\)\.toLowerCase\(\)/);
  assert.doesNotMatch(
    runner.slice(
      runner.indexOf('async function ensureManagedFixtureMockAuth'),
      runner.indexOf('async function restartQbotAndReconnect'),
    ),
    /if \(!loginVisible\) return \{ ok: true, needed: false \}/,
  );
  assert.match(runner, /createTeamsSkillFixtureController/);
  assert.match(runner, /createTeamsConnectorFixtureController/);
  assert.match(runner, /teams360_connector_fixture_adapter/);
  assert.match(runner, /mode:\s*'stateful-renderer-bridge'/);
  assert.match(runner, /mode:\s*'node-handler'/);
  assert.match(runner, /options\['renderer-control-adapter'\] === 'teams360' && !fixture\.includeDocumentFixture/);
  assert.match(runner, /360Teams、外部 DEV 和登录态均未重启/);
  assert.match(runner, /Fixture 初始化失败后恢复正式控制面/);
});

test('fixture proxy adapts authenticated legacy turn context to QWork 0.0.12 private context', async () => {
  const privateBundle = {
    resources: [{ id: 'teams_doc_fixture', runtime: { url: 'http://127.0.0.1:39001/mcp/documents' } }],
  };
  const upstream = http.createServer((request, response) => {
    if (request.method === 'POST' && request.url === '/api/desktop-agent/turn-context') {
      const body = JSON.stringify({
        platformResourcesBundle: privateBundle,
        connectorRuntimeMaterialization: { secret: 'must-not-be-copied' },
        redacted: false,
      });
      response.writeHead(200, {
        'content-type': 'application/json',
        'content-length': String(Buffer.byteLength(body)),
      });
      response.end(body);
      return;
    }
    response.writeHead(404, { 'content-type': 'application/json' });
    response.end('{}');
  });
  const upstreamPort = await listen(upstream);
  const reservation = http.createServer();
  const proxyPort = await listen(reservation);
  await closeServer(reservation);
  const proxyPath = new URL('../runtime/scripts/teams-control-plane-proxy.mjs', import.meta.url);
  const proxy = spawn(process.execPath, [proxyPath.pathname, String(proxyPort), String(upstreamPort)], {
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  try {
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('fixture proxy readiness timeout')), 5000);
      proxy.once('exit', (code) => reject(new Error(`fixture proxy exited before ready: ${code}`)));
      proxy.stdout.on('data', (chunk) => {
        if (!String(chunk).includes('"status":"ready"')) return;
        clearTimeout(timeout);
        resolve();
      });
    });

    const beforeCache = await requestJson({
      port: proxyPort,
      path: '/api/desktop-agent/private-runtime-context',
      headers: { authorization: 'Bearer fixture-private-token' },
    });
    assert.equal(beforeCache.status, 503);
    assert.equal(beforeCache.body.error, 'private_runtime_context_unavailable');

    const publicContext = await requestJson({
      port: proxyPort,
      path: '/api/desktop-agent/turn-context',
      headers: { authorization: 'Bearer fixture-app-session' },
      body: JSON.stringify({ session: { connectors: ['mcphub:teams_doc_fixture'] } }),
    });
    assert.equal(publicContext.status, 200);

    const missingBearer = await requestJson({
      port: proxyPort,
      path: '/api/desktop-agent/private-runtime-context',
    });
    assert.equal(missingBearer.status, 403);
    assert.equal(missingBearer.body.error, 'private_runtime_context_forbidden');

    const privateContext = await requestJson({
      port: proxyPort,
      path: '/api/desktop-agent/private-runtime-context',
      headers: { authorization: 'Bearer fixture-private-token' },
    });
    assert.equal(privateContext.status, 200);
    assert.deepEqual(privateContext.body, {
      platformResourcesBundle: privateBundle,
      qbotVisionRuntime: {},
      redacted: true,
    });
    assert.equal('connectorRuntimeMaterialization' in privateContext.body, false);
  } finally {
    proxy.kill('SIGTERM');
    await closeServer(upstream);
  }
});

test('managed Teams fixture relaunch transactionally overrides and restores the persisted QBot profile', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'qbot-teams-profile-'));
  const profile = path.join(root, 'profile');
  const backup = path.join(root, 'state', 'profile-backup.json');
  const bridgeDir = path.join(profile, 'qbot');
  fs.mkdirSync(bridgeDir, { recursive: true });
  const configFile = path.join(profile, 'sk-teams-cfg.json');
  fs.writeFileSync(configFile, JSON.stringify({
    deepbank: { qbot_custom: { env: 'DEV', serverUrl: '', uiUrl: '' } },
    configInfo: {
      QBOT_ENV: 'DEV',
      QBOT_SERVER_URL: 'https://dev.example.test',
      QBOT_UI_URL: 'file:///Users/test/.deepbank-dev/ui/0.0.11/index.html',
      QBOT_SURFACE: 'workbench',
    },
  }));
  const uiUrl = 'file:///Users/test/.deepbank-dev/ui/0.0.11/index.html';
  const overridden = applyManagedQbotProfileConfig({
    profileDir: profile,
    serverUrl: 'http://127.0.0.1:18900',
    uiUrl,
    backupFile: backup,
  });
  assert.equal(overridden.mode, 'overridden');
  const fixtureConfig = JSON.parse(fs.readFileSync(configFile, 'utf8'));
  assert.equal(fixtureConfig.deepbank.qbot_custom.serverUrl, 'http://127.0.0.1:18900');
  assert.equal(fixtureConfig.deepbank.qbot_custom.uiUrl, '');
  assert.equal(fixtureConfig.configInfo.QBOT_SERVER_URL, 'http://127.0.0.1:18900');
  assert.equal(fixtureConfig.configInfo.QBOT_UI_URL, uiUrl);
  assert.equal(fs.existsSync(backup), true);
  fs.writeFileSync(
    path.join(bridgeDir, 'qbot-agent-bridge.cjs'),
    'process.env.DEEPBANK_SERVER = "http://127.0.0.1:18900";\n',
  );
  assert.equal(stagedQbotServer(profile), 'http://127.0.0.1:18900');

  const restored = applyManagedQbotProfileConfig({
    profileDir: profile,
    serverUrl: 'https://dev.example.test',
    uiUrl,
    backupFile: backup,
  });
  assert.equal(restored.mode, 'restored');
  const restoredConfig = JSON.parse(fs.readFileSync(configFile, 'utf8'));
  assert.equal(restoredConfig.deepbank.qbot_custom.serverUrl, '');
  assert.equal(restoredConfig.configInfo.QBOT_SERVER_URL, 'https://dev.example.test');
  assert.equal(fs.existsSync(backup), false);
  fs.rmSync(root, { recursive: true, force: true });
});

test('managed Teams profile repins a newer QWork UI when the control plane is unchanged', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'qbot-teams-profile-repin-'));
  const profile = path.join(root, 'profile');
  fs.mkdirSync(profile, { recursive: true });
  const configFile = path.join(profile, 'sk-teams-cfg.json');
  fs.writeFileSync(configFile, JSON.stringify({
    deepbank: {
      qbot_custom: {
        env: 'DEV',
        serverUrl: '',
        uiUrl: '',
        surface: 'workbench',
      },
    },
    configInfo: {
      QBOT_ENV: 'DEV',
      QBOT_SERVER_URL: 'https://dev.example.test',
      QBOT_UI_URL: 'file:///Users/test/.deepbank-dev/ui/0.0.11/index.html',
      QBOT_SURFACE: 'workbench',
    },
  }));
  const nextUi = 'file:///Users/test/.deepbank-dev/ui/0.0.12/index.html';
  const result = applyManagedQbotProfileConfig({
    profileDir: profile,
    serverUrl: 'https://dev.example.test',
    uiUrl: nextUi,
    backupFile: path.join(root, 'backup.json'),
  });
  assert.equal(result.mode, 'repinned');
  const repinned = JSON.parse(fs.readFileSync(configFile, 'utf8'));
  assert.equal(repinned.deepbank.qbot_custom.serverUrl, 'https://dev.example.test');
  assert.equal(repinned.deepbank.qbot_custom.env, 'DEV');
  assert.equal(repinned.deepbank.qbot_custom.uiUrl, '');
  assert.equal(repinned.configInfo.QBOT_ENV, 'DEV');
  assert.equal(repinned.configInfo.QBOT_UI_URL, nextUi);
  assert.equal(fs.existsSync(path.join(root, 'backup.json')), false);
  fs.rmSync(root, { recursive: true, force: true });
});

test('managed Teams profile derives the release environment from the pinned QWork home', () => {
  assert.equal(managedQworkReleaseEnv('file:///Users/test/.deepbank/ui/0.0.14/index.html'), 'PROD');
  assert.equal(managedQworkReleaseEnv('file:///Users/test/.deepbank-dev/ui/0.0.14/index.html'), 'DEV');
  assert.equal(managedQworkReleaseEnv('file:///Users/test/.deepbank-uat/ui/0.0.14/index.html'), 'UAT');
  assert.equal(managedQworkReleaseEnv('file:///Users/test/.deepbank-sit/ui/0.1.2-sit.7/index.html'), 'SIT');
  assert.equal(managedQworkReleaseEnv('file:///Users/test/.deepbank-local/ui/0.0.14/index.html'), 'LOCAL');

  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'qbot-teams-profile-prod-repin-'));
  const profile = path.join(root, 'profile');
  fs.mkdirSync(profile, { recursive: true });
  const configFile = path.join(profile, 'sk-teams-cfg.json');
  fs.writeFileSync(configFile, JSON.stringify({
    deepbank: {
      qbot_custom: {
        env: 'DEV',
        serverUrl: 'https://qbot-api.360shuke.com',
        uiUrl: '',
        surface: 'workbench',
      },
    },
    configInfo: {
      QBOT_ENV: 'DEV',
      QBOT_SERVER_URL: 'https://qbot-api.360shuke.com',
      QBOT_UI_URL: 'file:///Users/test/.deepbank-dev/ui/0.0.14/index.html',
      QBOT_SURFACE: 'workbench',
    },
  }));
  const prodUi = 'file:///Users/test/.deepbank/ui/0.0.14/index.html';
  try {
    const result = applyManagedQbotProfileConfig({
      profileDir: profile,
      serverUrl: 'https://qbot-api.360shuke.com',
      uiUrl: prodUi,
      backupFile: path.join(root, 'backup.json'),
    });
    assert.equal(result.mode, 'repinned');
    const repinned = JSON.parse(fs.readFileSync(configFile, 'utf8'));
    assert.equal(repinned.deepbank.qbot_custom.env, 'PROD');
    assert.equal(repinned.deepbank.qbot_custom.serverUrl, 'https://qbot-api.360shuke.com');
    assert.equal(repinned.configInfo.QBOT_ENV, 'PROD');
    assert.equal(repinned.configInfo.QBOT_UI_URL, prodUi);
    assert.equal(fs.existsSync(path.join(root, 'backup.json')), false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('managed Teams Casebook recovery rebuilds its CDP proxy after a host relaunch', () => {
  const source = fs.readFileSync(new URL('../lib/casebook-runner.mjs', import.meta.url), 'utf8');
  assert.match(source, /let connection = await resolveTeamsCasebookConnection/);
  assert.match(source, /connection = await resolveTeamsCasebookConnection\(\{ \.\.\.options, cdp: undefined \}\)/);
  assert.match(source, /process\.exit\(teamsCasebookExitCode\(summary\)\)/);
});

test('managed Teams Casebook exits nonzero for a stopped or incomplete summary', () => {
  assert.equal(teamsCasebookExitCode({
    status: 'passed',
    stopped: true,
    counts: { total: 1, passed: 1, failed: 0, blocked: 0 },
    result_accounting: { planned: 55, completed: 1 },
  }), 1);
  assert.equal(teamsCasebookExitCode({
    status: 'passed',
    stopped: false,
    counts: { total: 1, passed: 1, failed: 0, blocked: 0 },
    result_accounting: { planned: 2, completed: 1 },
  }), 1);
  assert.equal(teamsCasebookExitCode({
    status: 'passed',
    stopped: false,
    counts: { total: 55, passed: 55, failed: 0, blocked: 0 },
    result_accounting: { planned: 55, completed: 55 },
  }), 0);
});

test('managed Teams replacement reconnect waits for QWork without relaunching the host', () => {
  const source = fs.readFileSync(new URL('../lib/casebook-runner.mjs', import.meta.url), 'utf8');
  const hook = source.slice(
    source.indexOf("options['restart-reconnect-hook'] = async () =>"),
    source.indexOf('let handedToRunner = false'),
  );
  assert.match(hook, /await remountPinnedTeamsRendererInPlace\(\{/);
  assert.match(hook, /recoveryCdpUrl: ''/);
  assert.match(hook, /persistRunMetadata\(nextRuntimeIdentity\)/);
  assert.match(hook, /rendererRemount/);
  assert.doesNotMatch(hook, /recoverTeamsQworkWorkbench|stopIsolatedTeams|launchLiveTeams/);
  assert.ok(
    hook.indexOf('await remountPinnedTeamsRendererInPlace({') < hook.indexOf('await connection.close()'),
    'the pinned upstream QWork renderer must be restored before the current proxy is replaced',
  );
  assert.match(source, /recoverTeamsQworkWorkbench/);
  assert.match(source, /Teams QWork connection view timed out after 1500ms/);
  assert.match(source, /Teams QWork capabilities precheck timed out after 5000ms/);
  assert.match(source, /new URL\('\/json\/list', normalizedCdpUrl\)/);
  assert.match(source, /target\?\.type === 'webview'/);
  assert.match(source, /resolveTeamsRecoveryQworkUi\(expectedUiUrl, qworkTarget\?\.url \|\| ''\)/);
  assert.match(source, /Managed QWork release identity drift/);
  assert.match(source, /expectedQworkUiUrl: runtimeIdentity\.qworkUiUrl/);
  assert.match(source, /applyManagedQbotProfileConfig/);
  assert.match(source, /remountPinnedManagedQworkUi\(relaunched\.cdp_url, pinnedQworkUi\.url/);
  assert.match(source, /launchLiveTeams/);
  assert.match(source, /DEEPBANK_UI_URL: pinnedQworkUi\.url/);
  assert.match(source, /QBOT_UI_URL: pinnedQworkUi\.url/);
  assert.match(source, /QBOT_SERVER_URL: snapshot\.controlPlane/);
  assert.doesNotMatch(source, /host\.reload\(\{ waitUntil: 'domcontentloaded'/);
  assert.match(source, /360Teams login expired before recovering QWork/);
  assert.match(source, /recoveryCdpUrl: connection\.upstreamCdpUrl/);
  assert.match(source, /resetConnection: connection\.reset/);
  assert.match(source, /QWork capabilities IPC is unavailable/);
  assert.match(source, /capabilities_ipc: 'ready'/);
  assert.match(source, /process\.chdir\(ROOT\);[\s\S]*connectTeamsCasebookBrowser[\s\S]*process\.chdir\(TEAMS_RUNTIME_ROOT\);/);
});

test('managed Teams replacement reconnect repins a stale renderer without restarting the host', async () => {
  const pinned = 'file:///Users/test/.deepbank-sit/ui/0.1.6-sit.3/index.html';
  let observedUi = 'file:///Users/test/.deepbank-sit/ui/0.1.6-sit.2/index.html';
  const session = {
    profile_mode: 'live',
    pid: 9554,
    cdp_url: 'http://127.0.0.1:63170',
  };
  const validatePinnedUi = (value) => ({
    url: new URL(value).href,
    version: new URL(value).pathname.split('/').at(-2),
  });
  const result = await remountPinnedTeamsRendererInPlace({
    cdpUrl: session.cdp_url,
    expectedUiUrl: pinned,
    sessionFile: '/tmp/managed-session.json',
    timeoutMs: 20_000,
  }, {
    readManagedSession: () => ({ ...session }),
    matchesManagedSession: (candidate) => candidate.pid === session.pid,
    validatePinnedUi,
    remount: async (cdpUrl, expectedUiUrl, options) => {
      assert.equal(observedUi, 'file:///Users/test/.deepbank-sit/ui/0.1.6-sit.2/index.html');
      assert.equal(cdpUrl, session.cdp_url);
      assert.equal(expectedUiUrl, pinned);
      assert.equal(options.timeoutMs, 20_000);
      observedUi = expectedUiUrl;
      return {
        remounted: true,
        qworkUiUrl: observedUi,
        qworkUiVersion: '0.1.6-sit.3',
        authenticated: true,
        capabilitiesReady: true,
        workbenchReady: true,
      };
    },
  });
  assert.equal(result.valid, true);
  assert.equal(result.remounted, true);
  assert.equal(result.host_pid_before, 9554);
  assert.equal(result.host_pid_after, 9554);
  assert.equal(result.host_restarted, false);
  assert.equal(result.qwork_ui_url, pinned);
});

test('managed Teams replacement reconnect rejects any host PID change', async () => {
  const sessions = [
    { profile_mode: 'live', pid: 9554, cdp_url: 'http://127.0.0.1:63170' },
    { profile_mode: 'live', pid: 9555, cdp_url: 'http://127.0.0.1:63170' },
  ];
  let readCount = 0;
  const validatePinnedUi = (value) => ({
    url: new URL(value).href,
    version: new URL(value).pathname.split('/').at(-2),
  });
  await assert.rejects(
    remountPinnedTeamsRendererInPlace({
      cdpUrl: sessions[0].cdp_url,
      expectedUiUrl: 'file:///Users/test/.deepbank-sit/ui/0.1.6-sit.3/index.html',
    }, {
      readManagedSession: () => ({ ...sessions[Math.min(readCount++, sessions.length - 1)] }),
      matchesManagedSession: () => true,
      validatePinnedUi,
      remount: async (_cdpUrl, expectedUiUrl) => ({
        remounted: true,
        qworkUiUrl: expectedUiUrl,
        authenticated: true,
        capabilitiesReady: true,
        workbenchReady: true,
      }),
    }),
    /host PID changed during renderer-only remount/,
  );
});

test('the Teams Casebook wrapper can resolve the managed live session without a manual CDP proxy', () => {
  const options = parseCasebookRunnerOptions([
    '--casebook', 'PRD/cases.xlsx',
    '--case', 'SIT-HOME-001',
    '--out', 'teams360-automation/output/live-session-run',
  ]);
  assert.equal(validateTeamsCasebookOptions(options), options);
  assert.match(options.session, /teams360-automation\/state\/session\.json$/);
  assert.equal(
    validateLiveCasebookSession({ profile_mode: 'live', cdp_url: 'http://127.0.0.1:58401' }),
    'http://127.0.0.1:58401',
  );
});

test('a controlled live-host relaunch can be adopted only with the same executable, profile, CDP and control plane', () => {
  const session = {
    profile_mode: 'live',
    app_path: '/Applications/360Teams.app',
    executable: '/Applications/360Teams.app/Contents/MacOS/360Teams',
    profile_dir: '/tmp/teams-live-profile',
    profile_alias: '/tmp/teams-live-alias',
    cdp_url: 'http://127.0.0.1:52364',
    port: 52364,
    control_plane_origin: 'https://deepbank-control-dev.sandbox.deepbank.daikuan.qihoo.net',
  };
  fs.mkdirSync(session.profile_dir, { recursive: true });
  fs.rmSync(session.profile_alias, { recursive: true, force: true });
  fs.symlinkSync(session.profile_dir, session.profile_alias, 'dir');
  const command = `${session.executable} --remote-debugging-address=127.0.0.1 --remote-debugging-port=52364 --user-data-dir=${session.profile_alias} --qbot-server=${session.control_plane_origin} --relaunch`;
  try {
    assert.equal(matchesRelaunchedLiveSession(session, { pid: 991, command }), true);
    assert.equal(matchesRelaunchedLiveSession(session, { pid: 991, command: command.replace('52364', '52365') }), false);
    assert.equal(matchesRelaunchedLiveSession(session, { pid: 991, command: command.replace(session.profile_alias, '/tmp/other') }), false);
    assert.equal(matchesRelaunchedLiveSession(session, { pid: 991, command: command.replace(session.control_plane_origin, 'https://qbot-api.360shuke.com') }), false);
    assert.equal(
      matchesRelaunchedLiveSession(session, {
        pid: 991,
        command: command.replace(` --qbot-server=${session.control_plane_origin}`, ''),
      }),
      true,
    );
  } finally {
    fs.rmSync(session.profile_alias, { force: true });
    fs.rmSync(session.profile_dir, { recursive: true, force: true });
  }
});

test('functional Casebook runs reject isolated profiles and token-seeded authentication', () => {
  assert.throws(
    () => validateLiveCasebookSession({ profile_mode: 'isolated', cdp_url: 'http://127.0.0.1:58401' }),
    /OAuth\/token seeding are not accepted/,
  );
  assert.throws(() => validateLiveCasebookSession(null), /No managed 360Teams session exists/);
});

test('the Teams wrapper removes synthetic tails and resumes from recoverable adapter failures', () => {
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'teams360-recovery-'));
  const progressFile = path.join(outDir, 'automation-progress.json');
  const summaryFile = path.join(outDir, 'automation-run-summary.json');
  const results = [
    { id: 'SIT-HOME-001', status: 'passed', result_category: 'pass' },
    {
      id: 'SIT-HOME-004',
      status: 'failed',
      result_category: 'bug',
      actual_result: "ENOENT: open '/workspace/teams360-automation/testfixtures/skillhub-regression/manifest.json'",
    },
    {
      id: 'SIT-HOME-005',
      status: 'blocked',
      result_category: 'automation_error',
      actual_result: 'Target page, context or browser has been closed',
    },
  ];
  fs.writeFileSync(progressFile, JSON.stringify({ completed: 3, total: 178, stopped: true, results }));
  fs.writeFileSync(summaryFile, JSON.stringify({ status: 'failed', counts: { total: 178 } }));
  try {
    const repaired = repairInterruptedTeamsProgress({ outDir, pass: 1 });
    assert.equal(repaired.repaired, true);
    assert.equal(repaired.startIndex, 1);
    assert.equal(repaired.firstCaseId, 'SIT-HOME-004');
    const progress = JSON.parse(fs.readFileSync(progressFile, 'utf8'));
    assert.equal(progress.completed, 1);
    assert.deepEqual(progress.results.map((result) => result.id), ['SIT-HOME-001']);
    const recovering = JSON.parse(fs.readFileSync(summaryFile, 'utf8'));
    assert.equal(recovering.status, 'recovering');
    assert.equal(fs.existsSync(path.join(outDir, 'logs', 'teams-recovery-pass-01-progress.json')), true);
  } finally {
    fs.rmSync(outDir, { recursive: true, force: true });
  }
});

test('a frozen-run runtime update activation risk is never resumed in the same output directory', () => {
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'teams360-runtime-update-stop-'));
  const progressFile = path.join(outDir, 'automation-progress.json');
  try {
    fs.writeFileSync(progressFile, JSON.stringify({
      completed: 0,
      total: 83,
      stopped: true,
      results: [{
        id: 'BETA-PERF-003',
        status: 'failed',
        result_category: 'automation_error',
        actual_result: '检测到待激活 QWork 更新 0.1.4-sit.17；冻结版本=0.1.4-sit.11；已保留提示且拒绝继续发送。',
      }],
    }));
    const repair = repairInterruptedTeamsProgress({ outDir, pass: 1 });
    assert.equal(repair.repaired, false);
    assert.equal(repair.reason, 'no-recoverable-framework-result');
    const progress = JSON.parse(fs.readFileSync(progressFile, 'utf8'));
    assert.equal(progress.stopped, true);
    assert.equal(progress.results.length, 1);
  } finally {
    fs.rmSync(outDir, { recursive: true, force: true });
  }
});

test('the Teams wrapper retries a QWork reply-poll hard timeout from the affected Case', () => {
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'teams360-reply-poll-recovery-'));
  const progressFile = path.join(outDir, 'automation-progress.json');
  try {
    fs.writeFileSync(progressFile, JSON.stringify({
      completed: 2,
      total: 53,
      results: [
        { id: 'SIT-ART-004', status: 'passed', actual_result: 'ok' },
        {
          id: 'SIT-ART-005',
          status: 'failed',
          actual_result: 'QWork reply-poll operation timed out: conversation snapshot after 15000ms',
        },
      ],
    }));
    const repaired = repairInterruptedTeamsProgress({ outDir, pass: 2 });
    assert.equal(repaired.repaired, true);
    assert.equal(repaired.startIndex, 1);
    assert.equal(repaired.firstCaseId, 'SIT-ART-005');
    const progress = JSON.parse(fs.readFileSync(progressFile, 'utf8'));
    assert.deepEqual(progress.results.map((result) => result.id), ['SIT-ART-004']);
  } finally {
    fs.rmSync(outDir, { recursive: true, force: true });
  }
});

test('the Teams wrapper resumes a completed-looking synthetic CDP tail', () => {
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'teams360-synthetic-tail-'));
  const progressFile = path.join(outDir, 'automation-progress.json');
  const summaryFile = path.join(outDir, 'automation-run-summary.json');
  const reason = '用例 SIT-ART-015 执行后 QBot CDP/page 已断开，Target page, context or browser has been closed';
  const results = [
    { id: 'SIT-ART-015', status: 'failed', result_category: 'automation_error', actual_result: reason, synthetic: true },
    { id: 'SIT-TEAMS-NEW-001', status: 'blocked', result_category: 'automation_error', actual_result: reason, synthetic: true },
  ];
  fs.writeFileSync(progressFile, JSON.stringify({ completed: 2, total: 2, stopped: true, synthetic: true, results }));
  fs.writeFileSync(summaryFile, JSON.stringify({ status: 'blocked', ended_at: new Date().toISOString(), counts: { total: 2 } }));
  try {
    const repaired = repairInterruptedTeamsProgress({ outDir, pass: 1 });
    assert.equal(repaired.repaired, true);
    assert.equal(repaired.startIndex, 0);
    assert.equal(repaired.firstCaseId, 'SIT-ART-015');
    const progress = JSON.parse(fs.readFileSync(progressFile, 'utf8'));
    assert.equal(progress.completed, 0);
    assert.deepEqual(progress.results, []);
  } finally {
    fs.rmSync(outDir, { recursive: true, force: true });
  }
});

test('the Teams wrapper never rewinds a normally completed run because of an older framework result', () => {
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'teams360-complete-no-rewind-'));
  const progressFile = path.join(outDir, 'automation-progress.json');
  const summaryFile = path.join(outDir, 'automation-run-summary.json');
  const results = [
    { id: 'SIT-HOME-050', status: 'failed', result_category: 'automation_error', actual_result: 'Target page, context or browser has been closed' },
    { id: 'SIT-RUNTIME-RECOVER-001', status: 'passed', result_category: 'pass', actual_result: 'ok' },
  ];
  fs.writeFileSync(progressFile, JSON.stringify({ completed: 2, total: 2, results }));
  fs.writeFileSync(summaryFile, JSON.stringify({ status: 'failed', ended_at: new Date().toISOString(), counts: { total: 2, passed: 1, failed: 1 } }));
  try {
    const before = fs.readFileSync(progressFile, 'utf8');
    const repaired = repairInterruptedTeamsProgress({ outDir, pass: 1 });
    assert.deepEqual(repaired, { repaired: false, reason: 'run-complete' });
    assert.equal(fs.readFileSync(progressFile, 'utf8'), before);
    assert.equal(fs.existsSync(path.join(outDir, 'logs')), false);
  } finally {
    fs.rmSync(outDir, { recursive: true, force: true });
  }
});

test('the Teams wrapper preserves a completed run whose progress carries a final stopped marker', () => {
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'teams360-complete-stopped-no-rewind-'));
  const progressFile = path.join(outDir, 'automation-progress.json');
  const summaryFile = path.join(outDir, 'automation-run-summary.json');
  const results = [
    { id: 'SIT-HOME-016', status: 'failed', result_category: 'automation_error', actual_result: 'Target page, context or browser has been closed' },
    { id: 'SIT-RUNTIME-RECOVER-001', status: 'failed', result_category: 'automation_error', actual_result: 'runtime fixture stopped after validation' },
  ];
  fs.writeFileSync(progressFile, JSON.stringify({ completed: 2, total: 2, stopped: true, results }));
  fs.writeFileSync(summaryFile, JSON.stringify({ status: 'failed', ended_at: new Date().toISOString(), counts: { total: 2, passed: 0, failed: 2 } }));
  try {
    const beforeProgress = fs.readFileSync(progressFile, 'utf8');
    const beforeSummary = fs.readFileSync(summaryFile, 'utf8');
    const repaired = repairInterruptedTeamsProgress({ outDir, pass: 1 });
    assert.deepEqual(repaired, { repaired: false, reason: 'run-complete' });
    assert.equal(fs.readFileSync(progressFile, 'utf8'), beforeProgress);
    assert.equal(fs.readFileSync(summaryFile, 'utf8'), beforeSummary);
    assert.equal(fs.existsSync(path.join(outDir, 'logs')), false);
  } finally {
    fs.rmSync(outDir, { recursive: true, force: true });
  }
});

test('trusted review selects the archived complete result over a recovery sentinel', () => {
  const source = fs.readFileSync(new URL('../lib/trusted-review.mjs', import.meta.url), 'utf8');
  assert.match(source, /resolveCanonicalRunInputs/);
  assert.match(source, /teams-recovery-pass-/);
  assert.match(source, /No complete, non-synthetic Casebook result/);
  assert.match(source, /source_progress: progressPath/);
  assert.doesNotMatch(source, /candidateProgressJson\.stopped\s*!==\s*true/);
  assert.match(source, /candidateProgressJson\.aborted\s*!==\s*true/);
  assert.match(source, /verifiedReviewOverride: override\?\.strict === true/);
  assert.match(source, /assessment\.classification === 'framework_issue'[\s\S]*'framework_issue'/);
  assert.match(source, /raw failed 与语义关键词断言不能单独升级/);
});

test('strict trusted-review overrides reject cross-case and setup-only screenshots', () => {
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'teams-review-scope-'));
  const caseA = path.join(outDir, 'cases', '001-SIT-A');
  const caseB = path.join(outDir, 'cases', '002-SIT-B');
  fs.mkdirSync(caseA, { recursive: true });
  fs.mkdirSync(caseB, { recursive: true });
  const report = path.join(caseA, 'case-report.md');
  const before = path.join(caseA, '01-before-send.png');
  const foreign = path.join(caseB, '05-after-reply.png');
  fs.writeFileSync(report, '# report');
  fs.writeFileSync(before, 'png');
  fs.writeFileSync(foreign, 'png');
  const result = { id: 'SIT-A', case_report: report, assertions: [] };
  const base = {
    id: 'SIT-A',
    reason: '完整理由',
    product_observation: '用户看到了完成结果',
    user_operation: '发送任务',
    expected_outcome: '得到结果',
  };
  try {
    assert.equal(pathInside(caseA, before), true);
    assert.equal(pathInside(caseA, foreign), false);
    const setupOnly = validateStrictReviewOverride({ outDir, result, item: { ...base, evidence: [before] }, trustedStatus: 'trusted_pass' });
    assert.equal(setupOnly.ok, false);
    assert.match(setupOnly.errors.join('\n'), /操作后结果截图/);
    const crossCase = validateStrictReviewOverride({ outDir, result, item: { ...base, evidence: [foreign] }, trustedStatus: 'trusted_pass' });
    assert.equal(crossCase.ok, false);
    assert.match(crossCase.errors.join('\n'), /越过当前 Case 目录/);
  } finally {
    fs.rmSync(outDir, { recursive: true, force: true });
  }
});

test('strict trusted pass requires structured resolution of failed user assertions', () => {
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'teams-review-failure-'));
  const caseDir = path.join(outDir, 'cases', '001-SIT-A');
  fs.mkdirSync(caseDir, { recursive: true });
  const report = path.join(caseDir, 'case-report.md');
  const screenshot = path.join(caseDir, '05-after-reply.png');
  fs.writeFileSync(report, '# report');
  fs.writeFileSync(screenshot, 'png');
  const result = {
    id: 'SIT-A',
    case_report: report,
    assertions: [{ name: '核心业务结果', status: 'failed' }],
  };
  const item = {
    id: 'SIT-A',
    reason: '断言解析错误',
    product_observation: '真实结果满足要求',
    user_operation: '发送任务',
    expected_outcome: '得到正确结果',
    evidence: [screenshot],
  };
  try {
    const missingResolution = validateStrictReviewOverride({ outDir, result, item, trustedStatus: 'trusted_pass' });
    assert.equal(missingResolution.ok, false);
    assert.match(missingResolution.errors.join('\n'), /核心业务结果/);
    const resolved = validateStrictReviewOverride({
      outDir,
      result,
      item: { ...item, resolved_failures: [{ assertion: '核心业务结果', reason: 'DOM 文本被错误解析', evidence: [screenshot] }] },
      trustedStatus: 'trusted_pass',
    });
    assert.equal(resolved.ok, true, resolved.errors.join('\n'));
  } finally {
    fs.rmSync(outDir, { recursive: true, force: true });
  }
});

test('run metadata pins bundle identity and rejects host drift on resume', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'teams-run-metadata-'));
  const app = path.join(root, '360Teams.app');
  const plist = path.join(app, 'Contents', 'Info.plist');
  fs.mkdirSync(path.dirname(plist), { recursive: true });
  fs.writeFileSync(plist, 'fixture');
  const identity = readMacAppBundleIdentity(app, (_command, args) => (
    args[1] === 'CFBundleShortVersionString' ? '5.2.17\n' : '2119072078\n'
  ));
  const metadata = {
    schema_version: 1,
    captured_at: '2026-07-21T00:00:00.000Z',
    last_observed_at: '2026-07-21T00:00:00.000Z',
    host: identity,
    qwork: { version: '0.0.8', url: 'file:///Users/test/.deepbank/ui/0.0.8/index.html' },
    control_plane: { origin: 'https://dev.example.test' },
    model_tier: 'M3',
    timeout_ms: 600000,
    observed_host_pids: [101],
    selected_case_ids: ['SIT-A'],
  };
  try {
    writePinnedRunMetadata(root, metadata);
    writePinnedRunMetadata(root, { ...metadata, last_observed_at: '2026-07-21T00:01:00.000Z', observed_host_pids: [202] });
    const saved = JSON.parse(fs.readFileSync(path.join(root, 'run-metadata.json'), 'utf8'));
    assert.deepEqual(saved.observed_host_pids, [101, 202]);
    assert.throws(
      () => writePinnedRunMetadata(root, { ...metadata, host: { ...metadata.host, build: 'wrong' } }),
      /identity drift.*host\.build/i,
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('release artifact fingerprints cover the Teams binary, QWork payload and Casebook contents', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'teams-release-fingerprint-'));
  try {
    const app = path.join(root, '360Teams.app');
    const plist = path.join(app, 'Contents', 'Info.plist');
    const binary = path.join(app, 'Contents', 'MacOS', '360Teams');
    const qwork = path.join(root, 'qwork', '1.0.0');
    const index = path.join(qwork, 'index.html');
    const installed = path.join(qwork, '.installed.json');
    const casebook = path.join(root, 'casebook.xlsx');
    fs.mkdirSync(path.dirname(binary), { recursive: true });
    fs.mkdirSync(qwork, { recursive: true });
    fs.writeFileSync(plist, 'plist-content');
    fs.writeFileSync(binary, 'binary-content');
    fs.writeFileSync(index, '<!doctype html>');
    fs.writeFileSync(installed, '{"status":"ready"}');
    fs.writeFileSync(casebook, 'casebook-content');
    const first = buildReleaseArtifactFingerprints({
      host: { app_path: app },
      qworkUiUrl: `file://${index}`,
      casebookPath: casebook,
    });
    for (const field of ['host_info_plist_sha256', 'host_main_binary_sha256', 'qwork_index_sha256', 'qwork_install_metadata_sha256', 'casebook_sha256']) {
      assert.match(first[field], /^[a-f0-9]{64}$/);
    }
    fs.writeFileSync(index, '<!doctype html><title>changed</title>');
    const changed = buildReleaseArtifactFingerprints({ host: { app_path: app }, qworkUiUrl: `file://${index}`, casebookPath: casebook });
    assert.notEqual(changed.qwork_index_sha256, first.qwork_index_sha256);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('trusted validation overlay can select a clean subset from a complete matching run', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'teams-trusted-overlay-'));
  const outDir = path.join(root, 'validation');
  fs.mkdirSync(outDir, { recursive: true });
  const targetHost = {
    product: '360Teams',
    version: '5.2.17',
    build: '2119072078',
    qwork: '0.0.8',
    control_plane_origin: 'https://dev.example.test',
    model_tier: 'M3',
    timeout_ms: 600000,
  };
  const metadata = {
    host: { product: '360Teams', version: '5.2.17', build: '2119072078' },
    qwork: { version: '0.0.8' },
    control_plane: { origin: 'https://dev.example.test' },
    model_tier: 'M3',
    timeout_ms: 600000,
    selected_case_ids: ['SIT-A', 'SIT-B'],
  };
  const manifest = path.join(root, 'manifest.json');
  fs.writeFileSync(manifest, JSON.stringify({
    schema_version: 1,
    sources: [{ out_dir: 'validation', expected_case_ids: ['SIT-A', 'SIT-B'], include_case_ids: ['SIT-A'] }],
  }));
  fs.writeFileSync(path.join(outDir, 'run-metadata.json'), JSON.stringify(metadata));
  fs.writeFileSync(path.join(outDir, 'automation-progress.json'), JSON.stringify({
    completed: 2,
    total: 2,
    results: [{ id: 'SIT-A' }, { id: 'SIT-B' }],
  }));
  fs.writeFileSync(path.join(outDir, 'automation-run-summary.json'), JSON.stringify({
    status: 'failed',
    ended_at: '2026-07-21T00:10:00.000Z',
    counts: { total: 2, failed: 2 },
  }));
  fs.writeFileSync(path.join(outDir, '可信二次复核结果.json'), JSON.stringify({
    trusted_counts: { trusted_bug: 1, framework_issue: 1, needs_review: 0 },
    results: [{ id: 'SIT-A', trusted_status: 'trusted_bug' }, { id: 'SIT-B', trusted_status: 'framework_issue' }],
  }));
  try {
    const loaded = loadTrustedValidationSources({ manifestPath: manifest, baselineIds: ['SIT-A', 'SIT-B'], targetHost });
    assert.equal(loaded.byId.get('SIT-A').trusted_status, 'trusted_bug');
    assert.equal(loaded.byId.has('SIT-B'), false);
    assert.equal(assertRunMetadataHost(metadata, targetHost).ok, true);
    fs.writeFileSync(path.join(outDir, 'run-metadata.json'), JSON.stringify({
      ...metadata,
      host: { ...metadata.host, build: 'wrong' },
    }));
    assert.throws(
      () => loadTrustedValidationSources({ manifestPath: manifest, baselineIds: ['SIT-A', 'SIT-B'], targetHost }),
      /host identity mismatch/i,
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('QWork 0.0.14 connector bridge result survives omitted legacy capability fields', () => {
  assert.equal(unifiedConnectorModeApplied({ selectedConnectors: undefined }, 'disabled', []), true);
  assert.equal(unifiedConnectorModeApplied({ selectedConnectors: undefined }, 'disabled', undefined), false);
  assert.equal(unifiedConnectorModeApplied({ selectedConnectors: [] }, 'disabled', undefined), true);
  assert.equal(unifiedConnectorModeApplied({ selectedConnectors: undefined }, 'auto', null), true);
  assert.equal(unifiedConnectorModeApplied({ selectedConnectors: undefined }, 'disabled', null), false);
});

test('QWork 0.0.17 work-mode readback requires public state and the refactored visible chip to agree', () => {
  assert.equal(workModeSelectionVerdict({
    mode: 'craft',
    stored: '',
    chipVisible: false,
    chipText: '',
  }).ok, true);
  assert.equal(workModeSelectionVerdict({
    mode: 'ask',
    stored: 'ask',
    chipVisible: true,
    chipText: '问答',
  }).ok, true);
  assert.equal(workModeSelectionVerdict({
    mode: 'plan',
    stored: 'plan',
    chipVisible: true,
    chipText: '规划',
  }).ok, true);
  assert.equal(workModeSelectionVerdict({
    mode: 'ask',
    stored: '',
    chipVisible: true,
    chipText: '问答',
  }).ok, false);
  assert.equal(workModeSelectionVerdict({
    mode: 'plan',
    stored: 'plan',
    chipVisible: false,
    chipText: '',
  }).ok, false);
  assert.equal(workModeSelectionVerdict({
    mode: 'craft',
    stored: '',
    chipVisible: true,
    chipText: '问答',
  }).ok, false);
  const runnerSource = fs.readFileSync(
    new URL('../../src/lib/ui-agent-casebook-runner.mjs', import.meta.url),
    'utf8',
  );
  assert.match(
    runnerSource,
    /captured cross-view installed capability selection readback/,
  );
});
