import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const PROJECTION_SCHEMA = 'qbot-task-regenerate-projection/v1';
export const TASK_REGENERATE_TRANSITION_SCHEMA = 'qbot-task-regenerate-transition/v1';
export const TASK_REGENERATE_ACTION_RECEIPT_SCHEMA = 'qbot-task-regenerate-action-receipt/v1';
const TASK_REGENERATE_REOPENED_READBACK_SCHEMA = 'qbot-task-regenerate-reopened-readback/v1';
const TASK_REGENERATE_TRANSITION_WAIT_SCHEMA = 'qbot-task-regenerate-transition-wait/v1';

function sha256Json(value) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function normalizedText(value) {
  return String(value ?? '').replace(/\r\n/g, '\n').trim();
}

function normalizedMessage(message, index) {
  const role = message?.role === 'user' ? 'user' : 'assistant';
  const text = normalizedText(message?.text ?? message?.body_text);
  return {
    sequence: index + 1,
    dom_index: Number.isSafeInteger(message?.dom_index) ? message.dom_index : index,
    role,
    message_id: normalizedText(message?.message_id),
    visible: message?.visible !== false,
    text,
    body_text: role === 'assistant' ? normalizedText(message?.body_text ?? text) : text,
  };
}

function sequenceItem(message) {
  return {
    sequence: message.sequence,
    role: message.role,
    message_id: message.message_id,
    text: message.role === 'assistant' ? message.body_text : message.text,
  };
}

function branchCoordinates(value) {
  const match = normalizedText(value).match(/(?:^|\s)(\d+)\s*\/\s*(\d+)(?:\s|$)/u);
  if (!match) return { index: 1, count: 1 };
  const index = Number(match[1]);
  const count = Number(match[2]);
  return Number.isSafeInteger(index) && Number.isSafeInteger(count) && index > 0 && count >= index
    ? { index, count }
    : { index: null, count: null };
}

export function taskRegenerateProjection(input = {}) {
  const messages = (Array.isArray(input?.messages) ? input.messages : [])
    .map(normalizedMessage);
  const lastUserDomIndex = messages.reduce(
    (value, message) => message.role === 'user' ? message.dom_index : value,
    -1,
  );
  const userMessages = messages
    .filter((message) => message.role === 'user')
    .map(sequenceItem);
  const historyMessages = messages
    .filter((message) => lastUserDomIndex >= 0 && message.dom_index < lastUserDomIndex)
    .map(sequenceItem);
  const assistantNodes = messages
    .filter((message) => message.role === 'assistant' && message.dom_index > lastUserDomIndex)
    .map((message) => ({
      sequence: message.sequence,
      role: message.role,
      message_id: message.message_id,
      body_text: message.body_text,
      visible: message.visible,
      body_sha256: sha256Json(message.body_text),
    }));
  const targetAssistant = assistantNodes.filter((message) => message.visible).at(-1)
    || assistantNodes.at(-1)
    || null;
  const branchText = normalizedText(input?.branch_text);
  const branch = branchCoordinates(branchText);
  const projection = {
    schema_version: PROJECTION_SCHEMA,
    stage: normalizedText(input?.stage),
    capture_sequence: Number.isSafeInteger(input?.capture_sequence)
      ? input.capture_sequence
      : null,
    captured_at: normalizedText(input?.captured_at),
    source: normalizedText(input?.source) || 'assistant-thread+qbot-e2e-state',
    task_id: normalizedText(input?.task_id),
    running: typeof input?.running === 'boolean' ? input.running : null,
    send_count: Number.isSafeInteger(input?.send_count) && input.send_count >= 0
      ? input.send_count
      : null,
    branch_text: branchText,
    branch_index: branch.index,
    branch_count: branch.count,
    generation_version: branch.index && branch.count ? `${branch.index}/${branch.count}` : '',
    messages,
    user_messages: userMessages,
    user_sequence_sha256: sha256Json(userMessages),
    history_messages: historyMessages,
    history_sequence_sha256: sha256Json(historyMessages),
    assistant_nodes: assistantNodes,
    target_assistant: targetAssistant,
    target_assistant_body_empty: Boolean(targetAssistant && targetAssistant.body_text === ''),
  };
  return {
    ...projection,
    projection_sha256: sha256Json(projection),
  };
}

