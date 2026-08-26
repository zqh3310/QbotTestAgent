import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  CORE_BETA_AUTOMATION_PROTOCOL,
  CORE_BETA_CASEBOOK_CONTRACT_VERSION,
  deterministicCapabilitySample,
  validateActionEvidence,
  validateCoreBetaCase,
  validateExpertExecutionEvidence,
  validateMcpExecutionEvidence,
  validateReplyEvidence,
  validateSkillExecutionEvidence,
} from '../src/lib/core-beta-casebook-contract.mjs';
import {
  assessUserCenteredOutcome,
  buildCaseEvidenceManifest,
  coreBetaCatalogSkillInventory,
  coreBetaActionReceiptsComplete,
  coreBetaAttachmentCollectNeedsSend,
  coreBetaBatchPendingPoolEvidence,
  coreBetaBatchSharedDeadline,
  coreBetaBatchTerminalEvidence,
  coreBetaMaintenanceConfirmationContract,
  coreBetaCapabilityInteractionCategory,
  coreBetaConnectorOptionTestId,
  coreBetaManualConnectorModeReady,
  coreBetaNeedsRendererReconnect,
  coreBetaRuntimeMaintenanceState,
  coreBetaSettingsLoadTimeoutMs,
  coreBetaSettingsSurfaceState,
  coreBetaSharedCapabilityPrerequisiteBlocker,
  coreBetaInstalledSkillTerminalSelectorCandidates,
  coreBetaSkillCardActionSelectorCandidates,
  coreBetaSkillIdentityCandidates,
  coreBetaSkillEntrySelectorCandidates,
  coreBetaInstalledSkillReadme,
  coreBetaSkillTaskProfile,
  normalizeCoreBetaExpertCard,
  restoreCoreBetaSharedLedgerAfterInheritedCase,
  seedCoreBetaSharedLedgerCheckpoint,
  stageCoreBetaPlannedPrompt,
  verifiedCapabilitySelectionUnavailableEvidence,
  verifiedCoreBetaProductActionFailureEvidence,
  verifiedCoreBetaUpstreamPrerequisiteShortageEvidence,
  verifiedExpertSelectionUnavailableEvidence,
  verifiedReplyTimeoutTerminalEvidence,
  validateCasebookExecutorReadiness,
  withCoreBetaOperationHardTimeout,
} from '../src/lib/ui-agent-casebook-runner.mjs';
import {
  captureCoreBetaV2Screenshot,
  coreBetaAttachmentEvidenceEnvelope,
  coreBetaAttachmentIngressVerdict,
  coreBetaBatchReplyCompletionPayload,
  coreBetaClipboardPasteObserved,
  coreBetaPreSendAttachmentRejectionEvidence,
} from '../src/lib/ui-agent-casebook-runner-v2.mjs';
import {
  buildCoreEvidenceManifest,
  validateEvidenceFile,
  validateReplyCompletionPayload,
} from '../src/lib/core-beta-case-protocol.mjs';
import { isSupportedQbotAttachmentPath } from '../src/lib/qbot-ui-attachments.mjs';

function conversationCase() {
  const steps = [
    '新建干净任务并确认能力均未选择',
    '输入问题并发送',
    '按 taskId 回收完整回复并断言',
  ];
  return {
    id: 'BETA-CHAT-001',
    contract_version: CORE_BETA_CASEBOOK_CONTRACT_VERSION,
    automation_protocol: CORE_BETA_AUTOMATION_PROTOCOL,
    case_type: 'conversation',
    steps: steps.map((item, index) => `${index + 1}. ${item}`).join('\n'),
    action_plan_json: JSON.stringify(steps.map((item, index) => ({
      number: index + 1,
      action_id: `chat-${index + 1}`,
      declared_step: item,
      command: ['open_clean_task', 'send_prompt', 'collect_reply'][index],
      expected_state: ['clean_task', 'send_receipt', 'reply_completed'][index],
      evidence_roles: ['before_screenshot', 'action_receipt', 'after_screenshot'],
    }))),
    turns_json: JSON.stringify([{
      prompt: '请给出三条内测建议。',
      oracle: '返回三条可执行建议',
      must_include: ['建议'],
      must_not_include: ['traceback'],
    }]),
    assertion_contract_json: JSON.stringify({
      pass_rule: '所有硬断言通过',
      fail_rule: '产品行为与预期不符',
      block_rule: '环境或能力前置不满足',
    }),
    required_evidence_roles: [
      'before_screenshot',
      'action_receipt',
      'after_screenshot',
      'prompt',
      'task_id',
      'send_receipt',
      'transcript',
      'reply_delta',
      'reply_completion',
    ].join(','),
    cleanup_policy: 'case_task_isolation',
    initialization_profile: 'run_full_reset_then_case_clean',
    pipeline_policy: 'dispatch_collect',
    batch_size: 20,
  };
}

test('core beta conversation contract is structured and executable', () => {
  const audit = validateCoreBetaCase(conversationCase());
  assert.equal(audit.ok, true, audit.errors.join('\n'));
  assert.equal(audit.parsed.action_plan.length, 3);
  assert.equal(audit.parsed.turns.length, 1);
});

test('a located capability click with unchanged product state is a product failure', () => {
  assert.equal(coreBetaCapabilityInteractionCategory({
    controlLocated: true,
    clickDispatched: true,
    expectedStateObserved: false,
  }), 'bug');
  assert.equal(coreBetaCapabilityInteractionCategory({
    controlLocated: false,
    clickDispatched: false,
    expectedStateObserved: false,
  }), 'automation_error');
  assert.equal(coreBetaCapabilityInteractionCategory({
    controlLocated: true,
    clickDispatched: true,
    expectedStateObserved: true,
  }), '');
  assert.equal(coreBetaCapabilityInteractionCategory({
    controlLocated: false,
    clickDispatched: false,
    selectionSurfaceLocated: true,
    inventoryMismatch: true,
    publicStateReadable: true,
    expectedStateObserved: false,
  }), 'bug', '已安装 Skill 缺失但手动列表仍有其他选项时应归类为产品库存不一致');
  assert.equal(coreBetaCapabilityInteractionCategory({
    controlLocated: false,
    clickDispatched: false,
    selectionSurfaceLocated: true,
    inventoryMismatch: true,
    publicStateReadable: false,
    expectedStateObserved: false,
  }), 'automation_error', '手动列表公开状态不可读时库存不一致必须保持框架错误');
});

test('connector option testid preserves exact keys containing a colon', () => {
  assert.equal(
    coreBetaConnectorOptionTestId('builtin:qbot_vision'),
    'composer-connector-option-builtin:qbot_vision',
  );
});

test('natural language steps without an exact action plan fail closed', () => {
  const invalid = conversationCase();
  invalid.action_plan_json = '';
  const audit = validateCoreBetaCase(invalid);
  assert.equal(audit.ok, false);
  assert.ok(audit.errors.some((item) => item.includes('action_plan_json')));
});

test('registered core beta cases pass readiness without falling through to a generic runner', () => {
  const readiness = validateCasebookExecutorReadiness([conversationCase()], {
    controlPlaneUrl: 'https://qbot-api.360shuke.com',
    qworkUiUrl: 'file:///Users/qifu/.deepbank/ui/0.0.20/index.html',
  });
  assert.equal(readiness.ok, true, JSON.stringify(readiness.framework_issues));
  assert.equal(readiness.framework_issues.some((item) => item.kind === 'core_beta_executor_missing'), false);
});

test('core beta settings loading uses a bounded configurable product wait window', () => {
  assert.equal(coreBetaSettingsLoadTimeoutMs({}), 90_000);
  assert.equal(coreBetaSettingsLoadTimeoutMs({
    QBOT_CORE_BETA_SETTINGS_LOAD_TIMEOUT_MS: '120000',
  }), 120_000);
  assert.equal(coreBetaSettingsLoadTimeoutMs({
    QBOT_CORE_BETA_SETTINGS_LOAD_TIMEOUT_MS: '1000',
  }), 30_000);
  assert.equal(coreBetaSettingsLoadTimeoutMs({
    QBOT_CORE_BETA_SETTINGS_LOAD_TIMEOUT_MS: '999999',
  }), 180_000);
});

test('a terminal product failure remains a complete action receipt', () => {
  const base = {
    action_id: 'beta-init-003-02',
    number: 2,
    command: 'reinstall_skill_layer',
    event: 'click',
    dispatched_at: '2026-07-29T00:00:00.000Z',
    completed_at: '2026-07-29T00:00:01.000Z',
    before_screenshot: '/tmp/before.png',
    after_screenshot: '/tmp/after.png',
    expected_state_observed: false,
    state_readback: {
      after_text: '失败：ENOTEMPTY, Directory not empty',
      terminal: true,
    },
  };
  assert.equal(coreBetaActionReceiptsComplete([base], 1), true);
  assert.equal(coreBetaActionReceiptsComplete([
    {
      ...base,
      state_readback: null,
      actual: '本轮没有可按 slug/name 精确选择的已安装 Skill，禁止随机替代。',
      error: '',
    },
  ], 1), true);
  assert.equal(coreBetaActionReceiptsComplete([
    { ...base, state_readback: null, actual: '', error: '' },
  ], 1), false);
});

test('Core Beta refresh reconnects for closed or invalidated renderer contexts', () => {
  assert.equal(coreBetaNeedsRendererReconnect(
    new Error('page.reload: Target page, context or browser has been closed'),
  ), true);
  assert.equal(coreBetaNeedsRendererReconnect(
    new Error('page.evaluate: Execution context was destroyed, most likely because of a navigation'),
  ), true);
  assert.equal(coreBetaNeedsRendererReconnect(
    new Error('desktop-local context mutation was superseded'),
  ), true);
  assert.equal(coreBetaNeedsRendererReconnect(
    new Error('page.reload: net::ERR_FAILED'),
  ), false);
});

test('runtime reset follows SDK phases instead of the persistent reprovision notice', () => {
  const reprovisionText = [
    '本进程已加载并校验：v0.0.23（builtin）',
    'Claude Code SDK 0.3.181：就绪 Codex SDK 0.142.0：就绪',
    '本地运行时、UI、技能环境和会话已清理，正在按当前身份重新预配。',
  ].join('\n');
  const provisioning = coreBetaRuntimeMaintenanceState({
    text: reprovisionText,
    composerReady: true,
    resetButtonEnabled: true,
    sdkStatuses: [
      { family: 'claude-code', phase: 'provisioning', progress: 80 },
      { family: 'codex', phase: 'ready', progress: 100 },
    ],
    stableReadyObservations: 0,
  });
  assert.equal(provisioning.ready, false);
  assert.equal(provisioning.pending, true);
  assert.equal(provisioning.provisioning_notice, true);
  assert.equal(provisioning.sdk_ready, false);
  assert.equal(provisioning.reason, 'Claude/Codex SDK 尚未全部达到 ready，不能判定完成。');

  const terminalReadyText = [
    '本进程已加载并校验：v0.0.23（builtin）',
    'Claude Code SDK 0.3.181：就绪 Codex SDK 0.142.0：就绪',
    '本地运行时、UI、技能环境和会话已清理，正在按当前身份重新预配。',
  ].join('\n');
  assert.equal(coreBetaRuntimeMaintenanceState({
    text: terminalReadyText,
    composerReady: true,
    resetButtonEnabled: true,
    sdkStatuses: [
      { family: 'claude-code', phase: 'ready', progress: 100 },
      { family: 'codex', phase: 'ready', progress: 100 },
    ],
    stableReadyObservations: 2,
    minimumReadyObservations: 2,
  }).ready, true);
  assert.equal(coreBetaRuntimeMaintenanceState({
    text: terminalReadyText,
    composerReady: false,
    resetButtonEnabled: true,
    sdkStatuses: [
      { family: 'claude-code', phase: 'ready', progress: 100 },
      { family: 'codex', phase: 'ready', progress: 100 },
    ],
    stableReadyObservations: 2,
    minimumReadyObservations: 2,
  }).ready, false);
});

