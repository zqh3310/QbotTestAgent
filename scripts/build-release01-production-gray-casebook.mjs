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
import {
  buildConversationTurns,
  coreBetaRuntimeExecutorBinding,
} from '../src/lib/ui-agent-casebook-runner-v2.mjs';
import { migrateProductionCase } from '../src/lib/production-casebook-contract.mjs';

const ROOT = path.resolve(process.env.QBOT_CASEBOOK_ROOT || path.resolve(import.meta.dirname, '..'));
const DEEPBANK = '/Users/qifu/Documents/deepbankV2';
const SOURCE = path.join(ROOT, 'PRD', 'QBot完整生产灰度门禁Casebook_184条_2026-08-03.xlsx');
const SMOKE_SOURCE = path.join(ROOT, 'PRD', 'QWork_MR1243-1260_核心冒烟自动化Casebook_11条_2026-08-23.xlsx');
const LEGACY_SOURCE_JSON = path.join(ROOT, 'PRD', 'QBot核心上线门禁用例_Teams-QWork_2026-07-22_框架修复版.json');
const LEGACY_SUPPLEMENT_XLSX = path.join(ROOT, 'PRD', 'QBot系统SIT自动化测试用例_框架清零版_2026-07-11.xlsx');
const PRODUCT_COMMIT = '94205b1ed4ba2a44ea6a50aa5712a38da6dd30c3';
const PREVIOUS_PRODUCT_COMMIT = '0b741371b27285c06b849a2f0febb2ffb58cb338';
const PRODUCT_REF = 'origin/release/0.1';
const PRODUCT_VERSION = '0.1.4';
const MR_WINDOW_START = '2026-08-24T00:00:00+08:00';
const MR_WINDOW_END = '2026-08-26T23:59:59+08:00';
const OUTPUT_NAME = 'QBot新增MR核心冒烟与生产灰度全量回归Casebook_12-70-160条_2026-08-26.xlsx';
const DEFAULT_OUTPUT_DIR = path.join(ROOT, 'outputs', '20260826_release01_recent2d_casebook_12-70-160');
const FORMAL_OUTPUT = path.join(ROOT, 'PRD', OUTPUT_NAME);
const SMOKE_CASE_IDS = Object.freeze([
  'MRSMOKE-ACT-001',
  'MRSMOKE-WEB-001',
  'MRSMOKE-WEB-002',
  'MRSMOKE-AUTH-001',
  'MRSMOKE-AUTO-001',
  'MRSMOKE-NAV-001',
  'MRSMOKE-ROUTE-001',
  'MRSMOKE-SKILL-001',
  'MRSMOKE-FAIL-001',
  'MRSMOKE-ART-001',
  'MRSMOKE-ENTRY-001',
  'MRSMOKE-CHART-001',
]);
const RECENT_MR_CASE_MAPPING = new Map([
  ['1328', ['MRSMOKE-ACT-001', 'MRSMOKE-AUTO-001', 'MRSMOKE-NAV-001', 'BETA-CHAT-007']],
  ['1327', ['MRSMOKE-FAIL-001', 'BETA-CHAT-009']],
  ['1298', ['MRSMOKE-CHART-001', 'SIT-CONN-016']],
  ['1323', ['MRSMOKE-WEB-001', 'SIT-CONN-019']],
  ['1311', ['MRSMOKE-SKILL-001', 'SIT-SKILL-030', 'SIT-SKILL-032']],
  ['1319', ['MRSMOKE-AUTH-001', 'SIT-WORKSPACE-001']],
  ['1306', ['BETA-HOST-003', 'BETA-INIT-001']],
  ['1315', ['MRSMOKE-ROUTE-001', 'MRSMOKE-FAIL-001']],
  ['1303', ['MRSMOKE-WEB-001', 'SIT-CONN-019']],
  ['1314', ['BETA-FILE-006', 'BETA-FILE-008', 'BETA-FILE-009', 'SIT-HOME-044']],
  ['1305', ['BETA-FILE-006', 'BETA-FILE-008', 'BETA-FILE-009', 'SIT-HOME-044']],
  ['1302', ['MRSMOKE-SKILL-001', 'SIT-SKILL-030', 'SIT-SKILL-032']],
  ['1277', ['MRSMOKE-SKILL-001']],
  ['1293', ['MRSMOKE-WEB-001', 'SIT-CONN-019']],
  ['1287', ['BETA-HOST-003', 'BETA-INIT-001']],
  ['1304', ['MRSMOKE-ACT-001']],
  ['1300', ['MRSMOKE-WEB-001', 'SIT-CONN-019']],
  ['1296', ['MRSMOKE-WEB-001', 'SIT-CONN-019']],
  ['1297', ['MRSMOKE-WEB-001', 'SIT-CONN-019']],
  ['1295', ['MRSMOKE-SKILL-001']],
  ['1294', ['MRSMOKE-WEB-001', 'SIT-CONN-019']],
  ['1292', ['MRSMOKE-SKILL-001', 'MRSMOKE-FAIL-001']],
  ['1280', ['MRSMOKE-ROUTE-001', 'MRSMOKE-ENTRY-001']],
]);
const RECENT_MR_STATIC_AUDITS = new Map([
  ['1329', {
    expectedFiles: ['.gitlab-ci.yml'],
    disposition: 'CI-only：固定单元测试物料镜像digest；不新增桌面QWork E2E',
    reason: '静态核对QBOT_CI_UNIT_IMAGE由sha256:ec7c3f更新为sha256:3410bb，保留merge commit与文件清单；由CI物料溯源/单元测试负责，不计12/70/160桌面通过',
  }],
]);
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
  const headerIndex = values.findIndex((row) => row.map(asString).includes('用例ID'));
  if (headerIndex < 0) throw new Error('Casebook Sheet 缺少“用例ID”表头');
  const headers = values[headerIndex].map(asString).filter(Boolean);
  const index = new Map(headers.map((header, column) => [header, column]));
  const rows = values.slice(headerIndex + 1).filter((row) => asString(row[index.get('用例ID')]).trim());
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
      .replace(/QWork>=0\.0\.28/g, `QWork>=${PRODUCT_VERSION}`)
      .replace(/QWork>=0\.1\.1(?:-rc\.2)?/g, `QWork>=${PRODUCT_VERSION}`)
      .replace(/Teams>=5\.2\.29/g, 'Teams>=5.3.0');
  }
  next['备注'] = `${asString(next['备注']).replace(/；?origin\/release\/0\.1@[0-9a-f]{7,40}。?/g, '').trim()}；基线${PRODUCT_REF}@${PRODUCT_COMMIT}，版本${PRODUCT_VERSION}。`
    .replace(/^；/, '');
  return next;
}