function validTimestamp(value) {
  return typeof value === 'string' && value.trim() && Number.isFinite(Date.parse(value));
}

function projectionIntegrity(raw, expectedStage, expectedSequence) {
  const rebuilt = taskRegenerateProjection(raw);
  return Boolean(
    raw?.schema_version === PROJECTION_SCHEMA
    && raw?.stage === expectedStage
    && raw?.capture_sequence === expectedSequence
    && validTimestamp(raw?.captured_at)
    && raw?.source === rebuilt.source
    && raw?.task_id === rebuilt.task_id
    && raw?.running === rebuilt.running
    && raw?.send_count === rebuilt.send_count
    && raw?.branch_text === rebuilt.branch_text
    && raw?.branch_index === rebuilt.branch_index
    && raw?.branch_count === rebuilt.branch_count
    && raw?.generation_version === rebuilt.generation_version
    && JSON.stringify(raw?.messages) === JSON.stringify(rebuilt.messages)
    && JSON.stringify(raw?.user_messages) === JSON.stringify(rebuilt.user_messages)
    && raw?.user_sequence_sha256 === rebuilt.user_sequence_sha256
    && JSON.stringify(raw?.history_messages) === JSON.stringify(rebuilt.history_messages)
    && raw?.history_sequence_sha256 === rebuilt.history_sequence_sha256
    && JSON.stringify(raw?.assistant_nodes) === JSON.stringify(rebuilt.assistant_nodes)
    && JSON.stringify(raw?.target_assistant) === JSON.stringify(rebuilt.target_assistant)
    && raw?.target_assistant_body_empty === rebuilt.target_assistant_body_empty
    && raw?.projection_sha256 === rebuilt.projection_sha256
  );
}

function screenshotReceipt(value) {
  return {
    path: normalizedText(value?.path),
    bytes: Number.isSafeInteger(value?.bytes) ? value.bytes : null,
    sha256: normalizedText(value?.sha256).toLowerCase(),
  };
}

function screenshotReceiptShape(value) {
  return Boolean(
    value
    && pathIsAbsolute(value.path)
    && /\.(?:png|jpe?g|webp)$/iu.test(value.path)
    && Number.isSafeInteger(value.bytes)
    && value.bytes >= 128
    && /^[a-f0-9]{64}$/u.test(value.sha256),
  );
}

function pathIsAbsolute(value) {
  return /^(?:\/|[A-Za-z]:[\\/])/u.test(normalizedText(value));
}

function regenerateControlIdentity(value) {
  return {
    tag_name: normalizedText(value?.tag_name).toUpperCase(),
    role: normalizedText(value?.role).toLowerCase(),
    aria_label: normalizedText(value?.aria_label),
    title: normalizedText(value?.title),
    dom_id: normalizedText(value?.dom_id),
    test_id: normalizedText(value?.test_id),
    class_name: normalizedText(value?.class_name),
    owner_assistant_message_id: normalizedText(value?.owner_assistant_message_id),
    owner_dom_index: Number.isSafeInteger(value?.owner_dom_index) ? value.owner_dom_index : null,
  };
}

function regenerateActionState(value) {
  return {
    task_id: normalizedText(value?.task_id),
    running: typeof value?.running === 'boolean' ? value.running : null,
    send_count: Number.isSafeInteger(value?.send_count) && value.send_count >= 0
      ? value.send_count
      : null,
    assistant_message_id: normalizedText(value?.assistant_message_id),
    generation_version: normalizedText(value?.generation_version),
  };
}

function regenerateActionAttempt(value) {
  return {
    attempt: Number.isSafeInteger(value?.attempt) ? value.attempt : null,
    terminal_state: normalizedText(value?.terminal_state),
    clicked: value?.clicked === true,
    dispatched: value?.dispatched === true,
    clicked_at: normalizedText(value?.clicked_at),
    task_id: normalizedText(value?.task_id),
    before_assistant_message_id: normalizedText(value?.before_assistant_message_id),
    control: regenerateControlIdentity(value?.control),
    before_state: regenerateActionState(value?.before_state),
    after_state: regenerateActionState(value?.after_state),
    before_screenshot: screenshotReceipt(value?.before_screenshot),
    after_screenshot: screenshotReceipt(value?.after_screenshot),
  };
}

