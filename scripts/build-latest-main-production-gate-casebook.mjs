#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { FileBlob, SpreadsheetFile } from '@oai/artifact-tool';
import {
  LATEST_MAIN_BASELINE,
  migrateProductionCase,
  productionCaseDispositionCounts,
  validateTrustedProductionCaseContract,
} from '../src/lib/production-casebook-contract.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const DEFAULT_SOURCE_XLSX = path.join(
  ROOT,
  'teams360-automation',
  'output',
  '202607232201_prod-gate-r1l_92_teams360_5.2.20-2119072293_qwork-0.0.12_dev_m3_pipeline5_framework-c524b21',
  'source-source-source-source-QBot核心上线门禁用例_Teams-QWork_2026-07-23_生产门禁版.xlsx',
);
const DEFAULT_OUTPUT_DIR = path.join(
  '/Users/qifu/Documents/QbotTestAgent/outputs',
  'production-gate-v2-2026-07-24',
);
const DEFAULT_OUTPUT_XLSX = 'QBot核心上线门禁_latest-main_V2_生产可信版.xlsx';
const DEFAULT_OUTPUT_JSON = 'QBot核心上线门禁_latest-main_V2_生产可信版.json';
const CASE_SHEET_NAME = '核心上线门禁';
const SOURCE_COLUMN_COUNT = 35;

const BASE_HEADERS = Object.freeze([
  ['用例ID', 'id'],
  ['优先级', 'priority'],
  ['产品模块', 'module'],
  ['子功能', 'submodule'],
  ['测试场景', 'scenario'],
  ['前置条件', 'precondition'],
  ['测试数据', 'test_data'],
  ['执行入口/Selector', 'selectors'],
  ['执行步骤', 'steps'],
  ['预期结果', 'expected_result'],
  ['成功判定', 'success_criteria'],
  ['失败判定', 'failure_criteria'],
  ['证据要求', 'evidence_required'],
  ['自动化Runner', 'runner'],
  ['执行层级', 'execution_level'],
  ['每轮必跑', 'mandatory'],
  ['来源ID', 'source_id'],
  ['来源类型', 'source_type'],
  ['备注', 'note'],
  ['用户旅程', 'user_journey'],
  ['阻断等级', 'blocking_level'],
  ['流水线策略', 'pipeline_policy'],
  ['Issue依据', 'issue_basis'],
  ['源码锚点', 'source_anchor'],
  ['二次复核要求', 'second_review_required'],
  ['风险域', 'risk_domain'],
  ['判定Oracle', 'oracle_type'],
  ['确定性', 'deterministic'],
  ['重复策略', 'repeat_policy'],
  ['必需Fixture', 'required_fixture'],
  ['硬门禁', 'hard_gate'],
  ['清理策略', 'cleanup_policy'],
  ['版本范围', 'version_scope'],
  ['历史Bug', 'known_bug_link'],
  ['生产观测指标', 'production_signal'],
]);

const TRUST_HEADERS = Object.freeze([
  ['契约版本', 'contract_version'],
  ['latest-main基线', 'product_baseline'],
  ['迁移处置', 'migration_disposition'],
  ['用户可见动作契约', 'visible_action_contract'],
  ['状态读回契约', 'state_readback_contract'],
  ['证据角色', 'required_evidence_roles'],
  ['禁止捷径', 'forbidden_shortcuts'],
  ['Selector契约', 'selector_contract'],
  ['身份完整性', 'identity_contract'],
  ['可信复核契约', 'trusted_review_contract'],
]);

function argument(name, fallback = '') {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? String(process.argv[index + 1] || '') : fallback;
}

function safeFileName(value) {
  return String(value || 'sheet')
    .normalize('NFKC')
    .replace(/[^\p{L}\p{N}._-]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 100) || 'sheet';
}

