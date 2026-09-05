import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  QWORK_SOAK_CRASH_LEDGER_SCHEMA,
  QWORK_SOAK_DEFAULT_POLICY,
  QWORK_SOAK_IDENTITY_OBSERVATION_SCHEMA,
  QWORK_SOAK_REPORT_SCHEMA,
  QWORK_SOAK_RESOURCE_USAGE_SCHEMA,
  QWORK_SOAK_RESTART_SCHEMA,
  QWORK_SOAK_TASK_SCHEMA,
  qworkSoakReleaseIdentityFingerprint,
} from '../../src/lib/qwork-soak-report.mjs';

export const TEST_RELEASE_IDENTITY = Object.freeze({
  teams_version: '5.6.8',
  teams_build: '2120000000',
  qwork_version: '0.1.7-sit.9',
  control_plane_origin: 'https://deepbank-control-sit.sandbox.deepbank.daikuan.qihoo.net',
  backend_version: 'sit-health-0123456789abcdef',
  prompt_policy_version: `qwork-runtime-0.1.7-sit.9-sha256-${'a'.repeat(64)}`,
  feature_flags_hash: 'b'.repeat(64),
  qwork_ui_git_commit: 'c'.repeat(40),
  qwork_build_id: 'qwork-0.1.7-sit.9',
  qwork_release_manifest_sha256: 'd'.repeat(64),
});

export const TEST_FRAMEWORK_COMMIT = 'e'.repeat(40);

export const SMALL_SOAK_POLICY = Object.freeze({
  ...QWORK_SOAK_DEFAULT_POLICY,
  minimum_tasks: 4,
});

function sha256Bytes(value) {
  return createHash('sha256').update(value).digest('hex');
}

function jsonBytes(value) {
  return Buffer.from(`${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function iso(timestamp) {
  return new Date(timestamp).toISOString();
}

function artifactId(ownerType, ownerId, role) {
  return `${ownerType}:${ownerId}:${role}`;
}

function fileNameForArtifact(id) {
  return `${id.replace(/[^a-zA-Z0-9_.-]+/g, '_')}.json`;
}

function makeContext(epoch, processStartedAt) {
  return {
    host_pid: 50_000 + epoch,
    host_process_started_at: iso(processStartedAt),
    renderer_pid: 60_000 + epoch,
    renderer_process_started_at: iso(processStartedAt + 250),
    session_id: `soak-session-${epoch}`,
    cdp_endpoint: `http://127.0.0.1:${61_000 + epoch}`,
    webview_target_id: `soak-webview-${epoch}`,
  };
}

function addArtifact(report, root, ownerType, ownerId, role, payload) {
  const id = artifactId(ownerType, ownerId, role);
  const file = path.join(root, 'evidence', fileNameForArtifact(id));
  const bytes = jsonBytes(payload);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, bytes);
  report.external_artifacts.push({
    artifact_id: id,
    owner_type: ownerType,
    owner_id: ownerId,
    role,
    media_type: 'application/json',
    path: file,
    bytes: bytes.length,
    sha256: sha256Bytes(bytes),
  });
  return id;
}

function identityReadback(observation, report) {
  return {
    schema_version: 'qbot-qwork-soak-identity-readback/v1',
    evidence_valid: true,
    observation_id: observation.observation_id,
    phase: observation.phase,
    restart_id: observation.restart_id,
    observed_at: observation.observed_at,
    context: observation.context,
    release_identity: report.release_identity,
    release_identity_sha256: report.release_identity_sha256,
    capabilities_readback_attempts: structuredClone(observation.capabilities_readback_attempts),
    runtime: {
      top_level_version: report.release_identity.qwork_version,
      loaded_version: report.release_identity.qwork_version,
      compatibility_version: report.release_identity.qwork_version,
      loaded_verified: true,
      update_phase: 'idle',
      prepared_release: null,
      capabilities_readable: true,
      capabilities_type: 'object',
      workbench_ready: true,
      authenticated: true,
    },
    control_plane_health: {
      http_status: 200,
      ok: true,
      ready: true,
      db_ready: true,
      auth_ready: true,
      origin: report.release_identity.control_plane_origin,
      backend_version: report.release_identity.backend_version,
    },
  };
}

