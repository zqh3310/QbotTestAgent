#!/usr/bin/env node

import { DEFAULT_APP, DEFAULT_SESSION, normalizeCdpUrl, validatePinnedQworkUiUrl } from './config.mjs';
import {
  launchLiveTeams,
  processMatchesSession,
  readSession,
  stopIsolatedTeams,
} from './launcher.mjs';

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
const controlPlaneOrigin = new URL(controlPlane).origin;

const previous = readSession(DEFAULT_SESSION);
if (!previous || previous.profile_mode !== 'live' || !processMatchesSession(previous)) {
  throw new Error('Managed live 360Teams session is unavailable; refusing an unscoped host restart.');
}
const pinnedQworkUi = await resolvePinnedQworkUi(previous, expectedQworkUi);
const environment = {
  DEEPBANK_SURFACE: 'workbench',
  DEEPBANK_UI_URL: pinnedQworkUi.url,
  // 360Teams owns the WebView bootstrap and reads its QBOT_* variables before
  // QWork itself can inspect DEEPBANK_* variables.  Set both namespaces so a
  // managed relaunch cannot silently fall back to the host's cached 0.0.4 UI
  // or packaged control plane while the session metadata claims otherwise.
  QBOT_SURFACE: 'workbench',
  QBOT_UI_URL: pinnedQworkUi.url,
  QBOT_SERVER_URL: controlPlane,
  // The deterministic HITL Ask marker is implemented by the downloaded
  // desktop runtime's mock-agent lane.  Keep it an explicit, per-relaunch
  // opt-in so ordinary Casebook runs always exercise the real Agent.
  DEEPBANK_AGENT_MOCK: agentMock,
  ...(controlPlaneOrigin === packagedControlPlaneOrigin ? {} : { DEEPBANK_SERVER: controlPlane }),
};

const snapshot = {
  appPath: previous.app_path || DEFAULT_APP,
  profileDir: previous.profile_dir,
  profileAlias: previous.profile_alias,
  port: Number(previous.port || new URL(previous.cdp_url).port),
};
if (!snapshot.profileDir || !snapshot.profileAlias || !snapshot.port) {
  throw new Error('Managed live 360Teams session is missing profile/port identity.');
}

const stopped = stopIsolatedTeams(DEFAULT_SESSION);
if (stopped.status !== 'stopped') {
  throw new Error(`Managed 360Teams stop failed: ${stopped.status} ${stopped.reason || ''}`.trim());
}

const session = await launchLiveTeams({
  appPath: snapshot.appPath,
  profileDir: snapshot.profileDir,
  profileAlias: snapshot.profileAlias,
  sessionFile: DEFAULT_SESSION,
  port: snapshot.port,
  timeoutMs: 60_000,
  environment,
});

console.log(JSON.stringify({
  status: 'ready',
  pid: session.pid,
  cdp_url: session.cdp_url,
  control_plane_origin: session.control_plane_origin,
  agent_mock: agentMock === '1',
  qwork_ui_version: pinnedQworkUi.version,
}));

export async function resolvePinnedQworkUi(session, explicitUrl = '') {
  if (explicitUrl) return validatePinnedQworkUiUrl(explicitUrl);
  const cdpUrl = normalizeCdpUrl(String(session?.cdp_url || ''));
  const response = await fetch(`${cdpUrl}/json/list`, { signal: AbortSignal.timeout(5_000) });
  if (!response.ok) throw new Error(`Cannot inspect managed 360Teams CDP targets: HTTP ${response.status}`);
  const targets = await response.json();
  const candidate = (Array.isArray(targets) ? targets : [])
    .map((target) => String(target?.url || ''))
    .find((url) => /\/\.deepbank\/ui\/[^/]+\/index\.html(?:$|[?#])/.test(url));
  if (!candidate) throw new Error('Managed 360Teams CDP has no pinned QWork WebView URL; refusing restart.');
  return validatePinnedQworkUiUrl(candidate);
}
