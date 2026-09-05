import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  CORE_BETA_EXPERT_012_CONTRACT_VARIANTS,
  CORE_BETA_RUN_OWNED_EXPERT_REQUIREMENTS,
  CORE_BETA_BASE_SCENARIO_IDS,
  CORE_BETA_EVIDENCE_ADAPTERS,
  CORE_BETA_SCENARIO_IDS,
  CORE_BETA_SCENARIO_REGISTRY,
  FULL_FUNCTION_REGRESSION_LEGACY_CASE_IDS,
  PRODUCTION_GRAY_EXCLUDED_RARE_CASE_IDS,
  PRODUCTION_GRAY_PROMOTED_LEGACY_CASE_IDS,
  buildCoreEvidenceManifest,
  classifyCoreBetaScopedDependencyGaps,
  classifyCoreBetaScopedFixtureExclusions,
  coreBetaCaseContractSha256,
  coreBetaExpert012ContractVariant,
  coreBetaExpertMaintenanceTaskEvidence,
  coreBetaExecutorRoute,
  coreBetaLeafCases,
  coreBetaScenarioSpec,
  evaluateMachineAssertions,
  validateEvidenceFile,
  validateCoreBetaCase,
  validateCoreBetaCasePlan,
  validateCoreBetaScopedSelection,
} from '../src/lib/core-beta-case-protocol.mjs';
import {
  webRuntimeAuthorityVerdict,
  webSearchBusinessVerdict,
  webSearchFixedQuotaRejection,
  webSearchQuotaTraceVerdict,
} from '../src/lib/qbot-web-runtime-evidence.mjs';
import {
  aggregateCompoundOutcome,
  buildCompoundEvidenceManifest,
  compoundBlockedReason,
  connectorRetryRecoveryVerdict,
  connectorRetryTurnReadback,
  coreBetaCompletionBlockReason,
  coreBetaPreSendCapabilityFailureEvidence,
  coreBetaRuntimeExecutorBinding,
  coreBetaRunOwnedExpertPrerequisiteBlocker,
  coreBetaSuiteLedgerPath,
  coreBetaSuiteRoot,
  horizontalOverflowReadbackVerdict,
  qworkDailyEvidenceEnvelope,
  qworkDailyExpertAudienceRejectionEvidence,
  qworkDailyExpertCatalogBridgeRoute,
  qworkDailyExpertCatalogVerdict,
  qworkDailyNewTaskAutoIsolationVerdict,
  qworkDailyPersonalTaskContext,
  qworkDailyRedactionVerdict,
  qworkDailySecretFindings,
  qworkDailyWorkspaceTaskBindingVerdict,
  skillNativeInvocationReadback,
  normalizeQworkDailyExpertCatalog,
} from '../src/lib/ui-agent-casebook-runner-v2.mjs';

function structuredProtocolWebReply(round) {
  return [
    `标题：OpenAI 官方更新 ${round}A`,
    `日期：2026-09-0${round}`,
    `官方链接：https://openai.com/update-${round}-a`,
    `摘要：第 ${round} 轮第一条官方更新的完整业务摘要。`,
    '',
    `标题：OpenAI 官方更新 ${round}B`,
    `日期：2026-08-1${round}`,
    `官方链接：https://platform.openai.com/news-${round}-b`,
    `摘要：第 ${round} 轮第二条官方更新的完整业务摘要。`,
  ].join('\n');
}

function expertMaintenanceEvidenceInput(screenshot) {
  const screenshotDir = path.dirname(screenshot);
  const screenshotReceipt = (name, fill) => {
    const file = path.join(screenshotDir, `expert-maintenance-${name}.png`);
    fs.writeFileSync(file, Buffer.alloc(256, fill));
    return {
      path: file,
      bytes: fs.statSync(file).size,
      sha256: createHash('sha256').update(fs.readFileSync(file)).digest('hex'),
    };
  };
  const expertId = 'expert-maintenance-target';
  const draftId = 'draft-maintenance-target';
  const expertName = 'QA 发布维护专家';
  const marker = '__QBOT_EXPERT_AUTHORING_TARGET_UPDATE_marker__';
  const expectedSummary = 'QA maintenance summary marker';
  const expectedPersona = 'QA maintenance persona marker: concise and auditable.';
  const authoringTaskId = 'task-expert-maintenance';
  const authoringView = {
    schema_version: 1,
    draft_id: draftId,
    expert_id: expertId,
  };
  const idleMetric = {
    captured: true,
    active_id: null,
    send_count: 10,
    message_count: 0,
  };
  const getResult = {
    ok: true,
    operation: 'get_expert_draft',
    draftId,
    revision: 4,
    draft: {
      id: draftId,
      revision: 4,
      status: 'draft',
      content: { summary: 'old summary', personaBody: 'old persona' },
    },
  };
  const updateResult = {
    ok: true,
    operation: 'update_expert_draft',
    draftId,
    revision: 5,
    draft: {
      id: draftId,
      revision: 5,
      status: 'draft',
      content: { summary: expectedSummary, personaBody: expectedPersona },
    },
  };
  const getResultText = JSON.stringify(getResult);
  const updateResultText = JSON.stringify(updateResult);
  const toolCalls = [
    {
      id: 'tool-get',
      name: 'mcp__qwork_expert_authoring__get_expert_draft',
      input: { draftId },
      result_present: true,
      result_text: getResultText,
      result: getResult,
      result_sha256: createHash('sha256').update(getResultText).digest('hex'),
      is_error: false,
    },
    {
      id: 'tool-update',
      name: 'mcp__qwork_expert_authoring__update_expert_draft',
      input: {
        draftId,
        patch: {
          summary: expectedSummary,
          personaBody: expectedPersona,
        },
      },
      result_present: true,
      result_text: updateResultText,
      result: updateResult,
      result_sha256: createHash('sha256').update(updateResultText).digest('hex'),
      is_error: false,
    },
  ];
  const prompt = [
    '修改当前绑定的专家草稿，不要创建或复制其他专家。',
    '__QBOT_EXPERT_AUTHORING_TARGET_UPDATE__',
    marker,
    `expert-summary: ${expectedSummary}`,
    `expert-persona: ${expectedPersona}`,
  ].join('\n');
  const session = {
    id: authoringTaskId,
    messages: [
      { role: 'user', parts: [{ t: 'text', text: prompt }] },
      {
        role: 'assistant',
        parts: [
          {
            t: 'tool',
            id: toolCalls[0].id,
            name: toolCalls[0].name,
            input: toolCalls[0].input,
            result: toolCalls[0].result_text,
            isError: false,
          },
          {
            t: 'tool',
            id: toolCalls[1].id,
            name: toolCalls[1].name,
            input: toolCalls[1].input,
            result: toolCalls[1].result_text,
            isError: false,
          },
          { t: 'text', text: '专家草稿已更新。' },
        ],
      },
    ],
  };
  const startedOperation = {
    id: 'operation-maintenance-publish',
    expertId,
    draftId,
    state: 'queued',
    result: null,
  };
  const terminalOperation = {
    id: startedOperation.id,
    expertId,
    draftId,
    state: 'succeeded',
    result: {
      expertId,
      versionId: 'version-maintenance-3',
      releaseId: 'release-maintenance-3',
    },
  };
  const beforeVersions = [1, 2].map((index) => ({
    expertId,
    version: { id: `version-maintenance-${index}` },
  }));
  const beforeReleases = [1, 2].map((index) => ({
    expertId,
    release: { id: `release-maintenance-${index}`, versionId: `version-maintenance-${index}` },
  }));
  const afterExpert = {
    id: expertId,
    activeReleaseId: terminalOperation.result.releaseId,
    version: { id: terminalOperation.result.versionId },
    release: {
      id: terminalOperation.result.releaseId,
      versionId: terminalOperation.result.versionId,
    },
  };
  return {
    caseId: 'BETA-EXPERT-012',
    expectedExpertId: expertId,
    expectedDraftId: draftId,
    expertName,
    marker,
    expectedSummary,
    expectedPersona,
    entry: {
      captured: true,
      card_visible: true,
      menu_visible: true,
      menu_panel_visible: true,
      action_visible: true,
      action_clicked: true,
      failure_stage: '',
      failure_reason: '',
      no_prompt_recorded: true,
      no_send_receipt_recorded: true,
      before: structuredClone(idleMetric),
      after: {
        ...structuredClone(idleMetric),
        current_expert: 'qwork.builtin.expert-authoring',
        expert_authoring_view: structuredClone(authoringView),
      },
      surface: {
        header: true,
        name: true,
        status: true,
        welcome: true,
        quick_tasks: true,
        adjust_responsibilities: true,
        composer_input: true,
        composer_expert_chip: true,
        open_config: true,
        name_text: expertName,
        status_text: '有未发布修改',
        welcome_text: `你想怎么调整「${expertName}」？`,
      },
      draft_inventory_before: [],
      draft_inventory_after: [{ id: draftId, expertId }],
      screenshot: screenshotReceipt('entry', 1),
    },
    quickTask: {
      captured: true,
      clicked: true,
      before: structuredClone(idleMetric),
      after: structuredClone(idleMetric),
      composer_text: '请调整这个专家的 Persona 与职责。',
      screenshot: screenshotReceipt('quick-task', 2),
    },
    authoringTurn: {
      captured: true,
      prompt,
      task_id: authoringTaskId,
      reply_incomplete: false,
      before: structuredClone(idleMetric),
      after: {
        captured: true,
        active_id: authoringTaskId,
        send_count: 11,
        message_count: 2,
        current_expert: 'qwork.builtin.expert-authoring',
        expert_authoring_view: structuredClone(authoringView),
      },
      session,
      screenshot: screenshotReceipt('authoring-turn', 3),
    },
    toolTrace: {
      captured: true,
      source: 'window.agent.readSession/currentSession.messages.parts',
      task_id: authoringTaskId,
      calls: toolCalls,
    },
    draftBefore: {
      id: draftId,
      expert_id: expertId,
      revision: 4,
      content: { summary: 'old summary', persona_body: 'old persona' },
    },
    draftAfter: {
      id: draftId,
      expert_id: expertId,
      revision: 5,
      content: { summary: expectedSummary, persona_body: expectedPersona },
    },
    configRoundtrip: {
      captured: true,
      lifecycle_visible: true,
      selected_draft_id: draftId,
      selected_expert_id: expertId,
      summary_value: expectedSummary,
      persona_value: expectedPersona,
      back_aria_label: '返回维护任务',
      returned_to_maintenance: true,
      screenshot: screenshotReceipt('config-roundtrip', 4),
    },
    publication: {
      captured: true,
      before: {
        versions: beforeVersions,
        releases: beforeReleases,
        version_count: beforeVersions.length,
        release_count: beforeReleases.length,
      },
      after: {
        expert: afterExpert,
        versions: [...beforeVersions, {
          expertId,
          version: { id: terminalOperation.result.versionId },
        }],
        releases: [...beforeReleases, {
          expertId,
          release: {
            id: terminalOperation.result.releaseId,
            versionId: terminalOperation.result.versionId,
          },
        }],
        version_count: 3,
        release_count: 3,
      },
      publish_button_visible: true,
      review_visible: true,
      warning_ack_present: true,
      warning_acknowledged_or_not_required: true,
      confirm_visible: true,
      confirm_clicked: true,
      review_closed: true,
      operation_visible: true,
      operation_text: '发布完成',
      operation_class: 'expert-v2-operation-succeeded',
      terminal_state: 'succeeded',
      expert_id: expertId,
      draft_id: draftId,
      operation_id: startedOperation.id,
      expected_revision: 5,
      idempotency_key: 'expert-maintenance-visible-publish-key',
      operation_probe: {
        installed: true,
        restored: true,
        publish_calls: [{
          args: {
            draft_id: draftId,
            expected_revision: 5,
            idempotency_key: 'expert-maintenance-visible-publish-key',
          },
          result: startedOperation,
          error: null,
        }],
        get_operation_calls: [{
          args: {
            operation_id: startedOperation.id,
            draft_id: draftId,
            expected_revision: 5,
          },
          result: terminalOperation,
          error: null,
        }],
      },
      operation_states: [startedOperation, terminalOperation],
      terminal_operation: terminalOperation,
      screenshot: screenshotReceipt('publication', 5),
    },
    reopen: {
      captured: true,
      ok: true,
      task_id: authoringTaskId,
      title: `修改 · ${expertName}`,
      maintenance_visible: true,
      state: {
        captured: true,
        active_id: authoringTaskId,
        send_count: 11,
        message_count: 2,
        is_draft: false,
        draft_instance_id: 'draft-instance-maintenance',
        current_expert: 'qwork.builtin.expert-authoring',
        expert_authoring_view: structuredClone(authoringView),
      },
      session: structuredClone(session),
      tool_trace: {
        captured: true,
        source: 'window.agent.readSession/currentSession.messages.parts',
        task_id: authoringTaskId,
        calls: structuredClone(toolCalls),
      },
      screenshot: screenshotReceipt('reopen', 6),
    },
    newTask: {
      captured: true,
      maintenance_visible: false,
      state: {
        captured: true,
        active_id: null,
        send_count: 11,
        message_count: 0,
        is_draft: true,
        draft_instance_id: 'draft-instance-fresh',
        current_expert: null,
        expert_authoring_view: null,
        messages: [],
        selected_skills: null,
        selected_connectors: null,
        attachment_count: 0,
      },
      screenshot: screenshotReceipt('new-task', 7),
    },
  };
}

assert.equal(
  CORE_BETA_EVIDENCE_ADAPTERS.has('workspace_missing_error_readback'),
  true,
  'cwd 删除后的结构化工作空间错误必须有正式证据适配器',
);

