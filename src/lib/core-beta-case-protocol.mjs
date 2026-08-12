import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export const CORE_BETA_CONTRACT_VERSION = 'qbot-core-beta/v2';
export const CORE_BETA_AUTOMATION_PROTOCOL = 'core-beta-action-plan/v2';
export const CORE_BETA_EVIDENCE_SCHEMA = 'qbot-core-evidence/v2';
export const CORE_BETA_MAX_BATCH_SIZE = 20;

export const CORE_BETA_CASE_TYPES = new Set([
  'compound',
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

const CORE_BETA_ATTACHMENT_FIXTURE_NAMES = new Map([
  ['BETA-FILE-001', ['qbot-pdf-summary.pdf']],
  ['BETA-FILE-002', ['qbot-image-flow.png', 'qbot-image-risk.png']],
  ['BETA-FILE-003', ['qbot-word-report.docx', 'qbot-slide-deck.pptx']],
  ['BETA-FILE-004', ['qbot-table.csv', 'qbot-data-table-diff.xlsx']],
  ['BETA-FILE-005', ['qbot-data.json', 'qbot-page.html', 'qbot-script.js', 'qbot-request-correlation.log']],
]);

const CORE_BETA_RUNTIME_GENERATED_ATTACHMENT_FIXTURES = new Map([
  ['BETA-FILE-005', ['qbot-data.json', 'qbot-page.html', 'qbot-script.js', 'qbot-request-correlation.log']],
]);

export function coreBetaAttachmentFixtureNames(testCase = {}) {
  const id = typeof testCase === 'string' ? testCase : String(testCase?.id || '');
  return [...(CORE_BETA_ATTACHMENT_FIXTURE_NAMES.get(id) || [])];
}

export function coreBetaRuntimeGeneratedAttachmentFixtureNames(testCase = {}) {
  const id = typeof testCase === 'string' ? testCase : String(testCase?.id || '');
  return [...(CORE_BETA_RUNTIME_GENERATED_ATTACHMENT_FIXTURES.get(id) || [])];
}

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

export const CORE_BETA_BASE_SCENARIO_IDS = new Set(
  Object.entries(CORE_BETA_CASE_RANGES).flatMap(([group, count]) => (
    Array.from({ length: count }, (_, index) => `BETA-${group}-${String(index + 1).padStart(3, '0')}`)
  )),
);

// Normal-user functional pool. Each entry is backed by the
// same explicit SIT executor whose semantics were reviewed for the Casebook;
// fault injection, network interruption, second-account and protected
// deployment scenarios are intentionally absent.
export const FULL_FUNCTION_REGRESSION_LEGACY_CASE_IDS = new Set([
  'SIT-SKILL-007',
  'SIT-CONN-003',
  'SIT-INIT-002',
  'SIT-AUTH-003',
  'SIT-TEAMS-NEW-001',
  'SIT-TEAMS-NEW-003',
  'SIT-HOME-002',
  'SIT-HOME-012',
  'SIT-HOME-013',
  'SIT-HOME-014',
  'SIT-ISSUE-793',
  'SIT-HOME-006',
  'SIT-WORKSPACE-001',
  'SIT-EXPERT-001',
  'SIT-EXPERT-004',
  'SIT-EXPERT-006',
  'SIT-EXPERT-009',
  'SIT-EXPERT-013',
  'SIT-EXPERT-021',
  'SIT-EXPERT-022',
  'SIT-SKILL-001',
  'SIT-SKILL-025',
  'SIT-SKILL-003',
  'SIT-SKILL-014',
  'SIT-SKILL-016',
  'SIT-SKILL-017',
  'SIT-SKILL-026',
  'SIT-SKILL-013',
  'SIT-SKILL-030',
  'SIT-SKILL-032',
  'SIT-SKILL-SCOPE-001',
  'SIT-CONN-001',
  'SIT-CONN-002',
  'SIT-CONN-004',
  'SIT-CONN-009',
  'SIT-CONN-010',
  'SIT-CONN-011',
  'SIT-CONN-015',
  'SIT-CONN-019',
  'SIT-ART-001',
  'SIT-ART-002',
  'SIT-ART-015',
  'SIT-ART-017',
  'SIT-ART-021',
  'SIT-ART-022',
  'SIT-ART-CONFIRM-001',
  'SIT-ART-013',
  'SIT-ART-014',
  'SIT-ART-024',
  'SIT-KNOWLEDGE-001',
  'SIT-INIT-004',
  'SIT-INIT-009',
  'SIT-INIT-025',
  'SIT-AUTH-001',
  'SIT-AUTH-005',
  'SIT-TEAMS-NEW-002',
  'SIT-SKILL-002',
  'SIT-EXPERT-002',
  'SIT-HOME-023',
  'SIT-HOME-030',
  'SIT-HOME-049',
  'SIT-HOME-050',
  'SIT-HITL-002',
  'SIT-TASK-EDIT-001',
  'SIT-TASK-REGEN-001',
  'SIT-HOME-037',
  'SIT-HOME-038',
  'SIT-HOME-040',
  'SIT-HOME-041',
  'SIT-HOME-043',
  'SIT-HOME-044',
  'SIT-HOME-056',
  'SIT-CONN-016',
  'SIT-MEM-001',
  'SIT-HOME-015',
  'SIT-HOME-016',
  'SIT-HOME-022',
  'SIT-HOME-053',
  'SIT-HOME-057',
  'SIT-HOME-058',
  'SIT-HOME-060',
  'SIT-HOME-062',
  'SIT-HOME-019',
  'SIT-HOME-054',
  'SIT-HOME-055',
  'SIT-HOME-065',
  'SIT-HOME-066',
  'SIT-HOME-027',
  'SIT-HOME-047',
  'SIT-HOME-052',
  'SIT-HOME-028',
  'SIT-HOME-046',
  'SIT-HOME-051',
  'SIT-CONN-005',
  'SIT-HOME-048',
]);

export const PRODUCTION_GRAY_EXCLUDED_RARE_CASE_IDS = new Set([
  'BETA-REC-001',
  'BETA-REC-002',
  'BETA-REC-004',
  'BETA-TASK-003',
  'BETA-EXPERT-016',
]);

export const PRODUCTION_GRAY_PROMOTED_LEGACY_CASE_IDS = new Set([
  'SIT-SKILL-007',
  'SIT-HOME-002',
  'SIT-HOME-012',
  'SIT-HOME-013',
  'SIT-HOME-014',
]);

export const CORE_BETA_SCENARIO_IDS = new Set([
  ...CORE_BETA_BASE_SCENARIO_IDS,
  ...FULL_FUNCTION_REGRESSION_LEGACY_CASE_IDS,
  ...[
    'QWD-ENTRY-002',
    'QWD-ART-007',
    'QWD-ART-008',
    'QWD-EXPERT-002',
    'QWD-EXPERT-009',
    'QWD-EXPERT-011',
    'QWD-AUTO-002',
    'QWD-AUTO-003',
    'QWD-AUTO-004',
    'QWD-SYS-003',
    'QWD-MEM-002',
    'QWD-SEC-002',
    'QWD-SEC-005',
  ],
]);

const scenarioSpecs = [];
const registerScenario = (id, driver, {
  fixture_control = 'public_product_state',
  execution_mode = 'serial',
  legacy_case_id = '',
  runtime_fixture = '',
  conversation_required,
  capability_execution_required,
} = {}) => {
  scenarioSpecs.push([id, Object.freeze({
    id,
    driver,
    fixture_control,
    execution_mode,
    legacy_case_id,
    runtime_fixture,
    conversation_required,
    capability_execution_required,
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
  ['BETA-EXPERT-007', 'expert_publish_state_machine'],
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
  ['BETA-TASK-008', 'composer_history_navigation'],
  ['BETA-TASK-004', 'task_hitl_answer_skip_timeout', { fixture_control: 'hitl_answer_skip_timeout' }],
  ['BETA-SEC-005', 'security_ssrf_advanced_matrix', { fixture_control: 'ssrf_advanced_matrix' }],
  ['BETA-ROUTE-001', 'model_menu_sdk_filter'],
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
  ['QWD-ENTRY-002', 'qwork_daily_new_task_auto_isolation', { conversation_required: false }],
  ['QWD-ART-007', 'qwork_daily_artifact_exact_directory'],
  ['QWD-ART-008', 'qwork_daily_artifact_keep_both_atomic'],
  ['QWD-EXPERT-002', 'qwork_daily_expert_catalog_identity', { capability_execution_required: false }],
  ['QWD-EXPERT-009', 'qwork_daily_expert_owner_org_publish'],
  ['QWD-EXPERT-011', 'qwork_daily_expert_owner_lifecycle'],
  ['QWD-AUTO-002', 'qwork_daily_route_task_stability'],
  ['QWD-AUTO-003', 'qwork_daily_capability_turn_snapshot'],
  ['QWD-AUTO-004', 'qwork_daily_capability_fallback_copy'],
  ['QWD-SYS-003', 'qwork_daily_settings_persona_profile'],
  ['QWD-MEM-002', 'qwork_daily_memory_precedence'],
  ['QWD-SEC-002', 'qwork_daily_prompt_injection_boundary'],
  ['QWD-SEC-005', 'qwork_daily_credential_redaction_copy', { conversation_required: false }],
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

for (const id of FULL_FUNCTION_REGRESSION_LEGACY_CASE_IDS) {
  registerScenario(id, `verified_legacy_${id.toLowerCase().replaceAll('-', '_')}`, {
    fixture_control: 'public_product_state',
    legacy_case_id: id,
  });
}

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
  ['BETA-SKILL-003', ['BETA-SKILL-002']],
  ['BETA-SKILL-004', ['BETA-SKILL-002']],
  ['BETA-SKILL-005', ['BETA-SKILL-002', 'BETA-SKILL-003', 'BETA-SKILL-004']],
  ['BETA-SKILL-006', ['BETA-SKILL-002', 'BETA-SKILL-003', 'BETA-SKILL-004']],
  ['BETA-SKILL-007', ['BETA-SKILL-002', 'BETA-SKILL-003', 'BETA-SKILL-004']],
  ['BETA-SKILL-008', ['BETA-SKILL-002', 'BETA-SKILL-003', 'BETA-SKILL-004']],
  ['BETA-SKILL-009', ['BETA-SKILL-002', 'BETA-SKILL-003', 'BETA-SKILL-004']],
  ['BETA-SKILL-010', ['BETA-SKILL-002', 'BETA-SKILL-003', 'BETA-SKILL-004']],
  ['BETA-SKILL-011', ['BETA-SKILL-002', 'BETA-SKILL-003', 'BETA-SKILL-004']],
  ['BETA-SKILL-012', ['BETA-SKILL-003', 'BETA-SKILL-004']],
  ['BETA-SKILL-015', ['BETA-SKILL-002', 'BETA-SKILL-003', 'BETA-SKILL-004']],
  ['BETA-EXPERT-007', ['BETA-EXPERT-002', 'BETA-EXPERT-003', 'BETA-EXPERT-004']],
  ['BETA-EXPERT-008', ['BETA-EXPERT-002', 'BETA-EXPERT-007']],
  ['BETA-EXPERT-009', ['BETA-EXPERT-003', 'BETA-EXPERT-007']],
  ['BETA-EXPERT-010', ['BETA-EXPERT-004', 'BETA-EXPERT-007']],
  ['BETA-EXPERT-011', ['BETA-EXPERT-007']],
  ['BETA-EXPERT-012', ['BETA-EXPERT-007']],
  ['BETA-EXPERT-013', ['BETA-EXPERT-012']],
  ['BETA-EXPERT-014', ['BETA-EXPERT-012']],
  ['BETA-EXPERT-015', ['BETA-EXPERT-012']],
  ['BETA-EXPERT-016', ['BETA-EXPERT-012']],
  ['BETA-MCP-002', ['BETA-MCP-001']],
  ['BETA-MCP-003', ['BETA-MCP-001']],
  ['BETA-MCP-004', ['BETA-MCP-001']],
  ['BETA-MCP-005', ['BETA-MCP-001']],
  ['BETA-MCP-006', ['BETA-MCP-001']],
  ['BETA-MCP-007', ['BETA-MCP-001']],
  ['BETA-MCP-008', ['BETA-MCP-001']],
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

export function coreBetaLeafCases(cases = []) {
  const leaves = [];
  for (const testCase of Array.isArray(cases) ? cases : []) {
    if (String(testCase?.case_type || '') === 'compound') {
      leaves.push(...coreBetaLeafCases(testCase?.compound_subcases || []));
    } else {
      leaves.push(testCase);
    }
  }
  return leaves;
}

export const CORE_BETA_EVIDENCE_ADAPTERS = new Set([
  'compound_evidence_manifest',
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
  'pre_send_attachment_rejection',
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
  'qwork_daily_readback',
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
  if (String(testCase?.case_type || '') === 'compound') return 'core-beta/compound-v2';
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
    conversation_required: scenario?.conversation_required,
    capability_execution_required: scenario?.capability_execution_required,
    executor_attachment_fixtures: coreBetaAttachmentFixtureNames(testCase),
    compound_subcases: Array.isArray(testCase?.compound_subcases)
      ? testCase.compound_subcases.map((subcase) => ({
        id: String(subcase?.id || ''),
        contract_sha256: coreBetaCaseContractSha256(subcase),
      }))
      : [],
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
  const scenarioSpec = coreBetaScenarioSpec(id);
  const isCompound = String(testCase?.case_type || '') === 'compound';
  if (!isCompound && !CORE_BETA_SCENARIO_IDS.has(id)) errors.push(`${id} 没有注册独立场景执行器`);
  if (!isCompound && !scenarioSpec?.driver) errors.push(`${id} 场景注册表缺少 driver`);
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

  if (isCompound) {
    const subcases = Array.isArray(testCase?.compound_subcases) ? testCase.compound_subcases : [];
    if (!/^QW-/i.test(id)) errors.push(`${id} compound 父 Case 必须使用 QW-* 用户合同 ID`);
    if (String(testCase?.pipeline_policy || '') !== 'serial' || batchSize !== 1) {
      errors.push(`${id} compound 父 Case 必须 serial/1`);
    }
    if (!subcases.length) errors.push(`${id} compound_subcases 必须是非空数组`);
    const subcaseIds = subcases.map((subcase) => String(subcase?.id || '').trim());
    if (new Set(subcaseIds).size !== subcaseIds.length) errors.push(`${id} compound 子 Case ID 重复`);
    for (const [index, subcase] of subcases.entries()) {
      if (String(subcase?.case_type || '') === 'compound') {
        errors.push(`${id} compound_subcases[${index + 1}] 禁止嵌套 compound`);
        continue;
      }
      const child = validateCoreBetaCase(subcase, { fixtureRoot });
      errors.push(...child.errors.map((error) => `${id} -> ${error}`));
      warnings.push(...child.warnings.map((warning) => `${id} -> ${warning}`));
    }
    const roles = new Set(Array.isArray(testCase?.evidence_roles) ? testCase.evidence_roles : []);
    if (!roles.has('compound_evidence_manifest')) {
      errors.push(`${id} compound evidence_roles 缺少 compound_evidence_manifest`);
    }
    for (const role of roles) {
      if (!CORE_BETA_EVIDENCE_ADAPTERS.has(role)) errors.push(`${id} 证据角色没有框架适配器：${role}`);
    }
    return {
      id,
      ok: errors.length === 0,
      executor_route: coreBetaExecutorRoute(testCase),
      scenario_driver: 'compound_serial_subcases',
      fixture_control_adapter: 'compound_children',
      action_count: Array.isArray(testCase?.action_plan) ? testCase.action_plan.length : 0,
      evidence_role_count: roles.size,
      fixture_spec: [],
      subcase_count: subcases.length,
      subcase_ids: subcaseIds,
      errors,
      warnings,
    };
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
  const isReadOnlyModelMenu = scenarioSpec?.driver === 'model_menu_sdk_filter';
  const requiresConversation = scenarioSpec?.conversation_required ?? ((!isPreSendAttachmentRejection
      && !isReadOnlyModelMenu
      && CONVERSATION_TYPES.has(String(testCase?.case_type || '')))
    || evidenceRoles.has('prompt')
    || evidenceRoles.has('transcript')
    || (Array.isArray(testCase?.conversation_turns) && testCase.conversation_turns.length > 0));
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
  const requiresCapabilityExecution = scenarioSpec?.capability_execution_required
    ?? CAPABILITY_TYPES.has(String(testCase?.case_type || ''));
  if (requiresCapabilityExecution) {
    for (const role of ['capability_selection', 'capability_execution_event']) {
      if (!evidenceRoles.has(role)) errors.push(`${id} 能力 Case 缺少证据角色 ${role}`);
    }
  }

  const executorAttachmentFixtures = coreBetaAttachmentFixtureNames(testCase);
  const fixtureSpec = [...new Set([
    ...parseFixtureSpec(testCase?.required_fixture),
    ...executorAttachmentFixtures.map((name) => `file:${name}`),
  ])];
  if (!fixtureSpec.length) errors.push(`${id} required_fixture 必须声明至少一项 fixture`);
  if (fixtureRoot) {
    const runtimeGeneratedFixtures = new Set(coreBetaRuntimeGeneratedAttachmentFixtureNames(testCase));
    for (const name of executorAttachmentFixtures) {
      if (runtimeGeneratedFixtures.has(name)) continue;
      const file = path.resolve(fixtureRoot, name);
      if (!fs.existsSync(file) || !fs.statSync(file).isFile() || fs.statSync(file).size <= 0) {
        errors.push(`${id} 精确附件 fixture 缺失或为空：${file}`);
      }
    }
    for (const fixture of fixtureSpec.filter((item) => item.startsWith('file:'))) {
      const file = path.resolve(fixtureRoot, fixture.slice(5));
      const runtimeGenerated = Boolean(
        runtimeGeneratedFixtures.has(fixture.slice(5))
        || (scenarioSpec?.runtime_fixture && fixture.slice(5) === scenarioSpec.runtime_fixture),
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
    const localInitializationPrefix = [
      'BETA-INIT-001',
      'BETA-INIT-002',
      'BETA-INIT-003',
      'BETA-INIT-004',
    ];
    // INIT-005 injects a connection-cache fault. It remains valid for the
    // historical 74/184 contracts, but is intentionally absent from the
    // release/0.1 desktop gray gate, which excludes network-fault scenarios.
    const requiredPrefix = ids.includes('BETA-INIT-005')
      ? [...localInitializationPrefix, 'BETA-INIT-005']
      : localInitializationPrefix;
    const actualPrefix = ids.slice(0, requiredPrefix.length);
    if (JSON.stringify(actualPrefix) !== JSON.stringify(requiredPrefix)) {
      errors.push(
        `Core Beta 全量批次必须以初始化硬门禁开场且顺序固定：`
        + `${requiredPrefix.join(',')}；actual=${actualPrefix.join(',') || 'empty'}`,
      );
    }
    const lateInitialization = ids.slice(requiredPrefix.length).filter((id) => id.startsWith('BETA-INIT-'));
    if (lateInitialization.length) {
      errors.push(`初始化 Case 不得在业务 Case 之后执行：${lateInitialization.join(',')}`);
    }
  }
  if (options.allowDependencyGaps !== true) {
    const leaves = coreBetaLeafCases(cases || []);
    const firstPositions = new Map();
    leaves.forEach((item, index) => {
      const id = String(item?.id || '').trim();
      if (id && !firstPositions.has(id)) firstPositions.set(id, index);
    });
    for (const [index, item] of leaves.entries()) {
      const id = String(item?.id || '').trim();
      for (const dependencyId of CORE_BETA_CASE_DEPENDENCIES.get(id) || []) {
        const dependencyIndex = firstPositions.get(dependencyId);
        if (dependencyIndex == null || dependencyIndex >= index) {
          errors.push(
            `${id} 的上游 ${dependencyId} 必须在同一批次更早建立；`
            + `leaf_index=${index + 1}；upstream_index=${dependencyIndex == null ? 'missing' : dependencyIndex + 1}`,
          );
        }
      }
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
    'expert_publish_operation',
    'restart_trace',
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
  const capabilityInventoryPrerequisiteNotApplicableRoles = new Set([
    'capability_execution_event',
    ...skillPrerequisiteNotApplicableRoles,
  ]);
  const preSendImeFailureNotApplicableRoles = new Set([
    'prompt',
    'task_id',
    'send_receipt',
    'transcript',
    'reply_delta',
    'reply_completion',
  ]);
  const preSendAttachmentRejectionNotApplicableRoles = new Set([
    'task_id',
    'prompt',
    'send_receipt',
    'transcript',
    'reply_delta',
    'reply_completion',
  ]);
  const add = (role, file) => {
    if (typeof file !== 'string' || !file || !fs.existsSync(file)) return;
    const validation = validateEvidenceFile(role, file, { expectedCaseId: testCase?.id || '' });
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
        && !preSendCapabilityFailureNotApplicableRoles.has(role)
        && !preSendImeFailureNotApplicableRoles.has(role)
        && !preSendAttachmentRejectionNotApplicableRoles.has(role))
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
    const expertPublishRequiredKeys = [
      'claude-code_draft',
      'codex_draft',
      'manual_draft',
    ];
    const expertPublishSourceCaseIds = [
      'BETA-EXPERT-002',
      'BETA-EXPERT-003',
      'BETA-EXPERT-004',
    ];
    const missingDraftKeys = Array.isArray(blocker?.missing_draft_keys)
      ? blocker.missing_draft_keys.map(String)
      : [];
    const incompleteDraftKeys = Array.isArray(blocker?.incomplete_draft_keys)
      ? blocker.incomplete_draft_keys.map(String)
      : [];
    const publishRequirements = Array.isArray(blocker?.requirements) ? blocker.requirements : [];
    const availableDraftIdentities = Array.isArray(blocker?.available_draft_identities)
      ? blocker.available_draft_identities
      : [];
    const expertPublishPrerequisiteVerified = blocker?.schema_version === 'qbot-core-beta-expert-prerequisite/v1'
      && blocker?.valid === true
      && blocker?.applicable === true
      && blocker?.outcome === 'blocked'
      && blocker?.kind === 'run_owned_draft_set_missing'
      && blocker?.source === 'exact_run_suite_ledger_and_live_draft_inventory'
      && testCase?.id === 'BETA-EXPERT-007'
      && blocker?.dependent_case_id === 'BETA-EXPERT-007'
      && JSON.stringify(sourceCaseIds) === JSON.stringify(expertPublishSourceCaseIds)
      && JSON.stringify(blocker?.required_draft_keys || []) === JSON.stringify(expertPublishRequiredKeys)
      && missingDraftKeys.length > 0
      && new Set(missingDraftKeys).size === missingDraftKeys.length
      && missingDraftKeys.every((key) => expertPublishRequiredKeys.includes(key))
      && incompleteDraftKeys.length === 0
      && publishRequirements.length === 3
      && publishRequirements.every((item, index) => (
        item?.ledger_key === expertPublishRequiredKeys[index]
        && item?.source_case_id === expertPublishSourceCaseIds[index]
        && item?.kind === ['research', 'data', 'delivery'][index]
        && (item?.present === true || item?.present === false)
        && (item?.complete === true || item?.complete === false)
        && (missingDraftKeys.includes(item.ledger_key)
          ? item.present === false && item.complete === false && item.id === '' && item.etag === ''
          : item.present === true && item.complete === true
            && String(item.id || '').trim() && String(item.etag || '').trim())
      ))
      && blocker?.ledger_snapshot_sha256 === createHash('sha256')
        .update(JSON.stringify(publishRequirements)).digest('hex')
      && Number(blocker?.available_draft_count) === availableDraftIdentities.length
      && availableDraftIdentities.every((item) => String(item?.id || '').trim())
      && blocker?.available_draft_identities_sha256 === createHash('sha256')
        .update(JSON.stringify(availableDraftIdentities)).digest('hex')
      && blocker?.historical_draft_fallback_forbidden === true
      && Array.isArray(blocker?.selected_draft_ids)
      && blocker.selected_draft_ids.length === 0
      && expertMutationGuard?.valid === true
      && expertMutationGuard?.case_bound === true
      && expertMutationGuard?.task_absent === true
      && expertMutationGuard?.no_messages === true
      && expertMutationGuard?.not_running === true
      && expertMutationGuard?.send_count_observed === true
      && expertMutationGuard?.expert_absent === true
      && expertMutationGuard?.skills_absent === true
      && expertMutationGuard?.connectors_absent === true
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
    const inventorySurface = blocker?.manual_surface || {};
    const inventoryMutationGuard = blocker?.mutation_guard || {};
    const inventoryScreenshot = String(blocker?.screenshot?.path || '');
    const resolvedInventoryScreenshot = inventoryScreenshot ? path.resolve(inventoryScreenshot) : '';
    const inventoryScreenshotRelative = resolvedInventoryScreenshot
      ? path.relative(path.resolve(caseDir), resolvedInventoryScreenshot)
      : '';
    const inventoryScreenshotValid = Boolean(
      resolvedInventoryScreenshot
      && inventoryScreenshotRelative
      && !inventoryScreenshotRelative.startsWith('..')
      && !path.isAbsolute(inventoryScreenshotRelative)
      && fs.existsSync(resolvedInventoryScreenshot)
      && fs.statSync(resolvedInventoryScreenshot).isFile()
      && fs.statSync(resolvedInventoryScreenshot).size >= 128
      && /^[a-f0-9]{64}$/i.test(String(blocker?.screenshot?.sha256 || ''))
      && sha256File(resolvedInventoryScreenshot) === blocker.screenshot.sha256
    );
    const capabilityInventoryPrerequisiteVerified = blocker?.schema_version === 'qbot-core-beta-capability-prerequisite/v1'
      && blocker?.valid === true
      && blocker?.evidence_valid === true
      && blocker?.oracle_valid === false
      && blocker?.applicable === true
      && blocker?.outcome === 'blocked'
      && blocker?.kind === 'capability_inventory_empty'
      && blocker?.source === 'visible_unified_composer_capability_inventory'
      && blocker?.dependent_case_id === testCase?.id
      && ['skill', 'connector'].includes(String(blocker?.capability_kind || ''))
      && Number(blocker?.required_count) === 1
      && Number(blocker?.available_count) === 0
      && /还没安装技能|暂无可选技能|未接入|暂无连接器|无匹配/.test(String(blocker?.inventory_text || ''))
      && inventorySurface?.list_visible === true
      && Number(inventorySurface?.option_count) === 0
      && inventorySurface?.empty_visible === true
      && (blocker?.capability_kind !== 'skill' || inventorySurface?.search_visible === true)
      && inventoryMutationGuard?.valid === true
      && inventoryMutationGuard?.task_absent_before === true
      && inventoryMutationGuard?.task_absent_after === true
      && inventoryMutationGuard?.not_running_before === true
      && inventoryMutationGuard?.not_running_after === true
      && inventoryMutationGuard?.message_count_zero_before === true
      && inventoryMutationGuard?.message_count_zero_after === true
      && inventoryMutationGuard?.send_count_observed === true
      && inventoryMutationGuard?.send_count_unchanged === true
      && inventoryMutationGuard?.capability_selection_empty_before === true
      && inventoryMutationGuard?.capability_selection_empty_after === true
      && inventoryMutationGuard?.no_prompt_recorded === true
      && inventoryMutationGuard?.no_send_receipt_recorded === true
      && inventoryMutationGuard?.before_task?.id == null
      && inventoryMutationGuard?.after_task?.id == null
      && Number(inventoryMutationGuard?.before_task?.message_count) === 0
      && Number(inventoryMutationGuard?.after_task?.message_count) === 0
      && Number(inventoryMutationGuard?.before_task?.send_count)
        === Number(inventoryMutationGuard?.after_task?.send_count)
      && Array.isArray(inventoryMutationGuard?.before_selection)
      && inventoryMutationGuard.before_selection.length === 0
      && Array.isArray(inventoryMutationGuard?.after_selection)
      && inventoryMutationGuard.after_selection.length === 0
      && inventoryScreenshotValid
      && allowedRoles.includes(role)
      && allowedRoles.length > 0
      && allowedRoles.every((itemRole) => capabilityInventoryPrerequisiteNotApplicableRoles.has(itemRole))
      && String(blocker?.reason || '').trim();
    const imeTrace = interaction?.trace || {};
    const preSendImeFailureVerified = blocker?.schema_version === 'qbot-core-beta-pre-send-ime-failure/v1'
      && blocker?.valid === true
      && blocker?.evidence_valid === true
      && blocker?.oracle_valid === false
      && blocker?.applicable === true
      && blocker?.outcome === 'bug'
      && blocker?.kind === 'native_ime_product_failure_before_send'
      && blocker?.source === 'native_ime_composition_and_zero_send_readback'
      && blocker?.dependent_case_id === testCase?.id
      && interaction?.schema_version === 'qbot-core-beta-native-ime-interaction/v1'
      && interaction?.focus_arm?.ready === true
      && imeTrace?.valid === false
      && imeTrace?.evidence_valid === true
      && imeTrace?.oracle_valid === false
      && imeTrace?.adapter_noop === false
      && Number(imeTrace?.native_command_status) === 0
      && Number(imeTrace?.event_count) > 0
      && preSendMutationGuard?.valid === true
      && preSendMutationGuard?.task_absent_before === true
      && preSendMutationGuard?.task_absent_after === true
      && preSendMutationGuard?.not_running_before === true
      && preSendMutationGuard?.not_running_after === true
      && preSendMutationGuard?.message_count_zero_before === true
      && preSendMutationGuard?.message_count_zero_after === true
      && preSendMutationGuard?.send_count_observed === true
      && preSendMutationGuard?.send_count_unchanged === true
      && preSendMutationGuard?.no_prompt_recorded === true
      && preSendMutationGuard?.no_send_receipt_recorded === true
      && preSendMutationGuard?.before_task?.id == null
      && preSendMutationGuard?.after_task?.id == null
      && Number(preSendMutationGuard?.before_task?.message_count) === 0
      && Number(preSendMutationGuard?.after_task?.message_count) === 0
      && Number(preSendMutationGuard?.before_task?.send_count)
        === Number(preSendMutationGuard?.after_task?.send_count)
      && failureScreenshotValid
      && allowedRoles.includes(role)
      && allowedRoles.length > 0
      && allowedRoles.every((itemRole) => preSendImeFailureNotApplicableRoles.has(itemRole))
      && String(blocker?.reason || '').trim();
    const attachmentRejection = blocker?.rejection || {};
    const attachmentComposer = blocker?.composer_state || {};
    const attachmentMutationGuard = blocker?.mutation_guard || {};
    const attachmentCaseType = testCase?.id === 'SIT-HOME-043'
      ? 'single_file_oversize'
      : testCase?.id === 'SIT-HOME-044' ? 'aggregate_oversize' : '';
    const attachmentMessagePattern = testCase?.id === 'SIT-HOME-043'
      ? /单个文档不能超过\s*30\s*MiB|单个.*30\s*(?:MiB|MB)|文件过大/
      : /文档附件总大小不能超过\s*80\s*MiB|总大小.*80\s*(?:MiB|MB)|总量过大/;
    const caseBoundEvidenceFileValid = (record, minimumBytes = 1) => {
      const recordPath = String(record?.path || '');
      const resolvedRecordPath = recordPath ? path.resolve(recordPath) : '';
      const recordRelative = resolvedRecordPath
        ? path.relative(path.resolve(caseDir), resolvedRecordPath)
        : '';
      return Boolean(
        resolvedRecordPath
        && recordRelative
        && !recordRelative.startsWith('..')
        && !path.isAbsolute(recordRelative)
        && fs.existsSync(resolvedRecordPath)
        && fs.statSync(resolvedRecordPath).isFile()
        && fs.statSync(resolvedRecordPath).size >= minimumBytes
        && /^[a-f0-9]{64}$/i.test(String(record?.sha256 || ''))
        && sha256File(resolvedRecordPath) === record.sha256
      );
    };
    const beforeAttachmentState = attachmentMutationGuard?.before_state || {};
    const afterAttachmentState = attachmentMutationGuard?.after_state || {};
    let attachmentDialogEvidence = null;
    if (caseBoundEvidenceFileValid(blocker?.dialog_evidence, 1)) {
      try {
        attachmentDialogEvidence = JSON.parse(fs.readFileSync(blocker.dialog_evidence.path, 'utf8'));
      } catch {
        attachmentDialogEvidence = null;
      }
    }
    const attachmentDialogMessage = String(attachmentRejection?.dialog_message || '');
    const attachmentPlaywrightDialog = attachmentDialogEvidence?.playwright_dialog || {};
    const attachmentAccessibility = attachmentDialogEvidence?.accessibility || {};
    const attachmentConfirmation = attachmentDialogEvidence?.confirmation || {};
    const attachmentAccessibilityEvidenceVerified = Boolean(
      attachmentDialogEvidence?.safe_information_dialog === true
      && attachmentDialogEvidence?.message_matched === true
      && attachmentDialogEvidence?.evidence_observed_before_confirmation === true
      && attachmentDialogEvidence?.confirmation_clicked === true
      && attachmentDialogEvidence?.sheet_closed_after_confirmation === true
      && attachmentAccessibility?.ok === true
      && attachmentAccessibility?.observed === true
      && attachmentAccessibility?.role === 'AXSheet'
      && attachmentAccessibility?.message === attachmentDialogMessage
      && attachmentAccessibility?.message_matched === true
      && Array.isArray(attachmentAccessibility?.buttons)
      && attachmentAccessibility.buttons.length === 1
      && /^(?:OK|确定|知道了)$/.test(String(attachmentAccessibility.buttons[0] || ''))
      && attachmentConfirmation?.ok === true
      && attachmentConfirmation?.observed === true
      && attachmentConfirmation?.role === 'AXSheet'
      && attachmentConfirmation?.message === attachmentDialogMessage
      && attachmentConfirmation?.message_matched === true
      && attachmentConfirmation?.clicked === true
      && /^(?:OK|确定|知道了)$/.test(String(attachmentConfirmation?.confirmation_label || ''))
    );
    const attachmentPlaywrightFallbackEvidenceVerified = Boolean(
      attachmentPlaywrightDialog?.observed_before_confirmation === true
      && attachmentPlaywrightDialog?.type === 'alert'
      && attachmentPlaywrightDialog?.message === attachmentDialogMessage
      && attachmentPlaywrightDialog?.allowlisted_attachment_info === true
      && attachmentPlaywrightDialog?.action === 'playwright_accept_fallback'
      && attachmentPlaywrightDialog?.accepted === true
      && attachmentPlaywrightDialog?.evidence_captured_before_accept === true
      && attachmentPlaywrightDialog?.page_responsive_after === true
      && !String(attachmentPlaywrightDialog?.close_error || '')
    );
    const attachmentDialogEvidenceVerified = Boolean(
      attachmentDialogEvidence
      && attachmentDialogEvidence?.expected_dialog_message === attachmentDialogMessage
      && attachmentDialogEvidence?.playwright_dialog_message === attachmentDialogMessage
      && (attachmentAccessibilityEvidenceVerified || attachmentPlaywrightFallbackEvidenceVerified)
    );
    const preSendAttachmentRejectionVerified = blocker?.schema_version === 'qbot-core-beta-pre-send-attachment-rejection/v1'
      && blocker?.valid === true
      && blocker?.evidence_valid === true
      && blocker?.oracle_valid === true
      && blocker?.applicable === true
      && blocker?.outcome === 'pass'
      && blocker?.kind === 'verified_attachment_rejection_before_send'
      && blocker?.source === 'visible_attachment_rejection_and_public_zero_send_readback'
      && blocker?.dependent_case_id === testCase?.id
      && attachmentCaseType
      && attachmentRejection?.type === attachmentCaseType
      && attachmentRejection?.expected_pattern_matched === true
      && attachmentRejection?.visible_rejection_evidence === true
      && attachmentRejection?.dialog_observed === true
      && attachmentMessagePattern.test(String(attachmentRejection?.dialog_message || ''))
      && attachmentRejection?.dialog_settled === true
      && (attachmentRejection?.managed_teams_ax_required !== true
        || attachmentRejection?.managed_dialog_evidence === true)
      && attachmentRejection?.rejected_before_send === true
      && Number(attachmentComposer?.count) === 0
      && Array.isArray(attachmentComposer?.names)
      && attachmentComposer.names.length === 0
      && attachmentMutationGuard?.valid === true
      && attachmentMutationGuard?.public_state_available_before === true
      && attachmentMutationGuard?.public_state_available_after === true
      && attachmentMutationGuard?.task_absent_before === true
      && attachmentMutationGuard?.task_absent_after === true
      && attachmentMutationGuard?.not_running_before === true
      && attachmentMutationGuard?.not_running_after === true
      && attachmentMutationGuard?.message_count_observed === true
      && attachmentMutationGuard?.message_count_unchanged === true
      && attachmentMutationGuard?.send_count_observed === true
      && attachmentMutationGuard?.send_count_unchanged === true
      && attachmentMutationGuard?.no_prompt_recorded === true
      && attachmentMutationGuard?.no_send_receipt_recorded === true
      && beforeAttachmentState?.available === true
      && afterAttachmentState?.available === true
      && !String(beforeAttachmentState?.active_id || '')
      && !String(afterAttachmentState?.active_id || '')
      && beforeAttachmentState?.running === false
      && afterAttachmentState?.running === false
      && typeof beforeAttachmentState?.message_count === 'number'
      && Number.isFinite(beforeAttachmentState.message_count)
      && typeof afterAttachmentState?.message_count === 'number'
      && Number.isFinite(afterAttachmentState.message_count)
      && beforeAttachmentState.message_count === afterAttachmentState.message_count
      && typeof beforeAttachmentState?.send_count === 'number'
      && Number.isFinite(beforeAttachmentState.send_count)
      && typeof afterAttachmentState?.send_count === 'number'
      && Number.isFinite(afterAttachmentState.send_count)
      && beforeAttachmentState.send_count === afterAttachmentState.send_count
      && caseBoundEvidenceFileValid(blocker?.screenshots?.rejection, 128)
      && caseBoundEvidenceFileValid(blocker?.screenshots?.after_dismissal, 128)
      && attachmentDialogEvidenceVerified
      && allowedRoles.includes(role)
      && JSON.stringify(allowedRoles) === JSON.stringify([...preSendAttachmentRejectionNotApplicableRoles])
      && String(blocker?.reason || '').trim();
    const verified = skillPrerequisiteVerified
      || skillPromptSourcePrerequisiteVerified
      || runtimePrerequisiteVerified
      || expertPrerequisiteVerified
      || expertPublishPrerequisiteVerified
      || mcpPrerequisiteVerified
      || preSendCapabilityFailureVerified
      || capabilityInventoryPrerequisiteVerified
      || preSendImeFailureVerified
      || preSendAttachmentRejectionVerified;
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

export function validateEvidenceFile(role, file, { expectedCaseId = '' } = {}) {
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
    if (parsed && typeof parsed === 'object' && parsed.evidence_valid === false) {
      return { valid: false, error: String(parsed.reason || parsed.validation_error || 'evidence_invalid') };
    }
    if (parsed && typeof parsed === 'object'
      && typeof parsed.evidence_valid !== 'boolean'
      && parsed.valid === false) {
      return { valid: false, error: String(parsed.reason || parsed.validation_error || 'explicitly_invalid') };
    }
    if (role === 'task_id' && !String(parsed?.task_id || '').trim()) {
      return { valid: false, error: 'task_id_missing' };
    }
    if (role === 'reply_completion') {
      const replyCompletion = validateReplyCompletionPayload(parsed);
      if (!replyCompletion.valid) return replyCompletion;
    }
    if (role === 'performance_metrics') {
      const samplesPath = String(parsed?.source_samples_path || '');
      const samplesSha256 = String(parsed?.source_samples_sha256 || '');
      const resolvedMetricsFile = path.resolve(file);
      const resolvedSamplesPath = samplesPath ? path.resolve(samplesPath) : '';
      const relativeSamplesPath = resolvedSamplesPath
        ? path.relative(path.dirname(resolvedMetricsFile), resolvedSamplesPath)
        : '';
      if (
        parsed?.schema_version !== 'qbot-core-beta-performance-metrics/v1'
        || !String(parsed?.case_id || '').trim()
        || (String(expectedCaseId || '').trim() && parsed?.case_id !== expectedCaseId)
        || parsed?.valid !== true
        || parsed?.metric !== 'streaming_scroll_follow'
        || parsed?.source !== 'thread_scroll_samples'
        || !Number.isInteger(Number(parsed?.sample_count))
        || Number(parsed.sample_count) <= 0
        || !Number.isInteger(Number(parsed?.generating_sample_count))
        || Number(parsed.generating_sample_count) < 0
        || Number(parsed.generating_sample_count) > Number(parsed.sample_count)
        || !Number.isFinite(Number(parsed?.observation_duration_ms))
        || typeof parsed?.ever_generating !== 'boolean'
        || typeof parsed?.reproduced !== 'boolean'
        || typeof parsed?.overflow_observed !== 'boolean'
        || !Number.isFinite(Number(parsed?.max_distance_bottom_px))
        || !Number.isFinite(Number(parsed?.max_scroll_height_px))
        || !Number.isFinite(Number(parsed?.max_client_height_px))
        || !Number.isFinite(Number(parsed?.distance_threshold_px))
        || !Number.isFinite(Number(parsed?.consecutive_threshold))
        || !path.isAbsolute(samplesPath)
        || !relativeSamplesPath
        || relativeSamplesPath.startsWith('..')
        || path.isAbsolute(relativeSamplesPath)
        || !fs.existsSync(resolvedSamplesPath)
        || !fs.statSync(resolvedSamplesPath).isFile()
        || fs.statSync(resolvedSamplesPath).size <= 0
        || !/^[a-f0-9]{64}$/i.test(samplesSha256)
        || sha256File(resolvedSamplesPath) !== samplesSha256
      ) return { valid: false, error: 'performance_metrics_invalid' };
      let samplesPayload;
      try {
        samplesPayload = JSON.parse(fs.readFileSync(resolvedSamplesPath, 'utf8'));
      } catch {
        return { valid: false, error: 'performance_metrics_samples_invalid_json' };
      }
      if (!Array.isArray(samplesPayload?.samples)
        || samplesPayload.samples.length !== Number(parsed.sample_count)) {
        return { valid: false, error: 'performance_metrics_sample_count_mismatch' };
      }
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
  const terminalOutcome = String(parsed?.terminal_outcome || '');
  if (parsed?.complete === true) {
    return terminalOutcome === 'user_stopped'
      ? { valid: false, error: 'reply_user_stopped_cannot_be_complete' }
      : { valid: true };
  }
  if (terminalOutcome === 'user_stopped') {
    if (
      parsed?.evidence_complete !== true
      || parsed?.terminal_failure !== false
      || parsed?.completion_observed !== false
      || parsed?.confirmed_send_receipt !== true
      || parsed?.stop_click_performed !== true
      || parsed?.running_before !== true
      || parsed?.running_after !== false
      || parsed?.partial_reply_ready_before_click !== true
      || typeof parsed?.partial_preserved !== 'boolean'
      || typeof parsed?.assistant_reply_present !== 'boolean'
      || !String(parsed?.task_id || '').trim()
      || String(parsed?.task_id_before || '') !== String(parsed?.task_id || '')
      || String(parsed?.task_id_after || '') !== String(parsed?.task_id || '')
      || Number(parsed?.partial_chars_before_click || 0) <= 0
      || !Number.isInteger(Number(parsed?.retained_chars))
      || Number(parsed?.retained_chars) < 0
      || parsed?.assistant_reply_present !== (Number(parsed?.retained_chars) > 0)
      || !/^[a-f0-9]{64}$/i.test(String(parsed?.prompt_sha256 || ''))
      || String(parsed?.confirmed_send_prompt_sha256 || '') !== String(parsed?.prompt_sha256 || '')
      || !/^[a-f0-9]{64}$/i.test(String(parsed?.partial_sha256_before_click || ''))
      || !/^[a-f0-9]{64}$/i.test(String(parsed?.retained_sha256 || ''))
    ) {
      return { valid: false, error: 'reply_user_stopped_terminal_unverified' };
    }
    for (const prefix of ['before', 'after']) {
      const screenshot = String(parsed?.[`${prefix}_screenshot`] || '').trim();
      const screenshotSha256 = String(parsed?.[`${prefix}_screenshot_sha256`] || '').trim();
      if (
        !screenshot
        || !path.isAbsolute(screenshot)
        || !fs.existsSync(screenshot)
        || !fs.statSync(screenshot).isFile()
        || fs.statSync(screenshot).size < 128
      ) {
        return { valid: false, error: `reply_user_stopped_${prefix}_screenshot_missing` };
      }
      if (
        !/^[a-f0-9]{64}$/i.test(screenshotSha256)
        || sha256File(screenshot) !== screenshotSha256
      ) {
        return { valid: false, error: `reply_user_stopped_${prefix}_screenshot_sha256_mismatch` };
      }
    }
    return { valid: true };
  }
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
