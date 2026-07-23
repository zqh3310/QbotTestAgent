import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const AUTOMATION_ROOT = path.resolve(HERE, '..');
export const PROJECT_ROOT = path.resolve(AUTOMATION_ROOT, '..');
export const DEFAULT_APP = '/Applications/360Teams.app';
export const DEFAULT_PROFILE = path.join(AUTOMATION_ROOT, 'state', 'profile');
export const LIVE_PROFILE = path.join(os.homedir(), 'Library', 'Application Support', '360Teams');
export const LIVE_PROFILE_ALIAS = path.join(AUTOMATION_ROOT, 'state', 'live-profile-alias');
export const DEFAULT_SESSION = path.join(AUTOMATION_ROOT, 'state', 'session.json');
export const DEFAULT_TIMEOUT_MS = 30_000;

const COMMANDS = new Set(['launch', 'launch-live', 'doctor', 'smoke', 'stop']);
const VALUE_OPTIONS = new Set([
  'app',
  'profile',
  'session',
  'out',
  'cdp',
  'port',
  'timeout-ms',
  'prompt',
  'expect',
  'control-plane-url',
]);
const BOOLEAN_OPTIONS = new Set(['open-qbot', 'capture-host', 'allow-write', 'help']);

export function parseArgs(argv = []) {
  const input = [...argv];
  let command = 'doctor';
  if (input[0] && !input[0].startsWith('--')) {
    command = input.shift();
  }
  if (!COMMANDS.has(command)) throw new Error(`Unsupported command: ${command}`);

  const values = {};
  while (input.length) {
    const token = input.shift();
    if (!token.startsWith('--')) throw new Error(`Unexpected argument: ${token}`);
    const [rawName, inlineValue] = token.slice(2).split(/=(.*)/s, 2);
    if (BOOLEAN_OPTIONS.has(rawName)) {
      values[rawName] = inlineValue == null ? true : inlineValue !== 'false';
      continue;
    }
    if (!VALUE_OPTIONS.has(rawName)) throw new Error(`Unknown option: --${rawName}`);
    const value = inlineValue == null ? input.shift() : inlineValue;
    if (value == null || value.startsWith('--')) throw new Error(`Missing value for --${rawName}`);
    values[rawName] = value;
  }

  const stamp = timestampForPath();
  const outputDir = values.out
    ? path.resolve(PROJECT_ROOT, values.out)
    : path.join(AUTOMATION_ROOT, 'output', `${stamp}-${command}`);
  if (command === 'launch-live' && values.profile) {
    throw new Error('--profile is not allowed with launch-live; it intentionally uses the existing 360Teams profile.');
  }
  const profileMode = command === 'launch-live' ? 'live' : 'isolated';
  const port = values.port == null ? 0 : Number(values.port);
  const timeoutMs = values['timeout-ms'] == null ? DEFAULT_TIMEOUT_MS : Number(values['timeout-ms']);
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error(`Invalid --port: ${values.port}`);
  if (!Number.isFinite(timeoutMs) || timeoutMs < 1000) throw new Error(`Invalid --timeout-ms: ${values['timeout-ms']}`);
  const controlPlaneUrl = String(values['control-plane-url'] || '').trim();
  if (controlPlaneUrl) {
    const parsed = new URL(controlPlaneUrl);
    if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) {
      throw new Error('Managed QBot control plane must be a credential-free HTTP(S) URL.');
    }
  }

  return {
    command,
    appPath: path.resolve(values.app || DEFAULT_APP),
    profileDir: path.resolve(profileMode === 'live' ? LIVE_PROFILE : values.profile || DEFAULT_PROFILE),
    profileAlias: profileMode === 'live' ? LIVE_PROFILE_ALIAS : '',
    profileMode,
    sessionFile: path.resolve(values.session || DEFAULT_SESSION),
    outputDir,
    cdpUrl: values.cdp ? normalizeCdpUrl(values.cdp) : '',
    port,
    timeoutMs,
    openQbot: Boolean(values['open-qbot']),
    captureHost: Boolean(values['capture-host']),
    allowWrite: Boolean(values['allow-write']),
    prompt: String(values.prompt || '360Teams 集成自动化冒烟：请只回复 TEAMS_CASE_OK。'),
    expected: String(values.expect || 'TEAMS_CASE_OK'),
    controlPlaneUrl,
    environment: controlPlaneUrl ? { DEEPBANK_SERVER: controlPlaneUrl } : {},
    help: Boolean(values.help),
  };
}

export function normalizeCdpUrl(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  if (/^\d+$/.test(text)) return `http://127.0.0.1:${text}`;
  const url = new URL(text);
  if (!['127.0.0.1', 'localhost', '[::1]', '::1'].includes(url.hostname)) {
    throw new Error('360Teams CDP must bind to loopback only.');
  }
  return url.origin;
}

