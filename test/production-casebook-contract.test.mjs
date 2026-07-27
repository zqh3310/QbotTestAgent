import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  ATTACHMENT_EVIDENCE_ROLES,
  LATEST_MAIN_BASELINE,
  PRODUCTION_CASEBOOK_CONTRACT_VERSION,
  attachmentEvidenceApplicability,
  migrateProductionCase,
  productionCaseMigrationPlan,
  resolveEvidenceRoleApplicability,
  validateTrustedProductionCaseContract,
} from '../src/lib/production-casebook-contract.mjs';
import {
  buildCaseEvidenceManifest,
  enforceNumberedStepExecutionContract,
  numberedStepExecutionCoverage,
  parseDeclaredNumberedSteps,
} from '../src/lib/ui-agent-casebook-runner.mjs';

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

test('attachment evidence follows the execution contract, not attachment words in a conversation', () => {
  for (const [id, testData] of [
    ['SIT-TASK-EDIT-001', '原问题：请给出 3 条登录测试点。修改后：请给出 5 条附件上传测试点。'],
    ['SIT-HOME-065', '请读取我刚才上传的预算表，找出金额最高的三项并说明风险。'],
  ]) {
    const conversation = migrateProductionCase({
      ...sourceCase(id),
      kind: 'conversation',
      scenario: id === 'SIT-TASK-EDIT-001'
        ? '编辑历史用户问题并重新发送后，新回复应基于修改后的内容'
        : '未上传附件时应明确无附件且不得虚构',
      test_data: testData,
      steps: '1. 输入包含附件字样的问题并发送。\n2. 等待回复并核对会话状态。',
    });
    const roles = new Set(conversation.required_evidence_roles.split(','));
    for (const role of ATTACHMENT_EVIDENCE_ROLES) {
      assert.equal(roles.has(role), false, `${id}:${role}`);
    }
    assert.equal(attachmentEvidenceApplicability(conversation).applicable, false, id);
  }

  const actualAttachment = migrateProductionCase({
    ...sourceCase('SIT-HOME-038'),
    kind: 'attachment',
    scenario: '连续上传 3 张图片后应全部进入附件区并被处理',
    test_data: 'qbot-image-test.png, qbot-image-flow.png, qbot-image-risk.png',
    steps: '1. 选择并上传三张真实图片。\n2. 核对 Composer 附件状态。\n3. 发送并读回附件内容。',
  });
  const attachmentRoles = new Set(actualAttachment.required_evidence_roles.split(','));
  assert.equal(attachmentRoles.has('attachment_name_size_sha256'), true);
  assert.equal(attachmentRoles.has('composer_attachment_state'), true);
  assert.equal(attachmentRoles.has('attachment_readback'), true);
});

test('legacy over-declared attachment roles are explicit N/A unless runtime observes an attachment', () => {
  const legacyRoles = [
    'before_screenshot',
    'case_report',
    'attachment_name_size_sha256',
    'composer_attachment_state',
    'attachment_readback',
  ];
  const conversation = {
    id: 'SIT-TASK-EDIT-001',
    kind: 'conversation',
    test_data: '修改后：请给出 5 条附件上传测试点。',
  };
  const noAttachment = resolveEvidenceRoleApplicability(conversation, legacyRoles);
  assert.deepEqual(noAttachment.required_roles, ['before_screenshot', 'case_report']);
  assert.deepEqual(
    noAttachment.not_applicable_roles.map((item) => item.role),
    ['attachment_name_size_sha256', 'composer_attachment_state', 'attachment_readback'],
  );
  assert.ok(noAttachment.not_applicable_roles.every((item) => item.reason.includes('不构成附件操作')));

  const observedAttachment = resolveEvidenceRoleApplicability(
    conversation,
    legacyRoles,
    { attachmentObserved: true },
  );
  assert.deepEqual(observedAttachment.required_roles, legacyRoles);
  assert.deepEqual(observedAttachment.not_applicable_roles, []);
  assert.equal(observedAttachment.attachment_evidence_applicability.source, 'runtime_observation');
});