function regenerateActionReceipt(value, caseId) {
  const attempts = (Array.isArray(value?.attempts) ? value.attempts : []).map(regenerateActionAttempt);
  return {
    schema_version: TASK_REGENERATE_ACTION_RECEIPT_SCHEMA,
    case_id: normalizedText(caseId),
    task_id: normalizedText(value?.task_id),
    attempt_count: attempts.length,
    attempts,
  };
}

export function buildTaskRegenerateActionReceipt({ caseId = 'BETA-TASK-002', taskId = '', attempt = null } = {}) {
  return regenerateActionReceipt({ task_id: taskId, attempts: attempt ? [attempt] : [] }, caseId);
}

function actionReceiptIntegrity(value, caseId, before, immediate) {
  const receipt = regenerateActionReceipt(value, caseId);
  const attempt = receipt.attempts[0];
  const controlNamedRegenerate = attempt?.control?.aria_label === '重新生成'
    || attempt?.control?.title === '重新生成';
  return Boolean(
    value?.schema_version === TASK_REGENERATE_ACTION_RECEIPT_SCHEMA
    && value?.case_id === normalizedText(caseId)
    && JSON.stringify(value) === JSON.stringify(receipt)
    && receipt.task_id
    && receipt.attempt_count === 1
    && attempt?.attempt === 1
    && attempt?.terminal_state === 'dispatched'
    && attempt?.clicked === true
    && attempt?.dispatched === true
    && validTimestamp(attempt?.clicked_at)
    && attempt?.task_id === receipt.task_id
    && attempt?.before_assistant_message_id
    && attempt?.control?.tag_name === 'BUTTON'
    && ['button', ''].includes(attempt?.control?.role)
    && controlNamedRegenerate
    && attempt?.control?.owner_assistant_message_id === attempt.before_assistant_message_id
    && Number.isSafeInteger(attempt?.control?.owner_dom_index)
    && attempt.control.owner_dom_index >= 0
    && attempt.before_assistant_message_id === normalizedText(before?.target_assistant?.message_id)
    && JSON.stringify(attempt.before_state) === JSON.stringify(regenerateActionState({
      task_id: before?.task_id,
      running: before?.running,
      send_count: before?.send_count,
      assistant_message_id: before?.target_assistant?.message_id,
      generation_version: before?.generation_version,
    }))
    && JSON.stringify(attempt.after_state) === JSON.stringify(regenerateActionState({
      task_id: immediate?.task_id,
      running: immediate?.running,
      send_count: immediate?.send_count,
      assistant_message_id: immediate?.target_assistant?.message_id,
      generation_version: immediate?.generation_version,
    }))
    && screenshotReceiptShape(attempt?.before_screenshot)
    && screenshotReceiptShape(attempt?.after_screenshot)
    && attempt.before_screenshot.path !== attempt.after_screenshot.path
  );
}

function normalizedCaptureAttempts(value) {
  return (Array.isArray(value) ? value : []).map((item) => ({
    attempt: Number.isSafeInteger(item?.attempt) ? item.attempt : null,
    projection: taskRegenerateProjection(item?.projection || {}),
  }));
}

function captureAttemptsIntegrity(raw, normalized, immediateProjection, clickedAt) {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length !== normalized.length) return false;
  const clickedTime = Date.parse(clickedAt || '');
  let previousTime = clickedTime;
  for (let index = 0; index < raw.length; index += 1) {
    const item = raw[index];
    const captureTime = Date.parse(item?.projection?.captured_at || '');
    if (item?.attempt !== index + 1
      || normalized[index]?.attempt !== index + 1
      || !projectionIntegrity(item?.projection, 'immediate_projection', 2)
      || !Number.isFinite(captureTime)
      || captureTime < previousTime) return false;
    previousTime = captureTime;
  }
  return JSON.stringify(normalized.at(-1)?.projection) === JSON.stringify(immediateProjection);
}

