import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export const CORE_BETA_CONTRACT_VERSION = 'qbot-core-beta/v2';
export const CORE_BETA_AUTOMATION_PROTOCOL = 'core-beta-action-plan/v2';
export const CORE_BETA_EVIDENCE_SCHEMA = 'qbot-core-evidence/v2';
export const CORE_BETA_MAX_BATCH_SIZE = 20;

export const CORE_BETA_CASE_TYPES = new Set([
  'run_initialization',
  'conversation',
  'attachment',
  'artifact',
  'skill_lifecycle',
  'skill_use',
  'expert_lifecycle',
  'expert_use',
  'mcp_lifecycle',
  'mcp_use',
  'recovery',
  'auth_recovery',
  'task_lifecycle',
  'project_lifecycle',
  'project_automation',
  'knowledge_lifecycle',
  'memory_lifecycle',
  'settings_lifecycle',
  'host_integration',
  'security_privacy',
  'performance_capacity',
]);

export const CORE_BETA_PIPELINE_POLICIES = new Set([
  'serial',
  'dispatch_collect',
  'dispatch_collect_round_robin',
]);

export const CORE_BETA_EXECUTOR_ROUTES = Object.freeze({
  run_initialization: 'core-beta/run-initialization-v2',
  conversation: 'core-beta/conversation-v2',
  attachment: 'core-beta/attachment-v2',
  artifact: 'core-beta/artifact-v2',
  skill_lifecycle: 'core-beta/skill-lifecycle-v2',
  skill_use: 'core-beta/skill-use-v2',
  expert_lifecycle: 'core-beta/expert-lifecycle-bridge-v2',
  expert_use: 'core-beta/expert-use-v2',
  mcp_lifecycle: 'core-beta/mcp-lifecycle-v2',
  mcp_use: 'core-beta/mcp-use-v2',
  recovery: 'core-beta/recovery-v2',
  auth_recovery: 'core-beta/auth-recovery-v2',
  task_lifecycle: 'core-beta/task-lifecycle-v2',
  project_lifecycle: 'core-beta/project-lifecycle-v2',
  project_automation: 'core-beta/project-automation-v2',
  knowledge_lifecycle: 'core-beta/knowledge-lifecycle-v2',
  memory_lifecycle: 'core-beta/memory-lifecycle-v2',
  settings_lifecycle: 'core-beta/settings-lifecycle-v2',
  host_integration: 'core-beta/host-integration-v2',
  security_privacy: 'core-beta/security-privacy-v2',
  performance_capacity: 'core-beta/performance-capacity-v2',
});

const CORE_BETA_CASE_RANGES = Object.freeze({
  INIT: 5,
  CHAT: 10,
  FILE: 10,
  ART: 11,
  SKILL: 20,
  EXPERT: 24,
  MCP: 14,
  REC: 4,
  AUTH: 6,
  TASK: 10,
  PROJECT: 8,
  AUTO: 5,
  KNOW: 4,
  MEM: 4,
  SETTINGS: 5,
  HOST: 6,
  SEC: 8,
  PERF: 6,
});

export const CORE_BETA_SCENARIO_IDS = new Set(
  Object.entries(CORE_BETA_CASE_RANGES).flatMap(([group, count]) => (
    Array.from({ length: count }, (_, index) => `BETA-${group}-${String(index + 1).padStart(3, '0')}`)
  )),
);

const scenarioSpecs = [];
const registerScenario = (id, driver, {
  fixture_control = 'public_product_state',
  execution_mode = 'serial',
  legacy_case_id = '',
  runtime_fixture = '',
} = {}) => {
  scenarioSpecs.push([id, Object.freeze({
    id,
    driver,
    fixture_control,
    execution_mode,
    legacy_case_id,
    runtime_fixture,
    executor_route: `core-beta/scenario/${id.toLowerCase()}/v1`,
  })]);
};

