import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
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
  executionReleaseEnvironment,
  numberedStepExecutionCoverage,
  parseDeclaredNumberedSteps,
  recordNumberedStep,
  validateCompletedCaseEvidenceIntegrity,
  validateCasebookExecutorReadiness,
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

test('verified pre-send attachment rejection replaces impossible conversation roles with auditable evidence', () => {
  const legacyRoles = [
    'before_screenshot',
    'prompt',
    'send_receipt',
    'task_id',
    'transcript',
    'reply_delta',
    'reply_completion',
    'attachment_name_size_sha256',
    'composer_attachment_state',
    'attachment_readback',
  ];
  const applicability = resolveEvidenceRoleApplicability(
    { id: 'SIT-HOME-043', kind: 'attachment' },
    legacyRoles,
    {
      attachmentObserved: true,
      verifiedAttachmentPreSendRejection: true,
    },
  );
  assert.deepEqual(applicability.source_declared_roles, legacyRoles);
  assert.deepEqual(applicability.declared_roles, [
    ...legacyRoles,
    'attachment_limit_rejection',
    'no_task_no_send_state',
  ]);
  assert.deepEqual(applicability.required_roles, [
    'before_screenshot',
    'attachment_name_size_sha256',
    'composer_attachment_state',
    'attachment_limit_rejection',
    'no_task_no_send_state',
  ]);
  assert.deepEqual(
    applicability.not_applicable_roles.map((item) => item.role),
    [
      'prompt',
      'send_receipt',
      'task_id',
      'transcript',
      'reply_delta',
      'reply_completion',
      'attachment_readback',
    ],
  );
  assert.ok(applicability.not_applicable_roles.every(
    (item) => item.source === 'verified_runtime_rejection',
  ));
  assert.equal(applicability.pre_send_attachment_rejection.applicable, true);
});

