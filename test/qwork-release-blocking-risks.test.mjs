import assert from 'node:assert/strict';
import { parse } from 'acorn';
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
  QWORK_RELEASE_BLOCKING_RISK_SCHEMA,
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
require('./host-core/agent/execution-worker-controller.cjs').startExecutionWorkerController();
`;

const successorController = `
const AUTHORITY_FIELDS = ['principalId', 'serverScope', 'runtimeGeneration', 'ownershipGeneration'];
const TURN_FIELDS = [...AUTHORITY_FIELDS, 'sessionId', 'turnId'];
const sameIdentity = (message, authority, fields) => authority
  && fields.every((field) => message[field] === authority[field]);
class ExecutionWorkerController {
  constructor({
    parentPort = process.parentPort,
    createRunner = () => new Worker(require.resolve('./execution-worker-entry.cjs')),
    exit = (code) => process.exit(code),
  } = {}) {
    Object.assign(this, { parentPort, createRunner, exit, runner: null, authority: null, turn: null,
      heartbeat: null, stopped: false });
  }
  finish(code) {
    if (this.stopped) return;
    this.stopped = true;
    this.exit(code);
  }
  decode(raw, direction) {
    try { return validateEnvelope(raw, { direction }); }
    catch { this.finish(1); return null; }
  }
  onRunnerMessage(raw) {
    if (this.stopped) return;
    const message = this.decode(raw, 'worker-to-host');
    if (!message || !sameIdentity(message, this.authority, AUTHORITY_FIELDS)) return;
    if (message.operation === 'worker.heartbeat') return;
    if (message.operation === 'worker.ready') this.startHeartbeat();
    else if (message.operation !== 'worker.pressure'
      && !sameIdentity(message, this.turn, TURN_FIELDS)) return;
    this.parentPort.postMessage(message);
  }
  onRunnerError(error) {
    this.finish(error ? 1 : 0);
  }
  onRunnerExit(code) {
    this.finish(code === 0 ? 0 : 1);
  }
  initialize(message) {
    if (this.authority) return false;
    this.authority = message;
    this.runner = this.createRunner();
    this.runner.on('message', (raw) => this.onRunnerMessage(raw));
    this.runner.on('error', (error) => this.onRunnerError(error));
    this.runner.on('exit', (code) => this.onRunnerExit(code));
    return true;
  }
  acceptMessage(message) {
    if (message.operation === 'worker.initialize') return this.initialize(message);
    if (!sameIdentity(message, this.authority, AUTHORITY_FIELDS)) return false;
    if (message.operation === 'worker.shutdown') { this.finish(0); return false; }
    if (message.operation === 'execution.start') {
      if (this.turn) return false;
      this.turn = message;
      return true;
    }
    if (!sameIdentity(message, this.turn, TURN_FIELDS)) return false;
    return message.operation === 'context-usage.refresh'
      ? message.payload.executionRequestId === this.turn.requestId
      : message.requestId === this.turn.requestId;
  }
  onHostMessage(raw) {
    if (this.stopped) return;
    const message = this.decode(raw, 'host-to-worker');
    if (!message || !this.acceptMessage(message)) return;
    this.runner.postMessage(message);
  }
}
function startExecutionWorkerController(options) {
  return new ExecutionWorkerController(options);
}
module.exports = { startExecutionWorkerController };
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
const { createExecutionWorkerRequestSettlement } = require('./execution-worker-cancellation.cjs');
const { createExecutionWorkerTerminator } = require('./execution-worker-termination.cjs');
const {
  handleExecutionWorkerEventMessage,
  handleExecutionWorkerObserverMessage,
} = require('./execution-worker-supervisor-message.cjs');
function rejectPending(error) { return error; }
function executionWorkerExitFailure(code, signal) { return { code, signal }; }
function createExecutionWorkerSupervisor() {
  const pending = new Map();
  let child = createChild();
  const terminateOwnedChild = createExecutionWorkerTerminator({
    processId, processTreeKiller, cleanupGraceMs: 250,
  });
  const terminateChild = (target = child, reason = 'terminated') => {
    return terminateOwnedChild(target, reason);
  };
  const onMessage = (message) => {
    if (message.operation === 'execution.event') {
      handleExecutionWorkerEventMessage(message, { pending, postBrokerResult, terminateChild, child });
      return;
    }
    if (message.operation === 'execution.observer') {
      handleExecutionWorkerObserverMessage(message, { pending });
      return;
    }
    if (isExecutionWorkerTerminalOperation(message.operation)) {
      const item = pending.get(message.requestId);
      if (!item || !item.matches(message)) return;
      pending.delete(message.requestId);
      item.resolve(message);
      return;
    }
  };
  const request = (operation, requestId) => new Promise((resolveRequest, reject) => {
    const settlement = createExecutionWorkerRequestSettlement({
      child, operation, deadlineMs, cancellationTimeoutMs, terminateChild,
      onDeadline: () => pending.delete(requestId), resolve: resolveRequest, reject,
    });
    pending.set(requestId, settlement);
  });
  const stop = async () => {
    const stoppedChild = child;
    await terminateChild(stoppedChild, 'stop');
    if (child === stoppedChild) child = null;
  };
  const onExit = (code, signal) => {
    rejectPending(executionWorkerExitFailure(code, signal));
  };
  return { onExit, onMessage, request, stop };
}
`;

const successorCancellation = `
async function requestExecutionWorkerTurn(supervisor, operation, identity, payload, options, signal) {
  const pending = supervisor.request(operation, identity, payload, options);
  const cancelIdentity = identity;
  const onAbort = () => {
    supervisor.cancel(cancelIdentity, 'user-requested');
  };
  if (!signal) return await pending;
  signal.addEventListener('abort', onAbort, { once: true });
  if (signal.aborted) onAbort();
  try {
    return await pending;
  } finally {
    signal.removeEventListener('abort', onAbort);
  }
}
function createExecutionWorkerRequestSettlement({
  child, operation, deadlineMs, cancellationTimeoutMs, terminateChild, onDeadline, resolve, reject,
}) {
  let cancellationTimer = null;
  const clear = () => { clearTimeout(deadline); clearTimeout(cancellationTimer); };
  const deadline = setTimeout(() => {
    clear();
    onDeadline();
    reject(new Error('execution worker request deadline exceeded'));
    if (operation === 'execution.start') void terminateChild(child, 'execution-deadline');
  }, deadlineMs + 1);
  return {
    armCancellation: () => {
      if (cancellationTimer) return;
      cancellationTimer = setTimeout(() => {
        void terminateChild(child, 'cancel-timeout');
      }, Math.max(1, cancellationTimeoutMs));
    },
    resolve: (value) => { clear(); resolve(value); },
    reject: (error) => { clear(); reject(error); },
  };
}
module.exports = { createExecutionWorkerRequestSettlement, requestExecutionWorkerTurn };
`;

const successorTermination = `
function createExecutionWorkerTerminator({ processId, processTreeKiller, cleanupGraceMs = 250 } = {}) {
  const flights = new WeakMap();
  return (target, reason = 'terminated') => {
    if (!target) return Promise.resolve(false);
    const existing = flights.get(target);
    if (existing) return existing;
    const pid = processId(target.pid);
    const cleanup = Promise.resolve().then(() => processTreeKiller(pid, { reason }));
    const flight = Promise.race([
      cleanup,
      new Promise((resolve) => setTimeout(resolve, cleanupGraceMs)),
    ]).then(() => {
      target.kill?.();
      return true;
    });
    flights.set(target, flight);
    void flight.finally(() => flights.delete(target));
    return flight;
  };
}
module.exports = { createExecutionWorkerTerminator };
`;

const successorSupervisorMessage = `
function isReservedExecutionWorkerObserverCallback() { return true; }
function dispatchExecutionEvent() {}
function handleExecutionWorkerEventMessage(message, {
  pending, postBrokerResult, terminateChild, child,
}) {
  const item = pending.get(message.requestId);
  if (!item || !item.matches(message)) return;
  if (message.sequence <= item.lastSequence) {
    const error = new Error('execution worker emitted a non-monotonic event sequence');
    pending.delete(message.requestId);
    item.reject(error);
    terminateChild(child, 'sequence-violation');
    return;
  }
  dispatchExecutionEvent(item, message, postBrokerResult);
}
function handleExecutionWorkerObserverMessage(message, { pending }) {
  const item = pending.get(message.requestId);
  if (!item || !item.matches(message)
    || !isReservedExecutionWorkerObserverCallback(message.payload?.callback)) return;
  item.onEvent?.(message);
}
module.exports = {
  handleExecutionWorkerEventMessage,
  handleExecutionWorkerObserverMessage,
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

const currentReleaseSuccessorManager = delegatedSuccessorManager
  .replace(
    `function stopExecutionRecord(manager, requestId, record) {
  return Promise.resolve().then(() => record.supervisor.stop());
}`,
    `function stopExecutionRecord(manager, requestId, record) {
  if (record.stopPromise) return record.stopPromise;
  record.stopPromise = Promise.resolve()
    .then(() => record.supervisor.stop())
    .finally(() => manager.drainingExecutions.delete(requestId));
  return record.stopPromise;
}`,
  )
  .replace(
    `function drainExecutionRecord(manager, requestId, record, settlement) {
  manager.executions.delete(requestId);
  return Promise.resolve(settlement).then(() => stopExecutionRecord(manager, requestId, record));
}`,
    `function drainExecutionRecord(manager, requestId, record, settlement, { timeoutMs = 1 } = {}) {
  manager.executions.delete(requestId);
  record.finalizationPromise = Promise.race([
    Promise.resolve(settlement),
    new Promise((resolve) => setTimeout(resolve, timeoutMs)),
  ]).then(() => {
    return stopExecutionRecord(manager, requestId, record);
  });
  return record.finalizationPromise;
}`,
  )
  .replace(
    'drain: (settlement) => drainExecutionRecord(manager, requestId, record, settlement),',
    'drain: (settlement, options) => drainExecutionRecord(manager, requestId, record, settlement, options),',
  );

const successorContextUsage = `
const {
  createExecutionWorkerContextUsageLease,
  releaseExecutionWorkerLeaseAfterContextUsage,
} = require('./execution-worker-context-usage-lease.cjs');
module.exports = {
  createExecutionWorkerContextUsageLease,
  releaseExecutionWorkerLeaseAfterContextUsage,
};
`;

const successorContextUsageLease = `
function releaseExecutionWorkerLeaseAfterContextUsage(lease, settlement, { timeoutMs = 1000 } = {}) {
  const requestedTimeout = Number(timeoutMs);
  const boundedTimeout = Number.isFinite(requestedTimeout)
    ? Math.max(1, requestedTimeout)
    : 1000;
  if (typeof lease?.drain === 'function') {
    return Promise.resolve(lease.drain(settlement, { timeoutMs: boundedTimeout })).then(
      () => true,
      () => false,
    );
  }
  return Promise.resolve(false);
}
function createExecutionWorkerContextUsageLease({ timeoutMs = 1000 } = {}) {
  let completed = false;
  let settle;
  const settlement = new Promise((resolve) => { settle = resolve; });
  return Object.freeze({
    observeTerminal: (payload) => { completed = payload?.outcome === 'completed'; },
    release: async (executionWorkerLease) => {
      if (!executionWorkerLease) return false;
      if (completed) {
        await releaseExecutionWorkerLeaseAfterContextUsage(
          executionWorkerLease,
          settlement,
          { timeoutMs },
        );
        return true;
    }
      await executionWorkerLease.release?.();
      return true;
    },
    settle,
  });
}
module.exports = {
  createExecutionWorkerContextUsageLease,
  releaseExecutionWorkerLeaseAfterContextUsage,
};
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

const currentReleaseSuccessorDesktopHost = `
const { createExecutionWorkerContextUsageLease } = require('./execution-worker-context-usage.cjs');
async function runAgentInExecutionWorker({
  supervisor,
  identity,
  callbacks,
  contextUsageReleaseTimeoutMs = 1000,
} = {}) {
  let executionWorkerLease = null;
  const contextUsageLease = createExecutionWorkerContextUsageLease({
    timeoutMs: contextUsageReleaseTimeoutMs,
  });
  try {
    executionWorkerLease = await supervisor.acquire({ authority: true }, identity, {
      signal: callbacks.abortController?.signal,
    });
    const terminal = await executionWorkerLease.supervisor.request();
    contextUsageLease.observeTerminal(terminal.payload);
  } finally {
    await contextUsageLease.release(executionWorkerLease);
  }
}
`;

function successorFiles(overrides = new Map()) {
  const byPath = new Map([
    ['electron/execution-worker.cjs', successorEntry],
    ['electron/host-core/agent/execution-worker-controller.cjs', successorController],
    ['electron/host-core/agent/execution-worker-cancellation.cjs', successorCancellation],
    ['electron/host-core/agent/execution-worker-manager.cjs', successorManager],
    ['electron/host-core/agent/execution-worker-supervisor.cjs', successorSupervisor],
    ['electron/host-core/agent/execution-worker-supervisor-message.cjs', successorSupervisorMessage],
    ['electron/host-core/agent/execution-worker-termination.cjs', successorTermination],
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

function replaceRequired(source, search, replacement, label) {
  assert.equal(source.includes(search), true, `${label}: mutation target missing`);
  return source.replace(search, replacement);
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
  assert.equal(
    risk.checks.at(-1).observations.execution_worker_lifecycle_isolation,
    true,
    JSON.stringify(risk.checks.at(-1).observations),
  );
  assert.equal(risk.status, 'VERIFIED');
  assert.equal(risk.architecture, 'per-turn-utility-process/v1');
  assert.equal(risk.architecture_activation_source, 'release-head-is-mr-1559-merge');
  assert.equal(risk.assertion_owner.contract_id, QWORK_MR1559_EXECUTION_RUNNER_SUCCESSOR_ID);
  assert.deepEqual(risk.protected_paths, QWORK_MR1559_SUCCESSOR_PROTECTED_PATHS);
  assert.equal(risk.test_execution_attested, false);
  assert.equal(validateQworkReleaseBlockingRisksForReport(reportFor(risk)).ok, true);
});

test('v5 controller bootstrap and single-turn identity chain rejects disconnected or mixed ownership', () => {
  const variants = [
    new Map([['electron/execution-worker.cjs', "require('./host-core/agent/execution-worker-controller.cjs');\n"]]),
    new Map([['electron/execution-worker.cjs', "require('./host-core/agent/wrong-controller.cjs').startExecutionWorkerController();\n"]]),
    new Map([['electron/host-core/agent/execution-worker-controller.cjs', successorController.replace(
      "require.resolve('./execution-worker-entry.cjs')",
      "require.resolve('./wrong-entry.cjs')",
    )]]),
    new Map([['electron/host-core/agent/execution-worker-controller.cjs', successorController.replace(
      'module.exports = { startExecutionWorkerController };',
      'module.exports = { startExecutionWorkerController: unrelatedStart };',
    )]]),
    new Map([['electron/host-core/agent/execution-worker-controller.cjs', successorController.replace(
      '      if (this.turn) return false;',
      '      if (false) return false;',
    )]]),
    new Map([['electron/host-core/agent/execution-worker-controller.cjs', successorController.replace(
      '    if (!sameIdentity(message, this.authority, AUTHORITY_FIELDS)) return false;',
      '    if (!message) return false;',
    )]]),
    new Map([['electron/host-core/agent/execution-worker-controller.cjs', successorController.replace(
      '    if (!sameIdentity(message, this.turn, TURN_FIELDS)) return false;',
      '    if (!message) return false;',
    )]]),
    new Map([['electron/host-core/agent/execution-worker-controller.cjs', successorController.replace(
      'message.payload.executionRequestId === this.turn.requestId',
      'message.payload.executionRequestId === unrelatedTurn.requestId',
    )]]),
    new Map([['electron/host-core/agent/execution-worker-controller.cjs', successorController.replace(
      'message.requestId === this.turn.requestId',
      'message.requestId === unrelatedTurn.requestId',
    )]]),
    new Map([['electron/host-core/agent/execution-worker-controller.cjs', successorController.replace(
      '      && !sameIdentity(message, this.turn, TURN_FIELDS)) return;',
      '      && !message) return;',
    )]]),
  ];
  for (const overrides of variants) {
    const risk = successorRisk(overrides);
    assert.equal(risk.status, 'BLOCKED');
    assert.equal(risk.checks.at(-1).observations.stable_single_turn_entry, false);
    assert.deepEqual(risk.failure_ids, [QWORK_MR1552_FAILURE_IDS[2]]);
  }
});

test('v5 cancellation, supervisor settlement and terminator ownership fail closed independently', () => {
  const variants = [
    new Map([['electron/host-core/agent/execution-worker-cancellation.cjs', successorCancellation.replace(
      "void terminateChild(child, 'execution-deadline');",
      'void Promise.resolve(false);',
    )]]),
    new Map([['electron/host-core/agent/execution-worker-cancellation.cjs', successorCancellation.replace(
      "void terminateChild(child, 'cancel-timeout');",
      'void Promise.resolve(false);',
    )]]),
    new Map([['electron/host-core/agent/execution-worker-termination.cjs', successorTermination.replace(
      '      target.kill?.();',
      '      noOp(target);',
    )]]),
    new Map([['electron/host-core/agent/execution-worker-supervisor-message.cjs', successorSupervisorMessage.replace(
      'if (!item || !item.matches(message)) return;',
      'if (!item) return;',
    )]]),
    new Map([['electron/host-core/agent/execution-worker-supervisor-message.cjs', successorSupervisorMessage.replace(
      "terminateChild(child, 'sequence-violation');",
      "terminateChild(unrelatedChild, 'sequence-violation');",
    )]]),
    new Map([['electron/host-core/agent/execution-worker-supervisor.cjs', successorSupervisor.replace(
      "    await terminateChild(stoppedChild, 'stop');",
      "    terminateChild(stoppedChild, 'stop');",
    )]]),
    new Map([['electron/host-core/agent/execution-worker-supervisor.cjs', successorSupervisor.replace(
      'pending.delete(message.requestId);',
      'pending.delete(unrelatedRequestId);',
    )]]),
    new Map([['electron/host-core/agent/execution-worker-supervisor.cjs', successorSupervisor.replace(
      "require('./execution-worker-termination.cjs')",
      "require('./unrelated-termination.cjs')",
    )]]),
  ];
  for (const overrides of variants) {
    const risk = successorRisk(overrides);
    assert.equal(risk.status, 'BLOCKED');
    assert.equal(risk.checks.at(-1).observations.execution_worker_lifecycle_isolation, false);
    assert.equal(risk.failure_ids.includes(QWORK_MR1552_FAILURE_IDS[2]), true);
  }
});

for (const [name, filePath, source, expected] of [
  ['clean exit', 'electron/host-core/agent/execution-worker-supervisor.cjs', successorSupervisor.replace(
    '    rejectPending(executionWorkerExitFailure(code, signal));',
    "    logger.info('worker exited');",
  ), QWORK_MR1552_FAILURE_IDS[0]],
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
    const unreachableExitSupervisor = successorSupervisor.replace(
      '  const onExit = (code, signal) => {\n    rejectPending(executionWorkerExitFailure(code, signal));\n  };',
      `  const onExit = (code, signal) => {
    ${terminator}
    rejectPending(executionWorkerExitFailure(code, signal));
  };`,
    );
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
  const wrongScopedSupervisor = `${successorSupervisor.replace(
    '  const onExit = (code, signal) => {\n    rejectPending(executionWorkerExitFailure(code, signal));\n  };',
    "  const onExit = (code, signal) => { logger.info('worker exited'); };",
  )}
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
    ['electron/host-core/agent/execution-worker-manager.cjs', currentReleaseSuccessorManager],
    ['electron/host-core/agent/desktop-host-context.cjs', delegatedSuccessorDesktopHost],
    ['electron/host-core/agent/execution-worker-context-usage.cjs', successorContextUsage],
    ['electron/host-core/agent/execution-worker-context-usage-lease.cjs', successorContextUsageLease],
  ]));
  assert.equal(risk.status, 'VERIFIED');
  assert.deepEqual(risk.failure_ids, []);
});

