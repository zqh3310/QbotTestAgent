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
function managerError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}
function waitForExecutionSlot(manager, requestId) {
  if (manager.executions.size >= manager.maxConcurrentExecutions) {
    return Promise.reject(managerError('execution_worker_pressure_admission_closed', 'queue full'));
  }
  return Promise.resolve(true);
}
async function acquireExecutionWorker(manager, operation, identity, options) {
  const requestId = identity.requestId;
  await waitForExecutionSlot(manager, requestId);
  const supervisor = manager.supervisorFactory({ maxPendingRequests: 1, maxRestarts: 0 });
  const record = { supervisor };
  manager.executions.set(requestId, record);
  const release = async () => {
    manager.executions.delete(requestId);
    await supervisor.stop();
  };
  return { supervisor, release };
}
function createExecutionWorkerManager(manager) {
  return { acquire: (operation, identity, options) => acquireExecutionWorker(manager, operation, identity, options) };
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
async function runAgentInExecutionWorker(identity, signal) {
  let executionWorkerLease = null;
  try {
    executionWorkerLease = await executionWorkerManager.acquire('execution.start', identity, { signal });
    const supervisor = executionWorkerLease.supervisor;
    await supervisor.request();
  } finally {
    await executionWorkerLease?.release?.();
  }
}
`;

const delegatedSuccessorManager = `
function managerError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}
function validateAcquisition(manager, identity) {
  const requestId = String(identity?.requestId || '').trim();
  if (!requestId) throw managerError('execution_worker_identity_missing', 'requestId is required');
  return requestId;
}
function waitForExecutionSlot(manager, requestId, signal) {
  if (manager.executions.size >= manager.maxConcurrentExecutions) {
    return Promise.reject(managerError('execution_worker_pressure_admission_closed', 'queue full'));
  }
  return Promise.resolve(true);
}
function stopExecutionRecord(manager, requestId, record) {
  return Promise.resolve().then(() => record.supervisor.stop());
}
function releaseExecutionRecord(manager, requestId, record) {
  if (record.released) return record.stopPromise;
  record.released = true;
  manager.executions.delete(requestId);
  return stopExecutionRecord(manager, requestId, record);
}
function drainExecutionRecord(manager, requestId, record, settlement) {
  manager.executions.delete(requestId);
  return Promise.resolve(settlement).then(() => stopExecutionRecord(manager, requestId, record));
}
function executionWorkerLease(manager, requestId, record) {
  return Object.freeze({
    drain: (settlement) => drainExecutionRecord(manager, requestId, record, settlement),
    release: () => releaseExecutionRecord(manager, requestId, record),
    supervisor: record.supervisor,
  });
}
function createExecutionRecord(supervisor) {
  return { released: false, stopPromise: null, supervisor };
}
function createExecutionSupervisor(manager) {
  return manager.supervisorFactory({
    ...manager.supervisorOptions,
    maxPendingRequests: 1,
    maxRestarts: 0,
  });
}
async function acquireExecutionWorker(manager, authority, identity, options = {}) {
  const requestId = validateAcquisition(manager, identity);
  await waitForExecutionSlot(manager, requestId, options.signal);
  const supervisor = createExecutionSupervisor(manager);
  const record = createExecutionRecord(supervisor);
  manager.executions.set(requestId, record);
  return executionWorkerLease(manager, requestId, record);
}
function createExecutionWorkerManager() {
  const manager = { executions: new Map(), maxConcurrentExecutions: 16, supervisorOptions: {} };
  return Object.freeze({
    acquire: (authority, identity, options) => acquireExecutionWorker(manager, authority, identity, options),
  });
}
`;

const successorContextUsage = `
const { createExecutionWorkerContextUsageLease } = require('./execution-worker-context-usage-lease.cjs');
module.exports = { createExecutionWorkerContextUsageLease };
`;

const successorContextUsageLease = `
function createExecutionWorkerContextUsageLease() {
  const release = async (executionWorkerLease, completed = false) => {
    if (!executionWorkerLease) return;
    if (completed) {
      executionWorkerLease.drain(Promise.resolve(), { timeoutMs: 1 });
      return;
    }
    await executionWorkerLease.release();
  };
  return Object.freeze({ release });
}
module.exports = { createExecutionWorkerContextUsageLease };
`;

const delegatedSuccessorDesktopHost = `
const { createExecutionWorkerContextUsageLease } = require('./execution-worker-context-usage.cjs');
async function runAgentInExecutionWorker(supervisor, identity, signal) {
  if (!supervisor || supervisor.enabled !== true) throw new Error('execution worker unavailable');
  let executionWorkerLease = null;
  const contextUsageLease = createExecutionWorkerContextUsageLease({ timeoutMs: 1000 });
  try {
    executionWorkerLease = await supervisor.acquire('execution.start', identity, { signal });
    await executionWorkerLease.supervisor.request();
  } finally {
    await contextUsageLease.release(executionWorkerLease);
  }
}
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

