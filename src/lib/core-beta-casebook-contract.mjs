import { createHash } from 'node:crypto';

export const CORE_BETA_CASEBOOK_CONTRACT_VERSION = 'qbot-core-beta/v1';
export const CORE_BETA_AUTOMATION_PROTOCOL = 'core-beta-action-plan/v1';

export const CORE_BETA_CASE_TYPES = Object.freeze([
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
]);

export const CORE_BETA_EVIDENCE_ROLES = Object.freeze([
  'before_screenshot',
  'action_receipt',
  'after_screenshot',
  'public_state_readback',
  'prompt',
  'task_id',
  'send_receipt',
  'transcript',
  'reply_delta',
  'reply_completion',
  'capability_inventory',
  'capability_selection',
  'capability_execution_event',
  'attachment_name_size_sha256',
  'composer_attachment_state',
  'attachment_readback',
  'artifact_path_sha256',
  'artifact_content_readback',
  'artifact_preview',
  'cleanup_readback',
]);

const CASE_TYPE_REQUIREMENTS = Object.freeze({
  run_initialization: ['before_screenshot', 'action_receipt', 'after_screenshot', 'public_state_readback', 'cleanup_readback'],
  conversation: ['prompt', 'task_id', 'send_receipt', 'transcript', 'reply_delta', 'reply_completion'],
  attachment: [
    'prompt',
    'task_id',
    'send_receipt',
    'transcript',
    'reply_delta',
    'reply_completion',
    'attachment_name_size_sha256',
    'composer_attachment_state',
    'attachment_readback',
  ],
  artifact: [
    'prompt',
    'task_id',
    'send_receipt',
    'transcript',
    'reply_delta',
    'reply_completion',
    'artifact_path_sha256',
    'artifact_content_readback',
    'artifact_preview',
  ],
  skill_lifecycle: ['capability_inventory', 'capability_selection', 'action_receipt', 'public_state_readback', 'cleanup_readback'],
  skill_use: [
    'prompt',
    'task_id',
    'send_receipt',
    'transcript',
    'reply_delta',
    'reply_completion',
    'capability_selection',
    'capability_execution_event',
  ],
  expert_lifecycle: ['capability_inventory', 'capability_selection', 'action_receipt', 'public_state_readback', 'cleanup_readback'],
  expert_use: [
    'prompt',
    'task_id',
    'send_receipt',
    'transcript',
    'reply_delta',
    'reply_completion',
    'capability_selection',
    'capability_execution_event',
  ],
  mcp_lifecycle: ['capability_inventory', 'capability_selection', 'action_receipt', 'public_state_readback', 'cleanup_readback'],
  mcp_use: [
    'prompt',
    'task_id',
    'send_receipt',
    'transcript',
    'reply_delta',
    'reply_completion',
    'capability_selection',
    'capability_execution_event',
  ],
  recovery: [
    'before_screenshot',
    'action_receipt',
    'after_screenshot',
    'public_state_readback',
    'task_id',
    'transcript',
  ],
});

const CONVERSATION_CASE_TYPES = new Set([
  'conversation',
  'attachment',
  'artifact',
  'skill_use',
  'expert_use',
  'mcp_use',
]);

function normalizedList(value) {
  return [...new Set(
    (Array.isArray(value) ? value : String(value || '').split(/[,，;；|\n]+/))
      .map((item) => String(item || '').trim())
      .filter(Boolean),
  )];
}

function parseJsonField(value, field, errors, { fallback = null } = {}) {
  if (value && typeof value === 'object') return value;
  const text = String(value || '').trim();
  if (!text) return fallback;
  try {
    return JSON.parse(text);
  } catch (error) {
    errors.push(`${field} 不是合法 JSON：${error.message}`);
    return fallback;
  }
}

function numberedSteps(value) {
  return String(value || '')
    .split(/\r?\n/)
    .map((line) => line.match(/^\s*(\d+)\s*[.、．)]\s*(.+?)\s*$/))
    .filter(Boolean)
    .map((match) => ({ number: Number(match[1]), text: match[2] }));
}

