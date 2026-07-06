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
    if (!next || next.startsWith('--')) args[key] = true;
    else {
      args[key] = next;
      i += 1;
    }
  }
  return args;
}

function timestampMinute(date = new Date()) {
  const pad = (value) => String(value).padStart(2, '0');
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}${pad(date.getHours())}${pad(date.getMinutes())}`;
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd,
    encoding: 'utf8',
    maxBuffer: 1000 * 1000 * 100,
    env: { ...process.env, ...(options.env || {}) },
  });
  return result;
}

function write(file, text) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text || '', 'utf8');
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function exportCount({ root, casebook, profile, python }) {
  const out = path.join(root, 'autoTest', '.tmp-casebook-count.json');
  const result = run(python, [
    path.join(root, 'skills', 'qbot-execute-automation-tests', 'scripts', 'casebook_io.py'),
    'export-cases',
    '--casebook',
    casebook,
    '--profile',
    profile,
    '--output',
    out,
  ], { cwd: root });
  if (result.status !== 0) {
    throw new Error(`导出用例失败：${result.stderr || result.stdout}`);
  }
  return readJson(out).selected_count || 0;
}

function renderOverall(masterDir, groups, resultExcel) {
  const lines = [
    '# QBot 分组自动化执行总报告',
    '',
    `- 输出目录：${masterDir}`,
    `- 总结果 Excel：${resultExcel}`,
    `- 分组数：${groups.length}`,
    '',
    '## 分组结果',
    '',
  ];
  for (const group of groups) {
    lines.push(`- 第 ${group.group_no} 组 offset=${group.offset} limit=${group.limit}：run=${group.run_status}，audit=${group.audit_status}`);
    lines.push(`  - 批次目录：${group.batch_dir}`);
    lines.push(`  - 批次报告：${path.join(group.batch_dir, 'automation-run-report.md')}`);
    lines.push(`  - 可信度审计：${path.join(group.batch_dir, 'credibility-audit.md')}`);
    if (group.counts) {
      lines.push(`  - 结果：总 ${group.counts.total}，通过 ${group.counts.passed}，失败 ${group.counts.failed}，阻塞 ${group.counts.blocked}，需复核 ${group.counts.needs_llm_review}`);
    }
  }
  return `${lines.join('\n')}\n`;
}

const args = parseArgs(process.argv.slice(2));
const root = path.resolve(args.root || process.cwd());
const casebook = path.resolve(args.casebook || path.join(root, 'PRD', 'V1版本核心功能自动化测试用例.xlsx'));
const profile = String(args.profile || 'full');
const cdp = String(args.cdp || process.env.QBOT_CDP_URL || 'http://127.0.0.1:59410');
const timeoutMs = String(args['timeout-ms'] || '180000');
const groupSize = Number(args['group-size'] || 10);
const startOffset = Number(args['start-offset'] || 0);
const maxGroups = Number(args['max-groups'] || 0);
const python = String(args.python || process.env.PYTHON || 'python3');
const stamp = String(args.stamp || timestampMinute());
const masterDir = path.resolve(args['master-dir'] || path.join(root, 'autoTest', `${stamp}_V1核心功能_10条分组执行`));
const resultExcel = path.resolve(args.output || path.join(masterDir, `${stamp}_自动化测试结果.xlsx`));
const stopOnUntrusted = args['continue-on-untrusted'] !== true && args['continue-on-untrusted'] !== 'true';

fs.mkdirSync(masterDir, { recursive: true });
const total = Number(args.total || exportCount({ root, casebook, profile, python }));
const groups = [];

for (let offset = startOffset, groupNo = Math.floor(startOffset / groupSize) + 1; offset < total; offset += groupSize, groupNo += 1) {
  if (maxGroups > 0 && groups.length >= maxGroups) break;
  const limit = Math.min(groupSize, total - offset);
  const batchDir = path.join(masterDir, `group-${String(groupNo).padStart(3, '0')}_offset-${String(offset).padStart(3, '0')}_limit-${String(limit).padStart(3, '0')}`);
  const runResult = run('npm', [
    'run',
    'ui-agent:casebook-run',
    '--',
    '--casebook',
    casebook,
    '--profile',
    profile,
    '--offset',
    String(offset),
    '--limit',
    String(limit),
    '--cdp',
    cdp,
    '--timeout-ms',
    timeoutMs,
    '--out',
    batchDir,
  ], { cwd: root });
  write(path.join(batchDir, 'logs', 'group-run.stdout.log'), runResult.stdout || '');
  write(path.join(batchDir, 'logs', 'group-run.stderr.log'), runResult.stderr || '');

  const mergeResult = run('node', [
    'scripts/merge-ui-agent-results.mjs',
    '--casebook',
    casebook,
    '--master-dir',
    masterDir,
    '--batch-dir',
    batchDir,
    '--output',
    resultExcel,
  ], { cwd: root });
  write(path.join(batchDir, 'logs', 'group-merge.stdout.log'), mergeResult.stdout || '');
  write(path.join(batchDir, 'logs', 'group-merge.stderr.log'), mergeResult.stderr || '');

  const auditResult = run('node', [
    'scripts/audit-ui-agent-batch.mjs',
    '--batch-dir',
    batchDir,
  ], { cwd: root });
  write(path.join(batchDir, 'logs', 'group-audit.stdout.log'), auditResult.stdout || '');
  write(path.join(batchDir, 'logs', 'group-audit.stderr.log'), auditResult.stderr || '');

  const summaryFile = path.join(batchDir, 'automation-run-summary.json');
  const summary = fs.existsSync(summaryFile) ? readJson(summaryFile) : null;
  const group = {
    group_no: groupNo,
    offset,
    limit,
    batch_dir: batchDir,
    run_status: runResult.status === 0 ? 'completed' : `exit_${runResult.status}`,
    merge_status: mergeResult.status === 0 ? 'completed' : `exit_${mergeResult.status}`,
    audit_status: auditResult.status === 0 ? 'credible' : `not_credible_exit_${auditResult.status}`,
    counts: summary?.counts || null,
  };
  groups.push(group);
  write(path.join(masterDir, 'group-run-progress.json'), `${JSON.stringify({ total, group_size: groupSize, result_excel: resultExcel, groups }, null, 2)}\n`);
  write(path.join(masterDir, 'group-run-report.md'), renderOverall(masterDir, groups, resultExcel));

  if (stopOnUntrusted && auditResult.status !== 0) {
    console.error(`第 ${groupNo} 组可信度审计未通过，已停止后续分组。`);
    process.exit(3);
  }
}

console.log(JSON.stringify({
  master_dir: masterDir,
  result_excel: resultExcel,
  total,
  groups,
}, null, 2));