[
  ['BETA-INIT-001', 'release_identity_and_runtime_preflight'],
  ['BETA-INIT-002', 'runtime_full_reset'],
  ['BETA-INIT-003', 'skill_runtime_reinstall'],
  ['BETA-INIT-004', 'session_and_capability_purge'],
  ['BETA-INIT-005', 'connection_cache_and_first_send', { fixture_control: 'connection_cache_fault' }],
  ['BETA-CHAT-001', 'conversation_business_oracle'],
  ['BETA-CHAT-002', 'conversation_multiturn_math'],
  ['BETA-CHAT-003', 'conversation_clarification'],
  ['BETA-CHAT-004', 'conversation_missing_data_guard'],
  ['BETA-CHAT-005', 'conversation_streaming_scroll'],
  ['BETA-CHAT-006', 'conversation_stop_and_resume'],
  ['BETA-CHAT-007', 'conversation_sidebar_persistence'],
  ['BETA-CHAT-008', 'conversation_dispatch_collect_20', { execution_mode: 'dispatch_collect' }],
  ['BETA-CHAT-009', 'conversation_sensitive_data_guard'],
  ['BETA-CHAT-010', 'conversation_native_ime', { fixture_control: 'native_ime_input' }],
  ['BETA-FILE-001', 'attachment_pdf_readback'],
  ['BETA-FILE-002', 'attachment_image_readback'],
  ['BETA-FILE-003', 'attachment_office_readback'],
  ['BETA-FILE-004', 'attachment_tabular_readback'],
  ['BETA-FILE-005', 'attachment_mixed_format_readback'],
  ['BETA-FILE-006', 'attachment_pre_send_rejection_matrix'],
  ['BETA-FILE-007', 'attachment_limits_recovery_send', { runtime_fixture: 'limit_matrix' }],
  ['BETA-FILE-008', 'attachment_ingress_equivalence', { runtime_fixture: 'picker_drag_clipboard' }],
  ['BETA-FILE-009', 'attachment_duplicate_identity', { runtime_fixture: 'duplicate_name_set' }],
  ['BETA-FILE-010', 'attachment_partial_parse_failure', {
    legacy_case_id: 'SIT-FILE-NEW-001',
    runtime_fixture: 'partial_parse_failure',
  }],
  ['BETA-ART-001', 'artifact_markdown_html_validation'],
  ['BETA-ART-002', 'artifact_docx_validation'],
  ['BETA-ART-003', 'artifact_xlsx_csv_validation'],
  ['BETA-ART-004', 'artifact_pptx_pdf_validation'],
  ['BETA-ART-005', 'artifact_svg_secure_preview', { fixture_control: 'artifact_preview_fault' }],
  ['BETA-SKILL-001', 'skill_qa_baseline_cleanup'],
  ['BETA-SKILL-002', 'skill_market_deterministic_sample_10'],
  ['BETA-SKILL-003', 'skill_install_batch_1_5'],
  ['BETA-SKILL-004', 'skill_install_batch_6_10'],
  ['BETA-SKILL-005', 'skill_cross_surface_reconcile'],
  ['BETA-SKILL-006', 'skill_deep_use_sample_1'],
  ['BETA-SKILL-007', 'skill_deep_use_sample_2'],
  ['BETA-SKILL-008', 'skill_deep_use_sample_3'],
  ['BETA-SKILL-009', 'skill_deep_use_sample_4'],
  ['BETA-SKILL-010', 'skill_deep_use_sample_5'],
  ['BETA-SKILL-011', 'skill_task_isolation_and_disabled_connector'],
  ['BETA-SKILL-012', 'skill_cancel_then_cleanup_10'],
  ['BETA-SKILL-013', 'skill_builtin_authority_fail_closed', { fixture_control: 'builtin_skill_projection_fault' }],
  ['BETA-SKILL-014', 'skill_creator_exact_identity'],
  ['BETA-SKILL-015', 'skill_connector_four_state_matrix', { fixture_control: 'connector_delivery_state_matrix' }],
  ['BETA-EXPERT-001', 'expert_center_inventory_search_summon'],
  ['BETA-EXPERT-002', 'expert_builder_claude_draft'],
  ['BETA-EXPERT-003', 'expert_builder_codex_draft'],
  ['BETA-EXPERT-004', 'expert_manual_draft_typed_dependencies'],
  ['BETA-EXPERT-005', 'expert_draft_etag_conflict'],
  ['BETA-EXPERT-006', 'expert_validate_debug_frozen_revision', { fixture_control: 'expert_skill_policy_matrix' }],
  ['BETA-EXPERT-007', 'expert_publish_state_machine', { fixture_control: 'expert_publish_fault_matrix' }],
  ['BETA-EXPERT-008', 'expert_research_three_turn'],
  ['BETA-EXPERT-009', 'expert_data_three_turn_attachment'],
  ['BETA-EXPERT-010', 'expert_delivery_three_turn_artifact'],
  ['BETA-EXPERT-011', 'expert_owner_only_second_account', { fixture_control: 'secondary_account' }],
  ['BETA-EXPERT-012', 'expert_immutable_version_upgrade'],
  ['BETA-EXPERT-013', 'expert_authenticated_viewer', { fixture_control: 'secondary_account' }],
  ['BETA-EXPERT-014', 'expert_three_task_identity_isolation'],
  ['BETA-EXPERT-015', 'expert_export_import_security'],
  ['BETA-EXPERT-016', 'expert_unpublish_archive_history'],
  ['BETA-EXPERT-017', 'expert_native_authoring_publish_viewer_loop', { fixture_control: 'expert_native_product_loop' }],
  ['BETA-EXPERT-018', 'expert_publish_confirmation_safety_matrix', { fixture_control: 'expert_confirmation_fault_matrix' }],
  ['BETA-EXPERT-019', 'expert_authoring_surface_parity_matrix', { fixture_control: 'expert_authoring_surface_matrix' }],
  ['BETA-EXPERT-020', 'expert_authoring_turn_local_security_matrix', { fixture_control: 'expert_authoring_security_matrix' }],
  ['BETA-MCP-001', 'mcp_catalog_deterministic_sample_5'],
  ['BETA-MCP-002', 'mcp_cross_surface_identity_reconcile'],
  ['BETA-MCP-003', 'mcp_document_two_turn'],
  ['BETA-MCP-004', 'mcp_fresh_web_two_turn'],
  ['BETA-MCP-005', 'mcp_structured_data_two_turn'],
  ['BETA-MCP-006', 'mcp_collaboration_two_turn'],
  ['BETA-MCP-007', 'mcp_other_tool_two_turn'],
  ['BETA-MCP-008', 'mcp_last_good_failure_recovery', { fixture_control: 'mcp_discovery_fault' }],
  ['BETA-REC-001', 'teams_embedded_reopen_running', { fixture_control: 'managed_teams_restart' }],
  ['BETA-REC-002', 'runtime_crash_recovery', { fixture_control: 'managed_runtime_restart' }],
  ['BETA-REC-003', 'codex_proxy_no_proxy_matrix', { fixture_control: 'codex_proxy_matrix' }],
  ['BETA-REC-004', 'claude_runtime_home_isolation', { fixture_control: 'managed_runtime_restart' }],
  ['BETA-AUTH-001', 'auth_refresh_expiry_recovery', { fixture_control: 'auth_refresh_fault' }],
  ['BETA-TASK-004', 'task_hitl_answer_skip_timeout', { fixture_control: 'hitl_answer_skip_timeout' }],
  ['BETA-SEC-005', 'security_ssrf_advanced_matrix', { fixture_control: 'ssrf_advanced_matrix' }],
].forEach(([id, driver, options]) => registerScenario(id, driver, options));