function withEvidenceRole(testCase, role) {
  const next = { ...testCase };
  const roles = unique(`${asString(next['证据角色'])},${asString(next['证据要求'])},${role}`
    .split(',').map((item) => item.trim()));
  next['证据角色'] = roles.join(',');
  next['证据要求'] = roles.join(',');
  return next;
}

function appendHardOracles(testCase, values) {
  const next = { ...testCase };
  const precise = parseJson(next['精准断言JSON'], {});
  precise.hard_oracles = unique([...(Array.isArray(precise.hard_oracles) ? precise.hard_oracles : []), ...values]);
  next['精准断言JSON'] = json(precise);
  return next;
}

function patchSmokeCase(testCase) {
  const id = asString(testCase['用例ID']);
  let next = patchBaseline(testCase);
  for (const [key, value] of Object.entries(next)) {
    if (typeof value === 'string') next[key] = value.replaceAll('1/11', '1/12');
  }
  next['来源类型'] = '2026-08-24~2026-08-26 release/0.1 直接合入 MR 核心路径自动化';
  next['版本范围'] = `${PRODUCT_REF}@${PRODUCT_COMMIT};Teams>=5.3.0;QWork>=${PRODUCT_VERSION}`;
  next['备注'] = `${asString(next['备注'])}；最新35个直接合入MR已在“近2天MR覆盖”逐条映射，未映射的Dashboard/CI/设计变更只做静态合同审计。`;
  if (id === 'MRSMOKE-WEB-001') {
    next = withEvidenceRole(next, 'external_navigation_trace');
    next['测试数据'] = '请使用内置 Web 搜索查找 OpenAI 官方网站最近 30 天发布的两条产品更新；若不足两条请明确说明并列出最近两条。每条给出标题、发布日期、原始链接和一句摘要；回答末尾另附 https://www.iana.org/domains/reserved 作为公共外链打开验证。';
    next['执行步骤'] = '1. 新建任务，技能禁用，连接器自动。\n2. 发送测试数据中的搜索请求并等待回复。\n3. 用确认发送、taskId、runtime authority 与 provider receipt 对账 builtin:qbot_web。\n4. 真实点击回复中的 IANA 公共 HTTPS 链接。\n5. 断言 openPreview 公开终态为 external/external_opened，且无“无法预览/无法打开”假失败。';
    next['预期结果'] = '真实调用 builtin:qbot_web；官方来源业务 Oracle 通过；runtime authority/provider receipt 与同一 task 绑定；公共域外链走 external fallback 且不显示假失败。';
    next['来源ID'] = `${asString(next['来源ID'])}; MR!1293; MR!1294; MR!1296; MR!1297; MR!1300; MR!1303; MR!1323`;
    next = appendHardOracles(next, [
      'Web 业务结果 Oracle 与 runtime authority/provider receipt 分离且均通过',
      '真实点击公共 HTTPS 链接后公开结果为 external/external_opened，页面无假失败提示',
    ]);
  }
  if (id === 'MRSMOKE-AUTH-001') {
    next = withEvidenceRole(next, 'workspace_missing_error_readback');
    next['执行步骤'] = `${asString(next['执行步骤'])}\n5. 保留原 taskId，删除本 Case 创建的授权 cwd。\n6. 在同一 task 重发确定性请求，读取结构化 chat.workspace.cwd_missing、原 cwd、retryable=false 与用户可见提示。\n7. 断言没有自动重试、新 taskId 或 causeCode/内部错误字段泄漏。`;
    next['预期结果'] = `${asString(next['预期结果'])}；cwd 删除后同一 task 明确返回 chat.workspace.cwd_missing，精确指向原 cwd、不可重试且不泄漏内部字段。`;
    next['来源ID'] = `${asString(next['来源ID'])}; MR!1319`;
    next = appendHardOracles(next, [
      'cwd 删除后同 taskId 返回结构化 chat.workspace.cwd_missing，params.cwd 精确且 retryable=false',
      '用户提示解释目录不存在且隐藏 desktop_local_workspace_unavailable/causeCode/stack',
    ]);
  }
  if (id === 'MRSMOKE-AUTO-001') {
    next['测试数据'] = 'intervalMs=60000；activeFrom=当前时刻；唯一显示名；禁止调用 runNow。';
    next['执行步骤'] = '1. 从自动化页用公开 API 创建 intervalMs=60000、activeFrom=当前时刻的定义\n2. listLocal 与可见列表读回同一 ID/名称\n3. 禁止 runNow，等待首次真实 interval tick 自动触发\n4. 核对 triggerKind、occurrenceKey、scheduledFor/scheduledAt、sessionId 和 succeeded\n5. 只删除本 Case run 与 definition，refresh 后有界连续读回 definition 消失';
    next['预期结果'] = '不调用 runNow；约 60 秒后产生真实 schedule run；运行身份完整且 succeeded；definition 与 run 定向清理并经 refresh 终态对账。';
    next = appendHardOracles(next, [
      'intervalMs 精确为 60000，activeFrom 使用创建时当前时刻，禁止回填过去时间',
      '删除 definition 后显式 refresh，并在有界窗口内读回目标 definition 消失',
    ]);
  }
  if (id === 'MRSMOKE-SKILL-001') {
    next = withEvidenceRole(next, 'skill_install_attempt_ledger');
    next['测试场景'] = 'Skill 依赖安装以 personal installAttempt 事务提交/回滚，并保持任务级选择隔离';
    next['执行步骤'] = '1. 通过可见技能市场安装含必填依赖的确定性 Skill，读取 personal installAttempt、operationId 与成功库存/历史。\n2. 安装含失败必填依赖的确定性 Skill，读取失败 attempt 并证明只回滚本 attempt、库存/个人历史无残留。\n3. 选择隔离 Skill 完成任务 A/B 选择、移除和回复标记闭环。\n4. 定向卸载本 Case Fixture。';
    next['预期结果'] = '成功 attempt 原子提交根技能与依赖；失败 attempt 原子回滚且不污染个人历史；每项 operationId 稳定；任务 A/B 技能选择不串扰。';
    next['来源ID'] = `${asString(next['来源ID'])}; MR!1277; MR!1292; MR!1295; MR!1302; MR!1311`;
    next = appendHardOracles(next, [
      '成功安装产生 schemaVersion=1、scope=personal 的 installAttempt，并按 operationId 提交根技能与依赖',
      '依赖失败产生 failed_rolled_back attempt，installed/history 对该 attempt 均无残留',
      '任务 A/B 技能选择与移除仍保持 task-bound 隔离',
    ]);
  }
  if (id === 'MRSMOKE-ACT-001') next['来源ID'] = `${asString(next['来源ID'])}; MR!1304; MR!1315`;
  if (id === 'MRSMOKE-ACT-001') next['来源ID'] = `${asString(next['来源ID'])}; MR!1328`;
  if (id === 'MRSMOKE-AUTO-001') next['来源ID'] = `${asString(next['来源ID'])}; MR!1328`;
  if (id === 'MRSMOKE-NAV-001') next['来源ID'] = `${asString(next['来源ID'])}; MR!1328`;
  if (id === 'MRSMOKE-ROUTE-001') next['来源ID'] = `${asString(next['来源ID'])}; MR!1280; MR!1315`;
  if (id === 'MRSMOKE-FAIL-001') next['来源ID'] = `${asString(next['来源ID'])}; MR!1292; MR!1315; MR!1319; MR!1327`;
  if (id === 'MRSMOKE-ENTRY-001') next['来源ID'] = `${asString(next['来源ID'])}; MR!1280`;
  if (id === 'MRSMOKE-CHART-001') {
    next['产品模块'] = '内置图表与助手消息';
    next['子模块'] = 'MR 核心冒烟';
    next['测试场景'] = 'qbot_chart 四点柱状图以 qcharts-react 交互 SVG 渲染，内容、运行身份和响应式边界完整';
    next['测试数据'] = '必须且只能调用内置 qbot_chart 的 render_chart 生成柱状图。数据固定为：曝光 12000、点击 860、报名 240、成交 28。图中必须显示四个类别名称和四个固定数值标签，不要输出 SVG data URI、base64 或编码正文。';
    next['执行步骤'] = '1. 新建干净任务，技能禁用、连接器自动。\n2. 发送固定四点柱状图请求并等待同 taskId 终态。\n3. 对账确认发送、session、runtime authority、builtin:qbot_chart materialization、provider receipt 和同轮 render_chart tool part。\n4. 等待图表渲染收敛，读取唯一 qcharts-react SVG、四个标签/数值、静态与 fallback 计数。\n5. 核对图表位于 assistant/container 边界内，container、assistant、message-list、document 均无横向溢出，正文无 SVG data URI/base64 泄漏。';
    next['预期结果'] = '同轮真实调用 qbot_chart/render_chart；合法 type/data 四点 envelope 以唯一 qcharts-react SVG 渲染；无静态或失败 fallback；四个标签与数值可读；布局无横向溢出；正文无编码泄漏。';
    next['来源ID'] = 'MR!1298; SIT-CONN-016; CHART-1360-001';
    next['用例类型'] = 'mcp_use';
    next['风险域'] = 'functional,security_privacy,reliability_recovery';
    next['Oracle类型'] = 'task_bound_tool_result+runtime_authority+interactive_svg+layout_bounds';
    next['生产观测指标'] = 'qbot_chart调用成功率、qcharts交互渲染率、fallback率、图表溢出率、编码泄漏数';
    next['必需Fixture'] = 'public_product_state,account:authenticated,release_identity:frozen,builtin:qbot_chart';
    next['动作计划JSON'] = json(actionPlan(id, 'mcp_use', next['执行步骤']));
    next['会话轮次JSON'] = json([{
      label: '交互图表核心冒烟',
      prompt: next['测试数据'],
      oracle: next['预期结果'],
    }]);
    next['精准断言JSON'] = json(assertions([
      '确认发送、taskId、session、runtime authority、provider receipt 与同轮 qbot_chart/render_chart tool part 全等绑定',
      'envelope kind=qbot-chart-result、mimeType=image/svg+xml、type 非空且 data 精确为曝光12000/点击860/报名240/成交28',
      '唯一 qcharts-react SVG 可见且非零；静态 qbot-chart-result 与 qbot-chart-result-fallback 均不存在',
      'SVG 中四个标签和四个固定数值可读，图表位于 assistant/container 边界且四层横向溢出均为零',
      '助手正文不包含 SVG data URI、base64 或长编码文本',
    ], next['预期结果']));
    next = withEvidenceRole(next, 'interactive_chart_readback');
  }
  return next;
}

