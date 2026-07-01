import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'qbot-test-agent-'));
const repo = path.join(temp, 'repo');
const issuesDir = path.join(repo, 'issues');
const out = path.join(temp, 'out');
const state = path.join(temp, 'state', 'snapshot.json');
fs.mkdirSync(issuesDir, { recursive: true });
fs.writeFileSync(path.join(repo, 'package.json'), JSON.stringify({
  scripts: {
    check: 'node -e "process.exit(0)"',
    'build:ui': 'node -e "process.exit(0)"',
    'e2e:doctor': 'node -e "process.exit(0)"',
    'e2e:local': 'node -e "process.exit(0)"',
    'codex:doctor': 'node -e "process.exit(0)"',
    'codex:smoke': 'node -e "process.exit(0)"',
    'runtime-features:doctor': 'node -e "process.exit(0)"',
    'runtime-features:test': 'node -e "process.exit(0)"',
    'uiux:audit': 'node -e "process.exit(0)"',
    'skills:check': 'node -e "process.exit(0)"',
    'fail:test': 'node -e "console.error(\\"simulated failure\\"); process.exit(7)"',
  },
}, null, 2), 'utf8');
fs.writeFileSync(path.join(issuesDir, 'issues_list.json'), JSON.stringify([
  {
    iid: 1,
    title: 'feature(qbot/feedback): add chat-area quick feedback issue intake',
    description: '### Product Requirements\nQBot ordinary users can submit quick feedback from the chat area without choosing model, runtime, provider, baseURL, env key, MCP, Codex, or Claude Code.\n### Acceptance Criteria\n- Feedback entry is visible in the chat area.\n- Submitted feedback creates a product issue with redacted screenshot evidence.\n- Missing auth or upload failure shows a clear product-facing blocked state.',
    state: 'opened',
    labels: ['area/assistant-ui', 'kind/feature', 'status/ready'],
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
  },
  {
    iid: 2,
    title: 'bug(e2e): macOS local e2e fails',
    description: '### Scope\nmacOS e2e reliability.\n### Evidence\nno such table',
    state: 'opened',
    labels: ['area/e2e', 'kind/bug'],
    created_at: '2026-01-02T00:00:00.000Z',
    updated_at: '2026-01-02T00:00:00.000Z',
  },
], null, 2), 'utf8');
fs.writeFileSync(path.join(repo, 'issues_closed.json'), JSON.stringify([
  {
    iid: 3,
    title: 'feature(skills): product-facing skill invocation coverage',
    description: '### Product Requirements\nQBot users can invoke a visible expert or skill from the product surface and receive a coherent answer without reading raw MCP commands.\n### Verification Checklist\n- [ ] Product UI shows a safe skill entry point\n- [ ] Missing skill state is product-facing and does not claim success',
    state: 'closed',
    labels: ['area/skills', 'kind/feature'],
    created_at: '2026-01-03T00:00:00.000Z',
    updated_at: '2026-01-03T00:00:00.000Z',
    closed_at: '2026-01-04T00:00:00.000Z',
  },
], null, 2), 'utf8');

execFileSync(process.execPath, [
  path.join(root, 'src', 'cli.mjs'),
  'run',
  '--repo', repo,
  '--out', out,
  '--state', state,
], { stdio: 'pipe' });

const required = [
  'run-result.json',
  'functional-test-cases.json',
  'codex-automation-flows.json',
  'issue-intelligence-report.json',
  'issue-intelligence-report.md',
  'qbot-functional-test-cases.csv',
  'qbot-codex-automation-flows.csv',
  'qbot-product-issue-scope.csv',
  'qbot-test-plan.xlsx',
  'RUN_SUMMARY.md',
];
for (const file of required) {
  const target = path.join(out, file);
  if (!fs.existsSync(target)) throw new Error(`Missing smoke output: ${target}`);
}
const result = JSON.parse(fs.readFileSync(path.join(out, 'run-result.json'), 'utf8'));
if (result.counts.issues !== 3) throw new Error(`Expected 3 issues, got ${result.counts.issues}`);
if (result.counts.product_issues !== 2) throw new Error(`Expected 2 product issues, got ${result.counts.product_issues}`);
if (result.counts.excluded_issues !== 1) throw new Error(`Expected 1 excluded issue, got ${result.counts.excluded_issues}`);
if (result.counts.test_cases < 7) throw new Error(`Expected generated test cases, got ${result.counts.test_cases}`);
if (result.audit.status === 'blocked') throw new Error(`Smoke audit blocked: ${result.audit.critical.join('; ')}`);
const workbookBytes = fs.readFileSync(path.join(out, 'qbot-test-plan.xlsx'));
if (workbookBytes[0] !== 0x50 || workbookBytes[1] !== 0x4b) throw new Error('Workbook is not an XLSX/ZIP file.');
const cases = JSON.parse(fs.readFileSync(path.join(out, 'functional-test-cases.json'), 'utf8'));
const caseIds = cases.map((row) => row.case_id);
if (new Set(caseIds).size !== caseIds.length) throw new Error('Duplicate case_id found in smoke output.');
if (cases.some((row) => String(row.source_refs).includes('issue:#2'))) throw new Error('Development-process issue #2 should not generate a test case.');
const issueIntelligence = JSON.parse(fs.readFileSync(path.join(out, 'issue-intelligence-report.json'), 'utf8'));
if (!issueIntelligence.selected_issues.some((issue) => issue.iid === 1)) throw new Error('Product issue #1 should be selected.');
if (!issueIntelligence.excluded_issues.some((issue) => issue.iid === 2)) throw new Error('Development-process issue #2 should be excluded.');
const flows = JSON.parse(fs.readFileSync(path.join(out, 'codex-automation-flows.json'), 'utf8'));
const flowIds = flows.map((row) => row.flow_id);
if (new Set(flowIds).size !== flowIds.length) throw new Error('Duplicate flow_id found in smoke output.');

