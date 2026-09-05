import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {
  QWORK_RELEASE_INTAKE_DEFAULT_REF,
  QWORK_RELEASE_INTAKE_SCHEMA,
  validateQworkReleaseIntake,
} from './qwork-release-intake.mjs';
import {
  validateEvidenceFile,
} from './core-beta-case-protocol.mjs';
import {
  QWORK_SOAK_DEFAULT_POLICY,
  QWORK_SOAK_REPORT_SCHEMA,
  readAndAuditQworkSoakReport,
} from './qwork-soak-report.mjs';

export const QWORK_RELEASE_TEST_PLAN_SCHEMA = 'qbot-qwork-release-test-plan/v2';
export const QWORK_RELEASE_TEST_STATE_SCHEMA = 'qbot-qwork-release-test-state/v2';
export const QWORK_RELEASE_TEST_INTEGRITY_SCHEMA = 'qbot-qwork-release-test-integrity/v2';
export const QWORK_RELEASE_REF_OBSERVATION_SCHEMA = 'qbot-qwork-release-ref-observation/v1';
export const QWORK_RELEASE_SOAK_REPORT_SCHEMA = QWORK_SOAK_REPORT_SCHEMA;
export const QWORK_RELEASE_IDENTITY_SCHEMA = 'qbot-qwork-release-identity/v1';
export const QWORK_RELEASE_CASEBOOK_BASENAME = 'QBot核心生命线与新增MR生产灰度全量回归Casebook_16-12-70-160条_2026-09-05-r14.xlsx';
export const QWORK_RELEASE_CASEBOOK_SHA256 = '439f14686df4a1623015e3964b61a6943455c804938be2680a8d6fedde9bf2ed';
export const QWORK_RELEASE_CASEBOOK_DESIGN_BASELINE_COMMIT = '0cfdfa1ec9f18d2ef2e78d380b4b2896c6dc607c';

const QWORK_RELEASE_IDENTITY_FIELDS = Object.freeze([
  'teams_version',
  'teams_build',
  'qwork_version',
  'control_plane_origin',
  'backend_version',
  'prompt_policy_version',
  'feature_flags_hash',
  'qwork_ui_git_commit',
  'qwork_build_id',
  'qwork_release_manifest_sha256',
]);

const QWORK_RELEASE_TEST_POLICY = Object.freeze({
  case_execution: 'single-runner-forced-serial',
  model_tier: 'M3',
  inherited: 0,
  synthetic: 0,
  admission_source: 'trusted-review-only',
  stop_on_non_pass: true,
  immutable_stage_outputs: true,
  release_intake_required: true,
  release_intake_source: QWORK_RELEASE_INTAKE_SCHEMA,
});

const QWORK_RELEASE_SOURCE_ARTIFACT_ROLES = Object.freeze([
  'casebook',
  'release_identity',
  'release_intake',
  'release_observation',
]);

export const QWORK_CORE_LIFELINE_CASE_IDS = Object.freeze([
  'BETA-INIT-001',
  'BETA-INIT-002',
  'BETA-INIT-003',
  'BETA-INIT-004',
  'BETA-CHAT-001',
  'BETA-CHAT-002',
  'BETA-CHAT-007',
  'BETA-FILE-001',
  'BETA-ART-001',
  'BETA-TASK-008',
  'BETA-HOST-003',
  'BETA-SEC-002',
  'BETA-ROUTE-001',
  'SIT-SKILL-007',
  'SIT-HOME-002',
  'SIT-CONN-016',
]);

export const QWORK_MR_SMOKE_CASE_IDS = Object.freeze([
  'MRSMOKE-ACT-001',
  'MRSMOKE-WEB-001',
  'MRSMOKE-WEB-002',
  'MRSMOKE-AUTH-001',
  'MRSMOKE-AUTO-001',
  'MRSMOKE-NAV-001',
  'MRSMOKE-ROUTE-001',
  'MRSMOKE-SKILL-001',
  'MRSMOKE-FAIL-001',
  'MRSMOKE-ART-001',
  'MRSMOKE-ENTRY-001',
  'MRSMOKE-CHART-001',
]);

export const QWORK_GRAY_GATE_CASE_IDS = Object.freeze(
  'BETA-INIT-001,BETA-INIT-002,BETA-INIT-003,BETA-INIT-004,BETA-CHAT-001,BETA-CHAT-002,BETA-CHAT-003,BETA-CHAT-004,BETA-CHAT-005,BETA-CHAT-006,BETA-CHAT-007,BETA-CHAT-008,BETA-CHAT-009,BETA-CHAT-010,BETA-FILE-001,BETA-FILE-002,BETA-FILE-003,BETA-FILE-004,BETA-FILE-005,BETA-FILE-006,BETA-ART-001,BETA-ART-002,BETA-ART-003,BETA-ART-004,BETA-SKILL-001,BETA-SKILL-002,BETA-SKILL-003,BETA-SKILL-004,BETA-SKILL-005,BETA-SKILL-006,BETA-SKILL-007,BETA-SKILL-008,BETA-SKILL-009,BETA-SKILL-010,BETA-SKILL-011,BETA-SKILL-012,BETA-SKILL-014,BETA-EXPERT-002,BETA-EXPERT-003,BETA-EXPERT-004,BETA-EXPERT-005,BETA-EXPERT-007,BETA-EXPERT-001,BETA-EXPERT-008,BETA-EXPERT-009,BETA-EXPERT-010,BETA-EXPERT-012,BETA-EXPERT-014,BETA-EXPERT-015,BETA-MCP-001,BETA-MCP-002,BETA-MCP-003,BETA-MCP-004,BETA-MCP-005,BETA-MCP-006,BETA-MCP-007,BETA-TASK-008,BETA-FILE-007,BETA-FILE-008,BETA-FILE-009,BETA-FILE-010,BETA-HOST-003,BETA-SEC-002,BETA-PERF-003,BETA-ROUTE-001,SIT-SKILL-007,SIT-HOME-002,SIT-HOME-012,SIT-HOME-013,SIT-CONN-016'.split(','),
);

export const QWORK_FULL_REGRESSION_CASE_IDS = Object.freeze([
  ...QWORK_GRAY_GATE_CASE_IDS,
  ...'SIT-CONN-003,SIT-INIT-002,SIT-AUTH-003,SIT-TEAMS-NEW-001,SIT-TEAMS-NEW-003,SIT-HOME-014,SIT-ISSUE-793,SIT-HOME-006,SIT-WORKSPACE-001,SIT-EXPERT-001,SIT-EXPERT-004,SIT-EXPERT-006,SIT-EXPERT-009,SIT-EXPERT-013,SIT-EXPERT-021,SIT-EXPERT-022,SIT-SKILL-001,SIT-SKILL-025,SIT-SKILL-003,SIT-SKILL-014,SIT-SKILL-016,SIT-SKILL-017,SIT-SKILL-026,SIT-SKILL-013,SIT-SKILL-030,SIT-SKILL-032,SIT-SKILL-SCOPE-001,SIT-CONN-001,SIT-CONN-002,SIT-CONN-004,SIT-CONN-009,SIT-CONN-010,SIT-CONN-011,SIT-CONN-015,SIT-CONN-019,SIT-ART-001,SIT-ART-002,SIT-ART-015,SIT-ART-017,SIT-ART-021,SIT-ART-022,SIT-ART-CONFIRM-001,SIT-ART-013,SIT-ART-014,SIT-ART-024,SIT-KNOWLEDGE-001,SIT-INIT-004,SIT-INIT-009,SIT-INIT-025,SIT-AUTH-001,SIT-AUTH-005,SIT-TEAMS-NEW-002,SIT-SKILL-002,SIT-EXPERT-002,SIT-HOME-023,SIT-HOME-030,SIT-HOME-049,SIT-HOME-050,SIT-HITL-002,SIT-TASK-EDIT-001,BETA-TASK-002,SIT-HOME-037,SIT-HOME-038,SIT-HOME-040,SIT-HOME-041,SIT-HOME-043,SIT-HOME-044,SIT-HOME-056,SIT-MEM-001,SIT-HOME-015,SIT-HOME-016,SIT-HOME-022,SIT-HOME-053,SIT-HOME-057,SIT-HOME-058,SIT-HOME-060,SIT-HOME-062,SIT-HOME-019,SIT-HOME-054,SIT-HOME-055,SIT-HOME-065,SIT-HOME-066,SIT-HOME-027,SIT-HOME-047,SIT-HOME-052,SIT-HOME-028,SIT-HOME-046,SIT-HOME-051,SIT-CONN-005,SIT-HOME-048'.split(','),
]);

export const QWORK_RELEASE_TEST_STAGES = Object.freeze([
  Object.freeze({
    id: 'G0',
    name: '静态与发布身份门禁',
    kind: 'readiness',
    prerequisite: '',
    next_stage: 'G1',
  }),
  Object.freeze({
    id: 'G1',
    name: '核心生命线门禁',
    kind: 'casebook',
    sheet: '核心生命线门禁',
    expected_case_count: 16,
    expected_case_ids: QWORK_CORE_LIFELINE_CASE_IDS,
    expected_capability_classes: {
      runner_native: 11,
      runner_native_with_fixture_option: 0,
      runner_legacy_verified: 5,
    },
    prerequisite: 'G0',
    next_stage: 'G2',
  }),
  Object.freeze({
    id: 'G2',
    name: '新增 MR 变更冒烟',
    kind: 'casebook',
    sheet: '新增MR核心冒烟',
    expected_case_count: 12,
    expected_case_ids: QWORK_MR_SMOKE_CASE_IDS,
    expected_capability_classes: {
      runner_native: 6,
      runner_native_with_fixture_option: 0,
      runner_legacy_verified: 6,
    },
    prerequisite: 'G1',
    next_stage: 'G3',
  }),
  Object.freeze({
    id: 'G3',
    name: '生产风险门禁',
    kind: 'casebook',
    sheet: '生产灰度门禁Case',
    expected_case_count: 70,
    expected_case_ids: QWORK_GRAY_GATE_CASE_IDS,
    expected_capability_classes: {
      runner_native: 60,
      runner_native_with_fixture_option: 1,
      runner_legacy_verified: 9,
    },
    prerequisite: 'G2',
    next_stage: 'G4',
  }),
  Object.freeze({
    id: 'G4',
    name: '全量正常功能回归',
    kind: 'casebook',
    sheet: '全量功能回归Case',
    expected_case_count: 160,
    expected_case_ids: QWORK_FULL_REGRESSION_CASE_IDS,
    expected_capability_classes: {
      runner_native: 61,
      runner_native_with_fixture_option: 1,
      runner_legacy_verified: 98,
    },
    prerequisite: 'G3',
    next_stage: 'G5',
  }),
  Object.freeze({
    id: 'G5',
    name: '稳定性与受管重启 Soak',
    kind: 'soak',
    minimum_tasks: 100,
    minimum_restarts: 3,
    maximum_rss_growth_bytes: 104857600,
    prerequisite: 'G4',
    next_stage: '',
  }),
]);

const TRUSTED_FAILURE_CATEGORIES = Object.freeze([
  'trusted_bug',
  'trusted_fail',
  'trusted_blocked',
  'framework_issue',
  'testcase_issue',
  'needs_review',
]);

const REQUIRED_QWORK_PRETEST_CHECK_IDS = Object.freeze([
  'git_branch_main',
  'git_head_matches_origin_main',
  'git_tracked_clean',
  'git_framework_entrypoints_tracked',
  'single_runner_precondition',
  'root_framework_check',
  'teams_framework_check',
  'casebook_exists',
  'casebook_git_tracked',
  'casebook_sha256',
  'casebook_exact_sheet_export',
  'case_count',
  'case_id_unique',
  'scoped_execution_not_implicit',
  'core_beta_protocol',
  'release_identity_inputs',
  'fixture_controller_contract',
  'teams_app',
  'teams_release_identity',
  'managed_live_session',
  'managed_session_process',
  'control_plane_identity',
  'qwork_control_plane_health',
  'qwork_backend_identity',
  'teams_cdp',
  'qwork_target_logged_in',
  'qwork_public_capabilities',
  'qwork_control_plane_identity',
  'qwork_release_identity',
  'qwork_runtime_release_status',
  'qwork_runtime_release_identity',
  'qwork_runtime_update_activation_safe',
  'qwork_host_runtime_compatibility',
  'qwork_release_artifact_identity',
  'qwork_release_identity_observed_matches_expected',
  'frozen_product_identity_complete',
  'frozen_product_identity_hashes',
  'release_identity_observed_matches_expected',
]);

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value).sort().map((key) => [key, stableValue(value[key])]),
    );
  }
  return value;
}

function nonEmptyString(value) {
  return String(value ?? '').trim();
}

function finiteNumber(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function strictTrue(value) {
  return value === true || value === 'true' || value === 1 || value === '1';
}

function stableEqual(left, right) {
  return JSON.stringify(stableValue(left)) === JSON.stringify(stableValue(right));
}

function exactObjectKeys(value, expectedKeys) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  return JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...expectedKeys].sort());
}

function validTimestamp(value) {
  return typeof value === 'string'
    && value.trim() === value
    && value.length > 0
    && Number.isFinite(Date.parse(value));
}

function sha256File(file) {
  return createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function inspectCanonicalArtifact(artifactPath, expectedType = 'file') {
  const value = nonEmptyString(artifactPath);
  if (!value || !path.isAbsolute(value)) return { ok: false, reason: 'path_not_absolute' };
  const resolved = path.resolve(value);
  if (value !== resolved) return { ok: false, reason: 'path_not_normalized' };
  try {
    const parsed = path.parse(resolved);
    let cursor = parsed.root;
    const relativeParts = resolved.slice(parsed.root.length).split(path.sep).filter(Boolean);
    for (const part of relativeParts) {
      cursor = path.join(cursor, part);
      const stat = fs.lstatSync(cursor);
      if (stat.isSymbolicLink()) return { ok: false, reason: 'symlink' };
    }
    const stat = fs.lstatSync(resolved);
    const wantsDirectory = expectedType === 'directory-tree';
    if (wantsDirectory ? !stat.isDirectory() : !stat.isFile()) {
      return { ok: false, reason: 'type' };
    }
    const realpath = fs.realpathSync(resolved);
    if (realpath !== resolved) return { ok: false, reason: 'path_not_canonical' };
    return { ok: true, path: resolved, realpath, stat };
  } catch {
    return { ok: false, reason: 'unreadable' };
  }
}

function readJsonFile(file) {
  const value = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('JSON root must be an object');
  }
  return value;
}

