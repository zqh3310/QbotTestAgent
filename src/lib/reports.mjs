import path from 'node:path';
import { writeJsonFile, writeTextFile } from './fs.mjs';

export function writeReports({ outDir, repoRoot, monitorReport, issueMatrix, testCases, automationFlows, audit }) {
  const files = {};
  files.monitor_json = path.join(outDir, 'monitor-report.json');
  files.monitor_md = path.join(outDir, 'monitor-report.md');
  files.issue_matrix_json = path.join(outDir, 'issue-matrix.json');
  files.issue_matrix_md = path.join(outDir, 'issue-matrix.md');
  files.test_cases_json = path.join(outDir, 'functional-test-cases.json');
  files.automation_flows_json = path.join(outDir, 'codex-automation-flows.json');
  files.automation_flows_md = path.join(outDir, 'codex-automation-flows.md');
  files.audit_json = path.join(outDir, 'audit-report.json');
  files.audit_md = path.join(outDir, 'audit-report.md');
  files.summary_md = path.join(outDir, 'RUN_SUMMARY.md');

  writeJsonFile(files.monitor_json, monitorReport);
  writeTextFile(files.monitor_md, renderMonitor(monitorReport));
  writeJsonFile(files.issue_matrix_json, issueMatrix);
  writeTextFile(files.issue_matrix_md, renderIssueMatrix(issueMatrix));
  writeJsonFile(files.test_cases_json, testCases);
  writeJsonFile(files.automation_flows_json, automationFlows);
  writeTextFile(files.automation_flows_md, renderAutomation(automationFlows));
  writeJsonFile(files.audit_json, audit);
  writeTextFile(files.audit_md, renderAudit(audit));
  writeTextFile(files.summary_md, renderSummary({ repoRoot, monitorReport, issueMatrix, testCases, automationFlows, audit }));
  return files;
}

export function renderMonitor(report) {
  return [
    '# GitLab Issue Monitor Report',
    '',
    `- Source mode: ${report.source_mode}`,
    `- Timestamp: ${report.source_timestamp}`,
    `- Baseline initialized: ${report.baseline_initialized}`,
    `- Test plan update required: ${report.test_plan_decision.required}`,
    `- Reason: ${report.test_plan_decision.reason}`,
    `- Recommended agents: ${report.test_plan_decision.recommended_agents.join(', ')}`,
    '',
    '## New Issues',
    ...listIssues(report.new_issues),
    '',
    '## Changed Issues',
    ...listIssues(report.changed_issues, true),
    '',
    '## Module Impact',
    ...Object.entries(report.module_impact).map(([module, issues]) => `- ${module}: ${issues.join(', ')}`),
    '',
  ].join('\n');
}

function listIssues(issues, includeFields = false) {
  if (!issues?.length) return ['- None'];
  return issues.map((issue) => `- #${issue.iid} ${issue.title}${includeFields ? ` (${(issue.changed_fields || []).join(', ')})` : ''}`);
}

function renderIssueMatrix(rows) {
  const header = '| Issue | Kind | Status | Priority | Modules | Owner Agents | Blocked By |';
  const divider = '|---|---|---|---|---|---|---|';
  return [
    '# QBot Issue Matrix',
    '',
    header,
    divider,
    ...rows.map((row) => `| #${row.iid} | ${row.kind} | ${row.status} | ${row.priority} | ${cell(row.modules)} | ${cell(row.owner_agents)} | ${cell(row.blocked_by)} |`),
    '',
  ].join('\n');
}

function renderAutomation(flows) {
  const lines = ['# Codex Windows/macOS Executable Flow Plan', ''];
  for (const flow of flows) {
    lines.push(`## ${flow.flow_id}`);
    lines.push('');
    lines.push(`- Linked cases: ${flow.linked_case_ids}`);
    lines.push(`- OS: ${flow.os}`);
    lines.push(`- Mode: ${flow.mode}`);
    lines.push(`- Required tools: ${flow.required_tools}`);
    lines.push('');
    lines.push('### Setup');
    lines.push(flow.setup_steps);
    lines.push('');
    lines.push('### Command / Prompt');
    lines.push('```bash');
    lines.push(flow.codex_prompt_or_command);
    lines.push('```');
    lines.push('');
    lines.push('### Assertions');
    lines.push(flow.assertions);
    lines.push('');
    lines.push(`### Skip / Block Rules\n${flow.skip_or_block_rules}`);
    lines.push('');
  }
  return `${lines.join('\n')}\n`;
}

function renderAudit(audit) {
  return [
    '# Evidence Quality Audit',
    '',
    `- Status: ${audit.status}`,
    `- Critical findings: ${audit.critical.length}`,
    `- Warnings: ${audit.warnings.length}`,
    '',
    '## Critical',
    ...(audit.critical.length ? audit.critical.map((item) => `- ${item}`) : ['- None']),
    '',
    '## Warnings',
    ...(audit.warnings.length ? audit.warnings.map((item) => `- ${item}`) : ['- None']),
    '',
  ].join('\n');
}

function renderSummary({ repoRoot, monitorReport, issueMatrix, testCases, automationFlows, audit }) {
  return [
    '# QBot Test Agent Run Summary',
    '',
    `- Repository: ${repoRoot}`,
    `- Issues analyzed: ${issueMatrix.length}`,
    `- Functional test cases: ${testCases.length}`,
    `- Codex executable flows: ${automationFlows.length}`,
    `- Monitor decision: ${monitorReport.test_plan_decision.required ? 'update required' : 'no update required'}`,
    `- Audit status: ${audit.status}`,
    '',
    '## Next Action',
    monitorReport.test_plan_decision.required
      ? 'Run specialist review on the impacted modules and refresh the Excel/Codex flow package.'
      : 'Keep the current test plan; rerun monitor after GitLab issue changes.',
    '',
  ].join('\n');
}

function cell(value) {
  return String(value || '').replace(/\|/g, '/').replace(/\n/g, '<br>');
}
