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
fs.writeFileSync(path.join(issuesDir, 'issues_list.json'), JSON.stringify([
  {
    iid: 1,
    title: 'feature(runtime): Codex protocol smoke',
    description: '### Goal\nVerify Codex protocol path.\n### Verification Checklist\n- [ ] npm run codex:smoke',
    state: 'opened',
    labels: ['area/runtime', 'kind/feature', 'status/ready'],
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
    title: 'feature(skills): chained skill invocation coverage',
    description: '### Goal\nVerify multi-skill chaining from issue details.\n### Verification Checklist\n- [ ] skill A calls skill B and preserves evidence',
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
  'qbot-functional-test-cases.csv',
  'qbot-codex-automation-flows.csv',
  'qbot-test-plan.xlsx',
  'RUN_SUMMARY.md',
];
for (const file of required) {
  const target = path.join(out, file);
  if (!fs.existsSync(target)) throw new Error(`Missing smoke output: ${target}`);
}
const result = JSON.parse(fs.readFileSync(path.join(out, 'run-result.json'), 'utf8'));
if (result.counts.issues !== 3) throw new Error(`Expected 3 issues, got ${result.counts.issues}`);
if (result.counts.test_cases < 8) throw new Error(`Expected generated test cases, got ${result.counts.test_cases}`);
if (result.audit.status === 'blocked') throw new Error(`Smoke audit blocked: ${result.audit.critical.join('; ')}`);
const workbookBytes = fs.readFileSync(path.join(out, 'qbot-test-plan.xlsx'));
if (workbookBytes[0] !== 0x50 || workbookBytes[1] !== 0x4b) throw new Error('Workbook is not an XLSX/ZIP file.');
const cases = JSON.parse(fs.readFileSync(path.join(out, 'functional-test-cases.json'), 'utf8'));
const caseIds = cases.map((row) => row.case_id);
if (new Set(caseIds).size !== caseIds.length) throw new Error('Duplicate case_id found in smoke output.');
const flows = JSON.parse(fs.readFileSync(path.join(out, 'codex-automation-flows.json'), 'utf8'));
const flowIds = flows.map((row) => row.flow_id);
if (new Set(flowIds).size !== flowIds.length) throw new Error('Duplicate flow_id found in smoke output.');

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