const productionExtensionLegacyDrivers = Object.freeze({
  'BETA-TASK-003': 'SIT-TASK-RECOVER-001',
  'BETA-HOST-003': 'SIT-TEAMS-NEW-003',
  'BETA-SEC-002': 'SIT-WORKSPACE-001',
  'BETA-PERF-003': 'SIT-ISSUE-793',
});

const productionExtensionFixtureControls = Object.freeze({
  'BETA-AUTH-002': 'oauth_real_or_controlled',
  'BETA-AUTH-003': 'auth_cancel_and_retry',
  'BETA-AUTH-004': 'auth_restart_token_epoch',
  'BETA-AUTH-005': 'logout_credential_recovery_matrix',
  'BETA-AUTH-006': 'secondary_account',
  'BETA-TASK-001': 'task_edit_branch_artifact_matrix',
  'BETA-TASK-002': 'task_regenerate_version_artifact_matrix',
  'BETA-TASK-005': 'task_work_mode_three_task_matrix',
  'BETA-TASK-006': 'task_security_tier_execution_matrix',
  'BETA-TASK-007': 'task_security_tier_immutability',
  'BETA-TASK-008': 'task_prompt_enhance_undo_resend',
  'BETA-TASK-009': 'feedback_gitlab_fail_once',
  'BETA-TASK-010': 'workspace_two_root_execution_matrix',
  'BETA-ART-006': 'artifact_confirmation_cancel_failure_matrix',
  'BETA-ART-007': 'artifact_same_name_version_matrix',
  'BETA-ART-008': 'artifact_project_knowledge_roundtrip',
  'BETA-ART-009': 'artifact_preview_navigation_security_matrix',
  'BETA-ART-010': 'artifact_cross_format_recalculation',
  'BETA-ART-011': 'artifact_preview_download_open_matrix',
  'BETA-SKILL-016': 'skill_version_update_reference_matrix',
  'BETA-SKILL-017': 'skill_rollback_delete_history_matrix',
  'BETA-SKILL-018': 'skill_dependency_dag_use_matrix',
  'BETA-SKILL-019': 'skill_dependency_failure_conflict_cycle',
  'BETA-SKILL-020': 'skill_uninstall_cancel_reinstall_matrix',
  'BETA-EXPERT-021': 'expert_delete_archive_projection_matrix',
  'BETA-EXPERT-022': 'expert_draft_restart_publish_matrix',
  'BETA-EXPERT-023': 'expert_general_assistant_isolation_matrix',
  'BETA-EXPERT-024': 'expert_project_visibility_matrix',
  'BETA-MCP-010': 'mcp_oauth_cancel_success_replay',
  'BETA-MCP-009': 'mcp_unreachable_retry_recover',
  'BETA-MCP-011': 'mcp_disabled_force_request_isolation',
  'BETA-MCP-012': 'mcp_auto_route_three_task_matrix',
  'BETA-MCP-013': 'mcp_ssrf_protocol_address_matrix',
  'BETA-MCP-014': 'teams_document_permission_second_account',
  'BETA-HOST-001': 'teams_completed_task_reopen_sha',
  'BETA-HOST-002': 'teams_running_task_reopen_unique',
  'BETA-HOST-004': 'signed_runtime_upgrade_activation',
  'BETA-HOST-005': 'runtime_rollback_matrix',
  'BETA-HOST-006': 'teams_version_skew_recovery',
  'BETA-SEC-001': 'secret_exfiltration_encoding_matrix',
  'BETA-SEC-003': 'sensitive_path_authorization_matrix',
  'BETA-SEC-006': 'external_navigation_matrix',
  'BETA-SEC-007': 'artifact_csp_sandbox_network_matrix',
  'BETA-SEC-008': 'credential_redaction_matrix',
  'BETA-PERF-002': 'long_context_30_turn_compaction',
  'BETA-PERF-004': 'model_service_fail_once_ten_turn',
  'BETA-PERF-006': 'managed_runtime_restart',
});

for (const id of CORE_BETA_SCENARIO_IDS) {
  if (scenarioSpecs.some(([registered]) => registered === id)) continue;
  const legacyCaseId = productionExtensionLegacyDrivers[id] || '';
  const fixtureControl = productionExtensionFixtureControls[id]
    || (legacyCaseId ? 'public_product_state' : 'full_product_gate_adapter');
  registerScenario(id, `production_gate_${id.toLowerCase().replaceAll('-', '_')}`, {
    fixture_control: fixtureControl,
    legacy_case_id: legacyCaseId,
  });
}

export const CORE_BETA_SCENARIO_REGISTRY = new Map(scenarioSpecs);