function validateActionPlan(testCase, actionPlan, errors) {
  if (!Array.isArray(actionPlan) || actionPlan.length === 0) {
    errors.push('action_plan_json 必须是非空数组。');
    return;
  }
  const declared = numberedSteps(testCase.steps);
  if (!declared.length) errors.push('自动化执行步骤必须使用 1. 2. 3. 编号。');
  if (declared.length !== actionPlan.length) {
    errors.push(`编号步骤数量(${declared.length})与 action_plan_json(${actionPlan.length})不一致。`);
  }
  const actionIds = new Set();
  for (const [index, item] of actionPlan.entries()) {
    if (!item || typeof item !== 'object') {
      errors.push(`action_plan_json[${index}] 必须是对象。`);
      continue;
    }
    const expectedNumber = index + 1;
    if (Number(item.number) !== expectedNumber) {
      errors.push(`action_plan_json[${index}].number 必须为 ${expectedNumber}。`);
    }
    const actionId = String(item.action_id || '').trim();
    if (!actionId) errors.push(`action_plan_json[${index}].action_id 不能为空。`);
    else if (actionIds.has(actionId)) errors.push(`action_id 重复：${actionId}`);
    else actionIds.add(actionId);
    if (!String(item.command || '').trim()) errors.push(`action_plan_json[${index}].command 不能为空。`);
    if (!String(item.expected_state || '').trim()) errors.push(`action_plan_json[${index}].expected_state 不能为空。`);
    const roles = normalizedList(item.evidence_roles);
    for (const role of ['before_screenshot', 'action_receipt', 'after_screenshot']) {
      if (!roles.includes(role)) errors.push(`action_plan_json[${index}] 缺少动作证据 ${role}。`);
    }
    if (declared[index] && String(item.declared_step || '').trim() !== declared[index].text) {
      errors.push(`action_plan_json[${index}].declared_step 必须逐字等于编号步骤。`);
    }
  }
}

function validateTurns(caseType, turns, errors) {
  if (!CONVERSATION_CASE_TYPES.has(caseType)) return;
  if (!Array.isArray(turns) || turns.length === 0) {
    errors.push(`${caseType} 必须声明非空 turns_json。`);
    return;
  }
  if (caseType === 'mcp_use' && (turns.length < 2 || turns.length > 3)) {
    errors.push('mcp_use 必须执行 2-3 轮会话。');
  }
  for (const [index, turn] of turns.entries()) {
    if (!String(turn?.prompt || '').trim()) errors.push(`turns_json[${index}].prompt 不能为空。`);
    if (!String(turn?.oracle || '').trim()) errors.push(`turns_json[${index}].oracle 不能为空。`);
    if (!Array.isArray(turn?.must_include) && !Array.isArray(turn?.must_not_include)) {
      errors.push(`turns_json[${index}] 至少声明 must_include 或 must_not_include 数组。`);
    }
  }
}

function validateCapabilityPolicy(caseType, policy, errors) {
  if (!/^(?:skill|expert|mcp)_/.test(caseType)) return;
  if (!policy || typeof policy !== 'object') {
    errors.push(`${caseType} 必须声明 capability_policy_json。`);
    return;
  }
  if (!String(policy.selection_source || '').trim()) {
    errors.push('capability_policy_json.selection_source 不能为空。');
  }
  if (!String(policy.stable_identity_field || '').trim()) {
    errors.push('capability_policy_json.stable_identity_field 不能为空。');
  }
  if (caseType === 'skill_lifecycle' && policy.operation === 'sample_install') {
    if (Number(policy.install_count) !== 10) errors.push('skill_lifecycle.install_count 必须为 10。');
    if (Number(policy.deep_use_count) !== 5) errors.push('skill_lifecycle.deep_use_count 必须为 5。');
  }
  if (caseType === 'expert_lifecycle' && policy.operation === 'create_batch' && Number(policy.create_count) !== 3) {
    errors.push('expert_lifecycle.create_count 必须为 3。');
  }
  if (caseType === 'mcp_lifecycle' && policy.operation === 'sample_select' && Number(policy.select_count) !== 5) {
    errors.push('mcp_lifecycle.select_count 必须为 5。');
  }
}

