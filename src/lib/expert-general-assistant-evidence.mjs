export function expertGeneralAssistantExecutionVerdict({
  selectionEvidenceValid = false,
  firstReplyEvidenceValid = false,
  firstTaskId = '',
  secondTaskId = '',
  secondReplyText = '',
  secondReplyIncomplete = false,
  firstReplyOracle = false,
  expertIdentityCleared = false,
  leakedExpertIdentity = false,
  generalIdentity = false,
} = {}) {
  const normalizedFirstTaskId = String(firstTaskId || '').trim();
  const normalizedSecondTaskId = String(secondTaskId || '').trim();
  const taskIdsPresent = Boolean(normalizedFirstTaskId && normalizedSecondTaskId);
  const sameTask = taskIdsPresent && normalizedSecondTaskId === normalizedFirstTaskId;
  const secondReplyEvidenceValid = Boolean(
    taskIdsPresent
    && String(secondReplyText || '').trim()
    && secondReplyIncomplete !== true
  );
  const evidenceValid = Boolean(
    selectionEvidenceValid === true
    && firstReplyEvidenceValid === true
    && secondReplyEvidenceValid
  );
  const oracleValid = Boolean(
    evidenceValid
    && firstReplyOracle === true
    && expertIdentityCleared === true
    && sameTask
    && leakedExpertIdentity !== true
    && generalIdentity === true
  );

  return {
    task_ids_present: taskIdsPresent,
    same_task: sameTask,
    second_reply_evidence_valid: secondReplyEvidenceValid,
    evidence_valid: evidenceValid,
    oracle_valid: oracleValid,
  };
}