function canonicalPath(value) {
  const resolved = path.resolve(nonEmptyString(value));
  try {
    return fs.realpathSync(resolved);
  } catch {
    return resolved;
  }
}

function sameCanonicalPath(left, right) {
  return canonicalPath(left) === canonicalPath(right);
}

function safePathWithin(candidate, root, expectedType = 'file') {
  const resolvedRoot = path.resolve(nonEmptyString(root));
  const resolvedCandidate = path.resolve(nonEmptyString(candidate));
  try {
    const rootStat = fs.lstatSync(resolvedRoot);
    if (rootStat.isSymbolicLink() || !rootStat.isDirectory()) return { ok: false, reason: 'root_type' };
    if (!pathInside(resolvedCandidate, resolvedRoot)) return { ok: false, reason: 'boundary' };
    const relative = path.relative(resolvedRoot, resolvedCandidate);
    let cursor = resolvedRoot;
    for (const part of relative.split(path.sep).filter(Boolean)) {
      cursor = path.join(cursor, part);
      if (fs.lstatSync(cursor).isSymbolicLink()) return { ok: false, reason: 'symlink' };
    }
    const candidateStat = fs.lstatSync(resolvedCandidate);
    if (expectedType === 'file' && !candidateStat.isFile()) return { ok: false, reason: 'type' };
    if (expectedType === 'directory' && !candidateStat.isDirectory()) return { ok: false, reason: 'type' };
    const realRoot = fs.realpathSync(resolvedRoot);
    const realCandidate = fs.realpathSync(resolvedCandidate);
    if (!pathInside(realCandidate, realRoot)) return { ok: false, reason: 'realpath_boundary' };
    return { ok: true, path: resolvedCandidate, realpath: realCandidate };
  } catch {
    return { ok: false, reason: 'unreadable' };
  }
}

export function validateQworkReleaseRefObservation({
  report,
  reportPath = '',
  reportSha256 = '',
  expectedReleaseRef = '',
  expectedReleaseHead = '',
} = {}) {
  const failures = [];
  if (report?.schema_version !== QWORK_RELEASE_REF_OBSERVATION_SCHEMA) failures.push('release_observation_schema_mismatch');
  if (!path.isAbsolute(nonEmptyString(reportPath))) failures.push('release_observation_path_invalid');
  if (!/^[a-f0-9]{64}$/i.test(nonEmptyString(reportSha256))) failures.push('release_observation_artifact_sha256_invalid');
  if (!Number.isFinite(Date.parse(nonEmptyString(report?.observed_at)))) failures.push('release_observation_time_invalid');
  if (!path.isAbsolute(nonEmptyString(report?.repository))) failures.push('release_observation_repository_invalid');
  if (!['git-rev-parse-after-fetch', 'gitlab-api'].includes(nonEmptyString(report?.source))) {
    failures.push('release_observation_source_invalid');
  }
  if (nonEmptyString(report?.release_ref) !== nonEmptyString(expectedReleaseRef)) failures.push('release_observation_release_ref_mismatch');
  if (nonEmptyString(report?.release_head) !== nonEmptyString(expectedReleaseHead)) failures.push('release_observation_release_head_mismatch');
  return { ok: failures.length === 0, failures: [...new Set(failures)] };
}

function releaseIntakePlanBindingFailures(plan) {
  const failures = [];
  const binding = plan?.release_intake;
  if (plan?.policy?.release_intake_required !== true) {
    failures.push('plan_release_intake_binding_required');
  }
  if (!binding || typeof binding !== 'object' || Array.isArray(binding)) {
    failures.push('plan_release_intake_binding_required');
    return [...new Set(failures)];
  }
  if (!exactObjectKeys(binding, [
    'schema_version',
    'path',
    'sha256',
    'content_sha256',
    'release_ref',
    'release_head',
    'repository',
    'baseline_commit',
    'required_stages',
  ])) failures.push('plan_release_intake_fields_mismatch');
  if (binding.schema_version !== QWORK_RELEASE_INTAKE_SCHEMA) {
    failures.push('plan_release_intake_schema_mismatch');
  }
  if (!path.isAbsolute(nonEmptyString(binding.path))) {
    failures.push('plan_release_intake_path_invalid');
  }
  if (!/^[a-f0-9]{64}$/i.test(nonEmptyString(binding.sha256))) {
    failures.push('plan_release_intake_artifact_sha256_invalid');
  }
  if (!/^[a-f0-9]{64}$/i.test(nonEmptyString(binding.content_sha256))) {
    failures.push('plan_release_intake_content_sha256_invalid');
  }
  if (nonEmptyString(binding.release_ref) !== QWORK_RELEASE_INTAKE_DEFAULT_REF) {
    failures.push('plan_release_intake_release_ref_invalid');
  }
  if (!/^[a-f0-9]{40}$/i.test(nonEmptyString(binding.release_head))) {
    failures.push('plan_release_intake_release_head_invalid');
  }
  if (!path.isAbsolute(nonEmptyString(binding.repository))) {
    failures.push('plan_release_intake_repository_invalid');
  }
  if (nonEmptyString(binding.baseline_commit) !== QWORK_RELEASE_CASEBOOK_DESIGN_BASELINE_COMMIT) {
    failures.push('plan_release_intake_baseline_commit_mismatch');
  }
  if (!Array.isArray(binding.required_stages)
    || binding.required_stages.some((stageId) => !/^G[1-5]$/.test(nonEmptyString(stageId)))
    || new Set(binding.required_stages).size !== binding.required_stages.length) {
    failures.push('plan_release_intake_required_stages_invalid');
  }
  return [...new Set(failures)];
}

function releaseHeadObservationPlanBindingFailures(plan) {
  const binding = plan?.release_head_observation;
  const failures = [];
  if (!binding || typeof binding !== 'object' || Array.isArray(binding)) {
    return ['plan_release_head_observation_binding_required'];
  }
  if (!exactObjectKeys(binding, [
    'schema_version',
    'path',
    'sha256',
    'observed_at',
    'repository',
    'release_ref',
    'release_head',
    'source',
  ])) failures.push('plan_release_head_observation_fields_mismatch');
  const validation = validateQworkReleaseRefObservation({
    report: binding,
    reportPath: binding.path,
    reportSha256: binding.sha256,
    expectedReleaseRef: plan?.release_intake?.release_ref,
    expectedReleaseHead: plan?.release_intake?.release_head,
  });
  failures.push(...validation.failures.map((failure) => `plan_${failure}`));
  if (path.resolve(nonEmptyString(binding.path)) === path.resolve(nonEmptyString(plan?.release_intake?.path))) {
    failures.push('plan_release_head_observation_must_be_independent');
  }
  if (!sameCanonicalPath(binding.repository, plan?.release_intake?.repository)) {
    failures.push('plan_release_observation_repository_mismatch');
  }
  return [...new Set(failures)];
}

export function qworkReleaseIdentityFingerprint(identity = {}) {
  return createHash('sha256')
    .update(JSON.stringify(stableValue(identity)))
    .digest('hex');
}

export function qworkReleaseStage(stageId) {
  return QWORK_RELEASE_TEST_STAGES.find((stage) => stage.id === stageId) || null;
}

export function normalizeQworkReleaseIdentity(source = {}) {
  const releaseInputs = source.release_inputs || source.releaseInputs || {};
  const host = source.host || source.teams || {};
  const qwork = source.qwork || {};
  const controlPlane = source.control_plane || source.controlPlane || {};
  return {
    teams_version: nonEmptyString(source.teams_version || host.version),
    teams_build: nonEmptyString(source.teams_build || host.build),
    qwork_version: nonEmptyString(source.qwork_version || qwork.version),
    control_plane_origin: nonEmptyString(
      source.control_plane_origin || controlPlane.origin || source.expected_control_plane_origin,
    ).replace(/\/$/, ''),
    backend_version: nonEmptyString(source.backend_version || releaseInputs.backend_version),
    prompt_policy_version: nonEmptyString(
      source.prompt_policy_version || releaseInputs.prompt_policy_version,
    ),
    feature_flags_hash: nonEmptyString(source.feature_flags_hash || releaseInputs.feature_flags_hash),
    qwork_ui_git_commit: nonEmptyString(
      source.qwork_ui_git_commit || releaseInputs.qwork_ui_git_commit,
    ),
    qwork_build_id: nonEmptyString(source.qwork_build_id || releaseInputs.qwork_build_id),
    qwork_release_manifest_sha256: nonEmptyString(
      source.qwork_release_manifest_sha256 || releaseInputs.qwork_release_manifest_sha256,
    ),
  };
}

export function validateQworkReleaseIdentity(identity = {}) {
  const normalized = normalizeQworkReleaseIdentity(identity);
  const missing = Object.entries(normalized)
    .filter(([, value]) => !value)
    .map(([key]) => key);
  const invalid = [];
  if (normalized.feature_flags_hash && !/^[a-f0-9]{64}$/i.test(normalized.feature_flags_hash)) {
    invalid.push('feature_flags_hash');
  }
  if (normalized.qwork_release_manifest_sha256
    && !/^[a-f0-9]{64}$/i.test(normalized.qwork_release_manifest_sha256)) {
    invalid.push('qwork_release_manifest_sha256');
  }
  if (normalized.qwork_ui_git_commit && !/^[a-f0-9]{7,40}$/i.test(normalized.qwork_ui_git_commit)) {
    invalid.push('qwork_ui_git_commit');
  }
  return {
    ok: missing.length === 0 && invalid.length === 0,
    identity: normalized,
    fingerprint: qworkReleaseIdentityFingerprint(normalized),
    missing_fields: missing,
    invalid_fields: invalid,
  };
}

function releaseIntakeBaselineFailures(report = {}) {
  const failures = [];
  if (nonEmptyString(report?.scan_boundary?.baseline_commit)
    !== QWORK_RELEASE_CASEBOOK_DESIGN_BASELINE_COMMIT) {
    failures.push('release_intake_design_baseline_mismatch');
  }
  if (nonEmptyString(report?.policy?.api_freshness?.compare_from)
    !== QWORK_RELEASE_CASEBOOK_DESIGN_BASELINE_COMMIT) {
    failures.push('release_intake_compare_from_mismatch');
  }
  return failures;
}

function sourceArtifactMap(plan, failures) {
  const sourceArtifacts = plan?.source_artifacts;
  if (!Array.isArray(sourceArtifacts)
    || sourceArtifacts.length !== QWORK_RELEASE_SOURCE_ARTIFACT_ROLES.length) {
    failures.push('plan_source_artifacts_count_mismatch');
    return new Map();
  }
  const roles = sourceArtifacts.map((artifact) => nonEmptyString(artifact?.role));
  if (JSON.stringify(roles) !== JSON.stringify(QWORK_RELEASE_SOURCE_ARTIFACT_ROLES)) {
    failures.push('plan_source_artifact_roles_mismatch');
  }
  if (new Set(roles).size !== roles.length) failures.push('plan_source_artifact_roles_not_unique');
  const artifactMap = new Map();
  const canonicalPaths = [];
  for (const artifact of sourceArtifacts) {
    const role = nonEmptyString(artifact?.role);
    if (!exactObjectKeys(artifact, ['role', 'path', 'sha256', 'type'])) {
      failures.push(`plan_source_artifact_fields_mismatch:${role || 'missing'}`);
    }
    if (artifact?.type !== 'file') failures.push(`plan_source_artifact_type_mismatch:${role || 'missing'}`);
    if (!/^[a-f0-9]{64}$/i.test(nonEmptyString(artifact?.sha256))) {
      failures.push(`plan_source_artifact_sha256_invalid:${role || 'missing'}`);
    }
    const inspection = inspectCanonicalArtifact(artifact?.path, 'file');
    if (!inspection.ok) {
      failures.push(`plan_source_artifact_path_invalid:${role || 'missing'}:${inspection.reason}`);
    } else {
      canonicalPaths.push(inspection.realpath);
      if (sha256File(inspection.realpath) !== nonEmptyString(artifact?.sha256).toLowerCase()) {
        failures.push(`plan_source_artifact_sha256_mismatch:${role || 'missing'}`);
      }
    }
    if (role) artifactMap.set(role, { artifact, inspection });
  }
  if (new Set(canonicalPaths).size !== canonicalPaths.length) {
    failures.push('plan_source_artifact_paths_not_unique');
  }
  return artifactMap;
}