async function inspectWorkbook({ sourceXlsx, outputDir }) {
  await fs.mkdir(outputDir, { recursive: true });
  const input = await FileBlob.load(sourceXlsx);
  const workbook = await SpreadsheetFile.importXlsx(input);
  const sheetInspection = await workbook.inspect({
    kind: 'workbook,sheet,table',
    maxChars: 20_000,
    tableMaxRows: 8,
    tableMaxCols: 48,
    tableMaxCellChars: 160,
  });
  await fs.writeFile(
    path.join(outputDir, 'source-workbook-inspection.ndjson'),
    `${sheetInspection.ndjson || String(sheetInspection)}\n`,
    'utf8',
  );

  const sheets = [];
  for (let index = 0; ; index += 1) {
    let sheet;
    try {
      sheet = workbook.worksheets.getItemAt(index);
    } catch {
      break;
    }
    if (!sheet) break;
    const name = String(sheet.name || `sheet-${index + 1}`);
    const preview = await workbook.render({
      sheetName: name,
      autoCrop: 'all',
      scale: 1,
      format: 'png',
    });
    const previewFile = path.join(
      outputDir,
      `source-${String(index + 1).padStart(2, '0')}-${safeFileName(name)}.png`,
    );
    await fs.writeFile(previewFile, new Uint8Array(await preview.arrayBuffer()));
    sheets.push({ index, name, preview: previewFile });
  }
  await fs.writeFile(
    path.join(outputDir, 'source-workbook-sheets.json'),
    `${JSON.stringify({ source_xlsx: sourceXlsx, sheets }, null, 2)}\n`,
    'utf8',
  );
  return { sourceXlsx, outputDir, sheets };
}

function matrixToCases(values) {
  const headers = values[0].map((value) => String(value || '').trim());
  const headerIndex = new Map(headers.map((value, index) => [value, index]));
  for (const [header] of BASE_HEADERS) {
    if (!headerIndex.has(header)) throw new Error(`源工作簿缺少列：${header}`);
  }
  return values.slice(1)
    .filter((row) => String(row[headerIndex.get('用例ID')] || '').trim())
    .map((row, index) => {
      const result = {};
      for (const [header, field] of BASE_HEADERS) {
        result[field] = String(row[headerIndex.get(header)] ?? '').trim();
      }
      result.sheet = CASE_SHEET_NAME;
      result.row_number = index + 2;
      result.kind = inferCaseKind(result);
      return result;
    });
}

function inferCaseKind(testCase) {
  const runner = String(testCase.runner || '').toLowerCase();
  if (runner.includes('ui+conversation')) return 'ui+conversation';
  if (runner.includes('attachment')) return 'attachment';
  if (runner.includes('auth')) return 'auth';
  if (runner.includes('conversation')) return 'conversation';
  if (runner.includes('/ ui') || runner.endsWith('ui')) return 'ui';
  const text = `${testCase.module}\n${testCase.submodule}\n${testCase.scenario}\n${testCase.steps}`;
  if (/附件|上传/.test(text)) return 'attachment';
  if (/登录|鉴权|OAuth|退出/.test(text)) return 'auth';
  if (/发送|回复|对话|会话/.test(text)) return 'conversation';
  return 'ui';
}

function casesToMatrix(cases) {
  const headers = [...BASE_HEADERS, ...TRUST_HEADERS];
  return [
    headers.map(([header]) => header),
    ...cases.map((testCase) => headers.map(([, field]) => testCase[field] ?? '')),
  ];
}

function styleCaseSheet(sheet, rowCount, columnCount) {
  sheet.showGridLines = false;
  sheet.freezePanes.freezeRows(1);
  sheet.freezePanes.freezeColumns(1);
  const header = sheet.getRangeByIndexes(0, 0, 1, columnCount);
  header.format.fill = '#0F6B4F';
  header.format.font = { bold: true, color: '#FFFFFF' };
  header.format.wrapText = true;
  header.format.rowHeightPx = 44;
  header.format.horizontalAlignment = 'center';
  header.format.verticalAlignment = 'center';

  const body = sheet.getRangeByIndexes(1, 0, rowCount - 1, columnCount);
  body.format.wrapText = true;
  body.format.verticalAlignment = 'top';
  body.format.borders = { preset: 'all', style: 'thin', color: '#D7E3DE' };
  sheet.getRangeByIndexes(1, SOURCE_COLUMN_COUNT, rowCount - 1, columnCount - SOURCE_COLUMN_COUNT)
    .format.fill = '#EEF8F3';

  const widths = [
    115, 58, 100, 105, 230, 280, 220, 260, 330, 250,
    270, 270, 300, 150, 88, 66, 230, 250, 150, 120,
    120, 135, 210, 230, 260, 160, 210, 66, 72, 220,
    66, 230, 260, 210, 180,
    150, 250, 150, 290, 260, 240, 260, 250, 280, 300,
  ];
  widths.slice(0, columnCount).forEach((width, index) => {
    sheet.getRangeByIndexes(0, index, rowCount, 1).format.columnWidthPx = width;
  });
  sheet.getRangeByIndexes(1, 0, rowCount - 1, columnCount).format.rowHeightPx = 120;
}