{
  const caseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'qbot-expert-maintenance-trace-'));
  const outsideDir = fs.mkdtempSync(path.join(os.tmpdir(), 'qbot-expert-maintenance-outside-'));
  try {
    const screenshot = path.join(caseDir, 'expert-maintenance.png');
    fs.writeFileSync(screenshot, Buffer.alloc(256, 3));
    const validInput = expertMaintenanceEvidenceInput(screenshot);
    const validTrace = coreBetaExpertMaintenanceTaskEvidence(validInput);
    assert.equal(validTrace.evidence_valid, true);
    assert.equal(validTrace.oracle_valid, true);
    assert.equal(validTrace.outcome, 'pass');

    const traceFile = path.join(caseDir, 'expert-maintenance-task-trace.json');
    fs.writeFileSync(traceFile, JSON.stringify(validTrace));
    assert.equal(
      validateEvidenceFile('expert_maintenance_task_trace', traceFile, {
        expectedCaseId: 'BETA-EXPERT-012',
        expectedCaseDir: caseDir,
      }).valid,
      true,
      '完整专家维护任务 trace 必须通过专用复算校验',
    );
    const completeManifest = buildCoreEvidenceManifest({
      testCase: { id: 'BETA-EXPERT-012', evidence_roles: ['expert_maintenance_task_trace'] },
      caseDir,
      artifacts: { expert_maintenance_task_trace: traceFile },
    });
    assert.equal(completeManifest.complete, true);
    assert.deepEqual(completeManifest.invalid_roles, []);

    const missingTraceManifest = buildCoreEvidenceManifest({
      testCase: { id: 'BETA-EXPERT-012', evidence_roles: ['expert_maintenance_task_trace'] },
      caseDir,
    });
    assert.equal(missingTraceManifest.complete, false);
    assert.deepEqual(missingTraceManifest.missing_roles, ['expert_maintenance_task_trace']);

    const quickTaskSent = expertMaintenanceEvidenceInput(screenshot);
    quickTaskSent.quickTask.after.send_count += 1;
    quickTaskSent.quickTask.after.message_count += 1;
    quickTaskSent.quickTask.after.active_id = 'unexpected-task';
    const quickTaskSentTrace = coreBetaExpertMaintenanceTaskEvidence(quickTaskSent);
    assert.equal(quickTaskSentTrace.evidence_valid, true);
    assert.equal(quickTaskSentTrace.oracle_checks.quick_task_prefill_only, false);
    assert.equal(quickTaskSentTrace.outcome, 'bug');

    const identityDrift = expertMaintenanceEvidenceInput(screenshot);
    identityDrift.entry.after.expert_authoring_view.expert_id = 'other-expert';
    const identityDriftTrace = coreBetaExpertMaintenanceTaskEvidence(identityDrift);
    assert.equal(identityDriftTrace.evidence_valid, true);
    assert.equal(identityDriftTrace.oracle_checks.maintenance_state_bound, false);
    assert.equal(identityDriftTrace.outcome, 'bug');

    const reusedDraft = expertMaintenanceEvidenceInput(screenshot);
    reusedDraft.entry.draft_inventory_before = structuredClone(reusedDraft.entry.draft_inventory_after);
    const reusedDraftTrace = coreBetaExpertMaintenanceTaskEvidence(reusedDraft);
    assert.equal(reusedDraftTrace.evidence_valid, true);
    assert.equal(reusedDraftTrace.oracle_checks.fresh_maintenance_draft_created, false);

    const entryFailure = expertMaintenanceEvidenceInput(screenshot);
    entryFailure.expectedDraftId = '';
    entryFailure.entry.failure_stage = 'action';
    entryFailure.entry.failure_reason = '缺少真实“通过对话修改”入口';
    entryFailure.entry.action_visible = false;
    entryFailure.entry.action_clicked = false;
    entryFailure.entry.after = structuredClone(entryFailure.entry.before);
    entryFailure.entry.draft_inventory_after = structuredClone(entryFailure.entry.draft_inventory_before);
    entryFailure.quickTask = null;
    entryFailure.authoringTurn = null;
    entryFailure.toolTrace = null;
    entryFailure.draftBefore = null;
    entryFailure.draftAfter = null;
    entryFailure.configRoundtrip = null;
    entryFailure.publication = null;
    entryFailure.reopen = null;
    entryFailure.newTask = null;
    const entryFailureTrace = coreBetaExpertMaintenanceTaskEvidence(entryFailure);
    assert.equal(entryFailureTrace.evidence_valid, true, '入口缺失且零发送证据完整时应保留为产品 Bug');
    assert.equal(entryFailureTrace.oracle_valid, false);
    assert.equal(entryFailureTrace.outcome, 'bug');
    fs.writeFileSync(traceFile, JSON.stringify(entryFailureTrace));
    assert.equal(
      validateEvidenceFile('expert_maintenance_task_trace', traceFile, {
        expectedCaseId: 'BETA-EXPERT-012',
        expectedCaseDir: caseDir,
      }).valid,
      true,
      '入口缺失产品 Bug 的完整 trace 应保持 manifest-valid',
    );

    const unsafeEntryFailure = structuredClone(entryFailure);
    unsafeEntryFailure.entry.no_send_receipt_recorded = false;
    assert.equal(
      coreBetaExpertMaintenanceTaskEvidence(unsafeEntryFailure).evidence_valid,
      false,
      '入口缺失但无法证明零发送时必须归类为证据错误',
    );

    const missingTool = expertMaintenanceEvidenceInput(screenshot);
    missingTool.toolTrace.calls.pop();
    missingTool.authoringTurn.session.messages[1].parts.splice(1, 1);
    missingTool.reopen.session = structuredClone(missingTool.authoringTurn.session);
    missingTool.reopen.tool_trace = structuredClone(missingTool.toolTrace);
    const missingToolTrace = coreBetaExpertMaintenanceTaskEvidence(missingTool);
    assert.equal(missingToolTrace.evidence_valid, true);
    assert.equal(missingToolTrace.oracle_checks.exact_authoring_tool_sequence, false);
    assert.equal(missingToolTrace.outcome, 'bug');

    const extraTool = expertMaintenanceEvidenceInput(screenshot);
    const extraToolResultText = JSON.stringify({ ok: true, operation: 'publish_expert_draft' });
    const extraToolCall = {
      id: 'tool-extra',
      name: 'mcp__qwork_expert_authoring__publish_expert_draft',
      input: { draftId: extraTool.expectedDraftId },
      result_present: true,
      result_text: extraToolResultText,
      result: JSON.parse(extraToolResultText),
      result_sha256: createHash('sha256').update(extraToolResultText).digest('hex'),
      is_error: false,
    };
    extraTool.toolTrace.calls.push(extraToolCall);
    extraTool.authoringTurn.session.messages[1].parts.splice(2, 0, {
      t: 'tool',
      id: extraToolCall.id,
      name: extraToolCall.name,
      input: extraToolCall.input,
      result: extraToolCall.result_text,
      isError: false,
    });
    extraTool.reopen.session = structuredClone(extraTool.authoringTurn.session);
    extraTool.reopen.tool_trace = structuredClone(extraTool.toolTrace);
    const extraToolTrace = coreBetaExpertMaintenanceTaskEvidence(extraTool);
    assert.equal(extraToolTrace.evidence_valid, true);
    assert.equal(extraToolTrace.oracle_checks.exact_authoring_tool_sequence, false);

    const staleRevision = expertMaintenanceEvidenceInput(screenshot);
    staleRevision.draftAfter.revision = staleRevision.draftBefore.revision;
    const staleRevisionTrace = coreBetaExpertMaintenanceTaskEvidence(staleRevision);
    assert.equal(staleRevisionTrace.evidence_valid, true);
    assert.equal(staleRevisionTrace.oracle_checks.draft_revision_and_content, false);

    const wrongToolResult = expertMaintenanceEvidenceInput(screenshot);
    const wrongUpdateResult = structuredClone(wrongToolResult.toolTrace.calls[1].result);
    wrongUpdateResult.draftId = 'other-draft';
    wrongUpdateResult.draft.id = 'other-draft';
    const wrongUpdateResultText = JSON.stringify(wrongUpdateResult);
    wrongToolResult.toolTrace.calls[1].result_text = wrongUpdateResultText;
    wrongToolResult.toolTrace.calls[1].result = wrongUpdateResult;
    wrongToolResult.toolTrace.calls[1].result_sha256 = createHash('sha256').update(wrongUpdateResultText).digest('hex');
    wrongToolResult.authoringTurn.session.messages[1].parts[1].result = wrongUpdateResultText;
    wrongToolResult.reopen.session = structuredClone(wrongToolResult.authoringTurn.session);
    wrongToolResult.reopen.tool_trace = structuredClone(wrongToolResult.toolTrace);
    const wrongToolResultTrace = coreBetaExpertMaintenanceTaskEvidence(wrongToolResult);
    assert.equal(wrongToolResultTrace.evidence_valid, true);
    assert.equal(wrongToolResultTrace.oracle_checks.authoring_tool_target_and_results, false);

    const forgedParsedToolResult = expertMaintenanceEvidenceInput(screenshot);
    forgedParsedToolResult.toolTrace.calls[1].result.draft.content.summary = 'forged parsed summary';
    const forgedParsedTrace = coreBetaExpertMaintenanceTaskEvidence(forgedParsedToolResult);
    assert.equal(forgedParsedTrace.evidence_valid, false, 'parsed result 与原始 result_text 不一致必须拒绝');
    assert.equal(forgedParsedTrace.evidence_checks.tool_trace_recomputed_from_session, false);

    const missingRevision = expertMaintenanceEvidenceInput(screenshot);
    missingRevision.draftBefore.revision = null;
    const missingRevisionTrace = coreBetaExpertMaintenanceTaskEvidence(missingRevision);
    assert.equal(missingRevisionTrace.evidence_valid, false);
    assert.equal(missingRevisionTrace.outcome, 'automation_error');

    const extraPublication = expertMaintenanceEvidenceInput(screenshot);
    extraPublication.publication.after.versions.push({
      expertId: extraPublication.expectedExpertId,
      version: { id: 'version-maintenance-unexpected' },
    });
    extraPublication.publication.after.releases.push({
      expertId: extraPublication.expectedExpertId,
      release: {
        id: 'release-maintenance-unexpected',
        versionId: 'version-maintenance-unexpected',
      },
    });
    extraPublication.publication.after.version_count = extraPublication.publication.after.versions.length;
    extraPublication.publication.after.release_count = extraPublication.publication.after.releases.length;
    const extraPublicationTrace = coreBetaExpertMaintenanceTaskEvidence(extraPublication);
    assert.equal(extraPublicationTrace.evidence_valid, true);
    assert.equal(extraPublicationTrace.oracle_checks.visible_publish_exactly_one_version_release, false);

    const stalePublishCas = expertMaintenanceEvidenceInput(screenshot);
    stalePublishCas.publication.expected_revision = 4;
    stalePublishCas.publication.operation_probe.publish_calls[0].args.expected_revision = 4;
    stalePublishCas.publication.operation_probe.get_operation_calls[0].args.expected_revision = 4;
    const stalePublishCasTrace = coreBetaExpertMaintenanceTaskEvidence(stalePublishCas);
    assert.equal(stalePublishCasTrace.evidence_valid, true);
    assert.equal(stalePublishCasTrace.oracle_checks.visible_publish_exactly_one_version_release, false);

    const operationIdentityDrift = expertMaintenanceEvidenceInput(screenshot);
    operationIdentityDrift.publication.operation_id = 'other-operation';
    const operationIdentityDriftTrace = coreBetaExpertMaintenanceTaskEvidence(operationIdentityDrift);
    assert.equal(operationIdentityDriftTrace.evidence_valid, true);
    assert.equal(operationIdentityDriftTrace.oracle_checks.visible_publish_exactly_one_version_release, false);

    const reopenDrift = expertMaintenanceEvidenceInput(screenshot);
    reopenDrift.reopen.task_id = 'other-task';
    reopenDrift.reopen.state.active_id = 'other-task';
    const reopenDriftTrace = coreBetaExpertMaintenanceTaskEvidence(reopenDrift);
    assert.equal(reopenDriftTrace.evidence_valid, true);
    assert.equal(reopenDriftTrace.oracle_checks.reopened_session_target_stable, false);

    const reopenMessageDrift = expertMaintenanceEvidenceInput(screenshot);
    reopenMessageDrift.reopen.session.messages[1].parts.at(-1).text = '重开后被篡改的助手消息';
    const reopenMessageDriftTrace = coreBetaExpertMaintenanceTaskEvidence(reopenMessageDrift);
    assert.equal(reopenMessageDriftTrace.evidence_valid, true);
    assert.equal(reopenMessageDriftTrace.oracle_checks.reopened_session_target_stable, false);

    const inheritedNewTask = expertMaintenanceEvidenceInput(screenshot);
    inheritedNewTask.newTask.maintenance_visible = true;
    inheritedNewTask.newTask.state.current_expert = 'qwork.builtin.expert-authoring';
    inheritedNewTask.newTask.state.expert_authoring_view = {
      schema_version: 1,
      draft_id: inheritedNewTask.expectedDraftId,
      expert_id: inheritedNewTask.expectedExpertId,
    };
    const inheritedNewTaskTrace = coreBetaExpertMaintenanceTaskEvidence(inheritedNewTask);
    assert.equal(inheritedNewTaskTrace.evidence_valid, true);
    assert.equal(inheritedNewTaskTrace.oracle_checks.new_task_clears_maintenance_context, false);

    for (const [name, mutate] of [
      ['messages', (input) => input.newTask.state.messages.push({ role: 'user', parts: [{ t: 'text', text: 'old' }] })],
      ['skill', (input) => { input.newTask.state.selected_skills = ['inherited-skill']; }],
      ['connector', (input) => { input.newTask.state.selected_connectors = ['inherited-connector']; }],
      ['attachment', (input) => { input.newTask.state.attachment_count = 1; }],
      ['draft', (input) => { input.newTask.state.draft_instance_id = input.reopen.state.draft_instance_id; }],
    ]) {
      const inherited = expertMaintenanceEvidenceInput(screenshot);
      mutate(inherited);
      const trace = coreBetaExpertMaintenanceTaskEvidence(inherited);
      assert.equal(trace.evidence_valid, true, `${name} 继承仍应保留完整产品证据`);
      assert.equal(trace.oracle_checks.new_task_clears_maintenance_context, false, `${name} 继承必须失败`);
    }

    fs.writeFileSync(traceFile, JSON.stringify(extraPublicationTrace));
    const productFailureManifest = buildCoreEvidenceManifest({
      testCase: { id: 'BETA-EXPERT-012', evidence_roles: ['expert_maintenance_task_trace'] },
      caseDir,
      artifacts: { expert_maintenance_task_trace: traceFile },
    });
    assert.equal(extraPublicationTrace.oracle_valid, false);
    assert.equal(productFailureManifest.complete, true, '产品 Oracle 失败不得令完整证据失效');

    const evidenceFailure = expertMaintenanceEvidenceInput(screenshot);
    evidenceFailure.entry.before.send_count = null;
    const evidenceFailureTrace = coreBetaExpertMaintenanceTaskEvidence(evidenceFailure);
    fs.writeFileSync(traceFile, JSON.stringify(evidenceFailureTrace));
    const evidenceFailureManifest = buildCoreEvidenceManifest({
      testCase: { id: 'BETA-EXPERT-012', evidence_roles: ['expert_maintenance_task_trace'] },
      caseDir,
      artifacts: { expert_maintenance_task_trace: traceFile },
    });
    assert.equal(evidenceFailureTrace.evidence_valid, false);
    assert.equal(evidenceFailureManifest.complete, false);
    assert.deepEqual(evidenceFailureManifest.invalid_roles, ['expert_maintenance_task_trace']);

    const tamperedTrace = structuredClone(validTrace);
    tamperedTrace.new_task.state.current_expert = 'qwork.builtin.expert-authoring';
    fs.writeFileSync(traceFile, JSON.stringify(tamperedTrace));
    assert.equal(
      validateEvidenceFile('expert_maintenance_task_trace', traceFile, {
        expectedCaseId: 'BETA-EXPERT-012',
        expectedCaseDir: caseDir,
      }).valid,
      false,
      'trace 原始字段被篡改后必须通过复算拒绝自报结论',
    );

    const assertRejectedTrace = (trace, expectedError, message) => {
      fs.writeFileSync(traceFile, JSON.stringify(trace));
      const validation = validateEvidenceFile('expert_maintenance_task_trace', traceFile, {
        expectedCaseId: 'BETA-EXPERT-012',
        expectedCaseDir: caseDir,
      });
      assert.equal(validation.valid, false, message);
      assert.equal(validation.error, expectedError, message);
    };

    const outsideTraceFile = path.join(outsideDir, 'expert-maintenance-task-trace.json');
    fs.writeFileSync(outsideTraceFile, JSON.stringify(validTrace));
    assert.equal(
      validateEvidenceFile('expert_maintenance_task_trace', outsideTraceFile, {
        expectedCaseId: 'BETA-EXPERT-012',
        expectedCaseDir: caseDir,
      }).valid,
      false,
      '专家维护 trace 本体越出 Case 目录时必须拒绝',
    );

    fs.writeFileSync(traceFile, JSON.stringify(validTrace));
    const traceSymlink = path.join(caseDir, 'expert-maintenance-task-trace-link.json');
    fs.symlinkSync(traceFile, traceSymlink);
    assert.equal(
      validateEvidenceFile('expert_maintenance_task_trace', traceSymlink, {
        expectedCaseId: 'BETA-EXPERT-012',
        expectedCaseDir: caseDir,
      }).error,
      'evidence_symlink_forbidden',
      '专家维护 trace 本体为符号链接时必须拒绝',
    );

    const outsideScreenshotInput = expertMaintenanceEvidenceInput(screenshot);
    const outsideScreenshot = path.join(outsideDir, 'expert-maintenance-outside.png');
    fs.writeFileSync(outsideScreenshot, Buffer.alloc(256, 8));
    outsideScreenshotInput.entry.screenshot = {
      path: outsideScreenshot,
      bytes: fs.statSync(outsideScreenshot).size,
      sha256: createHash('sha256').update(fs.readFileSync(outsideScreenshot)).digest('hex'),
    };
    assertRejectedTrace(
      coreBetaExpertMaintenanceTaskEvidence(outsideScreenshotInput),
      'expert_maintenance_task_trace_entry_screenshot_outside_case',
      '专家维护截图越出 Case 目录时必须拒绝',
    );

    const symlinkScreenshotInput = expertMaintenanceEvidenceInput(screenshot);
    const screenshotSymlink = path.join(caseDir, 'expert-maintenance-entry-link.png');
    fs.symlinkSync(symlinkScreenshotInput.entry.screenshot.path, screenshotSymlink);
    symlinkScreenshotInput.entry.screenshot = {
      ...symlinkScreenshotInput.entry.screenshot,
      path: screenshotSymlink,
    };
    assertRejectedTrace(
      coreBetaExpertMaintenanceTaskEvidence(symlinkScreenshotInput),
      'expert_maintenance_task_trace_entry_screenshot_not_regular_file',
      '专家维护截图为符号链接时必须拒绝',
    );

    const bytesMismatchInput = expertMaintenanceEvidenceInput(screenshot);
    bytesMismatchInput.entry.screenshot.bytes += 1;
    assertRejectedTrace(
      coreBetaExpertMaintenanceTaskEvidence(bytesMismatchInput),
      'expert_maintenance_task_trace_entry_screenshot_integrity_invalid',
      '专家维护截图声明 bytes 与磁盘不一致时必须拒绝',
    );

    const shaMismatchInput = expertMaintenanceEvidenceInput(screenshot);
    shaMismatchInput.entry.screenshot.sha256 = 'f'.repeat(64);
    assertRejectedTrace(
      coreBetaExpertMaintenanceTaskEvidence(shaMismatchInput),
      'expert_maintenance_task_trace_entry_screenshot_integrity_invalid',
      '专家维护截图声明 SHA 与磁盘不一致时必须拒绝',
    );

    const reusedScreenshotInput = expertMaintenanceEvidenceInput(screenshot);
    reusedScreenshotInput.quickTask.screenshot = structuredClone(reusedScreenshotInput.entry.screenshot);
    assertRejectedTrace(
      coreBetaExpertMaintenanceTaskEvidence(reusedScreenshotInput),
      'expert_maintenance_task_trace_screenshot_reused',
      '专家维护多个阶段重复引用同一截图时必须拒绝',
    );
  } finally {
    fs.rmSync(caseDir, { recursive: true, force: true });
    fs.rmSync(outsideDir, { recursive: true, force: true });
  }
}