test('an unknown core beta command fails readiness before the UI runner starts', () => {
  const invalid = conversationCase();
  const actions = JSON.parse(invalid.action_plan_json);
  actions[1].command = 'generic_click_and_hope';
  invalid.action_plan_json = JSON.stringify(actions);
  const readiness = validateCasebookExecutorReadiness([invalid], {
    controlPlaneUrl: 'https://qbot-api.360shuke.com',
    qworkUiUrl: 'file:///Users/qifu/.deepbank/ui/0.0.20/index.html',
  });
  assert.equal(readiness.ok, false);
  assert.ok(readiness.framework_issues.some((item) => (
    item.kind === 'core_beta_command_missing'
    && item.command === 'generic_click_and_hope'
  )));
});

test('deterministic sampler is stable, stratified, and refuses shortages', () => {
  const items = Array.from({ length: 12 }, (_, index) => ({
    id: `cap-${index + 1}`,
    category: ['document', 'data', 'research'][index % 3],
    ready: true,
  }));
  const first = deterministicCapabilitySample(items, {
    count: 10,
    seed: 'release-abc',
    eligible: (item) => item.ready,
  });
  const second = deterministicCapabilitySample(items, {
    count: 10,
    seed: 'release-abc',
    eligible: (item) => item.ready,
  });
  assert.equal(first.ok, true);
  assert.deepEqual(first.selected_ids, second.selected_ids);
  assert.equal(new Set(first.strata).size, 3);
  assert.equal(deterministicCapabilitySample(items.slice(0, 4), { count: 5, seed: 'x' }).ok, false);
});

test('skill market inventory comes from getSkillsCatalog.market, never installed capabilities', () => {
  const market = Array.from({ length: 12 }, (_, index) => ({
    name: `market-skill-${index + 1}`,
    slug: `market-skill-${index + 1}`,
    namespace: 'global',
    label: `市场技能 ${index + 1}`,
    latestVersion: '1.0.0',
    category: index % 2 ? '数据' : '文档',
    installed: false,
    usable: true,
  }));
  const dom = market.map((item) => ({
    slug: '',
    name: item.label,
    action_text: '安装',
    action_aria_label: '安装技能',
    action_disabled: false,
  }));
  const result = coreBetaCatalogSkillInventory({
    installed: [
      { name: 'builtin-a', label: '内置 A', version: '1.0.0' },
      { name: 'builtin-b', label: '内置 B', version: '1.0.0' },
    ],
    market,
    marketSource: 'remote',
    marketStatus: 'ready',
  }, '技能市场', dom);
  assert.equal(result.branch, 'market');
  assert.equal(result.inventory.length, 12);
  assert.equal(result.inventory.every((item) => item.visible && item.install_action_visible), true);
  assert.equal(result.inventory.some((item) => item.slug === 'builtin-a'), false);
});

test('skill navigation supports the current expert-center role=tab entry as well as the legacy testid', () => {
  const candidates = coreBetaSkillEntrySelectorCandidates();
  assert.ok(candidates.includes('[data-testid="skills-tab"]'));
  assert.ok(candidates.includes('[data-testid="experts-view"] [role="tablist"][aria-label="专家与技能"] [role="tab"]'));
  assert.ok(candidates.includes('.restab-experts [role="tab"]'));
});

test('skill market card probing prioritizes the install action over the preceding more-menu button', () => {
  assert.deepEqual(coreBetaSkillCardActionSelectorCandidates().slice(0, 2), [
    '.skill-install:not([disabled])',
    '.skill-install',
  ]);
  const result = coreBetaCatalogSkillInventory({
    market: [{
      namespace: 'global',
      slug: 'market-skill',
      name: 'market-skill',
      latestVersion: '1.0.0',
      installed: false,
      usable: true,
    }],
  }, '技能市场', [{
    name: 'market-skill',
    action_text: '',
    action_aria_label: '更多',
    action_disabled: false,
    install_action_visible: true,
  }]);
  assert.equal(result.inventory[0].install_action_visible, true);
});

test('skill market install matching includes the localized label when cards expose no slug attribute', () => {
  assert.deepEqual(coreBetaSkillIdentityCandidates({
    slug: 'column-lineage-analysis',
    name: 'column-lineage-analysis',
    label: '字段血缘分析',
    raw: {
      cnName: '字段血缘分析',
      displayName: '字段血缘分析工具',
    },
  }), [
    '字段血缘分析',
    'column-lineage-analysis',
    '字段血缘分析工具',
  ]);
});

test('skill install terminal detection supports the current checkmark and try-it card actions', () => {
  const candidates = coreBetaInstalledSkillTerminalSelectorCandidates();
  assert.ok(candidates.includes('.skill-card-installed'));
  assert.ok(candidates.includes('.skill-card-go-chat'));
  assert.ok(candidates.includes('[aria-label="试一试"]'));
});

test('installed Skill tasks are derived from the actual Skill identity and README domain', () => {
  const finance = coreBetaSkillTaskProfile(
    { slug: 'variance-analysis', raw: { desc: 'Analyze financial variances' } },
    '# Variance Analysis\nUse monthly finance inputs and show calculations.',
  );
  const design = coreBetaSkillTaskProfile(
    { slug: 'frontend-design', raw: { desc: 'Build polished web interfaces' } },
    '# Frontend Design',
  );
  assert.equal(finance.scenario, '财务分析');
  assert.match(finance.input, /收入120万元/);
  assert.equal(design.scenario, '网页/设计交付');
  assert.match(design.expected, /交付物/);
});

test('installed Skill README follows the configured release home instead of production home', () => {
  const qbotHome = fs.mkdtempSync(path.join(os.tmpdir(), 'qbot-uat-home-'));
  try {
    const skillDir = path.join(qbotHome, 'home', '.claude', 'skills', 'global__variance-analysis');
    fs.mkdirSync(skillDir, { recursive: true });
    fs.writeFileSync(path.join(skillDir, 'SKILL.md'), '# UAT Variance Analysis\n', 'utf8');
    const readme = coreBetaInstalledSkillReadme({ slug: 'variance-analysis' }, qbotHome);
    assert.equal(readme.path, path.join(skillDir, 'SKILL.md'));
    assert.match(readme.text, /UAT Variance Analysis/);
    assert.match(readme.sha256, /^[a-f0-9]{64}$/);
  } finally {
    fs.rmSync(qbotHome, { recursive: true, force: true });
  }
});

test('expert visible identity excludes status copy and null DOM ids', () => {
  assert.deepEqual(
    normalizeCoreBetaExpertCard({
      id: null,
      testid: null,
      name: '',
      text: 'QBot内测研究专家-6be9bd私有',
      owned: true,
    }),
    {
      id: '',
      testid: null,
      name: 'QBot内测研究专家-6be9bd',
      text: 'QBot内测研究专家-6be9bd私有',
      owned: true,
    },
  );
});

test('MCP manual mode uses public routing plus visible options; optional copy is diagnostic only', () => {
  const ready = coreBetaManualConnectorModeReady({
    ariaChecked: '',
    manualSurface: {
      list_visible: true,
      option_count: 24,
      empty_visible: false,
      manual_note_visible: false,
    },
    capabilities: {
      connectorRouting: { mode: 'manual' },
      selectedConnectors: [],
    },
  });
  assert.equal(ready.ok, true);
  assert.equal(ready.public_manual, true);
  assert.equal(coreBetaManualConnectorModeReady({
    ariaChecked: 'true',
    manualSurface: { list_visible: false, option_count: 24 },
    capabilities: { connectorRouting: { mode: 'manual' } },
  }).ok, false);
});

test('QA attachment allowlist follows the product release contract for log files', () => {
  assert.equal(isSupportedQbotAttachmentPath('/tmp/qbot-runtime.log'), true);
  assert.equal(isSupportedQbotAttachmentPath('/tmp/qbot-runtime.exe'), false);
});

