import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const RUNTIME_ROOT = path.resolve(HERE, '../runtime');
export const MANAGED_RUNNER_LOCK_FILE = path.join(RUNTIME_ROOT, '.qwork-managed-runner.lock');
const LOCK_MARKER = 'QBOT_TEAMS_MANAGED_RUNNER_LOCK_V1';

function text(value) {
  return String(value ?? '').trim();
}

function sha256(value) {
  return createHash('sha256').update(String(value), 'utf8').digest('hex');
}

function lstatOrNull(file) {
  try {
    return fs.lstatSync(file);
  } catch (error) {
    if (error?.code === 'ENOENT') return null;
    throw error;
  }
}

function directoryIdentity(file, stat) {
  return {
    path: file,
    dev: String(stat.dev),
    ino: String(stat.ino),
    uid: stat.uid,
    mode: stat.mode & 0o777,
  };
}

function assertRealDirectory(file, label) {
  const stat = lstatOrNull(file);
  if (!stat) throw new Error(`${label} does not exist: ${file}`);
  if (stat.isSymbolicLink() || !stat.isDirectory()) {
    throw new Error(`${label} must be a real directory without symbolic links: ${file}`);
  }
  return stat;
}

function currentUid(fallback) {
  return typeof process.getuid === 'function' ? process.getuid() : fallback;
}

function absoluteDirectoryChain(directory) {
  const resolved = path.resolve(directory);
  const root = path.parse(resolved).root;
  const relative = path.relative(root, resolved);
  const chain = [root];
  let cursor = root;
  for (const component of relative.split(path.sep).filter(Boolean)) {
    cursor = path.join(cursor, component);
    chain.push(cursor);
  }
  return chain;
}

function ensureSecureLockRoot(root) {
  const identities = [];
  for (const ancestor of absoluteDirectoryChain(root)) {
    let stat = lstatOrNull(ancestor);
    if (!stat) {
      try {
        fs.mkdirSync(ancestor, { mode: 0o700 });
      } catch (error) {
        throw new Error(`Unable to create managed runner lock directory ${ancestor}: ${error.message}`);
      }
      stat = lstatOrNull(ancestor);
    }
    if (!stat || stat.isSymbolicLink() || !stat.isDirectory()) {
      throw new Error(`Managed runner lock ancestor must be a real directory: ${ancestor}`);
    }
    identities.push(directoryIdentity(ancestor, stat));
  }
  if (fs.realpathSync.native(root) !== root) {
    throw new Error(`Managed runner lock root has a symbolic-link ancestor: ${root}`);
  }
  const rootStat = assertRealDirectory(root, 'Managed runner lock root');
  if (rootStat.uid !== currentUid(rootStat.uid) || (rootStat.mode & 0o022) !== 0) {
    throw new Error(`Managed runner lock root must be current-user owned and not group/other writable: ${root}`);
  }
  return identities;
}

function assertDirectoryIdentitiesUnchanged(identities, label) {
  for (const identity of identities) {
    const stat = assertRealDirectory(identity.path, label);
    if (String(stat.dev) !== identity.dev || String(stat.ino) !== identity.ino) {
      throw new Error(`${label} changed while the runner lock was prepared: ${identity.path}`);
    }
  }
}

export function inspectNewManagedOutputPath({ outDir, outputRoot }) {
  const root = path.resolve(text(outputRoot));
  const candidate = path.resolve(text(outDir));
  const relative = path.relative(root, candidate);
  if (!text(outDir) || !text(outputRoot) || relative === ''
    || relative.startsWith(`..${path.sep}`) || relative === '..' || path.isAbsolute(relative)) {
    throw new Error(`Managed runner output must be a new directory below ${root}.`);
  }

  const existing = [];
  for (const ancestor of absoluteDirectoryChain(root)) {
    const stat = assertRealDirectory(ancestor, 'Managed runner output ancestor');
    existing.push(directoryIdentity(ancestor, stat));
  }
  const realRoot = fs.realpathSync.native(root);
  if (realRoot !== root) {
    throw new Error(`Managed runner output root has a symbolic-link ancestor: ${root}`);
  }

  let cursor = root;
  let missingSeen = false;
  for (const component of relative.split(path.sep).filter(Boolean)) {
    cursor = path.join(cursor, component);
    const stat = lstatOrNull(cursor);
    if (!stat) {
      missingSeen = true;
      continue;
    }
    if (missingSeen) {
      throw new Error(`Managed runner output path changed while it was inspected: ${cursor}`);
    }
    if (stat.isSymbolicLink() || !stat.isDirectory()) {
      throw new Error(`Managed runner output ancestor must be a real directory: ${cursor}`);
    }
    existing.push(directoryIdentity(cursor, stat));
  }
  if (!missingSeen) throw new Error(`Managed runner output already exists: ${candidate}`);
  return { root, candidate, relative, existing };
}

