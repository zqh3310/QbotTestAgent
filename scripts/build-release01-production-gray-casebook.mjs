#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { FileBlob, SpreadsheetFile, Workbook } from '@oai/artifact-tool';
import { CORE_BETA_SCENARIO_REGISTRY } from '../src/lib/core-beta-case-protocol.mjs';
import { coreBetaRuntimeExecutorBinding } from '../src/lib/ui-agent-casebook-runner-v2.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const DEEPBANK = '/Users/qifu/Documents/deepbankV2';
const SOURCE = path.join(ROOT, 'PRD', 'QBot完整生产灰度门禁Casebook_184条_2026-08-03.xlsx');
const PRODUCT_COMMIT = '5f3f99b1dd24e04f36715ea236a3f70b132d25c7';
const PRODUCT_REF = 'origin/release/0.1';
const PRODUCT_VERSION = '0.1.1';
const MR_WINDOW_START = '2026-08-03T00:00:00+08:00';
const MR_WINDOW_END = '2026-08-11T00:00:00+08:00';
const OUTPUT_NAME = 'QBot生产灰度发布门禁Casebook_70条_2026-08-10.xlsx';
const DEFAULT_OUTPUT_DIR = path.join(ROOT, 'outputs', '20260810_release01_gray70_casebook');
const FORMAL_OUTPUT = path.join(ROOT, 'PRD', OUTPUT_NAME);
const LOCAL_FIXTURE_ADAPTERS = new Set([
  'native_ime_input',
  'managed_teams_restart',
  'managed_runtime_restart',
]);
const EXCLUDED_ACCOUNT_CASES = new Set(['BETA-EXPERT-011', 'BETA-EXPERT-013', 'BETA-AUTH-006']);
const REPLACED_CASES = new Set(['BETA-TASK-008', 'BETA-ROUTE-001']);

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
      .replace(/QWork>=0\.0\.28/g, 'QWork>=0.1.1-rc.2')
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
    next['测试数据'] = '三个本轮draftId/etag；三个唯一幂等键；禁止故障注入、历史专家和第二账号。';
    next['自动化执行步骤'] = '1. 读取三类本轮草稿身份\n2. 逐项发起发布并等待completed\n3. 读回三个active expert/release并写入published_research/data/delivery';
    next['预期结果'] = '三类草稿各自产生唯一发布operation和active expert；后续专家Case只消费本轮账本。';
    next['成功判定'] = 'operation=3且全部completed；expertId/releaseId完整；三类ledger key完整；无半版本、重复发布或历史复用。';
    next['失败/阻塞判定'] = '任一发布失败、半状态、重复或账本缺失记trusted_bug/framework_issue；不得因缺少故障注入命令阻塞。';
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
    const steps = '1. 在同一新任务依次发送两个唯一输入并等待接受\n2. 输入未发送草稿，在首行用Up/Down核对新到旧回放和草稿恢复\n3. 新建任务核对历史隔离，再重开原task核对最新输入可回放';
    const roles = ['before_screenshot', 'action_receipt', 'after_screenshot', 'public_state_readback', 'task_id', 'prompt', 'send_receipt', 'transcript', 'reply_delta', 'reply_completion', 'product_action_trace', 'data_integrity_readback', 'cleanup_readback'];
    Object.assign(next, {
      '产品模块': '任务与会话',
      '子功能': 'Composer历史输入',
      '核心域': '任务生命周期',
      '优先级': 'P0',
      '用例类型': 'task_lifecycle',
      '测试场景': 'Composer使用Up/Down按当前会话回放已接受输入，恢复未发送草稿，并保持任务隔离与重开持久化',
      '用户旅程': '发送两轮 → 输入草稿 → Up/Down浏览 → 新任务隔离 → 重开原任务',
      '前置条件': '运行时ready；当前账号已登录；从干净新任务开始；Composer无附件、Skill、Expert、MCP残留。',
      '测试数据': 'QBOT-HISTORY-FIRST、QBOT-HISTORY-SECOND、QBOT-HISTORY-DRAFT-NOT-SENT；均绑定本轮taskId。',
      '自动化执行步骤': steps,
      '预期结果': 'Up按新到旧回放，Down按旧到新并恢复原草稿；新任务无历史；重开原task后历史仍在。',
      '成功判定': '六个导航读回逐字一致；原taskId非空；新任务为activeId为空、messageCount=0的独立草稿且ArrowUp为空；重开原task ArrowUp等于第二条输入。',
      '失败/阻塞判定': '顺序错误、草稿丢失、跨任务泄漏或重开丢历史记trusted_bug；读回/截图/任务关联缺失记framework_issue。',
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
        ['Up顺序为SECOND→FIRST', 'Down顺序为SECOND→未发送草稿', '新任务无历史且重开原task保留历史'],
        '当前会话的已接受输入顺序、草稿恢复、任务隔离和持久化同时成立。',
      )),
      '证据角色': roles.join(','),
      '证据Schema版本': 'qbot-core-evidence/v2',
      '自动化Runner': 'core-beta-v2',
      '每轮必跑': '是',
      '来源ID': 'MR!1063',
      '来源类型': '近7天MR新增原生回归',
      '备注': `Composer history navigation；${PRODUCT_REF}@${PRODUCT_COMMIT}。`,
      '风险域': 'functional,data_integrity_isolation,reliability_recovery',
      '判定Oracle': 'task_bound_history_readback+draft_restore',
      '确定性': '是',
      '重复策略': '同一冻结发布身份连续5个全量轮次；任一非pass、阻塞、波动、继承/synthetic或证据缺失都会把连续全绿计数归零',
      '必需Fixture': 'runtime:ready,account:authenticated,composer:clean',
      '硬门禁': '是',
      '版本范围': `${PRODUCT_REF}@${PRODUCT_COMMIT};Teams>=5.3.0;QWork>=0.1.1-rc.2`,
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
      '版本范围': `${PRODUCT_REF}@${PRODUCT_COMMIT};Teams>=5.3.0;QWork>=0.1.1-rc.2`,
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
  const raw = git(['log', PRODUCT_COMMIT, '--first-parent', '--merges', `--since=${MR_WINDOW_START}`, `--until=${MR_WINDOW_END}`, `--pretty=format:${format}`]);
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
  titleRange.format.fill = '#17324D';
  titleRange.format.font = { bold: true, color: '#FFFFFF', size: 16 };
  titleRange.format.rowHeightPx = 34;
  const subtitleRange = sheet.getRangeByIndexes(1, 0, 1, columns);
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