test('verified attachment rejection before send makes only the impossible send chain N/A', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'qbot-core-beta-pre-send-attachment-rejection-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const roles = ['task_id', 'prompt', 'send_receipt', 'transcript', 'reply_delta', 'reply_completion'];
  const variants = [
    ['SIT-HOME-043', 'single_file_oversize', '单个文档不能超过 30 MiB'],
    ['SIT-HOME-044', 'aggregate_oversize', '文档附件总大小不能超过 80 MiB'],
  ];

  for (const [caseId, rejectionType, dialogMessage] of variants) {
    const caseDir = path.join(root, caseId);
    fs.mkdirSync(caseDir, { recursive: true });
    const rejectionScreenshot = path.join(caseDir, 'rejection.png');
    const afterScreenshot = path.join(caseDir, 'after-dismissal.png');
    const dialogArtifact = path.join(caseDir, 'dialog.json');
    fs.writeFileSync(rejectionScreenshot, Buffer.alloc(256, 1));
    fs.writeFileSync(afterScreenshot, Buffer.alloc(256, 2));
    const dialogEvidence = {
      expected_dialog_message: dialogMessage,
      playwright_dialog_message: dialogMessage,
      playwright_dialog: {
        observed_before_confirmation: true,
        type: 'alert',
        message: dialogMessage,
        allowlisted_attachment_info: true,
        action: 'playwright_accept_fallback',
        accepted: true,
        evidence_captured_before_accept: true,
        page_responsive_after: true,
        close_error: '',
      },
    };
    fs.writeFileSync(dialogArtifact, JSON.stringify(dialogEvidence));
    const before = { available: true, activeId: null, running: false, messageCount: 0, sendCount: 7 };
    const after = { available: true, activeId: null, running: false, messageCount: 0, sendCount: 7 };
    const evidence = coreBetaPreSendAttachmentRejectionEvidence({
      testCaseId: caseId,
      rejectionType,
      before,
      after,
      probe: {
        expected_pattern_matched: true,
        visible_rejection_evidence: true,
        dialog_message: dialogMessage,
        dialog_settled: true,
        managed_teams_ax_required: true,
        managed_dialog_evidence: true,
        rejected_before_send: true,
      },
      composerState: { count: 0, names: [] },
      rejectionScreenshot,
      postDismissalScreenshot: afterScreenshot,
      dialogEvidenceArtifact: dialogArtifact,
      noPromptRecorded: true,
      noSendReceiptRecorded: true,
    });
    assert.equal(evidence.valid, true, caseId);
    assert.deepEqual(evidence.not_applicable_roles, roles, caseId);
    const blockerFile = path.join(caseDir, 'pre-send-attachment-rejection.json');
    fs.writeFileSync(blockerFile, JSON.stringify(evidence, null, 2));
    const artifacts = {
      core_beta_not_applicable_roles: roles.map((role) => ({ role, blocker_path: blockerFile })),
    };
    const manifest = buildCoreEvidenceManifest({
      testCase: { id: caseId, evidence_roles: roles },
      caseDir,
      artifacts,
    });
    assert.equal(manifest.complete, true, caseId);
    assert.deepEqual(manifest.not_applicable_roles.map((item) => item.role), roles, caseId);

    const tamperedVariants = [
      { ...evidence, dependent_case_id: 'SIT-HOME-042' },
      { ...evidence, rejection: { ...evidence.rejection, dialog_message: '上传成功' } },
      { ...evidence, composer_state: { ...evidence.composer_state, count: 1, names: ['oversized.pdf'] } },
      { ...evidence, mutation_guard: { ...evidence.mutation_guard, send_count_unchanged: false } },
      {
        ...evidence,
        mutation_guard: {
          ...evidence.mutation_guard,
          before_state: { ...evidence.mutation_guard.before_state, send_count: null },
        },
      },
      { ...evidence, screenshots: { ...evidence.screenshots, rejection: { ...evidence.screenshots.rejection, sha256: '0'.repeat(64) } } },
      { ...evidence, not_applicable_roles: roles.slice(1) },
    ];
    for (const tampered of tamperedVariants) {
      fs.writeFileSync(blockerFile, JSON.stringify(tampered, null, 2));
      const failClosed = buildCoreEvidenceManifest({
        testCase: { id: caseId, evidence_roles: roles },
        caseDir,
        artifacts,
      });
      assert.equal(failClosed.complete, false, `${caseId}: ${JSON.stringify(tampered)}`);
      assert.deepEqual(failClosed.missing_roles, roles, caseId);
    }
    for (const tamperedDialog of [
      {
        ...dialogEvidence,
        playwright_dialog: { ...dialogEvidence.playwright_dialog, accepted: false },
      },
      {
        ...dialogEvidence,
        expected_dialog_message: '上传成功',
      },
    ]) {
      fs.writeFileSync(dialogArtifact, JSON.stringify(tamperedDialog));
      evidence.dialog_evidence.sha256 = createHash('sha256').update(fs.readFileSync(dialogArtifact)).digest('hex');
      fs.writeFileSync(blockerFile, JSON.stringify(evidence, null, 2));
      const tamperedDialogManifest = buildCoreEvidenceManifest({
        testCase: { id: caseId, evidence_roles: roles },
        caseDir,
        artifacts,
      });
      assert.equal(tamperedDialogManifest.complete, false, `${caseId}: dialog receipt tampered`);
      assert.deepEqual(tamperedDialogManifest.missing_roles, roles, caseId);
    }
  }
});

test('click evidence requires before/action/after plus a relevant state transition', () => {
  assert.equal(validateActionEvidence({
    action_id: 'click-create',
    before_screenshot: '/tmp/before.png',
    after_screenshot: '/tmp/after.png',
    receipt: {
      testid: 'expert-create-submit',
      event: 'click',
      dispatched_at: '2026-07-29T00:00:00.000Z',
    },
    state_readback: { expected_state_observed: true },
  }).ok, true);
  assert.equal(validateActionEvidence({
    action_id: 'click-create',
    before_screenshot: '/tmp/before.png',
    after_screenshot: '/tmp/after.png',
    receipt: { testid: 'expert-create-submit', event: 'click', dispatched_at: 'x' },
    state_readback: { changed: false },
  }).ok, false);
});

test('reply evidence rejects a running or unstable partial answer', () => {
  const complete = {
    prompt: '分析附件',
    task_id: 'task-1',
    send_receipt: { accepted: true },
    transcript: 'user: 分析附件\nassistant: 完成',
    reply_delta: '完成',
    status: 'completed',
    stable_sample_count: 2,
    running: false,
  };
  assert.equal(validateReplyEvidence(complete).ok, true);
  assert.equal(validateReplyEvidence({ ...complete, running: true, stable_sample_count: 1 }).ok, false);
});

test('a verified product reply timeout is complete failure evidence, never a successful reply', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'qbot-core-beta-reply-timeout-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const caseDir = path.join(root, 'cases', 'BETA-CHAT-007');
  fs.mkdirSync(caseDir, { recursive: true });
  const transcript = path.join(caseDir, 'transcript.txt');
  const replyDelta = path.join(caseDir, 'reply-delta.txt');
  const timeoutScreenshot = path.join(caseDir, 'turn-2-after-timeout.png');
  fs.writeFileSync(transcript, '## 第 2 轮\n\n## TERMINAL_EVENT\nassistant_reply_present=false\n');
  fs.writeFileSync(replyDelta, '## 第 2 轮\n\n## TERMINAL_EVENT\nassistant_reply_present=false\n');
  fs.writeFileSync(timeoutScreenshot, 'verified-timeout-frame');
  const state = {
    id: 'BETA-CHAT-007',
    contract_version: CORE_BETA_CASEBOOK_CONTRACT_VERSION,
    required_evidence_roles: 'transcript,reply_delta,reply_completion',
    status: 'failed',
    result_category: 'bug',
    screenshots: {
      turn_2_after_timeout: timeoutScreenshot,
    },
    artifacts: {
      transcript,
      reply_delta: replyDelta,
      reply_records: [{
        label: '第 2 轮',
        assistant_reply_present: false,
        terminal_outcome: 'timed_out',
      }],
      reply_waits: [{
        label: '第 2 轮',
        waited_ms: 600_421,
        timeout_ms: 600_000,
        incomplete: true,
      }],
      core_beta_evidence: {
        send_receipt: { available: true, task_id: 'task-1' },
        reply_completion: { available: false, running: true },
      },
    },
  };
  const terminal = verifiedReplyTimeoutTerminalEvidence(state);
  assert.equal(terminal.available, true);
  assert.equal(terminal.completion_observed, false);
  assert.equal(terminal.terminal_outcome, 'timed_out');

  const manifest = buildCaseEvidenceManifest(state, caseDir);
  assert.equal(manifest.complete, true);
  assert.deepEqual(manifest.missing_roles, []);
  assert.equal(manifest.role_evidence.reply_completion.available, true);
  assert.equal(manifest.role_evidence.reply_completion.completion_observed, false);
  assert.equal(manifest.role_evidence.reply_completion.terminal_failure, true);
  assert.equal(manifest.role_evidence.reply_completion.terminal_outcome, 'timed_out');
  assert.equal(manifest.role_evidence.transcript.assistant_reply_present, false);
  assert.equal(manifest.role_evidence.reply_delta.assistant_reply_present, false);

  fs.rmSync(timeoutScreenshot);
  const withoutVisibleTimeout = verifiedReplyTimeoutTerminalEvidence(state);
  assert.equal(withoutVisibleTimeout.available, false);
  const failClosed = buildCaseEvidenceManifest(state, caseDir);
  assert.equal(failClosed.complete, false);
  assert.deepEqual(failClosed.missing_roles, ['reply_completion']);
});

test('verified capability shortage makes an impossible selection role explicit N/A', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'qbot-core-beta-capability-shortage-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const caseDir = path.join(root, 'cases', 'BETA-SKILL-001');
  fs.mkdirSync(caseDir, { recursive: true });
  const inventory = [
    { slug: 'skill-a', category: '办公' },
    { slug: 'skill-b', category: '设计' },
  ];
  const selection = {
    ok: false,
    reason: '可用能力不足：需要 10，实际 2',
    requested_count: 10,
    eligible_count: 2,
    selected: [],
    selected_ids: [],
  };
  const state = {
    id: 'BETA-SKILL-001',
    contract_version: CORE_BETA_CASEBOOK_CONTRACT_VERSION,
    required_evidence_roles: 'capability_inventory,capability_selection',
    status: 'blocked',
    screenshots: {},
    artifacts: {
      core_beta_evidence: {
        capability_inventory: {
          available: true,
          source: 'window.agent.capabilities + visible skill cards',
          inventory,
        },
        capability_selection: {
          available: false,
          source: 'deterministicCapabilitySample',
          selection,
        },
      },
    },
  };
  const blocker = verifiedCapabilitySelectionUnavailableEvidence(state);
  assert.equal(blocker.applicable, true);
  assert.equal(blocker.requested_count, 10);
  assert.equal(blocker.eligible_count, 2);

  const manifest = buildCaseEvidenceManifest(state, caseDir);
  assert.equal(manifest.complete, true);
  assert.deepEqual(manifest.missing_roles, []);
  assert.deepEqual(manifest.required_roles, ['capability_inventory']);
  assert.deepEqual(
    manifest.not_applicable_roles.map((item) => item.role),
    ['capability_selection'],
  );
  assert.equal(manifest.role_evidence.capability_selection.available, true);
  assert.equal(manifest.role_evidence.capability_selection.not_applicable, true);
  assert.equal(manifest.evidence_applicability.capability_selection_blocker.applicable, true);

  state.artifacts.core_beta_evidence.capability_selection.selection.reason = '可用能力不足';
  const unverified = verifiedCapabilitySelectionUnavailableEvidence(state);
  assert.equal(unverified.applicable, false);
  const failClosed = buildCaseEvidenceManifest(state, caseDir);
  assert.equal(failClosed.complete, false);
  assert.deepEqual(failClosed.missing_roles, ['capability_selection']);
});

