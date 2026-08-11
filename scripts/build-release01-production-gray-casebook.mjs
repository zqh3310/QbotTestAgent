#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { FileBlob, SpreadsheetFile, Workbook } from '@oai/artifact-tool';
import {
  CORE_BETA_SCENARIO_REGISTRY,
  FULL_FUNCTION_REGRESSION_LEGACY_CASE_IDS,
  PRODUCTION_GRAY_EXCLUDED_RARE_CASE_IDS,
  PRODUCTION_GRAY_PROMOTED_LEGACY_CASE_IDS,
} from '../src/lib/core-beta-case-protocol.mjs';
import { coreBetaRuntimeExecutorBinding } from '../src/lib/ui-agent-casebook-runner-v2.mjs';
import { migrateProductionCase } from '../src/lib/production-casebook-contract.mjs';

const ROOT = path.resolve(process.env.QBOT_CASEBOOK_ROOT || path.resolve(import.meta.dirname, '..'));
const DEEPBANK = '/Users/qifu/Documents/deepbankV2';
const SOURCE = path.join(ROOT, 'PRD', 'QBot完整生产灰度门禁Casebook_184条_2026-08-03.xlsx');
const LEGACY_SOURCE_JSON = path.join(ROOT, 'PRD', 'QBot核心上线门禁用例_Teams-QWork_2026-07-22_框架修复版.json');
const LEGACY_SUPPLEMENT_XLSX = path.join(ROOT, 'PRD', 'QBot系统SIT自动化测试用例_框架清零版_2026-07-11.xlsx');
const PRODUCT_COMMIT = '686b862ea9553215c2563d87db8339096acecb9d';
const PREVIOUS_PRODUCT_COMMIT = '5f3f99b1dd24e04f36715ea236a3f70b132d25c7';
const PRODUCT_REF = 'origin/release/0.1';
const PRODUCT_VERSION = '0.1.1';
const MR_WINDOW_START = '2026-08-03T00:00:00+08:00';
const MR_WINDOW_END = '2026-08-12T00:00:00+08:00';
const OUTPUT_NAME = 'QBot生产灰度与全量功能回归Casebook_160条_2026-08-11.xlsx';
const DEFAULT_OUTPUT_DIR = path.join(ROOT, 'outputs', '20260811_release01_combined160_casebook');
const FORMAL_OUTPUT = path.join(ROOT, 'PRD', OUTPUT_NAME);
const LOCAL_FIXTURE_ADAPTERS = new Set([
  'native_ime_input',
  'managed_teams_restart',
  'managed_runtime_restart',
]);
const EXCLUDED_ACCOUNT_CASES = new Set(['BETA-EXPERT-011', 'BETA-EXPERT-013', 'BETA-AUTH-006']);
const REPLACED_CASES = new Set(['BETA-TASK-008', 'BETA-ROUTE-001']);
const FULL_REGRESSION_EXCLUDED_LEGACY_IDS = new Set([
  'SIT-HOME-025',
  'SIT-TASK-RECOVER-001',
  'SIT-ISSUE-800',
  'SIT-CONN-008',
  'SIT-TEAMS-DOC-001',
  'SIT-RUNTIME-RECOVER-001',
  'SIT-FILE-NEW-001',
]);
const FULL_REGRESSION_SUPPLEMENTAL_LEGACY_IDS = new Set([
  'SIT-HOME-027',
  'SIT-HOME-047',
  'SIT-HOME-052',
  'SIT-HOME-028',
  'SIT-HOME-046',
  'SIT-HOME-051',
  'SIT-CONN-005',
  'SIT-HOME-048',
]);
const CORE_BETA_BASE_EVIDENCE_ROLES = Object.freeze([
  'before_screenshot',
  'action_receipt',
  'after_screenshot',
  'public_state_readback',
  'cleanup_readback',
  'product_action_trace',
]);
const CONVERSATION_EVIDENCE_ROLES = Object.freeze([
  'task_id',
  'prompt',
  'send_receipt',
  'transcript',
  'reply_delta',
  'reply_completion',
]);

function option(name, fallback = '') {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? String(process.argv[index + 1] || '') : fallback;
}

function git(args) {
  return execFileSync('git', args, { cwd: DEEPBANK, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 }).trim();
}

