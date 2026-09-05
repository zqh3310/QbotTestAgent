#!/usr/bin/env node

import { createHash, randomBytes } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  createGitLabReadOnlyReader,
  QWORK_RELEASE_INTAKE_DEFAULT_GITLAB_HOST,
  QWORK_RELEASE_INTAKE_DEFAULT_GITLAB_PROJECT,
} from '../src/lib/qwork-release-intake.mjs';
import { readStableQworkReleaseHead } from '../src/lib/qwork-release-ref-observation.mjs';
import {
  applyQworkStageAudit,
  auditQworkSoakCompletion,
  auditQworkStageCompletion,
  auditQworkStageReadiness,
  createQworkReleaseTestIntegrity,
  createQworkReleaseTestPlan,
  createQworkReleaseTestState,
  qworkReleaseIdentityFingerprint,
  qworkReleaseStage,
  QWORK_RELEASE_TEST_INTEGRITY_SCHEMA,
  QWORK_RELEASE_TEST_PLAN_SCHEMA,
  QWORK_RELEASE_TEST_STATE_SCHEMA,
  validateQworkReleaseIntakeBinding,
  validateQworkReleaseRefObservation,
  validateQworkReleaseRefObservationBinding,
  validateQworkReleaseControlState,
  validateQworkReleaseIdentity,
} from '../src/lib/qwork-release-test-plan.mjs';

const CONTROL_ENTRY_NAMES = Object.freeze([
  'events',
  'release-test-integrity.json',
  'release-test-plan.json',
  'release-test-state.json',
]);
const PLAN_EXTERNAL_ARTIFACT_ROLES = Object.freeze([
  'casebook',
  'release_identity',
  'release_intake',
  'release_observation',
]);
const EVENT_FILENAME_PATTERN = /^(\d{4})-(G[1-5])-(readiness|completion)\.json$/;
const EVENT_SCHEMA = 'qbot-qwork-release-test-event/v2';
const SHA256_PATTERN = /^[a-f0-9]{64}$/i;
const DIRECTORY_ENTRY_SHA256 = createHash('sha256').update('directory').digest('hex');
const DEEPBANK_GITLAB_PROJECT = 'gitlab.daikuan.qihoo.net/songrongxin/deepbankv2';
const TRANSACTION_SCHEMA = 'qbot-qwork-release-test-transaction/v2';

function usage() {
  return `QWork 发布测试阶段编排器

Usage:
  npm run qwork-release:orchestrate -- init \\
    --state-dir <new-control-directory> \\
    --casebook <xlsx> \\
    --release-identity <release-identity.json> \\
    --release-intake <release-intake.json> \\
    --expected-release-observation <release-ref-observation.json> \\
    --expected-release-ref origin/release/0.1 \\
    --expected-release-head <40-hex-release-head> \\
    --gitlab-token-stdin

  npm run qwork-release:orchestrate -- readiness \\
    --state-dir <control-directory> \\
    --stage G1|G2|G3|G4 \\
    --capability-audit <capability-audit.json|directory> \\
    --pretest <core-beta-pretest-report.json|directory> \\
    --gitlab-token-stdin

  npm run qwork-release:orchestrate -- complete \\
    --state-dir <control-directory> \\
    --stage G1|G2|G3|G4 \\
    --run-dir <immutable-run-directory> \\
    --gitlab-token-stdin

  npm run qwork-release:orchestrate -- soak \\
    --state-dir <control-directory> \\
    --soak-report <soak-report.json> \\
    --gitlab-token-stdin

  npm run qwork-release:orchestrate -- status --state-dir <control-directory> --gitlab-token-stdin

编排器永远不使用 raw passed/failed 作为阶段准入。Casebook 阶段必须同时具备
精确能力审计、精确 READY、完整真实执行、完整 evidence manifest、匹配的发布身份
以及 trusted_pass=N。正式计划必须绑定 release intake，并将其 release ref/HEAD 与调用者
独立提供的当前观测值全等校验，同时证明报告文件 SHA、Casebook SHA 和 framework commit
全等。任何其他可信分类都会停止流水线，后续阶段保持 NOT_STARTED。
私有 GitLab 环境使用 --gitlab-token-stdin；token 仅进入固定项目的 curl config stdin，
不进入参数、环境、日志或 Git 配置。具备受管 Git credential helper 时仍可省略该参数。
`;
}

function parseArgs(argv) {
  const [command = '', ...tokens] = argv;
  const options = {};
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (!token.startsWith('--')) throw new Error('Unexpected positional argument');
    if (token === '--gitlab-token-stdin') {
      if (Object.hasOwn(options, 'gitlab-token-stdin')) {
        throw new Error('--gitlab-token-stdin 只能传入一次');
      }
      options['gitlab-token-stdin'] = true;
      continue;
    }
    if (token.startsWith('--gitlab-token-stdin=')) {
      throw new Error('--gitlab-token-stdin 必须作为无值布尔开关单独传入');
    }
    const [name, inline] = token.slice(2).split(/=(.*)/s, 2);
    const value = inline == null ? tokens[index + 1] : inline;
    if (value == null || String(value).startsWith('--')) {
      options[name] = true;
      continue;
    }
    options[name] = value;
    if (inline == null) index += 1;
  }
  return { command, options };
}

function required(options, names) {
  const missing = names.filter((name) => !String(options[name] || '').trim());
  if (missing.length) throw new Error(`Missing required options: ${missing.map((name) => `--${name}`).join(', ')}`);
}

function releaseRemoteVerification(options) {
  if (!options['gitlab-token-stdin']) return { readGitLab: null };
  const token = fs.readFileSync(0, 'utf8').trim();
  if (!token) throw new Error('已要求 --gitlab-token-stdin，但标准输入为空');
  return {
    readGitLab: createGitLabReadOnlyReader({
      host: QWORK_RELEASE_INTAKE_DEFAULT_GITLAB_HOST,
      projectPath: QWORK_RELEASE_INTAKE_DEFAULT_GITLAB_PROJECT,
      token,
    }),
  };
}

function normalizePlatformPath(value) {
  const resolved = path.resolve(String(value ?? ''));
  if (resolved === '/var' || resolved.startsWith('/var/')) {
    try {
      if (fs.realpathSync('/var') === '/private/var') {
        return path.join('/private/var', path.relative('/var', resolved));
      }
    } catch {
      // The normal path checks below retain fail-closed behavior.
    }
  }
  return resolved;
}