test('current release controller, manager drain options and destructured desktop helper chain verify under v5', () => {
  const risk = successorRisk(new Map([
    ['electron/host-core/agent/execution-worker-manager.cjs', currentReleaseSuccessorManager],
    ['electron/host-core/agent/desktop-host-context.cjs', currentReleaseSuccessorDesktopHost],
    ['electron/host-core/agent/execution-worker-context-usage.cjs', successorContextUsage],
    ['electron/host-core/agent/execution-worker-context-usage-lease.cjs', successorContextUsageLease],
  ]));
  assert.equal(QWORK_RELEASE_BLOCKING_RISK_SCHEMA, 'qbot-qwork-release-blocking-risk-attestation/v5');
  assert.equal(risk.schema_version, QWORK_RELEASE_BLOCKING_RISK_SCHEMA);
  assert.equal(risk.status, 'VERIFIED');
  assert.deepEqual(risk.failure_ids, []);
  assert.deepEqual(
    {
      release: risk.checks.at(-1).observations.release_deletes_request_and_stops_supervisor,
      acquire: risk.checks.at(-1).observations.desktop_host_acquires_execution_lease,
      finally_release: risk.checks.at(-1).observations.desktop_host_releases_execution_lease,
      same_try_finally: risk.checks.at(-1).observations.desktop_host_lease_same_try_finally_scope,
      entry: risk.checks.at(-1).observations.stable_single_turn_entry,
      lifecycle: risk.checks.at(-1).observations.execution_worker_lifecycle_isolation,
    },
    {
      release: true,
      acquire: true,
      finally_release: true,
      same_try_finally: true,
      entry: true,
      lifecycle: true,
    },
  );
});

test('v5 manager observes the assigned stop promise and forwards both drain arguments exactly', () => {
  const drainDelegate = 'drain: (settlement, options) => drainExecutionRecord(manager, requestId, record, settlement, options),';
  const managerVariants = [
    currentReleaseSuccessorManager.replace(
      drainDelegate,
      'drain: (settlement, options) => drainExecutionRecord(manager, requestId, record, settlement),',
    ),
    currentReleaseSuccessorManager.replace(
      drainDelegate,
      'drain: (settlement, options) => drainExecutionRecord(manager, requestId, record, settlement, unrelatedOptions),',
    ),
    currentReleaseSuccessorManager.replace(
      '.then(() => record.supervisor.stop())',
      '.then(() => { record.supervisor.stop(); return true; })',
    ),
    currentReleaseSuccessorManager.replaceAll(
      'return record.stopPromise;',
      'return Promise.resolve(false);',
    ),
  ];
  for (const manager of managerVariants) {
    const risk = successorRisk(new Map([
      ['electron/host-core/agent/execution-worker-manager.cjs', manager],
    ]));
    assert.equal(risk.status, 'BLOCKED');
    assert.equal(risk.checks.at(-1).observations.release_deletes_request_and_stops_supervisor, false);
    assert.equal(risk.failure_ids.includes(QWORK_MR1552_FAILURE_IDS[2]), true);
  }
});