function asString(value) {
  return value == null ? '' : String(value);
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function json(value) {
  return JSON.stringify(value);
}

function parseJson(value, fallback) {
  try { return JSON.parse(asString(value)); } catch { return fallback; }
}

function sourceCases(values) {
  const headers = values[3].map(asString);
  const index = new Map(headers.map((header, column) => [header, column]));
  const rows = values.slice(4).filter((row) => asString(row[index.get('用例ID')]).trim());
  return {
    headers,
    cases: rows.map((row) => Object.fromEntries(headers.map((header, column) => [header, row[column] ?? '']))),
  };
}

function matrix(headers, rows) {
  return rows.map((row) => headers.map((header) => row[header] ?? ''));
}

function capability(testCase) {
  const id = asString(testCase['用例ID']);
  const scenario = CORE_BETA_SCENARIO_REGISTRY.get(id);
  const binding = coreBetaRuntimeExecutorBinding({ id, case_type: asString(testCase['用例类型']) }, scenario);
  const publicState = scenario?.fixture_control === 'public_product_state';
  const localOption = binding.mode === 'native' && LOCAL_FIXTURE_ADAPTERS.has(scenario?.fixture_control);
  const directlyRunnable = binding.mode === 'verified_legacy' || (binding.mode === 'native' && (publicState || localOption));
  return {
    scenario,
    binding,
    directlyRunnable,
    class: binding.mode === 'verified_legacy'
      ? 'runner_legacy_verified'
      : localOption
        ? 'runner_native_with_fixture_option'
        : publicState && binding.mode === 'native'
          ? 'runner_native'
          : 'strict_controller_required',
  };
}

function patchBaseline(testCase) {
  const next = { ...testCase };
  for (const [key, value] of Object.entries(next)) {
    if (typeof value !== 'string') continue;
    next[key] = value
      .replace(/origin\/release\/0\.1@[0-9a-f]{7,40}/g, `${PRODUCT_REF}@${PRODUCT_COMMIT}`)
      .replace(/QWork>=0\.0\.28/g, 'QWork>=0.1.1')
      .replace(/QWork>=0\.1\.1-rc\.2/g, 'QWork>=0.1.1')
      .replace(/Teams>=5\.2\.29/g, 'Teams>=5.3.0');
  }
  next['备注'] = `${asString(next['备注']).replace(/；?origin\/release\/0\.1@[0-9a-f]{7,40}。?/g, '').trim()}；基线${PRODUCT_REF}@${PRODUCT_COMMIT}，版本${PRODUCT_VERSION}。`
    .replace(/^；/, '');
  return next;
}

function actionPlan(id, caseType, steps) {
  const executor = CORE_BETA_SCENARIO_REGISTRY.get(id).executor_route;
  return [
    {
      number: 1,
      action_id: `${id.toLowerCase()}-prepare`,
      operation: 'prepare',
      target: `${id}:prepare`,
      declared_step: `建立干净任务、固定发布身份并准备场景：${steps.split('\n')[0]}`,
      command: `prepare_${caseType}`,
      executor,
      expected_state: '页面、账号、发布身份、fixture与串行策略ready',
      evidence_roles: ['before_screenshot', 'action_receipt', 'after_screenshot'],
      assertions: [{ id: 'page-ready', path: 'state.page.body_text_length', operator: 'gte', expected: 1 }],
    },
    {
      number: 2,
      action_id: `${id.toLowerCase()}-execute`,
      operation: 'execute',
      target: `${id}:execute`,
      declared_step: steps,
      command: `execute_${caseType}`,
      executor,
      expected_state: '专项原生执行器完成全部真实UI动作并生成机器读回',
      evidence_roles: ['before_screenshot', 'action_receipt', 'after_screenshot'],
      assertions: [{ id: 'observable-assertion', path: 'receipt.assertion_count', operator: 'gte', expected: 1 }],
    },
    {
      number: 3,
      action_id: `${id.toLowerCase()}-verify`,
      operation: 'verify',
      target: `${id}:verify`,
      declared_step: '核对专项Oracle、任务/会话归属、证据完整性和清理读回。',
      command: `verify_${caseType}`,
      executor,
      expected_state: '专项精准断言无失败且必需证据可生成不可变manifest',
      evidence_roles: ['before_screenshot', 'action_receipt', 'after_screenshot'],
      assertions: [
        { id: 'no-step-failure', path: 'receipt.step_failures', operator: 'equals', expected: 0 },
        { id: 'no-assertion-failure', path: 'receipt.assertion_failures', operator: 'equals', expected: 0 },
      ],
    },
  ];
}

function assertions(hardOracles, passRule) {
  return {
    pass_rule: passRule,
    fail_rule: '产品公开状态违背业务Oracle记trusted_bug；执行、取证、关联或清理缺失记framework_issue；禁止用raw结果直接放行。',
    block_rule: '仅发布身份漂移、登录/权限或声明的真实运行资源不可用时阻塞；产品能力不足不得伪装为环境阻塞。',
    hard_oracles: hardOracles,
    text_only_capability_claim_forbidden: true,
    machine_assertions: [
      { id: 'evidence-complete', path: 'evidence.complete', operator: 'equals', expected: true },
      { id: 'no-step-failure', path: 'result.step_failures', operator: 'equals', expected: 0 },
      { id: 'no-assertion-failure', path: 'result.assertion_failures', operator: 'equals', expected: 0 },
    ],
  };
}

function inferLegacyKind(source) {
  const runner = asString(source.runner).toLowerCase();
  if (runner.includes('attachment')) return 'attachment';
  if (runner.includes('auth')) return 'auth';
  if (runner.includes('conversation')) return 'conversation';
  return 'ui';
}

function legacyCaseType(source) {
  const id = asString(source.id);
  const text = `${source.steps || ''}\n${source.scenario || ''}`;
  const hasConversation = /发送|回复|对话|追问|生成|调用|召唤.*任务/.test(text)
    && /conversation|attachment/.test(asString(source.runner).toLowerCase());
  if (/^SIT-INIT-/.test(id)) return 'run_initialization';
  if (/^SIT-AUTH-/.test(id)) return 'auth_recovery';
  if (/^SIT-(?:TEAMS-NEW|RUNTIME-RECOVER)-/.test(id)) return 'recovery';
  if (id === 'SIT-ISSUE-793') return 'performance_capacity';
  if (/^SIT-TASK-/.test(id)) return 'task_lifecycle';
  if (/^SIT-ART-|^SIT-FILE-NEW-/.test(id)) return 'artifact';
  if (id === 'SIT-KNOWLEDGE-001') return 'knowledge_lifecycle';
  if (id === 'SIT-MEM-001') return 'memory_lifecycle';
  if (id === 'SIT-WORKSPACE-001') return 'security_privacy';
  if (id === 'SIT-HOME-056') return 'attachment';
  if (/^SIT-(?:HOME|SKILL|CONN|EXPERT)-/.test(id) && hasConversation) return 'conversation';
  if (id === 'SIT-HITL-002') return 'conversation';
  return 'settings_lifecycle';
}

function legacyCoreDomain(source, caseType) {
  if (/^SIT-AUTH-/.test(source.id)) return '登录与会话';
  if (/^SIT-(?:TEAMS|RUNTIME)-/.test(source.id)) return '宿主恢复';
  if (/^SIT-ART-|^SIT-FILE/.test(source.id)) return '成果与文件';
  if (/^SIT-SKILL-/.test(source.id)) return 'Skill';
  if (/^SIT-EXPERT-/.test(source.id)) return '专家';
  if (/^SIT-CONN-/.test(source.id)) return 'MCP与连接器';
  if (/^SIT-HOME-/.test(source.id)) return '任务与会话';
  if (caseType === 'knowledge_lifecycle') return '知识';
  if (caseType === 'memory_lifecycle') return '记忆';
  return asString(source.module) || '全量功能';
}

function legacyConversationPrompt(source) {
  const value = asString(source.test_data).trim();
  if (value) return value;
  return `执行 ${source.id}：${asString(source.scenario)}`;
}

function fullFunctionLegacyCase(source) {
  const migrated = migrateProductionCase({
    ...source,
    kind: source.kind || inferLegacyKind(source),
    pipeline_policy: source.pipeline_policy || source.pipeline_strategy || 'serial',
    second_review_required: source.second_review_required || source.review_requirement || '是',
  });
  if (['SIT-INIT-002', 'SIT-INIT-004'].includes(asString(migrated.id))) {
    migrated.precondition = 'QBot使用待发布Teams/QWork包启动；网络正常；测试账号已登录；自动化记录进程日志、页面截图和运行时公开状态。';
  }
  if (asString(migrated.id) === 'SIT-INIT-009') {
    migrated.test_data = '在正常网络与当前待发布runtime状态下点击检查更新，核对处理中和最终完成反馈。';
  }
  if (['SIT-AUTH-001', 'SIT-AUTH-003', 'SIT-AUTH-005'].includes(asString(migrated.id))) {
    migrated.test_data = 'dev/UAT有效测试账号；网络正常；使用当前已冻结的Lingxi OAuth配置和本轮浏览器会话。';
  }
  if (asString(migrated.id) === 'SIT-CONN-003') {
    migrated.test_data = '准备至少一个健康可选择连接器；核对自动/手动选择、chip状态与移除读回。';
  }
  if (asString(migrated.id) === 'SIT-CONN-009') {
    migrated.precondition = 'QBot使用待发布Teams/QWork包启动并已登录；框架准备一个公开状态为needs_auth的测试连接器。';
  }
  const id = asString(migrated.id);
  const caseType = legacyCaseType(migrated);
  const conversationRequired = [
    'conversation',
    'attachment',
    'artifact',
    'task_lifecycle',
    'knowledge_lifecycle',
    'memory_lifecycle',
    'security_privacy',
    'performance_capacity',
  ].includes(caseType);
  const evidenceRoles = [...CORE_BETA_BASE_EVIDENCE_ROLES];
  if (conversationRequired) evidenceRoles.push(...CONVERSATION_EVIDENCE_ROLES);
  if (caseType === 'attachment') {
    evidenceRoles.push('attachment_name_size_sha256', 'composer_attachment_state', 'attachment_readback');
  }
  const capabilityConversation = caseType === 'conversation'
    && /^SIT-(?:SKILL|CONN|EXPERT)-/.test(id);
  if (capabilityConversation) evidenceRoles.push('capability_selection', 'capability_execution_event');
  const roles = unique(evidenceRoles);
  const turns = conversationRequired
    ? [{ turn: 1, prompt: legacyConversationPrompt(migrated), oracle: asString(migrated.success_criteria || migrated.expected_result) }]
    : [];
  const route = CORE_BETA_SCENARIO_REGISTRY.get(id)?.executor_route || '';
  if (!route) throw new Error(`${id} 缺少全量功能回归执行器注册`);
  const steps = asString(migrated.steps);
  const hardOracles = unique([
    asString(migrated.expected_result),
    asString(migrated.success_criteria),
  ]);
  return {
    '用例ID': id,
    '产品模块': asString(migrated.module),
    '子功能': asString(migrated.submodule),
    '核心域': legacyCoreDomain(migrated, caseType),
    '优先级': asString(migrated.priority || 'P1'),
    '用例类型': caseType,
    '测试场景': asString(migrated.scenario),
    '用户旅程': asString(migrated.user_journey || `${migrated.module} → ${migrated.submodule} → 结果复核`),
    '前置条件': patchBaseline({ '前置条件': asString(migrated.precondition), '备注': '' })['前置条件'],
    '测试数据': asString(migrated.test_data),
    '自动化执行步骤': steps,
    '预期结果': asString(migrated.expected_result),
    '成功判定': asString(migrated.success_criteria),
    '失败/阻塞判定': `${asString(migrated.failure_criteria)}\n产品Oracle失败记trusted_bug；执行、取证、关联或清理缺失记framework_issue。`,
    '证据要求': roles.join(','),
    '流水线策略': 'serial',
    '批次大小': 1,
    '初始化策略': 'case_clean_only',
    '清理策略': '仅清理本Case创建的QA资源、关闭浮层并恢复空能力选择；不得删除用户真实数据。',
    '契约版本': 'qbot-core-beta/v2',
    '自动化协议': 'core-beta-action-plan/v2',
    '动作计划JSON': json(actionPlan(id, caseType, steps)),
    '会话轮次JSON': json(turns),
    '能力抽样策略JSON': '',
    '精准断言JSON': json(assertions(hardOracles, asString(migrated.success_criteria || migrated.expected_result))),
    '证据角色': roles.join(','),
    '证据Schema版本': 'qbot-core-evidence/v2',
    '自动化Runner': 'core-beta-v2/verified-legacy',
    '每轮必跑': '是',
    '来源ID': asString(migrated.source_id),
    '来源类型': `${asString(migrated.source_type)}；最新${PRODUCT_REF}@${PRODUCT_COMMIT}源码复核`,
    '备注': `全量正常功能增量；legacy executor=${id}；不属于网络异常、切换账号、受保护部署或纯故障矩阵。`,
    '风险域': 'functional,reliability_recovery,security_privacy,data_integrity_isolation',
    '判定Oracle': asString(migrated.oracle_type || 'visible_action+public_state+business_oracle'),
    '确定性': '是',
    '重复策略': '每个候选release identity至少完成1轮160/160可信全绿；本轮中的70条硬门禁同时计入连续5轮要求。',
    '必需Fixture': 'runtime:ready,account:authenticated,public_product_state',
    '硬门禁': '是',
    '版本范围': `${PRODUCT_REF}@${PRODUCT_COMMIT};Teams>=5.3.0;QWork>=0.1.1`,
    '生产观测指标': asString(migrated.production_signal || `${migrated.module}/${migrated.submodule}成功率`),
    'Executor路由': route,
  };
}

function englishLegacyCaseFromChinese(row) {
  return {
    id: asString(row['用例ID']),
    priority: asString(row['优先级']),
    module: asString(row['产品模块']),
    submodule: asString(row['子功能']),
    scenario: asString(row['测试场景']),
    precondition: asString(row['前置条件']),
    test_data: asString(row['测试数据']),
    selectors: asString(row['执行入口/Selector']),
    steps: asString(row['执行步骤'] || row['自动化执行步骤']),
    expected_result: asString(row['预期结果']),
    success_criteria: asString(row['成功判定']),
    failure_criteria: asString(row['失败判定'] || row['失败/阻塞判定']),
    evidence_required: asString(row['证据要求']),
    runner: asString(row['自动化Runner']),
    execution_level: asString(row['执行层级']),
    mandatory: asString(row['每轮必跑']),
    source_id: asString(row['来源ID']),
    source_type: asString(row['来源类型']),
    note: asString(row['备注']),
    user_journey: asString(row['用户旅程']),
  };
}

function rowsFromSupplementWorkbook(workbook) {
  const result = [];
  for (let index = 0; ; index += 1) {
    let sheet;
    try { sheet = workbook.worksheets.getItemAt(index); } catch { break; }
    if (!sheet) break;
    const values = sheet.getUsedRange()?.values || [];
    const headerIndex = values.findIndex((row) => row.map(asString).includes('用例ID'));
    if (headerIndex < 0) continue;
    const headers = values[headerIndex].map(asString);
    for (const valuesRow of values.slice(headerIndex + 1)) {
      const row = Object.fromEntries(headers.map((header, column) => [header, valuesRow[column] ?? '']));
      if (asString(row['用例ID'])) result.push(englishLegacyCaseFromChinese(row));
    }
  }
  return result;
}

async function loadFullFunctionLegacyCases() {
  const source = JSON.parse(await fs.readFile(LEGACY_SOURCE_JSON, 'utf8')).cases || [];
  const supplementalWorkbook = await SpreadsheetFile.importXlsx(await FileBlob.load(LEGACY_SUPPLEMENT_XLSX));
  const supplemental = rowsFromSupplementWorkbook(supplementalWorkbook);
  const sourceById = new Map([...source, ...supplemental].map((item) => [asString(item.id), item]));
  const selectedIds = [...FULL_FUNCTION_REGRESSION_LEGACY_CASE_IDS];
  if (selectedIds.some((id) => FULL_REGRESSION_EXCLUDED_LEGACY_IDS.has(id))) {
    throw new Error('全量功能回归注册表包含已删除的低频/故障场景');
  }
  if ([...FULL_REGRESSION_SUPPLEMENTAL_LEGACY_IDS].some((id) => !selectedIds.includes(id))) {
    throw new Error('全量功能回归缺少补充正常功能Case');
  }
  const missing = selectedIds.filter((id) => !sourceById.has(id));
  if (missing.length) throw new Error(`全量功能回归源数据缺失：${missing.join(',')}`);
  return selectedIds.map((id) => fullFunctionLegacyCase(sourceById.get(id)));
}

function patchRecentCases(testCase) {
  const id = asString(testCase['用例ID']);
  const next = patchBaseline(testCase);
  if (id === 'BETA-EXPERT-008') {
    const turns = parseJson(next['会话轮次JSON'], []);
    next['测试数据'] = '固定研究主题：截至2026-08-10，比较 OpenAI Responses API 与 Chat Completions API；至少两个可打开的 OpenAI 官方来源。';
    if (turns[0]) turns[0].prompt = '检索至少两个 OpenAI 官方来源，说明截至2026-08-10 Responses API 与 Chat Completions API 的官方定位、主要能力差异和迁移建议。';
    next['会话轮次JSON'] = json(turns);
  }
  if (id === 'BETA-EXPERT-007') {
    next['测试场景'] = '串行发布本轮研究、数据、交付三类专家草稿，验证每类唯一operation、active release和suite ledger闭环';
    next['用户旅程'] = '本轮三类草稿 → 逐项发布 → 等待终态 → 写入本轮专家账本';
    next['前置条件'] = 'BETA-EXPERT-002/003/004已创建本轮研究、数据、交付三类草稿；使用当前单一测试账号。';
    next['测试数据'] = '三个本轮draftId/etag；三个唯一幂等键；仅使用本轮单账号正常发布链路，不引入历史专家或特殊授权。';
    next['自动化执行步骤'] = '1. 读取三类本轮草稿身份\n2. 逐项发起发布并等待completed\n3. 读回三个active expert/release并写入published_research/data/delivery';
    next['预期结果'] = '三类草稿各自产生唯一发布operation和active expert；后续专家Case只消费本轮账本。';
    next['成功判定'] = 'operation=3且全部completed；expertId/releaseId完整；三类ledger key完整；无半版本、重复发布或历史复用。';
    next['失败/阻塞判定'] = '任一发布失败、半状态、重复或账本缺失记trusted_bug/framework_issue；不得因缺少非必要外部命令阻塞。';
    next['必需Fixture'] = 'runtime:ready,account:authenticated,run_owned_expert_drafts:3';
    next['来源ID'] = 'MR!972,MR!943,MR!1065';
    next['来源类型'] = '近7天MR回归+自包含门禁重构';
    next['证据要求'] = 'before_screenshot,action_receipt,after_screenshot,public_state_readback,expert_identity_snapshot,expert_publish_operation,restart_trace,credential_redaction_scan,capability_selection,capability_execution_event,cleanup_readback';
    next['证据角色'] = next['证据要求'];
    next['动作计划JSON'] = json(actionPlan(id, 'expert_lifecycle', next['自动化执行步骤']));
    next['精准断言JSON'] = json(assertions(
      ['研究/数据/交付三个唯一发布operation全部completed', '三个active expert写入本轮suite ledger', '无历史复用、半版本或重复发布'],
      '三个本轮草稿的发布动作、终态、active release和账本身份全部闭环。',
    ));
  }
  if (id === 'BETA-EXPERT-001') {
    next['测试场景'] = '专家中心分区、搜索、详情、召唤与“发布记录仅显示本人创建专家”管理面投影';
    next['自动化执行步骤'] = '1. 读取expertLifecycle完整列表和owned=true集合\n2. 打开发布记录并核对计数/可见ID严格等于owned集合\n3. 搜索本轮已发布专家、打开详情并召唤，读回exact expertId';
    next['预期结果'] = '共享/内置专家只出现在专家中心对应分组，不进入发布记录；本人专家可搜索、查看和召唤。';
    next['成功判定'] = '发布记录计数与可见ID严格等于owned=true集合；搜索命中；setExpert后公开状态读回exact expertId。';
    next['来源ID'] = `${asString(next['来源ID'])},MR!1065`.replace(/^,/, '');
    next['证据要求'] = `${asString(next['证据要求'])},product_state_diff`;
    next['证据角色'] = `${asString(next['证据角色'])},product_state_diff`;
    const precise = parseJson(next['精准断言JSON'], {});
    precise.hard_oracles = unique([...(precise.hard_oracles || []), '发布记录可见ID与owned=true集合完全一致']);
    next['精准断言JSON'] = json(precise);
  }
  if (id === 'BETA-ART-001') {
    next['测试场景'] = '生成Markdown与交互HTML成果，核对文件内容、网页预览、分享入口和宿主安全隔离';
    next['预期结果'] = 'Markdown源码可读；HTML在QWork受管网页预览中打开，分享按钮可用并出现分享对话框；脚本不在宿主DOM执行。';
    next['成功判定'] = '文件SHA/内容有效；HTML网页预览内容可见；分享入口enabled且对话框无错误；宿主无dialog/script污染。';
    next['来源ID'] = `${asString(next['来源ID'])},MR!1039,MR!1045`.replace(/^,/, '');
  }
  if (id === 'BETA-TASK-008') {
    const steps = '1. 在同一新任务依次发送两个唯一输入并等待接受\n2. 输入未发送草稿并把光标置于首行起点；第一次物理ArrowUp只建立边界握手且草稿不变，第二次才回放最新输入，随后Up/Down核对新到旧与草稿恢复\n3. 新建任务用两次物理ArrowUp核对历史隔离，再重开原task并用两次物理ArrowUp核对最新输入持久化';
    const roles = ['before_screenshot', 'action_receipt', 'after_screenshot', 'public_state_readback', 'task_id', 'prompt', 'send_receipt', 'transcript', 'reply_delta', 'reply_completion', 'product_action_trace', 'data_integrity_readback', 'cleanup_readback'];
    Object.assign(next, {
      '产品模块': '任务与会话',
      '子功能': 'Composer历史输入',
      '核心域': '任务生命周期',
      '优先级': 'P0',
      '用例类型': 'task_lifecycle',
      '测试场景': 'Composer通过两阶段物理方向键边界握手进入当前会话历史，恢复未发送草稿，并保持任务隔离与重开持久化',
      '用户旅程': '发送两轮 → 输入草稿 → 首次方向键握手 → 第二次进入历史 → Up/Down浏览 → 新任务隔离 → 重开原任务',
      '前置条件': '运行时ready；当前账号已登录；从干净新任务开始；Composer无附件、Skill、Expert、MCP残留。',
      '测试数据': 'QBOT-HISTORY-FIRST、QBOT-HISTORY-SECOND、QBOT-HISTORY-DRAFT-NOT-SENT；均绑定本轮taskId。',
      '自动化执行步骤': steps,
      '预期结果': '空闲态第一次同向物理方向键只确认外边界，第二次才进入历史；浏览态Up按新到旧、Down按旧到新并恢复原草稿；新任务无历史；重开原task后历史仍在。',
      '成功判定': '三处边界握手读回符合预期，六个历史导航读回逐字一致；原taskId非空；新任务为activeId为空、messageCount=0的独立草稿且两次ArrowUp均为空；重开原task第二次ArrowUp等于第二条输入。',
      '失败/阻塞判定': '第一次方向键直接进入历史、第二次仍不进入、顺序错误、草稿丢失、跨任务泄漏或重开丢历史记trusted_bug；读回/截图/任务关联缺失记framework_issue。',
      '证据要求': roles.join(','),
      '流水线策略': 'serial',
      '批次大小': 1,
      '初始化策略': 'run_full_reset_then_case_clean',
      '清理策略': '关闭浮层并清空当前任务能力选择；保留两taskId与历史读回；不发送未提交草稿。',
      '契约版本': 'qbot-core-beta/v2',
      '自动化协议': 'core-beta-action-plan/v2',
      '动作计划JSON': json(actionPlan(id, 'task_lifecycle', steps)),
      '会话轮次JSON': json([
        { turn: 1, prompt: 'QBOT-HISTORY-FIRST：只回复 FIRST-ACCEPTED。', oracle: '回复完整且输入被当前task接受' },
        { turn: 2, prompt: 'QBOT-HISTORY-SECOND：只回复 SECOND-ACCEPTED。', oracle: '回复完整且输入被当前task接受' },
      ]),
      '能力抽样策略JSON': '',
      '精准断言JSON': json(assertions(
        ['空闲态第一次物理ArrowUp只建立边界握手且输入不变', '第二次ArrowUp进入历史且Up顺序为SECOND→FIRST', 'Down顺序为SECOND→未发送草稿', '新任务两次ArrowUp均为空且重开原task第二次ArrowUp保留最新历史'],
        '两阶段物理方向键握手、当前会话已接受输入顺序、草稿恢复、任务隔离和持久化同时成立。',
      )),
      '证据角色': roles.join(','),
      '证据Schema版本': 'qbot-core-evidence/v2',
      '自动化Runner': 'core-beta-v2',
      '每轮必跑': '是',
      '来源ID': 'MR!1063,MR!1087',
      '来源类型': '近7天MR新增原生回归',
      '备注': `Composer history navigation；${PRODUCT_REF}@${PRODUCT_COMMIT}。`,
      '风险域': 'functional,data_integrity_isolation,reliability_recovery',
      '判定Oracle': 'task_bound_history_readback+draft_restore',
      '确定性': '是',
      '重复策略': '同一冻结发布身份连续5个全量轮次；任一非pass、阻塞、波动、继承/synthetic或证据缺失都会把连续全绿计数归零',
      '必需Fixture': 'runtime:ready,account:authenticated,composer:clean',
      '硬门禁': '是',
      '版本范围': `${PRODUCT_REF}@${PRODUCT_COMMIT};Teams>=5.3.0;QWork>=0.1.1`,
      '生产观测指标': '历史回放顺序、草稿恢复率、跨任务泄漏数、重开持久化率',
      'Executor路由': CORE_BETA_SCENARIO_REGISTRY.get(id).executor_route,
    });
  }
  if (id === 'BETA-ROUTE-001') {
    const steps = '1. 新建干净任务并读回当前runtimeFamily与connection view\n2. 打开模型菜单并等待同步终态\n3. 比对菜单候选与当前SDK允许的runtimeFamily/protocol/disabled过滤结果';
    const roles = ['before_screenshot', 'action_receipt', 'after_screenshot', 'public_state_readback', 'model_route_trace', 'cleanup_readback'];
    Object.assign(next, {
      '产品模块': '模型与路由',
      '子功能': '模型菜单SDK过滤',
      '核心域': 'Auto模型路由',
      '优先级': 'P0',
      '用例类型': 'model_routing',
      '测试场景': 'Composer模型菜单只展示当前SDK/runtimeFamily可执行且协议匹配的模型候选',
      '用户旅程': '新建任务 → 读取当前SDK → 打开模型菜单 → 核对候选',
      '前置条件': '运行时ready；当前账号已登录；connection view至少有一个当前SDK可用模型。',
      '测试数据': 'Claude Code允许anthropic；Codex允许response；disabled、其他runtimeFamily和其他协议作为负向集合。',
      '自动化执行步骤': steps,
      '预期结果': '菜单候选多重集合严格等于当前SDK允许集合；无同步错误；档位仅M1-M4。',
      '成功判定': 'expected/rendered modelId多重集合一致；Claude/Codex协议映射正确；无其他SDK候选泄漏。',
      '失败/阻塞判定': '错误候选、漏候选或跨SDK泄漏记trusted_bug；connection view/DOM证据缺失记framework_issue。',
      '证据要求': roles.join(','),
      '流水线策略': 'serial',
      '批次大小': 1,
      '初始化策略': 'run_full_reset_then_case_clean',
      '清理策略': '只读打开并关闭模型菜单，不修改当前模型选择；保留脱敏model route trace。',
      '契约版本': 'qbot-core-beta/v2',
      '自动化协议': 'core-beta-action-plan/v2',
      '动作计划JSON': json(actionPlan(id, 'model_routing', steps)),
      '会话轮次JSON': '[]',
      '能力抽样策略JSON': '',
      '精准断言JSON': json(assertions(
        ['Claude Code仅anthropic候选', 'Codex仅response候选', '菜单候选与当前SDK可用集合完全一致'],
        'connection view与可见菜单按当前SDK过滤后的模型多重集合完全一致。',
      )),
      '证据角色': roles.join(','),
      '证据Schema版本': 'qbot-core-evidence/v2',
      '自动化Runner': 'core-beta-v2',
      '每轮必跑': '是',
      '来源ID': 'MR!1028',
      '来源类型': '近7天MR新增原生回归',
      '备注': `Composer model menu SDK filter；${PRODUCT_REF}@${PRODUCT_COMMIT}。`,
      '风险域': 'functional,compatibility_upgrade,data_integrity_isolation',
      '判定Oracle': 'connection_view+visible_model_multiset',
      '确定性': '是',
      '重复策略': '同一冻结发布身份连续5个全量轮次；任一非pass、阻塞、波动、继承/synthetic或证据缺失都会把连续全绿计数归零',
      '必需Fixture': 'runtime:ready,account:authenticated,model_options:min1',
      '硬门禁': '是',
      '版本范围': `${PRODUCT_REF}@${PRODUCT_COMMIT};Teams>=5.3.0;QWork>=0.1.1`,
      '生产观测指标': '候选集合一致率、跨SDK泄漏数、同步错误数',
      'Executor路由': CORE_BETA_SCENARIO_REGISTRY.get(id).executor_route,
    });
  }
  return next;
}

function orderCases(cases) {
  const expertOrder = [
    'BETA-EXPERT-002', 'BETA-EXPERT-003', 'BETA-EXPERT-004', 'BETA-EXPERT-005',
    'BETA-EXPERT-007', 'BETA-EXPERT-001', 'BETA-EXPERT-008', 'BETA-EXPERT-009',
    'BETA-EXPERT-010', 'BETA-EXPERT-012', 'BETA-EXPERT-014', 'BETA-EXPERT-015',
    'BETA-EXPERT-016',
  ];
  const expertRank = new Map(expertOrder.map((id, index) => [id, index]));
  const sourceRank = new Map(cases.map((item, index) => [asString(item['用例ID']), index]));
  return [...cases].sort((left, right) => {
    const leftId = asString(left['用例ID']);
    const rightId = asString(right['用例ID']);
    if (expertRank.has(leftId) && expertRank.has(rightId)) return expertRank.get(leftId) - expertRank.get(rightId);
    return sourceRank.get(leftId) - sourceRank.get(rightId);
  });
}

function mergedMrs() {
  const format = '%H%x1f%aI%x1f%s%x1f%B%x1e';
  const raw = git(['log', `${PREVIOUS_PRODUCT_COMMIT}..${PRODUCT_COMMIT}`, '--first-parent', '--merges', `--since=${MR_WINDOW_START}`, `--until=${MR_WINDOW_END}`, `--pretty=format:${format}`]);
  return raw.split('\x1e').map((record) => record.trim()).filter(Boolean).map((record) => {
    const [commit, mergedAt, subject, ...bodyParts] = record.split('\x1f');
    const body = bodyParts.join('\x1f');
    const mr = body.match(/!([0-9]+)/)?.[1] || '';
    const branch = subject.match(/Merge branch '([^']+)'/)?.[1] || subject;
    const files = git(['diff', '--name-only', `${commit}^1`, commit]).split('\n').filter(Boolean);
    return { commit, mergedAt, subject, body, mr, branch, files };
  });
}

