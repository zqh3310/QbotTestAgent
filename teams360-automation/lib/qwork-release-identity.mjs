import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

export const QWORK_RELEASE_IDENTITY_READBACK_SCHEMA = 'qwork-release-identity-readback/v1';
export const QWORK_UI_CODE_MANIFEST_SCHEMA = 'qwork-ui-code-manifest/v1';

const OBSERVED_QWORK_IDENTITY_FIELDS = Object.freeze([
  'qwork_version',
  'prompt_policy_version',
  'feature_flags_hash',
  'qwork_ui_git_commit',
  'qwork_build_id',
  'qwork_release_manifest_sha256',
]);

function text(value) {
  return String(value ?? '').trim();
}

function shaFile(file, algorithm, encoding = 'hex') {
  const hash = createHash(algorithm);
  const fd = fs.openSync(file, 'r');
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
  return hash.digest(encoding);
}

function sha512Integrity(value) {
  return `sha512-${createHash('sha512').update(value).digest('base64')}`;
}

function validSha512Integrity(value) {
  const match = /^sha512-([A-Za-z0-9+/]+={0,2})$/.exec(text(value));
  if (!match) return false;
  const decoded = Buffer.from(match[1], 'base64');
  return decoded.length === 64 && decoded.toString('base64') === match[1];
}

