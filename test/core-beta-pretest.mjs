import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const casebook = path.join(root, 'PRD', 'QBot核心内测门禁Casebook_74条_2026-07-31.xlsx');
const expectedSha = '25c1c3df11e3d65ec0927edd5ddd2e693aa4bfdccdb92899fe3344a7f7dbe8f6';
const autoTest = path.join(root, 'autoTest');
const autoTestBefore = fs.existsSync(autoTest) ? fs.readdirSync(autoTest).sort() : [];

const cliHelp = spawnSync(process.execPath, [
  path.join(root, 'src', 'cli.mjs'),
  'ui-agent-casebook-run',
  '--help',
], { cwd: root, encoding: 'utf8' });
if (cliHelp.status !== 0) throw new Error(`CLI help failed: ${cliHelp.stderr}`);
if (!/core-beta:pretest/.test(cliHelp.stdout)) throw new Error('CLI help must point to core-beta:pretest.');
if (!/74\/70\/160 Casebook batch/.test(cliHelp.stdout)) throw new Error('CLI help must include the full 160 Casebook contract.');
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
if (!auditReport.runtime_dispatch?.ok || auditReport.runtime_dispatch.dispatchable_count !== 74) {
  throw new Error(`Capability audit runtime dispatch mismatch: ${JSON.stringify(auditReport.runtime_dispatch)}`);
}

