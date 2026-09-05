import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import { QWORK_RELEASE_INTAKE_DEFAULT_REF } from './qwork-release-intake.mjs';
import { QWORK_RELEASE_REF_OBSERVATION_SCHEMA } from './qwork-release-test-plan.mjs';

export const QWORK_RELEASE_BRANCH = 'release/0.1';
export const QWORK_RELEASE_GITLAB_PROJECT = 'gitlab.daikuan.qihoo.net/songrongxin/deepbankv2';

const HEX40 = /^[a-f0-9]{40}$/i;

function text(value) {
  return String(value ?? '').trim();
}

function sha256File(file) {
  return createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function normalizePlatformPath(value) {
  const resolved = path.resolve(String(value ?? ''));
  if (resolved === '/var' || resolved.startsWith('/var/')) {
    try {
      if (fs.realpathSync('/var') === '/private/var') {
        return path.join('/private/var', path.relative('/var', resolved));
      }
    } catch {
      // The path checks below retain fail-closed behavior.
    }
  }
  return resolved;
}

function assertNoSymlinkPath(pathname, label) {
  const resolved = normalizePlatformPath(pathname);
  const parsed = path.parse(resolved);
  const parts = resolved.slice(parsed.root.length).split(path.sep).filter(Boolean);
  let cursor = parsed.root;
  for (const part of parts) {
    cursor = path.join(cursor, part);
    let stat;
    try {
      stat = fs.lstatSync(cursor);
    } catch {
      throw new Error(`${label} path is not readable: ${cursor}`);
    }
    if (stat.isSymbolicLink()) throw new Error(`${label} path cannot contain symbolic links: ${cursor}`);
  }
  return resolved;
}

function captureDirectoryGuard(directory, label) {
  const resolved = assertNoSymlinkPath(directory, label);
  const stat = fs.lstatSync(resolved, { bigint: true });
  if (!stat.isDirectory() || stat.isSymbolicLink()) {
    throw new Error(`${label} must be a regular directory: ${resolved}`);
  }
  if (fs.realpathSync(resolved) !== resolved) {
    throw new Error(`${label} canonical path changed: ${resolved}`);
  }
  const uid = typeof process.getuid === 'function' ? BigInt(process.getuid()) : stat.uid;
  const permissions = Number(stat.mode & 0o777n);
  if (stat.uid !== uid) throw new Error(`${label} must be owned by the current user: ${resolved}`);
  if ((permissions & 0o022) !== 0) {
    throw new Error(`${label} cannot be group/other writable: ${resolved}`);
  }
  return {
    path: resolved,
    dev: stat.dev,
    ino: stat.ino,
    uid: stat.uid,
    permissions,
  };
}

function assertDirectoryGuard(guard, label) {
  const current = captureDirectoryGuard(guard.path, label);
  if (current.dev !== guard.dev || current.ino !== guard.ino || current.uid !== guard.uid
    || current.permissions !== guard.permissions) {
    throw new Error(`${label} changed while writing: ${guard.path}`);
  }
  return current.path;
}

function fsyncDirectory(directory) {
  let descriptor;
  try {
    descriptor = fs.openSync(directory, fs.constants.O_RDONLY);
    fs.fsyncSync(descriptor);
  } catch {
    // The file itself is fsync'ed; some platforms reject directory fsync.
  } finally {
    if (descriptor != null) fs.closeSync(descriptor);
  }
}

export function normalizeQworkGitLabProject(remoteUrl) {
  const value = text(remoteUrl);
  let host = '';
  let projectPath = '';
  const scpLike = value.match(/^(?:[^@/\s]+@)?([^:/\s]+):(.+)$/);
  if (scpLike && !value.includes('://')) {
    [, host, projectPath] = scpLike;
  } else {
    try {
      const parsed = new URL(value);
      if (!['https:', 'ssh:'].includes(parsed.protocol) || parsed.port) return '';
      host = parsed.hostname;
      projectPath = parsed.pathname.replace(/^\/+/, '');
    } catch {
      return '';
    }
  }
  const normalizedPath = projectPath.replace(/\/+$/, '').replace(/\.git$/i, '').toLowerCase();
  return `${host.toLowerCase()}/${normalizedPath}`;
}

function branchHead(payload) {
  const name = text(payload?.name);
  const head = text(payload?.commit?.id).toLowerCase();
  if (name !== QWORK_RELEASE_BRANCH || !HEX40.test(head)) {
    throw new Error('GitLab release/0.1 branch response is incomplete');
  }
  return head;
}

export function readStableQworkReleaseHead(readGitLab) {
  if (typeof readGitLab !== 'function') throw new Error('A GitLab read-only reader is required');
  const endpoint = `repository/branches/${encodeURIComponent(QWORK_RELEASE_BRANCH)}`;
  const before = branchHead(readGitLab(endpoint));
  const after = branchHead(readGitLab(endpoint));
  if (before !== after) throw new Error('release/0.1 moved during the independent observation');
  return before;
}

export function createQworkReleaseRefObservation({
  repository,
  readGitLab,
  releaseRef = QWORK_RELEASE_INTAKE_DEFAULT_REF,
  observedAt = new Date().toISOString(),
} = {}) {
  const resolvedRepository = path.resolve(text(repository));
  const timestamp = text(observedAt);
  if (text(releaseRef) !== QWORK_RELEASE_INTAKE_DEFAULT_REF) {
    throw new Error(`Only ${QWORK_RELEASE_INTAKE_DEFAULT_REF} can be observed`);
  }
  if (!Number.isFinite(Date.parse(timestamp)) || new Date(timestamp).toISOString() !== timestamp) {
    throw new Error('Observation timestamp must be an exact ISO-8601 value');
  }
  return {
    schema_version: QWORK_RELEASE_REF_OBSERVATION_SCHEMA,
    observed_at: timestamp,
    repository: resolvedRepository,
    source: 'gitlab-api',
    release_ref: QWORK_RELEASE_INTAKE_DEFAULT_REF,
    release_head: readStableQworkReleaseHead(readGitLab),
  };
}

export function writeQworkReleaseRefObservation({ observation, outDir } = {}) {
  if (!text(outDir)) throw new Error('Observation output directory is required');
  const root = normalizePlatformPath(outDir);
  if (root === path.parse(root).root) {
    throw new Error('Observation output directory cannot be a filesystem root');
  }
  if (fs.existsSync(root)) throw new Error(`Observation output directory must be new: ${root}`);
  const parentGuard = captureDirectoryGuard(path.dirname(root), 'Observation output parent');
  assertDirectoryGuard(parentGuard, 'Observation output parent');
  fs.mkdirSync(root, { recursive: false, mode: 0o700 });
  fs.chmodSync(root, 0o700);
  assertDirectoryGuard(parentGuard, 'Observation output parent');
  const rootGuard = captureDirectoryGuard(root, 'Observation output directory');
  const file = path.join(root, 'release-ref-observation.json');
  const payload = Buffer.from(`${JSON.stringify(observation, null, 2)}\n`, 'utf8');
  const noFollow = fs.constants.O_NOFOLLOW || 0;
  const descriptor = fs.openSync(file, fs.constants.O_WRONLY | fs.constants.O_CREAT
    | fs.constants.O_EXCL | noFollow, 0o600);
  try {
    fs.writeFileSync(descriptor, payload);
    fs.fsyncSync(descriptor);
    const stat = fs.fstatSync(descriptor, { bigint: true });
    if (!stat.isFile() || stat.size !== BigInt(payload.length)) {
      throw new Error('Observation output file changed while writing');
    }
  } finally {
    fs.closeSync(descriptor);
  }
  assertDirectoryGuard(rootGuard, 'Observation output directory');
  assertDirectoryGuard(parentGuard, 'Observation output parent');
  const fileStat = fs.lstatSync(file, { bigint: true });
  const currentUid = typeof process.getuid === 'function' ? BigInt(process.getuid()) : fileStat.uid;
  if (!fileStat.isFile() || fileStat.isSymbolicLink() || fileStat.uid !== currentUid
    || Number(fileStat.mode & 0o777n) !== 0o600 || fileStat.size !== BigInt(payload.length)) {
    throw new Error('Observation output file is not a stable private regular file');
  }
  fsyncDirectory(root);
  fsyncDirectory(parentGuard.path);
  return { root, observation: file, sha256: sha256File(file) };
}
