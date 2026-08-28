import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export const QWORK_RELEASE_TEST_PLAN_SCHEMA = 'qbot-qwork-release-test-plan/v1';
export const QWORK_RELEASE_TEST_STATE_SCHEMA = 'qbot-qwork-release-test-state/v1';
export const QWORK_RELEASE_TEST_INTEGRITY_SCHEMA = 'qbot-qwork-release-test-integrity/v1';
export const QWORK_RELEASE_CASEBOOK_BASENAME = 'QBot核心生命线与新增MR生产灰度全量回归Casebook_16-12-70-160条_2026-08-28-r5.xlsx';
export const QWORK_RELEASE_CASEBOOK_SHA256 = '4fe630f16f12cb84bf4a214f179ad31b83d04491e0ccebb81a6dcdafc5d9516c';

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
    expected_capability_classes: {
      runner_native: 60,
      runner_native_with_fixture_option: 1,
      runner_legacy_verified: 99,
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
  'frozen_product_identity_complete',
  'frozen_product_identity_hashes',
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

export function createQworkReleaseTestPlan({
  casebookPath,
  casebookSha256,
  frameworkCommit,
  releaseIdentity,
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
  if (!identityAudit.ok) errors.push(`release_identity_missing:${identityAudit.missing_fields.join(',')}`);
  if (identityAudit.invalid_fields.length) {
    errors.push(`release_identity_invalid:${identityAudit.invalid_fields.join(',')}`);
  }
  if (errors.length) throw new Error(`QWork 发布测试计划输入无效：${errors.join('；')}`);
  return {
    schema_version: QWORK_RELEASE_TEST_PLAN_SCHEMA,
    created_at: new Date().toISOString(),
    casebook: {
      path: nonEmptyString(casebookPath),
      sha256: nonEmptyString(casebookSha256).toLowerCase(),
    },
    framework: { commit: nonEmptyString(frameworkCommit).toLowerCase() },
    release_identity: identityAudit.identity,
    release_identity_sha256: identityAudit.fingerprint,
    policy: {
      case_execution: 'single-runner-forced-serial',
      model_tier: 'M3',
      inherited: 0,
      synthetic: 0,
      admission_source: 'trusted-review-only',
      stop_on_non_pass: true,
      immutable_stage_outputs: true,
    },
    stages: QWORK_RELEASE_TEST_STAGES.map((stage) => ({ ...stage })),
  };
}

export function createQworkReleaseTestState(plan) {
  if (plan?.schema_version !== QWORK_RELEASE_TEST_PLAN_SCHEMA) {
    throw new Error(`不支持的发布测试计划：${plan?.schema_version || 'missing'}`);
  }
  return {
    schema_version: QWORK_RELEASE_TEST_STATE_SCHEMA,
    plan_sha256: qworkReleaseIdentityFingerprint(plan),
    revision: 0,
    updated_at: new Date().toISOString(),
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

export function createQworkReleaseTestIntegrity(plan, state, {
  eventCount = 0,
  lastEventSha256 = '',
} = {}) {
  return {
    schema_version: QWORK_RELEASE_TEST_INTEGRITY_SCHEMA,
    plan_sha256: qworkReleaseIdentityFingerprint(plan),
    state_sha256: qworkReleaseIdentityFingerprint(state),
    state_revision: Number(state?.revision || 0),
    event_count: Number(eventCount),
    last_event_sha256: nonEmptyString(lastEventSha256),
    updated_at: new Date().toISOString(),
  };
}

export function validateQworkReleaseControlState({ plan, state, integrity } = {}) {
  const failures = [];
  const planSha256 = qworkReleaseIdentityFingerprint(plan);
  const stateSha256 = qworkReleaseIdentityFingerprint(state);
  if (plan?.schema_version !== QWORK_RELEASE_TEST_PLAN_SCHEMA) failures.push('plan_schema_mismatch');
  if (state?.schema_version !== QWORK_RELEASE_TEST_STATE_SCHEMA) failures.push('state_schema_mismatch');
  if (integrity?.schema_version !== QWORK_RELEASE_TEST_INTEGRITY_SCHEMA) {
    failures.push('integrity_schema_mismatch');
  }
  if (state?.plan_sha256 !== planSha256) failures.push('state_plan_sha256_mismatch');
  if (integrity?.plan_sha256 !== planSha256) failures.push('integrity_plan_sha256_mismatch');
  if (integrity?.state_sha256 !== stateSha256) failures.push('integrity_state_sha256_mismatch');
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

function capabilityAuditFailures(plan, stage, report = {}) {
  const failures = [];
  const caseIds = Array.isArray(report?.cases)
    ? report.cases.map((item) => nonEmptyString(item?.case_id))
    : [];
  const frozenIds = Array.isArray(stage.expected_case_ids) ? [...stage.expected_case_ids] : null;
  if (report?.schema_version !== 'qbot-core-beta-capability-audit/v2') {
    failures.push('capability_schema_mismatch');
  }
  if (report?.casebook?.sha256 !== plan.casebook.sha256) failures.push('capability_casebook_sha_mismatch');
  if (report?.casebook?.sheet !== stage.sheet) failures.push('capability_sheet_mismatch');
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
  const pretestIdentity = validateQworkReleaseIdentity(report?.release_identity?.expected || {});
  if (!pretestIdentity.ok) {
    failures.push(`pretest_release_identity_missing:${pretestIdentity.missing_fields.join(',')}`);
  }
  if (pretestIdentity.fingerprint !== plan.release_identity_sha256
    || JSON.stringify(pretestIdentity.identity) !== JSON.stringify(plan.release_identity)) {
    failures.push('pretest_release_identity_inputs_mismatch');
  }
  if (report?.release_identity?.fingerprint !== pretestIdentity.fingerprint
    || report?.release_identity?.fingerprint !== plan.release_identity_sha256) {
    failures.push('pretest_release_identity_fingerprint_mismatch');
  }
  const runtimeAssessment = report?.runtime?.qwork?.runtime_release_assessment;
  const controlPlaneHealth = report?.runtime?.control_plane_health;
  const publicCapabilities = report?.runtime?.teams_inspection?.public_capabilities;
  const runtimeReleaseStatus = report?.runtime?.qwork?.runtime_release_status;
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
  return failures;
}

export function auditQworkStageReadiness({
  plan,
  stageId,
  capabilityAudit,
  pretest,
  expectedPrefixCaseIds,
} = {}) {
  const stage = qworkReleaseStage(stageId);
  if (!stage || stage.kind !== 'casebook') throw new Error(`阶段 ${stageId || 'missing'} 不是 Casebook 阶段`);
  const failures = [
    ...capabilityAuditFailures(plan, stage, capabilityAudit),
    ...pretestFailures(plan, stage, pretest),
  ];
  const capabilityCaseIds = Array.isArray(capabilityAudit?.cases)
    ? capabilityAudit.cases.map((item) => nonEmptyString(item?.case_id))
    : [];
  const pretestCaseIds = Array.isArray(pretest?.casebook?.case_ids) ? pretest.casebook.case_ids : [];
  if (JSON.stringify(pretestCaseIds) !== JSON.stringify(capabilityCaseIds)) {
    failures.push('pretest_capability_case_ids_mismatch');
  }
  if (stage.id === 'G4') {
    const expectedPrefix = Array.isArray(expectedPrefixCaseIds) ? expectedPrefixCaseIds : [];
    if (expectedPrefix.length !== 70
      || JSON.stringify(capabilityCaseIds.slice(0, 70)) !== JSON.stringify(expectedPrefix)) {
      failures.push('full160_gray70_prefix_mismatch');
    }
  }
  return {
    schema_version: 'qbot-qwork-stage-readiness-audit/v1',
    generated_at: new Date().toISOString(),
    stage_id: stage.id,
    passed: failures.length === 0,
    decision: failures.length === 0 ? 'READY_TO_RUN' : 'BLOCKED',
    failures,
    expected: {
      sheet: stage.sheet,
      case_count: stage.expected_case_count,
      casebook_sha256: plan.casebook.sha256,
      framework_commit: plan.framework.commit,
      release_identity_sha256: plan.release_identity_sha256,
      case_ids: capabilityCaseIds,
    },
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

function resultEvidenceFailures(result = {}, runDir = '') {
  const failures = [];
  const manifest = result.evidence_manifest;
  if (manifest?.schema_version !== 'qbot-core-evidence/v2') failures.push('schema');
  if (nonEmptyString(manifest?.case_id) !== nonEmptyString(result?.id)) failures.push('case_id');
  if (manifest?.complete !== true) failures.push('complete');
  if (!Array.isArray(manifest?.missing_roles) || manifest.missing_roles.length > 0) failures.push('missing_roles');
  if (!Array.isArray(manifest?.invalid_roles) || manifest.invalid_roles.length > 0) failures.push('invalid_roles');
  if (!Array.isArray(manifest?.not_applicable_roles)) failures.push('not_applicable_roles');
  const evidence = Array.isArray(manifest?.evidence) ? manifest.evidence : [];
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
  } else if (!resolvedCaseDir || !pathInside(resolvedCaseDir, path.join(resolvedRunDir, 'cases'))) {
    failures.push('case_dir_boundary');
  } else {
    try {
      const caseDirStat = fs.lstatSync(resolvedCaseDir);
      if (!caseDirStat.isDirectory() || caseDirStat.isSymbolicLink()) failures.push('case_dir_type');
      const manifestFile = path.join(resolvedCaseDir, 'evidence-manifest.json');
      const manifestStat = fs.lstatSync(manifestFile);
      if (!manifestStat.isFile() || manifestStat.isSymbolicLink()) failures.push('manifest_file_type');
      const diskManifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
      if (JSON.stringify(stableValue(diskManifest)) !== JSON.stringify(stableValue(manifest))) {
        failures.push('manifest_disk_mismatch');
      }
    } catch {
      failures.push('manifest_disk_unreadable');
    }
    for (const item of evidence) {
      const evidencePath = nonEmptyString(item?.path) ? path.resolve(item.path) : '';
      if (!evidencePath || !pathInside(evidencePath, resolvedCaseDir)) {
        failures.push('evidence_path_boundary');
        continue;
      }
      try {
        const stat = fs.lstatSync(evidencePath);
        if (!stat.isFile() || stat.isSymbolicLink()) {
          failures.push('evidence_file_type');
          continue;
        }
        if (stat.size !== item.bytes) failures.push('evidence_bytes_mismatch');
        const observedSha256 = createHash('sha256').update(fs.readFileSync(evidencePath)).digest('hex');
        if (observedSha256 !== nonEmptyString(item.sha256).toLowerCase()) {
          failures.push('evidence_sha256_mismatch');
        }
      } catch {
        failures.push('evidence_file_unreadable');
      }
    }
  }
  return failures;
}

function resultEvidenceComplete(result = {}, runDir = '') {
  return resultEvidenceFailures(result, runDir).length === 0;
}

export function auditQworkStageCompletion({
  plan,
  stageId,
  progress,
  summary,
  trustedReview,
  runMetadata,
  expectedCaseIds,
  runDir,
} = {}) {
  const stage = qworkReleaseStage(stageId);
  if (!stage || stage.kind !== 'casebook') throw new Error(`阶段 ${stageId || 'missing'} 不是 Casebook 阶段`);
  const failures = [];
  const results = Array.isArray(progress?.results) ? progress.results : [];
  const reviewed = Array.isArray(trustedReview?.items)
    ? trustedReview.items
    : Array.isArray(trustedReview?.results) ? trustedReview.results : [];
  const expected = stage.expected_case_count;
  const expectedIds = Array.isArray(expectedCaseIds) ? expectedCaseIds : [];
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
  if (summary?.stopped === true) failures.push('summary_stopped');
  if (summary?.framework_stop_diagnostic) failures.push('summary_has_framework_stop_diagnostic');
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
  if (trustedCount(trustedReview, 'trusted_pass') !== expected) failures.push('trusted_pass_count_mismatch');
  for (const category of TRUSTED_FAILURE_CATEGORIES) {
    if (trustedCount(trustedReview, category) !== 0) failures.push(`${category}_must_be_zero`);
  }
  if (trustedReview?.production_release_gate?.all_trusted_pass !== true) {
    failures.push('trusted_review_release_gate_not_all_pass');
  }
  if (reviewed.some((item) => item?.trusted !== true && item?.trusted != null)) {
    failures.push('trusted_review_untrusted_item_present');
  }
  if (reviewed.some((item) => {
    const classification = nonEmptyString(item?.trusted_status || item?.classification || item?.review_category);
    return classification && !['trusted_pass', '可信通过-用户可接受'].includes(classification);
  })) failures.push('trusted_review_non_pass_item_present');
  if (results.some((result) => result.execution_provenance !== 'executed')) {
    failures.push('non_executed_result_present');
  }
  if (results.some((result) => result.synthetic === true)) failures.push('synthetic_result_present');
  if (results.some((result) => result.inherited === true)) failures.push('inherited_result_present');
  if (results.some((result) => !resultEvidenceComplete(result, runDir))) failures.push('evidence_manifest_incomplete');
  if (summaryResults.some((result) => !resultEvidenceComplete(result, runDir))) {
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
  return {
    schema_version: 'qbot-qwork-stage-completion-audit/v1',
    generated_at: new Date().toISOString(),
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
      evidence_complete: results.filter((result) => resultEvidenceComplete(result, runDir)).length,
      summary_evidence_complete: summaryResults.filter((result) => resultEvidenceComplete(result, runDir)).length,
      executed: results.filter((result) => result.execution_provenance === 'executed').length,
      inherited: results.filter((result) => result.inherited === true).length,
      synthetic: results.filter((result) => result.synthetic === true).length,
      release_identity_sha256: observedIdentity.fingerprint,
      case_ids_match: JSON.stringify(resultIds) === JSON.stringify(expectedIds)
        && JSON.stringify(reviewedIds) === JSON.stringify(expectedIds),
    },
  };
}

export function auditQworkSoakCompletion({ plan, soak } = {}) {
  const stage = qworkReleaseStage('G5');
  const failures = [];
  if (finiteNumber(soak?.tasks_completed) < stage.minimum_tasks) failures.push('soak_tasks_below_minimum');
  if (finiteNumber(soak?.restart_count) < stage.minimum_restarts) failures.push('soak_restarts_below_minimum');
  if (finiteNumber(soak?.crash_count) !== 0) failures.push('soak_crash_count_not_zero');
  if (soak?.resource_leak_detected !== false) failures.push('soak_resource_leak_not_proven_absent');
  if (!strictTrue(soak?.evidence_complete)) failures.push('soak_evidence_incomplete');
  if (!strictTrue(soak?.passed)) failures.push('soak_not_passed');
  if (nonEmptyString(soak?.release_identity_sha256) !== plan.release_identity_sha256) {
    failures.push('soak_release_identity_mismatch');
  }
  return {
    schema_version: 'qbot-qwork-soak-completion-audit/v1',
    generated_at: new Date().toISOString(),
    stage_id: 'G5',
    passed: failures.length === 0,
    decision: failures.length === 0 ? 'PASS_STAGE' : 'STOP_PIPELINE',
    failures,
    observed: soak || {},
  };
}

export function applyQworkStageAudit(state, audit, { phase } = {}) {
  if (state?.schema_version !== QWORK_RELEASE_TEST_STATE_SCHEMA) {
    throw new Error(`不支持的发布测试状态：${state?.schema_version || 'missing'}`);
  }
  const stage = qworkReleaseStage(audit?.stage_id);
  if (!stage) throw new Error(`未知阶段：${audit?.stage_id || 'missing'}`);
  const expectedAuditSchema = stage.kind === 'soak'
    ? 'qbot-qwork-soak-completion-audit/v1'
    : phase === 'readiness'
      ? 'qbot-qwork-stage-readiness-audit/v1'
      : 'qbot-qwork-stage-completion-audit/v1';
  const expectedDecision = audit?.passed
    ? phase === 'readiness' ? 'READY_TO_RUN' : 'PASS_STAGE'
    : phase === 'readiness' ? 'BLOCKED' : 'STOP_PIPELINE';
  if (audit?.schema_version !== expectedAuditSchema) {
    throw new Error(`${stage.id} 审计 schema 不匹配：${audit?.schema_version || 'missing'}`);
  }
  if (typeof audit?.passed !== 'boolean' || audit?.decision !== expectedDecision) {
    throw new Error(`${stage.id} 审计结论自相矛盾：passed=${audit?.passed} decision=${audit?.decision || 'missing'}`);
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
  next.updated_at = new Date().toISOString();
  return next;
}
