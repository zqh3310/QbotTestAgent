import assert from 'node:assert/strict';
import test from 'node:test';
import {
  LATEST_MAIN_BASELINE,
  PRODUCTION_CASEBOOK_CONTRACT_VERSION,
  migrateProductionCase,
  productionCaseMigrationPlan,
  validateTrustedProductionCaseContract,
} from '../src/lib/production-casebook-contract.mjs';

function sourceCase(id) {
  return {
    id,
    module: id.includes('CONN') ? '连接器功能' : id.includes('SKILL') ? '技能功能' : '首页会话组合',
    submodule: 'production trust contract',
    scenario: `${id} 用户可见生产门禁场景`,
    steps: '1. 执行真实用户动作。\n2. 核对可见结果与独立状态读回。',
    selectors: '[data-testid="composer-plus-menu"]',
    source_type: 'deepbankV2 origin/main@0000000',
    version_scope: '360Teams 5.2.20 (2119072293) + QWork/runtime 0.0.12',
    kind: 'ui',
  };
}

test('latest-main migration plan is an exact unique 92-case set', () => {
  const plan = productionCaseMigrationPlan();
  const entries = Object.entries(plan);
  const ids = entries.flatMap(([, values]) => values);
  assert.equal(ids.length, 92);
  assert.equal(new Set(ids).size, 92);
  assert.deepEqual(
    Object.fromEntries(entries.map(([key, values]) => [key, values.length])),
    {
      replace_obsolete_assertion: 2,
      rewrite_for_latest_main: 51,
      retain_and_strengthen_evidence: 26,
      retain_business_oracle: 13,
    },
  );
});

test('migrated 92-case contract is V2, pinned, and contains no legacy product assertions', () => {
  const ids = Object.values(productionCaseMigrationPlan()).flat();
  const cases = ids.map((id) => migrateProductionCase(sourceCase(id)));
  const audit = validateTrustedProductionCaseContract(cases);
  assert.equal(audit.ok, true, audit.errors.join('\n'));
  assert.equal(audit.case_count, 92);
  assert.equal(audit.unique_case_ids, 92);
  assert.ok(cases.every((item) => item.contract_version === PRODUCTION_CASEBOOK_CONTRACT_VERSION));
  assert.ok(cases.every((item) => item.product_baseline.includes(LATEST_MAIN_BASELINE.commit)));
  assert.ok(cases.every((item) => !/composer-(?:skills|connectors)-menu|composer-(?:skill|connector)-mode-(?:auto|manual|disabled)|assistant-turn-summary-created-file|nav-knowledge/.test(item.selectors)));
});

test('strict contract rejects legacy selector fallback and bridge-only visible acceptance', () => {
  const migrated = migrateProductionCase(sourceCase('SIT-SKILL-007'));
  migrated.selectors = '[data-testid="composer-skills-menu"]';
  migrated.visible_action_contract = 'bridge 调用完成即通过';
  const audit = validateTrustedProductionCaseContract([migrated], { requireFullSet: false });
  assert.equal(audit.ok, false);
  assert.ok(audit.errors.some((item) => item.includes('失效产品断言')));
  assert.ok(audit.warnings.some((item) => item.includes('bridge')));
});

test('evidence roles are universal for public state but artifact-scoped by Case identity', () => {
  const init = migrateProductionCase({
    ...sourceCase('SIT-INIT-002'),
    steps: '1. 点击添加文件入口。\n2. 核对首页产品入口。',
  });
  const initRoles = new Set(init.required_evidence_roles.split(','));
  assert.equal(initRoles.has('public_state_readback'), true);
  assert.equal(initRoles.has('artifact_path_sha256'), false);
  assert.equal(initRoles.has('artifact_content_readback'), false);
  assert.equal(initRoles.has('artifact_preview'), false);

  const artifact = migrateProductionCase(sourceCase('SIT-ART-002'));
  const artifactRoles = new Set(artifact.required_evidence_roles.split(','));
  assert.equal(artifactRoles.has('public_state_readback'), true);
  assert.equal(artifactRoles.has('artifact_path_sha256'), true);
  assert.equal(artifactRoles.has('artifact_content_readback'), true);
  assert.equal(artifactRoles.has('artifact_preview'), true);
});

test('conversation evidence roles follow real send actions, not read-only send-state wording', () => {
  const runtimeState = migrateProductionCase({
    ...sourceCase('SIT-INIT-004'),
    scenario: 'Teams 内 QWork 运行环境状态必须与输入/发送门禁一致',
    steps: '1. 回读输入区状态。\n2. 环境未 ready 时确认发送不可用。\n3. 保存发送门禁截图。',
  });
  const runtimeRoles = new Set(runtimeState.required_evidence_roles.split(','));
  assert.equal(runtimeRoles.has('prompt'), false);
  assert.equal(runtimeRoles.has('transcript'), false);

  const realConversation = migrateProductionCase({
    ...sourceCase('SIT-HOME-015'),
    kind: 'conversation',
    steps: '1. 输入问题并发送。\n2. 等待 Agent 回复，保存 transcript 和 reply-delta。',
  });
  const conversationRoles = new Set(realConversation.required_evidence_roles.split(','));
  assert.equal(conversationRoles.has('prompt'), true);
  assert.equal(conversationRoles.has('task_id'), true);
  assert.equal(conversationRoles.has('transcript'), true);
  assert.equal(conversationRoles.has('reply_delta'), true);

  const restart = migrateProductionCase({
    ...sourceCase('SIT-AUTH-003'),
    kind: 'auth',
    steps: '1. 记录真实历史任务。\n2. 重启宿主。\n3. 核对同一历史任务。',
  });
  const restartRoles = new Set(restart.required_evidence_roles.split(','));
  assert.equal(restartRoles.has('task_id'), true);
  assert.equal(restartRoles.has('transcript'), false);
});

test('attachment limit rejections use a no-send evidence contract', () => {
  for (const [id, scenario] of [
    ['SIT-HOME-043', '单个文档附件超过 30MB 时应提示文件过大'],
    ['SIT-HOME-044', '文档附件总大小超过 80MB 时应提示总量过大'],
  ]) {
    const rejection = migrateProductionCase({
      ...sourceCase(id),
      kind: 'attachment',
      scenario,
      steps: '1. 真实选择超限附件。\n2. 核对产品限制提示与输入区未挂载附件。\n3. 核对未创建任务且未发送消息。',
    });
    const roles = new Set(rejection.required_evidence_roles.split(','));
    assert.equal(roles.has('attachment_name_size_sha256'), true, id);
    assert.equal(roles.has('composer_attachment_state'), true, id);
    assert.equal(roles.has('attachment_limit_rejection'), true, id);
    assert.equal(roles.has('no_task_no_send_state'), true, id);
    assert.equal(roles.has('attachment_readback'), false, id);
    assert.equal(roles.has('prompt'), false, id);
    assert.equal(roles.has('task_id'), false, id);
    assert.equal(roles.has('transcript'), false, id);
    assert.equal(roles.has('reply_delta'), false, id);
  }
});