function normalizedTransitionWait(value) {
  return {
    schema_version: TASK_REGENERATE_TRANSITION_WAIT_SCHEMA,
    captured_at: normalizedText(value?.captured_at),
    started: typeof value?.started === 'boolean' ? value.started : null,
    idle: typeof value?.idle === 'boolean' ? value.idle : null,
    elapsed_ms: Number.isSafeInteger(value?.elapsed_ms) && value.elapsed_ms >= 0
      ? value.elapsed_ms
      : null,
    state: {
      active_id: normalizedText(value?.state?.active_id ?? value?.state?.activeId),
      running: typeof value?.state?.running === 'boolean' ? value.state.running : null,
      send_count: Number.isSafeInteger(value?.state?.send_count ?? value?.state?.sendCount)
        ? Number(value.state.send_count ?? value.state.sendCount)
        : null,
    },
    reason: normalizedText(value?.reason),
  };
}

function transitionWaitIntegrity(raw, normalized) {
  const expectedReason = normalized.started && normalized.idle
    ? 'started_then_idle'
    : (!normalized.started && normalized.idle
      ? 'immediate_projection_not_observed_before_idle'
      : 'wait_timeout');
  return Boolean(
    raw?.schema_version === TASK_REGENERATE_TRANSITION_WAIT_SCHEMA
    && JSON.stringify(raw) === JSON.stringify(normalized)
    && validTimestamp(normalized.captured_at)
    && typeof normalized.started === 'boolean'
    && typeof normalized.idle === 'boolean'
    && Number.isSafeInteger(normalized.elapsed_ms)
    && normalized.state.active_id
    && typeof normalized.state.running === 'boolean'
    && (normalized.state.send_count == null
      || (Number.isSafeInteger(normalized.state.send_count) && normalized.state.send_count >= 0))
    && normalized.reason === expectedReason
  );
}

function normalizedReopenedReadback(value) {
  return {
    schema_version: TASK_REGENERATE_REOPENED_READBACK_SCHEMA,
    captured_at: normalizedText(value?.captured_at),
    requested_task_id: normalizedText(value?.requested_task_id),
    ok: typeof value?.ok === 'boolean' ? value.ok : null,
    active_id: normalizedText(value?.active_id ?? value?.activeId),
    running: typeof value?.running === 'boolean' ? value.running : null,
    text: normalizedText(value?.text),
    target_assistant_message_id: normalizedText(value?.target_assistant_message_id),
    target_assistant_body: normalizedText(value?.target_assistant_body),
    branch_index: Number.isSafeInteger(value?.branch_index) ? value.branch_index : null,
    branch_count: Number.isSafeInteger(value?.branch_count) ? value.branch_count : null,
    generation_version: normalizedText(value?.generation_version),
  };
}

function reopenedReadbackIntegrity(raw, normalized) {
  return Boolean(
    raw?.schema_version === TASK_REGENERATE_REOPENED_READBACK_SCHEMA
    && JSON.stringify(raw) === JSON.stringify(normalized)
    && validTimestamp(normalized.captured_at)
    && normalized.requested_task_id
    && typeof normalized.ok === 'boolean'
    && normalized.active_id
    && typeof normalized.running === 'boolean'
    && typeof normalized.text === 'string'
    && normalized.target_assistant_message_id
    && typeof normalized.target_assistant_body === 'string'
    && Number.isSafeInteger(normalized.branch_index)
    && normalized.branch_index > 0
    && Number.isSafeInteger(normalized.branch_count)
    && normalized.branch_count >= normalized.branch_index
    && normalized.generation_version === `${normalized.branch_index}/${normalized.branch_count}`
  );
}

function sameSequence(projections, key, hashKey) {
  const [first, ...rest] = projections;
  return Boolean(first && rest.every((projection) => (
    projection?.[hashKey] === first?.[hashKey]
    && JSON.stringify(projection?.[key]) === JSON.stringify(first?.[key])
  )));
}

