import assert from 'node:assert/strict';
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
  buildCaseEvidenceManifest,
  coreBetaActionReceiptsComplete,
  coreBetaAttachmentCollectNeedsSend,
  coreBetaBatchSharedDeadline,
  coreBetaBatchTerminalEvidence,
  coreBetaMaintenanceConfirmationContract,
  coreBetaNeedsRendererReconnect,
  coreBetaSettingsLoadTimeoutMs,
  coreBetaSettingsSurfaceState,
  verifiedReplyTimeoutTerminalEvidence,
  validateCasebookExecutorReadiness,
} from '../src/lib/ui-agent-casebook-runner.mjs';

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
    { ...base, state_readback: null, error: '' },
  ], 1), false);
});

test('Core Beta refresh reconnects only for a closed renderer', () => {
  assert.equal(coreBetaNeedsRendererReconnect(
    new Error('page.reload: Target page, context or browser has been closed'),
  ), true);
  assert.equal(coreBetaNeedsRendererReconnect(
    new Error('page.reload: net::ERR_FAILED'),
  ), false);
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

test('a fully evidenced partial batch deadline is complete failure evidence and never success', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'qbot-core-beta-batch-terminal-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const entries = Array.from({ length: 20 }, (_, index) => {
    const dispatchScreenshot = path.join(root, `dispatch-${index + 1}.png`);
    const terminalScreenshot = path.join(root, `terminal-${index + 1}.png`);
    fs.writeFileSync(dispatchScreenshot, `dispatch-${index + 1}`);
    fs.writeFileSync(terminalScreenshot, `terminal-${index + 1}`);
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

  fs.rmSync(entries[9].terminal_screenshot);
  const missingTerminalFrame = coreBetaBatchTerminalEvidence(entries, {
    deadlineAtMs: Date.parse('2026-07-29T00:10:19.000Z'),
    deadlineReached: true,
  });
  assert.equal(missingTerminalFrame.available, false);
  assert.equal(missingTerminalFrame.terminal_rows_complete, false);

  fs.writeFileSync(entries[9].terminal_screenshot, 'restored');
  entries[10].send_receipt.confirmed = false;
  const missingSendReceipt = coreBetaBatchTerminalEvidence(entries, {
    deadlineAtMs: Date.parse('2026-07-29T00:10:19.000Z'),
    deadlineReached: true,
  });
  assert.equal(missingSendReceipt.available, false);
  assert.equal(missingSendReceipt.dispatch_receipts_complete, false);
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
