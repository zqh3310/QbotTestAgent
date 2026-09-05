import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {
  QWORK_RELEASE_INTAKE_DEFAULT_REF,
  scanQworkReleaseIntake,
} from '../../src/lib/qwork-release-intake.mjs';
import {
  QWORK_RELEASE_SOURCE_CONTRACTS,
  releaseSourceContractProtectedPaths,
  resolveCurrentReleaseHeaderContract,
} from '../../src/lib/qwork-release-source-contracts.mjs';
import {
  QWORK_MR1552_MERGE_COMMIT_SHA,
  QWORK_MR1559_MERGE_COMMIT_SHA,
} from '../../src/lib/qwork-release-blocking-risks.mjs';
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
  qworkReleaseIdentityFingerprint,
} from '../../src/lib/qwork-release-test-plan.mjs';
import { createQworkSoakFixture } from './qwork-soak-fixture.mjs';

const EVENT_SCHEMA = 'qbot-qwork-release-test-event/v2';
const DIRECTORY_SHA256 = sha256Bytes(Buffer.from('directory'));
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64',
);

export const GRAY_GATE_FIXTURE_IDENTITY = Object.freeze({
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
});

function sha256Bytes(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

function sha256File(file) {
  return sha256Bytes(fs.readFileSync(file));
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
  return { path: fs.realpathSync(file), sha256: sha256File(file) };
}

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
    if (line && !linesByPath.get(filePath).includes(line)) linesByPath.get(filePath).push(line);
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
    ))) addLine(binding.path, binding.addition?.source);
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

function makeReleaseIntake(repositoryRoot, frameworkCommit) {
  const releaseHead = QWORK_RELEASE_CASEBOOK_DESIGN_BASELINE_COMMIT;
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
        return { compare_timeout: false, commits: [] };
      }
      if (QWORK_RELEASE_SOURCE_CONTRACTS.some((contract) => contract.merge_commit_sha === from)
        && to === releaseHead) {
        return { compare_timeout: false, commits: [{ id: releaseHead, parent_ids: [from] }] };
      }
      if (from === releaseHead && blockingRiskMerges.has(to)) {
        return { compare_timeout: false, commits: [{ id: to, parent_ids: [releaseHead] }] };
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
    repoRoot: repositoryRoot,
    releaseRef: QWORK_RELEASE_INTAKE_DEFAULT_REF,
    baselineCommit: releaseHead,
    casebookPath: path.join(repositoryRoot, 'PRD', QWORK_RELEASE_CASEBOOK_BASENAME),
    casebookSha256: QWORK_RELEASE_CASEBOOK_SHA256,
    sheet: '核心生命线门禁',
    frameworkCommit,
    gitlabReader,
    freshnessSource: 'gitlab-api',
    sourceContracts: QWORK_RELEASE_SOURCE_CONTRACTS,
    now: new Date('2026-09-05T00:00:00.000Z'),
  });
}

function capability(stageId, plan) {
  const stage = QWORK_RELEASE_TEST_STAGES.find((item) => item.id === stageId);
  const caseIds = [...stage.expected_case_ids];
  return {
    schema_version: 'qbot-core-beta-capability-audit/v2',
    casebook: {
      path: plan.casebook.path,
      sha256: plan.casebook.sha256,
      sheet: stage.sheet,
      profile: 'mandatory',
    },
    protocol: { ok: true, case_count: stage.expected_case_count, executable_count: stage.expected_case_count },
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
      contract_sha256: sha256Bytes(Buffer.from(`contract:${caseId}`)),
      protocol_ok: true,
      runtime_dispatchable: true,
      directly_runnable_without_controller: true,
      action_count: 1,
      evidence_role_count: 1,
      hard_oracle_count: 1,
    })),
  };
}

