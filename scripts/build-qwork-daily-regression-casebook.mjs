#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { FileBlob, SpreadsheetFile } from '@oai/artifact-tool';
import { CORE_BETA_SCENARIO_REGISTRY } from '../src/lib/core-beta-case-protocol.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const DEFAULT_SOURCE = '/Users/qifu/Library/Containers/com.tencent.xinWeChat/Data/Documents/xwechat_files/wxid_si39svriam0t12_7484/msg/file/2026-08/QWork全量测试用例_合并去重版_2026-08-11.xlsx';
const DEFAULT_BASELINE = path.join(ROOT, 'PRD', 'QBot生产灰度与全量功能回归Casebook_160条_2026-08-11.xlsx');
const DEFAULT_OUTPUT = path.join(ROOT, 'PRD', 'QWork日常回归自动化Casebook_83条_2026-08-12.xlsx');
const SHEET = '日常回归';
const SOURCE_COLS = 16;
const CUSTOM_LEAF = new Map([
  ['QW-ENTRY-002', 'QWD-ENTRY-002'],
  ['QW-WS-001', 'QWD-WS-001'],
  ['QW-ART-007', 'QWD-ART-007'],
  ['QW-ART-008', 'QWD-ART-008'],
  ['QW-EXPERT-002', 'QWD-EXPERT-002'],
  ['QW-EXPERT-009', 'QWD-EXPERT-009'],
  ['QW-EXPERT-011', 'QWD-EXPERT-011'],
  ['QW-AUTO-002', 'QWD-AUTO-002'],
  ['QW-AUTO-003', 'QWD-AUTO-003'],
  ['QW-AUTO-004', 'QWD-AUTO-004'],
  ['QW-SYS-003', 'QWD-SYS-003'],
  ['QW-MEM-002', 'QWD-MEM-002'],
  ['QW-SEC-002', 'QWD-SEC-002'],
  ['QW-SEC-005', 'QWD-SEC-005'],
]);

