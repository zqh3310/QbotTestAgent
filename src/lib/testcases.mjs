import { classifyIssue } from './classifier.mjs';
import { summarizeDescription } from './issues.mjs';

export const TEST_CASE_COLUMNS = [
  'case_id',
  'module',
  'submodule',
  'source_refs',
  'priority',
  'test_type',
  'platform',
  'preconditions',
  'steps',
  'expected_result',
  'negative_or_edge',
  'automation_candidate',
  'evidence_required',
  'blocked_by',
  'owner_agent',
];

const CORE_CASES = [
  {
    case_id: 'QBOT-FUNC-ASSISTANT-001',
    module: 'Assistant',
    submodule: 'Conversation streaming and completion',
    source_refs: 'meeting: QBot core flow; repo:test/README.md',
    priority: 'P0',
    test_type: 'functional; UI; e2e',
    platform: 'both',
    preconditions: 'Deepbank server and Electron UI are available; mock provider is acceptable for transport proof.',
    steps: 'Open QBot assistant, submit a normal Chinese work request, observe streaming content, status changes, final done state, and persisted transcript.',
    expected_result: 'The turn streams visibly, reaches a terminal done state, remains resumable, and does not expose runtime internals.',
    negative_or_edge: 'No',
    automation_candidate: 'Partial',
    evidence_required: 'UI screenshot; WS event log; transcript snapshot',
    blocked_by: '',
    owner_agent: 'ui-product-experience-tester',
  },
  {
    case_id: 'QBOT-FUNC-RUNTIME-001',
    module: 'Runtime / Protocol',
    submodule: 'Codex product-path execution',
    source_refs: 'meeting: Codex CLI framework + GLM5.2 protocol conversion; repo:test/runtime-features/README.md',
    priority: 'P0',
    test_type: 'runtime; integration; e2e',
    platform: 'both',
    preconditions: 'Codex runtime path configured; provider/model env available or skip reason recorded.',
    steps: 'Select or configure Codex runtime path, run a representative QBot turn, inspect raw SDK, Deepbank WS, transcript, and redaction artifacts.',
    expected_result: 'Codex turn completes through the product path with mapped events, sanitized artifacts, and no false claim for SDK-only features.',
    negative_or_edge: 'No',
    automation_candidate: 'Partial',
    evidence_required: 'raw-sdk.jsonl; deepbank-ws.jsonl; transcript.snapshot.jsonl; redaction-report.json',
    blocked_by: 'Requires configured Codex/provider path for real evidence.',
    owner_agent: 'runtime-protocol-skill-chain-tester',
  },
  {
    case_id: 'QBOT-FUNC-SKILLS-001',
    module: 'Skills / MCP / Experts',
    submodule: 'Skill invocation and multi-skill chaining',
    source_refs: 'meeting: long tasks, skill calls, multi-skill chaining',
    priority: 'P1',
    test_type: 'functional; runtime; integration',
    platform: 'both',
    preconditions: 'At least two safe local skills are installed or fixture skills are available.',
    steps: 'Ask QBot to solve a task requiring two distinct skills, verify skill discovery, invocation order, tool results, and final synthesis.',
    expected_result: 'QBot invokes required skills without leaking internals, handles unavailable skills explicitly, and produces a coherent final result.',
    negative_or_edge: 'Includes missing-skill variant.',
    automation_candidate: 'Partial',
    evidence_required: 'WS tool events; transcript; installed skill list; final answer',
    blocked_by: '',
    owner_agent: 'runtime-protocol-skill-chain-tester',
  },
  {
    case_id: 'QBOT-FUNC-PROJECTS-001',
    module: 'Projects / GitLab',
    submodule: 'Repo-backed project workspace',
    source_refs: 'issues:#92,#100,#118; repo:docs/product-overview.md',
    priority: 'P0',
    test_type: 'functional; integration; e2e',
    platform: 'both',
    preconditions: 'GitLab-backed project fixture or mocked adapter is available.',
    steps: 'Create/open a QBot project, inspect plan/activity/members/files/runtime status, and verify GitLab implementation details are not exposed as primary product copy.',
    expected_result: 'Project behaves as a QBot workspace with redacted GitLab evidence and explicit auth/stale/conflict states.',
    negative_or_edge: 'Includes auth missing and protected branch variants.',
    automation_candidate: 'Partial',
    evidence_required: 'UI screenshots; API payload snapshots; redaction report',
    blocked_by: 'Live private GitLab acceptance depends on Lingxi OAuth2 to GitLab token exchange.',
    owner_agent: 'functional-test-case-designer',
  },
  {
    case_id: 'QBOT-SEC-COMPLIANCE-001',
    module: 'Compliance / Security',
    submodule: 'M1-M4 tier and secret redaction',
    source_refs: 'issue:#120; repo:docs/design-decisions.md',
    priority: 'P0',
    test_type: 'security; compliance; functional',
    platform: 'both',
    preconditions: 'Compliance tier UI/config exists or case is marked design-blocked.',
    steps: 'Verify users choose compliance tier rather than raw runtime/model; attempt M4 upgrade with company non-public data context; inspect UI/API/log artifacts.',
    expected_result: 'Compliance tier boundaries are enforced, M4 does not carry prohibited history, and no secrets appear in UI/API/logs.',
    negative_or_edge: 'M4 prohibited-data negative case.',
    automation_candidate: 'Partial',
    evidence_required: 'UI screenshot; API payload; redaction scan; blocked-state message',
    blocked_by: 'Future-state design until compliance tier implementation lands.',
    owner_agent: 'compliance-security-tester',
  },
];