function pretest(stageId, plan) {
  const stage = QWORK_RELEASE_TEST_STAGES.find((item) => item.id === stageId);
  const capabilityReport = capability(stageId, plan);
  const checks = [
    'git_branch_main', 'git_head_matches_origin_main', 'git_tracked_clean',
    'git_framework_entrypoints_tracked', 'single_runner_precondition', 'root_framework_check',
    'teams_framework_check', 'casebook_exists', 'casebook_git_tracked', 'casebook_sha256',
    'casebook_exact_sheet_export', 'qwork_release_intake', 'case_count', 'case_id_unique',
    'scoped_execution_not_implicit', 'core_beta_protocol', 'release_identity_inputs',
    'fixture_controller_contract', 'teams_app', 'teams_release_identity', 'managed_live_session',
    'managed_session_process', 'control_plane_identity', 'qwork_control_plane_health',
    'qwork_backend_identity', 'teams_cdp', 'qwork_target_logged_in', 'qwork_public_capabilities',
    'qwork_control_plane_identity', 'qwork_release_identity', 'qwork_runtime_release_status',
    'qwork_runtime_release_identity', 'qwork_runtime_update_activation_safe',
    'qwork_host_runtime_compatibility', 'qwork_release_artifact_identity',
    'qwork_release_identity_observed_matches_expected', 'frozen_product_identity_complete',
    'frozen_product_identity_hashes', 'release_identity_observed_matches_expected',
  ];
  return {
    schema_version: 'qbot-core-beta-pretest/v1',
    status: 'READY',
    lane: 'teams',
    production_gate: true,
    release_gate_eligible: true,
    blockers: [],
    release_intake: {
      sha256: plan.release_intake.sha256,
      content_sha256: plan.release_intake.content_sha256,
      release_head: plan.release_intake.release_head,
    },
    checks: checks.map((id) => ({ id, status: 'passed', detail: 'test fixture' })),
    framework: { head: plan.framework.commit, origin_main: plan.framework.commit, tracked_dirty: '' },
    casebook: {
      path: plan.casebook.path,
      profile: 'mandatory',
      sha256: plan.casebook.sha256,
      sheet: stage.sheet,
      case_count: stage.expected_case_count,
      expected_count: stage.expected_case_count,
      case_ids: capabilityReport.cases.map((item) => item.case_id),
    },
    fixture: {
      ok: true,
      requirements: capabilityReport.cases.map((item) => ({
        case_id: item.case_id,
        driver: item.driver,
        adapter: item.fixture_control,
        executor_route: item.executor_route,
        contract_sha256: item.contract_sha256,
        local_ready: true,
        action_ids: [`${item.case_id}:action-1`],
        evidence_roles: ['before_screenshot'],
        oracle_sha256s: [sha256Bytes(Buffer.from(`oracle:${item.case_id}`))],
      })),
    },
    release_identity: {
      expected: structuredClone(plan.release_identity),
      observed: structuredClone(plan.release_identity),
      fingerprint: plan.release_identity_sha256,
      observed_fingerprint: plan.release_identity_sha256,
    },
    runtime: {
      teams: {
        version: plan.release_identity.teams_version,
        build: plan.release_identity.teams_build,
      },
      session: { control_plane_origin: plan.release_identity.control_plane_origin },
      teams_inspection: { public_capabilities: { ok: true, value_type: 'object' } },
      control_plane_health: {
        ok: true,
        control_plane_origin: plan.release_identity.control_plane_origin,
        http_ok: true,
        http_status: 200,
        ready: true,
        environment: 'sit',
        expected_environment: 'sit',
        environment_matches: true,
        fingerprint: 'ae3b6cafbc5ed123',
        observed_backend_version: plan.release_identity.backend_version,
        expected_backend_version: plan.release_identity.backend_version,
        backend_identity_matches: true,
        checks: { db: true, auth: true },
        auth: { ready: true, provider_id: 'lingxi', can_login: true },
      },
      qwork: {
        version: plan.release_identity.qwork_version,
        url: `file:///tmp/ui/${plan.release_identity.qwork_version}/index.html`,
        runtime_release_status: {
          ok: true,
          value_type: 'object',
          release_id: plan.release_identity.qwork_version,
          version: plan.release_identity.qwork_version,
          update_phase: 'idle',
          prepared_release_present: true,
          prepared_release: null,
          loaded_runtime: {
            release_id: plan.release_identity.qwork_version,
            version: plan.release_identity.qwork_version,
          },
          host_runtime_compatibility: {
            runtime_release_id: plan.release_identity.qwork_version,
            runtime_version: plan.release_identity.qwork_version,
          },
        },
        runtime_release_assessment: { release_identity_matches: true, update_activation_safe: true },
        release_identity_readback: {
          schema_version: 'qwork-release-identity-readback/v1',
          ok: true,
          observed_sha256: '3'.repeat(64),
          observed: {
            qwork_version: plan.release_identity.qwork_version,
            prompt_policy_version: plan.release_identity.prompt_policy_version,
            feature_flags_hash: plan.release_identity.feature_flags_hash,
            qwork_ui_git_commit: plan.release_identity.qwork_ui_git_commit,
            qwork_build_id: plan.release_identity.qwork_build_id,
            qwork_release_manifest_sha256: plan.release_identity.qwork_release_manifest_sha256,
          },
          consistency: { ok: true, errors: [] },
          provenance: {},
        },
        release_identity_assessment: { ok: true, readback_ok: true, mismatches: [] },
      },
    },
  };
}