const automationOut = path.join(temp, 'automation-out');
execFileSync(process.execPath, [
  path.join(root, 'src', 'cli.mjs'),
  'automation-doctor',
  '--repo', repo,
  '--flows', path.join(out, 'codex-automation-flows.json'),
  '--out', automationOut,
  '--suite', 'daily',
], { stdio: 'pipe' });
execFileSync(process.execPath, [
  path.join(root, 'src', 'cli.mjs'),
  'automation-run',
  '--repo', repo,
  '--flows', path.join(out, 'codex-automation-flows.json'),
  '--out', path.join(temp, 'automation-dry-run'),
  '--suite', 'daily',
  '--dry-run',
  '--limit', '2',
], { stdio: 'pipe' });
const automationReport = JSON.parse(fs.readFileSync(path.join(automationOut, 'automation-execution-report.json'), 'utf8'));
if (automationReport.doctor.status !== 'pass') throw new Error(`Automation doctor should pass: ${automationReport.doctor.findings.join('; ')}`);
if (!fs.existsSync(path.join(automationOut, 'automation-execution-report.md'))) throw new Error('Missing automation execution markdown report.');

const failingFlows = path.join(temp, 'failing-flows.json');
const flowOs = process.platform === 'win32' ? 'Windows' : 'macOS';
const failCommand = flowOs === 'Windows'
  ? 'Set-Location $env:DEEPBANK_REPO\nnpm run fail:test'
  : 'cd "$DEEPBANK_REPO"\nnpm run fail:test';
fs.writeFileSync(failingFlows, JSON.stringify([
  {
    flow_id: 'QBOT-CODEX-FAIL-001',
    linked_case_ids: 'QBOT-FUNC-FAIL-001',
    os: flowOs,
    automation_level: 'A1',
    execution_scope: 'local_mock_or_fixture',
    mode: 'shell',
    required_tools: 'Node.js 22+; npm',
    required_env: 'DEEPBANK_REPO; DEEPBANK_TEST_HOME',
    setup_steps: 'Use the smoke test fake repo.',
    codex_prompt_or_command: failCommand,
    ui_steps: 'No UI operation.',
    assertions: 'The simulated command should pass; this smoke fixture intentionally fails to verify bug issue drafts.',
    blackbox_assertions: 'No secret value should appear in output.',
    evidence_paths: 'test-results/**',
    timeout_minutes: '1',
    long_running_controls: 'Fail fast.',
    cleanup: 'No cleanup required.',
    skip_or_block_rules: 'Missing repo is blocked.',
  },
], null, 2), 'utf8');
const failOut = path.join(temp, 'automation-failed');
let failedRunClosed = false;
try {
  execFileSync(process.execPath, [
    path.join(root, 'src', 'cli.mjs'),
    'automation-run',
    '--repo', repo,
    '--flows', failingFlows,
    '--out', failOut,
    '--suite', 'daily',
  ], { stdio: 'pipe' });
} catch {
  failedRunClosed = true;
}
if (!failedRunClosed) throw new Error('Expected failing automation flow to exit non-zero.');
const failedReport = JSON.parse(fs.readFileSync(path.join(failOut, 'automation-execution-report.json'), 'utf8'));
if (failedReport.status !== 'failed') throw new Error(`Expected failed automation report, got ${failedReport.status}`);
if (failedReport.issue_loop?.draft_count !== 1) throw new Error('Expected one bug issue draft from failed automation run.');
const drafts = JSON.parse(fs.readFileSync(path.join(failOut, 'bug-issue-drafts.json'), 'utf8'));
if (!drafts[0]?.fingerprint || !drafts[0]?.description.includes('simulated failure')) {
  throw new Error('Bug issue draft should include a fingerprint and redacted failure evidence.');
}
if (!fs.existsSync(path.join(failOut, 'bug-issue-drafts.md'))) throw new Error('Missing bug issue draft markdown.');

const badRepo = path.join(temp, 'bad-repo');
fs.mkdirSync(path.join(badRepo, 'issues'), { recursive: true });
fs.writeFileSync(path.join(badRepo, 'issues', 'issues_list.json'), '[{bad json]', 'utf8');
let failedClosed = false;
try {
  execFileSync(process.execPath, [
    path.join(root, 'src', 'cli.mjs'),
    'run',
    '--repo', badRepo,
    '--out', path.join(temp, 'bad-out'),
    '--state', path.join(temp, 'bad-state.json'),
  ], { stdio: 'pipe' });
} catch {
  failedClosed = true;
}
if (!failedClosed) throw new Error('Expected corrupt issue source to fail closed.');

console.log(`smoke ok: ${out}`);
