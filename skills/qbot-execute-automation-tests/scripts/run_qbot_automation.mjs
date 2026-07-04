#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const SKILL_DIR = path.resolve(SCRIPT_DIR, '..');
const CASE_MAP_FILE = path.join(SKILL_DIR, 'references', 'core-case-map.json');
const CORE_SCENARIOS_FILE = path.join(SKILL_DIR, 'references', 'core-system-scenarios.json');

const DEFAULT_ROOT = path.resolve(SKILL_DIR, '..', '..');
const DEFAULT_CDP = 'http://127.0.0.1:9224';
const DEFAULT_TIMEOUT_MS = 120000;

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const item = argv[i];
    if (!item.startsWith('--')) continue;
    const key = item.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) out[key] = true;
    else {
      out[key] = next;
      i += 1;
    }
  }
  return out;
}

function timestampForPath(date = new Date()) {
  const pad = (value) => String(value).padStart(2, '0');
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
    '-',
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds()),
  ].join('');
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function writeJson(file, value) {
  ensureDir(path.dirname(file));
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function writeText(file, value) {
  ensureDir(path.dirname(file));
  fs.writeFileSync(file, value);
}

function splitCases(value) {
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function selectCases({ caseMap, profile, suite, explicitCases }) {
  const profileConfig = caseMap.profiles[profile] || caseMap.profiles[caseMap.default_profile] || caseMap.profiles.mandatory;
  if (!profileConfig) throw new Error(`No runnable profile found in ${CASE_MAP_FILE}`);
  let core = [...(profileConfig.core || [])];
  let module = [...(profileConfig.module || [])];
  if (explicitCases.length) {
    const explicit = new Set(explicitCases);
    core = core.filter((id) => explicit.has(id));
    module = module.filter((id) => explicit.has(id));
    const unknown = explicitCases.filter((id) => !core.includes(id) && !module.includes(id));
    for (const id of unknown) {
      if (id.startsWith('MOD-')) module.push(id);
      else core.push(id);
    }
  }
  if (suite === 'core') module = [];
  if (suite === 'module') core = [];
  return { core, module };
}

function caseMetaById(caseMap) {
  return new Map((caseMap.cases || []).map((item) => [item.id, item]));
}

function runCli({ root, command, outDir, cases, cdp, timeoutMs, scenariosFile, logPrefix }) {
  const args = ['src/cli.mjs', command, '--out', outDir, '--case', cases.join(','), '--cdp', cdp, '--timeout-ms', String(timeoutMs)];
  if (scenariosFile) args.push('--scenarios', scenariosFile);
  const startedAt = new Date();
  const proc = spawnSync(process.execPath, args, {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 1000 * 1000 * 50,
  });
  const endedAt = new Date();
  return {
    command,
    args: [process.execPath, ...args],
    cwd: root,
    out_dir: outDir,
    exit_code: proc.status,
    signal: proc.signal,
    error: proc.error ? proc.error.message : null,
    started_at: startedAt.toISOString(),
    ended_at: endedAt.toISOString(),
    stdout_file: logPrefix ? `${logPrefix}.stdout.log` : null,
    stderr_file: logPrefix ? `${logPrefix}.stderr.log` : null,
    stdout: proc.stdout || '',
    stderr: proc.stderr || '',
  };
}

function readReport(file) {
  try {
    return readJson(file);
  } catch (error) {
    return { status: 'blocked', reason: `无法读取执行报告 ${file}: ${error.message}`, results: [], out_dir: path.dirname(file) };
  }
}

function normalizeResults({ report, selectedCases, suiteName, reportFile, meta }) {
  const results = Array.isArray(report.results) ? report.results : [];
  if (results.length) {
    return results.map((item) => ({
      ...item,
      suite: suiteName,
      runner_report: reportFile,
      case_report: item.case_dir ? path.join(item.case_dir, 'case-report.md') : null,
      title: item.title || meta.get(item.id)?.title || item.id,
      priority: item.priority || meta.get(item.id)?.priority || '',
    }));
  }

  const reason = report.reason
    || report.doctor?.reason
    || report.precheck?.reason
    || report.error
    || `Runner ${suiteName} 未产出用例结果。`;
  const screenshots = report.doctor?.screenshots || report.precheck?.screenshots || {};
  return selectedCases.map((id, index) => ({
    order: index + 1,
    id,
    title: meta.get(id)?.title || id,
    priority: meta.get(id)?.priority || '',
    status: 'blocked',
    reason,
    suite: suiteName,
    case_dir: report.out_dir || path.dirname(reportFile),
    case_report: null,
    runner_report: reportFile,
    screenshots,
    steps: [{
      action: '自动化前置检查',
      status: 'blocked',
      text: reason,
    }],
  }));
}

function countResults(results) {
  return {
    total: results.length,
    passed: results.filter((item) => ['passed', 'pass'].includes(item.status)).length,
    failed: results.filter((item) => item.status === 'failed').length,
    blocked: results.filter((item) => item.status === 'blocked').length,
    other: results.filter((item) => !['passed', 'pass', 'failed', 'blocked'].includes(item.status)).length,
  };
}

function flattenScreenshots(value) {
  const out = [];
  const visit = (item) => {
    if (!item) return;
    if (typeof item === 'string') out.push(item);
    else if (Array.isArray(item)) item.forEach(visit);
    else if (typeof item === 'object') Object.values(item).forEach(visit);
  };
  visit(value);
  return out;
}

function renderReport(summary) {
  const lines = [
    '# QBot 自动化测试执行报告',
    '',
    `- 执行时间：${summary.started_at} 至 ${summary.ended_at}`,
    `- 执行目录：${summary.run_dir}`,
    `- 用例源：${summary.casebook}`,
    `- 执行 profile：${summary.profile}`,
    `- 执行 suite：${summary.suite}`,
    `- CDP：${summary.cdp_url}`,
    '',
    '## 统计',
    '',
    `- 总数：${summary.counts.total}`,
    `- 通过：${summary.counts.passed}`,
    `- 失败：${summary.counts.failed}`,
    `- 阻塞：${summary.counts.blocked}`,
    `- 其他：${summary.counts.other}`,
    '',
    '## 用例结果',
    '',
    '| 执行ID | 套件 | 优先级 | 结果 | 说明 | 报告 |',
    '| --- | --- | --- | --- | --- | --- |',
  ];
  for (const result of summary.results) {
    const reason = String(result.reason || result.conclusion || result.actual_result || '').replace(/\|/g, '/').replace(/\s+/g, ' ').slice(0, 180);
    lines.push(`| ${result.id} | ${result.suite || ''} | ${result.priority || ''} | ${result.status} | ${reason} | ${result.case_report || result.runner_report || ''} |`);
  }
  const failed = summary.results.filter((item) => item.status === 'failed');
  const blocked = summary.results.filter((item) => item.status === 'blocked');
  if (failed.length) {
    lines.push('', '## 失败用例', '');
    for (const item of failed) {
      lines.push(`- ${item.id} ${item.title}: ${item.problem_description || item.reason || item.actual_result || '断言失败'}`);
    }
  }
  if (blocked.length) {
    lines.push('', '## 阻塞用例', '');
    for (const item of blocked) {
      lines.push(`- ${item.id} ${item.title}: ${item.reason || '执行阻塞'}`);
    }
  }
  lines.push('');
  return `${lines.join('\n')}\n`;
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const root = path.resolve(String(options.root || DEFAULT_ROOT));
  const profile = String(options.profile || 'mandatory');
  const suite = String(options.suite || 'all');
  const cdp = String(options.cdp || process.env.QBOT_CDP_URL || DEFAULT_CDP);
  const timeoutMs = Number(options['timeout-ms'] || DEFAULT_TIMEOUT_MS);
  const outRoot = path.resolve(String(options['out-root'] || path.join(root, 'autoTest')));
  const runId = String(options['run-id'] || `${timestampForPath()}-qbot-automation`);
  const runDir = path.resolve(String(options.out || path.join(outRoot, runId)));
  const casebook = path.join(root, 'PRD', 'Qbot_TestCase.xlsx');
  const caseMap = readJson(CASE_MAP_FILE);
  const meta = caseMetaById(caseMap);
  const selected = selectCases({
    caseMap,
    profile,
    suite,
    explicitCases: splitCases(options.case),
  });

  ensureDir(runDir);
  ensureDir(path.join(runDir, 'logs'));
  writeJson(path.join(runDir, 'selected-core-cases.json'), selected.core);
  writeJson(path.join(runDir, 'selected-module-cases.json'), selected.module);
  writeJson(path.join(runDir, 'core-case-map-used.json'), caseMap);

  const startedAt = new Date();
  const commands = [];
  let allResults = [];

  if (!fs.existsSync(casebook)) {
    const summary = {
      status: 'blocked',
      reason: `用例源不存在：${casebook}`,
      run_dir: runDir,
      casebook,
      profile,
      suite,
      cdp_url: cdp,
      started_at: startedAt.toISOString(),
      ended_at: new Date().toISOString(),
      selected,
      commands,
      results: [],
      counts: countResults([]),
    };
    writeJson(path.join(runDir, 'automation-run-summary.json'), summary);
    writeText(path.join(runDir, 'automation-run-report.md'), renderReport(summary));
    console.log(JSON.stringify(summary, null, 2));
    process.exitCode = 1;
    return;
  }

  if (options['skip-run'] !== true) {
    if (selected.core.length) {
      const outDir = path.join(runDir, 'core-system-run');
      const logPrefix = path.join(runDir, 'logs', 'core-system-run');
      const commandResult = runCli({
        root,
        command: 'ui-agent-run',
        outDir,
        cases: selected.core,
        cdp,
        timeoutMs,
        scenariosFile: CORE_SCENARIOS_FILE,
        logPrefix,
      });
      writeText(commandResult.stdout_file, commandResult.stdout);
      writeText(commandResult.stderr_file, commandResult.stderr);
      commands.push({ ...commandResult, stdout: undefined, stderr: undefined });
      const reportFile = path.join(outDir, 'ui-agent-report.json');
      const report = readReport(reportFile);
      allResults = allResults.concat(normalizeResults({
        report,
        selectedCases: selected.core,
        suiteName: 'core',
        reportFile,
        meta,
      }));
    }

    if (selected.module.length) {
      const outDir = path.join(runDir, 'module-run');
      const logPrefix = path.join(runDir, 'logs', 'module-run');
      const commandResult = runCli({
        root,
        command: 'ui-agent-module-run',
        outDir,
        cases: selected.module,
        cdp,
        timeoutMs,
        scenariosFile: null,
        logPrefix,
      });
      writeText(commandResult.stdout_file, commandResult.stdout);
      writeText(commandResult.stderr_file, commandResult.stderr);
      commands.push({ ...commandResult, stdout: undefined, stderr: undefined });
      const reportFile = path.join(outDir, 'ui-agent-module-report.json');
      const report = readReport(reportFile);
      allResults = allResults.concat(normalizeResults({
        report,
        selectedCases: selected.module,
        suiteName: 'module',
        reportFile,
        meta,
      }));
    }
  }

  allResults = allResults.map((result) => ({
    ...result,
    screenshots_flat: flattenScreenshots(result.screenshots),
  }));
  const counts = countResults(allResults);
  const dryRun = options['skip-run'] === true;
  const status = dryRun ? 'dry-run' : counts.failed ? 'failed' : counts.blocked ? 'blocked' : 'passed';
  const summary = {
    status,
    dry_run: dryRun,
    run_dir: runDir,
    casebook,
    profile,
    suite,
    cdp_url: cdp,
    started_at: startedAt.toISOString(),
    ended_at: new Date().toISOString(),
    selected,
    commands,
    results: allResults,
    counts,
  };
  writeJson(path.join(runDir, 'automation-run-summary.json'), summary);
  writeText(path.join(runDir, 'automation-run-report.md'), renderReport(summary));
  console.log(JSON.stringify({
    status,
    run_dir: runDir,
    report: path.join(runDir, 'automation-run-report.md'),
    summary: path.join(runDir, 'automation-run-summary.json'),
    counts,
  }, null, 2));
  if (!dryRun && status !== 'passed') process.exitCode = 1;
}

main();
