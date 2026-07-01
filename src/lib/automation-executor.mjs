import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { ensureDir, readJsonFile, writeJsonFile, writeTextFile } from './fs.mjs';
import { buildIssueLoop } from './bug-issue-loop.mjs';

const SUITES = {
  smoke: { levels: ['A0'], scopes: ['local_mock_or_fixture'] },
  daily: { levels: ['A0', 'A1'], scopes: ['local_mock_or_fixture'] },
  local: { levels: ['A0', 'A1'], scopes: ['local_mock_or_fixture', 'design_review'] },
  real: { levels: ['A2'], scopes: ['real_dependency'] },
  release: { levels: ['A3'], scopes: ['release_specialty'] },
  all: { levels: ['A0', 'A1', 'A2', 'A3'], scopes: null },
};

export function runAutomationCommand({ mode, repoRoot, flowsFile, outDir, options = {} }) {
  const resolvedRepo = path.resolve(repoRoot || process.env.DEEPBANK_REPO || process.cwd());
  const resolvedFlows = path.resolve(flowsFile || path.join(process.cwd(), 'codex-automation-flows.json'));
  const resolvedOut = path.resolve(outDir || path.join(process.cwd(), 'automation-run'));
  const targetOs = normalizeFlowOs(options.os || currentFlowOs());
  ensureDir(resolvedOut);
  const flows = readJsonFile(resolvedFlows);
  if (!Array.isArray(flows)) throw new Error(`Automation flows file must contain an array: ${resolvedFlows}`);

  const suite = String(options.suite || 'daily');
  if (!SUITES[suite]) throw new Error(`Unsupported automation suite: ${suite}. Use one of ${Object.keys(SUITES).join(', ')}.`);
  const selected = selectFlows(flows, {
    osName: targetOs,
    suite,
    levels: splitList(options.level),
    flowIds: splitList(options['flow-id']),
    caseIds: splitList(options['case-id']),
    limit: options.limit ? Number(options.limit) : null,
    shard: options.shard,
    retryFailedReport: options['retry-failed-report'],
  });
  const doctor = buildDoctor({ repoRoot: resolvedRepo, flowsFile: resolvedFlows, flows: selected, suite, osName: targetOs });
  const dryRun = mode === 'doctor' || Boolean(options['dry-run']);
  const includeBlocked = Boolean(options['include-blocked']);
  const failFast = Boolean(options['fail-fast']);
  const strictAssertions = Boolean(options['strict-assertions']);
  const progressFile = path.join(resolvedOut, 'automation-progress.json');
  const startedAt = new Date();
  const maxDurationMs = Number(options['max-duration-minutes'])
    ? Math.max(1, Number(options['max-duration-minutes'])) * 60 * 1000
    : null;
  const priorResults = options.resume ? loadPriorResults(progressFile) : [];
  const completedFlowIds = new Set(priorResults.map((result) => result.flow_id));
  const results = [...priorResults];
  let stopReason = '';

  for (const flow of selected) {
    if (completedFlowIds.has(flow.flow_id)) continue;
    if (maxDurationMs && Date.now() - startedAt.getTime() >= maxDurationMs) {
      stopReason = `Reached max duration window: ${options['max-duration-minutes']} minute(s).`;
      break;
    }
    const result = executeFlow({
      flow,
      repoRoot: resolvedRepo,
      outDir: resolvedOut,
      dryRun,
      includeBlocked,
      doctor,
      strictAssertions,
    });
    results.push(result);
    writeJsonFile(progressFile, buildExecutionReport({
      mode,
      resolvedRepo,
      resolvedFlows,
      resolvedOut,
      suite,
      targetOs,
      dryRun,
      flows,
      selected,
      doctor,
      results,
      startedAt,
      stopReason: '',
      progress: true,
    }));
    if (failFast && result.status === 'failed') break;
  }

  const report = buildExecutionReport({
    mode,
    resolvedRepo,
    resolvedFlows,
    resolvedOut,
    suite,
    targetOs,
    dryRun,
    flows,
    selected,
    doctor,
    results,
    startedAt,
    stopReason,
    progress: false,
  });
  report.issue_loop = buildIssueLoop({ report, outDir: resolvedOut, options });

  writeJsonFile(path.join(resolvedOut, 'automation-execution-report.json'), report);
  writeTextFile(path.join(resolvedOut, 'automation-execution-report.md'), renderAutomationExecutionReport(report));
  writeTextFile(path.join(resolvedOut, 'automation-delivery-report.md'), renderAutomationDeliveryReport(report));
  return report;
}