function mrMapping(mr) {
  const text = `${mr.branch} ${mr.subject} ${mr.files.join(' ')}`.toLowerCase();
  const mappings = [];
  const add = (...ids) => mappings.push(...ids);
  if (/composer-history|history-navigation/.test(text)) add('BETA-TASK-008');
  if (/model-menu-sdk|model.*sdk.*filter/.test(text)) add('BETA-ROUTE-001');
  if (/expert-publish-records-owned/.test(text)) add('BETA-EXPERT-001', 'BETA-EXPERT-007');
  if (/company.*(org|profile|context)|org-profile/.test(text)) add('BETA-CHAT-001', 'BETA-CHAT-009');
  if (/web-preview|markdown-link-preview|session-artifact-isolation/.test(text)) add('BETA-ART-001', 'BETA-CHAT-007');
  if (/skill-creator|skill-card|skillhub|workflow-skill/.test(text)) add('BETA-SKILL-002', 'BETA-SKILL-005', 'BETA-SKILL-014');
  if (/mcp|connector/.test(text)) add('BETA-MCP-001', 'BETA-MCP-002', 'BETA-SKILL-011');
  if (/reasoning-scroll|chat-ui|avatar|assistant-thread|turn-context|capability-isolation/.test(text)) add('BETA-CHAT-005', 'BETA-CHAT-007');
  if (/expert|handoff/.test(text)) add('BETA-EXPERT-001', 'BETA-EXPERT-007', 'BETA-EXPERT-012');
  if (/attachment|file|enametoolong/.test(text)) add('BETA-FILE-005', 'BETA-FILE-006', 'BETA-FILE-007');
  if (/teams|desktop|runtime|bootstrap|host-core|ota|recovery-readiness/.test(text)) add('BETA-INIT-001', 'BETA-REC-001', 'BETA-REC-002', 'BETA-HOST-003');
  if (/secret|security|auth-shell|terminal-arbitration/.test(text)) add('BETA-CHAT-009', 'BETA-SEC-002');
  return unique(mappings);
}