function pathInside(candidate, root) {
  const relative = path.relative(root, candidate);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function assertNoSymlinkPath(pathname, label, { allowMissingLeaf = false } = {}) {
  const resolved = normalizePlatformPath(pathname);
  const parsed = path.parse(resolved);
  const parts = resolved.slice(parsed.root.length).split(path.sep).filter(Boolean);
  let cursor = parsed.root;
  for (const [index, part] of parts.entries()) {
    cursor = path.join(cursor, part);
    let stat;
    try {
      stat = fs.lstatSync(cursor);
    } catch (error) {
      if (error?.code === 'ENOENT' && allowMissingLeaf && index === parts.length - 1) return resolved;
      throw new Error(`${label} 路径不可读：${cursor}`);
    }
    if (stat.isSymbolicLink()) throw new Error(`${label} 路径祖先不能是符号链接：${cursor}`);
    if (index < parts.length - 1 && !stat.isDirectory()) {
      throw new Error(`${label} 路径祖先必须是目录：${cursor}`);
    }
  }
  return resolved;
}

function assertSecureDirectory(directory, label, { allowMissing = false } = {}) {
  const resolved = assertNoSymlinkPath(directory, label, { allowMissingLeaf: allowMissing });
  if (!fs.existsSync(resolved)) return resolved;
  const stat = fs.lstatSync(resolved);
  if (stat.isSymbolicLink() || !stat.isDirectory()) {
    throw new Error(`${label} 必须是普通目录且不能是符号链接：${resolved}`);
  }
  if (fs.realpathSync(resolved) !== resolved) throw new Error(`${label} canonical realpath 漂移：${resolved}`);
  return resolved;
}

function captureDirectoryGuard(directory, label) {
  const resolved = assertSecureDirectory(directory, label);
  const stat = fs.lstatSync(resolved, { bigint: true });
  const uid = typeof process.getuid === 'function' ? BigInt(process.getuid()) : stat.uid;
  const permissions = Number(stat.mode & 0o777n);
  if (stat.uid !== uid) throw new Error(`${label} 必须由当前用户拥有：${resolved}`);
  if ((permissions & 0o022) !== 0) {
    throw new Error(`${label} 不能允许 group/other 写入：${resolved} mode=${permissions.toString(8)}`);
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
  const currentPath = assertSecureDirectory(guard.path, label);
  const stat = fs.lstatSync(currentPath, { bigint: true });
  const permissions = Number(stat.mode & 0o777n);
  if (stat.dev !== guard.dev || stat.ino !== guard.ino || stat.uid !== guard.uid
    || permissions !== guard.permissions) {
    throw new Error(`${label} 在操作期间发生替换或权限漂移：${guard.path}`);
  }
  return guard.path;
}

function stableFileSnapshot(file, label) {
  const resolved = assertNoSymlinkPath(file, label);
  const lexicalStat = fs.lstatSync(resolved, { bigint: true });
  if (lexicalStat.isSymbolicLink() || !lexicalStat.isFile()) {
    throw new Error(`${label} 必须是普通文件且不能是符号链接：${resolved}`);
  }
  const realpath = fs.realpathSync(resolved);
  if (realpath !== resolved) throw new Error(`${label} canonical realpath 漂移：${resolved}`);
  const noFollow = fs.constants.O_NOFOLLOW || 0;
  const descriptor = fs.openSync(resolved, fs.constants.O_RDONLY | noFollow);
  try {
    const before = fs.fstatSync(descriptor, { bigint: true });
    if (!before.isFile() || before.dev !== lexicalStat.dev || before.ino !== lexicalStat.ino) {
      throw new Error(`${label} 在打开期间发生替换：${resolved}`);
    }
    const bytes = fs.readFileSync(descriptor);
    const after = fs.fstatSync(descriptor, { bigint: true });
    const finalStat = fs.lstatSync(resolved, { bigint: true });
    if (!finalStat.isFile() || finalStat.isSymbolicLink()
      || after.dev !== before.dev || after.ino !== before.ino || after.size !== before.size
      || after.mtimeNs !== before.mtimeNs || after.ctimeNs !== before.ctimeNs
      || finalStat.dev !== before.dev
      || finalStat.ino !== before.ino || finalStat.size !== before.size
      || finalStat.mtimeNs !== before.mtimeNs || finalStat.ctimeNs !== before.ctimeNs
      || BigInt(bytes.length) !== before.size) {
      throw new Error(`${label} 在读取期间发生变化：${resolved}`);
    }
    return {
      path: resolved,
      bytes,
      sha256: createHash('sha256').update(bytes).digest('hex'),
      text: bytes.toString('utf8'),
    };
  } finally {
    fs.closeSync(descriptor);
  }
}

function readJsonSnapshot(file, label = 'JSON 文件') {
  const snapshot = stableFileSnapshot(file, label);
  try {
    return { ...snapshot, value: JSON.parse(snapshot.text) };
  } catch (error) {
    throw new Error(`${label} 不是合法 JSON：${snapshot.path}；${error.message}`);
  }
}

function readJson(file, label) {
  return readJsonSnapshot(file, label).value;
}

function fsyncDirectory(directory) {
  let descriptor;
  try {
    descriptor = fs.openSync(directory, fs.constants.O_RDONLY);
    fs.fsyncSync(descriptor);
  } catch {
    // Individual files are already fsync'ed; some platforms reject directory fsync.
  } finally {
    if (descriptor != null) fs.closeSync(descriptor);
  }
}

function writeJson(file, value, { flag = 'w' } = {}) {
  const resolved = normalizePlatformPath(file);
  const parentGuard = captureDirectoryGuard(path.dirname(resolved), 'JSON 写入目录');
  const parent = parentGuard.path;
  const temporary = path.join(
    parent,
    `.${path.basename(resolved)}.tmp-${process.pid}-${randomBytes(8).toString('hex')}`,
  );
  let descriptor;
  try {
    descriptor = fs.openSync(temporary, 'wx', 0o600);
    fs.writeFileSync(descriptor, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
    fs.fsyncSync(descriptor);
    fs.closeSync(descriptor);
    descriptor = null;
    assertDirectoryGuard(parentGuard, 'JSON 写入目录');
    if (flag === 'wx') {
      fs.linkSync(temporary, resolved);
      fs.unlinkSync(temporary);
    } else {
      fs.renameSync(temporary, resolved);
    }
    assertDirectoryGuard(parentGuard, 'JSON 写入目录');
    fsyncDirectory(parent);
  } finally {
    if (descriptor != null) fs.closeSync(descriptor);
    if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
  }
}

function serializedJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function serializedJsonSha256(value) {
  return createHash('sha256').update(serializedJson(value)).digest('hex');
}

function sha256File(file, label = '文件') {
  return stableFileSnapshot(file, label).sha256;
}

function assertPlainFile(file, label) {
  return stableFileSnapshot(file, label).path;
}

function parseJsonSnapshot(snapshot, label) {
  try {
    return JSON.parse(snapshot.text);
  } catch (error) {
    throw new Error(`${label} 不是合法 JSON：${snapshot.path}；${error.message}`);
  }
}

function artifactFromSnapshot(role, snapshot) {
  return {
    role,
    path: snapshot.path,
    sha256: snapshot.sha256,
    type: 'file',
  };
}

function captureFileArtifact(role, file, label = role) {
  return artifactFromSnapshot(role, stableFileSnapshot(file, label));
}

function directoryMetadata(stat) {
  return [stat.dev, stat.ino, stat.size, stat.mtimeNs, stat.ctimeNs]
    .map((value) => String(value))
    .join(':');
}

function snapshotDirectoryTree(directory, label = '证据目录') {
  const root = assertSecureDirectory(directory, label);
  const entries = [{
    path: '.',
    type: 'directory',
    bytes: 0,
    sha256: DIRECTORY_ENTRY_SHA256,
  }];

  const walk = (current, relativeRoot = '') => {
    const before = fs.lstatSync(current, { bigint: true });
    if (before.isSymbolicLink() || !before.isDirectory()) {
      throw new Error(`${label} 只能包含普通目录和普通文件：${current}`);
    }
    const names = fs.readdirSync(current).sort();
    for (const name of names) {
      const absolute = path.join(current, name);
      const relative = path.join(relativeRoot, name).split(path.sep).join('/');
      const stat = fs.lstatSync(absolute, { bigint: true });
      if (stat.isSymbolicLink()) throw new Error(`${label} 不能包含符号链接：${absolute}`);
      if (stat.isDirectory()) {
        entries.push({
          path: relative,
          type: 'directory',
          bytes: 0,
          sha256: DIRECTORY_ENTRY_SHA256,
        });
        walk(absolute, relative);
      } else if (stat.isFile()) {
        const snapshot = stableFileSnapshot(absolute, `${label}文件`);
        entries.push({
          path: relative,
          type: 'file',
          bytes: snapshot.bytes.length,
          sha256: snapshot.sha256,
        });
      } else {
        throw new Error(`${label} 不能包含特殊文件：${absolute}`);
      }
    }
    const afterNames = fs.readdirSync(current).sort();
    const after = fs.lstatSync(current, { bigint: true });
    if (!after.isDirectory() || after.isSymbolicLink()
      || directoryMetadata(after) !== directoryMetadata(before)
      || JSON.stringify(afterNames) !== JSON.stringify(names)) {
      throw new Error(`${label} 在读取期间发生变化：${current}`);
    }
  };

  walk(root);
  return {
    path: root,
    entries,
    sha256: createHash('sha256').update(JSON.stringify(entries)).digest('hex'),
  };
}

function captureDirectoryTreeArtifact(role, directory, label = role) {
  const snapshot = snapshotDirectoryTree(directory, label);
  return {
    role,
    path: snapshot.path,
    sha256: snapshot.sha256,
    type: 'directory-tree',
  };
}

function artifactDescriptorFailures(descriptor, expectedRole, expectedType) {
  const failures = [];
  const keys = descriptor && typeof descriptor === 'object' && !Array.isArray(descriptor)
    ? Object.keys(descriptor).sort()
    : [];
  if (JSON.stringify(keys) !== JSON.stringify(['path', 'role', 'sha256', 'type'])) {
    failures.push('fields');
  }
  if (descriptor?.role !== expectedRole) failures.push('role');
  if (descriptor?.type !== expectedType) failures.push('type');
  if (!path.isAbsolute(nonEmpty(descriptor?.path))) failures.push('path');
  if (normalizePlatformPath(descriptor?.path) !== nonEmpty(descriptor?.path)) failures.push('canonical_path');
  if (!SHA256_PATTERN.test(nonEmpty(descriptor?.sha256))) failures.push('sha256');
  return failures;
}

function verifyExternalArtifacts(artifacts, specifications, label) {
  if (!Array.isArray(artifacts)) throw new Error(`${label}缺少 external_artifacts`);
  const expectedRoles = specifications.map((item) => item.role);
  const observedRoles = artifacts.map((item) => nonEmpty(item?.role));
  if (JSON.stringify(observedRoles) !== JSON.stringify(expectedRoles)
    || new Set(observedRoles).size !== observedRoles.length) {
    throw new Error(`${label}外部证据角色不匹配：expected=${expectedRoles.join(',')} observed=${observedRoles.join(',')}`);
  }
  const verified = new Map();
  for (const [index, specification] of specifications.entries()) {
    const descriptor = artifacts[index];
    const failures = artifactDescriptorFailures(descriptor, specification.role, specification.type);
    if (failures.length) {
      throw new Error(`${label}外部证据描述无效：${specification.role}:${failures.join(',')}`);
    }
    if (specification.path
      && normalizePlatformPath(descriptor.path) !== normalizePlatformPath(specification.path)) {
      throw new Error(`${label}外部证据路径不匹配：${specification.role}`);
    }
    if (specification.sha256
      && nonEmpty(descriptor.sha256).toLowerCase() !== nonEmpty(specification.sha256).toLowerCase()) {
      throw new Error(`${label}外部证据 SHA-256 与报告描述不匹配：${specification.role}`);
    }
    try {
      if (descriptor.type === 'file') {
        const snapshot = stableFileSnapshot(descriptor.path, `${label}${descriptor.role}`);
        if (snapshot.sha256 !== descriptor.sha256.toLowerCase()) {
          throw new Error(`SHA-256 已漂移：expected=${descriptor.sha256} observed=${snapshot.sha256}`);
        }
        verified.set(descriptor.role, { descriptor, snapshot });
      } else {
        const snapshot = snapshotDirectoryTree(descriptor.path, `${label}${descriptor.role}`);
        if (snapshot.sha256 !== descriptor.sha256.toLowerCase()) {
          throw new Error(`目录树 SHA-256 已漂移：expected=${descriptor.sha256} observed=${snapshot.sha256}`);
        }
        verified.set(descriptor.role, { descriptor, snapshot });
      }
    } catch (error) {
      throw new Error(`${label}外部证据重验失败：${descriptor.role}；${error.message}`);
    }
  }
  return verified;
}

function withExternalArtifacts(audit, artifacts) {
  return {
    ...audit,
    external_artifacts: artifacts.map((artifact) => ({ ...artifact })),
  };
}

function controlLockPath(root) {
  const basename = path.basename(root);
  if (!basename || root === path.dirname(root)) throw new Error(`控制目录不能是文件系统根：${root}`);
  return path.join(path.dirname(root), `.${basename}.qwork-release-test.lock`);
}

function withControlLock(stateDir, operation) {
  const root = normalizePlatformPath(stateDir);
  const parentGuard = captureDirectoryGuard(path.dirname(root), '控制目录父目录');
  assertNoSymlinkPath(root, '控制目录', { allowMissingLeaf: true });
  if (fs.existsSync(root)) captureDirectoryGuard(root, '控制目录');
  const lockFile = controlLockPath(root);
  assertNoSymlinkPath(lockFile, '控制目录互斥锁', { allowMissingLeaf: true });
  const parentCommand = execFileSync(
    '/bin/ps',
    ['-p', String(process.ppid), '-o', 'comm='],
    { encoding: 'utf8' },
  ).trim();
  if (parentCommand !== '/usr/bin/lockf') {
    throw new Error(`发布测试控制命令父进程不是 /usr/bin/lockf：${parentCommand || '(missing)'}`);
  }
  const proof = spawnSync('/usr/bin/lockf', ['-t', '0', lockFile, '/usr/bin/true'], { encoding: 'utf8' });
  if (proof.status !== 75) {
    throw new Error(`发布测试控制命令未持有进程生命周期锁：${root}`);
  }
  assertDirectoryGuard(parentGuard, '控制目录父目录');
  return operation();
}

function executeUnderControlLock(argv, stateDir) {
  const root = normalizePlatformPath(stateDir);
  const parentGuard = captureDirectoryGuard(path.dirname(root), '控制目录父目录');
  assertNoSymlinkPath(root, '控制目录', { allowMissingLeaf: true });
  if (fs.existsSync(root)) captureDirectoryGuard(root, '控制目录');
  const lockFile = controlLockPath(root);
  assertNoSymlinkPath(lockFile, '控制目录互斥锁', { allowMissingLeaf: true });
  if (fs.existsSync(lockFile)) {
    const stat = fs.lstatSync(lockFile, { bigint: true });
    const uid = typeof process.getuid === 'function' ? BigInt(process.getuid()) : stat.uid;
    if (stat.isSymbolicLink() || !stat.isFile() || stat.uid !== uid) {
      throw new Error(`控制目录互斥锁必须是当前用户拥有的普通文件：${lockFile}`);
    }
  }
  assertDirectoryGuard(parentGuard, '控制目录父目录');
  const child = spawnSync('/usr/bin/lockf', [
    '-t', '0', lockFile,
    process.execPath,
    fileURLToPath(import.meta.url),
    ...argv,
  ], {
    stdio: 'inherit',
    env: { ...process.env, QBOT_QWORK_CONTROL_LOCK_ROOT: root },
  });
  if (child.error) throw child.error;
  if (child.status === 75) throw new Error(`发布测试控制目录正被另一命令占用：${root}`);
  process.exit(child.status ?? 1);
}

function verifyReleaseObservationRepository(observation, expectedRepository = '', { readGitLab = null } = {}) {
  const repository = assertSecureDirectory(observation?.repository, '独立 release HEAD 观测仓库');
  if (expectedRepository
    && repository !== assertSecureDirectory(expectedRepository, 'release intake 仓库')) {
    throw new Error(`独立 release HEAD 观测仓库与 release intake 不一致：observed=${repository} intake=${normalizePlatformPath(expectedRepository)}`);
  }
  const gitRoot = fs.realpathSync(execFileSync(
    'git',
    ['-C', repository, 'rev-parse', '--show-toplevel'],
    { encoding: 'utf8' },
  ).trim());
  if (gitRoot !== repository) {
    throw new Error(`独立 release HEAD 观测仓库不是 Git 顶层目录：declared=${repository} actual=${gitRoot}`);
  }
  const originUrl = execFileSync(
    'git',
    ['-C', repository, 'config', '--get', 'remote.origin.url'],
    { encoding: 'utf8' },
  ).trim();
  if (normalizeGitLabProject(originUrl) !== DEEPBANK_GITLAB_PROJECT) {
    throw new Error(`独立 release HEAD 观测仓库 origin 不是 deepbankV2 GitLab 项目：${originUrl || '(missing)'}`);
  }
  let observedHead = '';
  if (typeof readGitLab === 'function') {
    if (nonEmpty(observation?.source) !== 'gitlab-api') {
      throw new Error('stdin GitLab API 复核只接受 source=gitlab-api 的独立 release HEAD 观测');
    }
    try {
      observedHead = readStableQworkReleaseHead(readGitLab);
    } catch (error) {
      throw new Error(`无法通过固定 GitLab API 实时查询 release/0.1：${error?.message || error}`);
    }
  } else {
    let remoteOutput;
    try {
      remoteOutput = execFileSync(
        'git',
        ['-C', repository, 'ls-remote', '--exit-code', originUrl, 'refs/heads/release/0.1'],
        {
          encoding: 'utf8',
          timeout: 30_000,
          env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
        },
      ).trim();
    } catch (error) {
      throw new Error(`无法实时查询 canonical origin release/0.1：${error?.message || error}`);
    }
    const remoteLines = remoteOutput.split(/\r?\n/).filter(Boolean);
    const remoteMatch = remoteLines.length === 1
      ? remoteLines[0].match(/^([a-f0-9]{40})\s+refs\/heads\/release\/0\.1$/i)
      : null;
    observedHead = nonEmpty(remoteMatch?.[1]).toLowerCase();
  }
  if (!observedHead || observedHead !== nonEmpty(observation?.release_head).toLowerCase()) {
    throw new Error('独立 release HEAD 观测与 canonical origin 实时 ref 不一致');
  }
  if (typeof readGitLab !== 'function') {
    const localHead = execFileSync(
      'git',
      ['-C', repository, 'rev-parse', nonEmpty(observation?.release_ref)],
      { encoding: 'utf8' },
    ).trim().toLowerCase();
    if (localHead !== observedHead) {
      throw new Error('独立 release HEAD 观测与本地 remote-tracking ref 不一致');
    }
  }
  return { repository, observedHead };
}

function normalizeGitLabProject(remoteUrl) {
  const value = nonEmpty(remoteUrl);
  let host = '';
  let projectPath = '';
  const scpLike = value.match(/^(?:[^@/\s]+@)?([^:/\s]+):(.+)$/);
  if (scpLike && !value.includes('://')) {
    [, host, projectPath] = scpLike;
  } else {
    try {
      const parsed = new URL(value);
      if (!['https:', 'ssh:'].includes(parsed.protocol)) return '';
      if (parsed.port) return '';
      host = parsed.hostname;
      projectPath = parsed.pathname.replace(/^\/+/, '');
    } catch {
      return '';
    }
  }
  const normalizedPath = projectPath.replace(/\/+$/, '').replace(/\.git$/i, '').toLowerCase();
  return `${host.toLowerCase()}/${normalizedPath}`;
}

function git(...args) {
  return execFileSync('git', args, { encoding: 'utf8' }).trim();
}

function stateFiles(stateDir) {
  const root = normalizePlatformPath(stateDir);
  return {
    root,
    plan: path.join(root, 'release-test-plan.json'),
    state: path.join(root, 'release-test-state.json'),
    integrity: path.join(root, 'release-test-integrity.json'),
    events: path.join(root, 'events'),
    transaction: path.join(root, '.release-test-transaction.json'),
  };
}

function removeInterruptedWriteTemps(directory, label) {
  if (!fs.existsSync(directory)) return;
  const guard = captureDirectoryGuard(directory, label);
  const uid = typeof process.getuid === 'function' ? BigInt(process.getuid()) : null;
  for (const name of fs.readdirSync(directory)) {
    if (!/^\..+\.tmp-\d+-[a-f0-9]{16}$/i.test(name)) continue;
    const temporary = path.join(directory, name);
    const stat = fs.lstatSync(temporary, { bigint: true });
    if (!stat.isFile() || stat.isSymbolicLink() || (uid != null && stat.uid !== uid)) {
      throw new Error(`${label} 包含不安全的中断写入临时文件：${temporary}`);
    }
    fs.unlinkSync(temporary);
  }
  assertDirectoryGuard(guard, label);
  fsyncDirectory(directory);
}

function recoverControlTransaction(files) {
  removeInterruptedWriteTemps(files.root, '发布测试控制目录');
  removeInterruptedWriteTemps(files.events, '发布测试事件目录');
  if (!fs.existsSync(files.transaction)) return;
  const transaction = readJson(files.transaction, '发布测试事务记录');
  const keys = transaction && typeof transaction === 'object' && !Array.isArray(transaction)
    ? Object.keys(transaction).sort()
    : [];
  const expectedKeys = [
    'event',
    'event_file',
    'event_sha256',
    'integrity_after',
    'integrity_before_sha256',
    'plan_sha256',
    'schema_version',
    'state_after',
    'state_before_sha256',
  ];
  if (JSON.stringify(keys) !== JSON.stringify(expectedKeys)
    || transaction.schema_version !== TRANSACTION_SCHEMA) {
    throw new Error(`发布测试事务记录无效：${files.transaction}`);
  }
  const plan = readJson(files.plan, '发布测试计划');
  const state = readJson(files.state, '发布测试状态');
  const integrity = readJson(files.integrity, '发布测试完整性');
  if (transaction.plan_sha256 !== qworkReleaseIdentityFingerprint(plan)
    || plan?.schema_version !== QWORK_RELEASE_TEST_PLAN_SCHEMA
    || transaction.state_after?.schema_version !== QWORK_RELEASE_TEST_STATE_SCHEMA
    || transaction.integrity_after?.schema_version !== QWORK_RELEASE_TEST_INTEGRITY_SCHEMA
    || !EVENT_FILENAME_PATTERN.test(nonEmpty(transaction.event_file))
    || path.basename(transaction.event_file) !== transaction.event_file
    || transaction.event?.schema_version !== EVENT_SCHEMA
    || serializedJsonSha256(transaction.event) !== nonEmpty(transaction.event_sha256)) {
    throw new Error(`发布测试事务记录绑定无效：${files.transaction}`);
  }
  const stateHash = qworkReleaseIdentityFingerprint(state);
  const integrityHash = qworkReleaseIdentityFingerprint(integrity);
  const stateAfterHash = qworkReleaseIdentityFingerprint(transaction.state_after);
  const integrityAfterHash = qworkReleaseIdentityFingerprint(transaction.integrity_after);
  const candidateAudit = validateQworkReleaseControlState({
    plan,
    state: transaction.state_after,
    integrity: transaction.integrity_after,
  });
  if (!candidateAudit.ok
    || qworkReleaseIdentityFingerprint(transaction.event?.state_before) !== transaction.state_before_sha256
    || qworkReleaseIdentityFingerprint(transaction.event?.state_after) !== stateAfterHash
    || transaction.event?.state_sha256_after !== stateAfterHash
    || transaction.integrity_after?.last_event_sha256 !== transaction.event_sha256
    || transaction.integrity_after?.event_count !== transaction.event?.index) {
    throw new Error(`发布测试事务 post-state 无效：${candidateAudit.failures.join(',')}`);
  }
  const eventFile = path.join(files.events, transaction.event_file);
  if (!fs.existsSync(eventFile)) {
    if (stateHash !== transaction.state_before_sha256
      || integrityHash !== transaction.integrity_before_sha256) {
      throw new Error('发布测试事务在事件提交前出现状态漂移');
    }
    fs.unlinkSync(files.transaction);
    fsyncDirectory(files.root);
    return;
  }
  const eventSnapshot = stableFileSnapshot(eventFile, '发布测试事务事件');
  if (eventSnapshot.sha256 !== transaction.event_sha256
    || ![transaction.state_before_sha256, stateAfterHash].includes(stateHash)
    || ![transaction.integrity_before_sha256, integrityAfterHash].includes(integrityHash)
    || (stateHash === transaction.state_before_sha256 && integrityHash === integrityAfterHash)) {
    throw new Error('发布测试事务恢复绑定不一致');
  }
  writeJson(files.state, transaction.state_after);
  writeJson(files.integrity, transaction.integrity_after);
  fs.unlinkSync(files.transaction);
  fsyncDirectory(files.root);
}

function cleanupInterruptedInitStaging(parent, root) {
  const prefix = `.${path.basename(root)}.staging-`;
  const uid = typeof process.getuid === 'function' ? BigInt(process.getuid()) : null;
  for (const name of fs.readdirSync(parent)) {
    if (!name.startsWith(prefix)) continue;
    const candidate = path.join(parent, name);
    const stat = fs.lstatSync(candidate, { bigint: true });
    if (stat.isSymbolicLink() || !stat.isDirectory() || (uid != null && stat.uid !== uid)
      || (Number(stat.mode & 0o777n) & 0o077) !== 0) {
      throw new Error(`控制目录父目录包含不安全的 staging：${candidate}`);
    }
    fs.rmSync(candidate, { recursive: true, force: true });
  }
  fsyncDirectory(parent);
}

function assertControlDirectoryLayout(files) {
  assertSecureDirectory(files.root, '发布测试控制目录');
  const entries = fs.readdirSync(files.root, { withFileTypes: true });
  const names = entries.map((entry) => entry.name).sort();
  if (JSON.stringify(names) !== JSON.stringify(CONTROL_ENTRY_NAMES)) {
    throw new Error(`发布测试控制目录入口集合不合法：expected=${CONTROL_ENTRY_NAMES.join(',')} observed=${names.join(',')}`);
  }
  for (const file of [files.plan, files.state, files.integrity]) {
    const stat = fs.lstatSync(file);
    if (stat.isSymbolicLink() || !stat.isFile()) {
      throw new Error(`发布测试控制文件必须是普通文件且不能是符号链接：${file}`);
    }
  }
  assertSecureDirectory(files.events, '发布测试事件目录');
  const eventEntries = fs.readdirSync(files.events, { withFileTypes: true });
  for (const entry of eventEntries) {
    if (entry.isSymbolicLink() || !entry.isFile() || !EVENT_FILENAME_PATTERN.test(entry.name)) {
      throw new Error(`发布测试事件目录包含非法入口：${entry.name}`);
    }
  }
  return eventEntries.map((entry) => entry.name).sort();
}

function planSourceArtifactSpecifications(plan) {
  return [
    { role: 'casebook', type: 'file', path: plan?.casebook?.path },
    { role: 'release_identity', type: 'file', path: plan?.source_artifacts?.[1]?.path },
    { role: 'release_intake', type: 'file', path: plan?.release_intake?.path },
    { role: 'release_observation', type: 'file', path: plan?.release_head_observation?.path },
  ];
}

function planSourceMissingError(role, artifactPath) {
  if (role === 'casebook') return new Error(`Casebook 不存在：${artifactPath}`);
  if (role === 'release_identity') return new Error(`计划绑定的 release identity 不存在：${artifactPath}`);
  if (role === 'release_intake') return new Error(`计划绑定的 release intake 不存在：${artifactPath}`);
  return new Error(`计划绑定的独立 release HEAD 观测不存在：${artifactPath}`);
}

function validatePlanSourceArtifacts(plan) {
  const artifacts = plan?.source_artifacts;
  if (!Array.isArray(artifacts)) throw new Error('发布测试计划缺少 source_artifacts');
  const specifications = planSourceArtifactSpecifications(plan);
  const roles = artifacts.map((item) => nonEmpty(item?.role));
  if (JSON.stringify(roles) !== JSON.stringify(PLAN_EXTERNAL_ARTIFACT_ROLES)
    || new Set(roles).size !== roles.length) {
    throw new Error(`发布测试计划 source_artifacts 角色不合法：${roles.join(',')}`);
  }
  const snapshots = new Map();
  for (const [index, specification] of specifications.entries()) {
    const descriptor = artifacts[index];
    const failures = artifactDescriptorFailures(descriptor, specification.role, 'file');
    if (failures.length) {
      throw new Error(`发布测试计划 source_artifact 无效：${specification.role}:${failures.join(',')}`);
    }
    if (specification.path
      && normalizePlatformPath(descriptor.path) !== normalizePlatformPath(specification.path)) {
      throw new Error(`发布测试计划 source_artifact 路径不匹配：${specification.role}`);
    }
    try {
      snapshots.set(specification.role, stableFileSnapshot(
        descriptor.path,
        `计划源制品 ${specification.role}`,
      ));
    } catch (error) {
      if (error?.code === 'ENOENT' || !fs.existsSync(normalizePlatformPath(descriptor.path))) {
        throw planSourceMissingError(specification.role, descriptor.path);
      }
      throw error;
    }
  }

  const casebook = snapshots.get('casebook');
  if (casebook.sha256 !== nonEmpty(plan?.casebook?.sha256).toLowerCase()
    || casebook.sha256 !== nonEmpty(artifacts[0]?.sha256).toLowerCase()) {
    throw new Error(`Casebook SHA-256 已漂移：${casebook.path}`);
  }

  const identitySnapshot = snapshots.get('release_identity');
  if (identitySnapshot.sha256 !== nonEmpty(artifacts[1]?.sha256).toLowerCase()) {
    throw new Error(`release identity 制品 SHA-256 已漂移：${identitySnapshot.path}`);
  }
  const releaseIdentity = parseJsonSnapshot(identitySnapshot, 'release identity');
  const identityValidation = validateQworkReleaseIdentity(releaseIdentity);
  if (!identityValidation.ok
    || identityValidation.fingerprint !== plan.release_identity_sha256
    || qworkReleaseIdentityFingerprint(plan.release_identity) !== plan.release_identity_sha256) {
    throw new Error('release identity 制品与计划绑定身份不一致');
  }

  const intakeSnapshot = snapshots.get('release_intake');
  const releaseIntake = parseJsonSnapshot(intakeSnapshot, 'release intake');
  const intakeBinding = validateQworkReleaseIntakeBinding({
    plan,
    report: releaseIntake,
    reportSha256: intakeSnapshot.sha256,
  });
  if (!intakeBinding.ok) {
    throw new Error(`release intake 绑定校验失败：${intakeBinding.failures.join('；')}`);
  }
  if (intakeSnapshot.sha256 !== nonEmpty(artifacts[2]?.sha256).toLowerCase()) {
    throw new Error('release_intake_artifact_sha256_mismatch');
  }

  const observationSnapshot = snapshots.get('release_observation');
  const releaseObservation = parseJsonSnapshot(observationSnapshot, '独立 release HEAD 观测');
  const observationBinding = validateQworkReleaseRefObservationBinding({
    plan,
    report: releaseObservation,
    reportSha256: observationSnapshot.sha256,
  });
  if (!observationBinding.ok) {
    throw new Error(`独立 release HEAD 观测绑定校验失败：${observationBinding.failures.join('；')}`);
  }
  if (observationSnapshot.sha256 !== nonEmpty(artifacts[3]?.sha256).toLowerCase()) {
    throw new Error('release_observation_artifact_sha256_mismatch');
  }
  return {
    artifacts,
    snapshots,
    releaseIdentity,
    releaseIntake,
    releaseObservation,
  };
}

function readinessArtifactSpecifications(stageId) {
  return [
    { role: `${stageId}.readiness.capability_audit`, type: 'file' },
    { role: `${stageId}.readiness.pretest`, type: 'file' },
  ];
}

function completionArtifactSpecifications(stageId) {
  return [
    { role: `${stageId}.completion.progress`, type: 'file' },
    { role: `${stageId}.completion.summary`, type: 'file' },
    { role: `${stageId}.completion.metadata`, type: 'file' },
    { role: `${stageId}.completion.trusted_review`, type: 'file' },
    { role: `${stageId}.completion.evidence_tree`, type: 'directory-tree' },
  ];
}

function soakArtifactSpecifications(soak, reportPath) {
  const descriptors = Array.isArray(soak?.external_artifacts) ? soak.external_artifacts : [];
  if (!descriptors.length) throw new Error('Soak 报告缺少 external_artifacts');
  const specification = (descriptor, index) => {
    const artifactPath = nonEmpty(descriptor?.path);
    const artifactSha256 = nonEmpty(descriptor?.sha256).toLowerCase();
    if (!path.isAbsolute(artifactPath)) {
      throw new Error(`Soak 报告 external_artifacts[${index}] 路径无效`);
    }
    if (!SHA256_PATTERN.test(artifactSha256)) {
      throw new Error(`Soak 报告 external_artifacts[${index}] SHA-256 无效`);
    }
    return {
      role: `G5.soak.artifact.${String(index + 1).padStart(6, '0')}`,
      type: 'file',
      path: normalizePlatformPath(artifactPath),
      sha256: artifactSha256,
    };
  };
  return [
    { role: 'G5.soak.report', type: 'file', path: reportPath },
    ...descriptors.map(specification),
  ];
}

function verifiedJson(verified, role, label) {
  const snapshot = verified.get(role)?.snapshot;
  if (!snapshot) throw new Error(`${label}缺少已验证制品：${role}`);
  return parseJsonSnapshot(snapshot, label);
}

function rebuildStoredAudit({ event, plan, sourceArtifacts }) {
  const stageId = event.stage_id;
  let verified;
  let rebuilt;
  if (event.phase === 'readiness') {
    const specifications = readinessArtifactSpecifications(stageId);
    verified = verifyExternalArtifacts(event.audit?.external_artifacts, specifications, `${stageId} readiness `);
    rebuilt = auditQworkStageReadiness({
      plan,
      stageId,
      capabilityAudit: verifiedJson(verified, specifications[0].role, '能力审计'),
      pretest: verifiedJson(verified, specifications[1].role, 'Pretest'),
      expectedPrefixCaseIds: stageId === 'G4'
        ? event.state_before?.stages?.G3?.admission?.expected?.case_ids
        : undefined,
      releaseIntake: sourceArtifacts.releaseIntake,
      releaseIntakeSha256: sourceArtifacts.snapshots.get('release_intake').sha256,
      externalArtifacts: event.audit.external_artifacts,
    });
  } else if (stageId !== 'G5') {
    const specifications = completionArtifactSpecifications(stageId);
    verified = verifyExternalArtifacts(event.audit?.external_artifacts, specifications, `${stageId} completion `);
    const roles = Object.fromEntries(specifications.map((item) => [item.role.split('.').at(-1), item.role]));
    const runDir = verified.get(roles.evidence_tree).snapshot.path;
    const progressPath = normalizePlatformPath(path.join(runDir, 'automation-progress.json'));
    const summaryPath = normalizePlatformPath(path.join(runDir, 'automation-run-summary.json'));
    const metadataPath = normalizePlatformPath(path.join(runDir, 'run-metadata.json'));
    for (const [role, expectedPath] of [
      [roles.progress, progressPath],
      [roles.summary, summaryPath],
      [roles.metadata, metadataPath],
    ]) {
      if (verified.get(role).snapshot.path !== expectedPath) {
        throw new Error(`${stageId} completion 外部证据不属于固定运行目录入口：${role}`);
      }
    }
    const summary = verifiedJson(verified, roles.summary, '执行汇总');
    const trustedReview = resolveTrustedReview(runDir, summary);
    if (trustedReview.path !== verified.get(roles.trusted_review).snapshot.path
      || trustedReview.sha256 !== verified.get(roles.trusted_review).snapshot.sha256) {
      throw new Error(`${stageId} completion 可信复核路径或 SHA-256 与汇总不一致`);
    }
    rebuilt = auditQworkStageCompletion({
      plan,
      stageId,
      readinessAudit: event.state_before?.stages?.[stageId]?.admission,
      progress: verifiedJson(verified, roles.progress, '执行进度'),
      summary,
      trustedReview: verifiedJson(verified, roles.trusted_review, '可信复核'),
      trustedReviewPath: trustedReview.path,
      trustedReviewSha256: trustedReview.sha256,
      runMetadata: verifiedJson(verified, roles.metadata, '运行元数据'),
      runDir,
      externalArtifacts: event.audit.external_artifacts,
    });
  } else {
    const reportSpecification = [{ role: 'G5.soak.report', type: 'file' }];
    const reportVerified = verifyExternalArtifacts(
      [event.audit?.external_artifacts?.[0]],
      reportSpecification,
      'G5 soak ',
    );
    const soak = verifiedJson(reportVerified, 'G5.soak.report', 'Soak 报告');
    const reportPath = reportVerified.get('G5.soak.report').snapshot.path;
    const specifications = soakArtifactSpecifications(soak, reportPath);
    verified = verifyExternalArtifacts(event.audit?.external_artifacts, specifications, 'G5 soak ');
    rebuilt = auditQworkSoakCompletion({
      plan,
      soak,
      soakReportPath: reportPath,
      soakReportSha256: verified.get('G5.soak.report').snapshot.sha256,
      externalArtifacts: event.audit.external_artifacts,
      generatedAt: event.audit.generated_at,
    });
  }
  verifyExternalArtifacts(
    event.audit.external_artifacts,
    event.phase === 'readiness'
      ? readinessArtifactSpecifications(stageId)
      : stageId === 'G5'
        ? soakArtifactSpecifications(
          verifiedJson(verified, 'G5.soak.report', 'Soak 报告'),
          verified.get('G5.soak.report').snapshot.path,
        )
        : completionArtifactSpecifications(stageId),
    `${stageId} 审计后复验 `,
  );
  return {
    ...rebuilt,
    generated_at: event.audit.generated_at,
    external_artifacts: event.audit.external_artifacts.map((artifact) => ({ ...artifact })),
  };
}

function loadControlState(stateDir, remoteVerification = {}) {
  const files = stateFiles(stateDir);
  if (!fs.existsSync(files.root)) throw new Error(`发布测试控制目录不完整：${files.root}`);
  const rootGuard = captureDirectoryGuard(files.root, '发布测试控制目录');
  recoverControlTransaction(files);
  const eventFiles = assertControlDirectoryLayout(files);
  const eventsGuard = captureDirectoryGuard(files.events, '发布测试事件目录');
  const plan = readJson(files.plan, '发布测试计划');
  const state = readJson(files.state, '发布测试状态');
  const integrity = readJson(files.integrity, '发布测试完整性');
  const sourceArtifacts = validatePlanSourceArtifacts(plan);
  const audit = validateQworkReleaseControlState({ plan, state, integrity });
  if (!audit.ok) {
    throw new Error(`发布测试计划或状态已被改写：${files.root}；${audit.failures.join(',')}`);
  }
  verifyReleaseObservationRepository(
    sourceArtifacts.releaseObservation,
    plan.release_intake.repository,
    remoteVerification,
  );
  const eventFailures = [];
  let previousSha256 = '';
  let previousState = createQworkReleaseTestState(plan);
  let previousStateSha256 = qworkReleaseIdentityFingerprint(previousState);
  let previousRevision = 0;
  if (integrity.initial_state_sha256 !== previousStateSha256) {
    eventFailures.push('event_initial_state_anchor_mismatch');
  }
  eventFiles.forEach((name, index) => {
    const eventFile = path.join(files.events, name);
    const eventSnapshot = readJsonSnapshot(eventFile, `发布测试事件 ${name}`);
    const event = eventSnapshot.value;
    const expectedIndex = index + 1;
    const filename = name.match(EVENT_FILENAME_PATTERN);
    const expectedEventKeys = [
      'audit',
      'index',
      'phase',
      'plan_sha256',
      'previous_event_sha256',
      'recorded_at',
      'schema_version',
      'stage_id',
      'state_after',
      'state_before',
      'state_revision_after',
      'state_revision_before',
      'state_sha256_after',
      'state_sha256_before',
    ];
    if (!event || typeof event !== 'object' || Array.isArray(event)
      || JSON.stringify(Object.keys(event).sort()) !== JSON.stringify(expectedEventKeys)) {
      eventFailures.push(`event_fields_mismatch:${name}`);
    }
    if (event.schema_version !== EVENT_SCHEMA) {
      eventFailures.push(`event_schema_mismatch:${name}`);
    }
    if (!Number.isFinite(Date.parse(nonEmpty(event.recorded_at)))) {
      eventFailures.push(`event_recorded_at_invalid:${name}`);
    }
    if (event.index !== expectedIndex) eventFailures.push(`event_index_mismatch:${name}`);
    if (Number(filename?.[1]) !== expectedIndex
      || filename?.[2] !== event.stage_id
      || filename?.[3] !== event.phase) {
      eventFailures.push(`event_filename_binding_mismatch:${name}`);
    }
    if (event.plan_sha256 !== state.plan_sha256) eventFailures.push(`event_plan_sha256_mismatch:${name}`);
    if (event.state_revision_before !== previousRevision
      || event.state_revision_after !== previousRevision + 1) {
      eventFailures.push(`event_revision_mismatch:${name}`);
    }
    if (event.state_sha256_before !== previousStateSha256) {
      eventFailures.push(`event_state_chain_mismatch:${name}`);
    }
    if (!/^[a-f0-9]{64}$/i.test(nonEmpty(event.state_sha256_before))
      || !/^[a-f0-9]{64}$/i.test(nonEmpty(event.state_sha256_after))) {
      eventFailures.push(`event_state_sha256_invalid:${name}`);
    }
    if (event.audit?.stage_id !== event.stage_id) eventFailures.push(`event_stage_mismatch:${name}`);
    if (!['readiness', 'completion'].includes(event.phase)) eventFailures.push(`event_phase_mismatch:${name}`);
    if (nonEmpty(event.previous_event_sha256) !== previousSha256) {
      eventFailures.push(`event_chain_mismatch:${name}`);
    }
    if (qworkReleaseIdentityFingerprint(event.state_before) !== event.state_sha256_before
      || qworkReleaseIdentityFingerprint(event.state_after) !== event.state_sha256_after) {
      eventFailures.push(`event_state_snapshot_mismatch:${name}`);
    }
    if (qworkReleaseIdentityFingerprint(event.state_before) !== previousStateSha256) {
      eventFailures.push(`event_state_before_mismatch:${name}`);
    }
    try {
      const rebuiltAudit = rebuildStoredAudit({ event, plan, sourceArtifacts });
      if (qworkReleaseIdentityFingerprint(rebuiltAudit)
        !== qworkReleaseIdentityFingerprint(event.audit)) {
        eventFailures.push(`event_audit_revalidation_mismatch:${name}`);
      }
      const replayed = applyQworkStageAudit(previousState, event.audit, {
        plan,
        phase: event.phase,
        updatedAt: event.recorded_at,
        externalArtifacts: event.audit?.external_artifacts,
      });
      if (qworkReleaseIdentityFingerprint(replayed) !== event.state_sha256_after
        || qworkReleaseIdentityFingerprint(replayed) !== qworkReleaseIdentityFingerprint(event.state_after)) {
        eventFailures.push(`event_semantic_replay_mismatch:${name}`);
      }
    } catch (error) {
      eventFailures.push(`event_semantic_replay_failed:${name}:${error.message}`);
    }
    previousSha256 = eventSnapshot.sha256;
    previousStateSha256 = nonEmpty(event.state_sha256_after);
    previousState = event.state_after;
    previousRevision = Number(event.state_revision_after);
  });
  if (eventFiles.length !== integrity.event_count) eventFailures.push('event_count_mismatch');
  if (eventFiles.length !== state.revision) eventFailures.push('event_state_revision_count_mismatch');
  if (previousSha256 !== nonEmpty(integrity.last_event_sha256)) eventFailures.push('last_event_sha256_mismatch');
  if (eventFiles.length && previousStateSha256 !== integrity.state_sha256) {
    eventFailures.push('event_last_state_sha256_mismatch');
  }
  if (qworkReleaseIdentityFingerprint(previousState) !== integrity.state_sha256) {
    eventFailures.push('event_terminal_state_mismatch');
  }
  if (qworkReleaseIdentityFingerprint(previousState) !== qworkReleaseIdentityFingerprint(state)) {
    eventFailures.push('event_terminal_state_snapshot_mismatch');
  }
  if (eventFailures.length) {
    throw new Error(`发布测试事件链已被改写：${files.root}；${eventFailures.join(',')}`);
  }
  assertDirectoryGuard(eventsGuard, '发布测试事件目录');
  assertDirectoryGuard(rootGuard, '发布测试控制目录');
  return { files, plan, state, integrity, sourceArtifacts, guards: { rootGuard, eventsGuard } };
}

function nonEmpty(value) {
  return String(value ?? '').trim();
}

function resolveReport(input, filename) {
  const resolved = normalizePlatformPath(input);
  if (!fs.existsSync(resolved)) throw new Error(`报告不存在：${resolved}`);
  const stat = fs.lstatSync(resolved);
  if (stat.isSymbolicLink()) throw new Error(`报告路径不能是符号链接：${resolved}`);
  if (stat.isDirectory()) {
    assertSecureDirectory(resolved, '报告目录');
    const nested = path.join(resolved, filename);
    if (!fs.existsSync(nested)) throw new Error(`目录缺少 ${filename}：${resolved}`);
    return assertPlainFile(nested, filename);
  }
  return assertPlainFile(resolved, '报告文件');
}

function resolveTrustedReview(runDir, summary) {
  const resolvedRunDir = assertSecureDirectory(runDir, '执行目录');
  const declared = nonEmpty(summary?.credibility_review_json);
  const candidates = declared
    ? [path.isAbsolute(declared) ? path.resolve(declared) : path.resolve(resolvedRunDir, declared)]
    : [path.join(resolvedRunDir, '二次复核结构化结果.json'), path.join(resolvedRunDir, '可信二次复核结果.json')];
  for (const candidate of candidates) {
    if (!fs.existsSync(candidate)) continue;
    const stat = fs.lstatSync(candidate);
    const real = stat.isSymbolicLink() ? '' : fs.realpathSync(candidate);
    const relative = real ? path.relative(resolvedRunDir, real) : '..';
    if (!stat.isFile() || stat.isSymbolicLink() || relative.startsWith('..') || path.isAbsolute(relative)) {
      throw new Error(`可信二次复核文件必须是执行目录内普通文件：${candidate}`);
    }
    return { path: real, sha256: sha256File(real) };
  }
  throw new Error(`执行目录缺少可信二次复核结构化结果：${runDir}`);
}

function buildAuditEvent(audit, phase, {
  stateBefore,
  stateAfter,
  previousEventSha256 = '',
  eventCount = 0,
  recordedAt,
} = {}) {
  const nextIndex = eventCount + 1;
  const event = {
    schema_version: EVENT_SCHEMA,
    index: nextIndex,
    recorded_at: recordedAt,
    stage_id: audit.stage_id,
    phase,
    plan_sha256: stateAfter.plan_sha256,
    state_revision_before: stateBefore.revision,
    state_revision_after: stateAfter.revision,
    state_sha256_before: qworkReleaseIdentityFingerprint(stateBefore),
    state_sha256_after: qworkReleaseIdentityFingerprint(stateAfter),
    previous_event_sha256: previousEventSha256,
    state_before: stateBefore,
    state_after: stateAfter,
    audit,
  };
  return {
    event,
    eventFilename: `${String(nextIndex).padStart(4, '0')}-${audit.stage_id}-${phase}.json`,
    eventSha256: serializedJsonSha256(event),
    eventCount: nextIndex,
  };
}

function saveAudit({ files, plan, state, integrity, audit, phase, guards }) {
  const recordedAt = new Date().toISOString();
  const nextState = applyQworkStageAudit(state, audit, {
    plan,
    phase,
    updatedAt: recordedAt,
    externalArtifacts: audit.external_artifacts,
  });
  assertDirectoryGuard(guards.eventsGuard, '发布测试事件目录');
  assertDirectoryGuard(guards.rootGuard, '发布测试控制目录');
  const event = buildAuditEvent(audit, phase, {
    stateBefore: state,
    stateAfter: nextState,
    previousEventSha256: integrity.last_event_sha256,
    eventCount: integrity.event_count,
    recordedAt,
  });
  const nextIntegrity = createQworkReleaseTestIntegrity(plan, nextState, {
    eventCount: event.eventCount,
    lastEventSha256: event.eventSha256,
    initialStateSha256: integrity.initial_state_sha256,
  });
  const transaction = {
    schema_version: TRANSACTION_SCHEMA,
    plan_sha256: qworkReleaseIdentityFingerprint(plan),
    state_before_sha256: qworkReleaseIdentityFingerprint(state),
    integrity_before_sha256: qworkReleaseIdentityFingerprint(integrity),
    event_file: event.eventFilename,
    event_sha256: event.eventSha256,
    event: event.event,
    state_after: nextState,
    integrity_after: nextIntegrity,
  };
  writeJson(files.transaction, transaction, { flag: 'wx' });
  if (process.env.NODE_ENV === 'test' && process.env.QBOT_QWORK_FAULT_AFTER_TRANSACTION === '1') {
    process.kill(process.pid, 'SIGKILL');
  }
  const eventFile = path.join(files.events, event.eventFilename);
  writeJson(eventFile, event.event, { flag: 'wx' });
  if (sha256File(eventFile) !== event.eventSha256) throw new Error('发布测试事务事件落盘 SHA-256 不一致');
  if (process.env.NODE_ENV === 'test' && process.env.QBOT_QWORK_FAULT_AFTER_EVENT === '1') {
    process.kill(process.pid, 'SIGKILL');
  }
  writeJson(files.state, nextState);
  writeJson(files.integrity, nextIntegrity);
  fs.unlinkSync(files.transaction);
  fsyncDirectory(files.root);
  assertDirectoryGuard(guards.eventsGuard, '发布测试事件目录');
  assertDirectoryGuard(guards.rootGuard, '发布测试控制目录');
  return { nextState, eventFile };
}

function init(options, remoteVerification = {}) {
  required(options, [
    'state-dir',
    'casebook',
    'release-identity',
    'release-intake',
    'expected-release-observation',
    'expected-release-ref',
    'expected-release-head',
  ]);
  const files = stateFiles(options['state-dir']);
  const parentGuard = captureDirectoryGuard(path.dirname(files.root), '控制目录父目录');
  cleanupInterruptedInitStaging(parentGuard.path, files.root);
  assertDirectoryGuard(parentGuard, '控制目录父目录');
  let existingRootGuard = null;
  if (fs.existsSync(files.root)) {
    existingRootGuard = captureDirectoryGuard(files.root, '控制目录');
    if (fs.readdirSync(files.root).length) {
      throw new Error(`控制目录必须是新的空目录：${files.root}`);
    }
  }
  if (Object.hasOwn(options, 'require-release-intake')
    && !['1', 'true', 'yes'].includes(String(options['require-release-intake']).toLowerCase())) {
    throw new Error('正式发布计划不能关闭 release intake 门禁');
  }
  const releaseIntakePath = assertPlainFile(options['release-intake'], 'release intake 报告');
  const releaseObservationPath = assertPlainFile(options['expected-release-observation'], '独立 release HEAD 观测');
  const releaseIdentityPath = assertPlainFile(options['release-identity'], 'release identity');
  const casebook = assertPlainFile(options.casebook, 'Casebook');
  const head = git('rev-parse', 'HEAD');
  const originMain = git('rev-parse', 'origin/main');
  const branch = git('branch', '--show-current');
  const dirty = git('status', '--porcelain', '--untracked-files=no');
  if (branch !== 'main' || head !== originMain || dirty) {
    throw new Error(`正式计划要求 main==origin/main 且 tracked clean：branch=${branch} HEAD=${head} origin/main=${originMain} dirty=${Boolean(dirty)}`);
  }
  const identitySnapshot = readJsonSnapshot(releaseIdentityPath, 'release identity');
  const intakeSnapshot = readJsonSnapshot(releaseIntakePath, 'release intake');
  const observationSnapshot = readJsonSnapshot(releaseObservationPath, '独立 release HEAD 观测');
  const casebookSnapshot = stableFileSnapshot(casebook, 'Casebook');
  const identity = identitySnapshot.value;
  const releaseIntake = intakeSnapshot.value;
  const releaseHeadObservation = observationSnapshot.value;
  const releaseObservationValidation = validateQworkReleaseRefObservation({
    report: releaseHeadObservation,
    reportPath: releaseObservationPath,
    reportSha256: observationSnapshot.sha256,
    expectedReleaseRef: options['expected-release-ref'],
    expectedReleaseHead: options['expected-release-head'],
  });
  if (!releaseObservationValidation.ok) {
    throw new Error(`独立 release HEAD 观测无效：${releaseObservationValidation.failures.join('；')}`);
  }
  verifyReleaseObservationRepository(
    releaseHeadObservation,
    releaseIntake?.release?.repository,
    remoteVerification,
  );
  const plan = createQworkReleaseTestPlan({
    casebookPath: casebook,
    casebookSha256: casebookSnapshot.sha256,
    frameworkCommit: head,
    releaseIdentity: identity,
    releaseIdentityPath,
    releaseIdentitySha256: identitySnapshot.sha256,
    releaseIntake,
    releaseIntakePath,
    releaseIntakeSha256: intakeSnapshot.sha256,
    expectedReleaseRef: options['expected-release-ref'],
    expectedReleaseHead: options['expected-release-head'],
    releaseHeadObservation,
    releaseHeadObservationPath: releaseObservationPath,
    releaseHeadObservationSha256: observationSnapshot.sha256,
  });
  validatePlanSourceArtifacts(plan);
  const state = createQworkReleaseTestState(plan);
  const integrity = createQworkReleaseTestIntegrity(plan, state);
  assertDirectoryGuard(parentGuard, '控制目录父目录');
  if (existingRootGuard) assertDirectoryGuard(existingRootGuard, '控制目录');
  const stagingRoot = fs.mkdtempSync(path.join(
    parentGuard.path,
    `.${path.basename(files.root)}.staging-${process.pid}-`,
  ));
  try {
    fs.chmodSync(stagingRoot, 0o700);
    const stagingFiles = stateFiles(stagingRoot);
    fs.mkdirSync(stagingFiles.events, { mode: 0o700 });
    writeJson(stagingFiles.plan, plan, { flag: 'wx' });
    writeJson(stagingFiles.state, state, { flag: 'wx' });
    writeJson(stagingFiles.integrity, integrity, { flag: 'wx' });
    assertControlDirectoryLayout(stagingFiles);
    if (process.env.NODE_ENV === 'test' && process.env.QBOT_QWORK_FAULT_AFTER_INIT_STAGING === '1') {
      process.kill(process.pid, 'SIGKILL');
    }
    verifyReleaseObservationRepository(
      releaseHeadObservation,
      releaseIntake?.release?.repository,
      remoteVerification,
    );
    assertDirectoryGuard(parentGuard, '控制目录父目录');
    if (existingRootGuard) assertDirectoryGuard(existingRootGuard, '控制目录');
    fs.renameSync(stagingRoot, files.root);
    fsyncDirectory(parentGuard.path);
  } finally {
    if (fs.existsSync(stagingRoot)) fs.rmSync(stagingRoot, { recursive: true, force: true });
  }
  captureDirectoryGuard(files.root, '控制目录');
  assertControlDirectoryLayout(files);
  return { command: 'init', files, plan, state, integrity };
}

function readiness(options, remoteVerification = {}) {
  required(options, ['state-dir', 'stage', 'capability-audit', 'pretest']);
  const { files, plan, state, integrity, sourceArtifacts, guards } = loadControlState(
    options['state-dir'],
    remoteVerification,
  );
  const stage = qworkReleaseStage(options.stage);
  if (!stage || stage.kind !== 'casebook') throw new Error(`readiness 只接受 G1-G4：${options.stage}`);
  const capabilitySnapshot = readJsonSnapshot(
    resolveReport(options['capability-audit'], 'capability-audit.json'),
    '能力审计',
  );
  const pretestSnapshot = readJsonSnapshot(
    resolveReport(options.pretest, 'core-beta-pretest-report.json'),
    'Pretest',
  );
  const currentBranch = git('branch', '--show-current');
  const currentHead = git('rev-parse', 'HEAD');
  const currentOriginMain = git('rev-parse', 'origin/main');
  const currentDirty = git('status', '--porcelain', '--untracked-files=no');
  if (currentBranch !== 'main' || currentHead !== plan.framework.commit
    || currentOriginMain !== plan.framework.commit || currentDirty) {
    throw new Error(`readiness 框架 Git 身份不满足 main==origin/main==plan 且 tracked clean：branch=${currentBranch} HEAD=${currentHead} origin/main=${currentOriginMain} dirty=${Boolean(currentDirty)}`);
  }
  verifyReleaseObservationRepository(
    sourceArtifacts.releaseObservation,
    plan.release_intake.repository,
    remoteVerification,
  );
  const externalArtifacts = [
    artifactFromSnapshot(`${stage.id}.readiness.capability_audit`, capabilitySnapshot),
    artifactFromSnapshot(`${stage.id}.readiness.pretest`, pretestSnapshot),
  ];
  let audit = auditQworkStageReadiness({
    plan,
    stageId: stage.id,
    capabilityAudit: capabilitySnapshot.value,
    pretest: pretestSnapshot.value,
    expectedPrefixCaseIds: stage.id === 'G4'
      ? state?.stages?.G3?.admission?.expected?.case_ids
      : undefined,
    releaseIntake: sourceArtifacts.releaseIntake,
    releaseIntakeSha256: sourceArtifacts.snapshots.get('release_intake').sha256,
    externalArtifacts,
  });
  audit = withExternalArtifacts(audit, externalArtifacts);
  verifyExternalArtifacts(externalArtifacts, readinessArtifactSpecifications(stage.id), `${stage.id} readiness `);
  const saved = saveAudit({ files, plan, state, integrity, audit, phase: 'readiness', guards });
  return { command: 'readiness', audit, event: saved.eventFile, state: saved.nextState };
}

function complete(options, remoteVerification = {}) {
  required(options, ['state-dir', 'stage', 'run-dir']);
  const { files, plan, state, integrity, guards } = loadControlState(
    options['state-dir'],
    remoteVerification,
  );
  const stage = qworkReleaseStage(options.stage);
  if (!stage || stage.kind !== 'casebook') throw new Error(`complete 只接受 G1-G4：${options.stage}`);
  const runDir = assertSecureDirectory(options['run-dir'], '不可变执行目录');
  const progressSnapshot = readJsonSnapshot(resolveReport(runDir, 'automation-progress.json'), '执行进度');
  const summarySnapshot = readJsonSnapshot(resolveReport(runDir, 'automation-run-summary.json'), '执行汇总');
  const metadataSnapshot = readJsonSnapshot(resolveReport(runDir, 'run-metadata.json'), '运行元数据');
  const summary = summarySnapshot.value;
  const trustedReviewFile = resolveTrustedReview(runDir, summary);
  const trustedReviewSnapshot = readJsonSnapshot(trustedReviewFile.path, '可信复核');
  const externalArtifacts = [
    artifactFromSnapshot(`${stage.id}.completion.progress`, progressSnapshot),
    artifactFromSnapshot(`${stage.id}.completion.summary`, summarySnapshot),
    artifactFromSnapshot(`${stage.id}.completion.metadata`, metadataSnapshot),
    artifactFromSnapshot(`${stage.id}.completion.trusted_review`, trustedReviewSnapshot),
    captureDirectoryTreeArtifact(`${stage.id}.completion.evidence_tree`, runDir, '不可变执行证据树'),
  ];
  let audit = auditQworkStageCompletion({
    plan,
    stageId: stage.id,
    readinessAudit: state?.stages?.[stage.id]?.admission,
    progress: progressSnapshot.value,
    summary,
    trustedReview: trustedReviewSnapshot.value,
    trustedReviewPath: trustedReviewFile.path,
    trustedReviewSha256: trustedReviewFile.sha256,
    runMetadata: metadataSnapshot.value,
    runDir,
    externalArtifacts,
  });
  audit = withExternalArtifacts(audit, externalArtifacts);
  verifyExternalArtifacts(externalArtifacts, completionArtifactSpecifications(stage.id), `${stage.id} completion `);
  const saved = saveAudit({ files, plan, state, integrity, audit, phase: 'completion', guards });
  return { command: 'complete', audit, event: saved.eventFile, state: saved.nextState };
}

function soak(options, remoteVerification = {}) {
  required(options, ['state-dir', 'soak-report']);
  const { files, plan, state, integrity, guards } = loadControlState(
    options['state-dir'],
    remoteVerification,
  );
  const soakReportSnapshot = readJsonSnapshot(assertPlainFile(options['soak-report'], 'Soak 报告'), 'Soak 报告');
  const soakReportPath = soakReportSnapshot.path;
  const specifications = soakArtifactSpecifications(soakReportSnapshot.value, soakReportPath);
  const externalArtifacts = specifications.map((item) => captureFileArtifact(item.role, item.path, item.role));
  let audit = auditQworkSoakCompletion({
    plan,
    soak: soakReportSnapshot.value,
    soakReportPath,
    soakReportSha256: soakReportSnapshot.sha256,
    externalArtifacts,
  });
  audit = withExternalArtifacts(audit, externalArtifacts);
  verifyExternalArtifacts(externalArtifacts, specifications, 'G5 soak ');
  const saved = saveAudit({ files, plan, state, integrity, audit, phase: 'completion', guards });
  return { command: 'soak', audit, event: saved.eventFile, state: saved.nextState };
}

function status(options, remoteVerification = {}) {
  required(options, ['state-dir']);
  const { files, plan, state, integrity } = loadControlState(options['state-dir'], remoteVerification);
  return { command: 'status', files, plan, state, integrity };
}

const { command, options } = parseArgs(process.argv.slice(2));
if (!command || ['help', '--help', '-h'].includes(command) || options.help) {
  process.stdout.write(usage());
  process.exit(0);
}

const handlers = { init, readiness, complete, soak, status };
if (!handlers[command]) throw new Error(`Unknown command: ${command}`);
required(options, ['state-dir']);
const lockRoot = normalizePlatformPath(options['state-dir']);
if (process.env.QBOT_QWORK_CONTROL_LOCK_ROOT !== lockRoot) {
  executeUnderControlLock(process.argv.slice(2), lockRoot);
}
const remoteVerification = releaseRemoteVerification(options);
const result = withControlLock(
  options['state-dir'],
  () => handlers[command](options, remoteVerification),
);
process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