function addIdentityObservation(report, root, {
  observationId,
  phase,
  restartId = '',
  observedAt,
  context,
}) {
  const observation = {
    schema_version: QWORK_SOAK_IDENTITY_OBSERVATION_SCHEMA,
    observation_id: observationId,
    phase,
    restart_id: restartId,
    observed_at: iso(observedAt),
    context,
    release_identity_sha256: report.release_identity_sha256,
    capabilities_readback_attempts: [{
      attempt: 1,
      timeout_ms: 2_000,
      started_at: iso(observedAt - 1),
      ended_at: iso(observedAt),
      duration_ms: 1,
      ok: true,
      value_type: 'object',
      error: '',
    }],
    evidence_valid: true,
    ok: true,
    artifacts: {},
  };
  observation.artifacts.identity_readback = addArtifact(
    report,
    root,
    'identity_observation',
    observationId,
    'identity_readback',
    identityReadback(observation, report),
  );
  report.identity_observations.push(observation);
  return observation;
}

function addTask(report, root, {
  sequence,
  startedAt,
  context,
}) {
  const taskId = `soak-task-${String(sequence).padStart(3, '0')}`;
  const marker = `SOAK_MARKER_${String(sequence).padStart(3, '0')}`;
  const prompt = `Return the exact marker ${marker} after a short health acknowledgement.`;
  const promptSha256 = sha256Bytes(Buffer.from(prompt, 'utf8'));
  const dispatchedAt = startedAt + 250;
  const sendAt = startedAt + 500;
  const terminalAt = startedAt + 1_500;
  const endedAt = startedAt + 2_500;
  const userMessageId = `user-message-${sequence}`;
  const assistantMessageId = `assistant-message-${sequence}`;
  const assistantResponse = `Health acknowledgement complete: ${marker}`;
  const responseSha256 = sha256Bytes(Buffer.from(assistantResponse, 'utf8'));
  const task = {
    schema_version: QWORK_SOAK_TASK_SCHEMA,
    sequence,
    task_id: taskId,
    marker,
    prompt,
    prompt_sha256: promptSha256,
    release_identity_sha256: report.release_identity_sha256,
    context,
    started_at: iso(startedAt),
    dispatched_at: iso(dispatchedAt),
    send_confirmed_at: iso(sendAt),
    terminal_at: iso(terminalAt),
    ended_at: iso(endedAt),
    executed: true,
    inherited: false,
    synthetic: false,
    result: 'succeeded',
    artifacts: {},
  };
  const common = {
    evidence_valid: true,
    task_id: taskId,
    session_id: context.session_id,
    prompt_sha256: promptSha256,
    marker,
    release_identity_sha256: report.release_identity_sha256,
    context,
  };
  task.artifacts.dispatch_receipt = addArtifact(report, root, 'task', taskId, 'dispatch_receipt', {
    schema_version: 'qbot-qwork-soak-dispatch-receipt/v1',
    ...common,
    sequence,
    dispatched: true,
    dispatched_at: task.dispatched_at,
  });
  task.artifacts.send_receipt = addArtifact(report, root, 'task', taskId, 'send_receipt', {
    schema_version: 'qbot-qwork-soak-send-receipt/v1',
    ...common,
    confirmed: true,
    accepted_by_product: true,
    click_count: 1,
    user_message_id: userMessageId,
    confirmed_at: task.send_confirmed_at,
  });
  task.artifacts.terminal_receipt = addArtifact(report, root, 'task', taskId, 'terminal_receipt', {
    schema_version: 'qbot-qwork-soak-terminal-receipt/v1',
    ...common,
    status: 'succeeded',
    running: false,
    reply_present: true,
    assistant_message_id: assistantMessageId,
    assistant_response: assistantResponse,
    assistant_response_sha256: responseSha256,
    completed_at: task.terminal_at,
    stability_observations: [100, 300, 500].map((offset) => ({
      observed_at: iso(terminalAt + offset),
      task_id: taskId,
      session_id: context.session_id,
      prompt_sha256: promptSha256,
      assistant_message_id: assistantMessageId,
      response_sha256: responseSha256,
      marker,
      context,
      running: false,
      status: 'succeeded',
    })),
  });
  report.tasks.push(task);
  return { task, endedAt };
}