{
  const caseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'qbot-web-search-quota-trace-'));
  const taskId = 'task-web-search-quota-trace';
  const rounds = Array.from({ length: 4 }, (_, index) => {
    const round = index + 1;
    const prompt = `第${round}轮真实 Web 搜索`;
    const promptSha256 = createHash('sha256').update(prompt).digest('hex');
    const screenshotPath = path.join(caseDir, `round-${round}.png`);
    fs.writeFileSync(screenshotPath, Buffer.alloc(256, round));
    const runtimeEvidence = {
      diagnostics: {
        sessionId: taskId,
        e2eCurrentTurnAuthorityReadiness: { ready: true },
        e2eCurrentTurnAuthority: {
          connectorRouting: {
            effectiveConnectorIds: ['builtin:qbot_web'],
            mode: 'auto',
          },
          connectorRuntimeMaterialization: {
            materializedConnectorIds: ['builtin:qbot_web'],
            unsupportedConnectorIds: [],
          },
          providerReceiptHash: `${String.fromCharCode(96 + round)}`.repeat(64),
          executionTarget: 'desktop-local',
          routeTarget: 'builtin:qbot_web',
        },
      },
    };
    const toolTexts = ['qbot_web provider search completed'];
    const sendReceipts = [{
      action: `发送第${round}轮`,
      prompt,
      confirmed_at: '2026-09-04T00:00:00.000Z',
      attempts: [{
        clicked: true,
        receipt: { ok: true, snapshot: { activeId: taskId, userTexts: [prompt] } },
      }],
    }];
    const businessOracle = webSearchBusinessVerdict(
      structuredProtocolWebReply(round),
      `${toolTexts.join('\n')}\n${JSON.stringify(runtimeEvidence)}`,
    );
    const runtimeAuthority = webRuntimeAuthorityVerdict({
      runtimeEvidence,
      prompt,
      sendReceipts,
      expectedTaskId: round === 1 ? '' : taskId,
    });
    return {
      round,
      prompt,
      prompt_sha256: promptSha256,
      task_id: taskId,
      reply: structuredProtocolWebReply(round),
      tool_texts: toolTexts,
      runtime_evidence: runtimeEvidence,
      send_receipts: sendReceipts,
      business_oracle: businessOracle,
      runtime_authority: runtimeAuthority,
      post_round_state: { available: true, activeId: taskId, running: false },
      timeout_cleanup_ok: true,
      screenshot: {
        path: screenshotPath,
        bytes: fs.statSync(screenshotPath).size,
        sha256: createHash('sha256').update(fs.readFileSync(screenshotPath)).digest('hex'),
      },
    };
  });
  const validTrace = webSearchQuotaTraceVerdict({
    caseId: 'MRSMOKE-WEB-001',
    legacyCaseId: 'SIT-CONN-019',
    rounds,
  });
  const traceFile = path.join(caseDir, 'web-search-quota-trace.json');
  fs.writeFileSync(traceFile, JSON.stringify(validTrace));
  assert.equal(
    validateEvidenceFile('web_search_quota_trace', traceFile, {
      expectedCaseId: 'MRSMOKE-WEB-001',
      expectedCaseDir: caseDir,
    }).valid,
    true,
    '四轮 Web 搜索 trace 必须从磁盘实读 prompt 与四张 Case 内截图后才可进入 manifest',
  );

  const emptyTaskRound = structuredClone(validTrace);
  emptyTaskRound.rounds[2].task_id = '';
  emptyTaskRound.rounds[2].runtime_authority.taskId = '';
  emptyTaskRound.rounds[2].post_round_state.activeId = '';
  emptyTaskRound.rounds[2].runtime_authority.ok = true;
  fs.writeFileSync(traceFile, JSON.stringify(emptyTaskRound));
  const emptyTaskResult = webSearchQuotaTraceVerdict({
    caseId: 'MRSMOKE-WEB-001',
    legacyCaseId: 'SIT-CONN-019',
    rounds: emptyTaskRound.rounds,
  });
  assert.equal(emptyTaskResult.evidence_checks.one_nonempty_task_for_all_rounds, false, '任一轮 taskId 为空必须失败');
  assert.equal(
    validateEvidenceFile('web_search_quota_trace', traceFile, {
      expectedCaseId: 'MRSMOKE-WEB-001',
      expectedCaseDir: caseDir,
    }).valid,
    false,
    '任一轮 taskId 为空不得进入 manifest',
  );

  const forgedBusiness = structuredClone(validTrace);
  forgedBusiness.rounds[0].reply = '这不是搜索结果';
  fs.writeFileSync(traceFile, JSON.stringify(forgedBusiness));
  assert.equal(
    validateEvidenceFile('web_search_quota_trace', traceFile, {
      expectedCaseId: 'MRSMOKE-WEB-001',
      expectedCaseDir: caseDir,
    }).valid,
    false,
    '业务 Oracle 必须从原始回复和工具证据重算，不能信任自报 ok',
  );

  const forgedRuntime = structuredClone(validTrace);
  forgedRuntime.rounds[1].runtime_evidence.diagnostics.e2eCurrentTurnAuthority.connectorRuntimeMaterialization.materializedConnectorIds = [];
  fs.writeFileSync(traceFile, JSON.stringify(forgedRuntime));
  assert.equal(
    validateEvidenceFile('web_search_quota_trace', traceFile, {
      expectedCaseId: 'MRSMOKE-WEB-001',
      expectedCaseDir: caseDir,
    }).valid,
    false,
    'runtime authority 必须从原始 runtime evidence 和发送回执重算',
  );

  const forgedReceipt = structuredClone(validTrace);
  forgedReceipt.rounds[0].send_receipts[0].confirmed_at = '';
  fs.writeFileSync(traceFile, JSON.stringify(forgedReceipt));
  assert.equal(
    validateEvidenceFile('web_search_quota_trace', traceFile, {
      expectedCaseId: 'MRSMOKE-WEB-001',
      expectedCaseDir: caseDir,
    }).valid,
    false,
    '发送回执原始字段被篡改时不得继续使用自报 runtime authority',
  );

  const promptTampered = structuredClone(validTrace);
  promptTampered.rounds[0].prompt = '篡改后的搜索请求';
  fs.writeFileSync(traceFile, JSON.stringify(promptTampered));
  assert.equal(
    validateEvidenceFile('web_search_quota_trace', traceFile, {
      expectedCaseId: 'MRSMOKE-WEB-001',
      expectedCaseDir: caseDir,
    }).valid,
    false,
    'trace 不得接受未随 prompt 重算的自报 SHA',
  );

  const checksumTampered = structuredClone(validTrace);
  checksumTampered.rounds[1].screenshot.sha256 = 'f'.repeat(64);
  fs.writeFileSync(traceFile, JSON.stringify(checksumTampered));
  assert.equal(
    validateEvidenceFile('web_search_quota_trace', traceFile, {
      expectedCaseId: 'MRSMOKE-WEB-001',
      expectedCaseDir: caseDir,
    }).valid,
    false,
    'trace 不得接受与截图实际字节不一致的自报 SHA',
  );

  const stringBytes = structuredClone(validTrace);
  stringBytes.rounds[1].screenshot.bytes = String(stringBytes.rounds[1].screenshot.bytes);
  fs.writeFileSync(traceFile, JSON.stringify(stringBytes));
  assert.equal(
    validateEvidenceFile('web_search_quota_trace', traceFile, {
      expectedCaseId: 'MRSMOKE-WEB-001',
      expectedCaseDir: caseDir,
    }).valid,
    false,
    'trace 截图 bytes 必须是与磁盘严格相等的安全整数，不能接受字符串强转',
  );

  const smallScreenshot = path.join(caseDir, 'round-small.png');
  fs.writeFileSync(smallScreenshot, Buffer.alloc(64, 7));
  const tooSmall = structuredClone(validTrace);
  tooSmall.rounds[1].screenshot = {
    path: smallScreenshot,
    bytes: fs.statSync(smallScreenshot).size,
    sha256: createHash('sha256').update(fs.readFileSync(smallScreenshot)).digest('hex'),
  };
  fs.writeFileSync(traceFile, JSON.stringify(tooSmall));
  assert.equal(
    validateEvidenceFile('web_search_quota_trace', traceFile, {
      expectedCaseId: 'MRSMOKE-WEB-001',
      expectedCaseDir: caseDir,
    }).valid,
    false,
    'trace 截图必须满足正式截图最小字节合同',
  );

  const wrongIdentity = structuredClone(validTrace);
  wrongIdentity.schema_version = 'qbot-web-search-quota-trace/forged';
  fs.writeFileSync(traceFile, JSON.stringify(wrongIdentity));
  assert.equal(
    validateEvidenceFile('web_search_quota_trace', traceFile, {
      expectedCaseId: 'MRSMOKE-WEB-001',
      expectedCaseDir: caseDir,
    }).valid,
    false,
    'trace 必须拒绝错误 schema 或 Case identity',
  );

  const productFailureRounds = structuredClone(rounds);
  productFailureRounds[3].reply = 'The server rejected the fourth search.';
  productFailureRounds[3].business_oracle = webSearchBusinessVerdict(
    productFailureRounds[3].reply,
    `${productFailureRounds[3].tool_texts.join('\n')}\n${JSON.stringify(productFailureRounds[3].runtime_evidence)}`,
  );
  const productFailureTrace = webSearchQuotaTraceVerdict({
    caseId: 'MRSMOKE-WEB-001',
    legacyCaseId: 'SIT-CONN-019',
    rounds: productFailureRounds,
  });
  assert.equal(productFailureTrace.evidence_valid, true);
  assert.equal(productFailureTrace.oracle_valid, false);
  fs.writeFileSync(traceFile, JSON.stringify(productFailureTrace));
  assert.equal(
    validateEvidenceFile('web_search_quota_trace', traceFile, {
      expectedCaseId: 'MRSMOKE-WEB-001',
      expectedCaseDir: caseDir,
    }).valid,
    true,
    '产品第四轮配额拒绝应保留 manifest-valid 负向证据，不能误升为框架问题',
  );

  assert.equal(webSearchFixedQuotaRejection('服务端未限制第四轮搜索。'), false);
  assert.equal(webSearchFixedQuotaRejection('服务端没有拒绝第四轮搜索。'), false);
  assert.equal(webSearchFixedQuotaRejection('搜索配额没有耗尽，第四轮已成功。'), false);
  assert.equal(webSearchFixedQuotaRejection('不存在固定搜索次数上限。'), false);
  assert.equal(webSearchFixedQuotaRejection('服务端拒绝第四轮搜索。'), true);

  const outsideScreenshot = path.join(path.dirname(caseDir), `${path.basename(caseDir)}-outside.png`);
  fs.writeFileSync(outsideScreenshot, Buffer.alloc(256, 8));
  const escaped = structuredClone(validTrace);
  escaped.rounds[2].screenshot = {
    path: outsideScreenshot,
    bytes: fs.statSync(outsideScreenshot).size,
    sha256: createHash('sha256').update(fs.readFileSync(outsideScreenshot)).digest('hex'),
  };
  fs.writeFileSync(traceFile, JSON.stringify(escaped));
  assert.equal(
    validateEvidenceFile('web_search_quota_trace', traceFile, {
      expectedCaseId: 'MRSMOKE-WEB-001',
      expectedCaseDir: caseDir,
    }).valid,
    false,
    'trace 不得引用 Case 目录外截图',
  );

  const screenshotDirectory = path.join(caseDir, 'round-directory.png');
  fs.mkdirSync(screenshotDirectory);
  const directoryBacked = structuredClone(validTrace);
  directoryBacked.rounds[2].screenshot.path = screenshotDirectory;
  directoryBacked.rounds[2].screenshot.bytes = fs.statSync(screenshotDirectory).size;
  fs.writeFileSync(traceFile, JSON.stringify(directoryBacked));
  assert.equal(
    validateEvidenceFile('web_search_quota_trace', traceFile, {
      expectedCaseId: 'MRSMOKE-WEB-001',
      expectedCaseDir: caseDir,
    }).valid,
    false,
    'trace 不得把目录冒充截图文件',
  );

  const symlinkScreenshot = path.join(caseDir, 'round-symlink.png');
  fs.symlinkSync(rounds[3].screenshot.path, symlinkScreenshot);
  const symlinked = structuredClone(validTrace);
  symlinked.rounds[3].screenshot = {
    path: symlinkScreenshot,
    bytes: fs.statSync(symlinkScreenshot).size,
    sha256: createHash('sha256').update(fs.readFileSync(symlinkScreenshot)).digest('hex'),
  };
  fs.writeFileSync(traceFile, JSON.stringify(symlinked));
  assert.equal(
    validateEvidenceFile('web_search_quota_trace', traceFile, {
      expectedCaseId: 'MRSMOKE-WEB-001',
      expectedCaseDir: caseDir,
    }).valid,
    false,
    'trace 不得把符号链接冒充 Case 内真实截图',
  );

  fs.writeFileSync(traceFile, JSON.stringify(validTrace));
  const traceSymlink = path.join(caseDir, 'web-search-quota-trace-link.json');
  fs.symlinkSync(traceFile, traceSymlink);
  assert.equal(
    validateEvidenceFile('web_search_quota_trace', traceSymlink, {
      expectedCaseId: 'MRSMOKE-WEB-001',
      expectedCaseDir: caseDir,
    }).valid,
    false,
    'quota trace 文件本身也不得是符号链接',
  );

  const nonJsonTrace = path.join(caseDir, 'web-search-quota-trace.txt');
  fs.writeFileSync(nonJsonTrace, JSON.stringify(validTrace));
  assert.equal(
    validateEvidenceFile('web_search_quota_trace', nonJsonTrace, {
      expectedCaseId: 'MRSMOKE-WEB-001',
      expectedCaseDir: caseDir,
    }).valid,
    false,
    'quota trace 角色不得通过改扩展名绕过专用 JSON 校验',
  );

  const outsideTrace = path.join(path.dirname(caseDir), `${path.basename(caseDir)}-outside.json`);
  fs.writeFileSync(outsideTrace, JSON.stringify(validTrace));
  assert.equal(
    validateEvidenceFile('web_search_quota_trace', outsideTrace, {
      expectedCaseId: 'MRSMOKE-WEB-001',
      expectedCaseDir: caseDir,
    }).valid,
    false,
    'manifest 必须用权威 Case 目录拒绝 trace 文件自身越界',
  );
}

{
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'qbot-qwork-expert-audience-rejection-'));
  const screenshot = path.join(root, 'qwork-expert-audience-rejected.png');
  fs.writeFileSync(screenshot, Buffer.alloc(256, 9));
  const cleanState = {
    task: { id: null, running: false, message_count: 0, send_count: 71 },
    expert: null,
    capabilities: { selectedSkills: null, selectedConnectors: null, currentExpert: null },
    skills: { selected: [] },
    connectors: { selected: [] },
  };
  const label = 'QWork日常专家-QWD-EXPERT-009-fixture';
  const lifecycle = {
    available: true,
    before: [],
    after: [],
    drafts_before: [],
    drafts_after: [],
    product_rejection: {
      stage: 'create_draft',
      name: 'ExpertContractError',
      message: 'expert audience is not supported',
      code: '',
    },
  };
  const blocker = qworkDailyExpertAudienceRejectionEvidence({
    testCaseId: 'QWD-EXPERT-009',
    expectedAudience: 'org',
    expertLabel: label,
    lifecycle,
    before: cleanState,
    after: cleanState,
    screenshot,
    noPromptRecorded: true,
    noSendReceiptRecorded: true,
  });
  assert.equal(blocker.evidence_valid, true, '组织可见范围产品拒绝必须形成完整零发送证据');
  assert.equal(blocker.oracle_valid, false);
  assert.equal(blocker.outcome, 'bug');

  const evidenceRoles = [
    'before_screenshot', 'action_receipt', 'after_screenshot', 'public_state_readback',
    'cleanup_readback', 'qwork_daily_readback', 'task_id', 'prompt', 'send_receipt',
    'transcript', 'reply_delta', 'reply_completion', 'capability_selection',
    'capability_execution_event', 'expert_identity_snapshot', 'expert_draft_lifecycle',
    'expert_publish_operation', 'expert_runtime_trace', 'expert_history_readback',
  ];
  const blockerFile = path.join(root, 'expert-audience-product-rejection.json');
  fs.writeFileSync(blockerFile, JSON.stringify(blocker));
  fs.writeFileSync(path.join(root, 'action-receipts.json'), JSON.stringify([{
    action_id: 'qwd-expert-009-execute',
    status: 'failed',
    category: 'bug',
    before_screenshot: screenshot,
    after_screenshot: screenshot,
  }]));
  const artifacts = {
    core_beta_not_applicable_roles: blocker.not_applicable_roles.map((role) => ({ role, blocker_path: blockerFile })),
  };
  for (const role of evidenceRoles.filter((role) => ![
    'before_screenshot', 'after_screenshot', 'action_receipt', ...blocker.not_applicable_roles,
  ].includes(role))) {
    const file = path.join(root, `${role}.json`);
    fs.writeFileSync(file, JSON.stringify(qworkDailyEvidenceEnvelope(
      'QWD-EXPERT-009',
      { blocker_path: blockerFile, rejection: blocker },
      false,
      true,
      '2026-08-15T00:00:00.000Z',
    )));
    artifacts[role] = file;
  }
  const manifest = buildCoreEvidenceManifest({
    testCase: { id: 'QWD-EXPERT-009', evidence_roles: evidenceRoles },
    caseDir: root,
    artifacts,
    screenshots: { before: screenshot, after: screenshot },
    actions: [{ action_id: 'qwd-expert-009-execute' }],
  });
  assert.equal(
    manifest.complete,
    true,
    `组织可见范围产品拒绝必须补齐完整 manifest 并允许继续后续 Case：${JSON.stringify(manifest)}`,
  );
  assert.deepEqual(manifest.not_applicable_roles.map((item) => item.role), blocker.not_applicable_roles);

  const tampered = qworkDailyExpertAudienceRejectionEvidence({
    testCaseId: 'QWD-EXPERT-009',
    expectedAudience: 'org',
    expertLabel: label,
    lifecycle,
    before: cleanState,
    after: { ...cleanState, task: { ...cleanState.task, send_count: 72 } },
    screenshot,
    noPromptRecorded: true,
    noSendReceiptRecorded: true,
  });
  assert.equal(tampered.evidence_valid, false, '发送计数变化时不得把未发生的会话角色标成 N/A');
}