export function taskRegenerateTransitionEvidence({
  caseId = 'BETA-TASK-002',
  legacyCaseId = 'SIT-TASK-REGEN-001',
  actionReceipt = null,
  before = null,
  immediateProjection = null,
  final = null,
  reopened = null,
  captureAttempts = [],
  transitionWait = null,
  reopenedReadback = null,
} = {}) {
  const projections = [before, immediateProjection, final, reopened];
  const rebuilt = projections.map((projection) => taskRegenerateProjection(projection || {}));
  const [normalizedBefore, normalizedImmediate, normalizedFinal, normalizedReopened] = rebuilt;
  const normalizedCaseId = normalizedText(caseId);
  const taskIds = rebuilt.map((projection) => normalizedText(projection?.task_id));
  const capturedTimes = projections.map((projection) => Date.parse(projection?.captured_at || ''));
  const normalizedActionReceipt = regenerateActionReceipt(actionReceipt, normalizedCaseId);
  const actionAttempt = normalizedActionReceipt.attempts[0] || null;
  const clickedTime = Date.parse(actionAttempt?.clicked_at || '');
  const transitionWaitTime = Date.parse(transitionWait?.captured_at || '');
  const reopenedReadbackTime = Date.parse(reopenedReadback?.captured_at || '');
  const normalizedAttempts = normalizedCaptureAttempts(captureAttempts);
  const normalizedWait = normalizedTransitionWait(transitionWait);
  const normalizedReadback = normalizedReopenedReadback(reopenedReadback);
  const assistantIds = rebuilt.map((projection) => normalizedText(projection?.target_assistant?.message_id));
  const generationVersions = rebuilt.map((projection) => normalizedText(projection?.generation_version));
  const evidenceChecks = {
    case_identity: normalizedCaseId === 'BETA-TASK-002'
      && normalizedText(legacyCaseId) === 'SIT-TASK-REGEN-001',
    action_receipt_integrity: actionReceiptIntegrity(
      actionReceipt,
      normalizedCaseId,
      normalizedBefore,
      normalizedImmediate,
    ),
    before_projection_integrity: projectionIntegrity(before, 'before', 1),
    immediate_projection_integrity: projectionIntegrity(immediateProjection, 'immediate_projection', 2),
    final_projection_integrity: projectionIntegrity(final, 'final', 3),
    reopened_projection_integrity: projectionIntegrity(reopened, 'reopened', 4),
    capture_attempts_integrity: captureAttemptsIntegrity(
      captureAttempts,
      normalizedAttempts,
      normalizedImmediate,
      actionAttempt?.clicked_at,
    ),
    transition_wait_integrity: transitionWaitIntegrity(transitionWait, normalizedWait),
    reopened_readback_integrity: reopenedReadbackIntegrity(reopenedReadback, normalizedReadback),
    assistant_identities_captured: assistantIds.every(Boolean),
    generation_versions_captured: generationVersions.every(Boolean)
      && rebuilt.every((projection) => Number.isSafeInteger(projection.branch_index)
        && projection.branch_index > 0
        && Number.isSafeInteger(projection.branch_count)
        && projection.branch_count >= projection.branch_index),
    capture_order: capturedTimes.every(Number.isFinite)
      && capturedTimes[0] <= clickedTime
      && clickedTime <= capturedTimes[1]
      && capturedTimes[1] <= transitionWaitTime
      && transitionWaitTime <= capturedTimes[2]
      && capturedTimes[2] <= capturedTimes[3]
      && capturedTimes[3] <= reopenedReadbackTime,
    task_ids_captured: taskIds.every(Boolean),
  };
  const evidenceValid = Object.values(evidenceChecks).every(Boolean);
  const firstBody = normalizedText(normalizedBefore?.target_assistant?.body_text);
  const secondBody = normalizedText(normalizedFinal?.target_assistant?.body_text);
  const reopenedBody = normalizedText(normalizedReopened?.target_assistant?.body_text);
  const newAssistantId = assistantIds[1] || '';
  const newGenerationVersion = generationVersions[1] || '';
  const oracleChecks = {
    same_nonempty_task_id: Boolean(taskIds[0]) && taskIds.every((taskId) => taskId === taskIds[0])
      && normalizedActionReceipt.task_id === taskIds[0],
    user_sequence_preserved: sameSequence(rebuilt, 'user_messages', 'user_sequence_sha256'),
    historical_messages_preserved: sameSequence(rebuilt, 'history_messages', 'history_sequence_sha256'),
    immediate_running_empty_assistant: Boolean(
      immediateProjection?.running === true
      && immediateProjection?.target_assistant
      && immediateProjection.target_assistant.visible === true
      && immediateProjection?.target_assistant_body_empty === true
      && normalizedText(immediateProjection?.target_assistant?.body_text) === ''
    ),
    replacement_assistant_identity_stable: Boolean(
      assistantIds[0]
      && newAssistantId
      && newAssistantId !== assistantIds[0]
      && assistantIds[2] === newAssistantId
      && assistantIds[3] === newAssistantId
    ),
    generation_version_advanced_and_stable: Boolean(
      normalizedImmediate.branch_count > normalizedBefore.branch_count
      && normalizedImmediate.branch_index > normalizedBefore.branch_index
      && generationVersions[2] === newGenerationVersion
      && generationVersions[3] === newGenerationVersion
    ),
    transition_started_and_idle: Boolean(
      normalizedWait.started === true
      && normalizedWait.idle === true
      && normalizedWait.state.active_id === taskIds[0]
      && normalizedWait.state.running === false
    ),
    first_version_nonempty: Boolean(firstBody),
    regeneration_transition_observed: normalizedImmediate.branch_count > normalizedBefore.branch_count,
    final_second_version_complete: Boolean(secondBody) && normalizedFinal.running === false,
    second_version_differs_from_first: Boolean(firstBody && secondBody && secondBody !== firstBody),
    reopened_second_version_stable: Boolean(
      reopenedBody
      && normalizedReopened.running === false
      && reopenedBody === secondBody
      && reopenedBody !== firstBody
    ),
    reopened_readback_bound: Boolean(
      normalizedReadback.ok === true
      && normalizedReadback.requested_task_id === taskIds[0]
      && normalizedReadback.active_id === taskIds[0]
      && normalizedReadback.running === false
      && normalizedReadback.target_assistant_message_id === assistantIds[3]
      && normalizedReadback.target_assistant_body === reopenedBody
      && normalizedReadback.text.includes(reopenedBody)
      && normalizedReadback.branch_index === normalizedReopened.branch_index
      && normalizedReadback.branch_count === normalizedReopened.branch_count
      && normalizedReadback.generation_version === normalizedReopened.generation_version
      && normalizedReadback.target_assistant_body === secondBody
    ),
  };
  const oracleValid = evidenceValid && Object.values(oracleChecks).every(Boolean);
  const evidenceFailures = Object.entries(evidenceChecks).filter(([, ok]) => !ok).map(([name]) => name);
  const oracleFailures = Object.entries(oracleChecks).filter(([, ok]) => !ok).map(([name]) => name);
  return {
    schema_version: TASK_REGENERATE_TRANSITION_SCHEMA,
    case_id: normalizedCaseId,
    legacy_case_id: normalizedText(legacyCaseId),
    task_id: taskIds[0] || '',
    click_count: normalizedActionReceipt.attempts.filter((attempt) => attempt.clicked && attempt.dispatched).length,
    clicked_at: actionAttempt?.clicked_at || '',
    evidence_valid: evidenceValid,
    oracle_valid: oracleValid,
    outcome: evidenceValid ? (oracleValid ? 'pass' : 'bug') : 'automation_error',
    reason: evidenceFailures[0] || oracleFailures[0] || 'task_regenerate_transition_complete',
    evidence_checks: evidenceChecks,
    oracle_checks: oracleChecks,
    evidence_failures: evidenceFailures,
    oracle_failures: oracleFailures,
    action_receipt: normalizedActionReceipt,
    before: normalizedBefore,
    immediate_projection: normalizedImmediate,
    final: normalizedFinal,
    reopened: normalizedReopened,
    capture_attempts: normalizedAttempts,
    transition_wait: normalizedWait,
    reopened_readback: normalizedReadback,
  };
}