test('v5 context helper requires completed drain and awaited incomplete release through exact bindings', () => {
  const helperVariants = [
    successorContextUsageLease.replace(
      '          settlement,',
      '          unrelatedSettlement,',
    ),
    successorContextUsageLease.replace(
      '{ timeoutMs },',
      '{ timeoutMs: unrelatedTimeout },',
    ),
    successorContextUsageLease.replace(
      'lease.drain(settlement, { timeoutMs: boundedTimeout })',
      'lease.drain(unrelatedSettlement, { timeoutMs: boundedTimeout })',
    ),
    successorContextUsageLease.replace(
      '    return Promise.resolve(lease.drain(settlement, { timeoutMs: boundedTimeout })).then(',
      '    Promise.resolve(lease.drain(settlement, { timeoutMs: boundedTimeout })).then(',
    ),
    successorContextUsageLease.replace(
      '      await executionWorkerLease.release?.();',
      '      executionWorkerLease.release?.();',
    ),
  ];
  for (const helper of helperVariants) {
    const risk = successorRisk(new Map([
      ['electron/host-core/agent/execution-worker-manager.cjs', currentReleaseSuccessorManager],
      ['electron/host-core/agent/desktop-host-context.cjs', currentReleaseSuccessorDesktopHost],
      ['electron/host-core/agent/execution-worker-context-usage.cjs', successorContextUsage],
      ['electron/host-core/agent/execution-worker-context-usage-lease.cjs', helper],
    ]));
    assert.equal(risk.status, 'BLOCKED');
    assert.equal(risk.checks.at(-1).observations.desktop_host_releases_execution_lease, false);
    assert.equal(risk.failure_ids.includes(QWORK_MR1552_FAILURE_IDS[2]), true);
  }
});