test('legacy attachment limit manifest becomes complete only after strict pre-send rejection proof', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'qbot-attachment-limit-manifest-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const caseDir = path.join(root, 'cases', 'SIT-HOME-043');
  fs.mkdirSync(caseDir, { recursive: true });
  const before = path.join(caseDir, '01-before.png');
  const action = path.join(caseDir, '02-attachment-limit.png');
  const after = path.join(caseDir, '03-final.png');
  const caseReport = path.join(caseDir, 'case-report.md');
  const attachment = path.join(caseDir, 'oversized.pdf');
  fs.writeFileSync(before, 'composer-before-upload');
  fs.writeFileSync(action, 'visible-product-limit-rejection');
  fs.writeFileSync(after, 'composer-after-rejection');
  fs.writeFileSync(caseReport, '# attachment limit rejection\n');
  fs.writeFileSync(attachment, 'oversized attachment fixture');
  const attachmentSha256 = createHash('sha256').update(fs.readFileSync(attachment)).digest('hex');
  const legacyRoles = [
    'before_screenshot',
    'action_screenshot',
    'after_screenshot',
    'numbered_step_assertions',
    'first_divergence_evidence',
    'case_report',
    'public_state_readback',
    'prompt',
    'send_receipt',
    'task_id',
    'transcript',
    'reply_delta',
    'reply_completion',
    'attachment_name_size_sha256',
    'composer_attachment_state',
    'attachment_readback',
  ];
  const baseState = {
    id: 'SIT-HOME-043',
    kind: 'attachment',
    contract_version: PRODUCTION_CASEBOOK_CONTRACT_VERSION,
    required_evidence_roles: legacyRoles.join(','),
    status: 'passed',
    case_report: caseReport,
    screenshots: { before, attachment_limit: action, final: after },
    steps: [
      { action: '选择超限附件', status: 'passed' },
      { action: '核对产品限制提示', status: 'passed' },
      { action: '核对未创建任务且未发送消息', status: 'passed' },
    ],
    assertions: [
      { name: '产品显示附件大小限制提示', status: 'passed' },
      { name: '输入区未挂载附件', status: 'passed' },
      { name: '未创建任务且未发送消息', status: 'passed' },
    ],
    artifacts: {
      attachment_sources: [{
        path: attachment,
        name: path.basename(attachment),
        size_bytes: fs.statSync(attachment).size,
        sha256: attachmentSha256,
      }],
      composer_attachment_state: {
        source: 'visible_composer_attachment_state',
        rejected_before_attach: true,
      },
      attachment_limit_rejection: {
        expected_pattern_matched: true,
        product_rejected_before_send: true,
        evidence_screenshot: action,
      },
      no_task_no_send_state: {
        source: 'public_task_and_message_state_readback',
        task_state_unchanged: true,
        message_count_unchanged: true,
        no_task_created: true,
        no_message_sent: true,
        no_prompt_recorded: true,
      },
      numbered_step_coverage: {
        declared_count: 3,
        executor_step_count: 3,
        complete: true,
        enforced: true,
        missing_steps: [],
        entries: [],
      },
    },
  };
  const manifest = buildCaseEvidenceManifest(baseState, caseDir);
  assert.equal(manifest.complete, true);
  assert.deepEqual(manifest.missing_roles, []);
  assert.deepEqual(manifest.source_declared_required_roles, legacyRoles);
  assert.equal(manifest.source_declared_required_role_count, 16);
  assert.equal(manifest.declared_required_role_count, 18);
  assert.equal(manifest.required_role_count, 11);
  assert.equal(manifest.not_applicable_role_count, 7);
  assert.equal(manifest.role_evidence.prompt.not_applicable, true);
  assert.equal(manifest.role_evidence.send_receipt.not_applicable, true);
  assert.equal(manifest.role_evidence.reply_completion.not_applicable, true);
  assert.equal(manifest.role_evidence.attachment_readback.not_applicable, true);
  assert.equal(manifest.role_evidence.attachment_limit_rejection.available, true);
  assert.equal(manifest.role_evidence.no_task_no_send_state.available, true);
  assert.equal(manifest.evidence_applicability.pre_send_attachment_rejection.applicable, true);

  const failClosed = buildCaseEvidenceManifest({
    ...baseState,
    artifacts: {
      ...baseState.artifacts,
      no_task_no_send_state: {
        ...baseState.artifacts.no_task_no_send_state,
        no_message_sent: false,
      },
    },
  }, caseDir);
  assert.equal(failClosed.complete, false);
  assert.equal(failClosed.evidence_applicability.pre_send_attachment_rejection.applicable, false);
  assert.equal(failClosed.required_roles.includes('prompt'), true);
  assert.equal(failClosed.missing_roles.includes('prompt'), true);
  assert.equal(failClosed.declared_required_roles.includes('attachment_limit_rejection'), false);
  assert.equal(failClosed.role_evidence.prompt.not_applicable, undefined);
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

test('completed ledger evidence gate accepts only real, complete, hash-bound Case artifacts', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'qbot-completed-evidence-gate-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const caseDir = path.join(root, 'cases', 'CASE-EVIDENCE-001');
  fs.mkdirSync(caseDir, { recursive: true });
  const manifestFile = path.join(caseDir, 'case-evidence-manifest.json');
  fs.writeFileSync(manifestFile, `${JSON.stringify({
    complete: true,
    missing_roles: [],
  }, null, 2)}\n`);
  const result = {
    id: 'CASE-EVIDENCE-001',
    case_dir: caseDir,
    execution_provenance: 'executed',
    artifacts: { evidence_manifest: manifestFile },
    evidence_manifest: {
      complete: true,
      missing_roles: [],
      manifest_sha256: createHash('sha256').update(fs.readFileSync(manifestFile)).digest('hex'),
    },
  };
  fs.writeFileSync(path.join(caseDir, 'case-result.json'), `${JSON.stringify(result, null, 2)}\n`);

  assert.equal(validateCompletedCaseEvidenceIntegrity(result, {
    expectedCaseId: result.id,
    executionMode: 'unit-test',
  }).ok, true);

  const embeddedIncomplete = validateCompletedCaseEvidenceIntegrity({
    ...result,
    evidence_manifest: {
      ...result.evidence_manifest,
      complete: false,
      missing_roles: ['transcript'],
    },
  });
  assert.equal(embeddedIncomplete.ok, false);
  assert.ok(embeddedIncomplete.reasons.some((reason) => /case-result evidence_manifest 不完整/.test(reason)));

  const synthetic = validateCompletedCaseEvidenceIntegrity({
    ...result,
    synthetic: true,
    execution_provenance: 'synthetic',
  });
  assert.equal(synthetic.ok, false);
  assert.ok(synthetic.reasons.some((reason) => /synthetic 结果不得进入/.test(reason)));

  fs.writeFileSync(manifestFile, '{"complete":false,"missing_roles":["reply_delta"]}\n');
  const tampered = validateCompletedCaseEvidenceIntegrity(result);
  assert.equal(tampered.ok, false);
  assert.ok(tampered.reasons.some((reason) => /evidence manifest 不完整/.test(reason)));
  assert.ok(tampered.reasons.some((reason) => /SHA-256/.test(reason)));
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

test('V4 numbered-step coverage accepts only exact explicit per-step evidence', () => {
  const state = {
    id: 'USR-START-001',
    contract_version: 'qbot-current-casebook/v4',
    numbered_steps: '1. 点击新建任务\n2. 核对输入区为空',
    steps: [],
    assertions: [],
  };
  recordNumberedStep(
    state,
    1,
    '点击【新建任务】',
    '创建一个干净草稿。',
    '新草稿已显示。',
    'passed',
  );
  let coverage = numberedStepExecutionCoverage(state);
  assert.equal(coverage.complete, false);
  assert.equal(coverage.entries[0].evidence_mode, 'explicit_numbered_step');
  assert.equal(coverage.entries[0].covered, true);
  assert.equal(coverage.entries[1].covered, false);

  state.steps.push({
    action: '伪造第二步文字但声明不匹配',
    status: 'passed',
    numbered_step_number: 2,
    numbered_step_declared: '不同的声明步骤',
  });
  coverage = numberedStepExecutionCoverage(state);
  assert.equal(coverage.complete, false);
  assert.equal(coverage.entries[1].covered, false);

  recordNumberedStep(
    state,
    2,
    '回读 Composer 输入区',
    '输入区为空。',
    '输入区为空。',
    'passed',
  );
  coverage = numberedStepExecutionCoverage(state);
  assert.equal(coverage.complete, true);
  assert.equal(coverage.explicit_executor_step_count, 3);
});

test('production executor readiness fails closed on release drift, fixture mismatch, and missing V4 driver', () => {
  assert.deepEqual(
    executionReleaseEnvironment({
      controlPlaneUrl: 'https://qbot-api.360shuke.com',
      qworkUiUrl: 'file:///Users/test/.deepbank/ui/0.0.19/index.html',
    }),
    {
      environment: 'PROD',
      consistent: true,
      observations: [
        { source: 'qwork_ui', environment: 'PROD' },
        { source: 'control_plane', environment: 'PROD' },
      ],
    },
  );

  const readiness = validateCasebookExecutorReadiness([{
    id: 'USR-START-001',
    contract_version: 'qbot-current-casebook/v4',
    required_fixture: '外部DEV，已登录账号',
  }], {
    controlPlaneUrl: 'https://qbot-api.360shuke.com',
    qworkUiUrl: 'file:///Users/test/.deepbank/ui/0.0.19/index.html',
  });
  assert.equal(readiness.ok, false);
  assert.equal(readiness.testcase_issue_count, 1);
  assert.equal(readiness.testcase_issues[0].kind, 'fixture_environment_mismatch');
  assert.equal(readiness.framework_issue_count, 1);
  assert.equal(readiness.framework_issues[0].kind, 'explicit_v4_executor_missing');

  const drift = validateCasebookExecutorReadiness([{
    id: 'SIT-HOME-015',
    contract_version: PRODUCTION_CASEBOOK_CONTRACT_VERSION,
  }], {
    controlPlaneUrl: 'https://qbot-api.360shuke.com',
    qworkUiUrl: 'file:///Users/test/.deepbank-uat/ui/0.0.19/index.html',
  });
  assert.equal(drift.ok, false);
  assert.equal(drift.framework_issues[0].kind, 'release_environment_identity_drift');
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

test('enforced V2 numbered-step gap replaces automation_error with an auditable blocked result', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'qbot-v2-step-gap-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const caseDir = path.join(root, 'cases', 'SIT-INIT-004');
  fs.mkdirSync(caseDir, { recursive: true });
  const caseReport = path.join(caseDir, 'case-report.md');
  fs.writeFileSync(caseReport, '# numbered step blocker\n');
  const state = {
    id: 'SIT-INIT-004',
    kind: 'ui',
    contract_version: PRODUCTION_CASEBOOK_CONTRACT_VERSION,
    required_evidence_roles: 'numbered_step_assertions,case_report',
    numbered_steps: '1. 切换到离线环境\n2. 刷新工作台\n3. 核对发送门禁',
    status: 'failed',
    result_category: 'automation_error',
    actual_result: 'fixture preparation failed',
    conclusion: '失败：fixture preparation failed',
    case_report: caseReport,
    artifacts: {},
    screenshots: {},
    steps: [{ action: '观察当前运行环境', status: 'failed', category: 'automation_error' }],
    assertions: [{ name: '当前环境状态', status: 'failed', category: 'automation_error' }],
  };
  const coverage = enforceNumberedStepExecutionContract(state);
  assert.equal(coverage.complete, false);
  assert.equal(state.status, 'blocked');
  assert.equal(state.result_category, 'blocked');
  assert.equal(state.framework_issue.kind, 'numbered_step_execution_gap');
  assert.equal(state.artifacts.numbered_step_pre_enforcement_result.status, 'failed');
  assert.equal(state.artifacts.numbered_step_pre_enforcement_result.result_category, 'automation_error');
  assert.equal(state.artifacts.numbered_step_pre_enforcement_result.actual_result, 'fixture preparation failed');
  const manifest = buildCaseEvidenceManifest(state, caseDir);
  assert.equal(manifest.complete, true);
  assert.deepEqual(manifest.missing_roles, []);
  assert.equal(manifest.role_evidence.numbered_step_assertions.available, true);
  assert.equal(manifest.role_evidence.numbered_step_assertions.explicitly_blocked, true);
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

test('explicit numbered-step blocker keeps an unchanged after-action frame as diagnostic evidence', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'qbot-v4-blocked-action-frame-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const caseDir = path.join(root, 'cases', 'USR-EXPERT-003');
  fs.mkdirSync(caseDir, { recursive: true });
  const before = path.join(caseDir, '01-before.png');
  const action = path.join(caseDir, '02-after-action.png');
  const after = path.join(caseDir, '03-assertion.png');
  const caseReport = path.join(caseDir, 'case-report.md');
  fs.writeFileSync(before, 'unchanged-expert-page');
  fs.writeFileSync(action, 'unchanged-expert-page');
  fs.writeFileSync(after, 'unchanged-expert-page');
  fs.writeFileSync(caseReport, '# blocked diagnostic\n');
  const state = {
    id: 'USR-EXPERT-003',
    kind: 'ui',
    contract_version: 'qbot-current-casebook/v4',
    required_evidence_roles: 'before_screenshot,action_screenshot,after_screenshot,numbered_step_assertions,case_report',
    numbered_steps: '1. 输入不存在关键词\n2. 核对空结果\n3. 点击清空搜索',
    status: 'passed',
    result_category: 'pass',
    actual_result: 'incorrect raw pass',
    conclusion: '通过',
    case_report: caseReport,
    artifacts: {},
    screenshots: { before, after_action: action, final: after },
    steps: [{ action: '进入模块：专家与技能', status: 'passed' }],
    assertions: [{ name: '页面预期文案', status: 'failed' }],
  };
  enforceNumberedStepExecutionContract(state);
  const manifest = buildCaseEvidenceManifest(state, caseDir);
  assert.equal(state.status, 'blocked');
  assert.equal(manifest.complete, true);
  assert.equal(manifest.role_evidence.action_screenshot.available, true);
  assert.equal(manifest.role_evidence.action_screenshot.file, action);
});