{
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'qbot-core-timeout-evidence-'));
  const screenshot = path.join(root, 'after-timeout.png');
  const completion = path.join(root, 'reply-completion.json');
  fs.writeFileSync(screenshot, Buffer.alloc(256, 7));
  const screenshotSha256 = createHash('sha256').update(fs.readFileSync(screenshot)).digest('hex');
  fs.writeFileSync(completion, JSON.stringify({
    complete: false,
    evidence_complete: true,
    terminal_failure: true,
    terminal_outcome: 'timed_out',
    assistant_reply_present: false,
    confirmed_send_receipt: true,
    waited_ms: 600_330,
    timeout_ms: 600_000,
    terminal_reason: '等待 Agent 回复完成超时，未观察到助手正文。',
    timeout_screenshot: screenshot,
    timeout_screenshot_sha256: screenshotSha256,
  }));
  assert.deepEqual(
    validateEvidenceFile('reply_completion', completion),
    { valid: true },
    '完整发送回执、等待窗口和超时截图必须构成有效的产品失败终态证据',
  );
  fs.writeFileSync(completion, JSON.stringify({
    complete: false,
    evidence_complete: true,
    terminal_failure: true,
    terminal_outcome: 'timed_out',
    assistant_reply_present: false,
    confirmed_send_receipt: true,
    waited_ms: 59_999,
    timeout_ms: 600_000,
    terminal_reason: '等待不足。',
    timeout_screenshot: screenshot,
    timeout_screenshot_sha256: screenshotSha256,
  }));
  assert.equal(
    validateEvidenceFile('reply_completion', completion).valid,
    false,
    '等待窗口不足时不得把无回复包装成完整失败证据',
  );
  fs.writeFileSync(completion, JSON.stringify({
    complete: false,
    evidence_complete: true,
    terminal_failure: true,
    terminal_outcome: 'no_reply',
    assistant_reply_present: false,
    confirmed_send_receipt: true,
    observed_running_after_send: true,
    running_after: false,
    no_reply_stable_observations: 3,
    terminal_reconciliation_performed: true,
    terminal_reconciliation_task_bound: true,
    terminal_reconciliation_prompt_bound: true,
    terminal_reconciliation_reply_present: false,
    waited_ms: 60_330,
    min_wait_ms: 60_000,
    timeout_ms: 600_000,
    terminal_reason: 'Agent 进入运行态后停止，连续三次稳定采样没有助手正文。',
    terminal_screenshot: screenshot,
    terminal_screenshot_sha256: screenshotSha256,
  }));
  assert.deepEqual(
    validateEvidenceFile('reply_completion', completion),
    { valid: true },
    '确认运行后停止、最小等待足额和连续稳定无回复应构成完整产品失败终态证据',
  );
  fs.writeFileSync(completion, JSON.stringify({
    complete: false,
    evidence_complete: true,
    terminal_failure: true,
    terminal_outcome: 'no_reply',
    assistant_reply_present: false,
    confirmed_send_receipt: true,
    observed_running_after_send: false,
    running_after: false,
    no_reply_stable_observations: 3,
    terminal_reconciliation_performed: true,
    terminal_reconciliation_task_bound: true,
    terminal_reconciliation_prompt_bound: true,
    terminal_reconciliation_reply_present: false,
    waited_ms: 60_330,
    min_wait_ms: 60_000,
    timeout_ms: 600_000,
    terminal_reason: '没有运行态证明。',
    terminal_screenshot: screenshot,
    terminal_screenshot_sha256: screenshotSha256,
  }));
  assert.equal(
    validateEvidenceFile('reply_completion', completion).valid,
    false,
    '没有确认进入运行态时不得把排队中的任务误判为终止无回复',
  );
  fs.writeFileSync(completion, JSON.stringify({
    complete: false,
    evidence_complete: true,
    terminal_failure: true,
    terminal_outcome: 'no_reply',
    assistant_reply_present: false,
    confirmed_send_receipt: true,
    observed_running_after_send: true,
    running_after: false,
    no_reply_stable_observations: 3,
    terminal_reconciliation_performed: true,
    terminal_reconciliation_task_bound: true,
    terminal_reconciliation_prompt_bound: true,
    terminal_reconciliation_reply_present: true,
    waited_ms: 60_330,
    min_wait_ms: 60_000,
    timeout_ms: 600_000,
    terminal_reason: '终态复核已经看到回复，禁止生成 no_reply。',
    terminal_screenshot: screenshot,
    terminal_screenshot_sha256: screenshotSha256,
  }));
  assert.equal(
    validateEvidenceFile('reply_completion', completion).valid,
    false,
    '终态复核已存在 prompt 绑定回复时不得生成 no_reply 产品失败证据',
  );
  const beforeStop = path.join(root, 'before-stop.png');
  const afterStop = path.join(root, 'after-stop.png');
  fs.writeFileSync(beforeStop, Buffer.alloc(256, 8));
  fs.writeFileSync(afterStop, Buffer.alloc(256, 9));
  const stoppedPayload = {
    complete: false,
    evidence_complete: true,
    completion_observed: false,
    terminal_failure: false,
    terminal_outcome: 'user_stopped',
    assistant_reply_present: true,
    confirmed_send_receipt: true,
    stop_click_performed: true,
    task_id: 'task-stop-1',
    task_id_before: 'task-stop-1',
    task_id_after: 'task-stop-1',
    prompt_sha256: 'a'.repeat(64),
    confirmed_send_prompt_sha256: 'a'.repeat(64),
    running_before: true,
    running_after: false,
    partial_reply_ready_before_click: true,
    partial_chars_before_click: 12,
    partial_sha256_before_click: 'b'.repeat(64),
    retained_chars: 12,
    retained_sha256: 'b'.repeat(64),
    partial_preserved: true,
    before_screenshot: beforeStop,
    before_screenshot_sha256: createHash('sha256').update(fs.readFileSync(beforeStop)).digest('hex'),
    after_screenshot: afterStop,
    after_screenshot_sha256: createHash('sha256').update(fs.readFileSync(afterStop)).digest('hex'),
  };
  fs.writeFileSync(completion, JSON.stringify(stoppedPayload));
  assert.deepEqual(
    validateEvidenceFile('reply_completion', completion),
    { valid: true },
    '用户停止必须作为 complete=false、terminal_failure=false 的可信终态通过证据校验',
  );
  for (const invalidStopped of [
    { ...stoppedPayload, complete: true },
    { ...stoppedPayload, terminal_failure: true },
    { ...stoppedPayload, task_id_after: 'drifted-task' },
    { ...stoppedPayload, confirmed_send_prompt_sha256: 'c'.repeat(64) },
  ]) {
    fs.writeFileSync(completion, JSON.stringify(invalidStopped));
    assert.equal(
      validateEvidenceFile('reply_completion', completion).valid,
      false,
      `用户停止终态合同漂移必须 fail-closed：${JSON.stringify(invalidStopped)}`,
    );
  }
  fs.writeFileSync(completion, JSON.stringify({
    ...stoppedPayload,
    assistant_reply_present: false,
    retained_chars: 0,
    retained_sha256: createHash('sha256').update('').digest('hex'),
    partial_preserved: false,
  }));
  assert.deepEqual(
    validateEvidenceFile('reply_completion', completion),
    { valid: true },
    '停止后正文丢失是证据完整的产品 Bug，不得升级成 manifest 缺失的框架错误',
  );
  fs.rmSync(root, { recursive: true, force: true });
}

assert.equal(CORE_BETA_BASE_SCENARIO_IDS.size, 184);
assert.equal(FULL_FUNCTION_REGRESSION_LEGACY_CASE_IDS.size, 95);
assert.equal(CORE_BETA_SCENARIO_IDS.size, 305);
assert.equal(CORE_BETA_SCENARIO_REGISTRY.size, 305);
assert.equal(
  new Set([...CORE_BETA_SCENARIO_REGISTRY.values()].map((item) => item.executor_route)).size,
  305,
  '每个Core Beta Case必须绑定唯一执行器路由',
);
for (const [id, caseType, driver] of [
  ['QWD-ENTRY-002', 'task_lifecycle', 'qwork_daily_new_task_auto_isolation'],
  ['QWD-WS-001', 'task_lifecycle', 'qwork_daily_workspace_task_binding'],
  ['QWD-ART-007', 'artifact', 'qwork_daily_artifact_exact_directory'],
  ['QWD-ART-008', 'artifact', 'qwork_daily_artifact_keep_both_atomic'],
  ['QWD-EXPERT-002', 'expert_lifecycle', 'qwork_daily_expert_catalog_identity'],
  ['QWD-EXPERT-009', 'expert_lifecycle', 'qwork_daily_expert_owner_org_publish'],
  ['QWD-EXPERT-011', 'expert_lifecycle', 'qwork_daily_expert_owner_lifecycle'],
  ['QWD-AUTO-002', 'model_routing', 'qwork_daily_route_task_stability'],
  ['QWD-AUTO-003', 'model_routing', 'qwork_daily_capability_turn_snapshot'],
  ['QWD-AUTO-004', 'model_routing', 'qwork_daily_capability_fallback_copy'],
  ['QWD-SYS-003', 'settings_lifecycle', 'qwork_daily_settings_persona_profile'],
  ['QWD-MEM-002', 'memory_lifecycle', 'qwork_daily_memory_precedence'],
  ['QWD-SEC-002', 'security_privacy', 'qwork_daily_prompt_injection_boundary'],
  ['QWD-SEC-005', 'security_privacy', 'qwork_daily_credential_redaction_copy'],
]) {
  const scenario = CORE_BETA_SCENARIO_REGISTRY.get(id);
  assert.equal(scenario?.driver, driver, `${id} 必须绑定唯一日常回归原生driver`);
  assert.equal(scenario?.fixture_control, 'public_product_state', `${id} 不得降级到严格控制器`);
  const binding = coreBetaRuntimeExecutorBinding({ id, case_type: caseType }, scenario);
  assert.equal(binding.dispatchable, true, `${id} 必须在静态审计阶段可分发`);
  assert.equal(binding.mode, 'native', `${id} 必须由runner原生执行`);
}

for (const [id, driver, mode, legacyCaseId = '', caseType = 'conversation'] of [
  ['MRSMOKE-ACT-001', 'qwork_mr_activity_timeline', 'native'],
  ['MRSMOKE-WEB-001', 'qwork_mr_web_search_success', 'verified_legacy', 'SIT-CONN-019'],
  ['MRSMOKE-WEB-002', 'qwork_mr_web_search_ssrf_rejection', 'verified_legacy', 'SIT-CONN-015'],
  ['MRSMOKE-AUTH-001', 'qwork_mr_workspace_authorization_boundary', 'verified_legacy', 'SIT-WORKSPACE-001'],
  ['MRSMOKE-AUTO-001', 'qwork_mr_interval_schedule', 'native'],
  ['MRSMOKE-NAV-001', 'qwork_mr_sidebar_collapse_expand', 'verified_legacy', 'SIT-HOME-051'],
  ['MRSMOKE-ROUTE-001', 'qwork_daily_route_task_stability', 'native'],
  ['MRSMOKE-SKILL-001', 'qwork_mr_skill_install_use_isolation', 'verified_legacy', 'SIT-SKILL-MR-001'],
  ['MRSMOKE-FAIL-001', 'qwork_mr_connector_retry_recovery', 'native'],
  ['MRSMOKE-ART-001', 'qwork_daily_artifact_exact_directory', 'native'],
  ['MRSMOKE-ENTRY-001', 'qwork_daily_new_task_auto_isolation', 'native'],
  ['MRSMOKE-CHART-001', 'qwork_mr_interactive_chart', 'verified_legacy', 'SIT-CONN-016', 'mcp_use'],
]) {
  const scenario = CORE_BETA_SCENARIO_REGISTRY.get(id);
  assert.equal(scenario?.driver, driver, `${id} 必须绑定冻结的 MR 冒烟 driver`);
  assert.equal(scenario?.fixture_control, 'public_product_state', `${id} 不得依赖严格控制器`);
  assert.equal(scenario?.legacy_case_id || '', legacyCaseId, `${id} legacy 复用身份漂移`);
  const binding = coreBetaRuntimeExecutorBinding({ id, case_type: caseType }, scenario);
  assert.equal(binding.dispatchable, true, `${id} 必须在静态审计阶段可分发`);
  assert.equal(binding.mode, mode, `${id} runtime 分流模式漂移`);
}
assert.equal(CORE_BETA_SCENARIO_REGISTRY.get('MRSMOKE-WEB-002')?.conversation_required, false);
assert.equal(CORE_BETA_SCENARIO_REGISTRY.get('MRSMOKE-NAV-001')?.conversation_required, false);

{
  const taskId = 'task-connector-retry-1526';
  const runtimeEvidence = {
    diagnostics: {
      sessionId: taskId,
      e2eCurrentTurnAuthorityReadiness: { ready: true },
      e2eCurrentTurnAuthority: {
        providerReceiptHash: 'a'.repeat(64),
        connectorRouting: { effectiveConnectorIds: ['builtin:qbot_chart'] },
        connectorRuntimeMaterialization: { materializedConnectorIds: ['builtin:qbot_chart'] },
      },
    },
  };
  const screenshot = { path: '/tmp/connector-retry.png', bytes: 256, sha256: 'b'.repeat(64) };
  const pointData = [
    { label: '曝光', value: 12000 },
    { label: '点击', value: 860 },
    { label: '报名', value: 240 },
    { label: '成交', value: 28 },
  ];
  const buildTurn = ({ prompt, type, data, result, replyText }) => connectorRetryTurnReadback({
    caseId: 'MRSMOKE-FAIL-001',
    prompt,
    sendReceipts: [{
      prompt,
      attempts: [{ clicked: true, receipt: { ok: true, snapshot: { activeId: taskId } } }],
    }],
    session: {
      id: taskId,
      messages: [
        { role: 'user', parts: [{ t: 'text', text: prompt }] },
        { role: 'assistant', parts: [
          { t: 'tool', name: 'mcp__qbot_chart__render_chart', input: { type, data }, result },
          { t: 'text', text: replyText },
        ] },
      ],
    },
    runtimeEvidence,
    screenshot,
    replyText,
    replyComplete: true,
    expectedType: type,
    expectedPoints: data,
  });
  const first = buildTurn({
    prompt: 'retry-turn-1', type: 'bar', data: [],
    result: JSON.stringify({ isError: true, structuredContent: { ok: false, errorCode: 'invalid_chart_data', error: 'at least one data point' } }),
    replyText: '参数无效。',
  });
  const second = buildTurn({
    prompt: 'retry-turn-2', type: 'line', data: [],
    result: JSON.stringify({ isError: true, structuredContent: { ok: false, errorCode: 'invalid_chart_data', error: 'at least one data point' } }),
    replyText: '仍需有效数据。',
  });
  const third = buildTurn({
    prompt: 'retry-turn-3', type: 'bar', data: pointData,
    result: JSON.stringify({
      isError: false,
      structuredContent: { ok: true },
      _meta: { 'qbot/chart-result': { ok: true, kind: 'qbot-chart-result', mimeType: 'image/svg+xml', type: 'bar', data: pointData, svg: '<svg></svg>' } },
    }),
    replyText: '四点柱状图已生成。',
  });
  const recovery = connectorRetryRecoveryVerdict([first, second, third]);
  assert.equal(recovery.evidence_valid, true, '三轮真实工具证据必须完整绑定同一task');
  assert.equal(recovery.oracle_valid, true, '两次参数失败后第三次合法调用必须允许恢复成功');
  const fused = connectorRetryRecoveryVerdict([
    first,
    { ...second, reply: { ...second.reply, forbidden_marker_found: true } },
    third,
  ]);
  assert.equal(fused.evidence_valid, true, '产品熔断文案不得破坏证据完整性分类');
  assert.equal(fused.oracle_valid, false, 'connector_circuit_open必须成为产品Oracle失败');
}

{
  const taskId = 'task-skill-native-1526';
  const prompt = '运行技能作用域自检';
  const trace = skillNativeInvocationReadback({
    caseId: 'MRSMOKE-SKILL-001',
    prompt,
    expectedSkill: 'qa-scope-isolation',
    expectedMarker: 'SKILL_SCOPE_ACTIVE',
    sendReceipts: [{
      prompt,
      attempts: [{ clicked: true, receipt: { ok: true, snapshot: { activeId: taskId } } }],
    }],
    session: {
      id: taskId,
      messages: [
        { role: 'user', parts: [{ t: 'text', text: prompt }] },
        { role: 'assistant', parts: [
          { t: 'tool', name: 'Skill', input: { skill: 'skillhub__global__qa-scope-isolation' }, result: 'Loaded QA Scope Isolation.' },
          { t: 'text', text: 'SKILL_SCOPE_ACTIVE' },
        ] },
      ],
    },
    runtimeEvidence: {
      diagnostics: {
        sessionId: taskId,
        e2eCurrentTurnAuthorityReadiness: { ready: true },
        e2eCurrentTurnAuthority: { providerReceiptHash: 'c'.repeat(64), skillRouting: { mode: 'manual' } },
      },
    },
    screenshot: { path: '/tmp/skill-native.png', bytes: 256, sha256: 'd'.repeat(64) },
    replyText: 'SKILL_SCOPE_ACTIVE',
  });
  assert.equal(trace.evidence_valid, true, '原生Skill tool-use/result必须绑定确认发送与runtime authority');
  assert.equal(trace.oracle_valid, true, '原生Skill返回确定性标识且无服务端提前拒绝时应通过');
  const rejected = skillNativeInvocationReadback({
    ...trace,
    caseId: 'MRSMOKE-SKILL-001',
    prompt,
    expectedSkill: 'qa-scope-isolation',
    expectedMarker: 'SKILL_SCOPE_ACTIVE',
    sendReceipts: [{ prompt, attempts: [{ clicked: true, receipt: { ok: true, snapshot: { activeId: taskId } } }] }],
    session: {
      id: taskId,
      messages: [
        { role: 'user', parts: [{ t: 'text', text: prompt }] },
        { role: 'assistant', parts: [{ t: 'tool', name: 'Skill', input: { skill: 'qa-scope-isolation' }, result: 'skill_runtime_materialization_unavailable' }] },
      ],
    },
    runtimeEvidence: {
      diagnostics: {
        sessionId: taskId,
        e2eCurrentTurnAuthorityReadiness: { ready: true },
        e2eCurrentTurnAuthority: { providerReceiptHash: 'e'.repeat(64) },
      },
    },
    screenshot: { path: '/tmp/skill-native-rejected.png', bytes: 256, sha256: 'f'.repeat(64) },
    replyText: 'SKILL_SCOPE_ACTIVE',
  });
  assert.equal(rejected.evidence_valid, true);
  assert.equal(rejected.oracle_valid, false, '服务端materialization预检拒绝必须保留为产品Oracle失败');
}

{
  const cleanPhase = {
    phase: '停止后保留回复', captured: true, assistant_body_count: 1,
    assistant_body_overflow_x: 0, assistant_message_overflow_x: 0,
    message_list_overflow_x: 0, document_overflow_x: 0,
    screenshot: { path: '/tmp/overflow.png', bytes: 256, sha256: '1'.repeat(64) },
  };
  assert.equal(horizontalOverflowReadbackVerdict([cleanPhase]).oracle_valid, true);
  const overflow = horizontalOverflowReadbackVerdict([{ ...cleanPhase, assistant_body_overflow_x: 24 }]);
  assert.equal(overflow.evidence_valid, true, '横向溢出是产品Oracle失败，不是证据失败');
  assert.equal(overflow.oracle_valid, false, '助手正文scrollWidth超出clientWidth必须失败');
}

assert.equal(qworkDailyNewTaskAutoIsolationVerdict({
  expected_draft: '任务B草稿',
  draft_was_sent: false,
  task_a: {
    task_id: 'task-a',
    selected_skill_ids: ['skill-a'],
    selected_connector_ids: ['connector-a'],
  },
  task_b: {
    task_id: null,
    is_draft: true,
    message_count: 0,
    current_expert: null,
    skill_mode: 'auto',
    connector_mode: 'auto',
    selected_skill_ids: [],
    selected_connector_ids: [],
    attachment_count: 0,
    draft_text: '任务B草稿',
  },
  reopened_task_a: {
    task_id: 'task-a',
    selected_skill_ids: ['skill-a'],
    selected_connector_ids: ['connector-a'],
    draft_text: '',
  },
}), true, 'QWD-ENTRY-002 必须要求任务B为Auto空草稿且任务A能力identity保持');