function addRestart(report, root, {
  sequence,
  startedAt,
  before,
  after,
}) {
  const restartId = `restart-${sequence}`;
  const stopAt = startedAt + 500;
  const launchAt = startedAt + 1_000;
  const recoveredAt = startedAt + 2_000;
  const endedAt = startedAt + 2_500;
  const beforeObservation = addIdentityObservation(report, root, {
    observationId: `${restartId}-before`,
    phase: 'restart-before',
    restartId,
    observedAt: startedAt - 250,
    context: before,
  });
  const afterObservation = addIdentityObservation(report, root, {
    observationId: `${restartId}-after`,
    phase: 'restart-after',
    restartId,
    observedAt: recoveredAt + 250,
    context: after,
  });
  const restart = {
    schema_version: QWORK_SOAK_RESTART_SCHEMA,
    sequence,
    restart_id: restartId,
    managed: true,
    recovered: true,
    release_identity_sha256: report.release_identity_sha256,
    started_at: iso(startedAt),
    stop_observed_at: iso(stopAt),
    launch_started_at: iso(launchAt),
    recovered_at: iso(recoveredAt),
    ended_at: iso(endedAt),
    before,
    after,
    identity_observation_before_id: beforeObservation.observation_id,
    identity_observation_after_id: afterObservation.observation_id,
    artifacts: {},
  };
  restart.artifacts.restart_receipt = addArtifact(report, root, 'restart', restartId, 'restart_receipt', {
    schema_version: 'qbot-qwork-soak-restart-receipt/v1',
    evidence_valid: true,
    restart_id: restartId,
    sequence,
    managed: true,
    recovered: true,
    release_identity_sha256: report.release_identity_sha256,
    started_at: restart.started_at,
    stop_observed_at: restart.stop_observed_at,
    launch_started_at: restart.launch_started_at,
    recovered_at: restart.recovered_at,
    ended_at: restart.ended_at,
    before,
    after,
    old_host_exit_observed: true,
    new_host_process_observed: true,
    session_file_replaced: true,
    cdp_reachable: true,
    authenticated: true,
    workbench_ready: true,
    capabilities_readable: true,
    runtime_identity_stable: true,
  });
  report.restarts.push(restart);
  return { restart, endedAt };
}

function sampleTimes(start, end, maximumGap) {
  const values = [start];
  const step = Math.max(1, Math.floor(maximumGap / 2));
  for (let current = start + step; current < end; current += step) values.push(current);
  if (end !== start) values.push(end);
  return values;
}

function buildCrashLedger(report, root, epochs) {
  const monitorSamples = [];
  for (const epoch of epochs) {
    for (const observedAt of sampleTimes(
      epoch.start,
      epoch.end,
      report.policy.maximum_resource_sample_gap_ms,
    )) {
      monitorSamples.push({
        sequence: monitorSamples.length + 1,
        observed_at: iso(observedAt),
        context: epoch.context,
        host_alive: true,
        renderer_alive: true,
        unexpected_host_exit_count: 0,
        renderer_crash_count: 0,
        crash_report_count: 0,
      });
    }
  }
  const id = artifactId('crash_ledger', report.run_id, 'crash_ledger');
  const ledger = {
    schema_version: QWORK_SOAK_CRASH_LEDGER_SCHEMA,
    evidence_valid: true,
    window_started_at: report.started_at,
    window_ended_at: report.ended_at,
    crash_count: 0,
    entries: [],
    unexpected_host_exits: [],
    renderer_crashes: [],
    crash_reports: [],
    monitoring_interval_ms: report.policy.maximum_resource_sample_gap_ms,
    monitored_process_roles: ['host', 'qwork_renderer'],
    intentional_restart_ids: report.restarts.map((restart) => restart.restart_id),
    monitored_contexts: epochs.map((epoch) => epoch.context),
    monitor_samples: monitorSamples,
    artifacts: { crash_ledger: id },
  };
  addArtifact(report, root, 'crash_ledger', report.run_id, 'crash_ledger', ledger);
  return ledger;
}