test('MR !1559 context helper and finally release require one closed ownership chain', () => {
  const unboundWrapper = `
const { createExecutionWorkerContextUsageLease: realHelper } = require('./execution-worker-context-usage-lease.cjs');
const { createExecutionWorkerContextUsageLease } = require('./unrelated-context-usage-lease.cjs');
module.exports = { createExecutionWorkerContextUsageLease };
`;
  const wrongReturnedRelease = successorContextUsageLease.replace(
    '    release: async (executionWorkerLease) => {',
    '    unrelatedRelease: async (executionWorkerLease) => {',
  );
  const wrongExport = successorContextUsageLease.replace(
    '  createExecutionWorkerContextUsageLease,\n  releaseExecutionWorkerLeaseAfterContextUsage,',
    '  createExecutionWorkerContextUsageLease: unrelatedHelper,\n  releaseExecutionWorkerLeaseAfterContextUsage,',
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

test('v5 AST closure rejects every proven dead-code, shadowing, rebind and wrong-return mutation', () => {
  const mutate = (source, search, replacement, label) => replaceRequired(
    source, search, replacement, label,
  );
  const simpleVariants = [
    ['cancel identity RHS', 'cancellation', 'electron/host-core/agent/execution-worker-cancellation.cjs', mutate(
      successorCancellation,
      'const cancelIdentity = identity;',
      'const cancelIdentity = unrelatedIdentity;',
      'cancel identity RHS',
    )],
    ['aborted guard short circuit', 'cancellation', 'electron/host-core/agent/execution-worker-cancellation.cjs', mutate(
      successorCancellation,
      'if (signal.aborted) onAbort();',
      'if (false && signal.aborted) onAbort();',
      'aborted guard short circuit',
    )],
    ['abort listener dead branch', 'cancellation', 'electron/host-core/agent/execution-worker-cancellation.cjs', mutate(
      successorCancellation,
      "signal.addEventListener('abort', onAbort, { once: true });",
      "if (false) signal.addEventListener('abort', onAbort, { once: true });",
      'abort listener dead branch',
    )],
    ['settlement factory does not return', 'cancellation', 'electron/host-core/agent/execution-worker-cancellation.cjs', mutate(
      successorCancellation,
      '  return {\n    armCancellation:',
      '  const unusedSettlement = {\n    armCancellation:',
      'settlement factory does not return',
    )],
    ['deadline clear dead branch', 'cancellation', 'electron/host-core/agent/execution-worker-cancellation.cjs', mutate(
      successorCancellation,
      '    clear();\n    onDeadline();',
      '    if (false) clear();\n    onDeadline();',
      'deadline clear dead branch',
    )],
    ['controller start guard short circuit', 'controller', 'electron/host-core/agent/execution-worker-controller.cjs', mutate(
      successorController,
      "if (message.operation === 'execution.start') {",
      "if (false && message.operation === 'execution.start') {",
      'controller start guard short circuit',
    )],
    ['controller returns unrelated runner', 'controller', 'electron/host-core/agent/execution-worker-controller.cjs', mutate(
      successorController,
      "createRunner = () => new Worker(require.resolve('./execution-worker-entry.cjs'))",
      "createRunner = () => { new Worker(require.resolve('./execution-worker-entry.cjs')); return unrelatedRunner; }",
      'controller returns unrelated runner',
    )],
    ['controller discards decoded host message', 'controller', 'electron/host-core/agent/execution-worker-controller.cjs', mutate(
      successorController,
      "const message = this.decode(raw, 'host-to-worker');",
      "this.decode(raw, 'host-to-worker'); const message = raw;",
      'controller discards decoded host message',
    )],
    ['controller request identity accepts all', 'controller', 'electron/host-core/agent/execution-worker-controller.cjs', mutate(
      successorController,
      ': message.requestId === this.turn.requestId;',
      ': message.requestId === this.turn.requestId || true;',
      'controller request identity accepts all',
    )],
    ['controller ready branch disconnected', 'controller', 'electron/host-core/agent/execution-worker-controller.cjs', mutate(
      successorController,
      "if (message.operation === 'worker.ready') this.startHeartbeat();",
      "if (message.operation === 'worker.ready') noOp();",
      'controller ready branch disconnected',
    )],
    ['controller initialize assignment dead', 'controller', 'electron/host-core/agent/execution-worker-controller.cjs', mutate(
      successorController,
      '    this.authority = message;',
      '    if (false && message) this.authority = message;',
      'controller initialize assignment dead',
    )],
    ['controller host accept guard dead', 'controller', 'electron/host-core/agent/execution-worker-controller.cjs', mutate(
      successorController,
      'if (!message || !this.acceptMessage(message)) return;',
      'if (false && (!message || !this.acceptMessage(message))) return;',
      'controller host accept guard dead',
    )],
    ['terminator existing guard short circuit', 'termination', 'electron/host-core/agent/execution-worker-termination.cjs', mutate(
      successorTermination,
      'if (existing) return existing;',
      'if (false && existing) return existing;',
      'terminator existing guard short circuit',
    )],
    ['terminator cleanup is not raced', 'termination', 'electron/host-core/agent/execution-worker-termination.cjs', mutate(
      successorTermination,
      '      cleanup,',
      '      void cleanup,',
      'terminator cleanup is not raced',
    )],
    ['terminator direct kill dead', 'termination', 'electron/host-core/agent/execution-worker-termination.cjs', mutate(
      successorTermination,
      '      target.kill?.();',
      '      if (false) target.kill?.();',
      'terminator direct kill dead',
    )],
    ['terminator flight set dead', 'termination', 'electron/host-core/agent/execution-worker-termination.cjs', mutate(
      successorTermination,
      '    flights.set(target, flight);',
      '    if (false) flights.set(target, flight);',
      'terminator flight set dead',
    )],
    ['terminator finalizer dead', 'termination', 'electron/host-core/agent/execution-worker-termination.cjs', mutate(
      successorTermination,
      '    void flight.finally(() => flights.delete(target));',
      '    if (false) void flight.finally(() => flights.delete(target));',
      'terminator finalizer dead',
    )],
    ['supervisor terminator wrong process helper', 'supervisor', 'electron/host-core/agent/execution-worker-supervisor.cjs', mutate(
      successorSupervisor,
      '    processId, processTreeKiller, cleanupGraceMs: 250,',
      '    processId: unrelatedProcessId, processTreeKiller, cleanupGraceMs: 250,',
      'supervisor terminator wrong process helper',
    )],
    ['supervisor settlement wrong child', 'supervisor', 'electron/host-core/agent/execution-worker-supervisor.cjs', mutate(
      successorSupervisor,
      '      child, operation, deadlineMs, cancellationTimeoutMs, terminateChild,',
      '      child: unrelatedChild, operation, deadlineMs, cancellationTimeoutMs, terminateChild,',
      'supervisor settlement wrong child',
    )],
    ['supervisor settlement result ignored', 'supervisor', 'electron/host-core/agent/execution-worker-supervisor.cjs', mutate(
      successorSupervisor,
      'const settlement = createExecutionWorkerRequestSettlement({',
      'const ignoredSettlement = createExecutionWorkerRequestSettlement({',
      'supervisor settlement result ignored',
    )],
    ['supervisor event branch dead', 'supervisor', 'electron/host-core/agent/execution-worker-supervisor.cjs', mutate(
      successorSupervisor,
      "if (message.operation === 'execution.event') {",
      "if (false && message.operation === 'execution.event') {",
      'supervisor event branch dead',
    )],
    ['supervisor terminal guard dead', 'supervisor', 'electron/host-core/agent/execution-worker-supervisor.cjs', mutate(
      successorSupervisor,
      'if (!item || !item.matches(message)) return;',
      'if (false && (!item || !item.matches(message))) return;',
      'supervisor terminal guard dead',
    )],
    ['supervisor stop child disconnected', 'supervisor', 'electron/host-core/agent/execution-worker-supervisor.cjs', mutate(
      successorSupervisor,
      'const stoppedChild = child;',
      'const stoppedChild = unrelatedChild;',
      'supervisor stop child disconnected',
    )],
    ['supervisor API returns unrelated onMessage', 'supervisor', 'electron/host-core/agent/execution-worker-supervisor.cjs', mutate(
      successorSupervisor,
      'return { onExit, onMessage, request, stop };',
      'return { onExit, onMessage: unrelatedOnMessage, request, stop };',
      'supervisor API returns unrelated onMessage',
    )],
    ['supervisor helper import shadowed', 'supervisor', 'electron/host-core/agent/execution-worker-supervisor.cjs', mutate(
      successorSupervisor,
      'function createExecutionWorkerSupervisor() {',
      'function createExecutionWorkerSupervisor() {\n  const createExecutionWorkerTerminator = () => unrelatedTerminator;',
      'supervisor helper import shadowed',
    )],
    ['supervisor message sequence guard dead', 'supervisor_message', 'electron/host-core/agent/execution-worker-supervisor-message.cjs', mutate(
      successorSupervisorMessage,
      'if (message.sequence <= item.lastSequence) {',
      'if (false && message.sequence <= item.lastSequence) {',
      'supervisor message sequence guard dead',
    )],
    ['supervisor message identity guard dead', 'supervisor_message', 'electron/host-core/agent/execution-worker-supervisor-message.cjs', mutate(
      successorSupervisorMessage,
      'if (!item || !item.matches(message)) return;',
      'if (false && (!item || !item.matches(message))) return;',
      'supervisor message identity guard dead',
    )],
    ['manager requestId is mutable', 'manager', 'electron/host-core/agent/execution-worker-manager.cjs', mutate(
      successorManager,
      'const requestId = identity.requestId;',
      'let requestId = identity.requestId; requestId += 1;',
      'manager requestId is mutable',
    )],
    ['manager supervisor is rebound', 'manager', 'electron/host-core/agent/execution-worker-manager.cjs', mutate(
      successorManager,
      'const supervisor = manager.supervisorFactory({ maxPendingRequests: 1, maxRestarts: 0 });',
      'let supervisor = manager.supervisorFactory({ maxPendingRequests: 1, maxRestarts: 0 }); supervisor = unrelatedSupervisor;',
      'manager supervisor is rebound',
    )],
    ['manager execution index dead', 'manager', 'electron/host-core/agent/execution-worker-manager.cjs', mutate(
      successorManager,
      'manager.executions.set(requestId, record);',
      'if (false) manager.executions.set(requestId, record);',
      'manager execution index dead',
    )],
    ['manager release is rebound', 'manager', 'electron/host-core/agent/execution-worker-manager.cjs', mutate(
      successorManager,
      'const release = async () => {',
      'let release = async () => {',
      'manager release is rebound',
    )],
  ];

  const exitVariant = mutate(
    successorSupervisor,
    'rejectPending(executionWorkerExitFailure(code, signal));',
    'rejectPending((executionWorkerExitFailure(code, signal), unrelatedError));',
    'supervisor exit wrong value',
  );
  simpleVariants.push([
    'supervisor exit wrong value', 'supervisor_exit',
    'electron/host-core/agent/execution-worker-supervisor.cjs', exitVariant,
  ]);

  for (const [label, contract, filePath, source] of simpleVariants) {
    const risk = successorRisk(new Map([[filePath, source]]));
    const ast = risk.checks.at(-1).observations.successor_ast_contracts;
    assert.equal(risk.status, 'BLOCKED', label);
    assert.equal(ast[contract], false, `${label}: AST contract must fail`);
  }

  const pressureAfterAllocation = mutate(
    successorManager,
    '  await waitForExecutionSlot(manager, requestId);\n',
    '',
    'manager admission after allocation',
  ).replace(
    '  manager.executions.set(requestId, record);',
    '  manager.executions.set(requestId, record);\n  await waitForExecutionSlot(manager, requestId);',
  );
  const pressureRisk = successorRisk(new Map([
    ['electron/host-core/agent/execution-worker-manager.cjs', pressureAfterAllocation],
  ]));
  assert.equal(pressureRisk.status, 'BLOCKED');
  assert.equal(
    pressureRisk.checks.at(-1).observations.successor_ast_contracts.manager_pressure,
    false,
  );

  const contextBase = (contextSource = successorContextUsageLease, desktopSource = currentReleaseSuccessorDesktopHost) => new Map([
    ['electron/host-core/agent/execution-worker-manager.cjs', currentReleaseSuccessorManager],
    ['electron/host-core/agent/desktop-host-context.cjs', desktopSource],
    ['electron/host-core/agent/execution-worker-context-usage.cjs', successorContextUsage],
    ['electron/host-core/agent/execution-worker-context-usage-lease.cjs', contextSource],
  ]);
  const contextVariants = [
    ['context completed starts true', mutate(
      successorContextUsageLease,
      'let completed = false;',
      'let completed = true;',
      'context completed starts true',
    )],
    ['context timeout can be infinite', mutate(
      successorContextUsageLease,
      `const requestedTimeout = Number(timeoutMs);
  const boundedTimeout = Number.isFinite(requestedTimeout)
    ? Math.max(1, requestedTimeout)
    : 1000;`,
      'const requestedTimeout = Number(timeoutMs);\n  const boundedTimeout = Infinity;',
      'context timeout can be infinite',
    )],
    ['context observe terminal disconnected', mutate(
      successorContextUsageLease,
      "observeTerminal: (payload) => { completed = payload?.outcome === 'completed'; },",
      'observeTerminal: () => {},',
      'context observe terminal disconnected',
    )],
    ['context completed return dead', mutate(
      successorContextUsageLease,
      '        return true;',
      '        if (false) return true;',
      'context completed return dead',
    )],
    ['context drain helper shadowed', mutate(
      successorContextUsageLease,
      'function createExecutionWorkerContextUsageLease({ timeoutMs = 1000 } = {}) {',
      'function createExecutionWorkerContextUsageLease({ timeoutMs = 1000 } = {}) {\n  const releaseExecutionWorkerLeaseAfterContextUsage = async () => false;',
      'context drain helper shadowed',
    )],
  ];
  for (const [label, source] of contextVariants) {
    const risk = successorRisk(contextBase(source));
    assert.equal(risk.status, 'BLOCKED', label);
    assert.equal(
      risk.checks.at(-1).observations.successor_ast_contracts.desktop,
      false,
      `${label}: desktop/context closure must fail`,
    );
  }

  const desktopVariants = [
    ['desktop acquire wrong identity', mutate(
      currentReleaseSuccessorDesktopHost,
      '}, identity, {',
      '}, unrelatedIdentity, {',
      'desktop acquire wrong identity',
    )],
    ['desktop acquired lease rebound', mutate(
      currentReleaseSuccessorDesktopHost,
      `    executionWorkerLease = await supervisor.acquire({ authority: true }, identity, {
      signal: callbacks.abortController?.signal,
    });`,
      `    executionWorkerLease = await supervisor.acquire({ authority: true }, identity, {
      signal: callbacks.abortController?.signal,
    });
    executionWorkerLease = unrelatedLease;`,
      'desktop acquired lease rebound',
    )],
    ['desktop context helper setup dead', mutate(
      currentReleaseSuccessorDesktopHost,
      `const contextUsageLease = createExecutionWorkerContextUsageLease({
    timeoutMs: contextUsageReleaseTimeoutMs,
  });`,
      `let contextUsageLease;
  if (false) contextUsageLease = createExecutionWorkerContextUsageLease({
    timeoutMs: contextUsageReleaseTimeoutMs,
  });`,
      'desktop context helper setup dead',
    )],
    ['desktop context helper shadowed', mutate(
      currentReleaseSuccessorDesktopHost,
      `} = {}) {
  let executionWorkerLease = null;`,
      `} = {}) {
  const createExecutionWorkerContextUsageLease = () => unrelatedContextLease;
  let executionWorkerLease = null;`,
      'desktop context helper shadowed',
    )],
  ];
  for (const [label, source] of desktopVariants) {
    const risk = successorRisk(contextBase(successorContextUsageLease, source));
    assert.equal(risk.status, 'BLOCKED', label);
    assert.equal(
      risk.checks.at(-1).observations.successor_ast_contracts.desktop,
      false,
      `${label}: desktop AST contract must fail`,
    );
  }
});

test('v5 full audit rejects protected rebind, post-wait listener, late target guard, wrong signal and forced completion', () => {
  const mutate = (source, search, replacement, label) => replaceRequired(
    source, search, replacement, label,
  );
  const contextBase = (contextSource) => new Map([
    ['electron/host-core/agent/execution-worker-manager.cjs', currentReleaseSuccessorManager],
    ['electron/host-core/agent/desktop-host-context.cjs', currentReleaseSuccessorDesktopHost],
    ['electron/host-core/agent/execution-worker-context-usage.cjs', successorContextUsage],
    ['electron/host-core/agent/execution-worker-context-usage-lease.cjs', contextSource],
  ]);
  const variants = [
    ['cancellation supervisor rebind', 'cancellation', new Map([[
      'electron/host-core/agent/execution-worker-cancellation.cjs',
      mutate(
        successorCancellation,
        '  const cancelIdentity = identity;',
        '  const cancelIdentity = identity;\n  supervisor = unrelatedSupervisor;',
        'cancellation supervisor rebind',
      ),
    ]])],
    ['cancellation listener after wait', 'cancellation', new Map([[
      'electron/host-core/agent/execution-worker-cancellation.cjs',
      mutate(
        successorCancellation,
        `  signal.addEventListener('abort', onAbort, { once: true });
  if (signal.aborted) onAbort();
  try {
    return await pending;
  } finally {
    signal.removeEventListener('abort', onAbort);
  }`,
        `  if (signal.aborted) onAbort();
  try {
    return await pending;
  } finally {
    signal.removeEventListener('abort', onAbort);
  }
  signal.addEventListener('abort', onAbort, { once: true });`,
        'cancellation listener after wait',
      ),
    ]])],
    ['termination target guard after use', 'termination', new Map([[
      'electron/host-core/agent/execution-worker-termination.cjs',
      mutate(
        successorTermination,
        `    if (!target) return Promise.resolve(false);
    const existing = flights.get(target);
    if (existing) return existing;
    const pid = processId(target.pid);`,
        `    const existing = flights.get(target);
    if (existing) return existing;
    const pid = processId(target.pid);
    if (!target) return Promise.resolve(false);`,
        'termination target guard after use',
      ),
    ]])],
    ['desktop manager rebind', 'desktop', new Map([[
      'electron/host-core/agent/desktop-host-context.cjs',
      mutate(
        successorDesktopHost,
        'async function runAgentInExecutionWorker(identity, signal) {',
        'async function runAgentInExecutionWorker(identity, signal) {\n  executionWorkerManager = unrelatedPool;',
        'desktop manager rebind',
      ),
    ]])],
    ['desktop wrong signal', 'desktop', new Map([[
      'electron/host-core/agent/desktop-host-context.cjs',
      mutate(
        successorDesktopHost,
        "executionWorkerManager.acquire('execution.start', identity, { signal })",
        "executionWorkerManager.acquire('execution.start', identity, { signal: unrelatedSignal })",
        'desktop wrong signal',
      ),
    ]])],
    ['context forced completion', 'desktop', contextBase(mutate(
      successorContextUsageLease,
      '      if (!executionWorkerLease) return false;\n      if (completed) {',
      '      if (!executionWorkerLease) return false;\n      completed = true;\n      if (completed) {',
      'context forced completion',
    ))],
    ['desktop manager parameter shadow', 'desktop', new Map([[
      'electron/host-core/agent/desktop-host-context.cjs',
      mutate(
        successorDesktopHost,
        'async function runAgentInExecutionWorker(identity, signal) {',
        'async function runAgentInExecutionWorker(executionWorkerManager = unrelatedPool, identity, signal) {',
        'desktop manager parameter shadow',
      ),
    ]])],
    ['context release completed parameter shadow', 'desktop', contextBase(mutate(
      successorContextUsageLease,
      '    release: async (executionWorkerLease) => {',
      '    release: async (executionWorkerLease, completed = true) => {',
      'context release completed parameter shadow',
    ))],
    ['context creator release helper parameter shadow', 'desktop', contextBase(mutate(
      successorContextUsageLease,
      'function createExecutionWorkerContextUsageLease({ timeoutMs = 1000 } = {}) {',
      'function createExecutionWorkerContextUsageLease({ timeoutMs = 1000, releaseExecutionWorkerLeaseAfterContextUsage = unrelatedRelease } = {}) {',
      'context creator release helper parameter shadow',
    ))],
    ['context completed destructuring write', 'desktop', contextBase(mutate(
      successorContextUsageLease,
      '      if (!executionWorkerLease) return false;\n      if (completed) {',
      '      if (!executionWorkerLease) return false;\n      ({ completed } = { completed: true });\n      if (completed) {',
      'context completed destructuring write',
    ))],
    ['manager destructuring write', 'manager', new Map([[
      'electron/host-core/agent/execution-worker-manager.cjs',
      mutate(
        currentReleaseSuccessorManager,
        '  const manager = { executions: new Map(), maxConcurrentExecutions: 16, supervisorOptions: {} };',
        '  const manager = { executions: new Map(), maxConcurrentExecutions: 16, supervisorOptions: {} };\n  ({ manager } = { manager: unrelatedManager });',
        'manager destructuring write',
      ),
    ]])],
  ];

  for (const [label, contract, overrides] of variants) {
    const risk = successorRisk(overrides);
    const ast = risk.checks.at(-1).observations.successor_ast_contracts;
    assert.equal(risk.status, 'BLOCKED', label);
    assert.deepEqual(risk.failure_ids, [QWORK_MR1552_FAILURE_IDS[2]], label);
    assert.equal(ast[contract], false, `${label}: AST contract must fail`);
  }
});

test('v5 full audit binds every protected reference to the exact parameter or declaration', () => {
  const mutate = (source, search, replacement, label) => replaceRequired(
    source, search, replacement, label,
  );
  const contextBase = (contextSource = successorContextUsageLease) => new Map([
    ['electron/host-core/agent/execution-worker-manager.cjs', currentReleaseSuccessorManager],
    ['electron/host-core/agent/desktop-host-context.cjs', currentReleaseSuccessorDesktopHost],
    ['electron/host-core/agent/execution-worker-context-usage.cjs', successorContextUsage],
    ['electron/host-core/agent/execution-worker-context-usage-lease.cjs', contextSource],
  ]);
  const oneFile = (path, source) => new Map([[path, source]]);
  const variants = [
    ['cancellation clear deadline parameter shadow', 'cancellation', oneFile(
      'electron/host-core/agent/execution-worker-cancellation.cjs',
      mutate(successorCancellation, 'const clear = () =>', 'const clear = (deadline = unrelatedTimer) =>', 'clear deadline parameter shadow'),
    )],
    ['cancellation arm timer parameter shadow', 'cancellation', oneFile(
      'electron/host-core/agent/execution-worker-cancellation.cjs',
      mutate(successorCancellation, 'armCancellation: () =>', 'armCancellation: (cancellationTimer) =>', 'arm timer parameter shadow'),
    )],
    ['cancellation nested declaration parameter shadow', 'cancellation', oneFile(
      'electron/host-core/agent/execution-worker-cancellation.cjs',
      mutate(successorCancellation, '  const pending = supervisor.request', '  function unrelated(signal) { return signal; }\n  const pending = supervisor.request', 'nested declaration parameter shadow'),
    )],
    ['event message parameter renamed', 'supervisor_message', oneFile(
      'electron/host-core/agent/execution-worker-supervisor-message.cjs',
      mutate(successorSupervisorMessage, 'function handleExecutionWorkerEventMessage(message, {', 'function handleExecutionWorkerEventMessage(renamedMessage, {', 'event message parameter renamed'),
    )],
    ['event dispatch helper parameter shadow', 'supervisor_message', oneFile(
      'electron/host-core/agent/execution-worker-supervisor-message.cjs',
      mutate(successorSupervisorMessage, '  pending, postBrokerResult, terminateChild, child,\n}) {', '  pending, postBrokerResult, terminateChild, child,\n}, dispatchExecutionEvent = unrelatedDispatch) {', 'event dispatch helper parameter shadow'),
    )],
    ['observer message parameter renamed', 'supervisor_message', oneFile(
      'electron/host-core/agent/execution-worker-supervisor-message.cjs',
      mutate(successorSupervisorMessage, 'function handleExecutionWorkerObserverMessage(message, { pending })', 'function handleExecutionWorkerObserverMessage(renamedMessage, { pending })', 'observer message parameter renamed'),
    )],
    ['supervisor onMessage parameter renamed', 'supervisor', oneFile(
      'electron/host-core/agent/execution-worker-supervisor.cjs',
      mutate(successorSupervisor, 'const onMessage = (message) =>', 'const onMessage = (renamedMessage) =>', 'onMessage parameter renamed'),
    )],
    ['supervisor request operation parameter renamed', 'supervisor', oneFile(
      'electron/host-core/agent/execution-worker-supervisor.cjs',
      mutate(successorSupervisor, 'const request = (operation, requestId) =>', 'const request = (renamedOperation, requestId) =>', 'request operation parameter renamed'),
    )],
    ['supervisor promise executor parameters renamed', 'supervisor', oneFile(
      'electron/host-core/agent/execution-worker-supervisor.cjs',
      mutate(successorSupervisor, 'new Promise((resolveRequest, reject) =>', 'new Promise((renamedResolve, renamedReject) =>', 'promise executor parameters renamed'),
    )],
    ['supervisor terminate target parameter renamed', 'supervisor', oneFile(
      'electron/host-core/agent/execution-worker-supervisor.cjs',
      mutate(successorSupervisor, "const terminateChild = (target = child, reason = 'terminated') =>", "const terminateChild = (renamedTarget = child, reason = 'terminated') =>", 'terminate target parameter renamed'),
    )],
    ['supervisor exit parameters renamed', 'supervisor', oneFile(
      'electron/host-core/agent/execution-worker-supervisor.cjs',
      mutate(successorSupervisor, 'const onExit = (code, signal) =>', 'const onExit = (renamedCode, renamedSignal) =>', 'exit parameters renamed'),
    )],
    ['context timeout parameter aliased', 'desktop', contextBase(mutate(
      successorContextUsageLease,
      'function createExecutionWorkerContextUsageLease({ timeoutMs = 1000 } = {})',
      'function createExecutionWorkerContextUsageLease({ timeoutMs: renamedTimeoutMs = 1000 } = {})',
      'context timeout parameter aliased',
    ))],
    ['context terminal payload parameter renamed', 'desktop', contextBase(mutate(
      successorContextUsageLease,
      'observeTerminal: (payload) =>',
      'observeTerminal: (renamedPayload) =>',
      'context terminal payload parameter renamed',
    ))],
    ['desktop identity parameter renamed', 'desktop', oneFile(
      'electron/host-core/agent/desktop-host-context.cjs',
      mutate(successorDesktopHost, 'runAgentInExecutionWorker(identity, signal)', 'runAgentInExecutionWorker(renamedIdentity, signal)', 'desktop identity parameter renamed'),
    )],
    ['desktop signal parameter renamed', 'desktop', oneFile(
      'electron/host-core/agent/desktop-host-context.cjs',
      mutate(successorDesktopHost, 'runAgentInExecutionWorker(identity, signal)', 'runAgentInExecutionWorker(identity, renamedSignal)', 'desktop signal parameter renamed'),
    )],
    ['controller initialize parameter renamed', 'controller', oneFile(
      'electron/host-core/agent/execution-worker-controller.cjs',
      mutate(successorController, 'initialize(message) {', 'initialize(renamedMessage) {', 'controller initialize parameter renamed'),
    )],
    ['controller host raw parameter renamed', 'controller', oneFile(
      'electron/host-core/agent/execution-worker-controller.cjs',
      mutate(successorController, 'onHostMessage(raw) {', 'onHostMessage(renamedRaw) {', 'controller host raw parameter renamed'),
    )],
    ['controller runner raw parameter renamed', 'controller', oneFile(
      'electron/host-core/agent/execution-worker-controller.cjs',
      mutate(successorController, 'onRunnerMessage(raw) {', 'onRunnerMessage(renamedRaw) {', 'controller runner raw parameter renamed'),
    )],
    ...[
      ['requestId', 'validateAcquisition(manager, identity)'],
      ['supervisor', 'createExecutionSupervisor(manager)'],
      ['record', 'createExecutionRecord(supervisor)'],
    ].map(([name, initializer]) => [
      `manager ${name} ObjectPattern write`,
      'manager',
      oneFile(
        'electron/host-core/agent/execution-worker-manager.cjs',
        mutate(
          currentReleaseSuccessorManager,
          `  const ${name} = ${initializer};`,
          `  const ${name} = ${initializer};\n  ({ ${name} } = { ${name}: unrelatedValue });`,
          `manager ${name} ObjectPattern write`,
        ),
      ),
    ]),
    ['manager requestId ArrayPattern write', 'manager', oneFile(
      'electron/host-core/agent/execution-worker-manager.cjs',
      mutate(
        currentReleaseSuccessorManager,
        '  const requestId = validateAcquisition(manager, identity);',
        '  const requestId = validateAcquisition(manager, identity);\n  [requestId] = [unrelatedValue];',
        'manager requestId ArrayPattern write',
      ),
    )],
  ];

  for (const [label, contract, overrides] of variants) {
    const risk = successorRisk(overrides);
    const ast = risk.checks.at(-1).observations.successor_ast_contracts;
    assert.equal(risk.status, 'BLOCKED', label);
    assert.equal(risk.verified, false, label);
    assert.deepEqual(risk.failure_ids, [QWORK_MR1552_FAILURE_IDS[2]], label);
    assert.equal(ast[contract], false, `${label}: AST contract must fail`);
    assert.equal(ast.passed, false, `${label}: aggregate AST contract must fail`);
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

test('v5 full audit rejects parameter defaults, writes, loop writes and nested shadows across every protected callback', () => {
  const oneFile = (filePath, source) => new Map([[filePath, source]]);
  const mutate = (source, search, replacement, label) => replaceRequired(
    source, search, replacement, label,
  );
  const contextFiles = (leaseSource) => new Map([
    ['electron/host-core/agent/desktop-host-context.cjs', currentReleaseSuccessorDesktopHost],
    ['electron/host-core/agent/execution-worker-context-usage.cjs', successorContextUsage],
    ['electron/host-core/agent/execution-worker-context-usage-lease.cjs', leaseSource],
  ]);
  const variants = [
    ['cancellation catch parameter shadow', 'cancellation', oneFile(
      'electron/host-core/agent/execution-worker-cancellation.cjs',
      mutate(successorCancellation, '  const pending = supervisor.request',
        '  try {} catch (supervisor) {}\n  const pending = supervisor.request', 'cancellation catch parameter shadow'),
    )],
    ['cancellation for-of supervisor write', 'cancellation', oneFile(
      'electron/host-core/agent/execution-worker-cancellation.cjs',
      mutate(successorCancellation, '  const pending = supervisor.request',
        '  for (supervisor of [unrelatedSupervisor]) {}\n  const pending = supervisor.request', 'cancellation for-of supervisor write'),
    )],
    ['cancellation for-in supervisor write', 'cancellation', oneFile(
      'electron/host-core/agent/execution-worker-cancellation.cjs',
      mutate(successorCancellation, '  const pending = supervisor.request',
        '  for (supervisor in { bad: true }) {}\n  const pending = supervisor.request', 'cancellation for-in supervisor write'),
    )],
    ...[
      ['settlement direct child write', '  child = unrelatedChild;'],
      ['settlement compound deadline write', '  deadlineMs += 999999;'],
      ['settlement update cancellation timeout', '  cancellationTimeoutMs++;'],
      ['settlement object terminator write', '  ({ terminateChild } = source);'],
      ['settlement array deadline callback write', '  [onDeadline] = source;'],
      ['settlement for-of resolve write', '  for (resolve of [unrelatedResolve]) {}'],
    ].map(([label, statement]) => [label, 'cancellation', oneFile(
      'electron/host-core/agent/execution-worker-cancellation.cjs',
      mutate(successorCancellation, '  let cancellationTimer = null;',
        `${statement}\n  let cancellationTimer = null;`, label),
    )]),
    ['settlement child default', 'cancellation', oneFile(
      'electron/host-core/agent/execution-worker-cancellation.cjs',
      mutate(successorCancellation,
        '  child, operation, deadlineMs, cancellationTimeoutMs, terminateChild, onDeadline, resolve, reject,',
        '  child = unrelatedChild, operation, deadlineMs, cancellationTimeoutMs, terminateChild, onDeadline, resolve, reject,',
        'settlement child default'),
    )],
    ...[
      ['controller parentPort default', 'parentPort = process.parentPort', 'parentPort = unrelatedPort'],
      ['controller exit default', 'exit = (code) => process.exit(code)', 'exit = unrelatedExit'],
      ['controller host raw write', "    const message = this.decode(raw, 'host-to-worker');", "    raw = unrelatedRaw;\n    const message = this.decode(raw, 'host-to-worker');"],
      ['controller initialize message write', '    if (this.authority) return false;', '    message = unrelatedMessage;\n    if (this.authority) return false;'],
      ['controller decode direction write', '    try { return validateEnvelope(raw, { direction }); }', '    direction = unrelatedDirection;\n    try { return validateEnvelope(raw, { direction }); }'],
      ['controller host nested function parameter shadow', "    const message = this.decode(raw, 'host-to-worker');", "    function hidden(raw) {}\n    const message = this.decode(raw, 'host-to-worker');"],
    ].map(([label, search, replacement]) => [label, 'controller', oneFile(
      'electron/host-core/agent/execution-worker-controller.cjs',
      mutate(successorController, search, replacement, label),
    )]),
    ...[
      ['manager direct manager write', '  manager = unrelatedManager;'],
      ['manager direct identity write', '  identity = unrelatedIdentity;'],
      ['manager direct options write', '  options = unrelatedOptions;'],
      ['manager direct operation write', '  operation = unrelatedOperation;'],
      ['manager object manager write', '  ({ manager } = source);'],
      ['manager array identity write', '  [identity] = source;'],
      ['manager update write', '  manager++;'],
      ['manager for-of write', '  for (manager of [unrelatedManager]) {}'],
    ].map(([label, statement]) => [label, 'manager', oneFile(
      'electron/host-core/agent/execution-worker-manager.cjs',
      mutate(successorManager, '  const requestId = identity.requestId;',
        `${statement}\n  const requestId = identity.requestId;`, label),
    )]),
    ...[
      ['supervisor message write', '  const onMessage = (message) => {', '  const onMessage = (message) => {\n    message = unrelatedMessage;'],
      ['supervisor requestId write', '  const request = (operation, requestId) => new Promise((resolveRequest, reject) => {', '  const request = (operation, requestId) => new Promise((resolveRequest, reject) => {\n    requestId = unrelatedRequestId;'],
      ['supervisor message nested function parameter shadow', '  const onMessage = (message) => {', '  const onMessage = (message) => {\n    function hidden(message) {}'],
    ].map(([label, search, replacement]) => [label, 'supervisor', oneFile(
      'electron/host-core/agent/execution-worker-supervisor.cjs',
      mutate(successorSupervisor, search, replacement, label),
    )]),
    ...[
      ['event message write', '  const item = pending.get(message.requestId);', '  message = unrelatedMessage;\n  const item = pending.get(message.requestId);'],
      ['event pending write', '  const item = pending.get(message.requestId);', '  pending = unrelatedPending;\n  const item = pending.get(message.requestId);'],
      ['event nested function parameter shadow', '  const item = pending.get(message.requestId);', '  function hidden(pending) {}\n  const item = pending.get(message.requestId);'],
      ['event pending default', '  pending, postBrokerResult, terminateChild, child,', '  pending = unrelatedPending, postBrokerResult, terminateChild, child,'],
    ].map(([label, search, replacement]) => [label, 'supervisor_message', oneFile(
      'electron/host-core/agent/execution-worker-supervisor-message.cjs',
      mutate(successorSupervisorMessage, search, replacement, label),
    )]),
    ['observer message write', 'supervisor_message', oneFile(
      'electron/host-core/agent/execution-worker-supervisor-message.cjs',
      mutate(successorSupervisorMessage,
        'function handleExecutionWorkerObserverMessage(message, { pending }) {',
        'function handleExecutionWorkerObserverMessage(message, { pending }) {\n  message = unrelatedMessage;',
        'observer message write'),
    )],
    ...[
      ['termination target write', '    target = unrelatedTarget;'],
      ['termination reason write', '    reason = unrelatedReason;'],
      ['termination processId write', '    processId = unrelatedProcessId;'],
      ['termination object target write', '    ({ target } = source);'],
      ['termination for-of target write', '    for (target of [unrelatedTarget]) {}'],
    ].map(([label, statement]) => [label, 'termination', oneFile(
      'electron/host-core/agent/execution-worker-termination.cjs',
      mutate(successorTermination, '    if (!target) return Promise.resolve(false);',
        `${statement}\n    if (!target) return Promise.resolve(false);`, label),
    )]),
    ['desktop for-of identity write', 'desktop', oneFile(
      'electron/host-core/agent/desktop-host-context.cjs',
      mutate(successorDesktopHost, '  let executionWorkerLease = null;',
        '  for (identity of [unrelatedIdentity]) {}\n  let executionWorkerLease = null;', 'desktop for-of identity write'),
    )],
    ['desktop for-of lease write', 'desktop', oneFile(
      'electron/host-core/agent/desktop-host-context.cjs',
      mutate(successorDesktopHost, '    const supervisor = executionWorkerLease.supervisor;',
        '    for (executionWorkerLease of [unrelatedLease]) {}\n    const supervisor = executionWorkerLease.supervisor;', 'desktop for-of lease write'),
    )],
    ...[
      ['context drain lease write', '  const requestedTimeout = Number(timeoutMs);', '  lease = unrelatedLease;\n  const requestedTimeout = Number(timeoutMs);'],
      ['context drain timeout update', '  const requestedTimeout = Number(timeoutMs);', '  timeoutMs++;\n  const requestedTimeout = Number(timeoutMs);'],
      ['context creator timeout for-of write', '  let completed = false;', '  for (timeoutMs of [unrelatedTimeout]) {}\n  let completed = false;'],
      ['context release lease write', '      if (!executionWorkerLease) return false;', '      executionWorkerLease = unrelatedLease;\n      if (!executionWorkerLease) return false;'],
      ['context release nested function parameter shadow', '      if (!executionWorkerLease) return false;', '      function hidden(executionWorkerLease) {}\n      if (!executionWorkerLease) return false;'],
      ['context timeout default',
        'function createExecutionWorkerContextUsageLease({ timeoutMs = 1000 } = {})',
        'function createExecutionWorkerContextUsageLease({ timeoutMs = unrelatedTimeout } = {})'],
    ].map(([label, search, replacement]) => [label, 'desktop', contextFiles(
      mutate(successorContextUsageLease, search, replacement, label),
    )]),
    ['termination cleanup default drift', 'termination', oneFile(
      'electron/host-core/agent/execution-worker-termination.cjs',
      mutate(successorTermination, 'cleanupGraceMs = 250', 'cleanupGraceMs = 251',
        'termination cleanup default drift'),
    )],
    ['supervisor cleanup option drift', 'supervisor', oneFile(
      'electron/host-core/agent/execution-worker-supervisor.cjs',
      mutate(successorSupervisor, 'cleanupGraceMs: 250', 'cleanupGraceMs: 251',
        'supervisor cleanup option drift'),
    )],
    ...[
      ['context drain timeout default drift',
        'function releaseExecutionWorkerLeaseAfterContextUsage(lease, settlement, { timeoutMs = 1000 } = {})',
        'function releaseExecutionWorkerLeaseAfterContextUsage(lease, settlement, { timeoutMs = 1001 } = {})'],
      ['context creator timeout default drift',
        'function createExecutionWorkerContextUsageLease({ timeoutMs = 1000 } = {})',
        'function createExecutionWorkerContextUsageLease({ timeoutMs = 1001 } = {})'],
    ].map(([label, search, replacement]) => [label, 'desktop', contextFiles(
      mutate(successorContextUsageLease, search, replacement, label),
    )]),
    ['desktop context timeout default drift', 'desktop', oneFile(
      'electron/host-core/agent/desktop-host-context.cjs',
      mutate(currentReleaseSuccessorDesktopHost,
        'contextUsageReleaseTimeoutMs = 1000', 'contextUsageReleaseTimeoutMs = 1001',
        'desktop context timeout default drift'),
    )],
    ...[
      ['controller finish default parameter', 'finish(code) {', 'finish(code = 0) {'],
      ['controller error default parameter', 'onRunnerError(error) {', 'onRunnerError(error = null) {'],
      ['controller exit handler default parameter', 'onRunnerExit(code) {', 'onRunnerExit(code = 0) {'],
      ['controller start wrapper default parameter',
        'function startExecutionWorkerController(options) {',
        'function startExecutionWorkerController(options = {}) {'],
    ].map(([label, search, replacement]) => [label, 'controller', oneFile(
      'electron/host-core/agent/execution-worker-controller.cjs',
      mutate(successorController, search, replacement, label),
    )]),
    ...['requestId', 'supervisor', 'record', 'release'].map((name) => [
      `manager nested ${name} parameter shadow`, 'manager', oneFile(
        'electron/host-core/agent/execution-worker-manager.cjs',
        mutate(successorManager, '  const requestId = identity.requestId;',
          `  function hidden(${name}) {}\n  const requestId = identity.requestId;`,
          `manager nested ${name} parameter shadow`),
      ),
    ]),
    ['manager creator nested manager parameter shadow', 'manager', oneFile(
      'electron/host-core/agent/execution-worker-manager.cjs',
      mutate(successorManager, 'function createExecutionWorkerManager(manager) {',
        'function createExecutionWorkerManager(manager) {\n  function hidden(manager) {}',
        'manager creator nested manager parameter shadow'),
    )],
    ...['pending', 'child'].map((name) => [
      `supervisor creator nested ${name} parameter shadow`, 'supervisor', oneFile(
        'electron/host-core/agent/execution-worker-supervisor.cjs',
        mutate(successorSupervisor, 'function createExecutionWorkerSupervisor() {',
          `function createExecutionWorkerSupervisor() {\n  function hidden(${name}) {}`,
          `supervisor creator nested ${name} parameter shadow`),
      ),
    ]),
    ['termination creator nested processTreeKiller parameter shadow', 'termination', oneFile(
      'electron/host-core/agent/execution-worker-termination.cjs',
      mutate(successorTermination,
        'function createExecutionWorkerTerminator({ processId, processTreeKiller, cleanupGraceMs = 250 } = {}) {',
        'function createExecutionWorkerTerminator({ processId, processTreeKiller, cleanupGraceMs = 250 } = {}) {\n  function hidden(processTreeKiller) {}',
        'termination creator nested processTreeKiller parameter shadow'),
    )],
    ['settlement nested cancellationTimer parameter shadow', 'cancellation', oneFile(
      'electron/host-core/agent/execution-worker-cancellation.cjs',
      mutate(successorCancellation, '  let cancellationTimer = null;',
        '  function hidden(cancellationTimer) {}\n  let cancellationTimer = null;',
        'settlement nested cancellationTimer parameter shadow'),
    )],
    ['supervisor creator child destructuring write', 'supervisor', oneFile(
      'electron/host-core/agent/execution-worker-supervisor.cjs',
      mutate(successorSupervisor, '  const onMessage = (message) => {',
        '  [child] = [unrelatedChild];\n  const onMessage = (message) => {',
        'supervisor creator child destructuring write'),
    )],
    ['supervisor creator terminator factory write', 'supervisor', oneFile(
      'electron/host-core/agent/execution-worker-supervisor.cjs',
      mutate(successorSupervisor,
        '  const terminateOwnedChild = createExecutionWorkerTerminator',
        '  createExecutionWorkerTerminator = unrelatedFactory;\n  const terminateOwnedChild = createExecutionWorkerTerminator',
        'supervisor creator terminator factory write'),
    )],
    ...[
      ['manager wait helper manager parameter rename',
        'function waitForExecutionSlot(manager, requestId, signal)',
        'function waitForExecutionSlot(renamedManager, requestId, signal)'],
      ['manager wait helper requestId parameter rename',
        'function waitForExecutionSlot(manager, requestId, signal)',
        'function waitForExecutionSlot(manager, renamedRequestId, signal)'],
    ].map(([label, search, replacement]) => [label, 'manager', oneFile(
      'electron/host-core/agent/execution-worker-manager.cjs',
      mutate(currentReleaseSuccessorManager, search, replacement, label),
    )]),
  ];

  const safeVariants = [
    ['controller explicit same-name default alias', oneFile(
      'electron/host-core/agent/execution-worker-controller.cjs',
      mutate(successorController, 'parentPort = process.parentPort',
        'parentPort: parentPort = process.parentPort',
        'controller explicit same-name default alias'),
    )],
    ['supervisor-message string same-name property', oneFile(
      'electron/host-core/agent/execution-worker-supervisor-message.cjs',
      mutate(successorSupervisorMessage,
        '  pending, postBrokerResult, terminateChild, child,',
        "  'pending': pending, postBrokerResult, terminateChild, child,",
        'supervisor-message string same-name property'),
    )],
    ['supervisor-message reordered properties', oneFile(
      'electron/host-core/agent/execution-worker-supervisor-message.cjs',
      mutate(successorSupervisorMessage,
        '  pending, postBrokerResult, terminateChild, child,',
        '  child, terminateChild, postBrokerResult, pending,',
        'supervisor-message reordered properties'),
    )],
  ];

  assert.equal(successorRisk().status, 'VERIFIED');
  assert.equal(successorRisk(contextFiles(successorContextUsageLease)).status, 'VERIFIED');
  assert.equal(variants.length, 67);
  for (const [label, contract, overrides] of variants) {
    const risk = successorRisk(overrides);
    const ast = risk.checks.at(-1).observations.successor_ast_contracts;
    assert.equal(risk.status, 'BLOCKED', label);
    assert.deepEqual(risk.failure_ids, [QWORK_MR1552_FAILURE_IDS[2]], label);
    assert.equal(ast[contract], false, `${label}: AST contract must fail`);
    assert.equal(ast.passed, false, `${label}: aggregate AST contract must fail`);
  }
  assert.equal(safeVariants.length, 3);
  for (const [label, overrides] of safeVariants) {
    const risk = successorRisk(overrides);
    assert.equal(risk.status, 'VERIFIED', label);
    assert.deepEqual(risk.failure_ids, [], label);
    assert.equal(risk.checks.at(-1).observations.successor_ast_contracts.passed, true, label);
  }
});

test('v5 public audit rejects every referenced-parameter rename and added-default mutation', () => {
  const baseline = new Map([
    ['electron/execution-worker.cjs', successorEntry],
    ['electron/host-core/agent/execution-worker-controller.cjs', successorController],
    ['electron/host-core/agent/execution-worker-cancellation.cjs', successorCancellation],
    ['electron/host-core/agent/execution-worker-manager.cjs', currentReleaseSuccessorManager],
    ['electron/host-core/agent/execution-worker-supervisor.cjs', successorSupervisor],
    ['electron/host-core/agent/execution-worker-supervisor-message.cjs', successorSupervisorMessage],
    ['electron/host-core/agent/execution-worker-termination.cjs', successorTermination],
    ['electron/host-core/agent/desktop-host-context.cjs', currentReleaseSuccessorDesktopHost],
    ['electron/host-core/agent/execution-worker-context-usage.cjs', successorContextUsage],
    ['electron/host-core/agent/execution-worker-context-usage-lease.cjs', successorContextUsageLease],
  ]);
  const functionTypes = new Set([
    'ArrowFunctionExpression', 'FunctionDeclaration', 'FunctionExpression',
  ]);
  const children = (node) => {
    const result = [];
    for (const [key, value] of Object.entries(node || {})) {
      if (['end', 'loc', 'range', 'start', 'type'].includes(key)) continue;
      if (Array.isArray(value)) {
        for (const item of value) if (item?.type) result.push(item);
      } else if (value?.type) result.push(value);
    }
    return result;
  };
  const walk = (node, callback, parent = null) => {
    if (!node) return;
    callback(node, parent);
    for (const child of children(node)) walk(child, callback, node);
  };
  const bindings = (pattern, result = []) => {
    if (!pattern) return result;
    if (pattern.type === 'Identifier') result.push(pattern);
    else if (pattern.type === 'AssignmentPattern') bindings(pattern.left, result);
    else if (pattern.type === 'RestElement') bindings(pattern.argument, result);
    else if (pattern.type === 'ObjectPattern') {
      for (const property of pattern.properties) {
        bindings(property.type === 'RestElement' ? property.argument : property.value, result);
      }
    } else if (pattern.type === 'ArrayPattern') {
      for (const element of pattern.elements) bindings(element, result);
    }
    return result;
  };
  const isReference = (node, parent) => {
    if (!parent) return true;
    if (parent.type === 'MemberExpression' && parent.property === node && !parent.computed) return false;
    if (parent.type === 'Property' && parent.key === node && !parent.computed
      && (!parent.shorthand || parent.value !== node)) return false;
    if (parent.type === 'MethodDefinition' && parent.key === node && !parent.computed) return false;
    if (parent.type === 'VariableDeclarator' && parent.id === node) return false;
    if (functionTypes.has(parent.type)
      && (parent.id === node || parent.params.includes(node))) return false;
    if (['BreakStatement', 'ContinueStatement', 'LabeledStatement'].includes(parent.type)
      && parent.label === node) return false;
    return true;
  };
  const mutations = [];
  let functionCount = 0;
  for (const [filePath, source] of baseline) {
    const program = parse(source, { ecmaVersion: 'latest', sourceType: 'script' });
    walk(program, (node) => {
      if (!functionTypes.has(node.type)) return;
      functionCount += 1;
      for (const parameter of node.params) {
        for (const binding of bindings(parameter)) {
          let referenced = false;
          walk(node.body, (candidate, parent) => {
            if (candidate.type === 'Identifier' && candidate.name === binding.name
              && isReference(candidate, parent)) referenced = true;
          });
          if (!referenced) continue;
          mutations.push({
            filePath,
            label: `${filePath}:${node.start}:${binding.name}:rename`,
            source: `${source.slice(0, binding.start)}renamed_${binding.name}${source.slice(binding.end)}`,
          });
          if (parameter.type === 'Identifier') {
            mutations.push({
              filePath,
              label: `${filePath}:${node.start}:${binding.name}:default`,
              source: `${source.slice(0, parameter.start)}${binding.name} = undefined${source.slice(parameter.end)}`,
            });
          }
        }
      }
    });
  }

  assert.equal(successorRisk(baseline).status, 'VERIFIED');
  assert.equal(functionCount, 72);
  assert.equal(mutations.length, 174);
  for (const mutation of mutations) {
    const overrides = new Map(baseline);
    overrides.set(mutation.filePath, mutation.source);
    const risk = successorRisk(overrides);
    assert.equal(risk.status, 'BLOCKED', mutation.label);
    assert.equal(risk.verified, false, mutation.label);
  }
});

test('v5 public audit rejects every critical factory, helper, builtin and member rebind', () => {
  const paths = {
    cancellation: 'electron/host-core/agent/execution-worker-cancellation.cjs',
    context: 'electron/host-core/agent/execution-worker-context-usage-lease.cjs',
    contextWrapper: 'electron/host-core/agent/execution-worker-context-usage.cjs',
    controller: 'electron/host-core/agent/execution-worker-controller.cjs',
    desktop: 'electron/host-core/agent/desktop-host-context.cjs',
    manager: 'electron/host-core/agent/execution-worker-manager.cjs',
    message: 'electron/host-core/agent/execution-worker-supervisor-message.cjs',
    supervisor: 'electron/host-core/agent/execution-worker-supervisor.cjs',
    termination: 'electron/host-core/agent/execution-worker-termination.cjs',
  };
  const oneFile = (filePath, source) => new Map([[filePath, source]]);
  const contextFiles = (leaseSource, desktopSource = currentReleaseSuccessorDesktopHost) => new Map([
    [paths.manager, currentReleaseSuccessorManager],
    [paths.contextWrapper, successorContextUsage],
    [paths.context, leaseSource],
    [paths.desktop, desktopSource],
  ]);
  const mutate = (source, search, replacement, label) => replaceRequired(
    source, search, replacement, label,
  );
  const insert = (source, anchor, statement, label) => mutate(
    source, anchor, `${statement}\n${anchor}`, label,
  );

  const variants = [];
  for (const [name, replacement] of [
    ['validateEnvelope', 'unrelatedValidateEnvelope'],
    ['sameIdentity', 'unrelatedSameIdentity'],
    ['AUTHORITY_FIELDS', 'unrelatedAuthorityFields'],
    ['TURN_FIELDS', 'unrelatedTurnFields'],
    ['Worker', 'UnrelatedWorker'],
    ['require', 'unrelatedRequire'],
    ['process', 'unrelatedProcess'],
    ['ExecutionWorkerController', 'UnrelatedExecutionWorkerController'],
  ]) {
    variants.push([
      `controller top-level ${name} rebind`,
      'controller',
      oneFile(paths.controller, insert(
        successorController,
        'class ExecutionWorkerController {',
        `${name} = ${replacement};`,
        `controller top-level ${name} rebind`,
      )),
    ]);
  }

  for (const name of [
    'validateAcquisition', 'waitForExecutionSlot', 'createExecutionSupervisor',
    'createExecutionRecord', 'executionWorkerLease', 'stopExecutionRecord',
    'releaseExecutionRecord',
  ]) {
    variants.push([
      `manager top-level ${name} rebind`,
      'manager',
      oneFile(paths.manager, insert(
        currentReleaseSuccessorManager,
        'async function acquireExecutionWorker',
        `${name} = unrelatedHelper;`,
        `manager top-level ${name} rebind`,
      )),
    ]);
  }
  for (const [label, anchor, statement] of [
    [
      'manager supervisorFactory member rebind',
      '  const requestId = validateAcquisition(manager, identity);',
      '  manager.supervisorFactory = unrelatedFactory;',
    ],
    [
      'manager executions member rebind',
      '  const requestId = validateAcquisition(manager, identity);',
      '  manager.executions = unrelatedExecutions;',
    ],
    [
      'manager record supervisor member rebind',
      '  manager.executions.set(requestId, record);',
      '  record.supervisor = unrelatedSupervisor;',
    ],
  ]) {
    variants.push([label, 'manager', oneFile(paths.manager, insert(
      currentReleaseSuccessorManager, anchor, statement, label,
    ))]);
  }

  for (const name of [
    'createChild', 'processId', 'processTreeKiller', 'postBrokerResult', 'deadlineMs',
    'cancellationTimeoutMs', 'isExecutionWorkerTerminalOperation', 'rejectPending',
    'executionWorkerExitFailure',
  ]) {
    variants.push([
      `supervisor creator ${name} rebind`,
      'supervisor',
      oneFile(paths.supervisor, mutate(
        successorSupervisor,
        'function createExecutionWorkerSupervisor() {',
        `function createExecutionWorkerSupervisor() {\n  ${name} = unrelatedValue;`,
        `supervisor creator ${name} rebind`,
      )),
    ]);
  }
  variants.push([
    'supervisor top-level Promise rebind',
    'supervisor',
    oneFile(paths.supervisor, insert(
      successorSupervisor,
      'function createExecutionWorkerSupervisor() {',
      'Promise = unrelatedPromise;',
      'supervisor top-level Promise rebind',
    )),
  ]);

  for (const name of ['dispatchExecutionEvent', 'isReservedExecutionWorkerObserverCallback', 'Error']) {
    variants.push([
      `supervisor-message top-level ${name} rebind`,
      'supervisor_message',
      oneFile(paths.message, insert(
        successorSupervisorMessage,
        'function handleExecutionWorkerEventMessage',
        `${name} = unrelatedValue;`,
        `supervisor-message top-level ${name} rebind`,
      )),
    ]);
  }

  for (const name of ['WeakMap', 'Promise', 'setTimeout']) {
    variants.push([
      `termination top-level ${name} rebind`,
      'termination',
      oneFile(paths.termination, insert(
        successorTermination,
        'function createExecutionWorkerTerminator',
        `${name} = unrelatedValue;`,
        `termination top-level ${name} rebind`,
      )),
    ]);
  }

  for (const name of ['Promise', 'setTimeout', 'clearTimeout', 'Math', 'Error']) {
    variants.push([
      `cancellation top-level ${name} rebind`,
      'cancellation',
      oneFile(paths.cancellation, insert(
        successorCancellation,
        'async function requestExecutionWorkerTurn',
        `${name} = unrelatedValue;`,
        `cancellation top-level ${name} rebind`,
      )),
    ]);
  }

  variants.push([
    'desktop top-level context factory rebind',
    'desktop',
    contextFiles(successorContextUsageLease, insert(
      currentReleaseSuccessorDesktopHost,
      'async function runAgentInExecutionWorker',
      'createExecutionWorkerContextUsageLease = unrelatedFactory;',
      'desktop top-level context factory rebind',
    )),
  ]);
  for (const [label, anchor, statement] of [
    [
      'desktop supervisor acquire member rebind',
      '  let executionWorkerLease = null;',
      '  supervisor.acquire = unrelatedAcquire;',
    ],
    [
      'desktop context release member rebind',
      '  try {',
      '  contextUsageLease.release = unrelatedRelease;',
    ],
    [
      'desktop lease request member rebind',
      '    const terminal = await executionWorkerLease.supervisor.request();',
      '    executionWorkerLease.supervisor.request = unrelatedRequest;',
    ],
  ]) {
    variants.push([label, 'desktop', contextFiles(
      successorContextUsageLease,
      insert(currentReleaseSuccessorDesktopHost, anchor, statement, label),
    )]);
  }

  variants.push([
    'context top-level release helper rebind',
    'desktop',
    contextFiles(insert(
      successorContextUsageLease,
      'function createExecutionWorkerContextUsageLease',
      'releaseExecutionWorkerLeaseAfterContextUsage = unrelatedRelease;',
      'context top-level release helper rebind',
    )),
  ]);
  for (const name of ['Promise', 'Number', 'Math', 'setTimeout']) {
    variants.push([
      `context top-level ${name} rebind`,
      'desktop',
      contextFiles(insert(
        successorContextUsageLease,
        'function releaseExecutionWorkerLeaseAfterContextUsage',
        `${name} = unrelatedValue;`,
        `context top-level ${name} rebind`,
      )),
    ]);
  }
  for (const [label, anchor, statement] of [
    [
      'context lease drain member rebind',
      '  const requestedTimeout = Number(timeoutMs);',
      '  lease.drain = unrelatedDrain;',
    ],
    [
      'context execution lease release member rebind',
      '      if (!executionWorkerLease) return false;',
      '      executionWorkerLease.release = unrelatedRelease;',
    ],
  ]) {
    variants.push([label, 'desktop', contextFiles(insert(
      successorContextUsageLease, anchor, statement, label,
    ))]);
  }

  const safeVariants = [
    [
      'unrelated controller helper declaration',
      oneFile(paths.controller, insert(
        successorController,
        'class ExecutionWorkerController {',
        'const unrelatedControllerHelper = () => true;',
        'unrelated controller helper declaration',
      )),
    ],
    [
      'unrelated manager property read',
      oneFile(paths.manager, insert(
        currentReleaseSuccessorManager,
        '  const requestId = validateAcquisition(manager, identity);',
        '  void manager.unrelatedProperty;',
        'unrelated manager property read',
      )),
    ],
    [
      'supervisor-message reordered properties',
      oneFile(paths.message, mutate(
        successorSupervisorMessage,
        '  pending, postBrokerResult, terminateChild, child,',
        '  child, terminateChild, postBrokerResult, pending,',
        'supervisor-message reordered properties',
      )),
    ],
  ];

  assert.equal(successorRisk(contextFiles(successorContextUsageLease)).status, 'VERIFIED');
  assert.equal(variants.length, 50);
  for (const [label, contract, overrides] of variants) {
    const risk = successorRisk(overrides);
    const ast = risk.checks.at(-1).observations.successor_ast_contracts;
    assert.equal(risk.status, 'BLOCKED', label);
    assert.equal(risk.verified, false, label);
    assert.equal(ast[contract], false, `${label}: AST contract must fail`);
    assert.equal(ast.passed, false, `${label}: aggregate AST contract must fail`);
  }
  assert.equal(safeVariants.length, 3);
  for (const [label, overrides] of safeVariants) {
    const risk = successorRisk(overrides);
    assert.equal(risk.status, 'VERIFIED', label);
    assert.equal(risk.verified, true, label);
  }
});

test('v5 public audit resolves lexical bindings and rejects reflective member tampering', () => {
  const paths = {
    context: 'electron/host-core/agent/execution-worker-context-usage-lease.cjs',
    contextWrapper: 'electron/host-core/agent/execution-worker-context-usage.cjs',
    controller: 'electron/host-core/agent/execution-worker-controller.cjs',
    desktop: 'electron/host-core/agent/desktop-host-context.cjs',
    manager: 'electron/host-core/agent/execution-worker-manager.cjs',
    message: 'electron/host-core/agent/execution-worker-supervisor-message.cjs',
    termination: 'electron/host-core/agent/execution-worker-termination.cjs',
  };
  const contextFiles = (leaseSource) => new Map([
    [paths.manager, currentReleaseSuccessorManager],
    [paths.contextWrapper, successorContextUsage],
    [paths.context, leaseSource],
    [paths.desktop, currentReleaseSuccessorDesktopHost],
  ]);
  const variants = [
    [
      'controller decode local validateEnvelope shadow',
      'controller',
      new Map([[paths.controller, replaceRequired(
        successorController,
        '  decode(raw, direction) {\n    try { return validateEnvelope(raw, { direction }); }',
        '  decode(raw, direction) {\n    const validateEnvelope = unrelatedValidateEnvelope;\n    try { return validateEnvelope(raw, { direction }); }',
        'controller decode local validateEnvelope shadow',
      )]]),
    ],
    [
      'controller accept local sameIdentity shadow',
      'controller',
      new Map([[paths.controller, replaceRequired(
        successorController,
        '  acceptMessage(message) {\n    if (message.operation',
        '  acceptMessage(message) {\n    const sameIdentity = unrelatedSameIdentity;\n    if (message.operation',
        'controller accept local sameIdentity shadow',
      )]]),
    ],
    [
      'manager var initialization replaces validateAcquisition binding',
      'manager',
      new Map([[paths.manager, replaceRequired(
        currentReleaseSuccessorManager,
        'function waitForExecutionSlot(manager, requestId, signal) {',
        'var validateAcquisition = unrelatedValidateAcquisition;\nfunction waitForExecutionSlot(manager, requestId, signal) {',
        'manager var initialization replaces validateAcquisition binding',
      )]]),
    ],
    [
      'manager wait shadows Promise builtin',
      'manager',
      new Map([[paths.manager, replaceRequired(
        currentReleaseSuccessorManager,
        'function waitForExecutionSlot(manager, requestId, signal) {\n  if (manager.executions.size',
        'function waitForExecutionSlot(manager, requestId, signal) {\n  const Promise = unrelatedPromise;\n  if (manager.executions.size',
        'manager wait shadows Promise builtin',
      )]]),
    ],
    [
      'supervisor-message deletes protected pending.get member',
      'supervisor_message',
      new Map([[paths.message, replaceRequired(
        successorSupervisorMessage,
        '}) {\n  const item = pending.get(message.requestId);',
        '}) {\n  delete pending.get;\n  const item = pending.get(message.requestId);',
        'supervisor-message deletes protected pending.get member',
      )]]),
    ],
    [
      'termination reflectively replaces protected flights.get member',
      'termination',
      new Map([[paths.termination, replaceRequired(
        successorTermination,
        '  const flights = new WeakMap();\n  return (target, reason',
        "  const flights = new WeakMap();\n  Object.defineProperty(flights, 'get', { value: unrelatedGet });\n  return (target, reason",
        'termination reflectively replaces protected flights.get member',
      )]]),
    ],
    [
      'context helper reflectively replaces protected lease.drain member',
      'desktop',
      contextFiles(replaceRequired(
        successorContextUsageLease,
        '  const requestedTimeout = Number(timeoutMs);',
        "  Reflect.set(lease, 'drain', unrelatedDrain);\n  const requestedTimeout = Number(timeoutMs);",
        'context helper reflectively replaces protected lease.drain member',
      )),
    ],
    [
      'supervisor-message deletes protected computed pending.get member',
      'supervisor_message',
      new Map([[paths.message, replaceRequired(
        successorSupervisorMessage,
        '}) {\n  const item = pending.get(message.requestId);',
        "}) {\n  delete pending['get'];\n  const item = pending.get(message.requestId);",
        'supervisor-message deletes protected computed pending.get member',
      )]]),
    ],
    [
      'termination defineProperties replaces protected flights.get member',
      'termination',
      new Map([[paths.termination, replaceRequired(
        successorTermination,
        '  const flights = new WeakMap();\n  return (target, reason',
        "  const flights = new WeakMap();\n  Object.defineProperties(flights, { get: { value: unrelatedGet } });\n  return (target, reason",
        'termination defineProperties replaces protected flights.get member',
      )]]),
    ],
    [
      'termination Reflect.deleteProperty removes protected flights.get member',
      'termination',
      new Map([[paths.termination, replaceRequired(
        successorTermination,
        '  const flights = new WeakMap();\n  return (target, reason',
        "  const flights = new WeakMap();\n  Reflect.deleteProperty(flights, 'get');\n  return (target, reason",
        'termination Reflect.deleteProperty removes protected flights.get member',
      )]]),
    ],
    [
      'termination Object.assign replaces protected flights.get member',
      'termination',
      new Map([[paths.termination, replaceRequired(
        successorTermination,
        '  const flights = new WeakMap();\n  return (target, reason',
        "  const flights = new WeakMap();\n  Object.assign(flights, { get: unrelatedGet });\n  return (target, reason",
        'termination Object.assign replaces protected flights.get member',
      )]]),
    ],
    [
      'termination dynamic defineProperty on protected flights receiver',
      'termination',
      new Map([[paths.termination, replaceRequired(
        successorTermination,
        '  const flights = new WeakMap();\n  return (target, reason',
        "  const flights = new WeakMap();\n  Object.defineProperty(flights, dynamicMember, dynamicDescriptor);\n  return (target, reason",
        'termination dynamic defineProperty on protected flights receiver',
      )]]),
    ],
  ];

  const safeTermination = replaceRequired(
    successorTermination,
    '  const flights = new WeakMap();\n  return (target, reason',
    "  const flights = new WeakMap();\n  Object.defineProperty(unrelatedObject, 'get', { value: unrelatedGet });\n  return (target, reason",
    'termination unrelated reflective write control',
  );

  assert.equal(successorRisk(contextFiles(successorContextUsageLease)).status, 'VERIFIED');
  assert.equal(variants.length, 12);
  for (const [label, contract, overrides] of variants) {
    const risk = successorRisk(overrides);
    const ast = risk.checks.at(-1).observations.successor_ast_contracts;
    assert.equal(risk.status, 'BLOCKED', label);
    assert.equal(risk.verified, false, label);
    assert.equal(ast[contract], false, `${label}: AST contract must fail`);
    assert.equal(ast.passed, false, `${label}: aggregate AST contract must fail`);
  }
  assert.equal(
    successorRisk(new Map([[paths.termination, safeTermination]])).status,
    'VERIFIED',
    'reflective writes to unrelated objects must remain allowed',
  );
});