const grayCasebook = path.join(root, 'PRD', 'QBot新增MR核心冒烟与生产灰度全量回归Casebook_12-70-160条_2026-08-27.xlsx');
const grayExpectedSha = '361ca7b7b30a56c5742d337d1be4cd30a353f2a740138a389d875b007ddd7b6d';
const grayActualSha = crypto.createHash('sha256').update(fs.readFileSync(grayCasebook)).digest('hex');
if (grayActualSha !== grayExpectedSha) {
  throw new Error(`70 Casebook SHA mismatch: expected=${grayExpectedSha} actual=${grayActualSha}`);
}
const grayAuditOut = path.join(temp, 'gray-audit');
const grayAudit = spawnSync(process.execPath, [
  path.join(root, 'scripts', 'audit-core-beta-execution-capabilities.mjs'),
  '--casebook', grayCasebook,
  '--sheet', '生产灰度门禁Case',
  '--out', grayAuditOut,
], { cwd: root, encoding: 'utf8' });
if (grayAudit.status !== 0) throw new Error(`70 capability audit failed: ${grayAudit.stderr || grayAudit.stdout}`);
const grayAuditReport = JSON.parse(fs.readFileSync(path.join(grayAuditOut, 'capability-audit.json'), 'utf8'));
if (grayAuditReport.protocol.case_count !== 70
  || grayAuditReport.protocol.executable_count !== 70
  || !grayAuditReport.runtime_dispatch?.ok
  || grayAuditReport.runtime_dispatch.dispatchable_count !== 70
  || grayAuditReport.capability_summary?.strict_controller_required !== 0
  || grayAuditReport.capability_summary?.unsupported_runtime !== 0
  || grayAuditReport.capability_summary?.directly_runnable_without_controller !== 70) {
  throw new Error(`70 runtime dispatch audit mismatch: ${JSON.stringify({
    protocol: grayAuditReport.protocol,
    runtime_dispatch: grayAuditReport.runtime_dispatch,
    capability_summary: grayAuditReport.capability_summary,
  })}`);
}
const fullAuditOut = path.join(temp, 'full-audit');
const fullAudit = spawnSync(process.execPath, [
  path.join(root, 'scripts', 'audit-core-beta-execution-capabilities.mjs'),
  '--casebook', grayCasebook,
  '--sheet', '全量功能回归Case',
  '--out', fullAuditOut,
], { cwd: root, encoding: 'utf8' });
if (fullAudit.status !== 0) throw new Error(`160 capability audit failed: ${fullAudit.stderr || fullAudit.stdout}`);
const fullAuditReport = JSON.parse(fs.readFileSync(path.join(fullAuditOut, 'capability-audit.json'), 'utf8'));
if (fullAuditReport.protocol.case_count !== 160
  || fullAuditReport.protocol.executable_count !== 160
  || !fullAuditReport.runtime_dispatch?.ok
  || fullAuditReport.runtime_dispatch.dispatchable_count !== 160
  || fullAuditReport.capability_summary?.strict_controller_required !== 0
  || fullAuditReport.capability_summary?.unsupported_runtime !== 0
  || fullAuditReport.capability_summary?.directly_runnable_without_controller !== 160) {
  throw new Error(`160 runtime dispatch audit mismatch: ${JSON.stringify({
    protocol: fullAuditReport.protocol,
    runtime_dispatch: fullAuditReport.runtime_dispatch,
    capability_summary: fullAuditReport.capability_summary,
  })}`);
}
const grayCases = JSON.parse(fs.readFileSync(path.join(grayAuditOut, 'casebook-cases.json'), 'utf8')).cases || [];
const fullCases = JSON.parse(fs.readFileSync(path.join(fullAuditOut, 'casebook-cases.json'), 'utf8')).cases || [];
const grayIds = grayCases.map((item) => item.id);
const fullIds = fullCases.map((item) => item.id);
if (JSON.stringify(fullIds.slice(0, 70)) !== JSON.stringify(grayIds)) {
  throw new Error('160 Casebook first 70 IDs must exactly match the 70 gate Sheet.');
}
for (const id of [
  'BETA-REC-001',
  'BETA-REC-002',
  'BETA-REC-004',
  'BETA-TASK-003',
  'BETA-EXPERT-016',
  'SIT-HOME-025',
  'SIT-TASK-RECOVER-001',
  'SIT-ISSUE-800',
  'SIT-CONN-008',
  'SIT-TEAMS-DOC-001',
  'SIT-RUNTIME-RECOVER-001',
  'SIT-FILE-NEW-001',
]) {
  if (fullIds.includes(id)) throw new Error(`160 Casebook must exclude low-frequency/fault Case ${id}.`);
}
for (const id of [
  'SIT-SKILL-002',
  'SIT-EXPERT-002',
  'SIT-HOME-027',
  'SIT-HOME-047',
  'SIT-HOME-052',
  'SIT-HOME-028',
  'SIT-HOME-046',
  'SIT-HOME-051',
  'SIT-CONN-005',
  'SIT-HOME-048',
]) {
  if (!fullIds.includes(id)) throw new Error(`160 Casebook missing normal-function Case ${id}.`);
}
if (!fullCases.every((item) => String(item.version_scope || '').includes('6a1ee16853312d2f50eb24dd3a44db835e8a07f7'))) {
  throw new Error('Every 160 Case must freeze the latest product baseline.');
}
const gateAttachmentRejection = grayCases.find((item) => item.id === 'BETA-FILE-006');
if (!/81 MiB/.test(String(gateAttachmentRejection?.scenario || ''))
  || !/只拒绝第3份/.test(String(gateAttachmentRejection?.expected_result || ''))
  || !/MR!1305,MR!1314,MR!1352/.test(String(gateAttachmentRejection?.source_id || ''))) {
  throw new Error('BETA-FILE-006 must freeze the recent MR 81 MiB rejection, retained attachments and quota recovery contract.');
}
const gateAttachmentIngress = grayCases.find((item) => item.id === 'BETA-FILE-008');
if (!/picker、drag、clipboard/.test(String(gateAttachmentIngress?.scenario || ''))
  || !/删除后恢复无重复/.test(String(gateAttachmentIngress?.expected_result || ''))) {
  throw new Error('BETA-FILE-008 must freeze unified picker/drag/clipboard ingress and delete/re-add recovery.');
}
for (const [id, expectedTurns] of [
  ['SIT-HOME-016', 4],
  ['SIT-HOME-053', 11],
  ['SIT-HOME-058', 2],
  ['SIT-HOME-060', 2],
  ['SIT-EXPERT-022', 2],
]) {
  const testCase = fullCases.find((item) => item.id === id);
  if (!testCase) throw new Error(`160 Casebook missing multi-turn Case ${id}.`);
  if (testCase.conversation_turns?.length !== expectedTurns) {
    throw new Error(`${id} must export ${expectedTurns} declared conversation turns, actual=${testCase.conversation_turns?.length || 0}.`);
  }
}
const composerHistory = fullCases.find((item) => item.id === 'BETA-TASK-008');
if (!/第一次物理ArrowUp[^\n]*第二次/.test(String(composerHistory?.steps || ''))
  || !/第一次物理ArrowUp[^\n]*第二次/.test(JSON.stringify(composerHistory?.precise_assertions || {}))) {
  throw new Error('BETA-TASK-008 must preserve the two-physical-press boundary handshake.');
}