export function createNewManagedOutputDirectory({ outDir, outputRoot }) {
  const before = inspectNewManagedOutputPath({ outDir, outputRoot });
  const beforeByPath = new Map(before.existing.map((entry) => [entry.path, entry]));
  const createdIdentities = [];
  let cursor = before.root;
  for (const component of before.relative.split(path.sep).filter(Boolean)) {
    cursor = path.join(cursor, component);
    const prior = beforeByPath.get(cursor);
    if (prior) {
      const stat = assertRealDirectory(cursor, 'Managed runner output ancestor');
      if (String(stat.dev) !== prior.dev || String(stat.ino) !== prior.ino) {
        throw new Error(`Managed runner output ancestor changed during creation: ${cursor}`);
      }
      continue;
    }
    try {
      fs.mkdirSync(cursor, { mode: 0o700 });
    } catch (error) {
      throw new Error(`Unable to atomically create managed runner output directory ${cursor}: ${error.message}`);
    }
    const created = assertRealDirectory(cursor, 'Managed runner output directory');
    if ((created.mode & 0o077) !== 0) {
      throw new Error(`Managed runner output directory is not private: ${cursor}`);
    }
    createdIdentities.push(directoryIdentity(cursor, created));
  }

  for (const entry of [...before.existing, ...createdIdentities]) {
    const stat = assertRealDirectory(entry.path, 'Managed runner output ancestor');
    if (String(stat.dev) !== entry.dev || String(stat.ino) !== entry.ino) {
      throw new Error(`Managed runner output ancestor changed after creation: ${entry.path}`);
    }
  }
  const created = assertRealDirectory(before.candidate, 'Managed runner output directory');
  const realCandidate = fs.realpathSync.native(before.candidate);
  const realRelative = path.relative(before.root, realCandidate);
  if (realRelative === '' || realRelative.startsWith(`..${path.sep}`)
    || realRelative === '..' || path.isAbsolute(realRelative)) {
    throw new Error(`Managed runner output escaped its trusted root: ${before.candidate}`);
  }
  return {
    path: before.candidate,
    dev: String(created.dev),
    ino: String(created.ino),
    mode: created.mode & 0o777,
  };
}

function processRows() {
  const output = execFileSync('/bin/ps', ['ax', '-o', 'pid=,ppid=,command='], { encoding: 'utf8' });
  return output.split('\n').map((line) => {
    const match = line.trim().match(/^(\d+)\s+(\d+)\s+([\s\S]+)$/);
    return match ? { pid: Number(match[1]), ppid: Number(match[2]), command: match[3] } : null;
  }).filter(Boolean);
}

function ancestorPids(rows, pid = process.pid) {
  const byPid = new Map(rows.map((row) => [row.pid, row]));
  const ancestors = new Set([pid]);
  let cursor = byPid.get(pid)?.ppid || process.ppid;
  while (Number.isSafeInteger(cursor) && cursor > 1 && !ancestors.has(cursor)) {
    ancestors.add(cursor);
    cursor = byPid.get(cursor)?.ppid || 0;
  }
  return ancestors;
}

export function findOtherManagedRunnerProcesses() {
  const rows = processRows();
  const excluded = ancestorPids(rows);
  return rows.filter((row) => (
    !excluded.has(row.pid)
    && /(?:teams360-automation\/lib\/(?:casebook-runner|qwork-soak-cli)\.mjs|src\/cli\.mjs\s+ui-agent-casebook-run)/.test(row.command)
  ));
}

