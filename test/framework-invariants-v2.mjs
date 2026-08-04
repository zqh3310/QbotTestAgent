import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import {
  assistantConfirmationSurfaceVerdict,
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
  createControlPlaneFaultProxy,
  createConnectorRegressionServer,
  createSkillHubRegressionServer,
  countEnumeratedItems,
  coreBetaArtifactReadback,
  coreBetaBatchTaskMarker,
  coreBetaBatchStopReason,
  coreBetaAttachmentRejectionMatrixVerdict,
  coreBetaAttachmentRejectionProbeVerdict,
  coreBetaCleanupCapabilitiesNeedsRetry,
  coreBetaCleanupReadbackNeedsComposerRecovery,
  coreBetaCleanupReadbackVerdict,
  coreBetaCompletionBlockReason,
  coreBetaInitializationContinuation,
  managedAttachmentDialogEvidenceVerdict,
  coreBetaMarkdownHtmlPreviewVerdict,
  coreBetaPartialReplyReady,
  coreBetaRuntimeExecutorBinding,
  coreBetaSkillInstallBatchAssessment,
  coreBetaV2NeedsRendererReconnect,
  coreBetaV2MaintenanceActionObservation,
  coreBetaV2MaintenanceConfirmationContract,
  coreBetaV2RuntimeMaintenanceState,
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
  obviousDuplicateEvidence,
  probeConnectorRegressionFixture,
  parseSingleHostPipelineSize,
  partitionCasebookResults,
  rawArtifactEventLeakEvidence,
  replyLooksRelevant,
  replySendObservedRunning,
  reviewCaseCredibility,
  safeNativeAttachmentInfoDialog,
  selectManagedRuntimeProcess,
  singleHostPipelineEligibility,
  seedLocalSkillReadiness,
  sendReceiptEvidence,
  sentPromptFidelity,
  streamingScrollFollowVerdict,
  unifiedConnectorModeApplied,
  unifiedSkillModeApplied,
  withReplyPollHardTimeout,
  webSearchQualityVerdict,
  validateProductionCasePlan,
  validateCoreBetaArtifactOracle,
} from '../src/lib/ui-agent-casebook-runner-v2.mjs';
import { buildCoreEvidenceManifest } from '../src/lib/core-beta-case-protocol.mjs';
import { replaceUnpairedSurrogates, writeJsonFile } from '../src/lib/fs.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const runner = fs.readFileSync(path.join(root, 'src', 'lib', 'ui-agent-casebook-runner-v2.mjs'), 'utf8');
const projectMemory = fs.readFileSync(path.join(root, 'AGENTS.md'), 'utf8');
const automationFramework = fs.readFileSync(path.join(root, 'QBOT_AUTOMATION_FRAMEWORK.md'), 'utf8');
const electronRestartHelper = fs.readFileSync(path.join(root, 'scripts', 'restart-qbot-electron-control-plane.sh'), 'utf8');
const skillHubRestartHelper = fs.readFileSync(path.join(root, 'scripts', 'restart-qbot-skillhub-control-plane.sh'), 'utf8');
const connectorFixtureRestartHelper = fs.readFileSync(path.join(root, 'scripts', 'restart-qbot-connector-fixture-control-plane.sh'), 'utf8');
const capabilityFixtureRestartHelper = fs.readFileSync(path.join(root, 'scripts', 'restart-qbot-capability-fixture-control-plane.sh'), 'utf8');
const skillHubFixtureManifest = JSON.parse(fs.readFileSync(path.join(root, 'testfixtures', 'skillhub-regression', 'manifest.json'), 'utf8'));
const coreGateCasebook = JSON.parse(fs.readFileSync(
  path.join(root, 'PRD', 'QBot核心上线门禁用例_Teams-QWork_2026-07-22_框架修复版.json'),
  'utf8',
));

