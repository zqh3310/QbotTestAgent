import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
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
  QWORK_MR1597_WORKER_IM_USER_IDENTITY_FORWARDING_CONTRACT,
  currentReleaseSourceContractProtectedPaths,
  currentReleaseSourceContractSuccessorBindings,
  resolveCurrentReleaseHeaderContract,
} from '../src/lib/qwork-release-source-contracts.mjs';
import {
  QWORK_MR1552_MERGE_COMMIT_SHA,
  QWORK_MR1559_MERGE_COMMIT_SHA,
  QWORK_RELEASE_BLOCKING_RISK_SCHEMA,
} from '../src/lib/qwork-release-blocking-risks.mjs';
import {
  QWORK_RELEASE_CASEBOOK_BASENAME,
  QWORK_RELEASE_CASEBOOK_DESIGN_BASELINE_COMMIT,
  QWORK_RELEASE_CASEBOOK_SHA256,
  QWORK_RELEASE_IDENTITY_SCHEMA,
  QWORK_RELEASE_REF_OBSERVATION_SCHEMA,
  QWORK_RELEASE_TEST_INTEGRITY_SCHEMA,
  QWORK_RELEASE_TEST_PLAN_SCHEMA,
  QWORK_RELEASE_TEST_STATE_SCHEMA,
  QWORK_RELEASE_TEST_STAGES,
} from '../src/lib/qwork-release-test-plan.mjs';
import { createQworkCapabilitiesReadbackFixture } from './helpers/qwork-soak-fixture.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const orchestrator = path.join(root, 'scripts', 'orchestrate-qwork-release-test.mjs');
const observationCli = path.join(root, 'scripts', 'observe-qwork-release-ref.mjs');
const intakeCli = path.join(root, 'scripts', 'scan-qwork-release-intake.mjs');
const pretestCli = path.join(root, 'scripts', 'preflight-core-beta-test-run.mjs');
const canonicalRemote = 'https://gitlab.daikuan.qihoo.net/songrongxin/deepbankv2.git';

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

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function releaseCommitMetadata(id) {
  return {
    id,
    short_id: id.slice(0, 8),
    created_at: '2026-09-08T01:02:03Z',
    parent_ids: ['a'.repeat(40)],
    title: 'Protected source update',
    message: 'Protected source update',
    author_name: 'QBot QA Fixture',
    author_email: 'qbot-qa@example.invalid',
    authored_date: '2026-09-08T01:02:03Z',
    committer_name: 'QBot QA Fixture',
    committer_email: 'qbot-qa@example.invalid',
    committed_date: '2026-09-08T01:02:03Z',
    trailers: {},
    project_id: 1,
    stats: { additions: 1, deletions: 0, total: 1 },
    status: 'success',
    last_pipeline: null,
    web_url: `https://gitlab.daikuan.qihoo.net/songrongxin/deepbankv2/-/commit/${id}`,
  };
}

function releaseCompareCommit(id, parentIds) {
  return {
    ...releaseCommitMetadata(id),
    parent_ids: [...parentIds],
  };
}

function releaseFileProvenance(filePath, head) {
  const change = {
    old_path: filePath,
    new_path: filePath,
    new_file: false,
    renamed_file: false,
    deleted_file: false,
  };
  const rawChange = {
    ...change,
    a_mode: '100644',
    b_mode: '100644',
    diff: '@@ -1 +1 @@\n-old\n+new',
    generated_file: false,
    collapsed: false,
    too_large: false,
  };
  const diffEndpoint = `repository/commits/${head}/diff?per_page=100`;
  const commitMetadata = releaseCommitMetadata(head);
  return {
    schema_version: 'qbot-qwork-release-file-provenance/v2',
    source: 'gitlab-api-repository-commit-diff',
    commit_endpoint: `repository/commits/${head}`,
    diff_endpoint: diffEndpoint,
    path: filePath,
    ref: head,
    release_commit_id: head,
    file_last_commit_id: head,
    commit_id: head,
    commit_raw_response: structuredClone(commitMetadata),
    commit_metadata: commitMetadata,
    commit_response_sha256: sha256(stableJson(commitMetadata)),
    diff_page_size: 100,
    diff_pages: [{
      page: 1,
      endpoint: `${diffEndpoint}&page=1`,
      item_count: 1,
      raw_response: [rawChange],
      changes: [change],
      response_sha256: sha256(stableJson([rawChange])),
    }],
    matched_change_count: 1,
    matched_changes: [change],
    path_verified: true,
    error: '',
  };
}

function canonicalizationPolicyFixture(pid = 4242) {
  const stableProjection = {
    schema_version: 'qbot-claude-skill-call-canonicalization-policy/v1',
    flag_name: 'QBOT_DISABLE_CLAUDE_SKILL_CALL_CANONICALIZATION',
    runner: { readable: true, state: 'unset' },
    managed_process: { readable: true, state: 'unset' },
    ok: true,
    error_code: '',
  };
  return {
    ...stableProjection,
    checked_at: '2026-09-07T00:00:00.000Z',
    managed_process: { ...stableProjection.managed_process, pid },
    policy_sha256: sha256(JSON.stringify(stableProjection)),
  };
}