test('captured capability failures remain complete evidence instead of becoming manifest gaps', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'qbot-core-beta-capability-failure-evidence-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const caseDir = path.join(root, 'cases', 'BETA-EXPERT-001');
  fs.mkdirSync(caseDir, { recursive: true });
  const capturedAt = '2026-07-29T13:02:40.666Z';
  const executionFile = path.join(caseDir, 'expert-task-bound-execution.json');
  fs.writeFileSync(executionFile, `${JSON.stringify({
    kind: 'expert',
    task_id: 'task-1',
    expected_identity: 'expert-1',
    identity_present: false,
    executed: false,
    runtime: {},
    tool_blocks: [],
  })}\n`);
  const state = {
    id: 'BETA-EXPERT-001',
    contract_version: CORE_BETA_CASEBOOK_CONTRACT_VERSION,
    required_evidence_roles: [
      'capability_inventory',
      'capability_selection',
      'capability_execution_event',
    ].join(','),
    status: 'failed',
    screenshots: {},
    artifacts: {
      core_beta_evidence: {
        capability_inventory: {
          available: false,
          captured_at: capturedAt,
          source: 'visible expert cards + window.agent.capabilities',
          inventory: { cards: [], current_expert: null },
        },
        capability_selection: {
          available: false,
          captured_at: capturedAt,
          source: 'created expert ledger + visible expert cards',
          created: [
            { name: '研究专家', id: '', visible: false },
            { name: '数据专家', id: '', visible: false },
            { name: '交付专家', id: '', visible: false },
          ],
        },
        capability_execution_event: {
          available: false,
          captured_at: capturedAt,
          source: executionFile,
          kind: 'expert',
          task_id: 'task-1',
          expected_identity: 'expert-1',
          identity_present: false,
          executed: false,
          runtime: {},
          tool_blocks: [],
        },
      },
    },
  };

  const manifest = buildCaseEvidenceManifest(state, caseDir);
  assert.equal(manifest.complete, true);
  assert.deepEqual(manifest.missing_roles, []);
  for (const role of ['capability_inventory', 'capability_selection', 'capability_execution_event']) {
    assert.equal(manifest.role_evidence[role].available, true);
    assert.equal(manifest.role_evidence[role].evidence_captured, true);
    assert.equal(manifest.role_evidence[role].outcome_satisfied, false);
  }

  delete state.artifacts.core_beta_evidence.capability_selection.created;
  const malformed = buildCaseEvidenceManifest(state, caseDir);
  assert.equal(malformed.complete, false);
  assert.deepEqual(malformed.missing_roles, ['capability_selection']);

  fs.rmSync(executionFile);
  const missingExecutionArtifact = buildCaseEvidenceManifest(state, caseDir);
  assert.ok(missingExecutionArtifact.missing_roles.includes('capability_execution_event'));
});

test('product oracle failure remains valid product_state_diff evidence', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'qbot-core-beta-product-state-diff-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const evidenceFile = path.join(root, 'expert-owned-release-projection.json');
  fs.writeFileSync(evidenceFile, `${JSON.stringify({
    valid: true,
    evidence_valid: true,
    oracle_valid: false,
    expected_owned_ids: ['expert-1'],
    visible_ids: [],
    nav_text: '',
  })}\n`);
  assert.deepEqual(
    validateEvidenceFile('product_state_diff', evidenceFile),
    { valid: true },
    '结构完整的产品失败读回必须进入可信Bug复核，而不是造成manifest invalid',
  );
});

test('verified skill shortage propagates to dependent cases without executing product actions', () => {
  const blocker = {
    applicable: true,
    kind: 'skill_sample_shortage',
    source: 'deterministicCapabilitySample',
    source_case_id: 'BETA-SKILL-001',
    reason: '可用能力不足：需要 10，实际 2',
    requested_count: 10,
    eligible_count: 2,
    selected: [],
    selected_ids: [],
  };
  const ledger = {
    skills: {
      inventory: [
        { slug: 'skill-a', category: '办公' },
        { slug: 'skill-b', category: '设计' },
      ],
      sample: [],
      selection_blocker: blocker,
    },
  };
  const dependent = coreBetaSharedCapabilityPrerequisiteBlocker(ledger, {
    case_type: 'skill_lifecycle',
    parsed: {
      action_plan: [{ command: 'install_ten_skills_serially' }],
    },
  });
  assert.equal(dependent.applicable, true);
  assert.equal(dependent.source_case_id, 'BETA-SKILL-001');
  assert.equal(dependent.propagated_to_case_type, 'skill_lifecycle');

  const sourceSampler = coreBetaSharedCapabilityPrerequisiteBlocker(ledger, {
    case_type: 'skill_lifecycle',
    parsed: {
      action_plan: [{ command: 'sample_ten_skills' }],
    },
  });
  assert.equal(sourceSampler.applicable, false);

  const tampered = structuredClone(ledger);
  tampered.skills.selection_blocker.reason = '能力不足';
  assert.equal(
    coreBetaSharedCapabilityPrerequisiteBlocker(tampered, {
      case_type: 'skill_use',
      parsed: { action_plan: [{ command: 'select_skill_by_slug' }] },
    }).applicable,
    false,
  );
});

test('a propagated capability blocker also makes selection evidence explicit N/A', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'qbot-core-beta-shared-capability-blocker-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const caseDir = path.join(root, 'cases', 'BETA-SKILL-002');
  fs.mkdirSync(caseDir, { recursive: true });
  const inventory = [{ slug: 'skill-a' }, { slug: 'skill-b' }];
  const selection = {
    applicable: true,
    kind: 'skill_sample_shortage',
    source: 'deterministicCapabilitySample',
    reason: '可用能力不足：需要 10，实际 2',
    requested_count: 10,
    eligible_count: 2,
    selected: [],
    selected_ids: [],
  };
  const state = {
    id: 'BETA-SKILL-002',
    contract_version: CORE_BETA_CASEBOOK_CONTRACT_VERSION,
    required_evidence_roles: [
      'capability_inventory',
      'capability_selection',
      'capability_execution_event',
      'prompt',
      'send_receipt',
      'task_id',
      'transcript',
      'reply_delta',
      'reply_completion',
    ].join(','),
    status: 'blocked',
    screenshots: {},
    artifacts: {
      core_beta_shared_prerequisite_blocker: selection,
      core_beta_evidence: {
        capability_inventory: {
          available: true,
          source: 'verified shared capability prerequisite inventory',
          inventory,
        },
        capability_selection: {
          available: false,
          source: 'verified_shared_capability_prerequisite_blocker',
          selection,
        },
      },
    },
  };
  const verified = verifiedCapabilitySelectionUnavailableEvidence(state);
  assert.equal(verified.applicable, true);
  assert.equal(verified.propagation_source, 'shared_prerequisite_ledger');
  const manifest = buildCaseEvidenceManifest(state, caseDir);
  assert.equal(manifest.complete, true);
  assert.deepEqual(manifest.missing_roles, []);
  assert.equal(manifest.role_evidence.capability_selection.not_applicable, true);
  assert.deepEqual(
    manifest.not_applicable_roles.map((item) => item.role),
    [
      'capability_selection',
      'capability_execution_event',
      'prompt',
      'send_receipt',
      'task_id',
      'transcript',
      'reply_delta',
      'reply_completion',
    ],
  );
  assert.ok(manifest.not_applicable_roles.every(
    (item) => item.source === 'verified_capability_inventory_shortage',
  ));
});

test('an exact visible skill selection failure before send makes only post-selection evidence N/A', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'qbot-core-beta-pre-send-skill-selection-failure-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const caseDir = path.join(root, 'cases', 'BETA-SKILL-007');
  fs.mkdirSync(caseDir, { recursive: true });
  const capturedAt = '2026-07-30T11:37:34.943Z';
  const selectionFailureScreenshot = path.join(caseDir, 'selection-failure.png');
  fs.writeFileSync(selectionFailureScreenshot, 'selection-failure');
  const emptySelection = {
    selectedSkillCount: 0,
    selectedSkills: [],
  };
  const state = {
    id: 'BETA-SKILL-007',
    contract_version: CORE_BETA_CASEBOOK_CONTRACT_VERSION,
    required_evidence_roles: [
      'prompt',
      'task_id',
      'send_receipt',
      'transcript',
      'reply_delta',
      'reply_completion',
      'capability_selection',
      'capability_execution_event',
    ].join(','),
    status: 'failed',
    screenshots: {},
    artifacts: {
      final_task_identity: {
        active_id: '',
        message_count: 0,
      },
      core_beta_evidence: {
        capability_selection: {
          available: false,
          captured_at: capturedAt,
          source: 'visible composer Skill option click + chip + window.agent.capabilities.selectedSkills',
          expected: {
            slug: 'qfin-ppt-brand-assets',
            installed: false,
          },
          snapshot: emptySelection,
        },
        action_receipt: {
          available: true,
          captured_at: capturedAt,
          receipts: [
            {
              command: 'select_skill_via_composer_button',
              event: 'select-visible-composer-skill',
              expected_state_observed: false,
              actual: 'expected=qfin-ppt-brand-assets；selected=[]；chips=0',
              state_readback: emptySelection,
              after_screenshot: selectionFailureScreenshot,
            },
            {
              command: 'run_two_turn_skill_task',
              event: 'skipped-after-failed-prerequisite',
              state_readback: {
                stopped_by_command: 'select_skill_via_composer_button',
              },
            },
          ],
        },
        public_state_readback: {
          available: true,
          captured_at: capturedAt,
          source: 'final public capabilities + task state',
          active_id: '',
          running: false,
          message_count: 0,
        },
      },
    },
  };

  const verified = verifiedCapabilitySelectionUnavailableEvidence(state);
  assert.equal(verified.applicable, true);
  assert.equal(verified.propagation_source, 'current_case_pre_send_selection_failure');
  const manifest = buildCaseEvidenceManifest(state, caseDir);
  assert.equal(manifest.complete, true);
  assert.deepEqual(manifest.missing_roles, []);
  assert.equal(manifest.role_evidence.capability_selection.available, true);
  assert.equal(manifest.role_evidence.capability_selection.outcome_satisfied, false);
  assert.equal(manifest.role_evidence.capability_selection.not_applicable, undefined);
  assert.deepEqual(
    manifest.not_applicable_roles.map((item) => item.role),
    [
      'capability_execution_event',
      'prompt',
      'send_receipt',
      'task_id',
      'transcript',
      'reply_delta',
      'reply_completion',
    ],
  );

  state.artifacts.core_beta_evidence.action_receipt.receipts[1].event = 'send-attempted';
  const failClosed = verifiedCapabilitySelectionUnavailableEvidence(state);
  assert.equal(failClosed.applicable, false);
  const incompleteManifest = buildCaseEvidenceManifest(state, caseDir);
  assert.equal(incompleteManifest.complete, false);
  assert.ok(incompleteManifest.missing_roles.includes('prompt'));
});

