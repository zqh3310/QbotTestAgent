import path from 'node:path';
import { writeJsonFile, writeTextFile } from './fs.mjs';

export function writeReports({ outDir, repoRoot, monitorReport, issueMatrix, issueIntelligence, testCases, automationFlows, audit }) {
  const files = {};
  files.monitor_json = path.join(outDir, 'monitor-report.json');
  files.monitor_md = path.join(outDir, 'monitor-report.md');
  files.issue_intelligence_json = path.join(outDir, 'issue-intelligence-report.json');
  files.issue_intelligence_md = path.join(outDir, 'issue-intelligence-report.md');
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
  writeJsonFile(files.issue_intelligence_json, issueIntelligence);
  writeTextFile(files.issue_intelligence_md, renderIssueIntelligence(issueIntelligence));
  writeJsonFile(files.issue_matrix_json, issueMatrix);
  writeTextFile(files.issue_matrix_md, renderIssueMatrix(issueMatrix));
  writeJsonFile(files.test_cases_json, testCases);
  writeJsonFile(files.automation_flows_json, automationFlows);
  writeTextFile(files.automation_flows_md, renderAutomation(automationFlows));
  writeJsonFile(files.audit_json, audit);
  writeTextFile(files.audit_md, renderAudit(audit));
  writeTextFile(files.summary_md, renderSummary({ repoRoot, monitorReport, issueMatrix, issueIntelligence, testCases, automationFlows, audit }));
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
    `- Material deltas: ${report.delta_summary?.material_count ?? 'unknown'}`,
    '',
    '## Blockers',
    ...(report.blockers?.length ? report.blockers.map((item) => `- ${item}`) : ['- None']),
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
    '## Workflow Plan',
    ...(report.workflow_plan?.length ? report.workflow_plan.map((step) => `- ${step.step}. ${step.agent}: ${step.action}`) : ['- None']),
    '',
  ].join('\n');
}

function listIssues(issues, includeFields = false) {
  if (!issues?.length) return ['- None'];
  return issues.map((issue) => `- #${issue.iid} ${issue.title}${includeFields ? ` (${(issue.changed_fields || []).join(', ')})` : ''}`);
}

export function renderIssueIntelligence(report) {
  const selected = report?.selected_issues || [];
  const excluded = report?.excluded_issues || [];
  const lines = [
    '# Issue Intelligence Report',
    '',
    `- Agent: ${report?.agent || 'issue-intelligence-analyst'}`,
    `- Generated at: ${report?.generated_at || ''}`,
    `- Total issues: ${report?.total_issues ?? 0}`,
    `- Selected product/function issues: ${report?.selected_product_issue_count ?? 0}`,
    `- Test-design issues: ${report?.test_design_issue_count ?? 0}`,
    `- Excluded development/process issues: ${report?.excluded_issue_count ?? 0}`,
    '',
    '## Selection Policy',
    ...((report?.selection_policy || []).map((item) => `- ${item}`)),
    '',
    '## Selected Product / Function Issues',
  ];
  if (!selected.length) {
    lines.push('- None');
  } else {
    for (const issue of selected) {
      lines.push(`### #${issue.iid} ${issue.title}`);
      lines.push('');
      lines.push(`- Category: ${issue.scope_category}`);
      lines.push(`- Confidence: ${issue.scope_confidence}`);
      lines.push(`- Decision reason: ${issue.scope_reason}`);
      lines.push(`- State: ${issue.state}`);
      lines.push(`- Handoff to test design: ${issue.handoff_to_test_design}`);
      lines.push(`- Modules: ${issue.modules}`);
      lines.push(`- Acceptance source: ${issue.acceptance_source}`);
      if (issue.explicit_constraints) lines.push(`- Constraints: ${issue.explicit_constraints.replace(/\n/g, ' / ')}`);
      lines.push('');
      lines.push('~~~text');
      lines.push(issue.full_description || '(empty body)');
      lines.push('~~~');
      lines.push('');
    }
  }
  lines.push('## Excluded Issues');
  if (!excluded.length) {
    lines.push('- None');
  } else {
    for (const issue of excluded) {
      lines.push(`- #${issue.iid} ${issue.title} — ${issue.scope_category} / ${issue.scope_confidence}: ${issue.scope_reason || issue.exclusion_reason}`);
    }
  }
  lines.push('');
  return lines.join('\n');
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

function renderSummary({ repoRoot, monitorReport, issueMatrix, issueIntelligence, testCases, automationFlows, audit }) {
  return [
    '# QBot Test Agent Run Summary',
    '',
    `- Repository: ${repoRoot}`,
    `- Issues analyzed: ${issueMatrix.length}`,
    `- Product/function issues selected: ${issueIntelligence?.selected_product_issue_count ?? 0}`,
    `- Development/process issues excluded: ${issueIntelligence?.excluded_issue_count ?? 0}`,
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