function buildExecutionReport({
  mode,
  resolvedRepo,
  resolvedFlows,
  resolvedOut,
  suite,
  targetOs,
  dryRun,
  flows,
  selected,
  doctor,
  results,
  startedAt,
  stopReason,
  progress,
}) {
  const summary = summarizeResults(results);
  const completedFlowIds = new Set(results.map((result) => result.flow_id));
  const remaining = selected.filter((flow) => !completedFlowIds.has(flow.flow_id)).length;
  const report = {
    command: mode,
    generated_at: new Date().toISOString(),
    started_at: startedAt.toISOString(),
    repo_root: resolvedRepo,
    flows_file: resolvedFlows,
    out_dir: resolvedOut,
    suite,
    target_os: targetOs,
    current_os: currentFlowOs(),
    dry_run: dryRun,
    progress,
    stop_reason: stopReason || '',
    selection: {
      total_flows: flows.length,
      selected_flows: selected.length,
      completed_flows: results.length,
      remaining_flows: remaining,
      levels: [...new Set(selected.map((flow) => flow.automation_level))],
      execution_scopes: [...new Set(selected.map((flow) => flow.execution_scope))],
    },
    doctor,
    summary,
    results,
  };
  report.status = remaining > 0 && stopReason
    ? 'incomplete'
    : report.summary.failed > 0
    ? 'failed'
    : report.summary.blocked > 0
      ? 'blocked'
      : 'pass';
  return report;
}

function selectFlows(flows, { osName, suite, levels, flowIds, caseIds, limit, shard, retryFailedReport }) {
  const suiteConfig = SUITES[suite];
  const wantedLevels = levels.length ? levels : suiteConfig.levels;
  const retryFlowIds = retryFailedReport ? failedFlowIdsFromReport(retryFailedReport) : null;
  let selected = flows.filter((flow) => {
    if (String(flow.os) !== osName) return false;
    if (wantedLevels.length && !wantedLevels.includes(String(flow.automation_level))) return false;
    if (suiteConfig.scopes && !suiteConfig.scopes.includes(String(flow.execution_scope))) return false;
    if (!['release', 'all'].includes(suite) && hasReleaseCommand(flow)) return false;
    if (flowIds.length && !flowIds.includes(String(flow.flow_id))) return false;
    if (caseIds.length && !caseIds.some((caseId) => flowCaseIds(flow).includes(caseId))) return false;
    if (retryFlowIds && !retryFlowIds.has(String(flow.flow_id))) return false;
    return true;
  });
  selected = applyShard(selected, shard);
  if (Number.isFinite(limit) && limit > 0) selected = selected.slice(0, limit);
  return selected;
}

function hasReleaseCommand(flow) {
  return /npm\s+run\s+(?:build:desktop|dist:desktop|e2e:release:[A-Za-z0-9:_-]+|release:[A-Za-z0-9:_-]+)/.test(String(flow.codex_prompt_or_command || ''));
}