function mrArea(mr) {
  const text = `${mr.branch} ${mr.files.join(' ')}`.toLowerCase();
  if (/composer|chat|thread/.test(text)) return '会话与Composer';
  if (/expert/.test(text)) return '专家';
  if (/skill/.test(text)) return 'Skill';
  if (/mcp|connector/.test(text)) return 'MCP/连接器';
  if (/preview|artifact/.test(text)) return '成果与预览';
  if (/teams|desktop|runtime|host/.test(text)) return '宿主与运行时';
  if (/deploy|helm|ingress|migration|docker|server/.test(text)) return '服务端/部署';
  if (/test|ci|chore|refactor|bump/.test(text)) return '工程与CI';
  return '其他';
}

function deletionReason(testCase, cap) {
  const id = asString(testCase['用例ID']);
  const fixture = asString(cap.scenario?.fixture_control);
  const text = `${id} ${fixture} ${testCase['测试场景']}`.toLowerCase();
  if (PRODUCTION_GRAY_EXCLUDED_RARE_CASE_IDS.has(id)) {
    return ['低频恢复/故障注入', '按用户要求从70条门禁和160条全量回归同时删除；由正常高频功能Case补齐固定规模。'];
  }
  if (EXCLUDED_ACCOUNT_CASES.has(id) || /secondary_account|second_account|切换账号|第二账号/.test(text)) {
    return ['低频账号场景', '按用户要求删除切换账号/第二账号场景；单账号owner投影由BETA-EXPERT-001覆盖。'];
  }
  if (/network|proxy|unreachable|connection_cache|discovery_fault|service_fail|网络|不可达|代理/.test(text)) {
    return ['低频网络异常', '按用户要求删除网络异常、不可达、代理和连接缓存故障注入；保留正常联网业务路径。'];
  }
  if (/protected_release_deployment|deploy/.test(text)) {
    return ['非桌面灰度批次', '需要受保护K8s/Postgres/Helm控制器，不能混入桌面串行门禁；保留为独立发布工程检查。'];
  }
  if (REPLACED_CASES.has(id)) {
    return ['近7天语义替换', '旧场景移出；同一Case ID已重写为近7天高风险原生场景。'];
  }
  return ['框架能力收敛', '当前只有严格外部控制器契约，没有QbotTestAgent原生真实执行器；为避免伪可执行，从发布门禁移入自动化待办。'];
}