function buildResourceUsage(report, root, epochs) {
  const samples = [];
  for (const [epochIndex, epoch] of epochs.entries()) {
    const times = sampleTimes(epoch.start, epoch.end, report.policy.maximum_resource_sample_gap_ms);
    for (const [sampleIndex, observedAt] of times.entries()) {
      for (const processRole of ['host', 'qwork_renderer']) {
        const renderer = processRole === 'qwork_renderer';
        samples.push({
          sequence: samples.length + 1,
          observed_at: iso(observedAt),
          process_role: processRole,
          pid: renderer ? epoch.context.renderer_pid : epoch.context.host_pid,
          process_started_at: renderer
            ? epoch.context.renderer_process_started_at
            : epoch.context.host_process_started_at,
          session_id: epoch.context.session_id,
          cdp_endpoint: epoch.context.cdp_endpoint,
          rss_bytes: (renderer ? 200 : 100) * 1024 * 1024
            + epochIndex * 2 * 1024 * 1024
            + sampleIndex * 256 * 1024,
        });
      }
    }
  }
  const groups = new Map();
  for (const sample of samples) {
    const key = [
      sample.process_role,
      sample.pid,
      sample.process_started_at,
      sample.session_id,
      sample.cdp_endpoint,
    ].join('|');
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(sample);
  }
  let peak = 0;
  let growth = 0;
  let slope = 0;
  for (const group of groups.values()) {
    const groupPeak = Math.max(...group.map((sample) => sample.rss_bytes));
    peak = Math.max(peak, groupPeak);
    growth = Math.max(growth, groupPeak - group[0].rss_bytes);
    for (let index = 1; index < group.length; index += 1) {
      const elapsed = Date.parse(group[index].observed_at) - Date.parse(group[index - 1].observed_at);
      slope = Math.max(
        slope,
        Math.max(0, group[index].rss_bytes - group[index - 1].rss_bytes) * 60_000 / elapsed,
      );
    }
  }
  const id = artifactId('resource_usage', report.run_id, 'resource_usage');
  const resource = {
    schema_version: QWORK_SOAK_RESOURCE_USAGE_SCHEMA,
    evidence_valid: true,
    window_started_at: report.started_at,
    window_ended_at: report.ended_at,
    sampling_interval_ms: report.policy.maximum_resource_sample_gap_ms,
    thresholds: {
      rss_peak_bytes: report.policy.maximum_rss_peak_bytes,
      rss_growth_bytes: report.policy.maximum_rss_growth_bytes,
      rss_slope_bytes_per_minute: report.policy.maximum_rss_slope_bytes_per_minute,
    },
    samples,
    rss_peak_bytes: peak,
    rss_growth_bytes: growth,
    rss_slope_bytes_per_minute: slope,
    within_thresholds: true,
    leak_detected: false,
    verdict: 'no_leak',
    artifacts: { resource_usage: id },
  };
  addArtifact(report, root, 'resource_usage', report.run_id, 'resource_usage', resource);
  return resource;
}

export function persistQworkSoakFixture(fixture) {
  const bytes = jsonBytes(fixture.report);
  fs.writeFileSync(fixture.reportPath, bytes);
  fixture.reportSha256 = sha256Bytes(bytes);
  return fixture;
}

export function rewriteQworkSoakArtifact(fixture, id, mutate, { mirror = '' } = {}) {
  const descriptor = fixture.report.external_artifacts.find((item) => item.artifact_id === id);
  if (!descriptor) throw new Error(`Unknown artifact: ${id}`);
  const payload = JSON.parse(fs.readFileSync(descriptor.path, 'utf8'));
  mutate(payload);
  const bytes = jsonBytes(payload);
  fs.writeFileSync(descriptor.path, bytes);
  descriptor.bytes = bytes.length;
  descriptor.sha256 = sha256Bytes(bytes);
  if (mirror === 'crash_ledger') fixture.report.crash_ledger = payload;
  if (mirror === 'resource_usage') fixture.report.resource_usage = payload;
  persistQworkSoakFixture(fixture);
  return payload;
}

export function rewriteRawQworkSoakArtifact(fixture, id, value) {
  const descriptor = fixture.report.external_artifacts.find((item) => item.artifact_id === id);
  if (!descriptor) throw new Error(`Unknown artifact: ${id}`);
  const bytes = Buffer.from(String(value), 'utf8');
  fs.writeFileSync(descriptor.path, bytes);
  descriptor.bytes = bytes.length;
  descriptor.sha256 = sha256Bytes(bytes);
  persistQworkSoakFixture(fixture);
}

export function addOrphanQworkSoakArtifact(fixture) {
  addArtifact(fixture.report, fixture.root, 'orphan', 'orphan-1', 'orphan', {
    schema_version: 'qbot-qwork-soak-orphan/v1',
    evidence_valid: true,
  });
  persistQworkSoakFixture(fixture);
}

