import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  CORE_BETA_SCENARIO_IDS,
  CORE_BETA_SCENARIO_REGISTRY,
  buildCoreEvidenceManifest,
  classifyCoreBetaScopedFixtureExclusions,
  coreBetaCaseContractSha256,
  coreBetaExecutorRoute,
  evaluateMachineAssertions,
  validateEvidenceFile,
  validateCoreBetaCase,
  validateCoreBetaCasePlan,
  validateCoreBetaScopedSelection,
} from '../src/lib/core-beta-case-protocol.mjs';

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
  fs.rmSync(root, { recursive: true, force: true });
}

assert.equal(CORE_BETA_SCENARIO_IDS.size, 184);
assert.equal(CORE_BETA_SCENARIO_REGISTRY.size, 184);
assert.equal(
  new Set([...CORE_BETA_SCENARIO_REGISTRY.values()].map((item) => item.executor_route)).size,
  184,
  '每个Core Beta Case必须绑定唯一执行器路由',
);
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
const verifiedLegacyDrivers = [...CORE_BETA_SCENARIO_REGISTRY.values()]
  .filter((item) => item.legacy_case_id)
  .map((item) => `${item.id}:${item.legacy_case_id}`)
  .sort();
assert.deepEqual(verifiedLegacyDrivers, [
  'BETA-FILE-010:SIT-FILE-NEW-001',
  'BETA-HOST-003:SIT-TEAMS-NEW-003',
  'BETA-PERF-003:SIT-ISSUE-793',
  'BETA-SEC-002:SIT-WORKSPACE-001',
  'BETA-TASK-003:SIT-TASK-RECOVER-001',
], '只有完成语义复核并覆盖完整业务 Oracle 的旧执行器可以保留映射');

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
const initializedPlan = [
  planCase('BETA-INIT-001', 'run_initialization'),
  planCase('BETA-INIT-002', 'run_initialization'),
  planCase('BETA-INIT-003', 'run_initialization'),
  planCase('BETA-INIT-004', 'run_initialization'),
  planCase('BETA-INIT-005', 'run_initialization'),
  planCase('BETA-CHAT-001', 'conversation'),
];
assert.equal(validateCoreBetaCasePlan(initializedPlan).ok, true);
const misorderedPlan = [
  initializedPlan[1],
  initializedPlan[0],
  ...initializedPlan.slice(2),
];
assert.match(
  validateCoreBetaCasePlan(misorderedPlan).errors.join('\n'),
  /前五个初始化硬门禁开场且顺序固定/,
);
const scopedPlan = initializedPlan.filter((item) => item.id !== 'BETA-INIT-005');
const scopedSelection = validateCoreBetaScopedSelection({
  fullCases: initializedPlan,
  selectedCases: scopedPlan,
  excludedCaseIds: ['BETA-INIT-005'],
  reason: 'fixture_provider_unavailable',
});
assert.equal(scopedSelection.ok, true, scopedSelection.errors.join('\n'));
assert.equal(scopedSelection.release_gate_eligible, false);
assert.equal(validateCoreBetaCasePlan(scopedPlan, { allowPartialInitialization: true }).ok, true);
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

console.log('core-beta-case-protocol: ok');
