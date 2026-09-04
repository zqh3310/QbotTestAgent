import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  QWORK_MR1552_FAILURE_IDS,
  QWORK_MR1552_MERGE_COMMIT_SHA,
  QWORK_MR1559_EXECUTION_RUNNER_SUCCESSOR_ID,
  QWORK_MR1559_MERGE_COMMIT_SHA,
  QWORK_MR1559_SUCCESSOR_PROTECTED_PATHS,
  QWORK_RELEASE_BLOCKING_RISK_APPLICABILITY,
  QWORK_RELEASE_BLOCKING_RISK_PROTECTED_PATHS,
  auditQworkReleaseBlockingRisk,
  validateQworkReleaseBlockingRisksForReport,
} from '../src/lib/qwork-release-blocking-risks.mjs';
import { sha256Text, stableJson, writeQworkReleaseIntake } from '../src/lib/qwork-release-intake.mjs';

const CURRENT_RELEASE_HEAD = '90063782129701951edd90a9df8cf6145f1de425';

const badController = `
function terminalFor(start, code) {
  return { ...start, operation: 'execution.terminal', deadlineAt: Date.now() + 30000, payload: { code } };
}
runner.on('message', (runnerMessage) => {
  if (runnerMessage?.operation === 'worker.pressure') {
    runnerPressure.set(requestId, runnerMessage.payload);
    return;
  }
  process.parentPort.postMessage(runnerMessage);
});
runner.on('exit', (exitCode) => {
  if (state.settled) return;
  state.settled = true;
  if (exitCode !== 0) process.parentPort.postMessage(terminalFor(startMessage, 'execution_worker_runner_exit'));
});
`;

const fixedController = `
function terminalFor(start, code) {
  return { ...start, operation: 'execution.terminal', deadlineAt: Date.now() + 30000, payload: { code } };
}
runner.on('message', (runnerMessage) => {
  let validatedRunnerMessage;
  try {
    validatedRunnerMessage = validateEnvelope(runnerMessage, { direction: 'worker-to-host' });
  } catch (error) {
    process.parentPort.postMessage(terminalFor(startMessage, 'execution_worker_runner_protocol_error'));
    void runner.terminate();
    return;
  }
  if (validatedRunnerMessage?.operation === 'worker.pressure') {
    process.parentPort.postMessage({ ...validatedRunnerMessage, operation: 'worker.pressure' });
    return;
  }
  process.parentPort.postMessage(validatedRunnerMessage);
});
runner.on('exit', (exitCode) => {
  if (state.settled) return;
  state.settled = true;
  process.parentPort.postMessage(terminalFor(startMessage,
    exitCode === 0 ? 'execution_worker_runner_clean_exit_without_terminal' : 'execution_worker_runner_exit'));
});
`;

const badSupervisor = `
function executionWorkerPressureFromMessage(message, currentPressure) {
  if (message.operation === 'worker.heartbeat') return currentPressure;
  if (message.operation !== 'worker.pressure') return null;
  return message.payload;
}
const onMessage = (raw) => {
  let message;
  try { message = validateEnvelope(raw, { direction: 'worker-to-host' }); }
  catch (error) { child?.kill?.(); return; }
  const nextPressure = executionWorkerPressureFromMessage(message, pressure);
  if (nextPressure) pressure = nextPressure;
};
`;

const fixedSupervisor = badSupervisor.replace("catch (error) { child?.kill?.(); return; }", "catch (error) { logger.error(error); return; }");

function files(controller = badController, supervisor = badSupervisor) {
  const byPath = new Map([
    ['electron/execution-worker.cjs', controller],
    ['electron/host-core/agent/execution-worker-supervisor.cjs', supervisor],
  ]);
  return QWORK_RELEASE_BLOCKING_RISK_PROTECTED_PATHS.map((filePath) => ({
    path: filePath,
    source: byPath.get(filePath) || `// observed current release source: ${filePath}\n`,
  }));
}

