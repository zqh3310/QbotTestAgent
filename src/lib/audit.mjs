const SECRET_PATTERNS = [
  /sk-[A-Za-z0-9_-]{20,}/,
  /ghp_[A-Za-z0-9]{20,}/,
  /glpat-[A-Za-z0-9_-]{20,}/,
  /xox[baprs]-[A-Za-z0-9-]{20,}/,
  /-----BEGIN (?:RSA |OPENSSH |EC )?PRIVATE KEY-----/,
];

export function auditOutputs({ issueMatrix, issueIntelligence = null, testCases, automationFlows, sourceErrors = [], tableFiles = {} }) {
  const critical = [];
  const warnings = [];
  for (const error of sourceErrors) critical.push(`Issue source read error in ${error.file}: ${error.error}`);
  if (!issueMatrix.length) critical.push('No issues were loaded; generated plan would be ungrounded.');
  if (!issueIntelligence) critical.push('No issue intelligence report was generated; test scope cannot be trusted.');
  if (!testCases.length) critical.push('No functional test cases were generated.');
  if (!automationFlows.length) warnings.push('No Codex executable flows were generated.');
  if (!tableFiles.workbook_xlsx) critical.push('Excel workbook was not generated; internal XLSX writer did not return an output path.');
  if (!tableFiles.issue_scope_csv) critical.push('Product issue scope CSV was not generated.');

  addDuplicateFindings(critical, 'issue iid', issueMatrix.map((row) => row.iid));
  addDuplicateFindings(critical, 'test case_id', testCases.map((row) => row.case_id));
  addDuplicateFindings(critical, 'automation flow_id', automationFlows.map((row) => row.flow_id));

  const caseIds = new Set(testCases.map((row) => row.case_id));
  const selectedIssueIds = new Set((issueIntelligence?.selected_issues || [])
    .filter((issue) => issue.handoff_to_test_design === 'yes')
    .map((issue) => String(issue.iid)));
  const excludedIssueIds = new Set((issueIntelligence?.excluded_issues || []).map((issue) => String(issue.iid)));

  for (const row of testCases) {
    if (!row.source_refs) critical.push(`${row.case_id} has no source_refs.`);
    if (!row.expected_result) critical.push(`${row.case_id} has no expected_result.`);
    if (!row.regression_layer) critical.push(`${row.case_id} has no regression_layer.`);
    if (!row.user_persona) critical.push(`${row.case_id} has no user_persona.`);
    if (!row.execution_scope) critical.push(`${row.case_id} has no execution_scope.`);
    if (!row.blackbox_gate) critical.push(`${row.case_id} has no blackbox_gate.`);
    if (!row.acceptance_source) critical.push(`${row.case_id} has no acceptance_source.`);
    if (!row.evidence_required) warnings.push(`${row.case_id} has no evidence_required.`);
    if (String(row.automation_candidate).toLowerCase().trim() === 'yes' && row.blocked_by) {
      warnings.push(`${row.case_id} is automatable but has blocker: ${row.blocked_by}`);
    }
    if (row.maintenance_action !== 'baseline') {
      for (const issueId of issueRefs(row.source_refs)) {
        if (excludedIssueIds.has(issueId)) critical.push(`${row.case_id} was generated from excluded development/process issue #${issueId}.`);
        if (selectedIssueIds.size && !selectedIssueIds.has(issueId)) warnings.push(`${row.case_id} references issue #${issueId}, which is not in issue-intelligence test-design scope.`);
      }
    }
    const caseText = `${row.steps}\n${row.expected_result}`;
    const asksOrdinaryUserForTechnicalChoice = /(?:choose|select|configure|edit|set)\s+(?:a\s+)?(?:model|provider|runtime|baseurl|env key|mcp command)/i.test(caseText)
      && !/(without|must not|not need|does not need|not asked|not require|is not asked|不需要|不得|不能)/i.test(caseText);
    if (String(row.user_persona || '').startsWith('QBot ordinary') && asksOrdinaryUserForTechnicalChoice) {
      critical.push(`${row.case_id} ordinary-user case appears to require model/provider/runtime configuration.`);
    }
  }

  for (const flow of automationFlows) {
    if (!flow.automation_level) critical.push(`${flow.flow_id} has no automation_level.`);
    if (!flow.execution_scope) critical.push(`${flow.flow_id} has no execution_scope.`);
    if (!flow.assertions) critical.push(`${flow.flow_id} has no assertions.`);
    if (!flow.blackbox_assertions) critical.push(`${flow.flow_id} has no blackbox_assertions.`);
    if (!flow.evidence_paths) critical.push(`${flow.flow_id} has no evidence_paths.`);
    if (!flow.skip_or_block_rules) critical.push(`${flow.flow_id} has no skip_or_block_rules.`);
    if (!flow.cleanup) warnings.push(`${flow.flow_id} has no cleanup guidance.`);
    if (/=\s*[^;\n]+/.test(String(flow.required_env || ''))) critical.push(`${flow.flow_id} required_env appears to include env values; names only are allowed.`);
    if (/rm -rf|Remove-Item\s+-Recurse\s+-Force/i.test(String(flow.cleanup || ''))) critical.push(`${flow.flow_id} cleanup contains destructive delete pattern.`);
    for (const id of String(flow.linked_case_ids || '').split(/[;,]\s*/).filter(Boolean)) {
      if (!caseIds.has(id)) critical.push(`${flow.flow_id} links unknown case_id ${id}.`);
    }
  }

  const serialized = JSON.stringify({ issueMatrix, testCases, automationFlows });
  for (const pattern of SECRET_PATTERNS) {
    if (pattern.test(serialized)) critical.push(`Generated output appears to contain secret-like material matching ${pattern}.`);
  }

  return {
    status: critical.length ? 'blocked' : warnings.length ? 'pass-with-warnings' : 'pass',
    critical,
    warnings,
  };
}

function issueRefs(value) {
  return [...String(value || '').matchAll(/issue:#(\d+)|#(\d+)/g)]
    .map((match) => match[1] || match[2])
    .filter(Boolean);
}

function addDuplicateFindings(critical, label, values) {
  const seen = new Set();
  const duplicates = new Set();
  for (const value of values) {
    const key = String(value || '');
    if (!key) {
      critical.push(`Empty ${label} detected.`);
      continue;
    }
    if (seen.has(key)) duplicates.add(key);
    seen.add(key);
  }
  for (const duplicate of duplicates) critical.push(`Duplicate ${label}: ${duplicate}`);
}