export function validateCanonicalQworkReleaseTestPlan(plan) {
  const failures = [];
  if (!exactObjectKeys(plan, [
    'schema_version',
    'created_at',
    'casebook',
    'framework',
    'release_identity',
    'release_identity_sha256',
    'release_intake',
    'release_head_observation',
    'source_artifacts',
    'policy',
    'stages',
  ])) failures.push('plan_fields_mismatch');
  if (plan?.schema_version !== QWORK_RELEASE_TEST_PLAN_SCHEMA) failures.push('plan_schema_mismatch');
  if (!validTimestamp(plan?.created_at)) failures.push('plan_created_at_invalid');
  if (!exactObjectKeys(plan?.casebook, ['path', 'sha256'])) failures.push('plan_casebook_fields_mismatch');
  if (path.basename(nonEmptyString(plan?.casebook?.path)) !== QWORK_RELEASE_CASEBOOK_BASENAME) {
    failures.push('plan_casebook_basename_mismatch');
  }
  if (nonEmptyString(plan?.casebook?.sha256).toLowerCase() !== QWORK_RELEASE_CASEBOOK_SHA256) {
    failures.push('plan_casebook_sha256_mismatch');
  }
  if (!exactObjectKeys(plan?.framework, ['commit'])
    || !/^[a-f0-9]{40}$/.test(nonEmptyString(plan?.framework?.commit))) {
    failures.push('plan_framework_invalid');
  }
  if (!exactObjectKeys(plan?.release_identity, QWORK_RELEASE_IDENTITY_FIELDS)) {
    failures.push('plan_release_identity_fields_mismatch');
  }
  const identityAudit = validateQworkReleaseIdentity(plan?.release_identity || {});
  if (!identityAudit.ok || !stableEqual(identityAudit.identity, plan?.release_identity)) {
    failures.push('plan_release_identity_invalid');
  }
  if (nonEmptyString(plan?.release_identity_sha256) !== identityAudit.fingerprint) {
    failures.push('plan_release_identity_sha256_mismatch');
  }
  failures.push(...releaseIntakePlanBindingFailures(plan));
  failures.push(...releaseHeadObservationPlanBindingFailures(plan));
  if (!stableEqual(plan?.policy, QWORK_RELEASE_TEST_POLICY)) failures.push('plan_policy_mismatch');
  if (!stableEqual(plan?.stages, QWORK_RELEASE_TEST_STAGES)) failures.push('plan_stages_mismatch');

  const artifacts = sourceArtifactMap(plan, failures);
  const expectedArtifactBindings = {
    casebook: {
      path: nonEmptyString(plan?.casebook?.path),
      sha256: nonEmptyString(plan?.casebook?.sha256).toLowerCase(),
    },
    release_intake: {
      path: nonEmptyString(plan?.release_intake?.path),
      sha256: nonEmptyString(plan?.release_intake?.sha256).toLowerCase(),
    },
    release_observation: {
      path: nonEmptyString(plan?.release_head_observation?.path),
      sha256: nonEmptyString(plan?.release_head_observation?.sha256).toLowerCase(),
    },
  };
  for (const [role, expected] of Object.entries(expectedArtifactBindings)) {
    const artifact = artifacts.get(role)?.artifact;
    if (!artifact || nonEmptyString(artifact.path) !== expected.path
      || nonEmptyString(artifact.sha256).toLowerCase() !== expected.sha256) {
      failures.push(`plan_source_artifact_binding_mismatch:${role}`);
    }
  }

  const identitySource = artifacts.get('release_identity');
  if (identitySource?.inspection?.ok) {
    try {
      const report = readJsonFile(identitySource.inspection.realpath);
      if (!exactObjectKeys(report, ['schema_version', 'captured_at', ...QWORK_RELEASE_IDENTITY_FIELDS])) {
        failures.push('release_identity_artifact_fields_mismatch');
      }
      if (report.schema_version !== QWORK_RELEASE_IDENTITY_SCHEMA) {
        failures.push('release_identity_artifact_schema_mismatch');
      }
      if (!validTimestamp(report.captured_at)) failures.push('release_identity_artifact_time_invalid');
      const artifactIdentity = Object.fromEntries(
        QWORK_RELEASE_IDENTITY_FIELDS.map((field) => [field, report[field]]),
      );
      const artifactIdentityAudit = validateQworkReleaseIdentity(artifactIdentity);
      if (!artifactIdentityAudit.ok
        || !stableEqual(artifactIdentityAudit.identity, plan?.release_identity)
        || artifactIdentityAudit.fingerprint !== plan?.release_identity_sha256) {
        failures.push('release_identity_artifact_identity_mismatch');
      }
    } catch {
      failures.push('release_identity_artifact_unreadable');
    }
  }

  const intakeSource = artifacts.get('release_intake');
  if (intakeSource?.inspection?.ok) {
    try {
      const report = readJsonFile(intakeSource.inspection.realpath);
      const binding = validateQworkReleaseIntakeBinding({
        plan,
        report,
        reportSha256: sha256File(intakeSource.inspection.realpath),
      });
      failures.push(...binding.failures.map((failure) => `plan_source_${failure}`));
      failures.push(...releaseIntakeBaselineFailures(report));
      if (nonEmptyString(report?.scan_boundary?.baseline_commit)
        !== nonEmptyString(plan?.release_intake?.baseline_commit)) {
        failures.push('release_intake_plan_baseline_mismatch');
      }
    } catch {
      failures.push('release_intake_artifact_unreadable');
    }
  }

  const observationSource = artifacts.get('release_observation');
  if (observationSource?.inspection?.ok) {
    try {
      const report = readJsonFile(observationSource.inspection.realpath);
      const binding = validateQworkReleaseRefObservationBinding({
        plan,
        report,
        reportSha256: sha256File(observationSource.inspection.realpath),
      });
      failures.push(...binding.failures.map((failure) => `plan_source_${failure}`));
    } catch {
      failures.push('release_observation_artifact_unreadable');
    }
  }

  const casebookSource = artifacts.get('casebook');
  if (casebookSource?.inspection?.ok
    && nonEmptyString(casebookSource.inspection.realpath) !== nonEmptyString(plan?.casebook?.path)) {
    failures.push('plan_casebook_path_not_canonical');
  }
  const repositoryInspection = inspectCanonicalArtifact(plan?.release_intake?.repository, 'directory-tree');
  if (!repositoryInspection.ok) failures.push(`plan_release_repository_invalid:${repositoryInspection.reason}`);
  else if (repositoryInspection.realpath !== nonEmptyString(plan?.release_intake?.repository)) {
    failures.push('plan_release_repository_not_canonical');
  }

  return {
    ok: failures.length === 0,
    failures: [...new Set(failures)],
    identity: identityAudit.identity,
    identity_sha256: identityAudit.fingerprint,
  };
}

export function createQworkReleaseTestPlan({
  casebookPath,
  casebookSha256,
  frameworkCommit,
  releaseIdentity,
  releaseIdentityPath = '',
  releaseIdentitySha256 = '',
  releaseIntake,
  releaseIntakePath = '',
  releaseIntakeSha256 = '',
  expectedReleaseRef = '',
  expectedReleaseHead = '',
  releaseHeadObservation,
  releaseHeadObservationPath = '',
  releaseHeadObservationSha256 = '',
} = {}) {
  const identityAudit = validateQworkReleaseIdentity(releaseIdentity);
  const errors = [];
  if (!nonEmptyString(casebookPath)) errors.push('casebook_path_missing');
  if (!/^[a-f0-9]{64}$/i.test(nonEmptyString(casebookSha256))) errors.push('casebook_sha256_invalid');
  if (path.basename(nonEmptyString(casebookPath)) !== QWORK_RELEASE_CASEBOOK_BASENAME) {
    errors.push('casebook_basename_mismatch');
  }
  if (nonEmptyString(casebookSha256).toLowerCase() !== QWORK_RELEASE_CASEBOOK_SHA256) {
    errors.push('casebook_sha256_mismatch');
  }
  if (!/^[a-f0-9]{40}$/i.test(nonEmptyString(frameworkCommit))) errors.push('framework_commit_invalid');
  if (nonEmptyString(expectedReleaseRef) !== QWORK_RELEASE_INTAKE_DEFAULT_REF) {
    errors.push('expected_release_ref_invalid');
  }
  if (!/^[a-f0-9]{40}$/i.test(nonEmptyString(expectedReleaseHead))) {
    errors.push('expected_release_head_invalid');
  }
  const releaseObservationValidation = validateQworkReleaseRefObservation({
    report: releaseHeadObservation,
    reportPath: releaseHeadObservationPath,
    reportSha256: releaseHeadObservationSha256,
    expectedReleaseRef,
    expectedReleaseHead,
  });
  if (!releaseObservationValidation.ok) {
    errors.push(`release_head_observation_invalid:${releaseObservationValidation.failures.join(',')}`);
  }
  if (path.resolve(nonEmptyString(releaseHeadObservationPath)) === path.resolve(nonEmptyString(releaseIntakePath))) {
    errors.push('release_head_observation_must_be_independent');
  }
  if (!identityAudit.ok) errors.push(`release_identity_missing:${identityAudit.missing_fields.join(',')}`);
  if (identityAudit.invalid_fields.length) {
    errors.push(`release_identity_invalid:${identityAudit.invalid_fields.join(',')}`);
  }
  let intakeBinding = null;
  if (releaseIntake == null) {
    errors.push('release_intake_required');
  } else {
    const intakeValidation = validateQworkReleaseIntake(releaseIntake, {
      releaseRef: nonEmptyString(expectedReleaseRef),
      releaseHead: nonEmptyString(expectedReleaseHead),
      casebookSha256: nonEmptyString(casebookSha256),
      frameworkCommit: nonEmptyString(frameworkCommit),
      requireReady: true,
      requireFreshRef: true,
      requireGitLabApiFreshness: true,
    });
    if (!intakeValidation.ok) errors.push(`release_intake_invalid:${intakeValidation.failures.join(',')}`);
    const baselineFailures = releaseIntakeBaselineFailures(releaseIntake);
    if (baselineFailures.length) errors.push(`release_intake_invalid:${baselineFailures.join(',')}`);
    if (!/^[a-f0-9]{64}$/i.test(nonEmptyString(releaseIntakeSha256))) {
      errors.push('release_intake_sha256_invalid');
    }
    if (!path.isAbsolute(nonEmptyString(releaseIntakePath))) {
      errors.push('release_intake_path_invalid');
    }
    if (releaseIntake?.schema_version !== QWORK_RELEASE_INTAKE_SCHEMA) {
      errors.push('release_intake_schema_mismatch');
    }
    intakeBinding = {
      schema_version: QWORK_RELEASE_INTAKE_SCHEMA,
      path: nonEmptyString(releaseIntakePath),
      sha256: nonEmptyString(releaseIntakeSha256).toLowerCase(),
      content_sha256: nonEmptyString(releaseIntake?.integrity?.content_sha256),
      release_ref: nonEmptyString(releaseIntake?.release?.ref),
      release_head: nonEmptyString(releaseIntake?.release?.head),
      repository: nonEmptyString(releaseIntake?.release?.repository),
      baseline_commit: nonEmptyString(releaseIntake?.scan_boundary?.baseline_commit),
      required_stages: Array.isArray(releaseIntake?.summary?.required_stages)
        ? [...releaseIntake.summary.required_stages] : [],
    };
  }
  if (intakeBinding
    && !sameCanonicalPath(releaseHeadObservation?.repository, intakeBinding.repository)) {
    errors.push('release_observation_repository_mismatch');
  }
  if (errors.length) throw new Error(`QWork 发布测试计划输入无效：${errors.join('；')}`);
  const plan = {
    schema_version: QWORK_RELEASE_TEST_PLAN_SCHEMA,
    created_at: new Date().toISOString(),
    casebook: {
      path: nonEmptyString(casebookPath),
      sha256: nonEmptyString(casebookSha256).toLowerCase(),
    },
    framework: { commit: nonEmptyString(frameworkCommit).toLowerCase() },
    release_identity: identityAudit.identity,
    release_identity_sha256: identityAudit.fingerprint,
    release_intake: intakeBinding,
    release_head_observation: {
      schema_version: QWORK_RELEASE_REF_OBSERVATION_SCHEMA,
      path: nonEmptyString(releaseHeadObservationPath),
      sha256: nonEmptyString(releaseHeadObservationSha256).toLowerCase(),
      observed_at: nonEmptyString(releaseHeadObservation?.observed_at),
      repository: nonEmptyString(releaseHeadObservation?.repository),
      release_ref: nonEmptyString(releaseHeadObservation?.release_ref),
      release_head: nonEmptyString(releaseHeadObservation?.release_head),
      source: nonEmptyString(releaseHeadObservation?.source),
    },
    source_artifacts: [
      {
        role: 'casebook',
        path: nonEmptyString(casebookPath),
        sha256: nonEmptyString(casebookSha256).toLowerCase(),
        type: 'file',
      },
      {
        role: 'release_identity',
        path: nonEmptyString(releaseIdentityPath),
        sha256: nonEmptyString(releaseIdentitySha256).toLowerCase(),
        type: 'file',
      },
      {
        role: 'release_intake',
        path: nonEmptyString(releaseIntakePath),
        sha256: nonEmptyString(releaseIntakeSha256).toLowerCase(),
        type: 'file',
      },
      {
        role: 'release_observation',
        path: nonEmptyString(releaseHeadObservationPath),
        sha256: nonEmptyString(releaseHeadObservationSha256).toLowerCase(),
        type: 'file',
      },
    ],
    policy: structuredClone(QWORK_RELEASE_TEST_POLICY),
    stages: structuredClone(QWORK_RELEASE_TEST_STAGES),
  };
  const canonical = validateCanonicalQworkReleaseTestPlan(plan);
  if (!canonical.ok) {
    throw new Error(`QWork 发布测试计划输入无效：${canonical.failures.join('；')}`);
  }
  return plan;
}

export function createQworkReleaseTestState(plan) {
  const canonical = validateCanonicalQworkReleaseTestPlan(plan);
  if (!canonical.ok) {
    throw new Error(`不支持的发布测试计划：${canonical.failures.join(',')}`);
  }
  return {
    schema_version: QWORK_RELEASE_TEST_STATE_SCHEMA,
    plan_sha256: qworkReleaseIdentityFingerprint(plan),
    revision: 0,
    updated_at: nonEmptyString(plan.created_at),
    decision: 'NOT_READY',
    stop_reason: '',
    stages: Object.fromEntries(plan.stages.map((stage) => [stage.id, {
      id: stage.id,
      status: 'NOT_STARTED',
      admission: null,
      completion: null,
    }])),
  };
}

function qworkReleaseStateShapeFailures(plan, state) {
  const failures = [];
  if (!exactObjectKeys(state, [
    'schema_version',
    'plan_sha256',
    'revision',
    'updated_at',
    'decision',
    'stop_reason',
    'stages',
  ])) failures.push('state_fields_mismatch');
  if (state?.schema_version !== QWORK_RELEASE_TEST_STATE_SCHEMA) failures.push('state_schema_mismatch');
  if (state?.plan_sha256 !== qworkReleaseIdentityFingerprint(plan)) failures.push('state_plan_sha256_mismatch');
  if (!Number.isSafeInteger(state?.revision) || state.revision < 0) failures.push('state_revision_invalid');
  if (!validTimestamp(state?.updated_at)) failures.push('state_updated_at_invalid');
  if (!['NOT_READY', 'CONTINUE', 'NO_GO', 'ELIGIBLE_FOR_MULTI_RUN_GRAY_GATE'].includes(state?.decision)) {
    failures.push('state_decision_invalid');
  }
  if (typeof state?.stop_reason !== 'string') failures.push('state_stop_reason_invalid');
  const expectedStageIds = QWORK_RELEASE_TEST_STAGES.map((stage) => stage.id);
  if (!exactObjectKeys(state?.stages, expectedStageIds)) failures.push('state_stage_ids_mismatch');
  for (const stageId of expectedStageIds) {
    const stageState = state?.stages?.[stageId];
    if (!exactObjectKeys(stageState, ['id', 'status', 'admission', 'completion'])
      || stageState?.id !== stageId
      || !['NOT_STARTED', 'READY', 'BLOCKED', 'PASSED', 'STOPPED'].includes(stageState?.status)
      || !(stageState?.admission == null || typeof stageState.admission === 'object')
      || !(stageState?.completion == null || typeof stageState.completion === 'object')) {
      failures.push(`state_stage_invalid:${stageId}`);
    }
  }
  return [...new Set(failures)];
}

