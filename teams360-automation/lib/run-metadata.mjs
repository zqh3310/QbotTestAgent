import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { validatePinnedQworkUiUrl } from './config.mjs';

const PINNED_FIELDS = [
  'host.product',
  'host.version',
  'host.build',
  'host.app_path',
  'qwork.version',
  'qwork.url',
  'artifacts.host_info_plist_sha256',
  'artifacts.host_main_binary_sha256',
  'artifacts.qwork_index_sha256',
  'artifacts.qwork_install_metadata_sha256',
  'artifacts.casebook_sha256',
  'sources.framework.commit',
  'sources.framework.dirty',
  'sources.deepbank.commit',
  'sources.deepbank.dirty',
  'control_plane.origin',
  'release_inputs.backend_version',
  'release_inputs.prompt_policy_version',
  'release_inputs.feature_flags_hash',
  'model_tier',
  'timeout_ms',
];

function readPath(value, dotted) {
  return dotted.split('.').reduce((current, key) => current?.[key], value);
}

export function sha256File(file) {
  const resolved = path.resolve(String(file || ''));
  if (!fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) return '';
  const hash = createHash('sha256');
  const fd = fs.openSync(resolved, 'r');
  const buffer = Buffer.allocUnsafe(1024 * 1024);
  try {
    let bytes = 0;
    do {
      bytes = fs.readSync(fd, buffer, 0, buffer.length, null);
      if (bytes > 0) hash.update(buffer.subarray(0, bytes));
    } while (bytes > 0);
  } finally {
    fs.closeSync(fd);
  }
  return hash.digest('hex');
}

function readGitIdentity(repoRoot, execFile = execFileSync) {
  const root = path.resolve(String(repoRoot || ''));
  if (!fs.existsSync(path.join(root, '.git'))) return { root, commit: '', dirty: null };
  try {
    const commit = String(execFile('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' })).trim();
    const status = String(execFile('git', ['status', '--porcelain', '--untracked-files=no'], { cwd: root, encoding: 'utf8' })).trim();
    return { root, commit, dirty: Boolean(status) };
  } catch (error) {
    return { root, commit: '', dirty: null, error: String(error?.message || error) };
  }
}

function qworkArtifactPaths(qworkUrl) {
  try {
    const index = decodeURIComponent(new URL(String(qworkUrl || '')).pathname);
    return {
      index,
      installMetadata: path.join(path.dirname(index), '.installed.json'),
    };
  } catch {
    return { index: '', installMetadata: '' };
  }
}

export function buildReleaseArtifactFingerprints({ host, qworkUiUrl, casebookPath = '' } = {}) {
  const app = path.resolve(String(host?.app_path || ''));
  const qwork = qworkArtifactPaths(qworkUiUrl);
  const executableName = path.basename(app, '.app') || '360Teams';
  return {
    algorithm: 'sha256',
    host_info_plist_sha256: sha256File(path.join(app, 'Contents', 'Info.plist')),
    host_main_binary_sha256: sha256File(path.join(app, 'Contents', 'MacOS', executableName)),
    qwork_index_sha256: sha256File(qwork.index),
    qwork_install_metadata_sha256: sha256File(qwork.installMetadata),
    casebook_sha256: sha256File(casebookPath),
  };
}

export function readMacAppBundleIdentity(appPath, execFile = execFileSync) {
  const resolvedApp = path.resolve(String(appPath || ''));
  const plist = path.join(resolvedApp, 'Contents', 'Info.plist');
  if (!fs.existsSync(plist)) throw new Error(`360Teams bundle metadata is unavailable: ${plist}`);
  const read = (key) => String(execFile('plutil', ['-extract', key, 'raw', plist], { encoding: 'utf8' })).trim();
  const version = read('CFBundleShortVersionString');
  const build = read('CFBundleVersion');
  if (!version || !build) throw new Error(`360Teams bundle identity is incomplete: ${resolvedApp}`);
  return { product: '360Teams', version, build, app_path: resolvedApp };
}