function assertSecureLockFile(lockFile) {
  const resolved = path.resolve(text(lockFile));
  if (!text(lockFile)) throw new Error('Managed runner lock file is required.');
  const root = path.dirname(resolved);
  const rootIdentities = ensureSecureLockRoot(root);
  const before = lstatOrNull(resolved);
  if (before && (before.isSymbolicLink() || !before.isFile()
    || before.uid !== currentUid(before.uid) || (before.mode & 0o077) !== 0)) {
    throw new Error(`Managed runner lock must be a private current-user regular file: ${resolved}`);
  }
  if (!Number.isInteger(fs.constants.O_NOFOLLOW)) {
    throw new Error('Managed runner lock requires O_NOFOLLOW support.');
  }
  let fd = null;
  try {
    fd = fs.openSync(
      resolved,
      fs.constants.O_CREAT | fs.constants.O_RDWR | fs.constants.O_NOFOLLOW,
      0o600,
    );
    if (!before) fs.fchmodSync(fd, 0o600);
    const opened = fs.fstatSync(fd);
    const after = fs.lstatSync(resolved);
    const expectedUid = currentUid(opened.uid);
    if (!opened.isFile() || opened.uid !== expectedUid || (opened.mode & 0o077) !== 0
      || after.isSymbolicLink() || !after.isFile()
      || String(after.dev) !== String(opened.dev) || String(after.ino) !== String(opened.ino)
      || (before && (String(before.dev) !== String(opened.dev) || String(before.ino) !== String(opened.ino)))) {
      throw new Error(`Managed runner lock changed or is not a private current-user regular file: ${resolved}`);
    }
  } catch (error) {
    if (error?.code === 'ELOOP') {
      throw new Error(`Managed runner lock must not be a symbolic link: ${resolved}`);
    }
    throw error;
  } finally {
    if (fd != null) fs.closeSync(fd);
  }
  assertDirectoryIdentitiesUnchanged(rootIdentities, 'Managed runner lock ancestor');
  return resolved;
}

function assertHeldByLockf(lockFile, bindingSha256) {
  if (process.env[LOCK_MARKER] !== lockFile
    || process.env.QBOT_TEAMS_MANAGED_RUNNER_BINDING_SHA256 !== bindingSha256) {
    return false;
  }
  const parentCommand = text(execFileSync('/bin/ps', [
    '-p', String(process.ppid), '-o', 'comm=',
  ], { encoding: 'utf8' }));
  if (parentCommand !== '/usr/bin/lockf') {
    throw new Error('Managed runner lock marker is not backed by a lockf parent process.');
  }
  const proof = spawnSync('/usr/bin/lockf', ['-t', '0', lockFile, '/usr/bin/true'], { encoding: 'utf8' });
  if (proof.status !== 75) throw new Error('Managed runner process-lifetime advisory lock is not held.');
  return true;
}

export function executeUnderManagedRunnerLock({
  entrypoint,
  argv,
  binding,
  lockFile = MANAGED_RUNNER_LOCK_FILE,
}) {
  const executable = path.resolve(text(entrypoint));
  const args = Array.isArray(argv) ? argv.map(String) : [];
  const bindingSha256 = sha256(JSON.stringify(binding || {}));
  const resolvedLockFile = assertSecureLockFile(lockFile);
  if (assertHeldByLockf(resolvedLockFile, bindingSha256)) {
    const others = findOtherManagedRunnerProcesses();
    if (others.length) {
      throw new Error(`Another Casebook/G5 runner exists despite the managed lock: ${others.map((row) => row.pid).join(',')}`);
    }
    return { lock_held: true, reexecuted: false, lock_file: resolvedLockFile, binding_sha256: bindingSha256 };
  }

  const others = findOtherManagedRunnerProcesses();
  if (others.length) {
    throw new Error(`Another Casebook/G5 runner is already running: ${others.map((row) => row.pid).join(',')}`);
  }
  const child = spawnSync('/usr/bin/lockf', [
    '-t', '0', resolvedLockFile,
    process.execPath,
    executable,
    ...args,
  ], {
    stdio: 'inherit',
    env: {
      ...process.env,
      [LOCK_MARKER]: resolvedLockFile,
      QBOT_TEAMS_MANAGED_RUNNER_BINDING_SHA256: bindingSha256,
    },
  });
  if (child.error) throw child.error;
  if (child.status === 75) throw new Error('Another managed Casebook/G5 runner holds the process-lifetime lock.');
  return {
    lock_held: false,
    reexecuted: true,
    status: child.status ?? 1,
    signal: child.signal || '',
    lock_file: resolvedLockFile,
    binding_sha256: bindingSha256,
  };
}