export function createQworkReleaseTestIntegrity(plan, state, {
  eventCount = 0,
  lastEventSha256 = '',
  initialStateSha256 = qworkReleaseIdentityFingerprint(createQworkReleaseTestState(plan)),
} = {}) {
  return {
    schema_version: QWORK_RELEASE_TEST_INTEGRITY_SCHEMA,
    plan_sha256: qworkReleaseIdentityFingerprint(plan),
    state_sha256: qworkReleaseIdentityFingerprint(state),
    state_revision: Number(state?.revision || 0),
    initial_state_sha256: nonEmptyString(initialStateSha256),
    event_count: Number(eventCount),
    last_event_sha256: nonEmptyString(lastEventSha256),
    updated_at: new Date().toISOString(),
  };
}

export function validateQworkReleaseControlState({ plan, state, integrity } = {}) {
  const failures = [];
  const planSha256 = qworkReleaseIdentityFingerprint(plan);
  const stateSha256 = qworkReleaseIdentityFingerprint(state);
  const canonical = validateCanonicalQworkReleaseTestPlan(plan);
  failures.push(...canonical.failures);
  failures.push(...qworkReleaseStateShapeFailures(plan, state));
  if (integrity?.schema_version !== QWORK_RELEASE_TEST_INTEGRITY_SCHEMA) {
    failures.push('integrity_schema_mismatch');
  }
  if (state?.plan_sha256 !== planSha256) failures.push('state_plan_sha256_mismatch');
  if (integrity?.plan_sha256 !== planSha256) failures.push('integrity_plan_sha256_mismatch');
  if (integrity?.state_sha256 !== stateSha256) failures.push('integrity_state_sha256_mismatch');
  try {
    const initialStateSha256 = qworkReleaseIdentityFingerprint(createQworkReleaseTestState(plan));
    if (integrity?.initial_state_sha256 !== initialStateSha256) failures.push('integrity_initial_state_sha256_mismatch');
  } catch {
    failures.push('integrity_initial_state_unreconstructable');
  }
  if (!Number.isSafeInteger(state?.revision) || state.revision < 0) failures.push('state_revision_invalid');
  if (integrity?.state_revision !== state?.revision) failures.push('integrity_state_revision_mismatch');
  if (!Number.isSafeInteger(integrity?.event_count) || integrity.event_count < 0) {
    failures.push('integrity_event_count_invalid');
  }
  if (integrity?.event_count === 0 && nonEmptyString(integrity?.last_event_sha256)) {
    failures.push('integrity_unexpected_last_event_sha256');
  }
  if (integrity?.event_count > 0 && !/^[a-f0-9]{64}$/i.test(nonEmptyString(integrity?.last_event_sha256))) {
    failures.push('integrity_last_event_sha256_invalid');
  }
  return {
    ok: failures.length === 0,
    failures,
    plan_sha256: planSha256,
    state_sha256: stateSha256,
  };
}

export function validateQworkReleaseIntakeBinding({ plan, report, reportSha256 = '' } = {}) {
  const failures = [];
  const binding = plan?.release_intake;
  const planBindingFailures = releaseIntakePlanBindingFailures(plan);
  if (planBindingFailures.length) {
    return { ok: false, failures: planBindingFailures, required: true };
  }
  if (report?.schema_version !== QWORK_RELEASE_INTAKE_SCHEMA) failures.push('release_intake_schema_mismatch');
  if (binding.schema_version !== QWORK_RELEASE_INTAKE_SCHEMA) failures.push('plan_release_intake_schema_mismatch');
  if (textValue(report?.release?.ref) !== textValue(binding.release_ref)) failures.push('release_intake_release_ref_mismatch');
  if (textValue(report?.release?.head) !== textValue(binding.release_head)) failures.push('release_intake_release_head_mismatch');
  if (path.resolve(textValue(report?.release?.repository)) !== path.resolve(textValue(binding.repository))) {
    failures.push('release_intake_repository_mismatch');
  }
  if (textValue(report?.integrity?.content_sha256) !== textValue(binding.content_sha256)) failures.push('release_intake_content_hash_mismatch');
  if (textValue(report?.scan_boundary?.baseline_commit) !== textValue(binding.baseline_commit)) {
    failures.push('release_intake_baseline_commit_mismatch');
  }
  failures.push(...releaseIntakeBaselineFailures(report));
  if (!/^[a-f0-9]{64}$/i.test(textValue(reportSha256))) {
    failures.push('release_intake_artifact_sha256_invalid');
  } else if (textValue(reportSha256).toLowerCase() !== textValue(binding.sha256).toLowerCase()) {
    failures.push('release_intake_artifact_sha256_mismatch');
  }
  const validation = validateQworkReleaseIntake(report, {
    releaseRef: binding.release_ref,
    releaseHead: binding.release_head,
    casebookSha256: plan?.casebook?.sha256,
    frameworkCommit: plan?.framework?.commit,
    requireReady: true,
    requireFreshRef: true,
    requireGitLabApiFreshness: true,
  });
  failures.push(...validation.failures.map((item) => `release_intake_${item}`));
  return { ok: failures.length === 0, failures: [...new Set(failures)], required: true };
}

export function validateQworkReleaseRefObservationBinding({ plan, report, reportSha256 = '' } = {}) {
  const binding = plan?.release_head_observation;
  const failures = releaseHeadObservationPlanBindingFailures(plan);
  if (failures.length) return { ok: false, failures };
  const validation = validateQworkReleaseRefObservation({
    report,
    reportPath: binding.path,
    reportSha256,
    expectedReleaseRef: binding.release_ref,
    expectedReleaseHead: binding.release_head,
  });
  failures.push(...validation.failures);
  if (nonEmptyString(reportSha256).toLowerCase() !== nonEmptyString(binding.sha256).toLowerCase()) {
    failures.push('release_observation_artifact_sha256_mismatch');
  }
  if (!sameCanonicalPath(report?.repository, plan?.release_intake?.repository)) {
    failures.push('release_observation_repository_mismatch');
  }
  if (!sameCanonicalPath(report?.repository, binding?.repository)) {
    failures.push('release_observation_repository_mismatch');
  }
  for (const key of ['schema_version', 'observed_at', 'release_ref', 'release_head', 'source']) {
    if (nonEmptyString(report?.[key]) !== nonEmptyString(binding?.[key])) {
      failures.push(`release_observation_${key}_mismatch`);
    }
  }
  return { ok: failures.length === 0, failures: [...new Set(failures)] };
}

function textValue(value) {
  return String(value ?? '').trim();
}

function validOrderedStringArray(value, { allowEmpty = false, sha256 = false } = {}) {
  return Array.isArray(value)
    && (allowEmpty || value.length > 0)
    && value.every((item) => {
      const normalized = nonEmptyString(item);
      return normalized && (!sha256 || /^[a-f0-9]{64}$/i.test(normalized));
    })
    && new Set(value.map((item) => nonEmptyString(item))).size === value.length;
}

function expectedExternalArtifactRoles(stage, phase) {
  if (stage?.kind === 'casebook' && phase === 'readiness') {
    return [
      `${stage.id}.readiness.capability_audit`,
      `${stage.id}.readiness.pretest`,
    ];
  }
  if (stage?.kind === 'casebook' && phase === 'completion') {
    return [
      `${stage.id}.completion.progress`,
      `${stage.id}.completion.summary`,
      `${stage.id}.completion.metadata`,
      `${stage.id}.completion.trusted_review`,
      `${stage.id}.completion.evidence_tree`,
    ];
  }
  return [];
}

function externalArtifactFailures(stage, phase, artifacts) {
  const failures = [];
  const expectedRoles = expectedExternalArtifactRoles(stage, phase);
  if (!Array.isArray(artifacts) || artifacts.length !== expectedRoles.length) {
    return ['external_artifacts_count_mismatch'];
  }
  const roles = artifacts.map((artifact) => nonEmptyString(artifact?.role));
  if (JSON.stringify(roles) !== JSON.stringify(expectedRoles)) {
    failures.push('external_artifact_roles_mismatch');
  }
  if (new Set(roles).size !== roles.length) failures.push('external_artifact_roles_not_unique');
  const paths = [];
  for (const artifact of artifacts) {
    const role = nonEmptyString(artifact?.role);
    const expectedType = role.endsWith('.evidence_tree') ? 'directory-tree' : 'file';
    if (!exactObjectKeys(artifact, ['role', 'path', 'sha256', 'type'])) {
      failures.push(`external_artifact_fields_mismatch:${role || 'missing'}`);
    }
    if (artifact?.type !== expectedType) failures.push(`external_artifact_type_mismatch:${role || 'missing'}`);
    if (!/^[a-f0-9]{64}$/i.test(nonEmptyString(artifact?.sha256))) {
      failures.push(`external_artifact_sha256_invalid:${role || 'missing'}`);
    }
    const inspection = inspectCanonicalArtifact(artifact?.path, expectedType);
    if (!inspection.ok) {
      failures.push(`external_artifact_path_invalid:${role || 'missing'}:${inspection.reason}`);
      continue;
    }
    paths.push(inspection.realpath);
    if (expectedType === 'file'
      && sha256File(inspection.realpath) !== nonEmptyString(artifact?.sha256).toLowerCase()) {
      failures.push(`external_artifact_sha256_mismatch:${role || 'missing'}`);
    }
  }
  if (new Set(paths).size !== paths.length) failures.push('external_artifact_paths_not_unique');
  return failures;
}

function normalizeExternalArtifacts(artifacts) {
  return Array.isArray(artifacts) ? artifacts.map((artifact) => ({
    role: nonEmptyString(artifact?.role),
    path: nonEmptyString(artifact?.path),
    sha256: nonEmptyString(artifact?.sha256).toLowerCase(),
    type: nonEmptyString(artifact?.type),
  })) : [];
}

function jsonArtifactPayloadFailures(artifacts, expectedPayloads) {
  const failures = [];
  const byRole = new Map(
    (Array.isArray(artifacts) ? artifacts : []).map((artifact) => [nonEmptyString(artifact?.role), artifact]),
  );
  for (const [role, expectedPayload] of Object.entries(expectedPayloads)) {
    const artifact = byRole.get(role);
    const inspection = inspectCanonicalArtifact(artifact?.path, 'file');
    if (!inspection.ok) continue;
    try {
      if (!stableEqual(readJsonFile(inspection.realpath), expectedPayload)) {
        failures.push(`external_artifact_payload_mismatch:${role}`);
      }
    } catch {
      failures.push(`external_artifact_json_unreadable:${role}`);
    }
  }
  return failures;
}

function capabilityAuditFailures(plan, stage, report = {}) {
  const failures = [];
  const caseIds = Array.isArray(report?.cases)
    ? report.cases.map((item) => nonEmptyString(item?.case_id))
    : [];
  const frozenIds = Array.isArray(stage.expected_case_ids) ? [...stage.expected_case_ids] : null;
  if (report?.schema_version !== 'qbot-core-beta-capability-audit/v2') {
    failures.push('capability_schema_mismatch');
  }
  if (report?.casebook?.path !== plan.casebook.path) failures.push('capability_casebook_path_mismatch');
  if (report?.casebook?.sha256 !== plan.casebook.sha256) failures.push('capability_casebook_sha_mismatch');
  if (report?.casebook?.sheet !== stage.sheet) failures.push('capability_sheet_mismatch');
  if (report?.casebook?.profile !== 'mandatory') failures.push('capability_profile_mismatch');
  if (report?.protocol?.case_count !== stage.expected_case_count) failures.push('capability_case_count_mismatch');
  if (report?.protocol?.executable_count !== stage.expected_case_count) failures.push('capability_executable_count_mismatch');
  if (report?.protocol?.ok !== true) failures.push('capability_protocol_not_ok');
  if (report?.runtime_dispatch?.dispatchable_count !== stage.expected_case_count) failures.push('capability_dispatch_count_mismatch');
  if (report?.runtime_dispatch?.ok !== true) failures.push('capability_runtime_dispatch_not_ok');
  if (report?.capability_summary?.directly_runnable_without_controller !== stage.expected_case_count) {
    failures.push('capability_directly_runnable_count_mismatch');
  }
  if (report?.capability_summary?.strict_controller_required !== 0) failures.push('strict_controller_present');
  if (report?.capability_summary?.unsupported_runtime !== 0) failures.push('unsupported_runtime_present');
  for (const [capabilityClass, expectedCount] of Object.entries(stage.expected_capability_classes || {})) {
    if (report?.capability_summary?.[capabilityClass] !== expectedCount) {
      failures.push(`capability_${capabilityClass}_count_mismatch`);
    }
  }
  if (caseIds.length !== stage.expected_case_count) failures.push('capability_case_id_count_mismatch');
  if (caseIds.some((id) => !id)) failures.push('capability_case_id_missing');
  if (new Set(caseIds).size !== stage.expected_case_count) failures.push('capability_case_ids_not_unique');
  if (frozenIds && JSON.stringify(caseIds) !== JSON.stringify(frozenIds)) {
    failures.push('capability_frozen_case_ids_mismatch');
  }
  if (Array.isArray(report?.cases) && report.cases.some((item) => item?.runtime_dispatchable !== true)) {
    failures.push('capability_undispatchable_case_present');
  }
  if (Array.isArray(report?.cases) && report.cases.some((item) => (
    !nonEmptyString(item?.case_type)
    || !nonEmptyString(item?.driver)
    || !nonEmptyString(item?.fixture_control)
    || !nonEmptyString(item?.executor_route)
    || !/^[a-f0-9]{64}$/i.test(nonEmptyString(item?.contract_sha256))
    || item?.protocol_ok !== true
    || item?.directly_runnable_without_controller !== true
    || !Number.isSafeInteger(item?.action_count) || item.action_count <= 0
    || !Number.isSafeInteger(item?.evidence_role_count) || item.evidence_role_count <= 0
    || !Number.isSafeInteger(item?.hard_oracle_count) || item.hard_oracle_count <= 0
  ))) failures.push('capability_case_contract_invalid');
  return failures;
}