test('an exact visible MCP selection failure before send makes conversation and execution evidence N/A', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'qbot-core-beta-pre-send-mcp-selection-failure-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const caseDir = path.join(root, 'cases', 'BETA-MCP-003');
  fs.mkdirSync(caseDir, { recursive: true });
  const capturedAt = '2026-07-30T12:26:49.485Z';
  const selectionFailureScreenshot = path.join(caseDir, 'selection-failure.png');
  fs.writeFileSync(selectionFailureScreenshot, 'selection-failure');
  const emptySelection = {
    selectedConnectorCount: 0,
    selectedConnectors: [],
    selectedIdentities: [],
    chipCount: 0,
    connectorRouting: { mode: 'manual' },
  };
  const state = {
    id: 'BETA-MCP-003',
    contract_version: CORE_BETA_CASEBOOK_CONTRACT_VERSION,
    required_evidence_roles: [
      'prompt',
      'task_id',
      'send_receipt',
      'transcript',
      'reply_delta',
      'reply_completion',
      'capability_selection',
      'capability_execution_event',
    ].join(','),
    status: 'failed',
    screenshots: {},
    artifacts: {
      final_task_identity: {
        active_id: '',
        message_count: 0,
      },
      core_beta_evidence: {
        capability_selection: {
          available: false,
          captured_at: capturedAt,
          source: 'visible connector chip + window.agent.capabilities',
          expected: {
            key: 'mcphub:wecom',
          },
          snapshot: emptySelection,
        },
        action_receipt: {
          available: true,
          captured_at: capturedAt,
          receipts: [
            {
              command: 'select_connector_by_key',
              event: 'select',
              expected_state_observed: false,
              actual: 'expected=mcphub:wecom；selected=[]；chips=0；mode=manual',
              state_readback: emptySelection,
              after_screenshot: selectionFailureScreenshot,
            },
            {
              command: 'run_mcp_turn_1',
              event: 'skipped-after-failed-prerequisite',
              state_readback: {
                stopped_by_command: 'select_connector_by_key',
              },
            },
          ],
        },
        public_state_readback: {
          available: true,
          captured_at: capturedAt,
          source: 'final public capabilities + task state',
          active_id: '',
          running: false,
          message_count: 0,
        },
      },
    },
  };

  const verified = verifiedCapabilitySelectionUnavailableEvidence(state);
  assert.equal(verified.applicable, true);
  assert.equal(verified.expected_identity, 'mcphub:wecom');
  assert.equal(verified.failed_selection_command, 'select_connector_by_key');
  assert.equal(verified.propagation_source, 'current_case_pre_send_selection_failure');
  const manifest = buildCaseEvidenceManifest(state, caseDir);
  assert.equal(manifest.complete, true);
  assert.deepEqual(manifest.missing_roles, []);
  assert.equal(manifest.role_evidence.capability_selection.available, true);
  assert.equal(manifest.role_evidence.capability_selection.outcome_satisfied, false);
  assert.deepEqual(
    manifest.not_applicable_roles.map((item) => item.role),
    [
      'capability_execution_event',
      'prompt',
      'send_receipt',
      'task_id',
      'transcript',
      'reply_delta',
      'reply_completion',
    ],
  );

  state.artifacts.core_beta_evidence.action_receipt.receipts[1].event = 'send-attempted';
  assert.equal(verifiedCapabilitySelectionUnavailableEvidence(state).applicable, false);
  assert.equal(buildCaseEvidenceManifest(state, caseDir).complete, false);
});

test('Skill persistence selection failure keeps strict visible no-send evidence complete', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'qbot-core-beta-skill-persistence-selection-failure-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const caseDir = path.join(root, 'cases', 'BETA-SKILL-011');
  fs.mkdirSync(caseDir, { recursive: true });
  const before = path.join(caseDir, '01-before.png');
  const after = path.join(caseDir, '03-assertion.png');
  const selectionFailureScreenshot = path.join(caseDir, 'selection-failure.png');
  fs.writeFileSync(before, 'before');
  fs.writeFileSync(after, 'after');
  fs.writeFileSync(selectionFailureScreenshot, 'selection-failure');
  const capturedAt = '2026-07-30T12:10:34.903Z';
  const emptySelection = {
    selectedSkillCount: 0,
    selectedSkills: [],
    chipCount: 0,
  };
  const state = {
    id: 'BETA-SKILL-011',
    contract_version: CORE_BETA_CASEBOOK_CONTRACT_VERSION,
    required_evidence_roles: [
      'before_screenshot',
      'action_receipt',
      'after_screenshot',
      'prompt',
      'task_id',
      'send_receipt',
      'transcript',
      'reply_delta',
      'reply_completion',
      'capability_selection',
      'capability_execution_event',
    ].join(','),
    status: 'failed',
    screenshots: { before, final: after },
    steps: [],
    assertions: [],
    artifacts: {
      final_task_identity: { active_id: '', message_count: 0 },
      core_beta_evidence: {
        capability_selection: {
          available: false,
          captured_at: capturedAt,
          source: 'visible composer skill selection pre-send gate',
          expected: { slug: 'column-lineage-analysis' },
          snapshot: emptySelection,
        },
        action_receipt: {
          available: true,
          captured_at: capturedAt,
          receipts: [
            {
              command: 'verify_skill_selection_persistence',
              event: 'selection-precondition-failed',
              expected_state_observed: false,
              after_screenshot: selectionFailureScreenshot,
              state_readback: {
                selected: { slug: 'column-lineage-analysis' },
                selectedOk: false,
                before: emptySelection,
              },
            },
            {
              command: 'verify_cross_task_skill_isolation',
              event: 'skipped-after-failed-prerequisite',
              state_readback: {
                stopped_by_command: 'verify_skill_selection_persistence',
              },
            },
          ],
        },
        public_state_readback: {
          available: true,
          captured_at: capturedAt,
          source: 'final public capabilities + task state',
          active_id: '',
          running: false,
          message_count: 0,
        },
      },
    },
  };

  const verified = verifiedCapabilitySelectionUnavailableEvidence(state);
  assert.equal(verified.applicable, true);
  assert.equal(verified.failed_selection_command, 'verify_skill_selection_persistence');
  assert.equal(verified.propagation_source, 'current_case_pre_send_selection_failure');
  const manifest = buildCaseEvidenceManifest(state, caseDir);
  assert.equal(manifest.complete, true);
  assert.deepEqual(manifest.missing_roles, []);
  assert.equal(manifest.role_evidence.capability_selection.available, true);
  assert.equal(manifest.role_evidence.capability_selection.outcome_satisfied, false);

  state.result_category = 'automation_error';
  state.title = '已安装技能应能在 Composer 中选中并保持';
  state.steps = [
    {
      action: '手动选择刚安装的技能',
      expected: '技能 chip 和公共能力状态均读回目标技能',
      actual: '点击目标技能后选中数量=0，技能 chip 未出现。',
      status: 'failed',
      category: 'automation_error',
      numbered_step_number: 1,
      numbered_step_declared: '手动选择刚安装的技能',
      numbered_step_evidence: 'explicit',
    },
    {
      action: '验证跨任务技能隔离',
      expected: '只在技能选中后执行',
      actual: '前置选择失败，已 fail-closed 禁止后续操作。',
      status: 'failed',
      category: 'not_applicable',
      numbered_step_number: 2,
      numbered_step_declared: '验证跨任务技能隔离',
      numbered_step_evidence: 'explicit',
    },
  ];
  state.assertions = [{
    name: '技能选中状态',
    expected: '点击目标技能后出现选中 chip',
    actual: '点击目标技能后选中数量=0，技能 chip 未出现。',
    status: 'failed',
    category: 'bug',
  }];
  state.screenshots = { skill_selection_failed: selectionFailureScreenshot };
  state.artifacts.numbered_step_coverage = {
    schema_version: 2,
    declared_count: 2,
    complete: true,
    entries: [
      {
        number: 1,
        covered: true,
        evidence_mode: 'explicit_numbered_step',
        explicit_actions: ['手动选择刚安装的技能'],
      },
      {
        number: 2,
        covered: true,
        evidence_mode: 'explicit_numbered_step',
        explicit_actions: ['验证跨任务技能隔离'],
      },
    ],
  };
  state.evidence_manifest = {
    contract_version: CORE_BETA_CASEBOOK_CONTRACT_VERSION,
    complete: true,
    required_role_count: manifest.required_role_count,
    satisfied_role_count: manifest.required_role_count,
    missing_roles: [],
  };
  const trusted = assessUserCenteredOutcome(state);
  assert.equal(trusted.classification, 'bug');
  assert.equal(trusted.gates.no_automation_error, true);
  assert.equal(trusted.gates.product_action_exercised, true);
});

test('a verified missing created expert blocks before send and makes conversation evidence N/A', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'qbot-core-beta-missing-created-expert-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const caseDir = path.join(root, 'cases', 'BETA-EXPERT-005');
  fs.mkdirSync(caseDir, { recursive: true });
  const expected = {
    name: 'QBot内测交付专家-abc123',
    id: '',
    create_ok: false,
    create_visible: false,
  };
  const visibleExperts = [
    { name: 'QBot内测研究专家-abc123', id: 'research-1' },
    { name: 'QBot内测数据专家-abc123', id: 'data-1' },
  ];
  const blocker = {
    applicable: true,
    kind: 'created_expert_missing',
    source: 'created_expert_ledger + visible_expert_inventory',
    source_case_id: 'BETA-EXPERT-001',
    role: 'delivery',
    expected_expert: expected,
    visible_experts: visibleExperts,
    selection_result: {
      ok: false,
      reason: '专家卡不存在：QBot内测交付专家-abc123',
    },
    reason: '本轮声明创建的 delivery 专家在真实专家列表中不存在：QBot内测交付专家-abc123',
  };
  const screenshot = path.join(caseDir, 'step.png');
  fs.writeFileSync(screenshot, 'image');
  const receipts = [1, 2, 3].map((number) => ({
    action_id: `expert-${number}`,
    number,
    command: number === 1 ? 'summon_expert_by_id' : number === 2 ? 'run_three_expert_turns' : 'verify_expert_delivery_result',
    event: number === 1 ? 'verified-expert-prerequisite-blocked' : 'prerequisite-blocked',
    dispatched_at: '2026-07-29T00:00:00.000Z',
    completed_at: '2026-07-29T00:00:01.000Z',
    before_screenshot: screenshot,
    after_screenshot: screenshot,
    expected_state_observed: false,
    state_readback: blocker,
    actual: blocker.reason,
  }));
  const state = {
    id: 'BETA-EXPERT-005',
    contract_version: CORE_BETA_CASEBOOK_CONTRACT_VERSION,
    required_evidence_roles: [
      'action_receipt',
      'prompt',
      'task_id',
      'send_receipt',
      'transcript',
      'reply_delta',
      'reply_completion',
      'capability_selection',
      'capability_execution_event',
    ].join(','),
    status: 'blocked',
    screenshots: {},
    artifacts: {
      core_beta_action_receipts: receipts,
      core_beta_expert_prerequisite_blocker: blocker,
      core_beta_evidence: {
        action_receipt: {
          available: true,
          captured_at: '2026-07-29T00:00:02.000Z',
          source: 'core-beta exact action-plan executor',
          receipts,
        },
        capability_inventory: {
          available: true,
          captured_at: '2026-07-29T00:00:02.000Z',
          source: 'visible expert inventory after exact summon failure',
          inventory: visibleExperts,
        },
        capability_selection: {
          available: false,
          captured_at: '2026-07-29T00:00:02.000Z',
          source: 'verified_expert_prerequisite_blocker',
          selection: blocker,
          result: blocker.selection_result,
        },
      },
    },
  };
  const verified = verifiedExpertSelectionUnavailableEvidence(state);
  assert.equal(verified.applicable, true);
  const manifest = buildCaseEvidenceManifest(state, caseDir);
  assert.equal(manifest.complete, true);
  assert.deepEqual(manifest.missing_roles, []);
  assert.equal(manifest.role_evidence.capability_selection.available, true);
  assert.equal(manifest.role_evidence.capability_selection.outcome_satisfied, false);
  assert.deepEqual(
    manifest.not_applicable_roles.map((item) => item.role),
    [
      'capability_execution_event',
      'prompt',
      'send_receipt',
      'task_id',
      'transcript',
      'reply_delta',
      'reply_completion',
    ],
  );
});