function directoryTreeSha(root) {
  const entries = [{ path: '.', type: 'directory', bytes: 0, sha256: DIRECTORY_SHA256 }];
  const walk = (current, relativeRoot = '') => {
    for (const name of fs.readdirSync(current).sort()) {
      const absolute = path.join(current, name);
      const relative = path.join(relativeRoot, name).split(path.sep).join('/');
      const stat = fs.lstatSync(absolute);
      if (stat.isDirectory()) {
        entries.push({ path: relative, type: 'directory', bytes: 0, sha256: DIRECTORY_SHA256 });
        walk(absolute, relative);
      } else if (stat.isFile()) {
        const bytes = fs.readFileSync(absolute);
        entries.push({ path: relative, type: 'file', bytes: bytes.length, sha256: sha256Bytes(bytes) });
      } else {
        throw new Error(`unsupported gray-gate fixture entry: ${absolute}`);
      }
    }
  };
  walk(root);
  return sha256Bytes(Buffer.from(JSON.stringify(entries)));
}

function makeReadinessArtifacts(stageId, plan, directory) {
  const capabilityReport = capability(stageId, plan);
  const pretestReport = pretest(stageId, plan);
  const capabilityArtifact = writeJson(path.join(directory, `${stageId}-capability.json`), capabilityReport);
  const pretestArtifact = writeJson(path.join(directory, `${stageId}-pretest.json`), pretestReport);
  return {
    capabilityReport,
    pretestReport,
    artifacts: [
      { role: `${stageId}.readiness.capability_audit`, ...capabilityArtifact, type: 'file' },
      { role: `${stageId}.readiness.pretest`, ...pretestArtifact, type: 'file' },
    ],
  };
}

