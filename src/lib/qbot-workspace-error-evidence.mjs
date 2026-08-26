function normalizePrompt(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function matchingUserPromptCount(snapshot = {}, expectedPrompt = '') {
  const expected = normalizePrompt(expectedPrompt);
  if (!expected) return 0;
  return (Array.isArray(snapshot?.userTexts) ? snapshot.userTexts : [])
    .filter((text) => normalizePrompt(text) === expected)
    .length;
}

export function workspaceRejectedSendReceiptEvidence({
  caseId = '',
  action = '',
  expectedPrompt = '',
  expectedTaskId = '',
  before = {},
  after = {},
  attempts = [],
  sendEvidence = {},
  retrySafe = false,
  terminalObservations = [],
} = {}) {
  const clickedAttempts = (Array.isArray(attempts) ? attempts : [])
    .filter((attempt) => attempt?.clicked === true);
  const expected = normalizePrompt(expectedPrompt);
  const taskId = String(expectedTaskId || '').trim();
  const observations = Array.isArray(terminalObservations) ? terminalObservations : [];
  const stableTail = observations.slice(-3);
  const stableSignature = String(stableTail[0]?.signature_sha256 || '');
  const checks = {
    case_bound: Boolean(String(caseId || '').trim()),
    action_bound: Boolean(String(action || '').trim()),
    prompt_bound: Boolean(expected),
    prompt_present_before_click: normalizePrompt(before?.composer) === expected,
    one_click_dispatched: clickedAttempts.length === 1,
    send_not_confirmed: sendEvidence?.ok === false,
    no_new_expected_user: sendEvidence?.has_new_expected_user === false
      && matchingUserPromptCount(after, expected) === matchingUserPromptCount(before, expected),
    auxiliary_mutation_observed: sendEvidence?.auxiliary_evidence === true,
    retry_forbidden: retrySafe === false,
    existing_task_bound: Boolean(taskId),
    task_id_stable: Boolean(taskId)
      && String(before?.activeId || '') === taskId
      && String(after?.activeId || '') === taskId,
    terminal_not_running: after?.running === false,
    stable_terminal_readback: stableTail.length === 3
      && Boolean(stableSignature)
      && stableTail.every((observation) => (
        String(observation?.signature_sha256 || '') === stableSignature
        && String(observation?.task_id || '') === taskId
        && observation?.running === false
        && observation?.has_new_expected_user === false
      ))
      && Number(stableTail.at(-1)?.stable_observations || 0) >= 3,
  };
  const candidateValid = Object.entries(checks)
    .filter(([name]) => name !== 'stable_terminal_readback')
    .every(([, passed]) => passed === true);
  const evidenceValid = Object.values(checks).every(Boolean);
  return {
    schema_version: 'qbot-workspace-rejected-send-receipt/v1',
    valid: evidenceValid,
    evidence_valid: evidenceValid,
    candidate_valid: candidateValid,
    oracle_valid: false,
    outcome: evidenceValid ? 'product_rejected_before_user_message' : 'automation_error',
    accepted_by_product: false,
    retry_safe: retrySafe === true,
    case_id: String(caseId || ''),
    action: String(action || ''),
    prompt: String(expectedPrompt || ''),
    expected_task_id: taskId,
    checks,
    before_snapshot: before,
    after_snapshot: after,
    terminal_observations: observations,
  };
}

export function sendReceiptRecordEvidenceValid(receipt = {}) {
  const confirmed = Boolean(
    String(receipt?.confirmed_at || '')
    && Array.isArray(receipt?.attempts)
    && receipt.attempts.some((attempt) => attempt?.clicked === true && attempt?.receipt?.ok === true)
  );
  if (confirmed) return true;
  const terminal = receipt?.negative_terminal;
  return Boolean(
    !String(receipt?.confirmed_at || '')
    && String(receipt?.terminal_at || '')
    && terminal?.schema_version === 'qbot-workspace-rejected-send-receipt/v1'
    && terminal?.valid === true
    && terminal?.evidence_valid === true
    && terminal?.oracle_valid === false
    && terminal?.accepted_by_product === false
    && terminal?.retry_safe === false
    && terminal?.outcome === 'product_rejected_before_user_message'
    && terminal?.checks
    && Object.values(terminal.checks).every(Boolean)
  );
}

export function workspaceMissingErrorVerdict({ cwd = '', session = null, visibleText = '' } = {}) {
  const expectedCwd = String(cwd || '');
  const messages = Array.isArray(session?.messages) ? session.messages : [];
  const assistant = [...messages].reverse().find((message) => message?.role === 'assistant') || null;
  const notice = assistant?.userErrorNotice && typeof assistant.userErrorNotice === 'object'
    ? assistant.userErrorNotice
    : null;
  const text = String(visibleText || '');
  const errorCode = String(assistant?.errorCode || notice?.causeCode || '');
  const checks = {
    session_readable: Boolean(session && typeof session === 'object'),
    assistant_error_present: Boolean(assistant),
    workspace_error_code: errorCode === 'desktop_local_workspace_unavailable',
    notice_code: notice?.code === 'chat.workspace.cwd_missing',
    notice_cwd_exact: String(notice?.params?.cwd || '') === expectedCwd,
    notice_non_retryable: notice?.retryable === false,
    visible_cwd_exact: Boolean(expectedCwd) && text.includes(expectedCwd),
    visible_missing_reason: /不存在/.test(text),
    internal_fields_hidden: !/causeCode|desktop_local_workspace_unavailable|chat\.workspace\.cwd_missing|\bstack\b/i.test(text),
  };
  const evidenceValid = checks.session_readable
    && checks.assistant_error_present
    && Boolean(expectedCwd)
    && typeof visibleText === 'string';
  const oracleValid = evidenceValid && Object.values(checks).every(Boolean);
  return {
    schema_version: 'qbot-workspace-missing-error-readback/v1',
    valid: evidenceValid,
    evidence_valid: evidenceValid,
    oracle_valid: oracleValid,
    cwd: expectedCwd,
    task_id: String(session?.id || ''),
    checks,
    assistant: assistant ? {
      id: String(assistant.id || ''),
      role: String(assistant.role || ''),
      error: String(assistant.error || ''),
      errorCode: String(assistant.errorCode || ''),
      userErrorNotice: notice,
    } : null,
    visible_text: text,
  };
}
