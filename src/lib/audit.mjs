const SECRET_PATTERNS = [
  /sk-[A-Za-z0-9_-]{20,}/,
  /ghp_[A-Za-z0-9]{20,}/,
  /glpat-[A-Za-z0-9_-]{20,}/,
  /xox[baprs]-[A-Za-z0-9-]{20,}/,
  /-----BEGIN (?:RSA |OPENSSH |EC )?PRIVATE KEY-----/,
];

export function auditOutputs({ issueMatrix, testCases, automationFlows, sourceErrors = [], tableFiles = {} }) {
  const critical = [];
  const warnings = [];
  for (const error of sourceErrors) critical.push(`Issue source read error in ${error.file}: ${error.error}`);
  if (!issueMatrix.length) critical.push('No issues were loaded; generated plan would be ungrounded.');
  if (!testCases.length) critical.push('No functional test cases were generated.');
  if (!automationFlows.length) warnings.push('No Codex executable flows were generated.');
  if (!tableFiles.workbook_xlsx) critical.push('Excel workbook was not generated; internal XLSX writer did not return an output path.');

  addDuplicateFindings(critical, 'issue iid', issueMatrix.map((row) => row.iid));
  addDuplicateFindings(critical, 'test case_id', testCases.map((row) => row.case_id));
  addDuplicateFindings(critical, 'automation flow_id', automationFlows.map((row) => row.flow_id));

  const caseIds = new Set(testCases.map((row) => row.case_id));

  for (const row of testCases) {
    if (!row.source_refs) critical.push(`${row.case_id} has no source_refs.`);
    if (!row.expected_result) critical.push(`${row.case_id} has no expected_result.`);
    if (!row.evidence_required) warnings.push(`${row.case_id} has no evidence_required.`);
    if (String(row.automation_candidate).toLowerCase().trim() === 'yes' && row.blocked_by) {
      warnings.push(`${row.case_id} is automatable but has blocker: ${row.blocked_by}`);
    }
  }

  for (const flow of automationFlows) {
    if (!flow.assertions) critical.push(`${flow.flow_id} has no assertions.`);
    if (!flow.skip_or_block_rules) critical.push(`${flow.flow_id} has no skip_or_block_rules.`);
    if (!flow.cleanup) warnings.push(`${flow.flow_id} has no cleanup guidance.`);
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
