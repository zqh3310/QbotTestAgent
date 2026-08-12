import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import {
  activateCoreBetaNativeImeHost,
  assistantConfirmationSurfaceVerdict,
  applyBlockedOutcome,
  attachmentReplyMissingEvidence,
  attachmentTaskPromptFromCase,
  assessUserCenteredOutcome,
  brokenAttachmentFabricationEvidence,
  buildCredibilityReview,
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
  coreBetaBatchTaskMarker,
  coreBetaBatchStopReason,
  coreBetaAttachmentFixtureContractVerdict,
  coreBetaAttachmentRejectionMatrixVerdict,
  coreBetaAttachmentRejectionProbeVerdict,
  coreBetaCleanupCapabilitiesNeedsRetry,
  coreBetaCapabilitiesReadbackWithRetry,
  coreBetaCleanupReadbackNeedsComposerRecovery,
  coreBetaCleanupReadbackVerdict,
  coreBetaCleanupReleaseMigrationVerdict,
  coreBetaCapabilityInteractionCategory,
  coreBetaComposerHistoryVerdict,
  coreBetaComposerResetFailureCategory,
  coreBetaCompletionBlockReason,
  coreBetaConnectorCatalogEvidenceValid,
  coreBetaConnectorOptionTestId,
  coreBetaConversationTurnLabel,
  coreBetaExpertBuilderOutcomeEvidence,
  coreBetaExpertPublishPrerequisiteBlocker,
  coreBetaExpertSummonTaskVerdict,
  coreBetaExecutionConcurrencyPolicy,
  coreBetaEvidenceCaseId,
  coreBetaInitializationContinuation,
  managedAttachmentDialogEvidenceVerdict,
  coreBetaMarkdownHtmlPreviewVerdict,
  coreBetaManualConnectorModeReady,
  coreBetaMixedFormatFixtureContents,
  coreBetaMcpCrossSurfaceOutcome,
  coreBetaMcpCrossSurfaceReceiptEvidenceValid,
  coreBetaMcpReleaseSelectionSeed,
  coreBetaMcpSelectionPrerequisiteBlocker,
  coreBetaModelMenuExpectedSnapshot,
  coreBetaModelMenuSdkFilterVerdict,
  coreBetaPartialReplyReady,
  coreBetaPreSendCapabilityFailureEvidence,
  coreBetaPreSendImeFailureEvidence,
  coreBetaNativeImeTraceVerdict,
  coreBetaStopGenerationTimeoutVerdict,
  coreBetaRuntimeExecutorBinding,
  coreBetaRuntimeFamilyPrerequisiteBlocker,
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
  coreBetaV2RuntimeUpdateSkipAction,
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
  selectManagedRuntimeProcess,
  singleHostPipelineEligibility,
  seedLocalSkillReadiness,
  seedCoreBetaRunOwnedSkillCleanupLedger,
  sendReceiptEvidence,
  sentPromptFidelity,
  streamingScrollFollowVerdict,
  streamingScrollPerformanceMetrics,
  stopRemainderWithoutSynthetic,
  terminalPromptBoundReplyEvidence,
  uninstallCoreBetaRunOwnedSkillTargets,
  unifiedConnectorModeApplied,
  unifiedSkillModeApplied,
  withReplyPollHardTimeout,
  webSearchQualityVerdict,
  validateProductionCasePlan,
  validateCoreBetaArtifactOracle,
  qworkDailyEvidenceEnvelope,
} from '../src/lib/ui-agent-casebook-runner-v2.mjs';
import {
  buildCoreEvidenceManifest,
  coreBetaAttachmentFixtureNames,
  validateEvidenceFile,
} from '../src/lib/core-beta-case-protocol.mjs';
import { replaceUnpairedSurrogates, writeJsonFile } from '../src/lib/fs.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const runner = fs.readFileSync(path.join(root, 'src', 'lib', 'ui-agent-casebook-runner-v2.mjs'), 'utf8');
const projectMemory = fs.readFileSync(path.join(root, 'AGENTS.md'), 'utf8');
const automationFramework = fs.readFileSync(path.join(root, 'QBOT_AUTOMATION_FRAMEWORK.md'), 'utf8');
const coreBetaOperatingGuide = fs.readFileSync(path.join(root, 'QBOT_CORE_BETA_AGENT_OPERATING_GUIDE.md'), 'utf8');
const electronRestartHelper = fs.readFileSync(path.join(root, 'scripts', 'restart-qbot-electron-control-plane.sh'), 'utf8');
const skillHubRestartHelper = fs.readFileSync(path.join(root, 'scripts', 'restart-qbot-skillhub-control-plane.sh'), 'utf8');
const connectorFixtureRestartHelper = fs.readFileSync(path.join(root, 'scripts', 'restart-qbot-connector-fixture-control-plane.sh'), 'utf8');
const capabilityFixtureRestartHelper = fs.readFileSync(path.join(root, 'scripts', 'restart-qbot-capability-fixture-control-plane.sh'), 'utf8');
const qworkDailyCasebookBuilder = fs.readFileSync(path.join(root, 'scripts', 'build-qwork-daily-regression-casebook.mjs'), 'utf8');
const productionGrayCasebookBuilder = fs.readFileSync(path.join(root, 'scripts', 'build-release01-production-gray-casebook.mjs'), 'utf8');
const skillHubFixtureManifest = JSON.parse(fs.readFileSync(path.join(root, 'testfixtures', 'skillhub-regression', 'manifest.json'), 'utf8'));
const coreGateCasebook = JSON.parse(fs.readFileSync(
  path.join(root, 'PRD', 'QBot核心上线门禁用例_Teams-QWork_2026-07-22_框架修复版.json'),
  'utf8',
));