function writeJson(file, value) {
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function gitBlobSha1(source) {
  const body = Buffer.from(source, 'utf8');
  return createHash('sha1').update(Buffer.concat([
    Buffer.from(`blob ${body.length}\0`, 'utf8'),
    body,
  ])).digest('hex');
}

function completeCurrentReleaseJavaScriptFixture(filePath, sourceLines, contracts) {
  let lines = [...sourceLines];
  const mr1597 = contracts.find((contract) => (
    contract.contract_id === QWORK_MR1597_WORKER_IM_USER_IDENTITY_FORWARDING_CONTRACT.contract_id
  ));
  // MR1597 semantic validation observes the complete facade -> supervisor ->
  // lifecycle chain, not only the line-level allowlist additions.
  if (mr1597 && filePath === 'test/unit/desktop/execution-worker-supervisor.test.mjs') {
    lines = [
      "import assert from 'node:assert/strict';",
      "import { createRequire } from 'node:module';",
      "import test from 'node:test';",
      "import vm from 'node:vm';",
      '',
      'const require = createRequire(import.meta.url);',
      'const {',
      '  createExecutionWorkerSupervisor,',
      '  workerEnvironment,',
      "} = require('../../../electron/desktop-agent-host.cjs');",
      'void createExecutionWorkerSupervisor;',
      'void vm;',
      '',
      ...lines,
    ];
  } else if (mr1597 && filePath === 'electron/desktop-agent-host.cjs') {
    const explicitNamedExports = Array.from({ length: 122 }, (_, index) => (
      `exports.unrelatedExport${index + 1} = implementation.unrelatedExport${index + 1};`
    ));
    lines = [
      "const implementation = require('./host-core/agent/desktop-host-context.cjs');",
      ...explicitNamedExports,
      "Object.assign(exports, require('./unrelated-a.cjs'), require('./host-core/agent/execution-worker-supervisor.cjs'));",
      ...lines,
    ];
  } else if (mr1597 && filePath === 'electron/host-core/agent/execution-worker-supervisor.cjs') {
    lines = [
      'const {',
      '  workerEnvironment,',
      "} = require('./execution-worker-process-lifecycle.cjs');",
      ...lines,
      'module.exports = {',
      '  WORKER_ENV_ALLOWLIST,',
      '  workerEnvironment,',
      '};',
    ];
  } else if (mr1597 && filePath === 'electron/host-core/agent/execution-worker-process-lifecycle.cjs') {
    lines = [
      "const { isAbsolute } = require('node:path');",
      'const {',
      '  contextUsageWorkerFixtureEnvironment,',
      "} = require('./execution-worker-context-usage.cjs');",
      '',
      ...lines,
      'function expertAuthoringWorkerFixtureEnvironment(source = {}) {',
      "  if (source.DEEPBANK_E2E !== '1' || source.DEEPBANK_E2E_EXPERT_AUTHORING_FULL_CHAIN !== '1') return {};",
      '  return {',
      "    DEEPBANK_E2E: '1',",
      "    DEEPBANK_E2E_EXPERT_AUTHORING_FULL_CHAIN: '1',",
      "    ...(source.DEEPBANK_AGENT_MOCK === '1' ? { DEEPBANK_AGENT_MOCK: '1' } : {}),",
      '  };',
      '}',
      '',
      'function workerEnvironment(source = process.env, authority = {}) {',
      '  const env = {};',
      '  for (const [key, value] of Object.entries(source || {})) {',
      "    const name = String(key || '').trim();",
      '    if (!WORKER_ENV_ALLOWLIST.test(name)) continue;',
      "    env[name] = String(value ?? '');",
      '  }',
      "  if (source?.DEEPBANK_E2E === '1') {",
      "    const captureRoot = String(source?.DEEPBANK_E2E_RAW_CAPTURE_DIR || '').trim();",
      "    if (captureRoot && captureRoot.length <= 4096 && !captureRoot.includes('\\0') && isAbsolute(captureRoot)) {",
      '      env.DEEPBANK_E2E_RAW_CAPTURE_DIR = captureRoot;',
      '    }',
      '  }',
      '  Object.assign(env, contextUsageWorkerFixtureEnvironment(source));',
      '  Object.assign(env, expertAuthoringWorkerFixtureEnvironment(source));',
      '  if (authority?.runtimeEntry) env.QBOT_EXECUTION_WORKER_RUNTIME_ENTRY = String(authority.runtimeEntry);',
      '  if (authority?.runtimeHome) env.DEEPBANK_HOME = String(authority.runtimeHome);',
      '  if (authority?.appRoot) env.QBOT_APP_ROOT = String(authority.appRoot);',
      '  if (authority?.serverScope) env.DEEPBANK_SERVER = env.QBOT_CONTROL_PLANE_SERVER = String(authority.serverScope);',
      '  return env;',
      '}',
      'module.exports = {',
      '  WORKER_ENV_ALLOWLIST,',
      '  workerEnvironment,',
      '};',
    ];
  }
  const envelopeContract = contracts.find((contract) => contract.integration_bindings?.some(
    (binding) => binding.id === 'test_declares_shared_32_mib_envelope_limit',
  ));
  const ownerBinding = envelopeContract?.integration_bindings?.find(
    (binding) => binding.id === 'test_declares_shared_32_mib_envelope_limit',
  );
  const oversizedBinding = envelopeContract?.integration_bindings?.find(
    (binding) => binding.id === 'test_rejects_payload_at_shared_limit',
  );
  if (ownerBinding?.path !== filePath || oversizedBinding?.path !== filePath) return lines;
  const ownerIndex = lines.indexOf(ownerBinding.addition.source);
  const oversizedIndex = lines.indexOf(oversizedBinding.addition.source);
  if (ownerIndex < 0 || oversizedIndex <= ownerIndex) return lines;
  lines.splice(oversizedIndex, 0, '  const oversizedEnvelopeFixture = {');
  lines.splice(oversizedIndex + 2, 0, '  };', '  void oversizedEnvelopeFixture;', '});');
  return lines;
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
    for (const filePath of currentReleaseSourceContractProtectedPaths(contract, headerOwner)) {
      if (!linesByPath.has(filePath)) linesByPath.set(filePath, []);
    }
    for (const header of headerOwner.header_emissions) {
      addLine(headerOwner.source_file.path, header.value_definition?.source);
      addLine(headerOwner.source_file.path, header.emission?.source);
    }
    for (const binding of contract.integration_bindings.filter((item) => (
      !item.current_release_scope && !replacedBindingIds.has(item.id)
    ))) {
      addLine(
        binding.path,
        binding.current_release_match?.match === 'line-or-verified-successor-line'
          ? binding.current_release_match.successor.line.source
          : binding.addition?.source,
      );
    }
    const scopedOwnerGroups = new Map();
    for (const binding of contract.integration_bindings.filter((item) => item.current_release_scope)) {
      const scope = binding.current_release_scope;
      const key = `${binding.path}\0${scope.owner_start.source}`;
      if (!scopedOwnerGroups.has(key)) {
        scopedOwnerGroups.set(key, { path: binding.path, owner: scope.owner_start.source, scopes: [] });
      }
      const group = scopedOwnerGroups.get(key);
      if (!group.scopes.some((candidate) => stableJson(candidate) === stableJson(scope))) {
        group.scopes.push(scope);
      }
    }
    for (const group of scopedOwnerGroups.values()) {
      appendLine(group.path, group.owner);
      for (const scope of group.scopes.filter((item) => item.boundary === 'next-top-level-test-or-eof')) {
        for (const fragment of scope.required_fragments) appendLine(group.path, fragment.value.source);
      }
      const regionScopes = group.scopes
        .filter((item) => item.boundary === 'anchored-line-region-within-next-top-level-test')
        .sort((left, right) => Number(left.region_end.source.trim() === '});')
          - Number(right.region_end.source.trim() === '});'));
      const requiresJavaScriptPropertyAst = regionScopes.some((scope) => (
        scope.forbidden_fragments?.some((fragment) => fragment.match === 'js-property-key')
      ));
      for (const [scopeIndex, scope] of regionScopes.entries()) {
        appendLine(group.path, scope.region_start.source);
        let nextLineIndex = 1;
        for (const fragment of scope.required_fragments) {
          while (nextLineIndex < fragment.expected_line_index) {
            appendLine(group.path, `    QBOT_SCOPE_FIXTURE_${scopeIndex}_${nextLineIndex}: true,`);
            nextLineIndex += 1;
          }
          appendLine(group.path, fragment.value.source);
          nextLineIndex += 1;
        }
        if (requiresJavaScriptPropertyAst && scope.region_end_inclusive === false) {
          appendLine(group.path, '  });');
        }
        appendLine(group.path, scope.region_end.source);
        if (requiresJavaScriptPropertyAst && scope.region_end.source.trim() === '}, {') {
          appendLine(group.path, "    platform: 'darwin',");
          appendLine(group.path, '  });');
        }
      }
      if (requiresJavaScriptPropertyAst
        && !regionScopes.some((scope) => scope.region_end.source === '});')) {
        appendLine(group.path, '});');
      }
    }
  }
  return new Map([...linesByPath].map(([filePath, lines]) => {
    const completedLines = completeCurrentReleaseJavaScriptFixture(filePath, lines, contracts);
    const source = `${completedLines.join('\n')}\n`;
    return [filePath, {
      file_name: path.basename(filePath),
      file_path: filePath,
      size: Buffer.byteLength(source),
      encoding: 'base64',
      content: Buffer.from(source).toString('base64'),
      ref: head,
      blob_id: gitBlobSha1(source),
      commit_id: head,
      last_commit_id: head,
      last_commit_provenance: releaseFileProvenance(filePath, head),
    }];
  }));
}

