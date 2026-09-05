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
  scanQworkReleaseIntake,
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

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const orchestrator = path.join(root, 'scripts', 'orchestrate-qwork-release-test.mjs');
const observationCli = path.join(root, 'scripts', 'observe-qwork-release-ref.mjs');
const intakeCli = path.join(root, 'scripts', 'scan-qwork-release-intake.mjs');
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
      size: Buffer.byteLength(source),
      encoding: 'base64',
      content: Buffer.from(source).toString('base64'),
      ref: head,
      blob_id: gitBlobSha1(source),
      commit_id: head,
      last_commit_id: head,
    }];
  }));
}

function makeReleaseIntake({ repository, frameworkCommit, releaseHead }) {
  const releaseFiles = currentReleaseFileFixtures(QWORK_RELEASE_SOURCE_CONTRACTS, releaseHead);
  const blockingRiskMerges = new Set([
    QWORK_MR1552_MERGE_COMMIT_SHA,
    QWORK_MR1559_MERGE_COMMIT_SHA,
  ]);
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
    if (endpoint.startsWith('repository/files/')) {
      const encoded = endpoint.slice('repository/files/'.length, endpoint.indexOf('?'));
      const filePath = decodeURIComponent(encoded);
      if (!releaseFiles.has(filePath)) throw new Error(`missing release file ${filePath}`);
      return releaseFiles.get(filePath);
    }
    throw new Error(`unexpected endpoint ${endpoint}`);
  };
  return scanQworkReleaseIntake({
    repoRoot: repository,
    releaseRef: QWORK_RELEASE_INTAKE_DEFAULT_REF,
    baselineCommit: QWORK_RELEASE_CASEBOOK_DESIGN_BASELINE_COMMIT,
    casebookPath: path.join(root, 'PRD', QWORK_RELEASE_CASEBOOK_BASENAME),
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
      teams: { version: plan.release_identity.teams_version, build: plan.release_identity.teams_build },
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
  const intakeFile = path.join(temporaryRoot, 'release-intake.json');
  const observationFile = path.join(temporaryRoot, 'release-observation.json');
  const stateDir = path.join(temporaryRoot, 'control');
  fs.copyFileSync(path.join(root, 'PRD', QWORK_RELEASE_CASEBOOK_BASENAME), casebook);
  writeJson(identityFile, {
    schema_version: QWORK_RELEASE_IDENTITY_SCHEMA,
    captured_at: '2026-09-05T00:00:00.000Z',
    ...identity,
  });
  writeJson(intakeFile, makeReleaseIntake({
    repository: work,
    frameworkCommit,
    releaseHead: frameworkCommit,
  }));
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
    '--release-intake', intakeFile,
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
    intakeFile,
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
      ['release_intake', 'file'],
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
    legacyPlan.schema_version = 'qbot-qwork-release-test-plan/v1';
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
