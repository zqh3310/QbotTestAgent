import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {
  applyQworkStageAudit,
  createQworkReleaseTestState,
  qworkReleaseIdentityFingerprint,
  QWORK_FULL_REGRESSION_CASE_IDS,
  QWORK_GRAY_GATE_CASE_IDS,
  validateQworkReleaseControlState,
} from './qwork-release-test-plan.mjs';
import { readAndAuditQworkSoakReport } from './qwork-soak-report.mjs';

const RUN_SCHEMA = 'qbot-core-gray-run/v2';
const GATE_SCHEMA = 'qbot-core-gray-gate/v2';
const EVENT_SCHEMA = 'qbot-qwork-release-test-event/v2';
const EVENT_FILENAME_PATTERN = /^(\d{4})-(G[1-5])-(readiness|completion)\.json$/;
const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const DIRECTORY_ENTRY_SHA256 = sha256Bytes(Buffer.from('directory'));
const CONTROL_ENTRY_NAMES = Object.freeze([
  'events',
  'release-test-integrity.json',
  'release-test-plan.json',
  'release-test-state.json',
]);
const RUN_KEYS = Object.freeze([
  'completion_event',
  'control_dir',
  'release_plan',
  'run_id',
  'schema_version',
  'soak_report',
  'stage_id',
]);
const BINDING_KEYS = Object.freeze(['path', 'sha256']);
const EVENT_KEYS = Object.freeze([
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
]);

class GrayGateValidationError extends Error {
  constructor(code) {
    super(code);
    this.name = 'GrayGateValidationError';
    this.code = code;
  }
}

function fail(code) {
  throw new GrayGateValidationError(code);
}

function requireCondition(condition, code) {
  if (!condition) fail(code);
}

function nonEmpty(value) {
  return String(value ?? '').trim();
}

function exactKeys(value, keys) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
    && JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...keys].sort());
}

