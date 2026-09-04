import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  QWORK_RELEASE_INTAKE_DEFAULT_REF,
  QWORK_RELEASE_INTAKE_SCHEMA,
  QWORK_RELEASE_INTAKE_TOOL_VERSION,
  stableJson,
} from '../src/lib/qwork-release-intake.mjs';
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
  validateQworkReleaseIntakeBinding,
  validateQworkReleaseControlState,
} from '../src/lib/qwork-release-test-plan.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const orchestrator = path.join(root, 'scripts', 'orchestrate-qwork-release-test.mjs');
const evidenceFixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'qwork-release-evidence-'));
test.after(() => fs.rmSync(evidenceFixtureRoot, { recursive: true, force: true }));

test('release plan freezes the independently accepted r14 Casebook identity', () => {
  assert.equal(
    QWORK_RELEASE_CASEBOOK_BASENAME,
    'QBot核心生命线与新增MR生产灰度全量回归Casebook_16-12-70-160条_2026-09-05-r14.xlsx',
  );
  assert.equal(
    QWORK_RELEASE_CASEBOOK_SHA256,
    '439f14686df4a1623015e3964b61a6943455c804938be2680a8d6fedde9bf2ed',
  );
  assert.deepEqual(
    QWORK_RELEASE_TEST_STAGES.find((stage) => stage.id === 'G4')?.expected_capability_classes,
    { runner_native: 61, runner_native_with_fixture_option: 1, runner_legacy_verified: 98 },
  );
});

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

function makeReleaseIntake({
  casebookSha256 = QWORK_RELEASE_CASEBOOK_SHA256,
  frameworkCommit = 'b'.repeat(40),
  releaseHead = 'c'.repeat(40),
  releaseRef = QWORK_RELEASE_INTAKE_DEFAULT_REF,
} = {}) {
  const report = {
    schema_version: QWORK_RELEASE_INTAKE_SCHEMA,
    tool: { version: QWORK_RELEASE_INTAKE_TOOL_VERSION },
    decision: 'READY',
    release: { ref: releaseRef, head: releaseHead },
    framework: { commit: frameworkCommit },
    casebook: { sha256: casebookSha256 },
    scan_boundary: { mode: 'commit_ancestry', ancestry_verified: true },
    merge_requests: [],
    source_contracts: [],
    summary: {
      source_contract_count: 0,
      source_contract_verified_count: 0,
      source_contract_failure_count: 0,
      required_stages: ['G1', 'G2', 'G3', 'G4'],
    },
    unresolved: {
      unmapped_product_paths: [],
      unverified_mr_metadata: [],
      unattributed_direct_commits: [],
      source_contract_failures: [],
    },
    blockers: [],
    policy: { fetch_latest: true },
    integrity: { content_sha256: '' },
  };
  const withoutHash = structuredClone(report);
  delete withoutHash.integrity.content_sha256;
  report.integrity.content_sha256 = crypto
    .createHash('sha256')
    .update(stableJson(withoutHash))
    .digest('hex');
  return report;
}

const releaseIntake = makeReleaseIntake();
const releaseIntakeSha256 = 'f'.repeat(64);
const expectedReleaseRef = QWORK_RELEASE_INTAKE_DEFAULT_REF;
const expectedReleaseHead = 'c'.repeat(40);
const plan = createQworkReleaseTestPlan({
  casebookPath: path.join('/tmp', QWORK_RELEASE_CASEBOOK_BASENAME),
  casebookSha256: QWORK_RELEASE_CASEBOOK_SHA256,
  frameworkCommit: 'b'.repeat(40),
  releaseIdentity: identity,
  releaseIntake,
  releaseIntakePath: '/tmp/release-intake.json',
  releaseIntakeSha256,
  expectedReleaseRef,
  expectedReleaseHead,
});