test('evidence manifest preserves legacy declarations while gating only applicable roles', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'qbot-evidence-applicability-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const caseDir = path.join(root, 'cases', 'SIT-TASK-EDIT-001');
  fs.mkdirSync(caseDir, { recursive: true });
  const caseReport = path.join(caseDir, 'case-report.md');
  fs.writeFileSync(caseReport, '# trusted case report\n');
  const declaredRoles = [
    'case_report',
    'attachment_name_size_sha256',
    'composer_attachment_state',
    'attachment_readback',
  ].join(',');
  const baseState = {
    id: 'SIT-TASK-EDIT-001',
    kind: 'conversation',
    contract_version: PRODUCTION_CASEBOOK_CONTRACT_VERSION,
    product_baseline: `deepbankV2 origin/main@${LATEST_MAIN_BASELINE.commit}`,
    required_evidence_roles: declaredRoles,
    status: 'passed',
    case_report: caseReport,
    artifacts: {},
    screenshots: {},
    steps: [],
    assertions: [],
  };
  const manifest = buildCaseEvidenceManifest(baseState, caseDir);
  assert.equal(manifest.schema_version, 2);
  assert.equal(manifest.complete, true);
  assert.deepEqual(manifest.required_roles, ['case_report']);
  assert.equal(manifest.required_role_count, 1);
  assert.equal(manifest.satisfied_role_count, 1);
  assert.equal(manifest.declared_required_role_count, 4);
  assert.equal(manifest.not_applicable_role_count, 3);
  assert.equal(manifest.role_evidence.attachment_name_size_sha256.not_applicable, true);
  assert.match(manifest.role_evidence.attachment_name_size_sha256.reason, /不构成附件操作/);

  const attachmentManifest = buildCaseEvidenceManifest(
    { ...baseState, id: 'SIT-HOME-038', kind: 'attachment' },
    caseDir,
  );
  assert.equal(attachmentManifest.complete, false);
  assert.deepEqual(
    attachmentManifest.missing_roles,
    ['attachment_name_size_sha256', 'composer_attachment_state', 'attachment_readback'],
  );
  assert.equal(attachmentManifest.not_applicable_role_count, 0);
});

test('evidence manifest maps the V4 redacted_log role to immutable run metadata', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'qbot-v4-redacted-log-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const caseDir = path.join(root, 'cases', 'USR-START-001');
  fs.mkdirSync(caseDir, { recursive: true });
  fs.writeFileSync(path.join(root, 'run-metadata.json'), '{"environment":"prod"}\n');
  const manifest = buildCaseEvidenceManifest({
    id: 'USR-START-001',
    kind: 'ui+conversation',
    contract_version: 'qbot-current-casebook/v4',
    required_evidence_roles: 'redacted_log',
    status: 'passed',
    artifacts: {},
    screenshots: {},
    steps: [],
    assertions: [],
  }, caseDir);
  assert.equal(manifest.complete, true);
  assert.deepEqual(manifest.missing_roles, []);
  assert.equal(manifest.role_evidence.redacted_log.available, true);
  assert.equal(manifest.role_evidence.redacted_log.files.length, 1);
  assert.match(manifest.role_evidence.redacted_log.files[0].file, /run-metadata\.json$/);
});

test('V4 numbered-step coverage rejects observation-only auth false passes', () => {
  const numberedSteps = [
    '1. 退出当前账号',
    '2. 发起登录',
    '3. 取消登录',
    '4. 再次发起登录',
    '5. 核对工作台和当前账号',
  ].join('\n');
  assert.equal(parseDeclaredNumberedSteps(numberedSteps).length, 5);
  const coverage = numberedStepExecutionCoverage({
    numbered_steps: numberedSteps,
    steps: [
      { action: '切换模型档位：M3' },
      { action: '观察当前鉴权状态' },
    ],
    assertions: [{ name: '已处于登录后工作台' }],
  });
  assert.equal(coverage.complete, false);
  assert.equal(coverage.declared_count, 5);
  assert.ok(coverage.missing_steps.some((item) => item.missing_semantic_markers.includes('logout')));
  assert.ok(coverage.missing_steps.some((item) => item.missing_semantic_markers.includes('cancel')));
  assert.ok(coverage.missing_steps.some((item) => item.missing_semantic_markers.includes('retry')));
});