function buildDoctor({ repoRoot, flowsFile, flows, suite, osName }) {
  const packageFile = path.join(repoRoot, 'package.json');
  const packageJson = fs.existsSync(packageFile) ? readJsonFile(packageFile) : null;
  const scripts = packageJson?.scripts || {};
  const requiredScripts = [...new Set(flows.flatMap((flow) => npmScriptsIn(flow.codex_prompt_or_command)))].sort();
  const missingScripts = requiredScripts.filter((script) => !scripts[script]);
  const envGroups = flows.flatMap((flow) => envRequirementGroups(flow.required_env));
  const declaredEnv = [...new Set(envGroups.flat())].sort();
  const autoProvidedEnv = new Set(['DEEPBANK_REPO', 'DEEPBANK_TEST_HOME']);
  const missingEnv = envGroups
    .filter((group) => group.length && !group.some((name) => autoProvidedEnv.has(name) || process.env[name]))
    .map((group) => group.join(' or '));
  const currentOs = currentFlowOs();
  const findings = [];

  if (!fs.existsSync(packageFile)) findings.push(`Missing package.json under repo root: ${repoRoot}`);
  if (osName !== currentOs) findings.push(`Target flow OS is ${osName}, but this machine is ${currentOs}.`);
  if (missingScripts.length) findings.push(`Missing package scripts in Deepbank repo: ${missingScripts.join(', ')}`);
  if (!flows.length) findings.push(`No flows selected for suite=${suite}, os=${osName}.`);

  return {
    status: findings.length ? 'blocked' : 'pass',
    current_os: currentOs,
    target_os: osName,
    package_json: packageFile,
    package_json_exists: fs.existsSync(packageFile),
    selected_flow_count: flows.length,
    required_scripts: requiredScripts,
    missing_scripts: missingScripts,
    declared_env_names: declaredEnv,
    missing_env_names: [...new Set(missingEnv)].sort(),
    env_auto_provided_by_runner: [...autoProvidedEnv],
    findings,
    flows_file: flowsFile,
  };
}

