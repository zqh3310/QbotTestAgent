import { execFileSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { assertIsolatedProfile, normalizeCdpUrl, redactText } from './config.mjs';
import {
  IS_MACOS,
  IS_WINDOWS,
  listProcesses,
  processIdentity as portableProcessIdentity,
  terminateProcess,
} from './platform.mjs';

export function resolveExecutable(appPath) {
  const resolved = path.resolve(appPath);
  return IS_MACOS && resolved.endsWith('.app')
    ? path.join(resolved, 'Contents', 'MacOS', '360Teams')
    : resolved;
}

export function assertLaunchInputs({ appPath, profileDir }) {
  const executable = assertAppExecutable(appPath);
  return { executable, profileDir: assertIsolatedProfile(profileDir) };
}

export function assertAppExecutable(appPath) {
  const executable = resolveExecutable(appPath);
  if (!fs.existsSync(executable)) throw new Error(`360Teams executable not found: ${executable}`);
  if (!IS_WINDOWS) fs.accessSync(executable, fs.constants.X_OK);
  return executable;
}

export async function findFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on('error', reject);
    server.listen({ host: '127.0.0.1', port: 0 }, () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : 0;
      server.close((error) => error ? reject(error) : resolve(port));
    });
  });
}

export async function launchIsolatedTeams({ appPath, profileDir, sessionFile, port = 0, timeoutMs = 30_000 }) {
  const checked = assertLaunchInputs({ appPath, profileDir });
  const debugPort = port || await findFreePort();
  fs.mkdirSync(checked.profileDir, { recursive: true });
  fs.mkdirSync(path.dirname(sessionFile), { recursive: true });

  const existing = readSession(sessionFile);
  if (existing && processMatchesSession(existing)) {
    throw new Error(`An isolated 360Teams session is already running: pid=${existing.pid}, cdp=${existing.cdp_url}`);
  }
  if (existing) fs.rmSync(sessionFile, { force: true });

  const running = listRunningTeamsMainProcesses(checked.executable);
  if (running.length) {
    throw new Error(
      `A regular 360Teams instance is already running (pid=${running.map((item) => item.pid).join(',')}). `
      + 'Quit it manually before starting the isolated QA instance. The adapter will not stop or replace it.',
    );
  }

  const args = [
    '--remote-debugging-address=127.0.0.1',
    `--remote-debugging-port=${debugPort}`,
    `--user-data-dir=${checked.profileDir}`,
  ];
  const { child, processLog } = spawnManagedTeams({
    executable: checked.executable,
    args,
    sessionFile,
    env: managedTeamsEnvironment(process.env),
  });
  child.unref();

  const cdpUrl = normalizeCdpUrl(String(debugPort));
  try {
    const version = await waitForCdp({ cdpUrl, timeoutMs, child });
    const listenerPid = listenerPidForPort(debugPort) || child.pid;
    const identity = processIdentity(listenerPid);
    const session = {
      schema_version: 1,
      profile_mode: 'isolated',
      pid: listenerPid,
      launcher_pid: child.pid,
      app_path: path.resolve(appPath),
      executable: checked.executable,
      profile_dir: checked.profileDir,
      cdp_url: cdpUrl,
      port: debugPort,
      process_started: identity.started,
      process_command: redactText(identity.command),
      browser: String(version.Browser || ''),
      process_log: processLog,
      started_at: new Date().toISOString(),
    };
    fs.writeFileSync(sessionFile, `${JSON.stringify(session, null, 2)}\n`, { mode: 0o600 });
    return session;
  } catch (error) {
    terminatePid(child.pid, { forceAfterMs: 2500 });
    throw error;
  }
}