function pretestFailures(plan, stage, report = {}) {
  const failures = [];
  const caseIds = Array.isArray(report?.casebook?.case_ids) ? report.casebook.case_ids : [];
  const checks = Array.isArray(report?.checks) ? report.checks : [];
  const checkIds = checks.map((check) => nonEmptyString(check?.id));
  if (report?.schema_version !== 'qbot-core-beta-pretest/v1') failures.push('pretest_schema_mismatch');
  if (report.status !== 'READY') failures.push(`pretest_status_${report.status || 'missing'}`);
  if (report?.lane !== 'teams') failures.push('pretest_lane_mismatch');
  if (report?.production_gate !== true) failures.push('pretest_production_gate_disabled');
  if (report.release_gate_eligible !== true) failures.push('pretest_not_release_gate_eligible');
  if (!Array.isArray(report.blockers) || report.blockers.length) failures.push('pretest_has_blockers');
  if (!checks.length) failures.push('pretest_checks_missing');
  if (checks.some((check) => check?.status !== 'passed')) failures.push('pretest_check_not_passed');
  if (checkIds.some((id) => !id) || new Set(checkIds).size !== checkIds.length) {
    failures.push('pretest_check_ids_invalid');
  }
  const missingChecks = REQUIRED_QWORK_PRETEST_CHECK_IDS.filter((id) => !checkIds.includes(id));
  if (missingChecks.length) failures.push(`pretest_required_checks_missing:${missingChecks.join(',')}`);
  if (report?.framework?.head !== plan.framework.commit) failures.push('pretest_framework_commit_mismatch');
  if (report?.framework?.origin_main !== plan.framework.commit) failures.push('pretest_origin_main_mismatch');
  if (nonEmptyString(report?.framework?.tracked_dirty)) failures.push('pretest_tracked_dirty');
  if (report?.casebook?.sha256 !== plan.casebook.sha256) failures.push('pretest_casebook_sha_mismatch');
  if (report?.casebook?.path !== plan.casebook.path) failures.push('pretest_casebook_path_mismatch');
  if (report?.casebook?.profile !== 'mandatory') failures.push('pretest_profile_mismatch');
  if (report?.casebook?.sheet !== stage.sheet) failures.push('pretest_sheet_mismatch');
  if (report?.casebook?.case_count !== stage.expected_case_count) failures.push('pretest_case_count_mismatch');
  if (report?.casebook?.expected_count !== stage.expected_case_count) failures.push('pretest_expected_count_mismatch');
  if (caseIds.length !== stage.expected_case_count) failures.push('pretest_case_id_count_mismatch');
  if (new Set(caseIds).size !== stage.expected_case_count) failures.push('pretest_case_ids_not_unique');
  if (report?.fixture?.ok !== true) failures.push('pretest_fixture_not_ready');
  const pretestIdentity = validateQworkReleaseIdentity(report?.release_identity?.expected || {});
  if (!pretestIdentity.ok) {
    failures.push(`pretest_release_identity_missing:${pretestIdentity.missing_fields.join(',')}`);
  }
  if (pretestIdentity.fingerprint !== plan.release_identity_sha256) {
    failures.push('pretest_release_identity_inputs_mismatch');
  }
  if (report?.release_identity?.fingerprint !== pretestIdentity.fingerprint
    || report?.release_identity?.fingerprint !== plan.release_identity_sha256) {
    failures.push('pretest_release_identity_fingerprint_mismatch');
  }
  const observedIdentity = validateQworkReleaseIdentity(report?.release_identity?.observed || {});
  if (!observedIdentity.ok || observedIdentity.fingerprint !== plan.release_identity_sha256) {
    failures.push('pretest_release_identity_observed_mismatch');
  }
  if (report?.release_identity?.observed_fingerprint !== observedIdentity.fingerprint) {
    failures.push('pretest_release_identity_observed_fingerprint_mismatch');
  }
  if (plan?.policy?.release_intake_required === true) {
    const intakeCheck = checks.find((check) => check?.id === 'qwork_release_intake');
    if (intakeCheck?.status !== 'passed') failures.push('pretest_release_intake_check_missing_or_failed');
    const intake = report?.release_intake;
    const binding = plan.release_intake || {};
    if (intake?.sha256 !== binding.sha256
      || intake?.content_sha256 !== binding.content_sha256
      || intake?.release_head !== binding.release_head) {
      failures.push('pretest_release_intake_binding_mismatch');
    }
  }
  const runtimeAssessment = report?.runtime?.qwork?.runtime_release_assessment;
  const controlPlaneHealth = report?.runtime?.control_plane_health;
  const publicCapabilities = report?.runtime?.teams_inspection?.public_capabilities;
  const runtimeReleaseStatus = report?.runtime?.qwork?.runtime_release_status;
  const artifactIdentity = report?.runtime?.qwork?.release_identity_readback;
  const artifactIdentityAssessment = report?.runtime?.qwork?.release_identity_assessment;
  if (publicCapabilities?.ok !== true || publicCapabilities?.value_type !== 'object') {
    failures.push('pretest_public_capabilities_not_readable');
  }
  if (controlPlaneHealth?.ok !== true
    || controlPlaneHealth?.http_ok !== true
    || controlPlaneHealth?.http_status !== 200
    || controlPlaneHealth?.ready !== true
    || controlPlaneHealth?.environment_matches !== true
    || controlPlaneHealth?.checks?.db !== true
    || controlPlaneHealth?.checks?.auth !== true
    || controlPlaneHealth?.auth?.ready !== true) {
    failures.push('pretest_control_plane_health_not_ready');
  }
  if (controlPlaneHealth?.control_plane_origin !== plan.release_identity.control_plane_origin) {
    failures.push('pretest_control_plane_health_origin_mismatch');
  }
  if (controlPlaneHealth?.backend_identity_matches !== true
    || controlPlaneHealth?.observed_backend_version !== plan.release_identity.backend_version) {
    failures.push('pretest_backend_identity_mismatch');
  }
  if (report?.runtime?.teams?.version !== plan.release_identity.teams_version
    || nonEmptyString(report?.runtime?.teams?.build) !== plan.release_identity.teams_build) {
    failures.push('pretest_teams_runtime_identity_mismatch');
  }
  if (report?.runtime?.qwork?.version !== plan.release_identity.qwork_version
    || !nonEmptyString(report?.runtime?.qwork?.url).includes(`/ui/${plan.release_identity.qwork_version}/index.html`)) {
    failures.push('pretest_qwork_runtime_identity_mismatch');
  }
  if (nonEmptyString(report?.runtime?.session?.control_plane_origin).replace(/\/$/, '')
    !== plan.release_identity.control_plane_origin) {
    failures.push('pretest_session_control_plane_mismatch');
  }
  if (runtimeReleaseStatus?.ok !== true
    || runtimeReleaseStatus?.value_type !== 'object'
    || runtimeReleaseStatus?.release_id !== plan.release_identity.qwork_version
    || runtimeReleaseStatus?.version !== plan.release_identity.qwork_version
    || runtimeReleaseStatus?.loaded_runtime?.release_id !== plan.release_identity.qwork_version
    || runtimeReleaseStatus?.loaded_runtime?.version !== plan.release_identity.qwork_version
    || runtimeReleaseStatus?.host_runtime_compatibility?.runtime_release_id !== plan.release_identity.qwork_version
    || runtimeReleaseStatus?.host_runtime_compatibility?.runtime_version !== plan.release_identity.qwork_version
    || runtimeReleaseStatus?.update_phase !== 'idle'
    || runtimeReleaseStatus?.prepared_release_present !== true
    || runtimeReleaseStatus?.prepared_release !== null) {
    failures.push('pretest_runtime_release_status_not_frozen');
  }
  if (runtimeAssessment?.release_identity_matches !== true) failures.push('pretest_runtime_identity_mismatch');
  if (runtimeAssessment?.update_activation_safe !== true) failures.push('pretest_runtime_update_not_safe');
  const expectedQworkArtifactIdentity = {
    qwork_version: plan.release_identity.qwork_version,
    prompt_policy_version: plan.release_identity.prompt_policy_version,
    feature_flags_hash: plan.release_identity.feature_flags_hash,
    qwork_ui_git_commit: plan.release_identity.qwork_ui_git_commit,
    qwork_build_id: plan.release_identity.qwork_build_id,
    qwork_release_manifest_sha256: plan.release_identity.qwork_release_manifest_sha256,
  };
  if (artifactIdentity?.schema_version !== 'qwork-release-identity-readback/v1'
    || artifactIdentity?.ok !== true
    || artifactIdentity?.consistency?.ok !== true
    || qworkReleaseIdentityFingerprint(artifactIdentity?.observed || {})
      !== qworkReleaseIdentityFingerprint(expectedQworkArtifactIdentity)) {
    failures.push('pretest_qwork_artifact_identity_not_authoritative');
  }
  if (artifactIdentityAssessment?.ok !== true
    || artifactIdentityAssessment?.readback_ok !== true
    || !Array.isArray(artifactIdentityAssessment?.mismatches)
    || artifactIdentityAssessment.mismatches.length !== 0) {
    failures.push('pretest_qwork_artifact_identity_expected_mismatch');
  }
  return failures;
}

function sealQworkCaseContracts(stage, capabilityAudit = {}, pretest = {}) {
  const failures = [];
  const capabilityRows = Array.isArray(capabilityAudit?.cases) ? capabilityAudit.cases : [];
  const requirements = Array.isArray(pretest?.fixture?.requirements)
    ? pretest.fixture.requirements
    : [];
  const expectedIds = Array.isArray(stage?.expected_case_ids) ? [...stage.expected_case_ids] : [];
  if (requirements.length !== stage?.expected_case_count) {
    failures.push('pretest_fixture_requirement_count_mismatch');
  }
  const requirementIds = requirements.map((requirement) => nonEmptyString(requirement?.case_id));
  if (JSON.stringify(requirementIds) !== JSON.stringify(expectedIds)) {
    failures.push('pretest_fixture_requirement_case_ids_mismatch');
  }
  if (new Set(requirementIds).size !== requirements.length) {
    failures.push('pretest_fixture_requirement_case_ids_not_unique');
  }
  const caseContracts = [];
  for (let index = 0; index < stage.expected_case_count; index += 1) {
    const capability = capabilityRows[index];
    const requirement = requirements[index];
    const caseId = expectedIds[index] || '';
    if (!capability || !requirement) continue;
    if (nonEmptyString(capability.case_id) !== caseId
      || nonEmptyString(requirement.case_id) !== caseId) {
      failures.push(`case_contract_case_id_mismatch:${caseId || index}`);
    }
    for (const field of ['driver', 'executor_route', 'contract_sha256']) {
      if (!nonEmptyString(requirement[field])
        || nonEmptyString(requirement[field]) !== nonEmptyString(capability[field])) {
        failures.push(`case_contract_${field}_mismatch:${caseId}`);
      }
    }
    if (!nonEmptyString(requirement.adapter)
      || nonEmptyString(requirement.adapter) !== nonEmptyString(capability.fixture_control)) {
      failures.push(`case_contract_adapter_mismatch:${caseId}`);
    }
    if (requirement.local_ready !== true) failures.push(`case_contract_not_locally_ready:${caseId}`);
    const actionIds = Array.isArray(requirement.action_ids)
      ? requirement.action_ids.map((value) => nonEmptyString(value)) : [];
    const evidenceRoles = Array.isArray(requirement.evidence_roles)
      ? requirement.evidence_roles.map((value) => nonEmptyString(value)) : [];
    const oracleSha256s = Array.isArray(requirement.oracle_sha256s)
      ? requirement.oracle_sha256s.map((value) => nonEmptyString(value).toLowerCase()) : [];
    if (!validOrderedStringArray(actionIds)
      || actionIds.length !== capability.action_count) {
      failures.push(`case_contract_action_ids_invalid:${caseId}`);
    }
    if (!validOrderedStringArray(evidenceRoles)
      || evidenceRoles.length !== capability.evidence_role_count) {
      failures.push(`case_contract_evidence_roles_invalid:${caseId}`);
    }
    if (!validOrderedStringArray(oracleSha256s, { sha256: true })
      || oracleSha256s.length !== capability.hard_oracle_count) {
      failures.push(`case_contract_oracle_sha256s_invalid:${caseId}`);
    }
    if (!/^[a-f0-9]{64}$/i.test(nonEmptyString(requirement.contract_sha256))) {
      failures.push(`case_contract_sha256_invalid:${caseId}`);
    }
    caseContracts.push({
      case_id: caseId,
      contract_version: 'qbot-core-beta/v2',
      case_type: nonEmptyString(capability.case_type),
      driver: nonEmptyString(requirement.driver),
      adapter: nonEmptyString(requirement.adapter),
      executor_route: nonEmptyString(requirement.executor_route),
      contract_sha256: nonEmptyString(requirement.contract_sha256).toLowerCase(),
      action_ids: actionIds,
      evidence_roles: evidenceRoles,
      oracle_sha256s: oracleSha256s,
    });
  }
  if (caseContracts.length !== stage?.expected_case_count) {
    failures.push('case_contract_seal_count_mismatch');
  }
  return {
    failures: [...new Set(failures)],
    case_contracts: caseContracts,
    case_contracts_sha256: qworkReleaseIdentityFingerprint(caseContracts),
  };
}

