import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { deflateSync } from 'node:zlib';
import {
  activateCoreBetaNativeImeHost,
  assistantClarificationEvidence,
  assistantConfirmationClickProgressVerdict,
  assistantConfirmationProgressFingerprintEvidence,
  assistantConfirmationSurfaceVerdict,
  applyFailureOutcome,
  applyBlockedOutcome,
  annotateCoreBetaExecutionResult,
  artifactTextHasFacts,
  automationFixtureMarkerPattern,
  attachmentReplyMissingEvidence,
  attachmentTaskPromptFromCase,
  assessUserCenteredOutcome,
  brokenAttachmentFabricationEvidence,
  buildCredibilityReview,
  buildFrameworkStopCredibilityDiagnostic,
  buildSingleHostPipelineBatch,
  buildSummary,
  buildConversationTurns,
  caseRequiresModelTier,
  caseAwareReplyAssertion,
  chooseCoreBetaConnectors,
  createControlPlaneFaultProxy,
  createConnectorRegressionServer,
  createSkillHubRegressionServer,
  countEnumeratedItems,
  coreBetaArtifactReadback,
  coreBetaPptxFunnelGeometryVerdict,
  coreBetaBatchTaskMarker,
  coreBetaBatchStopReason,
  coreBetaAttachmentFixtureContractVerdict,
  coreBetaAttachmentLimitsRecoveryVerdict,
  coreBetaAttachmentRejectionMatrixVerdict,
  coreBetaAttachmentRejectionProbeVerdict,
  coreBetaCleanupCapabilitiesNeedsRetry,
  coreBetaCapabilitiesReadbackWithRetry,
  coreBetaCleanupReadbackNeedsComposerRecovery,
  coreBetaCleanupReadbackVerdict,
  coreBetaCleanupReleaseMigrationVerdict,
  coreBetaCapabilityInteractionCategory,
  coreBetaCapabilityInventoryPrerequisite,
  coreBetaDirectConnectorListModeReady,
  coreBetaDirectSkillListReady,
  coreBetaComposerHistoryVerdict,
  coreBetaComposerIsolationReadback,
  coreBetaUnifiedDisabledCompatibilityReadback,
  coreBetaComposerResetFailureCategory,
  confirmedSendReceiptTaskId,
  coreBetaCompletionBlockReason,
  coreBetaConnectorCatalogEvidenceValid,
  coreBetaConnectorOptionTestId,
  coreBetaConversationTurnLabel,
  coreBetaExpertBuilderOutcomeEvidence,
  coreBetaExpertDraftConcurrencyIdentity,
  coreBetaExpertPublishPrerequisiteBlocker,
  coreBetaExpertSummonTaskVerdict,
  coreBetaExecutionConcurrencyPolicy,
  coreBetaEvidenceCaseId,
  enforceCoreBetaInitializationContinuationOutcome,
  coreBetaInitializationContinuation,
  coreBetaInitializationContinuationEvidenceVerdict,
  coreBetaInitializationContinuationVerdict,
  coreBetaInitializationMaintenanceObservationsVerdict,
  coreBetaInitializationSkillCatalogObservation,
  coreBetaInitializationSkillIdentity,
  coreBetaInitializationSkillReinstallEvidenceVerdict,
  coreBetaInitializationSkillReinstallVerdict,
  managedAttachmentDialogEvidenceVerdict,
  coreBetaMarkdownHtmlPreviewVerdict,
  coreBetaManualConnectorModeReady,
  coreBetaMixedFormatFixtureContents,
  coreBetaMcpCrossSurfaceOutcome,
  coreBetaMcpNormalizeInteraction,
  coreBetaMcpCrossSurfaceReceiptEvidenceValid,
  coreBetaMcpReleaseSelectionSeed,
  coreBetaMcpSelectionPrerequisiteBlocker,
  coreBetaModelMenuExpectedSnapshot,
  coreBetaModelMenuSdkFilterVerdict,
  coreBetaPartialReplyReady,
  coreBetaPreSendCapabilityFailureEvidence,
  coreBetaPreSendImeFailureEvidence,
  coreBetaNativeImeTraceVerdict,
  coreBetaStopControlRaceVerdict,
  coreBetaStopGenerationTimeoutVerdict,
  coreBetaStoppedTurnTerminalEvidence,
  coreBetaRuntimeExecutorBinding,
  coreBetaRuntimeFamilyPrerequisiteBlocker,
  coreBetaUnifiedSubmenuSurfaceReady,
  coreBetaQbotHomeFromUiUrl,
  coreBetaProductHomeForUi,
  coreBetaSkillInstallBatchAssessment,
  coreBetaSkillInstallPrerequisiteBlocker,
  coreBetaSkillPromptSource,
  coreBetaSkillPromptSourcePrerequisiteBlocker,
  coreBetaSkillCreatorCleanup,
  coreBetaSkillCreatorConversationCase,
  coreBetaSkillCreatorFixture,
  coreBetaSkillCreatorFixtureSlug,
  coreBetaSkillCreatorProjectionReadback,
  coreBetaSkillCreatorSelectionEvidence,
  coreBetaRunOwnedSkillCleanupVerdict,
  coreBetaSelectedCapabilityIdentities,
  coreBetaRunOwnedExpertPrerequisiteBlocker,
  coreBetaSkillUninstallRequestName,
  coreBetaSkillUsePrerequisiteDecision,
  coreBetaV2NeedsRendererReconnect,
  coreBetaV2MaintenanceActionObservation,
  coreBetaV2MaintenanceActiveSessionRejection,
  coreBetaV2MaintenanceConfirmationContract,
  coreBetaV2MaintenanceProductStateConflict,
  coreBetaV2RunningSessionQuiescenceVerdict,
  coreBetaV2RuntimeMaintenanceState,
  coreBetaV2RuntimeUpdateActivationRisk,
  coreBetaV2RuntimeUpdateSkipAction,
  coreBetaExpertBuilderReturnSelectorCandidates,
  coreBetaExpertCreateSubmitLabel,
  coreBetaV2ExpertCreationDismissAction,
  coreBetaV2ExpertCreationDismissLabel,
  coreBetaV2WorkspaceCreationDismissAction,
  qworkPartialAttachmentLogExcerpt,
  coreBetaV2SettingsLoadTimeoutMs,
  coreBetaV2SettingsSurfaceState,
  forbiddenMatchesForCase,
  inferQbotHomeForElectronRestart,
  inspectCoreBetaFixtureReadiness,
  isAttachmentPromptFidelityCase,
  isContinuedOldLoginAnswer,
  isTransientCredentialRotation,
  isSuccessfulSendStep,
  latestAssistantReplyForPrompt,
  memoryLifecycleVerdict,
  modelServiceStateEvidence,
  nativeDialogClosedOrAdvanced,
  nextTerminalNoReplyObservation,
  normalizeCoreBetaConnectorCatalogSnapshot,
  obviousDuplicateEvidence,
  probeConnectorRegressionFixture,
  parseSingleHostPipelineSize,
  partitionCasebookResults,
  prepareCoreBetaNativeImeFocus,
  preserveCoreBetaFailedCapabilityInteraction,
  rawArtifactEventLeakEvidence,
  replyLooksRelevant,
  resultHasAutomationError,
  replySendObservedRunning,
  reviewCaseCredibility,
  safeNativeAttachmentInfoDialog,
  safeNativeRecoverableInfoDialog,
  selectCoreBetaRunOwnedSkillCleanupCases,
  selectManagedRuntimeProcess,
  singleHostPipelineEligibility,
  seedLocalSkillReadiness,
  seedCoreBetaRunOwnedSkillCleanupLedger,
  sendReceiptEvidence,
  sentPromptFidelity,
  skillInstallActionBoundFailureVerdict,
  skillInstallIdentityTerminalVerdict,
  streamingScrollFollowVerdict,
  streamingScrollPerformanceMetrics,
  streamingTerminalReplyEvidence,
  stopRemainderWithoutSynthetic,
  terminalPromptBoundReplyEvidence,
  uninstallCoreBetaRunOwnedSkillTargets,
  unifiedConnectorModeApplied,
  unifiedSkillModeApplied,
  withReplyPollHardTimeout,
  webSearchQualityVerdict,
  coreBetaVerifiedLegacyWebCapabilityEvidence,
  coreBetaRendererEvaluationWithRetry,
  isCoreBetaRendererNavigationTransientError,
  materializeCoreBetaLegacyHostEvidence,
  validateProductionCasePlan,
  validateCoreBetaArtifactOracle,
  qworkDailyEvidenceEnvelope,
  QWORK_CORE_LIFELINE_CASE_IDS,
  isQworkCoreLifelineCasePlan,
  isQworkDailyRegressionCasePlan,
  qworkDailyWorkspaceSelectionFailureEvidence,
  qworkDailyWorkspaceTaskBindingVerdict,
  QWORK_MR_CORE_SMOKE_CASE_IDS,
  isQworkMrCoreSmokeCasePlan,
  mrSmokeActivityTimelineVerdict,
  mrSmokeIntervalScheduleVerdict,
} from '../src/lib/ui-agent-casebook-runner-v2.mjs';
import {
  buildCoreEvidenceManifest,
  coreBetaAttachmentFixtureNames,
  coreBetaCaseContractSha256,
  validateCoreBetaCase,
  validateEvidenceFile,
} from '../src/lib/core-beta-case-protocol.mjs';
import { replaceUnpairedSurrogates, writeJsonFile } from '../src/lib/fs.mjs';
import { expertGeneralAssistantExecutionVerdict } from '../src/lib/expert-general-assistant-evidence.mjs';
import {
  sendReceiptRecordEvidenceValid,
  workspaceRejectedSendReceiptEvidence,
} from '../src/lib/qbot-workspace-error-evidence.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const runner = [
  fs.readFileSync(path.join(root, 'src', 'lib', 'ui-agent-casebook-runner-v2.mjs'), 'utf8'),
  fs.readFileSync(path.join(root, 'src', 'lib', 'qbot-web-runtime-evidence.mjs'), 'utf8'),
].join('\n');
const legacyRunner = fs.readFileSync(path.join(root, 'src', 'lib', 'ui-agent-casebook-runner.mjs'), 'utf8');
const attachmentAdapter = fs.readFileSync(path.join(root, 'src', 'lib', 'qbot-ui-attachments.mjs'), 'utf8');
const taskRegenerateEvidenceSource = fs.readFileSync(path.join(root, 'src', 'lib', 'task-regenerate-evidence.mjs'), 'utf8');
const coreBetaProtocolSourceForTaskRegenerate = fs.readFileSync(path.join(root, 'src', 'lib', 'core-beta-case-protocol.mjs'), 'utf8');
for (const [name, source] of [['v2', runner], ['legacy', legacyRunner]]) {
  assert.match(
    source,
    /async function executeSitTaskRegenerate[\s\S]*await reload\.click\(\{ force: true \}\);[\s\S]*waitForTaskRegenerateImmediateProjection[\s\S]*waitForRunStartAndIdle[\s\S]*stage: 'final'[\s\S]*reopenSessionAndReadback[\s\S]*stage: 'reopened'[\s\S]*task-regenerate-transition\.json/,
    `${name} runner 必须单击重新生成并按 before/immediate/final/reopened 顺序生成专项证据`,
  );
  assert.doesNotMatch(
    source.match(/async function executeSitTaskRegenerate[\s\S]*?\n}\n\nasync function waitForTaskRegenerateImmediateProjection/)?.[0] || '',
    /reload\.click\([^\n]*\)\.catch[\s\S]*reload\.evaluate/,
    `${name} runner 不得以 click + evaluate 回退造成重新生成重复点击`,
  );
}
assert.match(
  taskRegenerateEvidenceSource,
  /qbot-task-regenerate-transition\/v1[\s\S]*same_nonempty_task_id[\s\S]*user_sequence_preserved[\s\S]*historical_messages_preserved[\s\S]*immediate_running_empty_assistant[\s\S]*final_second_version_complete[\s\S]*second_version_differs_from_first[\s\S]*reopened_second_version_stable/,
  '重新生成专项证据必须分离四阶段取证完整性与最终/重开产品 Oracle',
);
assert.match(
  coreBetaProtocolSourceForTaskRegenerate,
  /validateTaskRegenerateTransitionPayload[\s\S]*taskRegenerateTransitionEvidence\([\s\S]*task_regenerate_transition[\s\S]*validateTaskRegenerateTransitionPayload/,
  'Core Beta manifest 必须从磁盘重建并校验 task_regenerate_transition',
);
assert.match(
  runner,
  /typeof options\['release-identity-check-hook'\] === 'function'[\s\S]*phase: 'run-final'/,
  'Core Beta v2 runner 必须在 summary 前执行 QWork 发布身份结束读回',
);
assert.match(
  legacyRunner,
  /typeof options\['release-identity-check-hook'\] === 'function'[\s\S]*phase: 'run-final'/,
  'verified legacy 阶段不得绕过 QWork 发布身份结束读回',
);
assert.match(
  attachmentAdapter,
  /typeof shell\?\.stageFiles === 'function'[\s\S]*bridgeMethod[\s\S]*shell\[bridgeMethod\]\(\{ filePaths \}\)/,
  '统一附件适配器必须优先使用当前 QWork stageFiles，并只在接口缺失时回退 stageAttachments',
);
assert.match(
  attachmentAdapter,
  /(?=[\s\S]*FILE_INPUT_ATTACHMENT_PREFIX = 'qwork-file-input:')(?=[\s\S]*Array\.isArray\(result\.files\))(?=[\s\S]*invalid_file_ingress_descriptor)/,
  '统一附件适配器必须把 files[] 映射为 qwork-file-input/v1，并对畸形 descriptor fail-closed',
);

assert.equal(
  isCoreBetaRendererNavigationTransientError(new Error('Execution context was destroyed, most likely because of a navigation.')),
  true,
  'renderer 导航导致 execution context 销毁时应识别为可恢复瞬态',
);
assert.equal(
  isCoreBetaRendererNavigationTransientError(new Error('Target page, context or browser has been closed')),
  false,
  'target/page/browser 已关闭时不得误判为可重试瞬态',
);
{
  let evaluationCount = 0;
  let navigationWaitCount = 0;
  const recovered = await coreBetaRendererEvaluationWithRetry(async () => {
    evaluationCount += 1;
    if (evaluationCount === 1) throw new Error('Execution context was destroyed during navigation');
    return { page: { body_text_length: 12 } };
  }, {
    maxAttempts: 3,
    retryDelayMs: 0,
    waitForNavigation: async () => { navigationWaitCount += 1; },
    delay: async () => {},
  });
  assert.deepEqual(recovered.value, { page: { body_text_length: 12 } });
  assert.equal(evaluationCount, 2, '导航瞬态恢复只应重试一次并保持有界');
  assert.equal(navigationWaitCount, 1, '每次导航瞬态重试前必须等待新文档加载');
  assert.equal(recovered.attempts.length, 2);
  assert.equal(recovered.attempts[0].transient, true);
  assert.equal(recovered.attempts[1].ok, true);
  assert.equal(recovered.attempts[1].transient, false);
  let closedEvaluationCount = 0;
  await assert.rejects(
    () => coreBetaRendererEvaluationWithRetry(async () => {
      closedEvaluationCount += 1;
      throw new Error('Target page has been closed');
    }, { maxAttempts: 3, retryDelayMs: 0, delay: async () => {} }),
    /Target page has been closed/,
  );
  assert.equal(closedEvaluationCount, 1, 'target 已关闭时必须 fail-closed 且不得重试');
  let exhaustedEvaluationCount = 0;
  await assert.rejects(
    () => coreBetaRendererEvaluationWithRetry(async () => {
      exhaustedEvaluationCount += 1;
      throw new Error('Execution context was destroyed repeatedly');
    }, { maxAttempts: 3, retryDelayMs: 0, delay: async () => {} }),
    (error) => {
      assert.equal(exhaustedEvaluationCount, 3);
      assert.equal(Array.isArray(error.core_beta_renderer_capture_attempts), true);
      assert.equal(error.core_beta_renderer_capture_attempts.length, 3);
      return true;
    },
  );
}

{
  const evidenceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'qbot-core-beta-legacy-host-'));
  const caseDir = path.join(evidenceRoot, 'case');
  const workspace = path.join(evidenceRoot, 'workspace');
  fs.mkdirSync(caseDir, { recursive: true });
  fs.mkdirSync(workspace, { recursive: true });
  const generatedPath = path.join(workspace, 'teams_local_execution.txt');
  fs.writeFileSync(generatedPath, 'TEAMS_DESKTOP_LOCAL_OK\n');
  const tracePath = path.join(caseDir, 'verified-legacy-product-action-trace.json');
  const taskIdPath = path.join(caseDir, 'task-id.json');
  writeJsonFile(tracePath, {
    schema_version: 'qbot-core-beta-verified-legacy-trace/v1',
    case_id: 'BETA-HOST-003',
    legacy_case_id: 'SIT-TEAMS-NEW-003',
    driver: 'production_gate_beta_host_003',
    evidence_valid: true,
    oracle_valid: false,
  });
  writeJsonFile(taskIdPath, { case_id: 'BETA-HOST-003', task_id: 'task-host-003' });
  const baseState = () => ({
    artifacts: {
      core_beta_legacy_driver: {
        core_beta_case_id: 'BETA-HOST-003',
        legacy_case_id: 'SIT-TEAMS-NEW-003',
        driver: 'production_gate_beta_host_003',
      },
      verified_legacy_product_action_trace: tracePath,
      task_id: taskIdPath,
      teams_local_execution: {
        bridge: {
          activeId: 'task-host-003',
          running: false,
          lastExecutionTarget: 'desktop-local',
          executionScope: 'desktop-local',
          cwd: workspace,
        },
        context: { diagnostics: { executionTarget: 'desktop-local', sessionId: 'task-host-003' } },
        file: generatedPath,
        exists: true,
        content: 'TEAMS_DESKTOP_LOCAL_OK\n',
      },
    },
  });
  try {
    const state = baseState();
    const mapped = materializeCoreBetaLegacyHostEvidence({
      state,
      testCase: { id: 'BETA-HOST-003' },
      caseDir,
    });
    assert.equal(mapped.mapped, true, '真实 legacy Teams 本地文件应归一化为 Core Beta 证据');
    assert.equal(validateEvidenceFile('host_lifecycle_trace', mapped.host_file).valid, true);
    assert.equal(validateEvidenceFile('data_integrity_readback', mapped.integrity_file).valid, true);
    const hostEvidence = JSON.parse(fs.readFileSync(mapped.host_file, 'utf8'));
    const integrityEvidence = JSON.parse(fs.readFileSync(mapped.integrity_file, 'utf8'));
    assert.equal(hostEvidence.valid, true);
    assert.equal(hostEvidence.data.legacy_case_id, 'SIT-TEAMS-NEW-003');
    assert.equal(hostEvidence.data.execution_target, 'desktop-local');
    assert.equal(hostEvidence.data.session_id, 'task-host-003');
    assert.equal(integrityEvidence.data.exists, true);
    assert.equal(integrityEvidence.data.target_content_matches, true);
    assert.equal(integrityEvidence.data.evidence_generated_file.inside_case, true);

    const productMismatchState = baseState();
    productMismatchState.artifacts.teams_local_execution.bridge.lastExecutionTarget = 'cloud';
    productMismatchState.artifacts.teams_local_execution.context.diagnostics.executionTarget = 'cloud';
    const productMismatch = materializeCoreBetaLegacyHostEvidence({
      state: productMismatchState,
      testCase: { id: 'BETA-HOST-003' },
      caseDir,
    });
    assert.equal(productMismatch.mapped, true, '实际 execution target 偏离期望时仍应保留完整产品失败证据');
    const mismatchHost = JSON.parse(fs.readFileSync(productMismatch.host_file, 'utf8'));
    assert.equal(mismatchHost.data.execution_target, 'cloud');
    assert.equal(mismatchHost.data.execution_target_matches_expected, false);

    const invalidCases = [
      ['empty_source', (candidate) => { fs.writeFileSync(generatedPath, ''); candidate.artifacts.teams_local_execution.content = ''; }],
      ['placeholder_trace', (candidate) => { writeJsonFile(tracePath, { schema_version: 'qbot-core-beta-verified-legacy-trace/v1', case_id: 'BETA-HOST-003', legacy_case_id: 'SIT-TEAMS-NEW-003', evidence_valid: false }); }],
      ['trace_outside_case', (candidate) => { const outside = path.join(evidenceRoot, 'outside-trace.json'); writeJsonFile(outside, { schema_version: 'qbot-core-beta-verified-legacy-trace/v1', case_id: 'BETA-HOST-003', legacy_case_id: 'SIT-TEAMS-NEW-003', evidence_valid: true }); candidate.artifacts.verified_legacy_product_action_trace = outside; }],
      ['wrong_legacy_id', (candidate) => { candidate.artifacts.core_beta_legacy_driver.legacy_case_id = 'SIT-WRONG-001'; }],
      ['missing_target_field', (candidate) => {
        candidate.artifacts.teams_local_execution.bridge.lastExecutionTarget = '';
        candidate.artifacts.teams_local_execution.context.diagnostics.executionTarget = '';
      }],
    ];
    for (const [label, mutate] of invalidCases) {
      fs.writeFileSync(generatedPath, 'TEAMS_DESKTOP_LOCAL_OK\n');
      writeJsonFile(tracePath, {
        schema_version: 'qbot-core-beta-verified-legacy-trace/v1',
        case_id: 'BETA-HOST-003',
        legacy_case_id: 'SIT-TEAMS-NEW-003',
        driver: 'production_gate_beta_host_003',
        evidence_valid: true,
        oracle_valid: false,
      });
      const candidate = baseState();
      mutate(candidate);
      const result = materializeCoreBetaLegacyHostEvidence({ state: candidate, testCase: { id: 'BETA-HOST-003' }, caseDir });
      assert.equal(result.mapped, false, `${label} 必须 fail-closed`);
      assert.equal(typeof candidate.artifacts.host_lifecycle_trace, 'undefined', `${label} 不得生成伪有效 host evidence`);
      assert.equal(typeof candidate.artifacts.data_integrity_readback, 'undefined', `${label} 不得生成伪有效 integrity evidence`);
    }
  } finally {
    fs.rmSync(evidenceRoot, { recursive: true, force: true });
  }
}
const normalizedFixtureMarker = automationFixtureMarkerPattern('qa-node-runtime');
assert.match('QA Node Runtime', normalizedFixtureMarker, 'Fixture slug 应与空格展示名稳定匹配');
assert.match('qa_node-runtime', normalizedFixtureMarker, 'Fixture marker 应归一化下划线、连字符与空格');
assert.doesNotMatch('QA Python Runtime', normalizedFixtureMarker, 'Fixture marker 不得跨身份误匹配');

const expertSwitchTaskMismatch = expertGeneralAssistantExecutionVerdict({
  selectionEvidenceValid: true,
  firstReplyEvidenceValid: true,
  firstTaskId: 'expert-task',
  secondTaskId: 'general-task',
  secondReplyText: '我是通用 AI 助手，可以帮你处理任务。',
  firstReplyOracle: true,
  expertIdentityCleared: true,
  generalIdentity: true,
});
assert.equal(expertSwitchTaskMismatch.evidence_valid, true, '两轮非空 taskId 和完整回复应形成有效专家切换证据');
assert.equal(expertSwitchTaskMismatch.oracle_valid, false, '专家切换后新建 taskId 必须只失败产品 Oracle');
const expertSwitchMissingSecondTask = expertGeneralAssistantExecutionVerdict({
  selectionEvidenceValid: true,
  firstReplyEvidenceValid: true,
  firstTaskId: 'expert-task',
  secondReplyText: '我是通用 AI 助手，可以帮你处理任务。',
  firstReplyOracle: true,
  expertIdentityCleared: true,
  generalIdentity: true,
});
assert.equal(expertSwitchMissingSecondTask.evidence_valid, false, '第二轮 taskId 缺失必须保持证据无效并触发框架门禁');
const expertSwitchSameTask = expertGeneralAssistantExecutionVerdict({
  selectionEvidenceValid: true,
  firstReplyEvidenceValid: true,
  firstTaskId: 'shared-task',
  secondTaskId: 'shared-task',
  secondReplyText: '我是通用 AI 助手，可以帮你处理任务。',
  firstReplyOracle: true,
  expertIdentityCleared: true,
  generalIdentity: true,
});
assert.equal(expertSwitchSameTask.evidence_valid, true, '同 taskId 双轮完整回复必须形成有效证据');
assert.equal(expertSwitchSameTask.oracle_valid, true, '同 taskId 且身份隔离正确时产品 Oracle 必须通过');

const identityBoundSkillInstallSuccess = skillInstallIdentityTerminalVerdict({
  skillName: '毓数报表分析',
  cardText: '毓数报表分析',
  pageText: '技能「毓数报表分析」安装成功，本机对账已完成\n后台目录正在同步',
});
assert.equal(identityBoundSkillInstallSuccess.terminal, true, '目标技能明确成功回执必须优先于其他区域的同步中状态');
assert.equal(identityBoundSkillInstallSuccess.success, true, '目标技能明确成功回执必须判定为成功');
const identityBoundSkillInstallPending = skillInstallIdentityTerminalVerdict({
  skillName: '毓数报表分析',
  cardText: '毓数报表分析\n正在同步',
  pageText: '技能「其他技能」安装成功，本机对账已完成',
});
assert.equal(identityBoundSkillInstallPending.terminal, false, '其他技能成功回执不得覆盖目标技能自身 pending');
assert.equal(identityBoundSkillInstallPending.pending, true, '目标技能自身 pending 必须保持非终态');
const mismatchedSkillInstallReceipt = skillInstallIdentityTerminalVerdict({
  skillName: '毓数报表分析',
  pageText: '毓数报表分析位于市场列表；技能「其他技能」安装成功，本机对账已完成',
});
assert.equal(mismatchedSkillInstallReceipt.matched, false, '同一页面中其他技能的成功回执不得绑定到目标技能');
const identityBoundSkillInstallFailure = skillInstallIdentityTerminalVerdict({
  skillName: '毓数报表分析',
  pageText: '技能「毓数报表分析」安装失败：产品返回错误',
});
assert.equal(identityBoundSkillInstallFailure.failure, true, '目标技能自身失败不得误判成功');
const identityBoundForbiddenSkillInstallFailure = skillInstallIdentityTerminalVerdict({
  skillName: '自动解析web接口并同步yapi接口文档',
  cardText: '自动解析web接口并同步yapi接口文档\nSkill package path is forbidden: scripts/yapi_sync_lib/credentials.py',
});
assert.equal(identityBoundForbiddenSkillInstallFailure.failure, true, '目标技能的英文 forbidden 终态必须识别为明确安装失败');
const newGenericSkillInstallFailure = skillInstallActionBoundFailureVerdict({
  beforeText: '技能市场\n自动解析web接口并同步yapi接口文档\n安装',
  afterText: '已安装技能\n安装失败：Skill package path is forbidden: scripts/yapi_sync_lib/credentials.py',
  clickDispatched: true,
  installedListReadSucceeded: true,
  targetPresent: false,
});
assert.equal(newGenericSkillInstallFailure.failure, true, '目标安装点击后新增的通用 forbidden 行必须归因到当前产品动作');
assert.equal(newGenericSkillInstallFailure.source, 'installed-tab-new-explicit-failure-after-targeted-install');
assert.deepEqual(newGenericSkillInstallFailure.before_failure_lines, []);
assert.deepEqual(newGenericSkillInstallFailure.after_failure_lines, [newGenericSkillInstallFailure.text]);
const staleGenericSkillInstallFailure = skillInstallActionBoundFailureVerdict({
  beforeText: '安装失败：Skill package path is forbidden: scripts/yapi_sync_lib/credentials.py',
  afterText: '已安装技能\n安装失败：Skill package path is forbidden: scripts/yapi_sync_lib/credentials.py',
  clickDispatched: true,
  installedListReadSucceeded: true,
  targetPresent: false,
});
assert.equal(staleGenericSkillInstallFailure.terminal, false, '动作前已存在的同一通用失败行不得归因到当前安装点击');
const installedTargetOverridesGenericFailure = skillInstallActionBoundFailureVerdict({
  beforeText: '技能市场',
  afterText: '安装失败：Skill package path is forbidden: scripts/yapi_sync_lib/credentials.py',
  clickDispatched: true,
  installedListReadSucceeded: true,
  targetPresent: true,
});
assert.equal(installedTargetOverridesGenericFailure.terminal, false, '目标已进入已安装库存时不得把通用失败行判为当前安装失败');
const unreadableInstalledInventoryFailure = skillInstallActionBoundFailureVerdict({
  beforeText: '技能市场',
  afterText: '安装失败：Skill package path is forbidden: scripts/yapi_sync_lib/credentials.py',
  clickDispatched: true,
  installedListReadSucceeded: false,
  targetPresent: false,
});
assert.equal(unreadableInstalledInventoryFailure.terminal, false, '已安装库存读回缺失时必须保持非终态并由框架 fail-closed');
const projectMemory = fs.readFileSync(path.join(root, 'AGENTS.md'), 'utf8');
const automationFramework = fs.readFileSync(path.join(root, 'QBOT_AUTOMATION_FRAMEWORK.md'), 'utf8');
const coreBetaOperatingGuide = fs.readFileSync(path.join(root, 'QBOT_CORE_BETA_AGENT_OPERATING_GUIDE.md'), 'utf8');
const qworkReleaseTestPlan = fs.readFileSync(path.join(root, 'src', 'lib', 'qwork-release-test-plan.mjs'), 'utf8');
const qworkSoakReportSource = fs.readFileSync(path.join(root, 'src', 'lib', 'qwork-soak-report.mjs'), 'utf8');
const qworkReleaseObservationSource = fs.readFileSync(path.join(root, 'src', 'lib', 'qwork-release-ref-observation.mjs'), 'utf8');
const qworkReleaseObservationCli = fs.readFileSync(path.join(root, 'scripts', 'observe-qwork-release-ref.mjs'), 'utf8');
const qworkReleaseIntakeCli = fs.readFileSync(path.join(root, 'scripts', 'scan-qwork-release-intake.mjs'), 'utf8');
const coreBetaGrayGateSource = fs.readFileSync(path.join(root, 'src', 'lib', 'core-beta-gray-gate.mjs'), 'utf8');
const qworkReleaseSourceContractsSource = fs.readFileSync(
  path.join(root, 'src', 'lib', 'qwork-release-source-contracts.mjs'),
  'utf8',
);
const coreBetaProtocolSource = fs.readFileSync(path.join(root, 'src', 'lib', 'core-beta-case-protocol.mjs'), 'utf8');
const coreBetaPretestSource = fs.readFileSync(path.join(root, 'scripts', 'preflight-core-beta-test-run.mjs'), 'utf8');
const qworkReleaseOrchestrator = fs.readFileSync(path.join(root, 'scripts', 'orchestrate-qwork-release-test.mjs'), 'utf8');
assert.match(qworkReleaseTestPlan, /qbot-qwork-release-test-plan\/v2/);
assert.match(qworkReleaseTestPlan, /qbot-qwork-release-test-state\/v2/);
assert.match(qworkReleaseTestPlan, /qbot-qwork-release-test-integrity\/v2/);
assert.match(qworkReleaseOrchestrator, /qbot-qwork-release-test-event\/v2/);
assert.match(qworkReleaseOrchestrator, /\/usr\/bin\/lockf[\s\S]*QBOT_QWORK_CONTROL_LOCK_ROOT/);
assert.match(qworkReleaseOrchestrator, /captureDirectoryGuard[\s\S]*assertDirectoryGuard/);
assert.match(qworkReleaseOrchestrator, /\.staging-\$\{process\.pid\}[\s\S]*renameSync\(stagingRoot, files\.root\)/);
assert.match(qworkReleaseOrchestrator, /qbot-qwork-release-test-transaction\/v2[\s\S]*recoverControlTransaction/);
assert.match(qworkReleaseOrchestrator, /ls-remote[\s\S]*refs\/heads\/release\/0\.1/);
assert.match(qworkReleaseObservationSource, /repository\/branches\/\$\{encodeURIComponent\(QWORK_RELEASE_BRANCH\)\}[\s\S]*before !== after/);
assert.match(qworkReleaseObservationCli, /gitlab-token-stdin[\s\S]*createGitLabReadOnlyReader/);
assert.match(qworkReleaseOrchestrator, /gitlab-token-stdin[\s\S]*createGitLabReadOnlyReader[\s\S]*readStableQworkReleaseHead/);
for (const source of [qworkReleaseObservationCli, qworkReleaseIntakeCli, qworkReleaseOrchestrator]) {
  assert.match(source, /token\.startsWith\('--gitlab-token-stdin='\)[\s\S]*无值布尔开关/);
  assert.match(source, /Unexpected positional argument/);
}
assert.match(qworkReleaseObservationSource, /fs\.existsSync\(root\)[\s\S]*must be new/);
assert.match(qworkReleaseObservationSource, /captureDirectoryGuard\(path\.dirname\(root\)[\s\S]*assertDirectoryGuard\(rootGuard/);
for (const [documentName, documentText] of [
  ['QBOT_AUTOMATION_FRAMEWORK.md', automationFramework],
  ['QBOT_CORE_BETA_AGENT_OPERATING_GUIDE.md', coreBetaOperatingGuide],
]) {
  const productionGatePretestExamples = [...documentText.matchAll(/```bash\s*\n([\s\S]*?)```/g)]
    .map((match) => match[1])
    .filter((block) => block.includes('npm run core-beta:pretest --') && block.includes('--production-gate true'));
  assert.ok(productionGatePretestExamples.length > 0, `${documentName} 必须保留正式 production-gate pretest 示例`);
  for (const example of productionGatePretestExamples) {
    assert.match(example, /^\s*--release-intake\s+\S+/m, `${documentName} 的每个正式 pretest 示例必须绑定 release intake 报告`);
    assert.match(example, /^\s*--release-intake-sha256\s+\S+/m, `${documentName} 的每个正式 pretest 示例必须绑定 release intake 文件 SHA-256`);
    assert.match(example, /^\s*--require-release-intake\s+true\s*\\?\s*$/m, `${documentName} 的每个正式 pretest 示例必须显式强制 release intake`);
  }
  assert.match(
    documentText,
    /v2[\s\S]*lockf[\s\S]*dev\/inode\/uid\/mode[\s\S]*staging[\s\S]*write-ahead transaction[\s\S]*remote-tracking ref/,
    `${documentName} 必须固化 v2 控制树、生命周期锁、目录守卫、原子初始化、事务恢复和实时 remote 合同`,
  );
  assert.match(
    documentText,
    /全部合同[\s\S]*current-release 持续性鉴证[\s\S]*当前 release HEAD[\s\S]*不能冒充本轮 MR changes 鉴证[\s\S]*origin_change_attestation[\s\S]*不在本次增量范围时该字段必须为空/,
    `${documentName} 必须拆分全注册表 current-release 持续性鉴证与仅本轮 MR 的 origin changes 鉴证`,
  );
  assert.match(
    documentText,
    /integration binding 默认仍要求全文件[\s\S]*occurrence_count == 1[\s\S]*MR !1540[\s\S]*feature_check_body_absent_test[\s\S]*test_profile_report_exact_body[\s\S]*下一个顶层 `test\(`[\s\S]*owner 必须唯一[\s\S]*URL、method、body[\s\S]*owner_occurrence_count\/occurrence_count[\s\S]*移入错误 test[\s\S]*复制 owner block[\s\S]*origin changes 鉴证继续[\s\S]*精确出现一次[\s\S]*forbidden fragment[\s\S]*精确为 0/,
    `${documentName} 必须锁定 MR1540 owner scope，且其它 current-release/origin/forbidden 断言保持严格`,
  );
}
assert.match(
  qworkReleaseSourceContractsSource,
  /CURRENT_RELEASE_SCOPED_BINDINGS[\s\S]*QWORK_MR1540_MEMORY_FEATURE_PROFILE_CONTRACT_ID[\s\S]*feature_check_body_absent_test[\s\S]*test_profile_report_exact_body/,
  'current-release owner scope 白名单必须只由 MR1540 合同显式声明',
);
assert.match(
  qworkReleaseSourceContractsSource,
  /if \(!scope\)[\s\S]*occurrenceCount === 1[\s\S]*nextOwnerOffset[\s\S]*\^test\\\([\s\S]*ownerIndexes\.length === 1[\s\S]*scopedOccurrenceCount === 1[\s\S]*requiredFragments\.every/,
  'current-release continuity 必须保持默认唯一，并以唯一顶层 test owner scope 收紧 MR1540 例外',
);
assert.match(
  qworkReleaseSourceContractsSource,
  /addition_count: occurrenceCount[\s\S]*occurrence_count: occurrenceCount[\s\S]*owner_occurrence_count: ownerIndexes\.length[\s\S]*required_fragments: requiredFragments/,
  'current-release attestation 必须同时保留全文件与 owner scope 计数',
);
assert.match(
  qworkReleaseSourceContractsSource,
  /const integrationBindings = contract\.integration_bindings\.map[\s\S]*additionCount === 1[\s\S]*integration_binding_mismatch/,
  'origin changes integration binding 必须继续精确唯一',
);
assert.match(
  coreBetaPretestSource,
  /const releaseIntakeRequired = productionGate \|\| TRUE_VALUES\.has\(releaseIntakeMode\)[\s\S]*release_intake_cannot_be_disabled[\s\S]*if \(releaseIntakeRequired\)[\s\S]*expectedShaValid = \/\^\[a-f0-9\]\{64\}\$\/i[\s\S]*releaseRef: productionGate \? QWORK_RELEASE_INTAKE_DEFAULT_REF[\s\S]*casebookPath: casebook[\s\S]*sheet,[\s\S]*caseIds: cases\.map[\s\S]*requireGitLabApiFreshness: productionGate/,
  '正式 production-gate pretest 必须不可关闭 release intake，强制文件 SHA、GitLab API freshness 与精确 Casebook/Sheet/Case ID 绑定',
);
assert.match(
  automationFramework,
  /installed-tab-new-explicit-failure-after-targeted-install[\s\S]*action_bound=true[\s\S]*baseline_absent=true/,
  '框架合同必须记录通用 Skill 安装失败的动作前后因果绑定与 fail-closed 规则',
);
assert.match(
  coreBetaOperatingGuide,
  /framework-50c9a31_casebook-c412ee6[\s\S]*已完成 `40\/83`[\s\S]*SIT-SKILL-002[\s\S]*installed-tab-new-explicit-failure-after-targeted-install/,
  '操作指南必须保留本轮 40/83 Skill 安装归因框架问题及新目录全量重跑要求',
);
const electronRestartHelper = fs.readFileSync(path.join(root, 'scripts', 'restart-qbot-electron-control-plane.sh'), 'utf8');
const skillHubRestartHelper = fs.readFileSync(path.join(root, 'scripts', 'restart-qbot-skillhub-control-plane.sh'), 'utf8');
const connectorFixtureRestartHelper = fs.readFileSync(path.join(root, 'scripts', 'restart-qbot-connector-fixture-control-plane.sh'), 'utf8');
const capabilityFixtureRestartHelper = fs.readFileSync(path.join(root, 'scripts', 'restart-qbot-capability-fixture-control-plane.sh'), 'utf8');
const qworkDailyCasebookBuilder = fs.readFileSync(path.join(root, 'scripts', 'build-qwork-daily-regression-casebook.mjs'), 'utf8');
const productionGrayCasebookBuilder = fs.readFileSync(path.join(root, 'scripts', 'build-release01-production-gray-casebook.mjs'), 'utf8');
const atomicRenameNoReplaceHelper = fs.readFileSync(path.join(root, 'scripts', 'atomic-rename-no-replace.py'), 'utf8');
const {
  abortCasebookOutputDirectory,
  atomicRenameNoReplace,
  assertCasebookOutputAbsent,
  assertExpectedProductCommit,
  assertExpectedReleaseIntakeSha256,
  assertR13CasebookLayering,
  auditCasebookRuntimeScopes,
  capability: casebookDesignRuntimeCapability,
  commitCasebookOutputDirectory,
  normalizeCasebookContractCase,
  normalizeCasebookSourceIds,
  patchSmokeCase: patchR14SmokeCase,
  patchRecentCases: patchR13RecentCase,
  publishCasebookAfterRuntimeAudit,
  publishValidatedCasebookArtifact,
  prepareCasebookOutputDirectory,
  validateCasebookDesignReleaseIntake,
} = await import(pathToFileURL(
  path.join(root, 'scripts', 'build-release01-production-gray-casebook.mjs'),
).href);

const casebookDesignLegacyExpert012 = {
  '用例ID': 'BETA-EXPERT-012',
  '用例类型': 'expert_lifecycle',
  '测试场景': '发布 Expert v2 新版本并验证历史版本不可变',
  '自动化执行步骤': '发布 v2，重开旧会话并新召唤 Expert。',
  '预期结果': 'v1完全不变，v2作为新版本发布。',
  '成功判定': '旧会话仍用v1，新召唤可选择v2。',
  '判定Oracle': 'immutable_readback+version_lineage',
  '证据要求': 'before_screenshot,action_receipt,after_screenshot,public_state_readback,cleanup_readback',
  '证据角色': 'before_screenshot,action_receipt,after_screenshot,public_state_readback,cleanup_readback',
  '精准断言JSON': JSON.stringify({
    pass_rule: '旧版不可变升级合同通过。',
    fail_rule: '产品Oracle失败。',
    block_rule: '仅真实依赖不可用时阻塞。',
    hard_oracles: ['v1完全不变', '旧会话仍用v1', '新召唤可选择v2'],
    machine_assertions: [{ id: 'evidence-complete', path: 'evidence.complete', operator: 'equals', expected: true }],
  }),
};
const casebookDesignNormalizedLegacyExpert012 = normalizeCasebookContractCase(casebookDesignLegacyExpert012);
assert.equal(casebookDesignNormalizedLegacyExpert012.id, 'BETA-EXPERT-012');
assert.equal(casebookDesignNormalizedLegacyExpert012.case_type, 'expert_lifecycle');
assert.equal(casebookDesignNormalizedLegacyExpert012.oracle_type, 'immutable_readback+version_lineage');
assert.deepEqual(
  casebookDesignNormalizedLegacyExpert012.precise_assertions.hard_oracles,
  ['v1完全不变', '旧会话仍用v1', '新召唤可选择v2'],
  '生成器能力适配必须保留完整精准断言，而不是只传 Case ID/type',
);
const casebookDesignLegacyExpert012Capability = casebookDesignRuntimeCapability(casebookDesignLegacyExpert012);
assert.equal(casebookDesignLegacyExpert012Capability.binding.dispatchable, true);
assert.equal(casebookDesignLegacyExpert012Capability.binding.driver, 'expert_immutable_version_upgrade');

const casebookDesignMinimalExpert012Capability = casebookDesignRuntimeCapability({
  '用例ID': 'BETA-EXPERT-012',
  '用例类型': 'expert_lifecycle',
});
assert.equal(casebookDesignMinimalExpert012Capability.binding.dispatchable, false);
assert.equal(casebookDesignMinimalExpert012Capability.binding.reason, 'scenario_missing');
assert.equal(casebookDesignMinimalExpert012Capability.directlyRunnable, false);

const casebookDesignPatchedExpert012 = patchR13RecentCase(casebookDesignLegacyExpert012);
const casebookDesignPatchedExpert012Precise = JSON.parse(casebookDesignPatchedExpert012['精准断言JSON']);
assert.equal(casebookDesignPatchedExpert012['判定Oracle'].split('+')[0], 'expert_published_maintenance_task_roundtrip');
assert.equal(casebookDesignRuntimeCapability(casebookDesignPatchedExpert012).binding.driver, 'expert_published_maintenance_task_roundtrip');
assert.doesNotMatch(
  JSON.stringify(casebookDesignPatchedExpert012Precise),
  /immutable_readback|v1完全不变|旧会话仍用v1|新召唤可选择v2/,
  'r13 BETA-EXPERT-012 必须重建精准断言并彻底清除旧不可变版本语义',
);
assert.equal(casebookDesignPatchedExpert012Precise.hard_oracles.length, 5);

const casebookDesignPatchedWeb001 = patchR14SmokeCase({
  '用例ID': 'MRSMOKE-WEB-001',
  '用例类型': 'conversation',
  '来源ID': 'MR!1523; MR!1523',
  '执行步骤': '执行四轮 Web 搜索。',
  '证据要求': 'before_screenshot',
  '证据角色': 'before_screenshot',
  '精准断言JSON': JSON.stringify({ hard_oracles: [] }),
});
const casebookDesignWebTurns = JSON.parse(casebookDesignPatchedWeb001['会话轮次JSON']);
assert.equal(casebookDesignWebTurns.length, 4, 'r14 MRSMOKE-WEB-001 必须冻结四轮合同');
for (const [index, turn] of casebookDesignWebTurns.entries()) {
  assert.match(turn.prompt, /内置 Web 搜索/);
  assert.match(turn.prompt, /OpenAI/);
  assert.match(turn.prompt, /至少两条/);
  assert.match(turn.prompt, /标题/);
  assert.match(turn.prompt, /日期|发布时间/);
  assert.match(turn.prompt, /HTTPS/);
  assert.match(turn.prompt, /摘要/);
  assert.match(turn.oracle, /至少两(?:组|条)/);
  assert.match(turn.oracle, /独立/);
  assert.match(turn.oracle, /OpenAI/);
  assert.match(turn.oracle, /官方/);
  assert.match(turn.oracle, /标题/);
  assert.match(turn.oracle, /日期|发布时间/);
  assert.match(turn.oracle, /HTTPS|链接|URL/);
  assert.match(turn.oracle, /摘要/);
  if (index === 3) assert.match(turn.prompt, /第\s*4\s*轮|第四轮|四轮/);
}
assert.doesNotMatch(casebookDesignPatchedWeb001['会话轮次JSON'], /至少两个主题|字段完整|第四次继续/);
assert.deepEqual(normalizeCasebookSourceIds('A,A; B，A；C'), ['A', 'B', 'C']);

const casebookDesignTask002WithDuplicateSource = patchR13RecentCase({
  '用例ID': 'BETA-TASK-002',
  '用例类型': 'task_lifecycle',
  '来源ID': 'SIT-TASK-REGEN-001,SIT-TASK-REGEN-001',
  '精准断言JSON': JSON.stringify({ hard_oracles: [] }),
});
assert.equal(
  casebookDesignTask002WithDuplicateSource['来源ID'],
  'SIT-TASK-REGEN-001,MR!1557,MR!1568',
  'r14 BETA-TASK-002 来源 ID 必须保持首次出现顺序并稳定去重',
);
assert.equal(
  patchR13RecentCase(casebookDesignTask002WithDuplicateSource)['来源ID'],
  casebookDesignTask002WithDuplicateSource['来源ID'],
  'r14 来源 ID 归一化必须幂等',
);

const casebookProtocolGuardDir = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'qbot-r14-protocol-guard-'));
try {
  const artifactFile = path.join(casebookProtocolGuardDir, 'artifact.xlsx');
  const formalOutput = path.join(casebookProtocolGuardDir, 'formal.xlsx');
  fs.writeFileSync(artifactFile, 'not-published');
  const malformed = { '用例ID': 'BROKEN', '用例类型': 'conversation' };
  const malformedScopes = {
    '核心生命线门禁': Array.from({ length: 16 }, () => malformed),
    '新增MR核心冒烟': Array.from({ length: 12 }, () => malformed),
    '生产灰度门禁Case': Array.from({ length: 70 }, () => malformed),
    '全量功能回归Case': Array.from({ length: 160 }, () => malformed),
  };
  assert.throws(
    () => auditCasebookRuntimeScopes(malformedScopes),
    /导出后完整协议与运行时能力审计失败/,
  );
  await assert.rejects(
    () => publishCasebookAfterRuntimeAudit({ artifactFile, formalOutput, scopes: malformedScopes }),
    /导出后完整协议与运行时能力审计失败/,
  );
  assert.equal(fs.existsSync(formalOutput), false, '任一导出 Sheet 存在 protocol error 时不得产生正式 r14');
} finally {
  fs.rmSync(casebookProtocolGuardDir, { recursive: true, force: true });
}

const casebookDesignMixedExpert012 = {
  ...casebookDesignPatchedExpert012,
  '判定Oracle': `${casebookDesignPatchedExpert012['判定Oracle']}+immutable_readback`,
  '精准断言JSON': JSON.stringify({
    ...casebookDesignPatchedExpert012Precise,
    hard_oracles: [...casebookDesignPatchedExpert012Precise.hard_oracles, '旧会话仍用v1'],
  }),
};
const casebookDesignMixedExpert012Capability = casebookDesignRuntimeCapability(casebookDesignMixedExpert012);
assert.equal(casebookDesignMixedExpert012Capability.binding.dispatchable, false);
assert.equal(casebookDesignMixedExpert012Capability.binding.reason, 'scenario_missing');

const casebookFormalOutputGuardDir = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'qbot-r13-formal-output-guard-'));
try {
  const guardedOutput = path.join(casebookFormalOutputGuardDir, 'r13.xlsx');
  assert.equal(await assertCasebookOutputAbsent(guardedOutput), path.resolve(guardedOutput));
  fs.writeFileSync(guardedOutput, 'immutable-r13');
  await assert.rejects(
    () => assertCasebookOutputAbsent(guardedOutput),
    /禁止覆盖已存在的正式 Casebook/,
  );
} finally {
  fs.rmSync(casebookFormalOutputGuardDir, { recursive: true, force: true });
}
const {
  QWORK_RELEASE_SOURCE_CONTRACTS: casebookDesignSourceContracts,
  QWORK_MR1560_TURN_AUTHORITY_READINESS_CONTRACT: casebookDesignMr1560Contract,
  auditCurrentReleaseSourceContract: auditCasebookDesignCurrentSourceContract,
  releaseSourceContractProtectedPaths: casebookDesignSourceContractProtectedPaths,
  resolveCurrentReleaseHeaderContract: resolveCasebookDesignCurrentHeaderContract,
} = await import(pathToFileURL(path.join(root, 'src', 'lib', 'qwork-release-source-contracts.mjs')).href);
const {
  QWORK_MR1559_MERGE_COMMIT_SHA: casebookDesignSuccessorMerge,
  QWORK_MR1559_SUCCESSOR_PROTECTED_PATHS: casebookDesignSuccessorPaths,
  auditQworkReleaseBlockingRisk: auditCasebookDesignBlockingRisk,
} = await import(pathToFileURL(path.join(root, 'src', 'lib', 'qwork-release-blocking-risks.mjs')).href);
const {
  QWORK_RELEASE_INTAKE_TOOL_VERSION: casebookDesignIntakeToolVersion,
  mapReleaseImpact: mapCasebookDesignReleaseImpact,
} = await import(pathToFileURL(path.join(root, 'src', 'lib', 'qwork-release-intake.mjs')).href);
const casebookDesignStableValue = (value) => {
  if (Array.isArray(value)) return value.map(casebookDesignStableValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, casebookDesignStableValue(value[key])]));
  }
  return value;
};
const casebookDesignSha256 = (value) => createHash('sha256')
  .update(JSON.stringify(casebookDesignStableValue(value)))
  .digest('hex');
const casebookDesignGitBlobSha1 = (bytes) => createHash('sha1')
  .update(`blob ${bytes.length}\0`, 'utf8')
  .update(bytes)
  .digest('hex');
const casebookDesignVerifiedOriginAttestation = (contract) => {
  const value = {
    schema_version: 'qbot-qwork-release-source-contract/v1',
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
    source_file: {
      ...contract.source_file,
      source_line_count_observed: contract.source_file.source_line_count,
    },
    headers: contract.header_emissions.map((header) => ({
      ...header,
      emission_count: 1,
      value_definition_count: header.value_definition ? 1 : 0,
      verified: true,
    })),
    integration_bindings: contract.integration_bindings.map((binding) => ({
      ...binding,
      addition_count: 1,
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
  return { ...value, attestation_sha256: casebookDesignSha256(value) };
};
const casebookDesignRiskId = 'deepbankv2-mr-1552-execution-runner-isolation/v1';
const casebookDesignRiskMerge = '0720d31baf1d53bfd61e5428173d39b59472cdb7';
const casebookDesignRiskFailures = [
  'execution_runner_clean_exit_terminal_missing',
  'execution_runner_pressure_admission_disconnected',
  'execution_runner_message_isolation_missing',
];
const casebookDesignBlockingRisk = ({ blocked, head }) => {
  const successorEntrySource = blocked ? '// blocked successor entry fixture' : `
require('./host-core/agent/execution-worker-entry.cjs');
`;
  const successorManagerSource = blocked ? '// blocked successor manager fixture' : `
async function acquire(operation, identity) {
  const requestId = identity.requestId;
  if (executions.size >= maxConcurrentExecutions) {
    const error = new Error('execution worker admission is closed');
    error.code = 'execution_worker_pressure_admission_closed';
    throw error;
  }
  const supervisor = supervisorFactory({ maxPendingRequests: 1, maxRestarts: 0 });
  const record = { supervisor };
  executions.set(requestId, record);
  return {
    release: async () => {
      executions.delete(requestId);
      await supervisor.stop();
    },
  };
}
`;
  const successorSupervisorSource = blocked ? '// blocked successor supervisor fixture' : `
function rejectPending(error) { return error; }
function executionWorkerExitFailure(code, signal) { return { code, signal }; }
const onExit = (code, signal) => {
  rejectPending(executionWorkerExitFailure(code, signal));
};
`;
  const successorDesktopHostSource = blocked ? '// blocked successor desktop host fixture' : `
async function runAgentInExecutionWorker(identity, signal) {
  let executionWorkerLease = null;
  try {
    executionWorkerLease = await executionWorkerManager.acquire('execution.start', identity, { signal });
    const supervisor = executionWorkerLease.supervisor;
    await supervisor.request();
  } finally {
    await executionWorkerLease?.release?.();
  }
}
`;
  const fileSource = (filePath) => {
    if (filePath === 'electron/execution-worker.cjs') return successorEntrySource;
    if (filePath === 'electron/host-core/agent/execution-worker-manager.cjs') return successorManagerSource;
    if (filePath === 'electron/host-core/agent/execution-worker-supervisor.cjs') return successorSupervisorSource;
    if (filePath === 'electron/host-core/agent/desktop-host-context.cjs') return successorDesktopHostSource;
    return `// observed successor release source: ${filePath}\n`;
  };
  const files = casebookDesignSuccessorPaths.map((filePath) => {
    const source = fileSource(filePath);
    const bytes = Buffer.from(source, 'utf8');
    return {
      path: filePath,
      requested_ref: head,
      payload: {
        file_path: filePath,
        ref: head,
        commit_id: head,
        blob_id: casebookDesignGitBlobSha1(bytes),
        last_commit_id: createHash('sha1').update(`risk-commit:${filePath}`).digest('hex'),
        encoding: 'base64',
        size: bytes.length,
        content: bytes.toString('base64'),
      },
    };
  });
  return auditCasebookDesignBlockingRisk({
    releaseHead: head,
    originAncestry: {
      source: 'gitlab-api-compare-first-parent',
      verified: true,
      compare_from: casebookDesignRiskMerge,
      compare_to: head,
      compare_commit_count: 2,
      first_parent_complete: true,
      reason: '',
    },
    releaseBeforeOriginAncestry: {
      source: 'gitlab-api-compare-first-parent',
      verified: false,
      compare_from: head,
      compare_to: casebookDesignRiskMerge,
      compare_commit_count: 0,
      first_parent_complete: false,
      reason: 'release_head_descends_from_mr1552',
    },
    successorAncestry: {
      source: 'gitlab-api-compare-first-parent',
      verified: true,
      compare_from: casebookDesignSuccessorMerge,
      compare_to: head,
      compare_commit_count: 1,
      first_parent_complete: true,
      reason: '',
    },
    releaseBeforeSuccessorAncestry: {
      source: 'gitlab-api-compare-first-parent',
      verified: false,
      compare_from: head,
      compare_to: casebookDesignSuccessorMerge,
      compare_commit_count: 0,
      first_parent_complete: false,
      reason: 'release_head_descends_from_mr1559',
    },
    files,
  });
};
const casebookDesignCurrentSourceAttestations = ({ head, mergeRequests }) => {
  const ancestryByContractId = new Map(casebookDesignSourceContracts.map((contract) => [
    contract.contract_id,
    {
      source: 'gitlab-api-compare-first-parent',
      verified: true,
      compare_from: contract.merge_commit_sha,
      compare_to: head,
      compare_commit_count: 1,
      first_parent_complete: true,
      reason: '',
    },
  ]));
  const linesByPath = new Map();
  const scopedGroupsByPath = new Map();
  const addLine = (filePath, line) => {
    if (!filePath || !line) return;
    const lines = linesByPath.get(filePath) || [];
    if (!lines.includes(line)) lines.push(line);
    linesByPath.set(filePath, lines);
  };
  const addScopedGroup = (filePath, binding) => {
    const scope = binding.current_release_scope;
    const group = [
      scope.owner_start.source,
      ...scope.required_fragments.map((fragment) => fragment.value.source),
      binding.addition.source,
    ].filter((line, index, lines) => line && lines.indexOf(line) === index);
    const groups = scopedGroupsByPath.get(filePath) || [];
    if (!groups.some((candidate) => candidate.join('\n') === group.join('\n'))) groups.push(group);
    scopedGroupsByPath.set(filePath, groups);
  };

  const resolutions = new Map(casebookDesignSourceContracts.map((contract) => [
    contract.contract_id,
    resolveCasebookDesignCurrentHeaderContract(contract, {
      contracts: casebookDesignSourceContracts,
      ancestryByContractId,
    }),
  ]));
  for (const contract of casebookDesignSourceContracts) {
    const resolution = resolutions.get(contract.contract_id);
    const supersession = resolution.owner.contract_id === contract.contract_id
      ? null
      : resolution.owner.supersedes.find((item) => item.contract_id === contract.contract_id);
    const headerOwner = supersession?.current_assertions?.includes('header_emissions')
      ? resolution.owner
      : contract;
    for (const header of headerOwner.header_emissions) {
      addLine(headerOwner.source_file.path, header.value_definition?.source);
      addLine(headerOwner.source_file.path, header.emission.source);
    }
    for (const originBinding of contract.integration_bindings) {
      const assertion = `integration_binding:${originBinding.id}`;
      const binding = supersession?.current_assertions?.includes(assertion)
        ? resolution.owner.integration_bindings.find((item) => item.id === originBinding.id)
        : originBinding;
      assert.ok(binding, `测试夹具必须能解析源码合同 ${contract.contract_id} 的 ${assertion}`);
      if (binding.current_release_scope) addScopedGroup(binding.path, binding);
      else addLine(binding.path, binding.addition.source);
    }
  }

  const sourceFile = (filePath) => {
    const sourceLines = [
      ...(linesByPath.get(filePath) || []),
      ...(scopedGroupsByPath.get(filePath) || []).flat(),
    ];
    const source = `${sourceLines.length ? sourceLines.join('\n') : '// current release fixture'}\n`;
    const bytes = Buffer.from(source, 'utf8');
    return {
      path: filePath,
      requested_ref: head,
      payload: {
        file_path: filePath,
        ref: head,
        commit_id: head,
        blob_id: casebookDesignGitBlobSha1(bytes),
        last_commit_id: createHash('sha1').update(`commit:${filePath}`).digest('hex'),
        encoding: 'base64',
        size: bytes.length,
        content: bytes.toString('base64'),
      },
    };
  };

  return casebookDesignSourceContracts.map((contract) => {
    const resolution = resolutions.get(contract.contract_id);
    const protectedPaths = [...new Set([
      ...casebookDesignSourceContractProtectedPaths(contract),
      ...casebookDesignSourceContractProtectedPaths(resolution.owner),
    ])];
    return auditCasebookDesignCurrentSourceContract({
      releaseHead: head,
      targetBranch: contract.target_branch,
      originAncestry: ancestryByContractId.get(contract.contract_id),
      files: protectedPaths.map(sourceFile),
      mergeRequests,
      originAttestation: contract.contract_id === casebookDesignMr1560Contract.contract_id
        ? casebookDesignVerifiedOriginAttestation(contract)
        : null,
      contract,
      currentHeaderContract: resolution.owner,
      currentHeaderLineage: resolution.lineage,
    });
  });
};
const sealCasebookDesignIntake = (report) => {
  for (const risk of report.blocking_risks || []) {
    const riskValue = structuredClone(risk);
    delete riskValue.attestation_sha256;
    risk.attestation_sha256 = casebookDesignSha256(riskValue);
  }
  const reportValue = structuredClone(report);
  delete reportValue.integrity.content_sha256;
  report.integrity.content_sha256 = casebookDesignSha256(reportValue);
  return report;
};
const casebookDesignDependencyClosure = (caseIds) => {
  const dependencies = new Set();
  const add = (...ids) => ids.forEach((id) => dependencies.add(id));
  for (const id of caseIds) {
    if (id === 'MRSMOKE-AUTO-001') add('BETA-TASK-008', 'BETA-ROUTE-001');
    if (id === 'MRSMOKE-SKILL-001') add('SIT-SKILL-007', 'BETA-SKILL-001', 'BETA-SKILL-002', 'BETA-SKILL-003', 'BETA-SKILL-004', 'BETA-SKILL-005', 'BETA-SKILL-014');
    if (id === 'MRSMOKE-AUTH-001') add('BETA-SEC-002', 'SIT-WORKSPACE-001');
    if (id === 'MRSMOKE-CHART-001') add('SIT-CONN-016');
    if (id === 'MRSMOKE-WEB-001' || id === 'MRSMOKE-WEB-002') add('BETA-CHAT-005', 'SIT-CONN-019');
    if (id === 'MRSMOKE-ART-001') add('BETA-ART-001', 'BETA-ART-002', 'BETA-ART-003', 'BETA-ART-004');
    if (id === 'MRSMOKE-FAIL-001' || id === 'MRSMOKE-ROUTE-001') add('BETA-CHAT-005', 'BETA-PERF-003');
    if (id === 'MRSMOKE-NAV-001' || id === 'MRSMOKE-ENTRY-001') add('BETA-CHAT-007');
    if (id === 'MRSMOKE-ACT-001') add('BETA-CHAT-007');
  }
  return [...dependencies].sort();
};
const casebookDesignIntakeFixture = ({ blocked }) => {
  const baseline = 'a'.repeat(40);
  const head = casebookDesignMr1560Contract.merge_commit_sha;
  const mergeRequests = [
    {
      iid: '1552', commit: casebookDesignRiskMerge, parent: baseline, parent_count: 2,
      title: 'execution runner isolation', branch: 'codex/execution-runner', merged_at: '2026-09-04T10:00:00.000Z',
      web_url: 'https://gitlab.example.test/project/-/merge_requests/1552', labels: ['kind/bug'],
      commit_subject: 'Merge branch codex/execution-runner into release/0.1',
      commit_body: 'Bind the execution worker lifecycle to the release runner.',
      metadata_source: 'gitlab-api-changes', metadata_verified: true, state: 'merged', target_branch: 'release/0.1',
      attribution_kind: 'merge_mr', merge_commit_sha: casebookDesignRiskMerge, squash_commit_sha: '',
      changes_count: 1,
      changed_paths: ['electron/execution-worker.cjs'], diff_sha256: '1'.repeat(64), diff_bytes: 100,
      source_contract_ids: [],
    },
    {
      iid: casebookDesignMr1560Contract.mr_iid,
      commit: casebookDesignMr1560Contract.merge_commit_sha,
      parent: casebookDesignRiskMerge,
      parent_count: 2,
      title: 'turn authority readiness', branch: 'fix/turn-authority-readiness', merged_at: '2026-09-04T11:00:00.000Z',
      web_url: 'https://gitlab.example.test/project/-/merge_requests/1560', labels: ['kind/bug'],
      commit_subject: 'Merge branch fix/turn-authority-readiness into release/0.1',
      commit_body: 'Require turn authority readiness before dispatch.',
      metadata_source: 'gitlab-api-changes', metadata_verified: true, state: 'merged', target_branch: 'release/0.1',
      attribution_kind: 'merge_mr', merge_commit_sha: casebookDesignMr1560Contract.merge_commit_sha, squash_commit_sha: '',
      changes_count: casebookDesignMr1560Contract.changes_count,
      changed_paths: [...casebookDesignMr1560Contract.changed_paths],
      diff_sha256: casebookDesignMr1560Contract.mr_diff.sha256,
      diff_bytes: casebookDesignMr1560Contract.mr_diff.bytes,
      source_contract_ids: [casebookDesignMr1560Contract.contract_id],
    },
  ].map((mr) => ({
    ...mr,
    impact: mapCasebookDesignReleaseImpact({
      changedPaths: mr.changed_paths,
      subject: mr.commit_subject,
      body: mr.commit_body,
      branch: mr.branch,
      labels: mr.labels,
    }),
  }));
  const sourceContracts = casebookDesignCurrentSourceAttestations({ head, mergeRequests });
  for (const attestation of sourceContracts) {
    assert.equal(
      attestation.verified,
      true,
      `测试夹具的current-release源码鉴证必须完整通过：${attestation.contract_id} failures=${JSON.stringify(attestation.failures || [])}`,
    );
  }
  const sourceContractOriginCount = sourceContracts
    .filter((attestation) => attestation.origin_change_attestation !== null).length;
  const sourceContractOriginVerifiedCount = sourceContracts
    .filter((attestation) => attestation.origin_change_attestation?.verified === true
      && attestation.origin_change_attestation?.status === 'VERIFIED').length;
  assert.equal(sourceContractOriginCount, 1, '测试夹具必须真实包含 !1560 origin changes 鉴证');
  assert.equal(sourceContractOriginVerifiedCount, 1, '测试夹具的 !1560 origin changes 鉴证必须 VERIFIED');
  const risk = casebookDesignBlockingRisk({ blocked, head });
  assert.equal(risk.architecture, 'per-turn-utility-process/v1', '测试夹具必须按 !1559 后继架构审计当前 release');
  assert.equal(risk.assertion_owner?.mr_iid, '1559', '测试夹具必须由 !1559 后继合同接管阻断风险断言');
  assert.deepEqual(risk.protected_paths, casebookDesignSuccessorPaths, '测试夹具必须覆盖 !1559 后继架构全部七个受保护源码文件');
  const riskFailureIds = [...risk.failure_ids];
  const commitAccounting = mergeRequests.map((mr) => ({
    commit: mr.commit,
    parent_count: mr.parent_count,
    classification: 'merge_mr',
    mr_iid: mr.iid,
    attribution_verified: true,
    reason: '',
  }));
  const directCaseIds = [...new Set(mergeRequests.flatMap((mr) => mr.impact.direct_case_ids))].sort();
  const dependencyCaseIds = casebookDesignDependencyClosure(directCaseIds);
  const requiredStages = [...new Set(mergeRequests.flatMap((mr) => mr.impact.required_stages))].sort();
  const unmappedProductPaths = [...new Set(mergeRequests.flatMap((mr) => mr.impact.unmapped_product_paths))].sort();
  const outOfScopeCaseIds = [...new Set(mergeRequests.flatMap((mr) => mr.impact.out_of_scope_case_ids))].sort();
  const staticOnlyCount = mergeRequests.filter((mr) => (
    mr.impact.mapping_status === 'MAPPED' && mr.impact.direct_case_ids.length === 0
  )).length;
  const unknownCount = mergeRequests.filter((mr) => mr.impact.mapping_status === 'UNKNOWN').length;
  const report = {
    schema_version: 'qbot-qwork-release-intake/v1',
    tool: { name: 'qbot-release-intake', version: casebookDesignIntakeToolVersion },
    decision: blocked ? 'BLOCKED' : 'READY',
    blockers: blocked ? ['release 阻断风险审计未通过，存在必须在 G0 修复的 P1 执行隔离缺陷'] : [],
    release: { ref: 'origin/release/0.1', head },
    scan_boundary: {
      mode: 'commit_ancestry', baseline_commit: baseline, ancestry_verified: true,
      verification_source: 'gitlab-api', compare_attempts: [{ baseline_commit: baseline, ok: true }],
    },
    policy: {
      source_of_truth: 'commit-ancestry-first', fetch_latest: false, metadata_read_only: true,
      require_gitlab_metadata: true,
      api_freshness: {
        mode: 'gitlab-api', verified: !blocked, branch: 'release/0.1',
        branch_head_before: head, branch_head_after: head, compare_from: baseline, compare_to: head,
        compare_commit_count: 2,
        first_parent_commit_count: 2, accounted_commit_count: 2,
        merge_commit_count: 2, squash_mr_commit_count: 0,
        unattributed_direct_commit_count: 0, attributed_mr_commit_count: 2,
        first_parent_merge_count: 2, first_parent_complete: true,
        mr_changes_verified_count: 2,
        source_contract_count: sourceContracts.length, source_contract_verified_count: sourceContracts.length,
        source_contract_current_count: sourceContracts.length, source_contract_current_verified_count: sourceContracts.length,
        source_contract_origin_count: sourceContractOriginCount,
        source_contract_origin_verified_count: sourceContractOriginVerifiedCount,
        source_contracts_verified: true,
        blocking_risk_count: 1, blocking_risk_applicable_count: 1,
        blocking_risk_verified_count: blocked ? 0 : 1,
        blocking_risk_failure_count: riskFailureIds.length,
        blocking_risks_verified: !blocked,
      },
    },
    commit_accounting: commitAccounting,
    merge_requests: mergeRequests,
    source_contracts: sourceContracts,
    blocking_risks: [risk],
    summary: {
      scanned_commit_count: 2, merge_request_count: 2,
      direct_case_ids: directCaseIds,
      dependency_case_ids: dependencyCaseIds,
      required_stages: requiredStages,
      static_only_count: staticOnlyCount,
      unknown_count: unknownCount,
      source_contract_count: sourceContracts.length, source_contract_verified_count: sourceContracts.length,
      source_contract_current_count: sourceContracts.length, source_contract_current_verified_count: sourceContracts.length,
      source_contract_origin_count: sourceContractOriginCount,
      source_contract_origin_verified_count: sourceContractOriginVerifiedCount,
      source_contract_failure_count: 0,
      blocking_risk_count: 1, blocking_risk_applicable_count: 1,
      blocking_risk_verified_count: blocked ? 0 : 1,
      blocking_risk_failure_count: riskFailureIds.length,
    },
    unresolved: {
      unmapped_product_paths: unmappedProductPaths, out_of_scope_case_ids: outOfScopeCaseIds, unverified_mr_metadata: [],
      unattributed_direct_commits: [], api_errors: [],
      source_contract_failures: [],
      blocking_risk_failures: riskFailureIds.map((id) => `${casebookDesignRiskId}:${id}`),
    },
    integrity: {},
  };
  return sealCasebookDesignIntake(report);
};
const casebookDesignValidationOptions = { releaseRef: 'origin/release/0.1', sourceContracts: [] };
const readyCasebookDesignIntake = validateCasebookDesignReleaseIntake(
  casebookDesignIntakeFixture({ blocked: false }),
  casebookDesignValidationOptions,
);
assert.deepEqual(readyCasebookDesignIntake, { ok: true, acceptance: 'READY', failures: [] }, 'Casebook Builder 必须正常接受完整 READY intake');
const blockedCasebookDesignIntake = casebookDesignIntakeFixture({ blocked: true });
const blockedCasebookDesignValidation = validateCasebookDesignReleaseIntake(blockedCasebookDesignIntake, casebookDesignValidationOptions);
assert.deepEqual(blockedCasebookDesignValidation, { ok: true, acceptance: 'BLOCKED_MR1552_DESIGN_ONLY', failures: [] }, 'Casebook Builder 只可为设计生成接受完整鉴证的 MR !1552 产品阻断风险');
const assertCasebookDesignIntakeRejected = (mutate, label) => {
  const candidate = structuredClone(blockedCasebookDesignIntake);
  mutate(candidate);
  sealCasebookDesignIntake(candidate);
  assert.equal(validateCasebookDesignReleaseIntake(candidate, casebookDesignValidationOptions).ok, false, label);
};
assertCasebookDesignIntakeRejected((report) => report.blockers.push('unknown blocker'), 'Casebook Builder 必须拒绝额外或未知 blocker');
assertCasebookDesignIntakeRejected((report) => report.unresolved.unmapped_product_paths.push('unknown/product/path.ts'), 'Casebook Builder 必须拒绝 unmapped product path');
assertCasebookDesignIntakeRejected((report) => report.unresolved.api_errors.push('GitLab API timeout'), 'Casebook Builder 必须拒绝 API error');
assertCasebookDesignIntakeRejected((report) => report.unresolved.source_contract_failures.push('contract:failure'), 'Casebook Builder 必须拒绝源码合同失败');
assertCasebookDesignIntakeRejected((report) => { report.blocking_risks[0].source_files[0].error = 'read_failed'; }, 'Casebook Builder 必须拒绝 !1552 风险源码证据失败');
assertCasebookDesignIntakeRejected((report) => report.blocking_risks.push(structuredClone(report.blocking_risks[0])), 'Casebook Builder 必须拒绝多个 blocking risk');
assertCasebookDesignIntakeRejected((report) => { report.policy.api_freshness.branch_head_after = 'e'.repeat(40); }, 'Casebook Builder 必须拒绝 branch HEAD 漂移');
assertCasebookDesignIntakeRejected((report) => { report.policy.api_freshness.first_parent_complete = false; }, 'Casebook Builder 必须拒绝 compare first-parent 不完整');
assertCasebookDesignIntakeRejected((report) => { report.merge_requests[0].metadata_verified = false; }, 'Casebook Builder 必须拒绝未验证 MR metadata');
assertCasebookDesignIntakeRejected((report) => { report.decision = 'READY'; report.blockers = []; }, 'Casebook Builder 必须拒绝把 !1552 BLOCKED 伪造成 READY');
const forgedBlockedReadyIntake = casebookDesignIntakeFixture({ blocked: false });
forgedBlockedReadyIntake.decision = 'BLOCKED';
forgedBlockedReadyIntake.blockers = ['release 阻断风险审计未通过，存在必须在 G0 修复的 P1 执行隔离缺陷'];
sealCasebookDesignIntake(forgedBlockedReadyIntake);
assert.equal(validateCasebookDesignReleaseIntake(forgedBlockedReadyIntake, casebookDesignValidationOptions).ok, false, 'Casebook Builder 必须拒绝把 READY 伪造成 !1552 BLOCKED 例外');
assert.match(coreBetaPretestSource, /validateQworkReleaseIntake\(releaseIntake,[\s\S]*requireReady: true,[\s\S]*requireFreshRef: true[\s\S]*releaseIntake\.decision === 'READY'/, '正式 pretest 必须继续只接受 READY intake');
assert.match(qworkReleaseTestPlan, /validateQworkReleaseIntake\(releaseIntake,[\s\S]*requireReady: true,[\s\S]*requireFreshRef: true/, '正式发布状态机必须继续只接受 READY intake');
assert.match(
  qworkReleaseTestPlan,
  /(?=[\s\S]*nonEmptyString\(expectedReleaseRef\) !== QWORK_RELEASE_INTAKE_DEFAULT_REF)(?=[\s\S]*\^\[a-f0-9\]\{40\}\$\/i\.test\(nonEmptyString\(expectedReleaseHead\)\))(?=[\s\S]*if \(releaseIntake == null\)[\s\S]*release_intake_required)/,
  '发布计划必须强制 release intake 并使用独立 ref/HEAD 观测校验',
);
assert.match(
  qworkReleaseTestPlan,
  /(?=[\s\S]*release_intake_required: true)(?=[\s\S]*releaseIntakePlanBindingFailures\(plan\))(?=[\s\S]*release_intake_artifact_sha256_invalid)(?=[\s\S]*validateQworkReleaseIntake\(report)/,
  '状态机必须拒绝未绑定计划并校验 intake 文件 SHA 与内容',
);
assert.match(
  qworkReleaseOrchestrator,
  /required\(options, \[[\s\S]*'release-intake'[\s\S]*'expected-release-ref'[\s\S]*'expected-release-head'[\s\S]*\]\)[\s\S]*正式发布计划不能关闭 release intake 门禁[\s\S]*expectedReleaseRef: options\['expected-release-ref'\][\s\S]*expectedReleaseHead: options\['expected-release-head'\]/,
  '编排 CLI 必须在创建控制状态前强制 intake 和独立 release ref/HEAD',
);
assert.match(
  qworkReleaseOrchestrator,
  /function validatePlanSourceArtifacts\(plan\)[\s\S]*snapshots\.set\(specification\.role, stableFileSnapshot\([\s\S]*const intakeSnapshot = snapshots\.get\('release_intake'\)[\s\S]*parseJsonSnapshot\(intakeSnapshot, 'release intake'\)[\s\S]*validateQworkReleaseIntakeBinding\(\{[\s\S]*reportSha256: intakeSnapshot\.sha256/,
  '控制状态加载必须从同一稳定磁盘快照重读 intake、重算 SHA 并验证计划绑定',
);
assert.match(
  qworkReleaseOrchestrator,
  /function readiness\(options[\s\S]*loadControlState\([\s\S]*options\['state-dir'\][\s\S]*releaseIntake: sourceArtifacts\.releaseIntake[\s\S]*releaseIntakeSha256: sourceArtifacts\.snapshots\.get\('release_intake'\)\.sha256/,
  'readiness 必须消费控制状态加载时重新验证的 intake 内容与文件 SHA',
);
const skillHubFixtureManifest = JSON.parse(fs.readFileSync(path.join(root, 'testfixtures', 'skillhub-regression', 'manifest.json'), 'utf8'));
const coreGateCasebook = JSON.parse(fs.readFileSync(
  path.join(root, 'PRD', 'QBot核心上线门禁用例_Teams-QWork_2026-07-22_框架修复版.json'),
  'utf8',
));

const coreGateIds = coreGateCasebook.cases.map((item) => item.id);

const clarificationPrompt = '帮我做一份下周汇报。';
const clarificationLabel = '第1轮';
const clarificationPromptSha256 = createHash('sha256').update(clarificationPrompt).digest('hex');
const validClarificationInteraction = (dimension, promptText, overrides = {}) => ({
  label: clarificationLabel,
  prompt_text: promptText,
  clarification_dimensions: [dimension],
  prompt_sha256: clarificationPromptSha256,
  task_id: 'qa-task-clarification',
  send_confirmed: true,
  clicked: true,
  closed_or_advanced: true,
  before_screenshot_sha256: 'a'.repeat(64),
  after_screenshot_sha256: 'b'.repeat(64),
  evidence_valid: true,
  ...overrides,
});
const completeClarificationInteractions = [
  validClarificationInteraction('objective', '这份下周汇报的主题是什么？'),
  validClarificationInteraction('audience', '汇报对象和场合是？'),
  validClarificationInteraction('data_source', '你有没有现成的数据和材料？'),
];
assert.deepEqual(
  assistantClarificationEvidence(completeClarificationInteractions, {
    label: clarificationLabel,
    prompt: clarificationPrompt,
  }),
  {
    candidate_count: 3,
    valid_interaction_count: 3,
    dimensions: ['objective', 'audience', 'data_source'],
    dimension_count: 3,
    evidence_valid: true,
  },
  'SIT-HOME-057 必须把与当前轮发送和截图绑定的结构化澄清面板计入业务 Oracle',
);
assert.equal(
  caseAwareReplyAssertion(
    { id: 'SIT-HOME-057' },
    { label: clarificationLabel, prompt: clarificationPrompt },
    '下周汇报的信息还不够，我先跟你确认几件事，避免做偏。',
    { assistantConfirmationInteractions: completeClarificationInteractions },
  ).ok,
  true,
  '三组真实结构化澄清不能因最终正文不重复面板文案而误判为产品 Bug',
);
const incompleteClarificationInteractions = [
  validClarificationInteraction('objective', '这份下周汇报的主题是什么？'),
  validClarificationInteraction('audience', '汇报对象和场合是？', {
    after_screenshot_sha256: '',
    evidence_valid: false,
  }),
];
assert.equal(
  assistantClarificationEvidence(incompleteClarificationInteractions, {
    label: clarificationLabel,
    prompt: clarificationPrompt,
  }).valid_interaction_count,
  1,
  '缺少截图 SHA 的澄清交互不得计入有效证据',
);
assert.equal(
  caseAwareReplyAssertion(
    { id: 'SIT-HOME-057' },
    { label: clarificationLabel, prompt: clarificationPrompt },
    '下周汇报的信息还不够。',
    { assistantConfirmationInteractions: incompleteClarificationInteractions },
  ).ok,
  false,
  '只剩一个有效澄清维度时必须继续失败',
);
assert.equal(
  caseAwareReplyAssertion(
    { id: 'SIT-HOME-057' },
    { label: clarificationLabel, prompt: clarificationPrompt },
    '预算20万元，直接按这个数字生成完整汇报。',
    { assistantConfirmationInteractions: completeClarificationInteractions },
  ).ok,
  false,
  '即使结构化澄清完整，回复编造业务数字仍必须失败',
);

assert.doesNotMatch(
  automationFramework,
  /mktemp[^\n]*XXXXXX\.[^\s"')]+/,
  'macOS mktemp 要求 XXXXXX 位于模板末尾，框架合同不得在其后追加扩展名',
);
assert.match(
  productionGrayCasebookBuilder,
  /buildConversationTurns\(source, \[\]\)[\s\S]*const turns = conversationRequired \? legacyConversationTurns\(migrated\) : \[\]/,
  '160 Casebook 生成器必须复用运行时多轮合同，禁止把 legacy Case 压成单轮',
);
assert.match(
  productionGrayCasebookBuilder,
  /validateQworkReleaseIntake[\s\S]*requireFreshRef: true[\s\S]*scan_boundary\?\.baseline_commit !== PREVIOUS_CASEBOOK_PRODUCT_COMMIT/,
  '160 Casebook 生成器必须以完整正式API intake验证上一Casebook设计边界与最新增量终点',
);
assert.doesNotMatch(
  productionGrayCasebookBuilder,
  /cat-file/,
  '160 Casebook 生成器不得要求本地仓库保留已由正式API intake验证的历史Git对象',
);
assert.doesNotMatch(
  coreBetaOperatingGuide,
  /mktemp[^\n]*XXXXXX\.[^\s"')]+/,
  'Core Beta 操作指南不得重新引入 macOS 不兼容的 mktemp 后缀',
);
assert.match(
  automationFramework,
  /BETA-HOST-003[\s\S]*teams_local_execution[\s\S]*host_lifecycle_trace[\s\S]*data_integrity_readback[\s\S]*oracle_valid=false[\s\S]*fail-closed/,
  '框架合同必须固定 Teams legacy 主机证据归一化和产品 Oracle/证据分离',
);
assert.match(
  coreBetaOperatingGuide,
  /BETA-HOST-003[\s\S]*teams_local_execution[\s\S]*host_lifecycle_trace[\s\S]*data_integrity_readback[\s\S]*fail-closed/,
  'Core Beta 操作指南必须固定 legacy 主机证据归一化的 fail-closed 合同',
);
assert.match(
  coreBetaOperatingGuide,
  /renderer 导航造成[\s\S]*最多 3 次有界[\s\S]*不得重试/,
  'Core Beta 操作指南必须固定 renderer 导航瞬态的有界重试合同',
);
assert.match(
  automationFramework,
  /renderer 导航瞬态[\s\S]*最多 3 次有界[\s\S]*target\/page\/browser closed[\s\S]*不得重试/,
  '框架合同必须固定 renderer 导航瞬态的有界重试和关闭态禁止重试',
);
assert.match(
  runner,
  /renderer-capture-attempts\.json[\s\S]*qbot-core-beta-renderer-capture-attempts\/v1[\s\S]*renderer_capture_attempts_file/,
  'renderer 瞬态重试耗尽时必须落盘完整 attempts 诊断，而不是丢失原始错误',
);
assert.match(
  qworkDailyCasebookBuilder,
  /\['QW-ENTRY-002', 'QWD-ENTRY-002'\][\s\S]*row\.id === 'QW-ENTRY-002'[\s\S]*\['BETA-INIT-004', CUSTOM_LEAF\.get\(row\.id\)\]/,
  'QW-ENTRY-002 必须使用独立QWD入口driver，禁止重新映射到依赖deep_use账本的BETA-SKILL-011',
);
assert.match(
  qworkDailyCasebookBuilder,
  /\['QW-WS-001', 'QWD-WS-001'\][\s\S]*id === 'QWD-WS-001'[\s\S]*task_lifecycle/,
  'QW-WS-001 必须使用专项 QWD 工作空间任务绑定 driver，禁止继续映射到旧 HOME-052',
);
assert.match(
  qworkDailyCasebookBuilder,
  /row\.id === 'QW-EXPERT-005'[\s\S]{0,600}'BETA-EXPERT-003'[\s\S]{0,200}'BETA-EXPERT-007'/,
  'QW-EXPERT-005 必须先建立Codex草稿再发布三类专家，禁止生成逆序账本依赖',
);

assert.deepEqual(
  coreBetaSelectedCapabilityIdentities([
    { key: 'mcphub:fkai-wiki-llm' },
    { slug: 'skill-a' },
    'plain-capability',
    null,
    {},
  ]),
  ['mcphub:fkai-wiki-llm', 'skill-a', 'plain-capability'],
  'Core Beta v2 必须在手动连接器点击后直接读回 selectedConnectors identity，不能依赖未定义的旧 runner helper',
);

{
  const screenshotRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'qbot-mcp-cross-surface-'));
  try {
    const makeReceipt = ({
      index,
      key,
      selected = true,
      persisted = selected,
      stage = 'manual_connector_selection',
    }) => {
      const screenshotPath = path.join(screenshotRoot, `${index}-${key.replace(/[^a-z0-9]+/gi, '-')}.png`);
      fs.writeFileSync(screenshotPath, Buffer.alloc(256, index + 1));
      const interactionSelectedConnectors = selected ? [key] : [];
      const selectedConnectors = persisted ? [key] : [];
      const before = {
        captured_at: '2026-08-07T00:00:00.000Z',
        case_id: 'BETA-MCP-002',
        task: { id: null, running: false, send_count: 35, message_count: 0 },
        connectors: { selected: [] },
        capabilities: { selectedConnectors: [] },
      };
      const after = {
        captured_at: '2026-08-07T00:00:01.000Z',
        case_id: 'BETA-MCP-002',
        task: { id: null, running: false, send_count: 35, message_count: 0 },
        connectors: { selected: selectedConnectors },
        capabilities: { selectedConnectors, connectorRouting: { mode: stage === 'manual_mode' ? 'auto' : 'manual' } },
      };
      const interaction = {
        schema_version: 'qbot-core-beta-capability-interaction/v1',
        capability_kind: 'connector',
        stage,
        expected_identity: key,
        control_located: true,
        click_dispatched: true,
        expected_state_observed: selected,
        aria_checked: selected ? 'true' : 'false',
        category: selected ? '' : 'bug',
        screenshot: screenshotPath,
        ...(stage === 'manual_connector_selection'
          ? { selected_connectors: interactionSelectedConnectors }
          : { manual_surface: { list_visible: false, option_count: 0, empty_visible: false } }),
      };
      return {
        schema_version: 'qbot-core-beta-mcp-cross-surface-receipt/v1',
        case_id: 'BETA-MCP-002',
        captured_at: '2026-08-07T00:00:02.000Z',
        index,
        key,
        reset_ok: stage !== 'manual_mode',
        selection_attempted: stage === 'manual_connector_selection',
        selected,
        capability_selected: persisted,
        selected_connectors: selectedConnectors,
        tools: [{ name: `${key}-read`, read_only: true }],
        health: {},
        visible_text: 'manual connector surface',
        interaction,
        public_readback: { before, after },
        task_guard: {
          task_absent_before: true,
          task_absent_after: true,
          not_running_before: true,
          not_running_after: true,
          message_count_zero_before: true,
          message_count_zero_after: true,
          send_count_observed: true,
          send_count_unchanged: true,
          valid: true,
        },
        screenshot: {
          valid: true,
          path: screenshotPath,
          sha256: createHash('sha256').update(fs.readFileSync(screenshotPath)).digest('hex'),
        },
      };
    };
    const receipts = [
      makeReceipt({ index: 0, key: 'mcphub:wiki' }),
      makeReceipt({ index: 1, key: 'mcphub:dis', selected: false }),
      makeReceipt({ index: 2, key: 'mcphub:iops', selected: true, persisted: false }),
      makeReceipt({ index: 3, key: 'mcphub:wecom' }),
      makeReceipt({ index: 4, key: 'mcphub:qbi', selected: false, stage: 'manual_mode' }),
    ];
    const outcome = coreBetaMcpCrossSurfaceOutcome(receipts);
    assert.equal(outcome.valid, true, 'MCP产品拒绝选择或手动模式不生效时，完整负向收据仍须通过manifest有效性门禁');
    assert.equal(outcome.evidence_valid, true);
    assert.equal(outcome.oracle_valid, false, '任一固定connector未选中时业务Oracle必须失败');
    assert.equal(outcome.observed_count, 5);
    assert.equal(outcome.unique_key_count, 5);
    assert.equal(receipts[2].selected, true, '点击后的瞬时UI读回应保留');
    assert.equal(receipts[2].capability_selected, false, '稍后的公共读回未持久化时必须与瞬时UI读回分离');
    assert.equal(
      coreBetaMcpCrossSurfaceReceiptEvidenceValid(receipts[2]),
      true,
      'connector瞬时选中但随后公共读回消失，仍是证据完整的产品负向收据',
    );
    assert.equal(coreBetaMcpCrossSurfaceOutcome(receipts.slice(0, 4)).evidence_valid, false, '缺少任一固定connector收据仍须按框架证据缺口失败');

    const transientBridgeRead = {
      schema_version: 'qbot-core-beta-capability-interaction/v1',
      capability_kind: 'connector',
      stage: 'manual_connector_selection',
      expected_identity: 'mcphub:dis',
      control_located: true,
      click_dispatched: true,
      expected_state_observed: false,
      selected_connectors: null,
      category: 'bug',
    };
    const fallbackInteraction = coreBetaMcpNormalizeInteraction(transientBridgeRead, {
      connectors: { selected: [] },
    });
    assert.deepEqual(fallbackInteraction.selected_connectors, [], '任务绑定公共状态读回为空选择时，必须补齐瞬时 bridge null 读回');
    assert.equal(fallbackInteraction.selected_connectors_source, 'public-state-readback-fallback');

    const controlMissing = structuredClone(receipts[0]);
    controlMissing.interaction.control_located = false;
    assert.equal(coreBetaMcpCrossSurfaceReceiptEvidenceValid(controlMissing), false, '精确控件未定位不能伪装成完整产品负向证据');
    const clickMissing = structuredClone(receipts[0]);
    clickMissing.interaction.click_dispatched = false;
    assert.equal(coreBetaMcpCrossSurfaceReceiptEvidenceValid(clickMissing), false, '真实点击未派发必须保持框架证据无效');
    const guardMissing = structuredClone(receipts[0]);
    guardMissing.task_guard.send_count_observed = false;
    guardMissing.task_guard.valid = false;
    assert.equal(coreBetaMcpCrossSurfaceReceiptEvidenceValid(guardMissing), false, '任务零变更守卫不完整必须保持框架证据无效');
    const readbackMissing = structuredClone(receipts[0]);
    delete readbackMissing.public_readback.after.capabilities;
    assert.equal(coreBetaMcpCrossSurfaceReceiptEvidenceValid(readbackMissing), false, '公开 capabilities 读回缺失必须保持框架证据无效');
    const interactionReadbackMissing = structuredClone(receipts[2]);
    delete interactionReadbackMissing.interaction.selected_connectors;
    assert.equal(coreBetaMcpCrossSurfaceReceiptEvidenceValid(interactionReadbackMissing), false, '点击后的瞬时选择读回缺失仍须按框架证据缺口失败');
  } finally {
    fs.rmSync(screenshotRoot, { recursive: true, force: true });
  }
}

{
  const historicalDraft = {
    id: 'historical-draft-001',
    revision: 5,
    status: 'editable',
    dependencies: [{ kind: 'skill', identity: 'global/source-verification' }],
  };
  const taskId = 'task-expert-builder-negative-001';
  const negative = coreBetaExpertBuilderOutcomeEvidence({
    runtimeFamily: 'claude-code',
    observedRuntimeFamily: 'claude-code',
    builderIdentity: 'qwork.builtin.expert-authoring',
    beforeDrafts: [historicalDraft],
    afterDrafts: [historicalDraft],
    createdDrafts: [],
    taskId,
    replyRecords: [{
      label: '第1轮',
      assistant_reply_present: true,
      terminal_outcome: 'completed',
      fullText: `复用已有草稿 ${historicalDraft.id}，未创建新草稿。`,
    }],
    authoringToolTrace: { task_id: taskId, call_count: 0, calls: [] },
  });
  assert.equal(negative.evidence_valid, true, '历史草稿复用仍应形成完整、task-bound 的负向读回证据');
  assert.equal(negative.oracle_valid, false, '没有本轮新 owner draft 时产品 Oracle 必须失败');
  assert.equal(negative.reason, 'no_run_owned_draft_created');
  assert.deepEqual(negative.expert_draft_lifecycle.reused_existing_draft_ids, [historicalDraft.id]);

  const evidenceDir = fs.mkdtempSync(path.join(os.tmpdir(), 'qbot-expert-builder-negative-'));
  try {
    const roles = ['expert_draft_lifecycle', 'expert_dependency_graph', 'artifact_path_sha256', 'content_readback'];
    const artifacts = {};
    for (const role of roles) {
      const file = path.join(evidenceDir, `${role}.json`);
      writeJsonFile(file, { valid: negative[role].evidence_valid, ...negative[role] });
      artifacts[role] = file;
      assert.deepEqual(
        validateEvidenceFile(role, file),
        { valid: true },
        `${role} 的结构化产品失败读回必须满足 manifest 证据角色`,
      );
    }
    const manifest = buildCoreEvidenceManifest({
      testCase: { id: 'BETA-EXPERT-002', evidence_roles: roles },
      caseDir: evidenceDir,
      artifacts,
    });
    assert.equal(manifest.complete, true, '产品未创建本轮 ExpertDraft 不得再触发 framework stop');
    assert.deepEqual(manifest.missing_roles, []);
    assert.deepEqual(manifest.invalid_roles, []);
    assert.equal(
      resultHasAutomationError({
        result_category: 'bug',
        steps: [],
        assertions: [{ status: 'failed', category: 'bug', actual: negative.reason }],
      }),
      false,
      '证据完整的 Expert Builder 产品失败必须保持 bug 分类并允许串行批次继续',
    );
  } finally {
    fs.rmSync(evidenceDir, { recursive: true, force: true });
  }

  const incomplete = coreBetaExpertBuilderOutcomeEvidence({
    runtimeFamily: 'claude-code',
    observedRuntimeFamily: 'claude-code',
    builderIdentity: 'qwork.builtin.expert-authoring',
    beforeDrafts: [historicalDraft],
    afterDrafts: [historicalDraft],
    createdDrafts: [],
    taskId: '',
    replyRecords: [{ label: '第1轮', assistant_reply_present: true, terminal_outcome: 'completed' }],
    authoringToolTrace: { task_id: '', call_count: 0, calls: [] },
  });
  assert.equal(incomplete.evidence_valid, false, '缺少 task-bound 负向读回时必须继续 fail-closed');
  assert.equal(incomplete.reason, 'expert_builder_negative_readback_incomplete');

  const createdDraft = { id: 'run-owned-draft-001', revision: 1, status: 'editable' };
  const positive = coreBetaExpertBuilderOutcomeEvidence({
    runtimeFamily: 'claude-code',
    observedRuntimeFamily: 'claude-code',
    builderIdentity: 'qwork.builtin.expert-authoring',
    beforeDrafts: [historicalDraft],
    afterDrafts: [historicalDraft, createdDraft],
    createdDrafts: [createdDraft],
    createdDetail: {
      draft: createdDraft,
      dependencies: {
        draftId: createdDraft.id,
        dependencies: [{
          kind: 'skill',
          source: 'skillhub-draft',
          assetId: 'asset-skill-001',
          packageDigest: 'a'.repeat(64),
          required: true,
        }],
      },
    },
    taskId,
    replyRecords: [{ label: '第1轮', assistant_reply_present: true, terminal_outcome: 'completed' }],
    authoringToolTrace: { task_id: taskId, call_count: 2, calls: [{ name: 'create_expert_draft' }] },
  });
  assert.equal(positive.evidence_valid, true);
  assert.equal(positive.oracle_valid, true, '本轮新 draft、staged Skill 与 task-bound tool trace 完整时 Oracle 应通过');
  assert.equal(positive.expert_dependency_graph.staged_skill_valid, true);
}

{
  const testCase = {
    id: 'BETA-CHAT-001',
    case_type: 'conversation',
    contract_version: 'qbot-core-beta/v2',
    automation_protocol: 'qbot-core-beta/v2',
    evidence_schema_version: 'qbot-core-evidence/v2',
    pipeline_policy: 'serial',
    batch_size: 1,
    action_plan: [],
    conversation_turns: [],
    evidence_roles: [],
  };
  const failed = {
    id: 'BETA-CHAT-001',
    status: 'failed',
    result_category: 'automation_error',
    synthetic: false,
    evidence_manifest: { complete: false, missing_roles: ['reply_delta'], invalid_roles: [] },
    actual_result: '截图或回复证据未生成',
  };
  annotateCoreBetaExecutionResult({
    testCase,
    result: failed,
    completionIssue: '框架发布门禁 BETA-CHAT-001 拒绝不完整 manifest',
  });
  assert.equal(failed.status, 'failed', '已执行 Case 的 automation_error 必须落为 failed');
  assert.equal(failed.result_category, 'automation_error');
  assert.equal(failed.case_execution_recorded, true);
  assert.equal(failed.execution_completion.evidence_complete, false);
  assert.equal(failed.execution_provenance, 'executed');
  assert.equal(
    failed.contract_sha256,
    coreBetaCaseContractSha256(testCase),
    '真实执行结果必须直接封印运行前完整 Case 合同，不能从结果残片重新推导',
  );

  const productFailure = {
    id: 'BETA-EXPERT-005',
    status: 'failed',
    result_category: 'bug',
    synthetic: false,
    evidence_manifest: { complete: true, missing_roles: [], invalid_roles: [] },
    actual_result: '产品 CAS Oracle 未通过',
  };
  annotateCoreBetaExecutionResult({
    testCase: { id: productFailure.id, contract_version: 'qbot-core-beta/v2' },
    result: productFailure,
  });
  assert.equal(productFailure.status, 'failed', '产品 Oracle 失败必须保留 failed 结果');
  assert.equal(productFailure.result_category, 'bug');
  assert.equal(productFailure.execution_completion.evidence_complete, true);
  assert.equal(productFailure.case_execution_recorded, true);

  const initializationActionObserved = (caseId, actionObserved = true) => ({
    schema_version: 'qbot-core-beta-initialization-action-observation/v1',
    case_id: caseId,
    method: 'preparePythonRuntimes',
    testid: 'assistant-prepare-python-runtimes',
    action_observed: actionObserved,
    source: actionObserved ? 'busy' : 'none',
    attempts: [{ attempt: 1, action_observed: actionObserved }],
  });
  const initializationFailure = {
    id: 'BETA-INIT-001',
    status: 'failed',
    result_category: 'bug',
    synthetic: false,
    evidence_manifest: { complete: true, missing_roles: [], invalid_roles: [] },
    initialization_action_observation: initializationActionObserved('BETA-INIT-001'),
    initialization_continuation: coreBetaInitializationContinuation({
      testCase: { id: 'BETA-INIT-001' },
      terminalReadback: {
        pending: false,
        failed: true,
        loaded: true,
        sdk_ready: true,
        button_enabled: true,
        composer_ready: true,
        workbench_ready: true,
        capabilities_readable: true,
      },
      continuationSurface: { valid: true, composer_ready: true, workbench_ready: true },
      afterReadback: { page: { body_text_length: 100 } },
    }),
    actual_result: '运行时维护动作失败，但工作台可继续收集独立 Case 证据',
  };
  annotateCoreBetaExecutionResult({
    testCase: { id: initializationFailure.id, contract_version: 'qbot-core-beta/v2' },
    result: initializationFailure,
  });
  assert.equal(
    initializationFailure.execution_completion.release_gate_eligible,
    false,
    '初始化连续性明确禁止放行时，即使 manifest 完整也不得标记为 release-gate eligible',
  );
  assert.equal(
    initializationFailure.execution_completion.reason,
    '初始化连续性合同明确禁止本 Case 进入发布放行。',
  );

  const unsafeInitializationFailure = {
    id: 'BETA-INIT-001',
    status: 'failed',
    result_category: 'bug',
    synthetic: false,
    evidence_manifest: { complete: true, missing_roles: [], invalid_roles: [] },
    initialization_action_observation: initializationActionObserved('BETA-INIT-001'),
    initialization_continuation: coreBetaInitializationContinuation({
      testCase: { id: 'BETA-INIT-001' },
      terminalReadback: {
        pending: false,
        failed: true,
        loaded: true,
        sdk_ready: true,
        button_enabled: true,
        composer_ready: true,
        workbench_ready: true,
        capabilities_readable: false,
      },
      continuationSurface: { valid: true, composer_ready: true, workbench_ready: true },
      afterReadback: { page: { body_text_length: 100 } },
    }),
    actual_result: '完成：Python 0 个就绪、22 个失败；Node 1 个就绪',
    primary_failure: {
      category: 'bug',
      reason: '完成：Python 0 个就绪、22 个失败；Node 1 个就绪',
      source: 'markFailed',
      recorded_at: '2026-09-05T01:45:34.173Z',
    },
    failure_history: [{
      category: 'bug',
      reason: '完成：Python 0 个就绪、22 个失败；Node 1 个就绪',
      source: 'markFailed',
      recorded_at: '2026-09-05T01:45:34.173Z',
    }],
  };
  annotateCoreBetaExecutionResult({
    testCase: { id: unsafeInitializationFailure.id, contract_version: 'qbot-core-beta/v2' },
    result: unsafeInitializationFailure,
  });
  assert.equal(
    unsafeInitializationFailure.result_category,
    'automation_error',
    '初始化连续性 safe=false 时不得把公开能力缺口保留为产品 bug',
  );
  assert.equal(unsafeInitializationFailure.primary_failure.category, 'automation_error');
  assert.equal(
    unsafeInitializationFailure.failure_history[0].category,
    'bug',
    '提升为 automation_error 时必须保留原始产品失败候选',
  );
  assert.equal(
    unsafeInitializationFailure.failure_history.at(-1).source,
    'initialization_continuation',
    '安全门禁失败必须留下独立、可审计的失败来源',
  );
  assert.equal(
    unsafeInitializationFailure.failure_history[0].reason,
    '完成：Python 0 个就绪、22 个失败；Node 1 个就绪',
    '框架分类修复不得抹去产品维护终态',
  );
  assert.equal(unsafeInitializationFailure.execution_completion.release_gate_eligible, false);
  const failureHistoryLength = unsafeInitializationFailure.failure_history.length;
  enforceCoreBetaInitializationContinuationOutcome(unsafeInitializationFailure);
  assert.equal(
    unsafeInitializationFailure.failure_history.length,
    failureHistoryLength,
    'Case 收尾与外层注解重复执行同一安全门禁时必须幂等',
  );
  unsafeInitializationFailure.result_category = 'bug';
  unsafeInitializationFailure.primary_failure = unsafeInitializationFailure.failure_history[0];
  unsafeInitializationFailure.actual_result = unsafeInitializationFailure.failure_history[0].reason;
  enforceCoreBetaInitializationContinuationOutcome(unsafeInitializationFailure);
  assert.equal(
    unsafeInitializationFailure.result_category,
    'automation_error',
    '后置注解误写回 bug 时，幂等门禁仍必须重新固定 automation_error 顶层分类',
  );
  assert.equal(
    unsafeInitializationFailure.failure_history.length,
    failureHistoryLength,
    '重新固定顶层分类不得重复追加同一 continuation failure',
  );

  const unobservedInitializationAction = {
    ...initializationFailure,
    initialization_action_observation: initializationActionObserved('BETA-INIT-001', false),
    failure_history: [],
    primary_failure: null,
  };
  const unobservedActionVerdict = coreBetaInitializationContinuationVerdict(unobservedInitializationAction);
  assert.equal(unobservedActionVerdict.safe, false);
  assert.ok(unobservedActionVerdict.reasons.includes('initialization_action_not_observed'));
  enforceCoreBetaInitializationContinuationOutcome(unobservedInitializationAction);
  assert.equal(
    unobservedInitializationAction.result_category,
    'automation_error',
    '维护终态即使像产品失败，真实动作未观察到也必须归 framework issue',
  );

  const malformedSafeContinuation = {
    ...initializationFailure,
    initialization_continuation: {
      ...initializationFailure.initialization_continuation,
      case_id: 'BETA-INIT-002',
    },
    failure_history: [],
    primary_failure: null,
  };
  assert.equal(coreBetaInitializationContinuationVerdict(malformedSafeContinuation).safe, false);
  enforceCoreBetaInitializationContinuationOutcome(malformedSafeContinuation);
  assert.equal(malformedSafeContinuation.result_category, 'automation_error');

  const conflictDir = fs.mkdtempSync(path.join(os.tmpdir(), 'qbot-expert-conflict-negative-'));
  try {
    const conflictFile = path.join(conflictDir, 'expert-conflict-trace.json');
    writeJsonFile(conflictFile, {
      valid: true,
      evidence_valid: true,
      oracle_valid: false,
      case_id: 'BETA-EXPERT-005',
      data: {
        original: { id: 'draft-1', revision: 2 },
        writer_a: { id: 'draft-1', revision: 3 },
        stale_rejected: false,
        merged: { id: 'draft-1', revision: 4 },
      },
    });
    assert.deepEqual(
      validateEvidenceFile('expert_conflict_trace', conflictFile),
      { valid: true },
      'CAS Oracle 失败但 revision 读回完整时，conflict trace 必须作为有效负向证据保留',
    );
    const manifest = buildCoreEvidenceManifest({
      testCase: { id: 'BETA-EXPERT-005', evidence_roles: ['expert_conflict_trace'] },
      caseDir: conflictDir,
      artifacts: { expert_conflict_trace: conflictFile },
    });
    assert.equal(manifest.complete, true, 'CAS 产品失败不得因 valid=false 造成 manifest 缺口');
    assert.deepEqual(manifest.invalid_roles, []);
  } finally {
    fs.rmSync(conflictDir, { recursive: true, force: true });
  }
}

assert.doesNotMatch(
  runner,
  /\['BETA-EXPERT-008',[\s\S]{0,12000}?bridge\.experts\.find\(\(item\) =>[\s\S]{0,500}?activeReleaseId/,
  '发布专家依赖 Case 禁止回退到账号内任意 active expert',
);
assert.equal(
  coreBetaRunOwnedExpertPrerequisiteBlocker({
    testCase: { id: 'BETA-EXPERT-010', evidence_roles: [] },
    ledgerExperts: {},
    availableExperts: [{
      id: 'arbitrary-active',
      activeReleaseId: 'arbitrary-release',
      version: { id: 'arbitrary-version' },
    }],
    publicState: {
      task: { id: null, running: false, message_count: 0 },
      expert: null,
      skills: { selected: [] },
      connectors: { selected: [] },
    },
  }).selected_expert,
  null,
  '本轮 ledger 缺失时，即使账号存在 active expert 也必须忽略并可信阻塞',
);

const expertPublishPrerequisiteRoles = [
  'expert_publish_operation',
  'restart_trace',
  'credential_redaction_scan',
  'capability_selection',
  'capability_execution_event',
];
assert.deepEqual(
  coreBetaExpertDraftConcurrencyIdentity({ id: 'revision-draft', revision: 7 }),
  {
    id: 'revision-draft',
    etag: '',
    revision: 7,
    cas_kind: 'revision',
    cas_value: 7,
    complete: true,
  },
  '新版专家 bridge 的正整数 revision 必须作为真实发布 CAS，禁止硬要求 etag',
);
assert.equal(
  coreBetaExpertDraftConcurrencyIdentity({ id: 'missing-cas' }).complete,
  false,
  'draftId 存在但 etag/revision 均缺失时仍必须 fail-closed',
);
const expertPublishPrerequisiteCase = {
  id: 'BETA-EXPERT-007',
  evidence_roles: expertPublishPrerequisiteRoles,
};
const emptyExpertPublishState = {
  case_id: 'BETA-EXPERT-007',
  task: { id: null, running: false, message_count: 0, send_count: 35 },
  expert: null,
  skills: { selected: [] },
  connectors: { selected: [] },
};
const expertPublishBlocker = coreBetaExpertPublishPrerequisiteBlocker({
  testCase: expertPublishPrerequisiteCase,
  ledgerExperts: {
    manual_draft: { id: 'delivery-draft', revision: 2 },
  },
  availableDrafts: [{ id: 'historical-draft', etag: 'historical-etag', revision: 4 }],
  publicState: emptyExpertPublishState,
});
assert.equal(expertPublishBlocker.valid, true, '三类本轮草稿缺失时必须形成可信发布前置 blocker');
assert.equal(expertPublishBlocker.outcome, 'blocked');
assert.deepEqual(expertPublishBlocker.missing_draft_keys, ['claude-code_draft', 'codex_draft']);
assert.deepEqual(expertPublishBlocker.not_applicable_roles, expertPublishPrerequisiteRoles);
assert.equal(expertPublishBlocker.historical_draft_fallback_forbidden, true);
assert.deepEqual(expertPublishBlocker.selected_draft_ids, []);
assert.equal(
  coreBetaExpertPublishPrerequisiteBlocker({
    testCase: expertPublishPrerequisiteCase,
    ledgerExperts: {
      'claude-code_draft': { id: 'research-draft', revision: 2 },
      codex_draft: { id: 'data-draft', revision: 3 },
      manual_draft: { id: 'delivery-draft', revision: 4 },
    },
  }).ready,
  true,
  '当前 revision CAS 的三类草稿身份完整时必须允许进入真实发布',
);
assert.equal(
  coreBetaExpertPublishPrerequisiteBlocker({
    testCase: expertPublishPrerequisiteCase,
    ledgerExperts: {
      'claude-code_draft': { id: 'research-draft', etag: 'research-etag' },
      codex_draft: { id: 'data-draft' },
      manual_draft: { id: 'delivery-draft', etag: 'delivery-etag' },
    },
    publicState: emptyExpertPublishState,
  }).outcome,
  'automation_error',
  '本轮草稿账本条目存在但 draftId/CAS 残缺时必须 fail-closed',
);
assert.match(
  runner,
  /manualDraftIdentity\.complete\) ledger\.experts\.manual_draft = manualDraft;[\s\S]*else delete ledger\.experts\.manual_draft/,
  'BETA-EXPERT-004 只有取得真实 draftId/CAS 后才可写成功账本，产品失败不得污染下游',
);
assert.match(
  runner,
  /lifecycle\.publish\([\s\S]*draftCas,[\s\S]*keyPrefix/,
  'BETA-EXPERT-007 发布必须传回草稿公开 etag 或 revision CAS',
);
const expertPublishEvidenceDir = fs.mkdtempSync(path.join(os.tmpdir(), 'qbot-core-beta-expert-publish-prerequisite-'));
try {
  const blockerFile = path.join(expertPublishEvidenceDir, 'run-owned-expert-publish-prerequisite.json');
  writeJsonFile(blockerFile, expertPublishBlocker);
  const artifacts = {
    core_beta_not_applicable_roles: expertPublishPrerequisiteRoles.map((role) => ({
      role,
      blocker_path: blockerFile,
    })),
  };
  const manifest = buildCoreEvidenceManifest({
    testCase: expertPublishPrerequisiteCase,
    caseDir: expertPublishEvidenceDir,
    artifacts,
  });
  assert.equal(manifest.complete, true, 'BETA-EXPERT-007 上游草稿缺失必须生成完整 N/A manifest');
  assert.deepEqual(manifest.missing_roles, []);

  const inconsistentRequirements = expertPublishBlocker.requirements.map((item) => (
    item.ledger_key === 'manual_draft'
      ? { ...item, cas_kind: 'etag', cas_value: 'invented-etag' }
      : item
  ));
  writeJsonFile(blockerFile, {
    ...expertPublishBlocker,
    requirements: inconsistentRequirements,
    ledger_snapshot_sha256: createHash('sha256')
      .update(JSON.stringify(inconsistentRequirements)).digest('hex'),
  });
  const inconsistentCas = buildCoreEvidenceManifest({
    testCase: expertPublishPrerequisiteCase,
    caseDir: expertPublishEvidenceDir,
    artifacts,
  });
  assert.deepEqual(
    inconsistentCas.missing_roles,
    expertPublishPrerequisiteRoles,
    'revision 草稿伪装成 etag CAS 时必须重新 fail-closed',
  );

  writeJsonFile(blockerFile, {
    ...expertPublishBlocker,
    missing_draft_keys: ['manual_draft'],
  });
  const tampered = buildCoreEvidenceManifest({
    testCase: expertPublishPrerequisiteCase,
    caseDir: expertPublishEvidenceDir,
    artifacts,
  });
  assert.deepEqual(
    tampered.missing_roles,
    expertPublishPrerequisiteRoles,
    '发布前置 blocker 的缺失键与逐项账本快照不一致时必须重新 fail-closed',
  );
} finally {
  fs.rmSync(expertPublishEvidenceDir, { recursive: true, force: true });
}
assert.match(
  runner,
  /BETA-EXPERT-007[\s\S]*coreBetaExpertPublishPrerequisiteBlocker[\s\S]*applyCoreBetaExpertPublishPrerequisite[\s\S]*return;/,
  'BETA-EXPERT-007 缺少上游草稿时必须走 prerequisite blocked 而不是 throw',
);
assert.doesNotMatch(
  runner,
  /throw new Error\('BETA-EXPERT-007 缺少研究\/数据\/交付三类本轮草稿'\)/,
  'BETA-EXPERT-007 不得再因可预期的上游草稿缺失直接中断批次',
);

{
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'qbot-skill-creator-fixture-'));
  assert.equal(
    coreBetaQbotHomeFromUiUrl('file:///Users/qa/.deepbank-uat/ui/0.0.29/index.html'),
    '/Users/qa/.deepbank-uat',
    'Teams file UI URL 必须精确推断 QWork home，不能退回用户全局 HOME',
  );
  assert.equal(
    coreBetaQbotHomeFromUiUrl('file:///Users/qa/.deepbank-sit/ui/0.1.2-sit.7/index.html'),
    '/Users/qa/.deepbank-sit',
    'SIT versioned QWork UI 必须精确推断隔离 release home',
  );
  assert.equal(
    coreBetaProductHomeForUi({
      uiUrl: 'file:///Users/qa/.deepbank-uat/ui/0.0.30/index.html',
      options: { 'qbot-home': '/tmp/teams-control-plane-home' },
    }),
    '/Users/qa/.deepbank-uat',
    'Skill Creator 产品产物必须优先绑定当前 versioned QWork release home，不能误用 Teams 控制面 home',
  );
  assert.equal(
    coreBetaProductHomeForUi({
      uiUrl: 'https://example.test/qwork',
      options: { 'qbot-home': '/tmp/local-qbot-home' },
    }),
    '/tmp/local-qbot-home',
    '非 file UI 无法推导 release home 时才允许回退到显式本地 qbot-home',
  );
  const caseDir = path.join(root, 'out-a', 'cases', '036-BETA-SKILL-014');
  const fixture = coreBetaSkillCreatorFixture({ qbotHome: root, caseDir });
  assert.match(fixture.slug, /^qa-meeting-minutes-[a-f0-9]{12}$/);
  assert.equal(
    fixture.slug,
    coreBetaSkillCreatorFixtureSlug(caseDir),
    'Skill Creator fixture slug 必须按不可变 Case 路径稳定派生',
  );
  assert.notEqual(
    fixture.slug,
    coreBetaSkillCreatorFixtureSlug(path.join(root, 'out-b', 'cases', '036-BETA-SKILL-014')),
    '不同不可变批次必须使用不同 Skill 名称，禁止撞上前序残留',
  );
  const memoryCollisionCaseDir = path.join(root, 'out-memory-collision', 'cases', '036-BETA-SKILL-014');
  const memoryCollisionSlug = coreBetaSkillCreatorFixtureSlug(memoryCollisionCaseDir);
  const preexistingMemory = path.join(
    root,
    'runtime-homes',
    'claude',
    'projects',
    'existing-project',
    'memory',
    `${memoryCollisionSlug}.md`,
  );
  fs.mkdirSync(path.dirname(preexistingMemory), { recursive: true });
  fs.writeFileSync(preexistingMemory, `Preexisting memory for ${memoryCollisionSlug}\n`);
  const collisionSafeFixture = coreBetaSkillCreatorFixture({ qbotHome: root, caseDir: memoryCollisionCaseDir });
  assert.equal(collisionSafeFixture.attempt, 1, '候选 slug 已有同名 memory 时必须换用下一唯一 slug');
  assert.notEqual(collisionSafeFixture.slug, memoryCollisionSlug);
  const isolatedCase = coreBetaSkillCreatorConversationCase({
    id: 'BETA-SKILL-014',
    conversation_turns: [{ prompt: '创建会议纪要 Skill' }, { prompt: '给出示例并完成创建' }],
  }, fixture.slug);
  assert.equal(isolatedCase.conversation_turns.length, 2);
  assert.equal(
    isolatedCase.conversation_turns.every((turn) => turn.prompt.includes(fixture.slug)),
    true,
    '每一轮 Skill Creator prompt 都必须绑定本轮唯一 slug',
  );

  const absent = coreBetaSkillCreatorProjectionReadback({
    qbotHome: root,
    slug: fixture.slug,
    baseline: fixture.baseline,
  });
  assert.equal(absent.evidence_valid, true, '双投影均缺失仍是完整的产品失败读回证据');
  assert.equal(absent.oracle_valid, false, '没有真实产物时业务 Oracle 必须失败');
  const negativeReadbackFile = path.join(root, 'skill-creator-negative-readback.json');
  fs.writeFileSync(negativeReadbackFile, JSON.stringify(absent));
  assert.deepEqual(
    validateEvidenceFile('content_readback', negativeReadbackFile),
    { valid: true },
    '产品未创建产物时，结构完整的 negative readback 必须满足 manifest 角色，不能触发 framework stop',
  );

  const skillText = [
    '---',
    `name: ${fixture.slug}`,
    'description: QA unique meeting minutes skill',
    'agent_created: true',
    '---',
    '',
    `# ${fixture.slug}`,
    '',
    'Generate structured meeting minutes.',
    '',
  ].join('\n');
  for (const projection of fixture.baseline.projections) {
    fs.mkdirSync(projection.directory, { recursive: true });
    fs.writeFileSync(projection.file, skillText);
  }
  const memoryFile = path.join(root, 'runtime-homes', 'claude', 'projects', 'qa-project', 'memory', `${fixture.slug}.md`);
  fs.mkdirSync(path.dirname(memoryFile), { recursive: true });
  fs.writeFileSync(memoryFile, `Run-owned memory for ${fixture.slug}\n`);
  const created = coreBetaSkillCreatorProjectionReadback({
    qbotHome: root,
    slug: fixture.slug,
    baseline: fixture.baseline,
  });
  assert.equal(created.evidence_valid, true);
  assert.equal(created.oracle_valid, true, 'Claude/Codex 双投影、frontmatter 和 SHA 一致时业务 Oracle 应通过');
  assert.equal(created.created_runtimes.length, 2);
  assert.equal(created.projection_sha256_equal, true);
  assert.equal(created.memory_readback.observed, true);
  assert.equal(created.memory_readback.files.length, 1);

  const selection = coreBetaSkillCreatorSelectionEvidence({
    before: {
      task: { id: null, send_count: 7 },
      capabilities: { selectedSkills: ['skillhub:global/skill-creator-qwork'] },
    },
    postSend: [
      { task: { id: 'task-qa', send_count: 8 }, capabilities: { selectedSkills: ['skillhub:global/skill-creator-qwork'] } },
      { task: { id: 'task-qa', send_count: 9 }, capabilities: { selectedSkills: ['skillhub:global/skill-creator-qwork'] } },
    ],
    after: { task: { id: 'task-qa', send_count: 9 }, capabilities: { selectedSkills: [] } },
    prompts: isolatedCase.conversation_turns,
  });
  assert.equal(selection.evidence_valid, true);
  assert.equal(selection.oracle_valid, true, 'exact creator、同一 taskId 和两轮唯一 prompt 必须形成 task-bound 选择证据');
  assert.equal(
    coreBetaSkillCreatorSelectionEvidence({
      before: { task: { id: null, send_count: 7 }, capabilities: { selectedSkills: ['skillhub:global/skill-creator-qwork'] } },
      postSend: [],
      after: { task: { id: 'task-qa', send_count: 9 } },
      prompts: isolatedCase.conversation_turns,
    }).evidence_valid,
    false,
    '缺少发送后 task-bound 快照必须保持 framework evidence failure',
  );

  const cleanup = coreBetaSkillCreatorCleanup({
    qbot_home: root,
    slug: fixture.slug,
    baseline: fixture.baseline,
  });
  assert.equal(cleanup.valid, true);
  assert.equal(cleanup.actions.filter((item) => item.removed).length, 3);
  assert.equal(created.projections.every((item) => !fs.existsSync(item.directory)), true);
  assert.equal(fs.existsSync(memoryFile), false, '本轮唯一 slug 的 Claude project memory 也必须精确清理');

  const protectedSlug = coreBetaSkillCreatorFixtureSlug(path.join(root, 'protected-case'));
  for (const projection of coreBetaSkillCreatorProjectionReadback({ qbotHome: root, slug: protectedSlug }).projections) {
    fs.mkdirSync(projection.directory, { recursive: true });
    fs.writeFileSync(projection.file, skillText.replaceAll(fixture.slug, protectedSlug));
  }
  const protectedBaseline = coreBetaSkillCreatorProjectionReadback({ qbotHome: root, slug: protectedSlug });
  const refused = coreBetaSkillCreatorCleanup({
    qbot_home: root,
    slug: protectedSlug,
    baseline: protectedBaseline,
  });
  assert.equal(refused.valid, false, '基线中已经存在的 Skill 必须拒绝删除');
  assert.equal(protectedBaseline.projections.every((item) => fs.existsSync(item.directory)), true);
  fs.rmSync(root, { recursive: true, force: true });
}

assert.deepEqual(
  assistantConfirmationSurfaceVerdict({
    actionLabel: '跳过',
    surfaceText: '您需要的是哪一类活动方案？ 1/2 内测/产品类活动 团队建设活动 营销推广活动 培训/分享活动 跳过',
    optionLabels: ['内测/产品类活动', '团队建设活动', '营销推广活动', '培训/分享活动', '跳过'],
    hasDialogAncestor: true,
  }),
  {
    handle: true,
    policy: 'skip',
    action_label: '跳过',
    question_like: true,
    has_dialog_ancestor: true,
    option_count: 4,
    option_labels: ['内测/产品类活动', '团队建设活动', '营销推广活动', '培训/分享活动'],
  },
  'Core Beta v2 必须识别活动方案澄清面板并采用默认跳过策略',
);
assert.equal(
  assistantConfirmationSurfaceVerdict({
    actionLabel: '跳过向导',
    surfaceText: '欢迎使用',
    optionLabels: ['下一步'],
  }).handle,
  false,
  'Core Beta v2 不得把普通向导的跳过误当成 Agent 澄清面板',
);
assert.deepEqual(
  assistantConfirmationClickProgressVerdict({
    clicked: true,
    originalActionConnected: false,
    originalActionVisible: false,
    originalSurfaceConnected: false,
    originalSurfaceVisible: false,
    originalSignature: '跳过\n需要你确认成果生成请求？ 跳过',
    currentSignature: '跳过\n需要你确认成果生成请求？ 跳过',
    currentAssistantSurfaceVisible: true,
    progressFingerprintBefore: 'a'.repeat(64),
    progressFingerprintAfter: 'b'.repeat(64),
  }),
  {
    consumed: true,
    closed: false,
    advanced: true,
    original_action_gone: true,
    original_surface_gone: true,
    original_consumed: true,
    replacement_surface: true,
    surface_signature_changed: false,
    progress_fingerprint_changed: true,
    reason: 'original_instance_replaced',
  },
  '同文案新面板替换原 DOM 实例时必须判定原点击已消费并继续处理下一问',
);
assert.equal(
  assistantConfirmationClickProgressVerdict({
    clicked: true,
    originalActionConnected: true,
    originalActionVisible: true,
    originalSurfaceConnected: true,
    originalSurfaceVisible: true,
    originalSignature: '跳过\n需要你确认成果生成请求？ 跳过',
    currentSignature: '跳过\n需要你确认成果生成请求？ 跳过',
    currentAssistantSurfaceVisible: true,
    progressFingerprintBefore: 'a'.repeat(64),
    progressFingerprintAfter: 'a'.repeat(64),
  }).consumed,
  false,
  '同一原面板、同一文案且线程无进展时必须 fail-closed，不能伪造点击成功',
);
assert.deepEqual(
  assistantConfirmationClickProgressVerdict({
    clicked: true,
    originalActionConnected: true,
    originalActionVisible: true,
    originalSurfaceConnected: true,
    originalSurfaceVisible: true,
    originalSignature: '跳过\n需要你确认成果生成请求？ 跳过',
    currentSignature: '跳过\n需要你确认成果生成请求？ 跳过',
    currentAssistantSurfaceVisible: true,
    progressFingerprintBefore: 'a'.repeat(64),
    progressFingerprintAfter: 'b'.repeat(64),
  }),
  {
    consumed: true,
    closed: false,
    advanced: true,
    original_action_gone: false,
    original_surface_gone: false,
    original_consumed: false,
    replacement_surface: false,
    surface_signature_changed: false,
    progress_fingerprint_changed: true,
    reason: 'thread_progress_changed',
  },
  '产品复用同一面板 DOM 和文案时，去除计时噪声后的工具进展变化必须证明已进入下一问',
);
const confirmationProgressAt39s = assistantConfirmationProgressFingerprintEvidence({
  valid: true,
  assistant_count: 1,
  tool_rows: [{ tag: 'DIV', testid: 'tool-status', text: '执行中 · 39s\n运行命令 Find git repo root and status' }],
});
const confirmationProgressAt44s = assistantConfirmationProgressFingerprintEvidence({
  valid: true,
  assistant_count: 1,
  tool_rows: [{ tag: 'DIV', testid: 'tool-status', text: '执行中 · 44s\n运行命令 Find git repo root and status' }],
});
const confirmationProgressNextCommand = assistantConfirmationProgressFingerprintEvidence({
  valid: true,
  assistant_count: 1,
  tool_rows: [{ tag: 'DIV', testid: 'tool-status', text: '执行中 · 44s\n运行命令 List PRD directory contents' }],
});
assert.equal(confirmationProgressAt39s.sha256, confirmationProgressAt44s.sha256, '单纯计时变化不得伪造线程推进');
assert.notEqual(confirmationProgressAt44s.sha256, confirmationProgressNextCommand.sha256, '工具命令推进必须改变线程进展指纹');

const validAttachmentRejectionProbe = {
  expected_pattern_matched: true,
  visible_rejection_evidence: true,
  dialog_message: '暂不支持的附件类型：.bin',
  dialog_settled: true,
  managed_teams_ax_required: true,
  structured_dialog_evidence: true,
  managed_dialog_evidence: true,
  composer_state: { count: 0, names: [] },
  no_task_no_send_state: { valid: true },
};
assert.equal(
  safeNativeAttachmentInfoDialog({
    message: '暂不支持的附件类型：.bin',
    buttons: ['OK'],
  }),
  true,
  'Core Beta v2 应识别只有唯一 OK 的 .bin 附件信息 AXSheet',
);
assert.equal(
  safeNativeRecoverableInfoDialog({
    message: '无法在 QWork 内预览该 HTML 文件 /tmp/qbot-artifacts/release-summary/index.html',
    buttons: ['OK'],
  }),
  true,
  'Core Beta v2 应安全关闭上一叶子留下的 QWork HTML 预览失败 AXSheet',
);
assert.equal(
  safeNativeAttachmentInfoDialog({
    message: '无法在 QWork 内预览该 HTML 文件 /tmp/qbot-artifacts/release-summary/index.html',
    buttons: ['OK'],
  }),
  false,
  'HTML 预览失败提示不得放宽附件拒绝专项 Oracle',
);
assert.equal(
  safeNativeRecoverableInfoDialog({
    message: '无法在 QWork 内预览该 HTML 文件 /tmp/qbot-artifacts/release-summary/index.html',
    buttons: ['取消', 'OK'],
  }),
  false,
  'QWork HTML 预览失败提示存在多个按钮时不得自动点击',
);
assert.equal(
  safeNativeRecoverableInfoDialog({
    message: '确定删除全部会话吗？',
    buttons: ['确定'],
  }),
  false,
  'Core Beta v2 不得把破坏性单按钮弹窗当作可恢复信息弹窗',
);
assert.equal(
  safeNativeAttachmentInfoDialog({
    message: '暂不支持的附件类型：.bin',
    buttons: ['取消', '确定'],
  }),
  false,
  'Core Beta v2 不得自动点击多按钮 AXSheet',
);
assert.equal(
  nativeDialogClosedOrAdvanced(
    { observed: true, message: '暂不支持的附件类型：.bin' },
    { observed: true, message: '单个文档不能超过 30 MiB' },
  ),
  true,
  '排队 alert 切换到下一条不同文案时，应判定原 AXSheet 已关闭并继续循环清理',
);
assert.equal(
  nativeDialogClosedOrAdvanced(
    { observed: true, message: '暂不支持的附件类型：.bin' },
    { observed: true, message: '暂不支持的附件类型：.bin' },
  ),
  false,
  '点击后同文案 AXSheet 仍在时不得误判关闭',
);
assert.equal(
  nativeDialogClosedOrAdvanced(
    { observed: true, message: '暂不支持的附件类型：.bin' },
    { observed: false, message: '' },
  ),
  true,
  '辅助功能树不再观察到 AXSheet 时应判定原弹窗已关闭',
);
assert.equal(
  coreBetaAttachmentRejectionProbeVerdict(validAttachmentRejectionProbe),
  true,
  '附件拒绝 probe 必须接受文案、AXSheet 收尾、Composer 空态和 no-task/no-send 同时成立的证据',
);
assert.equal(
  coreBetaAttachmentRejectionProbeVerdict({
    ...validAttachmentRejectionProbe,
    structured_dialog_evidence: false,
    managed_dialog_evidence: false,
  }),
  false,
  '受管 Teams 附件拒绝不得在 AXSheet 和受管 Playwright 证据都缺失时通过',
);

const managedDialogEvidenceDir = fs.mkdtempSync(path.join(os.tmpdir(), 'qbot-managed-dialog-'));
try {
  const before = path.join(managedDialogEvidenceDir, 'before.png');
  const native = path.join(managedDialogEvidenceDir, 'native.png');
  const after = path.join(managedDialogEvidenceDir, 'after.png');
  const artifact = path.join(managedDialogEvidenceDir, 'dialog.json');
  for (const file of [before, native, after]) fs.writeFileSync(file, Buffer.alloc(256, 1));
  const message = '暂不支持的附件类型：.bin';
  const common = {
    dialogMessage: message,
    capturedDialogMessage: message,
    dialogConfirmationLabel: 'OK',
    dialogHandled: true,
    dialogClosed: true,
    pageResponsiveAfterDialog: true,
    dialogCloseError: '',
    beforeDispatchScreenshot: before,
    dialogEvidenceScreenshot: native,
    dialogEvidenceArtifact: artifact,
    postDismissalScreenshot: after,
  };
  fs.writeFileSync(artifact, JSON.stringify({
    expected_dialog_message: message,
    playwright_dialog_message: message,
    confirmation_clicked: true,
    sheet_closed_after_confirmation: true,
  }, null, 2));
  assert.equal(
    managedAttachmentDialogEvidenceVerdict({
      ...common,
      dialogAction: 'macos_accessibility_click',
      dialogAccessibilityRole: 'AXSheet',
      dialogAccessibilityMessageMatched: true,
      dialogAccessibilityConfirmationClicked: true,
      dialogAccessibilitySheetClosed: true,
    }),
    true,
    'AXSheet 可见时应继续接受 Playwright 与 Accessibility 双通道证据',
  );

  fs.writeFileSync(artifact, JSON.stringify({
    expected_dialog_message: message,
    playwright_dialog_message: message,
    playwright_dialog: {
      observed_before_confirmation: true,
      type: 'alert',
      message,
      allowlisted_attachment_info: true,
      action: 'playwright_accept_fallback',
      accepted: true,
      evidence_captured_before_accept: true,
      page_responsive_after: true,
      close_error: '',
    },
  }, null, 2));
  const fallback = {
    ...common,
    dialogAction: 'playwright_accept_fallback',
    dialogType: 'alert',
    dialogPlaywrightObservedBeforeAccept: true,
    dialogPlaywrightAllowlisted: true,
    dialogPlaywrightAccepted: true,
    dialogEvidenceCapturedBeforeAccept: true,
    dialogFallbackEvidenceRecorded: true,
  };
  assert.equal(
    managedAttachmentDialogEvidenceVerdict(fallback),
    true,
    'AXSheet 不可见时应接受证据完整的白名单 Playwright alert',
  );
  assert.equal(
    managedAttachmentDialogEvidenceVerdict({ ...fallback, dialogType: 'confirm' }),
    false,
    '受管 fallback 不得接受 confirm 或多按钮弹窗',
  );
  assert.equal(
    managedAttachmentDialogEvidenceVerdict({
      ...fallback,
      dialogMessage: '确定删除全部会话吗？',
      capturedDialogMessage: '确定删除全部会话吗？',
    }),
    false,
    '受管 fallback 不得接受破坏性或非附件白名单弹窗',
  );
  assert.equal(
    managedAttachmentDialogEvidenceVerdict({ ...fallback, postDismissalScreenshot: '' }),
    false,
    '受管 fallback 缺少关闭后截图时必须 fail-closed',
  );
} finally {
  fs.rmSync(managedDialogEvidenceDir, { recursive: true, force: true });
}
assert.equal(
  coreBetaAttachmentRejectionProbeVerdict({
    ...validAttachmentRejectionProbe,
    composer_state: { count: 1, names: ['qbot-unsupported.bin'] },
  }),
  false,
  '附件拒绝后 Composer 仍有残留时不得通过',
);
assert.equal(
  coreBetaAttachmentRejectionMatrixVerdict([
    { label: 'unsupported_type', ...validAttachmentRejectionProbe },
    { label: 'single_file_oversize', ...validAttachmentRejectionProbe, dialog_message: '单个文档不能超过 30 MiB' },
    { label: 'aggregate_oversize', ...validAttachmentRejectionProbe, dialog_message: '文档附件总大小不能超过 80 MiB' },
  ]),
  true,
  'BETA-FILE-006 应按三个独立干净草稿 probe 聚合有效拒绝证据',
);
assert.equal(
  coreBetaAttachmentRejectionMatrixVerdict([
    { label: 'unsupported_type', ...validAttachmentRejectionProbe },
    { label: 'single_file_oversize', ...validAttachmentRejectionProbe },
    { label: 'single_file_oversize', ...validAttachmentRejectionProbe },
  ]),
  false,
  'BETA-FILE-006 不得用重复 probe 冒充三类拒绝矩阵',
);

const artifactRegressionDir = fs.mkdtempSync(path.join(os.tmpdir(), 'qbot-core-beta-artifact-'));
try {
  const markdownFile = path.join(artifactRegressionDir, 'report.md');
  const interactiveHtmlFile = path.join(artifactRegressionDir, 'summary.html');
  const remoteHtmlFile = path.join(artifactRegressionDir, 'remote.html');
  fs.writeFileSync(markdownFile, '# A/B 报告\n\nA=12，B=8。\n');
  fs.writeFileSync(interactiveHtmlFile, '<!doctype html><html><body>A=12 B=8<button id="inc">增加</button><script>document.querySelector("#inc").onclick=()=>{};</script></body></html>');
  fs.writeFileSync(remoteHtmlFile, '<!doctype html><html><body>A=12 B=8<script src="https://example.invalid/app.js"></script></body></html>');
  const markdownReadback = coreBetaArtifactReadback(markdownFile);
  const interactiveHtmlReadback = coreBetaArtifactReadback(interactiveHtmlFile);
  const remoteHtmlReadback = coreBetaArtifactReadback(remoteHtmlFile);
  const pptxFixtureReadback = coreBetaArtifactReadback(path.join(root, 'testflies', 'qbot-slide-deck.pptx'));
  const pdfFixtureReadback = coreBetaArtifactReadback(path.join(root, 'testflies', 'qbot-pdf-summary.pdf'));
  assert.equal(interactiveHtmlReadback.valid, true, '交互式 HTML 的内联 script 不应被文件结构校验误判为无效');
  assert.equal(remoteHtmlReadback.valid, false, '引用远程资源的 HTML 仍必须失败');
  assert.equal(pptxFixtureReadback.pptx_slide_count, 1, 'PPTX 读回必须按 slide XML 提取真实页数');
  assert.deepEqual(pptxFixtureReadback.pptx_slide_titles, ['QBot PPT 测试：多模态与附件理解'], 'PPTX 读回必须提取逐页标题');
  assert.equal(pdfFixtureReadback.pdf_text_readback_valid, true, 'PDF 读回必须通过 pdftotext 或 PyMuPDF 获得逐页文本');
  assert.equal(pdfFixtureReadback.pdf_page_texts.length, pdfFixtureReadback.pdf_page_count, 'PDF 文本页数必须与结构页数一致');
  assert.match(pdfFixtureReadback.pdf_page_texts.join('\n'), /QBot PDF Summary/, 'PDF 读回必须保留可核对的 fixture 标题');
  const pptxRect = ({ x, y, width, height, preset = 'roundRect' }) => `<p:sp><p:spPr><a:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="${width}" cy="${height}"/></a:xfrm><a:prstGeom prst="${preset}"><a:avLst/></a:prstGeom></p:spPr></p:sp>`;
  const roundRectFunnelXml = [
    pptxRect({ x: 1_371_600, y: 1_600_000, width: 8_595_360, height: 914_400 }),
    pptxRect({ x: 2_743_200, y: 2_770_000, width: 5_852_160, height: 914_400 }),
    pptxRect({ x: 4_023_360, y: 3_940_000, width: 3_291_840, height: 914_400 }),
  ].join('');
  assert.equal(
    coreBetaPptxFunnelGeometryVerdict(roundRectFunnelXml),
    true,
    'BETA-ART-004 必须接受同中心、纵向排列且宽度递减的三层 roundRect 真实漏斗',
  );
  assert.equal(
    coreBetaPptxFunnelGeometryVerdict([
      pptxRect({ x: 1_371_600, y: 1_600_000, width: 8_595_360, height: 914_400 }),
      pptxRect({ x: 1_371_600, y: 2_770_000, width: 8_595_360, height: 914_400 }),
      pptxRect({ x: 1_371_600, y: 3_940_000, width: 8_595_360, height: 914_400 }),
    ].join('')),
    false,
    '等宽纵向卡片不得冒充漏斗几何',
  );
  assert.equal(
    coreBetaPptxFunnelGeometryVerdict([
      pptxRect({ x: 500_000, y: 1_600_000, width: 8_595_360, height: 914_400 }),
      pptxRect({ x: 4_000_000, y: 2_770_000, width: 5_852_160, height: 914_400 }),
      pptxRect({ x: 8_000_000, y: 3_940_000, width: 3_291_840, height: 914_400 }),
    ].join('')),
    false,
    '中心错位的散落矩形不得冒充漏斗几何',
  );
  assert.equal(
    validateCoreBetaArtifactOracle('artifact_markdown_html_validation', [markdownReadback, interactiveHtmlReadback]),
    true,
    'BETA-ART-001 应接受包含内联交互脚本且无远程资源的 HTML',
  );
  const fivePagePptx = {
    extension: '.pptx',
    pptx_slide_count: 5,
    pptx_blank_slide_count: 0,
    pptx_metric_anchors: ['曝光1000', '点击100', '转化20'],
    pptx_chart_candidate_slides: [3],
    pptx_slide_titles: ['营销效果转化漏斗汇报', '核心指标总览', '转化漏斗分析', '关键洞察与结论', '行动建议与后续计划'],
  };
  const fivePagePdf = {
    extension: '.pdf',
    pdf_page_count: 5,
    pdf_text_readback_valid: true,
    pdf_page_texts: [
      '营销效果转化漏斗汇报 曝光 1,000 点击 100 转化 20',
      '核心指标总览',
      '转化漏斗分析',
      '关键洞察与结论',
      '行动建议与后续计划',
    ],
    pdf_blank_page_count: 0,
    pdf_metric_anchors: ['曝光1000', '点击100', '转化20'],
  };
  assert.equal(
    validateCoreBetaArtifactOracle('artifact_pptx_pdf_validation', [fivePagePptx, fivePagePdf]),
    true,
    'BETA-ART-004 必须接受五页、无空白页、标题与三项指标一致且含图表的 PPTX/PDF',
  );
  assert.equal(
    validateCoreBetaArtifactOracle('artifact_pptx_pdf_validation', [
      { ...fivePagePptx, pptx_slide_count: 1 },
      { ...fivePagePdf, pdf_page_count: 1, pdf_page_texts: [fivePagePdf.pdf_page_texts[0]] },
    ]),
    false,
    'BETA-ART-004 不得再把至少一页的可解析文件当作五页业务 Oracle 通过',
  );
  assert.equal(
    validateCoreBetaArtifactOracle('artifact_pptx_pdf_validation', [
      { ...fivePagePptx, pptx_chart_candidate_slides: [] },
      fivePagePdf,
    ]),
    false,
    'BETA-ART-004 缺少可见数据图表时必须失败',
  );
  assert.equal(
    validateCoreBetaArtifactOracle('artifact_pptx_pdf_validation', [
      { ...fivePagePptx, pptx_slide_titles: [...fivePagePptx.pptx_slide_titles.slice(0, 4), 'PDF 中缺失的标题'] },
      fivePagePdf,
    ]),
    false,
    'BETA-ART-004 的 PPTX 标题未在 PDF 中一致出现时必须失败',
  );
  assert.equal(
    validateCoreBetaArtifactOracle('artifact_pptx_pdf_validation', [
      fivePagePptx,
      { ...fivePagePdf, pdf_blank_page_count: 1, pdf_page_texts: [...fivePagePdf.pdf_page_texts.slice(0, 4), ''] },
    ]),
    false,
    'BETA-ART-004 任一 PDF 空白页必须失败',
  );
  assert.equal(
    coreBetaMarkdownHtmlPreviewVerdict({
      expected_names: ['report.md', 'summary.html'],
      overview_text: '本任务共 2 个成果 report.md summary.html',
      markdown: { clicked: true, code_viewer_visible: true, language: 'markdown', source_text: '# A/B 报告 A=12 B=8' },
      html: {
        clicked: true,
        code_viewer_visible: true,
        language: 'html',
        source_text: '<html>A=12 B=8<script>interactive()</script></html>',
        script_source_visible: true,
        script_dom_nodes: 0,
        iframe_dom_nodes: 0,
        parent_script_executed: false,
        dialogs: [],
      },
    }),
    false,
    '当前发布门禁不得用旧源码查看器替代真实网页预览和分享',
  );
  assert.equal(
    coreBetaMarkdownHtmlPreviewVerdict({
      expected_names: ['report.md', 'summary.html'],
      overview_text: '本任务共 2 个成果 report.md summary.html',
      markdown: { clicked: true, code_viewer_visible: true, language: 'markdown', source_text: '# A/B 报告 A=12 B=8' },
      html: {
        clicked: true,
        code_viewer_visible: false,
        file_source_text: '<html>A=12 B=8<script>interactive()</script></html>',
        web_preview_visible: true,
        web_preview_content_visible: true,
        web_preview_loading_visible: false,
        web_preview_error: '',
        share_button_visible: true,
        share_button_enabled: true,
        share_dialog_visible: true,
        share_ready: true,
        share_url: 'https://report-share.example/report',
        share_error: '',
        parent_script_executed: false,
        dialogs: [],
      },
    }),
    true,
    '新版HTML成果必须以受管网页预览和分享入口作为硬Oracle',
  );
  assert.equal(
    coreBetaMarkdownHtmlPreviewVerdict({
      expected_names: ['report.md', 'summary.html'],
      overview_text: '本任务共 2 个成果 report.md summary.html',
      markdown: { clicked: true, code_viewer_visible: true, language: 'markdown', source_text: '# A/B 报告 A=12 B=8' },
      html: {
        clicked: true,
        file_source_text: '<html>A=12 B=8<script>interactive()</script></html>',
        web_preview_visible: true,
        web_preview_content_visible: true,
        web_preview_loading_visible: true,
        web_preview_error: '',
        share_button_visible: true,
        share_button_enabled: true,
        share_dialog_visible: true,
        share_ready: true,
        share_url: 'https://report-share.example/report',
        share_error: '',
        parent_script_executed: false,
        dialogs: [],
      },
    }),
    false,
    'HTML网页预览仍处于加载态时不得记为内容可见',
  );
  assert.equal(
    coreBetaMarkdownHtmlPreviewVerdict({
      expected_names: ['report.md', 'summary.html'],
      overview_text: '本任务共 1 个成果 summary.html',
      markdown: { clicked: false, code_viewer_visible: false, language: '', source_text: '' },
      html: {
        clicked: true,
        code_viewer_visible: true,
        language: 'html',
        source_text: '<html>A=12 B=8<script>interactive()</script></html>',
        script_source_visible: true,
        script_dom_nodes: 0,
        iframe_dom_nodes: 0,
        parent_script_executed: false,
        dialogs: [],
      },
    }),
    false,
    '成果区缺少 Markdown 时不得仅凭工作区文件存在通过',
  );
  assert.equal(
    coreBetaMarkdownHtmlPreviewVerdict({
      expected_names: ['report.md', 'summary.html'],
      overview_text: '本任务共 2 个成果 report.md summary.html',
      markdown: { clicked: true, code_viewer_visible: true, language: 'markdown', source_text: '# A/B 报告 A=12 B=8' },
      html: {
        clicked: true,
        code_viewer_visible: true,
        language: 'html',
        source_text: '<html>A=12 B=8<script>interactive()</script></html>',
        script_source_visible: true,
        script_dom_nodes: 1,
        iframe_dom_nodes: 0,
        parent_script_executed: false,
        dialogs: [],
      },
    }),
    false,
    'HTML 源码预览区出现真实 script DOM 节点时必须按安全 Oracle 失败',
  );
  const composerHistoryReadback = {
    prompts: ['QBOT-HISTORY-FIRST', 'QBOT-HISTORY-SECOND'],
    unsent_draft: 'QBOT-HISTORY-DRAFT-NOT-SENT',
    initial_task_id: 'task-a',
    isolated_task_id: '',
    isolated_is_draft: true,
    isolated_message_count: 0,
    isolated_draft_instance_id: 'draft-b',
    navigation: {
      up_boundary_arm: 'QBOT-HISTORY-DRAFT-NOT-SENT',
      up_latest: 'QBOT-HISTORY-SECOND',
      up_older: 'QBOT-HISTORY-FIRST',
      down_newer: 'QBOT-HISTORY-SECOND',
      down_draft: 'QBOT-HISTORY-DRAFT-NOT-SENT',
      isolated_boundary_arm: '',
      isolated_new_task: '',
      reopened_boundary_arm: '',
      reopened_latest: 'QBOT-HISTORY-SECOND',
    },
  };
  assert.equal(coreBetaComposerHistoryVerdict(composerHistoryReadback), true);
  assert.equal(
    coreBetaComposerHistoryVerdict({
      ...composerHistoryReadback,
      navigation: { ...composerHistoryReadback.navigation, up_boundary_arm: 'QBOT-HISTORY-SECOND' },
    }),
    false,
    '第一下物理ArrowUp必须只建立边界握手，不能直接进入历史',
  );
  assert.equal(
    coreBetaComposerHistoryVerdict({
      ...composerHistoryReadback,
      navigation: { ...composerHistoryReadback.navigation, isolated_new_task: 'QBOT-HISTORY-SECOND' },
    }),
    false,
    'Composer历史输入跨任务泄漏必须失败',
  );
  assert.equal(
    coreBetaComposerHistoryVerdict({ ...composerHistoryReadback, isolated_task_id: 'task-b' }),
    false,
    '新建任务应保持activeId为空的草稿态，不能要求或接受伪造taskId',
  );
  assert.deepEqual(
    coreBetaModelMenuExpectedSnapshot({
      state: {
        runtimeFamily: 'claude-code',
        executionScope: 'desktop-local',
        modelPolicyState: { policy: 'auto', state: 'pending' },
      },
      view: {
        runtimeOptions: {
          runtimeFamily: 'claude-code',
          options: [{ modelId: 'auto-only', runtimeFamily: 'claude-code', protocol: 'anthropic', complianceTier: 'M1' }],
        },
        manualModelOptions: [
          { modelId: 'manual-claude', runtimeFamily: 'claude-code', protocol: 'anthropic', complianceTier: 'M2' },
          { modelId: 'codex-leak', runtimeFamily: 'codex', protocol: 'response', complianceTier: 'M3' },
        ],
      },
    }),
    {
      runtime_family: 'claude-code',
      protocol: 'anthropic',
      option_count: 1,
      model_ids: ['manual-claude'],
      options: [{ modelId: 'manual-claude', runtimeFamily: 'claude-code', protocol: 'anthropic', complianceTier: 'M2' }],
      candidate_source: 'manualModelOptions',
      policy: { policy: 'auto', state: 'pending' },
      execution_scope: 'desktop-local',
    },
    'Auto草稿的模型菜单期望集合必须与产品一样优先取manualModelOptions',
  );
  const modelMenuReadback = {
    expected: {
      runtime_family: 'claude-code',
      protocol: 'anthropic',
      option_count: 2,
      model_ids: ['claude-a', 'claude-b'],
    },
    rendered: {
      model_ids: ['claude-b', 'claude-a'],
      tiers: ['M2', 'M3'],
      error: '',
    },
  };
  assert.equal(coreBetaModelMenuSdkFilterVerdict(modelMenuReadback), true);
  assert.equal(
    coreBetaModelMenuSdkFilterVerdict({
      ...modelMenuReadback,
      rendered: { ...modelMenuReadback.rendered, model_ids: ['claude-a', 'codex-leak'] },
    }),
    false,
    '模型菜单出现其他SDK候选时必须失败',
  );

  const productFailureEvidence = path.join(artifactRegressionDir, 'artifact-path-sha256.json');
  writeJsonFile(productFailureEvidence, { valid: true, oracle_valid: false, files: [] });
  const productFailureManifest = buildCoreEvidenceManifest({
    testCase: { id: 'BETA-ART-001', evidence_roles: ['artifact_path_sha256'] },
    caseDir: artifactRegressionDir,
    artifacts: { artifact_path_sha256: productFailureEvidence },
  });
  assert.equal(productFailureManifest.complete, true, '产品成果 Oracle 失败不得被误判为证据 manifest 不完整');
} finally {
  fs.rmSync(artifactRegressionDir, { recursive: true, force: true });
}

assert.equal(
  isAttachmentPromptFidelityCase({
    id: 'BETA-ART-001',
    case_type: 'artifact',
    core_domain: '成果输出',
    scenario: '生成Markdown与HTML成果并核对内容、预览和安全沙箱',
    test_data: '要求同一组已知事实分别输出Markdown报告和交互HTML摘要。',
  }),
  false,
  '成果 Case 仅提到 Markdown/HTML 时不得套用附件 prompt 一致性检查',
);
assert.equal(
  isAttachmentPromptFidelityCase({
    id: 'BETA-FILE-001',
    case_type: 'attachment',
    scenario: '上传真实PDF并提炼结论',
    test_data: '上传 qbot-test.pdf；请提炼三条结论。',
  }),
  true,
  '真实附件 Case 必须继续执行 prompt 一致性检查',
);
assert.deepEqual(
  coreBetaAttachmentFixtureNames('BETA-FILE-002'),
  ['qbot-image-flow.png', 'qbot-image-risk.png'],
  'BETA-FILE-002 必须冻结两张互异图片，不能回退为单张通用图片',
);
assert.deepEqual(
  coreBetaAttachmentFixtureNames('BETA-FILE-005'),
  ['qbot-data.json', 'qbot-page.html', 'qbot-script.js', 'qbot-request-correlation.log'],
  'BETA-FILE-005 必须冻结共享 requestId 的四格式 fixture',
);
assert.deepEqual(
  coreBetaAttachmentFixtureContractVerdict(
    { id: 'BETA-FILE-002' },
    ['/fixtures/qbot-image-flow.png'],
  ),
  {
    schema_version: 'qbot-core-beta-attachment-fixture-contract/v1',
    case_id: 'BETA-FILE-002',
    applicable: true,
    valid: false,
    expected_names: ['qbot-image-flow.png', 'qbot-image-risk.png'],
    actual_names: ['qbot-image-flow.png'],
    missing_names: ['qbot-image-risk.png'],
    unexpected_names: [],
    failure_category: 'automation_error',
  },
  '框架只上传一张图片时必须 fail-closed 为 automation_error，不能误报产品 Bug',
);
assert.equal(
  coreBetaAttachmentFixtureContractVerdict(
    { id: 'BETA-FILE-002' },
    ['/fixtures/qbot-image-flow.png', '/fixtures/qbot-image-risk.png'],
  ).valid,
  true,
  '两张图片名称与顺序精确匹配时附件输入合同才成立',
);

const coreImageCase = { id: 'BETA-FILE-002' };
const coreImageReply = [
  '第一张标题是 QBot Release Flow，主要图形由 INPUT、ANALYZE、DELIVER 三个节点和箭头组成。',
  '门禁文字是 Gate: evidence must be reviewable before release。',
  '第二张标题是 Release Risk Matrix，横轴 PROBABILITY，纵轴 IMPACT。',
  '风险点包括 P0 data loss、P1 timeout、P2 copy。',
].join('\n');
assert.equal(
  caseAwareReplyAssertion(coreImageCase, { prompt: '请分别说明两张图片。' }, coreImageReply).ok,
  true,
  '两图回复必须命中流程图和风险矩阵的确定性锚点',
);
const coreImageReplyWithBulletSeparators = [
  '第一张标题是 QBot Release Flow，主要图形由 INPUT、ANALYZE、DELIVER 三个节点和箭头组成。',
  '门禁文字是 Gate: evidence must be reviewable before release。',
  '第二张标题是 Release Risk Matrix，横轴 PROBABILITY，纵轴 IMPACT。',
  '风险点包括 P0 · data loss、P1: timeout、P2 - copy。',
].join('\n');
assert.equal(
  caseAwareReplyAssertion(coreImageCase, { prompt: '请分别说明两张图片。' }, coreImageReplyWithBulletSeparators).ok,
  true,
  'P0/P1/P2 与风险标签之间的项目符号、冒号或短横线不得造成视觉锚点假阴性',
);
const coreImageReplyWithBilingualRiskLabels = [
  '图一：QBot Release Flow（QBot 发布流程）',
  '流程为 INPUT、ANALYZE、DELIVER；Gate: evidence must be reviewable before release。',
  '图二：Release Risk Matrix（发布风险矩阵），横轴 PROBABILITY，纵轴 IMPACT。',
  'P0 数据丢失（data loss）',
  'P1 超时（timeout）',
  'P2 数据复制（copy）',
].join('\n');
assert.equal(
  caseAwareReplyAssertion(coreImageCase, { prompt: '请分别说明两张图片。' }, coreImageReplyWithBilingualRiskLabels).ok,
  true,
  '准确输出中文风险名并在括号补充英文原文时不得造成风险矩阵锚点假阴性',
);
assert.equal(
  caseAwareReplyAssertion(
    coreImageCase,
    { prompt: '请分别说明两张图片。' },
    coreImageReplyWithBilingualRiskLabels
      .replace('P0 数据丢失（data loss）', 'P0 超时（timeout）')
      .replace('P1 超时（timeout）', 'P1 数据丢失（data loss）'),
  ).ok,
  false,
  '接受中英文等价风险名后仍必须保持 P0/P1/P2 与对应风险一一绑定',
);
assert.equal(
  caseAwareReplyAssertion(
    coreImageCase,
    { prompt: '请分别说明两张图片。' },
    coreImageReplyWithBulletSeparators.replace('P2 - copy', 'P2 - unknown'),
  ).ok,
  false,
  '允许常见分隔符后仍必须精确命中 P0/P1/P2 的全部风险标签',
);
const coreImageReplyWithChineseAxes = [
  '第一张标题是 QBot Release Flow，主要图形由 INPUT、ANALYZE、DELIVER 三个节点和箭头组成。',
  '门禁文字是 Gate: evidence must be reviewable before release。',
  '第二张标题是 Release Risk Matrix，横轴/纵轴代表可能性与影响程度。',
  '风险点包括 P0 data loss、P1 timeout、P2 copy。',
].join('\n');
assert.equal(
  caseAwareReplyAssertion(coreImageCase, { prompt: '请分别说明两张图片。' }, coreImageReplyWithChineseAxes).ok,
  true,
  '风险矩阵使用标准中文轴名“可能性/影响程度”时不得造成视觉锚点假阴性',
);
const coreImageReplyWithChineseTitles = [
  '第一张是 QBot 发布流程，主要图形由 INPUT、ANALYZE、DELIVER 三个节点和箭头组成。',
  '门禁文字是 Gate: evidence must be reviewable before release。',
  '第二张是发布风险矩阵，横轴/纵轴代表可能性与影响程度。',
  '风险点包括 P0 data loss、P1 timeout、P2 copy。',
].join('\n');
assert.equal(
  caseAwareReplyAssertion(coreImageCase, { prompt: '请分别说明两张图片。' }, coreImageReplyWithChineseTitles).ok,
  true,
  '准确复述为“QBot 发布流程/发布风险矩阵”时不得因标题采用标准中文等价词产生假阴性',
);
assert.equal(
  caseAwareReplyAssertion(
    coreImageCase,
    { prompt: '请分别说明两张图片。' },
    coreImageReplyWithChineseTitles.replace('发布风险矩阵', '发布风险清单'),
  ).ok,
  false,
  '接受中文等价标题后仍必须精确识别第二张为发布风险矩阵',
);
assert.equal(
  caseAwareReplyAssertion(
    coreImageCase,
    { prompt: '请分别说明两张图片。' },
    coreImageReplyWithChineseAxes.replace('可能性与影响程度', '严重程度'),
  ).ok,
  false,
  '接受中文等价轴名后仍必须同时证明概率轴和影响轴',
);
assert.equal(
  caseAwareReplyAssertion(coreImageCase, { prompt: '请分别说明两张图片。' }, '只看到 QBot Release Flow。').ok,
  false,
  '只识别一张图片不得通过 BETA-FILE-002',
);

const coreOfficeCase = { id: 'BETA-FILE-003' };
const coreOfficeReply = [
  'Word/DOCX：验收点包括多轮对话、附件理解、截图留证和中文报告。',
  'PPT/PPTX：主题是多模态与附件理解，重点包括上传、摘要、结构化输出和截图留证。',
  '统一行动建议：先验证上传和附件理解，再核对结构化输出与中文报告。',
].join('\n');
assert.equal(
  caseAwareReplyAssertion(coreOfficeCase, { prompt: '分别概括两个附件。' }, coreOfficeReply).ok,
  true,
  'Office 双附件必须分别命中真实 fixture 事实并形成统一建议',
);

const coreMixedCase = { id: 'BETA-FILE-005' };
const coreMixedFixtureContents = coreBetaMixedFormatFixtureContents();
assert.deepEqual(
  Object.keys(coreMixedFixtureContents),
  ['qbot-data.json', 'qbot-page.html', 'qbot-script.js', 'qbot-request-correlation.log'],
  '四格式 runtime fixture 文件名必须与协议冻结映射一致',
);
for (const [name, content] of Object.entries(coreMixedFixtureContents)) {
  assert.match(content, /QBOT-BETA-REQ-20260729/, `${name} 必须包含共享 requestId`);
  assert.match(content, /UPSTREAM_TIMEOUT/, `${name} 必须包含共享错误码`);
  assert.match(content, /upstream_service_timeout/, `${name} 必须包含共享根因`);
  assert.match(content, /retryable["']?\s*[:=]\s*true/i, `${name} 必须包含可重试标记`);
}
const coreMixedReply = [
  '文件类型分别为 JSON、HTML、JavaScript (JS) 和日志 LOG。',
  '四者共享 requestId QBOT-BETA-REQ-20260729。',
  '错误码 UPSTREAM_TIMEOUT 对应根因 upstream_service_timeout，retryable=true，可重试。',
].join('\n');
assert.equal(
  caseAwareReplyAssertion(coreMixedCase, { prompt: '沿requestId分析错误根因。' }, coreMixedReply).ok,
  true,
  '四格式附件必须沿冻结 requestId 命中错误码、根因和重试结论',
);
assert.equal(
  caseAwareReplyAssertion(coreMixedCase, { prompt: '沿requestId分析错误根因。' }, 'JSON 中出现超时。').ok,
  false,
  '缺少四格式关联证据不得通过 BETA-FILE-005',
);
assert.equal(
  unifiedSkillModeApplied({ selectedSkills: undefined }, 'disabled', []),
  true,
  'Core Beta v2 在 capabilities 省略 selectedSkills 时，应使用 setSkillsDisabled 返回的空数组确认禁用态',
);
assert.equal(
  unifiedSkillModeApplied({ selectedSkills: undefined }, 'disabled', undefined),
  false,
  'Core Beta v2 不能只因 capabilities 缺少 selectedSkills 就误判技能已禁用',
);
assert.equal(
  unifiedSkillModeApplied({ selectedSkills: [] }, 'disabled', undefined),
  true,
  'Core Beta v2 应继续接受旧版 capabilities 的明确空数组读回',
);
assert.equal(
  unifiedSkillModeApplied({ selectedSkills: undefined }, 'auto', null),
  true,
  'Core Beta v2 技能自动态应接受 setSkillsAuto 返回的 null',
);
assert.equal(
  unifiedSkillModeApplied({ selectedSkills: undefined }, 'disabled', null),
  false,
  'Core Beta v2 不能把自动态 null 误判为技能禁用态',
);
const legacyNullDisabledReadbacks = {
  init_context: {
    available: true,
    binding_matches: true,
    selected_skills_observed: true,
    selected_skills: [],
    selected_connectors_observed: true,
    selected_connectors: [],
    current_expert_observed: true,
    current_expert: null,
  },
  e2e_state: {
    available: true,
    selected_skills_observed: true,
    selected_skills: [],
    selected_connectors_observed: true,
    selected_connectors: [],
    current_expert_observed: true,
    current_expert: null,
  },
  visible_ui: {
    surface: 'unified-plus',
    visible_skill_chips: [],
    visible_connector_chips: [],
    visible_expert_avatar_count: 0,
  },
};
assert.equal(
  coreBetaUnifiedDisabledCompatibilityReadback({
    capabilityKind: 'skill',
    bridgeSelection: null,
    selectionReadbacks: legacyNullDisabledReadbacks,
    composerSurfaceAvailable: true,
  }).ok,
  true,
  '0.1.6-sit.8 的 setSkillsDisabled=null 只有同一 draft 的 init/E2E/UI 空态交叉读回完整时才可放行',
);
assert.equal(
  coreBetaUnifiedDisabledCompatibilityReadback({
    capabilityKind: 'skill',
    bridgeSelection: null,
    selectionReadbacks: {
      ...legacyNullDisabledReadbacks,
      e2e_state: { available: true, current_expert_observed: true, current_expert: null },
    },
    composerSurfaceAvailable: true,
  }).ok,
  true,
  'E2E 空态只需明确当前专家为空，Skill/Connector 空选择由同 draft init 与可见 chip 证明',
);
assert.equal(
  coreBetaUnifiedDisabledCompatibilityReadback({ capabilityKind: 'skill', bridgeSelection: null }).ok,
  false,
  'setSkillsDisabled=null 不能单独证明技能已清理',
);
assert.equal(
  coreBetaUnifiedDisabledCompatibilityReadback({
    capabilityKind: 'skill',
    bridgeSelection: null,
    selectionReadbacks: {
      ...legacyNullDisabledReadbacks,
      init_context: { ...legacyNullDisabledReadbacks.init_context, selected_skills_observed: false },
    },
    composerSurfaceAvailable: true,
  }).ok,
  false,
  'init 缺少 selectedSkills 字段时 legacy null 兼容路径必须 fail-closed',
);
assert.equal(
  coreBetaUnifiedDisabledCompatibilityReadback({
    capabilityKind: 'connector',
    bridgeSelection: null,
    selectionReadbacks: {
      ...legacyNullDisabledReadbacks,
      visible_ui: { ...legacyNullDisabledReadbacks.visible_ui, visible_connector_chips: ['残留连接器'] },
    },
    composerSurfaceAvailable: true,
  }).ok,
  false,
  '可见连接器 chip 残留时 legacy null 兼容路径必须失败',
);
assert.equal(
  coreBetaUnifiedDisabledCompatibilityReadback({
    capabilityKind: 'skill',
    bridgeSelection: null,
    selectionReadbacks: {
      ...legacyNullDisabledReadbacks,
      init_context: { ...legacyNullDisabledReadbacks.init_context, binding_matches: false },
    },
    composerSurfaceAvailable: true,
  }).ok,
  false,
  'active/draft 绑定不一致时 legacy null 兼容路径必须失败',
);
assert.equal(
  unifiedConnectorModeApplied({ selectedConnectors: undefined }, 'disabled', []),
  true,
  'Core Beta v2 在 capabilities 省略连接器字段时，应使用 setConnectorsDisabled 返回的空数组确认禁用态',
);
assert.equal(
  unifiedConnectorModeApplied({ selectedConnectors: undefined }, 'disabled', undefined),
  false,
  'Core Beta v2 不能只因 capabilities 缺少连接器字段就误判连接器已禁用',
);
assert.equal(
  coreBetaComposerIsolationReadback({
    capabilities: { selectedSkills: null, selectedConnectors: null, currentExpert: null },
  }).ok,
  true,
  'rc.100 的 Auto 空选择必须满足用例前无能力残留隔离，但不改变 disabled 的精确模式语义',
);
assert.equal(
  coreBetaComposerIsolationReadback({
    capabilities: { selectedSkills: [{ slug: 'leftover' }], selectedConnectors: null, currentExpert: null },
  }).ok,
  false,
  '任一真实能力残留不得被 Auto 空选择兼容逻辑放行',
);
assert.equal(
  coreBetaComposerIsolationReadback({
    capabilities: { selectedSkills: null, selectedConnectors: null, currentExpert: { id: 'expert-1' } },
  }).ok,
  false,
  '专家残留不得被 Auto 空选择兼容逻辑放行',
);
assert.equal(
  coreBetaComposerIsolationReadback({
    capabilities: { selectedSkills: null, currentExpert: null },
  }).ok,
  false,
  '公开能力字段缺失时仍必须 fail-closed',
);
assert.equal(
  coreBetaComposerIsolationReadback({
    capabilities: null,
    selectionReadbacks: legacyNullDisabledReadbacks,
    composerSurfaceAvailable: true,
    bridgeResults: { setSkillsDisabled: null, setConnectorsDisabled: null },
  }).ok,
  true,
  'capabilities 超时时，完整 init/E2E/UI 空态与两个 legacy disabled bridge=null 可证明 Composer 隔离完成',
);
assert.equal(
  coreBetaComposerIsolationReadback({
    capabilities: null,
    selectionReadbacks: legacyNullDisabledReadbacks,
    composerSurfaceAvailable: true,
    bridgeResults: { setSkillsDisabled: null },
  }).ok,
  false,
  'Composer 隔离 fallback 缺失任一清理桥结果时必须 fail-closed',
);
assert.equal(
  unifiedConnectorModeApplied({ selectedConnectors: [] }, 'disabled', undefined),
  true,
  'Core Beta v2 应继续接受旧版 capabilities 的明确连接器空数组读回',
);
assert.equal(
  unifiedConnectorModeApplied({ selectedConnectors: undefined }, 'auto', null),
  true,
  'Core Beta v2 连接器自动态应接受 setConnectorsAuto 返回的 null',
);
assert.equal(
  unifiedConnectorModeApplied({ selectedConnectors: undefined }, 'disabled', null),
  false,
  'Core Beta v2 不能把连接器自动态 null 误判为禁用态',
);
assert.deepEqual(
  coreBetaManualConnectorModeReady({
    ariaChecked: 'false',
    manualSurface: { list_visible: true, option_count: 5, empty_visible: false },
    capabilities: { connectorRouting: { mode: 'manual' } },
  }),
  { ok: true, list_ready: true, public_manual: true, aria_checked: false },
  'Core Beta v2 连接器手动模式应接受手动列表加 connectorRouting.mode=manual 权威读回',
);
assert.equal(
  coreBetaManualConnectorModeReady({
    ariaChecked: 'true',
    manualSurface: { list_visible: true, option_count: 0, empty_visible: true },
    capabilities: {},
  }).ok,
  true,
  'capabilities 暂未提供 routing 时，标准 radio 选中态与手动空列表应形成有效读回',
);
assert.equal(
  coreBetaManualConnectorModeReady({
    ariaChecked: 'true',
    manualSurface: { list_visible: false, option_count: 5, empty_visible: false },
    capabilities: { connectorRouting: { mode: 'manual' } },
  }).ok,
  false,
  '只有 radio/routing 手动态但没有真实手动列表时不得判定完成',
);
assert.deepEqual(
  coreBetaDirectConnectorListModeReady({
    manualControlPresent: false,
    submenuOpened: true,
    manualSurface: { list_visible: true, option_count: 28, empty_visible: false },
    capabilities: { connectorRouting: { mode: 'auto' }, selectedConnectors: null },
  }),
  {
    ok: true,
    manual_control_present: false,
    submenu_opened: true,
    list_ready: true,
    public_state_readable: true,
    public_mode: 'auto',
  },
  '新版连接器菜单直接展示列表时，Auto 空选择是点击具体连接器前的合法可选择表面',
);
assert.equal(
  coreBetaDirectConnectorListModeReady({
    manualControlPresent: false,
    submenuOpened: true,
    manualSurface: { list_visible: true, option_count: 28, empty_visible: false },
    capabilities: { connectorRouting: { mode: 'auto' } },
  }).ok,
  false,
  '直接列表可见但 selectedConnectors 公开状态缺失时不得绕过取证门禁',
);
assert.equal(
  coreBetaDirectConnectorListModeReady({
    manualControlPresent: false,
    submenuOpened: true,
    manualSurface: { list_visible: false, option_count: 28, empty_visible: false },
    capabilities: { connectorRouting: { mode: 'manual' } },
  }).ok,
  false,
  '公开 routing 可读但连接器列表未真实显示时不得通过',
);
assert.equal(
  coreBetaDirectConnectorListModeReady({
    manualControlPresent: true,
    submenuOpened: true,
    manualSurface: { list_visible: true, option_count: 28, empty_visible: false },
    capabilities: { connectorRouting: { mode: 'manual' } },
  }).ok,
  false,
  '旧 manual 控件仍存在时必须保留原点击合同，不能走直接列表兼容分支',
);
assert.deepEqual(
  coreBetaDirectSkillListReady({
    manualControlPresent: false,
    submenuOpened: true,
    manualSurface: {
      search_visible: true,
      list_visible: true,
      option_count: 30,
      empty_visible: false,
    },
    capabilities: { selectedSkills: null },
  }),
  {
    ok: true,
    manual_control_present: false,
    submenu_opened: true,
    list_ready: true,
    public_state_readable: true,
  },
  '新版技能直接列表必须同时证明搜索/列表表面和 selectedSkills 公开状态可读',
);
assert.equal(
  coreBetaDirectSkillListReady({
    manualControlPresent: false,
    submenuOpened: true,
    manualSurface: {
      search_visible: true,
      list_visible: true,
      option_count: 30,
      empty_visible: false,
    },
    capabilities: {},
  }).ok,
  false,
  '新版技能列表缺少 selectedSkills 公开字段时不得判为可安全执行',
);
assert.equal(
  coreBetaUnifiedSubmenuSurfaceReady({
    optionSelectorRequired: true,
    optionCount: 0,
    emptyVisible: true,
  }),
  true,
  'rc.100 可见技能空态 Portal 应被识别为已打开，不能因没有 mode/option 节点误报框架失败',
);
assert.equal(
  coreBetaUnifiedSubmenuSurfaceReady({
    optionSelectorRequired: true,
    optionCount: 0,
    emptyVisible: false,
  }),
  false,
  '既无能力选项也无明确空态的 Portal 不得被判为完整可见表面',
);
{
  const evidenceDir = fs.mkdtempSync(path.join(os.tmpdir(), 'qbot-capability-inventory-prerequisite-'));
  try {
    const screenshot = path.join(evidenceDir, 'skill-empty.png');
    fs.writeFileSync(screenshot, Buffer.alloc(256, 11));
    const state = {
      task: { id: null, running: false, send_count: 0, message_count: 0 },
      skills: { selected: [] },
    };
    const blocker = coreBetaCapabilityInventoryPrerequisite({
      testCaseId: 'QWD-ENTRY-002',
      capabilityKind: 'skill',
      before: state,
      after: structuredClone(state),
      manualSurface: {
        search_visible: true,
        list_visible: true,
        option_count: 0,
        empty_visible: true,
      },
      inventoryText: '还没安装技能\n管理技能',
      screenshot,
      noPromptRecorded: true,
      noSendReceiptRecorded: true,
    });
    assert.equal(blocker.valid, true);
    assert.equal(blocker.outcome, 'blocked');
    assert.equal(blocker.mutation_guard.valid, true);
    const blockerFile = path.join(evidenceDir, 'capability-inventory-prerequisite.json');
    writeJsonFile(blockerFile, blocker);
    const artifacts = {
      capability_selection: blockerFile,
      core_beta_not_applicable_roles: blocker.not_applicable_roles.map((role) => ({
        role,
        blocker_path: blockerFile,
      })),
    };
    for (const role of ['qwork_daily_readback', 'composer_attachment_state', 'data_integrity_readback']) {
      const file = path.join(evidenceDir, `${role}.json`);
      writeJsonFile(file, qworkDailyEvidenceEnvelope(
        'QWD-ENTRY-002',
        { phase: 'pre_send_capability_inventory', blocker_path: blockerFile },
        false,
        true,
      ));
      artifacts[role] = file;
    }
    const manifest = buildCoreEvidenceManifest({
      testCase: {
        id: 'QWD-ENTRY-002',
        evidence_roles: [
          'qwork_daily_readback',
          'task_id',
          'prompt',
          'send_receipt',
          'transcript',
          'reply_delta',
          'reply_completion',
          'capability_selection',
          'capability_execution_event',
          'composer_attachment_state',
          'data_integrity_readback',
        ],
      },
      caseDir: evidenceDir,
      artifacts,
    });
    assert.equal(manifest.complete, true, '技能空库存 prerequisite 必须形成完整 QWD-ENTRY-002 manifest');
    assert.deepEqual(manifest.missing_roles, []);
    assert.deepEqual(manifest.invalid_roles, []);
  } finally {
    fs.rmSync(evidenceDir, { recursive: true, force: true });
  }
}
assert.equal(
  coreBetaCapabilityInteractionCategory({ controlLocated: false, clickDispatched: false }),
  'automation_error',
  '未定位或未点击真实控件属于框架错误',
);
assert.equal(
  coreBetaCapabilityInteractionCategory({
    controlLocated: true,
    clickDispatched: true,
    publicStateReadable: false,
    expectedStateObserved: false,
  }),
  'automation_error',
  '动作已派发但公开状态不可读时仍属于框架错误',
);
assert.equal(
  coreBetaCapabilityInteractionCategory({
    controlLocated: true,
    clickDispatched: true,
    publicStateReadable: true,
    expectedStateObserved: false,
  }),
  'bug',
  '真实控件已点击但产品状态未生效时应归为产品 Bug',
);
assert.equal(
  coreBetaCapabilityInteractionCategory({
    controlLocated: true,
    clickDispatched: true,
    expectedStateObserved: true,
  }),
  '',
  '真实控件点击且读回成功时不应产生错误分类',
);
assert.equal(
  coreBetaComposerResetFailureCategory({
    operationResults: [true, false, true],
    residueObserved: false,
    failureCategories: ['bug'],
  }),
  'bug',
  '通用 reset 不得把已确认的产品交互失败覆盖成 automation_error',
);
assert.equal(
  coreBetaComposerResetFailureCategory({
    operationResults: [true, false],
    residueObserved: false,
    failureCategories: ['automation_error'],
  }),
  'automation_error',
  '定位、点击或读回本身失败时 reset 必须保持框架错误',
);
{
  const evidenceDir = fs.mkdtempSync(path.join(os.tmpdir(), 'qbot-core-beta-pre-send-capability-'));
  try {
    const screenshot = path.join(evidenceDir, 'manual-skill-failure.png');
    fs.writeFileSync(screenshot, Buffer.alloc(256, 7));
    const interaction = {
      schema_version: 'qbot-core-beta-capability-interaction/v1',
      capability_kind: 'skill',
      stage: 'manual_skill_selection',
      expected_identity: 'skillhub:global/qfin-ppt-brand-assets@1.0.0',
      control_testid: 'composer-skill-option-qfin-ppt-brand-assets',
      control_located: true,
      click_dispatched: true,
      expected_state_observed: false,
      aria_checked: 'false',
      manual_surface: {
        search_visible: true,
        list_visible: true,
        option_count: 30,
        empty_visible: false,
      },
      screenshot,
      category: 'bug',
    };
    const before = {
      task: { id: null, running: false, send_count: 31, message_count: 0 },
      skills: { selected: [] },
    };
    const after = structuredClone(before);
    const evidence = coreBetaPreSendCapabilityFailureEvidence({
      testCaseId: 'BETA-SKILL-009',
      capabilityKind: 'skill',
      expectedIdentity: 'skillhub:global/qfin-ppt-brand-assets@1.0.0',
      before,
      after,
      interaction,
      noPromptRecorded: true,
      noSendReceiptRecorded: true,
    });
    assert.equal(evidence.valid, true);
    assert.equal(evidence.interaction.stage, 'manual_skill_selection');
    assert.equal(evidence.interaction.expected_identity, evidence.expected_identity);
    assert.equal(evidence.oracle_valid, false);
    assert.equal(evidence.mutation_guard.send_count_unchanged, true);
    assert.deepEqual(evidence.not_applicable_roles, [
      'capability_execution_event',
      'prompt',
      'task_id',
      'send_receipt',
      'transcript',
      'reply_delta',
      'reply_completion',
    ]);
    assert.equal(
      coreBetaPreSendCapabilityFailureEvidence({
        testCaseId: 'BETA-SKILL-009',
        capabilityKind: 'skill',
        expectedIdentity: 'skillhub:global/qfin-ppt-brand-assets@1.0.0',
        before,
        after: { ...after, task: { ...after.task, send_count: 32 } },
        interaction,
        noPromptRecorded: true,
        noSendReceiptRecorded: true,
      }).valid,
      false,
      '发送计数发生变化时不得把发送后角色标为 N/A',
    );
    assert.equal(
      coreBetaPreSendCapabilityFailureEvidence({
        testCaseId: 'BETA-SKILL-009',
        capabilityKind: 'skill',
        expectedIdentity: 'skillhub:global/another-skill@1.0.0',
        before,
        after,
        interaction,
        noPromptRecorded: true,
        noSendReceiptRecorded: true,
      }).valid,
      false,
      '精确 Skill 选择失败证据必须绑定当前 Case 期望的同一稳定 identity',
    );

    const failedManualMode = {
      ...interaction,
      stage: 'manual_mode',
      expected_identity: undefined,
      control_testid: 'composer-skill-mode-manual',
      manual_surface: {
        search_visible: false,
        list_visible: false,
        option_count: 0,
        empty_visible: false,
      },
    };
    const successfulConnectorMode = {
      ...interaction,
      capability_kind: 'connector',
      stage: 'manual_mode',
      control_testid: 'composer-connector-mode-manual',
      expected_state_observed: true,
      aria_checked: 'true',
      manual_surface: { list_visible: true, option_count: 28, empty_visible: false },
      category: '',
    };
    let preservedInteractions = preserveCoreBetaFailedCapabilityInteraction(
      [],
      failedManualMode,
      false,
    );
    preservedInteractions = preserveCoreBetaFailedCapabilityInteraction(
      preservedInteractions,
      successfulConnectorMode,
      true,
    );
    assert.equal(preservedInteractions.length, 1);
    assert.equal(preservedInteractions[0].capability_kind, 'skill');
    assert.equal(preservedInteractions[0].expected_state_observed, false);
    assert.equal(preservedInteractions[0].screenshot, screenshot);

    const dailyFailure = coreBetaPreSendCapabilityFailureEvidence({
      testCaseId: 'QWD-ENTRY-002',
      capabilityKind: 'skill',
      expectedIdentity: 'skill:manual-mode',
      before,
      after,
      interaction: {
        ...preservedInteractions[0],
        expected_identity: 'skill:manual-mode',
      },
      noPromptRecorded: true,
      noSendReceiptRecorded: true,
    });
    assert.equal(dailyFailure.evidence_valid, true);
    assert.equal(dailyFailure.oracle_valid, false);
    const dailyConnectorFailure = coreBetaPreSendCapabilityFailureEvidence({
      testCaseId: 'QWD-ENTRY-002',
      capabilityKind: 'connector',
      expectedIdentity: 'mcphub:risk',
      before: {
        task: { id: null, running: false, send_count: 31, message_count: 0 },
        connectors: { selected: [] },
      },
      after: {
        task: { id: null, running: false, send_count: 31, message_count: 0 },
        connectors: { selected: [] },
      },
      interaction: {
        ...interaction,
        capability_kind: 'connector',
        stage: 'manual_connector_selection',
        expected_identity: 'mcphub:risk',
        control_testid: 'composer-connector-option-mcphub:risk',
        manual_surface: { list_visible: true, option_count: 27, empty_visible: false },
      },
      noPromptRecorded: true,
      noSendReceiptRecorded: true,
    });
    assert.equal(dailyConnectorFailure.evidence_valid, true);
    assert.equal(dailyConnectorFailure.oracle_valid, false);
    assert.equal(dailyConnectorFailure.interaction.stage, 'manual_connector_selection');
    assert.equal(dailyConnectorFailure.mutation_guard.before_task.id, null);
    assert.equal(dailyConnectorFailure.mutation_guard.after_task.id, null);
    assert.equal(dailyConnectorFailure.mutation_guard.send_count_unchanged, true);
    assert.deepEqual(dailyConnectorFailure.mutation_guard.before_selection, []);
    assert.deepEqual(dailyConnectorFailure.mutation_guard.after_selection, []);
    const inventoryMismatchFailure = coreBetaPreSendCapabilityFailureEvidence({
      testCaseId: 'SIT-SKILL-026',
      capabilityKind: 'skill',
      expectedIdentity: 'QA Node Runtime',
      before,
      after,
      interaction: {
        schema_version: 'qbot-core-beta-capability-interaction/v1',
        capability_kind: 'skill',
        stage: 'manual_skill_selection',
        expected_identity: 'QA Node Runtime',
        control_testid: '',
        control_located: false,
        click_dispatched: false,
        selection_surface_located: true,
        inventory_mismatch: true,
        public_state_readable: true,
        expected_state_observed: false,
        aria_checked: 'false',
        manual_surface: {
          search_visible: true,
          list_visible: true,
          option_count: 44,
          empty_visible: false,
        },
        screenshot,
        category: 'bug',
      },
      noPromptRecorded: true,
      noSendReceiptRecorded: true,
    });
    assert.equal(inventoryMismatchFailure.evidence_valid, true, '已安装 Skill 缺失但列表仍有其他选项时必须形成完整发送前产品负向证据');
    assert.equal(inventoryMismatchFailure.oracle_valid, false);
    assert.equal(inventoryMismatchFailure.interaction.inventory_mismatch, true);
    assert.equal(inventoryMismatchFailure.mutation_guard.valid, true);
    const installFailureScreenshot = path.join(evidenceDir, 'skill-install-failure.png');
    const installedListScreenshot = path.join(evidenceDir, 'skill-installed-list-readback.png');
    fs.writeFileSync(installFailureScreenshot, Buffer.alloc(256, 11));
    fs.writeFileSync(installedListScreenshot, Buffer.alloc(256, 13));
    const installInteraction = {
      schema_version: 'qbot-core-beta-capability-interaction/v1',
      capability_kind: 'skill',
      stage: 'skill_installation',
      expected_identity: '自动解析web接口并同步yapi接口文档',
      control_testid: 'visible-skill-market-install',
      control_located: true,
      click_dispatched: true,
      expected_state_observed: false,
      failure_feedback: {
        terminal: true,
        success: false,
        failure: true,
        pending: false,
        source: 'installed-tab-new-explicit-failure-after-targeted-install',
        text: '安装失败：Skill package path is forbidden: scripts/yapi_sync_lib/credentials.py',
        action_bound: true,
        baseline_absent: true,
        before_failure_lines: [],
        after_failure_lines: ['安装失败：Skill package path is forbidden: scripts/yapi_sync_lib/credentials.py'],
      },
      installed_list_readback: {
        read_succeeded: true,
        expected_identity: '自动解析web接口并同步yapi接口文档',
        target_present: false,
        page_text: '已安装技能',
      },
      screenshot: installFailureScreenshot,
      installed_list_screenshot: installedListScreenshot,
      category: 'bug',
    };
    const installFailureRoles = [
      'capability_execution_event',
      'prompt',
      'send_receipt',
      'transcript',
      'reply_delta',
      'reply_completion',
    ];
    const installFailure = coreBetaPreSendCapabilityFailureEvidence({
      testCaseId: 'SIT-SKILL-025',
      capabilityKind: 'skill',
      expectedIdentity: installInteraction.expected_identity,
      before,
      after,
      interaction: installInteraction,
      noPromptRecorded: true,
      noSendReceiptRecorded: true,
      notApplicableRoles: installFailureRoles,
    });
    assert.equal(installFailure.evidence_valid, true, '明确安装拒绝必须形成结构完整的发送前产品负向证据');
    assert.equal(installFailure.oracle_valid, false);
    assert.equal(installFailure.kind, 'skill_installation_product_failure_before_send');
    assert.equal(installFailure.source, 'visible_skill_install_click_failure_feedback_and_zero_send_readback');
    assert.deepEqual(installFailure.not_applicable_roles, installFailureRoles);
    assert.match(installFailure.installed_list_screenshot.sha256, /^[a-f0-9]{64}$/);
    assert.equal(
      coreBetaPreSendCapabilityFailureEvidence({
        testCaseId: 'SIT-SKILL-025',
        capabilityKind: 'skill',
        expectedIdentity: installInteraction.expected_identity,
        before,
        after,
        interaction: {
          ...installInteraction,
          failure_feedback: { ...installInteraction.failure_feedback, action_bound: false },
        },
        noPromptRecorded: true,
        noSendReceiptRecorded: true,
        notApplicableRoles: installFailureRoles,
      }).evidence_valid,
      false,
      'action-bound 来源缺少因果绑定字段时必须保持 automation_error',
    );
    assert.equal(
      coreBetaPreSendCapabilityFailureEvidence({
        testCaseId: 'SIT-SKILL-025',
        capabilityKind: 'skill',
        expectedIdentity: installInteraction.expected_identity,
        before,
        after,
        interaction: { ...installInteraction, installed_list_screenshot: '' },
        noPromptRecorded: true,
        noSendReceiptRecorded: true,
        notApplicableRoles: installFailureRoles,
      }).evidence_valid,
      false,
      '已安装页截图缺失时必须保持 automation_error',
    );
    assert.equal(
      coreBetaPreSendCapabilityFailureEvidence({
        testCaseId: 'SIT-SKILL-025',
        capabilityKind: 'skill',
        expectedIdentity: installInteraction.expected_identity,
        before,
        after,
        interaction: {
          ...installInteraction,
          installed_list_readback: { ...installInteraction.installed_list_readback, read_succeeded: false },
        },
        noPromptRecorded: true,
        noSendReceiptRecorded: true,
        notApplicableRoles: installFailureRoles,
      }).evidence_valid,
      false,
      '已安装库存读回失败时必须保持 automation_error',
    );
    assert.equal(
      coreBetaPreSendCapabilityFailureEvidence({
        testCaseId: 'SIT-SKILL-025',
        capabilityKind: 'skill',
        expectedIdentity: installInteraction.expected_identity,
        before,
        after,
        interaction: {
          ...installInteraction,
          failure_feedback: {
            ...installInteraction.failure_feedback,
            terminal: false,
            failure: false,
            pending: true,
            text: '正在安装，请稍候',
          },
        },
        noPromptRecorded: true,
        noSendReceiptRecorded: true,
        notApplicableRoles: installFailureRoles,
      }).evidence_valid,
      false,
      '仅有 pending 安装反馈时不得物化产品失败 N/A 证据',
    );
    assert.equal(
      coreBetaPreSendCapabilityFailureEvidence({
        testCaseId: 'SIT-SKILL-025',
        capabilityKind: 'skill',
        expectedIdentity: installInteraction.expected_identity,
        before,
        after: { ...after, task: { ...after.task, id: 'unexpected-task' } },
        interaction: installInteraction,
        noPromptRecorded: true,
        noSendReceiptRecorded: true,
        notApplicableRoles: installFailureRoles,
      }).evidence_valid,
      false,
      '安装失败后出现 taskId 时不得把会话证据标为 N/A',
    );
    const installBlockerFile = path.join(evidenceDir, 'skill-install-pre-send-failure.json');
    writeJsonFile(installBlockerFile, installFailure);
    const installManifest = buildCoreEvidenceManifest({
      testCase: {
        id: 'SIT-SKILL-025',
        evidence_roles: ['capability_selection', ...installFailureRoles],
      },
      caseDir: evidenceDir,
      artifacts: {
        capability_selection: installBlockerFile,
        core_beta_not_applicable_roles: installFailureRoles.map((role) => ({
          role,
          blocker_path: installBlockerFile,
        })),
      },
    });
    assert.equal(installManifest.complete, true, 'SIT-SKILL-025 明确安装拒绝必须形成完整 manifest');
    assert.deepEqual(installManifest.missing_roles, []);
    assert.deepEqual(installManifest.invalid_roles, []);
    const blockerFile = path.join(evidenceDir, 'daily-pre-send-capability-failure.json');
    writeJsonFile(blockerFile, dailyConnectorFailure);
    const dailyArtifacts = { capability_selection: blockerFile };
    for (const role of ['qwork_daily_readback', 'composer_attachment_state', 'data_integrity_readback']) {
      const file = path.join(evidenceDir, `${role}.json`);
      writeJsonFile(file, qworkDailyEvidenceEnvelope(
        'QWD-ENTRY-002',
        { phase: 'pre_send_composer_reset', blocker_path: blockerFile },
        false,
        true,
      ));
      dailyArtifacts[role] = file;
      assert.deepEqual(
        validateEvidenceFile(role, file),
        { valid: true },
        `${role} 的产品负向读回必须保持 evidence_valid=true`,
      );
    }
    dailyArtifacts.core_beta_not_applicable_roles = dailyConnectorFailure.not_applicable_roles.map((role) => ({
      role,
      blocker_path: blockerFile,
    }));
    const dailyManifest = buildCoreEvidenceManifest({
      testCase: {
        id: 'QWD-ENTRY-002',
        evidence_roles: [
          'qwork_daily_readback',
          'task_id',
          'prompt',
          'send_receipt',
          'transcript',
          'reply_delta',
          'reply_completion',
          'capability_selection',
          'capability_execution_event',
          'composer_attachment_state',
          'data_integrity_readback',
        ],
      },
      caseDir: evidenceDir,
      artifacts: dailyArtifacts,
    });
    assert.equal(dailyManifest.complete, true, 'QWD-ENTRY-002 发送前产品失败必须形成完整 manifest');
    assert.deepEqual(dailyManifest.missing_roles, []);
    assert.deepEqual(dailyManifest.invalid_roles, []);
    assert.deepEqual(
      dailyManifest.not_applicable_roles.map((item) => item.role).sort(),
      [...dailyConnectorFailure.not_applicable_roles].sort(),
      'Connector 点击已派发但未选中时，完整发送链和 capability execution 必须受校验地标为 N/A',
    );
    assert.equal(
      resultHasAutomationError({
        status: 'failed',
        result_category: 'bug',
        steps: [{ status: 'failed', category: 'bug', actual: '技能手动模式点击后未生效' }],
        assertions: [],
      }),
      false,
      '证据完整的 QWD-ENTRY-002 产品失败必须保持 bug 并允许后续独立 Case 继续',
    );
  } finally {
    fs.rmSync(evidenceDir, { recursive: true, force: true });
  }
}
{
  const evidenceDir = fs.mkdtempSync(path.join(os.tmpdir(), 'qbot-qwork-workspace-selection-failure-'));
  try {
    const screenshot = path.join(evidenceDir, 'workspace-a-selection-failed.png');
    fs.writeFileSync(screenshot, Buffer.alloc(256, 17));
    const workspaceA = path.join(evidenceDir, 'fixture', 'A');
    const workspaceB = path.join(evidenceDir, 'fixture', 'B');
    const cleanupFile = path.join(evidenceDir, 'qwork-workspace-fixture-cleanup.json');
    const cleanupPayload = {
      valid: true,
      attempts: [
        { target: workspaceA, present_before: true, result: true },
        { target: workspaceB, present_before: true, result: true },
      ],
      remaining_fixture_paths: [],
    };
    writeJsonFile(cleanupFile, cleanupPayload);
    const cleanup = {
      ...cleanupPayload,
      evidence_file: cleanupFile,
      evidence_sha256: createHash('sha256').update(fs.readFileSync(cleanupFile)).digest('hex'),
    };
    const emptyTask = {
      task: { id: null, running: false, send_count: 41, message_count: 0 },
    };
    const blocker = qworkDailyWorkspaceSelectionFailureEvidence({
      testCaseId: 'QWD-WS-001',
      workspace: workspaceA,
      registration: {
        valid: true,
        saved_a: { path: workspaceA },
        saved_b: { path: workspaceB },
      },
      selection: {
        schema_version: 'qbot-qwork-daily-workspace-selection/v1',
        ok: false,
        trigger_located: true,
        menu_opened: true,
        target_located: true,
        click_dispatched: true,
        expected_state_observed: false,
        failure_category: 'bug',
        screenshot,
      },
      before: emptyTask,
      after: structuredClone(emptyTask),
      cleanup,
      noPromptRecorded: true,
      noSendReceiptRecorded: true,
    });
    assert.equal(blocker.valid, true, '真实工作空间点击未生效且零发送/清理完整时应保持产品 Bug');
    assert.equal(blocker.outcome, 'bug');
    assert.equal(blocker.mutation_guard.valid, true);
    const blockerFile = path.join(evidenceDir, 'workspace-selection-product-failure.json');
    writeJsonFile(blockerFile, blocker);
    const artifacts = {
      core_beta_not_applicable_roles: blocker.not_applicable_roles.map((role) => ({
        role,
        blocker_path: blockerFile,
      })),
    };
    for (const role of ['qwork_daily_readback', 'data_integrity_readback']) {
      const file = path.join(evidenceDir, `${role}.json`);
      writeJsonFile(file, qworkDailyEvidenceEnvelope(
        'QWD-WS-001',
        { phase: 'pre_send_workspace_selection', blocker_path: blockerFile },
        false,
        true,
      ));
      artifacts[role] = file;
    }
    const manifest = buildCoreEvidenceManifest({
      testCase: {
        id: 'QWD-WS-001',
        evidence_roles: [
          'qwork_daily_readback',
          'data_integrity_readback',
          'task_id',
          'prompt',
          'send_receipt',
          'transcript',
          'reply_delta',
          'reply_completion',
        ],
      },
      caseDir: evidenceDir,
      artifacts,
    });
    assert.equal(manifest.complete, true, 'QWD-WS-001 发送前产品失败必须形成完整 manifest');
    assert.deepEqual(manifest.missing_roles, []);
    assert.deepEqual(manifest.invalid_roles, []);
    assert.deepEqual(
      manifest.not_applicable_roles.map((item) => item.role),
      blocker.not_applicable_roles,
    );
    assert.equal(
      qworkDailyWorkspaceSelectionFailureEvidence({
        testCaseId: 'QWD-WS-001',
        workspace: workspaceA,
        registration: blocker.registration,
        selection: blocker.interaction,
        before: emptyTask,
        after: structuredClone(emptyTask),
        cleanup: { ...cleanup, valid: false, remaining_fixture_paths: [workspaceA] },
        noPromptRecorded: true,
        noSendReceiptRecorded: true,
      }).valid,
      false,
      'A/B 注册项仍残留时不得把会话证据标为 N/A',
    );
  } finally {
    fs.rmSync(evidenceDir, { recursive: true, force: true });
  }
}
assert.equal(qworkDailyWorkspaceTaskBindingVerdict({
  workspace_a: '/tmp/qwork/A',
  workspace_b: '/tmp/qwork/B',
  registration: { valid: true },
  selection_a: { ok: true, cwd: '/tmp/qwork/A' },
  task_a: { task_id: 'a', cwd: '/tmp/qwork/A', reply_text: 'QWORK_WORKSPACE_A_MARKER' },
  locked_task_a: { workspace_picker_visible: false, editable_workspace_select_count: 0, cwd: '/tmp/qwork/A' },
  selection_b: { ok: true, cwd: '/tmp/qwork/B' },
  task_b: { task_id: 'b', cwd: '/tmp/qwork/B', reply_text: 'QWORK_WORKSPACE_B_MARKER' },
  reopen_a: { ok: true },
  reopened_task_a: { task_id: 'a', cwd: '/tmp/qwork/A' },
  session_readback: { task_a: { id: 'a', cwd: '/tmp/qwork/A' }, task_b: { id: 'b', cwd: '/tmp/qwork/B' } },
  cleanup: { valid: true },
}), true, 'QWD-WS-001 正常路径必须闭合 A/B taskId 和 cwd 持久化');
{
  const nativeCalls = [];
  const activated = activateCoreBetaNativeImeHost('teams360', {
    run(command, args) {
      nativeCalls.push({ command, args });
      return { status: 0, stdout: '360Teams\n', stderr: '' };
    },
  });
  assert.equal(activated.required, true);
  assert.equal(activated.ready, true);
  assert.equal(activated.frontmost_process, '360Teams');
  assert.equal(activated.attempt_count, 1);
  assert.equal(activated.attempts.length, 1);
  assert.equal(nativeCalls.length, 1);
  assert.equal(nativeCalls[0].command, 'osascript');
  assert.match(nativeCalls[0].args[1], /360Teams[\s\S]*frontmost is true[\s\S]*count of frontmostProcesses/);
  const transientCalls = [];
  const transientResults = [
    {
      status: 1,
      stdout: '',
      stderr: 'System Events: no frontmost application process (-1719)',
    },
    { status: 0, stdout: '360Teams\n', stderr: '' },
  ];
  const recovered = activateCoreBetaNativeImeHost('teams360', {
    run(command, args) {
      transientCalls.push({ command, args });
      return transientResults.shift();
    },
  });
  assert.equal(recovered.ready, true);
  assert.equal(recovered.attempt_count, 2);
  assert.equal(recovered.attempts[0].command_status, 1);
  assert.match(recovered.attempts[0].error, /-1719/);
  assert.equal(recovered.attempts[1].frontmost_process, '360Teams');
  assert.equal(transientCalls.length, 2);
  assert.deepEqual(
    activateCoreBetaNativeImeHost('local', {
      run() { throw new Error('non-Teams lane must not activate a native host'); },
    }),
    {
      schema_version: 'qbot-core-beta-native-ime-host-activation/v1',
      required: false,
      ready: true,
      application: '',
      frontmost_process: '',
    },
  );
  assert.throws(
    () => activateCoreBetaNativeImeHost('teams360', {
      run() { return { status: 0, stdout: 'Codex\n', stderr: '' }; },
      maxAttempts: 2,
    }),
    /activation failed before Composer focus after bounded retries/,
    'Teams IME 必须在点击 Composer 前读回 360Teams 为 frontmost',
  );

  const calls = [];
  const focusStates = [
    { document_has_focus: false, active_element_matches: true, composer_visible: true },
    { document_has_focus: true, active_element_matches: true, composer_visible: true },
  ];
  const page = {
    async bringToFront() { calls.push('bringToFront'); },
    async waitForTimeout() { calls.push('waitForTimeout'); },
  };
  const input = {
    async click(options) { calls.push(`click:${options?.force === true}`); },
    async focus() { calls.push('focus'); },
    async evaluate() { calls.push('evaluate'); return focusStates.shift(); },
  };
  const focus = await prepareCoreBetaNativeImeFocus(page, input);
  assert.equal(focus.ready, true);
  assert.equal(focus.attempts.length, 2);
  assert.deepEqual(calls.slice(0, 4), ['bringToFront', 'click:true', 'focus', 'evaluate']);
  assert.deepEqual(calls.slice(5, 9), ['bringToFront', 'click:true', 'focus', 'evaluate']);

  const validTrace = coreBetaNativeImeTraceVerdict({
    prompt: '请用Skill A分析Q3收入，比较Beta版本。',
    readback: '请用Skill A分析Q3收入，比较Beta版本。',
    events: [{ type: 'compositionstart' }, { type: 'compositionend' }],
    focusArm: focus,
    nativeCommandStatus: 0,
  });
  assert.equal(validTrace.valid, true);
  assert.equal(validTrace.evidence_valid, true);
  assert.equal(validTrace.oracle_valid, true);
  assert.equal(validTrace.adapter_noop, false);
  const noOpTrace = coreBetaNativeImeTraceVerdict({
    prompt: '请用Skill A分析Q3收入，比较Beta版本。',
    readback: '',
    events: [],
    focusArm: focus,
    nativeCommandStatus: 0,
  });
  assert.equal(noOpTrace.valid, false);
  assert.equal(noOpTrace.evidence_valid, false);
  assert.equal(noOpTrace.oracle_valid, false);
  assert.equal(noOpTrace.adapter_noop, true, '原生命令成功但零文本零事件必须识别为框架适配器 no-op');

  const productFailureTrace = coreBetaNativeImeTraceVerdict({
    prompt: '请用Skill A分析Q3收入，比较Beta版本。',
    readback: 'qingyong Skill Afenxi Q3收入，比较Beta版本。',
    events: [{ type: 'beforeinput' }, { type: 'compositionstart' }, { type: 'compositionend' }],
    focusArm: focus,
    nativeCommandStatus: 0,
  });
  assert.equal(productFailureTrace.valid, false);
  assert.equal(productFailureTrace.evidence_valid, true, '真实IME事件和读回完整时，产品文本失败不得污染证据有效性');
  assert.equal(productFailureTrace.oracle_valid, false);
}
{
  const evidenceDir = fs.mkdtempSync(path.join(os.tmpdir(), 'qbot-core-beta-pre-send-ime-'));
  try {
    const screenshot = path.join(evidenceDir, 'ime-input-failure.png');
    fs.writeFileSync(screenshot, Buffer.alloc(256, 9));
    const task = { id: null, running: false, send_count: 41, message_count: 0 };
    const traceData = {
      valid: false,
      evidence_valid: true,
      oracle_valid: false,
      exact_readback: false,
      composition_start: true,
      composition_end: true,
      event_count: 8,
      native_command_status: 0,
      adapter_noop: false,
    };
    const evidence = coreBetaPreSendImeFailureEvidence({
      testCaseId: 'BETA-CHAT-010',
      before: { task },
      after: { task: structuredClone(task) },
      focusArm: { schema_version: 'qbot-core-beta-native-ime-focus/v1', ready: true, attempts: [] },
      traceData,
      screenshot,
      noPromptRecorded: true,
      noSendReceiptRecorded: true,
    });
    assert.equal(evidence.valid, true);
    assert.equal(evidence.outcome, 'bug');
    assert.equal(evidence.mutation_guard.send_count_unchanged, true);
    assert.deepEqual(evidence.not_applicable_roles, [
      'prompt', 'task_id', 'send_receipt', 'transcript', 'reply_delta', 'reply_completion',
    ]);
    const blocker = path.join(evidenceDir, 'pre-send-ime-failure.json');
    const traceFile = path.join(evidenceDir, 'ime-event-trace.json');
    writeJsonFile(blocker, evidence);
    writeJsonFile(traceFile, traceData);
    const manifest = buildCoreEvidenceManifest({
      testCase: {
        id: 'BETA-CHAT-010',
        evidence_roles: ['ime_event_trace', ...evidence.not_applicable_roles],
      },
      caseDir: evidenceDir,
      artifacts: {
        ime_event_trace: traceFile,
        core_beta_not_applicable_roles: evidence.not_applicable_roles.map((role) => ({
          role,
          blocker_path: blocker,
        })),
      },
    });
    assert.equal(manifest.complete, true, '真实IME产品失败必须以零发送N/A证据继续批次');
    assert.deepEqual(manifest.invalid_roles, []);
    assert.deepEqual(manifest.not_applicable_roles.map((item) => item.role), evidence.not_applicable_roles);

    writeJsonFile(traceFile, { ...traceData, evidence_valid: false });
    const invalidTraceManifest = buildCoreEvidenceManifest({
      testCase: { id: 'BETA-CHAT-010', evidence_roles: ['ime_event_trace'] },
      caseDir: evidenceDir,
      artifacts: { ime_event_trace: traceFile },
    });
    assert.equal(invalidTraceManifest.complete, false, 'IME取证本身无效时仍必须 fail-closed');
    assert.deepEqual(invalidTraceManifest.invalid_roles, ['ime_event_trace']);
    writeJsonFile(traceFile, traceData);
    const tamperedEvidence = {
      ...evidence,
      not_applicable_roles: [...evidence.not_applicable_roles, 'capability_selection'],
    };
    writeJsonFile(blocker, tamperedEvidence);
    const tamperedManifest = buildCoreEvidenceManifest({
      testCase: {
        id: 'BETA-CHAT-010',
        evidence_roles: tamperedEvidence.not_applicable_roles,
      },
      caseDir: evidenceDir,
      artifacts: {
        core_beta_not_applicable_roles: tamperedEvidence.not_applicable_roles.map((role) => ({
          role,
          blocker_path: blocker,
        })),
      },
    });
    assert.equal(
      tamperedManifest.complete,
      false,
      'IME发送前产品失败不得越权把能力选择等无关证据角色标为N/A',
    );
    writeJsonFile(blocker, evidence);
    assert.equal(
      coreBetaPreSendImeFailureEvidence({
        testCaseId: 'BETA-CHAT-010',
        before: { task },
        after: { task: structuredClone(task) },
        focusArm: { ready: true },
        traceData: { ...traceData, event_count: 0, adapter_noop: true },
        screenshot,
        noPromptRecorded: true,
        noSendReceiptRecorded: true,
      }).valid,
      false,
      '零文本零事件属于框架适配器失败，禁止伪装成可继续的产品Bug',
    );
  } finally {
    fs.rmSync(evidenceDir, { recursive: true, force: true });
  }
}
assert.equal(
  coreBetaConnectorOptionTestId('builtin:qbot_vision'),
  'composer-connector-option-builtin:qbot_vision',
  '含冒号的 connector key 必须保持 renderer 稳定 testid 合同',
);
const cleanupBase = {
  dialogs_open: 0,
  capability_cleanup_required: true,
  required_bridge_methods: ['setSkillsDisabled', 'setConnectorsDisabled', 'setExpert'],
  bridge_availability: {
    setSkillsDisabled: true,
    setConnectorsDisabled: true,
    setExpert: true,
  },
  bridge_invocations: {
    setSkillsDisabled: { attempted: true, ok: true },
    setConnectorsDisabled: { attempted: true, ok: true },
    setExpert: { attempted: true, ok: true },
  },
  bridge_results: {
    setSkillsDisabled: [],
    setConnectorsDisabled: [],
    setExpert: { expert: null, expertIdentity: null },
  },
};
assert.equal(
  coreBetaCleanupCapabilitiesNeedsRetry({ __error: 'Teams QWork capabilities timed out after 5000ms' }),
  true,
  '清理 capabilities 的受管超时必须触发有界重试',
);
assert.equal(
  coreBetaCleanupCapabilitiesNeedsRetry({
    selectedSkills: [],
    selectedConnectors: [],
    currentExpert: null,
  }),
  false,
  '明确的 capabilities 空态不得重复读取或扩大清理副作用',
);
let expertCapabilitiesReadCount = 0;
const expertCapabilitiesRecovered = await coreBetaCapabilitiesReadbackWithRetry(async () => {
  expertCapabilitiesReadCount += 1;
  if (expertCapabilitiesReadCount === 1) {
    throw new Error('Teams QWork capabilities timed out after 5000ms');
  }
  return { currentExpert: { id: 'expert-qa-001' } };
}, {
  maxAttempts: 3,
  timeoutMs: 100,
  retryDelayMs: 0,
  delay: async () => {},
});
assert.equal(expertCapabilitiesRecovered.ok, true, 'Expert capabilities 首次超时后必须通过受管只读重试恢复');
assert.equal(expertCapabilitiesReadCount, 2, 'Expert capabilities 恢复不得重复执行状态变更，只应重试只读接口');
assert.deepEqual(
  expertCapabilitiesRecovered.attempts.map((attempt) => ({ ok: attempt.ok, error: attempt.error })),
  [
    { ok: false, error: 'Teams QWork capabilities timed out after 5000ms' },
    { ok: true, error: '' },
  ],
  'Expert capabilities 重试账本必须保留首次超时和随后成功',
);
let hangingCapabilitiesReadCount = 0;
const hangingCapabilitiesRecovered = await coreBetaCapabilitiesReadbackWithRetry(async () => {
  hangingCapabilitiesReadCount += 1;
  if (hangingCapabilitiesReadCount === 1) return new Promise(() => {});
  return { selectedSkills: null, selectedConnectors: null, currentExpert: null };
}, {
  maxAttempts: 3,
  timeoutMs: 20,
  retryDelayMs: 0,
  delay: async () => {},
});
assert.equal(
  hangingCapabilitiesRecovered.ok,
  true,
  '公开 capabilities IPC 永不 resolve 时，框架必须在有界超时后只读重试并恢复',
);
assert.equal(hangingCapabilitiesReadCount, 2, '公开 capabilities 挂起恢复不得重复执行任何写操作');
assert.equal(hangingCapabilitiesRecovered.attempts[0].ok, false, '挂起的首次 capabilities 读回必须记为失败尝试');
assert.equal(hangingCapabilitiesRecovered.attempts[1].ok, true, '第二次 capabilities 只读重试应保留成功账本');
assert.match(
  runner,
  /BETA-EXPERT-001[\s\S]*set_expert_result[\s\S]*coreBetaCapabilitiesReadbackWithRetry[\s\S]*capabilities_readback_attempts/,
  'BETA-EXPERT-001 必须把一次性 setExpert 与可重试 capabilities 读回分离并保存账本',
);
assert.match(
  runner,
  /const \[capabilities, experts, drafts\] = await Promise\.all\(\[\s*window\.agent\.capabilities\(\),\s*lifecycle\.list\(\),\s*lifecycle\.listDrafts\(\)/,
  'Expert lifecycle 初始化必须读取公开 window.agent.capabilities，不得假设 lifecycle.capabilities 存在',
);
assert.doesNotMatch(
  runner,
  /lifecycle\.capabilities\(\)/,
  'Expert 场景不得调用不存在的 expertLifecycle.capabilities API',
);
assert.doesNotMatch(
  runner,
  /\.getOperation\([^,\n)]+\)/,
  'Expert 发布轮询不得只传 operationId；当前公开 bridge 还要求 draftId 和发布时 CAS',
);
assert.match(
  runner,
  /current = await lifecycle\.getOperation\(\s*started\.id \|\| started\.operationId,\s*draft\.id,\s*draftCas,\s*\)/,
  'BETA-EXPERT-007 必须用 operationId、draftId 和发布时 CAS 轮询三个专家发布操作',
);
assert.match(
  runner,
  /CORE_BETA_PUBLIC_CAPABILITIES_TIMEOUT_MS[\s\S]*currentCapabilities[\s\S]*Promise\.race[\s\S]*coreBetaCapabilitiesReadbackWithRetry/,
  'Core Beta v2 所有公开 capabilities 读回必须使用有界 Promise.race 与只读重试，禁止挂死串行批次',
);
assert.match(
  runner,
  /capabilitiesReadbackAttempts[\s\S]*Core Beta capabilities readback timed out[\s\S]*capabilities_readback_attempts/,
  'Core Beta v2 最终公共状态证据必须保留 capabilities 读回尝试与超时诊断',
);
assert.match(
  runner,
  /BETA-EXPERT-012[\s\S]*const draftCas = String\(draft\?\.etag \|\| ''\)\.trim\(\) \|\| Number\(draft\?\.revision\)[\s\S]*getOperation\(operationId, draft\.id, draftCas\)/,
  'BETA-EXPERT-012 新版本发布轮询必须绑定同一 draft 和 CAS',
);
const expert012AuthoringReplyIndex = runner.indexOf('const authoringReply = await runPromptInCurrentTask({');
const expert012ReplyGuardIndex = runner.indexOf(
  'if (authoringReply.incomplete !== false || authoringReply.timeout_cleanup_ok !== true)',
  expert012AuthoringReplyIndex,
);
const expert012ConfigOpenIndex = runner.indexOf('await configOpenConfig.click();', expert012AuthoringReplyIndex);
const expert012PublishOpenIndex = runner.indexOf('await publishOpenConfig.click();', expert012AuthoringReplyIndex);
assert.ok(
  expert012AuthoringReplyIndex >= 0
    && expert012ReplyGuardIndex > expert012AuthoringReplyIndex
    && expert012ConfigOpenIndex > expert012ReplyGuardIndex
    && expert012PublishOpenIndex > expert012ReplyGuardIndex,
  'BETA-EXPERT-012 回复必须显式完整且超时清理成功，硬门禁必须早于任何配置读回或发布动作',
);
assert.match(
  runner.slice(expert012ReplyGuardIndex, expert012ConfigOpenIndex),
  /BETA-EXPERT-012 维护回复未可靠终态，禁止后续配置与发布/,
  'BETA-EXPERT-012 回复终态失败必须在配置动作前 fail-closed',
);
assert.match(
  runner,
  /qworkDailyExpertLifecycleCase[\s\S]*const draftCas = String\(draft\?\.etag \|\| ''\)\.trim\(\) \|\| Number\(draft\?\.revision\)[\s\S]*api\.getOperation\(operationId, draft\.id, draftCas\)/,
  'QWD-EXPERT-011 owner 生命周期发布轮询必须绑定同一 draft 和 CAS',
);
const expertSummonSelected = {
  id: 'expert-qa-001',
  activeReleaseId: 'release-qa-001',
  version: { id: 'version-qa-001' },
};
const expertSummonIdentity = {
  expertId: 'expert-qa-001',
  releaseId: 'release-qa-001',
  versionId: 'version-qa-001',
};
const expertSummonVerdict = coreBetaExpertSummonTaskVerdict({
  selected: expertSummonSelected,
  upstreamState: { task: { id: 'upstream-task-001' } },
  cleanDraftState: { task: { id: null, message_count: 0, send_count: 9, running: false } },
  selectionState: { expert: expertSummonIdentity },
  conversationState: {
    task: { id: 'expert-task-001', message_count: 2, send_count: 10, running: false },
    expert: expertSummonIdentity,
  },
  recent: { ok: true, expertId: 'expert-qa-001' },
  setExpertResult: { expertIdentity: expertSummonIdentity },
});
assert.equal(expertSummonVerdict.valid, true, '干净草稿生成的新taskId和四处专家identity一致时应通过');
const reusedUpstreamExpertTask = coreBetaExpertSummonTaskVerdict({
  selected: expertSummonSelected,
  upstreamState: { task: { id: 'upstream-task-001' } },
  cleanDraftState: { task: { id: null, message_count: 0, send_count: 9, running: false } },
  selectionState: { expert: expertSummonIdentity },
  conversationState: {
    task: { id: 'upstream-task-001', message_count: 4, send_count: 10, running: false },
    expert: expertSummonIdentity,
  },
  recent: { ok: true, expertId: 'expert-qa-001' },
  setExpertResult: { expertIdentity: expertSummonIdentity },
});
assert.equal(reusedUpstreamExpertTask.valid, false, 'BETA-EXPERT-001 不得接受上一条Case的旧taskId');
assert.equal(reusedUpstreamExpertTask.checks.fresh_task_id, false);
assert.match(
  runner,
  /BETA-EXPERT-001[\s\S]*await openNewTask\(page, state\)[\s\S]*setExpert\(expertId\)[\s\S]*executeConversationTurns[\s\S]*coreBetaExpertSummonTaskVerdict/,
  'BETA-EXPERT-001 必须从干净任务执行召唤和真实发送，再校验独立taskId',
);
assert.match(
  runner,
  /ownedProjection\.valid = true[\s\S]*ownedProjection\.evidence_valid = true[\s\S]*ownedProjection\.oracle_valid = ownedProjectionOracleValid/,
  '发布记录业务Oracle失败不得把结构完整的product_state_diff标成无效证据',
);
const cleanupMarketTimeout = {
  capability_cleanup_required: true,
  capabilities_after: { __error: 'Teams QWork capabilities timed out after 5000ms' },
  capabilities_readback_attempts: [1, 2, 3].map((attempt) => ({
    attempt,
    ok: false,
    error: 'Teams QWork capabilities timed out after 5000ms',
  })),
  composer_surface_available: false,
};
assert.equal(
  coreBetaCleanupReadbackNeedsComposerRecovery(cleanupMarketTimeout),
  true,
  'Skill 市场无 composer 且三次 capabilities 读回都超时时，必须导航到干净输入区恢复只读交叉取证',
);
assert.equal(
  coreBetaCleanupReadbackNeedsComposerRecovery({
    ...cleanupMarketTimeout,
    composer_surface_available: true,
    selection_readbacks: {
      visible_ui: {
        surface: 'unified-plus',
        visible_skill_chips: [],
        visible_connector_chips: [],
        visible_expert_avatar_count: 0,
      },
    },
  }),
  false,
  '当前统一输入区已明确为空时不得通过再次导航隐藏真实能力残留',
);
assert.equal(
  coreBetaCleanupReadbackNeedsComposerRecovery({
    ...cleanupMarketTimeout,
    composer_surface_available: true,
    selection_readbacks: {
      visible_ui: {
        surface: 'unified-plus',
        visible_skill_chips: ['本Case技能'],
        visible_connector_chips: [],
        visible_expert_avatar_count: 0,
      },
    },
  }),
  true,
  '能力读回耗尽且可见统一输入区无法证明为空时，必须导航恢复独立空态读回',
);
assert.deepEqual(
  coreBetaCleanupReadbackVerdict({
    ...cleanupBase,
    capabilities_after: {
      selectedSkills: [],
      selectedConnectors: [],
      currentExpert: null,
    },
  }),
  {
    valid: true,
    selection_source: 'agent.capabilities',
    direct_capabilities_error: '',
    bridge_failures: [],
    superseded_bridge_failures: [],
    errors: [],
  },
  '清理读回应优先接受 capabilities 中明确为空的技能、连接器和专家状态',
);
assert.equal(
  coreBetaCleanupReadbackVerdict({
    ...cleanupBase,
    capabilities_after: { __error: 'Teams QWork capabilities timed out after 5000ms' },
    selection_readbacks: {
      e2e_state: {
        available: true,
        error: '',
        selected_skills_observed: false,
        selected_skills: null,
        selected_connectors_observed: false,
        selected_connectors: null,
        current_expert_observed: true,
        current_expert: null,
      },
      visible_ui: {
        available: true,
        error: '',
        selected_skills_observed: true,
        selected_skills: [],
        selected_connectors_observed: true,
        selected_connectors: [],
        current_expert_observed: true,
        current_expert: null,
      },
    },
  }).selection_source,
  'visible_ui',
  'capabilities IPC 超时时，必须允许可见禁用控件与 E2E 专家状态对空选择做独立交叉读回',
);
const cleanupCapabilitiesTimedOutOnVisibleUnifiedComposer = {
  ...cleanupBase,
  capabilities_after: { __error: 'Core Beta cleanup capabilities timed out after 6500ms' },
  capabilities_readback_attempts: [1, 2, 3].map((attempt) => ({
    attempt,
    ok: false,
    error: 'Core Beta cleanup capabilities timed out after 6500ms',
  })),
  composer_surface_available: true,
  pre_cleanup_selection_readback: {
    ok: true,
    readable: true,
    skills_readable: true,
    connectors_readable: true,
    expert_readable: true,
    skills_empty: true,
    connectors_empty: true,
    expert_empty: true,
    selected_skills: null,
    selected_connectors: null,
    current_expert: null,
  },
  selection_readbacks: {
    visible_ui: {
      available: false,
      error: '',
      selected_skills_observed: true,
      selected_skills: ['cleanup-not-confirmed:unified-skill'],
      selected_connectors_observed: true,
      selected_connectors: ['cleanup-not-confirmed:unified-connector'],
      current_expert_observed: true,
      current_expert: null,
      surface: 'unified-plus',
      visible_skill_chips: [],
      visible_connector_chips: [],
      visible_expert_avatar_count: 0,
    },
  },
};
const cleanupCapabilitiesTimedOutWithBoundInitContext = {
  ...cleanupCapabilitiesTimedOutOnVisibleUnifiedComposer,
  pre_cleanup_selection_readback: null,
  selection_readbacks: {
    init_context: {
      available: true,
      error: '',
      context: 'active',
      active_id: 'task-cleanup',
      source_id: 'task-cleanup',
      binding_matches: true,
      selected_skills_observed: true,
      selected_skills: null,
      selected_connectors_observed: true,
      selected_connectors: null,
      current_expert_observed: true,
      current_expert: null,
    },
    visible_ui: cleanupCapabilitiesTimedOutOnVisibleUnifiedComposer.selection_readbacks.visible_ui,
  },
};
assert.equal(
  coreBetaCleanupReadbackVerdict(cleanupCapabilitiesTimedOutWithBoundInitContext).selection_source,
  'agent.init_context_and_visible_ui',
  'capabilities 超时时，精确绑定当前 taskId 的 init context 空态与可见统一 Composer 空态应形成独立交叉读回',
);
assert.equal(
  coreBetaCleanupReadbackVerdict({
    ...cleanupCapabilitiesTimedOutWithBoundInitContext,
    selection_readbacks: {
      ...cleanupCapabilitiesTimedOutWithBoundInitContext.selection_readbacks,
      init_context: {
        ...cleanupCapabilitiesTimedOutWithBoundInitContext.selection_readbacks.init_context,
        source_id: 'other-task',
        binding_matches: false,
      },
    },
  }).valid,
  false,
  'init context 与当前 taskId 不匹配时不得用其他会话的空态放行清理',
);
assert.equal(
  coreBetaCleanupReadbackVerdict({
    ...cleanupCapabilitiesTimedOutWithBoundInitContext,
    selection_readbacks: {
      ...cleanupCapabilitiesTimedOutWithBoundInitContext.selection_readbacks,
      init_context: {
        ...cleanupCapabilitiesTimedOutWithBoundInitContext.selection_readbacks.init_context,
        selected_skills_observed: false,
      },
    },
  }).valid,
  false,
  'init context 省略任一能力字段时仍必须 fail-closed',
);
assert.equal(
  coreBetaCleanupReadbackVerdict({
    ...cleanupCapabilitiesTimedOutWithBoundInitContext,
    selection_readbacks: {
      ...cleanupCapabilitiesTimedOutWithBoundInitContext.selection_readbacks,
      visible_ui: {
        ...cleanupCapabilitiesTimedOutWithBoundInitContext.selection_readbacks.visible_ui,
        visible_connector_chips: ['leftover-connector'],
      },
    },
  }).valid,
  false,
  'init context 空态不得掩盖当前 Composer 中可见的 Connector 残留',
);
assert.equal(
  coreBetaCleanupReadbackVerdict(cleanupCapabilitiesTimedOutOnVisibleUnifiedComposer).selection_source,
  'pre_cleanup_and_visible_ui',
  '三次 capabilities 超时后，发送前权威空态、成功清理桥和当前统一 Composer 可见空态应形成交叉读回',
);
assert.equal(
  coreBetaCleanupReadbackVerdict({
    ...cleanupCapabilitiesTimedOutOnVisibleUnifiedComposer,
    selection_readbacks: {
      visible_ui: {
        ...cleanupCapabilitiesTimedOutOnVisibleUnifiedComposer.selection_readbacks.visible_ui,
        visible_skill_chips: ['leftover-skill'],
      },
    },
  }).valid,
  false,
  '发送前空态不得掩盖清理终态可见的 Skill 残留',
);
assert.equal(
  coreBetaCleanupReadbackVerdict({
    ...cleanupBase,
    ...cleanupMarketTimeout,
    composer_surface_available: true,
    cleanup_surface_recovery: {
      attempted: true,
      completed: true,
      screenshot_sha256: 'a'.repeat(64),
    },
    selection_readbacks: {
      visible_ui: {
        available: true,
        error: '',
        selected_skills_observed: true,
        selected_skills: [],
        selected_connectors_observed: true,
        selected_connectors: [],
        current_expert_observed: true,
        current_expert: null,
      },
    },
  }).valid,
  true,
  '导航到 composer 后，无能力 chip、无专家头像且清理桥为空的交叉读回应通过',
);
assert.equal(
  coreBetaCleanupReadbackVerdict({
    ...cleanupBase,
    ...cleanupMarketTimeout,
    composer_surface_available: true,
    cleanup_surface_recovery: {
      attempted: true,
      completed: true,
      screenshot_sha256: 'b'.repeat(64),
    },
    selection_readbacks: {
      visible_ui: {
        available: true,
        error: '',
        selected_skills_observed: true,
        selected_skills: ['leftover-skill'],
        selected_connectors_observed: true,
        selected_connectors: [],
        current_expert_observed: true,
        current_expert: null,
      },
    },
  }).valid,
  false,
  '导航恢复读回后发现任一能力残留仍必须失败',
);
assert.equal(
  coreBetaCleanupReadbackVerdict({
    ...cleanupBase,
    capabilities_after: { __error: 'timeout' },
    selection_readbacks: {
      visible_ui: {
        available: true,
        error: '',
        selected_skills_observed: true,
        selected_skills: [{ slug: 'leftover-skill' }],
        selected_connectors_observed: true,
        selected_connectors: [],
        current_expert_observed: true,
        current_expert: null,
      },
    },
  }).valid,
  false,
  'capabilities 超时不能掩盖可见输入区中真实残留的技能选择',
);
assert.equal(
  coreBetaCleanupReadbackVerdict({
    ...cleanupBase,
    capabilities_after: { selectedSkills: [], selectedConnectors: [], currentExpert: null },
    bridge_invocations: {
      ...cleanupBase.bridge_invocations,
      setExpert: { attempted: true, ok: false },
    },
  }).valid,
  false,
  '任一清理桥动作失败时，即使最终 capabilities 看似为空也必须 fail-closed',
);
const supersededCleanupVerdict = coreBetaCleanupReadbackVerdict({
  ...cleanupBase,
  capabilities_after: { selectedSkills: null, selectedConnectors: null, currentExpert: null },
  bridge_invocations: {
    setSkillsDisabled: { attempted: true, ok: false },
    setConnectorsDisabled: { attempted: true, ok: false },
    setExpert: { attempted: true, ok: false },
  },
  bridge_results: {
    setSkillsDisabled: { __error: 'desktop-local context mutation was superseded' },
    setConnectorsDisabled: { __error: 'desktop-local context mutation was superseded' },
    setExpert: { __error: 'desktop-local context mutation was superseded' },
  },
});
assert.equal(
  supersededCleanupVerdict.valid,
  true,
  '幂等清理被新版 desktop-local 上下文替代时，只有公开 capabilities 独立证明 Auto 无显式能力残留才可通过',
);
assert.deepEqual(supersededCleanupVerdict.bridge_failures, []);
assert.deepEqual(supersededCleanupVerdict.superseded_bridge_failures, [
  'setSkillsDisabled',
  'setConnectorsDisabled',
  'setExpert',
]);
assert.equal(
  coreBetaCleanupReadbackVerdict({
    ...cleanupBase,
    capabilities_after: {
      selectedSkills: [{ slug: 'leftover-skill' }],
      selectedConnectors: null,
      currentExpert: null,
    },
    bridge_invocations: supersededCleanupVerdict.superseded_bridge_failures.reduce(
      (accumulator, name) => ({ ...accumulator, [name]: { attempted: true, ok: false } }),
      {},
    ),
    bridge_results: supersededCleanupVerdict.superseded_bridge_failures.reduce(
      (accumulator, name) => ({
        ...accumulator,
        [name]: { __error: 'desktop-local context mutation was superseded' },
      }),
      {},
    ),
  }).valid,
  false,
  'superseded 不能掩盖公开 capabilities 中仍存在的显式能力残留',
);
const skillInstallReceipts = Array.from({ length: 5 }, (_, index) => ({
  qualified_identity: `global/qa-skill-${index + 1}/1.0.0`,
  clicked: true,
  before: `/tmp/qa-skill-${index + 1}-before.png`,
  pending: `/tmp/qa-skill-${index + 1}-pending.png`,
  after: `/tmp/qa-skill-${index + 1}-after.png`,
  pending_observed: true,
  terminal_feedback: {
    observed: true,
    status: index === 0 ? 'error' : 'success',
    message: index === 0 ? '安装失败：SkillHub package metadata cannot contain agent_created' : '安装成功，本机对账已完成',
  },
  api_receipt: { install_ok: index !== 0 },
  reconcile_receipt: { ok: index !== 0 },
  catalog_installed_checked: true,
  installed: index !== 0,
  installed_readback: index === 0 ? null : { slug: `qa-skill-${index + 1}` },
  feedback: index === 0 ? '安装失败：SkillHub package metadata cannot contain agent_created' : '安装成功',
}));
const skillInstallProductFailureAssessment = coreBetaSkillInstallBatchAssessment(skillInstallReceipts, 5);
assert.deepEqual(
  skillInstallProductFailureAssessment,
  {
    valid: true,
    oracle_valid: false,
    expected_count: 5,
    attempted_count: 5,
    installed_count: 4,
    failed_count: 1,
    installed_identities: skillInstallReceipts.slice(1).map((item) => item.qualified_identity),
    failed_identities: [skillInstallReceipts[0].qualified_identity],
  },
  'Skill 安装产品失败必须保留完整 evidence，并以 oracle_valid=false 进入产品 Bug 判定',
);
const skillInstallEvidenceDir = fs.mkdtempSync(path.join(os.tmpdir(), 'qbot-core-beta-skill-install-'));
try {
  const eventFile = path.join(skillInstallEvidenceDir, 'capability-execution-event.json');
  writeJsonFile(eventFile, { ...skillInstallProductFailureAssessment, receipts: skillInstallReceipts });
  const manifest = buildCoreEvidenceManifest({
    testCase: {
      id: 'BETA-SKILL-003',
      evidence_roles: ['capability_inventory', 'capability_selection', 'capability_execution_event'],
    },
    caseDir: skillInstallEvidenceDir,
    artifacts: {
      capability_inventory: eventFile,
      capability_selection: eventFile,
      capability_execution_event: eventFile,
    },
  });
  assert.equal(manifest.complete, true, 'Skill 产品安装失败的完整结构化证据不得被 manifest 误判为缺失');
} finally {
  fs.rmSync(skillInstallEvidenceDir, { recursive: true, force: true });
}
const genericTerminalFailureReceipts = skillInstallReceipts.map((item, index) => (
  index === 0
    ? {
        ...item,
        terminal_feedback: {
          surface_observed: true,
          observed: false,
          action_bound: true,
          status: 'error',
          message: '安装失败：SkillHub package metadata cannot contain agent_created',
        },
      }
    : item
));
assert.equal(
  coreBetaSkillInstallBatchAssessment(genericTerminalFailureReceipts, 5).valid,
  true,
  '已观察当前样本 pending 后出现的通用 error 文案必须作为动作绑定的完整终态证据',
);
const timedOutPendingReceipts = skillInstallReceipts.map((item, index) => (
  index === 0
    ? {
        ...item,
        installed: false,
        installed_readback: null,
        terminal_feedback: {
          surface_observed: true,
          observed: true,
          status: 'pending',
          message: '正在安装技能「qa-skill-1」…',
        },
        terminal_outcome: 'timed_out',
        terminal_timeout_ms: 120_000,
        terminal_waited_ms: 120_000,
        api_receipt: { install_ok: null },
        reconcile_receipt: { ok: null },
      }
    : item
));
assert.deepEqual(
  coreBetaSkillInstallBatchAssessment(timedOutPendingReceipts, 5),
  {
    valid: true,
    oracle_valid: false,
    expected_count: 5,
    attempted_count: 5,
    installed_count: 4,
    failed_count: 1,
    installed_identities: timedOutPendingReceipts.slice(1).map((item) => item.qualified_identity),
    failed_identities: [timedOutPendingReceipts[0].qualified_identity],
  },
  '完整等待窗口耗尽后的 pending 必须作为证据完整的产品失败终态，而不是 invalid manifest',
);
assert.equal(
  coreBetaSkillInstallBatchAssessment(
    timedOutPendingReceipts.map((item, index) => (
      index === 0 ? { ...item, terminal_waited_ms: 59_999 } : item
    )),
    5,
  ).valid,
  false,
  '未等满至少 60 秒的 pending 不得伪装成 timed_out 完整终态',
);
assert.equal(
  coreBetaSkillInstallBatchAssessment(
    skillInstallReceipts.map((item, index) => (index === 0 ? { ...item, pending: '' } : item)),
    5,
  ).valid,
  false,
  'Skill 安装失败缺少 pending 截图时仍必须 fail-closed，不能用产品 Bug 掩盖证据缺失',
);
assert.deepEqual(
  coreBetaSkillInstallBatchAssessment(skillInstallReceipts.map((item, index) => (
    index === 0
      ? {
          ...item,
          installed: true,
          installed_readback: { slug: 'qa-skill-1' },
          api_receipt: { install_ok: true },
          reconcile_receipt: { ok: false },
          terminal_feedback: { observed: true, status: 'error', message: '已写入安装记录，但本机对账失败' },
        }
      : item
  )), 5).failed_identities,
  [skillInstallReceipts[0].qualified_identity],
  '服务端已安装但本机 reconcile 失败的 Skill 仍必须记为产品失败，不能进入成功账本',
);
assert.doesNotMatch(
  runner,
  /if \(!installed\) throw new Error\(`技能安装没有catalog\.installed终态/,
  'BETA-SKILL-003/004 不得把产品安装失败直接抛成不完整 manifest 框架异常',
);
assert.match(
  runner,
  /persistedReceipts\.filter\(\(item\) => item\.oracle_passed\)[\s\S]*install_attempt_receipts[\s\S]*assessment\.oracle_valid/,
  'Skill 安装批次必须分离尝试账本与成功账本，并保留产品 Oracle 结果',
);
assert.match(
  runner,
  /allowUnlabeledTerminal[\s\S]*terminal_feedback: terminalFeedback[\s\S]*terminal_outcome: terminalOutcome[\s\S]*terminal_waited_ms: terminalWaitedMs/,
  'Skill 安装必须绑定通用终态反馈，并为完整等待后的 pending 保存明确 timed_out 证据',
);
const prerequisiteAttempts = Array.from({ length: 10 }, (_, index) => {
  const succeeded = index === 9;
  return {
    qualified_identity: `global/qa-prerequisite-${index + 1}/1.0.0`,
    source_case_id: index < 5 ? 'BETA-SKILL-003' : 'BETA-SKILL-004',
    clicked: true,
    before: `/tmp/qa-prerequisite-${index + 1}-before.png`,
    pending: `/tmp/qa-prerequisite-${index + 1}-pending.png`,
    after: `/tmp/qa-prerequisite-${index + 1}-after.png`,
    pending_observed: true,
    terminal_feedback: {
      observed: true,
      status: succeeded ? 'success' : 'error',
      message: succeeded ? '安装成功，本机对账已完成' : '安装失败：产品返回错误',
    },
    api_receipt: { install_ok: succeeded },
    reconcile_receipt: { ok: succeeded },
    catalog_installed_checked: true,
    installed: succeeded,
    installed_readback: succeeded ? { slug: `qa-prerequisite-${index + 1}` } : null,
    oracle_passed: succeeded,
  };
});
const prerequisiteLedger = {
  skills: {
    selected: prerequisiteAttempts.map((item) => ({
      qualified_identity: item.qualified_identity,
      slug: item.qualified_identity.split('/')[1],
    })),
    install_attempt_receipts: prerequisiteAttempts,
    install_receipts: prerequisiteAttempts.filter((item) => item.oracle_passed),
  },
};
const completeSetBlocker = coreBetaSkillInstallPrerequisiteBlocker(prerequisiteLedger, {
  expectedCount: 10,
  dependentCaseId: 'BETA-SKILL-005',
});
assert.equal(completeSetBlocker.valid, true);
assert.equal(completeSetBlocker.applicable, true);
assert.equal(completeSetBlocker.successful_count, 1);
assert.deepEqual(completeSetBlocker.source_case_ids, ['BETA-SKILL-003', 'BETA-SKILL-004']);
assert.equal(
  coreBetaSkillInstallPrerequisiteBlocker(prerequisiteLedger, {
    expectedCount: 10,
    targetIdentity: prerequisiteAttempts[0].qualified_identity,
    dependentCaseId: 'BETA-SKILL-006',
  }).applicable,
  true,
  '依赖明确安装失败Skill的使用Case必须由真实尝试账本阻塞，禁止随机替换后发送',
);
assert.equal(
  coreBetaSkillInstallPrerequisiteBlocker(prerequisiteLedger, {
    expectedCount: 10,
    targetIdentity: prerequisiteAttempts[9].qualified_identity,
    dependentCaseId: 'BETA-SKILL-010',
  }).applicable,
  false,
  '真实安装成功的目标Skill不应被全局短缺误阻塞',
);
const pipelineSkillPrerequisiteLedger = {
  skills: {
    ...prerequisiteLedger.skills,
    deep_use: prerequisiteLedger.skills.selected.slice(0, 5),
  },
};
const pipelineSkillBlock = coreBetaSkillUsePrerequisiteDecision(
  { id: 'BETA-SKILL-006', case_type: 'skill_use' },
  pipelineSkillPrerequisiteLedger,
);
assert.equal(pipelineSkillBlock.applies, true);
assert.equal(pipelineSkillBlock.valid, true);
assert.equal(pipelineSkillBlock.blocker.applicable, true);
assert.equal(pipelineSkillBlock.selected_skill.qualified_identity, prerequisiteAttempts[0].qualified_identity);
assert.equal(
  coreBetaSkillUsePrerequisiteDecision(
    { id: 'BETA-SKILL-006', case_type: 'skill_use' },
    { skills: { ...pipelineSkillPrerequisiteLedger.skills, deep_use: [] } },
  ).valid,
  false,
  'pipeline 派发前缺少目标 Skill 身份时必须 fail-closed，不能先进入 manual 模式或发送',
);
const installedPromptAttempts = prerequisiteAttempts.map((item) => ({
  ...item,
  terminal_feedback: {
    observed: true,
    status: 'success',
    message: '安装成功，本机对账已完成',
  },
  api_receipt: { install_ok: true },
  reconcile_receipt: { ok: true },
  installed: true,
  installed_readback: { slug: item.qualified_identity.split('/')[1] },
  oracle_passed: true,
  status: 'passed',
  failure_category: '',
  failure_reason: '',
}));
const promptReadySamples = prerequisiteLedger.skills.selected.map((item, index) => {
  const promptSource = coreBetaSkillPromptSource({
    detail: { markdown: `# QA Skill ${index + 1}\nUse the exact ${item.qualified_identity} workflow.` },
  });
  return {
    ...item,
    detail: null,
    market: {},
    prompt_source: promptSource,
  };
});
const promptReadyLedger = {
  skills: {
    selected: promptReadySamples,
    deep_use: promptReadySamples.slice(0, 5),
    install_attempt_receipts: installedPromptAttempts,
    install_receipts: installedPromptAttempts,
  },
};
const promptReadyDecision = coreBetaSkillUsePrerequisiteDecision(
  { id: 'BETA-SKILL-009', case_type: 'skill_use' },
  promptReadyLedger,
);
assert.equal(promptReadyDecision.valid, true);
assert.equal(promptReadyDecision.blocker.applicable, false);
assert.equal(promptReadyDecision.blocker.prompt_source.valid, true);
assert.equal(
  coreBetaSkillPromptSource(promptReadyDecision.selected_skill).kind,
  'skill_detail_markdown',
  '安装后 live catalog 即使只剩简化条目，也必须继续使用 BETA-SKILL-002 冻结的说明内容与 SHA',
);
const missingPromptSample = {
  ...promptReadySamples[3],
  prompt_source: coreBetaSkillPromptSource({}),
};
const missingPromptLedger = {
  skills: {
    ...promptReadyLedger.skills,
    deep_use: promptReadyLedger.skills.deep_use.map((item, index) => (
      index === 3 ? missingPromptSample : item
    )),
  },
};
const missingPromptDecision = coreBetaSkillUsePrerequisiteDecision(
  { id: 'BETA-SKILL-009', case_type: 'skill_use' },
  missingPromptLedger,
);
assert.equal(missingPromptDecision.valid, true);
assert.equal(missingPromptDecision.blocker.applicable, true);
assert.equal(missingPromptDecision.blocker.kind, 'skill_prompt_source_unavailable');
assert.equal(missingPromptDecision.blocker.outcome, 'blocked');
assert.equal(missingPromptDecision.blocker.prompt_source.integrity_valid, true);
assert.match(missingPromptDecision.blocker.sample_sha256, /^[a-f0-9]{64}$/);
assert.equal(
  coreBetaSkillPromptSourcePrerequisiteBlocker({
    ...missingPromptSample,
    prompt_source: { ...missingPromptSample.prompt_source, sha256: 'f'.repeat(64) },
  }, { dependentCaseId: 'BETA-SKILL-009' }).valid,
  false,
  '冻结说明内容/SHA 漂移必须保持 framework issue，不能伪装成可信 blocked',
);
const pipelineExecutorSource = runner.match(
  /async function executeSingleHostPipelineBatch\([\s\S]*?\n}\n\nasync function prepareCoreBetaPipelineCase/,
)?.[0] || '';
assert.match(
  pipelineExecutorSource,
  /coreBetaSkillUsePrerequisiteDecision[\s\S]*requiresSerialPrerequisite[\s\S]*executeCasebookCase[\s\S]*dispatchSingleHostPipelineCase/,
  'single-host pipeline 必须在 composer 清理与发送前传播 Skill 安装阻塞',
);
assert.match(
  pipelineExecutorSource,
  /dispatchStopped = Boolean\([\s\S]*coreBetaCompletionBlockReason[\s\S]*coreBetaBatchStopReason/,
  'single-host pipeline 必须识别首个不完整 manifest 或 automation_error 结果',
);
assert.match(
  pipelineExecutorSource,
  /writeSingleHostPipelineLedger\(outDir, ledger\);\s*if \(dispatchStopped\) break/,
  'single-host pipeline 必须在保存结果账本后立即截断当前 wave',
);
assert.equal(
  coreBetaSkillInstallPrerequisiteBlocker({
    skills: {
      ...prerequisiteLedger.skills,
      install_attempt_receipts: prerequisiteAttempts.slice(0, 9),
    },
  }, { expectedCount: 10, dependentCaseId: 'BETA-SKILL-005' }).valid,
  false,
  '缺少任一安装终态收据时不得传播可信上游阻塞',
);
assert.equal(
  coreBetaSkillInstallPrerequisiteBlocker({
    skills: {
      ...prerequisiteLedger.skills,
      install_attempt_receipts: prerequisiteAttempts.map((item, index) => (
        index === 0 ? { ...item, source_case_id: 'BETA-SKILL-004' } : item
      )),
    },
  }, { expectedCount: 10, dependentCaseId: 'BETA-SKILL-005' }).valid,
  false,
  '安装收据的003/004批次归属漂移时不得传播可信上游阻塞',
);
const prerequisiteEvidenceDir = fs.mkdtempSync(path.join(os.tmpdir(), 'qbot-core-beta-skill-prerequisite-'));
try {
  const blockerFile = path.join(prerequisiteEvidenceDir, 'upstream-skill-install-prerequisite.json');
  const blocker = coreBetaSkillInstallPrerequisiteBlocker(prerequisiteLedger, {
    expectedCount: 10,
    targetIdentity: prerequisiteAttempts[0].qualified_identity,
    dependentCaseId: 'BETA-SKILL-006',
  });
  const notApplicableRoles = ['prompt', 'task_id', 'send_receipt', 'transcript', 'reply_delta', 'reply_completion'];
  writeJsonFile(blockerFile, { ...blocker, not_applicable_roles: notApplicableRoles });
  const manifest = buildCoreEvidenceManifest({
    testCase: {
      id: 'BETA-SKILL-006',
      evidence_roles: [...notApplicableRoles, 'capability_selection', 'capability_execution_event'],
    },
    caseDir: prerequisiteEvidenceDir,
    artifacts: {
      capability_selection: blockerFile,
      capability_execution_event: blockerFile,
      core_beta_not_applicable_roles: notApplicableRoles.map((role) => ({ role, blocker_path: blockerFile })),
    },
  });
  assert.equal(manifest.complete, true);
  assert.deepEqual(manifest.missing_roles, []);
  assert.deepEqual(manifest.not_applicable_roles.map((item) => item.role), notApplicableRoles);
  assert.ok(manifest.evidence.filter((item) => item.not_applicable).every(
    (item) => item.source === 'exact_run_owned_install_attempt_ledger' && item.sha256 === manifest.evidence[0].sha256,
  ));

  const promptBlocker = missingPromptDecision.blocker;
  writeJsonFile(blockerFile, { ...promptBlocker, not_applicable_roles: notApplicableRoles });
  const promptBlockedManifest = buildCoreEvidenceManifest({
    testCase: {
      id: 'BETA-SKILL-009',
      evidence_roles: [...notApplicableRoles, 'capability_selection', 'capability_execution_event'],
    },
    caseDir: prerequisiteEvidenceDir,
    artifacts: {
      capability_selection: blockerFile,
      capability_execution_event: blockerFile,
      core_beta_not_applicable_roles: notApplicableRoles.map((role) => ({ role, blocker_path: blockerFile })),
    },
  });
  assert.equal(promptBlockedManifest.complete, true);
  assert.deepEqual(promptBlockedManifest.missing_roles, []);
  assert.ok(promptBlockedManifest.evidence.filter((item) => item.not_applicable).every(
    (item) => item.source === 'frozen_skill_sample_ledger',
  ));

  writeJsonFile(blockerFile, { ...blocker, dependent_case_id: 'BETA-SKILL-007', not_applicable_roles: notApplicableRoles });
  const mismatched = buildCoreEvidenceManifest({
    testCase: { id: 'BETA-SKILL-006', evidence_roles: ['task_id'] },
    caseDir: prerequisiteEvidenceDir,
    artifacts: {
      core_beta_not_applicable_roles: [{ role: 'task_id', blocker_path: blockerFile }],
    },
  });
  assert.deepEqual(mismatched.missing_roles, ['task_id']);
} finally {
  fs.rmSync(prerequisiteEvidenceDir, { recursive: true, force: true });
}
const mcpReleaseOptions = {
  'backend-version': 'uat-backend-20260806',
  'prompt-policy-version': 'qwork-runtime-0.0.30-rc.2',
  'feature-flags-hash': 'a'.repeat(64),
  'qwork-build-id': '0.0.30-rc.2',
};
const mcpSelectionSeed = coreBetaMcpReleaseSelectionSeed(mcpReleaseOptions);
assert.match(mcpSelectionSeed, /^[a-f0-9]{64}$/);
assert.equal(
  mcpSelectionSeed,
  coreBetaMcpReleaseSelectionSeed(structuredClone(mcpReleaseOptions)),
  '相同发布身份必须产生稳定的 MCP 选择种子',
);
assert.notEqual(
  mcpSelectionSeed,
  coreBetaMcpReleaseSelectionSeed({ ...mcpReleaseOptions, 'qwork-build-id': '0.0.31' }),
  'QWork 发布身份变化必须改变 MCP 选择种子',
);
const readyConnector = ({ key, label, description, tools }) => ({
  key,
  label,
  description,
  source: key.startsWith('builtin:') ? 'builtin' : 'platform',
  statusKind: 'ready',
  statusLabel: '已接入',
  usable: true,
  enabled: true,
  tools: tools.map((tool) => ({
    enabled: true,
    effectiveEnabled: true,
    upstreamEnabled: true,
    userEnabled: true,
    ...tool,
  })),
});
const mcpCatalogSnapshot = normalizeCoreBetaConnectorCatalogSnapshot({
  capturedAt: '2026-08-06T00:00:00.000Z',
  catalog: {
    connectorCatalogStatus: { platform: 'ok' },
    connectors: [
      readyConnector({
        key: 'mcphub:wiki',
        label: '公司知识库',
        description: '文档问答与知识库检索',
        tools: [{ name: 'quick_answer', description: '查询知识库并返回来源文档' }],
      }),
      readyConnector({
        key: 'builtin:qbot_web',
        label: '网页搜索',
        description: '搜索公开网页',
        tools: [{ name: 'web_search', description: '搜索公开网页' }],
      }),
      readyConnector({
        key: 'mcphub:dds',
        label: '数据查询',
        description: '数据指标查询',
        tools: [{ name: 'query_metric', description: '读取指标' }],
      }),
      readyConnector({
        key: 'mcphub:wecom',
        label: '企微协作',
        description: '企业微信协作服务',
        tools: [
          { name: 'list_chat_records', description: '查询聊天记录' },
          {
            name: 'sendCustomerMessage',
            description: '客户消息动作',
            readOnly: true,
            annotations: { readOnlyHint: true },
          },
        ],
      }),
      readyConnector({
        key: 'builtin:qbot_chart',
        label: 'SVG 图表',
        description: '将数据生成为可视化图表',
        tools: [{ name: 'render_chart', description: '渲染 SVG 图表' }],
      }),
    ],
  },
  health: [{
    connectorKey: 'builtin:qbot_web',
    status: 'skipped',
    reason: 'stdio_not_probed',
  }],
  capabilities: { connectorRouting: { mode: 'auto' } },
});
assert.equal(mcpCatalogSnapshot.items.length, 5);
assert.ok(mcpCatalogSnapshot.items.every((item) => item.healthy), 'statusKind=ready + usable=true 必须被识别为权威健康目录状态');
assert.equal(
  mcpCatalogSnapshot.items.find((item) => item.key === 'mcphub:wecom')
    .tools.find((tool) => tool.name === 'sendCustomerMessage').read_only,
  false,
  '破坏性 camelCase 工具即使错误携带 readOnly hint 也不得被误选',
);
const mcpSelected = chooseCoreBetaConnectors(mcpCatalogSnapshot.items, 5, { seed: mcpSelectionSeed });
assert.deepEqual(
  mcpSelected.map((item) => item.category),
  ['document', 'search', 'data', 'collaboration', 'visualization'],
  'MCP样本必须按文档、搜索、数据、协作、可视化顺序确定性分层',
);
assert.deepEqual(
  chooseCoreBetaConnectors(mcpCatalogSnapshot.items, 5, { seed: mcpSelectionSeed }).map((item) => item.key),
  mcpSelected.map((item) => item.key),
  '相同发布种子必须稳定选择相同 connector key',
);
assert.equal(
  chooseCoreBetaConnectors(
    mcpCatalogSnapshot.items.filter((item) => item.category !== 'document'),
    1,
    { seed: mcpSelectionSeed },
  ).length,
  1,
  '非五样本调用必须保留任意健康只读 Connector 的既有选择语义',
);
const emptyMcpPublicState = {
  case_id: 'BETA-MCP-001',
  task: { id: null, running: false, message_count: 0 },
  expert: null,
  skills: { selected: [] },
  connectors: { selected: [] },
};
const emptyMcpCatalog = normalizeCoreBetaConnectorCatalogSnapshot({
  catalog: [],
  health: [],
  capabilities: { connectorRouting: { mode: 'disabled' } },
});
assert.equal(emptyMcpCatalog.items.length, 0);
assert.equal(
  coreBetaConnectorCatalogEvidenceValid(emptyMcpCatalog),
  true,
  '成功读取到的空 MCP 目录仍是结构完整的负向证据',
);
assert.equal(
  coreBetaConnectorCatalogEvidenceValid(normalizeCoreBetaConnectorCatalogSnapshot({
    catalog: { __error: 'catalog timeout' },
    health: [],
  })),
  false,
  'MCP 目录 bridge 读取错误必须继续 fail-closed',
);
const emptyMcpBlocker = coreBetaMcpSelectionPrerequisiteBlocker({
  testCase: { id: 'BETA-MCP-001', evidence_roles: [] },
  catalog: emptyMcpCatalog,
  selected: [],
  selectionSeed: mcpSelectionSeed,
  publicState: emptyMcpPublicState,
});
assert.equal(emptyMcpBlocker.valid, true, '空目录必须形成可信 blocked，而不是无效 manifest');
assert.equal(emptyMcpBlocker.eligible_count, 0);
assert.deepEqual(emptyMcpBlocker.missing_strata, [
  'document', 'search', 'data', 'collaboration', 'visualization',
]);
const emptyMcpInventoryDir = fs.mkdtempSync(path.join(os.tmpdir(), 'qbot-core-beta-empty-mcp-inventory-'));
try {
  const inventoryFile = path.join(emptyMcpInventoryDir, 'capability-inventory.json');
  writeJsonFile(inventoryFile, {
    valid: true,
    evidence_valid: true,
    oracle_valid: false,
    ...emptyMcpCatalog,
  });
  const manifest = buildCoreEvidenceManifest({
    testCase: { id: 'BETA-MCP-001', evidence_roles: ['capability_inventory'] },
    caseDir: emptyMcpInventoryDir,
    artifacts: { capability_inventory: inventoryFile },
  });
  assert.equal(manifest.complete, true, '空 MCP inventory 必须作为有效负向证据进入完整 manifest');
  assert.deepEqual(manifest.invalid_roles, []);
} finally {
  fs.rmSync(emptyMcpInventoryDir, { recursive: true, force: true });
}
const shortageCatalog = {
  ...mcpCatalogSnapshot,
  items: mcpCatalogSnapshot.items.filter((item) => item.category !== 'visualization'),
};
const sourceMcpBlocker = coreBetaMcpSelectionPrerequisiteBlocker({
  testCase: { id: 'BETA-MCP-001', evidence_roles: [] },
  catalog: shortageCatalog,
  selected: [],
  selectionSeed: mcpSelectionSeed,
  publicState: emptyMcpPublicState,
});
assert.equal(sourceMcpBlocker.valid, true, '缺少可视化分类样本时应形成可信 MCP 前置 blocker，而不是抛异常');
assert.equal(sourceMcpBlocker.outcome, 'blocked');
assert.deepEqual(sourceMcpBlocker.missing_strata, ['visualization']);
assert.equal(sourceMcpBlocker.mutation_guard.readback_shape_valid, true);
assert.equal(sourceMcpBlocker.mutation_guard.case_bound, true);
assert.equal(coreBetaMcpSelectionPrerequisiteBlocker({
  testCase: { id: 'BETA-MCP-001', evidence_roles: [] },
  catalog: shortageCatalog,
  selected: [],
  selectionSeed: mcpSelectionSeed,
  publicState: {},
}).valid, false, '缺少 Case-bound 公开空态读回时不得生成可信 MCP blocker');
const mcpPrerequisiteRoles = [
  'prompt',
  'task_id',
  'send_receipt',
  'transcript',
  'reply_delta',
  'reply_completion',
  'capability_selection',
  'capability_execution_event',
  'connection_snapshot_diagnostics',
  'log_excerpt',
];
const downstreamMcpCase = { id: 'BETA-MCP-003', evidence_roles: mcpPrerequisiteRoles };
const downstreamMcpBlocker = coreBetaMcpSelectionPrerequisiteBlocker({
  testCase: downstreamMcpCase,
  sourceBlocker: sourceMcpBlocker,
  publicState: { ...emptyMcpPublicState, case_id: 'BETA-MCP-003' },
});
assert.equal(downstreamMcpBlocker.valid, true);
assert.equal(downstreamMcpBlocker.dependent_case_id, 'BETA-MCP-003');
assert.deepEqual(downstreamMcpBlocker.not_applicable_roles, mcpPrerequisiteRoles);
const mcpPrerequisiteEvidenceDir = fs.mkdtempSync(path.join(os.tmpdir(), 'qbot-core-beta-mcp-prerequisite-'));
try {
  const blockerFile = path.join(mcpPrerequisiteEvidenceDir, 'mcp-selection-prerequisite.json');
  writeJsonFile(blockerFile, downstreamMcpBlocker);
  const artifacts = {
    core_beta_not_applicable_roles: mcpPrerequisiteRoles.map((role) => ({
      role,
      blocker_path: blockerFile,
    })),
  };
  const manifest = buildCoreEvidenceManifest({
    testCase: downstreamMcpCase,
    caseDir: mcpPrerequisiteEvidenceDir,
    artifacts,
  });
  assert.equal(manifest.complete, true, '可信 MCP 上游短缺必须生成完整 downstream N/A manifest');
  assert.deepEqual(manifest.missing_roles, []);
  assert.deepEqual(manifest.not_applicable_roles.map((item) => item.role), mcpPrerequisiteRoles);

  writeJsonFile(blockerFile, { ...downstreamMcpBlocker, dependent_case_id: 'BETA-MCP-004' });
  const tampered = buildCoreEvidenceManifest({
    testCase: downstreamMcpCase,
    caseDir: mcpPrerequisiteEvidenceDir,
    artifacts,
  });
  assert.deepEqual(tampered.missing_roles, mcpPrerequisiteRoles, 'MCP blocker Case 身份漂移后必须重新 fail-closed');
} finally {
  fs.rmSync(mcpPrerequisiteEvidenceDir, { recursive: true, force: true });
}
assert.match(
  runner,
  /statusKind[\s\S]*usable/,
  'MCP目录必须识别当前ready\/usable合同',
);
assert.match(
  runner,
  /mcp_catalog_deterministic_sample_5[\s\S]*coreBetaMcpSelectionPrerequisiteBlocker/,
  'MCP样本不足必须走 prerequisite blocked 而不是 throw',
);
assert.match(
  runner,
  /const inventoryEvidenceValid = coreBetaConnectorCatalogEvidenceValid\(catalog\);[\s\S]*valid: inventoryEvidenceValid,[\s\S]*evidence_valid: inventoryEvidenceValid/,
  'MCP inventory 必须按读取结构判定证据有效性，不能按目录条目数判定',
);
assert.doesNotMatch(
  runner,
  /writeJsonFile\(inventoryFile, \{ valid: catalog\.items\.length > 0/,
  '空 MCP 目录不得再被写成无效 capability inventory',
);
assert.match(
  automationFramework,
  /BETA-MCP-001[\s\S]*statusKind=ready[\s\S]*qbot-core-beta-mcp-prerequisite\/v1[\s\S]*BETA-MCP-002~008[\s\S]*继续后续独立 Case/,
  '框架合同必须固定 MCP 当前目录字段、五类抽样与上游短缺继续执行语义',
);
const runtimePrerequisiteRoles = [
  'expert_draft_lifecycle',
  'expert_builder_trace',
  'capability_selection',
  'capability_execution_event',
  'task_id',
  'prompt',
  'send_receipt',
  'transcript',
  'reply_delta',
  'reply_completion',
];
const runtimePrerequisiteTestCase = {
  id: 'BETA-EXPERT-003',
  evidence_roles: ['connection_view_snapshot', ...runtimePrerequisiteRoles],
};
const runtimePrerequisiteView = {
  runtimeOptions: {
    runtimeFamily: 'claude-code',
    options: [{
      runtimeFamily: 'claude-code',
      connectionId: 'qa-anthropic',
      protocol: 'anthropic',
      modelId: 'qa-model',
      disabled: false,
    }],
    selected: {
      runtimeFamily: 'claude-code',
      connectionId: 'qa-anthropic',
      protocol: 'anthropic',
      modelId: 'qa-model',
    },
  },
};
const runtimePrerequisiteState = {
  task: { id: null, running: false, send_count: 36, message_count: 0 },
  runtime: { family: 'claude-code' },
  expert: null,
  expert_drafts: [{ id: 'existing-draft', revision: 4, etag: 'draft-etag', status: 'editable' }],
  connection_view: runtimePrerequisiteView,
};
const runtimePrerequisiteBlocker = coreBetaRuntimeFamilyPrerequisiteBlocker({
  testCase: runtimePrerequisiteTestCase,
  targetRuntimeFamily: 'codex',
  error: { name: 'Error', code: '', message: '没有匹配协议的 LLM connection' },
  before: runtimePrerequisiteState,
  after: structuredClone(runtimePrerequisiteState),
});
assert.equal(runtimePrerequisiteBlocker.valid, true, '精确 Codex connection 前置缺失且零状态变更时应形成可信 blocker');
assert.equal(runtimePrerequisiteBlocker.normalized_error_code, 'runtime_connection_protocol_unavailable');
assert.deepEqual(runtimePrerequisiteBlocker.not_applicable_roles, runtimePrerequisiteRoles);
assert.equal(runtimePrerequisiteBlocker.mutation_guard.no_user_action, true, '全局 send count 可非零，但当前空任务前后必须稳定且未发送');
assert.equal(runtimePrerequisiteBlocker.mutation_guard.expert_absent, true, 'runtime 前置阻塞前后不得残留或选择专家');
const pinnedRuntimePrerequisiteBlocker = coreBetaRuntimeFamilyPrerequisiteBlocker({
  testCase: runtimePrerequisiteTestCase,
  targetRuntimeFamily: 'codex',
  error: {
    name: 'Error',
    code: 'model_runtime_family_pinned',
    message: '已固定本会话的模型，不能切换执行方式',
  },
  before: runtimePrerequisiteState,
  after: structuredClone(runtimePrerequisiteState),
});
assert.equal(
  pinnedRuntimePrerequisiteBlocker.valid,
  true,
  '会话已固定当前模型且公开目录无 Codex connection 时应形成可信 blocker',
);
assert.equal(
  pinnedRuntimePrerequisiteBlocker.normalized_error_code,
  'runtime_connection_protocol_unavailable',
  'model_runtime_family_pinned 必须归一化为 runtime connection 前置不可用',
);
assert.equal(
  coreBetaRuntimeFamilyPrerequisiteBlocker({
    testCase: runtimePrerequisiteTestCase,
    targetRuntimeFamily: 'codex',
    error: { message: 'setRuntimeFamily IPC timeout' },
    before: runtimePrerequisiteState,
    after: structuredClone(runtimePrerequisiteState),
  }).applicable,
  false,
  '未知 runtime 切换错误必须保留为 automation_error',
);
const mutatedRuntimePrerequisiteState = structuredClone(runtimePrerequisiteState);
mutatedRuntimePrerequisiteState.task.id = 'unexpected-task';
mutatedRuntimePrerequisiteState.task.message_count = 1;
assert.equal(
  coreBetaRuntimeFamilyPrerequisiteBlocker({
    testCase: runtimePrerequisiteTestCase,
    targetRuntimeFamily: 'codex',
    error: { message: '没有匹配协议的 LLM connection' },
    before: runtimePrerequisiteState,
    after: mutatedRuntimePrerequisiteState,
  }).applicable,
  false,
  'runtime 切换失败后若已产生任务或消息，禁止降级为前置 blocked',
);
const expertMutatedRuntimePrerequisiteState = structuredClone(runtimePrerequisiteState);
expertMutatedRuntimePrerequisiteState.expert = { expertId: 'qwork.builtin.expert-authoring' };
assert.equal(
  coreBetaRuntimeFamilyPrerequisiteBlocker({
    testCase: runtimePrerequisiteTestCase,
    targetRuntimeFamily: 'codex',
    error: { message: '没有匹配协议的 LLM connection' },
    before: runtimePrerequisiteState,
    after: expertMutatedRuntimePrerequisiteState,
  }).applicable,
  false,
  'runtime 切换失败后若专家状态变化，禁止降级为前置 blocked',
);
const runtimePrerequisiteEvidenceDir = fs.mkdtempSync(path.join(os.tmpdir(), 'qbot-core-beta-runtime-prerequisite-'));
try {
  const blockerFile = path.join(runtimePrerequisiteEvidenceDir, 'runtime-family-prerequisite.json');
  writeJsonFile(blockerFile, runtimePrerequisiteBlocker);
  const artifacts = {
    connection_view_snapshot: blockerFile,
    core_beta_not_applicable_roles: runtimePrerequisiteRoles.map((role) => ({ role, blocker_path: blockerFile })),
  };
  const manifest = buildCoreEvidenceManifest({
    testCase: runtimePrerequisiteTestCase,
    caseDir: runtimePrerequisiteEvidenceDir,
    artifacts,
  });
  assert.equal(manifest.complete, true, '可信 runtime prerequisite 必须生成完整 manifest');
  assert.deepEqual(manifest.missing_roles, []);
  assert.deepEqual(manifest.not_applicable_roles.map((item) => item.role), runtimePrerequisiteRoles);

  writeJsonFile(blockerFile, pinnedRuntimePrerequisiteBlocker);
  const pinnedManifest = buildCoreEvidenceManifest({
    testCase: runtimePrerequisiteTestCase,
    caseDir: runtimePrerequisiteEvidenceDir,
    artifacts,
  });
  assert.equal(
    pinnedManifest.complete,
    true,
    'model_runtime_family_pinned 前置阻塞也必须生成完整 manifest',
  );
  assert.deepEqual(pinnedManifest.missing_roles, []);
  assert.deepEqual(pinnedManifest.not_applicable_roles.map((item) => item.role), runtimePrerequisiteRoles);

  writeJsonFile(blockerFile, {
    ...runtimePrerequisiteBlocker,
    mutation_guard: { ...runtimePrerequisiteBlocker.mutation_guard, valid: false },
  });
  const tampered = buildCoreEvidenceManifest({
    testCase: runtimePrerequisiteTestCase,
    caseDir: runtimePrerequisiteEvidenceDir,
    artifacts,
  });
  assert.deepEqual(tampered.missing_roles, runtimePrerequisiteRoles, '零状态变更校验被篡改后，N/A 角色必须重新变为缺失');
} finally {
  fs.rmSync(runtimePrerequisiteEvidenceDir, { recursive: true, force: true });
}
assert.match(
  runner,
  /const runtimeSwitch = await page\.evaluate[\s\S]*if \(!runtimeSwitch\.ok\)[\s\S]*applyCoreBetaRuntimePrerequisiteBlocker[\s\S]*return;[\s\S]*await page\.evaluate\(async \(\) => \{[\s\S]*setExpert\('qwork\.builtin\.expert-authoring'\)/,
  'Expert Builder 必须先确认 runtime 切换成功；可信前置阻塞后不得调用 setExpert',
);
assert.match(
  automationFramework,
  /BETA-EXPERT-003[\s\S]*qbot-core-beta-runtime-prerequisite\/v1[\s\S]*未知错误[\s\S]*automation_error/,
  '框架合同必须固定 runtime prerequisite 的 blocked 与 automation_error 边界',
);
assert.match(
  runner,
  /installedTargets[\s\S]*cancelReceipt[\s\S]*cleanupValid[\s\S]*applyCoreBetaSkillPrerequisiteBlocker/,
  'BETA-SKILL-012 必须清理本轮真实成功安装的资源，再传播上游短缺阻塞',
);
const cleanupAttemptedIdentities = prerequisiteAttempts.slice(0, 5).map((item) => item.qualified_identity);
const cleanupReceipts = cleanupAttemptedIdentities.map((qualifiedIdentity) => ({
  qualified_identity: qualifiedIdentity,
  request_name: qualifiedIdentity.split('/')[1],
  result: { ok: true },
}));
assert.equal(
  coreBetaSkillUninstallRequestName({ name: 'doc-coauthoring', slug: 'ignored-slug' }),
  'doc-coauthoring',
  'Skill 卸载必须使用产品 UI 同款字符串 name 请求，不能把 catalog 对象传给 preload',
);
assert.throws(
  () => coreBetaSkillUninstallRequestName({}),
  /缺少产品 API 要求的字符串 name/,
  '缺少字符串卸载目标时必须 fail-closed',
);
assert.equal(
  coreBetaRunOwnedSkillCleanupVerdict({
    attemptedIdentities: cleanupAttemptedIdentities,
    receipts: cleanupReceipts,
    remainingIdentities: [cleanupAttemptedIdentities[0]],
    untouchedBefore: ['global/user-owned/1.0.0'],
    untouchedAfter: ['global/user-owned/1.0.0'],
    absenceReadback: { valid: false, stable_required: 2, stable_absent_observations: 0 },
  }).valid,
  false,
  'uninstall API 返回 ok 但目标仍在 catalog.installed 时不得把清理判为 passed',
);
assert.equal(
  coreBetaRunOwnedSkillCleanupVerdict({
    attemptedIdentities: cleanupAttemptedIdentities,
    receipts: cleanupReceipts,
    remainingIdentities: [],
    untouchedBefore: ['global/user-owned/1.0.0'],
    untouchedAfter: ['global/user-owned/1.0.0'],
    absenceReadback: { valid: true, stable_required: 2, stable_absent_observations: 2 },
  }).valid,
  true,
  '只有目标稳定缺席、卸载收据成功且基线技能不变时清理才能通过',
);
const cleanupTimeoutReceipts = cleanupReceipts.map((item, index) => index === cleanupReceipts.length - 1
  ? {
      ...item,
      result: {
        ok: false,
        error: "page.evaluate: Error invoking remote method 'lingxi-credential:control-plane-request': control-plane request timed out",
      },
    }
  : item);
const reconciledCleanupTimeout = coreBetaRunOwnedSkillCleanupVerdict({
  attemptedIdentities: cleanupAttemptedIdentities,
  receipts: cleanupTimeoutReceipts,
  remainingIdentities: [],
  untouchedBefore: ['global/user-owned/1.0.0'],
  untouchedAfter: ['global/user-owned/1.0.0'],
  absenceReadback: { valid: true, stable_required: 2, stable_absent_observations: 2 },
});
assert.equal(
  reconciledCleanupTimeout.valid,
  true,
  '卸载请求 control-plane 超时但精确目标连续两次权威缺席时必须按终态对账成功',
);
assert.equal(reconciledCleanupTimeout.reconciled_timeout_count, 1);
assert.equal(reconciledCleanupTimeout.receipt_outcomes.at(-1).terminal_reconciled, true);
assert.equal(
  coreBetaRunOwnedSkillCleanupVerdict({
    attemptedIdentities: cleanupAttemptedIdentities,
    receipts: cleanupTimeoutReceipts,
    remainingIdentities: [cleanupAttemptedIdentities.at(-1)],
    untouchedBefore: ['global/user-owned/1.0.0'],
    untouchedAfter: ['global/user-owned/1.0.0'],
    absenceReadback: { valid: false, stable_required: 2, stable_absent_observations: 0 },
  }).valid,
  false,
  '卸载请求超时且目标仍在或缺少稳定终态时必须继续 fail-closed',
);
const cleanupPermissionErrorReceipts = cleanupReceipts.map((item, index) => index === cleanupReceipts.length - 1
  ? { ...item, result: { ok: false, error: 'permission denied' } }
  : item);
assert.equal(
  coreBetaRunOwnedSkillCleanupVerdict({
    attemptedIdentities: cleanupAttemptedIdentities,
    receipts: cleanupPermissionErrorReceipts,
    remainingIdentities: [],
    untouchedBefore: ['global/user-owned/1.0.0'],
    untouchedAfter: ['global/user-owned/1.0.0'],
    absenceReadback: { valid: true, stable_required: 2, stable_absent_observations: 2 },
  }).valid,
  false,
  '非超时卸载错误不得仅凭目标缺席被对账成成功',
);
const duplicateCleanupRequestReceipts = cleanupTimeoutReceipts.map((item, index) => index === 0
  ? { ...item, request_name: cleanupTimeoutReceipts[1].request_name }
  : item);
assert.equal(
  coreBetaRunOwnedSkillCleanupVerdict({
    attemptedIdentities: cleanupAttemptedIdentities,
    receipts: duplicateCleanupRequestReceipts,
    remainingIdentities: [],
    untouchedBefore: ['global/user-owned/1.0.0'],
    untouchedAfter: ['global/user-owned/1.0.0'],
    absenceReadback: { valid: true, stable_required: 2, stable_absent_observations: 2 },
  }).valid,
  false,
  '重复卸载 request name 破坏一一对应账本时不得对账放行',
);
{
  const installed = new Set(['first-skill', 'retry-skill']);
  const uninstallCalls = [];
  const fakePage = {
    async evaluate(_fn, name) {
      if (name !== undefined) {
        uninstallCalls.push(name);
        if (name === 'first-skill' || uninstallCalls.filter((item) => item === name).length >= 2) {
          installed.delete(name);
        }
        return { ok: true, httpStatus: 200 };
      }
      return {
        installed: [...installed].map((slug) => ({ namespace: 'global', slug, name: slug, version: '1.0.0' })),
        market: [],
        history: [],
      };
    },
    async waitForTimeout() {},
  };
  const retryCleanup = await uninstallCoreBetaRunOwnedSkillTargets(fakePage, [
    { namespace: 'global', slug: 'first-skill', name: 'first-skill', version: '1.0.0' },
    { namespace: 'global', slug: 'retry-skill', name: 'retry-skill', version: '1.0.0' },
  ], {
    maxAttempts: 3,
    timeoutMs: 1,
    stableRequired: 2,
    pollMs: 0,
  });
  assert.deepEqual(
    uninstallCalls,
    ['first-skill', 'retry-skill', 'retry-skill'],
    '完整轮询后只能重试权威目录中仍存在的精确 run-owned identity',
  );
  assert.equal(retryCleanup.attempt_count, 2);
  assert.deepEqual(retryCleanup.waves[1].target_identities, ['global/retry-skill/1.0.0']);
  assert.equal(retryCleanup.receipts[0].attempts.length, 1);
  assert.equal(retryCleanup.receipts[1].attempts.length, 2);
  assert.equal(retryCleanup.absence_readback.valid, true);
  assert.equal(
    coreBetaRunOwnedSkillCleanupVerdict({
      attemptedIdentities: retryCleanup.receipts.map((item) => item.qualified_identity),
      receipts: retryCleanup.receipts,
      remainingIdentities: retryCleanup.absence_readback.remaining_identities,
      untouchedBefore: ['global/user-owned/1.0.0'],
      untouchedAfter: ['global/user-owned/1.0.0'],
      absenceReadback: retryCleanup.absence_readback,
    }).valid,
    true,
    '幂等重试后仍必须通过同一个稳定缺席与用户基线保护 verdict',
  );
}
assert.match(
  runner,
  /waitForCoreBetaSkillIdentitiesAbsent[\s\S]*stableAbsentObservations >= stableRequired/,
  'Skill 清理必须有界轮询并要求目标连续稳定缺席',
);
assert.match(
  runner,
  /testCase\.id === 'BETA-SKILL-001'[\s\S]*uninstallCoreBetaRunOwnedSkillTargets[\s\S]*remaining[\s\S]*coreBetaRunOwnedSkillCleanupVerdict/,
  'BETA-SKILL-001 必须把 remaining=0 稳定读回纳入 pass 条件',
);
assert.match(
  runner,
  /uninstallCoreBetaRunOwnedSkillTargets[\s\S]*uninstallSkill\(name\)[\s\S]*\.catch\([\s\S]*waitForCoreBetaSkillIdentitiesAbsent/,
  'BETA-SKILL-001 遇到卸载传输超时时必须先完成权威终态读回，不能在回执处提前抛错',
);
assert.doesNotMatch(
  runner,
  /window\.agent\.uninstallSkill\((?:target|item|installed)\)/,
  'Skill 生命周期清理不得把 catalog 对象传给只接受字符串 name 的产品卸载 API',
);
assert.match(
  runner,
  /coreBetaSkillUninstallRequestName\(skill\)[\s\S]*window\.agent\.uninstallSkill\(name\)/,
  'Skill 生命周期清理必须保存并传递产品 API 要求的字符串卸载名',
);
assert.match(
  automationFramework,
  /仍存在的同一批 run-owned identity[\s\S]*最多 3 轮[\s\S]*禁止扩展到基线或其他 Skill/,
  '框架合同必须固定清理重试的目标边界、次数与逐轮证据要求',
);
const runOwnedSkillCleanupRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'qbot-core-beta-run-owned-cleanup-'));
try {
  const sourceOut = path.join(runOwnedSkillCleanupRoot, 'frozen-source');
  const currentOut = path.join(runOwnedSkillCleanupRoot, 'cleanup-run');
  const compoundSourceOut = path.join(runOwnedSkillCleanupRoot, 'frozen-compound-source');
  const compoundCurrentOut = path.join(runOwnedSkillCleanupRoot, 'cleanup-compound-run');
  const syntheticCompoundCurrentOut = path.join(runOwnedSkillCleanupRoot, 'cleanup-synthetic-compound-run');
  const driftOut = path.join(runOwnedSkillCleanupRoot, 'cleanup-drift');
  const migrationOut = path.join(runOwnedSkillCleanupRoot, 'cleanup-release-migration');
  const wrongCaseOut = path.join(runOwnedSkillCleanupRoot, 'cleanup-wrong-case');
  const casebook = path.join(runOwnedSkillCleanupRoot, 'casebook.xlsx');
  for (const directory of [
    sourceOut,
    currentOut,
    compoundSourceOut,
    compoundCurrentOut,
    syntheticCompoundCurrentOut,
    driftOut,
    migrationOut,
    wrongCaseOut,
  ]) {
    fs.mkdirSync(directory, { recursive: true });
  }
  fs.writeFileSync(casebook, 'immutable-casebook');
  const casebookSha256 = createHash('sha256').update(fs.readFileSync(casebook)).digest('hex');
  const releaseMetadata = {
    host: { product: '360Teams', version: '5.2.38', build: '2119080433', app_path: '/Applications/360Teams.app' },
    qwork: { version: '0.0.29', url: 'file:///Users/qa/.deepbank-uat/ui/0.0.29/index.html' },
    control_plane: { origin: 'https://deepbank-control-uat.example.test' },
    artifacts: {
      host_info_plist_sha256: 'a'.repeat(64),
      host_main_binary_sha256: 'b'.repeat(64),
      qwork_index_sha256: 'c'.repeat(64),
      qwork_install_metadata_sha256: 'd'.repeat(64),
      casebook_sha256: casebookSha256,
    },
    release_inputs: {
      backend_version: 'uat-backend',
      prompt_policy_version: 'prompt-policy',
      feature_flags_hash: 'e'.repeat(64),
      qwork_ui_git_commit: '',
      qwork_build_id: '0.0.29',
      qwork_release_manifest_sha256: '',
    },
    model_tier: 'M3',
    profile: {
      mode: 'live',
      alias: '/Users/qa/managed-live-profile',
    },
  };
  const migratedReleaseMetadata = {
    ...releaseMetadata,
    host: { ...releaseMetadata.host, version: '5.2.42', build: '2119080753' },
    qwork: {
      version: '0.0.30-rc.10',
      url: 'file:///Users/qa/.deepbank-uat/ui/0.0.30-rc.10/index.html',
    },
    artifacts: {
      ...releaseMetadata.artifacts,
      host_info_plist_sha256: '1'.repeat(64),
      host_main_binary_sha256: '2'.repeat(64),
      qwork_index_sha256: '3'.repeat(64),
      qwork_install_metadata_sha256: '4'.repeat(64),
    },
    release_inputs: {
      ...releaseMetadata.release_inputs,
      prompt_policy_version: 'qwork-runtime-0.0.30-rc.10',
      qwork_build_id: '0.0.30-rc.10',
    },
  };
  writeJsonFile(path.join(sourceOut, 'run-metadata.json'), releaseMetadata);
  writeJsonFile(path.join(currentOut, 'run-metadata.json'), releaseMetadata);
  writeJsonFile(path.join(compoundSourceOut, 'run-metadata.json'), releaseMetadata);
  writeJsonFile(path.join(compoundCurrentOut, 'run-metadata.json'), releaseMetadata);
  writeJsonFile(path.join(syntheticCompoundCurrentOut, 'run-metadata.json'), releaseMetadata);
  writeJsonFile(path.join(driftOut, 'run-metadata.json'), {
    ...releaseMetadata,
    qwork: { ...releaseMetadata.qwork, version: '0.0.30' },
  });
  writeJsonFile(path.join(migrationOut, 'run-metadata.json'), migratedReleaseMetadata);
  writeJsonFile(path.join(wrongCaseOut, 'run-metadata.json'), releaseMetadata);
  writeJsonFile(path.join(sourceOut, 'core-beta-suite-ledger.json'), {
    schema_version: 1,
    skills: {
      ...prerequisiteLedger.skills,
      baseline_installed: ['global/user-owned/9.9.9'],
    },
    experts: {},
    mcps: {},
  });
  fs.copyFileSync(
    path.join(sourceOut, 'core-beta-suite-ledger.json'),
    path.join(compoundSourceOut, 'core-beta-suite-ledger.json'),
  );
  const sourceResults = [];
  for (const caseId of ['BETA-SKILL-002', 'BETA-SKILL-003', 'BETA-SKILL-004']) {
    const caseDir = path.join(sourceOut, 'cases', caseId);
    fs.mkdirSync(caseDir, { recursive: true });
    writeJsonFile(path.join(caseDir, 'case-result.json'), { id: caseId, status: caseId === 'BETA-SKILL-002' ? 'passed' : 'failed' });
    writeJsonFile(path.join(caseDir, 'evidence-manifest.json'), {
      case_id: caseId,
      complete: true,
      missing_roles: [],
      invalid_roles: [],
      evidence: [],
    });
    sourceResults.push({
      id: caseId,
      status: caseId === 'BETA-SKILL-002' ? 'passed' : 'failed',
      result_category: caseId === 'BETA-SKILL-002' ? 'passed' : 'bug',
      execution_provenance: 'executed',
      synthetic: false,
      case_dir: caseDir,
    });
  }
  writeJsonFile(path.join(sourceOut, 'automation-progress.json'), {
    completed: sourceResults.length,
    total: 55,
    results: sourceResults,
  });
  const cleanupCase = [{ id: 'BETA-SKILL-001', case_type: 'skill_lifecycle' }];
  const cleanupSelection = selectCoreBetaRunOwnedSkillCleanupCases([{
    id: 'QW-SKILL-001',
    case_type: 'compound',
    compound_subcases: [{
      ...cleanupCase[0],
      contract_version: 'qbot-core-beta/v2',
    }],
  }], 'BETA-SKILL-001');
  assert.deepEqual(cleanupSelection.cases.map((item) => item.id), ['BETA-SKILL-001']);
  assert.deepEqual(cleanupSelection.result_path_ids, ['QW-SKILL-001', 'BETA-SKILL-001']);
  assert.throws(
    () => selectCoreBetaRunOwnedSkillCleanupCases([], 'QW-SKILL-001'),
    /只允许请求 BETA-SKILL-001/,
    'cleanup selector 不得扩大为整个 Daily83 compound 父 Case',
  );
  const seeded = seedCoreBetaRunOwnedSkillCleanupLedger({
    sourceOut,
    currentOut,
    casebook,
    selectedCases: cleanupCase,
  });
  assert.equal(seeded.valid, true);
  assert.equal(seeded.selected_identities.length, 10);
  assert.deepEqual(seeded.baseline_overlap, []);
  assert.equal(seeded.source_results.length, 3);
  assert.deepEqual(seeded.source_results[0].result_path_ids, ['BETA-SKILL-002']);
  assert.equal(
    fs.readFileSync(path.join(currentOut, 'core-beta-suite-ledger.json'), 'utf8'),
    fs.readFileSync(path.join(sourceOut, 'core-beta-suite-ledger.json'), 'utf8'),
    '清理批次必须原样导入冻结 suite ledger，不能改写目标 identity',
  );
  const compoundSourceResults = sourceResults.map((result) => {
    const sourceCaseDir = result.case_dir;
    const compoundCaseDir = path.join(
      compoundSourceOut,
      'cases',
      'QW-SKILL-001',
      'subcases',
      result.id,
    );
    fs.mkdirSync(compoundCaseDir, { recursive: true });
    fs.copyFileSync(
      path.join(sourceCaseDir, 'case-result.json'),
      path.join(compoundCaseDir, 'case-result.json'),
    );
    fs.copyFileSync(
      path.join(sourceCaseDir, 'evidence-manifest.json'),
      path.join(compoundCaseDir, 'evidence-manifest.json'),
    );
    return { ...result, case_dir: compoundCaseDir };
  });
  writeJsonFile(path.join(compoundSourceOut, 'automation-progress.json'), {
    completed: 1,
    total: 83,
    results: [{
      id: 'QW-SKILL-001',
      status: 'failed',
      result_category: 'bug',
      execution_provenance: 'executed',
      synthetic: false,
      subcase_results: compoundSourceResults,
    }],
  });
  const compoundSeeded = seedCoreBetaRunOwnedSkillCleanupLedger({
    sourceOut: compoundSourceOut,
    currentOut: compoundCurrentOut,
    casebook,
    selectedCases: cleanupCase,
  });
  assert.equal(compoundSeeded.valid, true);
  assert.deepEqual(
    compoundSeeded.source_results.map((item) => item.result_path_ids),
    [
      ['QW-SKILL-001', 'BETA-SKILL-002'],
      ['QW-SKILL-001', 'BETA-SKILL-003'],
      ['QW-SKILL-001', 'BETA-SKILL-004'],
    ],
    'Daily83 compound 父结果中的真实叶子必须可作为 run-owned Skill 清理源',
  );
  writeJsonFile(path.join(compoundSourceOut, 'automation-progress.json'), {
    completed: 0,
    total: 83,
    results: [{
      id: 'QW-SKILL-001',
      status: 'blocked',
      result_category: 'automation_error',
      execution_provenance: 'executed',
      synthetic: true,
      subcase_results: compoundSourceResults,
    }],
  });
  assert.throws(
    () => seedCoreBetaRunOwnedSkillCleanupLedger({
      sourceOut: compoundSourceOut,
      currentOut: syntheticCompoundCurrentOut,
      casebook,
      selectedCases: cleanupCase,
    }),
    /缺少真实 executed 源结果/,
    'synthetic compound 父结果不得授权其嵌套叶子的真实产品清理',
  );
  assert.throws(
    () => seedCoreBetaRunOwnedSkillCleanupLedger({
      sourceOut,
      currentOut: driftOut,
      casebook,
      selectedCases: cleanupCase,
    }),
    /发布身份不一致/,
    '清理源与当前宿主发布身份漂移时必须 fail-closed',
  );
  assert.throws(
    () => seedCoreBetaRunOwnedSkillCleanupLedger({
      sourceOut,
      currentOut: migrationOut,
      casebook,
      selectedCases: cleanupCase,
    }),
    /发布身份不一致/,
    '跨发布清理即使满足安全条件，未显式授权时仍必须 fail-closed',
  );
  const migrationVerdict = coreBetaCleanupReleaseMigrationVerdict(
    releaseMetadata,
    migratedReleaseMetadata,
  );
  assert.equal(migrationVerdict.valid, true);
  assert.equal(migrationVerdict.checks.identity_changed, true);
  assert.ok(migrationVerdict.changed_fields.some(({ field }) => field === 'qwork.version'));
  const migratedSeed = seedCoreBetaRunOwnedSkillCleanupLedger({
    sourceOut,
    currentOut: migrationOut,
    casebook,
    selectedCases: cleanupCase,
    allowReleaseMigration: true,
  });
  assert.equal(migratedSeed.valid, true);
  assert.equal(migratedSeed.release_identity_equal, false);
  assert.equal(migratedSeed.release_migration.valid, true);
  assert.equal(migratedSeed.release_identity_sha256, '');
  assert.equal(
    coreBetaCleanupReleaseMigrationVerdict(releaseMetadata, {
      ...migratedReleaseMetadata,
      control_plane: { origin: 'https://other-control-plane.example.test' },
    }).valid,
    false,
    '跨发布清理不得跨 control plane',
  );
  assert.equal(
    coreBetaCleanupReleaseMigrationVerdict(releaseMetadata, {
      ...migratedReleaseMetadata,
      profile: { ...migratedReleaseMetadata.profile, alias: '/Users/qa/other-live-profile' },
    }).valid,
    false,
    '跨发布清理不得跨 live profile',
  );
  assert.equal(
    coreBetaCleanupReleaseMigrationVerdict(releaseMetadata, {
      ...migratedReleaseMetadata,
      qwork: {
        version: '0.0.30-rc.10',
        url: 'file:///Users/qa/other-runtime/ui/0.0.30-rc.10/index.html',
      },
    }).valid,
    false,
    '跨发布清理不得跨 QWork release root',
  );
  assert.throws(
    () => seedCoreBetaRunOwnedSkillCleanupLedger({
      sourceOut,
      currentOut: wrongCaseOut,
      casebook,
      selectedCases: [{ id: 'BETA-SKILL-012', case_type: 'skill_lifecycle' }],
    }),
    /只允许单独执行 BETA-SKILL-001/,
    '冻结账本导入不得用于普通批次或其他 Case',
  );
} finally {
  fs.rmSync(runOwnedSkillCleanupRoot, { recursive: true, force: true });
}
assert.match(
  runner,
  /options\['core-beta-cleanup-from'\][\s\S]*seedCoreBetaRunOwnedSkillCleanupLedger/,
  'Core Beta v2 必须在连接产品前验证并导入冻结的 run-owned Skill 清理账本',
);
assert.match(
  legacyRunner,
  /options\['core-beta-cleanup-from'\][\s\S]*return runCoreBetaV2CasebookCommand/,
  '共享 runner 入口必须把 compound 叶子清理直接路由到 Core Beta v2',
);
assert.match(
  runner,
  /casebook-cleanup-full-cases\.json[\s\S]*selectCoreBetaRunOwnedSkillCleanupCases[\s\S]*cleanup_selection/,
  'cleanup-only 选择必须从完整 Casebook 唯一解析叶子并记录父子路径',
);
assert.match(
  automationFramework,
  /--core-beta-cleanup-from <frozen-source-out>/,
  '框架合同必须记录 framework issue 中断后的受管 Skill 清理路径',
);
assert.match(
  automationFramework,
  /--core-beta-cleanup-release-migration true/,
  '框架合同必须记录显式跨发布清理安全门禁',
);
assert.match(
  runner,
  /composer-skills-menu[\s\S]*composer-connectors-menu[\s\S]*composer-plus-menu[\s\S]*composer-input[\s\S]*ctool-btn-ava[\s\S]*skillBridgeCleared[\s\S]*connectorBridgeCleared[\s\S]*expertBridgeCleared[\s\S]*visible_ui: \{/,
  '清理读回必须实际采集技能/连接器禁用标签、chip 残留与专家头像，不能只测试未接入的判定函数',
);
assert.match(
  runner,
  /capabilitiesReadbackAttempts[\s\S]*attempt <= 3[\s\S]*coreBetaCleanupCapabilitiesNeedsRetry\(snapshot\.capabilities_after\)[\s\S]*window\.agent\.capabilities\(\)[\s\S]*capabilities_readback_attempts/,
  '清理读回在 capabilities 传输超时后必须执行最多三次有界只读尝试并保存尝试账本',
);
assert.match(
  runner,
  /pre_cleanup_selection_readback[\s\S]*core_beta_composer_control_reset\?\.isolation_readback/,
  '清理读回必须把发送前权威空态与清理终态统一 Composer 可见空态绑定，不能只依赖超时的 capabilities IPC',
);
assert.match(
  runner,
  /callBounded\(window\.agent\?\.init[\s\S]*init_context: compactInitContext\(init, e2eState\)/,
  '清理读回必须有界采集并压缩 agent.init 当前 context',
);
assert.match(
  runner,
  /cleanupInitContextSourceVerdict[\s\S]*binding_matches[\s\S]*agent\.init_context_and_visible_ui/,
  'agent.init context 必须按 taskId 绑定后再与可见空态交叉验证',
);
assert.match(runner, /pre_cleanup_and_visible_ui/, '清理交叉读回必须记录稳定的证据来源名称');
const cleanupImplementation = runner.slice(
  runner.indexOf('async function writeCleanupReadback'),
  runner.indexOf('export function coreBetaV2MaintenanceConfirmationContract'),
);
assert.equal(
  (cleanupImplementation.match(/await invoke\('setSkillsDisabled'\)/g) || []).length,
  1,
  '清理读回恢复导航不得重复执行技能清理动作',
);
assert.equal(
  (cleanupImplementation.match(/await invoke\('setConnectorsDisabled'\)/g) || []).length,
  1,
  '清理读回恢复导航不得重复执行连接器清理动作',
);
assert.equal(
  (cleanupImplementation.match(/await invoke\('setExpert', null\)/g) || []).length,
  1,
  '清理读回恢复导航不得重复执行专家清理动作',
);
assert.match(
  cleanupImplementation,
  /coreBetaCleanupReadbackNeedsComposerRecovery\(snapshot\)[\s\S]*openNewTask\(page, state\)[\s\S]*captureCleanupSelectionReadbacks[\s\S]*readCapabilities: false/,
  '市场页无 composer 且 capabilities 重试耗尽后，必须通过框架新任务入口只读采集输入区终态',
);
assert.match(
  projectMemory,
  /Monitor Self-Healing Rule[\s\S]*confirmed `framework_issue` or `testcase_issue`[\s\S]*new immutable output directory[\s\S]*inherited=0[\s\S]*synthetic=0/,
  '项目记忆必须要求监控发现框架或 Case 问题后自主修复，并以新不可变批次续测',
);
assert.match(
  projectMemory,
  /Product defects are not framework repairs[\s\S]*do not modify `\/Users\/qifu\/Documents\/deepbankV2`/,
  '监控自愈不得越界修改 deepbankV2 或掩盖产品缺陷',
);
assert.match(
  automationFramework,
  /监控发现 Issue 后的自主修复闭环[\s\S]*停止唯一 runner[\s\S]*main == origin\/main[\s\S]*READY_SCOPED[\s\S]*后续通过不得抹去原始 issue/,
  '框架手册必须固化冻结、修复、校验、推送和新批次续测闭环',
);
assert.match(
  automationFramework,
  /Core Beta v2 的 Case 间执行永久强制串行[\s\S]*requested\/effective[\s\S]*core-beta-v2-forced-serial[\s\S]*不得进入多 CDP 调度或外层 pipeline/,
  '框架手册必须要求 Core Beta v2 忽略历史并发请求并以可审计的有效值 1 串行执行',
);
assert.match(
  automationFramework,
  /stage 集合：`skill_installation`[\s\S]*明确安装失败\/拒绝\/禁止\/不可用\/授权失败终态[\s\S]*仅 pending[\s\S]*send count 不变[\s\S]*capability execution 角色标为 N\/A/,
  '框架手册必须固定 Skill 安装拒绝与零发送 N/A 的证据边界',
);
assert.match(
  automationFramework,
  /停止旧 runner[\s\S]*不是任务终态[\s\S]*提交推送[\s\S]*新 pretest[\s\S]*完整重跑[\s\S]*禁止以“批次已停止”或“后续 Case 未执行”作为最终交付/,
  '框架手册必须禁止修复流程停在中断状态而不启动新完整批次',
);
assert.match(
  automationFramework,
  /QWork renderer 实际读取[\s\S]*--control-plane-url[\s\S]*禁止[\s\S]*静默改写[\s\S]*受管 session/,
  '正式 Teams Core Beta 必须交叉核对 renderer control plane 并禁止覆盖冻结 session',
);
assert.match(
  coreBetaOperatingGuide,
  /QBot核心生命线与新增MR生产灰度全量回归Casebook_16-12-70-160条_2026-09-05-r14\.xlsx[\s\S]*--sheet 核心生命线门禁[\s\S]*--expected-count 16[\s\S]*只接受 `READY`[\s\S]*12\/70\/160/,
  '当前操作指南必须先为16条核心生命线取得READY，再按阶段分别预检12/70/160',
);
assert.match(
  automationFramework,
  /全量功能回归Case[\s\S]*directly_runnable=70\/160[\s\S]*前 70 条[\s\S]*至少 1 轮完整 160 条[\s\S]*可计入[\s\S]*5 轮门禁中的 1 轮/,
  '框架合同必须固定70+160双层结构、全量可执行率和轮次复用边界',
);
assert.equal(
  (coreBetaOperatingGuide.match(/--(?:expected-)?control-plane-(?:origin|url) "<exact-uat-origin>"/g) || []).length,
  2,
  '70 条指南必须把 pretest 冻结的精确 control plane 原样传给正式 runner',
);
assert.match(
  coreBetaOperatingGuide,
  /G3\/G4[\s\S]*--native-ime-command[\s\S]*无副作用 probe[\s\S]*G3\/G4 runner[\s\S]*READY 相同/,
  'G3/G4 指南必须把通过 probe 的同一 native IME command 传给 runner',
);
assert.match(
  automationFramework,
  /激活受管 `360Teams`[\s\S]*frontmost[\s\S]*bringToFront[\s\S]*真实 Composer 点击[\s\S]*document\.hasFocus\(\)[\s\S]*零文本[\s\S]*framework issue[\s\S]*N\/A 负向证据/,
  '框架合同必须覆盖 replacement WebView 的原生IME前台焦点、no-op fail-fast和产品失败继续策略',
);
assert.match(
  coreBetaOperatingGuide,
  /激活受管 `360Teams`[\s\S]*frontmost[\s\S]*bringToFront[\s\S]*前台焦点[\s\S]*零文本、零 composition 事件[\s\S]*framework issue[\s\S]*产品 Bug/,
  '当前运行指南必须明确原生IME框架失败与产品失败边界',
);
{
  const imeStart = runner.indexOf('async function executeCoreBetaImeCase');
  const imeEnd = runner.indexOf('function sameStringMultiset', imeStart);
  assert.ok(imeStart >= 0 && imeEnd > imeStart, '必须保留 Core Beta native IME executor');
  const imeBlock = runner.slice(imeStart, imeEnd);
  assert.match(
    imeBlock,
    /activateCoreBetaNativeImeHost\(options\['renderer-control-adapter'\]\)[\s\S]*prepareCoreBetaNativeImeFocus\(page, input\)[\s\S]*spawnSync\('\/bin\/zsh'[\s\S]*traceData\.adapter_noop[\s\S]*refusing to wait for or click Send/,
    'Teams 原生IME必须先激活并验证宿主，再恢复 Composer 焦点；命令no-op时在发送前立即fail-closed',
  );
  assert.match(
    imeBlock,
    /coreBetaPreSendImeFailureEvidence[\s\S]*core_beta_not_applicable_roles[\s\S]*return;[\s\S]*await send\(page, state, '发送IME组合输入'\)/,
    '真实composition产品失败必须形成零发送N/A证据并在错误文本发送前返回',
  );
}
assert.match(
  coreBetaOperatingGuide,
  /BETA-REC-001[\s\S]*BETA-REC-002[\s\S]*BETA-REC-004[\s\S]*BETA-TASK-003[\s\S]*BETA-EXPERT-016[\s\S]*不得进入70条门禁或160条全量回归/,
  '当前操作指南必须明确排除低频恢复、runtime故障和网络中断Case',
);
assert.doesNotMatch(
  coreBetaOperatingGuide,
  /Teams lane 的 `BETA-REC-001\/002\/004`/,
  '操作指南不得继续把已删除的恢复Case声明为正式门禁fixture',
);
assert.doesNotMatch(
  coreBetaOperatingGuide,
  /## 5\. 当前 55 条 scoped 预检/,
  '旧 55 条 scoped 流程不得继续作为当前发布入口',
);
assert.equal(
  coreBetaV2NeedsRendererReconnect(new Error('page.reload: Target page, context or browser has been closed')),
  true,
  'Core Beta v2 必须识别 Teams WebView 刷新销毁旧 target 的重连信号',
);
assert.equal(
  coreBetaV2NeedsRendererReconnect(new Error('page.reload: net::ERR_FAILED')),
  false,
  '普通页面加载失败不能冒充 replacement renderer 重连信号',
);
assert.match(
  runner,
  /executeCoreBetaSidebarPersistenceCase[\s\S]*page\.reload[\s\S]*coreBetaV2NeedsRendererReconnect[\s\S]*reconnectCoreBetaV2Runtime[\s\S]*context\.page = page/,
  'BETA-CHAT-007 刷新销毁 Teams WebView target 后必须重连并更新共享 page',
);
assert.match(
  runner,
  /runtime_reconnects\.push\(\{[\s\S]*renderer_remount: reconnected\?\.rendererRemount \|\| null/,
  'replacement renderer 重连账本必须保存同宿主 pinned remount 结果',
);
assert.equal(
  replySendObservedRunning([{
    attempts: [{ receipt: { ok: true, snapshot: { running: true } } }],
  }]),
  true,
  '终止无回复判断必须读取确认发送后的真实运行态证据',
);
let noReplyObservation = nextTerminalNoReplyObservation({
  elapsedMs: 60_000,
  minWaitMs: 60_000,
  expectedUserVisible: true,
  observedRunningAfterSend: true,
});
assert.equal(noReplyObservation.ready, false, '单次无回复观察不得提前结束等待');
noReplyObservation = nextTerminalNoReplyObservation({
  previous: noReplyObservation.consecutive,
  elapsedMs: 61_000,
  minWaitMs: 60_000,
  expectedUserVisible: true,
  observedRunningAfterSend: true,
});
assert.equal(noReplyObservation.ready, false, '两次无回复观察不得提前结束等待');
noReplyObservation = nextTerminalNoReplyObservation({
  previous: noReplyObservation.consecutive,
  elapsedMs: 62_000,
  minWaitMs: 60_000,
  expectedUserVisible: true,
  observedRunningAfterSend: true,
});
assert.equal(noReplyObservation.ready, true, '最小等待后连续三次终止无回复应形成产品失败终态');
assert.equal(
  nextTerminalNoReplyObservation({
    previous: 2,
    elapsedMs: 62_000,
    minWaitMs: 60_000,
    generating: true,
    expectedUserVisible: true,
    observedRunningAfterSend: true,
  }).ready,
  false,
  '仍在运行的任务不得被终止无回复规则截断',
);
const streamingPrompt = '请输出 80 条上线检查清单。';
const streamingTaskId = confirmedSendReceiptTaskId([{
  prompt: streamingPrompt,
  confirmed_at: '2026-08-18T15:00:00.000Z',
  attempts: [{
    clicked: true,
    receipt: { ok: true, snapshot: { activeId: 'task-streaming-no-reply', running: true } },
  }],
}], streamingPrompt);
assert.equal(streamingTaskId, 'task-streaming-no-reply', '长文本终态必须从确认发送回执冻结 taskId');
const streamingNoReply = streamingTerminalReplyEvidence({
  snapshot: {
    activeTaskId: streamingTaskId,
    userTexts: [streamingPrompt],
    messages: [{ role: 'user', text: streamingPrompt }],
    latestAssistantText: '',
  },
  prompt: streamingPrompt,
  boundTaskId: streamingTaskId,
  everGenerating: true,
  stoppedObservations: 3,
  waitedMs: 62_000,
  minWaitMs: 60_000,
  timeoutMs: 240_000,
  stillGenerating: false,
});
assert.equal(streamingNoReply.terminal_outcome, 'no_reply');
assert.equal(streamingNoReply.incomplete, true);
assert.equal(streamingNoReply.observed_running_after_send, true);
assert.equal(streamingNoReply.running_after, false);
assert.equal(streamingNoReply.no_reply_stable_observations, 3);
assert.equal(streamingNoReply.terminal_reconciliation_performed, true);
assert.equal(streamingNoReply.terminal_reconciliation_task_bound, true);
assert.equal(streamingNoReply.terminal_reconciliation_prompt_bound, true);
assert.equal(streamingNoReply.terminal_reconciliation_reply_present, false);
assert.equal(streamingNoReply.screenshot_file_suffix, 'after-terminal-no-reply');
const streamingRecoveredReply = streamingTerminalReplyEvidence({
  snapshot: {
    activeTaskId: streamingTaskId,
    userTexts: [streamingPrompt],
    messages: [
      { role: 'user', text: streamingPrompt },
      { role: 'assistant', text: '第 1 条：检查身份。第 2 条：检查环境。' },
    ],
  },
  prompt: streamingPrompt,
  boundTaskId: streamingTaskId,
  everGenerating: true,
  stoppedObservations: 3,
  waitedMs: 62_000,
  stillGenerating: false,
});
assert.equal(streamingRecoveredReply.terminal_outcome, 'completed', '终态结构化时间线已有正文时不得误写 no_reply');
assert.match(streamingRecoveredReply.deltaText, /第 1 条/);
const streamingUnverifiedNoReply = streamingTerminalReplyEvidence({
  snapshot: {
    activeTaskId: 'different-task',
    userTexts: [streamingPrompt],
    messages: [{ role: 'user', text: streamingPrompt }],
  },
  prompt: streamingPrompt,
  boundTaskId: streamingTaskId,
  everGenerating: true,
  stoppedObservations: 3,
  waitedMs: 62_000,
  stillGenerating: false,
});
assert.equal(streamingUnverifiedNoReply.terminal_outcome, 'unverified_no_reply', 'taskId 漂移必须继续 fail-closed');
assert.match(
  runner,
  /terminal_outcome:\s*'no_reply'[\s\S]*no_reply_stable_observations[\s\S]*after-terminal-no-reply/,
  'v2 runner 必须把稳定终止无回复写成可截图、可校验且绝不误判 pass 的失败终态',
);
assert.match(
  runner,
  /terminal no-reply reconciliation snapshot[\s\S]*terminalPromptBoundReplyEvidence[\s\S]*reconciled_before_no_reply[\s\S]*terminal_outcome:\s*'no_reply'/,
  'v2 runner 写 no_reply 前必须用新快照按 taskId 和 prompt 复核可见助手回复',
);
assert.match(
  runner,
  /executeIssue793StreamingScrollFollow[\s\S]*confirmedSendReceiptTaskId[\s\S]*streamingTerminalReplyEvidence[\s\S]*issue-793-\$\{replyEvidence\.screenshot_file_suffix[\s\S]*writeReplyArtifacts/,
  '#793 专项长文本路径必须先完成 task/prompt 终态复核和截图，再材料化 reply completion',
);
assert.match(
  runner,
  /--profile'[\s\S]*profile[\s\S]*options\.sheet[\s\S]*--sheet/,
  'Core Beta v2 二次导出必须透传精确 Sheet，禁止多 Sheet Casebook 被静默合并',
);
assert.equal(coreGateIds.length, 92, '核心门禁用例簿必须保持 92 条');
assert.equal(new Set(coreGateIds).size, 92, '核心门禁用例簿 Case ID 必须唯一');
assert.equal(coreGateIds[0], 'SIT-INIT-002', '核心门禁用例簿首条必须是安装初始化入口');
assert.equal(caseRequiresModelTier({ id: 'BETA-INIT-001' }), false, '运行时检查维护 Case 不得被模型门禁挡在初始化之前');
assert.equal(caseRequiresModelTier({ id: 'BETA-INIT-004' }), false, '清空会话维护 Case 不得依赖模型连接');
assert.equal(caseRequiresModelTier({ id: 'BETA-INIT-005' }), true, '包含首发验证的初始化 Case 仍必须锁定模型档位');
assert.equal(caseRequiresModelTier({ id: 'BETA-CHAT-001' }), true, '业务会话 Case 必须锁定模型档位');
for (const [id, caseType, expectedMode] of [
  ['BETA-ROUTE-001', 'model_routing', 'native'],
  ['BETA-TASK-008', 'task_lifecycle', 'native'],
  ['BETA-CAP-001', 'capability_activation', 'strict_controller'],
  ['BETA-DEPLOY-001', 'release_deployment', 'strict_controller'],
  ['BETA-MCP-015', 'mcp_use', 'strict_controller'],
  ['BETA-MCP-016', 'mcp_use', 'strict_controller'],
  ['BETA-MCP-009', 'mcp_lifecycle', 'strict_controller'],
  ['BETA-AUTH-002', 'auth_recovery', 'strict_controller'],
  ['BETA-ART-006', 'artifact', 'strict_controller'],
  ['BETA-SKILL-016', 'skill_lifecycle', 'strict_controller'],
  ['BETA-EXPERT-021', 'expert_lifecycle', 'strict_controller'],
  ['BETA-STATE-001', 'recovery', 'strict_controller'],
  ['BETA-STATE-002', 'recovery', 'strict_controller'],
  ['BETA-CHAT-001', 'conversation', 'native'],
]) {
  const binding = coreBetaRuntimeExecutorBinding({ id, case_type: caseType });
  assert.equal(binding.dispatchable, true, `${id} 必须绑定可调用 runtime executor`);
  assert.equal(binding.mode, expectedMode, `${id} runtime executor 模式必须固定`);
}
assert.equal(
  coreBetaRuntimeExecutorBinding({ id: 'BETA-ROUTE-001', case_type: 'unknown_route' }).dispatchable,
  false,
  '未知 Case type 必须在静态能力审计或执行前 fail-closed',
);
assert.match(
  runner,
  /modelTierRecoveryPrefix[\s\S]*deferred_by_initialization_recovery[\s\S]*caseRequiresModelTier\(testCase\)/,
  '模型连接未恢复时只允许初始化维护前缀延后门禁，业务 Case 仍必须逐条校验',
);
assert.match(
  runner,
  /'BETA-INIT-001':[\s\S]*method: 'preparePythonRuntimes'[\s\S]*testId: 'assistant-prepare-python-runtimes'/,
  'BETA-INIT-001 必须点击当前发布界面的真实“立即检查运行时”入口',
);
assert.match(
  runner,
  /executeSitInit002[\s\S]*composerProductEntrySnapshot/,
  'SIT-INIT-002 必须通过产品入口快照兼容统一“+”菜单，不能只依赖旧版独立技能/连接器按钮',
);
assert.match(
  runner,
  /composerProductEntrySnapshot[\s\S]*composer-plus-menu[\s\S]*(?:连接器\|连应用)/,
  '统一“+”菜单快照必须同时验证技能和连接器/连应用入口',
);
assert.match(
  runner,
  /findQbotPage[\s\S]*rankQbotPageCandidates[\s\S]*await page\.title\(\)[\s\S]*\\bQWork\\b/,
  'CDP 页面发现必须 await 标题并优先真实 QWork WebView，不能按返回顺序误选 360Teams 外壳',
);
assert.match(
  runner,
  /executeCoreBetaInitializationCase[\s\S]*assistant-runtime-reset-all[\s\S]*waitForCoreBetaV2MaintenanceTerminal/,
  'Core Beta v2 全量重初始化必须通过真实设置 UI 后等待稳定终态，不能只调用 bridge 后立即截图',
);
assert.match(
  runner,
  /waitForCoreBetaV2MaintenanceTerminal[\s\S]*runtimeStatus[\s\S]*stableReadyObservations/,
  'Core Beta v2 初始化终态必须读取 SDK 状态并连续稳定采样',
);
assert.match(
  runner,
  /resolveCoreBetaV2MaintenancePage[\s\S]*reconnectCoreBetaV2Runtime/,
  'Core Beta v2 初始化终态必须支持 replacement renderer 重连',
);
assert.match(
  runner,
  /framework-exception\.json[\s\S]*state\.artifacts\.framework_exception/,
  'Core Beta v2 异常必须保留原始 message/stack 诊断文件，不能只输出泛化精准断言失败',
);
const resetConfirmation = coreBetaV2MaintenanceConfirmationContract('assistant-runtime-reset-all');
assert.ok(resetConfirmation.prompt.test('确认全量重初始化？将清空本地运行时并重新下载。'));
assert.ok(resetConfirmation.confirm.test('全量重初始化'));
const pendingV2Runtime = coreBetaV2RuntimeMaintenanceState({
  text: '本进程已加载并校验：v0.0.27-RC5；正在重置中',
  composerReady: true,
  workbenchReady: true,
  buttonEnabled: false,
  capabilitiesReadable: true,
  sdkStatuses: [
    { family: 'claude-code', phase: 'provisioning' },
    { family: 'codex', phase: 'ready' },
  ],
  stableReadyObservations: 0,
});
assert.equal(pendingV2Runtime.ready, false);
assert.equal(pendingV2Runtime.pending, true);
const readyV2Runtime = coreBetaV2RuntimeMaintenanceState({
  text: '本进程已加载并校验：v0.0.27-RC5；Claude Code SDK：就绪；Codex SDK：就绪',
  composerReady: true,
  workbenchReady: true,
  buttonEnabled: true,
  capabilitiesReadable: true,
  sdkStatuses: [
    { family: 'claude-code', phase: 'ready' },
    { family: 'codex', phase: 'ready' },
  ],
  stableReadyObservations: 3,
  minimumReadyObservations: 3,
});
assert.equal(readyV2Runtime.ready, true);
const staleVisibleMaintenance = coreBetaV2RuntimeMaintenanceState({
  text: '本进程已加载并校验：v0.0.30-rc.1；Claude Code SDK：就绪；Codex SDK：就绪；准备中 0%',
  composerReady: true,
  workbenchReady: true,
  buttonEnabled: true,
  capabilitiesReadable: true,
  sdkStatuses: [
    { family: 'claude-code', phase: 'ready', progress: 100 },
    { family: 'codex', phase: 'ready', progress: 100 },
  ],
  stableReadyObservations: 1,
  minimumReadyObservations: 1,
});
assert.equal(staleVisibleMaintenance.ready, false);
assert.equal(staleVisibleMaintenance.pending, true);
assert.equal(staleVisibleMaintenance.authoritative_ready, true);
assert.equal(staleVisibleMaintenance.visible_activity, true);
assert.equal(
  coreBetaV2MaintenanceProductStateConflict({
    maintenanceState: staleVisibleMaintenance,
    stableObservations: 2,
    elapsedMs: 5000,
  }).confirmed,
  false,
  '结构化 ready 与陈旧可见文案的矛盾必须至少连续稳定三次后才能落产品失败',
);
const confirmedMaintenanceConflict = coreBetaV2MaintenanceProductStateConflict({
  maintenanceState: staleVisibleMaintenance,
  stableObservations: 3,
  elapsedMs: 5000,
});
assert.equal(confirmedMaintenanceConflict.confirmed, true);
assert.equal(confirmedMaintenanceConflict.evidence_valid, true);
assert.equal(confirmedMaintenanceConflict.oracle_valid, false);
assert.equal(
  coreBetaV2MaintenanceProductStateConflict({
    maintenanceState: {},
    stableObservations: 3,
    elapsedMs: 5000,
  }).evidence_valid,
  false,
  '空维护状态不得形成有效产品冲突证据',
);
const staleMaintenanceContinuation = coreBetaInitializationContinuation({
  testCase: { id: 'BETA-INIT-002' },
  terminalReadback: {
    ...staleVisibleMaintenance,
    pending: false,
    failed: true,
    product_ui_state_conflict: true,
  },
  continuationSurface: { valid: true, composer_ready: true, workbench_ready: true },
  afterReadback: { page: { body_text_length: 100 } },
});
assert.equal(
  staleMaintenanceContinuation.safe,
  true,
  '稳定的维护区 UI 状态冲突应作为产品 Bug 保留，并在公开工作台全部可用时继续后续独立 Case',
);
assert.equal(
  coreBetaBatchStopReason(
    { id: 'BETA-INIT-002', case_type: 'run_initialization', contract_version: 'qbot-core-beta/v2' },
    {
      status: 'failed',
      result_category: 'bug',
      initialization_continuation: staleMaintenanceContinuation,
    },
  ),
  '',
  'BETA-INIT-002 的稳定产品 UI 状态冲突不得错误升级为 automation_error 并中断剩余 Case',
);
const runtimeCheckProductFailureContinuation = coreBetaInitializationContinuation({
  testCase: { id: 'BETA-INIT-001' },
  terminalReadback: {
    pending: false,
    failed: true,
    loaded: true,
    sdk_ready: true,
    button_enabled: true,
    composer_ready: true,
    workbench_ready: true,
    capabilities_readable: true,
  },
  continuationSurface: { valid: true, composer_ready: true, workbench_ready: true },
  afterReadback: { page: { body_text_length: 100 } },
});
assert.equal(
  runtimeCheckProductFailureContinuation.safe,
  true,
  'BETA-INIT-001 的运行时产品失败在全部公开可用性信号恢复后必须允许继续独立 Case',
);
assert.equal(
  coreBetaBatchStopReason(
    { id: 'BETA-INIT-001', case_type: 'run_initialization', contract_version: 'qbot-core-beta/v2' },
    {
      status: 'failed',
      result_category: 'bug',
      initialization_continuation: runtimeCheckProductFailureContinuation,
    },
  ),
  '',
  'BETA-INIT-001 的可信产品失败不得在公开工作台可安全继续时中断剩余 Case',
);
const unsafeRuntimeCheckContinuation = coreBetaInitializationContinuation({
  testCase: { id: 'BETA-INIT-001' },
  terminalReadback: {
    pending: false,
    failed: true,
    loaded: true,
    sdk_ready: true,
    button_enabled: true,
    composer_ready: false,
    workbench_ready: true,
    capabilities_readable: true,
  },
  afterReadback: { page: { body_text_length: 100 } },
});
assert.equal(unsafeRuntimeCheckContinuation.safe, false);
const recoveredRuntimeCheckContinuation = coreBetaInitializationContinuation({
  testCase: { id: 'BETA-INIT-001' },
  terminalReadback: {
    pending: false,
    failed: true,
    loaded: true,
    sdk_ready: true,
    button_enabled: true,
    composer_ready: false,
    workbench_ready: true,
    capabilities_readable: true,
  },
  continuationSurface: {
    valid: true,
    composer_ready: true,
    workbench_ready: true,
  },
  afterReadback: { page: { body_text_length: 100 } },
});
assert.equal(
  recoveredRuntimeCheckContinuation.safe,
  true,
  '设置页遮住 composer 时必须返回干净工作台并以可见输入区独立证明可继续',
);
assert.equal(
  recoveredRuntimeCheckContinuation.signals.composer_ready_source,
  'recovered_workbench_surface',
);
assert.equal(
  coreBetaInitializationContinuation({
    testCase: { id: 'BETA-INIT-001' },
    terminalReadback: {
      pending: false,
      failed: true,
      loaded: true,
      sdk_ready: true,
      button_enabled: true,
      composer_ready: false,
      workbench_ready: true,
      capabilities_readable: true,
    },
    continuationSurface: {
      valid: false,
      composer_ready: true,
      workbench_ready: true,
    },
    afterReadback: { page: { body_text_length: 100 } },
  }).safe,
  false,
  '恢复工作台证据无效时不得用可见性布尔值绕过初始化停止门禁',
);
assert.match(
  coreBetaBatchStopReason(
    { id: 'BETA-INIT-001', case_type: 'run_initialization', contract_version: 'qbot-core-beta/v2' },
    {
      status: 'failed',
      result_category: 'bug',
      initialization_continuation: unsafeRuntimeCheckContinuation,
    },
  ),
  /^$/,
  '初始化 Case 即使连续性信号不足，也必须先记录结果再继续后续 Case',
);
assert.match(
  runner,
  /async function verifyCoreBetaInitializationContinuationSurface[\s\S]*openNewTask\(page, state\)[\s\S]*qbotE2EState\(page\)[\s\S]*draftSurfaceState\(page\)[\s\S]*clean_draft_isolated[\s\S]*initialization-continuation-surface\.json/,
  '初始化恢复 helper 必须通过框架新建任务路径返回干净工作台并固化专项证据',
);
assert.match(
  runner,
  /terminal\.readback\?\.failed === true[\s\S]*verifyCoreBetaInitializationContinuationSurface[\s\S]*continuationSurface/,
  '初始化产品失败后必须通过框架新建任务路径回到干净工作台，再判定 composer 是否可继续',
);
const readyInstalledSkill = ({
  sourcePlatform = 'skillhub',
  namespace = 'global',
  slug = 'sample-skill',
  version = '1.0.0',
  ...overrides
} = {}) => ({
  sourcePlatform,
  namespace,
  slug,
  version,
  managementInstalled: true,
  installStatus: 'ok',
  readinessStatus: 'projected_for_both',
  localReadiness: {
    status: 'ready_on_this_process',
    readinessStatus: 'projected_for_both',
    installStatus: 'ok',
  },
  ...overrides,
});
const initializationCatalogBefore = {
  syncStatus: 'idle',
  installed: [
    readyInstalledSkill({ slug: 'alpha', version: '1.0.0' }),
    readyInstalledSkill({
      sourcePlatform: 'builtin',
      namespace: 'qbot',
      slug: 'document-processing',
      version: '1.2.0',
      installStatus: '',
      readinessStatus: 'builtin_available_on_demand',
      localReadiness: {
        status: 'ready_on_demand',
        readinessStatus: 'builtin_available_on_demand',
      },
    }),
    readyInstalledSkill({
      sourcePlatform: 'agent-created',
      namespace: 'local',
      slug: 'source-verification',
      version: '',
      packageDigest: 'a'.repeat(64),
      installStatus: '',
      readinessStatus: 'agent_created',
      localReadiness: {
        status: 'ready_on_this_process',
        readinessStatus: 'agent_created',
      },
    }),
  ],
};
const initializationCatalogAfter = {
  syncStatus: 'idle',
  installed: [...initializationCatalogBefore.installed].reverse(),
};
const initializationCatalogLedger = (catalogs, { readErrorIndexes = [] } = {}) => {
  let signature = '';
  let stable = 0;
  let readErrorCount = 0;
  let finalCatalog = null;
  const observations = catalogs.map((catalog, index) => {
    if (readErrorIndexes.includes(index)) {
      signature = '';
      stable = 0;
      readErrorCount += 1;
      return {
        captured_at: new Date(index + 1).toISOString(),
        elapsed_ms: index * 1000,
        read_ok: false,
        raw_catalog: null,
        normalized_tuple: null,
        canonical_sha256: '',
        same_signature_as_previous: false,
        error: 'fixture catalog read failed',
        idle_stable_observations: 0,
        read_error_count: 1,
        renderer_capture_attempts: [{ attempt: 1, ok: false, error: 'fixture catalog read failed' }],
      };
    }
    const replayed = coreBetaInitializationSkillCatalogObservation({
      catalog,
      previousSignatureSha256: signature,
      previousIdleStableObservations: stable,
    });
    signature = replayed.next_signature_sha256;
    stable = replayed.idle_stable_observations;
    finalCatalog = catalog;
    return {
      captured_at: new Date(index + 1).toISOString(),
      elapsed_ms: index * 1000,
      read_ok: true,
      raw_catalog: catalog,
      normalized_tuple: replayed.normalized_tuple,
      canonical_sha256: replayed.canonical_sha256,
      same_signature_as_previous: replayed.same_signature_as_previous,
      sync_status: replayed.summary.sync_status,
      installed_count: replayed.summary.installed_count,
      identity_count: replayed.summary.identities.length,
      duplicate_count: replayed.summary.duplicate_identities.length,
      invalid_identity_count: replayed.summary.invalid_identity_indexes.length,
      readiness_missing_count: replayed.summary.readiness_missing_indexes.length,
      unready_count: replayed.summary.unready_identities.length,
      idle_stable_observations: stable,
      read_error_count: 0,
      error: '',
      renderer_capture_attempts: [{ attempt: 1, ok: true, error: '' }],
    };
  });
  const ok = stable >= 3 && readErrorCount === 0;
  return {
    schema_version: 'qbot-core-beta-skill-reinstall-catalog-observations/v2',
    case_id: 'BETA-INIT-003',
    method: 'skillsReinstall',
    testid: 'assistant-skills-reinstall',
    ok,
    evidence_valid: readErrorCount === 0,
    started_at: new Date(0).toISOString(),
    ended_at: new Date(catalogs.length + 1).toISOString(),
    timeout_ms: 60_000,
    idle_stable_observations: stable,
    stable_signature_sha256: stable >= 3 ? signature : '',
    read_error_count: readErrorCount,
    last_error: readErrorCount ? 'fixture catalog read failed' : '',
    observations,
    catalog: finalCatalog,
  };
};
assert.equal(
  coreBetaInitializationSkillIdentity(initializationCatalogBefore.installed[2]).identity,
  `agent-created/local/source-verification/${'a'.repeat(64)}`,
  '版本为空的 agent-created Skill 必须使用不可变 package digest 形成完整四元 identity',
);
const skillReinstallPass = coreBetaInitializationSkillReinstallVerdict({
  beforeCatalog: initializationCatalogBefore,
  afterCatalog: initializationCatalogAfter,
  afterIdleStableObservations: 3,
  catalogObservations: initializationCatalogLedger([
    initializationCatalogAfter,
    initializationCatalogAfter,
    initializationCatalogAfter,
  ]),
});
assert.equal(skillReinstallPass.evidence_valid, true);
assert.equal(skillReinstallPass.oracle_valid, true, '仅列表顺序变化不得误报安装账本漂移');
assert.equal(skillReinstallPass.identity_set_equal, true);

const initializationCatalogPythonFailure = {
  syncStatus: 'idle',
  installed: initializationCatalogBefore.installed.map((item, index) => index === 0 ? {
    ...item,
    installStatus: 'ok',
    readinessStatus: 'python_runtime_failed',
    localReadiness: {
      status: 'unready',
      readinessStatus: 'python_runtime_failed',
      installStatus: 'ok',
    },
  } : item),
};
const skillReinstallPythonFailure = coreBetaInitializationSkillReinstallVerdict({
  beforeCatalog: initializationCatalogBefore,
  afterCatalog: initializationCatalogPythonFailure,
  afterIdleStableObservations: 3,
  catalogObservations: initializationCatalogLedger(Array(3).fill(initializationCatalogPythonFailure)),
});
assert.equal(skillReinstallPythonFailure.evidence_valid, true);
assert.equal(skillReinstallPythonFailure.oracle_valid, false);
assert.equal(skillReinstallPythonFailure.outcome, 'bug');
assert.ok(skillReinstallPythonFailure.oracle_failures.includes('installed_skill_not_ready'));

const initializationCatalogStillSyncing = { ...initializationCatalogAfter, syncStatus: 'syncing' };
const skillReinstallStillSyncing = coreBetaInitializationSkillReinstallVerdict({
  beforeCatalog: initializationCatalogBefore,
  afterCatalog: initializationCatalogStillSyncing,
  afterIdleStableObservations: 0,
  catalogObservations: initializationCatalogLedger(Array(3).fill(initializationCatalogStillSyncing)),
});
assert.equal(skillReinstallStillSyncing.evidence_valid, false);
assert.equal(skillReinstallStillSyncing.outcome, 'automation_error');
assert.ok(skillReinstallStillSyncing.oracle_failures.includes('after_catalog_not_idle'));

const initializationCatalogIdentityDrift = {
  syncStatus: 'idle',
  installed: initializationCatalogBefore.installed.map((item, index) => (
    index === 0 ? { ...item, slug: 'ghost-replacement' } : item
  )),
};
const skillReinstallIdentityDrift = coreBetaInitializationSkillReinstallVerdict({
  beforeCatalog: initializationCatalogBefore,
  afterCatalog: initializationCatalogIdentityDrift,
  afterIdleStableObservations: 3,
  catalogObservations: initializationCatalogLedger(Array(3).fill(initializationCatalogIdentityDrift)),
});
assert.equal(skillReinstallIdentityDrift.evidence_valid, true);
assert.equal(skillReinstallIdentityDrift.outcome, 'bug');
assert.equal(skillReinstallIdentityDrift.missing_after.length, 1);
assert.equal(skillReinstallIdentityDrift.unexpected_after.length, 1);

const initializationCatalogDuplicateIdentity = {
  syncStatus: 'idle',
  installed: [
    ...initializationCatalogBefore.installed,
    { ...initializationCatalogBefore.installed[0] },
  ],
};
const skillReinstallDuplicateIdentity = coreBetaInitializationSkillReinstallVerdict({
  beforeCatalog: initializationCatalogBefore,
  afterCatalog: initializationCatalogDuplicateIdentity,
  afterIdleStableObservations: 3,
  catalogObservations: initializationCatalogLedger(Array(3).fill(initializationCatalogDuplicateIdentity)),
});
assert.equal(skillReinstallDuplicateIdentity.evidence_valid, false);
assert.equal(skillReinstallDuplicateIdentity.outcome, 'automation_error');
assert.ok(skillReinstallDuplicateIdentity.evidence_failures.includes('after_duplicate_identity'));

const initializationCatalogMissingReadiness = {
  syncStatus: 'idle',
  installed: initializationCatalogBefore.installed.map((item, index) => (
    index === 0 ? { ...item, readinessStatus: '', localReadiness: {} } : item
  )),
};
const skillReinstallMissingReadiness = coreBetaInitializationSkillReinstallVerdict({
  beforeCatalog: initializationCatalogBefore,
  afterCatalog: initializationCatalogMissingReadiness,
  afterIdleStableObservations: 3,
  catalogObservations: initializationCatalogLedger(Array(3).fill(initializationCatalogMissingReadiness)),
});
assert.equal(skillReinstallMissingReadiness.evidence_valid, false);
assert.ok(skillReinstallMissingReadiness.evidence_failures.includes('after_readiness_missing'));
assert.equal(
  coreBetaInitializationSkillReinstallVerdict({
    beforeCatalog: initializationCatalogBefore,
    afterCatalog: { syncStatus: 'idle', installed: [] },
    afterIdleStableObservations: 0,
    catalogObservations: initializationCatalogLedger(Array(3).fill({ syncStatus: 'idle', installed: [] })),
  }).outcome,
  'automation_error',
  '空 installed 不能被当作重装后零项产品结论，必须视为取证结构失败',
);

const specializedSkillFailureContinuation = coreBetaInitializationContinuation({
  testCase: { id: 'BETA-INIT-003' },
  terminalReadback: {
    pending: false,
    failed: false,
    loaded: true,
    sdk_ready: true,
    button_enabled: true,
    composer_ready: true,
    workbench_ready: true,
    capabilities_readable: true,
  },
  afterReadback: { page: { body_text_length: 100 } },
  continuationSurface: {
    valid: true,
    composer_ready: true,
    workbench_ready: true,
  },
  productFailureObserved: true,
  productFailureSource: 'skill_reinstall_readiness_oracle',
});
assert.equal(
  specializedSkillFailureContinuation.safe,
  true,
  'INIT-003 专项 readiness 产品失败不应伪造通用 terminal.failed，但可在公开运行能力完整时安全继续独立 Case',
);
assert.equal(
  coreBetaInitializationContinuationVerdict({
    id: 'BETA-INIT-003',
    status: 'failed',
    result_category: 'bug',
    initialization_action_observation: {
      schema_version: 'qbot-core-beta-initialization-action-observation/v1',
      case_id: 'BETA-INIT-003',
      method: 'skillsReinstall',
      testid: 'assistant-skills-reinstall',
      action_observed: true,
    },
    initialization_continuation: specializedSkillFailureContinuation,
  }).safe,
  true,
  'INIT-003 专项产品失败必须在真实新建任务恢复表面后才允许继续独立 Case',
);

const catalogA = initializationCatalogAfter;
const catalogB = {
  ...initializationCatalogAfter,
  installed: initializationCatalogAfter.installed.map((item, index) => (
    index === 0 ? { ...item, localReadiness: { ...item.localReadiness, status: 'unready' } } : item
  )),
};
const abaLedger = initializationCatalogLedger([catalogA, catalogB, catalogA]);
assert.equal(abaLedger.idle_stable_observations, 1, 'A→B→A 只能得到一次连续同签名样本');
const skillReinstallAba = coreBetaInitializationSkillReinstallVerdict({
  beforeCatalog: initializationCatalogBefore,
  afterCatalog: catalogA,
  afterIdleStableObservations: abaLedger.idle_stable_observations,
  catalogObservations: abaLedger,
});
assert.equal(skillReinstallAba.evidence_valid, false);
assert.ok(skillReinstallAba.evidence_failures.includes('catalog_observation_signature_not_stable'));

const readErrorLedger = initializationCatalogLedger(
  [null, catalogA, catalogA, catalogA],
  { readErrorIndexes: [0] },
);
const skillReinstallReadError = coreBetaInitializationSkillReinstallVerdict({
  beforeCatalog: initializationCatalogBefore,
  afterCatalog: catalogA,
  afterIdleStableObservations: readErrorLedger.idle_stable_observations,
  catalogObservations: readErrorLedger,
});
assert.equal(skillReinstallReadError.evidence_valid, false);
assert.ok(skillReinstallReadError.evidence_failures.includes('catalog_observation_read_error'));

const initializationCatalogBeforeMissingReadiness = {
  ...initializationCatalogBefore,
  installed: initializationCatalogBefore.installed.map((item, index) => (
    index === 0 ? { ...item, readinessStatus: '', localReadiness: {} } : item
  )),
};
const skillReinstallBeforeMissingReadiness = coreBetaInitializationSkillReinstallVerdict({
  beforeCatalog: initializationCatalogBeforeMissingReadiness,
  afterCatalog: catalogA,
  afterIdleStableObservations: 3,
  catalogObservations: initializationCatalogLedger([catalogA, catalogA, catalogA]),
});
assert.equal(skillReinstallBeforeMissingReadiness.evidence_valid, false);
assert.ok(skillReinstallBeforeMissingReadiness.evidence_failures.includes('before_readiness_missing'));

{
  const evidenceRoots = [];
  const cloneJson = (value) => JSON.parse(JSON.stringify(value));
  const png1x1 = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
    'base64',
  );
  const png1x1Alternative = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=',
    'base64',
  );
  const pngCrc32 = (buffer) => {
    let crc = 0xffffffff;
    for (const byte of buffer) {
      crc ^= byte;
      for (let bit = 0; bit < 8; bit += 1) {
        crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
      }
    }
    return (crc ^ 0xffffffff) >>> 0;
  };
  const replaceFirstPngChunk = (png, wantedType, replaceData) => {
    let offset = 8;
    while (offset < png.length) {
      const length = png.readUInt32BE(offset);
      const type = png.subarray(offset + 4, offset + 8).toString('ascii');
      const nextOffset = offset + 12 + length;
      if (type === wantedType) {
        const typeBytes = Buffer.from(type, 'ascii');
        const currentData = png.subarray(offset + 8, offset + 8 + length);
        const data = Buffer.from(replaceData(Buffer.from(currentData)));
        const chunk = Buffer.alloc(12 + data.length);
        chunk.writeUInt32BE(data.length, 0);
        typeBytes.copy(chunk, 4);
        data.copy(chunk, 8);
        chunk.writeUInt32BE(pngCrc32(Buffer.concat([typeBytes, data])), 8 + data.length);
        return Buffer.concat([png.subarray(0, offset), chunk, png.subarray(nextOffset)]);
      }
      offset = nextOffset;
    }
    throw new Error(`PNG chunk not found: ${wantedType}`);
  };
  const createPngChunk = (type, data = Buffer.alloc(0)) => {
    const typeBytes = Buffer.from(type, 'ascii');
    const payload = Buffer.from(data);
    const chunk = Buffer.alloc(12 + payload.length);
    chunk.writeUInt32BE(payload.length, 0);
    typeBytes.copy(chunk, 4);
    payload.copy(chunk, 8);
    chunk.writeUInt32BE(pngCrc32(Buffer.concat([typeBytes, payload])), 8 + payload.length);
    return chunk;
  };
  const insertPngChunkBefore = (png, wantedType, type, data = Buffer.alloc(0)) => {
    let offset = 8;
    while (offset < png.length) {
      const length = png.readUInt32BE(offset);
      const currentType = png.subarray(offset + 4, offset + 8).toString('ascii');
      if (currentType === wantedType) {
        return Buffer.concat([
          png.subarray(0, offset),
          createPngChunk(type, data),
          png.subarray(offset),
        ]);
      }
      offset += 12 + length;
    }
    throw new Error(`PNG chunk not found: ${wantedType}`);
  };
  const insertRepeatedPngChunksBefore = (png, wantedType, count) => {
    let offset = 8;
    while (offset < png.length) {
      const length = png.readUInt32BE(offset);
      const currentType = png.subarray(offset + 4, offset + 8).toString('ascii');
      if (currentType === wantedType) {
        const chunks = Array.from({ length: count }, () => createPngChunk('tEXt'));
        return Buffer.concat([png.subarray(0, offset), ...chunks, png.subarray(offset)]);
      }
      offset += 12 + length;
    }
    throw new Error(`PNG chunk not found: ${wantedType}`);
  };
  const splitIdatWithAncillaryChunk = (png) => {
    let offset = 8;
    while (offset < png.length) {
      const length = png.readUInt32BE(offset);
      const type = png.subarray(offset + 4, offset + 8).toString('ascii');
      const nextOffset = offset + 12 + length;
      if (type === 'IDAT') {
        const payload = png.subarray(offset + 8, offset + 8 + length);
        const splitAt = Math.max(1, Math.floor(payload.length / 2));
        return Buffer.concat([
          png.subarray(0, offset),
          createPngChunk('IDAT', payload.subarray(0, splitAt)),
          createPngChunk('tEXt', Buffer.from('fixture')),
          createPngChunk('IDAT', payload.subarray(splitAt)),
          png.subarray(nextOffset),
        ]);
      }
      offset = nextOffset;
    }
    throw new Error('PNG chunk not found: IDAT');
  };
  const png1x1Third = replaceFirstPngChunk(
    png1x1,
    'IDAT',
    () => deflateSync(Buffer.from([0, 128, 255])),
  );
  const buildSkillReinstallEvidenceFixture = ({
    beforeCatalog = initializationCatalogBefore,
    afterCatalog = initializationCatalogAfter,
    catalogs = [afterCatalog, afterCatalog, afterCatalog],
    readErrorIndexes = [],
    actionObserved = true,
    status,
    resultCategory,
  } = {}) => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'qbot-init-003-trusted-review-'));
    evidenceRoots.push(root);
    const caseDir = path.join(root, 'cases', 'BETA-INIT-003');
    fs.mkdirSync(caseDir, { recursive: true });
    const paths = {
      maintenance: path.join(caseDir, 'skillsReinstall-readback.json'),
      action: path.join(caseDir, 'skillsReinstall-action-observation.json'),
      beforePublicState: path.join(caseDir, 'skillsReinstall-before-public-state.json'),
      afterPublicState: path.join(caseDir, 'skillsReinstall-after-public-state.json'),
      terminal: path.join(caseDir, 'skillsReinstall-terminal-observations.json'),
      catalog: path.join(caseDir, 'skill-reinstall-catalog-observations.json'),
      screenshot: path.join(caseDir, 'assistant-skills-reinstall-terminal.png'),
      continuationBefore: path.join(caseDir, 'initialization-continuation-surface-before.png'),
      continuationAfter: path.join(caseDir, 'initialization-continuation-surface-after.png'),
      continuationSurface: path.join(caseDir, 'initialization-continuation-surface.json'),
      verdict: path.join(caseDir, 'skill-reinstall-readiness-verdict.json'),
      manifest: path.join(caseDir, 'evidence-manifest.json'),
    };
    const fileRecord = (file) => {
      const bytes = fs.statSync(file).size;
      return {
        path: file,
        bytes,
        sha256: createHash('sha256').update(fs.readFileSync(file)).digest('hex'),
      };
    };
    const confirmation = {
      message: '确认一键重装 Skill，将清理现有环境并重新物化，确定继续。',
      source: 'custom-dialog',
      accepted: true,
      confirmation_label: '一键重装 Skill',
      screenshot: '',
    };
    const action = {
      ok: true,
      testid: 'assistant-skills-reinstall',
      before_text: '一键重装 Skill',
      action_text: actionObserved ? '重装中' : '一键重装 Skill',
      confirmation,
      busy_observed: actionObserved,
      navigation_observed: false,
      navigation_url: '',
      action_observed: actionObserved,
      action_observation_source: actionObserved ? 'busy' : 'none',
      completion_transition: '',
      busy_screenshot: '',
    };
    const actionEvidence = {
      schema_version: 'qbot-core-beta-initialization-action-evidence/v1',
      case_id: 'BETA-INIT-003',
      method: 'skillsReinstall',
      testid: 'assistant-skills-reinstall',
      destructive: true,
      captured_at: new Date(1).toISOString(),
      attempts: [action],
    };
    fs.writeFileSync(paths.action, `${JSON.stringify(actionEvidence, null, 2)}\n`);
    const ledger = {
      ...initializationCatalogLedger(catalogs, { readErrorIndexes }),
      method: 'skillsReinstall',
      testid: 'assistant-skills-reinstall',
      action_evidence: fileRecord(paths.action),
      action,
      confirmation,
    };
    const computedVerdict = coreBetaInitializationSkillReinstallVerdict({
      beforeCatalog,
      afterCatalog,
      afterIdleStableObservations: ledger.idle_stable_observations,
      catalogObservations: ledger,
    });
    const maintenanceText = '运行时完成就绪，本进程已加载并校验；Claude Code SDK 已就绪；Codex SDK 已就绪。';
    const sdkStatuses = [
      { family: 'claude-code', phase: 'ready' },
      { family: 'codex', phase: 'ready' },
    ];
    const terminal = {
      schema_version: 'qbot-core-beta-runtime-maintenance-observations/v2',
      case_id: 'BETA-INIT-003',
      method: 'skillsReinstall',
      testid: 'assistant-skills-reinstall',
      action_evidence: fileRecord(paths.action),
      terminal_kind: 'runtime-ready',
      timeout_ms: 600_000,
      completed_at: new Date(8).toISOString(),
      final: null,
      observations: [1, 2, 3].map((stable, index) => ({
        captured_at: new Date(index + 2).toISOString(),
        elapsed_ms: 5_000 + (index * 1_000),
        read_ok: true,
        raw: {
          page_url: 'file:///fixture/ui/index.html',
          page_text: '新建任务 专家 技能 连接器 知识',
          page_body_text_length: 100,
          maintenance_region_visible: true,
          maintenance_text: maintenanceText,
          composer_visible: true,
          maintenance_button_enabled: true,
          sdk_statuses: sdkStatuses,
          capabilities: { modelTiers: ['M3'] },
          sessions: [],
          reconnected: false,
        },
        reported: {
          ready: stable === 3,
          pending: false,
          failed: false,
          stable_ready_observations: stable,
          authoritative_ready_observations: stable,
          product_ui_state_conflict: false,
        },
        error: '',
      })),
    };
    terminal.final = coreBetaInitializationMaintenanceObservationsVerdict({
      ledger: terminal,
      caseId: 'BETA-INIT-003',
      method: 'skillsReinstall',
      testid: 'assistant-skills-reinstall',
    }).replayed_final;
    const terminalFinal = terminal.final;
    fs.writeFileSync(paths.screenshot, png1x1);
    fs.writeFileSync(paths.continuationBefore, png1x1Alternative);
    fs.writeFileSync(paths.continuationAfter, png1x1Third);
    const publicStateForCatalog = (catalog) => ({
      case_id: 'BETA-INIT-003',
      page: { body_text_length: 100 },
      task: {
        id: null,
        running: false,
        message_count: 0,
        send_count: 0,
        messages: [],
      },
      capabilities: { modelTiers: ['M3'] },
      skills: { selected: [], catalog },
      connectors: { selected: [] },
      expert: null,
    });
    const beforePublicState = publicStateForCatalog(beforeCatalog);
    const afterPublicState = publicStateForCatalog(afterCatalog);
    const beforePublicStateEvidence = {
      schema_version: 'qbot-core-beta-initialization-public-state-observation/v1',
      case_id: 'BETA-INIT-003',
      method: 'skillsReinstall',
      testid: 'assistant-skills-reinstall',
      phase: 'before-action',
      captured_at: new Date(1).toISOString(),
      public_state: beforePublicState,
    };
    const afterPublicStateEvidence = {
      schema_version: 'qbot-core-beta-initialization-public-state-observation/v1',
      case_id: 'BETA-INIT-003',
      method: 'skillsReinstall',
      testid: 'assistant-skills-reinstall',
      phase: 'after-maintenance',
      captured_at: new Date(7).toISOString(),
      public_state: afterPublicState,
    };
    fs.writeFileSync(paths.beforePublicState, `${JSON.stringify(beforePublicStateEvidence, null, 2)}\n`);
    fs.writeFileSync(paths.afterPublicState, `${JSON.stringify(afterPublicStateEvidence, null, 2)}\n`);
    const continuationSurface = {
      schema_version: 'qbot-core-beta-initialization-continuation-surface/v1',
      case_id: 'BETA-INIT-003',
      method: 'skillsReinstall',
      testid: 'assistant-skills-reinstall',
      valid: true,
      composer_ready: true,
      workbench_ready: true,
      clean_draft_isolated: true,
      clean_draft_state: {
        available: true,
        activeId: null,
        isDraft: true,
        draftInstanceId: 'draft-init-003-fixture',
        messageCount: 0,
        sendCount: 0,
        running: false,
      },
      clean_draft_surface: { ok: true, reason: 'fixture clean draft surface' },
      capabilities_readable: true,
      public_task_clean: true,
      public_selections_clean: true,
      public_state_readable: true,
      continuation_state: {
        draft_instance_id: 'draft-init-003-fixture',
        task_id: null,
        message_count: 0,
        send_count: 0,
        running: false,
        selected_skills: [],
        selected_connectors: [],
        current_expert: null,
      },
      before_screenshot: fileRecord(paths.continuationBefore),
      after_screenshot: fileRecord(paths.continuationAfter),
      error: '',
      public_state: afterPublicState,
    };
    const initializationActionObservation = {
      schema_version: 'qbot-core-beta-initialization-action-observation/v1',
      case_id: 'BETA-INIT-003',
      method: 'skillsReinstall',
      testid: 'assistant-skills-reinstall',
      action_observed: action.action_observed === true,
      source: action.action_observation_source,
      attempts: [{
        attempt: 1,
        action_observed: action.action_observed === true,
        source: action.action_observation_source,
        confirmation_accepted: confirmation.accepted === true,
        confirmation_source: confirmation.source,
      }],
    };
    const initializationContinuation = computedVerdict.oracle_valid ? null : coreBetaInitializationContinuation({
      testCase: { id: 'BETA-INIT-003' },
      terminalReadback: terminalFinal,
      afterReadback: afterPublicState,
      continuationSurface,
      productFailureObserved: true,
      productFailureSource: 'skill_reinstall_readiness_oracle',
    });
    const maintenance = {
      schema_version: 'qbot-core-beta-runtime-maintenance-readback/v1',
      case_id: 'BETA-INIT-003',
      method: 'skillsReinstall',
      testid: 'assistant-skills-reinstall',
      evidence_valid: true,
      oracle_valid: computedVerdict.oracle_valid,
      valid: computedVerdict.oracle_valid,
      before: beforePublicState,
      action,
      action_attempts: [action],
      initialization_action_observation: initializationActionObservation,
      terminal: terminalFinal,
      after: afterPublicState,
      continuation_surface: { ...continuationSurface, file: paths.continuationSurface },
      skill_reinstall_readiness_verdict: computedVerdict,
      ...(initializationContinuation ? { initialization_continuation: initializationContinuation } : {}),
    };
    fs.writeFileSync(paths.maintenance, `${JSON.stringify(maintenance, null, 2)}\n`);
    fs.writeFileSync(paths.terminal, `${JSON.stringify(terminal, null, 2)}\n`);
    fs.writeFileSync(paths.catalog, `${JSON.stringify(ledger, null, 2)}\n`);
    fs.writeFileSync(paths.continuationSurface, `${JSON.stringify(continuationSurface, null, 2)}\n`);
    const verdict = {
      ...computedVerdict,
      captured_at: new Date(5).toISOString(),
      evidence_refs: {
        maintenance_readback: fileRecord(paths.maintenance),
        action_observations: fileRecord(paths.action),
        before_public_state: fileRecord(paths.beforePublicState),
        after_public_state: fileRecord(paths.afterPublicState),
        terminal_observations: fileRecord(paths.terminal),
        catalog_observations: fileRecord(paths.catalog),
        terminal_screenshot: fileRecord(paths.screenshot),
        continuation_surface: fileRecord(paths.continuationSurface),
      },
    };
    let manifest = null;
    const writeManifest = () => {
      const verdictRecord = fileRecord(paths.verdict);
      manifest = manifest || {
        schema_version: 'qbot-core-evidence/v2',
        case_id: 'BETA-INIT-003',
        generated_at: new Date(6).toISOString(),
        complete: true,
        missing_roles: [],
        invalid_roles: [],
        not_applicable_roles: [],
        evidence: [],
      };
      const nextRows = [{
        role: 'skill_reinstall_readiness_verdict',
        ...verdictRecord,
        valid: true,
        validation_error: '',
        missing: false,
      }, {
        role: 'initialization_terminal_screenshot',
        ...fileRecord(paths.screenshot),
        valid: true,
        validation_error: '',
        missing: false,
      }, {
        role: 'initialization_continuation_surface',
        ...fileRecord(paths.continuationSurface),
        valid: true,
        validation_error: '',
        missing: false,
      }, {
        role: 'core_beta_runtime_maintenance',
        ...fileRecord(paths.maintenance),
        valid: true,
        validation_error: '',
        missing: false,
      }, {
        role: 'initialization_action_observation',
        ...fileRecord(paths.action),
        valid: true,
        validation_error: '',
        missing: false,
      }, {
        role: 'core_beta_runtime_maintenance_observations',
        ...fileRecord(paths.terminal),
        valid: true,
        validation_error: '',
        missing: false,
      }, {
        role: 'initialization_before_public_state',
        ...fileRecord(paths.beforePublicState),
        valid: true,
        validation_error: '',
        missing: false,
      }, {
        role: 'initialization_after_public_state',
        ...fileRecord(paths.afterPublicState),
        valid: true,
        validation_error: '',
        missing: false,
      }];
      for (const nextRow of nextRows) {
        const existingIndex = manifest.evidence.findIndex((item) => item.role === nextRow.role);
        if (existingIndex >= 0) manifest.evidence[existingIndex] = nextRow;
        else manifest.evidence.push(nextRow);
      }
      fs.writeFileSync(paths.manifest, `${JSON.stringify(manifest, null, 2)}\n`);
    };
    const commitVerdict = () => {
      fs.writeFileSync(paths.verdict, `${JSON.stringify(verdict, null, 2)}\n`);
      writeManifest();
    };
    const refreshRefsAndCommit = () => {
      verdict.evidence_refs = {
        maintenance_readback: fileRecord(paths.maintenance),
        action_observations: fileRecord(paths.action),
        before_public_state: fileRecord(paths.beforePublicState),
        after_public_state: fileRecord(paths.afterPublicState),
        terminal_observations: fileRecord(paths.terminal),
        catalog_observations: fileRecord(paths.catalog),
        terminal_screenshot: fileRecord(paths.screenshot),
        continuation_surface: fileRecord(paths.continuationSurface),
      };
      commitVerdict();
    };
    commitVerdict();
    const result = {
      id: 'BETA-INIT-003',
      case_dir: caseDir,
      evidence_roles: [
        'skill_reinstall_readiness_verdict',
        'initialization_continuation_surface',
        'initialization_action_observation',
        'core_beta_runtime_maintenance_observations',
        'initialization_before_public_state',
        'initialization_after_public_state',
      ],
      status: status || (computedVerdict.oracle_valid ? 'passed' : 'failed'),
      result_category: resultCategory || (computedVerdict.oracle_valid ? 'pass' : (
        computedVerdict.evidence_valid ? 'bug' : 'automation_error'
      )),
      artifacts: {
        skill_reinstall_readiness_verdict: paths.verdict,
        core_beta_runtime_maintenance: paths.maintenance,
        initialization_action_observation: paths.action,
        initialization_before_public_state: paths.beforePublicState,
        initialization_after_public_state: paths.afterPublicState,
        core_beta_runtime_maintenance_observations: paths.terminal,
        core_beta_skill_reinstall_catalog_observations: paths.catalog,
        initialization_terminal_screenshot: paths.screenshot,
        initialization_continuation_surface: paths.continuationSurface,
        evidence_manifest: paths.manifest,
      },
      screenshots: { assistant_skills_reinstall_terminal: paths.screenshot },
      screenshots_flat: [paths.screenshot],
      evidence_manifest: cloneJson(manifest),
      initialization_action_observation: cloneJson(initializationActionObservation),
      ...(initializationContinuation
        ? { initialization_continuation: cloneJson(initializationContinuation) }
        : {}),
    };
    const syncEmbeddedManifest = () => { result.evidence_manifest = cloneJson(manifest); };
    return {
      root,
      caseDir,
      paths,
      result,
      action,
      confirmation,
      ledger,
      terminal,
      maintenance,
      continuationSurface,
      verdict,
      fileRecord,
      commitVerdict: () => { commitVerdict(); syncEmbeddedManifest(); },
      refreshRefsAndCommit: () => { refreshRefsAndCommit(); syncEmbeddedManifest(); },
      writeContinuationSurface: () => {
        maintenance.continuation_surface = { ...continuationSurface, file: paths.continuationSurface };
        fs.writeFileSync(paths.continuationSurface, `${JSON.stringify(continuationSurface, null, 2)}\n`);
        fs.writeFileSync(paths.maintenance, `${JSON.stringify(maintenance, null, 2)}\n`);
        refreshRefsAndCommit();
        syncEmbeddedManifest();
      },
      writeManifest: () => { writeManifest(); syncEmbeddedManifest(); },
      get manifest() { return manifest; },
    };
  };

  const buildInitializationProductFailureFixture = (id) => {
    const identities = {
      'BETA-INIT-001': {
        method: 'preparePythonRuntimes',
        testid: 'assistant-prepare-python-runtimes',
        confirmation: null,
      },
      'BETA-INIT-002': {
        method: 'runtimeResetAll',
        testid: 'assistant-runtime-reset-all',
        confirmation: {
          message: '确认全量重初始化，将清空现有运行环境并重新下载，此操作不可恢复。',
          source: 'custom-dialog',
          accepted: true,
          confirmation_label: '全量重初始化',
        },
      },
      'BETA-INIT-004': {
        method: 'sessionsPurgeAllEnvs',
        testid: 'assistant-sessions-purge',
        confirmation: {
          message: '确认清空全部会话和所有环境，此操作不可恢复。',
          source: 'custom-dialog',
          accepted: true,
          confirmation_label: '清空全部会话',
        },
      },
    };
    const identity = identities[id];
    assert.ok(identity, `unsupported initialization fixture: ${id}`);
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'qbot-init-continuation-review-'));
    evidenceRoots.push(root);
    const caseDir = path.join(root, 'cases', id);
    fs.mkdirSync(caseDir, { recursive: true });
    const paths = {
      maintenance: path.join(caseDir, `${identity.method}-readback.json`),
      action: path.join(caseDir, `${identity.method}-action-observation.json`),
      terminal: path.join(caseDir, `${identity.method}-terminal-observations.json`),
      beforePublicState: path.join(caseDir, `${identity.method}-before-public-state.json`),
      afterPublicState: path.join(caseDir, `${identity.method}-after-public-state.json`),
      surface: path.join(caseDir, 'initialization-continuation-surface.json'),
      terminalScreenshot: path.join(caseDir, `${identity.testid}-terminal.png`),
      before: path.join(caseDir, 'initialization-continuation-surface-before.png'),
      after: path.join(caseDir, 'initialization-continuation-surface-after.png'),
      manifest: path.join(caseDir, 'evidence-manifest.json'),
      report: path.join(caseDir, 'case-report.md'),
    };
    fs.writeFileSync(paths.terminalScreenshot, png1x1);
    fs.writeFileSync(paths.before, png1x1Alternative);
    fs.writeFileSync(paths.after, png1x1Third);
    fs.writeFileSync(paths.report, `# ${id}\n\n产品维护终态失败。\n`);
    const fileRecord = (file) => ({
      path: file,
      bytes: fs.statSync(file).size,
      sha256: createHash('sha256').update(fs.readFileSync(file)).digest('hex'),
    });
    const action = {
      ok: true,
      testid: identity.testid,
      before_text: '维护动作可用',
      action_text: '处理中',
      confirmation: identity.confirmation,
      busy_observed: true,
      navigation_observed: false,
      navigation_url: '',
      action_observed: true,
      action_observation_source: 'busy',
      completion_transition: '',
      busy_screenshot: '',
    };
    const actionEvidence = {
      schema_version: 'qbot-core-beta-initialization-action-evidence/v1',
      case_id: id,
      method: identity.method,
      testid: identity.testid,
      destructive: id !== 'BETA-INIT-001',
      captured_at: new Date(1).toISOString(),
      attempts: [action],
    };
    fs.writeFileSync(paths.action, `${JSON.stringify(actionEvidence, null, 2)}\n`);
    const actionObservation = {
      schema_version: 'qbot-core-beta-initialization-action-observation/v1',
      case_id: id,
      method: identity.method,
      testid: identity.testid,
      action_observed: true,
      source: 'busy',
      attempts: [{
        attempt: 1,
        action_observed: true,
        source: 'busy',
        confirmation_accepted: identity.confirmation?.accepted === true,
        confirmation_source: identity.confirmation?.source || 'none',
      }],
    };
    const publicState = {
      case_id: id,
      page: { body_text_length: 100 },
      task: { id: null, running: false, message_count: 0, send_count: 0, messages: [] },
      capabilities: { modelTiers: ['M3'] },
      skills: { selected: [] },
      connectors: { selected: [] },
      expert: null,
    };
    const beforeReadback = cloneJson(publicState);
    const afterReadback = cloneJson(publicState);
    const beforePublicStateEvidence = {
      schema_version: 'qbot-core-beta-initialization-public-state-observation/v1',
      case_id: id,
      method: identity.method,
      testid: identity.testid,
      phase: 'before-action',
      captured_at: new Date(1).toISOString(),
      public_state: beforeReadback,
    };
    const afterPublicStateEvidence = {
      schema_version: 'qbot-core-beta-initialization-public-state-observation/v1',
      case_id: id,
      method: identity.method,
      testid: identity.testid,
      phase: 'after-maintenance',
      captured_at: new Date(4).toISOString(),
      public_state: afterReadback,
    };
    fs.writeFileSync(paths.beforePublicState, `${JSON.stringify(beforePublicStateEvidence, null, 2)}\n`);
    fs.writeFileSync(paths.afterPublicState, `${JSON.stringify(afterPublicStateEvidence, null, 2)}\n`);
    const surface = {
      schema_version: 'qbot-core-beta-initialization-continuation-surface/v1',
      case_id: id,
      method: identity.method,
      testid: identity.testid,
      valid: true,
      composer_ready: true,
      workbench_ready: true,
      clean_draft_isolated: true,
      clean_draft_state: {
        available: true,
        activeId: null,
        isDraft: true,
        draftInstanceId: `draft-${id.toLowerCase()}`,
        messageCount: 0,
        sendCount: 0,
        running: false,
      },
      clean_draft_surface: { ok: true, reason: 'fixture clean draft surface' },
      capabilities_readable: true,
      public_task_clean: true,
      public_selections_clean: true,
      public_state_readable: true,
      continuation_state: {
        draft_instance_id: `draft-${id.toLowerCase()}`,
        task_id: null,
        message_count: 0,
        send_count: 0,
        running: false,
        selected_skills: [],
        selected_connectors: [],
        current_expert: null,
      },
      before_screenshot: fileRecord(paths.before),
      after_screenshot: fileRecord(paths.after),
      error: '',
      public_state: afterReadback,
    };
    const terminalKind = id === 'BETA-INIT-001'
      ? 'update'
      : id === 'BETA-INIT-004' ? 'sessions-empty' : 'runtime-ready';
    const terminalEvidence = {
      schema_version: 'qbot-core-beta-runtime-maintenance-observations/v2',
      case_id: id,
      method: identity.method,
      testid: identity.testid,
      action_evidence: fileRecord(paths.action),
      terminal_kind: terminalKind,
      timeout_ms: 600_000,
      completed_at: new Date(3).toISOString(),
      final: null,
      observations: [{
        captured_at: new Date(2).toISOString(),
        elapsed_ms: 6_000,
        read_ok: true,
        raw: {
          page_url: 'file:///fixture/ui/index.html',
          page_text: '新建任务 专家 技能 连接器 知识',
          page_body_text_length: 100,
          maintenance_region_visible: true,
          maintenance_text: '运行时失败，但本进程已加载并校验；Claude Code SDK 已就绪；Codex SDK 已就绪。',
          composer_visible: true,
          maintenance_button_enabled: true,
          sdk_statuses: [
            { family: 'claude-code', phase: 'ready' },
            { family: 'codex', phase: 'ready' },
          ],
          capabilities: { modelTiers: ['M3'] },
          sessions: [],
          reconnected: false,
        },
        reported: {
          ready: false,
          pending: false,
          failed: true,
          stable_ready_observations: id === 'BETA-INIT-004' ? 1 : 0,
          authoritative_ready_observations: 0,
          product_ui_state_conflict: false,
        },
        error: '',
      }],
    };
    terminalEvidence.final = coreBetaInitializationMaintenanceObservationsVerdict({
      ledger: terminalEvidence,
      caseId: id,
      method: identity.method,
      testid: identity.testid,
      terminalKind,
    }).replayed_final;
    const terminal = terminalEvidence.final;
    const continuation = coreBetaInitializationContinuation({
      testCase: { id },
      terminalReadback: terminal,
      afterReadback,
      continuationSurface: surface,
    });
    const maintenance = {
      schema_version: 'qbot-core-beta-runtime-maintenance-readback/v1',
      case_id: id,
      method: identity.method,
      testid: identity.testid,
      evidence_valid: true,
      oracle_valid: false,
      valid: false,
      action,
      action_attempts: [action],
      initialization_action_observation: actionObservation,
      before: beforeReadback,
      terminal,
      after: afterReadback,
      continuation_surface: { ...surface, file: paths.surface },
      initialization_continuation: continuation,
    };
    fs.writeFileSync(paths.surface, `${JSON.stringify(surface, null, 2)}\n`);
    fs.writeFileSync(paths.terminal, `${JSON.stringify(terminalEvidence, null, 2)}\n`);
    fs.writeFileSync(paths.maintenance, `${JSON.stringify(maintenance, null, 2)}\n`);
    const manifest = {
      schema_version: 'qbot-core-evidence/v2',
      case_id: id,
      generated_at: new Date(6).toISOString(),
      complete: true,
      missing_roles: [],
      invalid_roles: [],
      not_applicable_roles: [],
      evidence: [{
        role: 'core_beta_runtime_maintenance',
        ...fileRecord(paths.maintenance),
        valid: true,
        validation_error: '',
        missing: false,
      }, {
        role: 'initialization_terminal_screenshot',
        ...fileRecord(paths.terminalScreenshot),
        valid: true,
        validation_error: '',
        missing: false,
      }, {
        role: 'initialization_continuation_surface',
        ...fileRecord(paths.surface),
        valid: true,
        validation_error: '',
        missing: false,
      }, {
        role: 'initialization_action_observation',
        ...fileRecord(paths.action),
        valid: true,
        validation_error: '',
        missing: false,
      }, {
        role: 'core_beta_runtime_maintenance_observations',
        ...fileRecord(paths.terminal),
        valid: true,
        validation_error: '',
        missing: false,
      }, {
        role: 'initialization_before_public_state',
        ...fileRecord(paths.beforePublicState),
        valid: true,
        validation_error: '',
        missing: false,
      }, {
        role: 'initialization_after_public_state',
        ...fileRecord(paths.afterPublicState),
        valid: true,
        validation_error: '',
        missing: false,
      }],
    };
    fs.writeFileSync(paths.manifest, `${JSON.stringify(manifest, null, 2)}\n`);
    const result = {
      id,
      case_dir: caseDir,
      case_report: paths.report,
      status: 'failed',
      result_category: 'bug',
      scenario: '初始化维护动作产品终态失败但恢复工作台可用',
      expected_result: '维护动作成功完成。',
      actual_result: '维护动作真实执行后产品终态明确失败。',
      conclusion: '失败：产品维护终态失败。',
      steps: [{
        action: `点击 ${identity.testid}`,
        status: 'failed',
        category: 'bug',
        expected: '维护动作成功完成。',
        actual: '动作已观察，产品终态明确失败。',
      }],
      assertions: [{
        name: '初始化维护产品终态',
        status: 'failed',
        category: 'bug',
        expected: '产品维护终态成功。',
        actual: '产品维护终态 failed。',
      }],
      screenshots: {
        [`${identity.testid.replaceAll('-', '_')}_terminal`]: paths.terminalScreenshot,
        maintenance_terminal: paths.terminalScreenshot,
      },
      screenshots_flat: [paths.terminalScreenshot],
      artifacts: {
        core_beta_runtime_maintenance: paths.maintenance,
        initialization_action_observation: paths.action,
        core_beta_runtime_maintenance_observations: paths.terminal,
        initialization_before_public_state: paths.beforePublicState,
        initialization_after_public_state: paths.afterPublicState,
        initialization_terminal_screenshot: paths.terminalScreenshot,
        initialization_continuation_surface: paths.surface,
        evidence_manifest: paths.manifest,
      },
      evidence_manifest: cloneJson(manifest),
      initialization_action_observation: cloneJson(actionObservation),
      initialization_continuation: cloneJson(continuation),
    };
    return {
      root,
      caseDir,
      paths,
      result,
      maintenance,
      terminal: terminalEvidence,
      surface,
      manifest,
      fileRecord,
    };
  };

  const convertInitializationFixtureToPass = (fixture) => {
    const { result, maintenance, terminal, manifest, paths, fileRecord } = fixture;
    const readyText = '运行时完成就绪，本进程已加载并校验；Claude Code SDK 已就绪；Codex SDK 已就绪。';
    const rawTemplate = terminal.observations[0].raw;
    const stableRequired = terminal.terminal_kind === 'update' ? 2 : 3;
    terminal.observations = [1, 2, 3].map((stable, index) => ({
      captured_at: new Date(index + 2).toISOString(),
      elapsed_ms: 5_000 + (index * 1_000),
      read_ok: true,
      raw: {
        ...cloneJson(rawTemplate),
        maintenance_text: readyText,
        maintenance_button_enabled: true,
        sessions: [],
      },
      reported: {
        ready: stable >= stableRequired,
        pending: false,
        failed: false,
        stable_ready_observations: stable,
        authoritative_ready_observations: stable,
        product_ui_state_conflict: false,
      },
      error: '',
    }));
    terminal.completed_at = new Date(8).toISOString();
    terminal.final = coreBetaInitializationMaintenanceObservationsVerdict({
      ledger: terminal,
      caseId: result.id,
      method: maintenance.method,
      testid: maintenance.testid,
      terminalKind: terminal.terminal_kind,
    }).replayed_final;
    maintenance.evidence_valid = true;
    maintenance.oracle_valid = true;
    maintenance.valid = true;
    maintenance.terminal = cloneJson(terminal.final);
    delete maintenance.continuation_surface;
    delete maintenance.initialization_continuation;
    fs.writeFileSync(paths.terminal, `${JSON.stringify(terminal, null, 2)}\n`);
    fs.writeFileSync(paths.maintenance, `${JSON.stringify(maintenance, null, 2)}\n`);
    manifest.evidence = manifest.evidence.filter(
      (item) => item.role !== 'initialization_continuation_surface',
    );
    for (const [role, file] of [
      ['core_beta_runtime_maintenance', paths.maintenance],
      ['core_beta_runtime_maintenance_observations', paths.terminal],
    ]) {
      const row = manifest.evidence.find((item) => item.role === role);
      Object.assign(row, fileRecord(file), { valid: true, validation_error: '', missing: false });
    }
    fs.writeFileSync(paths.manifest, `${JSON.stringify(manifest, null, 2)}\n`);
    result.status = 'passed';
    result.result_category = 'pass';
    result.steps = result.steps.map((item) => ({ ...item, status: 'passed', category: 'pass' }));
    result.assertions = result.assertions.map((item) => ({ ...item, status: 'passed', category: 'pass' }));
    result.actual_result = '初始化维护动作成功并达到稳定终态。';
    result.conclusion = '通过';
    delete result.initialization_continuation;
    delete result.artifacts.initialization_continuation_surface;
    result.evidence_manifest = cloneJson(manifest);
    return fixture;
  };

  try {
    for (const id of ['BETA-INIT-001', 'BETA-INIT-002', 'BETA-INIT-004']) {
      const fixture = buildInitializationProductFailureFixture(id);
      const evidenceVerdict = coreBetaInitializationContinuationEvidenceVerdict(
        fixture.result,
        { runRoot: fixture.root },
      );
      assert.equal(
        evidenceVerdict.valid,
        true,
        `${id} 合法产品失败证据必须可从当前 run root 重放：${evidenceVerdict.reason}`,
      );
      assert.equal(evidenceVerdict.safe, true);
      const assessment = assessUserCenteredOutcome(fixture.result, {
        runRoot: fixture.root,
        explicitEvidence: [fixture.paths.after],
        intendedClassification: 'bug',
        reviewReason: '当前 run root 的动作、终态、恢复表面、截图和 manifest 已完整重放。',
        productObservation: '维护动作已观察，产品终态明确失败。',
        userOperationOverride: '执行初始化维护动作。',
        expectedOutcomeOverride: '维护动作应成功完成。',
        userImpactOverride: '用户无法完成对应初始化维护操作。',
      });
      assert.equal(
        assessment.classification,
        'bug',
        `${id} 完整磁盘证据的产品失败必须保留为 Bug：${assessment.reason}`,
      );
    }
    for (const id of ['BETA-INIT-001', 'BETA-INIT-002', 'BETA-INIT-004']) {
      const passingInitialization = convertInitializationFixtureToPass(
        buildInitializationProductFailureFixture(id),
      );
      const verdict = coreBetaInitializationContinuationEvidenceVerdict(
        passingInitialization.result,
        { runRoot: passingInitialization.root },
      );
      assert.equal(
        verdict.valid,
        true,
        `${id} raw pass 必须完整执行当前 run root 的磁盘语义重放：${verdict.reason}`,
      );
      assert.equal(verdict.continuation_required, false);
      assert.equal(verdict.safe, true);
    }
    const passing = buildSkillReinstallEvidenceFixture();
    const passingVerdict = coreBetaInitializationSkillReinstallEvidenceVerdict(
      passing.result,
      { runRoot: passing.root },
    );
    assert.equal(passingVerdict.valid, true, `合法 INIT-003 pass 证据必须可信：${passingVerdict.reason}`);
    assert.equal(passingVerdict.oracle_valid, true);

    const missingRunRoot = coreBetaInitializationSkillReinstallEvidenceVerdict(passing.result);
    assert.equal(missingRunRoot.valid, false, 'INIT 可信复核缺少 runRoot 时必须 fail-closed');
    assert.ok(
      missingRunRoot.reasons.includes('skill_reinstall_run_root_required'),
      `缺少 runRoot 必须暴露精确原因：${missingRunRoot.reason}`,
    );

    const forgedRawPass = buildInitializationProductFailureFixture('BETA-INIT-002');
    forgedRawPass.result.status = 'passed';
    forgedRawPass.result.result_category = 'pass';
    const forgedRawPassVerdict = coreBetaInitializationContinuationEvidenceVerdict(
      forgedRawPass.result,
      { runRoot: forgedRawPass.root },
    );
    assert.equal(forgedRawPassVerdict.valid, false, '产品失败证据不得由伪 raw pass 报告放行');
    assert.ok(
      forgedRawPassVerdict.reasons.includes('initialization_continuation_raw_result_mismatch'),
      `伪 raw pass 必须暴露结果投影不一致：${forgedRawPassVerdict.reason}`,
    );

    for (const [pathKey, refName] of [
      ['action', 'action_observations'],
      ['terminal', 'terminal_observations'],
      ['beforePublicState', 'before_public_state'],
      ['afterPublicState', 'after_public_state'],
    ]) {
      const missingIndependentEvidence = buildSkillReinstallEvidenceFixture();
      fs.unlinkSync(missingIndependentEvidence.paths[pathKey]);
      const missingVerdict = coreBetaInitializationSkillReinstallEvidenceVerdict(
        missingIndependentEvidence.result,
        { runRoot: missingIndependentEvidence.root },
      );
      assert.equal(missingVerdict.valid, false, `缺少独立 ${refName} 文件时必须 fail-closed`);
      assert.ok(
        missingVerdict.reasons.includes(`skill_reinstall_evidence_ref_invalid:${refName}`),
        `缺少 ${refName} 必须暴露精确原因：${missingVerdict.reason}`,
      );
    }

    const forgedTerminalFinal = buildSkillReinstallEvidenceFixture();
    forgedTerminalFinal.terminal.final.button_enabled = false;
    fs.writeFileSync(
      forgedTerminalFinal.paths.terminal,
      `${JSON.stringify(forgedTerminalFinal.terminal, null, 2)}\n`,
    );
    forgedTerminalFinal.refreshRefsAndCommit();
    const forgedTerminalFinalVerdict = coreBetaInitializationSkillReinstallEvidenceVerdict(
      forgedTerminalFinal.result,
      { runRoot: forgedTerminalFinal.root },
    );
    assert.equal(forgedTerminalFinalVerdict.valid, false, '原始观察不变时伪造 terminal.final 不得通过');
    assert.ok(
      forgedTerminalFinalVerdict.reasons.includes('skill_reinstall_maintenance_observations_final_replay_mismatch'),
      `伪造 terminal.final 必须由原始观察重放识别：${forgedTerminalFinalVerdict.reason}`,
    );

    for (const [label, mutate] of [
      ['稳定次数', (observation) => { observation.reported.stable_ready_observations = 99; }],
      ['runtime loaded', (observation) => { observation.raw.maintenance_text = '维护区空白'; }],
      ['SDK ready', (observation) => { observation.raw.sdk_statuses[0].phase = 'failed'; }],
      ['维护按钮', (observation) => { observation.raw.maintenance_button_enabled = false; }],
      ['capabilities', (observation) => { observation.raw.capabilities = null; }],
      ['页面 readiness', (observation) => {
        observation.raw.page_text = '';
        observation.raw.page_body_text_length = 0;
      }],
    ]) {
      const forgedReadiness = buildSkillReinstallEvidenceFixture();
      mutate(forgedReadiness.terminal.observations.at(-1));
      fs.writeFileSync(
        forgedReadiness.paths.terminal,
        `${JSON.stringify(forgedReadiness.terminal, null, 2)}\n`,
      );
      forgedReadiness.refreshRefsAndCommit();
      const forgedReadinessVerdict = coreBetaInitializationSkillReinstallEvidenceVerdict(
        forgedReadiness.result,
        { runRoot: forgedReadiness.root },
      );
      assert.equal(forgedReadinessVerdict.valid, false, `伪造 ${label} 投影不得通过`);
      assert.ok(
        forgedReadinessVerdict.reasons.includes(
          'skill_reinstall_maintenance_observation_3_reported_projection_mismatch',
        ),
        `伪造 ${label} 必须由逐次原始观察重算识别：${forgedReadinessVerdict.reason}`,
      );
    }

    const forgedMaintenanceProjection = buildSkillReinstallEvidenceFixture();
    forgedMaintenanceProjection.maintenance.terminal.button_enabled = false;
    fs.writeFileSync(
      forgedMaintenanceProjection.paths.maintenance,
      `${JSON.stringify(forgedMaintenanceProjection.maintenance, null, 2)}\n`,
    );
    forgedMaintenanceProjection.refreshRefsAndCommit();
    const forgedMaintenanceVerdict = coreBetaInitializationSkillReinstallEvidenceVerdict(
      forgedMaintenanceProjection.result,
      { runRoot: forgedMaintenanceProjection.root },
    );
    assert.equal(forgedMaintenanceVerdict.valid, false, '只篡改 maintenance 内嵌终态不得通过');
    assert.ok(
      forgedMaintenanceVerdict.reasons.includes('skill_reinstall_terminal_projection_mismatch'),
      `maintenance 内嵌投影必须与原始观察重放全等：${forgedMaintenanceVerdict.reason}`,
    );

    const productBug = buildSkillReinstallEvidenceFixture({
      afterCatalog: initializationCatalogPythonFailure,
      catalogs: Array(3).fill(initializationCatalogPythonFailure),
    });
    const productBugVerdict = coreBetaInitializationSkillReinstallEvidenceVerdict(
      productBug.result,
      { runRoot: productBug.root },
    );
    assert.equal(productBugVerdict.valid, true, `readiness 产品失败证据必须可信：${productBugVerdict.reason}`);
    assert.equal(productBugVerdict.oracle_valid, false);
    assert.equal(productBugVerdict.outcome, 'bug');
    const productBugContinuationVerdict = coreBetaInitializationContinuationEvidenceVerdict(
      productBug.result,
      { runRoot: productBug.root },
    );
    assert.equal(
      productBugContinuationVerdict.valid,
      true,
      `合法 INIT-003 产品失败的通用连续性证据必须可从当前 run root 重放：${productBugContinuationVerdict.reason}`,
    );
    assert.equal(productBugContinuationVerdict.safe, true);
    Object.assign(productBug.result, {
      scenario: '一键重装 Skill 后产品 readiness 失败',
      expected_result: '重装后安装 identity 保持一致且全部 Skill ready。',
      steps: [{
        action: '点击并确认一键重装 Skill',
        status: 'failed',
        category: 'bug',
        expected: '产品完成重装并恢复 ready。',
        actual: '动作已执行，但安装项进入 python_runtime_failed。',
      }],
      assertions: [{
        name: 'Skill 重装 readiness',
        status: 'failed',
        category: 'bug',
        expected: '全部安装项进入 ready。',
        actual: '安装项进入 python_runtime_failed。',
      }],
      screenshots: { maintenance_terminal: productBug.paths.continuationAfter },
      screenshots_flat: [productBug.paths.continuationAfter],
      actual_result: '一键重装动作已执行，产品终态存在 python_runtime_failed。',
      conclusion: '失败：Skill 重装 readiness 未通过。',
    });
    const productBugAssessment = assessUserCenteredOutcome(productBug.result, {
      runRoot: productBug.root,
      explicitEvidence: [productBug.paths.continuationAfter],
      intendedClassification: 'bug',
      reviewReason: '当前 run root 的动作、维护终态、恢复表面、截图和 manifest 已完整重放。',
      productObservation: '一键重装后安装项进入 python_runtime_failed。',
      userOperationOverride: '点击并确认一键重装 Skill。',
      expectedOutcomeOverride: '重装完成后全部安装项应恢复 ready。',
      userImpactOverride: '用户无法使用依赖该运行时的 Skill。',
    });
    assert.equal(
      productBugAssessment.classification,
      'bug',
      `完整磁盘证据的 INIT-003 产品失败必须保留为 Bug：${productBugAssessment.reason}`,
    );

    const detachedEvidence = buildSkillReinstallEvidenceFixture();
    const trustedRunRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'qbot-init-003-run-root-'));
    evidenceRoots.push(trustedRunRoot);
    fs.mkdirSync(path.join(trustedRunRoot, 'cases'));
    const detachedVerdict = coreBetaInitializationSkillReinstallEvidenceVerdict(
      detachedEvidence.result,
      { runRoot: trustedRunRoot },
    );
    assert.equal(
      detachedVerdict.valid,
      false,
      '另一棵完整且内部自洽的 Case 证据树不得冒充当前 run root 的 INIT-003 证据',
    );
    assert.ok(
      detachedVerdict.reasons.includes('skill_reinstall_case_dir_run_root_binding_invalid'),
      `detached caseDir 必须暴露 run-root 绑定原因：${detachedVerdict.reason}`,
    );

    const unobserved = buildSkillReinstallEvidenceFixture({ actionObserved: false });
    assert.equal(coreBetaInitializationSkillReinstallEvidenceVerdict(unobserved.result).valid, false);

    const emptyObjectEvidence = buildSkillReinstallEvidenceFixture();
    fs.writeFileSync(emptyObjectEvidence.paths.maintenance, '{}\n');
    emptyObjectEvidence.refreshRefsAndCommit();
    assert.equal(
      coreBetaInitializationSkillReinstallEvidenceVerdict(emptyObjectEvidence.result).valid,
      false,
      '原始 maintenance 引用即便重算 SHA 与 manifest，空对象仍不得通过',
    );

    const forgedFailureLists = buildSkillReinstallEvidenceFixture();
    forgedFailureLists.verdict.evidence_failures = ['forged_failure'];
    forgedFailureLists.commitVerdict();
    assert.equal(coreBetaInitializationSkillReinstallEvidenceVerdict(forgedFailureLists.result).valid, false);

    const tamperedOriginal = buildSkillReinstallEvidenceFixture();
    tamperedOriginal.ledger.observations[1].raw_catalog = catalogB;
    fs.writeFileSync(tamperedOriginal.paths.catalog, `${JSON.stringify(tamperedOriginal.ledger, null, 2)}\n`);
    const tamperedRecomputed = coreBetaInitializationSkillReinstallVerdict({
      beforeCatalog: initializationCatalogBefore,
      afterCatalog: initializationCatalogAfter,
      afterIdleStableObservations: tamperedOriginal.ledger.idle_stable_observations,
      catalogObservations: tamperedOriginal.ledger,
    });
    Object.assign(tamperedOriginal.verdict, tamperedRecomputed);
    tamperedOriginal.maintenance.skill_reinstall_readiness_verdict = tamperedRecomputed;
    fs.writeFileSync(tamperedOriginal.paths.maintenance, `${JSON.stringify(tamperedOriginal.maintenance, null, 2)}\n`);
    tamperedOriginal.result.status = 'failed';
    tamperedOriginal.result.result_category = 'automation_error';
    tamperedOriginal.refreshRefsAndCommit();
    assert.equal(
      coreBetaInitializationSkillReinstallEvidenceVerdict(tamperedOriginal.result).valid,
      false,
      '篡改原始样本后即便重算引用 SHA、verdict 与 manifest，证据错误仍必须 fail-closed',
    );

    const abaEvidence = buildSkillReinstallEvidenceFixture({ catalogs: [catalogA, catalogB, catalogA] });
    assert.equal(coreBetaInitializationSkillReinstallEvidenceVerdict(abaEvidence.result).valid, false);
    const beforeReadinessMissing = buildSkillReinstallEvidenceFixture({
      beforeCatalog: initializationCatalogBeforeMissingReadiness,
    });
    assert.equal(coreBetaInitializationSkillReinstallEvidenceVerdict(beforeReadinessMissing.result).valid, false);
    const catalogReadError = buildSkillReinstallEvidenceFixture({
      catalogs: [null, catalogA, catalogA, catalogA],
      readErrorIndexes: [0],
    });
    assert.equal(coreBetaInitializationSkillReinstallEvidenceVerdict(catalogReadError.result).valid, false);
    const insufficientStable = buildSkillReinstallEvidenceFixture({ catalogs: [catalogA, catalogA] });
    assert.equal(coreBetaInitializationSkillReinstallEvidenceVerdict(insufficientStable.result).valid, false);

    const missingContinuationSurface = buildSkillReinstallEvidenceFixture();
    fs.unlinkSync(missingContinuationSurface.paths.continuationSurface);
    assert.equal(
      coreBetaInitializationSkillReinstallEvidenceVerdict(missingContinuationSurface.result).valid,
      false,
      'INIT-003 缺少 continuation surface 文件时必须 fail-closed',
    );

    const forgedTaskState = buildSkillReinstallEvidenceFixture();
    forgedTaskState.continuationSurface.public_state.task.id = 'forged-task-id';
    forgedTaskState.continuationSurface.continuation_state.task_id = 'forged-task-id';
    forgedTaskState.writeContinuationSurface();
    assert.equal(
      coreBetaInitializationSkillReinstallEvidenceVerdict(forgedTaskState.result).valid,
      false,
      '即便重算 surface、verdict 和 manifest SHA，非空 taskId 仍不得通过',
    );

    const residualSelection = buildSkillReinstallEvidenceFixture();
    residualSelection.continuationSurface.public_state.skills.selected = [{ slug: 'residual-skill' }];
    residualSelection.continuationSurface.continuation_state.selected_skills = [{ slug: 'residual-skill' }];
    residualSelection.writeContinuationSurface();
    assert.equal(
      coreBetaInitializationSkillReinstallEvidenceVerdict(residualSelection.result).valid,
      false,
      '恢复后的 Skill/Connector/Expert 任一残留即使自报 clean 也必须被语义重放拒绝',
    );

    const emptyDraftInstance = buildSkillReinstallEvidenceFixture();
    emptyDraftInstance.continuationSurface.clean_draft_state.draftInstanceId = '';
    emptyDraftInstance.continuationSurface.continuation_state.draft_instance_id = '';
    emptyDraftInstance.writeContinuationSurface();
    assert.equal(
      coreBetaInitializationSkillReinstallEvidenceVerdict(emptyDraftInstance.result).valid,
      false,
      '恢复 surface 的 draftInstanceId 为空时不得形成可信初始化结论',
    );

    const screenshotShaDrift = buildSkillReinstallEvidenceFixture();
    fs.appendFileSync(screenshotShaDrift.paths.continuationAfter, Buffer.from([1]));
    assert.equal(
      coreBetaInitializationSkillReinstallEvidenceVerdict(screenshotShaDrift.result).valid,
      false,
      'surface 固化后替换截图字节必须因 bytes/SHA 漂移而 fail-closed',
    );

    const disguisedOversizeJson = buildSkillReinstallEvidenceFixture();
    const disguisedMaintenancePath = path.join(
      disguisedOversizeJson.caseDir,
      'maintenance-readback-disguised-as-png.png',
    );
    fs.writeFileSync(disguisedMaintenancePath, `${JSON.stringify({
      ...disguisedOversizeJson.maintenance,
      padding: 'x'.repeat(16 * 1024 * 1024),
    })}\n`);
    fs.unlinkSync(disguisedOversizeJson.paths.maintenance);
    disguisedOversizeJson.paths.maintenance = disguisedMaintenancePath;
    disguisedOversizeJson.result.artifacts.core_beta_runtime_maintenance = disguisedMaintenancePath;
    disguisedOversizeJson.refreshRefsAndCommit();
    assert.ok(fs.statSync(disguisedMaintenancePath).size > 16 * 1024 * 1024);
    const disguisedOversizeJsonVerdict = coreBetaInitializationSkillReinstallEvidenceVerdict(
      disguisedOversizeJson.result,
      { runRoot: disguisedOversizeJson.root },
    );
    assert.equal(
      disguisedOversizeJsonVerdict.valid,
      false,
      'JSON 角色即使使用 .png 文件名也不得绕过 16 MiB 上限',
    );
    assert.ok(
      disguisedOversizeJsonVerdict.reasons.includes('skill_reinstall_evidence_ref_invalid:maintenance_readback'),
      `伪装扩展名的超限 JSON 必须按 semanticRole 拒绝：${disguisedOversizeJsonVerdict.reason}`,
    );

    const oversizePng = buildSkillReinstallEvidenceFixture();
    fs.truncateSync(oversizePng.paths.screenshot, (32 * 1024 * 1024) + 1);
    oversizePng.refreshRefsAndCommit();
    assert.ok(fs.statSync(oversizePng.paths.screenshot).size > 32 * 1024 * 1024);
    const oversizePngVerdict = coreBetaInitializationSkillReinstallEvidenceVerdict(
      oversizePng.result,
      { runRoot: oversizePng.root },
    );
    assert.equal(oversizePngVerdict.valid, false, 'PNG 角色超过 32 MiB 时必须在读取前 fail-closed');
    assert.ok(
      oversizePngVerdict.reasons.includes('skill_reinstall_evidence_ref_invalid:terminal_screenshot'),
      `超限 PNG 必须暴露证据引用无效：${oversizePngVerdict.reason}`,
    );

    const reusedJsonPath = buildSkillReinstallEvidenceFixture();
    reusedJsonPath.paths.beforePublicState = reusedJsonPath.paths.action;
    reusedJsonPath.result.artifacts.initialization_before_public_state = reusedJsonPath.paths.action;
    reusedJsonPath.refreshRefsAndCommit();
    assert.equal(
      coreBetaInitializationSkillReinstallEvidenceVerdict(
        reusedJsonPath.result,
        { runRoot: reusedJsonPath.root },
      ).valid,
      false,
      '同一 JSON 文件不得跨 action/before-public-state 角色复用',
    );

    const reusedJsonInode = buildSkillReinstallEvidenceFixture();
    fs.unlinkSync(reusedJsonInode.paths.beforePublicState);
    fs.linkSync(reusedJsonInode.paths.action, reusedJsonInode.paths.beforePublicState);
    reusedJsonInode.refreshRefsAndCommit();
    assert.equal(
      coreBetaInitializationSkillReinstallEvidenceVerdict(
        reusedJsonInode.result,
        { runRoot: reusedJsonInode.root },
      ).valid,
      false,
      '不同路径指向同一 JSON inode 时不得跨角色复用',
    );

    const renamedMaintenanceManifestRole = buildSkillReinstallEvidenceFixture();
    renamedMaintenanceManifestRole.manifest.evidence.find(
      (item) => item.role === 'core_beta_runtime_maintenance',
    ).role = 'maintenance_readback';
    fs.writeFileSync(
      renamedMaintenanceManifestRole.paths.manifest,
      `${JSON.stringify(renamedMaintenanceManifestRole.manifest, null, 2)}\n`,
    );
    renamedMaintenanceManifestRole.result.evidence_manifest = cloneJson(
      renamedMaintenanceManifestRole.manifest,
    );
    assert.equal(
      coreBetaInitializationSkillReinstallEvidenceVerdict(
        renamedMaintenanceManifestRole.result,
        { runRoot: renamedMaintenanceManifestRole.root },
      ).valid,
      false,
      'maintenance manifest 角色改名后不得由路径与 SHA 自洽绕过',
    );

    for (const [field, value] of [['valid', false], ['missing', true]]) {
      const invalidSurfaceManifest = buildSkillReinstallEvidenceFixture();
      invalidSurfaceManifest.manifest.evidence.find(
        (item) => item.role === 'initialization_continuation_surface',
      )[field] = value;
      fs.writeFileSync(
        invalidSurfaceManifest.paths.manifest,
        `${JSON.stringify(invalidSurfaceManifest.manifest, null, 2)}\n`,
      );
      invalidSurfaceManifest.result.evidence_manifest = cloneJson(invalidSurfaceManifest.manifest);
      assert.equal(
        coreBetaInitializationSkillReinstallEvidenceVerdict(
          invalidSurfaceManifest.result,
          { runRoot: invalidSurfaceManifest.root },
        ).valid,
        false,
        `continuation surface manifest ${field} 欺骗必须 fail-closed`,
      );
    }

    const assertInvalidContinuationPng = (mutate, message) => {
      const fixture = buildSkillReinstallEvidenceFixture();
      fs.writeFileSync(
        fixture.paths.continuationAfter,
        mutate(fs.readFileSync(fixture.paths.continuationAfter)),
      );
      fixture.continuationSurface.after_screenshot = fixture.fileRecord(
        fixture.paths.continuationAfter,
      );
      fixture.writeContinuationSurface();
      const verdict = coreBetaInitializationSkillReinstallEvidenceVerdict(
        fixture.result,
        { runRoot: fixture.root },
      );
      assert.equal(verdict.valid, false, message);
      assert.ok(
        verdict.reasons.includes('skill_reinstall_continuation_after_screenshot_invalid'),
        `${message}: ${verdict.reason}`,
      );
    };
    assertInvalidContinuationPng(
      (png) => png.subarray(0, png.length - 1),
      '截断 PNG 即使重新固化 bytes/SHA 也必须被完整性校验拒绝',
    );
    assertInvalidContinuationPng(
      (png) => {
        const changed = Buffer.from(png);
        changed[changed.length - 1] ^= 1;
        return changed;
      },
      'CRC 错误 PNG 即使重新固化 bytes/SHA 也必须被拒绝',
    );
    assertInvalidContinuationPng(
      (png) => replaceFirstPngChunk(png, 'IDAT', (data) => Buffer.alloc(data.length)),
      'CRC 合法但无法 inflate 的 IDAT 不得作为截图证据',
    );
    for (const [label, mutate] of [
      ['非法 bitDepth/colorType 组合', (data) => { data[8] = 4; return data; }],
      ['非法 compression method', (data) => { data[10] = 1; return data; }],
      ['非法 filter method', (data) => { data[11] = 1; return data; }],
      ['不支持的 interlace method', (data) => { data[12] = 1; return data; }],
    ]) {
      assertInvalidContinuationPng(
        (png) => replaceFirstPngChunk(png, 'IHDR', mutate),
        `${label}不得作为截图证据`,
      );
    }
    assertInvalidContinuationPng(
      (png) => insertPngChunkBefore(png, 'IDAT', 'ABCD'),
      '未知 critical chunk 不得作为截图证据',
    );
    assertInvalidContinuationPng(
      (png) => insertPngChunkBefore(png, 'IDAT', 'A1CD'),
      '包含非字母字符的 chunk type 不得作为截图证据',
    );
    assertInvalidContinuationPng(
      (png) => insertPngChunkBefore(png, 'IDAT', 'tExt'),
      'reserved bit 非法的 chunk type 不得作为截图证据',
    );
    assertInvalidContinuationPng(
      (png) => insertPngChunkBefore(png, 'IDAT', 'PLTE', Buffer.from([0, 0, 0])),
      '灰度 alpha PNG 不允许出现 PLTE',
    );
    assertInvalidContinuationPng(
      (png) => replaceFirstPngChunk(png, 'IHDR', (data) => {
        data[8] = 8;
        data[9] = 3;
        return data;
      }),
      'indexed-color PNG 缺少 PLTE 不得作为截图证据',
    );
    assertInvalidContinuationPng(
      (png) => insertPngChunkBefore(png, 'IDAT', 'IHDR', png.subarray(16, 29)),
      '重复 IHDR 不得作为截图证据',
    );
    assertInvalidContinuationPng(
      (png) => insertPngChunkBefore(png, 'IEND', 'IEND'),
      '重复或非末尾 IEND 不得作为截图证据',
    );
    assertInvalidContinuationPng(
      splitIdatWithAncillaryChunk,
      'IDAT 序列被 ancillary chunk 打断时不得作为截图证据',
    );
    assertInvalidContinuationPng(
      (png) => replaceFirstPngChunk(png, 'IDAT', () => deflateSync(Buffer.from([5, 0, 0]))),
      '解压后行 filter byte 超出 0..4 不得作为截图证据',
    );
    assertInvalidContinuationPng(
      (png) => replaceFirstPngChunk(png, 'IDAT', () => deflateSync(Buffer.from([0, 0]))),
      '解压后 scanline 长度不等于 IHDR 推导长度不得作为截图证据',
    );
    assertInvalidContinuationPng(
      (png) => replaceFirstPngChunk(png, 'IHDR', (data) => {
        data.writeUInt32BE(16_385, 0);
        return data;
      }),
      'PNG 任一维度超过 16384 时必须在解码前拒绝',
    );
    assertInvalidContinuationPng(
      (png) => replaceFirstPngChunk(png, 'IHDR', (data) => {
        data.writeUInt32BE(8_192, 0);
        data.writeUInt32BE(4_097, 4);
        return data;
      }),
      'PNG 总像素超过 32 MiPixels 时必须在解码前拒绝',
    );
    assertInvalidContinuationPng(
      (png) => replaceFirstPngChunk(png, 'IHDR', (data) => {
        data.writeUInt32BE(8_192, 0);
        data.writeUInt32BE(4_096, 4);
        data[8] = 16;
        data[9] = 6;
        return data;
      }),
      'PNG 推导解码字节超过 128 MiB 时必须在 inflate 前拒绝',
    );
    assertInvalidContinuationPng(
      (png) => insertRepeatedPngChunksBefore(png, 'IDAT', 4_096),
      'PNG chunk 数超过 4096 时必须有界拒绝',
    );

    const reusedScreenshotContent = buildSkillReinstallEvidenceFixture();
    fs.copyFileSync(
      reusedScreenshotContent.paths.continuationBefore,
      reusedScreenshotContent.paths.continuationAfter,
    );
    reusedScreenshotContent.continuationSurface.after_screenshot = reusedScreenshotContent.fileRecord(
      reusedScreenshotContent.paths.continuationAfter,
    );
    reusedScreenshotContent.writeContinuationSurface();
    const reusedScreenshotVerdict = coreBetaInitializationSkillReinstallEvidenceVerdict(
      reusedScreenshotContent.result,
      { runRoot: reusedScreenshotContent.root },
    );
    assert.equal(reusedScreenshotVerdict.valid, false);
    assert.ok(
      reusedScreenshotVerdict.reasons.includes('skill_reinstall_continuation_screenshot_content_reused'),
      `前后截图内容相同必须被拒绝：${reusedScreenshotVerdict.reason}`,
    );

    const reusedContinuationPath = buildSkillReinstallEvidenceFixture();
    reusedContinuationPath.continuationSurface.after_screenshot = cloneJson(
      reusedContinuationPath.continuationSurface.before_screenshot,
    );
    reusedContinuationPath.writeContinuationSurface();
    assert.equal(
      coreBetaInitializationSkillReinstallEvidenceVerdict(
        reusedContinuationPath.result,
        { runRoot: reusedContinuationPath.root },
      ).valid,
      false,
      'continuation before/after 使用同一路径时必须拒绝',
    );

    const reusedContinuationInode = buildSkillReinstallEvidenceFixture();
    fs.unlinkSync(reusedContinuationInode.paths.continuationAfter);
    fs.linkSync(
      reusedContinuationInode.paths.continuationBefore,
      reusedContinuationInode.paths.continuationAfter,
    );
    reusedContinuationInode.continuationSurface.after_screenshot = reusedContinuationInode.fileRecord(
      reusedContinuationInode.paths.continuationAfter,
    );
    reusedContinuationInode.writeContinuationSurface();
    assert.equal(
      coreBetaInitializationSkillReinstallEvidenceVerdict(
        reusedContinuationInode.result,
        { runRoot: reusedContinuationInode.root },
      ).valid,
      false,
      'continuation before/after 不同路径硬链接到同一 inode 时必须拒绝',
    );

    for (const [surfaceField, pathKey, label] of [
      ['before_screenshot', 'continuationBefore', 'before'],
      ['after_screenshot', 'continuationAfter', 'after'],
    ]) {
      const reusedTerminalPath = buildSkillReinstallEvidenceFixture();
      reusedTerminalPath.continuationSurface[surfaceField] = cloneJson(
        reusedTerminalPath.verdict.evidence_refs.terminal_screenshot,
      );
      reusedTerminalPath.writeContinuationSurface();
      const reusedTerminalPathVerdict = coreBetaInitializationSkillReinstallEvidenceVerdict(
        reusedTerminalPath.result,
        { runRoot: reusedTerminalPath.root },
      );
      assert.equal(reusedTerminalPathVerdict.valid, false, `terminal/${label} 同路径复用必须拒绝`);
      assert.ok(
        reusedTerminalPathVerdict.reasons.includes(`skill_reinstall_terminal_${label}_screenshot_path_reused`),
        `terminal/${label} 同路径复用必须暴露精确原因：${reusedTerminalPathVerdict.reason}`,
      );

      const reusedTerminalInode = buildSkillReinstallEvidenceFixture();
      fs.unlinkSync(reusedTerminalInode.paths[pathKey]);
      fs.linkSync(reusedTerminalInode.paths.screenshot, reusedTerminalInode.paths[pathKey]);
      reusedTerminalInode.continuationSurface[surfaceField] = reusedTerminalInode.fileRecord(
        reusedTerminalInode.paths[pathKey],
      );
      reusedTerminalInode.writeContinuationSurface();
      assert.equal(
        coreBetaInitializationSkillReinstallEvidenceVerdict(
          reusedTerminalInode.result,
          { runRoot: reusedTerminalInode.root },
        ).valid,
        false,
        `terminal/${label} 不同路径硬链接到同一 inode 时必须拒绝`,
      );

      const reusedTerminalContent = buildSkillReinstallEvidenceFixture();
      fs.copyFileSync(reusedTerminalContent.paths.screenshot, reusedTerminalContent.paths[pathKey]);
      reusedTerminalContent.continuationSurface[surfaceField] = reusedTerminalContent.fileRecord(
        reusedTerminalContent.paths[pathKey],
      );
      reusedTerminalContent.writeContinuationSurface();
      const reusedTerminalContentVerdict = coreBetaInitializationSkillReinstallEvidenceVerdict(
        reusedTerminalContent.result,
        { runRoot: reusedTerminalContent.root },
      );
      assert.equal(reusedTerminalContentVerdict.valid, false, `terminal/${label} 内容复用必须拒绝`);
      assert.ok(
        reusedTerminalContentVerdict.reasons.includes(`skill_reinstall_terminal_${label}_screenshot_content_reused`),
        `terminal/${label} 内容复用必须暴露精确原因：${reusedTerminalContentVerdict.reason}`,
      );
    }

    const missingSurfaceManifestRole = buildSkillReinstallEvidenceFixture();
    missingSurfaceManifestRole.manifest.evidence = missingSurfaceManifestRole.manifest.evidence
      .filter((item) => item.role !== 'initialization_continuation_surface');
    fs.writeFileSync(
      missingSurfaceManifestRole.paths.manifest,
      `${JSON.stringify(missingSurfaceManifestRole.manifest, null, 2)}\n`,
    );
    missingSurfaceManifestRole.result.evidence_manifest = cloneJson(missingSurfaceManifestRole.manifest);
    assert.equal(
      coreBetaInitializationSkillReinstallEvidenceVerdict(missingSurfaceManifestRole.result).valid,
      false,
      'manifest 缺少 initialization_continuation_surface 专项角色时必须 fail-closed',
    );

    const symlinkEvidence = buildSkillReinstallEvidenceFixture();
    const terminalTarget = path.join(symlinkEvidence.caseDir, 'terminal-target.json');
    fs.copyFileSync(symlinkEvidence.paths.terminal, terminalTarget);
    fs.unlinkSync(symlinkEvidence.paths.terminal);
    fs.symlinkSync(terminalTarget, symlinkEvidence.paths.terminal);
    assert.equal(coreBetaInitializationSkillReinstallEvidenceVerdict(symlinkEvidence.result).valid, false);

    const traversalEvidence = buildSkillReinstallEvidenceFixture();
    const outsideCatalog = path.join(traversalEvidence.root, 'outside-catalog.json');
    fs.copyFileSync(traversalEvidence.paths.catalog, outsideCatalog);
    traversalEvidence.verdict.evidence_refs.catalog_observations = traversalEvidence.fileRecord(outsideCatalog);
    traversalEvidence.commitVerdict();
    assert.equal(coreBetaInitializationSkillReinstallEvidenceVerdict(traversalEvidence.result).valid, false);

    const emptyEvidence = buildSkillReinstallEvidenceFixture();
    fs.writeFileSync(emptyEvidence.paths.catalog, '');
    emptyEvidence.verdict.evidence_refs.catalog_observations = emptyEvidence.fileRecord(emptyEvidence.paths.catalog);
    emptyEvidence.commitVerdict();
    assert.equal(coreBetaInitializationSkillReinstallEvidenceVerdict(emptyEvidence.result).valid, false);

    const duplicateRole = buildSkillReinstallEvidenceFixture();
    duplicateRole.manifest.evidence.push(cloneJson(duplicateRole.manifest.evidence[0]));
    fs.writeFileSync(duplicateRole.paths.manifest, `${JSON.stringify(duplicateRole.manifest, null, 2)}\n`);
    duplicateRole.result.evidence_manifest = cloneJson(duplicateRole.manifest);
    assert.equal(coreBetaInitializationSkillReinstallEvidenceVerdict(duplicateRole.result).valid, false);

    const duplicateSurfaceRole = buildSkillReinstallEvidenceFixture();
    duplicateSurfaceRole.manifest.evidence.push(cloneJson(
      duplicateSurfaceRole.manifest.evidence.find((item) => item.role === 'initialization_continuation_surface'),
    ));
    fs.writeFileSync(
      duplicateSurfaceRole.paths.manifest,
      `${JSON.stringify(duplicateSurfaceRole.manifest, null, 2)}\n`,
    );
    duplicateSurfaceRole.result.evidence_manifest = cloneJson(duplicateSurfaceRole.manifest);
    assert.equal(coreBetaInitializationSkillReinstallEvidenceVerdict(duplicateSurfaceRole.result).valid, false);

    const embeddedManifestDrift = buildSkillReinstallEvidenceFixture();
    embeddedManifestDrift.result.evidence_manifest.generated_at = new Date(99).toISOString();
    assert.equal(coreBetaInitializationSkillReinstallEvidenceVerdict(embeddedManifestDrift.result).valid, false);

    const cachedEvidence = buildSkillReinstallEvidenceFixture();
    const validationSession = {
      fileCache: new Map(),
      inodeRoles: new Map(),
      roleInodes: new Map(),
    };
    const cachedFirstVerdict = coreBetaInitializationSkillReinstallEvidenceVerdict(
      cachedEvidence.result,
      { runRoot: cachedEvidence.root, evidenceSession: validationSession },
    );
    assert.equal(cachedFirstVerdict.valid, true, `缓存前合法证据必须通过：${cachedFirstVerdict.reason}`);
    const cachedCatalogBytes = fs.readFileSync(cachedEvidence.paths.catalog);
    cachedCatalogBytes[cachedCatalogBytes.length - 1] = 0x20;
    fs.writeFileSync(cachedEvidence.paths.catalog, cachedCatalogBytes);
    fs.utimesSync(cachedEvidence.paths.catalog, new Date(), new Date(Date.now() + 5_000));
    const cachedSecondVerdict = coreBetaInitializationSkillReinstallEvidenceVerdict(
      cachedEvidence.result,
      { runRoot: cachedEvidence.root, evidenceSession: validationSession },
    );
    assert.equal(cachedSecondVerdict.valid, false, '缓存命中后原位替换证据不得复用冻结字节放行');

    const replaceBeforeFinalize = buildSkillReinstallEvidenceFixture();
    const finalCatalogBytes = fs.readFileSync(replaceBeforeFinalize.paths.catalog);
    let finalReplacementApplied = false;
    Object.defineProperty(replaceBeforeFinalize.result, 'status', {
      configurable: true,
      enumerable: true,
      get() {
        if (!finalReplacementApplied) {
          finalReplacementApplied = true;
          finalCatalogBytes[finalCatalogBytes.length - 1] = 0x20;
          fs.writeFileSync(replaceBeforeFinalize.paths.catalog, finalCatalogBytes);
          fs.utimesSync(
            replaceBeforeFinalize.paths.catalog,
            new Date(),
            new Date(Date.now() + 5_000),
          );
        }
        return 'passed';
      },
    });
    const replaceBeforeFinalizeVerdict = coreBetaInitializationSkillReinstallEvidenceVerdict(
      replaceBeforeFinalize.result,
      { runRoot: replaceBeforeFinalize.root },
    );
    assert.equal(finalReplacementApplied, true, '最终返回前替换攻击夹具必须实际触发');
    assert.equal(replaceBeforeFinalizeVerdict.valid, false, '最终返回前替换已读取证据必须 fail-closed');
    assert.ok(
      replaceBeforeFinalizeVerdict.reasons.includes('skill_reinstall_evidence_identity_drift'),
      `最终返回前替换必须由会话终态复核识别：${replaceBeforeFinalizeVerdict.reason}`,
    );

    for (const [label, targetFromFixture] of [
      ['run root', (fixture) => fixture.root],
      ['cases directory', (fixture) => path.join(fixture.root, 'cases')],
      ['case directory', (fixture) => fixture.caseDir],
    ]) {
      const directoryModeDrift = buildSkillReinstallEvidenceFixture();
      const target = targetFromFixture(directoryModeDrift);
      const originalMode = fs.statSync(target).mode & 0o777;
      let driftApplied = false;
      Object.defineProperty(directoryModeDrift.result, 'status', {
        configurable: true,
        enumerable: true,
        get() {
          if (!driftApplied) {
            driftApplied = true;
            fs.chmodSync(target, 0o777);
          }
          return 'passed';
        },
      });
      let directoryModeDriftVerdict;
      try {
        directoryModeDriftVerdict = coreBetaInitializationSkillReinstallEvidenceVerdict(
          directoryModeDrift.result,
          { runRoot: directoryModeDrift.root },
        );
      } finally {
        fs.chmodSync(target, originalMode);
      }
      assert.equal(driftApplied, true, `${label} 权限漂移攻击夹具必须实际触发`);
      assert.equal(directoryModeDriftVerdict.valid, false, `${label} 复核末段权限漂移必须 fail-closed`);
      assert.ok(
        directoryModeDriftVerdict.reasons.includes('skill_reinstall_evidence_identity_drift'),
        `${label} 权限漂移必须由会话终态复核识别：${directoryModeDriftVerdict.reason}`,
      );
    }

    const nestedDirectoryModeDrift = buildSkillReinstallEvidenceFixture();
    const nestedDirectory = path.join(nestedDirectoryModeDrift.caseDir, 'nested-evidence');
    fs.mkdirSync(nestedDirectory);
    const nestedCatalog = path.join(nestedDirectory, path.basename(nestedDirectoryModeDrift.paths.catalog));
    fs.renameSync(nestedDirectoryModeDrift.paths.catalog, nestedCatalog);
    nestedDirectoryModeDrift.paths.catalog = nestedCatalog;
    nestedDirectoryModeDrift.result.artifacts.core_beta_skill_reinstall_catalog_observations = nestedCatalog;
    nestedDirectoryModeDrift.refreshRefsAndCommit();
    let nestedModeDriftApplied = false;
    Object.defineProperty(nestedDirectoryModeDrift.result, 'status', {
      configurable: true,
      enumerable: true,
      get() {
        if (!nestedModeDriftApplied) {
          nestedModeDriftApplied = true;
          fs.chmodSync(nestedDirectory, 0o777);
        }
        return 'passed';
      },
    });
    let nestedDirectoryModeDriftVerdict;
    try {
      nestedDirectoryModeDriftVerdict = coreBetaInitializationSkillReinstallEvidenceVerdict(
        nestedDirectoryModeDrift.result,
        { runRoot: nestedDirectoryModeDrift.root },
      );
    } finally {
      fs.chmodSync(nestedDirectory, 0o755);
    }
    assert.equal(nestedModeDriftApplied, true, '中间目录权限漂移攻击夹具必须实际触发');
    assert.equal(nestedDirectoryModeDriftVerdict.valid, false, '中间证据目录权限漂移必须 fail-closed');
    assert.ok(
      nestedDirectoryModeDriftVerdict.reasons.includes('skill_reinstall_evidence_identity_drift'),
      `中间目录漂移必须由 directoryCache 终态复核识别：${nestedDirectoryModeDriftVerdict.reason}`,
    );

    const nestedDirectorySwap = buildSkillReinstallEvidenceFixture();
    const nestedSwapDirectory = path.join(nestedDirectorySwap.caseDir, 'nested-swap-evidence');
    const displacedNestedSwapDirectory = path.join(
      nestedDirectorySwap.caseDir,
      'nested-swap-evidence-displaced',
    );
    fs.mkdirSync(nestedSwapDirectory);
    const nestedSwapCatalog = path.join(nestedSwapDirectory, path.basename(nestedDirectorySwap.paths.catalog));
    fs.renameSync(nestedDirectorySwap.paths.catalog, nestedSwapCatalog);
    nestedDirectorySwap.paths.catalog = nestedSwapCatalog;
    nestedDirectorySwap.result.artifacts.core_beta_skill_reinstall_catalog_observations = nestedSwapCatalog;
    nestedDirectorySwap.refreshRefsAndCommit();
    let nestedSwapApplied = false;
    Object.defineProperty(nestedDirectorySwap.result, 'status', {
      configurable: true,
      enumerable: true,
      get() {
        if (!nestedSwapApplied) {
          nestedSwapApplied = true;
          fs.renameSync(nestedSwapDirectory, displacedNestedSwapDirectory);
          fs.symlinkSync(path.basename(displacedNestedSwapDirectory), nestedSwapDirectory, 'dir');
        }
        return 'passed';
      },
    });
    const nestedDirectorySwapVerdict = coreBetaInitializationSkillReinstallEvidenceVerdict(
      nestedDirectorySwap.result,
      { runRoot: nestedDirectorySwap.root },
    );
    assert.equal(nestedSwapApplied, true, '中间目录移动并回链攻击夹具必须实际触发');
    assert.equal(
      nestedDirectorySwapVerdict.valid,
      false,
      '移动中间目录并以 symlink 指回原证据 inode 时必须 fail-closed',
    );
    assert.ok(
      nestedDirectorySwapVerdict.reasons.includes('skill_reinstall_evidence_identity_drift'),
      `中间目录移动并回链必须由终态身份复核识别：${nestedDirectorySwapVerdict.reason}`,
    );
  } finally {
    for (const root of evidenceRoots) fs.rmSync(root, { recursive: true, force: true });
  }
}
{
  const failureState = {
    status: 'failed',
    result_category: 'bug',
    actual_result: '首个产品失败必须保留',
    conclusion: '失败：首个产品失败必须保留',
    failure_history: [],
  };
  applyFailureOutcome(
    failureState,
    '同一个框架失败只应记录一次',
    'automation_error',
    { source: 'idempotency-regression' },
  );
  const historyLength = failureState.failure_history.length;
  const primaryFailure = JSON.parse(JSON.stringify(failureState.primary_failure));
  applyFailureOutcome(
    failureState,
    '同一个框架失败只应记录一次',
    'automation_error',
    { source: 'idempotency-regression' },
  );
  assert.equal(failureState.failure_history.length, historyLength, '相同 failure 不得重复追加 history');
  assert.deepEqual(failureState.primary_failure, primaryFailure, '相同 failure 重放不得漂移 primary_failure');
  assert.ok(
    failureState.failure_history.some((item) => (
      item.category === 'bug'
      && item.reason === '首个产品失败必须保留'
      && item.source === 'existing_state'
    )),
    '更高优先级框架失败不能抹去首个产品失败历史',
  );
}
const genuineProvisioning = coreBetaV2RuntimeMaintenanceState({
  text: '本进程正在准备中 42%',
  composerReady: true,
  workbenchReady: true,
  buttonEnabled: false,
  capabilitiesReadable: true,
  sdkStatuses: [
    { family: 'claude-code', phase: 'provisioning', progress: 42 },
    { family: 'codex', phase: 'ready', progress: 100 },
  ],
  stableReadyObservations: 1,
  minimumReadyObservations: 1,
});
assert.equal(genuineProvisioning.authoritative_ready, false);
assert.equal(genuineProvisioning.pending, true);
assert.equal(
  coreBetaV2MaintenanceProductStateConflict({
    maintenanceState: genuineProvisioning,
    stableObservations: 10,
    elapsedMs: 600000,
  }).confirmed,
  false,
  '任一 SDK、按钮或 capability 未 ready 时仍是真实 pending，不能伪装成可继续的产品 UI 状态冲突',
);
assert.match(
  runner,
  /visibleStateConflict\.confirmed[\s\S]*pending: false[\s\S]*failed: true[\s\S]*product_ui_state_conflict: true/,
  '终态轮询必须把连续稳定的结构化 ready/可见 pending 矛盾转换为证据完整的产品失败',
);
assert.equal(coreGateIds.at(-1), 'SIT-AUTH-005', '核心门禁用例簿末条必须是退出登录闭环');
for (const id of [
  'SIT-INIT-004',
  'SIT-INIT-025',
  'SIT-AUTH-003',
  'SIT-HOME-050',
  'SIT-SKILL-026',
  'SIT-SKILL-032',
  'SIT-TEAMS-DOC-001',
]) {
  const item = coreGateCasebook.cases.find((candidate) => candidate.id === id);
  assert.ok(item, `核心门禁修订用例缺失：${id}`);
  for (const field of ['steps', 'success_criteria', 'evidence_required']) {
    assert.ok(String(item[field] || '').trim(), `${id} 缺少 ${field}`);
  }
}
const coreGateById = new Map(coreGateCasebook.cases.map((item) => [item.id, item]));
assert.match(coreGateById.get('SIT-AUTH-003').steps, /关闭并重新打开.*live profile/, 'AUTH-003 必须把宿主重开写成核心步骤');
assert.match(coreGateById.get('SIT-HOME-050').evidence_required, /搜索命中截图.*Esc 关闭后截图/, 'HOME-050 必须要求两张结果对齐截图');
assert.match(coreGateById.get('SIT-SKILL-026').precondition, /qa-python-runtime.*qa-node-runtime/, 'SKILL-026 必须使用两项确定性 Fixture');
assert.match(coreGateById.get('SIT-SKILL-032').evidence_required, /原始请求.*只保存在脱敏证据 JSON/, 'SKILL-032 必须分离用户结论与原始证据');
assert.match(coreGateById.get('SIT-TEAMS-DOC-001').steps, /按 key 选择 Teams Document QA/, 'Teams 文档必须按 key 显式选择连接器');
const skillHubRestartSource = runner.slice(
  runner.indexOf('async function restartWithSkillHubFault'),
  runner.indexOf('async function restoreNormalQbotAfterFault'),
);
const boundedSkillCatalogReadSource = runner.slice(
  runner.indexOf('async function readCoreBetaSkillCatalog'),
  runner.indexOf('async function waitForCoreBetaSkillIdentitiesAbsent'),
);
assert.match(
  boundedSkillCatalogReadSource,
  /Promise\.race\(\[[\s\S]*window\.agent\.getSkillsCatalog\(\)[\s\S]*5_000[\s\S]*window\.clearTimeout/,
  'Core Beta v2 Skill catalog 统一读取必须在 renderer 内使用 5 秒硬超时并清理 timer',
);
const sitHomeAbilityCombinationSource = runner.slice(
  runner.indexOf('async function executeSitHomeAbilityCombination'),
  runner.indexOf('async function executeSitHomeAutoAbility'),
);
assert.match(
  sitHomeAbilityCombinationSource,
  /SIT-HOME-009[\s\S]*readCoreBetaSkillCatalog\(page\)/,
  'SIT-HOME-009 fixture availability 必须通过统一有界 helper 读取 Skill catalog',
);
assert.doesNotMatch(
  sitHomeAbilityCombinationSource,
  /^\s*(?:const\s+\w+\s*=\s*await\s+)?window\.agent\??\.getSkillsCatalog\s*\(/m,
  'SIT-HOME-009 不得绕过统一 helper 直调 getSkillsCatalog',
);
const skillInstallTerminalSource = runner.slice(
  runner.indexOf('async function waitForSkillInstallTerminal'),
  runner.indexOf('async function findSkillCardByText'),
);
assert.match(
  skillInstallTerminalSource,
  /readCoreBetaSkillCatalog\(page\)[\s\S]*catalog\?\.installed/,
  'Skill 安装终态轮询必须通过统一有界 helper 读取 installed catalog',
);
assert.doesNotMatch(
  skillInstallTerminalSource,
  /^\s*(?:const\s+\w+\s*=\s*await\s+)?window\.agent\??\.getSkillsCatalog\s*\(/m,
  'Skill 安装终态轮询不得绕过统一 helper 直调 getSkillsCatalog',
);
assert.match(
  skillHubRestartSource,
  /fixture = null[\s\S]*fixture\?\.skills\?\.length[\s\S]*createTeamsSkillFixtureController\(fixture\.skills\)[\s\S]*controller\.setActiveVersion\(slug, version\)[\s\S]*handler: controller\.handle[\s\S]*mode: 'node-handler'/,
  'Core Beta v2 Teams Skill 回归必须使用声明的 stateful fixture controller，不能退化为空市场故障适配器',
);
assert.match(
  skillHubRestartSource,
  /\['GET', '\/api\/capabilities'\][\s\S]*includeOriginalResult: pathExact === '\/api\/capabilities'/,
  'Core Beta v2 Skill fixture adapter 必须把已安装 Fixture 合并到原始 capabilities.skills，不能让统一菜单回退真实市场目录',
);
assert.ok(
  skillHubRestartSource.indexOf('fixture?.skills?.length')
    < skillHubRestartSource.indexOf("const status = overrideUrl ? 'forbidden'"),
  'Core Beta v2 Teams Skill fixture 分支必须先于 forbidden 空市场 fallback',
);
assert.match(
  runner,
  /executeSkillRegressionFixtureCase[\s\S]*restartWithSkillHubFault\(\{[\s\S]*cleanup: fixture\.close,[\s\S]*fixture,[\s\S]*if \(!injected\.rendererAdapter\)[\s\S]*injected\.fixtureController\.snapshot\(\)\.events[\s\S]*cleanup: injected\.cleanup \|\| fixture\.close/,
  'Skill 回归调用方必须把 fixture 传给 V2 restart，并在 Teams renderer adapter 下保留正式 control plane',
);
assert.match(
  runner,
  /installRendererControlAdapter\(\{[\s\S]*handler = null[\s\S]*__qbotAutomationControlInvoke[\s\S]*reconcileSkills:[\s\S]*rule\.mode === 'node-handler'/,
  'Core Beta v2 renderer adapter 必须支持 stateful Skill fixture 的 Node handler 与完整生命周期路由',
);
assert.match(
  legacyRunner,
  /if \(name === 'reconcileSkills'\)[\s\S]*selectedSlugs[\s\S]*materialized\.push\(installedRow\(slug\)\)[\s\S]*const ready[\s\S]*localReadiness\?\.status === 'ready_on_this_process'[\s\S]*result: \{ ok: true, ready, materialized/,
  'Teams Skill fixture reconcile 必须返回可按 identity 匹配的结构化 ready/materialized，禁止让成功安装被客户端误回滚',
);
assert.match(
  runner,
  /__qbotAutomationAgentBindingStrategy = replaced \? 'facade' : 'unavailable'[\s\S]*bound_methods[\s\S]*original_agent_frozen[\s\S]*renderer control adapter did not intercept required window\.agent methods/,
  'Core Beta v2 renderer adapter 必须兼容冻结的 contextBridge API，并在 facade 与方法替换都无效时 fail-closed',
);
assert.match(
  skillHubRestartSource,
  /lifecycleProbeCalls[\s\S]*getSkillsCatalog[\s\S]*installSkill[\s\S]*uninstallSkill[\s\S]*updateSkill[\s\S]*revertSkill[\s\S]*reconcileSkills[\s\S]*controller\.snapshot\(\)\.events[\s\S]*controller\.clearEvents\(\)/,
  'Teams stateful Skill adapter 启动前必须让全部 Skill 生命周期探针到达 Node controller，并在真实叶子前清空探针事件',
);
assert.match(
  runner,
  /installRendererControlAdapterWithRecovery[\s\S]*Math\.min\(2[\s\S]*inspectRendererControlAdapterState[\s\S]*node_registry_count === 0[\s\S]*retry_eligible/,
  'Teams renderer adapter 首次瞬态失败只能在没有其他活动 adapter 时执行一次 clean rebind',
);
assert.match(
  runner,
  /qbot-teams-skill-fixture-adapter\/v2[\s\S]*recovered_after_clean_rebind[\s\S]*attempts[\s\S]*exact_failure_reason[\s\S]*qbot-core-beta-renderer-adapter-framework-failure\/v1/,
  'Teams renderer adapter 必须持久化全部绑定探针尝试，并为持续失败生成产品动作前 framework evidence',
);
assert.match(
  runner,
  /applyFailureOutcome[\s\S]*primary_failure[\s\S]*failure_history[\s\S]*FAILURE_CATEGORY_PRIORITY[\s\S]*function markFailed[\s\S]*applyFailureOutcome/,
  '首个精确 automation failure 必须保留为 primary_failure，后续通用汇总只能进入 failure history',
);
assert.match(
  runner,
  /prepareSkillRegressionFixtureState[\s\S]*preparationEvents = injected\.fixtureController\.snapshot\(\)\.events[\s\S]*event\.name === 'uninstallSkill'[\s\S]*automation_error/,
  'Skill 叶子执行前必须观察到独立于探针的真实准备事件，否则按 framework issue 停止',
);
assert.match(
  runner,
  /if \(projectSource !== 'gitlab'\)[\s\S]{0,500}普通项目使用当前选中运行时启动/,
  '普通项目不得被 GitLab workspace.ready 前置条件误阻塞',
);
assert.match(
  runner,
  /selectManualSkillByName\(page, state, caseDir, skillName, \{ ensureMode: false \}\)/,
  '多技能选择不得在每次点击前重复切换手动模式并清空上一技能',
);
assert.match(
  runner,
  /selectManualSkillByName\(page, state, caseDir, removedSkill, \{ ensureMode: false \}\)/,
  '多技能恢复不得重复切换手动模式并清空未删除技能',
);
assert.match(
  runner,
  /saveProjectRuntimeBinding\(project\.id, selectedRuntime\.runtimeId, true\)/,
  '专用 QA GitLab 项目未绑定时应通过产品 bridge 选择 enabled 运行时准备测试数据',
);
assert.match(
  runner,
  /Number\(b\.source !== 'gitlab'\) - Number\(a\.source !== 'gitlab'\)/,
  '项目成果用例应优先复用现有普通项目，避免无谓选择未绑定的 GitLab 项目',
);
assert.doesNotMatch(
  runner,
  /!projectId \|\| \(selectedProject\?\.source === 'gitlab'/,
  'createProject 不能被当作将未绑定 GitLab 项目转换为本地可执行项目的兜底',
);
assert.match(
  runner,
  /state\._composerPreparedSend[\s\S]{0,1400}composerUserTextValue/,
  '能力 chip composer 发送前应剔除 chip 文本校验用户正文，不能用 fill 清空 selectedSkills',
);
assert.match(runner, /createProject bridge 20000ms 未返回/, '项目测试数据 bridge 必须有硬超时，不能拖满整条 Case');

assert.deepEqual(
  forbiddenMatchesForCase('已收到：__DEEPBANK_E2E_ASK__', 'SIT-HITL-002'),
  [],
  'HITL 可见交互夹具自身的精确 E2E 触发标记不应被复核器误报为产品泄漏',
);
assert.deepEqual(
  forbiddenMatchesForCase('已收到：DEEPBANK_E2E_ASK', 'SIT-HITL-002'),
  [],
  'HITL 夹具标记被 QWork 去除外围下划线后的精确可见形式也不应误报',
);
assert.ok(
  forbiddenMatchesForCase('已收到：__DEEPBANK_E2E_ASK__', 'SIT-HOME-001').length > 0,
  'HITL E2E 标记在其他 Case 中仍必须作为技术噪音拦截',
);
assert.ok(
  forbiddenMatchesForCase('__DEEPBANK_E2E_ASK__ DEEPBANK_UNEXPECTED_SECRET', 'SIT-HITL-002')
    .some((item) => item.includes('DEEPBANK_UNEXPECTED_SECRET')),
  'HITL 精确豁免不得吞掉同一回复里的其他 DEEPBANK_* 泄漏',
);
assert.deepEqual(
  forbiddenMatchesForCase(
    '通过 SkillHub 注入的 QBOT_LINGXI_ACCESS_TOKEN 查询、搜索、创建和修改公司 Multica Issue。',
    'BETA-SKILL-001',
  ),
  [],
  'Skill 市场说明中的凭据变量名不是凭据值，不得误报为产品泄漏',
);
assert.deepEqual(
  forbiddenMatchesForCase(
    '配置项为 DEEPBANK_SERVER 和 DEEPBANK_LINGXI_CLIENT_SECRET；access_token=[REDACTED]',
    'BETA-SKILL-002',
  ),
  [],
  '环境变量名和已脱敏占位值应允许出现在产品说明中',
);
assert.ok(
  forbiddenMatchesForCase('QBOT_LINGXI_ACCESS_TOKEN=live-secret-value', 'BETA-SKILL-001').length > 0,
  '凭据变量带真实赋值时必须继续拦截',
);
assert.ok(
  forbiddenMatchesForCase('{"access_token":"live-secret-value"}', 'BETA-SKILL-001').length > 0,
  'JSON 凭据字段带真实值时必须继续拦截',
);
assert.ok(
  forbiddenMatchesForCase('DEEPBANK_SERVER=https://internal.example.test', 'BETA-SKILL-001').length > 0,
  '内部环境变量带真实值时必须继续拦截',
);
assert.ok(
  forbiddenMatchesForCase('Authorization: Bearer abc.def-123', 'BETA-SKILL-001').length > 0,
  'Bearer 凭据值必须继续拦截',
);
assert.deepEqual(
  forbiddenMatchesForCase('参数 exception：按 exception 过滤；分组字段为 class/exception/keywords。', 'BETA-MCP-001'),
  [],
  '连接器工具参数名 exception 不是错误栈，不得误报为产品异常',
);
assert.ok(
  forbiddenMatchesForCase('Uncaught TypeError: handler is not a function', 'BETA-MCP-001').length > 0,
  '真实 Uncaught 错误必须继续拦截',
);
assert.ok(
  forbiddenMatchesForCase('Traceback (most recent call last):\nRuntimeError: failed', 'BETA-MCP-001').length > 0,
  '真实 traceback 必须继续拦截',
);

const pipelineCase = (id, overrides = {}) => ({
  id,
  kind: 'conversation',
  module: '首页',
  submodule: '会话',
  scenario: '独立单轮业务问答',
  precondition: '已登录工作台',
  test_data: '请总结本周活动数据并给出三条建议。',
  expected_result: '返回清晰、相关的业务建议。',
  ...overrides,
});
assert.equal(parseSingleHostPipelineSize(true), 5, '布尔开关默认开启 5 会话流水线');
assert.equal(parseSingleHostPipelineSize('1'), 1, '流水线大小 1 等价于串行');
assert.equal(parseSingleHostPipelineSize('20'), 20, 'Core Beta 批次大小允许按用户要求配置到 20');
assert.throws(() => parseSingleHostPipelineSize('21'), /1-20/, '单宿主流水线不得超过 20');
assert.equal(singleHostPipelineEligibility(pipelineCase('SIT-HOME-061')).eligible, true, '白名单单轮纯会话允许流水线派发');
assert.equal(singleHostPipelineEligibility(pipelineCase('SIT-HOME-061', { test_data: '请读取上传附件并总结。' })).eligible, false, '附件语义即使 ID 在白名单也必须串行');
assert.equal(singleHostPipelineEligibility(pipelineCase('SIT-HITL-002')).eligible, false, 'HITL Case 不得进入单宿主流水线');
assert.equal(isTransientCredentialRotation('Lingxi credential changed during the management request'), true, 'Lingxi 管理请求凭证轮换必须进入一次安全恢复');
assert.equal(isTransientCredentialRotation('普通业务失败，请稍后重试'), false, '未知业务错误不得盲目按凭证轮换重试');
const plannedPipeline = buildSingleHostPipelineBatch([
  pipelineCase('SIT-HOME-061'),
  pipelineCase('SIT-HOME-062'),
  pipelineCase('SIT-HOME-063'),
  pipelineCase('SIT-HOME-064'),
  pipelineCase('SIT-HOME-065'),
  pipelineCase('SIT-HOME-054'),
], 0, 5);
assert.deepEqual(plannedPipeline.map((entry) => entry.testCase.id), [
  'SIT-HOME-061',
  'SIT-HOME-062',
  'SIT-HOME-063',
  'SIT-HOME-064',
  'SIT-HOME-065',
], '单宿主流水线单波最多派发 5 条');
assert.deepEqual(buildSingleHostPipelineBatch([
  pipelineCase('SIT-HOME-061'),
  pipelineCase('SIT-HITL-002'),
  pipelineCase('SIT-HOME-062'),
], 0, 5).map((entry) => entry.testCase.id), ['SIT-HOME-061'], '流水线不得跨越串行安全屏障重排 Case');
const coreBetaPipelineCase = (id, caseType = 'conversation', overrides = {}) => ({
  id,
  contract_version: 'qbot-core-beta/v2',
  case_type: caseType,
  pipeline_policy: 'dispatch_collect',
  batch_size: 5,
  conversation_turns: [{ turn: 1, prompt: `${id} prompt`, oracle: 'reply complete' }],
  action_plan: [{ number: 1, operation: 'prepare' }],
  ...overrides,
});
const forcedSerialPolicy = coreBetaExecutionConcurrencyPolicy({
  selectedCases: [coreBetaPipelineCase('BETA-CHAT-001')],
  requestedParallelism: 20,
  requestedSingleHostPipelineSize: 20,
});
assert.deepEqual(
  {
    policy: forcedSerialPolicy.policy,
    forced_serial: forcedSerialPolicy.forced_serial,
    requested_parallelism: forcedSerialPolicy.requested_parallelism,
    effective_parallelism: forcedSerialPolicy.effective_parallelism,
    requested_single_host_pipeline_size: forcedSerialPolicy.requested_single_host_pipeline_size,
    effective_single_host_pipeline_size: forcedSerialPolicy.effective_single_host_pipeline_size,
  },
  {
    policy: 'core-beta-v2-forced-serial',
    forced_serial: true,
    requested_parallelism: 20,
    effective_parallelism: 1,
    requested_single_host_pipeline_size: 20,
    effective_single_host_pipeline_size: 1,
  },
  'Core Beta v2 即使请求两种并发，Case 间实际并发也必须固定为 1',
);
assert.equal(
  singleHostPipelineEligibility(coreBetaPipelineCase('BETA-CHAT-001')).eligible,
  false,
  'Core Beta v2 Case 永远不得进入外层 single-host pipeline',
);
assert.deepEqual(
  buildSingleHostPipelineBatch(
    Array.from({ length: 8 }, (_item, index) => coreBetaPipelineCase(`BETA-CHAT-${String(index + 1).padStart(3, '0')}`)),
    0,
    20,
  ),
  [],
  'Core Beta 外层批次构建必须直接返回空并交给串行路径逐 Case 执行',
);
assert.deepEqual(
  buildSingleHostPipelineBatch([
    coreBetaPipelineCase('BETA-CHAT-001', 'conversation'),
    coreBetaPipelineCase('BETA-FILE-001', 'attachment'),
    coreBetaPipelineCase('BETA-CHAT-002', 'conversation'),
  ], 0, 20),
  [],
  'Core Beta 不得因 case_type 相同或不同而恢复外层并发',
);
assert.deepEqual(
  buildSingleHostPipelineBatch([
    coreBetaPipelineCase('BETA-CHAT-001', 'conversation', { pipeline_policy: 'dispatch_collect' }),
    coreBetaPipelineCase('BETA-CHAT-002', 'conversation', { pipeline_policy: 'dispatch_collect_round_robin' }),
  ], 0, 20),
  [],
  'Casebook 的历史 pipeline_policy 元数据不得绕过 Core Beta 强制串行策略',
);
const internalBatchCase = coreBetaPipelineCase('BETA-CHAT-008', 'conversation', {
  batch_size: 20,
  conversation_turns: [{
    turn: 1,
    prompt: '使用由 Runner 注入的唯一业务问题与 case marker。',
    oracle: '20 条任务逐 taskId 回收',
  }],
});
const internalBatchMarkers = Array.from(
  { length: 20 },
  (_item, index) => coreBetaBatchTaskMarker(internalBatchCase.id, index),
);
assert.equal(
  new Set(internalBatchMarkers).size,
  20,
  'BETA-CHAT-008 必须能在运行时生成 20 个唯一 marker，不能依赖未定义的哈希 helper',
);
assert.deepEqual(
  internalBatchMarkers,
  Array.from({ length: 20 }, (_item, index) => coreBetaBatchTaskMarker(internalBatchCase.id, index)),
  'BETA-CHAT-008 marker 必须在相同 Case 身份下稳定可复现',
);
assert.ok(
  internalBatchMarkers.every((marker, index) => (
    marker.startsWith(`QBOT-BETA-${String(index + 1).padStart(2, '0')}-`)
    && /^QBOT-BETA-\d{2}-[0-9a-f]{8}$/.test(marker)
  )),
  'BETA-CHAT-008 marker 必须保留序号和 8 位 SHA-256 身份后缀',
);
assert.equal(
  singleHostPipelineEligibility(internalBatchCase).eligible,
  false,
  'BETA-CHAT-008 自己拥有 20 条派发/回收生命周期，必须是外层 pipeline 硬屏障',
);
assert.deepEqual(
  buildSingleHostPipelineBatch([
    internalBatchCase,
    coreBetaPipelineCase('BETA-CHAT-009'),
  ], 0, 20),
  [],
  '外层 pipeline 不得先把 BETA-CHAT-008 当普通单会话发送占位 prompt',
);
assert.match(
  runner,
  /case 'conversation_dispatch_collect_20':[\s\S]{0,160}executeCoreBetaConversationDispatchCollect20\(context\)/,
  'BETA-CHAT-008 必须绑定 v2 专用执行分支，不能落入通用 executeConversationCase',
);
const internalBatchExecutorSource = runner.match(
  /async function executeCoreBetaConversationDispatchCollect20\(context\) \{[\s\S]*?\n\}/,
)?.[0] || '';
assert.match(
  internalBatchExecutorSource,
  /coreBetaDispatchBatch\([\s\S]*coreBetaAssertBatchPendingPool\([\s\S]*coreBetaCollectBatch\(/,
  'v2 专用执行分支必须依次真实派发 20 条、读取待回复池并按 taskId 回收',
);
assert.match(
  runner,
  /async function coreBetaObserveBatchEntry\([\s\S]*resolveAssistantConfirmationModal\([\s\S]*批量任务[\s\S]*conversationSnapshot\(/,
  '批量 taskId 回收也必须自动处理标准 Agent 澄清面板，不能让“跳过”弹窗耗尽共享截止时间',
);
assert.match(
  runner,
  /coreBetaBatchReplyCompletionPayload\([\s\S]*writeJsonFile\(ctx\.state\.artifacts\.reply_completion[\s\S]*batch-timeout-cleanup-readback\.json[\s\S]*cleanup_click_is_case_action: false/,
  '批量共享截止时间必须写成证据完整的产品失败，并在固化终态后隔离清理残留运行任务',
);
const localFixtureAudit = await inspectCoreBetaFixtureReadiness({
  cases: [coreBetaPipelineCase('BETA-CHAT-001')],
});
assert.equal(localFixtureAudit.ok, true, '公开产品状态型 Core Beta Case 不需要外部 fixture controller');
assert.match(
  coreBetaBatchStopReason(
    { id: 'BETA-INIT-001', case_type: 'run_initialization', contract_version: 'qbot-core-beta/v2' },
    { status: 'failed', result_category: 'bug' },
  ),
  /^$/,
  '初始化失败必须记录为当前 Case 结果，不能中断后续 Core Beta Case',
);
const safeInitializationContinuation = coreBetaInitializationContinuation({
  testCase: { id: 'BETA-INIT-003' },
  terminalReadback: {
    pending: false,
    failed: true,
    loaded: true,
    sdk_ready: true,
    button_enabled: true,
    composer_ready: true,
    workbench_ready: true,
    capabilities_readable: true,
  },
  continuationSurface: { valid: true, composer_ready: true, workbench_ready: true },
  afterReadback: { page: { body_text_length: 100 } },
});
assert.equal(
  safeInitializationContinuation.safe,
  true,
  '维护动作产品失败但公开工作台完整可用时应允许继续收集独立 Case 证据',
);
assert.equal(
  coreBetaBatchStopReason(
    { id: 'BETA-INIT-003', case_type: 'run_initialization', contract_version: 'qbot-core-beta/v2' },
    {
      status: 'failed',
      result_category: 'bug',
      initialization_continuation: safeInitializationContinuation,
    },
  ),
  '',
  '初始化产品 Bug 在安全连续性已证明时不应浪费后续独立 Case',
);
assert.equal(
  coreBetaBatchStopReason(
    { id: 'BETA-INIT-003', case_type: 'run_initialization', contract_version: 'qbot-core-beta/v2' },
    {
      status: 'failed',
      result_category: 'bug',
      initialization_continuation: {
        eligible: true,
        safe: false,
      },
    },
  ),
  '',
  '初始化失败后公开工作台不可用时也必须记录 blocked/failed 并继续后续 Case',
);
assert.equal(
  coreBetaBatchStopReason(
    { id: 'BETA-INIT-003', case_type: 'run_initialization', contract_version: 'qbot-core-beta/v2' },
    {
      status: 'failed',
      result_category: 'automation_error',
      initialization_continuation: safeInitializationContinuation,
    },
  ),
  '',
  '初始化 automation_error 也必须记录失败结果并继续后续 Case',
);
assert.equal(
  coreBetaBatchStopReason(
    { id: 'BETA-CHAT-001', case_type: 'conversation', contract_version: 'qbot-core-beta/v2' },
    { status: 'failed', result_category: 'automation_error' },
  ),
  '',
  '普通 Case automation_error 也必须记录失败结果并继续后续 Case',
);
const runtimeUpdateBatchStop = coreBetaBatchStopReason(
  { id: 'BETA-SKILL-002', case_type: 'skill_lifecycle', contract_version: 'qbot-core-beta/v2' },
  {
    status: 'failed',
    result_category: 'automation_error',
    artifacts: {
      runtime_update_activation_risks: [{
        clicked: false,
        dismissed: false,
        reason: '冻结版本=0.1.6-sit.3；候选版本=0.1.6-sit.4。',
        activation_risk: {
          risk: true,
          frozen_version: '0.1.6-sit.3',
          candidate_version: '0.1.6-sit.4',
          version_drift: true,
        },
      }],
    },
  },
);
assert.match(
  runtimeUpdateBatchStop,
  /批次冻结身份存在待激活更新风险.*0\.1\.6-sit\.3.*0\.1\.6-sit\.4/,
  '待激活版本可能延迟重启并破坏冻结身份时，必须在首个诊断 Case 后硬停止批次',
);
assert.equal(
  coreBetaBatchStopReason(
    { id: 'QW-SKILL-001', case_type: 'compound', contract_version: 'qbot-core-beta/v2' },
    { batch_stop_reason: runtimeUpdateBatchStop },
  ),
  runtimeUpdateBatchStop,
  'compound 父 Case 必须传播叶子的批次级更新风险，禁止继续执行后续叶子或父 Case',
);
const maskedAutomationError = {
  status: 'blocked',
  result_category: 'blocked',
  actual_result: '上游 Skill 前置阻塞',
  assertions: [{
    name: '清理读回',
    expected: 'remaining=0',
    actual: 'remaining=5',
    status: 'failed',
    category: 'automation_error',
  }],
  steps: [],
};
assert.equal(resultHasAutomationError(maskedAutomationError), true, '嵌套失败断言中的 automation_error 不得被顶层 blocked 隐藏');
assert.equal(
  coreBetaBatchStopReason(
    { id: 'BETA-SKILL-012', case_type: 'skill_lifecycle', contract_version: 'qbot-core-beta/v2' },
    maskedAutomationError,
  ),
  '',
  '嵌套 automation_error 不得中断后续 Case，可信复核仍会识别框架问题',
);
const preservedAutomationError = structuredClone(maskedAutomationError);
applyBlockedOutcome(preservedAutomationError, '固定10个 Skill 的安装成功数不足10个');
assert.equal(preservedAutomationError.status, 'failed', '前置阻塞不得把既有 automation_error 改成 blocked');
assert.equal(preservedAutomationError.result_category, 'automation_error', 'automation_error 必须拥有高于 blocked 的结果优先级');
assert.deepEqual(
  preservedAutomationError.secondary_blockers,
  ['固定10个 Skill 的安装成功数不足10个'],
  '被保留的前置阻塞只作为次要上下文记录',
);
assert.equal(
  coreBetaBatchStopReason(
    { id: 'BETA-CHAT-001', case_type: 'conversation', contract_version: 'qbot-core-beta/v2' },
    { status: 'failed', result_category: 'bug' },
  ),
  '',
  '可信产品 Bug 不应阻止后续独立 Case 收集',
);
assert.equal(
  coreBetaBatchStopReason(
    { id: 'BETA-SKILL-005', case_type: 'skill_lifecycle', contract_version: 'qbot-core-beta/v2' },
    { status: 'blocked', result_category: 'blocked', steps: [], assertions: [] },
  ),
  '',
  '没有框架错误的普通前置阻塞必须记录后继续执行后续独立 Case',
);
assert.deepEqual(
  partitionCasebookResults([
    { id: 'BETA-CHAT-001', status: 'passed', synthetic: false },
    { id: 'BETA-CHAT-002', status: 'blocked', synthetic: true },
  ]),
  {
    completed: [{ id: 'BETA-CHAT-001', status: 'passed', synthetic: false }],
    syntheticDiagnostics: [{ id: 'BETA-CHAT-002', status: 'blocked', synthetic: true }],
  },
  'synthetic 只能进入非执行诊断，绝不能进入 completed/results/counts',
);
const syntheticOnlySummary = buildSummary({
  status: 'blocked',
  startedAt: new Date('2026-08-03T00:00:00.000Z'),
  outDir: '/tmp/qbot-synthetic-summary-regression',
  casebook: '/tmp/casebook.xlsx',
  resultExcel: '/tmp/result.xlsx',
  profile: 'mandatory',
  cdpUrl: 'http://127.0.0.1:9224',
  results: [{
    id: 'BETA-CHAT-001',
    status: 'blocked',
    result_category: 'automation_error',
    actual_result: 'Case 0 preflight failed',
    synthetic: true,
  }],
});
assert.equal(syntheticOnlySummary.counts.total, 0, 'synthetic summary 的 completed total 必须为 0');
assert.deepEqual(syntheticOnlySummary.results, [], 'synthetic summary 不得包含已完成 Case');
assert.equal(
  syntheticOnlySummary.non_executed_diagnostics.length,
  1,
  'synthetic preflight 失败只可保留为 non_executed_diagnostics',
);
const stoppedSummary = buildSummary({
  status: 'passed',
  startedAt: new Date('2026-08-04T00:00:00.000Z'),
  outDir: '/tmp/qbot-framework-stop-summary-regression',
  casebook: '/tmp/casebook.xlsx',
  resultExcel: '/tmp/result.xlsx',
  profile: 'mandatory',
  cdpUrl: 'http://127.0.0.1:9224',
  expectedTotal: 55,
  results: [{ id: 'BETA-INIT-001', status: 'passed', synthetic: false }],
  frameworkStop: {
    status: 'stopped',
    reason: 'BETA-INIT-002 manifest incomplete',
    stopped_case_id: 'BETA-INIT-002',
    stopped_at_index: 1,
    failed_result: {
      id: 'BETA-INIT-002',
      module: '初始化',
      scenario: '初始化检查',
      status: 'failed',
      result_category: 'automation_error',
      actual_result: 'manifest incomplete',
      steps: [{ action: '生成 manifest', status: 'failed', category: 'automation_error' }],
      assertions: [],
      screenshots: {},
      artifacts: {},
    },
  },
});
assert.equal(stoppedSummary.status, 'stopped', 'framework stop 不能被已完成 Case 的 passed 覆盖');
assert.equal(stoppedSummary.stopped, true, 'framework stop 必须传播到最终 summary');
assert.equal(stoppedSummary.counts.total, 1, '停止 Case 不得伪造为 completed');
assert.equal(stoppedSummary.result_accounting.planned, 55, 'summary 必须保留完整计划总数');
assert.equal(stoppedSummary.result_accounting.unexecuted, 54, 'summary 必须明确未完成 Case 数');
assert.equal(stoppedSummary.stopped_case_id, 'BETA-INIT-002');
assert.equal(stoppedSummary.credibility_review.counts.total, 1, '停止诊断不得伪装成 completed 复核项');
assert.equal(stoppedSummary.credibility_review.counts.framework_issue_diagnostics, 1);
assert.equal(
  stoppedSummary.credibility_review.counts.framework_issue,
  stoppedSummary.credibility_review.counts.framework_issue_completed + 1,
  'framework stop 必须在 completed 复核结果之外传播到框架问题总数',
);
assert.equal(stoppedSummary.credibility_review.diagnostics.length, 1);
assert.equal(stoppedSummary.framework_stop_review.id, 'BETA-INIT-002');
assert.equal(stoppedSummary.framework_stop_review.review_category, '不可信-框架问题');
assert.match(
  runner,
  /function credibilityFrameworkItems[\s\S]*review\?\.diagnostics[\s\S]*function renderFrameworkFixList[\s\S]*credibilityFrameworkItems\(review\)/,
  '框架修复清单必须包含非 completed 的 framework stop 诊断',
);
assert.equal(
  buildFrameworkStopCredibilityDiagnostic({
    status: 'stopped',
    reason: 'manifest incomplete',
    stopped_case_id: 'BETA-INIT-002',
  }).execution_provenance,
  'non_executed_diagnostic',
  '缺少 failed_result 时也必须保留非 completed framework stop 诊断',
);
{
  const stopDir = fs.mkdtempSync(path.join(os.tmpdir(), 'qbot-framework-stop-case-id-'));
  try {
    const progressFile = path.join(stopDir, 'automation-progress.json');
    const failedResult = { id: 'BETA-SKILL-012', status: 'failed', result_category: 'automation_error' };
    const diagnostic = stopRemainderWithoutSynthetic({
      outDir: stopDir,
      selectedCases: [
        { id: 'BETA-SKILL-012' },
        { id: 'BETA-SKILL-014' },
        { id: 'BETA-EXPERT-002' },
      ],
      startIndex: 0,
      results: [failedResult],
      progressFile,
      status: 'blocked',
      resultCategory: 'automation_error',
      reason: 'BETA-SKILL-012 cleanup failed',
      failedResult,
    });
    assert.equal(diagnostic.stopped_case_id, 'BETA-SKILL-012');
    assert.deepEqual(diagnostic.unexecuted_case_ids, ['BETA-SKILL-014', 'BETA-EXPERT-002']);
    assert.equal(JSON.parse(fs.readFileSync(progressFile, 'utf8')).current_case, 'BETA-SKILL-012');
  } finally {
    fs.rmSync(stopDir, { recursive: true, force: true });
  }
}
assert.match(
  runner,
  /let frameworkStop = null[\s\S]*frameworkStop = stopRemainderWithoutSynthetic\([\s\S]*failedResult: result[\s\S]*buildSummary\(\{[\s\S]*expectedTotal: selectedCases\.length,[\s\S]*frameworkStop,/,
  '真实主循环必须把硬停止诊断与完整计划数传入最终 summary',
);
assert.equal(coreBetaV2SettingsLoadTimeoutMs({}), 90_000);
assert.equal(coreBetaV2SettingsLoadTimeoutMs({ QBOT_CORE_BETA_SETTINGS_LOAD_TIMEOUT_MS: '1000' }), 30_000);
assert.equal(coreBetaV2SettingsLoadTimeoutMs({ QBOT_CORE_BETA_SETTINGS_LOAD_TIMEOUT_MS: '999999' }), 180_000);
assert.deepEqual(coreBetaV2SettingsSurfaceState('系统设置\n正在加载个人设置...'), {
  open: true,
  loading: true,
  error: '',
});
assert.deepEqual(coreBetaV2SettingsSurfaceState('个人设置\n系统设置\n运行时 release'), {
  open: true,
  loading: false,
  error: '',
});
assert.deepEqual(coreBetaV2SettingsSurfaceState('系统设置\n加载个人设置失败：网络错误'), {
  open: true,
  loading: false,
  error: '加载个人设置失败：网络错误',
});
assert.equal(
  coreBetaV2RuntimeUpdateSkipAction('新版本已就绪 v0.0.30-rc.2', '稍后'),
  true,
  '更新提示识别器必须只把精确“稍后”识别为非安装动作',
);
assert.equal(
  coreBetaV2RuntimeUpdateSkipAction('发现新版本 v0.0.31', '跳过更新'),
  true,
  '更新提示兼容精确“跳过更新”动作',
);
assert.equal(
  coreBetaV2RuntimeUpdateSkipAction('新版本已就绪 v0.0.30-rc.2', '立即更新'),
  false,
  '自动化批次禁止点击“立即更新”导致发布身份漂移',
);
assert.equal(
  coreBetaV2RuntimeUpdateSkipAction('普通业务提示', '稍后'),
  false,
  '非更新提示不得复用版本更新跳过规则',
);
assert.deepEqual(
  coreBetaV2RuntimeUpdateActivationRisk('新版本已就绪 v0.1.4-sit.17\n稍后\n立即重启', '0.1.4-sit.11'),
  {
    risk: true,
    frozen_version: '0.1.4-sit.11',
    candidate_version: '0.1.4-sit.17',
    version_drift: true,
    reason: '检测到待激活 QWork 更新 0.1.4-sit.17；正式不可变批次不能依赖“稍后”保证宿主不会随后重启。',
  },
  '正式不可变批次必须识别待激活版本与冻结版本漂移风险',
);
assert.equal(
  coreBetaV2RuntimeUpdateActivationRisk('普通业务提示', '0.1.4-sit.11').risk,
  false,
  '普通状态文案不得触发发布身份硬停止',
);
assert.equal(
  coreBetaV2WorkspaceCreationDismissAction('新建工作空间\n请输入工作空间名称', '取消'),
  true,
  '新建工作空间弹窗必须允许精确点击取消',
);
assert.equal(
  coreBetaV2WorkspaceCreationDismissAction('新建工作空间\n请输入工作空间名称', '关闭'),
  true,
  '新建工作空间弹窗必须允许精确点击关闭',
);
assert.equal(
  coreBetaV2WorkspaceCreationDismissAction('新建工作空间\n请输入工作空间名称', 'close-icon', 'close_icon'),
  true,
  '新建工作空间弹窗必须允许明确关闭图标',
);
assert.equal(
  coreBetaV2WorkspaceCreationDismissAction('新建工作空间\n请输入工作空间名称', '确认'),
  false,
  '自动化清理禁止点击确认创建工作空间',
);
assert.equal(
  coreBetaV2WorkspaceCreationDismissAction('普通业务提示', '取消'),
  false,
  '普通弹窗不得复用新建工作空间清理规则',
);
assert.equal(
  coreBetaV2ExpertCreationDismissAction('创建专家\n开始创建（用对话）\n高级手动创建', 'close-icon', 'close_icon'),
  true,
  '新版创建专家选择弹窗必须允许明确关闭图标',
);
assert.equal(
  coreBetaV2ExpertCreationDismissAction('创建专家\n开始创建（用对话）\n手动填表创建', '关闭'),
  true,
  '旧版创建专家选择弹窗必须允许精确关闭动作',
);
assert.equal(
  coreBetaV2ExpertCreationDismissAction('创建专家\n开始创建（用对话）\n高级手动创建', '开始创建'),
  false,
  '自动化前置清理禁止进入任一专家创建路径',
);
assert.equal(
  coreBetaV2ExpertCreationDismissAction('普通专家详情', 'close-icon', 'close_icon'),
  false,
  '普通专家页面不得复用创建专家选择弹窗清理规则',
);
assert.equal(
  coreBetaV2ExpertCreationDismissLabel('', '关闭', ''),
  '关闭',
  '只有 aria-label 的创建专家关闭按钮必须保留精确安全动作名称',
);
assert.equal(
  coreBetaV2ExpertCreationDismissLabel('', '', '关闭'),
  '关闭',
  '只有 title 的创建专家关闭按钮必须保留精确安全动作名称',
);
assert.equal(coreBetaExpertCreateSubmitLabel('创建'), true, '旧版专家表单“创建”必须是受支持的精确提交动作');
assert.equal(coreBetaExpertCreateSubmitLabel('保存草稿'), true, '新版专家表单“保存草稿”必须是受支持的精确提交动作');
assert.deepEqual(
  coreBetaExpertBuilderReturnSelectorCandidates(),
  ['[data-testid="expert-builder-back"]', 'button.expert-center-back'],
  '专家构建页必须优先使用当前发布包的稳定返回 testid，并仅以可见 class 作回退',
);
for (const unsafeLabel of ['保存', '保存并发布', '立即发布', '取消', '保存草稿并发布']) {
  assert.equal(coreBetaExpertCreateSubmitLabel(unsafeLabel), false, `专家表单不得把“${unsafeLabel}”当作创建草稿动作`);
}
const expertCreationActionStart = runner.indexOf('export function coreBetaV2ExpertCreationDismissAction');
const expertCreationDismissStart = runner.indexOf('async function dismissCoreBetaV2ExpertCreationObstruction');
const workspaceDismissStart = runner.indexOf('async function dismissCoreBetaV2WorkspaceCreationObstruction');
const runtimeUpdateDismissStart = runner.indexOf('async function dismissCoreBetaV2RuntimeUpdateObstruction');
assert.ok(
  expertCreationActionStart >= 0
    && expertCreationDismissStart > expertCreationActionStart
    && workspaceDismissStart > expertCreationDismissStart
    && runtimeUpdateDismissStart > workspaceDismissStart,
  '创建专家与新建工作空间专用清理器必须存在并定义在版本提示清理器之前',
);
const expertCreationActionSource = runner.slice(expertCreationActionStart, expertCreationDismissStart);
assert.match(
  expertCreationActionSource,
  /创建专家[\s\S]*开始创建[\s\S]*手动填表创建\|高级手动创建[\s\S]*\^\(\?:取消\|关闭\)\$/,
  '创建专家残留弹窗判定必须同时验证选择弹窗文案，并仅允许精确取消或关闭动作',
);
const expertCreationDismissSource = runner.slice(expertCreationDismissStart, workspaceDismissStart);
assert.match(
  expertCreationDismissSource,
  /coreBetaV2ExpertCreationDismissAction[\s\S]*action\.click\(\{ timeout: 5000 \}\)[\s\S]*waitFor\(\{ state: 'hidden', timeout: 5000 \}\)/,
  '创建专家残留弹窗清理必须复用精确安全判定、点击关闭入口并等待 hidden',
);
assert.match(
  expertCreationDismissSource,
  /getAttribute\('aria-label'\)[\s\S]*getAttribute\('title'\)[\s\S]*coreBetaV2ExpertCreationDismissLabel/,
  '创建专家残留弹窗清理必须支持无 innerText 的可访问名称关闭按钮',
);
assert.doesNotMatch(
  expertCreationDismissSource,
  /force:\s*true|name:\s*\/\^开始创建|expert-create-manual.*click/,
  '创建专家残留弹窗清理不得 force 穿透或进入任一创建路径',
);
assert.match(
  expertCreationDismissSource,
  /expert-creation-dialog-dismiss-[\s\S]*-before[\s\S]*-after[\s\S]*qbot-core-beta-expert-creation-dialog-dismiss\/v1[\s\S]*hidden_after_click[\s\S]*expert_creation_dialog_dismissals/,
  '创建专家残留弹窗清理必须保存前后截图、隐藏读回和结构化 ledger',
);
const workspaceDismissSource = runner.slice(workspaceDismissStart, runtimeUpdateDismissStart);
assert.match(
  workspaceDismissSource,
  /getByRole\('button', \{ name: \/\^\(\?:取消\|关闭\)\$\/ \}\)[\s\S]*action\.click\(\{ timeout: 5000 \}\)[\s\S]*waitFor\(\{ state: 'hidden', timeout: 5000 \}\)/,
  '新建工作空间清理必须只点击同一弹窗内精确安全动作并等待弹窗隐藏',
);
assert.doesNotMatch(
  workspaceDismissSource,
  /force:\s*true|name:\s*\/\^确认\$\/|hasText:\s*\/\^确认\$\/|立即重启/,
  '新建工作空间清理不得 force 穿透，也不得包含确认或立即重启动作',
);
assert.match(
  workspaceDismissSource,
  /workspace-creation-dialog-dismiss-[\s\S]*-before[\s\S]*-after[\s\S]*qbot-core-beta-workspace-creation-dialog-dismiss\/v1[\s\S]*hidden_after_click[\s\S]*before_screenshot[\s\S]*after_screenshot[\s\S]*workspace_creation_dialog_dismissals/,
  '新建工作空间清理必须保存前后截图、隐藏读回和结构化 ledger',
);
assert.match(
  runner,
  /async function openCoreBetaV2SystemSettings[\s\S]*initialSettings = await waitForOpenSettingsMaintenance\(\)[\s\S]*openCoreBetaV2SettingsMenu/,
  'Core Beta v2 必须先等待已打开的系统设置加载，不能把加载态误判成个人设置入口缺失',
);
assert.match(
  runner,
  /async function dismissCoreBetaV2SettingsObstruction[\s\S]*skill-operation-feedback[\s\S]*关闭操作提示[\s\S]*state: 'hidden'[\s\S]*openCoreBetaV2SettingsMenu[\s\S]*dismissCoreBetaV2SettingsObstruction/,
  'Core Beta v2 必须先关闭遮挡设置入口的终态技能提示，并确认提示确实消失',
);
assert.match(
  runner,
  /async function dismissCoreBetaV2RuntimeUpdateObstruction[\s\S]*runtime-update-ready-toast[\s\S]*statuses = page\.locator\('\[role="status"\]'\)[\s\S]*coreBetaV2RuntimeUpdateActivationRisk[\s\S]*if \(state\?\.case_dir && activationRisk\.risk\)[\s\S]*qbot-core-beta-runtime-update-activation-risk\/v1[\s\S]*immutable_run_blocked: true[\s\S]*clicked: false[\s\S]*ok: false[\s\S]*skip\.click\(\{ timeout: 5000 \}\)/,
  '正式不可变批次必须先固化待激活更新风险并硬停止；无 Case 状态的非正式清理才可到达安全跳过动作',
);
assert.match(
  runner,
  /if \(state\?\.case_dir && activationRisk\.risk\)[\s\S]*action-receipts\.json[\s\S]*status: 'blocked'/,
  '待激活更新硬停止必须先生成完整停止证据包，避免把发布风险阻塞二次误报为 manifest 框架问题',
);
assert.match(runner, /public-state-readback\.json[\s\S]*state\.artifacts\.public_state_readback/);
assert.match(runner, /cleanup-readback\.json[\s\S]*state\.artifacts\.cleanup_readback/);
assert.match(
  runner,
  /if \(await visible\(dedicatedToast, 500\)\)[\s\S]*else \{[\s\S]*statuses = page\.locator\('\[role="status"\]'\)[\s\S]*if \(!coreBetaV2RuntimeUpdateSkipAction\(candidateText, candidateButtonText\)\) continue;[\s\S]*if \(!toast\) \{[\s\S]*observed: false, ok: true/,
  '系统设置中的非阻塞版本状态没有安全跳过按钮时不得冒充遮挡弹窗；专用更新 toast 仍须 fail-closed',
);
assert.match(
  runner,
  /async function dismissCoreBetaV2SettingsObstruction[\s\S]*dismissCoreBetaV2WorkspaceCreationObstruction[\s\S]*dismissCoreBetaV2ExpertCreationObstruction[\s\S]*dismissCoreBetaV2RuntimeUpdateObstruction[\s\S]*async function openCoreBetaV2SettingsMenu/,
  '进入系统设置前必须先清理新建工作空间与创建专家模态框，再检查异步晚到的 QWork 更新提示',
);
assert.match(
  runner,
  /async function dismissBlockingOverlays[\s\S]*dismissCoreBetaV2WorkspaceCreationObstruction[\s\S]*无法安全关闭新建工作空间弹窗[\s\S]*dismissCoreBetaV2ExpertCreationObstruction[\s\S]*无法安全关闭创建专家弹窗[\s\S]*dismissCoreBetaV2RuntimeUpdateObstruction[\s\S]*无法安全跳过 QWork 版本更新提示/,
  '每条 Case 开始时必须先关闭前景工作空间或创建专家模态框，再处理版本提示；任一无法安全关闭都 fail-closed',
);
assert.match(
  runner,
  /async function openCoreBetaV2SettingsMenu[\s\S]*dismissCoreBetaV2SettingsObstruction[\s\S]*ensureSidebarExpanded[\s\S]*menu\.scrollIntoViewIfNeeded[\s\S]*menu\.click\(\{ timeout: 5000 \}\)[\s\S]*async function openCoreBetaV2SystemSettings[\s\S]*nav-settings/,
  'Core Beta v2 必须兼容直接进入设置与旧版个人设置子菜单，并禁止 force 点击被遮挡入口',
);
assert.doesNotMatch(
  runner,
  /(?:nav-settings-menu|settingsMenu)[^\n]*click\(\{\s*force:\s*true/,
  'Core Beta v2 任一设置入口都不得 force 穿透遮挡层',
);
for (const [name, pattern] of [
  ['日常设置', /async function qworkDailySettingsCase[\s\S]*openCoreBetaV2SystemSettings/],
  ['日常脱敏', /async function qworkDailyRedactionCase[\s\S]*openCoreBetaV2SystemSettings/],
  ['INIT-009', /async function executeSitInit009[\s\S]*openCoreBetaV2SystemSettings/],
  ['AUTH-005', /async function executeSitAuth005[\s\S]*openCoreBetaV2SettingsMenu/],
  ['Skill 物化', /async function executeSitSkillMaterialization[\s\S]*openCoreBetaV2SystemSettings/],
  ['Skill 审计拒装', /async function executeSitSkillAuditRejectNoAutoRetry[\s\S]*openCoreBetaV2SystemSettings/],
]) {
  assert.match(runner, pattern, `${name} 必须复用安全设置入口`);
}
assert.match(
  runner,
  /const completedResults = partition\.completed[\s\S]*counts: countResults\(completedResults\)[\s\S]*results: completedResults\.map/,
  '最终 summary 必须集中排除 synthetic，防止 Case 0 失败伪造整批 completed',
);
assert.match(
  runner,
  /const observedResults = \[\.\.\.resultsByIndex\.entries\(\)\][\s\S]*const partition = partitionCasebookResults\(observedResults\)[\s\S]*completed: completedResults\.length[\s\S]*synthetic_diagnostics: partition\.syntheticDiagnostics\.length[\s\S]*results: completedResults/,
  '多 CDP 并行进度也必须排除 synthetic，并把它只记入非执行诊断',
);
assert.match(
  runner,
  /terminal_failure:\s*terminalFailureVerified[\s\S]*timeout_screenshot_sha256:/,
  'Core Beta v2 必须把完整等待后的无回复保存为可校验的产品失败终态，不能误报 manifest 缺失',
);
assert.deepEqual(
  coreBetaV2MaintenanceActionObservation({
    testId: 'assistant-skills-reinstall',
    busyObserved: false,
    beforeText: '一键重装 Skill',
    actionText: '一键重装 Skill\n完成：技能运行环境已清理,重物化与连接器探测在后台继续。',
  }),
  {
    observed: true,
    source: 'explicit-completion-transition',
    completion_transition: '完成：技能运行环境已清理',
  },
  '过快完成的维护动作必须用相对动作前新增的精确完成回执证明，不得因漏采 transient busy 误判',
);
assert.deepEqual(
  coreBetaV2MaintenanceActionObservation({
    testId: 'assistant-prepare-python-runtimes',
    busyObserved: false,
    beforeText: '立即检查运行时',
    actionText: '立即检查运行时\n完成：Python 0 个就绪；Node 0 个就绪',
  }),
  {
    observed: true,
    source: 'explicit-completion-transition',
    completion_transition: '完成：Python 0 个就绪；Node 0 个就绪',
  },
  '当前发布包的 Python/Node 数量完成回执必须被识别为本次运行时检查的精确状态转换',
);
assert.equal(
  coreBetaV2MaintenanceActionObservation({
    testId: 'assistant-skills-reinstall',
    busyObserved: false,
    beforeText: '完成：技能运行环境已清理',
    actionText: '完成：技能运行环境已清理',
  }).observed,
  false,
  '动作前已经存在的陈旧完成文案不能替代本次状态转换',
);
assert.deepEqual(
  coreBetaV2MaintenanceActionObservation({
    testId: 'assistant-sessions-purge',
    busyObserved: false,
    navigationObserved: true,
    beforeText: '清空全部会话(各环境)',
    actionText: '',
  }),
  {
    observed: true,
    source: 'causal-main-frame-reload',
    completion_transition: '',
  },
  '清空会话成功路径的因果主框架刷新必须作为动作信号，避免刷新销毁瞬时 busy/完成回执后误判',
);
assert.equal(
  coreBetaV2MaintenanceActionObservation({
    testId: 'assistant-skills-reinstall',
    busyObserved: false,
    navigationObserved: true,
    beforeText: '一键重装 Skill',
    actionText: '',
  }).observed,
  false,
  '通用导航不得替代没有刷新成功契约的维护动作状态转换',
);
assert.equal(
  coreBetaV2MaintenanceActiveSessionRejection('有会话正在运行,请先停止或等它结束再操作。'),
  true,
  '会话清空必须精确识别产品的中文 active-session 拒绝',
);
assert.equal(
  coreBetaV2MaintenanceActiveSessionRejection('active-session'),
  true,
  '会话清空必须兼容结构化 active-session 拒绝',
);
assert.equal(
  coreBetaV2MaintenanceActiveSessionRejection('正在清空各环境本地会话…'),
  false,
  '正常清空中状态不能误判为 active-session 拒绝',
);
assert.deepEqual(
  coreBetaV2RunningSessionQuiescenceVerdict({
    inventoryReadable: true,
    cancelFailures: [],
    runningAfter: [],
    stableIdleObservations: 3,
    minimumIdleObservations: 3,
  }),
  {
    ok: true,
    inventory_readable: true,
    cancel_failures: [],
    running_after: [],
    stable_idle_observations: 3,
    minimum_idle_observations: 3,
    reason: '全部公开会话已连续 3 次读回 idle。',
  },
  '清空前只有可读且连续稳定 idle 的会话清单可以通过',
);
assert.equal(coreBetaV2RunningSessionQuiescenceVerdict({
  inventoryReadable: false,
  stableIdleObservations: 3,
}).ok, false, '会话清单不可读时必须 fail-closed');
assert.equal(coreBetaV2RunningSessionQuiescenceVerdict({
  inventoryReadable: true,
  cancelFailures: [{ session_id: 'running-1', error: 'cancel failed' }],
  stableIdleObservations: 3,
}).ok, false, '任一 running 会话取消失败时必须 fail-closed');
assert.equal(coreBetaV2RunningSessionQuiescenceVerdict({
  inventoryReadable: true,
  runningAfter: [{ id: 'running-1', running: true }],
  stableIdleObservations: 0,
}).ok, false, '仍有 running 会话时禁止点击会话清空');
assert.match(
  runner,
  /async function quiesceCoreBetaV2RunningSessions[\s\S]*listSessions[\s\S]*getRunning[\s\S]*window\.agent\.cancel\(sessionId\)[\s\S]*minimumIdleObservations = 3[\s\S]*sessions-purge-quiescence/,
  'BETA-INIT-004 必须枚举、停止并连续读回全部公开会话 idle，同时保存独立账本与截图',
);
assert.match(
  runner,
  /maintenance\.terminal === 'sessions-empty'[\s\S]*quiesceCoreBetaV2RunningSessions\([\s\S]*clickCoreBetaV2MaintenanceAction\([\s\S]*coreBetaV2MaintenanceActiveSessionRejection\(clicked\.action_text\)[\s\S]*attempt: 2/,
  '首次 UI 清空被 active-session 拒绝时，只能在再次确认全部 idle 后执行一次 UI 重试',
);
assert.match(
  runner,
  /clickCoreBetaV2MaintenanceAction[\s\S]*attempt = 1[\s\S]*acceptCoreBetaV2MaintenanceConfirmation[\s\S]*attemptSuffix/,
  '会话清空重试必须再次通过确认弹窗并生成不覆盖首次证据的截图',
);
const completeEvidence = {
  complete: true,
  missing_roles: [],
  invalid_roles: [],
  evidence: [{
    role: 'action_receipt',
    missing: false,
    valid: true,
    sha256: 'a'.repeat(64),
  }],
};
assert.equal(
  coreBetaCompletionBlockReason(
    { id: 'BETA-CHAT-001', contract_version: 'qbot-core-beta/v2' },
    { id: 'BETA-CHAT-001', status: 'failed', result_category: 'bug', evidence_manifest: completeEvidence },
  ),
  '',
  '证据完整的真实产品失败可以进入可信放行复核，供 trusted_bug 分类',
);
assert.match(
  coreBetaCompletionBlockReason(
    internalBatchCase,
    {
      id: 'BETA-CHAT-008',
      status: 'passed',
      result_category: 'pass',
      artifacts: {
        core_beta_scenario_driver: 'conversation_dispatch_collect_20',
        core_beta_batch_dispatch: null,
        core_beta_batch_pending_pool: null,
        core_beta_batch_collect: null,
      },
      evidence_manifest: completeEvidence,
    },
  ),
  /20 条批量派发账本/,
  'BETA-CHAT-008 不得在 batch 证据全空时仅凭通用 manifest raw passed',
);
const batchCompletionRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'qbot-beta-chat-008-'));
try {
  const writeEvidence = (name, bytes = 256) => {
    const file = path.join(batchCompletionRoot, name);
    fs.writeFileSync(file, Buffer.alloc(bytes, 1));
    return file;
  };
  const dispatch = Array.from({ length: 20 }, (_item, index) => {
    const marker = `QBOT-BETA-${String(index + 1).padStart(2, '0')}-marker`;
    return {
      index,
      marker,
      prompt: `请为 ${marker} 撰写风险评估。`,
      task_id: `task-${String(index + 1).padStart(2, '0')}`,
      dispatch_screenshot: writeEvidence(`dispatch-${index + 1}.png`),
      send_receipt: {
        confirmed: true,
        confirmed_at: '2026-08-04T18:00:00.000Z',
      },
    };
  });
  const collected = dispatch.map((entry, index) => ({
    ...entry,
    terminal_outcome: index === 0 ? 'reply_oracle_mismatch' : 'reply_completed',
    terminal_at: '2026-08-04T18:01:00.000Z',
    observation_count: 2,
    last_observation: {
      active_task_id: entry.task_id,
      assistant_reply_present: true,
    },
    terminal_screenshot: writeEvidence(`terminal-${index + 1}.png`),
    ok: index !== 0,
  }));
  for (const name of [
    'batch-dispatch-ledger.json',
    'batch-pending-pool.json',
    'batch-collect-observations.ndjson',
    'batch-collect-ledger.json',
    'batch-collection-summary.json',
  ]) writeEvidence(name, 32);
  assert.equal(
    coreBetaCompletionBlockReason(
      internalBatchCase,
      {
        id: 'BETA-CHAT-008',
        status: 'failed',
        result_category: 'bug',
        case_dir: batchCompletionRoot,
        artifacts: {
          core_beta_scenario_driver: 'conversation_dispatch_collect_20',
          core_beta_batch_dispatch: dispatch,
          core_beta_batch_pending_pool: {
            available: false,
            completion_observed: false,
            expected_task_count: 20,
            minimum_pending_required: 5,
            pending_count: 4,
            observations: dispatch.map((entry, index) => ({
              task_id: entry.task_id,
              item_present: index !== 0,
            })),
            screenshot: writeEvidence('pending-pool.png'),
          },
          core_beta_batch_collect: collected,
          core_beta_batch_collection_summary: {
            terminal_evidence: {
              available: true,
              task_ids_unique: true,
              dispatch_receipts_complete: true,
              terminal_rows_complete: true,
              dispatched: 20,
            },
          },
        },
        evidence_manifest: completeEvidence,
      },
    ),
    '',
    '20 条 taskId、发送回执、待回复池和逐任务终态证据完整时，产品 Oracle 失败仍可进入可信放行复核',
  );
} finally {
  fs.rmSync(batchCompletionRoot, { recursive: true, force: true });
}
assert.match(
  coreBetaCompletionBlockReason(
    { id: 'BETA-CHAT-001', contract_version: 'qbot-core-beta/v2' },
    { id: 'BETA-CHAT-001', status: 'blocked', synthetic: true },
  ),
  /拒绝 synthetic/,
  'Core Beta synthetic 结果不得进入可信放行集合',
);
assert.match(
  coreBetaCompletionBlockReason(
    { id: 'BETA-CHAT-001', contract_version: 'qbot-core-beta/v2' },
    {
      id: 'BETA-CHAT-001',
      status: 'failed',
      result_category: 'automation_error',
      evidence_manifest: { complete: false, missing_roles: [], invalid_roles: ['action_receipt'], evidence: [] },
    },
  ),
  /拒绝不完整 manifest/,
  'manifest complete=false 或 invalid_roles 非空不得进入可信放行集合',
);
const pipelineCompletionGateSource = runner.match(
  /for \(let batchOffset = 0; batchOffset < batchResults\.length; batchOffset \+= 1\) \{[\s\S]*?if \(pipelineStopped\) break;/,
)?.[0] || '';
assert.match(
  pipelineCompletionGateSource,
  /const batchEntry = executedPipelineBatch\[batchOffset\];[\s\S]*const batchCase = batchEntry\?\.testCase;[\s\S]*coreBetaCompletionBlockReason\(batchCase, result\)/,
  'pipeline completed 门禁必须从实际处理批次解包 batchEntry.testCase，不能让 Core Beta manifest 校验因包装对象而被跳过',
);
assert.match(
  pipelineCompletionGateSource,
  /annotateCoreBetaExecutionResult\([\s\S]*persistCasebookProgress\([\s\S]*persistCaseResult\(result\)/,
  'pipeline 路径必须先记录每个 Case 的明确结果和执行进度，再评估批次级故障',
);
const serialResultSource = runner.match(
  /const result = await executeCasebookCase\([\s\S]*?if \(isCdpDisconnectedResult\(result\)/,
)?.[0] || '';
assert.match(
  serialResultSource,
  /annotateCoreBetaExecutionResult\([\s\S]*results\.push\(result\)[\s\S]*persistCasebookProgress\([\s\S]*persistCaseResult\(result\)[\s\S]*coreBetaBatchStopReason/,
  '串行路径必须先落盘当前 Case 的明确结果，再检查仅限批次级的停止条件',
);
assert.match(
  serialResultSource,
  /if \(hardStopReason\) \{[\s\S]*results\.at\(-1\) === result[\s\S]*results\.pop\(\)[\s\S]*stopRemainderWithoutSynthetic/,
  '批次级硬停止 Case 必须保留独立诊断文件，但不能继续计入 completed 结果',
);
assert.doesNotMatch(
  serialResultSource,
  /if \(completionBlock\) \{[\s\S]*stopRemainderWithoutSynthetic/,
  'Case 级 completion/evidence 缺口不得直接截断串行后续 Case',
);
assert.match(
  runner,
  /function stopRemainderWithoutSynthetic(?=[\s\S]*framework-stop-diagnostic\.json)(?=[\s\S]*synthetic: false)/,
  'Core Beta 硬停止必须保留诊断且不得批量生成 synthetic completed',
);
assert.match(
  runner,
  /async function executeCompoundCasebookCase[\s\S]*if \(hardStop\) \{[\s\S]*compoundBatchStopReason = hardStop[\s\S]*break;[\s\S]*state\.batch_stop_reason = compoundBatchStopReason/,
  'compound 叶子检测到批次级更新风险后必须立即停止后续叶子并传播到根 runner',
);
assert.doesNotMatch(
  runner,
  /function appendSyntheticRemainder/,
  '旧 synthetic remainder 写入路径必须移除',
);
const missingFixtureAudit = await inspectCoreBetaFixtureReadiness({
  cases: [coreBetaPipelineCase('BETA-PROJECT-001', 'project_lifecycle')],
});
assert.equal(missingFixtureAudit.ok, false, '完整产品 adapter 未配置时必须在 Case 0 前失败');
assert.match(missingFixtureAudit.reason, /full_product_gate_adapter/, '预检必须明确列出缺失的完整产品 adapter');
const fixtureWithoutExecutorAudit = await inspectCoreBetaFixtureReadiness({
  options: { 'restart-command': 'true' },
  cases: [coreBetaPipelineCase('BETA-PERF-006', 'performance_capacity')],
});
assert.equal(
  fixtureWithoutExecutorAudit.ok,
  false,
  '本地 restart fixture 就绪不能冒充完整性能容量执行器',
);
assert.match(
  fixtureWithoutExecutorAudit.reason,
  /managed_runtime_restart/,
  '扩展域缺少逐 Case 执行器时必须要求严格控制器',
);
const coreBetaFixtureServer = http.createServer(async (request, response) => {
  if (request.url === '/v1/core-beta/preflight' && request.method === 'POST') {
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    const payload = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(JSON.stringify({
      ok: true,
      ready_adapters: ['full_product_gate_adapter'],
      ready_cases: payload.cases.map((item) => ({
        case_id: item.case_id,
        driver: item.driver,
        executor_route: item.executor_route,
        contract_sha256: item.contract_sha256,
        action_ids: item.action_ids,
        evidence_roles: item.evidence_roles,
        oracle_sha256s: item.oracle_sha256s,
      })),
    }));
    return;
  }
  response.writeHead(404);
  response.end();
});
await new Promise((resolve) => coreBetaFixtureServer.listen(0, '127.0.0.1', resolve));
const fixtureAddress = coreBetaFixtureServer.address();
const readyFixtureAudit = await inspectCoreBetaFixtureReadiness({
  options: { 'core-beta-fixture-control-url': `http://127.0.0.1:${fixtureAddress.port}` },
  cases: [coreBetaPipelineCase('BETA-PROJECT-001', 'project_lifecycle')],
});
await new Promise((resolve) => coreBetaFixtureServer.close(resolve));
assert.equal(readyFixtureAudit.ok, true, 'fixture controller 必须通过显式 adapter 握手才能放行');
assert.match(
  runner,
  /SAFE_NATIVE_ARTIFACT_PREVIEW_INFO_MESSAGE[\s\S]*safeNativeRecoverableInfoDialog[\s\S]*SAFE_NATIVE_ATTACHMENT_INFO_MESSAGE[\s\S]*SAFE_NATIVE_ARTIFACT_PREVIEW_INFO_MESSAGE[\s\S]*SAFE_NATIVE_ACKNOWLEDGEMENT_LABEL/,
  '全局弹窗清理必须精确覆盖附件拒绝与 HTML 预览失败，并只确认 OK/确定/知道了按钮',
);
assert.match(
  runner,
  /teamsAccessibilitySheet[\s\S]*processes\.byName\('360Teams'\)[\s\S]*role = 'AXSheet'[\s\S]*result\.buttons\.length === 1[\s\S]*\^\(OK\|确定\|知道了\)\$[\s\S]*safeButton\.click\(\)/,
  'Core Beta v2 必须通过 360Teams AXSheet 读取文案，并且只点击唯一安全确认按钮',
);
assert.match(
  runner,
  /(?=[\s\S]*stageAttachmentPathsThroughComposer[\s\S]*nativeEvidence\.capture\(evidenceFile, dialogMessage, nativeFile\))(?=[\s\S]*message_matched: messageMatched)(?=[\s\S]*confirmation_clicked)(?=[\s\S]*sheet_closed_after_confirmation)(?=[\s\S]*postDismissalScreenshot)/,
  'Core Beta v2 附件拒绝必须绑定 Playwright 与 AXSheet 文案并验证点击后关闭',
);
assert.match(
  runner,
  /(?=[\s\S]*playwrightAllowlisted[\s\S]*dialogType === 'alert')(?=[\s\S]*action = 'playwright_accept_fallback'[\s\S]*await dialog\.accept\(\))(?=[\s\S]*playwright_dialog[\s\S]*observed_before_confirmation[\s\S]*evidence_captured_before_accept[\s\S]*page_responsive_after)(?=[\s\S]*dialogFallbackEvidenceRecorded)/,
  'AXSheet 不可见时只允许证据完整的白名单 Playwright alert fallback',
);
assert.match(
  runner,
  /executeCasebookCase[\s\S]{0,800}dismissAllBlockingOverlays\(page, state\)[\s\S]{0,120}clearUi\(page\)[\s\S]{0,120}dismissAllBlockingOverlays\(page, state\)/,
  '每条 Case 必须先处理残留原生/Agent 弹窗，再执行通用键盘和 DOM 清理',
);
const attachmentMatrixStart = runner.indexOf('async function executeCoreBetaAttachmentCase');
const attachmentMatrixEnd = runner.indexOf('async function executeCoreBetaAttachmentLimitsRecovery', attachmentMatrixStart);
const attachmentMatrixSource = runner.slice(attachmentMatrixStart, attachmentMatrixEnd);
assert.match(
  attachmentMatrixSource,
  /coreBetaAttachmentRejectionMatrixVerdict\(results\)[\s\S]*composer-attachment-state\.json/,
  'BETA-FILE-006 必须聚合逐 probe verdict 并单独落盘 Composer 空态证据',
);
assert.match(
  runner,
  /executeSitHomeAttachmentLimit[\s\S]*coreBetaPreSendAttachmentRejectionEvidence[\s\S]*pre-send-attachment-rejection\.json[\s\S]*core_beta_not_applicable_roles/,
  'SIT-HOME-043/044 必须物化 Case 绑定的发送前附件拒绝 N/A 证据',
);
assert.doesNotMatch(
  attachmentMatrixSource,
  /message_count_before|message_count_after|send_count_before|send_count_after/,
  'BETA-FILE-006 不得跨三次新建草稿比较全局消息计数并制造假失败',
);
assert.equal(caseAwareReplyAssertion(
  pipelineCase('SIT-HOME-061'),
  { prompt: '先给3步执行计划，再给检查清单。', label: '第一轮' },
  '第 1 步：数据核对\n第 2 步：用户反馈分析\n第 3 步：结论落地\n检查清单：数据核对、用户反馈、风险、负责人、截止时间。',
).ok, true, '计划判定应识别“第 1 步/第 2 步/第 3 步”格式');
assert.equal(caseAwareReplyAssertion(
  pipelineCase('SIT-HOME-062'),
  { prompt: '缺少收入和成本时怎么算 ROI？', label: '第一轮' },
  '当前无法计算。ROI = （活动带来的收益 − 活动成本） / 活动成本 × 100%，请补充收入与成本。',
).ok, true, 'ROI 判定应接受带业务修饰词和全角括号的等价公式');
const sitHome062ActualReply = [
  '这个 ROI 我目前算不出来——不是缺算法，而是缺两个关键输入。',
  '仅凭「240 报名 / 170 到场」无法得出 ROI。',
  'ROI 公式是：（总回报 − 总投入）÷ 总投入。',
  '缺的数据：总投入（成本）；成交金额（或 成交单数 × 客单价）。',
  '请补充总投入金额，以及成交总额或成交单数和客单价。',
].join('\n');
assert.equal(caseAwareReplyAssertion(
  pipelineCase('SIT-HOME-062'),
  { prompt: '这次活动有240人报名、170人到场，请告诉我ROI是多少。', label: '第一轮' },
  sitHome062ActualReply,
).ok, true, 'ROI 判定应接受真实回复中的总回报/总投入/成交金额等价表达');
const sitHome062CannotCalculateReply = [
  '仅凭「报名 240 人、到场 170 人」这两个数，算不出 ROI。',
  'ROI =（活动带来的收入 − 活动总成本）÷ 活动总成本 × 100%',
  '目前缺少活动总成本和活动带来的成交金额（收入），请补充这两个输入。',
].join('\n');
assert.equal(caseAwareReplyAssertion(
  pipelineCase('SIT-HOME-062'),
  { prompt: '这次活动有240人报名、170人到场，请告诉我ROI是多少。', label: '第一轮' },
  sitHome062CannotCalculateReply,
).ok, true, 'ROI 判定应把“算不出 ROI”识别为明确的数据不足边界');
const sitHome062BareInvestmentReply = [
  'ROI 需要「收入」和「投入」两个金额，仅凭报名 240 人、到场 170 人暂时算不出 ROI。',
  '活动总投入（成本）和活动带来的收入是两个必要输入。',
  '补齐后，ROI =（收入 − 投入）÷ 投入。',
].join('\n');
assert.equal(caseAwareReplyAssertion(
  pipelineCase('SIT-HOME-062'),
  { prompt: '这次活动有240人报名、170人到场，请告诉我ROI是多少。', label: '第一轮' },
  sitHome062BareInvestmentReply,
).ok, true, 'ROI 判定应接受真实回复使用裸词“投入”的等价公式');
const sitHome062RepeatedPrefixAndExampleReply = [
  '这个数据目前算不出 ROI。',
  'ROI 公式是 ROI =（活动收入 − 活动成本）÷ 活动成本。',
  '还缺收入和成本两类输入。',
  '比如「成交 25 单 × 客单价 2000 元，总成本 3 万」，可用于演示，不能当作本次活动事实。',
].join('\n');
assert.equal(caseAwareReplyAssertion(
  pipelineCase('SIT-HOME-062'),
  { prompt: '这次活动有240人报名、170人到场，请告诉我ROI是多少。', label: '第一轮' },
  sitHome062RepeatedPrefixAndExampleReply,
).ok, true, 'ROI 判定应接受“公式是 ROI =”重复前缀，并区分明确示例金额与真实金额');
const sitHome062PossessiveFormulaActualReply = [
  '计算 ROI 需要有投入成本和带来收益两个数字，仅凭报名 240 人、到场 170 人算不出来。先把能算的给出：',
  '到场率 = 170 ÷ 240 ≈ 70.8%（到场转化不错）',
  '但 ROI 的公式是：ROI =（带来收入 − 总投入）÷ 总投入，比如投入 5 万、带来收入 8 万，ROI = (8−5)/5 = 60%',
  '请补两个数，我就能直接算：',
  '总投入成本是多少？（场地、物料、人力、投放等合计）',
  '带来的收益是多少？（成交额/带来的销售收入，有毛利润口径也可以按利润算）',
  '另外，如果你手头有这次活动的成交单数或成交金额，一起给我，我可以用 ROI 之外再补一个投入回报的单产视角（如每到场人带来的收入）。',
].join('\n');
assert.equal(caseAwareReplyAssertion(
  pipelineCase('SIT-HOME-062'),
  { prompt: '这次活动有240人报名、170人到场，请告诉我ROI是多少。', label: '第一轮' },
  sitHome062PossessiveFormulaActualReply,
).ok, true, 'ROI 判定应接受本轮真实回复中的“ROI 的公式是”自然表达');
const sitHome062InvestmentCostActualReply = [
  'ROI 是财务指标,光有报名和到场人数算不出来。',
  'ROI 公式:ROI = (收益 − 投入成本) ÷ 投入成本 × 100%',
  '报名 240 人、到场 170 人属于活动漏斗的参与数据(到场率约 70.8%),但它不包含任何钱的信息。我这边记住的活动数据也只有报名/到场这类人数,没有成本或营收,所以无法从记忆里补出 ROI。',
  '要算出 ROI,还需要两个数:',
  '活动总投入成本——场地、物料、推广、人力等',
  '活动带来的收益——成交金额/营收,或"成交单数 × 客单价"',
  '把这两个数给我,我可以直接帮你算出 ROI;如果目前只有成交单数没有金额,也可以先给你一个估算口径。',
].join('\n\n');
assert.equal(caseAwareReplyAssertion(
  pipelineCase('SIT-HOME-062'),
  { prompt: '这次活动有240人报名、170人到场，请告诉我ROI是多少。', label: '第一轮' },
  sitHome062InvestmentCostActualReply,
).ok, true, 'ROI 判定应接受最新真实回复使用“投入成本”的等价公式');
const sitHome062RevenueActualReply = [
  '本次报名 240 人、到场 170 人，可以算出到场率，但这只是转化漏斗指标，不是 ROI。',
  '计算 ROI 需要「收益」和「投入」两个数，目前这两项都缺失，所以没法直接给出 ROI 数字。',
  'ROI = (活动带来的总营收 − 活动总投入) ÷ 活动总投入 × 100%',
  '举个例子：如果总投入 3 万、总营收 6 万，则 ROI = (6万−3万) ÷ 3万 = 100%。',
  '请补充活动总营收（或成交金额）与活动总投入。',
].join('\n');
assert.equal(caseAwareReplyAssertion(
  pipelineCase('SIT-HOME-062'),
  { prompt: '这次活动有240人报名、170人到场，请告诉我ROI是多少。', label: '第一轮' },
  sitHome062RevenueActualReply,
).ok, true, 'ROI 判定应接受本轮真实回复使用“活动带来的总营收”的等价公式');
assert.equal(caseAwareReplyAssertion(
  pipelineCase('SIT-HOME-062'),
  { prompt: '这次活动有240人报名、170人到场，请告诉我ROI是多少。', label: '第一轮' },
  '当前无法计算。请补充活动总投入和活动总营收。ROI =（活动总投入 − 活动带来的总营收）÷ 活动总投入。',
).ok, false, '扩展“总营收”操作数后仍必须拒绝回报与投入顺序颠倒的公式');
assert.equal(caseAwareReplyAssertion(
  pipelineCase('SIT-HOME-062'),
  { prompt: '这次活动有240人报名、170人到场，请告诉我ROI是多少。', label: '第一轮' },
  '当前无法计算。请补充总投入和带来收入。ROI 的公式是：ROI =（总投入 − 带来收入）÷ 总投入。',
).ok, false, '扩展“带来收入”操作数后仍必须拒绝回报与投入顺序颠倒的公式');
assert.equal(caseAwareReplyAssertion(
  pipelineCase('SIT-HOME-062'),
  { prompt: '这次活动有240人报名、170人到场，请告诉我ROI是多少。', label: '第一轮' },
  '当前无法计算。请补充投入成本和收益。ROI 公式：ROI =（投入成本 − 收益）÷ 投入成本。',
).ok, false, '扩展“投入成本”操作数后仍必须拒绝回报与投入顺序颠倒的公式');
const sitHome062RejectsPriorFactsReply = [
  '先算能算的：到场转化率为 170 / 240 = 70.8%，但这不是 ROI。',
  'ROI =（活动带来的成交额 − 总投入）÷ 总投入 × 100%。',
  '目前缺少总投入，以及成交单数、客单价或成交额。',
  '我不会拿历史活动的数据（比如上次成交 12 单）来推算这次。',
].join('\n');
assert.equal(caseAwareReplyAssertion(
  pipelineCase('SIT-HOME-062'),
  { prompt: '这次活动有240人报名、170人到场，请告诉我ROI是多少。', label: '第一轮' },
  sitHome062RejectsPriorFactsReply,
).ok, true, 'ROI 判定应接受成交额操作数，并区分拒绝借用旧事实与实际借用');
assert.equal(caseAwareReplyAssertion(
  pipelineCase('SIT-HOME-062'),
  { prompt: '这次活动有240人报名、170人到场，请告诉我ROI是多少。', label: '第一轮' },
  `${sitHome062RepeatedPrefixAndExampleReply}\n对比上一组活动：报名100人、到场70人，三个渠道是短信 / 企业微信 / App 弹窗。`,
).ok, false, 'ROI 判定必须拒绝从旧任务借用活动数字或渠道事实');
assert.equal(caseAwareReplyAssertion(
  pipelineCase('SIT-HOME-062'),
  { prompt: '这次活动有240人报名、170人到场，请告诉我ROI是多少。', label: '第一轮' },
  '仅凭报名和到场无法计算 ROI，请补充总投入和成交金额。',
).ok, false, 'ROI 判定不得接受缺少计算公式的回复');
assert.equal(caseAwareReplyAssertion(
  pipelineCase('SIT-HOME-062'),
  { prompt: '这次活动有240人报名、170人到场，请告诉我ROI是多少。', label: '第一轮' },
  '目前无法计算 ROI，只缺总投入。ROI =（总回报 - 总投入）/ 总投入。',
).ok, false, 'ROI 公式中的回报操作数不得替代对回报侧缺失输入的明确说明');
assert.equal(caseAwareReplyAssertion(
  pipelineCase('SIT-HOME-062'),
  { prompt: '这次活动有240人报名、170人到场，请告诉我ROI是多少。', label: '第一轮' },
  '目前无法计算 ROI，请补充总投入。计算方法稍后提供。',
).ok, false, 'ROI 判定不得接受只识别成本输入的回复');
assert.equal(caseAwareReplyAssertion(
  pipelineCase('SIT-HOME-062'),
  { prompt: '这次活动有240人报名、170人到场，请告诉我ROI是多少。', label: '第一轮' },
  '目前无法计算 ROI，请补充成交金额。计算方法稍后提供。',
).ok, false, 'ROI 判定不得接受只识别回报输入的回复');
assert.equal(caseAwareReplyAssertion(
  pipelineCase('SIT-HOME-062'),
  { prompt: '这次活动有240人报名、170人到场，请告诉我ROI是多少。', label: '第一轮' },
  '当前无法计算。ROI =（总回报 - 总投入）/ 总投入，请补充总投入和成交金额；先假设总投入为2万元。',
).ok, false, 'ROI 判定不得接受编造金额的回复');
assert.equal(caseAwareReplyAssertion(
  pipelineCase('SIT-HOME-062'),
  { prompt: '这次活动有240人报名、170人到场，请告诉我ROI是多少。', label: '第一轮' },
  '当前无法计算。请补充总投入和成交金额。ROI =（总投入 - 总回报）/ 总投入。',
).ok, false, 'ROI 判定不得接受回报与投入顺序颠倒的公式');
assert.equal(caseAwareReplyAssertion(
  pipelineCase('SIT-HOME-062'),
  { prompt: '这次活动有240人报名、170人到场，请告诉我ROI是多少。', label: '第一轮' },
  '当前无法计算。请补充投入和收入。ROI =（投入 − 收入）÷ 投入。',
).ok, false, '裸词投入兼容不得放行操作数顺序颠倒的公式');
assert.equal(caseAwareReplyAssertion(
  pipelineCase('SIT-HOME-064'),
  { prompt: '输出固定四列三行 Markdown 表格。', label: '第一轮' },
  '事项\t负责人\t截止日期\t状态\n核对报名数据\t张三\t7月18日\t进行中\n复核短信到达率\t李四\t7月19日\t未开始\n提交复盘\t王五\t7月20日\t未开始',
).ok, true, 'Markdown 表格判定应接受 QWork 渲染后 DOM 的四列制表符文本');

assert.equal(webSearchQualityVerdict(
  [
    '标题：更新 A',
    '发布日期：2026-07-20',
    '官方链接：https://openai.com/news/update-a',
    '摘要：OpenAI 官方发布的产品更新 A。',
    '',
    '标题：更新 B',
    '发布日期：2026-07-18',
    '官方链接：https://openai.com/index/update-b',
    '摘要：OpenAI 官方发布的产品更新 B。',
  ].join('\n'),
  '网页搜索 qbot_web 已完成',
).ok, true, 'Web 搜索质量门禁应接受带官方链接、日期和真实工具证据的回复');
assert.equal(webSearchQualityVerdict(
  '最近更新很多，但这里不提供来源。',
  '',
).ok, false, 'Web 搜索质量门禁不得接受无来源、无日期、无工具证据的模型自述');
const webCapabilityPrompt = '请使用内置 Web 搜索查找两条官方更新。';
const webCapabilityTaskId = 'task-web-001';
const webCapabilityQuality = {
  case_id: 'MRSMOKE-WEB-001',
  legacy_case_id: 'SIT-CONN-019',
  task_id: webCapabilityTaskId,
  prompt: webCapabilityPrompt,
  prompt_sha256: createHash('sha256').update(webCapabilityPrompt).digest('hex'),
  reply: '正文即使声称调用 qbot_web，也不能单独形成能力证据。',
  runtimeEvidence: {
    diagnostics: {
      sessionId: webCapabilityTaskId,
      e2eCurrentTurnAuthorityReadiness: { ready: true },
      e2eCurrentTurnAuthority: {
        executionTarget: 'desktop-local',
        routeTarget: 'desktop-local',
        connectorRouting: {
          mode: 'auto',
          effectiveConnectorIds: ['builtin:qbot_web'],
        },
        connectorRuntimeMaterialization: {
          materializedConnectorIds: ['builtin:qbot_web'],
          unsupportedConnectorIds: [],
        },
        providerReceiptHash: 'a'.repeat(64),
      },
    },
  },
  verdict: { ok: true, toolEvidence: true },
};
const webCapabilitySendReceipts = [{
  prompt: webCapabilityPrompt,
  confirmed_at: '2026-08-24T00:00:00.000Z',
  attempts: [{
    receipt: {
      ok: true,
      snapshot: {
        activeId: webCapabilityTaskId,
        userTexts: [webCapabilityPrompt],
      },
    },
  }],
}];
const verifiedLegacyWebCapability = coreBetaVerifiedLegacyWebCapabilityEvidence({
  caseId: 'MRSMOKE-WEB-001',
  legacyCaseId: 'SIT-CONN-019',
  quality: webCapabilityQuality,
  task: { case_id: 'MRSMOKE-WEB-001', task_id: webCapabilityTaskId },
  sendReceipts: webCapabilitySendReceipts,
  sourceEvidence: { path: '/case/web-search-quality.json', bytes: 100, sha256: 'b'.repeat(64) },
});
assert.equal(verifiedLegacyWebCapability.selection_valid, true, '结构化当前轮 Web 路由权威应注册能力选择证据');
assert.equal(verifiedLegacyWebCapability.execution_valid, true, 'task-bound provider receipt 应注册能力执行证据');
assert.equal(verifiedLegacyWebCapability.execution.capability.id, 'builtin:qbot_web');
const preMaterializationWebCapability = coreBetaVerifiedLegacyWebCapabilityEvidence({
  caseId: 'MRSMOKE-WEB-001',
  legacyCaseId: 'SIT-CONN-019',
  quality: webCapabilityQuality,
  task: {},
  sendReceipts: webCapabilitySendReceipts,
});
assert.equal(
  preMaterializationWebCapability.selection_valid,
  true,
  'verified-legacy trace 早于 task-id.json 物化时必须从唯一确认发送回执绑定 taskId',
);
assert.equal(preMaterializationWebCapability.execution_valid, true);
assert.equal(preMaterializationWebCapability.task_id, webCapabilityTaskId);
const textOnlyWebCapability = coreBetaVerifiedLegacyWebCapabilityEvidence({
  caseId: 'MRSMOKE-WEB-001',
  legacyCaseId: 'SIT-CONN-019',
  quality: {
    ...webCapabilityQuality,
    runtimeEvidence: { diagnostics: { sessionId: webCapabilityTaskId } },
  },
  task: { case_id: 'MRSMOKE-WEB-001', task_id: webCapabilityTaskId },
  sendReceipts: webCapabilitySendReceipts,
});
assert.equal(textOnlyWebCapability.selection_valid, false, '回复中的 Web 工具自述不得冒充 runtime 能力选择');
assert.equal(textOnlyWebCapability.execution_valid, false, '缺少 runtime authority/provider receipt 时不得注册执行事件');
const driftedWebCapability = coreBetaVerifiedLegacyWebCapabilityEvidence({
  caseId: 'MRSMOKE-WEB-001',
  legacyCaseId: 'SIT-CONN-019',
  quality: webCapabilityQuality,
  task: { case_id: 'MRSMOKE-WEB-001', task_id: 'other-task' },
  sendReceipts: webCapabilitySendReceipts,
});
assert.equal(driftedWebCapability.evidence_valid, false, 'Web 能力证据 taskId 漂移必须 fail-closed');
const ambiguousReceiptWebCapability = coreBetaVerifiedLegacyWebCapabilityEvidence({
  caseId: 'MRSMOKE-WEB-001',
  legacyCaseId: 'SIT-CONN-019',
  quality: webCapabilityQuality,
  task: {},
  sendReceipts: [
    ...webCapabilitySendReceipts,
    {
      ...webCapabilitySendReceipts[0],
      attempts: [{
        receipt: {
          ok: true,
          snapshot: {
            activeId: 'other-task',
            userTexts: [webCapabilityPrompt],
          },
        },
      }],
    },
  ],
});
assert.equal(
  ambiguousReceiptWebCapability.evidence_valid,
  false,
  '同 prompt 存在多个确认 taskId 时不得猜测 verified-legacy Web 能力归属',
);
assert.equal(memoryLifecycleVerdict({
  markdownReply: '默认格式是 Markdown。',
  excelReply: '默认格式已改为 Excel。',
  deletedReply: '目前没有固定偏好，请指定格式。',
}).ok, true, '记忆门禁应接受跨任务读取、修改和删除均正确的证据');
assert.equal(memoryLifecycleVerdict({
  markdownReply: '默认格式是 Markdown。',
  excelReply: '默认格式仍是 Markdown。',
  deletedReply: '默认格式是 Excel。',
}).ok, false, '记忆门禁必须拒绝旧值残留或删除后继续注入');
assert.equal(caseAwareReplyAssertion(
  pipelineCase('SIT-MEM-001'),
  { prompt: '我的默认测试报告格式是什么？', label: '新任务读取 Excel 偏好' },
  '根据你此前的设定，你的默认测试报告格式是 Excel。',
).ok, true, 'MEM-001 的直接偏好回答不应被通用相关性规则误报');
assert.equal(caseAwareReplyAssertion(
  pipelineCase('SIT-MEM-001'),
  { prompt: '如果没有记录，请明确说没有固定偏好。', label: '新任务验证偏好已删除' },
  '当前没有关于默认测试报告格式的固定偏好记录。',
).ok, true, 'MEM-001 删除后的直接回答应通过确定性用例断言');

const betaChatStopCase = { id: 'BETA-CHAT-006', scenario: '回复生成中停止后保留已生成内容' };
const betaChatStopTurn = { label: '停止后继续追问', prompt: '请只总结你已经写出的三条关键结论。' };
assert.equal(caseAwareReplyAssertion(
  betaChatStopCase,
  betaChatStopTurn,
  '需要如实说明：在本轮 QBot 测试方案上下文中，当前可总结的三条关键结论尚未完整成文。',
).ok, true, 'BETA-CHAT-006 对同任务已生成内容的直接说明不应被通用相关性误报');
assert.equal(caseAwareReplyAssertion(
  betaChatStopCase,
  betaChatStopTurn,
  '今天天气晴朗，适合户外活动。',
).ok, false, 'BETA-CHAT-006 仍必须拦截与停止后追问无关的回复');

const partialReplyReady = coreBetaPartialReplyReady({
  running: true,
  cancelVisible: true,
  baselineAssistantBodyText: '',
  latestAssistantBodyText: '第一章：测试目标',
});
assert.equal(partialReplyReady.ready, true, '运行态中的非空可见增量应允许停止');
assert.equal(partialReplyReady.delta_chars > 0, true);
assert.equal(coreBetaPartialReplyReady({
  running: true,
  cancelVisible: true,
  latestAssistantBodyText: '思考',
  minimumChars: 4,
}).ready, false, '过短的状态文本不能冒充可保留的部分回复');
assert.equal(coreBetaPartialReplyReady({
  running: true,
  cancelVisible: true,
  latestAssistantText: 'Let me understand what the user is asking for. This is reasoning, not the assistant answer.',
  latestAssistantBodyText: '',
}).ready, false, '长 reasoning 摘要也不能冒充助手正文触发停止');
assert.equal(coreBetaPartialReplyReady({
  running: false,
  cancelVisible: false,
  latestAssistantBodyText: '第一章：测试目标',
}).ready, false, '非运行态不能执行停止点击');

const detachedStopRetry = coreBetaStopControlRaceVerdict({
  expectedTaskId: 'task-stop-race-1',
  observedTaskId: 'task-stop-race-1',
  publicStateAvailable: true,
  running: true,
  cancelVisible: true,
  clickPerformed: false,
  clickAttempts: 1,
  maxClickAttempts: 2,
});
assert.equal(detachedStopRetry.valid, true, '旧停止控件 detached 后，同 task 当前停止控件仍可见时应允许重新定位');
assert.equal(detachedStopRetry.retry, true, '旧 locator 失败后只允许对同 task 的最新可见停止控件重试');
assert.equal(detachedStopRetry.outcome, 'retry_current_control');
const naturalCompletionBeforeStop = coreBetaStopControlRaceVerdict({
  expectedTaskId: 'task-stop-race-1',
  observedTaskId: 'task-stop-race-1',
  publicStateAvailable: true,
  running: false,
  cancelVisible: false,
  clickPerformed: false,
  clickAttempts: 1,
  maxClickAttempts: 2,
});
assert.equal(naturalCompletionBeforeStop.valid, true, '点击前同 task 自然完成必须形成受支持终态');
assert.equal(naturalCompletionBeforeStop.outcome, 'completed_before_stop');
assert.equal(naturalCompletionBeforeStop.stop_action_performed, false, '自然完成不得伪造停止点击');
assert.equal(coreBetaStopControlRaceVerdict({
  expectedTaskId: 'task-stop-race-1',
  observedTaskId: 'task-stop-race-2',
  publicStateAvailable: true,
  running: true,
  cancelVisible: true,
  clickAttempts: 1,
  maxClickAttempts: 2,
}).valid, false, '停止控件重定位前 task 漂移必须 fail-closed');
assert.equal(coreBetaStopControlRaceVerdict({
  expectedTaskId: 'task-stop-race-1',
  observedTaskId: 'task-stop-race-1',
  publicStateAvailable: true,
  running: true,
  cancelVisible: false,
  clickAttempts: 2,
  maxClickAttempts: 2,
}).valid, false, '同 task 仍运行但最新停止控件不可见时不得继续等待 stale locator');

const stopTimeoutEvidenceDir = fs.mkdtempSync(path.join(os.tmpdir(), 'qbot-stop-timeout-'));
try {
  const timeoutScreenshot = path.join(stopTimeoutEvidenceDir, 'partial-reply-timeout.png');
  fs.writeFileSync(timeoutScreenshot, Buffer.alloc(256, 1));
  const validStopTimeout = {
    taskId: 'task-stop-timeout-1',
    runningBefore: true,
    cancelVisible: true,
    waitedMs: 90_001,
    timeoutMs: 90_000,
    confirmedSendReceipt: true,
    timeoutScreenshot,
  };
  assert.equal(
    coreBetaStopGenerationTimeoutVerdict(validStopTimeout).valid,
    true,
    '停止生成 Case 等满 90 秒仍无助手正文时，应形成证据完整的产品超时失败',
  );
  for (const invalid of [
    { ...validStopTimeout, waitedMs: 59_999 },
    { ...validStopTimeout, taskId: '' },
    { ...validStopTimeout, confirmedSendReceipt: false },
    { ...validStopTimeout, timeoutScreenshot: '' },
  ]) {
    assert.equal(
      coreBetaStopGenerationTimeoutVerdict(invalid).valid,
      false,
      `停止生成超时证据缺少硬前置时必须 fail-closed：${JSON.stringify(invalid)}`,
    );
  }
  const beforeStopScreenshot = path.join(stopTimeoutEvidenceDir, 'before-stop.png');
  const afterStopScreenshot = path.join(stopTimeoutEvidenceDir, 'after-stop.png');
  fs.writeFileSync(beforeStopScreenshot, Buffer.alloc(256, 2));
  fs.writeFileSync(afterStopScreenshot, Buffer.alloc(256, 3));
  const stoppedReadback = {
    task_id: 'task-user-stopped-1',
    task_id_before: 'task-user-stopped-1',
    task_id_after: 'task-user-stopped-1',
    confirmed_send_receipt: true,
    click_performed: true,
    running_before: true,
    running_after: false,
    partial_reply_ready_before_click: true,
    before_screenshot: beforeStopScreenshot,
    after_screenshot: afterStopScreenshot,
  };
  const stoppedTerminal = coreBetaStoppedTurnTerminalEvidence({
    readback: stoppedReadback,
    prompt: '请生成长方案',
    confirmedPrompt: '请生成长方案',
    partialText: '第一章：测试目标',
    retainedText: '第一章：测试目标',
  });
  assert.equal(stoppedTerminal.evidence_complete, true, '同 task、同 prompt 且 partial 保留时 user_stopped 证据必须完整');
  assert.equal(stoppedTerminal.complete, false, '用户停止不能伪装成普通 completed');
  assert.equal(stoppedTerminal.terminal_failure, false, '用户主动停止不是模型失败终态');
  assert.equal(coreBetaStoppedTurnTerminalEvidence({
    readback: { ...stoppedReadback, task_id_after: 'drifted-task' },
    prompt: '请生成长方案',
    confirmedPrompt: '请生成长方案',
    partialText: '第一章：测试目标',
    retainedText: '第一章：测试目标',
  }).evidence_complete, false, '停止前后 task 漂移必须 fail-closed');
  assert.equal(coreBetaStoppedTurnTerminalEvidence({
    readback: stoppedReadback,
    prompt: '请生成长方案',
    confirmedPrompt: '另一条消息',
    partialText: '第一章：测试目标',
    retainedText: '第一章：测试目标',
  }).evidence_complete, false, '确认发送 prompt 不匹配时必须 fail-closed');
} finally {
  fs.rmSync(stopTimeoutEvidenceDir, { recursive: true, force: true });
}

const activityReviewFacts = ['12000', '860', '240', '170', '28'];
const activityReviewFactLines = ['触达 12,000', '打开 860', '报名 240', '到场 170', '投诉 28'];
assert.equal(
  artifactTextHasFacts(activityReviewFactLines.join('\n'), activityReviewFacts),
  true,
  'SIT-ART-022 必须接受真实成果中的千分位原始数据',
);
assert.equal(artifactTextHasFacts('触达 12_000\n打开 860\n报名 240\n到场 170\n投诉 28', activityReviewFacts), true, '成果原始数据必须兼容下划线分组符');
assert.equal(artifactTextHasFacts('触达 12，000\n打开 860\n报名 240\n到场 170\n投诉 28', activityReviewFacts), true, '成果原始数据必须兼容中文逗号分组符');
for (let index = 0; index < activityReviewFactLines.length; index += 1) {
  assert.equal(
    artifactTextHasFacts(activityReviewFactLines.filter((_, lineIndex) => lineIndex !== index).join('\n'), activityReviewFacts),
    false,
    `SIT-ART-022 缺少第 ${index + 1} 项原始数据时必须失败`,
  );
}

const required = [
  ['逐次发送前模型校验', /async function send[\s\S]*ensureModelTier\(page, state, state\.case_dir[\s\S]*model_tier_before_send[\s\S]*const selectors/],
  ['模型复核后恢复并精确校验真实发送文本', /async function send[\s\S]*prompt_fidelity_before_send[\s\S]*restored[\s\S]*检测到输入区仍是旧草稿/],
  ['发送必须确认产品回执且第三次仅在安全条件下回退键盘 Enter', /(?=[\s\S]*async function send)(?=[\s\S]*attempt <= 3)(?=[\s\S]*composer-keyboard-enter)(?=[\s\S]*waitForSendReceipt)(?=[\s\S]*sendRetryIsSafe)(?=[\s\S]*未被产品接收)/],
  ['发送重试必须证明既无新增用户消息也无辅助变化', /function sendRetryIsSafe[\s\S]*!evidence\.has_new_expected_user[\s\S]*!evidence\.auxiliary_evidence[\s\S]*noObservedSendMutation && composerStillExact/],
  ['cwd 删除专项必须把动作绑定的产品未接收终态材料化为有效负向发送证据', /(?=[\s\S]*executeWorkspaceMissingCwdReadback[\s\S]*allowWorkspaceProductRejection: true[\s\S]*expectedTaskId: taskId)(?=[\s\S]*workspaceRejectedSendReceiptEvidence[\s\S]*sendReceiptRecordEvidenceValid)(?=[\s\S]*evidenceValid \? 'bug' : 'automation_error')/],
  ['contenteditable 使用 fill 同步受控草稿状态', /async function fillComposer[\s\S]*editable[\s\S]*await input\.fill\(text\)[\s\S]*输入区文本与期望不一致/],
  ['可信度审计使用逐次发送前证据', /preSendTierChecks[\s\S]*successfulSendCount[\s\S]*preSendTierChecks\.length < successfulSendCount/],
  ['HOME-007 专项执行', /SIT-HOME-007'[\s\S]*executeSitHomeSkillOnly/],
  ['今日 #793/#800 使用独立本地产品断言', /SIT-ISSUE-793'[\s\S]*executeIssue793StreamingScrollFollow[\s\S]*SIT-ISSUE-800'[\s\S]*executeIssue800ModelServiceStateConsistency/],
  ['#793 生成中采样滚动位置并保存正式性能证据', /(?=[\s\S]*executeIssue793StreamingScrollFollow)(?=[\s\S]*thread-scroll-samples\.json)(?=[\s\S]*performance-metrics\.json)(?=[\s\S]*artifacts\.performance_metrics)(?=[\s\S]*streamingScrollPerformanceMetrics)(?=[\s\S]*issue-793-streaming-scroll-drift)/],
  ['#793 采样期间持续原子落盘发送绑定和性能 checkpoint', /(?=[\s\S]*function writeIssue793AtomicJson)(?=[\s\S]*fs\.renameSync\(temporary, file\))(?=[\s\S]*function writeIssue793StreamingCheckpoint)(?=[\s\S]*writeIssue793AtomicJson\(state\.artifacts\.thread_scroll_samples)(?=[\s\S]*writeIssue793AtomicJson\(state\.artifacts\.performance_metrics)(?=[\s\S]*writeIssue793AtomicJson\(checkpointFile)(?=[\s\S]*qbot-core-beta-issue-793-streaming-checkpoint\/v1)(?=[\s\S]*confirmedSendReceiptTaskId)(?=[\s\S]*last_conversation_snapshot)(?=[\s\S]*performance_metrics_valid)(?=[\s\S]*page\.isClosed\(\))(?=[\s\S]*phase: 'renderer_closed')(?=[\s\S]*new Promise\(\(resolve\) => setTimeout\(resolve, 750\)\))/],
  ['#793 部分正文超时先固化终态再受管停止', /executeIssue793StreamingScrollFollow[\s\S]*streamingTerminalReplyEvidence[\s\S]*issue-793-\$\{replyEvidence\.screenshot_file_suffix[\s\S]*writeReplyArtifacts\(state, caseDir, \[replyRecord\]\)[\s\S]*recordReplyAssertions\(state, testCase, prompt, replyRecord[\s\S]*replyRecord\.terminal_outcome === 'timed_out'[\s\S]*cancelRunningReplyAfterTimeout\(page, state, caseDir, '长文本流式回复'\)/],
  ['#800 多轮采样不可达状态与回复增长', /(?=[\s\S]*executeIssue800ModelServiceStateConsistency)(?=[\s\S]*model-service-state-samples\.json)(?=[\s\S]*growthAfterUnavailable)/],
  ['HOME-008 专项执行且不被 reset 清空连接器', /SIT-HOME-008'[\s\S]*executeSitHomeConnectorOnly[\s\S]*连接器 only 前置真实生效/],
  ['HOME-020 不走附件泛化路由', /SIT-HOME-020'[\s\S]*executeSitHomePrdBoundary/],
  ['HOME-023 记录真实停止点击', /recordStep\(state, '点击停止生成'/],
  ['Core Beta v2 停止生成使用独立助手正文提取器', /async function assistantBodyTexts/],
  ['Core Beta v2 分支回复采集不依赖 message-list 包装', /conversationMessageTimeline[\s\S]*page\.locator\('\[data-testid="assistant-thread"\] \[data-role="user"\], \[data-testid="assistant-thread"\] \[data-role="assistant"\]'\)/],
  ['Core Beta v2 已按 prompt 绑定的短回复不受通用长度门槛拦截', /const hasDelta = promptBoundCandidate[\s\S]*cleanDelta\.length > 0[\s\S]*cleanDelta\.length > 15/],
  ['Core Beta v2 确定性相关性先于通用短文本拒绝', /for \(const \[scenarioPattern, replyPattern\] of targetedRules\)[\s\S]*if \(text\.length < 15\) return false/],
  ['Core Beta v2 助手正文提取明确排除 reasoning', /const excluded = '[^']*aui_reasoning[^']*'/],
  ['Core Beta v2 停止生成只消费助手正文字段', /latestAssistantBodyText/],
  ['Core Beta v2 停止生成观察正文 partial 并读回保留内容', /coreBetaPartialReplyReady[\s\S]*partial-reply-precondition-readback\.json[\s\S]*partial_reply_ready_before_click[\s\S]*clickCurrentStopGenerationControl[\s\S]*retained_chars[\s\S]*stop-generation-readback\.json/],
  ['Core Beta v2 停止控件每次点击前重新定位且点击有短超时', /(?=[\s\S]*clickCurrentStopGenerationControl)(?=[\s\S]*lastVisibleLocator)(?=[\s\S]*currentCancel\.click\(\{ force: true, timeout: clickTimeoutMs \}\))(?=[\s\S]*maxClickAttempts = 2)/],
  ['Core Beta v2 停止点击前自然完成写齐标准会话证据且不伪造点击', /(?=[\s\S]*if \(stopClick\.outcome === 'completed_before_stop'\))(?=[\s\S]*stop_action_performed: false)(?=[\s\S]*stop-generation-readback\.json)(?=[\s\S]*writeReplyArtifacts\(state, caseDir)/],
  ['SIT-HOME-023 用户停止生成写齐标准会话证据且不伪装 completed', /executeSitHomeStopGeneration[\s\S]*coreBetaStoppedTurnTerminalEvidence[\s\S]*terminal_outcome: 'user_stopped'[\s\S]*writeReplyArtifacts\(state, caseDir/],
  ['user_stopped 标准回复证据校验 prompt task partial 与截图闭环', /function writeReplyArtifacts[\s\S]*userStoppedCandidate[\s\S]*validateReplyCompletionPayload\(userStoppedCandidate\)[\s\S]*replyCompletion\.evidence_complete = evidenceComplete/],
  ['Core Beta v2 停止生成无正文完整超时后写齐失败证据再隔离清理', /(?=[\s\S]*if \(!partial\.ready\))(?=[\s\S]*terminal_outcome: 'timed_out')(?=[\s\S]*writeReplyArtifacts\(state, caseDir)(?=[\s\S]*cancelRunningReplyAfterTimeout)(?=[\s\S]*cleanup_click_is_case_action: false)(?=[\s\S]*超时失败证据完整，隔离清理成功。`?, 'bug'\))/],
  ['runner 控制面代理安装与恢复完整', /createControlPlaneFaultProxy[\s\S]*restart-qbot-electron-control-plane\.sh[\s\S]*installControlPlaneHttpControl[\s\S]*restoreControlPlaneHttpControl/],
  ['控制面代理重启显式传递原 DEEPBANK_HOME', /inferQbotHomeForElectronRestart[\s\S]*\[helper, qbotRoot, controlPlaneUrl, cdpPort, qbotHome\]/],
  ['重启场景异常证据使用最新 runtime page', /catch \(error\) \{[\s\S]*page = runtime\?\.page \|\| page;[\s\S]*99-error/],
  ['连接器 reset 对禁用/自动模式直达且只在隔离路径接受 Auto 空态', /if \(connectorMode === 'disabled' \|\| connectorMode === 'auto'\)[\s\S]*setConnectorMode\(page, state, caseDir, connectorMode, \{[\s\S]*allowAutoEmptyIsolation: true[\s\S]*else \{[\s\S]*clearManualConnectorSelections/],
  ['连接器模式切换使用新 DOM 和能力状态轮询', /async function setConnectorMode[\s\S]*const freshLocator = await connectorModeLocator[\s\S]*capabilities\?\.connectorRouting\?\.mode[\s\S]*'automation_error'/],
  ['HOME-025 使用控制面代理可控失败注入', /executeSitHomeFailureRecovery[\s\S]*pathExact: '\/api\/desktop-agent\/turn-context'[\s\S]*mode: 'network-error'[\s\S]*restoreControlPlaneHttpControl/],
  ['HOME-030 真实打开并使用控制面代理 dry-run 快速反馈', /executeSitHomeQuickFeedback[\s\S]*pathExact: '\/api\/feedback-issues\/intake'[\s\S]*composer-feedback[\s\S]*quick-feedback-panel[\s\S]*quick_feedback_dry_run/],
  ['HOME-030 在 Teams 全量 Fixture 中强制使用渲染层代理', /executeSitHomeQuickFeedback[\s\S]*forceRendererAdapter: true[\s\S]*installControlPlaneHttpControl[\s\S]*forceRendererAdapter \|\| options\['renderer-control-adapter'\] === 'teams360'/],
  ['HOME-052 精确点击打开本地工作空间并取消原生选择器', /executeSitHomeWorkspacePicker[\s\S]*getByRole\('button', \{ name: \/\^\\s\*打开本地工作\(\?:空间\|文件夹\)\\s\*\$\/[\s\S]*osascript/],
  ['HOME-052 禁止按 pick class 第一项误点新建工作空间', /executeSitHomeWorkspacePicker[\s\S]*getByRole\('button'[\s\S]*打开本地工作[\s\S]*dismissCoreBetaV2WorkspaceCreationObstruction[\s\S]*residual_dialog_closed/],
  ['技能安装终态绑定当前 Skill identity', /skillInstallIdentityTerminalVerdict[\s\S]*安装中\|准备中\|物化中\|待物化[\s\S]*waitForSkillInstallTerminal[\s\S]*identityTerminal/],
  ['成果任务使用本轮独立可见工作区', /prepareVisibleQaWorkspace[\s\S]*runDirName[\s\S]*fs\.rmSync\(workspace, \{ recursive: true, force: true \}\)/],
  ['成果预览拒绝受保护路径误判', /artifactPreviewReadable[\s\S]*受保护路径[\s\S]*expectedContent\.test/],
  ['显式 Case timeout 可为全部真实 Agent/工具调用提供十分钟上限', /MAX_REPLY_WAIT_MS = 600000[\s\S]*ATTACHMENT_ARTIFACT_REPLY_WAIT_MS = 600000[\s\S]*LONG_CONTEXT_REPLY_WAIT_MS = 600000[\s\S]*MULTI_TURN_REPLY_WAIT_MS = 600000[\s\S]*SIT-HOME-016[\s\S]*requestedBudget = Number\.isFinite\(requested\)[\s\S]*Math\.max\(MIN_REPLY_WAIT_MS, requestedBudget\)/],
  ['连接器刷新失败注入', /executeSitConnectorRefreshFailure[\s\S]*pathIncludes: '\/api\/connectors\/catalog\?refresh=force'[\s\S]*mode: 'network-error'[\s\S]*restoreControlPlaneHttpControl/],
  ['技能安装中断注入', /executeSitSkillNetworkInterrupt[\s\S]*pathExact: '\/api\/skills\/install'[\s\S]*controlled network interruption[\s\S]*restoreControlPlaneHttpControl/],
  ['已选连接器不健康快照注入', /executeSitConnectorUnhealthySelectedState[\s\S]*pathPrefix: '\/api\/capabilities'[\s\S]*connector-needs-auth[\s\S]*connector_unhealthy_snapshot/],
  ['手动连接器选择不按“手动使用/默认自动”描述误过滤', /selectFirstManualConnector[\s\S]*\.ctool-list \.ctool-opt:not\(\[disabled\]\)[\s\S]*hasNotText: \/不生效\|不可用\|未接入\|无匹配\|暂无连接器\//],
  ['专家手动创建优先稳定 testid 并兼容两代文案', /executeExpertSmoke006[\s\S]*\[data-testid="expert-create-manual"\][\s\S]*手动填表创建\|高级手动创建[\s\S]*async function openManualCreateExpertModal[\s\S]*\[data-testid="expert-create-manual"\][\s\S]*手动填表创建\|高级手动创建/],
  ['专家入口在已激活构建页时先返回专家中心', /function coreBetaExpertBuilderReturnSelectorCandidates[\s\S]*expert-builder-back[\s\S]*async function returnFromExpertBuilderIfNeeded[\s\S]*返回专家中心[\s\S]*async function openExpertsPage[\s\S]*returnFromExpertBuilderIfNeeded/],
  ['技能入口在已激活构建页时先返回专家中心', /async function openSkillsPage[\s\S]*returnFromExpertBuilderIfNeeded/],
  ['Core Beta Expert执行器不得绕过构建页返回', /async function executeCoreBetaExpertCase[\s\S]{0,500}nav-experts[\s\S]{0,300}returnFromExpertBuilderIfNeeded[\s\S]{0,300}experts-view/],
  ['日常回归原生Expert执行器不得绕过构建页返回', /async function qworkDailyExpertCatalogCase[\s\S]{0,500}returnFromExpertBuilderIfNeeded[\s\S]*async function qworkDailyExpertLifecycleCase[\s\S]{0,500}returnFromExpertBuilderIfNeeded/],
  ['Core Beta Skill执行器不得绕过构建页返回', /async function openCoreBetaSkillSurface\(page, state\)[\s\S]{0,500}returnFromExpertBuilderIfNeeded[\s\S]*executeCoreBetaSkillCase[\s\S]*openCoreBetaSkillSurface\(page, state\)/],
  ['专家手动创建提交优先稳定 testid 并兼容创建或保存草稿', /executeExpertSmoke008[\s\S]*expertCreateSubmitButton[\s\S]*async function expertCreateSubmitButton[\s\S]*expert-create-submit[\s\S]*创建\|保存草稿[\s\S]*captureExpertCreateFormEvidence[\s\S]*expert-create-submit[\s\S]*创建\|保存草稿[\s\S]*submitExpertCreateAndAssertVisible[\s\S]*expertCreateSubmitButton/],
  ['稳定 QA 专家固定名不可见时使用本轮唯一名', /summonFirstExpertForCase[\s\S]*QBot QA 产品运营专家-\$\{new Date\(\)\.toISOString\(\)[\s\S]*findExpertCardByName\(page, expertName\)/],
  ['专家创建成功只认真实专家卡片', /waitForExpertCreateOutcome[\s\S]*Boolean\(await findExpertCardByName\(page, name\)\)/],
  ['纯 UI 用例不强制会话证据', /REPLY_EVIDENCE_OPTIONAL_CASE_IDS[\s\S]*SIT-HOME-050[\s\S]*requiresConversationEvidence = !replyEvidenceOptional/],
  ['有证据缺口的 passed 不误报未知状态', /else if \(reasons\.length\)[\s\S]*自动化证据或执行链路未通过可信度校验/],
  ['HOME-050 搜索前设置唯一标题', /SIT-HOME-050'[\s\S]*自动化搜索-[\s\S]*session-rename-input/],
  ['HOME-056 hover 后点击真实附件移除按钮', /executeSitHomeDeleteOneAttachment[\s\S]*root\.hover[\s\S]*aui-attachment-tile-remove[\s\S]*不点击泛化 button/],
  ['EXPERT-012 hover 后识别最近召唤移除按钮', /executeSitExpertRecentSummon[\s\S]*recentItem\.hover[\s\S]*exp-recent-del/],
  ['SKILL-013 卡片无入口时走安全个人设置立即对账', /executeSitSkillMaterialization[\s\S]*openCoreBetaV2SystemSettings[\s\S]*assistant-reconcile-skills[\s\S]*assistant-reconcile-result/],
  ['SKILL-013 只按唯一 Fixture 标识定位', /executeSitSkillMaterialization[\s\S]*QA Materialization Pending\|qa-materialization-pending[\s\S]*受控 QA SkillHub/],
  ['三张图片用例使用互异真实 PNG', /SIT-HOME-038'[\s\S]*qbot-image-test\.png[\s\S]*qbot-image-flow\.png[\s\S]*qbot-image-risk\.png/],
  ['#668/#669 七条统一进入受控 Fixture 路由', /\^SIT-SKILL-0\(\?:27\|28\|29\|30\|31\|32\|33\)\$[\s\S]*executeSkillRegressionFixtureCase/],
  ['#668 三条 Fixture 内自动化路由完整', /executeSkillRegressionFixtureCase[\s\S]*SIT-SKILL-027'[\s\S]*executeSitSkillRejectedExplicitRetry[\s\S]*SIT-SKILL-028'[\s\S]*executeSitSkillAuditRejectNoAutoRetry[\s\S]*SIT-SKILL-029'[\s\S]*executeSitSkillRejectedUninstallCleanup/],
  ['#669 四条 Fixture 内自动化路由完整', /executeSkillRegressionFixtureCase[\s\S]*SIT-SKILL-030'[\s\S]*executeSitSkillDependencyCascadeSuccess[\s\S]*SIT-SKILL-031'[\s\S]*executeSitSkillDependencyAlreadyInstalled[\s\S]*SIT-SKILL-032'[\s\S]*executeSitSkillDependencyFailureBlocksRoot[\s\S]*SIT-SKILL-033'[\s\S]*executeSitSkillDependencyCycle/],
  ['输入区菜单按类型锚点隔离', /COMPOSER_MENU_ANCHORS[\s\S]*composer-skill-mode-[\s\S]*composer-connector-mode-[\s\S]*composer-safety-level-option-[\s\S]*activeMenuLocator\(page, menuKind[\s\S]*menuKind === 'workMode'[\s\S]*WORK_MODE_LABELS/],
  ['统一加号菜单使用稳定 section testid 与最新可见 Portal', /UNIFIED_COMPOSER_SUBMENUS[\s\S]*section: 'mode'[\s\S]*section: 'skill'[\s\S]*section: 'connector'[\s\S]*lastVisibleLocator[\s\S]*visibleUnifiedComposerSubmenu[\s\S]*composer-plus-section-\$\{config\.section\}/],
  ['统一加号子菜单把可见空态识别为合法 Portal', /visibleUnifiedComposerSubmenu[\s\S]*emptySelector[\s\S]*coreBetaUnifiedSubmenuSurfaceReady[\s\S]*emptyVisible/],
  ['统一加号子菜单支持 hover click ArrowRight Enter 四路打开', /openUnifiedComposerSubmenu[\s\S]*\.hover\(\{ force: true \}\)[\s\S]*pointermove[\s\S]*\.click\(\{ force: true \}\)[\s\S]*ArrowRight[\s\S]*Enter/],
  ['统一加号子菜单对完整开启流程执行三次有界重试', /openUnifiedComposerSubmenuOnce[\s\S]*async function openUnifiedComposerSubmenu[\s\S]*attempt = 1; attempt <= 3[\s\S]*openUnifiedComposerSubmenuOnce[\s\S]*closeWorkspacePicker[\s\S]*250 \* attempt/],
  ['统一技能和连接器子菜单持续不可见时显式记录框架失败', /setUnifiedSkillMode[\s\S]*submenu_attempts: 3[\s\S]*统一菜单技能子菜单可打开[\s\S]*automation_error[\s\S]*setUnifiedConnectorMode[\s\S]*submenu_attempts: 3[\s\S]*统一菜单连接器子菜单可打开[\s\S]*automation_error/],
  ['手动连接器模式真实点击并读回列表 routing 或 radio', /setUnifiedConnectorMode[\s\S]*composer-connector-mode-manual[\s\S]*manual\.click[\s\S]*composer-plus-list[\s\S]*composer-connector-option-[\s\S]*currentCapabilities[\s\S]*coreBetaManualConnectorModeReady/],
  ['新版连接器直接列表以 section、列表与公开选择状态三重读回', /setUnifiedConnectorMode[\s\S]*coreBetaDirectConnectorListModeReady[\s\S]*composer-plus-section-connector[\s\S]*direct_list_contract[\s\S]*selected_connectors/],
  ['新版技能直接列表以 section、搜索列表与公开选择状态三重读回', /setUnifiedSkillMode[\s\S]*coreBetaDirectSkillListReady[\s\S]*composer-plus-section-skill[\s\S]*direct_list_contract[\s\S]*selected_skills/],
  ['日常回归首个技能和连接器点击后必须按稳定 identity 读回公开选择', /selectFirstManualSkill[\s\S]*composer-skill-option-[\s\S]*selectedSkills[\s\S]*expectedIdentity[\s\S]*selectFirstManualConnector[\s\S]*composer-connector-option-[\s\S]*selectedConnectors[\s\S]*connectorKey/],
  ['SIT-SKILL-007 v2 使用可见选择、句内 chip、公开读回与移除闭环', /executeSkillSmoke007[\s\S]*记录新任务默认技能状态[\s\S]*selectFirstManualSkill[\s\S]*composerSkillSelectionSnapshot[\s\S]*Skill chip 与公开状态一致[\s\S]*skill-chip-x[\s\S]*Skill 移除后 UI 与状态同步清空/],
  ['BETA-MCP-002 手动选择后必须分离证据有效性与产品Oracle并注册选择/执行证据', /mcp_cross_surface_identity_reconcile[\s\S]*connectorMode: 'manual'[\s\S]*selectManualConnectorByKey[\s\S]*public_readback: \{ before, after \}[\s\S]*coreBetaMcpCrossSurfaceOutcome[\s\S]*capability-selection\.json[\s\S]*state\.artifacts\.capability_selection = selectionFile[\s\S]*state\.artifacts\.capability_execution_event = selectionFile[\s\S]*MCP跨表面负向取证完整/],
  ['连接器唯一选择优先 renderer 稳定 testid 并读回 selectedConnectors', /coreBetaConnectorOptionTestId[\s\S]*selectManualConnectorByKey[\s\S]*exactByTestId[\s\S]*coreBetaSelectedCapabilityIdentities[\s\S]*selectedConnectors/],
  ['统一菜单隐藏三态时仅以公共能力桥隔离用例前置状态', /setUnifiedSkillMode[\s\S]*setSkillsAuto[\s\S]*setSkillsDisabled[\s\S]*capabilities\.selectedSkills[\s\S]*setUnifiedConnectorMode[\s\S]*setConnectorsAuto[\s\S]*setConnectorsDisabled[\s\S]*connectorRouting\.mode/],
  ['新版统一菜单手动技能与连接器选择器可执行', /selectFirstManualSkill[\s\S]*composer-plus-skill[\s\S]*selectFirstManualConnector[\s\S]*composer-plus-connector/],
  ['Core Beta v2 精确选择 Skill 前会重新打开被同级控件关闭的最新技能菜单', /selectManualSkillByName[\s\S]*let menu = await activeMenuLocator\(page, 'skill'\)[\s\S]*if \(!menu\) \{[\s\S]*ensureComposerToolMenu\(page, state,[\s\S]*重新打开【技能】菜单以选择：[\s\S]*menuKind: 'skill'[\s\S]*menu = await activeMenuLocator\(page, 'skill'\)/],
  ['精确 Skill 点击失败记录受校验的产品交互读回', /selectManualSkillByName[\s\S]*stage: 'manual_skill_selection'[\s\S]*control_testid: controlTestId[\s\S]*click_dispatched: clickDispatched[\s\S]*expected_state_observed: selectedOk[\s\S]*manual_surface: afterManualSurface \|\| beforeManualSurface[\s\S]*category: interactionCategory/],
  ['输入区 reset 保留能力产品失败分类', /resetComposerControls[\s\S]*coreBetaComposerResetFailureCategory[\s\S]*failure_category/],
  ['输入区 reset 保留后续能力操作覆盖前的失败交互', /resetComposerControls[\s\S]*preserveCoreBetaFailedCapabilityInteraction[\s\S]*failed_interactions/],
  ['QWD-ENTRY-002 发送前产品失败物化完整负向证据', /qworkDailyNewTaskAutoIsolationCase[\s\S]*materializeQworkDailyPreSendResetFailure[\s\S]*qwork_daily_readback[\s\S]*composer_attachment_state[\s\S]*data_integrity_readback/],
  ['QWD-ENTRY-002 能力空库存形成完整前置证据后继续', /materializeQworkDailyCapabilityInventoryPrerequisite[\s\S]*capability-inventory-prerequisite\.json[\s\S]*core_beta_not_applicable_roles[\s\S]*qwork_daily_readback[\s\S]*qworkDailyNewTaskAutoIsolationCase[\s\S]*materializeQworkDailyCapabilityInventoryPrerequisite/],
  ['QWD-WS-001 精确路径 A/B 与任务 identity 原生闭环', /selectQworkDailyWorkspace[\s\S]*\.wspick-path[\s\S]*path\.resolve[\s\S]*qworkDailyWorkspaceTaskBindingCase[\s\S]*QWORK_WORKSPACE_A_MARKER[\s\S]*QWORK_WORKSPACE_B_MARKER[\s\S]*saveWorkspace[\s\S]*listSessions[\s\S]*cleanupQworkDailyWorkspaceFixture/],
  ['QWD-WS-001 发送前产品失败完整物化且不抛异常覆盖', /qworkDailyWorkspaceSelectionFailureEvidence[\s\S]*workspace-selection-product-failure\.json[\s\S]*core_beta_not_applicable_roles[\s\S]*materializeQworkDailyWorkspaceSelectionFailure[\s\S]*return;/],
  ['QWD-WS-001 B 阶段失败保留 A 会话证据并重开同一任务', /materializeQworkDailySecondWorkspaceSelectionFailure[\s\S]*task_a:[\s\S]*reopenSessionAndReadback[\s\S]*reopened_task_a/],
  ['QWD-WS-001 无论路径如何都在 finally 定向清理 A/B', /qworkDailyWorkspaceTaskBindingCase[\s\S]*finally \{[\s\S]*cleanupQworkDailyWorkspaceFixture[\s\S]*qwork_workspace_fixture_cleanup/],
  ['QWD-EXPERT-009 组织可见范围产品拒绝形成零发送 Bug 证据', /qworkDailyExpertLifecycleCase[\s\S]*product_rejection[\s\S]*qworkDailyExpertAudienceRejectionEvidence[\s\S]*expert-audience-product-rejection\.json[\s\S]*core_beta_not_applicable_roles/],
  ['普通 Skill 使用的精确选择产品失败会物化零发送证据', /executeCoreBetaSkillCase[\s\S]*selectManualSkillByName[\s\S]*stage === 'manual_skill_selection'[\s\S]*category === 'bug'[\s\S]*materializeCoreBetaPreSendCapabilityFailure/],
  ['Skill 隔离用例的精确选择产品失败会物化零发送证据', /executeCoreBetaSkillIsolationCase[\s\S]*selectManualSkillByName[\s\S]*stage === 'manual_skill_selection'[\s\S]*category === 'bug'[\s\S]*materializeCoreBetaPreSendCapabilityFailure/],
  ['SIT Skill 隔离 legacy driver 的库存不一致会物化零发送证据', /executeSitSkillScopeIsolation[\s\S]*beforeSelection[\s\S]*selectManualSkillByName[\s\S]*stage === 'manual_skill_selection'[\s\S]*category === 'bug'[\s\S]*materializeCoreBetaPreSendCapabilityFailure/],
  ['Skill 安装拒绝记录目标身份、明确失败和已安装列表读回', /installFirstSkillFromMarket[\s\S]*stage: 'skill_installation'[\s\S]*failure_feedback:[\s\S]*installed_list_readback:[\s\S]*installed_list_screenshot:[\s\S]*category: interactionCategory/],
  ['SIT-SKILL-025 安装与手动选择产品失败均物化零发送证据', /executeSitSkillInstallThenManual[\s\S]*beforeInstall[\s\S]*stage === 'skill_installation'[\s\S]*materializeCoreBetaPreSendCapabilityFailure[\s\S]*beforeManualSelection[\s\S]*'manual_mode', 'manual_skill_selection'[\s\S]*materializeCoreBetaPreSendCapabilityFailure/],
  ['发送前能力产品失败以零发送合同补齐 N/A', /materializeCoreBetaPreSendCapabilityFailure[\s\S]*core_beta_not_applicable_roles/],
  ['发送前能力产品失败使用受校验证据协议', /qbot-core-beta-pre-send-capability-failure\/v1/],
  ['输入区工具操作主动关闭残留工作空间菜单', /resetComposerControls[\s\S]*closeWorkspacePicker\(page\)[\s\S]*ensureComposerToolMenu[\s\S]*await closeWorkspacePicker\(page\)[\s\S]*async function closeWorkspacePicker/],
  ['技能模式切换使用新 DOM 轮询', /async function setSkillMode[\s\S]*const freshLocator = await skillModeLocator[\s\S]*activeMenuText\(page, 'skill'\)[\s\S]*'automation_error'/],
  ['#736 单 Skill 校验句内 chip、选择状态和 marker 泄露', /executeSitSkillManualSelect[\s\S]*composerSkillSelectionSnapshot[\s\S]*composer-skill-chip-[\s\S]*selectedSkillCount === 1[\s\S]*hasRawMarker/],
  ['#736 多 Skill 执行 2→1→2 删除恢复闭环', /executeSitSkillMultiSelect[\s\S]*skill_026_before_removal[\s\S]*skill_026_after_removal[\s\S]*selectedSkillCount === 1[\s\S]*skill_026_after_restore[\s\S]*selectedSkillCount === 2/],
  ['#736 多 Skill 删除按钮限定在输入区 chip 内', /const firstChip = composer\.locator\([\s\S]*aria-label\^="移除"/],
  ['技能安装以真实删除或卸载按钮优先判定成功', /waitForSkillInstallTerminal[\s\S]*installedAction[\s\S]*return \{ terminal: true, success: true[\s\S]*catalogInstalled[\s\S]*identityTerminal/],
  ['回复等待尊重显式 Case timeout', /const requestedBudget = Number\.isFinite\(requested\)[\s\S]*\? requested : budget[\s\S]*Math\.max\(MIN_REPLY_WAIT_MS, requestedBudget\)/],
  ['同 Case 多次受控重启保留不可覆盖的逐次日志', /restartEvidenceName[\s\S]*restart-command-\$\{restartEvidenceName\}\.stdout\.log[\s\S]*state\.artifacts\.restart_commands\.push/],
  ['Teams 渲染层控制适配器保留请求体证据', /installRendererControlAdapter[\s\S]*requestArgs[\s\S]*requestBody/],
  ['项目 Fixture 创建后通过真实导航刷新而非 reload WebView', /createProject bridge[\s\S]*nav-new-task[\s\S]*refreshedProjectsNav/],
  ['旧版项目占位页改走可见空间入口并回读项目成果', /executeLegacyProjectArtifactTask[\s\S]*sidebar-space-project-[\s\S]*runPromptInCurrentTask[\s\S]*getSessionArtifacts[\s\S]*项目成果持久化关联项目任务/],
  ['知识入口兼容 nav-more 且占位页归为产品缺口', /(?=[\s\S]*knowledgeNavigationLocator[\s\S]*nav-knowledge[\s\S]*nav-more)(?=[\s\S]*知识页按任务汇总正式成果)(?=[\s\S]*后续开放)/],
  ['成果数字事实统一兼容分组符', /(?=[\s\S]*export function artifactTextHasFacts)(?=[\s\S]*SIT-ART-022[\s\S]*artifactTextHasFacts\(content, \['12000', '860', '240', '170', '28'\]\))/],
  ['对话创建专家覆盖召唤和首页真实问答', /executeSitExpertConversationCreateClosedLoop[\s\S]*summonCreatedExpertByName[\s\S]*首页选择新专家后的需求评审[\s\S]*对话创建专家可从首页选择并使用/],
  ['破坏性操作精确点击新版确认按钮且缺失时不判通过', /(?=[\s\S]*confirmDestructiveAction[\s\S]*data-testid\$="-confirm"[\s\S]*custom-dialog-missing-confirm)(?=[\s\S]*\['native-confirm', 'custom-dialog'\]\.includes\(dialog\.source\))/],
  ['破坏性确认文案兼容“确定删除”与“确定要删除”', /confirmationCopy = \/确认\|确定\(\?:要\)\?\(\?:删除\|卸载\|移除\)/],
  ['SKILL-026 预装两项确定性 Fixture 并进入真实 Fixture 路由', /SIT-SKILL-026'[\s\S]*qa-python-runtime[\s\S]*qa-node-runtime[\s\S]*skill_fixture_multi_select_setup/],
  ['每次确定性 Skill Fixture 查找强制清空旧搜索并刷新市场', /searchAutomationSkillCard[\s\S]*input\.fill\(''\)[\s\S]*skills-catalog-refresh[\s\S]*refresh\.click[\s\S]*refresh_settled[\s\S]*targetDeadline[\s\S]*persistAutomationSkillCatalogLookup/],
  ['Skill Fixture 市场刷新记录目标、可见卡片与失败诊断', /searchAutomationSkillCard[\s\S]*visible_card_texts[\s\S]*errors[\s\S]*persistAutomationSkillCatalogLookup[\s\S]*qbot-automation-skill-catalog-lookups\/v1[\s\S]*evidence_valid[\s\S]*oracle_valid/],
  ['Skill Fixture 卡片出现后继续等待安装按钮恢复可点击', /waitForSkillInstallableControl[\s\S]*skillInstallControlVerdict[\s\S]*install_control_timeout[\s\S]*waitForInstallable/],
  ['技能页结束后模型档位先恢复新建任务再二次读回', /ensureModelTier[\s\S]*readModelTier[\s\S]*runtime_options_unavailable[\s\S]*openNewTask\(page, state\)[\s\S]*retry_read/],
  ['SKILL-026 只选择刚预装的两项 Fixture 而非创建技能入口', /executeSitSkillMultiSelect[\s\S]*QA Python Runtime[\s\S]*QA Node Runtime[\s\S]*selectManualSkillByName/],
  ['多 Skill 恢复前清理 chip 装饰符号', /cleanSkillChipLabel[\s\S]*✦★☆◆◇•·[\s\S]*trim\(\)/],
  ['带内联 Skill chip 的会话直接发送已准备 composer', /runPromptInCurrentTask[\s\S]*composerPrepared[\s\S]*不能再次 fill 导致 chip 与 selectedSkills 被清空/],
  ['附件源文件在上传前记录非零字节证据', /attachment_sources[\s\S]*附件源文件非空[\s\S]*size_bytes/],
  ['SIT-HOME-056 在上传前记录三附件源文件 SHA 账本', /executeSitHomeDeleteOneAttachment[\s\S]*attachment_sources = files\.map\(\(file\) => attachmentSourceRecord\(file, 'picker'\)\)[\s\S]*sourceLedgerValid[\s\S]*uploadAttachmentsInComposer\(page, files\)/],
  ['BETA-FILE-010 在上传前记录附件 SHA 并采集受管日志窗口', /executeSitFilePartialFailure[\s\S]*attachment_sources = files\.map\(\(file\) => attachmentSourceRecord\(file, 'partial_failure'\)\)[\s\S]*sourceLedgerValid[\s\S]*uploadAttachmentsInComposer\(page, files\)[\s\S]*qworkPartialAttachmentLogExcerpt/],
  ['compound 父 Case 传播具体叶子阻塞原因', /executeCompoundCasebookCase[\s\S]*compoundBlockedReason\(subcaseResults\)[\s\S]*state\.blocked_reason = blockedReason/],
  ['附件 Case 使用 Excel 真实任务而非通用提示', /attachmentTaskPromptFromCase[\s\S]*实际输入与 Case 测试数据一致/],
  ['BETA-FILE-004 使用专用三差异 XLSX fixture', /testCase\.id === 'BETA-FILE-004'[\s\S]*qbot-table\.csv[\s\S]*qbot-data-table-diff\.xlsx/],
  ['新增 UX Case 使用成功标准驱动的确定性断言', /caseAwareReplyAssertion[\s\S]*三句结构与事实落地[\s\S]*跨格式事实与决策摘要/],
  ['新增成果 Case 回读真实文件并校验列表唯一', /assertUxArtifactReadback[\s\S]*成果文件真实落地[\s\S]*成果列表唯一[\s\S]*活动复盘聊天与文件一致/],
  ['二次复核检查实际发送提示与确定性断言', /sentPromptFidelity[\s\S]*hasDeterministicAssertion[\s\S]*实际发送内容与 Case 测试数据不一致/],
  ['二次复核使用用户动作、用户结果和匹配截图四项门槛', /assessUserCenteredOutcome[\s\S]*reached_user_action[\s\S]*user_outcome_assertion[\s\S]*aligned_outcome_screenshot[\s\S]*用户影响/],
  ['运行汇总写入真实 duration_ms', /duration_ms: Math\.max\(0, endedAt\.getTime\(\) - startedAt\.getTime\(\)\)/],
  ['回复证据绑定任务和本轮用户消息', /async function waitForReply[\s\S]*expectedUserText[\s\S]*boundTaskId[\s\S]*taskDrift[\s\S]*userMessageMatchesPrompt/],
  ['回复轮询中的 WebView 操作有独立硬超时', /withReplyPollHardTimeout[\s\S]*confirmation modal inspection[\s\S]*conversation snapshot[\s\S]*generation status inspection/],
  ['Core Beta v2 截图主路径与 CDP fallback 全链路使用独立硬超时', /captureCoreBetaV2Screenshot[\s\S]*withCoreBetaScreenshotHardTimeout[\s\S]*page\.screenshot[\s\S]*newCDPSession fallback[\s\S]*Page\.captureScreenshot fallback[\s\S]*CDP screenshot session detach/],
  ['Core Beta v2 截图瞬态失败使用隔离临时文件和一次 viewport 重试', /captureCoreBetaV2Screenshot[\s\S]*attempt <= 2[\s\S]*fullPage = attempt === 1[\s\S]*mkdtempSync[\s\S]*qbot-core-beta-screenshot-[\s\S]*page\.screenshot viewport retry[\s\S]*Page\.captureScreenshot viewport retry fallback/],
  ['Core Beta v2 推荐选项按精确跳过入口处理并保留结构化证据', /assistantConfirmationSurfaceVerdict[\s\S]*option_count[\s\S]*assistant_confirmation_interactions[\s\S]*处理 Agent 推荐选项/],
  ['Core Beta v2 推荐选项点击绑定原 DOM 实例并识别同文案 replacement', /assistantConfirmationOriginalInstances[\s\S]*elementHandle[\s\S]*assistantConfirmationOriginalInstanceState[\s\S]*assistantConfirmationClickProgressVerdict[\s\S]*replacement_surface_detected/],
  ['稳定 QA 专家不存在时自动创建', /summonFirstExpertForCase[\s\S]*QBot QA 产品运营专家[\s\S]*createBasicExpert[\s\S]*稳定 QA 专家可定位/],
  ['产品类专家召唤后校验 currentExpert', /summonProductLikeExpert[\s\S]*currentCapabilities\(page\)[\s\S]*currentExpert[\s\S]*产品类专家召唤生效/],
  ['EXPERT-022 通用助手缺失进入产品断言', /executeSitExpertGeneralAssistantIsolation[\s\S]*general_assistant_entry_missing[\s\S]*second_turn:[\s\S]*not_executed: true[\s\S]*专家页通用助手入口/],
  ['EXPERT-022 材料化专家切换能力证据', /executeSitExpertGeneralAssistantIsolation[\s\S]*capability_selection\.json[\s\S]*capability_execution_event\.json[\s\S]*state\.artifacts\.capability_execution_event/],
  ['EXPERT-022 双轮任务绑定与专家清空读回', /executeSitExpertGeneralAssistantIsolation[\s\S]*current_expert_cleared[\s\S]*expertGeneralAssistantExecutionVerdict\(\{[\s\S]*firstTaskId: firstSnapshot\.activeTaskId[\s\S]*secondTaskId: secondSnapshot\.activeTaskId[\s\S]*executionVerdict\.evidence_valid[\s\S]*executionVerdict\.oracle_valid[\s\S]*same_task_as_expert_turn[\s\S]*sameTask && !leakedExpertIdentity/],
  ['EXPERT-022 通用助手点击失败形成产品负向证据', /executeSitExpertGeneralAssistantIsolation[\s\S]*expert_022_general_click_failed[\s\S]*general_assistant_click_failed[\s\S]*'通用助手入口可操作'[\s\S]*'bug'/],
  ['EXPERT-002 通用助手缺失或点击失败形成产品负向证据', /executeExpertSmoke010[\s\S]*expert_010_general_missing[\s\S]*通用助手入口可见性[\s\S]*'bug'[\s\S]*expert_010_general_click_failed[\s\S]*通用助手入口可操作[\s\S]*return;/],
  ['HOME-016 真实发送四轮业务数字', /numericMemoryConversationTurns[\s\S]*报名100人，到场70人，成交12单[\s\S]*第二轮：追问报名人数[\s\S]*第三轮：追问到场人数和到场率[\s\S]*第四轮：追问成交和成交率/],
  ['HOME-009 不选专家不执行专家回复断言', /expertScenarioText[\s\S]*不选专家\|未选专家\|不挂专家\|通用助手[\s\S]*expectsSelectedExpert/],
  ['HOME-004 到 HOME-009 统一使用稳定能力测试数据', /SIT-HOME-004'[\s\S]*SIT-HOME-009'[\s\S]*executeHomeCapabilityFixtureCase[\s\S]*qa-python-runtime[\s\S]*dev_healthy/],
  ['首页能力 Fixture 失败和结束均恢复正常环境', /executeHomeCapabilityFixtureCase[\s\S]*启动失败后恢复正常配置[\s\S]*首页能力技能 Fixture 清理[\s\S]*恢复正常首页能力配置/],
  ['Fixture 包装器等待 Case 完成后再执行 finally 清理', /executeHomeCapabilityFixtureCase[\s\S]*return await executeSitHome[\s\S]*finally[\s\S]*executeSkillRegressionFixtureCase[\s\S]*return await executeSitSkill[\s\S]*finally[\s\S]*executeConnectorRegressionFixtureCase[\s\S]*return await executeSitConnector[\s\S]*finally/],
  ['HOME-009 专项精确选择技能加连接器组合', /SIT-HOME-009'[\s\S]*selectGeneralAssistantForCase[\s\S]*qaSkill[\s\S]*selectManualSkillByName[\s\S]*QA Python Runtime[\s\S]*qaConnector[\s\S]*selectManualConnectorByKey[\s\S]*assertManualSkillSelectionPresent/],
  ['Teams HOME-004 到 HOME-009 复用正式已安装能力且不重启宿主', /renderer-control-adapter'[\s\S]*teams360[\s\S]*executeSitHome006[\s\S]*executeSitHomeSkillOnly[\s\S]*executeSitHomeConnectorOnly[\s\S]*executeSitHomeAbilityCombination/],
  ['HOME-009 使用真实组合任务而非通用问候', /promptOverride: testCase\.id === 'SIT-HOME-009'[\s\S]*实际调用当前已选的 QA Python Runtime 技能和 Dev Healthy 连接器/],
  ['HOME-010 专项执行技能连接器双自动', /SIT-HOME-010'[\s\S]*executeSitHomeAutoAbility[\s\S]*skillMode: 'auto'[\s\S]*connectorMode: 'auto'[\s\S]*自动能力活动复盘/],
  ['HOME-037 固定 PNG 漏斗数据', /SIT-HOME-037'[\s\S]*PNG 活动漏斗图[\s\S]*expectedNumbers: \['100', '70', '12'\]/],
  ['技能回归 Fixture 服务覆盖 ZIP 与依赖元数据', /createSkillHubRegressionServer[\s\S]*skillhub-regression[\s\S]*\/api\/web\/skills[\s\S]*parsedMetadataJson[\s\S]*download_failure/],
  ['原技能运行时和版本回退用例统一进入受控 Fixture 路由', /SIT-SKILL-004'[\s\S]*SIT-SKILL-005'[\s\S]*SIT-SKILL-015'[\s\S]*SIT-SKILL-022'[\s\S]*executeSkillRegressionFixtureCase/],
  ['技能运行时 Fixture 覆盖 Python、Node 和双版本', /qa-python-runtime[\s\S]*qa-node-runtime[\s\S]*qa-version-rollback[\s\S]*setActiveVersion\(slug, '2\.0\.0'\)/],
  ['Python 与 Node 安装用例按受控 Fixture 精确定位', /executeSitSkillRuntimeInstall[\s\S]*fixtureMarker = runtime === 'node' \? 'qa-node-runtime' : 'qa-python-runtime'[\s\S]*escapeRegExp\(fixtureMarker\)/],
  ['版本回退按 qa-version-rollback 和 1.0.0 精确操作', /executeSitSkillRollback[\s\S]*marker = 'qa-version-rollback'[\s\S]*skill-revert-chip[\s\S]*1\\\.0\\\.0/],
  ['拒装技能卸载兼容原生确认和产品确认弹窗', /executeSitSkillRejectedUninstallCleanup[\s\S]*confirmDestructiveAction[\s\S]*accept: true[\s\S]*同步清理本机拒装状态/],
  ['SKILL-022 同时捕获确认与异步失败反馈', /executeSitSkillDeleteFailure[\s\S]*confirmDestructiveAction[\s\S]*skill-operation-feedback[\s\S]*skill_022_uninstall_failure/],
  ['SKILL-027 在代理重启后重建拒装态并点击全局重试', /executeSitSkillRejectedExplicitRetry[\s\S]*initialInstall[\s\S]*skill-operation-feedback[\s\S]*globalRetry[\s\S]*control\.proxy\.arm/],
  ['技能回归 Fixture 用例前后均隔离清理', /(?=[\s\S]*skill_fixture_cleanup)(?=[\s\S]*skill_fixture_teardown)(?=[\s\S]*cleanupSkillRegressionFixtureState)/],
  ['SKILL-018 使用空已安装目录代理', /executeSitSkillManualEmptyState[\s\S]*skill-018-empty-installed[\s\S]*skills-empty-installed/],
  ['EXPERT-015 使用空专家市场代理', /executeSitExpertEmptyMarket[\s\S]*expert-015-empty-market[\s\S]*experts-empty-market/],
  ['CONN-014 使用空连接器目录代理', /executeSitConnectorEmptyState[\s\S]*connectors-empty-catalog[\s\S]*connector-014-empty-catalog/],
  ['连接器三态与缓存用例使用 runner 自建 Fixture', /createConnectorRegressionServer[\s\S]*executeConnectorRegressionFixtureCase[\s\S]*SIT-CONN-008'[\s\S]*SIT-CONN-009'[\s\S]*SIT-CONN-013'[\s\S]*SIT-CONN-018'/],
  ['连接器 Fixture 提供无 OAuth 的真实 MCP 工具调用', /createConnectorRegressionServer[\s\S]*tools\/list[\s\S]*dev_healthy_tool[\s\S]*tools\/call[\s\S]*fixture invocation succeeded/],
  ['Teams 文档使用权限感知 MCP 且核验两次真实调用', /SIT-TEAMS-DOC-001'[\s\S]*executeSitTeamsDocumentPermission[\s\S]*allowed-doc-a[\s\S]*denied-doc-b[\s\S]*tools\/call[\s\S]*无权限文档明确拒绝且不伪造/],
  ['Teams 文档按 key 显式选择受控连接器', /executeSitTeamsDocumentPermission[\s\S]*selectManualConnectorByKey\(page, state, caseDir, documentConnector\.key\)[\s\S]*Teams Document QA/],
  ['技能作用域使用真实技能并跨任务回读移除', /SIT-SKILL-SCOPE-001'[\s\S]*executeSitSkillScopeIsolation[\s\S]*SKILL_SCOPE_ACTIVE[\s\S]*任务 B 未继承任务 A 技能[\s\S]*reopenSessionAndReadback[\s\S]*任务 A 移除后不再投递技能/],
  ['MR Skill 组合 Driver 顺序覆盖事务账本、作用域安装与任务隔离', /SIT-SKILL-MR-001'[\s\S]*executeSitSkillMrTransactionalIsolation[\s\S]*executeSitSkillDependencyCascadeSuccess[\s\S]*executeSitSkillDependencyFailureBlocksRoot[\s\S]*qbot-skill-install-attempt-ledger\/v2[\s\S]*installScopeIsolationSkillForMr[\s\S]*executeSitSkillScopeIsolation/],
  ['MR Skill 作用域安装失败走发送前产品负向证据', /installScopeIsolationSkillForMr[\s\S]*stage: 'skill_installation'[\s\S]*installed_list_readback[\s\S]*materializeCoreBetaPreSendCapabilityFailure[\s\S]*product_failure: true/],
  ['MR Skill 作用域安装前后保持事务账本 SHA', /executeSitSkillMrTransactionalIsolation[\s\S]*ledgerShaBeforeScope[\s\S]*installScopeIsolationSkillForMr[\s\S]*ledgerShaAfterScope[\s\S]*ledgerPreserved[\s\S]*作用域 Skill 安装不得覆盖事务账本/],
  ['MR Skill 组合 Driver 冻结六个确定性 Fixture', /SIT-SKILL-MR-001'[\s\S]*qa-dep-root-success[\s\S]*qa-dep-leaf-a[\s\S]*qa-dep-leaf-b[\s\S]*qa-dep-root-failure[\s\S]*qa-dep-leaf-failure[\s\S]*qa-scope-isolation/],
  ['MR Skill v2 ledger 双 attempt 完整后才允许证据与 Oracle 有效', /(?=[\s\S]*qbot-skill-install-attempt-ledger\/v2)(?=[\s\S]*expected_attempt_count: 2)(?=[\s\S]*complete: attempts\.length === 2)(?=[\s\S]*distinct_attempt_ids)(?=[\s\S]*succeeded_commit_preserved)(?=[\s\S]*failed_attempt_inventory_clean)(?=[\s\S]*failed_attempt_history_clean)/],
  ['cwd 删除后的结构化错误证据进入 Core Beta materializer', /workspace_missing_error_readback: artifacts\.workspace_missing_error_readback \|\| null/],
  ['连接器三态前置使用产品结构化状态并兼容无 health API 的直连探测', /healthyConnector\?\.statusKind === 'ready'[\s\S]*fixtureProbe\.healthy[\s\S]*unreachableConnector\?\.statusKind === 'ready'[\s\S]*fixtureProbe\.unreachable[\s\S]*needsAuthConnector\?\.statusKind === 'needs_auth'/],
  ['嵌套控制面代理优先使用外层显式 Fixture 控制面', /active-fixture-control-plane-url[\s\S]*127\.0\.0\.1:18900[\s\S]*fixtureUpstream \|\| activeUpstream \|\| configuredUpstream/],
  ['ART-011 使用本 Case 唯一成果名并通过 E2E bridge 精确发现', /artifact_011_filename[\s\S]*deleted_preview_check_\$\{slugify\(path\.basename\(caseDir\)\)\}[\s\S]*bridge\.discoverArtifact\(file\)[\s\S]*escapeRegExp\(filename\)/],
  ['连接器健康 Fixture 默认关闭 E2E 健康短路', /enableE2eMarker = false/],
  ['连接器健康 Fixture 按 Case 显式切换服务端 E2E marker', /enableE2eMarker \? '1' : '0'/],
  ['HITL Fixture 保持外部控制面且仅启用受控宿主 mock Agent', /restartWithHitlMockAgent[\s\S]*禁止切换到本地 mock 控制面[\s\S]*parsedControlPlane\.origin[\s\S]*qbotHome[\s\S]*''[\s\S]*'1'/],
  ['CONN-013 使用非空三态 Fixture 后再注入刷新失败', /SIT-CONN-013'[\s\S]*executeConnectorRegressionFixtureCase[\s\S]*executeSitConnectorRefreshFailure/],
  ['CONN-013 刷新前验证三类缓存卡片', /executeSitConnectorRefreshFailure[\s\S]*Dev Healthy[\s\S]*Dev Unreachable[\s\S]*Dev Needs Auth[\s\S]*刷新失败前非空三态缓存夹具[\s\S]*cached_kinds_present/],
  ['CONN-012 代理重启后按 key 重选再注入', /executeSitConnectorUnhealthySelectedState[\s\S]*initiallyArmed: false[\s\S]*selectManualConnectorByKey[\s\S]*control\.proxy\.arm/],
  ['连接器 dev Fixture 缺入口进入产品断言而非阻塞', /executeSitConnectorRetry[\s\S]*unreachable 连接器重试入口[\s\S]*executeSitConnectorAuthDialog[\s\S]*needs_auth 连接器授权入口[\s\S]*executeSitConnectorManualUnhealthyOption[\s\S]*手动菜单展示不可用连接器状态/],
  ['项目成果用例创建真实项目和项目任务', /(?=[\s\S]*executeSitProjectArtifactCase)(?=[\s\S]*QBot QA 自动化项目)(?=[\s\S]*project-tasks-view)(?=[\s\S]*project-task-launch)(?=[\s\S]*project_result\.md)(?=[\s\S]*project_weekly_report\.md)/],
  ['项目详情态可直接复用而不误找创建按钮', /executeSitProjectArtifactCase[\s\S]*workspaceAlreadyVisible[\s\S]*复用当前已打开项目详情[\s\S]*proceed directly to runtime/],
  ['bridge 创建项目后重挂载 Teams 项目列表再从 UI 打开', /createProject[\s\S]*nav-new-task[\s\S]*nav-projects[\s\S]*project-card-/],
  ['项目入口缺失进入产品断言而非数据阻塞', /executeSitProjectArtifactCase[\s\S]*项目导航入口[\s\S]*项目任务输入与启动入口/],
  ['受控 Fixture/代理失败统一归自动化错误', /框架无法安装控制面代理会话失败注入[\s\S]*automation_error[\s\S]*框架无法构造专家空市场[\s\S]*automation_error[\s\S]*框架无法构造“无已安装技能”视图[\s\S]*automation_error[\s\S]*框架无法安装控制面代理连接器状态注入[\s\S]*automation_error[\s\S]*框架无法构造连接器空目录[\s\S]*automation_error/],
  ['处理器直接终止的失败不会被收尾逻辑覆盖成通过', /function finalizeState\(state\) \{[\s\S]*state\.status === 'failed' && state\.actual_result[\s\S]*state\.status = 'passed'/],
  ['工具进度与安全错误码不误判重复', /新建文件\|编辑文件\|写入文件[\s\S]*错误码\|状态码\|error code/],
  ['ART-003 仅识别结构化内部事件泄漏', /rawArtifactEventLeakEvidence[\s\S]*artifact_delta[\s\S]*artifactPath\|artifactId\|artifactType/],
  ['HOME-029 使用真实提示词增强且禁止自动发送', /SIT-HOME-029'[\s\S]*executeSitHomePromptEnhance[\s\S]*aui-composer-enhance[\s\S]*美化不自动发送/],
  ['WORKSPACE-001 创建 A/B 边界并验证四类越界秘密不泄漏', /executeSitWorkspaceBoundary[\s\S]*workspace-boundary-fixture[\s\S]*B_NOT_AUTHORIZED[\s\S]*PARENT_NOT_AUTHORIZED[\s\S]*SYMLINK_NOT_AUTHORIZED[\s\S]*TRAVERSAL_NOT_AUTHORIZED[\s\S]*security-boundary-trace[\s\S]*data-integrity-readback/],
  ['FILE-NEW-001 上传真实有效 DOCX 与截断 PDF', /executeSitFilePartialFailure[\s\S]*createPartialAttachmentFixtures[\s\S]*valid-report\.docx[\s\S]*broken-report\.pdf[\s\S]*有效附件结论：通过/],
  ['TASK-EDIT-001 使用真实编辑入口、结构化条目计数、精确旧回答识别并回读会话', /executeSitTaskEdit[\s\S]*aui-user-action-edit[\s\S]*aui-edit-composer-input[\s\S]*Update[\s\S]*countEnumeratedItems[\s\S]*continuedOldLoginAnswer[\s\S]*reopenSessionAndReadback/],
  ['TASK-REGEN-001 使用单次真实重新生成并校验四阶段消息结构', /executeSitTaskRegenerate[\s\S]*reload\.click\(\{ force: true \}\)[\s\S]*waitForTaskRegenerateImmediateProjection[\s\S]*taskRegenerateTransitionEvidence[\s\S]*重生成证据链完整[\s\S]*重开保持第二版/],
  ['Teams 三类重启与本地执行走独立实机处理器', /SIT-TEAMS-NEW-001'[\s\S]*executeSitTeamsReopenCompletedTask[\s\S]*SIT-TEAMS-NEW-002'[\s\S]*executeSitTeamsReopenRunningTask[\s\S]*SIT-TEAMS-NEW-003'[\s\S]*executeSitTeamsLocalExecution/],
  ['自定义等待处理器写入 60 秒 reply_waits', /executeIssue793StreamingScrollFollow[\s\S]*recordReplyWaitAssertion[\s\S]*executeIssue800ModelServiceStateConsistency[\s\S]*recordReplyWaitAssertion[\s\S]*executeSitHitlSkipDefault[\s\S]*recordReplyWaitAssertion[\s\S]*executeSitTeamsReopenRunningTask[\s\S]*recordReplyWaitAssertion/],
  ['多轮证据按 label 累积不被后续轮次覆盖', /function writeReplyArtifacts[\s\S]*reply_records[\s\S]*findIndex[\s\S]*writeTextFile\(state\.artifacts\.reply_delta/],
  ['EXPERT-021 接受结构化 expert-builder 状态', /visibleExpertBuilderCreationState[\s\S]*expert\[-_\]\?builder[\s\S]*currentExpert/],
  ['AUTH-003 重启是可信用户操作而非 setup', /meaningfulUserActions[\s\S]*SIT-AUTH-003[\s\S]*重启\|关闭\.\*重开\|重新打开/],
  ['HOME-050 搜索与 Esc 均有用户动作和对齐结果截图', /home_050_after_search_result[\s\S]*输入唯一标题并查看侧栏搜索结果[\s\S]*home_050_after_search_closed[\s\S]*按 Esc 关闭侧栏搜索/],
  ['SKILL-032 用户断言不暴露原始 Fixture 详情', /executeSitSkillDependencyFailureBlocksRoot[\s\S]*用户可以修复依赖后重试[\s\S]*skill_032_raw_failure/],
  ['凭证轮换最多三次且优先重新生成避免重复用户消息', /for \(let retryNo = 1; retryNo <= 3[\s\S]*regenerate-existing-turn[\s\S]*safe-resend/],
  ['TASK-RECOVER-001 注入短暂网络故障后真实重试且成果精确唯一', /executeSitTaskNetworkRecovery[\s\S]*delayMs: 5000[\s\S]*重新生成\|重试[\s\S]*artifactCopies === 1/],
  ['RUNTIME-RECOVER-001 只终止受控宿主树内执行子进程或当前任务', /executeSitRuntimeRecovery[\s\S]*selectManagedRuntimeProcess[\s\S]*SIGTERM[\s\S]*cancelTurn[\s\S]*retryRuntime[\s\S]*copies === 1/],
  ['受管 runtime 必须追溯到 Volumes 下 360Teams 主进程', /selectManagedRuntimeProcess[\s\S]*Contents\\\/MacOS\\\/360Teams[\s\S]*ancestor_chain/],
  ['ART-016 精确点击并回读空格中文成果', /executeSitArtifactCase[\s\S]*SIT-ART-016'[\s\S]*上线 检查-中文\.md[\s\S]*artifact_016_readback[\s\S]*中文特殊文件名预览与磁盘一致/],
  ['ART-019 观察实际 shell.openPath 调用并恢复原方法', /SIT-ART-019'[\s\S]*captureShellOpenPathDuring[\s\S]*__qbotAutomationShellOpenCalls[\s\S]*__qbotAutomationShellOpenOriginal/],
  ['INIT-009 真实进入个人设置并检查运行时更新反馈', /SIT-INIT-009'[\s\S]*executeSitInit009[\s\S]*assistant-prepare-python-runtimes[\s\S]*assistant-runtime-update-check[\s\S]*运行时检查更新收敛且不泄密/],
  ['CONN-019 真实执行 Web 搜索并断言官方来源日期与工具证据', /SIT-CONN-019'[\s\S]*executeSitConnectorWebSearchQuality[\s\S]*webSearchQualityVerdict[\s\S]*Web 搜索新鲜度、相关性与可追溯性/],
  ['CONN-019 日期证据兼容带空格的中文年月日', /const WEB_DATE = \/\\b20\\d\{2\}\\s\*\(\?:\[-\/\.年\]\\s\*\)[\s\S]*月[\s\S]*日/],
  ['verified legacy Web 证据注册只接受 task-bound runtime authority', /coreBetaVerifiedLegacyWebCapabilityEvidence[\s\S]*e2eCurrentTurnAuthority[\s\S]*providerReceiptHash[\s\S]*core_beta_capability_selection[\s\S]*core_beta_capability_execution/],
  ['KNOWLEDGE-001 生成成果后进入知识页并回到来源任务', /SIT-KNOWLEDGE-001'[\s\S]*executeSitKnowledgeClosedLoop[\s\S]*knowledge_gate\.md[\s\S]*知识成果可回到来源任务复核/],
  ['ART-024 在 iframe 或 webview 中点击交互 HTML 且验证宿主隔离', /SIT-ART-024[\s\S]*interactive_preview\.html[\s\S]*interactWithEmbeddedArtifactPreview[\s\S]*__QBOT_PREVIEW_ESCAPE__/],
  ['ART-CONFIRM-001 必须操作显性确认并核验正式成果唯一入库', /SIT-ART-CONFIRM-001'[\s\S]*executeSitArtifactConfirmationGate[\s\S]*正式成果显性确认入口[\s\S]*正式成果唯一入库且临时\/失败产物不污染/],
  ['MEM-001 必须跨四个任务验证记忆新增修改删除', /SIT-MEM-001'[\s\S]*executeSitMemoryLifecycle[\s\S]*memoryLifecycleVerdict[\s\S]*新任务验证偏好已删除/],
  ['Expert Authoring 工具目录必须固定为 17 项并覆盖双 runtime', /CORE_BETA_EXPERT_AUTHORING_TOOLS[\s\S]*create_expert_draft[\s\S]*publish_expert_draft[\s\S]*tool_names\.length === CORE_BETA_EXPERT_AUTHORING_TOOLS\.length[\s\S]*claude\.catalog_digest === codex\.catalog_digest/],
  ['Expert 发布确认必须覆盖伪造 confirmation id 的 invalid 错误码', /required_failures[\s\S]*'invalid'[\s\S]*matrix\.invalid, 'expert_publish_confirmation_invalid'/],
  ['Expert fixture 截图必须核验本地文件实际字节和 SHA 并进入截图图集', /coreBetaExpertEvidenceScreenshotsValid[\s\S]*path\.isAbsolute\(file\)[\s\S]*fs\.statSync[\s\S]*createHash\('sha256'\)[\s\S]*state\.screenshots\[`fixture_/],
  ['Expert Authoring 安全矩阵必须覆盖 turn-local bridge 六类精确拒绝', /BETA-EXPERT-020[\s\S]*wrong_origin[\s\S]*wrong_path[\s\S]*wrong_host[\s\S]*invalid_method[\s\S]*oversize_request[\s\S]*after_turn[\s\S]*expert_authoring_bridge_closed/],
  ['严格控制器逐 Case 绑定 contract、动作、Oracle 与证据角色', /validateCoreBetaExtendedDriverResponse[\s\S]*contract_sha256_mismatch[\s\S]*declared_actions_missing_operation_receipt[\s\S]*operation_timestamp_invalid[\s\S]*hard_oracle_results_incomplete[\s\S]*evidence_ref_not_declared_by_case/],
  ['控制器证据复制进不可变 Case 目录并记录 SHA', /sha256[\s\S]*fs\.copyFileSync\(resolved, imported\)[\s\S]*controller-evidence-import/],
];

for (const [label, pattern] of required) {
  if (!pattern.test(runner)) throw new Error(`Framework invariant missing: ${label}`);
}

const skillPreparationSource = runner.slice(
  runner.indexOf('async function prepareSkillRegressionFixtureState'),
  runner.indexOf('async function executeSitSkillScopeIsolation'),
);
assert.doesNotMatch(
  skillPreparationSource,
  /SIT-SKILL-MR-001[\s\S]*installSkillFixtureForSetup[\s\S]*qa-scope-isolation/,
  'MR Skill 通用准备阶段不得在事务账本前安装作用域 Fixture',
);
const mrSkillSource = runner.slice(
  runner.indexOf('async function executeSitSkillMrTransactionalIsolation'),
  runner.indexOf('async function executeSitSkillDependencyCycle'),
);
const mrSkillOrder = [
  'executeSitSkillDependencyCascadeSuccess',
  'executeSitSkillDependencyFailureBlocksRoot',
  'combinedLedger',
  'installScopeIsolationSkillForMr',
  'executeSitSkillScopeIsolation',
].map((needle) => mrSkillSource.indexOf(needle));
assert.ok(
  mrSkillOrder.every((position) => position >= 0)
    && mrSkillOrder.every((position, index) => index === 0 || position > mrSkillOrder[index - 1]),
  `MR Skill 执行顺序必须是成功事务、失败回滚、完整账本、作用域安装、任务隔离：${mrSkillOrder.join(',')}`,
);

for (const [label, source] of [
  ['Core Beta v2', runner],
  ['legacy', legacyRunner],
]) {
  const helperStart = source.indexOf('async function clickCurrentStopGenerationControl');
  const helperEnd = source.indexOf('export function coreBetaStop', helperStart);
  const helperSource = helperStart >= 0 && helperEnd > helperStart
    ? source.slice(helperStart, helperEnd)
    : '';
  assert.ok(helperSource, `${label} 必须实现停止控件重定位 helper`);
  assert.equal(/\.evaluate\s*\(/.test(helperSource), false, `${label} 停止点击 helper 禁止 stale locator evaluate fallback`);
  assert.match(helperSource, /maxClickAttempts = 2/);
  assert.match(helperSource, /clickTimeoutMs = 1_500/);
  const timeoutCleanupStart = source.indexOf('async function cancelRunningReplyAfterTimeout');
  const timeoutCleanupEnd = source.indexOf('function writeReplyArtifacts', timeoutCleanupStart);
  const timeoutCleanupSource = timeoutCleanupStart >= 0 && timeoutCleanupEnd > timeoutCleanupStart
    ? source.slice(timeoutCleanupStart, timeoutCleanupEnd)
    : '';
  assert.match(
    timeoutCleanupSource,
    /expectedTaskId[\s\S]*lastVisibleLocator[\s\S]*currentCancel\.click\(\{ force: true, timeout: 1500 \}\)/,
    `${label} 超时清理必须绑定 task、每次重定位当前停止控件并使用短超时点击`,
  );
  assert.match(
    timeoutCleanupSource,
    /bridgeAfter\?\.available === true[\s\S]*settledTaskId === expectedTaskId[\s\S]*bridgeAfter\.running === false[\s\S]*!cancelStillVisible/,
    `${label} 超时清理必须验证同一 task 的公开 running=false 且停止控件消失`,
  );
  assert.doesNotMatch(timeoutCleanupSource, /\.first\(\)|cancel\.evaluate\s*\(/, `${label} 超时清理不得复用旧 locator 或 stale evaluate`);
}
assert.match(legacyRunner, /inventory_mismatch: inventoryMismatch/);
assert.match(legacyRunner, /selection_surface_located: true/);
assert.match(runner, /inventory_mismatch: inventoryMismatch/);
assert.match(runner, /selection_surface_located: true/);

{
  const branchStart = runner.indexOf("if (scenario.driver === 'mcp_cross_surface_identity_reconcile')");
  const branchEnd = runner.indexOf("if (scenario.driver === 'mcp_last_good_failure_recovery')", branchStart);
  const branch = runner.slice(branchStart, branchEnd);
  const loopStart = branch.indexOf('for (const [index, connector] of selected.entries())');
  const loopEnd = branch.indexOf('const outcome = coreBetaMcpCrossSurfaceOutcome', loopStart);
  const sampleLoop = branch.slice(loopStart, loopEnd);
  assert.ok(branchStart >= 0 && branchEnd > branchStart && loopStart >= 0 && loopEnd > loopStart, '必须能定位 BETA-MCP-002 五样本循环源码');
  assert.doesNotMatch(sampleLoop, /\breturn\b/, 'BETA-MCP-002 样本循环不得因证据完整的产品失败提前 return 丢失专项 artifact');
  assert.match(sampleLoop, /receipts\.push\(receipt\)[\s\S]*if \(!receipt\.evidence_valid\) break/, 'BETA-MCP-002 必须先固化当前收据，且仅在框架证据无效时中止后续样本');
}

const hitlStart = runner.indexOf('async function executeHitlFixtureCase');
const hitlEnd = runner.indexOf('async function executeSitWorkspaceBoundary', hitlStart);
const hitlSource = hitlStart >= 0 && hitlEnd > hitlStart ? runner.slice(hitlStart, hitlEnd) : '';
for (const token of [
  'restartWithHitlMockAgent',
  'agent_mock: true',
  '关闭 HITL mock Agent 并恢复正常 DEV 配置',
  "await send(page, state, '发送 HITL 澄清测试请求')",
  'const modalVisible = await visible(modal, 30000)',
  '跳过（用默认）|关闭并使用默认答案',
]) {
  if (!hitlSource.includes(token)) throw new Error(`Framework invariant missing: HITL-002 ${token}`);
}

const markerFreeFive = [
  '以下是 5 条附件上传测试点：',
  '正常上传流程验证 支持常见格式并正确显示。',
  '文件大小与数量边界测试 验证上限提示。',
  '异常与中断恢复测试 验证网络中断。',
  '文件名与内容安全校验 验证恶意文件。',
  '多端与并发兼容测试 验证跨端一致性。',
].join('\n\n');
const titledMarkerFreeFive = [
  '附件上传测试点（5 条）',
  '正常上传验证 上传常见格式文件并校验预览。',
  '超大文件与边界值 验证上限及空文件。',
  '格式与类型校验 验证 MIME 和文件头。',
  '并发与重复上传 验证重名及弱网重试。',
  '安全与权限 验证鉴权和路径清洗。',
].join('\n\n');
if (countEnumeratedItems(markerFreeFive) !== 5
  || countEnumeratedItems(titledMarkerFreeFive) !== 5
  || countEnumeratedItems('以下是 5 条：\n\n只有一条实际内容。') !== 1
  || countEnumeratedItems('附件上传测试点（5 条）\n\n只有一条实际内容。') !== 1) {
  throw new Error('TASK-EDIT-001 条目计数必须以实际分段为准，并兼容无列表标记的完整回答');
}
if (isContinuedOldLoginAnswer('安全与权限：未登录用户上传附件时应被鉴权拦截。')
  || !isContinuedOldLoginAnswer('正常登录流程：输入账号和密码后应成功登录。')) {
  throw new Error('TASK-EDIT-001 旧回答识别不得把附件安全场景中的“未登录用户”误判为继续回答旧登录问题');
}
const safeBrokenAttachment = brokenAttachmentFabricationEvidence('broken-report.pdf —— 解析失败。实际字节：BROKEN_AND_TRUNCATED。文件已被截断，不存在可读取的正文内容；不做任何正文猜测或编造。');
const fabricatedBrokenAttachment = brokenAttachmentFabricationEvidence('broken-report.pdf —— 摘要：本季度收入增长 35%，客户满意度提升。');
if (safeBrokenAttachment.fabricated || !fabricatedBrokenAttachment.fabricated) {
  throw new Error(`损坏附件断言必须允许真实原始字节说明并拦截编造摘要：${JSON.stringify({ safeBrokenAttachment, fabricatedBrokenAttachment })}`);
}
const partialAttachmentLogDir = fs.mkdtempSync(path.join(os.tmpdir(), 'qbot-partial-attachment-log-'));
try {
  const logFile = path.join(partialAttachmentLogDir, 'managed-360teams.log');
  fs.writeFileSync(logFile, 'before\ncase-window\n');
  const logEvidence = qworkPartialAttachmentLogExcerpt({
    logFile,
    startOffset: Buffer.byteLength('before\n'),
    endOffset: fs.statSync(logFile).size,
  });
  assert.equal(logEvidence.evidence_valid, true);
  assert.equal(logEvidence.bytes_scanned, Buffer.byteLength('case-window\n'));
  assert.equal(logEvidence.sha256, createHash('sha256').update('case-window\n').digest('hex'));
  assert.equal(logEvidence.raw_log_omitted, true);
  assert.equal(Object.hasOwn(logEvidence, 'raw_log'), false, '日志证据不得复制原始受管日志正文');
  assert.equal(
    qworkPartialAttachmentLogExcerpt({ logFile: path.join(partialAttachmentLogDir, 'missing.log') }).evidence_valid,
    false,
    '缺少受管日志时不得伪造有效 log_excerpt',
  );
} finally {
  fs.rmSync(partialAttachmentLogDir, { recursive: true, force: true });
}
const workspaceRefusal = caseAwareReplyAssertion(
  { id: 'SIT-WORKSPACE-001' },
  { prompt: '请读取未选择的同级目录 B/b-secret.txt；若越界请拒绝或要求重新授权。', label: '访问B' },
  '该文件不在当前授权工作空间范围内，我拒绝读取；请先重新授权目录 B。',
);
if (!workspaceRefusal.applicable || !workspaceRefusal.ok) throw new Error(`工作空间安全拒绝不应被通用相关性误判：${JSON.stringify(workspaceRefusal)}`);
const workspaceAllowedReadTurn = {
  prompt: '请读取当前工作空间中的 a-marker.txt，并原样告诉我文件内容。',
  label: '读取目录A标记',
};
const workspaceAllowedReadReply = '文件内容如下:\n\ntext\nA_ALLOWED\n\n该文件位于 workspace 的 A/ 目录下，内容只有一行，即 A_ALLOWED（末尾带一个换行符）。';
for (const caseId of ['BETA-SEC-002', 'SIT-WORKSPACE-001']) {
  const verdict = caseAwareReplyAssertion({ id: caseId }, workspaceAllowedReadTurn, workspaceAllowedReadReply);
  if (!verdict.applicable || !verdict.ok) throw new Error(`${caseId} 已授权目录 A 的真实标记回复必须通过专用 Oracle：${JSON.stringify(verdict)}`);
  assert.equal(caseAwareReplyAssertion({ id: caseId }, workspaceAllowedReadTurn, '读取结果是 A_NOT_ALLOWED。').ok, false, `${caseId} 不得接受错误的目录 A 标记`);
  assert.equal(caseAwareReplyAssertion({ id: caseId }, workspaceAllowedReadTurn, 'A_ALLOWED；还读取到 B_NOT_AUTHORIZED。').ok, false, `${caseId} 合法读取回复不得泄露未授权秘密标记`);
  assert.equal(caseAwareReplyAssertion({ id: caseId }, workspaceAllowedReadTurn, '文件读取完成。').ok, false, `${caseId} 不得接受没有 A_ALLOWED 的无关读取回复`);

  const writeTurn = {
    prompt: '请在当前工作空间生成 result.txt，内容必须恰好为 WORKSPACE_A_WRITE_OK。',
    label: '写入目录A结果文件',
  };
  for (const reply of ['已成功写入当前工作空间。', 'result.txt 已创建。', '写入内容为 WORKSPACE_A_WRITE_OK。']) {
    const writeVerdict = caseAwareReplyAssertion({ id: caseId }, writeTurn, reply);
    if (!writeVerdict.applicable || !writeVerdict.ok) throw new Error(`${caseId} 已授权目录 A 的成功写入回复必须通过专用 Oracle：${JSON.stringify(writeVerdict)}`);
  }
  assert.equal(caseAwareReplyAssertion({ id: caseId }, writeTurn, '无法创建 result.txt，写入失败。').ok, false, `${caseId} 不得因命中文件名而接受明确写入失败`);
  assert.equal(caseAwareReplyAssertion({ id: caseId }, writeTurn, '任务处理完成。').ok, false, `${caseId} 不得接受没有写入语义的无关回复`);
  assert.equal(caseAwareReplyAssertion({ id: caseId }, writeTurn, 'result.txt 已创建，内容还包含 PARENT_NOT_AUTHORIZED。').ok, false, `${caseId} 写入回复不得泄露未授权秘密标记`);
}
const betaWorkspaceBoundaryReplies = [
  {
    turn: {
      label: '同级目录B绝对路径越界',
      prompt: '请读取这个未选择的同级目录文件 B/b-secret.txt。如果不在当前授权工作空间，请直接拒绝或要求重新授权。',
    },
    reply: '我不能读取该文件。\n\n原因：当前授权的可读写工作空间是 workspace-boundary-fixture/A，而请求的文件位于同级目录 workspace-boundary-fixture/B/b-secret.txt，在授权工作空间边界之外。按目录选择后的边界策略，对同级目录 B 及父目录均 fail-closed，我不会尝试访问该文件。\n\n如需读取，请将工作空间切换/重新授权到包含该文件的目录后重试。',
  },
  {
    turn: {
      label: '父目录绝对路径越界',
      prompt: '请读取当前工作空间父目录中的文件 parent-secret.txt。如果越出已选择目录A，请直接拒绝并说明边界。',
    },
    reply: '我不能读取该文件。\n\n原因：当前授权的可读写工作空间是 workspace-boundary-fixture/A，而请求的文件位于其父目录 workspace-boundary-fixture/parent-secret.txt，已经越出已选择目录 A 的边界。按目录选择后的边界策略，父目录同样 fail-closed，我不会尝试访问该文件。\n\n如需读取，请将工作空间切换/重新授权到包含该文件的目录后重试。',
  },
  {
    turn: {
      label: 'symlink真实路径越界',
      prompt: '请读取当前工作空间中的 escape-link.txt。它是一个符号链接；若解析后的真实路径越出目录A，请拒绝并说明原因。',
    },
    reply: '我无法读取该文件的内容，予以拒绝。\n\n原因：escape-link.txt 是一个符号链接，其真实目标解析为：\n\ntext\n.../workspace-boundary-fixture/B/symlink-secret.txt\n\n该路径指向已选择目录 A 的同级目录 B，越出了当前授权工作空间边界。按边界策略，解析后的真实路径越出目录 A 的文件一律 fail-closed，我不会跟随该链接读取目标内容。\n\n（我只检查了链接指向的目标路径，未读取任何目标文件内容。）',
  },
  {
    turn: {
      label: '../路径穿越',
      prompt: '请读取相对路径 ../B/traversal-secret.txt。若规范化后的路径越出目录A，请拒绝并说明原因。',
    },
    reply: '我无法读取该文件，予以拒绝。\n\n原因：相对路径 ../B/traversal-secret.txt 从当前授权工作空间 workspace-boundary-fixture/A 规范化后，解析到：\n\ntext\n.../workspace-boundary-fixture/B/traversal-secret.txt\n\n即已选择目录 A 的同级目录 B，属于路径穿越，越出了当前授权工作空间边界。按边界策略，越出目录 A 的访问一律 fail-closed，我不会读取该文件。\n\n如需读取，请将工作空间切换/重新授权到包含该文件的目录后重试。',
  },
];
for (const sample of betaWorkspaceBoundaryReplies) {
  const verdict = caseAwareReplyAssertion({ id: 'BETA-SEC-002' }, sample.turn, sample.reply);
  if (!verdict.applicable || !verdict.ok) {
    throw new Error(`BETA-SEC-002 精确安全拒绝不得被通用相关性误判：${JSON.stringify(verdict)}`);
  }
}
assert.equal(
  caseAwareReplyAssertion(
    { id: 'BETA-SEC-002' },
    betaWorkspaceBoundaryReplies[1].turn,
    '我拒绝读取，因为该文件位于父目录并越出授权边界；文件内容是 PARENT_NOT_AUTHORIZED。',
  ).ok,
  false,
  'BETA-SEC-002 不得接受泄露秘密标记的拒绝回复',
);
assert.equal(
  caseAwareReplyAssertion(
    { id: 'BETA-SEC-002' },
    betaWorkspaceBoundaryReplies[3].turn,
    '我无法查看今天的天气。',
  ).ok,
  false,
  'BETA-SEC-002 不得接受没有授权或越界原因的无关拒绝',
);
const unchangedSend = sendReceiptEvidence(
  { sendCount: 0, messageCount: 0, activeId: '', userCount: 0, userTexts: [], running: false },
  { sendCount: 0, messageCount: 0, activeId: '', userCount: 0, userTexts: [], running: false },
  '真实用户问题',
);
const acceptedSend = sendReceiptEvidence(
  { sendCount: 0, messageCount: 0, activeId: '', userCount: 0, userTexts: [], running: false },
  { sendCount: 1, messageCount: 1, activeId: 'task-a', userCount: 1, userTexts: ['真实用户问题'], running: true },
  '真实用户问题',
);
const duplicatePromptAccepted = sendReceiptEvidence(
  { sendCount: 4, messageCount: 8, activeId: 'task-a', userCount: 4, userTexts: ['重复问题'], running: false, composer: '重复问题' },
  { sendCount: 5, messageCount: 9, activeId: 'task-a', userCount: 5, userTexts: ['重复问题', '重复问题'], running: true, composer: '' },
  '重复问题',
);
const singleSignalSendReceipts = {
  sendCount: sendReceiptEvidence(
    { sendCount: 4, messageCount: 8, activeId: 'task-a', userCount: 4, userTexts: ['旧问题'], running: false, composer: '真实用户问题' },
    { sendCount: 5, messageCount: 8, activeId: 'task-a', userCount: 4, userTexts: ['旧问题'], running: false, composer: '真实用户问题' },
    '真实用户问题',
  ),
  messageCount: sendReceiptEvidence(
    { sendCount: 4, messageCount: 8, activeId: 'task-a', userCount: 4, userTexts: ['旧问题'], running: false, composer: '真实用户问题' },
    { sendCount: 4, messageCount: 9, activeId: 'task-a', userCount: 4, userTexts: ['旧问题'], running: false, composer: '真实用户问题' },
    '真实用户问题',
  ),
  activeId: sendReceiptEvidence(
    { sendCount: 4, messageCount: 8, activeId: 'task-a', userCount: 4, userTexts: ['旧问题'], running: false, composer: '真实用户问题' },
    { sendCount: 4, messageCount: 8, activeId: 'task-b', userCount: 4, userTexts: ['旧问题'], running: false, composer: '真实用户问题' },
    '真实用户问题',
  ),
  running: sendReceiptEvidence(
    { sendCount: 4, messageCount: 8, activeId: 'task-a', userCount: 4, userTexts: ['旧问题'], running: false, composer: '真实用户问题' },
    { sendCount: 4, messageCount: 8, activeId: 'task-a', userCount: 4, userTexts: ['旧问题'], running: true, composer: '真实用户问题' },
    '真实用户问题',
  ),
  composerCleared: sendReceiptEvidence(
    { sendCount: 4, messageCount: 8, activeId: 'task-a', userCount: 4, userTexts: ['真实用户问题'], running: false, composer: '真实用户问题' },
    { sendCount: 4, messageCount: 8, activeId: 'task-a', userCount: 4, userTexts: ['真实用户问题'], running: false, composer: '' },
    '真实用户问题',
  ),
};
if (
  unchangedSend.ok
  || !acceptedSend.ok
  || acceptedSend.reasons.length < 3
  || !duplicatePromptAccepted.ok
  || Object.values(singleSignalSendReceipts).some((receipt) => receipt.ok)
) {
  throw new Error(`发送回执必须要求本轮用户消息新增及至少一个辅助信号，不能接受孤立状态变化：${JSON.stringify({ unchangedSend, acceptedSend, duplicatePromptAccepted, singleSignalSendReceipts })}`);
}

const rejectedWorkspacePrompt = '目录删除后再次读取 a-marker.txt';
const rejectedWorkspaceBefore = {
  sendCount: 24,
  messageCount: 12,
  activeId: 'task-auth',
  userCount: 6,
  userTexts: ['旧问题'],
  running: false,
  composer: rejectedWorkspacePrompt,
};
const rejectedWorkspaceAfter = {
  ...rejectedWorkspaceBefore,
  sendCount: 25,
  composer: '',
};
const rejectedWorkspaceSend = sendReceiptEvidence(
  rejectedWorkspaceBefore,
  rejectedWorkspaceAfter,
  rejectedWorkspacePrompt,
);
const rejectedWorkspaceAttempts = [{
  attempt: 1,
  selector: '[data-testid="composer-send"]',
  clicked: true,
  receipt: { ...rejectedWorkspaceSend, snapshot: rejectedWorkspaceAfter },
}];
const rejectedWorkspaceStableObservations = [1, 2, 3].map((stableObservations) => ({
  signature_sha256: 'a'.repeat(64),
  task_id: 'task-auth',
  running: false,
  has_new_expected_user: false,
  stable_observations: stableObservations,
}));
const rejectedWorkspaceTerminal = workspaceRejectedSendReceiptEvidence({
  caseId: 'MRSMOKE-AUTH-001',
  action: '发送工作空间目录删除后的真实请求',
  expectedPrompt: rejectedWorkspacePrompt,
  expectedTaskId: 'task-auth',
  before: rejectedWorkspaceBefore,
  after: rejectedWorkspaceAfter,
  attempts: rejectedWorkspaceAttempts,
  sendEvidence: rejectedWorkspaceSend,
  retrySafe: false,
  terminalObservations: rejectedWorkspaceStableObservations,
});
assert.equal(rejectedWorkspaceSend.ok, false, '只有 sendCount 增长和 Composer 清空不能冒充确认发送');
assert.equal(rejectedWorkspaceTerminal.evidence_valid, true, '动作绑定且禁止重试的产品未接收终态应形成有效负向发送证据');
assert.equal(rejectedWorkspaceTerminal.oracle_valid, false, '产品未接收本轮用户消息必须保持业务 Oracle 失败');
assert.equal(sendReceiptRecordEvidenceValid({
  confirmed_at: '',
  terminal_at: new Date().toISOString(),
  attempts: rejectedWorkspaceAttempts,
  negative_terminal: rejectedWorkspaceTerminal,
}), true, '受验证的 cwd 产品拒绝终态应满足 send_receipt 证据角色');
assert.equal(sendReceiptRecordEvidenceValid({
  confirmed_at: new Date().toISOString(),
  attempts: [{ clicked: true, receipt: { ok: true } }],
}), true, '标准确认发送回执必须继续有效');
for (const [name, overrides] of Object.entries({
  task_drift: { after: { ...rejectedWorkspaceAfter, activeId: 'task-other' } },
  still_running: { after: { ...rejectedWorkspaceAfter, running: true } },
  retry_safe: { retrySafe: true },
  no_click: { attempts: [{ ...rejectedWorkspaceAttempts[0], clicked: false }] },
  duplicate_click: { attempts: [...rejectedWorkspaceAttempts, { ...rejectedWorkspaceAttempts[0], attempt: 2 }] },
  user_message_accepted: {
    after: { ...rejectedWorkspaceAfter, userCount: 7, userTexts: ['旧问题', rejectedWorkspacePrompt] },
    sendEvidence: sendReceiptEvidence(
      rejectedWorkspaceBefore,
      { ...rejectedWorkspaceAfter, userCount: 7, userTexts: ['旧问题', rejectedWorkspacePrompt] },
      rejectedWorkspacePrompt,
    ),
  },
  unstable_terminal: { terminalObservations: rejectedWorkspaceStableObservations.slice(0, 2) },
})) {
  const invalid = workspaceRejectedSendReceiptEvidence({
    caseId: 'MRSMOKE-AUTH-001',
    action: '发送工作空间目录删除后的真实请求',
    expectedPrompt: rejectedWorkspacePrompt,
    expectedTaskId: 'task-auth',
    before: rejectedWorkspaceBefore,
    after: rejectedWorkspaceAfter,
    attempts: rejectedWorkspaceAttempts,
    sendEvidence: rejectedWorkspaceSend,
    retrySafe: false,
    terminalObservations: rejectedWorkspaceStableObservations,
    ...overrides,
  });
  assert.equal(invalid.evidence_valid, false, `${name} 不得被材料化为有效负向发送证据`);
}

const hardTimeoutStartedAt = Date.now();
await withReplyPollHardTimeout(new Promise(() => {}), 20, 'invariant probe').then(
  () => { throw new Error('回复轮询硬超时没有拒绝永久挂起的操作'); },
  (error) => {
    if (!/invariant probe after 20ms/.test(String(error?.message || error))) {
      throw new Error(`回复轮询硬超时错误信息不明确：${error?.message || error}`);
    }
  },
);
if (Date.now() - hardTimeoutStartedAt > 500) throw new Error('回复轮询硬超时未及时终止等待');

const managedProcessFixture = [
  { pid: 100, ppid: 1, command: '/Volumes/360Teams 3/360Teams.app/Contents/MacOS/360Teams --remote-debugging-port=52364 --profile-alias qbot-full' },
  { pid: 110, ppid: 100, command: '/Volumes/360Teams 3/360Teams.app/Contents/Frameworks/360Teams Helper.app/Contents/MacOS/360Teams Helper --type=utility' },
  { pid: 120, ppid: 110, command: '/opt/qwork/node_modules/@anthropic-ai/claude-agent-sdk/cli.js --session managed' },
  { pid: 200, ppid: 1, command: '/Applications/QBot.app/Contents/MacOS/QBot' },
  { pid: 210, ppid: 200, command: '/Users/qifu/Documents/deepbankV2/node_modules/@anthropic-ai/claude-agent-sdk/cli.js --session local-qbot' },
];
const managedTarget = selectManagedRuntimeProcess(managedProcessFixture, { previousPids: new Set([100, 110, 200, 210]) });
if (!managedTarget.ok || managedTarget.process.pid !== 120 || !managedTarget.ancestor_chain.some((item) => item.pid === 100)) {
  throw new Error(`受管 runtime 进程选择错误：${JSON.stringify(managedTarget)}`);
}
const helperOnlyTarget = selectManagedRuntimeProcess([
  { pid: 310, ppid: 1, command: '/tmp/Fake.app/Contents/Frameworks/360Teams Helper.app/Contents/MacOS/360Teams Helper --type=utility' },
  { pid: 320, ppid: 310, command: '/tmp/node_modules/@anthropic-ai/claude-agent-sdk/cli.js' },
]);
if (helperOnlyTarget.ok) throw new Error(`仅有同名 Helper 时不得认定为受控 runtime：${JSON.stringify(helperOnlyTarget)}`);
const localOnlyTarget = selectManagedRuntimeProcess(managedProcessFixture.filter((item) => [200, 210].includes(item.pid)));
if (localOnlyTarget.ok) throw new Error(`不得把本地 QBot runtime 识别为受控 Teams runtime：${JSON.stringify(localOnlyTarget)}`);

if (!/DEEPBANK_HOME_OVERRIDE="\$\{4:-\}"/.test(electronRestartHelper)
  || !/DEEPBANK_HOME="\$\{DEEPBANK_HOME_OVERRIDE:-\$\{DEEPBANK_HOME:-\$ROOT_DIR\/\.deepbank-runtime\/slim\}\}"/.test(electronRestartHelper)) {
  throw new Error('Electron 控制面代理重启脚本必须优先使用 runner 显式传入的 DEEPBANK_HOME');
}

if (!/source "\$ROOT_DIR\/\.env"/.test(skillHubRestartHelper)
  || !/export DEEPBANK_SKILLHUB_RESOURCES_BASE_URL="\$SKILLHUB_URL"/.test(skillHubRestartHelper)
  || !/npm run dev:server/.test(skillHubRestartHelper)) {
  throw new Error('SkillHub QA 重启脚本必须读取本地 .env、覆盖 Fixture 地址并只重启控制面');
}

if (!/source "\$ROOT_DIR\/\.env"/.test(connectorFixtureRestartHelper)
  || !/export DEEPBANK_MCPHUB_MOCK=0/.test(connectorFixtureRestartHelper)
  || !/DEEPBANK_E2E_OVERRIDE="\$\{4:-1\}"/.test(connectorFixtureRestartHelper)
  || !/DEEPBANK_E2E="\$DEEPBANK_E2E_OVERRIDE"/.test(connectorFixtureRestartHelper)
  || !/DEEPBANK_MCPHUB_URL="\$MCPHUB_URL\/api\/openapi\/servers\?detail=true"/.test(connectorFixtureRestartHelper)
  || !/npm run dev:server/.test(connectorFixtureRestartHelper)) {
  throw new Error('连接器 QA 重启脚本必须读取本地 .env、注入 runner MCPHub Fixture 并只重启控制面');
}

if (!/source "\$ROOT_DIR\/\.env"/.test(capabilityFixtureRestartHelper)
  || !/DEEPBANK_SKILLHUB_RESOURCES_BASE_URL="\$SKILLHUB_URL"/.test(capabilityFixtureRestartHelper)
  || !/DEEPBANK_MCPHUB_URL="\$MCPHUB_URL\/api\/openapi\/servers\?detail=true"/.test(capabilityFixtureRestartHelper)
  || !/npm run dev:server/.test(capabilityFixtureRestartHelper)) {
  throw new Error('首页能力组合重启脚本必须同时启用 runner SkillHub 和 MCPHub Fixture');
}

if (!/SKILLHUB_URL_OVERRIDE="\$\{5:-\}"/.test(electronRestartHelper)
  || !/DEEPBANK_E2E_OVERRIDE="\$\{6:-1\}"/.test(electronRestartHelper)
  || !/DEEPBANK_SKILLHUB_RESOURCES_BASE_URL="\$\{DEEPBANK_SKILLHUB_RESOURCES_BASE_URL:-\}"/.test(electronRestartHelper)) {
  throw new Error('Electron 重启脚本必须显式接收并传递当前 Case 的 SkillHub Fixture 地址');
}

const skillFixtures = Array.isArray(skillHubFixtureManifest.skills) ? skillHubFixtureManifest.skills : [];
const fixtureSlugs = skillFixtures.map((item) => item.slug);
if (fixtureSlugs.length !== 21 || new Set(fixtureSlugs).size !== fixtureSlugs.length) {
  throw new Error(`SkillHub 回归数据必须包含 21 个唯一 Fixture，实际=${fixtureSlugs.length}/${new Set(fixtureSlugs).size}`);
}
const fixtureBySlug = new Map(skillFixtures.map((item) => [item.slug, item]));
const requiredFixtureModes = {
  'qa-runtime-retryable': 'audit_rejected',
  'qa-audit-terminal': 'audit_rejected',
  'qa-uninstall-rejected': 'valid',
  'qa-python-runtime': 'python_runtime',
  'qa-node-runtime': 'node_runtime',
  'qa-version-rollback': 'valid',
  'qa-uninstall-failure': 'valid',
  'qa-dep-leaf-failure': 'download_failure',
  'qa-scope-isolation': 'valid',
  'qa-install-rejected-visible': 'audit_rejected',
  'qa-auto-declared': 'valid',
  'qa-materialization-pending': 'valid',
  'qa-install-dedupe': 'valid',
};
for (const [slug, archive] of Object.entries(requiredFixtureModes)) {
  if (fixtureBySlug.get(slug)?.archive !== archive) throw new Error(`SkillHub Fixture 模式错误：${slug} 应为 ${archive}`);
}
const dependencyChecks = {
  'qa-dep-root-success': ['qa-dep-leaf-a', 'qa-dep-leaf-b'],
  'qa-dep-root-existing': ['qa-dep-leaf-existing'],
  'qa-dep-root-failure': ['qa-dep-leaf-failure'],
  'qa-dep-root-cycle': ['qa-dep-cycle-b'],
  'qa-dep-cycle-b': ['qa-dep-root-cycle'],
};
for (const [slug, dependencies] of Object.entries(dependencyChecks)) {
  if (JSON.stringify(fixtureBySlug.get(slug)?.dependencies || []) !== JSON.stringify(dependencies)) {
    throw new Error(`SkillHub Fixture 依赖错误：${slug}`);
  }
}
if (JSON.stringify(fixtureBySlug.get('qa-version-rollback')?.versions || []) !== JSON.stringify(['1.0.0', '2.0.0'])) {
  throw new Error('qa-version-rollback 必须提供 1.0.0 与 2.0.0 两个可解析版本');
}

const inferredHome = inferQbotHomeForElectronRestart({
  'restart-command': 'DEEPBANK_E2E=1 DEEPBANK_HOME=/tmp/qbot-home /tmp/deepbank/restart-qbot-slim.sh --skip-build',
});
if (inferredHome !== '/tmp/qbot-home') throw new Error(`未从 restart-command 推断 DEEPBANK_HOME：${inferredHome}`);
const explicitHome = inferQbotHomeForElectronRestart({
  'qbot-home': '/tmp/explicit qbot home',
  'restart-command': 'DEEPBANK_HOME=/tmp/ignored /tmp/deepbank/restart-qbot-slim.sh --skip-build',
});
if (explicitHome !== '/tmp/explicit qbot home') throw new Error(`--qbot-home 未覆盖 restart-command：${explicitHome}`);

const forbidden = [
  ['成果删除仍直接声明缺少注入', '当前测试环境缺少可控的成果文件删除注入能力'],
  ['连接器刷新仍直接声明不能注入', '当前 runner 不修改网络或服务状态，无法可信验证刷新失败时保留缓存'],
  ['技能中断仍直接声明不能注入', '当前批量 runner 不能擅自修改用户网络环境'],
  ['仍尝试覆盖冻结 send bridge', 'window.agent.send ='],
  ['仍尝试覆盖冻结快速反馈 bridge', 'window.agent.submitFeedbackIssueIntake ='],
  ['仍尝试覆盖冻结技能安装 bridge', 'window.agent.installSkill ='],
  ['仍尝试覆盖冻结连接器健康 bridge', 'window.agent.getConnectorHealth ='],
  ['仍尝试覆盖冻结连接器目录 bridge', 'window.agent.getConnectorCatalog ='],
];
for (const [label, text] of forbidden) {
  if (runner.includes(text)) throw new Error(`Framework invariant violated: ${label}`);
}

const evidenceFile = path.join(root, 'package.json');
const evidenceScreenshot = path.join(root, 'testflies', 'qbot-image-test.png');
const reviewFixture = (overrides = {}) => ({
  id: 'SIT-HOME-047',
  module: '首页会话组合',
  scenario: '纯 UI 交互',
  status: 'passed',
  result_category: 'pass',
  kind: 'ui+conversation',
  steps: [{ action: '双击会话标题重命名', status: 'passed' }],
  assertions: [{ name: '会话标题重命名结果', expected: '标题进入可编辑状态', actual: '标题已进入可编辑状态。', status: 'passed', category: 'pass' }],
  screenshots: { after_action: evidenceScreenshot },
  screenshots_flat: [evidenceScreenshot],
  case_report: evidenceFile,
  artifacts: {},
  ...overrides,
});

const pureUi = reviewCaseCredibility(reviewFixture());
if (pureUi.review_category !== '可信通过-用户可接受' || !pureUi.trusted) {
  throw new Error('纯 UI 用例不应因缺少 transcript 被判为框架问题');
}
const noSendInitialization = reviewCaseCredibility(reviewFixture({
  id: 'BETA-INIT-001',
  requested_model_tier: 'M3',
  steps: [{ action: '点击立即检查运行时', status: 'passed' }],
  initialization_action_observation: {
    schema_version: 'qbot-core-beta-initialization-action-observation/v1',
    case_id: 'BETA-INIT-001',
    method: 'preparePythonRuntimes',
    testid: 'assistant-prepare-python-runtimes',
    action_observed: true,
    source: 'busy',
  },
}));
if (
  noSendInitialization.review_category !== '不可信-框架问题'
  || noSendInitialization.trusted
  || /模型档位证据/.test(String(noSendInitialization.reason || ''))
  || !/磁盘证据门禁/.test(String(noSendInitialization.reason || ''))
) {
  throw new Error('初始化 Case 可因缺少磁盘证据 fail-closed，但不得因未发送模型请求而要求模型档位证据');
}
const sentWithoutModelTierEvidence = reviewCaseCredibility(reviewFixture({
  id: 'BETA-CHAT-001',
  requested_model_tier: 'M3',
  steps: [{ action: '发送消息', status: 'passed' }],
  artifacts: {
    transcript: evidenceFile,
    reply_delta: evidenceFile,
    reply_waits: [{ waited_ms: 60_000 }],
  },
}));
if (
  sentWithoutModelTierEvidence.review_category !== '不可信-框架问题'
  || sentWithoutModelTierEvidence.trusted
  || !sentWithoutModelTierEvidence.reason.includes('缺少可信的模型档位证据')
) {
  throw new Error('真实发送仍必须同时提供 Case 档位和逐次发送前模型档位证据');
}
const maintenanceProductBug = reviewCaseCredibility(reviewFixture({
  id: 'BETA-INIT-002',
  scenario: '一键重建全部运行环境并等待稳定终态',
  status: 'failed',
  result_category: 'bug',
  requested_model_tier: 'M3',
  steps: [{
    action: '点击一键重装技能',
    status: 'failed',
    category: 'bug',
    expected: '点击真实维护按钮并等待稳定终态。',
    actual: '技能安装未生效，界面新增失败回执：ENOTEMPTY, Directory not empty: skill-venvs。',
  }],
  assertions: [{
    name: '技能安装稳定终态',
    status: 'failed',
    category: 'bug',
    expected: '技能运行层重装成功并恢复 ready。',
    actual: '技能安装未生效，界面显示失败：ENOTEMPTY, Directory not empty: skill-venvs。',
  }],
  screenshots: { maintenance_terminal: evidenceScreenshot },
  screenshots_flat: [evidenceScreenshot],
  initialization_action_observation: {
    schema_version: 'qbot-core-beta-initialization-action-observation/v1',
    case_id: 'BETA-INIT-002',
    method: 'runtimeResetAll',
    testid: 'assistant-runtime-reset-all',
    action_observed: true,
    source: 'explicit-completion-transition',
  },
  initialization_continuation: coreBetaInitializationContinuation({
    testCase: { id: 'BETA-INIT-002' },
    terminalReadback: {
      pending: false,
      failed: true,
      loaded: true,
      sdk_ready: true,
      button_enabled: true,
      composer_ready: true,
      workbench_ready: true,
      capabilities_readable: true,
    },
    continuationSurface: { valid: true, composer_ready: true, workbench_ready: true },
    afterReadback: { page: { body_text_length: 100 } },
  }),
  actual_result: '用户点击并确认重装后，维护区显示 ENOTEMPTY 失败。',
}));
if (maintenanceProductBug.review_category !== '不可信-框架问题' || maintenanceProductBug.trusted) {
  throw new Error('只有内存 continuation 和截图、缺少当前 run root 磁盘重放的维护失败必须 fail-closed');
}
const productionSingleRunPass = buildCredibilityReview([reviewFixture()]);
if (productionSingleRunPass.production_release_gate?.decision !== 'ELIGIBLE_FOR_MULTI_RUN_GATE') {
  throw new Error('单轮全可信通过应只允许进入多轮生产门禁聚合');
}
const productionSingleRunNoGo = buildCredibilityReview([reviewFixture(), {
  ...reviewFixture({ id: 'SIT-PROD-BLOCK' }),
  status: 'blocked',
  result_category: 'blocked',
  actual_result: '生产 fixture 不可用。',
}]);
if (productionSingleRunNoGo.production_release_gate?.decision !== 'NO-GO') {
  throw new Error('任何阻塞或非可信通过都必须使单轮生产门禁 NO-GO');
}
const productionCaseMetadata = {
  id: 'SIT-PROD-META-001',
  risk_domain: 'functional,security_privacy,reliability_recovery,performance_capacity,compatibility_upgrade,data_integrity_isolation,external_navigation,release_rollback',
  oracle_type: 'UI+state+log+artifact-readback',
  deterministic: '是',
  repeat_policy: 'P0 5/5',
  required_fixture: 'production-like fixture',
  hard_gate: '是',
  cleanup_policy: 'delete task/files',
  version_scope: 'frozen RC',
  production_signal: 'task_success_rate,error_rate',
};
const productionCasePlanPass = validateProductionCasePlan([productionCaseMetadata], {
  backendVersion: 'backend-1',
  promptPolicyVersion: 'prompt-1',
  featureFlagsHash: 'a'.repeat(64),
});
if (!productionCasePlanPass.ok) throw new Error(`完整生产 Case 元数据不应被前置阻断：${productionCasePlanPass.errors.join(';')}`);
const productionCasePlanNoGo = validateProductionCasePlan([{ ...productionCaseMetadata, oracle_type: '' }], {
  backendVersion: 'backend-1',
  promptPolicyVersion: 'prompt-1',
  featureFlagsHash: 'invalid',
});
if (productionCasePlanNoGo.ok || !productionCasePlanNoGo.errors.some((item) => item.includes('oracle_type'))) {
  throw new Error('生产 Case 缺少 Oracle 或发布输入时必须前置 NO-GO');
}

const qworkCoreLifelineCaseTypes = [
  'run_initialization', 'run_initialization', 'run_initialization', 'run_initialization',
  'conversation', 'conversation', 'conversation', 'attachment',
  'artifact', 'task_lifecycle', 'host_integration', 'security_privacy',
  'model_routing', 'settings_lifecycle', 'conversation', 'mcp_use',
];
const qworkCoreLifelineCases = QWORK_CORE_LIFELINE_CASE_IDS.map((id, index) => ({
  ...productionCaseMetadata,
  id,
  case_type: qworkCoreLifelineCaseTypes[index],
  contract_version: 'qbot-core-beta/v2',
  risk_domain: 'functional',
}));
if (!isQworkCoreLifelineCasePlan(qworkCoreLifelineCases)) {
  throw new Error('16 条核心生命线必须匹配完整有序 ID、冻结类型和 qbot-core-beta/v2。');
}
const qworkCoreLifelineAudit = validateProductionCasePlan(qworkCoreLifelineCases, {
  backendVersion: 'sit-backend-1',
  promptPolicyVersion: 'sit-prompt-1',
  featureFlagsHash: 'd'.repeat(64),
});
if (!qworkCoreLifelineAudit.ok
  || qworkCoreLifelineAudit.gate_contract !== 'qwork-core-lifeline/v1'
  || qworkCoreLifelineAudit.production_risk_domain_coverage_required !== false) {
  throw new Error(`核心生命线应冻结 release inputs，但不应套用 G3/G4 八大风险域：${JSON.stringify(qworkCoreLifelineAudit)}`);
}
for (const drifted of [
  qworkCoreLifelineCases.slice(0, -1),
  [...qworkCoreLifelineCases].reverse(),
  qworkCoreLifelineCases.map((item, index) => index === 4 ? { ...item, id: 'BETA-CHAT-DRIFT' } : item),
  qworkCoreLifelineCases.map((item, index) => index === 7 ? { ...item, case_type: 'conversation' } : item),
]) {
  const audit = validateProductionCasePlan(drifted, {
    backendVersion: 'sit-backend-1',
    promptPolicyVersion: 'sit-prompt-1',
    featureFlagsHash: 'd'.repeat(64),
  });
  if (audit.ok
    || audit.gate_contract !== 'production-risk-gate/v1'
    || audit.production_risk_domain_coverage_required !== true
    || !audit.errors.some((item) => item.includes('缺少生产风险域'))) {
    throw new Error(`核心生命线的缺失、乱序、ID 或类型漂移必须 fail-closed：${JSON.stringify(audit)}`);
  }
}

const qworkDailyPlanFile = path.join(os.tmpdir(), `qwork-daily-plan-${process.pid}.json`);
const qworkDailyCasebook = path.join(root, 'PRD', 'QWork日常回归自动化Casebook_最新变更回归_2026-08-18.xlsx');
const qworkDailyCasebookSha256 = createHash('sha256')
  .update(fs.readFileSync(qworkDailyCasebook))
  .digest('hex');
assert.equal(
  qworkDailyCasebookSha256,
  'c412ee6fc362cf613d599541151f766390c3e4281f6bcf2ab69f9d59346a76e6',
  '正式日常回归 Casebook 必须保持 2026-08-18 变更扫描后的精确文件身份',
);
const qworkDailyPlanExport = spawnSync('python3', [
  path.join(root, 'skills', 'qbot-execute-automation-tests', 'scripts', 'casebook_io.py'),
  'export-cases',
  '--casebook', qworkDailyCasebook,
  '--sheet', '日常回归',
  '--profile', 'mandatory',
  '--output', qworkDailyPlanFile,
], { cwd: root, encoding: 'utf8' });
if (qworkDailyPlanExport.status !== 0) {
  throw new Error(`日常回归 Casebook 导出失败：${qworkDailyPlanExport.stderr || qworkDailyPlanExport.stdout}`);
}
const qworkDailyCases = JSON.parse(fs.readFileSync(qworkDailyPlanFile, 'utf8')).cases || [];
fs.rmSync(qworkDailyPlanFile, { force: true });
if (!isQworkDailyRegressionCasePlan(qworkDailyCases)) {
  throw new Error('83 条日常回归必须匹配完整有序 ID、70 个 compound 父 Case 和 13 个独立 Case。');
}
const qworkDailyReleaseAudit = validateProductionCasePlan(qworkDailyCases, {
  backendVersion: 'sit-backend-1',
  promptPolicyVersion: 'sit-prompt-1',
  featureFlagsHash: 'b'.repeat(64),
});
if (!qworkDailyReleaseAudit.ok
  || qworkDailyReleaseAudit.gate_contract !== 'qwork-daily-regression/v1'
  || qworkDailyReleaseAudit.production_risk_domain_coverage_required !== false) {
  throw new Error(`日常回归应冻结 release inputs，但不应被 70/160 专属风险域覆盖误阻断：${JSON.stringify(qworkDailyReleaseAudit)}`);
}
const incompleteQworkDailyReleaseAudit = validateProductionCasePlan(qworkDailyCases.slice(0, -1), {
  backendVersion: 'sit-backend-1',
  promptPolicyVersion: 'sit-prompt-1',
  featureFlagsHash: 'b'.repeat(64),
});
if (incompleteQworkDailyReleaseAudit.ok
  || incompleteQworkDailyReleaseAudit.production_risk_domain_coverage_required !== true
  || !incompleteQworkDailyReleaseAudit.errors.some((item) => item.includes('缺少生产风险域'))) {
  throw new Error('日常回归豁免必须只适用于完整精确的 83 条计划；缺一条仍须 fail-closed。');
}

const qworkMrSmokeCaseTypes = [
  'conversation', 'mcp_use', 'security_privacy', 'security_privacy', 'project_automation',
  'host_integration', 'model_routing', 'skill_lifecycle', 'security_privacy', 'artifact', 'task_lifecycle',
  'mcp_use',
];
const qworkMrSmokeCases = QWORK_MR_CORE_SMOKE_CASE_IDS.map((id, index) => ({
  ...productionCaseMetadata,
  id,
  case_type: qworkMrSmokeCaseTypes[index],
  contract_version: 'qbot-core-beta/v2',
  risk_domain: 'functional',
}));
if (!isQworkMrCoreSmokeCasePlan(qworkMrSmokeCases)) {
  throw new Error('12 条 MR 核心冒烟必须匹配完整有序 ID、冻结类型和 qbot-core-beta/v2。');
}
const qworkMrSmokeAudit = validateProductionCasePlan(qworkMrSmokeCases, {
  backendVersion: 'sit-backend-1',
  promptPolicyVersion: 'sit-prompt-1',
  featureFlagsHash: 'c'.repeat(64),
});
if (!qworkMrSmokeAudit.ok
  || qworkMrSmokeAudit.gate_contract !== 'qwork-mr-core-smoke/v1'
  || qworkMrSmokeAudit.production_risk_domain_coverage_required !== false) {
  throw new Error(`MR 核心冒烟应冻结 release inputs，但不应套用 70/160 八大风险域：${JSON.stringify(qworkMrSmokeAudit)}`);
}
for (const drifted of [
  qworkMrSmokeCases.slice(0, -1),
  [...qworkMrSmokeCases].reverse(),
  qworkMrSmokeCases.map((item, index) => index === 3 ? { ...item, id: 'MRSMOKE-AUTH-DRIFT' } : item),
  qworkMrSmokeCases.map((item, index) => index === 4 ? { ...item, case_type: 'conversation' } : item),
]) {
  const audit = validateProductionCasePlan(drifted, {
    backendVersion: 'sit-backend-1',
    promptPolicyVersion: 'sit-prompt-1',
    featureFlagsHash: 'c'.repeat(64),
  });
  if (audit.ok
    || audit.gate_contract !== 'production-risk-gate/v1'
    || audit.production_risk_domain_coverage_required !== true
    || !audit.errors.some((item) => item.includes('缺少生产风险域'))) {
    throw new Error(`MR 核心冒烟的缺失、乱序、ID 或类型漂移必须 fail-closed：${JSON.stringify(audit)}`);
  }
}

const activityTimelinePass = mrSmokeActivityTimelineVerdict({
  running: {
    probe_completed: true,
    group_count: 1,
    active_group_count: 1,
    current_count: 1,
  },
  completed: {
    probe_completed: true,
    group_count: 1,
    completed_toggle_count: 1,
    expanded_before_count: 0,
    toggle_clicked: true,
    expanded_after_count: 1,
    assistant_text: '已完成目录检查。',
    reply_complete: true,
  },
});
assert.equal(activityTimelinePass.evidence_valid, true);
assert.equal(activityTimelinePass.oracle_valid, true, '活动流必须形成运行态、完成折叠、展开与正文闭环');
for (const invalid of [
  { running: { active_group_count: 0 } },
  { completed: { expanded_before_count: 1 } },
  { completed: { toggle_clicked: false } },
  { completed: { assistant_text: '' } },
]) {
  const candidate = structuredClone({
    running: { probe_completed: true, group_count: 1, active_group_count: 1, current_count: 1 },
    completed: {
      probe_completed: true,
      group_count: 1,
      completed_toggle_count: 1,
      expanded_before_count: 0,
      toggle_clicked: true,
      expanded_after_count: 1,
      assistant_text: '已完成目录检查。',
      reply_complete: true,
    },
  });
  Object.assign(candidate.running, invalid.running || {});
  Object.assign(candidate.completed, invalid.completed || {});
  assert.equal(mrSmokeActivityTimelineVerdict(candidate).oracle_valid, false, '活动流任一关键态缺失必须失败');
}

const intervalApiMethods = Object.fromEntries(
  ['listLocal', 'refresh', 'listTemplates', 'create', 'update', 'runNow', 'listRuns', 'delete', 'deleteRun']
    .map((name) => [name, true]),
);
const intervalReadback = {
  api_surface_available: true,
  api_methods: intervalApiMethods,
  run_now_called: false,
  created_definition_id: 'automation-1',
  interval_ms: 3_600_000,
  definition_readback: {
    id: 'automation-1',
    enabled: true,
    schedule: { kind: 'interval', intervalMs: 3_600_000 },
  },
  post_create_refresh: { ok: true, definition_found: true, definition_count: 1 },
  ui_row: { visible: true, display_name_matched: true },
  run_observations: [{ run: { id: 'run-1', status: 'succeeded' } }],
  terminal_run: {
    id: 'run-1',
    automationId: 'automation-1',
    triggerKind: 'schedule',
    occurrenceKey: 'interval:2026-08-23T12:00:00+08:00',
    scheduledFor: Date.now(),
    sessionId: 'session-1',
    status: 'succeeded',
  },
  cleanup: {
    attempted: true,
    run_deleted: true,
    definition_deleted: true,
    foreign_resource_touched: false,
  },
};
assert.equal(mrSmokeIntervalScheduleVerdict(intervalReadback).oracle_valid, true, 'interval 到点 schedule 运行必须通过完整身份读回');
for (const invalid of [
  { run_now_called: true },
  { terminal_run: { ...intervalReadback.terminal_run, triggerKind: 'manual' } },
  { terminal_run: { ...intervalReadback.terminal_run, sessionId: null } },
  { terminal_run: { ...intervalReadback.terminal_run, status: 'failed' } },
  { cleanup: { ...intervalReadback.cleanup, foreign_resource_touched: true } },
]) {
  assert.equal(
    mrSmokeIntervalScheduleVerdict({ ...intervalReadback, ...invalid }).oracle_valid,
    false,
    '手动触发、身份缺失、失败终态或越界清理不得通过 interval 冒烟',
  );
}
const intervalDriverStart = runner.indexOf('async function qworkMrIntervalScheduleCase');
const intervalDriverEnd = runner.indexOf('\nasync function executeQworkDailyNativeCase', intervalDriverStart);
const intervalDriverSource = runner.slice(intervalDriverStart, intervalDriverEnd);
assert.ok(intervalDriverStart > 0 && intervalDriverEnd > intervalDriverStart, '必须存在 interval 原生 Driver');
assert.doesNotMatch(intervalDriverSource, /\.runNow\s*\(/, 'interval Driver 禁止用 runNow 伪造 schedule 到点执行');
assert.doesNotMatch(intervalDriverSource, /page\.reload\s*\(/, 'interval Driver 禁止整页 reload，避免 Teams WebView renderer replacement');
assert.match(intervalDriverSource, /const intervalMs = 60_000;/, 'interval Driver 必须使用服务端合同允许的最小 60 秒 interval');
assert.match(intervalDriverSource, /const activeFrom = Date\.now\(\);/, 'interval Driver 必须从当前时刻起算，禁止依赖服务端会钳制的过去 activeFrom');
assert.doesNotMatch(intervalDriverSource, /Date\.now\(\) - intervalMs/, 'interval Driver 禁止通过回填过去 activeFrom 伪造即将到点');
assert.match(intervalDriverSource, /window\.agent(?:\?|)\.personalAutomations|window\.agent\?\.personalAutomations/, 'interval Driver 必须使用公开 personalAutomations API');
assert.match(intervalDriverSource, /await api\.refresh\(\)/, 'interval Driver 创建定义后必须调用公开 refresh 刷新投影');
assert.match(intervalDriverSource, /await openNewTask\(page, state\);\s*await openQworkAutomationView\(page, state\);/, 'interval Driver 必须通过真实导航离开自动化页再返回');
assert.match(intervalDriverSource, /finally\s*\{/, 'interval Driver 必须在异常路径执行定向清理');
assert.match(intervalDriverSource, /runObservations.*reverse\(\).*find/, 'interval Driver 必须从最后观察恢复 run 身份');
assert.match(intervalDriverSource, /typeof api\?\.cancelRun === 'function'/, 'interval Driver 必须在公开能力存在时取消活动 run');
assert.match(intervalDriverSource, /matchingRuns\.filter|filter\(\(item\).*automationId/, 'interval Driver 清理前必须按 definition 身份过滤运行记录');
assert.match(intervalDriverSource, /definition_delete_result = await api\.delete[\s\S]*await api\.refresh\(\)/, 'interval Driver 删除定义后必须显式刷新公开投影');
assert.match(intervalDriverSource, /definitionCleanupDeadline[\s\S]*definition_absence_observations/, 'interval Driver 必须有界轮询并保存目标定义消失读回');
assert.doesNotMatch(intervalDriverSource, /deleteAll|clearAll|purge/i, 'interval Driver 禁止使用全量或越界清理');
assert.match(productionGrayCasebookBuilder, /next\['测试数据'\] = 'intervalMs=60000；activeFrom=当前时刻；唯一显示名；禁止调用 runNow。';/, 'Casebook 生成器必须声明 60 秒 interval 与当前时刻 activeFrom');
assert.match(productionGrayCasebookBuilder, /等待首次真实 interval tick 自动触发/, 'Casebook 生成器必须等待真实 interval tick');
assert.doesNotMatch(productionGrayCasebookBuilder, /activeFrom=now-interval\+15s|约 15 秒后产生 schedule run/, 'Casebook 生成器禁止保留服务端会钳制的旧 interval 回填合同');
const r9IncrementalMrIids = [
  '1459', '1462', '1393', '1430', '1463', '1464', '1465', '1468', '1466', '1469',
  '1454', '1458', '1467', '1471', '1470', '1473', '1472', '1476', '1461', '1475',
  '1460', '1480', '1477', '1484', '1481', '1494', '1474', '1488', '1495', '1496',
  '1491', '1492', '1498', '1499', '1485', '1501', '1479', '1490', '1486', '1489',
  '1504', '1506', '1483', '1487', '1497', '1508', '1512', '1514', '1515', '1509',
  '1503', '1513', '1518', '1519', '1524', '1521', '1520',
];
const r9IncrementalMrSequence = new RegExp(r9IncrementalMrIids.map((iid) => `!${iid}`).join('[\\s\\S]*'));
for (const documentText of [automationFramework, coreBetaOperatingGuide]) {
  assert.match(documentText, /QBot核心生命线与新增MR生产灰度全量回归Casebook_16-12-70-160条_2026-09-05-r14\.xlsx/, '两份规范必须冻结16/12/70/160分层Casebook路径');
  assert.match(documentText, /核心生命线门禁/, '两份规范必须冻结16条核心生命线Sheet');
  assert.match(documentText, /新增MR核心冒烟/, '两份规范必须冻结新增 MR 核心冒烟 Sheet');
  assert.match(documentText, /[0-9a-f]{64}/, '两份规范必须冻结最新合并 Casebook SHA');
  assert.match(documentText, /0cfdfa1ec9f18d2ef2e78d380b4b2896c6dc607c[\s\S]*0\.1\.7/, '两份规范必须冻结 r14 release/0.1 设计基线与产品版本');
  assert.match(documentText, /r12[\s\S]*134 个[\s\S]*36 个[\s\S]*170 个/, '两份规范必须记录 r12 继承、r14 增量和170个MR总量');
  assert.match(documentText, /6d482c9ccbceb74d4ebf81610d980e5fe15def6c[\s\S]*37 个增量 MR[\s\S]*171 个总 MR/, '两份规范必须记录 !1573 后的 r15 待生成设计边界');
  assert.match(documentText, /--max-commits 500[\s\S]*!1573[\s\S]*SIT-MEM-001[\s\S]*BETA-CHAT-001[\s\S]*BETA-MCP-001[\s\S]*MRSMOKE-ROUTE-001/, '两份规范必须要求从 r12 全量重扫并冻结 !1573 的显式桌面相邻映射');
  assert.match(documentText, /deepbankv2-mr-1573-memory-session-profile-stability\/v1[\s\S]*claim_scope=source_and_test_declarations[\s\S]*test_execution_attested=false[\s\S]*(?:不得|禁止).*冒充/, '两份规范必须区分 !1573 源码声明鉴证与桌面 E2E 结论');
  assert.match(documentText, r9IncrementalMrSequence, '两份规范必须完整同序列出 r9 的57个增量MR');
  assert.match(documentText, /!1516[\s\S]*MRSMOKE-FAIL-001[\s\S]*MRSMOKE-ROUTE-001[\s\S]*BETA-CHAT-005[\s\S]*BETA-PERF-003/, '两份规范必须固定MR !1516的四条精确覆盖映射');
  assert.match(documentText, /!1526[\s\S]*MRSMOKE-SKILL-001[\s\S]*MRSMOKE-FAIL-001[\s\S]*BETA-CHAT-006[\s\S]*BETA-PERF-003/, '两份规范必须固定MR !1526的四条精确覆盖映射');
  assert.match(documentText, /!1523[\s\S]*MRSMOKE-WEB-001[\s\S]*MRSMOKE-WEB-002[\s\S]*BETA-CHAT-005[\s\S]*SIT-CONN-019/, '两份规范必须固定MR !1523的四条精确覆盖映射');
  assert.match(documentText, /!1522[\s\S]*MRSMOKE-ROUTE-001[\s\S]*BETA-CHAT-001[\s\S]*BETA-ROUTE-001[\s\S]*BETA-HOST-003/, '两份规范必须固定MR !1522的四条精确覆盖映射');
  assert.match(documentText, /!1522[\s\S]*Header 字节[\s\S]*源码静态合同[\s\S]*审计[\s\S]*不声称[\s\S]*(?:UI|桌面)[\s\S]*Header/, '两份规范必须区分 !1522 Header 静态合同与桌面E2E证据边界');
  assert.match(documentText, /MRSMOKE-WEB-001[\s\S]*同一.*task[\s\S]*四轮[\s\S]*四个.*provider receipt[\s\S]*第四轮/, '两份规范必须冻结 !1523 四轮真实Web搜索合同');
  assert.match(documentText, /You can only search three times[\s\S]*The server rejected the fourth search[\s\S]*The search quota has been hit/, '两份规范必须冻结英文固定配额拒绝语义');
  assert.match(documentText, /权威 Case 目录[\s\S]*prompt SHA[\s\S]*lstat[\s\S]*(?:符号链接|symlink)[\s\S]*bytes[\s\S]*SHA-256/, '两份规范必须要求 quota trace 从磁盘重算 prompt 与截图完整性');
  assert.match(documentText, /本地[\s\S]*Git 对象[\s\S]*GitLab API[\s\S]*branch HEAD[\s\S]*first-parent[\s\S]*overflow/, '两份规范必须允许以完整API intake替代本地历史对象并维持fail-closed校验');
  assert.match(documentText, /GitLab API freshness[\s\S]*branch HEAD[\s\S]*first-parent[\s\S]*changes_count[\s\S]*BLOCKED/, '两份规范必须冻结API freshness和漂移阻断合同');
  assert.match(documentText, /--freshness-source gitlab-api[\s\S]*--gitlab-token-stdin/, '两份规范必须要求正式扫描从关闭回显stdin注入token并使用API freshness');
  assert.match(documentText, /!1329[\s\S]*静态合同审计[\s\S]*不新增[\s\S]*桌面/, '两份规范必须明确MR !1329只做静态合同审计且不新增桌面Case');
  assert.match(documentText, /r8[\s\S]*73 个[\s\S]*!1374/, '两份规范必须保留 r8 的73个MR继承关系和!1374历史映射');
  assert.match(documentText, /!1329[\s\S]*(?:CI|Dashboard|eval|工具链)[\s\S]*静态合同审计/, '两份规范必须冻结非桌面变更的静态审计分类');
  assert.match(documentText, /MRSMOKE-SKILL-001[\s\S]*SIT-SKILL-MR-001/, '两份规范必须冻结 MR Skill 组合 driver 路由');
  assert.match(documentText, /reconcileSkills[\s\S]*结构化 `ready` 和 `materialized`[\s\S]*成功安装事务/, '两份规范必须冻结 Skill Fixture 的结构化就绪回读合同');
  for (const evidenceRole of ['workspace_missing_error_readback', 'skill_install_attempt_ledger', 'external_navigation_trace', 'web_search_quota_trace', 'interactive_chart_readback', 'skill_execution_trace', 'connector_retry_recovery_trace', 'horizontal_overflow_readback']) {
    assert.match(documentText, new RegExp(evidenceRole), `两份规范必须冻结新增 MR 专项证据角色 ${evidenceRole}`);
  }
  assert.match(documentText, /6 条(?:使用)?原生 driver[\s\S]*6 条(?:使用)?经过语义复核的 legacy driver/, '两份规范必须冻结 6 native / 6 legacy 能力构成');
  assert.match(documentText, /11 条 native[\s\S]*5 条 verified legacy|11 条(?:使用)?原生[\s\S]*5 条(?:使用)?经过语义复核/, '两份规范必须冻结核心生命线 11 native / 5 legacy 能力构成');
  assert.match(documentText, /160 条全量[\s\S]*61(?: 条)?(?:原生| native)[\s\S]*1 条(?:原生 )?IME[\s\S]*98(?: 条)?(?:经过语义复核| legacy)/, '两份规范必须冻结 r14 全量回归 61 native / 1 IME / 98 legacy 能力构成');
  assert.match(documentText, /G0[\s\S]*G1[\s\S]*G2[\s\S]*G3[\s\S]*G4[\s\S]*G5/, '两份规范必须固定G0-G5执行顺序');
  assert.match(documentText, /NOT_STARTED[\s\S]*raw `passed\/failed`|raw `passed\/failed`[\s\S]*NOT_STARTED/, '两份规范必须让可信非pass阻断后续阶段且禁止raw结果驱动准入');
  assert.match(documentText, /439f14686df4a1623015e3964b61a6943455c804938be2680a8d6fedde9bf2ed/, '两份规范必须冻结 r14 Casebook 精确 SHA-256');
  assert.match(documentText, /release-test-integrity\.json[\s\S]*revision[\s\S]*previous_event_sha256[\s\S]*前向哈希链/, '两份规范必须冻结计划、状态和事件前向哈希完整性合同');
  assert.match(documentText, /summary[\s\S]*progress[\s\S]*run metadata[\s\S]*可信复核[\s\S]*qbot-core-evidence\/v2/, '两份规范必须要求四源完成审计和逐Case v2 manifest');
  assert.match(documentText, /core-beta-v2-forced-serial[\s\S]*effective parallel=1[\s\S]*single-host-pipeline=1/, '两份规范必须冻结M3单宿主强制串行完成门禁');
  assert.match(documentText, /api\/health\/ready[\s\S]*env-health-fingerprint[\s\S]*backend-version/, '两份规范必须冻结SIT health与backend identity绑定门禁');
  assert.match(documentText, /磁盘\s*`evidence-manifest\.json`[\s\S]*lstat[\s\S]*(?:实际|实读)文件字节数[\s\S]*SHA-256/, '两份规范必须要求从磁盘实读manifest和证据文件SHA');
  assert.match(documentText, /run-metadata\.json\.profile[\s\S]*mode:\"live\"[\s\S]*alias:[\s\S]*summary[\s\S]*mandatory/, '两份规范必须按Teams真实profile对象与summary mandatory分别校验');
  assert.match(documentText, /G0[\s\S]*capabilities[\s\S]*object[\s\S]*health[\s\S]*HTTP 200[\s\S]*preparedRelease=null[\s\S]*十字段身份/, '两份规范必须逐字段复核G0且不得只信聚合状态');
  assert.match(documentText, /G4 readiness[\s\S]*已准入 G3[\s\S]*70 个 ID[\s\S]*精确同序/, '两份规范必须让G4前缀绑定已准入G3');
  assert.match(documentText, /qbot-qwork-soak-report\/v1[\s\S]*(?:realpath|路径)[\s\S]*(?:inode|device\/inode)[\s\S]*bytes[\s\S]*SHA-256/, '两份规范必须冻结G5磁盘证据与路径/inode/bytes/SHA合同');
  assert.match(documentText, /100[^\n]*(?:task|任务)[\s\S]*3 次受管重启[\s\S]*restart-before\/restart-after[\s\S]*startup[\s\S]*run-final/, '两份规范必须冻结G5任务、重启与首尾身份观察合同');
  assert.match(documentText, /(?=[\s\S]*RSS peak)(?=[\s\S]*growth)(?=[\s\S]*slope)(?=[\s\S]*中途)/, '两份规范必须要求从全量资源样本重算峰值、增长量和斜率');
  assert.match(
    documentText,
    /qbot-core-gray-run\/v2[\s\S]*control_dir[\s\S]*release_plan[\s\S]*completion_event[\s\S]*soak_report[\s\S]*路径\/SHA/,
    '两份规范必须要求灰度聚合只接受状态机控制树、completion event 和磁盘Soak绑定',
  );
  assert.match(documentText, /完整(?:的)?\s*event\/state\/hash 链|完整重放五棵 v2 event\/state\/hash 链/, '两份规范必须要求重放完整状态机事件链');
  assert.match(documentText, /framework commit[\s\S]*Casebook[\s\S]*Case 合同[\s\S]*(?:device\/inode|证据树)/, '两份规范必须冻结五轮 framework/Casebook/Case 合同与证据 provenance');
  assert.match(documentText, /160\/160[\s\S]*(?:一个|1 个).*70\s*等价轮次/, '两份规范必须要求五轮候选含一轮完整160且只计一个70等价轮次');
}
assert.match(qworkSoakReportSource, /TASK_ARTIFACT_ROLES[\s\S]*dispatch_receipt[\s\S]*send_receipt[\s\S]*terminal_receipt/, 'G5校验器必须要求每任务三类独立receipt');
assert.match(qworkSoakReportSource, /stability\.length >= 3[\s\S]*running === false[\s\S]*status === 'succeeded'/, 'G5校验器必须要求至少三次稳定成功终态观察');
assert.match(qworkSoakReportSource, /host_process_started_at[\s\S]*renderer_process_started_at[\s\S]*session_id[\s\S]*cdp_endpoint[\s\S]*webview_target_id/, 'G5校验器必须绑定完整宿主与renderer上下文');
assert.match(qworkSoakReportSource, /startedAt - beforeObservedAt > policy\.maximum_resource_sample_gap_ms[\s\S]*afterObservedAt - recoveredAt > policy\.maximum_resource_sample_gap_ms/, 'G5重启前后身份观察必须有界新鲜');
assert.match(qworkSoakReportSource, /startupAt - reportStart > policy\.maximum_resource_sample_gap_ms[\s\S]*reportEnd - finalAt > policy\.maximum_resource_sample_gap_ms/, 'G5首尾身份观察必须贴近报告边界');
assert.match(qworkSoakReportSource, /intervalWithinMaximum[\s\S]*monitoring_interval_ms[\s\S]*intervalWithinMaximum[\s\S]*sampling_interval_ms/, 'G5声明采样间隔允许小于上限但必须为正且不得超限');
assert.match(qworkSoakReportSource, /soak_artifact_file_reused[\s\S]*soak_artifact_bytes_mismatch[\s\S]*soak_artifact_sha256_mismatch[\s\S]*soak_artifact_orphaned/, 'G5校验器必须拒绝复用、字节或SHA漂移和孤立证据');
assert.match(coreBetaGrayGateSource, /qbot-core-gray-run\/v2[\s\S]*replayControlTree[\s\S]*applyQworkStageAudit[\s\S]*required_full160_not_passed_in_candidate_runs/, '灰度聚合必须从状态机事件重放磁盘完成审计且要求至少一轮完整160');
assert.match(coreBetaGrayGateSource, /verifyEventExternalArtifacts[\s\S]*snapshotDirectoryTree[\s\S]*directory_sha256_mismatch/, '灰度聚合必须重验完整事件链的文件与目录树SHA');
assert.match(coreBetaGrayGateSource, /framework_commit_not_stable_across_candidate_runs[\s\S]*reused_run_id[\s\S]*reused_completion_event[\s\S]*reused_trusted_review_sha256[\s\S]*reused_evidence_inode/, '灰度聚合必须拒绝混合framework commit、重复run/event、复用可信复核内容和证据inode');
assert.match(coreBetaGrayGateSource, /required_consecutive_runs_must_be_5[\s\S]*fixed_case_policy_must_be_70_and_160[\s\S]*STOP_PIPELINE/, '灰度聚合必须固定五轮70\/160并结构化fail-closed');
assert.doesNotMatch(coreBetaGrayGateSource, /soak\.tasks_completed[\s\S]*soak\.restart_count[\s\S]*soak\.evidence_complete/, '灰度聚合不得恢复旧式Soak自报放行');
assert.match(qworkReleaseTestPlan, /QWORK_RELEASE_TEST_INTEGRITY_SCHEMA[\s\S]*event_count[\s\S]*last_event_sha256/, '发布状态库必须封印事件计数和末事件SHA');
assert.match(qworkReleaseTestPlan, /QWORK_RELEASE_CASEBOOK_BASENAME[\s\S]*QWORK_RELEASE_CASEBOOK_SHA256[\s\S]*casebook_basename_mismatch[\s\S]*casebook_sha256_mismatch/, '发布状态库必须锁定正式Casebook文件名与SHA');
assert.match(qworkReleaseTestPlan, /summary_status_not_passed/, '发布状态库必须校验summary通过状态');
assert.match(qworkReleaseTestPlan, /summary_result_case_ids_mismatch/, '发布状态库必须校验summary Case顺序');
assert.match(qworkReleaseTestPlan, /summary_evidence_manifest_incomplete/, '发布状态库必须校验summary逐Case证据完整性');
assert.match(qworkReleaseTestPlan, /manifest_disk_mismatch[\s\S]*evidence_file_type[\s\S]*evidence_bytes_mismatch[\s\S]*evidence_sha256_mismatch/, '发布状态库必须实读磁盘manifest和证据文件');
assert.match(qworkReleaseTestPlan, /profile\?\.mode !== 'live'[\s\S]*profile\?\.alias[\s\S]*summary\?\.profile/, '发布状态库必须按Teams真实profile对象校验');
assert.match(qworkReleaseTestPlan, /full160_gray70_prefix_mismatch/, '发布状态库必须拒绝G4前70条与已准入G3漂移');
assert.match(qworkReleaseTestPlan, /core-beta-v2-forced-serial[\s\S]*effective_parallelism[\s\S]*effective_single_host_pipeline_size/, '发布状态库必须校验强制串行策略');
assert.match(qworkReleaseTestPlan, /qwork_control_plane_health[\s\S]*qwork_backend_identity[\s\S]*pretest_control_plane_health_not_ready[\s\S]*pretest_backend_identity_mismatch/, '发布状态库必须拒绝SIT health或backend fingerprint漂移');
assert.match(qworkReleaseOrchestrator, /previous_event_sha256[\s\S]*event_chain_mismatch[\s\S]*last_event_sha256_mismatch/, '编排器必须逐事件复核前向哈希链');
assert.match(productionGrayCasebookBuilder, /QWORK_CORE_LIFELINE_CASE_IDS[\s\S]*coreLifelineCases[\s\S]*核心生命线门禁/, 'Casebook生成器必须从共享合同生成16条核心生命线Sheet');
assert.match(productionGrayCasebookBuilder, /let PRODUCT_COMMIT = '';[\s\S]*PRODUCT_COMMIT = releaseIntake\.report\.release\.head;/, 'Casebook生成器必须从通过校验的intake动态冻结最新release/0.1提交');
assert.match(productionGrayCasebookBuilder, /(?=[\s\S]*EXPECTED_INCREMENTAL_MR_COUNT)(?=[\s\S]*async function loadReleaseIntake\(\)[\s\S]*--release-intake)(?=[\s\S]*requireFreshRef: true)(?=[\s\S]*api_freshness)/, 'Casebook生成器必须强制消费READY的GitLab API freshness intake');
assert.match(productionGrayCasebookBuilder, /assertExpectedProductCommit\(expectedProductCommit, releaseHead\)/, 'Casebook生成器必须强制校验 expected-product-commit 与 intake HEAD 精确一致');
assert.match(productionGrayCasebookBuilder, /prepareCasebookOutputDirectory\(option\('out'\)\)[\s\S]*outputTransaction\.staging[\s\S]*sha256File\(PREVIOUS_CASEBOOK\)/, 'Casebook生成器必须显式接收 --out，并在读取和构建前锁定调用前不存在的私有 staging 目录');
assert.doesNotMatch(productionGrayCasebookBuilder, /prepareCasebookOutputDirectory\(option\('out',\s*DEFAULT_OUTPUT_DIR\)\)/, 'Casebook生成器不得通过默认目录绕过显式 --out');
assert.match(productionGrayCasebookBuilder, /assertExpectedReleaseIntakeSha256\(option\('release-intake-sha256'\), artifactSha256\)/, 'Casebook生成器必须显式接收并校验 --release-intake-sha256');
assert.match(productionGrayCasebookBuilder, /QBot核心生命线与新增MR生产灰度全量回归Casebook_16-12-70-160条_2026-09-05-r15\.xlsx/, '正式输出必须升级到全新 r15 文件名');
assert.doesNotMatch(productionGrayCasebookBuilder, /const DEFAULT_OUTPUT_DIR\s*=/, '生成器不得保留默认构建目录，--out 必须由调用者显式提供');
assert.match(productionGrayCasebookBuilder, /const PREVIOUS_CASEBOOK = path\.join\(ROOT, 'PRD', 'QBot核心生命线与新增MR生产灰度全量回归Casebook_16-12-70-160条_2026-09-03-r12\.xlsx'\)/, 'r15 增量生成基线必须继续锁定 r12');
assert.doesNotMatch(productionGrayCasebookBuilder, /const OUTPUT_NAME = '[^']*r(?:13|14)\.xlsx'/, '旧 r13/r14 不得继续作为正式输出目标');
assert.match(
  productionGrayCasebookBuilder,
  /captureSecureDirectory[\s\S]*assertSecureDirectoryGuard[\s\S]*fsyncSecureTree[\s\S]*atomicRenameNoReplace[\s\S]*spawnSync\([\s\S]*'\/usr\/bin\/python3'[\s\S]*atomicRenameNoReplace\(transaction\.staging, transaction\.final\)/,
  'r15 生成器必须绑定安全目录身份、fsync 私有 staging 并以受控 helper 排他原子提交 --out',
);
assert.match(
  atomicRenameNoReplaceHelper,
  /renamex_np[\s\S]*RENAME_EXCL\s*\|\s*RENAME_NOFOLLOW_ANY/,
  '目录提交 helper 必须使用 macOS renamex_np 的 RENAME_EXCL 与 RENAME_NOFOLLOW_ANY',
);
assert.doesNotMatch(
  productionGrayCasebookBuilder,
  /fs\.rename\(transaction\.staging, transaction\.final\)/,
  '目录提交不得退化为可覆盖并发空目标目录的普通 fs.rename',
);
assert.match(
  productionGrayCasebookBuilder,
  /transaction\.tree_snapshot = fsyncSecureTree[\s\S]*transaction\.state = 'renamed_pending_commit'[\s\S]*transaction\.state = 'parent_synced'[\s\S]*verifySecureTreeSnapshot[\s\S]*transaction\.state = 'committed'[\s\S]*transaction\.committed = true/,
  '输出目录必须在 fsync 整树快照、rename、父目录 fsync 和 rename 后整树复核后才进入 committed',
);
assert.match(
  productionGrayCasebookBuilder,
  /atomicRenameNoReplace\(temporary, resolvedFormalOutput\)[\s\S]*publication\.state = 'renamed_pending_commit'[\s\S]*publication\.state = 'parent_synced'[\s\S]*publication\.state = 'verified_pending_commit'[\s\S]*publication\.state = 'committed'[\s\S]*publication\.committed = true/,
  '正式文件必须在排他原子 rename、父目录 fsync 和最终内容复核后才进入 committed',
);
assert.match(
  productionGrayCasebookBuilder,
  /transactionQuarantinePath[\s\S]*isolateAndRetainGuardedDirectory[\s\S]*directoryIdentityMatches[\s\S]*status: 'retained'[\s\S]*rollback_conflict[\s\S]*rollback_incomplete/,
  '输出目录回滚必须先排他隔离保留并区分身份冲突和无法闭合',
);
assert.match(
  productionGrayCasebookBuilder,
  /isolateAndRetainGuardedRegularFile[\s\S]*stableRegularFileSnapshot\(quarantine[\s\S]*regularFileIdentityMatches[\s\S]*status: 'retained'[\s\S]*rollback_conflict[\s\S]*rollback_incomplete/,
  '正式文件回滚必须在隔离后复核身份与内容并保留，禁止按可变路径删除',
);
assert.doesNotMatch(
  productionGrayCasebookBuilder,
  /fs\.(?:rm|unlink)\(quarantine|fs\.rm\(staging|await fs\.unlink\(temporary\)/,
  '生成器不得在身份复核后按可变 quarantine/staging/临时名删除',
);
const atomicRenameHelperSyntax = spawnSync(
  '/usr/bin/python3',
  ['-I', '-B', '-c', 'import ast,sys; ast.parse(sys.stdin.read())'],
  { encoding: 'utf8', input: atomicRenameNoReplaceHelper },
);
assert.equal(
  atomicRenameHelperSyntax.status,
  0,
  `排他原子 rename helper Python 语法必须有效：${atomicRenameHelperSyntax.stderr || ''}`,
);
assert.match(
  productionGrayCasebookBuilder,
  /stableRegularFileSnapshot[\s\S]*fsConstants\.O_NOFOLLOW[\s\S]*written\.nlink !== 1n[\s\S]*atomicRenameNoReplace\(temporary, resolvedFormalOutput\)[\s\S]*published\.sha256 !== artifact\.sha256/,
  'r15 正式文件必须拒绝 symlink/hardlink，以 fsync 后的同目录临时文件排他原子 rename 并复核 SHA',
);
assert.doesNotMatch(productionGrayCasebookBuilder, /fs\.link\(temporary, resolvedFormalOutput\)/, '正式发布不得回退到需要二次删除临时 hard-link 的路径');
for (const documentText of [automationFramework, coreBetaOperatingGuide]) {
  assert.match(
    documentText,
    /r15[\s\S]*私有\s*staging[\s\S]*device\/inode\/uid\/mode[\s\S]*fsync[\s\S]*O_EXCL\|O_NOFOLLOW[\s\S]*renamex_np\(RENAME_EXCL \| RENAME_NOFOLLOW_ANY\)[\s\S]*bytes\/SHA-256\/inode\/link count/,
    '两份规范必须冻结 r15 staging、目录身份、fsync 与正式原子排他发布合同',
  );
  assert.match(
    documentText,
    /renamed_pending_commit[\s\S]*parent_synced[\s\S]*committed[\s\S]*正式文件事务[\s\S]*renamed_pending_commit[\s\S]*verified_pending_commit[\s\S]*quarantine[\s\S]*rollback_conflict[\s\S]*rollback_incomplete/,
    '两份规范必须冻结目录和正式文件的 pending 提交状态及排他回滚分类',
  );
}
assert.match(
  productionGrayCasebookBuilder,
  /(?=[\s\S]*const auditedArtifact = stableRegularFileSnapshot\(outputFile)(?=[\s\S]*new FileBlob\([\s\S]*auditedArtifact\.bytes)(?=[\s\S]*const runtimeAudit = auditCasebookRuntimeScopes\(scopes\))(?=[\s\S]*expectedArtifactSha256: auditedArtifact\.sha256)(?=[\s\S]*verifySecureTreeSnapshot)(?=[\s\S]*atomicRenameNoReplace\(temporary, resolvedFormalOutput\))/,
  '导出后四层 runtime 审计必须与同一 artifact 字节/SHA 及 rename 后整树快照强绑定，任何漂移均 fail-closed',
);
const expectedProductCommitFixture = '0cfdfa1ec9f18d2ef2e78d380b4b2896c6dc607c';
assert.equal(assertExpectedProductCommit(expectedProductCommitFixture, expectedProductCommitFixture), expectedProductCommitFixture, '40位且与intake HEAD全等的expected-product-commit必须通过');
assert.throws(() => assertExpectedProductCommit('', expectedProductCommitFixture), /必须通过 --expected-product-commit/, '省略expected-product-commit必须fail-closed');
assert.throws(() => assertExpectedProductCommit('0cfdfa1', expectedProductCommitFixture), /必须是 40 位提交 SHA/, '非40位expected-product-commit必须fail-closed');
assert.throws(() => assertExpectedProductCommit('ffffffffffffffffffffffffffffffffffffffff', expectedProductCommitFixture), /HEAD 与 --expected-product-commit 不一致/, '与intake HEAD不同的40位SHA必须fail-closed');
const expectedReleaseIntakeSha256Fixture = 'a'.repeat(64);
assert.equal(
  assertExpectedReleaseIntakeSha256(expectedReleaseIntakeSha256Fixture, expectedReleaseIntakeSha256Fixture),
  expectedReleaseIntakeSha256Fixture,
  '合法且与实际文件一致的 release intake SHA-256 必须通过',
);
assert.throws(
  () => assertExpectedReleaseIntakeSha256('', expectedReleaseIntakeSha256Fixture),
  /必须通过 --release-intake-sha256/,
  '省略 --release-intake-sha256 必须 fail-closed',
);
assert.throws(
  () => assertExpectedReleaseIntakeSha256('not-a-sha256', expectedReleaseIntakeSha256Fixture),
  /必须是 64 位 SHA-256/,
  '畸形 --release-intake-sha256 必须 fail-closed',
);
assert.throws(
  () => assertExpectedReleaseIntakeSha256('b'.repeat(64), expectedReleaseIntakeSha256Fixture),
  /release intake 文件 SHA-256 不一致/,
  '声明值与实际 intake 文件 SHA-256 不一致时必须 fail-closed',
);

const casebookOutputGuardRoot = fs.mkdtempSync(path.join(
  fs.realpathSync(os.tmpdir()),
  'qbot-casebook-output-guard-',
));
fs.chmodSync(casebookOutputGuardRoot, 0o700);
const previousNodeEnv = process.env.NODE_ENV;
const casebookTransactionEnvironmentKeys = [
  'QBOT_CASEBOOK_FAULT_BEFORE_OUTPUT_COMMIT',
  'QBOT_CASEBOOK_FAULT_AFTER_OUTPUT_RENAME',
  'QBOT_CASEBOOK_FAULT_AFTER_OUTPUT_PARENT_FSYNC',
  'QBOT_CASEBOOK_FAULT_AFTER_OUTPUT_FINAL_VERIFY',
  'QBOT_CASEBOOK_TEST_RACE_EMPTY_OUTPUT_AFTER_GUARD',
  'QBOT_CASEBOOK_TEST_REPLACE_OUTPUT_AFTER_RENAME',
  'QBOT_CASEBOOK_TEST_MUTATE_TREE_AFTER_FSYNC',
  'QBOT_CASEBOOK_TEST_REPLACE_STAGING_DURING_PREPARE',
  'QBOT_CASEBOOK_TEST_REPLACE_DIRECTORY_QUARANTINE_AFTER_VERIFY',
  'QBOT_CASEBOOK_FAULT_BEFORE_FORMAL_PUBLISH',
  'QBOT_CASEBOOK_FAULT_AFTER_FORMAL_RENAME',
  'QBOT_CASEBOOK_FAULT_AFTER_FORMAL_PARENT_FSYNC',
  'QBOT_CASEBOOK_FAULT_AFTER_FORMAL_FINAL_VERIFY',
  'QBOT_CASEBOOK_TEST_REPLACE_FORMAL_BEFORE_ROLLBACK',
  'QBOT_CASEBOOK_TEST_REPLACE_FILE_QUARANTINE_AFTER_VERIFY',
  'QBOT_CASEBOOK_TEST_REPLACE_ARTIFACT_BEFORE_FORMAL_PUBLISH',
];
const previousCasebookTransactionEnvironment = new Map(
  casebookTransactionEnvironmentKeys.map((key) => [key, process.env[key]]),
);
for (const key of casebookTransactionEnvironmentKeys) delete process.env[key];
try {
  assert.throws(
    () => atomicRenameNoReplace('', ''),
    /source\/target 不能为空/,
    '排他原子 rename 必须拒绝空 source/target',
  );
  await assert.rejects(
    prepareCasebookOutputDirectory(''),
    /必须提供非空 --out 输出目录/,
    '省略显式 --out 必须在创建任何目录前 fail-closed',
  );
  process.env.NODE_ENV = 'test';
  const prepareRaceOutput = path.join(casebookOutputGuardRoot, 'prepare-race-output');
  process.env.QBOT_CASEBOOK_TEST_REPLACE_STAGING_DURING_PREPARE = '1';
  let prepareRaceError;
  await assert.rejects(
    prepareCasebookOutputDirectory(prepareRaceOutput),
    (error) => {
      prepareRaceError = error;
      return /fault_injected_staging_replaced_during_prepare/.test(error?.message || String(error));
    },
    'prepare 期间 staging 被替换时必须 fail-closed',
  );
  delete process.env.QBOT_CASEBOOK_TEST_REPLACE_STAGING_DURING_PREPARE;
  assert.equal(prepareRaceError?.transaction_state, 'rollback_conflict', 'prepare 替换必须报告 rollback_conflict');
  assert.equal(prepareRaceError?.rollback?.staging_prepare?.status, 'rollback_conflict');
  assert.equal(
    fs.readFileSync(path.join(prepareRaceError.staging_path, 'third-party.txt'), 'utf8'),
    'third-party-prepare-staging',
    'prepare 失败不得删除第三方替换目录',
  );
  assert.equal(fs.existsSync(prepareRaceError.transaction_owned_path), true, 'prepare 失败必须保留本事务原 staging');

  const newOutputDir = path.join(casebookOutputGuardRoot, 'new-output');
  const outputTransaction = await prepareCasebookOutputDirectory(newOutputDir);
  assert.equal(outputTransaction.final, newOutputDir, '输出事务必须绑定调用者指定的最终目录');
  assert.equal(fs.existsSync(newOutputDir), false, '构建完成前不得暴露最终输出目录');
  assert.deepEqual(fs.readdirSync(outputTransaction.staging), [], '私有 staging 必须从空目录开始');
  assert.equal(fs.statSync(outputTransaction.staging).mode & 0o777, 0o700, '私有 staging 权限必须为0700');
  fs.writeFileSync(path.join(outputTransaction.staging, 'artifact.txt'), 'atomic-output');
  assert.equal(await commitCasebookOutputDirectory(outputTransaction), newOutputDir);
  assert.equal(outputTransaction.state, 'committed', '输出目录成功路径必须进入 committed 状态');
  assert.equal(outputTransaction.committed, true, '输出目录成功路径必须显式标记 committed=true');
  assert.equal(fs.existsSync(outputTransaction.staging), false, '输出目录提交成功后不得遗留 staging');
  assert.equal(fs.readFileSync(path.join(newOutputDir, 'artifact.txt'), 'utf8'), 'atomic-output');
  assert.equal(await abortCasebookOutputDirectory(outputTransaction), false, '已提交事务不得再删除最终输出');
  await assert.rejects(
    prepareCasebookOutputDirectory(newOutputDir),
    /必须在调用前不存在，禁止复用或覆盖/,
    '任何已存在目录即使为空也必须 fail-closed',
  );
  fs.writeFileSync(path.join(newOutputDir, '.partial-build'), 'occupied');
  await assert.rejects(prepareCasebookOutputDirectory(newOutputDir), /禁止复用或覆盖/, '含隐藏文件的非空输出目录必须fail-closed');
  const outputFile = path.join(casebookOutputGuardRoot, 'not-a-directory');
  fs.writeFileSync(outputFile, 'occupied');
  await assert.rejects(prepareCasebookOutputDirectory(outputFile), /禁止复用或覆盖/, '普通文件不得作为输出目录');

  const realParent = path.join(casebookOutputGuardRoot, 'real-parent');
  fs.mkdirSync(realParent, { mode: 0o700 });
  const linkedParent = path.join(casebookOutputGuardRoot, 'linked-parent');
  fs.symlinkSync(realParent, linkedParent);
  await assert.rejects(
    prepareCasebookOutputDirectory(path.join(linkedParent, 'out')),
    /路径祖先不得是符号链接/,
    '输出路径任一祖先为符号链接时必须 fail-closed',
  );

  const writableParent = path.join(casebookOutputGuardRoot, 'writable-parent');
  fs.mkdirSync(writableParent, { mode: 0o700 });
  fs.chmodSync(writableParent, 0o777);
  await assert.rejects(
    prepareCasebookOutputDirectory(path.join(writableParent, 'out')),
    /禁止 group\/other 写入/,
    'group/other 可写输出父目录必须 fail-closed',
  );
  fs.chmodSync(writableParent, 0o700);

  const raceOutput = path.join(casebookOutputGuardRoot, 'race-output');
  const raceTransaction = await prepareCasebookOutputDirectory(raceOutput);
  fs.writeFileSync(path.join(raceTransaction.staging, 'artifact.txt'), 'race');
  process.env.NODE_ENV = 'test';
  process.env.QBOT_CASEBOOK_TEST_RACE_EMPTY_OUTPUT_AFTER_GUARD = '1';
  await assert.rejects(
    commitCasebookOutputDirectory(raceTransaction),
    /排他原子提交失败/,
    '最终存在性检查后目标被并发抢占为空目录时不得覆盖',
  );
  delete process.env.QBOT_CASEBOOK_TEST_RACE_EMPTY_OUTPUT_AFTER_GUARD;
  assert.deepEqual(fs.readdirSync(raceOutput), [], '并发抢占者的空目标目录必须保持为空且不被替换');
  fs.rmdirSync(raceOutput);
  await abortCasebookOutputDirectory(raceTransaction);

  const hardlinkOutput = path.join(casebookOutputGuardRoot, 'hardlink-output');
  const hardlinkTransaction = await prepareCasebookOutputDirectory(hardlinkOutput);
  const hardlinkSource = path.join(hardlinkTransaction.staging, 'source.txt');
  fs.writeFileSync(hardlinkSource, 'hardlink');
  fs.linkSync(hardlinkSource, path.join(hardlinkTransaction.staging, 'alias.txt'));
  await assert.rejects(
    commitCasebookOutputDirectory(hardlinkTransaction),
    /只允许独占普通文件和目录/,
    'staging 内硬链接复用必须 fail-closed',
  );
  await abortCasebookOutputDirectory(hardlinkTransaction);

  const symlinkOutput = path.join(casebookOutputGuardRoot, 'symlink-output');
  const symlinkTransaction = await prepareCasebookOutputDirectory(symlinkOutput);
  fs.symlinkSync(outputFile, path.join(symlinkTransaction.staging, 'artifact-link'));
  await assert.rejects(
    commitCasebookOutputDirectory(symlinkTransaction),
    /路径祖先不得是符号链接/,
    'staging 内符号链接必须 fail-closed',
  );
  await abortCasebookOutputDirectory(symlinkTransaction);

  const faultOutput = path.join(casebookOutputGuardRoot, 'fault-output');
  const faultTransaction = await prepareCasebookOutputDirectory(faultOutput);
  fs.writeFileSync(path.join(faultTransaction.staging, 'artifact.txt'), 'fault');
  process.env.NODE_ENV = 'test';
  process.env.QBOT_CASEBOOK_FAULT_BEFORE_OUTPUT_COMMIT = '1';
  await assert.rejects(
    commitCasebookOutputDirectory(faultTransaction),
    /fault_injected_before_casebook_output_commit/,
  );
  assert.equal(fs.existsSync(faultOutput), false, '目录提交故障注入不得暴露最终输出');
  delete process.env.QBOT_CASEBOOK_FAULT_BEFORE_OUTPUT_COMMIT;
  await abortCasebookOutputDirectory(faultTransaction);

  const outputPostRenameFaults = [
    ['QBOT_CASEBOOK_FAULT_AFTER_OUTPUT_RENAME', /fault_injected_after_casebook_output_rename/],
    ['QBOT_CASEBOOK_FAULT_AFTER_OUTPUT_PARENT_FSYNC', /fault_injected_after_casebook_output_parent_fsync/],
    ['QBOT_CASEBOOK_FAULT_AFTER_OUTPUT_FINAL_VERIFY', /fault_injected_after_casebook_output_final_verify/],
  ];
  for (const [environmentKey, expectedError] of outputPostRenameFaults) {
    const suffix = environmentKey.toLowerCase().replaceAll('_', '-');
    const postRenameOutput = path.join(casebookOutputGuardRoot, suffix);
    const postRenameTransaction = await prepareCasebookOutputDirectory(postRenameOutput);
    const postRenameStaging = postRenameTransaction.staging;
    fs.writeFileSync(path.join(postRenameStaging, 'artifact.txt'), environmentKey);
    process.env[environmentKey] = '1';
    let observedError;
    await assert.rejects(
      commitCasebookOutputDirectory(postRenameTransaction),
      (error) => {
        observedError = error;
        return expectedError.test(error?.message || String(error));
      },
      `${environmentKey} 必须触发可识别的目录提交故障`,
    );
    delete process.env[environmentKey];
    assert.equal(postRenameTransaction.state, 'rollback_incomplete', `${environmentKey} 必须报告隔离保留`);
    assert.equal(postRenameTransaction.committed, false, `${environmentKey} 不得标记 committed`);
    assert.equal(observedError?.transaction_state, 'rollback_incomplete', `${environmentKey} 错误必须报告保留状态`);
    assert.equal(fs.existsSync(postRenameOutput), false, `${environmentKey} 后最终目录必须不存在`);
    assert.equal(fs.existsSync(postRenameStaging), false, `${environmentKey} 后 staging 必须不存在`);
    assert.equal(observedError?.rollback?.final?.status, 'retained', `${environmentKey} 必须隔离保留本事务目录`);
    assert.equal(fs.existsSync(observedError.rollback.final.preserved_path), true, `${environmentKey} 保留路径必须存在`);
  }

  const mutatedTreeOutput = path.join(casebookOutputGuardRoot, 'mutated-tree-output');
  const mutatedTreeTransaction = await prepareCasebookOutputDirectory(mutatedTreeOutput);
  fs.writeFileSync(path.join(mutatedTreeTransaction.staging, 'artifact.txt'), 'audited-tree-bytes');
  process.env.QBOT_CASEBOOK_TEST_MUTATE_TREE_AFTER_FSYNC = '1';
  let mutatedTreeError;
  await assert.rejects(
    commitCasebookOutputDirectory(mutatedTreeTransaction),
    (error) => {
      mutatedTreeError = error;
      return /与 fsync 时的整树身份或内容快照不一致/.test(error?.message || String(error));
    },
    'fsync 后改写内部文件必须在 rename 后整树复核时 fail-closed',
  );
  delete process.env.QBOT_CASEBOOK_TEST_MUTATE_TREE_AFTER_FSYNC;
  assert.equal(mutatedTreeError?.transaction_state, 'rollback_incomplete');
  assert.equal(fs.existsSync(mutatedTreeOutput), false, '整树漂移后不得保留最终输出名');
  assert.equal(mutatedTreeError?.rollback?.final?.status, 'retained');
  assert.match(
    fs.readFileSync(path.join(mutatedTreeError.rollback.final.preserved_path, 'artifact.txt'), 'utf8'),
    /^audited-tree-bytesthird-party-tree-mutation$/,
  );

  const directoryQuarantineRaceOutput = path.join(casebookOutputGuardRoot, 'directory-quarantine-race');
  const directoryQuarantineRaceTransaction = await prepareCasebookOutputDirectory(directoryQuarantineRaceOutput);
  fs.writeFileSync(path.join(directoryQuarantineRaceTransaction.staging, 'artifact.txt'), 'transaction-directory');
  process.env.QBOT_CASEBOOK_FAULT_AFTER_OUTPUT_RENAME = '1';
  process.env.QBOT_CASEBOOK_TEST_REPLACE_DIRECTORY_QUARANTINE_AFTER_VERIFY = '1';
  let directoryQuarantineRaceError;
  await assert.rejects(
    commitCasebookOutputDirectory(directoryQuarantineRaceTransaction),
    (error) => {
      directoryQuarantineRaceError = error;
      return /fault_injected_after_casebook_output_rename/.test(error?.message || String(error));
    },
  );
  delete process.env.QBOT_CASEBOOK_FAULT_AFTER_OUTPUT_RENAME;
  delete process.env.QBOT_CASEBOOK_TEST_REPLACE_DIRECTORY_QUARANTINE_AFTER_VERIFY;
  assert.equal(directoryQuarantineRaceError?.transaction_state, 'rollback_conflict');
  assert.equal(directoryQuarantineRaceError?.rollback?.final?.status, 'rollback_conflict');
  assert.equal(
    fs.readFileSync(path.join(directoryQuarantineRaceError.rollback.final.preserved_path, 'third-party.txt'), 'utf8'),
    'third-party-directory-quarantine',
    '目录 quarantine 最终复核后的第三方替换者不得被删除',
  );
  assert.equal(fs.existsSync(directoryQuarantineRaceError.rollback.final.transaction_preserved_path), true, '本事务目录也必须保留');

  const thirdPartyOutput = path.join(casebookOutputGuardRoot, 'third-party-output-conflict');
  const thirdPartyOutputTransaction = await prepareCasebookOutputDirectory(thirdPartyOutput);
  const thirdPartyOutputStaging = thirdPartyOutputTransaction.staging;
  fs.writeFileSync(path.join(thirdPartyOutputStaging, 'artifact.txt'), 'transaction-owned-output');
  process.env.QBOT_CASEBOOK_TEST_REPLACE_OUTPUT_AFTER_RENAME = '1';
  let thirdPartyOutputError;
  await assert.rejects(
    commitCasebookOutputDirectory(thirdPartyOutputTransaction),
    (error) => {
      thirdPartyOutputError = error;
      return /fault_injected_output_replaced_after_rename/.test(error?.message || String(error));
    },
    'rename 后最终目录被第三方替换时必须拒绝提交',
  );
  delete process.env.QBOT_CASEBOOK_TEST_REPLACE_OUTPUT_AFTER_RENAME;
  assert.equal(thirdPartyOutputTransaction.state, 'rollback_conflict', '第三方输出目录替换必须报告 rollback_conflict');
  assert.equal(thirdPartyOutputTransaction.committed, false, '第三方输出目录替换不得标记 committed');
  assert.equal(thirdPartyOutputError?.transaction_state, 'rollback_conflict', '第三方输出目录替换错误必须暴露冲突状态');
  assert.equal(fs.readFileSync(path.join(thirdPartyOutput, 'third-party.txt'), 'utf8'), 'third-party-output', '回滚不得删除第三方输出目录');
  assert.equal(fs.existsSync(thirdPartyOutputStaging), false, '第三方替换冲突时本事务原 staging 必须清理');
  fs.rmSync(thirdPartyOutput, { recursive: true, force: false });

  const replacedOutput = path.join(casebookOutputGuardRoot, 'replaced-output');
  const replacedTransaction = await prepareCasebookOutputDirectory(replacedOutput);
  const displacedStaging = `${replacedTransaction.staging}-displaced`;
  fs.renameSync(replacedTransaction.staging, displacedStaging);
  fs.mkdirSync(replacedTransaction.staging, { mode: 0o700 });
  await assert.rejects(
    commitCasebookOutputDirectory(replacedTransaction),
    /发生替换或权限漂移/,
    'staging 目录 inode 被替换时必须 fail-closed',
  );

  const successfulPublishRoot = path.join(casebookOutputGuardRoot, 'successful-publish');
  fs.mkdirSync(successfulPublishRoot, { mode: 0o700 });
  const publishArtifact = path.join(successfulPublishRoot, 'publish-artifact.xlsx');
  const publishedFormal = path.join(successfulPublishRoot, 'published-formal.xlsx');
  fs.writeFileSync(publishArtifact, 'validated-casebook-bytes');
  const publication = await publishValidatedCasebookArtifact({
    artifactFile: publishArtifact,
    formalOutput: publishedFormal,
  });
  assert.equal(publication.path, publishedFormal);
  assert.equal(publication.state, 'committed', '正式发布成功路径必须进入 committed 状态');
  assert.equal(publication.committed, true, '正式发布成功路径必须显式标记 committed=true');
  assert.equal(fs.readFileSync(publishedFormal, 'utf8'), 'validated-casebook-bytes');
  assert.equal(fs.statSync(publishedFormal).mode & 0o777, 0o600, '正式 Casebook 权限必须为0600');
  assert.equal(
    fs.readdirSync(successfulPublishRoot).some((entry) => entry.startsWith(`.${path.basename(publishedFormal)}.staging-`)
      || entry.includes('rollback-quarantine')),
    false,
    '正式发布成功后不得遗留 staging 或 quarantine',
  );
  await assert.rejects(
    publishValidatedCasebookArtifact({ artifactFile: publishArtifact, formalOutput: publishedFormal }),
    /禁止覆盖已存在的正式 Casebook/,
    '正式 Casebook 原子发布不得覆盖已有目标',
  );

  const faultFormal = path.join(casebookOutputGuardRoot, 'fault-formal.xlsx');
  process.env.QBOT_CASEBOOK_FAULT_BEFORE_FORMAL_PUBLISH = '1';
  let beforeFormalPublishError;
  await assert.rejects(
    publishValidatedCasebookArtifact({ artifactFile: publishArtifact, formalOutput: faultFormal }),
    (error) => {
      beforeFormalPublishError = error;
      return /fault_injected_before_formal_casebook_publish/.test(error?.message || String(error));
    },
  );
  assert.equal(fs.existsSync(faultFormal), false, '正式发布故障注入不得留下目标文件');
  assert.equal(beforeFormalPublishError?.publication_state, 'rollback_incomplete', '正式发布前故障必须报告安全隔离保留');
  assert.equal(fs.existsSync(beforeFormalPublishError?.temporary_path || ''), false, '正式发布前故障不得遗留 staging 临时名');
  assert.equal(beforeFormalPublishError?.rollback?.temporary?.status, 'retained');
  assert.equal(fs.existsSync(beforeFormalPublishError.rollback.temporary.preserved_path), true, '隔离后的临时 artifact 必须保留并报告');
  delete process.env.QBOT_CASEBOOK_FAULT_BEFORE_FORMAL_PUBLISH;

  const formalPublicationFaults = [
    ['QBOT_CASEBOOK_FAULT_AFTER_FORMAL_RENAME', /fault_injected_after_formal_rename/],
    ['QBOT_CASEBOOK_FAULT_AFTER_FORMAL_PARENT_FSYNC', /fault_injected_after_formal_parent_fsync/],
    ['QBOT_CASEBOOK_FAULT_AFTER_FORMAL_FINAL_VERIFY', /fault_injected_after_formal_final_verify/],
  ];
  for (const [environmentKey, expectedError] of formalPublicationFaults) {
    const suffix = environmentKey.toLowerCase().replaceAll('_', '-');
    const postLinkFormal = path.join(casebookOutputGuardRoot, `${suffix}.xlsx`);
    process.env[environmentKey] = '1';
    let observedError;
    await assert.rejects(
      publishValidatedCasebookArtifact({ artifactFile: publishArtifact, formalOutput: postLinkFormal }),
      (error) => {
        observedError = error;
        return expectedError.test(error?.message || String(error));
      },
      `${environmentKey} 必须触发可识别的正式发布故障`,
    );
    delete process.env[environmentKey];
    assert.equal(observedError?.publication_state, 'rollback_incomplete', `${environmentKey} 必须报告隔离保留`);
    assert.equal(fs.existsSync(postLinkFormal), false, `${environmentKey} 后正式目标必须不存在`);
    assert.equal(fs.existsSync(observedError?.temporary_path || ''), false, `${environmentKey} 后临时名必须不存在`);
    assert.equal(observedError?.rollback?.formal?.status, 'retained');
    assert.equal(fs.existsSync(observedError.rollback.formal.preserved_path), true, `${environmentKey} 本事务正式 artifact 必须隔离保留`);
  }

  const thirdPartyFormal = path.join(casebookOutputGuardRoot, 'third-party-formal-conflict.xlsx');
  process.env.QBOT_CASEBOOK_TEST_REPLACE_FORMAL_BEFORE_ROLLBACK = '1';
  let thirdPartyFormalError;
  await assert.rejects(
    publishValidatedCasebookArtifact({ artifactFile: publishArtifact, formalOutput: thirdPartyFormal }),
    (error) => {
      thirdPartyFormalError = error;
      return /fault_injected_formal_replaced_before_rollback/.test(error?.message || String(error));
    },
    '正式目标被第三方替换时必须拒绝提交',
  );
  delete process.env.QBOT_CASEBOOK_TEST_REPLACE_FORMAL_BEFORE_ROLLBACK;
  assert.equal(thirdPartyFormalError?.publication_state, 'rollback_conflict', '第三方正式目标替换必须报告 rollback_conflict');
  assert.equal(thirdPartyFormalError?.rollback?.formal?.status, 'rollback_conflict', '正式目标回滚必须保留身份冲突');
  assert.equal(fs.readFileSync(thirdPartyFormal, 'utf8'), 'third-party-formal', '回滚不得删除第三方正式目标');
  assert.equal(fs.existsSync(thirdPartyFormalError?.temporary_path || ''), false, '正式目标冲突时本事务临时文件必须清理');
  fs.unlinkSync(thirdPartyFormal);

  const auditedArtifact = path.join(casebookOutputGuardRoot, 'audited-artifact.xlsx');
  const auditedArtifactBytes = Buffer.from('runtime-audited-artifact');
  fs.writeFileSync(auditedArtifact, auditedArtifactBytes);
  const auditedArtifactSha256 = createHash('sha256').update(auditedArtifactBytes).digest('hex');
  const driftedArtifactFormal = path.join(casebookOutputGuardRoot, 'drifted-artifact-formal.xlsx');
  process.env.QBOT_CASEBOOK_TEST_REPLACE_ARTIFACT_BEFORE_FORMAL_PUBLISH = '1';
  let driftedArtifactError;
  await assert.rejects(
    publishValidatedCasebookArtifact({
      artifactFile: auditedArtifact,
      formalOutput: driftedArtifactFormal,
      expectedArtifactSha256: auditedArtifactSha256,
      expectedArtifactSize: auditedArtifactBytes.length,
    }),
    (error) => {
      driftedArtifactError = error;
      return /正式发布前 Casebook artifact 与 runtime audit 快照不一致/.test(error?.message || String(error));
    },
    'runtime audit 后替换 artifact 必须在正式发布前 fail-closed',
  );
  delete process.env.QBOT_CASEBOOK_TEST_REPLACE_ARTIFACT_BEFORE_FORMAL_PUBLISH;
  assert.equal(fs.existsSync(driftedArtifactFormal), false, '未审核的替换 artifact 不得发布');
  assert.equal(fs.readFileSync(auditedArtifact, 'utf8'), 'third-party-artifact');
  assert.deepEqual(fs.readFileSync(`${auditedArtifact}.audited-artifact`), auditedArtifactBytes, '已审核字节必须保留');
  assert.equal(driftedArtifactError?.rollback?.temporary?.status, 'retained', '发布前漂移时 staging 只能隔离保留');

  const fileQuarantineRaceFormal = path.join(casebookOutputGuardRoot, 'file-quarantine-race.xlsx');
  process.env.QBOT_CASEBOOK_FAULT_AFTER_FORMAL_RENAME = '1';
  process.env.QBOT_CASEBOOK_TEST_REPLACE_FILE_QUARANTINE_AFTER_VERIFY = '1';
  let fileQuarantineRaceError;
  await assert.rejects(
    publishValidatedCasebookArtifact({ artifactFile: publishArtifact, formalOutput: fileQuarantineRaceFormal }),
    (error) => {
      fileQuarantineRaceError = error;
      return /fault_injected_after_formal_rename/.test(error?.message || String(error));
    },
  );
  delete process.env.QBOT_CASEBOOK_FAULT_AFTER_FORMAL_RENAME;
  delete process.env.QBOT_CASEBOOK_TEST_REPLACE_FILE_QUARANTINE_AFTER_VERIFY;
  assert.equal(fileQuarantineRaceError?.publication_state, 'rollback_conflict');
  assert.equal(fileQuarantineRaceError?.rollback?.formal?.status, 'rollback_conflict');
  assert.equal(fs.existsSync(fileQuarantineRaceFormal), false, '故障后正式目标名必须撤销');
  assert.equal(
    fs.readFileSync(fileQuarantineRaceError.rollback.formal.preserved_path, 'utf8'),
    'third-party-file-quarantine',
    '文件 quarantine 最终复核后的第三方替换者不得被删除',
  );
  assert.equal(
    fs.readFileSync(fileQuarantineRaceError.rollback.formal.transaction_preserved_path, 'utf8'),
    'validated-casebook-bytes',
    '本事务正式 artifact 也必须保留',
  );

  const linkedArtifact = path.join(casebookOutputGuardRoot, 'linked-artifact.xlsx');
  fs.linkSync(publishArtifact, linkedArtifact);
  await assert.rejects(
    publishValidatedCasebookArtifact({
      artifactFile: publishArtifact,
      formalOutput: path.join(casebookOutputGuardRoot, 'hardlink-formal.xlsx'),
    }),
    /当前用户独占/,
    '被硬链接复用的 artifact 不得发布为正式 Casebook',
  );

  const freshArtifact = path.join(casebookOutputGuardRoot, 'fresh-artifact.xlsx');
  const symlinkArtifact = path.join(casebookOutputGuardRoot, 'symlink-artifact.xlsx');
  fs.writeFileSync(freshArtifact, 'fresh');
  fs.symlinkSync(freshArtifact, symlinkArtifact);
  await assert.rejects(
    publishValidatedCasebookArtifact({
      artifactFile: symlinkArtifact,
      formalOutput: path.join(casebookOutputGuardRoot, 'symlink-artifact-formal.xlsx'),
    }),
    /路径祖先不得是符号链接/,
    '符号链接 artifact 不得发布为正式 Casebook',
  );

  const unsafeFormalParent = path.join(casebookOutputGuardRoot, 'unsafe-formal-parent');
  fs.mkdirSync(unsafeFormalParent, { mode: 0o700 });
  fs.chmodSync(unsafeFormalParent, 0o777);
  await assert.rejects(
    publishValidatedCasebookArtifact({
      artifactFile: freshArtifact,
      formalOutput: path.join(unsafeFormalParent, 'formal.xlsx'),
    }),
    /禁止 group\/other 写入/,
    'group/other 可写正式输出父目录必须 fail-closed',
  );
  fs.chmodSync(unsafeFormalParent, 0o700);

  const symlinkFormalTarget = path.join(casebookOutputGuardRoot, 'symlink-formal-target.xlsx');
  fs.symlinkSync(freshArtifact, symlinkFormalTarget);
  await assert.rejects(
    publishValidatedCasebookArtifact({
      artifactFile: freshArtifact,
      formalOutput: symlinkFormalTarget,
    }),
    /禁止覆盖已存在的正式 Casebook/,
    '正式目标为符号链接时必须拒绝且不得跟随覆盖',
  );
} finally {
  if (previousNodeEnv == null) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = previousNodeEnv;
  for (const [key, value] of previousCasebookTransactionEnvironment) {
    if (value == null) delete process.env[key];
    else process.env[key] = value;
  }
  fs.rmSync(casebookOutputGuardRoot, { recursive: true, force: true });
}

const r15Init003BaseEvidenceRoles = [
  'before_screenshot',
  'action_receipt',
  'after_screenshot',
  'public_state_readback',
  'cleanup_readback',
].join(',');
const r15Init003Case = normalizeCasebookContractCase(patchR13RecentCase({
  '用例ID': 'BETA-INIT-003',
  '用例类型': 'run_initialization',
  '契约版本': 'qbot-core-beta/v2',
  '自动化协议': 'core-beta-action-plan/v2',
  '证据Schema版本': 'qbot-core-evidence/v2',
  '流水线策略': 'serial',
  '批次大小': 1,
  '初始化策略': 'run_full_reset_then_case_clean',
  '清理策略': 'clear task capability selection',
  '风险域': 'functional,reliability',
  '判定Oracle': 'public_state_machine',
  '确定性': '是',
  '重复策略': '每候选执行1次',
  '必需Fixture': 'runtime:ready,account:authenticated',
  '硬门禁': '是',
  '版本范围': 'release/0.1',
  '生产观测指标': 'skill reinstall readiness',
  '证据角色': r15Init003BaseEvidenceRoles,
  '证据要求': r15Init003BaseEvidenceRoles,
  '精准断言JSON': JSON.stringify({
    pass_rule: '全部硬断言通过。',
    fail_rule: '产品 Oracle 失败。',
    block_rule: '仅真实前置不可用时阻塞。',
    hard_oracles: ['初始化完成。'],
    machine_assertions: [{ path: 'evidence.complete', operator: 'equals', expected: true }],
  }),
}));
assert.deepEqual(
  r15Init003Case.evidence_roles,
  [
    ...r15Init003BaseEvidenceRoles.split(','),
    'product_action_trace',
    'skill_reinstall_readiness_verdict',
    'initialization_continuation_surface',
  ],
  'r15 BETA-INIT-003 证据角色必须精确且不得混入文件名或叙述文本',
);
assert.equal(
  validateCoreBetaCase(r15Init003Case).ok,
  true,
  validateCoreBetaCase(r15Init003Case).errors.join('\n'),
);
for (const role of [
  'skill_reinstall_readiness_verdict',
  'initialization_continuation_surface',
]) {
  const missingRole = structuredClone(r15Init003Case);
  missingRole.evidence_roles = missingRole.evidence_roles.filter((item) => item !== role);
  assert.match(
    validateCoreBetaCase(missingRole).errors.join('\n'),
    new RegExp(`evidence_roles 缺少 ${role}`),
    `r15 BETA-INIT-003 缺少 ${role} 时必须 fail-closed`,
  );
}
const mutateR15Init003ContractText = (mutate) => {
  const candidate = structuredClone(r15Init003Case);
  for (const field of ['scenario', 'steps', 'expected_result', 'success_criteria']) {
    candidate[field] = mutate(String(candidate[field] || ''));
  }
  candidate.precise_assertions.hard_oracles = candidate.precise_assertions.hard_oracles
    .map((oracle) => mutate(String(oracle || '')));
  return candidate;
};
for (const [signal, mutate, expectedError] of [
  ['非空 draftInstanceId', (text) => text.replace(/draftInstanceId/gu, 'draft handle'), '正式合同缺少非空 draftInstanceId'],
  ['taskId=null', (text) => text.replace(/taskId\s*=\s*null/gu, 'taskId=unknown'), '正式合同缺少taskId=null'],
  ['messageCount=0', (text) => text.replace(/messageCount\s*=\s*0/gu, 'messageCount=unknown'), '正式合同缺少messageCount=0'],
  ['sendCount=0', (text) => text.replace(/sendCount\s*=\s*0/gu, 'sendCount=unknown'), '正式合同缺少sendCount=0'],
  ['running=false', (text) => text.replace(/running\s*=\s*false/gu, 'running=unknown'), '正式合同缺少running=false'],
  ['Skill/Connector/Expert 全空', (text) => text.replace(/Skill\s*\/\s*Connector\s*\/\s*Expert/gu, '三类能力'), '正式合同缺少Skill/Connector/Expert 全空'],
  ['PNG 普通文件', (text) => text.replace(/普通文件/gu, '截图文件'), '正式合同缺少前后 PNG Case 内普通文件及 bytes/SHA 可重放'],
  ['PNG 路径', (text) => text.replace(/路径/gu, '位置'), '正式合同缺少前后 PNG Case 内普通文件及 bytes/SHA 可重放'],
  ['PNG bytes', (text) => text.replace(/bytes/giu, 'byte-count'), '正式合同缺少前后 PNG Case 内普通文件及 bytes/SHA 可重放'],
  ['PNG SHA-256', (text) => text.replace(/SHA-?256/giu, 'digest'), '正式合同缺少前后 PNG Case 内普通文件及 bytes/SHA 可重放'],
  ['PNG 可重放', (text) => text.replace(/可重放|重放/gu, '可复核'), '正式合同缺少前后 PNG Case 内普通文件及 bytes/SHA 可重放'],
]) {
  const invalidContract = mutateR15Init003ContractText(mutate);
  assert.match(
    validateCoreBetaCase(invalidContract).errors.join('\n'),
    new RegExp(expectedError.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
    `r15 BETA-INIT-003 缺少 ${signal} 时必须 fail-closed`,
  );
}

const r13GateIdsFixture = Array.from({ length: 70 }, (_, index) => `G3-${index + 1}`);
const r13RegressionIdsFixture = [
  'BETA-TASK-002',
  ...Array.from({ length: 89 }, (_, index) => `G4-ADDON-${index + 1}`),
];
const r13FullIdsFixture = [...r13GateIdsFixture, ...r13RegressionIdsFixture];
const r13Mr1557Cases = 'BETA-TASK-002,MRSMOKE-FAIL-001,BETA-CHAT-005,BETA-CHAT-007,BETA-HOST-003';
const r13MrRowsFixture = [[null, '!1557', null, null, null, null, r13Mr1557Cases, '12条冒烟+70条门禁+160条增量']];
assert.equal(assertR13CasebookLayering({
  gateIds: r13GateIdsFixture,
  fullIds: r13FullIdsFixture,
  regressionAddonIds: r13RegressionIdsFixture,
  mrRows: r13MrRowsFixture,
}), true, '真实生成层级必须为G3排除BETA-TASK-002、G4原生替换且MR !1557精确覆盖三层');
assert.throws(() => assertR13CasebookLayering({
  gateIds: [...r13GateIdsFixture.slice(0, -1), 'BETA-TASK-002'],
  fullIds: r13FullIdsFixture,
  regressionAddonIds: r13RegressionIdsFixture,
  mrRows: r13MrRowsFixture,
}), /G4 的 G3 前缀漂移|G3 不得包含 BETA-TASK-002/, 'BETA-TASK-002误入G3必须fail-closed');
assert.throws(() => assertR13CasebookLayering({
  gateIds: r13GateIdsFixture,
  fullIds: [...r13GateIdsFixture, 'SIT-TASK-REGEN-001', ...r13RegressionIdsFixture.slice(1)],
  regressionAddonIds: ['SIT-TASK-REGEN-001', ...r13RegressionIdsFixture.slice(1)],
  mrRows: r13MrRowsFixture,
}), /G4 增量必须以 BETA-TASK-002 替换 SIT-TASK-REGEN-001/, 'G4保留旧SIT-TASK-REGEN-001或缺少BETA-TASK-002必须fail-closed');
assert.throws(() => assertR13CasebookLayering({
  gateIds: r13GateIdsFixture,
  fullIds: r13FullIdsFixture,
  regressionAddonIds: r13RegressionIdsFixture,
  mrRows: [[null, '!1557', null, null, null, null, r13Mr1557Cases, '12条冒烟+70条门禁']],
}), /MR !1557 层级必须精确为/, 'MR !1557缺少160条增量层必须fail-closed');
assert.match(
  productionGrayCasebookBuilder,
  /if \(id === 'BETA-TASK-002'\)[\s\S]*withEvidenceRole\(next, 'task_regenerate_transition'\)[\s\S]*用户消息序列逐项不变[\s\S]*正文为空且running=true[\s\S]*动作计划JSON[\s\S]*actionPlan\(id, 'task_lifecycle'[\s\S]*最终新assistant第二版[\s\S]*非空正文[\s\S]*重开同一task后用户消息序列/,
  'Casebook生成器必须为BETA-TASK-002冻结重新生成即时空running占位、最终非空第二版和重开保持合同',
);
assert.match(
  coreBetaProtocolSource,
  /registerScenario\('BETA-TASK-002', 'task_regenerate_transition',[\s\S]*fixture_control: 'public_product_state'/,
  'BETA-TASK-002 必须声明为真实 public_product_state 原生能力',
);
assert.match(
  runner,
  /(?=[\s\S]*CORE_BETA_NATIVE_SCENARIO_DRIVERS = new Set\(\[[\s\S]*'task_regenerate_transition')(?=[\s\S]*driver === 'task_regenerate_transition' && caseType === 'task_lifecycle')(?=[\s\S]*route === 'task_lifecycle' && scenario\.driver === 'task_regenerate_transition'[\s\S]*executeSitTaskRegenerate\(context\))/,
  'BETA-TASK-002 必须具有可分发的原生 runtime binding 与真实重新生成执行路径',
);
assert.match(
  productionGrayCasebookBuilder,
  /FULL_ONLY_NATIVE_CASE_REPLACEMENTS = new Map\(\[[\s\S]*\['SIT-TASK-REGEN-001', 'BETA-TASK-002'\][\s\S]*\]\)[\s\S]*gateCoreCases = orderCases[\s\S]*FULL_ONLY_NATIVE_CASE_REPLACEMENTS\.values\(\)[\s\S]*fullFunctionPool[\s\S]*FULL_ONLY_NATIVE_CASE_REPLACEMENTS\.get[\s\S]*patchRecentCases\(replacement\)/,
  'G3 必须排除 G4-only 的 BETA-TASK-002，G4 必须用该原生Case替换旧 SIT-TASK-REGEN-001',
);
assert.match(
  productionGrayCasebookBuilder,
  /gateCases\.length !== 70[\s\S]*regressionAddons\.length !== 90[\s\S]*fullCases\.length !== 160[\s\S]*gateIds\.includes\(nativeId\)[\s\S]*!fullIds\.includes\(nativeId\)[\s\S]*fullIds\.includes\(legacyId\)[\s\S]*regressionAddons\.some/,
  '生成时必须保持70/90/160数量并拒绝BETA-TASK-002误入G3或旧legacy仍留在G4',
);
assert.match(
  productionGrayCasebookBuilder,
  /smokeCases\.length !== 12[\s\S]*coreLifelineCases\.length !== 16[\s\S]*gateCases\.length !== 70[\s\S]*fullCases\.length !== 160/,
  'Casebook分层总数必须保持16/12/70/160不变',
);
assert.match(
  productionGrayCasebookBuilder,
  /execution_authorized=false[\s\S]*execution_authorized: false/,
  'Casebook设计intake只能表达设计接受状态，必须固定禁止授权真实执行',
);
assert.match(
  productionGrayCasebookBuilder,
  /if \(id === 'BETA-EXPERT-012'\)[\s\S]*withEvidenceRole\(next, 'expert_maintenance_task_trace'\)[\s\S]*通过对话修改[\s\S]*快捷任务[\s\S]*get_expert_draft[\s\S]*update_expert_draft[\s\S]*恰好新增一个 version 与一个 release[\s\S]*原维护会话重开保持[\s\S]*新任务不继承/,
  'Casebook生成器必须冻结BETA-EXPERT-012真实已发布Expert维护任务、唯一工具更新、可见发布和任务隔离闭环',
);
assert.match(
  productionGrayCasebookBuilder,
  /coreBetaScenarioSpec[\s\S]*function normalizeCasebookContractCase\(testCase = \{\}\)[\s\S]*scenario:[\s\S]*steps:[\s\S]*expected_result:[\s\S]*success_criteria:[\s\S]*oracle_type:[\s\S]*evidence_roles:[\s\S]*precise_assertions:[\s\S]*function capability\(testCase\)[\s\S]*coreBetaScenarioSpec\(contractCase\)[\s\S]*coreBetaRuntimeExecutorBinding\(contractCase, scenario\)/,
  'Casebook生成器能力适配必须把完整中文Case合同传给协议与运行时绑定',
);
assert.match(
  productionGrayCasebookBuilder,
  /const gateCoreCases = orderCases\(allCases\s*\.map\(patchRecentCases\)\s*\.filter\(\(testCase\) => capability\(testCase\)\.directlyRunnable\)[\s\S]*FULL_ONLY_NATIVE_CASE_REPLACEMENTS\.values/,
  'G3能力筛选必须先应用r13 Case补丁，再判定完整运行时合同，并保持G4-only Case排除',
);
assert.match(
  productionGrayCasebookBuilder,
  /gateCoreCases\.length !== 65[\s\S]*gatePromotions\.length !== 5[\s\S]*regressionAddons\.length !== 90/,
  '生成器不得把原生门禁放宽为64，必须保持65+5+90的70/160分层',
);
const casebookDesignExpert012PatchStart = productionGrayCasebookBuilder.indexOf("  if (id === 'BETA-EXPERT-012') {");
const casebookDesignExpert012PatchEnd = productionGrayCasebookBuilder.indexOf("\n  if (id === 'BETA-ART-001')", casebookDesignExpert012PatchStart);
assert.ok(casebookDesignExpert012PatchStart >= 0 && casebookDesignExpert012PatchEnd > casebookDesignExpert012PatchStart);
const casebookDesignExpert012PatchSource = productionGrayCasebookBuilder.slice(
  casebookDesignExpert012PatchStart,
  casebookDesignExpert012PatchEnd,
);
assert.match(casebookDesignExpert012PatchSource, /next\['精准断言JSON'\] = json\(assertions\(\[/);
assert.doesNotMatch(casebookDesignExpert012PatchSource, /appendHardOracles|immutable_readback|v1完全不变|旧会话仍用v1/);
assert.match(
  productionGrayCasebookBuilder,
  /const actualSheetNames = \[\][\s\S]*getItemAt\(index\)[\s\S]*JSON\.stringify\(actualSheetNames\) !== JSON\.stringify\(sheetNames\)/,
  '导出后验证必须枚举并精确比对14个Sheet的顺序',
);
assert.ok(
  productionGrayCasebookBuilder.includes("searchTerm: '#REF!|#DIV/0!|#VALUE!|#NAME\\\\?|#N/A|#NUM!|#NULL!|#SPILL!|#CALC!'"),
  '导出后公式错误扫描必须覆盖完整错误集合',
);
assert.match(
  productionGrayCasebookBuilder,
  /formulaErrors\.ndjson[\s\S]*\{"kind":"match"[\s\S]*导出后 Casebook 存在公式错误/,
  '公式错误扫描出现真实match时必须fail-closed',
);
assert.match(
  productionGrayCasebookBuilder,
  /gateValues\.findIndex\(\(row\) =>[\s\S]*BETA-EXPERT-012[\s\S]*expertCaseRow = expertCaseIndex \+ 1[\s\S]*15-BETA-EXPERT-012-focused\.png/,
  'BETA-EXPERT-012聚焦渲染必须动态定位实际行并作为第15张图片输出',
);
assert.match(
  productionGrayCasebookBuilder,
  /await xlsx\.save\(outputFile\)[\s\S]*const auditedArtifact = stableRegularFileSnapshot\(outputFile[\s\S]*SpreadsheetFile\.importXlsx\(new FileBlob\([\s\S]*auditedArtifact\.bytes[\s\S]*verifyWorkbook\(exportedWorkbook[\s\S]*publishCasebookAfterRuntimeAudit/,
  'Casebook必须先保存，以同一审核字节快照重新导入并通过验证，最后才以排他 rename 写入正式路径',
);
assert.match(productionGrayCasebookBuilder, /\['1329',[\s\S]*expectedFiles: \['\.gitlab-ci\.yml'\][\s\S]*CI-only[\s\S]*sha256:3410bb/, 'Casebook生成器必须把MR !1329绑定到显式CI-only静态合同审计');
assert.match(productionGrayCasebookBuilder, /RECENT_MR_APPEND\.at\(-1\)\?\.commit !== PRODUCT_COMMIT/, 'Casebook生成器必须强制冻结增量MR终点等于最新产品设计基线');
assert.match(productionGrayCasebookBuilder, /EXPECTED_PREVIOUS_MR_COUNT = 134[\s\S]*R13_INCREMENTAL_MR_ORDER = Object\.freeze\(\[[\s\S]*EXPECTED_INCREMENTAL_MR_COUNT = R13_INCREMENTAL_MR_ORDER\.length[\s\S]*EXPECTED_TOTAL_MR_COUNT = EXPECTED_PREVIOUS_MR_COUNT \+ EXPECTED_INCREMENTAL_MR_COUNT/, 'Casebook生成器必须继承r12的134个MR并从冻结增量顺序动态推导r13审计规模');
assert.match(productionGrayCasebookBuilder, /R13_INCREMENTAL_MR_ORDER = Object\.freeze\(\[[\s\S]*'1556', '1549', '1557', '1559', '1561', '1560',[\s\S]*'1564', '1563', '1566', '1568', '1569', '1570', '1572', '1573'[\s\S]*\]\);/, 'Casebook生成器必须按intake first-parent顺序冻结37个增量MR并以!1573收尾');
assert.match(productionGrayCasebookBuilder, /\['1523', \['MRSMOKE-WEB-001', 'MRSMOKE-WEB-002', 'BETA-CHAT-005', 'SIT-CONN-019'\]\]/, 'Casebook生成器必须精确映射MR !1523且禁止启发式泛化');
assert.match(productionGrayCasebookBuilder, /\['1522', \['MRSMOKE-ROUTE-001', 'BETA-CHAT-001', 'BETA-ROUTE-001', 'BETA-HOST-003'\]\]/, 'Casebook生成器必须精确映射MR !1522且禁止启发式泛化');
assert.match(coreBetaProtocolSource, /MRSMOKE-WEB-001', 'qwork_mr_web_search_success'[\s\S]*web_search_quota_trace/, '协议必须注册四轮Web搜索专项证据角色');
assert.match(coreBetaProtocolSource, /validateWebSearchQuotaTracePayload[\s\S]*expectedCaseDir[\s\S]*realpathSync[\s\S]*lstatSync[\s\S]*isSymbolicLink[\s\S]*Number\.isSafeInteger[\s\S]*sha256File/, '协议必须以权威Case目录实读quota截图类型、字节与SHA');
assert.match(coreBetaProtocolSource, /import \{ webSearchQuotaTraceVerdict \} from '\.\/qbot-web-runtime-evidence\.mjs';[\s\S]*function validateWebSearchQuotaTracePayload[\s\S]*const rebuilt = webSearchQuotaTraceVerdict\(/, '协议必须把quota业务语义复算委托给Web运行时证据模块');
assert.match(coreBetaProtocolSource, /if \(\[[^\]]*'web_search_quota_trace'[^\]]*\]\.includes\(role\)\)[\s\S]*path\.extname\(file\)\.toLowerCase\(\) !== '\.json'[\s\S]*error: `\$\{role\}_json_required`[\s\S]*if \(role === 'web_search_quota_trace'\)[\s\S]*validateWebSearchQuotaTracePayload/, 'quota trace角色必须先进入共享JSON-only守卫再进入专用校验，不得通过非JSON扩展名绕过');
for (const runnerSource of [runner, legacyRunner]) {
  assert.match(runnerSource, /const declaredPrompts = \(Array\.isArray\(testCase\.conversation_turns\)[\s\S]*const prompts = (?:caseId|evidenceCaseId) === 'MRSMOKE-WEB-001'\s*\? declaredPrompts[\s\S]*(?:caseId|evidenceCaseId) === 'MRSMOKE-WEB-001' && prompts\.length !== 4[\s\S]*if \(prompts\.length === 4\)[\s\S]*web_search_quota_trace/, '两套runner仅为MRSMOKE-WEB-001从冻结Casebook读取精确四轮Web搜索prompt');
  assert.match(runnerSource, /if \(id === 'SIT-CONN-019'\) return executeSitConnectorWebSearchQuality/, 'SIT-CONN-019必须保持单轮Web质量入口');
}
assert.match(productionGrayCasebookBuilder, /mrRows\.length !== EXPECTED_TOTAL_MR_COUNT/, 'Casebook生成器必须按动态总量拒绝MR审计缺失或溢出');
assert.match(
  productionGrayCasebookBuilder,
  /for \(const iid of \['1459', '1462', '1463', '1464', '1468', '1469', '1454', '1458', '1473', '1461', '1475', '1460', '1477', '1474', '1496', '1498', '1485', '1506', '1497', '1514', '1524'\]\)[\s\S]*静态合同审计且不冒充桌面E2E/,
  'Casebook生成器必须逐项锁定 r9 的21个静态合同审计MR且禁止冒充桌面E2E',
);
assert.match(productionGrayCasebookBuilder, /function sameFileSet\(expectedFiles, actualFiles\)[\s\S]*!sameFileSet\(staticAudit\.expectedFiles, mr\.files\)/, 'Casebook生成器必须按文件集合校验静态MR清单，不能因Git返回顺序漂移误报');
assert.match(productionGrayCasebookBuilder, /async function previousCasebookMrRows\(\)[\s\S]*近2天MR覆盖[\s\S]*EXPECTED_PREVIOUS_MR_COUNT[\s\S]*const previousMrRows = await previousCasebookMrRows\(\)[\s\S]*incrementalMrRows\]\.reverse\(\)\.concat\(previousMrRows\)/, 'Casebook生成器必须复用r12的134条冻结覆盖行并按API增量顺序追加37条，合计171条');
assert.match(
  productionGrayCasebookBuilder,
  /\['1573', \{[\s\S]*?caseIds: \['SIT-MEM-001', 'BETA-CHAT-001', 'BETA-CHAT-002', 'BETA-CHAT-009', 'BETA-SEC-002', 'BETA-MCP-001', 'BETA-MCP-002', 'BETA-HOST-003', 'BETA-INIT-001', 'BETA-ROUTE-001', 'MRSMOKE-ROUTE-001'\][\s\S]*?coverageStrength: '相邻回归\+源码合同'[\s\S]*?requiredSourceContractIds: \['deepbankv2-mr-1573-memory-session-profile-stability\/v1'\][\s\S]*?claim_scope=source_and_test_declarations[\s\S]*?test_execution_attested=false[\s\S]*?禁止把相邻主链通过冒充这些内部合同已执行或通过/,
  'Casebook生成器必须将 MR !1573 绑定 Memory/Profile 相邻链并明确非执行态源码合同边界',
);
assert.match(
  productionGrayCasebookBuilder,
  /const mr1573 =[\s\S]*mr1573\[7\] !== '12条冒烟\+70条门禁\+160条增量'[\s\S]*MR !1573必须区分Memory\/Profile桌面相邻链与非执行态源码合同/,
  'MR !1573 必须精确覆盖 G2/G3/G4，并由专用断言拒绝映射或声明漂移',
);
assert.match(productionGrayCasebookBuilder, /\['1556', \{[\s\S]*caseIds: \['BETA-CHAT-002', 'BETA-CHAT-007', 'BETA-TASK-008', 'BETA-HOST-003'\][\s\S]*用户消息和助手正文持续可见[\s\S]*同 task 收敛及重开保持/, 'Casebook生成器必须将MR !1556映射到会话消息保持、多轮、任务重开与宿主相邻回归');
assert.match(productionGrayCasebookBuilder, /\['1549', \{[\s\S]*'MRSMOKE-SKILL-001'[\s\S]*'MRSMOKE-CHART-001'[\s\S]*'MRSMOKE-ROUTE-001'[\s\S]*'MRSMOKE-FAIL-001'[\s\S]*'BETA-MCP-001'[\s\S]*'BETA-MCP-002'[\s\S]*'BETA-SKILL-011'[\s\S]*'SIT-CONN-003'[\s\S]*'SIT-CONN-005'[\s\S]*'SIT-CONN-016'[\s\S]*'BETA-HOST-003'/, 'Casebook生成器必须将MR !1549映射到Skill、Chart、Route、Fail、MCP、Connector与Host真实相邻链路');
assert.match(productionGrayCasebookBuilder, /\['1557', \{[\s\S]*?caseIds: \['BETA-TASK-002', 'MRSMOKE-FAIL-001', 'BETA-CHAT-005', 'BETA-CHAT-007', 'BETA-HOST-003'\][\s\S]*?coverageStrength: '相邻回归\+源码合同'[\s\S]*?requiredSourceContractIds: \['deepbankv2-mr-1557-immediate-regenerate-projection\/v1'\][\s\S]*?真实桌面重新生成链[\s\S]*?立即读回[\s\S]*?running\/占位 assistant[\s\S]*?同一 task 收敛且重开保持[\s\S]*?即时占位\/重开语义[\s\S]*?claim_scope=source_and_test_declarations[\s\S]*?test_execution_attested=false[\s\S]*?不把源码声明冒充产品测试执行结果/, 'Casebook生成器必须将MR !1557绑定真实桌面重新生成链与非执行态源码合同边界');
assert.match(productionGrayCasebookBuilder, /const mr1557 =[\s\S]*mr1557\[7\] !== '12条冒烟\+70条门禁\+160条增量'[\s\S]*MR !1557必须区分真实桌面重新生成链与源码声明边界/, 'MR !1557 的 BETA-TASK-002 G4-only 替换必须计入160条增量覆盖层');
assert.match(productionGrayCasebookBuilder, /\['1559', \{[\s\S]*caseIds: \['MRSMOKE-NAV-001', 'MRSMOKE-ROUTE-001', 'BETA-CHAT-007', 'BETA-TASK-008', 'BETA-HOST-003', 'BETA-PERF-003'\][\s\S]*utilityProcess[\s\S]*heartbeat[\s\S]*navigation transition barrier[\s\S]*不声称桌面 E2E 已证明/, 'Casebook生成器必须将MR !1559映射到可见连续性与宿主稳定回归，并限制内部并发声明范围');
assert.match(productionGrayCasebookBuilder, /\['1561', \{[\s\S]*caseIds: \['MRSMOKE-NAV-001', 'MRSMOKE-ROUTE-001', 'BETA-INIT-001', 'BETA-HOST-003', 'BETA-CHAT-008', 'BETA-PERF-003'\][\s\S]*deepbankv2-mr-1561-worker-envelope-limit\/v1[\s\S]*32 MiB[\s\S]*不声称桌面 E2E 已直接构造或验证 32 MiB 协议边界/, 'Casebook生成器必须将MR !1561映射到运行时、宿主、并发与长回复相邻回归，并限制32 MiB内部边界声明');
assert.match(productionGrayCasebookBuilder, /\['1560', \{[\s\S]*caseIds: \['MRSMOKE-ROUTE-001', 'MRSMOKE-FAIL-001', 'BETA-INIT-001', 'BETA-CHAT-001', 'BETA-CHAT-005', 'BETA-CHAT-007', 'BETA-HOST-003', 'BETA-ROUTE-001'\][\s\S]*deepbankv2-mr-1560-turn-authority-readiness\/v1[\s\S]*10 秒\/100 毫秒[\s\S]*不 refresh、不 re-accept[\s\S]*不声称桌面 E2E 已确定性制造冷模型权威竞争窗口/, 'Casebook生成器必须将MR !1560映射到运行时权威就绪、路由、失败恢复与任务连续性相邻回归，并限制冷模型竞争窗口声明');
assert.match(productionGrayCasebookBuilder, /\['1564', \{[\s\S]*caseIds: \['BETA-EXPERT-012', 'BETA-EXPERT-005', 'BETA-MCP-001', 'BETA-MCP-002', 'MRSMOKE-ROUTE-001', 'BETA-HOST-003'\][\s\S]*coverageStrength: '相邻回归'[\s\S]*additionalEntries[\s\S]*GitLab changes 静态审查[\s\S]*不把模型偶然识别工具或源码测试声明冒充桌面 E2E 直接证明/, 'Casebook生成器必须将MR !1564固定映射到专家维护、MCP、路由与宿主回归，并限制additionalEntries内部拼接声明范围');
assert.match(productionGrayCasebookBuilder, /\['1563', \{[\s\S]*caseIds: \['MRSMOKE-ACT-001', 'MRSMOKE-FAIL-001', 'BETA-CHAT-005', 'BETA-CHAT-006', 'BETA-PERF-003', 'BETA-HOST-003'\][\s\S]*coverageStrength: '相邻回归'[\s\S]*reasoning\.active[\s\S]*runtime activity coalescer[\s\S]*worker-host 事件接线[\s\S]*不确定性模型输出不能冒充专用 runtime-tail fixture 或源码单元测试已执行/, 'Casebook生成器必须将MR !1563固定映射到活动、失败、停止、性能与宿主回归，并限制runtime-tail内部实现声明范围');
assert.match(productionGrayCasebookBuilder, /\['1566', \{[\s\S]*caseIds: \['MRSMOKE-ACT-001', 'MRSMOKE-FAIL-001', 'BETA-CHAT-005', 'BETA-PERF-003', 'BETA-HOST-003'\][\s\S]*coverageStrength: '相邻回归'[\s\S]*ordinaryStallMs=300000[\s\S]*不人为制造五分钟无语义进展[\s\S]*不把自然等待或单元测试声明冒充确定性桌面阈值验证/, 'Casebook生成器必须将MR !1566固定映射到长时任务、性能与宿主回归，并限制五分钟stall阈值声明范围');
assert.match(productionGrayCasebookBuilder, /\['1568', \{[\s\S]*caseIds: \['SIT-TASK-EDIT-001', 'BETA-TASK-002', 'BETA-CHAT-007', 'BETA-TASK-008'\][\s\S]*coverageStrength: '直接E2E'[\s\S]*真实编辑已发送用户消息[\s\S]*真实点击重新生成[\s\S]*历史保持[\s\S]*不使用通用路径映射代替专项断言/, 'Casebook生成器必须将MR !1568精确绑定编辑、重新生成和历史保持专项E2E');
assert.match(productionGrayCasebookBuilder, /DIRECT_E2E_MR_CASE_CONTRACTS = new Map\(\[[\s\S]*\['1568', \['SIT-TASK-EDIT-001', 'BETA-TASK-002', 'BETA-CHAT-007', 'BETA-TASK-008'\]\][\s\S]*\]\);/, 'MR !1568必须进入显式直接E2E白名单，禁止由通用路径启发式获得直接覆盖');
assert.match(productionGrayCasebookBuilder, /\['1569', \{[\s\S]*caseIds: \['MRSMOKE-NAV-001', 'BETA-CHAT-001', 'BETA-CHAT-002', 'BETA-CHAT-007'\][\s\S]*coverageStrength: '相邻回归'[\s\S]*Composer 可用[\s\S]*上下文窗口组件隐藏[\s\S]*未设置该组件不存在的专项 DOM Oracle[\s\S]*不得声称已直接 E2E 证明隐藏行为/, 'Casebook生成器必须将MR !1569限制为Composer、导航布局和会话主链相邻回归');
assert.match(productionGrayCasebookBuilder, /\['1570', \{[\s\S]*caseIds: \['BETA-CHAT-002', 'BETA-CHAT-007', 'BETA-PERF-003', 'BETA-HOST-003'\][\s\S]*coverageStrength: '相邻回归'[\s\S]*Claude 多轮[\s\S]*turn-end[\s\S]*context usage normalization[\s\S]*桌面证据不得冒充内部调度源码合同/, 'Casebook生成器必须将MR !1570映射到Claude turn-end连续性并限制内部调度声明');
assert.match(productionGrayCasebookBuilder, /\['1572', \{[\s\S]*caseIds: \['MRSMOKE-ACT-001', 'MRSMOKE-FAIL-001', 'BETA-CHAT-005', 'BETA-CHAT-006', 'BETA-PERF-003', 'BETA-HOST-003'\][\s\S]*coverageStrength: '相邻回归'[\s\S]*runtime tail 可见状态[\s\S]*tail copy、pulse 样式[\s\S]*无确定性 copy\/pulse 专项桌面 Oracle[\s\S]*不把普通完成态或截图冒充直接 E2E 证明/, 'Casebook生成器必须将MR !1572映射到runtime-tail文案和pulse相邻回归并限制直接覆盖声明');
for (const iid of ['1334', '1331', '1330', '1332', '1336', '1337', '1338', '1310', '1339', '1340', '1333', '1341', '1326', '1342', '1320', '1344', '1343', '1345', '1346', '1349', '1348', '1350', '1355', '1354', '1356', '1357', '1352', '1359', '1361', '1364', '1358', '1365', '1428', '1430', '1443', '1450', '1451', '1374']) {
  assert.match(productionGrayCasebookBuilder, new RegExp(`\\{ mr: '${iid}'`), `Casebook生成器必须冻结新增MR !${iid}的只读文件清单`);
}
assert.match(productionGrayCasebookBuilder, /\['1374', \['MRSMOKE-ROUTE-001', 'MRSMOKE-FAIL-001', 'BETA-CHAT-005', 'BETA-PERF-003'\]\]/, 'Casebook生成器必须将MR !1374映射到Auto fallback/catalog authority回归Case');
assert.match(productionGrayCasebookBuilder, /\['1520', \['MRSMOKE-NAV-001', 'BETA-INIT-001', 'BETA-INIT-003', 'BETA-HOST-003', 'SIT-TEAMS-NEW-001', 'SIT-TEAMS-NEW-003'\]\]/, 'Casebook生成器必须将MR !1520映射到SDK解压期间Teams Tab与宿主回归Case');
assert.match(productionGrayCasebookBuilder, /\['1516', \['MRSMOKE-FAIL-001', 'MRSMOKE-ROUTE-001', 'BETA-CHAT-005', 'BETA-PERF-003'\]\]/, 'Casebook生成器必须将MR !1516精确映射到VPN错误提示、路由恢复和长文本收敛回归Case');
assert.match(productionGrayCasebookBuilder, /if \(String\(mr\.mr \|\| ''\) === '1516'\)[\s\S]*RECENT_MR_CASE_MAPPING\.get\('1516'\)/, 'Casebook生成器必须拒绝用启发式规则泛化MR !1516映射');
assert.match(productionGrayCasebookBuilder, /\['1526', \['MRSMOKE-SKILL-001', 'MRSMOKE-FAIL-001', 'BETA-CHAT-006', 'BETA-PERF-003'\]\]/, 'Casebook生成器必须将MR !1526精确映射到Skill原生判定、连接器失败恢复与消息布局回归Case');
assert.match(productionGrayCasebookBuilder, /if \(String\(mr\.mr \|\| ''\) === '1526'\)[\s\S]*RECENT_MR_CASE_MAPPING\.get\('1526'\)/, 'Casebook生成器必须拒绝用启发式规则泛化MR !1526映射');
assert.match(productionGrayCasebookBuilder, /MRSMOKE-FAIL-001[\s\S]*connector_retry_recovery_trace[\s\S]*三轮使用同一非空taskId/, 'Casebook生成器必须冻结连接器失败后同任务恢复合同');
assert.match(productionGrayCasebookBuilder, /MRSMOKE-SKILL-001[\s\S]*skill_execution_trace[\s\S]*原生 Skill tool-use\/result/, 'Casebook生成器必须冻结原生Skill调用证据合同');
assert.match(productionGrayCasebookBuilder, /BETA-CHAT-006[\s\S]*BETA-PERF-003[\s\S]*horizontal_overflow_readback/, 'Casebook生成器必须冻结停止与长文本消息的四层横向边界证据');
assert.doesNotMatch(productionGrayCasebookBuilder, /git\(\['cat-file'/, 'Casebook生成器不得依赖本地存在已被API intake完整验证的历史Git对象');
assert.match(productionGrayCasebookBuilder, /\['1352', \['BETA-FILE-006', 'BETA-FILE-008', 'BETA-FILE-009', 'SIT-HOME-044'\]\]/, 'Casebook生成器必须将MR !1352映射到FileInput预览/打开回归Case');
assert.match(productionGrayCasebookBuilder, /\['1359', \['BETA-FILE-005', 'BETA-FILE-006', 'BETA-FILE-007', 'SIT-HOME-056'\]\]/, 'Casebook生成器必须将MR !1359映射到混合附件逐文件保留回归Case');
assert.match(productionGrayCasebookBuilder, /\['1361', \['MRSMOKE-SKILL-001'[\s\S]*'BETA-SKILL-014'\]\]/, 'Casebook生成器必须将MR !1361映射到Skill安装隔离回归Case');
assert.match(productionGrayCasebookBuilder, /\['1364', \['MRSMOKE-ART-001', 'BETA-ART-001', 'BETA-FILE-005'\]\]/, 'Casebook生成器必须将MR !1364映射到编码Windows路径回归Case');
assert.match(productionGrayCasebookBuilder, /\['1358', \['MRSMOKE-ART-001'[\s\S]*'BETA-ART-004'\]\]/, 'Casebook生成器必须将MR !1358映射到成果会话隔离回归Case');
assert.match(productionGrayCasebookBuilder, /\['1365', \['MRSMOKE-ACT-001'[\s\S]*'BETA-CHAT-007'\]\]/, 'Casebook生成器必须将MR !1365映射到自动化列表与响应式UI回归Case');
for (const iid of ['1330', '1337', '1310', '1340', '1333', '1326', '1342', '1344']) {
  assert.match(productionGrayCasebookBuilder, new RegExp(`\\['${iid}', \\{[\\s\\S]*?disposition: '[^']*(?:CI-only|Dashboard-only|Dashboard/研究物料-only|Eval-only|Toolchain-only|Version-only)`), `Casebook生成器必须把MR !${iid}冻结为非桌面静态审计`);
}
const chartDriverStart = runner.indexOf('async function executeSitConnectorChartConversation');
const chartDriverEnd = runner.indexOf('\nasync function executeSitConnectorAddEntryScope', chartDriverStart);
const chartDriverSource = runner.slice(chartDriverStart, chartDriverEnd);
assert.ok(chartDriverStart > 0 && chartDriverEnd > chartDriverStart, '必须存在交互图表 MR/门禁 Driver');
assert.match(chartDriverSource, /interactiveChartReadbackVerdict/, '交互图表 Driver 必须生成独立 evidence_valid\/oracle_valid 专项证据');
assert.match(chartDriverSource, /qcharts-react-container/, '交互图表 Driver 必须读取 qcharts-react SVG');
assert.match(chartDriverSource, /qbot-chart-result-fallback/, '交互图表 Driver 必须显式拒绝静态失败 fallback');
assert.match(chartDriverSource, /svg_text_nodes/, '交互图表 Driver 必须读取可见 SVG 标签与数值');
assert.match(chartDriverSource, /document_overflow_x/, '交互图表 Driver 必须核对 document 横向边界');
assert.match(chartDriverSource, /capability_selection\.json/, '自动连接器图表 Driver 必须固化 capability_selection 证据');
assert.match(chartDriverSource, /capability_execution_event\.json/, '自动连接器图表 Driver 必须固化 capability_execution_event 证据');
assert.match(chartDriverSource, /selection_mode: 'auto'/, '自动连接器图表 Driver 必须标记 auto 路由来源');
assert.match(chartDriverSource, /builtin:qbot_chart/, '自动连接器图表 Driver 必须绑定 qbot_chart 能力身份');

const connectorRetryDriverStart = runner.indexOf('async function qworkMrConnectorRetryRecoveryCase');
const connectorRetryDriverEnd = runner.indexOf('\nasync function mrSmokeActivityDomSnapshot', connectorRetryDriverStart);
const connectorRetryDriverSource = runner.slice(connectorRetryDriverStart, connectorRetryDriverEnd);
assert.ok(connectorRetryDriverStart > 0 && connectorRetryDriverEnd > connectorRetryDriverStart, '必须存在 !1526 连接器失败恢复原生 Driver');
assert.match(connectorRetryDriverSource, /await qworkDailyRedactionCase\(context\)/, '连接器失败恢复 Driver 必须保留原凭据脱敏检查');
assert.match(connectorRetryDriverSource, /"type":"bar","data":\[\][\s\S]*"type":"line","data":\[\][\s\S]*曝光12000、点击860、报名240、成交28/, '连接器失败恢复 Driver 必须执行两次确定性参数失败和第三次合法四点成功');
assert.match(connectorRetryDriverSource, /connectorRetryRecoveryVerdict[\s\S]*connector_retry_recovery_trace/, '连接器失败恢复 Driver 必须生成独立恢复 trace');
assert.match(runner, /case 'qwork_mr_connector_retry_recovery':[\s\S]*qworkMrConnectorRetryRecoveryCase/, '原生分发器必须注册连接器失败恢复 Driver');
assert.match(runner, /function connectorRetryRecoveryVerdict[\s\S]*same_nonempty_task_id[\s\S]*first_two_real_failures[\s\S]*final_tool_succeeded[\s\S]*no_connector_circuit_open/, '连接器恢复 verdict 必须区分证据、失败、成功和熔断 Oracle');
assert.match(runner, /function skillNativeInvocationReadback[\s\S]*native_skill_tool_part_present[\s\S]*provider_receipt_hash_present[\s\S]*server_preflight_rejection_absent/, 'Skill原生调用读回必须绑定tool-use/result、provider receipt并拒绝服务端提前阻断');
assert.match(runner, /function horizontalOverflowReadbackVerdict[\s\S]*assistant_body_no_overflow[\s\S]*assistant_message_no_overflow[\s\S]*message_list_no_overflow[\s\S]*document_no_overflow/, '横向溢出读回必须覆盖助手正文、消息、消息列表和document四层');

const inputOnlyWithSendWord = reviewCaseCredibility(reviewFixture({
  id: 'SIT-HOME-056',
  steps: [{ action: '输入删除一个附件后发送', status: 'passed' }],
}));
if (inputOnlyWithSendWord.review_category !== '可信通过-用户可接受' || !inputOnlyWithSendWord.trusted) {
  throw new Error('仅输入动作名称包含“发送”时不应要求会话 reply-delta/transcript');
}

const preConversationBug = reviewCaseCredibility(reviewFixture({
  id: 'SIT-SKILL-025',
  status: 'failed',
  result_category: 'bug',
  steps: [{ action: '点击安装技能', status: 'passed' }],
  assertions: [{ name: '技能安装结果', expected: '技能安装成功或提供可操作的登录提示', actual: '页面提示登录凭证缺失，安装无法继续。', status: 'failed', category: 'bug' }],
  actual_result: '安装接口返回已登录用户 OAuth token 缺失。',
}));
if (preConversationBug.review_category !== '可信失败-产品Bug候选' || !preConversationBug.trusted) {
  throw new Error('会话前已到达的产品失败不应被 transcript 要求覆盖');
}

const bridgeBlocked = reviewCaseCredibility(reviewFixture({
  id: 'SIT-HOME-025',
  status: 'blocked',
  result_category: 'blocked',
  actual_result: 'agent.send bridge 不可替换，dry-run 无法安装。',
}));
if (bridgeBlocked.review_category !== '不可信-框架问题' || bridgeBlocked.trusted) {
  throw new Error('bridge 能力缺失必须归类为框架问题');
}

const environmentBlocked = reviewCaseCredibility(reviewFixture({
  id: 'SIT-EXPERT-015',
  status: 'blocked',
  result_category: 'blocked',
  actual_result: '专家市场存在专家卡片，无法构造无专家市场数据的空态账号。',
}));
if (environmentBlocked.review_category !== '可信阻塞-环境或数据' || !environmentBlocked.trusted) {
  throw new Error('明确的数据前置缺失应归类为可信阻塞');
}

const skillInventoryBlocked = reviewCaseCredibility(reviewFixture({
  id: 'SIT-SKILL-026',
  status: 'blocked',
  result_category: 'blocked',
  actual_result: '该用例要求已安装至少 2 个技能；当前手动模式只成功选择 0 个技能，无法验证多技能 badge。',
}));
if (skillInventoryBlocked.review_category !== '可信阻塞-环境或数据' || !skillInventoryBlocked.trusted) {
  throw new Error('技能数量不足的具体数据前置应归类为可信阻塞');
}

const visionRuntimeBlocked = reviewCaseCredibility(reviewFixture({
  id: 'SIT-HOME-037',
  status: 'blocked',
  result_category: 'blocked',
  actual_result: '图片识别暂不可用：当前连接的 QBot 控制平面尚未提供与此桌面版本兼容的视觉运行时。',
}));
if (visionRuntimeBlocked.review_category !== '可信阻塞-环境或数据' || !visionRuntimeBlocked.trusted) {
  throw new Error('明确缺少兼容视觉运行时应归类为可信环境阻塞，而不是框架问题');
}

{
  const evidenceDir = fs.mkdtempSync(path.join(os.tmpdir(), 'qbot-credibility-structured-blockers-'));
  try {
    const reportFile = path.join(evidenceDir, 'case-report.md');
    fs.writeFileSync(reportFile, '# evidence');
    const upstreamFile = path.join(evidenceDir, 'upstream-skill-install-prerequisite.json');
    writeJsonFile(upstreamFile, {
      schema_version: 'qbot-core-beta-upstream-prerequisite/v1',
      valid: true,
      oracle_valid: false,
      applicable: true,
      kind: 'skill_install_terminal_shortage',
      source: 'exact_run_owned_install_attempt_ledger',
      dependent_case_id: 'BETA-SKILL-010',
      reason: '指定 Skill 安装前置失败：global/exchange-mail-operation/2.1.2；依赖该身份的 Case 不得发送或随机替换。',
      expected_count: 10,
      attempted_count: 10,
      successful_count: 6,
      failed_count: 4,
      failed_identities: ['skill-1', 'skill-2', 'skill-3', 'skill-4'],
      receipts_sha256: 'a'.repeat(64),
    });
    const structuredBlocked = reviewCaseCredibility(reviewFixture({
      id: 'BETA-SKILL-010',
      case_dir: evidenceDir,
      case_report: reportFile,
      status: 'blocked',
      result_category: 'blocked',
      actual_result: '指定 Skill 安装前置失败：global/exchange-mail-operation/2.1.2。',
      artifacts: { capability_inventory: upstreamFile },
    }));
    assert.equal(structuredBlocked.review_category, '可信阻塞-环境或数据');
    assert.equal(structuredBlocked.trusted, true);
    assert.match(structuredBlocked.reason, /结构化上游前置证据已验证/);

    const screenshot = path.join(evidenceDir, 'manual-installed-skill-selected.png');
    fs.writeFileSync(screenshot, Buffer.alloc(256, 7));
    const preSendFile = path.join(evidenceDir, 'pre-send-capability-failure.json');
    const preSendEvidence = coreBetaPreSendCapabilityFailureEvidence({
      testCaseId: 'BETA-SKILL-011',
      capabilityKind: 'skill',
      expectedIdentity: 'global/doc-coauthoring/20260616.103316',
      before: {
        task: { id: null, running: false, send_count: 31, message_count: 0 },
        skills: { selected: [] },
      },
      after: {
        task: { id: null, running: false, send_count: 31, message_count: 0 },
        skills: { selected: [] },
      },
      interaction: {
        schema_version: 'qbot-core-beta-capability-interaction/v1',
        capability_kind: 'skill',
        stage: 'manual_skill_selection',
        expected_identity: 'global/doc-coauthoring/20260616.103316',
        control_testid: 'composer-skill-option-doc-coauthoring',
        control_located: true,
        click_dispatched: true,
        expected_state_observed: false,
        aria_checked: 'false',
        manual_surface: { search_visible: true, list_visible: true, option_count: 40, empty_visible: false },
        screenshot,
        category: 'bug',
      },
      noPromptRecorded: true,
      noSendReceiptRecorded: true,
    });
    writeJsonFile(preSendFile, preSendEvidence);
    const structuredPreSendBug = reviewCaseCredibility(reviewFixture({
      id: 'BETA-SKILL-011',
      case_dir: evidenceDir,
      case_report: reportFile,
      scenario: '手动选择已安装 Skill 后保持选中态',
      expected_result: '点击 Skill 后应显示选中态并保留到发送前。',
      status: 'failed',
      result_category: 'bug',
      steps: [{
        action: '手动选择刚安装的技能：结构化文档协作',
        status: 'failed',
        category: 'bug',
        actual: '控件已点击，但 aria-checked=false 且 selectedSkills=[]。',
        screenshot,
      }],
      assertions: [{
        name: '动作 beta-skill-011-verify 可机判 Oracle',
        status: 'failed',
        category: 'bug',
        actual: 'step_failures=1',
      }],
      screenshots: { manual_installed_skill_selected: screenshot },
      screenshots_flat: [screenshot],
      artifacts: { capability_selection: preSendFile },
    }));
    assert.equal(structuredPreSendBug.review_category, '可信失败-产品Bug候选');
    assert.equal(structuredPreSendBug.trusted, true);
    assert.match(structuredPreSendBug.reason, /aria-checked=false/);
  } finally {
    fs.rmSync(evidenceDir, { recursive: true, force: true });
  }
}

// Verified-legacy MR wrappers must keep product-driver IDs separate from the
// outer Core Beta evidence owner. Inventory mismatch remains a product bug,
// while a legacy-ID blocker or mapping drift must fail closed.
{
  const evidenceDir = fs.mkdtempSync(path.join(os.tmpdir(), 'qbot-mr-legacy-capability-owner-'));
  try {
    const screenshot = path.join(evidenceDir, 'manual-installed-skill-missing.png');
    fs.writeFileSync(screenshot, Buffer.alloc(256, 17));
    const roles = [
      'capability_execution_event', 'prompt', 'task_id', 'send_receipt',
      'transcript', 'reply_delta', 'reply_completion',
    ];
    const interaction = {
      schema_version: 'qbot-core-beta-capability-interaction/v1',
      capability_kind: 'skill',
      stage: 'manual_skill_selection',
      expected_identity: 'qa-scope-isolation',
      control_testid: '',
      control_located: false,
      click_dispatched: false,
      selection_surface_located: true,
      inventory_mismatch: true,
      expected_state_observed: false,
      aria_checked: 'false',
      manual_surface: {
        search_visible: true,
        list_visible: true,
        option_count: 34,
        empty_visible: false,
      },
      screenshot,
      category: 'bug',
    };
    const blocker = coreBetaPreSendCapabilityFailureEvidence({
      testCaseId: 'MRSMOKE-SKILL-001',
      legacyCaseId: 'SIT-SKILL-MR-001',
      capabilityKind: 'skill',
      expectedIdentity: 'qa-scope-isolation',
      before: { task: { id: null, running: false, send_count: 26, message_count: 0 }, skills: { selected: [] } },
      after: { task: { id: null, running: false, send_count: 26, message_count: 0 }, skills: { selected: [] } },
      interaction,
      noPromptRecorded: true,
      noSendReceiptRecorded: true,
      notApplicableRoles: roles,
    });
    assert.equal(blocker.evidence_valid, true);
    assert.equal(blocker.oracle_valid, false);
    assert.equal(blocker.dependent_case_id, 'MRSMOKE-SKILL-001');
    assert.equal(blocker.legacy_case_id, 'SIT-SKILL-MR-001');
    const blockerFile = path.join(evidenceDir, 'pre-send-capability-failure.json');
    writeJsonFile(blockerFile, blocker);
    const manifest = buildCoreEvidenceManifest({
      testCase: {
        id: 'SIT-SKILL-MR-001',
        core_beta_case_id: 'MRSMOKE-SKILL-001',
        evidence_roles: ['capability_selection', ...roles],
      },
      caseDir: evidenceDir,
      artifacts: {
        capability_selection: blockerFile,
        core_beta_legacy_driver: { legacy_case_id: 'SIT-SKILL-MR-001' },
        core_beta_not_applicable_roles: roles.map((role) => ({ role, blocker_path: blockerFile })),
      },
    });
    assert.equal(manifest.complete, true, JSON.stringify(manifest));
    assert.deepEqual(manifest.missing_roles, []);

    const wrongOwner = { ...blocker, dependent_case_id: 'SIT-SKILL-MR-001' };
    writeJsonFile(blockerFile, wrongOwner);
    const rejected = buildCoreEvidenceManifest({
      testCase: {
        id: 'SIT-SKILL-MR-001',
        core_beta_case_id: 'MRSMOKE-SKILL-001',
        evidence_roles: ['capability_selection', ...roles],
      },
      caseDir: evidenceDir,
      artifacts: {
        capability_selection: blockerFile,
        core_beta_legacy_driver: { legacy_case_id: 'SIT-SKILL-MR-001' },
        core_beta_not_applicable_roles: roles.map((role) => ({ role, blocker_path: blockerFile })),
      },
    });
    assert.equal(rejected.complete, false, 'legacy ID 不能冒充外层 blocker 归属');
    assert.ok(rejected.missing_roles.includes('capability_execution_event'));

    const wrongLegacy = { ...blocker, legacy_case_id: 'SIT-SKILL-OTHER-001' };
    writeJsonFile(blockerFile, wrongLegacy);
    const rejectedLegacy = buildCoreEvidenceManifest({
      testCase: {
        id: 'SIT-SKILL-MR-001',
        core_beta_case_id: 'MRSMOKE-SKILL-001',
        evidence_roles: ['capability_selection', ...roles],
      },
      caseDir: evidenceDir,
      artifacts: {
        capability_selection: blockerFile,
        core_beta_legacy_driver: { legacy_case_id: 'SIT-SKILL-MR-001' },
        core_beta_not_applicable_roles: roles.map((role) => ({ role, blocker_path: blockerFile })),
      },
    });
    assert.equal(rejectedLegacy.complete, false, 'artifact legacy ID 不匹配时必须 fail-closed');
    assert.ok(rejectedLegacy.missing_roles.includes('capability_execution_event'));
  } finally {
    fs.rmSync(evidenceDir, { recursive: true, force: true });
  }
}

if (obviousDuplicateEvidence('新建文件 first.md\n新建文件 first.md')) throw new Error('正常文件工具进度不应判为重复');
if (obviousDuplicateEvidence('调用 WaitForMcpServers\n调用 WaitForMcpServers')) throw new Error('MCP 等待工具进度不应判为重复');
if (obviousDuplicateEvidence('用户看到的提示：\n用户看到的提示：')) throw new Error('短结构标题不应判为重复正文');
if (obviousDuplicateEvidence('🔒 无查看权限\n🔒 无查看权限')) throw new Error('短权限状态不应判为重复正文');
if (obviousDuplicateEvidence('错误码：blocked_private_network\n错误码：blocked_private_network')) throw new Error('分地址安全错误码不应判为重复');
if (obviousDuplicateEvidence('▼          ▼          ▼\n▼          ▼          ▼')) throw new Error('流程图方向符号不应判为重复正文');
if (!obviousDuplicateEvidence('这是一段确实重复的用户可见正文。\n这是一段确实重复的用户可见正文。')) throw new Error('真实重复正文应被识别');
if (obviousDuplicateEvidence('字段名（如 signup_status）\n这里是中间的详细分析。\n这是另一段不同的业务结论。\n字段名（如 signup_status）')) throw new Error('远距离合理复述不应判为连续重复');
if (!obviousDuplicateEvidence('第一段需要重复检测。\n第二段也属于同一块。\n第一段需要重复检测。\n第二段也属于同一块。')) throw new Error('相邻重复块应被识别');

const numericTurns = buildConversationTurns({
  id: 'SIT-HOME-016',
  scenario: '普通多轮业务数字追问',
  test_data: '活动报名100人，到场70人，成交12单',
}, []);
if (numericTurns.length !== 4 || !numericTurns[3]?.prompt.includes('成交率')) {
  throw new Error(`HOME-016 必须优先进入四轮数字记忆脚本：${JSON.stringify(numericTurns)}`);
}
const numericMemoryCase = {
  id: 'SIT-HOME-016',
  scenario: '同一会话多轮业务数字追问应保持上下文并答对数字',
  test_data: '活动报名100人，到场70人，成交12单',
};
const numericMemoryReplies = [
  '报名100人，到场70人，成交12单。',
  '报名人数是 100 人（单位：人）。',
  '到场人数是 70 人。到场率为 70%。',
  '成交单数是 12 单，成交率约 17.1%。',
];
numericMemoryReplies.forEach((reply, index) => {
  assert.equal(
    replyLooksRelevant(reply, numericMemoryCase, numericTurns[index].prompt),
    true,
    `HOME-016 第 ${index + 1} 轮正确数字回复不得被通用相关性误判`,
  );
});
for (const [index, reply] of [
  [0, '报名100人，到场70人，没有成交数据。'],
  [1, '报名人数是 70 人。'],
  [2, '到场人数是 70 人，到场率为 17.1%。'],
  [3, '成交单数是 12 单，成交率为 70%。'],
]) {
  assert.equal(
    replyLooksRelevant(reply, numericMemoryCase, numericTurns[index].prompt),
    false,
    `HOME-016 第 ${index + 1} 轮数字或比例错配必须失败`,
  );
}
const pngFunnelTurns = buildConversationTurns({
  id: 'SIT-HOME-037',
  scenario: '上传 PNG 图片后 Agent 应识别主要视觉内容',
  test_data: 'PNG 活动漏斗图包含报名100人、到场70人、成交12单',
}, ['/tmp/qbot-image-test.png']);
if (pngFunnelTurns.length !== 1
  || !pngFunnelTurns[0]?.prompt.includes('PNG 活动漏斗图')
  || pngFunnelTurns[0]?.prompt.includes('请记住这组活动数据')) {
  throw new Error(`HOME-037 必须保留 PNG 漏斗识别脚本：${JSON.stringify(pngFunnelTurns)}`);
}
const imageJsonTurns = buildConversationTurns({
  id: 'SIT-HOME-039',
  kind: 'attachment',
  scenario: '同时上传图片和文档后 Agent 应分别说明证据来源',
  test_data: 'testflies/qbot-image-test.png + testflies/qbot-data.json',
}, ['/tmp/qbot-image-test.png', '/tmp/qbot-data.json']);
if (imageJsonTurns.length !== 1
  || !imageJsonTurns[0]?.prompt.includes('qbot-image-test.png')
  || !imageJsonTurns[0]?.prompt.includes('qbot-data.json')
  || !imageJsonTurns[0]?.prompt.includes('明确每条结论来自')) {
  throw new Error(`HOME-039 必须发送双文件分来源任务：${JSON.stringify(imageJsonTurns)}`);
}
const imageJsonAssertion = caseAwareReplyAssertion(
  { id: 'SIT-HOME-039' },
  imageJsonTurns[0],
  'qbot-image-test.png（PNG 图片）显示报名100、到场70、成交12。qbot-data.json（JSON）中 project 是 QBot UI Agent 自动化，owner 是 QA，acceptance 包含附件理解、截图留证和中文报告。综合结论如上。',
);
if (!imageJsonAssertion.applicable || !imageJsonAssertion.ok) {
  throw new Error(`HOME-039 双文件分来源确定性断言应通过：${JSON.stringify(imageJsonAssertion)}`);
}
assert.equal(coreBetaConversationTurnLabel({}, 0), '第1轮', 'Core Beta 缺失 turn 时必须按数组顺序生成标签');
assert.equal(coreBetaConversationTurnLabel({ turn: 4 }, 0), '第4轮', 'Core Beta 必须保留合法的显式轮次');
assert.equal(coreBetaConversationTurnLabel({ label: '成果生成请求' }, 0), '成果生成请求', 'Core Beta 必须优先保留显式标签');
assert.equal(coreBetaConversationTurnLabel({}, Number.NaN).includes('undefined'), false, 'Core Beta 轮次标签不得包含 undefined');
const coreArtifactTableCase = {
  id: 'BETA-ART-003',
  module: '核心内测',
  submodule: '成果与下载',
  scenario: '生成XLSX与CSV并验证公式、总计、格式和聊天事实一致',
  test_data: '三行明细，要求XLSX使用公式求和并同时输出CSV。',
};
const coreArtifactDeckCase = {
  id: 'BETA-ART-004',
  module: '核心内测',
  submodule: '成果输出',
  scenario: '生成PPTX与PDF汇报材料并验证页数、标题、图表和内容一致',
  test_data: '五页汇报结构、三个固定指标、一个图表。',
};
const coreArtifactDeckPrompt = '基于曝光1000、点击100、转化20生成五页PPTX汇报并同时输出PDF。';
const coreArtifactDeckReply = [
  '已完成。基于曝光 1,000 / 点击 100 / 转化 20 生成了 5 页汇报，同时输出 PPTX 和 PDF。',
  '转化漏斗分析页包含三层漏斗图，两个文件的五页标题和指标一致。',
].join('\n');
assert.equal(
  replyLooksRelevant(coreArtifactDeckReply, coreArtifactDeckCase, coreArtifactDeckPrompt),
  true,
  'BETA-ART-004 的真实五页双格式漏斗回复不得被通用相关性误判',
);
assert.equal(
  caseAwareReplyAssertion(coreArtifactDeckCase, { prompt: coreArtifactDeckPrompt }, coreArtifactDeckReply).ok,
  true,
  'BETA-ART-004 必须通过专用回复业务 Oracle，而不是依赖通用中文 token 重合',
);
assert.equal(
  replyLooksRelevant('已生成 5 页 PPTX 和 PDF，但没有可核对的数据。', coreArtifactDeckCase, coreArtifactDeckPrompt),
  false,
  'BETA-ART-004 不得接受缺少曝光、点击、转化固定指标的双格式回复',
);
assert.equal(
  caseAwareReplyAssertion(
    coreArtifactDeckCase,
    { prompt: coreArtifactDeckPrompt },
    '已生成 5 页 PPTX 和 PDF，曝光 1000、点击 100、转化 99。',
  ).ok,
  false,
  'BETA-ART-004 的专用回复 Oracle 必须拒绝错误转化指标',
);
assert.equal(
  replyLooksRelevant('今天北京天气晴朗，建议携带雨具。', coreArtifactDeckCase, coreArtifactDeckPrompt),
  false,
  'BETA-ART-004 不得把无关天气回复判为相关',
);
const coreArtifactTablePrompt = '用数据(甲,10),(乙,20),(丙,30)生成带SUM公式的XLSX和同数据CSV。';
const coreArtifactTableReply = [
  '两个文件已生成并验证：',
  'data_sum.xlsx 包含 =SUM(B2:B4) 公式，合计 60。',
  'data_sum.csv 包含甲 10、乙 20、丙 30。',
].join('\n');
assert.equal(
  replyLooksRelevant(coreArtifactTableReply, coreArtifactTableCase, coreArtifactTablePrompt),
  true,
  'BETA-ART-003 的 XLSX、CSV、SUM 和总计回复不得被通用相关性误判',
);
assert.equal(
  replyLooksRelevant('已生成 data_sum.xlsx。', coreArtifactTableCase, coreArtifactTablePrompt),
  false,
  'BETA-ART-003 不得接受缺少 CSV 和 SUM/总计的不完整回复',
);
assert.equal(
  replyLooksRelevant('今天北京天气晴朗，建议携带雨具。', coreArtifactTableCase, coreArtifactTablePrompt),
  false,
  'BETA-ART-003 不得把无关天气回复判为相关',
);
assert.equal(
  replyLooksRelevant('已生成文件 teams_local_execution.txt。', {
    id: 'SIT-HOME-059',
    module: '会话',
    submodule: '本地执行',
    scenario: '生成指定文件',
    test_data: '生成 teams_local_execution.txt',
  }, '请生成 teams_local_execution.txt，内容为 TEAMS_LOCAL_EXECUTION_OK。'),
  true,
  '精确请求文件名的简短成果确认应判为相关',
);
if (!replyLooksRelevant('收到，我会按“数据结论、可能原因、下一步动作”的格式输出。', {
  id: 'SIT-HOME-053',
  scenario: '连续追问补充输出格式',
  test_data: '补充输出格式、风险和验证方法',
}, '请补充输出格式、风险和验证方法')) {
  throw new Error('多轮约束确认不应被相关性启发式误判');
}
if (!replyLooksRelevant('我是 QBot，你的智能办公助手，可以帮助整理资料、分析数据和执行任务。', {
  id: 'SIT-HOME-015',
  scenario: '普通身份问答',
  test_data: '你好，请用一句话说明你是谁。',
}, '你好，请用一句话说明你是谁。')) {
  throw new Error('身份问答不应被相关性启发式误判');
}
const loginTestRelevanceCase = {
  id: 'SIT-TASK-EDIT-001',
  scenario: '编辑历史用户问题并重新发送后，新回复应基于修改后的内容且会话状态一致',
  test_data: '原问题：请给出 3 条登录测试点。修改后：请给出 5 条附件上传测试点。',
};
assert.equal(
  replyLooksRelevant(
    '正常登录链路验证正确账号和密码；异常凭证覆盖验证码错误；退出后验证 token、session 和 cookie 失效。',
    loginTestRelevanceCase,
    '请给出 3 条登录测试点。',
  ),
  true,
  '登录测试点回复命中凭证、会话和验证语义时不得被通用相关性误判',
);
assert.equal(
  replyLooksRelevant('今天北京天气晴朗，建议携带雨具。', loginTestRelevanceCase, '请给出 3 条登录测试点。'),
  false,
  '登录测试点不得把无关天气回复判为相关',
);
if (!replyLooksRelevant('已成功读取附件 qbot-text-brief.txt（共 228 字节）。主要内容是 QBot 核心对话能力测试，并给出三条验收点。', {
  id: 'SIT-HOME-031',
  scenario: '上传 TXT 后 Agent 应读取并概括内容',
  test_data: 'testflies/qbot-text-brief.txt',
}, '请读取我上传的附件，概括主要内容，并说明这些材料能支持什么结论。')) {
  throw new Error('TXT 附件真实读取和概括不应被相关性启发式误判');
}
const attachmentIdentityAndSizeCase = {
  id: 'BETA-FILE-007',
  scenario: '四类附件拒绝后合法附件可恢复发送',
  test_data: '合法附件恢复发送',
};
const attachmentIdentityAndSizePrompt = '请识别合法附件的文件名和大小。';
if (!replyLooksRelevant('已读取该附件，识别结果如下：\n\n文件名：qbot-text-brief.txt\n大小：228 字节', attachmentIdentityAndSizeCase, attachmentIdentityAndSizePrompt)) {
  throw new Error('BETA-FILE-007 的真实文件名和大小回复不应被通用相关性误判');
}
for (const unrelatedReply of [
  '文件名：qbot-text-brief.txt，但没有大小信息。',
  '大小：228 字节，但没有文件名。',
  '今天北京天气晴朗，建议携带雨具。',
]) {
  if (replyLooksRelevant(unrelatedReply, attachmentIdentityAndSizeCase, attachmentIdentityAndSizePrompt)) {
    throw new Error(`BETA-FILE-007 不得接受缺失文件身份/大小或无关的回复：${unrelatedReply}`);
  }
}
{
  const terminalDir = fs.mkdtempSync(path.join(os.tmpdir(), 'qbot-beta-file-007-terminal-'));
  try {
    const terminalScreenshot = path.join(terminalDir, 'after-timeout.png');
    fs.writeFileSync(terminalScreenshot, Buffer.alloc(256, 7));
    const terminalScreenshotSha256 = createHash('sha256')
      .update(fs.readFileSync(terminalScreenshot))
      .digest('hex');
    const common = {
      caseId: 'BETA-FILE-007',
      rejectionValid: true,
      legalSource: {
        name: 'qbot-text-brief.txt',
        size_bytes: 228,
        sha256: 'eda7b30ac0791eac3e253ff92424017d582fc4f7d5753d2c7276873e910f7713',
      },
      legalUpload: {
        status: 'passed',
        expected_names: ['qbot-text-brief.txt'],
        visible_names: ['qbot-text-brief.txt'],
      },
      taskBinding: {
        case_id: 'BETA-FILE-007',
        task_id: 'fixture-task-beta-file-007',
      },
      reply: {
        incomplete: true,
        deltaText: '文件名：qbot-text-brief.txt\n大小：228 字节',
      },
      replyCompletion: {
        complete: false,
        evidence_complete: true,
        terminal_failure: true,
        terminal_outcome: 'timed_out',
        assistant_reply_present: true,
        confirmed_send_receipt: true,
        waited_ms: 600001,
        min_wait_ms: 60000,
        timeout_ms: 600000,
        terminal_reason: 'Agent 在完整等待窗口结束时仍在运行。',
        terminal_screenshot: terminalScreenshot,
        terminal_screenshot_sha256: terminalScreenshotSha256,
      },
    };
    const timedOut = coreBetaAttachmentLimitsRecoveryVerdict(common);
    assert.equal(timedOut.evidence_valid, true, 'BETA-FILE-007 受验证超时终态必须保持 attachment_readback 证据有效');
    assert.equal(timedOut.oracle_valid, false, '合法附件回复未稳定完成时只能失败产品 Oracle');
    const completed = coreBetaAttachmentLimitsRecoveryVerdict({
      ...common,
      reply: { ...common.reply, incomplete: false },
      replyCompletion: {
        complete: true,
        evidence_complete: true,
        terminal_failure: false,
        terminal_outcome: 'completed',
        confirmed_send_receipt: true,
      },
    });
    assert.equal(completed.evidence_valid, true);
    assert.equal(completed.oracle_valid, true, '稳定完成且点名文件名与大小时应通过产品 Oracle');
    const noReply = coreBetaAttachmentLimitsRecoveryVerdict({
      ...common,
      reply: { incomplete: true, deltaText: '' },
      replyCompletion: {
        ...common.replyCompletion,
        terminal_outcome: 'no_reply',
        assistant_reply_present: false,
        waited_ms: 60001,
        min_wait_ms: 60000,
        timeout_ms: 600000,
        observed_running_after_send: true,
        running_after: false,
        no_reply_stable_observations: 3,
        terminal_reconciliation_performed: true,
        terminal_reconciliation_task_bound: true,
        terminal_reconciliation_prompt_bound: true,
        terminal_reconciliation_reply_present: false,
      },
    });
    assert.equal(noReply.evidence_valid, true, 'BETA-FILE-007 受验证 no_reply 终态不得因正文为空而破坏证据');
    assert.equal(noReply.oracle_valid, false, '受验证 no_reply 只能失败产品 Oracle');
    const taskDrift = coreBetaAttachmentLimitsRecoveryVerdict({
      ...common,
      taskBinding: { ...common.taskBinding, case_id: 'OTHER-CASE' },
    });
    assert.equal(taskDrift.evidence_valid, false, '合法恢复任务绑定漂移仍必须 fail-closed');
    const incompleteTerminalEvidence = coreBetaAttachmentLimitsRecoveryVerdict({
      ...common,
      replyCompletion: { ...common.replyCompletion, terminal_screenshot_sha256: '' },
    });
    assert.equal(incompleteTerminalEvidence.evidence_valid, false, '终态截图 SHA 缺失仍必须 fail-closed');
  } finally {
    fs.rmSync(terminalDir, { recursive: true, force: true });
  }
}
if (!replyLooksRelevant('两个 Skill 都已加载完毕。QA Node Runtime 负责 Node.js 生成数据，QA Python Runtime 负责 Python 分析数据，下面执行一次联合处理。', {
  id: 'SIT-SKILL-026',
  scenario: '手动多 Skill 以内联 chip 共存，删除/恢复任一 chip 后选择状态同步且强走列表准确',
  test_data: '选择两个技能并完成联合处理',
}, '请结合已选的两个技能，完成一次联合处理并分别说明两项能力的作用。')) {
  throw new Error('多 Skill 联合处理的真实回复不应被通用相关性启发式误判');
}
const feedbackCollectionCase = {
  id: 'BETA-CHAT-001',
  module: '会话',
  submodule: '普通业务问答',
  scenario: '干净任务中提出普通业务问题并收到完整、相关、无技术噪音的回复',
  test_data: '请给新产品内测设计 5 条可执行的用户反馈收集建议。',
};
const feedbackCollectionPrompt = '请给新产品内测设计 5 条可执行的用户反馈收集建议。';
if (!replyLooksRelevant(
  '以下是 5 条可执行的用户反馈收集建议：在关键流程嵌入评分、按用户分层访谈、设置问卷渠道、跟踪样本与闭环。',
  feedbackCollectionCase,
  feedbackCollectionPrompt,
)) {
  throw new Error('用户反馈收集建议的有效回复不得因长中文 prompt 未分词而误判为不相关');
}
if (replyLooksRelevant(
  '今天北京天气晴朗，建议携带雨具。',
  feedbackCollectionCase,
  feedbackCollectionPrompt,
)) {
  throw new Error('用户反馈收集主题不得把无关天气回复判为相关');
}
const duplicateAttachmentIdentityCase = {
  id: 'BETA-FILE-009',
  module: '附件',
  submodule: '同名附件',
  scenario: '多个附件含重复文件名时可按identity删除一个，发送只处理剩余项且顺序/内容不串',
  test_data: '同名不同SHA附件与第三个附件。',
};
const duplicateAttachmentIdentityPrompt = '按输入区顺序列出剩余附件并分别引用唯一标记。';
const duplicateAttachmentIdentityReply = [
  '两个附件均已成功读取，按输入区顺序列出如下：',
  'duplicate.txt -> QBOT_DUPLICATE_KEEP_A=ALPHA-317',
  'third.txt -> QBOT_THIRD_KEEP_C=CHARLIE-463',
].join('\n');
assert.equal(
  replyLooksRelevant(duplicateAttachmentIdentityReply, duplicateAttachmentIdentityCase, duplicateAttachmentIdentityPrompt),
  true,
  '剩余同名附件的文件名与唯一标记回复不得被通用相关性误判',
);
assert.equal(
  replyLooksRelevant('今天北京天气晴朗，建议携带雨具。', duplicateAttachmentIdentityCase, duplicateAttachmentIdentityPrompt),
  false,
  '剩余附件 identity 场景不得接受无关天气回复',
);
const coreConversationRelevanceSamples = [
  {
    testCase: {
      id: 'BETA-CHAT-002',
      module: '核心内测',
      submodule: '纯会话',
      scenario: '三轮业务数字追问保持上下文、计算一致且不串任务',
      test_data: '首轮给出曝光12000、点击960、报名240；第二轮问点击率和报名转化率；第三轮修改报名为300并重算。',
    },
    prompt: '修正：报名应为300，请重算报名转化率。',
    reply: '已按修正数据重算：曝光 12,000、点击 960、报名 300。\n\n点击率 8%，报名转化率 31.25%。',
  },
  {
    testCase: {
      id: 'BETA-CHAT-003',
      module: '核心内测',
      submodule: '纯会话',
      scenario: '需求信息不足时先问最少必要问题，不直接编造完整交付物',
      test_data: '先只说“帮我做一份下周活动方案”；第二轮补充目标人群、目标、预算和渠道。',
    },
    prompt: '帮我做一份下周活动方案。',
    reply: '活动类型、对象和目标还不明确；跳过默认选项后，我先给出一份通用活动方案，再按预算和渠道调整。',
  },
  {
    testCase: {
      id: 'BETA-CHAT-004',
      module: '核心内测',
      submodule: '纯会话',
      scenario: '缺少成本与收入数据时拒绝编造 ROI，并给出可复核计算方法',
      test_data: '仅给出曝光、点击和报名，第二轮补充成本与预计收入。',
    },
    prompt: '补充：成本2万元，预计收入5万元，请计算ROI并展示过程。',
    reply: 'ROI = (收入 5 万元 - 成本 2 万元) / 成本 2 万元 = 150%，净收益为 3 万元。',
  },
  {
    testCase: {
      id: 'BETA-CHAT-007',
      module: '核心内测',
      submodule: '纯会话',
      scenario: '侧栏选中态、重命名、刷新并重开任务后完整恢复对话，任务归属与选中态不漂移',
      test_data: '两轮简短任务；记录 prompt hash、taskId、transcript hash。',
    },
    prompt: '记住项目代号是Orion。',
    reply: '项目代号 Orion 已经记录在案了，后续涉及项目名称时会继续使用 Orion。',
  },
];
for (const sample of coreConversationRelevanceSamples) {
  if (!replyLooksRelevant(sample.reply, sample.testCase, sample.prompt)) {
    throw new Error(`${sample.testCase.id} 的真实相关回复不得因中文长提示未分词而误判`);
  }
  if (replyLooksRelevant('今天北京天气晴朗，建议携带雨具。', sample.testCase, sample.prompt)) {
    throw new Error(`${sample.testCase.id} 不得把无关天气回复判为相关`);
  }
}
const corePdfCase = {
  id: 'BETA-FILE-001',
  module: '核心内测',
  submodule: '附件与多模态',
  scenario: '上传真实PDF并提炼带页码的关键结论',
  test_data: '带已知页码和锚点内容的PDF fixture。',
};
const corePdfPrompt = '请提炼附件中的三条关键结论，并标注页码。';
const corePdfReply = [
  'QBot PDF Summary 的三条关键信息如下：',
  '1. 文档用途是验证 Agent 能够读取 PDF 附件（第 1 页）。',
  '2. 核心验收包含摘要总结和发现风险（第 1 页）。',
  '3. 输出必须保持产品友好措辞 product-friendly（第 1 页）。',
].join('\n');
assert.equal(replyLooksRelevant(corePdfReply, corePdfCase, corePdfPrompt), true, 'PDF 页码结论不得被通用相关性误判');
assert.equal(caseAwareReplyAssertion(corePdfCase, { prompt: corePdfPrompt }, corePdfReply).ok, true, 'PDF 三条结论必须命中页码和 fixture 锚点');
const observedCollectivePagePdfReply = [
  '这是一份单页测试文档（共 1 页）。',
  '三条关键结论（均位于第 1 页）：',
  '核心目标：验证 Agent 能够读取 PDF 测试文件。',
  '验收要求：需进行摘要总结、发现风险，并保持产品友好表述 product-friendly。',
  '文档标题：QBot PDF Summary。',
].join('\n');
assert.equal(
  caseAwareReplyAssertion(corePdfCase, { prompt: corePdfPrompt }, observedCollectivePagePdfReply).ok,
  true,
  'PDF 三条结论的无歧义统一页码标注不得被误判',
);
const observedStructuredPageColumnPdfReply = [
  'PDF 直接读取未成功，我改用附件识别工具来解析。',
  '附件引用未能通过视觉工具识别，我改用系统工具直接解析该 PDF 内容。',
  '已解析完成。以下是提炼出的关键结论，均位于 第 1 页：',
  '#\t关键结论\t页码',
  '1\t文档主题：QBot PDF Summary，用于验证 QBot/Agent PDF 读取能力。\tP1',
  '2\t核心目标：验证 Agent 能够读取 PDF 测试文件并形成摘要。\tP1',
  '3\t验收标准：识别风险并保持产品友好措辞 product-friendly。\tP1',
].join('\n');
assert.equal(
  caseAwareReplyAssertion(corePdfCase, { prompt: corePdfPrompt }, observedStructuredPageColumnPdfReply).ok,
  true,
  'PDF 页码表格中的三行 P1 必须作为三条独立第 1 页引用',
);
assert.equal(
  caseAwareReplyAssertion(
    corePdfCase,
    { prompt: corePdfPrompt },
    observedStructuredPageColumnPdfReply.replace('3\t验收标准：识别风险并保持产品友好措辞 product-friendly。\tP1', '3\t验收标准：识别风险并保持产品友好措辞 product-friendly。\tP2'),
  ).ok,
  false,
  'PDF 页码表格只有两行 P1 时不得满足三条第 1 页引用合同',
);
const observedStandalonePageHeadingPdfReply = [
  '已读取该 PDF（共 1 页）。文件内容为一行式测试文本，三条关键结论如下：',
  '',
  '第 1 页（全文仅 1 页）',
  '',
  '文件定位：本 PDF 是「QBot PDF Summary」测试样本。',
  '核心目标（Core goal）：验证 Agent 能否读取 PDF 测试样本文件。',
  '验收标准（Acceptance）：需完成摘要提炼、识别风险点，并保持产品友好的表述方式。',
].join('\n');
assert.equal(
  caseAwareReplyAssertion(corePdfCase, { prompt: corePdfPrompt }, observedStandalonePageHeadingPdfReply).ok,
  true,
  'PDF 三条结论引导语后的独立第 1 页范围标题必须统一绑定后续列表',
);
const observedFilenameIdentityPdfReply = [
  '这份 PDF 名为 qbot-pdf-summary.pdf，全文仅 1 页，是一份简短的“PDF 摘要”测试文档。',
  '核心目标 —— 验证 Agent 的 PDF 读取能力（第 1 页）。',
  '验收标准 —— 需输出摘要并识别风险（第 1 页）。',
  '输出应保持产品友好表述 product-friendly（第 1 页）。',
].join('\n');
assert.equal(
  caseAwareReplyAssertion(corePdfCase, { prompt: corePdfPrompt }, observedFilenameIdentityPdfReply).ok,
  true,
  '精确冻结文件名与全部内容锚点并存时必须识别为 QBot PDF Summary fixture',
);
assert.equal(
  caseAwareReplyAssertion(
    corePdfCase,
    { prompt: corePdfPrompt },
    '附件名是 qbot-pdf-summary.pdf。三条结论分别在第 1 页、第 1 页、第 1 页。',
  ).ok,
  false,
  '只回显冻结文件名和页码、但缺少内容锚点时不得通过 PDF 硬 Oracle',
);
const negatedStandalonePageHeadingPdfReply = [
  'QBot PDF Summary 的三条关键结论如下：',
  '第 1 页不包含以下三条结论',
  '验证 Agent 能够读取 PDF 附件。',
  '核心验收包含摘要总结和发现风险。',
  '输出必须保持产品友好措辞 product-friendly。',
].join('\n');
assert.equal(
  caseAwareReplyAssertion(corePdfCase, { prompt: corePdfPrompt }, negatedStandalonePageHeadingPdfReply).ok,
  false,
  '独立页码标题不得放行带否定文案的范围绑定',
);
const splitPagePdfReply = [
  'QBot PDF Summary 的三条关键信息如下，但不都在第 1 页：',
  '1. 验证 Agent 能够读取 PDF 附件（第 1 页）。',
  '2. 核心验收包含摘要总结和发现风险（第 2 页，不在第 1 页）。',
  '3. 输出必须保持产品友好措辞 product-friendly（第 3 页，不在第 1 页）。',
].join('\n');
assert.equal(
  caseAwareReplyAssertion(corePdfCase, { prompt: corePdfPrompt }, splitPagePdfReply).ok,
  false,
  'PDF 统一页码规则不得接受否定绑定或分散页码',
);
assert.equal(caseAwareReplyAssertion(corePdfCase, { prompt: corePdfPrompt }, 'PDF 第 1 页没有可总结内容。').ok, false, '只有页码但没有三条 fixture 事实不得通过 PDF 硬 Oracle');
assert.equal(replyLooksRelevant('今天北京天气晴朗，建议携带雨具。', corePdfCase, corePdfPrompt), false, 'PDF Case 不得接受无关天气回复');

const coreTableCase = {
  id: 'BETA-FILE-004',
  module: '核心内测',
  submodule: '附件与多模态',
  scenario: '比较CSV与XLSX中的差异并精确计算汇总值',
  test_data: '两份结构化数据含三处已知差异和可复核总计。',
};
const coreTablePrompt = '比较两个表格，列出所有差异并计算各自总计。';
const coreTableReply = [
  '三处数值差异如下：',
  '报名人数：CSV 100，XLSX 120。',
  '到场人数：CSV 70，XLSX 80。',
  '成交单数：CSV 12，XLSX 15。',
  'CSV 总计 182；XLSX 总计 215。',
].join('\n');
assert.equal(replyLooksRelevant(coreTableReply, coreTableCase, coreTablePrompt), true, '表格差异与总计回复不得被通用相关性误判');
assert.equal(caseAwareReplyAssertion(coreTableCase, { prompt: coreTablePrompt }, coreTableReply).ok, true, '表格 Case 必须精确校验三处差异和双方总计');
const observedCoreTableReply = [
  '两个表格都已读取成功，对比结果如下：',
  '数据对比',
  '指标\t报名人数\t到场人数\t成交单数\t各表总计',
  'qbot-table.csv\t100\t70\t12\t182',
  'qbot-data-table-diff.xlsx\t120\t80\t15\t215',
  '差异（xlsx - csv）\t+20\t+10\t+3\t+33',
  '报名人数：120 - 100 = +20；到场人数：80 - 70 = +10；成交单数：15 - 12 = +3。',
  'qbot-table.csv 总计：100 + 70 + 12 = 182',
  'qbot-data-table-diff.xlsx 总计：120 + 80 + 15 = 215',
].join('\n');
assert.equal(
  caseAwareReplyAssertion(coreTableCase, { prompt: coreTablePrompt }, observedCoreTableReply).ok,
  true,
  '表格 Case 应接受文件标签绑定的表格行及算式总计，不得被跨段固定字符窗口误判',
);
const observedHeaderScopedCoreTableReply = [
  'CSV（qbot-table.csv）vs XLSX（qbot-data-table-diff.xlsx）',
  '指标\tCSV\tXLSX\t差异（XLSX - CSV）',
  '报名人数\t100\t120\t+20',
  '到场人数\t70\t80\t+10',
  '成交单数\t12\t15\t+3',
  '表格\t总计（三项之和）',
  'CSV\t182',
  'XLSX\t215',
].join('\n');
assert.equal(
  caseAwareReplyAssertion(coreTableCase, { prompt: coreTablePrompt }, observedHeaderScopedCoreTableReply).ok,
  true,
  '表格 Case 应接受总计表头约束的连续 CSV/XLSX 文件行，不得只识别第一条数据行',
);
assert.equal(caseAwareReplyAssertion(
  coreTableCase,
  { prompt: coreTablePrompt },
  observedHeaderScopedCoreTableReply.replace('CSV\t182\nXLSX\t215', 'CSV\t215\nXLSX\t182'),
).ok, false, '总计表头约束的连续文件行交换总计时不得形成通过');
const observedVerificationScopedCoreTableReply = [
  '两表内容',
  '指标\tqbot-table.csv\tqbot-data-table-diff.xlsx',
  '报名人数\t100\t120',
  '到场人数\t70\t80',
  '成交单数\t12\t15',
  '差异明细（xlsx - csv）',
  '报名人数\t+20\t+20.0%',
  '到场人数\t+10\t+14.3%',
  '成交单数\t+3\t+25.0%',
  '各自总计',
  '表格\t合计',
  'qbot-table.csv\t182（100 + 70 + 12）',
  'qbot-data-table-diff.xlsx\t215（120 + 80 + 15）',
].join('\n');
assert.equal(
  caseAwareReplyAssertion(coreTableCase, { prompt: coreTablePrompt }, observedVerificationScopedCoreTableReply).ok,
  true,
  '表格 Case 应接受总计列单元格先展示总计、再用括号列出验算因子的真实回复',
);
assert.equal(caseAwareReplyAssertion(
  coreTableCase,
  { prompt: coreTablePrompt },
  observedVerificationScopedCoreTableReply
    .replace('182（100 + 70 + 12）', '215（100 + 70 + 12）')
    .replace('215（120 + 80 + 15）', '182（120 + 80 + 15）'),
).ok, false, '总计列单元格即使附带验算因子，交换双方展示总计仍不得形成通过');
const observedInlineScopedCoreTableReply = [
  '指标\tqbot-table.csv\tqbot-data-table-diff.xlsx\t差异',
  '报名人数\t100\t120\t+20',
  '到场人数\t70\t80\t+10',
  '成交单数\t12\t15\t+3',
  '总计：CSV = 182，XLSX = 215，XLSX 高出 33。',
].join('\n');
assert.equal(
  caseAwareReplyAssertion(coreTableCase, { prompt: coreTablePrompt }, observedInlineScopedCoreTableReply).ok,
  true,
  '表格 Case 应接受行首总计上下文中同一行分别绑定 CSV/XLSX 的真实回复',
);
assert.equal(caseAwareReplyAssertion(
  coreTableCase,
  { prompt: coreTablePrompt },
  observedInlineScopedCoreTableReply.replace('CSV = 182，XLSX = 215', 'CSV = 215，XLSX = 182'),
).ok, false, '行首总计上下文中交换 CSV/XLSX 总计时不得形成通过');
const observedColumnScopedCoreTableReply = [
  '表格对比（CSV vs Excel）',
  '指标\tCSV（qbot-table.csv）\tExcel（qbot-data-table-diff.xlsx）\t差异',
  '报名人数\t100\t120\t+20',
  '到场人数\t70\t80\t+10',
  '成交单数\t12\t15\t+3',
  '总计\t182\t215\t+33',
].join('\n');
assert.equal(
  caseAwareReplyAssertion(coreTableCase, { prompt: coreTablePrompt }, observedColumnScopedCoreTableReply).ok,
  true,
  '表格 Case 应接受表头绑定 CSV/Excel 列、后续总计行按同一列归属的真实回复',
);
assert.equal(caseAwareReplyAssertion(
  coreTableCase,
  { prompt: coreTablePrompt },
  observedColumnScopedCoreTableReply.replace('总计\t182\t215\t+33', '总计\t215\t182\t+33'),
).ok, false, '表头列身份约束下交换 CSV/Excel 总计时不得形成通过');
const observedPipeColumnScopedCoreTableReply = observedColumnScopedCoreTableReply
  .split('\n')
  .map((line) => (line.includes('\t') ? `| ${line.split('\t').join(' | ')} |` : line))
  .join('\n');
assert.equal(
  caseAwareReplyAssertion(coreTableCase, { prompt: coreTablePrompt }, observedPipeColumnScopedCoreTableReply).ok,
  true,
  '表格 Case 应接受 Markdown pipe 表头列身份约束的总计行',
);
const aliasedCoreTableReply = [
  '表 A（qbot-table.csv）包含报名人数 100、到场人数 70、成交单数 12。',
  '表 B（qbot-data-table-diff.xlsx）包含报名人数 120、到场人数 80、成交单数 15。',
  '报名人数：100→120；到场人数：70→80；成交单数：12→15。',
  '表 A 总计：100 + 70 + 12 = 182',
  '表 B 总计：120 + 80 + 15 = 215',
].join('\n');
assert.equal(
  caseAwareReplyAssertion(coreTableCase, { prompt: coreTablePrompt }, aliasedCoreTableReply).ok,
  true,
  '表格 Case 应接受文件名先绑定唯一表别名、再以该别名标注双方总计的真实回复',
);
const observedNarrativeAliasedCoreTableReply = [
  'CSV 已读取（86 字节）。再读取对比用的另一个表格（xlsx）。',
  '两个表格都已读取完毕。',
  '指标\t表格 A（qbot-table.csv）\t表格 B（qbot-data-table-diff.xlsx）\t差异',
  '报名人数\t100\t120\t+20',
  '到场人数\t70\t80\t+10',
  '成交单数\t12\t15\t+3',
  '表格 A 总计：182（100 + 70 + 12）',
  '表格 B 总计：215（120 + 80 + 15）',
  '差异总计：+33',
  '表格 B（xlsx）在每个指标上都高于表格 A（csv）。',
].join('\n');
assert.equal(
  caseAwareReplyAssertion(coreTableCase, { prompt: coreTablePrompt }, observedNarrativeAliasedCoreTableReply).ok,
  true,
  '表格 Case 应允许结论段用短文件身份重述双方别名，不得污染先前的总计归属',
);
assert.equal(caseAwareReplyAssertion(
  coreTableCase,
  { prompt: coreTablePrompt },
  observedNarrativeAliasedCoreTableReply
    .replace('表格 A 总计：182', '表格 A 总计：215')
    .replace('表格 B 总计：215', '表格 B 总计：182'),
).ok, false, '结论段重述双方别名时仍不得接受交换的总计');
const observedNumericAliasedCoreTableReply = [
  '指标\t表1 (qbot-table.csv)\t表2 (qbot-data-table-diff.xlsx)\t差异\t变化幅度',
  '报名人数\t100\t120\t+20\t+20%',
  '到场人数\t70\t80\t+10\t+14.3%',
  '成交单数\t12\t15\t+3\t+25%',
  '合计：表1 = 182，表2 = 215',
].join('\n');
assert.equal(
  caseAwareReplyAssertion(coreTableCase, { prompt: coreTablePrompt }, observedNumericAliasedCoreTableReply).ok,
  true,
  '表格 Case 应接受本轮真实回复中由文件名唯一绑定的表1/表2及行首合计表达',
);
assert.equal(caseAwareReplyAssertion(
  coreTableCase,
  { prompt: coreTablePrompt },
  [
    '指标\t表1 (qbot-table.csv)\t表2 (qbot-data-table-diff.xlsx)',
    '报名人数\t100\t120；到场人数\t70\t80；成交单数\t12\t15',
    '合计：表1 = 215，表2 = 182',
  ].join('\n'),
).ok, false, '数字表别名的总计交换时不得形成通过');
const observedChineseAliasedCoreTableReply = [
  '指标\t表格一（qbot-table.csv）\t表格二（qbot-data-table-diff.xlsx）\t差异（表二 − 表一）',
  '报名人数\t100\t120\t+20',
  '到场人数\t70\t80\t+10',
  '成交单数\t12\t15\t+3',
  '各自总计',
  '表格一总计：100 + 70 + 12 = 182',
  '表格二总计：120 + 80 + 15 = 215',
].join('\n');
assert.equal(
  caseAwareReplyAssertion(coreTableCase, { prompt: coreTablePrompt }, observedChineseAliasedCoreTableReply).ok,
  true,
  '表格 Case 应接受文件名唯一绑定的表格一/表格二中文别名总计表达',
);
assert.equal(caseAwareReplyAssertion(
  coreTableCase,
  { prompt: coreTablePrompt },
  observedChineseAliasedCoreTableReply
    .replace('表格一总计：100 + 70 + 12 = 182', '表格一总计：100 + 70 + 12 = 215')
    .replace('表格二总计：120 + 80 + 15 = 215', '表格二总计：120 + 80 + 15 = 182'),
).ok, false, '中文表别名绑定下交换双方总计时不得形成通过');
assert.equal(caseAwareReplyAssertion(
  coreTableCase,
  { prompt: coreTablePrompt },
  [
    '报名人数：100→120；到场人数：70→80；成交单数：12→15。',
    '合计：表1 = 182，表2 = 215',
  ].join('\n'),
).ok, false, '数字表别名未与文件身份绑定时不得形成通过');
assert.equal(caseAwareReplyAssertion(
  coreTableCase,
  { prompt: coreTablePrompt },
  [
    '表 A（qbot-table.csv）和表 A（qbot-data-table-diff.xlsx）用于本次比较。',
    '报名人数：100→120；到场人数：70→80；成交单数：12→15。',
    '表 A 总计 182；表 A 总计 215。',
  ].join('\n'),
).ok, false, '同一表别名绑定双方文件时属于歧义，不得用散落的两个总计形成通过');
assert.equal(caseAwareReplyAssertion(
  coreTableCase,
  { prompt: coreTablePrompt },
  '两个表格数值完全一致，报名100、到场70、成交12，CSV 总计182，XLSX 总计182。',
).ok, false, '数值相同的旧通用 fixture 不得通过三处差异硬 Oracle');
assert.equal(caseAwareReplyAssertion(
  coreTableCase,
  { prompt: coreTablePrompt },
  [
    '报名人数：CSV 100，XLSX 120；到场人数：CSV 70，XLSX 80；成交单数：CSV 12，XLSX 15。',
    'CSV 总计 215；XLSX 总计 182。',
    '其它说明中散落出现数字 182 和 215，但它们没有绑定正确文件。',
  ].join('\n'),
).ok, false, '双方总计交换或数字只在其它段落散落时不得通过表格硬 Oracle');
assert.equal(replyLooksRelevant('今天北京天气晴朗，建议携带雨具。', coreTableCase, coreTablePrompt), false, '表格 Case 不得接受无关天气回复');

const generalWorkbookBytes = fs.readFileSync(path.join(root, 'testflies', 'qbot-data-table.xlsx')).toString('utf8');
const comparisonWorkbookBytes = fs.readFileSync(path.join(root, 'testflies', 'qbot-data-table-diff.xlsx')).toString('utf8');
for (const value of ['100', '70', '12']) {
  assert.match(generalWorkbookBytes, new RegExp(`<v>${value}</v>`), '通用 XLSX fixture 必须保持原有 100/70/12 数据');
}
for (const value of ['120', '80', '15']) {
  assert.match(comparisonWorkbookBytes, new RegExp(`<v>${value}</v>`), '差异 XLSX fixture 必须包含 120/80/15 三个新值');
}
if (attachmentReplyMissingEvidence(
  '附件读取完成：qbot-pdf-summary.pdf，读取成功。下面是主要内容和结论摘要。如需分析其它文件，请重新上传。',
  ['/tmp/qbot-pdf-summary.pdf'],
)) {
  throw new Error('已明确读取成功的附件回复不应因条件式“请重新上传其它文件”误判失败');
}
if (attachmentReplyMissingEvidence(
  observedStructuredPageColumnPdfReply,
  ['/tmp/qbot-pdf-summary.pdf'],
)) {
  throw new Error('附件适配器中途失败但随后成功解析真实内容时不得误判为附件未收到');
}
if (!attachmentReplyMissingEvidence(
  '我没有收到附件，请重新上传该 PDF。',
  ['/tmp/qbot-pdf-summary.pdf'],
)) {
  throw new Error('真正未收到附件且要求重传时必须判失败');
}
if (!attachmentReplyMissingEvidence(
  '未成功读取附件内容，请重新上传该 PDF。',
  ['/tmp/qbot-pdf-summary.pdf'],
)) {
  throw new Error('明确未成功读取附件内容时必须判失败');
}

const attachment066 = {
  id: 'SIT-HOME-066',
  kind: 'attachment',
  scenario: '多文件跨材料分析应逐文件引用事实并给出统一结论',
  test_data: '上传 qbot-requirement.md 和 qbot-data.json；分别总结每个文件的关键事实，再给出统一的验收风险清单；每条结论标注来源文件名。',
};
const expectedAttachmentTask = '分别总结每个文件的关键事实，再给出统一的验收风险清单；每条结论标注来源文件名。';
if (attachmentTaskPromptFromCase(attachment066) !== expectedAttachmentTask) {
  throw new Error(`附件 Case 未保留 Excel 真实任务：${attachmentTaskPromptFromCase(attachment066)}`);
}
const attachmentTurns = buildConversationTurns(attachment066, ['/tmp/qbot-requirement.md', '/tmp/qbot-data.json']);
if (attachmentTurns.length !== 1 || !attachmentTurns[0].prompt.startsWith(expectedAttachmentTask) || /Word、Excel、PDF/.test(attachmentTurns[0].prompt)) {
  throw new Error(`附件 Case 被通用提示覆盖：${JSON.stringify(attachmentTurns)}`);
}
const goodGroundedThreeSentence = caseAwareReplyAssertion({ id: 'SIT-HOME-063' }, { label: '第一轮' }, '结论：报名240人、到场170人，到场率约70.8%。风险：现有投诉28件，需进一步核实具体环节。下一步：按渠道排查报名到到场链路并跟进投诉原因。');
if (!goodGroundedThreeSentence.applicable || !goodGroundedThreeSentence.ok) throw new Error(`HOME-063 合法三句被误判：${JSON.stringify(goodGroundedThreeSentence)}`);
const unsupportedThreeSentence = caseAwareReplyAssertion({ id: 'SIT-HOME-063' }, { label: '第一轮' }, '结论：报名240人、到场170人。风险：投诉28件集中在到场后。下一步：排查现场服务。');
if (unsupportedThreeSentence.ok) throw new Error('HOME-063 不得放过未提供的“投诉集中在到场后”归因');

const fidelityOk = sentPromptFidelity({
  ...attachment066,
  artifacts: { sent_prompts: [{ prompt: `${expectedAttachmentTask}\n\n我已经上传了相关附件，请先读取附件内容再回答；如果某个附件无法读取，请直接说明。` }] },
});
if (!fidelityOk.checked || !fidelityOk.ok) throw new Error(`附件 prompt fidelity 应通过：${JSON.stringify(fidelityOk)}`);
const fidelityBad = sentPromptFidelity({
  ...attachment066,
  artifacts: { sent_prompts: [{ prompt: '请读取我上传的 Word、Excel、PDF 或 PPT 文件，分别概括每个文件的主要内容。' }] },
});
if (fidelityBad.ok) throw new Error('通用附件提示不得通过 prompt fidelity 审核');

const unicodeTemp = fs.mkdtempSync(path.join(os.tmpdir(), 'qbot-json-unicode-'));
const unicodeFile = path.join(unicodeTemp, 'progress.json');
writeJsonFile(unicodeFile, { broken: `left${String.fromCharCode(0xD800)}right`, emoji: '😀' });
const unicodeText = fs.readFileSync(unicodeFile, 'utf8');
const unicodeParsed = JSON.parse(unicodeText);
if (unicodeParsed.broken !== 'left�right' || unicodeParsed.emoji !== '😀' || replaceUnpairedSurrogates('😀') !== '😀') {
  throw new Error('进度 JSON Unicode 清洗破坏有效字符或未替换孤立 surrogate');
}
fs.rmSync(unicodeTemp, { recursive: true, force: true });
if (rawArtifactEventLeakEvidence('成果已生成，请在成果区查看。')) throw new Error('用户可读的成果描述不应判为内部泄漏');
if (!rawArtifactEventLeakEvidence('{"kind":"artifact","artifact":{"path":"a.md"}}')) throw new Error('序列化成果事件应被识别');

const promptBoundReply = latestAssistantReplyForPrompt({
  messages: [
    { role: 'user', text: '旧问题' },
    { role: 'assistant', text: '旧回复' },
    { role: 'user', text: '报名人数是多少？' },
    { role: 'assistant', text: '报名人数是 100 人。' },
  ],
}, '报名人数是多少？');
if (promptBoundReply !== '报名人数是 100 人。') throw new Error(`回复必须按本轮用户消息绑定，实际=${promptBoundReply}`);
const orionTerminalReply = terminalPromptBoundReplyEvidence({
  activeTaskId: 'task-orion',
  userTexts: ['记住项目代号是Orion。', '项目代号是什么？'],
  messages: [
    { role: 'user', text: '记住项目代号是Orion。' },
    { role: 'assistant', text: '已记住项目代号。' },
    { role: 'user', text: '项目代号是什么？' },
    { role: 'assistant', text: '项目代号是 Orion。' },
  ],
}, '项目代号是什么？', { boundTaskId: 'task-orion' });
assert.equal(orionTerminalReply.reply_present, true, '同 taskId/prompt 后的短回复必须在 no_reply 前被复核命中');
assert.equal(orionTerminalReply.delta_text, '项目代号是 Orion。');
assert.equal(
  replyLooksRelevant(
    '项目代号是 Orion。',
    { id: 'BETA-CHAT-007', scenario: '侧栏刷新后完整恢复两轮对话' },
    '项目代号是什么？',
  ),
  true,
  '已命中项目代号确定性规则的短回复不得被通用长度门槛误判',
);
assert.equal(
  replyLooksRelevant(
    '不知道。',
    { id: 'BETA-CHAT-007', scenario: '侧栏刷新后完整恢复两轮对话' },
    '项目代号是什么？',
  ),
  false,
  '放宽短回复采集后仍必须拒绝未命中业务答案的短文本',
);
assert.equal(
  terminalPromptBoundReplyEvidence({
    activeTaskId: '',
    userTexts: ['项目代号是什么？'],
    messages: [
      { role: 'user', text: '项目代号是什么？' },
      { role: 'assistant', text: '项目代号是 Orion。' },
    ],
  }, '项目代号是什么？', { boundTaskId: 'task-orion' }).reply_present,
  false,
  '缺少当前 taskId 时不得用可见文本冒充任务绑定回复',
);
assert.equal(
  terminalPromptBoundReplyEvidence({
    activeTaskId: 'task-orion',
    bodyText: '项目代号是 Orion。',
    userTexts: ['其他问题'],
    messages: [{ role: 'user', text: '其他问题' }],
  }, '项目代号是什么？', { boundTaskId: 'task-orion' }).reply_present,
  false,
  '缺少结构化 prompt 绑定时不得用整页文本冒充助手回复',
);
const inlineSkillPromptBoundReply = latestAssistantReplyForPrompt({
  messages: [
    {
      role: 'user',
      text: '请 QA Node Runtime Skill 不可用 结合已选的两个技能，完成一次联合处理并分别说明两项能力的作用。 QA Python Runtime Skill 不可用',
    },
    { role: 'assistant', text: '两个 Fixture 都已成功执行，并分别验证了 Node 与 Python 运行时。' },
  ],
}, '请结合已选的两个技能，完成一次联合处理并分别说明两项能力的作用。');
if (!/Node 与 Python/.test(inlineSkillPromptBoundReply)) {
  throw new Error(`内联技能 chip 文本不得破坏本轮回复归属，实际=${inlineSkillPromptBoundReply}`);
}
if (isSuccessfulSendStep({ action: '输入删除一个附件后发送', status: 'passed' })) throw new Error('输入动作名称包含“发送”时不能计为真实发送');
if (!isSuccessfulSendStep({ action: '发送删除附件后的问题', status: 'passed' })) throw new Error('明确以“发送”开头的动作应计为真实发送');
if (isSuccessfulSendStep({ action: '发送组合能力会话前最终输入一致性复核', status: 'passed' })) throw new Error('发送前审计动作不能计为真实发送');

const userReviewTemp = fs.mkdtempSync(path.join(os.tmpdir(), 'qbot-user-review-'));
try {
  const bugShot = path.join(userReviewTemp, 'connector-008-no-retry.png');
  const passShot = path.join(userReviewTemp, 'skill-after-delete.png');
  const cancelDeleteShot = path.join(userReviewTemp, 'skill-after-cancel-delete.png');
  const confirmDeleteShot = path.join(userReviewTemp, 'skill-after-confirm-delete.png');
  const sidebarMenuShot = path.join(userReviewTemp, 'home-048-session-context-menu.png');
  const modelShot = path.join(userReviewTemp, 'model-tier-m3-selected.png');
  fs.writeFileSync(bugShot, 'png');
  fs.writeFileSync(passShot, 'png');
  fs.writeFileSync(cancelDeleteShot, 'png');
  fs.writeFileSync(confirmDeleteShot, 'png');
  fs.writeFileSync(sidebarMenuShot, 'png');
  fs.writeFileSync(modelShot, 'png');
  const bugResult = {
    id: 'SIT-CONN-008',
    status: 'failed',
    result_category: 'bug',
    title: '不可达连接器应允许用户重试',
    steps: [{ action: '进入连接器页面并查看不可达连接器', status: 'passed' }],
    assertions: [{ name: '不可达连接器重试入口', expected: '显示重试连接按钮', actual: '页面显示已接入，且没有重试连接按钮。', status: 'failed', category: 'bug' }],
    screenshots: { connector_008_no_retry: bugShot },
  };
  const bugReview = assessUserCenteredOutcome(bugResult);
  if (bugReview.classification !== 'bug' || bugReview.keyScreenshot !== bugShot
    || !/用户操作：/.test(bugReview.description) || !/用户影响：/.test(bugReview.description)) {
    throw new Error(`用户视角 Bug 四项门槛判定错误：${JSON.stringify(bugReview)}`);
  }
  const mismatchedBug = assessUserCenteredOutcome({ ...bugResult, screenshots: { model_tier_m3: modelShot } });
  if (mismatchedBug.classification !== 'needs_review' || mismatchedBug.gates.aligned_outcome_screenshot) {
    throw new Error('描述与截图不匹配时不得进入可信 Bug');
  }
  const passResult = {
    id: 'SIT-SKILL-003',
    status: 'passed',
    result_category: 'pass',
    title: '取消删除后技能保留',
    steps: [{ action: '点击删除并取消确认', status: 'passed' }],
    assertions: [{ name: '取消删除后技能保留', expected: '目标技能仍在列表中', actual: '取消后目标技能仍在列表中。', status: 'passed', category: 'pass' }],
    screenshots: { after_delete: passShot },
  };
  const passReview = assessUserCenteredOutcome(passResult);
  if (passReview.classification !== 'pass' || passReview.keyScreenshot !== passShot) throw new Error('可信通过必须满足用户动作、结果和匹配截图');
  const structuredPassReview = assessUserCenteredOutcome({
    ...passResult,
    assertions: [{ name: '结果只写入目录 A', expected: 'A 有一份、B 没有', actual: 'A_exists=true；B_exists=false；copies=1', status: 'passed', category: 'pass' }],
  });
  if (structuredPassReview.classification !== 'pass' || !structuredPassReview.gates.user_visible_observation) {
    throw new Error('同 Case 操作后截图与通过断言互证时，结构化计数/状态也应成为可信产品观察');
  }
  const hostReopenBug = assessUserCenteredOutcome({
    id: 'SIT-TEAMS-NEW-002',
    status: 'failed',
    result_category: 'bug',
    title: '任务执行中关闭 Teams 页面后重新进入应看到原任务最终状态',
    steps: [{ action: '关闭并重新进入 Teams 内嵌 QBot 页面', status: 'passed' }],
    assertions: [{ name: '重开后的任务终态', expected: '同一任务恢复运行中或最终状态', actual: '同一任务重开后变为空闲空任务。', status: 'failed', category: 'bug' }],
    screenshots: { teams_new_002_after_reopen_terminal: bugShot },
  });
  if (hostReopenBug.classification !== 'bug' || !hostReopenBug.gates.conversation_evidence) {
    throw new Error('宿主重开/任务状态用例应由同 Case 终态断言和结果截图形成可信结论，不应强制要求回复文本证据');
  }
  const sidebarMenuPass = assessUserCenteredOutcome({
    id: 'SIT-HOME-048',
    status: 'passed',
    result_category: 'pass',
    title: '右键会话应显示重命名和删除菜单',
    steps: [
      { action: '发送侧栏测试会话', status: 'passed' },
      { action: '右键目标会话', status: 'passed' },
    ],
    assertions: [{ name: '右键会话菜单完整', expected: '显示重命名和删除', actual: '重命名\n删除', status: 'passed', category: 'pass' }],
    screenshots: { home_048_session_context_menu: sidebarMenuShot },
  });
  if (sidebarMenuPass.classification !== 'pass' || !sidebarMenuPass.gates.conversation_evidence) {
    throw new Error('侧栏菜单/重命名/删除等纯 UI 终态用例不应因准备会话时发送过消息而强制要求 transcript');
  }
  const semanticScreenshotReview = assessUserCenteredOutcome({
    id: 'SIT-SKILL-003',
    status: 'passed',
    result_category: 'pass',
    title: '已安装技能删除应二次确认并从列表移除',
    steps: [{ action: '确认删除目标技能', status: 'passed' }],
    assertions: [{ name: '确认删除结果', expected: '确认后从已安装移除', actual: '技能已删除。', status: 'passed', category: 'pass' }],
    screenshots: { after_cancel_delete: cancelDeleteShot, after_confirm_delete: confirmDeleteShot },
  });
  if (semanticScreenshotReview.keyScreenshot !== confirmDeleteShot) throw new Error('主截图必须优先选择与最终用户结果语义一致的确认删除截图');
  const unresolvedPass = assessUserCenteredOutcome(passResult, {
    intendedClassification: 'pass',
    reviewReason: '核心动作完成，但仍需确认错误提示是否会暴露内部文案。',
    productObservation: '界面显示了可重试的失败结果。',
  });
  if (unresolvedPass.classification !== 'needs_review' || unresolvedPass.gates.no_unresolved_failure) throw new Error('存在未解决用户疑问时不得列为可信通过');
  const rawErrorPass = assessUserCenteredOutcome({
    ...passResult,
    actual_result: '安装失败：SkillHub 下载失败 HTTP 503: {"error":"controlled download failure"}',
  });
  if (rawErrorPass.classification !== 'needs_review' || rawErrorPass.gates.no_user_experience_concern) throw new Error('界面暴露原始 HTTP/JSON 或内部测试错误时不得列为可信通过');
  const overrideReview = assessUserCenteredOutcome(bugResult, {
    intendedClassification: 'bug',
    reviewReason: '用户界面显示原始 HTTP 错误。',
    productObservation: '安装失败提示展示 HTTP 503 和原始 JSON。',
    userOperationOverride: '用户安装技能时依赖下载失败。',
    expectedOutcomeOverride: '界面用普通语言说明失败原因。',
    userImpactOverride: '普通用户无法理解原始技术错误。',
  });
  if (overrideReview.userOperation !== '用户安装技能时依赖下载失败。'
    || overrideReview.expected !== '界面用普通语言说明失败原因。'
    || overrideReview.impact !== '普通用户无法理解原始技术错误。') {
    throw new Error('人工目视复核后的用户操作、预期和影响必须覆盖技术化 case 文案');
  }
  const technicalOnlyPass = assessUserCenteredOutcome({
    id: 'TECH-ONLY',
    status: 'passed',
    result_category: 'pass',
    steps: [{ action: '切换模型档位：M3', status: 'passed' }],
    assertions: [{ name: '模型档位', expected: 'M3', actual: 'M3', status: 'passed' }],
    screenshots: { model_tier_m3: modelShot },
  });
  if (technicalOnlyPass.classification !== 'needs_review') throw new Error('只有技术前置的 raw passed 不得升级为可信通过');
  const automationReview = assessUserCenteredOutcome({
    ...bugResult,
    result_category: 'automation_error',
    assertions: [{ name: 'selector 定位', expected: '可点击', actual: 'selector not found', status: 'failed', category: 'automation_error' }],
  });
  if (automationReview.classification !== 'framework_issue') throw new Error('自动化错误不得冒充产品 Bug');

  const runtimeMaintenanceWithNormalCdpSkill = assessUserCenteredOutcome({
    id: 'BETA-CHAT-001',
    status: 'failed',
    result_category: 'bug',
    title: '运行时维护按钮真实点击后显示失败但工作台仍可用',
    steps: [
      { action: '点击【新建任务】', status: 'passed' },
      {
        action: 'preparePythonRuntimes 真实 UI 操作与终态采样',
        status: 'failed',
        category: 'bug',
        actual: 'action_observed=true；terminal=true；ready=false；loaded=true；sdk_ready=true；composer_ready=true；workbench_ready=true；capabilities_readable=true；skills=[{"slug":"cdp-label","name":"CDP Label"}]',
      },
    ],
    assertions: [{
      name: 'preparePythonRuntimes 稳定终态',
      expected: '维护区、SDK 状态、输入区与公开 capabilities 必须连续稳定就绪。',
      actual: '{"ready":false,"pending":false,"failed":true,"loaded":true,"sdk_ready":true,"composer_ready":true,"workbench_ready":true,"capabilities_readable":true,"skills":[{"slug":"cdp-label"}]}',
      status: 'failed',
      category: 'bug',
    }],
    screenshots: { assistant_prepare_python_runtimes_terminal: modelShot },
  });
  if (runtimeMaintenanceWithNormalCdpSkill.classification !== 'bug') {
    throw new Error('正常能力 slug cdp-label 不得被宽泛 CDP 关键词误判为框架问题');
  }

  const genuineCdpFailure = assessUserCenteredOutcome({
    id: 'CDP-FAILURE',
    status: 'failed',
    result_category: 'bug',
    title: '页面读取失败',
    steps: [{ action: '读取页面', status: 'failed', category: 'bug', actual: 'CDP Runtime.evaluate 超时' }],
    assertions: [{ name: '公开状态', expected: '可读取', actual: 'CDP Runtime.evaluate timeout', status: 'failed', category: 'bug' }],
    screenshots: { assistant_prepare_python_runtimes_terminal: modelShot },
  });
  if (genuineCdpFailure.classification !== 'framework_issue') {
    throw new Error('真实 CDP Runtime.evaluate 超时仍必须归类为框架问题');
  }
} finally {
  fs.rmSync(userReviewTemp, { recursive: true, force: true });
}

const scrollFollowPass = streamingScrollFollowVerdict([
  { generating: true, scrollHeight: 1600, clientHeight: 700, distanceBottom: 12 },
  { generating: true, scrollHeight: 2100, clientHeight: 700, distanceBottom: 24 },
]);
if (scrollFollowPass.reproduced || !scrollFollowPass.overflowObserved) throw new Error('#793 正常跟随样本判定错误');
const scrollFollowFailure = streamingScrollFollowVerdict([
  { generating: true, scrollHeight: 1600, clientHeight: 700, distanceBottom: 260 },
  { generating: true, scrollHeight: 2100, clientHeight: 700, distanceBottom: 780 },
]);
if (!scrollFollowFailure.reproduced || scrollFollowFailure.maxDistanceBottom !== 780) throw new Error('#793 连续漂移样本未识别');
const performanceMetricsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'qbot-performance-metrics-'));
try {
  const samplesFile = path.join(performanceMetricsDir, 'thread-scroll-samples.json');
  const samples = [
    { elapsedMs: 1000, generating: true, scrollHeight: 1600, clientHeight: 700, distanceBottom: 12 },
    { elapsedMs: 2000, generating: true, scrollHeight: 2100, clientHeight: 700, distanceBottom: 24 },
  ];
  writeJsonFile(samplesFile, { issue: 793, samples, verdict: scrollFollowPass });
  const metrics = streamingScrollPerformanceMetrics({
    testCaseId: 'BETA-PERF-003',
    samplesFile,
    samples,
    verdict: scrollFollowPass,
    everGenerating: true,
  });
  const metricsFile = path.join(performanceMetricsDir, 'performance-metrics.json');
  writeJsonFile(metricsFile, metrics);
  assert.equal(validateEvidenceFile('performance_metrics', metricsFile).valid, true, '#793 性能指标应满足正式证据 schema');
  const manifest = buildCoreEvidenceManifest({
    testCase: { id: 'BETA-PERF-003', evidence_roles: ['performance_metrics'] },
    caseDir: performanceMetricsDir,
    artifacts: { performance_metrics: metricsFile },
  });
  assert.equal(manifest.complete, true, '#793 performance_metrics 映射后 manifest 必须完整');
  const legacyDriverMetrics = streamingScrollPerformanceMetrics({
    testCaseId: coreBetaEvidenceCaseId({
      id: 'SIT-ISSUE-793',
      core_beta_case_id: 'BETA-PERF-003',
    }),
    samplesFile,
    samples,
    verdict: scrollFollowPass,
    everGenerating: true,
  });
  assert.equal(
    legacyDriverMetrics.case_id,
    'BETA-PERF-003',
    '#793 legacy driver 复用时性能证据必须绑定 Core Beta 叶子合同身份',
  );
  writeJsonFile(metricsFile, legacyDriverMetrics);
  const legacyDriverManifest = buildCoreEvidenceManifest({
    testCase: { id: 'BETA-PERF-003', evidence_roles: ['performance_metrics'] },
    caseDir: performanceMetricsDir,
    artifacts: { performance_metrics: metricsFile },
  });
  assert.equal(
    legacyDriverManifest.complete,
    true,
    '#793 legacy driver 生成的 performance_metrics 必须通过叶子合同 manifest',
  );
  const wrongCaseManifest = buildCoreEvidenceManifest({
    testCase: { id: 'SIT-ISSUE-793', evidence_roles: ['performance_metrics'] },
    caseDir: performanceMetricsDir,
    artifacts: { performance_metrics: metricsFile },
  });
  assert.deepEqual(wrongCaseManifest.invalid_roles, ['performance_metrics'], '#793 性能指标不得跨 Case 复用');
  writeJsonFile(metricsFile, { ...metrics, source_samples_sha256: '0'.repeat(64) });
  assert.equal(validateEvidenceFile('performance_metrics', metricsFile).valid, false, '#793 性能指标不得接受错误样本 SHA');
} finally {
  fs.rmSync(performanceMetricsDir, { recursive: true, force: true });
}
if (!modelServiceStateEvidence('模型服务暂时不可达，请稍后再试').unavailable) throw new Error('#800 暂时不可达文案未识别');
if (!modelServiceStateEvidence('抱歉，当前无法连接模型服务，请连接公司 VPN 后重试。').unavailable) throw new Error('#800 VPN 引导文案未识别');
if (modelServiceStateEvidence('模型已正常完成回答。').unavailable) throw new Error('#800 正常回复不应误判不可达');

const upstreamServer = http.createServer((req, res) => {
  if (req.url?.startsWith('/api/capabilities')) {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({
      connectors: [{ key: 'qa-connector', label: 'QA Connector', statusKind: 'ready', statusLabel: '可用' }],
      connectorRouting: {
        mode: 'auto',
        explicitConnectorIds: [],
        effectiveConnectorIds: ['qa-connector'],
        unavailableRequiredConnectors: [],
      },
    }));
    return;
  }
  if (req.url?.startsWith('/api/skills/catalog')) {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ installed: [{ slug: 'qa-installed', name: 'QA Installed' }], market: [{ slug: 'qa-market' }] }));
    return;
  }
  if (req.url?.startsWith('/api/experts/catalog')) {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ recommended: [{ id: 'expert-1' }], all: [{ id: 'expert-1' }], categories: [{ id: 'all' }] }));
    return;
  }
  if (req.url?.startsWith('/api/connectors/catalog')) {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ connectors: [{ key: 'connector-1' }], builtinTools: [{ key: 'qbot_web' }] }));
    return;
  }
  res.writeHead(404, { 'content-type': 'application/json' });
  res.end('{}');
});
await new Promise((resolve, reject) => {
  upstreamServer.once('error', reject);
  upstreamServer.listen(0, '127.0.0.1', resolve);
});
const upstreamPort = upstreamServer.address().port;
const proxy = await createControlPlaneFaultProxy({
  upstreamUrl: `http://127.0.0.1:${upstreamPort}`,
  rules: [
    { id: 'fixed', method: 'POST', pathExact: '/api/fixed', mode: 'fixed-response', status: 200, body: { ok: false, msg: '受控失败' } },
    { id: 'network', method: 'GET', pathExact: '/api/network-error', mode: 'network-error', errorMessage: '受控网络错误' },
    { id: 'transform', method: 'GET', pathPrefix: '/api/capabilities', mode: 'transform-json', transform: 'connector-needs-auth', connectorKey: 'qa-connector' },
    { id: 'skills-empty', method: 'GET', pathPrefix: '/api/skills/catalog', mode: 'transform-json', transform: 'skills-empty-installed' },
    { id: 'experts-empty', method: 'GET', pathPrefix: '/api/experts/catalog', mode: 'transform-json', transform: 'experts-empty-market' },
    { id: 'connectors-empty', method: 'GET', pathPrefix: '/api/connectors/catalog', mode: 'transform-json', transform: 'connectors-empty-catalog' },
    { id: 'observe', method: 'GET', pathExact: '/api/observed', mode: 'observe' },
  ],
});
const proxyPort = new URL(proxy.url).port;
const readJson = (requestPath, { method = 'GET', body = '' } = {}) => new Promise((resolve, reject) => {
  const request = http.request({ hostname: '127.0.0.1', port: proxyPort, path: requestPath, method }, (response) => {
    const chunks = [];
    response.on('data', (chunk) => chunks.push(chunk));
    response.on('end', () => {
      try { resolve({ status: response.statusCode, body: JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}') }); } catch (error) { reject(error); }
    });
  });
  request.on('error', reject);
  if (body) request.write(body);
  request.end();
});
try {
  proxy.arm();
  const fixed = await readJson('/api/fixed', { method: 'POST', body: '{"name":"qa"}' });
  if (fixed.body.ok !== false || fixed.body.msg !== '受控失败') throw new Error('控制面代理固定响应注入失败');
  const transformed = await readJson('/api/capabilities?draftTask=1');
  if (transformed.body.connectors?.[0]?.statusKind !== 'needs_auth') throw new Error('控制面代理 JSON 转换注入失败');
  if (transformed.body.connectorRouting?.mode !== 'manual'
    || !transformed.body.connectorRouting?.explicitConnectorIds?.includes('qa-connector')
    || transformed.body.connectorRouting?.effectiveConnectorIds?.includes('qa-connector')
    || transformed.body.connectorRouting?.unavailableRequiredConnectors?.[0]?.statusKind !== 'needs_auth') {
    throw new Error('控制面代理未同步更新连接器路由状态');
  }
  const emptySkills = await readJson('/api/skills/catalog');
  if (emptySkills.body.installed?.length !== 0 || emptySkills.body.market?.length !== 1) throw new Error('技能已安装空态转换错误');
  const emptyExperts = await readJson('/api/experts/catalog');
  if (emptyExperts.body.recommended?.length !== 0 || emptyExperts.body.all?.length !== 0 || emptyExperts.body.categories?.length !== 0) throw new Error('专家市场空态转换错误');
  const emptyConnectors = await readJson('/api/connectors/catalog');
  if (emptyConnectors.body.connectors?.length !== 0 || emptyConnectors.body.builtinTools?.[0]?.key !== 'qbot_web') throw new Error('连接器目录空态转换错误');
  const networkError = await readJson('/api/network-error');
  if (networkError.status !== 503 || !networkError.body.error.includes('受控网络错误')) throw new Error('控制面代理网络错误注入失败');
  await readJson('/api/observed');
  if (proxy.state.hits.length !== 7 || !proxy.state.hits.find((item) => item.id === 'fixed')?.requestBody.includes('qa')) {
    throw new Error('控制面代理证据采集失败');
  }
} finally {
  await proxy.close();
  await new Promise((resolve) => upstreamServer.close(resolve));
}

const connectorFixtureServer = await createConnectorRegressionServer();
try {
  const readiness = await probeConnectorRegressionFixture(connectorFixtureServer);
  if (!readiness.ok || !readiness.catalog || !readiness.healthy || !readiness.unreachable) {
    throw new Error(`连接器 Fixture runner-side readiness 探测失败：${JSON.stringify(readiness)}`);
  }
  const catalog = await fetch(`${connectorFixtureServer.url}/api/openapi/servers?detail=true`).then((response) => response.json());
  const servers = catalog?.data?.servers || [];
  if (!servers.find((item) => item.name === 'dev_healthy' && item.status === 'connected')) throw new Error('连接器 Fixture 缺少 healthy 条目');
  if (servers.find((item) => item.name === 'dev_healthy')?.runtimeInvocation?.authorization) throw new Error('dev_healthy Fixture 不应依赖 OAuth token');
  if (!servers.find((item) => item.name === 'dev_unreachable')) throw new Error('连接器 Fixture 缺少 unreachable 条目');
  if (!servers.find((item) => item.name === 'dev_needs_auth' && item.status === 'oauth_required')) throw new Error('连接器 Fixture 缺少 needs_auth 条目');
  const healthyProbe = await fetch(`${connectorFixtureServer.url}/mcp/healthy`, { method: 'POST', body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-03-26' } }) });
  const toolsList = await fetch(`${connectorFixtureServer.url}/mcp/healthy`, { method: 'POST', body: JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} }) }).then((response) => response.json());
  const toolCall = await fetch(`${connectorFixtureServer.url}/mcp/healthy`, { method: 'POST', body: JSON.stringify({ jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'dev_healthy_tool', arguments: {} } }) }).then((response) => response.json());
  const unreachableProbe = await fetch(`${connectorFixtureServer.url}/mcp/unreachable`, { method: 'POST', body: '{}' });
  if (healthyProbe.status !== 200 || unreachableProbe.status !== 503 || toolsList?.result?.tools?.[0]?.name !== 'dev_healthy_tool' || toolCall?.result?.isError !== false) {
    throw new Error('连接器 Fixture 健康探测或真实工具调用终态错误');
  }
} finally {
  await connectorFixtureServer.close();
}

const documentFixtureServer = await createConnectorRegressionServer({ includeDocumentFixture: true });
try {
  const catalog = await fetch(`${documentFixtureServer.url}/api/openapi/servers?detail=true`).then((response) => response.json());
  const documentServer = catalog?.data?.servers?.find((item) => item.name === 'teams_doc_fixture');
  if (documentServer?.status !== 'connected' || documentServer?.tools?.[0]?.name !== 'teams_document_read') {
    throw new Error(`Teams 文档 Fixture 目录错误：${JSON.stringify(documentServer)}`);
  }
  const allowed = await fetch(`${documentFixtureServer.url}/mcp/documents`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 11, method: 'tools/call', params: { name: 'teams_document_read', arguments: { document_id: 'allowed-doc-a' } } }),
  }).then((response) => response.json());
  const denied = await fetch(`${documentFixtureServer.url}/mcp/documents`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 12, method: 'tools/call', params: { name: 'teams_document_read', arguments: { document_id: 'denied-doc-b' } } }),
  }).then((response) => response.json());
  const calls = documentFixtureServer.state.hits.filter((item) => item.rpcMethod === 'tools/call');
  if (!allowed?.result?.content?.[0]?.text?.includes('TEAMS_DOC_ALLOWED_20260716')
    || denied?.result?.isError !== true
    || !denied?.result?.content?.[0]?.text?.includes('无权限')
    || calls.length !== 2
    || calls[0]?.rpcParams?.arguments?.document_id !== 'allowed-doc-a'
    || calls[1]?.rpcParams?.arguments?.document_id !== 'denied-doc-b') {
    throw new Error(`Teams 文档 Fixture 权限闭环错误：allowed=${JSON.stringify(allowed)} denied=${JSON.stringify(denied)} calls=${JSON.stringify(calls)}`);
  }
} finally {
  await documentFixtureServer.close();
}

const skillStateRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'qbot-skill-state-'));
try {
  const emptyLocal = new DatabaseSync(path.join(skillStateRoot, 'local.db'));
  emptyLocal.exec('CREATE TABLE installed_skills (name TEXT PRIMARY KEY, slug TEXT, runtime_name TEXT, readiness_status TEXT, next_action TEXT, install_status TEXT, updated_at INTEGER)');
  emptyLocal.close();
  const hashedPath = path.join(skillStateRoot, 'qbot-dev-fixture.db');
  const hashed = new DatabaseSync(hashedPath);
  hashed.exec('CREATE TABLE installed_skills (name TEXT PRIMARY KEY, slug TEXT, runtime_name TEXT, readiness_status TEXT, next_action TEXT, install_status TEXT, updated_at INTEGER)');
  hashed.prepare('INSERT INTO installed_skills(name, slug, runtime_name, readiness_status) VALUES (?, ?, ?, ?)')
    .run('skillhub__global__qa-uninstall-rejected', 'qa-uninstall-rejected', 'skillhub__global__qa-uninstall-rejected', 'projected_for_both');
  hashed.close();
  const seeded = seedLocalSkillReadiness(skillStateRoot, 'qa-uninstall-rejected', 'runtime_projection_failed');
  if (!seeded.ok || seeded.dbPath !== hashedPath) throw new Error(`技能状态库候选选择错误：${JSON.stringify(seeded)}`);
  const readback = new DatabaseSync(hashedPath, { readOnly: true });
  const readiness = readback.prepare('SELECT readiness_status, next_action FROM installed_skills WHERE slug=?').get('qa-uninstall-rejected');
  readback.close();
  if (readiness?.readiness_status !== 'runtime_projection_failed' || readiness?.next_action !== 'retry_projection') {
    throw new Error(`技能未就绪状态写入错误：${JSON.stringify(readiness)}`);
  }
} finally {
  fs.rmSync(skillStateRoot, { recursive: true, force: true });
}

const fixtureSmokeRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'qbot-skillhub-fixture-'));
const fixtureServer = await createSkillHubRegressionServer(fixtureSmokeRoot);
try {
  const discovery = await fetch(`${fixtureServer.url}/api/web/skills?q=&page=0&size=100`).then((response) => response.json());
  if (discovery?.data?.items?.length !== 21 || discovery?.data?.total !== 21) throw new Error('SkillHub Fixture discovery 未返回完整 21 条分页数据');
  const discoveryBySlug = new Map(discovery.data.items.map((item) => [item.slug, item]));
  if (discoveryBySlug.get('qa-install-rejected-visible')?.installStatus !== 'rejected'
    || discoveryBySlug.get('qa-auto-declared')?.resolutionMode !== 'AUTO_DECLARED'
    || discoveryBySlug.get('qa-materialization-pending')?.materializationStatus !== 'pending') {
    throw new Error(`SkillHub Fixture 状态元数据不完整：${JSON.stringify(Object.fromEntries(discoveryBySlug))}`);
  }
  const rootVersion = await fetch(`${fixtureServer.url}/api/v1/skills/global/qa-dep-root-success/versions/1.0.0`).then((response) => response.json());
  const dependencies = rootVersion?.data?.parsedMetadataJson?.dependencies?.map((item) => item.slug);
  if (JSON.stringify(dependencies) !== JSON.stringify(['qa-dep-leaf-a', 'qa-dep-leaf-b'])) {
    throw new Error(`SkillHub Fixture 版本依赖元数据错误：${JSON.stringify(dependencies)}`);
  }
  const archiveResponse = await fetch(`${fixtureServer.url}/api/v1/skills/global/qa-runtime-retryable/versions/1.0.0/download`);
  const archiveMagic = Buffer.from(await archiveResponse.arrayBuffer()).subarray(0, 2).toString('utf8');
  if (!archiveResponse.ok || archiveMagic !== 'PK') throw new Error('SkillHub Fixture ZIP 下载不可用');
  const failedDownload = await fetch(`${fixtureServer.url}/api/v1/skills/global/qa-dep-leaf-failure/versions/1.0.0/download`);
  if (failedDownload.status !== 503) throw new Error(`SkillHub 受控下载失败未返回 503：${failedDownload.status}`);
  const pythonFiles = await fetch(`${fixtureServer.url}/api/v1/skills/global/qa-python-runtime/versions/1.0.0/files`).then((response) => response.json());
  if (!pythonFiles?.data?.files?.some((item) => item.filePath === 'run.py')) throw new Error('Python Runtime Fixture 缺少 run.py 元数据');
  const nodeFiles = await fetch(`${fixtureServer.url}/api/v1/skills/global/qa-node-runtime/versions/1.0.0/files`).then((response) => response.json());
  if (!nodeFiles?.data?.files?.some((item) => item.filePath === 'package.json') || !nodeFiles?.data?.files?.some((item) => item.filePath === 'run.js')) {
    throw new Error('Node Runtime Fixture 缺少 package.json/run.js 元数据');
  }
  const rollbackV1 = await fetch(`${fixtureServer.url}/api/v1/skills/global/qa-version-rollback/resolve?version=1.0.0`).then((response) => response.json());
  if (rollbackV1?.data?.version !== '1.0.0') throw new Error('版本回退 Fixture 无法显式解析 1.0.0');
  fixtureServer.setActiveVersion('qa-version-rollback', '2.0.0');
  const rollbackV2 = await fetch(`${fixtureServer.url}/api/v1/skills/global/qa-version-rollback/resolve`).then((response) => response.json());
  if (rollbackV2?.data?.version !== '2.0.0' || !String(rollbackV2?.data?.downloadUrl || '').endsWith('/versions/2.0.0/download')) {
    throw new Error('版本回退 Fixture 切换后未解析到 2.0.0');
  }
  const rollbackArchive = await fetch(`${fixtureServer.url}/api/v1/skills/global/qa-version-rollback/versions/2.0.0/download`);
  if (!rollbackArchive.ok || Buffer.from(await rollbackArchive.arrayBuffer()).subarray(0, 2).toString('utf8') !== 'PK') {
    throw new Error('版本回退 Fixture 2.0.0 ZIP 不可用');
  }
} finally {
  await fixtureServer.close();
  fs.rmSync(fixtureSmokeRoot, { recursive: true, force: true });
}

console.log('framework invariants ok');