test('core beta shared state resumes only from an exact pre-impact checkpoint', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'qbot-core-beta-shared-checkpoint-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const sourceOut = path.join(root, 'source');
  const currentOut = path.join(root, 'current');
  fs.mkdirSync(sourceOut, { recursive: true });
  const selectedCases = ['BETA-INIT-001', 'BETA-EXPERT-001', 'BETA-EXPERT-005']
    .map((id) => ({
      id,
      contract_version: CORE_BETA_CASEBOOK_CONTRACT_VERSION,
    }));
  fs.writeFileSync(path.join(sourceOut, 'automation-progress.json'), `${JSON.stringify({
    completed: 2,
    results: selectedCases.slice(0, 2).map(({ id }) => ({ id })),
  })}\n`);
  fs.writeFileSync(path.join(sourceOut, 'core-beta-shared-ledger.json'), `${JSON.stringify({
    schema_version: 1,
    skills: { inventory: [], sample: [], installed: [], used: [] },
    experts: {
      before: [],
      created: [{ role: 'delivery', name: 'QBot内测交付专家-abc123' }],
      used: [],
    },
    mcp: { inventory: [], sample: [], used: [] },
    tasks: {},
  })}\n`);
  const seeded = seedCoreBetaSharedLedgerCheckpoint({
    sourceOut,
    currentOut,
    selectedCases,
    impact: { all: false, case_ids: ['BETA-EXPERT-005'] },
    seededAt: '2026-07-29T00:00:00.000Z',
  });
  assert.equal(seeded.applicable, true);
  assert.equal(seeded.first_impact_order, 3);
  assert.equal(seeded.source_result_count, 2);
  assert.equal(seeded.source_ledger_sha256, seeded.current_ledger_sha256);
  assert.ok(fs.existsSync(path.join(currentOut, 'core-beta-shared-ledger-lineage.json')));

  const unsafeCurrent = path.join(root, 'unsafe-current');
  fs.writeFileSync(path.join(sourceOut, 'automation-progress.json'), `${JSON.stringify({
    completed: 3,
    results: selectedCases.map(({ id }) => ({ id })),
  })}\n`);
  assert.throws(() => seedCoreBetaSharedLedgerCheckpoint({
    sourceOut,
    currentOut: unsafeCurrent,
    selectedCases,
    impact: { all: false, case_ids: ['BETA-EXPERT-005'] },
  }), /源继承共享账本快照缺失.*BETA-EXPERT-001/);
  assert.equal(fs.existsSync(path.join(unsafeCurrent, 'core-beta-shared-ledger.json')), false);
});

test('core beta shared state restores inherited prerequisite snapshots per capability domain', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'qbot-core-beta-domain-snapshots-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const sourceOut = path.join(root, 'source');
  const currentOut = path.join(root, 'current');
  fs.mkdirSync(sourceOut, { recursive: true });
  const selectedCases = [
    { id: 'BETA-CHAT-006', case_type: 'conversation' },
    { id: 'BETA-SKILL-001', case_type: 'skill_lifecycle' },
    { id: 'BETA-SKILL-002', case_type: 'skill_lifecycle' },
    { id: 'BETA-SKILL-005', case_type: 'skill_lifecycle' },
    { id: 'BETA-MCP-001', case_type: 'mcp_lifecycle' },
    { id: 'BETA-MCP-002', case_type: 'mcp_use' },
  ].map((item) => ({
    ...item,
    contract_version: CORE_BETA_CASEBOOK_CONTRACT_VERSION,
  }));
  const results = selectedCases.map((testCase, index) => {
    const caseDir = path.join(sourceOut, 'cases', `${index + 1}-${testCase.id}`);
    fs.mkdirSync(caseDir, { recursive: true });
    const ledger = {
      schema_version: 1,
      skills: {
        inventory: index >= 2 ? [{ slug: 'skill-a' }] : [],
        sample: index >= 2 ? [{ slug: 'skill-a' }] : [],
        installed: index >= 2 ? [{ slug: 'skill-a', ok: true }] : [],
        used: [],
      },
      experts: { before: [], created: [], used: [] },
      mcp: {
        inventory: index >= 4 ? [{ key: 'builtin:qbot_vision' }] : [],
        sample: index >= 4 ? [{ key: 'builtin:qbot_vision' }] : [],
        used: [],
      },
      tasks: {},
    };
    fs.writeFileSync(
      path.join(caseDir, 'core-beta-shared-ledger-after.json'),
      `${JSON.stringify(ledger)}\n`,
    );
    return { id: testCase.id, case_dir: caseDir };
  });
  fs.writeFileSync(
    path.join(sourceOut, 'automation-progress.json'),
    `${JSON.stringify({ completed: selectedCases.length, results })}\n`,
  );
  fs.writeFileSync(
    path.join(sourceOut, 'core-beta-shared-ledger.json'),
    fs.readFileSync(path.join(results.at(-1).case_dir, 'core-beta-shared-ledger-after.json')),
  );

  const seeded = seedCoreBetaSharedLedgerCheckpoint({
    sourceOut,
    currentOut,
    selectedCases,
    impact: {
      all: false,
      case_ids: ['BETA-CHAT-006', 'BETA-SKILL-005', 'BETA-MCP-002'],
    },
    seededAt: '2026-07-30T00:00:00.000Z',
  });
  assert.equal(seeded.applicable, true);
  assert.equal(seeded.source, 'per_domain_inherited_case_shared_state_snapshots');
  assert.deepEqual(
    seeded.inherited_snapshots.map((item) => item.case_id),
    ['BETA-SKILL-001', 'BETA-SKILL-002', 'BETA-MCP-001'],
  );
  assert.equal(fs.existsSync(path.join(currentOut, 'core-beta-shared-ledger.json')), false);

  for (const index of [1, 2, 4]) {
    const restored = restoreCoreBetaSharedLedgerAfterInheritedCase({
      currentOut,
      result: { ...results[index], execution_provenance: 'inherited' },
      testCase: selectedCases[index],
      order: index + 1,
      restoredAt: `2026-07-30T00:00:0${index}.000Z`,
    });
    assert.equal(restored.applicable, true);
    if (index === 1) {
      const currentLedgerFile = path.join(currentOut, 'core-beta-shared-ledger.json');
      const inProgressLedger = JSON.parse(fs.readFileSync(currentLedgerFile, 'utf8'));
      inProgressLedger.tasks['rerun-chat-task'] = { task_id: 'rerun-chat-task' };
      fs.writeFileSync(currentLedgerFile, `${JSON.stringify(inProgressLedger)}\n`);
    }
  }
  const currentLedger = JSON.parse(
    fs.readFileSync(path.join(currentOut, 'core-beta-shared-ledger.json'), 'utf8'),
  );
  assert.deepEqual(currentLedger.skills.sample.map((item) => item.slug), ['skill-a']);
  assert.deepEqual(currentLedger.mcp.sample.map((item) => item.key), ['builtin:qbot_vision']);
  assert.equal(currentLedger.tasks['rerun-chat-task'].task_id, 'rerun-chat-task');
  const lineage = JSON.parse(
    fs.readFileSync(path.join(currentOut, 'core-beta-shared-ledger-lineage.json'), 'utf8'),
  );
  assert.deepEqual(
    lineage.restored_snapshots.map((item) => item.case_id),
    ['BETA-SKILL-001', 'BETA-SKILL-002', 'BETA-MCP-001'],
  );
});

test('batch collection uses one shared deadline instead of multiplying timeout by task count', () => {
  const collectionStartedAtMs = Date.parse('2026-07-29T00:00:20.000Z');
  const entries = Array.from({ length: 20 }, (_, index) => ({
    dispatched_at: new Date(Date.parse('2026-07-29T00:00:00.000Z') + (index * 1000)).toISOString(),
  }));
  const deadline = coreBetaBatchSharedDeadline(entries, 600_000, collectionStartedAtMs);
  assert.equal(deadline.additive_per_task_timeout, false);
  assert.equal(deadline.latest_dispatch_at_ms, Date.parse('2026-07-29T00:00:19.000Z'));
  assert.equal(deadline.deadline_at_ms, Date.parse('2026-07-29T00:10:19.000Z'));
  assert.equal(
    deadline.deadline_at_ms - deadline.latest_dispatch_at_ms,
    600_000,
  );
  assert.ok(deadline.deadline_at_ms - collectionStartedAtMs < 20 * 600_000);
});

test('batch dispatch contract requires configurable long replies and a pending pool threshold', () => {
  const testCase = conversationCase();
  const actions = JSON.parse(testCase.action_plan_json);
  actions.splice(1, 0, {
    number: 2,
    action_id: 'batch-dispatch',
    declared_step: '逐条派发后立即切换',
    command: 'dispatch_batch_without_wait',
    expected_state: 'batch_dispatched',
    evidence_roles: ['before_screenshot', 'action_receipt', 'after_screenshot'],
  });
  actions.forEach((action, index) => { action.number = index + 1; });
  testCase.steps = actions.map((action) => `${action.number}. ${action.declared_step}`).join('\n');
  testCase.action_plan_json = JSON.stringify(actions);
  testCase.assertion_contract_json = JSON.stringify({
    pass_rule: '所有硬断言通过',
    fail_rule: '产品行为与预期不符',
    block_rule: '环境或能力前置不满足',
    batch_min_pending_after_dispatch: 5,
    batch_reply_min_chars: 2000,
  });
  assert.equal(validateCoreBetaCase(testCase).ok, true);

  const missingThreshold = {
    ...testCase,
    assertion_contract_json: JSON.stringify({
      pass_rule: '所有硬断言通过',
      fail_rule: '产品行为与预期不符',
      block_rule: '环境或能力前置不满足',
    }),
  };
  const audit = validateCoreBetaCase(missingThreshold);
  assert.equal(audit.ok, false);
  assert.ok(audit.errors.some((item) => item.includes('batch_min_pending_after_dispatch')));
  assert.ok(audit.errors.some((item) => item.includes('batch_reply_min_chars')));
});

test('batch pending pool evidence fails closed when too few dispatched tasks are visibly running', () => {
  const taskIds = Array.from({ length: 20 }, (_, index) => `task-${index + 1}`);
  const enough = coreBetaBatchPendingPoolEvidence(taskIds.map((taskId, index) => ({
    task_id: taskId,
    item_present: true,
    running_indicator_present: index < 5,
    running_indicator_visible: index < 4,
  })), {
    expectedTaskIds: taskIds,
    minimumPending: 5,
    capturedAt: '2026-07-29T00:00:00.000Z',
  });
  assert.equal(enough.available, true);
  assert.equal(enough.completion_observed, true);
  assert.equal(enough.pending_count, 5);
  assert.equal(enough.visible_pending_count, 4);

  const tooFew = coreBetaBatchPendingPoolEvidence(taskIds.map((taskId, index) => ({
    task_id: taskId,
    item_present: true,
    running_indicator_present: index < 4,
    running_indicator_visible: index < 4,
  })), {
    expectedTaskIds: taskIds,
    minimumPending: 5,
  });
  assert.equal(tooFew.available, true);
  assert.equal(tooFew.completion_observed, false);
  assert.match(tooFew.reason, /低于要求 5 条/);

  const missingTask = coreBetaBatchPendingPoolEvidence(taskIds.slice(0, 19).map((taskId) => ({
    task_id: taskId,
    item_present: true,
  })), {
    expectedTaskIds: taskIds,
    minimumPending: 5,
  });
  assert.equal(missingTask.available, false);
  assert.equal(missingTask.completion_observed, false);
});

