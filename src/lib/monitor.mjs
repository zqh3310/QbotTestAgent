import path from 'node:path';
import { classifyIssue } from './classifier.mjs';
import { exists, readJsonFile, writeJsonFile } from './fs.mjs';

export function buildSnapshot(issues) {
  const entries = {};
  for (const issue of issues) {
    const classification = classifyIssue(issue);
    entries[String(issue.iid)] = {
      iid: issue.iid,
      title: issue.title,
      state: issue.state,
      labels: issue.labels,
      updated_at: issue.updated_at,
      content_hash: issue.content_hash,
      modules: classification.module_ids,
      material: classification.material,
    };
  }
  return {
    generated_at: new Date().toISOString(),
    issue_count: issues.length,
    entries,
  };
}

export function diffSnapshots(previous, current) {
  const previousEntries = previous?.entries || {};
  const currentEntries = current.entries || {};
  const new_issues = [];
  const changed_issues = [];
  const closed_or_reopened_issues = [];
  const removed_issues = [];

  for (const [iid, currentIssue] of Object.entries(currentEntries)) {
    const before = previousEntries[iid];
    if (!before) {
      new_issues.push({ ...currentIssue, change: 'new' });
      continue;
    }
    const changedFields = [];
    if (before.title !== currentIssue.title) changedFields.push('title');
    if (before.state !== currentIssue.state) {
      changedFields.push('state');
      closed_or_reopened_issues.push({ ...currentIssue, previous_state: before.state, change: 'state' });
    }
    if ((before.labels || []).join('|') !== (currentIssue.labels || []).join('|')) changedFields.push('labels');
    if (before.content_hash !== currentIssue.content_hash) changedFields.push('description_or_acceptance');
    if (changedFields.length > 0) changed_issues.push({ ...currentIssue, changed_fields: changedFields });
  }

  for (const [iid, previousIssue] of Object.entries(previousEntries)) {
    if (!currentEntries[iid]) removed_issues.push({ ...previousIssue, change: 'removed_from_snapshot' });
  }

  return { new_issues, changed_issues, closed_or_reopened_issues, removed_issues };
}

export function buildMonitorReport({ issues, stateFile, saveState = true, sourceMode = 'local-export' }) {
  const current = buildSnapshot(issues);
  const previous = exists(stateFile) ? readJsonFile(stateFile) : null;
  const delta = diffSnapshots(previous, current);
  const allMaterial = [...delta.new_issues, ...delta.changed_issues, ...delta.closed_or_reopened_issues]
    .filter((issue) => issue.material);
  const moduleImpact = {};
  for (const issue of allMaterial) {
    for (const module of issue.modules || ['unknown']) {
      moduleImpact[module] ||= [];
      moduleImpact[module].push(`#${issue.iid}`);
    }
  }
  const firstRun = !previous;
  const required = firstRun || allMaterial.length > 0;
  const recommended = new Set(['issue-intelligence-analyst']);
  for (const module of Object.keys(moduleImpact)) {
    if (['runtime', 'skills_mcp'].includes(module)) recommended.add('runtime-protocol-skill-chain-tester');
    if (['uiux', 'assistant'].includes(module)) recommended.add('ui-product-experience-tester');
    if (['e2e_release'].includes(module)) recommended.add('cross-platform-e2e-validator');
    if (['compliance'].includes(module)) recommended.add('compliance-security-tester');
    if (['projects', 'automation'].includes(module)) recommended.add('functional-test-case-designer');
  }

  const report = {
    agent: 'gitlab-issue-monitor',
    source_mode: sourceMode,
    source_timestamp: current.generated_at,
    state_file: path.resolve(stateFile),
    baseline_initialized: firstRun,
    new_issues: delta.new_issues,
    changed_issues: delta.changed_issues,
    closed_or_reopened_issues: delta.closed_or_reopened_issues,
    removed_issues: delta.removed_issues,
    module_impact: moduleImpact,
    test_plan_decision: {
      required,
      reason: firstRun
        ? 'No previous monitor snapshot existed; bootstrap test planning should run once.'
        : allMaterial.length > 0
          ? `${allMaterial.length} material issue delta(s) affect test scope.`
          : 'No material issue delta detected.',
      recommended_agents: [...recommended],
    },
    blockers: [],
  };

  if (saveState) writeJsonFile(stateFile, current);
  return { report, snapshot: current, previous };
}