test('V4 numbered-step coverage rejects generic conversation that never clicks stop', () => {
  const coverage = numberedStepExecutionCoverage({
    numbered_steps: [
      '1. 新建任务',
      '2. 输入一个长问题并发送',
      '3. 等待回复开始生成',
      '4. 点击停止',
      '5. 核对已生成内容仍保留',
    ].join('\n'),
    steps: [
      { action: '切换模型档位：M3' },
      { action: '点击【新建任务】' },
      { action: '清理输入区附件' },
      { action: '发送第一轮问题' },
      { action: '回复完成状态（第一轮问题）' },
    ],
    assertions: [{ name: '回复完成状态（第一轮问题）' }],
  });
  assert.equal(coverage.complete, false);
  assert.ok(coverage.missing_steps.some((item) => item.missing_semantic_markers.includes('stop_generation')));
});

test('enforced V4 numbered-step gap becomes an explicit blocked result with complete blocker evidence', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'qbot-v4-step-gap-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const caseDir = path.join(root, 'cases', 'USR-START-003');
  fs.mkdirSync(caseDir, { recursive: true });
  const caseReport = path.join(caseDir, 'case-report.md');
  fs.writeFileSync(caseReport, '# numbered step blocker\n');
  const state = {
    id: 'USR-START-003',
    kind: 'auth',
    contract_version: 'qbot-current-casebook/v4',
    required_evidence_roles: 'numbered_step_assertions,case_report',
    numbered_steps: '1. 退出当前账号\n2. 发起登录\n3. 核对工作台',
    status: 'passed',
    result_category: 'pass',
    actual_result: 'incorrect raw pass',
    conclusion: '通过',
    case_report: caseReport,
    artifacts: {},
    screenshots: {},
    steps: [{ action: '观察当前鉴权状态', status: 'passed' }],
    assertions: [{ name: '已处于登录后工作台', status: 'passed' }],
  };
  const coverage = enforceNumberedStepExecutionContract(state);
  assert.equal(coverage.complete, false);
  assert.equal(state.status, 'blocked');
  assert.equal(state.result_category, 'blocked');
  assert.equal(state.framework_issue.kind, 'numbered_step_execution_gap');
  const manifest = buildCaseEvidenceManifest(state, caseDir);
  assert.equal(manifest.complete, true);
  assert.equal(manifest.role_evidence.numbered_step_assertions.available, true);
  assert.equal(manifest.role_evidence.numbered_step_assertions.execution_complete, false);
  assert.equal(manifest.role_evidence.numbered_step_assertions.explicitly_blocked, true);
  assert.ok(manifest.role_evidence.numbered_step_assertions.missing_steps.length > 0);
});

test('unenforced V4 numbered-step gap cannot satisfy the manifest role', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'qbot-v4-unenforced-step-gap-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const caseDir = path.join(root, 'cases', 'USR-START-004');
  fs.mkdirSync(caseDir, { recursive: true });
  const manifest = buildCaseEvidenceManifest({
    id: 'USR-START-004',
    kind: 'auth',
    contract_version: 'qbot-current-casebook/v4',
    required_evidence_roles: 'numbered_step_assertions',
    numbered_steps: '1. 退出当前账号\n2. 取消登录\n3. 再次发起登录',
    status: 'passed',
    artifacts: {},
    screenshots: {},
    steps: [{ action: '观察当前鉴权状态', status: 'passed' }],
    assertions: [{ name: '已处于登录后工作台', status: 'passed' }],
  }, caseDir);
  assert.equal(manifest.complete, false);
  assert.deepEqual(manifest.missing_roles, ['numbered_step_assertions']);
});