function writeMigrationSummary(workbook, audit) {
  let sheet;
  try {
    sheet = workbook.worksheets.getItem('latest-main迁移总览');
    sheet.getUsedRange()?.clear({ applyTo: 'all' });
  } catch {
    sheet = workbook.worksheets.add('latest-main迁移总览');
  }
  sheet.showGridLines = false;
  const rows = [
    ['QBot latest-main 生产级可信门禁 V2', '值'],
    ['产品基线', `${LATEST_MAIN_BASELINE.repository} ${LATEST_MAIN_BASELINE.ref}@${LATEST_MAIN_BASELINE.commit}`],
    ['审计日期', LATEST_MAIN_BASELINE.audited_at],
    ['用例总数', audit.case_count],
    ['唯一 Case ID', audit.unique_case_ids],
    ['替换过时断言', audit.disposition_counts.replace_obsolete_assertion || 0],
    ['按 latest-main 重写', audit.disposition_counts.rewrite_for_latest_main || 0],
    ['保留并强化证据', audit.disposition_counts.retain_and_strengthen_evidence || 0],
    ['保留业务 Oracle', audit.disposition_counts.retain_business_oracle || 0],
    ['可信契约校验', audit.ok ? 'PASS' : 'FAIL'],
    ['硬性禁止', '旧 selector fallback 通过；bridge-only acceptance；复用历史任务/回复/附件；模型自述替代工具/文件；缺证据 raw pass'],
    ['统一 Composer', '+ > 模式 / 专家 / 技能 / 连接器；技能/连接器使用句内 chip 与公开状态读回'],
    ['成果契约', 'assistant-turn-summary-modified-files + 文件状态 + 路径/SHA-256/内容/预览一致'],
    ['身份契约', 'host、QWork index、casebook、framework、UI git commit、build ID、release manifest、backend/prompt/feature flags 全冻结'],
    ['可信结论', 'raw passed/failed 只作线索；逐步骤、断言、截图、transcript、reply-delta、成果、附件、工具调用和日志复核后才可 trusted_pass'],
  ];
  sheet.getRangeByIndexes(0, 0, rows.length, 2).values = rows;
  sheet.getRange('A1:B1').format.fill = '#0F6B4F';
  sheet.getRange('A1:B1').format.font = { bold: true, color: '#FFFFFF', size: 16 };
  sheet.getRange('A1:B15').format.wrapText = true;
  sheet.getRange('A1:B15').format.verticalAlignment = 'top';
  sheet.getRange('A1:B15').format.borders = { preset: 'all', style: 'thin', color: '#C9D9D2' };
  sheet.getRange('A2:A15').format.fill = '#E6F4EE';
  sheet.getRange('A2:A15').format.font = { bold: true, color: '#164B3A' };
  sheet.getRange('A1:A15').format.columnWidthPx = 190;
  sheet.getRange('B1:B15').format.columnWidthPx = 760;
  sheet.getRange('A1:B15').format.rowHeightPx = 42;
  sheet.getRange('A1:B1').format.rowHeightPx = 62;
  sheet.freezePanes.freezeRows(1);
}

function patchCoverageOverview(workbook) {
  const sheet = workbook.worksheets.getItem('覆盖总览');
  sheet.getRange('A1:H1').values = [[
    'QBot latest-main 生产可信门禁 V2',
    '', '', '', '', '', '', '',
  ]];
  sheet.getRange('A2:H2').values = [[
    `生产门禁版：360Teams 5.2.20 (2119072293) + QWork/runtime 0.0.12+（每轮以签名 release 固定精确版本）+ DEV + M3；92 条唯一 Case；产品基线 ${LATEST_MAIN_BASELINE.ref}@${LATEST_MAIN_BASELINE.commit}；逐 Case 可信复核。`,
    '', '', '', '', '', '', '',
  ]];
}

