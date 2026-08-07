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
  'model_routing',
  'capability_activation',
  'release_deployment',
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
  model_routing: 'core-beta/model-routing-v2',
  capability_activation: 'core-beta/capability-activation-v2',
  release_deployment: 'core-beta/release-deployment-v2',
});

const CORE_BETA_CASE_RANGES = Object.freeze({
  INIT: 5,
  CHAT: 10,
  FILE: 10,
  ART: 11,
  SKILL: 20,
  EXPERT: 24,
  MCP: 16,
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
  ROUTE: 6,
  CAP: 4,
  STATE: 4,
  DEPLOY: 8,
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
  ['BETA-MCP-015', 'mcp_owned_stdio_node_teams_host', { fixture_control: 'mcp_owned_stdio_node_matrix' }],
  ['BETA-MCP-016', 'mcp_current_session_model_id_loopback', { fixture_control: 'mcp_model_id_loopback_matrix' }],
  ['BETA-REC-001', 'teams_embedded_reopen_running', { fixture_control: 'managed_teams_restart' }],
  ['BETA-REC-002', 'runtime_crash_recovery', { fixture_control: 'managed_runtime_restart' }],
  ['BETA-REC-003', 'codex_proxy_no_proxy_matrix', { fixture_control: 'codex_proxy_matrix' }],
  ['BETA-REC-004', 'claude_runtime_home_isolation', { fixture_control: 'managed_runtime_restart' }],
  ['BETA-AUTH-001', 'auth_refresh_expiry_recovery', { fixture_control: 'auth_refresh_fault' }],
  ['BETA-TASK-004', 'task_hitl_answer_skip_timeout', { fixture_control: 'hitl_answer_skip_timeout' }],
  ['BETA-SEC-005', 'security_ssrf_advanced_matrix', { fixture_control: 'ssrf_advanced_matrix' }],
  ['BETA-ROUTE-001', 'auto_policy_composer_single_select', { fixture_control: 'auto_route_ui_matrix' }],
  ['BETA-ROUTE-002', 'auto_company_aware_m1_m4_routing', { fixture_control: 'auto_route_classification_matrix' }],
  ['BETA-ROUTE-003', 'auto_conservative_fallback_and_exhaustion', { fixture_control: 'auto_route_failure_matrix' }],
  ['BETA-ROUTE-004', 'auto_session_pin_reload_and_manual_isolation', { fixture_control: 'auto_route_session_lifecycle' }],
  ['BETA-ROUTE-005', 'auto_cas_conflict_bounded_recovery', { fixture_control: 'auto_route_cas_matrix' }],
  ['BETA-ROUTE-006', 'auto_host_private_router_security', { fixture_control: 'auto_route_private_router_matrix' }],
  ['BETA-CAP-001', 'capability_skill_mcp_mode_cross_product', { fixture_control: 'capability_activation_mode_matrix' }],
  ['BETA-CAP-002', 'capability_expert_dependency_overlay', { fixture_control: 'capability_activation_expert_overlay' }],
  ['BETA-CAP-003', 'capability_required_optional_failure_semantics', { fixture_control: 'capability_activation_failure_matrix' }],
  ['BETA-CAP-004', 'capability_snapshot_recompile_and_stale_fencing', { fixture_control: 'capability_activation_snapshot_matrix' }],
  ['BETA-STATE-001', 'sqlite_structured_last_good_restart_recovery', { fixture_control: 'sqlite_last_good_restart_matrix' }],
  ['BETA-STATE-002', 'sqlite_schema_upgrade_order_and_failure_recovery', { fixture_control: 'sqlite_schema_upgrade_matrix' }],
  ['BETA-STATE-003', 'pending_ask_hydrate_refresh_and_settlement', { fixture_control: 'pending_ask_recovery_matrix' }],
  ['BETA-STATE-004', 'terminal_receiver_release_and_immediate_followup', { fixture_control: 'terminal_admission_matrix' }],
  ['BETA-DEPLOY-001', 'release_policy_activation_observation', { fixture_control: 'protected_release_deployment' }],
  ['BETA-DEPLOY-002', 'protected_migration_authority_and_evidence', { fixture_control: 'protected_release_deployment' }],
  ['BETA-DEPLOY-003', 'legacy_helm_workload_adoption', { fixture_control: 'protected_release_deployment' }],
  ['BETA-DEPLOY-004', 'helm_adoption_resumable_retry', { fixture_control: 'protected_release_deployment' }],
  ['BETA-DEPLOY-005', 'failed_brownfield_helm_recovery', { fixture_control: 'protected_release_deployment' }],
  ['BETA-DEPLOY-006', 'ingress_service_port_baseline_preservation', { fixture_control: 'protected_release_deployment' }],
  ['BETA-DEPLOY-007', 'bounded_redacted_deployment_diagnostics', { fixture_control: 'protected_release_deployment' }],
  ['BETA-DEPLOY-008', 'retire_remote_qbot_ui_service', { fixture_control: 'protected_release_deployment' }],
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

export const CORE_BETA_CASE_DEPENDENCIES = new Map([
  ['BETA-EXPERT-007', ['BETA-EXPERT-002', 'BETA-EXPERT-003', 'BETA-EXPERT-004', 'BETA-EXPERT-006']],
  ['BETA-EXPERT-008', ['BETA-EXPERT-002', 'BETA-EXPERT-007']],
  ['BETA-EXPERT-009', ['BETA-EXPERT-003', 'BETA-EXPERT-007']],
  ['BETA-EXPERT-010', ['BETA-EXPERT-004', 'BETA-EXPERT-007']],
  ['BETA-EXPERT-011', ['BETA-EXPERT-007']],
  ['BETA-EXPERT-012', ['BETA-EXPERT-007']],
  ['BETA-EXPERT-013', ['BETA-EXPERT-012']],
  ['BETA-EXPERT-014', ['BETA-EXPERT-012']],
  ['BETA-EXPERT-015', ['BETA-EXPERT-007']],
  ['BETA-EXPERT-016', ['BETA-EXPERT-007']],
]);

export const CORE_BETA_RUN_OWNED_EXPERT_REQUIREMENTS = new Map([
  ['BETA-EXPERT-008', {
    ledger_key: 'published_research',
    source_case_ids: ['BETA-EXPERT-002', 'BETA-EXPERT-007'],
  }],
  ['BETA-EXPERT-009', {
    ledger_key: 'published_data',
    source_case_ids: ['BETA-EXPERT-003', 'BETA-EXPERT-007'],
  }],
  ['BETA-EXPERT-010', {
    ledger_key: 'published_delivery',
    source_case_ids: ['BETA-EXPERT-004', 'BETA-EXPERT-007'],
  }],
  ['BETA-EXPERT-012', {
    ledger_key: 'published_delivery',
    source_case_ids: ['BETA-EXPERT-004', 'BETA-EXPERT-007'],
  }],
  ['BETA-EXPERT-011', {
    ledger_key: 'published_delivery',
    source_case_ids: ['BETA-EXPERT-004', 'BETA-EXPERT-007'],
  }],
  ['BETA-EXPERT-013', {
    ledger_key: 'published_versioned',
    source_case_ids: ['BETA-EXPERT-012'],
  }],
  ['BETA-EXPERT-014', {
    ledger_key: 'published_versioned',
    source_case_ids: ['BETA-EXPERT-012'],
  }],
  ['BETA-EXPERT-015', {
    ledger_key: 'published_versioned',
    source_case_ids: ['BETA-EXPERT-012'],
  }],
  ['BETA-EXPERT-016', {
    ledger_key: 'published_versioned',
    source_case_ids: ['BETA-EXPERT-012'],
  }],
]);

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
  'model_route_trace',
  'activation_snapshot',
  'sqlite_state_readback',
  'ask_lifecycle_trace',
  'dashboard_policy_readback',
  'deployment_receipt',
  'migration_receipt',
  'helm_lifecycle_trace',
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
  'model_routing',
  'capability_activation',
]);

