#!/usr/bin/env node
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runAutomationCommand } from './lib/automation-executor.mjs';
import { runReleasePackageAutomation } from './lib/release-package-automation.mjs';
import { generateAutomationFlows } from './lib/automation.mjs';
import { auditOutputs } from './lib/audit.mjs';
import { buildIssueMatrix } from './lib/classifier.mjs';
import { writeTabularOutputs } from './lib/excel.mjs';
import { ensureDir, parseArgs, timestampForPath, writeJsonFile, writeTextFile } from './lib/fs.mjs';
import { buildIssueIntelligence, issuesForTestDesign } from './lib/issue-intelligence.mjs';
import { loadIssues } from './lib/issues.mjs';
import { loadLiveGitLabIssues } from './lib/live-gitlab.mjs';
import { buildMonitorReport } from './lib/monitor.mjs';
import { renderIssueIntelligence, renderMonitor, writeReports } from './lib/reports.mjs';
import { generateTestCases } from './lib/testcases.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function defaultRepoRoot() {
  return process.env.DEEPBANK_REPO || (process.platform === 'win32' ? 'D:\\deepbankV2' : path.resolve(ROOT, '..', 'deepbankV2'));
}

function resolveOptions(raw) {
  const repoRoot = path.resolve(raw.repo || defaultRepoRoot());
  const runId = raw['run-id'] || timestampForPath();
  const outDir = path.resolve(raw.out || path.join(ROOT, 'outputs', runId));
  const stateFile = path.resolve(raw.state || path.join(ROOT, 'state', 'issue-monitor-snapshot.json'));
  const saveState = raw['save-state'] !== false && raw.state !== 'none';
  const source = raw.source || 'local-export';
  const gitlabHost = raw['gitlab-host'] || 'gitlab.daikuan.qihoo.net';
  const gitlabProject = raw['gitlab-project'] || 'songrongxin/deepbankv2';
  return { repoRoot, runId, outDir, stateFile, saveState, source, gitlabHost, gitlabProject };
}

function resolveAutomationOptions(raw) {
  const repoRoot = path.resolve(raw.repo || defaultRepoRoot());
  const runId = raw['run-id'] || timestampForPath();
  const outDir = path.resolve(raw.out || path.join(ROOT, 'outputs', runId));
  const flowsFile = path.resolve(raw.flows || path.join(outDir, 'codex-automation-flows.json'));
  return { repoRoot, runId, outDir, flowsFile };
}

function loadIssueSource(options) {
  if (options.source === 'live-gitlab') {
    return loadLiveGitLabIssues({ host: options.gitlabHost, projectPath: options.gitlabProject });
  }
  if (options.source !== 'local-export') {
    throw new Error(`Unsupported issue source: ${options.source}`);
  }
  return loadIssues(options.repoRoot);
}