function ancestry(releaseHead = CURRENT_RELEASE_HEAD) {
  return {
    source: 'gitlab-api-compare-first-parent',
    verified: true,
    first_parent_complete: true,
    compare_from: QWORK_MR1552_MERGE_COMMIT_SHA,
    compare_to: releaseHead,
    compare_commit_count: 1,
    reason: '',
  };
}

function releaseBeforeAncestry(releaseHead, laterMergeCommitSha) {
  return {
    source: 'gitlab-api-compare-first-parent',
    verified: true,
    first_parent_complete: true,
    compare_from: releaseHead,
    compare_to: laterMergeCommitSha,
    compare_commit_count: 1,
    reason: '',
  };
}

function beforeSuccessorAncestry(releaseHead = CURRENT_RELEASE_HEAD) {
  return releaseBeforeAncestry(releaseHead, QWORK_MR1559_MERGE_COMMIT_SHA);
}

function successorAncestry(releaseHead = QWORK_MR1559_MERGE_COMMIT_SHA) {
  return {
    source: releaseHead === QWORK_MR1559_MERGE_COMMIT_SHA
      ? 'release-head-is-origin-merge'
      : 'gitlab-api-compare-first-parent',
    verified: true,
    first_parent_complete: true,
    compare_from: QWORK_MR1559_MERGE_COMMIT_SHA,
    compare_to: releaseHead,
    compare_commit_count: 1,
    reason: '',
  };
}

const successorEntry = `
// Stable signed entry for one accepted QWork execution utilityProcess.
require('./host-core/agent/execution-worker-entry.cjs');
`;

const successorManager = `
async function acquire(operation, identity, options) {
  const requestId = identity.requestId;
  if (executions.size >= maxConcurrentExecutions) {
    const error = new Error('execution worker admission is closed');
    error.code = 'execution_worker_pressure_admission_closed';
    throw error;
  }
  const supervisor = supervisorFactory({ maxPendingRequests: 1, maxRestarts: 0 });
  const record = { supervisor };
  executions.set(requestId, record);
  return {
    supervisor,
    release: async () => {
      executions.delete(requestId);
      await supervisor.stop();
    },
  };
}
`;

const successorSupervisor = `
function rejectPending(error) { return error; }
function executionWorkerExitFailure(code, signal) { return { code, signal }; }
const onExit = (code, signal) => {
  rejectPending(executionWorkerExitFailure(code, signal));
};
`;

const successorDesktopHost = `
executionWorkerLease = await executionWorkerManager.acquire('execution.start', identity, { signal });
supervisor = executionWorkerLease.supervisor;
try { await supervisor.request(); } finally { await executionWorkerLease?.release?.(); }
`;

function successorFiles(overrides = new Map()) {
  const byPath = new Map([
    ['electron/execution-worker.cjs', successorEntry],
    ['electron/host-core/agent/execution-worker-manager.cjs', successorManager],
    ['electron/host-core/agent/execution-worker-supervisor.cjs', successorSupervisor],
    ['electron/host-core/agent/desktop-host-context.cjs', successorDesktopHost],
    ...overrides,
  ]);
  return QWORK_MR1559_SUCCESSOR_PROTECTED_PATHS.map((filePath) => ({
    path: filePath,
    source: byPath.get(filePath) || `// observed current release source: ${filePath}\n`,
  }));
}

function rehashRisk(risk) {
  const value = structuredClone(risk);
  delete value.attestation_sha256;
  risk.attestation_sha256 = sha256Text(stableJson(value));
}

function reportFor(risk) {
  const reportRisk = structuredClone(risk);
  const unresolved = [
    ...reportRisk.failure_ids,
    ...reportRisk.evidence_failures,
  ].map((failure) => `${reportRisk.risk_id}:${failure}`);
  return {
    decision: unresolved.length ? 'BLOCKED' : 'READY',
    release: { head: reportRisk.release_head },
    policy: { api_freshness: { blocking_risks_verified: unresolved.length === 0 } },
    blocking_risks: [reportRisk],
    summary: {
      blocking_risk_count: 1,
      blocking_risk_applicable_count: reportRisk.applicable ? 1 : 0,
      blocking_risk_verified_count: reportRisk.verified ? 1 : 0,
      blocking_risk_failure_count: unresolved.length,
    },
    unresolved: { blocking_risk_failures: unresolved },
  };
}