const CAPABILITY_TYPES = new Set([
  'skill_lifecycle',
  'skill_use',
  'expert_lifecycle',
  'expert_use',
  'mcp_lifecycle',
  'mcp_use',
  'capability_activation',
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
  if (id === 'BETA-EXPERT-008') {
    const turns = Array.isArray(testCase?.conversation_turns) ? testCase.conversation_turns : [];
    const firstPrompt = String(turns[0]?.prompt || '').trim();
    const researchInput = `${String(testCase?.test_data || '')}\n${firstPrompt}`;
    if (/目标问题|给定问题|某个问题|某项问题/.test(researchInput)) {
      errors.push('BETA-EXPERT-008 研究主题不得保留“目标问题”等占位输入。');
    }
    if (firstPrompt.length < 40 || !/官方来源/.test(firstPrompt)) {
      errors.push('BETA-EXPERT-008 首轮必须声明可直接执行的具体主题和至少两个官方来源。');
    }
    if (!/20\d{2}-\d{2}-\d{2}/.test(researchInput)) {
      errors.push('BETA-EXPERT-008 必须冻结明确的 as-of 日期，禁止把主题选择留给运行时澄清。');
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

export function classifyCoreBetaScopedDependencyGaps({
  selectedCaseIds = [],
  excludedCaseIds = [],
} = {}) {
  const selectedIds = selectedCaseIds.map((item) => String(item || '').trim()).filter(Boolean);
  const excludedSet = new Set(
    excludedCaseIds.map((item) => String(item || '').trim()).filter(Boolean),
  );
  const resolveExcludedDependencies = (caseId, visiting = new Set()) => {
    if (visiting.has(caseId)) return [];
    const nextVisiting = new Set(visiting).add(caseId);
    const missing = new Set();
    for (const dependencyId of CORE_BETA_CASE_DEPENDENCIES.get(caseId) || []) {
      if (excludedSet.has(dependencyId)) {
        missing.add(dependencyId);
        continue;
      }
      for (const nested of resolveExcludedDependencies(dependencyId, nextVisiting)) missing.add(nested);
    }
    return [...missing];
  };
  const gaps = selectedIds.map((caseId) => ({
    case_id: caseId,
    excluded_upstream_case_ids: resolveExcludedDependencies(caseId),
  })).filter((item) => item.excluded_upstream_case_ids.length > 0);
  return {
    ok: gaps.length === 0,
    affected_case_ids: gaps.map((item) => item.case_id),
    gaps,
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
  const dependencyGaps = classifyCoreBetaScopedDependencyGaps({
    selectedCaseIds: selectedIds,
    excludedCaseIds: excludedIds,
  });
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
    dependency_gaps: dependencyGaps.gaps,
    dependency_blocked_case_ids: dependencyGaps.affected_case_ids,
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
  const notApplicable = new Map();
  const skillPrerequisiteNotApplicableRoles = new Set([
    'prompt',
    'task_id',
    'send_receipt',
    'transcript',
    'reply_delta',
    'reply_completion',
  ]);
  const runtimePrerequisiteNotApplicableRoles = new Set([
    'expert_draft_lifecycle',
    'expert_builder_trace',
    'capability_selection',
    'capability_execution_event',
    ...skillPrerequisiteNotApplicableRoles,
  ]);
  const expertPrerequisiteNotApplicableRoles = new Set([
    'task_id',
    'prompt',
    'send_receipt',
    'transcript',
    'reply_delta',
    'reply_completion',
    'expert_runtime_trace',
    'capability_selection',
    'capability_execution_event',
    'attachment_name_size_sha256',
    'attachment_readback',
    'artifact_path_sha256',
    'content_readback',
    'preview',
    'credential_redaction_scan',
    'expert_history_readback',
    'negative_ui_trace',
  ]);
  const mcpPrerequisiteNotApplicableRoles = new Set([
    ...skillPrerequisiteNotApplicableRoles,
    'capability_selection',
    'capability_execution_event',
    'connection_snapshot_diagnostics',
    'log_excerpt',
  ]);
  const preSendCapabilityFailureNotApplicableRoles = new Set([
    'capability_execution_event',
    ...skillPrerequisiteNotApplicableRoles,
  ]);
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
  for (const item of Array.isArray(artifacts?.core_beta_not_applicable_roles)
    ? artifacts.core_beta_not_applicable_roles
    : []) {
    const role = String(item?.role || '');
    const blockerFile = String(item?.blocker_path || '');
    if (!declared.includes(role)
      || (!skillPrerequisiteNotApplicableRoles.has(role)
        && !runtimePrerequisiteNotApplicableRoles.has(role)
        && !expertPrerequisiteNotApplicableRoles.has(role)
        && !mcpPrerequisiteNotApplicableRoles.has(role)
        && !preSendCapabilityFailureNotApplicableRoles.has(role))
      || !blockerFile
      || !fs.existsSync(blockerFile)
      || !fs.statSync(blockerFile).isFile()
      || fs.statSync(blockerFile).size <= 0) continue;
    const resolvedCaseDir = path.resolve(caseDir);
    const resolvedBlocker = path.resolve(blockerFile);
    const relative = path.relative(resolvedCaseDir, resolvedBlocker);
    if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) continue;
    let blocker;
    try {
      blocker = JSON.parse(fs.readFileSync(resolvedBlocker, 'utf8'));
    } catch {
      continue;
    }
    const allowedRoles = Array.isArray(blocker?.not_applicable_roles)
      ? blocker.not_applicable_roles.map(String)
      : [];
    const expectedCount = Number(blocker?.expected_count);
    const attemptedCount = Number(blocker?.attempted_count);
    const successfulCount = Number(blocker?.successful_count);
    const failedCount = Number(blocker?.failed_count);
    const failedIdentities = Array.isArray(blocker?.failed_identities)
      ? blocker.failed_identities.map(String).filter(Boolean)
      : [];
    const sourceCaseIds = Array.isArray(blocker?.source_case_ids)
      ? blocker.source_case_ids.map(String)
      : [];
    const skillPrerequisiteVerified = blocker?.schema_version === 'qbot-core-beta-upstream-prerequisite/v1'
      && blocker?.valid === true
      && blocker?.applicable === true
      && blocker?.kind === 'skill_install_terminal_shortage'
      && blocker?.source === 'exact_run_owned_install_attempt_ledger'
      && blocker?.dependent_case_id === testCase?.id
      && expectedCount === 10
      && attemptedCount === expectedCount
      && successfulCount >= 0
      && successfulCount < expectedCount
      && failedCount === expectedCount - successfulCount
      && failedIdentities.length === failedCount
      && sourceCaseIds.length === 2
      && sourceCaseIds[0] === 'BETA-SKILL-003'
      && sourceCaseIds[1] === 'BETA-SKILL-004'
      && /^[a-f0-9]{64}$/i.test(String(blocker?.receipts_sha256 || ''))
      && String(blocker?.target_identity || '').trim()
      && failedIdentities.includes(String(blocker.target_identity))
      && allowedRoles.includes(role)
      && allowedRoles.every((itemRole) => skillPrerequisiteNotApplicableRoles.has(itemRole))
      && String(blocker?.reason || '').trim();
    const promptSourceFields = Array.isArray(blocker?.prompt_source?.checked_fields)
      ? blocker.prompt_source.checked_fields.map(String)
      : [];
    const skillPromptSourcePrerequisiteVerified = blocker?.schema_version === 'qbot-core-beta-upstream-prerequisite/v1'
      && blocker?.valid === true
      && blocker?.applicable === true
      && blocker?.outcome === 'blocked'
      && blocker?.kind === 'skill_prompt_source_unavailable'
      && blocker?.source === 'frozen_skill_sample_ledger'
      && blocker?.source_case_id === 'BETA-SKILL-002'
      && JSON.stringify(sourceCaseIds) === JSON.stringify(['BETA-SKILL-002'])
      && blocker?.dependent_case_id === testCase?.id
      && String(blocker?.target_identity || '').trim()
      && blocker?.prompt_source?.schema_version === 'qbot-core-beta-skill-prompt-source/v1'
      && blocker?.prompt_source?.valid === false
      && blocker?.prompt_source?.integrity_valid === true
      && blocker?.prompt_source?.kind === 'missing'
      && Number(blocker?.prompt_source?.bytes) === 0
      && blocker?.prompt_source?.sha256 === ''
      && promptSourceFields.includes('skill_detail_markdown')
      && promptSourceFields.includes('catalog_market_description')
      && String(blocker?.prompt_source?.reason || '').trim()
      && /^[a-f0-9]{64}$/i.test(String(blocker?.sample_sha256 || ''))
      && allowedRoles.includes(role)
      && allowedRoles.every((itemRole) => skillPrerequisiteNotApplicableRoles.has(itemRole))
      && String(blocker?.reason || '').trim();
    const runtimePrerequisiteVerified = blocker?.schema_version === 'qbot-core-beta-runtime-prerequisite/v1'
      && blocker?.valid === true
      && blocker?.applicable === true
      && blocker?.kind === 'runtime_family_connection_unavailable'
      && blocker?.source === 'public_connection_view_and_typed_runtime_switch_error'
      && blocker?.dependent_case_id === testCase?.id
      && blocker?.target_runtime_family === 'codex'
      && blocker?.normalized_error_code === 'runtime_connection_protocol_unavailable'
      && /没有匹配协议的\s*LLM connection/i.test(String(blocker?.error?.message || ''))
      && Number(blocker?.connection_view?.before_options_count) > 0
      && Number(blocker?.connection_view?.after_options_count) > 0
      && Number(blocker?.connection_view?.target_match_count) === 0
      && Number(blocker?.connection_view?.after_target_match_count) === 0
      && blocker?.connection_view?.selection_stable === true
      && /^[a-f0-9]{64}$/i.test(String(blocker?.connection_view?.before_sha256 || ''))
      && /^[a-f0-9]{64}$/i.test(String(blocker?.connection_view?.after_sha256 || ''))
      && blocker?.mutation_guard?.valid === true
      && blocker?.mutation_guard?.no_user_action === true
      && blocker?.mutation_guard?.task_stable === true
      && blocker?.mutation_guard?.runtime_stable === true
      && blocker?.mutation_guard?.expert_absent === true
      && blocker?.mutation_guard?.expert_stable === true
      && blocker?.mutation_guard?.drafts_stable === true
      && allowedRoles.includes(role)
      && allowedRoles.every((itemRole) => runtimePrerequisiteNotApplicableRoles.has(itemRole))
      && String(blocker?.reason || '').trim();
    const expertRequirement = CORE_BETA_RUN_OWNED_EXPERT_REQUIREMENTS.get(String(testCase?.id || ''));
    const expertMutationGuard = blocker?.mutation_guard || {};
    const expertPrerequisiteVerified = blocker?.schema_version === 'qbot-core-beta-expert-prerequisite/v1'
      && blocker?.valid === true
      && blocker?.applicable === true
      && ['blocked', 'bug'].includes(String(blocker?.outcome || ''))
      && ['run_owned_published_expert_missing', 'run_owned_published_expert_not_visible']
        .includes(String(blocker?.kind || ''))
      && blocker?.source === 'exact_run_suite_ledger_and_live_expert_inventory'
      && blocker?.dependent_case_id === testCase?.id
      && Boolean(expertRequirement)
      && blocker?.required_ledger_key === expertRequirement?.ledger_key
      && JSON.stringify(sourceCaseIds) === JSON.stringify(expertRequirement?.source_case_ids || [])
      && blocker?.arbitrary_active_expert_fallback_forbidden === true
      && blocker?.selected_expert == null
      && blocker?.exact_live_match_count === 0
      && /^[a-f0-9]{64}$/i.test(String(blocker?.active_expert_identities_sha256 || ''))
      && expertMutationGuard?.valid === true
      && expertMutationGuard?.task_absent === true
      && expertMutationGuard?.no_messages === true
      && expertMutationGuard?.not_running === true
      && expertMutationGuard?.expert_absent === true
      && expertMutationGuard?.skills_absent === true
      && expertMutationGuard?.connectors_absent === true
      && (blocker?.outcome !== 'blocked'
        || (blocker?.ledger_entry_present === false
          && blocker?.ledger_identity_complete === false
          && blocker?.kind === 'run_owned_published_expert_missing'))
      && (blocker?.outcome !== 'bug'
        || (blocker?.ledger_entry_present === true
          && blocker?.ledger_identity_complete === true
          && blocker?.kind === 'run_owned_published_expert_not_visible'))
      && allowedRoles.includes(role)
      && allowedRoles.length > 0
      && allowedRoles.every((itemRole) => expertPrerequisiteNotApplicableRoles.has(itemRole))
      && String(blocker?.reason || '').trim();
    const mcpMutationGuard = blocker?.mutation_guard || {};
    const mcpPrerequisiteVerified = blocker?.schema_version === 'qbot-core-beta-mcp-prerequisite/v1'
      && blocker?.valid === true
      && blocker?.applicable === true
      && blocker?.outcome === 'blocked'
      && blocker?.kind === 'mcp_catalog_sample_shortage'
      && blocker?.source === 'live_connector_catalog_and_exact_suite_ledger'
      && blocker?.source_case_id === 'BETA-MCP-001'
      && JSON.stringify(sourceCaseIds) === JSON.stringify(['BETA-MCP-001'])
      && blocker?.dependent_case_id === testCase?.id
      && Number(blocker?.required_count) === 5
      && Number(blocker?.eligible_count) >= 0
      && Number(blocker?.selected_count) === 0
      && Number(blocker?.catalog_item_count) >= Number(blocker?.eligible_count)
      && JSON.stringify(blocker?.required_strata) === JSON.stringify([
        'document', 'search', 'data', 'collaboration', 'visualization',
      ])
      && Array.isArray(blocker?.available_strata)
      && Array.isArray(blocker?.missing_strata)
      && JSON.stringify(blocker.missing_strata) === JSON.stringify(
        blocker.required_strata.filter((category) => !blocker.available_strata.includes(category)),
      )
      && (Number(blocker?.eligible_count) < 5 || blocker.missing_strata.length > 0)
      && /^[a-f0-9]{64}$/i.test(String(blocker?.catalog_sha256 || ''))
      && /^[a-f0-9]{64}$/i.test(String(blocker?.selection_seed || ''))
      && blocker?.arbitrary_connector_fallback_forbidden === true
      && mcpMutationGuard?.valid === true
      && mcpMutationGuard?.readback_shape_valid === true
      && mcpMutationGuard?.case_bound === true
      && mcpMutationGuard?.task_absent === true
      && mcpMutationGuard?.no_messages === true
      && mcpMutationGuard?.not_running === true
      && mcpMutationGuard?.expert_absent === true
      && mcpMutationGuard?.skills_absent === true
      && mcpMutationGuard?.connectors_absent === true
      && allowedRoles.includes(role)
      && allowedRoles.length > 0
      && allowedRoles.every((itemRole) => mcpPrerequisiteNotApplicableRoles.has(itemRole))
      && String(blocker?.reason || '').trim();
    const interaction = blocker?.interaction || {};
    const preSendMutationGuard = blocker?.mutation_guard || {};
    const failureScreenshot = String(blocker?.screenshot?.path || '');
    const resolvedFailureScreenshot = failureScreenshot ? path.resolve(failureScreenshot) : '';
    const failureScreenshotRelative = resolvedFailureScreenshot
      ? path.relative(path.resolve(caseDir), resolvedFailureScreenshot)
      : '';
    const failureScreenshotValid = Boolean(
      resolvedFailureScreenshot
      && failureScreenshotRelative
      && !failureScreenshotRelative.startsWith('..')
      && !path.isAbsolute(failureScreenshotRelative)
      && fs.existsSync(resolvedFailureScreenshot)
      && fs.statSync(resolvedFailureScreenshot).isFile()
      && fs.statSync(resolvedFailureScreenshot).size >= 128
      && /^[a-f0-9]{64}$/i.test(String(blocker?.screenshot?.sha256 || ''))
      && sha256File(resolvedFailureScreenshot) === blocker.screenshot.sha256
      && interaction?.screenshot === resolvedFailureScreenshot
    );
    const preSendCapabilityFailureVerified = blocker?.schema_version === 'qbot-core-beta-pre-send-capability-failure/v1'
      && blocker?.valid === true
      && blocker?.evidence_valid === true
      && blocker?.oracle_valid === false
      && blocker?.applicable === true
      && blocker?.outcome === 'bug'
      && blocker?.kind === 'visible_capability_control_product_failure'
      && blocker?.source === 'visible_capability_control_click_and_zero_send_readback'
      && blocker?.dependent_case_id === testCase?.id
      && ['skill', 'connector'].includes(String(blocker?.capability_kind || ''))
      && String(blocker?.expected_identity || '').trim()
      && interaction?.schema_version === 'qbot-core-beta-capability-interaction/v1'
      && interaction?.capability_kind === blocker?.capability_kind
      && ['manual_mode', 'manual_skill_selection'].includes(String(interaction?.stage || ''))
      && interaction?.expected_identity === blocker?.expected_identity
      && interaction?.control_located === true
      && interaction?.click_dispatched === true
      && interaction?.expected_state_observed === false
      && interaction?.category === 'bug'
      && interaction?.aria_checked === 'false'
      && interaction?.manual_surface
      && typeof interaction.manual_surface === 'object'
      && typeof interaction.manual_surface.list_visible === 'boolean'
      && Number.isFinite(Number(interaction.manual_surface.option_count))
      && typeof interaction.manual_surface.empty_visible === 'boolean'
      && (blocker?.capability_kind !== 'skill'
        || typeof interaction.manual_surface.search_visible === 'boolean')
      && (interaction?.stage !== 'manual_skill_selection'
        || (interaction.manual_surface.list_visible === true
          && Number(interaction.manual_surface.option_count) > 0))
      && preSendMutationGuard?.valid === true
      && preSendMutationGuard?.task_absent_before === true
      && preSendMutationGuard?.task_absent_after === true
      && preSendMutationGuard?.not_running_before === true
      && preSendMutationGuard?.not_running_after === true
      && preSendMutationGuard?.message_count_zero_before === true
      && preSendMutationGuard?.message_count_zero_after === true
      && preSendMutationGuard?.send_count_observed === true
      && preSendMutationGuard?.send_count_unchanged === true
      && preSendMutationGuard?.capability_selection_empty_before === true
      && preSendMutationGuard?.capability_selection_empty_after === true
      && preSendMutationGuard?.no_prompt_recorded === true
      && preSendMutationGuard?.no_send_receipt_recorded === true
      && preSendMutationGuard?.before_task?.id == null
      && preSendMutationGuard?.after_task?.id == null
      && Number(preSendMutationGuard?.before_task?.message_count) === 0
      && Number(preSendMutationGuard?.after_task?.message_count) === 0
      && Number(preSendMutationGuard?.before_task?.send_count)
        === Number(preSendMutationGuard?.after_task?.send_count)
      && Array.isArray(preSendMutationGuard?.before_selection)
      && preSendMutationGuard.before_selection.length === 0
      && Array.isArray(preSendMutationGuard?.after_selection)
      && preSendMutationGuard.after_selection.length === 0
      && failureScreenshotValid
      && allowedRoles.includes(role)
      && allowedRoles.length > 0
      && allowedRoles.every((itemRole) => preSendCapabilityFailureNotApplicableRoles.has(itemRole))
      && String(blocker?.reason || '').trim();
    const verified = skillPrerequisiteVerified
      || skillPromptSourcePrerequisiteVerified
      || runtimePrerequisiteVerified
      || expertPrerequisiteVerified
      || mcpPrerequisiteVerified
      || preSendCapabilityFailureVerified;
    if (!verified) continue;
    notApplicable.set(role, {
      role,
      path: resolvedBlocker,
      bytes: fs.statSync(resolvedBlocker).size,
      sha256: sha256File(resolvedBlocker),
      valid: true,
      validation_error: '',
      missing: false,
      not_applicable: true,
      source: blocker.source,
      reason: blocker.reason,
    });
  }
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
    if (!item && notApplicable.has(role)) return notApplicable.get(role);
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
    not_applicable_roles: evidence.filter((item) => item.not_applicable).map((item) => ({
      role: item.role,
      source: item.source,
      reason: item.reason,
      path: item.path,
      sha256: item.sha256,
    })),
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
    if (role === 'reply_completion') {
      const replyCompletion = validateReplyCompletionPayload(parsed);
      if (!replyCompletion.valid) return replyCompletion;
    }
    if (role === 'action_receipt') {
      if (!Array.isArray(parsed) || !parsed.length) return { valid: false, error: 'action_receipts_missing' };
      if (parsed.some((item) => !['passed', 'failed', 'blocked'].includes(String(item?.status || ''))
        || !String(item?.before_screenshot || '').trim()
        || !String(item?.after_screenshot || '').trim())) {
        return { valid: false, error: 'action_receipt_invalid_status_or_missing_screenshot' };
      }
    }
  } else if (['prompt', 'transcript', 'reply_delta'].includes(role)) {
    if (!fs.readFileSync(file, 'utf8').trim()) return { valid: false, error: 'text_evidence_empty' };
  }
  return { valid: true };
}

export function validateReplyCompletionPayload(parsed) {
  if (parsed?.complete === true) return { valid: true };
  const terminalOutcome = String(parsed?.terminal_outcome || '');
  if (
    parsed?.evidence_complete !== true
    || parsed?.terminal_failure !== true
    || !['timed_out', 'no_reply'].includes(terminalOutcome)
    || typeof parsed?.assistant_reply_present !== 'boolean'
    || parsed?.confirmed_send_receipt !== true
  ) {
    return { valid: false, error: 'reply_incomplete' };
  }
  const waitedMs = Number(parsed?.waited_ms || 0);
  const timeoutMs = Number(parsed?.timeout_ms || 0);
  const minWaitMs = Number(parsed?.min_wait_ms || 0);
  if (terminalOutcome === 'timed_out') {
    if (timeoutMs < 60_000 || waitedMs < timeoutMs) {
      return { valid: false, error: 'reply_timeout_window_unverified' };
    }
  } else if (
    minWaitMs < 60_000
    || waitedMs < minWaitMs
    || parsed?.observed_running_after_send !== true
    || parsed?.running_after !== false
    || Number(parsed?.no_reply_stable_observations || 0) < 3
    || parsed?.terminal_reconciliation_performed !== true
    || parsed?.terminal_reconciliation_task_bound !== true
    || parsed?.terminal_reconciliation_prompt_bound !== true
    || parsed?.terminal_reconciliation_reply_present !== false
  ) {
    return { valid: false, error: 'reply_no_reply_terminal_unverified' };
  }
  const screenshot = String(parsed?.terminal_screenshot || parsed?.timeout_screenshot || '').trim();
  const screenshotSha256 = String(
    parsed?.terminal_screenshot_sha256 || parsed?.timeout_screenshot_sha256 || '',
  ).trim();
  if (
    !screenshot
    || !path.isAbsolute(screenshot)
    || !fs.existsSync(screenshot)
    || !fs.statSync(screenshot).isFile()
    || fs.statSync(screenshot).size < 128
  ) {
    return { valid: false, error: 'reply_terminal_screenshot_missing' };
  }
  if (
    !/^[a-f0-9]{64}$/i.test(screenshotSha256)
    || sha256File(screenshot) !== screenshotSha256
  ) {
    return { valid: false, error: 'reply_terminal_screenshot_sha256_mismatch' };
  }
  if (!String(parsed?.terminal_reason || '').trim()) {
    return { valid: false, error: 'reply_terminal_reason_missing' };
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