export function taskRegenerateScreenshotReceipt(file) {
  const resolved = path.resolve(String(file || ''));
  const stats = fs.lstatSync(resolved);
  return {
    path: resolved,
    bytes: stats.size,
    sha256: createHash('sha256').update(fs.readFileSync(resolved)).digest('hex'),
  };
}

export async function captureTaskRegenerateControlIdentity(control) {
  return control.evaluate((element) => {
    const owner = element.closest('[data-role="assistant"]');
    const thread = element.closest('[data-testid="assistant-thread"]') || document;
    const messages = Array.from(thread.querySelectorAll('[data-role="user"], [data-role="assistant"]'));
    const value = (name) => String(element.getAttribute(name) || '');
    const ownerMessageId = owner
      ? ['data-message-id', 'data-id', 'data-message-key', 'id']
        .map((name) => owner.getAttribute(name))
        .find((item) => String(item || '').trim()) || ''
      : '';
    return {
      tag_name: String(element.tagName || ''),
      role: value('role'),
      aria_label: value('aria-label'),
      title: value('title'),
      dom_id: value('id'),
      test_id: value('data-testid'),
      class_name: typeof element.className === 'string' ? element.className : '',
      owner_assistant_message_id: String(ownerMessageId),
      owner_dom_index: owner ? messages.indexOf(owner) : -1,
    };
  });
}