function successorRisk(overrides = new Map()) {
  return auditQworkReleaseBlockingRisk({
    releaseHead: QWORK_MR1559_MERGE_COMMIT_SHA,
    originAncestry: ancestry(QWORK_MR1559_MERGE_COMMIT_SHA),
    successorAncestry: successorAncestry(),
    files: successorFiles(overrides),
  });
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

test('MR !1559 comments, strings and regex literals cannot satisfy any blocking-risk assertion', () => {
  const decoys = new Map([
    ['electron/execution-worker.cjs', `
      // require('./host-core/agent/execution-worker-entry.cjs');
      const entryText = "require('./host-core/agent/execution-worker-entry.cjs')";
      const entryPattern = /require\\(['"]\\.\\/host-core\\/agent\\/execution-worker-entry\\.cjs/;
    `],
    ['electron/host-core/agent/execution-worker-manager.cjs', `
      /* if (full) { error.code = 'execution_worker_pressure_admission_closed'; throw error; } */
      const policyText = 'supervisorFactory({ maxPendingRequests: 1, maxRestarts: 0 })';
      const leaseText = 'executions.set(requestId, record); executions.delete(requestId); await supervisor.stop()';
    `],
    ['electron/host-core/agent/execution-worker-supervisor.cjs', `
      // const onExit = () => rejectPending(executionWorkerExitFailure());
      const exitText = 'rejectPending(executionWorkerExitFailure(code, signal))';
      const exitPattern = /rejectPending\\(executionWorkerExitFailure/;
    `],
    ['electron/host-core/agent/desktop-host-context.cjs', `
      const hostText = 'executionWorkerLease = await manager.acquire(); finally await executionWorkerLease.release()';
    `],
  ]);
  const risk = auditQworkReleaseBlockingRisk({
    releaseHead: QWORK_MR1559_MERGE_COMMIT_SHA,
    originAncestry: ancestry(QWORK_MR1559_MERGE_COMMIT_SHA),
    successorAncestry: successorAncestry(),
    files: successorFiles(decoys),
  });
  assert.deepEqual(risk.failure_ids, QWORK_MR1552_FAILURE_IDS);
});

test('MR !1559 executable template interpolation cannot hide a shared Worker', () => {
  const interpolatedWorkerEntry = `${successorEntry}\nconst marker = \`worker-\${new Worker('./shared-worker.cjs')}\`;\n`;
  const risk = auditQworkReleaseBlockingRisk({
    releaseHead: QWORK_MR1559_MERGE_COMMIT_SHA,
    originAncestry: ancestry(QWORK_MR1559_MERGE_COMMIT_SHA),
    successorAncestry: successorAncestry(),
    files: successorFiles(new Map([
      ['electron/execution-worker.cjs', interpolatedWorkerEntry],
    ])),
  });
  assert.deepEqual(risk.failure_ids, [QWORK_MR1552_FAILURE_IDS[2]]);
});

test('MR !1559 pressure assertions in statically false branches remain unreachable', () => {
  for (const falseCondition of ['false', '0']) {
    const unreachablePressureManager = successorManager.replace(
      'manager.executions.size >= manager.maxConcurrentExecutions',
      falseCondition,
    );
    const risk = auditQworkReleaseBlockingRisk({
      releaseHead: QWORK_MR1559_MERGE_COMMIT_SHA,
      originAncestry: ancestry(QWORK_MR1559_MERGE_COMMIT_SHA),
      successorAncestry: successorAncestry(),
      files: successorFiles(new Map([
        ['electron/host-core/agent/execution-worker-manager.cjs', unreachablePressureManager],
      ])),
    });
    assert.deepEqual(risk.failure_ids, [QWORK_MR1552_FAILURE_IDS[1]], falseCondition);
  }
});

test('MR !1559 typed exit assertions after an unconditional terminator remain unreachable', () => {
  for (const terminator of ['return;', "throw new Error('already terminated');"]) {
    const unreachableExitSupervisor = `
      function rejectPending(error) { return error; }
      function executionWorkerExitFailure(code, signal) { return { code, signal }; }
      const onExit = (code, signal) => {
        ${terminator}
        rejectPending(executionWorkerExitFailure(code, signal));
      };
    `;
    const risk = auditQworkReleaseBlockingRisk({
      releaseHead: QWORK_MR1559_MERGE_COMMIT_SHA,
      originAncestry: ancestry(QWORK_MR1559_MERGE_COMMIT_SHA),
      successorAncestry: successorAncestry(),
      files: successorFiles(new Map([
        ['electron/host-core/agent/execution-worker-supervisor.cjs', unreachableExitSupervisor],
      ])),
    });
    assert.deepEqual(risk.failure_ids, [QWORK_MR1552_FAILURE_IDS[0]], terminator);
  }
});

test('MR !1559 typed exit calls in the wrong function scope do not satisfy onExit', () => {
  const wrongScopedSupervisor = `
    const onExit = () => { logger.info('worker exited'); };
    function unrelatedCleanup(code, signal) {
      rejectPending(executionWorkerExitFailure(code, signal));
    }
  `;
  const risk = auditQworkReleaseBlockingRisk({
    releaseHead: QWORK_MR1559_MERGE_COMMIT_SHA,
    originAncestry: ancestry(QWORK_MR1559_MERGE_COMMIT_SHA),
    successorAncestry: successorAncestry(),
    files: successorFiles(new Map([
      ['electron/host-core/agent/execution-worker-supervisor.cjs', wrongScopedSupervisor],
    ])),
  });
  assert.deepEqual(risk.failure_ids, [QWORK_MR1552_FAILURE_IDS[0]]);
});

test('MR !1559 pressure helper must be reachable from the acquisition implementation', () => {
  const disconnectedManager = successorManager.replace(
    'await waitForExecutionSlot(manager, requestId);',
    'await Promise.resolve(true);',
  );
  const risk = auditQworkReleaseBlockingRisk({
    releaseHead: QWORK_MR1559_MERGE_COMMIT_SHA,
    originAncestry: ancestry(QWORK_MR1559_MERGE_COMMIT_SHA),
    successorAncestry: successorAncestry(),
    files: successorFiles(new Map([
      ['electron/host-core/agent/execution-worker-manager.cjs', disconnectedManager],
    ])),
  });
  assert.deepEqual(risk.failure_ids, [QWORK_MR1552_FAILURE_IDS[1]]);
});

test('MR !1559 acquire and release tokens in different try/finally scopes do not satisfy host isolation', () => {
  const splitDesktopHost = `
    async function acquireOnly(identity) {
      let executionWorkerLease = null;
      try {
        executionWorkerLease = await executionWorkerManager.acquire('execution.start', identity);
        await executionWorkerLease.supervisor.request();
      } finally {
        await unrelatedCleanup();
      }
    }
    async function releaseOnly() {
      try {
        await unrelatedWork();
      } finally {
        await executionWorkerLease?.release?.();
      }
    }
  `;
  const risk = auditQworkReleaseBlockingRisk({
    releaseHead: QWORK_MR1559_MERGE_COMMIT_SHA,
    originAncestry: ancestry(QWORK_MR1559_MERGE_COMMIT_SHA),
    successorAncestry: successorAncestry(),
    files: successorFiles(new Map([
      ['electron/host-core/agent/desktop-host-context.cjs', splitDesktopHost],
    ])),
  });
  assert.deepEqual(risk.failure_ids, [QWORK_MR1552_FAILURE_IDS[2]]);
});

test('MR !1559 manager audit binds the acquire implementation exported by createExecutionWorkerManager', () => {
  const managerWithUnexportedDecoy = `${successorManager.replace(
    'function createExecutionWorkerManager(manager) {\n  return { acquire: (operation, identity, options) => acquireExecutionWorker(manager, operation, identity, options) };\n}',
    `async function acquireReturnedByManager(manager, operation, identity, options) {
      return { release: async () => {}, supervisor: null };
    }
    function createExecutionWorkerManager(manager) {
      return { acquire: (operation, identity, options) => acquireReturnedByManager(manager, operation, identity, options) };
    }`,
  )}`;
  const risk = successorRisk(new Map([
    ['electron/host-core/agent/execution-worker-manager.cjs', managerWithUnexportedDecoy],
  ]));
  assert.equal(risk.status, 'BLOCKED');
  assert.equal(risk.failure_ids.includes(QWORK_MR1552_FAILURE_IDS[1]), true);
  assert.equal(risk.failure_ids.includes(QWORK_MR1552_FAILURE_IDS[2]), true);
});

test('MR !1559 acquire delegation must directly return the helper with its captured manager', () => {
  const acquireDelegate = 'acquire: (operation, identity, options) => acquireExecutionWorker(manager, operation, identity, options)';
  for (const replacement of [
    'acquire: (operation, identity, options) => acquireExecutionWorker(unrelatedManager, operation, identity, options)',
    'acquire: (operation, identity, options) => enabled && acquireExecutionWorker(manager, operation, identity, options)',
    'acquire: (operation, identity, options) => enabled ? acquireExecutionWorker(manager, operation, identity, options) : null',
    `acquire: (operation, identity, options) => {
      switch (mode) {
        case 'enabled': return acquireExecutionWorker(manager, operation, identity, options);
        default: return null;
      }
    }`,
  ]) {
    const risk = successorRisk(new Map([
      ['electron/host-core/agent/execution-worker-manager.cjs', successorManager.replace(
        acquireDelegate,
        replacement,
      )],
    ]));
    assert.equal(risk.status, 'BLOCKED', replacement);
    assert.equal(risk.failure_ids.includes(QWORK_MR1552_FAILURE_IDS[2]), true, replacement);
  }
});

test('MR !1559 request index must derive from the current acquisition identity', () => {
  const wrongRequestIdManager = successorManager.replace(
    'const requestId = identity.requestId;',
    'const requestId = unrelatedIdentity.requestId;',
  );
  const risk = successorRisk(new Map([
    ['electron/host-core/agent/execution-worker-manager.cjs', wrongRequestIdManager],
  ]));
  assert.equal(risk.status, 'BLOCKED');
  assert.equal(risk.failure_ids.includes(QWORK_MR1552_FAILURE_IDS[2]), true);
});

test('MR !1559 requestId derivation rejects mixed fallback sources', () => {
  for (const expression of [
    'otherRequestId || identity.requestId',
    'identity.requestId || otherRequestId',
  ]) {
    const risk = successorRisk(new Map([
      ['electron/host-core/agent/execution-worker-manager.cjs', successorManager.replace(
        'identity.requestId',
        expression,
      )],
    ]));
    assert.equal(risk.status, 'BLOCKED', expression);
    assert.equal(risk.failure_ids.includes(QWORK_MR1552_FAILURE_IDS[2]), true, expression);
  }
});

test('MR !1559 supervisor policy requires unique effective top-level values without later overrides', () => {
  for (const policy of [
    '{ maxPendingRequests: 9, nested: { maxPendingRequests: 1, maxRestarts: 0 }, maxRestarts: 8 }',
    '{ maxPendingRequests: 1, maxRestarts: 0, ...unsafePolicyOverride }',
    "{ maxPendingRequests: 1, maxRestarts: 0, ['maxPendingRequests']: 9 }",
    '{ maxPendingRequests: 1, maxRestarts: 0, [dynamicPolicyKey]: 9 }',
  ]) {
    const wrongPolicyManager = successorManager.replace(
      '{ maxPendingRequests: 1, maxRestarts: 0 }',
      policy,
    );
    const risk = successorRisk(new Map([
      ['electron/host-core/agent/execution-worker-manager.cjs', wrongPolicyManager],
    ]));
    assert.equal(risk.status, 'BLOCKED', policy);
    assert.equal(risk.failure_ids.includes(QWORK_MR1552_FAILURE_IDS[1]), true, policy);
  }
});

test('MR !1559 delete and stop in mutually exclusive release branches do not satisfy isolation', () => {
  const mutuallyExclusiveRelease = successorManager.replace(
    `const release = async () => {
    manager.executions.delete(requestId);
    await supervisor.stop();
  };`,
    `const release = async () => {
      if (deleteOnly) manager.executions.delete(requestId);
      else await supervisor.stop();
    };`,
  );
  const risk = successorRisk(new Map([
    ['electron/host-core/agent/execution-worker-manager.cjs', mutuallyExclusiveRelease],
  ]));
  assert.equal(risk.status, 'BLOCKED');
  assert.equal(risk.failure_ids.includes(QWORK_MR1552_FAILURE_IDS[2]), true);
});

test('MR !1559 release delete and stop must not be hidden in conditional expressions or switch cases', () => {
  const releaseBody = `const release = async () => {
    manager.executions.delete(requestId);
    await supervisor.stop();
  };`;
  for (const replacement of [
    `const release = async () => {
      enabled && manager.executions.delete(requestId);
      await supervisor.stop();
    };`,
    `const release = async () => {
      enabled ? manager.executions.delete(requestId) : noOp();
      await supervisor.stop();
    };`,
    `const release = async () => {
      manager.executions.delete(requestId);
      switch (mode) {
        case 'stop': await supervisor.stop(); break;
        default: break;
      }
    };`,
  ]) {
    const risk = successorRisk(new Map([
      ['electron/host-core/agent/execution-worker-manager.cjs', successorManager.replace(
        releaseBody,
        replacement,
      )],
    ]));
    assert.equal(risk.status, 'BLOCKED', replacement);
    assert.equal(risk.failure_ids.includes(QWORK_MR1552_FAILURE_IDS[2]), true, replacement);
  }
});

test('MR !1559 release promises must be awaited or returned through every delegated layer', () => {
  for (const source of [
    successorManager.replace('await supervisor.stop();', 'supervisor.stop();'),
    delegatedSuccessorManager.replace(
      'return Promise.resolve().then(() => record.supervisor.stop());',
      'record.supervisor.stop();\n  return Promise.resolve(false);',
    ),
    delegatedSuccessorManager.replace(
      'return stopExecutionRecord(manager, requestId, record);',
      'stopExecutionRecord(manager, requestId, record);\n  return Promise.resolve(false);',
    ),
    delegatedSuccessorManager.replace(
      'release: () => releaseExecutionRecord(manager, requestId, record),',
      'release: () => { releaseExecutionRecord(manager, requestId, record); },',
    ),
  ]) {
    const risk = successorRisk(new Map([
      ['electron/host-core/agent/execution-worker-manager.cjs', source],
    ]));
    assert.equal(risk.status, 'BLOCKED');
    assert.equal(risk.failure_ids.includes(QWORK_MR1552_FAILURE_IDS[2]), true);
  }
});

test('MR !1559 stop promise cannot be hidden by callback, comma, or logical expressions', () => {
  for (const replacement of [
    'return runCallback(() => record.supervisor.stop());',
    'return record.supervisor.stop(), Promise.resolve(false);',
    'return record.supervisor.stop() && Promise.resolve(false);',
    'return record.supervisor.stop() || Promise.resolve(false);',
  ]) {
    const source = delegatedSuccessorManager.replace(
      'return Promise.resolve().then(() => record.supervisor.stop());',
      replacement,
    );
    const risk = successorRisk(new Map([
      ['electron/host-core/agent/execution-worker-manager.cjs', source],
    ]));
    assert.equal(risk.status, 'BLOCKED', replacement);
    assert.equal(risk.failure_ids.includes(QWORK_MR1552_FAILURE_IDS[2]), true, replacement);
  }
});

test('MR !1559 creator manager binding must be unique and immutable before export', () => {
  const parameterRebound = successorManager.replace(
    'function createExecutionWorkerManager(manager) {\n  return',
    'function createExecutionWorkerManager(manager) {\n  manager = unrelatedManager;\n  return',
  );
  const localRebound = delegatedSuccessorManager.replace(
    'const manager = { executions: new Map(), maxConcurrentExecutions: 16, supervisorOptions: {} };',
    `let manager = { executions: new Map(), maxConcurrentExecutions: 16, supervisorOptions: {} };
  manager = unrelatedManager;`,
  );
  for (const source of [parameterRebound, localRebound]) {
    const risk = successorRisk(new Map([
      ['electron/host-core/agent/execution-worker-manager.cjs', source],
    ]));
    assert.equal(risk.status, 'BLOCKED');
    assert.equal(risk.failure_ids.includes(QWORK_MR1552_FAILURE_IDS[2]), true);
  }
});

test('MR !1559 requestId helper rejects bare returns and post-return derivation', () => {
  for (const replacement of [
    `if (skipIdentity) return;
  return requestId;`,
    `if (skipIdentity) return lateRequestId;
  const lateRequestId = identity.requestId;
  return requestId;`,
  ]) {
    const source = delegatedSuccessorManager.replace('return requestId;', replacement);
    const risk = successorRisk(new Map([
      ['electron/host-core/agent/execution-worker-manager.cjs', source],
    ]));
    assert.equal(risk.status, 'BLOCKED', replacement);
    assert.equal(risk.failure_ids.includes(QWORK_MR1552_FAILURE_IDS[2]), true, replacement);
  }
});

test('MR !1559 drain delegation must forward its one public settlement exactly', () => {
  const original = 'drain: (settlement) => drainExecutionRecord(manager, requestId, record, settlement),';
  for (const delegateCall of [
    'drainExecutionRecord(manager, requestId, record)',
    'drainExecutionRecord(manager, requestId, record, Promise.resolve())',
    'drainExecutionRecord(manager, requestId, settlement, record)',
    'drainExecutionRecord(manager, requestId, record, settlement, extra)',
  ]) {
    const source = delegatedSuccessorManager.replace(
      original,
      `drain: (settlement) => ${delegateCall},`,
    );
    const risk = successorRisk(new Map([
      ['electron/host-core/agent/execution-worker-manager.cjs', source],
    ]));
    assert.equal(risk.status, 'BLOCKED', delegateCall);
    assert.equal(risk.failure_ids.includes(QWORK_MR1552_FAILURE_IDS[2]), true, delegateCall);
  }
});

test('MR !1559 inline release may directly return the supervisor stop promise', () => {
  const directReturnManager = successorManager.replace(
    `const release = async () => {
    manager.executions.delete(requestId);
    await supervisor.stop();
  };`,
    `const release = () => {
    manager.executions.delete(requestId);
    return supervisor.stop();
  };`,
  );
  const risk = successorRisk(new Map([
    ['electron/host-core/agent/execution-worker-manager.cjs', directReturnManager],
  ]));
  assert.equal(risk.status, 'VERIFIED');
  assert.deepEqual(risk.failure_ids, []);
});

test('MR !1559 desktop host cannot substitute an unrelated acquire/release pool', () => {
  const unrelatedDesktopPool = successorDesktopHost.replace(
    'executionWorkerManager.acquire',
    'unrelatedPool.acquire',
  );
  const risk = successorRisk(new Map([
    ['electron/host-core/agent/desktop-host-context.cjs', unrelatedDesktopPool],
  ]));
  assert.equal(risk.status, 'BLOCKED');
  assert.equal(risk.failure_ids.includes(QWORK_MR1552_FAILURE_IDS[2]), true);
});

test('MR !1559 current helper delegation preserves manager and desktop lease ownership', () => {
  const risk = successorRisk(new Map([
    ['electron/host-core/agent/execution-worker-manager.cjs', delegatedSuccessorManager],
    ['electron/host-core/agent/desktop-host-context.cjs', delegatedSuccessorDesktopHost],
    ['electron/host-core/agent/execution-worker-context-usage.cjs', successorContextUsage],
    ['electron/host-core/agent/execution-worker-context-usage-lease.cjs', successorContextUsageLease],
  ]));
  assert.equal(risk.status, 'VERIFIED');
  assert.deepEqual(risk.failure_ids, []);
});

test('MR !1559 context helper and finally release require one closed ownership chain', () => {
  const unboundWrapper = `
const { createExecutionWorkerContextUsageLease: realHelper } = require('./execution-worker-context-usage-lease.cjs');
const { createExecutionWorkerContextUsageLease } = require('./unrelated-context-usage-lease.cjs');
module.exports = { createExecutionWorkerContextUsageLease };
`;
  const wrongReturnedRelease = successorContextUsageLease.replace(
    'return Object.freeze({ release });',
    'return Object.freeze({ release: unrelatedRelease });',
  );
  const wrongExport = successorContextUsageLease.replace(
    'module.exports = { createExecutionWorkerContextUsageLease };',
    'module.exports = { createExecutionWorkerContextUsageLease: unrelatedHelper };',
  );
  const conditionalDelegatedRelease = delegatedSuccessorDesktopHost.replace(
    'await contextUsageLease.release(executionWorkerLease);',
    'if (shouldRelease) await contextUsageLease.release(executionWorkerLease);',
  );
  const conditionalDirectRelease = successorDesktopHost.replace(
    'await executionWorkerLease?.release?.();',
    'if (shouldRelease) await executionWorkerLease?.release?.();',
  );
  for (const overrides of [
    new Map([
      ['electron/host-core/agent/execution-worker-manager.cjs', delegatedSuccessorManager],
      ['electron/host-core/agent/desktop-host-context.cjs', delegatedSuccessorDesktopHost],
      ['electron/host-core/agent/execution-worker-context-usage.cjs', unboundWrapper],
      ['electron/host-core/agent/execution-worker-context-usage-lease.cjs', successorContextUsageLease],
    ]),
    new Map([
      ['electron/host-core/agent/execution-worker-manager.cjs', delegatedSuccessorManager],
      ['electron/host-core/agent/desktop-host-context.cjs', delegatedSuccessorDesktopHost],
      ['electron/host-core/agent/execution-worker-context-usage.cjs', successorContextUsage],
      ['electron/host-core/agent/execution-worker-context-usage-lease.cjs', wrongReturnedRelease],
    ]),
    new Map([
      ['electron/host-core/agent/execution-worker-manager.cjs', delegatedSuccessorManager],
      ['electron/host-core/agent/desktop-host-context.cjs', delegatedSuccessorDesktopHost],
      ['electron/host-core/agent/execution-worker-context-usage.cjs', successorContextUsage],
      ['electron/host-core/agent/execution-worker-context-usage-lease.cjs', wrongExport],
    ]),
    new Map([
      ['electron/host-core/agent/execution-worker-manager.cjs', delegatedSuccessorManager],
      ['electron/host-core/agent/desktop-host-context.cjs', conditionalDelegatedRelease],
      ['electron/host-core/agent/execution-worker-context-usage.cjs', successorContextUsage],
      ['electron/host-core/agent/execution-worker-context-usage-lease.cjs', successorContextUsageLease],
    ]),
    new Map([
      ['electron/host-core/agent/desktop-host-context.cjs', conditionalDirectRelease],
    ]),
  ]) {
    const risk = successorRisk(overrides);
    assert.equal(risk.status, 'BLOCKED');
    assert.equal(risk.failure_ids.includes(QWORK_MR1552_FAILURE_IDS[2]), true);
  }
});

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