const workspaceBindingReadback = {
  workspace_a: '/tmp/qwork-binding/A',
  workspace_b: '/tmp/qwork-binding/B',
  registration: { valid: true },
  selection_a: { ok: true, cwd: '/tmp/qwork-binding/A' },
  task_a: { task_id: 'task-a', cwd: '/tmp/qwork-binding/A', reply_text: 'QWORK_WORKSPACE_A_MARKER' },
  locked_task_a: {
    workspace_picker_visible: false,
    editable_workspace_select_count: 0,
    cwd: '/tmp/qwork-binding/A',
  },
  selection_b: { ok: true, cwd: '/tmp/qwork-binding/B' },
  task_b: { task_id: 'task-b', cwd: '/tmp/qwork-binding/B', reply_text: 'QWORK_WORKSPACE_B_MARKER' },
  reopen_a: { ok: true },
  reopened_task_a: { task_id: 'task-a', cwd: '/tmp/qwork-binding/A' },
  session_readback: {
    task_a: { id: 'task-a', cwd: '/tmp/qwork-binding/A' },
    task_b: { id: 'task-b', cwd: '/tmp/qwork-binding/B' },
  },
  cleanup: { valid: true },
};
assert.equal(
  qworkDailyWorkspaceTaskBindingVerdict(workspaceBindingReadback),
  true,
  'QWD-WS-001 必须同时证明 A/B 精确路径、不同 taskId、已建任务只读、重开和 session cwd 持久化',
);
assert.equal(
  qworkDailyWorkspaceTaskBindingVerdict({
    ...workspaceBindingReadback,
    locked_task_a: { ...workspaceBindingReadback.locked_task_a, workspace_picker_visible: true },
  }),
  false,
  '已建 A 任务仍暴露工作空间选择器时不得通过',
);
assert.equal(
  qworkDailyWorkspaceTaskBindingVerdict({
    ...workspaceBindingReadback,
    task_b: { ...workspaceBindingReadback.task_b, task_id: 'task-a' },
  }),
  false,
  '新建 B 任务没有形成独立 taskId 时不得通过',
);
assert.equal(qworkDailyNewTaskAutoIsolationVerdict({
  expected_draft: '任务B草稿',
  draft_was_sent: false,
  task_a: { task_id: 'task-a', selected_skill_ids: ['skill-a'], selected_connector_ids: ['connector-a'] },
  task_b: {
    task_id: null,
    is_draft: true,
    message_count: 0,
    current_expert: null,
    skill_mode: 'manual',
    connector_mode: 'auto',
    selected_skill_ids: [],
    selected_connector_ids: [],
    attachment_count: 0,
    draft_text: '任务B草稿',
  },
  reopened_task_a: { task_id: 'task-a', selected_skill_ids: ['skill-a'], selected_connector_ids: ['connector-a'], draft_text: '' },
}), false, 'manual-empty 不得被误判为新任务默认 Auto');
assert.equal(qworkDailyNewTaskAutoIsolationVerdict({
  expected_draft: '任务B草稿',
  draft_was_sent: false,
  task_a: { task_id: 'task-a', selected_skill_ids: ['skill-a'], selected_connector_ids: ['connector-a'] },
  task_b: {
    task_id: null,
    is_draft: true,
    message_count: 0,
    current_expert: null,
    skill_mode: 'auto',
    connector_mode: 'auto',
    selected_skill_ids: [],
    selected_connector_ids: [],
    attachment_count: 0,
    draft_text: '任务B草稿',
  },
  reopened_task_a: {
    task_id: 'task-a',
    selected_skill_ids: ['skill-a'],
    selected_connector_ids: ['connector-a'],
    draft_text: '任务B草稿',
  },
}), false, '任务B未发送草稿出现在重开的任务A时必须失败');

{
  assert.equal(qworkDailyExpertCatalogBridgeRoute({ get_experts_catalog: true }), 'getExpertsCatalog');
  assert.equal(
    qworkDailyExpertCatalogBridgeRoute({ expert_lifecycle_catalog: true }),
    'expertLifecycle.catalog',
    '新版 SIT preload 只暴露 expertLifecycle.catalog 时必须走公开生命周期目录接口',
  );
  assert.equal(qworkDailyExpertCatalogBridgeRoute({}), '', '没有公开目录接口时必须 fail-closed');

  const readable = {
    catalog: {
      recommended: [{ id: 'expert-a', label: '发布顾问', summary: '负责发布检查', author: '甲', version: '1' }],
      recent: [{ id: 'expert-a', label: '发布顾问', summary: '负责发布检查', author: '甲', version: '1' }],
      all: [
        { id: 'expert-a', label: '发布顾问', summary: '负责发布检查', author: '甲', version: '1' },
        { id: 'expert-b', label: '发布顾问', summary: '负责发布检查', author: '乙', version: '2' },
      ],
      mine: [],
    },
  };
  assert.equal(
    qworkDailyExpertCatalogVerdict(readable).oracle_valid,
    true,
    '同一专家出现在推荐、最近和市场是不同分区投影，不得误判为重复卡片',
  );
  const invalid = structuredClone(readable);
  invalid.catalog.all.push({
    id: 'expert-uuid',
    label: '123e4567-e89b-12d3-a456-426614174000',
    summary: '裸 UUID 卡片',
  });
  invalid.catalog.all.push({ id: 'expert-b', label: '发布顾问', summary: '负责发布检查', author: '乙', version: '2' });
  const catalogFailure = qworkDailyExpertCatalogVerdict(invalid);
  assert.equal(catalogFailure.oracle_valid, false);
  assert.equal(catalogFailure.invalid.length, 1, '标准 8-4-4-4-12 UUID 必须被识别');
  assert.equal(catalogFailure.duplicates.length, 1, '同一分区完全重复 identity 必须失败');

  const lifecycleCatalog = {
    schemaVersion: 'qwork.expert-catalog/v1',
    recommended: [{
      expertId: 'expert-v2',
      view: {
        id: 'expert-v2',
        activeReleaseId: 'release-v2',
        display: { label: '专家构建师', summary: '通过对话创建、修改并校验专家草稿。' },
        version: { id: 'version-v2' },
        release: { id: 'release-v2' },
      },
      draft: null,
    }],
    recent: [],
    all: [],
    mine: [],
    shared: [],
  };
  const normalizedLifecycleCatalog = normalizeQworkDailyExpertCatalog(lifecycleCatalog);
  assert.deepEqual(
    {
      id: normalizedLifecycleCatalog.recommended[0].id,
      label: normalizedLifecycleCatalog.recommended[0].label,
      summary: normalizedLifecycleCatalog.recommended[0].summary,
      versionId: normalizedLifecycleCatalog.recommended[0].versionId,
      releaseId: normalizedLifecycleCatalog.recommended[0].releaseId,
    },
    {
      id: 'expert-v2',
      label: '专家构建师',
      summary: '通过对话创建、修改并校验专家草稿。',
      versionId: 'version-v2',
      releaseId: 'release-v2',
    },
    'expertLifecycle.catalog 的 {expertId, view, draft} 投影必须归一为稳定专家身份',
  );
  assert.equal(
    qworkDailyExpertCatalogVerdict({ catalog: lifecycleCatalog }).oracle_valid,
    true,
    '新版生命周期目录不能因 preload 移除 getExpertsCatalog 而触发 automation_error',
  );
}

{
  const token = 'qwork_secret_123456789_DO_NOT_ECHO';
  const secretPath = '/Users/qwork-secret/private/token.txt';
  const pass = qworkDailyRedactionVerdict({
    visibleUiText: '模型连接失败，无法解析服务地址。请检查地址或网络后重试。',
    logText: '/Applications/360Teams.app/Contents/MacOS/360Teams launched',
    structuredText: JSON.stringify({ apiKeySet: true, apiKey: null, reason: 'DNS_PROBE_FINISHED_NXDOMAIN' }),
    exactSecrets: [token, secretPath],
  });
  assert.equal(pass.oracle_valid, true, JSON.stringify(pass));
  const leak = qworkDailyRedactionVerdict({
    visibleUiText: `模型连接失败，请重试。access_token=${token}`,
    logText: '',
    structuredText: '{}',
    exactSecrets: [token],
  });
  assert.equal(leak.oracle_valid, false);
  assert.ok(leak.exact_leaks.length > 0);
  assert.ok(qworkDailySecretFindings('QBOT_LINGXI_ACCESS_TOKEN 与 DEEPBANK_SERVER 是变量名').length === 0);
  assert.ok(qworkDailySecretFindings('access_token=[REDACTED]').length === 0);
  assert.ok(qworkDailySecretFindings(`access_token=${token}`).length > 0);
}

{
  assert.deepEqual(qworkDailyPersonalTaskContext(), { cwd: null }, '空间外任务必须显式清空 cwd，禁止继承工作空间');
  const productFailure = qworkDailyEvidenceEnvelope('QWD-SEC-005', { observed: 'secret leak' }, false, true, '2026-08-12T00:00:00.000Z');
  assert.equal(productFailure.valid, true, '产品 Oracle 失败时证据文件本身仍必须有效');
  assert.equal(productFailure.evidence_valid, true);
  assert.equal(productFailure.oracle_valid, false);
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'qbot-qwork-evidence-envelope-'));
  try {
    const file = path.join(temp, 'credential-redaction-scan.json');
    fs.writeFileSync(file, JSON.stringify(productFailure));
    assert.equal(validateEvidenceFile('credential_redaction_scan', file).valid, true);
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
}
assert.equal(
  [...CORE_BETA_SCENARIO_REGISTRY.values()].every((item) => item.driver && item.fixture_control),
  true,
  '每个Core Beta Case必须声明driver与fixture control',
);
for (const [id, fixture] of [
  ['BETA-FILE-007', 'limit_matrix'],
  ['BETA-FILE-008', 'picker_drag_clipboard'],
  ['BETA-FILE-009', 'duplicate_name_set'],
]) {
  const scenario = CORE_BETA_SCENARIO_REGISTRY.get(id);
  assert.equal(scenario.legacy_case_id, '', `${id} 不得复用语义不完整的旧附件执行器`);
  assert.equal(scenario.runtime_fixture, fixture, `${id} 必须绑定专用运行时 fixture`);
}
assert.equal(
  CORE_BETA_SCENARIO_REGISTRY.get('BETA-TASK-004').fixture_control,
  'hitl_answer_skip_timeout',
  '回答/跳过/超时三分支必须使用受控 HITL adapter',
);
assert.equal(
  CORE_BETA_SCENARIO_REGISTRY.get('BETA-SEC-005').fixture_control,
  'ssrf_advanced_matrix',
  '高级 SSRF 矩阵不得复用仅 localhost 探测的旧执行器',
);
assert.equal(
  CORE_BETA_SCENARIO_REGISTRY.get('BETA-DEPLOY-001').fixture_control,
  'protected_release_deployment',
  '生产灰度部署门禁必须绑定受保护环境逐 Case 控制器',
);
assert.equal(
  CORE_BETA_SCENARIO_REGISTRY.get('BETA-ROUTE-005').fixture_control,
  'auto_route_cas_matrix',
  'Auto CAS 冲突必须绑定受控并发矩阵',
);
assert.deepEqual(
  {
    driver: CORE_BETA_SCENARIO_REGISTRY.get('BETA-TASK-008').driver,
    fixture: CORE_BETA_SCENARIO_REGISTRY.get('BETA-TASK-008').fixture_control,
  },
  { driver: 'composer_history_navigation', fixture: 'public_product_state' },
  'Composer历史输入必须由公开产品状态原生执行器覆盖',
);
assert.deepEqual(
  {
    driver: CORE_BETA_SCENARIO_REGISTRY.get('BETA-ROUTE-001').driver,
    fixture: CORE_BETA_SCENARIO_REGISTRY.get('BETA-ROUTE-001').fixture_control,
  },
  { driver: 'model_menu_sdk_filter', fixture: 'public_product_state' },
  '模型菜单SDK过滤必须由公开产品状态原生执行器覆盖',
);
assert.equal(
  CORE_BETA_SCENARIO_REGISTRY.get('BETA-EXPERT-007').fixture_control,
  'public_product_state',
  '单账号灰度门禁的正常发布闭环不得依赖故障注入控制器',
);
const verifiedLegacyDrivers = [...CORE_BETA_SCENARIO_REGISTRY.values()]
  .filter((item) => item.id.startsWith('BETA-') && item.legacy_case_id)
  .map((item) => `${item.id}:${item.legacy_case_id}`)
  .sort();
assert.deepEqual(verifiedLegacyDrivers, [
  'BETA-FILE-010:SIT-FILE-NEW-001',
  'BETA-HOST-003:SIT-TEAMS-NEW-003',
  'BETA-PERF-003:SIT-ISSUE-793',
  'BETA-SEC-002:SIT-WORKSPACE-001',
  'BETA-TASK-003:SIT-TASK-RECOVER-001',
], '只有完成语义复核并覆盖完整业务 Oracle 的旧执行器可以保留映射');
assert.equal(
  [...FULL_FUNCTION_REGRESSION_LEGACY_CASE_IDS].every((id) => {
    const scenario = CORE_BETA_SCENARIO_REGISTRY.get(id);
    return scenario?.fixture_control === 'public_product_state'
      && scenario?.legacy_case_id === id
      && scenario?.executor_route;
  }),
  true,
  '全量正常功能增量必须逐条绑定同 ID 的已复核 SIT 执行器且不依赖严格控制器',
);
for (const id of [
  'SIT-HOME-025',
  'SIT-TASK-RECOVER-001',
  'SIT-ISSUE-800',
  'SIT-CONN-008',
  'SIT-TEAMS-DOC-001',
  'SIT-RUNTIME-RECOVER-001',
  'SIT-FILE-NEW-001',
]) {
  assert.equal(
    FULL_FUNCTION_REGRESSION_LEGACY_CASE_IDS.has(id),
    false,
    `全量正常功能增量不得重新纳入低频或故障注入Case：${id}`,
  );
}
for (const id of ['SIT-SKILL-002', 'SIT-EXPERT-002', 'SIT-HOME-027', 'SIT-HOME-047', 'SIT-HOME-052']) {
  assert.equal(
    FULL_FUNCTION_REGRESSION_LEGACY_CASE_IDS.has(id),
    true,
    `全量正常功能增量必须保留高频功能Case：${id}`,
  );
}
assert.deepEqual(
  [...PRODUCTION_GRAY_EXCLUDED_RARE_CASE_IDS],
  ['BETA-REC-001', 'BETA-REC-002', 'BETA-REC-004', 'BETA-TASK-003', 'BETA-EXPERT-016'],
  '正式70/160必须统一排除已确认的低频恢复与网络故障注入Case',
);
assert.deepEqual(
  [...PRODUCTION_GRAY_PROMOTED_LEGACY_CASE_IDS],
  ['SIT-SKILL-007', 'SIT-HOME-002', 'SIT-HOME-012', 'SIT-HOME-013', 'SIT-CONN-016'],
  '门禁必须使用五条高频正常功能Case补齐固定70条规模',
);
for (const id of ['SIT-HOME-028', 'SIT-HOME-046', 'SIT-HOME-051', 'SIT-CONN-005', 'SIT-HOME-048']) {
  assert.equal(
    FULL_FUNCTION_REGRESSION_LEGACY_CASE_IDS.has(id),
    true,
    `正常功能池必须包含门禁提升后的全量替补：${id}`,
  );
}

const sample = {
  id: 'BETA-CHAT-001',
  case_type: 'conversation',
  contract_version: 'qbot-core-beta/v2',
  automation_protocol: 'core-beta-action-plan/v2',
  evidence_schema_version: 'qbot-core-evidence/v2',
  pipeline_policy: 'dispatch_collect',
  batch_size: '20',
  initialization_policy: 'run_full_reset_then_case_clean',
  cleanup_policy: 'clear task capability selection',
  risk_domain: 'functional,security_privacy',
  oracle_type: 'task_bound_state+complete_reply+business_oracle',
  deterministic: '是',
  repeat_policy: '连续执行2次',
  required_fixture: 'runtime:ready,account:authenticated',
  hard_gate: '是',
  version_scope: 'release/0.1',
  production_signal: 'reply completion',
  action_plan: [
    {
      number: 1,
      action_id: 'beta-chat-001-prepare',
      operation: 'prepare',
      target: 'BETA-CHAT-001:prepare',
      declared_step: 'prepare fixture',
      command: 'prepare_conversation',
      executor: 'core-beta/scenario/beta-chat-001/v1',
      expected_state: 'ready',
      evidence_roles: ['before_screenshot', 'action_receipt', 'after_screenshot'],
      assertions: [{ path: 'state.page.body_text_length', operator: 'gte', expected: 1 }],
    },
    {
      number: 2,
      action_id: 'beta-chat-001-execute',
      operation: 'execute',
      target: 'BETA-CHAT-001:execute',
      declared_step: 'send and collect',
      command: 'execute_conversation',
      executor: 'core-beta/scenario/beta-chat-001/v1',
      expected_state: 'reply complete',
      evidence_roles: ['before_screenshot', 'action_receipt', 'after_screenshot'],
      assertions: [{ path: 'receipt.assertion_count', operator: 'gte', expected: 1 }],
    },
    {
      number: 3,
      action_id: 'beta-chat-001-verify',
      operation: 'verify',
      target: 'BETA-CHAT-001:verify',
      declared_step: 'verify',
      command: 'verify_conversation',
      executor: 'core-beta/scenario/beta-chat-001/v1',
      expected_state: 'all assertions pass',
      evidence_roles: ['before_screenshot', 'action_receipt', 'after_screenshot'],
      assertions: [{ path: 'receipt.assertion_failures', operator: 'equals', expected: 0 }],
    },
  ],
  conversation_turns: [{ turn: 1, prompt: 'hello', oracle: 'complete reply' }],
  precise_assertions: {
    pass_rule: 'all pass',
    fail_rule: 'fail closed',
    block_rule: 'real fixture only',
    hard_oracles: ['reply complete'],
    machine_assertions: [{ path: 'evidence.complete', operator: 'equals', expected: true }],
  },
  evidence_roles: [
    'before_screenshot',
    'action_receipt',
    'after_screenshot',
    'public_state_readback',
    'cleanup_readback',
    'task_id',
    'prompt',
    'send_receipt',
    'transcript',
    'reply_delta',
    'reply_completion',
  ],
};

const valid = validateCoreBetaCase(sample);
assert.equal(valid.ok, true, valid.errors.join('\n'));
assert.equal(valid.executor_route, coreBetaExecutorRoute(sample));
assert.equal(validateCoreBetaCasePlan([sample]).executable_count, 1);
const contractSha = coreBetaCaseContractSha256(sample);
assert.match(contractSha, /^[a-f0-9]{64}$/);
const changedContract = structuredClone(sample);
changedContract.conversation_turns[0].oracle = 'different oracle';
assert.notEqual(
  coreBetaCaseContractSha256(changedContract),
  contractSha,
  'Case 动作、Oracle 或证据契约变化必须使逐 Case contract SHA 漂移',
);

const planCase = (id, caseType) => {
  const item = structuredClone(sample);
  item.id = id;
  item.case_type = caseType;
  item.pipeline_policy = 'serial';
  item.batch_size = 1;
  item.action_plan = item.action_plan.map((action) => ({
    ...action,
    action_id: `${id.toLowerCase()}-${action.operation}`,
    target: `${id}:${action.operation}`,
    executor: CORE_BETA_SCENARIO_REGISTRY.get(id).executor_route,
  }));
  return item;
};