export function validatePinnedQworkUiUrl(value, {
  runtimeHome = '',
  homeDir = os.homedir(),
} = {}) {
  const url = new URL(String(value || '').trim());
  if (url.protocol !== 'file:') {
    throw new Error('The pinned QWork UI must be a local file URL.');
  }
  const file = fileURLToPath(url);
  const resolved = path.resolve(file);
  const runtimeHomes = runtimeHome
    ? [path.resolve(runtimeHome)]
    : ['', 'dev', 'local', 'uat'].map((suffix) => path.join(
      homeDir,
      suffix ? `.deepbank-${suffix}` : '.deepbank',
    ));
  const uiRoot = runtimeHomes
    .map((home) => path.resolve(home, 'ui'))
    .find((candidate) => {
      const relative = path.relative(candidate, resolved);
      return !relative.startsWith('..') && !path.isAbsolute(relative);
    });
  if (!uiRoot) {
    throw new Error(`The pinned QWork UI must stay under an allowed runtime home: ${runtimeHomes.join(', ')}.`);
  }
  const relative = path.relative(uiRoot, resolved);
  const parts = relative.split(path.sep);
  if (parts.length !== 2 || parts[1] !== 'index.html' || !parts[0]) {
    throw new Error('The pinned QWork UI must match <runtime-home>/ui/<version>/index.html.');
  }
  const version = parts[0];
  const markerFile = path.join(uiRoot, version, '.installed.json');
  if (!fs.existsSync(resolved) || !fs.existsSync(markerFile)) {
    throw new Error(`The pinned QWork UI ${version} is not fully installed.`);
  }
  let marker;
  try {
    marker = JSON.parse(fs.readFileSync(markerFile, 'utf8'));
  } catch {
    throw new Error(`The pinned QWork UI ${version} has an invalid install marker.`);
  }
  if (marker?.status !== 'ready' || String(marker?.version || '') !== version) {
    throw new Error(`The pinned QWork UI ${version} is not ready.`);
  }
  return { url: url.href, version, file: resolved };
}

export function assertIsolatedProfile(profileDir) {
  const resolved = path.resolve(profileDir);
  const liveProfile = path.resolve(path.join(os.homedir(), 'Library', 'Application Support', '360Teams'));
  const canonical = canonicalPath(resolved);
  const canonicalLive = canonicalPath(liveProfile);
  const relative = path.relative(canonicalLive, canonical);
  if (canonical === canonicalLive || (!relative.startsWith('..') && !path.isAbsolute(relative))) {
    throw new Error(`Refusing to use the live 360Teams profile: ${resolved}`);
  }
  if (resolved === path.parse(resolved).root || resolved === os.homedir()) {
    throw new Error(`Unsafe profile directory: ${resolved}`);
  }
  return resolved;
}

function canonicalPath(input) {
  const resolved = path.resolve(input);
  const missing = [];
  let cursor = resolved;
  while (!fs.existsSync(cursor)) {
    const parent = path.dirname(cursor);
    if (parent === cursor) return resolved;
    missing.unshift(path.basename(cursor));
    cursor = parent;
  }
  const real = fs.realpathSync.native(cursor);
  return path.join(real, ...missing);
}

export function redactText(value) {
  return String(value ?? '')
    .replace(/([?&]app_secret=)[^&#\s]+/gi, '$1[REDACTED]')
    .replace(/\bBearer\s+[A-Za-z0-9._~+\/-]+/gi, 'Bearer [REDACTED]')
    .replace(/((?:access_token|refresh_token|app_secret)\s*[=:]\s*["']?)[^"'\s,&}]+/gi, '$1[REDACTED]');
}

export function safeUrl(value) {
  try {
    const url = new URL(String(value || ''));
    url.search = '';
    url.hash = '';
    return redactText(url.href);
  } catch {
    return redactText(value).slice(0, 300);
  }
}

export function timestampForPath(date = new Date()) {
  const pad = (value) => String(value).padStart(2, '0');
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

export function usage() {
  return `360Teams QBot automation (isolated from the existing QBot runner)

Usage:
  npm run launch -- [--port 9333] [--profile <dir>]
  npm run launch:live -- [--port 9333] [--control-plane-url <url>]
  npm run doctor -- [--open-qbot] [--capture-host]
  npm run smoke -- --allow-write [--prompt <text>] [--expect <text>]
  npm run stop

Safety defaults:
  - Uses a dedicated profile under teams360-automation/state/profile.
  - launch-live uses the existing profile only after the regular client is closed.
  - Binds CDP to 127.0.0.1 only.
  - Never stops a pre-existing 360Teams process.
  - Doctor is read-only unless --open-qbot is explicitly supplied.
  - Smoke refuses to send a message without --allow-write.
`;
}