function executeFlow({ flow, repoRoot, outDir, dryRun, includeBlocked, doctor, strictAssertions }) {
  const flowDir = path.join(outDir, 'flows', safeName(flow.flow_id));
  ensureDir(flowDir);
  const script = String(flow.codex_prompt_or_command || '');
  writeTextFile(path.join(flowDir, scriptFileName(flow.os)), script);

  const missingEnv = envNamesIn(flow.required_env)
    .filter((name) => !['DEEPBANK_REPO', 'DEEPBANK_TEST_HOME'].includes(name))
    .filter((name) => !process.env[name]);
  const missingEnvGroups = envRequirementGroups(flow.required_env)
    .filter((group) => group.length && !group.some((name) => ['DEEPBANK_REPO', 'DEEPBANK_TEST_HOME'].includes(name) || process.env[name]))
    .map((group) => group.join(' or '));
  const isBlockedScope = flow.execution_scope === 'blocked_dependency' || /^Blocked until resolved:/m.test(String(flow.skip_or_block_rules || ''));
  const osMismatch = flow.os !== currentFlowOs();
  const timeoutMs = Math.max(1, Number(flow.timeout_minutes || 30)) * 60 * 1000;

  const base = {
    flow_id: flow.flow_id,
    linked_case_ids: flow.linked_case_ids,
    os: flow.os,
    automation_level: flow.automation_level,
    execution_scope: flow.execution_scope,
    timeout_minutes: flow.timeout_minutes,
    script_path: path.join(flowDir, scriptFileName(flow.os)),
    stdout_path: path.join(flowDir, 'stdout.log'),
    stderr_path: path.join(flowDir, 'stderr.log'),
    case_assertions: String(flow.assertions || ''),
    blackbox_assertions: String(flow.blackbox_assertions || ''),
    expected_evidence_paths: String(flow.evidence_paths || ''),
  };

  if (osMismatch) {
    return withAssertionPlan(base, 'blocked', `Cannot execute ${flow.os} flow on ${currentFlowOs()} runner.`);
  }
  if (isBlockedScope && !includeBlocked) {
    return withAssertionPlan(base, 'blocked', 'Flow is blocked_dependency or has an explicit blocked rule. Use --include-blocked only for diagnostic dry-runs.');
  }
  if ((missingEnvGroups.length || missingEnv.length) && ['A2', 'A3'].includes(String(flow.automation_level))) {
    return withAssertionPlan(base, 'blocked', `Missing required env names for real/release flow: ${(missingEnvGroups.length ? missingEnvGroups : missingEnv).join(', ')}`);
  }
  if (doctor.missing_scripts.length) {
    return withAssertionPlan(base, 'blocked', `Missing package scripts: ${doctor.missing_scripts.join(', ')}`);
  }
  if (dryRun) {
    return withAssertionPlan(base, 'planned', 'Dry run only; command was not executed.');
  }

  const env = {
    ...process.env,
    DEEPBANK_REPO: repoRoot,
    DEEPBANK_TEST_HOME: process.env.DEEPBANK_TEST_HOME || path.join(outDir, 'test-home'),
  };
  ensureDir(env.DEEPBANK_TEST_HOME);
  const startedAt = new Date();
  const child = spawnScript(flow.os, script, { cwd: repoRoot, env, timeoutMs });
  const endedAt = new Date();
  writeTextFile(base.stdout_path, child.stdout || '');
  writeTextFile(base.stderr_path, child.stderr || '');
  const timedOut = child.error?.code === 'ETIMEDOUT' || child.signal === 'SIGTERM';
  let status = child.status === 0 && !timedOut ? 'passed' : 'failed';
  const assertionEvaluation = evaluateAssertions({
    flow,
    repoRoot,
    outDir,
    base,
    child,
    timedOut,
    commandPassed: status === 'passed',
    strictAssertions,
  });
  if (assertionEvaluation.assertion_status === 'failed') status = 'failed';
  return {
    ...base,
    status,
    reason: status === 'passed'
      ? assertionEvaluation.assertion_status === 'pass-with-warnings'
        ? 'Command exited 0; assertion checklist has warnings.'
        : 'Command exited 0.'
      : timedOut
        ? 'Command timed out.'
        : assertionEvaluation.failed_reason || `Command exited ${child.status ?? 'unknown'}.`,
    exit_code: child.status,
    signal: child.signal,
    started_at: startedAt.toISOString(),
    ended_at: endedAt.toISOString(),
    duration_ms: endedAt.getTime() - startedAt.getTime(),
    ...assertionEvaluation,
  };
}

function spawnScript(flowOs, script, { cwd, env, timeoutMs }) {
  if (flowOs === 'Windows') {
    return spawnSync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', script], {
      cwd,
      env,
      timeout: timeoutMs,
      encoding: 'utf8',
      maxBuffer: 50 * 1024 * 1024,
    });
  }
  return spawnSync('/bin/bash', ['-lc', script], {
    cwd,
    env,
    timeout: timeoutMs,
    encoding: 'utf8',
    maxBuffer: 50 * 1024 * 1024,
  });
}

function summarizeResults(results) {
  const summary = { total: results.length, planned: 0, passed: 0, failed: 0, blocked: 0 };
  for (const result of results) {
    if (summary[result.status] == null) summary[result.status] = 0;
    summary[result.status] += 1;
  }
  return summary;
}