function makeReleaseIntake({ repository, frameworkCommit, releaseHead, casebookPath, stageId = 'G1' }) {
  const stage = QWORK_RELEASE_TEST_STAGES.find((item) => item.id === stageId);
  if (!stage || stage.kind !== 'casebook') throw new Error(`invalid intake stage ${stageId}`);
  const releaseFiles = currentReleaseFileFixtures(QWORK_RELEASE_SOURCE_CONTRACTS, releaseHead);
  const blockingRiskMerges = new Set([
    QWORK_MR1552_MERGE_COMMIT_SHA,
    QWORK_MR1559_MERGE_COMMIT_SHA,
  ]);
  const sourceContractSuccessors = QWORK_RELEASE_SOURCE_CONTRACTS.flatMap((contract) => (
    currentReleaseSourceContractSuccessorBindings(contract).map((item) => item.successor)
  ));
  let branchReads = 0;
  const gitlabReader = (endpoint) => {
    if (endpoint.startsWith('repository/branches/')) {
      branchReads += 1;
      return { commit: { id: releaseHead, read: branchReads } };
    }
    if (endpoint.startsWith('repository/compare?')) {
      const query = new URLSearchParams(endpoint.slice(endpoint.indexOf('?') + 1));
      const from = query.get('from');
      const to = query.get('to');
      const successor = sourceContractSuccessors.find((candidate) => (
        candidate.merge_commit_sha === from || candidate.merge_commit_sha === to
      ));
      if (successor && from === successor.merge_commit_sha && to === releaseHead) {
        if (from === to) return { compare_timeout: false, commits: [] };
        return {
          compare_timeout: false,
          commits: [releaseCompareCommit(releaseHead, [successor.merge_commit_sha])],
        };
      }
      if (successor && from === releaseHead && to === successor.merge_commit_sha) {
        return { compare_timeout: false, commits: [] };
      }
      if (from === releaseHead && to === releaseHead) return { compare_timeout: false, commits: [] };
      if (from === QWORK_RELEASE_CASEBOOK_DESIGN_BASELINE_COMMIT && to === releaseHead) {
        return {
          compare_timeout: false,
          commits: [{
            id: releaseHead,
            parent_ids: [from, 'c'.repeat(40)],
            title: 'Merge security fixture',
            message: 'Merge security fixture',
            committed_date: '2026-09-05T00:00:00Z',
          }],
        };
      }
      const contractAncestry = QWORK_RELEASE_SOURCE_CONTRACTS.some(
        (contract) => contract.merge_commit_sha === from,
      );
      if (contractAncestry && to === releaseHead) {
        return {
          compare_timeout: false,
          commits: [{
            id: releaseHead,
            parent_ids: [from, 'c'.repeat(40)],
            title: 'Merge security fixture',
            message: 'Merge security fixture',
            committed_date: '2026-09-05T00:00:00Z',
          }],
        };
      }
      if (from === releaseHead && blockingRiskMerges.has(to)) {
        return { compare_timeout: false, commits: [{ id: to, parent_ids: [releaseHead] }] };
      }
      if (blockingRiskMerges.has(from) && to === releaseHead) {
        return { compare_timeout: false, commits: [] };
      }
      throw new Error(`unexpected compare ${from}..${to}`);
    }
    const commitMrMatch = endpoint.match(/^repository\/commits\/([a-f0-9]{40})\/merge_requests$/i);
    if (commitMrMatch) {
      if (commitMrMatch[1] !== releaseHead) return [];
      return [{
        iid: 901,
        title: 'Security fixture release metadata',
        state: 'merged',
        target_branch: 'release/0.1',
        source_branch: 'test/security-fixture',
        merge_commit_sha: releaseHead,
        squash_commit_sha: '',
        merged_at: '2026-09-05T00:00:00Z',
        labels: ['area/docs'],
      }];
    }
    if (endpoint === 'merge_requests/901/changes') {
      return {
        iid: 901,
        state: 'merged',
        target_branch: 'release/0.1',
        merge_commit_sha: releaseHead,
        squash_commit_sha: '',
        changes_count: '1',
        overflow: false,
        changes: [{
          old_path: 'README.md',
          new_path: 'docs/release-security-fixture.md',
          diff: '+security fixture release metadata',
        }],
      };
    }
    const commitDiff = endpoint.match(/^repository\/commits\/([a-f0-9]{40})\/diff\?per_page=100&page=(\d+)$/i);
    if (commitDiff) {
      const rows = [...releaseFiles.keys()].map((filePath) => ({
        old_path: filePath,
        new_path: filePath,
        a_mode: '100644',
        b_mode: '100644',
        diff: '@@ -1 +1 @@\n-old\n+new',
        new_file: false,
        renamed_file: false,
        deleted_file: false,
        generated_file: false,
        collapsed: false,
        too_large: false,
      }));
      const page = Number(commitDiff[2]);
      return rows.slice((page - 1) * 100, page * 100);
    }
    const commitMetadata = endpoint.match(/^repository\/commits\/([a-f0-9]{40})$/i);
    if (commitMetadata) return releaseCommitMetadata(commitMetadata[1]);
    if (endpoint.startsWith('repository/files/')) {
      const encoded = endpoint.slice('repository/files/'.length, endpoint.indexOf('?'));
      const filePath = decodeURIComponent(encoded);
      if (!releaseFiles.has(filePath)) throw new Error(`missing release file ${filePath}`);
      return releaseFiles.get(filePath);
    }
    throw new Error(`unexpected endpoint ${endpoint}`);
  };
  gitlabReader.readRaw = (endpoint) => {
    const value = gitlabReader(endpoint);
    return {
      bytes: Buffer.from(JSON.stringify(value), 'utf8'),
      value: structuredClone(value),
    };
  };
  return scanQworkReleaseIntake({
    repoRoot: repository,
    releaseRef: QWORK_RELEASE_INTAKE_DEFAULT_REF,
    baselineCommit: QWORK_RELEASE_CASEBOOK_DESIGN_BASELINE_COMMIT,
    casebookPath,
    casebookSha256: QWORK_RELEASE_CASEBOOK_SHA256,
    sheet: stage.sheet,
    frameworkCommit,
    gitlabReader,
    freshnessSource: 'gitlab-api',
    sourceContracts: QWORK_RELEASE_SOURCE_CONTRACTS,
    now: new Date('2026-09-05T00:00:00.000Z'),
  });
}