export async function launchLiveTeams({
  appPath,
  profileDir,
  profileAlias,
  sessionFile,
  port = 0,
  timeoutMs = 30_000,
  environment = {},
  e2e = true,
}) {
  const executable = assertAppExecutable(appPath);
  const debugPort = port || await findFreePort();
  fs.mkdirSync(path.dirname(sessionFile), { recursive: true });
  const liveProfile = fs.realpathSync.native(path.resolve(profileDir));
  const liveAlias = ensureProfileAlias({ profileDir: liveProfile, aliasPath: profileAlias });

  const existing = readSession(sessionFile);
  if (existing && processMatchesSession(existing)) {
    throw new Error(`A managed 360Teams session is already running: pid=${existing.pid}, cdp=${existing.cdp_url}`);
  }
  if (existing) fs.rmSync(sessionFile, { force: true });

  const running = listRunningTeamsMainProcesses(executable);
  if (running.length) {
    throw new Error(
      `A regular 360Teams instance is already running (pid=${running.map((item) => item.pid).join(',')}). `
      + 'Quit it before launch-live. The adapter will not stop or replace it.',
    );
  }

  // A force-quit or host crash can leave Chromium's singleton symlinks behind.
  // Electron then exits immediately without opening the requested CDP port.  It
  // is safe to clear these links only after the exact 360Teams main executable
  // has been proven absent above.  Refuse to remove regular files/directories so
  // an unexpected profile shape can never be destroyed by the QA adapter.
  clearStaleChromiumSingletonLinks(liveProfile);

  // Chromium 136+ ignores remote-debugging switches for the default profile.
  // Electron 42 inherits that guard. A symlinked path is non-default to
  // Chromium while still resolving to the exact signed-in 360Teams profile,
  // so QWork keeps its host bootstrap and no OAuth/token copying is required.
  const args = [
    '--remote-debugging-address=127.0.0.1',
    `--remote-debugging-port=${debugPort}`,
    `--user-data-dir=${liveAlias}`,
    ...managedQbotLaunchArgs(environment),
  ];
  const { child, processLog } = spawnManagedTeams({
    executable,
    args,
    sessionFile,
    env: managedTeamsEnvironment({ ...process.env, ...environment }, { e2e }),
  });
  child.unref();

  const cdpUrl = normalizeCdpUrl(String(debugPort));
  try {
    const version = await waitForCdp({ cdpUrl, timeoutMs, child });
    const listenerPid = listenerPidForPort(debugPort) || child.pid;
    const identity = processIdentity(listenerPid);
    const session = {
      schema_version: 1,
      profile_mode: 'live',
      pid: listenerPid,
      launcher_pid: child.pid,
      app_path: path.resolve(appPath),
      executable,
      profile_dir: liveProfile,
      profile_alias: liveAlias,
      cdp_url: cdpUrl,
      port: debugPort,
      process_started: identity.started,
      process_command: redactText(identity.command),
      browser: String(version.Browser || ''),
      control_plane_origin: managedControlPlaneOrigin(environment),
      release_env: String(environment.QBOT_RELEASE_ENV || environment.DEEPBANK_ENV || '').trim().toLowerCase(),
      process_log: processLog,
      started_at: new Date().toISOString(),
    };
    fs.writeFileSync(sessionFile, `${JSON.stringify(session, null, 2)}\n`, { mode: 0o600 });
    return session;
  } catch (error) {
    terminatePid(child.pid, { forceAfterMs: 2500 });
    throw error;
  }
}

export function managedTeamsProcessLog(sessionFile) {
  return path.join(path.dirname(path.resolve(sessionFile)), 'managed-360teams.log');
}

function spawnManagedTeams({ executable, args, sessionFile, env }) {
  const processLog = managedTeamsProcessLog(sessionFile);
  fs.mkdirSync(path.dirname(processLog), { recursive: true });
  fs.writeFileSync(processLog, '', { mode: 0o600 });
  const logFd = fs.openSync(processLog, 'a', 0o600);
  let child;
  try {
    child = spawn(executable, args, {
      cwd: path.dirname(executable),
      detached: true,
      // DEEPBANK_E2E intentionally records OAuth openExternal URLs instead of
      // launching a browser. Persist the child log so the adapter can open that
      // one-time URL for the tester without disabling the QWork E2E bridge.
      stdio: ['ignore', logFd, logFd],
      env,
    });
  } finally {
    fs.closeSync(logFd);
  }
  child.unref();
  return { child, processLog };
}

function safeControlPlaneOrigin(value) {
  try {
    return value ? new URL(String(value)).origin : '';
  } catch {
    return '';
  }
}

export function managedControlPlaneOrigin(environment = {}) {
  return safeControlPlaneOrigin(
    environment.DEEPBANK_SERVER || environment.QBOT_SERVER_URL,
  );
}

export function managedTeamsEnvironment(source = process.env, { e2e = true } = {}) {
  return {
    ...source,
    // The packaged QBot deliberately exposes file staging, workspace binding
    // and deterministic renderer state only to explicitly managed E2E hosts.
    // Scope this flag to the child 360Teams process; never mutate process.env or
    // the independent local-QBot runner.
    DEEPBANK_E2E: e2e ? '1' : '0',
  };
}