export function generateTestCases(issues) {
  const rows = [...CORE_CASES];
  for (const issue of issues) {
    const classification = classifyIssue(issue);
    const moduleName = classification.module_names[0] || 'General';
    const moduleId = classification.module_ids[0] || 'general';
    const prefix = classification.kind === 'bug' ? 'QBOT-NEG' : classification.kind === 'external-dependency' ? 'QBOT-COMP' : 'QBOT-FUNC';
    const source = `issue:#${issue.iid}`;
    const summary = summarizeDescription(issue);
    rows.push({
      case_id: issueCaseId(prefix, moduleId, issue.iid, 'MAIN'),
      module: moduleName,
      submodule: issue.title,
      source_refs: source,
      priority: classification.priority,
      test_type: classification.test_types.join('; '),
      platform: classification.module_ids.includes('e2e_release') ? 'Windows; macOS' : 'both',
      preconditions: classification.blocked_by || 'Repository-local fixtures or mocked service path are available.',
      steps: [
        `Review issue #${issue.iid} acceptance scope.`,
        `Execute the smallest product path covering: ${issue.title}.`,
        'Capture UI/API/runtime evidence required by the issue validation checklist.',
        'Verify blocked, skipped, and degraded states are explicit when prerequisites are missing.',
      ].join('\n'),
      expected_result: summary || `Behavior required by issue #${issue.iid} is satisfied without leaking internal or secret data.`,
      negative_or_edge: classification.kind === 'bug' || issue.description.includes('Negative') ? 'Yes' : 'No',
      automation_candidate: classification.kind === 'external-dependency'
        ? 'No'
        : classification.blocked_by
          ? 'Partial'
          : 'Yes',
      evidence_required: evidenceFor(classification),
      blocked_by: classification.blocked_by,
      owner_agent: classification.owner_agents.join('; '),
    });
    if (classification.kind === 'bug' || issue.description.includes('Negative Cases') || classification.blocked_by) {
      rows.push({
        case_id: issueCaseId('QBOT-NEG', moduleId, issue.iid, 'NEG'),
        module: moduleName,
        submodule: `Negative/blocked path for #${issue.iid}`,
        source_refs: source,
        priority: classification.priority,
        test_type: [...new Set([...classification.test_types, 'negative'])].join('; '),
        platform: classification.module_ids.includes('e2e_release') ? 'Windows; macOS' : 'both',
        preconditions: classification.blocked_by || 'Negative fixture is available.',
        steps: [
          `Force or simulate the negative condition described by issue #${issue.iid}.`,
          'Run the same user-visible product path.',
          'Verify the product fails closed with a clear message and records no false success.',
        ].join('\n'),
        expected_result: 'The product reports blocked/failed/degraded state truthfully and produces no fabricated success evidence.',
        negative_or_edge: 'Yes',
        automation_candidate: classification.kind === 'external-dependency'
          ? 'No'
          : classification.blocked_by
            ? 'Partial'
            : 'Yes',
        evidence_required: 'Failure screenshot; sanitized error payload; issue-specific artifact',
        blocked_by: classification.blocked_by,
        owner_agent: classification.owner_agents.join('; '),
      });
    }
  }
  return rows;
}

function issueCaseId(prefix, moduleId, iid, suffix) {
  const modulePart = moduleId.toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-|-$/g, '') || 'GENERAL';
  return `${prefix}-${modulePart}-ISSUE-${String(iid).padStart(3, '0')}-${suffix}`;
}

function evidenceFor(classification) {
  const evidence = new Set(['test log']);
  if (classification.module_ids.includes('uiux') || classification.module_ids.includes('assistant')) evidence.add('UI screenshot');
  if (classification.module_ids.includes('runtime') || classification.module_ids.includes('skills_mcp')) {
    evidence.add('raw SDK/WS artifact');
    evidence.add('transcript snapshot');
  }
  if (classification.module_ids.includes('projects') || classification.module_ids.includes('automation')) evidence.add('API payload');
  if (classification.module_ids.includes('compliance')) evidence.add('redaction report');
  if (classification.module_ids.includes('e2e_release')) evidence.add('e2e artifact directory');
  return [...evidence].join('; ');
}