function releaseIntakeInputs(sourcePlan = plan, report = releaseIntake) {
  return {
    releaseIntake: report,
    releaseIntakeSha256: sourcePlan.release_intake.sha256,
  };
}

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
    release_intake: {
      sha256: sourcePlan.release_intake.sha256,
      content_sha256: sourcePlan.release_intake.content_sha256,
      release_head: sourcePlan.release_intake.release_head,
    },
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
      'qwork_release_intake',
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
    releaseIntake,
    releaseIntakePath: '/tmp/release-intake.json',
    releaseIntakeSha256,
    expectedReleaseRef,
    expectedReleaseHead,
  }), /casebook_basename_mismatch/);
  assert.throws(() => createQworkReleaseTestPlan({
    casebookPath: path.join('/tmp', QWORK_RELEASE_CASEBOOK_BASENAME),
    casebookSha256: 'a'.repeat(64),
    frameworkCommit: 'b'.repeat(40),
    releaseIdentity: identity,
    releaseIntake,
    releaseIntakePath: '/tmp/release-intake.json',
    releaseIntakeSha256,
    expectedReleaseRef,
    expectedReleaseHead,
  }), /casebook_sha256_mismatch/);
});

test('release plan requires a READY intake bound to the Casebook and framework', () => {
  const base = {
    casebookPath: path.join('/tmp', QWORK_RELEASE_CASEBOOK_BASENAME),
    casebookSha256: QWORK_RELEASE_CASEBOOK_SHA256,
    frameworkCommit: 'b'.repeat(40),
    releaseIdentity: identity,
    releaseIntakePath: '/tmp/release-intake.json',
    releaseIntakeSha256,
    expectedReleaseRef,
    expectedReleaseHead,
  };
  const { expectedReleaseRef: ignoredRef, expectedReleaseHead: ignoredHead, ...withoutObservation } = base;
  assert.equal(ignoredRef, expectedReleaseRef);
  assert.equal(ignoredHead, expectedReleaseHead);
  assert.throws(
    () => createQworkReleaseTestPlan({ ...withoutObservation, releaseIntake }),
    /expected_release_ref_invalid.*expected_release_head_invalid/,
  );
  assert.throws(() => createQworkReleaseTestPlan(base), /release_intake_required/);
  assert.throws(() => createQworkReleaseTestPlan({
    ...base,
    releaseIntake: makeReleaseIntake({ casebookSha256: 'a'.repeat(64) }),
  }), /release_intake_invalid:casebook_sha256_mismatch/);
  assert.throws(() => createQworkReleaseTestPlan({
    ...base,
    releaseIntake: makeReleaseIntake({ frameworkCommit: 'a'.repeat(40) }),
  }), /release_intake_invalid:framework_commit_mismatch/);
  assert.throws(() => createQworkReleaseTestPlan({
    ...base,
    releaseIntake: makeReleaseIntake({ releaseRef: 'origin/release/old' }),
  }), /release_intake_invalid:release_ref_mismatch/);
  assert.throws(() => createQworkReleaseTestPlan({
    ...base,
    releaseIntake: makeReleaseIntake({ releaseHead: 'd'.repeat(40) }),
  }), /release_intake_invalid:release_head_mismatch/);
  const notReady = makeReleaseIntake();
  notReady.decision = 'BLOCKED';
  notReady.blockers = ['test blocker'];
  const withoutHash = structuredClone(notReady);
  delete withoutHash.integrity.content_sha256;
  notReady.integrity.content_sha256 = crypto.createHash('sha256').update(stableJson(withoutHash)).digest('hex');
  assert.throws(() => createQworkReleaseTestPlan({ ...base, releaseIntake: notReady }), /decision_BLOCKED/);
});

test('release state and control integrity reject an unbound legacy plan', () => {
  const unboundPlan = structuredClone(plan);
  unboundPlan.release_intake = null;
  unboundPlan.policy.release_intake_required = false;
  assert.throws(
    () => createQworkReleaseTestState(unboundPlan),
    /缺少.*强制 release intake.*绑定/,
  );

  const state = createQworkReleaseTestState(plan);
  const integrity = createQworkReleaseTestIntegrity(plan, state);
  const audit = validateQworkReleaseControlState({ plan: unboundPlan, state, integrity });
  assert.equal(audit.ok, false);
  assert.ok(audit.failures.includes('plan_release_intake_binding_required'));
});

