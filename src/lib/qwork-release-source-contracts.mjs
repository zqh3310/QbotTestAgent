import { createHash } from 'node:crypto';
import { parse } from 'acorn';

export const QWORK_RELEASE_SOURCE_CONTRACT_SCHEMA = 'qbot-qwork-release-source-contract/v1';
// Origin-change attestations keep the historical v1 wire contract.  A
// current-release attestation contains complete protected-file bytes and an
// independent file-history readback, so it has an intentionally incompatible
// schema instead of silently widening v1.
export const QWORK_RELEASE_CURRENT_SOURCE_CONTRACT_SCHEMA = 'qbot-qwork-release-current-source-contract/v4';
export const QWORK_RELEASE_FILE_PROVENANCE_SCHEMA = 'qbot-qwork-release-file-provenance/v2';
export const QWORK_GITLAB_FIRST_PARENT_COMPARE_SCHEMA = 'qbot-qwork-gitlab-first-parent-compare/v1';
export const QWORK_SOURCE_BINDING_SUCCESSOR_RELATIONSHIP_SCHEMA = 'qbot-qwork-source-binding-successor-relationship/v2';
const QWORK_RELEASE_FILE_PROVENANCE_DIFF_PAGE_SIZE = 100;
const QWORK_RELEASE_FILE_PROVENANCE_MAX_DIFF_PAGES = 100;
export const QWORK_RELEASE_SOURCE_CLAIM_SCOPE = 'source_and_test_declarations';
export const QWORK_RELEASE_SOURCE_TEST_EXECUTION_ATTESTED = false;
export const QWORK_RELEASE_SOURCE_OWNER_SCOPE_SCHEMA = 'qbot-qwork-release-source-owner-scope/v1';
export const QWORK_MR1522_CLAUDE_TURN_HEADERS_CONTRACT_ID = 'deepbankv2-mr-1522-claude-turn-headers/v1';
export const QWORK_MR1544_CLAUDE_TURN_HEADER_BRANDING_CONTRACT_ID = 'deepbankv2-mr-1544-claude-turn-header-branding/v1';
export const QWORK_MR1548_CALL_TOOL_BUDGET_CONTRACT_ID = 'deepbankv2-mr-1548-call-tool-budget/v1';
export const QWORK_MR1546_REJECTED_REGENERATE_CONTRACT_ID = 'deepbankv2-mr-1546-rejected-regenerate/v1';
export const QWORK_MR1557_IMMEDIATE_REGENERATE_PROJECTION_CONTRACT_ID = 'deepbankv2-mr-1557-immediate-regenerate-projection/v1';
export const QWORK_MR1540_MEMORY_FEATURE_PROFILE_CONTRACT_ID = 'deepbankv2-mr-1540-memory-feature-profile/v1';
export const QWORK_MR1550_CLAUDE_SKILL_DESCRIPTION_ROUTING_CONTRACT_ID = 'deepbankv2-mr-1550-claude-skill-description-routing/v1';
export const QWORK_MR1558_SETTINGS_MODEL_NAME_DEDUP_CONTRACT_ID = 'deepbankv2-mr-1558-settings-model-name-dedup/v1';
export const QWORK_MR1595_OBSOLETE_TEST_RETIREMENT_CONTRACT_ID = 'deepbankv2-mr-1595-obsolete-test-retirement/v1';
export const QWORK_MR1590_QBOT_EXPERT_CLOUD_INSTALLATION_CONTRACT_ID = 'deepbankv2-mr-1590-qbot-expert-cloud-installation/v1';
export const QWORK_MR1593_QBOT_ADDITIVE_RESPONSE_COMPATIBILITY_CONTRACT_ID = 'deepbankv2-mr-1593-qbot-additive-response-compatibility/v1';
export const QWORK_MR1596_ANONYMOUS_STABLE_RUNTIME_DISCOVERY_CONTRACT_ID = 'deepbankv2-mr-1596-anonymous-stable-runtime-discovery/v1';
export const QWORK_MR1597_WORKER_IM_USER_IDENTITY_FORWARDING_CONTRACT_ID = 'deepbankv2-mr-1597-worker-im-user-identity-forwarding/v1';
export const QWORK_MR1561_WORKER_ENVELOPE_LIMIT_CONTRACT_ID = 'deepbankv2-mr-1561-worker-envelope-limit/v1';
export const QWORK_MR1560_TURN_AUTHORITY_READINESS_CONTRACT_ID = 'deepbankv2-mr-1560-turn-authority-readiness/v1';
export const QWORK_MR1573_MEMORY_SESSION_PROFILE_STABILITY_CONTRACT_ID = 'deepbankv2-mr-1573-memory-session-profile-stability/v1';
export const QWORK_MR1579_CLAUDE_SKILL_CALL_CANONICALIZATION_CONTRACT_ID = 'deepbankv2-mr-1579-claude-skill-call-canonicalization/v1';

const HEX40 = /^[a-f0-9]{40}$/iu;
const HEX64 = /^[a-f0-9]{64}$/iu;
const CURRENT_RELEASE_OWNER_SCOPE_BOUNDARY = 'next-top-level-test-or-eof';
const CURRENT_RELEASE_REGION_SCOPE_BOUNDARY = 'anchored-line-region-within-next-top-level-test';
const CURRENT_RELEASE_SCOPED_BINDINGS = new Map([
  [QWORK_MR1540_MEMORY_FEATURE_PROFILE_CONTRACT_ID, new Set([
    'feature_check_body_absent_test',
    'test_profile_report_exact_body',
  ])],
  [QWORK_MR1597_WORKER_IM_USER_IDENTITY_FORWARDING_CONTRACT_ID, new Set([
    'test_worker_identity_mdmcode_expected',
    'test_worker_identity_email_expected',
    'test_worker_identity_domain_account_expected',
    'test_worker_identity_profile_expected',
    'test_worker_access_token_input_only',
  ])],
]);
const SOURCE_AND_TEST_DECLARATION = Object.freeze({
  claim_scope: QWORK_RELEASE_SOURCE_CLAIM_SCOPE,
  test_execution_attested: QWORK_RELEASE_SOURCE_TEST_EXECUTION_ATTESTED,
});

function text(value) {
  return String(value ?? '').trim();
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stableValue(value[key])]));
  }
  return value;
}

function stableJson(value) {
  return JSON.stringify(stableValue(value));
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

const GITLAB_COMMIT_WEB_URL_PREFIX = 'https://gitlab.daikuan.qihoo.net/songrongxin/deepbankv2/-/commit/';
const GITLAB_COMMIT_METADATA_KEYS = Object.freeze([
  'author_email', 'author_name', 'authored_date', 'committed_date', 'committer_email',
  'committer_name', 'created_at', 'id', 'last_pipeline', 'message',
  'parent_ids', 'project_id', 'short_id', 'stats', 'status', 'title', 'trailers', 'web_url',
]);
const GITLAB_PIPELINE_METADATA_KEYS = Object.freeze([
  'created_at', 'id', 'iid', 'project_id', 'ref', 'sha', 'source', 'status',
  'updated_at', 'web_url',
]);
const GITLAB_DIFF_REQUIRED_CHANGE_KEYS = Object.freeze([
  'a_mode', 'b_mode', 'deleted_file', 'diff', 'new_file', 'new_path', 'old_path',
  'renamed_file',
]);
const GITLAB_DIFF_OPTIONAL_CHANGE_KEYS = Object.freeze([
  'collapsed', 'generated_file', 'too_large',
]);
const GITLAB_DIFF_ALLOWED_CHANGE_KEYS = new Set([
  ...GITLAB_DIFF_REQUIRED_CHANGE_KEYS,
  ...GITLAB_DIFF_OPTIONAL_CHANGE_KEYS,
]);
// Repository compare responses expose the same commit metadata surface as
// the commits API.  Only the graph fields are mandatory, while all other
// fields are optional known GitLab fields.  The allowlist is closed so a raw
// response cannot smuggle an unknown field into the ancestry resolver.
const GITLAB_COMPARE_COMMIT_ALLOWED_KEYS = new Set([
  ...GITLAB_COMMIT_METADATA_KEYS,
  'extended_trailers',
]);
const LOWER_HEX40 = /^[a-f0-9]{40}$/u;

function isCanonicalIsoTimestamp(value) {
  if (typeof value !== 'string' || value !== value.trim()) return false;
  const match = value.match(
    /^(\d{4})-(0[1-9]|1[0-2])-([0-2]\d|3[01])T([01]\d|2[0-3]):([0-5]\d):([0-5]\d)(?:\.\d{1,6})?(Z|[+-](?:0\d|1[0-4]):[0-5]\d)$/u,
  );
  if (!match) return false;
  const [, yearText, monthText, dayText, , , , zone] = match;
  if ((zone.startsWith('+14:') || zone.startsWith('-14:')) && !zone.endsWith(':00')) return false;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const calendar = new Date(Date.UTC(year, month - 1, day));
  return calendar.getUTCFullYear() === year
    && calendar.getUTCMonth() === month - 1
    && calendar.getUTCDate() === day
    && Number.isFinite(Date.parse(value));
}

export function validateCanonicalGitLabCommitMetadata(metadata, expectedId = '') {
  const failures = [];
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return { ok: false, failures: ['metadata_not_object'], projection: null };
  }
  if (!objectHasExactKeys(metadata, GITLAB_COMMIT_METADATA_KEYS)) failures.push('fields_mismatch');
  const id = metadata.id;
  if (typeof id !== 'string' || !/^[a-f0-9]{40}$/u.test(id) || (expectedId && id !== expectedId)) {
    failures.push('id_invalid');
  }
  if (typeof metadata.short_id !== 'string'
    || !/^[a-f0-9]{8,12}$/u.test(metadata.short_id)
    || (typeof id === 'string' && !id.startsWith(metadata.short_id))) {
    failures.push('short_id_invalid');
  }
  if (!Array.isArray(metadata.parent_ids)
    || metadata.parent_ids.some((parentId) => (
      typeof parentId !== 'string' || !/^[a-f0-9]{40}$/u.test(parentId)
    ))
    || new Set(metadata.parent_ids).size !== metadata.parent_ids.length) {
    failures.push('parent_ids_invalid');
  }
  for (const field of [
    'title', 'author_name', 'author_email', 'committer_name', 'committer_email',
  ]) {
    if (typeof metadata[field] !== 'string'
      || !metadata[field].trim()
      || metadata[field] !== metadata[field].trim()) {
      failures.push(`${field}_invalid`);
    }
  }
  if (typeof metadata.message !== 'string' || !metadata.message.trim()) {
    failures.push('message_invalid');
  }
  for (const field of ['created_at', 'authored_date', 'committed_date']) {
    if (!isCanonicalIsoTimestamp(metadata[field])) failures.push(`${field}_invalid`);
  }
  if (!metadata.trailers || typeof metadata.trailers !== 'object' || Array.isArray(metadata.trailers)
    || Object.entries(metadata.trailers).some(([key, value]) => (
      !key.trim() || key !== key.trim() || typeof value !== 'string'
    ))) {
    failures.push('trailers_invalid');
  }
  if (!Number.isSafeInteger(metadata.project_id) || metadata.project_id <= 0) {
    failures.push('project_id_invalid');
  }
  if (!objectHasExactKeys(metadata.stats, ['additions', 'deletions', 'total'])
    || !['additions', 'deletions', 'total'].every((field) => (
      Number.isSafeInteger(metadata.stats?.[field]) && metadata.stats[field] >= 0
    ))
    || metadata.stats.total !== metadata.stats.additions + metadata.stats.deletions) {
    failures.push('stats_invalid');
  }
  if (metadata.status !== null
    && (typeof metadata.status !== 'string'
      || !metadata.status.trim()
      || metadata.status !== metadata.status.trim())) {
    failures.push('status_invalid');
  }
  if (metadata.last_pipeline !== null) {
    const pipeline = metadata.last_pipeline;
    if (!objectHasExactKeys(pipeline, GITLAB_PIPELINE_METADATA_KEYS)) {
      failures.push('last_pipeline_fields_mismatch');
    } else {
      for (const field of ['id', 'iid', 'project_id']) {
        if (!Number.isSafeInteger(pipeline[field]) || pipeline[field] <= 0) {
          failures.push(`last_pipeline_${field}_invalid`);
        }
      }
      for (const field of ['ref', 'source', 'status']) {
        if (typeof pipeline[field] !== 'string'
          || !pipeline[field].trim()
          || pipeline[field] !== pipeline[field].trim()) {
          failures.push(`last_pipeline_${field}_invalid`);
        }
      }
      if (typeof pipeline.sha !== 'string' || !/^[a-f0-9]{40}$/u.test(pipeline.sha)) {
        failures.push('last_pipeline_sha_invalid');
      }
      if (pipeline.project_id !== metadata.project_id) {
        failures.push('last_pipeline_project_id_mismatch');
      }
      if (pipeline.sha !== metadata.id) failures.push('last_pipeline_sha_mismatch');
      for (const field of ['created_at', 'updated_at']) {
        if (!isCanonicalIsoTimestamp(pipeline[field])) {
          failures.push(`last_pipeline_${field}_invalid`);
        }
      }
      if (typeof pipeline.web_url !== 'string'
        || pipeline.web_url
          !== `https://gitlab.daikuan.qihoo.net/songrongxin/deepbankv2/-/pipelines/${pipeline.id}`) {
        failures.push('last_pipeline_web_url_invalid');
      }
    }
  }
  if (typeof metadata.web_url !== 'string'
    || metadata.web_url !== `${GITLAB_COMMIT_WEB_URL_PREFIX}${id}`) {
    failures.push('web_url_invalid');
  }
  return {
    ok: failures.length === 0,
    failures,
    projection: failures.length === 0 ? stableValue(metadata) : null,
  };
}

export function validateCanonicalGitLabDiffChange(change) {
  const failures = [];
  if (!change || typeof change !== 'object' || Array.isArray(change)) {
    return { ok: false, failures: ['change_not_object'], projection: null };
  }
  if (GITLAB_DIFF_REQUIRED_CHANGE_KEYS.some((field) => (
    !Object.prototype.hasOwnProperty.call(change, field)
  )) || Object.keys(change).some((field) => !GITLAB_DIFF_ALLOWED_CHANGE_KEYS.has(field))) {
    failures.push('fields_mismatch');
  }
  if (typeof change.old_path !== 'string'
    || typeof change.new_path !== 'string'
    || !change.old_path.trim()
    || !change.new_path.trim()
    || change.old_path !== change.old_path.trim()
    || change.new_path !== change.new_path.trim()) {
    failures.push('path_invalid');
  }
  for (const field of ['new_file', 'renamed_file', 'deleted_file']) {
    if (typeof change[field] !== 'boolean') failures.push(`${field}_invalid`);
  }
  for (const field of GITLAB_DIFF_OPTIONAL_CHANGE_KEYS) {
    if (Object.prototype.hasOwnProperty.call(change, field) && typeof change[field] !== 'boolean') {
      failures.push(`${field}_invalid`);
    }
  }
  for (const field of ['a_mode', 'b_mode']) {
    if (typeof change[field] !== 'string' || !/^(?:0|[0-7]{6})$/u.test(change[field])) {
      failures.push(`${field}_invalid`);
    }
  }
  if (typeof change.diff !== 'string') failures.push('diff_invalid');
  if (change.collapsed === true || change.too_large === true) failures.push('diff_incomplete');
  if (failures.length === 0) {
    const enabledFlags = [change.new_file, change.renamed_file, change.deleted_file]
      .filter((enabled) => enabled).length;
    const pathChanged = change.old_path !== change.new_path;
    if (enabledFlags > 1 || change.renamed_file !== pathChanged) failures.push('flags_conflict');
  }
  const projection = failures.some((failure) => [
    'change_not_object', 'fields_mismatch', 'path_invalid', 'new_file_invalid',
    'renamed_file_invalid', 'deleted_file_invalid', 'generated_file_invalid',
    'collapsed_invalid', 'too_large_invalid', 'a_mode_invalid', 'b_mode_invalid', 'diff_invalid',
  ].includes(failure)) ? null : {
    old_path: change.old_path,
    new_path: change.new_path,
    new_file: change.new_file,
    renamed_file: change.renamed_file,
    deleted_file: change.deleted_file,
  };
  return { ok: failures.length === 0, failures, projection };
}

function gitBlobSha1(bytes) {
  return createHash('sha1')
    .update(`blob ${bytes.length}\0`, 'utf8')
    .update(bytes)
    .digest('hex');
}

function byteRecord(source) {
  return Object.freeze({
    source,
    bytes: Buffer.byteLength(source, 'utf8'),
    sha256: sha256(source),
  });
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

function currentReleaseOwnerScope(ownerStart, requiredFragments) {
  return {
    schema_version: QWORK_RELEASE_SOURCE_OWNER_SCOPE_SCHEMA,
    boundary: CURRENT_RELEASE_OWNER_SCOPE_BOUNDARY,
    owner_start: byteRecord(ownerStart),
    required_fragments: requiredFragments.map(([id, source]) => ({
      id,
      match: 'line',
      value: byteRecord(source),
    })),
  };
}

function currentReleaseRegionScope({
  ownerStart,
  regionStart,
  regionEnd,
  ownerRegionOrder,
  requiredFragments,
  requiredFragmentLineIndexes,
  regionEndInclusive = true,
  forbiddenFragments = [],
}) {
  const lineIndexes = requiredFragmentLineIndexes
    ?? requiredFragments.map((_, index) => index + 1);
  return {
    schema_version: QWORK_RELEASE_SOURCE_OWNER_SCOPE_SCHEMA,
    boundary: CURRENT_RELEASE_REGION_SCOPE_BOUNDARY,
    owner_start: byteRecord(ownerStart),
    region_start: byteRecord(regionStart),
    region_end: byteRecord(regionEnd),
    region_end_inclusive: regionEndInclusive,
    owner_region_order: ownerRegionOrder.map((source) => byteRecord(source)),
    required_fragments: requiredFragments.map(([id, source], index) => ({
      id,
      match: 'line',
      value: byteRecord(source),
      expected_line_index: lineIndexes[index],
    })),
    forbidden_fragments: forbiddenFragments.map(([id, source, match = 'line']) => ({
      id,
      match,
      value: byteRecord(source),
    })),
  };
}

const MR1522_HEADER_EMISSIONS = [
  {
    name: 'user-agent',
    wire_name: 'User-Agent',
    value_source: 'userAgent',
    value_template: 'SID_${normalizedSessionId}#TID_${normalizedTurnId}#REQ_${normalizedRequestId}#${normalizedRequestTime}#${formatRequestTimeForUserAgent(normalizedRequestTime)}',
    value_definition: byteRecord('    const userAgent = `SID_${normalizedSessionId}#TID_${normalizedTurnId}#REQ_${normalizedRequestId}#${normalizedRequestTime}#${formatRequestTimeForUserAgent(normalizedRequestTime)}`;'),
    emission: byteRecord('    lines.push(`User-Agent: ${userAgent}`);'),
  },
  {
    name: 'x-session-id',
    wire_name: 'x-session-id',
    value_source: 'normalizedSessionId',
    emission: byteRecord("  appendHeader(lines, 'x-session-id', normalizedSessionId);"),
  },
  {
    name: 'x-turn-id',
    wire_name: 'x-turn-id',
    value_source: 'normalizedTurnId',
    emission: byteRecord("  appendHeader(lines, 'x-turn-id', normalizedTurnId);"),
  },
  {
    name: 'x-request-id',
    wire_name: 'x-request-id',
    value_source: 'normalizedRequestId',
    emission: byteRecord("  appendHeader(lines, 'x-request-id', normalizedRequestId);"),
  },
  {
    name: 'x-request-time',
    wire_name: 'x-request-time',
    value_source: 'normalizedRequestTime',
    emission: byteRecord("  appendHeader(lines, 'x-request-time', normalizedRequestTime);"),
  },
];

const MR1522_INTEGRATION_BINDINGS = [
  {
    id: 'host_passes_current_turn_id',
    path: 'electron/host-core/agent/desktop-host-context.cjs',
    addition: byteRecord('        session: turnSession, turnId: currentTurnId,'),
  },
  {
    id: 'engine_injects_headers_into_sdk_env',
    path: 'server/qbot-core/engine/engine.mjs',
    addition: byteRecord('    claudeQueryEnv = withClaudeTurnHeadersEnv(claudeQueryEnv, { sessionId: s?.id, turnId, ...turnRequestContext });'),
  },
  {
    id: 'fallback_preserves_turn_id',
    path: 'server/qbot-core/engine/engine.mjs',
    addition: byteRecord('      session: { ...preferredOrderFallbackSession, agentSessionId: null }, turnId,'),
  },
  {
    id: 'fallback_reuses_request_context',
    path: 'server/qbot-core/engine/engine.mjs',
    addition: byteRecord('      preferredOrderFallbackSession: null, claudeTurnRequestContext: turnRequestContext,'),
  },
];

const MR1522_CONTRACT_DEFINITION = {
  ...SOURCE_AND_TEST_DECLARATION,
  contract_id: QWORK_MR1522_CLAUDE_TURN_HEADERS_CONTRACT_ID,
  mr_iid: '1522',
  state: 'merged',
  target_branch: 'release/0.1',
  merge_commit_sha: '4693c5bd57b1170bed530e7559f9dc93a0b4a492',
  changes_count: 5,
  changed_paths: [
    'electron/host-core/agent/desktop-host-context.cjs',
    'server/qbot-core/engine/engine.mjs',
    'server/qbot-core/models/claude-turn-headers.mjs',
    'test/unit/runtime/runtime-connection-ownership.test.mjs',
    'test/unit/server/engine-stream-adapters.test.mjs',
  ],
  mr_diff: {
    bytes: 18038,
    sha256: 'f1a9b0af3a286e55add0af61b7703af6f85a003d955ab7b6cdbe4704a6de4c80',
  },
  source_file: {
    proof_mode: 'exact-new-file',
    path: 'server/qbot-core/models/claude-turn-headers.mjs',
    old_path: 'server/qbot-core/models/claude-turn-headers.mjs',
    new_file: true,
    renamed_file: false,
    deleted_file: false,
    change_bytes: 4108,
    change_sha256: 'b054dd67a3f4962a66e04c706af3f02639fa07296d3d71256b8f889036baae42',
    source_bytes: 3673,
    source_sha256: 'e81904c2527675117a74d8227b1ee2761bfeb59093c7a4b65c63c4d4f5fcd62d',
    source_line_count: 111,
  },
  header_emissions: MR1522_HEADER_EMISSIONS,
  integration_bindings: MR1522_INTEGRATION_BINDINGS,
};

export const QWORK_MR1522_CLAUDE_TURN_HEADERS_CONTRACT = deepFreeze({
  ...MR1522_CONTRACT_DEFINITION,
  contract_sha256: sha256(stableJson(MR1522_CONTRACT_DEFINITION)),
});

const MR1544_HEADER_EMISSIONS = [
  {
    name: 'x-qwork-session',
    wire_name: 'x-qwork-session',
    value_source: 'qworkSession',
    value_template: 'qwork-SID_${normalizedSessionId}#TID_${normalizedTurnId}#REQ_${normalizedRequestId}#${normalizedRequestTime}#${formatRequestTimeForUserAgent(normalizedRequestTime)}',
    value_definition: byteRecord('    const qworkSession = `qwork-SID_${normalizedSessionId}#TID_${normalizedTurnId}#REQ_${normalizedRequestId}#${normalizedRequestTime}#${formatRequestTimeForUserAgent(normalizedRequestTime)}`;'),
    emission: byteRecord('    lines.push(`x-qwork-session: ${qworkSession}`);'),
  },
  {
    name: 'x-qwork-session-id',
    wire_name: 'x-qwork-session-id',
    value_source: 'normalizedSessionId',
    value_definition: byteRecord("  const normalizedSessionId = headerValue('x-qwork-session-id', sessionId, { required: false });"),
    emission: byteRecord("  appendHeader(lines, 'x-qwork-session-id', normalizedSessionId);"),
  },
  {
    name: 'x-qwork-turn-id',
    wire_name: 'x-qwork-turn-id',
    value_source: 'normalizedTurnId',
    value_definition: byteRecord("  const normalizedTurnId = headerValue('x-qwork-turn-id', turnId, { required: false });"),
    emission: byteRecord("  appendHeader(lines, 'x-qwork-turn-id', normalizedTurnId);"),
  },
  {
    name: 'x-qwork-request-id',
    wire_name: 'x-qwork-request-id',
    value_source: 'normalizedRequestId',
    value_definition: byteRecord("  const normalizedRequestId = headerValue('x-qwork-request-id', requestId).toLowerCase();"),
    emission: byteRecord("  appendHeader(lines, 'x-qwork-request-id', normalizedRequestId);"),
  },
  {
    name: 'x-qwork-request-time',
    wire_name: 'x-qwork-request-time',
    value_source: 'normalizedRequestTime',
    emission: byteRecord("  appendHeader(lines, 'x-qwork-request-time', normalizedRequestTime);"),
  },
];

const MR1544_SOURCE_PATH = 'server/qbot-core/models/claude-turn-headers.mjs';
const MR1544_INTEGRATION_BINDINGS = [
  ['stale_qwork_session_cleanup', "  'x-qwork-session',"],
  ['stale_qwork_session_id_cleanup', "  'x-qwork-session-id',"],
  ['stale_qwork_turn_id_cleanup', "  'x-qwork-turn-id',"],
  ['stale_qwork_request_id_cleanup', "  'x-qwork-request-id',"],
  ['stale_qwork_request_time_cleanup', "  'x-qwork-request-time',"],
  ['qwork_request_id_validation', "    const error = new Error('Claude turn header x-qwork-request-id is invalid');"],
  ['qwork_request_time_validation', "    const error = new Error('Claude turn header x-qwork-request-time is invalid');"],
].map(([id, source]) => ({ id, path: MR1544_SOURCE_PATH, addition: byteRecord(source) }));

const MR1544_FORBIDDEN_FRAGMENTS = [
  ['legacy_user_agent_value', '    const userAgent = `SID_${normalizedSessionId}#TID_${normalizedTurnId}#REQ_${normalizedRequestId}#${normalizedRequestTime}#${formatRequestTimeForUserAgent(normalizedRequestTime)}`;'],
  ['legacy_user_agent_emission', '    lines.push(`User-Agent: ${userAgent}`);'],
  ['legacy_session_id_emission', "  appendHeader(lines, 'x-session-id', normalizedSessionId);"],
  ['legacy_turn_id_emission', "  appendHeader(lines, 'x-turn-id', normalizedTurnId);"],
  ['legacy_request_id_emission', "  appendHeader(lines, 'x-request-id', normalizedRequestId);"],
  ['legacy_request_time_emission', "  appendHeader(lines, 'x-request-time', normalizedRequestTime);"],
].map(([id, source]) => ({ id, path: MR1544_SOURCE_PATH, match: 'line', value: byteRecord(source) }));

const MR1544_CONTRACT_DEFINITION = {
  ...SOURCE_AND_TEST_DECLARATION,
  contract_id: QWORK_MR1544_CLAUDE_TURN_HEADER_BRANDING_CONTRACT_ID,
  mr_iid: '1544',
  state: 'merged',
  target_branch: 'release/0.1',
  merge_commit_sha: '16004bd34157448100945a8d50fa2d81c3e40153',
  changes_count: 3,
  changed_paths: [
    MR1544_SOURCE_PATH,
    'test/unit/runtime/runtime-connection-ownership.test.mjs',
    'test/unit/server/engine-stream-adapters.test.mjs',
  ],
  mr_diff: {
    bytes: 9047,
    sha256: 'b218b2fa93cb59bbef998547b1d3c991f5419a4b2642de1649f5765bb34e6be1',
  },
  source_file: {
    proof_mode: 'exact-added-lines',
    path: MR1544_SOURCE_PATH,
    old_path: MR1544_SOURCE_PATH,
    new_file: false,
    renamed_file: false,
    deleted_file: false,
    change_bytes: 3214,
    change_sha256: 'c4890e405fbc92e5fde783f9f87e17ac8342a9a46d0f1edba02bd9242cfa8849',
    source_bytes: 1062,
    source_sha256: '39b518052df74d24b52b627a67f99fcedfb5aaccf68e6b32cdb5687c202d9e9b',
    source_line_count: 16,
  },
  header_emissions: MR1544_HEADER_EMISSIONS,
  integration_bindings: MR1544_INTEGRATION_BINDINGS,
  forbidden_fragments: MR1544_FORBIDDEN_FRAGMENTS,
  supersedes: [{
    contract_id: QWORK_MR1522_CLAUDE_TURN_HEADERS_CONTRACT_ID,
    current_assertions: ['header_emissions'],
  }],
};

export const QWORK_MR1544_CLAUDE_TURN_HEADER_BRANDING_CONTRACT = deepFreeze({
  ...MR1544_CONTRACT_DEFINITION,
  contract_sha256: sha256(stableJson(MR1544_CONTRACT_DEFINITION)),
});

const MR1548_SOURCE_PATH = 'server/qbot-core/connectors/tool-exploration/tools/call-tool.mjs';
const MR1548_TEST_PATH = 'test/unit/runtime/tool-exploration-runtime.test.mjs';
const MR1548_INTEGRATION_BINDINGS = [
  ['default_turn_budget_1000', MR1548_SOURCE_PATH, '  const maxCalls = Math.max(1, Math.min(1000, Number(limits.maxCalls) || 1000));'],
  ['budget_exhaustion_non_retryable', MR1548_SOURCE_PATH, "    if (calls > maxCalls) return toolExplorationError('RATE_LIMITED', { retryable: false });"],
  ['explicit_budget_has_no_retry_delay', MR1548_TEST_PATH, '  assert.equal(rateLimited.structuredContent.retryAfterMs, undefined);'],
  ['large_batch_cardinality_128', MR1548_TEST_PATH, '  const results = await Promise.all(Array.from({ length: 128 }, () => ('],
  ['large_batch_invocation_count_128', MR1548_TEST_PATH, '  assert.equal(calls, 128);'],
  ['large_batch_has_no_errors', MR1548_TEST_PATH, '  assert.equal(results.every((result) => result.isError !== true), true);'],
].map(([id, filePath, source]) => ({ id, path: filePath, addition: byteRecord(source) }));

const MR1548_CONTRACT_DEFINITION = {
  ...SOURCE_AND_TEST_DECLARATION,
  contract_id: QWORK_MR1548_CALL_TOOL_BUDGET_CONTRACT_ID,
  mr_iid: '1548',
  state: 'merged',
  target_branch: 'release/0.1',
  merge_commit_sha: '0cd593b1fa29ff03a73d42ad845d2be31d9a6e26',
  changes_count: 2,
  changed_paths: [MR1548_SOURCE_PATH, MR1548_TEST_PATH],
  mr_diff: {
    bytes: 3570,
    sha256: 'b08be0acf8c734c1f329ddc5e9c05931edee9336f62853a96217a52c2a4e98de',
  },
  source_file: {
    proof_mode: 'exact-added-lines',
    path: MR1548_SOURCE_PATH,
    old_path: MR1548_SOURCE_PATH,
    new_file: false,
    renamed_file: false,
    deleted_file: false,
    change_bytes: 1695,
    change_sha256: '2245e6d3b74108ed066fa03d0bd954d92de42c94a70ed26c210d0a84e7605f3a',
    source_bytes: 329,
    source_sha256: '7bc30e7a4541fcfaacafb39d52101320c8d0304f31c2ef2d7a04cfe781e83b24',
    source_line_count: 4,
  },
  header_emissions: [],
  integration_bindings: MR1548_INTEGRATION_BINDINGS,
  forbidden_fragments: [{
    id: 'retry_after_ms_absent_from_call_tool',
    path: MR1548_SOURCE_PATH,
    match: 'substring',
    value: byteRecord('retryAfterMs'),
  }],
};

export const QWORK_MR1548_CALL_TOOL_BUDGET_CONTRACT = deepFreeze({
  ...MR1548_CONTRACT_DEFINITION,
  contract_sha256: sha256(stableJson(MR1548_CONTRACT_DEFINITION)),
});

const MR1546_REGENERATE_ERROR_PATH = 'src/runtime-regenerate-error.ts';
const MR1546_INTEGRATION_BINDINGS = [
  ['latest_assistant_snapshot', 'electron/host-core/agent/desktop-host-context.cjs', '  const sourceAssistantMessage = cloneValue(messages.at(-1));'],
  ['first_turn_discards_stale_agent_session', 'server/qbot-core/engine/engine.mjs', '  if (normalizedNativeRegenerate?.firstTurn) s = { ...s, agentSessionId: null };'],
  ['reload_prepares_before_reload', 'src/components/assistant-ui/assistant-recovery-actions.tsx', '        onPrepare();'],
  ['reload_invokes_runtime_after_prepare', 'src/components/assistant-ui/assistant-recovery-actions.tsx', '        onReload();'],
  ['assistant_action_wires_runtime_reload', 'src/components/assistant-ui/thread.tsx', '        onPrepare={prepareReload} onReload={() => messageRuntime.reload()}'],
  ['selected_source_turn_resolution', 'src/runtime.tsx', '    const sourceTurn = resolveRegenerateSourceTurn(messagesRef.current, parentId, config?.sourceId);'],
  ['rejected_regenerate_projects_failure', 'src/runtime.tsx', '      reloadTurnSessionIdRef.current = null; applyRegenerateFailure(setMessages, messagesRef, assistantMessage?.id, error);'],
  ['rejected_regenerate_stops_running', MR1546_REGENERATE_ERROR_PATH, '    running: false,'],
  ['rejected_regenerate_has_user_error_fallback', MR1546_REGENERATE_ERROR_PATH, "    error: errorMessage || 'Regeneration failed',"],
  ['test_rejected_regenerate_projects_failure', 'test/unit/runtime/runtime-subscription-cleanup.test.mjs', "    /catch \\(error\\) \\{[\\s\\S]*?applyRegenerateFailure\\(setMessages, messagesRef, assistantMessage\\?\\.id, error\\)/,"],
  ['test_prepare_then_reload', 'test/unit/ui/assistant-message-more-action.test.mjs', '  assert.match(recoveryActionSource, /onPrepare\\(\\);\\s*onReload\\(\\);/u);'],
  ['test_runtime_reload_wiring', 'test/unit/ui/assistant-message-more-action.test.mjs', '  assert.match(assistantActionBarSource, /onReload=\\{\\(\\) => messageRuntime\\.reload\\(\\)\\}/u);'],
  ['test_stale_first_turn_handle', 'test/unit/server/engine-stream-adapters.test.mjs', "  const output = await runFixture('claude-code', { agentSessionId: 'stale-first-turn-handle' }, {"],
].map(([id, filePath, source]) => ({ id, path: filePath, addition: byteRecord(source) }));

const MR1546_FORBIDDEN_FRAGMENTS = [
  ['adjacent_assistant_snapshot', 'electron/host-core/agent/desktop-host-context.cjs', 'line', '  const sourceAssistantMessage = cloneValue(messages[sourceIndex + 1]);'],
  ['assistant_ui_reload_wrapper', 'src/components/assistant-ui/assistant-recovery-actions.tsx', 'substring', '<ActionBarPrimitive.Reload asChild>'],
  ['prepare_only_click_handler', 'src/components/assistant-ui/assistant-recovery-actions.tsx', 'line', '        onClick={onPrepare}'],
  ['silent_send_message_restore_comment', 'src/runtime.tsx', 'line', '      // sendMessage restores the authoritative persisted branch on failure.'],
  ['first_turn_candidate_rejection', 'server/qbot-core/engine/engine.mjs', 'substring', 'regenerate_first_turn_candidate_invalid'],
].map(([id, filePath, match, source]) => ({ id, path: filePath, match, value: byteRecord(source) }));

const MR1546_CONTRACT_DEFINITION = {
  ...SOURCE_AND_TEST_DECLARATION,
  contract_id: QWORK_MR1546_REJECTED_REGENERATE_CONTRACT_ID,
  mr_iid: '1546',
  state: 'merged',
  target_branch: 'release/0.1',
  merge_commit_sha: 'fa351a4cbc3205222a75da6f0030bd8687c35587',
  changes_count: 16,
  changed_paths: [
    'electron/host-core/agent/desktop-host-context.cjs',
    'electron/host-core/agent/desktop-message-recovery.cjs',
    'server/qbot-core/engine/engine.mjs',
    'src/components/assistant-ui/assistant-recovery-actions.tsx',
    'src/components/assistant-ui/runtime-tail-status.tsx',
    'src/components/assistant-ui/thread.tsx',
    'src/app.css',
    MR1546_REGENERATE_ERROR_PATH,
    'src/runtime-regenerate-source.ts',
    'src/runtime.tsx',
    'test/e2e/local-real-claude-code.spec.mjs',
    'test/unit/desktop/desktop-regenerate-contract.test.mjs',
    'test/unit/runtime/runtime-subscription-cleanup.test.mjs',
    'test/unit/server/engine-stream-adapters.test.mjs',
    'test/unit/ui/assistant-message-more-action.test.mjs',
    'test/unit/ui/runtime-tail-status-contract.test.mjs',
  ],
  mr_diff: {
    bytes: 46188,
    sha256: '6262007ecc64655d9221e3370db62c2565115848b97a2694484c3b8e6f646e61',
  },
  source_file: {
    proof_mode: 'exact-new-file',
    path: MR1546_REGENERATE_ERROR_PATH,
    old_path: MR1546_REGENERATE_ERROR_PATH,
    new_file: true,
    renamed_file: false,
    deleted_file: false,
    change_bytes: 1822,
    change_sha256: '0aa820d303fa33cd19042f3a77cf8b14dc609818a1495030808a186b94de37ed',
    source_bytes: 1561,
    source_sha256: '3b514bd9875829779afd490c018ca9d4ded03246e80fbd4a8e53ee41ad9b788c',
    source_line_count: 42,
  },
  header_emissions: [],
  integration_bindings: MR1546_INTEGRATION_BINDINGS,
  forbidden_fragments: MR1546_FORBIDDEN_FRAGMENTS,
};

export const QWORK_MR1546_REJECTED_REGENERATE_CONTRACT = deepFreeze({
  ...MR1546_CONTRACT_DEFINITION,
  contract_sha256: sha256(stableJson(MR1546_CONTRACT_DEFINITION)),
});

const MR1557_SOURCE_PATH = 'src/optimistic-turn-transaction.ts';
const MR1557_INTEGRATION_BINDINGS = [
  ['latest_assistant_snapshot', 'electron/host-core/agent/desktop-host-context.cjs', '  const sourceAssistantMessage = interruptedUserOnly ? null : cloneValue(messages.at(-1));'],
  ['immediate_regenerate_projection', MR1557_SOURCE_PATH, 'export function stageImmediateRegenerateProjection<T extends RegenerateProjectionMessage>({'],
  ['completed_source_is_hidden', MR1557_SOURCE_PATH, '  const hideCompletedSource = Boolean(!continueExisting && sourceAssistant?.parts.length);'],
  ['replacement_is_empty_and_running', MR1557_SOURCE_PATH, "    role: 'assistant' as const, parts: [], running: true, expertIdentity, createdAt, turnStartedAt: createdAt,"],
  ['runtime_stages_before_send', 'src/runtime.tsx', '    const stagedRegenerate = stageImmediateRegenerateProjection({ baseline: messagesRef.current, userMessageId: userMessage.id, sourceAssistant: assistantMessage, continuationSourceTurnId, newAssistantMessageId: regenerateAssistantMessageId(config?.sourceId, uid), expertIdentity: normalizeExpertIdentity(currentExpertIdentity) }); messagesRef.current = stagedRegenerate.messages; setMessages(stagedRegenerate.messages);'],
  ['rejected_regenerate_projects_failure', 'src/runtime.tsx', '      reloadTurnSessionIdRef.current = null; applyRegenerateFailure(setMessages, messagesRef, stagedRegenerate.assistantMessageId, error);'],
  ['test_stage_precedes_async_send', 'test/unit/runtime/runtime-subscription-cleanup.test.mjs', "  assert.ok(stageIndex >= 0 && sendIndex > stageIndex, 'expected the replacement to render before async send preparation');"],
  ['test_rejected_regenerate_projects_failure', 'test/unit/runtime/runtime-subscription-cleanup.test.mjs', '    /catch \\(error\\) \\{[\\s\\S]*?applyRegenerateFailure\\([\\s\\S]*?stagedRegenerate\\.assistantMessageId,[\\s\\S]*?error,[\\s\\S]*?\\);/,'],
].map(([id, filePath, source]) => ({ id, path: filePath, addition: byteRecord(source) }));

const MR1557_FORBIDDEN_FRAGMENTS = [
  ['unconditional_latest_assistant_snapshot', 'electron/host-core/agent/desktop-host-context.cjs', 'line', '  const sourceAssistantMessage = cloneValue(messages.at(-1));'],
  ['old_rejected_regenerate_projection_target', 'src/runtime.tsx', 'line', '      reloadTurnSessionIdRef.current = null; applyRegenerateFailure(setMessages, messagesRef, assistantMessage?.id, error);'],
  ['interrupted_user_only_rejected', 'electron/host-core/agent/desktop-message-recovery.cjs', 'line', '    || sourceIndex >= messages.length - 1'],
].map(([id, filePath, match, source]) => ({ id, path: filePath, match, value: byteRecord(source) }));

const MR1557_CONTRACT_DEFINITION = {
  ...SOURCE_AND_TEST_DECLARATION,
  contract_id: QWORK_MR1557_IMMEDIATE_REGENERATE_PROJECTION_CONTRACT_ID,
  mr_iid: '1557',
  state: 'merged',
  target_branch: 'release/0.1',
  merge_commit_sha: 'f0cc2a164b6c5279fe12290c207e29cf9ef1b261',
  changes_count: 11,
  changed_paths: [
    'electron/host-core/agent/desktop-host-context.cjs',
    'electron/host-core/agent/desktop-message-recovery.cjs',
    'server/qbot-core/engine/engine.mjs',
    MR1557_SOURCE_PATH,
    'src/runtime-regenerate-source.ts',
    'src/runtime.tsx',
    'test/e2e/agent-runtime-regression.local.spec.mjs',
    'test/unit/core/optimistic-turn-transaction.test.mjs',
    'test/unit/desktop/desktop-regenerate-contract.test.mjs',
    'test/unit/runtime/runtime-subscription-cleanup.test.mjs',
    'test/unit/server/engine-stream-adapters.test.mjs',
  ],
  mr_diff: {
    bytes: 38739,
    sha256: '43e9e0b1ca93fb9f214a3d0c7bb72bdc902ef90437bed96248c34667e88ff790',
  },
  source_file: {
    proof_mode: 'exact-added-lines',
    path: MR1557_SOURCE_PATH,
    old_path: MR1557_SOURCE_PATH,
    new_file: false,
    renamed_file: false,
    deleted_file: false,
    change_bytes: 3083,
    change_sha256: '8bda7ef9aaa971c2bfb14d0ec731cd7197c439fe027e485d1410a5214b47c97a',
    source_bytes: 2180,
    source_sha256: '69cfde5f693406f75ef71f65d49b62411e9365252deddeb883970e50c412f5cc',
    source_line_count: 45,
  },
  header_emissions: [],
  integration_bindings: MR1557_INTEGRATION_BINDINGS,
  forbidden_fragments: MR1557_FORBIDDEN_FRAGMENTS,
  supersedes: [{
    contract_id: QWORK_MR1546_REJECTED_REGENERATE_CONTRACT_ID,
    current_assertions: [
      'integration_binding:latest_assistant_snapshot',
      'integration_binding:rejected_regenerate_projects_failure',
      'integration_binding:test_rejected_regenerate_projects_failure',
    ],
  }],
};

export const QWORK_MR1557_IMMEDIATE_REGENERATE_PROJECTION_CONTRACT = deepFreeze({
  ...MR1557_CONTRACT_DEFINITION,
  contract_sha256: sha256(stableJson(MR1557_CONTRACT_DEFINITION)),
});

const MR1540_MEMORY_CLIENT_PATH = 'electron/host-core/auth/personal-memory-client-methods.cjs';
const MR1540_MEMORY_CLIENT_TEST_PATH = 'test/unit/auth/personal-memory-client.test.mjs';
const MR1540_FEATURE_CHECK_OWNER_SCOPE = currentReleaseOwnerScope(
  "test('QWork Memory Feature Check is an authenticated bodyless GET and maps only the gate boolean', async () => {",
  [
    ['target_url', "  assert.equal(requests[0].url, 'https://memory.example.test/v1/me/qwork-memory/feature');"],
    ['request_method', "  assert.equal(requests[0].options.method, 'GET');"],
    ['request_body', '  assert.equal(requests[0].options.body, undefined);'],
  ],
);
const MR1540_PROFILE_REPORT_OWNER_SCOPE = currentReleaseOwnerScope(
  "test('QWork Memory Profile Report posts the exact hydrated profile independently and accepts 204', async () => {",
  [
    ['target_url', "  assert.equal(requests[0].url, 'https://memory.example.test/v1/me/qwork-memory/profile');"],
    ['request_method', "  assert.equal(requests[0].options.method, 'POST');"],
    ['request_body', '  assert.deepEqual(JSON.parse(requests[0].options.body), { tm_user_profile: rawProfile });'],
  ],
);
const MR1540_INTEGRATION_BINDINGS = [
  ['feature_check_bodyless_get_method', MR1540_MEMORY_CLIENT_PATH, "    'GET',"],
  ['feature_check_bodyless_get_route', MR1540_MEMORY_CLIENT_PATH, "    '/v1/me/qwork-memory/feature',"],
  ['feature_check_public_method', MR1540_MEMORY_CLIENT_PATH, '    checkQworkMemoryFeature: (input) => checkFeature(context, input),'],
  ['profile_report_independent_post_route', MR1540_MEMORY_CLIENT_PATH, "  await scopedRequest(context, 'POST', '/v1/me/qwork-memory/profile', signal, {"],
  ['profile_report_exact_body', MR1540_MEMORY_CLIENT_PATH, '    body: { tm_user_profile: tmUserProfile }, expectedStatus: 204,'],
  ['profile_report_public_method', MR1540_MEMORY_CLIENT_PATH, '    reportQworkMemoryProfile: (input) => reportProfile(context, input),'],
  ['test_feature_check_maps_gate', MR1540_MEMORY_CLIENT_TEST_PATH, '  assert.deepEqual(await client.checkQworkMemoryFeature(), { qworkMemoryEnabled: true });'],
  ['feature_check_body_absent_test', MR1540_MEMORY_CLIENT_TEST_PATH, '  assert.equal(requests[0].options.body, undefined);', MR1540_FEATURE_CHECK_OWNER_SCOPE],
  ['test_profile_report_exact_body', MR1540_MEMORY_CLIENT_TEST_PATH, '  assert.deepEqual(JSON.parse(requests[0].options.body), { tm_user_profile: rawProfile });', MR1540_PROFILE_REPORT_OWNER_SCOPE],
  ['test_profile_independent_of_feature_gate', 'test/unit/desktop/memory-augmentation-runtime.test.mjs', "test('organization hydration reports one current profile without coupling it to the feature gate', async () => {"],
  ['organization_hydration_precedes_report', 'electron/host-core/agent/desktop-memory-augmentation.cjs', '  await Promise.resolve(organizationFlight);'],
  ['hydrated_profile_is_reported', 'electron/host-core/agent/desktop-memory-augmentation.cjs', '  await memoryClient.reportQworkMemoryProfile({ tmUserProfile: profile });'],
  ['profile_report_is_best_effort', 'electron/host-core/agent/desktop-host-context.cjs', '      formatProfile: memoryCore.qworkMemoryBootstrapProfileFromOrganization }).catch(() => {});'],
].map(([id, filePath, source, currentReleaseScope]) => ({
  id,
  path: filePath,
  addition: byteRecord(source),
  ...(currentReleaseScope ? { current_release_scope: currentReleaseScope } : {}),
}));

const MR1540_FORBIDDEN_FRAGMENTS = [
  ['empty_profile_bootstrap', 'electron/host-core/auth/qwork-memory-feature.cjs', 'substring', "bootstrapQworkMemory({ tmUserProfile: '' })"],
  ['organization_bootstrap_coupling', 'electron/host-core/agent/desktop-memory-augmentation.cjs', 'substring', 'bootstrapOrganizationMemory'],
].map(([id, filePath, match, source]) => ({ id, path: filePath, match, value: byteRecord(source) }));

const MR1540_CONTRACT_DEFINITION = {
  ...SOURCE_AND_TEST_DECLARATION,
  contract_id: QWORK_MR1540_MEMORY_FEATURE_PROFILE_CONTRACT_ID,
  mr_iid: '1540',
  state: 'merged',
  target_branch: 'release/0.1',
  merge_commit_sha: 'be6a1d5d9b804d143597aa6f2554491a801115d7',
  changes_count: 22,
  changed_paths: [
    '.agent/context/_shared/references/memory-authority-boundary.md',
    'docs/decisions/2026-08-30-claude-cloud-memory-authority.md',
    'docs/qa/core-ux-test-cases.md',
    'docs/memory-augmentation-runtime.md',
    'electron/host-core/agent/desktop-host-context.cjs',
    'electron/host-core/agent/desktop-memory-augmentation.cjs',
    'electron/host-core/agent/execution-worker-event-flow.cjs',
    MR1540_MEMORY_CLIENT_PATH,
    'electron/host-core/auth/personal-memory-contract.cjs',
    'electron/host-core/auth/qwork-memory-feature.cjs',
    'electron/desktop-agent-host.cjs',
    'src/memory/MemorySettingsView.tsx',
    'src/memory/memory-settings-state.ts',
    'src/memory/memory-settings.css',
    'test/e2e/support/memory-augmentation-real-chain.test.mjs',
    'test/e2e/auth-ui-connection.local.spec.mjs',
    'test/unit/auth/lingxi-credential-manager.test.mjs',
    'test/unit/auth/personal-memory-client.test.mjs',
    'test/unit/auth/qwork-memory-feature.test.mjs',
    'test/unit/config/memory-settings-v2.test.mts',
    'test/unit/desktop/memory-augmentation-runtime.test.mjs',
    'test/unit/desktop/teams360-host-sync.test.mjs',
  ],
  mr_diff: {
    bytes: 71833,
    sha256: '25a43ebdd09ace45958b9607644e9f1692784faaa589b4c4f109607f34038778',
  },
  source_file: {
    proof_mode: 'exact-added-lines',
    path: MR1540_MEMORY_CLIENT_PATH,
    old_path: MR1540_MEMORY_CLIENT_PATH,
    new_file: false,
    renamed_file: false,
    deleted_file: false,
    change_bytes: 2048,
    change_sha256: '1efc26eb90909ef8a26b6c62128bef5fe05c1eb9034f33ee25b6690d18cb4c98',
    source_bytes: 788,
    source_sha256: '4991180f94dcc144f768e495086638f85bf53e43e01901c75ec3762aa52da745',
    source_line_count: 21,
  },
  header_emissions: [],
  integration_bindings: MR1540_INTEGRATION_BINDINGS,
  forbidden_fragments: MR1540_FORBIDDEN_FRAGMENTS,
};

export const QWORK_MR1540_MEMORY_FEATURE_PROFILE_CONTRACT = deepFreeze({
  ...MR1540_CONTRACT_DEFINITION,
  contract_sha256: sha256(stableJson(MR1540_CONTRACT_DEFINITION)),
});

const MR1550_SKILL_POLICY_PATH = 'server/qbot-core/skills/claude-skill-listing-policy.mjs';
const MR1550_INTEGRATION_BINDINGS = [
  ['selection_is_current_turn_only', MR1550_SKILL_POLICY_PATH, "  const selection = session?.llmSelection && typeof session.llmSelection === 'object' && !Array.isArray(session.llmSelection)"],
  ['model_id_comes_from_selection', MR1550_SKILL_POLICY_PATH, '  const modelId = compact(selection.modelId || selection.model).toLowerCase();'],
  ['claude_code_runtime_token_is_not_model', MR1550_SKILL_POLICY_PATH, "  if (modelId === 'claude-code' || /(^|[/_.-])claude-code([/_.-]|$)/.test(modelId)) return false;"],
  ['true_claude_models_use_native_listing', MR1550_SKILL_POLICY_PATH, '  return /(^|[/_.-])claude([/_.-]|$)/.test(modelId);'],
  ['model_specific_note_override', MR1550_SKILL_POLICY_PATH, "  return claudeModelUsesNativeSkillListing(session) ? '' : undefined;"],
  ['engine_uses_model_specific_override', 'server/qbot-core/engine/engine.mjs', '    skillInvocationNote: runtimeFamily === RUNTIME_FAMILY_CLAUDE ? claudeRuntimeSkillInvocationNoteOverride(s) : undefined,'],
  ['installed_rows_preserved_in_automatic_index', 'server/qbot-core/engine/engine.mjs', '        installRows: mergeAutomaticSkillIndexInstallRows(rawSelection.allowedRows, s.skillInstalls),'],
  ['matching_skill_precedes_mcp_tools', 'server/qbot-core/prompts/mcp-session-reminder.mjs', "  '若用户任务匹配已发现 Skill 的 description，必须先调用 Skill 工具并等待结果；不得用 search_tools / describe_tool / call_tool 替代已匹配的 Skill。',"],
  ['test_claude_model_uses_native_listing', 'test/unit/skills/skillhub-engine-preflight.test.mjs', "    claudeModelUsesNativeSkillListing({ llmSelection: { modelId: 'm4/claude-opus-4-6' } }),"],
  ['test_gpt_model_keeps_description_note', 'test/unit/skills/skillhub-engine-preflight.test.mjs', "    claudeRuntimeSkillInvocationNoteOverride({ llmSelection: { modelId: 'm4/gpt-5.6-sol' } }),"],
  ['test_claude_code_token_not_claude_model', 'test/unit/skills/skillhub-engine-preflight.test.mjs', "    claudeModelUsesNativeSkillListing({ llmSelection: { modelId: 'claude-code' } }),"],
  ['test_gpt_skill_invocation_layer_rendered', 'test/unit/skills/skillhub-engine-preflight.test.mjs', "  assert.equal(gptPrompt.manifest.layers.find((layer) => layer.id === 'skill.invocation')?.rendered, true);"],
  ['test_claude_skill_invocation_layer_not_rendered', 'test/unit/skills/skillhub-engine-preflight.test.mjs', "  assert.notEqual(claudePrompt.manifest.layers.find((layer) => layer.id === 'skill.invocation')?.rendered, true);"],
  ['test_matching_skill_precedes_mcp_tools', 'test/unit/prompts/mcp-session-reminder.test.mjs', '  assert.match(text, /不得用 search_tools \\/ describe_tool \\/ call_tool 替代已匹配的 Skill/);'],
].map(([id, filePath, source]) => ({ id, path: filePath, addition: byteRecord(source) }));

const MR1550_CONTRACT_DEFINITION = {
  ...SOURCE_AND_TEST_DECLARATION,
  contract_id: QWORK_MR1550_CLAUDE_SKILL_DESCRIPTION_ROUTING_CONTRACT_ID,
  mr_iid: '1550',
  state: 'merged',
  target_branch: 'release/0.1',
  merge_commit_sha: '1fc032633b5f70db34c17e1a9014efd981920cdb',
  changes_count: 15,
  changed_paths: [
    'docs/skill-mcp-activation-policy.md',
    'server/qbot-core/engine/engine.mjs',
    'server/qbot-core/prompts/mcp-session-reminder.mjs',
    'server/qbot-core/prompts/prompt-layers.mjs',
    'server/qbot-core/prompts/turn-prompt-reminders.mjs',
    'server/qbot-core/skills/automatic-skill-index-install-rows.mjs',
    MR1550_SKILL_POLICY_PATH,
    'server/qbot-core/skills/skill-preflight-diagnostics.mjs',
    'server/qbot-core/skills/skillhub-projection-metadata-dir.mjs',
    'server/qbot-core/skills/skillhub-runtime-adapters.mjs',
    'test/unit/prompts/mcp-session-reminder.test.mjs',
    'test/unit/prompts/prompt-claude-system-prompt.test.mjs',
    'test/unit/skills/skill-runtime-diagnostics.test.mjs',
    'test/unit/skills/skillhub-engine-preflight.test.mjs',
    'test/unit/skills/skillhub-runtime-adapters.test.mjs',
  ],
  mr_diff: {
    bytes: 33381,
    sha256: '7fd92710dfe49dc6e185a04b58cc4f590ff8e9f559ee3a7c47c857bb4a98372e',
  },
  source_file: {
    proof_mode: 'exact-new-file',
    path: MR1550_SKILL_POLICY_PATH,
    old_path: MR1550_SKILL_POLICY_PATH,
    new_file: true,
    renamed_file: false,
    deleted_file: false,
    change_bytes: 1842,
    change_sha256: 'e9d41e72c3a37eb0806500f91b473d253693264b5384bdbf66829a4ea61ecf1c',
    source_bytes: 1553,
    source_sha256: '1fb1f65c3677c6ce646d9dd6bd422e4e0b826e546b0518121a6f6aaa8d290067',
    source_line_count: 32,
  },
  header_emissions: [],
  integration_bindings: MR1550_INTEGRATION_BINDINGS,
  forbidden_fragments: [{
    id: 'runtime_family_blanks_skill_note_unconditionally',
    path: 'server/qbot-core/engine/engine.mjs',
    match: 'line',
    value: byteRecord("    skillInvocationNote: runtimeFamily === RUNTIME_FAMILY_CLAUDE ? '' : undefined,"),
  }],
};

export const QWORK_MR1550_CLAUDE_SKILL_DESCRIPTION_ROUTING_CONTRACT = deepFreeze({
  ...MR1550_CONTRACT_DEFINITION,
  contract_sha256: sha256(stableJson(MR1550_CONTRACT_DEFINITION)),
});

const MR1558_MODEL_GROUPS_PATH = 'src/composer-model-display-groups.ts';
const MR1558_SETTINGS_PATH = 'src/AssistantConfig.tsx';
const MR1558_TEST_PATH = 'test/unit/config/settings-ui-surface-contract.test.mjs';
const MR1558_INTEGRATION_BINDINGS = [
  [
    'dedupe_helper_declaration',
    MR1558_MODEL_GROUPS_PATH,
    'export function dedupeModelDisplayOptions<T extends { modelLabel?: string | null; modelId?: string | null }>(',
  ],
  ['dedupe_preserves_input_order', MR1558_MODEL_GROUPS_PATH, '  return options.filter((option) => {'],
  [
    'dedupe_normalizes_display_name',
    MR1558_MODEL_GROUPS_PATH,
    "    const name = String(option.modelLabel || option.modelId || '').trim().toLocaleLowerCase();",
  ],
  ['dedupe_rejects_empty_or_seen_name', MR1558_MODEL_GROUPS_PATH, '    if (!name || seen.has(name)) return false;'],
  ['dedupe_records_first_name', MR1558_MODEL_GROUPS_PATH, '    seen.add(name);'],
  [
    'settings_imports_dedupe_helper',
    MR1558_SETTINGS_PATH,
    "import { buildModelDisplayGroups, dedupeModelDisplayOptions } from './composer-model-display-groups';",
  ],
  [
    'settings_dedupes_before_grouping',
    MR1558_SETTINGS_PATH,
    '  const availableModelGroups = buildModelDisplayGroups(dedupeModelDisplayOptions(visibleModelOptions));',
  ],
  [
    'test_reads_model_group_source',
    MR1558_TEST_PATH,
    "const modelDisplayGroups = readFileSync(resolve(repoRoot, 'src', 'composer-model-display-groups.ts'), 'utf8');",
  ],
  [
    'test_declares_settings_name_dedup_contract',
    MR1558_TEST_PATH,
    "test('settings available models deduplicate protocol variants by displayed model name', () => {",
  ],
  [
    'test_asserts_normalized_display_name',
    MR1558_TEST_PATH,
    "    /const name = String\\(option\\.modelLabel \\|\\| option\\.modelId \\|\\| ''\\)\\.trim\\(\\)\\.toLocaleLowerCase\\(\\)/,",
  ],
  [
    'test_asserts_empty_and_duplicate_rejection',
    MR1558_TEST_PATH,
    '  assert.match(modelDisplayGroups, /if \\(!name \\|\\| seen\\.has\\(name\\)\\) return false/);',
  ],
  [
    'test_asserts_settings_dedupe_integration',
    MR1558_TEST_PATH,
    '    /buildModelDisplayGroups\\(dedupeModelDisplayOptions\\(visibleModelOptions\\)\\)/,',
  ],
].map(([id, filePath, source]) => ({ id, path: filePath, addition: byteRecord(source) }));

const MR1558_CONTRACT_DEFINITION = {
  ...SOURCE_AND_TEST_DECLARATION,
  contract_id: QWORK_MR1558_SETTINGS_MODEL_NAME_DEDUP_CONTRACT_ID,
  mr_iid: '1558',
  state: 'merged',
  target_branch: 'release/0.1',
  merge_commit_sha: '90063782129701951edd90a9df8cf6145f1de425',
  changes_count: 3,
  changed_paths: [MR1558_SETTINGS_PATH, MR1558_MODEL_GROUPS_PATH, MR1558_TEST_PATH],
  mr_diff: {
    bytes: 4152,
    sha256: '3adb4b2161ae946eb3e4d37b487e7deb7c359e1f52c777d9ce751d1e5c768ee9',
  },
  source_file: {
    proof_mode: 'exact-added-lines',
    path: MR1558_MODEL_GROUPS_PATH,
    old_path: MR1558_MODEL_GROUPS_PATH,
    new_file: false,
    renamed_file: false,
    deleted_file: false,
    change_bytes: 973,
    change_sha256: '32967fa02c0e1eb69ca9b6101615a092c8153e4e73b1b23e682dbbe4846d7bdf',
    source_bytes: 492,
    source_sha256: '24046d6d5979d9d57c8174696fb044b3a89e752a1a884f3b1490bf4db9edb82d',
    source_line_count: 13,
  },
  header_emissions: [],
  integration_bindings: MR1558_INTEGRATION_BINDINGS,
};

export const QWORK_MR1558_SETTINGS_MODEL_NAME_DEDUP_CONTRACT = deepFreeze({
  ...MR1558_CONTRACT_DEFINITION,
  contract_sha256: sha256(stableJson(MR1558_CONTRACT_DEFINITION)),
});

const MR1595_CHANGED_PATHS = [
  ".agent/docs.yaml",
  ".agent/turn-context-residual-manifest.json",
  "docs/qa/core-ux-test-cases.md",
  "docs/ci-cd-operating-contract.md",
  "scripts/ci/e2e/e2e-bug-derived-materials.test.mjs",
  "scripts/ci/e2e/e2e-command-contract.test.mjs",
  "scripts/ci/e2e/e2e-local-prerequisite-defer.test.mjs",
  "scripts/ci/e2e/e2e-module-tags.test.mjs",
  "scripts/ci/e2e/e2e-module.test.mjs",
  "scripts/ci/e2e/e2e-modules-summary.mjs",
  "scripts/ci/e2e/e2e-modules-summary.test.mjs",
  "scripts/ci/e2e/e2e-prerequisites.test.mjs",
  "scripts/ci/e2e/e2e-qbot-claude-document-processing.test.mjs",
  "scripts/ci/e2e/e2e-release-mac.test.mjs",
  "scripts/ci/e2e/e2e-release-target.test.mjs",
  "scripts/ci/e2e/e2e-routing-contract.test.mjs",
  "scripts/ci/e2e/e2e-source-release-proxy.test.mjs",
  "scripts/ci/e2e/e2e-suite-closeout-matrix.test.mjs",
  "scripts/ci/e2e/generate-e2e-child-pipeline.test.mjs",
  "scripts/ci/policy/gitlab-ci.test.mjs",
  "scripts/ci/policy/gitlab-settings-audit.test.mjs",
  "scripts/ci/policy/lightweight-ci-context.test.mjs",
  "scripts/ci/policy/lightweight-ci-verify.test.mjs",
  "scripts/ci/policy/pipeline-policy-catalog.test.mjs",
  "scripts/ci/policy/pipeline-policy.test.mjs",
  "scripts/ci/policy/source-classification-projection.test.mjs",
  "scripts/ci/unit/node-eval-tests.test.mjs",
  "scripts/ci/unit/node-normal-plan.test.mjs",
  "scripts/ci/unit/node-unit-affected.mjs",
  "scripts/ci/unit/node-unit-affected.test.mjs",
  "scripts/ci/unit/node-unit-evidence.test.mjs",
  "scripts/ci/unit/node-unit-job-timing.test.mjs",
  "scripts/ci/unit/node-unit-profile-history.test.mjs",
  "scripts/ci/unit/node-unit-profile-reporter.test.mjs",
  "scripts/ci/unit/node-unit-profile.test.mjs",
  "scripts/ci/unit/node-unit-test-weights.json",
  "scripts/ci/unit/node-unit-tests.mjs",
  "scripts/ci/unit/node-unit-tests.test.mjs",
  "scripts/ci/unit/unit-material-pin-mr.test.mjs",
  "scripts/ci/unit/unit-material-registry.test.mjs",
  "scripts/governance/architecture/checks/layout.test.mjs",
  "scripts/governance/architecture/ratchet/function-identity.mjs",
  "scripts/governance/architecture/ratchet/function-identity.test.mjs",
  "scripts/governance/structure-check.mjs",
  "scripts/governance/structure-check.test.mjs",
  "scripts/migrations/1414-server-structure/test/server-structure-refactor.spec.mjs",
  "scripts/migrations/1499-electron-structure/test/electron-structure-refactor.spec.mjs",
  "scripts/migrations/1502/freeze-relocations.json",
  "scripts/quality/web/web-crawl-v3-2-evaluate.mjs",
  "scripts/quality/web/web-crawl-v3-evaluate.mjs",
  "server/qbot-core/docs/qbot-vision-tools.md",
  "test/ci/mr-gates/envelope.test.mjs",
  "test/ci/mr-gates/evidence-auditor.test.mjs",
  "test/ci/mr-gates/golden-1358.test.mjs",
  "test/ci/mr-gates/open-mr-resolver.test.mjs",
  "test/ci/mr-gates/pre-push-check.test.mjs",
  "test/ci/mr-gates/receipt.test.mjs",
  "test/ci/check-node-syntax.test.mjs",
  "test/ci/delivery-preflight-consistency.test.mjs",
  "test/ci/mr-delivery-preflight.test.mjs",
  "test/ci/normal-plan.test.mjs",
  "test/e2e/support/bug-derived-suite-materials.mjs",
  "test/e2e/support/module-suites.mjs",
  "test/e2e/support/module-suites.test.mjs",
  "test/e2e/support/modules.mjs",
  "test/e2e/bug-derived-materials.local.spec.mjs",
  "test/e2e/bug-derived-materials.remote-dev.spec.mjs",
  "test/e2e/local-real-issue-882.spec.mjs",
  "test/e2e/remote-dev-local-only-assertions.spec.mjs",
  "test/e2e/remote-dev.spec.mjs",
  "test/unit/config/settings-ui-surface-contract.test.mjs",
  "test/unit/connectors/connector-card-ui-entry.test.mjs",
  "test/unit/connectors/connector-health-ui.test.mts",
  "test/unit/core/font-family-contract.test.mjs",
  "test/unit/core/issue-882-performance-assemble.test.mjs",
  "test/unit/core/issue-882-performance-capture.test.mjs",
  "test/unit/core/issue-882-performance-report.test.mjs",
  "test/unit/core/quick-feedback-ui-copy.test.mjs",
  "test/unit/core/searxng-issue-1371-experiment.test.mjs",
  "test/unit/core/searxng-search-research-ledger.test.mjs",
  "test/unit/core/searxng-v9-research-ledger.test.mjs",
  "test/unit/core/skills-connectors-native-tip-guard.test.mjs",
  "test/unit/core/theme-provider-light-lock.test.mjs",
  "test/unit/core/uiux-draft-and-connector-state.test.mjs",
  "test/unit/desktop/desktop-experience-regressions.test.mjs",
  "test/unit/desktop/desktop-expert-runtime.test.mjs",
  "test/unit/desktop/electron-host-architecture.test.mjs",
  "test/unit/gitlab/gitlab-template-catalog.test.mjs",
  "test/unit/projects/attachment-remove-layering.test.mjs",
  "test/unit/projects/capabilities-nonblocking-route.test.mjs",
  "test/unit/prompts/thinking-render-stability.test.mjs",
  "test/unit/skills/expert-card-name-layout.test.mjs",
  "test/unit/skills/expert-card-overflow-portal.test.mjs",
  "test/unit/skills/expert-draft-history.test.mjs",
  "test/unit/skills/expert-v2-legacy-bridge-removal.test.mjs",
  "test/unit/skills/expert-v2-postgres-integration.test.mjs",
  "test/unit/skills/skill-desc-preview-portal.test.mjs",
  "test/unit/skills/skill-detail-metadata-rendering.test.mjs",
  "test/unit/skills/skill-history-refresh-guard.test.mjs",
  "test/unit/skills/skill-revert-ui-entry.test.mjs",
  "test/unit/tools/electron-structure-refactor.test.mjs",
  "test/unit/tools/server-structure-refactor.test.mjs",
  "test/unit/ui/artifact-maximize-view-switch.test.mjs",
  "test/unit/ui/composer-plus-submenu-scroll.test.mjs",
  "test/unit/ui/preload-auth-reset-selector.test.mjs",
  "test/unit/ui/sidebar-task-count-spaces-ready.test.mjs",
  "test/unit/ui/sidebar-version-identity.test.mjs",
  "test/unit/web/web-crawl-v3-10-audit.test.mjs",
  "test/unit/web/web-crawl-v3-10-evaluator.test.mjs",
  "test/unit/web/web-crawl-v3-11-audit.test.mjs",
  "test/unit/web/web-crawl-v3-11-evaluator.test.mjs",
  "test/unit/web/web-crawl-v3-12-audit.test.mjs",
  "test/unit/web/web-crawl-v3-12-evaluator.test.mjs",
  "test/unit/web/web-crawl-v3-13-audit.test.mjs",
  "test/unit/web/web-crawl-v3-13-evaluator.test.mjs",
  "test/unit/web/web-crawl-v3-13-public.test.mjs",
  "test/unit/web/web-crawl-v3-14-audit.test.mjs",
  "test/unit/web/web-crawl-v3-14-evaluator.test.mjs",
  "test/unit/web/web-crawl-v3-14-public.test.mjs",
  "test/unit/web/web-crawl-v3-15-audit.test.mjs",
  "test/unit/web/web-crawl-v3-15-evaluator.test.mjs",
  "test/unit/web/web-crawl-v3-15-public.test.mjs",
  "test/unit/web/web-crawl-v3-16-audit.test.mjs",
  "test/unit/web/web-crawl-v3-16-evaluator.test.mjs",
  "test/unit/web/web-crawl-v3-16-public.test.mjs",
  "test/unit/web/web-crawl-v3-17-audit.test.mjs",
  "test/unit/web/web-crawl-v3-17-evaluator.test.mjs",
  "test/unit/web/web-crawl-v3-17-public.test.mjs",
  "test/unit/web/web-crawl-v3-18-audit.test.mjs",
  "test/unit/web/web-crawl-v3-18-evaluator.test.mjs",
  "test/unit/web/web-crawl-v3-18-public.test.mjs",
  "test/unit/web/web-crawl-v3-19-audit.test.mjs",
  "test/unit/web/web-crawl-v3-19-evaluator.test.mjs",
  "test/unit/web/web-crawl-v3-19-public.test.mjs",
  "test/unit/web/web-crawl-v3-2-audit.test.mjs",
  "test/unit/web/web-crawl-v3-2-evaluator.test.mjs",
  "test/unit/web/web-crawl-v3-2-promotion.test.mjs",
  "test/unit/web/web-crawl-v3-20-audit.test.mjs",
  "test/unit/web/web-crawl-v3-20-evaluator.test.mjs",
  "test/unit/web/web-crawl-v3-20-public.test.mjs",
  "test/unit/web/web-crawl-v3-21-audit.test.mjs",
  "test/unit/web/web-crawl-v3-21-evaluator.test.mjs",
  "test/unit/web/web-crawl-v3-21-public.test.mjs",
  "test/unit/web/web-crawl-v3-22-audit.test.mjs",
  "test/unit/web/web-crawl-v3-22-evaluator.test.mjs",
  "test/unit/web/web-crawl-v3-22-public.test.mjs",
  "test/unit/web/web-crawl-v3-23-audit.test.mjs",
  "test/unit/web/web-crawl-v3-23-evaluator.test.mjs",
  "test/unit/web/web-crawl-v3-23-public.test.mjs",
  "test/unit/web/web-crawl-v3-24-audit.test.mjs",
  "test/unit/web/web-crawl-v3-24-evaluator.test.mjs",
  "test/unit/web/web-crawl-v3-24-public.test.mjs",
  "test/unit/web/web-crawl-v3-25-audit.test.mjs",
  "test/unit/web/web-crawl-v3-25-evaluator.test.mjs",
  "test/unit/web/web-crawl-v3-25-public.test.mjs",
  "test/unit/web/web-crawl-v3-26-audit.test.mjs",
  "test/unit/web/web-crawl-v3-26-evaluator.test.mjs",
  "test/unit/web/web-crawl-v3-26-public.test.mjs",
  "test/unit/web/web-crawl-v3-27-audit.test.mjs",
  "test/unit/web/web-crawl-v3-27-evaluator.test.mjs",
  "test/unit/web/web-crawl-v3-27-public.test.mjs",
  "test/unit/web/web-crawl-v3-28-audit.test.mjs",
  "test/unit/web/web-crawl-v3-28-evaluator.test.mjs",
  "test/unit/web/web-crawl-v3-28-public.test.mjs",
  "test/unit/web/web-crawl-v3-3-audit.test.mjs",
  "test/unit/web/web-crawl-v3-3-evaluator.test.mjs",
  "test/unit/web/web-crawl-v3-4-audit.test.mjs",
  "test/unit/web/web-crawl-v3-4-evaluator.test.mjs",
  "test/unit/web/web-crawl-v3-5-audit.test.mjs",
  "test/unit/web/web-crawl-v3-5-evaluator.test.mjs",
  "test/unit/web/web-crawl-v3-6-audit.test.mjs",
  "test/unit/web/web-crawl-v3-6-evaluator.test.mjs",
  "test/unit/web/web-crawl-v3-7-audit.test.mjs",
  "test/unit/web/web-crawl-v3-7-evaluator.test.mjs",
  "test/unit/web/web-crawl-v3-8-audit.test.mjs",
  "test/unit/web/web-crawl-v3-8-evaluator.test.mjs",
  "test/unit/web/web-crawl-v3-9-audit.test.mjs",
  "test/unit/web/web-crawl-v3-9-evaluator.test.mjs",
  "test/unit/web/web-crawl-v3-audit.test.mjs",
  "test/unit/web/web-crawl-v3-evaluator.test.mjs",
  "test/ci-policy-files.txt",
  ".gitlab-ci.yml",
  "package.json",
  "playwright.config.mjs",
];
const MR1595_RETIRED_ASSERTION_IDS = [
  'test_reads_model_group_source',
  'test_declares_settings_name_dedup_contract',
  'test_asserts_normalized_display_name',
  'test_asserts_empty_and_duplicate_rejection',
  'test_asserts_settings_dedupe_integration',
];

const MR1595_CONTRACT_DEFINITION = {
  ...SOURCE_AND_TEST_DECLARATION,
  contract_kind: 'assertion-retirement',
  contract_id: QWORK_MR1595_OBSOLETE_TEST_RETIREMENT_CONTRACT_ID,
  mr_iid: '1595',
  state: 'merged',
  target_branch: 'release/0.1',
  merge_commit_sha: '3b61267f74bb61b3053c970dd5c7b98d27683e6a',
  changes_count: 184,
  changed_paths: MR1595_CHANGED_PATHS,
  mr_diff: {
    bytes: 260186,
    sha256: '867e9491a91485f3fba33bd9b3d53b04644f697a9d4a083a0239f87c33ec0852',
  },
  source_file: null,
  retired_files: [{
    path: MR1558_TEST_PATH,
    old_path: MR1558_TEST_PATH,
    new_path: MR1558_TEST_PATH,
    new_file: false,
    renamed_file: false,
    deleted_file: true,
  }],
  header_emissions: [],
  integration_bindings: [],
  forbidden_fragments: [],
  supersedes: [{
    contract_id: QWORK_MR1558_SETTINGS_MODEL_NAME_DEDUP_CONTRACT_ID,
    disposition: 'retired',
    current_assertions: MR1595_RETIRED_ASSERTION_IDS.map((id) => `integration_binding:${id}`),
  }],
};

export const QWORK_MR1595_OBSOLETE_TEST_RETIREMENT_CONTRACT = deepFreeze({
  ...MR1595_CONTRACT_DEFINITION,
  contract_sha256: sha256(stableJson(MR1595_CONTRACT_DEFINITION)),
});

const MR1590_SERVICE_PATH = 'server/control-plane/experts/qbot-expert-installation-service.mjs';
const MR1590_CHANGED_PATHS = [
  '.agent/context/_shared/references/expert-v2-model.md',
  'scripts/ci/unit/node-normal-plan.mjs',
  'scripts/ci/unit/node-normal-plan.test.mjs',
  'scripts/ci/unit/node-unit-test-weights.json',
  'server/control-plane/experts/index.mjs',
  'server/control-plane/experts/qbot-expert-installation-client.mjs',
  'server/control-plane/experts/qbot-expert-installation-contract.mjs',
  'server/control-plane/experts/qbot-expert-installation-routes.mjs',
  MR1590_SERVICE_PATH,
  'server/control-plane/.architecture.yaml',
  'server/control-plane/index.mjs',
  'server/shared/experts/index.mjs',
  'test/e2e/support/module-suites-qbot-cloud-install.mjs',
  'test/e2e/support/module-suites-qbot-cloud-install.test.mjs',
  'test/e2e/support/module-suites.mjs',
  'test/unit/server/qbot-expert-installation-client.test.mjs',
  'test/unit/server/qbot-expert-installation-routes.test.mjs',
  '.env.example',
];
const MR1590_INTEGRATION_BINDINGS = [
  ['service_reads_owner_release', MR1590_SERVICE_PATH, '        getRelease(owner, expert, release),'],
  ['service_reads_release_version', MR1590_SERVICE_PATH, '      const version = versionId ? await getVersion(owner, expert, versionId) : null;'],
  ['service_reads_direct_dependencies', MR1590_SERVICE_PATH, '      const directDependencies = await listDependencies(versionId);'],
  ['service_exports_canonical_definition', MR1590_SERVICE_PATH, '      const exported = buildExpertDefinitionFromManifest(version.manifest, {'],
  ['service_sends_exact_exported_bytes', MR1590_SERVICE_PATH, '        definition: exported.file.bytes,'],
  ['client_refuses_redirects', 'server/control-plane/experts/qbot-expert-installation-client.mjs', "    redirect: 'manual',"],
  ['client_forwards_current_bearer', 'server/control-plane/experts/qbot-expert-installation-client.mjs', '      Authorization: `Bearer ${qbotCurrentBearer(bearer)}`,'],
  ['client_bounds_response_bytes', 'server/control-plane/experts/qbot-expert-installation-client.mjs', 'const MAX_RESPONSE_BYTES = 128 * 1024;'],
  ['client_install_path', 'server/control-plane/experts/qbot-expert-installation-client.mjs', '    path: `/v1/qwork/expert-installations/${encodeURIComponent(sourceExpertId)}/releases/${encodeURIComponent(sourceReleaseId)}`,'],
  ['client_status_path', 'server/control-plane/experts/qbot-expert-installation-client.mjs', '    path: `/v1/qwork/expert-installations/${encodeURIComponent(sourceExpertId)}`,'],
  ['routes_install_endpoint', 'server/control-plane/experts/qbot-expert-installation-routes.mjs', "    '/api/experts/:expertId/releases/:releaseId/qbot-installation',"],
  ['routes_status_endpoint', 'server/control-plane/experts/qbot-expert-installation-routes.mjs', "    '/api/experts/:expertId/qbot-installation',"],
  ['test_exact_release_bytes', 'test/unit/server/qbot-expert-installation-routes.test.mjs', "test('installation service selects the owner Release and sends byte-equivalent canonical export on every retry', async () => {"],
  ['test_foreign_owner_concealment', 'test/unit/server/qbot-expert-installation-routes.test.mjs', "test('installation service conceals foreign Expert ownership and performs no Qbot or persistence write', async () => {"],
  ['test_request_credential_redaction', 'test/unit/server/qbot-expert-installation-routes.test.mjs', "test('Expert routes forward a non-enumerable request credential and preserve Qbot 201, 200, and typed 422 status', async () => {"],
  ['test_fake_qbot_promotion_guard', 'test/e2e/support/module-suites-qbot-cloud-install.test.mjs', '  assert.match(suite.residualEvidence.promotionGuard, /does not claim a real Qbot/u);'],
].map(([id, filePath, source]) => ({ id, path: filePath, addition: byteRecord(source) }));
const MR1590_CONTRACT_DEFINITION = {
  ...SOURCE_AND_TEST_DECLARATION,
  contract_id: QWORK_MR1590_QBOT_EXPERT_CLOUD_INSTALLATION_CONTRACT_ID,
  mr_iid: '1590', state: 'merged', target_branch: 'release/0.1',
  merge_commit_sha: 'a2870474ffda705c1535a22be76fcd70be62167c',
  changes_count: 18, changed_paths: MR1590_CHANGED_PATHS,
  mr_diff: { bytes: 70444, sha256: 'ba126a6dc8085a4ed41c05aebbf0852a16b33ca7b508aa37321dcc65d45c5ad5' },
  source_file: {
    proof_mode: 'exact-new-file', path: MR1590_SERVICE_PATH, old_path: MR1590_SERVICE_PATH,
    new_file: true, renamed_file: false, deleted_file: false,
    change_bytes: 3078, change_sha256: '84804aa813a426d600ace52576fb3cc75a150ba43556de9b26734cad1af5b8d1',
    source_bytes: 2703, source_sha256: 'ac3e79d1414bd8a1f4c8615b5cbcf51cca47ff3f8db95c1b1b505bfe17dbdd73', source_line_count: 65,
  },
  header_emissions: [], integration_bindings: MR1590_INTEGRATION_BINDINGS, forbidden_fragments: [],
};
export const QWORK_MR1590_QBOT_EXPERT_CLOUD_INSTALLATION_CONTRACT = deepFreeze({
  ...MR1590_CONTRACT_DEFINITION,
  contract_sha256: sha256(stableJson(MR1590_CONTRACT_DEFINITION)),
});

const MR1593_CONTRACT_PATH = 'server/control-plane/experts/qbot-expert-installation-contract.mjs';
const MR1593_CHANGED_PATHS = [
  'scripts/ci/unit/node-unit-test-weights.json',
  MR1593_CONTRACT_PATH,
  'test/unit/server/qbot-expert-installation-client.test.mjs',
];
const MR1593_INTEGRATION_BINDINGS = [
  ['warning_accepts_additive_fields', MR1593_CONTRACT_PATH, '  if (!warning) return null;'],
  ['channel_accepts_additive_fields', MR1593_CONTRACT_PATH, '  if (!channel) return null;'],
  ['test_additive_projection', 'test/unit/server/qbot-expert-installation-client.test.mjs', "test('status GET ignores additive response fields and projects only known safe fields', async () => {"],
  ['test_additive_operation_id', 'test/unit/server/qbot-expert-installation-client.test.mjs', "        operationId: 'operation-added-by-qbot',"],
  ['test_additive_fields_redacted', 'test/unit/server/qbot-expert-installation-client.test.mjs', '  assert.doesNotMatch(serialized, /operation-added-by-qbot|optional upstream explanation|generation/u);'],
].map(([id, filePath, source]) => ({ id, path: filePath, addition: byteRecord(source) }));
const MR1593_FORBIDDEN_FRAGMENTS = [
  ['strict_installation_key_list', 'const INSTALLATION_KEYS = Object.freeze(['],
  ['strict_problem_key_list', "const PROBLEM_KEYS = Object.freeze(['type', 'title', 'status', 'code', 'retryable', 'path']);"],
  ['strict_exact_keys_helper', 'function exactKeys(value, keys) {'],
  ['strict_warning_keys', "  if (!warning || !exactKeys(warning, ['code', 'path'])) return null;"],
  ['strict_installation_keys', '  if (!input || !exactKeys(input, INSTALLATION_KEYS)) return null;'],
  ['strict_channel_keys', "  if (!channel || !exactKeys(channel, ['readiness', 'route'])) return null;"],
  ['strict_problem_keys', '  if (!input || !exactKeys(input, PROBLEM_KEYS)) return null;'],
  ['tenant_id_required', '    isQbotOpaqueIdentifier(input.tenantId) &&'],
  ['problem_type_required', "    typeof input.type === 'string' &&"],
  ['problem_url_required', '    new URL(input.type);'],
].map(([id, source]) => ({ id, path: MR1593_CONTRACT_PATH, match: 'line', value: byteRecord(source) }));
const MR1593_CONTRACT_DEFINITION = {
  ...SOURCE_AND_TEST_DECLARATION,
  contract_id: QWORK_MR1593_QBOT_ADDITIVE_RESPONSE_COMPATIBILITY_CONTRACT_ID,
  mr_iid: '1593', state: 'merged', target_branch: 'release/0.1',
  merge_commit_sha: '44725752f4690cf56bb3747238335ba5878aaeb6',
  changes_count: 3, changed_paths: MR1593_CHANGED_PATHS,
  mr_diff: { bytes: 7918, sha256: 'fbff6a098426d5dbbc03f61c0752ee0d348a235e247c316996d229aa60bc7138' },
  source_file: {
    proof_mode: 'exact-added-lines', path: MR1593_CONTRACT_PATH, old_path: MR1593_CONTRACT_PATH,
    new_file: false, renamed_file: false, deleted_file: false,
    change_bytes: 4223, change_sha256: '6fb5fde3c40307fc0206b85bd598a5539a64d8673df65a27d03c4b039113926d',
    source_bytes: 112, source_sha256: '68bde4da96f116a9ebf82ce5340cf5cf3f89d529dd23e5ab5c722ab27e9333db', source_line_count: 4,
  },
  header_emissions: [], integration_bindings: MR1593_INTEGRATION_BINDINGS, forbidden_fragments: MR1593_FORBIDDEN_FRAGMENTS,
};
export const QWORK_MR1593_QBOT_ADDITIVE_RESPONSE_COMPATIBILITY_CONTRACT = deepFreeze({
  ...MR1593_CONTRACT_DEFINITION,
  contract_sha256: sha256(stableJson(MR1593_CONTRACT_DEFINITION)),
});

const MR1596_POLICY_PATH = 'server/control-plane/releases/runtime-release-policy.mjs';
const MR1596_CHANGED_PATHS = [
  'electron/host-core/auth/credential-lifecycle.cjs', 'electron/teams360-host-contract.md',
  'server/control-plane/auth/direct-lingxi-bearer-routes.mjs', 'server/control-plane/docs/lingxi-resource-server-bearer-contract.md',
  MR1596_POLICY_PATH, 'server/control-plane/index.mjs', 'test/e2e/support/module-suites.mjs',
  'test/e2e/support/module-suites.test.mjs', 'test/unit/auth/lingxi-credential-manager.test.mjs',
  'test/unit/core/direct-lingxi-bearer-auth.test.mjs', 'test/unit/runtime/runtime-release-policy.test.mjs',
];
const MR1596_INTEGRATION_BINDINGS = [
  ['anonymous_assignment_declaration', MR1596_POLICY_PATH, 'function resolveAnonymousRuntimeReleaseAssignment({ catalog, policy = {} } = {}) {'],
  ['anonymous_selects_stable', MR1596_POLICY_PATH, "    channel: 'stable',"],
  ['anonymous_reason', MR1596_POLICY_PATH, "    reason: rollback ? 'rollback' : 'anonymous-default',"],
  ['anonymous_assignment_dispatch', MR1596_POLICY_PATH, '  if (anonymous) return resolveAnonymousRuntimeReleaseAssignment({ catalog, policy });'],
  ['desktop_anonymous_runtime_read', 'electron/host-core/auth/credential-lifecycle.cjs', "  return target.pathname === '/api/runtime-release' && [...target.searchParams.keys()].every((key) => ['deviceId', 'teamsVersion', 'bootstrapAbi', 'currentVersion'].includes(key));"],
  ['optional_auth_route', 'server/control-plane/auth/direct-lingxi-bearer-routes.mjs', "  '/api/runtime-release',"],
  ['optional_auth_mount', 'server/control-plane/index.mjs', 'mountDirectLingxiBearerManagementAuth(app, { requireAuth: auth.requireDirectLingxiBearerAuth, requireOptionalAuth: auth.requireOptionalDirectLingxiBearerAuth });'],
  ['anonymous_identity_projection', 'server/control-plane/index.mjs', "        anonymous: req.auth?.kind !== 'direct-lingxi-bearer',"],
  ['test_anonymous_stable', 'test/unit/runtime/runtime-release-policy.test.mjs', "test('anonymous release discovery selects stable current without identity or percentage targeting', () => {"],
  ['test_optional_auth_states', 'test/unit/core/direct-lingxi-bearer-auth.test.mjs', "test('runtime release accepts anonymous or verified identity and rejects an invalid supplied bearer', async () => {"],
].map(([id, filePath, source]) => ({ id, path: filePath, addition: byteRecord(source) }));
const MR1596_FORBIDDEN_FRAGMENTS = [
  ['old_anonymous_bootstrap_helper', 'electron/host-core/auth/credential-lifecycle.cjs', 'function isAnonymousBootstrapRead(method, path) {'],
  ['old_anonymous_bootstrap_binding', 'electron/host-core/auth/credential-lifecycle.cjs', '    const anonymousBootstrapRead = isAnonymousBootstrapRead(normalizedMethod, normalizedPath);'],
  ['old_auth_mount_without_optional', 'server/control-plane/index.mjs', 'mountDirectLingxiBearerManagementAuth(app, {'],
].map(([id, filePath, source]) => ({ id, path: filePath, match: 'line', value: byteRecord(source) }));
const MR1596_CONTRACT_DEFINITION = {
  ...SOURCE_AND_TEST_DECLARATION,
  contract_id: QWORK_MR1596_ANONYMOUS_STABLE_RUNTIME_DISCOVERY_CONTRACT_ID,
  mr_iid: '1596', state: 'merged', target_branch: 'release/0.1',
  merge_commit_sha: 'ee363f4bb0549a4b0f7ebd88f63036fa8b1068df',
  changes_count: 11, changed_paths: MR1596_CHANGED_PATHS,
  mr_diff: { bytes: 28960, sha256: 'c909e06fdbc651aa6672b08ecfdd32490f413cf25866c8333df5b12c87d6d4ec' },
  source_file: {
    proof_mode: 'exact-added-lines', path: MR1596_POLICY_PATH, old_path: MR1596_POLICY_PATH,
    new_file: false, renamed_file: false, deleted_file: false,
    change_bytes: 2542, change_sha256: '2ccee231814756476b37820f37b99a159c96a2b48b846889d4ae98c020ddbb59',
    source_bytes: 1422, source_sha256: 'bf5b4377e0e498008006f9ed9b2a95f5d674f5de1c0a015b91cbf8f9a14d3074', source_line_count: 25,
  },
  header_emissions: [], integration_bindings: MR1596_INTEGRATION_BINDINGS, forbidden_fragments: MR1596_FORBIDDEN_FRAGMENTS,
};
export const QWORK_MR1596_ANONYMOUS_STABLE_RUNTIME_DISCOVERY_CONTRACT = deepFreeze({
  ...MR1596_CONTRACT_DEFINITION,
  contract_sha256: sha256(stableJson(MR1596_CONTRACT_DEFINITION)),
});

const MR1597_ALLOWLIST_LINE = 'const WORKER_ENV_ALLOWLIST = /^(PATH|SystemRoot|WINDIR|COMSPEC|PATHEXT|TEMP|TMP|TMPDIR|LANG|LC_[A-Z_]+|IM_USER_(?:MDMCODE|EMAIL|DOMAINACCOUNT|PROFILE)|DEEPBANK_HOME|STRATA_HOME|DEEPBANK_SERVER|QBOT_CONTROL_PLANE_SERVER|QBOT_RELEASE_ENV|DEEPBANK_CLAUDE_CODE_EXECUTABLE|CLAUDE_CODE_EXECUTABLE|QBOT_RUNTIME_NODE_MODULES|QBOT_(?:PYTHON|NODE)_[A-Z0-9_]+)$/u;';
const MR1597_OLD_ALLOWLIST_LINE = 'const WORKER_ENV_ALLOWLIST = /^(PATH|SystemRoot|WINDIR|COMSPEC|PATHEXT|TEMP|TMP|TMPDIR|LANG|LC_[A-Z_]+|DEEPBANK_HOME|STRATA_HOME|DEEPBANK_SERVER|QBOT_CONTROL_PLANE_SERVER|QBOT_RELEASE_ENV|DEEPBANK_CLAUDE_CODE_EXECUTABLE|CLAUDE_CODE_EXECUTABLE|QBOT_RUNTIME_NODE_MODULES|QBOT_(?:PYTHON|NODE)_[A-Z0-9_]+)$/u;';
const MR1597_LIFECYCLE_SUCCESSOR_ALLOWLIST_LINE = 'const WORKER_ENV_ALLOWLIST = /^(PATH|SystemRoot|WINDIR|COMSPEC|PATHEXT|TEMP|TMP|TMPDIR|LANG|LC_[A-Z_]+|IM_USER_(?:MDMCODE|EMAIL|DOMAINACCOUNT|PROFILE)|DEEPBANK_HOME|STRATA_HOME|DEEPBANK_SERVER|QBOT_CONTROL_PLANE_SERVER|QBOT_RELEASE_ENV|DEEPBANK_CLAUDE_CODE_EXECUTABLE|CLAUDE_CODE_EXECUTABLE|QBOT_RUNTIME_NODE_MODULES|DEEPBANK_PROVIDER_FIRST_OUTPUT_TIMEOUT_MS|QBOT_(?:PYTHON|NODE)_[A-Z0-9_]+)$/u;';
const MR1597_PRODUCT_PATHS = [
  'electron/host-core/agent/execution-worker-launch-policy.cjs',
  'electron/host-core/agent/execution-worker-process-lifecycle.cjs',
  'electron/host-core/agent/execution-worker-supervisor.cjs',
];
const MR1597_TEST_PATH = 'test/unit/desktop/execution-worker-supervisor.test.mjs';
const MR1597_FACADE_PATH = 'electron/desktop-agent-host.cjs';
const MR1597_SUPERVISOR_PATH = 'electron/host-core/agent/execution-worker-supervisor.cjs';
const MR1597_LIFECYCLE_PATH = 'electron/host-core/agent/execution-worker-process-lifecycle.cjs';
const MR1597_CHANGED_PATHS = [...MR1597_PRODUCT_PATHS, MR1597_TEST_PATH];
const MR1597_TEST_TITLE = 'worker process environment is allowlisted and excludes bearer/token material';
const MR1597_TEST_OWNER = `test('${MR1597_TEST_TITLE}', () => {`;
const MR1597_CURRENT_RELEASE_SEMANTICS_SCHEMA = 'qbot-qwork-mr1597-worker-environment-test-semantics/v2';
const MR1597_TEST_FACADE_REQUIRE_PATH = '../../../electron/desktop-agent-host.cjs';
const MR1597_FACADE_SUPERVISOR_REQUIRE_PATH = './host-core/agent/execution-worker-supervisor.cjs';
const MR1597_SUPERVISOR_LIFECYCLE_REQUIRE_PATH = './execution-worker-process-lifecycle.cjs';
const MR1597_LIFECYCLE_CONTEXT_USAGE_REQUIRE_PATH = './execution-worker-context-usage.cjs';
const MR1597_LIFECYCLE_PATH_REQUIRE_PATH = 'node:path';
const MR1597_WORKER_ENVIRONMENT_BASE_LINES = Object.freeze([
  'function workerEnvironment(source = process.env, authority = {}) {',
  '  const env = {};',
  '  for (const [key, value] of Object.entries(source || {})) {',
  "    const name = String(key || '').trim();",
  '    if (!WORKER_ENV_ALLOWLIST.test(name)) continue;',
  "    env[name] = String(value ?? '');",
  '  }',
]);
const MR1597_WORKER_ENVIRONMENT_CAPTURE_LINES = Object.freeze([
  "  if (source?.DEEPBANK_E2E === '1') {",
  "    const captureRoot = String(source?.DEEPBANK_E2E_RAW_CAPTURE_DIR || '').trim();",
  "    if (captureRoot && captureRoot.length <= 4096 && !captureRoot.includes('\\0') && isAbsolute(captureRoot)) {",
  '      env.DEEPBANK_E2E_RAW_CAPTURE_DIR = captureRoot;',
  '    }',
  '  }',
]);
const MR1597_WORKER_ENVIRONMENT_SUFFIX_LINES = Object.freeze([
  '  Object.assign(env, contextUsageWorkerFixtureEnvironment(source));',
  '  Object.assign(env, expertAuthoringWorkerFixtureEnvironment(source));',
  '  if (authority?.runtimeEntry) env.QBOT_EXECUTION_WORKER_RUNTIME_ENTRY = String(authority.runtimeEntry);',
  '  if (authority?.runtimeHome) env.DEEPBANK_HOME = String(authority.runtimeHome);',
  '  if (authority?.appRoot) env.QBOT_APP_ROOT = String(authority.appRoot);',
  '  if (authority?.serverScope) env.DEEPBANK_SERVER = env.QBOT_CONTROL_PLANE_SERVER = String(authority.serverScope);',
  '  return env;',
  '}',
]);
const MR1597_WORKER_ENVIRONMENT_AST_FINGERPRINTS = Object.freeze([
  [...MR1597_WORKER_ENVIRONMENT_BASE_LINES, ...MR1597_WORKER_ENVIRONMENT_SUFFIX_LINES],
  [
    ...MR1597_WORKER_ENVIRONMENT_BASE_LINES,
    ...MR1597_WORKER_ENVIRONMENT_CAPTURE_LINES,
    ...MR1597_WORKER_ENVIRONMENT_SUFFIX_LINES,
  ],
].map((lines) => mr1597AstFingerprint(parse(lines.join('\n'), {
  allowHashBang: true,
  ecmaVersion: 'latest',
  sourceType: 'script',
}).body[0])));
const MR1597_EXPERT_FIXTURE_HELPER_AST_FINGERPRINT = mr1597AstFingerprint(parse([
  'function expertAuthoringWorkerFixtureEnvironment(source = {}) {',
  "  if (source.DEEPBANK_E2E !== '1' || source.DEEPBANK_E2E_EXPERT_AUTHORING_FULL_CHAIN !== '1') return {};",
  '  return {',
  "    DEEPBANK_E2E: '1',",
  "    DEEPBANK_E2E_EXPERT_AUTHORING_FULL_CHAIN: '1',",
  "    ...(source.DEEPBANK_AGENT_MOCK === '1' ? { DEEPBANK_AGENT_MOCK: '1' } : {}),",
  '  };',
  '}',
].join('\n'), {
  allowHashBang: true,
  ecmaVersion: 'latest',
  sourceType: 'script',
}).body[0]);
const MR1597_LIFECYCLE_ALLOWLIST_SUCCESSOR = Object.freeze({
  schema_version: 'qbot-qwork-source-binding-successor-line/v1',
  mr_iid: '1612',
  merge_commit_sha: '5b6cea43b26ec3cd2fa12b2c7a6df14341122680',
  first_parent_sha: '1a3cef149bec91184cf31abf5485dff2fdfca926',
  target_branch: 'release/0.1',
  changed_path: MR1597_LIFECYCLE_PATH,
  changed_paths: Object.freeze([
    'electron/host-core/agent/desktop-host-context.cjs',
    'electron/host-core/agent/execution-worker-cancellation.cjs',
    'electron/host-core/agent/execution-worker-deadline.cjs',
    'electron/host-core/agent/execution-worker-entry.cjs',
    'electron/host-core/agent/execution-worker-process-lifecycle.cjs',
    'electron/host-core/agent/execution-worker-supervisor-message.cjs',
    'electron/host-core/agent/execution-worker-supervisor.cjs',
    'electron/host-core/bridge/contracts/chat-user-error-notice.cjs',
    'electron/host-core/bridge/contracts/provider-failure-chat-code.cjs',
    'server/qbot-core/engine/engine.mjs',
    'server/qbot-core/engine/turn-cleanup.mjs',
    'server/qbot-core/models/claude-media-compatibility-loopback.mjs',
    'server/qbot-core/models/provider-first-output-deadline.mjs',
    'src/chat-user-error.ts',
    'test/e2e/support/core-ux-coverage-matrix.mjs',
    'test/e2e/support/core-ux-coverage-matrix.test.mjs',
    'test/e2e/support/module-suites-1614.mjs',
    'test/e2e/support/module-suites-1614.test.mjs',
    'test/e2e/support/module-suites.mjs',
    'test/e2e/support/residual-suite-materials.mjs',
    'test/e2e/support/residual-suite-materials.test.mjs',
    'test/e2e/release-http.spec.mjs',
    'test/unit/core/chat-user-error-notice.test.mjs',
    'test/unit/desktop/execution-worker-cancel-deadline.test.mjs',
    'test/unit/desktop/execution-worker-provider-transport.test.mjs',
    'test/unit/desktop/execution-worker-supervisor.test.mjs',
    'test/unit/server/claude-media-compatibility.test.mjs',
    'test/unit/server/engine-stream-adapters.test.mjs',
    'test/unit/server/provider-first-output-deadline.test.mjs',
  ]),
  metadata_source: 'gitlab-api-changes',
  diff_bytes: 78622,
  diff_sha256: '6aeaaea1a138cf6ffa2e571d1765d43cdb99194ed3fbb0db6b11a837647cc61d',
  line: byteRecord(MR1597_LIFECYCLE_SUCCESSOR_ALLOWLIST_LINE),
});
const MR1597_LIFECYCLE_CURRENT_RELEASE_MATCH = Object.freeze({
  match: 'line-or-verified-successor-line',
  value: byteRecord(MR1597_ALLOWLIST_LINE),
  successor: MR1597_LIFECYCLE_ALLOWLIST_SUCCESSOR,
});
const MR1597_TOP_LEVEL_BINDING_EXPECTATIONS = Object.freeze([
  Object.freeze({
    kind: 'import-default', source: 'node:assert/strict', imported: 'default', local: 'assert',
  }),
  Object.freeze({
    kind: 'import-named', source: 'node:module', imported: 'createRequire', local: 'createRequire',
  }),
  Object.freeze({
    kind: 'import-default', source: 'node:test', imported: 'default', local: 'test',
  }),
  Object.freeze({
    kind: 'const-create-require', source: 'import.meta.url', imported: 'createRequire', local: 'require',
  }),
  Object.freeze({
    kind: 'const-require-destructure', source: MR1597_TEST_FACADE_REQUIRE_PATH,
    imported: 'workerEnvironment', local: 'workerEnvironment',
  }),
]);
const MR1597_EXPORT_CHAIN_EXPECTATIONS = Object.freeze([
  Object.freeze({
    role: 'facade-to-supervisor', path: MR1597_FACADE_PATH,
    kind: 'object-assign-commonjs-forward', source: MR1597_FACADE_SUPERVISOR_REQUIRE_PATH,
    imported: '*', local: 'exports',
  }),
  Object.freeze({
    role: 'supervisor-to-lifecycle', path: MR1597_SUPERVISOR_PATH,
    kind: 'const-require-destructure', source: MR1597_SUPERVISOR_LIFECYCLE_REQUIRE_PATH,
    imported: 'workerEnvironment', local: 'workerEnvironment',
  }),
  Object.freeze({
    role: 'supervisor-export', path: MR1597_SUPERVISOR_PATH,
    kind: 'commonjs-object-export', source: 'module.exports',
    imported: 'workerEnvironment', local: 'workerEnvironment',
  }),
  Object.freeze({
    role: 'lifecycle-declaration', path: MR1597_LIFECYCLE_PATH,
    kind: 'function-declaration', source: 'source=process.env,authority={}',
    imported: 'workerEnvironment', local: 'workerEnvironment',
  }),
  Object.freeze({
    role: 'lifecycle-export', path: MR1597_LIFECYCLE_PATH,
    kind: 'commonjs-object-export', source: 'module.exports',
    imported: 'workerEnvironment', local: 'workerEnvironment',
  }),
]);
const MR1597_EXPECTED_IDENTITY_VALUES = Object.freeze({
  IM_USER_MDMCODE: 'mdm-user',
  IM_USER_EMAIL: 'user@example.test',
  IM_USER_DOMAINACCOUNT: 'EXAMPLE\\user',
  IM_USER_PROFILE: '{"displayName":"Worker User"}',
});
const MR1597_IDENTITY_LINES = [
  ['test_worker_identity_mdmcode_expected', "    IM_USER_MDMCODE: 'mdm-user',"],
  ['test_worker_identity_email_expected', "    IM_USER_EMAIL: 'user@example.test',"],
  ['test_worker_identity_domain_account_expected', "    IM_USER_DOMAINACCOUNT: 'EXAMPLE\\\\user',"],
  ['test_worker_identity_profile_expected', "    IM_USER_PROFILE: '{\"displayName\":\"Worker User\"}',"],
];
const MR1597_ACCESS_TOKEN_INPUT_LINE = "    IM_USER_ACCESS_TOKEN: 'im-user-secret',";
const MR1597_ACCESS_TOKEN_KEY = 'IM_USER_ACCESS_TOKEN';
const MR1597_INPUT_REGION_START = '  const env = workerEnvironment({';
const MR1597_INPUT_REGION_END = '  }, {';
const MR1597_EXPECTED_REGION_START = '  assert.deepEqual(env, {';
const MR1597_EXPECTED_REGION_END = '});';
const MR1597_OWNER_REGION_ORDER = [
  MR1597_INPUT_REGION_START,
  MR1597_INPUT_REGION_END,
  MR1597_EXPECTED_REGION_START,
  MR1597_EXPECTED_REGION_END,
];
const MR1597_INPUT_SCOPE = currentReleaseRegionScope({
  ownerStart: MR1597_TEST_OWNER,
  regionStart: MR1597_INPUT_REGION_START,
  regionEnd: MR1597_INPUT_REGION_END,
  ownerRegionOrder: MR1597_OWNER_REGION_ORDER,
  requiredFragments: [
    ...MR1597_IDENTITY_LINES.map(([id, source]) => [`${id}_input`, source]),
    ['access_token_input', MR1597_ACCESS_TOKEN_INPUT_LINE],
  ],
  requiredFragmentLineIndexes: [8, 9, 10, 11, 12],
});
const MR1597_EXPECTED_SCOPE = currentReleaseRegionScope({
  ownerStart: MR1597_TEST_OWNER,
  regionStart: MR1597_EXPECTED_REGION_START,
  regionEnd: MR1597_EXPECTED_REGION_END,
  ownerRegionOrder: MR1597_OWNER_REGION_ORDER,
  requiredFragments: MR1597_IDENTITY_LINES,
  requiredFragmentLineIndexes: [9, 10, 11, 12],
  regionEndInclusive: false,
  forbiddenFragments: [['access_token_expected_forbidden', MR1597_ACCESS_TOKEN_KEY, 'js-property-key']],
});
const MR1597_INTEGRATION_BINDINGS = [
  ...MR1597_PRODUCT_PATHS.map((filePath, index) => ({
    id: `worker_allowlist_${index + 1}`,
    path: filePath,
    addition: byteRecord(MR1597_ALLOWLIST_LINE),
    ...(filePath === MR1597_LIFECYCLE_PATH ? {
      current_release_match: MR1597_LIFECYCLE_CURRENT_RELEASE_MATCH,
    } : {}),
  })),
  ...MR1597_IDENTITY_LINES.map(([id, source]) => ({
    id,
    path: MR1597_TEST_PATH,
    addition: byteRecord(source),
    expected_addition_count: 2,
    expected_current_occurrence_count: 2,
    current_release_scope: MR1597_EXPECTED_SCOPE,
  })),
  {
    id: 'test_worker_access_token_input_only',
    path: MR1597_TEST_PATH,
    addition: byteRecord(MR1597_ACCESS_TOKEN_INPUT_LINE),
    expected_addition_count: 1,
    expected_current_occurrence_count: 1,
    current_release_match: { match: 'js-property-key', value: byteRecord(MR1597_ACCESS_TOKEN_KEY) },
    current_release_scope: MR1597_INPUT_SCOPE,
  },
];
const MR1597_FORBIDDEN_FRAGMENTS = MR1597_PRODUCT_PATHS.flatMap((filePath, index) => [
  { id: `old_worker_allowlist_${index + 1}`, path: filePath, match: 'line', value: byteRecord(MR1597_OLD_ALLOWLIST_LINE) },
  ...['IM_USER_ACCESS_TOKEN', 'IM_QWORK_ACCESS_TOKEN', 'QBOT_LINGXI_ACCESS_TOKEN'].map((secret) => ({
    id: `worker_secret_${index + 1}_${secret.toLowerCase()}`, path: filePath, match: 'substring', value: byteRecord(secret),
  })),
]);
const MR1597_CONTRACT_DEFINITION = {
  ...SOURCE_AND_TEST_DECLARATION,
  contract_id: QWORK_MR1597_WORKER_IM_USER_IDENTITY_FORWARDING_CONTRACT_ID,
  mr_iid: '1597', state: 'merged', target_branch: 'release/0.1',
  merge_commit_sha: '8d5429066a4c374c23275f7d009a3c78060f4522',
  changes_count: 4, changed_paths: MR1597_CHANGED_PATHS,
  mr_diff: { bytes: 4970, sha256: '4a69a85325a545fcd5d9624399d2143c665f70f6af473c26a502f94558e5feaa' },
  source_file: {
    proof_mode: 'exact-added-lines', path: MR1597_PRODUCT_PATHS[0], old_path: MR1597_PRODUCT_PATHS[0],
    new_file: false, renamed_file: false, deleted_file: false,
    change_bytes: 1005, change_sha256: '51230640bfd6698e48108078687d5de1c2d9fc797a08dbe775fa5b94a1b60503',
    source_bytes: 354, source_sha256: '3f33ef3ecb37e4f4ac3732e28a8cdaadb351e1059f2d54473a270e1c6217549e', source_line_count: 1,
  },
  header_emissions: [], integration_bindings: MR1597_INTEGRATION_BINDINGS, forbidden_fragments: MR1597_FORBIDDEN_FRAGMENTS,
};
export const QWORK_MR1597_WORKER_IM_USER_IDENTITY_FORWARDING_CONTRACT = deepFreeze({
  ...MR1597_CONTRACT_DEFINITION,
  contract_sha256: sha256(stableJson(MR1597_CONTRACT_DEFINITION)),
});

const MR1561_PROTOCOL_PATH = 'electron/host-core/agent/execution-worker-protocol.cjs';
const MR1561_TEST_PATH = 'test/unit/desktop/execution-worker-supervisor.test.mjs';
const MR1561_INTEGRATION_BINDINGS = [
  [
    'shared_worker_envelope_limit_32_mib',
    MR1561_PROTOCOL_PATH,
    'const MAX_ENVELOPE_BYTES = 32 * 1024 * 1024;',
  ],
  [
    'test_declares_shared_32_mib_envelope_limit',
    MR1561_TEST_PATH,
    "test('execution messages share the 32 MiB envelope limit', () => {",
  ],
  [
    'test_asserts_execution_start_matches_shared_limit',
    MR1561_TEST_PATH,
    '  assert.equal(MAX_EXECUTION_START_ENVELOPE_BYTES, MAX_ENVELOPE_BYTES);',
  ],
  [
    'test_accepts_payload_below_shared_limit',
    MR1561_TEST_PATH,
    "  const payload = { input: { text: 'x'.repeat(MAX_ENVELOPE_BYTES - 1024) } };",
  ],
  [
    'test_rejects_payload_at_shared_limit',
    MR1561_TEST_PATH,
    "    input: { text: 'x'.repeat(MAX_ENVELOPE_BYTES) },",
  ],
].map(([id, filePath, source]) => ({ id, path: filePath, addition: byteRecord(source) }));

const MR1561_FORBIDDEN_FRAGMENTS = [
  [
    'legacy_shared_worker_envelope_limit_256_kib',
    MR1561_PROTOCOL_PATH,
    'const MAX_ENVELOPE_BYTES = 256 * 1024;',
  ],
  [
    'legacy_execution_start_above_control_envelope_test',
    MR1561_TEST_PATH,
    "test('execution start accepts model context above the control-envelope limit', () => {",
  ],
  [
    'legacy_execution_start_limit_greater_than_shared_limit',
    MR1561_TEST_PATH,
    '  assert.ok(MAX_EXECUTION_START_ENVELOPE_BYTES > MAX_ENVELOPE_BYTES);',
  ],
].map(([id, filePath, source]) => ({
  id,
  path: filePath,
  match: 'line',
  value: byteRecord(source),
}));

const MR1561_CONTRACT_DEFINITION = {
  ...SOURCE_AND_TEST_DECLARATION,
  contract_id: QWORK_MR1561_WORKER_ENVELOPE_LIMIT_CONTRACT_ID,
  mr_iid: '1561',
  state: 'merged',
  target_branch: 'release/0.1',
  merge_commit_sha: 'ba03b0fa37825de35b556de1d9681da2456b40f2',
  changes_count: 2,
  changed_paths: [MR1561_PROTOCOL_PATH, MR1561_TEST_PATH],
  mr_diff: {
    bytes: 2236,
    sha256: '4844c34e0098f0f1bf485df52c92ef8c868da2b301e6d8e25270a2bdab2878fd',
  },
  source_file: {
    proof_mode: 'exact-added-lines',
    path: MR1561_PROTOCOL_PATH,
    old_path: MR1561_PROTOCOL_PATH,
    new_file: false,
    renamed_file: false,
    deleted_file: false,
    change_bytes: 744,
    change_sha256: '6b7fdee93bc1e6da48828eb814edd4a7a47bdaab17d2bb981e477d0eca9ae64e',
    source_bytes: 45,
    source_sha256: '59a592a8156a1ea5100f747805dc68fffb2b2856fe3515c5a19a66967c73fbb5',
    source_line_count: 1,
  },
  header_emissions: [],
  integration_bindings: MR1561_INTEGRATION_BINDINGS,
  forbidden_fragments: MR1561_FORBIDDEN_FRAGMENTS,
};

export const QWORK_MR1561_WORKER_ENVELOPE_LIMIT_CONTRACT = deepFreeze({
  ...MR1561_CONTRACT_DEFINITION,
  contract_sha256: sha256(stableJson(MR1561_CONTRACT_DEFINITION)),
});

const MR1560_HOST_PATH = 'electron/host-core/agent/desktop-host-context.cjs';
const MR1560_READINESS_PATH = 'electron/host-core/agent/turn-authority-readiness.cjs';
const MR1560_WEIGHT_PATH = 'scripts/ci/unit/node-unit-test-weights.json';
const MR1560_TEST_PATH = 'test/unit/desktop/turn-authority-readiness.test.mjs';
const MR1560_INTEGRATION_BINDINGS = [
  [
    'readiness_observes_lifecycle_projection_only',
    MR1560_READINESS_PATH,
    '// Observe lifecycle-owned local projections; never initiate refresh or re-accept a turn.',
  ],
  ['readiness_helper_declaration', MR1560_READINESS_PATH, 'async function readReadyTurnAuthority(read, {'],
  ['readiness_default_timeout_10_seconds', MR1560_READINESS_PATH, '  timeoutMs = 10_000,'],
  ['readiness_default_interval_100_ms', MR1560_READINESS_PATH, '  intervalMs = 100,'],
  ['readiness_deadline_uses_timeout', MR1560_READINESS_PATH, '  const deadline = now() + timeoutMs;'],
  ['readiness_reads_local_projection', MR1560_READINESS_PATH, '    const result = await read();'],
  [
    'readiness_returns_ok_or_non_transient_error_immediately',
    MR1560_READINESS_PATH,
    "    if (result?.ok || result?.code !== 'desktop_model_authority_not_ready') return result;",
  ],
  ['readiness_remaining_uses_deadline', MR1560_READINESS_PATH, '    const remaining = deadline - now();'],
  ['readiness_returns_last_result_at_deadline', MR1560_READINESS_PATH, '    if (remaining <= 0) return result;'],
  ['readiness_wait_is_interval_and_deadline_bounded', MR1560_READINESS_PATH, '    await wait(Math.min(intervalMs, remaining));'],
  ['readiness_helper_exported', MR1560_READINESS_PATH, 'module.exports = { readReadyTurnAuthority };'],
  [
    'desktop_host_wraps_single_accept_authority_read',
    MR1560_HOST_PATH,
    "        async () => require('./turn-authority-readiness.cjs').readReadyTurnAuthority(() => currentTurnAuthorityForScope(turnScope, userId, {",
  ],
  [
    'test_declares_last_good_immediate',
    MR1560_TEST_PATH,
    "test('valid last-good authority is returned without waiting', async () => {",
  ],
  [
    'test_last_good_forbids_wait',
    MR1560_TEST_PATH,
    "    wait: () => assert.fail('last-good must be immediate'),",
  ],
  [
    'test_declares_cold_start_local_observation',
    MR1560_TEST_PATH,
    "test('cold model authority observes local refresh without re-accepting the turn', async () => {",
  ],
  [
    'test_cold_start_ready_on_third_read',
    MR1560_TEST_PATH,
    '  assert.equal(await readReadyTurnAuthority(() => ++reads === 3 ? ready : pending, {',
  ],
  ['test_cold_start_reads_three_times', MR1560_TEST_PATH, '  assert.equal(reads, 3);'],
  [
    'test_declares_bounded_preparation_failure',
    MR1560_TEST_PATH,
    "test('missing model authority fails within a bounded preparation window', async () => {",
  ],
  ['test_bounded_failure_timeout_250_ms', MR1560_TEST_PATH, '    timeoutMs: 250, now: () => elapsed,'],
  ['test_bounded_failure_elapsed_250_ms', MR1560_TEST_PATH, '  assert.equal(elapsed, 250);'],
  [
    'test_declares_scope_and_permanent_error_stop',
    MR1560_TEST_PATH,
    "test('scope changes and permanent permission failures stop the wait', async () => {",
  ],
  [
    'test_covers_scope_and_permanent_error_codes',
    MR1560_TEST_PATH,
    "  for (const code of ['desktop_local_context_superseded', 'desktop_local_authority_not_ready']) {",
  ],
  ['test_scope_or_permanent_error_reads_twice', MR1560_TEST_PATH, '    assert.equal(reads, 2);'],
].map(([id, filePath, source]) => ({ id, path: filePath, addition: byteRecord(source) }));

const MR1560_FORBIDDEN_FRAGMENTS = [
  [
    'desktop_host_direct_authority_read_without_readiness',
    MR1560_HOST_PATH,
    'line',
    '        async () => currentTurnAuthorityForScope(turnScope, userId, {',
  ],
  ['readiness_active_refresh_call', MR1560_READINESS_PATH, 'substring', 'await refresh'],
  ['readiness_active_reaccept_call', MR1560_READINESS_PATH, 'substring', 'await accept'],
].map(([id, filePath, match, source]) => ({
  id,
  path: filePath,
  match,
  value: byteRecord(source),
}));

const MR1560_CONTRACT_DEFINITION = {
  ...SOURCE_AND_TEST_DECLARATION,
  contract_id: QWORK_MR1560_TURN_AUTHORITY_READINESS_CONTRACT_ID,
  mr_iid: '1560',
  state: 'merged',
  target_branch: 'release/0.1',
  merge_commit_sha: 'cebd32ba077e8708c0a5d241067bfb8b848f5b54',
  changes_count: 4,
  changed_paths: [MR1560_HOST_PATH, MR1560_READINESS_PATH, MR1560_WEIGHT_PATH, MR1560_TEST_PATH],
  mr_diff: {
    bytes: 4783,
    sha256: 'a3a98779ece45cf3335e26c7f18a0b0b5e3177741d91a73daaa756c44e8f3d52',
  },
  source_file: {
    proof_mode: 'exact-new-file',
    path: MR1560_READINESS_PATH,
    old_path: MR1560_READINESS_PATH,
    new_file: true,
    renamed_file: false,
    deleted_file: false,
    change_bytes: 886,
    change_sha256: '105c5f138f268bdde351d6e3f0eec378bbae3b444681038285f119f2bd4b5be8',
    source_bytes: 629,
    source_sha256: '520a26f968093a7c5ed40465fd1e0118dda2825325bbb1fb2aa12d05ad9c4aea',
    source_line_count: 18,
  },
  header_emissions: [],
  integration_bindings: MR1560_INTEGRATION_BINDINGS,
  forbidden_fragments: MR1560_FORBIDDEN_FRAGMENTS,
};

export const QWORK_MR1560_TURN_AUTHORITY_READINESS_CONTRACT = deepFreeze({
  ...MR1560_CONTRACT_DEFINITION,
  contract_sha256: sha256(stableJson(MR1560_CONTRACT_DEFINITION)),
});

const MR1573_ORGANIZATION_IDENTITY_PATH = 'electron/host-core/bridge/contracts/organization-identity.cjs';
const MR1573_FEATURE_PATH = 'electron/host-core/auth/qwork-memory-feature.cjs';
const MR1573_FEATURE_TEST_PATH = 'test/unit/auth/qwork-memory-feature.test.mjs';
const MR1573_RUNTIME_TEST_PATH = 'test/unit/desktop/memory-augmentation-runtime.test.mjs';
const MR1573_MCP_PATH = 'server/qbot-core/connectors/learning-fabric-mcp-bridge.mjs';
const MR1573_MCP_TEST_PATH = 'test/unit/auth/personal-memory-client.test.mjs';
const MR1573_BRIDGE_PATH = 'electron/host-core/bridge/preload/bridge-context.cjs';
const MR1573_HOST_RUNTIME_PATH = 'electron/host-core/foundation/runtime-paths.cjs';
const MR1573_STANDALONE_RUNTIME_PATH = 'runtime-paths.mjs';
const MR1573_RUNTIME_TEST_CONTRACT_PATH = 'test/unit/runtime/runtime-paths.test.mjs';
const MR1573_E2E_RUNTIME_TEST_PATH = 'test/e2e/support/claude-sdk-resilience.conformance.mjs';
const MR1573_REAL_CHAIN_TEST_PATH = 'test/e2e/support/memory-augmentation-real-chain.test.mjs';

const MR1573_INTEGRATION_BINDINGS = [
  ['feature_refresh_preserves_verified_state', MR1573_FEATURE_PATH,
    "    if (!isVerified(state)) Object.assign(state, { state: 'unavailable', enabled: false });"],
  ['feature_test_declares_refresh_cache', MR1573_FEATURE_TEST_PATH,
    "test('QworkMemoryFeature keeps the last verified gate when a background refresh fails', async () => {"],
  ['session_feature_check_once', MR1573_RUNTIME_TEST_PATH, '    assert.equal(featureCalls, 1);'],
  ['session_recall_policy_each_session', MR1573_RUNTIME_TEST_PATH, '    assert.equal(settingsCalls, 2);'],
  ['session_mcp_preparation_each_session', MR1573_RUNTIME_TEST_PATH, '    assert.equal(mcpCalls, 2);'],
  ['mcp_uses_native_url', MR1573_MCP_PATH, "import { URL } from 'node:url';"],
  ['mcp_dual_host_contract', MR1573_MCP_TEST_PATH, "for (const host of ['standalone', 'teams360']) {"],
  ['mcp_teams_native_url_probe', MR1573_MCP_TEST_PATH,
    "    assert.equal(new URL('https://memory.example.test/mcp') instanceof URL, false);"],
  ['mcp_recall_real_call', MR1573_MCP_TEST_PATH,
    "  assert.deepEqual(await bridge.callTool('recall', { query: 'connection diagnostic' }), {"],
  ['identity_direct_object_normalized', MR1573_ORGANIZATION_IDENTITY_PATH,
    '  const direct = object(user.directSuperior);'],
  ['identity_nested_superior_normalized', MR1573_ORGANIZATION_IDENTITY_PATH,
    '  const superior = object(user.superior);'],
  ['identity_direct_string_guard', MR1573_ORGANIZATION_IDENTITY_PATH,
    "  const directText = typeof user.directSuperior === 'string' ? user.directSuperior : '';"],
  ['identity_direct_superior_name_alias', MR1573_ORGANIZATION_IDENTITY_PATH,
    '      user.directSuperiorName ||'],
  ['identity_direct_superior_account_alias', MR1573_ORGANIZATION_IDENTITY_PATH,
    '      user.directSuperiorUsername ||'],
  ['identity_bridge_shared_helper_import', MR1573_BRIDGE_PATH,
    "const { organizationIdentityFromAuthUser } = require('../contracts/organization-identity.cjs');"],
  ['identity_bridge_shared_helper_use', MR1573_BRIDGE_PATH,
    'const organizationIdentityForAuth = () => organizationIdentityFromAuthUser(currentAuth?.user);'],
  ['runtime_host_disables_claude_mds', MR1573_HOST_RUNTIME_PATH,
    "    env: { ...(options.env || process.env), CLAUDE_CODE_DISABLE_CLAUDE_MDS: '1', CLAUDE_CODE_DISABLE_AUTO_MEMORY: '1' },"],
  ['runtime_standalone_disables_claude_mds', MR1573_STANDALONE_RUNTIME_PATH,
    "    env: { ...(options.env || process.env), CLAUDE_CODE_DISABLE_CLAUDE_MDS: '1', CLAUDE_CODE_DISABLE_AUTO_MEMORY: '1' },"],
  ['runtime_dual_path_test_declares_claude_mds', MR1573_RUNTIME_TEST_CONTRACT_PATH,
    '  test(`#1491 [${implementation}] Claude query options always disable CLAUDE.md and Auto Memory`, () => {'],
  ['runtime_dual_path_test_asserts_claude_mds', MR1573_RUNTIME_TEST_CONTRACT_PATH,
    "    assert.equal(actual.env.CLAUDE_CODE_DISABLE_CLAUDE_MDS, '1');"],
  ['runtime_e2e_claude_md_file_sentinel', MR1573_E2E_RUNTIME_TEST_PATH,
    "  const claudeMdFile = join(workspaceDir, 'CLAUDE.md');"],
  ['runtime_e2e_claude_md_absent', MR1573_E2E_RUNTIME_TEST_PATH,
    '    assert.equal(result.requestContainsClaudeMdSentinel, false);'],
  ['runtime_e2e_claude_mds_env', MR1573_E2E_RUNTIME_TEST_PATH,
    "        disableClaudeMdsEnv: options.env?.CLAUDE_CODE_DISABLE_CLAUDE_MDS,"],
  ['runtime_real_chain_recall', MR1573_REAL_CHAIN_TEST_PATH,
    "        arguments: { query: '通过云端记忆记录并召回用户偏好', limit: 8 },"],
].map(([id, filePath, source]) => ({ id, path: filePath, addition: byteRecord(source) }));

const MR1573_FORBIDDEN_FRAGMENTS = [
  ['legacy_unconditional_refresh_hide', MR1573_FEATURE_PATH, 'line',
    "    Object.assign(state, { state: 'unavailable', enabled: false });"],
  ['legacy_bridge_direct_superior_string_coercion', MR1573_BRIDGE_PATH, 'line',
    "  directSuperior: String(user.directSuperior || '').trim(),"],
  ['legacy_host_auto_memory_only_env', MR1573_HOST_RUNTIME_PATH, 'line',
    "    env: { ...(options.env || process.env), CLAUDE_CODE_DISABLE_AUTO_MEMORY: '1' },"],
  ['legacy_standalone_auto_memory_only_env', MR1573_STANDALONE_RUNTIME_PATH, 'line',
    "    env: { ...(options.env || process.env), CLAUDE_CODE_DISABLE_AUTO_MEMORY: '1' },"],
].map(([id, filePath, match, source]) => ({ id, path: filePath, match, value: byteRecord(source) }));

const MR1573_CONTRACT_DEFINITION = {
  ...SOURCE_AND_TEST_DECLARATION,
  contract_id: QWORK_MR1573_MEMORY_SESSION_PROFILE_STABILITY_CONTRACT_ID,
  mr_iid: '1573',
  state: 'merged',
  target_branch: 'release/0.1',
  merge_commit_sha: '6d482c9ccbceb74d4ebf81610d980e5fe15def6c',
  changes_count: 22,
  changed_paths: [
    '.agent/context/_shared/references/memory-authority-boundary.md',
    'docs/memory-augmentation-runtime.md',
    'electron/host-core/agent/execution-worker-capabilities.cjs',
    MR1573_FEATURE_PATH,
    MR1573_ORGANIZATION_IDENTITY_PATH,
    MR1573_BRIDGE_PATH,
    MR1573_HOST_RUNTIME_PATH,
    'electron/desktop-agent-host.cjs',
    'scripts/ci/unit/node-unit-test-weights.json',
    MR1573_MCP_PATH,
    'server/qbot-core/engine/memory-runtime.mjs',
    'server/qbot-core/tools/builtin-memory-augmentation-mcp.mjs',
    MR1573_E2E_RUNTIME_TEST_PATH,
    MR1573_REAL_CHAIN_TEST_PATH,
    MR1573_MCP_TEST_PATH,
    MR1573_FEATURE_TEST_PATH,
    MR1573_RUNTIME_TEST_PATH,
    'test/unit/electron/preload-organization-identity.test.mjs',
    MR1573_RUNTIME_TEST_CONTRACT_PATH,
    'test/unit/runtime/tool-exploration-runtime.test.mjs',
    'test/unit/server/engine-prompt-composer.test.mjs',
    MR1573_STANDALONE_RUNTIME_PATH,
  ],
  mr_diff: {
    bytes: 43377,
    sha256: 'dc1d7e0acf8f9001c70621b28c3ffbf83ba2a4b12d185a2e278ab6b2b0eb7394',
  },
  source_file: {
    proof_mode: 'exact-new-file',
    path: MR1573_ORGANIZATION_IDENTITY_PATH,
    old_path: MR1573_ORGANIZATION_IDENTITY_PATH,
    new_file: true,
    renamed_file: false,
    deleted_file: false,
    change_bytes: 1976,
    change_sha256: '20f920797bb31a63d6131a123c87b12f063e0c215fbf8327299279c5514cb0bc',
    source_bytes: 1638,
    source_sha256: '0f5cc6d693a27c89bbeee7be29a373f2b3a7c77dcaf900db3718e81567112779',
    source_line_count: 50,
  },
  header_emissions: [],
  integration_bindings: MR1573_INTEGRATION_BINDINGS,
  forbidden_fragments: MR1573_FORBIDDEN_FRAGMENTS,
};

export const QWORK_MR1573_MEMORY_SESSION_PROFILE_STABILITY_CONTRACT = deepFreeze({
  ...MR1573_CONTRACT_DEFINITION,
  contract_sha256: sha256(stableJson(MR1573_CONTRACT_DEFINITION)),
});

const MR1579_ENGINE_PATH = 'server/qbot-core/engine/engine.mjs';
const MR1579_EXPERT_RUNTIME_PATH = 'server/qbot-core/experts/expert-v2-runtime.mjs';
const MR1579_MEDIA_LOOPBACK_PATH = 'server/qbot-core/models/claude-media-compatibility-loopback.mjs';
const MR1579_MEDIA_COMPATIBILITY_PATH = 'server/qbot-core/models/claude-media-compatibility.mjs';
const MR1579_SKILL_COMPATIBILITY_PATH = 'server/qbot-core/models/claude-skill-call-compatibility.mjs';
const MR1579_MEDIA_TEST_PATH = 'test/unit/server/claude-media-compatibility.test.mjs';
const MR1579_SKILL_TEST_PATH = 'test/unit/server/claude-skill-call-compatibility.test.mjs';
const MR1579_INVOCATION_NOTE_TEST_PATH = 'test/unit/skills/claude-skill-invocation-note.test.mjs';
const MR1579_EXPERT_TEST_PATH = 'test/unit/skills/expert-v2-runtime-boundaries.test.mjs';
const MR1579_PREFLIGHT_TEST_PATH = 'test/unit/skills/skillhub-engine-preflight.test.mjs';

const MR1579_CHANGED_PATHS = [
  'scripts/ci/unit/node-unit-test-weights.json',
  MR1579_ENGINE_PATH,
  MR1579_EXPERT_RUNTIME_PATH,
  MR1579_MEDIA_LOOPBACK_PATH,
  MR1579_MEDIA_COMPATIBILITY_PATH,
  MR1579_SKILL_COMPATIBILITY_PATH,
  'server/qbot-core/.architecture.yaml',
  MR1579_MEDIA_TEST_PATH,
  MR1579_SKILL_TEST_PATH,
  MR1579_INVOCATION_NOTE_TEST_PATH,
  MR1579_EXPERT_TEST_PATH,
  MR1579_PREFLIGHT_TEST_PATH,
];

const MR1579_INTEGRATION_BINDINGS = [
  ['alias_uses_invocation_name', MR1579_SKILL_COMPATIBILITY_PATH,
    '    const canonicalName = compact(descriptor?.invocationName);'],
  ['alias_maps_to_invocation_name', MR1579_SKILL_COMPATIBILITY_PATH,
    '        aliases.set(alias, canonicalName);'],
  ['canonical_name_is_not_rewritten', MR1579_SKILL_COMPATIBILITY_PATH,
    '  if (canonicalizer.canonicalNames?.has(requestedName)) {'],
  ['ambiguous_alias_fails_closed', MR1579_SKILL_COMPATIBILITY_PATH,
    "    return { input, changed: false, requestedName, canonicalName: '', reason: 'ambiguous' };"],
  ['unknown_alias_fails_closed', MR1579_SKILL_COMPATIBILITY_PATH,
    "    return { input, changed: false, requestedName, canonicalName: '', reason: 'unknown' };"],
  ['only_skill_name_is_rewritten', MR1579_SKILL_COMPATIBILITY_PATH,
    '    input: { ...source, skill: canonicalName },'],
  ['tool_use_outer_fields_are_preserved', MR1579_SKILL_COMPATIBILITY_PATH,
    '  return result.changed ? { ...source, input: result.input } : block;'],
  ['json_payload_rewriter_exported', MR1579_SKILL_COMPATIBILITY_PATH,
    'export function rewriteClaudeProviderSkillResponsePayload(payload, canonicalizer) {'],
  ['explicit_disable_is_fail_closed', MR1579_SKILL_COMPATIBILITY_PATH,
    "  if (compact(env?.QBOT_DISABLE_CLAUDE_SKILL_CALL_CANONICALIZATION) === '1') return null;"],
  ['malformed_sse_fails_closed', MR1579_SKILL_COMPATIBILITY_PATH,
    "    throw skillCallStreamError('claude_skill_call_stream_input_invalid');"],
  ['oversized_sse_fails_closed', MR1579_SKILL_COMPATIBILITY_PATH,
    "      if (bytes > maxBufferedBytes) throw skillCallStreamError('claude_skill_call_stream_block_too_large');"],
  ['sse_rewriter_exported', MR1579_SKILL_COMPATIBILITY_PATH,
    'export async function* canonicalizeClaudeSkillSseStream(chunks, canonicalizer, {'],
  ['incomplete_sse_fails_closed', MR1579_SKILL_COMPATIBILITY_PATH,
    "  if (buffer.pending) throw skillCallStreamError('claude_skill_call_stream_block_incomplete');"],
  ['loopback_stream_uses_sse_rewriter', MR1579_MEDIA_LOOPBACK_PATH,
    '    ? canonicalizeClaudeSkillSseStream(response.body, canonicalizer, { onRewrite })'],
  ['loopback_json_uses_payload_rewriter', MR1579_MEDIA_LOOPBACK_PATH,
    '  const rewritten = rewriteClaudeProviderSkillResponsePayload(payload, canonicalizer);'],
  ['loopback_selects_sse_path', MR1579_MEDIA_LOOPBACK_PATH,
    "  if (contentType.includes('text/event-stream')) {"],
  ['loopback_selects_json_path', MR1579_MEDIA_LOOPBACK_PATH,
    '  return forwardJsonSkillResponse(response, res, { canonicalizer, onRewrite });'],
  ['loopback_builds_turn_scoped_canonicalizer', MR1579_MEDIA_LOOPBACK_PATH,
    '    ?? createClaudeSkillCallCanonicalizerFromPreflight(skillPreflight, env);'],
  ['media_wrapper_loads_loopback', MR1579_MEDIA_COMPATIBILITY_PATH,
    "  const loopback = await import('./claude-media-compatibility-loopback.mjs');"],
  ['media_wrapper_injects_media_rewriter', MR1579_MEDIA_COMPATIBILITY_PATH,
    '    rewritePayload: rewriteClaudeProviderMediaPayload,'],
  ['engine_prompt_uses_invocation_note', MR1579_ENGINE_PATH,
    '    skillSelectionNote: runtimeFamily === RUNTIME_FAMILY_CLAUDE ? claudeRuntimeSkillInvocationNoteOverride(s) : undefined,'],
  ['engine_passes_skill_preflight_to_loopback', MR1579_ENGINE_PATH,
    '      capabilities: claudeVisionCapabilityByModel, skillPreflight,'],
  ['engine_inventory_limit_is_8000', MR1579_ENGINE_PATH,
    'const AUTOMATIC_SKILL_INVENTORY_MAX_CHARS = 8000;'],
  ['engine_failure_names_prefer_invocation_name', MR1579_ENGINE_PATH,
    '    .map((item) => toolFailureText(item?.invocationName || item?.nativeSkillName || item?.runtimeName || item?.name, 160))'],
  ['draft_expert_hides_durable_skill_identity', MR1579_EXPERT_RUNTIME_PATH,
    '        ? `【草稿专家能力】\\n专家依赖的 ${skills.length} 个 Skill 已进入本轮物化选择；具体调用名与描述仅以本轮运行时提供的 Skill 清单为准。`'],
  ['published_expert_hides_durable_skill_identity', MR1579_EXPERT_RUNTIME_PATH,
    '            ? `【专家绑定技能】\\n专家依赖的 ${skills.length} 个 Skill 已进入本轮物化选择；具体调用名与描述仅以本轮运行时提供的 Skill 清单为准。`'],
  ['test_declares_unique_alias_mapping', MR1579_SKILL_TEST_PATH,
    "test('#1644 canonicalizer maps only current-turn unique aliases to registered invocation names', () => {"],
  ['test_declares_ambiguous_and_unknown_fail_closed', MR1579_SKILL_TEST_PATH,
    "test('#1644 canonicalizer fails closed for unknown and ambiguous aliases', () => {"],
  ['test_declares_json_skill_only_rewrite', MR1579_SKILL_TEST_PATH,
    "test('#1644 non-stream provider response rewrites only Skill input.skill', () => {"],
  ['test_asserts_json_invocation_name', MR1579_SKILL_TEST_PATH,
    "  assert.equal(result.payload.content[1].input.skill, 'qwork-runtime-skills:kb-query');"],
  ['test_asserts_args_preserved', MR1579_SKILL_TEST_PATH,
    "  assert.deepEqual(result.payload.content[1].input.args, { metric: 'gmv' });"],
  ['test_asserts_text_block_preserved', MR1579_SKILL_TEST_PATH,
    '  assert.strictEqual(result.payload.content[0], original.content[0]);'],
  ['test_asserts_other_tool_preserved', MR1579_SKILL_TEST_PATH,
    '  assert.strictEqual(result.payload.content[2], original.content[2]);'],
  ['test_declares_fragmented_sse_rewrite', MR1579_SKILL_TEST_PATH,
    "test('#1644 SSE buffers fragmented Skill input and emits canonical JSON before SDK validation', async () => {"],
  ['test_declares_malformed_and_oversized_sse_fail_closed', MR1579_SKILL_TEST_PATH,
    "test('#1644 malformed and oversized Skill SSE blocks fail closed', async () => {"],
  ['test_declares_loopback_json_rewrite', MR1579_MEDIA_TEST_PATH,
    "test('#1644 loopback canonicalizes provider Skill responses before SDK validation', async (t) => {"],
  ['test_asserts_loopback_args_preserved', MR1579_MEDIA_TEST_PATH,
    "  assert.deepEqual(payload.content[0].input.args, { metric: 'private-metric' });"],
  ['test_declares_malformed_loopback_sse_close', MR1579_MEDIA_TEST_PATH,
    "test('#1644 malformed Skill SSE closes the started response instead of hanging', async (t) => {"],
  ['test_declares_expert_invocation_name_prompt', MR1579_INVOCATION_NOTE_TEST_PATH,
    "test('#1644 Expert GPT prompt uses descriptor invocation names, not SkillHub durable ids', () => {"],
  ['test_asserts_expert_durable_identity_hidden', MR1579_EXPERT_TEST_PATH,
    '  assert.match(resolved.runtime.dependencyNote, /调用名与描述仅以本轮运行时提供的 Skill 清单为准/u);'],
  ['test_asserts_inventory_limit_8000', MR1579_PREFLIGHT_TEST_PATH,
    "  assert.ok(inventory.length <= 8000, '动态索引最多占用 8000 字符');"],
].map(([id, filePath, source]) => ({ id, path: filePath, addition: byteRecord(source) }));

const MR1579_FORBIDDEN_FRAGMENTS = [
  ['engine_must_not_set_disable_flag', MR1579_ENGINE_PATH, 'substring',
    'QBOT_DISABLE_CLAUDE_SKILL_CALL_CANONICALIZATION'],
  ['architecture_must_not_set_disable_flag', 'server/qbot-core/.architecture.yaml', 'substring',
    'QBOT_DISABLE_CLAUDE_SKILL_CALL_CANONICALIZATION'],
  ['legacy_inventory_limit_4000', MR1579_ENGINE_PATH, 'line',
    'const AUTOMATIC_SKILL_INVENTORY_MAX_CHARS = 4000;'],
  ['legacy_failure_name_prefers_durable_identity', MR1579_ENGINE_PATH, 'line',
    '    .map((item) => toolFailureText(item?.runtimeName || item?.name || item?.invocationName, 160))'],
  ['legacy_claude_skill_selection_note_empty', MR1579_ENGINE_PATH, 'line',
    "    skillSelectionNote: runtimeFamily === RUNTIME_FAMILY_CLAUDE ? '' : undefined,"],
  ['expert_prompt_exposes_durable_identity', MR1579_EXPERT_RUNTIME_PATH, 'substring',
    '${skill.runtimeName} (${skill.sourcePlatform})'],
].map(([id, filePath, match, source]) => ({
  id,
  path: filePath,
  match,
  value: byteRecord(source),
}));

const MR1579_CONTRACT_DEFINITION = {
  ...SOURCE_AND_TEST_DECLARATION,
  contract_id: QWORK_MR1579_CLAUDE_SKILL_CALL_CANONICALIZATION_CONTRACT_ID,
  mr_iid: '1579',
  state: 'merged',
  target_branch: 'release/0.1',
  merge_commit_sha: '7f9b520f41ed9ac34b9230f28df49a5fce678953',
  changes_count: 12,
  changed_paths: MR1579_CHANGED_PATHS,
  mr_diff: {
    bytes: 63270,
    sha256: 'e250309ca8e588db87b9214def6b1acb25e54d8a4605d93ba651cf1c34ff8967',
  },
  source_file: {
    proof_mode: 'exact-new-file',
    path: MR1579_SKILL_COMPATIBILITY_PATH,
    old_path: MR1579_SKILL_COMPATIBILITY_PATH,
    new_file: true,
    renamed_file: false,
    deleted_file: false,
    change_bytes: 10988,
    change_sha256: '7d8a961c2685b018802df4197aee150db424e3f7da5661ae0bfce1101e5b80c6',
    source_bytes: 10166,
    source_sha256: '4bd61aab3e4ec870a9bee2a8ff954a0dca7795231bf51412b4e240fd4d644525',
    source_line_count: 286,
  },
  header_emissions: [],
  integration_bindings: MR1579_INTEGRATION_BINDINGS,
  forbidden_fragments: MR1579_FORBIDDEN_FRAGMENTS,
};

export const QWORK_MR1579_CLAUDE_SKILL_CALL_CANONICALIZATION_CONTRACT = deepFreeze({
  ...MR1579_CONTRACT_DEFINITION,
  contract_sha256: sha256(stableJson(MR1579_CONTRACT_DEFINITION)),
});

export const QWORK_RELEASE_SOURCE_CONTRACTS = deepFreeze([
  QWORK_MR1522_CLAUDE_TURN_HEADERS_CONTRACT,
  QWORK_MR1544_CLAUDE_TURN_HEADER_BRANDING_CONTRACT,
  QWORK_MR1548_CALL_TOOL_BUDGET_CONTRACT,
  QWORK_MR1546_REJECTED_REGENERATE_CONTRACT,
  QWORK_MR1557_IMMEDIATE_REGENERATE_PROJECTION_CONTRACT,
  QWORK_MR1540_MEMORY_FEATURE_PROFILE_CONTRACT,
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
]);

function byteRecordIsExactLine(record) {
  const source = String(record?.source ?? '');
  return Boolean(source)
    && !source.includes('\n')
    && Number(record?.bytes) === Buffer.byteLength(source, 'utf8')
    && text(record?.sha256) === sha256(source);
}

function validateCurrentReleaseBindingMatch(binding, contractId) {
  const match = binding?.current_release_match;
  if (match === undefined) return;
  if (binding?.current_release_scope) {
    if (!objectHasExactKeys(match, ['match', 'value'])
      || match.match !== 'js-property-key'
      || !byteRecordIsExactLine(match.value)) {
      throw new Error(`source_contract_current_release_match_invalid:${contractId}:${binding.id}`);
    }
    return;
  }
  const exactMr1597LifecycleSuccessor = contractId
    === QWORK_MR1597_WORKER_IM_USER_IDENTITY_FORWARDING_CONTRACT_ID
    && binding?.id === 'worker_allowlist_2'
    && binding?.path === MR1597_LIFECYCLE_PATH
    && stableJson(match) === stableJson(MR1597_LIFECYCLE_CURRENT_RELEASE_MATCH)
    && match.value.source === binding.addition?.source;
  if (!exactMr1597LifecycleSuccessor) {
    throw new Error(`source_contract_current_release_match_invalid:${contractId}:${binding.id}`);
  }
}

function validateCurrentReleaseOwnerScopes(contract, contractId) {
  const bindings = Array.isArray(contract?.integration_bindings) ? contract.integration_bindings : [];
  for (const binding of bindings) {
    for (const field of ['expected_addition_count', 'expected_current_occurrence_count']) {
      if (binding?.[field] !== undefined
        && (!Number.isSafeInteger(Number(binding[field])) || Number(binding[field]) < 1)) {
        throw new Error(`source_contract_binding_expected_count_invalid:${contractId}:${binding.id}:${field}`);
      }
    }
    validateCurrentReleaseBindingMatch(binding, contractId);
  }
  const expectedIds = [...(CURRENT_RELEASE_SCOPED_BINDINGS.get(contractId) || [])];
  const observedIds = bindings
    .filter((binding) => binding?.current_release_scope)
    .map((binding) => text(binding?.id));
  if (stableJson(observedIds) !== stableJson(expectedIds)) {
    throw new Error(`source_contract_current_release_scope_set_invalid:${contractId}`);
  }
  for (const binding of bindings.filter((item) => item?.current_release_scope)) {
    const scope = binding.current_release_scope;
    const ownerScoped = scope.boundary === CURRENT_RELEASE_OWNER_SCOPE_BOUNDARY;
    const regionScoped = scope.boundary === CURRENT_RELEASE_REGION_SCOPE_BOUNDARY;
    if (scope.schema_version !== QWORK_RELEASE_SOURCE_OWNER_SCOPE_SCHEMA
      || (!ownerScoped && !regionScoped)) {
      throw new Error(`source_contract_current_release_scope_contract_invalid:${contractId}:${binding.id}`);
    }
    if (!byteRecordIsExactLine(scope.owner_start) || !/^test\('/u.test(scope.owner_start.source)) {
      throw new Error(`source_contract_current_release_scope_owner_invalid:${contractId}:${binding.id}`);
    }
    const fragments = Array.isArray(scope.required_fragments) ? scope.required_fragments : [];
    if (fragments.length < 1
      || new Set(fragments.map((fragment) => text(fragment?.id))).size !== fragments.length
      || fragments.some((fragment) => (
        !text(fragment?.id)
        || fragment?.match !== 'line'
        || !byteRecordIsExactLine(fragment?.value)
        || (regionScoped && (
          !Number.isSafeInteger(fragment?.expected_line_index)
          || fragment.expected_line_index < 1
        ))
      ))) {
      throw new Error(`source_contract_current_release_scope_fragments_invalid:${contractId}:${binding.id}`);
    }
    if (regionScoped && fragments.some((fragment, index) => (
      index > 0 && fragments[index - 1].expected_line_index >= fragment.expected_line_index
    ))) {
      throw new Error(`source_contract_current_release_scope_fragment_positions_invalid:${contractId}:${binding.id}`);
    }
    const forbiddenFragments = Array.isArray(scope.forbidden_fragments)
      ? scope.forbidden_fragments : [];
    if (new Set(forbiddenFragments.map((fragment) => text(fragment?.id))).size !== forbiddenFragments.length
      || forbiddenFragments.some((fragment) => (
        !text(fragment?.id)
        || !['line', 'js-property-key'].includes(fragment?.match)
        || !byteRecordIsExactLine(fragment?.value)
      ))
      || new Set([...fragments, ...forbiddenFragments].map((fragment) => text(fragment?.id))).size
        !== fragments.length + forbiddenFragments.length) {
      throw new Error(`source_contract_current_release_scope_forbidden_fragments_invalid:${contractId}:${binding.id}`);
    }
    if (ownerScoped && (scope.region_start !== undefined
      || scope.region_end !== undefined
      || scope.region_end_inclusive !== undefined
      || scope.forbidden_fragments !== undefined)) {
      throw new Error(`source_contract_current_release_scope_contract_invalid:${contractId}:${binding.id}`);
    }
    if (regionScoped && (
      !byteRecordIsExactLine(scope.region_start)
      || !byteRecordIsExactLine(scope.region_end)
      || scope.region_start.source === scope.region_end.source
      || (scope.region_end_inclusive !== undefined && typeof scope.region_end_inclusive !== 'boolean')
    )) {
      throw new Error(`source_contract_current_release_scope_region_invalid:${contractId}:${binding.id}`);
    }
    if (regionScoped) {
      const ownerRegionOrder = Array.isArray(scope.owner_region_order) ? scope.owner_region_order : [];
      const sources = ownerRegionOrder.map((record) => String(record?.source ?? ''));
      const startIndex = sources.indexOf(scope.region_start.source);
      const endIndex = sources.indexOf(scope.region_end.source);
      if (ownerRegionOrder.length < 2
        || ownerRegionOrder.some((record) => !byteRecordIsExactLine(record))
        || new Set(sources).size !== sources.length
        || startIndex < 0
        || endIndex <= startIndex) {
        throw new Error(`source_contract_current_release_scope_region_order_invalid:${contractId}:${binding.id}`);
      }
    }
    const bindingFragmentCount = fragments.filter((fragment) => (
      fragment.value.source === binding.addition.source
    )).length;
    if (bindingFragmentCount !== 1) {
      throw new Error(`source_contract_current_release_scope_binding_missing:${contractId}:${binding.id}`);
    }
  }
  const regionGroups = new Map();
  for (const binding of bindings.filter((item) => (
    item?.current_release_scope?.boundary === CURRENT_RELEASE_REGION_SCOPE_BOUNDARY
  ))) {
    const scope = binding.current_release_scope;
    const key = `${text(binding.path)}\0${scope.owner_start.source}`;
    if (!regionGroups.has(key)) regionGroups.set(key, []);
    regionGroups.get(key).push(scope);
  }
  for (const scopes of regionGroups.values()) {
    const orders = new Set(scopes.map((scope) => stableJson(scope.owner_region_order)));
    const declaredBoundaries = [...new Set(scopes.flatMap((scope) => (
      [scope.region_start.source, scope.region_end.source]
    )))];
    const orderedBoundaries = scopes[0].owner_region_order.map((record) => record.source);
    if (orders.size !== 1
      || stableJson([...declaredBoundaries].sort()) !== stableJson([...orderedBoundaries].sort())) {
      throw new Error(`source_contract_current_release_scope_region_set_invalid:${contractId}`);
    }
  }
}

function isAssertionRetirementContract(contract) {
  return text(contract?.contract_kind) === 'assertion-retirement';
}

function validateAssertionRetirementDefinition(contract, contractId) {
  if (contract?.source_file !== null) {
    throw new Error(`source_contract_retirement_source_file_invalid:${contractId}`);
  }
  for (const field of ['header_emissions', 'integration_bindings', 'forbidden_fragments']) {
    if (!Array.isArray(contract?.[field]) || contract[field].length !== 0) {
      throw new Error(`source_contract_retirement_${field}_invalid:${contractId}`);
    }
  }
  const retiredFiles = Array.isArray(contract?.retired_files) ? contract.retired_files : [];
  if (!retiredFiles.length
    || new Set(retiredFiles.map((file) => text(file?.path))).size !== retiredFiles.length) {
    throw new Error(`source_contract_retired_files_invalid:${contractId}`);
  }
  for (const retiredFile of retiredFiles) {
    const filePath = text(retiredFile?.path);
    if (!filePath.startsWith('test/')
      || text(retiredFile?.old_path) !== filePath
      || text(retiredFile?.new_path) !== filePath
      || retiredFile?.new_file !== false
      || retiredFile?.renamed_file !== false
      || retiredFile?.deleted_file !== true) {
      throw new Error(`source_contract_retired_file_invalid:${contractId}:${filePath || 'missing'}`);
    }
  }
  const changedPaths = Array.isArray(contract?.changed_paths) ? contract.changed_paths.map(text) : [];
  if (!Number.isSafeInteger(Number(contract?.changes_count))
    || Number(contract.changes_count) <= 0
    || changedPaths.length !== Number(contract.changes_count)
    || changedPaths.some((filePath) => !filePath)
    || new Set(changedPaths).size !== changedPaths.length
    || retiredFiles.some((file) => !changedPaths.includes(file.path))) {
    throw new Error(`source_contract_retirement_changed_paths_invalid:${contractId}`);
  }
  if (!Number.isSafeInteger(Number(contract?.mr_diff?.bytes))
    || Number(contract.mr_diff.bytes) <= 0
    || !HEX64.test(text(contract?.mr_diff?.sha256))) {
    throw new Error(`source_contract_retirement_diff_invalid:${contractId}`);
  }
  if (!Array.isArray(contract?.supersedes) || contract.supersedes.length !== 1) {
    throw new Error(`source_contract_retirement_successor_invalid:${contractId}`);
  }
}

function validateSourceContractDefinition(contract) {
  const contractId = text(contract?.contract_id);
  if (!contractId) throw new Error('source_contract_id_missing');
  if (contract?.claim_scope !== QWORK_RELEASE_SOURCE_CLAIM_SCOPE) {
    throw new Error(`source_contract_claim_scope_invalid:${contractId}`);
  }
  if (contract?.test_execution_attested !== QWORK_RELEASE_SOURCE_TEST_EXECUTION_ATTESTED) {
    throw new Error(`source_contract_test_execution_attested_invalid:${contractId}`);
  }
  if (!text(contract?.mr_iid)) throw new Error(`source_contract_mr_iid_missing:${contractId}`);
  if (!HEX40.test(text(contract?.merge_commit_sha))) {
    throw new Error(`source_contract_merge_commit_invalid:${contractId}`);
  }
  if (text(contract?.contract_kind) && !isAssertionRetirementContract(contract)) {
    throw new Error(`source_contract_kind_invalid:${contractId}`);
  }
  if (isAssertionRetirementContract(contract)) {
    validateAssertionRetirementDefinition(contract, contractId);
  } else if (!['exact-new-file', 'exact-added-lines'].includes(text(contract?.source_file?.proof_mode))) {
    throw new Error(`source_contract_proof_mode_invalid:${contractId}`);
  }
  validateCurrentReleaseOwnerScopes(contract, contractId);
  const observedHash = text(contract?.contract_sha256);
  const definition = structuredClone(contract || {});
  delete definition.contract_sha256;
  if (!HEX64.test(observedHash) || sha256(stableJson(definition)) !== observedHash) {
    throw new Error(`source_contract_definition_sha256_mismatch:${contractId}`);
  }
}

export function resolveReleaseSourceContracts(contracts = QWORK_RELEASE_SOURCE_CONTRACTS) {
  if (!Array.isArray(contracts)) throw new Error('source_contract_registry_not_array');
  const requestedIds = contracts.map((contract) => text(contract?.contract_id));
  if (requestedIds.some((id) => !id)) throw new Error('source_contract_registry_id_missing');
  if (new Set(requestedIds).size !== requestedIds.length) throw new Error('source_contract_registry_duplicate_id');

  for (const contract of contracts) validateSourceContractDefinition(contract);
  const resolved = [...QWORK_RELEASE_SOURCE_CONTRACTS];
  for (const contract of contracts) {
    const builtin = QWORK_RELEASE_SOURCE_CONTRACTS.find((item) => item.contract_id === contract.contract_id);
    if (builtin) {
      if (stableJson(contract) !== stableJson(builtin)) {
        throw new Error(`source_contract_builtin_modified:${builtin.contract_id}`);
      }
      continue;
    }
    resolved.push(contract);
  }

  const ids = resolved.map((contract) => text(contract.contract_id));
  if (new Set(ids).size !== ids.length) throw new Error('source_contract_registry_duplicate_id');
  const mrIids = resolved.map((contract) => text(contract.mr_iid));
  if (new Set(mrIids).size !== mrIids.length) throw new Error('source_contract_registry_duplicate_mr_iid');
  const mergeShas = resolved.map((contract) => text(contract.merge_commit_sha));
  if (new Set(mergeShas).size !== mergeShas.length) throw new Error('source_contract_registry_duplicate_merge_commit');
  const successorByTarget = new Map();
  for (const successor of resolved) {
    for (const declaration of Array.isArray(successor?.supersedes) ? successor.supersedes : []) {
      const targetId = text(declaration?.contract_id);
      const assertions = Array.isArray(declaration?.current_assertions)
        ? declaration.current_assertions.map(text) : [];
      const retirement = isAssertionRetirementContract(successor);
      if (!resolved.some((contract) => contract.contract_id === targetId) || targetId === successor.contract_id) {
        throw new Error(`source_contract_successor_target_invalid:${successor.contract_id}`);
      }
      const target = resolved.find((contract) => contract.contract_id === targetId);
      if (!assertions.length || assertions.some((assertion) => !assertion)
        || new Set(assertions).size !== assertions.length) {
        throw new Error(`source_contract_successor_assertions_invalid:${successor.contract_id}`);
      }
      if ((retirement && text(declaration?.disposition) !== 'retired')
        || (!retirement && text(declaration?.disposition) === 'retired')) {
        throw new Error(`source_contract_successor_disposition_invalid:${successor.contract_id}`);
      }
      for (const assertion of assertions) {
        if (assertion === 'header_emissions') {
          if (retirement) {
            throw new Error(`source_contract_retirement_assertion_invalid:${successor.contract_id}`);
          }
          if (text(target?.source_file?.path) !== text(successor?.source_file?.path)) {
            throw new Error(`source_contract_successor_source_path_mismatch:${successor.contract_id}`);
          }
          continue;
        }
        const bindingId = assertion.startsWith('integration_binding:')
          ? assertion.slice('integration_binding:'.length) : '';
        const targetBinding = target?.integration_bindings?.find((binding) => binding.id === bindingId);
        const successorBinding = successor?.integration_bindings?.find((binding) => binding.id === bindingId);
        if (!bindingId || !targetBinding || (!retirement && !successorBinding)) {
          throw new Error(`source_contract_successor_assertions_invalid:${successor.contract_id}`);
        }
        if (retirement && !text(targetBinding?.path).startsWith('test/')) {
          throw new Error(`source_contract_retirement_product_assertion:${successor.contract_id}:${bindingId}`);
        }
      }
      if (retirement) {
        const retiredPaths = new Set(successor.retired_files.map((file) => file.path));
        const retiredTargetAssertions = target.integration_bindings
          .filter((binding) => retiredPaths.has(binding.path))
          .map((binding) => `integration_binding:${binding.id}`);
        if (stableJson(assertions) !== stableJson(retiredTargetAssertions)
          || retiredTargetAssertions.length === 0
          || text(target?.source_file?.path) && retiredPaths.has(text(target.source_file.path))
          || (target.forbidden_fragments || []).some((assertion) => retiredPaths.has(text(assertion?.path)))) {
          throw new Error(`source_contract_retirement_scope_invalid:${successor.contract_id}`);
        }
      }
      if (successorByTarget.has(targetId)) throw new Error(`source_contract_successor_ambiguous:${targetId}`);
      successorByTarget.set(targetId, successor.contract_id);
    }
  }
  for (const contract of resolved) {
    const seen = new Set([contract.contract_id]);
    let cursor = contract.contract_id;
    while (successorByTarget.has(cursor)) {
      cursor = successorByTarget.get(cursor);
      if (seen.has(cursor)) throw new Error(`source_contract_successor_cycle:${contract.contract_id}`);
      seen.add(cursor);
    }
  }
  return resolved;
}

export function resolveCurrentReleaseHeaderContract(contract, {
  contracts = QWORK_RELEASE_SOURCE_CONTRACTS,
  ancestryByContractId = new Map(),
} = {}) {
  const resolved = resolveReleaseSourceContracts(contracts);
  const lineage = [contract.contract_id];
  let owner = contract;
  while (true) {
    const successors = resolved.filter((candidate) => (
      (Array.isArray(candidate?.supersedes) ? candidate.supersedes : []).some((declaration) => (
        text(declaration?.contract_id) === owner.contract_id
        && Array.isArray(declaration.current_assertions)
        && declaration.current_assertions.length > 0
      ))
      && ancestryByContractId.get(candidate.contract_id)?.verified === true
      && ancestryByContractId.get(candidate.contract_id)?.first_parent_complete === true
    ));
    if (successors.length > 1) throw new Error(`source_contract_successor_ambiguous:${owner.contract_id}`);
    if (successors.length === 0) break;
    [owner] = successors;
    lineage.push(owner.contract_id);
  }
  return { owner, lineage };
}

export function releaseSourceContractProtectedPaths(contract) {
  return [...new Set([
    text(contract?.source_file?.path),
    ...(Array.isArray(contract?.integration_bindings)
      ? contract.integration_bindings.map((binding) => text(binding?.path))
      : []),
    ...(Array.isArray(contract?.forbidden_fragments)
      ? contract.forbidden_fragments.map((assertion) => text(assertion?.path))
      : []),
  ].filter(Boolean))];
}

export function currentReleaseSourceContractProtectedPaths(contract, currentOwner = contract) {
  const retirement = text(currentOwner?.contract_id) !== text(contract?.contract_id)
    ? (Array.isArray(currentOwner?.supersedes) ? currentOwner.supersedes : [])
      .find((declaration) => (
        text(declaration?.contract_id) === text(contract?.contract_id)
        && text(declaration?.disposition) === 'retired'
      ))
    : null;
  const retiredPaths = new Set(retirement
    ? (Array.isArray(currentOwner?.retired_files) ? currentOwner.retired_files : [])
      .map((file) => text(file?.path))
      .filter(Boolean)
    : []);
  const protectedPaths = [...new Set([
    ...releaseSourceContractProtectedPaths(contract),
    ...(text(currentOwner?.contract_id) === text(contract?.contract_id)
      ? []
      : releaseSourceContractProtectedPaths(currentOwner)),
  ].filter((filePath) => !retiredPaths.has(filePath)))];
  if (text(contract?.contract_id) === QWORK_MR1597_WORKER_IM_USER_IDENTITY_FORWARDING_CONTRACT_ID
    && !retiredPaths.has(MR1597_FACADE_PATH)
    && !protectedPaths.includes(MR1597_FACADE_PATH)) {
    protectedPaths.push(MR1597_FACADE_PATH);
  }
  return protectedPaths;
}

export function currentReleaseSourceContractSuccessorBindings(contract) {
  return (Array.isArray(contract?.integration_bindings) ? contract.integration_bindings : [])
    .filter((binding) => binding?.current_release_match?.match === 'line-or-verified-successor-line')
    .map((binding) => ({
      binding_id: text(binding.id),
      successor: structuredClone(binding.current_release_match.successor),
    }));
}

export function releaseSourceContractTrigger(mr, contract) {
  const iidMatch = text(mr?.iid) === text(contract?.mr_iid);
  const mergeShaMatch = text(mr?.commit || mr?.merge_commit_sha) === text(contract?.merge_commit_sha);
  const changedPaths = Array.isArray(mr?.changed_paths)
    ? mr.changed_paths.map(text).filter(Boolean)
    : [];
  const protectedPaths = new Set(releaseSourceContractProtectedPaths(contract));
  const matchingProtectedPaths = changedPaths.filter((file) => protectedPaths.has(file));
  return {
    triggered: !isAssertionRetirementContract(contract) && (iidMatch || mergeShaMatch),
    iid_match: iidMatch,
    merge_sha_match: mergeShaMatch,
    protected_paths: [...new Set(matchingProtectedPaths)],
  };
}

export function normalizeGitLabChanges(changes = []) {
  return changes.map((change) => ({
    old_path: text(change?.old_path),
    new_path: text(change?.new_path),
    new_file: Boolean(change?.new_file),
    renamed_file: Boolean(change?.renamed_file),
    deleted_file: Boolean(change?.deleted_file),
    diff: String(change?.diff || ''),
  }));
}

export function summarizeGitLabChanges(changes = []) {
  const normalized = normalizeGitLabChanges(changes);
  const serialized = normalized.map((item) => stableJson(item)).join('\n');
  const paths = normalized.flatMap((item) => (
    item.renamed_file
      ? [item.old_path, item.new_path]
      : [item.new_path || item.old_path]
  )).filter(Boolean);
  return {
    normalized,
    paths: [...new Set(paths)],
    diff_bytes: Buffer.byteLength(serialized, 'utf8'),
    diff_sha256: sha256(serialized),
  };
}

export function reconstructGitLabNewFileSource(change) {
  if (!change?.new_file || change?.deleted_file || change?.renamed_file) {
    throw new Error('source_change_not_exact_new_file');
  }
  const diff = String(change.diff || '');
  if (!diff) throw new Error('source_diff_missing');
  const lines = diff.split('\n');
  if (lines.at(-1) === '') lines.pop();
  const sourceLines = [];
  let hunkCount = 0;
  let declaredNewLines = 0;
  let terminalNewline = true;
  for (const line of lines) {
    if (line.startsWith('@@')) {
      const match = line.match(/^@@ -0,0 \+1,(\d+) @@(?:.*)?$/u);
      if (!match || hunkCount !== 0) throw new Error('source_diff_hunk_invalid');
      hunkCount += 1;
      declaredNewLines = Number(match[1]);
      continue;
    }
    if (line.startsWith('+') && !line.startsWith('+++')) {
      sourceLines.push(line.slice(1));
      continue;
    }
    if (line === '\\ No newline at end of file') {
      terminalNewline = false;
      continue;
    }
    throw new Error('source_diff_contains_non_addition');
  }
  if (hunkCount !== 1 || declaredNewLines !== sourceLines.length) {
    throw new Error('source_diff_line_count_mismatch');
  }
  return `${sourceLines.join('\n')}${terminalNewline ? '\n' : ''}`;
}

export function reconstructGitLabAddedLinesSource(change) {
  if (change?.new_file || change?.deleted_file || change?.renamed_file) {
    throw new Error('source_change_not_exact_modified_file');
  }
  const diff = String(change?.diff || '');
  if (!diff) throw new Error('source_diff_missing');
  const lines = diff.split('\n');
  if (lines.at(-1) === '') lines.pop();
  const additions = [];
  let hunkCount = 0;
  let oldObserved = 0;
  let newObserved = 0;
  let oldDeclared = null;
  let newDeclared = null;
  let terminalNewline = true;
  const finishHunk = () => {
    if (oldDeclared === null || newDeclared === null) return;
    if (oldObserved !== oldDeclared || newObserved !== newDeclared) {
      throw new Error('source_diff_line_count_mismatch');
    }
  };
  for (const line of lines) {
    if (line.startsWith('@@')) {
      finishHunk();
      const match = line.match(/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@(?:.*)?$/u);
      if (!match) throw new Error('source_diff_hunk_invalid');
      hunkCount += 1;
      oldDeclared = match[2] === undefined ? 1 : Number(match[2]);
      newDeclared = match[4] === undefined ? 1 : Number(match[4]);
      oldObserved = 0;
      newObserved = 0;
      terminalNewline = true;
      continue;
    }
    if (oldDeclared === null || newDeclared === null) throw new Error('source_diff_content_outside_hunk');
    if (line.startsWith('+') && !line.startsWith('+++')) {
      additions.push(line.slice(1));
      newObserved += 1;
      terminalNewline = true;
      continue;
    }
    if (line.startsWith('-') && !line.startsWith('---')) {
      oldObserved += 1;
      continue;
    }
    if (line.startsWith(' ')) {
      oldObserved += 1;
      newObserved += 1;
      continue;
    }
    if (line === '\\ No newline at end of file') {
      terminalNewline = false;
      continue;
    }
    throw new Error('source_diff_line_invalid');
  }
  finishHunk();
  if (hunkCount === 0) throw new Error('source_diff_hunk_missing');
  if (additions.length === 0) throw new Error('source_diff_additions_missing');
  return `${additions.join('\n')}${terminalNewline ? '\n' : ''}`;
}

function visitJavaScriptAst(root, visitor) {
  const parents = new WeakMap();
  const visit = (node, parent = null) => {
    if (!node || typeof node !== 'object' || typeof node.type !== 'string') return;
    if (parent) parents.set(node, parent);
    visitor(node, parent, parents);
    for (const [key, value] of Object.entries(node)) {
      if (['end', 'loc', 'range', 'start', 'type'].includes(key)) continue;
      if (Array.isArray(value)) value.forEach((item) => visit(item, node));
      else if (value && typeof value.type === 'string') visit(value, node);
    }
  };
  visit(root);
  return parents;
}

function staticJavaScriptPropertyName(property) {
  if (property?.type !== 'Property' || property.computed) return null;
  if (property.key?.type === 'Identifier') return property.key.name;
  if (property.key?.type === 'Literal' && typeof property.key.value === 'string') {
    return property.key.value;
  }
  return null;
}

function staticallyResolvableJavaScriptPropertyName(property) {
  if (property?.type !== 'Property') return null;
  if (property.key?.type === 'Identifier' && !property.computed) return property.key.name;
  if (property.key?.type === 'Literal' && typeof property.key.value === 'string') {
    return property.key.value;
  }
  if (property.key?.type === 'TemplateLiteral'
    && property.key.expressions?.length === 0
    && property.key.quasis?.length === 1) {
    return property.key.quasis[0].value.cooked;
  }
  return null;
}

function javaScriptPatternNames(pattern, names = []) {
  if (!pattern || typeof pattern !== 'object') return names;
  if (pattern.type === 'Identifier') names.push(pattern.name);
  else if (pattern.type === 'RestElement') javaScriptPatternNames(pattern.argument, names);
  else if (pattern.type === 'AssignmentPattern') javaScriptPatternNames(pattern.left, names);
  else if (pattern.type === 'ArrayPattern') {
    pattern.elements?.forEach((element) => javaScriptPatternNames(element, names));
  } else if (pattern.type === 'ObjectPattern') {
    pattern.properties?.forEach((property) => {
      if (property.type === 'RestElement') javaScriptPatternNames(property.argument, names);
      else javaScriptPatternNames(property.value, names);
    });
  }
  return names;
}

function memberExpressionRootIdentifier(node) {
  let cursor = node?.type === 'ChainExpression' ? node.expression : node;
  while (cursor?.type === 'MemberExpression') {
    cursor = cursor.object?.type === 'ChainExpression' ? cursor.object.expression : cursor.object;
  }
  return cursor?.type === 'Identifier' ? cursor.name : null;
}

function staticMemberExpressionPropertyName(node) {
  if (node?.type !== 'MemberExpression') return null;
  if (!node.computed && node.property?.type === 'Identifier') return node.property.name;
  if (node.computed && node.property?.type === 'Literal' && typeof node.property.value === 'string') {
    return node.property.value;
  }
  return null;
}

function expressionMayAliasIdentifier(node, aliases) {
  if (!node || typeof node !== 'object') return false;
  if (node.type === 'Identifier') return aliases.has(node.name);
  if (node.type === 'ChainExpression' || node.type === 'AwaitExpression' || node.type === 'YieldExpression') {
    return expressionMayAliasIdentifier(node.expression || node.argument, aliases);
  }
  if (node.type === 'ConditionalExpression') {
    return expressionMayAliasIdentifier(node.consequent, aliases)
      || expressionMayAliasIdentifier(node.alternate, aliases);
  }
  if (node.type === 'LogicalExpression') {
    return expressionMayAliasIdentifier(node.left, aliases)
      || expressionMayAliasIdentifier(node.right, aliases);
  }
  if (node.type === 'SequenceExpression') {
    return expressionMayAliasIdentifier(node.expressions?.at(-1), aliases);
  }
  if (node.type === 'AssignmentExpression') {
    return expressionMayAliasIdentifier(node.right, aliases);
  }
  if (node.type === 'CallExpression'
    && node.callee?.type === 'Identifier'
    && node.callee.name === 'Object'
    && node.arguments?.length === 1) {
    return expressionMayAliasIdentifier(node.arguments[0], aliases);
  }
  return false;
}

function expressionCarriesAliasIdentifier(node, aliases) {
  if (!node || typeof node !== 'object') return false;
  if (node.type === 'Identifier') return aliases.has(node.name);
  if (node.type === 'MemberExpression') return false;
  if (node.type === 'Property') return expressionCarriesAliasIdentifier(node.value, aliases);
  if (node.type === 'SpreadElement' || node.type === 'RestElement') {
    return expressionCarriesAliasIdentifier(node.argument, aliases);
  }
  for (const [key, value] of Object.entries(node)) {
    if (['end', 'key', 'loc', 'range', 'start', 'type'].includes(key)) continue;
    if (Array.isArray(value) && value.some((item) => expressionCarriesAliasIdentifier(item, aliases))) return true;
    if (value && typeof value.type === 'string' && expressionCarriesAliasIdentifier(value, aliases)) return true;
  }
  return false;
}

function containsAliasMemberTarget(node, aliases) {
  let found = false;
  visitJavaScriptAst(node, (candidate) => {
    if (candidate.type !== 'MemberExpression') return;
    let root = candidate;
    while (root?.type === 'MemberExpression') root = root.object;
    if (root?.type === 'ChainExpression') root = root.expression;
    if (aliases.has(memberExpressionRootIdentifier(candidate))
      || expressionMayAliasIdentifier(root, aliases)
      || expressionCarriesAliasIdentifier(root, aliases)) found = true;
  });
  return found;
}

function identityPropertyObservations(objectExpression) {
  const directProperties = objectExpression?.type === 'ObjectExpression'
    ? objectExpression.properties.filter((property) => property.type === 'Property')
    : [];
  return Object.entries(MR1597_EXPECTED_IDENTITY_VALUES).map(([name, expectedValue]) => {
    const matches = directProperties.filter((property) => staticJavaScriptPropertyName(property) === name);
    const property = matches[0];
    const value = property?.value?.type === 'Literal' && typeof property.value.value === 'string'
      ? property.value.value : null;
    const verified = matches.length === 1
      && property.kind === 'init'
      && property.method === false
      && property.shorthand === false
      && value === expectedValue;
    return { name, expected_value: expectedValue, occurrence_count: matches.length, value, verified };
  });
}

function objectExpressionShapeObservation(objectExpression) {
  const objectExpressions = [];
  if (objectExpression?.type === 'ObjectExpression') {
    visitJavaScriptAst(objectExpression, (node) => {
      if (node.type === 'ObjectExpression') objectExpressions.push(node);
    });
  }
  const properties = objectExpressions.flatMap((node) => node.properties);
  const ordinary = properties.filter((property) => property.type === 'Property');
  const spreadCount = properties.filter((property) => property.type === 'SpreadElement').length;
  const computedCount = ordinary.filter((property) => property.computed).length;
  const dynamicKeyCount = ordinary.filter((property) => staticJavaScriptPropertyName(property) === null).length;
  const accessorCount = ordinary.filter((property) => property.kind !== 'init').length;
  const methodCount = ordinary.filter((property) => property.method === true).length;
  const shorthandCount = ordinary.filter((property) => property.shorthand === true).length;
  const duplicateKeyCount = objectExpressions.reduce((count, node) => {
    const names = node.properties.map(staticJavaScriptPropertyName).filter((name) => name !== null);
    return count + names.length - new Set(names).size;
  }, 0);
  return {
    property_count: properties.length,
    spread_count: spreadCount,
    computed_count: computedCount,
    dynamic_key_count: dynamicKeyCount,
    accessor_count: accessorCount,
    method_count: methodCount,
    shorthand_count: shorthandCount,
    duplicate_key_count: duplicateKeyCount,
    verified: objectExpression?.type === 'ObjectExpression'
      && spreadCount === 0
      && computedCount === 0
      && dynamicKeyCount === 0
      && accessorCount === 0
      && methodCount === 0
      && shorthandCount === 0
      && duplicateKeyCount === 0,
  };
}

function objectHasExactKeys(value, keys) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
    && stableJson(Object.keys(value).sort()) === stableJson([...keys].sort());
}

function unwrapJavaScriptChain(node) {
  return node?.type === 'ChainExpression' ? node.expression : node;
}

function isExactImportMetaUrl(node) {
  const expression = unwrapJavaScriptChain(node);
  return expression?.type === 'MemberExpression'
    && expression.computed === false
    && expression.object?.type === 'MetaProperty'
    && expression.object.meta?.name === 'import'
    && expression.object.property?.name === 'meta'
    && expression.property?.type === 'Identifier'
    && expression.property.name === 'url';
}

function isExactRequireCall(node, source) {
  const expression = unwrapJavaScriptChain(node);
  return expression?.type === 'CallExpression'
    && expression.optional !== true
    && expression.callee?.type === 'Identifier'
    && expression.callee.name === 'require'
    && expression.arguments?.length === 1
    && expression.arguments[0]?.type === 'Literal'
    && expression.arguments[0].value === source;
}

function javaScriptDeclarationRecords(program) {
  const records = [];
  visitJavaScriptAst(program, (node) => {
    if (['ImportDefaultSpecifier', 'ImportNamespaceSpecifier', 'ImportSpecifier'].includes(node.type)) {
      if (node.local?.type === 'Identifier') records.push({ name: node.local.name, node });
    } else if (node.type === 'VariableDeclarator') {
      javaScriptPatternNames(node.id).forEach((name) => records.push({ name, node }));
    } else if (['FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression'].includes(node.type)) {
      if (node.id?.type === 'Identifier') records.push({ name: node.id.name, node });
      node.params?.forEach((parameter) => {
        javaScriptPatternNames(parameter).forEach((name) => records.push({ name, node: parameter }));
      });
    } else if (['ClassDeclaration', 'ClassExpression'].includes(node.type)) {
      if (node.id?.type === 'Identifier') records.push({ name: node.id.name, node });
    } else if (node.type === 'CatchClause') {
      javaScriptPatternNames(node.param).forEach((name) => records.push({ name, node: node.param }));
    }
  });
  return records;
}

function observeMr1597TopLevelBindings(program) {
  const declarations = javaScriptDeclarationRecords(program);
  const matchesByLocal = new Map(MR1597_TOP_LEVEL_BINDING_EXPECTATIONS.map(({ local }) => [local, []]));
  for (const statement of program.body || []) {
    if (statement.type === 'ImportDeclaration' && statement.source?.type === 'Literal') {
      for (const specifier of statement.specifiers || []) {
        for (const expected of MR1597_TOP_LEVEL_BINDING_EXPECTATIONS.slice(0, 3)) {
          const imported = specifier.type === 'ImportDefaultSpecifier'
            ? 'default'
            : specifier.type === 'ImportSpecifier'
              ? (specifier.imported?.name || specifier.imported?.value)
              : '*';
          const kind = specifier.type === 'ImportDefaultSpecifier'
            ? 'import-default'
            : specifier.type === 'ImportSpecifier' ? 'import-named' : 'import-namespace';
          if (kind === expected.kind
            && statement.source.value === expected.source
            && imported === expected.imported
            && specifier.local?.name === expected.local) {
            matchesByLocal.get(expected.local).push(specifier);
          }
        }
      }
    }
    if (statement.type !== 'VariableDeclaration'
      || statement.kind !== 'const'
      || statement.declarations?.length !== 1) continue;
    const [declaration] = statement.declarations;
    if (declaration.id?.type === 'Identifier'
      && declaration.id.name === 'require'
      && declaration.init?.type === 'CallExpression'
      && declaration.init.optional !== true
      && declaration.init.callee?.type === 'Identifier'
      && declaration.init.callee.name === 'createRequire'
      && declaration.init.arguments?.length === 1
      && isExactImportMetaUrl(declaration.init.arguments[0])) {
      matchesByLocal.get('require').push(declaration);
    }
    if (objectPatternHasUniqueExactShorthandBinding(declaration.id, 'workerEnvironment')
      && isExactRequireCall(declaration.init, MR1597_TEST_FACADE_REQUIRE_PATH)) {
      matchesByLocal.get('workerEnvironment').push(declaration);
    }
  }
  const allowedDeclarationNodes = new Set();
  const rows = MR1597_TOP_LEVEL_BINDING_EXPECTATIONS.map((expected) => {
    const matches = matchesByLocal.get(expected.local);
    const declarationCount = declarations.filter(({ name }) => name === expected.local).length;
    const verified = matches.length === 1 && declarationCount === 1;
    if (verified) allowedDeclarationNodes.add(matches[0]);
    return { ...expected, count: matches.length, verified };
  });
  return { rows, allowedDeclarationNodes };
}

function expressionAliasesAnyIdentifier(node, aliases) {
  const expression = unwrapJavaScriptChain(node);
  if (!expression) return false;
  if (expression.type === 'Identifier') return aliases.has(expression.name);
  if (['AwaitExpression', 'YieldExpression'].includes(expression.type)) {
    return expressionAliasesAnyIdentifier(expression.argument, aliases);
  }
  if (expression.type === 'AssignmentExpression') {
    return expressionAliasesAnyIdentifier(expression.right, aliases);
  }
  if (expression.type === 'SequenceExpression') {
    return expressionAliasesAnyIdentifier(expression.expressions?.at(-1), aliases);
  }
  if (expression.type === 'ConditionalExpression') {
    return expressionAliasesAnyIdentifier(expression.consequent, aliases)
      || expressionAliasesAnyIdentifier(expression.alternate, aliases);
  }
  if (expression.type === 'LogicalExpression') {
    return expressionAliasesAnyIdentifier(expression.left, aliases)
      || expressionAliasesAnyIdentifier(expression.right, aliases);
  }
  if (expression.type === 'CallExpression'
    && expression.optional !== true
    && expression.callee?.type === 'Identifier'
    && expression.callee.name === 'Object'
    && expression.arguments?.length === 1) {
    return expressionAliasesAnyIdentifier(expression.arguments[0], aliases);
  }
  return false;
}

const ALIASING_ASSIGNMENT_OPERATORS = new Set(['=', '&&=', '||=', '??=']);

function bindProtectedAliasPattern(pattern, value, aliases, {
  matchesAlias = (node) => expressionAliasesAnyIdentifier(node, aliases),
} = {}) {
  let added = false;
  let indeterminate = false;
  const addName = (name) => {
    if (aliases.has(name)) return;
    aliases.add(name);
    added = true;
  };
  const taintPattern = (target) => {
    javaScriptPatternNames(target).forEach(addName);
  };
  const carriesAliasValue = (node) => {
    const expression = unwrapJavaScriptChain(node);
    if (!expression) return false;
    if (matchesAlias(expression)) return true;
    if (expression.type === 'Identifier') return aliases.has(expression.name);
    if (['AwaitExpression', 'YieldExpression'].includes(expression.type)) {
      return carriesAliasValue(expression.argument);
    }
    if (expression.type === 'AssignmentExpression') return carriesAliasValue(expression.right);
    if (expression.type === 'SequenceExpression') return carriesAliasValue(expression.expressions?.at(-1));
    if (expression.type === 'ConditionalExpression') {
      return carriesAliasValue(expression.consequent) || carriesAliasValue(expression.alternate);
    }
    if (expression.type === 'LogicalExpression') {
      return carriesAliasValue(expression.left) || carriesAliasValue(expression.right);
    }
    if (expression.type === 'MemberExpression') return carriesAliasValue(expression.object);
    if (expression.type === 'ArrayExpression') {
      return expression.elements?.some((element) => carriesAliasValue(
        element?.type === 'SpreadElement' ? element.argument : element,
      )) || false;
    }
    if (expression.type === 'ObjectExpression') {
      return expression.properties?.some((property) => carriesAliasValue(
        property.type === 'SpreadElement' ? property.argument : property.value,
      )) || false;
    }
    if (['CallExpression', 'NewExpression'].includes(expression.type)) {
      const callee = unwrapJavaScriptChain(expression.callee);
      return expression.arguments?.some((argument) => carriesAliasValue(
        argument?.type === 'SpreadElement' ? argument.argument : argument,
      )) || (callee?.type === 'MemberExpression' && carriesAliasValue(callee.object));
    }
    return false;
  };
  const carriesAlias = (expression) => matchesAlias(expression) || carriesAliasValue(expression);
  const defaultsCarryAlias = (target) => {
    let found = false;
    visitJavaScriptAst(target, (node) => {
      if (node.type === 'AssignmentPattern' && carriesAlias(node.right)) found = true;
    });
    return found;
  };
  const markIndeterminate = (target) => {
    indeterminate = true;
    taintPattern(target);
  };
  const bind = (target, source, protectedDescendant = false) => {
    if (!target) return;
    const directAlias = matchesAlias(source);
    const sourceCarriesAlias = matchesAlias(source) || carriesAliasValue(source);
    if (target.type === 'Identifier') {
      if (protectedDescendant || sourceCarriesAlias) addName(target.name);
      return;
    }
    if (target.type === 'MemberExpression') {
      if (protectedDescendant || sourceCarriesAlias) markIndeterminate(target);
      return;
    }
    if (target.type === 'AssignmentPattern') {
      bind(target.left, source, protectedDescendant);
      bind(target.left, target.right, protectedDescendant);
      return;
    }
    if (target.type === 'RestElement') {
      if (protectedDescendant || sourceCarriesAlias || defaultsCarryAlias(target)) {
        markIndeterminate(target);
      }
      return;
    }
    if (target.type === 'ArrayPattern') {
      if (protectedDescendant || directAlias) {
        taintPattern(target);
        return;
      }
      const patternCarriesAlias = defaultsCarryAlias(target);
      if (source?.type !== 'ArrayExpression') {
        if (sourceCarriesAlias || patternCarriesAlias) markIndeterminate(target);
        return;
      }
      const sourceHasSpread = source.elements?.some((element) => element?.type === 'SpreadElement');
      const shapeMismatch = sourceHasSpread || target.elements?.length !== source.elements?.length;
      if (shapeMismatch && (sourceCarriesAlias || patternCarriesAlias)) markIndeterminate(target);
      for (let index = 0; index < (target.elements?.length || 0); index += 1) {
        const element = target.elements[index];
        if (!element) continue;
        const sourceElement = source.elements?.[index];
        if (element.type === 'RestElement' || sourceElement?.type === 'SpreadElement') {
          if (sourceCarriesAlias || patternCarriesAlias) markIndeterminate(element);
          continue;
        }
        bind(element, sourceElement);
      }
      return;
    }
    if (target.type === 'ObjectPattern') {
      if (protectedDescendant || directAlias) {
        taintPattern(target);
        return;
      }
      const patternCarriesAlias = defaultsCarryAlias(target);
      if (source?.type !== 'ObjectExpression') {
        if (sourceCarriesAlias || patternCarriesAlias) markIndeterminate(target);
        return;
      }
      const sourceProperties = source.properties || [];
      const sourceNames = sourceProperties.map(staticJavaScriptPropertyName);
      const sourceShapeUncertain = sourceProperties.some((property, index) => (
        property.type !== 'Property'
          || property.kind !== 'init'
          || property.method === true
          || sourceNames[index] === null
          || sourceNames.indexOf(sourceNames[index]) !== index
      ));
      if (sourceShapeUncertain && (sourceCarriesAlias || patternCarriesAlias)) {
        markIndeterminate(target);
      }
      for (const property of target.properties || []) {
        if (property.type === 'RestElement') {
          if (sourceCarriesAlias || patternCarriesAlias) markIndeterminate(property);
          continue;
        }
        const key = staticJavaScriptPropertyName(property);
        if (key === null) {
          if (sourceCarriesAlias || defaultsCarryAlias(property.value)) markIndeterminate(property.value);
          continue;
        }
        const matches = sourceProperties.filter((candidate) => staticJavaScriptPropertyName(candidate) === key);
        if (matches.length !== 1) {
          if (sourceCarriesAlias || defaultsCarryAlias(property.value)) markIndeterminate(property.value);
          bind(property.value, undefined);
          continue;
        }
        bind(property.value, matches[0].value);
      }
    }
  };
  bind(pattern, value);
  return { added, indeterminate };
}

function mergeAliasBindingResults(results) {
  return results.reduce((merged, result) => ({
    added: merged.added || result.added,
    indeterminate: merged.indeterminate || result.indeterminate,
  }), { added: false, indeterminate: false });
}

function bindForOfAliasPattern(pattern, iterable, aliases, options = {}) {
  const source = unwrapJavaScriptChain(iterable);
  if (source?.type !== 'ArrayExpression' || source.elements?.length === 0) {
    return bindProtectedAliasPattern(pattern, source, aliases, options);
  }
  const results = source.elements.map((element) => {
    if (element?.type !== 'SpreadElement') {
      return bindProtectedAliasPattern(pattern, element, aliases, options);
    }
    const result = bindProtectedAliasPattern(pattern, element.argument, aliases, options);
    return {
      added: result.added,
      indeterminate: result.indeterminate || result.added,
    };
  });
  return mergeAliasBindingResults(results);
}

function bindAliasFlowNode(node, aliases, options = {}) {
  if (node.type === 'VariableDeclarator') {
    return bindProtectedAliasPattern(node.id, node.init, aliases, options);
  }
  if (node.type === 'AssignmentExpression' && ALIASING_ASSIGNMENT_OPERATORS.has(node.operator)) {
    return bindProtectedAliasPattern(node.left, node.right, aliases, options);
  }
  if (node.type === 'ForOfStatement') {
    const target = node.left?.type === 'VariableDeclaration'
      ? node.left.declarations?.[0]?.id : node.left;
    return bindForOfAliasPattern(target, node.right, aliases, options);
  }
  return { added: false, indeterminate: false };
}

const BUILTIN_INDIRECT_WRITE_OPERATIONS = new Map([
  ['Object', new Set(['assign', 'defineProperties', 'defineProperty', 'setPrototypeOf'])],
  ['Reflect', new Set(['defineProperty', 'deleteProperty', 'set', 'setPrototypeOf'])],
]);

function expressionMatchesBuiltinOperation(node, family, operation, objectAliases, operationAliases) {
  const expression = unwrapJavaScriptChain(node);
  if (!expression) return false;
  if (expression.type === 'Identifier') return operationAliases.has(expression.name);
  if (['AwaitExpression', 'YieldExpression'].includes(expression.type)) {
    return expressionMatchesBuiltinOperation(
      expression.argument, family, operation, objectAliases, operationAliases,
    );
  }
  if (expression.type === 'AssignmentExpression') {
    return expressionMatchesBuiltinOperation(
      expression.right, family, operation, objectAliases, operationAliases,
    );
  }
  if (expression.type === 'SequenceExpression') {
    return expressionMatchesBuiltinOperation(
      expression.expressions?.at(-1), family, operation, objectAliases, operationAliases,
    );
  }
  if (expression.type === 'ConditionalExpression') {
    return expressionMatchesBuiltinOperation(
      expression.consequent, family, operation, objectAliases, operationAliases,
    ) || expressionMatchesBuiltinOperation(
      expression.alternate, family, operation, objectAliases, operationAliases,
    );
  }
  if (expression.type === 'LogicalExpression') {
    return expressionMatchesBuiltinOperation(
      expression.left, family, operation, objectAliases, operationAliases,
    ) || expressionMatchesBuiltinOperation(
      expression.right, family, operation, objectAliases, operationAliases,
    );
  }
  if (expression.type === 'MemberExpression') {
    const property = staticMemberExpressionPropertyName(expression);
    return expressionAliasesAnyIdentifier(expression.object, objectAliases)
      && (property === operation || property === null);
  }
  if (expression.type === 'CallExpression') {
    const callee = unwrapJavaScriptChain(expression.callee);
    return callee?.type === 'MemberExpression'
      && staticMemberExpressionPropertyName(callee) === 'bind'
      && expressionMatchesBuiltinOperation(
        callee.object, family, operation, objectAliases, operationAliases,
      );
  }
  return false;
}

function observeBuiltinIndirectWriteAliases(nodes) {
  const objectAliases = new Map([...BUILTIN_INDIRECT_WRITE_OPERATIONS].map(([family]) => (
    [family, new Set([family])]
  )));
  const operationAliases = new Map();
  for (const [family, operations] of BUILTIN_INDIRECT_WRITE_OPERATIONS) {
    for (const operation of operations) operationAliases.set(`${family}.${operation}`, new Set());
  }
  const addPatternNames = (pattern, aliases) => {
    let added = false;
    for (const name of javaScriptPatternNames(pattern)) {
      if (aliases.has(name)) continue;
      aliases.add(name);
      added = true;
    }
    return added;
  };
  const bindObjectMemberPattern = (pattern, value, family) => {
    const source = unwrapJavaScriptChain(value);
    let added = false;
    if (pattern?.type === 'AssignmentPattern') {
      return bindObjectMemberPattern(pattern.left, source, family)
        || bindObjectMemberPattern(pattern.left, pattern.right, family);
    }
    if (pattern?.type === 'ArrayPattern' && source?.type === 'ArrayExpression') {
      pattern.elements?.forEach((element, index) => {
        const sourceElement = source.elements?.[index];
        added = bindObjectMemberPattern(
          element,
          sourceElement?.type === 'SpreadElement' ? sourceElement.argument : sourceElement,
          family,
        ) || added;
      });
      return added;
    }
    if (pattern?.type === 'ObjectPattern' && source?.type === 'ObjectExpression') {
      for (const property of pattern.properties || []) {
        if (property.type === 'RestElement') continue;
        const key = staticJavaScriptPropertyName(property);
        const match = source.properties?.find((candidate) => staticJavaScriptPropertyName(candidate) === key);
        added = bindObjectMemberPattern(property.value, match?.value, family) || added;
      }
      return added;
    }
    if (pattern?.type !== 'ObjectPattern'
      || !expressionAliasesAnyIdentifier(source, objectAliases.get(family))) return false;
    for (const property of pattern.properties || []) {
      const propertyName = property.type === 'RestElement' ? null : staticJavaScriptPropertyName(property);
      const target = property.type === 'RestElement' ? property.argument : property.value;
      const operations = propertyName !== null
        && BUILTIN_INDIRECT_WRITE_OPERATIONS.get(family).has(propertyName)
        ? [propertyName] : [...BUILTIN_INDIRECT_WRITE_OPERATIONS.get(family)];
      for (const operation of operations) {
        added = addPatternNames(target, operationAliases.get(`${family}.${operation}`)) || added;
      }
    }
    return added;
  };
  let changed = true;
  while (changed) {
    changed = false;
    for (const node of nodes) {
      for (const [family, aliases] of objectAliases) {
        const binding = bindAliasFlowNode(node, aliases);
        changed = binding.added || changed;
        if (node.type === 'VariableDeclarator') {
          changed = bindObjectMemberPattern(node.id, node.init, family) || changed;
        } else if (node.type === 'AssignmentExpression'
          && ALIASING_ASSIGNMENT_OPERATORS.has(node.operator)) {
          changed = bindObjectMemberPattern(node.left, node.right, family) || changed;
        } else if (node.type === 'ForOfStatement') {
          const target = node.left?.type === 'VariableDeclaration'
            ? node.left.declarations?.[0]?.id : node.left;
          const iterable = unwrapJavaScriptChain(node.right);
          const values = iterable?.type === 'ArrayExpression'
            ? iterable.elements || [] : [iterable];
          for (const value of values) {
            changed = bindObjectMemberPattern(
              target, value?.type === 'SpreadElement' ? value.argument : value, family,
            ) || changed;
          }
        }
        for (const operation of BUILTIN_INDIRECT_WRITE_OPERATIONS.get(family)) {
          const aliasesForOperation = operationAliases.get(`${family}.${operation}`);
          const operationBinding = bindAliasFlowNode(node, aliasesForOperation, {
            matchesAlias: (value) => expressionMatchesBuiltinOperation(
              value, family, operation, aliases, aliasesForOperation,
            ),
          });
          changed = operationBinding.added || changed;
        }
      }
    }
  }
  const resolve = (callee) => {
    const matches = [];
    for (const [family, operations] of BUILTIN_INDIRECT_WRITE_OPERATIONS) {
      for (const operation of operations) {
        if (expressionMatchesBuiltinOperation(
          callee,
          family,
          operation,
          objectAliases.get(family),
          operationAliases.get(`${family}.${operation}`),
        )) matches.push({ family, operation });
      }
    }
    return matches;
  };
  const resolveInvocation = (node) => {
    const callee = unwrapJavaScriptChain(node?.callee);
    const invocation = callee?.type === 'MemberExpression'
      && ['call', 'apply'].includes(staticMemberExpressionPropertyName(callee))
      ? staticMemberExpressionPropertyName(callee) : 'direct';
    const operations = resolve(invocation === 'direct' ? callee : callee.object);
    if (operations.length === 0) {
      return { operations, invocation, forwardedArguments: [], targetIndeterminate: false };
    }
    if (invocation === 'apply') {
      const argumentList = unwrapJavaScriptChain(node.arguments?.[1]);
      if (argumentList?.type !== 'ArrayExpression') {
        return { operations, invocation, forwardedArguments: [], targetIndeterminate: true };
      }
      const forwardedArguments = argumentList.elements || [];
      return {
        operations,
        invocation,
        forwardedArguments,
        targetIndeterminate: forwardedArguments[0]?.type === 'SpreadElement',
      };
    }
    const forwardedArguments = invocation === 'call'
      ? (node.arguments || []).slice(1) : (node.arguments || []);
    return {
      operations,
      invocation,
      forwardedArguments,
      targetIndeterminate: forwardedArguments[0]?.type === 'SpreadElement',
    };
  };
  return { objectAliases, operationAliases, resolve, resolveInvocation };
}

function observeProtectedBindingViolations(program, {
  protectedNames,
  allowedDeclarationNodes = new Set(),
  allowedWriteNodes = new Set(),
  allowedIndirectNodes = new Set(),
} = {}) {
  const aliases = new Set(protectedNames);
  const violations = new Map();
  const record = (node, kind) => violations.set(`${node?.start ?? -1}:${node?.end ?? -1}:${kind}`, kind);
  let changed = true;
  const nodes = [];
  visitJavaScriptAst(program, (node) => nodes.push(node));
  const builtinWrites = observeBuiltinIndirectWriteAliases(nodes);
  while (changed) {
    changed = false;
    for (const node of nodes) {
      if (allowedDeclarationNodes.has(node) || allowedWriteNodes.has(node)) continue;
      const binding = bindAliasFlowNode(node, aliases);
      if (binding.added) changed = true;
      if (binding.indeterminate) record(node, 'indeterminate-alias-pattern');
    }
  }
  for (const { name, node } of javaScriptDeclarationRecords(program)) {
    if (protectedNames.has(name) && !allowedDeclarationNodes.has(node)) {
      record(node, 'duplicate-or-shadow-declaration');
    }
  }
  for (const node of nodes) {
    if (node.type === 'AssignmentExpression') {
      if (javaScriptPatternNames(node.left).some((name) => protectedNames.has(name))) {
        record(node, 'identifier-write');
      }
      if (containsAliasMemberTarget(node.left, aliases) && !allowedWriteNodes.has(node)) {
        record(node, 'member-write');
      }
    } else if (node.type === 'UpdateExpression') {
      if (node.argument?.type === 'Identifier' && protectedNames.has(node.argument.name)) {
        record(node, 'identifier-write');
      }
      if (containsAliasMemberTarget(node.argument, aliases)) record(node, 'member-write');
    } else if (node.type === 'UnaryExpression' && node.operator === 'delete') {
      if (node.argument?.type === 'Identifier' && protectedNames.has(node.argument.name)) {
        record(node, 'identifier-write');
      }
      if (containsAliasMemberTarget(node.argument, aliases)) record(node, 'member-write');
    } else if (['ForInStatement', 'ForOfStatement'].includes(node.type)) {
      const target = node.left?.type === 'VariableDeclaration' ? node.left.declarations?.[0]?.id : node.left;
      if (javaScriptPatternNames(target).some((name) => protectedNames.has(name))) {
        record(node, 'identifier-write');
      }
      if (containsAliasMemberTarget(target, aliases)) record(node, 'member-write');
    }
    if (node.type === 'CallExpression') {
      const invocation = builtinWrites.resolveInvocation(node);
      const { operations } = invocation;
      if (operations.length > 0
        && (invocation.targetIndeterminate
          || expressionAliasesAnyIdentifier(invocation.forwardedArguments[0], aliases))
        && !allowedIndirectNodes.has(node)) {
        record(node, operations.length > 1
          ? 'dynamic-indirect-member-write' : 'indirect-member-write');
      }
    }
  }
  const kinds = [...new Set(violations.values())].sort();
  return { count: violations.size, kinds };
}

function isModuleExportsMember(node, moduleAliases = new Set(['module'])) {
  const expression = unwrapJavaScriptChain(node);
  return expression?.type === 'MemberExpression'
    && expression.object?.type === 'Identifier'
    && moduleAliases.has(expression.object.name)
    && staticMemberExpressionPropertyName(expression) === 'exports';
}

function isDynamicModuleMember(node, moduleAliases = new Set(['module'])) {
  const expression = unwrapJavaScriptChain(node);
  return expression?.type === 'MemberExpression'
    && expression.object?.type === 'Identifier'
    && moduleAliases.has(expression.object.name)
    && staticMemberExpressionPropertyName(expression) === null;
}

function topLevelModuleExportsAssignments(program) {
  return (program?.body || []).flatMap((statement) => {
    const expression = statement.type === 'ExpressionStatement' ? statement.expression : null;
    return expression?.type === 'AssignmentExpression'
      && expression.operator === '='
      && isModuleExportsMember(expression.left)
      && expression.right?.type === 'ObjectExpression' ? [expression] : [];
  });
}

function objectHasExactShorthandProperty(objectExpression, name) {
  if (objectExpression?.type !== 'ObjectExpression') return false;
  if (objectExpression.properties.some((property) => (
    property.type === 'SpreadElement'
      || (property.type === 'Property'
        && property.computed
        && staticallyResolvableJavaScriptPropertyName(property) === null)
  ))) return false;
  const matches = objectExpression.properties.filter((property) => (
    property.type === 'Property'
      && staticallyResolvableJavaScriptPropertyName(property) === name
  ));
  return matches.length === 1
    && matches[0].computed === false
    && matches[0].kind === 'init'
    && matches[0].method === false
    && matches[0].shorthand === true
    && matches[0].key?.type === 'Identifier'
    && matches[0].key.name === name
    && matches[0].value?.type === 'Identifier'
    && matches[0].value.name === name;
}

function objectPatternHasUniqueExactShorthandBinding(pattern, name) {
  if (pattern?.type !== 'ObjectPattern') return false;
  if (pattern.properties.some((property) => (
    property.type === 'RestElement'
      || (property.type === 'Property'
        && property.computed
        && staticallyResolvableJavaScriptPropertyName(property) === null)
  ))) return false;
  const matches = pattern.properties.filter((property) => (
      property.type === 'Property'
      && staticallyResolvableJavaScriptPropertyName(property) === name
  ));
  return matches.length === 1
    && matches[0].computed === false
    && matches[0].kind === 'init'
    && matches[0].method === false
    && matches[0].shorthand === true
    && matches[0].key?.type === 'Identifier'
    && matches[0].key.name === name
    && matches[0].value?.type === 'Identifier'
    && matches[0].value.name === name;
}

function exactStaticRequireSource(node) {
  const expression = unwrapJavaScriptChain(node);
  return expression?.type === 'CallExpression'
    && expression.optional !== true
    && expression.callee?.type === 'Identifier'
    && expression.callee.name === 'require'
    && expression.arguments?.length === 1
    && expression.arguments[0]?.type === 'Literal'
    && typeof expression.arguments[0].value === 'string'
    ? expression.arguments[0].value : null;
}

function isObjectAssignToExports(node) {
  const call = unwrapJavaScriptChain(node);
  const callee = unwrapJavaScriptChain(call?.callee);
  return call?.type === 'CallExpression'
    && call.optional !== true
    && callee?.type === 'MemberExpression'
    && callee.computed === false
    && callee.object?.type === 'Identifier'
    && callee.object.name === 'Object'
    && callee.property?.type === 'Identifier'
    && callee.property.name === 'assign'
    && call.arguments?.[0]?.type === 'Identifier'
    && call.arguments[0].name === 'exports';
}

function facadeForwardSources(call) {
  if (!isObjectAssignToExports(call) || call.arguments.length < 2) return null;
  const sources = call.arguments.slice(1).map(exactStaticRequireSource);
  return sources.every((source) => typeof source === 'string') ? sources : null;
}

function expressionAliasesFacadeExports(node, aliases, moduleAliases = new Set(['module'])) {
  const expression = unwrapJavaScriptChain(node);
  if (!expression) return false;
  if (isModuleExportsMember(expression, moduleAliases)) return true;
  if (isDynamicModuleMember(expression, moduleAliases)) return true;
  if (expression.type === 'Identifier') return aliases.has(expression.name);
  if (['AwaitExpression', 'YieldExpression'].includes(expression.type)) {
    return expressionAliasesFacadeExports(expression.argument, aliases, moduleAliases);
  }
  if (expression.type === 'AssignmentExpression') {
    return expressionAliasesFacadeExports(expression.right, aliases, moduleAliases);
  }
  if (expression.type === 'SequenceExpression') {
    return expressionAliasesFacadeExports(expression.expressions?.at(-1), aliases, moduleAliases);
  }
  if (expression.type === 'ConditionalExpression') {
    return expressionAliasesFacadeExports(expression.consequent, aliases, moduleAliases)
      || expressionAliasesFacadeExports(expression.alternate, aliases, moduleAliases);
  }
  if (expression.type === 'LogicalExpression') {
    return expressionAliasesFacadeExports(expression.left, aliases, moduleAliases)
      || expressionAliasesFacadeExports(expression.right, aliases, moduleAliases);
  }
  if (expression.type === 'MemberExpression') {
    return expressionAliasesFacadeExports(expression.object, aliases, moduleAliases);
  }
  if (expression.type === 'ArrayExpression') {
    return expression.elements?.some((element) => expressionAliasesFacadeExports(
      element?.type === 'SpreadElement' ? element.argument : element,
      aliases,
      moduleAliases,
    )) || false;
  }
  if (expression.type === 'ObjectExpression') {
    return expression.properties?.some((property) => expressionAliasesFacadeExports(
      property.type === 'SpreadElement' ? property.argument : property.value,
      aliases,
      moduleAliases,
    )) || false;
  }
  if (expression.type === 'CallExpression'
    && expression.optional !== true
    && expression.callee?.type === 'Identifier'
    && expression.callee.name === 'Object'
    && expression.arguments?.length === 1) {
    return expressionAliasesFacadeExports(expression.arguments[0], aliases, moduleAliases);
  }
  if (expression.type === 'CallExpression') {
    return expressionAliasesFacadeExports(expression.callee, aliases, moduleAliases);
  }
  return false;
}

function facadeExportMemberPath(member, aliases, moduleAliases) {
  let cursor = unwrapJavaScriptChain(member);
  const properties = [];
  while (cursor?.type === 'MemberExpression') {
    if (isModuleExportsMember(cursor, moduleAliases)) return properties;
    if (isDynamicModuleMember(cursor, moduleAliases)) return [null, ...properties];
    properties.unshift(staticMemberExpressionPropertyName(cursor));
    cursor = unwrapJavaScriptChain(cursor.object);
  }
  if (expressionAliasesFacadeExports(cursor, aliases, moduleAliases)) return properties;
  if (cursor?.type !== 'Identifier' || !aliases.has(cursor.name)) return null;
  return properties;
}

function facadeTargetViolationKind(target, aliases, moduleAliases) {
  const expression = unwrapJavaScriptChain(target);
  if (!expression || typeof expression !== 'object') return '';
  if (expression.type === 'Identifier' && expression.name === 'exports') {
    return 'exports-identifier-write';
  }
  if (expression.type === 'MemberExpression') {
    const properties = facadeExportMemberPath(expression, aliases, moduleAliases);
    if (!properties) return '';
    if (properties.some((property) => property === null)) return 'dynamic-export-member-write';
    if (properties.length === 0) return 'module-exports-replacement';
    return properties.includes('workerEnvironment')
      ? 'worker-environment-export-write' : 'export-member-write';
  }
  if (expression.type === 'RestElement') {
    return facadeTargetViolationKind(expression.argument, aliases, moduleAliases);
  }
  if (expression.type === 'AssignmentPattern') {
    return facadeTargetViolationKind(expression.left, aliases, moduleAliases);
  }
  if (expression.type === 'ArrayPattern') {
    return expression.elements?.map((item) => (
      facadeTargetViolationKind(item, aliases, moduleAliases)
    )).find(Boolean) || '';
  }
  if (expression.type === 'ObjectPattern') {
    return expression.properties?.map((property) => facadeTargetViolationKind(
      property.type === 'RestElement' ? property.argument : property.value,
      aliases,
      moduleAliases,
    )).find(Boolean) || '';
  }
  return '';
}

function facadeAssignmentValueEscapesProtectedReceiver(value) {
  let escaped = false;
  visitJavaScriptAst(value, (node, parent) => {
    if (escaped) return;
    if (node.type === 'ThisExpression') {
      escaped = true;
      return;
    }
    if (node.type === 'MemberExpression') {
      const property = staticMemberExpressionPropertyName(node);
      if (node.computed || property === 'workerEnvironment') escaped = true;
      return;
    }
    if (node.type === 'Property'
      && staticallyResolvableJavaScriptPropertyName(node) === 'workerEnvironment') {
      escaped = true;
      return;
    }
    if (node.type !== 'Identifier'
      || !['arguments', 'exports', 'module', 'workerEnvironment'].includes(node.name)) return;
    const staticMemberProperty = parent?.type === 'MemberExpression'
      && parent.property === node
      && parent.computed === false;
    const staticObjectKey = parent?.type === 'Property'
      && parent.key === node
      && parent.computed === false
      && parent.shorthand !== true;
    if (!staticMemberProperty && !staticObjectKey) escaped = true;
  });
  return escaped;
}

function isAllowedFacadeNamedExportAssignment(node) {
  const left = unwrapJavaScriptChain(node?.left);
  return node?.type === 'AssignmentExpression'
    && node.operator === '='
    && left?.type === 'MemberExpression'
    && left.computed === false
    && left.object?.type === 'Identifier'
    && left.object.name === 'exports'
    && left.property?.type === 'Identifier'
    && !['__proto__', 'constructor', 'prototype', 'workerEnvironment'].includes(left.property.name)
    && !facadeAssignmentValueEscapesProtectedReceiver(node.right);
}

function bindFacadeExportsFromModulePattern(pattern, value, moduleAliases, exportAliases) {
  const source = unwrapJavaScriptChain(value);
  let added = false;
  let indeterminate = false;
  const addTarget = (target) => {
    for (const name of javaScriptPatternNames(target)) {
      if (exportAliases.has(name)) continue;
      exportAliases.add(name);
      added = true;
    }
  };
  const bind = (target, currentSource) => {
    const current = unwrapJavaScriptChain(currentSource);
    if (!target) return;
    if (target.type === 'AssignmentPattern') {
      bind(target.left, current);
      bind(target.left, target.right);
      return;
    }
    if (target.type === 'ArrayPattern' && current?.type === 'ArrayExpression') {
      target.elements?.forEach((element, index) => {
        const currentElement = current.elements?.[index];
        bind(element, currentElement?.type === 'SpreadElement' ? currentElement.argument : currentElement);
      });
      return;
    }
    if (target.type === 'ObjectPattern' && current?.type === 'ObjectExpression') {
      for (const property of target.properties || []) {
        if (property.type === 'RestElement') continue;
        const key = staticJavaScriptPropertyName(property);
        const matches = current.properties?.filter((candidate) => (
          staticJavaScriptPropertyName(candidate) === key
        )) || [];
        if (matches.length === 1) bind(property.value, matches[0].value);
      }
      return;
    }
    if (target.type !== 'ObjectPattern'
      || !expressionAliasesAnyIdentifier(current, moduleAliases)) return;
    for (const property of target.properties || []) {
      const targetPattern = property.type === 'RestElement' ? property.argument : property.value;
      const propertyName = property.type === 'RestElement' ? null : staticJavaScriptPropertyName(property);
      if (propertyName === 'exports') addTarget(targetPattern);
      else if (propertyName === null) {
        addTarget(targetPattern);
        indeterminate = true;
      }
    }
  };
  bind(pattern, source);
  return { added, indeterminate };
}

function observeMr1597FacadeViolations(program, facadeForwards) {
  const protectedGlobals = observeProtectedBindingViolations(program, {
    protectedNames: new Set(['Object', 'Reflect', 'require']),
  });
  const nodes = [];
  visitJavaScriptAst(program, (node) => nodes.push(node));
  const aliases = new Set(['exports']);
  const moduleAliases = new Set(['module']);
  const violations = new Map();
  const record = (node, kind) => violations.set(`${node?.start ?? -1}:${node?.end ?? -1}:${kind}`, kind);
  let changed = true;
  while (changed) {
    changed = false;
    for (const node of nodes) {
      const moduleBinding = bindAliasFlowNode(node, moduleAliases);
      const exportBinding = bindAliasFlowNode(node, aliases, {
        matchesAlias: (value) => expressionAliasesFacadeExports(value, aliases, moduleAliases),
      });
      if (moduleBinding.added) record(node, 'module-alias-created');
      if (exportBinding.added) record(node, 'export-alias-created');
      changed = moduleBinding.added || exportBinding.added || changed;
      if (exportBinding.indeterminate) record(node, 'indeterminate-export-alias-pattern');
      const bindModulePattern = (target, value) => {
        const result = bindFacadeExportsFromModulePattern(target, value, moduleAliases, aliases);
        if (result.added) record(node, 'export-alias-created');
        changed = result.added || changed;
        if (result.indeterminate) record(node, 'indeterminate-export-alias-pattern');
      };
      if (node.type === 'VariableDeclarator') bindModulePattern(node.id, node.init);
      else if (node.type === 'AssignmentExpression'
        && ALIASING_ASSIGNMENT_OPERATORS.has(node.operator)) bindModulePattern(node.left, node.right);
      else if (node.type === 'ForOfStatement') {
        const target = node.left?.type === 'VariableDeclaration'
          ? node.left.declarations?.[0]?.id : node.left;
        const iterable = unwrapJavaScriptChain(node.right);
        if (iterable?.type === 'ArrayExpression') {
          for (const element of iterable.elements || []) {
            bindModulePattern(target, element?.type === 'SpreadElement' ? element.argument : element);
          }
        } else {
          bindModulePattern(target, iterable);
        }
      }
    }
  }
  const builtinWrites = observeBuiltinIndirectWriteAliases(nodes);
  const allowedNamedExportAssignments = new Set((program.body || [])
    .filter((statement) => statement?.type === 'ExpressionStatement'
      && isAllowedFacadeNamedExportAssignment(statement.expression))
    .map((statement) => statement.expression));
  for (const { name, node } of javaScriptDeclarationRecords(program)) {
    if (name === 'exports' || name === 'module') record(node, `${name}-shadow-declaration`);
  }
  const allowedFacadeCalls = facadeForwards.length === 1 ? new Set(facadeForwards) : new Set();
  for (const node of nodes) {
    if (node.type === 'ThisExpression') record(node, 'commonjs-this-reference');
    if (node.type === 'Identifier' && node.name === 'arguments') {
      record(node, 'commonjs-arguments-reference');
    }
    if (node.type === 'AssignmentExpression') {
      if (javaScriptPatternNames(node.left).includes('exports')) record(node, 'exports-identifier-write');
      const kind = facadeTargetViolationKind(node.left, aliases, moduleAliases);
      if (kind && !allowedNamedExportAssignments.has(node)) record(node, kind);
      if (isModuleExportsMember(node.left, moduleAliases)) record(node, 'module-exports-replacement');
    } else if (node.type === 'UpdateExpression') {
      if (node.argument?.type === 'Identifier' && node.argument.name === 'exports') {
        record(node, 'exports-identifier-write');
      }
      const kind = facadeTargetViolationKind(node.argument, aliases, moduleAliases);
      if (kind) record(node, kind);
      if (isModuleExportsMember(node.argument, moduleAliases)) record(node, 'module-exports-replacement');
    } else if (node.type === 'UnaryExpression' && node.operator === 'delete') {
      if (node.argument?.type === 'Identifier' && node.argument.name === 'exports') {
        record(node, 'exports-identifier-write');
      }
      const kind = facadeTargetViolationKind(node.argument, aliases, moduleAliases);
      if (kind) record(node, kind);
      if (isModuleExportsMember(node.argument, moduleAliases)) record(node, 'module-exports-replacement');
    } else if (['ForInStatement', 'ForOfStatement'].includes(node.type)) {
      const target = node.left?.type === 'VariableDeclaration' ? node.left.declarations?.[0]?.id : node.left;
      if (javaScriptPatternNames(target).includes('exports')) record(node, 'exports-identifier-write');
      const kind = facadeTargetViolationKind(target, aliases, moduleAliases);
      if (kind) record(node, kind);
    }
    if (node.type !== 'CallExpression') continue;
    if (isObjectAssignToExports(node)) {
      if (!allowedFacadeCalls.has(node)) record(node, 'facade-object-assign-outside-contract');
      continue;
    }
    const invocation = builtinWrites.resolveInvocation(node);
    const { operations } = invocation;
    if (operations.length === 0) continue;
    if (invocation.targetIndeterminate) {
      record(node, 'dynamic-indirect-export-write');
      continue;
    }
    const operationArguments = invocation.forwardedArguments;
    const targetsExports = expressionAliasesFacadeExports(operationArguments[0], aliases, moduleAliases);
    const targetsModule = expressionAliasesAnyIdentifier(operationArguments[0], moduleAliases);
    if (!targetsExports && !targetsModule) continue;
    const operationNames = new Set(operations.map(({ operation }) => operation));
    if (targetsExports && operationNames.has('assign')) {
      record(node, 'facade-object-assign-outside-contract');
      continue;
    }
    if (targetsExports && operationNames.has('setPrototypeOf')) {
      record(node, 'export-prototype-write');
      continue;
    }
    if (targetsModule && (operationNames.has('assign') || operationNames.has('setPrototypeOf'))) {
      record(node, 'module-indirect-export-write');
      continue;
    }
    if (operationNames.has('defineProperties')) {
      const descriptors = operationArguments[1];
      const properties = descriptors?.type === 'ObjectExpression' ? descriptors.properties || [] : [];
      const names = properties.map(staticallyResolvableJavaScriptPropertyName);
      if (descriptors?.type !== 'ObjectExpression'
        || properties.some((property) => property.type !== 'Property')
        || names.includes(null)) {
        record(node, 'dynamic-indirect-export-write');
      } else if (targetsExports || names.includes(targetsModule ? 'exports' : 'workerEnvironment')) {
        record(node, 'worker-environment-indirect-export-write');
      }
      continue;
    }
    if ([...operationNames].some((operation) => (
      ['defineProperty', 'set', 'deleteProperty'].includes(operation)
    ))) {
      const property = operationArguments[1];
      const propertyName = property?.type === 'Literal' && typeof property.value === 'string'
        ? property.value
        : property?.type === 'TemplateLiteral'
          && property.expressions?.length === 0
          && property.quasis?.length === 1
          ? property.quasis[0].value.cooked : null;
      if (propertyName === null) record(node, 'dynamic-indirect-export-write');
      else if (targetsExports || propertyName === (targetsModule ? 'exports' : 'workerEnvironment')) {
        record(node, 'worker-environment-indirect-export-write');
      }
    }
  }
  return {
    count: protectedGlobals.count + violations.size,
    kinds: [...new Set([...protectedGlobals.kinds, ...violations.values()])].sort(),
  };
}

function exactMr1597LifecycleAllowlistDeclarators(program) {
  return (program?.body || []).flatMap((statement) => {
    if (statement.type !== 'VariableDeclaration'
      || statement.kind !== 'const'
      || statement.declarations?.length !== 1) return [];
    const [declaration] = statement.declarations;
    const initializer = unwrapJavaScriptChain(declaration.init);
    if (declaration.id?.type !== 'Identifier'
      || declaration.id.name !== 'WORKER_ENV_ALLOWLIST'
      || initializer?.type !== 'Literal'
      || !initializer.regex
      || typeof initializer.raw !== 'string') return [];
    const sourceLine = `const WORKER_ENV_ALLOWLIST = ${initializer.raw};`;
    return [MR1597_ALLOWLIST_LINE, MR1597_LIFECYCLE_SUCCESSOR_ALLOWLIST_LINE].includes(sourceLine)
      ? [declaration] : [];
  });
}

function mr1597LifecycleSourceEntriesCall(node) {
  const expression = unwrapJavaScriptChain(node);
  const callee = unwrapJavaScriptChain(expression?.callee);
  const source = unwrapJavaScriptChain(expression?.arguments?.[0]);
  return expression?.type === 'CallExpression'
    && expression.optional !== true
    && expression.arguments?.length === 1
    && callee?.type === 'MemberExpression'
    && callee.computed === false
    && callee.object?.type === 'Identifier'
    && callee.object.name === 'Object'
    && callee.property?.type === 'Identifier'
    && callee.property.name === 'entries'
    && source?.type === 'LogicalExpression'
    && source.operator === '||'
    && source.left?.type === 'Identifier'
    && source.left.name === 'source'
    && source.right?.type === 'ObjectExpression'
    && source.right.properties?.length === 0;
}

function mr1597LifecycleNormalizedName(node) {
  const expression = unwrapJavaScriptChain(node);
  const callee = unwrapJavaScriptChain(expression?.callee);
  const stringCall = unwrapJavaScriptChain(callee?.object);
  const source = unwrapJavaScriptChain(stringCall?.arguments?.[0]);
  return expression?.type === 'CallExpression'
    && expression.optional !== true
    && expression.arguments?.length === 0
    && callee?.type === 'MemberExpression'
    && callee.computed === false
    && callee.property?.type === 'Identifier'
    && callee.property.name === 'trim'
    && stringCall?.type === 'CallExpression'
    && stringCall.optional !== true
    && stringCall.callee?.type === 'Identifier'
    && stringCall.callee.name === 'String'
    && stringCall.arguments?.length === 1
    && source?.type === 'LogicalExpression'
    && source.operator === '||'
    && source.left?.type === 'Identifier'
    && source.left.name === 'key'
    && source.right?.type === 'Literal'
    && source.right.value === '';
}

function mr1597LifecycleAllowlistGuard(statement) {
  const test = unwrapJavaScriptChain(statement?.test);
  const call = unwrapJavaScriptChain(test?.argument);
  const callee = unwrapJavaScriptChain(call?.callee);
  return statement?.type === 'IfStatement'
    && statement.alternate == null
    && test?.type === 'UnaryExpression'
    && test.operator === '!'
    && test.prefix === true
    && call?.type === 'CallExpression'
    && call.optional !== true
    && call.arguments?.length === 1
    && call.arguments[0]?.type === 'Identifier'
    && call.arguments[0].name === 'name'
    && callee?.type === 'MemberExpression'
    && callee.computed === false
    && callee.object?.type === 'Identifier'
    && callee.object.name === 'WORKER_ENV_ALLOWLIST'
    && callee.property?.type === 'Identifier'
    && callee.property.name === 'test'
    && statement.consequent?.type === 'ContinueStatement'
    && statement.consequent.label == null;
}

function mr1597LifecycleFilteredEnvWrite(statement) {
  const assignment = unwrapJavaScriptChain(statement?.expression);
  const target = unwrapJavaScriptChain(assignment?.left);
  const value = unwrapJavaScriptChain(assignment?.right);
  const source = unwrapJavaScriptChain(value?.arguments?.[0]);
  return statement?.type === 'ExpressionStatement'
    && assignment?.type === 'AssignmentExpression'
    && assignment.operator === '='
    && target?.type === 'MemberExpression'
    && target.computed === true
    && target.object?.type === 'Identifier'
    && target.object.name === 'env'
    && target.property?.type === 'Identifier'
    && target.property.name === 'name'
    && value?.type === 'CallExpression'
    && value.optional !== true
    && value.callee?.type === 'Identifier'
    && value.callee.name === 'String'
    && value.arguments?.length === 1
    && source?.type === 'LogicalExpression'
    && source.operator === '??'
    && source.left?.type === 'Identifier'
    && source.left.name === 'value'
    && source.right?.type === 'Literal'
    && source.right.value === '';
}

function mr1597LifecycleAllowlistFilterIsReachable(workerEnvironment) {
  const fingerprint = stableJson(mr1597AstFingerprint(workerEnvironment));
  return MR1597_WORKER_ENVIRONMENT_AST_FINGERPRINTS.some((expected) => (
    fingerprint === stableJson(expected)
  ));
}

function exactMr1597LifecycleTrustedHelperDeclarators(program) {
  const declarations = {
    isAbsolute: [],
    contextUsageWorkerFixtureEnvironment: [],
    expertAuthoringWorkerFixtureEnvironment: [],
  };
  for (const statement of program?.body || []) {
    if (statement.type === 'VariableDeclaration'
      && statement.kind === 'const'
      && statement.declarations?.length === 1) {
      const [declaration] = statement.declarations;
      if (objectPatternHasUniqueExactShorthandBinding(declaration.id, 'isAbsolute')
        && isExactRequireCall(declaration.init, MR1597_LIFECYCLE_PATH_REQUIRE_PATH)) {
        declarations.isAbsolute.push(declaration);
      }
      if (objectPatternHasUniqueExactShorthandBinding(
        declaration.id,
        'contextUsageWorkerFixtureEnvironment',
      ) && isExactRequireCall(declaration.init, MR1597_LIFECYCLE_CONTEXT_USAGE_REQUIRE_PATH)) {
        declarations.contextUsageWorkerFixtureEnvironment.push(declaration);
      }
    }
    if (statement.type === 'FunctionDeclaration'
      && stableJson(mr1597AstFingerprint(statement))
        === stableJson(MR1597_EXPERT_FIXTURE_HELPER_AST_FINGERPRINT)) {
      declarations.expertAuthoringWorkerFixtureEnvironment.push(statement);
    }
  }
  return declarations;
}

function mr1597DirectProtectedRootName(node, protectedNames, wrapperNames = new Set()) {
  let current = unwrapJavaScriptChain(node);
  const properties = [];
  while (current?.type === 'MemberExpression') {
    properties.unshift(staticMemberExpressionPropertyName(current));
    current = unwrapJavaScriptChain(current.object);
  }
  if (current?.type !== 'Identifier') return '';
  if (protectedNames.has(current.name)) return current.name;
  return wrapperNames.has(current.name) && properties[0] && protectedNames.has(properties[0])
    ? properties[0] : '';
}

function observeMr1597LifecycleBuiltinBindingViolations(program) {
  const protectedNames = new Set(['Object', 'RegExp', 'String']);
  const protectedAliases = new Set(['RegExp']);
  const wrapperAliases = new Set(['global', 'globalThis', 'self', 'window']);
  const violations = new Map();
  const record = (node, kind) => violations.set(`${node?.start ?? -1}:${node?.end ?? -1}:${kind}`, kind);
  const nodes = [];
  visitJavaScriptAst(program, (node) => nodes.push(node));
  const builtinWrites = observeBuiltinIndirectWriteAliases(nodes);
  let aliasesChanged = true;
  while (aliasesChanged) {
    aliasesChanged = false;
    for (const node of nodes) {
      const aliasSource = node.type === 'VariableDeclarator'
        ? unwrapJavaScriptChain(node.init)
        : node.type === 'AssignmentExpression' && ALIASING_ASSIGNMENT_OPERATORS.has(node.operator)
          ? unwrapJavaScriptChain(node.right) : null;
      const aliasTarget = node.type === 'VariableDeclarator'
        ? node.id
        : node.type === 'AssignmentExpression' && ALIASING_ASSIGNMENT_OPERATORS.has(node.operator)
          ? node.left : null;
      const wrapperBinding = bindAliasFlowNode(node, wrapperAliases);
      if (wrapperBinding.indeterminate) {
        record(node, 'global-wrapper-alias-flow-indeterminate');
      }
      let protectedMemberAdded = false;
      if (aliasTarget?.type === 'ObjectPattern'
        && expressionAliasesAnyIdentifier(aliasSource, wrapperAliases)) {
        for (const property of aliasTarget.properties || []) {
          const propertyName = property.type === 'RestElement'
            ? null : staticJavaScriptPropertyName(property);
          if (propertyName !== null && !protectedNames.has(propertyName)) continue;
          const target = property.type === 'RestElement' ? property.argument : property.value;
          for (const name of javaScriptPatternNames(target)) {
            if (protectedAliases.has(name)) continue;
            protectedAliases.add(name);
            protectedMemberAdded = true;
          }
          if (propertyName === null) record(property, 'global-wrapper-protected-member-indeterminate');
        }
      }
      const protectedBinding = bindAliasFlowNode(node, protectedAliases, {
        matchesAlias: (value) => Boolean(mr1597DirectProtectedRootName(
          value,
          protectedAliases,
          wrapperAliases,
        )),
      });
      aliasesChanged = wrapperBinding.added
        || protectedMemberAdded
        || protectedBinding.added
        || aliasesChanged;
      if (protectedBinding.indeterminate) {
        record(node, 'builtin-alias-flow-indeterminate');
      }
    }
  }
  const reflectApplyAliases = new Set();
  const expressionIsReflectApply = (node) => {
    const expression = unwrapJavaScriptChain(node);
    if (!expression) return false;
    if (expression.type === 'Identifier') return reflectApplyAliases.has(expression.name);
    if (['AwaitExpression', 'YieldExpression'].includes(expression.type)) {
      return expressionIsReflectApply(expression.argument);
    }
    if (expression.type === 'AssignmentExpression') {
      return expressionIsReflectApply(expression.right);
    }
    if (expression.type === 'SequenceExpression') {
      return expressionIsReflectApply(expression.expressions?.at(-1));
    }
    if (expression.type === 'ConditionalExpression') {
      return expressionIsReflectApply(expression.consequent)
        || expressionIsReflectApply(expression.alternate);
    }
    if (expression.type === 'LogicalExpression') {
      return expressionIsReflectApply(expression.left)
        || expressionIsReflectApply(expression.right);
    }
    if (expression.type !== 'MemberExpression'
      || staticMemberExpressionPropertyName(expression) !== 'apply') return false;
    const receiver = unwrapJavaScriptChain(expression.object);
    if (receiver?.type === 'Identifier' && receiver.name === 'Reflect') return true;
    return mr1597DirectProtectedRootName(receiver, new Set(['Reflect']), wrapperAliases) === 'Reflect';
  };
  let reflectAliasesChanged = true;
  while (reflectAliasesChanged) {
    reflectAliasesChanged = false;
    for (const node of nodes) {
      const binding = bindAliasFlowNode(node, reflectApplyAliases, {
        matchesAlias: expressionIsReflectApply,
      });
      reflectAliasesChanged = binding.added || reflectAliasesChanged;
      if (binding.indeterminate) record(node, 'reflect-apply-alias-flow-indeterminate');
    }
  }
  const mutationInvocation = (node) => {
    const standard = builtinWrites.resolveInvocation(node);
    if (standard.operations.length > 0 || !expressionIsReflectApply(node?.callee)) return standard;
    const operations = builtinWrites.resolve(node.arguments?.[0]);
    if (operations.length === 0) return standard;
    const argumentList = unwrapJavaScriptChain(node.arguments?.[2]);
    if (argumentList?.type !== 'ArrayExpression') {
      return { operations, invocation: 'reflect-apply', forwardedArguments: [], targetIndeterminate: true };
    }
    const forwardedArguments = argumentList.elements || [];
    return {
      operations,
      invocation: 'reflect-apply',
      forwardedArguments,
      targetIndeterminate: forwardedArguments[0]?.type === 'SpreadElement',
    };
  };
  for (const { name, node } of javaScriptDeclarationRecords(program)) {
    if (protectedNames.has(name)) record(node, `${name}:duplicate-or-shadow-declaration`);
  }
  const protectedReceivers = new Set([...protectedNames, ...protectedAliases]);
  for (const node of nodes) {
    if (node.type === 'AssignmentExpression') {
      if (javaScriptPatternNames(node.left).some((name) => protectedNames.has(name))) {
        record(node, 'builtin-identifier-write');
      }
      const root = mr1597DirectProtectedRootName(node.left, protectedReceivers, wrapperAliases);
      if (root) record(node, `${root}:member-write`);
    } else if (node.type === 'UpdateExpression') {
      const root = mr1597DirectProtectedRootName(node.argument, protectedReceivers, wrapperAliases);
      if (root) record(node, `${root}:member-write`);
    } else if (node.type === 'UnaryExpression' && node.operator === 'delete') {
      const root = mr1597DirectProtectedRootName(node.argument, protectedReceivers, wrapperAliases);
      if (root) record(node, `${root}:member-write`);
    } else if (['ForInStatement', 'ForOfStatement'].includes(node.type)) {
      const target = node.left?.type === 'VariableDeclaration'
        ? node.left.declarations?.[0]?.id : node.left;
      if (javaScriptPatternNames(target).some((name) => protectedNames.has(name))) {
        record(node, 'builtin-identifier-write');
      }
    }
    if (node.type === 'CallExpression') {
      const callee = unwrapJavaScriptChain(node.callee);
      if (callee?.type === 'MemberExpression'
        && staticMemberExpressionPropertyName(callee) === 'bind') {
        const operations = builtinWrites.resolve(callee.object);
        const boundArguments = (node.arguments || []).slice(1);
        const boundRoot = mr1597DirectProtectedRootName(
          boundArguments[0],
          protectedReceivers,
          wrapperAliases,
        );
        if (operations.length > 0
          && (boundRoot || boundArguments[0]?.type === 'SpreadElement')) {
          record(node, boundRoot
            ? `${boundRoot}:bound-indirect-member-write`
            : 'builtin-bound-indirect-write-indeterminate');
        }
      }
      const invocation = mutationInvocation(node);
      const root = mr1597DirectProtectedRootName(
        invocation.forwardedArguments?.[0],
        protectedReceivers,
        wrapperAliases,
      );
      if (invocation.operations.length > 0 && (root || invocation.targetIndeterminate)) {
        record(node, root ? `${root}:indirect-member-write` : 'builtin-indirect-write-indeterminate');
      }
    }
  }
  return { count: violations.size, kinds: [...new Set(violations.values())].sort() };
}

function observeMr1597LifecycleAllowlist(program, lifecycleDeclarations, lifecycleExports) {
  const exactDeclarations = exactMr1597LifecycleAllowlistDeclarators(program);
  const trustedHelpers = exactMr1597LifecycleTrustedHelperDeclarators(program);
  const allowedDeclarations = new Set([
    ...exactDeclarations,
    ...Object.values(trustedHelpers).flat(),
  ]);
  const protectedBindings = observeProtectedBindingViolations(program, {
    protectedNames: new Set([
      'WORKER_ENV_ALLOWLIST',
      'isAbsolute',
      'contextUsageWorkerFixtureEnvironment',
      'expertAuthoringWorkerFixtureEnvironment',
    ]),
    allowedDeclarationNodes: allowedDeclarations,
    allowedWriteNodes: new Set(lifecycleExports),
  });
  const builtinBindings = observeMr1597LifecycleBuiltinBindingViolations(program);
  const failures = [];
  if (exactDeclarations.length !== 1) failures.push('lifecycle-allowlist-declaration-invalid');
  for (const [name, declarations] of Object.entries(trustedHelpers)) {
    if (declarations.length !== 1) failures.push(`lifecycle-trusted-helper-declaration-invalid:${name}`);
  }
  if (lifecycleDeclarations.length !== 1
    || !mr1597LifecycleAllowlistFilterIsReachable(lifecycleDeclarations[0])) {
    failures.push('lifecycle-allowlist-filter-path-invalid');
  }
  failures.push(...protectedBindings.kinds.map((kind) => `lifecycle-allowlist-binding:${kind}`));
  failures.push(...builtinBindings.kinds.map((kind) => `lifecycle-builtin-binding:${kind}`));
  return {
    count: failures.length
      + Math.max(0, protectedBindings.count - protectedBindings.kinds.length)
      + Math.max(0, builtinBindings.count - builtinBindings.kinds.length),
    kinds: [...new Set(failures)].sort(),
  };
}

function observeMr1597ExportChain(sourceByPath) {
  const programs = new Map();
  for (const filePath of [MR1597_FACADE_PATH, MR1597_SUPERVISOR_PATH, MR1597_LIFECYCLE_PATH]) {
    try {
      programs.set(filePath, parse(String(sourceByPath.get(filePath) || ''), {
        allowHashBang: true, ecmaVersion: 'latest', sourceType: 'script',
      }));
    } catch {
      programs.set(filePath, null);
    }
  }
  const facade = programs.get(MR1597_FACADE_PATH);
  const supervisor = programs.get(MR1597_SUPERVISOR_PATH);
  const lifecycle = programs.get(MR1597_LIFECYCLE_PATH);
  const facadeForwards = (facade?.body || []).flatMap((statement) => {
    const call = statement.type === 'ExpressionStatement' ? unwrapJavaScriptChain(statement.expression) : null;
    const sources = facadeForwardSources(call);
    return sources
      && sources.filter((source) => source === MR1597_FACADE_SUPERVISOR_REQUIRE_PATH).length === 1
      && sources.at(-1) === MR1597_FACADE_SUPERVISOR_REQUIRE_PATH
      ? [call] : [];
  });
  const supervisorImports = [];
  for (const statement of supervisor?.body || []) {
    if (statement.type !== 'VariableDeclaration' || statement.kind !== 'const') continue;
    for (const declaration of statement.declarations || []) {
      if (objectPatternHasUniqueExactShorthandBinding(declaration.id, 'workerEnvironment')
        && isExactRequireCall(declaration.init, MR1597_SUPERVISOR_LIFECYCLE_REQUIRE_PATH)) {
        supervisorImports.push(declaration);
      }
    }
  }
  const supervisorExports = topLevelModuleExportsAssignments(supervisor)
    .filter((assignment) => objectHasExactShorthandProperty(assignment.right, 'workerEnvironment'));
  const lifecycleDeclarations = (lifecycle?.body || []).filter((node) => (
    node.type === 'FunctionDeclaration'
    && node.id?.name === 'workerEnvironment'
    && node.async === false
    && node.generator === false
    && node.params?.length === 2
    && node.params[0]?.type === 'AssignmentPattern'
    && node.params[0].left?.type === 'Identifier'
    && node.params[0].left.name === 'source'
    && node.params[0].right?.type === 'MemberExpression'
    && node.params[0].right.computed === false
    && node.params[0].right.object?.type === 'Identifier'
    && node.params[0].right.object.name === 'process'
    && node.params[0].right.property?.name === 'env'
    && node.params[1]?.type === 'AssignmentPattern'
    && node.params[1].left?.type === 'Identifier'
    && node.params[1].left.name === 'authority'
    && node.params[1].right?.type === 'ObjectExpression'
    && node.params[1].right.properties?.length === 0
  ));
  const lifecycleExports = topLevelModuleExportsAssignments(lifecycle)
    .filter((assignment) => objectHasExactShorthandProperty(assignment.right, 'workerEnvironment'));
  const matches = [facadeForwards, supervisorImports, supervisorExports, lifecycleDeclarations, lifecycleExports];
  const steps = MR1597_EXPORT_CHAIN_EXPECTATIONS.map((expected, index) => ({
    ...expected,
    count: matches[index].length,
    verified: matches[index].length === 1,
  }));
  const chainViolations = [];
  for (const [filePath, protectedNames, allowedDeclarations, allowedWrites, allowedIndirect] of [
    [MR1597_SUPERVISOR_PATH, new Set(['require', 'module', 'exports', 'workerEnvironment']),
      new Set(supervisorImports), new Set(supervisorExports), new Set()],
    [MR1597_LIFECYCLE_PATH, new Set(['module', 'exports', 'process', 'workerEnvironment']),
      new Set(lifecycleDeclarations), new Set(lifecycleExports), new Set()],
  ]) {
    const program = programs.get(filePath);
    if (!program) {
      chainViolations.push({ count: 1, kinds: [`parse-failed:${filePath}`] });
      continue;
    }
    const observed = observeProtectedBindingViolations(program, {
      protectedNames,
      allowedDeclarationNodes: allowedDeclarations,
      allowedWriteNodes: allowedWrites,
      allowedIndirectNodes: allowedIndirect,
    });
    chainViolations.push({
      count: observed.count,
      kinds: observed.kinds.map((kind) => `${filePath}:${kind}`),
    });
  }
  if (facade) {
    const observed = observeMr1597FacadeViolations(facade, facadeForwards);
    chainViolations.unshift({
      count: observed.count,
      kinds: observed.kinds.map((kind) => `${MR1597_FACADE_PATH}:${kind}`),
    });
  }
  if (lifecycle) {
    const observed = observeMr1597LifecycleAllowlist(
      lifecycle,
      lifecycleDeclarations,
      lifecycleExports,
    );
    chainViolations.push({
      count: observed.count,
      kinds: observed.kinds.map((kind) => `${MR1597_LIFECYCLE_PATH}:${kind}`),
    });
  }
  const protectedBindingViolationCount = chainViolations.reduce((sum, item) => sum + item.count, 0);
  const protectedBindingViolationKinds = [...new Set(chainViolations.flatMap((item) => item.kinds))].sort();
  return {
    steps,
    protected_binding_violation_count: protectedBindingViolationCount,
    protected_binding_violation_kinds: protectedBindingViolationKinds,
    verified: steps.every((step) => step.verified)
      && protectedBindingViolationCount === 0
      && protectedBindingViolationKinds.length === 0,
  };
}

function observeMr1597DynamicCodeExecutionByName(program, ownerCallback) {
  const executionNodes = new Map();
  const record = (node, kind) => {
    const key = `${node?.start ?? -1}:${node?.end ?? -1}`;
    if (!executionNodes.has(key)) executionNodes.set(key, kind);
  };
  const evalAliases = new Set(['eval']);
  const functionAliases = new Set(['Function']);
  const vmObjectAliases = new Set();
  const vmExecutionAliases = new Set();
  const reflectApplyAliases = new Set();
  const reflectConstructAliases = new Set();
  const dynamicCallableAliases = new Set();
  const vmOperations = new Set([
    'Script', 'SourceTextModule', 'SyntheticModule', 'compileFunction',
    'runInContext', 'runInNewContext', 'runInThisContext',
  ]);
  const allNodes = [];
  visitJavaScriptAst(program, (node) => allNodes.push(node));
  const valueSourcesByName = new Map();
  const addValueSource = (name, value) => {
    if (!name || !value) return;
    if (!valueSourcesByName.has(name)) valueSourcesByName.set(name, []);
    valueSourcesByName.get(name).push(value);
  };
  for (const node of allNodes) {
    if (node.type === 'VariableDeclarator' && node.id?.type === 'Identifier') {
      addValueSource(node.id.name, node.init);
    } else if (node.type === 'AssignmentExpression'
      && ALIASING_ASSIGNMENT_OPERATORS.has(node.operator)
      && node.left?.type === 'Identifier') {
      addValueSource(node.left.name, node.right);
    }
  }
  const staticContainerMemberName = (node) => {
    const expression = unwrapJavaScriptChain(node);
    if (expression?.type !== 'MemberExpression') return null;
    if (!expression.computed && expression.property?.type === 'Identifier') {
      return expression.property.name;
    }
    if (expression.computed && expression.property?.type === 'Literal'
      && ['string', 'number'].includes(typeof expression.property.value)) {
      return String(expression.property.value);
    }
    if (expression.computed
      && expression.property?.type === 'TemplateLiteral'
      && expression.property.expressions?.length === 0
      && expression.property.quasis?.length === 1) {
      return expression.property.quasis[0].value.cooked;
    }
    return null;
  };
  const staticContainerPropertyName = (property) => {
    if (property?.type !== 'Property') return null;
    if (!property.computed && property.key?.type === 'Identifier') return property.key.name;
    if (property.key?.type === 'Literal'
      && ['string', 'number'].includes(typeof property.key.value)) {
      return String(property.key.value);
    }
    if (property.computed
      && property.key?.type === 'TemplateLiteral'
      && property.key.expressions?.length === 0
      && property.key.quasis?.length === 1) {
      return property.key.quasis[0].value.cooked;
    }
    return null;
  };
  const immediateFunctionReturnValues = (node) => {
    const expression = unwrapJavaScriptChain(node);
    if (expression?.type !== 'CallExpression') return { recognized: false, values: [] };
    const callee = unwrapJavaScriptChain(expression.callee);
    if (!['ArrowFunctionExpression', 'FunctionExpression'].includes(callee?.type)) {
      return { recognized: false, values: [] };
    }
    if (callee.body?.type !== 'BlockStatement') {
      return { recognized: true, values: [callee.body] };
    }
    const values = [];
    const visitReturns = (candidate) => {
      if (!candidate || typeof candidate !== 'object') return;
      if (candidate !== callee
        && ['ArrowFunctionExpression', 'FunctionExpression', 'FunctionDeclaration'].includes(candidate.type)) {
        return;
      }
      if (candidate.type === 'ReturnStatement') {
        if (candidate.argument) values.push(candidate.argument);
        return;
      }
      for (const [key, value] of Object.entries(candidate)) {
        if (['end', 'loc', 'range', 'start', 'type'].includes(key)) continue;
        if (Array.isArray(value)) value.forEach(visitReturns);
        else if (value && typeof value.type === 'string') visitReturns(value);
      }
    };
    visitReturns(callee.body);
    return { recognized: true, values };
  };
  const bindTrackedForOfAliasPattern = (
    pattern,
    iterable,
    aliases,
    options = {},
    seen = new Set(),
  ) => {
    const source = unwrapJavaScriptChain(iterable);
    if (!source) return { added: false, indeterminate: false };
    const seenKey = `${source.start ?? -1}:${source.end ?? -1}`;
    if (seen.has(seenKey)) return { added: false, indeterminate: true };
    const nextSeen = new Set(seen).add(seenKey);
    if (source.type === 'Identifier' && valueSourcesByName.has(source.name)) {
      return mergeAliasBindingResults(valueSourcesByName.get(source.name).map((value) => (
        bindTrackedForOfAliasPattern(pattern, value, aliases, options, nextSeen)
      )));
    }
    if (['AwaitExpression', 'YieldExpression'].includes(source.type)) {
      return bindTrackedForOfAliasPattern(pattern, source.argument, aliases, options, nextSeen);
    }
    if (source.type === 'AssignmentExpression') {
      return bindTrackedForOfAliasPattern(pattern, source.right, aliases, options, nextSeen);
    }
    if (source.type === 'SequenceExpression') {
      return bindTrackedForOfAliasPattern(
        pattern, source.expressions?.at(-1), aliases, options, nextSeen,
      );
    }
    if (source.type === 'ConditionalExpression' || source.type === 'LogicalExpression') {
      const values = source.type === 'ConditionalExpression'
        ? [source.consequent, source.alternate] : [source.left, source.right];
      return mergeAliasBindingResults(values.map((value) => (
        bindTrackedForOfAliasPattern(pattern, value, aliases, options, nextSeen)
      )));
    }
    if (source.type === 'CallExpression') {
      const returned = immediateFunctionReturnValues(source);
      if (returned.recognized) {
        return mergeAliasBindingResults(returned.values.map((value) => (
          bindTrackedForOfAliasPattern(pattern, value, aliases, options, nextSeen)
        )));
      }
    }
    return bindForOfAliasPattern(pattern, source, aliases, options);
  };
  const resolveContainerMemberValues = (containerNode, memberName, seen = new Set()) => {
    const container = unwrapJavaScriptChain(containerNode);
    if (!container) return { values: [], indeterminate: true };
    const seenKey = `${container.start ?? -1}:${container.end ?? -1}:${memberName ?? '*'}`;
    if (seen.has(seenKey)) return { values: [], indeterminate: true };
    const nextSeen = new Set(seen).add(seenKey);
    const merge = (rows) => ({
      values: rows.flatMap((row) => row.values),
      indeterminate: rows.some((row) => row.indeterminate),
    });
    if (container.type === 'Identifier') {
      const sources = valueSourcesByName.get(container.name) || [];
      if (sources.length === 0) return { values: [], indeterminate: true };
      return merge(sources.map((source) => (
        resolveContainerMemberValues(source, memberName, nextSeen)
      )));
    }
    if (['AwaitExpression', 'YieldExpression'].includes(container.type)) {
      return resolveContainerMemberValues(container.argument, memberName, nextSeen);
    }
    if (container.type === 'AssignmentExpression') {
      return resolveContainerMemberValues(container.right, memberName, nextSeen);
    }
    if (container.type === 'SequenceExpression') {
      return resolveContainerMemberValues(container.expressions?.at(-1), memberName, nextSeen);
    }
    if (container.type === 'ConditionalExpression') {
      return merge([
        resolveContainerMemberValues(container.consequent, memberName, nextSeen),
        resolveContainerMemberValues(container.alternate, memberName, nextSeen),
      ]);
    }
    if (container.type === 'LogicalExpression') {
      return merge([
        resolveContainerMemberValues(container.left, memberName, nextSeen),
        resolveContainerMemberValues(container.right, memberName, nextSeen),
      ]);
    }
    if (container.type === 'ObjectExpression') {
      const rows = [];
      let indeterminate = false;
      for (const property of container.properties || []) {
        if (property.type === 'SpreadElement') {
          const spread = resolveContainerMemberValues(property.argument, memberName, nextSeen);
          rows.push(spread);
          indeterminate = indeterminate || spread.indeterminate;
          continue;
        }
        const propertyName = staticContainerPropertyName(property);
        if (propertyName === null) {
          rows.push({ values: [property.value], indeterminate: true });
          indeterminate = true;
        } else if (memberName === null || propertyName === memberName) {
          rows.push({ values: [property.value], indeterminate: false });
        }
      }
      const merged = merge(rows);
      return { values: merged.values, indeterminate: indeterminate || merged.indeterminate };
    }
    if (container.type === 'ArrayExpression') {
      const elements = container.elements || [];
      if (memberName !== null && /^\d+$/u.test(memberName)) {
        const selected = elements[Number(memberName)];
        if (!selected) return { values: [], indeterminate: false };
        if (selected.type === 'SpreadElement') {
          return { values: [selected.argument], indeterminate: true };
        }
        return { values: [selected], indeterminate: false };
      }
      return {
        values: elements.filter(Boolean).map((element) => (
          element.type === 'SpreadElement' ? element.argument : element
        )),
        indeterminate: memberName === null || elements.some((element) => element?.type === 'SpreadElement'),
      };
    }
    if (container.type === 'MemberExpression') {
      const nested = resolveContainerMemberValues(
        container.object,
        staticContainerMemberName(container),
        nextSeen,
      );
      const rows = nested.values.map((value) => (
        resolveContainerMemberValues(value, memberName, nextSeen)
      ));
      const merged = merge(rows);
      return {
        values: merged.values,
        indeterminate: nested.indeterminate || merged.indeterminate,
      };
    }
    if (container.type === 'CallExpression') {
      const returned = immediateFunctionReturnValues(container);
      if (returned.recognized) {
        return merge(returned.values.map((value) => (
          resolveContainerMemberValues(value, memberName, nextSeen)
        )));
      }
      const callee = unwrapJavaScriptChain(container.callee);
      if (container.optional !== true
        && callee?.type === 'Identifier'
        && callee.name === 'Object'
        && container.arguments?.length === 1) {
        return resolveContainerMemberValues(container.arguments[0], memberName, nextSeen);
      }
      if (container.optional !== true
        && callee?.type === 'MemberExpression'
        && callee.object?.type === 'Identifier'
        && callee.object.name === 'Object'
        && staticMemberExpressionPropertyName(callee) === 'assign') {
        return merge((container.arguments || []).map((argument) => (
          resolveContainerMemberValues(
            argument?.type === 'SpreadElement' ? argument.argument : argument,
            memberName,
            nextSeen,
          )
        )));
      }
    }
    return { values: [], indeterminate: true };
  };
  const resolveMemberValues = (node) => {
    const expression = unwrapJavaScriptChain(node);
    if (expression?.type !== 'MemberExpression') return { values: [], indeterminate: false };
    return resolveContainerMemberValues(
      expression.object,
      staticContainerMemberName(expression),
    );
  };
  const isNodeVmSource = (node) => node?.type === 'Literal' && ['node:vm', 'vm'].includes(node.value);
  const bindVmObjectPattern = (pattern) => {
    for (const property of pattern?.properties || []) {
      if (property.type === 'RestElement') {
        javaScriptPatternNames(property.argument).forEach((name) => vmObjectAliases.add(name));
        continue;
      }
      const propertyName = staticJavaScriptPropertyName(property);
      if (propertyName === null || vmOperations.has(propertyName)) {
        javaScriptPatternNames(property.value).forEach((name) => vmExecutionAliases.add(name));
      }
    }
  };
  for (const node of allNodes) {
    if (node.type === 'ImportDeclaration' && isNodeVmSource(node.source)) {
      for (const specifier of node.specifiers || []) {
        if (specifier.type === 'ImportSpecifier') {
          const imported = specifier.imported?.name || specifier.imported?.value;
          if (vmOperations.has(imported)) vmExecutionAliases.add(specifier.local.name);
        } else vmObjectAliases.add(specifier.local.name);
      }
    }
    if (node.type === 'VariableDeclarator' && isExactRequireCall(node.init, 'node:vm')) {
      if (node.id?.type === 'Identifier') vmObjectAliases.add(node.id.name);
      else if (node.id?.type === 'ObjectPattern') bindVmObjectPattern(node.id);
    }
    if (node.type === 'VariableDeclarator' && isExactRequireCall(node.init, 'vm')) {
      if (node.id?.type === 'Identifier') vmObjectAliases.add(node.id.name);
      else if (node.id?.type === 'ObjectPattern') bindVmObjectPattern(node.id);
    }
  }
  const expressionIsGlobalMember = (node, propertyName) => {
    const expression = unwrapJavaScriptChain(node);
    return expression?.type === 'MemberExpression'
      && ['global', 'globalThis', 'self', 'window'].includes(memberExpressionRootIdentifier(expression))
      && staticMemberExpressionPropertyName(expression) === propertyName;
  };
  const expressionIsAlias = (node, aliases, globalName) => {
    const expression = unwrapJavaScriptChain(node);
    if (expression?.type === 'Identifier') return aliases.has(expression.name);
    if (['AwaitExpression', 'YieldExpression'].includes(expression?.type)) {
      return expressionIsAlias(expression.argument, aliases, globalName);
    }
    if (expression?.type === 'AssignmentExpression') {
      return expressionIsAlias(expression.right, aliases, globalName);
    }
    if (expression?.type === 'SequenceExpression') {
      return expressionIsAlias(expression.expressions?.at(-1), aliases, globalName);
    }
    if (expression?.type === 'ConditionalExpression') {
      return expressionIsAlias(expression.consequent, aliases, globalName)
        || expressionIsAlias(expression.alternate, aliases, globalName);
    }
    if (expression?.type === 'LogicalExpression') {
      return expressionIsAlias(expression.left, aliases, globalName)
        || expressionIsAlias(expression.right, aliases, globalName);
    }
    if (expression?.type === 'MemberExpression') {
      const resolved = resolveMemberValues(expression);
      return expressionIsGlobalMember(expression, globalName)
        || resolved.values.some((value) => expressionIsAlias(value, aliases, globalName));
    }
    if (expression?.type === 'CallExpression') {
      const callee = unwrapJavaScriptChain(expression.callee);
      if (callee?.type === 'MemberExpression'
        && staticMemberExpressionPropertyName(callee) === 'bind'
        && expressionIsAlias(callee.object, aliases, globalName)) return true;
      if (expression.optional !== true
        && expression.callee?.type === 'Identifier'
        && expression.callee.name === 'Object'
        && expression.arguments?.length === 1) {
        return expressionIsAlias(expression.arguments[0], aliases, globalName);
      }
      const returned = immediateFunctionReturnValues(expression);
      if (returned.recognized) {
        return returned.values.some((value) => expressionIsAlias(value, aliases, globalName));
      }
    }
    return expressionIsGlobalMember(expression, globalName);
  };
  const expressionIsVmObjectAlias = (node) => {
    const expression = unwrapJavaScriptChain(node);
    if (!expression) return false;
    if (expression.type === 'Identifier') return vmObjectAliases.has(expression.name);
    if (['AwaitExpression', 'YieldExpression'].includes(expression.type)) {
      return expressionIsVmObjectAlias(expression.argument);
    }
    if (expression.type === 'AssignmentExpression') {
      return expressionIsVmObjectAlias(expression.right);
    }
    if (expression.type === 'SequenceExpression') {
      return expressionIsVmObjectAlias(expression.expressions?.at(-1));
    }
    if (expression.type === 'ConditionalExpression') {
      return expressionIsVmObjectAlias(expression.consequent)
        || expressionIsVmObjectAlias(expression.alternate);
    }
    if (expression.type === 'LogicalExpression') {
      return expressionIsVmObjectAlias(expression.left)
        || expressionIsVmObjectAlias(expression.right);
    }
    if (expression.type === 'ObjectExpression') {
      return expression.properties?.some((property) => (
        property.type === 'SpreadElement' && expressionIsVmObjectAlias(property.argument)
      )) || false;
    }
    if (expression.type === 'MemberExpression') {
      const resolved = resolveMemberValues(expression);
      return resolved.values.some((value) => expressionIsVmObjectAlias(value));
    }
    if (expression.type === 'CallExpression'
      && expression.optional !== true
      && expression.callee?.type === 'Identifier'
      && expression.callee.name === 'Object'
      && expression.arguments?.length === 1) {
      return expressionIsVmObjectAlias(expression.arguments[0]);
    }
    if (expression.type === 'CallExpression'
      && expression.optional !== true
      && expression.callee?.type === 'MemberExpression'
      && expression.callee.computed === false
      && expression.callee.object?.type === 'Identifier'
      && expression.callee.object.name === 'Object'
      && expression.callee.property?.type === 'Identifier'
      && expression.callee.property.name === 'assign') {
      return expression.arguments?.some((argument) => expressionIsVmObjectAlias(
        argument?.type === 'SpreadElement' ? argument.argument : argument,
      )) || false;
    }
    if (expression.type === 'CallExpression') {
      const returned = immediateFunctionReturnValues(expression);
      if (returned.recognized) {
        return returned.values.some((value) => expressionIsVmObjectAlias(value));
      }
    }
    return false;
  };
  const expressionIsVmExecution = (node) => {
    const expression = unwrapJavaScriptChain(node);
    if (!expression) return false;
    if (expression.type === 'Identifier') return vmExecutionAliases.has(expression.name);
    if (['AwaitExpression', 'YieldExpression'].includes(expression.type)) {
      return expressionIsVmExecution(expression.argument);
    }
    if (expression.type === 'AssignmentExpression') {
      return expressionIsVmExecution(expression.right);
    }
    if (expression.type === 'SequenceExpression') {
      return expressionIsVmExecution(expression.expressions?.at(-1));
    }
    if (expression.type === 'ConditionalExpression') {
      return expressionIsVmExecution(expression.consequent)
        || expressionIsVmExecution(expression.alternate);
    }
    if (expression.type === 'LogicalExpression') {
      return expressionIsVmExecution(expression.left)
        || expressionIsVmExecution(expression.right);
    }
    if (expression.type === 'MemberExpression') {
      const property = staticMemberExpressionPropertyName(expression);
      return expressionIsVmObjectAlias(expression.object)
        && (property === null || vmOperations.has(property));
    }
    if (expression.type === 'CallExpression') {
      const callee = unwrapJavaScriptChain(expression.callee);
      if (callee?.type === 'MemberExpression'
        && staticMemberExpressionPropertyName(callee) === 'bind'
        && expressionIsVmExecution(callee.object)) return true;
      const returned = immediateFunctionReturnValues(expression);
      return returned.recognized
        && returned.values.some((value) => expressionIsVmExecution(value));
    }
    return false;
  };
  const expressionIsReflectOperation = (node, operation) => {
    const expression = unwrapJavaScriptChain(node);
    const aliases = operation === 'apply' ? reflectApplyAliases : reflectConstructAliases;
    if (expression?.type === 'Identifier') return aliases.has(expression.name);
    if (expression?.type === 'SequenceExpression') {
      return expressionIsReflectOperation(expression.expressions?.at(-1), operation);
    }
    if (expression?.type === 'MemberExpression') {
      return expression.object?.type === 'Identifier'
        && expression.object.name === 'Reflect'
        && staticMemberExpressionPropertyName(expression) === operation;
    }
    if (expression?.type === 'CallExpression') {
      const callee = unwrapJavaScriptChain(expression.callee);
      return callee?.type === 'MemberExpression'
        && staticMemberExpressionPropertyName(callee) === 'bind'
        && expressionIsReflectOperation(callee.object, operation);
    }
    return false;
  };
  const bindReflectAliasPattern = (pattern, value, operation) => {
    const aliases = operation === 'apply' ? reflectApplyAliases : reflectConstructAliases;
    if (pattern?.type === 'Identifier' && expressionIsReflectOperation(value, operation)) {
      const added = !aliases.has(pattern.name);
      aliases.add(pattern.name);
      return added;
    }
    if (pattern?.type === 'AssignmentPattern') {
      return bindReflectAliasPattern(pattern.left, value, operation)
        || bindReflectAliasPattern(pattern.left, pattern.right, operation);
    }
    if (pattern?.type === 'ObjectPattern'
      && value?.type === 'Identifier'
      && value.name === 'Reflect') {
      let added = false;
      for (const property of pattern.properties || []) {
        if (property.type !== 'Property'
          || staticJavaScriptPropertyName(property) !== operation) continue;
        for (const name of javaScriptPatternNames(property.value)) {
          if (!aliases.has(name)) {
            aliases.add(name);
            added = true;
          }
        }
      }
      return added;
    }
    return false;
  };
  const bindAliasPattern = (pattern, value, aliases, globalName) => {
    if (pattern?.type === 'Identifier' && expressionIsAlias(value, aliases, globalName)) {
      const added = !aliases.has(pattern.name);
      aliases.add(pattern.name);
      return added;
    }
    if (pattern?.type === 'AssignmentPattern') {
      return bindAliasPattern(pattern.left, value, aliases, globalName)
        || bindAliasPattern(pattern.left, pattern.right, aliases, globalName);
    }
    if (pattern?.type === 'ArrayPattern' && value?.type === 'ArrayExpression') {
      let added = false;
      pattern.elements.forEach((element, index) => {
        added = bindAliasPattern(element, value.elements?.[index], aliases, globalName) || added;
      });
      return added;
    }
    if (pattern?.type === 'ObjectPattern' && value?.type === 'ObjectExpression') {
      let added = false;
      pattern.properties.forEach((property) => {
        if (property.type === 'RestElement') return false;
        const key = staticJavaScriptPropertyName(property);
        const sourceProperty = value.properties.find((candidate) => (
          staticJavaScriptPropertyName(candidate) === key
        ));
        added = bindAliasPattern(property.value, sourceProperty?.value, aliases, globalName) || added;
      });
      return added;
    }
    if (pattern?.type === 'ObjectPattern'
      && value?.type === 'Identifier'
      && ['global', 'globalThis', 'self', 'window'].includes(value.name)) {
      let added = false;
      for (const property of pattern.properties) {
        if (property.type !== 'Property' || staticJavaScriptPropertyName(property) !== globalName) continue;
        for (const name of javaScriptPatternNames(property.value)) {
          if (!aliases.has(name)) {
            aliases.add(name);
            added = true;
          }
        }
      }
      return added;
    }
    return false;
  };
  const bindVmAliasPattern = (pattern, value) => {
    if (pattern?.type === 'Identifier') {
      let added = false;
      if (expressionIsVmObjectAlias(value) && !vmObjectAliases.has(pattern.name)) {
        vmObjectAliases.add(pattern.name);
        added = true;
      }
      if (expressionIsVmExecution(value) && !vmExecutionAliases.has(pattern.name)) {
        vmExecutionAliases.add(pattern.name);
        added = true;
      }
      return added;
    }
    if (pattern?.type === 'AssignmentPattern') {
      return bindVmAliasPattern(pattern.left, value)
        || bindVmAliasPattern(pattern.left, pattern.right);
    }
    if (pattern?.type === 'ArrayPattern' && value?.type === 'ArrayExpression') {
      let added = false;
      pattern.elements.forEach((element, index) => {
        added = bindVmAliasPattern(element, value.elements?.[index]) || added;
      });
      return added;
    }
    if (pattern?.type === 'ObjectPattern' && expressionIsVmObjectAlias(value)) {
      let added = false;
      for (const property of pattern.properties || []) {
        if (property.type === 'RestElement') {
          for (const name of javaScriptPatternNames(property.argument)) {
            if (!vmObjectAliases.has(name)) {
              vmObjectAliases.add(name);
              added = true;
            }
          }
          continue;
        }
        const propertyName = staticJavaScriptPropertyName(property);
        if (propertyName !== null && !vmOperations.has(propertyName)) continue;
        for (const name of javaScriptPatternNames(property.value)) {
          if (!vmExecutionAliases.has(name)) {
            vmExecutionAliases.add(name);
            added = true;
          }
        }
      }
      return added;
    }
    return false;
  };
  const expressionHasTrackedContainerSource = (node, seen = new Set()) => {
    const expression = unwrapJavaScriptChain(node);
    if (!expression) return false;
    const seenKey = `${expression.start ?? -1}:${expression.end ?? -1}`;
    if (seen.has(seenKey)) return false;
    const nextSeen = new Set(seen).add(seenKey);
    if (expression.type === 'Identifier') {
      const sources = valueSourcesByName.get(expression.name) || [];
      return sources.some((source) => expressionHasTrackedContainerSource(source, nextSeen));
    }
    if (['ObjectExpression', 'ArrayExpression'].includes(expression.type)) return true;
    if (['AwaitExpression', 'YieldExpression'].includes(expression.type)) {
      return expressionHasTrackedContainerSource(expression.argument, nextSeen);
    }
    if (expression.type === 'AssignmentExpression') {
      return expressionHasTrackedContainerSource(expression.right, nextSeen);
    }
    if (expression.type === 'SequenceExpression') {
      return expressionHasTrackedContainerSource(expression.expressions?.at(-1), nextSeen);
    }
    if (expression.type === 'ConditionalExpression') {
      return expressionHasTrackedContainerSource(expression.consequent, nextSeen)
        || expressionHasTrackedContainerSource(expression.alternate, nextSeen);
    }
    if (expression.type === 'LogicalExpression') {
      return expressionHasTrackedContainerSource(expression.left, nextSeen)
        || expressionHasTrackedContainerSource(expression.right, nextSeen);
    }
    if (expression.type === 'MemberExpression') {
      return expressionHasTrackedContainerSource(expression.object, nextSeen);
    }
    if (expression.type === 'CallExpression') {
      const returned = immediateFunctionReturnValues(expression);
      return returned.recognized
        && returned.values.some((value) => expressionHasTrackedContainerSource(value, nextSeen));
    }
    return false;
  };
  const expressionIsDynamicCallable = (node) => {
    const expression = unwrapJavaScriptChain(node);
    if (!expression) return false;
    if (expression.type === 'Identifier') return dynamicCallableAliases.has(expression.name);
    if (['AwaitExpression', 'YieldExpression'].includes(expression.type)) {
      return expressionIsDynamicCallable(expression.argument);
    }
    if (expression.type === 'AssignmentExpression') {
      return expressionIsDynamicCallable(expression.right);
    }
    if (expression.type === 'SequenceExpression') {
      return expressionIsDynamicCallable(expression.expressions?.at(-1));
    }
    if (expression.type === 'ConditionalExpression') {
      return expressionIsDynamicCallable(expression.consequent)
        || expressionIsDynamicCallable(expression.alternate);
    }
    if (expression.type === 'LogicalExpression') {
      return expressionIsDynamicCallable(expression.left)
        || expressionIsDynamicCallable(expression.right);
    }
    if (expression.type === 'MemberExpression') {
      const memberName = staticContainerMemberName(expression);
      return memberName === null
        || (expressionHasTrackedContainerSource(expression.object)
          && resolveMemberValues(expression).indeterminate);
    }
    if (expression.type === 'CallExpression') {
      const returned = immediateFunctionReturnValues(expression);
      return returned.recognized
        && returned.values.some((value) => expressionIsDynamicCallable(value));
    }
    return false;
  };
  const bindDynamicCallablePattern = (pattern, value) => {
    if (pattern?.type === 'Identifier' && expressionIsDynamicCallable(value)) {
      const added = !dynamicCallableAliases.has(pattern.name);
      dynamicCallableAliases.add(pattern.name);
      return added;
    }
    if (pattern?.type === 'AssignmentPattern') {
      return bindDynamicCallablePattern(pattern.left, value)
        || bindDynamicCallablePattern(pattern.left, pattern.right);
    }
    if (pattern?.type === 'ArrayPattern' && value?.type === 'ArrayExpression') {
      let added = false;
      pattern.elements.forEach((element, index) => {
        added = bindDynamicCallablePattern(element, value.elements?.[index]) || added;
      });
      return added;
    }
    if (pattern?.type === 'ObjectPattern' && value?.type === 'ObjectExpression') {
      let added = false;
      pattern.properties.forEach((property) => {
        if (property.type === 'RestElement') return;
        const key = staticContainerPropertyName(property);
        const sourceProperty = value.properties.find((candidate) => (
          staticContainerPropertyName(candidate) === key
        ));
        added = bindDynamicCallablePattern(property.value, sourceProperty?.value) || added;
      });
      return added;
    }
    return false;
  };
  let aliasesChanged = true;
  while (aliasesChanged) {
    aliasesChanged = false;
    for (const node of allNodes) {
      for (const [aliases, globalName] of [[evalAliases, 'eval'], [functionAliases, 'Function']]) {
        if (node.type === 'VariableDeclarator') {
          aliasesChanged = bindAliasPattern(node.id, node.init, aliases, globalName) || aliasesChanged;
        } else if (node.type === 'AssignmentExpression'
          && ALIASING_ASSIGNMENT_OPERATORS.has(node.operator)) {
          aliasesChanged = bindAliasPattern(node.left, node.right, aliases, globalName) || aliasesChanged;
        } else if (node.type === 'ForOfStatement') {
          const target = node.left?.type === 'VariableDeclaration'
            ? node.left.declarations?.[0]?.id : node.left;
          aliasesChanged = bindTrackedForOfAliasPattern(target, node.right, aliases, {
            matchesAlias: (value) => expressionIsAlias(value, aliases, globalName),
          }).added || aliasesChanged;
        }
      }
      if (node.type === 'VariableDeclarator') {
        aliasesChanged = bindVmAliasPattern(node.id, node.init) || aliasesChanged;
        aliasesChanged = bindReflectAliasPattern(node.id, node.init, 'apply') || aliasesChanged;
        aliasesChanged = bindReflectAliasPattern(node.id, node.init, 'construct') || aliasesChanged;
        aliasesChanged = bindDynamicCallablePattern(node.id, node.init) || aliasesChanged;
      } else if (node.type === 'AssignmentExpression'
        && ALIASING_ASSIGNMENT_OPERATORS.has(node.operator)) {
        aliasesChanged = bindVmAliasPattern(node.left, node.right) || aliasesChanged;
        aliasesChanged = bindReflectAliasPattern(node.left, node.right, 'apply') || aliasesChanged;
        aliasesChanged = bindReflectAliasPattern(node.left, node.right, 'construct') || aliasesChanged;
        aliasesChanged = bindDynamicCallablePattern(node.left, node.right) || aliasesChanged;
      } else if (node.type === 'ForOfStatement') {
        const target = node.left?.type === 'VariableDeclaration'
          ? node.left.declarations?.[0]?.id : node.left;
        aliasesChanged = bindTrackedForOfAliasPattern(target, node.right, vmObjectAliases, {
          matchesAlias: expressionIsVmObjectAlias,
        }).added || aliasesChanged;
        aliasesChanged = bindTrackedForOfAliasPattern(target, node.right, vmExecutionAliases, {
          matchesAlias: expressionIsVmExecution,
        }).added || aliasesChanged;
        aliasesChanged = bindTrackedForOfAliasPattern(target, node.right, reflectApplyAliases, {
          matchesAlias: (value) => expressionIsReflectOperation(value, 'apply'),
        }).added || aliasesChanged;
        aliasesChanged = bindTrackedForOfAliasPattern(target, node.right, reflectConstructAliases, {
          matchesAlias: (value) => expressionIsReflectOperation(value, 'construct'),
        }).added || aliasesChanged;
        aliasesChanged = bindTrackedForOfAliasPattern(target, node.right, dynamicCallableAliases, {
          matchesAlias: expressionIsDynamicCallable,
        }).added || aliasesChanged;
      }
    }
  }
  for (const node of allNodes) {
    if (node.type === 'ImportExpression') {
      record(node, 'dynamic_import');
      continue;
    }
    if (node.type === 'TaggedTemplateExpression') {
      if (expressionIsAlias(node.tag, evalAliases, 'eval')) record(node, 'eval_tagged_template');
      else if (expressionIsAlias(node.tag, functionAliases, 'Function')) {
        record(node, 'function_tagged_template');
      } else if (expressionIsVmExecution(node.tag)) record(node, 'node_vm_execution');
      else if (node.tag?.type === 'MemberExpression'
        && node.tag.computed
        && staticMemberExpressionPropertyName(node.tag) === null) {
        record(node, 'dynamic_computed_tag');
      }
      continue;
    }
    if (!['CallExpression', 'NewExpression'].includes(node.type)) continue;
    const callee = unwrapJavaScriptChain(node.callee);
    const property = staticMemberExpressionPropertyName(callee);
    const calleeObject = callee?.type === 'MemberExpression' ? unwrapJavaScriptChain(callee.object) : null;
    const calleeObjectProperty = staticMemberExpressionPropertyName(calleeObject);
    const directEval = expressionIsAlias(callee, evalAliases, 'eval');
    const directFunction = expressionIsAlias(callee, functionAliases, 'Function');
    if (directEval) {
      record(node, callee?.type === 'Identifier' && callee.name === 'eval' ? 'direct_eval' : 'indirect_eval');
    } else if (directFunction) {
      record(node, 'function_constructor');
    } else if (['call', 'apply'].includes(property)
      && expressionIsAlias(calleeObject, evalAliases, 'eval')) {
      record(node, 'eval_call_or_apply');
    } else if (['call', 'apply'].includes(property)
      && expressionIsAlias(calleeObject, functionAliases, 'Function')) {
      record(node, 'function_call_or_apply');
    } else if ((expressionIsReflectOperation(callee, 'apply')
      || expressionIsReflectOperation(callee, 'construct'))
      && expressionIsAlias(node.arguments?.[0], evalAliases, 'eval')) {
      record(node, 'reflect_eval');
    } else if ((expressionIsReflectOperation(callee, 'apply')
      || expressionIsReflectOperation(callee, 'construct'))
      && expressionIsAlias(node.arguments?.[0], functionAliases, 'Function')) {
      record(node, 'reflect_function_constructor');
    } else if (property === 'constructor' || (['call', 'apply'].includes(property)
      && calleeObjectProperty === 'constructor')) {
      record(node, 'member_constructor');
    } else if (callee?.type === 'MemberExpression' && callee.computed && property === null) {
      record(node, 'dynamic_computed_callee');
    } else if (expressionIsVmExecution(callee)) {
      record(node, 'node_vm_execution');
    } else if (['call', 'apply'].includes(property)
      && expressionIsVmExecution(calleeObject)) {
      record(node, 'node_vm_execution');
    } else if ((expressionIsReflectOperation(callee, 'apply')
      || expressionIsReflectOperation(callee, 'construct'))
      && expressionIsVmExecution(node.arguments?.[0])) {
      record(node, 'node_vm_execution');
    } else if (expressionIsDynamicCallable(callee)) {
      record(node, 'dynamic_computed_callee');
    } else if (node.arguments?.some((argument) => (
      expressionIsAlias(argument, evalAliases, 'eval')
      || expressionIsAlias(argument, functionAliases, 'Function')
    ))) {
      record(node, 'dynamic_callable_escape');
    } else if (node.arguments?.some((argument) => (
      expressionIsVmExecution(argument) || expressionIsVmObjectAlias(argument)
    ))) {
      record(node, 'node_vm_escape');
    }
    if (isExactRequireCall(node, 'node:vm') || isExactRequireCall(node, 'vm')) {
      record(node, 'node_vm_module');
    }
  }
  const kinds = [...new Set(executionNodes.values())].sort();
  return { count: executionNodes.size, kinds };
}

function createJavaScriptLexicalBindingIndex(program) {
  let nextScopeId = 1;
  let nextBindingId = 1;
  const scopeByNode = new WeakMap();
  const declarationBindingByNode = new WeakMap();
  const scopes = [];
  const bindings = [];
  const createScope = (parent, kind, node) => {
    const scope = {
      id: nextScopeId,
      parent,
      kind,
      node,
      bindings: new Map(),
    };
    nextScopeId += 1;
    scopes.push(scope);
    return scope;
  };
  const rootScope = createScope(null, 'program', program);
  const declareIdentifier = (identifier, scope, kind) => {
    if (identifier?.type !== 'Identifier') return null;
    let binding = scope.bindings.get(identifier.name);
    if (!binding) {
      binding = {
        id: nextBindingId,
        name: identifier.name,
        scope,
        kinds: new Set(),
        declarations: [],
      };
      nextBindingId += 1;
      scope.bindings.set(identifier.name, binding);
      bindings.push(binding);
    }
    binding.declarations.push({ identifier, kind });
    declarationBindingByNode.set(identifier, binding);
    scopeByNode.set(identifier, scope);
    return binding;
  };
  const declarePattern = (pattern, scope, kind) => {
    if (!pattern || typeof pattern !== 'object') return;
    scopeByNode.set(pattern, scope);
    if (pattern.type === 'Identifier') {
      declareIdentifier(pattern, scope, kind);
      return;
    }
    if (pattern.type === 'RestElement') {
      declarePattern(pattern.argument, scope, kind);
      return;
    }
    if (pattern.type === 'AssignmentPattern') {
      declarePattern(pattern.left, scope, kind);
      return;
    }
    if (pattern.type === 'ArrayPattern') {
      pattern.elements?.forEach((element) => declarePattern(element, scope, kind));
      return;
    }
    if (pattern.type === 'ObjectPattern') {
      for (const property of pattern.properties || []) {
        scopeByNode.set(property, scope);
        declarePattern(
          property.type === 'RestElement' ? property.argument : property.value,
          scope,
          kind,
        );
      }
    }
  };
  const nearestVarScope = (scope) => {
    let cursor = scope;
    while (cursor && !['function', 'program', 'static-block'].includes(cursor.kind)) {
      cursor = cursor.parent;
    }
    return cursor || rootScope;
  };
  const visitPatternExpressions = (pattern, scope, walk) => {
    if (!pattern || typeof pattern !== 'object') return;
    scopeByNode.set(pattern, scope);
    if (pattern.type === 'AssignmentPattern') {
      visitPatternExpressions(pattern.left, scope, walk);
      walk(pattern.right, scope);
    } else if (pattern.type === 'RestElement') {
      visitPatternExpressions(pattern.argument, scope, walk);
    } else if (pattern.type === 'ArrayPattern') {
      pattern.elements?.forEach((element) => visitPatternExpressions(element, scope, walk));
    } else if (pattern.type === 'ObjectPattern') {
      for (const property of pattern.properties || []) {
        scopeByNode.set(property, scope);
        if (property.computed) walk(property.key, scope);
        visitPatternExpressions(
          property.type === 'RestElement' ? property.argument : property.value,
          scope,
          walk,
        );
      }
    }
  };
  const genericChildren = (node, scope, walk, omitted = new Set()) => {
    for (const [key, value] of Object.entries(node)) {
      if (['end', 'loc', 'range', 'raw', 'start', 'type'].includes(key) || omitted.has(key)) continue;
      if (Array.isArray(value)) value.forEach((item) => walk(item, scope));
      else walk(value, scope);
    }
  };
  const walk = (node, scope) => {
    if (!node || typeof node !== 'object' || typeof node.type !== 'string') return;
    scopeByNode.set(node, scope);
    if (node.type === 'Program') {
      node.body?.forEach((statement) => walk(statement, scope));
      return;
    }
    if (node.type === 'ImportDeclaration') {
      for (const specifier of node.specifiers || []) {
        scopeByNode.set(specifier, scope);
        declareIdentifier(specifier.local, scope, 'import');
      }
      walk(node.source, scope);
      return;
    }
    if (['FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression'].includes(node.type)) {
      if (node.type === 'FunctionDeclaration') declareIdentifier(node.id, scope, 'function');
      const functionScope = createScope(scope, 'function', node);
      if (node.type === 'FunctionExpression' && node.id) {
        declareIdentifier(node.id, functionScope, 'function-name');
      }
      node.params?.forEach((parameter) => declarePattern(parameter, functionScope, 'parameter'));
      // Parameter initializers run before the function body's var environment exists.
      // Mirror the parameter/name bindings without exposing body var declarations to them.
      const parameterInitializerScope = createScope(scope, 'parameter-initializer', node);
      for (const binding of functionScope.bindings.values()) {
        if ([...binding.kinds].some((kind) => ['function-name', 'parameter'].includes(kind))) {
          parameterInitializerScope.bindings.set(binding.name, binding);
        }
      }
      node.params?.forEach((parameter) => (
        visitPatternExpressions(parameter, parameterInitializerScope, walk)
      ));
      walk(node.body, functionScope);
      return;
    }
    if (node.type === 'BlockStatement') {
      const blockScope = createScope(scope, 'block', node);
      node.body?.forEach((statement) => walk(statement, blockScope));
      return;
    }
    if (node.type === 'CatchClause') {
      const catchScope = createScope(scope, 'catch', node);
      declarePattern(node.param, catchScope, 'catch');
      visitPatternExpressions(node.param, catchScope, walk);
      walk(node.body, catchScope);
      return;
    }
    if (node.type === 'SwitchStatement') {
      walk(node.discriminant, scope);
      const switchScope = createScope(scope, 'block', node);
      node.cases?.forEach((switchCase) => walk(switchCase, switchScope));
      return;
    }
    if (['ForStatement', 'ForInStatement', 'ForOfStatement'].includes(node.type)) {
      const loopScope = createScope(scope, 'block', node);
      genericChildren(node, loopScope, walk);
      return;
    }
    if (node.type === 'StaticBlock') {
      const staticBlockScope = createScope(scope, 'static-block', node);
      node.body?.forEach((statement) => walk(statement, staticBlockScope));
      return;
    }
    if (node.type === 'VariableDeclaration') {
      const declarationScope = node.kind === 'var' ? nearestVarScope(scope) : scope;
      for (const declaration of node.declarations || []) {
        scopeByNode.set(declaration, scope);
        declarePattern(declaration.id, declarationScope, node.kind);
      }
      for (const declaration of node.declarations || []) {
        visitPatternExpressions(declaration.id, scope, walk);
        walk(declaration.init, scope);
      }
      return;
    }
    if (node.type === 'ClassDeclaration') {
      declareIdentifier(node.id, scope, 'class');
      walk(node.superClass, scope);
      walk(node.body, scope);
      return;
    }
    if (node.type === 'ClassExpression') {
      const classScope = createScope(scope, 'class', node);
      if (node.id) declareIdentifier(node.id, classScope, 'class-name');
      walk(node.superClass, classScope);
      walk(node.body, classScope);
      return;
    }
    genericChildren(node, scope, walk);
  };
  walk(program, rootScope);
  const resolveIdentifier = (identifier) => {
    if (identifier?.type !== 'Identifier') return null;
    const declared = declarationBindingByNode.get(identifier);
    if (declared) return declared;
    let scope = scopeByNode.get(identifier) || rootScope;
    while (scope) {
      const binding = scope.bindings.get(identifier.name);
      if (binding) return binding;
      scope = scope.parent;
    }
    return null;
  };
  return {
    bindings,
    declarationBindingByNode,
    rootScope,
    scopeByNode,
    scopes,
    resolveIdentifier,
    isDeclarationIdentifier: (identifier) => declarationBindingByNode.has(identifier),
  };
}

function mr1597AstFingerprint(node) {
  if (Array.isArray(node)) return node.map(mr1597AstFingerprint);
  if (!node || typeof node !== 'object') return node;
  return Object.fromEntries(Object.entries(node)
    .filter(([key]) => !['end', 'loc', 'range', 'raw', 'start'].includes(key))
    .map(([key, value]) => [key, mr1597AstFingerprint(value)]));
}

const MR1597_WORKER_ENTRY_HARNESS_SOURCE = [
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

const MR1597_WORKER_ENTRY_HARNESS_AST = (() => {
  const template = parse(MR1597_WORKER_ENTRY_HARNESS_SOURCE, {
    allowHashBang: true,
    ecmaVersion: 'latest',
    sourceType: 'module',
  });
  return {
    path: mr1597AstFingerprint(template.body[0]),
    harness: mr1597AstFingerprint(template.body[1]),
  };
})();

function mr1597StaticMemberName(node) {
  const expression = unwrapJavaScriptChain(node);
  if (expression?.type !== 'MemberExpression') return null;
  if (!expression.computed && expression.property?.type === 'Identifier') {
    return expression.property.name;
  }
  if (expression.computed && expression.property?.type === 'Literal'
    && ['string', 'number'].includes(typeof expression.property.value)) {
    return String(expression.property.value);
  }
  if (expression.computed
    && expression.property?.type === 'TemplateLiteral'
    && expression.property.expressions?.length === 0
    && expression.property.quasis?.length === 1) {
    return expression.property.quasis[0].value.cooked;
  }
  return null;
}

function observeMr1597DynamicCodeExecution(program, ownerCallback) {
  const K = Object.freeze({
    dynamic: 'dynamic',
    createRequire: 'create-require',
    eval: 'eval',
    function: 'function',
    globalObject: 'global-object',
    moduleLoader: 'module-loader',
    object: 'object',
    reflect: 'reflect',
    reflectApply: 'reflect-apply',
    reflectConstruct: 'reflect-construct',
    reflectGet: 'reflect-get',
    vmExecution: 'vm-execution',
    vmModuleLoad: 'vm-module-load',
    vmObject: 'vm-object',
  });
  const vmOperations = new Set([
    'Script', 'SourceTextModule', 'SyntheticModule', 'compileFunction',
    'runInContext', 'runInNewContext', 'runInThisContext',
  ]);
  const index = createJavaScriptLexicalBindingIndex(program);
  const allNodes = [];
  const parentByNode = new WeakMap();
  visitJavaScriptAst(program, (node, parent) => {
    allNodes.push(node);
    if (parent) parentByNode.set(node, parent);
  });
  const isUnboundIdentifier = (node, name) => node?.type === 'Identifier'
    && node.name === name
    && index.resolveIdentifier(node) === null;
  const isGlobalObject = (node) => {
    const expression = unwrapJavaScriptChain(node);
    return expression?.type === 'Identifier'
      && ['global', 'globalThis', 'self', 'window'].includes(expression.name)
      && index.resolveIdentifier(expression) === null;
  };
  const makeMemberSource = (object, propertyName) => ({
    type: 'QbotStaticMemberSource',
    object,
    propertyName,
    start: object?.start,
    end: object?.end,
  });
  const valueSourcesByBinding = new Map();
  const seedKindsByBinding = new Map();
  const addSource = (binding, source) => {
    if (!binding || !source) return;
    if (!valueSourcesByBinding.has(binding)) valueSourcesByBinding.set(binding, []);
    valueSourcesByBinding.get(binding).push(source);
  };
  const addSeed = (binding, kind) => {
    if (!binding) return;
    if (!seedKindsByBinding.has(binding)) seedKindsByBinding.set(binding, new Set());
    seedKindsByBinding.get(binding).add(kind);
  };
  const bindPatternSource = (pattern, source) => {
    if (!pattern || typeof pattern !== 'object') return;
    if (pattern.type === 'Identifier') {
      addSource(index.resolveIdentifier(pattern), source);
      return;
    }
    if (pattern.type === 'AssignmentPattern') {
      bindPatternSource(pattern.left, source);
      bindPatternSource(pattern.left, pattern.right);
      return;
    }
    if (pattern.type === 'RestElement') {
      bindPatternSource(pattern.argument, makeMemberSource(source, null));
      return;
    }
    if (pattern.type === 'ArrayPattern') {
      pattern.elements?.forEach((element, position) => {
        if (!element) return;
        const value = source?.type === 'ArrayExpression'
          ? source.elements?.[position]
          : makeMemberSource(source, String(position));
        bindPatternSource(element, value?.type === 'SpreadElement' ? value.argument : value);
      });
      return;
    }
    if (pattern.type === 'ObjectPattern') {
      for (const property of pattern.properties || []) {
        if (property.type === 'RestElement') {
          bindPatternSource(property.argument, makeMemberSource(source, null));
          continue;
        }
        const propertyName = staticallyResolvableJavaScriptPropertyName(property);
        let value = makeMemberSource(source, propertyName);
        if (source?.type === 'ObjectExpression' && propertyName !== null) {
          const matches = (source.properties || []).filter((candidate) => (
            staticallyResolvableJavaScriptPropertyName(candidate) === propertyName
          ));
          if (matches.length === 1) value = matches[0].value;
        }
        bindPatternSource(property.value, value);
      }
    }
  };
  for (const node of allNodes) {
    if (node.type === 'ImportDeclaration'
      && node.source?.type === 'Literal'
      && node.source.value === 'node:module') {
      for (const specifier of node.specifiers || []) {
        if (specifier.type === 'ImportSpecifier'
          && (specifier.imported?.name || specifier.imported?.value) === 'createRequire') {
          addSeed(index.resolveIdentifier(specifier.local), K.createRequire);
        }
      }
    } else if (node.type === 'ImportDeclaration'
      && node.source?.type === 'Literal'
      && ['node:vm', 'vm'].includes(node.source.value)) {
      for (const specifier of node.specifiers || []) {
        const binding = index.resolveIdentifier(specifier.local);
        if (specifier.type !== 'ImportSpecifier') addSeed(binding, K.vmObject);
        else if (vmOperations.has(specifier.imported?.name || specifier.imported?.value)) {
          addSeed(binding, K.vmExecution);
        }
      }
    } else if (node.type === 'FunctionDeclaration' && node.id) {
      addSource(index.resolveIdentifier(node.id), node);
    } else if (node.type === 'VariableDeclarator') {
      bindPatternSource(node.id, node.init);
    } else if (node.type === 'AssignmentExpression'
      && ALIASING_ASSIGNMENT_OPERATORS.has(node.operator)) {
      bindPatternSource(node.left, node.right);
    } else if (node.type === 'ForOfStatement') {
      const target = node.left?.type === 'VariableDeclaration'
        ? node.left.declarations?.[0]?.id : node.left;
      const iterable = unwrapJavaScriptChain(node.right);
      if (iterable?.type === 'ArrayExpression') {
        for (const element of iterable.elements || []) {
          bindPatternSource(target, element?.type === 'SpreadElement' ? element.argument : element);
        }
      } else {
        bindPatternSource(target, makeMemberSource(iterable, null));
      }
    }
  }

  const memberWrites = [];
  const addMemberWrite = (object, propertyName, value, forwardObject = null) => {
    if (object) memberWrites.push({ object, propertyName, value, forwardObject });
  };
  const isGlobalBuiltinMember = (node, family, operation) => {
    const expression = unwrapJavaScriptChain(node);
    return expression?.type === 'MemberExpression'
      && isUnboundIdentifier(unwrapJavaScriptChain(expression.object), family)
      && mr1597StaticMemberName(expression) === operation;
  };
  const exactDescriptorValue = (descriptor) => {
    if (descriptor?.type !== 'ObjectExpression') return null;
    const matches = descriptor.properties?.filter((property) => (
      property.type === 'Property'
      && staticallyResolvableJavaScriptPropertyName(property) === 'value'
      && property.kind === 'init'
      && property.method !== true
    )) || [];
    return matches.length === 1 ? matches[0].value : null;
  };
  for (const node of allNodes) {
    if (node.type === 'AssignmentExpression'
      && ALIASING_ASSIGNMENT_OPERATORS.has(node.operator)
      && unwrapJavaScriptChain(node.left)?.type === 'MemberExpression') {
      const target = unwrapJavaScriptChain(node.left);
      addMemberWrite(target.object, mr1597StaticMemberName(target), node.right);
    }
    if (node.type !== 'CallExpression' || node.optional === true) continue;
    const callee = unwrapJavaScriptChain(node.callee);
    if (isGlobalBuiltinMember(callee, 'Object', 'defineProperty')
      || isGlobalBuiltinMember(callee, 'Reflect', 'defineProperty')) {
      const property = node.arguments?.[1];
      const propertyName = property?.type === 'Literal'
        && ['string', 'number'].includes(typeof property.value) ? String(property.value) : null;
      addMemberWrite(node.arguments?.[0], propertyName, exactDescriptorValue(node.arguments?.[2]));
    } else if (isGlobalBuiltinMember(callee, 'Object', 'defineProperties')) {
      const descriptors = node.arguments?.[1];
      if (descriptors?.type === 'ObjectExpression') {
        for (const property of descriptors.properties || []) {
          if (property.type !== 'Property') continue;
          addMemberWrite(
            node.arguments?.[0],
            staticallyResolvableJavaScriptPropertyName(property),
            exactDescriptorValue(property.value),
          );
        }
      }
    } else if (isGlobalBuiltinMember(callee, 'Reflect', 'set')) {
      const property = node.arguments?.[1];
      const propertyName = property?.type === 'Literal'
        && ['string', 'number'].includes(typeof property.value) ? String(property.value) : null;
      addMemberWrite(node.arguments?.[0], propertyName, node.arguments?.[2]);
    } else if (isGlobalBuiltinMember(callee, 'Object', 'assign')) {
      for (const source of (node.arguments || []).slice(1)) {
        if (source?.type === 'ObjectExpression') {
          for (const property of source.properties || []) {
            if (property.type === 'SpreadElement') {
              addMemberWrite(node.arguments?.[0], null, null, property.argument);
            } else {
              addMemberWrite(
                node.arguments?.[0],
                staticallyResolvableJavaScriptPropertyName(property),
                property.value,
              );
            }
          }
        } else {
          addMemberWrite(node.arguments?.[0], null, null, source);
        }
      }
    }
  }

  const mergeRows = (rows) => ({
    values: rows.flatMap((row) => row.values),
    indeterminate: rows.some((row) => row.indeterminate),
  });
  const containerIdentitySet = (node, seenBindings = new Set(), seenNodes = new Set()) => {
    const expression = unwrapJavaScriptChain(node);
    const identities = new Set();
    if (!expression || typeof expression !== 'object') return identities;
    if (expression.type === 'QbotStaticMemberSource') {
      return containerIdentitySet(expression.object, seenBindings, seenNodes);
    }
    const nodeKey = `${expression.start ?? -1}:${expression.end ?? -1}:${expression.type}`;
    if (seenNodes.has(nodeKey)) return identities;
    const nextNodes = new Set(seenNodes).add(nodeKey);
    if (expression.type === 'Identifier') {
      const binding = index.resolveIdentifier(expression);
      if (!binding) return identities;
      identities.add(`binding:${binding.id}`);
      if (seenBindings.has(binding)) return identities;
      const nextBindings = new Set(seenBindings).add(binding);
      for (const source of valueSourcesByBinding.get(binding) || []) {
        for (const identity of containerIdentitySet(source, nextBindings, nextNodes)) {
          identities.add(identity);
        }
      }
      return identities;
    }
    if (['ObjectExpression', 'ArrayExpression', 'FunctionExpression', 'ArrowFunctionExpression'].includes(expression.type)) {
      identities.add(`node:${nodeKey}`);
      return identities;
    }
    if (['AwaitExpression', 'YieldExpression'].includes(expression.type)) {
      return containerIdentitySet(expression.argument, seenBindings, nextNodes);
    }
    if (expression.type === 'AssignmentExpression') {
      return containerIdentitySet(expression.right, seenBindings, nextNodes);
    }
    if (expression.type === 'SequenceExpression') {
      return containerIdentitySet(expression.expressions?.at(-1), seenBindings, nextNodes);
    }
    if (expression.type === 'ConditionalExpression' || expression.type === 'LogicalExpression') {
      const branches = expression.type === 'ConditionalExpression'
        ? [expression.consequent, expression.alternate] : [expression.left, expression.right];
      for (const branch of branches) {
        for (const identity of containerIdentitySet(branch, seenBindings, nextNodes)) identities.add(identity);
      }
      return identities;
    }
    if (expression.type === 'CallExpression'
      && isUnboundIdentifier(expression.callee, 'Object')
      && expression.arguments?.length === 1) {
      return containerIdentitySet(expression.arguments[0], seenBindings, nextNodes);
    }
    return identities;
  };
  const mayAliasContainer = (left, right) => {
    const leftIdentities = containerIdentitySet(left);
    const rightIdentities = containerIdentitySet(right);
    return [...leftIdentities].some((identity) => rightIdentities.has(identity));
  };
  const resolveContainerMemberValues = (containerNode, memberName, seen = new Set()) => {
    const container = unwrapJavaScriptChain(containerNode);
    if (!container) return { values: [], indeterminate: true };
    if (container.type === 'QbotStaticMemberSource') {
      const first = resolveContainerMemberValues(container.object, container.propertyName, seen);
      const rows = first.values.map((value) => resolveContainerMemberValues(value, memberName, seen));
      const merged = mergeRows(rows);
      return { values: merged.values, indeterminate: first.indeterminate || merged.indeterminate };
    }
    const seenKey = `${container.start ?? -1}:${container.end ?? -1}:${container.type}:${memberName ?? '*'}`;
    if (seen.has(seenKey)) return { values: [], indeterminate: true };
    const nextSeen = new Set(seen).add(seenKey);
    const rows = [];
    let indeterminate = false;
    const includeWrites = () => {
      for (const write of memberWrites) {
        if (!mayAliasContainer(container, write.object)) continue;
        if (write.propertyName !== null && memberName !== null && write.propertyName !== memberName) continue;
        if (write.forwardObject) {
          rows.push(resolveContainerMemberValues(write.forwardObject, memberName, nextSeen));
        } else if (write.value) {
          rows.push({ values: [write.value], indeterminate: write.propertyName === null });
        } else {
          indeterminate = true;
        }
      }
    };
    if (container.type === 'Identifier') {
      const binding = index.resolveIdentifier(container);
      if (!binding) return { values: [], indeterminate: true };
      for (const source of valueSourcesByBinding.get(binding) || []) {
        rows.push(resolveContainerMemberValues(source, memberName, nextSeen));
      }
      includeWrites();
      const merged = mergeRows(rows);
      return {
        values: merged.values,
        indeterminate: indeterminate || merged.indeterminate
          || ((valueSourcesByBinding.get(binding) || []).length === 0 && rows.length === 0),
      };
    }
    if (container.type === 'ObjectExpression') {
      for (const property of container.properties || []) {
        if (property.type === 'SpreadElement') {
          rows.push(resolveContainerMemberValues(property.argument, memberName, nextSeen));
          continue;
        }
        const propertyName = staticallyResolvableJavaScriptPropertyName(property);
        if (propertyName === null) {
          rows.push({ values: [property.value], indeterminate: true });
        } else if (memberName === null || propertyName === memberName) {
          rows.push({ values: [property.value], indeterminate: false });
        }
      }
      includeWrites();
      const merged = mergeRows(rows);
      return { values: merged.values, indeterminate: indeterminate || merged.indeterminate };
    }
    if (container.type === 'ArrayExpression') {
      const elements = container.elements || [];
      if (memberName !== null && /^\d+$/u.test(memberName)) {
        const selected = elements[Number(memberName)];
        if (selected) rows.push({
          values: [selected.type === 'SpreadElement' ? selected.argument : selected],
          indeterminate: selected.type === 'SpreadElement',
        });
      } else {
        rows.push({
          values: elements.filter(Boolean).map((element) => (
            element.type === 'SpreadElement' ? element.argument : element
          )),
          indeterminate: memberName === null || elements.some((element) => element?.type === 'SpreadElement'),
        });
      }
      includeWrites();
      const merged = mergeRows(rows);
      return { values: merged.values, indeterminate: indeterminate || merged.indeterminate };
    }
    if (['AwaitExpression', 'YieldExpression'].includes(container.type)) {
      return resolveContainerMemberValues(container.argument, memberName, nextSeen);
    }
    if (container.type === 'AssignmentExpression') {
      return resolveContainerMemberValues(container.right, memberName, nextSeen);
    }
    if (container.type === 'SequenceExpression') {
      return resolveContainerMemberValues(container.expressions?.at(-1), memberName, nextSeen);
    }
    if (container.type === 'ConditionalExpression' || container.type === 'LogicalExpression') {
      const branches = container.type === 'ConditionalExpression'
        ? [container.consequent, container.alternate] : [container.left, container.right];
      return mergeRows(branches.map((branch) => (
        resolveContainerMemberValues(branch, memberName, nextSeen)
      )));
    }
    if (container.type === 'MemberExpression') {
      const first = resolveContainerMemberValues(
        container.object,
        mr1597StaticMemberName(container),
        nextSeen,
      );
      const merged = mergeRows(first.values.map((value) => (
        resolveContainerMemberValues(value, memberName, nextSeen)
      )));
      return { values: merged.values, indeterminate: first.indeterminate || merged.indeterminate };
    }
    if (container.type === 'CallExpression') {
      const callee = unwrapJavaScriptChain(container.callee);
      if (isUnboundIdentifier(callee, 'Object') && container.arguments?.length === 1) {
        return resolveContainerMemberValues(container.arguments[0], memberName, nextSeen);
      }
      if (isGlobalBuiltinMember(callee, 'Object', 'assign')) {
        return mergeRows((container.arguments || []).map((argument) => (
          resolveContainerMemberValues(
            argument?.type === 'SpreadElement' ? argument.argument : argument,
            memberName,
            nextSeen,
          )
        )));
      }
    }
    return { values: [], indeterminate: true };
  };

  const functionReturnValues = (functionNode) => {
    if (functionNode?.type === 'ArrowFunctionExpression' && functionNode.body?.type !== 'BlockStatement') {
      return [functionNode.body];
    }
    const values = [];
    const visit = (node, root = false) => {
      if (!node || typeof node !== 'object' || typeof node.type !== 'string') return;
      if (!root && ['ArrowFunctionExpression', 'FunctionExpression', 'FunctionDeclaration'].includes(node.type)) return;
      if (node.type === 'ReturnStatement') {
        if (node.argument) values.push(node.argument);
        return;
      }
      for (const [key, value] of Object.entries(node)) {
        if (['end', 'loc', 'range', 'raw', 'start', 'type'].includes(key)) continue;
        if (Array.isArray(value)) value.forEach((item) => visit(item));
        else visit(value);
      }
    };
    visit(functionNode, true);
    return values;
  };
  const functionNodesForExpression = (node, seenBindings = new Set(), seenNodes = new Set()) => {
    const expression = unwrapJavaScriptChain(node);
    const functions = new Set();
    if (!expression || typeof expression !== 'object') return functions;
    if (expression.type === 'QbotStaticMemberSource') {
      const resolved = resolveContainerMemberValues(expression.object, expression.propertyName);
      for (const value of resolved.values) {
        for (const fn of functionNodesForExpression(value, seenBindings, seenNodes)) functions.add(fn);
      }
      return functions;
    }
    const key = `${expression.start ?? -1}:${expression.end ?? -1}:${expression.type}`;
    if (seenNodes.has(key)) return functions;
    const nextNodes = new Set(seenNodes).add(key);
    if (['ArrowFunctionExpression', 'FunctionExpression', 'FunctionDeclaration'].includes(expression.type)) {
      functions.add(expression);
      return functions;
    }
    if (expression.type === 'Identifier') {
      const binding = index.resolveIdentifier(expression);
      if (!binding || seenBindings.has(binding)) return functions;
      const nextBindings = new Set(seenBindings).add(binding);
      for (const source of valueSourcesByBinding.get(binding) || []) {
        for (const fn of functionNodesForExpression(source, nextBindings, nextNodes)) functions.add(fn);
      }
      return functions;
    }
    if (['AwaitExpression', 'YieldExpression'].includes(expression.type)) {
      return functionNodesForExpression(expression.argument, seenBindings, nextNodes);
    }
    if (expression.type === 'AssignmentExpression') {
      return functionNodesForExpression(expression.right, seenBindings, nextNodes);
    }
    if (expression.type === 'SequenceExpression') {
      return functionNodesForExpression(expression.expressions?.at(-1), seenBindings, nextNodes);
    }
    if (expression.type === 'ConditionalExpression' || expression.type === 'LogicalExpression') {
      const branches = expression.type === 'ConditionalExpression'
        ? [expression.consequent, expression.alternate] : [expression.left, expression.right];
      for (const branch of branches) {
        for (const fn of functionNodesForExpression(branch, seenBindings, nextNodes)) functions.add(fn);
      }
    }
    if (expression.type === 'MemberExpression') {
      const resolved = resolveContainerMemberValues(expression.object, mr1597StaticMemberName(expression));
      for (const value of resolved.values) {
        for (const fn of functionNodesForExpression(value, seenBindings, nextNodes)) functions.add(fn);
      }
    }
    return functions;
  };

  const expressionKinds = (node, seenBindings = new Set(), seenNodes = new Set()) => {
    const expression = unwrapJavaScriptChain(node);
    const kinds = new Set();
    if (!expression || typeof expression !== 'object') return kinds;
    if (expression.type === 'QbotStaticMemberSource') {
      const objectKinds = expressionKinds(expression.object, seenBindings, seenNodes);
      if (objectKinds.has(K.globalObject) && expression.propertyName === 'eval') kinds.add(K.eval);
      if (objectKinds.has(K.globalObject) && expression.propertyName === 'Function') kinds.add(K.function);
      if (objectKinds.has(K.reflect) && expression.propertyName === 'apply') kinds.add(K.reflectApply);
      if (objectKinds.has(K.reflect) && expression.propertyName === 'construct') kinds.add(K.reflectConstruct);
      if (objectKinds.has(K.reflect) && expression.propertyName === 'get') kinds.add(K.reflectGet);
      if (objectKinds.has(K.vmObject)
        && (expression.propertyName === null || vmOperations.has(expression.propertyName))) {
        kinds.add(K.vmExecution);
      }
      const resolved = resolveContainerMemberValues(expression.object, expression.propertyName);
      for (const value of resolved.values) {
        for (const kind of expressionKinds(value, seenBindings, seenNodes)) kinds.add(kind);
      }
      if (expression.propertyName === null) kinds.add(K.dynamic);
      return kinds;
    }
    const key = `${expression.start ?? -1}:${expression.end ?? -1}:${expression.type}`;
    if (seenNodes.has(key)) return kinds;
    const nextNodes = new Set(seenNodes).add(key);
    if (expression.type === 'Identifier') {
      if (isUnboundIdentifier(expression, 'eval')) kinds.add(K.eval);
      else if (isUnboundIdentifier(expression, 'Function')) kinds.add(K.function);
      else if (isUnboundIdentifier(expression, 'Reflect')) kinds.add(K.reflect);
      else if (isUnboundIdentifier(expression, 'Object')) kinds.add(K.object);
      else if (isGlobalObject(expression)) kinds.add(K.globalObject);
      const binding = index.resolveIdentifier(expression);
      if (!binding || seenBindings.has(binding)) return kinds;
      for (const kind of seedKindsByBinding.get(binding) || []) kinds.add(kind);
      const nextBindings = new Set(seenBindings).add(binding);
      for (const source of valueSourcesByBinding.get(binding) || []) {
        for (const kind of expressionKinds(source, nextBindings, nextNodes)) kinds.add(kind);
      }
      return kinds;
    }
    if (['AwaitExpression', 'YieldExpression'].includes(expression.type)) {
      return expressionKinds(expression.argument, seenBindings, nextNodes);
    }
    if (expression.type === 'AssignmentExpression') {
      return expressionKinds(expression.right, seenBindings, nextNodes);
    }
    if (expression.type === 'SequenceExpression') {
      return expressionKinds(expression.expressions?.at(-1), seenBindings, nextNodes);
    }
    if (expression.type === 'ConditionalExpression' || expression.type === 'LogicalExpression') {
      const branches = expression.type === 'ConditionalExpression'
        ? [expression.consequent, expression.alternate] : [expression.left, expression.right];
      for (const branch of branches) {
        for (const kind of expressionKinds(branch, seenBindings, nextNodes)) kinds.add(kind);
      }
      return kinds;
    }
    if (expression.type === 'MemberExpression') {
      const propertyName = mr1597StaticMemberName(expression);
      const objectKinds = expressionKinds(expression.object, seenBindings, nextNodes);
      if (objectKinds.has(K.globalObject) && propertyName === 'eval') kinds.add(K.eval);
      if (objectKinds.has(K.globalObject) && propertyName === 'Function') kinds.add(K.function);
      if (objectKinds.has(K.reflect) && propertyName === 'apply') kinds.add(K.reflectApply);
      if (objectKinds.has(K.reflect) && propertyName === 'construct') kinds.add(K.reflectConstruct);
      if (objectKinds.has(K.reflect) && propertyName === 'get') kinds.add(K.reflectGet);
      if (objectKinds.has(K.vmObject) && (propertyName === null || vmOperations.has(propertyName))) {
        kinds.add(K.vmExecution);
      }
      const resolved = resolveContainerMemberValues(expression.object, propertyName);
      for (const value of resolved.values) {
        for (const kind of expressionKinds(value, seenBindings, nextNodes)) kinds.add(kind);
      }
      if (propertyName === null) kinds.add(K.dynamic);
      return kinds;
    }
    if (expression.type === 'CallExpression') {
      const callee = unwrapJavaScriptChain(expression.callee);
      const propertyName = mr1597StaticMemberName(callee);
      const calleeKinds = expressionKinds(callee, seenBindings, nextNodes);
      const calleeObjectKinds = callee?.type === 'MemberExpression'
        ? expressionKinds(callee.object, seenBindings, nextNodes) : new Set();
      if (isExactRequireCall(expression, 'node:vm') || isExactRequireCall(expression, 'vm')) {
        kinds.add(K.vmModuleLoad);
        kinds.add(K.vmObject);
        return kinds;
      }
      if (calleeKinds.has(K.createRequire)
        && expression.arguments?.length === 1
        && isExactImportMetaUrl(expression.arguments[0])) {
        kinds.add(K.moduleLoader);
      }
      let moduleLoaderArguments = null;
      if (calleeKinds.has(K.moduleLoader) && !['call', 'apply'].includes(propertyName)) {
        moduleLoaderArguments = expression.arguments || [];
      } else if (calleeObjectKinds.has(K.moduleLoader) && propertyName === 'call') {
        moduleLoaderArguments = (expression.arguments || []).slice(1);
      } else if (calleeObjectKinds.has(K.moduleLoader) && propertyName === 'apply') {
        const forwarded = expression.arguments?.[1];
        if (forwarded?.type === 'ArrayExpression'
          && !forwarded.elements?.some((element) => element?.type === 'SpreadElement')) {
          moduleLoaderArguments = forwarded.elements;
        }
      } else if ((calleeKinds.has(K.reflectApply) || calleeKinds.has(K.reflectConstruct))
        && expressionKinds(expression.arguments?.[0], seenBindings, nextNodes).has(K.moduleLoader)) {
        const forwarded = expression.arguments?.[2] || expression.arguments?.[1];
        if (forwarded?.type === 'ArrayExpression'
          && !forwarded.elements?.some((element) => element?.type === 'SpreadElement')) {
          moduleLoaderArguments = forwarded.elements;
        }
      }
      if (moduleLoaderArguments?.[0]?.type === 'Literal'
        && ['node:vm', 'vm'].includes(moduleLoaderArguments[0].value)) {
        kinds.add(K.vmModuleLoad);
        kinds.add(K.vmObject);
      }
      if (callee?.type === 'MemberExpression' && propertyName === 'bind') {
        for (const kind of calleeObjectKinds) kinds.add(kind);
        return kinds;
      }
      if (calleeKinds.has(K.reflectGet)) {
        const target = expression.arguments?.[0];
        const property = expression.arguments?.[1];
        const propertyName = property?.type === 'Literal'
          && ['string', 'number'].includes(typeof property.value) ? String(property.value) : null;
        if (propertyName === 'eval' && isGlobalObject(target)) kinds.add(K.eval);
        else if (propertyName === 'Function' && isGlobalObject(target)) kinds.add(K.function);
        else {
          const resolved = resolveContainerMemberValues(target, propertyName);
          for (const value of resolved.values) {
            for (const kind of expressionKinds(value, seenBindings, nextNodes)) kinds.add(kind);
          }
          if (propertyName === null || resolved.indeterminate) kinds.add(K.dynamic);
        }
      }
      if (isUnboundIdentifier(callee, 'Object') && expression.arguments?.length === 1) {
        for (const kind of expressionKinds(expression.arguments[0], seenBindings, nextNodes)) kinds.add(kind);
      }
      if (isGlobalBuiltinMember(callee, 'Object', 'assign')) {
        for (const argument of expression.arguments || []) {
          for (const kind of expressionKinds(
            argument?.type === 'SpreadElement' ? argument.argument : argument,
            seenBindings,
            nextNodes,
          )) kinds.add(kind);
        }
      }
      for (const fn of functionNodesForExpression(callee)) {
        for (const returned of functionReturnValues(fn)) {
          for (const kind of expressionKinds(returned, seenBindings, nextNodes)) kinds.add(kind);
        }
      }
      return kinds;
    }
    if (expression.type === 'ObjectExpression') {
      for (const property of expression.properties || []) {
        if (property.type !== 'SpreadElement') continue;
        const spreadKinds = expressionKinds(property.argument, seenBindings, nextNodes);
        if (spreadKinds.has(K.vmObject)) kinds.add(K.vmObject);
      }
      return kinds;
    }
    return kinds;
  };

  const containsKinds = (node, wanted, seen = new Set()) => {
    const expression = unwrapJavaScriptChain(node);
    if (!expression || typeof expression !== 'object') return false;
    const key = `${expression.start ?? -1}:${expression.end ?? -1}:${expression.type}`;
    if (seen.has(key)) return false;
    const nextSeen = new Set(seen).add(key);
    if ([...expressionKinds(expression)].some((kind) => wanted.has(kind))) return true;
    if (['ArrowFunctionExpression', 'FunctionExpression', 'FunctionDeclaration'].includes(expression.type)) {
      return false;
    }
    for (const [field, value] of Object.entries(expression)) {
      if (['end', 'key', 'loc', 'range', 'raw', 'start', 'type'].includes(field)) continue;
      if (Array.isArray(value) && value.some((item) => containsKinds(item, wanted, nextSeen))) return true;
      if (value && typeof value.type === 'string' && containsKinds(value, wanted, nextSeen)) return true;
    }
    return false;
  };

  const exactImports = new Map([
    ['node:events', [['ImportSpecifier', 'EventEmitter', 'EventEmitter']]],
    ['node:fs', [['ImportSpecifier', 'readFileSync', 'readFileSync']]],
    ['node:path', [
      ['ImportSpecifier', 'dirname', 'dirname'],
      ['ImportSpecifier', 'resolve', 'resolve'],
    ]],
    ['node:vm', [['ImportSpecifier', 'runInNewContext', 'runInNewContext']]],
  ]);
  const importMatches = (statement, expected) => statement.type === 'ImportDeclaration'
    && statement.specifiers?.length === expected.length
    && statement.specifiers.every((specifier, position) => {
      const [type, imported, local] = expected[position];
      return specifier.type === type
        && (specifier.imported?.name || specifier.imported?.value) === imported
        && specifier.local?.name === local;
    });
  const observeHarness = () => {
    const importStatements = new Map();
    for (const [source, expected] of exactImports) {
      const candidates = (program.body || []).filter((statement) => (
        statement.type === 'ImportDeclaration' && statement.source?.value === source
      ));
      if (candidates.length !== 1 || !importMatches(candidates[0], expected)) return null;
      importStatements.set(source, candidates[0]);
    }
    const pathDeclarations = (program.body || []).filter((statement) => (
      stableJson(mr1597AstFingerprint(statement)) === stableJson(MR1597_WORKER_ENTRY_HARNESS_AST.path)
    ));
    const harnessDeclarations = (program.body || []).filter((statement) => (
      stableJson(mr1597AstFingerprint(statement)) === stableJson(MR1597_WORKER_ENTRY_HARNESS_AST.harness)
    ));
    if (pathDeclarations.length !== 1 || harnessDeclarations.length !== 1) return null;
    if (index.bindings.filter((binding) => binding.name === 'workerEntryPath').length !== 1
      || index.bindings.filter((binding) => binding.name === 'workerEntryHarness').length !== 1) return null;
    const vmImport = importStatements.get('node:vm');
    const vmBinding = index.resolveIdentifier(vmImport.specifiers[0].local);
    const harness = harnessDeclarations[0];
    const harnessBinding = index.resolveIdentifier(harness.id);
    const vmCalls = [];
    visitJavaScriptAst(harness, (node) => {
      if (node.type === 'CallExpression'
        && node.callee?.type === 'Identifier'
        && index.resolveIdentifier(node.callee) === vmBinding) vmCalls.push(node);
    });
    if (vmCalls.length !== 1) return null;
    const vmReferences = allNodes.filter((node) => (
      node.type === 'Identifier'
      && !index.isDeclarationIdentifier(node)
      && index.resolveIdentifier(node) === vmBinding
    ));
    if (vmReferences.length !== 1 || vmReferences[0] !== vmCalls[0].callee) return null;
    const reachableFunctions = new Set();
    const pending = [ownerCallback];
    while (pending.length > 0) {
      const fn = pending.pop();
      if (!fn || reachableFunctions.has(fn)) continue;
      reachableFunctions.add(fn);
      let harnessReferenced = false;
      visitJavaScriptAst(fn.body || fn, (node) => {
        if (node.type === 'Identifier'
          && !index.isDeclarationIdentifier(node)
          && index.resolveIdentifier(node) === harnessBinding) harnessReferenced = true;
        if (node.type !== 'CallExpression') return;
        for (const target of functionNodesForExpression(node.callee)) {
          if (!reachableFunctions.has(target)) pending.push(target);
        }
      });
      if (harnessReferenced) return null;
    }
    return { allowedCall: vmCalls[0], vmBinding };
  };
  const harness = observeHarness();

  const executionNodes = new Map();
  const record = (node, kind) => {
    const key = `${node?.start ?? -1}:${node?.end ?? -1}`;
    if (!executionNodes.has(key)) executionNodes.set(key, kind);
  };
  const vmRequireNodes = [];
  for (const node of allNodes) {
    if (node.type === 'ImportExpression') {
      record(node, 'dynamic_import');
      continue;
    }
    if (node.type === 'VariableDeclarator') {
      if (!(isExactRequireCall(node.init, 'node:vm') || isExactRequireCall(node.init, 'vm'))
        && containsKinds(node.init, new Set([K.vmExecution, K.vmObject]))) {
        record(node, 'node_vm_escape');
      }
    } else if (node.type === 'AssignmentExpression'
      && containsKinds(node.right, new Set([K.vmExecution, K.vmObject]))) {
      record(node, 'node_vm_escape');
    } else if (node.type === 'ReturnStatement'
      && containsKinds(node.argument, new Set([K.vmExecution, K.vmObject]))) {
      record(node, 'node_vm_escape');
    }
    if (node.type === 'TaggedTemplateExpression') {
      const tagKinds = expressionKinds(node.tag);
      if (tagKinds.has(K.eval)) record(node, 'eval_tagged_template');
      else if (tagKinds.has(K.function)) record(node, 'function_tagged_template');
      else if (tagKinds.has(K.vmExecution)) record(node, 'node_vm_execution');
      else if (unwrapJavaScriptChain(node.tag)?.type === 'MemberExpression'
        && mr1597StaticMemberName(node.tag) === null) record(node, 'dynamic_computed_tag');
      continue;
    }
    if (!['CallExpression', 'NewExpression'].includes(node.type)) continue;
    if (isExactRequireCall(node, 'node:vm') || isExactRequireCall(node, 'vm')) {
      vmRequireNodes.push(node);
      continue;
    }
    const callee = unwrapJavaScriptChain(node.callee);
    const property = mr1597StaticMemberName(callee);
    const calleeObject = callee?.type === 'MemberExpression'
      ? unwrapJavaScriptChain(callee.object) : null;
    const calleeObjectKinds = expressionKinds(calleeObject);
    const calleeKinds = expressionKinds(callee);
    const callResultKinds = expressionKinds(node);
    if (callResultKinds.has(K.vmModuleLoad)
      && !calleeKinds.has(K.vmExecution)
      && !calleeObjectKinds.has(K.vmExecution)) {
      vmRequireNodes.push(node);
      continue;
    }
    if (calleeKinds.has(K.eval)) {
      record(node, isUnboundIdentifier(callee, 'eval') ? 'direct_eval' : 'indirect_eval');
    } else if (calleeKinds.has(K.function)) {
      record(node, 'function_constructor');
    } else if (['call', 'apply'].includes(property) && calleeObjectKinds.has(K.eval)) {
      record(node, 'eval_call_or_apply');
    } else if (['call', 'apply'].includes(property) && calleeObjectKinds.has(K.function)) {
      record(node, 'function_call_or_apply');
    } else if ((calleeKinds.has(K.reflectApply) || calleeKinds.has(K.reflectConstruct))
      && expressionKinds(node.arguments?.[0]).has(K.eval)) {
      record(node, 'reflect_eval');
    } else if ((calleeKinds.has(K.reflectApply) || calleeKinds.has(K.reflectConstruct))
      && expressionKinds(node.arguments?.[0]).has(K.function)) {
      record(node, 'reflect_function_constructor');
    } else if (property === 'constructor'
      || (['call', 'apply'].includes(property)
        && mr1597StaticMemberName(calleeObject) === 'constructor')) {
      record(node, 'member_constructor');
    } else if (calleeKinds.has(K.vmExecution)
      || (['call', 'apply'].includes(property) && calleeObjectKinds.has(K.vmExecution))) {
      if (node !== harness?.allowedCall) record(node, 'node_vm_execution');
    } else if (property === 'bind' && calleeObjectKinds.has(K.vmExecution)) {
      record(node, 'node_vm_escape');
    } else if (calleeKinds.has(K.dynamic)
      || (callee?.type === 'MemberExpression' && callee.computed && property === null)) {
      record(node, 'dynamic_computed_callee');
    } else if ((calleeKinds.has(K.reflectApply) || calleeKinds.has(K.reflectConstruct))
      && containsKinds(node.arguments?.[0], new Set([K.vmExecution, K.vmObject]))) {
      record(node, 'node_vm_execution');
    } else if ((node.arguments || []).some((argument) => (
      containsKinds(argument?.type === 'SpreadElement' ? argument.argument : argument,
        new Set([K.eval, K.function]))
    ))) {
      record(node, 'dynamic_callable_escape');
    } else if ((node.arguments || []).some((argument) => (
      containsKinds(argument?.type === 'SpreadElement' ? argument.argument : argument,
        new Set([K.vmExecution, K.vmObject]))
    ))) {
      record(node, 'node_vm_escape');
    }
  }
  if ([...executionNodes.values()].some((kind) => (
    ['node_vm_execution', 'node_vm_escape'].includes(kind)
  ))) {
    vmRequireNodes.forEach((node) => record(node, 'node_vm_module'));
  }
  const kinds = [...new Set(executionNodes.values())].sort();
  return { count: executionNodes.size, kinds };
}

function mr1597SemanticObservationIsVerified(observation, { requireVerified = true } = {}) {
  const rootKeys = [
    'schema_version', 'javascript_parse_verified', 'top_level_bindings',
    'protected_local_shadow_count', 'protected_binding_violation_count',
    'protected_binding_violation_kinds', 'worker_environment_export_chain',
    'dynamic_code_execution_count', 'dynamic_code_execution_kinds',
    'owner_test_occurrence_count', 'owner_test_top_level', 'owner_callback_parameter_count',
    'env_binding_occurrence_count', 'env_declaration_occurrence_count',
    'env_declaration_direct_statement', 'worker_environment_call_occurrence_count',
    'worker_environment_argument_count', 'input_object_literal', 'input_object_shape',
    'input_identity_properties', 'input_access_token_occurrence_count',
    'deep_equal_call_occurrence_count', 'deep_equal_env_assertion_occurrence_count',
    'assertion_direct_statement', 'assertion_argument_count', 'declaration_precedes_assertion',
    'expected_object_literal', 'expected_object_shape', 'expected_identity_properties',
    'expected_access_token_occurrence_count', 'env_aliases', 'env_mutation_count',
    'env_escape_count', 'verified',
  ];
  const identitiesValid = (rows) => Array.isArray(rows)
    && rows.length === Object.keys(MR1597_EXPECTED_IDENTITY_VALUES).length
    && rows.every((row, index) => {
      const [name, expectedValue] = Object.entries(MR1597_EXPECTED_IDENTITY_VALUES)[index];
      return objectHasExactKeys(row, [
        'name', 'expected_value', 'occurrence_count', 'value', 'verified',
      ])
        && row?.name === name
        && row?.expected_value === expectedValue
        && row?.occurrence_count === 1
        && row?.value === expectedValue
        && row?.verified === true;
    });
  const shapeValid = (shape) => objectHasExactKeys(shape, [
    'property_count', 'spread_count', 'computed_count', 'dynamic_key_count', 'accessor_count',
    'method_count', 'shorthand_count', 'duplicate_key_count', 'verified',
  ])
    && shape?.verified === true
    && Number.isSafeInteger(shape?.property_count)
    && shape.property_count >= Object.keys(MR1597_EXPECTED_IDENTITY_VALUES).length
    && ['spread_count', 'computed_count', 'dynamic_key_count', 'accessor_count', 'method_count',
      'shorthand_count', 'duplicate_key_count'].every((field) => shape?.[field] === 0);
  const expectedTopLevelBindings = MR1597_TOP_LEVEL_BINDING_EXPECTATIONS.map((row) => ({
    ...row, count: 1, verified: true,
  }));
  const expectedExportChain = {
    steps: MR1597_EXPORT_CHAIN_EXPECTATIONS.map((row) => ({ ...row, count: 1, verified: true })),
    protected_binding_violation_count: 0,
    protected_binding_violation_kinds: [],
    verified: true,
  };
  const aliases = observation?.env_aliases;
  return objectHasExactKeys(observation, rootKeys)
    && observation?.schema_version === MR1597_CURRENT_RELEASE_SEMANTICS_SCHEMA
    && observation?.javascript_parse_verified === true
    && stableJson(observation?.top_level_bindings) === stableJson(expectedTopLevelBindings)
    && observation?.protected_binding_violation_count === 0
    && Array.isArray(observation?.protected_binding_violation_kinds)
    && observation.protected_binding_violation_kinds.length === 0
    && stableJson(observation?.worker_environment_export_chain) === stableJson(expectedExportChain)
    && observation?.dynamic_code_execution_count === 0
    && Array.isArray(observation?.dynamic_code_execution_kinds)
    && observation.dynamic_code_execution_kinds.length === 0
    && observation?.owner_test_occurrence_count === 1
    && observation?.owner_test_top_level === true
    && observation?.owner_callback_parameter_count === 0
    && observation?.protected_local_shadow_count === 0
    && observation?.env_binding_occurrence_count === 1
    && observation?.env_declaration_occurrence_count === 1
    && observation?.env_declaration_direct_statement === true
    && observation?.worker_environment_call_occurrence_count === 1
    && observation?.worker_environment_argument_count === 2
    && observation?.input_object_literal === true
    && shapeValid(observation?.input_object_shape)
    && identitiesValid(observation?.input_identity_properties)
    && observation?.input_access_token_occurrence_count === 1
    && observation?.deep_equal_call_occurrence_count === 1
    && observation?.deep_equal_env_assertion_occurrence_count === 1
    && observation?.assertion_direct_statement === true
    && observation?.assertion_argument_count === 2
    && observation?.declaration_precedes_assertion === true
    && observation?.expected_object_literal === true
    && shapeValid(observation?.expected_object_shape)
    && identitiesValid(observation?.expected_identity_properties)
    && observation?.expected_access_token_occurrence_count === 0
    && Array.isArray(aliases)
    && aliases.includes('env')
    && new Set(aliases).size === aliases.length
    && stableJson(aliases) === stableJson([...aliases].sort())
    && aliases.every((name) => typeof name === 'string' && /^[A-Za-z_$][A-Za-z0-9_$]*$/u.test(name))
    && observation?.env_mutation_count === 0
    && observation?.env_escape_count === 0
    && (!requireVerified || observation?.verified === true);
}

function observeMr1597WorkerEnvironmentTestSemantics(sourceByPath, failures) {
  const source = sourceByPath.get(MR1597_TEST_PATH) || '';
  const emptyShape = objectExpressionShapeObservation(null);
  const emptyIdentities = identityPropertyObservations(null);
  const observation = {
    schema_version: MR1597_CURRENT_RELEASE_SEMANTICS_SCHEMA,
    javascript_parse_verified: false,
    top_level_bindings: MR1597_TOP_LEVEL_BINDING_EXPECTATIONS.map((row) => ({
      ...row, count: 0, verified: false,
    })),
    protected_binding_violation_count: 0,
    protected_binding_violation_kinds: [],
    worker_environment_export_chain: observeMr1597ExportChain(sourceByPath),
    dynamic_code_execution_count: 0,
    dynamic_code_execution_kinds: [],
    owner_test_occurrence_count: 0,
    owner_test_top_level: false,
    owner_callback_parameter_count: null,
    protected_local_shadow_count: 0,
    env_binding_occurrence_count: 0,
    env_declaration_occurrence_count: 0,
    env_declaration_direct_statement: false,
    worker_environment_call_occurrence_count: 0,
    worker_environment_argument_count: null,
    input_object_literal: false,
    input_object_shape: emptyShape,
    input_identity_properties: emptyIdentities,
    input_access_token_occurrence_count: 0,
    deep_equal_call_occurrence_count: 0,
    deep_equal_env_assertion_occurrence_count: 0,
    assertion_direct_statement: false,
    assertion_argument_count: null,
    declaration_precedes_assertion: false,
    expected_object_literal: false,
    expected_object_shape: emptyShape,
    expected_identity_properties: emptyIdentities,
    expected_access_token_occurrence_count: 0,
    env_aliases: ['env'],
    env_mutation_count: 0,
    env_escape_count: 0,
    verified: false,
  };
  let program;
  try {
    program = parse(String(source || ''), {
      allowHashBang: true,
      ecmaVersion: 'latest',
      sourceType: 'module',
    });
    observation.javascript_parse_verified = true;
  } catch {
    failures.push('current_release_semantics:mr1597:javascript_parse_failed');
    return observation;
  }

  const topLevelBindings = observeMr1597TopLevelBindings(program);
  observation.top_level_bindings = topLevelBindings.rows;
  const bindingViolations = observeProtectedBindingViolations(program, {
    protectedNames: new Set(MR1597_TOP_LEVEL_BINDING_EXPECTATIONS.map(({ local }) => local)),
    allowedDeclarationNodes: topLevelBindings.allowedDeclarationNodes,
  });
  observation.protected_binding_violation_count = bindingViolations.count;
  observation.protected_binding_violation_kinds = bindingViolations.kinds;
  observation.protected_local_shadow_count = javaScriptDeclarationRecords(program).filter(({ name, node }) => (
    MR1597_TOP_LEVEL_BINDING_EXPECTATIONS.some((expected) => expected.local === name)
      && !topLevelBindings.allowedDeclarationNodes.has(node)
  )).length;

  const parentByNode = new WeakMap();
  const allNodes = [];
  visitJavaScriptAst(program, (node, parent) => {
    allNodes.push(node);
    if (parent) parentByNode.set(node, parent);
  });
  const ownerCalls = allNodes.filter((node) => (
    node.type === 'CallExpression'
    && node.callee?.type === 'Identifier'
    && node.callee.name === 'test'
    && node.arguments?.[0]?.type === 'Literal'
    && node.arguments[0].value === MR1597_TEST_TITLE
  ));
  observation.owner_test_occurrence_count = ownerCalls.length;
  const ownerCall = ownerCalls.length === 1 ? ownerCalls[0] : null;
  const ownerStatement = ownerCall ? parentByNode.get(ownerCall) : null;
  observation.owner_test_top_level = ownerStatement?.type === 'ExpressionStatement'
    && parentByNode.get(ownerStatement)?.type === 'Program';
  const ownerCallback = ownerCall?.arguments?.[1];
  const callbackValid = ['ArrowFunctionExpression', 'FunctionExpression'].includes(ownerCallback?.type)
    && ownerCallback.async === false
    && ownerCallback.generator === false
    && ownerCallback.body?.type === 'BlockStatement';
  observation.owner_callback_parameter_count = callbackValid ? ownerCallback.params.length : null;
  if (!callbackValid || ownerCallback.params.length !== 0) {
    failures.push('current_release_semantics:mr1597:owner_callback_invalid');
  }
  if (!ownerCall || !callbackValid) {
    failures.push('current_release_semantics:mr1597:owner_test_invalid');
    return observation;
  }

  const dynamicExecution = observeMr1597DynamicCodeExecution(program, ownerCallback);
  observation.dynamic_code_execution_count = dynamicExecution.count;
  observation.dynamic_code_execution_kinds = dynamicExecution.kinds;

  const ownerNodes = [];
  const ownerParentByNode = new WeakMap();
  visitJavaScriptAst(ownerCallback.body, (node, parent) => {
    ownerNodes.push(node);
    if (parent) ownerParentByNode.set(node, parent);
  });
  const bindingNames = [];
  for (const node of ownerNodes) {
    if (node.type === 'VariableDeclarator') javaScriptPatternNames(node.id, bindingNames);
    else if (['FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression'].includes(node.type)) {
      if (node.id) javaScriptPatternNames(node.id, bindingNames);
      node.params?.forEach((parameter) => javaScriptPatternNames(parameter, bindingNames));
    } else if (node.type === 'ClassDeclaration' || node.type === 'ClassExpression') {
      if (node.id) javaScriptPatternNames(node.id, bindingNames);
    } else if (node.type === 'CatchClause') javaScriptPatternNames(node.param, bindingNames);
  }
  observation.env_binding_occurrence_count = bindingNames.filter((name) => name === 'env').length;

  const envDeclarations = ownerNodes.filter((node) => (
    node.type === 'VariableDeclarator'
    && node.id?.type === 'Identifier'
    && node.id.name === 'env'
    && ownerParentByNode.get(node)?.type === 'VariableDeclaration'
    && ownerParentByNode.get(node).kind === 'const'
    && ownerParentByNode.get(node).declarations?.length === 1
    && node.init?.type === 'CallExpression'
    && node.init.callee?.type === 'Identifier'
    && node.init.callee.name === 'workerEnvironment'
  ));
  observation.env_declaration_occurrence_count = envDeclarations.length;
  const envDeclaration = envDeclarations.length === 1 ? envDeclarations[0] : null;
  const envDeclarationStatement = envDeclaration ? ownerParentByNode.get(envDeclaration) : null;
  observation.env_declaration_direct_statement = ownerCallback.body.body.includes(envDeclarationStatement);
  const workerCalls = ownerNodes.filter((node) => (
    node.type === 'CallExpression'
    && node.callee?.type === 'Identifier'
    && node.callee.name === 'workerEnvironment'
  ));
  observation.worker_environment_call_occurrence_count = workerCalls.length;
  observation.worker_environment_argument_count = envDeclaration?.init?.arguments?.length ?? null;
  const inputObject = envDeclaration?.init?.arguments?.[0];
  observation.input_object_literal = inputObject?.type === 'ObjectExpression';
  observation.input_object_shape = objectExpressionShapeObservation(inputObject);
  observation.input_identity_properties = identityPropertyObservations(inputObject);
  observation.input_access_token_occurrence_count = inputObject?.type === 'ObjectExpression'
    ? inputObject.properties.filter((property) => (
      staticJavaScriptPropertyName(property) === MR1597_ACCESS_TOKEN_KEY
    )).length : 0;

  const deepEqualCalls = ownerNodes.filter((node) => (
    node.type === 'CallExpression'
    && node.callee?.type === 'MemberExpression'
    && node.callee.computed === false
    && node.callee.object?.type === 'Identifier'
    && node.callee.object.name === 'assert'
    && node.callee.property?.type === 'Identifier'
    && node.callee.property.name === 'deepEqual'
  ));
  observation.deep_equal_call_occurrence_count = deepEqualCalls.length;
  const envAssertions = deepEqualCalls.filter((node) => (
    node.arguments?.length === 2
    && node.arguments[0]?.type === 'Identifier'
    && node.arguments[0].name === 'env'
    && node.arguments[1]?.type === 'ObjectExpression'
  ));
  observation.deep_equal_env_assertion_occurrence_count = envAssertions.length;
  const assertion = envAssertions.length === 1 ? envAssertions[0] : null;
  const assertionStatement = assertion ? ownerParentByNode.get(assertion) : null;
  observation.assertion_direct_statement = assertionStatement?.type === 'ExpressionStatement'
    && ownerCallback.body.body.includes(assertionStatement);
  observation.assertion_argument_count = assertion?.arguments?.length ?? null;
  observation.declaration_precedes_assertion = Boolean(
    envDeclarationStatement && assertionStatement && envDeclarationStatement.start < assertionStatement.start,
  );
  const expectedObject = assertion?.arguments?.[1];
  observation.expected_object_literal = expectedObject?.type === 'ObjectExpression';
  observation.expected_object_shape = objectExpressionShapeObservation(expectedObject);
  observation.expected_identity_properties = identityPropertyObservations(expectedObject);
  let expectedAccessTokenCount = 0;
  if (expectedObject) {
    visitJavaScriptAst(expectedObject, (node) => {
      if (staticJavaScriptPropertyName(node) === MR1597_ACCESS_TOKEN_KEY) expectedAccessTokenCount += 1;
    });
  }
  observation.expected_access_token_occurrence_count = expectedAccessTokenCount;

  const aliases = new Set(['env']);
  let changed = true;
  while (changed) {
    changed = false;
    for (const node of ownerNodes) {
      if (node.type === 'VariableDeclarator'
        && node.id?.type === 'Identifier'
        && expressionMayAliasIdentifier(node.init, aliases)
        && !aliases.has(node.id.name)) {
        aliases.add(node.id.name);
        changed = true;
      }
      if (node.type === 'AssignmentExpression'
        && node.operator === '='
        && node.left?.type === 'Identifier'
        && expressionMayAliasIdentifier(node.right, aliases)
        && !aliases.has(node.left.name)) {
        aliases.add(node.left.name);
        changed = true;
      }
    }
  }
  observation.env_aliases = [...aliases].sort();
  const mutationNodes = new Set();
  const escapeNodes = new Set();
  for (const node of ownerNodes) {
    if (node.type === 'AssignmentExpression' && containsAliasMemberTarget(node.left, aliases)) {
      mutationNodes.add(node);
    } else if (node.type === 'UpdateExpression' && containsAliasMemberTarget(node.argument, aliases)) {
      mutationNodes.add(node);
    } else if (node.type === 'UnaryExpression'
      && node.operator === 'delete'
      && containsAliasMemberTarget(node.argument, aliases)) {
      mutationNodes.add(node);
    }
    if (node.type === 'VariableDeclarator'
      && node.id?.type !== 'Identifier'
      && expressionCarriesAliasIdentifier(node.init, aliases)) {
      escapeNodes.add(node);
    }
    if (node.type === 'VariableDeclarator'
      && node.id?.type === 'Identifier'
      && expressionCarriesAliasIdentifier(node.init, aliases)
      && !expressionMayAliasIdentifier(node.init, aliases)) {
      escapeNodes.add(node);
    }
    if (node.type === 'AssignmentExpression'
      && node.left?.type === 'Identifier'
      && expressionCarriesAliasIdentifier(node.right, aliases)
      && !expressionMayAliasIdentifier(node.right, aliases)) {
      escapeNodes.add(node);
    }
    if (node.type === 'AssignmentExpression'
      && node.left?.type !== 'Identifier'
      && expressionCarriesAliasIdentifier(node.right, aliases)) {
      escapeNodes.add(node);
    }
    if (node.type === 'AssignmentPattern'
      && expressionCarriesAliasIdentifier(node.right, aliases)) {
      escapeNodes.add(node);
    }
    if (['ForInStatement', 'ForOfStatement'].includes(node.type)
      && expressionCarriesAliasIdentifier(node.right, aliases)) {
      escapeNodes.add(node);
    }
    if (node.type === 'CallExpression' || node.type === 'NewExpression') {
      if (node.callee?.type === 'MemberExpression'
        && containsAliasMemberTarget(node.callee, aliases)) mutationNodes.add(node);
      const receiverName = node.callee?.type === 'MemberExpression'
        && node.callee.object?.type === 'Identifier' ? node.callee.object.name : null;
      const operationName = staticMemberExpressionPropertyName(node.callee);
      const knownMutator = (receiverName === 'Object'
        && ['assign', 'defineProperties', 'defineProperty'].includes(operationName))
        || (receiverName === 'Reflect' && ['deleteProperty', 'set'].includes(operationName));
      if (knownMutator && expressionMayAliasIdentifier(node.arguments?.[0], aliases)) {
        mutationNodes.add(node);
      }
      node.arguments?.forEach((argument, index) => {
        const exactAssertionRead = node === assertion
          && index === 0
          && argument?.type === 'Identifier'
          && argument.name === 'env';
        if (!exactAssertionRead && expressionCarriesAliasIdentifier(argument, aliases)) {
          escapeNodes.add(node);
        }
      });
    }
    if (['ReturnStatement', 'ThrowStatement', 'YieldExpression'].includes(node.type)
      && expressionCarriesAliasIdentifier(node.argument, aliases)) {
      escapeNodes.add(node);
    }
    if (node.type === 'TaggedTemplateExpression'
      && expressionCarriesAliasIdentifier(node.quasi, aliases)) {
      escapeNodes.add(node);
    }
  }
  observation.env_mutation_count = mutationNodes.size;
  observation.env_escape_count = escapeNodes.size;
  observation.verified = mr1597SemanticObservationIsVerified(observation, { requireVerified: false });
  if (!observation.verified) failures.push('current_release_semantics:mr1597:worker_environment_test_mismatch');
  return observation;
}

function fragmentOccurrenceCount(source, assertion) {
  const needle = String(assertion?.value?.source ?? '');
  if (!needle) return 0;
  if (text(assertion?.match) === 'line') {
    return String(source || '').split('\n').filter((line) => line === needle).length;
  }
  if (text(assertion?.match) === 'js-property-key') {
    let program;
    try {
      program = parse(String(source || ''), {
        allowHashBang: true,
        ecmaVersion: 'latest',
        sourceType: 'module',
      });
    } catch {
      // A forbidden-key check must never turn malformed JavaScript into zero matches.
      return -1;
    }
    let count = 0;
    const visit = (node) => {
      if (!node || typeof node !== 'object') return;
      if (node.type === 'Property') {
        const key = node.key;
        const staticKey = key?.type === 'Identifier' && !node.computed
          ? key.name
          : key?.type === 'Literal' && typeof key.value === 'string'
            ? key.value
            : key?.type === 'TemplateLiteral'
              && key.expressions?.length === 0
              && key.quasis?.length === 1
              ? key.quasis[0].value.cooked
              : null;
        if (staticKey === needle) count += 1;
      }
      for (const [key, value] of Object.entries(node)) {
        if (['end', 'loc', 'range', 'start', 'type'].includes(key)) continue;
        if (Array.isArray(value)) value.forEach(visit);
        else if (value && typeof value.type === 'string') visit(value);
      }
    };
    visit(program);
    return count;
  }
  if (text(assertion?.match) !== 'substring') throw new Error('forbidden_fragment_match_invalid');
  let count = 0;
  let cursor = 0;
  while (cursor <= String(source || '').length) {
    const found = String(source || '').indexOf(needle, cursor);
    if (found < 0) break;
    count += 1;
    cursor = found + needle.length;
  }
  return count;
}

function exactLineOccurrenceCount(source, line) {
  if (!line) return 0;
  return String(source || '').split('\n').filter((candidate) => candidate === line).length;
}

function currentReleaseSuccessorLineIsVerified(successor, mergeRequests) {
  const candidates = (Array.isArray(mergeRequests) ? mergeRequests : []).filter((row) => (
    text(row?.iid) === successor.mr_iid
      || text(row?.commit) === successor.merge_commit_sha
      || text(row?.merge_commit_sha) === successor.merge_commit_sha
  ));
  if (candidates.length !== 1) return false;
  const [row] = candidates;
  const changedPaths = Array.isArray(row?.changed_paths) ? row.changed_paths.map(text) : [];
  return text(row?.iid) === successor.mr_iid
    && text(row?.commit) === successor.merge_commit_sha
    && text(row?.merge_commit_sha) === successor.merge_commit_sha
    && text(row?.parent) === successor.first_parent_sha
    && Number.isSafeInteger(row?.parent_count)
    && row.parent_count === 2
    && row?.metadata_verified === true
    && text(row?.metadata_source) === successor.metadata_source
    && text(row?.state) === 'merged'
    && text(row?.target_branch) === successor.target_branch
    && text(row?.attribution_kind) === 'merge_mr'
    && Number.isSafeInteger(row?.diff_bytes)
    && row.diff_bytes === successor.diff_bytes
    && text(row?.diff_sha256) === successor.diff_sha256
    && stableJson(changedPaths) === stableJson(successor.changed_paths)
    && new Set(changedPaths).size === changedPaths.length
    && changedPaths.filter((filePath) => filePath === successor.changed_path).length === 1;
}

function currentReleaseSuccessorAncestryProjection(ancestry = {}) {
  return {
    source: text(ancestry?.source),
    compare_from: text(ancestry?.compare_from),
    compare_to: text(ancestry?.compare_to),
    compare_commit_count: Number.isSafeInteger(ancestry?.compare_commit_count)
      ? ancestry.compare_commit_count : null,
    first_parent_complete: ancestry?.first_parent_complete === true,
    query_completed: ancestry?.query_completed === true,
    verified: ancestry?.verified === true,
    reason: text(ancestry?.reason),
  };
}

export function reconstructGitLabFirstParentChain({ compare, baselineCommit, releaseHead } = {}) {
  const validation = validateGitLabFirstParentComparePayload(compare, {
    // An empty compare is a valid, completed negative observation.  The chain
    // walk below turns it into a precise missing-head result when identities
    // differ; rejecting it here would erase that distinction during replay.
    allowEmptyCommits: true,
  });
  if (!validation.ok) return { ok: false, reason: validation.failures[0], commits: [] };
  if (compare.compare_timeout === true) {
    return { ok: false, reason: 'compare_timeout', commits: [] };
  }
  if (baselineCommit === releaseHead) return { ok: true, commits: [] };
  // Validation above rejects duplicate IDs before this map is built.  Keeping
  // the map local to a validated payload prevents silent last-write-wins
  // folding of a forged compare response.
  const commitMap = new Map(compare.commits.map((item) => [item.id, item]));
  const reversed = [];
  const seen = new Set();
  let cursor = releaseHead;
  while (cursor !== baselineCommit) {
    if (seen.has(cursor)) return { ok: false, reason: 'first_parent_cycle', commits: [] };
    seen.add(cursor);
    const row = commitMap.get(cursor);
    if (!row) return { ok: false, reason: `first_parent_commit_missing:${cursor}`, commits: [] };
    const parents = Array.isArray(row.parent_ids) ? row.parent_ids.map(text).filter(Boolean) : [];
    if (!parents.length) return { ok: false, reason: `first_parent_missing:${cursor}`, commits: [] };
    reversed.push(row);
    cursor = parents[0];
    if (!HEX40.test(cursor)) return { ok: false, reason: `first_parent_invalid:${row.id}`, commits: [] };
  }
  return { ok: true, commits: reversed.reverse() };
}

function validateGitLabFirstParentComparePayload(compare, { allowEmptyCommits = true } = {}) {
  const failures = [];
  if (!compare || typeof compare !== 'object' || Array.isArray(compare)) {
    return { ok: false, failures: ['compare_response_not_object'] };
  }
  if (typeof compare.compare_timeout !== 'boolean') {
    failures.push('compare_timeout_type_invalid');
  }
  if (!Array.isArray(compare.commits)) {
    failures.push('compare_commits_missing');
    return { ok: false, failures };
  }
  if (!allowEmptyCommits && compare.commits.length === 0) {
    failures.push('compare_commits_empty');
  }
  const ids = new Set();
  compare.commits.forEach((commit, index) => {
    const prefix = `compare_commit_invalid:${index}`;
    if (!commit || typeof commit !== 'object' || Array.isArray(commit)) {
      failures.push(`${prefix}:not_object`);
      return;
    }
    if (Object.keys(commit).some((key) => !GITLAB_COMPARE_COMMIT_ALLOWED_KEYS.has(key))) {
      failures.push(`${prefix}:fields_mismatch`);
    }
    if (typeof commit.id !== 'string' || !LOWER_HEX40.test(commit.id)) {
      failures.push(`${prefix}:id_invalid`);
    } else if (ids.has(commit.id)) {
      failures.push(`${prefix}:duplicate_id`);
    } else {
      ids.add(commit.id);
    }
    if (!Array.isArray(commit.parent_ids) || commit.parent_ids.length === 0
      || commit.parent_ids.some((parentId) => typeof parentId !== 'string' || !LOWER_HEX40.test(parentId))
      || new Set(commit.parent_ids).size !== commit.parent_ids.length) {
      failures.push(`${prefix}:parent_ids_invalid`);
    }
    if (commit.short_id !== undefined && (
      typeof commit.short_id !== 'string'
      || !/^[a-f0-9]{8,12}$/u.test(commit.short_id)
      || typeof commit.id !== 'string'
      || !commit.id.startsWith(commit.short_id)
    )) {
      failures.push(`${prefix}:short_id_invalid`);
    }
    for (const field of [
      'title', 'message', 'author_name', 'author_email', 'committer_name', 'committer_email',
    ]) {
      if (commit[field] !== undefined
        && (typeof commit[field] !== 'string' || !commit[field].trim() || commit[field] !== commit[field].trim())) {
        failures.push(`${prefix}:${field}_invalid`);
      }
    }
    for (const field of ['created_at', 'authored_date', 'committed_date']) {
      if (commit[field] !== undefined && !isCanonicalIsoTimestamp(commit[field])) {
        failures.push(`${prefix}:${field}_invalid`);
      }
    }
    if (commit.trailers !== undefined && (!commit.trailers
      || typeof commit.trailers !== 'object' || Array.isArray(commit.trailers)
      || Object.entries(commit.trailers).some(([key, value]) => (
        !key.trim() || key !== key.trim() || typeof value !== 'string'
      )))) {
      failures.push(`${prefix}:trailers_invalid`);
    }
    if (commit.extended_trailers !== undefined && (!commit.extended_trailers
      || typeof commit.extended_trailers !== 'object' || Array.isArray(commit.extended_trailers)
      || Object.entries(commit.extended_trailers).some(([key, values]) => (
        !key.trim()
        || key !== key.trim()
        || !Array.isArray(values)
        || values.length === 0
        || values.some((value) => typeof value !== 'string')
      )))) {
      failures.push(`${prefix}:extended_trailers_invalid`);
    }
    if (commit.web_url !== undefined && (typeof commit.web_url !== 'string'
      || commit.web_url !== `${GITLAB_COMMIT_WEB_URL_PREFIX}${commit.id}`)) {
      failures.push(`${prefix}:web_url_invalid`);
    }
    if (commit.project_id !== undefined
      && (!Number.isSafeInteger(commit.project_id) || commit.project_id <= 0)) {
      failures.push(`${prefix}:project_id_invalid`);
    }
    if (commit.stats !== undefined && (!commit.stats || typeof commit.stats !== 'object'
      || Array.isArray(commit.stats)
      || !objectHasExactKeys(commit.stats, ['additions', 'deletions', 'total'])
      || !['additions', 'deletions', 'total'].every((field) => (
        Number.isSafeInteger(commit.stats[field]) && commit.stats[field] >= 0
      ))
      || commit.stats.total !== commit.stats.additions + commit.stats.deletions)) {
      failures.push(`${prefix}:stats_invalid`);
    }
    if (commit.status !== undefined && commit.status !== null
      && (typeof commit.status !== 'string' || !commit.status.trim())) {
      failures.push(`${prefix}:status_invalid`);
    }
    if (commit.last_pipeline !== undefined && commit.last_pipeline !== null) {
      const pipeline = commit.last_pipeline;
      if (!objectHasExactKeys(pipeline, GITLAB_PIPELINE_METADATA_KEYS)) {
        failures.push(`${prefix}:last_pipeline_fields_mismatch`);
      } else {
        for (const field of ['id', 'iid', 'project_id']) {
          if (!Number.isSafeInteger(pipeline[field]) || pipeline[field] <= 0) {
            failures.push(`${prefix}:last_pipeline_${field}_invalid`);
          }
        }
        for (const field of ['ref', 'source', 'status']) {
          if (typeof pipeline[field] !== 'string'
            || !pipeline[field].trim()
            || pipeline[field] !== pipeline[field].trim()) {
            failures.push(`${prefix}:last_pipeline_${field}_invalid`);
          }
        }
        if (typeof pipeline.sha !== 'string' || !LOWER_HEX40.test(pipeline.sha)) {
          failures.push(`${prefix}:last_pipeline_sha_invalid`);
        }
        if (pipeline.project_id !== commit.project_id) {
          failures.push(`${prefix}:last_pipeline_project_id_mismatch`);
        }
        if (pipeline.sha !== commit.id) failures.push(`${prefix}:last_pipeline_sha_mismatch`);
        for (const field of ['created_at', 'updated_at']) {
          if (!isCanonicalIsoTimestamp(pipeline[field])) {
            failures.push(`${prefix}:last_pipeline_${field}_invalid`);
          }
        }
        if (typeof pipeline.web_url !== 'string'
          || pipeline.web_url
            !== `https://gitlab.daikuan.qihoo.net/songrongxin/deepbankv2/-/pipelines/${pipeline.id}`) {
          failures.push(`${prefix}:last_pipeline_web_url_invalid`);
        }
      }
    }
  });
  return { ok: failures.length === 0, failures };
}

function validateGitLabFirstParentCompareEvidence(evidence, compareFrom, compareTo) {
  const failures = [];
  const endpoint = `repository/compare?from=${compareFrom}&to=${compareTo}&straight=true`;
  const expectedKeys = [
    'schema_version', 'source', 'host', 'project', 'method', 'endpoint', 'compare_from',
    'compare_to', 'straight', 'raw_response_encoding', 'raw_response_base64',
    'raw_response_bytes', 'raw_response_sha256',
  ];
  if (!objectHasExactKeys(evidence, expectedKeys)) failures.push('compare_evidence_fields_mismatch');
  if (evidence?.schema_version !== QWORK_GITLAB_FIRST_PARENT_COMPARE_SCHEMA) {
    failures.push('compare_evidence_schema_mismatch');
  }
  if (evidence?.source !== 'gitlab-api-read-only') failures.push('compare_evidence_source_mismatch');
  if (evidence?.host !== 'gitlab.daikuan.qihoo.net') failures.push('compare_evidence_host_mismatch');
  if (evidence?.project !== 'songrongxin/deepbankv2') failures.push('compare_evidence_project_mismatch');
  if (evidence?.method !== 'GET') failures.push('compare_evidence_method_mismatch');
  if (text(evidence?.endpoint) !== endpoint) failures.push('compare_evidence_endpoint_mismatch');
  if (text(evidence?.compare_from) !== compareFrom) failures.push('compare_evidence_from_mismatch');
  if (text(evidence?.compare_to) !== compareTo) failures.push('compare_evidence_to_mismatch');
  if (evidence?.straight !== true) failures.push('compare_evidence_straight_mismatch');
  if (evidence?.raw_response_encoding !== 'base64') failures.push('compare_evidence_encoding_mismatch');
  let compare = null;
  try {
    const bytes = strictBase64Decode(evidence?.raw_response_base64);
    const source = strictUtf8Decode(bytes);
    if (!Number.isSafeInteger(evidence?.raw_response_bytes)
      || evidence.raw_response_bytes <= 0
      || evidence.raw_response_bytes !== bytes.length) {
      failures.push('compare_evidence_bytes_mismatch');
    }
    if (!HEX64.test(text(evidence?.raw_response_sha256))
      || sha256(bytes) !== text(evidence?.raw_response_sha256).toLowerCase()) {
      failures.push('compare_evidence_sha256_mismatch');
    }
    compare = JSON.parse(source);
    if (!compare || typeof compare !== 'object' || Array.isArray(compare)) {
      failures.push('compare_evidence_response_invalid');
      compare = null;
    }
  } catch {
    failures.push('compare_evidence_raw_response_invalid');
  }
  if (compare) {
    const payloadValidation = validateGitLabFirstParentComparePayload(compare, {
      allowEmptyCommits: true,
    });
    failures.push(...payloadValidation.failures);
  }
  return { ok: failures.length === 0, failures, compare };
}

function replayCurrentReleaseSuccessorAncestry(ancestry, compareFrom, compareTo, { sameCommitPositive = false } = {}) {
  const failures = [];
  const expectedAncestryKeys = [
    'source', 'compare_from', 'compare_to', 'compare_commit_count', 'first_parent_complete',
    'query_completed', 'verified', 'reason', 'compare_evidence',
  ];
  if (!objectHasExactKeys(ancestry, expectedAncestryKeys)) failures.push('ancestry_fields_mismatch');
  const evidence = ancestry?.compare_evidence;
  const evidenceValidation = validateGitLabFirstParentCompareEvidence(evidence, compareFrom, compareTo);
  failures.push(...evidenceValidation.failures);
  const base = {
    source: 'gitlab-api-compare-first-parent',
    compare_from: compareFrom,
    compare_to: compareTo,
    compare_commit_count: 0,
    first_parent_complete: false,
    query_completed: false,
    verified: false,
    reason: 'compare_evidence_invalid',
  };
  let replayed = base;
  if (evidenceValidation.ok) {
    const compare = evidenceValidation.compare;
    const compareCommitCount = Array.isArray(compare?.commits) ? compare.commits.length : 0;
    const queryCompleted = validateGitLabFirstParentComparePayload(compare, {
      allowEmptyCommits: true,
    }).ok && compare?.compare_timeout === false;
    if (compareFrom === compareTo) {
      const emptyIdentityCompare = queryCompleted && compareCommitCount === 0;
      replayed = sameCommitPositive
        ? {
          ...base,
          source: 'release-head-is-origin-merge',
          compare_commit_count: compareCommitCount,
          first_parent_complete: emptyIdentityCompare,
          query_completed: queryCompleted,
          verified: emptyIdentityCompare,
          reason: emptyIdentityCompare ? '' : 'compare_identity_response_invalid',
        }
        : {
          ...base,
          compare_commit_count: compareCommitCount,
          query_completed: queryCompleted,
          reason: emptyIdentityCompare ? 'compare_identities_equal' : 'compare_identity_response_invalid',
        };
    } else {
      const chain = reconstructGitLabFirstParentChain({
        compare,
        baselineCommit: compareFrom,
        releaseHead: compareTo,
      });
      replayed = {
        ...base,
        compare_commit_count: compareCommitCount,
        first_parent_complete: chain.ok,
        query_completed: queryCompleted,
        verified: chain.ok,
        reason: chain.ok ? '' : (chain.reason || 'first_parent_ancestry_not_proven'),
      };
    }
  }
  const provided = currentReleaseSuccessorAncestryProjection(ancestry);
  if (stableJson(provided) !== stableJson(replayed)) failures.push('ancestry_projection_mismatch');
  return {
    ancestry: {
      ...replayed,
      compare_evidence: evidence && typeof evidence === 'object' && !Array.isArray(evidence)
        ? structuredClone(evidence) : null,
    },
    failures,
  };
}

function currentReleaseSuccessorPositiveAncestry(ancestry, compareFrom, compareTo) {
  const sameCommit = compareFrom === compareTo;
  return ancestry?.query_completed === true
    && ancestry?.verified === true
    && ancestry?.first_parent_complete === true
    && text(ancestry?.compare_from) === compareFrom
    && text(ancestry?.compare_to) === compareTo
    && Number.isSafeInteger(ancestry?.compare_commit_count)
    && (sameCommit ? ancestry.compare_commit_count === 0 : ancestry.compare_commit_count > 0)
    && text(ancestry?.source) === (sameCommit
      ? 'release-head-is-origin-merge' : 'gitlab-api-compare-first-parent')
    && !text(ancestry?.reason);
}

function currentReleaseSuccessorNegativeAncestry(ancestry, compareFrom, compareTo) {
  return ancestry?.query_completed === true
    && ancestry?.verified === false
    && ancestry?.first_parent_complete === false
    && text(ancestry?.source) === 'gitlab-api-compare-first-parent'
    && text(ancestry?.compare_from) === compareFrom
    && text(ancestry?.compare_to) === compareTo
    && ancestry?.compare_commit_count === 0
    && text(ancestry?.reason) === `first_parent_commit_missing:${compareTo}`;
}

function observeCurrentReleaseSuccessorRelationship(binding, releaseHead, mergeRequests, successorAncestries) {
  const successor = binding.current_release_match.successor;
  const matches = (Array.isArray(successorAncestries) ? successorAncestries : [])
    .filter((item) => text(item?.binding_id) === text(binding.id));
  const input = matches.length === 1 ? matches[0] : {};
  const descendantReplay = replayCurrentReleaseSuccessorAncestry(
    input?.descendant_ancestry,
    successor.merge_commit_sha,
    releaseHead,
    { sameCommitPositive: true },
  );
  const predecessorReplay = replayCurrentReleaseSuccessorAncestry(
    input?.predecessor_ancestry,
    releaseHead,
    successor.merge_commit_sha,
  );
  const descendantAncestry = descendantReplay.ancestry;
  const predecessorAncestry = predecessorReplay.ancestry;
  const evidenceFailures = [
    ...descendantReplay.failures.map((failure) => `descendant:${failure}`),
    ...predecessorReplay.failures.map((failure) => `predecessor:${failure}`),
  ];
  const identityVerified = matches.length === 1
    && text(input?.successor_mr_iid) === successor.mr_iid
    && text(input?.successor_merge_commit_sha) === successor.merge_commit_sha;
  const descendantVerified = currentReleaseSuccessorPositiveAncestry(
    descendantAncestry,
    successor.merge_commit_sha,
    releaseHead,
  );
  const predecessorVerified = releaseHead !== successor.merge_commit_sha
    && currentReleaseSuccessorPositiveAncestry(
      predecessorAncestry,
      releaseHead,
      successor.merge_commit_sha,
    );
  const descendantRejected = releaseHead === successor.merge_commit_sha
    ? true
    : currentReleaseSuccessorNegativeAncestry(
      descendantAncestry,
      successor.merge_commit_sha,
      releaseHead,
    );
  const predecessorRejected = releaseHead === successor.merge_commit_sha
    ? text(predecessorAncestry?.reason) === 'compare_identities_equal'
      && predecessorAncestry?.query_completed === true
      && predecessorAncestry?.verified === false
      && predecessorAncestry?.first_parent_complete === false
      && predecessorAncestry?.compare_commit_count === 0
      && text(predecessorAncestry?.compare_from) === releaseHead
      && text(predecessorAncestry?.compare_to) === successor.merge_commit_sha
    : currentReleaseSuccessorNegativeAncestry(
      predecessorAncestry,
      releaseHead,
      successor.merge_commit_sha,
    );
  let relationship = 'UNKNOWN';
  if (descendantVerified && predecessorRejected) relationship = 'VERIFIED_SUCCESSOR';
  else if (predecessorVerified && descendantRejected) relationship = 'VERIFIED_PREDECESSOR';

  const inRangeCandidates = (Array.isArray(mergeRequests) ? mergeRequests : []).filter((row) => (
    text(row?.iid) === successor.mr_iid
      || text(row?.commit) === successor.merge_commit_sha
      || text(row?.merge_commit_sha) === successor.merge_commit_sha
  ));
  const inRangeIdentityVerified = inRangeCandidates.length === 0
    || currentReleaseSuccessorLineIsVerified(successor, mergeRequests);
  const verified = identityVerified
    && relationship !== 'UNKNOWN'
    && inRangeIdentityVerified
    && evidenceFailures.length === 0;
  return {
    schema_version: QWORK_SOURCE_BINDING_SUCCESSOR_RELATIONSHIP_SCHEMA,
    binding_id: text(binding.id),
    successor_mr_iid: text(input?.successor_mr_iid),
    successor_merge_commit_sha: text(input?.successor_merge_commit_sha),
    release_head: text(releaseHead),
    relationship,
    descendant_ancestry: descendantAncestry,
    predecessor_ancestry: predecessorAncestry,
    in_range_identity_count: inRangeCandidates.length,
    in_range_identity_verified: inRangeIdentityVerified,
    compare_evidence_verified: evidenceFailures.length === 0,
    compare_evidence_failures: evidenceFailures,
    verified,
  };
}

function currentIntegrationBindingOccurrence(binding, source, {
  releaseHead = '',
  mergeRequests = [],
  successorAncestries = [],
} = {}) {
  const match = binding.current_release_match;
  if (!match) return { occurrenceCount: exactLineOccurrenceCount(source, binding.addition.source) };
  if (match.match !== 'line-or-verified-successor-line') {
    return { occurrenceCount: fragmentOccurrenceCount(source, match) };
  }
  const successorObservation = observeCurrentReleaseSuccessorRelationship(
    binding,
    text(releaseHead),
    mergeRequests,
    successorAncestries,
  );
  const baseCount = exactLineOccurrenceCount(source, match.value.source);
  const successorCount = exactLineOccurrenceCount(source, match.successor.line.source);
  return {
    occurrenceCount: successorObservation.verified
      ? (successorObservation.relationship === 'VERIFIED_SUCCESSOR' ? successorCount : baseCount)
      : 0,
    successorObservation,
  };
}

function observeCurrentIntegrationBinding(binding, source, failures, options = {}) {
  const { occurrenceCount, successorObservation } = currentIntegrationBindingOccurrence(
    binding,
    source,
    options,
  );
  const expectedCurrentOccurrenceCount = Number(binding.expected_current_occurrence_count ?? 1);
  const scope = binding.current_release_scope;
  if (!scope) {
    const verified = occurrenceCount === expectedCurrentOccurrenceCount;
    if (!verified) failures.push(`current_integration_binding_mismatch:${binding.id}`);
    return {
      ...binding,
      addition_count: occurrenceCount,
      occurrence_count: occurrenceCount,
      ...(successorObservation ? { successor_observation: successorObservation } : {}),
      verified,
    };
  }

  const lines = String(source || '').split('\n');
  const ownerIndexes = [];
  for (let index = 0; index < lines.length; index += 1) {
    if (lines[index] === scope.owner_start.source) ownerIndexes.push(index);
  }
  let ownerLines = [];
  if (ownerIndexes.length === 1) {
    const ownerIndex = ownerIndexes[0];
    const nextOwnerOffset = lines.slice(ownerIndex + 1).findIndex((line) => /^test\(/u.test(line));
    const endIndex = nextOwnerOffset < 0 ? lines.length : ownerIndex + 1 + nextOwnerOffset;
    ownerLines = lines.slice(ownerIndex, endIndex);
  }
  let scopedLines = ownerLines;
  let regionStartOccurrenceCount = null;
  let regionEndOccurrenceCount = null;
  let regionOrdered = null;
  let ownerRegionOrder = null;
  let ownerRegionOrdered = null;
  if (scope.boundary === CURRENT_RELEASE_REGION_SCOPE_BOUNDARY) {
    const regionStartIndexes = [];
    const regionEndIndexes = [];
    for (let index = 0; index < ownerLines.length; index += 1) {
      if (ownerLines[index] === scope.region_start.source) regionStartIndexes.push(index);
      if (ownerLines[index] === scope.region_end.source) regionEndIndexes.push(index);
    }
    regionStartOccurrenceCount = regionStartIndexes.length;
    regionEndOccurrenceCount = regionEndIndexes.length;
    regionOrdered = regionStartIndexes.length === 1
      && regionEndIndexes.length === 1
      && regionStartIndexes[0] < regionEndIndexes[0];
    if (regionStartOccurrenceCount !== 1) {
      failures.push(`current_integration_binding_scope_region_start_mismatch:${binding.id}`);
    }
    if (regionEndOccurrenceCount !== 1) {
      failures.push(`current_integration_binding_scope_region_end_mismatch:${binding.id}`);
    }
    if (!regionOrdered) failures.push(`current_integration_binding_scope_region_order_mismatch:${binding.id}`);
    const ownerRegionIndexes = scope.owner_region_order.map((record) => {
      const indexes = [];
      for (let index = 0; index < ownerLines.length; index += 1) {
        if (ownerLines[index] === record.source) indexes.push(index);
      }
      return { ...record, indexes };
    });
    ownerRegionOrder = ownerRegionIndexes.map(({ indexes, ...record }, index) => {
      const verified = indexes.length === 1;
      if (!verified) {
        failures.push(`current_integration_binding_scope_owner_region_anchor_mismatch:${binding.id}:${index}`);
      }
      return { ...record, occurrence_count: indexes.length, verified };
    });
    ownerRegionOrdered = ownerRegionIndexes.every(({ indexes }) => indexes.length === 1)
      && ownerRegionIndexes.every(({ indexes }, index) => (
        index === 0 || ownerRegionIndexes[index - 1].indexes[0] < indexes[0]
      ));
    if (!ownerRegionOrdered) {
      failures.push(`current_integration_binding_scope_owner_region_order_mismatch:${binding.id}`);
      failures.push(`current_integration_binding_scope_region_sequence_mismatch:${binding.id}`);
    }
    const regionEndExclusive = regionEndIndexes[0]
      + (scope.region_end_inclusive === false ? 0 : 1);
    scopedLines = regionOrdered
      ? ownerLines.slice(regionStartIndexes[0], regionEndExclusive)
      : [];
  }
  const scopedSource = scopedLines.join('\n');
  const scopedOccurrenceCount = exactLineOccurrenceCount(scopedSource, binding.addition.source);
  const requiredFragmentIndexes = scope.required_fragments.map((fragment) => {
    const indexes = [];
    for (let index = 0; index < scopedLines.length; index += 1) {
      if (scopedLines[index] === fragment.value.source) indexes.push(index);
    }
    return { fragment, indexes };
  });
  const requiredFragments = requiredFragmentIndexes.map(({ fragment, indexes }) => {
    const requiredOccurrenceCount = indexes.length;
    const expectedLineIndex = fragment.expected_line_index;
    const verified = requiredOccurrenceCount === 1
      && (scope.boundary !== CURRENT_RELEASE_REGION_SCOPE_BOUNDARY || indexes[0] === expectedLineIndex);
    if (!verified) {
      failures.push(`current_integration_binding_scope_required_fragment_mismatch:${binding.id}:${fragment.id}`);
    }
    return {
      ...fragment,
      occurrence_count: requiredOccurrenceCount,
      ...(scope.boundary === CURRENT_RELEASE_REGION_SCOPE_BOUNDARY ? {
        line_index: indexes.length === 1 ? indexes[0] : null,
      } : {}),
      verified,
    };
  });
  const requiredFragmentsOrdered = scope.boundary === CURRENT_RELEASE_REGION_SCOPE_BOUNDARY
    ? requiredFragmentIndexes.every(({ indexes }) => indexes.length === 1)
      && requiredFragmentIndexes.every(({ indexes }, index) => (
        index === 0 || requiredFragmentIndexes[index - 1].indexes[0] < indexes[0]
      ))
    : null;
  if (scope.boundary === CURRENT_RELEASE_REGION_SCOPE_BOUNDARY && !requiredFragmentsOrdered) {
    failures.push(`current_integration_binding_scope_required_fragment_order_mismatch:${binding.id}`);
  }
  const forbiddenFragments = (scope.forbidden_fragments || []).map((fragment) => {
    const forbiddenOccurrenceCount = fragmentOccurrenceCount(scopedSource, fragment);
    const verified = forbiddenOccurrenceCount === 0;
    if (!verified) {
      failures.push(`current_integration_binding_scope_forbidden_fragment_mismatch:${binding.id}:${fragment.id}`);
    }
    return { ...fragment, occurrence_count: forbiddenOccurrenceCount, verified };
  });
  if (ownerIndexes.length !== 1) {
    failures.push(`current_integration_binding_scope_owner_mismatch:${binding.id}`);
  }
  if (scopedOccurrenceCount !== 1) {
    failures.push(`current_integration_binding_scope_occurrence_mismatch:${binding.id}`);
  }
  const scopeVerified = ownerIndexes.length === 1
    && (scope.boundary !== CURRENT_RELEASE_REGION_SCOPE_BOUNDARY
      || (regionStartOccurrenceCount === 1
        && regionEndOccurrenceCount === 1
        && regionOrdered
        && ownerRegionOrdered))
    && scopedOccurrenceCount === 1
    && requiredFragments.every((fragment) => fragment.verified)
    && (scope.boundary !== CURRENT_RELEASE_REGION_SCOPE_BOUNDARY || requiredFragmentsOrdered)
    && forbiddenFragments.every((fragment) => fragment.verified);
  const fileOccurrenceVerified = scope.boundary === CURRENT_RELEASE_OWNER_SCOPE_BOUNDARY
    && binding.expected_current_occurrence_count === undefined
    ? occurrenceCount >= 1
    : occurrenceCount === expectedCurrentOccurrenceCount;
  const verified = fileOccurrenceVerified && scopeVerified;
  if (!verified) failures.push(`current_integration_binding_mismatch:${binding.id}`);
  return {
    ...binding,
    addition_count: occurrenceCount,
    occurrence_count: occurrenceCount,
    scope_observation: {
      owner_occurrence_count: ownerIndexes.length,
      ...(scope.boundary === CURRENT_RELEASE_REGION_SCOPE_BOUNDARY ? {
        region_start_occurrence_count: regionStartOccurrenceCount,
        region_end_occurrence_count: regionEndOccurrenceCount,
        region_ordered: regionOrdered,
        owner_region_order: ownerRegionOrder,
        owner_region_ordered: ownerRegionOrdered,
      } : {}),
      occurrence_count: scopedOccurrenceCount,
      required_fragments: requiredFragments,
      ...(scope.boundary === CURRENT_RELEASE_REGION_SCOPE_BOUNDARY ? {
        required_fragments_ordered: requiredFragmentsOrdered,
        forbidden_fragments: forbiddenFragments,
      } : {}),
      verified: scopeVerified,
    },
    verified,
  };
}

function observeForbiddenFragments(contract, sourceByPath, failures, prefix = 'forbidden_fragment') {
  return (Array.isArray(contract?.forbidden_fragments) ? contract.forbidden_fragments : []).map((assertion) => {
    const occurrenceCount = fragmentOccurrenceCount(sourceByPath.get(text(assertion?.path)) || '', assertion);
    const verified = occurrenceCount === 0;
    if (!verified) failures.push(`${prefix}:${text(assertion?.id) || 'missing'}`);
    return { ...assertion, observation_scope: 'added-lines', occurrence_count: occurrenceCount, verified };
  });
}

function currentProtectedPaths(contract, headerContract) {
  return currentReleaseSourceContractProtectedPaths(contract, headerContract);
}

function currentForbiddenAssertions(contract, headerContract) {
  const assertions = [
    ...(Array.isArray(contract?.forbidden_fragments) ? contract.forbidden_fragments : []),
    ...(contract?.contract_id === headerContract?.contract_id
      ? []
      : (Array.isArray(headerContract?.forbidden_fragments) ? headerContract.forbidden_fragments : [])),
  ];
  return [...new Map(assertions.map((assertion) => [
    `${text(assertion?.path)}\0${text(assertion?.id)}`,
    assertion,
  ])).values()];
}

function currentAssertionOwner(contract, successor, lineage, assertion) {
  if (contract?.contract_id === successor?.contract_id) {
    return { owner: contract, lineage: [contract.contract_id] };
  }
  const declaration = (Array.isArray(successor?.supersedes) ? successor.supersedes : [])
    .find((item) => text(item?.contract_id) === text(contract?.contract_id));
  if (!declaration?.current_assertions?.includes(assertion)) {
    return { owner: contract, lineage: [contract.contract_id] };
  }
  return { owner: successor, lineage };
}

function currentRetirementProjection(originBinding, successor) {
  return {
    disposition: 'retired',
    contract_id: successor.contract_id,
    contract_sha256: successor.contract_sha256,
    mr_iid: successor.mr_iid,
    merge_commit_sha: successor.merge_commit_sha,
    target_branch: successor.target_branch,
    path: originBinding.path,
  };
}

function currentIntegrationBindingProjection(contract, successor, lineage) {
  return contract.integration_bindings.map((originBinding) => {
    const assertion = `integration_binding:${originBinding.id}`;
    const resolution = currentAssertionOwner(contract, successor, lineage, assertion);
    const declaration = (Array.isArray(resolution.owner?.supersedes) ? resolution.owner.supersedes : [])
      .find((item) => text(item?.contract_id) === text(contract?.contract_id));
    const retired = resolution.owner.contract_id !== contract.contract_id
      && text(declaration?.disposition) === 'retired'
      && declaration.current_assertions.includes(assertion);
    if (retired) {
      return {
        origin_binding_id: originBinding.id,
        binding: originBinding,
        retired: true,
        retirement: currentRetirementProjection(originBinding, resolution.owner),
        ...resolution,
      };
    }
    const binding = resolution.owner.contract_id === contract.contract_id
      ? originBinding
      : resolution.owner.integration_bindings.find((item) => item.id === originBinding.id);
    return { origin_binding_id: originBinding.id, binding, retired: false, ...resolution };
  });
}

function retiredCurrentIntegrationBinding(projection) {
  return {
    ...projection.binding,
    addition_count: 0,
    occurrence_count: 0,
    retired: true,
    retirement: projection.retirement,
    verified: true,
  };
}

function observeCurrentForbiddenFragments(contract, headerContract, sourceByPath, failures) {
  return currentForbiddenAssertions(contract, headerContract).map((assertion) => {
    const occurrenceCount = fragmentOccurrenceCount(sourceByPath.get(text(assertion?.path)) || '', assertion);
    const verified = occurrenceCount === 0;
    if (!verified) failures.push(`current_forbidden_fragment:${text(assertion?.id) || 'missing'}`);
    return { ...assertion, observation_scope: 'current-release-file', occurrence_count: occurrenceCount, verified };
  });
}

function expectedVerifiedAttestation(contract) {
  const retirement = isAssertionRetirementContract(contract);
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
    source_file: retirement ? null : {
      ...contract.source_file,
      source_line_count_observed: contract.source_file.source_line_count,
    },
    ...(retirement ? {
      retired_files: contract.retired_files.map((file) => ({
        ...file,
        change_count: 1,
        verified: true,
      })),
    } : {}),
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
    attestation_sha256: sha256(stableJson(value)),
  };
}

function observedSourceFile(contract, changes, failures) {
  const matches = changes.filter((change) => change.new_path === contract.source_file.path);
  if (matches.length !== 1) failures.push(`source_file_count:${matches.length}`);
  const change = matches[0] || null;
  const serialized = change ? stableJson(change) : '';
  let source = '';
  if (change) {
    if (change.old_path !== contract.source_file.old_path) failures.push('source_old_path_mismatch');
    if (change.new_file !== contract.source_file.new_file) failures.push('source_new_file_flag_mismatch');
    if (change.renamed_file !== contract.source_file.renamed_file) failures.push('source_renamed_flag_mismatch');
    if (change.deleted_file !== contract.source_file.deleted_file) failures.push('source_deleted_flag_mismatch');
    try {
      source = contract.source_file.proof_mode === 'exact-new-file'
        ? reconstructGitLabNewFileSource(change)
        : reconstructGitLabAddedLinesSource(change);
    } catch (error) {
      failures.push(text(error?.message) || 'source_reconstruction_failed');
    }
  }
  const observed = {
    proof_mode: text(contract?.source_file?.proof_mode),
    path: change?.new_path || '',
    old_path: change?.old_path || '',
    new_file: Boolean(change?.new_file),
    renamed_file: Boolean(change?.renamed_file),
    deleted_file: Boolean(change?.deleted_file),
    change_bytes: Buffer.byteLength(serialized, 'utf8'),
    change_sha256: serialized ? sha256(serialized) : '',
    source_bytes: Buffer.byteLength(source, 'utf8'),
    source_sha256: source ? sha256(source) : '',
    source_line_count: source ? source.replace(/\n$/u, '').split('\n').length : 0,
    source_line_count_observed: source ? source.replace(/\n$/u, '').split('\n').length : 0,
  };
  for (const field of ['change_bytes', 'change_sha256', 'source_bytes', 'source_sha256', 'source_line_count']) {
    if (observed[field] !== contract.source_file[field]) failures.push(`source_${field}_mismatch`);
  }
  return { change, source, observed };
}

function observeRetiredFiles(contract, changes, failures) {
  return contract.retired_files.map((expected) => {
    const matches = changes.filter((change) => (
      change.old_path === expected.path || change.new_path === expected.path
    ));
    const change = matches[0] || null;
    let verified = matches.length === 1;
    if (matches.length !== 1) failures.push(`retired_file_count:${expected.path}:${matches.length}`);
    for (const field of ['old_path', 'new_path', 'new_file', 'renamed_file', 'deleted_file']) {
      if (change?.[field] !== expected[field]) {
        verified = false;
        failures.push(`retired_file_${field}_mismatch:${expected.path}`);
      }
    }
    return {
      ...expected,
      change_count: matches.length,
      verified,
    };
  });
}

export function auditReleaseSourceContract({
  iid,
  state,
  targetBranch,
  mergeCommitSha,
  changesCount,
  changes = [],
  contract,
} = {}) {
  if (!contract?.contract_id) throw new Error('source_contract_missing');
  const failures = [];
  const summary = summarizeGitLabChanges(changes);
  const normalizedChanges = summary.normalized;
  const observedCount = Number(changesCount);
  if (text(iid) !== contract.mr_iid) failures.push('mr_iid_mismatch');
  if (text(state) !== contract.state) failures.push('mr_state_mismatch');
  if (text(targetBranch) !== contract.target_branch) failures.push('mr_target_branch_mismatch');
  if (text(mergeCommitSha) !== contract.merge_commit_sha) failures.push('mr_merge_commit_sha_mismatch');
  if (!Number.isSafeInteger(observedCount) || observedCount !== contract.changes_count) failures.push('mr_changes_count_mismatch');
  if (normalizedChanges.length !== contract.changes_count) failures.push('mr_changes_length_mismatch');
  if (stableJson(summary.paths) !== stableJson(contract.changed_paths)) failures.push('mr_changed_paths_mismatch');
  if (summary.diff_bytes !== contract.mr_diff.bytes) failures.push('mr_diff_bytes_mismatch');
  if (summary.diff_sha256 !== contract.mr_diff.sha256) failures.push('mr_diff_sha256_mismatch');

  const retirement = isAssertionRetirementContract(contract);
  const sourceObservation = retirement
    ? { source: '', observed: null }
    : observedSourceFile(contract, normalizedChanges, failures);
  const retiredFiles = retirement ? observeRetiredFiles(contract, normalizedChanges, failures) : [];
  const addedSourceByPath = new Map();
  const requiredAddedPaths = retirement ? [] : [...new Set([
    text(contract?.source_file?.path),
    ...contract.integration_bindings.map((binding) => text(binding?.path)),
    ...(contract.forbidden_fragments || []).map((assertion) => text(assertion?.path)),
  ].filter(Boolean))];
  for (const filePath of requiredAddedPaths) {
    const matches = normalizedChanges.filter((change) => (change.new_path || change.old_path) === filePath);
    if (matches.length !== 1) {
      failures.push(`added_lines_change_count:${filePath}:${matches.length}`);
      addedSourceByPath.set(filePath, '');
      continue;
    }
    const [change] = matches;
    try {
      const source = change.new_file
        ? reconstructGitLabNewFileSource(change)
        : reconstructGitLabAddedLinesSource(change);
      addedSourceByPath.set(filePath, source);
    } catch (error) {
      failures.push(`added_lines_reconstruction:${filePath}:${text(error?.message) || 'failed'}`);
      addedSourceByPath.set(filePath, '');
    }
  }
  const headers = contract.header_emissions.map((header) => {
    const emissionCount = sourceObservation.source
      ? sourceObservation.source.split('\n').filter((line) => line === header.emission.source).length
      : 0;
    const valueDefinitionCount = header.value_definition && sourceObservation.source
      ? sourceObservation.source.split('\n').filter((line) => line === header.value_definition.source).length
      : 0;
    const verified = emissionCount === 1 && valueDefinitionCount === (header.value_definition ? 1 : 0);
    if (!verified) failures.push(`header_source_mismatch:${header.name}`);
    return {
      ...header,
      emission_count: emissionCount,
      value_definition_count: valueDefinitionCount,
      verified,
    };
  });
  const integrationBindings = contract.integration_bindings.map((binding) => {
    const additionCount = (addedSourceByPath.get(binding.path) || '')
      .split('\n').filter((line) => line === binding.addition.source).length;
    const verified = additionCount === Number(binding.expected_addition_count ?? 1);
    if (!verified) failures.push(`integration_binding_mismatch:${binding.id}`);
    return { ...binding, addition_count: additionCount, verified };
  });
  const forbiddenFragments = observeForbiddenFragments(contract, addedSourceByPath, failures);
  const value = {
    schema_version: QWORK_RELEASE_SOURCE_CONTRACT_SCHEMA,
    claim_scope: contract.claim_scope,
    test_execution_attested: contract.test_execution_attested,
    contract_id: contract.contract_id,
    status: failures.length ? 'BLOCKED' : 'VERIFIED',
    verified: failures.length === 0,
    source: 'gitlab-api-changes',
    contract_sha256: contract.contract_sha256,
    mr: {
      iid: text(iid),
      state: text(state),
      target_branch: text(targetBranch),
      merge_commit_sha: text(mergeCommitSha),
      changes_count: observedCount,
      changed_paths: summary.paths,
      diff_bytes: summary.diff_bytes,
      diff_sha256: summary.diff_sha256,
    },
    source_file: sourceObservation.observed,
    ...(retirement ? { retired_files: retiredFiles } : {}),
    headers,
    integration_bindings: integrationBindings,
    forbidden_fragments: forbiddenFragments,
    failures,
  };
  return {
    ...value,
    attestation_sha256: sha256(stableJson(value)),
  };
}

function triggerProjection(mergeRequests, contract) {
  const rows = Array.isArray(mergeRequests) ? mergeRequests : [];
  const iidMatches = [];
  const mergeShaMatches = [];
  const protectedPathMatches = [];
  for (const mr of rows) {
    const trigger = releaseSourceContractTrigger(mr, contract);
    if (trigger.iid_match) iidMatches.push(text(mr?.iid));
    if (trigger.merge_sha_match) mergeShaMatches.push(text(mr?.commit || mr?.merge_commit_sha));
    if (trigger.protected_paths.length) {
      protectedPathMatches.push({
        iid: text(mr?.iid),
        commit: text(mr?.commit || mr?.merge_commit_sha),
        paths: trigger.protected_paths,
      });
    }
  }
  return {
    policy: 'persistent-current-release-head',
    persistent: true,
    iid_matches: iidMatches,
    merge_sha_matches: mergeShaMatches,
    protected_path_matches: protectedPathMatches,
  };
}

function strictBase64Decode(value) {
  const raw = String(value || '');
  const normalized = raw.replace(/\s+/gu, '');
  if (!normalized || !/^[A-Za-z0-9+/]*={0,2}$/u.test(normalized) || normalized.length % 4 !== 0) {
    throw new Error('file_content_base64_invalid');
  }
  if (raw !== normalized) throw new Error('file_content_base64_noncanonical');
  const bytes = Buffer.from(normalized, 'base64');
  if (bytes.toString('base64') !== normalized) throw new Error('file_content_base64_noncanonical');
  return bytes;
}

function strictUtf8Decode(bytes) {
  const source = Buffer.from(bytes).toString('utf8');
  // Buffer's default decoder replaces malformed sequences.  Source contracts
  // must attest the exact bytes, so a replacement round-trip is not acceptable.
  if (!Buffer.from(source, 'utf8').equals(Buffer.from(bytes))) {
    throw new Error('file_content_utf8_invalid');
  }
  return source;
}

function releaseFileProvenance({ file, expectedPath, releaseHead, payload } = {}) {
  const supplied = file?.last_commit_provenance || payload?.last_commit_provenance;
  if (supplied && typeof supplied === 'object' && !Array.isArray(supplied)) {
    return supplied;
  }
  const lastCommitId = text(payload?.last_commit_id);
  const commitEndpoint = `repository/commits/${encodeURIComponent(lastCommitId)}`;
  return {
    schema_version: QWORK_RELEASE_FILE_PROVENANCE_SCHEMA,
    source: 'gitlab-api-repository-commit-diff',
    commit_endpoint: commitEndpoint,
    diff_endpoint: `${commitEndpoint}/diff?per_page=${QWORK_RELEASE_FILE_PROVENANCE_DIFF_PAGE_SIZE}`,
    path: expectedPath,
    ref: releaseHead,
    release_commit_id: text(payload?.commit_id),
    file_last_commit_id: lastCommitId,
    commit_id: '',
    commit_raw_response: {},
    commit_metadata: { id: '' },
    commit_response_sha256: '',
    diff_page_size: QWORK_RELEASE_FILE_PROVENANCE_DIFF_PAGE_SIZE,
    diff_pages: [],
    matched_change_count: 0,
    matched_changes: [],
    path_verified: false,
    error: 'independent_commit_diff_missing',
  };
}

function validateReleaseFileProvenance(provenance, {
  expectedPath,
  releaseHead,
  commitId,
  lastCommitId,
  failurePrefix,
} = {}) {
  const failures = [];
  const expectedCommitEndpoint = `repository/commits/${encodeURIComponent(lastCommitId)}`;
  const expectedDiffEndpoint = `${expectedCommitEndpoint}/diff?per_page=${QWORK_RELEASE_FILE_PROVENANCE_DIFF_PAGE_SIZE}`;
  if (!objectHasExactKeys(provenance, [
    'schema_version', 'source', 'commit_endpoint', 'diff_endpoint', 'path', 'ref',
    'release_commit_id', 'file_last_commit_id', 'commit_id', 'commit_raw_response', 'commit_metadata',
    'commit_response_sha256', 'diff_page_size',
    'diff_pages', 'matched_change_count', 'matched_changes', 'path_verified', 'error',
  ])) {
    failures.push(`${failurePrefix}:fields_mismatch`);
    return failures;
  }
  if (provenance.schema_version !== QWORK_RELEASE_FILE_PROVENANCE_SCHEMA) {
    failures.push(`${failurePrefix}:schema_mismatch`);
  }
  if (provenance.source !== 'gitlab-api-repository-commit-diff') {
    failures.push(`${failurePrefix}:source_mismatch`);
  }
  if (provenance.commit_endpoint !== expectedCommitEndpoint) failures.push(`${failurePrefix}:commit_endpoint_mismatch`);
  if (provenance.diff_endpoint !== expectedDiffEndpoint) failures.push(`${failurePrefix}:diff_endpoint_mismatch`);
  if (provenance.path !== expectedPath) failures.push(`${failurePrefix}:path_mismatch`);
  if (provenance.ref !== releaseHead) failures.push(`${failurePrefix}:ref_mismatch`);
  if (provenance.release_commit_id !== commitId) failures.push(`${failurePrefix}:release_commit_id_mismatch`);
  if (provenance.file_last_commit_id !== lastCommitId) failures.push(`${failurePrefix}:file_last_commit_id_mismatch`);
  if (provenance.commit_id !== lastCommitId) failures.push(`${failurePrefix}:commit_id_mismatch`);
  const commitRawResponseValidation = validateCanonicalGitLabCommitMetadata(
    provenance.commit_raw_response,
    provenance.commit_id,
  );
  if (!commitRawResponseValidation.ok) {
    failures.push(`${failurePrefix}:commit_raw_response_mismatch`);
    for (const reason of commitRawResponseValidation.failures) {
      failures.push(`${failurePrefix}:commit_raw_response_${reason}`);
    }
  }
  const commitMetadataValidation = validateCanonicalGitLabCommitMetadata(
    provenance.commit_metadata,
    provenance.commit_id,
  );
  if (!commitMetadataValidation.ok) {
    failures.push(`${failurePrefix}:commit_metadata_mismatch`);
    for (const reason of commitMetadataValidation.failures) {
      failures.push(`${failurePrefix}:commit_metadata_${reason}`);
    }
  }
  if (!commitRawResponseValidation.projection
    || stableJson(provenance.commit_metadata) !== stableJson(commitRawResponseValidation.projection)) {
    failures.push(`${failurePrefix}:commit_metadata_projection_mismatch`);
  }
  if (!HEX64.test(String(provenance.commit_response_sha256 || ''))
    || provenance.commit_response_sha256 !== sha256(stableJson(provenance.commit_raw_response))) {
    failures.push(`${failurePrefix}:commit_response_sha256_mismatch`);
  }
  if (!HEX40.test(String(provenance.release_commit_id || ''))) {
    failures.push(`${failurePrefix}:release_commit_id_invalid`);
  }
  if (!HEX40.test(String(provenance.file_last_commit_id || ''))) {
    failures.push(`${failurePrefix}:file_last_commit_id_invalid`);
  }
  if (!HEX40.test(String(provenance.commit_id || ''))) failures.push(`${failurePrefix}:commit_id_invalid`);
  if (provenance.diff_page_size !== QWORK_RELEASE_FILE_PROVENANCE_DIFF_PAGE_SIZE) {
    failures.push(`${failurePrefix}:diff_page_size_mismatch`);
  }
  const pages = Array.isArray(provenance.diff_pages) ? provenance.diff_pages : [];
  const changePathPairs = new Set();
  if (!Array.isArray(provenance.diff_pages)
    || pages.length === 0
    || pages.length > QWORK_RELEASE_FILE_PROVENANCE_MAX_DIFF_PAGES) {
    failures.push(`${failurePrefix}:diff_pages_invalid`);
  }
  pages.forEach((page, index) => {
    const pageNumber = index + 1;
    if (!objectHasExactKeys(page, [
      'page', 'endpoint', 'item_count', 'raw_response', 'changes', 'response_sha256',
    ])) {
      failures.push(`${failurePrefix}:diff_page_fields_mismatch:${pageNumber}`);
      return;
    }
    if (page.page !== pageNumber) failures.push(`${failurePrefix}:diff_page_sequence_mismatch:${pageNumber}`);
    if (page.endpoint !== `${expectedDiffEndpoint}&page=${pageNumber}`) {
      failures.push(`${failurePrefix}:diff_page_endpoint_mismatch:${pageNumber}`);
    }
    if (!Number.isSafeInteger(page.item_count)
      || page.item_count < 0
      || page.item_count > QWORK_RELEASE_FILE_PROVENANCE_DIFF_PAGE_SIZE) {
      failures.push(`${failurePrefix}:diff_page_item_count_invalid:${pageNumber}`);
    } else if (index < pages.length - 1
      && page.item_count !== QWORK_RELEASE_FILE_PROVENANCE_DIFF_PAGE_SIZE) {
      failures.push(`${failurePrefix}:diff_page_premature_short_page:${pageNumber}`);
    } else if (index === pages.length - 1
      && page.item_count >= QWORK_RELEASE_FILE_PROVENANCE_DIFF_PAGE_SIZE) {
      failures.push(`${failurePrefix}:diff_page_termination_missing:${pageNumber}`);
    }
    if (!Array.isArray(page.raw_response) || page.raw_response.length !== page.item_count
      || !Array.isArray(page.changes) || page.changes.length !== page.item_count) {
      failures.push(`${failurePrefix}:diff_page_changes_mismatch:${pageNumber}`);
    }
    const projectedRawChanges = [];
    for (const [changeIndex, rawChange] of (
      Array.isArray(page.raw_response) ? page.raw_response : []
    ).entries()) {
      const validation = validateCanonicalGitLabDiffChange(rawChange);
      for (const reason of validation.failures) {
        const suffix = reason === 'diff_incomplete' ? 'diff_page_raw_incomplete'
          : reason === 'flags_conflict' ? 'diff_page_change_flags_conflict'
            : ['collapsed', 'generated_file', 'too_large'].some((field) => reason === `${field}_invalid`)
              ? 'diff_page_raw_extension_invalid' : 'diff_page_raw_change_invalid';
        failures.push(`${failurePrefix}:${suffix}:${pageNumber}:${changeIndex}:${reason}`);
      }
      if (validation.projection) projectedRawChanges.push(validation.projection);
    }
    if (stableJson(page.changes) !== stableJson(projectedRawChanges)) {
      failures.push(`${failurePrefix}:diff_page_raw_projection_mismatch:${pageNumber}`);
    }
    for (const [changeIndex, change] of (Array.isArray(page.changes) ? page.changes : []).entries()) {
      if (!objectHasExactKeys(change, [
        'old_path', 'new_path', 'new_file', 'renamed_file', 'deleted_file',
      ])) {
        failures.push(`${failurePrefix}:diff_page_change_fields_mismatch:${pageNumber}:${changeIndex}`);
      } else if (typeof change.old_path !== 'string'
        || typeof change.new_path !== 'string'
        || !change.old_path.trim()
        || !change.new_path.trim()
        || change.old_path !== change.old_path.trim()
        || change.new_path !== change.new_path.trim()
        || !['new_file', 'renamed_file', 'deleted_file'].every((field) => typeof change[field] === 'boolean')) {
        failures.push(`${failurePrefix}:diff_page_change_invalid:${pageNumber}:${changeIndex}`);
      } else {
        const enabledFlags = [change.new_file, change.renamed_file, change.deleted_file]
          .filter((enabled) => enabled).length;
        const pathChanged = change.old_path !== change.new_path;
        if (enabledFlags > 1 || change.renamed_file !== pathChanged) {
          failures.push(`${failurePrefix}:diff_page_change_flags_conflict:${pageNumber}:${changeIndex}`);
        }
        const pathPair = stableJson([change.old_path, change.new_path]);
        if (changePathPairs.has(pathPair)) {
          failures.push(`${failurePrefix}:diff_page_change_duplicate:${pageNumber}:${changeIndex}`);
        }
        changePathPairs.add(pathPair);
      }
    }
    if (!HEX64.test(String(page.response_sha256 || ''))
      || page.response_sha256 !== sha256(stableJson(page.raw_response))) {
      failures.push(`${failurePrefix}:diff_page_sha256_mismatch:${pageNumber}`);
    }
  });
  const matchedChanges = Array.isArray(provenance.matched_changes) ? provenance.matched_changes : [];
  if (!Array.isArray(provenance.matched_changes)) failures.push(`${failurePrefix}:matched_changes_invalid`);
  matchedChanges.forEach((change, index) => {
    if (!objectHasExactKeys(change, [
      'old_path', 'new_path', 'new_file', 'renamed_file', 'deleted_file',
    ])) {
      failures.push(`${failurePrefix}:matched_change_fields_mismatch:${index}`);
      return;
    }
    if (typeof change.old_path !== 'string'
      || typeof change.new_path !== 'string'
      || !change.old_path.trim()
      || !change.new_path.trim()
      || change.old_path !== change.old_path.trim()
      || change.new_path !== change.new_path.trim()) {
      failures.push(`${failurePrefix}:matched_change_path_invalid:${index}`);
    }
    if (change.old_path !== expectedPath && change.new_path !== expectedPath) {
      failures.push(`${failurePrefix}:matched_change_path_mismatch:${index}`);
    }
    if (!['new_file', 'renamed_file', 'deleted_file'].every((field) => typeof change[field] === 'boolean')) {
      failures.push(`${failurePrefix}:matched_change_flags_invalid:${index}`);
    }
  });
  if (!Number.isSafeInteger(provenance.matched_change_count)
    || provenance.matched_change_count !== matchedChanges.length
    || provenance.matched_change_count !== 1) {
    failures.push(`${failurePrefix}:matched_change_count_mismatch`);
  }
  const derivedMatches = pages.flatMap((page) => Array.isArray(page?.changes) ? page.changes : [])
    .filter((change) => change?.old_path === expectedPath || change?.new_path === expectedPath);
  if (stableJson(matchedChanges) !== stableJson(derivedMatches)) {
    failures.push(`${failurePrefix}:matched_changes_projection_mismatch`);
  }
  const currentPathChange = matchedChanges.length === 1 ? matchedChanges[0] : null;
  if (!currentPathChange
    || currentPathChange.new_path !== expectedPath
    || currentPathChange.deleted_file !== false) {
    failures.push(`${failurePrefix}:matched_change_current_path_mismatch`);
  }
  if (provenance.path_verified !== true) failures.push(`${failurePrefix}:path_unverified`);
  if (provenance.error !== '') failures.push(`${failurePrefix}:error_present`);
  return failures;
}

function observeReleaseFile(file, expectedPath, releaseHead, failures) {
  const payload = file?.payload && typeof file.payload === 'object' ? file.payload : file;
  const prefix = `release_file:${expectedPath}`;
  const error = text(file?.error);
  if (error) failures.push(`${prefix}:read_failed:${error}`);
  const filePath = text(payload?.file_path);
  const ref = text(payload?.ref);
  const requestedRef = text(file?.requested_ref);
  const encoding = text(payload?.encoding).toLowerCase();
  const declaredSize = payload?.size;
  const provenance = releaseFileProvenance({ file, expectedPath, releaseHead, payload });
  let bytes = Buffer.alloc(0);
  if (!error) {
    if (filePath !== expectedPath) failures.push(`${prefix}:path_mismatch`);
    if (requestedRef !== releaseHead) failures.push(`${prefix}:requested_ref_mismatch`);
    if (ref !== releaseHead) failures.push(`${prefix}:ref_mismatch`);
    if (text(payload?.commit_id) !== releaseHead) failures.push(`${prefix}:commit_id_mismatch`);
    if (!HEX40.test(text(payload?.blob_id))) failures.push(`${prefix}:blob_id_invalid`);
    if (!HEX40.test(text(payload?.last_commit_id))) failures.push(`${prefix}:last_commit_id_invalid`);
    if (encoding !== 'base64') failures.push(`${prefix}:encoding_mismatch`);
    if (!Number.isSafeInteger(declaredSize) || declaredSize < 0) failures.push(`${prefix}:size_invalid`);
    if (encoding === 'base64') {
      try {
        bytes = strictBase64Decode(payload?.content);
      } catch (decodeError) {
        failures.push(`${prefix}:${text(decodeError?.message) || 'decode_failed'}`);
      }
    }
    if (bytes.length !== declaredSize) failures.push(`${prefix}:size_mismatch`);
    if (bytes.length === 0) failures.push(`${prefix}:content_empty`);
    if (bytes.length && HEX40.test(text(payload?.blob_id))
      && text(payload.blob_id).toLowerCase() !== gitBlobSha1(bytes)) {
      failures.push(`${prefix}:blob_id_content_mismatch`);
    }
  }
  let source = '';
  if (bytes.length) {
    try {
      source = strictUtf8Decode(bytes);
    } catch (decodeError) {
      failures.push(`${prefix}:${text(decodeError?.message) || 'utf8_decode_failed'}`);
    }
  }
  failures.push(...validateReleaseFileProvenance(provenance, {
    expectedPath,
    releaseHead,
    commitId: text(payload?.commit_id),
    lastCommitId: text(payload?.last_commit_id),
    failurePrefix: `${prefix}:last_commit_provenance`,
  }));
  return {
    source,
    observation: {
      path: filePath || expectedPath,
      requested_ref: requestedRef,
      ref,
      blob_id: text(payload?.blob_id),
      commit_id: text(payload?.commit_id),
      last_commit_id: text(payload?.last_commit_id),
      encoding,
      declared_size: Number.isSafeInteger(declaredSize) ? declaredSize : null,
      bytes: bytes.length,
      content_base64: bytes.length ? bytes.toString('base64') : '',
      sha256: bytes.length ? sha256(bytes) : '',
      line_count: source ? source.replace(/\n$/u, '').split('\n').length : 0,
      last_commit_provenance: provenance,
      error,
    },
  };
}

export function auditCurrentReleaseSourceContract({
  releaseHead,
  targetBranch,
  originAncestry = {},
  files = [],
  mergeRequests = [],
  successorAncestries = [],
  originAttestation = null,
  contract,
  currentHeaderContract = contract,
  currentHeaderLineage = [contract?.contract_id],
} = {}) {
  if (!contract?.contract_id) throw new Error('source_contract_missing');
  const failures = [];
  const normalizedHead = text(releaseHead);
  const normalizedBranch = text(targetBranch);
  if (!HEX40.test(normalizedHead)) failures.push('release_head_invalid');
  if (normalizedBranch !== contract.target_branch) failures.push('release_target_branch_mismatch');
  if (originAncestry?.verified !== true) failures.push('origin_merge_ancestry_not_verified');
  if (text(originAncestry?.compare_from) !== contract.merge_commit_sha) failures.push('origin_merge_compare_from_mismatch');
  if (text(originAncestry?.compare_to) !== normalizedHead) failures.push('origin_merge_compare_to_mismatch');
  if (originAncestry?.first_parent_complete !== true) failures.push('origin_merge_first_parent_incomplete');
  if (!Number.isSafeInteger(originAncestry?.compare_commit_count)
    || originAncestry.compare_commit_count < 0) {
    failures.push('origin_merge_compare_count_invalid');
  }
  if (!currentHeaderContract?.contract_id) failures.push('current_header_owner_missing');
  const normalizedHeaderLineage = Array.isArray(currentHeaderLineage)
    ? currentHeaderLineage.map(text).filter(Boolean) : [];
  if (normalizedHeaderLineage[0] !== contract.contract_id
    || normalizedHeaderLineage.at(-1) !== text(currentHeaderContract?.contract_id)
    || new Set(normalizedHeaderLineage).size !== normalizedHeaderLineage.length) {
    failures.push('current_header_lineage_invalid');
  }

  const protectedPaths = currentProtectedPaths(contract, currentHeaderContract);
  const fileRows = [];
  const sourceByPath = new Map();
  for (const protectedPath of protectedPaths) {
    const matches = files.filter((file) => text(file?.path || file?.payload?.file_path) === protectedPath);
    if (matches.length !== 1) failures.push(`release_file:${protectedPath}:count:${matches.length}`);
    const observed = observeReleaseFile(matches[0] || { path: protectedPath, error: 'missing' }, protectedPath, normalizedHead, failures);
    fileRows.push(observed.observation);
    sourceByPath.set(protectedPath, observed.source);
  }
  const unexpectedPaths = files
    .map((file) => text(file?.path || file?.payload?.file_path))
    .filter((filePath) => filePath && !protectedPaths.includes(filePath));
  if (unexpectedPaths.length) failures.push(`release_file_unexpected:${[...new Set(unexpectedPaths)].join(',')}`);

  const headerResolution = currentAssertionOwner(
    contract,
    currentHeaderContract,
    normalizedHeaderLineage,
    'header_emissions',
  );
  const integrationProjection = currentIntegrationBindingProjection(
    contract,
    currentHeaderContract,
    normalizedHeaderLineage,
  );
  const headerSourcePath = text(headerResolution.owner?.source_file?.path);
  const source = headerSourcePath ? (sourceByPath.get(headerSourcePath) || '') : '';
  const sourceLines = source.split('\n');
  const headers = headerResolution.owner.header_emissions.map((header) => {
    const emissionCount = sourceLines.filter((line) => line === header.emission.source).length;
    const valueDefinitionCount = header.value_definition
      ? sourceLines.filter((line) => line === header.value_definition.source).length
      : 0;
    const verified = emissionCount === 1 && valueDefinitionCount === (header.value_definition ? 1 : 0);
    if (!verified) failures.push(`current_header_source_mismatch:${header.name}`);
    return {
      ...header,
      emission_count: emissionCount,
      value_definition_count: valueDefinitionCount,
      verified,
    };
  });
  const integrationBindings = integrationProjection.map((projection) => (
    projection.retired
      ? retiredCurrentIntegrationBinding(projection)
      : observeCurrentIntegrationBinding(
        projection.binding,
        sourceByPath.get(projection.binding.path) || '',
        failures,
        { releaseHead: normalizedHead, mergeRequests, successorAncestries },
      )
  ));
  const forbiddenFragments = observeCurrentForbiddenFragments(
    contract,
    currentHeaderContract,
    sourceByPath,
    failures,
  );
  const currentReleaseSemantics = contract.contract_id
    === QWORK_MR1597_WORKER_IM_USER_IDENTITY_FORWARDING_CONTRACT_ID
    ? observeMr1597WorkerEnvironmentTestSemantics(
      sourceByPath,
      failures,
    )
    : null;

  const trigger = triggerProjection(mergeRequests, contract);
  const originIdentityTriggered = trigger.iid_matches.length > 0 || trigger.merge_sha_matches.length > 0;
  if (originIdentityTriggered) {
    if (!originAttestation) failures.push('origin_change_attestation_missing');
    else if (originAttestation.verified !== true || originAttestation.status !== 'VERIFIED' || originAttestation.failures?.length) {
      failures.push('origin_change_attestation_not_verified');
    }
  } else if (originAttestation) {
    failures.push('origin_change_attestation_unexpected');
  }

  const value = {
    schema_version: QWORK_RELEASE_CURRENT_SOURCE_CONTRACT_SCHEMA,
    claim_scope: contract.claim_scope,
    test_execution_attested: contract.test_execution_attested,
    contract_id: contract.contract_id,
    status: failures.length ? 'BLOCKED' : 'VERIFIED',
    verified: failures.length === 0,
    source: 'gitlab-api-current-release-files',
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
    release: {
      head: normalizedHead,
      target_branch: normalizedBranch,
      origin_merge_commit_sha: contract.merge_commit_sha,
      ancestry: {
        source: text(originAncestry?.source),
        verified: originAncestry?.verified === true,
        compare_from: text(originAncestry?.compare_from),
        compare_to: text(originAncestry?.compare_to),
        compare_commit_count: Number.isSafeInteger(originAncestry?.compare_commit_count)
          ? originAncestry.compare_commit_count : 0,
        first_parent_complete: originAncestry?.first_parent_complete === true,
        reason: text(originAncestry?.reason),
      },
    },
    current_assertion_owners: {
      header_emissions: {
        contract_id: text(headerResolution.owner?.contract_id),
        contract_sha256: text(headerResolution.owner?.contract_sha256),
        lineage: headerResolution.lineage,
      },
      integration_bindings: integrationProjection.map(({
        origin_binding_id: id,
        owner,
        lineage,
        retired,
        retirement,
      }) => ({
        id,
        contract_id: owner.contract_id,
        contract_sha256: owner.contract_sha256,
        lineage,
        ...(retired ? { retired: true, retirement } : {}),
      })),
    },
    trigger,
    protected_files: fileRows,
    ...(isAssertionRetirementContract(contract) ? {
      retired_files: contract.retired_files.map((file) => ({
        ...file,
        disposition: 'retired',
        verified: true,
      })),
    } : {}),
    headers,
    integration_bindings: integrationBindings,
    forbidden_fragments: forbiddenFragments,
    ...(currentReleaseSemantics ? { current_release_semantics: currentReleaseSemantics } : {}),
    origin_change_attestation: originAttestation,
    failures,
  };
  return {
    ...value,
    attestation_sha256: sha256(stableJson(value)),
  };
}

export function sourceContractForMr(iid, contracts = QWORK_RELEASE_SOURCE_CONTRACTS) {
  return resolveReleaseSourceContracts(contracts).find((contract) => contract.mr_iid === text(iid)) || null;
}

export function auditKnownReleaseSourceContracts(input = {}, contracts = QWORK_RELEASE_SOURCE_CONTRACTS) {
  const matchingContracts = resolveReleaseSourceContracts(contracts).filter((contract) => (
    contract.mr_iid === text(input.iid)
    || contract.merge_commit_sha === text(input.mergeCommitSha)
  ));
  return matchingContracts.map((contract) => auditReleaseSourceContract({ ...input, contract }));
}

export function validateReleaseSourceContractAttestation(attestation, { mr = null, contract } = {}) {
  const failures = [];
  if (!contract) return { ok: false, failures: ['contract_unknown'] };
  if (attestation?.claim_scope !== QWORK_RELEASE_SOURCE_CLAIM_SCOPE) failures.push('attestation_claim_scope_invalid');
  if (attestation?.test_execution_attested !== QWORK_RELEASE_SOURCE_TEST_EXECUTION_ATTESTED) {
    failures.push('attestation_test_execution_attested_invalid');
  }
  const expected = expectedVerifiedAttestation(contract);
  if (stableJson(attestation) !== stableJson(expected)) failures.push('attestation_not_exact_verified_projection');
  const copy = structuredClone(attestation || {});
  const observedHash = text(copy.attestation_sha256);
  delete copy.attestation_sha256;
  if (!HEX64.test(observedHash) || sha256(stableJson(copy)) !== observedHash) failures.push('attestation_sha256_mismatch');
  if (mr) {
    if (text(mr.iid) !== contract.mr_iid) failures.push('attestation_mr_row_iid_mismatch');
    if (text(mr.commit) !== contract.merge_commit_sha) failures.push('attestation_mr_row_commit_mismatch');
    if (text(mr.diff_sha256) !== contract.mr_diff.sha256) failures.push('attestation_mr_row_diff_sha256_mismatch');
    if (Number(mr.diff_bytes) !== contract.mr_diff.bytes) failures.push('attestation_mr_row_diff_bytes_mismatch');
    if (stableJson(mr.changed_paths || []) !== stableJson(contract.changed_paths)) failures.push('attestation_mr_row_changed_paths_mismatch');
  }
  if (!HEX40.test(text(attestation?.mr?.merge_commit_sha))) failures.push('attestation_merge_commit_invalid');
  return { ok: failures.length === 0, failures };
}

export function validateCurrentReleaseSourceContractAttestation(attestation, {
  report = null,
  contract,
  contracts = QWORK_RELEASE_SOURCE_CONTRACTS,
} = {}) {
  const failures = [];
  if (!contract) return { ok: false, failures: ['contract_unknown'] };
  const reportHead = text(report?.release?.head);
  const mergeRequests = Array.isArray(report?.merge_requests) ? report.merge_requests : [];
  const expectedTopLevelKeys = [
    'schema_version', 'claim_scope', 'test_execution_attested', 'contract_id', 'status',
    'verified', 'source', 'contract_sha256', 'mr', 'release', 'current_assertion_owners',
    'trigger', 'protected_files', 'headers', 'integration_bindings', 'forbidden_fragments',
    'origin_change_attestation', 'failures', 'attestation_sha256',
    ...(isAssertionRetirementContract(contract) ? ['retired_files'] : []),
    ...(contract.contract_id === QWORK_MR1597_WORKER_IM_USER_IDENTITY_FORWARDING_CONTRACT_ID
      ? ['current_release_semantics'] : []),
  ];
  if (!objectHasExactKeys(attestation, expectedTopLevelKeys)) {
    failures.push('attestation_current_fields_mismatch');
  }
  if (attestation?.schema_version !== QWORK_RELEASE_CURRENT_SOURCE_CONTRACT_SCHEMA) {
    failures.push('attestation_schema_mismatch');
  }
  if (attestation?.claim_scope !== QWORK_RELEASE_SOURCE_CLAIM_SCOPE) failures.push('attestation_claim_scope_invalid');
  if (attestation?.test_execution_attested !== QWORK_RELEASE_SOURCE_TEST_EXECUTION_ATTESTED) {
    failures.push('attestation_test_execution_attested_invalid');
  }
  if (text(attestation?.contract_id) !== contract.contract_id) failures.push('attestation_contract_id_mismatch');
  if (attestation?.source !== 'gitlab-api-current-release-files') failures.push('attestation_source_mismatch');
  if (text(attestation?.contract_sha256) !== contract.contract_sha256) failures.push('attestation_contract_sha256_mismatch');
  if (attestation?.verified !== true || attestation?.status !== 'VERIFIED') failures.push('attestation_not_verified');
  if (!Array.isArray(attestation?.failures) || attestation.failures.length !== 0) failures.push('attestation_failures_present');

  const copy = structuredClone(attestation || {});
  const observedHash = text(copy.attestation_sha256);
  delete copy.attestation_sha256;
  if (!HEX64.test(observedHash) || sha256(stableJson(copy)) !== observedHash) failures.push('attestation_sha256_mismatch');

  const expectedMr = expectedVerifiedAttestation(contract).mr;
  if (stableJson(attestation?.mr) !== stableJson(expectedMr)) failures.push('attestation_origin_mr_projection_mismatch');
  if (!HEX40.test(reportHead) || text(attestation?.release?.head) !== reportHead) failures.push('attestation_release_head_mismatch');
  if (text(attestation?.release?.target_branch) !== contract.target_branch) failures.push('attestation_release_target_branch_mismatch');
  if (text(attestation?.release?.origin_merge_commit_sha) !== contract.merge_commit_sha) {
    failures.push('attestation_origin_merge_commit_mismatch');
  }
  const ancestry = attestation?.release?.ancestry;
  if (ancestry?.verified !== true || ancestry?.first_parent_complete !== true) failures.push('attestation_origin_ancestry_unverified');
  if (text(ancestry?.compare_from) !== contract.merge_commit_sha) failures.push('attestation_origin_compare_from_mismatch');
  if (text(ancestry?.compare_to) !== reportHead) failures.push('attestation_origin_compare_to_mismatch');
  if (!['release-head-is-origin-merge', 'gitlab-api-compare-first-parent'].includes(text(ancestry?.source))) {
    failures.push('attestation_origin_ancestry_source_invalid');
  }
  if (!Number.isSafeInteger(ancestry?.compare_commit_count) || ancestry.compare_commit_count < 0) {
    failures.push('attestation_origin_compare_count_invalid');
  }
  if (text(ancestry?.reason)) failures.push('attestation_origin_ancestry_reason_present');

  const ancestryByContractId = new Map((Array.isArray(report?.source_contracts) ? report.source_contracts : [])
    .map((item) => [text(item?.contract_id), item?.release?.ancestry]));
  let headerResolution = { owner: contract, lineage: [contract.contract_id] };
  try {
    headerResolution = resolveCurrentReleaseHeaderContract(contract, { contracts, ancestryByContractId });
  } catch (error) {
    failures.push(`attestation_current_header_lineage_unresolvable:${text(error?.message) || 'unknown'}`);
  }
  const headerOwner = currentAssertionOwner(
    contract,
    headerResolution.owner,
    headerResolution.lineage,
    'header_emissions',
  );
  const integrationProjection = currentIntegrationBindingProjection(
    contract,
    headerResolution.owner,
    headerResolution.lineage,
  );
  const expectedAssertionOwners = {
    header_emissions: {
      contract_id: headerOwner.owner.contract_id,
      contract_sha256: headerOwner.owner.contract_sha256,
      lineage: headerOwner.lineage,
    },
    integration_bindings: integrationProjection.map(({
      origin_binding_id: id,
      owner,
      lineage,
      retired,
      retirement,
    }) => ({
      id,
      contract_id: owner.contract_id,
      contract_sha256: owner.contract_sha256,
      lineage,
      ...(retired ? { retired: true, retirement } : {}),
    })),
  };
  if (stableJson(attestation?.current_assertion_owners) !== stableJson(expectedAssertionOwners)) {
    failures.push('attestation_current_assertion_owners_mismatch');
  }

  const expectedTrigger = triggerProjection(mergeRequests, contract);
  if (stableJson(attestation?.trigger) !== stableJson(expectedTrigger)) failures.push('attestation_trigger_projection_mismatch');

  const expectedPaths = currentProtectedPaths(contract, headerResolution.owner);
  const protectedFiles = Array.isArray(attestation?.protected_files) ? attestation.protected_files : [];
  const replaySourceByPath = new Map();
  if (!Array.isArray(attestation?.protected_files)) failures.push('attestation_protected_files_missing');
  if (stableJson(protectedFiles.map((file) => text(file?.path))) !== stableJson(expectedPaths)) {
    failures.push('attestation_protected_file_paths_mismatch');
  }
  for (const file of protectedFiles) {
    const filePath = text(file?.path) || 'missing';
    if (!objectHasExactKeys(file, [
      'path', 'requested_ref', 'ref', 'blob_id', 'commit_id', 'last_commit_id', 'encoding',
      'declared_size', 'bytes', 'content_base64', 'sha256', 'line_count',
      'last_commit_provenance', 'error',
    ])) {
      failures.push(`attestation_release_file_fields:${filePath}`);
    }
    if (text(file?.requested_ref) !== reportHead) failures.push(`attestation_release_file_requested_ref:${filePath}`);
    if (text(file?.ref) !== reportHead) failures.push(`attestation_release_file_ref:${filePath}`);
    if (text(file?.commit_id) !== reportHead) failures.push(`attestation_release_file_commit:${filePath}`);
    if (!HEX40.test(text(file?.blob_id))) failures.push(`attestation_release_file_blob:${filePath}`);
    if (!HEX40.test(text(file?.last_commit_id))) failures.push(`attestation_release_file_last_commit:${filePath}`);
    if (text(file?.encoding).toLowerCase() !== 'base64') failures.push(`attestation_release_file_encoding:${filePath}`);
    if (!Number.isSafeInteger(file?.declared_size) || file.declared_size <= 0) {
      failures.push(`attestation_release_file_declared_size:${filePath}`);
    }
    if (!Number.isSafeInteger(file?.bytes) || file.bytes <= 0
      || file.bytes !== file.declared_size) {
      failures.push(`attestation_release_file_bytes:${filePath}`);
    }
    if (!HEX64.test(text(file?.sha256))) failures.push(`attestation_release_file_sha256:${filePath}`);
    if (!Number.isSafeInteger(file?.line_count) || file.line_count <= 0) {
      failures.push(`attestation_release_file_line_count:${filePath}`);
    }
    if (text(file?.error)) failures.push(`attestation_release_file_error:${filePath}`);
    failures.push(...validateReleaseFileProvenance(file?.last_commit_provenance, {
      expectedPath: filePath,
      releaseHead: reportHead,
      commitId: text(file?.commit_id),
      lastCommitId: text(file?.last_commit_id),
      failurePrefix: `attestation_release_file_last_commit_provenance:${filePath}`,
    }));
    try {
      const bytes = strictBase64Decode(file?.content_base64);
      const source = strictUtf8Decode(bytes);
      replaySourceByPath.set(filePath, source);
      if (bytes.length !== file?.bytes
        || bytes.length !== file?.declared_size
        || sha256(bytes) !== text(file?.sha256).toLowerCase()
        || gitBlobSha1(bytes) !== text(file?.blob_id).toLowerCase()
        || (source ? source.replace(/\n$/u, '').split('\n').length : 0) !== file?.line_count) {
        failures.push(`attestation_release_file_content_mismatch:${filePath}`);
      }
    } catch {
      failures.push(`attestation_release_file_content_invalid:${filePath}`);
    }
  }

  const replayFailures = [];
  const observedBindings = Array.isArray(attestation?.integration_bindings)
    ? attestation.integration_bindings : [];
  const successorAncestries = observedBindings
    .map((binding) => binding?.successor_observation)
    .filter((observation) => observation !== undefined);
  const replayHeaderSourcePath = text(headerOwner.owner?.source_file?.path);
  const replayHeaderLines = (replaySourceByPath.get(replayHeaderSourcePath) || '').split('\n');
  const replayedHeaders = headerOwner.owner.header_emissions.map((header) => {
    const emissionCount = replayHeaderLines.filter((line) => line === header.emission.source).length;
    const valueDefinitionCount = header.value_definition
      ? replayHeaderLines.filter((line) => line === header.value_definition.source).length
      : 0;
    const verified = emissionCount === 1
      && valueDefinitionCount === (header.value_definition ? 1 : 0);
    if (!verified) replayFailures.push(`current_header_source_mismatch:${header.name}`);
    return {
      ...header,
      emission_count: emissionCount,
      value_definition_count: valueDefinitionCount,
      verified,
    };
  });
  const replayedBindings = integrationProjection.map((projection) => (
    projection.retired
      ? retiredCurrentIntegrationBinding(projection)
      : observeCurrentIntegrationBinding(
        projection.binding,
        replaySourceByPath.get(projection.binding.path) || '',
        replayFailures,
        { releaseHead: reportHead, mergeRequests, successorAncestries },
      )
  ));
  const replayedForbiddenFragments = observeCurrentForbiddenFragments(
    contract,
    headerResolution.owner,
    replaySourceByPath,
    replayFailures,
  );
  if (replayFailures.length > 0) failures.push(...replayFailures.map((failure) => `attestation_replay:${failure}`));
  if (stableJson(attestation?.headers) !== stableJson(replayedHeaders)) {
    failures.push('attestation_current_headers_replay_mismatch');
  }
  if (stableJson(attestation?.integration_bindings) !== stableJson(replayedBindings)) {
    failures.push('attestation_current_integration_bindings_replay_mismatch');
  }
  if (stableJson(attestation?.forbidden_fragments) !== stableJson(replayedForbiddenFragments)) {
    failures.push('attestation_current_forbidden_fragments_replay_mismatch');
  }

  if (isAssertionRetirementContract(contract)) {
    const expectedRetiredFiles = contract.retired_files.map((file) => ({
      ...file,
      disposition: 'retired',
      verified: true,
    }));
    if (stableJson(attestation?.retired_files) !== stableJson(expectedRetiredFiles)) {
      failures.push('attestation_current_retired_files_mismatch');
    }
  } else if (attestation?.retired_files !== undefined) {
    failures.push('attestation_current_retired_files_unexpected');
  }

  const expectedHeaders = headerOwner.owner.header_emissions.map((header) => ({
    ...header,
    emission_count: 1,
    value_definition_count: header.value_definition ? 1 : 0,
    verified: true,
  }));
  if (stableJson(attestation?.headers) !== stableJson(expectedHeaders)) failures.push('attestation_current_headers_mismatch');
  const expectedBindings = integrationProjection.map((projection, index) => {
    if (projection.retired) return retiredCurrentIntegrationBinding(projection);
    const { binding } = projection;
    const observedBinding = observedBindings[index];
    const occurrenceCount = Number(observedBinding?.occurrence_count);
    const scoped = Boolean(binding.current_release_scope);
    const ownerScoped = binding.current_release_scope?.boundary === CURRENT_RELEASE_OWNER_SCOPE_BOUNDARY;
    const regionScoped = binding.current_release_scope?.boundary === CURRENT_RELEASE_REGION_SCOPE_BOUNDARY;
    const expectedCurrentOccurrenceCount = Number(binding.expected_current_occurrence_count ?? 1);
    const occurrenceCountValid = Number.isSafeInteger(occurrenceCount)
      && (ownerScoped && binding.expected_current_occurrence_count === undefined
        ? occurrenceCount >= 1
        : occurrenceCount === expectedCurrentOccurrenceCount);
    if (!occurrenceCountValid) {
      failures.push(`attestation_current_integration_binding_count:${binding.id}`);
    }
    const expected = {
      ...binding,
      addition_count: occurrenceCount,
      occurrence_count: occurrenceCount,
      ...(replayedBindings[index]?.successor_observation ? {
        successor_observation: replayedBindings[index].successor_observation,
      } : {}),
      verified: true,
    };
    if (!scoped) return expected;
    const scopeObservation = observedBinding?.scope_observation;
    if (Number(scopeObservation?.owner_occurrence_count) !== 1) {
      failures.push(`attestation_current_integration_binding_scope_owner:${binding.id}`);
    }
    if (Number(scopeObservation?.occurrence_count) !== 1) {
      failures.push(`attestation_current_integration_binding_scope_occurrence:${binding.id}`);
    }
    if (regionScoped) {
      if (Number(scopeObservation?.region_start_occurrence_count) !== 1) {
        failures.push(`attestation_current_integration_binding_scope_region_start:${binding.id}`);
      }
      if (Number(scopeObservation?.region_end_occurrence_count) !== 1) {
        failures.push(`attestation_current_integration_binding_scope_region_end:${binding.id}`);
      }
      if (scopeObservation?.region_ordered !== true) {
        failures.push(`attestation_current_integration_binding_scope_region_order:${binding.id}`);
      }
      const expectedOwnerRegionOrder = binding.current_release_scope.owner_region_order.map((record) => ({
        ...record,
        occurrence_count: 1,
        verified: true,
      }));
      if (stableJson(scopeObservation?.owner_region_order) !== stableJson(expectedOwnerRegionOrder)
        || scopeObservation?.owner_region_ordered !== true) {
        failures.push(`attestation_current_integration_binding_scope_region_sequence:${binding.id}`);
      }
    }
    const observedFragments = Array.isArray(scopeObservation?.required_fragments)
      ? scopeObservation.required_fragments : [];
    const expectedRequiredFragments = [];
    const requiredFragmentLineIndexes = [];
    for (const [fragmentIndex, fragment] of binding.current_release_scope.required_fragments.entries()) {
      const observedFragment = observedFragments[fragmentIndex];
      const expectedLineIndex = fragment.expected_line_index;
      const lineIndexValid = !regionScoped || (
        Number.isSafeInteger(observedFragment?.line_index)
        && observedFragment.line_index === expectedLineIndex
      );
      const observedStatic = structuredClone(observedFragment || {});
      delete observedStatic.line_index;
      if (stableJson(observedStatic) !== stableJson({
        ...fragment,
        occurrence_count: 1,
        verified: true,
      }) || !lineIndexValid) {
        failures.push(`attestation_current_integration_binding_scope_fragment:${binding.id}:${fragment.id}`);
      }
      if (regionScoped) {
        requiredFragmentLineIndexes.push(lineIndexValid ? observedFragment.line_index : null);
      }
      expectedRequiredFragments.push({
        ...fragment,
        occurrence_count: 1,
        ...(regionScoped ? { line_index: expectedLineIndex } : {}),
        verified: true,
      });
    }
    if (regionScoped) {
      const fragmentsOrdered = requiredFragmentLineIndexes.every((lineIndex) => lineIndex !== null)
        && requiredFragmentLineIndexes.every((lineIndex, index) => (
          index === 0 || requiredFragmentLineIndexes[index - 1] < lineIndex
        ));
      if (scopeObservation?.required_fragments_ordered !== true || !fragmentsOrdered) {
        failures.push(`attestation_current_integration_binding_scope_fragment_order:${binding.id}`);
      }
    }
    const observedForbiddenFragments = Array.isArray(scopeObservation?.forbidden_fragments)
      ? scopeObservation.forbidden_fragments : [];
    for (const [fragmentIndex, fragment] of (binding.current_release_scope.forbidden_fragments || []).entries()) {
      if (Number(observedForbiddenFragments[fragmentIndex]?.occurrence_count) !== 0
        || observedForbiddenFragments[fragmentIndex]?.verified !== true) {
        failures.push(`attestation_current_integration_binding_scope_forbidden_fragment:${binding.id}:${fragment.id}`);
      }
    }
    return {
      ...expected,
      scope_observation: {
        owner_occurrence_count: 1,
        ...(regionScoped ? {
          region_start_occurrence_count: 1,
          region_end_occurrence_count: 1,
          region_ordered: true,
          owner_region_order: binding.current_release_scope.owner_region_order.map((record) => ({
            ...record,
            occurrence_count: 1,
            verified: true,
          })),
          owner_region_ordered: true,
        } : {}),
        occurrence_count: 1,
        required_fragments: expectedRequiredFragments,
        ...(regionScoped ? {
          required_fragments_ordered: true,
          forbidden_fragments: (binding.current_release_scope.forbidden_fragments || []).map((fragment) => ({
            ...fragment,
            occurrence_count: 0,
            verified: true,
          })),
        } : {}),
        verified: true,
      },
    };
  });
  if (stableJson(attestation?.integration_bindings) !== stableJson(expectedBindings)) {
    failures.push('attestation_current_integration_bindings_mismatch');
  }
  const expectedForbiddenFragments = currentForbiddenAssertions(contract, headerResolution.owner).map((assertion) => ({
    ...assertion,
    observation_scope: 'current-release-file',
    occurrence_count: 0,
    verified: true,
  }));
  if (stableJson(attestation?.forbidden_fragments) !== stableJson(expectedForbiddenFragments)) {
    failures.push('attestation_current_forbidden_fragments_mismatch');
  }
  if (contract.contract_id === QWORK_MR1597_WORKER_IM_USER_IDENTITY_FORWARDING_CONTRACT_ID) {
    const replayFailures = [];
    const replayedSemantics = observeMr1597WorkerEnvironmentTestSemantics(
      replaySourceByPath,
      replayFailures,
    );
    if (replayFailures.length > 0
      || !mr1597SemanticObservationIsVerified(attestation?.current_release_semantics)
      || stableJson(attestation?.current_release_semantics) !== stableJson(replayedSemantics)) {
      failures.push('attestation_current_release_semantics_mismatch');
    }
  } else if (attestation?.current_release_semantics !== undefined) {
    failures.push('attestation_current_release_semantics_unexpected');
  }

  const originRows = mergeRequests.filter((mr) => {
    const trigger = releaseSourceContractTrigger(mr, contract);
    return trigger.iid_match || trigger.merge_sha_match;
  });
  if (originRows.length > 1) failures.push('attestation_origin_mr_duplicate');
  if (originRows.length === 1) {
    if (isAssertionRetirementContract(contract)) {
      const accountingRows = (Array.isArray(report?.commit_accounting) ? report.commit_accounting : [])
        .filter((row) => (
          text(row?.commit) === contract.merge_commit_sha || text(row?.mr_iid) === contract.mr_iid
        ));
      const expectedAccounting = {
        commit: contract.merge_commit_sha,
        parent_count: 2,
        classification: 'merge_mr',
        mr_iid: contract.mr_iid,
        attribution_verified: true,
        reason: '',
      };
      if (accountingRows.length !== 1
        || stableJson(accountingRows[0]) !== stableJson(expectedAccounting)) {
        failures.push('attestation_retirement_commit_accounting_mismatch');
      }
    }
    if (!attestation?.origin_change_attestation) failures.push('attestation_origin_change_missing');
    else {
      const originValidation = validateReleaseSourceContractAttestation(attestation.origin_change_attestation, {
        mr: originRows[0],
        contract,
      });
      failures.push(...originValidation.failures.map((failure) => `origin_change:${failure}`));
    }
  } else if (attestation?.origin_change_attestation !== null) {
    failures.push('attestation_origin_change_unexpected');
  }
  return { ok: failures.length === 0, failures };
}

export function validateReleaseSourceContractsForReport(report, contracts = QWORK_RELEASE_SOURCE_CONTRACTS) {
  const failures = [];
  const unresolvedFailures = [];
  let effectiveContracts;
  try {
    effectiveContracts = resolveReleaseSourceContracts(contracts);
  } catch (error) {
    const failure = `source_contract_registry_invalid:${text(error?.message) || 'unknown'}`;
    return { ok: false, failures: [failure], unresolved_failures: [failure] };
  }
  const mergeRequests = Array.isArray(report?.merge_requests) ? report.merge_requests : [];
  const attestations = Array.isArray(report?.source_contracts) ? report.source_contracts : [];
  const persistentCurrentReleaseRequired = report?.policy?.api_freshness?.mode === 'gitlab-api';
  if (!Array.isArray(report?.source_contracts)) failures.push('source_contracts_missing');
  const contractById = new Map(effectiveContracts.map((contract) => [contract.contract_id, contract]));
  const knownIds = new Set(contractById.keys());
  const addFailure = (failure, unresolved = true) => {
    failures.push(failure);
    if (unresolved) unresolvedFailures.push(failure);
  };
  for (const attestation of attestations) {
    const contractId = text(attestation?.contract_id);
    if (!knownIds.has(contractId)) addFailure(`source_contract_unknown:${contractId || 'missing'}`);
    const auditFailures = Array.isArray(attestation?.failures) ? attestation.failures.map(text).filter(Boolean) : [];
    if (auditFailures.length) unresolvedFailures.push(`${contractId || 'missing'}:${auditFailures.join(',')}`);
    else if (attestation?.verified !== true || attestation?.status !== 'VERIFIED') {
      unresolvedFailures.push(`${contractId || 'missing'}:attestation_not_verified`);
    }
  }
  for (const mr of mergeRequests) {
    const iid = text(mr?.iid) || 'missing';
    if (!Array.isArray(mr?.source_contract_ids)) {
      addFailure(`source_contract_mr_bindings_missing:${iid}`);
      continue;
    }
    const ids = mr.source_contract_ids.map(text);
    if (ids.some((id) => !id)) addFailure(`source_contract_mr_binding_id_missing:${iid}`);
    if (new Set(ids).size !== ids.length) addFailure(`source_contract_mr_binding_duplicate:${iid}`);
    for (const contractId of ids) {
      const contract = contractById.get(contractId);
      if (!contract) addFailure(`source_contract_mr_binding_unknown:${iid}:${contractId || 'missing'}`);
      else if (!releaseSourceContractTrigger(mr, contract).triggered) {
        addFailure(`source_contract_mr_binding_wrong_mr:${iid}:${contractId}`);
      }
    }
    const expectedIds = effectiveContracts
      .filter((contract) => releaseSourceContractTrigger(mr, contract).triggered)
      .map((contract) => contract.contract_id);
    if (stableJson(ids) !== stableJson(expectedIds)) addFailure(`source_contract_mr_binding_mismatch:${iid}`);
  }
  for (const contract of effectiveContracts) {
    const matchingMrs = mergeRequests.filter((mr) => releaseSourceContractTrigger(mr, contract).triggered);
    const matchingAttestations = attestations.filter((item) => text(item?.contract_id) === contract.contract_id);
    if (!persistentCurrentReleaseRequired && matchingMrs.length > 1) {
      addFailure(`source_contract_mr_duplicate:${contract.contract_id}`);
    }
    if (!persistentCurrentReleaseRequired && matchingMrs.length === 0) {
      if (matchingAttestations.length) addFailure(`source_contract_without_mr:${contract.contract_id}`);
      continue;
    }
    if (matchingAttestations.length !== 1) {
      addFailure(`source_contract_attestation_count:${contract.contract_id}:${matchingAttestations.length}`);
      continue;
    }
    const validation = persistentCurrentReleaseRequired
      ? validateCurrentReleaseSourceContractAttestation(matchingAttestations[0], {
        report,
        contract,
        contracts: effectiveContracts,
      })
      : validateReleaseSourceContractAttestation(matchingAttestations[0], {
        mr: matchingMrs[0],
        contract,
      });
    for (const failure of validation.failures) addFailure(`${contract.contract_id}:${failure}`);
    for (const matchingMr of matchingMrs) {
      const ids = Array.isArray(matchingMr?.source_contract_ids) ? matchingMr.source_contract_ids : [];
      if (!ids.includes(contract.contract_id)) addFailure(`source_contract_mr_binding_mismatch:${contract.contract_id}`);
    }
  }
  const verifiedCount = attestations.filter((item) => item?.verified === true && item?.status === 'VERIFIED').length;
  const originAttestations = attestations
    .map((item) => item?.origin_change_attestation)
    .filter((item) => item !== null && item !== undefined);
  const originVerifiedCount = originAttestations
    .filter((item) => item?.verified === true && item?.status === 'VERIFIED').length;
  const expectedUnresolved = [...new Set(unresolvedFailures)].sort();
  const observedUnresolvedRaw = report?.unresolved?.source_contract_failures;
  const observedUnresolved = Array.isArray(observedUnresolvedRaw)
    ? observedUnresolvedRaw.map(text).filter(Boolean)
    : [];
  if (!Array.isArray(observedUnresolvedRaw)) failures.push('source_contract_unresolved_missing');
  if (new Set(observedUnresolved).size !== observedUnresolved.length) failures.push('source_contract_unresolved_duplicate');
  if (stableJson([...new Set(observedUnresolved)].sort()) !== stableJson(expectedUnresolved)) {
    failures.push('source_contract_unresolved_mismatch');
  }
  if (Number(report?.summary?.source_contract_count) !== attestations.length) {
    failures.push('source_contract_summary_count_mismatch');
  }
  if (Number(report?.summary?.source_contract_verified_count) !== verifiedCount) {
    failures.push('source_contract_summary_verified_count_mismatch');
  }
  if (persistentCurrentReleaseRequired) {
    if (Number(report?.summary?.source_contract_current_count) !== attestations.length) {
      failures.push('source_contract_summary_current_count_mismatch');
    }
    if (Number(report?.summary?.source_contract_current_verified_count) !== verifiedCount) {
      failures.push('source_contract_summary_current_verified_count_mismatch');
    }
    if (Number(report?.summary?.source_contract_origin_count) !== originAttestations.length) {
      failures.push('source_contract_summary_origin_count_mismatch');
    }
    if (Number(report?.summary?.source_contract_origin_verified_count) !== originVerifiedCount) {
      failures.push('source_contract_summary_origin_verified_count_mismatch');
    }
    const apiFreshness = report?.policy?.api_freshness;
    if (Number(apiFreshness?.source_contract_current_count) !== attestations.length) {
      failures.push('source_contract_freshness_current_count_mismatch');
    }
    if (Number(apiFreshness?.source_contract_current_verified_count) !== verifiedCount) {
      failures.push('source_contract_freshness_current_verified_count_mismatch');
    }
    if (Number(apiFreshness?.source_contract_origin_count) !== originAttestations.length) {
      failures.push('source_contract_freshness_origin_count_mismatch');
    }
    if (Number(apiFreshness?.source_contract_origin_verified_count) !== originVerifiedCount) {
      failures.push('source_contract_freshness_origin_verified_count_mismatch');
    }
  }
  if (Number(report?.summary?.source_contract_failure_count) !== observedUnresolved.length) {
    failures.push('source_contract_summary_failure_count_mismatch');
  }
  return { ok: failures.length === 0, failures, unresolved_failures: expectedUnresolved };
}
