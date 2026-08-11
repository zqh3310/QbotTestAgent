import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  CORE_BETA_RUN_OWNED_EXPERT_REQUIREMENTS,
  CORE_BETA_BASE_SCENARIO_IDS,
  CORE_BETA_SCENARIO_IDS,
  CORE_BETA_SCENARIO_REGISTRY,
  FULL_FUNCTION_REGRESSION_LEGACY_CASE_IDS,
  buildCoreEvidenceManifest,
  classifyCoreBetaScopedDependencyGaps,
  classifyCoreBetaScopedFixtureExclusions,
  coreBetaCaseContractSha256,
  coreBetaExecutorRoute,
  evaluateMachineAssertions,
  validateEvidenceFile,
  validateCoreBetaCase,
  validateCoreBetaCasePlan,
  validateCoreBetaScopedSelection,
} from '../src/lib/core-beta-case-protocol.mjs';
import {
  coreBetaPreSendCapabilityFailureEvidence,
  coreBetaRunOwnedExpertPrerequisiteBlocker,
} from '../src/lib/ui-agent-casebook-runner-v2.mjs';

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
  fs.rmSync(root, { recursive: true, force: true });
}

assert.equal(CORE_BETA_BASE_SCENARIO_IDS.size, 184);
assert.equal(FULL_FUNCTION_REGRESSION_LEGACY_CASE_IDS.size, 90);
assert.equal(CORE_BETA_SCENARIO_IDS.size, 274);
assert.equal(CORE_BETA_SCENARIO_REGISTRY.size, 274);
assert.equal(
  new Set([...CORE_BETA_SCENARIO_REGISTRY.values()].map((item) => item.executor_route)).size,
  274,
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

console.log('core-beta-case-protocol: ok');
