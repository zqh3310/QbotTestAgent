import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { validatePinnedQworkUiUrl } from './config.mjs';

const PINNED_FIELDS = [
  'host.product',
  'host.version',
  'host.build',
  'host.app_path',
  'qwork.version',
  'qwork.url',
  'control_plane.origin',
  'model_tier',
  'timeout_ms',
];

function readPath(value, dotted) {
  return dotted.split('.').reduce((current, key) => current?.[key], value);
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
  observedAt = new Date().toISOString(),
} = {}) {
  if (!session || session.profile_mode !== 'live') {
    throw new Error('Run metadata requires the managed live 360Teams session.');
  }
  const host = bundleIdentity || readMacAppBundleIdentity(session.app_path);
  const qwork = validatePinnedQworkUiUrl(qworkUiUrl);
  const controlPlaneOrigin = new URL(String(controlPlane || '')).origin;
  const ids = [...new Set(caseIds.map((value) => String(value || '').trim()).filter(Boolean))];
  return {
    schema_version: 1,
    captured_at: observedAt,
    last_observed_at: observedAt,
    host,
    qwork: { version: qwork.version, url: qwork.url },
    control_plane: { origin: controlPlaneOrigin },
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