{
  const webQuotaCase = planCase('MRSMOKE-WEB-001', 'conversation');
  webQuotaCase.evidence_roles.push('web_search_quota_trace');
  const webThemes = ['产品', 'API', '官方文档', '安全与可靠性'];
  webQuotaCase.conversation_turns = Array.from({ length: 4 }, (_, index) => ({
    turn: index + 1,
    prompt: `${index === 3 ? '第四轮：' : ''}请继续使用内置 Web 搜索查找 OpenAI 官方最近至少两条${webThemes[index]}更新，每条按“标题、日期、官方原始 HTTPS 链接、摘要”结构化给出${index === 0 ? '；末尾附 https://www.iana.org/domains/reserved' : ''}。`,
    oracle: `第${index + 1}轮真实 provider receipt 与同一 task 绑定，且回复至少两组独立 OpenAI 官方结果，每组绑定标题、日期、官方 HTTPS 链接和摘要。`,
  }));
  assert.equal(validateCoreBetaCase(webQuotaCase).ok, true, validateCoreBetaCase(webQuotaCase).errors.join('\n'));

  const missingRound = structuredClone(webQuotaCase);
  missingRound.conversation_turns.pop();
  assert.match(validateCoreBetaCase(missingRound).errors.join('\n'), /精确声明四轮/);

  const duplicatePrompt = structuredClone(webQuotaCase);
  duplicatePrompt.conversation_turns[3].prompt = duplicatePrompt.conversation_turns[2].prompt;
  assert.match(validateCoreBetaCase(duplicatePrompt).errors.join('\n'), /prompt 必须全部唯一/);

  const weakRound = structuredClone(webQuotaCase);
  weakRound.conversation_turns[1].prompt = '继续搜索一条更新。';
  assert.match(validateCoreBetaCase(weakRound).errors.join('\n'), /每轮 prompt 都必须要求真实内置 Web 搜索/);

  const missingTitle = structuredClone(webQuotaCase);
  missingTitle.conversation_turns[1].prompt = missingTitle.conversation_turns[1].prompt.replace('标题、', '');
  assert.match(validateCoreBetaCase(missingTitle).errors.join('\n'), /逐条绑定标题/);

  const missingSummary = structuredClone(webQuotaCase);
  missingSummary.conversation_turns[2].prompt = missingSummary.conversation_turns[2].prompt.replace('、摘要', '');
  assert.match(validateCoreBetaCase(missingSummary).errors.join('\n'), /逐条绑定标题/);

  const weakOracle = structuredClone(webQuotaCase);
  weakOracle.conversation_turns[1].oracle = '第2轮真实 provider receipt 与同一 task 绑定。';
  assert.match(validateCoreBetaCase(weakOracle).errors.join('\n'), /每轮 oracle 都必须要求至少两组独立/);

  const oracleMissingSummary = structuredClone(webQuotaCase);
  oracleMissingSummary.conversation_turns[2].oracle = oracleMissingSummary.conversation_turns[2].oracle.replace('和摘要', '');
  assert.match(validateCoreBetaCase(oracleMissingSummary).errors.join('\n'), /每轮 oracle 都必须要求至少两组独立/);

  const missingEvidence = structuredClone(webQuotaCase);
  missingEvidence.evidence_roles = missingEvidence.evidence_roles.filter((role) => role !== 'web_search_quota_trace');
  assert.match(validateCoreBetaCase(missingEvidence).errors.join('\n'), /evidence_roles 缺少 web_search_quota_trace/);
}
{
  const regenerateCase = planCase('BETA-TASK-002', 'task_lifecycle');
  assert.equal(
    CORE_BETA_SCENARIO_REGISTRY.get('BETA-TASK-002')?.fixture_control,
    'public_product_state',
    'BETA-TASK-002 必须由真实 public_product_state 原生执行器直接运行',
  );
  assert.equal(
    CORE_BETA_SCENARIO_REGISTRY.get('BETA-TASK-002')?.driver,
    'task_regenerate_transition',
  );
  const regenerateBinding = coreBetaRuntimeExecutorBinding(
    regenerateCase,
    CORE_BETA_SCENARIO_REGISTRY.get('BETA-TASK-002'),
  );
  assert.equal(regenerateBinding.dispatchable, true);
  assert.equal(regenerateBinding.mode, 'native');
  regenerateCase.evidence_roles.push('task_regenerate_transition', 'regenerate_placeholder_readback');
  assert.equal(
    validateCoreBetaCase(regenerateCase).ok,
    true,
    validateCoreBetaCase(regenerateCase).errors.join('\n'),
  );

  for (const role of ['task_regenerate_transition', 'regenerate_placeholder_readback']) {
    const missingRole = structuredClone(regenerateCase);
    missingRole.evidence_roles = missingRole.evidence_roles.filter((item) => item !== role);
    assert.match(
      validateCoreBetaCase(missingRole).errors.join('\n'),
      new RegExp(`evidence_roles 缺少 ${role}`),
      `${role} 必须为 BETA-TASK-002 强制证据角色`,
    );
  }
}
{
  assert.equal(
    coreBetaExpert012ContractVariant('BETA-EXPERT-012'),
    CORE_BETA_EXPERT_012_CONTRACT_VARIANTS.UNKNOWN,
    '仅有 Case ID 不能选择会执行产品动作的 Expert 合同变体',
  );
  assert.equal(coreBetaScenarioSpec('BETA-EXPERT-012'), null);

  const immutableVersionCase = planCase('BETA-EXPERT-012', 'expert_lifecycle');
  immutableVersionCase.scenario = '从已发布专家创建新版本草稿并发布，旧版本字节与依赖不变，既有会话不会被新版本追溯改写';
  immutableVersionCase.expected_result = 'v1完全不变；v2为新release/version；旧会话仍用v1，新召唤可选择v2。';
  immutableVersionCase.success_criteria = '两个releaseId/version/SHA、依赖图与旧/新session pin全部可读且关系正确。';
  immutableVersionCase.oracle_type = 'public_state_machine+immutable_readback';
  immutableVersionCase.evidence_roles.push('capability_selection', 'capability_execution_event');
  assert.equal(
    coreBetaExpert012ContractVariant(immutableVersionCase),
    CORE_BETA_EXPERT_012_CONTRACT_VARIANTS.IMMUTABLE_VERSION_UPGRADE,
  );
  assert.equal(coreBetaScenarioSpec(immutableVersionCase)?.driver, 'expert_immutable_version_upgrade');
  assert.equal(
    validateCoreBetaCase(immutableVersionCase).ok,
    true,
    validateCoreBetaCase(immutableVersionCase).errors.join('\n'),
  );
  const immutableBinding = coreBetaRuntimeExecutorBinding(
    immutableVersionCase,
    CORE_BETA_SCENARIO_REGISTRY.get('BETA-EXPERT-012'),
  );
  assert.equal(immutableBinding.dispatchable, true);
  assert.equal(
    immutableBinding.driver,
    CORE_BETA_EXPERT_012_CONTRACT_VARIANTS.IMMUTABLE_VERSION_UPGRADE,
    'runtime binding 不得用注册表默认新 driver 覆盖旧冻结 Case 的权威合同变体',
  );

  const maintenanceTaskCase = structuredClone(immutableVersionCase);
  maintenanceTaskCase.scenario = '从本轮已发布 Expert 卡片进入真实“通过对话修改”维护任务并完成发布';
  maintenanceTaskCase.expected_result = '原专家草稿更新后生成一个新版本和发布，原维护任务可重开且新任务不继承。';
  maintenanceTaskCase.success_criteria = '入口、工具、草稿、发布、重开与新任务隔离证据全部有效。';
  maintenanceTaskCase.oracle_type = 'expert_published_maintenance_task_roundtrip+exact_tool_sequence';
  maintenanceTaskCase.evidence_roles.push('expert_maintenance_task_trace');
  assert.equal(
    coreBetaExpert012ContractVariant(maintenanceTaskCase),
    CORE_BETA_EXPERT_012_CONTRACT_VARIANTS.PUBLISHED_MAINTENANCE_TASK,
  );
  assert.equal(coreBetaScenarioSpec(maintenanceTaskCase)?.driver, 'expert_published_maintenance_task_roundtrip');
  assert.equal(
    validateCoreBetaCase(maintenanceTaskCase).ok,
    true,
    validateCoreBetaCase(maintenanceTaskCase).errors.join('\n'),
  );

  const maintenanceMissingTrace = structuredClone(maintenanceTaskCase);
  maintenanceMissingTrace.evidence_roles = maintenanceMissingTrace.evidence_roles
    .filter((role) => role !== 'expert_maintenance_task_trace');
  assert.match(
    validateCoreBetaCase(maintenanceMissingTrace).errors.join('\n'),
    /evidence_roles 缺少 expert_maintenance_task_trace/,
    '新维护任务合同缺少专用 trace 时必须 fail-closed，不能回退旧合同',
  );

  const mixedContract = structuredClone(immutableVersionCase);
  mixedContract.evidence_roles.push('expert_maintenance_task_trace');
  const mixedErrors = validateCoreBetaCase(mixedContract).errors.join('\n');
  assert.match(mixedErrors, /oracle_type 缺少 expert_published_maintenance_task_roundtrip/);
  assert.match(mixedErrors, /scenario\/steps 缺少“通过对话修改”/);

  const ambiguousContract = structuredClone(maintenanceTaskCase);
  ambiguousContract.oracle_type += '+immutable_readback';
  assert.equal(
    coreBetaExpert012ContractVariant(ambiguousContract),
    CORE_BETA_EXPERT_012_CONTRACT_VARIANTS.UNKNOWN,
  );
  assert.match(
    validateCoreBetaCase(ambiguousContract).errors.join('\n'),
    /不得混入旧 immutable_readback Oracle/,
    '新旧 Oracle 混合时必须在执行前 fail-closed',
  );
  const ambiguousBinding = coreBetaRuntimeExecutorBinding(
    ambiguousContract,
    CORE_BETA_SCENARIO_REGISTRY.get('BETA-EXPERT-012'),
  );
  assert.equal(ambiguousBinding.dispatchable, false);
  assert.equal(ambiguousBinding.mode, 'unsupported');

  const mixedSemantics = structuredClone(maintenanceTaskCase);
  mixedSemantics.expected_result = 'v1完全不变；旧会话仍用v1；新召唤可选择v2。';
  assert.equal(
    coreBetaExpert012ContractVariant(mixedSemantics),
    CORE_BETA_EXPERT_012_CONTRACT_VARIANTS.UNKNOWN,
  );
  assert.match(
    validateCoreBetaCase(mixedSemantics).errors.join('\n'),
    /不得混入旧版本不可变或旧会话 pin v1 语义/,
  );

  const forgedImmutableToken = structuredClone(immutableVersionCase);
  forgedImmutableToken.oracle_type = 'public_state_machine+not_immutable_readback';
  assert.equal(
    coreBetaExpert012ContractVariant(forgedImmutableToken),
    CORE_BETA_EXPERT_012_CONTRACT_VARIANTS.UNKNOWN,
    '旧合同 Oracle 必须按完整 token 匹配，不能接受伪前缀',
  );
  assert.equal(validateCoreBetaCase(forgedImmutableToken).ok, false);

  const contradictoryLegacySession = structuredClone(immutableVersionCase);
  contradictoryLegacySession.expected_result = 'v1完全不变；v2为新release/version；旧会话迁移到v2，新召唤可选择v2。';
  assert.equal(
    coreBetaExpert012ContractVariant(contradictoryLegacySession),
    CORE_BETA_EXPERT_012_CONTRACT_VARIANTS.UNKNOWN,
    '旧会话迁移到 v2 的反向语义不得被误判为旧会话继续 pin v1',
  );
  assert.equal(validateCoreBetaCase(contradictoryLegacySession).ok, false);

  const forgedMaintenanceToken = structuredClone(maintenanceTaskCase);
  forgedMaintenanceToken.oracle_type = 'not_expert_published_maintenance_task_roundtrip+exact_tool_sequence';
  assert.equal(
    coreBetaExpert012ContractVariant(forgedMaintenanceToken),
    CORE_BETA_EXPERT_012_CONTRACT_VARIANTS.UNKNOWN,
    '新合同 Oracle 必须按完整 token 匹配，不能接受伪前缀',
  );
  assert.match(
    validateCoreBetaCase(forgedMaintenanceToken).errors.join('\n'),
    /oracle_type 缺少 expert_published_maintenance_task_roundtrip/,
  );

  const maintenanceEntryInSteps = structuredClone(maintenanceTaskCase);
  maintenanceEntryInSteps.scenario = '已发布 Expert 维护任务闭环';
  maintenanceEntryInSteps.steps = '从专家卡片打开“通过对话修改”并完成维护。';
  assert.equal(
    coreBetaExpert012ContractVariant(maintenanceEntryInSteps),
    CORE_BETA_EXPERT_012_CONTRACT_VARIANTS.PUBLISHED_MAINTENANCE_TASK,
    '入口声明允许位于冻结 scenario 或 steps，但不能两者均缺失',
  );
}
{
  const catalogCase = planCase('QWD-EXPERT-002', 'expert_lifecycle');
  catalogCase.conversation_turns = [];
  catalogCase.evidence_roles = [
    'before_screenshot',
    'action_receipt',
    'after_screenshot',
    'public_state_readback',
    'cleanup_readback',
    'capability_inventory',
    'expert_identity_snapshot',
  ];
  assert.equal(
    validateCoreBetaCase(catalogCase).ok,
    true,
    '只读专家目录审计不得被强制要求 capability_selection/capability_execution_event',
  );

  const redactionCase = planCase('QWD-SEC-005', 'security_privacy');
  redactionCase.conversation_turns = [];
  redactionCase.evidence_roles = [
    'before_screenshot',
    'action_receipt',
    'after_screenshot',
    'public_state_readback',
    'cleanup_readback',
    'credential_redaction_scan',
    'security_boundary_trace',
    'negative_ui_trace',
    'log_excerpt',
  ];
  assert.equal(
    validateCoreBetaCase(redactionCase).ok,
    true,
    '凭据设置与失败探针不得被强制要求虚假的会话轮次证据',
  );
}
{
  const attachmentCase = planCase('BETA-FILE-002', 'attachment');
  attachmentCase.evidence_roles.push(
    'attachment_name_size_sha256',
    'composer_attachment_state',
    'attachment_readback',
  );
  const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'qbot-core-attachment-fixtures-'));
  const missing = validateCoreBetaCase(attachmentCase, { fixtureRoot });
  assert.equal(missing.ok, false, '精确两图 fixture 缺失时 pretest 协议检查必须失败');
  assert.ok(
    missing.errors.some((item) => item.includes('qbot-image-flow.png'))
      && missing.errors.some((item) => item.includes('qbot-image-risk.png')),
    missing.errors.join('\n'),
  );
  fs.writeFileSync(path.join(fixtureRoot, 'qbot-image-flow.png'), Buffer.alloc(64, 1));
  fs.writeFileSync(path.join(fixtureRoot, 'qbot-image-risk.png'), Buffer.alloc(64, 2));
  const ready = validateCoreBetaCase(attachmentCase, { fixtureRoot });
  assert.equal(ready.ok, true, ready.errors.join('\n'));
  assert.ok(ready.fixture_spec.includes('file:qbot-image-flow.png'));
  assert.ok(ready.fixture_spec.includes('file:qbot-image-risk.png'));
  fs.rmSync(fixtureRoot, { recursive: true, force: true });
}
const legacyInitializedSkillReinstallCase = planCase('BETA-INIT-003', 'run_initialization');
assert.equal(
  validateCoreBetaCase(legacyInitializedSkillReinstallCase).ok,
  true,
  '历史冻结 Casebook 未声明专项角色时仍须可加载；runner 会在执行态强制追加并复核新证据',
);
const r15InitializedSkillReinstallCase = structuredClone(legacyInitializedSkillReinstallCase);
r15InitializedSkillReinstallCase.evidence_roles.push(
  'product_action_trace',
  'skill_reinstall_readiness_verdict',
  'initialization_continuation_surface',
);
r15InitializedSkillReinstallCase.oracle_type += '+skill_reinstall_readiness+immutable_readback';
assert.equal(
  validateCoreBetaCase(r15InitializedSkillReinstallCase).ok,
  true,
  'r15 已有的专项角色与 readiness Oracle 不能单独触发 r16 合同',
);
for (const [marker, declare] of [
  ['trace schema', (candidate) => { candidate.steps += ' qbot-core-beta-skill-reinstall-product-action-trace/v1'; }],
  ['before ledger', (candidate) => { candidate.steps += ' catalog_observations_before_action'; }],
  ['after ledger', (candidate) => { candidate.steps += ' catalog_observations_after_action'; }],
  ['send count before', (candidate) => { candidate.steps += ' send_count_before'; }],
  ['send count after', (candidate) => { candidate.steps += ' send_count_after'; }],
  ['send count unchanged', (candidate) => { candidate.steps += ' send_count_unchanged'; }],
]) {
  const partialR16Contract = structuredClone(legacyInitializedSkillReinstallCase);
  declare(partialR16Contract);
  const validation = validateCoreBetaCase(partialR16Contract);
  assert.equal(validation.ok, false, `BETA-INIT-003 单独声明 r16 新标记 ${marker} 时不得回退 r15`);
  assert.ok(
    validation.errors.some((item) => item.includes('evidence_roles 缺少')),
    `${marker}: ${validation.errors.join('\n')}`,
  );
}
const initializedSkillReinstallCase = structuredClone(legacyInitializedSkillReinstallCase);
initializedSkillReinstallCase.evidence_roles.push(
  'product_action_trace',
  'skill_reinstall_readiness_verdict',
  'initialization_continuation_surface',
);
initializedSkillReinstallCase.oracle_type = 'public_state_machine+skill_reinstall_readiness+immutable_readback';
initializedSkillReinstallCase.scenario = '真实点击一键重装 Skill 并完成破坏性确认；读取前后完整 catalog，以动作前、动作后两个独立 catalog ledger 和前后 installed identity 集合全等证明终态';
initializedSkillReinstallCase.steps = '动作前允许在有界窗口等待 syncing 收敛，单次 syncing 不能立即定性为证据失败；动作前、动作后两个独立 catalog ledger 各自至少三次连续同签名 syncStatus=idle，read_error_count=0、retry_error_count=0，且满足 started_at <= observations[*].captured_at <= ended_at；前后 installed identity 集合必须非空、唯一且全等；每个已安装 Skill ready=true，排除 unready/python_runtime_failed。生成 qbot-core-beta-skill-reinstall-product-action-trace/v1，绑定 case_id=BETA-INIT-003、method=skillsReinstall、testid=assistant-skills-reinstall、click_count=1、破坏性确认、catalog_observations_before_action、catalog_observations_after_action、terminal_outcome、continuation_surface，并证明 before ledger ended_at <= action dispatched_at <= after ledger started_at <= trace captured_at。成功或失败后点击【新建任务】恢复 continuation surface，并写入 initialization-continuation-surface.json 恢复文件；恢复 surface 必须为非空 draftInstanceId、taskId=null、messageCount=0、running=false 且 Skill/Connector/Expert 全空；send_count_before、send_count_after 均为可观测非负安全整数且严格全等，send_count_unchanged=true，前后严格不变；前后 PNG 均位于 Case 内普通文件，其路径、bytes、SHA-256 可重放；重放 maintenance/terminal/catalog/截图 bytes/SHA/schema/Case/method/testid。';
initializedSkillReinstallCase.expected_result = '动作前、动作后两个独立 catalog ledger 均稳定且前后 installed identity 集合必须非空、唯一且全等，每个已安装 Skill ready=true 且无失败态；恢复后保持非空 draftInstanceId、taskId=null、messageCount=0、running=false 和 Skill/Connector/Expert 全空，send count 前后严格不变。';
initializedSkillReinstallCase.success_criteria = '真实点击一键重装 Skill并完成破坏性确认；qbot-core-beta-skill-reinstall-product-action-trace/v1 的 case_id=BETA-INIT-003、method=skillsReinstall、testid=assistant-skills-reinstall、click_count=1，按 catalog_observations_before_action、catalog_observations_after_action、terminal_outcome、continuation_surface 绑定引用；动作前、动作后两个独立 catalog ledger 各自至少三次连续同签名 idle，read_error_count=0、retry_error_count=0，满足 started_at <= observations[*].captured_at <= ended_at；before ledger ended_at <= action dispatched_at <= after ledger started_at <= trace captured_at；前后 installed identity 集合必须非空、唯一且全等；每个已安装 Skill ready=true 且不存在 unready/python_runtime_failed；maintenance/terminal/catalog/截图 bytes/SHA/schema/Case/method/testid 重放一致；成功或失败后点击【新建任务】恢复 continuation surface；恢复 surface 为非空 draftInstanceId、taskId=null、messageCount=0、running=false、Skill/Connector/Expert 全空，send_count_before/send_count_after 为非负安全整数且严格全等，send_count_unchanged=true，前后严格不变；前后 PNG 是 Case 内普通文件且路径、bytes、SHA-256 可重放。';
initializedSkillReinstallCase.precise_assertions = {
  ...initializedSkillReinstallCase.precise_assertions,
  hard_oracles: [
    '真实点击一键重装 Skill 且破坏性确认严格绑定。',
    'qbot-core-beta-skill-reinstall-product-action-trace/v1 精确绑定 case_id=BETA-INIT-003、method=skillsReinstall、testid=assistant-skills-reinstall、click_count=1、破坏性确认、catalog_observations_before_action、catalog_observations_after_action、terminal_outcome、continuation_surface。',
    '动作前、动作后两个独立 catalog ledger 各自至少三次连续同签名 syncStatus=idle，read_error_count=0、retry_error_count=0。',
    'started_at <= observations[*].captured_at <= ended_at；before ledger ended_at <= action dispatched_at <= after ledger started_at <= trace captured_at。',
    '动作前允许在有界窗口等待 syncing 收敛，单次 syncing 不能立即定性为证据失败。',
    '前后 installed identity 集合必须非空、唯一且全等。',
    '每个已安装 Skill ready=true，且不存在 unready/python_runtime_failed。',
    '原始 maintenance/terminal/catalog/截图 bytes/SHA/schema/Case/method/testid 均可重放。',
    '专项 Oracle 成功或失败后点击【新建任务】恢复 continuation surface，并生成 initialization-continuation-surface.json 恢复文件。',
    '恢复 surface 必须为非空 draftInstanceId、taskId=null、messageCount=0、running=false 且 Skill/Connector/Expert 全空；send_count_before、send_count_after 均为可观测非负安全整数并严格全等，send_count_unchanged=true，前后严格不变。',
    '恢复前后 PNG 均为 Case 内普通文件，其路径、bytes、SHA-256 可重放。',
  ],
};