export function renderAutomationExecutionReport(report) {
  return [
    '# QBot Automation Execution Report',
    '',
    `- Command: ${report.command}`,
    `- Status: ${report.status}`,
    `- Suite: ${report.suite}`,
    `- Target OS: ${report.target_os}`,
    `- Current OS: ${report.current_os}`,
    `- Dry run: ${report.dry_run}`,
    `- Repo: ${report.repo_root}`,
    `- Flows file: ${report.flows_file}`,
    `- Selected flows: ${report.selection.selected_flows}`,
    `- Completed flows: ${report.selection.completed_flows ?? report.results.length}`,
    `- Remaining flows: ${report.selection.remaining_flows ?? 0}`,
    `- Levels: ${report.selection.levels.join(', ') || 'none'}`,
    `- Execution scopes: ${report.selection.execution_scopes.join(', ') || 'none'}`,
    `- Stop reason: ${report.stop_reason || 'none'}`,
    `- Bug issue drafts: ${report.issue_loop?.draft_count ?? 0}`,
    `- GitLab issues created: ${report.issue_loop?.created_count ?? 0}`,
    '',
    '## Doctor',
    `- Status: ${report.doctor.status}`,
    `- Package JSON exists: ${report.doctor.package_json_exists}`,
    `- Required scripts: ${report.doctor.required_scripts.join(', ') || 'none'}`,
    `- Missing scripts: ${report.doctor.missing_scripts.join(', ') || 'none'}`,
    `- Missing env names: ${report.doctor.missing_env_names.join(', ') || 'none'}`,
    ...(report.doctor.findings.length ? report.doctor.findings.map((item) => `- Finding: ${item}`) : ['- Findings: none']),
    '',
    '## Summary',
    `- Total: ${report.summary.total}`,
    `- Planned: ${report.summary.planned}`,
    `- Passed: ${report.summary.passed}`,
    `- Failed: ${report.summary.failed}`,
    `- Blocked: ${report.summary.blocked}`,
    '',
    '## Results',
    ...(report.results.length
      ? report.results.map((result) => {
          const assertionText = result.assertion_status ? `; assertions=${result.assertion_status}` : '';
          return `- ${result.status}: ${result.flow_id} (${result.automation_level}/${result.execution_scope}) - ${result.reason}${assertionText}`;
        })
      : ['- None']),
    '',
    '## Assertion Checklist',
    ...(report.results.length
      ? report.results.flatMap((result) => [
          `### ${result.flow_id}`,
          ...(result.assertion_checks || []).map((check) => `- ${check.status}: ${check.name} - ${check.detail}`),
        ])
      : ['- None']),
    '',
    '## Bug Issue Loop',
    `- Status: ${report.issue_loop?.status || 'none'}`,
    `- Draft count: ${report.issue_loop?.draft_count ?? 0}`,
    `- Created count: ${report.issue_loop?.created_count ?? 0}`,
    `- Existing count: ${report.issue_loop?.existing_count ?? 0}`,
    `- Failed count: ${report.issue_loop?.failed_count ?? 0}`,
    `- Drafts JSON: ${report.issue_loop?.files?.drafts_json || 'none'}`,
    `- Drafts MD: ${report.issue_loop?.files?.drafts_md || 'none'}`,
    `- Creation report: ${report.issue_loop?.files?.creation_json || 'none'}`,
    '',
  ].join('\n');
}