function capability(stageId, plan) {
  const stage = QWORK_RELEASE_TEST_STAGES.find((item) => item.id === stageId);
  const caseIds = stage.expected_case_ids
    ? [...stage.expected_case_ids]
    : Array.from({ length: stage.expected_case_count }, (_, index) => `${stageId}-CASE-${index + 1}`);
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
      runtime_dispatchable: true,
      protocol_ok: true,
      directly_runnable_without_controller: true,
      case_type: 'conversation',
      driver: `driver-${caseId}`,
      executor_route: `route-${caseId}`,
      contract_sha256: sha256(`contract:${caseId}`),
      fixture_control: 'runner-native',
      action_count: 1,
      evidence_role_count: 1,
      hard_oracle_count: 1,
    })),
  };
}

function pretest(stageId, plan) {
  const stage = QWORK_RELEASE_TEST_STAGES.find((item) => item.id === stageId);
  const caseIds = capability(stageId, plan).cases.map((item) => item.case_id);
  const checkIds = [
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
    'qwork_claude_skill_call_canonicalization_enabled',
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
  ];
  const canonicalizationPolicy = canonicalizationPolicyFixture();
  return {
    schema_version: 'qbot-core-beta-pretest/v1',
    status: 'READY',
    lane: 'teams',
    production_gate: true,
    release_gate_eligible: true,
    blockers: [],
    release_intake: {
      sha256: plan.release_intakes[stageId].sha256,
      content_sha256: plan.release_intakes[stageId].content_sha256,
      release_head: plan.release_intakes[stageId].release_head,
    },
    checks: checkIds.map((id) => ({ id, status: 'passed', detail: 'security fixture' })),
    framework: {
      head: plan.framework.commit,
      origin_main: plan.framework.commit,
      tracked_dirty: '',
    },
    casebook: {
      path: plan.casebook.path,
      profile: 'mandatory',
      sha256: plan.casebook.sha256,
      sheet: stage.sheet,
      case_count: stage.expected_case_count,
      expected_count: stage.expected_case_count,
      case_ids: caseIds,
    },
    fixture: {
      ok: true,
      requirements: caseIds.map((caseId) => ({
        case_id: caseId,
        driver: `driver-${caseId}`,
        executor_route: `route-${caseId}`,
        contract_sha256: sha256(`contract:${caseId}`),
        adapter: 'runner-native',
        local_ready: true,
        action_ids: [`action-${caseId}`],
        evidence_roles: ['before_screenshot'],
        oracle_sha256s: [sha256(`oracle:${caseId}`)],
      })),
    },
    release_identity: {
      expected: structuredClone(plan.release_identity),
      observed: structuredClone(plan.release_identity),
      fingerprint: plan.release_identity_sha256,
      observed_fingerprint: plan.release_identity_sha256,
    },
    runtime: {
      claude_skill_call_canonicalization_policy: canonicalizationPolicy,
      teams: { version: plan.release_identity.teams_version, build: plan.release_identity.teams_build },
      session: { pid: 4242, control_plane_origin: plan.release_identity.control_plane_origin },
      teams_inspection: {
        public_capabilities: createQworkCapabilitiesReadbackFixture(),
        claude_skill_call_canonicalization_policy: structuredClone(canonicalizationPolicy),
      },
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

function command(cwd, args, env = {}) {
  return spawnSync(process.execPath, [orchestrator, ...args], {
    cwd,
    encoding: 'utf8',
    env: { ...process.env, ...env },
  });
}

function setupFixture() {
  const temporaryRoot = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'qwork-orchestrator-security-')));
  const remote = path.join(temporaryRoot, 'remote.git');
  const work = path.join(temporaryRoot, 'work');
  const run = (name, args, cwd = work) => spawnSync(name, args, { cwd, encoding: 'utf8' });
  assert.equal(run('git', ['init', '--bare', remote], temporaryRoot).status, 0);
  assert.equal(run('git', ['init', '-b', 'main', work], temporaryRoot).status, 0);
  assert.equal(run('git', ['config', 'user.email', 'security@example.invalid']).status, 0);
  assert.equal(run('git', ['config', 'user.name', 'Security Fixture']).status, 0);
  fs.writeFileSync(path.join(work, 'README.md'), 'security fixture\n');
  assert.equal(run('git', ['add', 'README.md']).status, 0);
  assert.equal(run('git', ['commit', '-m', 'initial']).status, 0);
  assert.equal(run('git', ['remote', 'add', 'origin', remote]).status, 0);
  assert.equal(run('git', ['push', '-u', 'origin', 'main']).status, 0);
  assert.equal(run('git', ['branch', 'release/0.1']).status, 0);
  assert.equal(run('git', ['push', 'origin', 'release/0.1']).status, 0);
  assert.equal(run('git', ['config', `url.${remote}.insteadOf`, canonicalRemote]).status, 0);
  assert.equal(run('git', ['remote', 'set-url', 'origin', canonicalRemote]).status, 0);
  const frameworkCommit = run('git', ['rev-parse', 'HEAD']).stdout.trim();
  const casebook = path.join(temporaryRoot, QWORK_RELEASE_CASEBOOK_BASENAME);
  const identityFile = path.join(temporaryRoot, 'release-identity.json');
  const intakeFiles = Object.fromEntries(['G1', 'G2', 'G3', 'G4'].map((stageId) => [
    stageId,
    path.join(temporaryRoot, `release-intake-${stageId.toLowerCase()}.json`),
  ]));
  const observationFile = path.join(temporaryRoot, 'release-observation.json');
  const stateDir = path.join(temporaryRoot, 'control');
  fs.copyFileSync(path.join(root, 'PRD', QWORK_RELEASE_CASEBOOK_BASENAME), casebook);
  writeJson(identityFile, {
    schema_version: QWORK_RELEASE_IDENTITY_SCHEMA,
    captured_at: '2026-09-05T00:00:00.000Z',
    ...identity,
  });
  for (const stageId of ['G1', 'G2', 'G3', 'G4']) {
    writeJson(intakeFiles[stageId], makeReleaseIntake({
      repository: work,
      frameworkCommit,
      releaseHead: frameworkCommit,
      casebookPath: casebook,
      stageId,
    }));
  }
  writeJson(observationFile, {
    schema_version: QWORK_RELEASE_REF_OBSERVATION_SCHEMA,
    observed_at: '2026-09-05T00:00:00.000Z',
    repository: work,
    release_ref: QWORK_RELEASE_INTAKE_DEFAULT_REF,
    release_head: frameworkCommit,
    source: 'git-rev-parse-after-fetch',
  });
  const initArgs = [
    'init',
    '--state-dir', stateDir,
    '--casebook', casebook,
    '--release-identity', identityFile,
    '--release-intake-g1', intakeFiles.G1,
    '--release-intake-g2', intakeFiles.G2,
    '--release-intake-g3', intakeFiles.G3,
    '--release-intake-g4', intakeFiles.G4,
    '--expected-release-observation', observationFile,
    '--expected-release-ref', QWORK_RELEASE_INTAKE_DEFAULT_REF,
    '--expected-release-head', frameworkCommit,
  ];
  return {
    temporaryRoot,
    remote,
    work,
    stateDir,
    casebook,
    identityFile,
    intakeFile: intakeFiles.G1,
    intakeFiles,
    observationFile,
    initArgs,
  };
}