for (const role of [
  'product_action_trace',
  'skill_reinstall_readiness_verdict',
  'initialization_continuation_surface',
]) {
  const missingRole = structuredClone(initializedSkillReinstallCase);
  missingRole.evidence_roles = missingRole.evidence_roles.filter((item) => item !== role);
  assert.match(
    validateCoreBetaCase(missingRole).errors.join('\n'),
    new RegExp(`evidence_roles 缺少 ${role}`),
    `BETA-INIT-003 缺少 ${role} 时必须 fail-closed`,
  );
}

for (const [signal, mutate, expectedError] of [
  ['trace schema', (text) => text.replace(/qbot-core-beta-skill-reinstall-product-action-trace\/v1/gu, 'generic-action-trace/v1'), '正式合同缺少专用产品动作 trace schema'],
  ['trace Case', (text) => text.replace(/case_id\s*=\s*BETA-INIT-003/gu, 'case_id=OTHER'), '正式合同缺少产品动作 trace Case 绑定'],
  ['trace method', (text) => text.replace(/method\s*=\s*skillsReinstall/gu, 'method=unknown'), '正式合同缺少产品动作 trace method 绑定'],
  ['trace testid', (text) => text.replace(/testid\s*=\s*assistant-skills-reinstall/gu, 'testid=unknown'), '正式合同缺少产品动作 trace testid 绑定'],
  ['before ledger ref', (text) => text.replace(/catalog_observations_before_action/gu, 'catalog_before'), '正式合同缺少产品动作 trace 完整引用绑定'],
  ['after ledger ref', (text) => text.replace(/catalog_observations_after_action/gu, 'catalog_after'), '正式合同缺少产品动作 trace 完整引用绑定'],
  ['before/after ledgers', (text) => text.replace(/动作前、动作后两个独立\s*catalog\s*ledger/gu, '单一 catalog ledger'), '正式合同缺少动作前后独立 catalog ledger'],
  ['ledger observation time', (text) => text.replace(/started_at\s*<=\s*observations\[\*\]\.captured_at\s*<=\s*ended_at/gu, 'ledger time unchecked'), '正式合同缺少ledger 样本时间窗口'],
  ['cross evidence time', (text) => text.replace(/before\s*ledger\s*ended_at\s*<=\s*action\s*dispatched_at\s*<=\s*after\s*ledger\s*started_at\s*<=\s*trace\s*captured_at/gu, 'temporal chain unchecked'), '正式合同缺少产品动作 trace 跨阶段时序'],
  ['stable samples', (text) => text.replace(/各自至少三次连续同签名\s*(?:syncStatus=)?idle/gu, '一次 idle'), '正式合同缺少动作前后各三次同签名 idle'],
  ['read errors', (text) => text.replace(/read_error_count\s*=\s*0/gu, 'read_error_count=unknown'), '正式合同缺少动作前后零读取与重试错误'],
  ['retry errors', (text) => text.replace(/retry_error_count\s*=\s*0/gu, 'retry_error_count=unknown'), '正式合同缺少动作前后零读取与重试错误'],
  ['send before', (text) => text.replace(/send_count_before/gu, 'send_before'), '正式合同缺少sendCount 前后可观测安全整数'],
  ['send after', (text) => text.replace(/send_count_after/gu, 'send_after'), '正式合同缺少sendCount 前后可观测安全整数'],
  ['send unchanged', (text) => text.replace(/send_count_unchanged\s*=\s*true/gu, 'send_count_unchanged=unknown'), '正式合同缺少sendCount 前后严格不变'],
]) {
  const invalidContract = structuredClone(initializedSkillReinstallCase);
  for (const field of ['scenario', 'steps', 'expected_result', 'success_criteria']) {
    invalidContract[field] = mutate(String(invalidContract[field] || ''));
  }
  invalidContract.precise_assertions.hard_oracles = invalidContract.precise_assertions.hard_oracles
    .map((oracle) => mutate(String(oracle || '')));
  assert.match(
    validateCoreBetaCase(invalidContract).errors.join('\n'),
    new RegExp(expectedError.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
    `BETA-INIT-003 缺少 ${signal} 时必须 fail-closed`,
  );
}

const initializedPlan = [
  planCase('BETA-INIT-001', 'run_initialization'),
  planCase('BETA-INIT-002', 'run_initialization'),
  initializedSkillReinstallCase,
  planCase('BETA-INIT-004', 'run_initialization'),
  planCase('BETA-INIT-005', 'run_initialization'),
  planCase('BETA-CHAT-001', 'conversation'),
];
const initializedPlanValidation = validateCoreBetaCasePlan(initializedPlan);
assert.equal(initializedPlanValidation.ok, true, initializedPlanValidation.errors.join('\n'));
const misorderedPlan = [
  initializedPlan[1],
  initializedPlan[0],
  ...initializedPlan.slice(2),
];
assert.match(
  validateCoreBetaCasePlan(misorderedPlan).errors.join('\n'),
  /初始化硬门禁开场且顺序固定/,
);
const scopedPlan = initializedPlan.filter((item) => item.id !== 'BETA-INIT-005');
assert.equal(
  validateCoreBetaCasePlan(scopedPlan).ok,
  true,
  '不含网络故障注入的正式灰度门禁必须允许以前四个本地初始化 Case 开场',
);
const scopedSelection = validateCoreBetaScopedSelection({
  fullCases: initializedPlan,
  selectedCases: scopedPlan,
  excludedCaseIds: ['BETA-INIT-005'],
  reason: 'fixture_provider_unavailable',
});
assert.equal(scopedSelection.ok, true, scopedSelection.errors.join('\n'));
assert.equal(scopedSelection.release_gate_eligible, false);
assert.equal(validateCoreBetaCasePlan(scopedPlan, { allowPartialInitialization: true }).ok, true);
const missingSkillUpstreamPlan = [planCase('BETA-SKILL-011', 'skill_use')];
assert.match(
  validateCoreBetaCasePlan(missingSkillUpstreamPlan).errors.join('\n'),
  /BETA-SKILL-011 的上游 BETA-SKILL-002 必须在同一批次更早建立/,
  '复合父Case中的Skill下游缺少本轮上游账本时必须在Case 0前失败，不能运行中留下incomplete manifest',
);
const orderedSkillPlan = [
  planCase('BETA-SKILL-002', 'skill_lifecycle'),
  planCase('BETA-SKILL-003', 'skill_lifecycle'),
  planCase('BETA-SKILL-004', 'skill_lifecycle'),
  planCase('BETA-SKILL-011', 'skill_use'),
];
assert.doesNotMatch(
  validateCoreBetaCasePlan(orderedSkillPlan).errors.join('\n'),
  /必须在同一批次更早建立/,
  'Skill上游按序建立后不应再产生顺序依赖错误',
);
const misorderedExpertPlan = [
  planCase('BETA-EXPERT-007', 'expert_lifecycle'),
  planCase('BETA-EXPERT-003', 'expert_lifecycle'),
  planCase('BETA-EXPERT-002', 'expert_lifecycle'),
  planCase('BETA-EXPERT-004', 'expert_lifecycle'),
];
assert.match(
  validateCoreBetaCasePlan(misorderedExpertPlan).errors.join('\n'),
  /BETA-EXPERT-007 的上游 BETA-EXPERT-002 必须在同一批次更早建立/,
  '专家发布依赖逆序必须由顺序感知协议预检拒绝',
);
assert.deepEqual(
  classifyCoreBetaScopedFixtureExclusions({
    unavailableCaseIds: ['BETA-INIT-005'],
    excludedCaseIds: ['BETA-INIT-005', 'BETA-REC-001'],
  }),
  {
    ok: true,
    unavailable_fixture_case_ids: ['BETA-INIT-005'],
    missing_unavailable_fixture_case_ids: [],
    additional_fixture_exclusion_ids: ['BETA-REC-001'],
  },
  'scoped execution 可额外显式排除专项 fixture Case，但必须单独记录',
);
assert.equal(
  classifyCoreBetaScopedFixtureExclusions({
    unavailableCaseIds: ['BETA-INIT-005', 'BETA-AUTH-001'],
    excludedCaseIds: ['BETA-INIT-005'],
  }).ok,
  false,
  'scoped execution 漏排任一不可用 fixture Case 必须 fail-closed',
);
assert.equal(
  validateCoreBetaScopedSelection({
    fullCases: initializedPlan,
    selectedCases: scopedPlan,
    excludedCaseIds: ['BETA-INIT-005'],
    reason: '',
  }).ok,
  false,
  'scoped execution 不得省略排除原因',
);

const expertScopedDependencies = classifyCoreBetaScopedDependencyGaps({
  selectedCaseIds: [
    'BETA-EXPERT-008',
    'BETA-EXPERT-009',
    'BETA-EXPERT-010',
    'BETA-EXPERT-012',
    'BETA-EXPERT-014',
    'BETA-EXPERT-015',
    'BETA-EXPERT-016',
  ],
  excludedCaseIds: ['BETA-EXPERT-007'],
});
assert.deepEqual(
  expertScopedDependencies.affected_case_ids,
  [
    'BETA-EXPERT-008',
    'BETA-EXPERT-009',
    'BETA-EXPERT-010',
    'BETA-EXPERT-012',
    'BETA-EXPERT-014',
    'BETA-EXPERT-015',
    'BETA-EXPERT-016',
  ],
  '排除发布上游时，全部仍在范围内的发布专家依赖 Case 必须显式列为 dependency gap',
);
assert.equal(
  expertScopedDependencies.gaps.every((item) => (
    item.excluded_upstream_case_ids.includes('BETA-EXPERT-007')
  )),
  true,
);

const expertResearchCase = planCase('BETA-EXPERT-008', 'expert_use');
expertResearchCase.test_data = '选择一个当天可验证的产品/行业问题；要求至少两个官方来源。';
expertResearchCase.conversation_turns = [
  { turn: 1, prompt: '检索两个官方来源说明目标问题现状。', oracle: '来源可打开' },
  { turn: 2, prompt: '比较两份来源。', oracle: '比较完整' },
  { turn: 3, prompt: '给出结论。', oracle: '结论完整' },
];
expertResearchCase.evidence_roles.push('capability_selection', 'capability_execution_event');
assert.match(
  validateCoreBetaCase(expertResearchCase).errors.join('\n'),
  /占位输入|具体主题|as-of 日期/,
  '研究 Expert Case 不得把主题选择留给运行时澄清',
);
expertResearchCase.test_data = '固定研究主题：截至2026-08-06，比较 OpenAI Responses API 与 Chat Completions API；要求至少两个可打开的 OpenAI 官方来源。';
expertResearchCase.conversation_turns[0].prompt = '检索至少两个 OpenAI 官方来源，说明截至2026-08-06 Responses API 与 Chat Completions API 的官方定位、主要能力差异和迁移建议。';
assert.equal(
  validateCoreBetaCase(expertResearchCase).ok,
  true,
  validateCoreBetaCase(expertResearchCase).errors.join('\n'),
);

{
  const exactExpert = {
    id: 'expert-run-owned',
    activeReleaseId: 'release-run-owned',
    version: { id: 'version-run-owned' },
  };
  const arbitraryActiveExpert = {
    id: 'qwork.builtin.expert-authoring',
    activeReleaseId: 'qwork.builtin.expert-authoring.release.v3',
    release: { versionId: 'qwork.builtin.expert-authoring.version.v3' },
  };
  const requirement = CORE_BETA_RUN_OWNED_EXPERT_REQUIREMENTS.get('BETA-EXPERT-008');
  const absent = coreBetaRunOwnedExpertPrerequisiteBlocker({
    testCase: expertResearchCase,
    ledgerExperts: {},
    availableExperts: [arbitraryActiveExpert],
    publicState: {
      task: { id: null, running: false, message_count: 0 },
      expert: null,
      skills: { selected: [] },
      connectors: { selected: [] },
    },
  });
  assert.equal(absent.valid, true);
  assert.equal(absent.outcome, 'blocked');
  assert.equal(absent.selected_expert, null);
  assert.equal(absent.active_expert_count, 1);
  assert.equal(absent.arbitrary_active_expert_fallback_forbidden, true);

  const ready = coreBetaRunOwnedExpertPrerequisiteBlocker({
    testCase: expertResearchCase,
    ledgerExperts: { [requirement.ledger_key]: exactExpert },
    availableExperts: [arbitraryActiveExpert, exactExpert],
  });
  assert.equal(ready.ready, true);
  assert.deepEqual(ready.selected_expert, exactExpert);

  const incomplete = coreBetaRunOwnedExpertPrerequisiteBlocker({
    testCase: expertResearchCase,
    ledgerExperts: { [requirement.ledger_key]: { id: 'expert-run-owned' } },
    availableExperts: [arbitraryActiveExpert],
    publicState: {
      task: { id: null, running: false, message_count: 0 },
      expert: null,
      skills: { selected: [] },
      connectors: { selected: [] },
    },
  });
  assert.equal(incomplete.outcome, 'automation_error');
  assert.equal(incomplete.valid, false);

  const missingFromInventory = coreBetaRunOwnedExpertPrerequisiteBlocker({
    testCase: expertResearchCase,
    ledgerExperts: { [requirement.ledger_key]: exactExpert },
    availableExperts: [arbitraryActiveExpert],
    publicState: {
      task: { id: null, running: false, message_count: 0 },
      expert: null,
      skills: { selected: [] },
      connectors: { selected: [] },
    },
  });
  assert.equal(missingFromInventory.outcome, 'bug');
  assert.equal(missingFromInventory.valid, true);
}

const placeholder = structuredClone(sample);
placeholder.action_plan[1].command = 'beta_chat_001_step_2';
assert.match(validateCoreBetaCase(placeholder).errors.join('\n'), /占位命令/);

const missingTranscript = structuredClone(sample);
missingTranscript.evidence_roles = missingTranscript.evidence_roles.filter((role) => role !== 'transcript');
assert.match(validateCoreBetaCase(missingTranscript).errors.join('\n'), /transcript/);

const evaluated = evaluateMachineAssertions([
  { path: 'result.count', operator: 'equals', expected: 2 },
  { path: 'result.sha', operator: 'sha256' },
], { result: { count: 2, sha: 'a'.repeat(64) } });
assert.deepEqual(evaluated.map((item) => item.ok), [true, true]);

const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'qbot-core-evidence-'));
try {
  const files = {
    before: path.join(temp, 'before.png'),
    after: path.join(temp, 'after.png'),
    action_receipt: path.join(temp, 'action_receipt.json'),
    public_state_readback: path.join(temp, 'public_state_readback.json'),
    cleanup_readback: path.join(temp, 'cleanup_readback.json'),
    task_id: path.join(temp, 'task_id.json'),
    send_receipt: path.join(temp, 'send_receipt.json'),
    prompt: path.join(temp, 'prompt.txt'),
    transcript: path.join(temp, 'transcript.txt'),
    reply_delta: path.join(temp, 'reply_delta.txt'),
    reply_completion: path.join(temp, 'reply_completion.json'),
  };
  fs.writeFileSync(files.before, Buffer.alloc(256, 1));
  fs.writeFileSync(files.after, Buffer.alloc(256, 2));
  fs.writeFileSync(files.action_receipt, JSON.stringify(sample.action_plan.map((action) => ({
    action_id: action.action_id,
    status: 'passed',
    before_screenshot: files.before,
    after_screenshot: files.after,
  }))));
  fs.writeFileSync(files.public_state_readback, JSON.stringify({ valid: true, task: { id: 'task-1' } }));
  fs.writeFileSync(files.cleanup_readback, JSON.stringify({ valid: true, cleaned: true }));
  fs.writeFileSync(files.task_id, JSON.stringify({ task_id: 'task-1' }));
  fs.writeFileSync(files.send_receipt, JSON.stringify([{ task_id: 'task-1', confirmed_at: new Date().toISOString() }]));
  fs.writeFileSync(files.prompt, 'hello');
  fs.writeFileSync(files.transcript, 'user: hello\nassistant: world');
  fs.writeFileSync(files.reply_delta, 'world');
  fs.writeFileSync(files.reply_completion, JSON.stringify({ complete: true }));
  const manifest = buildCoreEvidenceManifest({
    testCase: sample,
    caseDir: temp,
    screenshots: { before: files.before, final: files.after },
    actions: sample.action_plan,
    artifacts: {
      action_receipt: files.action_receipt,
      public_state_readback: files.public_state_readback,
      cleanup_readback: files.cleanup_readback,
      task_id: files.task_id,
      send_receipt: files.send_receipt,
      prompt: files.prompt,
      transcript: files.transcript,
      reply_delta: files.reply_delta,
      reply_completion: files.reply_completion,
    },
  });
  assert.equal(manifest.complete, true, JSON.stringify(manifest.missing_roles));
  assert.equal(manifest.evidence.every((item) => /^[a-f0-9]{64}$/.test(item.sha256)), true);
  fs.writeFileSync(files.action_receipt, JSON.stringify(sample.action_plan.map((action) => ({
    action_id: action.action_id,
    status: 'failed',
    before_screenshot: files.before,
    after_screenshot: files.after,
    assertions: [{ id: 'business-oracle', ok: false }],
  }))));
  const failedProductManifest = buildCoreEvidenceManifest({
    testCase: sample,
    caseDir: temp,
    screenshots: { before: files.before, final: files.after },
    actions: sample.action_plan,
    artifacts: {
      action_receipt: files.action_receipt,
      public_state_readback: files.public_state_readback,
      cleanup_readback: files.cleanup_readback,
      task_id: files.task_id,
      send_receipt: files.send_receipt,
      prompt: files.prompt,
      transcript: files.transcript,
      reply_delta: files.reply_delta,
      reply_completion: files.reply_completion,
    },
  });
  assert.equal(
    failedProductManifest.complete,
    true,
    '结构完整的 failed action receipt 是可信产品失败证据，不得被误判为 manifest 不完整',
  );
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}