export function validateCoreBetaCase(testCase = {}) {
  const errors = [];
  const warnings = [];
  const id = String(testCase.id || '').trim();
  const caseType = String(testCase.case_type || '').trim();
  if (!id) errors.push('用例ID不能为空。');
  if (String(testCase.contract_version || '') !== CORE_BETA_CASEBOOK_CONTRACT_VERSION) {
    errors.push(`契约版本必须为 ${CORE_BETA_CASEBOOK_CONTRACT_VERSION}。`);
  }
  if (String(testCase.automation_protocol || '') !== CORE_BETA_AUTOMATION_PROTOCOL) {
    errors.push(`自动化协议必须为 ${CORE_BETA_AUTOMATION_PROTOCOL}。`);
  }
  if (!CORE_BETA_CASE_TYPES.includes(caseType)) {
    errors.push(`不支持的 case_type：${caseType || 'empty'}`);
  }

  const requiredEvidenceRoles = normalizedList(testCase.required_evidence_roles || testCase.evidence_required);
  const unknownRoles = requiredEvidenceRoles.filter((role) => !CORE_BETA_EVIDENCE_ROLES.includes(role));
  if (unknownRoles.length) errors.push(`未知证据角色：${unknownRoles.join(',')}`);
  for (const role of CASE_TYPE_REQUIREMENTS[caseType] || []) {
    if (!requiredEvidenceRoles.includes(role)) errors.push(`${caseType} 缺少必需证据角色 ${role}。`);
  }

  const actionPlan = parseJsonField(testCase.action_plan_json, 'action_plan_json', errors, { fallback: [] });
  const turns = parseJsonField(testCase.turns_json, 'turns_json', errors, { fallback: [] });
  const capabilityPolicy = parseJsonField(
    testCase.capability_policy_json,
    'capability_policy_json',
    errors,
    { fallback: null },
  );
  const assertionContract = parseJsonField(
    testCase.assertion_contract_json,
    'assertion_contract_json',
    errors,
    { fallback: null },
  );
  validateActionPlan(testCase, actionPlan, errors);
  validateTurns(caseType, turns, errors);
  validateCapabilityPolicy(caseType, capabilityPolicy, errors);
  if (!assertionContract || typeof assertionContract !== 'object') {
    errors.push('assertion_contract_json 必须是对象。');
  } else {
    if (!String(assertionContract.pass_rule || '').trim()) errors.push('assertion_contract_json.pass_rule 不能为空。');
    if (!String(assertionContract.fail_rule || '').trim()) errors.push('assertion_contract_json.fail_rule 不能为空。');
    if (!String(assertionContract.block_rule || '').trim()) errors.push('assertion_contract_json.block_rule 不能为空。');
  }
  if (!String(testCase.cleanup_policy || '').trim()) errors.push('清理策略不能为空。');
  if (!String(testCase.initialization_profile || '').trim()) errors.push('初始化策略不能为空。');
  if (!String(testCase.pipeline_policy || '').trim()) warnings.push('未声明流水线策略，将默认串行。');

  return {
    schema_version: 1,
    id,
    case_type: caseType,
    ok: errors.length === 0,
    errors,
    warnings,
    parsed: {
      required_evidence_roles: requiredEvidenceRoles,
      action_plan: actionPlan,
      turns,
      capability_policy: capabilityPolicy,
      assertion_contract: assertionContract,
    },
  };
}