test('MR !1552 current release source fails all three stable P1 risk IDs', () => {
  const risk = auditQworkReleaseBlockingRisk({
    releaseHead: CURRENT_RELEASE_HEAD,
    originAncestry: ancestry(),
    releaseBeforeSuccessorAncestry: beforeSuccessorAncestry(),
    files: files(),
  });
  assert.equal(risk.applicable, true);
  assert.equal(risk.status, 'BLOCKED');
  assert.equal(risk.verified, false);
  assert.deepEqual(risk.failure_ids, QWORK_MR1552_FAILURE_IDS);
  assert.deepEqual(risk.evidence_failures, []);
  assert.equal(validateQworkReleaseBlockingRisksForReport(reportFor(risk)).ok, true);
});

test('equivalent fixed source verifies every MR !1552 blocking risk', () => {
  const risk = auditQworkReleaseBlockingRisk({
    releaseHead: CURRENT_RELEASE_HEAD,
    originAncestry: ancestry(),
    releaseBeforeSuccessorAncestry: beforeSuccessorAncestry(),
    files: files(fixedController, fixedSupervisor),
  });
  assert.equal(risk.status, 'VERIFIED');
  assert.equal(risk.verified, true);
  assert.deepEqual(risk.failure_ids, []);
  assert.equal(validateQworkReleaseBlockingRisksForReport(reportFor(risk)).ok, true);
});

test('MR !1559 exact release head switches to per-turn utilityProcess assertions', () => {
  const risk = auditQworkReleaseBlockingRisk({
    releaseHead: QWORK_MR1559_MERGE_COMMIT_SHA,
    originAncestry: ancestry(QWORK_MR1559_MERGE_COMMIT_SHA),
    successorAncestry: successorAncestry(),
    files: successorFiles(),
  });
  assert.equal(risk.status, 'VERIFIED');
  assert.equal(risk.architecture, 'per-turn-utility-process/v1');
  assert.equal(risk.architecture_activation_source, 'release-head-is-mr-1559-merge');
  assert.equal(risk.assertion_owner.contract_id, QWORK_MR1559_EXECUTION_RUNNER_SUCCESSOR_ID);
  assert.deepEqual(risk.protected_paths, QWORK_MR1559_SUCCESSOR_PROTECTED_PATHS);
  assert.equal(risk.test_execution_attested, false);
  assert.equal(validateQworkReleaseBlockingRisksForReport(reportFor(risk)).ok, true);
});

for (const [name, filePath, source, expected] of [
  ['clean exit', 'electron/host-core/agent/execution-worker-supervisor.cjs', 'function rejectPending() {}\n', QWORK_MR1552_FAILURE_IDS[0]],
  ['pressure admission', 'electron/host-core/agent/execution-worker-manager.cjs', successorManager.replace('maxPendingRequests: 1', 'maxPendingRequests: 2'), QWORK_MR1552_FAILURE_IDS[1]],
  ['message isolation', 'electron/execution-worker.cjs', `${successorEntry}\nconst runners = new Map();\n`, QWORK_MR1552_FAILURE_IDS[2]],
]) {
  test(`MR !1559 ${name} regression retains its stable blocking risk ID`, () => {
    const risk = auditQworkReleaseBlockingRisk({
      releaseHead: QWORK_MR1559_MERGE_COMMIT_SHA,
      originAncestry: ancestry(QWORK_MR1559_MERGE_COMMIT_SHA),
      successorAncestry: successorAncestry(),
      files: successorFiles(new Map([[filePath, source]])),
    });
    assert.deepEqual(risk.failure_ids, [expected]);
  });
}

