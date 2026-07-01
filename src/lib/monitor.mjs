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
      module_names: classification.module_names,
      owner_agents: classification.owner_agents,
      kind: classification.kind,
      status: classification.status,
      priority: classification.priority,
      test_types: classification.test_types,
      blocked_by: classification.blocked_by,
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
  const recommended = new Set(required
    ? ['issue-intelligence-analyst', 'test-plan-maintainer']
    : ['gitlab-issue-monitor']);
  for (const module of Object.keys(moduleImpact)) {
    if (['runtime', 'skills_mcp'].includes(module)) recommended.add('runtime-protocol-skill-chain-tester');
    if (['uiux', 'assistant'].includes(module)) recommended.add('ui-product-experience-tester');
    if (['e2e_release'].includes(module)) recommended.add('cross-platform-e2e-validator');
    if (['compliance'].includes(module)) recommended.add('compliance-security-tester');
    if (['projects', 'automation', 'assistant', 'uiux', 'runtime', 'skills_mcp', 'compliance', 'e2e_release'].includes(module)) {
      recommended.add('functional-test-case-designer');
      recommended.add('codex-os-automation-planner');
    }
  }
  if (allMaterial.some((issue) => issue.blocked_by || ['external-dependency', 'bug'].includes(issue.kind))) {
    recommended.add('test-data-fixture-planner');
    recommended.add('defect-triage-issue-reporter');
  }
  if (required) {
    recommended.add('test-case-reviewer');
    recommended.add('evidence-quality-auditor');
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
    delta_summary: {
      material_count: allMaterial.length,
      new_count: delta.new_issues.length,
      changed_count: delta.changed_issues.length,
      state_change_count: delta.closed_or_reopened_issues.length,
      removed_count: delta.removed_issues.length,
    },
    test_plan_decision: {
      required,
      reason: firstRun
        ? 'No previous monitor snapshot existed; bootstrap test planning should run once.'
        : allMaterial.length > 0
          ? `${allMaterial.length} material issue delta(s) affect test scope.`
          : 'No material issue delta detected.',
      recommended_agents: [...recommended],
    },
    workflow_plan: buildWorkflowPlan({ required, firstRun, allMaterial, moduleImpact }),
    blockers: [],
  };

  if (saveState) writeJsonFile(stateFile, current);
  return { report, snapshot: current, previous };
}

function buildWorkflowPlan({ required, firstRun, allMaterial, moduleImpact }) {
  if (!required) {
    return [
      {
        step: 1,
        agent: 'gitlab-issue-monitor',
        action: 'Keep monitoring. No material issue delta requires test-plan maintenance.',
      },
    ];
  }
  const plan = [
    {
      step: 1,
      agent: 'issue-intelligence-analyst',
      action: firstRun
        ? 'Bootstrap issue/module/risk matrix from the current issue source.'
        : 'Normalize material issue deltas and identify changed requirements, risks, and acceptance criteria.',
    },
    {
      step: 2,
      agent: 'test-plan-maintainer',
      action: 'Apply an incremental update plan: add new cases, edit impacted cases, deprecate stale cases, preserve stable IDs, and update S0/S1/S2/S3 plus A0/A1/A2/A3 layers.',
    },
    {
      step: 3,
      agent: 'functional-test-case-designer',
      action: 'Draft or revise tester-readable functional cases for changed product behavior.',
    },
    {
      step: 4,
      agent: 'codex-os-automation-planner',
      action: 'Draft or revise Codex-executable UI/OS flows with setup, assertions, evidence paths, cleanup, and skip/block rules.',
    },
  ];
  const specialists = new Set();
  for (const module of Object.keys(moduleImpact)) {
    if (['runtime', 'skills_mcp'].includes(module)) specialists.add('runtime-protocol-skill-chain-tester');
    if (['uiux', 'assistant'].includes(module)) specialists.add('ui-product-experience-tester');
    if (module === 'e2e_release') specialists.add('cross-platform-e2e-validator');
    if (module === 'compliance') specialists.add('compliance-security-tester');
  }
  if (allMaterial.some((issue) => issue.blocked_by)) specialists.add('test-data-fixture-planner');
  if (allMaterial.some((issue) => ['bug', 'external-dependency'].includes(issue.kind))) specialists.add('defect-triage-issue-reporter');
  for (const specialist of specialists) {
    plan.push({
      step: plan.length + 1,
      agent: specialist,
      action: 'Fill specialist coverage, blockers, or issue handoff needs for impacted deltas.',
    });
  }
  plan.push({
    step: plan.length + 1,
    agent: 'test-case-reviewer',
    action: 'Reject vague, unexecutable, over-broad, under-specified, or misprioritized case changes before delivery.',
  });
  plan.push({
    step: plan.length + 1,
    agent: 'evidence-quality-auditor',
    action: 'Audit traceability, freshness, redaction, skipped/blocked semantics, and false-success risk.',
  });
  return plan;
}