export function managedQbotLaunchArgs(environment = {}) {
  const args = [];
  const server = String(environment.DEEPBANK_SERVER || '').trim();
  if (server) {
    const parsed = new URL(server);
    if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) {
      throw new Error('Managed QBot server override must be a credential-free HTTP(S) URL.');
    }
    args.push(`--qbot-server=${parsed.href.replace(/\/$/, '')}`);
  }
  // 360Teams consumes the supported QWork environment override from
  // deepbank.qbot_custom. Passing --qbot-release-env to the host only changes
  // the runtime download home (for example to ~/.deepbank-dev); the packaged
  // WebView security guard does not trust that derived path and blocks QWork
  // before its preload can run. Keep the signed host on its standard resource
  // home and let the persisted QWork environment select the control plane.
  return args;
}

export function clearStaleChromiumSingletonLinks(profileDir) {
  const removed = [];
  for (const name of ['SingletonLock', 'SingletonCookie', 'SingletonSocket']) {
    const entry = path.join(path.resolve(profileDir), name);
    let stat = null;
    try { stat = fs.lstatSync(entry); } catch {}
    if (!stat) continue;
    if (!stat.isSymbolicLink()) {
      throw new Error(`Refusing to remove non-symlink Chromium singleton entry: ${entry}`);
    }
    fs.rmSync(entry);
    removed.push(entry);
  }
  return removed;
}

export function ensureProfileAlias({ profileDir, aliasPath }) {
  const profile = fs.realpathSync.native(path.resolve(profileDir));
  const alias = path.resolve(aliasPath);
  // Chromium's default-profile CDP restriction is specific to the packaged
  // macOS Electron lane. Windows can use the real profile directly; avoiding
  // a junction/symlink also keeps the adapter usable without Developer Mode.
  if (IS_WINDOWS) return profile;
  fs.mkdirSync(path.dirname(alias), { recursive: true });
  let stat = null;
  try { stat = fs.lstatSync(alias); } catch {}
  if (stat) {
    if (!stat.isSymbolicLink()) {
      throw new Error(`360Teams live profile alias is not a symlink: ${alias}`);
    }
    let existing = '';
    try { existing = fs.realpathSync.native(alias); } catch {
      throw new Error(`360Teams live profile alias is dangling: ${alias}`);
    }
    if (existing !== profile) {
      throw new Error(`360Teams live profile alias points elsewhere: ${alias}`);
    }
    return alias;
  }
  fs.symlinkSync(profile, alias, 'dir');
  return alias;
}

export async function waitForCdp({ cdpUrl, timeoutMs = 30_000, child = null }) {
  const deadline = Date.now() + timeoutMs;
  let lastError = '';
  while (Date.now() < deadline) {
    if (child?.exitCode != null) {
      throw new Error(`360Teams exited before CDP became ready (exit=${child.exitCode}). The app may enforce a single-instance lock.`);
    }
    try {
      const response = await fetch(`${cdpUrl}/json/version`, { signal: AbortSignal.timeout(1200), redirect: 'manual' });
      if (response.ok) {
        const body = await response.json();
        if (body.webSocketDebuggerUrl) return body;
        lastError = 'CDP response has no webSocketDebuggerUrl';
      } else {
        lastError = `HTTP ${response.status}`;
      }
    } catch (error) {
      lastError = error.message;
    }
    await delay(250);
  }
  throw new Error(`Timed out waiting for 360Teams CDP at ${cdpUrl}: ${redactText(lastError)}`);
}

export function readSession(sessionFile) {
  try {
    return JSON.parse(fs.readFileSync(sessionFile, 'utf8'));
  } catch {
    return null;
  }
}

export function managedSessionRecoveryError(code) {
  const error = new Error(`${code}: No verified managed 360Teams connection. Normally quit the regular client (with existing user authorization), then run npm --prefix teams360-automation run launch:live and doctor -- --open-qbot. Preserve previous outputs and use a new run directory.`);
  error.code = code;
  error.recovery = { command: 'npm --prefix teams360-automation run launch:live',
    normal_quit_regular_client: true, preserve_login_profile: true,
    never_force_kill: true, reuse_existing_authorization: true };
  return error;
}