test('MR !1559 assertions fail closed when successor relationship is not proven', () => {
  for (const successor of [
    {},
    { ...successorAncestry(CURRENT_RELEASE_HEAD), first_parent_complete: false },
    { ...successorAncestry(CURRENT_RELEASE_HEAD), compare_from: 'f'.repeat(40) },
    { ...successorAncestry(CURRENT_RELEASE_HEAD), compare_to: 'e'.repeat(40) },
    { ...successorAncestry(CURRENT_RELEASE_HEAD), source: 'mr-title-match' },
  ]) {
    const risk = auditQworkReleaseBlockingRisk({
      releaseHead: CURRENT_RELEASE_HEAD,
      originAncestry: ancestry(),
      successorAncestry: successor,
      files: files(fixedController, fixedSupervisor),
    });
    assert.equal(risk.architecture, 'unknown');
    assert.equal(risk.assertion_owner, null);
    assert.equal(risk.successor_applicability, QWORK_RELEASE_BLOCKING_RISK_APPLICABILITY.UNKNOWN);
    assert.equal(risk.status, 'BLOCKED');
    assert.deepEqual(risk.evidence_failures, ['successor_ancestry_unknown']);
  }
});

test('verified release-before-successor ancestry selects legacy MR !1552 assertions', () => {
  const risk = auditQworkReleaseBlockingRisk({
    releaseHead: CURRENT_RELEASE_HEAD,
    originAncestry: ancestry(),
    releaseBeforeSuccessorAncestry: beforeSuccessorAncestry(),
    files: files(fixedController, fixedSupervisor),
  });
  assert.equal(risk.architecture, 'shared-worker-registry/v1');
  assert.equal(risk.assertion_owner.mr_iid, '1552');
  assert.equal(risk.successor_applicability, QWORK_RELEASE_BLOCKING_RISK_APPLICABILITY.VERIFIED_NOT_APPLICABLE);
  assert.equal(risk.status, 'VERIFIED');
});

for (const [name, controller, supervisor, expected] of [
  ['clean exit', fixedController.replace(
    "process.parentPort.postMessage(terminalFor(startMessage,\n    exitCode === 0 ? 'execution_worker_runner_clean_exit_without_terminal' : 'execution_worker_runner_exit'));",
    "if (exitCode !== 0) process.parentPort.postMessage(terminalFor(startMessage, 'execution_worker_runner_exit'));",
  ), fixedSupervisor, QWORK_MR1552_FAILURE_IDS[0]],
  ['pressure admission', fixedController.replace(
    "process.parentPort.postMessage({ ...validatedRunnerMessage, operation: 'worker.pressure' });",
    'runnerPressure.set(requestId, validatedRunnerMessage.payload);',
  ), fixedSupervisor, QWORK_MR1552_FAILURE_IDS[1]],
  ['message isolation', fixedController.replace(
    "validatedRunnerMessage = validateEnvelope(runnerMessage, { direction: 'worker-to-host' });",
    'validatedRunnerMessage = runnerMessage;',
  ), badSupervisor, QWORK_MR1552_FAILURE_IDS[2]],
]) {
  test(`only ${name} regression emits its stable failure ID`, () => {
    const risk = auditQworkReleaseBlockingRisk({
      releaseHead: CURRENT_RELEASE_HEAD,
      originAncestry: ancestry(),
      releaseBeforeSuccessorAncestry: beforeSuccessorAncestry(),
      files: files(controller, supervisor),
    });
    assert.deepEqual(risk.failure_ids, [expected]);
  });
}