const mrSmokeCasebook = grayCasebook;
const mrSmokeExpectedSha = grayExpectedSha;
const mrSmokeActualSha = crypto.createHash('sha256').update(fs.readFileSync(mrSmokeCasebook)).digest('hex');
if (mrSmokeActualSha !== mrSmokeExpectedSha) {
  throw new Error(`MR smoke Casebook SHA mismatch: expected=${mrSmokeExpectedSha} actual=${mrSmokeActualSha}`);
}
const mrSmokeAuditOut = path.join(temp, 'mr-smoke-audit');
const mrSmokeAudit = spawnSync(process.execPath, [
  path.join(root, 'scripts', 'audit-core-beta-execution-capabilities.mjs'),
  '--casebook', mrSmokeCasebook,
  '--sheet', '新增MR核心冒烟',
  '--out', mrSmokeAuditOut,
], { cwd: root, encoding: 'utf8' });
if (mrSmokeAudit.status !== 0) {
  throw new Error(`MR smoke capability audit failed: ${mrSmokeAudit.stderr || mrSmokeAudit.stdout}`);
}
const mrSmokeAuditReport = JSON.parse(fs.readFileSync(path.join(mrSmokeAuditOut, 'capability-audit.json'), 'utf8'));
if (mrSmokeAuditReport.protocol.case_count !== 12
  || mrSmokeAuditReport.protocol.executable_count !== 12
  || !mrSmokeAuditReport.runtime_dispatch?.ok
  || mrSmokeAuditReport.runtime_dispatch.dispatchable_count !== 12
  || mrSmokeAuditReport.capability_summary?.runner_native !== 6
  || mrSmokeAuditReport.capability_summary?.runner_legacy_verified !== 6
  || mrSmokeAuditReport.capability_summary?.strict_controller_required !== 0
  || mrSmokeAuditReport.capability_summary?.unsupported_runtime !== 0
  || mrSmokeAuditReport.capability_summary?.directly_runnable_without_controller !== 12) {
  throw new Error(`MR smoke runtime dispatch audit mismatch: ${JSON.stringify({
    protocol: mrSmokeAuditReport.protocol,
    runtime_dispatch: mrSmokeAuditReport.runtime_dispatch,
    capability_summary: mrSmokeAuditReport.capability_summary,
  })}`);
}
const mrSmokeCases = JSON.parse(fs.readFileSync(path.join(mrSmokeAuditOut, 'casebook-cases.json'), 'utf8')).cases || [];
const expectedMrSmokeIds = [
  'MRSMOKE-ACT-001',
  'MRSMOKE-WEB-001',
  'MRSMOKE-WEB-002',
  'MRSMOKE-AUTH-001',
  'MRSMOKE-AUTO-001',
  'MRSMOKE-NAV-001',
  'MRSMOKE-ROUTE-001',
  'MRSMOKE-SKILL-001',
  'MRSMOKE-FAIL-001',
  'MRSMOKE-ART-001',
  'MRSMOKE-ENTRY-001',
  'MRSMOKE-CHART-001',
];
if (JSON.stringify(mrSmokeCases.map((item) => item.id)) !== JSON.stringify(expectedMrSmokeIds)) {
  throw new Error('MR smoke Casebook IDs and order must stay frozen at 12/12.');
}
if (!mrSmokeCases.every((item) => (
  item.contract_version === 'qbot-core-beta/v2'
  && item.runner === 'core-beta-v2'
  && item.pipeline_policy === 'serial'
))) {
  throw new Error('Every MR smoke Case must use Core Beta v2 with serial execution.');
}
const mrSmokeAuto = mrSmokeCases.find((item) => item.id === 'MRSMOKE-AUTO-001');
if (!/intervalMs=60000/.test(String(mrSmokeAuto?.test_data || ''))
  || !/activeFrom=当前时刻/.test(String(mrSmokeAuto?.test_data || ''))
  || /now-interval|约 15 秒/.test(`${mrSmokeAuto?.test_data || ''}\n${mrSmokeAuto?.expected_result || ''}`)) {
  throw new Error('MRSMOKE-AUTO-001 must use the server-supported 60-second interval without backdated activeFrom.');
}
const mrSmokeChart = mrSmokeCases.find((item) => item.id === 'MRSMOKE-CHART-001');
if (mrSmokeChart?.case_type !== 'mcp_use'
  || !/qcharts-react/.test(String(mrSmokeChart?.scenario || ''))
  || !/曝光 12000.*点击 860.*报名 240.*成交 28/.test(String(mrSmokeChart?.test_data || ''))
  || !mrSmokeChart?.evidence_roles?.includes('interactive_chart_readback')
  || !/qbot_chart\/render_chart/.test(JSON.stringify(mrSmokeChart?.precise_assertions || {}))
  || !/qbot-chart-result-fallback/.test(JSON.stringify(mrSmokeChart?.precise_assertions || {}))) {
  throw new Error('MRSMOKE-CHART-001 must freeze the task-bound qcharts interactive SVG, exact data, fallback and evidence contract.');
}
const gateChart = grayCases.find((item) => item.id === 'SIT-CONN-016');
if (gateChart?.case_type !== 'mcp_use'
  || !gateChart?.evidence_roles?.includes('interactive_chart_readback')
  || !/唯一 qcharts-react SVG/.test(JSON.stringify(gateChart?.precise_assertions || {}))) {
  throw new Error('SIT-CONN-016 must be promoted into the 70 gate with the same interactive chart hard Oracle.');
}
if (!grayIds.includes('SIT-CONN-016') || grayIds.includes('SIT-HOME-014') || !fullIds.includes('SIT-HOME-014')) {
  throw new Error('The 70 gate must promote SIT-CONN-016 and move SIT-HOME-014 into the 160-only normal-function increment.');
}