async function main() {
  const actualCommit = git(['rev-parse', PRODUCT_REF]);
  if (actualCommit !== PRODUCT_COMMIT) {
    throw new Error(`${PRODUCT_REF} 已漂移：expected=${PRODUCT_COMMIT}; actual=${actualCommit}`);
  }
  const sourceWorkbook = await SpreadsheetFile.importXlsx(await FileBlob.load(SOURCE));
  const sourceValues = sourceWorkbook.worksheets.getItem('核心内测Case').getRange('A1:AO188').values;
  const { headers, cases: allCases } = sourceCases(sourceValues);
  const selected = orderCases(allCases
    .filter((testCase) => capability(testCase).directlyRunnable)
    .filter((testCase) => !EXCLUDED_ACCOUNT_CASES.has(asString(testCase['用例ID'])))
    .map(patchRecentCases));
  if (selected.length !== 70) throw new Error(`新版门禁必须恰好70条，actual=${selected.length}`);
  const selectedIds = new Set(selected.map((testCase) => asString(testCase['用例ID'])));
  const selectedCapabilities = selected.map((testCase) => ({ testCase, ...capability(testCase) }));
  const strict = selectedCapabilities.filter((item) => item.class === 'strict_controller_required');
  if (strict.length) throw new Error(`新版门禁仍含strict controller：${strict.map((item) => item.testCase['用例ID']).join(',')}`);
  const mrRows = mergedMrs().map((mr) => {
    const mappings = mrMapping(mr).filter((id) => selectedIds.has(id));
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
      desktopRelevant ? '纳入70条桌面灰度门禁' : '静态/CI/服务端审计，不纳入桌面Case',
      desktopRelevant
        ? '由映射Case的真实UI动作与公开状态Oracle覆盖'
        : '不构成当前桌面用户主路径，保留提交与文件证据供发布工程检查',
    ];
  });
  const omitted = allCases.filter((testCase) => !selectedIds.has(asString(testCase['用例ID'])));
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
      REPLACED_CASES.has(id) ? `同ID新场景：${selected.find((item) => item['用例ID'] === id)?.['测试场景'] || ''}` : '',
    ];
  });
  const byDomain = new Map();
  const byType = new Map();
  for (const testCase of selected) {
    byDomain.set(asString(testCase['核心域']), (byDomain.get(asString(testCase['核心域'])) || 0) + 1);
    byType.set(asString(testCase['用例类型']), (byType.get(asString(testCase['用例类型'])) || 0) + 1);
  }
  const workbook = Workbook.create();
  const caseSheet = addSheet(
    workbook,
    '核心内测Case',
    'QBot release/0.1 生产灰度发布门禁 Casebook（70条）',
    `基线 ${PRODUCT_REF}@${PRODUCT_COMMIT}（v${PRODUCT_VERSION}）；串行执行；70/70由框架真实分发；strict controller=0；删除网络异常与切换账号等低频场景。`,
    headers,
    matrix(headers, selected),
    [120, 100, 115, 110, 60, 110, 300, 250, 280, 260, 340, 280, 280, 300, 330, 90, 70, 160, 270, 145, 180, 400, 350, 220, 400, 360, 170, 120, 80, 190, 180, 260, 220, 220, 70, 260, 260, 70, 320, 240, 250],
  );
  caseSheet.getRangeByIndexes(4, 4, selected.length, 1).format.fill = '#E8F4F1';
  addSheet(workbook, '设计总览', '生产灰度门禁设计总览', '目标不是追求Case数量，而是让每条都能真实执行、可机判、可重复，并足以覆盖桌面发布主路径。',
    ['指标', '结果', '门禁含义', '证据'], [
      ['Case总数', 70, '每轮全量串行，禁止Case间并发', '核心内测Case'],
      ['框架真实分发', '70/70', 'runtime dispatchable=100%', '能力审计'],
      ['严格外部控制器', 0, 'strict_controller_required=0', '能力审计'],
      ['原生公开状态执行器', 61, 'QWork UI/bridge/CDP真实动作与读回', 'runner_native'],
      ['原生本机fixture选项', 4, 'IME、Teams重启、runtime重启；pretest必须就绪', 'runner_native_with_fixture_option'],
      ['经语义复核旧执行器', 5, '完整业务Oracle映射，不是通用点击', 'runner_legacy_verified'],
      ['近7天直接合并MR', mrRows.length, '全部记录纳入/排除结论', '近7天MR覆盖'],
      ['删除旧场景', 116, '114个不纳入ID + 2个同ID语义替换', '删除场景清单'],
      ['连续放行', '5轮70/70', '同一release identity；任一阻塞/非pass/flaky归零', '生产灰度准入'],
      ['最终权限', '1%-5%受控生产灰度', '完成门禁不等于GA，仍需监控与回滚', '发布判定'],
    ], [180, 180, 520, 240]);
  addSheet(workbook, '覆盖矩阵', '70条覆盖矩阵', '按核心域和Case类型统计，保持会话、附件、成果、Skill、专家、MCP、恢复、安全与模型主路径。',
    ['维度', '名称', '用例数', '占比'], [
      ...[...byDomain.entries()].map(([name, count]) => ['核心域', name, count, count / selected.length]),
      ...[...byType.entries()].map(([name, count]) => ['用例类型', name, count, count / selected.length]),
    ], [100, 260, 100, 100]);
  addSheet(workbook, '执行配置', '执行配置与串行规则', '正式轮的精确版本、Casebook SHA、框架commit和fixture选项必须在pretest冻结；READY才允许启动唯一runner。',
    ['参数', '固定值/要求', '阶段', '硬约束', '说明'], [
      ['expected_case_count', 70, 'pretest/runner/gray-gate', '固定70', '不得用scoped、inherited或synthetic补齐'],
      ['execution_policy', 'core-beta-v2-forced-serial', 'runner', '唯一runner；Case间并发=0', 'BETA-CHAT-008内部20任务仍属于单Case'],
      ['casebook', OUTPUT_NAME, 'pretest', '精确路径+Sheet+SHA-256', 'Casebook变化即新测试合同'],
      ['product_source', `${PRODUCT_REF}@${PRODUCT_COMMIT}`, '设计/复核', 'deepbankV2只读', `package.version=${PRODUCT_VERSION}`],
      ['host_identity', 'Teams/QWork每轮精确冻结', 'pretest', '版本、build、control plane全部一致', '当前最低Teams 5.3.0 / QWork 0.1.1-rc.2'],
      ['fixture_options', 'native IME + Teams/runtime restart', 'pretest', '缺任一所选Case能力则BLOCKED', '不允许运行中临时降级'],
      ['gray_gate_runs', 5, '发布判定', '同一release identity连续5轮', '任一非pass或flaky归零'],
      ['soak', '至少100任务+3次受管重启', '灰度前稳定性', '至少一个候选轮次完成', '独立soak证据，不伪装成普通Case'],
      ['monitor_policy', 'read-only + self-healing', '执行期', '仅framework/testcase issue停runner修复', '产品Bug按独立Case策略继续'],
    ], [180, 360, 180, 320, 420]);
  const evidenceCounts = new Map();
  for (const testCase of selected) {
    for (const role of asString(testCase['证据角色']).split(',').map((item) => item.trim()).filter(Boolean)) {
      evidenceCounts.set(role, (evidenceCounts.get(role) || 0) + 1);
    }
  }
  addSheet(workbook, '证据与断言', '证据角色与硬断言', 'raw passed/failed不构成发布结论；manifest、动作收据、公开状态与业务Oracle必须同时成立。',
    ['证据角色', '覆盖Case数', '用途', '缺失处理'], [...evidenceCounts.entries()].map(([role, count]) => [
      role,
      count,
      /screenshot/.test(role) ? '用户可见动作前后状态' : /reply|prompt|transcript|task_id/.test(role) ? '任务与回复归属' : /trace|readback|snapshot|inventory|selection|event/.test(role) ? '机器状态/身份/工具读回' : '清理、路径或内容证据',
      'manifest incomplete；不得trusted_pass',
    ]), [260, 110, 360, 300]);
  addSheet(workbook, '删除场景清单', '从184条收敛时删除/替换的旧场景', '网络异常、切换账号等低频场景按要求删除；没有原生执行器的场景移入自动化待办，禁止继续宣称“可执行”。',
    ['旧Case ID', '模块', '旧场景', '旧能力类别', 'Fixture/控制器', '处置分类', '处置理由', '替代'], deletionRows,
    [125, 120, 360, 190, 230, 160, 460, 420]);
  addSheet(workbook, '旧Case收敛映射', '70条保留与重写映射', '每条门禁Case都绑定独立场景驱动、执行模式和fixture；灰度轮不允许再额外排除。',
    ['Case ID', '模块', '新场景', '执行模式', '能力类别', 'Fixture', '来源/MR', '门禁结论'], selectedCapabilities.map(({ testCase, scenario, binding, class: capabilityClass }) => [
      testCase['用例ID'], testCase['产品模块'], testCase['测试场景'], binding.mode, capabilityClass, scenario.fixture_control, testCase['来源ID'], '必跑；框架支持',
    ]), [125, 120, 420, 140, 220, 220, 260, 180]);
  addSheet(workbook, '近7天MR覆盖', '近7天release/0.1直接合并MR审计', `窗口 ${MR_WINDOW_START} 至 2026-08-10；以first-parent直接合入${PRODUCT_REF}为准，共${mrRows.length}个merge commit。`,
    ['合并时间', 'MR', 'Merge commit', '分支/主题', '领域', '主要变更文件', '映射Case', '处置', '理由'], mrRows,
    [165, 70, 110, 300, 130, 360, 260, 230, 420]);
  addSheet(workbook, '生产灰度准入', '生产灰度准入规则', '只有完整70条连续多轮无阻塞、无框架问题、无产品Bug并完成soak，才允许1%-5%受控生产灰度。',
    ['门禁项', '必须满足', '失败后动作', '可否豁免'], [
      ['Pretest', 'READY；70/70协议、分发、fixture、身份、唯一runner全部通过', '不启动runner，修复具体前置', '否'],
      ['单轮完整性', 'executed=unique=trusted_pass=evidence_complete=70；inherited=synthetic=0', '该轮不计连续全绿', '否'],
      ['可信分类', 'trusted_bug/fail/blocked/framework_issue/testcase_issue=0', '按分类修复或阻止发布', '否'],
      ['连续稳定', '同一release identity连续5轮完整全绿；flaky=0', '计数归零，从新不可变目录重跑', '否'],
      ['Soak', '至少100任务、3次受管重启、0 crash、0资源泄漏且证据完整', 'NO_GO', '否'],
      ['清理', 'QA创建资源清理完成，fixture restored=true', '冻结证据并修复清理', '否'],
      ['发布范围', '仅1%-5%受控生产灰度，具备实时监控与回滚', '停止扩量/回滚', '否'],
    ], [180, 520, 420, 100]);
  addSheet(workbook, '发布判定', '发布判定状态机', 'Case通过只是输入；最终放行由连续轮次、稳定性、身份一致性和清理证据共同决定。',
    ['阶段', '输入', '通过条件', '输出'], [
      ['设计合同', '70条Casebook+框架commit', 'SHA固定；协议/能力审计100%', '可进入pretest'],
      ['动态预检', '真实Teams/QWork/CDP/control plane/fixture', 'READY', '可启动唯一runner'],
      ['完整执行', '70条串行真实Case', '无阻塞、无非pass、证据完整', '一个可信绿轮次'],
      ['连续验证', '同一release identity 5轮', '5轮均可信全绿且flaky=0', '候选可评估'],
      ['稳定性', '100任务+3重启soak', '0 crash、0泄漏、证据完整', 'GO_CONTROLLED_GRAY'],
      ['生产灰度', '1%-5%流量', '监控健康、无新增P0/P1', '逐步扩量或回滚'],
    ], [170, 360, 500, 240]);
  addSheet(workbook, '源码依据', 'Casebook源码与审计依据', '所有依据均绑定固定commit；deepbankV2仓库只读，QbotTestAgent负责Case、执行器、证据和放行规则。',
    ['类型', '位置/版本', '用途', '校验'], [
      ['产品源码', `/Users/qifu/Documents/deepbankV2 ${PRODUCT_REF}@${PRODUCT_COMMIT}`, '近7天MR与产品行为设计依据', 'git rev-parse origin/release/0.1'],
      ['产品版本', PRODUCT_VERSION, 'release/0.1 package.json', `git show ${PRODUCT_COMMIT}:package.json`],
      ['源Casebook', SOURCE, '184条历史合同与字段/样式来源', '只读导入'],
      ['新Casebook', FORMAL_OUTPUT, '70条生产灰度发布合同', 'SHA写入QBOT_AUTOMATION_FRAMEWORK.md'],
      ['框架协议', 'src/lib/core-beta-case-protocol.mjs', '独立scenario/fixture/证据契约', 'test/core-beta-case-protocol.mjs'],
      ['原生Runner', 'src/lib/ui-agent-casebook-runner-v2.mjs', '真实UI/bridge/CDP执行与Oracle', 'test/framework-invariants-v2.mjs'],
      ['能力审计', 'npm run core-beta:capability-audit', 'dispatchable/native/controller统计', 'strict_controller_required=0'],
      ['动态预检', 'npm run core-beta:pretest', '身份、fixture、CDP、唯一runner', 'READY才可启动'],
      ['灰度判定', 'npm run core-beta:gray-gate', '5轮+soak发布决策', 'GO_CONTROLLED_GRAY'],
    ], [150, 520, 420, 360]);

  const outputDir = path.resolve(option('out', DEFAULT_OUTPUT_DIR));
  await fs.mkdir(outputDir, { recursive: true });
  const outputFile = path.join(outputDir, OUTPUT_NAME);
  const xlsx = await SpreadsheetFile.exportXlsx(workbook);
  await xlsx.save(outputFile);
  await fs.copyFile(outputFile, FORMAL_OUTPUT);
  const audit = {
    schema_version: 'qbot-release01-gray-casebook-build/v1',
    generated_at: new Date().toISOString(),
    product: { ref: PRODUCT_REF, commit: PRODUCT_COMMIT, version: PRODUCT_VERSION },
    source_case_count: allCases.length,
    selected_case_count: selected.length,
    selected_case_ids: selected.map((item) => item['用例ID']),
    capability_summary: Object.fromEntries([...new Set(selectedCapabilities.map((item) => item.class))].map((name) => [name, selectedCapabilities.filter((item) => item.class === name).length])),
    strict_controller_required: strict.length,
    deleted_or_replaced_old_scenarios: deletionRows.length,
    mr_merge_commit_count: mrRows.length,
    outputs: { formal: FORMAL_OUTPUT, artifact: outputFile },
  };
  await fs.writeFile(path.join(outputDir, 'casebook-build-audit.json'), `${JSON.stringify(audit, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify(audit, null, 2)}\n`);
}

await main();
