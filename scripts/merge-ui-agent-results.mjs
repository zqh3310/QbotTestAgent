#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const item = argv[i];
    if (!item.startsWith('--')) continue;
    const key = item.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) {
      args[key] = true;
    } else {
      args[key] = next;
      i += 1;
    }
  }
  return args;
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function resultKey(result) {
  return [
    String(result.sheet || ''),
    String(result.row_number || ''),
    String(result.id || ''),
  ].join('::');
}

function countResults(results) {
  return {
    total: results.length,
    passed: results.filter((item) => item.status === 'passed').length,
    failed: results.filter((item) => item.status === 'failed').length,
    blocked: results.filter((item) => item.status === 'blocked').length,
    needs_llm_review: results.filter((item) => item.status === 'needs_llm_review').length,
    other: results.filter((item) => !['passed', 'failed', 'blocked', 'needs_llm_review'].includes(item.status)).length,
  };
}

function statusFromCounts(counts) {
  if (counts.failed) return 'failed';
  if (counts.blocked) return 'blocked';
  if (counts.needs_llm_review) return 'needs_llm_review';
  return 'passed';
}

function sortResults(results) {
  return [...results].sort((a, b) => {
    const sheet = String(a.sheet || '').localeCompare(String(b.sheet || ''), 'zh-Hans-CN');
    if (sheet !== 0) return sheet;
    return Number(a.row_number || 0) - Number(b.row_number || 0);
  });
}

function renderBatchReport({ batch, combined, outputExcel }) {
  const lines = [
    '# QBot 自动化测试分组执行结果',
    '',
    `- 本组目录：${batch.run_dir || batch.out_dir}`,
    `- 总结果 Excel：${outputExcel}`,
    `- 本组用例数：${batch.counts?.total || 0}`,
    `- 本组通过：${batch.counts?.passed || 0}`,
    `- 本组失败：${batch.counts?.failed || 0}`,
    `- 本组阻塞：${batch.counts?.blocked || 0}`,
    `- 本组需 LLM 复核：${batch.counts?.needs_llm_review || 0}`,
    '',
    `- 累计已执行：${combined.counts.total}`,
    `- 累计通过：${combined.counts.passed}`,
    `- 累计失败：${combined.counts.failed}`,
    `- 累计阻塞：${combined.counts.blocked}`,
    `- 累计需 LLM 复核：${combined.counts.needs_llm_review}`,
    '',
    '## 本组明细',
    '',
  ];
  for (const result of batch.results || []) {
    lines.push(`- ${result.id} ${result.scenario || result.title || ''}：${result.status} / ${result.result_category || ''}`);
    lines.push(`  - 报告：${result.case_report || ''}`);
    const screenshot = (result.screenshots_flat || []).at?.(-1) || Object.values(result.screenshots || {}).filter((item) => typeof item === 'string').at(-1) || '';
    if (screenshot) lines.push(`  - 截图：${screenshot}`);
    if (result.problem_description) lines.push(`  - 问题：${String(result.problem_description).split('\n')[0]}`);
    if (result.status === 'blocked') lines.push(`  - 阻塞：${result.actual_result || result.conclusion || ''}`);
  }
  return `${lines.join('\n')}\n`;
}

const args = parseArgs(process.argv.slice(2));
const root = path.resolve(args.root || process.cwd());
const casebook = path.resolve(args.casebook || path.join(root, 'PRD', 'V1版本核心功能自动化测试用例.xlsx'));
const masterDir = path.resolve(args['master-dir'] || path.join(root, 'autoTest', 'combined-ui-agent-results'));
const batchDir = path.resolve(args['batch-dir'] || '');
const outputExcel = path.resolve(args.output || path.join(masterDir, '自动化测试结果.xlsx'));
const python = String(args.python || process.env.PYTHON || 'python3');

if (!batchDir || !fs.existsSync(path.join(batchDir, 'automation-run-summary.json'))) {
  console.error('缺少 --batch-dir，或该目录下没有 automation-run-summary.json');
  process.exit(2);
}

fs.mkdirSync(masterDir, { recursive: true });
const combinedFile = path.join(masterDir, 'combined-automation-run-summary.json');
const batch = readJson(path.join(batchDir, 'automation-run-summary.json'));
const previous = fs.existsSync(combinedFile)
  ? readJson(combinedFile)
  : {
      command: 'ui-agent-casebook-run-combined',
      started_at: batch.started_at || new Date().toISOString(),
      casebook,
      run_dir: masterDir,
      out_dir: masterDir,
      profile: batch.profile || '',
      cdp_url: batch.cdp_url || '',
      result_excel: outputExcel,
      results: [],
    };

const merged = new Map();
for (const result of previous.results || []) merged.set(resultKey(result), result);
for (const result of batch.results || []) merged.set(resultKey(result), result);

const results = sortResults(Array.from(merged.values()));
const counts = countResults(results);
const combined = {
  ...previous,
  status: statusFromCounts(counts),
  ended_at: new Date().toISOString(),
  result_excel: outputExcel,
  counts,
  results,
};

writeJson(combinedFile, combined);
const write = spawnSync(python, [
  path.join(root, 'skills', 'qbot-execute-automation-tests', 'scripts', 'casebook_io.py'),
  'write-results',
  '--casebook',
  casebook,
  '--summary',
  combinedFile,
  '--output',
  outputExcel,
], { cwd: root, encoding: 'utf8', maxBuffer: 1000 * 1000 * 80 });

fs.writeFileSync(path.join(masterDir, 'merge-results.stdout.log'), write.stdout || '', 'utf8');
fs.writeFileSync(path.join(masterDir, 'merge-results.stderr.log'), write.stderr || '', 'utf8');
if (write.status !== 0) {
  console.error(write.stderr || write.error?.message || '写入合并结果 Excel 失败');
  process.exit(write.status || 1);
}

const batchName = path.basename(batchDir);
fs.writeFileSync(path.join(masterDir, `${batchName}-summary.md`), renderBatchReport({ batch, combined, outputExcel }), 'utf8');
console.log(JSON.stringify({
  master_dir: masterDir,
  combined_summary: combinedFile,
  output_excel: outputExcel,
  counts,
  batch_counts: batch.counts,
}, null, 2));