export function renderAutomationDeliveryReport(report) {
  const failed = (report.results || []).filter((result) => result.status === 'failed');
  const blocked = (report.results || []).filter((result) => result.status === 'blocked');
  const warnings = (report.results || []).filter((result) => result.assertion_status === 'pass-with-warnings');
  return [
    '# QBot Automation Delivery Report',
    '',
    `- Status: ${report.status}`,
    `- Suite: ${report.suite}`,
    `- Target OS: ${report.target_os}`,
    `- Started at: ${report.started_at || 'unknown'}`,
    `- Generated at: ${report.generated_at}`,
    `- Selected flows: ${report.selection.selected_flows}`,
    `- Completed flows: ${report.selection.completed_flows ?? report.results.length}`,
    `- Remaining flows: ${report.selection.remaining_flows ?? 0}`,
    `- Passed: ${report.summary.passed}`,
    `- Failed: ${report.summary.failed}`,
    `- Blocked: ${report.summary.blocked}`,
    `- Planned: ${report.summary.planned}`,
    `- Stop reason: ${report.stop_reason || 'none'}`,
    `- Bug issue drafts: ${report.issue_loop?.draft_count ?? 0}`,
    `- GitLab issues created: ${report.issue_loop?.created_count ?? 0}`,
    '',
    '## Delivery Decision',
    deliveryDecision(report),
    '',
    '## Failed Flows',
    ...(failed.length ? failed.map((result) => `- ${result.flow_id}: ${result.reason}`) : ['- None']),
    '',
    '## Blocked Flows',
    ...(blocked.length ? blocked.map((result) => `- ${result.flow_id}: ${result.reason}`) : ['- None']),
    '',
    '## Warning Flows',
    ...(warnings.length ? warnings.map((result) => `- ${result.flow_id}: ${result.reason}`) : ['- None']),
    '',
    '## Artifacts',
    `- Execution report JSON: ${path.join(report.out_dir, 'automation-execution-report.json')}`,
    `- Execution report MD: ${path.join(report.out_dir, 'automation-execution-report.md')}`,
    `- Progress checkpoint: ${path.join(report.out_dir, 'automation-progress.json')}`,
    `- Bug drafts JSON: ${report.issue_loop?.files?.drafts_json || 'none'}`,
    `- Bug drafts MD: ${report.issue_loop?.files?.drafts_md || 'none'}`,
    `- GitLab creation report: ${report.issue_loop?.files?.creation_json || 'none'}`,
    '',
  ].join('\n');
}

function deliveryDecision(report) {
  if (report.status === 'incomplete') {
    return 'Not ready for final delivery: execution stopped before all selected flows completed. Re-run with `--resume` using the same output directory.';
  }
  if (report.summary.failed > 0) {
    return 'Not ready for pass delivery: failed flows require bug triage. Review bug issue drafts and rerun failed flows after fixes.';
  }
  if (report.summary.blocked > 0) {
    return 'Conditionally delivered with blockers: blocked flows must be resolved or explicitly waived.';
  }
  if ((report.results || []).some((result) => result.assertion_status === 'pass-with-warnings')) {
    return 'Delivered with warnings: review missing evidence or non-artifact flow warnings.';
  }
  return 'Delivered: all selected flows completed without failures or blockers.';
}

function currentFlowOs() {
  if (process.platform === 'win32') return 'Windows';
  if (process.platform === 'darwin') return 'macOS';
  return os.type();
}

function normalizeFlowOs(value) {
  const text = String(value || '').trim().toLowerCase();
  if (['mac', 'macos', 'darwin', 'osx'].includes(text)) return 'macOS';
  if (['win', 'windows', 'win32'].includes(text)) return 'Windows';
  return value || currentFlowOs();
}

function splitList(value) {
  if (!value || value === true) return [];
  return String(value).split(',').map((item) => item.trim()).filter(Boolean);
}

function loadPriorResults(progressFile) {
  if (!fs.existsSync(progressFile)) return [];
  const progress = readJsonFile(progressFile);
  return Array.isArray(progress.results) ? progress.results : [];
}

function failedFlowIdsFromReport(reportFile) {
  const report = readJsonFile(path.resolve(reportFile));
  return new Set((report.results || [])
    .filter((result) => result.status === 'failed' || result.assertion_status === 'failed')
    .map((result) => String(result.flow_id)));
}

function applyShard(flows, shard) {
  if (!shard) return flows;
  const match = String(shard).trim().match(/^(\d+)\/(\d+)$/);
  if (!match) throw new Error(`Invalid --shard=${shard}; expected N/M, for example 1/4.`);
  const index = Number(match[1]);
  const total = Number(match[2]);
  if (!Number.isInteger(index) || !Number.isInteger(total) || index < 1 || total < 1 || index > total) {
    throw new Error(`Invalid --shard=${shard}; expected 1 <= N <= M.`);
  }
  return flows.filter((_, flowIndex) => flowIndex % total === index - 1);
}