if (CORE_BETA_SCENARIO_REGISTRY.size !== CORE_BETA_SCENARIO_IDS.size
  || [...CORE_BETA_SCENARIO_IDS].some((id) => !CORE_BETA_SCENARIO_REGISTRY.has(id))) {
  throw new Error(`Core Beta 场景注册表没有覆盖全部 ${CORE_BETA_SCENARIO_IDS.size} 条 Case。`);
}

export function coreBetaScenarioSpec(testCaseOrId) {
  const id = typeof testCaseOrId === 'string'
    ? testCaseOrId.trim()
    : String(testCaseOrId?.id || '').trim();
  return CORE_BETA_SCENARIO_REGISTRY.get(id) || null;
}

export const CORE_BETA_EVIDENCE_ADAPTERS = new Set([
  'before_screenshot',
  'action_receipt',
  'after_screenshot',
  'public_state_readback',
  'cleanup_readback',
  'prompt',
  'task_id',
  'send_receipt',
  'transcript',
  'reply_delta',
  'reply_completion',
  'connection_view_snapshot',
  'cache_diagnostics',
  'ime_event_trace',
  'attachment_name_size_sha256',
  'composer_attachment_state',
  'attachment_readback',
  'artifact_path_sha256',
  'artifact_content_readback',
  'artifact_preview',
  'content_readback',
  'preview',
  'svg_dom_readback',
  'capability_inventory',
  'capability_selection',
  'capability_execution_event',
  'skill_execution_trace',
  'skill_runtime_readiness',
  'negative_tool_trace',
  'connector_prompt_layers',
  'expert_identity_snapshot',
  'expert_draft_lifecycle',
  'expert_dependency_graph',
  'expert_builder_trace',
  'expert_conflict_trace',
  'expert_runtime_trace',
  'expert_publish_operation',
  'expert_publish_confirmation',
  'expert_authoring_mcp_trace',
  'expert_authoring_security_trace',
  'expert_share_authorization',
  'expert_history_readback',
  'credential_redaction_scan',
  'negative_ui_trace',
  'runtime_home_integrity',
  'runtime_env_redacted',
  'restart_trace',
  'connection_snapshot_diagnostics',
  'log_excerpt',
  'auth_credential_lifecycle',
  'product_action_trace',
  'product_state_diff',
  'audit_log_excerpt',
  'data_integrity_readback',
  'project_state_readback',
  'automation_run_trace',
  'knowledge_route_readback',
  'memory_snapshot_trace',
  'settings_readback',
  'host_lifecycle_trace',
  'security_boundary_trace',
  'performance_metrics',
  'accessibility_scan',
  'external_navigation_trace',
  'rollback_trace',
]);

const REQUIRED_CASE_FIELDS = [
  'id',
  'case_type',
  'contract_version',
  'automation_protocol',
  'evidence_schema_version',
  'pipeline_policy',
  'initialization_policy',
  'cleanup_policy',
  'risk_domain',
  'oracle_type',
  'deterministic',
  'repeat_policy',
  'required_fixture',
  'hard_gate',
  'version_scope',
  'production_signal',
];

const REQUIRED_ACTION_FIELDS = [
  'number',
  'action_id',
  'declared_step',
  'command',
  'operation',
  'target',
  'executor',
  'expected_state',
  'evidence_roles',
  'assertions',
];

const REQUIRED_EVIDENCE_ROLES = new Set([
  'before_screenshot',
  'action_receipt',
  'after_screenshot',
  'public_state_readback',
  'cleanup_readback',
]);

const CONVERSATION_TYPES = new Set([
  'conversation',
  'attachment',
  'artifact',
  'skill_use',
  'expert_use',
  'mcp_use',
  'task_lifecycle',
  'project_lifecycle',
  'project_automation',
  'knowledge_lifecycle',
  'memory_lifecycle',
  'host_integration',
  'security_privacy',
  'performance_capacity',
]);

const CAPABILITY_TYPES = new Set([
  'skill_lifecycle',
  'skill_use',
  'expert_lifecycle',
  'expert_use',
  'mcp_lifecycle',
  'mcp_use',
]);

const PLACEHOLDER_COMMAND = /^beta_[a-z]+_\d+_step_\d+$/i;

export function isCoreBetaCase(testCase) {
  return String(testCase?.contract_version || '').trim() === CORE_BETA_CONTRACT_VERSION
    || /^BETA-/i.test(String(testCase?.id || ''));
}

export function coreBetaExecutorRoute(testCase) {
  return coreBetaScenarioSpec(testCase)?.executor_route || '';
}

export function coreBetaCaseContractSha256(testCase) {
  const scenario = coreBetaScenarioSpec(testCase);
  const contract = {
    id: String(testCase?.id || ''),
    case_type: String(testCase?.case_type || ''),
    contract_version: String(testCase?.contract_version || ''),
    automation_protocol: String(testCase?.automation_protocol || ''),
    evidence_schema_version: String(testCase?.evidence_schema_version || ''),
    pipeline_policy: String(testCase?.pipeline_policy || ''),
    batch_size: Number(testCase?.batch_size || 1),
    initialization_policy: String(testCase?.initialization_policy || ''),
    cleanup_policy: String(testCase?.cleanup_policy || ''),
    required_fixture: parseFixtureSpec(testCase?.required_fixture),
    action_plan: Array.isArray(testCase?.action_plan) ? testCase.action_plan : [],
    conversation_turns: Array.isArray(testCase?.conversation_turns) ? testCase.conversation_turns : [],
    precise_assertions: testCase?.precise_assertions || null,
    evidence_roles: Array.isArray(testCase?.evidence_roles) ? testCase.evidence_roles : [],
    executor_route: scenario?.executor_route || '',
    scenario_driver: scenario?.driver || '',
    fixture_control: scenario?.fixture_control || '',
  };
  return createHash('sha256').update(JSON.stringify(contract)).digest('hex');
}