export function auditQworkStageReadiness({
  plan,
  stageId,
  capabilityAudit,
  pretest,
  expectedPrefixCaseIds,
  releaseIntake,
  releaseIntakeSha256 = '',
  externalArtifacts = [],
  generatedAt = new Date().toISOString(),
} = {}) {
  const stage = qworkReleaseStage(stageId);
  if (!stage || stage.kind !== 'casebook') throw new Error(`阶段 ${stageId || 'missing'} 不是 Casebook 阶段`);
  const failures = [
    ...validateCanonicalQworkReleaseTestPlan(plan).failures,
    ...capabilityAuditFailures(plan, stage, capabilityAudit),
    ...pretestFailures(plan, stage, pretest),
    ...externalArtifactFailures(stage, 'readiness', externalArtifacts),
    ...jsonArtifactPayloadFailures(externalArtifacts, {
      [`${stage.id}.readiness.capability_audit`]: capabilityAudit,
      [`${stage.id}.readiness.pretest`]: pretest,
    }),
  ];
  const intakeBinding = validateQworkReleaseIntakeBinding({ plan, report: releaseIntake, reportSha256: releaseIntakeSha256 });
  failures.push(...intakeBinding.failures);
  const capabilityCaseIds = Array.isArray(capabilityAudit?.cases)
    ? capabilityAudit.cases.map((item) => nonEmptyString(item?.case_id))
    : [];
  const pretestCaseIds = Array.isArray(pretest?.casebook?.case_ids) ? pretest.casebook.case_ids : [];
  if (JSON.stringify(pretestCaseIds) !== JSON.stringify(capabilityCaseIds)) {
    failures.push('pretest_capability_case_ids_mismatch');
  }
  const contractSeal = sealQworkCaseContracts(stage, capabilityAudit, pretest);
  failures.push(...contractSeal.failures);
  if (stage.id === 'G4') {
    const expectedPrefix = Array.isArray(expectedPrefixCaseIds) ? expectedPrefixCaseIds : [];
    if (expectedPrefix.length !== 70
      || JSON.stringify(capabilityCaseIds.slice(0, 70)) !== JSON.stringify(expectedPrefix)) {
      failures.push('full160_gray70_prefix_mismatch');
    }
  }
  return {
    schema_version: 'qbot-qwork-stage-readiness-audit/v1',
    generated_at: nonEmptyString(generatedAt),
    stage_id: stage.id,
    passed: failures.length === 0,
    decision: failures.length === 0 ? 'READY_TO_RUN' : 'BLOCKED',
    failures: [...new Set(failures)],
    expected: {
      sheet: stage.sheet,
      case_count: stage.expected_case_count,
      casebook_sha256: plan.casebook.sha256,
      framework_commit: plan.framework.commit,
      release_identity_sha256: plan.release_identity_sha256,
      release_intake: plan.release_intake || null,
      case_ids: capabilityCaseIds,
      case_contracts: contractSeal.case_contracts,
      case_contracts_sha256: contractSeal.case_contracts_sha256,
    },
    external_artifacts: normalizeExternalArtifacts(externalArtifacts),
  };
}

function trustedCount(review, key) {
  const aliases = {
    trusted_failure: ['trusted_failure', 'trusted_fail'],
    trusted_fail: ['trusted_fail', 'trusted_failure'],
    testcase_issue: ['testcase_issue', 'case_needs_update'],
    needs_review: ['needs_review', 'needs_llm_review'],
  };
  for (const candidate of aliases[key] || [key]) {
    const value = finiteNumber(review?.trusted_counts?.[candidate] ?? review?.counts?.[candidate]);
    if (value != null) return value;
  }
  return 0;
}