export function validateCoreBetaCasebook(cases = [], {
  expectedCount = 48,
  maxBatchSize = 20,
} = {}) {
  const errors = [];
  const warnings = [];
  const ids = cases.map((item) => String(item?.id || '').trim()).filter(Boolean);
  if (expectedCount > 0 && cases.length !== expectedCount) {
    errors.push(`核心内测 Casebook 必须为 ${expectedCount} 条，实际 ${cases.length} 条。`);
  }
  if (new Set(ids).size !== ids.length) errors.push('核心内测 Casebook 存在重复用例ID。');
  const audits = cases.map((item) => validateCoreBetaCase(item));
  for (const audit of audits) {
    for (const error of audit.errors) errors.push(`${audit.id || 'unknown'}: ${error}`);
    for (const warning of audit.warnings) warnings.push(`${audit.id || 'unknown'}: ${warning}`);
  }
  const initializationCases = audits.filter((item) => item.case_type === 'run_initialization');
  if (!initializationCases.length) errors.push('缺少 run_initialization 用例。');
  const types = new Set(audits.map((item) => item.case_type));
  for (const type of ['conversation', 'attachment', 'artifact', 'skill_lifecycle', 'skill_use', 'expert_lifecycle', 'expert_use', 'mcp_lifecycle', 'mcp_use']) {
    if (!types.has(type)) errors.push(`缺少核心用例类型 ${type}。`);
  }
  for (const testCase of cases) {
    const configured = Number(testCase.batch_size || 0);
    if (configured && (!Number.isInteger(configured) || configured < 1 || configured > maxBatchSize)) {
      errors.push(`${testCase.id}: batch_size 必须为 1-${maxBatchSize} 的整数。`);
    }
  }
  return {
    schema_version: 1,
    ok: errors.length === 0,
    expected_count: expectedCount,
    case_count: cases.length,
    unique_case_count: new Set(ids).size,
    type_counts: Object.fromEntries(CORE_BETA_CASE_TYPES.map((type) => [
      type,
      audits.filter((item) => item.case_type === type).length,
    ])),
    errors,
    warnings,
    cases: audits,
  };
}

function stableItemId(item, stableIdentityField) {
  if (typeof item === 'string') return item;
  return String(item?.[stableIdentityField] || item?.id || item?.key || item?.slug || '').trim();
}

export function deterministicCapabilitySample(items = [], {
  count,
  seed,
  stableIdentityField = 'id',
  stratumField = 'category',
  eligible = () => true,
} = {}) {
  const requestedCount = Number(count || 0);
  if (!Number.isInteger(requestedCount) || requestedCount < 1) {
    throw new Error('count must be a positive integer.');
  }
  const normalized = items
    .filter((item) => eligible(item))
    .map((item) => ({
      item,
      id: stableItemId(item, stableIdentityField),
      stratum: String(item?.[stratumField] || 'unclassified'),
    }))
    .filter((item) => item.id)
    .sort((a, b) => a.id.localeCompare(b.id));
  const unique = normalized.filter((entry, index, all) => all.findIndex((item) => item.id === entry.id) === index);
  if (unique.length < requestedCount) {
    return {
      ok: false,
      reason: `可用能力不足：需要 ${requestedCount}，实际 ${unique.length}`,
      requested_count: requestedCount,
      eligible_count: unique.length,
      selected: [],
      selected_ids: [],
    };
  }
  const hashRank = (entry) => createHash('sha256')
    .update(`${seed || ''}\0${entry.stratum}\0${entry.id}`)
    .digest('hex');
  const byStratum = new Map();
  for (const entry of unique) {
    if (!byStratum.has(entry.stratum)) byStratum.set(entry.stratum, []);
    byStratum.get(entry.stratum).push(entry);
  }
  for (const entries of byStratum.values()) entries.sort((a, b) => hashRank(a).localeCompare(hashRank(b)));
  const strata = [...byStratum.keys()].sort();
  const selected = [];
  while (selected.length < requestedCount) {
    let progressed = false;
    for (const stratum of strata) {
      const next = byStratum.get(stratum)?.shift();
      if (!next) continue;
      selected.push(next);
      progressed = true;
      if (selected.length === requestedCount) break;
    }
    if (!progressed) break;
  }
  return {
    ok: selected.length === requestedCount,
    requested_count: requestedCount,
    eligible_count: unique.length,
    seed: String(seed || ''),
    selected: selected.map((entry) => entry.item),
    selected_ids: selected.map((entry) => entry.id),
    strata: selected.map((entry) => entry.stratum),
  };
}