export function validateCoreBetaCase(testCase, { fixtureRoot = '' } = {}) {
  const id = String(testCase?.id || 'unknown').trim();
  const errors = [];
  const warnings = [];
  for (const field of REQUIRED_CASE_FIELDS) {
    if (!String(testCase?.[field] ?? '').trim()) errors.push(`${id} 缺少 ${field}`);
  }
  if (!CORE_BETA_CASE_TYPES.has(String(testCase?.case_type || ''))) {
    errors.push(`${id} 不支持的 case_type=${testCase?.case_type || '空'}`);
  }
  if (!CORE_BETA_SCENARIO_IDS.has(id)) {
    errors.push(`${id} 没有注册独立场景执行器`);
  }
  const scenarioSpec = coreBetaScenarioSpec(id);
  if (!scenarioSpec?.driver) {
    errors.push(`${id} 场景注册表缺少 driver`);
  }
  if (String(testCase?.contract_version || '') !== CORE_BETA_CONTRACT_VERSION) {
    errors.push(`${id} contract_version 必须为 ${CORE_BETA_CONTRACT_VERSION}`);
  }
  if (String(testCase?.automation_protocol || '') !== CORE_BETA_AUTOMATION_PROTOCOL) {
    errors.push(`${id} automation_protocol 必须为 ${CORE_BETA_AUTOMATION_PROTOCOL}`);
  }
  if (String(testCase?.evidence_schema_version || '') !== CORE_BETA_EVIDENCE_SCHEMA) {
    errors.push(`${id} evidence_schema_version 必须为 ${CORE_BETA_EVIDENCE_SCHEMA}`);
  }
  if (!CORE_BETA_PIPELINE_POLICIES.has(String(testCase?.pipeline_policy || ''))) {
    errors.push(`${id} 不支持的 pipeline_policy=${testCase?.pipeline_policy || '空'}`);
  }
  const batchSize = Number(testCase?.batch_size || 1);
  if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > CORE_BETA_MAX_BATCH_SIZE) {
    errors.push(`${id} batch_size 必须是 1-${CORE_BETA_MAX_BATCH_SIZE} 的整数`);
  }
  if (String(testCase?.pipeline_policy || '') === 'serial' && batchSize !== 1) {
    errors.push(`${id} serial Case 的 batch_size 必须为 1`);
  }
  if (String(testCase?.pipeline_policy || '') !== 'serial'
    && !CONVERSATION_TYPES.has(String(testCase?.case_type || ''))) {
    errors.push(`${id} ${testCase?.case_type || 'unknown'} 不允许 dispatch/collect`);
  }

  const actions = testCase?.action_plan;
  if (!Array.isArray(actions) || actions.length === 0) {
    errors.push(`${id} action_plan 必须是非空数组`);
  } else {
    const actionIds = new Set();
    actions.forEach((action, index) => {
      for (const field of REQUIRED_ACTION_FIELDS) {
        const value = action?.[field];
        if (value == null || value === '' || (Array.isArray(value) && value.length === 0)) {
          errors.push(`${id} action[${index + 1}] 缺少 ${field}`);
        }
      }
      if (Number(action?.number) !== index + 1) errors.push(`${id} action[${index + 1}] number 不连续`);
      if (actionIds.has(action?.action_id)) errors.push(`${id} action_id 重复：${action?.action_id}`);
      actionIds.add(action?.action_id);
      if (PLACEHOLDER_COMMAND.test(String(action?.command || ''))) {
        errors.push(`${id} action[${index + 1}] 仍是占位命令：${action.command}`);
      }
      if (!['prepare', 'execute', 'verify'].includes(String(action?.operation || ''))) {
        errors.push(`${id} action[${index + 1}] operation 必须是 prepare/execute/verify`);
      }
      if (String(action?.target || '') !== `${id}:${action?.operation || ''}`) {
        errors.push(`${id} action[${index + 1}] target 必须绑定 Case ID 与 operation`);
      }
      if (String(action?.executor || '') !== coreBetaExecutorRoute(testCase)) {
        errors.push(`${id} action[${index + 1}] executor 未绑定该 Case 的独立场景执行器`);
      }
      const roles = Array.isArray(action?.evidence_roles) ? action.evidence_roles : [];
      for (const role of ['before_screenshot', 'action_receipt', 'after_screenshot']) {
        if (!roles.includes(role)) errors.push(`${id} action[${index + 1}] 缺少证据角色 ${role}`);
      }
      if (!Array.isArray(action?.assertions) || !action.assertions.length) {
        errors.push(`${id} action[${index + 1}] 缺少可机判 assertions`);
      } else if (action.assertions.some((item) => !item?.path || !item?.operator)) {
        errors.push(`${id} action[${index + 1}] assertion 必须包含 path/operator`);
      }
    });
  }

  const precise = testCase?.precise_assertions;
  if (!precise || typeof precise !== 'object' || Array.isArray(precise)) {
    errors.push(`${id} precise_assertions 必须是对象`);
  } else {
    if (!Array.isArray(precise.hard_oracles) || !precise.hard_oracles.length) {
      errors.push(`${id} precise_assertions.hard_oracles 不能为空`);
    }
    if (!Array.isArray(precise.machine_assertions) || !precise.machine_assertions.length) {
      errors.push(`${id} precise_assertions.machine_assertions 不能为空`);
    }
    if (!String(precise.pass_rule || '').trim()
      || !String(precise.fail_rule || '').trim()
      || !String(precise.block_rule || '').trim()) {
      errors.push(`${id} precise_assertions 必须含 pass/fail/block 规则`);
    }
  }

  const evidenceRoles = new Set(Array.isArray(testCase?.evidence_roles) ? testCase.evidence_roles : []);
  for (const role of evidenceRoles) {
    if (!CORE_BETA_EVIDENCE_ADAPTERS.has(role)) errors.push(`${id} 证据角色没有框架适配器：${role}`);
  }
  for (const role of REQUIRED_EVIDENCE_ROLES) {
    if (!evidenceRoles.has(role)) errors.push(`${id} evidence_roles 缺少 ${role}`);
  }
  const isPreSendAttachmentRejection = scenarioSpec?.driver === 'attachment_pre_send_rejection_matrix';
  const requiresConversation = (!isPreSendAttachmentRejection
      && CONVERSATION_TYPES.has(String(testCase?.case_type || '')))
    || evidenceRoles.has('prompt')
    || evidenceRoles.has('transcript')
    || (Array.isArray(testCase?.conversation_turns) && testCase.conversation_turns.length > 0);
  if (requiresConversation) {
    for (const role of ['task_id', 'prompt', 'send_receipt', 'transcript', 'reply_delta', 'reply_completion']) {
      if (!evidenceRoles.has(role)) errors.push(`${id} 会话执行缺少证据角色 ${role}`);
    }
    if (!Array.isArray(testCase?.conversation_turns) || !testCase.conversation_turns.length) {
      errors.push(`${id} 会话执行必须声明 conversation_turns`);
    } else {
      for (const [turnIndex, turn] of testCase.conversation_turns.entries()) {
        if (!String(turn?.prompt || '').trim()) errors.push(`${id} conversation_turns[${turnIndex + 1}] 缺少 prompt`);
        if (!String(turn?.oracle || '').trim()) errors.push(`${id} conversation_turns[${turnIndex + 1}] 缺少 oracle`);
        const templates = `${turn?.prompt || ''}\n${turn?.oracle || ''}`.match(/\{\{[^}]+\}\}/g) || [];
        for (const template of templates) {
          if (!/^\{\{deep_use\[[0-4]\]\.readme_derived_(?:primary|followup)_(?:task|oracle)\}\}$/.test(template)) {
            errors.push(`${id} conversation_turns[${turnIndex + 1}] 含未注册运行时模板：${template}`);
          }
          if (!/^BETA-SKILL-0(?:06|07|08|09|10)$/.test(id)) {
            errors.push(`${id} 仅 Skill 深度使用 Case 可声明 deep_use 运行时模板`);
          }
        }
      }
    }
  }
  if (CAPABILITY_TYPES.has(String(testCase?.case_type || ''))) {
    for (const role of ['capability_selection', 'capability_execution_event']) {
      if (!evidenceRoles.has(role)) errors.push(`${id} 能力 Case 缺少证据角色 ${role}`);
    }
  }

  const fixtureSpec = parseFixtureSpec(testCase?.required_fixture);
  if (!fixtureSpec.length) errors.push(`${id} required_fixture 必须声明至少一项 fixture`);
  if (fixtureRoot) {
    for (const fixture of fixtureSpec.filter((item) => item.startsWith('file:'))) {
      const file = path.resolve(fixtureRoot, fixture.slice(5));
      const runtimeGenerated = Boolean(
        scenarioSpec?.runtime_fixture
        && fixture.slice(5) === scenarioSpec.runtime_fixture,
      );
      if (!fs.existsSync(file) && !runtimeGenerated) warnings.push(`${id} 运行前需要生成 fixture：${file}`);
    }
  }

  return {
    id,
    ok: errors.length === 0,
    executor_route: coreBetaExecutorRoute(testCase),
    scenario_driver: scenarioSpec?.driver || '',
    fixture_control_adapter: scenarioSpec?.fixture_control || '',
    action_count: Array.isArray(actions) ? actions.length : 0,
    evidence_role_count: evidenceRoles.size,
    fixture_spec: fixtureSpec,
    errors,
    warnings,
  };
}