function styleSheet(sheet, title, subtitle, headers, rows, widths = []) {
  const columns = Math.max(1, headers.length);
  sheet.showGridLines = false;
  sheet.getRangeByIndexes(0, 0, 1, columns).values = [[title, ...Array(columns - 1).fill('')]];
  sheet.getRangeByIndexes(1, 0, 1, columns).values = [[subtitle, ...Array(columns - 1).fill('')]];
  sheet.getRangeByIndexes(3, 0, 1, columns).values = [headers];
  if (rows.length) sheet.getRangeByIndexes(4, 0, rows.length, columns).values = rows;
  const titleRange = sheet.getRangeByIndexes(0, 0, 1, columns);
  titleRange.merge();
  titleRange.format.fill = '#17324D';
  titleRange.format.font = { bold: true, color: '#FFFFFF', size: 16 };
  titleRange.format.rowHeightPx = 34;
  const subtitleRange = sheet.getRangeByIndexes(1, 0, 1, columns);
  subtitleRange.merge();
  subtitleRange.format.fill = '#DDF2EF';
  subtitleRange.format.font = { color: '#1C2B36', size: 10 };
  subtitleRange.format.wrapText = true;
  subtitleRange.format.rowHeightPx = 44;
  const headerRange = sheet.getRangeByIndexes(3, 0, 1, columns);
  headerRange.format.fill = '#176B68';
  headerRange.format.font = { bold: true, color: '#FFFFFF', size: 10 };
  headerRange.format.wrapText = true;
  headerRange.format.verticalAlignment = 'center';
  headerRange.format.rowHeightPx = 38;
  if (rows.length) {
    const body = sheet.getRangeByIndexes(4, 0, rows.length, columns);
    body.format.wrapText = true;
    body.format.verticalAlignment = 'top';
    body.format.borders = { preset: 'all', style: 'thin', color: '#C9D6E2' };
    body.format.rowHeightPx = columns > 15 ? 112 : 58;
  }
  headerRange.format.borders = { preset: 'all', style: 'thin', color: '#C9D6E2' };
  widths.forEach((width, index) => {
    if (index < columns) sheet.getRangeByIndexes(0, index, rows.length + 4, 1).format.columnWidthPx = width;
  });
  sheet.freezePanes.freezeRows(4);
  sheet.freezePanes.freezeColumns(1);
}

function addSheet(workbook, name, title, subtitle, headers, rows, widths) {
  const sheet = workbook.worksheets.add(name);
  styleSheet(sheet, title, subtitle, headers, rows, widths);
  return sheet;
}

