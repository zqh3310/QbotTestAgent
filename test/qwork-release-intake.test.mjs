import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  QWORK_RELEASE_INTAKE_SCHEMA,
  QWORK_RELEASE_INTAKE_TOOL_VERSION,
  createGitLabReadOnlyReader,
  mapReleaseImpact,
  scanQworkReleaseIntake,
  sha256Text,
  stableJson,
  validateQworkReleaseIntake,
  writeQworkReleaseIntake,
} from '../src/lib/qwork-release-intake.mjs';
import {
  QWORK_MR1540_MEMORY_FEATURE_PROFILE_CONTRACT,
  QWORK_MR1546_REJECTED_REGENERATE_CONTRACT,
  QWORK_MR1557_IMMEDIATE_REGENERATE_PROJECTION_CONTRACT,
  QWORK_MR1550_CLAUDE_SKILL_DESCRIPTION_ROUTING_CONTRACT,
  QWORK_MR1558_SETTINGS_MODEL_NAME_DEDUP_CONTRACT,
  QWORK_MR1595_OBSOLETE_TEST_RETIREMENT_CONTRACT,
  QWORK_MR1590_QBOT_EXPERT_CLOUD_INSTALLATION_CONTRACT,
  QWORK_MR1593_QBOT_ADDITIVE_RESPONSE_COMPATIBILITY_CONTRACT,
  QWORK_MR1596_ANONYMOUS_STABLE_RUNTIME_DISCOVERY_CONTRACT,
  QWORK_MR1597_WORKER_IM_USER_IDENTITY_FORWARDING_CONTRACT,
  QWORK_MR1561_WORKER_ENVELOPE_LIMIT_CONTRACT,
  QWORK_MR1560_TURN_AUTHORITY_READINESS_CONTRACT,
  QWORK_MR1573_MEMORY_SESSION_PROFILE_STABILITY_CONTRACT,
  QWORK_MR1579_CLAUDE_SKILL_CALL_CANONICALIZATION_CONTRACT,
  QWORK_MR1579_CLAUDE_SKILL_CALL_CANONICALIZATION_CONTRACT_ID,
  QWORK_MR1522_CLAUDE_TURN_HEADERS_CONTRACT,
  QWORK_MR1544_CLAUDE_TURN_HEADER_BRANDING_CONTRACT,
  QWORK_MR1548_CALL_TOOL_BUDGET_CONTRACT,
  QWORK_GITLAB_FIRST_PARENT_COMPARE_SCHEMA,
  QWORK_RELEASE_CURRENT_SOURCE_CONTRACT_SCHEMA,
  QWORK_RELEASE_SOURCE_CLAIM_SCOPE,
  QWORK_RELEASE_SOURCE_CONTRACT_SCHEMA,
  QWORK_RELEASE_SOURCE_CONTRACTS,
  QWORK_RELEASE_SOURCE_OWNER_SCOPE_SCHEMA,
  QWORK_RELEASE_SOURCE_TEST_EXECUTION_ATTESTED,
  QWORK_SOURCE_BINDING_SUCCESSOR_RELATIONSHIP_SCHEMA,
  auditCurrentReleaseSourceContract,
  auditReleaseSourceContract,
  currentReleaseSourceContractProtectedPaths,
  normalizeGitLabChanges,
  reconstructGitLabAddedLinesSource,
  reconstructGitLabNewFileSource,
  releaseSourceContractProtectedPaths,
  releaseSourceContractTrigger,
  resolveCurrentReleaseHeaderContract,
  resolveReleaseSourceContracts,
  reconstructGitLabFirstParentChain,
  summarizeGitLabChanges,
  validateCanonicalGitLabCommitMetadata,
  validateCanonicalGitLabDiffChange,
  validateCurrentReleaseSourceContractAttestation,
  validateReleaseSourceContractAttestation,
  validateReleaseSourceContractsForReport,
} from '../src/lib/qwork-release-source-contracts.mjs';
import {
  QWORK_RELEASE_CASEBOOK_BASENAME,
  QWORK_RELEASE_CASEBOOK_DESIGN_BASELINE_COMMIT,
  QWORK_RELEASE_CASEBOOK_SHA256,
  QWORK_RELEASE_TEST_STAGES,
  validateQworkReleaseIntakeBinding,
} from '../src/lib/qwork-release-test-plan.mjs';
import {
  QWORK_MR1552_LEGACY_PROTECTED_PATHS,
  QWORK_MR1552_MERGE_COMMIT_SHA,
  QWORK_MR1559_EXECUTION_RUNNER_SUCCESSOR_ID,
  QWORK_MR1559_MERGE_COMMIT_SHA,
  QWORK_MR1559_SUCCESSOR_PROTECTED_PATHS,
} from '../src/lib/qwork-release-blocking-risks.mjs';

function git(repo, ...args) {
  return execFileSync('git', args, { cwd: repo, encoding: 'utf8' }).trim();
}

function gitBlobSha1(source) {
  const body = Buffer.from(source, 'utf8');
  return createHash('sha1').update(Buffer.concat([
    Buffer.from(`blob ${body.length}\0`, 'utf8'),
    body,
  ])).digest('hex');
}

function replaceRequired(source, search, replacement, label) {
  assert.equal(source.includes(search), true, `${label}: mutation target missing`);
  return source.replace(search, replacement);
}

test('GitLab token transport keeps TLS verification and freezes the destination', () => {
  const intakeSource = fs.readFileSync(
    new URL('../src/lib/qwork-release-intake.mjs', import.meta.url),
    'utf8',
  );
  assert.doesNotMatch(intakeSource, /^\s*['"]insecure['"],?\s*$/mu);
  assert.match(intakeSource, /'proto = "=https"'/u);
  assert.match(intakeSource, /'tlsv1\.2'/u);
  assert.doesNotThrow(() => createGitLabReadOnlyReader());
  assert.throws(
    () => createGitLabReadOnlyReader({ host: 'attacker.invalid' }),
    /仅允许发送到冻结的 deepbankV2 项目/,
  );
  assert.throws(
    () => createGitLabReadOnlyReader({ projectPath: 'another/project' }),
    /仅允许发送到冻结的 deepbankV2 项目/,
  );
  assert.throws(
    () => createGitLabReadOnlyReader({ token: 'token\nurl = "https://attacker.invalid"' }),
    /token 格式非法/,
  );
});

function gitLabFilePayload(filePath, source, head) {
  return {
    file_name: path.basename(filePath),
    file_path: filePath,
    size: Buffer.byteLength(source, 'utf8'),
    encoding: 'base64',
    content: Buffer.from(source, 'utf8').toString('base64'),
    ref: head,
    blob_id: gitBlobSha1(source),
    commit_id: head,
    last_commit_id: head,
  };
}

function gitLabCommitMetadata(id, overrides = {}) {
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
    ...overrides,
  };
}

function gitLabDiffResponseChange(oldPath, newPath = oldPath, overrides = {}) {
  return {
    old_path: oldPath,
    new_path: newPath,
    a_mode: '100644',
    b_mode: '100644',
    diff: '@@ -1 +1 @@\n-old\n+new',
    new_file: false,
    renamed_file: oldPath !== newPath,
    deleted_file: false,
    generated_file: false,
    collapsed: false,
    too_large: false,
    ...overrides,
  };
}

test('GitLab provenance canonical projections require exact commit and diff response shapes', () => {
  const commitId = 'a'.repeat(40);
  const metadata = gitLabCommitMetadata(commitId);
  assert.equal(Object.keys(metadata).length, 18);
  const metadataValidation = validateCanonicalGitLabCommitMetadata(metadata, commitId);
  assert.equal(metadataValidation.ok, true, metadataValidation.failures.join(','));
  assert.deepEqual(metadataValidation.projection, JSON.parse(stableJson(metadata)));

  for (const field of Object.keys(metadata)) {
    const reduced = structuredClone(metadata);
    delete reduced[field];
    const validation = validateCanonicalGitLabCommitMetadata(reduced, commitId);
    assert.equal(validation.ok, false, field);
    assert.equal(validation.failures.includes('fields_mismatch'), true, field);
    assert.equal(validation.projection, null, field);
  }
  for (const unknownField of ['extended_trailers', 'untrusted_extra']) {
    const expanded = { ...metadata, [unknownField]: {} };
    const validation = validateCanonicalGitLabCommitMetadata(expanded, commitId);
    assert.equal(validation.ok, false, unknownField);
    assert.equal(validation.failures.includes('fields_mismatch'), true, unknownField);
    assert.equal(validation.projection, null, unknownField);
  }
  const canonicalPipeline = {
    id: 101,
    iid: 17,
    project_id: metadata.project_id,
    sha: commitId,
    ref: 'release/0.1',
    status: 'success',
    source: 'push',
    created_at: '2026-09-08T01:02:03Z',
    updated_at: '2026-09-08T01:03:04Z',
    web_url: 'https://gitlab.daikuan.qihoo.net/songrongxin/deepbankv2/-/pipelines/101',
  };
  assert.equal(validateCanonicalGitLabCommitMetadata(
    { ...metadata, last_pipeline: canonicalPipeline },
    commitId,
  ).ok, true);
  for (const [label, mutation, expectedFailure] of [
    ['pipeline project identity', { project_id: 999 }, 'last_pipeline_project_id_mismatch'],
    ['pipeline commit identity', { sha: 'c'.repeat(40) }, 'last_pipeline_sha_mismatch'],
    [
      'pipeline URL identity',
      { web_url: 'https://gitlab.daikuan.qihoo.net/songrongxin/deepbankv2/-/pipelines/999' },
      'last_pipeline_web_url_invalid',
    ],
  ]) {
    const validation = validateCanonicalGitLabCommitMetadata({
      ...metadata,
      last_pipeline: { ...canonicalPipeline, ...mutation },
    }, commitId);
    assert.equal(validation.ok, false, label);
    assert.equal(validation.failures.includes(expectedFailure), true,
      `${label}:${validation.failures.join(',')}`);
    assert.equal(validation.projection, null, label);
  }

  const rawChange = gitLabDiffResponseChange('server/qbot-core/example.mjs');
  const changeValidation = validateCanonicalGitLabDiffChange(rawChange);
  assert.equal(changeValidation.ok, true, changeValidation.failures.join(','));
  assert.deepEqual(changeValidation.projection, {
    old_path: 'server/qbot-core/example.mjs',
    new_path: 'server/qbot-core/example.mjs',
    new_file: false,
    renamed_file: false,
    deleted_file: false,
  });
  assert.equal(Object.keys(rawChange).length, 11);
  for (const field of [
    'old_path', 'new_path', 'a_mode', 'b_mode', 'diff', 'new_file', 'renamed_file',
    'deleted_file',
  ]) {
    const reduced = structuredClone(rawChange);
    delete reduced[field];
    const validation = validateCanonicalGitLabDiffChange(reduced);
    assert.equal(validation.ok, false, field);
    assert.equal(validation.failures.includes('fields_mismatch'), true, field);
    assert.equal(validation.projection, null, field);
  }
  for (const field of ['generated_file', 'collapsed', 'too_large']) {
    const reduced = structuredClone(rawChange);
    delete reduced[field];
    const validation = validateCanonicalGitLabDiffChange(reduced);
    assert.equal(validation.ok, true, `${field}:${validation.failures.join(',')}`);
    assert.deepEqual(validation.projection, changeValidation.projection, field);
  }
  const minimumChange = Object.fromEntries(Object.entries(rawChange).filter(([field]) => (
    !['generated_file', 'collapsed', 'too_large'].includes(field)
  )));
  assert.equal(Object.keys(minimumChange).length, 8);
  assert.equal(validateCanonicalGitLabDiffChange(minimumChange).ok, true);
  for (const [label, change, expectedFailure] of [
    ['unknown_field', { ...rawChange, untrusted_extra: false }, 'fields_mismatch'],
    ['optional_flag_type', { ...rawChange, generated_file: 'false' }, 'generated_file_invalid'],
    ['rename_path_conflict', { ...rawChange, renamed_file: true }, 'flags_conflict'],
  ]) {
    const validation = validateCanonicalGitLabDiffChange(change);
    assert.equal(validation.ok, false, label);
    assert.equal(validation.failures.includes(expectedFailure), true, label);
  }
});

test('GitLab first-parent compare reconstruction fails closed on malformed raw payloads', () => {
  const baseline = 'a'.repeat(40);
  const head = 'b'.repeat(40);
  const validCommit = { id: head, parent_ids: [baseline] };
  const validCompare = { compare_timeout: false, commits: [validCommit] };
  const validPipeline = {
    id: 101,
    iid: 17,
    project_id: 1,
    sha: head,
    ref: 'release/0.1',
    status: 'success',
    source: 'push',
    created_at: '2026-09-08T01:02:03Z',
    updated_at: '2026-09-08T01:03:04Z',
    web_url: 'https://gitlab.daikuan.qihoo.net/songrongxin/deepbankv2/-/pipelines/101',
  };

  const reconstructed = reconstructGitLabFirstParentChain({
    compare: validCompare,
    baselineCommit: baseline,
    releaseHead: head,
  });
  assert.equal(reconstructed.ok, true);
  assert.deepEqual(reconstructed.commits, [validCommit]);

  const knownOptionalFields = reconstructGitLabFirstParentChain({
    compare: {
      compare_timeout: false,
      commits: [{
        ...validCommit,
        message: 'Merge branch with native GitLab trailing newline\n\nDetailed body.\n',
        trailers: { 'Reviewed-by': 'QBot QA' },
        extended_trailers: { 'Signed-off-by': ['QBot QA'] },
        project_id: 1,
        last_pipeline: validPipeline,
      }],
    },
    baselineCommit: baseline,
    releaseHead: head,
  });
  assert.equal(knownOptionalFields.ok, true, knownOptionalFields.reason);

  for (const [label, compare, expectedReason] of [
    [
      'blank commit message',
      { compare_timeout: false, commits: [{ ...validCommit, message: ' \n\t' }] },
      'compare_commit_invalid:0:message_invalid',
    ],
    ...[
      ['empty commit message', ''],
      ['null commit message', null],
      ['numeric commit message', 1],
      ['boolean commit message', false],
      ['array commit message', ['message']],
      ['object commit message', { value: 'message' }],
    ].map(([label, message]) => [
      label,
      { compare_timeout: false, commits: [{ ...validCommit, message }] },
      'compare_commit_invalid:0:message_invalid',
    ]),
    [
      'title still rejects native trailing newline',
      { compare_timeout: false, commits: [{ ...validCommit, title: 'Merge title\n' }] },
      'compare_commit_invalid:0:title_invalid',
    ],
    [
      'timeout boolean',
      { ...validCompare, compare_timeout: true },
      'compare_timeout',
    ],
    [
      'timeout string',
      { ...validCompare, compare_timeout: 'false' },
      'compare_timeout_type_invalid',
    ],
    [
      'non-identity empty commits',
      { compare_timeout: false, commits: [] },
      'first_parent_commit_missing:' + head,
    ],
    [
      'unknown commit field',
      { compare_timeout: false, commits: [{ ...validCommit, untrusted_extra: true }] },
      'compare_commit_invalid:0:fields_mismatch',
    ],
    [
      'extended trailers must be an object',
      { compare_timeout: false, commits: [{ ...validCommit, extended_trailers: [] }] },
      'compare_commit_invalid:0:extended_trailers_invalid',
    ],
    [
      'extended trailer string-map is not the GitLab shape',
      {
        compare_timeout: false,
        commits: [{ ...validCommit, extended_trailers: { 'Reviewed-by': 'QBot QA' } }],
      },
      'compare_commit_invalid:0:extended_trailers_invalid',
    ],
    [
      'extended trailer arrays cannot be empty',
      { compare_timeout: false, commits: [{ ...validCommit, extended_trailers: { 'Reviewed-by': [] } }] },
      'compare_commit_invalid:0:extended_trailers_invalid',
    ],
    [
      'extended trailer arrays contain only strings',
      {
        compare_timeout: false,
        commits: [{ ...validCommit, extended_trailers: { 'Reviewed-by': ['QBot QA', 1] } }],
      },
      'compare_commit_invalid:0:extended_trailers_invalid',
    ],
    [
      'last pipeline shape',
      { compare_timeout: false, commits: [{ ...validCommit, last_pipeline: {} }] },
      'compare_commit_invalid:0:last_pipeline_fields_mismatch',
    ],
    [
      'last pipeline requires commit project identity',
      { compare_timeout: false, commits: [{ ...validCommit, last_pipeline: validPipeline }] },
      'compare_commit_invalid:0:last_pipeline_project_id_mismatch',
    ],
    [
      'last pipeline commit identity',
      {
        compare_timeout: false,
        commits: [{
          ...validCommit,
          project_id: 1,
          last_pipeline: { ...validPipeline, sha: 'c'.repeat(40) },
        }],
      },
      'compare_commit_invalid:0:last_pipeline_sha_mismatch',
    ],
    [
      'duplicate commit id',
      { compare_timeout: false, commits: [validCommit, { ...validCommit }] },
      'compare_commit_invalid:1:duplicate_id',
    ],
    [
      'missing parent ids',
      { compare_timeout: false, commits: [{ id: head }] },
      'compare_commit_invalid:0:parent_ids_invalid',
    ],
    [
      'uppercase commit id',
      { compare_timeout: false, commits: [{ id: head.toUpperCase(), parent_ids: [baseline] }] },
      'compare_commit_invalid:0:id_invalid',
    ],
    [
      'uppercase parent id',
      { compare_timeout: false, commits: [{ id: head, parent_ids: [baseline.toUpperCase()] }] },
      'compare_commit_invalid:0:parent_ids_invalid',
    ],
  ]) {
    const result = reconstructGitLabFirstParentChain({
      compare,
      baselineCommit: baseline,
      releaseHead: head,
    });
    assert.equal(result.ok, false, label);
    assert.equal(result.reason, expectedReason, `${label}:${result.reason}`);
    assert.deepEqual(result.commits, [], label);
  }

  const identity = reconstructGitLabFirstParentChain({
    compare: { compare_timeout: false, commits: [] },
    baselineCommit: baseline,
    releaseHead: baseline,
  });
  assert.deepEqual(identity, { ok: true, commits: [] });

  const identityTimeout = reconstructGitLabFirstParentChain({
    compare: { compare_timeout: true, commits: [] },
    baselineCommit: baseline,
    releaseHead: baseline,
  });
  assert.deepEqual(identityTimeout, {
    ok: false,
    reason: 'compare_timeout',
    commits: [],
  });
});

function gitLabFileProvenance(filePath, head, lastCommitId = head) {
  const diffEndpoint = `repository/commits/${lastCommitId}/diff?per_page=100`;
  const change = {
    old_path: filePath,
    new_path: filePath,
    new_file: false,
    renamed_file: false,
    deleted_file: false,
  };
  const rawChange = gitLabDiffResponseChange(filePath);
  const commitMetadata = gitLabCommitMetadata(lastCommitId);
  return {
    schema_version: 'qbot-qwork-release-file-provenance/v2',
    source: 'gitlab-api-repository-commit-diff',
    commit_endpoint: `repository/commits/${lastCommitId}`,
    diff_endpoint: diffEndpoint,
    path: filePath,
    ref: head,
    release_commit_id: head,
    file_last_commit_id: lastCommitId,
    commit_id: lastCommitId,
    commit_raw_response: structuredClone(commitMetadata),
    commit_metadata: commitMetadata,
    commit_response_sha256: sha256Text(stableJson(commitMetadata)),
    diff_page_size: 100,
    diff_pages: [{
      page: 1,
      endpoint: `${diffEndpoint}&page=1`,
      item_count: 1,
      raw_response: [rawChange],
      changes: [change],
      response_sha256: sha256Text(stableJson([rawChange])),
    }],
    matched_change_count: 1,
    matched_changes: [change],
    path_verified: true,
    error: '',
  };
}

function commit(repo, file, value, message) {
  fs.mkdirSync(path.dirname(path.join(repo, file)), { recursive: true });
  fs.writeFileSync(path.join(repo, file), value);
  git(repo, 'add', file);
  git(repo, 'commit', '-m', message);
  return git(repo, 'rev-parse', 'HEAD');
}

function fixtureRepo() {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'qbot-intake-repo-'));
  git(repo, 'init', '-b', 'main');
  git(repo, 'config', 'user.email', 'qa@example.invalid');
  git(repo, 'config', 'user.name', 'QA');
  const root = commit(repo, 'README.md', 'initial\n', 'initial');
  git(repo, 'checkout', '-b', 'release/0.1');
  const baseline = root;
  fs.mkdirSync(path.join(repo, 'server', 'qbot-core', 'automation'), { recursive: true });
  fs.writeFileSync(path.join(repo, 'server', 'qbot-core', 'automation', 'scheduler.mjs'), 'export const schedule = true;\n');
  git(repo, 'add', '.');
  git(repo, 'commit', '-m', "Merge branch 'feature/automation' into release/0.1 (!101)");
  const releaseHead = git(repo, 'rev-parse', 'HEAD');
  return { repo, baseline, releaseHead };
}

function completeCurrentReleaseJavaScriptFixture(filePath, sourceLines, contracts) {
  let lines = [...sourceLines];
  const mr1597 = contracts.find((contract) => (
    contract.contract_id === QWORK_MR1597_WORKER_IM_USER_IDENTITY_FORWARDING_CONTRACT.contract_id
  ));
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
  lines.splice(
    oversizedIndex + 2,
    0,
    '  };',
    '  void oversizedEnvelopeFixture;',
    '});',
  );
  return lines;
}

function currentReleaseFileFixtures(contracts, head, {
  ancestryByContractId = new Map(contracts.map((contract) => [contract.contract_id, {
    verified: true,
    first_parent_complete: true,
  }])),
} = {}) {
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
      addLine(binding.path, binding.addition?.source);
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
      size: Buffer.byteLength(source, 'utf8'),
      encoding: 'base64',
      content: Buffer.from(source, 'utf8').toString('base64'),
      ref: head,
      blob_id: gitBlobSha1(source),
      commit_id: head,
      last_commit_id: head,
      last_commit_provenance: gitLabFileProvenance(filePath, head),
    }];
  }));
}

function apiFixture({
  baseline = 'a'.repeat(40),
  head = 'b'.repeat(40),
  afterHead = head,
  mrState = 'merged',
  targetBranch = 'release/0.1',
  mergeCommitSha = head,
  squashCommitSha = '',
  mrIid = 901,
  changesCount = '1',
  changes = [{ old_path: 'README.md', new_path: 'docs/release.md', diff: '+release' }],
  overflow = false,
  omitHeadFromCompare = false,
  sourceContracts = QWORK_RELEASE_SOURCE_CONTRACTS,
  releaseFileOverrides = new Map(),
  failContractAncestry = false,
  successorRelationship = 'predecessor',
  compareCommits = null,
  commitMrRows = null,
  mrChangesByIid = null,
} = {}) {
  let branchReads = 0;
  const releaseFiles = currentReleaseFileFixtures(sourceContracts, head);
  const sourceContractSuccessors = sourceContracts.flatMap((contract) => (
    (Array.isArray(contract?.integration_bindings) ? contract.integration_bindings : [])
      .map((binding) => binding?.current_release_match?.successor)
      .filter(Boolean)
  ));
  for (const [filePath, payload] of releaseFileOverrides) releaseFiles.set(filePath, payload);
  const reader = (endpoint) => {
    if (endpoint.startsWith('repository/branches/')) {
      branchReads += 1;
      return { commit: { id: branchReads === 1 ? head : afterHead } };
    }
    if (endpoint.startsWith('repository/compare?')) {
      const query = new URLSearchParams(endpoint.slice(endpoint.indexOf('?') + 1));
      const from = query.get('from');
      const to = query.get('to');
      const isContractAncestry = sourceContracts.some((contract) => contract.merge_commit_sha === from);
      const successor = sourceContractSuccessors.find((candidate) => (
        candidate.merge_commit_sha === from || candidate.merge_commit_sha === to
      ));
      if (successor && from === successor.merge_commit_sha && to === head) {
        if (head === successor.merge_commit_sha) return { compare_timeout: false, commits: [] };
        if (successorRelationship !== 'successor') return { compare_timeout: false, commits: [] };
        return {
          compare_timeout: false,
          commits: [{
            id: head,
            parent_ids: [successor.merge_commit_sha],
            title: 'Synthetic successor history fixture',
            message: 'Synthetic successor history fixture',
            committed_date: '2026-09-08T01:00:00Z',
          }],
        };
      }
      if (successor && from === head && to === successor.merge_commit_sha) {
        if (successorRelationship === 'successor') return { compare_timeout: false, commits: [] };
        return {
          compare_timeout: false,
          commits: [{
            id: successor.merge_commit_sha,
            parent_ids: [head],
            title: 'Synthetic predecessor history fixture',
            message: 'Synthetic predecessor history fixture',
            committed_date: '2026-09-08T01:00:00Z',
          }],
        };
      }
      if (isContractAncestry && failContractAncestry) return { compare_timeout: false, commits: [] };
      if (from === baseline && to === head && Array.isArray(compareCommits)) {
        return { compare_timeout: false, commits: omitHeadFromCompare ? [] : compareCommits };
      }
    if (from === head && [QWORK_MR1552_MERGE_COMMIT_SHA, QWORK_MR1559_MERGE_COMMIT_SHA].includes(to)) {
        if (head === QWORK_MR1559_MERGE_COMMIT_SHA) return { compare_timeout: false, commits: [] };
        return {
          compare_timeout: false,
          commits: [{
            id: to,
            parent_ids: [head],
            title: 'Synthetic forward history fixture',
            message: 'Synthetic forward history fixture',
            committed_date: '2026-09-03T01:00:00Z',
          }],
        };
      }
      if ([QWORK_MR1552_MERGE_COMMIT_SHA, QWORK_MR1559_MERGE_COMMIT_SHA].includes(from)
        && to === head) {
        return { compare_timeout: false, commits: [] };
      }
      return {
        compare_timeout: false,
        commits: omitHeadFromCompare ? [] : [{
          id: head,
          parent_ids: [isContractAncestry ? from : baseline, 'c'.repeat(40)],
          title: 'Merge branch feature into release/0.1',
          message: 'Merge branch feature into release/0.1',
          committed_date: '2026-09-03T01:00:00Z',
        }],
      };
    }
    const commitDiffMatch = endpoint.match(/^repository\/commits\/([a-f0-9]{40})\/diff\?per_page=100&page=(\d+)$/i);
    if (commitDiffMatch) {
      const [, commitSha, pageText] = commitDiffMatch;
      const page = Number(pageText);
      const rows = [...releaseFiles.entries()]
        .filter(([, payload]) => payload.last_commit_id === commitSha)
        .map(([filePath]) => gitLabDiffResponseChange(filePath));
      return rows.slice((page - 1) * 100, page * 100);
    }
    const commitMetadataMatch = endpoint.match(/^repository\/commits\/([a-f0-9]{40})$/i);
    if (commitMetadataMatch) return gitLabCommitMetadata(commitMetadataMatch[1]);
    const commitMrMatch = endpoint.match(/^repository\/commits\/([a-f0-9]{40})\/merge_requests$/i);
    if (commitMrMatch) {
      const commitSha = commitMrMatch[1];
      const override = commitMrRows instanceof Map
        ? commitMrRows.get(commitSha)
        : commitMrRows?.[commitSha];
      if (override !== undefined) return override;
      if (commitSha !== head) return [];
      return [{
        iid: mrIid,
        title: 'release change',
        state: mrState,
        target_branch: targetBranch,
        source_branch: 'feature/release-change',
        merge_commit_sha: mergeCommitSha,
        squash_commit_sha: squashCommitSha,
        merged_at: '2026-09-03T01:00:00Z',
        labels: ['area/runtime'],
      }];
    }
    const changesMatch = endpoint.match(/^merge_requests\/([^/]+)\/changes$/);
    if (changesMatch) {
      const iid = changesMatch[1];
      const override = mrChangesByIid instanceof Map
        ? mrChangesByIid.get(iid)
        : mrChangesByIid?.[iid];
      if (override !== undefined) return override;
      if (String(iid) !== String(mrIid)) throw new Error(`missing MR changes fixture ${iid}`);
      return {
        iid: mrIid,
        state: mrState,
        target_branch: targetBranch,
        merge_commit_sha: mergeCommitSha,
        squash_commit_sha: squashCommitSha,
        changes_count: changesCount,
        overflow,
        changes,
      };
    }
    if (endpoint.startsWith('repository/files/')) {
      const encodedPath = endpoint.slice('repository/files/'.length, endpoint.indexOf('?'));
      const filePath = decodeURIComponent(encodedPath);
      if (!releaseFiles.has(filePath)) throw new Error(`missing release file fixture ${filePath}`);
      return releaseFiles.get(filePath);
    }
    throw new Error(`unexpected endpoint ${endpoint}`);
  };
  reader.readRaw = (endpoint) => {
    const value = reader(endpoint);
    return { bytes: Buffer.from(JSON.stringify(value), 'utf8'), value };
  };
  return { baseline, head, reader };
}

function byteRecord(source) {
  return {
    source,
    bytes: Buffer.byteLength(source, 'utf8'),
    sha256: sha256Text(source),
  };
}

function ancestryWithRawCompare(ancestry, compare) {
  const bytes = Buffer.from(JSON.stringify(compare), 'utf8');
  return {
    ...ancestry,
    compare_evidence: {
      schema_version: QWORK_GITLAB_FIRST_PARENT_COMPARE_SCHEMA,
      source: 'gitlab-api-read-only',
      host: 'gitlab.daikuan.qihoo.net',
      project: 'songrongxin/deepbankv2',
      method: 'GET',
      endpoint: `repository/compare?from=${ancestry.compare_from}&to=${ancestry.compare_to}&straight=true`,
      compare_from: ancestry.compare_from,
      compare_to: ancestry.compare_to,
      straight: true,
      raw_response_encoding: 'base64',
      raw_response_base64: bytes.toString('base64'),
      raw_response_bytes: bytes.length,
      raw_response_sha256: createHash('sha256').update(bytes).digest('hex'),
    },
  };
}

function sourceContractFixture() {
  const sourceLines = [
    'const userAgent = `SID_${sessionId}#TID_${turnId}`;',
    'lines.push(`User-Agent: ${userAgent}`);',
    "appendHeader(lines, 'x-session-id', sessionId);",
    "appendHeader(lines, 'x-turn-id', turnId);",
    "appendHeader(lines, 'x-request-id', requestId);",
    "appendHeader(lines, 'x-request-time', requestTime);",
    'export { lines };',
  ];
  const source = `${sourceLines.join('\n')}\n`;
  const sourcePath = 'server/qbot-core/models/test-turn-headers.mjs';
  const sourceChange = {
    old_path: sourcePath,
    new_path: sourcePath,
    new_file: true,
    renamed_file: false,
    deleted_file: false,
    diff: `@@ -0,0 +1,${sourceLines.length} @@\n${sourceLines.map((line) => `+${line}`).join('\n')}\n`,
  };
  const hostAddition = 'session: turnSession, turnId: currentTurnId,';
  const engineAddition = 'env = withTurnHeaders(env, { sessionId, turnId, requestId, requestTime });';
  const fallbackTurnAddition = 'session: { ...fallbackSession, agentSessionId: null }, turnId,';
  const fallbackContextAddition = 'fallbackSession: null, turnRequestContext: requestContext,';
  const changes = [
    {
      old_path: 'electron/host.cjs',
      new_path: 'electron/host.cjs',
      new_file: false,
      renamed_file: false,
      deleted_file: false,
      diff: `@@ -1 +1,2 @@\n context\n+${hostAddition}\n`,
    },
    {
      old_path: 'server/qbot-core/engine.mjs',
      new_path: 'server/qbot-core/engine.mjs',
      new_file: false,
      renamed_file: false,
      deleted_file: false,
      diff: `@@ -1 +1,4 @@\n context\n+${engineAddition}\n+${fallbackTurnAddition}\n+${fallbackContextAddition}\n`,
    },
    sourceChange,
  ];
  const summarized = summarizeGitLabChanges(changes);
  const normalizedSourceChange = normalizeGitLabChanges([sourceChange])[0];
  const definition = {
    claim_scope: QWORK_RELEASE_SOURCE_CLAIM_SCOPE,
    test_execution_attested: QWORK_RELEASE_SOURCE_TEST_EXECUTION_ATTESTED,
    contract_id: 'test-turn-headers/v1',
    mr_iid: '42',
    state: 'merged',
    target_branch: 'release/0.1',
    merge_commit_sha: '4'.repeat(40),
    changes_count: changes.length,
    changed_paths: summarized.paths,
    mr_diff: {
      bytes: summarized.diff_bytes,
      sha256: summarized.diff_sha256,
    },
    source_file: {
      proof_mode: 'exact-new-file',
      path: sourcePath,
      old_path: sourcePath,
      new_file: true,
      renamed_file: false,
      deleted_file: false,
      change_bytes: Buffer.byteLength(stableJson(normalizedSourceChange), 'utf8'),
      change_sha256: sha256Text(stableJson(normalizedSourceChange)),
      source_bytes: Buffer.byteLength(source, 'utf8'),
      source_sha256: sha256Text(source),
      source_line_count: sourceLines.length,
    },
    header_emissions: [
      {
        name: 'user-agent',
        wire_name: 'User-Agent',
        value_source: 'userAgent',
        value_template: 'SID_${sessionId}#TID_${turnId}',
        value_definition: byteRecord(sourceLines[0]),
        emission: byteRecord(sourceLines[1]),
      },
      ...[
        ['x-session-id', 'sessionId', sourceLines[2]],
        ['x-turn-id', 'turnId', sourceLines[3]],
        ['x-request-id', 'requestId', sourceLines[4]],
        ['x-request-time', 'requestTime', sourceLines[5]],
      ].map(([name, valueSource, line]) => ({
        name,
        wire_name: name,
        value_source: valueSource,
        emission: byteRecord(line),
      })),
    ],
    integration_bindings: [
      { id: 'host_turn', path: 'electron/host.cjs', addition: byteRecord(hostAddition) },
      { id: 'engine_env', path: 'server/qbot-core/engine.mjs', addition: byteRecord(engineAddition) },
      { id: 'fallback_turn', path: 'server/qbot-core/engine.mjs', addition: byteRecord(fallbackTurnAddition) },
      { id: 'fallback_context', path: 'server/qbot-core/engine.mjs', addition: byteRecord(fallbackContextAddition) },
    ],
  };
  const contract = {
    ...definition,
    contract_sha256: sha256Text(stableJson(definition)),
  };
  return { changes, contract, source };
}

function exactAddedLinesContractFixture(baseContract) {
  const additionsByPath = new Map(baseContract.changed_paths.map((filePath) => [filePath, []]));
  const add = (filePath, line) => {
    const lines = additionsByPath.get(filePath) || [];
    if (line && !lines.includes(line)) lines.push(line);
    additionsByPath.set(filePath, lines);
  };
  for (const header of baseContract.header_emissions) {
    add(baseContract.source_file.path, header.value_definition?.source);
    add(baseContract.source_file.path, header.emission?.source);
  }
  for (const binding of baseContract.integration_bindings) {
    const lines = additionsByPath.get(binding.path) || [];
    const expectedCount = Number(binding.expected_addition_count ?? 1);
    for (let index = 0; index < expectedCount; index += 1) lines.push(binding.addition.source);
    additionsByPath.set(binding.path, lines);
  }
  while ((additionsByPath.get(baseContract.source_file.path) || []).length < baseContract.source_file.source_line_count) {
    add(baseContract.source_file.path, `const fixturePadding${additionsByPath.get(baseContract.source_file.path).length} = true;`);
  }
  for (const [filePath, lines] of additionsByPath) {
    if (!lines.length) lines.push(`const fixtureFor${sha256Text(filePath).slice(0, 8)} = true;`);
  }
  const changes = baseContract.changed_paths.map((filePath) => {
    const additions = additionsByPath.get(filePath);
    return {
      old_path: filePath,
      new_path: filePath,
      new_file: false,
      renamed_file: false,
      deleted_file: false,
      diff: `@@ -1,3 +1,${additions.length + 2} @@\n const before = true;\n-const stale = true;\n+${additions.join('\n+')}\n const after = true;\n`,
    };
  });
  const summary = summarizeGitLabChanges(changes);
  const sourceChange = normalizeGitLabChanges(changes)
    .find((change) => change.new_path === baseContract.source_file.path);
  const source = `${additionsByPath.get(baseContract.source_file.path).join('\n')}\n`;
  const definition = {
    ...structuredClone(baseContract),
    mr_diff: { bytes: summary.diff_bytes, sha256: summary.diff_sha256 },
    source_file: {
      ...structuredClone(baseContract.source_file),
      change_bytes: Buffer.byteLength(stableJson(sourceChange), 'utf8'),
      change_sha256: sha256Text(stableJson(sourceChange)),
      source_bytes: Buffer.byteLength(source, 'utf8'),
      source_sha256: sha256Text(source),
      source_line_count: additionsByPath.get(baseContract.source_file.path).length,
    },
  };
  delete definition.contract_sha256;
  return {
    changes,
    source,
    contract: {
      ...definition,
      contract_sha256: sha256Text(stableJson(definition)),
    },
  };
}

function exactNewFileContractFixture(baseContract) {
  const additionsByPath = new Map(baseContract.changed_paths.map((filePath) => [filePath, []]));
  const add = (filePath, line) => {
    const lines = additionsByPath.get(filePath) || [];
    if (line && !lines.includes(line)) lines.push(line);
    additionsByPath.set(filePath, lines);
  };
  for (const header of baseContract.header_emissions) {
    add(baseContract.source_file.path, header.value_definition?.source);
    add(baseContract.source_file.path, header.emission?.source);
  }
  for (const binding of baseContract.integration_bindings) {
    const lines = additionsByPath.get(binding.path) || [];
    const expectedCount = Number(binding.expected_addition_count ?? 1);
    for (let index = 0; index < expectedCount; index += 1) lines.push(binding.addition.source);
    additionsByPath.set(binding.path, lines);
  }
  while ((additionsByPath.get(baseContract.source_file.path) || []).length < baseContract.source_file.source_line_count) {
    add(baseContract.source_file.path, `const fixturePadding${additionsByPath.get(baseContract.source_file.path).length} = true;`);
  }
  for (const [filePath, lines] of additionsByPath) {
    if (!lines.length) lines.push(`const fixtureFor${sha256Text(filePath).slice(0, 8)} = true;`);
  }
  const changes = baseContract.changed_paths.map((filePath) => {
    const additions = additionsByPath.get(filePath);
    if (filePath === baseContract.source_file.path) {
      return {
        old_path: filePath,
        new_path: filePath,
        new_file: true,
        renamed_file: false,
        deleted_file: false,
        diff: `@@ -0,0 +1,${additions.length} @@\n${additions.map((line) => `+${line}`).join('\n')}\n`,
      };
    }
    return {
      old_path: filePath,
      new_path: filePath,
      new_file: false,
      renamed_file: false,
      deleted_file: false,
      diff: `@@ -1 +1,${additions.length + 1} @@\n const before = true;\n${additions.map((line) => `+${line}`).join('\n')}\n`,
    };
  });
  const summary = summarizeGitLabChanges(changes);
  const sourceChange = normalizeGitLabChanges(changes)
    .find((change) => change.new_path === baseContract.source_file.path);
  const source = `${additionsByPath.get(baseContract.source_file.path).join('\n')}\n`;
  const definition = {
    ...structuredClone(baseContract),
    mr_diff: { bytes: summary.diff_bytes, sha256: summary.diff_sha256 },
    source_file: {
      ...structuredClone(baseContract.source_file),
      change_bytes: Buffer.byteLength(stableJson(sourceChange), 'utf8'),
      change_sha256: sha256Text(stableJson(sourceChange)),
      source_bytes: Buffer.byteLength(source, 'utf8'),
      source_sha256: sha256Text(source),
      source_line_count: additionsByPath.get(baseContract.source_file.path).length,
    },
  };
  delete definition.contract_sha256;
  return {
    changes,
    source,
    contract: {
      ...definition,
      contract_sha256: sha256Text(stableJson(definition)),
    },
  };
}

function assertionRetirementContractFixture(baseContract) {
  const retiredPaths = new Set(baseContract.retired_files.map((file) => file.path));
  const changes = baseContract.changed_paths.map((filePath, index) => (
    retiredPaths.has(filePath)
      ? {
        old_path: filePath,
        new_path: filePath,
        new_file: false,
        renamed_file: false,
        deleted_file: true,
        diff: `@@ -1,1 +0,0 @@\n-obsolete assertion fixture ${index}\n`,
      }
      : {
        old_path: filePath,
        new_path: filePath,
        new_file: false,
        renamed_file: false,
        deleted_file: false,
        diff: `@@ -1,1 +1,1 @@\n-before fixture ${index}\n+after fixture ${index}\n`,
      }
  ));
  const summary = summarizeGitLabChanges(changes);
  const definition = {
    ...structuredClone(baseContract),
    mr_diff: { bytes: summary.diff_bytes, sha256: summary.diff_sha256 },
  };
  delete definition.contract_sha256;
  return {
    changes,
    contract: {
      ...definition,
      contract_sha256: sha256Text(stableJson(definition)),
    },
  };
}

function expectedRetirementOriginAttestation(contract) {
  const value = {
    schema_version: QWORK_RELEASE_SOURCE_CONTRACT_SCHEMA,
    claim_scope: contract.claim_scope,
    test_execution_attested: contract.test_execution_attested,
    contract_id: contract.contract_id,
    status: 'VERIFIED',
    verified: true,
    source: 'gitlab-api-changes',
    contract_sha256: contract.contract_sha256,
    mr: {
      iid: contract.mr_iid,
      state: contract.state,
      target_branch: contract.target_branch,
      merge_commit_sha: contract.merge_commit_sha,
      changes_count: contract.changes_count,
      changed_paths: [...contract.changed_paths],
      diff_bytes: contract.mr_diff.bytes,
      diff_sha256: contract.mr_diff.sha256,
    },
    source_file: null,
    retired_files: contract.retired_files.map((file) => ({
      ...file,
      change_count: 1,
      verified: true,
    })),
    headers: [],
    integration_bindings: [],
    forbidden_fragments: [],
    failures: [],
  };
  return { ...value, attestation_sha256: sha256Text(stableJson(value)) };
}

function mr1561OriginChanges() {
  return [
    {
      old_path: 'electron/host-core/agent/execution-worker-protocol.cjs',
      new_path: 'electron/host-core/agent/execution-worker-protocol.cjs',
      new_file: false,
      renamed_file: false,
      deleted_file: false,
      diff: `@@ -2,7 +2,7 @@ const { LATE_CONTEXT_USAGE_RETENTION_MS } = require('./execution-worker-context-
 const { validateContextUsagePayload } = require('./execution-worker-context-usage-protocol.cjs');
${' '}
 const PROTOCOL_VERSION = 1;
-const MAX_ENVELOPE_BYTES = 256 * 1024;
+const MAX_ENVELOPE_BYTES = 32 * 1024 * 1024;
 const MAX_EXECUTION_START_ENVELOPE_BYTES = 32 * 1024 * 1024;
 const EXPERT_DRAFT_AUTHORING_CAPABILITY_PURPOSE = 'expert-draft-authoring-v1';
 const MEMORY_AUGMENTATION_CAPABILITY_PURPOSE = 'memory-augmentation-v1';
`,
    },
    {
      old_path: 'test/unit/desktop/execution-worker-supervisor.test.mjs',
      new_path: 'test/unit/desktop/execution-worker-supervisor.test.mjs',
      new_file: false,
      renamed_file: false,
      deleted_file: false,
      diff: `@@ -501,13 +501,15 @@ test('protocol rejects unknown, expired, oversized and identity-free messages',
   });
 });
${' '}
-test('execution start accepts model context above the control-envelope limit', () => {
+test('execution messages share the 32 MiB envelope limit', () => {
   const identity = { ...authority, requestId: 'large-turn', ownershipGeneration: 'o1', sessionId: 's1', turnId: 't1' };
-  const payload = { input: { text: 'x'.repeat(MAX_ENVELOPE_BYTES + 1) } };
+  assert.equal(MAX_EXECUTION_START_ENVELOPE_BYTES, MAX_ENVELOPE_BYTES);
+  const payload = { input: { text: 'x'.repeat(MAX_ENVELOPE_BYTES - 1024) } };
   const message = createEnvelope('execution.start', identity, payload);
-  assert.equal(message.payload.input.text.length, MAX_ENVELOPE_BYTES + 1);
-  assert.ok(MAX_EXECUTION_START_ENVELOPE_BYTES > MAX_ENVELOPE_BYTES);
-  assert.throws(() => createEnvelope('interaction.resolve', identity, payload), {
+  assert.equal(message.payload.input.text.length, MAX_ENVELOPE_BYTES - 1024);
+  assert.throws(() => createEnvelope('interaction.resolve', identity, {
+    input: { text: 'x'.repeat(MAX_ENVELOPE_BYTES) },
+  }), {
     code: 'execution_worker_message_too_large',
   });
   assert.throws(() => createEnvelope('execution.start', identity, {
`,
    },
  ];
}

function mr1560OriginChanges() {
  return [
    {
      old_path: 'electron/host-core/agent/desktop-host-context.cjs',
      new_path: 'electron/host-core/agent/desktop-host-context.cjs',
      new_file: false,
      renamed_file: false,
      deleted_file: false,
      diff: `@@ -10097,7 +10097,7 @@ function registerDesktopAgentHost(ipcMain, {
         (SPAN_NAMES && SPAN_NAMES.SESSION_PREPARE) || 'qbot.session.prepare',
         { 'qbot.phase': 'turn_authority' },
         { parent: acceptSpan, errorClass: 'turn_authority' },
-        async () => currentTurnAuthorityForScope(turnScope, userId, {
+        async () => require('./turn-authority-readiness.cjs').readReadyTurnAuthority(() => currentTurnAuthorityForScope(turnScope, userId, {
           resolveCurrentTurnState: backgroundTurn
             ? () => desktopBackgroundAutomationTurnState(
                 userId,
@@ -10105,7 +10105,7 @@ function registerDesktopAgentHost(ipcMain, {
                 turnRequestId,
               )
             : () => desktopTurnState(userId),
-        }),
+        })),
       );
     } catch (error) {
       releaseRejectedPersistedDraftTurn();
`,
    },
    {
      old_path: 'electron/host-core/agent/turn-authority-readiness.cjs',
      new_path: 'electron/host-core/agent/turn-authority-readiness.cjs',
      new_file: true,
      renamed_file: false,
      deleted_file: false,
      diff: `@@ -0,0 +1,18 @@
+// Observe lifecycle-owned local projections; never initiate refresh or re-accept a turn.
+async function readReadyTurnAuthority(read, {
+  timeoutMs = 10_000,
+  intervalMs = 100,
+  now = Date.now,
+  wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
+} = {}) {
+  const deadline = now() + timeoutMs;
+  for (;;) {
+    const result = await read();
+    if (result?.ok || result?.code !== 'desktop_model_authority_not_ready') return result;
+    const remaining = deadline - now();
+    if (remaining <= 0) return result;
+    await wait(Math.min(intervalMs, remaining));
+  }
+}
+
+module.exports = { readReadyTurnAuthority };
`,
    },
    {
      old_path: 'scripts/ci/unit/node-unit-test-weights.json',
      new_path: 'scripts/ci/unit/node-unit-test-weights.json',
      new_file: false,
      renamed_file: false,
      deleted_file: false,
      diff: `@@ -4367,6 +4367,14 @@
       "setupWeightMs": 0,
       "durationMs": 6133
     },
+    {
+      "file": "test/unit/desktop/turn-authority-readiness.test.mjs",
+      "blobSha": "fa9aba734ba8dfb2b71d6fb050a29c2207f1cdab",
+      "sampleCount": 0,
+      "testWeightMs": 1493,
+      "setupWeightMs": 0,
+      "durationMs": 1493
+    },
     {
       "file": "test/unit/electron/desktop-network-diagnostics.test.mjs",
       "blobSha": "12966b1e8648174a63eeef68a44ab552eb78f8ce",
`,
    },
    {
      old_path: 'test/unit/desktop/turn-authority-readiness.test.mjs',
      new_path: 'test/unit/desktop/turn-authority-readiness.test.mjs',
      new_file: true,
      renamed_file: false,
      deleted_file: false,
      diff: `@@ -0,0 +1,45 @@
+import assert from 'node:assert/strict';
+import { createRequire } from 'node:module';
+import test from 'node:test';
+
+const { readReadyTurnAuthority } = createRequire(import.meta.url)('../../../electron/host-core/agent/turn-authority-readiness.cjs');
+const pending = { ok: false, code: 'desktop_model_authority_not_ready' };
+// 契约(desktop-host,#1634,2026-09-04): cache-first local authority wait stays within one accept.
+
+test('valid last-good authority is returned without waiting', async () => {
+  const ready = { ok: true, modelAuthority: {} };
+  assert.equal(await readReadyTurnAuthority(() => ready, {
+    wait: () => assert.fail('last-good must be immediate'),
+  }), ready);
+});
+
+test('cold model authority observes local refresh without re-accepting the turn', async () => {
+  let reads = 0, elapsed = 0;
+  const ready = { ok: true };
+  assert.equal(await readReadyTurnAuthority(() => ++reads === 3 ? ready : pending, {
+    now: () => elapsed,
+    wait: async (ms) => { elapsed += ms; },
+  }), ready);
+  assert.equal(reads, 3);
+  assert.equal(elapsed, 200);
+});
+
+test('missing model authority fails within a bounded preparation window', async () => {
+  let elapsed = 0;
+  assert.equal(await readReadyTurnAuthority(() => pending, {
+    timeoutMs: 250, now: () => elapsed,
+    wait: async (ms) => { elapsed += ms; },
+  }), pending);
+  assert.equal(elapsed, 250);
+});
+
+test('scope changes and permanent permission failures stop the wait', async () => {
+  for (const code of ['desktop_local_context_superseded', 'desktop_local_authority_not_ready']) {
+    let reads = 0;
+    const rejected = { ok: false, code };
+    assert.equal(await readReadyTurnAuthority(() => ++reads === 1 ? pending : rejected, {
+      wait: async () => {},
+    }), rejected);
+    assert.equal(reads, 2);
+  }
+});
`,
    },
  ];
}

function verifiedAttestation(contract) {
  const value = {
    schema_version: 'qbot-qwork-release-source-contract/v1',
    claim_scope: contract.claim_scope,
    test_execution_attested: contract.test_execution_attested,
    contract_id: contract.contract_id,
    status: 'VERIFIED',
    verified: true,
    source: 'gitlab-api-changes',
    contract_sha256: contract.contract_sha256,
    mr: {
      iid: contract.mr_iid,
      state: contract.state,
      target_branch: contract.target_branch,
      merge_commit_sha: contract.merge_commit_sha,
      changes_count: contract.changes_count,
      changed_paths: [...contract.changed_paths],
      diff_bytes: contract.mr_diff.bytes,
      diff_sha256: contract.mr_diff.sha256,
    },
    source_file: {
      ...contract.source_file,
      source_line_count_observed: contract.source_file.source_line_count,
    },
    headers: contract.header_emissions.map((header) => ({
      ...header,
      emission_count: 1,
      value_definition_count: header.value_definition ? 1 : 0,
      verified: true,
    })),
    integration_bindings: contract.integration_bindings.map((binding) => ({
      ...binding,
      addition_count: Number(binding.expected_addition_count ?? 1),
      verified: true,
    })),
    forbidden_fragments: (contract.forbidden_fragments || []).map((assertion) => ({
      ...assertion,
      observation_scope: 'added-lines',
      occurrence_count: 0,
      verified: true,
    })),
    failures: [],
  };
  return {
    ...value,
    attestation_sha256: sha256Text(stableJson(value)),
  };
}

function auditFixture(fixture, overrides = {}) {
  return auditReleaseSourceContract({
    iid: fixture.contract.mr_iid,
    state: fixture.contract.state,
    targetBranch: fixture.contract.target_branch,
    mergeCommitSha: fixture.contract.merge_commit_sha,
    changesCount: fixture.contract.changes_count,
    changes: fixture.changes,
    contract: fixture.contract,
    ...overrides,
  });
}

function mr1522Report() {
  const contract = QWORK_MR1522_CLAUDE_TURN_HEADERS_CONTRACT;
  return {
    merge_requests: [{
      iid: contract.mr_iid,
      commit: contract.merge_commit_sha,
      diff_sha256: contract.mr_diff.sha256,
      diff_bytes: contract.mr_diff.bytes,
      changed_paths: [...contract.changed_paths],
      source_contract_ids: [contract.contract_id],
    }],
    source_contracts: [verifiedAttestation(contract)],
    summary: {
      source_contract_count: 1,
      source_contract_verified_count: 1,
      source_contract_failure_count: 0,
    },
    unresolved: { source_contract_failures: [] },
  };
}

test('source contract reconstructs an exact new file and emits a complete verified attestation', () => {
  const fixture = sourceContractFixture();
  const sourceChange = fixture.changes.find((change) => change.new_file);
  assert.equal(reconstructGitLabNewFileSource(sourceChange), fixture.source);
  const attestation = auditFixture(fixture);
  assert.equal(attestation.status, 'VERIFIED');
  assert.equal(attestation.verified, true);
  assert.deepEqual(attestation.failures, []);
  assert.deepEqual(attestation.headers.map((header) => [header.wire_name, header.value_source, header.verified]), [
    ['User-Agent', 'userAgent', true],
    ['x-session-id', 'sessionId', true],
    ['x-turn-id', 'turnId', true],
    ['x-request-id', 'requestId', true],
    ['x-request-time', 'requestTime', true],
  ]);
  assert.equal(attestation.integration_bindings.every((binding) => binding.verified), true);
  assert.match(attestation.attestation_sha256, /^[a-f0-9]{64}$/u);
});

test('exact-added-lines reconstructs ordered additions across context and deletions', () => {
  const fixture = exactAddedLinesContractFixture(QWORK_MR1544_CLAUDE_TURN_HEADER_BRANDING_CONTRACT);
  const sourceChange = fixture.changes.find((change) => change.new_path === fixture.contract.source_file.path);
  assert.equal(reconstructGitLabAddedLinesSource(sourceChange), fixture.source);
  const attestation = auditFixture(fixture);
  assert.equal(attestation.status, 'VERIFIED');
  assert.deepEqual(attestation.failures, []);
  assert.equal(attestation.headers.every((header) => header.verified), true);
  assert.equal(attestation.integration_bindings.every((binding) => binding.verified), true);
  assert.equal(attestation.forbidden_fragments.every((assertion) => assertion.verified), true);
});

for (const scenario of [
  {
    name: 'reordered additions',
    mutate(change, source) {
      const [first, second] = source.replace(/\n$/u, '').split('\n');
      change.diff = change.diff.replace(`+${first}\n+${second}\n`, `+${second}\n+${first}\n`);
    },
  },
  {
    name: 'duplicate additions',
    mutate(change, source) {
      const [first, second] = source.replace(/\n$/u, '').split('\n');
      change.diff = change.diff.replace(`+${second}\n`, `+${first}\n`);
    },
  },
  {
    name: 'deleted addition',
    mutate(change, source) {
      const last = source.replace(/\n$/u, '').split('\n').at(-1);
      change.diff = change.diff.replace(`+${last}\n`, '');
      change.diff = change.diff.replace(/(\+1,)(\d+)( @@)/u, (_, prefix, count, suffix) => (
        `${prefix}${Number(count) - 1}${suffix}`
      ));
    },
  },
]) {
  test(`exact-added-lines blocks ${scenario.name}`, () => {
    const fixture = exactAddedLinesContractFixture(QWORK_MR1544_CLAUDE_TURN_HEADER_BRANDING_CONTRACT);
    const changes = structuredClone(fixture.changes);
    const sourceChange = changes.find((change) => change.new_path === fixture.contract.source_file.path);
    scenario.mutate(sourceChange, fixture.source);
    const attestation = auditFixture(fixture, { changes });
    assert.equal(attestation.verified, false);
    assert.equal(attestation.failures.includes('source_source_sha256_mismatch'), true);
  });
}

test('exact-added-lines rejects malformed hunks and forbidden source regressions', () => {
  const malformedFixture = exactAddedLinesContractFixture(QWORK_MR1548_CALL_TOOL_BUDGET_CONTRACT);
  const malformedChanges = structuredClone(malformedFixture.changes);
  const malformedSource = malformedChanges.find((change) => change.new_path === malformedFixture.contract.source_file.path);
  malformedSource.diff = malformedSource.diff.replace(/(\+1,)(\d+)( @@)/u, (_, prefix, count, suffix) => (
    `${prefix}${Number(count) + 1}${suffix}`
  ));
  assert.throws(() => reconstructGitLabAddedLinesSource(malformedSource), /source_diff_line_count_mismatch/u);
  const malformedAttestation = auditFixture(malformedFixture, { changes: malformedChanges });
  assert.equal(malformedAttestation.verified, false);
  assert.equal(malformedAttestation.failures.some((failure) => failure.includes('source_diff_line_count_mismatch')), true);

  const forbiddenFixture = exactAddedLinesContractFixture(QWORK_MR1548_CALL_TOOL_BUDGET_CONTRACT);
  const forbiddenChanges = structuredClone(forbiddenFixture.changes);
  const forbiddenSource = forbiddenChanges.find((change) => change.new_path === forbiddenFixture.contract.source_file.path);
  forbiddenSource.diff = forbiddenSource.diff.replace(/\+const fixturePadding\d+ = true;/u, '+const retryAfterMs = 1000;');
  const forbiddenAttestation = auditFixture(forbiddenFixture, { changes: forbiddenChanges });
  assert.equal(forbiddenAttestation.verified, false);
  assert.equal(forbiddenAttestation.failures.includes('forbidden_fragment:retry_after_ms_absent_from_call_tool'), true);
});

test('MR !1544 and !1548 built-in contracts freeze exact source and behavioral assertions', () => {
  const header = QWORK_MR1544_CLAUDE_TURN_HEADER_BRANDING_CONTRACT;
  assert.equal(header.merge_commit_sha, '16004bd34157448100945a8d50fa2d81c3e40153');
  assert.deepEqual(header.mr_diff, {
    bytes: 9047,
    sha256: 'b218b2fa93cb59bbef998547b1d3c991f5419a4b2642de1649f5765bb34e6be1',
  });
  assert.equal(header.source_file.proof_mode, 'exact-added-lines');
  assert.equal(header.source_file.source_bytes, 1062);
  assert.equal(header.source_file.source_line_count, 16);
  assert.equal(header.source_file.source_sha256, '39b518052df74d24b52b627a67f99fcedfb5aaccf68e6b32cdb5687c202d9e9b');
  assert.deepEqual(header.header_emissions.map((item) => item.wire_name), [
    'x-qwork-session',
    'x-qwork-session-id',
    'x-qwork-turn-id',
    'x-qwork-request-id',
    'x-qwork-request-time',
  ]);
  assert.match(header.header_emissions[0].value_template, /^qwork-SID_/u);
  assert.deepEqual(header.supersedes, [{
    contract_id: QWORK_MR1522_CLAUDE_TURN_HEADERS_CONTRACT.contract_id,
    current_assertions: ['header_emissions'],
  }]);

  const budget = QWORK_MR1548_CALL_TOOL_BUDGET_CONTRACT;
  assert.equal(budget.merge_commit_sha, '0cd593b1fa29ff03a73d42ad845d2be31d9a6e26');
  assert.deepEqual(budget.mr_diff, {
    bytes: 3570,
    sha256: 'b08be0acf8c734c1f329ddc5e9c05931edee9336f62853a96217a52c2a4e98de',
  });
  assert.equal(budget.source_file.source_bytes, 329);
  assert.equal(budget.source_file.source_line_count, 4);
  assert.equal(budget.source_file.source_sha256, '7bc30e7a4541fcfaacafb39d52101320c8d0304f31c2ef2d7a04cfe781e83b24');
  const additions = budget.integration_bindings.map((item) => item.addition.source).join('\n');
  assert.match(additions, /maxCalls = Math\.max\(1, Math\.min\(1000,/u);
  assert.match(additions, /RATE_LIMITED.*retryable: false/u);
  assert.match(additions, /length: 128/u);
  assert.match(additions, /calls, 128/u);
  assert.match(additions, /isError !== true/u);
  assert.equal(budget.forbidden_fragments[0].value.source, 'retryAfterMs');

  for (const contract of [header, budget]) {
    const fixture = exactAddedLinesContractFixture(contract);
    const attestation = auditFixture(fixture);
    assert.equal(attestation.verified, true);
    assert.deepEqual(attestation.failures, []);
  }
});

test('MR !1540, !1546 and !1550 source contracts freeze exact GitLab bytes and required behavior', () => {
  const memory = QWORK_MR1540_MEMORY_FEATURE_PROFILE_CONTRACT;
  assert.equal(memory.merge_commit_sha, 'be6a1d5d9b804d143597aa6f2554491a801115d7');
  assert.equal(memory.contract_sha256, '7ea042e9d6f46b1bde6ce0bab42dcc739775776ce54b3ebb640427566057b388');
  assert.deepEqual(memory.mr_diff, {
    bytes: 71833,
    sha256: '25a43ebdd09ace45958b9607644e9f1692784faaa589b4c4f109607f34038778',
  });
  assert.deepEqual(
    [memory.source_file.change_bytes, memory.source_file.change_sha256],
    [2048, '1efc26eb90909ef8a26b6c62128bef5fe05c1eb9034f33ee25b6690d18cb4c98'],
  );
  assert.deepEqual(
    [memory.source_file.source_bytes, memory.source_file.source_line_count, memory.source_file.source_sha256],
    [788, 21, '4991180f94dcc144f768e495086638f85bf53e43e01901c75ec3762aa52da745'],
  );
  const memoryAdditions = memory.integration_bindings.map((item) => item.addition.source).join('\n');
  assert.match(memoryAdditions, /'GET'[\s\S]*qwork-memory\/feature/u);
  assert.match(memoryAdditions, /options\.body, undefined/u);
  assert.match(memoryAdditions, /'POST'.*qwork-memory\/profile/u);
  assert.match(memoryAdditions, /body: \{ tm_user_profile: tmUserProfile \}/u);
  assert.match(memoryAdditions, /organizationFlight[\s\S]*reportQworkMemoryProfile/u);
  assert.match(memoryAdditions, /\.catch\(\(\) => \{\}\)/u);
  const memoryScopes = memory.integration_bindings
    .filter((binding) => binding.current_release_scope)
    .map((binding) => ({ id: binding.id, scope: binding.current_release_scope }));
  assert.deepEqual(memoryScopes.map((item) => item.id), [
    'feature_check_body_absent_test',
    'test_profile_report_exact_body',
  ]);
  assert.equal(memoryScopes.every((item) => (
    item.scope.schema_version === QWORK_RELEASE_SOURCE_OWNER_SCOPE_SCHEMA
    && item.scope.boundary === 'next-top-level-test-or-eof'
    && item.scope.owner_start.source.startsWith("test('")
    && item.scope.required_fragments.length === 3
    && item.scope.required_fragments.every((fragment) => fragment.match === 'line')
  )), true);
  assert.deepEqual(memoryScopes.map((item) => (
    item.scope.required_fragments.map((fragment) => fragment.id)
  )), [
    ['target_url', 'request_method', 'request_body'],
    ['target_url', 'request_method', 'request_body'],
  ]);
  const missingOwnerScope = structuredClone(memory);
  delete missingOwnerScope.integration_bindings.find((binding) => (
    binding.id === 'feature_check_body_absent_test'
  )).current_release_scope;
  delete missingOwnerScope.contract_sha256;
  missingOwnerScope.contract_sha256 = sha256Text(stableJson(missingOwnerScope));
  assert.throws(
    () => resolveReleaseSourceContracts([missingOwnerScope]),
    /source_contract_current_release_scope_set_invalid/u,
  );
  const broadenedOwnerScope = structuredClone(memory);
  broadenedOwnerScope.integration_bindings.find((binding) => (
    binding.id === 'test_feature_check_maps_gate'
  )).current_release_scope = structuredClone(memoryScopes[0].scope);
  delete broadenedOwnerScope.contract_sha256;
  broadenedOwnerScope.contract_sha256 = sha256Text(stableJson(broadenedOwnerScope));
  assert.throws(
    () => resolveReleaseSourceContracts([broadenedOwnerScope]),
    /source_contract_current_release_scope_set_invalid/u,
  );
  assert.deepEqual(memory.forbidden_fragments.map((item) => item.value.source), [
    "bootstrapQworkMemory({ tmUserProfile: '' })",
    'bootstrapOrganizationMemory',
  ]);

  const regenerate = QWORK_MR1546_REJECTED_REGENERATE_CONTRACT;
  assert.equal(regenerate.merge_commit_sha, 'fa351a4cbc3205222a75da6f0030bd8687c35587');
  assert.deepEqual(regenerate.mr_diff, {
    bytes: 46188,
    sha256: '6262007ecc64655d9221e3370db62c2565115848b97a2694484c3b8e6f646e61',
  });
  assert.deepEqual(
    [regenerate.source_file.change_bytes, regenerate.source_file.change_sha256],
    [1822, '0aa820d303fa33cd19042f3a77cf8b14dc609818a1495030808a186b94de37ed'],
  );
  assert.deepEqual(
    [regenerate.source_file.source_bytes, regenerate.source_file.source_line_count, regenerate.source_file.source_sha256],
    [1561, 42, '3b514bd9875829779afd490c018ca9d4ded03246e80fbd4a8e53ee41ad9b788c'],
  );
  const regenerateAdditions = regenerate.integration_bindings.map((item) => item.addition.source).join('\n');
  for (const expected of [
    'cloneValue(messages.at(-1))',
    'agentSessionId: null',
    'onPrepare();',
    'onReload();',
    'resolveRegenerateSourceTurn',
    'applyRegenerateFailure',
    'running: false',
    "errorMessage || 'Regeneration failed'",
  ]) assert.equal(regenerateAdditions.includes(expected), true, expected);
  assert.deepEqual(regenerate.forbidden_fragments.map((item) => item.value.source), [
    '  const sourceAssistantMessage = cloneValue(messages[sourceIndex + 1]);',
    '<ActionBarPrimitive.Reload asChild>',
    '        onClick={onPrepare}',
    '      // sendMessage restores the authoritative persisted branch on failure.',
    'regenerate_first_turn_candidate_invalid',
  ]);

  const routing = QWORK_MR1550_CLAUDE_SKILL_DESCRIPTION_ROUTING_CONTRACT;
  assert.equal(routing.merge_commit_sha, '1fc032633b5f70db34c17e1a9014efd981920cdb');
  assert.deepEqual(routing.mr_diff, {
    bytes: 33381,
    sha256: '7fd92710dfe49dc6e185a04b58cc4f590ff8e9f559ee3a7c47c857bb4a98372e',
  });
  assert.deepEqual(
    [routing.source_file.change_bytes, routing.source_file.change_sha256],
    [1842, 'e9d41e72c3a37eb0806500f91b473d253693264b5384bdbf66829a4ea61ecf1c'],
  );
  assert.deepEqual(
    [routing.source_file.source_bytes, routing.source_file.source_line_count, routing.source_file.source_sha256],
    [1553, 32, '1fb1f65c3677c6ce646d9dd6bd422e4e0b826e546b0518121a6f6aaa8d290067'],
  );
  const routingAdditions = routing.integration_bindings.map((item) => item.addition.source).join('\n');
  for (const expected of [
    'session?.llmSelection',
    'selection.modelId || selection.model',
    "modelId === 'claude-code'",
    "? '' : undefined",
    'claudeRuntimeSkillInvocationNoteOverride(s)',
    'mergeAutomaticSkillIndexInstallRows(rawSelection.allowedRows, s.skillInstalls)',
    '必须先调用 Skill 工具',
  ]) assert.equal(routingAdditions.includes(expected), true, expected);
  assert.equal(
    routing.forbidden_fragments[0].value.source,
    "    skillInvocationNote: runtimeFamily === RUNTIME_FAMILY_CLAUDE ? '' : undefined,",
  );

  for (const contract of [memory, regenerate, routing]) {
    assert.equal(contract.claim_scope, QWORK_RELEASE_SOURCE_CLAIM_SCOPE);
    assert.equal(contract.test_execution_attested, false);
    assert.equal(
      contract.integration_bindings.some((binding) => binding.path.startsWith('test/')),
      true,
      `${contract.contract_id} must attest at least one exact test declaration`,
    );
  }
});

test('MR !1557 source contract preserves !1546 origin while transferring three current bindings', () => {
  const origin = QWORK_MR1546_REJECTED_REGENERATE_CONTRACT;
  const successor = QWORK_MR1557_IMMEDIATE_REGENERATE_PROJECTION_CONTRACT;
  assert.equal(successor.merge_commit_sha, 'f0cc2a164b6c5279fe12290c207e29cf9ef1b261');
  assert.equal(successor.changes_count, 11);
  assert.deepEqual(successor.mr_diff, {
    bytes: 38739,
    sha256: '43e9e0b1ca93fb9f214a3d0c7bb72bdc902ef90437bed96248c34667e88ff790',
  });
  assert.deepEqual(
    [successor.source_file.change_bytes, successor.source_file.change_sha256],
    [3083, '8bda7ef9aaa971c2bfb14d0ec731cd7197c439fe027e485d1410a5214b47c97a'],
  );
  assert.deepEqual(
    [successor.source_file.source_bytes, successor.source_file.source_line_count, successor.source_file.source_sha256],
    [2180, 45, '69cfde5f693406f75ef71f65d49b62411e9365252deddeb883970e50c412f5cc'],
  );
  assert.equal(successor.test_execution_attested, false);
  assert.deepEqual(successor.supersedes, [{
    contract_id: origin.contract_id,
    current_assertions: [
      'integration_binding:latest_assistant_snapshot',
      'integration_binding:rejected_regenerate_projects_failure',
      'integration_binding:test_rejected_regenerate_projects_failure',
    ],
  }]);
  assert.equal(auditFixture(exactAddedLinesContractFixture(successor)).verified, true);

  const head = successor.merge_commit_sha;
  const contracts = [origin, successor];
  const ancestryByContractId = new Map(contracts.map((contract) => [contract.contract_id, {
    verified: true,
    first_parent_complete: true,
  }]));
  const resolution = resolveCurrentReleaseHeaderContract(origin, { contracts, ancestryByContractId });
  assert.equal(resolution.owner.contract_id, successor.contract_id);
  assert.deepEqual(resolution.lineage, [origin.contract_id, successor.contract_id]);
  const fixtureMap = currentReleaseFileFixtures(contracts, head);
  const files = [...fixtureMap].map(([filePath, payload]) => ({ path: filePath, requested_ref: head, payload }));
  const originMr = {
    iid: origin.mr_iid,
    commit: origin.merge_commit_sha,
    changed_paths: [...origin.changed_paths],
  };
  const audit = (auditFiles = files, lineage = resolution.lineage) => auditCurrentReleaseSourceContract({
    releaseHead: head,
    targetBranch: origin.target_branch,
    originAncestry: {
      source: 'gitlab-api-compare-first-parent',
      compare_from: origin.merge_commit_sha,
      compare_to: head,
      compare_commit_count: 1,
      first_parent_complete: true,
      verified: true,
      reason: '',
    },
    files: auditFiles,
    mergeRequests: [originMr],
    originAttestation: verifiedAttestation(origin),
    contract: origin,
    currentHeaderContract: successor,
    currentHeaderLineage: lineage,
  });
  const verified = audit();
  assert.equal(verified.verified, true);
  assert.equal(verified.origin_change_attestation.contract_id, origin.contract_id);
  assert.equal(verified.origin_change_attestation.verified, true);
  assert.equal(verified.test_execution_attested, false);
  for (const id of [
    'latest_assistant_snapshot',
    'rejected_regenerate_projects_failure',
    'test_rejected_regenerate_projects_failure',
  ]) {
    const owner = verified.current_assertion_owners.integration_bindings.find((item) => item.id === id);
    assert.equal(owner.contract_id, successor.contract_id, id);
    assert.deepEqual(owner.lineage, [origin.contract_id, successor.contract_id], id);
    const observed = verified.integration_bindings.find((item) => item.id === id);
    assert.deepEqual(observed.addition, successor.integration_bindings.find((item) => item.id === id).addition, id);

    const missing = structuredClone(files);
    const target = missing.find((item) => item.path === observed.path);
    const source = Buffer.from(target.payload.content, 'base64').toString('utf8');
    const rewritten = source.replace(`${observed.addition.source}\n`, `// removed ${id}\n`);
    target.payload.content = Buffer.from(rewritten, 'utf8').toString('base64');
    target.payload.size = Buffer.byteLength(rewritten, 'utf8');
    target.payload.blob_id = gitBlobSha1(rewritten);
    assert.equal(audit(missing).failures.includes(`current_integration_binding_mismatch:${id}`), true, id);
  }

  const restoredOldBehavior = structuredClone(files);
  const oldSnapshot = successor.forbidden_fragments.find((item) => item.id === 'unconditional_latest_assistant_snapshot');
  const oldSnapshotFile = restoredOldBehavior.find((item) => item.path === oldSnapshot.path);
  const oldSnapshotSource = Buffer.from(oldSnapshotFile.payload.content, 'base64').toString('utf8');
  const withOldSnapshot = `${oldSnapshotSource}${oldSnapshot.value.source}\n`;
  oldSnapshotFile.payload.content = Buffer.from(withOldSnapshot, 'utf8').toString('base64');
  oldSnapshotFile.payload.size = Buffer.byteLength(withOldSnapshot, 'utf8');
  oldSnapshotFile.payload.blob_id = gitBlobSha1(withOldSnapshot);
  assert.equal(
    audit(restoredOldBehavior).failures.includes('current_forbidden_fragment:unconditional_latest_assistant_snapshot'),
    true,
  );
  assert.equal(audit(files, [origin.contract_id]).failures.includes('current_header_lineage_invalid'), true);

  const unproven = resolveCurrentReleaseHeaderContract(origin, {
    contracts,
    ancestryByContractId: new Map([[successor.contract_id, { verified: false, first_parent_complete: false }]]),
  });
  assert.equal(unproven.owner.contract_id, origin.contract_id);
  assert.deepEqual(unproven.lineage, [origin.contract_id]);
  const originPaths = new Set(releaseSourceContractProtectedPaths(origin));
  const unprovenAudit = auditCurrentReleaseSourceContract({
    releaseHead: head,
    targetBranch: origin.target_branch,
    originAncestry: {
      source: 'gitlab-api-compare-first-parent',
      compare_from: origin.merge_commit_sha,
      compare_to: head,
      compare_commit_count: 1,
      first_parent_complete: true,
      verified: true,
      reason: '',
    },
    files: files.filter((item) => originPaths.has(item.path)),
    contract: origin,
    currentHeaderContract: unproven.owner,
    currentHeaderLineage: unproven.lineage,
  });
  assert.equal(unprovenAudit.verified, false);
  assert.equal(
    unprovenAudit.failures.includes('current_integration_binding_mismatch:latest_assistant_snapshot'),
    true,
  );

  const forgedOwner = structuredClone(verified);
  forgedOwner.current_assertion_owners.integration_bindings
    .find((item) => item.id === 'latest_assistant_snapshot').contract_id = origin.contract_id;
  delete forgedOwner.attestation_sha256;
  forgedOwner.attestation_sha256 = sha256Text(stableJson(forgedOwner));
  const validation = validateCurrentReleaseSourceContractAttestation(forgedOwner, {
    report: {
      release: { head },
      merge_requests: [originMr],
      source_contracts: [
        forgedOwner,
        {
          contract_id: successor.contract_id,
          release: { ancestry: { verified: true, first_parent_complete: true } },
        },
      ],
    },
    contract: origin,
    contracts,
  });
  assert.equal(validation.ok, false);
  assert.equal(validation.failures.includes('attestation_current_assertion_owners_mismatch'), true);
});

test('MR !1558 source contract freezes settings model-name dedup declarations without attesting execution', () => {
  const contract = QWORK_MR1558_SETTINGS_MODEL_NAME_DEDUP_CONTRACT;
  assert.equal(contract.merge_commit_sha, '90063782129701951edd90a9df8cf6145f1de425');
  assert.equal(contract.contract_sha256, '77d0bc15b5050c3d2553d8be9b1bdb46c7d9a918bc1ac59fa05dfca4b17e953a');
  assert.equal(contract.changes_count, 3);
  assert.deepEqual(contract.changed_paths, [
    'src/AssistantConfig.tsx',
    'src/composer-model-display-groups.ts',
    'test/unit/config/settings-ui-surface-contract.test.mjs',
  ]);
  assert.deepEqual(contract.mr_diff, {
    bytes: 4152,
    sha256: '3adb4b2161ae946eb3e4d37b487e7deb7c359e1f52c777d9ce751d1e5c768ee9',
  });
  assert.deepEqual(
    [contract.source_file.change_bytes, contract.source_file.change_sha256],
    [973, '32967fa02c0e1eb69ca9b6101615a092c8153e4e73b1b23e682dbbe4846d7bdf'],
  );
  assert.deepEqual(
    [contract.source_file.source_bytes, contract.source_file.source_line_count, contract.source_file.source_sha256],
    [492, 13, '24046d6d5979d9d57c8174696fb044b3a89e752a1a884f3b1490bf4db9edb82d'],
  );
  assert.equal(contract.claim_scope, QWORK_RELEASE_SOURCE_CLAIM_SCOPE);
  assert.equal(contract.test_execution_attested, false);
  assert.equal(contract.integration_bindings.some((binding) => binding.id === 'dedupe_normalizes_display_name'), true);
  assert.equal(contract.integration_bindings.some((binding) => binding.id === 'dedupe_rejects_empty_or_seen_name'), true);
  assert.equal(contract.integration_bindings.some((binding) => binding.id === 'dedupe_preserves_input_order'), true);
  assert.equal(contract.integration_bindings.some((binding) => binding.id === 'dedupe_records_first_name'), true);
  assert.equal(contract.integration_bindings.some((binding) => binding.id === 'settings_dedupes_before_grouping'), true);
  assert.equal(contract.integration_bindings.some((binding) => binding.id === 'test_declares_settings_name_dedup_contract'), true);
  assert.equal(contract.integration_bindings.every((binding) => !binding.current_release_scope), true);
});

test('MR !1590, !1593, !1596, and !1597 source contracts freeze exact GitLab identities and source metrics', () => {
  const rows = [
    [QWORK_MR1590_QBOT_EXPERT_CLOUD_INSTALLATION_CONTRACT, '1590', 'a2870474ffda705c1535a22be76fcd70be62167c', 18, 70444, 'ba126a6dc8085a4ed41c05aebbf0852a16b33ca7b508aa37321dcc65d45c5ad5', 3078, '84804aa813a426d600ace52576fb3cc75a150ba43556de9b26734cad1af5b8d1', 2703, 'ac3e79d1414bd8a1f4c8615b5cbcf51cca47ff3f8db95c1b1b505bfe17dbdd73', 65],
    [QWORK_MR1593_QBOT_ADDITIVE_RESPONSE_COMPATIBILITY_CONTRACT, '1593', '44725752f4690cf56bb3747238335ba5878aaeb6', 3, 7918, 'fbff6a098426d5dbbc03f61c0752ee0d348a235e247c316996d229aa60bc7138', 4223, '6fb5fde3c40307fc0206b85bd598a5539a64d8673df65a27d03c4b039113926d', 112, '68bde4da96f116a9ebf82ce5340cf5cf3f89d529dd23e5ab5c722ab27e9333db', 4],
    [QWORK_MR1596_ANONYMOUS_STABLE_RUNTIME_DISCOVERY_CONTRACT, '1596', 'ee363f4bb0549a4b0f7ebd88f63036fa8b1068df', 11, 28960, 'c909e06fdbc651aa6672b08ecfdd32490f413cf25866c8333df5b12c87d6d4ec', 2542, '2ccee231814756476b37820f37b99a159c96a2b48b846889d4ae98c020ddbb59', 1422, 'bf5b4377e0e498008006f9ed9b2a95f5d674f5de1c0a015b91cbf8f9a14d3074', 25],
    [QWORK_MR1597_WORKER_IM_USER_IDENTITY_FORWARDING_CONTRACT, '1597', '8d5429066a4c374c23275f7d009a3c78060f4522', 4, 4970, '4a69a85325a545fcd5d9624399d2143c665f70f6af473c26a502f94558e5feaa', 1005, '51230640bfd6698e48108078687d5de1c2d9fc797a08dbe775fa5b94a1b60503', 354, '3f33ef3ecb37e4f4ac3732e28a8cdaadb351e1059f2d54473a270e1c6217549e', 1],
  ];
  for (const [contract, iid, merge, count, diffBytes, diffSha, changeBytes, changeSha, sourceBytes, sourceSha, lines] of rows) {
    assert.equal(contract.mr_iid, iid);
    assert.equal(contract.merge_commit_sha, merge);
    assert.equal(contract.changes_count, count);
    assert.equal(contract.changed_paths.length, count);
    assert.deepEqual(contract.mr_diff, { bytes: diffBytes, sha256: diffSha });
    assert.deepEqual(
      [contract.source_file.change_bytes, contract.source_file.change_sha256],
      [changeBytes, changeSha],
    );
    assert.deepEqual(
      [contract.source_file.source_bytes, contract.source_file.source_sha256, contract.source_file.source_line_count],
      [sourceBytes, sourceSha, lines],
    );
    assert.equal(contract.claim_scope, QWORK_RELEASE_SOURCE_CLAIM_SCOPE);
    assert.equal(contract.test_execution_attested, false);
  }
});

test('MR !1590, !1593, !1596, and !1597 current-release assertions fail closed on deletion, duplication, or forbidden restoration', () => {
  const contracts = [
    QWORK_MR1590_QBOT_EXPERT_CLOUD_INSTALLATION_CONTRACT,
    QWORK_MR1593_QBOT_ADDITIVE_RESPONSE_COMPATIBILITY_CONTRACT,
    QWORK_MR1596_ANONYMOUS_STABLE_RUNTIME_DISCOVERY_CONTRACT,
    QWORK_MR1597_WORKER_IM_USER_IDENTITY_FORWARDING_CONTRACT,
  ];
  const head = '9'.repeat(40);
  const rewrite = (files, filePath, transform) => {
    const copy = structuredClone(files);
    const file = copy.find((item) => item.path === filePath);
    assert.ok(file, filePath);
    const source = Buffer.from(file.payload.content, 'base64').toString('utf8');
    const updated = transform(source);
    file.payload.content = Buffer.from(updated, 'utf8').toString('base64');
    file.payload.size = Buffer.byteLength(updated, 'utf8');
    file.payload.blob_id = gitBlobSha1(updated);
    return copy;
  };
  for (const contract of contracts) {
    const fixtureMap = currentReleaseFileFixtures([contract], head);
    const baseFiles = [...fixtureMap].map(([filePath, payload]) => ({ path: filePath, requested_ref: head, payload }));
    const successorBinding = contract.integration_bindings.find((binding) => (
      binding?.current_release_match?.match === 'line-or-verified-successor-line'
    ));
    const successor = successorBinding?.current_release_match?.successor;
    const successorAncestries = successor ? [{
      binding_id: successorBinding.id,
      successor_mr_iid: successor.mr_iid,
      successor_merge_commit_sha: successor.merge_commit_sha,
      descendant_ancestry: ancestryWithRawCompare({
        source: 'gitlab-api-compare-first-parent', compare_from: successor.merge_commit_sha,
        compare_to: head, compare_commit_count: 0, first_parent_complete: false,
        query_completed: true, verified: false, reason: `first_parent_commit_missing:${head}`,
      }, { compare_timeout: false, commits: [] }),
      predecessor_ancestry: ancestryWithRawCompare({
        source: 'gitlab-api-compare-first-parent', compare_from: head,
        compare_to: successor.merge_commit_sha, compare_commit_count: 1, first_parent_complete: true,
        query_completed: true, verified: true, reason: '',
      }, {
        compare_timeout: false,
        commits: [{ id: successor.merge_commit_sha, parent_ids: [head] }],
      }),
    }] : [];
    const audit = (files) => auditCurrentReleaseSourceContract({
      releaseHead: head,
      targetBranch: contract.target_branch,
      originAncestry: {
        source: 'gitlab-api-compare-first-parent', compare_from: contract.merge_commit_sha,
        compare_to: head, compare_commit_count: 1, first_parent_complete: true, verified: true, reason: '',
      },
      files, mergeRequests: [], successorAncestries, originAttestation: null, contract,
    });
    const verified = audit(baseFiles);
    assert.equal(verified.verified, true, `${contract.contract_id}:${verified.failures.join(',')}`);
    assert.deepEqual(verified.failures, [], contract.contract_id);

    const binding = contract.integration_bindings[0];
    for (const mode of ['delete', 'duplicate']) {
      const drifted = rewrite(baseFiles, binding.path, (source) => mode === 'delete'
        ? source.replace(`${binding.addition.source}\n`, '')
        : `${source}${binding.addition.source}\n`);
      const result = audit(drifted);
      assert.equal(result.verified, false, `${contract.contract_id}:${mode}`);
      assert.equal(result.failures.includes(`current_integration_binding_mismatch:${binding.id}`), true);
    }
    const forbidden = contract.forbidden_fragments?.[0];
    if (forbidden) {
      const restored = rewrite(baseFiles, forbidden.path, (source) => `${source}${forbidden.value.source}\n`);
      const result = audit(restored);
      assert.equal(result.verified, false, contract.contract_id);
      assert.equal(result.failures.includes(`current_forbidden_fragment:${forbidden.id}`), true);
    }
  }
});

test('MR !1597 binds duplicated identity additions to exact input and expected regions without forwarding access tokens', () => {
  const contract = QWORK_MR1597_WORKER_IM_USER_IDENTITY_FORWARDING_CONTRACT;
  const identityBindings = contract.integration_bindings.filter((binding) => (
    binding.expected_addition_count === 2
  ));
  const tokenBinding = contract.integration_bindings.find((binding) => (
    binding.id === 'test_worker_access_token_input_only'
  ));
  const lifecycleAllowlistBinding = contract.integration_bindings.find((binding) => (
    binding.id === 'worker_allowlist_2'
  ));
  assert.equal(identityBindings.length, 4);
  assert.ok(tokenBinding);
  assert.ok(lifecycleAllowlistBinding);
  const identityBinding = identityBindings[0];
  const inputScope = tokenBinding.current_release_scope;
  const expectedScope = identityBinding.current_release_scope;
  assert.equal(identityBindings.every((binding) => (
    binding.expected_current_occurrence_count === 2
    && binding.current_release_scope.boundary === 'anchored-line-region-within-next-top-level-test'
    && binding.current_release_scope.forbidden_fragments.length === 1
  )), true);
  assert.deepEqual(
    [tokenBinding.expected_addition_count, tokenBinding.expected_current_occurrence_count],
    [1, 1],
  );
  assert.equal(tokenBinding.current_release_match.match, 'js-property-key');
  assert.equal(tokenBinding.current_release_match.value.source, 'IM_USER_ACCESS_TOKEN');
  assert.equal(
    lifecycleAllowlistBinding.current_release_match.match,
    'line-or-verified-successor-line',
  );
  assert.equal(lifecycleAllowlistBinding.current_release_match.value.source, lifecycleAllowlistBinding.addition.source);
  assert.deepEqual(
    {
      schema_version: lifecycleAllowlistBinding.current_release_match.successor.schema_version,
      mr_iid: lifecycleAllowlistBinding.current_release_match.successor.mr_iid,
      merge_commit_sha: lifecycleAllowlistBinding.current_release_match.successor.merge_commit_sha,
      first_parent_sha: lifecycleAllowlistBinding.current_release_match.successor.first_parent_sha,
      changed_path: lifecycleAllowlistBinding.current_release_match.successor.changed_path,
      metadata_source: lifecycleAllowlistBinding.current_release_match.successor.metadata_source,
    },
    {
      schema_version: 'qbot-qwork-source-binding-successor-line/v1',
      mr_iid: '1612',
      merge_commit_sha: '5b6cea43b26ec3cd2fa12b2c7a6df14341122680',
      first_parent_sha: '1a3cef149bec91184cf31abf5485dff2fdfca926',
      changed_path: 'electron/host-core/agent/execution-worker-process-lifecycle.cjs',
      metadata_source: 'gitlab-api-changes',
    },
  );
  assert.equal(identityBindings.every((binding) => (
    binding.current_release_scope.forbidden_fragments[0].match === 'js-property-key'
    && binding.current_release_scope.forbidden_fragments[0].value.source === 'IM_USER_ACCESS_TOKEN'
  )), true);
  assert.deepEqual(
    inputScope.required_fragments.map((fragment) => fragment.expected_line_index),
    [8, 9, 10, 11, 12],
  );
  assert.deepEqual(
    expectedScope.required_fragments.map((fragment) => fragment.expected_line_index),
    [9, 10, 11, 12],
  );
  assert.equal(inputScope.region_end_inclusive, true);
  assert.equal(expectedScope.region_end.source, '});');
  assert.equal(expectedScope.region_end_inclusive, false);
  const assertInvalidScopeDefinition = (label, mutate, expectedError) => {
    const invalid = structuredClone(contract);
    mutate(invalid.integration_bindings.find((binding) => binding.id === identityBinding.id).current_release_scope);
    delete invalid.contract_sha256;
    invalid.contract_sha256 = sha256Text(stableJson(invalid));
    assert.throws(() => resolveReleaseSourceContracts([invalid]), expectedError, label);
  };
  assertInvalidScopeDefinition('line indexes must remain strictly increasing', (scope) => {
    scope.required_fragments[1].expected_line_index = scope.required_fragments[0].expected_line_index;
  }, /source_contract_current_release_scope_fragment_positions_invalid/u);
  assertInvalidScopeDefinition('every fragment must retain an explicit line index', (scope) => {
    delete scope.required_fragments[0].expected_line_index;
  }, /source_contract_current_release_scope_fragments_invalid/u);
  assertInvalidScopeDefinition('region end policy must be boolean', (scope) => {
    scope.region_end_inclusive = 'false';
  }, /source_contract_current_release_scope_region_invalid/u);
  const assertInvalidLifecycleMatchDefinition = (label, mutate) => {
    const invalid = structuredClone(contract);
    const binding = invalid.integration_bindings.find((item) => item.id === lifecycleAllowlistBinding.id);
    mutate(binding.current_release_match);
    delete invalid.contract_sha256;
    invalid.contract_sha256 = sha256Text(stableJson(invalid));
    assert.throws(
      () => resolveReleaseSourceContracts([invalid]),
      /source_contract_current_release_match_invalid/u,
      label,
    );
  };
  assertInvalidLifecycleMatchDefinition('successor identity cannot drift', (match) => {
    match.successor.mr_iid = '1613';
  });
  assertInvalidLifecycleMatchDefinition('successor line cannot claim a third allowlist candidate', (match) => {
    match.successor.line.source = match.successor.line.source.replace(
      '|DEEPBANK_PROVIDER_FIRST_OUTPUT_TIMEOUT_MS|',
      '|DEEPBANK_PROVIDER_FIRST_OUTPUT_TIMEOUT_MS|DEEPBANK_UNOWNED_ENV|',
    );
    match.successor.line.bytes = Buffer.byteLength(match.successor.line.source, 'utf8');
    match.successor.line.sha256 = sha256Text(match.successor.line.source);
  });
  assertInvalidLifecycleMatchDefinition('successor diff bytes remain a native integer', (match) => {
    match.successor.diff_bytes = String(match.successor.diff_bytes);
  });

  const originFixture = exactAddedLinesContractFixture(contract);
  const originSource = reconstructGitLabAddedLinesSource(
    originFixture.changes.find((change) => change.new_path === tokenBinding.path),
  );
  const ownerLine = tokenBinding.current_release_scope.owner_start.source;
  assert.equal(originSource.split('\n').filter((line) => line === ownerLine).length, 0);
  const origin = auditFixture(originFixture);
  assert.equal(origin.verified, true, origin.failures.join(','));
  for (const binding of identityBindings) {
    assert.equal(origin.integration_bindings.find((item) => item.id === binding.id)?.addition_count, 2);
  }
  assert.equal(origin.integration_bindings.find((item) => item.id === tokenBinding.id)?.addition_count, 1);

  const removeOneOriginIdentity = structuredClone(originFixture);
  const originTestChange = removeOneOriginIdentity.changes.find((change) => change.new_path === tokenBinding.path);
  originTestChange.diff = originTestChange.diff.replace(`+${identityBindings[0].addition.source}\n`, '');
  const missingOriginIdentity = auditFixture(removeOneOriginIdentity);
  assert.equal(missingOriginIdentity.verified, false);
  assert.equal(
    missingOriginIdentity.failures.includes(`integration_binding_mismatch:${identityBindings[0].id}`),
    true,
  );
  const mutateOriginTestDiff = (transform) => {
    const copy = structuredClone(originFixture);
    const change = copy.changes.find((item) => item.new_path === tokenBinding.path);
    change.diff = transform(change.diff);
    return auditFixture(copy);
  };
  const extraOriginIdentity = mutateOriginTestDiff((diff) => diff.replace(
    `+${identityBindings[0].addition.source}\n`,
    `+${identityBindings[0].addition.source}\n+${identityBindings[0].addition.source}\n`,
  ));
  assert.equal(extraOriginIdentity.verified, false);
  assert.equal(extraOriginIdentity.failures.includes(
    `integration_binding_mismatch:${identityBindings[0].id}`,
  ), true);
  const missingOriginToken = mutateOriginTestDiff((diff) => diff.replace(`+${tokenBinding.addition.source}\n`, ''));
  assert.equal(missingOriginToken.verified, false);
  assert.equal(missingOriginToken.failures.includes(`integration_binding_mismatch:${tokenBinding.id}`), true);
  const repeatedOriginToken = mutateOriginTestDiff((diff) => diff.replace(
    `+${tokenBinding.addition.source}\n`,
    `+${tokenBinding.addition.source}\n+${tokenBinding.addition.source}\n`,
  ));
  assert.equal(repeatedOriginToken.verified, false);
  assert.equal(repeatedOriginToken.failures.includes(`integration_binding_mismatch:${tokenBinding.id}`), true);

  const head = '7'.repeat(40);
  const fixtureMap = currentReleaseFileFixtures([contract], head);
  let files = [...fixtureMap].map(([filePath, payload]) => ({ path: filePath, requested_ref: head, payload }));
  const fixtureSource = Buffer.from(
    files.find((item) => item.path === tokenBinding.path).payload.content,
    'base64',
  ).toString('utf8');
  assert.equal(fixtureSource.split('\n').filter((line) => line === '  });').length, 2);
  assert.equal(fixtureSource.split('\n').filter((line) => line === '});').length, 1);
  const rewritePath = (filePath, transform) => {
    const copy = structuredClone(files);
    const file = copy.find((item) => item.path === filePath);
    assert.ok(file, filePath);
    const source = Buffer.from(file.payload.content, 'base64').toString('utf8');
    const updated = transform(source);
    file.payload.content = Buffer.from(updated, 'utf8').toString('base64');
    file.payload.size = Buffer.byteLength(updated, 'utf8');
    file.payload.blob_id = gitBlobSha1(updated);
    return copy;
  };
  const rewrite = (transform) => rewritePath(tokenBinding.path, transform);
  const replaceFirstExactLine = (source, line, replacements) => {
    const lines = source.split('\n');
    const index = lines.indexOf(line);
    if (index >= 0) lines.splice(index, 1, ...replacements);
    return lines.join('\n');
  };
  const lifecycleSuccessor = lifecycleAllowlistBinding.current_release_match.successor;
  const verifiedLifecycleSuccessorMr = {
    iid: lifecycleSuccessor.mr_iid,
    commit: lifecycleSuccessor.merge_commit_sha,
    merge_commit_sha: lifecycleSuccessor.merge_commit_sha,
    parent: lifecycleSuccessor.first_parent_sha,
    parent_count: 2,
    metadata_verified: true,
    metadata_source: lifecycleSuccessor.metadata_source,
    state: 'merged',
    target_branch: lifecycleSuccessor.target_branch,
    attribution_kind: 'merge_mr',
    diff_bytes: lifecycleSuccessor.diff_bytes,
    diff_sha256: lifecycleSuccessor.diff_sha256,
    changed_paths: [...lifecycleSuccessor.changed_paths],
  };
  const verifiedSuccessorAncestries = [{
    binding_id: lifecycleAllowlistBinding.id,
    successor_mr_iid: lifecycleSuccessor.mr_iid,
    successor_merge_commit_sha: lifecycleSuccessor.merge_commit_sha,
    descendant_ancestry: ancestryWithRawCompare({
      source: 'gitlab-api-compare-first-parent',
      compare_from: lifecycleSuccessor.merge_commit_sha,
      compare_to: head,
      compare_commit_count: 1,
      first_parent_complete: true,
      query_completed: true,
      verified: true,
      reason: '',
    }, {
      compare_timeout: false,
      commits: [{ id: head, parent_ids: [lifecycleSuccessor.merge_commit_sha] }],
    }),
    predecessor_ancestry: ancestryWithRawCompare({
      source: 'gitlab-api-compare-first-parent',
      compare_from: head,
      compare_to: lifecycleSuccessor.merge_commit_sha,
      compare_commit_count: 0,
      first_parent_complete: false,
      query_completed: true,
      verified: false,
      reason: `first_parent_commit_missing:${lifecycleSuccessor.merge_commit_sha}`,
    }, { compare_timeout: false, commits: [] }),
  }];
  const verifiedPredecessorAncestries = [{
    binding_id: lifecycleAllowlistBinding.id,
    successor_mr_iid: lifecycleSuccessor.mr_iid,
    successor_merge_commit_sha: lifecycleSuccessor.merge_commit_sha,
    descendant_ancestry: ancestryWithRawCompare({
      source: 'gitlab-api-compare-first-parent',
      compare_from: lifecycleSuccessor.merge_commit_sha,
      compare_to: head,
      compare_commit_count: 0,
      first_parent_complete: false,
      query_completed: true,
      verified: false,
      reason: `first_parent_commit_missing:${head}`,
    }, { compare_timeout: false, commits: [] }),
    predecessor_ancestry: ancestryWithRawCompare({
      source: 'gitlab-api-compare-first-parent',
      compare_from: head,
      compare_to: lifecycleSuccessor.merge_commit_sha,
      compare_commit_count: 1,
      first_parent_complete: true,
      query_completed: true,
      verified: true,
      reason: '',
    }, {
      compare_timeout: false,
      commits: [{ id: lifecycleSuccessor.merge_commit_sha, parent_ids: [head] }],
    }),
  }];
  files = rewritePath(lifecycleAllowlistBinding.path, (source) => replaceRequired(
    source,
    lifecycleAllowlistBinding.addition.source,
    lifecycleSuccessor.line.source,
    'MR !1612 lifecycle allowlist successor fixture',
  ));
  const audit = (
    auditFiles,
    mergeRequests = [verifiedLifecycleSuccessorMr],
    successorAncestries = verifiedSuccessorAncestries,
  ) => auditCurrentReleaseSourceContract({
    releaseHead: head,
    targetBranch: contract.target_branch,
    originAncestry: {
      source: 'gitlab-api-compare-first-parent',
      compare_from: contract.merge_commit_sha,
      compare_to: head,
      compare_commit_count: 1,
      first_parent_complete: true,
      verified: true,
      reason: '',
    },
    files: auditFiles,
    mergeRequests,
    successorAncestries,
    originAttestation: null,
    contract,
  });
  const verified = audit(files);
  assert.equal(
    verified.verified,
    true,
    `${verified.failures.join(',')}:${JSON.stringify(verified.current_release_semantics?.worker_environment_export_chain)}`,
  );
  assert.equal(verified.current_release_semantics.javascript_parse_verified, true);
  assert.equal(
    verified.current_release_semantics.schema_version,
    'qbot-qwork-mr1597-worker-environment-test-semantics/v2',
  );
  assert.deepEqual(
    verified.current_release_semantics.top_level_bindings.map((binding) => (
      [binding.local, binding.source, binding.count, binding.verified]
    )),
    [
      ['assert', 'node:assert/strict', 1, true],
      ['createRequire', 'node:module', 1, true],
      ['test', 'node:test', 1, true],
      ['require', 'import.meta.url', 1, true],
      ['workerEnvironment', '../../../electron/desktop-agent-host.cjs', 1, true],
    ],
  );
  assert.equal(verified.current_release_semantics.protected_binding_violation_count, 0);
  assert.deepEqual(verified.current_release_semantics.protected_binding_violation_kinds, []);
  assert.deepEqual(
    verified.current_release_semantics.worker_environment_export_chain.steps.map((step) => (
      [step.role, step.count, step.verified]
    )),
    [
      ['facade-to-supervisor', 1, true],
      ['supervisor-to-lifecycle', 1, true],
      ['supervisor-export', 1, true],
      ['lifecycle-declaration', 1, true],
      ['lifecycle-export', 1, true],
    ],
  );
  assert.equal(verified.current_release_semantics.worker_environment_export_chain.verified, true);
  assert.equal(verified.current_release_semantics.dynamic_code_execution_count, 0);
  assert.deepEqual(verified.current_release_semantics.dynamic_code_execution_kinds, []);
  assert.equal(verified.current_release_semantics.owner_test_occurrence_count, 1);
  assert.equal(verified.current_release_semantics.env_declaration_occurrence_count, 1);
  assert.equal(verified.current_release_semantics.deep_equal_env_assertion_occurrence_count, 1);
  assert.equal(verified.current_release_semantics.declaration_precedes_assertion, true);
  assert.equal(verified.current_release_semantics.expected_object_shape.verified, true);
  assert.equal(verified.current_release_semantics.expected_access_token_occurrence_count, 0);
  assert.deepEqual(verified.current_release_semantics.env_aliases, ['env']);
  assert.equal(verified.current_release_semantics.env_mutation_count, 0);
  assert.equal(verified.current_release_semantics.env_escape_count, 0);
  assert.equal(verified.current_release_semantics.verified, true);
  const latestFacadeSource = Buffer.from(
    files.find((item) => item.path === 'electron/desktop-agent-host.cjs').payload.content,
    'base64',
  ).toString('utf8');
  assert.equal(
    latestFacadeSource.split('\n').filter((line) => /^exports\.unrelatedExport\d+ = /u.test(line)).length,
    122,
  );
  assert.equal(
    verified.current_release_semantics.worker_environment_export_chain.protected_binding_violation_count,
    0,
  );

  const assertLifecycleAllowlistRejected = (label, result) => {
    assert.equal(result.verified, false, label);
    assert.equal(result.failures.includes(
      `current_integration_binding_mismatch:${lifecycleAllowlistBinding.id}`,
    ), true, `${label}:${result.failures.join(',')}`);
  };
  const successorOutsideIncrement = audit(files, []);
  assert.equal(successorOutsideIncrement.verified, true, successorOutsideIncrement.failures.join(','));
  assert.equal(
    successorOutsideIncrement.integration_bindings.find(
      (binding) => binding.id === lifecycleAllowlistBinding.id,
    )?.successor_observation?.relationship,
    'VERIFIED_SUCCESSOR',
  );
  assertLifecycleAllowlistRejected(
    'the !1612 lifecycle line requires independent first-parent ancestry',
    audit(files, [], []),
  );
  for (const [label, field, value] of [
    ['metadata verification', 'metadata_verified', false],
    ['merge identity', 'merge_commit_sha', '6'.repeat(40)],
    ['first-parent identity', 'parent', '6'.repeat(40)],
    ['first-parent merge shape', 'parent_count', 1],
    ['GitLab changes source', 'metadata_source', 'local-git'],
    ['diff identity', 'diff_sha256', '6'.repeat(64)],
    ['native diff byte count', 'diff_bytes', String(lifecycleSuccessor.diff_bytes)],
    ['changed path ownership', 'changed_paths', ['electron/host-core/agent/unrelated.cjs']],
  ]) {
    assertLifecycleAllowlistRejected(
      `the !1612 lifecycle line rejects wrong ${label}`,
      audit(files, [{ ...verifiedLifecycleSuccessorMr, [field]: value }]),
    );
  }
  const originalLifecycleFiles = rewritePath(lifecycleAllowlistBinding.path, (source) => replaceRequired(
    source,
    lifecycleSuccessor.line.source,
    lifecycleAllowlistBinding.addition.source,
    'original MR !1597 lifecycle allowlist fixture',
  ));
  const originalLifecycle = audit(originalLifecycleFiles, [], verifiedPredecessorAncestries);
  assert.equal(originalLifecycle.verified, true, originalLifecycle.failures.join(','));
  assertLifecycleAllowlistRejected(
    'a predecessor release cannot claim the !1612 successor line',
    audit(files, [], verifiedPredecessorAncestries),
  );
  assertLifecycleAllowlistRejected(
    'a successor release cannot claim the original !1597 line',
    audit(originalLifecycleFiles, [], verifiedSuccessorAncestries),
  );
  const conflictingAncestries = structuredClone(verifiedSuccessorAncestries);
  conflictingAncestries[0].predecessor_ancestry = {
    ...verifiedPredecessorAncestries[0].predecessor_ancestry,
  };
  assertLifecycleAllowlistRejected(
    'conflicting bidirectional first-parent ancestry stays blocked',
    audit(files, [], conflictingAncestries),
  );
  const driftedSuccessorIdentity = structuredClone(verifiedSuccessorAncestries);
  driftedSuccessorIdentity[0].successor_mr_iid = '1613';
  assertLifecycleAllowlistRejected(
    'the independently observed successor identity cannot drift',
    audit(files, [], driftedSuccessorIdentity),
  );
  const incompleteReverseAncestry = structuredClone(verifiedSuccessorAncestries);
  incompleteReverseAncestry[0].predecessor_ancestry.query_completed = false;
  assertLifecycleAllowlistRejected(
    'an unreadable reverse ancestry query stays blocked',
    audit(files, [], incompleteReverseAncestry),
  );

  const unknownLifecycleAllowlist = audit(rewritePath(lifecycleAllowlistBinding.path, (source) => (
    replaceRequired(
      source,
      '|DEEPBANK_PROVIDER_FIRST_OUTPUT_TIMEOUT_MS|QBOT_(?:PYTHON|NODE)',
      '|DEEPBANK_PROVIDER_FIRST_OUTPUT_TIMEOUT_MS|DEEPBANK_UNOWNED_ENV|QBOT_(?:PYTHON|NODE)',
      'unknown lifecycle allowlist candidate',
    )
  )));
  assertLifecycleAllowlistRejected('a third lifecycle allowlist candidate is not owned by MR !1597', unknownLifecycleAllowlist);
  const supervisorAllowlistBinding = contract.integration_bindings.find((binding) => binding.id === 'worker_allowlist_3');
  const widenedSupervisorAllowlist = audit(rewritePath(supervisorAllowlistBinding.path, (source) => (
    replaceRequired(
      source,
      '|QBOT_RUNTIME_NODE_MODULES|QBOT_(?:PYTHON|NODE)',
      '|QBOT_RUNTIME_NODE_MODULES|DEEPBANK_PROVIDER_FIRST_OUTPUT_TIMEOUT_MS|QBOT_(?:PYTHON|NODE)',
      'supervisor allowlist must remain MR !1597 exact line',
    )
  )));
  assert.equal(widenedSupervisorAllowlist.verified, false);
  assert.equal(widenedSupervisorAllowlist.failures.includes(
    `current_integration_binding_mismatch:${supervisorAllowlistBinding.id}`,
  ), true);
  for (const [label, injectedSource] of [
    ['direct RegExp prototype test replacement', 'RegExp.prototype.test = () => true;'],
    [
      'aliased RegExp prototype test replacement',
      'const regexPrototypeAlias = RegExp.prototype; regexPrototypeAlias.test = () => true;',
    ],
    [
      'container-flowed RegExp prototype Reflect replacement',
      "const regexHolder = { prototype: RegExp.prototype }; const { prototype: flowedRegexPrototype } = regexHolder; Reflect.set(flowedRegexPrototype, 'test', () => true);",
    ],
    [
      'Object defineProperty RegExp prototype replacement',
      "Object.defineProperty(RegExp.prototype, 'test', { value: () => true });",
    ],
    [
      'aliased Reflect set through global RegExp replacement',
      "const replaceRegexMember = Reflect.set; replaceRegexMember(globalThis.RegExp.prototype, 'test', () => true);",
    ],
    [
      'global wrapper alias Object assign RegExp prototype replacement',
      'const lifecycleGlobal = globalThis; Object.assign(lifecycleGlobal.RegExp.prototype, { test: () => true });',
    ],
    [
      'global wrapper destructured RegExp alias replacement',
      'const { RegExp: R } = globalThis; R.prototype.test = () => true;',
    ],
    [
      'container-flowed global wrapper destructuring replacement',
      "const box = { g: globalThis }; const { g } = box; Object.defineProperty(g.RegExp.prototype, 'test', { value: () => true });",
    ],
    [
      'Reflect apply dispatches a RegExp prototype replacement',
      "Reflect.apply(Reflect.set, null, [RegExp.prototype, 'test', () => true]);",
    ],
    [
      'bound Object writer captures the RegExp prototype',
      "Object.defineProperty.bind(null, RegExp.prototype, 'test')({ value: () => true });",
    ],
  ]) {
    const mutated = audit(rewritePath(
      lifecycleAllowlistBinding.path,
      (source) => `${injectedSource}\n${source}`,
    ));
    assert.equal(mutated.verified, false, label);
    assert.equal(
      mutated.current_release_semantics.worker_environment_export_chain
        .protected_binding_violation_count > 0,
      true,
      label,
    );
    assert.equal(
      mutated.current_release_semantics.worker_environment_export_chain
        .protected_binding_violation_kinds.some((kind) => (
          kind.includes('lifecycle-builtin-binding:')
        )),
      true,
      label,
    );
  }
  for (const [label, injectedSource] of [
    [
      'read-only RegExp prototype inspection',
      "const nativeRegexTest = RegExp.prototype.test; nativeRegexTest.call(/safe/u, 'safe'); Object.getOwnPropertyDescriptor(RegExp.prototype, 'test');",
    ],
    [
      'unrelated receiver reflective writes',
      "const unrelatedRegexLike = {}; Object.defineProperty(unrelatedRegexLike, 'test', { value: () => true }); Reflect.set(unrelatedRegexLike, 'lastIndex', 0);",
    ],
    [
      'global wrapper container keeps unrelated receiver writes harmless',
      "const wrapperBox = { g: globalThis, receiver: {} }; const { receiver } = wrapperBox; Object.defineProperty(receiver, 'test', { value: () => true }); Reflect.set(receiver, 'lastIndex', 0);",
    ],
  ]) {
    const readOnly = audit(rewritePath(
      lifecycleAllowlistBinding.path,
      (source) => `${injectedSource}\n${source}`,
    ));
    assert.equal(readOnly.verified, true, `${label}:${readOnly.failures.join(',')}`);
    assert.equal(
      readOnly.current_release_semantics.worker_environment_export_chain
        .protected_binding_violation_count,
      0,
      label,
    );
  }
  for (const tokenName of ['IM_USER_ACCESS_TOKEN', 'IM_QWORK_ACCESS_TOKEN', 'QBOT_LINGXI_ACCESS_TOKEN']) {
    const leakedToken = audit(rewritePath(lifecycleAllowlistBinding.path, (source) => replaceRequired(
      source,
      '|DEEPBANK_PROVIDER_FIRST_OUTPUT_TIMEOUT_MS|QBOT_(?:PYTHON|NODE)',
      `|DEEPBANK_PROVIDER_FIRST_OUTPUT_TIMEOUT_MS|${tokenName}|QBOT_(?:PYTHON|NODE)`,
      `${tokenName} lifecycle allowlist leak`,
    )));
    assertLifecycleAllowlistRejected(`${tokenName} cannot enter the lifecycle allowlist`, leakedToken);
    assert.equal(leakedToken.failures.some((failure) => failure.startsWith('current_forbidden_fragment:')), true);
  }
  for (const binding of identityBindings) {
    const observation = verified.integration_bindings.find((item) => item.id === binding.id);
    assert.equal(observation.occurrence_count, 2, binding.id);
    assert.equal(observation.scope_observation.region_start_occurrence_count, 1, binding.id);
    assert.equal(observation.scope_observation.region_end_occurrence_count, 1, binding.id);
    assert.equal(observation.scope_observation.region_ordered, true, binding.id);
    assert.equal(observation.scope_observation.owner_region_ordered, true, binding.id);
    assert.equal(observation.scope_observation.occurrence_count, 1, binding.id);
    assert.equal(observation.scope_observation.required_fragments_ordered, true, binding.id);
    assert.deepEqual(
      observation.scope_observation.required_fragments.map((fragment) => fragment.line_index),
      [9, 10, 11, 12],
      binding.id,
    );
    assert.equal(observation.scope_observation.forbidden_fragments[0].occurrence_count, 0, binding.id);
  }
  const tokenObservation = verified.integration_bindings.find((item) => item.id === tokenBinding.id);
  assert.deepEqual(
    tokenObservation.scope_observation.required_fragments.map((fragment) => fragment.line_index),
    [8, 9, 10, 11, 12],
  );

  const identityLine = identityBinding.addition.source;
  const fixtureLines = fixtureSource.trimEnd().split('\n');
  const regionSource = (scope) => {
    const startIndex = fixtureLines.indexOf(scope.region_start.source);
    const endIndex = fixtureLines.indexOf(scope.region_end.source);
    const endExclusive = endIndex + (scope.region_end_inclusive === false ? 0 : 1);
    return `${fixtureLines.slice(startIndex, endExclusive).join('\n')}\n`;
  };
  const inputRegion = regionSource(inputScope);
  const expectedRegion = regionSource(expectedScope);
  const inputEndIndex = fixtureLines.indexOf(inputScope.region_end.source);
  const expectedStartIndex = fixtureLines.indexOf(expectedScope.region_start.source);
  const inputRegionCompletion = `${fixtureLines.slice(inputEndIndex + 1, expectedStartIndex).join('\n')}\n`;
  const expectedOwnerClose = `${expectedScope.region_end.source}\n`;

  const missingOwner = audit(rewrite((source) => source.replace(`${ownerLine}\n`, '')));
  assert.equal(missingOwner.verified, false);
  assert.equal(missingOwner.failures.includes(
    `current_integration_binding_scope_owner_mismatch:${identityBinding.id}`,
  ), true);

  for (const { label, binding, scope } of [
    { label: 'input', binding: tokenBinding, scope: inputScope },
    { label: 'expected', binding: identityBinding, scope: expectedScope },
  ]) {
    for (const [kind, field, failureSuffix] of [
      ['start', 'region_start', 'region_start_mismatch'],
      ['end', 'region_end', 'region_end_mismatch'],
    ]) {
      const anchor = scope[field].source;
      const missingAnchor = audit(rewrite((source) => replaceFirstExactLine(source, anchor, [])));
      assert.equal(missingAnchor.verified, false, `${label} ${kind} missing`);
      assert.equal(missingAnchor.failures.includes(
        `current_integration_binding_scope_${failureSuffix}:${binding.id}`,
      ), true, `${label} ${kind} missing`);
      const repeatedAnchor = audit(rewrite((source) => replaceFirstExactLine(source, anchor, [anchor, anchor])));
      assert.equal(repeatedAnchor.verified, false, `${label} ${kind} repeated`);
      assert.equal(repeatedAnchor.failures.includes(
        `current_integration_binding_scope_${failureSuffix}:${binding.id}`,
      ), true, `${label} ${kind} repeated`);
    }
  }

  const movedOutOfInput = audit(rewrite((source) => (
    `${source.replace(`${identityLine}\n`, '')}test('unrelated identity copy', () => {\n${identityLine}\n});\n`
  )));
  assert.equal(movedOutOfInput.verified, false);
  assert.equal(movedOutOfInput.failures.includes(
    `current_integration_binding_scope_required_fragment_mismatch:${tokenBinding.id}:${identityBinding.id}_input`,
  ), true);

  const expectedStart = identityBinding.current_release_scope.region_start.source;
  const movedOutOfExpected = audit(rewrite((source) => {
    const marker = `${expectedStart}\n`;
    const markerIndex = source.indexOf(marker);
    const prefix = source.slice(0, markerIndex + marker.length);
    const suffix = source.slice(markerIndex + marker.length).replace(`${identityLine}\n`, '');
    return `${prefix}${suffix}test('unrelated expected copy', () => {\n${identityLine}\n});\n`;
  }));
  assert.equal(movedOutOfExpected.verified, false);
  assert.equal(movedOutOfExpected.failures.includes(
    `current_integration_binding_scope_required_fragment_mismatch:${identityBinding.id}:${identityBinding.id}`,
  ), true);

  const duplicatedRequiredFragment = audit(rewrite((source) => source.replace(
    expectedRegion,
    expectedRegion.replace(`${identityLine}\n`, `${identityLine}\n${identityLine}\n`),
  )));
  assert.equal(duplicatedRequiredFragment.verified, false);
  assert.equal(duplicatedRequiredFragment.failures.includes(
    `current_integration_binding_scope_required_fragment_mismatch:${identityBinding.id}:${identityBinding.id}`,
  ), true);

  for (const [label, scope, region, binding] of [
    ['input', inputScope, inputRegion, tokenBinding],
    ['expected', expectedScope, expectedRegion, identityBinding],
  ]) {
    const shiftedFields = audit(rewrite((source) => source.replace(
      region,
      region.replace(`${scope.region_start.source}\n`, `${scope.region_start.source}\n    INSERTED_SHIFT: true,\n`),
    )));
    assert.equal(shiftedFields.verified, false, `${label} fields shifted`);
    assert.equal(shiftedFields.failures.some((failure) => failure.startsWith(
      `current_integration_binding_scope_required_fragment_mismatch:${binding.id}:`,
    )), true, `${label} fields shifted`);
  }

  const reversedRegion = audit(rewrite((source) => source.replace(`${expectedRegion}${expectedOwnerClose}`, (
    `${expectedOwnerClose}${expectedRegion}`
  ))));
  assert.equal(reversedRegion.verified, false);
  assert.equal(reversedRegion.failures.includes(
    `current_integration_binding_scope_region_order_mismatch:${identityBinding.id}`,
  ), true);

  const [firstExpectedFragment, secondExpectedFragment] = expectedScope.required_fragments;
  const reorderedRequiredFragments = audit(rewrite((source) => source.replace(
    expectedRegion,
    expectedRegion.replace(
      `${firstExpectedFragment.value.source}\n${secondExpectedFragment.value.source}\n`,
      `${secondExpectedFragment.value.source}\n${firstExpectedFragment.value.source}\n`,
    ),
  )));
  assert.equal(reorderedRequiredFragments.verified, false);
  assert.equal(reorderedRequiredFragments.failures.includes(
    `current_integration_binding_scope_required_fragment_order_mismatch:${identityBinding.id}`,
  ), true);

  const exchangedRegions = audit(rewrite((source) => source.replace(
    `${inputRegion}${inputRegionCompletion}${expectedRegion}`,
    `${expectedRegion}${inputRegion}${inputRegionCompletion}`,
  )));
  const exchangedObservation = exchangedRegions.integration_bindings.find((item) => item.id === identityBinding.id);
  assert.equal(exchangedRegions.verified, false);
  assert.equal(exchangedObservation.scope_observation.region_ordered, true);
  assert.equal(exchangedObservation.scope_observation.owner_region_ordered, false);
  assert.equal(exchangedRegions.failures.includes(
    `current_integration_binding_scope_region_sequence_mismatch:${identityBinding.id}`,
  ), true);

  const interleavedRegions = audit(rewrite((source) => source.replace(
    `${inputRegion}${inputRegionCompletion}${expectedRegion}${expectedOwnerClose}`,
    `${inputScope.region_start.source}\n${inputScope.required_fragments.map((fragment) => fragment.value.source).join('\n')}\n`
      + `${expectedScope.region_start.source}\n${expectedScope.required_fragments.map((fragment) => fragment.value.source).join('\n')}\n`
      + `${inputScope.region_end.source}\n${inputRegionCompletion}  });\n${expectedOwnerClose}`,
  )));
  assert.equal(interleavedRegions.verified, false);
  assert.equal(interleavedRegions.failures.includes(
    `current_integration_binding_scope_region_sequence_mismatch:${identityBinding.id}`,
  ), true);

  const duplicatedCompleteRegion = audit(rewrite((source) => source.replace(inputRegion, `${inputRegion}${inputRegion}`)));
  assert.equal(duplicatedCompleteRegion.verified, false);
  assert.equal(duplicatedCompleteRegion.failures.includes(
    `current_integration_binding_scope_region_sequence_mismatch:${tokenBinding.id}`,
  ), true);

  const tokenLine = tokenBinding.addition.source;
  const tokenMovedIntoExpected = audit(rewrite((source) => source
    .replace(`${tokenLine}\n`, '')
    .replace(`${expectedStart}\n`, `${expectedStart}\n${tokenLine}\n`)));
  assert.equal(tokenMovedIntoExpected.verified, false);
  assert.equal(tokenMovedIntoExpected.failures.includes(
    `current_integration_binding_scope_forbidden_fragment_mismatch:${identityBinding.id}:access_token_expected_forbidden`,
  ), true);

  const assertSemanticBypassRejected = (label, transform, expectedCounter) => {
    const result = audit(rewrite(transform));
    assert.equal(result.verified, false, label);
    assert.equal(result.current_release_semantics.verified, false, label);
    assert.equal(result.failures.includes(
      'current_release_semantics:mr1597:worker_environment_test_mismatch',
    ), true, `${label}: ${result.failures.join(',')}`);
    if (expectedCounter) {
      assert.equal(result.current_release_semantics[expectedCounter] > 0, true, label);
    }
    return result;
  };
  assertSemanticBypassRejected('expected spread cannot sanitize or repopulate env', (source) => source.replace(
    expectedRegion,
    expectedRegion.replace('  });\n', '    ...env,\n  });\n'),
  ), 'env_escape_count');
  for (const [label, propertySource] of [
    ['computed static key', "    ['QBOT_DYNAMIC_EXPECTED']: true,"],
    ['computed dynamic key', '    [dynamicExpectedKey]: true,'],
    ['getter', '    get QBOT_DYNAMIC_EXPECTED() { return true; },'],
    ['setter', '    set QBOT_DYNAMIC_EXPECTED(value) { void value; },'],
    ['method', '    QBOT_DYNAMIC_EXPECTED() { return true; },'],
    ['shorthand', '    dynamicExpectedValue,'],
    ['duplicate key', '    QBOT_DUPLICATE_EXPECTED: true,\n    QBOT_DUPLICATE_EXPECTED: false,'],
    ['nested dynamic key', '    QBOT_NESTED_EXPECTED: { [dynamicNestedKey]: true },'],
  ]) {
    assertSemanticBypassRejected(`expected object rejects ${label}`, (source) => source.replace(
      expectedRegion,
      expectedRegion.replace('  });\n', `${propertySource}\n  });\n`),
    ));
  }
  assertSemanticBypassRejected('delete before assertion cannot erase leaked token', (source) => source.replace(
    `${expectedStart}\n`,
    `  delete env.IM_USER_ACCESS_TOKEN;\n${expectedStart}\n`,
  ), 'env_mutation_count');
  assertSemanticBypassRejected('assignment before assertion cannot erase leaked token', (source) => source.replace(
    `${expectedStart}\n`,
    `  env.IM_USER_ACCESS_TOKEN = undefined;\n${expectedStart}\n`,
  ), 'env_mutation_count');
  assertSemanticBypassRejected('Object.assign cannot rewrite env before assertion', (source) => source.replace(
    `${expectedStart}\n`,
    `  Object.assign(env, { IM_USER_ACCESS_TOKEN: undefined });\n${expectedStart}\n`,
  ), 'env_mutation_count');
  assertSemanticBypassRejected('defineProperty cannot rewrite env after assertion', (source) => source.replace(
    `${expectedRegion}${expectedOwnerClose}`,
    `${expectedRegion}  Object.defineProperty(env, 'IM_USER_ACCESS_TOKEN', { value: undefined });\n${expectedOwnerClose}`,
  ), 'env_mutation_count');
  for (const [label, mutation] of [
    ['Object.defineProperties', "Object.defineProperties(env, { IM_USER_ACCESS_TOKEN: { value: undefined } });"],
    ['Reflect.set', "Reflect.set(env, 'IM_USER_ACCESS_TOKEN', undefined);"],
    ['sequence-expression member assignment', "(0, env).IM_USER_ACCESS_TOKEN = undefined;"],
  ]) {
    assertSemanticBypassRejected(`${label} cannot rewrite env`, (source) => source.replace(
      `${expectedStart}\n`,
      `  ${mutation}\n${expectedStart}\n`,
    ), 'env_mutation_count');
  }
  assertSemanticBypassRejected('writable alias cannot delete env fields', (source) => source.replace(
    `${expectedStart}\n`,
    `  const writableEnvAlias = env;\n  Reflect.deleteProperty(writableEnvAlias, 'IM_USER_ACCESS_TOKEN');\n${expectedStart}\n`,
  ), 'env_mutation_count');
  assertSemanticBypassRejected('assigned alias cannot update env fields', (source) => source.replace(
    `${expectedStart}\n`,
    `  let assignedEnvAlias;\n  assignedEnvAlias = env;\n  assignedEnvAlias.IM_USER_ACCESS_TOKEN++;\n${expectedStart}\n`,
  ), 'env_mutation_count');
  assertSemanticBypassRejected('destructured aliases cannot conceal env mutation', (source) => source.replace(
    `${expectedStart}\n`,
    `  const [destructuredEnvAlias] = [env];\n  delete destructuredEnvAlias.IM_USER_ACCESS_TOKEN;\n${expectedStart}\n`,
  ), 'env_escape_count');
  assertSemanticBypassRejected('nested identity lines cannot impersonate direct expected properties', (source) => (
    source
      .replace('    QBOT_SCOPE_FIXTURE_1_8: true,\n', '    nestedIdentity: {\n')
      .replace(
        `${expectedScope.required_fragments.at(-1).value.source}\n  });\n`,
        `${expectedScope.required_fragments.at(-1).value.source}\n    },\n  });\n`,
      )
  ));
  assertSemanticBypassRejected('a second deepEqual cannot impersonate the unique assertion', (source) => source.replace(
    `${expectedRegion}${expectedOwnerClose}`,
    `${expectedRegion}  assert.deepEqual(env, env);\n${expectedOwnerClose}`,
  ), 'env_escape_count');
  const readOnlyAlias = audit(rewrite((source) => source.replace(
    `${expectedStart}\n`,
    `  const observedEnvAlias = env;\n  void observedEnvAlias;\n${expectedStart}\n`,
  )));
  assert.equal(readOnlyAlias.verified, true, readOnlyAlias.failures.join(','));
  assert.deepEqual(readOnlyAlias.current_release_semantics.env_aliases, ['env', 'observedEnvAlias']);
  assert.equal(readOnlyAlias.current_release_semantics.env_mutation_count, 0);
  assert.equal(readOnlyAlias.current_release_semantics.env_escape_count, 0);

  for (const [label, from, to] of [
    ['assert import source', "from 'node:assert/strict'", "from 'node:assert'"],
    ['createRequire import source', "from 'node:module'", "from 'node:url'"],
    ['test import source', "from 'node:test'", "from 'node:test/reporters'"],
    ['createRequire authority', 'createRequire(import.meta.url)', "createRequire('file:///tmp/fake.mjs')"],
    ['fake createRequire helper', 'createRequire(import.meta.url)', 'fakeCreateRequire(import.meta.url)'],
    ['facade require source', "require('../../../electron/desktop-agent-host.cjs')", "require('../../../electron/fake-host.cjs')"],
    ['non-imported assert binding', "import assert from 'node:assert/strict';", 'const assert = fakeAssert;'],
  ]) {
    const result = assertSemanticBypassRejected(`rejects wrong ${label}`, (source) => source.replace(from, to));
    assert.equal(result.current_release_semantics.top_level_bindings.some((binding) => !binding.verified), true);
  }
  for (const [label, statement] of [
    ['nested workerEnvironment parameter shadow', '  function shadow(workerEnvironment) { return workerEnvironment; }'],
    ['assert rebinding', '  assert = replacementAssert;'],
    ['workerEnvironment member write', '  workerEnvironment.compromised = true;'],
    ['Object indirect test mutation', "  Object.defineProperty(test, 'compromised', { value: true });"],
    ['Object.defineProperties indirect assert mutation', "  Object.defineProperties(assert, { compromised: { value: true } });"],
    ['Object.assign indirect workerEnvironment mutation', '  Object.assign(workerEnvironment, { compromised: true });'],
    ['Reflect indirect require mutation', "  Reflect.set(require, 'compromised', true);"],
    ['Reflect.deleteProperty indirect test mutation', "  Reflect.deleteProperty(test, 'only');"],
    ['Object-wrapped protected mutation', "  Reflect.set(Object(assert), 'deepEqual', replacement);"],
    ['array destructured assert alias', '  const [assertAlias] = [assert];\n  assertAlias.deepEqual = replacementDeepEqual;'],
    ['object destructured require alias', "  const { authority: requireAlias } = { authority: require };\n  Reflect.set(requireAlias, 'compromised', true);"],
    ['defaulted workerEnvironment alias', '  const [workerAlias = fallbackWorker] = [workerEnvironment];\n  workerAlias.compromised = true;'],
    ['default-only assert alias', '  const [assertAlias = assert] = [];\n  assertAlias.deepEqual = replacementDeepEqual;'],
    ['assigned array destructured assert alias', '  let assertAlias;\n  [assertAlias] = [assert];\n  assertAlias.deepEqual = replacementDeepEqual;'],
    ['nested destructured require alias', "  const [{ authority: requireAlias }] = [{ authority: require }];\n  Reflect.set(requireAlias, 'compromised', true);"],
    ['assigned object destructured workerEnvironment alias', '  let workerAlias;\n  ({ current: workerAlias } = { current: workerEnvironment });\n  workerAlias.compromised = true;'],
  ]) {
    const result = assertSemanticBypassRejected(label, (source) => source.replace(
      `${expectedStart}\n`, `${statement}\n${expectedStart}\n`,
    ), 'protected_binding_violation_count');
    assert.equal(result.current_release_semantics.protected_binding_violation_kinds.length > 0, true, label);
  }

  for (const [label, statement] of [
    ['computed object key', '  const { [dynamicAliasKey]: assertAlias } = { actual: assert };'],
    ['array rest', '  const [...assertAliases] = [assert];'],
    ['object rest', '  const { ...requireAliases } = { authority: require };'],
    ['array source spread', '  const [assertAlias] = [...assertValues, assert];'],
    ['dynamic object source key', '  const { actual: assertAlias } = { [dynamicSourceKey]: assert };'],
    ['destructuring shape mismatch', '  const [firstAlias, missingAlias] = [assert];'],
    ['member-expression assignment target', '  ({ actual: aliasHolder.assertAlias } = { actual: assert });'],
  ]) {
    const result = assertSemanticBypassRejected(label, (source) => source.replace(
      `${expectedStart}\n`, `${statement}\n${expectedStart}\n`,
    ), 'protected_binding_violation_count');
    assert.equal(
      result.current_release_semantics.protected_binding_violation_kinds.includes('indeterminate-alias-pattern'),
      true,
      `${label}:${result.current_release_semantics.protected_binding_violation_kinds.join(',')}`,
    );
  }

  const harmlessDestructuring = audit(rewrite((source) => source.replace(
    `${expectedStart}\n`,
    `  const [unrelatedArrayAlias] = [unrelatedObject];\n  const { value: unrelatedObjectAlias } = { value: anotherObject };\n  unrelatedArrayAlias.changed = true;\n  unrelatedObjectAlias.changed = true;\n${expectedStart}\n`,
  )));
  assert.equal(harmlessDestructuring.verified, true, harmlessDestructuring.failures.join(','));
  assert.equal(harmlessDestructuring.current_release_semantics.protected_binding_violation_count, 0);

  const assertChainBypassRejected = (label, filePath, transform) => {
    const result = audit(rewritePath(filePath, transform));
    assert.equal(result.verified, false, label);
    assert.equal(result.current_release_semantics.worker_environment_export_chain.verified, false, label);
    assert.equal(result.failures.includes(
      'current_release_semantics:mr1597:worker_environment_test_mismatch',
    ), true, `${label}:${result.failures.join(',')}`);
  };
  assertChainBypassRejected('facade must forward the exact supervisor', 'electron/desktop-agent-host.cjs', (source) => (
    source.replace('./host-core/agent/execution-worker-supervisor.cjs', './host-core/agent/fake-supervisor.cjs')
  ));
  assertChainBypassRejected('facade cannot forward the supervisor twice', 'electron/desktop-agent-host.cjs', (source) => (
    source.replace(
      "require('./host-core/agent/execution-worker-supervisor.cjs')",
      "require('./host-core/agent/execution-worker-supervisor.cjs'), require('./host-core/agent/execution-worker-supervisor.cjs')",
    )
  ));
  assertChainBypassRejected('facade supervisor must remain the final aggregation source', 'electron/desktop-agent-host.cjs', (source) => (
    source.replace(
      "require('./host-core/agent/execution-worker-supervisor.cjs'))",
      "require('./host-core/agent/execution-worker-supervisor.cjs'), require('./later-source.cjs'))",
    )
  ));
  assertChainBypassRejected('facade sources must remain static require calls', 'electron/desktop-agent-host.cjs', (source) => (
    source.replace("require('./unrelated-a.cjs')", 'dynamicFacadeSource')
  ));
  assertChainBypassRejected('facade sources cannot use spread', 'electron/desktop-agent-host.cjs', (source) => (
    source.replace("require('./unrelated-a.cjs')", '...dynamicFacadeSources')
  ));
  assertChainBypassRejected('facade cannot add a second export aggregation', 'electron/desktop-agent-host.cjs', (source) => (
    `${source}Object.assign(exports, require('./another-source.cjs'));\n`
  ));
  assertChainBypassRejected('facade cannot overwrite workerEnvironment', 'electron/desktop-agent-host.cjs', (source) => (
    `${source}exports.workerEnvironment = replacementWorkerEnvironment;\n`
  ));
  assertChainBypassRejected('facade cannot use a dynamic export write', 'electron/desktop-agent-host.cjs', (source) => (
    `${source}exports[dynamicExportName] = replacementExport;\n`
  ));
  for (const [label, statement] of [
    ['computed static exports member assignment', "exports['unrelatedExport'] = implementation.unrelatedExport;"],
    ['nested ordinary exports assignment', 'if (false) { exports.unrelatedExport = implementation.unrelatedExport; }'],
    ['nested exports member assignment', 'exports.unrelatedExport.compromised = true;'],
    ['compound exports member assignment', 'exports.unrelatedExport += replacementExport;'],
    ['exports member update', 'exports.unrelatedExport++;'],
    ['exports member deletion', 'delete exports.unrelatedExport;'],
    ['reserved exports prototype assignment', 'exports.__proto__ = replacementPrototype;'],
    ['exports root alias creation', 'const directExportsAlias = exports; void directExportsAlias;'],
    ['exports member alias creation', 'const exportedValueAlias = exports.unrelatedExport; void exportedValueAlias;'],
    ['module root alias creation', 'const directModuleAlias = module; void directModuleAlias;'],
    ['destructured module exports alias creation', 'const { exports: escapedExportsAlias } = module; void escapedExportsAlias;'],
    ['exports value cannot leak exports', 'exports.unrelatedExport = exports;'],
    ['exports value cannot leak module.exports', 'exports.unrelatedExport = module.exports;'],
    ['exports value cannot alias workerEnvironment', 'exports.unrelatedExport = implementation.workerEnvironment;'],
    ['named export RHS cannot contain ThisExpression', 'exports.leak = function () { return this; };'],
    ['named export function cannot return facade through this', 'exports.leak = function () { return this; }; exports.leak().workerEnvironment = replacementWorkerEnvironment;'],
    ['named export callable return cannot become a facade write receiver', 'exports.leak = Object.prototype.valueOf; exports.leak().workerEnvironment = replacementWorkerEnvironment;'],
    ['CommonJS wrapper arguments cannot leak the exports receiver', 'exports.leak = arguments; exports.leak.at(0).workerEnvironment = replacementWorkerEnvironment;'],
    ['CommonJS wrapper arguments cannot directly mutate exports', 'arguments[0].workerEnvironment = replacementWorkerEnvironment;'],
    ['CommonJS top-level this cannot mutate exports', 'this.workerEnvironment = replacementWorkerEnvironment;'],
    ['Object.defineProperty unrelated exports write', "Object.defineProperty(exports, 'unrelatedExport', { value: true });"],
    ['Reflect.set unrelated exports write', "Reflect.set(exports, 'unrelatedExport', true);"],
    ['module.exports member assignment', 'module.exports.workerEnvironment = replacementWorkerEnvironment;'],
    ['module.exports member update', 'module.exports.workerEnvironment++;'],
    ['module.exports member deletion', 'delete module.exports.workerEnvironment;'],
    ['module.exports dynamic member assignment', 'module.exports[dynamicExportName] = replacementExport;'],
    ['computed module exports member assignment', "module['exports'].workerEnvironment = replacementWorkerEnvironment;"],
    ['dynamic module export root assignment', 'module[dynamicModuleProperty].workerEnvironment = replacementWorkerEnvironment;'],
    ['module.exports alias member assignment', 'const facadeAlias = module.exports; facadeAlias.workerEnvironment = replacementWorkerEnvironment;'],
    ['destructured module.exports alias member assignment', 'const { exports: facadeAlias } = module; facadeAlias.workerEnvironment = replacementWorkerEnvironment;'],
    ['module.exports alias dynamic member deletion', 'const facadeAlias = module.exports; delete facadeAlias[dynamicExportName];'],
    ['Object.assign module.exports overwrite', 'Object.assign(module.exports, { workerEnvironment: replacementWorkerEnvironment });'],
    ['Object.assign module.exports alias overwrite', 'const facadeAlias = module.exports; Object.assign(facadeAlias, { workerEnvironment: replacementWorkerEnvironment });'],
    ['Object.defineProperty module.exports overwrite', "Object.defineProperty(module.exports, 'workerEnvironment', { value: replacementWorkerEnvironment });"],
    ['Object.defineProperties module.exports overwrite', 'Object.defineProperties(module.exports, { workerEnvironment: { value: replacementWorkerEnvironment } });'],
    ['Reflect.set module.exports overwrite', "Reflect.set(module.exports, 'workerEnvironment', replacementWorkerEnvironment);"],
    ['Reflect.defineProperty module.exports overwrite', "Reflect.defineProperty(module.exports, 'workerEnvironment', { value: replacementWorkerEnvironment });"],
    ['Reflect.deleteProperty module.exports overwrite', "Reflect.deleteProperty(module.exports, 'workerEnvironment');"],
    ['Object.assign.call module.exports overwrite', 'Object.assign.call(null, module.exports, { workerEnvironment: replacementWorkerEnvironment });'],
    ['Object.assign.apply module.exports overwrite', 'Object.assign.apply(null, [module.exports, { workerEnvironment: replacementWorkerEnvironment }]);'],
    ['Object.assign alias.call module.exports overwrite', 'const assignAlias = Object.assign; assignAlias.call(null, module.exports, { workerEnvironment: replacementWorkerEnvironment });'],
    ['Reflect.set.call module.exports overwrite', "Reflect.set.call(null, module.exports, 'workerEnvironment', replacementWorkerEnvironment);"],
    ['Reflect.set alias.apply module.exports overwrite', "const setAlias = Reflect.set; setAlias.apply(null, [module.exports, 'workerEnvironment', replacementWorkerEnvironment]);"],
    ['dynamic Object.assign.apply arguments', 'Object.assign.apply(null, dynamicWriteArguments);'],
  ]) {
    assertChainBypassRejected(label, 'electron/desktop-agent-host.cjs', (source) => (
      `${source}${statement}\n`
    ));
  }
  const allowlistDecoyWithLooseLiveBinding = audit(rewritePath(
    'electron/host-core/agent/execution-worker-process-lifecycle.cjs',
    (source) => source.replace(
      lifecycleSuccessor.line.source,
      `if (false) {\n${lifecycleSuccessor.line.source}\n  void WORKER_ENV_ALLOWLIST;\n}\nconst WORKER_ENV_ALLOWLIST = /.*/u;`,
    ),
  ));
  assert.equal(
    allowlistDecoyWithLooseLiveBinding.integration_bindings.find(
      (binding) => binding.id === lifecycleAllowlistBinding.id,
    )?.verified,
    true,
    '精确行诱饵会满足旧行计数，因此必须由 lexical AST 合同独立阻断',
  );
  assert.equal(allowlistDecoyWithLooseLiveBinding.verified, false);
  assert.equal(
    allowlistDecoyWithLooseLiveBinding.current_release_semantics
      .worker_environment_export_chain.protected_binding_violation_kinds.some((kind) => (
        kind.includes('lifecycle-allowlist-declaration-invalid')
          || kind.includes('lifecycle-allowlist-binding:duplicate-or-shadow-declaration')
      )),
    true,
    allowlistDecoyWithLooseLiveBinding.failures.join(','),
  );
  const harmlessFacadeIndirectWrites = audit(rewritePath(
    'electron/desktop-agent-host.cjs',
    (source) => `${source}Object.assign.call(null, unrelatedTarget, { observed: true });\n`
      + "Reflect.set.apply(null, [unrelatedTarget, 'observed', true]);\n",
  ));
  assert.equal(harmlessFacadeIndirectWrites.verified, true, harmlessFacadeIndirectWrites.failures.join(','));
  assertChainBypassRejected(
    'supervisor must import the exact lifecycle workerEnvironment',
    'electron/host-core/agent/execution-worker-supervisor.cjs',
    (source) => source.replace('./execution-worker-process-lifecycle.cjs', './fake-lifecycle.cjs'),
  );
  assertChainBypassRejected(
    'supervisor must export workerEnvironment',
    'electron/host-core/agent/execution-worker-supervisor.cjs',
    (source) => source.replace('  workerEnvironment,\n};', '};'),
  );
  assertChainBypassRejected(
    'lifecycle declaration must retain exact authority defaults',
    'electron/host-core/agent/execution-worker-process-lifecycle.cjs',
    (source) => source.replace(
      'function workerEnvironment(source = process.env, authority = {}) {',
      'function workerEnvironment(source = {}, authority = {}) {',
    ),
  );
  assertChainBypassRejected(
    'lifecycle must export workerEnvironment',
    'electron/host-core/agent/execution-worker-process-lifecycle.cjs',
    (source) => source.replace('  workerEnvironment,\n};', '};'),
  );
  assertChainBypassRejected(
    'lifecycle workerEnvironment cannot be rebound',
    'electron/host-core/agent/execution-worker-process-lifecycle.cjs',
    (source) => source.replace('  const env = {};', '  workerEnvironment = replacement;\n  const env = {};'),
  );
  assertChainBypassRejected(
    'lifecycle allowlist guard cannot be bypassed by an earlier unconditional continue',
    'electron/host-core/agent/execution-worker-process-lifecycle.cjs',
    (source) => source.replace(
      "    const name = String(key || '').trim();\n    if (!WORKER_ENV_ALLOWLIST.test(name)) continue;",
      "    const name = String(key || '').trim();\n    continue;\n    if (!WORKER_ENV_ALLOWLIST.test(name)) continue;",
    ),
  );
  assertChainBypassRejected(
    'lifecycle cannot restore unfiltered source entries after the allowlist loop',
    'electron/host-core/agent/execution-worker-process-lifecycle.cjs',
    (source) => source.replace(
      '  Object.assign(env, contextUsageWorkerFixtureEnvironment(source));',
      '  Object.assign(env, source);\n  Object.assign(env, contextUsageWorkerFixtureEnvironment(source));',
    ),
  );
  assertChainBypassRejected(
    'lifecycle cannot shadow Object to disable the allowlist iteration',
    'electron/host-core/agent/execution-worker-process-lifecycle.cjs',
    (source) => `const Object = { entries: () => [] };\n${source}`,
  );

  const dynamicExecutionScenarios = [
    ['direct eval', "  eval('1 + 1');", 'direct_eval'],
    ['optional eval', "  eval?.('1 + 1');", 'direct_eval'],
    ['indirect eval', "  (0, eval)('1 + 1');", 'indirect_eval'],
    ['global eval', "  globalThis.eval('1 + 1');", 'indirect_eval'],
    ['eval call', "  eval.call(null, '1 + 1');", 'eval_call_or_apply'],
    ['Function call', "  Function('return 1');", 'function_constructor'],
    ['new Function', "  new Function('return 1');", 'function_constructor'],
    ['Function apply', "  Function.apply(null, ['return 1']);", 'function_call_or_apply'],
    ['Reflect eval', "  Reflect.apply(eval, null, ['1 + 1']);", 'reflect_eval'],
    ['Reflect Function', "  Reflect.construct(Function, ['return 1']);", 'reflect_function_constructor'],
    ['static constructor', "  target.constructor('return 1');", 'member_constructor'],
    ['computed constructor', "  target['constructor']('return 1');", 'member_constructor'],
    ['dynamic computed callee', '  dynamicFns[dynamicName]();', 'dynamic_computed_callee'],
    ['dynamic import', "  import('./dynamic-test-module.mjs');", 'dynamic_import'],
    ['assigned eval alias', "  let execute; execute = eval; execute('1 + 1');", 'indirect_eval'],
    ['logical-or assignment eval alias', "  let execute; execute ||= eval; execute('1 + 1');", 'indirect_eval'],
    ['logical-and assignment eval alias', "  let execute = staticHelper; execute &&= eval; execute('1 + 1');", 'indirect_eval'],
    ['nullish assignment eval alias', "  let execute = null; execute ??= eval; execute('1 + 1');", 'indirect_eval'],
    ['assignment-expression eval', "  let execute; (execute = eval)('1 + 1');", 'indirect_eval'],
    ['conditional eval', "  (true ? eval : staticHelper)('1 + 1');", 'indirect_eval'],
    ['logical eval alias', "  const execute = false || eval; execute('1 + 1');", 'indirect_eval'],
    ['awaited eval alias', "  async function executeLater() { const execute = await eval; execute('1 + 1'); }", 'indirect_eval'],
    ['explicit undefined default eval alias', "  const [execute = eval] = [undefined]; execute('1 + 1');", 'indirect_eval'],
    ['destructured eval alias', "  const [execute] = [eval]; execute('1 + 1');", 'indirect_eval'],
    ['object-container eval alias', "  const holder = { execute: eval }; const execute = holder.execute; execute('1 + 1');", 'indirect_eval'],
    ['declared-function return eval alias', "  function obtainExecutor() { return eval; } const execute = obtainExecutor(); execute('1 + 1');", 'indirect_eval'],
    ['post-declaration object member eval alias', "  const holder = {}; holder.execute = eval; const execute = holder.execute; execute('1 + 1');", 'indirect_eval'],
    ['Reflect.get eval alias', "  const execute = Reflect.get(globalThis, 'eval'); execute('1 + 1');", 'indirect_eval'],
    ['Object.defineProperty eval alias', "  const holder = {}; Object.defineProperty(holder, 'execute', { value: eval }); holder.execute('1 + 1');", 'indirect_eval'],
    ['array-container eval alias', "  const holder = [eval]; const execute = holder[0]; execute('1 + 1');", 'indirect_eval'],
    ['dynamic-container eval alias', "  const holder = { execute: eval }; const execute = holder[dynamicName]; execute('1 + 1');", 'indirect_eval'],
    ['dynamic-container callable indeterminate', "  const holder = { safe: staticHelper }; const execute = holder[dynamicName]; execute('1 + 1');", 'dynamic_computed_callee'],
    ['IIFE-return eval alias', "  const execute = (() => eval)(); execute('1 + 1');", 'indirect_eval'],
    ['for-of eval alias', "  for (const execute of [eval]) execute('1 + 1');", 'indirect_eval'],
    ['for-of named-container eval alias', "  const values = [eval]; for (const execute of values) execute('1 + 1');", 'indirect_eval'],
    ['globalThis destructured eval alias', "  const { eval: execute } = globalThis; execute('1 + 1');", 'indirect_eval'],
    ['assigned Function alias', "  let Constructor; Constructor = Function; new Constructor('return 1');", 'function_constructor'],
    ['conditional Function constructor', "  new (true ? Function : StaticConstructor)('return 1');", 'function_constructor'],
    ['logical Function alias', "  const Constructor = false || Function; new Constructor('return 1');", 'function_constructor'],
    ['globalThis destructured Function alias', "  const { Function: Constructor } = globalThis; new Constructor('return 1');", 'function_constructor'],
    ['switch discriminant Function with case lexical shadow', "  switch (Function('return 1')()) { case 1: let Function; break; }", 'function_constructor'],
    ['switch discriminant globalThis Function with case lexical shadow', "  switch (globalThis.Function('return 1')()) { case 1: let globalThis; break; }", 'function_constructor'],
    ['function parameter initializer before body var environment', "  function invokeDefault(value = Function('return 1')()) { var Function; return value; } invokeDefault();", 'function_constructor'],
    ['class static block lexical declaration does not escape block', "  class StaticLexicalScope { static { let Function; } static value = Function('return 1')(); }", 'function_constructor'],
    ['class static block var declaration does not escape block', "  class StaticVarScope { static { var Function; } } Function('return 1')();", 'function_constructor'],
    ['node vm require', "  const vm = require('node:vm'); vm.runInNewContext('1 + 1');", 'node_vm_module'],
    ['node vm require binding alias', "  const loadModule = require; const vmAlias = loadModule('node:vm'); vmAlias.runInNewContext('1 + 1');", 'node_vm_execution'],
    ['node vm createRequire-derived loader', "  const loadModule = createRequire(import.meta.url); const vmAlias = loadModule('node:vm'); vmAlias.runInNewContext('1 + 1');", 'node_vm_execution'],
    ['node vm loader call forwarding', "  const loadModule = require; const vmAlias = loadModule.call(null, 'node:vm'); vmAlias.runInNewContext('1 + 1');", 'node_vm_execution'],
    ['node vm loader apply forwarding', "  const loadModule = require; const vmAlias = loadModule.apply(null, ['node:vm']); vmAlias.runInNewContext('1 + 1');", 'node_vm_execution'],
    ['node vm loader Reflect.apply forwarding', "  const loadModule = require; const vmAlias = Reflect.apply(loadModule, null, ['node:vm']); vmAlias.runInNewContext('1 + 1');", 'node_vm_execution'],
    ['switch discriminant vm execution with case lexical shadow', "  switch (vm.runInNewContext('1', {})) { case 1: let vm; break; }", 'node_vm_execution'],
    ['owner uses top-level node vm alias', "  vm.runInNewContext('1 + 1');", 'node_vm_execution'],
    ['node vm member alias', "  const execute = vm.runInNewContext; execute('1 + 1');", 'node_vm_execution'],
    ['node vm destructured member alias', "  const { runInNewContext: execute } = vm; execute('1 + 1');", 'node_vm_execution'],
    ['node vm shorthand destructured member alias', "  const { runInNewContext } = vm; runInNewContext('1 + 1');", 'node_vm_execution'],
    ['node vm bound member alias', "  const execute = vm.runInNewContext.bind(vm); execute('1 + 1');", 'node_vm_execution'],
    ['node vm object alias member', "  const vmAlias = vm; const execute = vmAlias.runInNewContext; execute('1 + 1');", 'node_vm_execution'],
    ['node vm object-container alias', "  const holder = { vm }; const alias = holder.vm; alias.runInNewContext('1 + 1');", 'node_vm_execution'],
    ['bound eval alias', "  const execute = eval.bind(null); execute('1 + 1');", 'indirect_eval'],
    ['inline bound Function', "  Function.bind(null)('return 1');", 'function_constructor'],
    ['eval passed through IIFE', "  ((execute) => execute('1 + 1'))(eval);", 'dynamic_callable_escape'],
    ['Reflect apply alias', "  const invoke = Reflect.apply; invoke(eval, null, ['1 + 1']);", 'reflect_eval'],
    ['Reflect construct destructured alias', "  const { construct: invoke } = Reflect; invoke(Function, ['return 1']);", 'reflect_function_constructor'],
    ['node vm spread alias', "  const vmAlias = { ...vm }; vmAlias.runInNewContext('1 + 1');", 'node_vm_execution'],
    ['node vm Object.assign alias', "  const vmAlias = Object.assign({}, vm); vmAlias.runInNewContext('1 + 1');", 'node_vm_execution'],
    ['eval tagged template', '  eval`1 + 1`;', 'eval_tagged_template'],
    ['vm tagged template', '  vm.runInNewContext`1 + 1`;', 'node_vm_execution'],
  ];
  for (const [label, statement, expectedKind] of dynamicExecutionScenarios) {
    const result = assertSemanticBypassRejected(label, (source) => source.replace(
      `${expectedStart}\n`, `${statement}\n${expectedStart}\n`,
    ), 'dynamic_code_execution_count');
    assert.equal(
      result.current_release_semantics.dynamic_code_execution_kinds.includes(expectedKind),
      true,
      `${label}:${result.current_release_semantics.dynamic_code_execution_kinds.join(',')}`,
    );
  }
  const harmlessStaticCalls = audit(rewrite((source) => source.replace(
    `${expectedStart}\n`,
    `  staticHelper();\n  const selectedStaticHelper = true ? staticHelper : alternateStaticHelper;\n  selectedStaticHelper();\n  Object.assign(unrelatedObject, { observed: true });\n  void unrelatedObject.constructor;\n${expectedStart}\n`,
  )));
  assert.equal(harmlessStaticCalls.verified, true, harmlessStaticCalls.failures.join(','));
  assert.equal(harmlessStaticCalls.current_release_semantics.dynamic_code_execution_count, 0);

  const harmlessNamedClassHeritageShadow = audit(rewrite((source) => source.replace(
    `${expectedStart}\n`,
    `  try {\n    void class Function extends Function('return 1')() {};\n  } catch {}\n${expectedStart}\n`,
  )));
  assert.equal(
    harmlessNamedClassHeritageShadow.verified,
    true,
    harmlessNamedClassHeritageShadow.failures.join(','),
  );
  assert.equal(
    harmlessNamedClassHeritageShadow.current_release_semantics.dynamic_code_execution_count,
    0,
  );

  const harmlessContainerReads = audit(rewrite((source) => source.replace(
    `${expectedStart}\n`,
    `  const holder = { safe: staticHelper, execute: eval, values: [alternateStaticHelper, eval] };\n  const safeObjectCall = holder.safe;\n  const safeArrayCall = holder.values[0];\n  safeObjectCall();\n  safeArrayCall();\n  void holder.execute;\n  void holder.values[1];\n${expectedStart}\n`,
  )));
  assert.equal(harmlessContainerReads.verified, true, harmlessContainerReads.failures.join(','));
  assert.equal(harmlessContainerReads.current_release_semantics.dynamic_code_execution_count, 0);

  const harmlessShadowedContainerBindings = audit(rewrite((source) => source.replace(
    ownerLine,
    `test('unrelated async result', async () => {\n  const settled = await unrelatedAsyncCall();\n  void settled;\n});\n`
      + `test('unrelated array result', () => {\n  const settled = [];\n  settled.push('done');\n});\n`
      + ownerLine,
  )));
  assert.equal(
    harmlessShadowedContainerBindings.verified,
    true,
    harmlessShadowedContainerBindings.failures.join(','),
  );
  assert.equal(
    harmlessShadowedContainerBindings.current_release_semantics.dynamic_code_execution_count,
    0,
  );

  const topLevelDynamicExecution = audit(rewrite((source) => (
    `eval('outside owner');\n${source}`
  )));
  assert.equal(topLevelDynamicExecution.verified, false);
  assert.equal(
    topLevelDynamicExecution.current_release_semantics.dynamic_code_execution_kinds.includes('direct_eval'),
    true,
  );

  const unusedVmImport = audit(rewrite((source) => source.replace(
    "import vm from 'node:vm';",
    "import vm, { runInNewContext as unusedVmRunner } from 'node:vm';",
  ).replace('void vm;', 'void vm;\nvoid unusedVmRunner;')));
  assert.equal(unusedVmImport.verified, true, unusedVmImport.failures.join(','));
  assert.equal(unusedVmImport.current_release_semantics.dynamic_code_execution_count, 0);

  const workerEntryHarnessSource = [
    "const workerEntryPath = resolve('electron/host-core/agent/execution-worker-entry.cjs');",
    '',
    'function workerEntryHarness(runAgent) {',
    '  const parentPort = new EventEmitter();',
    '  const sent = [];',
    '  parentPort.postMessage = (message) => {',
    '    sent.push(structuredClone(message));',
    "    parentPort.emit('posted');",
    '  };',
    "  const runtimeEntry = '/qwork-test/context-usage-runtime.cjs';",
    '  const entryRequire = createRequire(workerEntryPath);',
    '  const processState = {',
    '    parentPort,',
    '    env: { QBOT_EXECUTION_WORKER_RUNTIME_ENTRY: runtimeEntry },',
    '    memoryUsage: () => ({ rss: 1024 }),',
    '    exitCode: null,',
    '  };',
    '  const module = { exports: {} };',
    "  runInNewContext(readFileSync(workerEntryPath, 'utf8'), {",
    '    AbortController,',
    '    Buffer,',
    '    clearInterval,',
    '    clearTimeout,',
    '    console,',
    '    module,',
    '    exports: module.exports,',
    '    __dirname: dirname(workerEntryPath),',
    '    __filename: workerEntryPath,',
    '    process: processState,',
    '    require: (specifier) => (',
    '      specifier === runtimeEntry ? { eng: { runAgent } } : entryRequire(specifier)',
    '    ),',
    '    setInterval,',
    '    setTimeout,',
    '  }, { filename: workerEntryPath });',
    '  const waitForOperation = async (operation, predicate = () => true) => {',
    '    for (let attempt = 0; attempt < 20; attempt += 1) {',
    '      const message = sent.find((candidate) => (',
    '        candidate.operation === operation && predicate(candidate)',
    '      ));',
    '      if (message) return message;',
    '      await new Promise((resolveWait) => setImmediate(resolveWait));',
    '    }',
    '    assert.fail(`worker did not emit ${operation}`);',
    '  };',
    '  return {',
    '    processState,',
    "    send: (message) => parentPort.emit('message', { data: message }),",
    '    sent,',
    '    waitForOperation,',
    '  };',
    '}',
  ].join('\n');
  const auditWorkerEntryHarness = (transform = (source) => source) => audit(rewrite((source) => (
    transform(source
      .replace(
        "import vm from 'node:vm';",
        "import { EventEmitter } from 'node:events';\n"
          + "import { readFileSync } from 'node:fs';\n"
          + "import { dirname, resolve } from 'node:path';\n"
          + "import { runInNewContext } from 'node:vm';",
      )
      .replace('void vm;\n', '')
      .replace(ownerLine, `${workerEntryHarnessSource}\n\n${ownerLine}`))
  )));
  const exactWorkerEntryHarness = auditWorkerEntryHarness();
  assert.equal(exactWorkerEntryHarness.verified, true, exactWorkerEntryHarness.failures.join(','));
  assert.equal(exactWorkerEntryHarness.current_release_semantics.dynamic_code_execution_count, 0);

  const workerEntryHarnessDriftScenarios = [
    [
      'owner callback reaches workerEntryHarness',
      (source) => source.replace(ownerLine, `${ownerLine}\n  workerEntryHarness(async () => ({ parts: [] }));`),
    ],
    [
      'second runInNewContext invocation',
      (source) => source.replace(ownerLine, `runInNewContext('1 + 1', {});\n${ownerLine}`),
    ],
    [
      'runInNewContext alias',
      (source) => source.replace(ownerLine, `const vmRunnerAlias = runInNewContext;\nvoid vmRunnerAlias;\n${ownerLine}`),
    ],
    [
      'runInNewContext bind',
      (source) => source.replace(ownerLine, `const boundVmRunner = runInNewContext.bind(null);\nvoid boundVmRunner;\n${ownerLine}`),
    ],
    [
      'Reflect.apply runInNewContext',
      (source) => source.replace(ownerLine, `Reflect.apply(runInNewContext, null, [\"1 + 1\", {}]);\n${ownerLine}`),
    ],
    [
      'Reflect.construct runInNewContext',
      (source) => source.replace(ownerLine, `Reflect.construct(runInNewContext, [\"1 + 1\", {}]);\n${ownerLine}`),
    ],
    [
      'container copy and extraction of runInNewContext',
      (source) => source.replace(
        ownerLine,
        `const vmRunners = { execute: runInNewContext };\nconst extractedVmRunner = vmRunners.execute;\nvoid extractedVmRunner;\n${ownerLine}`,
      ),
    ],
    [
      'workerEntryHarness parameter drift',
      (source) => source.replace(
        'function workerEntryHarness(runAgent) {',
        'function workerEntryHarness(runAgent, untrustedRuntime) {',
      ),
    ],
    [
      'workerEntryPath drift',
      (source) => source.replace(
        "resolve('electron/host-core/agent/execution-worker-entry.cjs')",
        "resolve('electron/host-core/agent/untrusted-worker-entry.cjs')",
      ),
    ],
    [
      'worker entry source encoding drift',
      (source) => source.replace(
        "readFileSync(workerEntryPath, 'utf8')",
        "readFileSync(workerEntryPath, 'utf16le')",
      ),
    ],
    [
      'worker entry sandbox drift',
      (source) => source.replace(
        '    AbortController,\n    Buffer,',
        '    AbortController,\n    eval,\n    Buffer,',
      ),
    ],
    [
      'worker entry filename drift',
      (source) => source.replace(
        '{ filename: workerEntryPath });',
        "{ filename: '/untrusted/worker-entry.cjs' });",
      ),
    ],
  ];
  for (const [label, transform] of workerEntryHarnessDriftScenarios) {
    const result = auditWorkerEntryHarness(transform);
    assert.equal(result.verified, false, label);
    assert.equal(result.current_release_semantics.verified, false, label);
    assert.equal(result.current_release_semantics.dynamic_code_execution_count > 0, true, label);
    assert.equal(
      result.current_release_semantics.dynamic_code_execution_kinds.some((kind) => (
        ['node_vm_execution', 'node_vm_escape'].includes(kind)
      )),
      true,
      `${label}:${result.current_release_semantics.dynamic_code_execution_kinds.join(',')}`,
    );
  }

  for (const alternateTokenProperty of [
    "      IM_USER_ACCESS_TOKEN: 'different-secret',",
    '    IM_USER_ACCESS_TOKEN: tokenFromExpression,',
    "    'IM_USER_ACCESS_TOKEN': tokenFromQuotedKey,",
    "    ['IM_USER_ACCESS_TOKEN']: tokenFromComputedKey,",
    '    IM_USER_ACCESS_TOKEN,',
    '    IM_USER_ACCESS_TOKEN /* comment between key and colon */: tokenAfterComment,',
    '    IM_USER_ACCESS_TOKEN\n    : tokenAfterLineBreak,',
    "    ['IM_USER_ACCESS_TOKEN' /* computed comment */]: tokenFromCommentedComputedKey,",
    '    IM_USER_ACCESS_TOKEN /* shorthand comment */,',
  ]) {
    const alternateTokenInExpected = audit(rewrite((source) => source.replace(
      `${expectedStart}\n`,
      `${expectedStart}\n${alternateTokenProperty}\n`,
    )));
    assert.equal(alternateTokenInExpected.verified, false, alternateTokenProperty);
    assert.equal(alternateTokenInExpected.failures.includes(
      `current_integration_binding_scope_forbidden_fragment_mismatch:${identityBinding.id}:access_token_expected_forbidden`,
    ), true, alternateTokenProperty);
    assert.equal(alternateTokenInExpected.failures.includes(
      `current_integration_binding_mismatch:${tokenBinding.id}`,
    ), true, alternateTokenProperty);
  }

  const alternateTokenOutsideOwner = audit(rewrite((source) => (
    `${source}test('unrelated token copy', () => {\n  const leaked = { IM_USER_ACCESS_TOKEN: tokenFromElsewhere };\n});\n`
  )));
  assert.equal(alternateTokenOutsideOwner.verified, false);
  assert.equal(alternateTokenOutsideOwner.failures.includes(
    `current_integration_binding_mismatch:${tokenBinding.id}`,
  ), true);

  for (const harmlessTokenText of [
    "    harmlessComment: true, // IM_USER_ACCESS_TOKEN: fake",
    "    harmlessString: 'IM_USER_ACCESS_TOKEN: fake',",
    '    harmlessTemplate: `IM_USER_ACCESS_TOKEN: fake`,',
    '    harmlessPattern: /IM_USER_ACCESS_TOKEN\\s*:/u,',
  ]) {
    const harmlessTextInExpected = audit(rewrite((source) => (
      `${source}test('unrelated token-like text', () => {\n  const harmless = {\n${harmlessTokenText}\n  };\n});\n`
    )));
    assert.equal(harmlessTextInExpected.verified, true, harmlessTokenText);
  }

  const malformedExpectedJavaScript = audit(rewrite((source) => source.replace(
    `${expectedStart}\n`,
    `${expectedStart}\n    broken: ),\n`,
  )));
  assert.equal(malformedExpectedJavaScript.verified, false);
  assert.equal(malformedExpectedJavaScript.failures.includes(
    `current_integration_binding_scope_forbidden_fragment_mismatch:${identityBinding.id}:access_token_expected_forbidden`,
  ), true);

  const missingCurrentToken = audit(rewrite((source) => source.replace(`${tokenLine}\n`, '')));
  assert.equal(missingCurrentToken.verified, false);
  assert.equal(missingCurrentToken.failures.includes(
    `current_integration_binding_scope_required_fragment_mismatch:${tokenBinding.id}:access_token_input`,
  ), true);
  const repeatedCurrentToken = audit(rewrite((source) => source.replace(
    `${tokenLine}\n`,
    `${tokenLine}\n${tokenLine}\n`,
  )));
  assert.equal(repeatedCurrentToken.verified, false);
  assert.equal(repeatedCurrentToken.failures.includes(
    `current_integration_binding_scope_required_fragment_mismatch:${tokenBinding.id}:access_token_input`,
  ), true);

  const extraIdentityCopy = audit(rewrite((source) => (
    `${source}test('unrelated extra identity copy', () => {\n${identityLine}\n});\n`
  )));
  assert.equal(extraIdentityCopy.verified, false);
  assert.equal(extraIdentityCopy.failures.includes(`current_integration_binding_mismatch:${identityBinding.id}`), true);

  const duplicatedOwner = audit(rewrite((source) => `${source}${source}`));
  assert.equal(duplicatedOwner.verified, false);
  assert.equal(duplicatedOwner.failures.includes(
    `current_integration_binding_scope_owner_mismatch:${identityBinding.id}`,
  ), true);

  const validateAttestation = (candidate) => validateCurrentReleaseSourceContractAttestation(candidate, {
    report: { release: { head }, merge_requests: [verifiedLifecycleSuccessorMr], source_contracts: [candidate] },
    contract,
    contracts: [contract],
  });
  const verifiedValidation = validateAttestation(verified);
  assert.equal(verifiedValidation.ok, true, verifiedValidation.failures.join(','));

  const forgedSuccessorAncestry = structuredClone(verified);
  const forgedSuccessorBinding = forgedSuccessorAncestry.integration_bindings.find(
    (binding) => binding.id === lifecycleAllowlistBinding.id,
  );
  delete forgedSuccessorBinding.successor_observation.predecessor_ancestry.query_completed;
  delete forgedSuccessorAncestry.attestation_sha256;
  forgedSuccessorAncestry.attestation_sha256 = sha256Text(stableJson(forgedSuccessorAncestry));
  const forgedSuccessorValidation = validateAttestation(forgedSuccessorAncestry);
  assert.equal(forgedSuccessorValidation.ok, false);
  assert.equal(forgedSuccessorValidation.failures.some((failure) => (
    failure.includes('attestation_current_integration_bindings')
      || failure.includes('attestation_replay:current_integration_binding_mismatch')
  )), true, forgedSuccessorValidation.failures.join(','));

  for (const field of [
    'id', 'short_id', 'created_at', 'parent_ids', 'title', 'message', 'author_name', 'author_email',
    'authored_date', 'committer_name', 'committer_email', 'committed_date', 'trailers',
    'project_id', 'stats', 'status', 'last_pipeline', 'web_url',
  ]) {
    const forgedMetadata = structuredClone(verified);
    const provenance = forgedMetadata.protected_files[0].last_commit_provenance;
    delete provenance.commit_raw_response[field];
    delete provenance.commit_metadata[field];
    provenance.commit_response_sha256 = sha256Text(stableJson(provenance.commit_raw_response));
    delete forgedMetadata.attestation_sha256;
    forgedMetadata.attestation_sha256 = sha256Text(stableJson(forgedMetadata));
    const validation = validateAttestation(forgedMetadata);
    assert.equal(validation.ok, false, field);
    assert.equal(validation.failures.some((failure) => failure.includes(':commit_metadata_')), true,
      `${field}:${validation.failures.join(',')}`);
  }

  for (const [field, value] of [
    ['title', 'Format-valid forged title'],
    ['message', 'Format-valid forged message'],
    ['author_name', 'Format-valid forged author'],
  ]) {
    const forgedProjection = structuredClone(verified);
    const provenance = forgedProjection.protected_files[0].last_commit_provenance;
    provenance.commit_metadata[field] = value;
    provenance.commit_response_sha256 = sha256Text(stableJson(provenance.commit_metadata));
    delete forgedProjection.attestation_sha256;
    forgedProjection.attestation_sha256 = sha256Text(stableJson(forgedProjection));
    const validation = validateAttestation(forgedProjection);
    assert.equal(validation.ok, false, field);
    assert.equal(validation.failures.some((failure) => (
      failure.includes(':commit_metadata_projection_mismatch')
        || failure.includes(':commit_response_sha256_mismatch')
    )), true, `${field}:${validation.failures.join(',')}`);
  }

  for (const [field, value] of [
    ['diff', '@@ -1 +1 @@\n-forged\n+replacement'],
    ['a_mode', '100755'],
    ['generated_file', true],
    ['collapsed', true],
    ['too_large', true],
  ]) {
    const forgedRawResponse = structuredClone(verified);
    const page = forgedRawResponse.protected_files[0].last_commit_provenance.diff_pages[0];
    page.raw_response[0][field] = value;
    delete forgedRawResponse.attestation_sha256;
    forgedRawResponse.attestation_sha256 = sha256Text(stableJson(forgedRawResponse));
    const validation = validateAttestation(forgedRawResponse);
    assert.equal(validation.ok, false, field);
    assert.equal(validation.failures.some((failure) => failure.includes(':diff_page_sha256_mismatch:')), true,
      `${field}:${validation.failures.join(',')}`);
  }

  for (const [field, value] of [
    ['created_at', '2026-09-08 01:02:03Z'],
    ['authored_date', '2026-02-30T01:02:03Z'],
    ['committed_date', '2026-09-08T01:02:03+14:30'],
    ['short_id', 'ABCDEF12'],
    ['parent_ids', ['A'.repeat(40)]],
    ['trailers', { Reviewed: 42 }],
    ['stats', { additions: 1, deletions: 1, total: 1 }],
    ['status', '   '],
    ['last_pipeline', {}],
  ]) {
    const forgedMetadata = structuredClone(verified);
    const provenance = forgedMetadata.protected_files[0].last_commit_provenance;
    provenance.commit_raw_response[field] = structuredClone(value);
    provenance.commit_metadata[field] = value;
    provenance.commit_response_sha256 = sha256Text(stableJson(provenance.commit_raw_response));
    delete forgedMetadata.attestation_sha256;
    forgedMetadata.attestation_sha256 = sha256Text(stableJson(forgedMetadata));
    const validation = validateAttestation(forgedMetadata);
    assert.equal(validation.ok, false, field);
    assert.equal(validation.failures.some((failure) => failure.includes(`:commit_metadata_${field}`)), true,
      `${field}:${validation.failures.join(',')}`);
  }

  for (const field of ['collapsed', 'too_large']) {
    const forgedIncompleteDiff = structuredClone(verified);
    const page = forgedIncompleteDiff.protected_files[0].last_commit_provenance.diff_pages[0];
    page.raw_response[0][field] = true;
    page.response_sha256 = sha256Text(stableJson(page.raw_response));
    delete forgedIncompleteDiff.attestation_sha256;
    forgedIncompleteDiff.attestation_sha256 = sha256Text(stableJson(forgedIncompleteDiff));
    const validation = validateAttestation(forgedIncompleteDiff);
    assert.equal(validation.ok, false, field);
    assert.equal(validation.failures.some((failure) => failure.includes(':diff_page_raw_incomplete:')), true,
      `${field}:${validation.failures.join(',')}`);
  }

  for (const field of [
    'old_path', 'new_path', 'a_mode', 'b_mode', 'diff', 'new_file', 'renamed_file',
    'deleted_file',
  ]) {
    const forgedReducedDiff = structuredClone(verified);
    const page = forgedReducedDiff.protected_files[0].last_commit_provenance.diff_pages[0];
    delete page.raw_response[0][field];
    page.response_sha256 = sha256Text(stableJson(page.raw_response));
    delete forgedReducedDiff.attestation_sha256;
    forgedReducedDiff.attestation_sha256 = sha256Text(stableJson(forgedReducedDiff));
    const validation = validateAttestation(forgedReducedDiff);
    assert.equal(validation.ok, false, field);
    assert.equal(validation.failures.some((failure) => failure.includes(':diff_page_raw_change_invalid:')), true,
      `${field}:${validation.failures.join(',')}`);
  }
  for (const field of ['generated_file', 'collapsed', 'too_large']) {
    const reducedOptionalDiff = structuredClone(verified);
    const page = reducedOptionalDiff.protected_files[0].last_commit_provenance.diff_pages[0];
    delete page.raw_response[0][field];
    page.response_sha256 = sha256Text(stableJson(page.raw_response));
    delete reducedOptionalDiff.attestation_sha256;
    reducedOptionalDiff.attestation_sha256 = sha256Text(stableJson(reducedOptionalDiff));
    const validation = validateAttestation(reducedOptionalDiff);
    assert.equal(validation.ok, true, `${field}:${validation.failures.join(',')}`);
  }
  for (const [label, mutate, expectedFailure] of [
    ['unknown_field', (change) => { change.untrusted_extra = false; }, ':diff_page_raw_change_invalid:'],
    ['optional_flag_type', (change) => { change.generated_file = 'false'; }, ':diff_page_raw_extension_invalid:'],
    ['rename_path_conflict', (change) => { change.renamed_file = true; }, ':diff_page_change_flags_conflict:'],
  ]) {
    const forgedDiff = structuredClone(verified);
    const page = forgedDiff.protected_files[0].last_commit_provenance.diff_pages[0];
    mutate(page.raw_response[0]);
    page.response_sha256 = sha256Text(stableJson(page.raw_response));
    delete forgedDiff.attestation_sha256;
    forgedDiff.attestation_sha256 = sha256Text(stableJson(forgedDiff));
    const validation = validateAttestation(forgedDiff);
    assert.equal(validation.ok, false, label);
    assert.equal(validation.failures.some((failure) => failure.includes(expectedFailure)), true,
      `${label}:${validation.failures.join(',')}`);
  }
  const forgedCurrentV1 = structuredClone(verified);
  forgedCurrentV1.schema_version = 'qbot-qwork-release-source-contract/v1';
  delete forgedCurrentV1.attestation_sha256;
  forgedCurrentV1.attestation_sha256 = sha256Text(stableJson(forgedCurrentV1));
  const forgedCurrentV1Validation = validateAttestation(forgedCurrentV1);
  assert.equal(forgedCurrentV1Validation.ok, false);
  assert.equal(forgedCurrentV1Validation.failures.includes('attestation_schema_mismatch'), true);

  const forgedCurrentTopLevel = structuredClone(verified);
  forgedCurrentTopLevel.untrusted_extra = true;
  delete forgedCurrentTopLevel.attestation_sha256;
  forgedCurrentTopLevel.attestation_sha256 = sha256Text(stableJson(forgedCurrentTopLevel));
  const forgedCurrentTopLevelValidation = validateAttestation(forgedCurrentTopLevel);
  assert.equal(forgedCurrentTopLevelValidation.ok, false);
  assert.equal(forgedCurrentTopLevelValidation.failures.includes('attestation_current_fields_mismatch'), true);

  const forgedLegacyProvenance = structuredClone(verified);
  const legacyFile = forgedLegacyProvenance.protected_files[0];
  legacyFile.last_commit_provenance = {
    schema_version: 'qbot-qwork-release-file-provenance/v1',
    source: 'gitlab-api-repository-commits',
    endpoint: `repository/commits?path=${encodeURIComponent(legacyFile.path)}&ref_name=${encodeURIComponent(head)}&per_page=1`,
    path: legacyFile.path,
    ref: head,
    commit_id: head,
    last_commit_id: head,
  };
  delete forgedLegacyProvenance.attestation_sha256;
  forgedLegacyProvenance.attestation_sha256 = sha256Text(stableJson(forgedLegacyProvenance));
  const legacyProvenanceValidation = validateAttestation(forgedLegacyProvenance);
  assert.equal(legacyProvenanceValidation.ok, false);
  assert.equal(legacyProvenanceValidation.failures.includes(
    `attestation_release_file_last_commit_provenance:${legacyFile.path}:fields_mismatch`,
  ), true);

  const forgedLastCommit = structuredClone(verified);
  const forgedLastCommitFile = forgedLastCommit.protected_files[0];
  forgedLastCommitFile.last_commit_id = '8'.repeat(40);
  delete forgedLastCommit.attestation_sha256;
  forgedLastCommit.attestation_sha256 = sha256Text(stableJson(forgedLastCommit));
  const forgedLastCommitValidation = validateAttestation(forgedLastCommit);
  assert.equal(forgedLastCommitValidation.ok, false);
  assert.equal(
    forgedLastCommitValidation.failures.includes(
      `attestation_release_file_last_commit_provenance:${forgedLastCommitFile.path}:file_last_commit_id_mismatch`,
    ),
    true,
  );

  const forgedProvenance = structuredClone(verified);
  forgedProvenance.protected_files[0].last_commit_provenance.file_last_commit_id = '8'.repeat(40);
  delete forgedProvenance.attestation_sha256;
  forgedProvenance.attestation_sha256 = sha256Text(stableJson(forgedProvenance));
  const forgedProvenanceValidation = validateAttestation(forgedProvenance);
  assert.equal(forgedProvenanceValidation.ok, false);
  assert.equal(
    forgedProvenanceValidation.failures.includes(
      `attestation_release_file_last_commit_provenance:${forgedProvenance.protected_files[0].path}:file_last_commit_id_mismatch`,
    ),
    true,
  );

  for (const scenario of [
    {
      name: 'duplicate current path changes',
      mutate(provenance) {
        const duplicate = { ...provenance.matched_changes[0], new_file: true };
        provenance.diff_pages[0].raw_response.push(duplicate);
        provenance.diff_pages[0].changes.push(duplicate);
        provenance.diff_pages[0].item_count = provenance.diff_pages[0].changes.length;
        provenance.diff_pages[0].response_sha256 = sha256Text(stableJson(provenance.diff_pages[0].raw_response));
        provenance.matched_changes.push(duplicate);
        provenance.matched_change_count = provenance.matched_changes.length;
      },
      failure: ':matched_change_count_mismatch',
    },
    {
      name: 'deleted current path',
      mutate(provenance) {
        provenance.diff_pages[0].raw_response[0].deleted_file = true;
        provenance.diff_pages[0].changes[0].deleted_file = true;
        provenance.diff_pages[0].response_sha256 = sha256Text(stableJson(provenance.diff_pages[0].raw_response));
        provenance.matched_changes[0].deleted_file = true;
      },
      failure: ':matched_change_current_path_mismatch',
    },
    {
      name: 'rename away from current path',
      mutate(provenance) {
        provenance.diff_pages[0].raw_response[0].new_path = 'docs/renamed-away.mjs';
        provenance.diff_pages[0].raw_response[0].renamed_file = true;
        provenance.diff_pages[0].changes[0].new_path = 'docs/renamed-away.mjs';
        provenance.diff_pages[0].changes[0].renamed_file = true;
        provenance.diff_pages[0].response_sha256 = sha256Text(stableJson(provenance.diff_pages[0].raw_response));
        provenance.matched_changes[0].new_path = 'docs/renamed-away.mjs';
        provenance.matched_changes[0].renamed_file = true;
      },
      failure: ':matched_change_current_path_mismatch',
    },
  ]) {
    const forgedTerminalChange = structuredClone(verified);
    const file = forgedTerminalChange.protected_files[0];
    scenario.mutate(file.last_commit_provenance);
    delete forgedTerminalChange.attestation_sha256;
    forgedTerminalChange.attestation_sha256 = sha256Text(stableJson(forgedTerminalChange));
    const validation = validateAttestation(forgedTerminalChange);
    assert.equal(validation.ok, false, scenario.name);
    assert.equal(validation.failures.some((failure) => failure.includes(scenario.failure)), true,
      `${scenario.name}:${validation.failures.join(',')}`);
  }

  for (const invalidPath of [42, {}, '   ', ' leading/path.mjs', 'trailing/path.mjs ']) {
    const forgedPath = structuredClone(verified);
    const provenance = forgedPath.protected_files[0].last_commit_provenance;
    provenance.diff_pages[0].raw_response[0].old_path = invalidPath;
    provenance.diff_pages[0].changes[0].old_path = invalidPath;
    provenance.diff_pages[0].response_sha256 = sha256Text(stableJson(provenance.diff_pages[0].raw_response));
    provenance.matched_changes[0].old_path = invalidPath;
    delete forgedPath.attestation_sha256;
    forgedPath.attestation_sha256 = sha256Text(stableJson(forgedPath));
    const validation = validateAttestation(forgedPath);
    assert.equal(validation.ok, false, stableJson(invalidPath));
    assert.equal(validation.failures.some((failure) => (
      failure.includes(':diff_page_raw_change_invalid:')
        || failure.includes(':diff_page_change_invalid:')
    )), true, `${stableJson(invalidPath)}:${validation.failures.join(',')}`);
  }

  const forgedSemantics = structuredClone(verified);
  forgedSemantics.current_release_semantics.expected_object_shape.spread_count = 1;
  delete forgedSemantics.attestation_sha256;
  forgedSemantics.attestation_sha256 = sha256Text(stableJson(forgedSemantics));
  const forgedSemanticsValidation = validateAttestation(forgedSemantics);
  assert.equal(forgedSemanticsValidation.ok, false);
  assert.equal(forgedSemanticsValidation.failures.includes(
    'attestation_current_release_semantics_mismatch',
  ), true);
  const assertSemanticAttestationForgeryRejected = (label, mutate) => {
    const forged = structuredClone(verified);
    mutate(forged.current_release_semantics);
    delete forged.attestation_sha256;
    forged.attestation_sha256 = sha256Text(stableJson(forged));
    const validation = validateAttestation(forged);
    assert.equal(validation.ok, false, label);
    assert.equal(validation.failures.includes(
      'attestation_current_release_semantics_mismatch',
    ), true, `${label}:${validation.failures.join(',')}`);
  };
  assertSemanticAttestationForgeryRejected('old v1 semantics schema', (semantics) => {
    semantics.schema_version = 'qbot-qwork-mr1597-worker-environment-test-semantics/v1';
  });
  assertSemanticAttestationForgeryRejected('missing v2 semantics field', (semantics) => {
    delete semantics.dynamic_code_execution_count;
  });
  assertSemanticAttestationForgeryRejected('unexpected v2 semantics field', (semantics) => {
    semantics.untrusted_extra = true;
  });
  assertSemanticAttestationForgeryRejected('forged top-level binding', (semantics) => {
    semantics.top_level_bindings[0].source = 'node:assert';
  });
  assertSemanticAttestationForgeryRejected('forged export chain', (semantics) => {
    semantics.worker_environment_export_chain.steps[0].count = 2;
  });
  assertSemanticAttestationForgeryRejected('forged dynamic execution count', (semantics) => {
    semantics.dynamic_code_execution_count = 1;
    semantics.dynamic_code_execution_kinds = ['direct_eval'];
  });

  const forgedAllGreenObservation = structuredClone(verified);
  const forgedTestFile = forgedAllGreenObservation.protected_files.find((file) => (
    file.path === tokenBinding.path
  ));
  const forgedTestSource = Buffer.from(forgedTestFile.content_base64, 'base64').toString('utf8').replace(
    `${expectedStart}\n`, `  eval('forged');\n${expectedStart}\n`,
  );
  const forgedTestBytes = Buffer.from(forgedTestSource, 'utf8');
  forgedTestFile.content_base64 = forgedTestBytes.toString('base64');
  forgedTestFile.declared_size = forgedTestBytes.length;
  forgedTestFile.bytes = forgedTestBytes.length;
  forgedTestFile.sha256 = sha256Text(forgedTestSource);
  forgedTestFile.blob_id = gitBlobSha1(forgedTestSource);
  forgedTestFile.line_count = forgedTestSource.replace(/\n$/u, '').split('\n').length;
  delete forgedAllGreenObservation.attestation_sha256;
  forgedAllGreenObservation.attestation_sha256 = sha256Text(stableJson(forgedAllGreenObservation));
  const forgedAllGreenValidation = validateAttestation(forgedAllGreenObservation);
  assert.equal(forgedAllGreenValidation.ok, false);
  assert.equal(forgedAllGreenValidation.failures.includes(
    'attestation_current_release_semantics_mismatch',
  ), true, forgedAllGreenValidation.failures.join(','));
  const forgedProtectedBindingObservation = structuredClone(verified);
  const forgedProtectedTestFile = forgedProtectedBindingObservation.protected_files.find((file) => (
    file.path === tokenBinding.path
  ));
  const forgedProtectedSource = Buffer.from(
    forgedProtectedTestFile.content_base64,
    'base64',
  ).toString('utf8').replace(
    `${expectedStart}\n`, `  Reflect.set(Object(assert), 'deepEqual', replacement);\n${expectedStart}\n`,
  );
  const forgedProtectedBytes = Buffer.from(forgedProtectedSource, 'utf8');
  forgedProtectedTestFile.content_base64 = forgedProtectedBytes.toString('base64');
  forgedProtectedTestFile.declared_size = forgedProtectedBytes.length;
  forgedProtectedTestFile.bytes = forgedProtectedBytes.length;
  forgedProtectedTestFile.sha256 = sha256Text(forgedProtectedSource);
  forgedProtectedTestFile.blob_id = gitBlobSha1(forgedProtectedSource);
  forgedProtectedTestFile.line_count = forgedProtectedSource.replace(/\n$/u, '').split('\n').length;
  assert.equal(forgedProtectedBindingObservation.current_release_semantics.protected_binding_violation_count, 0);
  assert.deepEqual(forgedProtectedBindingObservation.current_release_semantics.protected_binding_violation_kinds, []);
  delete forgedProtectedBindingObservation.attestation_sha256;
  forgedProtectedBindingObservation.attestation_sha256 = sha256Text(stableJson(forgedProtectedBindingObservation));
  const forgedProtectedValidation = validateAttestation(forgedProtectedBindingObservation);
  assert.equal(forgedProtectedValidation.ok, false);
  assert.equal(forgedProtectedValidation.failures.includes(
    'attestation_current_release_semantics_mismatch',
  ), true, forgedProtectedValidation.failures.join(','));
  const assertForgedAttestationRejected = (label, mutate, expectedFailure) => {
    const forged = structuredClone(verified);
    const forgedBinding = forged.integration_bindings.find((item) => item.id === identityBinding.id);
    mutate(forgedBinding);
    delete forged.attestation_sha256;
    forged.attestation_sha256 = sha256Text(stableJson(forged));
    const validation = validateAttestation(forged);
    assert.equal(validation.ok, false, label);
    assert.equal(validation.failures.includes(expectedFailure), true, `${label}: ${validation.failures.join(',')}`);
  };
  assertForgedAttestationRejected('whole-file occurrence count', (binding) => {
    binding.addition_count = 3;
    binding.occurrence_count = 3;
  }, `attestation_current_integration_binding_count:${identityBinding.id}`);
  assertForgedAttestationRejected('owner count', (binding) => {
    binding.scope_observation.owner_occurrence_count = 2;
  }, `attestation_current_integration_binding_scope_owner:${identityBinding.id}`);
  assertForgedAttestationRejected('region start count', (binding) => {
    binding.scope_observation.region_start_occurrence_count = 2;
  }, `attestation_current_integration_binding_scope_region_start:${identityBinding.id}`);
  assertForgedAttestationRejected('region end count', (binding) => {
    binding.scope_observation.region_end_occurrence_count = 0;
  }, `attestation_current_integration_binding_scope_region_end:${identityBinding.id}`);
  assertForgedAttestationRejected('local region order', (binding) => {
    binding.scope_observation.region_ordered = false;
  }, `attestation_current_integration_binding_scope_region_order:${identityBinding.id}`);
  assertForgedAttestationRejected('owner region anchor count', (binding) => {
    binding.scope_observation.owner_region_order[0].occurrence_count = 2;
  }, `attestation_current_integration_binding_scope_region_sequence:${identityBinding.id}`);
  assertForgedAttestationRejected('owner region anchor verification', (binding) => {
    binding.scope_observation.owner_region_order[0].verified = false;
  }, `attestation_current_integration_binding_scope_region_sequence:${identityBinding.id}`);
  assertForgedAttestationRejected('owner region array order', (binding) => {
    const order = binding.scope_observation.owner_region_order;
    [order[0], order[1]] = [order[1], order[0]];
  }, `attestation_current_integration_binding_scope_region_sequence:${identityBinding.id}`);
  assertForgedAttestationRejected('owner region ordered flag', (binding) => {
    binding.scope_observation.owner_region_ordered = false;
  }, `attestation_current_integration_binding_scope_region_sequence:${identityBinding.id}`);
  assertForgedAttestationRejected('exclusive region end policy', (binding) => {
    binding.current_release_scope.region_end_inclusive = true;
  }, 'attestation_current_integration_bindings_mismatch');
  assertForgedAttestationRejected('region end scope anchor', (binding) => {
    binding.current_release_scope.region_end.source = '  });';
  }, 'attestation_current_integration_bindings_mismatch');
  assertForgedAttestationRejected('required fragment count', (binding) => {
    binding.scope_observation.required_fragments[0].occurrence_count = 2;
  }, `attestation_current_integration_binding_scope_fragment:${identityBinding.id}:${identityBinding.id}`);
  assertForgedAttestationRejected('required fragment verification', (binding) => {
    binding.scope_observation.required_fragments[0].verified = false;
  }, `attestation_current_integration_binding_scope_fragment:${identityBinding.id}:${identityBinding.id}`);
  assertForgedAttestationRejected('required fragment unsafe line index', (binding) => {
    binding.scope_observation.required_fragments[0].line_index = -1;
  }, `attestation_current_integration_binding_scope_fragment:${identityBinding.id}:${identityBinding.id}`);
  assertForgedAttestationRejected('required fragment coherently shifted line indexes', (binding) => {
    for (const fragment of binding.scope_observation.required_fragments) fragment.line_index += 1000;
  }, `attestation_current_integration_binding_scope_fragment:${identityBinding.id}:${identityBinding.id}`);
  assertForgedAttestationRejected('required fragment line order', (binding) => {
    const fragments = binding.scope_observation.required_fragments;
    [fragments[0].line_index, fragments[1].line_index] = [fragments[1].line_index, fragments[0].line_index];
  }, `attestation_current_integration_binding_scope_fragment_order:${identityBinding.id}`);
  assertForgedAttestationRejected('required fragments ordered flag', (binding) => {
    binding.scope_observation.required_fragments_ordered = false;
  }, `attestation_current_integration_binding_scope_fragment_order:${identityBinding.id}`);
  assertForgedAttestationRejected('forbidden fragment count', (binding) => {
    binding.scope_observation.forbidden_fragments[0].occurrence_count = 1;
  }, `attestation_current_integration_binding_scope_forbidden_fragment:${identityBinding.id}:access_token_expected_forbidden`);
  assertForgedAttestationRejected('forbidden fragment verification', (binding) => {
    binding.scope_observation.forbidden_fragments[0].verified = false;
  }, `attestation_current_integration_binding_scope_forbidden_fragment:${identityBinding.id}:access_token_expected_forbidden`);
});

test('MR !1595 freezes the exact retirement of the obsolete !1558 test assertions', () => {
  const contract = QWORK_MR1595_OBSOLETE_TEST_RETIREMENT_CONTRACT;
  assert.equal(contract.contract_kind, 'assertion-retirement');
  assert.equal(contract.merge_commit_sha, '3b61267f74bb61b3053c970dd5c7b98d27683e6a');
  assert.equal(contract.contract_sha256, '90c13eee94603d6a53568bf35d8a1ab4d6623a1340e4079c133f6fd277cea5f6');
  assert.equal(contract.changes_count, 184);
  assert.equal(contract.changed_paths.length, 184);
  assert.deepEqual(contract.mr_diff, {
    bytes: 260186,
    sha256: '867e9491a91485f3fba33bd9b3d53b04644f697a9d4a083a0239f87c33ec0852',
  });
  assert.equal(contract.source_file, null);
  assert.deepEqual(contract.header_emissions, []);
  assert.deepEqual(contract.integration_bindings, []);
  assert.deepEqual(contract.forbidden_fragments, []);
  assert.deepEqual(contract.retired_files, [{
    path: 'test/unit/config/settings-ui-surface-contract.test.mjs',
    old_path: 'test/unit/config/settings-ui-surface-contract.test.mjs',
    new_path: 'test/unit/config/settings-ui-surface-contract.test.mjs',
    new_file: false,
    renamed_file: false,
    deleted_file: true,
  }]);
  assert.deepEqual(contract.supersedes, [{
    contract_id: QWORK_MR1558_SETTINGS_MODEL_NAME_DEDUP_CONTRACT.contract_id,
    disposition: 'retired',
    current_assertions: [
      'integration_binding:test_reads_model_group_source',
      'integration_binding:test_declares_settings_name_dedup_contract',
      'integration_binding:test_asserts_normalized_display_name',
      'integration_binding:test_asserts_empty_and_duplicate_rejection',
      'integration_binding:test_asserts_settings_dedupe_integration',
    ],
  }]);
  const trigger = releaseSourceContractTrigger({
    iid: contract.mr_iid,
    commit: contract.merge_commit_sha,
    changed_paths: contract.changed_paths,
  }, contract);
  assert.equal(trigger.iid_match, true);
  assert.equal(trigger.merge_sha_match, true);
  assert.equal(trigger.triggered, false);
  assert.deepEqual(releaseSourceContractProtectedPaths(contract), []);
  const protected1558 = releaseSourceContractProtectedPaths(QWORK_MR1558_SETTINGS_MODEL_NAME_DEDUP_CONTRACT);
  assert.equal(protected1558.includes('test/unit/config/settings-ui-surface-contract.test.mjs'), true);
  assert.equal(protected1558.includes('src/AssistantConfig.tsx'), true);
  assert.equal(protected1558.includes('src/composer-model-display-groups.ts'), true);
  assert.deepEqual(releaseSourceContractTrigger({
    iid: QWORK_MR1558_SETTINGS_MODEL_NAME_DEDUP_CONTRACT.mr_iid,
    commit: QWORK_MR1558_SETTINGS_MODEL_NAME_DEDUP_CONTRACT.merge_commit_sha,
    changed_paths: ['test/unit/config/settings-ui-surface-contract.test.mjs'],
  }, QWORK_MR1558_SETTINGS_MODEL_NAME_DEDUP_CONTRACT).protected_paths, [
    'test/unit/config/settings-ui-surface-contract.test.mjs',
  ]);
  assert.doesNotThrow(() => resolveReleaseSourceContracts());
});

test('MR !1561 source contract freezes the shared 32 MiB worker envelope and its test declaration', () => {
  const contract = QWORK_MR1561_WORKER_ENVELOPE_LIMIT_CONTRACT;
  assert.equal(contract.contract_id, 'deepbankv2-mr-1561-worker-envelope-limit/v1');
  assert.equal(contract.merge_commit_sha, 'ba03b0fa37825de35b556de1d9681da2456b40f2');
  assert.equal(contract.contract_sha256, 'dadedabb8c586fd97766b73be6c7b962ea46ada43e7d32bf2a8698c293966882');
  assert.equal(contract.changes_count, 2);
  assert.deepEqual(contract.changed_paths, [
    'electron/host-core/agent/execution-worker-protocol.cjs',
    'test/unit/desktop/execution-worker-supervisor.test.mjs',
  ]);
  assert.deepEqual(contract.mr_diff, {
    bytes: 2236,
    sha256: '4844c34e0098f0f1bf485df52c92ef8c868da2b301e6d8e25270a2bdab2878fd',
  });
  assert.deepEqual(
    [contract.source_file.change_bytes, contract.source_file.change_sha256],
    [744, '6b7fdee93bc1e6da48828eb814edd4a7a47bdaab17d2bb981e477d0eca9ae64e'],
  );
  assert.deepEqual(
    [contract.source_file.source_bytes, contract.source_file.source_line_count, contract.source_file.source_sha256],
    [45, 1, '59a592a8156a1ea5100f747805dc68fffb2b2856fe3515c5a19a66967c73fbb5'],
  );
  assert.equal(contract.claim_scope, QWORK_RELEASE_SOURCE_CLAIM_SCOPE);
  assert.equal(contract.test_execution_attested, false);
  const bindings = new Map(contract.integration_bindings.map((binding) => [binding.id, binding.addition.source]));
  assert.equal(bindings.get('shared_worker_envelope_limit_32_mib'), 'const MAX_ENVELOPE_BYTES = 32 * 1024 * 1024;');
  assert.equal(
    bindings.get('test_declares_shared_32_mib_envelope_limit'),
    "test('execution messages share the 32 MiB envelope limit', () => {",
  );
  assert.equal(
    bindings.get('test_asserts_execution_start_matches_shared_limit'),
    '  assert.equal(MAX_EXECUTION_START_ENVELOPE_BYTES, MAX_ENVELOPE_BYTES);',
  );
  assert.equal(contract.forbidden_fragments.some((item) => (
    item.value.source === 'const MAX_ENVELOPE_BYTES = 256 * 1024;'
  )), true);
});

test('MR !1561 origin changes verify exactly and fail closed on limit, equality, title, or legacy drift', () => {
  const contract = QWORK_MR1561_WORKER_ENVELOPE_LIMIT_CONTRACT;
  const changes = mr1561OriginChanges();
  const summary = summarizeGitLabChanges(changes);
  assert.deepEqual(
    { paths: summary.paths, bytes: summary.diff_bytes, sha256: summary.diff_sha256 },
    { paths: contract.changed_paths, bytes: contract.mr_diff.bytes, sha256: contract.mr_diff.sha256 },
  );
  const sourceChange = normalizeGitLabChanges(changes)
    .find((change) => change.new_path === contract.source_file.path);
  assert.equal(reconstructGitLabAddedLinesSource(sourceChange), 'const MAX_ENVELOPE_BYTES = 32 * 1024 * 1024;\n');

  const audit = (auditChanges) => auditReleaseSourceContract({
    iid: contract.mr_iid,
    state: contract.state,
    targetBranch: contract.target_branch,
    mergeCommitSha: contract.merge_commit_sha,
    changesCount: contract.changes_count,
    changes: auditChanges,
    contract,
  });
  const verified = audit(changes);
  assert.equal(verified.verified, true);
  assert.deepEqual(verified.failures, []);
  assert.equal(validateReleaseSourceContractAttestation(verified, { contract }).ok, true);

  const scenarios = [
    {
      name: 'shared limit',
      path: contract.source_file.path,
      from: 'const MAX_ENVELOPE_BYTES = 32 * 1024 * 1024;',
      to: 'const MAX_ENVELOPE_BYTES = 16 * 1024 * 1024;',
      failure: 'integration_binding_mismatch:shared_worker_envelope_limit_32_mib',
    },
    {
      name: 'test title',
      path: contract.changed_paths[1],
      from: "test('execution messages share the 32 MiB envelope limit', () => {",
      to: "test('execution messages use an envelope limit', () => {",
      failure: 'integration_binding_mismatch:test_declares_shared_32_mib_envelope_limit',
    },
    {
      name: 'equality assertion',
      path: contract.changed_paths[1],
      from: '  assert.equal(MAX_EXECUTION_START_ENVELOPE_BYTES, MAX_ENVELOPE_BYTES);',
      to: '  assert.notEqual(MAX_EXECUTION_START_ENVELOPE_BYTES, MAX_ENVELOPE_BYTES);',
      failure: 'integration_binding_mismatch:test_asserts_execution_start_matches_shared_limit',
    },
    {
      name: 'legacy 256 KiB limit',
      path: contract.source_file.path,
      from: 'const MAX_ENVELOPE_BYTES = 32 * 1024 * 1024;',
      to: 'const MAX_ENVELOPE_BYTES = 256 * 1024;',
      failure: 'forbidden_fragment:legacy_shared_worker_envelope_limit_256_kib',
    },
  ];
  for (const scenario of scenarios) {
    const drifted = structuredClone(changes);
    const change = drifted.find((item) => item.new_path === scenario.path);
    assert.ok(change, scenario.name);
    change.diff = change.diff.replace(scenario.from, scenario.to);
    const attestation = audit(drifted);
    assert.equal(attestation.verified, false, scenario.name);
    assert.equal(attestation.failures.includes('mr_diff_sha256_mismatch'), true, scenario.name);
    assert.equal(attestation.failures.includes(scenario.failure), true, scenario.name);
  }
});

test('current-release validation replays header declarations from protected file bytes', () => {
  const contract = QWORK_MR1522_CLAUDE_TURN_HEADERS_CONTRACT;
  const head = 'd'.repeat(40);
  const fixtureMap = currentReleaseFileFixtures([contract], head);
  const files = [...fixtureMap].map(([filePath, payload]) => ({
    path: filePath,
    requested_ref: head,
    payload,
  }));
  const verified = auditCurrentReleaseSourceContract({
    releaseHead: head,
    targetBranch: contract.target_branch,
    originAncestry: {
      source: 'gitlab-api-compare-first-parent',
      compare_from: contract.merge_commit_sha,
      compare_to: head,
      compare_commit_count: 1,
      first_parent_complete: true,
      verified: true,
      reason: '',
    },
    files,
    mergeRequests: [],
    originAttestation: null,
    contract,
  });
  assert.equal(verified.verified, true, verified.failures.join(','));
  for (const [label, mutate, expectedFailure] of [
    [
      'ancestry compare count numeric string',
      (attestation) => { attestation.release.ancestry.compare_commit_count = '1'; },
      'attestation_origin_compare_count_invalid',
    ],
    [
      'file declared size numeric string',
      (attestation) => { attestation.protected_files[0].declared_size = String(attestation.protected_files[0].declared_size); },
      'attestation_release_file_declared_size',
    ],
    [
      'file byte count numeric string',
      (attestation) => { attestation.protected_files[0].bytes = String(attestation.protected_files[0].bytes); },
      'attestation_release_file_bytes',
    ],
    [
      'file line count numeric string',
      (attestation) => { attestation.protected_files[0].line_count = String(attestation.protected_files[0].line_count); },
      'attestation_release_file_line_count',
    ],
  ]) {
    const stringlyTyped = structuredClone(verified);
    mutate(stringlyTyped);
    delete stringlyTyped.attestation_sha256;
    stringlyTyped.attestation_sha256 = sha256Text(stableJson(stringlyTyped));
    const validation = validateCurrentReleaseSourceContractAttestation(stringlyTyped, {
      report: { release: { head }, merge_requests: [], source_contracts: [stringlyTyped] },
      contract,
      contracts: [contract],
    });
    assert.equal(validation.ok, false, label);
    assert.equal(validation.failures.some((failure) => failure.includes(expectedFailure)), true,
      `${label}:${validation.failures.join(',')}`);
  }
  const stringSizedPayloadFiles = structuredClone(files);
  stringSizedPayloadFiles[0].payload.size = String(stringSizedPayloadFiles[0].payload.size);
  const stringSizedPayloadAudit = auditCurrentReleaseSourceContract({
    releaseHead: head,
    targetBranch: contract.target_branch,
    originAncestry: {
      source: 'gitlab-api-compare-first-parent',
      compare_from: contract.merge_commit_sha,
      compare_to: head,
      compare_commit_count: 1,
      first_parent_complete: true,
      verified: true,
      reason: '',
    },
    files: stringSizedPayloadFiles,
    mergeRequests: [],
    originAttestation: null,
    contract,
  });
  assert.equal(stringSizedPayloadAudit.verified, false);
  assert.equal(stringSizedPayloadAudit.failures.some((failure) => failure.endsWith(':size_invalid')), true,
    stringSizedPayloadAudit.failures.join(','));
  const forged = structuredClone(verified);
  const header = contract.header_emissions[0];
  const file = forged.protected_files.find((item) => item.path === contract.source_file.path);
  assert.ok(file);
  const source = Buffer.from(file.content_base64, 'base64').toString('utf8');
  const rewritten = source.replace(`${header.emission.source}\n`, '');
  assert.notEqual(rewritten, source);
  const bytes = Buffer.from(rewritten, 'utf8');
  file.content_base64 = bytes.toString('base64');
  file.declared_size = bytes.length;
  file.bytes = bytes.length;
  file.sha256 = sha256Text(rewritten);
  file.blob_id = gitBlobSha1(rewritten);
  file.line_count = rewritten.replace(/\n$/u, '').split('\n').length;
  delete forged.attestation_sha256;
  forged.attestation_sha256 = sha256Text(stableJson(forged));
  const validation = validateCurrentReleaseSourceContractAttestation(forged, {
    report: { release: { head }, merge_requests: [], source_contracts: [forged] },
    contract,
    contracts: [contract],
  });
  assert.equal(validation.ok, false);
  assert.equal(validation.failures.includes('attestation_current_headers_replay_mismatch'), true,
    validation.failures.join(','));
});

test('MR !1561 current-release persistence verifies declarations and blocks removal or legacy restoration', () => {
  const contract = QWORK_MR1561_WORKER_ENVELOPE_LIMIT_CONTRACT;
  const head = 'e'.repeat(40);
  const fixtureMap = currentReleaseFileFixtures([contract], head);
  const files = [...fixtureMap].map(([filePath, payload]) => ({
    path: filePath,
    requested_ref: head,
    payload,
  }));
  const audit = (auditFiles) => auditCurrentReleaseSourceContract({
    releaseHead: head,
    targetBranch: contract.target_branch,
    originAncestry: {
      source: 'gitlab-api-compare-first-parent',
      compare_from: contract.merge_commit_sha,
      compare_to: head,
      compare_commit_count: 1,
      first_parent_complete: true,
      verified: true,
      reason: '',
    },
    files: auditFiles,
    mergeRequests: [],
    originAttestation: null,
    contract,
  });
  const verified = audit(files);
  assert.equal(verified.verified, true);
  assert.deepEqual(verified.failures, []);
  assert.equal(validateCurrentReleaseSourceContractAttestation(verified, {
    report: { release: { head }, merge_requests: [], source_contracts: [verified] },
    contract,
    contracts: [contract],
  }).ok, true);

  const forgeAttestedFile = (attestation, filePath, rewrite) => {
    const forged = structuredClone(attestation);
    const file = forged.protected_files.find((item) => item.path === filePath);
    assert.ok(file, filePath);
    const source = Buffer.from(file.content_base64, 'base64').toString('utf8');
    const rewritten = rewrite(source);
    assert.notEqual(rewritten, source, filePath);
    const bytes = Buffer.from(rewritten, 'utf8');
    file.content_base64 = bytes.toString('base64');
    file.declared_size = bytes.length;
    file.bytes = bytes.length;
    file.sha256 = sha256Text(rewritten);
    file.blob_id = gitBlobSha1(rewritten);
    file.line_count = rewritten.replace(/\n$/u, '').split('\n').length;
    delete forged.attestation_sha256;
    forged.attestation_sha256 = sha256Text(stableJson(forged));
    return forged;
  };
  const firstBinding = contract.integration_bindings[0];
  const forgedBindingBytes = forgeAttestedFile(
    verified,
    firstBinding.path,
    (source) => source.replace(`${firstBinding.addition.source}\n`, ''),
  );
  const forgedBindingValidation = validateCurrentReleaseSourceContractAttestation(forgedBindingBytes, {
    report: { release: { head }, merge_requests: [], source_contracts: [forgedBindingBytes] },
    contract,
    contracts: [contract],
  });
  assert.equal(forgedBindingValidation.ok, false);
  assert.equal(forgedBindingValidation.failures.includes(
    'attestation_current_integration_bindings_replay_mismatch',
  ), true, forgedBindingValidation.failures.join(','));

  const firstForbidden = contract.forbidden_fragments[0];
  const forgedForbiddenBytes = forgeAttestedFile(
    verified,
    firstForbidden.path,
    (source) => `${source}${firstForbidden.value.source}\n`,
  );
  const forgedForbiddenValidation = validateCurrentReleaseSourceContractAttestation(forgedForbiddenBytes, {
    report: { release: { head }, merge_requests: [], source_contracts: [forgedForbiddenBytes] },
    contract,
    contracts: [contract],
  });
  assert.equal(forgedForbiddenValidation.ok, false);
  assert.equal(forgedForbiddenValidation.failures.includes(
    'attestation_current_forbidden_fragments_replay_mismatch',
  ), true, forgedForbiddenValidation.failures.join(','));

  const rewriteFile = (filePath, from, to) => {
    const drifted = structuredClone(files);
    const file = drifted.find((item) => item.path === filePath);
    assert.ok(file, filePath);
    const source = Buffer.from(file.payload.content, 'base64').toString('utf8');
    const rewritten = source.replace(from, to);
    assert.notEqual(rewritten, source, from);
    file.payload.content = Buffer.from(rewritten, 'utf8').toString('base64');
    file.payload.size = Buffer.byteLength(rewritten, 'utf8');
    file.payload.blob_id = gitBlobSha1(rewritten);
    return drifted;
  };
  for (const scenario of [
    {
      binding: 'shared_worker_envelope_limit_32_mib',
      path: contract.source_file.path,
      replacement: 'const MAX_ENVELOPE_BYTES = 16 * 1024 * 1024;',
    },
    {
      binding: 'test_declares_shared_32_mib_envelope_limit',
      path: contract.changed_paths[1],
      replacement: "test('execution messages use an envelope limit', () => {",
    },
    {
      binding: 'test_asserts_execution_start_matches_shared_limit',
      path: contract.changed_paths[1],
      replacement: '  assert.notEqual(MAX_EXECUTION_START_ENVELOPE_BYTES, MAX_ENVELOPE_BYTES);',
    },
  ]) {
    const binding = contract.integration_bindings.find((item) => item.id === scenario.binding);
    const attestation = audit(rewriteFile(scenario.path, binding.addition.source, scenario.replacement));
    assert.equal(attestation.verified, false, scenario.binding);
    assert.equal(
      attestation.failures.includes(`current_integration_binding_mismatch:${scenario.binding}`),
      true,
      scenario.binding,
    );
  }

  const legacy = contract.forbidden_fragments.find((item) => (
    item.id === 'legacy_shared_worker_envelope_limit_256_kib'
  ));
  const protocolFile = files.find((item) => item.path === contract.source_file.path);
  const protocolSource = Buffer.from(protocolFile.payload.content, 'base64').toString('utf8');
  const withLegacy = `${protocolSource}${legacy.value.source}\n`;
  const legacyFiles = rewriteFile(contract.source_file.path, protocolSource, withLegacy);
  const legacyAttestation = audit(legacyFiles);
  assert.equal(legacyAttestation.verified, false);
  assert.equal(
    legacyAttestation.failures.includes('current_forbidden_fragment:legacy_shared_worker_envelope_limit_256_kib'),
    true,
  );
});

test('MR !1560 source contract freezes local turn-authority readiness declarations without attesting execution', () => {
  const contract = QWORK_MR1560_TURN_AUTHORITY_READINESS_CONTRACT;
  assert.equal(contract.contract_id, 'deepbankv2-mr-1560-turn-authority-readiness/v1');
  assert.equal(contract.merge_commit_sha, 'cebd32ba077e8708c0a5d241067bfb8b848f5b54');
  assert.equal(contract.contract_sha256, 'ceff1658513713f9cf6970ea85bfb23e257338fdd16446dce70bfe685e82d94e');
  assert.equal(contract.changes_count, 4);
  assert.deepEqual(contract.changed_paths, [
    'electron/host-core/agent/desktop-host-context.cjs',
    'electron/host-core/agent/turn-authority-readiness.cjs',
    'scripts/ci/unit/node-unit-test-weights.json',
    'test/unit/desktop/turn-authority-readiness.test.mjs',
  ]);
  assert.deepEqual(contract.mr_diff, {
    bytes: 4783,
    sha256: 'a3a98779ece45cf3335e26c7f18a0b0b5e3177741d91a73daaa756c44e8f3d52',
  });
  assert.deepEqual(
    [contract.source_file.change_bytes, contract.source_file.change_sha256],
    [886, '105c5f138f268bdde351d6e3f0eec378bbae3b444681038285f119f2bd4b5be8'],
  );
  assert.deepEqual(
    [contract.source_file.source_bytes, contract.source_file.source_line_count, contract.source_file.source_sha256],
    [629, 18, '520a26f968093a7c5ed40465fd1e0118dda2825325bbb1fb2aa12d05ad9c4aea'],
  );
  assert.equal(contract.source_file.proof_mode, 'exact-new-file');
  assert.equal(contract.claim_scope, QWORK_RELEASE_SOURCE_CLAIM_SCOPE);
  assert.equal(contract.test_execution_attested, false);

  const bindings = new Map(contract.integration_bindings.map((binding) => [binding.id, binding.addition.source]));
  assert.equal(bindings.get('readiness_default_timeout_10_seconds'), '  timeoutMs = 10_000,');
  assert.equal(bindings.get('readiness_default_interval_100_ms'), '  intervalMs = 100,');
  assert.equal(
    bindings.get('readiness_returns_ok_or_non_transient_error_immediately'),
    "    if (result?.ok || result?.code !== 'desktop_model_authority_not_ready') return result;",
  );
  assert.match(bindings.get('desktop_host_wraps_single_accept_authority_read'), /readReadyTurnAuthority.*currentTurnAuthorityForScope/u);
  assert.match(bindings.get('test_cold_start_ready_on_third_read'), /\+\+reads === 3/u);
  assert.equal(bindings.get('test_bounded_failure_timeout_250_ms'), '    timeoutMs: 250, now: () => elapsed,');
  assert.match(bindings.get('test_covers_scope_and_permanent_error_codes'), /desktop_local_context_superseded/u);
  assert.equal(contract.forbidden_fragments.some((item) => (
    item.id === 'desktop_host_direct_authority_read_without_readiness'
  )), true);
});

test('MR !1560 origin changes verify exactly and fail closed on readiness policy or test drift', () => {
  const contract = QWORK_MR1560_TURN_AUTHORITY_READINESS_CONTRACT;
  const changes = mr1560OriginChanges();
  const summary = summarizeGitLabChanges(changes);
  assert.deepEqual(
    { paths: summary.paths, bytes: summary.diff_bytes, sha256: summary.diff_sha256 },
    { paths: contract.changed_paths, bytes: contract.mr_diff.bytes, sha256: contract.mr_diff.sha256 },
  );
  const sourceChange = normalizeGitLabChanges(changes)
    .find((change) => change.new_path === contract.source_file.path);
  const source = reconstructGitLabNewFileSource(sourceChange);
  assert.equal(Buffer.byteLength(source, 'utf8'), contract.source_file.source_bytes);
  assert.equal(sha256Text(source), contract.source_file.source_sha256);

  const audit = (auditChanges) => auditReleaseSourceContract({
    iid: contract.mr_iid,
    state: contract.state,
    targetBranch: contract.target_branch,
    mergeCommitSha: contract.merge_commit_sha,
    changesCount: contract.changes_count,
    changes: auditChanges,
    contract,
  });
  const verified = audit(changes);
  assert.equal(verified.verified, true);
  assert.deepEqual(verified.failures, []);
  assert.equal(validateReleaseSourceContractAttestation(verified, { contract }).ok, true);

  const scenarios = [
    {
      name: 'local observation only declaration',
      binding: 'readiness_observes_lifecycle_projection_only',
      replacement: '// Refresh model authority before reading it.',
    },
    {
      name: 'ten second timeout',
      binding: 'readiness_default_timeout_10_seconds',
      replacement: '  timeoutMs = 20_000,',
    },
    {
      name: 'one hundred millisecond interval',
      binding: 'readiness_default_interval_100_ms',
      replacement: '  intervalMs = 250,',
    },
    {
      name: 'transient-code-only retry',
      binding: 'readiness_returns_ok_or_non_transient_error_immediately',
      replacement: '    if (result?.ok) return result;',
    },
    {
      name: 'single accept host wrapper',
      binding: 'desktop_host_wraps_single_accept_authority_read',
      replacement: '        async () => currentTurnAuthorityForScope(turnScope, userId, {',
      forbidden: 'forbidden_fragment:desktop_host_direct_authority_read_without_readiness',
    },
    {
      name: 'cold start third read',
      binding: 'test_cold_start_ready_on_third_read',
      replacement: '  assert.equal(await readReadyTurnAuthority(() => ++reads === 4 ? ready : pending, {',
    },
    {
      name: 'bounded 250 millisecond failure',
      binding: 'test_bounded_failure_timeout_250_ms',
      replacement: '    timeoutMs: 500, now: () => elapsed,',
    },
    {
      name: 'scope and permanent error coverage',
      binding: 'test_covers_scope_and_permanent_error_codes',
      replacement: "  for (const code of ['desktop_local_context_superseded']) {",
    },
  ];
  for (const scenario of scenarios) {
    const binding = contract.integration_bindings.find((item) => item.id === scenario.binding);
    assert.ok(binding, scenario.name);
    const drifted = structuredClone(changes);
    const change = drifted.find((item) => item.new_path === binding.path);
    assert.ok(change, scenario.name);
    change.diff = change.diff.replace(binding.addition.source, scenario.replacement);
    const attestation = audit(drifted);
    assert.equal(attestation.verified, false, scenario.name);
    assert.equal(attestation.failures.includes('mr_diff_sha256_mismatch'), true, scenario.name);
    assert.equal(
      attestation.failures.includes(`integration_binding_mismatch:${scenario.binding}`),
      true,
      scenario.name,
    );
    if (scenario.forbidden) assert.equal(attestation.failures.includes(scenario.forbidden), true, scenario.name);
  }
});

test('MR !1560 current-release persistence requires every readiness binding and rejects forbidden behavior', () => {
  const contract = QWORK_MR1560_TURN_AUTHORITY_READINESS_CONTRACT;
  const head = 'f'.repeat(40);
  const fixtureMap = currentReleaseFileFixtures([contract], head);
  const files = [...fixtureMap].map(([filePath, payload]) => ({
    path: filePath,
    requested_ref: head,
    payload,
  }));
  const audit = (auditFiles) => auditCurrentReleaseSourceContract({
    releaseHead: head,
    targetBranch: contract.target_branch,
    originAncestry: {
      source: 'gitlab-api-compare-first-parent',
      compare_from: contract.merge_commit_sha,
      compare_to: head,
      compare_commit_count: 0,
      first_parent_complete: true,
      verified: true,
      reason: '',
    },
    files: auditFiles,
    mergeRequests: [],
    originAttestation: null,
    contract,
  });
  const verified = audit(files);
  assert.equal(verified.verified, true);
  assert.deepEqual(verified.failures, []);
  assert.equal(validateCurrentReleaseSourceContractAttestation(verified, {
    report: { release: { head }, merge_requests: [], source_contracts: [verified] },
    contract,
    contracts: [contract],
  }).ok, true);

  const rewriteFile = (inputFiles, filePath, rewrite) => {
    const drifted = structuredClone(inputFiles);
    const file = drifted.find((item) => item.path === filePath);
    assert.ok(file, filePath);
    const source = Buffer.from(file.payload.content, 'base64').toString('utf8');
    const rewritten = rewrite(source);
    assert.notEqual(rewritten, source, filePath);
    file.payload.content = Buffer.from(rewritten, 'utf8').toString('base64');
    file.payload.size = Buffer.byteLength(rewritten, 'utf8');
    file.payload.blob_id = gitBlobSha1(rewritten);
    return drifted;
  };
  for (const binding of contract.integration_bindings) {
    const removedFiles = rewriteFile(files, binding.path, (source) => (
      source.replace(`${binding.addition.source}\n`, '')
    ));
    const attestation = audit(removedFiles);
    assert.equal(attestation.verified, false, binding.id);
    assert.equal(
      attestation.failures.includes(`current_integration_binding_mismatch:${binding.id}`),
      true,
      binding.id,
    );
  }
  for (const forbidden of contract.forbidden_fragments) {
    const forbiddenFiles = rewriteFile(files, forbidden.path, (source) => `${source}${forbidden.value.source}\n`);
    const attestation = audit(forbiddenFiles);
    assert.equal(attestation.verified, false, forbidden.id);
    assert.equal(
      attestation.failures.includes(`current_forbidden_fragment:${forbidden.id}`),
      true,
      forbidden.id,
    );
  }
});

test('new release source contracts audit synthetic equivalents and reject source or old-behavior restoration', () => {
  for (const contract of [
    QWORK_MR1540_MEMORY_FEATURE_PROFILE_CONTRACT,
    QWORK_MR1546_REJECTED_REGENERATE_CONTRACT,
    QWORK_MR1550_CLAUDE_SKILL_DESCRIPTION_ROUTING_CONTRACT,
    QWORK_MR1558_SETTINGS_MODEL_NAME_DEDUP_CONTRACT,
    QWORK_MR1590_QBOT_EXPERT_CLOUD_INSTALLATION_CONTRACT,
    QWORK_MR1593_QBOT_ADDITIVE_RESPONSE_COMPATIBILITY_CONTRACT,
    QWORK_MR1596_ANONYMOUS_STABLE_RUNTIME_DISCOVERY_CONTRACT,
    QWORK_MR1597_WORKER_IM_USER_IDENTITY_FORWARDING_CONTRACT,
    QWORK_MR1561_WORKER_ENVELOPE_LIMIT_CONTRACT,
    QWORK_MR1560_TURN_AUTHORITY_READINESS_CONTRACT,
  ]) {
    const fixture = contract.source_file.proof_mode === 'exact-new-file'
      ? exactNewFileContractFixture(contract)
      : exactAddedLinesContractFixture(contract);
    assert.equal(auditFixture(fixture).verified, true, contract.contract_id);

    const sourceTampered = structuredClone(fixture.changes);
    const sourceChange = sourceTampered.find((change) => change.new_path === contract.source_file.path);
    sourceChange.diff = sourceChange.diff.replace('+', '+tampered-');
    const sourceAudit = auditFixture(fixture, { changes: sourceTampered });
    assert.equal(sourceAudit.verified, false, contract.contract_id);
    assert.equal(sourceAudit.failures.includes('mr_diff_sha256_mismatch'), true, contract.contract_id);
    assert.equal(sourceAudit.failures.includes('source_source_sha256_mismatch'), true, contract.contract_id);

    const testBinding = contract.integration_bindings.find((binding) => binding.path.startsWith('test/'));
    const testTampered = structuredClone(fixture.changes);
    const testChange = testTampered.find((change) => change.new_path === testBinding.path);
    testChange.diff = testChange.diff.replace(testBinding.addition.source, `${testBinding.addition.source} // forged`);
    const testAudit = auditFixture(fixture, { changes: testTampered });
    assert.equal(testAudit.verified, false, contract.contract_id);
    assert.equal(
      testAudit.failures.includes(`integration_binding_mismatch:${testBinding.id}`),
      true,
      contract.contract_id,
    );

    const forbidden = contract.forbidden_fragments?.[0];
    if (forbidden) {
      const restored = structuredClone(fixture.changes);
      const target = restored.find((change) => change.new_path === forbidden.path);
      const addedLine = target.diff.split('\n').find((line) => line.startsWith('+') && !line.startsWith('+++'));
      target.diff = target.diff.replace(addedLine, `+${forbidden.value.source}`);
      const restoredAudit = auditFixture(fixture, { changes: restored });
      assert.equal(
        restoredAudit.failures.includes(`forbidden_fragment:${forbidden.id}`),
        true,
        contract.contract_id,
      );
    }
  }
});

test('MR !1558 origin changes fail closed on helper, settings wiring, or test declaration drift', () => {
  const contract = QWORK_MR1558_SETTINGS_MODEL_NAME_DEDUP_CONTRACT;
  const scenarios = [
    {
      binding: 'dedupe_normalizes_display_name',
      replacement: "    const name = String(option.modelId || '').trim().toLocaleLowerCase();",
    },
    {
      binding: 'dedupe_rejects_empty_or_seen_name',
      replacement: '    if (!name) return false;',
    },
    {
      binding: 'settings_dedupes_before_grouping',
      replacement: '  const availableModelGroups = buildModelDisplayGroups(visibleModelOptions);',
    },
    {
      binding: 'test_declares_settings_name_dedup_contract',
      replacement: "test('settings available models list protocol variants', () => {",
    },
  ];
  for (const scenario of scenarios) {
    const fixture = exactAddedLinesContractFixture(contract);
    const binding = fixture.contract.integration_bindings.find((item) => item.id === scenario.binding);
    assert.ok(binding, scenario.binding);
    const changes = structuredClone(fixture.changes);
    const target = changes.find((change) => change.new_path === binding.path);
    assert.ok(target, scenario.binding);
    target.diff = target.diff.replace(binding.addition.source, scenario.replacement);
    const attestation = auditFixture(fixture, { changes });
    assert.equal(attestation.verified, false, scenario.binding);
    assert.equal(
      attestation.failures.includes(`integration_binding_mismatch:${scenario.binding}`),
      true,
      scenario.binding,
    );
  }
});

test('MR !1595 retires only the deleted !1558 test assertions while product bindings remain exact', () => {
  const contract = QWORK_MR1558_SETTINGS_MODEL_NAME_DEDUP_CONTRACT;
  const retirement = QWORK_MR1595_OBSOLETE_TEST_RETIREMENT_CONTRACT;
  const contracts = [contract, retirement];
  const head = 'e'.repeat(40);
  const ancestryByContractId = new Map(contracts.map((item) => [item.contract_id, {
    verified: true,
    first_parent_complete: true,
  }]));
  const resolution = resolveCurrentReleaseHeaderContract(contract, {
    contracts,
    ancestryByContractId,
  });
  assert.equal(resolution.owner.contract_id, retirement.contract_id);
  assert.deepEqual(resolution.lineage, [contract.contract_id, retirement.contract_id]);
  assert.deepEqual(currentReleaseSourceContractProtectedPaths(contract, resolution.owner), [
    'src/composer-model-display-groups.ts',
    'src/AssistantConfig.tsx',
  ]);

  const fixtureMap = currentReleaseFileFixtures(contracts, head);
  const files = [...fixtureMap].map(([filePath, payload]) => ({
    path: filePath,
    requested_ref: head,
    payload,
  }));
  const audit = (auditFiles, owner = resolution.owner, lineage = resolution.lineage) => auditCurrentReleaseSourceContract({
    releaseHead: head,
    targetBranch: contract.target_branch,
    originAncestry: {
      source: 'gitlab-api-compare-first-parent',
      compare_from: contract.merge_commit_sha,
      compare_to: head,
      compare_commit_count: 1,
      first_parent_complete: true,
      verified: true,
      reason: '',
    },
    files: auditFiles,
    mergeRequests: [],
    originAttestation: null,
    contract,
    currentHeaderContract: owner,
    currentHeaderLineage: lineage,
  });
  const verified = audit(files);
  assert.equal(verified.verified, true);
  const retiredBindings = verified.integration_bindings.filter((binding) => binding.retired === true);
  assert.deepEqual(retiredBindings.map((binding) => binding.id), [
    'test_reads_model_group_source',
    'test_declares_settings_name_dedup_contract',
    'test_asserts_normalized_display_name',
    'test_asserts_empty_and_duplicate_rejection',
    'test_asserts_settings_dedupe_integration',
  ]);
  assert.equal(retiredBindings.every((binding) => (
    binding.verified === true
      && binding.retirement.contract_id === retirement.contract_id
      && binding.retirement.path === 'test/unit/config/settings-ui-surface-contract.test.mjs'
  )), true);
  assert.equal(
    verified.protected_files.some((file) => file.path === 'test/unit/config/settings-ui-surface-contract.test.mjs'),
    false,
  );

  const productBindings = contract.integration_bindings.filter((binding) => !binding.path.startsWith('test/'));
  assert.equal(productBindings.length, 7);
  for (const binding of productBindings) {
    const duplicatedFiles = structuredClone(files);
    const target = duplicatedFiles.find((file) => file.path === binding.path);
    assert.ok(target, binding.id);
    const source = Buffer.from(target.payload.content, 'base64').toString('utf8');
    const duplicated = `${source}${binding.addition.source}\n`;
    target.payload.content = Buffer.from(duplicated, 'utf8').toString('base64');
    target.payload.size = Buffer.byteLength(duplicated, 'utf8');
    target.payload.blob_id = gitBlobSha1(duplicated);
    const attestation = audit(duplicatedFiles);
    assert.equal(attestation.verified, false, binding.id);
    assert.equal(
      attestation.failures.includes(`current_integration_binding_mismatch:${binding.id}`),
      true,
      binding.id,
    );
    assert.equal(
      attestation.integration_bindings.find((item) => item.id === binding.id)?.occurrence_count,
      2,
      binding.id,
    );
  }

  const removedFiles = structuredClone(files);
  const removedBinding = productBindings.find((binding) => binding.id === 'settings_dedupes_before_grouping');
  const removedTarget = removedFiles.find((file) => file.path === removedBinding.path);
  const originalSource = Buffer.from(removedTarget.payload.content, 'base64').toString('utf8');
  const sourceWithoutBinding = replaceRequired(
    originalSource,
    `${removedBinding.addition.source}\n`,
    '',
    removedBinding.id,
  );
  removedTarget.payload.content = Buffer.from(sourceWithoutBinding, 'utf8').toString('base64');
  removedTarget.payload.size = Buffer.byteLength(sourceWithoutBinding, 'utf8');
  removedTarget.payload.blob_id = gitBlobSha1(sourceWithoutBinding);
  const removedAudit = audit(removedFiles);
  assert.equal(removedAudit.verified, false);
  assert.equal(
    removedAudit.failures.includes(`current_integration_binding_mismatch:${removedBinding.id}`),
    true,
  );

  const unprovenResolution = resolveCurrentReleaseHeaderContract(contract, {
    contracts,
    ancestryByContractId: new Map([
      [contract.contract_id, { verified: true, first_parent_complete: true }],
      [retirement.contract_id, { verified: false, first_parent_complete: false }],
    ]),
  });
  assert.equal(unprovenResolution.owner.contract_id, contract.contract_id);
  assert.deepEqual(currentReleaseSourceContractProtectedPaths(contract, unprovenResolution.owner), [
    'src/composer-model-display-groups.ts',
    'src/AssistantConfig.tsx',
    'test/unit/config/settings-ui-surface-contract.test.mjs',
  ]);
  const unprovenAncestry = new Map([
    [contract.contract_id, { verified: true, first_parent_complete: true }],
    [retirement.contract_id, { verified: false, first_parent_complete: false }],
  ]);
  const unprovenFiles = [...currentReleaseFileFixtures(contracts, head, {
    ancestryByContractId: unprovenAncestry,
  })].map(([filePath, payload]) => ({ path: filePath, requested_ref: head, payload }));
  assert.equal(unprovenFiles.some((file) => (
    file.path === 'test/unit/config/settings-ui-surface-contract.test.mjs'
  )), true);
  const unproven = audit(unprovenFiles, unprovenResolution.owner, unprovenResolution.lineage);
  assert.equal(unproven.verified, true, JSON.stringify(unproven.failures));
  const missingHistoricalTest = audit(
    unprovenFiles.filter((file) => file.path !== 'test/unit/config/settings-ui-surface-contract.test.mjs'),
    unprovenResolution.owner,
    unprovenResolution.lineage,
  );
  assert.equal(missingHistoricalTest.verified, false);
  assert.equal(
    missingHistoricalTest.failures.includes('release_file:test/unit/config/settings-ui-surface-contract.test.mjs:count:0'),
    true,
  );
});

test('MR !1595 origin changes require the exact deleted path, flags, IID, and merge SHA', () => {
  const fixture = assertionRetirementContractFixture(QWORK_MR1595_OBSOLETE_TEST_RETIREMENT_CONTRACT);
  const audit = (overrides = {}) => auditReleaseSourceContract({
    iid: fixture.contract.mr_iid,
    state: fixture.contract.state,
    targetBranch: fixture.contract.target_branch,
    mergeCommitSha: fixture.contract.merge_commit_sha,
    changesCount: fixture.contract.changes_count,
    changes: fixture.changes,
    contract: fixture.contract,
    ...overrides,
  });
  const verified = audit();
  assert.equal(verified.verified, true);
  assert.equal(validateReleaseSourceContractAttestation(verified, {
    mr: {
      iid: fixture.contract.mr_iid,
      commit: fixture.contract.merge_commit_sha,
      diff_sha256: fixture.contract.mr_diff.sha256,
      diff_bytes: fixture.contract.mr_diff.bytes,
      changed_paths: fixture.contract.changed_paths,
    },
    contract: fixture.contract,
  }).ok, true);

  const wrongIid = audit({ iid: '1594' });
  assert.equal(wrongIid.failures.includes('mr_iid_mismatch'), true);
  const wrongSha = audit({ mergeCommitSha: 'f'.repeat(40) });
  assert.equal(wrongSha.failures.includes('mr_merge_commit_sha_mismatch'), true);

  const wrongFlags = structuredClone(fixture.changes);
  const deleted = wrongFlags.find((change) => change.deleted_file === true);
  deleted.deleted_file = false;
  const flagAudit = audit({ changes: wrongFlags });
  assert.equal(
    flagAudit.failures.includes(`retired_file_deleted_file_mismatch:${deleted.new_path}`),
    true,
  );

  const wrongPath = structuredClone(fixture.changes);
  const moved = wrongPath.find((change) => change.deleted_file === true);
  moved.old_path = 'test/unit/config/other-obsolete-contract.test.mjs';
  moved.new_path = moved.old_path;
  const pathAudit = audit({ changes: wrongPath });
  assert.equal(
    pathAudit.failures.includes('retired_file_count:test/unit/config/settings-ui-surface-contract.test.mjs:0'),
    true,
  );
});

test('MR !1595 retirement definition cannot retire a product binding', () => {
  const targetDefinition = {
    ...structuredClone(QWORK_MR1558_SETTINGS_MODEL_NAME_DEDUP_CONTRACT),
    contract_id: 'fixture-mr-9558-settings-model-name-dedup/v1',
    mr_iid: '9558',
    merge_commit_sha: 'a'.repeat(40),
  };
  delete targetDefinition.contract_sha256;
  const target = {
    ...targetDefinition,
    contract_sha256: sha256Text(stableJson(targetDefinition)),
  };
  const retirementDefinition = {
    ...structuredClone(QWORK_MR1595_OBSOLETE_TEST_RETIREMENT_CONTRACT),
    contract_id: 'fixture-mr-9595-obsolete-test-retirement/v1',
    mr_iid: '9595',
    merge_commit_sha: 'b'.repeat(40),
    supersedes: [{
      contract_id: target.contract_id,
      disposition: 'retired',
      current_assertions: ['integration_binding:settings_dedupes_before_grouping'],
    }],
  };
  delete retirementDefinition.contract_sha256;
  const retirement = {
    ...retirementDefinition,
    contract_sha256: sha256Text(stableJson(retirementDefinition)),
  };
  assert.throws(
    () => resolveReleaseSourceContracts([target, retirement]),
    /source_contract_retirement_product_assertion/u,
  );
});

test('MR !1595 current-release projection and in-range accounting are independently fail closed', () => {
  const contract = QWORK_MR1595_OBSOLETE_TEST_RETIREMENT_CONTRACT;
  const head = 'c'.repeat(40);
  const originAttestation = expectedRetirementOriginAttestation(contract);
  const mr = {
    iid: contract.mr_iid,
    commit: contract.merge_commit_sha,
    diff_sha256: contract.mr_diff.sha256,
    diff_bytes: contract.mr_diff.bytes,
    changed_paths: contract.changed_paths,
  };
  const current = auditCurrentReleaseSourceContract({
    releaseHead: head,
    targetBranch: contract.target_branch,
    originAncestry: {
      source: 'gitlab-api-compare-first-parent',
      compare_from: contract.merge_commit_sha,
      compare_to: head,
      compare_commit_count: 1,
      first_parent_complete: true,
      verified: true,
      reason: '',
    },
    files: [],
    mergeRequests: [mr],
    originAttestation,
    contract,
  });
  assert.equal(current.verified, true);
  const report = {
    release: { head },
    merge_requests: [mr],
    commit_accounting: [{
      commit: contract.merge_commit_sha,
      parent_count: 2,
      classification: 'merge_mr',
      mr_iid: contract.mr_iid,
      attribution_verified: true,
      reason: '',
    }],
    source_contracts: [current],
  };
  assert.equal(validateCurrentReleaseSourceContractAttestation(current, { report, contract }).ok, true);

  const forgedAccounting = structuredClone(report);
  forgedAccounting.commit_accounting[0].parent_count = 1;
  const accountingValidation = validateCurrentReleaseSourceContractAttestation(current, {
    report: forgedAccounting,
    contract,
  });
  assert.equal(accountingValidation.ok, false);
  assert.equal(accountingValidation.failures.includes('attestation_retirement_commit_accounting_mismatch'), true);

  const wrongMr = structuredClone(report);
  wrongMr.merge_requests[0].iid = '1594';
  wrongMr.merge_requests[0].commit = 'd'.repeat(40);
  const identityValidation = validateCurrentReleaseSourceContractAttestation(current, {
    report: wrongMr,
    contract,
  });
  assert.equal(identityValidation.ok, false);
  assert.equal(identityValidation.failures.includes('attestation_trigger_projection_mismatch'), true);
});

test('MR !1595 retired-owner forgery remains blocked after the attestation hash is recomputed', () => {
  const origin = QWORK_MR1558_SETTINGS_MODEL_NAME_DEDUP_CONTRACT;
  const retirement = QWORK_MR1595_OBSOLETE_TEST_RETIREMENT_CONTRACT;
  const contracts = [origin, retirement];
  const head = 'd'.repeat(40);
  const ancestryByContractId = new Map(contracts.map((contract) => [contract.contract_id, {
    verified: true,
    first_parent_complete: true,
  }]));
  const resolution = resolveCurrentReleaseHeaderContract(origin, { contracts, ancestryByContractId });
  const fixtureMap = currentReleaseFileFixtures(contracts, head);
  const files = [...fixtureMap].map(([filePath, payload]) => ({ path: filePath, requested_ref: head, payload }));
  const originCurrent = auditCurrentReleaseSourceContract({
    releaseHead: head,
    targetBranch: origin.target_branch,
    originAncestry: {
      source: 'gitlab-api-compare-first-parent',
      compare_from: origin.merge_commit_sha,
      compare_to: head,
      compare_commit_count: 2,
      first_parent_complete: true,
      verified: true,
      reason: '',
    },
    files,
    contract: origin,
    currentHeaderContract: resolution.owner,
    currentHeaderLineage: resolution.lineage,
  });
  const retirementCurrent = auditCurrentReleaseSourceContract({
    releaseHead: head,
    targetBranch: retirement.target_branch,
    originAncestry: {
      source: 'gitlab-api-compare-first-parent',
      compare_from: retirement.merge_commit_sha,
      compare_to: head,
      compare_commit_count: 1,
      first_parent_complete: true,
      verified: true,
      reason: '',
    },
    files: [],
    contract: retirement,
  });
  assert.equal(originCurrent.verified, true);
  assert.equal(retirementCurrent.verified, true);
  const report = {
    release: { head },
    merge_requests: [],
    commit_accounting: [],
    source_contracts: [originCurrent, retirementCurrent],
  };
  assert.equal(validateCurrentReleaseSourceContractAttestation(originCurrent, {
    report,
    contract: origin,
    contracts,
  }).ok, true);

  const forged = structuredClone(originCurrent);
  const owner = forged.current_assertion_owners.integration_bindings
    .find((item) => item.id === 'test_reads_model_group_source');
  owner.contract_id = origin.contract_id;
  owner.contract_sha256 = origin.contract_sha256;
  owner.lineage = [origin.contract_id];
  delete owner.retired;
  delete owner.retirement;
  delete forged.attestation_sha256;
  forged.attestation_sha256 = sha256Text(stableJson(forged));
  const forgedReport = { ...report, source_contracts: [forged, retirementCurrent] };
  const validation = validateCurrentReleaseSourceContractAttestation(forged, {
    report: forgedReport,
    contract: origin,
    contracts,
  });
  assert.equal(validation.ok, false);
  assert.equal(validation.failures.includes('attestation_current_assertion_owners_mismatch'), true);
});

test('source contracts and attestations cannot claim that declared tests were executed', () => {
  for (const contract of QWORK_RELEASE_SOURCE_CONTRACTS) {
    assert.equal(contract.claim_scope, 'source_and_test_declarations');
    assert.equal(contract.test_execution_attested, false);
  }
  const forgedDefinition = structuredClone(QWORK_MR1540_MEMORY_FEATURE_PROFILE_CONTRACT);
  forgedDefinition.test_execution_attested = true;
  delete forgedDefinition.contract_sha256;
  forgedDefinition.contract_sha256 = sha256Text(stableJson(forgedDefinition));
  assert.throws(
    () => resolveReleaseSourceContracts([forgedDefinition]),
    /source_contract_test_execution_attested_invalid/u,
  );

  const report = mr1522Report();
  report.source_contracts[0].test_execution_attested = true;
  const attestationValue = structuredClone(report.source_contracts[0]);
  delete attestationValue.attestation_sha256;
  report.source_contracts[0].attestation_sha256 = sha256Text(stableJson(attestationValue));
  const validation = validateReleaseSourceContractsForReport(report);
  assert.equal(validation.ok, false);
  assert.equal(validation.failures.some((failure) => failure.includes('attestation_test_execution_attested_invalid')), true);
});

test('source contract blocks merge SHA and full MR diff drift', () => {
  const fixture = sourceContractFixture();
  const wrongMerge = auditFixture(fixture, { mergeCommitSha: '9'.repeat(40) });
  assert.equal(wrongMerge.verified, false);
  assert.equal(wrongMerge.failures.includes('mr_merge_commit_sha_mismatch'), true);

  const changes = structuredClone(fixture.changes);
  changes[0].diff = changes[0].diff.replace(' context', ' changed-context');
  const wrongDiff = auditFixture(fixture, { changes });
  assert.equal(wrongDiff.verified, false);
  assert.equal(wrongDiff.failures.includes('mr_diff_sha256_mismatch'), true);
  assert.equal(wrongDiff.failures.includes('mr_diff_bytes_mismatch'), true);
});

test('source contract blocks reconstructed source byte drift', () => {
  const fixture = sourceContractFixture();
  const changes = structuredClone(fixture.changes);
  const sourceChange = changes.find((change) => change.new_file);
  sourceChange.diff = sourceChange.diff.replace('+export { lines };', '+export { lines, extra };');
  const attestation = auditFixture(fixture, { changes });
  assert.equal(attestation.verified, false);
  assert.equal(attestation.failures.includes('source_source_sha256_mismatch'), true);
  assert.equal(attestation.failures.includes('source_source_bytes_mismatch'), true);
});

for (const scenario of [
  {
    name: 'Header wire name',
    mutate: (diff) => diff.replace("'x-turn-id', turnId", "'x-turn-key', turnId"),
  },
  {
    name: 'Header value source',
    mutate: (diff) => diff.replace("'x-turn-id', turnId", "'x-turn-id', sessionId"),
  },
]) {
  test(`source contract blocks ${scenario.name} drift`, () => {
    const fixture = sourceContractFixture();
    const changes = structuredClone(fixture.changes);
    const sourceChange = changes.find((change) => change.new_file);
    sourceChange.diff = scenario.mutate(sourceChange.diff);
    const attestation = auditFixture(fixture, { changes });
    assert.equal(attestation.verified, false);
    assert.equal(attestation.failures.includes('header_source_mismatch:x-turn-id'), true);
  });
}

for (const scenario of [
  { name: 'host turnId', changeIndex: 0, from: 'currentTurnId', to: 'staleTurnId', binding: 'host_turn' },
  { name: 'engine Header injection', changeIndex: 1, from: 'withTurnHeaders', to: 'withoutTurnHeaders', binding: 'engine_env' },
  { name: 'fallback turnId', changeIndex: 1, from: 'agentSessionId: null }, turnId', to: 'agentSessionId: null }, staleTurnId', binding: 'fallback_turn' },
  { name: 'fallback request context', changeIndex: 1, from: 'turnRequestContext: requestContext', to: 'turnRequestContext: null', binding: 'fallback_context' },
]) {
  test(`source contract blocks ${scenario.name} integration wiring drift`, () => {
    const fixture = sourceContractFixture();
    const changes = structuredClone(fixture.changes);
    changes[scenario.changeIndex].diff = changes[scenario.changeIndex].diff.replace(scenario.from, scenario.to);
    const attestation = auditFixture(fixture, { changes });
    assert.equal(attestation.verified, false);
    assert.equal(attestation.failures.includes(`integration_binding_mismatch:${scenario.binding}`), true);
  });
}

test('MR !1522 report requires one exact attestation and bidirectional MR binding', () => {
  const report = mr1522Report();
  assert.equal(validateReleaseSourceContractsForReport(report).ok, true);

  const missing = structuredClone(report);
  missing.source_contracts = [];
  missing.summary.source_contract_count = 0;
  missing.summary.source_contract_verified_count = 0;
  const missingValidation = validateReleaseSourceContractsForReport(missing);
  assert.equal(missingValidation.ok, false);
  assert.equal(missingValidation.failures.some((failure) => failure.includes('source_contract_attestation_count')), true);

  const forged = structuredClone(report);
  forged.source_contracts[0].headers[0].value_source = 'forgedUserAgent';
  const forgedValue = structuredClone(forged.source_contracts[0]);
  delete forgedValue.attestation_sha256;
  forged.source_contracts[0].attestation_sha256 = sha256Text(stableJson(forgedValue));
  const forgedValidation = validateReleaseSourceContractsForReport(forged);
  assert.equal(forgedValidation.ok, false);
  assert.equal(forgedValidation.failures.some((failure) => failure.includes('attestation_not_exact_verified_projection')), true);
});

test('source contract report rejects unrelated bindings, summary drift, and forged unresolved state', () => {
  const unrelated = mr1522Report();
  unrelated.merge_requests.push({ iid: '9999', source_contract_ids: [QWORK_MR1522_CLAUDE_TURN_HEADERS_CONTRACT.contract_id] });
  const unrelatedValidation = validateReleaseSourceContractsForReport(unrelated);
  assert.equal(unrelatedValidation.ok, false);
  assert.equal(unrelatedValidation.failures.some((failure) => failure.includes('source_contract_mr_binding_wrong_mr')), true);

  const summaryDrift = mr1522Report();
  summaryDrift.summary.source_contract_verified_count = 0;
  summaryDrift.summary.source_contract_failure_count = 1;
  assert.equal(validateReleaseSourceContractsForReport(summaryDrift).ok, false);

  const unresolvedDrift = mr1522Report();
  unresolvedDrift.unresolved.source_contract_failures = ['forged:pass'];
  unresolvedDrift.summary.source_contract_failure_count = 1;
  const unresolvedValidation = validateReleaseSourceContractsForReport(unresolvedDrift);
  assert.equal(unresolvedValidation.ok, false);
  assert.equal(unresolvedValidation.failures.includes('source_contract_unresolved_mismatch'), true);
});

test('source contract registry always retains immutable built-ins and appends custom contracts', () => {
  const fixture = sourceContractFixture();
  assert.deepEqual(resolveReleaseSourceContracts([]), QWORK_RELEASE_SOURCE_CONTRACTS);
  assert.deepEqual(
    resolveReleaseSourceContracts([fixture.contract]),
    [...QWORK_RELEASE_SOURCE_CONTRACTS, fixture.contract],
  );
  assert.throws(
    () => resolveReleaseSourceContracts([
      ...QWORK_RELEASE_SOURCE_CONTRACTS,
      { ...QWORK_MR1522_CLAUDE_TURN_HEADERS_CONTRACT, mr_iid: '9999' },
    ]),
    /source_contract_registry_duplicate_id/u,
  );
  assert.deepEqual(
    resolveReleaseSourceContracts([...QWORK_RELEASE_SOURCE_CONTRACTS, fixture.contract]),
    [...QWORK_RELEASE_SOURCE_CONTRACTS, fixture.contract],
  );
  const validation = validateReleaseSourceContractsForReport(mr1522Report(), []);
  assert.equal(validation.ok, true);
});

test('source contract trigger requires exact IID or merge SHA and never binds by protected path alone', () => {
  const contract = QWORK_MR1522_CLAUDE_TURN_HEADERS_CONTRACT;
  const protectedPath = releaseSourceContractProtectedPaths(contract)[0];
  const unrelated = releaseSourceContractTrigger({
    iid: '1532',
    commit: 'f'.repeat(40),
    changed_paths: [protectedPath],
  }, contract);
  assert.equal(unrelated.triggered, false);
  assert.deepEqual(unrelated.protected_paths, [protectedPath]);
  assert.equal(releaseSourceContractTrigger({ iid: contract.mr_iid }, contract).triggered, true);
  assert.equal(releaseSourceContractTrigger({ commit: contract.merge_commit_sha }, contract).triggered, true);
});

test('current Header ownership transfers from !1522 to proven !1544 ancestry only', () => {
  const base = QWORK_MR1522_CLAUDE_TURN_HEADERS_CONTRACT;
  const successor = QWORK_MR1544_CLAUDE_TURN_HEADER_BRANDING_CONTRACT;
  const proven = resolveCurrentReleaseHeaderContract(base, {
    ancestryByContractId: new Map([[successor.contract_id, {
      verified: true,
      first_parent_complete: true,
    }]]),
  });
  assert.equal(proven.owner.contract_id, successor.contract_id);
  assert.deepEqual(proven.lineage, [base.contract_id, successor.contract_id]);

  const unproven = resolveCurrentReleaseHeaderContract(base, {
    ancestryByContractId: new Map([[successor.contract_id, {
      verified: false,
      first_parent_complete: false,
    }]]),
  });
  assert.equal(unproven.owner.contract_id, base.contract_id);
  assert.deepEqual(unproven.lineage, [base.contract_id]);
});

test('current release audit keeps !1522 integration ownership while enforcing !1544 Headers', () => {
  const base = QWORK_MR1522_CLAUDE_TURN_HEADERS_CONTRACT;
  const successor = QWORK_MR1544_CLAUDE_TURN_HEADER_BRANDING_CONTRACT;
  const head = 'e'.repeat(40);
  const fixtureMap = currentReleaseFileFixtures([base, successor], head);
  const files = [...fixtureMap].map(([filePath, payload]) => ({
    path: filePath,
    requested_ref: head,
    payload,
  }));
  const audit = (overrides = {}) => auditCurrentReleaseSourceContract({
    releaseHead: head,
    targetBranch: 'release/0.1',
    originAncestry: {
      source: 'gitlab-api-compare-first-parent',
      compare_from: base.merge_commit_sha,
      compare_to: head,
      compare_commit_count: 2,
      first_parent_complete: true,
      verified: true,
      reason: '',
    },
    files,
    mergeRequests: [],
    originAttestation: null,
    contract: base,
    currentHeaderContract: successor,
    currentHeaderLineage: [base.contract_id, successor.contract_id],
    ...overrides,
  });
  const verified = audit();
  assert.equal(verified.verified, true);
  assert.deepEqual(verified.headers.map((item) => item.wire_name), successor.header_emissions.map((item) => item.wire_name));
  assert.deepEqual(verified.integration_bindings.map((item) => item.id), base.integration_bindings.map((item) => item.id));

  const driftedFiles = structuredClone(files);
  const sourceFile = driftedFiles.find((file) => file.path === base.source_file.path);
  const source = Buffer.from(sourceFile.payload.content, 'base64').toString('utf8');
  const forbidden = successor.forbidden_fragments[0].value.source;
  const driftedSource = `${source}${forbidden}\n`;
  sourceFile.payload.content = Buffer.from(driftedSource, 'utf8').toString('base64');
  sourceFile.payload.size = Buffer.byteLength(driftedSource, 'utf8');
  sourceFile.payload.blob_id = gitBlobSha1(driftedSource);
  const drifted = audit({ files: driftedFiles });
  assert.equal(drifted.verified, false);
  assert.equal(drifted.failures.includes(`current_forbidden_fragment:${successor.forbidden_fragments[0].id}`), true);

  const headerDriftFiles = structuredClone(files);
  const headerSourceFile = headerDriftFiles.find((file) => file.path === base.source_file.path);
  const headerSource = Buffer.from(headerSourceFile.payload.content, 'base64').toString('utf8');
  const expectedEmission = successor.header_emissions.find((item) => item.name === 'x-qwork-turn-id').emission.source;
  const headerDriftSource = headerSource.replace(expectedEmission, expectedEmission.replace('x-qwork-turn-id', 'x-turn-id'));
  headerSourceFile.payload.content = Buffer.from(headerDriftSource, 'utf8').toString('base64');
  headerSourceFile.payload.size = Buffer.byteLength(headerDriftSource, 'utf8');
  headerSourceFile.payload.blob_id = gitBlobSha1(headerDriftSource);
  const headerDrift = audit({ files: headerDriftFiles });
  assert.equal(headerDrift.verified, false);
  assert.equal(headerDrift.failures.includes('current_header_source_mismatch:x-qwork-turn-id'), true);
});

test('MR !1540 current release continuity scopes repeated test assertions to unique owners', () => {
  const contract = QWORK_MR1540_MEMORY_FEATURE_PROFILE_CONTRACT;
  const scopedBindings = contract.integration_bindings.filter((item) => item.current_release_scope);
  assert.deepEqual(scopedBindings.map((item) => item.id), [
    'feature_check_body_absent_test',
    'test_profile_report_exact_body',
  ]);
  const head = 'e'.repeat(40);
  const fixtureMap = currentReleaseFileFixtures([contract], head);
  const files = [...fixtureMap].map(([filePath, payload]) => ({
    path: filePath,
    requested_ref: head,
    payload,
  }));
  const rewriteBindingFile = (inputFiles, binding, rewrite) => {
    const next = structuredClone(inputFiles);
    const file = next.find((item) => item.path === binding.path);
    assert.ok(file);
    const source = Buffer.from(file.payload.content, 'base64').toString('utf8');
    const rewritten = rewrite(source);
    file.payload.content = Buffer.from(rewritten, 'utf8').toString('base64');
    file.payload.size = Buffer.byteLength(rewritten, 'utf8');
    file.payload.blob_id = gitBlobSha1(rewritten);
    return next;
  };
  const audit = (auditFiles) => auditCurrentReleaseSourceContract({
    releaseHead: head,
    targetBranch: contract.target_branch,
    originAncestry: {
      source: 'gitlab-api-compare-first-parent',
      compare_from: contract.merge_commit_sha,
      compare_to: head,
      compare_commit_count: 2,
      first_parent_complete: true,
      verified: true,
      reason: '',
    },
    files: auditFiles,
    mergeRequests: [],
    originAttestation: null,
    contract,
  });

  for (const binding of scopedBindings) {
    const unrelatedOwner = `test('unrelated duplicate for ${binding.id}', async () => {`;
    const repeated = audit(rewriteBindingFile(files, binding, (source) => (
      `${source}${unrelatedOwner}\n${binding.addition.source}\n});\n`
    )));
    assert.equal(repeated.verified, true, binding.id);
    const repeatedBinding = repeated.integration_bindings.find((item) => item.id === binding.id);
    assert.equal(repeatedBinding.addition_count, 2, binding.id);
    assert.equal(repeatedBinding.occurrence_count, 2, binding.id);
    assert.equal(repeatedBinding.scope_observation.owner_occurrence_count, 1, binding.id);
    assert.equal(repeatedBinding.scope_observation.occurrence_count, 1, binding.id);
    assert.equal(
      repeatedBinding.scope_observation.required_fragments.every((fragment) => (
        fragment.occurrence_count === 1 && fragment.verified === true
      )),
      true,
      binding.id,
    );
    const repeatedValidationOptions = {
      report: {
        release: { head },
        merge_requests: [],
        source_contracts: [repeated],
      },
      contract,
      contracts: [contract],
    };
    assert.equal(
      validateCurrentReleaseSourceContractAttestation(repeated, repeatedValidationOptions).ok,
      true,
      binding.id,
    );
    const forgedScopeCount = structuredClone(repeated);
    const forgedBinding = forgedScopeCount.integration_bindings.find((item) => item.id === binding.id);
    forgedBinding.scope_observation.owner_occurrence_count = 2;
    delete forgedScopeCount.attestation_sha256;
    forgedScopeCount.attestation_sha256 = sha256Text(stableJson(forgedScopeCount));
    const forgedValidation = validateCurrentReleaseSourceContractAttestation(forgedScopeCount, {
      ...repeatedValidationOptions,
      report: {
        ...repeatedValidationOptions.report,
        source_contracts: [forgedScopeCount],
      },
    });
    assert.equal(forgedValidation.ok, false, binding.id);
    assert.equal(
      forgedValidation.failures.includes(`attestation_current_integration_binding_scope_owner:${binding.id}`),
      true,
      binding.id,
    );

    const removed = audit(rewriteBindingFile(files, binding, (source) => (
      source.split(`${binding.addition.source}\n`).join('')
    )));
    assert.equal(removed.verified, false, binding.id);
    assert.equal(
      removed.integration_bindings.find((item) => item.id === binding.id)?.occurrence_count,
      0,
      binding.id,
    );
    assert.equal(removed.failures.includes(`current_integration_binding_mismatch:${binding.id}`), true);

    const moved = audit(rewriteBindingFile(files, binding, (source) => (
      `${source.split(`${binding.addition.source}\n`).join('')}${unrelatedOwner}\n${binding.addition.source}\n});\n`
    )));
    assert.equal(moved.verified, false, binding.id);
    assert.equal(
      moved.failures.includes(`current_integration_binding_scope_occurrence_mismatch:${binding.id}`),
      true,
      binding.id,
    );

    const duplicatedOwner = audit(rewriteBindingFile(files, binding, (source) => (
      `${source}${binding.current_release_scope.owner_start.source}\n${binding.current_release_scope.required_fragments
        .map((fragment) => fragment.value.source).join('\n')}\n});\n`
    )));
    assert.equal(duplicatedOwner.verified, false, binding.id);
    assert.equal(
      duplicatedOwner.failures.includes(`current_integration_binding_scope_owner_mismatch:${binding.id}`),
      true,
      binding.id,
    );

    for (const fragment of binding.current_release_scope.required_fragments) {
      const missingFragment = audit(rewriteBindingFile(files, binding, (source) => (
        source.replace(`${fragment.value.source}\n`, `// removed ${fragment.id}\n`)
      )));
      assert.equal(missingFragment.verified, false, `${binding.id}:${fragment.id}`);
      assert.equal(
        missingFragment.failures.includes(
          `current_integration_binding_scope_required_fragment_mismatch:${binding.id}:${fragment.id}`,
        ),
        true,
        `${binding.id}:${fragment.id}`,
      );
    }
  }

  const strictBinding = contract.integration_bindings.find((item) => item.id === 'test_feature_check_maps_gate');
  const duplicatedStrictBinding = audit(rewriteBindingFile(files, strictBinding, (source) => (
    `${source}test('unrelated strict duplicate', async () => {\n${strictBinding.addition.source}\n});\n`
  )));
  assert.equal(duplicatedStrictBinding.verified, false);
  assert.equal(
    duplicatedStrictBinding.failures.includes(`current_integration_binding_mismatch:${strictBinding.id}`),
    true,
  );
});

test('origin changes attestation continues to require each positive binding exactly once', () => {
  const fixture = exactAddedLinesContractFixture(QWORK_MR1540_MEMORY_FEATURE_PROFILE_CONTRACT);
  const binding = fixture.contract.integration_bindings.find((item) => (
    item.id === 'feature_check_body_absent_test'
  ));
  assert.ok(binding);
  const repeatedChanges = structuredClone(fixture.changes);
  const target = repeatedChanges.find((change) => change.new_path === binding.path);
  assert.ok(target);
  target.diff = target.diff.replace(
    `+${binding.addition.source}`,
    `+${binding.addition.source}\n+${binding.addition.source}`,
  );
  const attestation = auditFixture(fixture, { changes: repeatedChanges });
  assert.equal(attestation.verified, false);
  assert.equal(attestation.failures.includes(`integration_binding_mismatch:${binding.id}`), true);
});

test('renamed GitLab changes retain both old and new paths for release risk mapping', () => {
  const oldPath = 'server/qbot-core/automation/scheduler.mjs';
  const newPath = 'docs/automation-scheduler.md';
  const summarized = summarizeGitLabChanges([{
    old_path: oldPath,
    new_path: newPath,
    renamed_file: true,
    diff: '',
  }]);
  assert.deepEqual(summarized.paths, [oldPath, newPath]);
  const mapped = mapReleaseImpact({
    changedPaths: summarized.paths,
    availableCaseIds: ['MRSMOKE-AUTO-001'],
  });
  assert.equal(mapped.direct_case_ids.includes('MRSMOKE-AUTO-001'), true);
  assert.equal(mapped.product_paths.includes(oldPath), true);
});

test('impact mapping stays conservative for unknown product paths', () => {
  const mapped = mapReleaseImpact({
    changedPaths: ['server/qbot-core/automation/scheduler.mjs', 'server/mystery/contract.mjs'],
    subject: 'automation scheduler !101',
    availableCaseIds: ['MRSMOKE-AUTO-001', 'MRSMOKE-ROUTE-001'],
  });
  assert.equal(mapped.direct_case_ids.includes('MRSMOKE-AUTO-001'), true);
  assert.deepEqual(mapped.unmapped_product_paths, ['server/mystery/contract.mjs']);
  assert.equal(mapped.mapping_status, 'BLOCKED');
});

for (const unknownPath of [
  'server/unknown-domain/auth-runtime.mjs',
  'future/skill-router.ts',
  'extensions/automation-scheduler.mjs',
]) {
  test(`unknown keyword path cannot manufacture impact coverage: ${unknownPath}`, () => {
    const mapped = mapReleaseImpact({
      changedPaths: [unknownPath],
      branch: 'feature/runtime-auth-skill-automation',
      subject: 'auth runtime skill automation',
      labels: ['area/runtime'],
      availableCaseIds: [
        'MRSMOKE-AUTH-001',
        'MRSMOKE-AUTO-001',
        'MRSMOKE-ROUTE-001',
        'MRSMOKE-SKILL-001',
      ],
    });
    assert.deepEqual(mapped.known_product_paths, []);
    assert.deepEqual(mapped.direct_case_ids, []);
    assert.deepEqual(mapped.unmapped_product_paths, [unknownPath]);
    assert.equal(mapped.mapping_status, 'BLOCKED');
  });
}

test('known product paths and generated metadata are classified without false unknowns', () => {
  const mapped = mapReleaseImpact({
    changedPaths: [
      '.agent/context.yaml',
      'AGENTS.md',
      'package.json',
      'server/engine.mjs',
      'electron/desktop-agent-host.cjs',
      'src/components/assistant-ui/thread.tsx',
      'resources/builtin-skills/document-processing/SKILL.md',
      'scripts/e2e-module.test.mjs',
    ],
    subject: 'runtime and routing update',
    availableCaseIds: ['MRSMOKE-FAIL-001', 'MRSMOKE-NAV-001', 'MRSMOKE-SKILL-001'],
  });
  assert.deepEqual(mapped.unmapped_product_paths, []);
  assert.equal(mapped.static_dispositions.length, 3);
  assert.equal(mapped.direct_case_ids.includes('MRSMOKE-FAIL-001'), true);
  assert.equal(mapped.direct_case_ids.includes('MRSMOKE-NAV-001'), true);
  assert.equal(mapped.direct_case_ids.includes('MRSMOKE-SKILL-001'), true);
  assert.equal(mapped.required_stages.includes('G3'), true);
});

test('teams360 host sync maps to the exact host lifecycle Cases and G1/G3 stages', () => {
  const mapped = mapReleaseImpact({
    changedPaths: ['teams360.host-sync.json'],
    subject: 'synchronize the desktop host contract',
    availableCaseIds: ['BETA-INIT-001', 'BETA-HOST-003', 'MRSMOKE-NAV-001'],
  });
  assert.deepEqual(mapped.static_paths, []);
  assert.deepEqual(mapped.product_paths, ['teams360.host-sync.json']);
  assert.deepEqual(mapped.known_product_paths, ['teams360.host-sync.json']);
  assert.deepEqual(mapped.direct_case_ids, ['BETA-HOST-003', 'BETA-INIT-001']);
  assert.deepEqual(mapped.in_scope_case_ids, ['BETA-HOST-003', 'BETA-INIT-001']);
  assert.deepEqual(mapped.required_stages, ['G1', 'G3']);
  assert.deepEqual(mapped.unmapped_product_paths, []);
  assert.equal(mapped.mapping_status, 'MAPPED');
});

for (const nearHostSyncPath of [
  'Teams360.host-sync.json',
  'config/teams360.host-sync.json',
  'teams360.host-sync.json.bak',
]) {
  test(`near host sync path stays fail-closed: ${nearHostSyncPath}`, () => {
    const mapped = mapReleaseImpact({
      changedPaths: [nearHostSyncPath],
      subject: 'host runtime synchronization',
      availableCaseIds: ['BETA-INIT-001', 'BETA-HOST-003'],
    });
    assert.deepEqual(mapped.known_product_paths, []);
    assert.deepEqual(mapped.direct_case_ids, []);
    assert.deepEqual(mapped.unmapped_product_paths, [nearHostSyncPath]);
    assert.equal(mapped.mapping_status, 'BLOCKED');
  });
}

test('desktop Windows builder documentation is static without hiding executable files', () => {
  const exact = mapReleaseImpact({
    changedPaths: [
      'docker/desktop-win-builder/README.md',
      'docker/desktop-win-builder/docs/README.md',
    ],
    subject: 'builder reference update',
    availableCaseIds: ['BETA-HOST-003'],
  });
  assert.deepEqual(exact.product_paths, []);
  assert.deepEqual(exact.unmapped_product_paths, []);
  assert.deepEqual(exact.direct_case_ids, []);
  assert.deepEqual(exact.static_dispositions, [
    {
      path: 'docker/desktop-win-builder/README.md',
      disposition: 'Toolchain/test-only',
    },
    {
      path: 'docker/desktop-win-builder/docs/README.md',
      disposition: 'Research/docs-only',
    },
  ]);
  assert.equal(exact.mapping_status, 'MAPPED');
});

for (const nearBuilderReadme of [
  'docker/desktop-win-builder/readme.md',
  'docker/desktop-win-builder/README.md.bak',
  'docker/desktop-win-builder/docs/runtime.ts',
  'docker/other/README.md',
]) {
  test(`near desktop Windows builder README stays fail-closed: ${nearBuilderReadme}`, () => {
    const mapped = mapReleaseImpact({
      changedPaths: [nearBuilderReadme],
      subject: 'desktop runtime builder documentation',
      availableCaseIds: ['BETA-HOST-003'],
    });
    assert.deepEqual(mapped.static_paths, []);
    assert.deepEqual(mapped.known_product_paths, []);
    assert.deepEqual(mapped.direct_case_ids, []);
    assert.deepEqual(mapped.unmapped_product_paths, [nearBuilderReadme]);
    assert.equal(mapped.mapping_status, 'BLOCKED');
  });
}

test('UI Markdown references are static while UI code and assets remain product paths', () => {
  const mapped = mapReleaseImpact({
    changedPaths: [
      'assets/lib/ui/README.md',
      'assets/lib/ui/reference/runtime-contract.md',
      'assets/lib/ui/app.js',
      'assets/lib/ui/styles/app.css',
      'assets/lib/ui/icons/agent.svg',
      'assets/lib/ui/reference/runtime-contract.mdx',
      'assets/lib/ui/reference/RUNTIME.MD',
    ],
    subject: 'UI reference and implementation update',
    availableCaseIds: [
      'MRSMOKE-ACT-001', 'MRSMOKE-WEB-001', 'MRSMOKE-WEB-002', 'MRSMOKE-AUTH-001',
      'MRSMOKE-AUTO-001', 'MRSMOKE-NAV-001', 'MRSMOKE-ROUTE-001', 'MRSMOKE-SKILL-001',
      'MRSMOKE-FAIL-001', 'MRSMOKE-ART-001', 'MRSMOKE-ENTRY-001', 'MRSMOKE-CHART-001',
    ],
  });
  assert.deepEqual(mapped.static_paths, [
    'assets/lib/ui/README.md',
    'assets/lib/ui/reference/runtime-contract.md',
  ]);
  assert.deepEqual(mapped.static_dispositions, [
    { path: 'assets/lib/ui/README.md', disposition: 'Research/docs-only' },
    { path: 'assets/lib/ui/reference/runtime-contract.md', disposition: 'Research/docs-only' },
  ]);
  assert.deepEqual(mapped.product_paths, [
    'assets/lib/ui/app.js',
    'assets/lib/ui/styles/app.css',
    'assets/lib/ui/icons/agent.svg',
    'assets/lib/ui/reference/runtime-contract.mdx',
    'assets/lib/ui/reference/RUNTIME.MD',
  ]);
  assert.deepEqual(mapped.known_product_paths, mapped.product_paths);
  assert.equal(mapped.in_scope_case_ids.length, 12);
  assert.deepEqual(mapped.unmapped_product_paths, []);
  assert.equal(mapped.mapping_status, 'MAPPED');
});

test('exact architecture basenames are static at every directory depth', () => {
  const mapped = mapReleaseImpact({
    changedPaths: [
      '.architecture.yaml',
      'config/.architecture.yml',
      'deep/nested/metadata/.architecture.yaml',
    ],
    subject: 'repository metadata update',
    availableCaseIds: ['BETA-INIT-001'],
  });
  assert.deepEqual(mapped.product_paths, []);
  assert.deepEqual(mapped.unmapped_product_paths, []);
  assert.deepEqual(mapped.static_dispositions, [
    { path: '.architecture.yaml', disposition: 'Repository-architecture-only' },
    { path: 'config/.architecture.yml', disposition: 'Repository-architecture-only' },
    { path: 'deep/nested/metadata/.architecture.yaml', disposition: 'Repository-architecture-only' },
  ]);
  assert.deepEqual(mapped.direct_case_ids, []);
  assert.equal(mapped.mapping_status, 'MAPPED');
});

for (const nearArchitecturePath of [
  'architecture.yaml',
  '.Architecture.yaml',
  'config/.architecture.yaml.bak',
  'config/.architecture.ymlx',
  'config/.architecture.json',
  'config/.architecture.yaml/child',
]) {
  test(`near architecture basename stays fail-closed: ${nearArchitecturePath}`, () => {
    const mapped = mapReleaseImpact({
      changedPaths: [nearArchitecturePath],
      branch: 'feature/runtime-architecture',
      subject: 'runtime architecture metadata',
      labels: ['area/runtime'],
      availableCaseIds: ['BETA-INIT-001', 'BETA-HOST-003'],
    });
    assert.deepEqual(mapped.static_paths, []);
    assert.deepEqual(mapped.known_product_paths, []);
    assert.deepEqual(mapped.direct_case_ids, []);
    assert.deepEqual(mapped.unmapped_product_paths, [nearArchitecturePath]);
    assert.equal(mapped.mapping_status, 'BLOCKED');
  });
}

test('purely static changes do not become desktop E2E impact from branch wording', () => {
  const mapped = mapReleaseImpact({
    changedPaths: ['dashboard/src/app/App.tsx', 'docs/release-runtime.md', '.gitlab-ci.yml'],
    branch: 'codex/dashboard-yaml-runtime',
    subject: 'Merge branch runtime update into release/0.1',
    availableCaseIds: ['MRSMOKE-FAIL-001', 'BETA-HOST-003'],
  });
  assert.deepEqual(mapped.direct_case_ids, []);
  assert.deepEqual(mapped.unmapped_product_paths, []);
  assert.equal(mapped.mapping_status, 'MAPPED');
  assert.deepEqual(mapped.required_stages, ['G1']);
});

test('latest repository refactors classify known product domains and governance material', () => {
  const mapped = mapReleaseImpact({
    changedPaths: [
      '.gitlab/policies/ci-policy-reference.md',
      'scripts/governance/context/agent-context.mjs',
      'eval/qwork-session-experience/src/pipeline.mjs',
      'openspec/changes/add-local-model-gateway-diagnostics/design.md',
      'schemas/expert-definition-v1.schema.json',
      'server/docs/capabilities.yaml',
      'server/qbot-core/engine/engine.mjs',
      'server/control-plane/index.mjs',
      'server/expert-definition/codec.mjs',
      'src/nav.ts',
      'electron/preload.cjs',
      'assets/lib/ui/icons/common/circle-play.svg',
      'resources/builtin-skills/expert-creator/SKILL.md',
      'db/migrations/20260831000100_preserve_owner_expert_visibility.sql',
      'runtime-family.mjs',
    ],
    subject: 'Merge branch refactor into release/0.1',
    availableCaseIds: [
      'MRSMOKE-ACT-001', 'MRSMOKE-WEB-001', 'MRSMOKE-WEB-002', 'MRSMOKE-AUTH-001',
      'MRSMOKE-AUTO-001', 'MRSMOKE-NAV-001', 'MRSMOKE-ROUTE-001', 'MRSMOKE-SKILL-001',
      'MRSMOKE-FAIL-001', 'MRSMOKE-ART-001', 'MRSMOKE-ENTRY-001', 'MRSMOKE-CHART-001',
    ],
  });
  assert.deepEqual(mapped.unmapped_product_paths, []);
  assert.equal(mapped.static_paths.length, 6);
  assert.equal(mapped.in_scope_case_ids.length, 12);
  assert.equal(mapped.direct_case_ids.includes('BETA-SEC-002'), true);
  assert.equal(mapped.mapping_status, 'MAPPED');
  assert.deepEqual(mapped.required_stages, ['G1', 'G2', 'G3']);
});

test('unknown nested server domains remain fail-closed after refactor mappings', () => {
  const mapped = mapReleaseImpact({
    changedPaths: ['server/qbot-core/engine/engine.mjs', 'server/unknown-domain/contract.mjs'],
    subject: 'server refactor',
    availableCaseIds: ['MRSMOKE-AUTH-001'],
  });
  assert.deepEqual(mapped.unmapped_product_paths, ['server/unknown-domain/contract.mjs']);
  assert.equal(mapped.mapping_status, 'BLOCKED');
});

test('MR !1573 receives its exact Case and stage impact only with the frozen IID and merge SHA', () => {
  const expectedCaseIds = [
    'SIT-MEM-001',
    'BETA-CHAT-001',
    'BETA-CHAT-002',
    'BETA-CHAT-009',
    'BETA-SEC-002',
    'BETA-MCP-001',
    'BETA-MCP-002',
    'BETA-HOST-003',
    'BETA-INIT-001',
    'BETA-ROUTE-001',
    'MRSMOKE-ROUTE-001',
  ];
  const base = {
    changedPaths: ['server/qbot-core/engine/memory-runtime.mjs'],
    subject: 'memory session Profile stability',
    body: 'preserve memory across session transitions',
    branch: 'feature/memory-profile-stability',
    labels: ['area/runtime'],
  };
  const exact = mapReleaseImpact({
    ...base,
    mrIid: QWORK_MR1573_MEMORY_SESSION_PROFILE_STABILITY_CONTRACT.mr_iid,
    mergeCommitSha: QWORK_MR1573_MEMORY_SESSION_PROFILE_STABILITY_CONTRACT.merge_commit_sha,
  });
  assert.deepEqual(exact.direct_case_ids, expectedCaseIds);
  assert.deepEqual(exact.required_stages, ['G1', 'G2', 'G3', 'G4']);

  for (const identity of [
    {
      mrIid: '1572',
      mergeCommitSha: QWORK_MR1573_MEMORY_SESSION_PROFILE_STABILITY_CONTRACT.merge_commit_sha,
    },
    {
      mrIid: QWORK_MR1573_MEMORY_SESSION_PROFILE_STABILITY_CONTRACT.mr_iid,
      mergeCommitSha: '0'.repeat(40),
    },
    { mrIid: '', mergeCommitSha: '' },
  ]) {
    const mapped = mapReleaseImpact({ ...base, ...identity });
    assert.equal(mapped.direct_case_ids.includes('SIT-MEM-001'), false);
    assert.equal(mapped.required_stages.includes('G4'), false);
  }
});

test('release intake uses commit ancestry and binds verified MR metadata', () => {
  const { repo, baseline, releaseHead } = fixtureRepo();
  try {
    const report = scanQworkReleaseIntake({
      repoRoot: repo,
      releaseRef: 'HEAD',
      baselineCommit: baseline,
      caseIds: ['MRSMOKE-AUTO-001', 'MRSMOKE-ROUTE-001', 'BETA-TASK-008'],
      frameworkCommit: 'a'.repeat(40),
      fetchLatest: false,
      gitlabReader: () => [{ iid: 101, title: 'automation scheduler', state: 'merged', target_branch: 'HEAD', merge_commit_sha: releaseHead, labels: ['area/automation'], merged_at: '2026-08-31T01:00:00Z' }],
      now: new Date('2026-08-31T02:00:00Z'),
    });
    assert.equal(report.schema_version, QWORK_RELEASE_INTAKE_SCHEMA);
    assert.equal(report.tool.version, QWORK_RELEASE_INTAKE_TOOL_VERSION);
    assert.equal(report.decision, 'READY', report.blockers.join('; '));
    assert.equal(report.scan_boundary.mode, 'commit_ancestry');
    assert.equal(report.scan_boundary.baseline_commit, baseline);
    assert.equal(report.merge_requests[0].metadata_verified, true);
    assert.equal(report.summary.direct_case_ids.includes('MRSMOKE-AUTO-001'), true);
    assert.equal(report.summary.dependency_case_ids.includes('BETA-TASK-008'), true);
    assert.equal(validateQworkReleaseIntake(report, { releaseRef: 'HEAD', releaseHead, frameworkCommit: 'a'.repeat(40) }).ok, true);

    const staleToolReport = structuredClone(report);
    staleToolReport.tool.version = 'qbot-release-intake/1.8.0';
    const staleToolContent = structuredClone(staleToolReport);
    delete staleToolContent.integrity.content_sha256;
    staleToolReport.integrity.content_sha256 = sha256Text(stableJson(staleToolContent));
    const staleToolValidation = validateQworkReleaseIntake(staleToolReport, {
      releaseRef: 'HEAD',
      releaseHead,
      frameworkCommit: 'a'.repeat(40),
    });
    assert.equal(staleToolValidation.ok, false);
    assert.equal(staleToolValidation.failures.includes('tool_version_mismatch'), true);
    assert.equal(staleToolValidation.failures.includes('content_sha256_mismatch'), false);
  } finally {
    fs.rmSync(repo, { recursive: true, force: true });
  }
});

test('formal intake validation rejects fetch-only freshness and cross-Sheet scope reuse after rehashing', () => {
  const { repo, baseline } = fixtureRepo();
  try {
    const report = scanQworkReleaseIntake({
      repoRoot: repo,
      releaseRef: 'HEAD',
      baselineCommit: baseline,
      caseIds: ['MRSMOKE-AUTO-001', 'BETA-TASK-008'],
      frameworkCommit: 'a'.repeat(40),
      fetchLatest: false,
      requireGitLabMetadata: false,
      gitlabReader: () => [],
    });
    const rehash = (candidate) => {
      const value = structuredClone(candidate);
      delete value.integrity.content_sha256;
      candidate.integrity.content_sha256 = sha256Text(stableJson(value));
      return candidate;
    };

    report.policy.fetch_latest = true;
    report.casebook = {
      path: '/tmp/formal-casebook.xlsx',
      sheet: '核心生命线门禁',
      sha256: 'b'.repeat(64),
      observed_sha256: 'b'.repeat(64),
      identity_verified: true,
      load_source: 'casebook-sheet',
      load_error: '',
      available_case_count: 2,
      available_case_ids: ['MRSMOKE-AUTO-001', 'BETA-TASK-008'],
    };
    rehash(report);
    const expected = {
      releaseRef: 'HEAD',
      casebookPath: '/tmp/formal-casebook.xlsx',
      sheet: '核心生命线门禁',
      caseIds: ['MRSMOKE-AUTO-001', 'BETA-TASK-008'],
      casebookSha256: 'b'.repeat(64),
      frameworkCommit: 'a'.repeat(40),
      requireReady: true,
      requireFreshRef: true,
    };
    assert.equal(validateQworkReleaseIntake(report, expected).ok, true);
    const strictFreshness = validateQworkReleaseIntake(report, {
      ...expected,
      requireGitLabApiFreshness: true,
    });
    assert.equal(strictFreshness.ok, false);
    assert.equal(strictFreshness.failures.includes('gitlab_api_freshness_required'), true);

    const mutations = [
      ['casebook_path_mismatch', (candidate) => { candidate.casebook.path = '/tmp/other.xlsx'; }],
      ['casebook_sheet_mismatch', (candidate) => { candidate.casebook.sheet = '全量功能回归Case'; }],
      ['casebook_case_ids_mismatch', (candidate) => { candidate.casebook.available_case_ids.reverse(); }],
    ];
    for (const [failure, mutate] of mutations) {
      const forged = structuredClone(report);
      mutate(forged);
      rehash(forged);
      const validation = validateQworkReleaseIntake(forged, expected);
      assert.equal(validation.ok, false, failure);
      assert.equal(validation.failures.includes(failure), true, validation.failures.join(','));
      assert.equal(validation.failures.includes('content_sha256_mismatch'), false, failure);
    }
  } finally {
    fs.rmSync(repo, { recursive: true, force: true });
  }
});

test('dependency closure keeps cross-sheet prerequisites in the intake', () => {
  const { repo, baseline } = fixtureRepo();
  try {
    const report = scanQworkReleaseIntake({
      repoRoot: repo,
      releaseRef: 'HEAD',
      baselineCommit: baseline,
      caseIds: ['MRSMOKE-AUTO-001'],
      frameworkCommit: 'a'.repeat(40),
      fetchLatest: false,
      requireGitLabMetadata: false,
      gitlabReader: () => [],
    });
    assert.equal(report.summary.dependency_case_ids.includes('BETA-TASK-008'), true);
    assert.equal(report.summary.dependency_case_ids.includes('BETA-ROUTE-001'), true);
  } finally {
    fs.rmSync(repo, { recursive: true, force: true });
  }
});

test('intake falls back to a bounded time window when ancestry is unavailable', () => {
  const { repo } = fixtureRepo();
  try {
    const report = scanQworkReleaseIntake({
      repoRoot: repo,
      releaseRef: 'HEAD',
      baselineCommit: 'b'.repeat(40),
      caseIds: ['MRSMOKE-AUTO-001'],
      frameworkCommit: 'a'.repeat(40),
      fetchLatest: false,
      requireGitLabMetadata: false,
      gitlabReader: () => [],
      now: new Date('2026-08-31T02:00:00Z'),
      fallbackDays: 30,
    });
    assert.equal(report.scan_boundary.mode, 'time_window_fallback');
    assert.equal(report.scan_boundary.ancestry_verified, false);
    assert.match(report.scan_boundary.fallback_reason, /baseline/);
    assert.equal(report.policy.time_window_is_fallback, true);
    assert.equal(report.decision, 'BLOCKED');
    assert.match(report.blockers.join('\n'), /祖先关系/);
  } finally {
    fs.rmSync(repo, { recursive: true, force: true });
  }
});

test('GitLab MR intake paginates beyond the first 100 rows', () => {
  const { repo, baseline, releaseHead } = fixtureRepo();
  try {
    const calls = [];
    const report = scanQworkReleaseIntake({
      repoRoot: repo,
      releaseRef: 'HEAD',
      baselineCommit: baseline,
      caseIds: ['MRSMOKE-AUTO-001'],
      frameworkCommit: 'a'.repeat(40),
      fetchLatest: false,
      gitlabReader: (endpoint) => {
        calls.push(endpoint);
        if (endpoint.endsWith('page=1')) {
          return Array.from({ length: 100 }, (_, index) => ({
            iid: String(index + 1),
            merge_commit_sha: index === 0 ? releaseHead : '0'.repeat(40),
            state: 'merged',
            target_branch: 'HEAD',
          }));
        }
        return [{ iid: '101', merge_commit_sha: '1'.repeat(40), state: 'merged', target_branch: 'HEAD' }];
      },
    });
    assert.equal(calls.length, 2);
    assert.equal(calls[1].endsWith('page=2'), true);
    assert.equal(report.merge_requests[0].metadata_verified, true);
  } finally {
    fs.rmSync(repo, { recursive: true, force: true });
  }
});

test('GitLab API freshness proves stable branch, complete first-parent chain, and exact MR changes', () => {
  const fixture = apiFixture();
  const report = scanQworkReleaseIntake({
    repoRoot: process.cwd(),
    releaseRef: 'origin/release/0.1',
    baselineCommit: fixture.baseline,
    caseIds: ['BETA-INIT-001'],
    frameworkCommit: 'd'.repeat(40),
    gitlabReader: fixture.reader,
    freshnessSource: 'gitlab-api',
  });
  assert.equal(report.decision, 'READY', JSON.stringify({
    blockers: report.blockers,
    freshness: report.policy.api_freshness,
    risk: report.blocking_risks[0],
    apiErrors: report.unresolved.api_errors,
  }));
  assert.equal(report.release.head, fixture.head);
  assert.equal(report.policy.fetch_latest, false);
  assert.equal(report.policy.api_freshness.verified, true);
  assert.equal(report.policy.api_freshness.mr_changes_verified_count, 1);
  assert.equal(report.merge_requests[0].metadata_verified, true);
  const blockingRisk = report.blocking_risks[0];
  assert.equal(blockingRisk.applicability, 'VERIFIED_NOT_APPLICABLE');
  assert.equal(blockingRisk.status, 'NOT_APPLICABLE');
  assert.equal(blockingRisk.release_before_origin_ancestry.compare_from, fixture.head);
  assert.equal(blockingRisk.release_before_origin_ancestry.compare_to, QWORK_MR1552_MERGE_COMMIT_SHA);
  assert.equal(blockingRisk.release_before_origin_ancestry.verified, true);
  const legacyHeaderAttestation = report.source_contracts.find((item) => (
    item.contract_id === QWORK_MR1522_CLAUDE_TURN_HEADERS_CONTRACT.contract_id
  ));
  assert.deepEqual(legacyHeaderAttestation.current_assertion_owners.header_emissions, {
    contract_id: QWORK_MR1544_CLAUDE_TURN_HEADER_BRANDING_CONTRACT.contract_id,
    contract_sha256: QWORK_MR1544_CLAUDE_TURN_HEADER_BRANDING_CONTRACT.contract_sha256,
    lineage: [
      QWORK_MR1522_CLAUDE_TURN_HEADERS_CONTRACT.contract_id,
      QWORK_MR1544_CLAUDE_TURN_HEADER_BRANDING_CONTRACT.contract_id,
    ],
  });
  assert.deepEqual(
    legacyHeaderAttestation.headers.map((header) => header.wire_name),
    QWORK_MR1544_CLAUDE_TURN_HEADER_BRANDING_CONTRACT.header_emissions.map((header) => header.wire_name),
  );
  assert.equal(legacyHeaderAttestation.forbidden_fragments.every((item) => item.verified), true);
  assert.equal(validateQworkReleaseIntake(report, { requireFreshRef: true }).ok, true);

  const forged = structuredClone(report);
  const forgedLegacy = forged.source_contracts.find((item) => (
    item.contract_id === QWORK_MR1522_CLAUDE_TURN_HEADERS_CONTRACT.contract_id
  ));
  forgedLegacy.current_assertion_owners.header_emissions.lineage = [
    QWORK_MR1522_CLAUDE_TURN_HEADERS_CONTRACT.contract_id,
  ];
  const forgedValue = structuredClone(forgedLegacy);
  delete forgedValue.attestation_sha256;
  forgedLegacy.attestation_sha256 = sha256Text(stableJson(forgedValue));
  const forgedValidation = validateReleaseSourceContractsForReport(forged);
  assert.equal(forgedValidation.ok, false);
  assert.equal(forgedValidation.failures.some((failure) => (
    failure.includes('attestation_current_assertion_owners_mismatch')
  )), true);
  assert.equal(validateQworkReleaseIntake(forged, { requireReady: false }).failures.includes('content_sha256_mismatch'), true);
  const forgedReportValue = structuredClone(forged);
  delete forgedReportValue.integrity.content_sha256;
  forged.integrity.content_sha256 = sha256Text(stableJson(forgedReportValue));
  const rehashedValidation = validateQworkReleaseIntake(forged, { requireReady: false });
  assert.equal(rehashedValidation.ok, false);
  assert.equal(rehashedValidation.failures.some((failure) => (
    failure.includes('attestation_current_assertion_owners_mismatch')
  )), true);
});

test('GitLab API intake preserves a renamed product source path when the destination is documentation', () => {
  const oldPath = 'server/qbot-core/automation/scheduler.mjs';
  const newPath = 'docs/automation-scheduler.md';
  const fixture = apiFixture({
    changes: [{
      old_path: oldPath,
      new_path: newPath,
      renamed_file: true,
      diff: '',
    }],
  });
  const report = scanQworkReleaseIntake({
    repoRoot: process.cwd(),
    releaseRef: 'origin/release/0.1',
    baselineCommit: fixture.baseline,
    caseIds: ['MRSMOKE-AUTO-001'],
    frameworkCommit: 'd'.repeat(40),
    gitlabReader: fixture.reader,
    freshnessSource: 'gitlab-api',
  });
  assert.equal(report.decision, 'READY', report.blockers.join('; '));
  assert.deepEqual(report.merge_requests[0].changed_paths, [oldPath, newPath]);
  assert.equal(report.merge_requests[0].impact.direct_case_ids.includes('MRSMOKE-AUTO-001'), true);
});

test('GitLab API current-release source rejects a blob id that is not bound to content bytes', () => {
  const fixture = apiFixture();
  const targetPath = QWORK_RELEASE_SOURCE_CONTRACTS[0].source_file.path;
  const reader = (endpoint) => {
    if (endpoint.startsWith(`repository/files/${encodeURIComponent(targetPath)}?`)) {
      const payload = structuredClone(fixture.reader(endpoint));
      payload.blob_id = '0'.repeat(40);
      return payload;
    }
    return fixture.reader(endpoint);
  };
  const report = scanQworkReleaseIntake({
    repoRoot: process.cwd(),
    releaseRef: 'origin/release/0.1',
    baselineCommit: fixture.baseline,
    caseIds: ['BETA-INIT-001'],
    frameworkCommit: 'd'.repeat(40),
    gitlabReader: reader,
    freshnessSource: 'gitlab-api',
  });
  assert.equal(report.decision, 'BLOCKED');
  assert.equal(
    report.unresolved.source_contract_failures.some((failure) => failure.includes('blob_id_content_mismatch')),
    true,
  );
});

test('GitLab API file provenance follows Files last_commit_id and never uses path history', () => {
  const head = 'b'.repeat(40);
  const lastCommitId = '9'.repeat(40);
  const targetPath = QWORK_RELEASE_SOURCE_CONTRACTS[0].source_file.path;
  const payload = structuredClone(currentReleaseFileFixtures(QWORK_RELEASE_SOURCE_CONTRACTS, head).get(targetPath));
  payload.last_commit_id = lastCommitId;
  delete payload.last_commit_provenance;
  const fixture = apiFixture({
    head,
    releaseFileOverrides: new Map([[targetPath, payload]]),
  });
  const calls = [];
  const trackedReader = (endpoint) => {
    calls.push(endpoint);
    return fixture.reader(endpoint);
  };
  trackedReader.readRaw = (endpoint) => {
    calls.push(endpoint);
    return fixture.reader.readRaw(endpoint);
  };
  const report = scanQworkReleaseIntake({
    repoRoot: process.cwd(),
    releaseRef: 'origin/release/0.1',
    baselineCommit: fixture.baseline,
    caseIds: ['BETA-INIT-001'],
    frameworkCommit: 'd'.repeat(40),
    gitlabReader: trackedReader,
    freshnessSource: 'gitlab-api',
  });
  assert.equal(report.decision, 'READY', report.blockers.join('; '));
  assert.equal(calls.some((endpoint) => endpoint.startsWith('repository/commits?path=')), false);
  assert.equal(calls.includes(`repository/commits/${lastCommitId}`), true);
  assert.equal(calls.includes(`repository/commits/${lastCommitId}/diff?per_page=100&page=1`), true);
  const observed = report.source_contracts.flatMap((item) => item.protected_files)
    .find((file) => file.path === targetPath && file.last_commit_id === lastCommitId);
  assert.equal(observed.last_commit_provenance.commit_id, lastCommitId);
  assert.equal(observed.last_commit_provenance.path_verified, true);
});

test('GitLab API file provenance reads every commit diff page before matching a protected path', () => {
  const head = 'b'.repeat(40);
  const lastCommitId = '8'.repeat(40);
  const targetPath = QWORK_RELEASE_SOURCE_CONTRACTS[0].source_file.path;
  const payload = structuredClone(currentReleaseFileFixtures(QWORK_RELEASE_SOURCE_CONTRACTS, head).get(targetPath));
  payload.last_commit_id = lastCommitId;
  delete payload.last_commit_provenance;
  const fixture = apiFixture({ head, releaseFileOverrides: new Map([[targetPath, payload]]) });
  const reader = (endpoint) => {
    const pageMatch = endpoint.match(new RegExp(`^repository/commits/${lastCommitId}/diff\\?per_page=100&page=(\\d+)$`, 'u'));
    if (!pageMatch) return fixture.reader(endpoint);
    if (pageMatch[1] === '1') {
      return Array.from({ length: 100 }, (_, index) => (
        gitLabDiffResponseChange(`docs/filler-${index}.md`)
      ));
    }
    return pageMatch[1] === '2' ? [gitLabDiffResponseChange(targetPath)] : [];
  };
  reader.readRaw = (endpoint) => {
    const value = reader(endpoint);
    return { bytes: Buffer.from(JSON.stringify(value), 'utf8'), value };
  };
  const report = scanQworkReleaseIntake({
    repoRoot: process.cwd(), releaseRef: 'origin/release/0.1', baselineCommit: fixture.baseline,
    caseIds: ['BETA-INIT-001'], frameworkCommit: 'd'.repeat(40), gitlabReader: reader,
    freshnessSource: 'gitlab-api',
  });
  assert.equal(report.decision, 'READY', report.blockers.join('; '));
  const observed = report.source_contracts.flatMap((item) => item.protected_files)
    .find((file) => file.path === targetPath && file.last_commit_id === lastCommitId);
  assert.deepEqual(observed.last_commit_provenance.diff_pages.map((page) => page.item_count), [100, 1]);
  assert.equal(observed.last_commit_provenance.matched_changes[0].new_path, targetPath);
});

test('GitLab API file provenance rejects repeated pages, malformed flags and non-current path changes', () => {
  const targetPath = QWORK_RELEASE_SOURCE_CONTRACTS[0].source_file.path;
  const runScenario = ({ marker, pages, expectedDecision = 'BLOCKED' }) => {
    const head = 'b'.repeat(40);
    const lastCommitId = marker.repeat(40);
    const payload = structuredClone(currentReleaseFileFixtures(QWORK_RELEASE_SOURCE_CONTRACTS, head).get(targetPath));
    payload.last_commit_id = lastCommitId;
    delete payload.last_commit_provenance;
    const fixture = apiFixture({ head, releaseFileOverrides: new Map([[targetPath, payload]]) });
    const reader = (endpoint) => {
      const match = endpoint.match(new RegExp(`^repository/commits/${lastCommitId}/diff\\?per_page=100&page=(\\d+)$`, 'u'));
      if (match) return structuredClone(pages[Number(match[1]) - 1] || []);
      return fixture.reader(endpoint);
    };
    reader.readRaw = (endpoint) => {
      const value = reader(endpoint);
      return { bytes: Buffer.from(JSON.stringify(value), 'utf8'), value };
    };
    const report = scanQworkReleaseIntake({
      repoRoot: process.cwd(), releaseRef: 'origin/release/0.1', baselineCommit: fixture.baseline,
      caseIds: ['BETA-INIT-001'], frameworkCommit: 'd'.repeat(40), gitlabReader: reader,
      freshnessSource: 'gitlab-api',
    });
    assert.equal(report.decision, expectedDecision, `${marker}:${report.blockers.join('; ')}`);
    return report;
  };
  const ordinary = gitLabDiffResponseChange(targetPath);
  const repeatedPage = [ordinary, ...Array.from({ length: 99 }, (_, index) => (
    gitLabDiffResponseChange(`docs/filler-${index}.md`)
  ))];
  for (const scenario of [
    { marker: '1', pages: [repeatedPage, repeatedPage, []] },
    { marker: '2', pages: [[{ ...ordinary, new_file: 'false' }]] },
    { marker: '3', pages: [[{
      ...ordinary, new_path: 'docs/renamed-away.mjs', renamed_file: true,
    }]] },
    { marker: '4', pages: [[{ ...ordinary, deleted_file: true }]] },
    { marker: '5', pages: [[ordinary, { ...ordinary, new_file: true }]] },
    { marker: '7', pages: [[{ ...ordinary, old_path: 42 }]] },
    { marker: '8', pages: [[{ ...ordinary, old_path: {} }]] },
    { marker: '9', pages: [[{ ...ordinary, old_path: '   ' }]] },
    { marker: 'a', pages: [[{ ...ordinary, old_path: ` ${targetPath}` }]] },
    { marker: 'b', pages: [[{ ...ordinary, old_path: `${targetPath} ` }]] },
    { marker: 'c', pages: [[{ ...ordinary, new_file: true, deleted_file: true }]] },
    { marker: 'd', pages: [[{ ...ordinary, old_path: 'docs/renamed-from.mjs' }]] },
    { marker: 'f', pages: [[{ ...ordinary, collapsed: true }]] },
    { marker: '0', pages: [[{ ...ordinary, too_large: true }]] },
  ]) {
    runScenario(scenario);
  }
  runScenario({
    marker: 'e',
    pages: [repeatedPage, [{ ...ordinary, new_file: true }]],
  });
  runScenario({
    marker: '6',
    pages: [[{
      ...ordinary, old_path: 'docs/renamed-into.mjs', renamed_file: true,
    }]],
    expectedDecision: 'READY',
  });
});

test('GitLab API file provenance preserves complete canonical commit metadata', () => {
  const head = 'b'.repeat(40);
  const lastCommitId = '7'.repeat(40);
  const targetPath = QWORK_RELEASE_SOURCE_CONTRACTS[0].source_file.path;
  const payload = structuredClone(currentReleaseFileFixtures(QWORK_RELEASE_SOURCE_CONTRACTS, head).get(targetPath));
  payload.last_commit_id = lastCommitId;
  delete payload.last_commit_provenance;
  const fixture = apiFixture({ head, releaseFileOverrides: new Map([[targetPath, payload]]) });
  const metadata = gitLabCommitMetadata(lastCommitId, {
    title: 'protected source update',
    message: 'protected source update\n\nComplete canonical metadata fixture.\n',
    parent_ids: ['6'.repeat(40)],
    committed_date: '2026-09-08T01:02:03Z',
  });
  const reader = (endpoint) => (
    endpoint === `repository/commits/${lastCommitId}` ? metadata : fixture.reader(endpoint)
  );
  reader.readRaw = (endpoint) => fixture.reader.readRaw(endpoint);
  const report = scanQworkReleaseIntake({
    repoRoot: process.cwd(), releaseRef: 'origin/release/0.1', baselineCommit: fixture.baseline,
    caseIds: ['BETA-INIT-001'], frameworkCommit: 'd'.repeat(40),
    gitlabReader: reader,
    freshnessSource: 'gitlab-api',
  });
  assert.equal(report.decision, 'READY', report.blockers.join('; '));
  const provenance = report.source_contracts.flatMap((item) => item.protected_files)
    .find((file) => file.path === targetPath && file.last_commit_id === lastCommitId)
    .last_commit_provenance;
  assert.deepEqual(provenance.commit_raw_response, metadata);
  assert.deepEqual(provenance.commit_metadata, JSON.parse(stableJson(metadata)));
  assert.equal(provenance.commit_response_sha256, sha256Text(stableJson(provenance.commit_raw_response)));
  assert.notEqual(provenance.commit_response_sha256, sha256Text(stableJson({ id: lastCommitId })));
});

test('GitLab API file provenance hashes and preserves the complete raw diff page response', () => {
  const head = 'b'.repeat(40);
  const lastCommitId = '4'.repeat(40);
  const targetPath = QWORK_RELEASE_SOURCE_CONTRACTS[0].source_file.path;
  const payload = structuredClone(currentReleaseFileFixtures(QWORK_RELEASE_SOURCE_CONTRACTS, head).get(targetPath));
  payload.last_commit_id = lastCommitId;
  delete payload.last_commit_provenance;
  const fixture = apiFixture({ head, releaseFileOverrides: new Map([[targetPath, payload]]) });
  const rawChange = {
    old_path: targetPath,
    new_path: targetPath,
    a_mode: '100644',
    b_mode: '100644',
    new_file: false,
    renamed_file: false,
    deleted_file: false,
    generated_file: false,
    collapsed: false,
    too_large: false,
    diff: '@@ -1 +1 @@\n-old\n+new',
  };
  const reader = (endpoint) => (
    endpoint === `repository/commits/${lastCommitId}/diff?per_page=100&page=1`
      ? [rawChange] : fixture.reader(endpoint)
  );
  reader.readRaw = (endpoint) => fixture.reader.readRaw(endpoint);
  const report = scanQworkReleaseIntake({
    repoRoot: process.cwd(), releaseRef: 'origin/release/0.1', baselineCommit: fixture.baseline,
    caseIds: ['BETA-INIT-001'], frameworkCommit: 'd'.repeat(40),
    gitlabReader: reader,
    freshnessSource: 'gitlab-api',
  });
  assert.equal(report.decision, 'READY', report.blockers.join('; '));
  const page = report.source_contracts.flatMap((item) => item.protected_files)
    .find((file) => file.path === targetPath && file.last_commit_id === lastCommitId)
    .last_commit_provenance.diff_pages[0];
  assert.deepEqual(page.raw_response, [rawChange]);
  assert.equal(page.response_sha256, sha256Text(stableJson([rawChange])));
  assert.notEqual(page.response_sha256, sha256Text(stableJson(page.changes)));
  assert.deepEqual(Object.keys(page.changes[0]).sort(), [
    'deleted_file', 'new_file', 'new_path', 'old_path', 'renamed_file',
  ]);
});

test('GitLab API provenance failure preserves the Files payload and reports only provenance read failure', () => {
  const head = 'b'.repeat(40);
  const lastCommitId = '7'.repeat(40);
  const targetPath = QWORK_RELEASE_SOURCE_CONTRACTS[0].source_file.path;
  const payload = structuredClone(currentReleaseFileFixtures(QWORK_RELEASE_SOURCE_CONTRACTS, head).get(targetPath));
  payload.last_commit_id = lastCommitId;
  delete payload.last_commit_provenance;
  const fixture = apiFixture({ head, releaseFileOverrides: new Map([[targetPath, payload]]) });
  const reader = (endpoint) => {
    if (endpoint === `repository/commits/${lastCommitId}`) throw new Error('commit metadata unavailable');
    return fixture.reader(endpoint);
  };
  const report = scanQworkReleaseIntake({
    repoRoot: process.cwd(), releaseRef: 'origin/release/0.1', baselineCommit: fixture.baseline,
    caseIds: ['BETA-INIT-001'], frameworkCommit: 'd'.repeat(40), gitlabReader: reader,
    freshnessSource: 'gitlab-api',
  });
  assert.equal(report.decision, 'BLOCKED');
  assert.deepEqual(report.unresolved.api_errors.filter((error) => error.includes(targetPath)), [
    `source contract current release file provenance ${targetPath}: commit metadata unavailable`,
  ]);
  const observed = report.source_contracts.flatMap((item) => item.protected_files)
    .find((file) => file.path === targetPath && file.last_commit_id === lastCommitId);
  assert.equal(observed.error, '');
  assert.equal(observed.content_base64, payload.content);
  assert.equal(observed.bytes, payload.size);
  assert.equal(observed.sha256, sha256Text(Buffer.from(payload.content, 'base64').toString('utf8')));
  assert.equal(observed.last_commit_provenance.path_verified, false);
  assert.equal(observed.last_commit_provenance.error, 'commit metadata unavailable');
});

test('GitLab API file provenance blocks commit metadata drift and a diff without the protected path', () => {
  for (const mode of ['metadata-drift', 'missing-path']) {
    const head = 'b'.repeat(40);
    const lastCommitId = mode === 'metadata-drift' ? '6'.repeat(40) : '5'.repeat(40);
    const targetPath = QWORK_RELEASE_SOURCE_CONTRACTS[0].source_file.path;
    const payload = structuredClone(currentReleaseFileFixtures(QWORK_RELEASE_SOURCE_CONTRACTS, head).get(targetPath));
    payload.last_commit_id = lastCommitId;
    delete payload.last_commit_provenance;
    const fixture = apiFixture({ head, releaseFileOverrides: new Map([[targetPath, payload]]) });
    const reader = (endpoint) => {
      if (mode === 'metadata-drift' && endpoint === `repository/commits/${lastCommitId}`) {
        return { id: '4'.repeat(40) };
      }
      if (mode === 'missing-path' && endpoint === `repository/commits/${lastCommitId}/diff?per_page=100&page=1`) {
        return [];
      }
      return fixture.reader(endpoint);
    };
    const report = scanQworkReleaseIntake({
      repoRoot: process.cwd(), releaseRef: 'origin/release/0.1', baselineCommit: fixture.baseline,
      caseIds: ['BETA-INIT-001'], frameworkCommit: 'd'.repeat(40), gitlabReader: reader,
      freshnessSource: 'gitlab-api',
    });
    assert.equal(report.decision, 'BLOCKED', mode);
    assert.equal(report.unresolved.source_contract_failures.some((failure) => failure.includes(
      mode === 'metadata-drift' ? ':commit_id_mismatch' : ':matched_change_count_mismatch',
    )), true, mode);
  }
});

test('GitLab API intake proves a release between MR !1552 and MR !1559 and audits legacy source', () => {
  const head = '7'.repeat(40);
  const fixture = apiFixture({ head });
  const fixedController = `
function terminalFor(start, code) {
  return { ...start, operation: 'execution.terminal', deadlineAt: Date.now() + 30000, payload: { code } };
}
runner.on('message', (runnerMessage) => {
  let validatedRunnerMessage;
  try {
    validatedRunnerMessage = validateEnvelope(runnerMessage, { direction: 'worker-to-host' });
  } catch (error) {
    process.parentPort.postMessage(terminalFor(startMessage, 'execution_worker_runner_protocol_error'));
    void runner.terminate();
    return;
  }
  if (validatedRunnerMessage?.operation === 'worker.pressure') {
    process.parentPort.postMessage({ ...validatedRunnerMessage, operation: 'worker.pressure' });
    return;
  }
  process.parentPort.postMessage(validatedRunnerMessage);
});
runner.on('exit', (exitCode) => {
  if (state.settled) return;
  state.settled = true;
  process.parentPort.postMessage(terminalFor(startMessage,
    exitCode === 0 ? 'execution_worker_runner_clean_exit_without_terminal' : 'execution_worker_runner_exit'));
});
`;
  const fixedSupervisor = `
function executionWorkerPressureFromMessage(message, currentPressure) {
  if (message.operation === 'worker.heartbeat') return currentPressure;
  if (message.operation !== 'worker.pressure') return null;
  return message.payload;
}
const onMessage = (raw) => {
  let message;
  try { message = validateEnvelope(raw, { direction: 'worker-to-host' }); }
  catch (error) { logger.error(error); return; }
  const nextPressure = executionWorkerPressureFromMessage(message, pressure);
  if (nextPressure) pressure = nextPressure;
};
`;
  const riskSources = new Map([
    ['electron/execution-worker.cjs', fixedController],
    ['electron/host-core/agent/execution-worker-supervisor.cjs', fixedSupervisor],
  ]);
  const reader = (endpoint) => {
    if (endpoint.startsWith('repository/compare?')) {
      const query = new URLSearchParams(endpoint.slice(endpoint.indexOf('?') + 1));
      const from = query.get('from');
      const to = query.get('to');
      if (from === QWORK_MR1552_MERGE_COMMIT_SHA && to === head) {
        return {
          compare_timeout: false,
          commits: [{
            id: head,
            parent_ids: [QWORK_MR1552_MERGE_COMMIT_SHA],
            title: 'Release after MR !1552',
            message: 'Release after MR !1552',
            committed_date: '2026-09-03T01:00:00Z',
          }],
        };
      }
      if (from === head && to === QWORK_MR1552_MERGE_COMMIT_SHA) {
        return { compare_timeout: false, commits: [] };
      }
      if (from === QWORK_MR1559_MERGE_COMMIT_SHA && to === head) {
        return { compare_timeout: false, commits: [] };
      }
      if (from === head && to === QWORK_MR1559_MERGE_COMMIT_SHA) {
        return {
          compare_timeout: false,
          commits: [{
            id: QWORK_MR1559_MERGE_COMMIT_SHA,
            parent_ids: [head],
            title: 'MR !1559 follows current release',
            message: 'MR !1559 follows current release',
            committed_date: '2026-09-03T01:01:00Z',
          }],
        };
      }
    }
    if (endpoint.startsWith('repository/files/')) {
      const encodedPath = endpoint.slice('repository/files/'.length, endpoint.indexOf('?'));
      const filePath = decodeURIComponent(encodedPath);
      if (QWORK_MR1552_LEGACY_PROTECTED_PATHS.includes(filePath)) {
        let inheritedSource = '';
        try {
          const inherited = fixture.reader(endpoint);
          inheritedSource = Buffer.from(inherited.content, 'base64').toString('utf8');
        } catch {
          // This fixture path is owned only by the blocking-risk contract.
        }
        const source = `${inheritedSource}${riskSources.get(filePath) || `// legacy release source: ${filePath}\n`}`;
        return gitLabFilePayload(filePath, source, head);
      }
    }
    return fixture.reader(endpoint);
  };
  reader.readRaw = (endpoint) => {
    const value = reader(endpoint);
    return { bytes: Buffer.from(JSON.stringify(value), 'utf8'), value };
  };
  const report = scanQworkReleaseIntake({
    repoRoot: process.cwd(),
    releaseRef: 'origin/release/0.1',
    baselineCommit: fixture.baseline,
    caseIds: ['BETA-INIT-001'],
    frameworkCommit: 'd'.repeat(40),
    gitlabReader: reader,
    freshnessSource: 'gitlab-api',
  });
  const risk = report.blocking_risks[0];
  assert.equal(risk.applicability, 'VERIFIED_APPLICABLE');
  assert.equal(risk.successor_applicability, 'VERIFIED_NOT_APPLICABLE');
  assert.equal(risk.architecture, 'shared-worker-registry/v1');
  assert.equal(risk.status, 'VERIFIED', JSON.stringify(risk));
  assert.equal(risk.release_before_successor_ancestry.compare_from, head);
  assert.equal(risk.release_before_successor_ancestry.compare_to, QWORK_MR1559_MERGE_COMMIT_SHA);
  assert.equal(report.decision, 'READY', report.blockers.join('; '));
});

test('GitLab API intake blocks when neither direction proves the blocking-risk ancestry', () => {
  const fixture = apiFixture();
  const riskMerges = new Set([QWORK_MR1552_MERGE_COMMIT_SHA, QWORK_MR1559_MERGE_COMMIT_SHA]);
  const reader = (endpoint) => {
    if (endpoint.startsWith('repository/compare?')) {
      const query = new URLSearchParams(endpoint.slice(endpoint.indexOf('?') + 1));
      const from = query.get('from');
      const to = query.get('to');
      if ((riskMerges.has(from) && to === fixture.head)
        || (from === fixture.head && riskMerges.has(to))) {
        return { compare_timeout: false, commits: [] };
      }
    }
    return fixture.reader(endpoint);
  };
  const report = scanQworkReleaseIntake({
    repoRoot: process.cwd(),
    releaseRef: 'origin/release/0.1',
    baselineCommit: fixture.baseline,
    caseIds: ['BETA-INIT-001'],
    frameworkCommit: 'd'.repeat(40),
    gitlabReader: reader,
    freshnessSource: 'gitlab-api',
  });
  assert.equal(report.decision, 'BLOCKED');
  assert.equal(report.policy.api_freshness.verified, false);
  assert.equal(report.blocking_risks[0].applicability, 'UNKNOWN');
  assert.equal(report.blocking_risks[0].status, 'BLOCKED');
  assert.deepEqual(report.blocking_risks[0].evidence_failures, ['release_ancestry_unknown']);
  assert.match(report.blockers.join('\n'), /阻断风险审计未通过/);
});

test('GitLab API freshness accounts a trusted single-parent squash MR', () => {
  const baseline = 'a'.repeat(40);
  const head = 'b'.repeat(40);
  const fixture = apiFixture({
    baseline,
    head,
    mergeCommitSha: '',
    squashCommitSha: head,
    compareCommits: [{
      id: head,
      parent_ids: [baseline],
      title: 'Squashed release change',
      message: 'Squashed release change',
      committed_date: '2026-09-03T01:00:00Z',
    }],
    changes: [{
      old_path: 'server/engine.mjs',
      new_path: 'server/engine.mjs',
      diff: '+export const routed = true;',
    }],
  });
  const report = scanQworkReleaseIntake({
    repoRoot: process.cwd(),
    releaseRef: 'origin/release/0.1',
    baselineCommit: fixture.baseline,
    caseIds: ['MRSMOKE-FAIL-001'],
    frameworkCommit: 'd'.repeat(40),
    gitlabReader: fixture.reader,
    freshnessSource: 'gitlab-api',
  });
  assert.equal(report.decision, 'READY', report.blockers.join('; '));
  assert.deepEqual(report.commit_accounting, [{
    commit: head,
    parent_count: 1,
    classification: 'squash_mr',
    mr_iid: '901',
    attribution_verified: true,
    reason: '',
  }]);
  assert.equal(report.merge_requests[0].attribution_kind, 'squash_mr');
  assert.equal(report.policy.api_freshness.first_parent_commit_count, 1);
  assert.equal(report.policy.api_freshness.accounted_commit_count, 1);
  assert.equal(report.policy.api_freshness.merge_commit_count, 0);
  assert.equal(report.policy.api_freshness.squash_mr_commit_count, 1);
  assert.equal(report.policy.api_freshness.unattributed_direct_commit_count, 0);
  assert.equal(validateQworkReleaseIntake(report, { requireFreshRef: true }).ok, true);
});

test('GitLab API freshness never drops an unattributed single-parent HEAD', () => {
  const baseline = 'a'.repeat(40);
  const head = 'b'.repeat(40);
  const fixture = apiFixture({
    baseline,
    head,
    compareCommits: [{
      id: head,
      parent_ids: [baseline],
      title: 'Direct release commit',
      message: 'Direct release commit',
      committed_date: '2026-09-03T01:00:00Z',
    }],
    commitMrRows: new Map([[head, []]]),
  });
  const report = scanQworkReleaseIntake({
    repoRoot: process.cwd(),
    releaseRef: 'origin/release/0.1',
    baselineCommit: fixture.baseline,
    caseIds: ['MRSMOKE-FAIL-001'],
    frameworkCommit: 'd'.repeat(40),
    gitlabReader: fixture.reader,
    freshnessSource: 'gitlab-api',
  });
  assert.equal(report.decision, 'BLOCKED');
  assert.deepEqual(report.unresolved.unattributed_direct_commits, [head]);
  assert.equal(report.commit_accounting.length, 1);
  assert.equal(report.commit_accounting[0].classification, 'unattributed_direct_commit');
  assert.equal(report.policy.api_freshness.first_parent_commit_count, 1);
  assert.equal(report.policy.api_freshness.accounted_commit_count, 1);
  assert.equal(report.policy.api_freshness.unattributed_direct_commit_count, 1);
  assert.equal(report.policy.api_freshness.mr_changes_verified_count, 0);
  assert.match(report.blockers.join('\n'), /无法可信归因/);
});

test('GitLab API freshness accounts a direct commit between two merge commits', () => {
  const baseline = 'a'.repeat(40);
  const firstMerge = 'b'.repeat(40);
  const direct = 'c'.repeat(40);
  const head = 'd'.repeat(40);
  const mrRow = (iid, commitSha) => ({
    iid,
    title: `release change ${iid}`,
    state: 'merged',
    target_branch: 'release/0.1',
    source_branch: `feature/release-${iid}`,
    merge_commit_sha: commitSha,
    squash_commit_sha: '',
    merged_at: '2026-09-03T01:00:00Z',
    labels: ['area/runtime'],
  });
  const mrChanges = (iid, commitSha) => ({
    iid,
    state: 'merged',
    target_branch: 'release/0.1',
    merge_commit_sha: commitSha,
    squash_commit_sha: '',
    changes_count: '1',
    overflow: false,
    changes: [{
      old_path: 'server/engine.mjs',
      new_path: 'server/engine.mjs',
      diff: `+export const mr${iid} = true;`,
    }],
  });
  const fixture = apiFixture({
    baseline,
    head,
    compareCommits: [
      {
        id: firstMerge,
        parent_ids: [baseline, 'e'.repeat(40)],
        title: 'First merge',
        message: 'First merge',
        committed_date: '2026-09-03T01:00:00Z',
      },
      {
        id: direct,
        parent_ids: [firstMerge],
        title: 'Direct release commit',
        message: 'Direct release commit',
        committed_date: '2026-09-03T01:01:00Z',
      },
      {
        id: head,
        parent_ids: [direct, 'f'.repeat(40)],
        title: 'Second merge',
        message: 'Second merge',
        committed_date: '2026-09-03T01:02:00Z',
      },
    ],
    commitMrRows: new Map([
      [firstMerge, [mrRow(1001, firstMerge)]],
      [direct, []],
      [head, [mrRow(1002, head)]],
    ]),
    mrChangesByIid: new Map([
      ['1001', mrChanges(1001, firstMerge)],
      ['1002', mrChanges(1002, head)],
    ]),
  });
  const report = scanQworkReleaseIntake({
    repoRoot: process.cwd(),
    releaseRef: 'origin/release/0.1',
    baselineCommit: fixture.baseline,
    caseIds: ['MRSMOKE-FAIL-001'],
    frameworkCommit: 'd'.repeat(40),
    gitlabReader: fixture.reader,
    freshnessSource: 'gitlab-api',
  });
  assert.equal(report.decision, 'BLOCKED');
  assert.deepEqual(report.commit_accounting.map((row) => row.commit), [firstMerge, direct, head]);
  assert.deepEqual(report.commit_accounting.map((row) => row.classification), [
    'merge_mr',
    'unattributed_direct_commit',
    'merge_mr',
  ]);
  assert.deepEqual(report.unresolved.unattributed_direct_commits, [direct]);
  assert.equal(report.policy.api_freshness.first_parent_commit_count, 3);
  assert.equal(report.policy.api_freshness.accounted_commit_count, 3);
  assert.equal(report.policy.api_freshness.merge_commit_count, 2);
  assert.equal(report.policy.api_freshness.unattributed_direct_commit_count, 1);
  assert.equal(report.policy.api_freshness.mr_changes_verified_count, 2);
  assert.equal(report.merge_requests.length, 2);
});

for (const scenario of [
  { name: 'wrong squash SHA', options: { squashCommitSha: 'c'.repeat(40) } },
  { name: 'unmerged squash MR', options: { mrState: 'opened' } },
  { name: 'wrong squash target branch', options: { targetBranch: 'main' } },
  {
    name: 'changes squash identity mismatch',
    options: {
      mrChangesByIid: new Map([['901', {
        iid: 901,
        state: 'merged',
        target_branch: 'release/0.1',
        merge_commit_sha: '',
        squash_commit_sha: 'c'.repeat(40),
        changes_count: '1',
        overflow: false,
        changes: [{ old_path: 'server/engine.mjs', new_path: 'server/engine.mjs', diff: '+change' }],
      }]]),
    },
  },
]) {
  test(`GitLab API freshness fail-closes claimed squash MR with ${scenario.name}`, () => {
    const baseline = 'a'.repeat(40);
    const head = 'b'.repeat(40);
    const fixture = apiFixture({
      baseline,
      head,
      mergeCommitSha: '',
      squashCommitSha: head,
      compareCommits: [{
        id: head,
        parent_ids: [baseline],
        title: 'Claimed squash release change',
        message: 'Claimed squash release change',
        committed_date: '2026-09-03T01:00:00Z',
      }],
      changes: [{ old_path: 'server/engine.mjs', new_path: 'server/engine.mjs', diff: '+change' }],
      ...scenario.options,
    });
    const report = scanQworkReleaseIntake({
      repoRoot: process.cwd(),
      releaseRef: 'origin/release/0.1',
      baselineCommit: fixture.baseline,
      caseIds: ['MRSMOKE-FAIL-001'],
      frameworkCommit: 'd'.repeat(40),
      gitlabReader: fixture.reader,
      freshnessSource: 'gitlab-api',
    });
    assert.equal(report.decision, 'BLOCKED');
    assert.equal(report.policy.api_freshness.verified, false);
    assert.equal(report.policy.api_freshness.unattributed_direct_commit_count, 1);
    assert.deepEqual(report.unresolved.unattributed_direct_commits, [head]);
  });
}

test('release intake validation rejects rehashed first-parent accounting drift', () => {
  const fixture = apiFixture();
  const report = scanQworkReleaseIntake({
    repoRoot: process.cwd(),
    releaseRef: 'origin/release/0.1',
    baselineCommit: fixture.baseline,
    caseIds: ['BETA-INIT-001'],
    frameworkCommit: 'd'.repeat(40),
    gitlabReader: fixture.reader,
    freshnessSource: 'gitlab-api',
  });
  assert.equal(report.decision, 'READY', report.blockers.join('; '));
  const forged = structuredClone(report);
  forged.policy.api_freshness.accounted_commit_count += 1;
  const forgedValue = structuredClone(forged);
  delete forgedValue.integrity.content_sha256;
  forged.integrity.content_sha256 = sha256Text(stableJson(forgedValue));
  const validation = validateQworkReleaseIntake(forged, { requireFreshRef: true });
  assert.equal(validation.ok, false);
  assert.equal(
    validation.failures.includes('commit_accounting:accounted_commit_count_mismatch'),
    true,
  );
  assert.equal(validation.failures.includes('content_sha256_mismatch'), false);
});

test('release intake validation rejects a rehashed MR ledger forged inside an empty first-parent boundary', () => {
  const head = 'b'.repeat(40);
  const emptyFixture = apiFixture({ baseline: head, head, compareCommits: [] });
  const emptyReport = scanQworkReleaseIntake({
    repoRoot: process.cwd(),
    releaseRef: 'origin/release/0.1',
    baselineCommit: emptyFixture.baseline,
    caseIds: ['BETA-INIT-001'],
    frameworkCommit: 'd'.repeat(40),
    gitlabReader: emptyFixture.reader,
    freshnessSource: 'gitlab-api',
  });
  assert.equal(emptyReport.decision, 'READY', emptyReport.blockers.join('; '));
  assert.equal(emptyReport.commit_accounting.length, 0);
  assert.equal(emptyReport.merge_requests.length, 0);

  const populatedFixture = apiFixture({ head });
  const populatedReport = scanQworkReleaseIntake({
    repoRoot: process.cwd(),
    releaseRef: 'origin/release/0.1',
    baselineCommit: populatedFixture.baseline,
    caseIds: ['BETA-INIT-001'],
    frameworkCommit: 'd'.repeat(40),
    gitlabReader: populatedFixture.reader,
    freshnessSource: 'gitlab-api',
  });
  assert.equal(populatedReport.decision, 'READY', populatedReport.blockers.join('; '));

  const forged = structuredClone(emptyReport);
  forged.commit_accounting = structuredClone(populatedReport.commit_accounting);
  forged.merge_requests = structuredClone(populatedReport.merge_requests);
  forged.merge_requests[0].parent = head;
  for (const field of [
    'compare_commit_count',
    'first_parent_commit_count',
    'accounted_commit_count',
    'merge_commit_count',
    'squash_mr_commit_count',
    'unattributed_direct_commit_count',
    'attributed_mr_commit_count',
    'first_parent_merge_count',
    'mr_changes_verified_count',
  ]) forged.policy.api_freshness[field] = populatedReport.policy.api_freshness[field];
  forged.policy.api_freshness.compare_from = head;
  forged.policy.api_freshness.compare_to = head;
  for (const field of [
    'scanned_commit_count',
    'merge_request_count',
    'direct_case_ids',
    'dependency_case_ids',
    'required_stages',
    'static_only_count',
    'unknown_count',
  ]) forged.summary[field] = structuredClone(populatedReport.summary[field]);
  forged.unresolved.unmapped_product_paths = structuredClone(populatedReport.unresolved.unmapped_product_paths);
  forged.unresolved.out_of_scope_case_ids = structuredClone(populatedReport.unresolved.out_of_scope_case_ids);
  const forgedValue = structuredClone(forged);
  delete forgedValue.integrity.content_sha256;
  forged.integrity.content_sha256 = sha256Text(stableJson(forgedValue));

  const validation = validateQworkReleaseIntake(forged, {
    requireFreshRef: true,
    requireGitLabApiFreshness: true,
  });
  assert.equal(validation.ok, false);
  assert.equal(
    validation.failures.includes('merge_request_semantics:zero_length_boundary_not_empty'),
    true,
    validation.failures.join(','),
  );
  assert.equal(
    validation.failures.includes(`merge_request_semantics:first_parent_self_cycle:${head}`),
    true,
    validation.failures.join(','),
  );
  assert.equal(validation.failures.includes('content_sha256_mismatch'), false);
});

test('release intake validation replays MR attribution, impact and coverage after report rehashing', () => {
  const fixture = apiFixture();
  const report = scanQworkReleaseIntake({
    repoRoot: process.cwd(),
    releaseRef: 'origin/release/0.1',
    baselineCommit: fixture.baseline,
    caseIds: ['BETA-INIT-001', 'MRSMOKE-FAIL-001', 'BETA-CHAT-005'],
    frameworkCommit: 'd'.repeat(40),
    gitlabReader: fixture.reader,
    freshnessSource: 'gitlab-api',
  });
  assert.equal(report.decision, 'READY', report.blockers.join('; '));
  const rehash = (candidate) => {
    const value = structuredClone(candidate);
    delete value.integrity.content_sha256;
    candidate.integrity.content_sha256 = sha256Text(stableJson(value));
    return candidate;
  };
  const scenarios = [
    {
      expected: 'merge_request_semantics:commit_accounting_binding_mismatch',
      mutate(candidate) { candidate.merge_requests[0].iid = '999999'; },
    },
    {
      expected: 'merge_request_semantics:first_parent_chain_mismatch',
      mutate(candidate) { candidate.merge_requests[0].parent = '9'.repeat(40); },
    },
    {
      expected: 'merge_request_semantics:compare_from_boundary_mismatch',
      mutate(candidate) { candidate.scan_boundary.baseline_commit = '9'.repeat(40); },
    },
    {
      expected: 'merge_request_semantics:compare_to_release_mismatch',
      mutate(candidate) { candidate.policy.api_freshness.compare_to = '9'.repeat(40); },
    },
    {
      expected: 'merge_request_semantics:metadata_binding_mismatch',
      mutate(candidate) { candidate.merge_requests[0].target_branch = 'main'; },
    },
    {
      expected: 'merge_request_semantics:impact_mismatch',
      mutate(candidate) { candidate.merge_requests[0].impact.mapping_status = 'UNKNOWN'; },
    },
    {
      expected: 'merge_request_semantics:source_contract_ids_mismatch',
      mutate(candidate) { candidate.merge_requests[0].source_contract_ids = ['forged-contract']; },
    },
    {
      expected: 'merge_request_semantics:summary_direct_case_ids_mismatch',
      mutate(candidate) { candidate.summary.direct_case_ids = ['FORGED-CASE']; },
    },
    {
      expected: 'merge_request_semantics:summary_dependency_case_ids_mismatch',
      mutate(candidate) { candidate.summary.dependency_case_ids = ['FORGED-DEPENDENCY']; },
    },
  ];
  for (const scenario of scenarios) {
    const forged = structuredClone(report);
    scenario.mutate(forged);
    const validation = validateQworkReleaseIntake(rehash(forged), {
      requireFreshRef: true,
      requireGitLabApiFreshness: true,
    });
    assert.equal(validation.ok, false, scenario.expected);
    assert.equal(
      validation.failures.some((failure) => failure.startsWith(scenario.expected)),
      true,
      `${scenario.expected}: ${validation.failures.join(',')}`,
    );
    assert.equal(validation.failures.includes('content_sha256_mismatch'), false, scenario.expected);
  }
});

test('MR !1573 impact replay rejects removed memory coverage or G4 after related summaries are rehashed', () => {
  const contract = QWORK_MR1573_MEMORY_SESSION_PROFILE_STABILITY_CONTRACT;
  const caseIds = [
    'SIT-MEM-001',
    'BETA-CHAT-001',
    'BETA-CHAT-002',
    'BETA-CHAT-009',
    'BETA-SEC-002',
    'BETA-MCP-001',
    'BETA-MCP-002',
    'BETA-HOST-003',
    'BETA-INIT-001',
    'BETA-ROUTE-001',
    'MRSMOKE-ROUTE-001',
  ];
  const fixture = apiFixture({
    head: contract.merge_commit_sha,
    mrIid: Number(contract.mr_iid),
    mergeCommitSha: contract.merge_commit_sha,
    changes: [{
      old_path: 'server/qbot-core/engine/memory-runtime.mjs',
      new_path: 'server/qbot-core/engine/memory-runtime.mjs',
      diff: '+export const memorySessionProfileStability = true;',
    }],
  });
  const report = scanQworkReleaseIntake({
    repoRoot: process.cwd(),
    releaseRef: 'origin/release/0.1',
    baselineCommit: fixture.baseline,
    caseIds,
    frameworkCommit: 'd'.repeat(40),
    gitlabReader: fixture.reader,
    freshnessSource: 'gitlab-api',
  });
  const baselineValidation = validateQworkReleaseIntake(report, { requireReady: false });
  assert.equal(
    baselineValidation.failures.some((failure) => failure.startsWith('merge_request_semantics:impact_mismatch')),
    false,
    baselineValidation.failures.join(','),
  );

  const rehash = (candidate) => {
    const value = structuredClone(candidate);
    delete value.integrity.content_sha256;
    candidate.integrity.content_sha256 = sha256Text(stableJson(value));
    return candidate;
  };
  const scenarios = [
    {
      name: 'SIT-MEM-001',
      mutate(candidate) {
        const impact = candidate.merge_requests[0].impact;
        impact.direct_case_ids = impact.direct_case_ids.filter((id) => id !== 'SIT-MEM-001');
        impact.in_scope_case_ids = impact.in_scope_case_ids.filter((id) => id !== 'SIT-MEM-001');
        candidate.summary.direct_case_ids = candidate.summary.direct_case_ids
          .filter((id) => id !== 'SIT-MEM-001');
      },
    },
    {
      name: 'G4',
      mutate(candidate) {
        candidate.merge_requests[0].impact.required_stages = candidate.merge_requests[0]
          .impact.required_stages.filter((stage) => stage !== 'G4');
        candidate.summary.required_stages = candidate.summary.required_stages
          .filter((stage) => stage !== 'G4');
      },
    },
  ];
  for (const scenario of scenarios) {
    const forged = structuredClone(report);
    scenario.mutate(forged);
    const validation = validateQworkReleaseIntake(rehash(forged), { requireReady: false });
    assert.equal(validation.ok, false, scenario.name);
    assert.equal(
      validation.failures.some((failure) => failure.startsWith('merge_request_semantics:impact_mismatch')),
      true,
      `${scenario.name}: ${validation.failures.join(',')}`,
    );
    assert.equal(validation.failures.includes('content_sha256_mismatch'), false, scenario.name);
  }
});

const successorDeadlineV5 = `
const { createEnvelope, validateEnvelope } = require('./execution-worker-protocol.cjs');
const { isExecutionWorkerTerminalOperation } = require('./execution-worker-context-usage.cjs');
function validateExecutionWorkerReply(raw, pending, now) {
  const expired = pending.get(raw?.requestId);
  const validationTime = expired?.deadlineExpired && expired.matches(raw)
    && raw.deadlineAt === expired.deadlineAt ? expired.deadlineAt - 1 : now();
  const message = validateEnvelope(raw, { direction: 'worker-to-host', now: validationTime });
  if (expired?.deadlineExpired && expired.matches(message)) {
    if (isExecutionWorkerTerminalOperation(message.operation)) {
      clearTimeout(expired.cancelDeadline);
      pending.delete(message.requestId);
    }
    return { ...message, operation: 'execution.expired' };
  }
  return message;
}
function settleExpiredExecutionWorkerReply(message, pending) {
  const expired = pending.get(message.requestId);
  if (!expired?.deadlineExpired || !expired.matches(message)) return false;
  if (isExecutionWorkerTerminalOperation(message.operation)) {
    clearTimeout(expired.cancelDeadline);
    pending.delete(message.requestId);
  }
  return true;
}
function cancelExpiredExecution({ message, item, pending, child, terminateChild, now, graceMs }) {
  const requestedGraceMs = Number(graceMs);
  const boundedGraceMs = Number.isSafeInteger(requestedGraceMs) && requestedGraceMs > 0
    ? Math.min(requestedGraceMs, 2147483647) : 1;
  item.deadlineExpired = true;
  item.cancelDeadline = setTimeout(() => {
    if (pending.get(message.requestId) === item) terminateChild(child, 'request-deadline-timeout');
  }, boundedGraceMs);
  item.cancelDeadline.unref?.();
  try {
    child.postMessage(createEnvelope('execution.cancel', message,
      { reason: 'execution_worker_deadline_exceeded' },
      { deadlineMs: boundedGraceMs, now: now() }));
  } catch {
    terminateChild(child, 'request-deadline-timeout');
  }
}
function scheduleExecutionWorkerDeadline({ message, pending, child, terminateChild, now, deadlineMs, graceMs }) {
  const requestedDeadlineMs = Number(deadlineMs);
  const boundedDeadlineMs = Number.isSafeInteger(requestedDeadlineMs) && requestedDeadlineMs > 0
    ? Math.min(requestedDeadlineMs, 2147483646) : 1;
  const timer = setTimeout(() => {
    const item = pending.get(message.requestId);
    if (!item) return;
    const error = Object.assign(new Error('execution worker request deadline exceeded'), {
      code: 'execution_worker_deadline_exceeded',
    });
    item.reject(error);
    if (message.operation !== 'execution.start') {
      pending.delete(message.requestId);
      return;
    }
    cancelExpiredExecution({ message, item, pending, child, terminateChild, now, graceMs });
  }, boundedDeadlineMs + 1);
  timer.unref?.();
  return timer;
}
function createExecutionWorkerDeadlineCallbacks({ operation, requestId, message, pending, child, terminateChild, now, graceMs }) {
  const requestedCallbackGraceMs = Number(graceMs);
  const boundedCallbackGraceMs = Number.isSafeInteger(requestedCallbackGraceMs)
    && requestedCallbackGraceMs > 0
    ? Math.min(requestedCallbackGraceMs, 2147483647) : 1;
  return {
    onDeadline: () => {
      const item = pending.get(requestId);
      if (operation !== 'execution.start') {
        pending.delete(requestId);
        return;
      }
      if (!item) return;
      item.deadlineExpired = true;
      item.deadlineAt = message.deadlineAt;
      try {
        child.postMessage(createEnvelope('execution.cancel', message,
          { reason: 'execution_worker_deadline_exceeded' },
          { deadlineMs: boundedCallbackGraceMs, now: now() }));
      } catch {
        return terminateChild(child, 'request-deadline-timeout');
      }
    },
    onCancellationTimeout: () => {
      if (pending.has(requestId)) return terminateChild(child, 'request-deadline-timeout');
    },
  };
}
module.exports = {
  validateExecutionWorkerReply,
  settleExpiredExecutionWorkerReply,
  scheduleExecutionWorkerDeadline,
  createExecutionWorkerDeadlineCallbacks,
};
`;

const successorCallbackSettlementV5 = `
const BEST_EFFORT_CALLBACKS = new Set([
  'onExecutionPhase', 'onCriticalPathTiming', 'onProviderReceiptHash',
  'onContextUsageSnapshot', 'onModelGatewayDiagnostic', 'onProviderDiagnostic',
  'onNativeSessionCreated', 'onToolFailureDiagnostic', 'onRaw', 'onRawDiagnostic',
  'onCompactDiagnostic',
]);
const IMMEDIATE_NON_BLOCKING_CALLBACKS = new Set([
  'onExecutionPhase', 'onCriticalPathTiming', 'onProviderReceiptHash',
  'onModelGatewayDiagnostic', 'onProviderDiagnostic',
]);
const DEFERRED_OBSERVER_CALLBACKS = new Set([
  'onRaw', 'onRawDiagnostic', 'onCompactDiagnostic',
]);
const RESERVED_OBSERVER_CALLBACKS = new Set([
  'onExecutionPhase', 'onCriticalPathTiming', 'onProviderReceiptHash',
  'onContextUsageSnapshot', 'onModelGatewayDiagnostic', 'onProviderDiagnostic',
  'onNativeSessionCreated', 'onToolFailureDiagnostic', 'onCompactDiagnostic',
  'onRaw', 'onRawDiagnostic',
]);
const RAW_OBSERVER_CALLBACKS = new Set(['onRaw', 'onRawDiagnostic']);
function isBestEffortExecutionWorkerCallback(name) {
  return BEST_EFFORT_CALLBACKS.has(String(name || ''));
}
function isImmediateNonBlockingExecutionWorkerCallback(name) {
  return IMMEDIATE_NON_BLOCKING_CALLBACKS.has(String(name || ''));
}
function isReservedExecutionWorkerObserverCallback(name) {
  return RESERVED_OBSERVER_CALLBACKS.has(String(name || ''));
}
function isRawExecutionWorkerObserverCallback(name) {
  return RAW_OBSERVER_CALLBACKS.has(String(name || ''));
}
function reportBestEffortFailure(name) {
  try {
    console.warn('[execution-worker] best-effort callback failed', {
      callback: String(name || '').slice(0, 80),
      redacted: true,
    });
  } catch {}
}
function invokeCallback(callback, name, value) {
  return Array.isArray(value) && name === 'onCriticalPathTiming'
    ? callback(...value) : callback(value);
}
function settleExecutionWorkerCallback({ callbacks = {}, message = {}, settlements = [] } = {}) {
  const payload = message?.payload && typeof message.payload === 'object' ? message.payload : {};
  const name = String(payload.callback || '');
  if (!Object.hasOwn(callbacks, name) || typeof callbacks[name] !== 'function') return false;
  const callback = callbacks[name];
  const bestEffort = isBestEffortExecutionWorkerCallback(name);
  const immediateObserver = isReservedExecutionWorkerObserverCallback(name);
  const deferredObserver = DEFERRED_OBSERVER_CALLBACKS.has(name);
  if (bestEffort && (!immediateObserver || deferredObserver)) {
    setImmediate(() => {
      let settlement;
      try {
        settlement = invokeCallback(callback, name, payload.value);
      } catch {
        reportBestEffortFailure(name);
        return;
      }
      void Promise.resolve(settlement).catch(() => reportBestEffortFailure(name));
    });
    return true;
  }
  let settlement;
  try {
    settlement = invokeCallback(callback, name, payload.value);
  } catch (error) {
    if (!bestEffort) throw error;
    reportBestEffortFailure(name);
    return true;
  }
  if (immediateObserver || isImmediateNonBlockingExecutionWorkerCallback(name)) {
    void Promise.resolve(settlement).catch(() => reportBestEffortFailure(name));
  } else {
    settlements.push(Promise.resolve(settlement));
  }
  return true;
}
module.exports = {
  isBestEffortExecutionWorkerCallback,
  isImmediateNonBlockingExecutionWorkerCallback,
  isRawExecutionWorkerObserverCallback,
  isReservedExecutionWorkerObserverCallback,
  settleExecutionWorkerCallback,
};
`;

const successorEventFlowV5 = `
const DEFAULT_WINDOW_MS = 100;
const DEFAULT_MAX_KEYS = 128;
const { isExecutionWorkerTerminalOperation } = require('./execution-worker-context-usage.cjs');
const { logExecutionWorkerCancellation, observeExecutionWorkerEvent } = require('./execution-worker-process-lifecycle.cjs');
function activityKey(fact) {
  return \`\${String(fact?.scope || '')}\\u0000\${String(fact?.node || '')}\\u0000\${String(fact?.identity || '')}\`;
}
function isCoalescibleRuntimeActivity(fact) {
  if (!fact || fact.edge !== 'progressed') return false;
  if (fact.node === 'semantic_delta') return fact.contentKind === 'tool_input';
  return (fact.node === 'tool_activity' || fact.node === 'hook_activity')
    && (fact.progressClass === 'liveness' || fact.progressClass === 'advisory');
}
function isTerminalActivity(fact) {
  return fact?.progressClass === 'terminal'
    || fact?.node === 'runtime_terminal_received' || fact?.node === 'transport_lost';
}
class RuntimeActivityCoalescer {
  constructor({ emit, now = Date.now, schedule = setTimeout, cancel = clearTimeout,
    windowMs = DEFAULT_WINDOW_MS, maxKeys = DEFAULT_MAX_KEYS } = {}) {
    if (typeof emit !== 'function') throw new TypeError('runtime activity coalescer requires emit');
    const requestedWindowMs = Number(windowMs);
    const boundedWindowMs = Number.isSafeInteger(requestedWindowMs) && requestedWindowMs > 0
      ? Math.min(requestedWindowMs, 2147483647) : 100;
    const requestedMaxKeys = Number(maxKeys);
    const boundedMaxKeys = Number.isSafeInteger(requestedMaxKeys) && requestedMaxKeys > 0
      ? Math.min(requestedMaxKeys, 128) : 128;
    this.emit = emit;
    this.now = now;
    this.schedule = schedule;
    this.cancel = cancel;
    this.windowMs = boundedWindowMs;
    this.maxKeys = boundedMaxKeys;
    this.entries = new Map();
    this.closed = false;
    this.lastEmittedSequence = -1;
  }
  emitFresh(fact) {
    const sourceSequence = Number(fact?.sourceSequence);
    if (Number.isSafeInteger(sourceSequence)) {
      if (sourceSequence <= this.lastEmittedSequence) return;
      this.lastEmittedSequence = sourceSequence;
    }
    this.emit(fact);
  }
  discard(key) {
    const entry = this.entries.get(key);
    if (!entry) return;
    this.entries.delete(key);
    if (!entry.timer) return;
    try { this.cancel(entry.timer); } catch {}
  }
  clear() {
    for (const key of this.entries.keys()) this.discard(key);
  }
  flush(key) {
    if (this.closed) return;
    const entry = this.entries.get(key);
    if (!entry?.pending) return;
    const value = entry.pending;
    entry.pending = null;
    entry.timer = null;
    entry.lastSentAt = this.now();
    this.emitFresh(value);
  }
  arm(key, entry, delay) {
    const requestedDelay = Number(delay);
    const boundedDelay = Number.isSafeInteger(requestedDelay) && requestedDelay > 0
      ? Math.min(requestedDelay, 2147483647) : 1;
    try {
      entry.timer = this.schedule(() => this.flush(key), boundedDelay);
      entry.timer?.unref?.();
    } catch {
      const value = entry.pending;
      this.entries.delete(key);
      if (value) this.emitFresh(value);
    }
  }
  push(fact) {
    if (this.closed || !fact) return;
    const key = activityKey(fact);
    if (!isCoalescibleRuntimeActivity(fact)) {
      if (isTerminalActivity(fact)) this.clear();
      else this.discard(key);
      this.emitFresh(fact);
      return;
    }
    let entry = this.entries.get(key);
    const currentTime = this.now();
    if (!entry) {
      if (this.entries.size >= this.maxKeys) return;
      entry = { lastSentAt: currentTime, pending: null, timer: null };
      this.entries.set(key, entry);
      this.emitFresh(fact);
      return;
    }
    if (currentTime - entry.lastSentAt >= this.windowMs && !entry.timer) {
      entry.lastSentAt = currentTime;
      this.emitFresh(fact);
      return;
    }
    entry.pending = fact;
    if (!entry.timer) this.arm(key, entry,
      Math.max(0, this.windowMs - (currentTime - entry.lastSentAt)));
  }
  close() {
    if (this.closed) return;
    this.closed = true;
    this.clear();
  }
  pendingCount() {
    let count = 0;
    for (const entry of this.entries.values()) count += entry.pending ? 1 : 0;
    return count;
  }
}
function createRuntimeActivityCoalescer(options) {
  return new RuntimeActivityCoalescer(options);
}
function dispatchExecutionEvent(item, message, postBrokerResult) {
  item.lastSequence = message.sequence;
  try {
    item.onEvent(message);
  } finally {
    postBrokerResult('stream.credit', message, { credit: 1 });
  }
}
function routeExecutionWorkerResultMessage(message, {
  pending, child, terminateChild, contextUsageRoutes, now, postBrokerResult, logger,
}) {
  if (contextUsageRoutes.handle(message, pending, child, terminateChild)) return true;
  if (message.operation === 'execution.event') {
    const item = pending.get(message.requestId);
    if (!item || !item.matches(message)) return true;
    if (message.sequence <= item.lastSequence) {
      const error = new Error('execution worker emitted a non-monotonic event sequence');
      error.code = 'execution_worker_sequence_violation';
      pending.delete(message.requestId);
      item.reject(error);
      terminateChild(child, 'sequence-violation');
      return true;
    }
    observeExecutionWorkerEvent(item, message, now());
    dispatchExecutionEvent(item, message, postBrokerResult);
    return true;
  }
  if (!isExecutionWorkerTerminalOperation(message.operation)) return false;
  const item = pending.get(message.requestId);
  if (!item || !item.matches(message)) return true;
  if (message.operation === 'execution.terminal')
    logExecutionWorkerCancellation(logger, item, message, now());
  pending.delete(message.requestId);
  contextUsageRoutes.retain(message, item);
  item.resolve(message);
  return true;
}
module.exports = { dispatchExecutionEvent, routeExecutionWorkerResultMessage };
`;

const successorEventEntryV5 = `
const { createRuntimeActivityCoalescer } = require('./execution-worker-event-flow.cjs');
function createExecution() {
  const runtimeActivity = createRuntimeActivityCoalescer({
    emit: (value) => emit('onRuntimeActivity', value),
  });
  const callbacks = {
    onRuntimeActivity: (value) => runtimeActivity.push(value),
  };
  return {
    queueDepth: () => {
      return runtimeActivity.pendingCount();
    },
    run: async () => {
      try {
        return true;
      } finally {
        runtimeActivity.close();
      }
    },
  };
}
`;

test('GitLab API intake switches MR !1552 blocking-risk assertions to the proven MR !1559 architecture', () => {
  const fixture = apiFixture({
    head: QWORK_MR1559_MERGE_COMMIT_SHA,
    mergeCommitSha: QWORK_MR1559_MERGE_COMMIT_SHA,
    mrIid: 1559,
  });
  const sources = new Map([
    ['electron/execution-worker.cjs', `
      require('./host-core/agent/execution-worker-controller.cjs').startExecutionWorkerController();
    `],
    ['electron/host-core/agent/execution-worker-controller.cjs', `
      const AUTHORITY_FIELDS = ['principalId', 'serverScope', 'runtimeGeneration', 'ownershipGeneration'];
      const TURN_FIELDS = [...AUTHORITY_FIELDS, 'sessionId', 'turnId'];
      const { Worker } = require('node:worker_threads');
      const { validateEnvelope } = require('./execution-worker-protocol.cjs');
      const sameIdentity = (message, authority, fields) => authority
        && fields.every((field) => message[field] === authority[field]);
      class ExecutionWorkerController {
        constructor({
          parentPort = process.parentPort,
          createRunner = () => new Worker(require.resolve('./execution-worker-entry.cjs')),
          exit = (code) => process.exit(code),
        } = {}) {
          Object.assign(this, { parentPort, createRunner, exit, runner: null, authority: null,
            turn: null, heartbeat: null, stopped: false });
        }
        finish(code) {
          if (this.stopped) return;
          this.stopped = true;
          this.exit(code);
        }
        decode(raw, direction) {
          try { return validateEnvelope(raw, { direction }); }
          catch { this.finish(1); return null; }
        }
        onRunnerMessage(raw) {
          if (this.stopped) return;
          const message = this.decode(raw, 'worker-to-host');
          if (!message || !sameIdentity(message, this.authority, AUTHORITY_FIELDS)) return;
          if (message.operation === 'worker.heartbeat') return;
          if (message.operation === 'worker.ready') this.startHeartbeat();
          else if (message.operation !== 'worker.pressure'
            && !sameIdentity(message, this.turn, TURN_FIELDS)) return;
          this.parentPort.postMessage(message);
        }
        onRunnerError(error) { this.finish(error ? 1 : 0); }
        onRunnerExit(code) { this.finish(code === 0 ? 0 : 1); }
        initialize(message) {
          if (this.authority) return false;
          this.authority = message;
          this.runner = this.createRunner();
          this.runner.on('message', (raw) => this.onRunnerMessage(raw));
          this.runner.on('error', (error) => this.onRunnerError(error));
          this.runner.on('exit', (code) => this.onRunnerExit(code));
          return true;
        }
        acceptMessage(message) {
          if (message.operation === 'worker.initialize') return this.initialize(message);
          if (!sameIdentity(message, this.authority, AUTHORITY_FIELDS)) return false;
          if (message.operation === 'worker.shutdown') { this.finish(0); return false; }
          if (message.operation === 'execution.start') {
            if (this.turn) return false;
            this.turn = message;
            return true;
          }
          if (!sameIdentity(message, this.turn, TURN_FIELDS)) return false;
          return message.operation === 'context-usage.refresh'
            ? message.payload.executionRequestId === this.turn.requestId
            : message.requestId === this.turn.requestId;
        }
        onHostMessage(raw) {
          if (this.stopped) return;
          const message = this.decode(raw, 'host-to-worker');
          if (!message || !this.acceptMessage(message)) return;
          this.runner.postMessage(message);
        }
      }
      function startExecutionWorkerController(options) {
        return new ExecutionWorkerController(options);
      }
      module.exports = { startExecutionWorkerController };
    `],
    ['electron/host-core/agent/execution-worker-manager.cjs', `
      function managerError(code, message) {
        const error = new Error(message);
        error.code = code;
        return error;
      }
      function waitForExecutionSlot(manager, requestId) {
        if (manager.executions.size >= manager.maxConcurrentExecutions) {
          return Promise.reject(managerError('execution_worker_pressure_admission_closed', 'queue full'));
        }
        return Promise.resolve(true);
      }
      async function acquireExecutionWorker(manager, operation, identity, options) {
        const requestId = identity.requestId;
        await waitForExecutionSlot(manager, requestId);
        const supervisor = manager.supervisorFactory({ maxPendingRequests: 1, maxRestarts: 0 });
        const record = { supervisor };
        manager.executions.set(requestId, record);
        const release = async () => {
          manager.executions.delete(requestId);
          await supervisor.stop();
        };
        return { supervisor, release };
      }
      function createExecutionWorkerManager(manager) {
        return { acquire: (operation, identity, options) => acquireExecutionWorker(manager, operation, identity, options) };
      }
    `],
    ['electron/host-core/agent/execution-worker-supervisor.cjs', `
      const { createExecutionWorkerRequestSettlement } = require('./execution-worker-cancellation.cjs');
      const { createExecutionWorkerTerminator } = require('./execution-worker-termination.cjs');
      const {
        handleExecutionWorkerEventMessage,
        handleExecutionWorkerObserverMessage,
      } = require('./execution-worker-supervisor-message.cjs');
      function rejectPending(error) { return error; }
      function executionWorkerExitFailure(code, signal) { return { code, signal }; }
      function createExecutionWorkerSupervisor() {
        const pending = new Map();
        let child = createChild();
        const terminateOwnedChild = createExecutionWorkerTerminator({
          processId, processTreeKiller, cleanupGraceMs: 250,
        });
        const terminateChild = (target = child, reason = 'terminated') => {
          return terminateOwnedChild(target, reason);
        };
        const onMessage = (message) => {
          if (message.operation === 'execution.event') {
            handleExecutionWorkerEventMessage(message, { pending, postBrokerResult, terminateChild, child });
            return;
          }
          if (message.operation === 'execution.observer') {
            handleExecutionWorkerObserverMessage(message, { pending });
            return;
          }
          if (isExecutionWorkerTerminalOperation(message.operation)) {
            const item = pending.get(message.requestId);
            if (!item || !item.matches(message)) return;
            pending.delete(message.requestId);
            item.resolve(message);
            return;
          }
        };
        const request = (operation, requestId) => new Promise((resolveRequest, reject) => {
          const settlement = createExecutionWorkerRequestSettlement({
            child, operation, deadlineMs, cancellationTimeoutMs, terminateChild,
            onDeadline: () => pending.delete(requestId), resolve: resolveRequest, reject,
          });
          pending.set(requestId, settlement);
        });
        const stop = async () => {
          const stoppedChild = child;
          await terminateChild(stoppedChild, 'stop');
          if (child === stoppedChild) child = null;
        };
        const onExit = (code, signal) => {
          rejectPending(executionWorkerExitFailure(code, signal));
        };
        return { onExit, onMessage, request, stop };
      }
    `],
    ['electron/host-core/agent/execution-worker-cancellation.cjs', `
      async function requestExecutionWorkerTurn(supervisor, operation, identity, payload, options, signal) {
        const pending = supervisor.request(operation, identity, payload, options);
        const cancelIdentity = identity;
        const onAbort = () => {
          supervisor.cancel(cancelIdentity, 'user-requested');
        };
        if (!signal) return await pending;
        signal.addEventListener('abort', onAbort, { once: true });
        if (signal.aborted) onAbort();
        try {
          return await pending;
        } finally {
          signal.removeEventListener('abort', onAbort);
        }
      }
      function createExecutionWorkerRequestSettlement({
        child, operation, deadlineMs, cancellationTimeoutMs, terminateChild, onDeadline, resolve, reject,
      }) {
        let cancellationTimer = null;
        const clear = () => { clearTimeout(deadline); clearTimeout(cancellationTimer); };
        const deadline = setTimeout(() => {
          clear();
          onDeadline();
          reject(new Error('execution worker request deadline exceeded'));
          if (operation === 'execution.start') void terminateChild(child, 'execution-deadline');
        }, deadlineMs + 1);
        return {
          armCancellation: () => {
            if (cancellationTimer) return;
            cancellationTimer = setTimeout(() => {
              void terminateChild(child, 'cancel-timeout');
            }, Math.max(1, cancellationTimeoutMs));
          },
          resolve: (value) => { clear(); resolve(value); },
          reject: (error) => { clear(); reject(error); },
        };
      }
      module.exports = { createExecutionWorkerRequestSettlement, requestExecutionWorkerTurn };
    `],
    ['electron/host-core/agent/execution-worker-deadline.cjs', successorDeadlineV5],
    ['electron/host-core/agent/execution-worker-callback-settlement.cjs', successorCallbackSettlementV5],
    ['electron/host-core/agent/execution-worker-event-flow.cjs', successorEventFlowV5],
    ['electron/host-core/agent/execution-worker-entry.cjs', successorEventEntryV5],
    ['electron/host-core/agent/execution-worker-termination.cjs', `
      function createExecutionWorkerTerminator({ processId, processTreeKiller, cleanupGraceMs = 250 } = {}) {
        const flights = new WeakMap();
        return (target, reason = 'terminated') => {
          if (!target) return Promise.resolve(false);
          const existing = flights.get(target);
          if (existing) return existing;
          const pid = processId(target.pid);
          const cleanup = Promise.resolve().then(() => processTreeKiller(pid, { reason }));
          const flight = Promise.race([
            cleanup,
            new Promise((resolve) => setTimeout(resolve, cleanupGraceMs)),
          ]).then(() => {
            target.kill?.();
            return true;
          });
          flights.set(target, flight);
          void flight.finally(() => flights.delete(target));
          return flight;
        };
      }
      module.exports = { createExecutionWorkerTerminator };
    `],
    ['electron/host-core/agent/execution-worker-supervisor-message.cjs', `
      function isReservedExecutionWorkerObserverCallback() { return true; }
      const { dispatchExecutionEvent } = require('./execution-worker-event-flow.cjs');
      function handleExecutionWorkerEventMessage(message, {
        pending, postBrokerResult, terminateChild, child,
      }) {
        const item = pending.get(message.requestId);
        if (!item || !item.matches(message)) return;
        if (message.sequence <= item.lastSequence) {
          const error = new Error('execution worker emitted a non-monotonic event sequence');
          pending.delete(message.requestId);
          item.reject(error);
          terminateChild(child, 'sequence-violation');
          return;
        }
        dispatchExecutionEvent(item, message, postBrokerResult);
      }
      function handleExecutionWorkerObserverMessage(message, { pending }) {
        const item = pending.get(message.requestId);
        if (!item || !item.matches(message)
          || !isReservedExecutionWorkerObserverCallback(message.payload?.callback)) return;
        item.onEvent?.(message);
      }
      module.exports = {
        handleExecutionWorkerEventMessage,
        handleExecutionWorkerObserverMessage,
      };
    `],
    ['electron/host-core/agent/desktop-host-context.cjs', `
      const { settleExecutionWorkerCallback } = require('./execution-worker-callback-settlement.cjs');
      const callbacks = {};
      async function runAgentInExecutionWorker(identity, signal) {
        let executionWorkerLease = null;
        try {
          const eventSettlements = [];
          executionWorkerLease = await executionWorkerManager.acquire('execution.start', identity, { signal });
          const supervisor = executionWorkerLease.supervisor;
          const terminal = await requestExecutionWorkerTurn(
            supervisor, 'execution.start', identity, {}, {
              onEvent: (message) => settleExecutionWorkerCallback({
                callbacks,
                message,
                settlements: eventSettlements,
              }),
            }, signal,
          );
          await Promise.all(eventSettlements);
        } finally {
          await executionWorkerLease?.release?.();
        }
      }
    `],
  ]);
  const blockingRiskFiles = new Map(QWORK_MR1559_SUCCESSOR_PROTECTED_PATHS.map((filePath, index) => {
    const source = sources.get(filePath) || `// current MR !1559 release source: ${filePath}\n`;
    return [filePath, {
      file_name: path.basename(filePath),
      file_path: filePath,
      size: Buffer.byteLength(source, 'utf8'),
      encoding: 'base64',
      content: Buffer.from(source, 'utf8').toString('base64'),
      ref: fixture.head,
      blob_id: gitBlobSha1(source),
      commit_id: fixture.head,
      last_commit_id: fixture.head,
    }];
  }));
  const reader = (endpoint) => {
    if (endpoint.startsWith('repository/compare?')) {
      const query = new URLSearchParams(endpoint.slice(endpoint.indexOf('?') + 1));
      if (query.get('from') === QWORK_MR1552_MERGE_COMMIT_SHA) {
        return {
          compare_timeout: false,
          commits: [{
            id: fixture.head,
            parent_ids: [QWORK_MR1552_MERGE_COMMIT_SHA, 'c'.repeat(40)],
            title: 'Merge branch execution-worker-utility-process into release/0.1',
            message: 'Merge branch execution-worker-utility-process into release/0.1',
            committed_date: '2026-09-04T01:00:00Z',
          }],
        };
      }
    }
    if (endpoint.startsWith('repository/files/')) {
      const encodedPath = endpoint.slice('repository/files/'.length, endpoint.indexOf('?'));
      const filePath = decodeURIComponent(encodedPath);
      if (blockingRiskFiles.has(filePath)) {
        const riskFile = blockingRiskFiles.get(filePath);
        let inheritedSource = '';
        let inheritedFile = null;
        try {
          inheritedFile = fixture.reader(endpoint);
          inheritedSource = Buffer.from(inheritedFile.content, 'base64').toString('utf8');
        } catch {
          // This path is protected only by the blocking-risk contract in this fixture.
        }
        if (!inheritedFile) return riskFile;
        const inheritedContractSource = [
          'electron/host-core/agent/execution-worker-supervisor.cjs',
          'electron/host-core/agent/execution-worker-process-lifecycle.cjs',
        ].includes(filePath)
          ? inheritedSource
          : `/* inherited source-contract fixture:\n${inheritedSource}\n*/`;
        const source = `${inheritedContractSource}\n${Buffer.from(riskFile.content, 'base64').toString('utf8')}`;
        return {
          ...inheritedFile,
          size: Buffer.byteLength(source, 'utf8'),
          content: Buffer.from(source, 'utf8').toString('base64'),
          blob_id: gitBlobSha1(source),
        };
      }
    }
    return fixture.reader(endpoint);
  };
  reader.readRaw = (endpoint) => {
    const value = reader(endpoint);
    return { bytes: Buffer.from(JSON.stringify(value), 'utf8'), value };
  };
  const scanFixture = () => scanQworkReleaseIntake({
    repoRoot: process.cwd(),
    releaseRef: 'origin/release/0.1',
    baselineCommit: fixture.baseline,
    caseIds: ['BETA-INIT-001'],
    frameworkCommit: 'd'.repeat(40),
    gitlabReader: reader,
    freshnessSource: 'gitlab-api',
  });
  const report = scanFixture();
  const risk = report.blocking_risks[0];
  assert.equal(risk.architecture, 'per-turn-utility-process/v1');
  assert.equal(risk.assertion_owner.contract_id, QWORK_MR1559_EXECUTION_RUNNER_SUCCESSOR_ID);
  assert.equal(risk.status, 'VERIFIED', JSON.stringify(risk));
  assert.equal(report.policy.api_freshness.blocking_risks_verified, true);
  const validation = validateQworkReleaseIntake(report, { requireFreshRef: true });
  assert.equal(validation.ok, true, validation.failures.join(','));

  const assertSuccessorMutationBlocked = ({ contract, filePath, search, replacement, label }) => {
    const originalFile = blockingRiskFiles.get(filePath);
    const originalSource = Buffer.from(originalFile.content, 'base64').toString('utf8');
    const mutatedSource = replaceRequired(originalSource, search, replacement, label);
    blockingRiskFiles.set(filePath, {
      ...originalFile,
      size: Buffer.byteLength(mutatedSource, 'utf8'),
      content: Buffer.from(mutatedSource, 'utf8').toString('base64'),
      blob_id: gitBlobSha1(mutatedSource),
    });
    try {
      const mutatedReport = scanFixture();
      const mutatedRisk = mutatedReport.blocking_risks[0];
      assert.equal(mutatedReport.decision, 'BLOCKED', label);
      assert.equal(mutatedRisk.status, 'BLOCKED', label);
      assert.equal(
        mutatedRisk.checks.at(-1).observations.successor_ast_contracts[contract],
        false,
        label,
      );
    } finally {
      blockingRiskFiles.set(filePath, originalFile);
    }
  };
  const callbackPath = 'electron/host-core/agent/execution-worker-callback-settlement.cjs';
  const eventPath = 'electron/host-core/agent/execution-worker-event-flow.cjs';
  const successorMutations = [
    {
      contract: 'deadline',
      filePath: 'electron/host-core/agent/execution-worker-deadline.cjs',
      search: 'Math.min(requestedDeadlineMs, 2147483646)',
      replacement: 'Math.min(requestedDeadlineMs, 2147483647)',
      label: 'deadline timer may not consume the cancellation grace ceiling',
    },
    {
      contract: 'callback_settlement',
      filePath: callbackPath,
      search: `  try {
    console.warn('[execution-worker] best-effort callback failed', {
      callback: String(name || '').slice(0, 80),
      redacted: true,
    });
  } catch {}`,
      replacement: `  console.warn('[execution-worker] best-effort callback failed', {
    callback: String(name || '').slice(0, 80),
    redacted: true,
  });`,
      label: 'callback reporter must isolate a throwing log sink',
    },
    {
      contract: 'event_flow',
      filePath: eventPath,
      search: '    const value = entry.pending;\n    entry.pending = null;',
      replacement: '    this.entries.clear();\n    const value = entry.pending;\n    entry.pending = null;',
      label: 'event flush may not clear the protected entry ledger',
    },
    {
      contract: 'event_flow',
      filePath: eventPath,
      search: '    const value = entry.pending;\n    entry.pending = null;',
      replacement: '    const entriesAlias = this.entries;\n    entriesAlias.clear();\n    const value = entry.pending;\n    entry.pending = null;',
      label: 'event flush may not clear the protected entry ledger through an alias',
    },
    {
      contract: 'event_flow',
      filePath: eventPath,
      search: '      this.entries.set(key, entry);\n      this.emitFresh(fact);',
      replacement: "      this.entries.set(key, entry);\n      this.entries.set('injected', {});\n      this.emitFresh(fact);",
      label: 'event push may not write an extra entry',
    },
    {
      contract: 'event_flow',
      filePath: eventPath,
      search: '      if (this.entries.size >= this.maxKeys) return;',
      replacement: '      if (false) return;',
      label: 'event key-capacity guard must stay reachable',
    },
    {
      contract: 'event_flow',
      filePath: eventPath,
      search: '    entry.pending = fact;',
      replacement: '    entry.pending = null;',
      label: 'event delay path must retain the current fact',
    },
    {
      contract: 'event_flow',
      filePath: eventPath,
      search: '    if (!entry.timer) this.arm(key, entry,',
      replacement: '    if (false) this.arm(key, entry,',
      label: 'event arm guard must stay tied to the timer state',
    },
    {
      contract: 'event_flow',
      filePath: eventPath,
      search: '    if (!entry.timer) this.arm(key, entry,',
      replacement: '    if (!entry.timer) this.emitFresh(',
      label: 'event delay path must call arm rather than an unrelated sink',
    },
    {
      contract: 'event_flow',
      filePath: eventPath,
      search: '    if (currentTime - entry.lastSentAt >= this.windowMs && !entry.timer) {',
      replacement: '    if (false) {',
      label: 'event immediate-window guard must remain reachable and exact',
    },
    {
      contract: 'event_flow',
      filePath: eventPath,
      search: `  pendingCount() {
    let count = 0;
    for (const entry of this.entries.values()) count += entry.pending ? 1 : 0;
    return count;
  }`,
      replacement: `  pendingCount() {
    return 0;
  }`,
      label: 'pendingCount may not be a constant',
    },
    {
      contract: 'event_flow',
      filePath: eventPath,
      search: `  pendingCount() {
    let count = 0;
    for (const entry of this.entries.values()) count += entry.pending ? 1 : 0;
    return count;
  }`,
      replacement: `  pendingCount() {
    return this.entries.size;
  }`,
      label: 'pendingCount must count pending facts rather than keys',
    },
    {
      contract: 'event_flow',
      filePath: eventPath,
      search: `  pendingCount() {
    let count = 0;
    for (const entry of this.entries.values()) count += entry.pending ? 1 : 0;
    return count;
  }`,
      replacement: '  unrelatedCount() { return 0; }',
      label: 'pendingCount may not be removed',
    },
    {
      contract: 'event_flow',
      filePath: eventPath,
      search: "String(fact?.identity || '')",
      replacement: "String('')",
      label: 'activity key must retain the stable identity component',
    },
    {
      contract: 'event_flow',
      filePath: eventPath,
      search: "if (!fact || fact.edge !== 'progressed') return false;",
      replacement: 'if (!fact) return false;',
      label: 'coalescing must remain restricted to progressed activity',
    },
    {
      contract: 'event_flow',
      filePath: eventPath,
      search: " || fact?.node === 'transport_lost'",
      replacement: '',
      label: 'transport loss must remain a terminal activity',
    },
    {
      contract: 'event_flow',
      filePath: eventPath,
      search: '      this.lastEmittedSequence = sourceSequence;',
      replacement: '      void sourceSequence;',
      label: 'fresh emission must advance the monotonic sequence fence',
    },
  ];
  for (const mutation of successorMutations) assertSuccessorMutationBlocked(mutation);

  const cancellationPath = 'electron/host-core/agent/execution-worker-cancellation.cjs';
  const cancellationFile = blockingRiskFiles.get(cancellationPath);
  const cancellationSource = Buffer.from(cancellationFile.content, 'base64').toString('utf8');
  const deadAbortSource = replaceRequired(
    cancellationSource,
    'if (signal.aborted) onAbort();',
    'if (false && signal.aborted) onAbort();',
    'intake dead abort guard',
  );
  blockingRiskFiles.set(cancellationPath, {
    ...cancellationFile,
    size: Buffer.byteLength(deadAbortSource, 'utf8'),
    content: Buffer.from(deadAbortSource, 'utf8').toString('base64'),
    blob_id: gitBlobSha1(deadAbortSource),
  });
  const blockedReport = scanFixture();
  assert.equal(blockedReport.decision, 'BLOCKED');
  assert.equal(blockedReport.policy.api_freshness.blocking_risks_verified, false);
  assert.equal(
    blockedReport.blocking_risks[0].checks.at(-1)
      .observations.successor_ast_contracts.cancellation,
    false,
  );
  const blockedValidation = validateQworkReleaseIntake(blockedReport, {
    requireFreshRef: true,
    requireReady: false,
  });
  assert.equal(blockedValidation.ok, false);
  assert.deepEqual(blockedValidation.failures, ['release_ref_not_freshly_verified']);
});

test('GitLab API scan binds a verified source contract into MR, summary, and freshness', () => {
  const sourceFixture = sourceContractFixture();
  const fixture = apiFixture({
    head: sourceFixture.contract.merge_commit_sha,
    mrIid: Number(sourceFixture.contract.mr_iid),
    changesCount: String(sourceFixture.changes.length),
    changes: sourceFixture.changes,
    sourceContracts: [...QWORK_RELEASE_SOURCE_CONTRACTS, sourceFixture.contract],
  });
  const report = scanQworkReleaseIntake({
    repoRoot: process.cwd(),
    releaseRef: 'origin/release/0.1',
    baselineCommit: fixture.baseline,
    caseIds: ['MRSMOKE-ROUTE-001', 'BETA-HOST-003'],
    frameworkCommit: 'd'.repeat(40),
    gitlabReader: fixture.reader,
    freshnessSource: 'gitlab-api',
    sourceContracts: [...QWORK_RELEASE_SOURCE_CONTRACTS, sourceFixture.contract],
  });
  assert.equal(report.decision, 'READY', report.blockers.join('; '));
  assert.equal(report.policy.api_freshness.verified, true);
  assert.equal(report.policy.api_freshness.source_contracts_verified, true);
  assert.deepEqual(report.merge_requests[0].source_contract_ids, [sourceFixture.contract.contract_id]);
  assert.equal(report.source_contracts.find((item) => item.contract_id === sourceFixture.contract.contract_id)?.verified, true);
  const expectedContractCount = QWORK_RELEASE_SOURCE_CONTRACTS.length + 1;
  assert.equal(report.summary.source_contract_count, expectedContractCount);
  assert.equal(report.summary.source_contract_verified_count, expectedContractCount);
  assert.equal(report.summary.source_contract_current_count, expectedContractCount);
  assert.equal(report.summary.source_contract_origin_count, 1);
  assert.equal(report.policy.api_freshness.source_contract_current_count, expectedContractCount);
  assert.equal(report.policy.api_freshness.source_contract_origin_count, 1);
  assert.equal(report.summary.source_contract_failure_count, 0);
  assert.deepEqual(report.unresolved.source_contract_failures, []);
  assert.equal(validateQworkReleaseIntake(report, {
    requireFreshRef: true,
    sourceContracts: [...QWORK_RELEASE_SOURCE_CONTRACTS, sourceFixture.contract],
  }).ok, true);
});

test('GitLab API scan preserves the !1612 successor contract after it leaves the incremental MR range', () => {
  const contract = QWORK_MR1597_WORKER_IM_USER_IDENTITY_FORWARDING_CONTRACT;
  const lifecycleBinding = contract.integration_bindings.find((binding) => binding.id === 'worker_allowlist_2');
  const successor = lifecycleBinding.current_release_match.successor;
  const head = 'b'.repeat(40);
  const releaseFiles = currentReleaseFileFixtures(QWORK_RELEASE_SOURCE_CONTRACTS, head);
  const lifecyclePayload = structuredClone(releaseFiles.get(lifecycleBinding.path));
  const originalSource = Buffer.from(lifecyclePayload.content, 'base64').toString('utf8');
  const successorSource = replaceRequired(
    originalSource,
    lifecycleBinding.addition.source,
    successor.line.source,
    'cross-increment !1612 successor source',
  );
  lifecyclePayload.content = Buffer.from(successorSource, 'utf8').toString('base64');
  lifecyclePayload.size = Buffer.byteLength(successorSource, 'utf8');
  lifecyclePayload.blob_id = gitBlobSha1(successorSource);
  const fixture = apiFixture({
    head,
    successorRelationship: 'successor',
    releaseFileOverrides: new Map([[lifecycleBinding.path, lifecyclePayload]]),
  });
  const calls = [];
  const rawCompareResponses = new Map();
  const readWithNativeMessage = (endpoint) => {
    const value = fixture.reader(endpoint);
    if (!endpoint.startsWith('repository/compare?') || !Array.isArray(value?.commits)) return value;
    return {
      ...value,
      commits: value.commits.map((commit) => ({
        ...commit,
        message: `${commit.message || commit.title}\n\nNative GitLab body.\n`,
      })),
    };
  };
  const trackedReader = (endpoint) => {
    calls.push(endpoint);
    return readWithNativeMessage(endpoint);
  };
  trackedReader.readRaw = (endpoint) => {
    calls.push(endpoint);
    const value = readWithNativeMessage(endpoint);
    const bytes = Buffer.from(JSON.stringify(value), 'utf8');
    if (endpoint.startsWith('repository/compare?')) rawCompareResponses.set(endpoint, bytes);
    return { bytes, value };
  };
  const report = scanQworkReleaseIntake({
    repoRoot: process.cwd(),
    releaseRef: 'origin/release/0.1',
    baselineCommit: fixture.baseline,
    caseIds: ['BETA-INIT-001'],
    frameworkCommit: 'd'.repeat(40),
    gitlabReader: trackedReader,
    freshnessSource: 'gitlab-api',
  });
  assert.equal(report.merge_requests.some((mr) => String(mr.iid) === successor.mr_iid), false);
  const attestation = report.source_contracts.find((item) => item.contract_id === contract.contract_id);
  const observation = attestation.integration_bindings.find(
    (binding) => binding.id === lifecycleBinding.id,
  ).successor_observation;
  assert.equal(observation.relationship, 'VERIFIED_SUCCESSOR');
  assert.equal(observation.schema_version, QWORK_SOURCE_BINDING_SUCCESSOR_RELATIONSHIP_SCHEMA);
  assert.equal(observation.compare_evidence_verified, true);
  assert.deepEqual(observation.compare_evidence_failures, []);
  assert.equal(attestation.schema_version, QWORK_RELEASE_CURRENT_SOURCE_CONTRACT_SCHEMA);
  assert.equal(observation.in_range_identity_count, 0);
  assert.equal(observation.verified, true);
  assert.equal(calls.includes(
    `repository/compare?from=${successor.merge_commit_sha}&to=${head}&straight=true`,
  ), true);
  assert.equal(calls.includes(
    `repository/compare?from=${head}&to=${successor.merge_commit_sha}&straight=true`,
  ), true);
  const descendantEndpoint = `repository/compare?from=${successor.merge_commit_sha}&to=${head}&straight=true`;
  const descendantRaw = rawCompareResponses.get(descendantEndpoint);
  const descendantEvidence = observation.descendant_ancestry.compare_evidence;
  assert.ok(descendantRaw);
  assert.equal(descendantEvidence.raw_response_base64, descendantRaw.toString('base64'));
  assert.equal(descendantEvidence.raw_response_bytes, descendantRaw.length);
  assert.equal(descendantEvidence.raw_response_sha256, createHash('sha256').update(descendantRaw).digest('hex'));
  assert.equal(JSON.parse(descendantRaw.toString('utf8')).commits[0].message.endsWith('\n'), true);
  assert.equal(report.decision, 'READY', report.blockers.join('; '));
  assert.equal(validateQworkReleaseIntake(report, { requireFreshRef: true }).ok, true);

  const rehashAttestationAndReport = (candidate) => {
    const candidateAttestation = candidate.source_contracts.find(
      (item) => item.contract_id === contract.contract_id,
    );
    delete candidateAttestation.attestation_sha256;
    candidateAttestation.attestation_sha256 = sha256Text(stableJson(candidateAttestation));
    delete candidate.integrity.content_sha256;
    candidate.integrity.content_sha256 = sha256Text(stableJson(candidate));
    return candidateAttestation;
  };
  const assertOfflineTamperBlocked = (label, baseReport, mutate) => {
    const candidate = structuredClone(baseReport);
    const candidateAttestation = candidate.source_contracts.find(
      (item) => item.contract_id === contract.contract_id,
    );
    const candidateBinding = candidateAttestation.integration_bindings.find(
      (binding) => binding.id === lifecycleBinding.id,
    );
    mutate(candidateBinding.successor_observation, candidateAttestation, candidate);
    rehashAttestationAndReport(candidate);
    const directValidation = validateCurrentReleaseSourceContractAttestation(candidateAttestation, {
      report: candidate,
      contract,
      contracts: QWORK_RELEASE_SOURCE_CONTRACTS,
    });
    const sourceValidation = validateReleaseSourceContractsForReport(candidate);
    const intakeValidation = validateQworkReleaseIntake(candidate, { requireFreshRef: true });
    assert.equal(directValidation.ok, false, `${label}:direct`);
    assert.equal(sourceValidation.ok, false, `${label}:source-report`);
    assert.equal(intakeValidation.ok, false, `${label}:intake`);
    assert.equal(intakeValidation.failures.includes('content_sha256_mismatch'), false, label);
  };

  const predecessorFixture = apiFixture({ head, successorRelationship: 'predecessor' });
  const predecessorReport = scanQworkReleaseIntake({
    repoRoot: process.cwd(),
    releaseRef: 'origin/release/0.1',
    baselineCommit: predecessorFixture.baseline,
    caseIds: ['BETA-INIT-001'],
    frameworkCommit: 'd'.repeat(40),
    gitlabReader: predecessorFixture.reader,
    freshnessSource: 'gitlab-api',
  });
  assert.equal(predecessorReport.decision, 'READY', predecessorReport.blockers.join('; '));
  assertOfflineTamperBlocked('predecessor raw cannot be relabeled as successor', predecessorReport, (forged) => {
    Object.assign(forged.descendant_ancestry, {
      compare_commit_count: 1,
      first_parent_complete: true,
      query_completed: true,
      verified: true,
      reason: '',
    });
    Object.assign(forged.predecessor_ancestry, {
      compare_commit_count: 0,
      first_parent_complete: false,
      query_completed: true,
      verified: false,
      reason: `first_parent_commit_missing:${successor.merge_commit_sha}`,
    });
    forged.relationship = 'VERIFIED_SUCCESSOR';
    forged.verified = true;
  });

  for (const [label, mutate] of [
    ['missing raw compare evidence', (forged) => {
      delete forged.descendant_ancestry.compare_evidence;
    }],
    ['compare endpoint rewrite', (forged) => {
      forged.descendant_ancestry.compare_evidence.endpoint += '&page=2';
    }],
    ['compare raw Base64 rewrite', (forged) => {
      forged.descendant_ancestry.compare_evidence.raw_response_base64 = '***';
    }],
    ['compare raw byte count rewrite', (forged) => {
      forged.descendant_ancestry.compare_evidence.raw_response_bytes += 1;
    }],
    ['compare raw SHA rewrite', (forged) => {
      forged.descendant_ancestry.compare_evidence.raw_response_sha256 = '0'.repeat(64);
    }],
    ['compare direction rewrite', (forged) => {
      const evidence = forged.descendant_ancestry.compare_evidence;
      [evidence.compare_from, evidence.compare_to] = [evidence.compare_to, evidence.compare_from];
      evidence.endpoint = `repository/compare?from=${evidence.compare_from}&to=${evidence.compare_to}&straight=true`;
    }],
    ['legacy successor relationship v1', (forged) => {
      forged.schema_version = 'qbot-qwork-source-binding-successor-relationship/v1';
    }],
    ['legacy current-release attestation v3', (_forged, candidateAttestation) => {
      candidateAttestation.schema_version = 'qbot-qwork-release-current-source-contract/v3';
    }],
  ]) {
    assertOfflineTamperBlocked(label, report, mutate);
  }

  assertOfflineTamperBlocked('both compare directions cannot be complete', report, (forged) => {
    forged.predecessor_ancestry = ancestryWithRawCompare({
      source: 'gitlab-api-compare-first-parent',
      compare_from: head,
      compare_to: successor.merge_commit_sha,
      compare_commit_count: 1,
      first_parent_complete: true,
      query_completed: true,
      verified: true,
      reason: '',
    }, {
      compare_timeout: false,
      commits: [{ id: successor.merge_commit_sha, parent_ids: [head] }],
    });
    forged.relationship = 'UNKNOWN';
    forged.compare_evidence_verified = true;
    forged.compare_evidence_failures = [];
    forged.verified = false;
  });
});

test('GitLab API scan binds a source contract by exact merge SHA when IID is wrong', () => {
  const sourceFixture = sourceContractFixture();
  const fixture = apiFixture({
    head: sourceFixture.contract.merge_commit_sha,
    mrIid: Number(sourceFixture.contract.mr_iid) + 1,
    changesCount: String(sourceFixture.changes.length),
    changes: sourceFixture.changes,
    sourceContracts: [...QWORK_RELEASE_SOURCE_CONTRACTS, sourceFixture.contract],
  });
  const report = scanQworkReleaseIntake({
    repoRoot: process.cwd(),
    releaseRef: 'origin/release/0.1',
    baselineCommit: fixture.baseline,
    caseIds: ['MRSMOKE-ROUTE-001'],
    frameworkCommit: 'd'.repeat(40),
    gitlabReader: fixture.reader,
    freshnessSource: 'gitlab-api',
    sourceContracts: [...QWORK_RELEASE_SOURCE_CONTRACTS, sourceFixture.contract],
  });
  assert.equal(report.decision, 'BLOCKED');
  assert.equal(report.source_contracts.length, QWORK_RELEASE_SOURCE_CONTRACTS.length + 1);
  const customAttestation = report.source_contracts.find((item) => item.contract_id === sourceFixture.contract.contract_id);
  assert.equal(customAttestation.origin_change_attestation.failures.includes('mr_iid_mismatch'), true);
  assert.equal(customAttestation.failures.includes('origin_change_attestation_not_verified'), true);
  assert.equal(report.policy.api_freshness.source_contracts_verified, false);
  assert.equal(report.unresolved.source_contract_failures.length > 0, true);
});

test('GitLab API scan treats an explicit empty registry as all built-in source contracts', () => {
  const fixture = apiFixture();
  const report = scanQworkReleaseIntake({
    repoRoot: process.cwd(),
    releaseRef: 'origin/release/0.1',
    baselineCommit: fixture.baseline,
    caseIds: ['BETA-INIT-001'],
    frameworkCommit: 'd'.repeat(40),
    gitlabReader: fixture.reader,
    freshnessSource: 'gitlab-api',
    sourceContracts: [],
  });
  assert.equal(report.decision, 'READY', report.blockers.join('; '));
  assert.equal(report.source_contracts.length, QWORK_RELEASE_SOURCE_CONTRACTS.length);
  assert.equal(report.summary.source_contract_current_count, QWORK_RELEASE_SOURCE_CONTRACTS.length);
  assert.equal(report.summary.source_contract_current_verified_count, QWORK_RELEASE_SOURCE_CONTRACTS.length);
  assert.equal(report.summary.source_contract_origin_count, 0);
  assert.equal(report.summary.source_contract_origin_verified_count, 0);
  assert.equal(report.source_contracts.every((item) => item.source === 'gitlab-api-current-release-files'), true);
  assert.equal(report.source_contracts.every((item) => item.origin_change_attestation === null), true);
});

test('GitLab API scan retains the !1558 test file until !1595 ancestry is verified', () => {
  const origin = QWORK_MR1558_SETTINGS_MODEL_NAME_DEDUP_CONTRACT;
  const retirement = QWORK_MR1595_OBSOLETE_TEST_RETIREMENT_CONTRACT;
  const contracts = [origin, retirement];
  const historicalFiles = currentReleaseFileFixtures([origin], origin.merge_commit_sha);
  const historicalTestPath = 'test/unit/config/settings-ui-surface-contract.test.mjs';
  const fixture = apiFixture({
    head: origin.merge_commit_sha,
    mrIid: Number(origin.mr_iid),
    mergeCommitSha: origin.merge_commit_sha,
    sourceContracts: contracts,
    releaseFileOverrides: new Map([[historicalTestPath, historicalFiles.get(historicalTestPath)]]),
  });
  const requestedFiles = [];
  const reader = (endpoint) => {
    if (endpoint.startsWith('repository/compare?')) {
      const query = new URLSearchParams(endpoint.slice(endpoint.indexOf('?') + 1));
      if (query.get('from') === retirement.merge_commit_sha
        && query.get('to') === origin.merge_commit_sha) {
        return { compare_timeout: false, commits: [] };
      }
    }
    if (endpoint.startsWith('repository/files/')) {
      const encodedPath = endpoint.slice('repository/files/'.length, endpoint.indexOf('?'));
      requestedFiles.push(decodeURIComponent(encodedPath));
    }
    return fixture.reader(endpoint);
  };

  const report = scanQworkReleaseIntake({
    repoRoot: process.cwd(),
    releaseRef: 'origin/release/0.1',
    baselineCommit: fixture.baseline,
    caseIds: ['BETA-INIT-001'],
    frameworkCommit: 'd'.repeat(40),
    gitlabReader: reader,
    freshnessSource: 'gitlab-api',
    sourceContracts: contracts,
  });
  assert.equal(requestedFiles.filter((filePath) => filePath === historicalTestPath).length, 1);
  const current = report.source_contracts.find((item) => item.contract_id === origin.contract_id);
  assert.equal(current.protected_files.some((file) => file.path === historicalTestPath), true);
  assert.equal(current.integration_bindings
    .filter((binding) => binding.path === historicalTestPath)
    .every((binding) => binding.verified === true), true);
  assert.equal(current.current_assertion_owners.integration_bindings
    .filter((binding) => binding.id.startsWith('test_'))
    .every((binding) => binding.contract_id === origin.contract_id), true);
});

test('GitLab API scan applies !1595 retirement outside the incremental range with native compare message bytes', () => {
  const origin = QWORK_MR1558_SETTINGS_MODEL_NAME_DEDUP_CONTRACT;
  const retirement = QWORK_MR1595_OBSOLETE_TEST_RETIREMENT_CONTRACT;
  const baseline = 'c'.repeat(40);
  const head = 'd'.repeat(40);
  const nativeMessage = 'Merge branch release follow-up\n\nPreserve GitLab message bytes.\n';
  const fixture = apiFixture({
    baseline,
    head,
    sourceContracts: QWORK_RELEASE_SOURCE_CONTRACTS,
    compareCommits: [{
      id: head,
      parent_ids: [baseline, 'e'.repeat(40)],
      title: 'Merge branch release follow-up',
      message: nativeMessage,
      committed_date: '2026-09-09T01:00:00Z',
    }],
  });
  const requestedFiles = [];
  const rawCompareResponses = new Map();
  const readValue = (endpoint) => {
    if (endpoint.startsWith('repository/compare?')) {
      const query = new URLSearchParams(endpoint.slice(endpoint.indexOf('?') + 1));
      const from = query.get('from');
      const to = query.get('to');
      const ancestryCommit = (id, parentIds, title, message = `${title}\n`) => ({
        id,
        parent_ids: parentIds,
        title,
        message,
        committed_date: '2026-09-09T00:00:00Z',
      });
      const retirementCommit = ancestryCommit(
        retirement.merge_commit_sha,
        [origin.merge_commit_sha, '1'.repeat(40)],
        'Merge MR !1595 retirement',
      );
      const baselineCommit = ancestryCommit(
        baseline,
        [retirement.merge_commit_sha],
        'Release baseline after MR !1595',
      );
      const headCommit = ancestryCommit(
        head,
        [baseline, '2'.repeat(40)],
        'Merge branch release follow-up',
        nativeMessage,
      );
      if (to === head && from === origin.merge_commit_sha) {
        return { compare_timeout: false, commits: [retirementCommit, baselineCommit, headCommit] };
      }
      if (to === head && from === retirement.merge_commit_sha) {
        return { compare_timeout: false, commits: [baselineCommit, headCommit] };
      }
    }
    const value = fixture.reader(endpoint);
    if (!endpoint.startsWith('repository/compare?') || !Array.isArray(value?.commits)) return value;
    return {
      ...value,
      commits: value.commits.map((commit) => ({ ...commit, message: nativeMessage })),
    };
  };
  const reader = (endpoint) => {
    if (endpoint.startsWith('repository/files/')) {
      const encodedPath = endpoint.slice('repository/files/'.length, endpoint.indexOf('?'));
      requestedFiles.push(decodeURIComponent(encodedPath));
    }
    const value = readValue(endpoint);
    if (endpoint.startsWith('repository/compare?')) {
      rawCompareResponses.set(endpoint, Buffer.from(JSON.stringify(value), 'utf8'));
    }
    return value;
  };
  reader.readRaw = (endpoint) => {
    const value = reader(endpoint);
    const bytes = Buffer.from(JSON.stringify(value), 'utf8');
    return { bytes, value };
  };

  const report = scanQworkReleaseIntake({
    repoRoot: process.cwd(),
    releaseRef: 'origin/release/0.1',
    baselineCommit: baseline,
    caseIds: ['BETA-INIT-001'],
    frameworkCommit: 'f'.repeat(40),
    gitlabReader: reader,
    freshnessSource: 'gitlab-api',
    sourceContracts: QWORK_RELEASE_SOURCE_CONTRACTS,
  });

  const historicalTestPath = 'test/unit/config/settings-ui-surface-contract.test.mjs';
  assert.equal(report.decision, 'READY', JSON.stringify({
    blockers: report.blockers,
    scan_boundary: report.scan_boundary,
    api_freshness: report.policy.api_freshness,
    unresolved: report.unresolved,
    source_contracts: report.source_contracts.map((item) => ({
      contract_id: item.contract_id,
      status: item.status,
      failures: item.failures,
    })),
  }));
  assert.equal(report.scan_boundary.mode, 'commit_ancestry');
  assert.equal(report.scan_boundary.ancestry_verified, true);
  assert.equal(report.merge_requests.some((mr) => String(mr.iid) === retirement.mr_iid), false);
  assert.equal(requestedFiles.includes(historicalTestPath), false);
  assert.deepEqual(report.unresolved.api_errors, []);
  assert.deepEqual(report.unresolved.source_contract_failures, []);

  const current = report.source_contracts.find((item) => item.contract_id === origin.contract_id);
  assert.ok(current);
  assert.equal(current.status, 'VERIFIED');
  assert.equal(current.protected_files.some((file) => file.path === historicalTestPath), false);
  const retiredBindings = current.integration_bindings.filter((binding) => binding.retired === true);
  assert.equal(retiredBindings.length, 5);
  assert.equal(retiredBindings.every((binding) => (
    binding.verified === true && binding.retirement.contract_id === retirement.contract_id
  )), true);
  const productBindings = current.integration_bindings.filter((binding) => binding.retired !== true);
  assert.equal(productBindings.length, 7);
  assert.equal(productBindings.every((binding) => binding.verified === true), true);
  assert.equal(current.current_assertion_owners.integration_bindings
    .filter((binding) => retiredBindings.some((retired) => retired.id === binding.id))
    .every((binding) => binding.contract_id === retirement.contract_id), true);
  assert.equal(current.current_assertion_owners.integration_bindings
    .filter((binding) => productBindings.some((product) => product.id === binding.id))
    .every((binding) => binding.contract_id === origin.contract_id), true);

  const ancestryEndpoint = `repository/compare?from=${retirement.merge_commit_sha}&to=${head}&straight=true`;
  const ancestryBytes = rawCompareResponses.get(ancestryEndpoint);
  assert.ok(ancestryBytes, JSON.stringify([...rawCompareResponses.keys()]));
  const replayed = JSON.parse(ancestryBytes.toString('utf8'));
  assert.equal(replayed.commits.at(-1).message, nativeMessage);
  assert.equal(ancestryBytes.equals(Buffer.from(JSON.stringify(replayed), 'utf8')), true);
  const originEndpoint = `repository/compare?from=${origin.merge_commit_sha}&to=${head}&straight=true`;
  const originReplay = JSON.parse(rawCompareResponses.get(originEndpoint).toString('utf8'));
  assert.deepEqual(originReplay.commits.map((commit) => commit.id), [
    retirement.merge_commit_sha,
    baseline,
    head,
  ]);
  assert.equal(validateQworkReleaseIntake(report, {
    requireFreshRef: true,
    sourceContracts: QWORK_RELEASE_SOURCE_CONTRACTS,
  }).ok, true);
});

test('GitLab API scan fail-closes MR !1522 when protected source bytes do not match', () => {
  const contract = QWORK_MR1522_CLAUDE_TURN_HEADERS_CONTRACT;
  const fixture = apiFixture({
    head: contract.merge_commit_sha,
    mrIid: Number(contract.mr_iid),
    changes: [{
      old_path: contract.source_file.path,
      new_path: contract.source_file.path,
      new_file: true,
      renamed_file: false,
      deleted_file: false,
      diff: '@@ -0,0 +1,1 @@\n+export const forged = true;\n',
    }],
  });
  const report = scanQworkReleaseIntake({
    repoRoot: process.cwd(),
    releaseRef: 'origin/release/0.1',
    baselineCommit: fixture.baseline,
    caseIds: ['MRSMOKE-ROUTE-001'],
    frameworkCommit: 'd'.repeat(40),
    gitlabReader: fixture.reader,
    freshnessSource: 'gitlab-api',
  });
  assert.equal(report.decision, 'BLOCKED');
  assert.equal(report.policy.api_freshness.source_contracts_verified, false);
  assert.equal(report.summary.source_contract_count, QWORK_RELEASE_SOURCE_CONTRACTS.length);
  assert.equal(report.summary.source_contract_verified_count, QWORK_RELEASE_SOURCE_CONTRACTS.length - 1);
  assert.equal(report.summary.source_contract_current_count, QWORK_RELEASE_SOURCE_CONTRACTS.length);
  assert.equal(report.summary.source_contract_origin_count, 1);
  assert.equal(report.summary.source_contract_origin_verified_count, 0);
  assert.equal(report.summary.source_contract_failure_count > 0, true);
  assert.deepEqual(report.merge_requests[0].source_contract_ids, [contract.contract_id]);
  const sourceAttestation = report.source_contracts.find((item) => item.contract_id === contract.contract_id);
  assert.equal(sourceAttestation.verified, false);
  assert.equal(sourceAttestation.origin_change_attestation.failures.includes('mr_changes_count_mismatch'), true);
  assert.equal(sourceAttestation.failures.includes('origin_change_attestation_not_verified'), true);
  assert.equal(report.unresolved.source_contract_failures.length > 0, true);
  assert.equal(validateQworkReleaseIntake(report, { requireReady: false, requireFreshRef: true }).ok, false);
});

test('GitLab API freshness blocks when release branch moves during the scan', () => {
  const fixture = apiFixture({ afterHead: 'e'.repeat(40) });
  const report = scanQworkReleaseIntake({
    repoRoot: process.cwd(),
    releaseRef: 'origin/release/0.1',
    baselineCommit: fixture.baseline,
    caseIds: ['BETA-INIT-001'],
    frameworkCommit: 'd'.repeat(40),
    gitlabReader: fixture.reader,
    freshnessSource: 'gitlab-api',
  });
  assert.equal(report.decision, 'BLOCKED');
  assert.equal(report.policy.api_freshness.verified, false);
  assert.equal(validateQworkReleaseIntake(report, { requireReady: false, requireFreshRef: true }).ok, false);
});

test('GitLab API freshness blocks incomplete compare first-parent data', () => {
  const fixture = apiFixture({ omitHeadFromCompare: true });
  const report = scanQworkReleaseIntake({
    repoRoot: process.cwd(),
    releaseRef: 'origin/release/0.1',
    baselineCommit: fixture.baseline,
    caseIds: ['BETA-INIT-001'],
    frameworkCommit: 'd'.repeat(40),
    gitlabReader: fixture.reader,
    freshnessSource: 'gitlab-api',
  });
  assert.equal(report.decision, 'BLOCKED');
  assert.match(report.blockers.join('\n'), /freshness/);
});

for (const scenario of [
  { name: 'unmerged MR', options: { mrState: 'opened' } },
  { name: 'wrong target branch', options: { targetBranch: 'main' } },
  { name: 'wrong merge SHA', options: { mergeCommitSha: 'f'.repeat(40) } },
  { name: 'incomplete changes', options: { changesCount: '2' } },
  { name: 'overflow changes', options: { overflow: true } },
]) {
  test(`GitLab API freshness blocks ${scenario.name}`, () => {
    const fixture = apiFixture(scenario.options);
    const report = scanQworkReleaseIntake({
      repoRoot: process.cwd(),
      releaseRef: 'origin/release/0.1',
      baselineCommit: fixture.baseline,
      caseIds: ['BETA-INIT-001'],
      frameworkCommit: 'd'.repeat(40),
      gitlabReader: fixture.reader,
      freshnessSource: 'gitlab-api',
    });
    assert.equal(report.decision, 'BLOCKED');
    assert.equal(report.policy.api_freshness.verified, false);
    assert.equal(report.unresolved.unverified_mr_metadata.length, 1);
  });
}

test('new repository governance paths remain static-only', () => {
  const mapped = mapReleaseImpact({
    changedPaths: [
      '.architecture.yaml',
      '.codex/environments/environment.toml',
      '.codex/hooks.json',
      'CONTEXT.md',
      'server/qbot-core/docs/model-gateway-local-diagnostics.md',
    ],
    subject: 'repository governance cleanup',
    availableCaseIds: ['BETA-INIT-001'],
  });
  assert.deepEqual(mapped.unmapped_product_paths, []);
  assert.equal(mapped.direct_case_ids.length, 0);
  assert.deepEqual(mapped.static_dispositions.map((item) => item.disposition).sort(), [
    'Agent-metadata-only',
    'Codex-governance-only',
    'Codex-governance-only',
    'Repository-architecture-only',
    'Research/docs-only',
  ]);
});

test('intake output is immutable and content hash is validated', () => {
  const { repo, baseline } = fixtureRepo();
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'qbot-intake-out-'));
  fs.rmSync(out, { recursive: true, force: true });
  try {
    const report = scanQworkReleaseIntake({
      repoRoot: repo,
      releaseRef: 'HEAD',
      baselineCommit: baseline,
      caseIds: ['MRSMOKE-AUTO-001'],
      frameworkCommit: 'a'.repeat(40),
      fetchLatest: false,
      requireGitLabMetadata: false,
      gitlabReader: () => [],
    });
    const files = writeQworkReleaseIntake({ report, outDir: out });
    assert.equal(fs.existsSync(files.json), true);
    assert.equal(validateQworkReleaseIntake(JSON.parse(fs.readFileSync(files.json, 'utf8')), { requireReady: false }).ok, true);
    assert.equal(validateQworkReleaseIntake(JSON.parse(fs.readFileSync(files.json, 'utf8')), { requireReady: false, requireFreshRef: true }).ok, false);
    assert.throws(() => writeQworkReleaseIntake({ report, outDir: out }), /必须在调用前不存在/);
    assert.equal(typeof stableJson(report), 'string');
  } finally {
    fs.rmSync(repo, { recursive: true, force: true });
    fs.rmSync(out, { recursive: true, force: true });
  }
});

test('Casebook and Sheet failures block release intake before a runner can start', () => {
  const fixture = apiFixture();
  const casebookPath = path.resolve('PRD', QWORK_RELEASE_CASEBOOK_BASENAME);
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'qbot-intake-casebook-'));
  const missingPath = path.join(tempRoot, 'missing.xlsx');
  const emptyPath = path.join(tempRoot, 'empty.xlsx');
  execFileSync('python3', ['-c', [
    'from openpyxl import Workbook',
    'import sys',
    'wb = Workbook()',
    "ws = wb.active",
    "ws.title = 'Empty'",
    "ws.append(['用例ID', '测试场景'])",
    'wb.save(sys.argv[1])',
  ].join('; '), emptyPath]);
  const emptySha = createHash('sha256').update(fs.readFileSync(emptyPath)).digest('hex');
  const scan = (overrides = {}) => scanQworkReleaseIntake({
    repoRoot: process.cwd(),
    releaseRef: 'origin/release/0.1',
    baselineCommit: fixture.baseline,
    casebookPath,
    casebookSha256: QWORK_RELEASE_CASEBOOK_SHA256,
    sheet: '核心生命线门禁',
    frameworkCommit: 'd'.repeat(40),
    gitlabReader: fixture.reader,
    freshnessSource: 'gitlab-api',
    ...overrides,
  });
  try {
    const missing = scan({ casebookPath: missingPath });
    assert.equal(missing.decision, 'BLOCKED');
    assert.match(missing.casebook.load_error, /^casebook_unreadable:/);

    const missingSheet = scan({ sheet: '' });
    assert.equal(missingSheet.decision, 'BLOCKED');
    assert.equal(missingSheet.casebook.load_error, 'casebook_sheet_missing');

    const wrongSheet = scan({ sheet: '不存在的 Sheet' });
    assert.equal(wrongSheet.decision, 'BLOCKED');
    assert.match(wrongSheet.casebook.load_error, /^casebook_export_failed:/);

    const emptySheet = scan({ casebookPath: emptyPath, casebookSha256: emptySha, sheet: 'Empty' });
    assert.equal(emptySheet.decision, 'BLOCKED');
    assert.equal(emptySheet.casebook.load_error, 'casebook_sheet_empty');

    const shaMismatch = scan({ casebookSha256: '0'.repeat(64) });
    assert.equal(shaMismatch.decision, 'BLOCKED');
    assert.equal(shaMismatch.casebook.identity_verified, false);
    assert.match(shaMismatch.blockers.join('\n'), /SHA-256/);
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('release intake CLI rejects a missing Sheet or unreadable Casebook before scanning', () => {
  const script = path.resolve('scripts/scan-qwork-release-intake.mjs');
  const casebookPath = path.resolve('PRD', QWORK_RELEASE_CASEBOOK_BASENAME);
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'qbot-intake-cli-'));
  const baseArgs = [
    script,
    '--repo', process.cwd(),
    '--out', path.join(tempRoot, 'out'),
    '--framework-commit', 'd'.repeat(40),
  ];
  try {
    const missingSheet = spawnSync(process.execPath, [
      ...baseArgs,
      '--casebook', casebookPath,
    ], { encoding: 'utf8' });
    assert.notEqual(missingSheet.status, 0);
    assert.match(missingSheet.stderr, /必须提供 --sheet/);

    const missingCasebook = spawnSync(process.execPath, [
      ...baseArgs,
      '--casebook', path.join(tempRoot, 'missing.xlsx'),
      '--sheet', '核心生命线门禁',
    ], { encoding: 'utf8' });
    assert.notEqual(missingCasebook.status, 0);
    assert.match(missingCasebook.stderr, /Casebook 不存在或不可读/);
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('a bound intake cannot cross release, Casebook, or framework identity', () => {
  const fixture = apiFixture({ baseline: QWORK_RELEASE_CASEBOOK_DESIGN_BASELINE_COMMIT });
  const report = scanQworkReleaseIntake({
    repoRoot: process.cwd(),
    releaseRef: 'origin/release/0.1',
    baselineCommit: fixture.baseline,
    casebookPath: path.resolve('PRD', QWORK_RELEASE_CASEBOOK_BASENAME),
    casebookSha256: QWORK_RELEASE_CASEBOOK_SHA256,
    sheet: '核心生命线门禁',
    frameworkCommit: 'd'.repeat(40),
    gitlabReader: fixture.reader,
    freshnessSource: 'gitlab-api',
  });
  assert.equal(report.decision, 'READY', report.blockers.join('; '));
  const releaseIntakes = Object.fromEntries(
    QWORK_RELEASE_TEST_STAGES
      .filter((stage) => ['G1', 'G2', 'G3', 'G4'].includes(stage.id))
      .map((stage) => [stage.id, {
        schema_version: QWORK_RELEASE_INTAKE_SCHEMA,
        path: `/tmp/release-intake-${stage.id.toLowerCase()}.json`,
        sha256: 'f'.repeat(64),
        content_sha256: report.integrity.content_sha256,
        release_ref: report.release.ref,
        release_head: report.release.head,
        repository: report.release.repository,
        baseline_commit: report.scan_boundary.baseline_commit,
        required_stages: report.summary.required_stages,
        sheet: stage.sheet,
        case_ids: [...stage.expected_case_ids],
      }]),
  );
  const plan = {
    policy: { release_intake_required: true },
    release_intakes: releaseIntakes,
    casebook: {
      path: report.casebook.path,
      sha256: report.casebook.sha256,
    },
    framework: { commit: report.framework.commit },
  };
  const accepted = validateQworkReleaseIntakeBinding({
    plan,
    stageId: 'G1',
    report,
    reportSha256: 'f'.repeat(64),
  });
  assert.equal(accepted.ok, true, accepted.failures.join(','));
  const drifted = validateQworkReleaseIntakeBinding({
    plan: { ...plan, framework: { commit: '0'.repeat(40) } },
    stageId: 'G1',
    report,
    reportSha256: 'f'.repeat(64),
  });
  assert.equal(drifted.ok, false);
  assert.equal(drifted.failures.some((item) => item.includes('framework_commit')), true);

  const rehash = (candidate) => {
    const value = structuredClone(candidate);
    delete value.integrity.content_sha256;
    candidate.integrity.content_sha256 = sha256Text(stableJson(value));
    return candidate;
  };
  const weakGit = structuredClone(report);
  delete weakGit.policy.api_freshness;
  weakGit.policy.fetch_latest = true;
  const weak = validateQworkReleaseIntakeBinding({
    plan,
    stageId: 'G1',
    report: rehash(weakGit),
    reportSha256: 'f'.repeat(64),
  });
  assert.equal(weak.ok, false);
  assert.equal(weak.failures.includes('release_intake_gitlab_api_freshness_required'), true);

  const missingSourceContracts = structuredClone(report);
  missingSourceContracts.source_contracts = [];
  missingSourceContracts.summary.source_contract_count = 0;
  missingSourceContracts.summary.source_contract_verified_count = 0;
  missingSourceContracts.summary.source_contract_current_count = 0;
  missingSourceContracts.summary.source_contract_current_verified_count = 0;
  const missingSources = validateQworkReleaseIntakeBinding({
    plan,
    stageId: 'G1',
    report: rehash(missingSourceContracts),
    reportSha256: 'f'.repeat(64),
  });
  assert.equal(missingSources.ok, false);
  assert.equal(missingSources.failures.some((failure) => failure.startsWith('release_intake_source_contract:')), true);

  const missingBlockingRisks = structuredClone(report);
  missingBlockingRisks.blocking_risks = [];
  const missingRisks = validateQworkReleaseIntakeBinding({
    plan,
    stageId: 'G1',
    report: rehash(missingBlockingRisks),
    reportSha256: 'f'.repeat(64),
  });
  assert.equal(missingRisks.ok, false);
  assert.equal(missingRisks.failures.some((failure) => failure.startsWith('release_intake_blocking_risk:')), true);
});

test('root Playwright config and nested documentation assets remain static without hiding product code', () => {
  const mapped = mapReleaseImpact({
    changedPaths: [
      'playwright.config.mjs',
      'electron/docs/README.md',
      'src/docs/capabilities.yaml',
      'src/docs/runtime.ts',
    ],
    subject: 'docs and test toolchain maintenance',
  });

  assert.deepEqual(mapped.static_dispositions, [
    { path: 'playwright.config.mjs', disposition: 'Toolchain/test-only' },
    { path: 'electron/docs/README.md', disposition: 'Research/docs-only' },
    { path: 'src/docs/capabilities.yaml', disposition: 'Research/docs-only' },
  ]);
  assert.deepEqual(mapped.product_paths, ['src/docs/runtime.ts']);
  assert.deepEqual(mapped.known_product_paths, ['src/docs/runtime.ts']);
  assert.deepEqual(mapped.unmapped_product_paths, []);
  assert.equal(mapped.mapping_status, 'MAPPED');
});

test('MR !1571 and !1586 version bumps are static-only only under their exact identities and six-path sets', () => {
  const contracts = [
    {
      mrIid: '1571',
      mergeCommitSha: '4228e99aee9e2dd364eb7bc0013300791650ad9c',
      diffSha256: '4c4a8b7d99b43017a217796441f162cf081ee16a9898d66a0f57a672bc110e18',
      changedPaths: [
        '.deepbank-runtime/runtime-provision-seed/0.1.6/provision-manifest.json',
        '.deepbank-runtime/runtime-provision-seed/0.1.7/provision-manifest.json',
        'deploy/helm/qbot/Chart.yaml',
        'package-lock.json',
        'package.json',
        'teams360.host-sync.json',
      ],
    },
    {
      mrIid: '1586',
      mergeCommitSha: '4763f90e276f05c6147affdf4751de6e67d2da85',
      diffSha256: '6b3b4780d5737b3f57ced31e61365ee13950e9389e36e89c768292ae488f1c65',
      changedPaths: [
        '.deepbank-runtime/runtime-provision-seed/0.1.7/provision-manifest.json',
        '.deepbank-runtime/runtime-provision-seed/0.1.8/provision-manifest.json',
        'deploy/helm/qbot/Chart.yaml',
        'package-lock.json',
        'package.json',
        'teams360.host-sync.json',
      ],
    },
  ];

  for (const contract of contracts) {
    const exact = mapReleaseImpact(contract);
    assert.deepEqual(exact.product_paths, [], `!${contract.mrIid}`);
    assert.deepEqual(exact.direct_case_ids, [], `!${contract.mrIid}`);
    assert.deepEqual(exact.required_stages, ['G1'], `!${contract.mrIid}`);
    assert.deepEqual(exact.unmapped_product_paths, [], `!${contract.mrIid}`);
    assert.equal(exact.mapping_status, 'MAPPED', `!${contract.mrIid}`);

    for (const mutation of [
      { mergeCommitSha: '0'.repeat(40) },
      { diffSha256: '0'.repeat(64) },
      { changedPaths: [...contract.changedPaths.slice(0, -1), 'package-extra.json'] },
      { changedPaths: contract.changedPaths.slice(0, -1) },
      { changedPaths: [...contract.changedPaths, 'README.md'] },
    ]) {
      const drifted = mapReleaseImpact({ ...contract, ...mutation });
      assert.equal(drifted.mapping_status, 'BLOCKED', `!${contract.mrIid} ${JSON.stringify(mutation)}`);
      assert.notEqual(drifted.unmapped_product_paths.length, 0, `!${contract.mrIid}`);
    }
  }
});

test('MR !1595 is static-only only under its exact retirement diff identity and path shape', () => {
  const staticPaths = Array.from({ length: 182 }, (_, index) => `test/retired/fixture-${index}.test.mjs`);
  const base = {
    changedPaths: [...staticPaths, 'playwright.config.mjs', 'package.json'],
    mrIid: '1595',
    mergeCommitSha: '3b61267f74bb61b3053c970dd5c7b98d27683e6a',
    diffSha256: '867e9491a91485f3fba33bd9b3d53b04644f697a9d4a083a0239f87c33ec0852',
  };
  const exact = mapReleaseImpact(base);
  assert.deepEqual(exact.product_paths, []);
  assert.deepEqual(exact.direct_case_ids, []);
  assert.deepEqual(exact.required_stages, ['G1']);
  assert.deepEqual(exact.unmapped_product_paths, []);
  assert.equal(exact.mapping_status, 'MAPPED');

  for (const candidate of [
    { diffSha256: '0'.repeat(64) },
    { changedPaths: [...staticPaths.slice(1), 'src/runtime.ts', 'playwright.config.mjs', 'package.json'] },
  ]) {
    const drifted = mapReleaseImpact({ ...base, ...candidate });
    assert.notEqual(drifted.product_paths.length, 0);
    assert.equal(drifted.mapping_status, 'BLOCKED');
    assert.notEqual(drifted.unmapped_product_paths.length, 0);
  }

  const wrongIdentity = mapReleaseImpact({ ...base, mergeCommitSha: '0'.repeat(40) });
  assert.deepEqual(wrongIdentity.product_paths, ['package.json']);
  assert.equal(wrongIdentity.mapping_status, 'BLOCKED');
  assert.notEqual(wrongIdentity.unmapped_product_paths.length, 0);
});

test('MR !1579 freezes Claude Skill call canonicalization source and test declarations without attesting execution', () => {
  const contract = QWORK_MR1579_CLAUDE_SKILL_CALL_CANONICALIZATION_CONTRACT;
  assert.equal(
    contract.contract_id,
    QWORK_MR1579_CLAUDE_SKILL_CALL_CANONICALIZATION_CONTRACT_ID,
  );
  assert.equal(contract.contract_sha256, '9f3bb225ae6a09d4eb053e1c00fd29a16ccd38df26de8e392a93929530ed6cdb');
  assert.equal(contract.mr_iid, '1579');
  assert.equal(contract.state, 'merged');
  assert.equal(contract.target_branch, 'release/0.1');
  assert.equal(contract.merge_commit_sha, '7f9b520f41ed9ac34b9230f28df49a5fce678953');
  assert.equal(contract.changes_count, 12);
  assert.deepEqual(contract.changed_paths, [
    'scripts/ci/unit/node-unit-test-weights.json',
    'server/qbot-core/engine/engine.mjs',
    'server/qbot-core/experts/expert-v2-runtime.mjs',
    'server/qbot-core/models/claude-media-compatibility-loopback.mjs',
    'server/qbot-core/models/claude-media-compatibility.mjs',
    'server/qbot-core/models/claude-skill-call-compatibility.mjs',
    'server/qbot-core/.architecture.yaml',
    'test/unit/server/claude-media-compatibility.test.mjs',
    'test/unit/server/claude-skill-call-compatibility.test.mjs',
    'test/unit/skills/claude-skill-invocation-note.test.mjs',
    'test/unit/skills/expert-v2-runtime-boundaries.test.mjs',
    'test/unit/skills/skillhub-engine-preflight.test.mjs',
  ]);
  assert.deepEqual(contract.mr_diff, {
    bytes: 63270,
    sha256: 'e250309ca8e588db87b9214def6b1acb25e54d8a4605d93ba651cf1c34ff8967',
  });
  assert.deepEqual(
    [contract.source_file.change_bytes, contract.source_file.change_sha256],
    [10988, '7d8a961c2685b018802df4197aee150db424e3f7da5661ae0bfce1101e5b80c6'],
  );
  assert.deepEqual(
    [contract.source_file.source_bytes, contract.source_file.source_sha256, contract.source_file.source_line_count],
    [10166, '4bd61aab3e4ec870a9bee2a8ff954a0dca7795231bf51412b4e240fd4d644525', 286],
  );
  assert.equal(contract.source_file.proof_mode, 'exact-new-file');
  assert.equal(contract.claim_scope, QWORK_RELEASE_SOURCE_CLAIM_SCOPE);
  assert.equal(contract.test_execution_attested, false);
  assert.equal(QWORK_RELEASE_SOURCE_CONTRACTS.includes(contract), true);

  const bindingIds = new Set(contract.integration_bindings.map((binding) => binding.id));
  for (const id of [
    'alias_uses_invocation_name',
    'alias_maps_to_invocation_name',
    'ambiguous_alias_fails_closed',
    'unknown_alias_fails_closed',
    'only_skill_name_is_rewritten',
    'tool_use_outer_fields_are_preserved',
    'json_payload_rewriter_exported',
    'malformed_sse_fails_closed',
    'oversized_sse_fails_closed',
    'incomplete_sse_fails_closed',
    'loopback_stream_uses_sse_rewriter',
    'loopback_json_uses_payload_rewriter',
    'engine_passes_skill_preflight_to_loopback',
    'draft_expert_hides_durable_skill_identity',
    'published_expert_hides_durable_skill_identity',
    'test_asserts_args_preserved',
    'test_asserts_other_tool_preserved',
  ]) assert.equal(bindingIds.has(id), true, id);

  assert.deepEqual(
    contract.forbidden_fragments.slice(0, 2).map((assertion) => assertion.id),
    ['engine_must_not_set_disable_flag', 'architecture_must_not_set_disable_flag'],
  );
});

test('MR !1579 exact-new-file contract rejects source, binding, and path drift', () => {
  const fixture = exactNewFileContractFixture(
    QWORK_MR1579_CLAUDE_SKILL_CALL_CANONICALIZATION_CONTRACT,
  );
  const verified = auditFixture(fixture);
  assert.equal(verified.verified, true, verified.failures.join(','));
  assert.deepEqual(verified.failures, []);

  const sourceDrift = structuredClone(fixture.changes);
  const sourceChange = sourceDrift.find((change) => (
    change.new_path === fixture.contract.source_file.path
  ));
  const binding = fixture.contract.integration_bindings.find((item) => (
    item.path === fixture.contract.source_file.path
  ));
  sourceChange.diff = sourceChange.diff.replace(
    `+${binding.addition.source}`,
    `+${binding.addition.source} // drift`,
  );
  const sourceAudit = auditFixture(fixture, { changes: sourceDrift });
  assert.equal(sourceAudit.verified, false);
  assert.equal(sourceAudit.failures.includes('mr_diff_sha256_mismatch'), true);
  assert.equal(sourceAudit.failures.includes('source_source_sha256_mismatch'), true);
  assert.equal(sourceAudit.failures.includes(`integration_binding_mismatch:${binding.id}`), true);

  const pathDrift = structuredClone(fixture.changes);
  pathDrift[0].new_path = `${pathDrift[0].new_path}.drift`;
  const pathAudit = auditFixture(fixture, { changes: pathDrift });
  assert.equal(pathAudit.verified, false);
  assert.equal(pathAudit.failures.includes('mr_changed_paths_mismatch'), true);
});

test('MR !1579 current-release assertions fail closed on deletion, duplication, or forbidden restoration', () => {
  const contract = QWORK_MR1579_CLAUDE_SKILL_CALL_CANONICALIZATION_CONTRACT;
  const head = '7'.repeat(40);
  const fixtureMap = currentReleaseFileFixtures([contract], head);
  const baseFiles = [...fixtureMap].map(([filePath, payload]) => ({
    path: filePath,
    requested_ref: head,
    payload,
  }));
  const audit = (files) => auditCurrentReleaseSourceContract({
    releaseHead: head,
    targetBranch: contract.target_branch,
    originAncestry: {
      source: 'gitlab-api-compare-first-parent',
      compare_from: contract.merge_commit_sha,
      compare_to: head,
      compare_commit_count: 1,
      first_parent_complete: true,
      verified: true,
      reason: '',
    },
    files,
    mergeRequests: [],
    originAttestation: null,
    contract,
  });
  const rewrite = (files, filePath, transform) => {
    const copy = structuredClone(files);
    const file = copy.find((item) => item.path === filePath);
    assert.ok(file, filePath);
    const source = Buffer.from(file.payload.content, 'base64').toString('utf8');
    const updated = transform(source);
    file.payload.content = Buffer.from(updated, 'utf8').toString('base64');
    file.payload.size = Buffer.byteLength(updated, 'utf8');
    file.payload.blob_id = gitBlobSha1(updated);
    return copy;
  };

  const verified = audit(baseFiles);
  assert.equal(verified.verified, true, verified.failures.join(','));
  assert.deepEqual(verified.failures, []);
  for (const binding of contract.integration_bindings) {
    const deleted = audit(rewrite(baseFiles, binding.path, (source) => (
      source.replace(`${binding.addition.source}\n`, '')
    )));
    assert.equal(deleted.verified, false, `delete:${binding.id}`);
    assert.equal(
      deleted.failures.includes(`current_integration_binding_mismatch:${binding.id}`),
      true,
      `delete:${binding.id}`,
    );
    const duplicated = audit(rewrite(baseFiles, binding.path, (source) => (
      `${source}${binding.addition.source}\n`
    )));
    assert.equal(duplicated.verified, false, `duplicate:${binding.id}`);
    assert.equal(
      duplicated.failures.includes(`current_integration_binding_mismatch:${binding.id}`),
      true,
      `duplicate:${binding.id}`,
    );
  }
  for (const forbidden of contract.forbidden_fragments) {
    const restored = audit(rewrite(baseFiles, forbidden.path, (source) => (
      `${source}${forbidden.value.source}\n`
    )));
    assert.equal(restored.verified, false, forbidden.id);
    assert.equal(
      restored.failures.includes(`current_forbidden_fragment:${forbidden.id}`),
      true,
      forbidden.id,
    );
  }
});
