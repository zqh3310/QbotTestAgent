import assert from 'node:assert/strict';
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
import { validateCasebookExecutorReadiness } from '../src/lib/ui-agent-casebook-runner.mjs';

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
