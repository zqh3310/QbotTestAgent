#!/usr/bin/env node

import { DEFAULT_APP, DEFAULT_SESSION, normalizeCdpUrl, validatePinnedQworkUiUrl } from './config.mjs';
import {
  launchLiveTeams,
  processMatchesSession,
  readSession,
  stopIsolatedTeams,
} from './launcher.mjs';
import {
  applyManagedQbotProfileConfig,
  waitForStagedQbotServer,
} from './teams-profile-qbot-config.mjs';

const controlPlane = String(process.argv[2] || '').trim();
const expectedQworkUi = String(process.argv[3] || '').trim();
const agentMock = String(process.argv[4] || '0').trim();
if (!controlPlane) {
  console.error('Usage: node relaunch-managed-host.mjs <control-plane-url> [expected-qwork-ui-url] [agent-mock:0|1]');
  process.exit(2);
}
if (!['0', '1'].includes(agentMock)) {
  throw new Error(`Managed host agent-mock flag must be 0 or 1, received: ${agentMock}`);
}
const packagedControlPlaneOrigin = 'https://qbot-api.360shuke.com';

const previous = readSession(DEFAULT_SESSION);
if (!previous || previous.profile_mode !== 'live' || !processMatchesSession(previous)) {
  throw new Error('Managed live 360Teams session is unavailable; refusing an unscoped host restart.');
}
const pinnedQworkUi = await resolvePinnedQworkUi(previous, expectedQworkUi);
const snapshot = {
  appPath: previous.app_path || DEFAULT_APP,
  profileDir: previous.profile_dir,
  profileAlias: previous.profile_alias,
  port: Number(previous.port || new URL(previous.cdp_url).port),
  controlPlane: String(previous.control_plane_origin || '').trim(),
};
if (!snapshot.profileDir || !snapshot.profileAlias || !snapshot.port || !snapshot.controlPlane) {
  throw new Error('Managed live 360Teams session is missing profile/port identity.');
}

const stopped = stopIsolatedTeams(DEFAULT_SESSION);
if (stopped.status !== 'stopped') {
  throw new Error(`Managed 360Teams stop failed: ${stopped.status} ${stopped.reason || ''}`.trim());
}

const profileConfig = applyManagedQbotProfileConfig({
  profileDir: snapshot.profileDir,
  serverUrl: controlPlane,
  uiUrl: pinnedQworkUi.url,
  backupFile: `${DEFAULT_SESSION}.qbot-profile-backup.json`,
});
let session;
let stagedServer;
try {
  ({ session, stagedServer } = await launchWithProfile(controlPlane, agentMock));
} catch (error) {
  stopIsolatedTeams(DEFAULT_SESSION);
  let rollbackError = null;
  try {
    applyManagedQbotProfileConfig({
      profileDir: snapshot.profileDir,
      serverUrl: snapshot.controlPlane,
      uiUrl: pinnedQworkUi.url,
      backupFile: `${DEFAULT_SESSION}.qbot-profile-backup.json`,
    });
    await launchWithProfile(snapshot.controlPlane, '0');
  } catch (candidate) {
    rollbackError = candidate;
  }
  const rollbackDetail = rollbackError
    ? ` Automatic rollback to ${snapshot.controlPlane} also failed: ${rollbackError.message}`
    : ` Automatically rolled back to ${snapshot.controlPlane}.`;
  throw new Error(`${error.message}${rollbackDetail}`, { cause: error });
}

console.log(JSON.stringify({
  status: 'ready',
  pid: session.pid,
  cdp_url: session.cdp_url,
  control_plane_origin: session.control_plane_origin,
  agent_mock: agentMock === '1',
  qwork_ui_version: pinnedQworkUi.version,
  profile_config_mode: profileConfig.mode,
  staged_control_plane_origin: new URL(stagedServer.actual).origin,
}));

function managedEnvironment(serverUrl, mockFlag) {
  const origin = new URL(serverUrl).origin;
  return {
    DEEPBANK_SURFACE: 'workbench',
    DEEPBANK_UI_URL: pinnedQworkUi.url,
    // 360Teams owns the WebView bootstrap and reads its QBOT_* variables before
    // QWork itself can inspect DEEPBANK_* variables. Set both namespaces so a
    // managed relaunch cannot silently fall back to cached defaults.
    QBOT_SURFACE: 'workbench',
    QBOT_UI_URL: pinnedQworkUi.url,
    QBOT_SERVER_URL: serverUrl,
    // The deterministic HITL Ask marker is implemented by the downloaded
    // desktop runtime's mock-agent lane. Keep it an explicit, per-relaunch
    // opt-in so ordinary Casebook runs always exercise the real Agent.
    DEEPBANK_AGENT_MOCK: mockFlag,
    ...(origin === packagedControlPlaneOrigin ? {} : { DEEPBANK_SERVER: serverUrl }),
  };
}

async function launchWithProfile(serverUrl, mockFlag) {
  const launched = await launchLiveTeams({
    appPath: snapshot.appPath,
    profileDir: snapshot.profileDir,
    profileAlias: snapshot.profileAlias,
    sessionFile: DEFAULT_SESSION,
    port: snapshot.port,
    timeoutMs: 60_000,
    environment: managedEnvironment(serverUrl, mockFlag),
  });
  const staged = await waitForStagedQbotServer(snapshot.profileDir, serverUrl, 30_000);
  if (!staged.ok) {
    stopIsolatedTeams(DEFAULT_SESSION);
    throw new Error(
      `Managed 360Teams staged QWork preload did not adopt the requested control plane: `
      + `expected=${staged.expected} actual=${staged.actual || 'missing'}`,
    );
  }
  return { session: launched, stagedServer: staged };
}

export async function resolvePinnedQworkUi(session, explicitUrl = '') {
  if (explicitUrl) return validatePinnedQworkUiUrl(explicitUrl);
  const cdpUrl = normalizeCdpUrl(String(session?.cdp_url || ''));
  const response = await fetch(`${cdpUrl}/json/list`, { signal: AbortSignal.timeout(5_000) });
  if (!response.ok) throw new Error(`Cannot inspect managed 360Teams CDP targets: HTTP ${response.status}`);
  const targets = await response.json();
  const candidate = (Array.isArray(targets) ? targets : [])
    .map((target) => String(target?.url || ''))
    .find((url) => /\/\.deepbank(?:-(?:dev|local|uat))?\/ui\/[^/]+\/index\.html(?:$|[?#])/.test(url));
  if (!candidate) throw new Error('Managed 360Teams CDP has no pinned QWork WebView URL; refusing restart.');
  return validatePinnedQworkUiUrl(candidate);
}
