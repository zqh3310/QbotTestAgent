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