export async function run(command, rawOptions = {}) {
  if (['release-package-doctor', 'release-package-run'].includes(command)) {
    return await runReleasePackageAutomation({
      mode: command === 'release-package-doctor' ? 'doctor' : 'run',
      options: rawOptions,
      root: ROOT,
    });
  }

  if (['automation-doctor', 'automation-run'].includes(command)) {
    const options = resolveAutomationOptions(rawOptions);
    return runAutomationCommand({
      mode: command === 'automation-doctor' ? 'doctor' : 'run',
      repoRoot: options.repoRoot,
      flowsFile: options.flowsFile,
      outDir: options.outDir,
      options: rawOptions,
    });
  }

  const options = resolveOptions(rawOptions);
  ensureDir(options.outDir);
  let issues = [];
  let sources = [];
  let sourceErrors = [];
  try {
    ({ issues, sources, errors: sourceErrors } = loadIssueSource(options));
  } catch (error) {
    sourceErrors = [{ file: options.source, error: error.message }];
  }
  if (options.source === 'local-export' && sources.length === 0 && sourceErrors.length === 0) {
    sourceErrors = [{
      file: options.repoRoot,
      error: 'No local GitLab issue export files found. Use --source live-gitlab for current coverage or provide issues/issue_*.json, issues.json, or issues_closed.json.',
    }];
  }
  const issueMatrix = buildIssueMatrix(issues);
  const issueIntelligence = buildIssueIntelligence(issues);
  const testDesignIssues = issuesForTestDesign(issues, issueIntelligence);
  const { report: monitorReport } = buildMonitorReport({
    issues,
    stateFile: options.stateFile,
    saveState: options.saveState && command !== 'generate' && sourceErrors.length === 0,
    sourceMode: options.source,
  });
  if (sourceErrors.length) {
    monitorReport.new_issues = [];
    monitorReport.changed_issues = [];
    monitorReport.closed_or_reopened_issues = [];
    monitorReport.removed_issues = [];
    monitorReport.module_impact = {};
    monitorReport.test_plan_decision = {
      required: false,
      reason: 'Issue source unavailable; monitor did not compare snapshots.',
      recommended_agents: ['qbot-test-chief'],
    };
    monitorReport.workflow_plan = [{
      step: 1,
      agent: 'qbot-test-chief',
      action: 'Blocked: restore a fresh issue source before updating or accepting the test plan.',
    }];
    monitorReport.blockers.push(...sourceErrors.map((error) => `Issue source read error in ${error.file}: ${error.error}`));
  }

  if (command === 'monitor') {
    const monitorOnly = { monitorReport, issueIntelligence, sources, sourceErrors, options };
    writeJsonFile(path.join(options.outDir, 'monitor-only.json'), monitorOnly);
    writeJsonFile(path.join(options.outDir, 'monitor-report.json'), monitorReport);
    writeTextFile(path.join(options.outDir, 'monitor-report.md'), renderMonitor(monitorReport));
    writeJsonFile(path.join(options.outDir, 'issue-intelligence-report.json'), issueIntelligence);
    writeTextFile(path.join(options.outDir, 'issue-intelligence-report.md'), renderIssueIntelligence(issueIntelligence));
    return monitorOnly;
  }

  const testCases = generateTestCases(testDesignIssues);
  const automationFlows = generateAutomationFlows(testCases);
  const tableFiles = writeTabularOutputs({
    outDir: options.outDir,
    deepbankRoot: options.repoRoot,
    issueMatrix,
    issueScopeRows: issueIntelligence.issue_scope_rows,
    testCases,
    automationFlows,
  });
  const audit = auditOutputs({ issueMatrix, issueIntelligence, testCases, automationFlows, sourceErrors, tableFiles });
  const reportFiles = writeReports({
    outDir: options.outDir,
    repoRoot: options.repoRoot,
    monitorReport,
    issueMatrix,
    issueIntelligence,
    testCases,
    automationFlows,
    audit,
  });
  const result = {
    run_id: options.runId,
    command,
    repo_root: options.repoRoot,
    out_dir: options.outDir,
    source_files: sources,
    source_errors: sourceErrors,
    counts: {
      issues: issues.length,
      product_issues: issueIntelligence.selected_product_issue_count,
      excluded_issues: issueIntelligence.excluded_issue_count,
      test_cases: testCases.length,
      automation_flows: automationFlows.length,
    },
    audit,
    files: { ...tableFiles, ...reportFiles },
  };
  writeJsonFile(path.join(options.outDir, 'run-result.json'), result);
  return result;
}

if (path.resolve(fileURLToPath(import.meta.url)) === path.resolve(process.argv[1])) {
  const { command, options } = parseArgs(process.argv.slice(2));
  if (!['run', 'monitor', 'generate', 'analyze', 'automation-doctor', 'automation-run', 'release-package-doctor', 'release-package-run'].includes(command)) {
    console.error(`Unknown command: ${command}`);
    process.exit(2);
  }
  const effectiveCommand = command === 'analyze' ? 'generate' : command;
  const result = await run(effectiveCommand, options);
  console.log(JSON.stringify({
    command,
    out_dir: result.options?.outDir || result.out_dir,
    counts: result.counts || null,
    audit_status: result.audit?.status || null,
    automation_status: result.status || null,
    automation_summary: result.summary || null,
    release_package: result.package
      ? {
          status: result.status,
          package: result.package.source,
          app: result.package.app_path,
          cdp: result.cdp?.status,
          operation: result.operation?.status,
          screenshot: result.artifacts?.initial_screenshot || null,
        }
      : null,
    issue_loop: result.issue_loop
      ? {
          status: result.issue_loop.status,
          draft_count: result.issue_loop.draft_count,
          created_count: result.issue_loop.created_count,
          failed_count: result.issue_loop.failed_count,
        }
      : null,
  }, null, 2));
  if (
    result.audit?.status === 'blocked'
    || result.monitorReport?.blockers?.length
    || result.status === 'failed'
    || result.status === 'blocked'
    || result.status === 'incomplete'
  ) process.exitCode = 1;
}