test('only verified release-before-origin ancestry is not applicable', () => {
  const oldHead = '1'.repeat(40);
  const risk = auditQworkReleaseBlockingRisk({
    releaseHead: oldHead,
    releaseBeforeOriginAncestry: releaseBeforeAncestry(oldHead, QWORK_MR1552_MERGE_COMMIT_SHA),
    files: [],
  });
  assert.equal(risk.applicability, QWORK_RELEASE_BLOCKING_RISK_APPLICABILITY.VERIFIED_NOT_APPLICABLE);
  assert.equal(risk.applicable, false);
  assert.equal(risk.status, 'NOT_APPLICABLE');
  assert.deepEqual(risk.failure_ids, []);
  const report = reportFor(risk);
  assert.equal(report.decision, 'READY');
  assert.equal(validateQworkReleaseBlockingRisksForReport(report).ok, true);
});

test('unknown or erroneous origin ancestry remains BLOCKED', () => {
  const oldHead = '1'.repeat(40);
  for (const [originAncestry, releaseBeforeOriginAncestry] of [
    [{}, {}],
    [{ ...ancestry(oldHead), verified: false, reason: 'api_timeout' }, {}],
    [{ ...ancestry(oldHead), first_parent_complete: false, reason: 'compare_timeout' }, {}],
    [{ ...ancestry(oldHead), compare_from: '2'.repeat(40) }, {}],
    [{}, { ...releaseBeforeAncestry(oldHead, QWORK_MR1552_MERGE_COMMIT_SHA), verified: false, reason: 'api_timeout' }],
    [{}, { ...releaseBeforeAncestry(oldHead, QWORK_MR1552_MERGE_COMMIT_SHA), compare_to: '3'.repeat(40) }],
  ]) {
    const risk = auditQworkReleaseBlockingRisk({
      releaseHead: oldHead,
      originAncestry,
      releaseBeforeOriginAncestry,
      files: [],
    });
    assert.equal(risk.applicability, QWORK_RELEASE_BLOCKING_RISK_APPLICABILITY.UNKNOWN);
    assert.equal(risk.applicable, null);
    assert.equal(risk.status, 'BLOCKED');
    assert.deepEqual(risk.evidence_failures, ['release_ancestry_unknown']);
    const report = reportFor(risk);
    assert.equal(report.decision, 'BLOCKED');
    assert.equal(validateQworkReleaseBlockingRisksForReport(report).ok, true);
  }
});

test('conflicting forward and reverse ancestry proofs are UNKNOWN and BLOCKED', () => {
  const originConflict = auditQworkReleaseBlockingRisk({
    releaseHead: CURRENT_RELEASE_HEAD,
    originAncestry: ancestry(),
    releaseBeforeOriginAncestry: releaseBeforeAncestry(CURRENT_RELEASE_HEAD, QWORK_MR1552_MERGE_COMMIT_SHA),
    files: [],
  });
  assert.equal(originConflict.applicability, QWORK_RELEASE_BLOCKING_RISK_APPLICABILITY.UNKNOWN);
  assert.equal(originConflict.activation_source, 'conflicting-first-parent-ancestry');
  assert.equal(originConflict.status, 'BLOCKED');

  const successorConflict = auditQworkReleaseBlockingRisk({
    releaseHead: CURRENT_RELEASE_HEAD,
    originAncestry: ancestry(),
    successorAncestry: successorAncestry(CURRENT_RELEASE_HEAD),
    releaseBeforeSuccessorAncestry: beforeSuccessorAncestry(),
    files: files(),
  });
  assert.equal(successorConflict.successor_applicability, QWORK_RELEASE_BLOCKING_RISK_APPLICABILITY.UNKNOWN);
  assert.equal(successorConflict.architecture, 'unknown');
  assert.equal(successorConflict.status, 'BLOCKED');
});