export function buildTeamsRunMetadata({
  session,
  qworkUiUrl,
  controlPlane,
  modelTier = 'M3',
  timeoutMs = 600000,
  caseIds = [],
  bundleIdentity = null,
  casebookPath = '',
  frameworkRoot = '',
  deepbankRoot = '',
  releaseInputs = {},
  observedAt = new Date().toISOString(),
} = {}) {
  if (!session || session.profile_mode !== 'live') {
    throw new Error('Run metadata requires the managed live 360Teams session.');
  }
  const host = bundleIdentity || readMacAppBundleIdentity(session.app_path);
  const qwork = validatePinnedQworkUiUrl(qworkUiUrl);
  const controlPlaneOrigin = new URL(String(controlPlane || '')).origin;
  const ids = [...new Set(caseIds.map((value) => String(value || '').trim()).filter(Boolean))];
  const artifacts = buildReleaseArtifactFingerprints({ host, qworkUiUrl: qwork.url, casebookPath });
  return {
    schema_version: 2,
    captured_at: observedAt,
    last_observed_at: observedAt,
    host,
    qwork: { version: qwork.version, url: qwork.url },
    control_plane: { origin: controlPlaneOrigin },
    artifacts,
    sources: {
      framework: readGitIdentity(frameworkRoot || path.resolve(import.meta.dirname, '../..')),
      deepbank: readGitIdentity(deepbankRoot),
    },
    release_inputs: {
      backend_version: String(releaseInputs.backend_version || '').trim(),
      prompt_policy_version: String(releaseInputs.prompt_policy_version || '').trim(),
      feature_flags_hash: String(releaseInputs.feature_flags_hash || '').trim(),
    },
    model_tier: String(modelTier || '').toUpperCase(),
    timeout_ms: Number(timeoutMs),
    profile: {
      mode: session.profile_mode,
      alias: path.resolve(String(session.profile_alias || '')),
    },
    observed_host_pids: Number(session.pid) > 0 ? [Number(session.pid)] : [],
    selected_case_ids: ids,
  };
}

export function writePinnedRunMetadata(outDir, metadata) {
  const directory = path.resolve(outDir);
  fs.mkdirSync(directory, { recursive: true });
  const file = path.join(directory, 'run-metadata.json');
  let merged = metadata;
  if (fs.existsSync(file)) {
    const existing = JSON.parse(fs.readFileSync(file, 'utf8'));
    for (const field of PINNED_FIELDS) {
      if (String(readPath(existing, field) ?? '') !== String(readPath(metadata, field) ?? '')) {
        throw new Error(
          `Run identity drift detected for ${field}: `
          + `${JSON.stringify(readPath(existing, field))} -> ${JSON.stringify(readPath(metadata, field))}`,
        );
      }
    }
    const priorIds = new Set(existing.selected_case_ids || []);
    const nextIds = new Set(metadata.selected_case_ids || []);
    if (priorIds.size !== nextIds.size || [...priorIds].some((id) => !nextIds.has(id))) {
      throw new Error('Run identity drift detected for selected_case_ids. Resume must keep the frozen Case set.');
    }
    merged = {
      ...existing,
      last_observed_at: metadata.last_observed_at,
      observed_host_pids: [...new Set([
        ...(existing.observed_host_pids || []),
        ...(metadata.observed_host_pids || []),
      ])],
    };
  }
  const temporary = `${file}.tmp-${process.pid}`;
  fs.writeFileSync(temporary, `${JSON.stringify(merged, null, 2)}\n`, { mode: 0o600 });
  fs.renameSync(temporary, file);
  return { file, metadata: merged };
}

export function assertRunMetadataHost(metadata, expectedHost) {
  const errors = [];
  for (const field of ['product', 'version', 'build']) {
    if (String(metadata?.host?.[field] || '') !== String(expectedHost?.[field] || '')) {
      errors.push(`host.${field}=${JSON.stringify(metadata?.host?.[field])}, expected ${JSON.stringify(expectedHost?.[field])}`);
    }
  }
  if (String(metadata?.qwork?.version || '') !== String(expectedHost?.qwork || '')) {
    errors.push(`qwork.version=${JSON.stringify(metadata?.qwork?.version)}, expected ${JSON.stringify(expectedHost?.qwork)}`);
  }
  if (String(metadata?.control_plane?.origin || '') !== String(expectedHost?.control_plane_origin || '')) {
    errors.push(
      `control_plane.origin=${JSON.stringify(metadata?.control_plane?.origin)}, `
      + `expected ${JSON.stringify(expectedHost?.control_plane_origin)}`,
    );
  }
  if (String(metadata?.model_tier || '') !== String(expectedHost?.model_tier || '')) {
    errors.push(`model_tier=${JSON.stringify(metadata?.model_tier)}, expected ${JSON.stringify(expectedHost?.model_tier)}`);
  }
  return { ok: errors.length === 0, errors };
}