function flowCaseIds(flow) {
  return String(flow.linked_case_ids || '')
    .split(/[;,]\s*/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function npmScriptsIn(script) {
  return [...String(script || '').matchAll(/npm\s+run\s+([A-Za-z0-9:_-]+)/g)].map((match) => match[1]);
}

function envNamesIn(value) {
  return [...String(value || '').matchAll(/\b[A-Z][A-Z0-9_]{2,}\b/g)]
    .map((match) => match[0])
    .filter((name) => !['OS', 'URL', 'API', 'CLI', 'HTTP', 'WS', 'SDK', 'UI', 'QA'].includes(name));
}

function envRequirementGroups(value) {
  return String(value || '')
    .split(/[;\n]+/)
    .map((part) => envNamesIn(part))
    .filter((group) => group.length);
}

function safeName(value) {
  return String(value || 'flow').replace(/[^A-Za-z0-9_.-]+/g, '_').slice(0, 120);
}

function scriptFileName(flowOs) {
  return flowOs === 'Windows' ? 'run.ps1' : 'run.sh';
}

function withAssertionPlan(base, status, reason) {
  return {
    ...base,
    status,
    reason,
    assertion_status: status,
    assertion_checks: [
      {
        name: 'case-assertions-recorded',
        status,
        detail: base.case_assertions ? 'Case assertions are recorded in this result.' : 'No case assertions were provided by the flow.',
      },
      {
        name: 'blackbox-assertions-recorded',
        status,
        detail: base.blackbox_assertions ? 'Black-box assertions are recorded in this result.' : 'No black-box assertions were provided by the flow.',
      },
    ],
  };
}

function evaluateAssertions({ flow, repoRoot, outDir, base, child, timedOut, commandPassed, strictAssertions }) {
  const checks = [];
  checks.push({
    name: 'command-exit-zero',
    status: commandPassed ? 'pass' : 'failed',
    detail: commandPassed ? 'Command exited with status 0.' : `Command exited ${child.status ?? 'unknown'}.`,
  });
  checks.push({
    name: 'no-timeout',
    status: timedOut ? 'failed' : 'pass',
    detail: timedOut ? 'Command timed out before assertions could complete.' : 'Command did not time out.',
  });
  checks.push({
    name: 'case-assertions-recorded',
    status: base.case_assertions ? 'pass' : 'warning',
    detail: base.case_assertions ? 'Case assertions are carried into the execution report.' : 'No case assertions were provided by the flow.',
  });
  checks.push({
    name: 'blackbox-assertions-recorded',
    status: base.blackbox_assertions ? 'pass' : 'warning',
    detail: base.blackbox_assertions ? 'Black-box assertions are carried into the execution report.' : 'No black-box assertions were provided by the flow.',
  });

  const secretFindings = secretFindingsIn(`${child.stdout || ''}\n${child.stderr || ''}`);
  checks.push({
    name: 'secret-scan-stdout-stderr',
    status: secretFindings.length ? 'failed' : 'pass',
    detail: secretFindings.length ? `Secret-like output detected: ${secretFindings.join(', ')}` : 'No secret-like token pattern found in stdout/stderr.',
  });

  checks.push(...evidenceChecks({
    evidencePaths: flow.evidence_paths,
    repoRoot,
    outDir,
    commands: flow.codex_prompt_or_command,
    strictAssertions,
  }));

  const hasFailed = checks.some((check) => check.status === 'failed');
  const hasWarning = checks.some((check) => check.status === 'warning');
  return {
    assertion_status: hasFailed ? 'failed' : hasWarning ? 'pass-with-warnings' : 'pass',
    failed_reason: hasFailed ? failedAssertionReason(checks) : '',
    assertion_checks: checks,
  };
}

function failedAssertionReason(checks) {
  const failed = checks.find((check) => check.status === 'failed');
  return failed ? `Assertion failed: ${failed.name} - ${failed.detail}` : '';
}

const SECRET_PATTERNS = [
  ['openai-or-generic-sk', /sk-[A-Za-z0-9_-]{20,}/],
  ['github-token', /ghp_[A-Za-z0-9]{20,}/],
  ['gitlab-token', /glpat-[A-Za-z0-9_-]{20,}/],
  ['slack-token', /xox[baprs]-[A-Za-z0-9-]{20,}/],
  ['private-key', /-----BEGIN (?:RSA |OPENSSH |EC )?PRIVATE KEY-----/],
];

function secretFindingsIn(value) {
  return SECRET_PATTERNS
    .filter(([, pattern]) => pattern.test(String(value || '')))
    .map(([name]) => name);
}

function evidenceChecks({ evidencePaths, repoRoot, outDir, commands, strictAssertions }) {
  const patterns = String(evidencePaths || '')
    .split(/[;,\n]+/)
    .map((item) => item.trim())
    .filter(Boolean);
  if (!patterns.length) {
    return [{
      name: 'evidence-paths-declared',
      status: 'warning',
      detail: 'No evidence paths declared by the flow.',
    }];
  }

  const artifactProducing = /e2e|playwright|uiux:audit|runtime-features:test|release:verify|e2e:release/i.test(String(commands || ''));
  return patterns.map((pattern) => {
    const matches = findEvidenceMatches(pattern, repoRoot, outDir);
    if (matches.length) {
      return {
        name: `evidence:${pattern}`,
        status: 'pass',
        detail: `Matched ${matches.length} path(s); sample=${matches.slice(0, 3).join(', ')}`,
      };
    }
    if (!artifactProducing) {
      return {
        name: `evidence:${pattern}`,
        status: 'warning',
        detail: 'No matching evidence found; this command set is not expected to produce Playwright/runtime artifacts.',
      };
    }
    return {
      name: `evidence:${pattern}`,
      status: strictAssertions ? 'failed' : 'warning',
      detail: strictAssertions
        ? 'No matching evidence found for an artifact-producing flow.'
        : 'No matching evidence found for an artifact-producing flow; rerun with --strict-assertions to fail on missing evidence.',
    };
  });
}

function findEvidenceMatches(pattern, repoRoot, outDir) {
  const roots = [
    path.join(repoRoot, 'test-results'),
    path.join(repoRoot, 'playwright-report'),
    outDir,
  ];
  const matches = [];
  for (const root of roots) {
    if (!fs.existsSync(root)) continue;
    collectEvidenceMatches(root, pattern, matches);
    if (matches.length >= 20) break;
  }
  return [...new Set(matches)].slice(0, 20);
}

function collectEvidenceMatches(root, pattern, matches, depth = 0) {
  if (matches.length >= 20 || depth > 8) return;
  const stat = fs.statSync(root);
  if (stat.isFile()) {
    if (evidencePatternMatches(pattern, root)) matches.push(root);
    return;
  }
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const full = path.join(root, entry.name);
    if (entry.isDirectory()) collectEvidenceMatches(full, pattern, matches, depth + 1);
    else if (entry.isFile() && evidencePatternMatches(pattern, full)) matches.push(full);
    if (matches.length >= 20) return;
  }
}

function evidencePatternMatches(pattern, filePath) {
  const normalized = filePath.replaceAll('\\', '/');
  const text = String(pattern || '').replaceAll('\\', '/');
  if (text.endsWith('/**')) {
    return normalized.includes(text.slice(0, -3));
  }
  if (text === '**/*.png') return normalized.endsWith('.png');
  if (text === 'test-results/**/*.json') return normalized.includes('/test-results/') && normalized.endsWith('.json');
  if (text === '**/redaction-report.json') return normalized.endsWith('/redaction-report.json');
  if (text.includes('**/')) return normalized.endsWith(text.split('**/').pop());
  if (text.includes('*')) {
    const regex = new RegExp(`/${text.split('*').map(escapeRegex).join('[^/]*')}$`);
    return regex.test(normalized);
  }
  return normalized.endsWith(`/${text}`) || normalized.includes(`/${text}/`);
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