function pathInside(candidate, root) {
  const relative = path.relative(root, candidate);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function readinessSealFailures(plan, stage, audit) {
  const failures = [];
  if (!exactObjectKeys(audit, [
    'schema_version',
    'generated_at',
    'stage_id',
    'passed',
    'decision',
    'failures',
    'expected',
    'external_artifacts',
  ])) failures.push('readiness_audit_fields_mismatch');
  if (audit?.schema_version !== 'qbot-qwork-stage-readiness-audit/v1'
    || audit?.stage_id !== stage.id
    || audit?.passed !== true
    || audit?.decision !== 'READY_TO_RUN'
    || !Array.isArray(audit?.failures)
    || audit.failures.length !== 0
    || !validTimestamp(audit?.generated_at)) {
    failures.push('readiness_audit_not_passed');
  }
  failures.push(...externalArtifactFailures(stage, 'readiness', audit?.external_artifacts));
  const expected = audit?.expected;
  if (!exactObjectKeys(expected, [
    'sheet',
    'case_count',
    'casebook_sha256',
    'framework_commit',
    'release_identity_sha256',
    'release_intake',
    'case_ids',
    'case_contracts',
    'case_contracts_sha256',
  ])) failures.push('readiness_expected_fields_mismatch');
  const expectedIds = Array.isArray(stage.expected_case_ids) ? [...stage.expected_case_ids] : [];
  if (expected?.sheet !== stage.sheet
    || expected?.case_count !== stage.expected_case_count
    || expected?.casebook_sha256 !== plan.casebook.sha256
    || expected?.framework_commit !== plan.framework.commit
    || expected?.release_identity_sha256 !== plan.release_identity_sha256
    || !stableEqual(expected?.release_intake, plan.release_intake)
    || !stableEqual(expected?.case_ids, expectedIds)) {
    failures.push('readiness_expected_binding_mismatch');
  }
  const contracts = Array.isArray(expected?.case_contracts) ? expected.case_contracts : [];
  if (contracts.length !== stage.expected_case_count) failures.push('readiness_case_contract_count_mismatch');
  for (const [index, contract] of contracts.entries()) {
    const caseId = expectedIds[index] || '';
    if (!exactObjectKeys(contract, [
      'case_id',
      'contract_version',
      'case_type',
      'driver',
      'adapter',
      'executor_route',
      'contract_sha256',
      'action_ids',
      'evidence_roles',
      'oracle_sha256s',
    ])) failures.push(`readiness_case_contract_fields_mismatch:${caseId || index}`);
    if (contract?.case_id !== caseId
      || contract?.contract_version !== 'qbot-core-beta/v2'
      || !nonEmptyString(contract?.case_type)
      || !nonEmptyString(contract?.driver)
      || !nonEmptyString(contract?.adapter)
      || !nonEmptyString(contract?.executor_route)
      || !/^[a-f0-9]{64}$/i.test(nonEmptyString(contract?.contract_sha256))
      || !validOrderedStringArray(contract?.action_ids)
      || !validOrderedStringArray(contract?.evidence_roles)
      || !validOrderedStringArray(contract?.oracle_sha256s, { sha256: true })) {
      failures.push(`readiness_case_contract_invalid:${caseId || index}`);
    }
  }
  if (!/^[a-f0-9]{64}$/i.test(nonEmptyString(expected?.case_contracts_sha256))
    || expected?.case_contracts_sha256 !== qworkReleaseIdentityFingerprint(contracts)) {
    failures.push('readiness_case_contracts_sha256_mismatch');
  }
  return [...new Set(failures)];
}

function resultOracleSha256s(result = {}) {
  const hardOracles = Array.isArray(result?.precise_assertions?.hard_oracles)
    ? result.precise_assertions.hard_oracles
    : [];
  return hardOracles.map((oracle) => createHash('sha256')
    .update(String(oracle ?? ''), 'utf8')
    .digest('hex'));
}

function resultEvidenceFailures(result = {}, runDir = '', expectedContract = null) {
  const failures = [];
  const manifest = result.evidence_manifest;
  if (!expectedContract || typeof expectedContract !== 'object') {
    failures.push('expected_case_contract');
  } else {
    const actionIds = Array.isArray(result?.action_plan)
      ? result.action_plan.map((item) => nonEmptyString(item?.action_id)) : [];
    const resultRoles = Array.isArray(result?.evidence_roles)
      ? result.evidence_roles.map((role) => nonEmptyString(role)) : [];
    if (nonEmptyString(result?.id) !== expectedContract.case_id) failures.push('contract_case_id');
    if (nonEmptyString(result?.contract_version) !== expectedContract.contract_version) {
      failures.push('contract_version');
    }
    if (nonEmptyString(result?.case_type) !== expectedContract.case_type) failures.push('contract_case_type');
    if (nonEmptyString(result?.contract_sha256).toLowerCase() !== expectedContract.contract_sha256) {
      failures.push('contract_sha256');
    }
    if (JSON.stringify(actionIds) !== JSON.stringify(expectedContract.action_ids)) {
      failures.push('contract_action_ids');
    }
    if (JSON.stringify(resultOracleSha256s(result)) !== JSON.stringify(expectedContract.oracle_sha256s)) {
      failures.push('contract_oracle_sha256s');
    }
    if (JSON.stringify(resultRoles) !== JSON.stringify(expectedContract.evidence_roles)) {
      failures.push('declared_evidence_role_contract_mismatch');
    }
  }
  if (manifest?.schema_version !== 'qbot-core-evidence/v2') failures.push('schema');
  if (nonEmptyString(manifest?.case_id) !== nonEmptyString(result?.id)) failures.push('case_id');
  if (manifest?.complete !== true) failures.push('complete');
  if (!Array.isArray(manifest?.missing_roles) || manifest.missing_roles.length > 0) failures.push('missing_roles');
  if (!Array.isArray(manifest?.invalid_roles) || manifest.invalid_roles.length > 0) failures.push('invalid_roles');
  if (!Array.isArray(manifest?.not_applicable_roles)) failures.push('not_applicable_roles');
  const evidence = Array.isArray(manifest?.evidence) ? manifest.evidence : [];
  const evidenceRoles = evidence.map((item) => nonEmptyString(item?.role));
  const authoritativeRoles = Array.isArray(expectedContract?.evidence_roles)
    ? expectedContract.evidence_roles : [];
  if (JSON.stringify(evidenceRoles) !== JSON.stringify(authoritativeRoles)) {
    failures.push('evidence_role_contract_mismatch');
  }
  if (evidence.length === 0) failures.push('evidence');
  if (evidence.some((item) => !nonEmptyString(item?.role))) failures.push('evidence_role');
  if (new Set(evidence.map((item) => nonEmptyString(item?.role))).size !== evidence.length) {
    failures.push('evidence_role_duplicate');
  }
  if (evidence.some((item) => item?.valid !== true || item?.missing !== false)) {
    failures.push('evidence_validity');
  }
  if (evidence.some((item) => !Number.isSafeInteger(item?.bytes) || item.bytes <= 0)) {
    failures.push('evidence_bytes');
  }
  if (evidence.some((item) => !/^[a-f0-9]{64}$/i.test(nonEmptyString(item?.sha256)))) {
    failures.push('evidence_sha256');
  }
  const resolvedRunDir = nonEmptyString(runDir) ? path.resolve(runDir) : '';
  const resolvedCaseDir = nonEmptyString(result?.case_dir) ? path.resolve(result.case_dir) : '';
  if (!resolvedRunDir) {
    failures.push('run_dir');
  } else if (!safePathWithin(resolvedRunDir, path.dirname(resolvedRunDir), 'directory').ok) {
    failures.push('run_dir_type');
  } else if (!resolvedCaseDir || !pathInside(resolvedCaseDir, path.join(resolvedRunDir, 'cases'))) {
    failures.push('case_dir_boundary');
  } else {
    try {
      if (!safePathWithin(path.join(resolvedRunDir, 'cases'), resolvedRunDir, 'directory').ok
        || !safePathWithin(resolvedCaseDir, resolvedRunDir, 'directory').ok) failures.push('case_dir_type');
      const manifestFile = path.join(resolvedCaseDir, 'evidence-manifest.json');
      if (!safePathWithin(manifestFile, resolvedCaseDir, 'file').ok) failures.push('manifest_file_type');
      const diskManifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
      if (JSON.stringify(stableValue(diskManifest)) !== JSON.stringify(stableValue(manifest))) {
        failures.push('manifest_disk_mismatch');
      }
      const resultFile = path.join(resolvedCaseDir, 'case-result.json');
      if (!safePathWithin(resultFile, resolvedCaseDir, 'file').ok) failures.push('case_result_file_type');
      const diskResult = JSON.parse(fs.readFileSync(resultFile, 'utf8'));
      if (JSON.stringify(stableValue(diskResult)) !== JSON.stringify(stableValue(result))) {
        failures.push('case_result_disk_mismatch');
      }
    } catch {
      failures.push('case_artifacts_disk_unreadable');
    }
    for (const item of evidence) {
      const evidencePath = nonEmptyString(item?.path) ? path.resolve(item.path) : '';
      if (!evidencePath || !pathInside(evidencePath, resolvedCaseDir)) {
        failures.push('evidence_path_boundary');
        continue;
      }
      try {
        const inspection = safePathWithin(evidencePath, resolvedCaseDir, 'file');
        if (!inspection.ok) {
          failures.push('evidence_file_type');
          continue;
        }
        const stat = fs.lstatSync(evidencePath);
        if (stat.size !== item.bytes) failures.push('evidence_bytes_mismatch');
        const observedSha256 = createHash('sha256').update(fs.readFileSync(evidencePath)).digest('hex');
        if (observedSha256 !== nonEmptyString(item.sha256).toLowerCase()) {
          failures.push('evidence_sha256_mismatch');
        }
        const semanticValidation = validateEvidenceFile(nonEmptyString(item.role), evidencePath, {
          expectedCaseId: nonEmptyString(result?.id),
          expectedCaseDir: resolvedCaseDir,
        });
        if (!semanticValidation.valid) failures.push('evidence_semantic_validation_failed');
      } catch {
        failures.push('evidence_file_unreadable');
      }
    }
  }
  return failures;
}

function resultEvidenceComplete(result = {}, runDir = '', expectedContract = null) {
  return resultEvidenceFailures(result, runDir, expectedContract).length === 0;
}

export function auditQworkStageCompletion({
  plan,
  stageId,
  readinessAudit,
  progress,
  summary,
  trustedReview,
  runMetadata,
  runDir,
  trustedReviewPath = '',
  trustedReviewSha256 = '',
  externalArtifacts = [],
  generatedAt = new Date().toISOString(),
} = {}) {
  const stage = qworkReleaseStage(stageId);
  if (!stage || stage.kind !== 'casebook') throw new Error(`阶段 ${stageId || 'missing'} 不是 Casebook 阶段`);
  const failures = [
    ...validateCanonicalQworkReleaseTestPlan(plan).failures,
    ...readinessSealFailures(plan, stage, readinessAudit),
    ...externalArtifactFailures(stage, 'completion', externalArtifacts),
    ...jsonArtifactPayloadFailures(externalArtifacts, {
      [`${stage.id}.completion.progress`]: progress,
      [`${stage.id}.completion.summary`]: summary,
      [`${stage.id}.completion.metadata`]: runMetadata,
      [`${stage.id}.completion.trusted_review`]: trustedReview,
    }),
  ];
  const results = Array.isArray(progress?.results) ? progress.results : [];
  const reviewed = Array.isArray(trustedReview?.items)
    ? trustedReview.items
    : Array.isArray(trustedReview?.results) ? trustedReview.results : [];
  const expected = stage.expected_case_count;
  const expectedIds = Array.isArray(readinessAudit?.expected?.case_ids)
    ? readinessAudit.expected.case_ids : [];
  const expectedContracts = Array.isArray(readinessAudit?.expected?.case_contracts)
    ? readinessAudit.expected.case_contracts : [];
  const expectedContractById = new Map(
    expectedContracts.map((contract) => [nonEmptyString(contract?.case_id), contract]),
  );
  const resultIds = results.map((result) => nonEmptyString(result?.id));
  const summaryResults = Array.isArray(summary?.results) ? summary.results : [];
  const summaryResultIds = summaryResults.map((result) => nonEmptyString(result?.id));
  const reviewedIds = reviewed.map((result) => nonEmptyString(result?.id));
  const reviewTotal = finiteNumber(trustedReview?.scope?.total ?? trustedReview?.counts?.total);
  if (progress?.total !== expected) failures.push('progress_total_mismatch');
  if (progress?.completed !== expected) failures.push('progress_not_complete');
  if (results.length !== expected) failures.push('progress_result_count_mismatch');
  if (summaryResults.length !== expected) failures.push('summary_result_count_mismatch');
  if (summary?.status !== 'passed') failures.push('summary_status_not_passed');
  if (summary?.counts?.total !== expected) failures.push('summary_total_mismatch');
  if (summary?.counts?.passed !== expected) failures.push('summary_passed_count_mismatch');
  for (const key of ['failed', 'blocked', 'needs_llm_review', 'other']) {
    if (summary?.counts?.[key] !== 0) failures.push(`summary_${key}_must_be_zero`);
  }
  if (!summary?.ended_at) failures.push('summary_not_ended');
  if (summary?.stopped !== false) failures.push('summary_stopped_not_explicitly_false');
  if (summary?.framework_stop_diagnostic) failures.push('summary_has_framework_stop_diagnostic');
  const resolvedRunDir = nonEmptyString(runDir) ? path.resolve(runDir) : '';
  if (resolvedRunDir && fs.existsSync(path.join(resolvedRunDir, 'framework-stop-diagnostic.json'))) {
    failures.push('run_framework_stop_diagnostic_present');
  }
  if (Array.isArray(summary?.non_executed_diagnostics) && summary.non_executed_diagnostics.length) {
    failures.push('summary_has_non_executed_diagnostics');
  }
  if (summary?.result_accounting?.planned !== expected) failures.push('summary_planned_mismatch');
  if (summary?.result_accounting?.observed !== expected) failures.push('summary_observed_mismatch');
  if (summary?.result_accounting?.completed !== expected) failures.push('summary_completed_mismatch');
  if (summary?.result_accounting?.unexecuted !== 0) failures.push('summary_has_unexecuted_cases');
  if (summary?.result_accounting?.synthetic_diagnostics !== 0) failures.push('summary_has_synthetic_diagnostics');
  if (reviewed.length !== expected) failures.push('trusted_review_result_count_mismatch');
  if (reviewTotal !== expected) failures.push('trusted_review_scope_mismatch');
  const countContainers = [trustedReview?.trusted_counts, trustedReview?.counts]
    .filter((container) => container && typeof container === 'object' && !Array.isArray(container));
  const countAliases = (category) => ({
    trusted_failure: ['trusted_failure', 'trusted_fail'],
    trusted_fail: ['trusted_fail', 'trusted_failure'],
    testcase_issue: ['testcase_issue', 'case_needs_update'],
    needs_review: ['needs_review', 'needs_llm_review'],
  }[category] || [category]);
  const explicitCounts = (category) => countContainers.flatMap((container) => (
    countAliases(category)
      .filter((key) => Object.prototype.hasOwnProperty.call(container, key))
      .map((key) => finiteNumber(container[key]))
  ));
  if (trustedCount(trustedReview, 'trusted_pass') !== expected
    || explicitCounts('trusted_pass').some((value) => value !== expected)) {
    failures.push('trusted_pass_count_mismatch');
  }
  for (const category of TRUSTED_FAILURE_CATEGORIES) {
    if (trustedCount(trustedReview, category) !== 0
      || explicitCounts(category).some((value) => value !== 0)) failures.push(`${category}_must_be_zero`);
  }
  if (trustedReview?.production_release_gate?.all_trusted_pass !== true) {
    failures.push('trusted_review_release_gate_not_all_pass');
  }
  if (reviewed.some((item) => item?.trusted !== true)) {
    failures.push('trusted_review_untrusted_item_present');
  }
  if (reviewed.some((item) => {
    const classifications = [item?.trusted_status, item?.classification, item?.review_category, item?.final_category]
      .map((value) => nonEmptyString(value))
      .filter(Boolean);
    const allowed = new Set(['trusted_pass', '可信通过-用户可接受']);
    return classifications.length === 0 || classifications.some((classification) => !allowed.has(classification));
  })) failures.push('trusted_review_non_pass_item_present');
  if (reviewed.some((item) => {
    const classifications = [item?.trusted_status, item?.classification, item?.review_category, item?.final_category]
      .map((value) => nonEmptyString(value))
      .filter(Boolean);
    const normalized = new Set(classifications.map((classification) => (
      ['trusted_pass', '可信通过-用户可接受'].includes(classification)
        ? 'trusted_pass'
        : classification
    )));
    return normalized.size > 1;
  })) failures.push('trusted_review_classification_conflict');
  if (reviewed.some((item) => {
    const classifications = [item?.trusted_status, item?.classification, item?.review_category, item?.final_category]
      .map((value) => nonEmptyString(value))
      .filter(Boolean);
    return new Set(classifications).size > 1;
  })) failures.push('trusted_review_classification_conflict');
  for (const category of ['trusted_pass', ...TRUSTED_FAILURE_CATEGORIES]) {
    const aliases = {
      trusted_failure: ['trusted_failure', 'trusted_fail'],
      trusted_fail: ['trusted_fail', 'trusted_failure'],
      testcase_issue: ['testcase_issue', 'case_needs_update'],
      needs_review: ['needs_review', 'needs_llm_review'],
    }[category] || [category];
    if (!aliases.some((key) => finiteNumber(trustedReview?.trusted_counts?.[key] ?? trustedReview?.counts?.[key]) != null)) {
      failures.push(`trusted_review_count_missing:${category}`);
    }
  }
  const reviewInspection = nonEmptyString(runDir) && nonEmptyString(trustedReviewPath)
    ? safePathWithin(trustedReviewPath, runDir, 'file')
    : { ok: false };
  if (!reviewInspection.ok) {
    failures.push('trusted_review_file_invalid');
  } else {
    const diskSha256 = sha256File(trustedReviewPath);
    if (!/^[a-f0-9]{64}$/i.test(nonEmptyString(trustedReviewSha256))
      || diskSha256 !== nonEmptyString(trustedReviewSha256).toLowerCase()) {
      failures.push('trusted_review_sha256_mismatch');
    }
    try {
      if (JSON.stringify(stableValue(JSON.parse(fs.readFileSync(trustedReviewPath, 'utf8'))))
        !== JSON.stringify(stableValue(trustedReview))) failures.push('trusted_review_disk_mismatch');
    } catch {
      failures.push('trusted_review_file_unreadable');
    }
  }
  const invalidRawResult = (result) => result?.status !== 'passed' || result?.result_category !== 'pass';
  const invalidExecutionFlags = (result) => result?.execution_provenance !== 'executed'
    || result?.inherited !== false
    || result?.synthetic !== false
    || result?.case_execution_recorded !== true;
  if (results.some(invalidRawResult) || summaryResults.some(invalidRawResult)) {
    failures.push('raw_case_result_not_passed');
  }
  if (results.some(invalidExecutionFlags) || summaryResults.some(invalidExecutionFlags)) {
    failures.push('result_execution_flags_invalid');
  }
  if (results.some((result) => !resultEvidenceComplete(
    result,
    runDir,
    expectedContractById.get(nonEmptyString(result?.id)),
  ))) failures.push('evidence_manifest_incomplete');
  if (summaryResults.some((result) => !resultEvidenceComplete(
    result,
    runDir,
    expectedContractById.get(nonEmptyString(result?.id)),
  ))) {
    failures.push('summary_evidence_manifest_incomplete');
  }
  if (new Set(resultIds).size !== expected) failures.push('case_ids_not_unique');
  if (expectedIds.length !== expected) failures.push('expected_case_ids_missing');
  if (JSON.stringify(resultIds) !== JSON.stringify(expectedIds)) failures.push('result_case_ids_mismatch');
  if (JSON.stringify(summaryResultIds) !== JSON.stringify(expectedIds)) {
    failures.push('summary_result_case_ids_mismatch');
  }
  if (JSON.stringify(reviewedIds) !== JSON.stringify(expectedIds)) failures.push('review_case_ids_mismatch');
  if (JSON.stringify(runMetadata?.selected_case_ids || []) !== JSON.stringify(expectedIds)) {
    failures.push('run_selected_case_ids_mismatch');
  }
  if (nonEmptyString(runMetadata?.model_tier) !== plan.policy.model_tier) failures.push('run_model_tier_mismatch');
  if (nonEmptyString(summary?.model_tier) !== plan.policy.model_tier) failures.push('summary_model_tier_mismatch');
  if (runMetadata?.profile?.mode !== 'live') failures.push('run_host_profile_mode_mismatch');
  if (!nonEmptyString(runMetadata?.profile?.alias)) failures.push('run_host_profile_alias_missing');
  if (nonEmptyString(summary?.profile) !== 'mandatory') failures.push('summary_profile_mismatch');
  if (nonEmptyString(summary?.casebook) !== plan.casebook.path) failures.push('summary_casebook_path_mismatch');
  const concurrency = summary?.precheck?.execution_concurrency;
  if (concurrency?.policy !== 'core-beta-v2-forced-serial'
    || concurrency?.forced_serial !== true
    || concurrency?.effective_parallelism !== 1
    || concurrency?.effective_single_host_pipeline_size !== 1) {
    failures.push('run_forced_serial_policy_mismatch');
  }
  if (summary?.precheck?.single_host_pipeline?.effective_size !== 1) {
    failures.push('run_single_host_pipeline_mismatch');
  }
  if (nonEmptyString(runMetadata?.sources?.framework?.commit) !== plan.framework.commit) {
    failures.push('run_framework_commit_mismatch');
  }
  if (runMetadata?.sources?.framework?.dirty !== false) failures.push('run_framework_dirty');
  if (nonEmptyString(runMetadata?.artifacts?.casebook_sha256) !== plan.casebook.sha256) {
    failures.push('run_casebook_sha_mismatch');
  }
  const observedHostPids = Array.isArray(runMetadata?.observed_host_pids)
    ? runMetadata.observed_host_pids.filter((pid) => finiteNumber(pid) > 0)
    : [];
  if (new Set(observedHostPids).size !== 1) failures.push('run_single_host_identity_mismatch');
  const observedIdentity = validateQworkReleaseIdentity(runMetadata);
  if (!observedIdentity.ok) failures.push(`run_identity_missing:${observedIdentity.missing_fields.join(',')}`);
  if (observedIdentity.fingerprint !== plan.release_identity_sha256) failures.push('run_release_identity_mismatch');
  const releaseObservation = runMetadata?.release_observation;
  const expectedObservedQworkIdentity = {
    qwork_version: plan.release_identity.qwork_version,
    prompt_policy_version: plan.release_identity.prompt_policy_version,
    feature_flags_hash: plan.release_identity.feature_flags_hash,
    qwork_ui_git_commit: plan.release_identity.qwork_ui_git_commit,
    qwork_build_id: plan.release_identity.qwork_build_id,
    qwork_release_manifest_sha256: plan.release_identity.qwork_release_manifest_sha256,
  };
  if (releaseObservation?.schema_version !== 'qwork-release-identity-readback/v1'
    || releaseObservation?.ok !== true
    || releaseObservation?.consistency?.ok !== true
    || qworkReleaseIdentityFingerprint(releaseObservation?.observed || {})
      !== qworkReleaseIdentityFingerprint(expectedObservedQworkIdentity)) {
    failures.push('run_release_observation_invalid');
  }
  const requiredReleaseProvenance = [
    releaseObservation?.provenance?.state?.sha256,
    releaseObservation?.provenance?.envelope?.sha256,
    releaseObservation?.provenance?.release_set_digest,
    releaseObservation?.provenance?.host_core_digest,
    releaseObservation?.provenance?.ui_digest,
    releaseObservation?.provenance?.qbot_core_digest,
    releaseObservation?.provenance?.desktop_agent_runtime?.sha256,
    releaseObservation?.provenance?.ui_code_manifest?.sha256,
  ];
  if (requiredReleaseProvenance.some((value) => !nonEmptyString(value))) {
    failures.push('run_release_observation_provenance_incomplete');
  }
  const releaseObservationChecks = Array.isArray(runMetadata?.release_observation_checks)
    ? runMetadata.release_observation_checks
    : [];
  const releaseObservationPhases = new Set(
    releaseObservationChecks.map((item) => nonEmptyString(item?.phase)),
  );
  if (!releaseObservationPhases.has('startup') || !releaseObservationPhases.has('run-final')) {
    failures.push('run_release_observation_phases_incomplete');
  }
  if (releaseObservationChecks.some((item) => item?.ok !== true
    || nonEmptyString(item?.observed_sha256) !== nonEmptyString(releaseObservation?.observed_sha256)
    || nonEmptyString(item?.state_sha256) !== nonEmptyString(releaseObservation?.provenance?.state?.sha256)
    || nonEmptyString(item?.envelope_sha256) !== nonEmptyString(releaseObservation?.provenance?.envelope?.sha256))) {
    failures.push('run_release_observation_drift');
  }
  const evidenceTree = (Array.isArray(externalArtifacts) ? externalArtifacts : [])
    .find((artifact) => artifact?.role === `${stage.id}.completion.evidence_tree`);
  if (nonEmptyString(evidenceTree?.path) !== resolvedRunDir) {
    failures.push('completion_evidence_tree_run_dir_mismatch');
  }
  return {
    schema_version: 'qbot-qwork-stage-completion-audit/v1',
    generated_at: nonEmptyString(generatedAt),
    stage_id: stage.id,
    passed: failures.length === 0,
    decision: failures.length === 0 ? 'PASS_STAGE' : 'STOP_PIPELINE',
    failures: [...new Set(failures)],
    observed: {
      total: progress?.total ?? null,
      completed: progress?.completed ?? null,
      result_count: results.length,
      trusted_pass: trustedCount(trustedReview, 'trusted_pass'),
      trusted_non_pass: TRUSTED_FAILURE_CATEGORIES.reduce(
        (sum, category) => sum + trustedCount(trustedReview, category),
        0,
      ),
      evidence_complete: results.filter((result) => resultEvidenceComplete(
        result,
        runDir,
        expectedContractById.get(nonEmptyString(result?.id)),
      )).length,
      summary_evidence_complete: summaryResults.filter((result) => resultEvidenceComplete(
        result,
        runDir,
        expectedContractById.get(nonEmptyString(result?.id)),
      )).length,
      executed: results.filter((result) => result.execution_provenance === 'executed').length,
      inherited: results.filter((result) => result.inherited === true).length,
      synthetic: results.filter((result) => result.synthetic === true).length,
      release_identity_sha256: observedIdentity.fingerprint,
      case_ids: resultIds,
      case_contracts_sha256: nonEmptyString(readinessAudit?.expected?.case_contracts_sha256),
      case_ids_match: JSON.stringify(resultIds) === JSON.stringify(expectedIds)
        && JSON.stringify(reviewedIds) === JSON.stringify(expectedIds),
      trusted_review_path: reviewInspection.ok ? reviewInspection.realpath : '',
      trusted_review_sha256: nonEmptyString(trustedReviewSha256).toLowerCase(),
    },
    expected: {
      sheet: stage.sheet,
      case_count: stage.expected_case_count,
      case_ids: [...expectedIds],
      case_contracts_sha256: nonEmptyString(readinessAudit?.expected?.case_contracts_sha256),
      casebook_sha256: plan.casebook.sha256,
      framework_commit: plan.framework.commit,
      release_identity_sha256: plan.release_identity_sha256,
    },
    external_artifacts: normalizeExternalArtifacts(externalArtifacts),
  };
}

export function auditQworkSoakCompletion({
  plan,
  soak,
  soakReportPath = '',
  soakReportSha256 = '',
  externalArtifacts = [],
  generatedAt = new Date().toISOString(),
} = {}) {
  const stage = qworkReleaseStage('G5');
  const policy = {
    ...QWORK_SOAK_DEFAULT_POLICY,
    minimum_tasks: stage.minimum_tasks,
    minimum_restarts: stage.minimum_restarts,
    maximum_rss_growth_bytes: stage.maximum_rss_growth_bytes,
  };
  const strictAudit = readAndAuditQworkSoakReport({
    reportPath: soakReportPath,
    reportSha256: nonEmptyString(soakReportSha256).toLowerCase(),
    expectedReleaseIdentitySha256: plan?.release_identity_sha256,
    expectedReleaseIdentity: plan?.release_identity,
    expectedFrameworkCommit: plan?.framework?.commit,
    policy,
  });
  const failures = [...strictAudit.failures];
  let diskReport = null;
  try {
    diskReport = readJsonFile(path.resolve(nonEmptyString(soakReportPath)));
  } catch {
    // The strict reader already records the authoritative unreadable-report failure.
  }
  if (soak !== undefined && diskReport && !stableEqual(soak, diskReport)) {
    failures.push('soak_report_disk_mismatch');
  }
  const reportDescriptors = Array.isArray(diskReport?.external_artifacts)
    ? diskReport.external_artifacts
    : [];
  const expectedArtifacts = [
    {
      role: 'G5.soak.report',
      path: path.resolve(nonEmptyString(soakReportPath)),
      sha256: nonEmptyString(soakReportSha256).toLowerCase(),
      type: 'file',
    },
    ...reportDescriptors.map((descriptor, index) => ({
      role: `G5.soak.artifact.${String(index + 1).padStart(6, '0')}`,
      path: nonEmptyString(descriptor?.path),
      sha256: nonEmptyString(descriptor?.sha256).toLowerCase(),
      type: 'file',
    })),
  ];
  const normalizedArtifacts = normalizeExternalArtifacts(externalArtifacts);
  if (!stableEqual(normalizedArtifacts, expectedArtifacts)) {
    failures.push('soak_external_artifacts_mismatch');
  }
  const uniqueFailures = [...new Set(failures)];
  return {
    schema_version: 'qbot-qwork-soak-completion-audit/v1',
    generated_at: nonEmptyString(generatedAt),
    stage_id: 'G5',
    passed: uniqueFailures.length === 0,
    decision: uniqueFailures.length === 0 ? 'PASS_STAGE' : 'STOP_PIPELINE',
    failures: uniqueFailures,
    observed: structuredClone(strictAudit.observed || {}),
    external_artifacts: normalizedArtifacts,
  };
}

function validateAuditEnvelope(stage, audit, phase) {
  const failures = [];
  const expectedSchema = stage.kind === 'soak'
    ? 'qbot-qwork-soak-completion-audit/v1'
    : phase === 'readiness'
      ? 'qbot-qwork-stage-readiness-audit/v1'
      : 'qbot-qwork-stage-completion-audit/v1';
  if (audit?.schema_version !== expectedSchema) failures.push('audit_schema_mismatch');
  if (audit?.stage_id !== stage.id) failures.push('audit_stage_id_mismatch');
  if (!validTimestamp(audit?.generated_at)) failures.push('audit_generated_at_invalid');
  if (typeof audit?.passed !== 'boolean') failures.push('audit_passed_invalid');
  if (!Array.isArray(audit?.failures)
    || audit.failures.some((failure) => !nonEmptyString(failure))
    || new Set(audit.failures).size !== audit.failures.length) {
    failures.push('audit_failures_invalid');
  }
  if (audit?.passed === true && audit?.failures?.length !== 0) failures.push('audit_passed_with_failures');
  if (audit?.passed === false && audit?.failures?.length === 0) failures.push('audit_failed_without_failures');
  const expectedDecision = audit?.passed
    ? phase === 'readiness' ? 'READY_TO_RUN' : 'PASS_STAGE'
    : phase === 'readiness' ? 'BLOCKED' : 'STOP_PIPELINE';
  if (audit?.decision !== expectedDecision) failures.push('audit_decision_mismatch');
  return failures;
}

function artifactByRole(artifacts, role) {
  return (Array.isArray(artifacts) ? artifacts : []).find((artifact) => artifact?.role === role);
}

function replayCasebookAudit(plan, state, stage, audit, phase) {
  const artifacts = audit.external_artifacts;
  if (phase === 'readiness') {
    const capabilityArtifact = artifactByRole(artifacts, `${stage.id}.readiness.capability_audit`);
    const pretestArtifact = artifactByRole(artifacts, `${stage.id}.readiness.pretest`);
    const intakeArtifact = plan.source_artifacts.find((artifact) => artifact.role === 'release_intake');
    return auditQworkStageReadiness({
      plan,
      stageId: stage.id,
      capabilityAudit: readJsonFile(capabilityArtifact.path),
      pretest: readJsonFile(pretestArtifact.path),
      expectedPrefixCaseIds: stage.id === 'G4'
        ? state?.stages?.G3?.admission?.expected?.case_ids
        : undefined,
      releaseIntake: readJsonFile(intakeArtifact.path),
      releaseIntakeSha256: sha256File(intakeArtifact.path),
      externalArtifacts: artifacts,
      generatedAt: audit.generated_at,
    });
  }
  const progressArtifact = artifactByRole(artifacts, `${stage.id}.completion.progress`);
  const summaryArtifact = artifactByRole(artifacts, `${stage.id}.completion.summary`);
  const metadataArtifact = artifactByRole(artifacts, `${stage.id}.completion.metadata`);
  const reviewArtifact = artifactByRole(artifacts, `${stage.id}.completion.trusted_review`);
  const evidenceTreeArtifact = artifactByRole(artifacts, `${stage.id}.completion.evidence_tree`);
  return auditQworkStageCompletion({
    plan,
    stageId: stage.id,
    readinessAudit: state?.stages?.[stage.id]?.admission,
    progress: readJsonFile(progressArtifact.path),
    summary: readJsonFile(summaryArtifact.path),
    runMetadata: readJsonFile(metadataArtifact.path),
    trustedReview: readJsonFile(reviewArtifact.path),
    trustedReviewPath: reviewArtifact.path,
    trustedReviewSha256: sha256File(reviewArtifact.path),
    runDir: evidenceTreeArtifact.path,
    externalArtifacts: artifacts,
    generatedAt: audit.generated_at,
  });
}

function replaySoakAudit(plan, audit) {
  const artifacts = audit.external_artifacts;
  const reportArtifact = artifactByRole(artifacts, 'G5.soak.report');
  return auditQworkSoakCompletion({
    plan,
    soak: readJsonFile(reportArtifact.path),
    soakReportPath: reportArtifact.path,
    soakReportSha256: sha256File(reportArtifact.path),
    externalArtifacts: artifacts,
    generatedAt: audit.generated_at,
  });
}

export function applyQworkStageAudit(state, audit, {
  plan,
  phase,
  updatedAt = new Date().toISOString(),
  externalArtifacts,
} = {}) {
  const canonical = validateCanonicalQworkReleaseTestPlan(plan);
  if (!canonical.ok) {
    throw new Error(`QWork 发布测试计划无效：${canonical.failures.join(',')}`);
  }
  const stateFailures = qworkReleaseStateShapeFailures(plan, state);
  if (stateFailures.length) throw new Error(`不支持的发布测试状态：${stateFailures.join(',')}`);
  if (!validTimestamp(updatedAt)) throw new Error('发布测试状态更新时间无效');
  const stage = qworkReleaseStage(audit?.stage_id);
  if (!stage) throw new Error(`未知阶段：${audit?.stage_id || 'missing'}`);
  if (stage.id === 'G0') {
    throw new Error('G0 只能由 G1 readiness 的完整 G0 检查结果间接登记，不接受独立阶段审计');
  }
  if (stage.kind === 'casebook' && !['readiness', 'completion'].includes(phase)) {
    throw new Error(`${stage.id} 只接受 readiness 或 completion 审计`);
  }
  if (stage.kind === 'soak' && phase !== 'completion') {
    throw new Error(`${stage.id} Soak 只接受 completion 审计`);
  }
  const envelopeFailures = validateAuditEnvelope(stage, audit, phase);
  if (envelopeFailures.length) throw new Error(`${stage.id} 审计包无效：${envelopeFailures.join(',')}`);
  if (externalArtifacts && !stableEqual(
    normalizeExternalArtifacts(externalArtifacts),
    audit?.external_artifacts,
  )) throw new Error(`${stage.id} 审计外部制品绑定不一致`);
  if (stage.kind === 'casebook') {
    const expectedFields = phase === 'readiness'
      ? ['schema_version', 'generated_at', 'stage_id', 'passed', 'decision', 'failures', 'expected', 'external_artifacts']
      : ['schema_version', 'generated_at', 'stage_id', 'passed', 'decision', 'failures', 'observed', 'expected', 'external_artifacts'];
    if (!exactObjectKeys(audit, expectedFields)) throw new Error(`${stage.id} 审计字段集不匹配`);
    let replayed;
    try {
      replayed = replayCasebookAudit(plan, state, stage, audit, phase);
    } catch (error) {
      throw new Error(`${stage.id} 审计无法从外部制品重放：${error?.message || error}`);
    }
    if (!stableEqual(replayed, audit)) throw new Error(`${stage.id} 审计语义重放不一致`);
  } else {
    const expectedFields = [
      'schema_version',
      'generated_at',
      'stage_id',
      'passed',
      'decision',
      'failures',
      'observed',
      'external_artifacts',
    ];
    if (!exactObjectKeys(audit, expectedFields)) throw new Error(`${stage.id} 审计字段集不匹配`);
    let replayed;
    try {
      replayed = replaySoakAudit(plan, audit);
    } catch (error) {
      throw new Error(`${stage.id} 审计无法从外部制品重放：${error?.message || error}`);
    }
    if (!stableEqual(replayed, audit)) throw new Error(`${stage.id} 审计语义重放不一致`);
  }
  if (state.decision === 'NO_GO') throw new Error(`发布测试状态已冻结：${state.stop_reason || 'NO_GO'}`);
  const next = structuredClone(state);
  const prerequisitePassed = (phase === 'readiness' && stage.id === 'G1')
    || !stage.prerequisite
    || next.stages?.[stage.prerequisite]?.status === 'PASSED';
  if (!prerequisitePassed) {
    throw new Error(`${stage.id} 的前置阶段 ${stage.prerequisite} 尚未通过`);
  }
  if (phase === 'readiness') {
    if (next.stages[stage.id].status !== 'NOT_STARTED') {
      throw new Error(`${stage.id} 已登记状态 ${next.stages[stage.id].status}，不得覆盖准入`);
    }
    next.stages[stage.id].admission = audit;
    next.stages[stage.id].status = audit.passed ? 'READY' : 'BLOCKED';
    if (stage.id === 'G1') {
      next.stages.G0.status = audit.passed ? 'PASSED' : 'BLOCKED';
      next.stages.G0.completion = audit;
    }
  } else if (phase === 'completion') {
    if (stage.kind === 'casebook' && next.stages[stage.id].status !== 'READY') {
      throw new Error(`${stage.id} 未取得 READY_TO_RUN，不得登记执行结论`);
    }
    if (stage.kind !== 'casebook' && next.stages[stage.id].status !== 'NOT_STARTED') {
      throw new Error(`${stage.id} 已登记状态 ${next.stages[stage.id].status}，不得覆盖结论`);
    }
    next.stages[stage.id].completion = audit;
    next.stages[stage.id].status = audit.passed ? 'PASSED' : 'STOPPED';
  } else {
    throw new Error(`未知阶段审计 phase：${phase || 'missing'}`);
  }
  if (!audit.passed) {
    next.decision = 'NO_GO';
    next.stop_reason = `${stage.id}:${audit.failures?.[0] || 'stage_failed'}`;
    let found = false;
    for (const candidate of QWORK_RELEASE_TEST_STAGES) {
      if (candidate.id === stage.id) {
        found = true;
        continue;
      }
      if (found) next.stages[candidate.id].status = 'NOT_STARTED';
    }
  } else if (stage.id === 'G5' && phase === 'completion') {
    next.decision = 'ELIGIBLE_FOR_MULTI_RUN_GRAY_GATE';
    next.stop_reason = '';
  } else {
    next.decision = 'CONTINUE';
    next.stop_reason = '';
  }
  next.revision = state.revision + 1;
  next.updated_at = nonEmptyString(updatedAt);
  return next;
}