function patchFullFunctionRecentCase(testCase) {
  const id = asString(testCase['用例ID']);
  let next = { ...testCase };
  if (id === 'SIT-HOME-044') {
    next['测试场景'] = 'picker、paste、drag 三入口统一 FileInput ingress；81 MiB 发送前拒绝；删除后恢复前两份附件且顺序/identity 不漂移';
    next['测试数据'] = '三份不同内容/同名或可区分标记的确定性附件；分别经 picker、paste、drag 进入；另准备总量 81 MiB 拒绝组合。';
    next['自动化执行步骤'] = '1. 分别通过 picker、paste、drag 上传三份确定性文件并核对统一 descriptor。\n2. 删除指定附件并验证剩余前两份的顺序与 identity。\n3. 恢复被删附件并核对三份顺序。\n4. 尝试 81 MiB 总量并证明发送前拒绝、零 task/消息/send。';
    next['来源ID'] = `${asString(next['来源ID'])},MR!1305,MR!1314`;
    next = appendHardOracles(next, [
      'picker/paste/drag 三入口进入同一 Composer FileInput 合同',
      '81 MiB 总量发送前拒绝且不创建 task/消息/send receipt',
      '删除后前两份附件 identity 与顺序保持，恢复后完整三份可读',
    ]);
  }
  if (id === 'SIT-WORKSPACE-001') {
    next = withEvidenceRole(next, 'workspace_missing_error_readback');
    next['来源ID'] = `${asString(next['来源ID'])},MR!1319`;
    next = appendHardOracles(next, [
      '授权 cwd 删除后在原 task 重发，结构化 chat.workspace.cwd_missing 精确绑定原 cwd 且 retryable=false',
      '用户可见提示隐藏 causeCode、内部 errorCode 与 stack',
    ]);
  }
  if (['SIT-SKILL-030', 'SIT-SKILL-032'].includes(id)) {
    next = withEvidenceRole(next, 'skill_install_attempt_ledger');
    next['来源ID'] = `${asString(next['来源ID'])},MR!1302,MR!1311`;
    next = appendHardOracles(next, [
      id === 'SIT-SKILL-030'
        ? 'personal installAttempt 以稳定 operationId 原子提交根技能和全部必填依赖'
        : '失败 personal installAttempt 只回滚本 attempt，installed 与个人 history 均无残留',
    ]);
  }
  if (id === 'SIT-CONN-019') {
    next = withEvidenceRole(next, 'external_navigation_trace');
    next['来源ID'] = `${asString(next['来源ID'])},MR!1293,MR!1294,MR!1296,MR!1297,MR!1300,MR!1303,MR!1323`;
    next = appendHardOracles(next, [
      'Web 业务 Oracle、同 task runtime authority/provider receipt 与外链 openPreview 终态分别成立',
    ]);
  }
  if (id === 'SIT-CONN-016') {
    next = withEvidenceRole(next, 'interactive_chart_readback');
    next['用例类型'] = 'mcp_use';
    next['测试场景'] = '内置 qbot_chart 四点柱状图以 qcharts-react 交互 SVG 渲染，任务/运行身份、内容与响应式边界完整';
    next['测试数据'] = '必须且只能调用内置 qbot_chart 的 render_chart 生成柱状图。数据固定为：曝光 12000、点击 860、报名 240、成交 28。图中必须显示四个类别名称和四个固定数值标签，不要输出 SVG data URI、base64 或编码正文。';
    next['自动化执行步骤'] = '1. 新建任务，技能禁用、连接器自动。\n2. 发送固定四点请求并等待同 taskId 终态。\n3. 对账确认发送、session、runtime authority、provider receipt 与同轮 render_chart tool part。\n4. 读取唯一 qcharts-react SVG、四个标签/数值以及静态/fallback 计数。\n5. 核对 assistant/container/message-list/document 边界无横向溢出，正文无编码泄漏。';
    next['预期结果'] = '真实 qbot_chart 调用与运行身份完整；type/data 四点 envelope 以唯一交互 SVG 渲染；无静态/fallback；标签数值可读；布局无溢出；正文无 SVG/base64 泄漏。';
    next['来源ID'] = `${asString(next['来源ID'])},MR!1298,CHART-1360-001`;
    next['动作计划JSON'] = json(actionPlan(id, 'mcp_use', next['自动化执行步骤']));
    next['会话轮次JSON'] = json([{
      label: '交互图表门禁',
      prompt: next['测试数据'],
      oracle: next['预期结果'],
    }]);
    next['精准断言JSON'] = json(assertions([
      '确认发送、taskId、session、runtime authority、provider receipt 与同轮 qbot_chart/render_chart tool part 全等绑定',
      'envelope type 非空且 data 精确为曝光12000/点击860/报名240/成交28',
      '唯一 qcharts-react SVG 可见，四个标签与数值可读，静态/fallback 均不存在',
      '图表位于 assistant/container 边界，container/assistant/message-list/document 无横向溢出',
      '助手正文无 SVG data URI、base64 或长编码泄漏',
    ], next['预期结果']));
  }
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

function legacyConversationTurns(source) {
  const generated = buildConversationTurns(source, []);
  const finalOracle = asString(source.success_criteria || source.expected_result);
  return generated.map((turn, index) => ({
    turn: index + 1,
    label: asString(turn.label) || `第${index + 1}轮`,
    prompt: asString(turn.prompt),
    oracle: asString(turn.expectedDescription)
      || (index === generated.length - 1
        ? finalOracle
        : '本轮回复应完成当前指令、保持同一任务上下文，且不得改写前序已确认的业务事实。'),
  })).filter((turn) => turn.prompt);
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
  const turns = conversationRequired ? legacyConversationTurns(migrated) : [];
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
    '版本范围': `${PRODUCT_REF}@${PRODUCT_COMMIT};Teams>=5.3.0;QWork>=${PRODUCT_VERSION}`,
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
  let next = patchBaseline(testCase);
  if (id === 'BETA-FILE-006') {
    next['测试场景'] = '不支持类型、单文件超限与81 MiB总量均发送前拒绝；总量拒绝只拒第3份并保留前2份，删除后可恢复额度';
    next['测试数据'] = '不支持扩展名fixture；>30 MiB单文件；picker与paste各27 MiB后，以drag加入第3份27 MiB使累计达到81 MiB。';
    next['自动化执行步骤'] = '1. 分别验证不支持类型和单文件超限发送前拒绝且Composer为空\n2. 通过picker、paste加入前两份27 MiB附件\n3. 通过drag加入第3份27 MiB并断言只拒绝第3份、前两份同序保留\n4. 删除第一份后通过公开stageFiles重新加入第3份并核对额度恢复\n5. 全程核对零task/消息/send并定向清理';
    next['预期结果'] = '三类原因准确提示；累计81 MiB只拒绝第3份且保留前两份；删除后可重新加入第3份；全程无半成品任务或消息。';
    next['来源ID'] = `${asString(next['来源ID'])},MR!1305,MR!1314`;
    next = appendHardOracles(next, [
      '累计达到81 MiB时只拒绝第3份，前两份附件identity与顺序保持不变',
      '删除第一份后公开stageFiles可重新加入原第3份并保持零task/消息/send',
    ]);
  }
  if (id === 'BETA-FILE-008') {
    next['测试场景'] = 'picker、drag、clipboard三入口进入统一FileInput合同；预览可读，删除并重新加入后identity与顺序不漂移';
    next['自动化执行步骤'] = '1. 通过picker、drag和clipboard分别加入三个确定性附件并逐步读回Composer\n2. 打开clipboard图片预览并核对非空像素\n3. 删除clipboard附件，再次粘贴并核对恢复为3份且无重复\n4. 发送并核对Agent逐项引用三个附件';
    next['预期结果'] = '三入口各只增加一份附件并进入统一descriptor；预览非空；删除后恢复无重复；回复逐项引用。';
    next['来源ID'] = `${asString(next['来源ID'])},MR!1305,MR!1314`;
    next = appendHardOracles(next, [
      'picker、drag、clipboard三入口各增加且仅增加一个统一附件descriptor',
      'clipboard附件删除后重新粘贴恢复为3份且同名只出现一次',
    ]);
  }
  if (id === 'BETA-FILE-009') {
    next['来源ID'] = `${asString(next['来源ID'])},MR!1305,MR!1314`;
    next = appendHardOracles(next, [
      '同名不同SHA附件按卡片identity精确删除，保留项顺序稳定且回复不引用已删内容',
    ]);
  }
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
    next['来源类型'] = '近2天MR回归+自包含门禁重构';
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
    next['前置条件'] = 'BETA-EXPERT-007已发布本轮专家；当前账号已登录；Expert v2 bridge与M3模型可用。';
    next['测试数据'] = '按专家display.label和稳定expertId搜索；确定性短提示：请用一句话回答：你当前能以专家身份协助什么工作？';
    next['自动化执行步骤'] = '1. 读取expertLifecycle完整列表和owned=true集合\n2. 打开发布记录并核对计数/可见ID严格等于owned集合\n3. 按display.label搜索本轮已发布专家并读回详情identity\n4. 新建taskId为空的干净草稿，执行recordRecent+setExpert后发送确定性短提示\n5. 核对新taskId、expertId/versionId/releaseId、Composer与最近召唤一致';
    next['预期结果'] = '共享/内置专家只出现在专家中心对应分组，不进入发布记录；本人专家可搜索、查看并在本Case新任务中完成召唤。';
    next['成功判定'] = '发布记录计数与可见ID严格等于owned=true集合；搜索命中；发送后产生非空且不同于上游Case的新taskId；expertId/versionId/releaseId在选择、任务与最近召唤中一致。';
    next['来源ID'] = `${asString(next['来源ID'])},MR!1065`.replace(/^,/, '');
    const evidenceRoles = unique([
      ...asString(next['证据要求']).split(',').map((role) => role.trim()),
      ...CONVERSATION_EVIDENCE_ROLES,
      'product_state_diff',
    ]);
    next['证据要求'] = evidenceRoles.join(',');
    next['证据角色'] = evidenceRoles.join(',');
    next['会话轮次JSON'] = json([{
      turn: 1,
      prompt: '请用一句话回答：你当前能以专家身份协助什么工作？',
      oracle: '回复完成；发送后生成本Case独立taskId，且expertId/versionId/releaseId与本次召唤一致。',
    }]);
    next['动作计划JSON'] = json(actionPlan(id, 'expert_lifecycle', next['自动化执行步骤']));
    const precise = parseJson(next['精准断言JSON'], {});
    precise.hard_oracles = unique([
      ...(precise.hard_oracles || []),
      '发布记录可见ID与owned=true集合完全一致',
      '召唤前为干净草稿；发送后taskId非空且不等于上游Case taskId',
      'expertId/versionId/releaseId在选择、任务与最近召唤中完全一致',
    ]);
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
      '来源类型': '近2天MR新增原生回归',
      '备注': `Composer history navigation；${PRODUCT_REF}@${PRODUCT_COMMIT}。`,
      '风险域': 'functional,data_integrity_isolation,reliability_recovery',
      '判定Oracle': 'task_bound_history_readback+draft_restore',
      '确定性': '是',
      '重复策略': '同一冻结发布身份连续5个全量轮次；任一非pass、阻塞、波动、继承/synthetic或证据缺失都会把连续全绿计数归零',
      '必需Fixture': 'runtime:ready,account:authenticated,composer:clean',
      '硬门禁': '是',
      '版本范围': `${PRODUCT_REF}@${PRODUCT_COMMIT};Teams>=5.3.0;QWork>=${PRODUCT_VERSION}`,
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
      '来源类型': '近2天MR新增原生回归',
      '备注': `Composer model menu SDK filter；${PRODUCT_REF}@${PRODUCT_COMMIT}。`,
      '风险域': 'functional,compatibility_upgrade,data_integrity_isolation',
      '判定Oracle': 'connection_view+visible_model_multiset',
      '确定性': '是',
      '重复策略': '同一冻结发布身份连续5个全量轮次；任一非pass、阻塞、波动、继承/synthetic或证据缺失都会把连续全绿计数归零',
      '必需Fixture': 'runtime:ready,account:authenticated,model_options:min1',
      '硬门禁': '是',
      '版本范围': `${PRODUCT_REF}@${PRODUCT_COMMIT};Teams>=5.3.0;QWork>=${PRODUCT_VERSION}`,
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
  if (/qcharts|interactive-chart|chart-view|chart-tool/.test(text)) add('MRSMOKE-CHART-001', 'SIT-CONN-016');
  if (/reasoning-scroll|chat-ui|avatar|assistant-thread|turn-context|capability-isolation/.test(text)) add('BETA-CHAT-005', 'BETA-CHAT-007');
  if (/expert|handoff/.test(text)) add('BETA-EXPERT-001', 'BETA-EXPERT-007', 'BETA-EXPERT-012');
  if (/attachment|file|enametoolong/.test(text)) add('BETA-FILE-005', 'BETA-FILE-006', 'BETA-FILE-007');
  if (/teams|desktop|runtime|bootstrap|host-core|ota|recovery-readiness/.test(text)) add('BETA-INIT-001', 'BETA-REC-001', 'BETA-REC-002', 'BETA-HOST-003');
  if (/secret|security|auth-shell|terminal-arbitration/.test(text)) add('BETA-CHAT-009', 'BETA-SEC-002');
  add(...(RECENT_MR_CASE_MAPPING.get(String(mr.mr || '')) || []));
  return unique(mappings);
}

function mrArea(mr) {
  const text = `${mr.branch} ${mr.files.join(' ')}`.toLowerCase();
  if (/composer|chat|thread/.test(text)) return '会话与Composer';
  if (/expert/.test(text)) return '专家';
  if (/skill/.test(text)) return 'Skill';
  if (/qcharts|interactive-chart|chart-view|chart-tool/.test(text)) return '交互图表';
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
    return ['近2天语义替换', '旧场景移出；同一Case ID已重写为近2天高风险原生场景。'];
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
  const inspectionScopes = [
    { sheetName: '新增MR核心冒烟', rowCount: 14, lastColumn: 'AM' },
    { sheetName: '生产灰度门禁Case', rowCount: 74, lastColumn: 'AO' },
    { sheetName: '全量功能回归Case', rowCount: 164, lastColumn: 'AO' },
    { sheetName: '近2天MR覆盖', rowCount: 40, lastColumn: 'J' },
    { sheetName: '源码依据', rowCount: 20, lastColumn: 'D' },
  ];
  for (const { sheetName, rowCount, lastColumn } of inspectionScopes) {
    const result = await workbook.inspect({
      kind: 'table',
      range: `${sheetName}!A1:${lastColumn}${rowCount}`,
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
    const largeCaseSheet = ['新增MR核心冒烟', '生产灰度门禁Case', '全量功能回归Case'].includes(sheetName);
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
  const expertCasePreview = await workbook.render({
    sheetName: '生产灰度门禁Case',
    range: 'A44:AO49',
    scale: 0.75,
    format: 'png',
  });
  const expertCaseFile = path.join(renderDir, '13-BETA-EXPERT-001-focused.png');
  await fs.writeFile(expertCaseFile, new Uint8Array(await expertCasePreview.arrayBuffer()));
  rendered.push(expertCaseFile);
  return { inspection_file: path.join(verificationDir, 'inspection.ndjson'), rendered };
}

async function main() {
  git(['cat-file', '-e', `${PRODUCT_COMMIT}^{commit}`]);
  const sourceWorkbook = await SpreadsheetFile.importXlsx(await FileBlob.load(SOURCE));
  const sourceValues = sourceWorkbook.worksheets.getItem('核心内测Case').getRange('A1:AO188').values;
  const { headers, cases: allCases } = sourceCases(sourceValues);
  const smokeSourceWorkbook = await SpreadsheetFile.importXlsx(await FileBlob.load(SMOKE_SOURCE));
  const smokeSourceValues = smokeSourceWorkbook.worksheets.getItem('新增MR核心冒烟').getUsedRange().values;
  const { headers: smokeHeaders, cases: rawSmokeCases } = sourceCases(smokeSourceValues);
  const smokeById = new Map(rawSmokeCases.map((testCase) => [asString(testCase['用例ID']), testCase]));
  const smokeCases = SMOKE_CASE_IDS.map((id) => {
    const testCase = smokeById.get(id) || (id === 'MRSMOKE-CHART-001'
      ? { ...smokeById.get('MRSMOKE-WEB-001'), '用例ID': id }
      : null);
    if (!testCase) throw new Error(`新增MR核心冒烟源数据缺失：${id}`);
    return patchSmokeCase(testCase);
  });
  if (rawSmokeCases.length !== 11 || smokeById.size !== 11 || smokeCases.length !== 12) {
    throw new Error(`新增MR核心冒烟必须由11条历史源加1条交互图表组成且ID唯一，actual=${rawSmokeCases.length}/${smokeById.size}/${smokeCases.length}`);
  }
  const gateCoreCases = orderCases(allCases
    .filter((testCase) => capability(testCase).directlyRunnable)
    .filter((testCase) => !EXCLUDED_ACCOUNT_CASES.has(asString(testCase['用例ID'])))
    .filter((testCase) => !PRODUCTION_GRAY_EXCLUDED_RARE_CASE_IDS.has(asString(testCase['用例ID'])))
    .map(patchRecentCases));
  const fullFunctionPool = (await loadFullFunctionLegacyCases()).map(patchFullFunctionRecentCase);
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
  const fullIdSet = new Set(fullIds);
  const smokeIdSet = new Set(SMOKE_CASE_IDS);
  const smokeCapability = capabilitySet(smokeCases);
  const gateCapability = capabilitySet(gateCases);
  const addonCapability = capabilitySet(regressionAddons);
  const fullCapability = capabilitySet(fullCases);
  for (const [scope, summary] of [['12条冒烟', smokeCapability], ['70条门禁', gateCapability], ['160条全量', fullCapability]]) {
    if (summary.strict.length) {
      throw new Error(`${scope}仍含strict controller：${summary.strict.map((item) => item.testCase['用例ID']).join(',')}`);
    }
    if (summary.unsupported.length) {
      throw new Error(`${scope}仍含unsupported runtime：${summary.unsupported.map((item) => item.testCase['用例ID']).join(',')}`);
    }
  }
  const mrRows = mergedMrs().map((mr) => {
    const mappings = mrMapping(mr).filter((id) => smokeIdSet.has(id) || gateIdSet.has(id) || fullIdSet.has(id));
    const area = mrArea(mr);
    const desktopRelevant = mappings.length > 0;
    const smokeMappings = mappings.filter((id) => smokeIdSet.has(id));
    const gateMappings = mappings.filter((id) => gateIdSet.has(id));
    const fullMappings = mappings.filter((id) => fullIdSet.has(id) && !gateIdSet.has(id));
    const staticAudit = RECENT_MR_STATIC_AUDITS.get(String(mr.mr || ''));
    if (staticAudit && JSON.stringify(mr.files) !== JSON.stringify(staticAudit.expectedFiles)) {
      throw new Error(`MR !${mr.mr}静态审计文件漂移：expected=${staticAudit.expectedFiles.join(',')} actual=${mr.files.join(',')}`);
    }
    const layers = unique([
      smokeMappings.length ? '12条冒烟' : '',
      gateMappings.length ? '70条门禁' : '',
      fullMappings.length ? '160条增量' : '',
    ]);
    return [
      mr.mergedAt.replace('T', ' ').slice(0, 19),
      mr.mr ? `!${mr.mr}` : '',
      mr.commit.slice(0, 12),
      mr.branch,
      area,
      mr.files.slice(0, 8).join('\n'),
      mappings.join(','),
      layers.join('+') || '静态合同审计',
      desktopRelevant ? '纳入当前框架可执行Case' : (staticAudit?.disposition || 'Dashboard/CI/设计/发布工程变更不冒充桌面QWork E2E'),
      desktopRelevant
        ? '由映射Case的真实UI动作与公开状态Oracle覆盖'
        : (staticAudit?.reason || '保留merge commit与文件清单；由源码单测/发布工程检查负责，不计12/70/160桌面通过'),
    ];
  });
  if (mrRows.length !== 35) throw new Error(`近2天直接合入MR必须恰好35个，actual=${mrRows.length}`);
  const mr1329 = mrRows.find((row) => row[1] === '!1329');
  if (!mr1329
    || mr1329[5] !== '.gitlab-ci.yml'
    || mr1329[6] !== ''
    || mr1329[7] !== '静态合同审计'
    || !/CI-only/.test(mr1329[8])
    || !/sha256:3410bb/.test(mr1329[9])) {
    throw new Error(`MR !1329必须明确映射为CI-only静态合同审计且不新增桌面Case：${JSON.stringify(mr1329)}`);
  }
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
  const smokeSheet = addSheet(
    workbook,
    '新增MR核心冒烟',
    'QWork 近2天新增 MR 核心冒烟自动化 Casebook（12条）',
    `基线 ${PRODUCT_REF}@${PRODUCT_COMMIT}（v${PRODUCT_VERSION}）；固定顺序12/12可执行、可分发、可直接运行；只承担新增MR核心冒烟，不替代70/160发布门禁。`,
    smokeHeaders,
    matrix(smokeHeaders, smokeCases),
    [135, 70, 130, 130, 360, 360, 360, 460, 380, 380, 380, 360, 170, 80, 300, 230, 300, 420, 350, 100, 80, 160, 380, 150, 180, 220, 190, 240, 260, 90, 360, 300, 90, 360, 300, 480, 480, 520, 420],
  );
  smokeSheet.getRangeByIndexes(4, 1, smokeCases.length, 1).format.fill = '#E8F4F1';
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
      ['新增MR核心冒烟', 12, '固定顺序独立READY后先执行并逐Case可信复核', '新增MR核心冒烟'],
      ['近2天直接合并MR', mrRows.length, '全部记录自动化映射或静态审计结论', '近2天MR覆盖'],
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
      ['mr_smoke_case_count', 12, 'pretest/runner/trusted-review', '固定12且顺序不可漂移', '先于70条执行；不能替代生产灰度门禁'],
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
  addSheet(workbook, '近2天MR覆盖', '近2天release/0.1直接合并MR审计', `窗口 ${MR_WINDOW_START} 至 ${MR_WINDOW_END}；以first-parent直接合入${PRODUCT_REF}为准，共${mrRows.length}个merge commit。Dashboard/CI/设计变更保留静态合同审计，不冒充桌面E2E。`,
    ['合并时间', 'MR', 'Merge commit', '分支/主题', '领域', '主要变更文件', '映射Case', '覆盖层', '处置', '理由'], mrRows,
    [165, 70, 110, 300, 130, 360, 320, 160, 260, 420]);
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
      ['产品源码', `/Users/qifu/Documents/deepbankV2 ${PRODUCT_REF}@${PRODUCT_COMMIT}`, '近2天MR与产品行为设计依据', `git cat-file -e ${PRODUCT_COMMIT}^{commit}`],
      ['上一Casebook产品基线', PREVIOUS_PRODUCT_COMMIT, '限定本次MR增量审计起点', `git log ${PREVIOUS_PRODUCT_COMMIT}..${PRODUCT_COMMIT} --first-parent --merges`],
      ['产品版本', PRODUCT_VERSION, 'release/0.1 package.json', `git show ${PRODUCT_COMMIT}:package.json`],
      ['源Casebook', SOURCE, '184条历史合同与字段/样式来源', '只读导入'],
      ['MR冒烟源Casebook', SMOKE_SOURCE, '历史11条固定顺序合同来源', '只读导入并按近2天MR补强，追加1条交互图表'],
      ['新Casebook', FORMAL_OUTPUT, '12条MR冒烟+70条生产门禁+160条全量功能回归合同', 'SHA写入两份框架规范'],
      ['框架协议', 'src/lib/core-beta-case-protocol.mjs', '独立scenario/fixture/证据契约', 'test/core-beta-case-protocol.mjs'],
      ['原生Runner', 'src/lib/ui-agent-casebook-runner-v2.mjs', '真实UI/bridge/CDP执行与Oracle', 'test/framework-invariants-v2.mjs'],
      ['能力审计', 'npm run core-beta:capability-audit', 'dispatchable/native/controller统计', 'strict_controller_required=0'],
      ['动态预检', 'npm run core-beta:pretest', '身份、fixture、CDP、唯一runner', 'READY才可启动'],
      ['灰度判定', 'npm run core-beta:gray-gate', '5轮+soak发布决策', 'GO_CONTROLLED_GRAY'],
    ], [150, 520, 420, 360]);

  const outputDir = path.resolve(option('out', DEFAULT_OUTPUT_DIR));
  await fs.mkdir(outputDir, { recursive: true });
  const sheetNames = [
    '新增MR核心冒烟', '生产灰度门禁Case', '全量功能回归Case', '设计总览', '覆盖矩阵', '执行配置',
    '证据与断言', '删除场景清单', '执行器映射', '近2天MR覆盖', '生产灰度准入',
    '发布判定', '源码依据',
  ];
  const verification = await verifyWorkbook(workbook, outputDir, sheetNames);
  const outputFile = path.join(outputDir, OUTPUT_NAME);
  const xlsx = await SpreadsheetFile.exportXlsx(workbook);
  await xlsx.save(outputFile);
  await fs.copyFile(outputFile, FORMAL_OUTPUT);
  const audit = {
    schema_version: 'qbot-release01-combined-casebook-build/v3',
    generated_at: new Date().toISOString(),
    product: { ref: PRODUCT_REF, commit: PRODUCT_COMMIT, version: PRODUCT_VERSION },
    smoke_case_count: smokeCases.length,
    smoke_case_ids: smokeCases.map((item) => item['用例ID']),
    smoke_capability_summary: smokeCapability.counts,
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
