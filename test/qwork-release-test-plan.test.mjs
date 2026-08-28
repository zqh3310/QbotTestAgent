import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  QWORK_RELEASE_TEST_STAGES,
  applyQworkStageAudit,
  auditQworkSoakCompletion,
  auditQworkStageCompletion,
  auditQworkStageReadiness,
  createQworkReleaseTestIntegrity,
  createQworkReleaseTestPlan,
  createQworkReleaseTestState,
  QWORK_RELEASE_CASEBOOK_BASENAME,
  QWORK_RELEASE_CASEBOOK_SHA256,
  QWORK_CORE_LIFELINE_CASE_IDS,
  QWORK_MR_SMOKE_CASE_IDS,
  validateQworkReleaseControlState,
} from '../src/lib/qwork-release-test-plan.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const orchestrator = path.join(root, 'scripts', 'orchestrate-qwork-release-test.mjs');
const evidenceFixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'qwork-release-evidence-'));
test.after(() => fs.rmSync(evidenceFixtureRoot, { recursive: true, force: true }));

const identity = {
  teams_version: '5.6.1',
  teams_build: '2119082788',
  qwork_version: '0.1.6-sit.15',
  control_plane_origin: 'https://deepbank-control-sit.sandbox.deepbank.daikuan.qihoo.net',
  backend_version: 'sit-health-ae3b6cafbc5ed123',
  prompt_policy_version: 'qwork-runtime-sit.15-sha256-example',
  feature_flags_hash: '1'.repeat(64),
  qwork_ui_git_commit: 'b7fff18d',
  qwork_build_id: '0.1.6-sit.15',
  qwork_release_manifest_sha256: '2'.repeat(64),
};

const plan = createQworkReleaseTestPlan({
  casebookPath: path.join('/tmp', QWORK_RELEASE_CASEBOOK_BASENAME),
  casebookSha256: QWORK_RELEASE_CASEBOOK_SHA256,
  frameworkCommit: 'b'.repeat(40),
  releaseIdentity: identity,
});