export async function captureTaskRegenerateProjection(page, { stage, captureSequence } = {}) {
  const raw = await page.evaluate(async () => {
    const e2e = window.__qbotE2E || window.__deepbankE2E;
    const state = typeof e2e?.state === 'function' ? await e2e.state() : null;
    const current = typeof e2e?.currentSession === 'function'
      ? await e2e.currentSession().catch(() => null)
      : null;
    const root = document.querySelector('[data-testid="assistant-thread"]');
    const nodes = Array.from(root?.querySelectorAll('[data-role="user"], [data-role="assistant"]') || []);
    const excluded = '[data-slot="aui_chain-of-thought"], [data-slot="aui_reasoning"], [data-slot^="reasoning-"], [data-slot="aui_thinking-progress"], .aui-reasoning-root, .aui-reasoning-cot, .aui-reasoning-cli, .aui-tool-flat, [data-slot^="aui_tool"], button, [role="button"], [data-testid*="toolbar"], [data-testid*="action"], [data-testid*="composer"], .ctools, .ctool-menu, .ctool-pop, .message-actions, .aui-message-actions';
    const visible = (node) => {
      const style = window.getComputedStyle(node);
      const rect = node.getBoundingClientRect();
      return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
    };
    const contentText = (node, role) => {
      const selector = role === 'user'
        ? '.aui-user-message-content, [data-testid="user-message-content"], .user-message-content'
        : '.aui-assistant-message-content, [data-testid="assistant-message-content"], .assistant-message-content';
      const content = node.querySelector(selector) || node;
      if (role === 'assistant') {
        const bodyNodes = Array.from(content.querySelectorAll('.aui-cli-line > .aui-cli-body'))
          .filter((element) => !element.closest(excluded));
        if (bodyNodes.length) return bodyNodes.map((element) => String(element.innerText || element.textContent || '')).join('\n');
        const clone = content.cloneNode(true);
        clone.querySelectorAll(excluded).forEach((element) => element.remove());
        return String(clone.innerText || clone.textContent || '');
      }
      return String(content.innerText || content.textContent || '');
    };
    const messages = nodes.map((node, index) => {
      const role = node.getAttribute('data-role') === 'user' ? 'user' : 'assistant';
      const messageId = ['data-message-id', 'data-id', 'data-message-key', 'id']
        .map((name) => node.getAttribute(name))
        .find((value) => String(value || '').trim()) || '';
      const text = contentText(node, role);
      return {
        dom_index: index,
        role,
        message_id: String(messageId),
        visible: visible(node),
        text,
        body_text: role === 'assistant' ? text : undefined,
      };
    });
    const branchText = Array.from(root?.querySelectorAll('.aui-branch-picker-state') || [])
      .filter(visible)
      .map((node) => String(node.innerText || node.textContent || '').trim())
      .at(-1) || '';
    return {
      task_id: String(state?.activeId || current?.id || ''),
      running: typeof state?.running === 'boolean'
        ? state.running
        : (typeof current?.running === 'boolean' ? current.running : null),
      send_count: Number.isSafeInteger(state?.sendCount)
        ? state.sendCount
        : (Number.isSafeInteger(current?.sendCount) ? current.sendCount : null),
      branch_text: branchText,
      messages,
    };
  });
  return taskRegenerateProjection({
    ...raw,
    stage,
    capture_sequence: captureSequence,
    captured_at: new Date().toISOString(),
  });
}