{
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'qbot-core-expert-prerequisite-'));
  try {
    const testCase = {
      id: 'BETA-EXPERT-008',
      evidence_roles: [
        'task_id',
        'prompt',
        'send_receipt',
        'transcript',
        'reply_delta',
        'reply_completion',
        'expert_runtime_trace',
        'capability_selection',
        'capability_execution_event',
      ],
    };
    const blocker = coreBetaRunOwnedExpertPrerequisiteBlocker({
      testCase,
      ledgerExperts: {},
      availableExperts: [{
        id: 'unrelated-active-expert',
        activeReleaseId: 'unrelated-release',
        version: { id: 'unrelated-version' },
      }],
      publicState: {
        task: { id: null, running: false, message_count: 0 },
        expert: null,
        skills: { selected: [] },
        connectors: { selected: [] },
      },
    });
    const blockerFile = path.join(temp, 'run-owned-expert-prerequisite.json');
    fs.writeFileSync(blockerFile, JSON.stringify(blocker));
    const artifacts = {
      core_beta_not_applicable_roles: blocker.not_applicable_roles.map((role) => ({
        role,
        blocker_path: blockerFile,
      })),
    };
    const manifest = buildCoreEvidenceManifest({ testCase, caseDir: temp, artifacts });
    assert.equal(manifest.complete, true, JSON.stringify(manifest));
    assert.deepEqual(
      manifest.not_applicable_roles.map((item) => item.role),
      testCase.evidence_roles,
      '可信专家前置阻塞必须显式补齐全部未发生的发送与专家执行角色',
    );

    fs.writeFileSync(blockerFile, JSON.stringify({
      ...blocker,
      required_ledger_key: 'wrong-ledger-key',
    }));
    const tampered = buildCoreEvidenceManifest({ testCase, caseDir: temp, artifacts });
    assert.equal(tampered.complete, false, '账本键不匹配时 N/A manifest 必须 fail-closed');
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
}

{
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'qbot-core-pre-send-capability-failure-'));
  try {
    const screenshot = path.join(temp, 'manual-skill-failure.png');
    fs.writeFileSync(screenshot, Buffer.alloc(256, 9));
    const notApplicableRoles = [
      'capability_execution_event',
      'prompt',
      'task_id',
      'send_receipt',
      'transcript',
      'reply_delta',
      'reply_completion',
    ];
    const blocker = coreBetaPreSendCapabilityFailureEvidence({
      testCaseId: 'BETA-SKILL-009',
      capabilityKind: 'skill',
      expectedIdentity: 'skillhub:global/qfin-ppt-brand-assets@1.0.0',
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
      },
      noPromptRecorded: true,
      noSendReceiptRecorded: true,
      notApplicableRoles,
    });
    const blockerFile = path.join(temp, 'pre-send-capability-failure.json');
    fs.writeFileSync(blockerFile, JSON.stringify(blocker));
    const testCase = {
      id: 'BETA-SKILL-009',
      evidence_roles: ['capability_selection', ...notApplicableRoles],
    };
    const artifacts = {
      capability_selection: blockerFile,
      core_beta_not_applicable_roles: notApplicableRoles.map((role) => ({
        role,
        blocker_path: blockerFile,
      })),
    };
    const manifest = buildCoreEvidenceManifest({ testCase, caseDir: temp, artifacts });
    assert.equal(manifest.complete, true, JSON.stringify(manifest));
    assert.deepEqual(manifest.missing_roles, []);
    assert.deepEqual(manifest.not_applicable_roles.map((item) => item.role), notApplicableRoles);
    assert.equal(
      manifest.evidence.find((item) => item.role === 'capability_selection')?.not_applicable,
      undefined,
      '能力选择负向收据本身必须是有效证据，不能标为 N/A',
    );

    fs.writeFileSync(blockerFile, JSON.stringify({
      ...blocker,
      mutation_guard: { ...blocker.mutation_guard, send_count_unchanged: false },
    }));
    const tampered = buildCoreEvidenceManifest({ testCase, caseDir: temp, artifacts });
    assert.equal(tampered.complete, false, '发送计数守卫被篡改后 N/A manifest 必须 fail-closed');
    assert.ok(tampered.missing_roles.includes('capability_execution_event'));
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
}

{
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'qbot-core-compound-contract-'));
  try {
    const action = (id, number, operation) => ({
      number,
      action_id: `${id}-${operation}`,
      declared_step: `${operation} ${id}`,
      command: `${operation}_${id.toLowerCase().replaceAll('-', '_')}`,
      operation,
      target: `${id}:${operation}`,
      executor: coreBetaExecutorRoute({ id }),
      expected_state: `${operation} complete`,
      evidence_roles: ['before_screenshot', 'action_receipt', 'after_screenshot'],
      assertions: [{ id: `${id}-${operation}-assertion`, path: 'result.status', operator: 'in', expected: ['passed', 'failed', 'blocked'] }],
    });
    const leaf = (id, caseType) => ({
      id,
      case_type: caseType,
      contract_version: 'qbot-core-beta/v2',
      automation_protocol: 'core-beta-action-plan/v2',
      evidence_schema_version: 'qbot-core-evidence/v2',
      pipeline_policy: 'serial',
      batch_size: 1,
      initialization_policy: 'case_clean',
      cleanup_policy: 'restore_case_state',
      risk_domain: 'functional',
      oracle_type: 'hard',
      deterministic: '是',
      repeat_policy: '每轮1次',
      required_fixture: 'public_product_state',
      hard_gate: '是',
      version_scope: 'uat',
      production_signal: 'none',
      action_plan: ['prepare', 'execute', 'verify'].map((operation, index) => action(id, index + 1, operation)),
      precise_assertions: {
        hard_oracles: [`${id} hard oracle`],
        machine_assertions: [{ id: 'status', path: 'result.status', operator: 'in', expected: ['passed', 'failed', 'blocked'] }],
        pass_rule: 'all hard oracles pass',
        fail_rule: 'product oracle fails',
        block_rule: 'prerequisite unavailable',
      },
      evidence_roles: ['before_screenshot', 'action_receipt', 'after_screenshot', 'public_state_readback', 'cleanup_readback'],
    });
    const children = [leaf('BETA-INIT-001', 'run_initialization'), leaf('SIT-HOME-027', 'settings_lifecycle')];
    const compound = {
      ...leaf('QW-ENTRY-001', 'compound'),
      id: 'QW-ENTRY-001',
      case_type: 'compound',
      action_plan: [{
        number: 1,
        action_id: 'QW-ENTRY-001-compound',
        declared_step: '严格串行执行全部子合同',
        command: 'execute_compound_subcases_serially',
        operation: 'execute',
        target: 'QW-ENTRY-001:execute',
        executor: 'core-beta/compound-v2',
        expected_state: '全部子合同生成完整证据',
        evidence_roles: ['before_screenshot', 'action_receipt', 'after_screenshot'],
        assertions: [{ id: 'compound-complete', path: 'evidence.complete', operator: 'equals', expected: true }],
      }],
      required_fixture: 'compound_children',
      evidence_roles: ['compound_evidence_manifest'],
      compound_subcases: children,
    };
    const validation = validateCoreBetaCase(compound);
    assert.equal(validation.ok, true, validation.errors.join('\n'));
    assert.equal(validation.subcase_count, 2);
    assert.deepEqual(coreBetaLeafCases([compound]).map((item) => item.id), ['BETA-INIT-001', 'SIT-HOME-027']);
    assert.equal(coreBetaExecutorRoute(compound), 'core-beta/compound-v2');

    const casesRoot = path.join(temp, 'cases');
    const parentDir = path.join(casesRoot, '001-QW-ENTRY-001');
    const subRoot = path.join(parentDir, 'subcases');
    fs.mkdirSync(subRoot, { recursive: true });
    fs.writeFileSync(path.join(temp, 'casebook-cases.json'), '{}');
    const results = children.map((child, index) => {
      const childDir = path.join(subRoot, `${String(index + 1).padStart(3, '0')}-${child.id}`);
      fs.mkdirSync(childDir, { recursive: true });
      const result = { id: child.id, status: 'passed', result_category: 'pass', case_dir: childDir };
      fs.writeFileSync(path.join(childDir, 'case-result.json'), JSON.stringify(result));
      fs.writeFileSync(path.join(childDir, 'evidence-manifest.json'), JSON.stringify({
        complete: true,
        missing_roles: [],
        invalid_roles: [],
      }));
      return result;
    });
    const manifest = buildCompoundEvidenceManifest({ testCase: compound, caseDir: parentDir, subcaseResults: results });
    assert.equal(manifest.complete, true, JSON.stringify(manifest));
    assert.equal(manifest.subcases.every((item) => /^[a-f0-9]{64}$/.test(item.case_result.sha256)), true);
    assert.equal(coreBetaSuiteRoot(results[0].case_dir), temp);
    assert.equal(coreBetaSuiteLedgerPath(results[0].case_dir), path.join(temp, 'core-beta-suite-ledger.json'));
    assert.deepEqual(aggregateCompoundOutcome(results), { status: 'passed', result_category: 'pass' });
    assert.deepEqual(aggregateCompoundOutcome([{ status: 'blocked', result_category: 'blocked' }]), { status: 'blocked', result_category: 'blocked' });
    assert.equal(
      compoundBlockedReason([{
        status: 'blocked',
        result_category: 'blocked',
        blocked_reason: '当前账号的可见技能列表为空，无法选择用例要求的真实能力。',
        actual_result: '父级状态摘要',
      }]),
      '当前账号的可见技能列表为空，无法选择用例要求的真实能力。',
      'compound 父 Case 必须传播叶子的具体 blocked reason，不能只保留状态摘要',
    );
    assert.deepEqual(aggregateCompoundOutcome([{ status: 'failed', result_category: 'bug' }, { status: 'blocked', result_category: 'blocked' }]), { status: 'failed', result_category: 'bug' });
    assert.deepEqual(aggregateCompoundOutcome([
      { status: 'failed', result_category: 'bug' },
      { status: 'blocked', result_category: 'blocked', steps: [{ status: 'failed', category: 'automation_error' }] },
    ]), { status: 'failed', result_category: 'automation_error' });
    const compoundManifestFile = path.join(parentDir, 'compound-evidence-manifest.json');
    fs.writeFileSync(compoundManifestFile, JSON.stringify(manifest));
    const completeParentEvidence = {
      complete: true,
      missing_roles: [],
      invalid_roles: [],
      evidence: [{
        role: 'compound_evidence_manifest',
        missing: false,
        valid: true,
        sha256: 'a'.repeat(64),
      }],
    };
    const parentResult = {
      id: compound.id,
      case_dir: parentDir,
      artifacts: { compound_evidence_manifest: compoundManifestFile },
      evidence_manifest: completeParentEvidence,
    };
    assert.equal(
      coreBetaCompletionBlockReason(compound, parentResult),
      '',
      '复合父 Case 只有在复合清单和全部子证据同时完整时才能进入 completed',
    );
    fs.writeFileSync(compoundManifestFile, JSON.stringify({ ...manifest, complete: false }));
    assert.match(
      coreBetaCompletionBlockReason(compound, parentResult),
      /incomplete 的 compound evidence manifest/,
      '父级普通 manifest 完整不能掩盖 compound manifest complete=false',
    );
    const tamperedManifest = structuredClone(manifest);
    tamperedManifest.subcases[0].case_result.sha256 = 'b'.repeat(64);
    fs.writeFileSync(compoundManifestFile, JSON.stringify(tamperedManifest));
    assert.match(
      coreBetaCompletionBlockReason(compound, parentResult),
      /SHA 不一致的 case-result 证据/,
      '复合清单内子结果 SHA 漂移必须 fail-closed',
    );
    fs.writeFileSync(path.join(results[1].case_dir, 'evidence-manifest.json'), JSON.stringify({
      complete: false,
      missing_roles: ['after_screenshot'],
      invalid_roles: [],
    }));
    assert.equal(
      buildCompoundEvidenceManifest({ testCase: compound, caseDir: parentDir, subcaseResults: results }).complete,
      false,
      '任一子 manifest 不完整时父 Case 必须 fail-closed',
    );
    const interruptedManifest = buildCompoundEvidenceManifest({
      testCase: compound,
      caseDir: parentDir,
      subcaseResults: results.slice(0, 1),
    });
    assert.equal(interruptedManifest.complete, false);
    assert.equal(interruptedManifest.subcases[1].status, 'not_executed');
    assert.equal(interruptedManifest.subcases[1].case_result.path, '');
    assert.equal(interruptedManifest.subcases[1].case_result.error, 'subcase_not_executed');
    assert.equal(interruptedManifest.subcases[1].validation_error, 'subcase_not_executed');
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
}

{
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'qbot-renderer-adapter-framework-failure-'));
  try {
    const screenshot = path.join(temp, 'adapter-failure.png');
    const actionReceipt = path.join(temp, 'action-receipts.json');
    const productTrace = path.join(temp, 'verified-legacy-product-action-trace.json');
    const diagnostic = path.join(temp, 'teams360-skill-fixture-adapter.json');
    const blocker = path.join(temp, 'renderer-adapter-framework-failure.json');
    fs.writeFileSync(screenshot, Buffer.alloc(256, 7));
    fs.writeFileSync(actionReceipt, JSON.stringify([{
      status: 'failed',
      before_screenshot: screenshot,
      after_screenshot: screenshot,
    }]));
    fs.writeFileSync(productTrace, JSON.stringify({
      schema_version: 'qbot-core-beta-verified-legacy-trace/v1',
      case_id: 'SIT-SKILL-026',
      evidence_valid: true,
      oracle_valid: false,
    }));
    fs.writeFileSync(diagnostic, JSON.stringify({
      schema_version: 'qbot-teams-skill-fixture-adapter/v2',
      case_id: 'SIT-SKILL-026',
      status: 'failed',
      attempts: [{ attempt: 1 }, { attempt: 2 }],
    }));
    const notApplicableRoles = [
      'task_id',
      'prompt',
      'send_receipt',
      'transcript',
      'reply_delta',
      'reply_completion',
      'capability_selection',
      'capability_execution_event',
    ];
    fs.writeFileSync(blocker, JSON.stringify({
      schema_version: 'qbot-core-beta-renderer-adapter-framework-failure/v1',
      valid: true,
      evidence_valid: true,
      oracle_valid: false,
      case_id: 'SIT-SKILL-026',
      category: 'automation_error',
      kind: 'skill_fixture_renderer_adapter_setup_failure',
      phase: 'renderer_control_adapter_setup',
      source: 'renderer_control_adapter_diagnostics',
      product_action_started: false,
      reason: 'renderer lifecycle probe failed after one clean rebind',
      diagnostic_path: diagnostic,
      diagnostic_sha256: createHash('sha256').update(fs.readFileSync(diagnostic)).digest('hex'),
      attempts: [1, 2].map((attempt) => ({
        attempt,
        before: { node_registry_count: 0 },
        after: { node_registry_count: 0 },
        lifecycle_bound: false,
        error: { message: 'controller events missing' },
      })),
      not_applicable_roles: notApplicableRoles,
    }));
    const testCase = {
      id: 'SIT-SKILL-026',
      evidence_roles: [
        'before_screenshot',
        'action_receipt',
        'after_screenshot',
        'product_action_trace',
        ...notApplicableRoles,
      ],
    };
    const manifest = buildCoreEvidenceManifest({
      testCase,
      caseDir: temp,
      screenshots: { before: screenshot, final: screenshot },
      artifacts: {
        action_receipt: actionReceipt,
        product_action_trace: productTrace,
        core_beta_not_applicable_roles: notApplicableRoles
          .map((role) => ({ role, blocker_path: blocker })),
      },
      actions: [{}],
    });
    assert.equal(manifest.complete, true);
    assert.deepEqual(manifest.missing_roles, []);
    assert.deepEqual(manifest.invalid_roles, []);
    assert.deepEqual(
      manifest.not_applicable_roles.map((item) => item.role),
      notApplicableRoles,
    );
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
}

console.log('core-beta-case-protocol: ok');
