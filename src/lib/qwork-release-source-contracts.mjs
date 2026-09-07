import { createHash } from 'node:crypto';
import { parse } from 'acorn';

export const QWORK_RELEASE_SOURCE_CONTRACT_SCHEMA = 'qbot-qwork-release-source-contract/v1';
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
  forbiddenFragments = [],
}) {
  return {
    schema_version: QWORK_RELEASE_SOURCE_OWNER_SCOPE_SCHEMA,
    boundary: CURRENT_RELEASE_REGION_SCOPE_BOUNDARY,
    owner_start: byteRecord(ownerStart),
    region_start: byteRecord(regionStart),
    region_end: byteRecord(regionEnd),
    owner_region_order: ownerRegionOrder.map((source) => byteRecord(source)),
    required_fragments: requiredFragments.map(([id, source], index) => ({
      id,
      match: 'line',
      value: byteRecord(source),
      expected_line_index: index + 1,
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
const MR1597_PRODUCT_PATHS = [
  'electron/host-core/agent/execution-worker-launch-policy.cjs',
  'electron/host-core/agent/execution-worker-process-lifecycle.cjs',
  'electron/host-core/agent/execution-worker-supervisor.cjs',
];
const MR1597_TEST_PATH = 'test/unit/desktop/execution-worker-supervisor.test.mjs';
const MR1597_CHANGED_PATHS = [...MR1597_PRODUCT_PATHS, MR1597_TEST_PATH];
const MR1597_TEST_OWNER = "test('worker process environment is allowlisted and excludes bearer/token material', () => {";
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
const MR1597_EXPECTED_REGION_END = '  });';
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
});
const MR1597_EXPECTED_SCOPE = currentReleaseRegionScope({
  ownerStart: MR1597_TEST_OWNER,
  regionStart: MR1597_EXPECTED_REGION_START,
  regionEnd: MR1597_EXPECTED_REGION_END,
  ownerRegionOrder: MR1597_OWNER_REGION_ORDER,
  requiredFragments: MR1597_IDENTITY_LINES,
  forbiddenFragments: [['access_token_expected_forbidden', MR1597_ACCESS_TOKEN_KEY, 'js-property-key']],
});
const MR1597_INTEGRATION_BINDINGS = [
  ...MR1597_PRODUCT_PATHS.map((filePath, index) => ({ id: `worker_allowlist_${index + 1}`, path: filePath, addition: byteRecord(MR1597_ALLOWLIST_LINE) })),
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

function validateCurrentReleaseOwnerScopes(contract, contractId) {
  const bindings = Array.isArray(contract?.integration_bindings) ? contract.integration_bindings : [];
  for (const binding of bindings) {
    for (const field of ['expected_addition_count', 'expected_current_occurrence_count']) {
      if (binding?.[field] !== undefined
        && (!Number.isSafeInteger(Number(binding[field])) || Number(binding[field]) < 1)) {
        throw new Error(`source_contract_binding_expected_count_invalid:${contractId}:${binding.id}:${field}`);
      }
    }
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
    if (regionScoped && fragments.some((fragment, index) => fragment.expected_line_index !== index + 1)) {
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
      || scope.forbidden_fragments !== undefined)) {
      throw new Error(`source_contract_current_release_scope_contract_invalid:${contractId}:${binding.id}`);
    }
    if (regionScoped && (
      !byteRecordIsExactLine(scope.region_start)
      || !byteRecordIsExactLine(scope.region_end)
      || scope.region_start.source === scope.region_end.source
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
    if (binding.current_release_match !== undefined
      && (binding.current_release_match?.match !== 'js-property-key'
        || !byteRecordIsExactLine(binding.current_release_match?.value))) {
      throw new Error(`source_contract_current_release_match_invalid:${contractId}:${binding.id}`);
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
  return [...new Set([
    ...releaseSourceContractProtectedPaths(contract),
    ...(text(currentOwner?.contract_id) === text(contract?.contract_id)
      ? []
      : releaseSourceContractProtectedPaths(currentOwner)),
  ].filter((filePath) => !retiredPaths.has(filePath)))];
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

function observeCurrentIntegrationBinding(binding, source, failures) {
  const occurrenceCount = binding.current_release_match
    ? fragmentOccurrenceCount(source, binding.current_release_match)
    : exactLineOccurrenceCount(source, binding.addition.source);
  const expectedCurrentOccurrenceCount = Number(binding.expected_current_occurrence_count ?? 1);
  const scope = binding.current_release_scope;
  if (!scope) {
    const verified = occurrenceCount === expectedCurrentOccurrenceCount;
    if (!verified) failures.push(`current_integration_binding_mismatch:${binding.id}`);
    return {
      ...binding,
      addition_count: occurrenceCount,
      occurrence_count: occurrenceCount,
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
    scopedLines = regionOrdered
      ? ownerLines.slice(regionStartIndexes[0], regionEndIndexes[0] + 1)
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
  const normalized = String(value || '').replace(/\s+/gu, '');
  if (!normalized || !/^[A-Za-z0-9+/]*={0,2}$/u.test(normalized) || normalized.length % 4 !== 0) {
    throw new Error('file_content_base64_invalid');
  }
  const bytes = Buffer.from(normalized, 'base64');
  if (bytes.toString('base64') !== normalized) throw new Error('file_content_base64_noncanonical');
  return bytes;
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
  const declaredSize = Number(payload?.size);
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
  const source = bytes.toString('utf8');
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
      declared_size: Number.isFinite(declaredSize) ? declaredSize : null,
      bytes: bytes.length,
      sha256: bytes.length ? sha256(bytes) : '',
      line_count: source ? source.replace(/\n$/u, '').split('\n').length : 0,
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
      )
  ));
  const forbiddenFragments = observeCurrentForbiddenFragments(
    contract,
    currentHeaderContract,
    sourceByPath,
    failures,
  );

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
    schema_version: QWORK_RELEASE_SOURCE_CONTRACT_SCHEMA,
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
        compare_commit_count: Number(originAncestry?.compare_commit_count) || 0,
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
  if (attestation?.schema_version !== QWORK_RELEASE_SOURCE_CONTRACT_SCHEMA) failures.push('attestation_schema_mismatch');
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
  if (!Number.isSafeInteger(Number(ancestry?.compare_commit_count)) || Number(ancestry?.compare_commit_count) < 0) {
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
  if (!Array.isArray(attestation?.protected_files)) failures.push('attestation_protected_files_missing');
  if (stableJson(protectedFiles.map((file) => text(file?.path))) !== stableJson(expectedPaths)) {
    failures.push('attestation_protected_file_paths_mismatch');
  }
  for (const file of protectedFiles) {
    const filePath = text(file?.path) || 'missing';
    if (text(file?.requested_ref) !== reportHead) failures.push(`attestation_release_file_requested_ref:${filePath}`);
    if (text(file?.ref) !== reportHead) failures.push(`attestation_release_file_ref:${filePath}`);
    if (text(file?.commit_id) !== reportHead) failures.push(`attestation_release_file_commit:${filePath}`);
    if (!HEX40.test(text(file?.blob_id))) failures.push(`attestation_release_file_blob:${filePath}`);
    if (!HEX40.test(text(file?.last_commit_id))) failures.push(`attestation_release_file_last_commit:${filePath}`);
    if (text(file?.encoding).toLowerCase() !== 'base64') failures.push(`attestation_release_file_encoding:${filePath}`);
    if (!Number.isSafeInteger(Number(file?.declared_size)) || Number(file?.declared_size) <= 0) {
      failures.push(`attestation_release_file_declared_size:${filePath}`);
    }
    if (!Number.isSafeInteger(Number(file?.bytes)) || Number(file?.bytes) <= 0
      || Number(file?.bytes) !== Number(file?.declared_size)) {
      failures.push(`attestation_release_file_bytes:${filePath}`);
    }
    if (!HEX64.test(text(file?.sha256))) failures.push(`attestation_release_file_sha256:${filePath}`);
    if (!Number.isSafeInteger(Number(file?.line_count)) || Number(file?.line_count) <= 0) {
      failures.push(`attestation_release_file_line_count:${filePath}`);
    }
    if (text(file?.error)) failures.push(`attestation_release_file_error:${filePath}`);
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
  const observedBindings = Array.isArray(attestation?.integration_bindings)
    ? attestation.integration_bindings : [];
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