function expectRejected(result, pattern) {
  assert.notEqual(result.status, 0, result.stdout);
  assert.match(result.stderr, pattern);
}

function preserveFile(file, mutation, assertion) {
  const original = fs.readFileSync(file);
  try {
    mutation(original);
    assertion();
  } finally {
    fs.rmSync(file, { recursive: true, force: true });
    fs.writeFileSync(file, original);
  }
}

test('release CLI help pins the current intake and blocking-risk contracts', () => {
  for (const [label, script, args] of [
    ['release intake scanner', intakeCli, ['--help']],
    ['release orchestrator', orchestrator, ['--help']],
    ['Core Beta pretest', pretestCli, ['--help']],
  ]) {
    const result = spawnSync(process.execPath, [script, ...args], {
      cwd: root,
      encoding: 'utf8',
    });
    assert.equal(result.status, 0, `${label}: ${result.stderr || result.stdout}`);
    assert.match(result.stdout, new RegExp(`report schema: ${QWORK_RELEASE_INTAKE_SCHEMA.replaceAll('/', '\\/')}`));
    assert.match(result.stdout, new RegExp(`tool version: ${QWORK_RELEASE_INTAKE_TOOL_VERSION.replaceAll('/', '\\/')}`));
    assert.match(result.stdout, new RegExp(`blocking-risk schema: ${QWORK_RELEASE_BLOCKING_RISK_SCHEMA.replaceAll('/', '\\/')}`));
    assert.match(
      result.stdout,
      /旧 intake tool version 或旧 blocking-risk schema 一律 fail-closed，必须重新扫描。/,
      `${label} 必须明确拒绝旧合同`,
    );
  }
});

test('GitLab token stdin option is an exact valueless flag for every release CLI', () => {
  const secret = 'must-not-appear-in-errors';
  const invocations = [
    [orchestrator, ['status', '--help']],
    [observationCli, ['--help']],
    [intakeCli, ['--help']],
  ];
  for (const [script, prefix] of invocations) {
    const accepted = spawnSync(process.execPath, [script, ...prefix, '--gitlab-token-stdin'], {
      encoding: 'utf8',
    });
    assert.equal(accepted.status, 0, accepted.stderr);

    for (const rejectedArgs of [
      [...prefix, `--gitlab-token-stdin=${secret}`],
      [...prefix, '--gitlab-token-stdin', secret],
    ]) {
      const rejected = spawnSync(process.execPath, [script, ...rejectedArgs], { encoding: 'utf8' });
      assert.notEqual(rejected.status, 0, `${script} must reject token values in argv`);
      assert.doesNotMatch(`${rejected.stdout}\n${rejected.stderr}`, new RegExp(secret));
    }
  }
});