export function createQworkSoakFixture({
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'qwork-soak-fixture-')),
  taskCount = QWORK_SOAK_DEFAULT_POLICY.minimum_tasks,
  restartCount = QWORK_SOAK_DEFAULT_POLICY.minimum_restarts,
  policy = QWORK_SOAK_DEFAULT_POLICY,
  releaseIdentity = TEST_RELEASE_IDENTITY,
  frameworkCommit = TEST_FRAMEWORK_COMMIT,
  runId = 'strict-soak-run-1',
} = {}) {
  if (!Number.isSafeInteger(taskCount) || taskCount < restartCount + 1) {
    throw new Error('taskCount must cover every restart epoch');
  }
  const normalizedPolicy = { ...policy };
  const releaseIdentityCopy = { ...releaseIdentity };
  const releaseIdentitySha256 = qworkSoakReleaseIdentityFingerprint(releaseIdentityCopy);
  const reportStart = Date.parse('2026-09-05T00:00:00.000Z');
  const report = {
    schema_version: QWORK_SOAK_REPORT_SCHEMA,
    run_id: runId,
    started_at: iso(reportStart),
    ended_at: '',
    framework_commit: frameworkCommit,
    release_identity: releaseIdentityCopy,
    release_identity_sha256: releaseIdentitySha256,
    policy: normalizedPolicy,
    execution: {
      mode: 'live',
      model_tier: 'M3',
      serial: true,
      parallel: 1,
      single_host_pipeline: 1,
      inherited: 0,
      synthetic: 0,
    },
    tasks_completed: taskCount,
    tasks: [],
    restart_count: restartCount,
    restarts: [],
    identity_observations: [],
    crash_count: 0,
    crashes: [],
    resource_leak_detected: false,
    crash_ledger: null,
    resource_usage: null,
    external_artifacts: [],
    evidence_complete: true,
    passed: true,
  };
  let context = makeContext(0, reportStart - 60_000);
  let cursor = reportStart + 1_000;
  addIdentityObservation(report, root, {
    observationId: 'startup',
    phase: 'startup',
    observedAt: cursor,
    context,
  });
  let epochStart = cursor;
  let taskSequence = 1;
  const epochCount = restartCount + 1;
  const baseTasks = Math.floor(taskCount / epochCount);
  const remainder = taskCount % epochCount;
  const epochs = [];
  for (let epochIndex = 0; epochIndex < epochCount; epochIndex += 1) {
    const tasksInEpoch = baseTasks + (epochIndex < remainder ? 1 : 0);
    cursor = Math.max(cursor, epochStart) + 1_000;
    for (let index = 0; index < tasksInEpoch; index += 1) {
      const task = addTask(report, root, { sequence: taskSequence, startedAt: cursor, context });
      taskSequence += 1;
      cursor = task.endedAt + 500;
    }
    if (epochIndex < restartCount) {
      const restartStartedAt = cursor + 500;
      const nextContext = makeContext(epochIndex + 1, restartStartedAt + 1_000);
      const restart = addRestart(report, root, {
        sequence: epochIndex + 1,
        startedAt: restartStartedAt,
        before: context,
        after: nextContext,
      });
      epochs.push({ start: epochStart, end: restartStartedAt, context });
      context = nextContext;
      cursor = restart.endedAt;
      epochStart = cursor;
    }
  }
  const finalObservedAt = cursor + 1_000;
  addIdentityObservation(report, root, {
    observationId: 'run-final',
    phase: 'run-final',
    observedAt: finalObservedAt,
    context,
  });
  epochs.push({ start: epochStart, end: finalObservedAt, context });
  report.ended_at = iso(finalObservedAt + 1_000);
  report.crash_ledger = buildCrashLedger(report, root, epochs);
  report.resource_usage = buildResourceUsage(report, root, epochs);
  const fixture = {
    root,
    report,
    reportPath: path.join(root, 'soak-report.json'),
    reportSha256: '',
    releaseIdentity: releaseIdentityCopy,
    releaseIdentitySha256,
    frameworkCommit,
    artifactIds: {
      crashLedger: artifactId('crash_ledger', runId, 'crash_ledger'),
      resourceUsage: artifactId('resource_usage', runId, 'resource_usage'),
    },
  };
  return persistQworkSoakFixture(fixture);
}