test('release state and control integrity reject malformed intake bindings', () => {
  const state = createQworkReleaseTestState(plan);
  const integrity = createQworkReleaseTestIntegrity(plan, state);
  const scenarios = [
    {
      name: 'empty binding',
      mutate: (candidate) => { candidate.release_intake = {}; },
      failure: 'plan_release_intake_schema_mismatch',
    },
    {
      name: 'missing absolute path',
      mutate: (candidate) => { candidate.release_intake.path = ''; },
      failure: 'plan_release_intake_path_invalid',
    },
    {
      name: 'missing artifact hash',
      mutate: (candidate) => { candidate.release_intake.sha256 = ''; },
      failure: 'plan_release_intake_artifact_sha256_invalid',
    },
    {
      name: 'missing content hash',
      mutate: (candidate) => { candidate.release_intake.content_sha256 = ''; },
      failure: 'plan_release_intake_content_sha256_invalid',
    },
    {
      name: 'non-canonical ref',
      mutate: (candidate) => { candidate.release_intake.release_ref = 'origin/release/old'; },
      failure: 'plan_release_intake_release_ref_invalid',
    },
    {
      name: 'missing release HEAD',
      mutate: (candidate) => { candidate.release_intake.release_head = ''; },
      failure: 'plan_release_intake_release_head_invalid',
    },
  ];
  for (const scenario of scenarios) {
    const malformedPlan = structuredClone(plan);
    scenario.mutate(malformedPlan);
    assert.throws(
      () => createQworkReleaseTestState(malformedPlan),
      /缺少.*强制 release intake.*绑定/,
      scenario.name,
    );
    const audit = validateQworkReleaseControlState({ plan: malformedPlan, state, integrity });
    assert.equal(audit.ok, false, scenario.name);
    assert.ok(audit.failures.includes(scenario.failure), scenario.name);
  }
});

test('release intake binding requires an explicit exact artifact SHA', () => {
  for (const reportSha256 of [undefined, '', 'not-a-sha256']) {
    const binding = validateQworkReleaseIntakeBinding({
      plan,
      report: releaseIntake,
      reportSha256,
    });
    assert.equal(binding.ok, false);
    assert.ok(binding.failures.includes('release_intake_artifact_sha256_invalid'));
  }
  const readiness = auditQworkStageReadiness({
    plan,
    stageId: 'G1',
    capabilityAudit: capability('G1'),
    pretest: pretest('G1'),
    releaseIntake,
  });
  assert.equal(readiness.passed, false);
  assert.ok(readiness.failures.includes('release_intake_artifact_sha256_invalid'));
});

test('readiness rejects an intake replaced with a stale release HEAD', () => {
  const staleIntake = makeReleaseIntake({ releaseHead: 'd'.repeat(40) });
  const audit = auditQworkStageReadiness({
    ...releaseIntakeInputs(plan, staleIntake),
    plan,
    stageId: 'G1',
    capabilityAudit: capability('G1'),
    pretest: pretest('G1'),
  });
  assert.equal(audit.passed, false);
  assert.ok(audit.failures.includes('release_intake_release_head_mismatch'));
});

