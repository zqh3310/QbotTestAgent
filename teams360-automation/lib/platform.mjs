import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/**
 * Operating-system primitives used by the managed Teams adapter.
 *
 * Business assertions and evidence schemas stay platform neutral.  Only
 * process discovery, paths, permissions, locks and native input are selected
 * here, so a Windows adapter cannot silently weaken the shared runner.
 */
export const PLATFORM = process.platform === 'darwin' ? 'macos'
  : process.platform === 'win32' ? 'windows' : 'unsupported';

export const IS_MACOS = PLATFORM === 'macos';
export const IS_WINDOWS = PLATFORM === 'windows';

export function defaultTeamsAppPath(env = process.env) {
  if (IS_MACOS) return '/Applications/360Teams.app';
  if (IS_WINDOWS) {
    const roots = [
      env.LOCALAPPDATA && path.join(env.LOCALAPPDATA, 'Programs', '360Teams', '360Teams.exe'),
      env.PROGRAMFILES && path.join(env.PROGRAMFILES, '360Teams', '360Teams.exe'),
      env['PROGRAMFILES(X86)'] && path.join(env['PROGRAMFILES(X86)'], '360Teams', '360Teams.exe'),
    ].filter(Boolean);
    return roots[0] || path.join('C:', 'Program Files', '360Teams', '360Teams.exe');
  }
  return '360Teams';
}

export function defaultLiveProfilePath(home = os.homedir()) {
  if (IS_MACOS) return path.join(home, 'Library', 'Application Support', '360Teams');
  if (IS_WINDOWS) return path.join(home, 'AppData', 'Roaming', '360Teams');
  return path.join(home, '.config', '360Teams');
}

export function normalizePathForComparison(value) {
  const resolved = path.resolve(String(value || ''));
  const normalized = path.normalize(resolved);
  return IS_WINDOWS ? normalized.toLowerCase() : normalized;
}

export function pathInside(root, candidate) {
  const relative = path.relative(normalizePathForComparison(root), normalizePathForComparison(candidate));
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
}

export function supportsPosixOwnership() {
  return !IS_WINDOWS && typeof process.getuid === 'function';
}

export function isPrivateDirectoryStat(stat) {
  if (!stat || !stat.isDirectory() || stat.isSymbolicLink()) return false;
  // Windows exposes POSIX-looking mode bits but they do not represent ACLs.
  return IS_WINDOWS ? true : (stat.mode & 0o077) === 0;
}

export function isPrivateFileStat(stat) {
  if (!stat || !stat.isFile() || stat.isSymbolicLink()) return false;
  return IS_WINDOWS ? true : (stat.mode & 0o077) === 0;
}

export function processListingCommand() {
  if (IS_MACOS) return { file: 'ps', args: ['-ax', '-ww', '-o', 'pid=,ppid=,command='] };
  if (IS_WINDOWS) return {
    file: 'powershell.exe',
    args: ['-NoProfile', '-NonInteractive', '-Command',
      'Get-CimInstance Win32_Process | Select-Object ProcessId,ParentProcessId,CommandLine | ConvertTo-Json -Compress'],
  };
  return { file: 'ps', args: ['-e', '-o', 'pid=,ppid=,command='] };
}

export function parseProcessListing(output) {
  if (IS_WINDOWS) {
    let rows = [];
    try {
      const parsed = JSON.parse(String(output || ''));
      rows = Array.isArray(parsed) ? parsed : [parsed];
    } catch { return []; }
    return rows.map((row) => ({
      pid: Number(row?.ProcessId),
      ppid: Number(row?.ParentProcessId),
      command: String(row?.CommandLine || '').trim(),
    })).filter((row) => Number.isInteger(row.pid) && row.pid > 0);
  }
  return String(output || '').split(/\r?\n/).map((line) => {
    const match = line.trim().match(/^(\d+)\s+(\d+)\s+([\s\S]+)$/);
    return match ? { pid: Number(match[1]), ppid: Number(match[2]), command: match[3].trim() } : null;
  }).filter(Boolean);
}

export function listProcesses(exec = execFileSync) {
  const spec = processListingCommand();
  try { return parseProcessListing(exec(spec.file, spec.args, { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 })); }
  catch { return []; }
}

export function processIdentity(pid, exec = execFileSync) {
  const id = Number(pid);
  if (!Number.isInteger(id) || id <= 1) return { started: '', command: '' };
  try {
    if (IS_WINDOWS) {
      const output = exec('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
        `(Get-CimInstance Win32_Process -Filter "ProcessId=${id}") | Select-Object ProcessId,CreationDate,CommandLine | ConvertTo-Json -Compress`],
      { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
      const row = JSON.parse(String(output || '{}'));
      return { started: String(row?.CreationDate || ''), command: String(row?.CommandLine || '').trim() };
    }
    return {
      started: String(exec('ps', ['-p', String(id), '-o', 'lstart='], { encoding: 'utf8' })).trim(),
      command: String(exec('ps', ['-p', String(id), '-ww', '-o', 'command='], { encoding: 'utf8' })).trim(),
    };
  } catch { return { started: '', command: '' }; }
}

export function terminateProcess(pid, { forceAfterMs = 5000 } = {}) {
  const id = Number(pid);
  if (!Number.isInteger(id) || id <= 1) return;
  if (IS_WINDOWS) {
    try { execFileSync('taskkill.exe', ['/PID', String(id), '/T', '/F'], { stdio: 'ignore' }); } catch {}
    return;
  }
  try { process.kill(id, 'SIGTERM'); } catch { return; }
  const deadline = Date.now() + forceAfterMs;
  while (Date.now() < deadline) {
    try { process.kill(id, 0); } catch { return; }
    const view = new Int32Array(new SharedArrayBuffer(4));
    Atomics.wait(view, 0, 0, 100);
  }
  try { process.kill(id, 'SIGKILL'); } catch {}
}

export function nativeInputContract() {
  if (IS_MACOS) return { platform: 'macos', mechanism: 'accessibility-system-events', commandRequired: true };
  if (IS_WINDOWS) return { platform: 'windows', mechanism: 'windows-ui-automation-send-input', commandRequired: true };
  return { platform: PLATFORM, mechanism: 'unsupported', commandRequired: true };
}

export function platformDiagnostics() {
  return {
    platform: PLATFORM,
    node: process.version,
    path_separator: path.sep,
    temp_dir: os.tmpdir(),
    supports_symlink: (() => { try { return typeof fs.symlinkSync === 'function'; } catch { return false; } })(),
    supports_posix_ownership: supportsPosixOwnership(),
    native_input: nativeInputContract(),
  };
}
