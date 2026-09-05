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
  scanQworkReleaseIntake,
  stableJson,
} from '../src/lib/qwork-release-intake.mjs';
import {
  QWORK_RELEASE_SOURCE_CONTRACTS,
  releaseSourceContractProtectedPaths,
  resolveCurrentReleaseHeaderContract,
} from '../src/lib/qwork-release-source-contracts.mjs';
import {
  QWORK_MR1552_MERGE_COMMIT_SHA,
  QWORK_MR1559_MERGE_COMMIT_SHA,
} from '../src/lib/qwork-release-blocking-risks.mjs';
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
  QWORK_RELEASE_CASEBOOK_DESIGN_BASELINE_COMMIT,
  QWORK_RELEASE_CASEBOOK_SHA256,
  QWORK_RELEASE_IDENTITY_SCHEMA,
  QWORK_RELEASE_REF_OBSERVATION_SCHEMA,
  QWORK_RELEASE_SOAK_REPORT_SCHEMA,
  QWORK_CORE_LIFELINE_CASE_IDS,
  QWORK_MR_SMOKE_CASE_IDS,
  qworkReleaseIdentityFingerprint,
  validateQworkReleaseIntakeBinding,
  validateQworkReleaseControlState,
} from '../src/lib/qwork-release-test-plan.mjs';
import {
  createQworkSoakFixture,
  persistQworkSoakFixture,
  rewriteQworkSoakArtifact,
} from './helpers/qwork-soak-fixture.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const orchestrator = path.join(root, 'scripts', 'orchestrate-qwork-release-test.mjs');
const evidenceFixtureRoot = fs.realpathSync(
  fs.mkdtempSync(path.join(os.tmpdir(), 'qwork-release-evidence-')),
);
test.after(() => fs.rmSync(evidenceFixtureRoot, { recursive: true, force: true }));