function patchRuleSheets(workbook) {
  const replacements = new Map([
    ['执行与复核规则', [
      ['QBot latest-main 生产门禁 V2 执行与可信复核规则'],
      [`固定产品基线：${LATEST_MAIN_BASELINE.repository} ${LATEST_MAIN_BASELINE.ref}@${LATEST_MAIN_BASELINE.commit}`],
      ['1. 仅允许 360 Teams 受控宿主内嵌 QWork；每 Case 独立 taskId；不得启动第二 runner。'],
      ['2. 每个编号步骤必须由用户可见 UI 真实执行；bridge 只允许 setup/cleanup/独立读回，禁止 bridge-only acceptance。'],
      ['3. 旧独立技能/连接器菜单、旧三态按钮、created-file summary、nav-knowledge 均不得作为 fallback 通过。'],
      ['4. 每 Case 必须生成证据清单，覆盖其“证据角色”列；缺任何必需角色不得 raw pass。'],
      ['5. 会话证据必须绑定 prompt、taskId、send receipt、transcript、reply-delta；不得复用历史回复。'],
      ['6. 附件/成果必须绑定名称、大小、SHA-256、内容读回、任务归属和可见预览；模型自述不算文件事实。'],
      ['7. release identity 必须冻结 host、QWork index、casebook、framework、UI git commit、build ID、release manifest、backend/prompt/feature flags。'],
      ['8. raw passed/failed 仅作线索；逐条复核后输出 trusted_pass / trusted_fail / trusted_blocked / trusted_bug / framework_issue / testcase_issue。'],
      ['9. Selector 漂移、身份漂移、证据角色缺失一律 fail-closed；修框架后只能用新 commit 和新不可变输出目录重跑。'],
    ]],
    ['生产门禁配置', [
      ['配置项', 'V2 固定值/要求'],
      ['casebook_contract', 'qbot-production-gate/v2'],
      ['case_count', 92],
      ['product_baseline', `${LATEST_MAIN_BASELINE.repository} ${LATEST_MAIN_BASELINE.ref}@${LATEST_MAIN_BASELINE.commit}`],
      ['host', '360Teams 5.2.20 (2119072293)'],
      ['qwork_runtime', '0.0.12+；正式轮必须用签名 release envelope 固定精确 version/commit/build/manifest SHA-256'],
      ['control_plane', 'DEV（外部固定 URL）'],
      ['model_tier', 'M3'],
      ['timeout_ms', 600000],
      ['single_host_pipeline', 5],
      ['required_release_provenance', 'qwork_ui_git_commit + qwork_build_id + qwork_release_manifest_sha256'],
      ['required_case_evidence', 'case-evidence-manifest.json complete=true'],
      ['final_oracle', '逐 Case 可信复核，不直接采用 raw passed/failed'],
    ]],
  ]);
  for (const [name, rows] of replacements) {
    let sheet;
    try {
      sheet = workbook.worksheets.getItem(name);
      sheet.getRange('A1:Z200').unmerge();
      sheet.getUsedRange()?.clear({ applyTo: 'all' });
    } catch {
      sheet = workbook.worksheets.add(name);
    }
    const cols = Math.max(...rows.map((row) => row.length));
    const normalized = rows.map((row) => [...row, ...Array(cols - row.length).fill('')]);
    sheet.getRangeByIndexes(0, 0, rows.length, cols).values = normalized;
    sheet.showGridLines = false;
    sheet.freezePanes.freezeRows(1);
    sheet.getRangeByIndexes(0, 0, 1, cols).format.fill = '#0F6B4F';
    sheet.getRangeByIndexes(0, 0, 1, cols).format.font = { bold: true, color: '#FFFFFF', size: 14 };
    sheet.getRangeByIndexes(0, 0, rows.length, cols).format.wrapText = true;
    sheet.getRangeByIndexes(0, 0, rows.length, cols).format.verticalAlignment = 'top';
    sheet.getRangeByIndexes(0, 0, rows.length, cols).format.borders = { preset: 'all', style: 'thin', color: '#C9D9D2' };
    sheet.getRangeByIndexes(0, 0, rows.length, 1).format.columnWidthPx = cols === 1 ? 1040 : 260;
    if (cols > 1) sheet.getRangeByIndexes(0, 1, rows.length, cols - 1).format.columnWidthPx = 740;
    sheet.getRangeByIndexes(0, 0, rows.length, cols).format.rowHeightPx = 44;
  }
}