export function validateCoreBetaCasePlan(cases, options = {}) {
  const results = (cases || []).map((testCase) => validateCoreBetaCase(testCase, options));
  const ids = (cases || []).map((item) => String(item?.id || '').trim());
  const errors = results.flatMap((item) => item.errors);
  if (new Set(ids).size !== ids.length) errors.push('Core Beta Case ID 重复。');
  const requiresFullInitialization = (cases || []).some(
    (item) => String(item?.initialization_policy || '') === 'run_full_reset_then_case_clean',
  );
  if (cases.length > 1 && requiresFullInitialization && options.allowPartialInitialization !== true) {
    const requiredPrefix = [
      'BETA-INIT-001',
      'BETA-INIT-002',
      'BETA-INIT-003',
      'BETA-INIT-004',
      'BETA-INIT-005',
    ];
    const actualPrefix = ids.slice(0, requiredPrefix.length);
    if (JSON.stringify(actualPrefix) !== JSON.stringify(requiredPrefix)) {
      errors.push(
        `Core Beta 全量批次必须以前五个初始化硬门禁开场且顺序固定：`
        + `${requiredPrefix.join(',')}；actual=${actualPrefix.join(',') || 'empty'}`,
      );
    }
    const lateInitialization = ids.slice(requiredPrefix.length).filter((id) => id.startsWith('BETA-INIT-'));
    if (lateInitialization.length) {
      errors.push(`初始化 Case 不得在业务 Case 之后执行：${lateInitialization.join(',')}`);
    }
  }
  return {
    schema_version: 2,
    contract_version: CORE_BETA_CONTRACT_VERSION,
    automation_protocol: CORE_BETA_AUTOMATION_PROTOCOL,
    evidence_schema_version: CORE_BETA_EVIDENCE_SCHEMA,
    generated_at: new Date().toISOString(),
    case_count: ids.length,
    executable_count: results.filter((item) => item.ok).length,
    ok: errors.length === 0 && results.length > 0,
    errors,
    warnings: results.flatMap((item) => item.warnings),
    cases: results,
  };
}