export async function resolveSessionCdp({ sessionFile, cdpUrl, requireManaged = false }) {
  if (cdpUrl && !requireManaged) return { cdpUrl, session: readSession(sessionFile) };
  let session = readSession(sessionFile);
  if (!session?.cdp_url) throw managedSessionRecoveryError('TEAMS_SESSION_MISSING');
  if (!processMatchesSession(session)) {
    session = await adoptRelaunchedLiveTeamsSession(sessionFile, { timeoutMs: 10_000 });
  }
  if (!session || !processMatchesSession(session)) {
    throw managedSessionRecoveryError('TEAMS_SESSION_STALE');
  }
  if (cdpUrl && normalizeCdpUrl(cdpUrl) !== normalizeCdpUrl(session.cdp_url)) {
    throw managedSessionRecoveryError('TEAMS_CDP_MISMATCH');
  }
  return { cdpUrl: normalizeCdpUrl(session.cdp_url), session };
}

export function stopIsolatedTeams(sessionFile) {
  const session = readSession(sessionFile);
  if (!session) return { status: 'not-running', reason: 'No session file exists.' };
  if (!processMatchesSession(session)) {
    fs.rmSync(sessionFile, { force: true });
    return { status: 'stale-session', reason: 'Session PID is no longer the recorded 360Teams process.' };
  }
  terminatePid(Number(session.pid), { forceAfterMs: 5000 });
  fs.rmSync(sessionFile, { force: true });
  return { status: 'stopped', pid: Number(session.pid), profile_dir: session.profile_dir };
}

export function processMatchesSession(session) {
  const pid = Number(session?.pid);
  if (!Number.isInteger(pid) || pid <= 1) return false;
  const current = processIdentity(pid);
  if (!current.command || !/360Teams/.test(current.command)) return false;
  if (session.executable) {
    const command = IS_WINDOWS ? current.command.toLowerCase() : current.command;
    const expected = IS_WINDOWS ? String(session.executable).toLowerCase() : session.executable;
    if (command !== expected && !command.startsWith(`${expected} `)) return false;
  }
  if (session.process_started && current.started !== session.process_started) return false;
  if (session.profile_mode === 'live') {
    if (!session.profile_alias || !current.command.includes(`--user-data-dir=${session.profile_alias}`)) return false;
    try {
      if (fs.realpathSync.native(session.profile_alias) !== fs.realpathSync.native(session.profile_dir)) return false;
    } catch {
      return false;
    }
  } else if (session.profile_dir) {
    const command = IS_WINDOWS ? current.command.toLowerCase() : current.command;
    const profile = IS_WINDOWS ? String(session.profile_dir).toLowerCase() : session.profile_dir;
    if (!command.includes(profile)) return false;
  }
  return true;
}

export function matchesRelaunchedLiveSession(session, { pid, command } = {}) {
  const listenerPid = Number(pid);
  const currentCommand = String(command || '');
  if (session?.profile_mode !== 'live') return false;
  if (!Number.isInteger(listenerPid) || listenerPid <= 1 || !currentCommand) return false;
  const executable = path.resolve(String(session.executable || resolveExecutable(session.app_path || '')));
  if (currentCommand !== executable && !currentCommand.startsWith(`${executable} `)) return false;
  if (!session.profile_alias || !currentCommand.includes(`--user-data-dir=${session.profile_alias}`)) return false;
  const port = Number(session.port || safeCdpPort(session.cdp_url));
  if (!port || !currentCommand.includes(`--remote-debugging-port=${port}`)) return false;
  // Electron's app.relaunch() preserves the executable, live-profile alias and
  // CDP port, but the packaged client can omit launcher-only `--qbot-server`
  // arguments from the replacement process. Only compare that flag when the
  // replacement process actually declares one. The Casebook preconnect
  // independently re-reads and fail-closes on the QWork control-plane origin.
  const relaunchedControlPlane = currentCommand.match(/(?:^|\s)--qbot-server=([^\s]+)/)?.[1] || '';
  if (session.control_plane_origin
    && relaunchedControlPlane
    && relaunchedControlPlane !== session.control_plane_origin) return false;
  try {
    if (fs.realpathSync.native(session.profile_alias) !== fs.realpathSync.native(session.profile_dir)) return false;
  } catch {
    return false;
  }
  return true;
}

