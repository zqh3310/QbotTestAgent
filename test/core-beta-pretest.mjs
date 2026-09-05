import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  QWORK_CORE_LIFELINE_CASE_IDS,
  QWORK_MR_SMOKE_CASE_IDS,
} from '../src/lib/qwork-release-test-plan.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const preflightSource = fs.readFileSync(
  path.join(root, 'scripts', 'preflight-core-beta-test-run.mjs'),
  'utf8',
);
if (!/let\s+casebookSha256\s*=\s*''/.test(preflightSource)
  || !/casebookSha256\s*=\s*sha256File\(casebook\)/.test(preflightSource)
  || !/validateQworkReleaseIntake\(releaseIntake,\s*\{[\s\S]*?casebookSha256,[\s\S]*?\}\);/.test(preflightSource)
  || /let\s+casebookSha\s*=/.test(preflightSource)) {
  throw new Error('Pretest must bind release intake to the computed Casebook SHA variable.');
}
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
if (!/16\/12\/70\/160 Casebook stage/.test(cliHelp.stdout)) throw new Error('CLI help must include the staged QWork release contract.');
for (const releaseOption of [
  '--control-plane-url',
  '--backend-version',
  '--prompt-policy-version',
  '--feature-flags-hash',
  '--qwork-ui-git-commit',
  '--qwork-build-id',
  '--qwork-release-manifest-sha256',
]) {
  if (!cliHelp.stdout.includes(releaseOption)) {
    throw new Error(`CLI help must expose production release option ${releaseOption}.`);
  }
}
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

const grayCasebook = path.join(root, 'PRD', 'QBot核心生命线与新增MR生产灰度全量回归Casebook_16-12-70-160条_2026-09-05-r14.xlsx');
const grayExpectedSha = '439f14686df4a1623015e3964b61a6943455c804938be2680a8d6fedde9bf2ed';
const grayActualSha = crypto.createHash('sha256').update(fs.readFileSync(grayCasebook)).digest('hex');
if (grayActualSha !== grayExpectedSha) {
  throw new Error(`70 Casebook SHA mismatch: expected=${grayExpectedSha} actual=${grayActualSha}`);
}
const coreAuditOut = path.join(temp, 'core16-audit');
const coreAudit = spawnSync(process.execPath, [
  path.join(root, 'scripts', 'audit-core-beta-execution-capabilities.mjs'),
  '--casebook', grayCasebook,
  '--sheet', '核心生命线门禁',
  '--out', coreAuditOut,
], { cwd: root, encoding: 'utf8' });
if (coreAudit.status !== 0) throw new Error(`16 capability audit failed: ${coreAudit.stderr || coreAudit.stdout}`);
const coreAuditReport = JSON.parse(fs.readFileSync(path.join(coreAuditOut, 'capability-audit.json'), 'utf8'));
const coreCases = JSON.parse(fs.readFileSync(path.join(coreAuditOut, 'casebook-cases.json'), 'utf8')).cases || [];
if (coreAuditReport.protocol.case_count !== 16
  || coreAuditReport.protocol.executable_count !== 16
  || coreAuditReport.runtime_dispatch?.dispatchable_count !== 16
  || coreAuditReport.capability_summary?.runner_native !== 11
  || coreAuditReport.capability_summary?.runner_legacy_verified !== 5
  || coreAuditReport.capability_summary?.strict_controller_required !== 0
  || coreAuditReport.capability_summary?.unsupported_runtime !== 0
  || coreAuditReport.capability_summary?.directly_runnable_without_controller !== 16
  || JSON.stringify(coreCases.map((item) => item.id)) !== JSON.stringify(QWORK_CORE_LIFELINE_CASE_IDS)) {
  throw new Error(`16 core lifeline capability contract mismatch: ${JSON.stringify(coreAuditReport)}`);
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
if (!fullCases.every((item) => String(item.version_scope || '').includes('0cfdfa1ec9f18d2ef2e78d380b4b2896c6dc607c'))) {
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
const expectedMrSmokeIds = QWORK_MR_SMOKE_CASE_IDS;
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
if (!/\/api\/health\/ready/.test(pretestSource)
  || !/qwork_control_plane_health/.test(pretestSource)
  || !/qwork_backend_identity/.test(pretestSource)
  || !/body\?\.checks\?\.db === true/.test(pretestSource)
  || !/body\?\.checks\?\.auth === true/.test(pretestSource)
  || !/observedBackendVersion === expectedBackendVersion/.test(pretestSource)) {
  throw new Error('Teams pretest must bind ready SIT health, DB/auth checks and the health fingerprint to backend-version.');
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
for (const requiredIdentityInput of [
  'expected-teams-version',
  'expected-teams-build',
  'expected-qwork-version',
  'expected-control-plane-origin',
  'backend-version',
  'prompt-policy-version',
  'feature-flags-hash',
  'qwork-ui-git-commit',
  'qwork-build-id',
  'qwork-release-manifest-sha256',
]) {
  if (!pretestSource.includes(`'${requiredIdentityInput}'`)
    && !pretestSource.includes(`--${requiredIdentityInput}`)) {
    throw new Error(`Production pretest must freeze ${requiredIdentityInput}.`);
  }
}
if (!/case_ids:\s*cases\.map\(\(testCase\)\s*=>\s*testCase\.id\)/.test(pretestSource)) {
  throw new Error('Pretest report must freeze the exact ordered Case IDs.');
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
  'scripts/orchestrate-qwork-release-test.mjs',
  'src/lib/core-beta-fixture-controller.mjs',
  'src/lib/qwork-release-test-plan.mjs',
  'test/core-beta-pretest.mjs',
  'test/core-beta-fixture-controller.mjs',
  'test/qwork-release-test-plan.test.mjs',
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