test('orchestrator exposes top-level help', () => {
  const result = spawnSync(process.execPath, [orchestrator, '--help'], {
    cwd: root,
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /QWork 发布测试阶段编排器/);
  assert.match(result.stdout, /G1\|G2\|G3\|G4/);
  assert.match(result.stdout, /trusted_pass=N/);
});

function capability(stageId, sourcePlan = plan) {
  const stage = QWORK_RELEASE_TEST_STAGES.find((item) => item.id === stageId);
  const caseIds = stage.expected_case_ids
    ? [...stage.expected_case_ids]
    : Array.from({ length: stage.expected_case_count }, (_, index) => `${stageId}-CASE-${index + 1}`);
  return {
    schema_version: 'qbot-core-beta-capability-audit/v2',
    casebook: { sha256: sourcePlan.casebook.sha256, sheet: stage.sheet },
    protocol: {
      ok: true,
      case_count: stage.expected_case_count,
      executable_count: stage.expected_case_count,
    },
    runtime_dispatch: { ok: true, dispatchable_count: stage.expected_case_count },
    capability_summary: {
      directly_runnable_without_controller: stage.expected_case_count,
      strict_controller_required: 0,
      unsupported_runtime: 0,
      ...stage.expected_capability_classes,
    },
    cases: caseIds.map((caseId) => ({ case_id: caseId, runtime_dispatchable: true })),
  };
}

function pretest(stageId, sourcePlan = plan) {
  const stage = QWORK_RELEASE_TEST_STAGES.find((item) => item.id === stageId);
  const caseIds = capability(stageId, sourcePlan).cases.map((item) => item.case_id);
  return {
    schema_version: 'qbot-core-beta-pretest/v1',
    status: 'READY',
    lane: 'teams',
    production_gate: true,
    release_gate_eligible: true,
    blockers: [],
    checks: [
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
    ].map((id) => ({ id, status: 'passed', detail: 'test fixture' })),
    framework: {
      head: sourcePlan.framework.commit,
      origin_main: sourcePlan.framework.commit,
      tracked_dirty: '',
    },
    casebook: {
      path: sourcePlan.casebook.path,
      profile: 'mandatory',
      sha256: sourcePlan.casebook.sha256,
      sheet: stage.sheet,
      case_count: stage.expected_case_count,
      expected_count: stage.expected_case_count,
      case_ids: caseIds,
    },
    release_identity: {
      expected: structuredClone(sourcePlan.release_identity),
      observed: structuredClone(sourcePlan.release_identity),
      fingerprint: sourcePlan.release_identity_sha256,
      observed_fingerprint: sourcePlan.release_identity_sha256,
    },
    runtime: {
      teams: {
        version: sourcePlan.release_identity.teams_version,
        build: sourcePlan.release_identity.teams_build,
      },
      session: {
        control_plane_origin: sourcePlan.release_identity.control_plane_origin,
      },
      teams_inspection: {
        public_capabilities: { ok: true, value_type: 'object' },
      },
      control_plane_health: {
        ok: true,
        control_plane_origin: sourcePlan.release_identity.control_plane_origin,
        http_ok: true,
        http_status: 200,
        ready: true,
        environment: 'sit',
        expected_environment: 'sit',
        environment_matches: true,
        fingerprint: 'ae3b6cafbc5ed123',
        observed_backend_version: sourcePlan.release_identity.backend_version,
        expected_backend_version: sourcePlan.release_identity.backend_version,
        backend_identity_matches: true,
        checks: { db: true, auth: true },
        auth: { ready: true, provider_id: 'lingxi', can_login: true },
      },
      qwork: {
        version: sourcePlan.release_identity.qwork_version,
        url: `file:///tmp/ui/${sourcePlan.release_identity.qwork_version}/index.html`,
        runtime_release_status: {
          ok: true,
          value_type: 'object',
          release_id: sourcePlan.release_identity.qwork_version,
          version: sourcePlan.release_identity.qwork_version,
          update_phase: 'idle',
          prepared_release_present: true,
          prepared_release: null,
          loaded_runtime: {
            release_id: sourcePlan.release_identity.qwork_version,
            version: sourcePlan.release_identity.qwork_version,
          },
          host_runtime_compatibility: {
            runtime_release_id: sourcePlan.release_identity.qwork_version,
            runtime_version: sourcePlan.release_identity.qwork_version,
          },
        },
        runtime_release_assessment: {
          release_identity_matches: true,
          update_activation_safe: true,
        },
        release_identity_readback: {
          schema_version: 'qwork-release-identity-readback/v1',
          ok: true,
          observed_sha256: '3'.repeat(64),
          observed: {
            qwork_version: sourcePlan.release_identity.qwork_version,
            prompt_policy_version: sourcePlan.release_identity.prompt_policy_version,
            feature_flags_hash: sourcePlan.release_identity.feature_flags_hash,
            qwork_ui_git_commit: sourcePlan.release_identity.qwork_ui_git_commit,
            qwork_build_id: sourcePlan.release_identity.qwork_build_id,
            qwork_release_manifest_sha256: sourcePlan.release_identity.qwork_release_manifest_sha256,
          },
          consistency: { ok: true, errors: [] },
          provenance: {},
        },
        release_identity_assessment: {
          ok: true,
          readback_ok: true,
          mismatches: [],
        },
      },
    },
  };
}

function completionInputs(stageId, trustedStatus = 'trusted_pass') {
  const stage = QWORK_RELEASE_TEST_STAGES.find((item) => item.id === stageId);
  const count = stage.expected_case_count;
  const caseIds = capability(stageId).cases.map((item) => item.case_id);
  const runDir = fs.mkdtempSync(path.join(evidenceFixtureRoot, `${stageId.toLowerCase()}-run-`));
  const results = caseIds.map((caseId, index) => {
    const caseDir = path.join(runDir, 'cases', `${String(index + 1).padStart(3, '0')}-${caseId}`);
    fs.mkdirSync(caseDir, { recursive: true });
    const evidencePath = path.join(caseDir, 'before.png');
    const evidenceBytes = Buffer.from(`evidence:${caseId}:${index}`);
    fs.writeFileSync(evidencePath, evidenceBytes);
    const evidenceManifest = {
      schema_version: 'qbot-core-evidence/v2',
      case_id: caseId,
      complete: true,
      missing_roles: [],
      invalid_roles: [],
      not_applicable_roles: [],
      evidence: [{
        role: 'before_screenshot',
        path: evidencePath,
        bytes: evidenceBytes.length,
        sha256: crypto.createHash('sha256').update(evidenceBytes).digest('hex'),
        valid: true,
        missing: false,
      }],
    };
    fs.writeFileSync(
      path.join(caseDir, 'evidence-manifest.json'),
      `${JSON.stringify(evidenceManifest, null, 2)}\n`,
    );
    return {
      id: caseId,
      case_dir: caseDir,
      execution_provenance: 'executed',
      inherited: false,
      synthetic: false,
      evidence_manifest: evidenceManifest,
    };
  });
  const categories = ['trusted_pass', 'trusted_bug', 'trusted_blocked', 'framework_issue', 'case_needs_update', 'needs_llm_review'];
  const trustedCounts = Object.fromEntries(categories.map((category) => [category, 0]));
  trustedCounts[trustedStatus] = count;
  const reviewCategory = {
    trusted_pass: '可信通过-用户可接受',
    trusted_bug: '可信失败-产品Bug候选',
    trusted_blocked: '可信阻塞-环境或数据',
    framework_issue: '不可信-框架问题',
    case_needs_update: '可信执行-case需优化',
  }[trustedStatus] || trustedStatus;
  return {
    progress: { total: count, completed: count, results },
    summary: {
      status: trustedStatus === 'trusted_pass' ? 'passed' : 'failed',
      counts: {
        total: count,
        passed: trustedStatus === 'trusted_pass' ? count : 0,
        failed: trustedStatus === 'trusted_pass' ? 0 : count,
        blocked: 0,
        needs_llm_review: 0,
        other: 0,
      },
      ended_at: '2026-08-28T00:00:00.000Z',
      stopped: false,
      model_tier: 'M3',
      profile: 'mandatory',
      casebook: plan.casebook.path,
      results: structuredClone(results),
      precheck: {
        execution_concurrency: {
          policy: 'core-beta-v2-forced-serial',
          forced_serial: true,
          effective_parallelism: 1,
          effective_single_host_pipeline_size: 1,
        },
        single_host_pipeline: { effective_size: 1 },
      },
      result_accounting: {
        planned: count,
        observed: count,
        completed: count,
        unexecuted: 0,
        synthetic_diagnostics: 0,
      },
    },
    trustedReview: {
      counts: { total: count, ...trustedCounts },
      production_release_gate: { all_trusted_pass: trustedStatus === 'trusted_pass' },
      items: results.map((result) => ({ id: result.id, review_category: reviewCategory, trusted: trustedStatus !== 'framework_issue' })),
    },
    runMetadata: {
      selected_case_ids: caseIds,
      model_tier: 'M3',
      profile: { mode: 'live', alias: '/tmp/teams-live-profile' },
      observed_host_pids: [4242],
      host: { version: identity.teams_version, build: identity.teams_build },
      qwork: { version: identity.qwork_version },
      control_plane: { origin: identity.control_plane_origin },
      release_inputs: {
        backend_version: identity.backend_version,
        prompt_policy_version: identity.prompt_policy_version,
        feature_flags_hash: identity.feature_flags_hash,
        qwork_ui_git_commit: identity.qwork_ui_git_commit,
        qwork_build_id: identity.qwork_build_id,
        qwork_release_manifest_sha256: identity.qwork_release_manifest_sha256,
      },
      release_observation: {
        schema_version: 'qwork-release-identity-readback/v1',
        ok: true,
        observed_sha256: '3'.repeat(64),
        observed: {
          qwork_version: identity.qwork_version,
          prompt_policy_version: identity.prompt_policy_version,
          feature_flags_hash: identity.feature_flags_hash,
          qwork_ui_git_commit: identity.qwork_ui_git_commit,
          qwork_build_id: identity.qwork_build_id,
          qwork_release_manifest_sha256: identity.qwork_release_manifest_sha256,
        },
        consistency: { ok: true, errors: [] },
        provenance: {
          state: { sha256: '4'.repeat(64) },
          envelope: { sha256: identity.qwork_release_manifest_sha256 },
          release_set_digest: '5'.repeat(64),
          host_core_digest: 'sha512-host',
          ui_digest: 'sha512-ui',
          qbot_core_digest: 'sha512-qbot',
          desktop_agent_runtime: { sha256: '6'.repeat(64) },
          ui_code_manifest: { sha256: identity.feature_flags_hash },
        },
      },
      release_observation_checks: [
        {
          phase: 'startup',
          ok: true,
          observed_sha256: '3'.repeat(64),
          state_sha256: '4'.repeat(64),
          envelope_sha256: identity.qwork_release_manifest_sha256,
        },
        {
          phase: 'run-final',
          ok: true,
          observed_sha256: '3'.repeat(64),
          state_sha256: '4'.repeat(64),
          envelope_sha256: identity.qwork_release_manifest_sha256,
        },
      ],
      sources: { framework: { commit: plan.framework.commit, dirty: false } },
      artifacts: { casebook_sha256: plan.casebook.sha256 },
    },
    expectedCaseIds: caseIds,
    runDir,
  };
}

test('release plan fixes the fail-fast stage order and counts', () => {
  assert.deepEqual(
    plan.stages.map((stage) => [stage.id, stage.expected_case_count || 0]),
    [['G0', 0], ['G1', 16], ['G2', 12], ['G3', 70], ['G4', 160], ['G5', 0]],
  );
  assert.equal(plan.policy.admission_source, 'trusted-review-only');
  assert.equal(plan.policy.stop_on_non_pass, true);
  assert.deepEqual(plan.stages[1].expected_case_ids, QWORK_CORE_LIFELINE_CASE_IDS);
  assert.deepEqual(plan.stages[2].expected_case_ids, QWORK_MR_SMOKE_CASE_IDS);
});

test('release plan rejects any non-canonical Casebook identity', () => {
  assert.throws(() => createQworkReleaseTestPlan({
    casebookPath: '/tmp/another-casebook.xlsx',
    casebookSha256: QWORK_RELEASE_CASEBOOK_SHA256,
    frameworkCommit: 'b'.repeat(40),
    releaseIdentity: identity,
  }), /casebook_basename_mismatch/);
  assert.throws(() => createQworkReleaseTestPlan({
    casebookPath: path.join('/tmp', QWORK_RELEASE_CASEBOOK_BASENAME),
    casebookSha256: 'a'.repeat(64),
    frameworkCommit: 'b'.repeat(40),
    releaseIdentity: identity,
  }), /casebook_sha256_mismatch/);
});

test('G1 exact READY marks G0 passed and G1 ready', () => {
  const audit = auditQworkStageReadiness({
    plan,
    stageId: 'G1',
    capabilityAudit: capability('G1'),
    pretest: pretest('G1'),
  });
  assert.equal(audit.decision, 'READY_TO_RUN');
  const state = applyQworkStageAudit(createQworkReleaseTestState(plan), audit, { phase: 'readiness' });
  assert.equal(state.stages.G0.status, 'PASSED');
  assert.equal(state.stages.G1.status, 'READY');
});

test('READY rejects candidate update risk and identity drift', () => {
  const unsafe = pretest('G1');
  unsafe.runtime.qwork.runtime_release_assessment.update_activation_safe = false;
  unsafe.release_identity.expected.qwork_build_id = 'forged-build';
  unsafe.release_identity.fingerprint = '0'.repeat(64);
  const audit = auditQworkStageReadiness({
    plan,
    stageId: 'G1',
    capabilityAudit: capability('G1'),
    pretest: unsafe,
  });
  assert.equal(audit.passed, false);
  assert.ok(audit.failures.includes('pretest_runtime_update_not_safe'));
  assert.ok(audit.failures.includes('pretest_release_identity_inputs_mismatch'));
  assert.ok(audit.failures.includes('pretest_release_identity_fingerprint_mismatch'));
});

test('READY rejects command-line identity claims when authoritative artifacts drift', () => {
  const forged = pretest('G1');
  forged.runtime.qwork.release_identity_readback.observed.qwork_ui_git_commit = 'feedface';
  const audit = auditQworkStageReadiness({
    plan,
    stageId: 'G1',
    capabilityAudit: capability('G1'),
    pretest: forged,
  });
  assert.equal(audit.passed, false);
  assert.ok(audit.failures.includes('pretest_qwork_artifact_identity_not_authoritative'));
});

test('READY rejects unhealthy SIT or backend fingerprint drift', () => {
  const unhealthy = pretest('G1');
  unhealthy.runtime.control_plane_health.checks.db = false;
  unhealthy.runtime.control_plane_health.auth.ready = false;
  unhealthy.runtime.control_plane_health.backend_identity_matches = false;
  unhealthy.runtime.control_plane_health.observed_backend_version = 'sit-health-deadbeefdeadbeef';
  const audit = auditQworkStageReadiness({
    plan,
    stageId: 'G1',
    capabilityAudit: capability('G1'),
    pretest: unhealthy,
  });
  assert.equal(audit.passed, false);
  assert.ok(audit.failures.includes('pretest_control_plane_health_not_ready'));
  assert.ok(audit.failures.includes('pretest_backend_identity_mismatch'));
});

test('READY rejects any Case ID order drift', () => {
  const driftedCapability = capability('G1');
  driftedCapability.cases.reverse();
  const audit = auditQworkStageReadiness({
    plan,
    stageId: 'G1',
    capabilityAudit: driftedCapability,
    pretest: pretest('G1'),
  });
  assert.equal(audit.passed, false);
  assert.ok(audit.failures.includes('capability_frozen_case_ids_mismatch'));
  assert.ok(audit.failures.includes('pretest_capability_case_ids_mismatch'));
});

test('G4 readiness requires the exact admitted G3 prefix', () => {
  const gate = capability('G3');
  const full = capability('G4');
  full.cases.splice(0, 70, ...gate.cases.map((item) => ({ ...item })));
  const fullPretest = pretest('G4');
  fullPretest.casebook.case_ids = full.cases.map((item) => item.case_id);
  const accepted = auditQworkStageReadiness({
    plan,
    stageId: 'G4',
    capabilityAudit: full,
    pretest: fullPretest,
    expectedPrefixCaseIds: gate.cases.map((item) => item.case_id),
  });
  assert.equal(accepted.passed, true, accepted.failures.join(','));
  full.cases[0].case_id = 'DRIFTED-GATE-PREFIX';
  fullPretest.casebook.case_ids[0] = 'DRIFTED-GATE-PREFIX';
  const rejected = auditQworkStageReadiness({
    plan,
    stageId: 'G4',
    capabilityAudit: full,
    pretest: fullPretest,
    expectedPrefixCaseIds: gate.cases.map((item) => item.case_id),
  });
  assert.equal(rejected.passed, false);
  assert.ok(rejected.failures.includes('full160_gray70_prefix_mismatch'));
});

test('READY rejects a forged report with missing or failed G0 checks', () => {
  const forged = pretest('G1');
  forged.checks = forged.checks.filter((check) => check.id !== 'qwork_public_capabilities');
  forged.checks.find((check) => check.id === 'single_runner_precondition').status = 'failed';
  const audit = auditQworkStageReadiness({
    plan,
    stageId: 'G1',
    capabilityAudit: capability('G1'),
    pretest: forged,
  });
  assert.equal(audit.passed, false);
  assert.ok(audit.failures.includes('pretest_check_not_passed'));
  assert.ok(audit.failures.some((failure) => failure.startsWith('pretest_required_checks_missing:')));
});

test('only all trusted passes admit the next stage', () => {
  const passed = auditQworkStageCompletion({
    plan,
    stageId: 'G1',
    ...completionInputs('G1'),
  });
  assert.equal(passed.decision, 'PASS_STAGE');

  const failed = completionInputs('G1', 'trusted_bug');
  const rejected = auditQworkStageCompletion({ plan, stageId: 'G1', ...failed });
  assert.equal(rejected.decision, 'STOP_PIPELINE');
  assert.ok(rejected.failures.includes('trusted_pass_count_mismatch'));
  assert.ok(rejected.failures.includes('trusted_bug_must_be_zero'));
});

test('completion rejects run Case order drift even when counts are green', () => {
  const inputs = completionInputs('G1');
  inputs.progress.results.reverse();
  const audit = auditQworkStageCompletion({ plan, stageId: 'G1', ...inputs });
  assert.equal(audit.passed, false);
  assert.ok(audit.failures.includes('result_case_ids_mismatch'));
});

test('completion rejects summary drift, invalid evidence and non-serial execution', () => {
  const inputs = completionInputs('G1');
  inputs.summary.results.reverse();
  inputs.summary.results[0].evidence_manifest.evidence[0].valid = false;
  inputs.summary.precheck.execution_concurrency.effective_parallelism = 2;
  const audit = auditQworkStageCompletion({ plan, stageId: 'G1', ...inputs });
  assert.equal(audit.passed, false);
  assert.ok(audit.failures.includes('summary_result_case_ids_mismatch'));
  assert.ok(audit.failures.includes('summary_evidence_manifest_incomplete'));
  assert.ok(audit.failures.includes('run_forced_serial_policy_mismatch'));
});

test('completion rejects a manifest without explicit valid evidence entries', () => {
  const inputs = completionInputs('G1');
  inputs.progress.results[0].evidence_manifest.evidence = [];
  const audit = auditQworkStageCompletion({ plan, stageId: 'G1', ...inputs });
  assert.equal(audit.passed, false);
  assert.ok(audit.failures.includes('evidence_manifest_incomplete'));
});

test('completion recomputes evidence bytes and SHA from the immutable run directory', () => {
  const inputs = completionInputs('G1');
  const evidencePath = inputs.progress.results[0].evidence_manifest.evidence[0].path;
  fs.appendFileSync(evidencePath, 'tampered');
  const audit = auditQworkStageCompletion({ plan, stageId: 'G1', ...inputs });
  assert.equal(audit.passed, false);
  assert.ok(audit.failures.includes('evidence_manifest_incomplete'));
  assert.ok(audit.failures.includes('summary_evidence_manifest_incomplete'));
});

test('completion requires stable authoritative identity at startup and run-final', () => {
  const missingFinal = completionInputs('G1');
  missingFinal.runMetadata.release_observation_checks.pop();
  const missingAudit = auditQworkStageCompletion({ plan, stageId: 'G1', ...missingFinal });
  assert.equal(missingAudit.passed, false);
  assert.ok(missingAudit.failures.includes('run_release_observation_phases_incomplete'));

  const drifted = completionInputs('G1');
  drifted.runMetadata.release_observation_checks[1].state_sha256 = '9'.repeat(64);
  const driftAudit = auditQworkStageCompletion({ plan, stageId: 'G1', ...drifted });
  assert.equal(driftAudit.passed, false);
  assert.ok(driftAudit.failures.includes('run_release_observation_drift'));
});

test('a core gate failure keeps every later stage NOT_STARTED', () => {
  const readiness = auditQworkStageReadiness({
    plan,
    stageId: 'G1',
    capabilityAudit: capability('G1'),
    pretest: pretest('G1'),
  });
  let state = applyQworkStageAudit(createQworkReleaseTestState(plan), readiness, { phase: 'readiness' });
  const failed = auditQworkStageCompletion({
    plan,
    stageId: 'G1',
    ...completionInputs('G1', 'framework_issue'),
  });
  state = applyQworkStageAudit(state, failed, { phase: 'completion' });
  assert.equal(state.decision, 'NO_GO');
  assert.equal(state.stages.G1.status, 'STOPPED');
  for (const stageId of ['G2', 'G3', 'G4', 'G5']) assert.equal(state.stages[stageId].status, 'NOT_STARTED');
  assert.throws(
    () => applyQworkStageAudit(state, readiness, { phase: 'readiness' }),
    /状态已冻结/,
  );
});

test('a stage readiness audit cannot overwrite an existing admission', () => {
  const readiness = auditQworkStageReadiness({
    plan,
    stageId: 'G1',
    capabilityAudit: capability('G1'),
    pretest: pretest('G1'),
  });
  const state = applyQworkStageAudit(createQworkReleaseTestState(plan), readiness, { phase: 'readiness' });
  assert.throws(
    () => applyQworkStageAudit(state, readiness, { phase: 'readiness' }),
    /不得覆盖准入/,
  );
});

test('control integrity rejects plan and state tampering', () => {
  const state = createQworkReleaseTestState(plan);
  const integrity = createQworkReleaseTestIntegrity(plan, state);
  assert.equal(validateQworkReleaseControlState({ plan, state, integrity }).ok, true);

  const changedPlan = structuredClone(plan);
  changedPlan.policy.model_tier = 'M4';
  const planAudit = validateQworkReleaseControlState({ plan: changedPlan, state, integrity });
  assert.equal(planAudit.ok, false);
  assert.ok(planAudit.failures.includes('integrity_plan_sha256_mismatch'));

  const changedState = structuredClone(state);
  changedState.stages.G1.status = 'PASSED';
  const stateAudit = validateQworkReleaseControlState({ plan, state: changedState, integrity });
  assert.equal(stateAudit.ok, false);
  assert.ok(stateAudit.failures.includes('integrity_state_sha256_mismatch'));

  const invalidEventIntegrity = { ...integrity, event_count: 1, last_event_sha256: '' };
  const eventAudit = validateQworkReleaseControlState({ plan, state, integrity: invalidEventIntegrity });
  assert.equal(eventAudit.ok, false);
  assert.ok(eventAudit.failures.includes('integrity_last_event_sha256_invalid'));
});

test('soak requires 100 tasks, three restarts and exact identity', () => {
  const passed = auditQworkSoakCompletion({
    plan,
    soak: {
      tasks_completed: 100,
      restart_count: 3,
      crash_count: 0,
      resource_leak_detected: false,
      evidence_complete: true,
      passed: true,
      release_identity_sha256: plan.release_identity_sha256,
    },
  });
  assert.equal(passed.decision, 'PASS_STAGE');
  const failed = auditQworkSoakCompletion({
    plan,
    soak: {
      tasks_completed: 99,
      restart_count: 2,
      crash_count: 1,
      resource_leak_detected: true,
      evidence_complete: false,
      passed: false,
      release_identity_sha256: '0'.repeat(64),
    },
  });
  assert.equal(failed.decision, 'STOP_PIPELINE');
  assert.ok(failed.failures.length >= 6);
});

test('orchestrator persists and verifies the forward event hash chain', () => {
  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'qwork-release-orchestrator-'));
  const remote = path.join(temporaryRoot, 'remote.git');
  const work = path.join(temporaryRoot, 'work');
  const stateDir = path.join(temporaryRoot, 'state');
  const run = (command, args, cwd = work) => spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
  });
  try {
    assert.equal(run('git', ['init', '--bare', remote], temporaryRoot).status, 0);
    assert.equal(run('git', ['init', '-b', 'main', work], temporaryRoot).status, 0);
    assert.equal(run('git', ['config', 'user.email', 'qwork-release-test@example.invalid']).status, 0);
    assert.equal(run('git', ['config', 'user.name', 'QWork Release Test']).status, 0);
    fs.writeFileSync(path.join(work, 'README.md'), 'temporary release orchestrator repository\n');
    assert.equal(run('git', ['add', 'README.md']).status, 0);
    assert.equal(run('git', ['commit', '-m', 'initial']).status, 0);
    assert.equal(run('git', ['remote', 'add', 'origin', remote]).status, 0);
    assert.equal(run('git', ['push', '-u', 'origin', 'main']).status, 0);

    const casebook = path.join(temporaryRoot, QWORK_RELEASE_CASEBOOK_BASENAME);
    const identityFile = path.join(temporaryRoot, 'release-identity.json');
    fs.copyFileSync(path.join(root, 'PRD', QWORK_RELEASE_CASEBOOK_BASENAME), casebook);
    fs.writeFileSync(identityFile, `${JSON.stringify(identity)}\n`);
    const initialized = run(process.execPath, [
      orchestrator,
      'init',
      '--state-dir', stateDir,
      '--casebook', casebook,
      '--release-identity', identityFile,
    ]);
    assert.equal(initialized.status, 0, initialized.stderr);
    const cliPlan = JSON.parse(fs.readFileSync(path.join(stateDir, 'release-test-plan.json'), 'utf8'));
    const capabilityFile = path.join(temporaryRoot, 'capability-audit.json');
    const pretestFile = path.join(temporaryRoot, 'core-beta-pretest-report.json');
    fs.writeFileSync(capabilityFile, `${JSON.stringify(capability('G1', cliPlan))}\n`);
    fs.writeFileSync(pretestFile, `${JSON.stringify(pretest('G1', cliPlan))}\n`);
    const admitted = run(process.execPath, [
      orchestrator,
      'readiness',
      '--state-dir', stateDir,
      '--stage', 'G1',
      '--capability-audit', capabilityFile,
      '--pretest', pretestFile,
    ]);
    assert.equal(admitted.status, 0, admitted.stderr);
    const status = run(process.execPath, [orchestrator, 'status', '--state-dir', stateDir]);
    assert.equal(status.status, 0, status.stderr);
    const statusPayload = JSON.parse(status.stdout);
    assert.equal(statusPayload.state.revision, 1);
    assert.equal(statusPayload.integrity.event_count, 1);
    assert.match(statusPayload.integrity.last_event_sha256, /^[a-f0-9]{64}$/);

    const eventFile = path.join(stateDir, 'events', '0001-G1-readiness.json');
    const originalEventText = fs.readFileSync(eventFile, 'utf8');
    const event = JSON.parse(originalEventText);
    event.audit.decision = 'BLOCKED';
    fs.writeFileSync(eventFile, `${JSON.stringify(event, null, 2)}\n`);
    const rejected = run(process.execPath, [orchestrator, 'status', '--state-dir', stateDir]);
    assert.notEqual(rejected.status, 0);
    assert.match(rejected.stderr, /事件链已被改写/);

    fs.writeFileSync(eventFile, originalEventText);
    const revisionForged = JSON.parse(originalEventText);
    revisionForged.state_revision_after = 2;
    fs.writeFileSync(eventFile, `${JSON.stringify(revisionForged, null, 2)}\n`);
    const integrityFile = path.join(stateDir, 'release-test-integrity.json');
    const forgedIntegrity = JSON.parse(fs.readFileSync(integrityFile, 'utf8'));
    forgedIntegrity.last_event_sha256 = crypto.createHash('sha256').update(fs.readFileSync(eventFile)).digest('hex');
    fs.writeFileSync(integrityFile, `${JSON.stringify(forgedIntegrity, null, 2)}\n`);
    const revisionRejected = run(process.execPath, [orchestrator, 'status', '--state-dir', stateDir]);
    assert.notEqual(revisionRejected.status, 0);
    assert.match(revisionRejected.stderr, /event_revision_mismatch/);
  } finally {
    fs.rmSync(temporaryRoot, { recursive: true, force: true });
  }
});