function capabilitySet(cases) {
  const items = cases.map((testCase) => ({ testCase, ...capability(testCase) }));
  const counts = Object.fromEntries(
    [...new Set(items.map((item) => item.class))]
      .map((name) => [name, items.filter((item) => item.class === name).length]),
  );
  return {
    items,
    counts,
    strict: items.filter((item) => item.class === 'strict_controller_required'),
    unsupported: items.filter((item) => !item.binding.dispatchable),
  };
}

async function verifyWorkbook(workbook, outputDir, sheetNames) {
  const verificationDir = path.join(outputDir, 'workbook-verification');
  const renderDir = path.join(verificationDir, 'renders');
  await fs.mkdir(renderDir, { recursive: true });
  const inspections = [];
  for (const sheetName of ['生产灰度门禁Case', '全量功能回归Case']) {
    const rowCount = sheetName === '生产灰度门禁Case' ? 74 : 164;
    const result = await workbook.inspect({
      kind: 'table',
      range: `${sheetName}!A1:AO${rowCount}`,
      include: 'values,formulas',
      tableMaxRows: 10,
      tableMaxCols: 12,
      maxChars: 8000,
    });
    inspections.push(`# ${sheetName}\n${result.ndjson}`);
  }
  const formulaErrors = await workbook.inspect({
    kind: 'match',
    searchTerm: '#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A',
    options: { useRegex: true, maxResults: 300 },
    summary: 'final formula error scan',
  });
  inspections.push(`# Formula errors\n${formulaErrors.ndjson}`);
  await fs.writeFile(path.join(verificationDir, 'inspection.ndjson'), `${inspections.join('\n')}\n`);

  const rendered = [];
  for (const sheetName of sheetNames) {
    const largeCaseSheet = ['生产灰度门禁Case', '全量功能回归Case'].includes(sheetName);
    const preview = await workbook.render({
      sheetName,
      ...(largeCaseSheet ? { range: 'A1:AO12' } : { autoCrop: 'all' }),
      scale: largeCaseSheet ? 0.55 : 0.8,
      format: 'png',
    });
    const file = path.join(renderDir, `${String(rendered.length + 1).padStart(2, '0')}-${sheetName}.png`);
    await fs.writeFile(file, new Uint8Array(await preview.arrayBuffer()));
    rendered.push(file);
  }
  return { inspection_file: path.join(verificationDir, 'inspection.ndjson'), rendered };
}