test('intake accounting and attestation tampering are rejected fail-closed', () => {
  const risk = auditQworkReleaseBlockingRisk({
    releaseHead: CURRENT_RELEASE_HEAD,
    originAncestry: ancestry(),
    releaseBeforeSuccessorAncestry: beforeSuccessorAncestry(),
    files: files(),
  });
  const report = reportFor(risk);
  assert.equal(report.summary.blocking_risk_failure_count, 3);
  assert.equal(report.unresolved.blocking_risk_failures.length, 3);
  assert.equal(report.decision, 'BLOCKED');

  const forged = structuredClone(report);
  forged.blocking_risks[0].checks[0].passed = true;
  assert.equal(validateQworkReleaseBlockingRisksForReport(forged).failures.includes('blocking_risk_attestation_sha256_mismatch'), true);

  const countDrift = structuredClone(report);
  countDrift.summary.blocking_risk_failure_count = 2;
  assert.equal(validateQworkReleaseBlockingRisksForReport(countDrift).failures.includes('blocking_risk_summary_failure_count_mismatch'), true);

  const unresolvedDrift = structuredClone(report);
  unresolvedDrift.unresolved.blocking_risk_failures = [];
  assert.equal(validateQworkReleaseBlockingRisksForReport(unresolvedDrift).failures.includes('blocking_risk_unresolved_mismatch'), true);

  const successorRisk = auditQworkReleaseBlockingRisk({
    releaseHead: QWORK_MR1559_MERGE_COMMIT_SHA,
    originAncestry: ancestry(QWORK_MR1559_MERGE_COMMIT_SHA),
    successorAncestry: successorAncestry(),
    files: successorFiles(),
  });
  const ownerDrift = reportFor(successorRisk);
  ownerDrift.blocking_risks[0].assertion_owner.mr_iid = '1552';
  rehashRisk(ownerDrift.blocking_risks[0]);
  assert.equal(validateQworkReleaseBlockingRisksForReport(ownerDrift).failures.includes('blocking_risk_assertion_owner_mismatch'), true);

  const ancestryDrift = reportFor(successorRisk);
  ancestryDrift.blocking_risks[0].successor_ancestry.first_parent_complete = false;
  rehashRisk(ancestryDrift.blocking_risks[0]);
  assert.equal(validateQworkReleaseBlockingRisksForReport(ancestryDrift).failures.includes('blocking_risk_replay_mismatch'), true);

  const architectureDrift = reportFor(successorRisk);
  architectureDrift.blocking_risks[0].architecture = 'shared-worker-registry/v1';
  rehashRisk(architectureDrift.blocking_risks[0]);
  assert.equal(validateQworkReleaseBlockingRisksForReport(architectureDrift).failures.includes('blocking_risk_architecture_mismatch'), true);
});

test('recomputed self-hash cannot turn failing source into VERIFIED checks', () => {
  const blockedRisk = auditQworkReleaseBlockingRisk({
    releaseHead: CURRENT_RELEASE_HEAD,
    originAncestry: ancestry(),
    releaseBeforeSuccessorAncestry: beforeSuccessorAncestry(),
    files: files(),
  });
  const forgedRisk = structuredClone(blockedRisk);
  forgedRisk.checks = forgedRisk.checks.map((check) => ({ ...check, passed: true }));
  forgedRisk.failure_ids = [];
  forgedRisk.verified = true;
  forgedRisk.status = 'VERIFIED';
  rehashRisk(forgedRisk);
  const forgedReport = reportFor(forgedRisk);
  const validation = validateQworkReleaseBlockingRisksForReport(forgedReport);
  assert.equal(validation.ok, false);
  assert.equal(validation.failures.includes('blocking_risk_replay_mismatch'), true);
  assert.deepEqual(
    validation.unresolved_failures,
    QWORK_MR1552_FAILURE_IDS.map((failureId) => `${blockedRisk.risk_id}:${failureId}`),
  );
});