test('orchestrator rejects legacy, unknown, and command-mismatched options without exposing values', () => {
  const secret = 'unknown-option-value-must-not-appear';
  for (const [index, args] of [
    ['status', '--help', '--release-intake', secret],
    ['status', '--help', `--random-unknown=${secret}`],
    ['status', '--help', '--casebook', secret],
  ].entries()) {
    const rejected = spawnSync(process.execPath, [orchestrator, ...args], {
      cwd: root,
      encoding: 'utf8',
    });
    assert.notEqual(rejected.status, 0, `orchestrator must reject unknown option case ${index + 1}`);
    assert.match(rejected.stderr, /Unknown command-line option/);
    assert.doesNotMatch(`${rejected.stdout}\n${rejected.stderr}`, new RegExp(secret));
  }
});

test('release scan and observation CLIs reject unsupported options before help or side effects', () => {
  const secret = 'unsupported-option-secret-must-not-appear';
  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'qbot-release-cli-options-'));
  try {
    for (const [label, script, rejectedOptions] of [
      ['release intake scanner', intakeCli, [
        [`--random-unknown=${secret}`],
        ['--random-unknown', secret],
        ['--release-intake', secret],
        ['--state-dir', secret],
      ]],
      ['release observation', observationCli, [
        [`--random-unknown=${secret}`],
        ['--random-unknown', secret],
        ['--release-intake', secret],
        ['--casebook', secret],
      ]],
    ]) {
      for (const [index, rejectedOption] of rejectedOptions.entries()) {
        const output = path.join(temporaryRoot, `${path.basename(script)}-${index}`);
        const rejected = spawnSync(process.execPath, [
          script,
          '--help',
          '--gitlab-token-stdin',
          '--out', output,
          ...rejectedOption,
        ], {
          cwd: root,
          encoding: 'utf8',
          input: `${secret}\n`,
        });
        assert.notEqual(rejected.status, 0, `${label} must reject unsupported option case ${index + 1}`);
        assert.match(rejected.stderr, /Unknown command-line option/);
        assert.doesNotMatch(`${rejected.stdout}\n${rejected.stderr}`, new RegExp(secret));
        assert.equal(fs.existsSync(output), false, `${label} must reject before output creation`);
      }
    }
  } finally {
    fs.rmSync(temporaryRoot, { recursive: true, force: true });
  }
});