export function validateActionEvidence(action = {}) {
  const reasons = [];
  if (!String(action.action_id || '').trim()) reasons.push('missing action_id');
  if (!String(action.before_screenshot || '').trim()) reasons.push('missing before_screenshot');
  if (!String(action.after_screenshot || '').trim()) reasons.push('missing after_screenshot');
  if (!action.receipt || typeof action.receipt !== 'object') reasons.push('missing action_receipt');
  else {
    if (!String(action.receipt.selector || action.receipt.testid || '').trim()) reasons.push('action_receipt missing selector/testid');
    if (!String(action.receipt.event || '').trim()) reasons.push('action_receipt missing event');
    if (!action.receipt.dispatched_at) reasons.push('action_receipt missing dispatched_at');
  }
  const readback = action.state_readback;
  if (!readback || typeof readback !== 'object') reasons.push('missing state_readback');
  else if (readback.changed !== true && readback.expected_state_observed !== true) reasons.push('no relevant state transition observed');
  return { ok: reasons.length === 0, reasons };
}

export function validateReplyEvidence(reply = {}) {
  const reasons = [];
  if (!String(reply.prompt || '').trim()) reasons.push('missing prompt');
  if (!String(reply.task_id || '').trim()) reasons.push('missing task_id');
  if (!reply.send_receipt || typeof reply.send_receipt !== 'object') reasons.push('missing send_receipt');
  if (!String(reply.transcript || '').trim()) reasons.push('missing transcript');
  if (!String(reply.reply_delta || '').trim()) reasons.push('missing reply_delta');
  if (String(reply.status || '').toLowerCase() !== 'completed') reasons.push(`reply status is ${reply.status || 'empty'}`);
  if (reply.incomplete === true) reasons.push('reply marked incomplete');
  if (Number(reply.stable_sample_count || 0) < 2) reasons.push('reply stability not proven by at least two samples');
  if (reply.running === true) reasons.push('reply still running');
  return { ok: reasons.length === 0, reasons };
}

export function validateSkillExecutionEvidence(evidence = {}) {
  const reasons = [];
  const selected = normalizedList(evidence.selected_skill_ids);
  const events = Array.isArray(evidence.execution_events) ? evidence.execution_events : [];
  if (!selected.length) reasons.push('no selected skill id');
  for (const id of selected) {
    const matching = events.find((event) => (
      String(event?.skill_id || event?.slug || '') === id
      && String(event?.task_id || '') === String(evidence.task_id || '')
      && /^(?:started|completed|failed)$/.test(String(event?.status || ''))
    ));
    if (!matching) reasons.push(`missing task-bound execution event for skill ${id}`);
  }
  return { ok: reasons.length === 0, reasons };
}

export function validateExpertExecutionEvidence(evidence = {}) {
  const reasons = [];
  const expertId = String(evidence.expert_id || '').trim();
  if (!expertId) reasons.push('missing expert_id');
  if (String(evidence.current_expert_id || '').trim() !== expertId) reasons.push('current expert identity mismatch');
  if (String(evidence.task_id || '').trim() === '') reasons.push('missing task_id');
  if (!evidence.create_receipt && evidence.created_in_case) reasons.push('missing expert create receipt');
  if (!Array.isArray(evidence.execution_events) || !evidence.execution_events.some((event) => (
    String(event?.expert_id || '') === expertId
    && String(event?.task_id || '') === String(evidence.task_id || '')
  ))) reasons.push('missing task-bound expert execution event');
  return { ok: reasons.length === 0, reasons };
}

export function validateMcpExecutionEvidence(evidence = {}) {
  const reasons = [];
  const selected = normalizedList(evidence.selected_connector_keys);
  const calls = Array.isArray(evidence.tool_calls) ? evidence.tool_calls : [];
  if (!selected.length) reasons.push('no selected connector key');
  for (const key of selected) {
    const matching = calls.find((call) => (
      String(call?.connector_key || '') === key
      && String(call?.task_id || '') === String(evidence.task_id || '')
      && String(call?.tool_name || '').trim()
      && call?.response_present === true
    ));
    if (!matching) reasons.push(`missing task-bound MCP tool call and response for ${key}`);
  }
  return { ok: reasons.length === 0, reasons };
}