export async function adoptRelaunchedLiveTeamsSession(sessionFile, { timeoutMs = 30_000 } = {}) {
  const previous = readSession(sessionFile);
  if (!previous || previous.profile_mode !== 'live' || !previous.cdp_url) return null;
  if (processMatchesSession(previous)) return previous;
  const port = Number(previous.port || safeCdpPort(previous.cdp_url));
  if (!port) return null;
  const listenerPid = listenerPidForPort(port);
  if (!listenerPid) return null;
  const identity = processIdentity(listenerPid);
  if (!matchesRelaunchedLiveSession(previous, { pid: listenerPid, command: identity.command })) return null;
  const version = await waitForCdp({ cdpUrl: normalizeCdpUrl(previous.cdp_url), timeoutMs });
  const adopted = {
    ...previous,
    pid: listenerPid,
    launcher_pid: listenerPid,
    process_started: identity.started,
    process_command: redactText(identity.command),
    browser: String(version.Browser || previous.browser || ''),
    started_at: new Date().toISOString(),
    adopted_relaunch_at: new Date().toISOString(),
  };
  fs.writeFileSync(sessionFile, `${JSON.stringify(adopted, null, 2)}\n`, { mode: 0o600 });
  return adopted;
}

export async function settleRelaunchedLiveTeamsSession(sessionFile, {
  settleMs = 30_000,
  timeoutMs = 90_000,
} = {}) {
  const deadline = Date.now() + timeoutMs;
  let session = readSession(sessionFile);
  if (!session || session.profile_mode !== 'live') return session;
  let stablePid = Number(session.pid || 0);
  let stableSince = Date.now();
  while (Date.now() < deadline) {
    if (!processMatchesSession(session)) {
      const adopted = await adoptRelaunchedLiveTeamsSession(sessionFile, {
        timeoutMs: Math.min(10_000, Math.max(1_000, deadline - Date.now())),
      });
      if (!adopted) {
        await delay(250);
        session = readSession(sessionFile);
        continue;
      }
      session = adopted;
    }
    const currentPid = Number(session.pid || 0);
    if (currentPid !== stablePid) {
      stablePid = currentPid;
      stableSince = Date.now();
    }
    if (Date.now() - stableSince >= settleMs) return session;
    await delay(250);
    session = readSession(sessionFile) || session;
  }
  throw new Error(
    `Managed 360Teams did not reach a stable main process within ${timeoutMs}ms after launch/relaunch.`,
  );
}

export function listRunningTeamsMainProcesses(executable) {
  return listProcesses().filter((item) => {
    const expected = path.resolve(executable);
    const command = String(item.command || '');
    return command === expected || command.startsWith(`${expected} `)
      || (IS_WINDOWS && command.toLowerCase().includes(expected.toLowerCase()));
  });
}

export function parseRunningTeamsMainProcesses(output, executable) {
  const rawExpected = String(executable || '');
  const expected = IS_WINDOWS && rawExpected.startsWith('/') ? rawExpected : path.resolve(rawExpected);
  return String(output || '')
    .split(/\r?\n/)
    .map((line) => line.match(/^\s*(\d+)\s+(.+)$/))
    .filter(Boolean)
    .map((match) => ({ pid: Number(match[1]), command: match[2].trim() }))
    .filter((item) => item.command === expected || item.command.startsWith(`${expected} `));
}

function listenerPidForPort(port) {
  try {
    if (IS_WINDOWS) {
      const output = execFileSync('netstat.exe', ['-ano', '-p', 'tcp'], { encoding: 'utf8' });
      const match = String(output).split(/\r?\n/).find((line) => {
        const fields = line.trim().split(/\s+/);
        return fields[0]?.toUpperCase() === 'TCP'
          && fields[1]?.endsWith(`:${String(port)}`)
          && fields[3]?.toUpperCase() === 'LISTENING';
      });
      const pid = Number(match?.trim().split(/\s+/).at(-1));
      return Number.isInteger(pid) && pid > 1 ? pid : null;
    }
    const output = execFileSync('lsof', ['-nP', '-tiTCP:' + String(port), '-sTCP:LISTEN'], { encoding: 'utf8' }).trim();
    const pid = Number(output.split(/\s+/)[0]);
    return Number.isInteger(pid) && pid > 1 ? pid : null;
  } catch {
    return null;
  }
}

function safeCdpPort(value) {
  try {
    return Number(new URL(String(value || '')).port || 0);
  } catch {
    return 0;
  }
}

function processIdentity(pid) {
  return portableProcessIdentity(pid);
}

function terminatePid(pid, { forceAfterMs = 5000 } = {}) {
  terminateProcess(pid, { forceAfterMs });
}

function sleepSync(ms) {
  const view = new Int32Array(new SharedArrayBuffer(4));
  Atomics.wait(view, 0, 0, ms);
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