function option(name, fallback = '') {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? String(process.argv[index + 1] || '') : fallback;
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function matrixSha256(values) {
  return createHash('sha256').update(JSON.stringify(values)).digest('hex');
}

function parseSourceRows(values) {
  const headers = values[0].map((value) => String(value || '').trim());
  const index = new Map(headers.map((header, column) => [header, column]));
  return values.slice(1).filter((row) => String(row[index.get('用例ID')] || '').trim()).map((row, offset) => ({
    row_number: offset + 2,
    values: row.slice(0, SOURCE_COLS),
    id: String(row[index.get('用例ID')] || '').trim(),
    module: String(row[index.get('模块')] || '').trim(),
    level: String(row[index.get('层级')] || '').trim(),
    priority: String(row[index.get('优先级')] || '').trim(),
    frequency: String(row[index.get('执行频率')] || '').trim(),
    scenario: String(row[index.get('用户场景')] || '').trim(),
    precondition: String(row[index.get('前置条件')] || '').trim(),
    steps: String(row[index.get('实际步骤')] || '').trim(),
    expected: String(row[index.get('预期结果')] || '').trim(),
    success: String(row[index.get('严格通过标准')] || '').trim(),
    evidence: String(row[index.get('交叉验证/证据')] || '').trim(),
    source: String(row[index.get('来源/优化说明')] || '').trim(),
  }));
}

function extractMappedIds(row, baselineById) {
  if (row.id === 'QW-ENTRY-002') return ['BETA-INIT-004', CUSTOM_LEAF.get(row.id)];
  if (CUSTOM_LEAF.has(row.id)) return [CUSTOM_LEAF.get(row.id)];
  const ids = unique([...row.source.matchAll(/(?:BETA|SIT)-[A-Z0-9-]+/g)].map((match) => match[0]));
  const mapped = ids.filter((id) => baselineById.has(id));
  if (row.id === 'QW-EXPERT-005') {
    return unique([
      'BETA-EXPERT-003',
      'BETA-EXPERT-007',
      ...mapped.filter((id) => !['BETA-EXPERT-003', 'BETA-EXPERT-007'].includes(id)),
    ]).filter((id) => baselineById.has(id));
  }
  return unique(mapped);
}

function conversationRoles() {
  return ['task_id', 'prompt', 'send_receipt', 'transcript', 'reply_delta', 'reply_completion'];
}

function customType(id) {
  if (id === 'QWD-ENTRY-002') return 'task_lifecycle';
  if (id === 'QWD-WS-001') return 'task_lifecycle';
  if (id.startsWith('QWD-ART-')) return 'artifact';
  if (id.startsWith('QWD-EXPERT-')) return 'expert_lifecycle';
  if (id === 'QWD-AUTO-003') return 'capability_activation';
  if (id.startsWith('QWD-AUTO-')) return 'model_routing';
  if (id.startsWith('QWD-SYS-')) return 'settings_lifecycle';
  if (id.startsWith('QWD-MEM-')) return 'memory_lifecycle';
  return 'security_privacy';
}

function customEvidenceRoles(id) {
  const base = ['before_screenshot', 'action_receipt', 'after_screenshot', 'public_state_readback', 'cleanup_readback', 'qwork_daily_readback'];
  if (id === 'QWD-ENTRY-002') return [...base, ...conversationRoles(), 'capability_selection', 'capability_execution_event', 'composer_attachment_state', 'data_integrity_readback'];
  if (id === 'QWD-WS-001') return [...base, ...conversationRoles(), 'data_integrity_readback'];
  if (id === 'QWD-ART-007') return [...base, ...conversationRoles(), 'artifact_path_sha256', 'content_readback'];
  if (id === 'QWD-ART-008') return [...base, ...conversationRoles(), 'artifact_path_sha256', 'data_integrity_readback'];
  if (id === 'QWD-EXPERT-002') return [...base, 'capability_inventory', 'expert_identity_snapshot'];
  if (id.startsWith('QWD-EXPERT-')) return [...base, ...conversationRoles(), 'capability_selection', 'capability_execution_event', 'expert_identity_snapshot', 'expert_draft_lifecycle', 'expert_publish_operation', 'expert_runtime_trace', 'expert_history_readback'];
  if (id === 'QWD-AUTO-002') return [...base, ...conversationRoles(), 'model_route_trace'];
  if (id === 'QWD-AUTO-003') return [...base, ...conversationRoles(), 'activation_snapshot', 'capability_selection', 'capability_execution_event'];
  if (id === 'QWD-AUTO-004') return [...base, ...conversationRoles(), 'negative_ui_trace'];
  if (id === 'QWD-SYS-003') return [...base, ...conversationRoles(), 'settings_readback'];
  if (id === 'QWD-MEM-002') return [...base, ...conversationRoles(), 'memory_snapshot_trace'];
  if (id === 'QWD-SEC-002') return [...base, ...conversationRoles(), 'attachment_name_size_sha256', 'composer_attachment_state', 'attachment_readback', 'negative_tool_trace', 'security_boundary_trace'];
  return [...base, 'credential_redaction_scan', 'security_boundary_trace', 'negative_ui_trace', 'log_excerpt'];
}

function customTurns(id) {
  const prompts = {
    'QWD-ENTRY-002': '请用一句话确认当前任务上下文已建立。',
    'QWD-WS-001': '在工作空间A建立任务并读取标记，随后验证已建任务不能静默切换到B，而新任务可以选择B。',
    'QWD-ART-007': '把 Markdown 成果保存到指定相对目录，并在回复与成果区显示同一路径。',
    'QWD-ART-008': '已有同名文件时两个都留，原文件不可在任何时刻被改写。',
    'QWD-EXPERT-009': '组织可见专家发布后，由owner完成首轮真实任务。',
    'QWD-EXPERT-011': '仅自己可见专家发布后连续完成计划、修订和最终交付三轮任务。',
    'QWD-AUTO-002': '同一任务连续追问三轮，再以新任务验证独立路由决策。',
    'QWD-AUTO-003': '发送前选择能力，首轮冻结authority，下一轮更新并验证新任务隔离。',
    'QWD-AUTO-004': '读取未上传附件并给出用户可操作的恢复方案。',
    'QWD-SYS-003': '保存画像与人设后在新任务验证称呼和回答顺序。',
    'QWD-MEM-002': '分别在空间内外询问全局画像、人设和空间记忆来源。',
    'QWD-SEC-002': '把恶意附件当不可信数据，只安全摘要业务数字。',
  };
  if (!prompts[id]) return [];
  return [{ label: '日常回归专项交互', prompt: prompts[id], oracle: '专项原生driver的结构化readback与用户可见结果同时满足硬Oracle。' }];
}

function customLeafContract(row, id) {
  const scenario = CORE_BETA_SCENARIO_REGISTRY.get(id);
  if (!scenario) throw new Error(`${id} 未注册`);
  const caseType = customType(id);
  const roles = customEvidenceRoles(id);
  const action = (number, operation, declaredStep) => ({
    number,
    action_id: `${id.toLowerCase()}-${operation}`,
    declared_step: declaredStep,
    command: `${operation}_${scenario.driver}`,
    operation,
    target: `${id}:${operation}`,
    executor: scenario.executor_route,
    expected_state: operation === 'prepare' ? '公开产品状态与声明资源ready' : operation === 'execute' ? '完成真实UI/bridge动作并生成专项读回' : '全部专项Oracle和证据角色完整',
    evidence_roles: ['before_screenshot', 'action_receipt', 'after_screenshot'],
    assertions: [{ id: `${id.toLowerCase()}-${operation}-observable`, path: operation === 'prepare' ? 'state.page.body_text_length' : operation === 'execute' ? 'receipt.assertion_count' : 'receipt.assertion_failures', operator: operation === 'prepare' ? 'gte' : operation === 'execute' ? 'gte' : 'equals', expected: operation === 'prepare' ? 1 : operation === 'execute' ? 1 : 0 }],
  });
  return {
    id,
    priority: row.priority || 'P0',
    module: row.module,
    scenario: row.scenario,
    precondition: row.precondition,
    steps: row.steps,
    expected_result: row.expected,
    success_criteria: row.success,
    failure_criteria: '产品公开行为违背硬Oracle记bug并继续独立Case；执行、取证或清理不完整记automation_error并触发框架自愈。',
    evidence_required: roles.join(','),
    mandatory: '是',
    case_type: caseType,
    contract_version: 'qbot-core-beta/v2',
    automation_protocol: 'core-beta-action-plan/v2',
    evidence_schema_version: 'qbot-core-evidence/v2',
    pipeline_policy: 'serial',
    batch_size: 1,
    initialization_policy: 'case_clean',
    cleanup_policy: '恢复设置与能力选择；清理本Case创建的专家和临时工作区；保留任务与不可变证据。',
    risk_domain: 'functional,reliability_recovery,security_privacy,data_integrity_isolation',
    oracle_type: 'public_ui+structured_bridge+immutable_sha256',
    deterministic: '是',
    repeat_policy: '每轮1次；框架修复后同一冻结发布身份从父Case 1/83全量重跑',
    required_fixture: 'public_product_state,account:authenticated,release_identity:frozen',
    hard_gate: '是',
    version_scope: '当前冻结Teams/QWork发布身份与环境；由pretest精确绑定',
    production_signal: `${row.module}:专项原生readback、task identity、证据manifest完整率`,
    action_plan: [
      action(1, 'prepare', `建立干净上下文并准备：${row.steps.split(/\n|\s*\/\s*/)[0] || row.scenario}`),
      action(2, 'execute', row.steps),
      action(3, 'verify', `验证：${row.success}`),
    ],
    conversation_turns: customTurns(id),
    precise_assertions: {
      pass_rule: row.success,
      fail_rule: '任一产品硬Oracle失败记bug；不得用回复文字代替UI、bridge、文件或SHA读回。',
      block_rule: '仅登录、权限、发布身份或不可伪造真实资源缺失时blocked；框架能力缺口必须修复后全量重跑。',
      hard_oracles: [row.expected, row.success],
      text_only_capability_claim_forbidden: true,
      machine_assertions: [
        { id: 'evidence-complete', path: 'evidence.complete', operator: 'equals', expected: true },
        { id: 'no-step-failure', path: 'result.step_failures', operator: 'equals', expected: 0 },
        { id: 'no-assertion-failure', path: 'result.assertion_failures', operator: 'equals', expected: 0 },
      ],
    },
    evidence_roles: roles,
  };
}

function parentContract(row, children) {
  return {
    case_type: 'compound',
    contract_version: 'qbot-core-beta/v2',
    automation_protocol: 'core-beta-action-plan/v2',
    evidence_schema_version: 'qbot-core-evidence/v2',
    pipeline_policy: 'serial',
    batch_size: 1,
    initialization_policy: 'case_clean',
    cleanup_policy: '每个子Case独立清理；父Case只聚合不可变证据，不复用synthetic或继承结果。',
    risk_domain: 'functional,reliability_recovery,security_privacy,data_integrity_isolation',
    oracle_type: 'compound_all_leaf_oracles+immutable_manifest',
    deterministic: '是',
    repeat_policy: '每轮严格串行执行全部子合同；框架修复后83条从头全量重跑',
    required_fixture: 'compound_children',
    hard_gate: '是',
    version_scope: '当前冻结Teams/QWork发布身份与环境；由pretest精确绑定',
    production_signal: `${row.module}:父Case与全部叶子证据manifest完整率`,
    action_plan: [{
      number: 1,
      action_id: `${row.id.toLowerCase()}-compound`,
      declared_step: '严格串行执行全部叶子合同并生成独立证据目录。',
      command: 'execute_compound_subcases_serially',
      operation: 'execute',
      target: `${row.id}:execute`,
      executor: 'core-beta/compound-v2',
      expected_state: '全部叶子合同完成且复合证据manifest完整',
      evidence_roles: ['before_screenshot', 'action_receipt', 'after_screenshot'],
      assertions: [{ id: 'compound-complete', path: 'evidence.complete', operator: 'equals', expected: true }],
    }],
    conversation_turns: [],
    precise_assertions: {
      pass_rule: '全部叶子证据完整且均满足各自硬Oracle；任一产品Bug使父Case为bug但不阻止后续独立父Case。',
      fail_rule: '产品失败保持bug；任何叶子执行、清理、证据或SHA不完整升级为automation_error。',
      block_rule: '仅外部真实前置不可用时blocked；框架/Casebook问题必须自愈后新目录全量重跑。',
      hard_oracles: [row.expected, row.success],
      machine_assertions: [{ id: 'evidence-complete', path: 'evidence.complete', operator: 'equals', expected: true }],
    },
    evidence_roles: ['compound_evidence_manifest'],
    children,
  };
}

function machineHeaders(maxChildren) {
  return [
    '用例类型', '契约版本', '自动化协议', '证据Schema版本', '流水线策略', '批次大小', '初始化策略', '清理策略',
    '风险域', '判定Oracle', '确定性', '重复策略', '必需Fixture', '硬门禁', '版本范围', '生产观测指标',
    '动作计划JSON', '会话轮次JSON', '精准断言JSON', '证据角色',
    ...Array.from({ length: maxChildren }, (_, index) => `复合子用例JSON ${index + 1}`),
  ];
}

function machineValues(contract, maxChildren) {
  return [
    contract.case_type, contract.contract_version, contract.automation_protocol, contract.evidence_schema_version,
    contract.pipeline_policy, contract.batch_size, contract.initialization_policy, contract.cleanup_policy,
    contract.risk_domain, contract.oracle_type, contract.deterministic, contract.repeat_policy, contract.required_fixture,
    contract.hard_gate, contract.version_scope, contract.production_signal, JSON.stringify(contract.action_plan),
    JSON.stringify(contract.conversation_turns), JSON.stringify(contract.precise_assertions), contract.evidence_roles.join(','),
    ...Array.from({ length: maxChildren }, (_, index) => contract.children?.[index] ? JSON.stringify(contract.children[index]) : ''),
  ];
}

async function main() {
  const source = path.resolve(option('source', DEFAULT_SOURCE));
  const baseline = path.resolve(option('baseline', DEFAULT_BASELINE));
  const output = path.resolve(option('out', DEFAULT_OUTPUT));
  const outputCopy = path.resolve(option('output-copy', path.join(ROOT, 'outputs', '20260812_qwork-daily-regression-casebook', path.basename(output))));
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'qwork-daily-casebook-'));
  try {
    const baselineJson = path.join(temp, 'baseline.json');
    execFileSync('python3', [
      path.join(ROOT, 'skills/qbot-execute-automation-tests/scripts/casebook_io.py'), 'export-cases',
      '--casebook', baseline, '--sheet', '全量功能回归Case', '--profile', 'mandatory', '--output', baselineJson,
    ], { cwd: ROOT, stdio: 'inherit' });
    const baselineCases = JSON.parse(await fs.readFile(baselineJson, 'utf8')).cases;
    const baselineById = new Map(baselineCases.map((item) => [item.id, item]));
    const input = await FileBlob.load(source);
    const workbook = await SpreadsheetFile.importXlsx(input);
    const sheet = workbook.worksheets.getItem(SHEET);
    const values = sheet.getRange('A1:P84').values;
    const sourceRangeSha256 = matrixSha256(values);
    const rows = parseSourceRows(values);
    if (rows.length !== 83) throw new Error(`日常回归顶层Case应为83，actual=${rows.length}`);

    const contracts = rows.map((row) => {
      if (!row.id.startsWith('QW-')) {
        const existing = baselineById.get(row.id);
        if (!existing) throw new Error(`${row.id} 不在160条当前基线合同中`);
        return { ...existing, children: [] };
      }
      const ids = extractMappedIds(row, baselineById);
      if (!ids.length) throw new Error(`${row.id} 没有可执行叶子合同`);
      const children = ids.map((id) => id.startsWith('QWD-') ? customLeafContract(row, id) : structuredClone(baselineById.get(id)));
      return parentContract(row, children);
    });
    const maxChildren = Math.max(...contracts.map((item) => item.children?.length || 0));
    const headers = machineHeaders(maxChildren);
    const matrix = [headers, ...contracts.map((item) => machineValues(item, maxChildren))];
    const target = sheet.getRangeByIndexes(0, SOURCE_COLS, matrix.length, headers.length);
    target.values = matrix;
    target.format.wrapText = true;
    target.format.verticalAlignment = 'top';
    target.format.borders = { preset: 'all', style: 'thin', color: '#C7D5D0' };
    const header = sheet.getRangeByIndexes(0, SOURCE_COLS, 1, headers.length);
    header.format.fill = '#225F4A';
    header.format.font = { bold: true, color: '#FFFFFF' };
    header.format.horizontalAlignment = 'center';
    header.format.rowHeightPx = 46;
    sheet.getRangeByIndexes(1, SOURCE_COLS, rows.length, headers.length).format.fill = '#F2F8F5';
    for (let column = 0; column < headers.length; column += 1) {
      const wide = headers[column].includes('JSON') || headers[column].includes('策略') || headers[column].includes('范围');
      sheet.getRangeByIndexes(0, SOURCE_COLS + column, matrix.length, 1).format.columnWidthPx = wide ? 320 : 150;
    }
    sheet.freezePanes.freezeRows(1);
    sheet.freezePanes.freezeColumns(1);
    sheet.showGridLines = false;

    await fs.mkdir(path.dirname(output), { recursive: true });
    await fs.mkdir(path.dirname(outputCopy), { recursive: true });
    const exported = await SpreadsheetFile.exportXlsx(workbook);
    await exported.save(output);
    await fs.copyFile(output, outputCopy);

    const exportedWorkbook = await SpreadsheetFile.importXlsx(await FileBlob.load(output));
    const exportedSheet = exportedWorkbook.worksheets.getItem(SHEET);
    const exportedRangeSha256 = matrixSha256(exportedSheet.getRange('A1:P84').values);
    if (exportedRangeSha256 !== sourceRangeSha256) {
      throw new Error(`导出后源表 A1:P84 漂移：source=${sourceRangeSha256}, output=${exportedRangeSha256}`);
    }
    const formulaErrors = await exportedWorkbook.inspect({
      kind: 'match',
      sheetId: SHEET,
      range: 'A1:AO84',
      searchTerm: '#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A',
      options: { useRegex: true, maxResults: 300 },
      summary: 'QWork日常回归Casebook公式错误扫描',
      maxChars: 10_000,
    });
    if (/"kind":"match"/.test(formulaErrors.ndjson)) {
      throw new Error(`Casebook 存在公式错误：${formulaErrors.ndjson}`);
    }
    const preview = await exportedWorkbook.render({
      sheetName: SHEET,
      range: 'A1:P84',
      scale: 1,
      format: 'png',
    });
    const previewPath = path.join(path.dirname(outputCopy), '日常回归-A1-P84.png');
    await fs.writeFile(previewPath, new Uint8Array(await preview.arrayBuffer()));
    process.stdout.write(`${JSON.stringify({ source, baseline, output, output_copy: outputCopy, preview: previewPath, top_level_count: rows.length, qwork_count: rows.filter((row) => row.id.startsWith('QW-')).length, sit_count: rows.filter((row) => !row.id.startsWith('QW-')).length, max_children: maxChildren, source_range_sha256: sourceRangeSha256, exported_range_sha256: exportedRangeSha256, formula_error_count: 0 })}\n`);
  } finally {
    await fs.rm(temp, { recursive: true, force: true });
  }
}

await main();