test('validator requires every normalized source byte evidence field and replays content', () => {
  const verifiedRisk = auditQworkReleaseBlockingRisk({
    releaseHead: QWORK_MR1559_MERGE_COMMIT_SHA,
    originAncestry: ancestry(QWORK_MR1559_MERGE_COMMIT_SHA),
    successorAncestry: successorAncestry(),
    files: successorFiles(),
  });
  const firstSource = verifiedRisk.source_files[0];
  assert.equal(firstSource.encoding, 'base64');
  assert.equal(Buffer.from(firstSource.content_base64, 'base64').length, firstSource.bytes);
  assert.match(firstSource.sha256, /^[a-f0-9]{64}$/u);
  assert.equal(validateQworkReleaseBlockingRisksForReport(reportFor(verifiedRisk)).ok, true);

  for (const field of [
    'path',
    'requested_ref',
    'ref',
    'commit_id',
    'blob_id',
    'last_commit_id',
    'encoding',
    'bytes',
    'sha256',
    'content_base64',
    'error',
  ]) {
    const missingField = structuredClone(verifiedRisk);
    delete missingField.source_files[0][field];
    rehashRisk(missingField);
    const validation = validateQworkReleaseBlockingRisksForReport(reportFor(missingField));
    assert.equal(validation.ok, false, `missing source_files.${field} must be rejected`);
    assert.equal(
      validation.failures.some((failure) => failure.includes('source_file') || failure === 'blocking_risk_replay_mismatch'),
      true,
      `missing source_files.${field} must fail source evidence validation`,
    );
  }

  for (const [field, value] of [
    ['path', 'electron/not-the-observed-file.cjs'],
    ['requested_ref', 'f'.repeat(40)],
    ['ref', 'f'.repeat(40)],
    ['commit_id', 'f'.repeat(40)],
    ['blob_id', 'f'.repeat(40)],
    ['last_commit_id', 'not-a-commit-id'],
    ['encoding', 'utf8'],
    ['bytes', firstSource.bytes + 1],
    ['sha256', 'f'.repeat(64)],
    ['content_base64', Buffer.from('forged source bytes', 'utf8').toString('base64')],
    ['error', 'forged read failure'],
  ]) {
    const tampered = structuredClone(verifiedRisk);
    tampered.source_files[0][field] = value;
    rehashRisk(tampered);
    const validation = validateQworkReleaseBlockingRisksForReport(reportFor(tampered));
    assert.equal(validation.ok, false, `tampered source_files.${field} must be rejected`);
  }

  const extraField = structuredClone(verifiedRisk);
  extraField.source_files[0].trusted = true;
  rehashRisk(extraField);
  assert.equal(validateQworkReleaseBlockingRisksForReport(reportFor(extraField)).ok, false);
});

test('intake Markdown preserves assertion observations and current-release source fingerprints', () => {
  const risk = auditQworkReleaseBlockingRisk({
    releaseHead: CURRENT_RELEASE_HEAD,
    originAncestry: ancestry(),
    releaseBeforeSuccessorAncestry: beforeSuccessorAncestry(),
    files: files(),
  });
  const report = reportFor(risk);
  Object.assign(report.release, { ref: 'origin/release/0.1' });
  report.scan_boundary = { mode: 'commit_ancestry', source: 'explicit_baseline_commit' };
  Object.assign(report.summary, {
    merge_request_count: 1,
    source_contract_verified_count: 0,
    source_contract_count: 0,
    direct_case_ids: [],
    dependency_case_ids: [],
  });
  Object.assign(report.unresolved, {
    unmapped_product_paths: [],
    unverified_mr_metadata: [],
    unattributed_direct_commits: [],
    source_contract_failures: [],
  });
  report.blockers = ['release 阻断风险审计未通过'];
  const outDir = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'qbot-blocking-risk-markdown-')), 'intake');
  try {
    const filesWritten = writeQworkReleaseIntake({ report, outDir });
    const markdown = fs.readFileSync(filesWritten.markdown, 'utf8');
    assert.match(markdown, /deepbankv2-mr-1552-execution-runner-isolation\/v1/u);
    for (const failureId of QWORK_MR1552_FAILURE_IDS) assert.match(markdown, new RegExp(failureId, 'u'));
    assert.match(markdown, /unsettled_exit_always_emits_terminal.*false/u);
    assert.match(markdown, new RegExp(risk.source_files[0].sha256, 'u'));
    assert.match(markdown, /不声称产品测试已执行/u);
  } finally {
    fs.rmSync(path.dirname(outDir), { recursive: true, force: true });
  }
});