const coreGateIds = coreGateCasebook.cases.map((item) => item.id);
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
  assert.equal(interactiveHtmlReadback.valid, true, '交互式 HTML 的内联 script 不应被文件结构校验误判为无效');
  assert.equal(remoteHtmlReadback.valid, false, '引用远程资源的 HTML 仍必须失败');
  assert.equal(
    validateCoreBetaArtifactOracle('artifact_markdown_html_validation', [markdownReadback, interactiveHtmlReadback]),
    true,
    'BETA-ART-001 应接受包含内联交互脚本且无远程资源的 HTML',
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
    true,
    'BETA-ART-001 必须用双成果源码预览和宿主隔离证据判定交互 HTML',
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
  /receipts\.filter\(\(item\) => item\.oracle_passed\)[\s\S]*install_attempt_receipts[\s\S]*assessment\.oracle_valid/,
  'Skill 安装批次必须分离尝试账本与成功账本，并保留产品 Oracle 结果',
);
assert.match(
  runner,
  /allowUnlabeledTerminal[\s\S]*terminal_feedback: terminalFeedback[\s\S]*terminal_outcome: terminalOutcome[\s\S]*terminal_waited_ms: terminalWaitedMs/,
  'Skill 安装必须绑定通用终态反馈，并为完整等待后的 pending 保存明确 timed_out 证据',
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
  /pipeline 回收结果进入 `completed` 前[\s\S]*原始 Case[\s\S]*manifest 完整性门禁[\s\S]*`automation_error` 硬停止/,
  '框架手册必须要求 pipeline 解包原始 Case 后执行与串行路径一致的 completed 门禁',
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
  ['BETA-ROUTE-001', 'model_routing', 'strict_controller'],
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
assert.deepEqual(
  buildSingleHostPipelineBatch(
    Array.from({ length: 8 }, (_item, index) => coreBetaPipelineCase(`BETA-CHAT-${String(index + 1).padStart(3, '0')}`)),
    0,
    20,
  ).map((entry) => entry.testCase.id),
  Array.from({ length: 5 }, (_item, index) => `BETA-CHAT-${String(index + 1).padStart(3, '0')}`),
  'Core Beta 单波不得超过首 Case 声明的 batch_size，即使全局配置更大',
);
assert.deepEqual(
  buildSingleHostPipelineBatch([
    coreBetaPipelineCase('BETA-CHAT-001', 'conversation'),
    coreBetaPipelineCase('BETA-FILE-001', 'attachment'),
    coreBetaPipelineCase('BETA-CHAT-002', 'conversation'),
  ], 0, 20).map((entry) => entry.testCase.id),
  ['BETA-CHAT-001'],
  'Core Beta 流水线不得跨 case_type 混批，避免附件/能力准备策略串扰',
);
assert.deepEqual(
  buildSingleHostPipelineBatch([
    coreBetaPipelineCase('BETA-CHAT-001', 'conversation', { pipeline_policy: 'dispatch_collect' }),
    coreBetaPipelineCase('BETA-CHAT-002', 'conversation', { pipeline_policy: 'dispatch_collect_round_robin' }),
  ], 0, 20).map((entry) => entry.testCase.id),
  ['BETA-CHAT-001'],
  'Core Beta 流水线不得跨 pipeline_policy 混批',
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
assert.equal(
  coreBetaBatchStopReason(
    { id: 'BETA-CHAT-001', case_type: 'conversation', contract_version: 'qbot-core-beta/v2' },
    { status: 'failed', result_category: 'bug' },
  ),
  '',
  '可信产品 Bug 不应阻止后续独立 Case 收集',
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
assert.match(
  runner,
  /let frameworkStop = null[\s\S]*frameworkStop = stopRemainderWithoutSynthetic\([\s\S]*buildSummary\(\{[\s\S]*expectedTotal: selectedCases\.length,[\s\S]*frameworkStop,/,
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
  /const batchEntry = pipelineBatch\[batchOffset\];[\s\S]*const batchCase = batchEntry\?\.testCase;[\s\S]*coreBetaCompletionBlockReason\(batchCase, result\)/,
  'pipeline completed 门禁必须解包 batchEntry.testCase，不能让 Core Beta manifest 校验因包装对象而被跳过',
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

const required = [
  ['逐次发送前模型校验', /async function send[\s\S]*ensureModelTier\(page, state, state\.case_dir[\s\S]*model_tier_before_send[\s\S]*const selectors/],
  ['模型复核后恢复并精确校验真实发送文本', /async function send[\s\S]*prompt_fidelity_before_send[\s\S]*restored[\s\S]*检测到输入区仍是旧草稿/],
  ['发送必须确认产品回执且第三次仅在安全条件下回退键盘 Enter', /(?=[\s\S]*async function send)(?=[\s\S]*attempt <= 3)(?=[\s\S]*composer-keyboard-enter)(?=[\s\S]*waitForSendReceipt)(?=[\s\S]*sendRetryIsSafe)(?=[\s\S]*未被产品接收)/],
  ['contenteditable 使用 fill 同步受控草稿状态', /async function fillComposer[\s\S]*editable[\s\S]*await input\.fill\(text\)[\s\S]*输入区文本与期望不一致/],
  ['可信度审计使用逐次发送前证据', /preSendTierChecks[\s\S]*successfulSendCount[\s\S]*preSendTierChecks\.length < successfulSendCount/],
  ['HOME-007 专项执行', /SIT-HOME-007'[\s\S]*executeSitHomeSkillOnly/],
  ['今日 #793/#800 使用独立本地产品断言', /SIT-ISSUE-793'[\s\S]*executeIssue793StreamingScrollFollow[\s\S]*SIT-ISSUE-800'[\s\S]*executeIssue800ModelServiceStateConsistency/],
  ['#793 生成中采样滚动位置并保存证据', /(?=[\s\S]*executeIssue793StreamingScrollFollow)(?=[\s\S]*thread-scroll-samples\.json)(?=[\s\S]*issue-793-streaming-scroll-drift)/],
  ['#800 多轮采样不可达状态与回复增长', /(?=[\s\S]*executeIssue800ModelServiceStateConsistency)(?=[\s\S]*model-service-state-samples\.json)(?=[\s\S]*growthAfterUnavailable)/],
  ['HOME-008 专项执行且不被 reset 清空连接器', /SIT-HOME-008'[\s\S]*executeSitHomeConnectorOnly[\s\S]*连接器 only 前置真实生效/],
  ['HOME-020 不走附件泛化路由', /SIT-HOME-020'[\s\S]*executeSitHomePrdBoundary/],
  ['HOME-023 记录真实停止点击', /recordStep\(state, '点击停止生成'/],
  ['Core Beta v2 停止生成使用独立助手正文提取器', /async function assistantBodyTexts/],
  ['Core Beta v2 助手正文提取明确排除 reasoning', /const excluded = '[^']*aui_reasoning[^']*'/],
  ['Core Beta v2 停止生成只消费助手正文字段', /latestAssistantBodyText/],
  ['Core Beta v2 停止生成观察正文 partial 并读回保留内容', /coreBetaPartialReplyReady[\s\S]*partial-reply-precondition-readback\.json[\s\S]*partial_reply_ready_before_click[\s\S]*await cancel\.click[\s\S]*retained_chars[\s\S]*stop-generation-readback\.json/],
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
  ['QWork 0.0.11 统一加号菜单按技能连接器模式子菜单兼容', /UNIFIED_COMPOSER_SUBMENUS[\s\S]*composer-plus-sub-mode[\s\S]*composer-plus-sub-skill[\s\S]*composer-plus-sub-connector[\s\S]*openUnifiedComposerSubmenu/],
  ['统一菜单隐藏三态时仅以公共能力桥隔离用例前置状态', /setUnifiedSkillMode[\s\S]*setSkillsAuto[\s\S]*setSkillsDisabled[\s\S]*capabilities\.selectedSkills[\s\S]*setUnifiedConnectorMode[\s\S]*setConnectorsAuto[\s\S]*setConnectorsDisabled[\s\S]*connectorRouting\.mode/],
  ['新版统一菜单手动技能与连接器选择器可执行', /selectFirstManualSkill[\s\S]*composer-plus-skill[\s\S]*selectFirstManualConnector[\s\S]*composer-plus-connector/],
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
if (!attachmentReplyMissingEvidence(
  '我没有收到附件，请重新上传该 PDF。',
  ['/tmp/qbot-pdf-summary.pdf'],
)) {
  throw new Error('真正未收到附件且要求重传时必须判失败');
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