test('release plan freezes the independently accepted r15 Casebook identity', () => {
  assert.equal(
    QWORK_RELEASE_CASEBOOK_BASENAME,
    'QBot核心生命线与新增MR生产灰度全量回归Casebook_16-12-70-160条_2026-09-05-r15.xlsx',
  );
  assert.equal(
    QWORK_RELEASE_CASEBOOK_SHA256,
    '8523a10715a384f0d321f468a5350b393f19832008f585731fe83e292982ff2a',
  );
  assert.equal(
    QWORK_RELEASE_CASEBOOK_DESIGN_BASELINE_COMMIT,
    '6d482c9ccbceb74d4ebf81610d980e5fe15def6c',
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

function gitBlobSha1(source) {
  const body = Buffer.from(source, 'utf8');
  return crypto.createHash('sha1').update(Buffer.concat([
    Buffer.from(`blob ${body.length}\0`, 'utf8'),
    body,
  ])).digest('hex');
}

function currentReleaseFileFixtures(contracts, head) {
  const linesByPath = new Map();
  const addLine = (filePath, line) => {
    if (!linesByPath.has(filePath)) linesByPath.set(filePath, []);
    const lines = linesByPath.get(filePath);
    if (line && !lines.includes(line)) lines.push(line);
  };
  const appendLine = (filePath, line) => {
    if (!linesByPath.has(filePath)) linesByPath.set(filePath, []);
    if (line) linesByPath.get(filePath).push(line);
  };
  const ancestryByContractId = new Map(contracts.map((contract) => [contract.contract_id, {
    verified: true,
    first_parent_complete: true,
  }]));
  for (const contract of contracts) {
    const headerOwner = resolveCurrentReleaseHeaderContract(contract, {
      contracts,
      ancestryByContractId,
    }).owner;
    const replacedBindingIds = new Set((headerOwner.supersedes || [])
      .find((item) => item.contract_id === contract.contract_id)?.current_assertions
      ?.filter((item) => item.startsWith('integration_binding:'))
      .map((item) => item.slice('integration_binding:'.length)) || []);
    for (const filePath of releaseSourceContractProtectedPaths(contract)) {
      if (!linesByPath.has(filePath)) linesByPath.set(filePath, []);
    }
    for (const filePath of releaseSourceContractProtectedPaths(headerOwner)) {
      if (!linesByPath.has(filePath)) linesByPath.set(filePath, []);
    }
    for (const header of headerOwner.header_emissions) {
      addLine(headerOwner.source_file.path, header.value_definition?.source);
      addLine(headerOwner.source_file.path, header.emission?.source);
    }
    for (const binding of contract.integration_bindings.filter((item) => (
      !item.current_release_scope && !replacedBindingIds.has(item.id)
    ))) {
      addLine(binding.path, binding.addition?.source);
    }
    for (const binding of contract.integration_bindings.filter((item) => item.current_release_scope)) {
      appendLine(binding.path, binding.current_release_scope.owner_start.source);
      for (const fragment of binding.current_release_scope.required_fragments) {
        appendLine(binding.path, fragment.value.source);
      }
    }
  }
  return new Map([...linesByPath].map(([filePath, lines]) => {
    const source = `${lines.join('\n')}\n`;
    return [filePath, {
      file_name: path.basename(filePath),
      file_path: filePath,
      size: Buffer.byteLength(source, 'utf8'),
      encoding: 'base64',
      content: Buffer.from(source, 'utf8').toString('base64'),
      ref: head,
      blob_id: gitBlobSha1(source),
      commit_id: head,
      last_commit_id: head,
    }];
  }));
}

function makeReleaseIntake({
  casebookSha256 = QWORK_RELEASE_CASEBOOK_SHA256,
  frameworkCommit = 'b'.repeat(40),
  releaseHead = QWORK_RELEASE_CASEBOOK_DESIGN_BASELINE_COMMIT,
  releaseRef = QWORK_RELEASE_INTAKE_DEFAULT_REF,
  repositoryPath = root,
} = {}) {
  const releaseFiles = currentReleaseFileFixtures(QWORK_RELEASE_SOURCE_CONTRACTS, releaseHead);
  const blockingRiskMerges = new Set([
    QWORK_MR1552_MERGE_COMMIT_SHA,
    QWORK_MR1559_MERGE_COMMIT_SHA,
  ]);
  const fixtureMrIid = '999999';
  const fixtureMr = {
    iid: fixtureMrIid,
    title: 'test fixture static change',
    description: 'Deterministic release-intake fixture.',
    labels: ['scope/test'],
    merged_at: '2026-09-05T00:00:00.000Z',
    merge_commit_sha: releaseHead,
    squash_commit_sha: null,
    web_url: `https://gitlab.daikuan.qihoo.net/songrongxin/deepbankv2/-/merge_requests/${fixtureMrIid}`,
    source_branch: 'test/release-intake-fixture',
    state: 'merged',
    target_branch: 'release/0.1',
  };
  const fixtureChanges = {
    ...fixtureMr,
    changes_count: '1',
    overflow: false,
    changes: [{
      old_path: 'docs/release-intake-fixture.md',
      new_path: 'docs/release-intake-fixture.md',
      new_file: true,
      renamed_file: false,
      deleted_file: false,
      diff: '@@ -0,0 +1 @@\n+fixture\n',
    }],
  };
  const gitlabReader = (endpoint) => {
    if (endpoint.startsWith('repository/branches/')) return { commit: { id: releaseHead } };
    if (endpoint.startsWith('repository/compare?')) {
      const query = new URLSearchParams(endpoint.slice(endpoint.indexOf('?') + 1));
      const from = query.get('from');
      const to = query.get('to');
      if (from === QWORK_RELEASE_CASEBOOK_DESIGN_BASELINE_COMMIT && to === releaseHead) {
        if (from === to) return { compare_timeout: false, commits: [] };
        return {
          compare_timeout: false,
          commits: [{
            id: releaseHead,
            parent_ids: [from, '9'.repeat(40)],
            committed_date: '2026-09-05T00:00:00.000Z',
            title: 'test fixture static change',
            message: 'test fixture static change',
          }],
        };
      }
      if (QWORK_RELEASE_SOURCE_CONTRACTS.some((contract) => contract.merge_commit_sha === from)
        && to === releaseHead) {
        return {
          compare_timeout: false,
          commits: [{ id: releaseHead, parent_ids: [from] }],
        };
      }
      if (from === releaseHead && blockingRiskMerges.has(to)) {
        return {
          compare_timeout: false,
          commits: [{ id: to, parent_ids: [releaseHead] }],
        };
      }
      if (blockingRiskMerges.has(from) && to === releaseHead) {
        return { compare_timeout: false, commits: [] };
      }
      throw new Error(`unexpected compare ${from}..${to}`);
    }
    if (endpoint === `repository/commits/${releaseHead}/merge_requests`) return [fixtureMr];
    if (endpoint === `merge_requests/${fixtureMrIid}/changes`) return fixtureChanges;
    if (endpoint.startsWith('repository/files/')) {
      const encodedPath = endpoint.slice('repository/files/'.length, endpoint.indexOf('?'));
      const filePath = decodeURIComponent(encodedPath);
      if (!releaseFiles.has(filePath)) throw new Error(`missing release file fixture ${filePath}`);
      return releaseFiles.get(filePath);
    }
    throw new Error(`unexpected endpoint ${endpoint}`);
  };
  return scanQworkReleaseIntake({
    repoRoot: repositoryPath,
    releaseRef,
    baselineCommit: QWORK_RELEASE_CASEBOOK_DESIGN_BASELINE_COMMIT,
    casebookPath: path.join(root, 'PRD', QWORK_RELEASE_CASEBOOK_BASENAME),
    casebookSha256,
    sheet: '核心生命线门禁',
    frameworkCommit,
    gitlabReader,
    freshnessSource: 'gitlab-api',
    sourceContracts: QWORK_RELEASE_SOURCE_CONTRACTS,
    now: new Date('2026-09-05T00:00:00.000Z'),
  });
}

const releaseIntake = makeReleaseIntake();
const expectedReleaseRef = QWORK_RELEASE_INTAKE_DEFAULT_REF;
const expectedReleaseHead = QWORK_RELEASE_CASEBOOK_DESIGN_BASELINE_COMMIT;
const releaseHeadObservation = {
  schema_version: QWORK_RELEASE_REF_OBSERVATION_SCHEMA,
  observed_at: '2026-09-05T00:00:00.000Z',
  repository: releaseIntake.release.repository,
  release_ref: expectedReleaseRef,
  release_head: expectedReleaseHead,
  source: 'gitlab-api',
};
const fixtureJsonArtifact = (name, value) => {
  const file = path.join(evidenceFixtureRoot, name);
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
  return {
    path: file,
    sha256: crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'),
  };
};
const releaseIdentityArtifact = fixtureJsonArtifact('release-identity.json', {
  schema_version: QWORK_RELEASE_IDENTITY_SCHEMA,
  captured_at: '2026-09-05T00:00:00.000Z',
  ...identity,
});
const releaseIntakeArtifact = fixtureJsonArtifact('release-intake.json', releaseIntake);
const releaseObservationArtifact = fixtureJsonArtifact('release-observation.json', releaseHeadObservation);
const releaseIntakeSha256 = releaseIntakeArtifact.sha256;
const plan = createQworkReleaseTestPlan({
  casebookPath: path.join(root, 'PRD', QWORK_RELEASE_CASEBOOK_BASENAME),
  casebookSha256: QWORK_RELEASE_CASEBOOK_SHA256,
  frameworkCommit: 'b'.repeat(40),
  releaseIdentity: identity,
  releaseIdentityPath: releaseIdentityArtifact.path,
  releaseIdentitySha256: releaseIdentityArtifact.sha256,
  releaseIntake,
  releaseIntakePath: releaseIntakeArtifact.path,
  releaseIntakeSha256,
  expectedReleaseRef,
  expectedReleaseHead,
  releaseHeadObservation,
  releaseHeadObservationPath: releaseObservationArtifact.path,
  releaseHeadObservationSha256: releaseObservationArtifact.sha256,
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
    casebook: {
      path: sourcePlan.casebook.path,
      sha256: sourcePlan.casebook.sha256,
      sheet: stage.sheet,
      profile: 'mandatory',
    },
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
    cases: caseIds.map((caseId) => ({
      case_id: caseId,
      case_type: 'release-gate-fixture',
      driver: 'fixture-driver',
      fixture_control: 'fixture-adapter',
      executor_route: 'fixture-route',
      contract_sha256: crypto.createHash('sha256').update(`contract:${caseId}`).digest('hex'),
      protocol_ok: true,
      runtime_dispatchable: true,
      directly_runnable_without_controller: true,
      action_count: 1,
      evidence_role_count: 1,
      hard_oracle_count: 1,
    })),
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
    fixture: {
      ok: true,
      requirements: capability(stageId, sourcePlan).cases.map((item) => ({
        case_id: item.case_id,
        driver: item.driver,
        adapter: item.fixture_control,
        executor_route: item.executor_route,
        contract_sha256: item.contract_sha256,
        local_ready: true,
        action_ids: [`${item.case_id}:action-1`],
        evidence_roles: ['before_screenshot'],
        oracle_sha256s: [crypto.createHash('sha256').update(`oracle:${item.case_id}`).digest('hex')],
      })),
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

let externalArtifactSequence = 0;

function jsonExternalArtifact(role, value, directory = evidenceFixtureRoot) {
  externalArtifactSequence += 1;
  const file = path.join(
    directory,
    `${String(externalArtifactSequence).padStart(4, '0')}-${role.replace(/[^a-zA-Z0-9_.-]+/g, '_')}.json`,
  );
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
  return {
    role,
    path: file,
    sha256: crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'),
    type: 'file',
  };
}

function readinessInputs(stageId, {
  capabilityAudit = capability(stageId),
  pretestReport = pretest(stageId),
  sourcePlan = plan,
  intake = releaseIntake,
} = {}) {
  return {
    ...releaseIntakeInputs(sourcePlan, intake),
    plan: sourcePlan,
    stageId,
    capabilityAudit,
    pretest: pretestReport,
    externalArtifacts: [
      jsonExternalArtifact(`${stageId}.readiness.capability_audit`, capabilityAudit),
      jsonExternalArtifact(`${stageId}.readiness.pretest`, pretestReport),
    ],
  };
}

function completionInputs(stageId, trustedStatus = 'trusted_pass') {
  const stage = QWORK_RELEASE_TEST_STAGES.find((item) => item.id === stageId);
  const count = stage.expected_case_count;
  const capabilityReport = capability(stageId);
  const caseIds = capabilityReport.cases.map((item) => item.case_id);
  const runDir = fs.mkdtempSync(path.join(evidenceFixtureRoot, `${stageId.toLowerCase()}-run-`));
  const results = caseIds.map((caseId, index) => {
    const caseCapability = capabilityReport.cases[index];
    const actionId = `${caseId}:action-1`;
    const hardOracle = `oracle:${caseId}`;
    const caseDir = path.join(runDir, 'cases', `${String(index + 1).padStart(3, '0')}-${caseId}`);
    fs.mkdirSync(caseDir, { recursive: true });
    const evidencePath = path.join(caseDir, 'before.png');
    const evidenceBytes = Buffer.concat([
      Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64'),
      Buffer.alloc(128, index),
    ]);
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
    const result = {
      id: caseId,
      case_dir: caseDir,
      contract_version: 'qbot-core-beta/v2',
      case_type: caseCapability.case_type,
      contract_sha256: caseCapability.contract_sha256,
      action_plan: [{ action_id: actionId }],
      precise_assertions: { hard_oracles: [hardOracle] },
      status: 'passed',
      result_category: 'pass',
      execution_provenance: 'executed',
      inherited: false,
      synthetic: false,
      case_execution_recorded: true,
      evidence_roles: ['before_screenshot'],
      evidence_manifest: evidenceManifest,
    };
    fs.writeFileSync(path.join(caseDir, 'case-result.json'), `${JSON.stringify(result, null, 2)}\n`);
    return result;
  });
  const categories = ['trusted_pass', 'trusted_fail', 'trusted_bug', 'trusted_blocked', 'framework_issue', 'case_needs_update', 'needs_llm_review'];
  const trustedCounts = Object.fromEntries(categories.map((category) => [category, 0]));
  trustedCounts[trustedStatus] = count;
  const reviewCategory = {
    trusted_pass: '可信通过-用户可接受',
    trusted_bug: '可信失败-产品Bug候选',
    trusted_blocked: '可信阻塞-环境或数据',
    framework_issue: '不可信-框架问题',
    case_needs_update: '可信执行-case需优化',
  }[trustedStatus] || trustedStatus;
  const trustedReview = {
    counts: { total: count, ...trustedCounts },
    production_release_gate: { all_trusted_pass: trustedStatus === 'trusted_pass' },
    items: results.map((result) => ({
      id: result.id,
      review_category: reviewCategory,
      trusted: trustedStatus !== 'framework_issue',
    })),
  };
  const trustedReviewPath = path.join(runDir, '可信二次复核结果.json');
  fs.writeFileSync(trustedReviewPath, `${JSON.stringify(trustedReview, null, 2)}\n`);
  const inputs = {
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
    trustedReview,
    trustedReviewPath,
    trustedReviewSha256: crypto.createHash('sha256').update(fs.readFileSync(trustedReviewPath)).digest('hex'),
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
  const readinessAudit = auditQworkStageReadiness(readinessInputs(stageId));
  assert.equal(readinessAudit.passed, true, readinessAudit.failures.join(','));
  inputs.readinessAudit = readinessAudit;
  const progressPath = path.join(runDir, 'automation-progress.json');
  const summaryPath = path.join(runDir, 'automation-run-summary.json');
  const metadataPath = path.join(runDir, 'run-metadata.json');
  fs.writeFileSync(progressPath, `${JSON.stringify(inputs.progress, null, 2)}\n`);
  fs.writeFileSync(summaryPath, `${JSON.stringify(inputs.summary, null, 2)}\n`);
  fs.writeFileSync(metadataPath, `${JSON.stringify(inputs.runMetadata, null, 2)}\n`);
  inputs.externalArtifacts = [
    {
      role: `${stageId}.completion.progress`,
      path: progressPath,
      sha256: crypto.createHash('sha256').update(fs.readFileSync(progressPath)).digest('hex'),
      type: 'file',
    },
    {
      role: `${stageId}.completion.summary`,
      path: summaryPath,
      sha256: crypto.createHash('sha256').update(fs.readFileSync(summaryPath)).digest('hex'),
      type: 'file',
    },
    {
      role: `${stageId}.completion.metadata`,
      path: metadataPath,
      sha256: crypto.createHash('sha256').update(fs.readFileSync(metadataPath)).digest('hex'),
      type: 'file',
    },
    {
      role: `${stageId}.completion.trusted_review`,
      path: trustedReviewPath,
      sha256: inputs.trustedReviewSha256,
      type: 'file',
    },
    {
      role: `${stageId}.completion.evidence_tree`,
      path: runDir,
      sha256: crypto.createHash('sha256').update(`fixture-tree:${runDir}`).digest('hex'),
      type: 'directory-tree',
    },
  ];
  return inputs;
}

function rewriteTrustedReview(inputs) {
  fs.writeFileSync(inputs.trustedReviewPath, `${JSON.stringify(inputs.trustedReview, null, 2)}\n`);
  inputs.trustedReviewSha256 = crypto.createHash('sha256')
    .update(fs.readFileSync(inputs.trustedReviewPath))
    .digest('hex');
  return inputs;
}

function rewriteCompletionResult(inputs, index, mutate) {
  mutate(inputs.progress.results[index]);
  inputs.summary.results[index] = structuredClone(inputs.progress.results[index]);
  fs.writeFileSync(
    path.join(inputs.progress.results[index].case_dir, 'case-result.json'),
    `${JSON.stringify(inputs.progress.results[index], null, 2)}\n`,
  );
  return inputs;
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
    releaseHeadObservation,
    releaseHeadObservationPath: '/tmp/release-observation.json',
    releaseHeadObservationSha256: 'e'.repeat(64),
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
  }), /casebook_sha256_mismatch/);
  assert.throws(() => createQworkReleaseTestPlan({
    ...base,
    releaseIntake: makeReleaseIntake({ frameworkCommit: 'a'.repeat(40) }),
  }), /release_intake_invalid:framework_commit_mismatch/);
  assert.throws(() => createQworkReleaseTestPlan({
    ...base,
    releaseIntake: makeReleaseIntake({ releaseRef: 'origin/release/old' }),
  }), /release_ref_mismatch/);
  assert.throws(() => createQworkReleaseTestPlan({
    ...base,
    releaseIntake: makeReleaseIntake({ releaseHead: 'd'.repeat(40) }),
  }), /release_head_mismatch/);
  const notReady = makeReleaseIntake();
  notReady.decision = 'BLOCKED';
  notReady.blockers = ['test blocker'];
  const withoutHash = structuredClone(notReady);
  delete withoutHash.integrity.content_sha256;
  notReady.integrity.content_sha256 = crypto.createHash('sha256').update(stableJson(withoutHash)).digest('hex');
  assert.throws(() => createQworkReleaseTestPlan({ ...base, releaseIntake: notReady }), /decision_BLOCKED/);
});

test('release plan requires an independently sourced release HEAD observation', () => {
  const base = {
    casebookPath: path.join('/tmp', QWORK_RELEASE_CASEBOOK_BASENAME),
    casebookSha256: QWORK_RELEASE_CASEBOOK_SHA256,
    frameworkCommit: 'b'.repeat(40),
    releaseIdentity: identity,
    releaseIntake,
    releaseIntakePath: '/tmp/release-intake.json',
    releaseIntakeSha256,
    expectedReleaseRef,
    expectedReleaseHead,
  };
  assert.throws(() => createQworkReleaseTestPlan(base), /release_head_observation_invalid/);
  assert.throws(() => createQworkReleaseTestPlan({
    ...base,
    releaseHeadObservation: { ...releaseHeadObservation, release_head: 'd'.repeat(40) },
    releaseHeadObservationPath: '/tmp/release-observation.json',
    releaseHeadObservationSha256: 'e'.repeat(64),
  }), /release_observation_release_head_mismatch/);
  assert.throws(() => createQworkReleaseTestPlan({
    ...base,
    releaseHeadObservation,
    releaseHeadObservationPath: base.releaseIntakePath,
    releaseHeadObservationSha256: 'e'.repeat(64),
  }), /release_head_observation_must_be_independent/);
  assert.throws(() => createQworkReleaseTestPlan({
    ...base,
    releaseHeadObservation: { ...releaseHeadObservation, repository: '/tmp/another-repository' },
    releaseHeadObservationPath: '/tmp/release-observation.json',
    releaseHeadObservationSha256: 'e'.repeat(64),
  }), /release_observation_repository_mismatch/);
});

test('release repository binding accepts canonical macOS /var aliases', (t) => {
  const temporaryRepository = fs.mkdtempSync(path.join(os.tmpdir(), 'qwork-release-repository-'));
  try {
    const canonicalRepository = fs.realpathSync(temporaryRepository);
    if (canonicalRepository === temporaryRepository) {
      t.skip('当前平台没有需要归一化的临时目录别名');
      return;
    }
    const canonicalIntake = makeReleaseIntake({ repositoryPath: canonicalRepository });
    const casebookPath = path.join(canonicalRepository, QWORK_RELEASE_CASEBOOK_BASENAME);
    const identityPath = path.join(canonicalRepository, 'release-identity.json');
    const intakePath = path.join(canonicalRepository, 'release-intake.json');
    const observationPath = path.join(canonicalRepository, 'release-observation.json');
    const observation = { ...releaseHeadObservation, repository: temporaryRepository };
    fs.copyFileSync(path.join(root, 'PRD', QWORK_RELEASE_CASEBOOK_BASENAME), casebookPath);
    fs.writeFileSync(identityPath, `${JSON.stringify({
      schema_version: QWORK_RELEASE_IDENTITY_SCHEMA,
      captured_at: '2026-09-05T00:00:00.000Z',
      ...identity,
    }, null, 2)}\n`);
    fs.writeFileSync(intakePath, `${JSON.stringify(canonicalIntake, null, 2)}\n`);
    fs.writeFileSync(observationPath, `${JSON.stringify(observation, null, 2)}\n`);
    const artifactSha256 = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
    assert.doesNotThrow(() => createQworkReleaseTestPlan({
      casebookPath,
      casebookSha256: artifactSha256(casebookPath),
      frameworkCommit: 'b'.repeat(40),
      releaseIdentity: identity,
      releaseIdentityPath: identityPath,
      releaseIdentitySha256: artifactSha256(identityPath),
      releaseIntake: canonicalIntake,
      releaseIntakePath: intakePath,
      releaseIntakeSha256: artifactSha256(intakePath),
      expectedReleaseRef,
      expectedReleaseHead,
      releaseHeadObservation: observation,
      releaseHeadObservationPath: observationPath,
      releaseHeadObservationSha256: artifactSha256(observationPath),
    }));
  } finally {
    fs.rmSync(temporaryRepository, { recursive: true, force: true });
  }
});

test('release state and control integrity reject an unbound legacy plan', () => {
  const unboundPlan = structuredClone(plan);
  unboundPlan.release_intake = null;
  unboundPlan.policy.release_intake_required = false;
  assert.throws(
    () => createQworkReleaseTestState(unboundPlan),
    /plan_release_intake_binding_required/,
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
      new RegExp(scenario.failure),
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
  const audit = auditQworkStageReadiness(readinessInputs('G1'));
  assert.equal(audit.decision, 'READY_TO_RUN');
  const state = applyQworkStageAudit(createQworkReleaseTestState(plan), audit, { plan, phase: 'readiness' });
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
    ...readinessInputs('G4', { capabilityAudit: full, pretestReport: fullPretest }),
    expectedPrefixCaseIds: gate.cases.map((item) => item.case_id),
  });
  assert.equal(accepted.passed, true, accepted.failures.join(','));
  full.cases[0].case_id = 'DRIFTED-GATE-PREFIX';
  fullPretest.casebook.case_ids[0] = 'DRIFTED-GATE-PREFIX';
  const rejected = auditQworkStageReadiness({
    ...readinessInputs('G4', { capabilityAudit: full, pretestReport: fullPretest }),
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
  assert.equal(passed.decision, 'PASS_STAGE', passed.failures.join(','));

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

test('completion requires every trusted review item to explicitly be trusted and pass-classified', () => {
  const inputs = completionInputs('G1');
  delete inputs.trustedReview.items[0].trusted;
  delete inputs.trustedReview.items[1].review_category;
  fs.writeFileSync(inputs.trustedReviewPath, `${JSON.stringify(inputs.trustedReview, null, 2)}\n`);
  inputs.trustedReviewSha256 = crypto.createHash('sha256').update(fs.readFileSync(inputs.trustedReviewPath)).digest('hex');
  const audit = auditQworkStageCompletion({ plan, stageId: 'G1', ...inputs });
  assert.equal(audit.passed, false);
  assert.ok(audit.failures.includes('trusted_review_untrusted_item_present'));
  assert.ok(audit.failures.includes('trusted_review_non_pass_item_present'));
});

test('completion rejects trusted review files outside the run and symlinked evidence ancestors', () => {
  const outsideReview = completionInputs('G1');
  const externalReview = path.join(evidenceFixtureRoot, 'external-review.json');
  fs.copyFileSync(outsideReview.trustedReviewPath, externalReview);
  outsideReview.trustedReviewPath = externalReview;
  outsideReview.trustedReviewSha256 = crypto.createHash('sha256').update(fs.readFileSync(externalReview)).digest('hex');
  const reviewAudit = auditQworkStageCompletion({ plan, stageId: 'G1', ...outsideReview });
  assert.equal(reviewAudit.passed, false);
  assert.ok(reviewAudit.failures.includes('trusted_review_file_invalid'));

  const symlinked = completionInputs('G1');
  const caseDir = symlinked.progress.results[0].case_dir;
  const realCaseDir = `${caseDir}-real`;
  fs.renameSync(caseDir, realCaseDir);
  fs.symlinkSync(realCaseDir, caseDir, 'dir');
  const evidenceAudit = auditQworkStageCompletion({ plan, stageId: 'G1', ...symlinked });
  assert.equal(evidenceAudit.passed, false);
  assert.ok(evidenceAudit.failures.includes('evidence_manifest_incomplete'));
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

test('completion rejects non-passing raw Case status or result category despite green aggregates', () => {
  const variants = [
    ['status', 'failed'],
    ['result_category', 'bug'],
  ];
  for (const [field, value] of variants) {
    const inputs = rewriteCompletionResult(completionInputs('G1'), 0, (result) => {
      result[field] = value;
    });
    const audit = auditQworkStageCompletion({ plan, stageId: 'G1', ...inputs });
    assert.equal(audit.passed, false, `${field}=${value} must fail closed`);
    assert.equal(audit.decision, 'STOP_PIPELINE');
    assert.ok(audit.failures.includes('raw_case_result_not_passed'), audit.failures.join(','));
  }
});

test('completion rejects a run-root framework stop diagnostic even when summaries omit it', () => {
  const inputs = completionInputs('G1');
  fs.writeFileSync(
    path.join(inputs.runDir, 'framework-stop-diagnostic.json'),
    `${JSON.stringify({ schema_version: 'qbot-framework-stop-diagnostic/v1', reason: 'test-stop' })}\n`,
  );
  const audit = auditQworkStageCompletion({ plan, stageId: 'G1', ...inputs });
  assert.equal(audit.passed, false);
  assert.ok(audit.failures.includes('run_framework_stop_diagnostic_present'), audit.failures.join(','));
});

test('completion requires explicit false inherited and synthetic flags on every Case result', () => {
  for (const field of ['inherited', 'synthetic']) {
    const inputs = rewriteCompletionResult(completionInputs('G1'), 0, (result) => {
      delete result[field];
    });
    const audit = auditQworkStageCompletion({ plan, stageId: 'G1', ...inputs });
    assert.equal(audit.passed, false, `missing ${field} must fail closed`);
    assert.ok(audit.failures.includes('result_execution_flags_invalid'), audit.failures.join(','));
  }
});

test('completion rejects conflicting trusted classification fields on the same review item', () => {
  const inputs = completionInputs('G1');
  Object.assign(inputs.trustedReview.items[0], {
    trusted_status: 'trusted_pass',
    classification: 'trusted_bug',
    review_category: '可信通过-用户可接受',
  });
  rewriteTrustedReview(inputs);
  const audit = auditQworkStageCompletion({ plan, stageId: 'G1', ...inputs });
  assert.equal(audit.passed, false);
  assert.ok(audit.failures.includes('trusted_review_classification_conflict'), audit.failures.join(','));
});

test('completion rejects every non-pass trusted count even when pass count and gate claim are green', () => {
  const variants = [
    ['trusted_fail', 'trusted_fail_must_be_zero'],
    ['trusted_bug', 'trusted_bug_must_be_zero'],
    ['trusted_blocked', 'trusted_blocked_must_be_zero'],
    ['framework_issue', 'framework_issue_must_be_zero'],
    ['case_needs_update', 'testcase_issue_must_be_zero'],
    ['needs_llm_review', 'needs_review_must_be_zero'],
  ];
  for (const [field, expectedFailure] of variants) {
    const inputs = completionInputs('G1');
    inputs.trustedReview.counts[field] = 1;
    inputs.trustedReview.counts.trusted_pass = inputs.progress.total;
    inputs.trustedReview.production_release_gate.all_trusted_pass = true;
    rewriteTrustedReview(inputs);
    const audit = auditQworkStageCompletion({ plan, stageId: 'G1', ...inputs });
    assert.equal(audit.passed, false, `${field}>0 must fail closed`);
    assert.ok(audit.failures.includes(expectedFailure), audit.failures.join(','));
  }
});

test('a core gate failure keeps every later stage NOT_STARTED', () => {
  const readiness = auditQworkStageReadiness(readinessInputs('G1'));
  let state = applyQworkStageAudit(createQworkReleaseTestState(plan), readiness, { plan, phase: 'readiness' });
  const failed = auditQworkStageCompletion({
    plan,
    stageId: 'G1',
    ...completionInputs('G1', 'framework_issue'),
  });
  state = applyQworkStageAudit(state, failed, { plan, phase: 'completion' });
  assert.equal(state.decision, 'NO_GO');
  assert.equal(state.stages.G1.status, 'STOPPED');
  for (const stageId of ['G2', 'G3', 'G4', 'G5']) assert.equal(state.stages[stageId].status, 'NOT_STARTED');
  assert.throws(
    () => applyQworkStageAudit(state, readiness, { plan, phase: 'readiness' }),
    /状态已冻结/,
  );
});

test('a stage readiness audit cannot overwrite an existing admission', () => {
  const readiness = auditQworkStageReadiness(readinessInputs('G1'));
  const state = applyQworkStageAudit(createQworkReleaseTestState(plan), readiness, { plan, phase: 'readiness' });
  assert.throws(
    () => applyQworkStageAudit(state, readiness, { plan, phase: 'readiness' }),
    /不得覆盖准入/,
  );
});

test('stage state machine rejects phases that are invalid for G0 and G5', () => {
  const baseState = createQworkReleaseTestState(plan);
  const readyForSoak = structuredClone(baseState);
  for (const stageId of ['G0', 'G1', 'G2', 'G3', 'G4']) readyForSoak.stages[stageId].status = 'PASSED';
  const invalidApplications = [
    {
      state: baseState,
      phase: 'readiness',
      audit: {
        schema_version: 'qbot-qwork-stage-readiness-audit/v1',
        stage_id: 'G0',
        passed: true,
        decision: 'READY_TO_RUN',
        failures: [],
      },
    },
    {
      state: baseState,
      phase: 'completion',
      audit: {
        schema_version: 'qbot-qwork-stage-completion-audit/v1',
        stage_id: 'G0',
        passed: true,
        decision: 'PASS_STAGE',
        failures: [],
      },
    },
    {
      state: readyForSoak,
      phase: 'readiness',
      audit: {
        schema_version: 'qbot-qwork-soak-completion-audit/v1',
        stage_id: 'G5',
        passed: true,
        decision: 'READY_TO_RUN',
        failures: [],
      },
    },
  ];
  for (const application of invalidApplications) {
    const before = structuredClone(application.state);
    assert.throws(() => applyQworkStageAudit(
      application.state,
      application.audit,
      { phase: application.phase },
    ));
    assert.deepEqual(application.state, before);
  }
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

function soakExternalArtifacts(fixture) {
  return [
    {
      role: 'G5.soak.report',
      path: fixture.reportPath,
      sha256: fixture.reportSha256,
      type: 'file',
    },
    ...fixture.report.external_artifacts.map((descriptor, index) => ({
      role: `G5.soak.artifact.${String(index + 1).padStart(6, '0')}`,
      path: descriptor.path,
      sha256: descriptor.sha256,
      type: 'file',
    })),
  ];
}

function soakInputs() {
  const fixture = createQworkSoakFixture({
    root: fs.mkdtempSync(path.join(evidenceFixtureRoot, 'soak-')),
    releaseIdentity: plan.release_identity,
    frameworkCommit: plan.framework.commit,
  });
  return {
    fixture,
    soak: fixture.report,
    soakReportPath: fixture.reportPath,
    soakReportSha256: fixture.reportSha256,
    externalArtifacts: soakExternalArtifacts(fixture),
  };
}

function rewriteSoakReport(inputs) {
  persistQworkSoakFixture(inputs.fixture);
  inputs.soakReportSha256 = inputs.fixture.reportSha256;
  inputs.externalArtifacts = soakExternalArtifacts(inputs.fixture);
  return inputs;
}

test('soak requires 100 tasks, three restarts and exact identity', () => {
  const valid = soakInputs();
  const passed = auditQworkSoakCompletion({ plan, ...valid });
  assert.equal(passed.decision, 'PASS_STAGE', passed.failures.join(','));
  const invalid = soakInputs();
  invalid.soak.tasks.pop();
  invalid.soak.restarts.pop();
  invalid.soak.crashes.push({ crash_id: 'crash-1' });
  invalid.soak.resource_usage.leak_detected = true;
  invalid.soak.resource_usage.verdict = 'leak';
  invalid.soak.evidence_complete = false;
  invalid.soak.passed = false;
  invalid.soak.release_identity_sha256 = '0'.repeat(64);
  rewriteSoakReport(invalid);
  const failed = auditQworkSoakCompletion({
    plan,
    ...invalid,
  });
  assert.equal(failed.decision, 'STOP_PIPELINE');
  assert.ok(failed.failures.length >= 6);
});

test('soak rejects 100 tasks that reuse one synthetic time window', () => {
  const inputs = soakInputs();
  for (const task of inputs.soak.tasks) {
    task.started_at = '2026-09-05T00:00:00.000Z';
    task.ended_at = '2026-09-05T00:01:00.000Z';
  }
  rewriteSoakReport(inputs);
  const audit = auditQworkSoakCompletion({ plan, ...inputs });
  assert.equal(audit.passed, false);
  assert.ok(
    audit.failures.some((failure) => failure.startsWith('soak_task_execution_invalid:')),
    audit.failures.join(','),
  );
  assert.ok(
    audit.failures.some((failure) => failure.startsWith('soak_task_serial_timeline_invalid:')),
    audit.failures.join(','),
  );
});

test('soak rejects restarts that reuse PID, session and CDP transitions under new IDs', () => {
  const inputs = soakInputs();
  const repeatedBefore = structuredClone(inputs.soak.restarts[0].before);
  const repeatedAfter = structuredClone(inputs.soak.restarts[0].after);
  for (const restart of inputs.soak.restarts) {
    restart.before = structuredClone(repeatedBefore);
    restart.after = structuredClone(repeatedAfter);
    rewriteQworkSoakArtifact(inputs.fixture, restart.artifacts.restart_receipt, (receipt) => {
      receipt.before = structuredClone(repeatedBefore);
      receipt.after = structuredClone(repeatedAfter);
    });
    for (const [observationId, context] of [
      [restart.identity_observation_before_id, repeatedBefore],
      [restart.identity_observation_after_id, repeatedAfter],
    ]) {
      const observation = inputs.soak.identity_observations.find(
        (item) => item.observation_id === observationId,
      );
      observation.context = structuredClone(context);
      rewriteQworkSoakArtifact(
        inputs.fixture,
        observation.artifacts.identity_readback,
        (readback) => { readback.context = structuredClone(context); },
      );
    }
  }
  rewriteSoakReport(inputs);
  const audit = auditQworkSoakCompletion({ plan, ...inputs });
  assert.equal(audit.passed, false);
  assert.ok(
    audit.failures.some((failure) => failure.startsWith('soak_restart_continuity_invalid:')),
    audit.failures.join(','),
  );
});

test('soak requires each restart to bind its own exact identity observation', () => {
  const inputs = soakInputs();
  inputs.soak.restarts[0].identity_observation_after_id =
    inputs.soak.restarts[1].identity_observation_after_id;
  rewriteSoakReport(inputs);
  const audit = auditQworkSoakCompletion({ plan, ...inputs });
  assert.equal(audit.passed, false);
  assert.ok(
    audit.failures.includes('soak_restart_after_observation_invalid:restart-1'),
    audit.failures.join(','),
  );
});

test('soak rejects self-declared RSS thresholds and non-monotonic resource samples', () => {
  const inflated = soakInputs();
  rewriteQworkSoakArtifact(
    inflated.fixture,
    inflated.fixture.artifactIds.resourceUsage,
    (resource) => { resource.thresholds.rss_growth_bytes = Number.MAX_SAFE_INTEGER; },
    { mirror: 'resource_usage' },
  );
  rewriteSoakReport(inflated);
  const inflatedAudit = auditQworkSoakCompletion({ plan, ...inflated });
  assert.equal(inflatedAudit.passed, false);
  assert.ok(inflatedAudit.failures.includes('soak_resource_leak_not_proven_absent'), inflatedAudit.failures.join(','));

  const reversed = soakInputs();
  rewriteQworkSoakArtifact(
    reversed.fixture,
    reversed.fixture.artifactIds.resourceUsage,
    (resource) => { resource.samples[1].observed_at = '2026-09-04T23:59:59.000Z'; },
    { mirror: 'resource_usage' },
  );
  rewriteSoakReport(reversed);
  const reversedAudit = auditQworkSoakCompletion({ plan, ...reversed });
  assert.equal(reversedAudit.passed, false);
  assert.ok(
    reversedAudit.failures.some((failure) => failure.startsWith('soak_resource_sample_invalid:')),
    reversedAudit.failures.join(','),
  );
});

test('soak requires an independent crash ledger even when aggregate crash fields are zero', () => {
  const inputs = soakInputs();
  delete inputs.soak.crash_ledger;
  rewriteSoakReport(inputs);
  const audit = auditQworkSoakCompletion({ plan, ...inputs });
  assert.equal(audit.passed, false);
  assert.ok(
    audit.failures.some((failure) => failure.startsWith('soak_crash_ledger')),
    audit.failures.join(','),
  );
});

test('orchestrator persists and verifies the forward event hash chain', () => {
  const temporaryRoot = fs.realpathSync(
    fs.mkdtempSync(path.join(os.tmpdir(), 'qwork-release-orchestrator-')),
  );
  const remote = path.join(temporaryRoot, 'remote.git');
  const work = path.join(temporaryRoot, 'work');
  const stateDir = path.join(temporaryRoot, 'state');
  const canonicalOrigin = 'https://gitlab.daikuan.qihoo.net/songrongxin/deepbankv2.git';
  const gitTestEnvironment = {
    ...process.env,
    GIT_CONFIG_COUNT: '1',
    GIT_CONFIG_KEY_0: `url.file://${remote}.insteadOf`,
    GIT_CONFIG_VALUE_0: canonicalOrigin,
  };
  const run = (command, args, cwd = work) => spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    env: gitTestEnvironment,
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
    assert.equal(run('git', [
      'remote',
      'set-url',
      'origin',
      canonicalOrigin,
    ]).status, 0);

    const casebook = path.join(temporaryRoot, QWORK_RELEASE_CASEBOOK_BASENAME);
    const identityFile = path.join(temporaryRoot, 'release-identity.json');
    const releaseIntakeFile = path.join(temporaryRoot, 'release-intake.json');
    const releaseObservationFile = path.join(temporaryRoot, 'release-observation.json');
    const frameworkCommit = run('git', ['rev-parse', 'HEAD']).stdout.trim();
    const currentReleaseIntake = makeReleaseIntake({
      frameworkCommit,
      releaseHead: frameworkCommit,
      repositoryPath: work,
    });
    const expectedReleaseArguments = [
      '--expected-release-observation', releaseObservationFile,
      '--expected-release-ref', QWORK_RELEASE_INTAKE_DEFAULT_REF,
      '--expected-release-head', frameworkCommit,
    ];
    fs.copyFileSync(path.join(root, 'PRD', QWORK_RELEASE_CASEBOOK_BASENAME), casebook);
    fs.writeFileSync(identityFile, `${JSON.stringify({
      schema_version: QWORK_RELEASE_IDENTITY_SCHEMA,
      captured_at: '2026-09-05T00:00:00.000Z',
      ...identity,
    })}\n`);
    fs.writeFileSync(releaseObservationFile, `${JSON.stringify({
      schema_version: QWORK_RELEASE_REF_OBSERVATION_SCHEMA,
      observed_at: '2026-09-05T00:00:00.000Z',
      repository: work,
      release_ref: QWORK_RELEASE_INTAKE_DEFAULT_REF,
      release_head: frameworkCommit,
      source: 'git-rev-parse-after-fetch',
    })}\n`);

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
      '--expected-release-observation', releaseObservationFile,
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
      repositoryPath: work,
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
      repositoryPath: work,
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
    const linkedRepository = path.join(temporaryRoot, 'work-link');
    fs.symlinkSync(work, linkedRepository, 'dir');
    const originalObservation = JSON.parse(fs.readFileSync(releaseObservationFile, 'utf8'));
    fs.writeFileSync(releaseObservationFile, `${JSON.stringify({
      ...originalObservation,
      repository: linkedRepository,
    })}\n`);
    const symlinkedRepositoryInit = run(process.execPath, [
      orchestrator,
      'init',
      '--state-dir', stateDir,
      '--casebook', casebook,
      '--release-identity', identityFile,
      '--release-intake', releaseIntakeFile,
      ...expectedReleaseArguments,
    ]);
    assert.notEqual(symlinkedRepositoryInit.status, 0);
    assert.match(symlinkedRepositoryInit.stderr, /路径祖先不能是符号链接/);
    assert.equal(fs.existsSync(stateDir), false);
    fs.writeFileSync(releaseObservationFile, `${JSON.stringify(originalObservation)}\n`);

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
        repositoryPath: work,
      }))}\n`),
      /release_intake_release_head_mismatch/,
    );
    expectReadinessRejection(
      () => fs.writeFileSync(releaseIntakeFile, `${JSON.stringify(makeReleaseIntake({
        frameworkCommit,
        releaseHead: frameworkCommit,
        casebookSha256: 'a'.repeat(64),
        repositoryPath: work,
      }))}\n`),
      /release_intake_casebook_sha256_mismatch/,
    );
    expectReadinessRejection(
      () => fs.writeFileSync(releaseIntakeFile, `${JSON.stringify(makeReleaseIntake({
        frameworkCommit: 'a'.repeat(40),
        releaseHead: frameworkCommit,
        repositoryPath: work,
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

    const originalCasebook = fs.readFileSync(casebook);
    fs.appendFileSync(casebook, 'tampered');
    const casebookRejected = run(process.execPath, readinessArguments);
    assert.notEqual(casebookRejected.status, 0);
    assert.match(casebookRejected.stderr, /Casebook SHA-256 已漂移/);
    assertControlStateUnchanged();
    fs.writeFileSync(casebook, originalCasebook);

    fs.appendFileSync(path.join(work, 'README.md'), 'tracked drift\n');
    const gitRejected = run(process.execPath, readinessArguments);
    assert.notEqual(gitRejected.status, 0);
    assert.match(gitRejected.stderr, /Git 身份不满足/);
    assertControlStateUnchanged();
    fs.writeFileSync(path.join(work, 'README.md'), 'temporary release orchestrator repository\n');

    const originalObservationText = fs.readFileSync(releaseObservationFile, 'utf8');
    fs.writeFileSync(releaseObservationFile, `${JSON.stringify({
      ...JSON.parse(originalObservationText),
      release_head: 'd'.repeat(40),
    })}\n`);
    const observationRejected = run(process.execPath, readinessArguments);
    assert.notEqual(observationRejected.status, 0);
    assert.match(observationRejected.stderr, /release HEAD 观测绑定校验失败/);
    assertControlStateUnchanged();
    fs.writeFileSync(releaseObservationFile, originalObservationText);

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
    const stateFile = path.join(stateDir, 'release-test-state.json');
    const integrityFile = path.join(stateDir, 'release-test-integrity.json');
    const originalStateText = fs.readFileSync(stateFile, 'utf8');
    const originalIntegrityText = fs.readFileSync(integrityFile, 'utf8');
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
    const forgedIntegrity = JSON.parse(fs.readFileSync(integrityFile, 'utf8'));
    forgedIntegrity.last_event_sha256 = crypto.createHash('sha256').update(fs.readFileSync(eventFile)).digest('hex');
    fs.writeFileSync(integrityFile, `${JSON.stringify(forgedIntegrity, null, 2)}\n`);
    const revisionRejected = run(process.execPath, [orchestrator, 'status', '--state-dir', stateDir]);
    assert.notEqual(revisionRejected.status, 0);
    assert.match(revisionRejected.stderr, /event_revision_mismatch/);

    fs.writeFileSync(eventFile, originalEventText);
    fs.writeFileSync(stateFile, originalStateText);
    fs.writeFileSync(integrityFile, originalIntegrityText);
    const semanticForgery = JSON.parse(originalEventText);
    semanticForgery.state_after.updated_at = '2099-01-01T00:00:00.000Z';
    semanticForgery.state_sha256_after = qworkReleaseIdentityFingerprint(semanticForgery.state_after);
    fs.writeFileSync(eventFile, `${JSON.stringify(semanticForgery, null, 2)}\n`);
    const forgedState = semanticForgery.state_after;
    fs.writeFileSync(stateFile, `${JSON.stringify(forgedState, null, 2)}\n`);
    const semanticIntegrity = JSON.parse(originalIntegrityText);
    semanticIntegrity.state_sha256 = semanticForgery.state_sha256_after;
    semanticIntegrity.last_event_sha256 = crypto.createHash('sha256').update(fs.readFileSync(eventFile)).digest('hex');
    fs.writeFileSync(integrityFile, `${JSON.stringify(semanticIntegrity, null, 2)}\n`);
    const semanticRejected = run(process.execPath, [orchestrator, 'status', '--state-dir', stateDir]);
    assert.notEqual(semanticRejected.status, 0);
    assert.match(semanticRejected.stderr, /event_semantic_replay_mismatch/);
  } finally {
    fs.rmSync(temporaryRoot, { recursive: true, force: true });
  }
});
