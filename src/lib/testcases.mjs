import { classifyIssue } from './classifier.mjs';
import { extractSection, summarizeDescription } from './issues.mjs';

export const TEST_CASE_COLUMNS = [
  'case_id',
  'maintenance_action',
  'module',
  'submodule',
  'source_refs',
  'issue_state',
  'priority',
  'regression_layer',
  'test_type',
  'platform',
  'user_persona',
  'execution_scope',
  'preconditions',
  'steps',
  'expected_result',
  'negative_or_edge',
  'automation_candidate',
  'automation_level_target',
  'validation_commands',
  'evidence_required',
  'blackbox_gate',
  'acceptance_source',
  'blocked_by',
  'owner_agent',
];

const CORE_CASES = [
  {
    case_id: 'QBOT-FUNC-ASSISTANT-001',
    maintenance_action: 'baseline',
    module: 'Assistant',
    submodule: 'Conversation streaming and completion',
    source_refs: 'meeting: QBot core flow; repo:test/README.md',
    issue_state: 'baseline',
    priority: 'P0',
    regression_layer: 'S0',
    test_type: 'functional; UI; e2e',
    platform: 'both',
    user_persona: 'QBot ordinary user',
    execution_scope: 'local_mock_or_fixture',
    preconditions: 'Deepbank server and Electron UI are available; mock provider is acceptable for transport proof.',
    steps: 'Open QBot assistant, submit a normal Chinese work request, observe streaming content, status changes, final done state, and persisted transcript.',
    expected_result: 'The turn streams visibly, reaches a terminal done state, remains resumable, and does not expose runtime internals.',
    negative_or_edge: 'No - core happy path.',
    automation_candidate: 'Yes - local UI/e2e smoke can validate the product contract.',
    automation_level_target: 'A0',
    validation_commands: 'npm run build:ui && npm run e2e:doctor -- --scope=local && npm run e2e:local',
    evidence_required: 'UI screenshot; WS event log; transcript snapshot',
    blackbox_gate: ordinaryUserBlackboxGate(),
    acceptance_source: 'QBot core assistant product path.',
    blocked_by: '',
    owner_agent: 'ui-product-experience-tester',
  },
  {
    case_id: 'QBOT-FUNC-RUNTIME-001',
    maintenance_action: 'baseline',
    module: 'Runtime / Protocol',
    submodule: 'Codex product-path execution',
    source_refs: 'meeting: Codex CLI framework + GLM5.2 protocol conversion; repo:test/runtime-features/README.md',
    issue_state: 'baseline',
    priority: 'P0',
    regression_layer: 'S1',
    test_type: 'runtime; integration; e2e',
    platform: 'both',
    user_persona: 'Admin / IT operator',
    execution_scope: 'real_dependency',
    preconditions: 'Codex runtime path configured; provider/model env available or skip reason recorded.',
    steps: 'Select or configure Codex runtime path, run a representative QBot turn, inspect raw SDK, Deepbank WS, transcript, and redaction artifacts.',
    expected_result: 'Codex turn completes through the product path with mapped events, sanitized artifacts, and no false claim for SDK-only features.',
    negative_or_edge: 'No - runtime integration path.',
    automation_candidate: 'Partial',
    automation_level_target: 'A2',
    validation_commands: 'npm run codex:doctor && npm run codex:smoke && npm run runtime-features:doctor',
    evidence_required: 'raw-sdk.jsonl; deepbank-ws.jsonl; transcript.snapshot.jsonl; redaction-report.json',
    blackbox_gate: adminBlackboxGate(),
    acceptance_source: 'Runtime feature contract and product-path evidence.',
    blocked_by: 'Requires configured Codex/provider path for real evidence.',
    owner_agent: 'runtime-protocol-skill-chain-tester',
  },
  {
    case_id: 'QBOT-FUNC-SKILLS-001',
    maintenance_action: 'baseline',
    module: 'Skills / MCP / Experts',
    submodule: 'Skill invocation and multi-skill chaining',
    source_refs: 'meeting: long tasks, skill calls, multi-skill chaining',
    issue_state: 'baseline',
    priority: 'P1',
    regression_layer: 'S1',
    test_type: 'functional; runtime; integration',
    platform: 'both',
    user_persona: 'QBot ordinary user',
    execution_scope: 'local_mock_or_fixture',
    preconditions: 'At least two safe local skills are installed or fixture skills are available.',
    steps: 'Ask QBot to solve a task requiring two distinct skills, verify skill discovery, invocation order, tool results, and final synthesis.',
    expected_result: 'QBot invokes required skills without leaking internals, handles unavailable skills explicitly, and produces a coherent final result.',
    negative_or_edge: 'Includes missing-skill variant.',
    automation_candidate: 'Partial',
    automation_level_target: 'A1',
    validation_commands: 'npm run skills:check && npm run codex:doctor && npm run codex:smoke',
    evidence_required: 'WS tool events; transcript; installed skill list; final answer',
    blackbox_gate: ordinaryUserBlackboxGate(),
    acceptance_source: 'Skill invocation and chaining contract.',
    blocked_by: '',
    owner_agent: 'runtime-protocol-skill-chain-tester',
  },
  {
    case_id: 'QBOT-FUNC-PROJECTS-001',
    maintenance_action: 'baseline',
    module: 'Projects / GitLab',
    submodule: 'Repo-backed project workspace',
    source_refs: 'issues:#92,#100,#118; repo:docs/product-overview.md',
    issue_state: 'baseline',
    priority: 'P0',
    regression_layer: 'S1',
    test_type: 'functional; integration; e2e',
    platform: 'both',
    user_persona: 'QBot ordinary user',
    execution_scope: 'real_dependency',
    preconditions: 'GitLab-backed project fixture or mocked adapter is available.',
    steps: 'Create/open a QBot project, inspect plan/activity/members/files/runtime status, and verify GitLab implementation details are not exposed as primary product copy.',
    expected_result: 'Project behaves as a QBot workspace with redacted GitLab evidence and explicit auth/stale/conflict states.',
    negative_or_edge: 'Includes auth missing and protected branch variants.',
    automation_candidate: 'Partial',
    automation_level_target: 'A2',
    validation_commands: 'npm run build:ui && npm run e2e:doctor -- --scope=local && npm run e2e:local',
    evidence_required: 'UI screenshots; API payload snapshots; redaction report',
    blackbox_gate: ordinaryUserBlackboxGate(),
    acceptance_source: 'GitLab-backed project product contract.',
    blocked_by: 'Live private GitLab acceptance depends on Lingxi OAuth2 to GitLab token exchange.',
    owner_agent: 'functional-test-case-designer',
  },
  {
    case_id: 'QBOT-SEC-COMPLIANCE-001',
    maintenance_action: 'baseline',
    module: 'Compliance / Security',
    submodule: 'M1-M4 tier and secret redaction',
    source_refs: 'issue:#120; repo:docs/design-decisions.md',
    issue_state: 'baseline',
    priority: 'P0',
    regression_layer: 'S1',
    test_type: 'security; compliance; functional',
    platform: 'both',
    user_persona: 'Admin / IT operator',
    execution_scope: 'real_dependency',
    preconditions: 'Compliance tier UI/config exists or case is marked design-blocked.',
    steps: 'Verify users choose compliance tier rather than raw runtime/model; attempt M4 upgrade with company non-public data context; inspect UI/API/log artifacts.',
    expected_result: 'Compliance tier boundaries are enforced, M4 does not carry prohibited history, and no secrets appear in UI/API/logs.',
    negative_or_edge: 'M4 prohibited-data negative case.',
    automation_candidate: 'Partial',
    automation_level_target: 'A2',
    validation_commands: 'npm run build:ui && npm run e2e:doctor -- --scope=local',
    evidence_required: 'UI screenshot; API payload; redaction scan; blocked-state message',
    blackbox_gate: adminBlackboxGate(),
    acceptance_source: 'Compliance tier contract and redaction evidence.',
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
    const persona = personaFor(issue, classification);
    const executionScope = executionScopeFor(issue, classification);
    const blockedBy = classification.blocked_by || blockerForIssueState(issue);
    const regressionLayer = regressionLayerFor(issue, classification, blockedBy);
    const automationLevel = automationLevelFor(issue, classification, regressionLayer, executionScope);
    const acceptanceSource = acceptanceSourceFor(issue);
    const blackboxGate = persona.startsWith('QBot ordinary') ? ordinaryUserBlackboxGate() : adminBlackboxGate();
    const validationCommands = validationCommandsFor(issue, classification, executionScope);
    const expectedResult = expectedResultFor(issue, summary);
    rows.push({
      case_id: issueCaseId(prefix, moduleId, issue.iid, 'MAIN'),
      maintenance_action: 'add',
      module: moduleName,
      submodule: issue.title,
      source_refs: source,
      issue_state: issue.state,
      priority: classification.priority,
      regression_layer: regressionLayer,
      test_type: classification.test_types.join('; '),
      platform: classification.module_ids.includes('e2e_release') ? 'Windows; macOS' : 'both',
      user_persona: persona,
      execution_scope: executionScope,
      preconditions: preconditionsFor(issue, classification, executionScope, blockedBy),
      steps: mainStepsFor(issue, classification, persona, acceptanceSource),
      expected_result: expectedResult,
      negative_or_edge: classification.kind === 'bug' || hasNegativeSection(issue) ? 'Yes - issue describes bug, negative, or regression behavior.' : 'No - primary acceptance path.',
      automation_candidate: automationCandidateFor(classification, blockedBy, executionScope),
      automation_level_target: automationLevel,
      validation_commands: validationCommands,
      evidence_required: evidenceFor(classification),
      blackbox_gate: blackboxGate,
      acceptance_source: acceptanceSource,
      blocked_by: blockedBy,
      owner_agent: classification.owner_agents.join('; '),
    });
    if (classification.kind === 'bug' || hasNegativeSection(issue) || blockedBy) {
      rows.push({
        case_id: issueCaseId('QBOT-NEG', moduleId, issue.iid, 'NEG'),
        maintenance_action: 'add',
        module: moduleName,
        submodule: `Negative/blocked path for #${issue.iid}`,
        source_refs: source,
        issue_state: issue.state,
        priority: classification.priority,
        regression_layer: regressionLayer,
        test_type: [...new Set([...classification.test_types, 'negative'])].join('; '),
        platform: classification.module_ids.includes('e2e_release') ? 'Windows; macOS' : 'both',
        user_persona: persona,
        execution_scope: blockedBy ? 'blocked_dependency' : executionScope,
        preconditions: blockedBy || 'Negative fixture, invalid input, missing permission, stale state, or failed dependency can be simulated.',
        steps: [
          `Force or simulate the negative condition described by issue #${issue.iid}.`,
          'Run the same user-visible product path.',
          'Verify the product fails closed with a clear message and records no false success.',
          persona.startsWith('QBot ordinary')
            ? 'Verify the user is not asked to choose model, provider, runtime, baseURL, env key, MCP command, Codex, or Claude Code.'
            : 'Verify technical diagnostic details are limited to admin/operator surfaces and are redacted in ordinary-user views.',
        ].join('\n'),
        expected_result: 'The product reports blocked/failed/degraded state truthfully and produces no fabricated success evidence.',
        negative_or_edge: 'Yes - forced negative, blocked, or regression state.',
        automation_candidate: automationCandidateFor(classification, blockedBy, blockedBy ? 'blocked_dependency' : executionScope),
        automation_level_target: automationLevel,
        validation_commands: validationCommands,
        evidence_required: 'Failure screenshot; sanitized error payload; issue-specific artifact',
        blackbox_gate: blackboxGate,
        acceptance_source: acceptanceSource,
        blocked_by: blockedBy,
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

function blockerForIssueState(issue) {
  if (issue.state === 'closed') return '';
  return '';
}

function hasNegativeSection(issue) {
  return Boolean(extractSection(issue.description, 'Negative Cases')) || /bug|fail|失败|回归|blocked|阻塞/i.test(issue.title);
}

function personaFor(issue, classification) {
  const text = `${issue.title}\n${issue.description}`.toLowerCase();
  const title = issue.title.toLowerCase();
  if (classification.kind === 'external-dependency') return 'Platform / dependency owner';
  if (classification.module_ids.some((module) => ['runtime', 'compliance'].includes(module))) return 'Admin / IT operator';
  if (['design', 'docs', 'refactor', 'chore'].includes(classification.kind)) return 'Product / QA reviewer';
  const userFacingModule = classification.module_ids.some((module) => ['assistant', 'uiux', 'projects', 'automation'].includes(module));
  const titleNamesAdminSurface = /\badmin\b|管理员|配置中心|config center|assistantconfig|助理配置|llm connection|provider|baseurl|env key|secret|token|oauth|mcp/i.test(title);
  if (userFacingModule && !titleNamesAdminSurface) return 'QBot ordinary user';
  if (classification.module_ids.includes('e2e_release')) return 'QA / Release operator';
  const explicitAdminSurface = /\badmin\b|管理员|配置中心|config center|assistantconfig|助理配置|llm connection|provider|baseurl|env key|secret|token|oauth|mcp/i.test(text);
  if (explicitAdminSurface) return 'Admin / IT operator';
  return 'QBot ordinary user';
}

function executionScopeFor(issue, classification) {
  const text = `${issue.title}\n${issue.description}`.toLowerCase();
  if (classification.blocked_by || classification.kind === 'external-dependency') return 'blocked_dependency';
  if (classification.kind === 'design' || classification.kind === 'docs') return 'design_review';
  if (/release|desktop|dmg|nsis|teams-hosted|360teams|windows|macos|uat|remote-dev|安装包|打包|发布|客户端构建/i.test(text)) return 'release_specialty';
  if (/lingxi|oauth|gitlab|skillhub|mcphub|llm|provider|real-provider|真实|token exchange/i.test(text)) return 'real_dependency';
  return 'local_mock_or_fixture';
}

function regressionLayerFor(issue, classification, blockedBy) {
  const text = `${issue.title}\n${issue.description}`.toLowerCase();
  if (blockedBy || classification.kind === 'external-dependency') return 'S3';
  if (classification.kind === 'design' || classification.kind === 'docs') return 'S3';
  const userCriticalBug = classification.kind === 'bug'
    && classification.priority === 'P0'
    && classification.module_ids.some((module) => ['assistant', 'uiux', 'projects'].includes(module))
    && /assistant|chat|登录|auth|quick feedback|启动|never closes|无法|失败|fails|button|screenshot/i.test(text);
  if (userCriticalBug) return 'S0';
  if (classification.priority === 'P0' || classification.module_ids.some((module) => ['runtime', 'projects', 'compliance', 'e2e_release'].includes(module))) return 'S1';
  return 'S2';
}

function automationLevelFor(issue, classification, regressionLayer, executionScope) {
  if (executionScope === 'release_specialty') return 'A3';
  if (executionScope === 'real_dependency' || classification.module_ids.some((module) => ['compliance'].includes(module))) return 'A2';
  if (regressionLayer === 'S0' && classification.module_ids.some((module) => ['assistant', 'uiux', 'projects'].includes(module))) return 'A0';
  return 'A1';
}

function acceptanceSourceFor(issue) {
  const sections = [
    ['Verification Checklist', extractSection(issue.description, 'Verification Checklist')],
    ['Acceptance Criteria', extractSection(issue.description, 'Acceptance Criteria')],
    ['Goal', extractSection(issue.description, 'Goal')],
    ['Scope', extractSection(issue.description, 'Scope')],
    ['Problem', extractSection(issue.description, 'Problem')],
  ].filter(([, value]) => value);
  if (!sections.length) return `Issue title/body for #${issue.iid}`;
  const [name, value] = sections[0];
  return `${name}: ${cleanText(value, 260)}`;
}

function expectedResultFor(issue, summary) {
  const cleaned = cleanText(summary || issue.description || issue.title, 320);
  return cleaned
    ? `Observable behavior required by issue #${issue.iid} is satisfied: ${cleaned}`
    : `Observable behavior required by issue #${issue.iid} is satisfied without leaking internal or secret data.`;
}

function cleanText(value, maxLength) {
  return String(value || '')
    .replace(/^#{1,6}\s*/gm, '')
    .replace(/#{2,6}\s*/g, '')
    .replace(/^>\s?/gm, '')
    .replace(/^- \[[ x]\]\s?/gim, '')
    .replace(/[`*_]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

function entryPointFor(classification) {
  const modules = classification.module_ids;
  if (modules.includes('assistant')) return 'QBot new task / assistant conversation area';
  if (modules.includes('projects') || modules.includes('automation')) return 'WorkBuddy space / workspace / project task area';
  if (modules.includes('skills_mcp')) return 'Experts, skills, or connectors surface';
  if (modules.includes('uiux')) return 'Target UI surface in the Electron app shell';
  if (modules.includes('e2e_release')) return 'Desktop install, launch, update, or Teams-hosted entry point';
  if (modules.includes('compliance')) return 'Admin/security configuration or redaction evidence path';
  if (modules.includes('runtime')) return 'Runtime configuration or task execution evidence path';
  return 'QBot product surface named by the issue';
}

function mainStepsFor(issue, classification, persona, acceptanceSource) {
  const steps = [
    `Open the relevant product entry: ${entryPointFor(classification)}.`,
    `Execute the user-visible scenario for issue #${issue.iid}: ${issue.title}.`,
    `Validate the issue acceptance source: ${acceptanceSource}.`,
    'Capture required evidence before marking the case pass.',
    'If any prerequisite is unavailable, mark the case blocked/not-run with the exact missing dependency instead of passing it.',
  ];
  if (persona.startsWith('QBot ordinary')) {
    steps.splice(3, 0, 'Verify the task can be completed without the user selecting or understanding model, provider, runtime, baseURL, env key, MCP command, Codex, or Claude Code.');
  }
  return steps.join('\n');
}

function preconditionsFor(issue, classification, executionScope, blockedBy) {
  if (blockedBy) return blockedBy;
  if (executionScope === 'release_specialty') return 'Clean Windows/macOS test machine or release fixture is available; generated artifacts are isolated from user data.';
  if (executionScope === 'real_dependency') return 'Real dependency account/env is configured or the case is explicitly marked blocked with missing dependency names only.';
  if (executionScope === 'design_review') return 'Issue acceptance text and relevant docs/context are available; product owner questions are recorded as blockers.';
  if (classification.module_ids.includes('uiux') || classification.module_ids.includes('assistant')) return 'Local app or e2e harness can launch the relevant QBot UI surface with fixture data.';
  return 'Repository-local fixtures, mocked service path, or deterministic test data are available.';
}

function automationCandidateFor(classification, blockedBy, executionScope) {
  if (classification.kind === 'external-dependency') return 'No - dependency owner acceptance is required before executable validation.';
  if (blockedBy) return `Partial - blocked until ${blockedBy}`;
  if (executionScope === 'design_review') return 'Partial - static/context checks can run, but product decision needs human review.';
  return 'Yes - executable local, mock, real, or release validation path is defined.';
}

function validationCommandsFor(issue, classification, executionScope) {
  const commands = new Set(classification.validation_commands || ['npm run check']);
  const text = `${issue.title}\n${issue.description}`.toLowerCase();
  if (executionScope === 'design_review') {
    commands.add('npm run context:check');
    if (text.includes('skill') || text.includes('技能')) commands.add('npm run skills:check');
  }
  if (executionScope === 'real_dependency') {
    if (classification.module_ids.some((module) => ['runtime', 'skills_mcp'].includes(module))) commands.add('npm run runtime-features:test:real');
    if (classification.module_ids.some((module) => ['assistant', 'projects', 'uiux'].includes(module))) commands.add('npm run e2e:local:real');
  }
  if (executionScope === 'release_specialty') {
    commands.add('npm run build:desktop');
    commands.add('npm run e2e:release:mac');
  }
  return [...commands].join(' && ');
}

function ordinaryUserBlackboxGate() {
  return 'Ordinary user must not need to choose or understand model, provider, runtime, baseURL, env key, MCP command, Codex, Claude Code, or raw protocol details; product copy uses QBot/WorkBuddy concepts.';
}

function adminBlackboxGate() {
  return 'Technical concepts may appear only in admin/operator setup or diagnostic views; ordinary task flow still hides model/runtime/provider internals and redacts secrets.';
}