test('G1 exact READY marks G0 passed and G1 ready', () => {
  const audit = auditQworkStageReadiness({
    ...releaseIntakeInputs(),
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
    ...releaseIntakeInputs(),
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
    ...releaseIntakeInputs(),
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
    ...releaseIntakeInputs(),
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
    ...releaseIntakeInputs(),
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
    ...releaseIntakeInputs(),
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
    ...releaseIntakeInputs(),
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
    ...releaseIntakeInputs(),
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
    ...releaseIntakeInputs(),
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
    ...releaseIntakeInputs(),
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
    assert.equal(run('git', ['branch', 'release/0.1']).status, 0);
    assert.equal(run('git', ['push', 'origin', 'release/0.1']).status, 0);

    const casebook = path.join(temporaryRoot, QWORK_RELEASE_CASEBOOK_BASENAME);
    const identityFile = path.join(temporaryRoot, 'release-identity.json');
    const releaseIntakeFile = path.join(temporaryRoot, 'release-intake.json');
    const frameworkCommit = run('git', ['rev-parse', 'HEAD']).stdout.trim();
    const currentReleaseIntake = makeReleaseIntake({
      frameworkCommit,
      releaseHead: frameworkCommit,
    });
    const expectedReleaseArguments = [
      '--expected-release-ref', QWORK_RELEASE_INTAKE_DEFAULT_REF,
      '--expected-release-head', frameworkCommit,
    ];
    fs.copyFileSync(path.join(root, 'PRD', QWORK_RELEASE_CASEBOOK_BASENAME), casebook);
    fs.writeFileSync(identityFile, `${JSON.stringify(identity)}\n`);

    fs.writeFileSync(releaseIntakeFile, `${JSON.stringify(currentReleaseIntake)}\n`);
    const missingIntake = run(process.execPath, [
      orchestrator,
      'init',
      '--state-dir', stateDir,
      '--casebook', casebook,
      '--release-identity', identityFile,
      ...expectedReleaseArguments,
    ]);
    assert.notEqual(missingIntake.status, 0);
    assert.match(missingIntake.stderr, /Missing required options: --release-intake/);

    const missingExpectedRelease = run(process.execPath, [
      orchestrator,
      'init',
      '--state-dir', stateDir,
      '--casebook', casebook,
      '--release-identity', identityFile,
      '--release-intake', releaseIntakeFile,
    ]);
    assert.notEqual(missingExpectedRelease.status, 0);
    assert.match(
      missingExpectedRelease.stderr,
      /Missing required options: --expected-release-ref, --expected-release-head/,
    );
    assert.equal(fs.existsSync(stateDir), false);

    const disabledIntake = run(process.execPath, [
      orchestrator,
      'init',
      '--state-dir', stateDir,
      '--casebook', casebook,
      '--release-identity', identityFile,
      '--release-intake', releaseIntakeFile,
      '--require-release-intake', 'false',
      ...expectedReleaseArguments,
    ]);
    assert.notEqual(disabledIntake.status, 0);
    assert.match(disabledIntake.stderr, /不能关闭 release intake 门禁/);

    const staleRefIntake = makeReleaseIntake({
      frameworkCommit,
      releaseHead: frameworkCommit,
      releaseRef: 'origin/release/old',
    });
    fs.writeFileSync(releaseIntakeFile, `${JSON.stringify(staleRefIntake)}\n`);
    const staleRefInit = run(process.execPath, [
      orchestrator,
      'init',
      '--state-dir', stateDir,
      '--casebook', casebook,
      '--release-identity', identityFile,
      '--release-intake', releaseIntakeFile,
      ...expectedReleaseArguments,
    ]);
    assert.notEqual(staleRefInit.status, 0);
    assert.match(staleRefInit.stderr, /release_ref_mismatch/);
    assert.equal(fs.existsSync(stateDir), false);

    const staleHeadIntake = makeReleaseIntake({
      frameworkCommit,
      releaseHead: 'd'.repeat(40),
    });
    fs.writeFileSync(releaseIntakeFile, `${JSON.stringify(staleHeadIntake)}\n`);
    const staleHeadInit = run(process.execPath, [
      orchestrator,
      'init',
      '--state-dir', stateDir,
      '--casebook', casebook,
      '--release-identity', identityFile,
      '--release-intake', releaseIntakeFile,
      ...expectedReleaseArguments,
    ]);
    assert.notEqual(staleHeadInit.status, 0);
    assert.match(staleHeadInit.stderr, /release_head_mismatch/);
    assert.equal(fs.existsSync(stateDir), false);

    fs.writeFileSync(releaseIntakeFile, `${JSON.stringify(currentReleaseIntake)}\n`);
    const initialized = run(process.execPath, [
      orchestrator,
      'init',
      '--state-dir', stateDir,
      '--casebook', casebook,
      '--release-identity', identityFile,
      '--release-intake', releaseIntakeFile,
      ...expectedReleaseArguments,
    ]);
    assert.equal(initialized.status, 0, initialized.stderr);
    const cliPlan = JSON.parse(fs.readFileSync(path.join(stateDir, 'release-test-plan.json'), 'utf8'));
    const capabilityFile = path.join(temporaryRoot, 'capability-audit.json');
    const pretestFile = path.join(temporaryRoot, 'core-beta-pretest-report.json');
    fs.writeFileSync(capabilityFile, `${JSON.stringify(capability('G1', cliPlan))}\n`);
    fs.writeFileSync(pretestFile, `${JSON.stringify(pretest('G1', cliPlan))}\n`);

    const readinessArguments = [
      orchestrator,
      'readiness',
      '--state-dir', stateDir,
      '--stage', 'G1',
      '--capability-audit', capabilityFile,
      '--pretest', pretestFile,
    ];
    const assertControlStateUnchanged = () => {
      const unchangedState = JSON.parse(fs.readFileSync(path.join(stateDir, 'release-test-state.json'), 'utf8'));
      const unchangedIntegrity = JSON.parse(fs.readFileSync(path.join(stateDir, 'release-test-integrity.json'), 'utf8'));
      assert.equal(unchangedState.revision, 0);
      assert.equal(unchangedState.decision, 'NOT_READY');
      assert.equal(unchangedIntegrity.event_count, 0);
      assert.deepEqual(fs.readdirSync(path.join(stateDir, 'events')), []);
    };
    const expectReadinessRejection = (mutate, pattern) => {
      mutate();
      const rejected = run(process.execPath, readinessArguments);
      assert.notEqual(rejected.status, 0);
      assert.match(rejected.stderr, pattern);
      assertControlStateUnchanged();
      fs.writeFileSync(releaseIntakeFile, `${JSON.stringify(currentReleaseIntake)}\n`);
    };

    expectReadinessRejection(
      () => fs.writeFileSync(releaseIntakeFile, `${JSON.stringify(makeReleaseIntake({
        frameworkCommit,
        releaseHead: 'd'.repeat(40),
      }))}\n`),
      /release_intake_release_head_mismatch/,
    );
    expectReadinessRejection(
      () => fs.writeFileSync(releaseIntakeFile, `${JSON.stringify(makeReleaseIntake({
        frameworkCommit,
        releaseHead: frameworkCommit,
        casebookSha256: 'a'.repeat(64),
      }))}\n`),
      /release_intake_casebook_sha256_mismatch/,
    );
    expectReadinessRejection(
      () => fs.writeFileSync(releaseIntakeFile, `${JSON.stringify(makeReleaseIntake({
        frameworkCommit: 'a'.repeat(40),
        releaseHead: frameworkCommit,
      }))}\n`),
      /release_intake_framework_commit_mismatch/,
    );
    expectReadinessRejection(
      () => fs.writeFileSync(releaseIntakeFile, `${JSON.stringify(currentReleaseIntake, null, 2)}\n`),
      /release_intake_artifact_sha256_mismatch/,
    );
    expectReadinessRejection(() => {
      const invalidContentHash = structuredClone(currentReleaseIntake);
      invalidContentHash.integrity.content_sha256 = '0'.repeat(64);
      fs.writeFileSync(releaseIntakeFile, `${JSON.stringify(invalidContentHash)}\n`);
    }, /release_intake_content_hash_mismatch|release_intake_content_sha256_mismatch/);
    expectReadinessRejection(
      () => fs.unlinkSync(releaseIntakeFile),
      /计划绑定的 release intake 不存在/,
    );

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
