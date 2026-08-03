import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const casebook = path.join(root, 'PRD', 'QBot核心内测门禁Casebook_74条_2026-07-31.xlsx');
const expectedSha = 'd72aba1cee18f6ec16d66c56920ae3e7b8f31106541cb275507dc4cfe328ba03';
const autoTest = path.join(root, 'autoTest');
const autoTestBefore = fs.existsSync(autoTest) ? fs.readdirSync(autoTest).sort() : [];

const cliHelp = spawnSync(process.execPath, [
  path.join(root, 'src', 'cli.mjs'),
  'ui-agent-casebook-run',
  '--help',
], { cwd: root, encoding: 'utf8' });
if (cliHelp.status !== 0) throw new Error(`CLI help failed: ${cliHelp.stderr}`);
if (!/core-beta:pretest/.test(cliHelp.stdout)) throw new Error('CLI help must point to core-beta:pretest.');
const autoTestAfter = fs.existsSync(autoTest) ? fs.readdirSync(autoTest).sort() : [];
if (JSON.stringify(autoTestBefore) !== JSON.stringify(autoTestAfter)) {
  throw new Error('ui-agent-casebook-run --help must not create a run directory.');
}

const auditHelp = spawnSync(process.execPath, [
  path.join(root, 'scripts', 'audit-core-beta-execution-capabilities.mjs'),
  '--help',
], { cwd: root, encoding: 'utf8' });
if (auditHelp.status !== 0 || !/--sheet <exact-name>/.test(auditHelp.stdout)) {
  throw new Error(`Capability audit help failed: ${auditHelp.stderr || auditHelp.stdout}`);
}

const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'qbot-core-beta-pretest-'));
const auditOut = path.join(temp, 'audit');
const audit = spawnSync(process.execPath, [
  path.join(root, 'scripts', 'audit-core-beta-execution-capabilities.mjs'),
  '--casebook', casebook,
  '--sheet', '核心内测Case',
  '--out', auditOut,
], { cwd: root, encoding: 'utf8' });
if (audit.status !== 0) throw new Error(`Capability audit failed: ${audit.stderr || audit.stdout}`);
const auditReport = JSON.parse(fs.readFileSync(path.join(auditOut, 'capability-audit.json'), 'utf8'));
if (auditReport.casebook.sheet !== '核心内测Case') throw new Error('Capability audit did not freeze exact Sheet.');
if (auditReport.protocol.case_count !== 74 || auditReport.protocol.executable_count !== 74) {
  throw new Error(`Capability audit count mismatch: ${JSON.stringify(auditReport.protocol)}`);
}

const pretestHelp = spawnSync(process.execPath, [
  path.join(root, 'scripts', 'preflight-core-beta-test-run.mjs'),
  '--help',
], { cwd: root, encoding: 'utf8' });
if (pretestHelp.status !== 0
  || !/never starts a runner/.test(pretestHelp.stdout)
  || !/READY_SCOPED/.test(pretestHelp.stdout)
  || !/--excluded-case/.test(pretestHelp.stdout)) {
  throw new Error(`Pretest help failed: ${pretestHelp.stderr || pretestHelp.stdout}`);
}

const pretestOut = path.join(temp, 'pretest');
const pretest = spawnSync(process.execPath, [
  path.join(root, 'scripts', 'preflight-core-beta-test-run.mjs'),
  '--casebook', casebook,
  '--sheet', '核心内测Case',
  '--profile', 'mandatory',
  '--lane', 'local',
  '--out', pretestOut,
  '--expected-count', '74',
  '--expected-sha256', expectedSha,
  '--cdp', 'http://127.0.0.1:1',
  '--no-framework-checks',
], { cwd: root, encoding: 'utf8', timeout: 120_000 });
if (pretest.status !== 2) {
  throw new Error(`Unavailable runtime pretest must fail closed with exit 2: ${pretest.stdout}\n${pretest.stderr}`);
}
const report = JSON.parse(fs.readFileSync(path.join(pretestOut, 'core-beta-pretest-report.json'), 'utf8'));
if (report.status !== 'BLOCKED') throw new Error(`Expected BLOCKED pretest, got ${report.status}`);
const entrypointTracking = report.checks.find((item) => item.id === 'git_framework_entrypoints_tracked');
if (!entrypointTracking) throw new Error('Pretest must audit whether its own executable contract is tracked by Git.');
const requiredEntrypoints = [
  'scripts/preflight-core-beta-test-run.mjs',
  'scripts/core-beta-fixture-controller.mjs',
  'src/lib/core-beta-fixture-controller.mjs',
  'test/core-beta-pretest.mjs',
  'test/core-beta-fixture-controller.mjs',
];
const allEntrypointsTracked = requiredEntrypoints.every((entrypoint) => (
  spawnSync('git', [
    'ls-files',
    '--error-unmatch',
    '--',
    entrypoint,
  ], { cwd: root, encoding: 'utf8' }).status === 0
));
if (entrypointTracking.status !== (allEntrypointsTracked ? 'passed' : 'blocked')) {
  throw new Error(`Framework entrypoint tracking mismatch: ${JSON.stringify(entrypointTracking)}`);
}
for (const id of ['casebook_sha256', 'casebook_exact_sheet_export', 'case_count', 'case_id_unique', 'core_beta_protocol']) {
  const check = report.checks.find((item) => item.id === id);
  if (check?.status !== 'passed') throw new Error(`Expected ${id} to pass: ${JSON.stringify(check)}`);
}
if (!report.checks.some((item) => item.id === 'fixture_controller_contract' && item.status === 'blocked')) {
  throw new Error('Missing fixture controller must block before a real run.');
}
if (!report.checks.some((item) => item.id === 'local_qbot_cdp' && item.status === 'blocked')) {
  throw new Error('Unavailable local CDP must block before a real run.');
}
if (fs.existsSync(path.join(pretestOut, 'automation-progress.json'))) {
  throw new Error('Pretest must never create synthetic Case progress.');
}

console.log('core beta pretest ok');