export function validateCoreBetaScopedSelection({
  fullCases = [],
  selectedCases = [],
  excludedCaseIds = [],
  reason = '',
} = {}) {
  const fullIds = fullCases.map((item) => String(item?.id || '').trim()).filter(Boolean);
  const selectedIds = selectedCases.map((item) => String(item?.id || '').trim()).filter(Boolean);
  const excludedIds = excludedCaseIds.map((item) => String(item || '').trim()).filter(Boolean);
  const errors = [];
  if (!String(reason || '').trim()) errors.push('scoped execution 必须声明非空 scope reason。');
  if (!fullIds.length) errors.push('scoped execution 无法读取完整 Case 集。');
  if (!selectedIds.length) errors.push('scoped execution 的选择 Case 集为空。');
  if (!excludedIds.length) errors.push('scoped execution 必须显式声明 excluded Case。');
  if (new Set(excludedIds).size !== excludedIds.length) errors.push('scoped execution excluded Case ID 重复。');
  const fullIdSet = new Set(fullIds);
  const unknownExcluded = excludedIds.filter((id) => !fullIdSet.has(id));
  if (unknownExcluded.length) errors.push(`scoped execution excluded Case 不属于完整 Casebook：${unknownExcluded.join(',')}`);
  const excludedSet = new Set(excludedIds);
  const expectedSelectedIds = fullIds.filter((id) => !excludedSet.has(id));
  if (JSON.stringify(selectedIds) !== JSON.stringify(expectedSelectedIds)) {
    errors.push(
      'scoped execution 选择集必须严格等于完整 Case 集减去 excluded Case，且保持原顺序；'
      + `expected=${expectedSelectedIds.join(',')}; actual=${selectedIds.join(',')}`,
    );
  }
  const requiredPartialInitPrefix = [
    'BETA-INIT-001',
    'BETA-INIT-002',
    'BETA-INIT-003',
    'BETA-INIT-004',
  ];
  if (JSON.stringify(selectedIds.slice(0, requiredPartialInitPrefix.length))
    !== JSON.stringify(requiredPartialInitPrefix)) {
    errors.push(`scoped execution 仍必须以前四个本地初始化 Case 开场：${requiredPartialInitPrefix.join(',')}`);
  }
  if (!selectedIds.includes('BETA-INIT-005') && !excludedSet.has('BETA-INIT-005')) {
    errors.push('缺少 BETA-INIT-005 时必须把它显式记录为 excluded Case。');
  }
  const nonFixtureExclusions = excludedIds.filter((id) => {
    const scenario = CORE_BETA_SCENARIO_REGISTRY.get(id);
    return !scenario || scenario.fixture_control === 'public_product_state';
  });
  if (nonFixtureExclusions.length) {
    errors.push(`scoped execution 只允许排除需要专项 fixture 的 Case：${nonFixtureExclusions.join(',')}`);
  }
  return {
    schema_version: 'qbot-core-beta-scoped-execution/v1',
    generated_at: new Date().toISOString(),
    ok: errors.length === 0,
    mode: 'scoped',
    reason: String(reason || '').trim(),
    release_gate_eligible: false,
    full_count: fullIds.length,
    selected_count: selectedIds.length,
    excluded_count: excludedIds.length,
    full_case_ids: fullIds,
    selected_case_ids: selectedIds,
    excluded_case_ids: excludedIds,
    errors,
  };
}

export function classifyCoreBetaScopedFixtureExclusions({
  unavailableCaseIds = [],
  excludedCaseIds = [],
} = {}) {
  const unavailableIds = unavailableCaseIds.map((item) => String(item || '').trim()).filter(Boolean);
  const excludedIds = excludedCaseIds.map((item) => String(item || '').trim()).filter(Boolean);
  const unavailableSet = new Set(unavailableIds);
  const excludedSet = new Set(excludedIds);
  const missingRequiredIds = unavailableIds.filter((id) => !excludedSet.has(id));
  const additionalFixtureExclusionIds = excludedIds.filter((id) => !unavailableSet.has(id));
  return {
    ok: missingRequiredIds.length === 0,
    unavailable_fixture_case_ids: unavailableIds,
    missing_unavailable_fixture_case_ids: missingRequiredIds,
    additional_fixture_exclusion_ids: additionalFixtureExclusionIds,
  };
}