function sha256Bytes(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function sameValue(left, right) {
  return qworkReleaseIdentityFingerprint(left) === qworkReleaseIdentityFingerprint(right);
}

function canonicalAbsolutePath(value, code) {
  const source = nonEmpty(value);
  requireCondition(source && path.isAbsolute(source), code);
  const normalized = path.normalize(source);
  requireCondition(normalized === source, `${code}_not_canonical`);
  return normalized;
}

function assertNoSymlinkPath(target, expectedType, code) {
  const resolved = canonicalAbsolutePath(target, code);
  const parsed = path.parse(resolved);
  let current = parsed.root;
  const relative = path.relative(parsed.root, resolved);
  for (const part of relative.split(path.sep).filter(Boolean)) {
    current = path.join(current, part);
    let stat;
    try {
      stat = fs.lstatSync(current);
    } catch {
      fail(`${code}_missing`);
    }
    requireCondition(!stat.isSymbolicLink(), `${code}_symlink`);
  }
  const stat = fs.lstatSync(resolved);
  if (expectedType === 'file') requireCondition(stat.isFile(), `${code}_not_file`);
  if (expectedType === 'directory') requireCondition(stat.isDirectory(), `${code}_not_directory`);
  requireCondition(fs.realpathSync(resolved) === resolved, `${code}_realpath_mismatch`);
  return { path: resolved, stat };
}

function stableFileSnapshot(file, code) {
  const inspection = assertNoSymlinkPath(file, 'file', code);
  const before = fs.lstatSync(inspection.path, { bigint: true });
  const bytes = fs.readFileSync(inspection.path);
  const after = fs.lstatSync(inspection.path, { bigint: true });
  const metadata = (stat) => [stat.dev, stat.ino, stat.size, stat.mtimeNs, stat.ctimeNs]
    .map((value) => String(value)).join(':');
  requireCondition(metadata(before) === metadata(after), `${code}_changed_during_read`);
  return {
    path: inspection.path,
    bytes,
    sha256: sha256Bytes(bytes),
    stat: after,
  };
}

function jsonSnapshot(file, code) {
  const snapshot = stableFileSnapshot(file, code);
  try {
    return { ...snapshot, value: JSON.parse(snapshot.bytes.toString('utf8')) };
  } catch {
    fail(`${code}_invalid_json`);
  }
}

function validTimestamp(value) {
  return nonEmpty(value) && Number.isFinite(Date.parse(nonEmpty(value)));
}

function resolveBinding(binding, expectedPath, code) {
  requireCondition(exactKeys(binding, BINDING_KEYS), `${code}_fields_mismatch`);
  const bindingPath = canonicalAbsolutePath(binding.path, `${code}_path_invalid`);
  requireCondition(bindingPath === expectedPath, `${code}_path_mismatch`);
  const declaredSha = nonEmpty(binding.sha256).toLowerCase();
  requireCondition(SHA256_PATTERN.test(declaredSha), `${code}_sha256_invalid`);
  const snapshot = stableFileSnapshot(bindingPath, code);
  requireCondition(snapshot.sha256 === declaredSha, `${code}_sha256_mismatch`);
  return snapshot;
}

function directoryGuard(directory, code) {
  const inspection = assertNoSymlinkPath(directory, 'directory', code);
  const stat = fs.lstatSync(inspection.path, { bigint: true });
  return {
    path: inspection.path,
    names: fs.readdirSync(inspection.path).sort(),
    inode: `${stat.dev}:${stat.ino}`,
    metadata: [stat.dev, stat.ino, stat.size, stat.mtimeNs, stat.ctimeNs]
      .map((value) => String(value)).join(':'),
  };
}

function assertDirectoryGuard(guard, code) {
  const current = directoryGuard(guard.path, code);
  requireCondition(current.metadata === guard.metadata, `${code}_changed_during_read`);
  requireCondition(JSON.stringify(current.names) === JSON.stringify(guard.names), `${code}_entries_changed`);
}

function directoryMetadata(stat) {
  return [stat.dev, stat.ino, stat.size, stat.mtimeNs, stat.ctimeNs]
    .map((value) => String(value)).join(':');
}

function snapshotDirectoryTree(root, code = 'evidence_tree') {
  const directory = assertNoSymlinkPath(root, 'directory', code).path;
  const entries = [{
    path: '.',
    type: 'directory',
    bytes: 0,
    sha256: DIRECTORY_ENTRY_SHA256,
  }];
  const inodes = [];
  const walk = (current, relativeRoot = '') => {
    const before = fs.lstatSync(current, { bigint: true });
    requireCondition(before.isDirectory() && !before.isSymbolicLink(), `${code}_contains_non_directory`);
    inodes.push(`${before.dev}:${before.ino}`);
    const names = fs.readdirSync(current).sort();
    for (const name of names) {
      const absolute = path.join(current, name);
      const relative = path.join(relativeRoot, name).split(path.sep).join('/');
      const stat = fs.lstatSync(absolute, { bigint: true });
      requireCondition(!stat.isSymbolicLink(), `${code}_contains_symlink`);
      if (stat.isDirectory()) {
        entries.push({ path: relative, type: 'directory', bytes: 0, sha256: DIRECTORY_ENTRY_SHA256 });
        walk(absolute, relative);
      } else if (stat.isFile()) {
        inodes.push(`${stat.dev}:${stat.ino}`);
        const snapshot = stableFileSnapshot(absolute, `${code}_file`);
        entries.push({
          path: relative,
          type: 'file',
          bytes: snapshot.bytes.length,
          sha256: snapshot.sha256,
        });
      } else {
        fail(`${code}_contains_special_file`);
      }
    }
    const afterNames = fs.readdirSync(current).sort();
    const after = fs.lstatSync(current, { bigint: true });
    requireCondition(after.isDirectory() && !after.isSymbolicLink()
      && directoryMetadata(after) === directoryMetadata(before)
      && JSON.stringify(afterNames) === JSON.stringify(names), `${code}_changed_during_read`);
  };
  walk(directory);
  return {
    path: directory,
    entries,
    inodes,
    sha256: sha256Bytes(Buffer.from(JSON.stringify(entries))),
  };
}

function verifyEventExternalArtifacts(event, name) {
  const artifacts = event?.audit?.external_artifacts;
  requireCondition(Array.isArray(artifacts), `event_external_artifacts_missing:${name}`);
  const paths = [];
  for (const [index, artifact] of artifacts.entries()) {
    const code = `event_external_artifact_${index + 1}:${name}`;
    requireCondition(exactKeys(artifact, ['path', 'role', 'sha256', 'type']), `${code}:fields_mismatch`);
    requireCondition(['file', 'directory-tree'].includes(artifact.type), `${code}:type_invalid`);
    const artifactPath = canonicalAbsolutePath(artifact.path, `${code}:path_invalid`);
    const declaredSha256 = nonEmpty(artifact.sha256).toLowerCase();
    requireCondition(SHA256_PATTERN.test(declaredSha256), `${code}:sha256_invalid`);
    if (artifact.type === 'file') {
      requireCondition(stableFileSnapshot(artifactPath, code).sha256 === declaredSha256,
        `${code}:sha256_mismatch`);
    } else {
      requireCondition(snapshotDirectoryTree(artifactPath, code).sha256 === declaredSha256,
        `${code}:directory_sha256_mismatch`);
    }
    paths.push(artifactPath);
  }
  requireCondition(new Set(paths).size === paths.length, `event_external_artifact_paths_reused:${name}`);
}

function eventFailureCode(error) {
  const code = nonEmpty(error?.code || error?.message || error);
  return code ? `control_tree_invalid:${code}` : 'control_tree_invalid';
}

function emptyRunAudit(run, failures = []) {
  return {
    schema_version: 'qbot-core-gray-run-audit/v2',
    run_id: nonEmpty(run?.run_id),
    stage_id: nonEmpty(run?.stage_id),
    scope: '',
    passed: false,
    failures: [...new Set(failures)],
    observed: {},
    bindings: {},
    provenance: {},
    soak: null,
  };
}

function replayControlTree(controlDir) {
  const rootGuard = directoryGuard(controlDir, 'control_dir');
  requireCondition(
    JSON.stringify(rootGuard.names) === JSON.stringify(CONTROL_ENTRY_NAMES),
    'control_dir_layout_mismatch',
  );
  const eventsDir = path.join(controlDir, 'events');
  const eventsGuard = directoryGuard(eventsDir, 'events_dir');
  const eventNames = [...eventsGuard.names];
  requireCondition(eventNames.length > 0, 'event_chain_empty');
  requireCondition(eventNames.every((name) => EVENT_FILENAME_PATTERN.test(name)), 'event_filename_invalid');

  const planSnapshot = jsonSnapshot(path.join(controlDir, 'release-test-plan.json'), 'release_plan');
  const stateSnapshot = jsonSnapshot(path.join(controlDir, 'release-test-state.json'), 'release_state');
  const integritySnapshot = jsonSnapshot(path.join(controlDir, 'release-test-integrity.json'), 'release_integrity');
  const plan = planSnapshot.value;
  const state = stateSnapshot.value;
  const integrity = integritySnapshot.value;
  const controlAudit = validateQworkReleaseControlState({ plan, state, integrity });
  requireCondition(controlAudit.ok, `control_state_invalid:${controlAudit.failures.join(',')}`);

  let previousEventSha256 = '';
  let previousState = createQworkReleaseTestState(plan);
  let previousStateSha256 = qworkReleaseIdentityFingerprint(previousState);
  let previousRevision = 0;
  requireCondition(integrity.initial_state_sha256 === previousStateSha256, 'initial_state_anchor_mismatch');
  const events = [];

  eventNames.forEach((name, index) => {
    const eventPath = path.join(eventsDir, name);
    const snapshot = jsonSnapshot(eventPath, `event_${index + 1}`);
    const event = snapshot.value;
    const expectedIndex = index + 1;
    const filename = name.match(EVENT_FILENAME_PATTERN);
    requireCondition(exactKeys(event, EVENT_KEYS), `event_fields_mismatch:${name}`);
    requireCondition(event.schema_version === EVENT_SCHEMA, `event_schema_mismatch:${name}`);
    requireCondition(validTimestamp(event.recorded_at), `event_time_invalid:${name}`);
    requireCondition(event.index === expectedIndex, `event_index_mismatch:${name}`);
    requireCondition(Number(filename?.[1]) === expectedIndex
      && filename?.[2] === event.stage_id
      && filename?.[3] === event.phase, `event_filename_binding_mismatch:${name}`);
    requireCondition(event.plan_sha256 === controlAudit.plan_sha256, `event_plan_sha256_mismatch:${name}`);
    requireCondition(event.state_revision_before === previousRevision
      && event.state_revision_after === previousRevision + 1, `event_revision_mismatch:${name}`);
    requireCondition(event.state_sha256_before === previousStateSha256, `event_state_chain_mismatch:${name}`);
    requireCondition(SHA256_PATTERN.test(nonEmpty(event.state_sha256_before).toLowerCase())
      && SHA256_PATTERN.test(nonEmpty(event.state_sha256_after).toLowerCase()), `event_state_sha256_invalid:${name}`);
    requireCondition(event.audit?.stage_id === event.stage_id, `event_stage_mismatch:${name}`);
    requireCondition(['readiness', 'completion'].includes(event.phase), `event_phase_mismatch:${name}`);
    requireCondition(nonEmpty(event.previous_event_sha256) === previousEventSha256, `event_hash_chain_mismatch:${name}`);
    requireCondition(qworkReleaseIdentityFingerprint(event.state_before) === event.state_sha256_before,
      `event_state_before_snapshot_mismatch:${name}`);
    requireCondition(qworkReleaseIdentityFingerprint(event.state_after) === event.state_sha256_after,
      `event_state_after_snapshot_mismatch:${name}`);
    requireCondition(sameValue(event.state_before, previousState), `event_state_before_mismatch:${name}`);
    verifyEventExternalArtifacts(event, name);

    let replayed;
    try {
      replayed = applyQworkStageAudit(previousState, event.audit, {
        plan,
        phase: event.phase,
        updatedAt: event.recorded_at,
        externalArtifacts: event.audit?.external_artifacts,
      });
    } catch (error) {
      fail(`event_semantic_replay_failed:${name}:${nonEmpty(error?.message || error)}`);
    }
    requireCondition(qworkReleaseIdentityFingerprint(replayed) === event.state_sha256_after
      && sameValue(replayed, event.state_after), `event_semantic_replay_mismatch:${name}`);

    events.push({
      name,
      path: eventPath,
      sha256: snapshot.sha256,
      inode: `${snapshot.stat.dev}:${snapshot.stat.ino}`,
      value: event,
    });
    previousEventSha256 = snapshot.sha256;
    previousState = event.state_after;
    previousStateSha256 = event.state_sha256_after;
    previousRevision = event.state_revision_after;
  });

  requireCondition(events.length === integrity.event_count, 'event_count_mismatch');
  requireCondition(events.length === state.revision, 'event_revision_count_mismatch');
  requireCondition(previousEventSha256 === nonEmpty(integrity.last_event_sha256), 'event_tail_sha256_mismatch');
  requireCondition(previousStateSha256 === integrity.state_sha256, 'event_terminal_state_sha256_mismatch');
  requireCondition(sameValue(previousState, state), 'event_terminal_state_mismatch');
  assertDirectoryGuard(eventsGuard, 'events_dir');
  assertDirectoryGuard(rootGuard, 'control_dir');
  return {
    root: controlDir,
    plan,
    state,
    integrity,
    planSnapshot,
    events,
  };
}

function auditSoakBinding(run, control, targetEvent, {
  minimumTasks,
  minimumRestarts,
} = {}) {
  if (run.soak_report == null) return null;
  requireCondition(run.stage_id === 'G4', 'soak_binding_requires_g4');
  requireCondition(exactKeys(run.soak_report, BINDING_KEYS), 'soak_report_fields_mismatch');
  const reportPath = canonicalAbsolutePath(run.soak_report.path, 'soak_report_path_invalid');
  const reportSha256 = nonEmpty(run.soak_report.sha256).toLowerCase();
  requireCondition(SHA256_PATTERN.test(reportSha256), 'soak_report_sha256_invalid');
  const g5Events = control.events.filter((item) => (
    item.value.stage_id === 'G5' && item.value.phase === 'completion'
  ));
  requireCondition(g5Events.length === 1, 'soak_g5_completion_event_count_mismatch');
  const g5Event = g5Events[0];
  requireCondition(g5Event.value.index > targetEvent.value.index, 'soak_g5_event_not_after_g4');
  requireCondition(g5Event.value.audit?.passed === true
    && g5Event.value.audit?.decision === 'PASS_STAGE'
    && g5Event.value.state_after?.stages?.G5?.status === 'PASSED', 'soak_g5_stage_not_passed');
  const reportArtifact = (g5Event.value.audit?.external_artifacts || [])
    .find((artifact) => artifact?.role === 'G5.soak.report');
  requireCondition(reportArtifact?.type === 'file', 'soak_g5_report_artifact_missing');
  requireCondition(nonEmpty(reportArtifact.path) === reportPath, 'soak_report_control_path_mismatch');
  requireCondition(nonEmpty(reportArtifact.sha256).toLowerCase() === reportSha256,
    'soak_report_control_sha256_mismatch');
  const soakAudit = readAndAuditQworkSoakReport({
    reportPath,
    reportSha256,
    expectedReleaseIdentitySha256: control.plan.release_identity_sha256,
    expectedReleaseIdentity: control.plan.release_identity,
    expectedFrameworkCommit: control.plan.framework.commit,
    policy: {
      minimum_tasks: minimumTasks,
      minimum_restarts: minimumRestarts,
      maximum_rss_peak_bytes: 2 * 1024 * 1024 * 1024,
      maximum_rss_growth_bytes: 100 * 1024 * 1024,
      maximum_rss_slope_bytes_per_minute: 128 * 1024 * 1024,
      maximum_resource_sample_gap_ms: 60_000,
      minimum_samples_per_process: 2,
    },
  });
  requireCondition(soakAudit.passed === true, `soak_report_audit_failed:${soakAudit.failures.join(',')}`);
  return {
    ...soakAudit,
    path: reportPath,
    sha256: reportSha256,
    event_path: g5Event.path,
    event_sha256: g5Event.sha256,
  };
}

export function auditCoreBetaRun(run, {
  expectedCases = 70,
  fullRegressionCases = 160,
  minimumSoakTasks = 100,
  minimumSoakRestarts = 3,
} = {}) {
  const audit = emptyRunAudit(run);
  try {
    requireCondition(expectedCases === 70 && fullRegressionCases === 160,
      'fixed_case_policy_must_be_70_and_160');
    requireCondition(Number.isSafeInteger(minimumSoakTasks) && minimumSoakTasks >= 100
      && Number.isSafeInteger(minimumSoakRestarts) && minimumSoakRestarts >= 3,
    'soak_policy_below_minimum');
    requireCondition(exactKeys(run, RUN_KEYS), 'run_fields_mismatch');
    requireCondition(run.schema_version === RUN_SCHEMA, 'run_schema_mismatch');
    requireCondition(['G3', 'G4'].includes(run.stage_id), 'run_stage_id_invalid');
    requireCondition(nonEmpty(run.run_id), 'run_id_missing');

    const controlDir = canonicalAbsolutePath(run.control_dir, 'control_dir_invalid');
    const control = replayControlTree(controlDir);
    const planPath = path.join(controlDir, 'release-test-plan.json');
    resolveBinding(run.release_plan, planPath, 'release_plan_binding');
    requireCondition(run.release_plan.sha256.toLowerCase() === control.planSnapshot.sha256,
      'release_plan_binding_sha256_mismatch');

    requireCondition(exactKeys(run.completion_event, BINDING_KEYS), 'completion_event_binding_fields_mismatch');
    const completionEventPath = canonicalAbsolutePath(
      run.completion_event.path,
      'completion_event_path_invalid',
    );
    const expectedEventName = path.basename(completionEventPath);
    const expectedEventMatch = expectedEventName.match(EVENT_FILENAME_PATTERN);
    requireCondition(expectedEventMatch
      && expectedEventMatch[2] === run.stage_id
      && expectedEventMatch[3] === 'completion'
      && path.dirname(completionEventPath) === path.join(controlDir, 'events'),
    'completion_event_binding_path_mismatch');
    const completionEventSha256 = nonEmpty(run.completion_event.sha256).toLowerCase();
    requireCondition(SHA256_PATTERN.test(completionEventSha256), 'completion_event_binding_sha256_invalid');
    const targetEvent = control.events.find((event) => event.path === completionEventPath);
    requireCondition(targetEvent, 'completion_event_not_in_control_chain');
    requireCondition(targetEvent.sha256 === completionEventSha256, 'completion_event_binding_sha256_mismatch');
    requireCondition(targetEvent.value.audit?.passed === true
      && targetEvent.value.audit?.decision === 'PASS_STAGE', 'completion_event_not_passed');
    requireCondition(targetEvent.value.state_after?.stages?.[run.stage_id]?.status === 'PASSED',
      'completion_event_stage_not_passed');
    requireCondition(control.state.stages?.[run.stage_id]?.status === 'PASSED'
      && sameValue(control.state.stages?.[run.stage_id]?.completion, targetEvent.value.audit),
    'terminal_state_completion_mismatch');

    const laterEvents = control.events.filter((event) => event.value.index > targetEvent.value.index);
    if (run.soak_report == null) {
      requireCondition(laterEvents.length === 0, 'completion_event_not_terminal');
    } else {
      requireCondition(laterEvents.length === 1
        && laterEvents[0].value.stage_id === 'G5'
        && laterEvents[0].value.phase === 'completion', 'completion_event_has_unexpected_later_events');
    }
    requireCondition(control.state.decision !== 'NO_GO', 'control_tree_terminal_no_go');

    const expectedCount = run.stage_id === 'G4' ? fullRegressionCases : expectedCases;
    const expectedIds = run.stage_id === 'G4'
      ? [...QWORK_FULL_REGRESSION_CASE_IDS]
      : [...QWORK_GRAY_GATE_CASE_IDS];
    const admission = targetEvent.value.state_before?.stages?.[run.stage_id]?.admission;
    const caseIds = Array.isArray(admission?.expected?.case_ids)
      ? admission.expected.case_ids.map(nonEmpty)
      : [];
    const caseContracts = Array.isArray(admission?.expected?.case_contracts)
      ? admission.expected.case_contracts
      : [];
    const caseContractsSha256 = nonEmpty(admission?.expected?.case_contracts_sha256).toLowerCase();
    requireCondition(caseIds.length === expectedCount
      && JSON.stringify(caseIds) === JSON.stringify(expectedIds), 'completion_case_ids_mismatch');
    requireCondition(caseContracts.length === expectedCount, 'completion_case_contract_count_mismatch');
    requireCondition(SHA256_PATTERN.test(caseContractsSha256)
      && qworkReleaseIdentityFingerprint(caseContracts) === caseContractsSha256,
    'completion_case_contract_sha256_mismatch');
    requireCondition(JSON.stringify(caseContracts.map((item) => nonEmpty(item?.case_id)))
      === JSON.stringify(expectedIds), 'completion_case_contract_ids_mismatch');
    requireCondition(nonEmpty(targetEvent.value.audit?.expected?.casebook_sha256)
      === control.plan.casebook.sha256, 'completion_casebook_sha256_mismatch');
    requireCondition(nonEmpty(targetEvent.value.audit?.expected?.framework_commit)
      === control.plan.framework.commit, 'completion_framework_commit_mismatch');
    requireCondition(nonEmpty(targetEvent.value.audit?.expected?.release_identity_sha256)
      === control.plan.release_identity_sha256, 'completion_release_identity_mismatch');

    const evidenceTree = (targetEvent.value.audit?.external_artifacts || [])
      .find((artifact) => artifact?.role === `${run.stage_id}.completion.evidence_tree`);
    const trustedReview = (targetEvent.value.audit?.external_artifacts || [])
      .find((artifact) => artifact?.role === `${run.stage_id}.completion.trusted_review`);
    requireCondition(evidenceTree?.type === 'directory-tree', 'completion_evidence_tree_missing');
    requireCondition(trustedReview?.type === 'file', 'completion_trusted_review_missing');
    const runDir = canonicalAbsolutePath(evidenceTree.path, 'completion_run_dir_invalid');
    assertNoSymlinkPath(runDir, 'directory', 'completion_run_dir');
    const trustedReviewPath = canonicalAbsolutePath(trustedReview.path, 'trusted_review_path_invalid');
    requireCondition(path.basename(runDir) === run.run_id, 'run_id_does_not_match_run_directory');
    const evidenceSnapshot = snapshotDirectoryTree(runDir);
    requireCondition(evidenceSnapshot.sha256 === nonEmpty(evidenceTree.sha256).toLowerCase(),
      'completion_evidence_tree_sha256_mismatch');
    const trustedReviewSnapshot = stableFileSnapshot(trustedReviewPath, 'trusted_review');
    requireCondition(trustedReviewSnapshot.sha256 === nonEmpty(trustedReview.sha256).toLowerCase(),
      'trusted_review_sha256_mismatch');
    const completionEvidence = control.events
      .filter((event) => event.value.phase === 'completion' && event.value.stage_id !== 'G5')
      .map((event) => {
        const stageId = event.value.stage_id;
        const artifacts = event.value.audit.external_artifacts;
        const tree = artifacts.find((artifact) => artifact.role === `${stageId}.completion.evidence_tree`);
        const review = artifacts.find((artifact) => artifact.role === `${stageId}.completion.trusted_review`);
        const treeSnapshot = snapshotDirectoryTree(tree.path, `${stageId}_completion_evidence_tree`);
        const reviewSnapshot = stableFileSnapshot(review.path, `${stageId}_completion_trusted_review`);
        requireCondition(treeSnapshot.sha256 === nonEmpty(tree.sha256).toLowerCase(),
          `${stageId}_completion_evidence_tree_sha256_mismatch`);
        requireCondition(reviewSnapshot.sha256 === nonEmpty(review.sha256).toLowerCase(),
          `${stageId}_completion_trusted_review_sha256_mismatch`);
        return {
          stage_id: stageId,
          run_dir: treeSnapshot.path,
          evidence_tree_sha256: treeSnapshot.sha256,
          evidence_inodes: treeSnapshot.inodes,
          trusted_review_path: reviewSnapshot.path,
          trusted_review_sha256: reviewSnapshot.sha256,
          trusted_review_inode: `${reviewSnapshot.stat.dev}:${reviewSnapshot.stat.ino}`,
        };
      });
    const soak = auditSoakBinding(run, control, targetEvent, {
      minimumTasks: minimumSoakTasks,
      minimumRestarts: minimumSoakRestarts,
    });

    return {
      schema_version: 'qbot-core-gray-run-audit/v2',
      run_id: run.run_id,
      stage_id: run.stage_id,
      scope: run.stage_id === 'G4' ? 'full_regression' : 'gray_gate',
      passed: true,
      failures: [],
      observed: {
        total: expectedCount,
        completed: targetEvent.value.audit?.observed?.completed,
        executed: targetEvent.value.audit?.observed?.executed,
        inherited: targetEvent.value.audit?.observed?.inherited,
        synthetic: targetEvent.value.audit?.observed?.synthetic,
        trusted_pass: targetEvent.value.audit?.observed?.trusted_pass,
        evidence_complete: targetEvent.value.audit?.observed?.evidence_complete,
        case_ids: caseIds,
        case_contracts: caseContracts,
        case_contracts_sha256: caseContractsSha256,
        completed_at: targetEvent.value.recorded_at,
        completion_audit_replayed: true,
      },
      bindings: {
        control_dir: controlDir,
        release_plan_path: planPath,
        release_plan_sha256: control.planSnapshot.sha256,
        completion_event_path: completionEventPath,
        completion_event_sha256: completionEventSha256,
        completion_event_inode: targetEvent.inode,
        run_dir: runDir,
        trusted_review_path: trustedReviewPath,
        trusted_review_sha256: nonEmpty(trustedReview.sha256).toLowerCase(),
        evidence_tree_sha256: nonEmpty(evidenceTree.sha256).toLowerCase(),
      },
      provenance: {
        release_identity_sha256: control.plan.release_identity_sha256,
        release_identity: control.plan.release_identity,
        framework_commit: control.plan.framework.commit,
        casebook_path: control.plan.casebook.path,
        casebook_sha256: control.plan.casebook.sha256,
        evidence_inodes: evidenceSnapshot.inodes,
        control_dir_inode: directoryGuard(controlDir, 'control_dir').inode,
        completion_evidence: completionEvidence,
      },
      soak,
    };
  } catch (error) {
    audit.failures.push(eventFailureCode(error));
    return audit;
  }
}

function baseGateResult({
  audits = [],
  failures = [],
  minimumSoakTasks = 100,
  minimumSoakRestarts = 3,
} = {}) {
  return {
    schema_version: GATE_SCHEMA,
    generated_at: new Date().toISOString(),
    expected_cases_per_run: 70,
    full_regression_cases: 160,
    required_consecutive_runs: 5,
    observed_run_count: audits.length,
    consecutive_passing_runs: 0,
    release_identity_stable: false,
    framework_commit_stable: false,
    casebook_stable: false,
    completion_times_strictly_increasing: false,
    provenance_unique: false,
    g3_equivalent_contract_stable: false,
    full_regression_required: true,
    full_regression_passed: false,
    full_regression_passing_candidate_run_indexes: [],
    soak_required: {
      minimum_tasks: minimumSoakTasks,
      minimum_restarts: minimumSoakRestarts,
      same_g4_control_tree: true,
    },
    soak_passed: false,
    soak_passing_candidate_run_index: -1,
    eligible_for_controlled_production_gray_internal_beta: false,
    decision: 'NO_GO',
    pipeline_decision: 'STOP_PIPELINE',
    scope: '受控生产灰度内测；不等同于正式GA',
    failures: [...new Set(failures)],
    runs: audits,
  };
}

function duplicateValues(values) {
  const seen = new Set();
  const duplicates = new Set();
  for (const value of values.filter(Boolean)) {
    if (seen.has(value)) duplicates.add(value);
    seen.add(value);
  }
  return duplicates;
}

export function evaluateCoreBetaGrayGate(runs, {
  expectedCases = 70,
  fullRegressionCases = 160,
  requiredConsecutiveRuns = 5,
  minimumSoakTasks = 100,
  minimumSoakRestarts = 3,
} = {}) {
  const policyFailures = [];
  if (requiredConsecutiveRuns !== 5) policyFailures.push('required_consecutive_runs_must_be_5');
  if (expectedCases !== 70 || fullRegressionCases !== 160) {
    policyFailures.push('fixed_case_policy_must_be_70_and_160');
  }
  if (!Number.isSafeInteger(minimumSoakTasks) || minimumSoakTasks < 100
    || !Number.isSafeInteger(minimumSoakRestarts) || minimumSoakRestarts < 3) {
    policyFailures.push('soak_policy_below_minimum');
  }
  if (!Array.isArray(runs)) policyFailures.push('runs_must_be_array');
  if (policyFailures.length) {
    return baseGateResult({
      failures: policyFailures,
      minimumSoakTasks,
      minimumSoakRestarts,
    });
  }

  const audits = runs.map((run) => auditCoreBetaRun(run, {
    expectedCases,
    fullRegressionCases,
    minimumSoakTasks,
    minimumSoakRestarts,
  }));
  const result = baseGateResult({ audits, minimumSoakTasks, minimumSoakRestarts });
  const failures = [];
  if (runs.length !== 5) failures.push(`run_count_expected_5_actual_${runs.length}`);
  audits.forEach((audit, index) => {
    if (!audit.passed) failures.push(`run_${index + 1}_invalid`);
  });

  const allPassed = runs.length === 5 && audits.every((audit) => audit.passed);
  let consecutivePassing = 0;
  for (let index = audits.length - 1; index >= 0; index -= 1) {
    if (!audits[index].passed) break;
    consecutivePassing += 1;
  }
  result.consecutive_passing_runs = consecutivePassing;

  if (allPassed) {
    const identities = audits.map((audit) => audit.provenance.release_identity_sha256);
    const frameworks = audits.map((audit) => audit.provenance.framework_commit);
    const casebooks = audits.map((audit) => (
      `${audit.provenance.casebook_path}\0${audit.provenance.casebook_sha256}`
    ));
    result.release_identity_stable = new Set(identities).size === 1;
    result.framework_commit_stable = new Set(frameworks).size === 1;
    result.casebook_stable = new Set(casebooks).size === 1;
    if (!result.release_identity_stable) failures.push('release_identity_not_stable_across_candidate_runs');
    if (!result.framework_commit_stable) failures.push('framework_commit_not_stable_across_candidate_runs');
    if (!result.casebook_stable) failures.push('casebook_not_stable_across_candidate_runs');

    const completionTimes = audits.map((audit) => Date.parse(audit.observed.completed_at));
    result.completion_times_strictly_increasing = completionTimes.every((value, index) => (
      Number.isFinite(value) && (index === 0 || value > completionTimes[index - 1])
    ));
    if (!result.completion_times_strictly_increasing) {
      failures.push('completion_times_not_strictly_increasing');
    }

    const uniquenessFields = [
      ['reused_run_id', audits.map((audit) => audit.run_id)],
      ['reused_control_dir', audits.map((audit) => audit.bindings.control_dir)],
      ['reused_control_dir_inode', audits.map((audit) => audit.provenance.control_dir_inode)],
      ['reused_completion_event', audits.map((audit) => audit.bindings.completion_event_path)],
      ['reused_completion_event_inode', audits.map((audit) => audit.bindings.completion_event_inode)],
      ['reused_completion_event_sha256', audits.map((audit) => audit.bindings.completion_event_sha256)],
      ['reused_run_dir', audits.flatMap((audit) => audit.provenance.completion_evidence.map((item) => item.run_dir))],
      ['reused_trusted_review', audits.flatMap((audit) => (
        audit.provenance.completion_evidence.map((item) => item.trusted_review_path)
      ))],
      ['reused_trusted_review_inode', audits.flatMap((audit) => (
        audit.provenance.completion_evidence.map((item) => item.trusted_review_inode)
      ))],
      ['reused_trusted_review_sha256', audits.flatMap((audit) => (
        audit.provenance.completion_evidence.map((item) => item.trusted_review_sha256)
      ))],
      ['reused_evidence_tree_sha256', audits.flatMap((audit) => (
        audit.provenance.completion_evidence.map((item) => item.evidence_tree_sha256)
      ))],
    ];
    result.provenance_unique = true;
    for (const [failureCode, values] of uniquenessFields) {
      if (duplicateValues(values).size) {
        failures.push(failureCode);
        result.provenance_unique = false;
      }
    }
    const inodeOwners = new Map();
    audits.forEach((audit, runIndex) => {
      const evidenceInodes = audit.provenance.completion_evidence
        .flatMap((item) => item.evidence_inodes || []);
      for (const inode of evidenceInodes) {
        if (inodeOwners.has(inode) && inodeOwners.get(inode) !== runIndex) {
          failures.push('reused_evidence_inode');
          result.provenance_unique = false;
        } else {
          inodeOwners.set(inode, runIndex);
        }
      }
    });

    const equivalentContractHashes = audits.map((audit) => {
      const contracts = audit.stage_id === 'G4'
        ? audit.observed.case_contracts.slice(0, 70)
        : audit.observed.case_contracts;
      return qworkReleaseIdentityFingerprint(contracts);
    });
    result.g3_equivalent_contract_stable = new Set(equivalentContractHashes).size === 1;
    if (!result.g3_equivalent_contract_stable) failures.push('g3_equivalent_case_contracts_not_stable');

    result.full_regression_passing_candidate_run_indexes = audits
      .map((audit, index) => audit.stage_id === 'G4' ? index : -1)
      .filter((index) => index >= 0);
    result.full_regression_passed = result.full_regression_passing_candidate_run_indexes.length > 0;
    if (!result.full_regression_passed) failures.push('required_full160_not_passed_in_candidate_runs');

    const soakIndexes = audits
      .map((audit, index) => audit.soak?.passed === true ? index : -1)
      .filter((index) => index >= 0);
    result.soak_passed = soakIndexes.length === 1
      && audits[soakIndexes[0]].stage_id === 'G4';
    result.soak_passing_candidate_run_index = result.soak_passed ? soakIndexes[0] : -1;
    if (soakIndexes.length !== 1) failures.push('exactly_one_g4_soak_required');
    else if (!result.soak_passed) failures.push('soak_must_bind_to_g4_control_tree');
  } else {
    failures.push(`insufficient_consecutive_green_expected_5_actual_${consecutivePassing}`);
  }

  const eligible = failures.length === 0
    && allPassed
    && result.release_identity_stable
    && result.framework_commit_stable
    && result.casebook_stable
    && result.completion_times_strictly_increasing
    && result.provenance_unique
    && result.g3_equivalent_contract_stable
    && result.full_regression_passed
    && result.soak_passed;
  result.failures = [...new Set(failures)];
  result.eligible_for_controlled_production_gray_internal_beta = eligible;
  result.decision = eligible ? 'GO_CONTROLLED_GRAY' : 'NO_GO';
  result.pipeline_decision = eligible ? 'CONTINUE_CONTROLLED_GRAY' : 'STOP_PIPELINE';
  return result;
}