function isWithin(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function strictDirectory(directory, root = directory, label = 'directory') {
  const resolved = path.resolve(directory);
  const stat = fs.lstatSync(resolved);
  if (stat.isSymbolicLink() || !stat.isDirectory()) {
    throw new Error(`${label} must be a real directory: ${resolved}`);
  }
  const real = fs.realpathSync(resolved);
  const realRoot = fs.realpathSync(path.resolve(root));
  if (!isWithin(realRoot, real)) throw new Error(`${label} escapes its release root: ${resolved}`);
  return real;
}

function strictFile(file, root, label = 'file') {
  const resolved = path.resolve(file);
  const lexicalRoot = path.resolve(root);
  const resolvedRoot = strictDirectory(root, root, `${label} root`);
  if (!isWithin(lexicalRoot, resolved)) {
    throw new Error(`${label} escapes its release root: ${resolved}`);
  }
  const stat = fs.lstatSync(resolved);
  if (stat.isSymbolicLink() || !stat.isFile()) {
    throw new Error(`${label} must be a regular non-symlink file: ${resolved}`);
  }
  const real = fs.realpathSync(resolved);
  if (!isWithin(resolvedRoot, real)) throw new Error(`${label} realpath escapes its release root: ${resolved}`);
  return { file: real, bytes: stat.size };
}

function readJsonFile(file, root, label) {
  const artifact = strictFile(file, root, label);
  let value;
  try {
    value = JSON.parse(fs.readFileSync(artifact.file, 'utf8'));
  } catch (error) {
    throw new Error(`${label} is not valid JSON: ${error?.message || error}`);
  }
  if (value == null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must contain a JSON object.`);
  }
  return { ...artifact, value, sha256: shaFile(artifact.file, 'sha256') };
}

function safeRelativeFile(root, relative, label) {
  const value = text(relative);
  if (!value || path.isAbsolute(value)) throw new Error(`${label} must be a non-empty relative path.`);
  const candidate = path.resolve(root, value);
  if (!isWithin(path.resolve(root), candidate)) throw new Error(`${label} escapes its cache root.`);
  return strictFile(candidate, root, label);
}

function collectUiCodeFiles(uiDirectory) {
  const root = strictDirectory(uiDirectory, uiDirectory, 'QWork UI directory');
  const files = [];
  const visit = (directory) => {
    const entries = fs.readdirSync(directory, { withFileTypes: true })
      .sort((left, right) => left.name.localeCompare(right.name, 'en'));
    for (const entry of entries) {
      const candidate = path.join(directory, entry.name);
      const stat = fs.lstatSync(candidate);
      if (stat.isSymbolicLink()) throw new Error(`QWork UI code manifest rejects symlinks: ${candidate}`);
      if (stat.isDirectory()) {
        visit(candidate);
        continue;
      }
      if (!stat.isFile()) throw new Error(`QWork UI code manifest rejects non-files: ${candidate}`);
      const relative = path.relative(root, candidate).split(path.sep).join('/');
      if (relative !== 'index.html' && !/\.(?:js|css)$/i.test(relative)) continue;
      files.push({
        path: relative,
        bytes: stat.size,
        sha256: shaFile(candidate, 'sha256'),
      });
    }
  };
  visit(root);
  if (!files.some((item) => item.path === 'index.html')) {
    throw new Error('QWork UI code manifest is missing index.html.');
  }
  if (!files.some((item) => /\.js$/i.test(item.path))) {
    throw new Error('QWork UI code manifest contains no JavaScript assets.');
  }
  const manifest = {
    schema_version: QWORK_UI_CODE_MANIFEST_SCHEMA,
    files,
  };
  const canonical = JSON.stringify(manifest);
  return {
    ...manifest,
    algorithm: 'sha256(canonical-json:path,bytes,sha256;sorted)',
    sha256: createHash('sha256').update(canonical).digest('hex'),
  };
}

function releasePaths(qworkUiUrl) {
  const parsed = new URL(text(qworkUiUrl));
  if (parsed.protocol !== 'file:' || parsed.username || parsed.password || parsed.search || parsed.hash) {
    throw new Error('QWork release identity requires a credential-free versioned file URL.');
  }
  const indexFile = path.resolve(fileURLToPath(parsed));
  if (path.basename(indexFile) !== 'index.html') throw new Error('QWork UI URL must end in index.html.');
  const uiDirectory = path.dirname(indexFile);
  const version = path.basename(uiDirectory);
  const uiRoot = path.dirname(uiDirectory);
  if (path.basename(uiRoot) !== 'ui' || !version) {
    throw new Error('QWork UI URL is not rooted at <release-home>/ui/<version>/index.html.');
  }
  const releaseHome = strictDirectory(path.dirname(uiRoot), path.dirname(uiRoot), 'QWork release home');
  const realUiDirectory = strictDirectory(uiDirectory, releaseHome, 'QWork versioned UI directory');
  // Preserve the URL's lexical root while strictFile independently verifies its realpath root.
  // macOS canonicalizes /var to /private/var, so mixing those forms before this check rejects
  // a legitimate non-symlink file even though both containment checks are valid.
  const realIndex = strictFile(indexFile, uiDirectory, 'QWork UI index');
  return {
    version,
    releaseHome,
    uiDirectory: realUiDirectory,
    indexFile: realIndex.file,
    stateFile: path.join(releaseHome, 'qwork-host-core-state', 'state.json'),
    hostCoreCache: path.join(releaseHome, 'qwork-host-core-cache'),
    hostCoreDirectory: path.join(releaseHome, 'qwork-host-core', version),
    qbotCoreDirectory: path.join(releaseHome, 'runtimes', 'qbot-core', version),
  };
}

function exactActiveIdentity(left, right) {
  const fields = ['kind', 'releaseId', 'releaseSetDigest', 'hostCoreDigest', 'archiveFile', 'envelopeFile'];
  return fields.every((field) => text(left?.[field]) === text(right?.[field]));
}

function assertEqual(errors, id, actual, expected) {
  if (text(actual) !== text(expected)) {
    errors.push({ id, actual: actual ?? null, expected: expected ?? null });
  }
}

function runtimeCrossChecks(errors, runtime, release, hostCoreDigest) {
  if (!runtime) return { supplied: false, ok: true, bootstrap: null };
  if (runtime.ok !== true || runtime.value_type !== 'object') {
    errors.push({ id: 'runtime_release_status_unreadable', actual: runtime?.value_type || '', expected: 'object' });
    return { supplied: true, ok: false, bootstrap: runtime?.host_runtime_compatibility?.bootstrap ?? null };
  }
  assertEqual(errors, 'runtime_release_id', runtime.release_id, release.id);
  assertEqual(errors, 'runtime_version', runtime.version, release.version);
  assertEqual(errors, 'runtime_commit_id', runtime.commit_id, release.commitId);
  assertEqual(errors, 'runtime_loaded_release_id', runtime.loaded_runtime?.release_id, release.id);
  assertEqual(errors, 'runtime_loaded_version', runtime.loaded_runtime?.version, release.version);
  if (runtime.loaded_runtime?.verified !== true) {
    errors.push({ id: 'runtime_loaded_not_verified', actual: runtime.loaded_runtime?.verified, expected: true });
  }
  assertEqual(errors, 'runtime_update_phase', runtime.update_phase, 'idle');
  if (runtime.prepared_release_present !== true || runtime.prepared_release !== null) {
    errors.push({
      id: 'runtime_prepared_release',
      actual: runtime.prepared_release ?? null,
      expected: null,
    });
  }
  assertEqual(errors, 'runtime_host_core_integrity', runtime.host_core?.integrity, hostCoreDigest);
  assertEqual(
    errors,
    'runtime_compatibility_host_core_digest',
    runtime.host_runtime_compatibility?.host_core_digest,
    hostCoreDigest,
  );
  assertEqual(errors, 'runtime_compatibility_release_id', runtime.host_runtime_compatibility?.runtime_release_id, release.id);
  assertEqual(errors, 'runtime_compatibility_version', runtime.host_runtime_compatibility?.runtime_version, release.version);
  return {
    supplied: true,
    ok: !errors.some((item) => item.id.startsWith('runtime_')),
    bootstrap: runtime.host_runtime_compatibility?.bootstrap ?? null,
  };
}

export function readQworkReleaseIdentity({ qworkUiUrl, runtimeReleaseStatus = null } = {}) {
  const checkedAt = new Date().toISOString();
  try {
    const paths = releasePaths(qworkUiUrl);
    const stateRoot = path.dirname(paths.stateFile);
    const stateArtifact = readJsonFile(paths.stateFile, stateRoot, 'QWork OTA state');
    const state = stateArtifact.value;
    const errors = [];
    if (state.schemaVersion !== 1) errors.push({ id: 'state_schema_version', actual: state.schemaVersion, expected: 1 });
    if (!state.active || typeof state.active !== 'object' || Array.isArray(state.active)) {
      throw new Error('QWork OTA state has no active release object.');
    }
    if (!state.lastGood || typeof state.lastGood !== 'object' || Array.isArray(state.lastGood)) {
      throw new Error('QWork OTA state has no lastGood release object.');
    }
    if (state.pending !== null) errors.push({ id: 'state_pending_release', actual: state.pending, expected: null });
    if (!exactActiveIdentity(state.active, state.lastGood)) {
      errors.push({ id: 'state_active_last_good_mismatch', actual: state.active, expected: state.lastGood });
    }
    assertEqual(errors, 'state_active_release_id', state.active.releaseId, paths.version);

    const cacheRoot = strictDirectory(paths.hostCoreCache, paths.releaseHome, 'QWork host-core cache');
    const envelopeArtifact = readJsonFile(
      path.resolve(cacheRoot, text(state.active.envelopeFile)),
      cacheRoot,
      'QWork OTA active envelope',
    );
    if (!isWithin(cacheRoot, envelopeArtifact.file)) throw new Error('QWork OTA envelope escapes its cache root.');
    const archiveArtifact = safeRelativeFile(cacheRoot, state.active.archiveFile, 'QWork host-core archive');
    const archiveIntegrity = `sha512-${shaFile(archiveArtifact.file, 'sha512', 'base64')}`;
    assertEqual(errors, 'host_core_archive_integrity', archiveIntegrity, state.active.hostCoreDigest);

    const envelope = envelopeArtifact.value;
    const releaseCollection = envelope?.catalog?.releases;
    const releases = Array.isArray(releaseCollection)
      ? releaseCollection
      : releaseCollection != null && typeof releaseCollection === 'object'
        ? Object.entries(releaseCollection).map(([id, item]) => ({ id, ...item }))
        : [];
    const matchingReleases = releases.filter((item) => text(item?.id) === paths.version);
    if (matchingReleases.length !== 1) {
      throw new Error(`QWork OTA envelope must contain exactly one ${paths.version} release; found ${matchingReleases.length}.`);
    }
    const release = matchingReleases[0];
    const hostCoreDigest = text(release?.components?.hostCore?.archive?.integrity);
    const uiDigest = text(release?.components?.ui?.digest);
    const qbotCoreDigest = text(release?.components?.qbotCore?.digest);
    assertEqual(errors, 'envelope_assignment_release_id', envelope?.assignment?.releaseId, paths.version);
    assertEqual(errors, 'envelope_release_version', release.version, paths.version);
    assertEqual(errors, 'state_release_set_digest', state.active.releaseSetDigest, release.releaseSetDigest);
    assertEqual(errors, 'state_host_core_digest', state.active.hostCoreDigest, hostCoreDigest);
    assertEqual(errors, 'envelope_host_core_version', release?.components?.hostCore?.version, paths.version);
    assertEqual(errors, 'envelope_ui_version', release?.components?.ui?.version, paths.version);
    assertEqual(errors, 'envelope_qbot_core_version', release?.components?.qbotCore?.version, paths.version);
    assertEqual(errors, 'envelope_ui_archive_digest', release?.assets?.ui?.archive?.integrity, uiDigest);
    assertEqual(errors, 'envelope_qbot_core_archive_digest', release?.assets?.['qbot-core']?.archive?.integrity, qbotCoreDigest);
    if (!/^[a-f0-9]{7,40}$/i.test(text(release.commitId))) {
      errors.push({ id: 'envelope_commit_id_invalid', actual: release.commitId || '', expected: '7-40 hex characters' });
    }
    if (!/^[a-f0-9]{64}$/i.test(text(release.releaseSetDigest))) {
      errors.push({ id: 'envelope_release_set_digest_invalid', actual: release.releaseSetDigest || '', expected: 'sha256 hex' });
    }
    for (const [id, digest] of [
      ['host_core_digest_invalid', hostCoreDigest],
      ['ui_digest_invalid', uiDigest],
      ['qbot_core_digest_invalid', qbotCoreDigest],
    ]) {
      if (!validSha512Integrity(digest)) {
        errors.push({ id, actual: digest, expected: 'sha512-<base64>' });
      }
    }

    strictDirectory(paths.hostCoreDirectory, paths.releaseHome, 'Installed QWork host-core directory');
    const uiInstalled = readJsonFile(
      path.join(paths.uiDirectory, '.installed.json'),
      paths.uiDirectory,
      'Installed QWork UI marker',
    );
    const qbotCoreDirectory = strictDirectory(
      paths.qbotCoreDirectory,
      paths.releaseHome,
      'Installed QWork qbot-core directory',
    );
    const qbotInstalled = readJsonFile(
      path.join(qbotCoreDirectory, '.installed.json'),
      qbotCoreDirectory,
      'Installed QWork qbot-core marker',
    );
    const installedAssets = [
      ['ui', uiInstalled.value, release?.assets?.ui],
      ['qbot_core', qbotInstalled.value, release?.assets?.['qbot-core']],
    ];
    for (const [id, marker, asset] of installedAssets) {
      assertEqual(errors, `${id}_installed_status`, marker.status, 'ready');
      assertEqual(errors, `${id}_installed_version`, marker.version, paths.version);
      if (asset == null || typeof asset !== 'object' || Array.isArray(asset)) {
        errors.push({ id: `${id}_asset_descriptor_missing`, actual: asset ?? null, expected: 'object' });
      }
      if (!validSha512Integrity(marker.integrity)) {
        errors.push({ id: `${id}_installed_integrity_invalid`, actual: marker.integrity || '', expected: 'sha512-<base64>' });
      } else if (asset && typeof asset === 'object' && !Array.isArray(asset)) {
        assertEqual(
          errors,
          `${id}_installed_descriptor_fingerprint`,
          marker.integrity,
          sha512Integrity(Buffer.from(JSON.stringify(asset))),
        );
      }
    }
    if (!/^[a-f0-9]{64}$/i.test(text(state.fingerprint))) {
      errors.push({ id: 'state_fingerprint_invalid', actual: state.fingerprint || '', expected: 'sha256 hex' });
    }

    const runtimeArtifact = strictFile(
      path.join(qbotCoreDirectory, 'runtime', 'desktop-agent-runtime.cjs'),
      qbotCoreDirectory,
      'Installed desktop Agent runtime',
    );
    const runtimeSha256 = shaFile(runtimeArtifact.file, 'sha256');
    const uiCodeManifest = collectUiCodeFiles(paths.uiDirectory);
    const runtimeCross = runtimeCrossChecks(errors, runtimeReleaseStatus, release, hostCoreDigest);
    const observed = {
      qwork_version: paths.version,
      prompt_policy_version: `qwork-runtime-${paths.version}-sha256-${runtimeSha256}`,
      feature_flags_hash: uiCodeManifest.sha256,
      qwork_ui_git_commit: text(release.commitId),
      qwork_build_id: text(release.id || release.version),
      qwork_release_manifest_sha256: envelopeArtifact.sha256,
    };
    return {
      schema_version: QWORK_RELEASE_IDENTITY_READBACK_SCHEMA,
      checked_at: checkedAt,
      ok: errors.length === 0,
      observed,
      observed_sha256: createHash('sha256').update(JSON.stringify(observed)).digest('hex'),
      consistency: {
        ok: errors.length === 0,
        errors,
        runtime: runtimeCross,
        ota_state_active_equals_last_good: exactActiveIdentity(state.active, state.lastGood),
        ota_pending_is_null: state.pending === null,
      },
      provenance: {
        qwork_ui_url: text(qworkUiUrl),
        release_home: paths.releaseHome,
        state: { path: stateArtifact.file, sha256: stateArtifact.sha256 },
        envelope: { path: envelopeArtifact.file, sha256: envelopeArtifact.sha256 },
        host_core_archive: {
          path: archiveArtifact.file,
          bytes: archiveArtifact.bytes,
          integrity: archiveIntegrity,
          declared_integrity: hostCoreDigest,
        },
        installed_ui: {
          directory: paths.uiDirectory,
          marker_path: uiInstalled.file,
          marker_sha256: uiInstalled.sha256,
          integrity: text(uiInstalled.value.integrity),
          declared_archive_integrity: uiDigest,
        },
        installed_qbot_core: {
          directory: qbotCoreDirectory,
          marker_path: qbotInstalled.file,
          marker_sha256: qbotInstalled.sha256,
          integrity: text(qbotInstalled.value.integrity),
          declared_archive_integrity: qbotCoreDigest,
        },
        desktop_agent_runtime: {
          path: runtimeArtifact.file,
          bytes: runtimeArtifact.bytes,
          sha256: runtimeSha256,
        },
        ui_code_manifest: uiCodeManifest,
        release_set_digest: text(release.releaseSetDigest),
        host_core_digest: hostCoreDigest,
        ui_digest: uiDigest,
        qbot_core_digest: qbotCoreDigest,
        state_fingerprint: text(state.fingerprint),
      },
    };
  } catch (error) {
    return {
      schema_version: QWORK_RELEASE_IDENTITY_READBACK_SCHEMA,
      checked_at: checkedAt,
      ok: false,
      observed: {},
      observed_sha256: '',
      consistency: {
        ok: false,
        errors: [{ id: 'identity_readback_error', error: text(error?.message || error) }],
        runtime: { supplied: Boolean(runtimeReleaseStatus), ok: false, bootstrap: null },
      },
      provenance: {},
      error: text(error?.message || error),
    };
  }
}

export function assessQworkReleaseIdentity(readback, expected = {}) {
  const mismatches = [];
  for (const field of OBSERVED_QWORK_IDENTITY_FIELDS) {
    const actual = text(readback?.observed?.[field]);
    const wanted = text(expected?.[field]);
    if (!actual || actual !== wanted) mismatches.push({ field, actual, expected: wanted });
  }
  return {
    ok: readback?.ok === true && mismatches.length === 0,
    readback_ok: readback?.ok === true,
    mismatches,
    observed: readback?.observed || {},
    expected: Object.fromEntries(OBSERVED_QWORK_IDENTITY_FIELDS.map((field) => [field, text(expected?.[field])])),
  };
}

export function assertStableQworkReleaseIdentity(baseline, current, label = 'QWork release identity') {
  const left = JSON.stringify({
    observed: baseline?.observed || {},
    provenance: baseline?.provenance || {},
  });
  const right = JSON.stringify({
    observed: current?.observed || {},
    provenance: current?.provenance || {},
  });
  if (baseline?.ok !== true || current?.ok !== true || left !== right) {
    throw new Error(`${label} drift detected between authoritative readbacks.`);
  }
  return true;
}