function makeCompletionArtifacts({
  root,
  stageId,
  plan,
  readinessAudit,
  marker,
  trustedReviewPayloadNonce = marker,
}) {
  const stage = QWORK_RELEASE_TEST_STAGES.find((item) => item.id === stageId);
  const capabilityReport = capability(stageId, plan);
  const caseIds = capabilityReport.cases.map((item) => item.case_id);
  const runDir = path.join(root, marker);
  fs.mkdirSync(path.join(runDir, 'cases'), { recursive: true });
  const results = caseIds.map((caseId, index) => {
    const caseCapability = capabilityReport.cases[index];
    const caseDir = path.join(runDir, 'cases', `${String(index + 1).padStart(3, '0')}-${caseId}`);
    fs.mkdirSync(caseDir, { recursive: true });
    const evidencePath = path.join(caseDir, 'before.png');
    const evidenceBytes = Buffer.concat([
      PNG,
      Buffer.alloc(128, index),
      Buffer.from(`\n${marker}:${caseId}\n`),
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
        sha256: sha256Bytes(evidenceBytes),
        valid: true,
        missing: false,
      }],
    };
    writeJson(path.join(caseDir, 'evidence-manifest.json'), evidenceManifest);
    const result = {
      id: caseId,
      case_dir: caseDir,
      contract_version: 'qbot-core-beta/v2',
      case_type: caseCapability.case_type,
      contract_sha256: caseCapability.contract_sha256,
      action_plan: [{ action_id: `${caseId}:action-1` }],
      precise_assertions: { hard_oracles: [`oracle:${caseId}`] },
      status: 'passed',
      result_category: 'pass',
      execution_provenance: 'executed',
      inherited: false,
      synthetic: false,
      case_execution_recorded: true,
      evidence_roles: ['before_screenshot'],
      evidence_manifest: evidenceManifest,
    };
    writeJson(path.join(caseDir, 'case-result.json'), result);
    return result;
  });
  const trustedReview = {
    run_provenance: { fixture_marker: trustedReviewPayloadNonce },
    counts: {
      total: stage.expected_case_count,
      trusted_pass: stage.expected_case_count,
      trusted_fail: 0,
      trusted_bug: 0,
      trusted_blocked: 0,
      framework_issue: 0,
      case_needs_update: 0,
      needs_llm_review: 0,
    },
    production_release_gate: { all_trusted_pass: true },
    items: results.map((result) => ({
      id: result.id,
      review_category: '可信通过-用户可接受',
      trusted: true,
    })),
  };
  const progress = { total: stage.expected_case_count, completed: stage.expected_case_count, results };
  const summary = {
    status: 'passed',
    counts: {
      total: stage.expected_case_count,
      passed: stage.expected_case_count,
      failed: 0,
      blocked: 0,
      needs_llm_review: 0,
      other: 0,
    },
    ended_at: '2026-09-05T00:00:00.000Z',
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
      planned: stage.expected_case_count,
      observed: stage.expected_case_count,
      completed: stage.expected_case_count,
      unexecuted: 0,
      synthetic_diagnostics: 0,
    },
  };
  const identity = plan.release_identity;
  const runMetadata = {
    selected_case_ids: caseIds,
    model_tier: 'M3',
    profile: { mode: 'live', alias: `/tmp/${marker}-profile` },
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
    release_observation_checks: ['startup', 'run-final'].map((phase) => ({
      phase,
      ok: true,
      observed_sha256: '3'.repeat(64),
      state_sha256: '4'.repeat(64),
      envelope_sha256: identity.qwork_release_manifest_sha256,
    })),
    sources: { framework: { commit: plan.framework.commit, dirty: false } },
    artifacts: { casebook_sha256: plan.casebook.sha256 },
    fixture_marker: marker,
  };
  const progressArtifact = writeJson(path.join(runDir, 'automation-progress.json'), progress);
  const summaryArtifact = writeJson(path.join(runDir, 'automation-run-summary.json'), summary);
  const metadataArtifact = writeJson(path.join(runDir, 'run-metadata.json'), runMetadata);
  const reviewArtifact = writeJson(path.join(runDir, '可信二次复核结果.json'), trustedReview);
  const markerFile = path.join(runDir, 'fixture-marker.txt');
  fs.writeFileSync(markerFile, `${marker}\n`);
  const externalArtifacts = [
    { role: `${stageId}.completion.progress`, ...progressArtifact, type: 'file' },
    { role: `${stageId}.completion.summary`, ...summaryArtifact, type: 'file' },
    { role: `${stageId}.completion.metadata`, ...metadataArtifact, type: 'file' },
    { role: `${stageId}.completion.trusted_review`, ...reviewArtifact, type: 'file' },
    {
      role: `${stageId}.completion.evidence_tree`,
      path: fs.realpathSync(runDir),
      sha256: directoryTreeSha(runDir),
      type: 'directory-tree',
    },
  ];
  const audit = auditQworkStageCompletion({
    plan,
    stageId,
    readinessAudit,
    progress,
    summary,
    trustedReview,
    runMetadata,
    runDir,
    trustedReviewPath: reviewArtifact.path,
    trustedReviewSha256: reviewArtifact.sha256,
    externalArtifacts,
    generatedAt: '2026-09-05T00:00:00.000Z',
  });
  if (!audit.passed) throw new Error(`${stageId} completion fixture invalid: ${audit.failures.join(',')}`);
  return {
    audit,
    runDir: fs.realpathSync(runDir),
    trustedReviewPath: reviewArtifact.path,
    evidenceFile: results[0].evidence_manifest.evidence[0].path,
    markerFile,
  };
}

function soakExternalArtifacts(fixture) {
  return [
    { role: 'G5.soak.report', path: fixture.reportPath, sha256: fixture.reportSha256, type: 'file' },
    ...fixture.report.external_artifacts.map((descriptor, index) => ({
      role: `G5.soak.artifact.${String(index + 1).padStart(6, '0')}`,
      path: descriptor.path,
      sha256: descriptor.sha256,
      type: 'file',
    })),
  ];
}

function appendEvent(context, audit, phase, recordedAt) {
  const stateBefore = structuredClone(context.state);
  const stateAfter = applyQworkStageAudit(context.state, audit, {
    plan: context.plan,
    phase,
    updatedAt: recordedAt,
    externalArtifacts: audit.external_artifacts,
  });
  const index = context.events.length + 1;
  const event = {
    schema_version: EVENT_SCHEMA,
    index,
    recorded_at: recordedAt,
    stage_id: audit.stage_id,
    phase,
    plan_sha256: stateAfter.plan_sha256,
    state_revision_before: stateBefore.revision,
    state_revision_after: stateAfter.revision,
    state_sha256_before: qworkReleaseIdentityFingerprint(stateBefore),
    state_sha256_after: qworkReleaseIdentityFingerprint(stateAfter),
    previous_event_sha256: context.previousEventSha256,
    state_before: stateBefore,
    state_after: structuredClone(stateAfter),
    audit,
  };
  const name = `${String(index).padStart(4, '0')}-${audit.stage_id}-${phase}.json`;
  const artifact = writeJson(path.join(context.controlDir, 'events', name), event);
  context.state = stateAfter;
  context.previousEventSha256 = artifact.sha256;
  context.events.push({ name, path: artifact.path, sha256: artifact.sha256, event });
  return context.events.at(-1);
}