test('an attachment collect step sends when no task-bound readback exists', () => {
  assert.equal(coreBetaAttachmentCollectNeedsSend(undefined), true);
  assert.equal(coreBetaAttachmentCollectNeedsSend(null), true);
  assert.equal(coreBetaAttachmentCollectNeedsSend({ available: false }), true);
  assert.equal(coreBetaAttachmentCollectNeedsSend({
    available: true,
    task_id: 'task-1',
    source_names: ['fixture.png'],
    reply_sha256: 'a'.repeat(64),
  }), false);
});

test('a cancelled DOM paste return remains a successful dispatch when the attachment is observed', () => {
  const paste = {
    dispatched: true,
    dispatch_returned: false,
    default_prevented: true,
    before_count: 2,
    after_count: 3,
    visible: true,
  };
  assert.equal(coreBetaClipboardPasteObserved(paste), true);

  const verdict = coreBetaAttachmentIngressVerdict({
    picker: { status: 'passed' },
    drag: { dropped: true },
    paste,
    expectedNames: ['picker.txt', 'drag.json', 'paste.png'],
    afterIngress: {
      count: 3,
      names: ['picker.txt', 'drag.json', 'paste.png'],
    },
  });
  assert.deepEqual(verdict, {
    valid: true,
    evidence_valid: true,
    oracle_valid: true,
  });
});

test('attachment product-oracle failure stays complete evidence and remains collectable', () => {
  const verdict = coreBetaAttachmentIngressVerdict({
    picker: { status: 'passed' },
    drag: { dropped: true },
    paste: {
      dispatched: true,
      dispatch_returned: true,
      before_count: 2,
      after_count: 2,
      visible: false,
    },
    expectedNames: ['picker.txt', 'drag.json', 'paste.png'],
    afterIngress: {
      count: 2,
      names: ['picker.txt', 'drag.json'],
    },
  });
  assert.equal(verdict.evidence_valid, true);
  assert.equal(verdict.oracle_valid, false);

  const evidence = coreBetaAttachmentEvidenceEnvelope({
    schema_version: 1,
    ingress_verdict: verdict,
    reply_referenced_all: false,
  }, false);
  assert.equal(evidence.valid, true);
  assert.equal(evidence.evidence_valid, true);
  assert.equal(evidence.oracle_valid, false);
});

test('a fully evidenced partial batch deadline is complete failure evidence and never success', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'qbot-core-beta-batch-terminal-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const entries = Array.from({ length: 20 }, (_, index) => {
    const dispatchScreenshot = path.join(root, `dispatch-${index + 1}.png`);
    const terminalScreenshot = path.join(root, `terminal-${index + 1}.png`);
    fs.writeFileSync(dispatchScreenshot, `dispatch-${index + 1}`.padEnd(256, 'x'));
    fs.writeFileSync(terminalScreenshot, `terminal-${index + 1}`.padEnd(256, 'x'));
    const completed = index < 9;
    return {
      index,
      task_id: `task-${index + 1}`,
      dispatched_at: `2026-07-29T00:00:${String(index).padStart(2, '0')}.000Z`,
      dispatch_screenshot: dispatchScreenshot,
      send_receipt: {
        confirmed: true,
        confirmed_at: '2026-07-29T00:00:30.000Z',
      },
      observation_count: 3,
      last_observation: {
        active_task_id: `task-${index + 1}`,
        assistant_reply_present: completed,
        running: !completed,
      },
      terminal_outcome: completed ? 'reply_completed' : 'running_at_batch_deadline',
      terminal_at: '2026-07-29T00:10:30.000Z',
      terminal_screenshot: terminalScreenshot,
      ok: completed,
    };
  });
  const evidence = coreBetaBatchTerminalEvidence(entries, {
    deadlineAtMs: Date.parse('2026-07-29T00:10:19.000Z'),
    deadlineReached: true,
  });
  assert.equal(evidence.available, true);
  assert.equal(evidence.completion_observed, false);
  assert.equal(evidence.terminal_failure, true);
  assert.equal(evidence.terminal_outcome, 'batch_partial_timeout');
  assert.equal(evidence.dispatched, 20);
  assert.equal(evidence.completed, 9);
  assert.equal(evidence.failed_or_timed_out, 11);
  assert.equal(evidence.task_ids_unique, true);
  assert.equal(evidence.dispatch_receipts_complete, true);
  assert.equal(evidence.terminal_rows_complete, true);

  const replyCompletion = coreBetaBatchReplyCompletionPayload(entries, evidence, {
    timeoutMs: 600_000,
    minWaitMs: 60_000,
  });
  assert.equal(replyCompletion.complete, false);
  assert.equal(replyCompletion.evidence_complete, true);
  assert.equal(replyCompletion.terminal_failure, true);
  assert.equal(replyCompletion.terminal_outcome, 'timed_out');
  assert.equal(replyCompletion.reply_count, 20);
  assert.equal(replyCompletion.confirmed_send_receipt, true);
  assert.equal(replyCompletion.batch_terminal_screenshots.length, 20);
  assert.match(replyCompletion.terminal_screenshot_sha256, /^[a-f0-9]{64}$/);
  assert.equal(validateReplyCompletionPayload(replyCompletion).valid, true);

  fs.rmSync(entries[9].terminal_screenshot);
  const missingTerminalFrame = coreBetaBatchTerminalEvidence(entries, {
    deadlineAtMs: Date.parse('2026-07-29T00:10:19.000Z'),
    deadlineReached: true,
  });
  assert.equal(missingTerminalFrame.available, false);
  assert.equal(missingTerminalFrame.terminal_rows_complete, false);

  fs.writeFileSync(entries[9].terminal_screenshot, 'restored'.padEnd(256, 'x'));
  entries[10].send_receipt.confirmed = false;
  const missingSendReceipt = coreBetaBatchTerminalEvidence(entries, {
    deadlineAtMs: Date.parse('2026-07-29T00:10:19.000Z'),
    deadlineReached: true,
  });
  assert.equal(missingSendReceipt.available, false);
  assert.equal(missingSendReceipt.dispatch_receipts_complete, false);
});

test('a partial streaming reply at the timeout boundary is valid product failure evidence', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'qbot-core-beta-partial-timeout-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const terminalScreenshot = path.join(root, 'issue-793-after-timeout.png');
  fs.writeFileSync(terminalScreenshot, 'partial streaming timeout'.padEnd(256, 'x'));
  const terminalScreenshotSha256 = createHash('sha256')
    .update(fs.readFileSync(terminalScreenshot))
    .digest('hex');
  const payload = {
    complete: false,
    evidence_complete: true,
    terminal_failure: true,
    terminal_outcome: 'timed_out',
    assistant_reply_present: true,
    confirmed_send_receipt: true,
    waited_ms: 240_001,
    min_wait_ms: 60_000,
    timeout_ms: 240_000,
    observed_running_after_send: true,
    running_after: true,
    terminal_reason: '长文本回复在 240000ms 观察窗口内仍未完成；已读取 4131 字正文。',
    terminal_screenshot: terminalScreenshot,
    terminal_screenshot_sha256: terminalScreenshotSha256,
    timeout_screenshot: terminalScreenshot,
    timeout_screenshot_sha256: terminalScreenshotSha256,
  };

  assert.deepEqual(validateReplyCompletionPayload(payload), { valid: true });
  fs.rmSync(terminalScreenshot);
  assert.equal(validateReplyCompletionPayload(payload).valid, false);
});

test('skill, expert, and MCP use require task-bound execution events', () => {
  assert.equal(validateSkillExecutionEvidence({
    task_id: 'task-1',
    selected_skill_ids: ['skill-a'],
    execution_events: [{ skill_id: 'skill-a', task_id: 'task-1', status: 'completed' }],
  }).ok, true);
  assert.equal(validateSkillExecutionEvidence({
    task_id: 'task-1',
    selected_skill_ids: ['skill-a'],
    execution_events: [],
  }).ok, false);

  assert.equal(validateExpertExecutionEvidence({
    task_id: 'task-2',
    expert_id: 'expert-a',
    current_expert_id: 'expert-a',
    execution_events: [{ expert_id: 'expert-a', task_id: 'task-2' }],
  }).ok, true);
  assert.equal(validateExpertExecutionEvidence({
    task_id: 'task-2',
    expert_id: 'expert-a',
    current_expert_id: 'expert-b',
    execution_events: [],
  }).ok, false);

  assert.equal(validateMcpExecutionEvidence({
    task_id: 'task-3',
    selected_connector_keys: ['mcp-a'],
    tool_calls: [{
      connector_key: 'mcp-a',
      task_id: 'task-3',
      tool_name: 'search',
      response_present: true,
    }],
  }).ok, true);
  assert.equal(validateMcpExecutionEvidence({
    task_id: 'task-3',
    selected_connector_keys: ['mcp-a'],
    tool_calls: [{ connector_key: 'mcp-a', task_id: 'task-3', tool_name: '', response_present: false }],
  }).ok, false);
});

test('destructive maintenance confirmation contracts accept only the intended visible action', () => {
  const reset = coreBetaMaintenanceConfirmationContract('assistant-runtime-reset-all');
  assert.equal(reset.prompt.test('确认全量重初始化\n全量重初始化会清空本机运行时，此操作不可恢复。'), true);
  assert.equal(reset.confirm.test('全量重初始化'), true);
  assert.equal(reset.confirm.test('取消'), false);

  const skills = coreBetaMaintenanceConfirmationContract('assistant-skills-reinstall');
  assert.equal(skills.prompt.test('确认一键重装 Skill\n将清理技能环境并重新物化，确定继续？'), true);
  assert.equal(skills.confirm.test('一键重装 Skill'), true);
  assert.equal(skills.confirm.test('全量重初始化'), false);

  const sessions = coreBetaMaintenanceConfirmationContract('assistant-sessions-purge');
  assert.equal(sessions.prompt.test('确认清空全部会话\n将清空所有环境本地会话，此操作不可恢复。'), true);
  assert.equal(sessions.confirm.test('清空全部会话'), true);
  assert.equal(sessions.confirm.test('删除专家'), false);
  assert.equal(coreBetaMaintenanceConfirmationContract('unknown-maintenance-action'), null);
});

