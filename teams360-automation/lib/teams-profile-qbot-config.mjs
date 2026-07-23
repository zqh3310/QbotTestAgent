import fs from 'node:fs';
import path from 'node:path';

const CUSTOM_KEYS = ['env', 'serverUrl', 'uiUrl', 'surface'];
const CONFIG_KEYS = ['QBOT_ENV', 'QBOT_SERVER_URL', 'QBOT_UI_URL', 'QBOT_SURFACE'];

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function fieldSnapshot(object, key) {
  return Object.prototype.hasOwnProperty.call(object || {}, key)
    ? { present: true, value: object[key] }
    : { present: false };
}

function sectionSnapshot(object, keys) {
  return Object.fromEntries(keys.map((key) => [key, fieldSnapshot(object, key)]));
}

function restoreSection(object, snapshot) {
  for (const [key, field] of Object.entries(snapshot || {})) {
    if (field?.present) object[key] = field.value;
    else delete object[key];
  }
}

function normalizedServer(value) {
  const url = new URL(String(value || '').trim());
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
    throw new Error('Managed Teams QBot profile server must be a credential-free HTTP(S) URL.');
  }
  return url.href.replace(/\/$/, '');
}

function atomicWriteJson(file, payload) {
  const stat = fs.statSync(file);
  const temporary = `${file}.qbot-qa-${process.pid}-${Date.now()}.tmp`;
  fs.writeFileSync(temporary, `${JSON.stringify(payload, null, '\t')}\n`, { mode: stat.mode });
  fs.renameSync(temporary, file);
}

export function applyManagedQbotProfileConfig({
  profileDir,
  serverUrl,
  uiUrl,
  backupFile,
}) {
  const profile = path.resolve(profileDir);
  const configFile = path.join(profile, 'sk-teams-cfg.json');
  if (!fs.existsSync(configFile)) {
    throw new Error(`Managed Teams profile is missing sk-teams-cfg.json: ${configFile}`);
  }
  const targetServer = normalizedServer(serverUrl);
  const targetUi = String(uiUrl || '').trim();
  if (!/^file:\/\/.+\/ui\/[^/]+\/index\.html(?:$|[?#])/.test(targetUi)) {
    throw new Error(`Managed Teams QBot profile UI is not a pinned versioned file URL: ${targetUi}`);
  }

  const config = readJson(configFile);
  config.deepbank ||= {};
  config.deepbank.qbot_custom ||= {};
  config.configInfo ||= {};
  const custom = config.deepbank.qbot_custom;
  const configInfo = config.configInfo;
  const currentServer = normalizedServer(custom.serverUrl || configInfo.QBOT_SERVER_URL || targetServer);
  let backup = null;
  try { backup = backupFile && fs.existsSync(backupFile) ? readJson(backupFile) : null; } catch {}

  if (backup?.profile_dir === profile && normalizedServer(backup.restore_server_url) === targetServer) {
    restoreSection(custom, backup.deepbank_qbot_custom);
    restoreSection(configInfo, backup.config_info);
    atomicWriteJson(configFile, config);
    fs.rmSync(backupFile, { force: true });
    return { mode: 'restored', configFile, serverUrl: targetServer, uiUrl: targetUi };
  }

  if (!backup && currentServer === targetServer) {
    return { mode: 'unchanged', configFile, serverUrl: targetServer, uiUrl: targetUi };
  }

  if (!backup && backupFile) {
    fs.mkdirSync(path.dirname(backupFile), { recursive: true });
    backup = {
      schema_version: 1,
      profile_dir: profile,
      restore_server_url: currentServer,
      deepbank_qbot_custom: sectionSnapshot(custom, CUSTOM_KEYS),
      config_info: sectionSnapshot(configInfo, CONFIG_KEYS),
      captured_at: new Date().toISOString(),
    };
    fs.writeFileSync(backupFile, `${JSON.stringify(backup, null, 2)}\n`, { mode: 0o600 });
  }

  Object.assign(custom, {
    env: 'DEV',
    serverUrl: targetServer,
    surface: 'workbench',
  });
  Object.assign(configInfo, {
    QBOT_ENV: 'DEV',
    QBOT_SERVER_URL: targetServer,
    QBOT_UI_URL: targetUi,
    QBOT_SURFACE: 'workbench',
  });
  atomicWriteJson(configFile, config);
  return { mode: 'overridden', configFile, serverUrl: targetServer, uiUrl: targetUi };
}

export function stagedQbotServer(profileDir) {
  const bridge = path.join(path.resolve(profileDir), 'qbot', 'qbot-agent-bridge.cjs');
  if (!fs.existsSync(bridge)) return '';
  const text = fs.readFileSync(bridge, 'utf8').slice(0, 4096);
  const match = text.match(/process\.env\.DEEPBANK_SERVER\s*=\s*("(?:[^"\\]|\\.)*")\s*;/);
  if (!match) return '';
  try { return normalizedServer(JSON.parse(match[1])); } catch { return ''; }
}

export async function waitForStagedQbotServer(profileDir, expectedServer, timeoutMs = 30_000) {
  const expected = normalizedServer(expectedServer);
  const deadline = Date.now() + timeoutMs;
  let actual = '';
  while (Date.now() < deadline) {
    actual = stagedQbotServer(profileDir);
    if (actual === expected) return { ok: true, expected, actual };
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  return { ok: false, expected, actual };
}