function createPlan({ repositoryRoot, sourceDir, releaseIntake, frameworkCommit }) {
  const identityArtifact = writeJson(path.join(sourceDir, 'release-identity.json'), {
    schema_version: QWORK_RELEASE_IDENTITY_SCHEMA,
    captured_at: '2026-09-05T00:00:00.000Z',
    ...GRAY_GATE_FIXTURE_IDENTITY,
  });
  const intakeArtifact = writeJson(path.join(sourceDir, 'release-intake.json'), releaseIntake);
  const releaseHeadObservation = {
    schema_version: QWORK_RELEASE_REF_OBSERVATION_SCHEMA,
    observed_at: '2026-09-05T00:00:00.000Z',
    repository: releaseIntake.release.repository,
    release_ref: QWORK_RELEASE_INTAKE_DEFAULT_REF,
    release_head: QWORK_RELEASE_CASEBOOK_DESIGN_BASELINE_COMMIT,
    source: 'gitlab-api',
  };
  const observationArtifact = writeJson(
    path.join(sourceDir, 'release-observation.json'),
    releaseHeadObservation,
  );
  return createQworkReleaseTestPlan({
    casebookPath: path.join(repositoryRoot, 'PRD', QWORK_RELEASE_CASEBOOK_BASENAME),
    casebookSha256: QWORK_RELEASE_CASEBOOK_SHA256,
    frameworkCommit,
    releaseIdentity: GRAY_GATE_FIXTURE_IDENTITY,
    releaseIdentityPath: identityArtifact.path,
    releaseIdentitySha256: identityArtifact.sha256,
    releaseIntake,
    releaseIntakePath: intakeArtifact.path,
    releaseIntakeSha256: intakeArtifact.sha256,
    expectedReleaseRef: QWORK_RELEASE_INTAKE_DEFAULT_REF,
    expectedReleaseHead: QWORK_RELEASE_CASEBOOK_DESIGN_BASELINE_COMMIT,
    releaseHeadObservation,
    releaseHeadObservationPath: observationArtifact.path,
    releaseHeadObservationSha256: observationArtifact.sha256,
  });
}