test('an already-open system settings shell waits through loading and fails only on an explicit error', () => {
  assert.deepEqual(coreBetaSettingsSurfaceState('系统设置\n正在加载个人设置...'), {
    open: true,
    loading: true,
    error: '',
  });
  assert.deepEqual(coreBetaSettingsSurfaceState('系统设置\n加载个人设置失败：网络错误'), {
    open: true,
    loading: false,
    error: '加载个人设置失败：网络错误',
  });
  assert.deepEqual(coreBetaSettingsSurfaceState('新建任务'), {
    open: false,
    loading: false,
    error: '',
  });
});

test('partial Skill installation blocks only cases that require the complete install set', () => {
  const installResults = Array.from({ length: 10 }, (_, index) => ({
    slug: `skill-${index + 1}`,
    ok: index < 8,
    reason: index < 8 ? '' : '产品安装终态失败',
  }));
  const ledger = {
    skills: {
      sample: installResults.map(({ slug }) => ({ slug })),
      install_results: installResults,
      installed: installResults.filter((item) => item.ok),
      installation_blocker: {
        source_case_id: 'BETA-SKILL-004',
        requested_count: 10,
      },
    },
  };
  const crossView = coreBetaSharedCapabilityPrerequisiteBlocker(ledger, {
    case_type: 'skill_lifecycle',
    parsed: { action_plan: [{ command: 'verify_market_installed_state' }] },
  });
  assert.equal(crossView.applicable, true);
  assert.equal(crossView.kind, 'skill_install_terminal_shortage');
  assert.equal(crossView.requested_count, 10);
  assert.equal(crossView.successful_count, 8);
  assert.deepEqual(crossView.failed_ids, ['skill-9', 'skill-10']);

  const useInstalledSkill = coreBetaSharedCapabilityPrerequisiteBlocker(ledger, {
    case_type: 'skill_use',
    parsed: { action_plan: [{ command: 'select_skill_by_slug' }] },
  });
  assert.equal(useInstalledSkill.applicable, false);
});

test('legacy cross-view and cleanup failures caused by 8/10 upstream installs review as blockers', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'qbot-core-beta-upstream-shortage-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const screenshot = path.join(root, 'after.png');
  fs.writeFileSync(screenshot, 'visible product frame');
  const installed = Array.from({ length: 8 }, (_, index) => ({
    slug: `skill-${index + 1}`,
    installed: true,
    visible: true,
  }));
  const market = verifiedCoreBetaUpstreamPrerequisiteShortageEvidence({
    status: 'failed',
    result_category: 'bug',
    artifacts: {
      core_beta_evidence: {
        action_receipt: {
          available: true,
          declared_action_count: 1,
          receipt_count: 1,
          receipts: [{
            command: 'verify_market_installed_state',
            event: 'market-installed-readback',
            expected_state_observed: false,
            state_readback: installed,
            after_screenshot: screenshot,
          }],
        },
        capability_selection: {
          source: 'captured cross-view installed capability selection readback',
          selection: {
            expected: installed.map(({ slug }) => ({ slug })),
            market_readback: installed,
          },
        },
      },
    },
  });
  assert.equal(market.applicable, true);
  assert.equal(market.kind, 'skill_install_terminal_shortage');
  assert.equal(market.successful_count, 8);

  const cleanup = verifiedCoreBetaUpstreamPrerequisiteShortageEvidence({
    status: 'failed',
    result_category: 'bug',
    artifacts: {
      core_beta_evidence: {
        action_receipt: {
          available: true,
          declared_action_count: 1,
          receipt_count: 1,
          receipts: [{
            command: 'uninstall_run_skill_sample',
            event: 'uninstall-run-sample',
            expected_state_observed: false,
            after_screenshot: screenshot,
          }],
        },
        capability_selection: {
          source: 'exact run-owned successful install receipts + visible uninstall actions',
          selection: {
            operation: 'cleanup_current_run_installs',
            requested_sample_count: 10,
            selected_count: 8,
            results: Array.from({ length: 8 }, () => ({ ok: true })),
          },
        },
      },
    },
  });
  assert.equal(cleanup.applicable, true);
  assert.equal(cleanup.successful_count, 8);
});

test('strict stop-generation product failure requires exact ledger and visible terminal readback', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'qbot-core-beta-stop-proof-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const before = path.join(root, 'before.png');
  const after = path.join(root, 'after.png');
  fs.writeFileSync(before, 'before');
  fs.writeFileSync(after, 'after');
  const receipt = {
    number: 2,
    command: 'stop_generation',
    expected_state: 'partial_reply_retained',
    expected_state_observed: false,
    selector_or_testid: 'composer-cancel',
    event: 'stop-generation',
    before_screenshot: before,
    after_screenshot: after,
    actual: 'partialChars=31；retainedChars=0',
    state_readback: {
      task_id: 'task-stop-1',
      running_before: true,
      running_after: false,
      partial_reply_ready_before_click: true,
      partial_chars_before_click: 31,
      retained_chars: 0,
    },
  };
  const verified = verifiedCoreBetaProductActionFailureEvidence({
    status: 'failed',
    result_category: 'bug',
    steps: [{
      numbered_step_number: 2,
      numbered_step_evidence: 'explicit',
      status: 'failed',
      category: 'bug',
    }],
    artifacts: {
      core_beta_evidence: {
        action_receipt: {
          available: true,
          declared_action_count: 1,
          receipt_count: 1,
          receipts: [receipt],
        },
      },
    },
  });
  assert.equal(verified.applicable, true);
  assert.equal(verified.command, 'stop_generation');

  receipt.state_readback.partial_chars_before_click = 0;
  assert.equal(verifiedCoreBetaProductActionFailureEvidence({
    status: 'failed',
    result_category: 'bug',
    steps: [{
      numbered_step_number: 2,
      numbered_step_evidence: 'explicit',
      status: 'failed',
      category: 'bug',
    }],
    artifacts: {
      core_beta_evidence: {
        action_receipt: {
          available: true,
          declared_action_count: 1,
          receipt_count: 1,
          receipts: [receipt],
        },
      },
    },
  }).applicable, false);
});

test('runtime recovery stages the exact follow-up prompt as the next send contract', () => {
  const state = { artifacts: { sent_prompts: [] } };
  stageCoreBetaPlannedPrompt(state, {
    label: 'dispatch_recovery_task',
    prompt: '首轮恢复任务',
    recordedAt: '2026-07-30T00:00:00.000Z',
  });
  const followup = stageCoreBetaPlannedPrompt(state, {
    label: '恢复后继续追问',
    prompt: '运行时已恢复。请输出唯一标识 BETA_RUNTIME_RECOVERED。',
    recordedAt: '2026-07-30T00:01:00.000Z',
  });
  assert.equal(state.artifacts.sent_prompts.length, 2);
  assert.equal(state.artifacts.sent_prompts.at(-1), followup);
  assert.equal(
    state.artifacts.sent_prompts.at(-1).prompt,
    '运行时已恢复。请输出唯一标识 BETA_RUNTIME_RECOVERED。',
  );
  assert.notEqual(
    state.artifacts.sent_prompts.at(-1).prompt,
    state.artifacts.sent_prompts[0].prompt,
  );
});

test('runtime recovery invocation has a Node-side hard timeout', async () => {
  await assert.rejects(
    withCoreBetaOperationHardTimeout(
      new Promise(() => {}),
      10,
      'claude-code retryRuntime dispatch',
    ),
    /Core Beta operation timed out: claude-code retryRuntime dispatch after 10ms/,
  );
  assert.deepEqual(
    await withCoreBetaOperationHardTimeout(Promise.resolve({ phase: 'dispatched' }), 100),
    { phase: 'dispatched' },
  );
});

test('Core Beta v2 screenshot fallback remains bounded when capture never settles', async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'qbot-core-beta-v2-shot-capture-timeout-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const page = {
    async screenshot() { return new Promise(() => {}); },
    context() {
      return {
        async newCDPSession() {
          return {
            async send() { return new Promise(() => {}); },
            async detach() {},
          };
        },
      };
    },
  };
  const startedAt = Date.now();
  await assert.rejects(
    captureCoreBetaV2Screenshot(page, root, 'capture-timeout', {
      playwrightTimeoutMs: 10,
      primaryHardTimeoutMs: 10,
      sessionCreateTimeoutMs: 10,
      captureTimeoutMs: 10,
      detachTimeoutMs: 10,
      retryDelayMs: 0,
    }),
    /两次有界截图均失败.*Page\.captureScreenshot fallback after 10ms/,
  );
  assert.ok(Date.now() - startedAt < 500, 'fallback capture must not wait forever');
});

test('Core Beta v2 screenshot retries one transient full-page failure with isolated viewport evidence', async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'qbot-core-beta-v2-shot-viewport-retry-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const screenshotCalls = [];
  let cdpSessions = 0;
  const page = {
    async screenshot(options) {
      screenshotCalls.push({ path: options.path, fullPage: options.fullPage });
      if (screenshotCalls.length === 1) return new Promise(() => {});
      fs.writeFileSync(options.path, 'viewport-retry-evidence');
      return Buffer.from('viewport-retry-evidence');
    },
    context() {
      return {
        async newCDPSession() {
          cdpSessions += 1;
          return {
            async send() { return new Promise(() => {}); },
            async detach() {},
          };
        },
      };
    },
  };
  const screenshot = await captureCoreBetaV2Screenshot(page, root, 'viewport-retry', {
    playwrightTimeoutMs: 10,
    primaryHardTimeoutMs: 10,
    sessionCreateTimeoutMs: 10,
    captureTimeoutMs: 10,
    detachTimeoutMs: 10,
    retryDelayMs: 0,
  });
  assert.equal(fs.readFileSync(screenshot, 'utf8'), 'viewport-retry-evidence');
  assert.deepEqual(screenshotCalls.map((item) => item.fullPage), [true, false]);
  assert.equal(cdpSessions, 1);
  assert.ok(screenshotCalls.every((item) => path.dirname(item.path) !== root));
  assert.deepEqual(fs.readdirSync(root), ['viewport-retry.png']);
});

test('Core Beta v2 screenshot returns saved evidence when detach never settles', async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'qbot-core-beta-v2-shot-detach-timeout-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const page = {
    async screenshot() { throw new Error('page.screenshot: Timeout while waiting for fonts to load'); },
    context() {
      return {
        async newCDPSession() {
          return {
            async send(method) {
              assert.equal(method, 'Page.captureScreenshot');
              return { data: Buffer.from('root-fallback-evidence').toString('base64') };
            },
            async detach() { return new Promise(() => {}); },
          };
        },
      };
    },
  };
  const startedAt = Date.now();
  const screenshot = await captureCoreBetaV2Screenshot(page, root, 'detach-timeout', {
    playwrightTimeoutMs: 10,
    primaryHardTimeoutMs: 10,
    sessionCreateTimeoutMs: 10,
    captureTimeoutMs: 10,
    detachTimeoutMs: 10,
  });
  assert.equal(fs.readFileSync(screenshot, 'utf8'), 'root-fallback-evidence');
  assert.ok(Date.now() - startedAt < 500, 'fallback cleanup must not wait forever');
});