test('orchestrator rejects forged repositories, control-tree aliases, and immutable artifact drift', async () => {
  const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  assert.match(packageJson.scripts.check, /test\/qwork-release-orchestrator-security\.test\.mjs/);
  const fixture = setupFixture();
  const status = (stateDir = fixture.stateDir) => command(fixture.work, ['status', '--state-dir', stateDir]);
  try {
    assert.equal(spawnSync('git', [
      '-C', fixture.work, 'remote', 'set-url', 'origin', 'https://gitlab.example.invalid/attacker/project.git',
    ]).status, 0);
    expectRejected(command(fixture.work, fixture.initArgs), /origin 不是 deepbankV2 GitLab 项目/);
    assert.equal(fs.existsSync(fixture.stateDir), false);
    assert.equal(spawnSync('git', [
      '-C', fixture.work, 'remote', 'set-url', 'origin', canonicalRemote.replace('.net/', '.net:8443/'),
    ]).status, 0);
    expectRejected(command(fixture.work, fixture.initArgs), /origin 不是 deepbankV2 GitLab 项目/);
    assert.equal(spawnSync('git', [
      '-C', fixture.work, 'remote', 'set-url', 'origin', canonicalRemote,
    ]).status, 0);

    const unsafeStateDir = path.join(fixture.temporaryRoot, 'unsafe-control');
    fs.mkdirSync(unsafeStateDir, { mode: 0o777 });
    fs.chmodSync(unsafeStateDir, 0o777);
    const unsafeArgs = fixture.initArgs.map((value, index, values) => (
      values[index - 1] === '--state-dir' ? unsafeStateDir : value
    ));
    expectRejected(command(fixture.work, unsafeArgs), /group\/other 写入/);
    fs.rmSync(unsafeStateDir, { recursive: true, force: true });

    const interruptedInit = command(fixture.work, fixture.initArgs, {
      NODE_ENV: 'test',
      QBOT_QWORK_FAULT_AFTER_INIT_STAGING: '1',
    });
    assert.notEqual(interruptedInit.status, 0);
    assert.equal(fs.existsSync(fixture.stateDir), false, '中断 init 不得暴露半控制树');

    fs.mkdirSync(fixture.stateDir, { mode: 0o700 });
    const initialized = command(fixture.work, fixture.initArgs);
    assert.equal(initialized.status, 0, initialized.stderr);
    assert.equal(fs.readdirSync(fixture.temporaryRoot).some(
      (name) => name.startsWith(`.${path.basename(fixture.stateDir)}.staging-`),
    ), false, '下一次 init 必须清理中断遗留 staging');
    assert.equal(status().status, 0, status().stderr);
    assert.deepEqual(fs.readdirSync(fixture.stateDir).sort(), [
      'events',
      'release-test-integrity.json',
      'release-test-plan.json',
      'release-test-state.json',
    ]);
    const plan = JSON.parse(fs.readFileSync(path.join(fixture.stateDir, 'release-test-plan.json')));
    const initialState = JSON.parse(fs.readFileSync(path.join(fixture.stateDir, 'release-test-state.json')));
    const initialIntegrity = JSON.parse(fs.readFileSync(path.join(fixture.stateDir, 'release-test-integrity.json')));
    assert.equal(plan.schema_version, QWORK_RELEASE_TEST_PLAN_SCHEMA);
    assert.equal(initialState.schema_version, QWORK_RELEASE_TEST_STATE_SCHEMA);
    assert.equal(initialIntegrity.schema_version, QWORK_RELEASE_TEST_INTEGRITY_SCHEMA);
    assert.deepEqual(plan.source_artifacts.map((item) => [item.role, item.type]), [
      ['casebook', 'file'],
      ['release_identity', 'file'],
      ['release_intake_g1', 'file'],
      ['release_intake_g2', 'file'],
      ['release_intake_g3', 'file'],
      ['release_intake_g4', 'file'],
      ['release_observation', 'file'],
    ]);

    const lockFile = path.join(
      path.dirname(fixture.stateDir),
      `.${path.basename(fixture.stateDir)}.qwork-release-test.lock`,
    );
    fs.writeFileSync(lockFile, 'stale inode is harmless\n');
    assert.equal(status().status, 0, status().stderr);
    expectRejected(command(fixture.work, ['status', '--state-dir', fixture.stateDir], {
      QBOT_QWORK_CONTROL_LOCK_ROOT: fixture.stateDir,
    }), /父进程不是 \/usr\/bin\/lockf|未持有进程生命周期锁/);

    const originalReleaseHead = plan.release_head_observation.release_head;
    const tree = spawnSync('git', ['-C', fixture.work, 'rev-parse', 'HEAD^{tree}'], { encoding: 'utf8' }).stdout.trim();
    const alternateHead = spawnSync('git', ['-C', fixture.work, 'commit-tree', tree, '-p', originalReleaseHead], {
      encoding: 'utf8',
      input: 'alternate remote head\n',
    }).stdout.trim();
    assert.match(alternateHead, /^[a-f0-9]{40}$/);
    assert.equal(spawnSync('git', [
      '-C', fixture.work, 'push', fixture.remote, `${alternateHead}:refs/heads/release/0.1`, '--force',
    ]).status, 0);
    expectRejected(status(), /canonical origin 实时 ref 不一致/);
    assert.equal(spawnSync('git', [
      `--git-dir=${fixture.remote}`, 'update-ref', 'refs/heads/release/0.1', originalReleaseHead,
    ]).status, 0);
    assert.equal(status().status, 0, status().stderr);
    const holder = spawn('/usr/bin/lockf', ['-t', '0', lockFile, '/bin/sleep', '30'], { detached: true });
    await new Promise((resolve) => setTimeout(resolve, 100));
    expectRejected(status(), /正被另一命令占用/);
    process.kill(-holder.pid, 'SIGTERM');
    await new Promise((resolve) => holder.once('exit', resolve));
    assert.equal(status().status, 0, status().stderr);

    if (fixture.stateDir.startsWith('/private/var/')) {
      const alias = fixture.stateDir.replace(/^\/private\/var\//, '/var/');
      assert.equal(status(alias).status, 0, status(alias).stderr);
    }

    const cloneControl = (name) => {
      const target = path.join(fixture.temporaryRoot, name);
      fs.cpSync(fixture.stateDir, target, { recursive: true });
      return target;
    };
    const extraRoot = cloneControl('extra-root');
    fs.writeFileSync(path.join(extraRoot, 'unexpected.json'), '{}\n');
    expectRejected(status(extraRoot), /入口集合不合法/);

    const legacySchema = cloneControl('legacy-schema');
    const legacyPlanPath = path.join(legacySchema, 'release-test-plan.json');
    const legacyPlan = JSON.parse(fs.readFileSync(legacyPlanPath));
    legacyPlan.schema_version = 'qbot-qwork-release-test-plan/v2';
    legacyPlan.release_intake = legacyPlan.release_intakes.G1;
    delete legacyPlan.release_intakes;
    writeJson(legacyPlanPath, legacyPlan);
    expectRejected(status(legacySchema), /plan_schema_mismatch|不支持的发布测试计划/);

    const extraEvent = cloneControl('extra-event');
    fs.writeFileSync(path.join(extraEvent, 'events', '.hidden'), 'unexpected\n');
    expectRejected(status(extraEvent), /事件目录包含非法入口/);

    for (const filename of [
      'release-test-plan.json',
      'release-test-state.json',
      'release-test-integrity.json',
    ]) {
      const linked = cloneControl(`linked-${filename}`);
      const target = path.join(fixture.temporaryRoot, `target-${filename}`);
      fs.copyFileSync(path.join(linked, filename), target);
      fs.unlinkSync(path.join(linked, filename));
      fs.symlinkSync(target, path.join(linked, filename));
      expectRejected(status(linked), /普通文件且不能是符号链接|路径祖先不能是符号链接/);
    }

    const linkedEvents = cloneControl('linked-events');
    const realEvents = path.join(fixture.temporaryRoot, 'real-events');
    fs.renameSync(path.join(linkedEvents, 'events'), realEvents);
    fs.symlinkSync(realEvents, path.join(linkedEvents, 'events'), 'dir');
    expectRejected(status(linkedEvents), /事件目录.*符号链接|路径祖先不能是符号链接/);

    const rootTarget = cloneControl('root-target');
    const linkedRoot = path.join(fixture.temporaryRoot, 'linked-root');
    fs.symlinkSync(rootTarget, linkedRoot, 'dir');
    expectRejected(status(linkedRoot), /控制目录.*符号链接/);

    const realAncestor = path.join(fixture.temporaryRoot, 'real-ancestor');
    fs.mkdirSync(realAncestor);
    fs.cpSync(fixture.stateDir, path.join(realAncestor, 'control'), { recursive: true });
    const linkedAncestor = path.join(fixture.temporaryRoot, 'linked-ancestor');
    fs.symlinkSync(realAncestor, linkedAncestor, 'dir');
    expectRejected(status(path.join(linkedAncestor, 'control')), /路径祖先不能是符号链接/);

    preserveFile(fixture.casebook, () => fs.appendFileSync(fixture.casebook, 'tampered'), () => {
      expectRejected(status(), /Casebook SHA-256 已漂移/);
    });
    preserveFile(fixture.identityFile, () => fs.appendFileSync(fixture.identityFile, ' '), () => {
      expectRejected(status(), /release identity 制品 SHA-256 已漂移/);
    });
    preserveFile(fixture.intakeFile, (original) => {
      fs.writeFileSync(fixture.intakeFile, `${JSON.stringify(JSON.parse(original), null, 4)}\n`);
    }, () => expectRejected(status(), /release_intake_artifact_sha256_mismatch/));
    preserveFile(fixture.observationFile, () => fs.appendFileSync(fixture.observationFile, ' '), () => {
      expectRejected(status(), /release HEAD 观测绑定校验失败/);
    });

    const capabilityFile = path.join(fixture.temporaryRoot, 'capability-audit.json');
    const pretestFile = path.join(fixture.temporaryRoot, 'core-beta-pretest-report.json');
    writeJson(capabilityFile, capability('G1', plan));
    writeJson(pretestFile, pretest('G1', plan));
    const readinessArgs = [
      'readiness',
      '--state-dir', fixture.stateDir,
      '--stage', 'G1',
      '--capability-audit', capabilityFile,
      '--pretest', pretestFile,
    ];
    const rolledBack = command(fixture.work, readinessArgs, {
      NODE_ENV: 'test',
      QBOT_QWORK_FAULT_AFTER_TRANSACTION: '1',
    });
    assert.notEqual(rolledBack.status, 0);
    assert.equal(fs.existsSync(path.join(fixture.stateDir, '.release-test-transaction.json')), true);
    assert.equal(fs.existsSync(path.join(fixture.stateDir, 'events', '0001-G1-readiness.json')), false);
    const afterRollback = status();
    assert.equal(afterRollback.status, 0, afterRollback.stderr);
    assert.equal(JSON.parse(afterRollback.stdout).state.revision, 0);
    assert.equal(fs.existsSync(path.join(fixture.stateDir, '.release-test-transaction.json')), false);

    const interrupted = command(fixture.work, readinessArgs, {
      NODE_ENV: 'test',
      QBOT_QWORK_FAULT_AFTER_EVENT: '1',
    });
    assert.notEqual(interrupted.status, 0);
    assert.equal(fs.existsSync(path.join(fixture.stateDir, '.release-test-transaction.json')), true);
    const recovered = status();
    assert.equal(recovered.status, 0, recovered.stderr);
    assert.equal(fs.existsSync(path.join(fixture.stateDir, '.release-test-transaction.json')), false);
    const recoveredPayload = JSON.parse(recovered.stdout);
    const admissionAudit = recoveredPayload.state.stages.G1.admission;
    assert.equal(admissionAudit.passed, true, admissionAudit.failures?.join(','));
    assert.deepEqual(admissionAudit.external_artifacts.map((item) => item.role), [
      'G1.readiness.capability_audit',
      'G1.readiness.pretest',
    ]);
    const readinessEvent = JSON.parse(fs.readFileSync(
      path.join(fixture.stateDir, 'events', '0001-G1-readiness.json'),
    ));
    assert.equal(readinessEvent.schema_version, 'qbot-qwork-release-test-event/v2');
    assert.equal(status().status, 0, status().stderr);

    preserveFile(capabilityFile, () => fs.appendFileSync(capabilityFile, ' '), () => {
      expectRejected(status(), /G1\.readiness\.capability_audit.*SHA-256 已漂移/);
    });
    preserveFile(pretestFile, () => fs.unlinkSync(pretestFile), () => {
      expectRejected(status(), /G1\.readiness\.pretest/);
    });

    const renamedEventControl = cloneControl('renamed-event');
    fs.renameSync(
      path.join(renamedEventControl, 'events', '0001-G1-readiness.json'),
      path.join(renamedEventControl, 'events', '0001-G2-readiness.json'),
    );
    expectRejected(status(renamedEventControl), /event_filename_binding_mismatch/);

    const wrongIndexControl = cloneControl('wrong-index-event');
    fs.renameSync(
      path.join(wrongIndexControl, 'events', '0001-G1-readiness.json'),
      path.join(wrongIndexControl, 'events', '0002-G1-readiness.json'),
    );
    expectRejected(status(wrongIndexControl), /event_filename_binding_mismatch/);

    const linkedEventControl = cloneControl('linked-event-file');
    const linkedEventPath = path.join(linkedEventControl, 'events', '0001-G1-readiness.json');
    const linkedEventTarget = path.join(fixture.temporaryRoot, 'event-target.json');
    fs.copyFileSync(linkedEventPath, linkedEventTarget);
    fs.unlinkSync(linkedEventPath);
    fs.symlinkSync(linkedEventTarget, linkedEventPath);
    expectRejected(status(linkedEventControl), /事件目录包含非法入口|事件文件.*符号链接|路径祖先不能是符号链接/);

    const runDir = path.join(fixture.temporaryRoot, 'immutable-run');
    fs.mkdirSync(path.join(runDir, 'cases', '001-demo'), { recursive: true });
    writeJson(path.join(runDir, 'automation-progress.json'), {});
    writeJson(path.join(runDir, 'automation-run-summary.json'), {
      credibility_review_json: 'trusted-review.json',
    });
    writeJson(path.join(runDir, 'run-metadata.json'), {});
    writeJson(path.join(runDir, 'trusted-review.json'), {});
    fs.writeFileSync(path.join(runDir, 'cases', '001-demo', 'evidence.txt'), 'immutable evidence\n');
    const completed = command(fixture.work, [
      'complete',
      '--state-dir', fixture.stateDir,
      '--stage', 'G1',
      '--run-dir', runDir,
    ]);
    assert.equal(completed.status, 0, completed.stderr);
    const completionPayload = JSON.parse(completed.stdout);
    assert.equal(completionPayload.audit.passed, false);
    assert.ok(completionPayload.audit.external_artifacts.some(
      (item) => item.role === 'G1.completion.evidence_tree' && item.type === 'directory-tree',
    ));
    assert.equal(status().status, 0, status().stderr);

    const added = path.join(runDir, 'unexpected-after-completion.txt');
    fs.writeFileSync(added, 'added\n');
    expectRejected(status(), /evidence_tree.*目录树 SHA-256 已漂移/);
    fs.unlinkSync(added);
    assert.equal(status().status, 0, status().stderr);

    const evidence = path.join(runDir, 'cases', '001-demo', 'evidence.txt');
    preserveFile(evidence, () => fs.unlinkSync(evidence), () => {
      expectRejected(status(), /evidence_tree.*目录树 SHA-256 已漂移/);
    });
    preserveFile(evidence, () => fs.appendFileSync(evidence, 'changed\n'), () => {
      expectRejected(status(), /evidence_tree.*目录树 SHA-256 已漂移/);
    });
    const metadata = path.join(runDir, 'run-metadata.json');
    const renamedMetadata = path.join(runDir, 'run-metadata-renamed.json');
    fs.renameSync(metadata, renamedMetadata);
    expectRejected(status(), /completion\.metadata|evidence_tree/);
    fs.renameSync(renamedMetadata, metadata);
    assert.equal(status().status, 0, status().stderr);
  } finally {
    fs.rmSync(fixture.temporaryRoot, { recursive: true, force: true });
  }
});
