#!/usr/bin/env node
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runAutomationCommand } from './lib/automation-executor.mjs';
import { runReleasePackageAutomation } from './lib/release-package-automation.mjs';
import { runUiAgentCasebookCommand } from './lib/ui-agent-casebook-runner.mjs';
import { runUiAgentExploreCommand } from './lib/ui-agent-explorer.mjs';
import { runUiAgentModuleCommand } from './lib/ui-agent-module-runner.mjs';
import { runUiAgentCommand } from './lib/ui-agent-runner.mjs';
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
import { executeUnderManagedRunnerLock } from '../teams360-automation/lib/managed-runner-lock.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const COMMANDS = [
  'run',
  'monitor',
  'generate',
  'analyze',
  'automation-doctor',
  'automation-run',
  'release-package-doctor',
  'release-package-run',
  'ui-agent-doctor',
  'ui-agent-run',
  'ui-agent-fixtures',
  'ui-agent-explore',
  'ui-agent-module-run',
  'ui-agent-casebook-run',
];

export function usage(command = '') {
  const common = `QbotTestAgent

Usage:
  node src/cli.mjs <command> [options]
  node src/cli.mjs <command> --help

Commands:
${COMMANDS.map((item) => `  ${item}`).join('\n')}
`;
  if (command !== 'ui-agent-casebook-run') return common;
  return `${common}
ui-agent-casebook-run:
  --casebook <xlsx>              Casebook path
  --sheet <exact-name>           Exact visible Sheet name
  --profile <name>               Case profile (default: mandatory)
  --case <id[,id...]>            Ordered Case IDs
  --offset <n> --limit <n>       Selection window
  --cdp <loopback-url>           QBot/QWork CDP endpoint
  --out <new-directory>          Immutable output directory
  --model-tier <tier>            Model tier, for example M3
  --timeout-ms <ms>              Per-Case wait limit
  --single-host-pipeline <1-20>  Ordered single-host pipeline size; Core Beta
                                  v2 always executes Cases serially (effective 1)
  --core-beta-fixture-control-url <url>
                                  Strict Core Beta fixture controller
  --core-beta-cleanup-from <dir>  Frozen sibling batch whose exact QA Skill
                                  ledger seeds a BETA-SKILL-001 cleanup run
  --core-beta-cleanup-release-migration true
                                  Explicitly allow that cleanup across a product
                                  upgrade after strict profile/origin/root checks
  --production-gate true         Enable release-identity gate
  --control-plane-url <origin>   Exact control plane from the matching READY
  --scoped-execution true        Explicit non-release subset execution
  --excluded-case <id[,id...]>   Exact Case IDs omitted from the scope
  --scope-reason <text>          Required immutable exclusion reason
  --backend-version <id>
  --prompt-policy-version <id>
  --feature-flags-hash <sha256>
  --qwork-ui-git-commit <commit>
  --qwork-build-id <id>
  --qwork-release-manifest-sha256 <sha256>
  --skip-run                     Protocol/fixture dry-run only; synthetic and
                                  never eligible for trusted pass

Run npm run core-beta:pretest before every real 16/12/70/160 Casebook stage.
`;
}

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
  if (command === 'ui-agent-casebook-run') {
    return await runUiAgentCasebookCommand({
      options: rawOptions,
      root: ROOT,
    });
  }

  if (command === 'ui-agent-explore') {
    return await runUiAgentExploreCommand({
      options: rawOptions,
      root: ROOT,
    });
  }

  if (command === 'ui-agent-module-run') {
    return await runUiAgentModuleCommand({
      options: rawOptions,
      root: ROOT,
    });
  }

  if (['ui-agent-doctor', 'ui-agent-run', 'ui-agent-fixtures'].includes(command)) {
    const mode = command.replace('ui-agent-', '');
    return await runUiAgentCommand({
      mode,
      options: rawOptions,
      root: ROOT,
    });
  }

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
  const argv = process.argv.slice(2);
  if (['--help', '-h', 'help'].includes(argv[0])) {
    console.log(usage(argv[1] || ''));
    process.exit(0);
  }
  const { command, options } = parseArgs(argv);
  if (options.help === true) {
    console.log(usage(command));
    process.exit(0);
  }
  if (!COMMANDS.includes(command)) {
    console.error(`Unknown command: ${command}`);
    process.exit(2);
  }
  if (command === 'ui-agent-casebook-run') {
    const lock = executeUnderManagedRunnerLock({
      entrypoint: fileURLToPath(import.meta.url),
      argv,
      binding: { runner: 'root-casebook', argv },
    });
    if (lock.reexecuted) process.exit(lock.status);
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
    ui_agent: result.command?.startsWith?.('ui-agent')
      ? {
          status: result.status,
          summary: result.summary || null,
          doctor: result.doctor
            ? {
                status: result.doctor.status,
                login_required: result.doctor.login_required,
                composer: result.doctor.composer || null,
                upload: result.doctor.upload || null,
              }
            : null,
          report: result.command === 'ui-agent-fixtures'
            ? null
            : result.command === 'ui-agent-module-run'
              ? (result.out_dir ? path.join(result.out_dir, 'ui-agent-module-report.md') : null)
              : result.command === 'ui-agent-casebook-run'
                ? (result.run_dir ? path.join(result.run_dir, 'automation-run-report.md') : null)
                : result.out_dir ? path.join(result.out_dir, 'ui-agent-report.md') : null,
          fixtures_report: result.command === 'ui-agent-fixtures' && result.out_dir
            ? path.join(result.out_dir, 'ui-agent-fixtures-report.md')
            : null,
          explore_report: result.command === 'ui-agent-explore' && result.out_dir
            ? path.join(result.out_dir, 'ui-agent-explore-report.md')
            : null,
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