async function main() {
  const actualCommit = git(['rev-parse', PRODUCT_REF]);
  if (actualCommit !== PRODUCT_COMMIT) {
    throw new Error(`${PRODUCT_REF} 已漂移：expected=${PRODUCT_COMMIT}; actual=${actualCommit}`);
  }
  const sourceWorkbook = await SpreadsheetFile.importXlsx(await FileBlob.load(SOURCE));
  const sourceValues = sourceWorkbook.worksheets.getItem('核心内测Case').getRange('A1:AO188').values;
  const { headers, cases: allCases } = sourceCases(sourceValues);
  const gateCoreCases = orderCases(allCases
    .filter((testCase) => capability(testCase).directlyRunnable)
    .filter((testCase) => !EXCLUDED_ACCOUNT_CASES.has(asString(testCase['用例ID'])))
    .filter((testCase) => !PRODUCTION_GRAY_EXCLUDED_RARE_CASE_IDS.has(asString(testCase['用例ID'])))
    .map(patchRecentCases));
  const fullFunctionPool = await loadFullFunctionLegacyCases();
  const fullFunctionById = new Map(fullFunctionPool.map((testCase) => [asString(testCase['用例ID']), testCase]));
  const gatePromotions = [...PRODUCTION_GRAY_PROMOTED_LEGACY_CASE_IDS].map((id) => {
    const testCase = fullFunctionById.get(id);
    if (!testCase) throw new Error(`门禁正常功能替补缺失：${id}`);
    return testCase;
  });
  const gateCases = [...gateCoreCases, ...gatePromotions];
  const regressionAddons = fullFunctionPool.filter(
    (testCase) => !PRODUCTION_GRAY_PROMOTED_LEGACY_CASE_IDS.has(asString(testCase['用例ID'])),
  );
  const fullCases = [...gateCases, ...regressionAddons];
  if (gateCoreCases.length !== 65) throw new Error(`剔除低频恢复/账号切换后原生门禁必须恰好65条，actual=${gateCoreCases.length}`);
  if (gatePromotions.length !== 5) throw new Error(`门禁正常功能替补必须恰好5条，actual=${gatePromotions.length}`);
  if (fullFunctionPool.length !== 95) throw new Error(`正常功能池必须恰好95条，actual=${fullFunctionPool.length}`);
  if (gateCases.length !== 70) throw new Error(`新版门禁必须恰好70条，actual=${gateCases.length}`);
  if (regressionAddons.length !== 90) throw new Error(`全量功能增量必须恰好90条，actual=${regressionAddons.length}`);
  if (fullCases.length !== 160) throw new Error(`全量功能回归必须恰好160条，actual=${fullCases.length}`);
  const gateIds = gateCases.map((testCase) => asString(testCase['用例ID']));
  const fullIds = fullCases.map((testCase) => asString(testCase['用例ID']));
  if (new Set(fullIds).size !== fullIds.length) throw new Error('全量功能回归Case ID重复');
  if (JSON.stringify(fullIds.slice(0, 70)) !== JSON.stringify(gateIds)) {
    throw new Error('全量功能回归前70条必须与生产灰度门禁顺序完全一致');
  }
  for (const id of PRODUCTION_GRAY_EXCLUDED_RARE_CASE_IDS) {
    if (gateIds.includes(id) || fullIds.includes(id)) {
      throw new Error(`低频恢复/故障注入Case不得进入正式70/160：${id}`);
    }
  }
  const gateIdSet = new Set(gateIds);
  const gateCapability = capabilitySet(gateCases);
  const addonCapability = capabilitySet(regressionAddons);
  const fullCapability = capabilitySet(fullCases);
  for (const [scope, summary] of [['70条门禁', gateCapability], ['160条全量', fullCapability]]) {
    if (summary.strict.length) {
      throw new Error(`${scope}仍含strict controller：${summary.strict.map((item) => item.testCase['用例ID']).join(',')}`);
    }
    if (summary.unsupported.length) {
      throw new Error(`${scope}仍含unsupported runtime：${summary.unsupported.map((item) => item.testCase['用例ID']).join(',')}`);
    }
  }
  const mrRows = mergedMrs().map((mr) => {
    const mappings = mrMapping(mr).filter((id) => gateIdSet.has(id));
    const area = mrArea(mr);
    const desktopRelevant = mappings.length > 0;
    return [
      mr.mergedAt.replace('T', ' ').slice(0, 19),
      mr.mr ? `!${mr.mr}` : '',
      mr.commit.slice(0, 12),
      mr.branch,
      area,
      mr.files.slice(0, 8).join('\n'),
      mappings.join(','),
      desktopRelevant ? '纳入70条门禁，亦属于160条全量前缀' : '静态/CI/服务端审计，不纳入桌面Case',
      desktopRelevant
        ? '由映射Case的真实UI动作与公开状态Oracle覆盖'
        : '不构成当前桌面用户主路径，保留提交与文件证据供发布工程检查',
    ];
  });
  const omitted = allCases.filter((testCase) => !gateIdSet.has(asString(testCase['用例ID'])));
  const replacementAudit = allCases.filter((testCase) => REPLACED_CASES.has(asString(testCase['用例ID'])));
  const deletionRows = [...omitted, ...replacementAudit].map((testCase) => {
    const cap = capability(testCase);
    const [kind, reason] = deletionReason(testCase, cap);
    const id = asString(testCase['用例ID']);
    return [
      id,
      asString(testCase['产品模块']),
      asString(testCase['测试场景']),
      cap.class,
      asString(cap.scenario?.fixture_control),
      kind,
      reason,
      REPLACED_CASES.has(id) ? `同ID新场景：${gateCases.find((item) => item['用例ID'] === id)?.['测试场景'] || ''}` : '',
    ];
  });
  for (const id of FULL_REGRESSION_EXCLUDED_LEGACY_IDS) {
    const reason = id === 'SIT-TEAMS-DOC-001'
      ? '权限/账号态依赖的低频Teams文档场景，按要求从常规功能回归移除。'
      : '网络异常、连接恢复或纯故障注入场景，按要求从常规功能回归移除。';
    deletionRows.push([id, '历史SIT', id, 'legacy excluded', '不适用', '全量回归低频场景删除', reason, '由正常主路径Case覆盖']);
  }
  const byDomain = new Map();
  const byType = new Map();
  for (const [scope, cases] of [['门禁70', gateCases], ['全量160', fullCases]]) {
    for (const testCase of cases) {
      const domainKey = `${scope}\u0000${asString(testCase['核心域'])}`;
      const typeKey = `${scope}\u0000${asString(testCase['用例类型'])}`;
      byDomain.set(domainKey, (byDomain.get(domainKey) || 0) + 1);
      byType.set(typeKey, (byType.get(typeKey) || 0) + 1);
    }
  }
  const workbook = Workbook.create();
  const gateSheet = addSheet(
    workbook,
    '生产灰度门禁Case',
    'QBot release/0.1 生产灰度发布门禁 Casebook（70条）',
    `基线 ${PRODUCT_REF}@${PRODUCT_COMMIT}（v${PRODUCT_VERSION}）；串行执行；70/70协议有效且运行时可分发；strict controller=0；unsupported runtime=0。`,
    headers,
    matrix(headers, gateCases),
    [120, 100, 115, 110, 60, 110, 300, 250, 280, 260, 340, 280, 280, 300, 330, 90, 70, 160, 270, 145, 180, 400, 350, 220, 400, 360, 170, 120, 80, 190, 180, 260, 220, 220, 70, 260, 260, 70, 320, 240, 250],
  );
  gateSheet.getRangeByIndexes(4, 4, gateCases.length, 1).format.fill = '#E8F4F1';
  const fullSheet = addSheet(
    workbook,
    '全量功能回归Case',
    'QBot release/0.1 全量正常功能回归 Casebook（160条）',
    `前70条与“生产灰度门禁Case”逐条同序一致，追加90条正常功能；160/160协议有效且运行时可分发；Case间永久串行；strict controller=0；unsupported runtime=0。`,
    headers,
    matrix(headers, fullCases),
    [120, 100, 115, 110, 60, 110, 300, 250, 280, 260, 340, 280, 280, 300, 330, 90, 70, 160, 270, 145, 180, 400, 350, 220, 400, 360, 170, 120, 80, 190, 180, 260, 220, 220, 70, 260, 260, 70, 320, 240, 250],
  );
  fullSheet.getRangeByIndexes(4, 4, fullCases.length, 1).format.fill = '#E8F4F1';
  fullSheet.getRangeByIndexes(4, 0, 70, headers.length).format.borders = {
    bottom: { style: 'medium', color: '#176B68' },
  };
  addSheet(workbook, '设计总览', '生产灰度门禁与全量功能回归设计总览', '70条负责发布硬门禁，160条负责正常功能全回归；两层都必须真实执行、可机判、可重复，禁止用不可执行Case充数。',
    ['指标', '结果', '门禁含义', '证据'], [
      ['生产灰度门禁', 70, '每轮完整串行，禁止Case间并发', '生产灰度门禁Case'],
      ['全量功能回归', 160, '同70条门禁前缀 + 90条正常功能增量', '全量功能回归Case'],
      ['门禁框架真实分发', '70/70', 'protocol/runtime dispatch=100%', '能力审计'],
      ['全量框架真实分发', '160/160', 'protocol/runtime dispatch=100%', '能力审计'],
      ['严格外部控制器', 0, '两层strict_controller_required=0', '能力审计'],
      ['不支持运行时', 0, '两层unsupported_runtime=0', '能力审计'],
      ['全量原生公开状态执行器', fullCapability.counts.runner_native || 0, 'QWork UI/bridge/CDP真实动作与读回', 'runner_native'],
      ['全量原生本机fixture选项', fullCapability.counts.runner_native_with_fixture_option || 0, '原生IME；pretest必须就绪', 'runner_native_with_fixture_option'],
      ['全量经语义复核旧执行器', fullCapability.counts.runner_legacy_verified || 0, '9条门禁映射 + 90条常规功能映射', 'runner_legacy_verified'],
      ['近7天直接合并MR', mrRows.length, '全部记录纳入/排除结论', '近7天MR覆盖'],
      ['全量回归排除', FULL_REGRESSION_EXCLUDED_LEGACY_IDS.size, '网络异常、账号/权限低频、纯故障注入不进入本套', '删除场景清单'],
      ['门禁低频恢复剔除', PRODUCTION_GRAY_EXCLUDED_RARE_CASE_IDS.size, '从70条门禁及160条前缀同步删除', '删除场景清单'],
      ['全量准入', '至少1轮160/160', '候选release identity完整可信全绿', '生产灰度准入'],
      ['连续放行', '5轮70/70', '160轮的前70条可计其中一轮；任一阻塞/非pass/flaky归零', '生产灰度准入'],
      ['最终权限', '1%-5%受控生产灰度', '完成门禁不等于GA，仍需监控与回滚', '发布判定'],
    ], [180, 180, 520, 240]);
  const coverageSheet = addSheet(workbook, '覆盖矩阵', '70条门禁与160条全量覆盖矩阵', '按范围、核心域和Case类型统计，会话、附件、成果、Skill、专家、MCP、安全、模型和常规设置均纳入。',
    ['范围', '维度', '名称', '用例数', '占比'], [
      ...[...byDomain.entries()].map(([key, count]) => {
        const [scope, name] = key.split('\u0000');
        return [scope, '核心域', name, count, count / (scope === '门禁70' ? 70 : 160)];
      }),
      ...[...byType.entries()].map(([key, count]) => {
        const [scope, name] = key.split('\u0000');
        return [scope, '用例类型', name, count, count / (scope === '门禁70' ? 70 : 160)];
      }),
    ], [100, 100, 260, 100, 100]);
  coverageSheet.getRangeByIndexes(4, 4, byDomain.size + byType.size, 1).format.numberFormat = '0.0%';
  addSheet(workbook, '执行配置', '执行配置与串行规则', '正式轮的精确版本、Casebook SHA、框架commit和fixture选项必须在pretest冻结；READY才允许启动唯一runner。',
    ['参数', '固定值/要求', '阶段', '硬约束', '说明'], [
      ['gate_case_count', 70, 'pretest/runner/gray-gate', '固定70', '不得用scoped、inherited或synthetic补齐'],
      ['full_case_count', 160, 'pretest/runner/full-regression', '固定160', '前70条必须与门禁逐条同序一致'],
      ['execution_policy', 'core-beta-v2-forced-serial', 'runner', '唯一runner；Case间并发=0', 'BETA-CHAT-008内部20任务仍属于单Case'],
      ['casebook', OUTPUT_NAME, 'pretest', '精确路径+Sheet+SHA-256', 'Casebook变化即新测试合同'],
      ['product_source', `${PRODUCT_REF}@${PRODUCT_COMMIT}`, '设计/复核', 'deepbankV2只读', `package.version=${PRODUCT_VERSION}`],
      ['host_identity', 'Teams/QWork每轮精确冻结', 'pretest', '版本、build、control plane全部一致', '当前最低Teams 5.3.0 / QWork 0.1.1'],
      ['fixture_options', 'native IME', 'pretest', '缺少所选Case能力则BLOCKED', '不允许运行中临时降级'],
      ['gray_gate_runs', 5, '发布判定', '同一release identity连续5轮', '任一非pass或flaky归零'],
      ['soak', '至少100任务+3次受管重启', '灰度前稳定性', '至少一个候选轮次完成', '独立soak证据，不伪装成普通Case'],
      ['monitor_policy', 'read-only + self-healing', '执行期', '仅framework/testcase issue停runner修复', '产品Bug按独立Case策略继续'],
    ], [180, 360, 180, 320, 420]);
  const evidenceCounts = new Map();
  for (const [scope, cases] of [['门禁70', gateCases], ['全量160', fullCases]]) {
    for (const testCase of cases) {
      for (const role of asString(testCase['证据角色']).split(',').map((item) => item.trim()).filter(Boolean)) {
        const key = `${scope}\u0000${role}`;
        evidenceCounts.set(key, (evidenceCounts.get(key) || 0) + 1);
      }
    }
  }
  addSheet(workbook, '证据与断言', '证据角色与硬断言', 'raw passed/failed不构成发布结论；manifest、动作收据、公开状态与业务Oracle必须同时成立。',
    ['范围', '证据角色', '覆盖Case数', '用途', '缺失处理'], [...evidenceCounts.entries()].map(([key, count]) => {
      const [scope, role] = key.split('\u0000');
      return [scope,
      role,
      count,
      /screenshot/.test(role) ? '用户可见动作前后状态' : /reply|prompt|transcript|task_id/.test(role) ? '任务与回复归属' : /trace|readback|snapshot|inventory|selection|event/.test(role) ? '机器状态/身份/工具读回' : '清理、路径或内容证据',
      'manifest incomplete；不得trusted_pass',
    ]; }), [100, 260, 110, 360, 300]);
  addSheet(workbook, '删除场景清单', '门禁收敛与全量回归排除场景', '网络异常、切换账号、受保护部署和纯故障注入按要求删除；没有真实执行器的场景禁止继续宣称“可执行”。',
    ['旧Case ID', '模块', '旧场景', '旧能力类别', 'Fixture/控制器', '处置分类', '处置理由', '替代'], deletionRows,
    [125, 120, 360, 190, 230, 160, 460, 420]);
  addSheet(workbook, '执行器映射', '160条Case执行器映射', '每条Case都绑定独立场景驱动、执行模式和fixture；两层正式批次都不允许额外排除。',
    ['范围', '序号', 'Case ID', '模块', '场景', '执行模式', '能力类别', 'Fixture', '来源/MR', '结论'], fullCapability.items.map(({ testCase, scenario, binding, class: capabilityClass }, index) => [
      index < 70 ? '门禁70+全量160' : '全量160增量', index + 1, testCase['用例ID'], testCase['产品模块'], testCase['测试场景'], binding.mode, capabilityClass, scenario.fixture_control, testCase['来源ID'], '必跑；框架支持',
    ]), [140, 70, 125, 120, 420, 140, 220, 220, 260, 180]);
  addSheet(workbook, '近7天MR覆盖', '近7天release/0.1直接合并MR审计', `增量 ${PREVIOUS_PRODUCT_COMMIT.slice(0, 12)}..${PRODUCT_COMMIT.slice(0, 12)}；窗口 ${MR_WINDOW_START} 至 ${MR_WINDOW_END}；以first-parent直接合入${PRODUCT_REF}为准，共${mrRows.length}个merge commit。`,
    ['合并时间', 'MR', 'Merge commit', '分支/主题', '领域', '主要变更文件', '映射Case', '处置', '理由'], mrRows,
    [165, 70, 110, 300, 130, 360, 260, 230, 420]);
  addSheet(workbook, '生产灰度准入', '全量功能与生产灰度准入规则', '至少一轮完整160条可信全绿，并满足70条连续多轮与soak门禁后，才允许1%-5%受控生产灰度。',
    ['门禁项', '必须满足', '失败后动作', '可否豁免'], [
      ['Pretest', 'READY；70/70协议、分发、fixture、身份、唯一runner全部通过', '不启动runner，修复具体前置', '否'],
      ['全量功能回归', '同一候选release identity至少1轮160/160可信全绿；前70条与门禁同序同内容', '修复framework/testcase问题后新目录重跑160；产品Bug保留并继续独立Case', '否'],
      ['单轮完整性', 'executed=unique=trusted_pass=evidence_complete=70；inherited=synthetic=0', '该轮不计连续全绿', '否'],
      ['可信分类', '候选绿轮次trusted_bug/fail/blocked/framework_issue/testcase_issue=0', '框架/Case问题停机修复；产品Bug继续独立Case并阻止本轮绿判定', '否'],
      ['连续稳定', '同一release identity连续5轮完整全绿；flaky=0', '计数归零，从新不可变目录重跑', '否'],
      ['轮次复用', '160条轮次的前70条完整可信结果可计入5轮70条中的1轮', '不得把后90条或不完整前缀拆算为门禁轮次', '否'],
      ['Soak', '至少100任务、3次受管重启、0 crash、0资源泄漏且证据完整', 'NO_GO', '否'],
      ['清理', 'QA创建资源清理完成，fixture restored=true', '冻结证据并修复清理', '否'],
      ['发布范围', '仅1%-5%受控生产灰度，具备实时监控与回滚', '停止扩量/回滚', '否'],
    ], [180, 520, 420, 100]);
  addSheet(workbook, '发布判定', '发布判定状态机', 'Case通过只是输入；最终放行由连续轮次、稳定性、身份一致性和清理证据共同决定。',
    ['阶段', '输入', '通过条件', '输出'], [
      ['设计合同', '70+160双层Casebook+框架commit', 'SHA固定；两Sheet协议/能力审计100%', '可进入pretest'],
      ['动态预检', '真实Teams/QWork/CDP/control plane/fixture', 'READY', '可启动唯一runner'],
      ['全量回归', '160条串行真实Case', '160/160可信全绿，前70条同门禁合同', '全量绿轮次+一个门禁绿轮次'],
      ['门禁补轮', '另外4轮70条串行真实Case', '累计5轮70/70可信全绿', '候选可评估'],
      ['连续验证', '同一release identity 5轮', '5轮均可信全绿且flaky=0', '候选可评估'],
      ['稳定性', '100任务+3重启soak', '0 crash、0泄漏、证据完整', 'GO_CONTROLLED_GRAY'],
      ['生产灰度', '1%-5%流量', '监控健康、无新增P0/P1', '逐步扩量或回滚'],
    ], [170, 360, 500, 240]);
  addSheet(workbook, '源码依据', 'Casebook源码与审计依据', '所有依据均绑定固定commit；deepbankV2仓库只读，QbotTestAgent负责Case、执行器、证据和放行规则。',
    ['类型', '位置/版本', '用途', '校验'], [
      ['产品源码', `/Users/qifu/Documents/deepbankV2 ${PRODUCT_REF}@${PRODUCT_COMMIT}`, '近7天MR与产品行为设计依据', 'git rev-parse origin/release/0.1'],
      ['上一Casebook产品基线', PREVIOUS_PRODUCT_COMMIT, '限定本次MR增量审计起点', `git log ${PREVIOUS_PRODUCT_COMMIT}..${PRODUCT_COMMIT} --first-parent --merges`],
      ['产品版本', PRODUCT_VERSION, 'release/0.1 package.json', `git show ${PRODUCT_COMMIT}:package.json`],
      ['源Casebook', SOURCE, '184条历史合同与字段/样式来源', '只读导入'],
      ['新Casebook', FORMAL_OUTPUT, '70条生产门禁+160条全量功能回归合同', 'SHA写入QBOT_AUTOMATION_FRAMEWORK.md'],
      ['框架协议', 'src/lib/core-beta-case-protocol.mjs', '独立scenario/fixture/证据契约', 'test/core-beta-case-protocol.mjs'],
      ['原生Runner', 'src/lib/ui-agent-casebook-runner-v2.mjs', '真实UI/bridge/CDP执行与Oracle', 'test/framework-invariants-v2.mjs'],
      ['能力审计', 'npm run core-beta:capability-audit', 'dispatchable/native/controller统计', 'strict_controller_required=0'],
      ['动态预检', 'npm run core-beta:pretest', '身份、fixture、CDP、唯一runner', 'READY才可启动'],
      ['灰度判定', 'npm run core-beta:gray-gate', '5轮+soak发布决策', 'GO_CONTROLLED_GRAY'],
    ], [150, 520, 420, 360]);

  const outputDir = path.resolve(option('out', DEFAULT_OUTPUT_DIR));
  await fs.mkdir(outputDir, { recursive: true });
  const sheetNames = [
    '生产灰度门禁Case', '全量功能回归Case', '设计总览', '覆盖矩阵', '执行配置',
    '证据与断言', '删除场景清单', '执行器映射', '近7天MR覆盖', '生产灰度准入',
    '发布判定', '源码依据',
  ];
  const verification = await verifyWorkbook(workbook, outputDir, sheetNames);
  const outputFile = path.join(outputDir, OUTPUT_NAME);
  const xlsx = await SpreadsheetFile.exportXlsx(workbook);
  await xlsx.save(outputFile);
  await fs.copyFile(outputFile, FORMAL_OUTPUT);
  const audit = {
    schema_version: 'qbot-release01-combined-casebook-build/v2',
    generated_at: new Date().toISOString(),
    product: { ref: PRODUCT_REF, commit: PRODUCT_COMMIT, version: PRODUCT_VERSION },
    source_case_count: allCases.length,
    gate_case_count: gateCases.length,
    gate_case_ids: gateIds,
    regression_addon_count: regressionAddons.length,
    regression_addon_case_ids: regressionAddons.map((item) => item['用例ID']),
    full_case_count: fullCases.length,
    full_case_ids: fullIds,
    full_prefix_matches_gate: JSON.stringify(fullIds.slice(0, 70)) === JSON.stringify(gateIds),
    gate_capability_summary: gateCapability.counts,
    addon_capability_summary: addonCapability.counts,
    full_capability_summary: fullCapability.counts,
    strict_controller_required: fullCapability.strict.length,
    unsupported_runtime: fullCapability.unsupported.length,
    deleted_or_replaced_old_scenarios: deletionRows.length,
    mr_merge_commit_count: mrRows.length,
    verification,
    outputs: { formal: FORMAL_OUTPUT, artifact: outputFile },
  };
  await fs.writeFile(path.join(outputDir, 'casebook-build-audit.json'), `${JSON.stringify(audit, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify(audit, null, 2)}\n`);
}

await main();