function createControlTree({
  fixtureRoot,
  repositoryRoot,
  releaseIntake,
  frameworkCommit,
  index,
  targetStage,
  includeSoak,
  targetRunId = '',
  targetTrustedReviewPayloadNonce = '',
}) {
  const treeId = `candidate-${String(index).padStart(2, '0')}`;
  const controlDir = path.join(fixtureRoot, 'controls', treeId);
  const sourceDir = path.join(fixtureRoot, 'sources', treeId);
  const runRoot = path.join(fixtureRoot, 'runs', treeId);
  fs.mkdirSync(path.join(controlDir, 'events'), { recursive: true });
  fs.mkdirSync(sourceDir, { recursive: true });
  fs.mkdirSync(runRoot, { recursive: true });
  const plan = createPlan({ repositoryRoot, sourceDir, releaseIntake, frameworkCommit });
  const initialState = createQworkReleaseTestState(plan);
  const context = {
    plan,
    state: initialState,
    controlDir: fs.realpathSync(controlDir),
    previousEventSha256: '',
    events: [],
    initialStateSha256: qworkReleaseIdentityFingerprint(initialState),
  };
  const stageArtifacts = {};
  const stageIds = targetStage === 'G4' ? ['G1', 'G2', 'G3', 'G4'] : ['G1', 'G2', 'G3'];
  const baseTime = Date.parse('2026-09-06T00:00:00.000Z') + (index * 86_400_000);
  let eventOffset = 0;
  for (const stageId of stageIds) {
    const readiness = makeReadinessArtifacts(stageId, plan, sourceDir);
    const readinessAt = new Date(baseTime + (++eventOffset * 1_000)).toISOString();
    const readinessAudit = auditQworkStageReadiness({
      plan,
      stageId,
      capabilityAudit: readiness.capabilityReport,
      pretest: readiness.pretestReport,
      expectedPrefixCaseIds: stageId === 'G4'
        ? context.state.stages.G3.admission.expected.case_ids
        : undefined,
      releaseIntake,
      releaseIntakeSha256: plan.release_intake.sha256,
      externalArtifacts: readiness.artifacts,
      generatedAt: readinessAt,
    });
    if (!readinessAudit.passed) {
      throw new Error(`${treeId} ${stageId} readiness fixture invalid: ${readinessAudit.failures.join(',')}`);
    }
    appendEvent(context, readinessAudit, 'readiness', readinessAt);
    const completion = makeCompletionArtifacts({
      root: runRoot,
      stageId,
      plan,
      readinessAudit,
      marker: stageId === targetStage && targetRunId
        ? targetRunId
        : `${treeId}-${stageId.toLowerCase()}`,
      trustedReviewPayloadNonce: stageId === targetStage && targetTrustedReviewPayloadNonce
        ? targetTrustedReviewPayloadNonce
        : `${treeId}-${stageId.toLowerCase()}`,
    });
    const completionAt = new Date(baseTime + (++eventOffset * 1_000)).toISOString();
    completion.audit.generated_at = completionAt;
    appendEvent(context, completion.audit, 'completion', completionAt);
    stageArtifacts[stageId] = { ...completion, readiness };
  }
  let soakFixture = null;
  if (includeSoak) {
    soakFixture = createQworkSoakFixture({
      root: path.join(fixtureRoot, 'soak', treeId),
      releaseIdentity: plan.release_identity,
      frameworkCommit: plan.framework.commit,
      runId: `${treeId}-soak`,
    });
    const externalArtifacts = soakExternalArtifacts(soakFixture);
    const soakAt = new Date(baseTime + (++eventOffset * 1_000)).toISOString();
    const soakAudit = auditQworkSoakCompletion({
      plan,
      soak: soakFixture.report,
      soakReportPath: soakFixture.reportPath,
      soakReportSha256: soakFixture.reportSha256,
      externalArtifacts,
      generatedAt: soakAt,
    });
    if (!soakAudit.passed) throw new Error(`G5 soak fixture invalid: ${soakAudit.failures.join(',')}`);
    appendEvent(context, soakAudit, 'completion', soakAt);
  }
  const integrity = createQworkReleaseTestIntegrity(plan, context.state, {
    eventCount: context.events.length,
    lastEventSha256: context.previousEventSha256,
    initialStateSha256: context.initialStateSha256,
  });
  const planArtifact = writeJson(path.join(controlDir, 'release-test-plan.json'), plan);
  writeJson(path.join(controlDir, 'release-test-state.json'), context.state);
  writeJson(path.join(controlDir, 'release-test-integrity.json'), integrity);
  const targetCompletion = context.events.find((item) => (
    item.event.stage_id === targetStage && item.event.phase === 'completion'
  ));
  const target = stageArtifacts[targetStage];
  return {
    treeId,
    controlDir: context.controlDir,
    plan,
    events: context.events,
    stageArtifacts,
    soakFixture,
    run: {
      schema_version: 'qbot-core-gray-run/v2',
      run_id: path.basename(target.runDir),
      stage_id: targetStage,
      control_dir: context.controlDir,
      release_plan: planArtifact,
      completion_event: { path: targetCompletion.path, sha256: targetCompletion.sha256 },
      soak_report: soakFixture
        ? { path: soakFixture.reportPath, sha256: soakFixture.reportSha256 }
        : null,
    },
  };
}

export function createQworkGrayGateFixture({
  root,
  repositoryRoot,
  targetRunIds = [],
  targetTrustedReviewPayloadNonces = [],
}) {
  const fixtureRoot = fs.realpathSync(root);
  const repository = fs.realpathSync(repositoryRoot);
  const frameworkCommit = 'b'.repeat(40);
  const releaseIntake = makeReleaseIntake(repository, frameworkCommit);
  const trees = Array.from({ length: 5 }, (_, offset) => createControlTree({
    fixtureRoot,
    repositoryRoot: repository,
    releaseIntake,
    frameworkCommit,
    index: offset + 1,
    targetStage: offset === 4 ? 'G4' : 'G3',
    includeSoak: offset === 4,
    targetRunId: targetRunIds[offset] || '',
    targetTrustedReviewPayloadNonce: targetTrustedReviewPayloadNonces[offset] || '',
  }));
  return {
    root: fixtureRoot,
    releaseIntake,
    frameworkCommit,
    trees,
    runs: trees.map((tree) => tree.run),
  };
}