const coreGateIds = coreGateCasebook.cases.map((item) => item.id);

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
  /git\(\['cat-file', '-e', `\$\{PRODUCT_COMMIT\}\^\{commit\}`\]\)/,
  '160 Casebook 生成器必须验证冻结设计提交存在，不能要求移动中的 origin ref 永远等于旧提交',
);
assert.doesNotMatch(
  coreBetaOperatingGuide,
  /mktemp[^\n]*XXXXXX\.[^\s"')]+/,
  'Core Beta 操作指南不得重新引入 macOS 不兼容的 mktemp 后缀',
);
assert.match(
  qworkDailyCasebookBuilder,
  /\['QW-ENTRY-002', 'QWD-ENTRY-002'\][\s\S]*row\.id === 'QW-ENTRY-002'[\s\S]*\['BETA-INIT-004', CUSTOM_LEAF\.get\(row\.id\)\]/,
  'QW-ENTRY-002 必须使用独立QWD入口driver，禁止重新映射到依赖deep_use账本的BETA-SKILL-011',
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
    manual_draft: { id: 'delivery-draft', etag: 'delivery-etag' },
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
      'claude-code_draft': { id: 'research-draft', etag: 'research-etag' },
      codex_draft: { id: 'data-draft' },
      manual_draft: { id: 'delivery-draft', etag: 'delivery-etag' },
    },
    publicState: emptyExpertPublishState,
  }).outcome,
  'automation_error',
  '本轮草稿账本条目存在但 draftId/etag 残缺时必须 fail-closed',
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
  safeNativeAttachmentInfoDialog({
    message: '确定删除全部会话吗？',
    buttons: ['确定'],
  }),
  false,
  'Core Beta v2 不得把破坏性单按钮弹窗当作附件信息弹窗',
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
assert.equal(
  coreBetaCapabilityInteractionCategory({ controlLocated: false, clickDispatched: false }),
  'automation_error',
  '未定位或未点击真实控件属于框架错误',
);
assert.equal(
  coreBetaCapabilityInteractionCategory({
    controlLocated: true,
    clickDispatched: true,
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
    const blockerFile = path.join(evidenceDir, 'daily-pre-send-capability-failure.json');
    writeJsonFile(blockerFile, dailyFailure);
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
    dailyArtifacts.core_beta_not_applicable_roles = dailyFailure.not_applicable_roles.map((role) => ({
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
assert.match(
  runner,
  /BETA-EXPERT-001[\s\S]*set_expert_result[\s\S]*coreBetaCapabilitiesReadbackWithRetry[\s\S]*capabilities_readback_attempts/,
  'BETA-EXPERT-001 必须把一次性 setExpert 与可重试 capabilities 读回分离并保存账本',
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
  }),
  false,
  '当前输入区已经可见时不得通过再次导航隐藏真实能力残留',
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
  const driftOut = path.join(runOwnedSkillCleanupRoot, 'cleanup-drift');
  const migrationOut = path.join(runOwnedSkillCleanupRoot, 'cleanup-release-migration');
  const wrongCaseOut = path.join(runOwnedSkillCleanupRoot, 'cleanup-wrong-case');
  const casebook = path.join(runOwnedSkillCleanupRoot, 'casebook.xlsx');
  for (const directory of [sourceOut, currentOut, driftOut, migrationOut, wrongCaseOut]) {
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
  assert.equal(
    fs.readFileSync(path.join(currentOut, 'core-beta-suite-ledger.json'), 'utf8'),
    fs.readFileSync(path.join(sourceOut, 'core-beta-suite-ledger.json'), 'utf8'),
    '清理批次必须原样导入冻结 suite ledger，不能改写目标 identity',
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
  /QBot生产灰度与全量功能回归Casebook_160条_2026-08-11\.xlsx[\s\S]*--expected-count 70[\s\S]*只接受 `READY`[\s\S]*--sheet 全量功能回归Case[\s\S]*--expected-count 160/,
  '当前操作指南必须把同一正式Casebook的70条门禁和160条全量回归分别绑定READY预检',
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
assert.equal(
  (coreBetaOperatingGuide.match(/--native-ime-command "<(?:managed-native-ime-command|same-command-from-ready-pretest)>"/g) || []).length,
  2,
  '70 条指南必须把通过 probe 的同一 native IME command 传给 runner',
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
  /未证明产品失败后的公开工作台可安全继续/,
  'BETA-INIT-001 缺少任一公开可用性信号时仍必须停止',
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
  /初始化执行门禁/,
  '发布身份与运行时基础初始化失败必须停止后续 Core Beta Case',
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
assert.match(
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
  /初始化执行门禁/,
  '初始化失败后公开工作台不可用或证据不足时必须停止',
);
assert.match(
  coreBetaBatchStopReason(
    { id: 'BETA-INIT-003', case_type: 'run_initialization', contract_version: 'qbot-core-beta/v2' },
    {
      status: 'failed',
      result_category: 'automation_error',
      initialization_continuation: safeInitializationContinuation,
    },
  ),
  /框架硬门禁/,
  '初始化 automation_error 即使页面看似可用也必须停止',
);
assert.match(
  coreBetaBatchStopReason(
    { id: 'BETA-CHAT-001', case_type: 'conversation', contract_version: 'qbot-core-beta/v2' },
    { status: 'failed', result_category: 'automation_error' },
  ),
  /框架硬门禁/,
  'manifest/取证/执行 automation_error 必须冻结批次',
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
assert.match(
  coreBetaBatchStopReason(
    { id: 'BETA-SKILL-012', case_type: 'skill_lifecycle', contract_version: 'qbot-core-beta/v2' },
    maskedAutomationError,
  ),
  /框架硬门禁/,
  '顶层被错误写成 blocked 时，停批判断仍必须扫描断言并识别框架错误',
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
  },
});
assert.equal(stoppedSummary.status, 'stopped', 'framework stop 不能被已完成 Case 的 passed 覆盖');
assert.equal(stoppedSummary.stopped, true, 'framework stop 必须传播到最终 summary');
assert.equal(stoppedSummary.counts.total, 1, '停止 Case 不得伪造为 completed');
assert.equal(stoppedSummary.result_accounting.planned, 55, 'summary 必须保留完整计划总数');
assert.equal(stoppedSummary.result_accounting.unexecuted, 54, 'summary 必须明确未完成 Case 数');
assert.equal(stoppedSummary.stopped_case_id, 'BETA-INIT-002');
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
  '新版 QWork 更新提示必须允许精确点击“稍后”以保持冻结发布身份',
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
assert.match(
  runner,
  /async function openCoreBetaV2SystemSettings[\s\S]*initialSettings = await waitForOpenSettingsMaintenance\(\)[\s\S]*ensureSidebarExpanded/,
  'Core Beta v2 必须先等待已打开的系统设置加载，不能把加载态误判成个人设置入口缺失',
);
assert.match(
  runner,
  /async function dismissCoreBetaV2SettingsObstruction[\s\S]*skill-operation-feedback[\s\S]*关闭操作提示[\s\S]*state: 'hidden'[\s\S]*openCoreBetaV2SystemSettings[\s\S]*dismissCoreBetaV2SettingsObstruction/,
  'Core Beta v2 必须先关闭遮挡设置入口的终态技能提示，并确认提示确实消失',
);
assert.match(
  runner,
  /async function dismissCoreBetaV2RuntimeUpdateObstruction[\s\S]*runtime-update-ready-toast[\s\S]*statuses = page\.locator\('\[role="status"\]'\)[\s\S]*coreBetaV2RuntimeUpdateSkipAction\(candidateText, candidateButtonText\)[\s\S]*skip\.click\(\{ timeout: 5000 \}\)[\s\S]*state: 'hidden'[\s\S]*runtime-update-prompt-skip/,
  'Core Beta v2 必须用真实“稍后/跳过更新”按钮关闭版本更新遮挡，并保存前后证据',
);
assert.match(
  runner,
  /if \(await visible\(dedicatedToast, 500\)\)[\s\S]*else \{[\s\S]*statuses = page\.locator\('\[role="status"\]'\)[\s\S]*if \(!coreBetaV2RuntimeUpdateSkipAction\(candidateText, candidateButtonText\)\) continue;[\s\S]*if \(!toast\) \{[\s\S]*observed: false, ok: true/,
  '系统设置中的非阻塞版本状态没有安全跳过按钮时不得冒充遮挡弹窗；专用更新 toast 仍须 fail-closed',
);
assert.match(
  runner,
  /async function dismissCoreBetaV2SettingsObstruction[\s\S]*dismissCoreBetaV2RuntimeUpdateObstruction[\s\S]*async function openCoreBetaV2SystemSettings/,
  '进入系统设置前必须再次检查异步晚到的 QWork 更新提示',
);
assert.match(
  runner,
  /async function dismissBlockingOverlays[\s\S]*dismissCoreBetaV2RuntimeUpdateObstruction[\s\S]*无法安全跳过 QWork 版本更新提示/,
  '每条 Case 开始时必须处理版本更新提示，未知或无法关闭时 fail-closed',
);
assert.match(
  runner,
  /assistant-config-view[\s\S]*menu\.scrollIntoViewIfNeeded[\s\S]*menu\.click\(\{ timeout: 5000 \}\)[\s\S]*nav-settings/,
  'Core Beta v2 必须兼容直接进入设置与旧版个人设置子菜单，并禁止 force 点击被遮挡入口',
);
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
  '证据完整的真实产品失败可以进入 completed，供 trusted_bug 复核',
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
    '20 条 taskId、发送回执、待回复池和逐任务终态证据完整时，产品 Oracle 失败仍可进入 completed 供 trusted_bug 复核',
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
  'Core Beta synthetic 结果不得进入 completed',
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
  'manifest complete=false 或 invalid_roles 非空不得进入 completed',
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
  /coreBetaBatchStopReason\(batchCase, result\)[\s\S]*stopRemainderWithoutSynthetic/,
  'pipeline 路径必须与串行路径一致，在完整 automation_error 进入 completed 后立即硬停止',
);
assert.match(
  runner,
  /function stopRemainderWithoutSynthetic(?=[\s\S]*framework-stop-diagnostic\.json)(?=[\s\S]*synthetic: false)/,
  'Core Beta 硬停止必须保留诊断且不得批量生成 synthetic completed',
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
  /暂不支持\|附件类型\|上传失败[\s\S]{0,1200}\^\(\?:OK\|确定\|知道了/,
  '全局弹窗清理必须覆盖不支持附件提示，并明确确认 OK/确定/知道了按钮',
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
  /executeCasebookCase[\s\S]{0,500}dismissAllBlockingOverlays\(page, state\)[\s\S]{0,120}clearUi\(page\)[\s\S]{0,120}dismissAllBlockingOverlays\(page, state\)/,
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
assert.equal(caseAwareReplyAssertion(
  pipelineCase('SIT-HOME-064'),
  { prompt: '输出固定四列三行 Markdown 表格。', label: '第一轮' },
  '事项\t负责人\t截止日期\t状态\n核对报名数据\t张三\t7月18日\t进行中\n复核短信到达率\t李四\t7月19日\t未开始\n提交复盘\t王五\t7月20日\t未开始',
).ok, true, 'Markdown 表格判定应接受 QWork 渲染后 DOM 的四列制表符文本');

assert.equal(webSearchQualityVerdict(
  '1. 更新 A（2026-07-20）：https://openai.com/news/update-a\n2. 更新 B（2026-07-18）：https://openai.com/index/update-b',
  '网页搜索 qbot_web 已完成',
).ok, true, 'Web 搜索质量门禁应接受带官方链接、日期和真实工具证据的回复');
assert.equal(webSearchQualityVerdict(
  '最近更新很多，但这里不提供来源。',
  '',
).ok, false, 'Web 搜索质量门禁不得接受无来源、无日期、无工具证据的模型自述');
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
} finally {
  fs.rmSync(stopTimeoutEvidenceDir, { recursive: true, force: true });
}

const required = [
  ['逐次发送前模型校验', /async function send[\s\S]*ensureModelTier\(page, state, state\.case_dir[\s\S]*model_tier_before_send[\s\S]*const selectors/],
  ['模型复核后恢复并精确校验真实发送文本', /async function send[\s\S]*prompt_fidelity_before_send[\s\S]*restored[\s\S]*检测到输入区仍是旧草稿/],
  ['发送必须确认产品回执且第三次仅在安全条件下回退键盘 Enter', /(?=[\s\S]*async function send)(?=[\s\S]*attempt <= 3)(?=[\s\S]*composer-keyboard-enter)(?=[\s\S]*waitForSendReceipt)(?=[\s\S]*sendRetryIsSafe)(?=[\s\S]*未被产品接收)/],
  ['contenteditable 使用 fill 同步受控草稿状态', /async function fillComposer[\s\S]*editable[\s\S]*await input\.fill\(text\)[\s\S]*输入区文本与期望不一致/],
  ['可信度审计使用逐次发送前证据', /preSendTierChecks[\s\S]*successfulSendCount[\s\S]*preSendTierChecks\.length < successfulSendCount/],
  ['HOME-007 专项执行', /SIT-HOME-007'[\s\S]*executeSitHomeSkillOnly/],
  ['今日 #793/#800 使用独立本地产品断言', /SIT-ISSUE-793'[\s\S]*executeIssue793StreamingScrollFollow[\s\S]*SIT-ISSUE-800'[\s\S]*executeIssue800ModelServiceStateConsistency/],
  ['#793 生成中采样滚动位置并保存正式性能证据', /(?=[\s\S]*executeIssue793StreamingScrollFollow)(?=[\s\S]*thread-scroll-samples\.json)(?=[\s\S]*performance-metrics\.json)(?=[\s\S]*artifacts\.performance_metrics)(?=[\s\S]*streamingScrollPerformanceMetrics)(?=[\s\S]*issue-793-streaming-scroll-drift)/],
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
  ['Core Beta v2 停止生成观察正文 partial 并读回保留内容', /coreBetaPartialReplyReady[\s\S]*partial-reply-precondition-readback\.json[\s\S]*partial_reply_ready_before_click[\s\S]*await cancel\.click[\s\S]*retained_chars[\s\S]*stop-generation-readback\.json/],
  ['Core Beta v2 停止生成无正文完整超时后写齐失败证据再隔离清理', /(?=[\s\S]*if \(!partial\.ready\))(?=[\s\S]*terminal_outcome: 'timed_out')(?=[\s\S]*writeReplyArtifacts\(state, caseDir)(?=[\s\S]*cancelRunningReplyAfterTimeout)(?=[\s\S]*cleanup_click_is_case_action: false)(?=[\s\S]*超时失败证据完整，隔离清理成功。`?, 'bug'\))/],
  ['runner 控制面代理安装与恢复完整', /createControlPlaneFaultProxy[\s\S]*restart-qbot-electron-control-plane\.sh[\s\S]*installControlPlaneHttpControl[\s\S]*restoreControlPlaneHttpControl/],
  ['控制面代理重启显式传递原 DEEPBANK_HOME', /inferQbotHomeForElectronRestart[\s\S]*\[helper, qbotRoot, controlPlaneUrl, cdpPort, qbotHome\]/],
  ['重启场景异常证据使用最新 runtime page', /catch \(error\) \{[\s\S]*page = runtime\?\.page \|\| page;[\s\S]*99-error/],
  ['连接器 reset 对禁用/自动模式直达且不先切手动', /if \(connectorMode === 'disabled' \|\| connectorMode === 'auto'\)[\s\S]*setConnectorMode\(page, state, caseDir, connectorMode\)[\s\S]*else \{[\s\S]*clearManualConnectorSelections/],
  ['连接器模式切换使用新 DOM 和能力状态轮询', /async function setConnectorMode[\s\S]*const freshLocator = await connectorModeLocator[\s\S]*capabilities\?\.connectorRouting\?\.mode[\s\S]*'automation_error'/],
  ['HOME-025 使用控制面代理可控失败注入', /executeSitHomeFailureRecovery[\s\S]*pathExact: '\/api\/desktop-agent\/turn-context'[\s\S]*mode: 'network-error'[\s\S]*restoreControlPlaneHttpControl/],
  ['HOME-030 真实打开并使用控制面代理 dry-run 快速反馈', /executeSitHomeQuickFeedback[\s\S]*pathExact: '\/api\/feedback-issues\/intake'[\s\S]*composer-feedback[\s\S]*quick-feedback-panel[\s\S]*quick_feedback_dry_run/],
  ['HOME-030 在 Teams 全量 Fixture 中强制使用渲染层代理', /executeSitHomeQuickFeedback[\s\S]*forceRendererAdapter: true[\s\S]*installControlPlaneHttpControl[\s\S]*forceRendererAdapter \|\| options\['renderer-control-adapter'\] === 'teams360'/],
  ['HOME-052 打开并取消原生工作区选择器', /executeSitHomeWorkspacePicker[\s\S]*wspick-trigger[\s\S]*wspick-menu[\s\S]*osascript/],
  ['技能安装等待终态', /waitForSkillInstallTerminal[\s\S]*安装中\|准备中\|物化中\|待物化/],
  ['成果任务使用本轮独立可见工作区', /prepareVisibleQaWorkspace[\s\S]*runDirName[\s\S]*fs\.rmSync\(workspace, \{ recursive: true, force: true \}\)/],
  ['成果预览拒绝受保护路径误判', /artifactPreviewReadable[\s\S]*受保护路径[\s\S]*expectedContent\.test/],
  ['显式 Case timeout 可为全部真实 Agent/工具调用提供十分钟上限', /MAX_REPLY_WAIT_MS = 600000[\s\S]*ATTACHMENT_ARTIFACT_REPLY_WAIT_MS = 600000[\s\S]*LONG_CONTEXT_REPLY_WAIT_MS = 600000[\s\S]*MULTI_TURN_REPLY_WAIT_MS = 600000[\s\S]*SIT-HOME-016[\s\S]*requestedBudget = Number\.isFinite\(requested\)[\s\S]*Math\.max\(MIN_REPLY_WAIT_MS, requestedBudget\)/],
  ['连接器刷新失败注入', /executeSitConnectorRefreshFailure[\s\S]*pathIncludes: '\/api\/connectors\/catalog\?refresh=force'[\s\S]*mode: 'network-error'[\s\S]*restoreControlPlaneHttpControl/],
  ['技能安装中断注入', /executeSitSkillNetworkInterrupt[\s\S]*pathExact: '\/api\/skills\/install'[\s\S]*controlled network interruption[\s\S]*restoreControlPlaneHttpControl/],
  ['已选连接器不健康快照注入', /executeSitConnectorUnhealthySelectedState[\s\S]*pathPrefix: '\/api\/capabilities'[\s\S]*connector-needs-auth[\s\S]*connector_unhealthy_snapshot/],
  ['手动连接器选择不按“手动使用/默认自动”描述误过滤', /selectFirstManualConnector[\s\S]*\.ctool-list \.ctool-opt:not\(\[disabled\]\)[\s\S]*hasNotText: \/不生效\|不可用\|未接入\|无匹配\|暂无连接器\//],
  ['稳定 QA 专家固定名不可见时使用本轮唯一名', /summonFirstExpertForCase[\s\S]*QBot QA 产品运营专家-\$\{new Date\(\)\.toISOString\(\)[\s\S]*findExpertCardByName\(page, expertName\)/],
  ['专家创建成功只认真实专家卡片', /waitForExpertCreateOutcome[\s\S]*Boolean\(await findExpertCardByName\(page, name\)\)/],
  ['纯 UI 用例不强制会话证据', /REPLY_EVIDENCE_OPTIONAL_CASE_IDS[\s\S]*SIT-HOME-050[\s\S]*requiresConversationEvidence = !replyEvidenceOptional/],
  ['有证据缺口的 passed 不误报未知状态', /else if \(reasons\.length\)[\s\S]*自动化证据或执行链路未通过可信度校验/],
  ['HOME-050 搜索前设置唯一标题', /SIT-HOME-050'[\s\S]*自动化搜索-[\s\S]*session-rename-input/],
  ['HOME-056 hover 后点击真实附件移除按钮', /executeSitHomeDeleteOneAttachment[\s\S]*root\.hover[\s\S]*aui-attachment-tile-remove[\s\S]*不点击泛化 button/],
  ['EXPERT-012 hover 后识别最近召唤移除按钮', /executeSitExpertRecentSummon[\s\S]*recentItem\.hover[\s\S]*exp-recent-del/],
  ['SKILL-013 卡片无入口时走个人设置立即对账', /executeSitSkillMaterialization[\s\S]*nav-settings-menu[\s\S]*assistant-reconcile-skills[\s\S]*assistant-reconcile-result/],
  ['SKILL-013 只按唯一 Fixture 标识定位', /executeSitSkillMaterialization[\s\S]*QA Materialization Pending\|qa-materialization-pending[\s\S]*受控 QA SkillHub/],
  ['三张图片用例使用互异真实 PNG', /SIT-HOME-038'[\s\S]*qbot-image-test\.png[\s\S]*qbot-image-flow\.png[\s\S]*qbot-image-risk\.png/],
  ['#668/#669 七条统一进入受控 Fixture 路由', /\^SIT-SKILL-0\(\?:27\|28\|29\|30\|31\|32\|33\)\$[\s\S]*executeSkillRegressionFixtureCase/],
  ['#668 三条 Fixture 内自动化路由完整', /executeSkillRegressionFixtureCase[\s\S]*SIT-SKILL-027'[\s\S]*executeSitSkillRejectedExplicitRetry[\s\S]*SIT-SKILL-028'[\s\S]*executeSitSkillAuditRejectNoAutoRetry[\s\S]*SIT-SKILL-029'[\s\S]*executeSitSkillRejectedUninstallCleanup/],
  ['#669 四条 Fixture 内自动化路由完整', /executeSkillRegressionFixtureCase[\s\S]*SIT-SKILL-030'[\s\S]*executeSitSkillDependencyCascadeSuccess[\s\S]*SIT-SKILL-031'[\s\S]*executeSitSkillDependencyAlreadyInstalled[\s\S]*SIT-SKILL-032'[\s\S]*executeSitSkillDependencyFailureBlocksRoot[\s\S]*SIT-SKILL-033'[\s\S]*executeSitSkillDependencyCycle/],
  ['输入区菜单按类型锚点隔离', /COMPOSER_MENU_ANCHORS[\s\S]*composer-skill-mode-[\s\S]*composer-connector-mode-[\s\S]*composer-safety-level-option-[\s\S]*activeMenuLocator\(page, menuKind[\s\S]*menuKind === 'workMode'[\s\S]*WORK_MODE_LABELS/],
  ['统一加号菜单使用稳定 section testid 与最新可见 Portal', /UNIFIED_COMPOSER_SUBMENUS[\s\S]*section: 'mode'[\s\S]*section: 'skill'[\s\S]*section: 'connector'[\s\S]*lastVisibleLocator[\s\S]*visibleUnifiedComposerSubmenu[\s\S]*composer-plus-section-\$\{config\.section\}/],
  ['统一加号子菜单支持 hover click ArrowRight Enter 四路打开', /openUnifiedComposerSubmenu[\s\S]*\.hover\(\{ force: true \}\)[\s\S]*pointermove[\s\S]*\.click\(\{ force: true \}\)[\s\S]*ArrowRight[\s\S]*Enter/],
  ['手动连接器模式真实点击并读回列表 routing 或 radio', /setUnifiedConnectorMode[\s\S]*composer-connector-mode-manual[\s\S]*manual\.click[\s\S]*composer-plus-list[\s\S]*composer-connector-option-[\s\S]*currentCapabilities[\s\S]*coreBetaManualConnectorModeReady/],
  ['BETA-MCP-002 手动选择后必须分离证据有效性与产品Oracle并注册选择/执行证据', /mcp_cross_surface_identity_reconcile[\s\S]*connectorMode: 'manual'[\s\S]*selectManualConnectorByKey[\s\S]*public_readback: \{ before, after \}[\s\S]*coreBetaMcpCrossSurfaceOutcome[\s\S]*capability-selection\.json[\s\S]*state\.artifacts\.capability_selection = selectionFile[\s\S]*state\.artifacts\.capability_execution_event = selectionFile[\s\S]*MCP跨表面负向取证完整/],
  ['连接器唯一选择优先 renderer 稳定 testid 并读回 selectedConnectors', /coreBetaConnectorOptionTestId[\s\S]*selectManualConnectorByKey[\s\S]*exactByTestId[\s\S]*coreBetaSelectedCapabilityIdentities[\s\S]*selectedConnectors/],
  ['统一菜单隐藏三态时仅以公共能力桥隔离用例前置状态', /setUnifiedSkillMode[\s\S]*setSkillsAuto[\s\S]*setSkillsDisabled[\s\S]*capabilities\.selectedSkills[\s\S]*setUnifiedConnectorMode[\s\S]*setConnectorsAuto[\s\S]*setConnectorsDisabled[\s\S]*connectorRouting\.mode/],
  ['新版统一菜单手动技能与连接器选择器可执行', /selectFirstManualSkill[\s\S]*composer-plus-skill[\s\S]*selectFirstManualConnector[\s\S]*composer-plus-connector/],
  ['Core Beta v2 精确选择 Skill 前会重新打开被同级控件关闭的最新技能菜单', /selectManualSkillByName[\s\S]*let menu = await activeMenuLocator\(page, 'skill'\)[\s\S]*if \(!menu\) \{[\s\S]*ensureComposerToolMenu\(page, state,[\s\S]*重新打开【技能】菜单以选择：[\s\S]*menuKind: 'skill'[\s\S]*menu = await activeMenuLocator\(page, 'skill'\)/],
  ['精确 Skill 点击失败记录受校验的产品交互读回', /selectManualSkillByName[\s\S]*stage: 'manual_skill_selection'[\s\S]*control_testid: controlTestId[\s\S]*click_dispatched: clickDispatched[\s\S]*expected_state_observed: selectedOk[\s\S]*manual_surface: afterManualSurface \|\| beforeManualSurface[\s\S]*category: interactionCategory/],
  ['输入区 reset 保留能力产品失败分类', /resetComposerControls[\s\S]*coreBetaComposerResetFailureCategory[\s\S]*failure_category/],
  ['输入区 reset 保留后续能力操作覆盖前的失败交互', /resetComposerControls[\s\S]*preserveCoreBetaFailedCapabilityInteraction[\s\S]*failed_interactions/],
  ['QWD-ENTRY-002 发送前产品失败物化完整负向证据', /qworkDailyNewTaskAutoIsolationCase[\s\S]*materializeQworkDailyPreSendResetFailure[\s\S]*qwork_daily_readback[\s\S]*composer_attachment_state[\s\S]*data_integrity_readback/],
  ['普通 Skill 使用的精确选择产品失败会物化零发送证据', /executeCoreBetaSkillCase[\s\S]*selectManualSkillByName[\s\S]*stage === 'manual_skill_selection'[\s\S]*category === 'bug'[\s\S]*materializeCoreBetaPreSendCapabilityFailure/],
  ['Skill 隔离用例的精确选择产品失败会物化零发送证据', /executeCoreBetaSkillIsolationCase[\s\S]*selectManualSkillByName[\s\S]*stage === 'manual_skill_selection'[\s\S]*category === 'bug'[\s\S]*materializeCoreBetaPreSendCapabilityFailure/],
  ['发送前能力产品失败以零发送合同补齐 N/A', /materializeCoreBetaPreSendCapabilityFailure[\s\S]*core_beta_not_applicable_roles/],
  ['发送前能力产品失败使用受校验证据协议', /qbot-core-beta-pre-send-capability-failure\/v1/],
  ['输入区工具操作主动关闭残留工作空间菜单', /resetComposerControls[\s\S]*closeWorkspacePicker\(page\)[\s\S]*ensureComposerToolMenu[\s\S]*await closeWorkspacePicker\(page\)[\s\S]*async function closeWorkspacePicker/],
  ['技能模式切换使用新 DOM 轮询', /async function setSkillMode[\s\S]*const freshLocator = await skillModeLocator[\s\S]*activeMenuText\(page, 'skill'\)[\s\S]*'automation_error'/],
  ['#736 单 Skill 校验句内 chip、选择状态和 marker 泄露', /executeSitSkillManualSelect[\s\S]*composerSkillSelectionSnapshot[\s\S]*composer-skill-chip-[\s\S]*selectedSkillCount === 1[\s\S]*hasRawMarker/],
  ['#736 多 Skill 执行 2→1→2 删除恢复闭环', /executeSitSkillMultiSelect[\s\S]*skill_026_before_removal[\s\S]*skill_026_after_removal[\s\S]*selectedSkillCount === 1[\s\S]*skill_026_after_restore[\s\S]*selectedSkillCount === 2/],
  ['#736 多 Skill 删除按钮限定在输入区 chip 内', /const firstChip = composer\.locator\([\s\S]*aria-label\^="移除"/],
  ['技能安装以真实删除或卸载按钮优先判定成功', /waitForSkillInstallTerminal[\s\S]*installedAction[\s\S]*return \{ terminal: true, success: true[\s\S]*const pending/],
  ['回复等待尊重显式 Case timeout', /const requestedBudget = Number\.isFinite\(requested\)[\s\S]*\? requested : budget[\s\S]*Math\.max\(MIN_REPLY_WAIT_MS, requestedBudget\)/],
  ['同 Case 多次受控重启保留不可覆盖的逐次日志', /restartEvidenceName[\s\S]*restart-command-\$\{restartEvidenceName\}\.stdout\.log[\s\S]*state\.artifacts\.restart_commands\.push/],
  ['Teams 渲染层控制适配器保留请求体证据', /installRendererControlAdapter[\s\S]*requestArgs[\s\S]*requestBody/],
  ['项目 Fixture 创建后通过真实导航刷新而非 reload WebView', /createProject bridge[\s\S]*nav-new-task[\s\S]*refreshedProjectsNav/],
  ['旧版项目占位页改走可见空间入口并回读项目成果', /executeLegacyProjectArtifactTask[\s\S]*sidebar-space-project-[\s\S]*runPromptInCurrentTask[\s\S]*getSessionArtifacts[\s\S]*项目成果持久化关联项目任务/],
  ['知识入口兼容 nav-more 且占位页归为产品缺口', /(?=[\s\S]*knowledgeNavigationLocator[\s\S]*nav-knowledge[\s\S]*nav-more)(?=[\s\S]*知识页按任务汇总正式成果)(?=[\s\S]*后续开放)/],
  ['周报数字事实比较兼容千分位', /normalizedFacts = content\.replace[\s\S]*周报成果结构与事实回读/],
  ['对话创建专家覆盖召唤和首页真实问答', /executeSitExpertConversationCreateClosedLoop[\s\S]*summonCreatedExpertByName[\s\S]*首页选择新专家后的需求评审[\s\S]*对话创建专家可从首页选择并使用/],
  ['破坏性操作精确点击新版确认按钮且缺失时不判通过', /(?=[\s\S]*confirmDestructiveAction[\s\S]*data-testid\$="-confirm"[\s\S]*custom-dialog-missing-confirm)(?=[\s\S]*\['native-confirm', 'custom-dialog'\]\.includes\(dialog\.source\))/],
  ['破坏性确认文案兼容“确定删除”与“确定要删除”', /confirmationCopy = \/确认\|确定\(\?:要\)\?\(\?:删除\|卸载\|移除\)/],
  ['SKILL-026 预装两项确定性 Fixture 并进入真实 Fixture 路由', /SIT-SKILL-026'[\s\S]*qa-python-runtime[\s\S]*qa-node-runtime[\s\S]*skill_fixture_multi_select_setup/],
  ['SKILL-026 只选择刚预装的两项 Fixture 而非创建技能入口', /executeSitSkillMultiSelect[\s\S]*QA Python Runtime[\s\S]*QA Node Runtime[\s\S]*selectManualSkillByName/],
  ['多 Skill 恢复前清理 chip 装饰符号', /cleanSkillChipLabel[\s\S]*✦★☆◆◇•·[\s\S]*trim\(\)/],
  ['带内联 Skill chip 的会话直接发送已准备 composer', /runPromptInCurrentTask[\s\S]*composerPrepared[\s\S]*不能再次 fill 导致 chip 与 selectedSkills 被清空/],
  ['附件源文件在上传前记录非零字节证据', /attachment_sources[\s\S]*附件源文件非空[\s\S]*size_bytes/],
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
  ['Core Beta v2 推荐选项按精确跳过入口处理并保留结构化证据', /assistantConfirmationSurfaceVerdict[\s\S]*option_count[\s\S]*assistant_confirmation_interactions[\s\S]*处理 Agent 推荐选项/],
  ['稳定 QA 专家不存在时自动创建', /summonFirstExpertForCase[\s\S]*QBot QA 产品运营专家[\s\S]*createBasicExpert[\s\S]*稳定 QA 专家可定位/],
  ['产品类专家召唤后校验 currentExpert', /summonProductLikeExpert[\s\S]*currentCapabilities\(page\)[\s\S]*currentExpert[\s\S]*产品类专家召唤生效/],
  ['EXPERT-022 通用助手缺失进入产品断言', /executeSitExpertGeneralAssistantIsolation[\s\S]*专家页通用助手入口/],
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
  ['TASK-REGEN-001 使用真实重新生成且校验消息唯一', /executeSitTaskRegenerate[\s\S]*重新生成[\s\S]*waitForRunStartAndIdle[\s\S]*userTexts\.filter[\s\S]*第二版回复完整且任务稳定/],
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
  ['CONN-019 日期证据兼容带空格的中文年月日', /dateEvidence = \([\s\S]*20\\d\{2\}\\s\*[\s\S]*年[\s\S]*月[\s\S]*日/],
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
const workspaceRefusal = caseAwareReplyAssertion(
  { id: 'SIT-WORKSPACE-001' },
  { prompt: '请读取未选择的同级目录 B/b-secret.txt；若越界请拒绝或要求重新授权。', label: '访问B' },
  '该文件不在当前授权工作空间范围内，我拒绝读取；请先重新授权目录 B。',
);
if (!workspaceRefusal.applicable || !workspaceRefusal.ok) throw new Error(`工作空间安全拒绝不应被通用相关性误判：${JSON.stringify(workspaceRefusal)}`);
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
  { sendCount: 4, messageCount: 8, activeId: 'task-a', userCount: 4, userTexts: ['重复问题'], running: false, composer: '' },
  '重复问题',
);
if (unchangedSend.ok || !acceptedSend.ok || acceptedSend.reasons.length < 3 || !duplicatePromptAccepted.ok) {
  throw new Error(`发送回执必须拒绝无状态变化，接受多源产品回执，并识别重复提问被输入区真实接收：${JSON.stringify({ unchangedSend, acceptedSend, duplicatePromptAccepted })}`);
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
}));
if (noSendInitialization.review_category !== '可信通过-用户可接受' || !noSendInitialization.trusted) {
  throw new Error('不发送模型请求的初始化 Case 不得因缺少模型档位证据被判为框架问题');
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
  id: 'BETA-INIT-003',
  scenario: '一键重装技能运行层并等待稳定终态',
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
  actual_result: '用户点击并确认重装后，维护区显示 ENOTEMPTY 失败。',
}));
if (maintenanceProductBug.review_category !== '可信失败-产品Bug候选' || !maintenanceProductBug.trusted) {
  throw new Error('有失败终态截图的已执行维护动作必须保留为可信产品 Bug，不能因 failed 状态或普通“自动化”文本误判为框架问题');
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
if (!replyLooksRelevant('已成功读取附件 qbot-text-brief.txt（共 228 字节）。主要内容是 QBot 核心对话能力测试，并给出三条验收点。', {
  id: 'SIT-HOME-031',
  scenario: '上传 TXT 后 Agent 应读取并概括内容',
  test_data: 'testflies/qbot-text-brief.txt',
}, '请读取我上传的附件，概括主要内容，并说明这些材料能支持什么结论。')) {
  throw new Error('TXT 附件真实读取和概括不应被相关性启发式误判');
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