const pretestHelp = spawnSync(process.execPath, [
  path.join(root, 'scripts', 'preflight-core-beta-test-run.mjs'),
  '--help',
], { cwd: root, encoding: 'utf8' });
if (pretestHelp.status !== 0
  || !/never starts a runner/.test(pretestHelp.stdout)
  || !/READY_SCOPED/.test(pretestHelp.stdout)
  || !/--excluded-case/.test(pretestHelp.stdout)
  || !/QBOT_CORE_BETA_IME_PROBE=1/.test(pretestHelp.stdout)) {
  throw new Error(`Pretest help failed: ${pretestHelp.stderr || pretestHelp.stdout}`);
}
const pretestSource = fs.readFileSync(
  path.join(root, 'scripts', 'preflight-core-beta-test-run.mjs'),
  'utf8',
);
if (!/scoped_upstream_dependency_visibility/.test(pretestSource)
  || !/dependency_gaps/.test(pretestSource)
  || !/可信 prerequisite blocked 并继续/.test(pretestSource)) {
  throw new Error('Scoped pretest must expose excluded upstream dependency gaps as non-blocking visibility.');
}
if (!/probePublicCapabilities:\s*true/.test(pretestSource)
  || !/qwork_public_capabilities/.test(pretestSource)
  || !/publicCapabilities\?\.ok === true/.test(pretestSource)) {
  throw new Error('Teams pretest must fail closed when public window.agent.capabilities is unreadable.');
}
if (!/probeRuntimeReleaseStatus:\s*true/.test(pretestSource)
  || !/qwork_runtime_release_status/.test(pretestSource)
  || !/qwork_runtime_release_identity/.test(pretestSource)
  || !/qwork_runtime_update_activation_safe/.test(pretestSource)
  || !/runtimeReleaseAssessment\.update_activation_safe/.test(pretestSource)
  || !/qwork_host_runtime_compatibility/.test(pretestSource)
  || !/qwork_host_runtime_compatibility'[\s\S]{0,500}warning:\s*true/.test(pretestSource)
  || !/assessRuntimeReleaseStatus/.test(pretestSource)) {
  throw new Error('Teams pretest must retain host-core compatibility readback as a non-blocking warning.');
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

const nativeImeProbe = path.join(temp, 'native-ime-probe.sh');
fs.writeFileSync(nativeImeProbe, `#!/bin/zsh
if [[ "$QBOT_CORE_BETA_IME_PROBE" != "1" ]]; then
  exit 7
fi
print -r -- '{"schema_version":"qbot-core-beta-native-ime-probe/v1","ok":true,"non_mutating":true,"accessibility_permission":true,"input_source_ready":true}'
`);
fs.chmodSync(nativeImeProbe, 0o700);
const grayPretestOut = path.join(temp, 'gray-pretest');
const grayPretest = spawnSync(process.execPath, [
  path.join(root, 'scripts', 'preflight-core-beta-test-run.mjs'),
  '--casebook', grayCasebook,
  '--sheet', '生产灰度门禁Case',
  '--profile', 'mandatory',
  '--lane', 'local',
  '--out', grayPretestOut,
  '--expected-count', '70',
  '--expected-sha256', grayExpectedSha,
  '--cdp', 'http://127.0.0.1:1',
  '--native-ime-command', nativeImeProbe,
  '--no-framework-checks',
], { cwd: root, encoding: 'utf8', timeout: 120_000 });
if (grayPretest.status !== 2) {
  throw new Error(`Unavailable runtime gray pretest must still fail closed: ${grayPretest.stdout}\n${grayPretest.stderr}`);
}
const grayPretestReport = JSON.parse(fs.readFileSync(
  path.join(grayPretestOut, 'core-beta-pretest-report.json'),
  'utf8',
));
for (const id of ['native_ime_command_capability', 'fixture_controller_contract']) {
  const check = grayPretestReport.checks.find((item) => item.id === id);
  if (check?.status !== 'passed') {
    throw new Error(`Expected ${id} to pass for the 70 Casebook: ${JSON.stringify(check)}`);
  }
}
if (grayPretestReport.checks.some((item) => item.id === 'local_managed_restart_capability')) {
  throw new Error('70 Casebook已剔除受管重启Case，pretest不得继续要求restart-command。');
}
if (grayPretestReport.runtime?.fixture_capabilities?.native_ime?.probe_ok !== true) {
  throw new Error('70 pretest must persist the successful non-mutating native IME probe.');
}

console.log('core beta pretest ok');