async function buildWorkbook({ sourceXlsx, outputDir, outputXlsx, outputJson }) {
  await fs.mkdir(outputDir, { recursive: true });
  const workbook = await SpreadsheetFile.importXlsx(await FileBlob.load(sourceXlsx));
  const caseSheet = workbook.worksheets.getItem(CASE_SHEET_NAME);
  const sourceValues = caseSheet.getRange(`A1:AI93`).values;
  const originalCases = matrixToCases(sourceValues);
  const migratedCases = originalCases.map(migrateProductionCase);
  const audit = validateTrustedProductionCaseContract(migratedCases);
  if (!audit.ok) throw new Error(`V2 casebook 校验失败：\n${audit.errors.join('\n')}`);

  const matrix = casesToMatrix(migratedCases);
  caseSheet.getRangeByIndexes(0, 0, matrix.length, matrix[0].length).values = matrix;
  styleCaseSheet(caseSheet, matrix.length, matrix[0].length);
  writeMigrationSummary(workbook, audit);
  patchCoverageOverview(workbook);
  patchRuleSheets(workbook);

  const finalXlsx = path.join(outputDir, outputXlsx);
  const finalJson = path.join(outputDir, outputJson);
  const exported = await SpreadsheetFile.exportXlsx(workbook);
  await exported.save(finalXlsx);
  await fs.writeFile(finalJson, `${JSON.stringify({
    schema_version: 2,
    source_xlsx: sourceXlsx,
    generated_at: new Date().toISOString(),
    product_baseline: LATEST_MAIN_BASELINE,
    expected_disposition_counts: productionCaseDispositionCounts(),
    audit,
    cases: migratedCases,
  }, null, 2)}\n`, 'utf8');

  const inspection = await workbook.inspect({
    kind: 'workbook,sheet,formula',
    maxChars: 30_000,
    tableMaxRows: 8,
    tableMaxCols: 45,
    tableMaxCellChars: 180,
  });
  await fs.writeFile(path.join(outputDir, 'final-workbook-inspection.ndjson'), `${inspection.ndjson || String(inspection)}\n`, 'utf8');

  const renderDir = path.join(outputDir, 'final-render');
  await fs.mkdir(renderDir, { recursive: true });
  const renders = [];
  for (let index = 0; ; index += 1) {
    let sheet;
    try {
      sheet = workbook.worksheets.getItemAt(index);
    } catch {
      break;
    }
    if (!sheet) break;
    const name = String(sheet.name || `sheet-${index + 1}`);
    const preview = await workbook.render({
      sheetName: name,
      autoCrop: 'all',
      scale: name === CASE_SHEET_NAME ? 0.6 : 1,
      format: 'png',
    });
    const renderFile = path.join(renderDir, `${String(index + 1).padStart(2, '0')}-${safeFileName(name)}.png`);
    await fs.writeFile(renderFile, new Uint8Array(await preview.arrayBuffer()));
    renders.push({ name, file: renderFile });
  }
  return { sourceXlsx, finalXlsx, finalJson, audit, renders };
}

async function main() {
  const mode = argument('mode', 'build');
  const sourceXlsx = path.resolve(argument('source-xlsx', DEFAULT_SOURCE_XLSX));
  const outputDir = path.resolve(argument('output-dir', DEFAULT_OUTPUT_DIR));
  if (mode === 'inspect') {
    const result = await inspectWorkbook({ sourceXlsx, outputDir });
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return;
  }
  if (mode !== 'build') throw new Error(`不支持 mode=${mode}。`);
  const result = await buildWorkbook({
    sourceXlsx,
    outputDir,
    outputXlsx: argument('output-xlsx', DEFAULT_OUTPUT_XLSX),
    outputJson: argument('output-json', DEFAULT_OUTPUT_JSON),
  });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error.stack || error.message}\n`);
  process.exitCode = 1;
});