export function parseFixtureSpec(value) {
  const raw = String(value || '').trim();
  if (!raw) return [];
  if (raw.startsWith('[')) {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.map(String).map((item) => item.trim()).filter(Boolean) : [];
    } catch {
      return [];
    }
  }
  return raw.split(/[,，;；|、\n]+/).map((item) => item.trim()).filter(Boolean);
}

export function sha256File(file) {
  return createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

export function buildCoreEvidenceManifest({ testCase, caseDir, artifacts = {}, screenshots = {}, actions = [] }) {
  const declared = Array.isArray(testCase?.evidence_roles) ? testCase.evidence_roles : [];
  const candidates = new Map();
  const add = (role, file) => {
    if (typeof file !== 'string' || !file || !fs.existsSync(file)) return;
    const validation = validateEvidenceFile(role, file);
    candidates.set(role, {
      role,
      path: path.resolve(file),
      bytes: fs.statSync(file).size,
      sha256: sha256File(file),
      valid: validation.valid,
      validation_error: validation.error || '',
    });
  };
  Object.entries(screenshots || {}).forEach(([key, file]) => {
    const role = key.includes('before') ? 'before_screenshot'
      : key.includes('after') || key === 'final' ? 'after_screenshot'
        : key;
    add(role, file);
  });
  Object.entries(artifacts || {}).forEach(([role, file]) => add(role, file));
  if (actions.length) {
    const actionReceipt = path.join(caseDir, 'action-receipts.json');
    if (fs.existsSync(actionReceipt)) add('action_receipt', actionReceipt);
  }
  const evidence = declared.map((role) => {
    const item = candidates.get(role);
    if (!item) return { role, missing: true, valid: false, validation_error: 'file_missing' };
    if (!item.valid) return { ...item, missing: false };
    return { ...item, missing: false };
  });
  const missingRoles = evidence.filter((item) => item.missing).map((item) => item.role);
  const invalidRoles = evidence.filter((item) => !item.missing && !item.valid).map((item) => item.role);
  return {
    schema_version: CORE_BETA_EVIDENCE_SCHEMA,
    case_id: testCase?.id || '',
    generated_at: new Date().toISOString(),
    complete: missingRoles.length === 0 && invalidRoles.length === 0,
    missing_roles: missingRoles,
    invalid_roles: invalidRoles,
    evidence,
  };
}

export function validateEvidenceFile(role, file) {
  const stats = fs.statSync(file);
  if (!stats.isFile()) return { valid: false, error: 'not_a_file' };
  if (stats.size <= 0) return { valid: false, error: 'empty_file' };
  if (/screenshot$/i.test(role) || /\.(?:png|jpe?g|webp)$/i.test(file)) {
    return stats.size >= 128
      ? { valid: true }
      : { valid: false, error: 'screenshot_too_small' };
  }
  const ext = path.extname(file).toLowerCase();
  if (ext === '.json') {
    let parsed;
    try {
      parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch {
      return { valid: false, error: 'invalid_json' };
    }
    if (parsed && typeof parsed === 'object' && parsed.valid === false) {
      return { valid: false, error: String(parsed.reason || parsed.validation_error || 'explicitly_invalid') };
    }
    if (role === 'task_id' && !String(parsed?.task_id || '').trim()) {
      return { valid: false, error: 'task_id_missing' };
    }
    if (role === 'reply_completion' && parsed?.complete !== true) {
      return { valid: false, error: 'reply_incomplete' };
    }
    if (role === 'action_receipt') {
      if (!Array.isArray(parsed) || !parsed.length) return { valid: false, error: 'action_receipts_missing' };
      if (parsed.some((item) => item?.status !== 'passed'
        || !String(item?.before_screenshot || '').trim()
        || !String(item?.after_screenshot || '').trim())) {
        return { valid: false, error: 'action_receipt_not_passed_or_missing_screenshot' };
      }
    }
  } else if (['prompt', 'transcript', 'reply_delta'].includes(role)) {
    if (!fs.readFileSync(file, 'utf8').trim()) return { valid: false, error: 'text_evidence_empty' };
  }
  return { valid: true };
}

export function evaluateMachineAssertions(assertions, snapshot) {
  const read = (object, dottedPath) => String(dottedPath || '').split('.')
    .filter(Boolean)
    .reduce((value, key) => value == null ? undefined : value[key], object);
  return (assertions || []).map((assertion) => {
    const actual = read(snapshot, assertion.path);
    let ok = false;
    switch (assertion.operator) {
      case 'exists': ok = actual !== undefined && actual !== null && actual !== ''; break;
      case 'equals': ok = actual === assertion.expected; break;
      case 'not_equals': ok = actual !== assertion.expected; break;
      case 'gte': ok = Number(actual) >= Number(assertion.expected); break;
      case 'lte': ok = Number(actual) <= Number(assertion.expected); break;
      case 'includes': ok = Array.isArray(actual)
        ? actual.includes(assertion.expected)
        : String(actual || '').includes(String(assertion.expected || '')); break;
      case 'matches': ok = new RegExp(assertion.expected, assertion.flags || '').test(String(actual || '')); break;
      case 'sha256': ok = /^[a-f0-9]{64}$/i.test(String(actual || '')); break;
      default: ok = false;
    }
    return { ...assertion, actual, ok };
  });
}
