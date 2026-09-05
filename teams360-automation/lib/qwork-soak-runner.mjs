import { createHash } from 'node:crypto';
import fs from 'node:fs';
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
  readAndAuditQworkSoakReport,
} from '../../src/lib/qwork-soak-report.mjs';
import { createNewManagedOutputDirectory } from './managed-runner-lock.mjs';

const IDENTITY_FIELDS = Object.freeze([
  'teams_version',
  'teams_build',
  'qwork_version',
  'control_plane_origin',
  'backend_version',
  'prompt_policy_version',
  'feature_flags_hash',
  'qwork_ui_git_commit',
  'qwork_build_id',
  'qwork_release_manifest_sha256',
]);

const TASK_RECEIPT_ROLES = Object.freeze([
  'dispatch_receipt',
  'send_receipt',
  'terminal_receipt',
]);

function text(value) {
  return String(value ?? '').trim();
}

function jsonBytes(value) {
  return Buffer.from(`${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function sha256Bytes(value) {
  return createHash('sha256').update(value).digest('hex');
}

function sha256Text(value) {
  return sha256Bytes(Buffer.from(String(value), 'utf8'));
}

function isIso(value) {
  const raw = text(value);
  const parsed = Date.parse(raw);
  return Number.isFinite(parsed) && new Date(parsed).toISOString() === raw;
}

function isPositiveInteger(value) {
  return Number.isSafeInteger(value) && value > 0;
}

function same(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function contextValue(value = {}) {
  return {
    host_pid: value.host_pid,
    host_process_started_at: text(value.host_process_started_at),
    renderer_pid: value.renderer_pid,
    renderer_process_started_at: text(value.renderer_process_started_at),
    session_id: text(value.session_id),
    cdp_endpoint: text(value.cdp_endpoint),
    webview_target_id: text(value.webview_target_id),
  };
}

function assertContext(value, label) {
  const context = contextValue(value);
  let cdp = null;
  try { cdp = new URL(context.cdp_endpoint); } catch {}
  if (!isPositiveInteger(context.host_pid)
    || !isIso(context.host_process_started_at)
    || !isPositiveInteger(context.renderer_pid)
    || !isIso(context.renderer_process_started_at)
    || !context.session_id
    || !cdp
    || cdp.protocol !== 'http:'
    || !['127.0.0.1', 'localhost', '[::1]', '::1'].includes(cdp.hostname)
    || !isPositiveInteger(Number(cdp.port))
    || !context.webview_target_id) {
    throw new Error(`${label} returned an invalid managed host context.`);
  }
  return context;
}

function assertIdentity(identity, expected, fingerprint, label) {
  const normalized = Object.fromEntries(IDENTITY_FIELDS.map((field) => [field, text(identity?.[field])]));
  const wanted = Object.fromEntries(IDENTITY_FIELDS.map((field) => [field, text(expected?.[field])]));
  if (IDENTITY_FIELDS.some((field) => !normalized[field])
    || !same(normalized, wanted)
    || qworkSoakReleaseIdentityFingerprint(normalized) !== fingerprint) {
    throw new Error(`${label} release identity drifted from the frozen candidate.`);
  }
  return normalized;
}

function assertIdentityReadback(readback, expectedIdentity, fingerprint, context, label) {
  if (!readback || readback.evidence_valid !== true || readback.ok !== true) {
    throw new Error(`${label} authoritative identity readback is not valid and ready.`);
  }
  const observedContext = assertContext(readback.context, `${label} identity readback`);
  if (!same(observedContext, context)) throw new Error(`${label} identity context does not match the active host.`);
  assertIdentity(readback.release_identity, expectedIdentity, fingerprint, label);
  const capabilitiesAttempts = readback.capabilities_readback_attempts;
  if (!Array.isArray(capabilitiesAttempts) || capabilitiesAttempts.length < 1
    || capabilitiesAttempts.length > 3
    || capabilitiesAttempts.some((attempt, index) => (
      attempt?.attempt !== index + 1
      || attempt?.timeout_ms !== 2_000
      || !isIso(attempt?.started_at)
      || !isIso(attempt?.ended_at)
      || !Number.isSafeInteger(attempt?.duration_ms)
      || attempt.duration_ms < 0
      || typeof attempt?.ok !== 'boolean'
      || typeof attempt?.error !== 'string'
      || (attempt.ok === true && (attempt.value_type !== 'object' || attempt.error !== ''))
      || (attempt.ok === false && (attempt.value_type !== '' || !attempt.error))
    ))
    || capabilitiesAttempts.at(-1)?.ok !== true
    || capabilitiesAttempts.slice(0, -1).some((attempt) => attempt.ok !== false)) {
    throw new Error(`${label} capabilities attempts ledger is missing or invalid.`);
  }
  const runtime = readback.runtime || {};
  if (runtime.top_level_version !== expectedIdentity.qwork_version
    || runtime.loaded_version !== expectedIdentity.qwork_version
    || runtime.compatibility_version !== expectedIdentity.qwork_version
    || runtime.loaded_verified !== true
    || runtime.update_phase !== 'idle'
    || runtime.prepared_release !== null
    || runtime.capabilities_readable !== true
    || runtime.capabilities_type !== 'object'
    || runtime.workbench_ready !== true
    || runtime.authenticated !== true) {
    throw new Error(`${label} runtime is not stable, authenticated, and ready.`);
  }
  const health = readback.control_plane_health || {};
  if (health.http_status !== 200 || health.ok !== true || health.ready !== true
    || health.db_ready !== true || health.auth_ready !== true
    || text(health.origin).replace(/\/$/, '') !== text(expectedIdentity.control_plane_origin).replace(/\/$/, '')
    || text(health.backend_version) !== text(expectedIdentity.backend_version)) {
    throw new Error(`${label} control-plane health does not match the frozen candidate.`);
  }
}

function assertTaskTimestamps(task) {
  const values = [
    task.started_at,
    task.dispatched_at,
    task.send_confirmed_at,
    task.terminal_at,
    task.ended_at,
  ];
  if (!values.every(isIso)) throw new Error(`Task ${task.sequence} returned an invalid timestamp.`);
  const [started, dispatched, sent, terminal, ended] = values.map(Date.parse);
  if (!(started < dispatched && dispatched <= sent && sent < terminal && terminal <= ended)) {
    throw new Error(`Task ${task.sequence} timeline is not strictly ordered.`);
  }
}

export function validateStableTerminalObservations({
  terminal,
  taskId,
  sessionId,
  promptSha256,
  marker,
  context,
}) {
  const expectedTaskId = text(taskId);
  const expectedSessionId = text(sessionId);
  const expectedPromptSha256 = text(promptSha256);
  const expectedMarker = text(marker);
  const expectedAssistantMessageId = text(terminal?.assistant_message_id);
  const expectedAssistantResponse = String(terminal?.assistant_response ?? '');
  const expectedResponseSha256 = sha256Text(expectedAssistantResponse);
  const observations = Array.isArray(terminal?.stability_observations)
    ? terminal.stability_observations
    : [];

  if (terminal?.status !== 'succeeded' || terminal?.running !== false
    || !expectedAssistantMessageId || !expectedAssistantResponse.trim()
    || !expectedAssistantResponse.includes(expectedMarker) || observations.length < 3) {
    throw new Error('G5 terminal result did not contain a stable successful assistant response.');
  }

  let previousObservedAt = -Infinity;
  for (const [index, observation] of observations.entries()) {
    const ordinal = index + 1;
    const observedAt = Date.parse(text(observation?.observed_at));
    const response = String(observation?.assistant_response ?? '');
    if (!isIso(observation?.observed_at) || observedAt <= previousObservedAt) {
      throw new Error(`G5 stable terminal observation ${ordinal} timestamp is not strictly increasing.`);
    }
    previousObservedAt = observedAt;
    if (text(observation?.task_id) !== expectedTaskId) {
      throw new Error(`G5 stable terminal observation ${ordinal} task identity drifted.`);
    }
    if (text(observation?.session_id) !== expectedSessionId
      || text(observation?.prompt_sha256) !== expectedPromptSha256
      || text(observation?.marker) !== expectedMarker
      || !same(contextValue(observation?.context), context)) {
      throw new Error(`G5 stable terminal observation ${ordinal} run binding drifted.`);
    }
    if (text(observation?.assistant_message_id) !== expectedAssistantMessageId) {
      throw new Error(`G5 stable terminal observation ${ordinal} assistant message identity drifted.`);
    }
    if (response !== expectedAssistantResponse
      || text(observation?.response_sha256) !== expectedResponseSha256
      || sha256Text(response) !== expectedResponseSha256) {
      throw new Error(`G5 stable terminal observation ${ordinal} assistant response drifted.`);
    }
    if (observation?.running !== false || observation?.status !== 'succeeded') {
      throw new Error(`G5 stable terminal observation ${ordinal} was not a successful stopped state.`);
    }
  }
  return observations.map((observation) => structuredClone(observation));
}

function assertRestartTupleChanged(before, after) {
  const fields = [
    'host_pid',
    'host_process_started_at',
    'renderer_pid',
    'renderer_process_started_at',
    'session_id',
    'cdp_endpoint',
    'webview_target_id',
  ];
  const unchanged = fields.filter((field) => before[field] === after[field]);
  if (unchanged.length) {
    throw new Error(`Managed restart did not replace the full host tuple: ${unchanged.join(', ')}`);
  }
}

function computeRestartBoundaries(taskCount, restartCount) {
  const boundaries = new Set();
  for (let index = 1; index <= restartCount; index += 1) {
    boundaries.add(Math.floor(taskCount * index / (restartCount + 1)));
  }
  if (boundaries.size !== restartCount || [...boundaries].some((value) => value < 1 || value >= taskCount)) {
    throw new Error('The requested task/restart counts cannot give every host epoch a real task.');
  }
  return boundaries;
}

function safeName(value) {
  return text(value).replace(/[^a-zA-Z0-9_.-]+/g, '_');
}

function assertNewOutputDirectory(outDir, outputRoot) {
  const resolved = path.resolve(text(outDir));
  if (!path.isAbsolute(text(outDir))) throw new Error('G5 soak output directory must be absolute.');
  createNewManagedOutputDirectory({
    outDir: resolved,
    outputRoot: path.resolve(text(outputRoot || path.dirname(resolved))),
  });
  fs.mkdirSync(path.join(resolved, 'evidence'), { mode: 0o700 });
  return resolved;
}

function validateOptions({ adapter, outDir, releaseIdentity, frameworkCommit, taskCount, restartCount, policy }) {
  const methods = [
    'observeContext',
    'readIdentity',
    'dispatchTask',
    'sendAndConfirm',
    'waitForStableTerminal',
    'sampleProcesses',
    'restartManagedHost',
    'onAbort',
  ];
  const missing = methods.filter((method) => typeof adapter?.[method] !== 'function');
  if (missing.length) throw new Error(`G5 soak adapter is incomplete: ${missing.join(', ')}`);
  if (!path.isAbsolute(text(outDir))) throw new Error('G5 soak output directory must be absolute.');
  if (!/^[a-f0-9]{40}$/.test(text(frameworkCommit))) throw new Error('G5 framework commit must be a 40-character lowercase commit.');
  if (!Number.isSafeInteger(taskCount) || taskCount < policy.minimum_tasks) {
    throw new Error(`G5 requires at least ${policy.minimum_tasks} tasks.`);
  }
  if (!Number.isSafeInteger(restartCount) || restartCount < policy.minimum_restarts) {
    throw new Error(`G5 requires at least ${policy.minimum_restarts} managed restarts.`);
  }
  if (taskCount < restartCount + 1) throw new Error('G5 requires at least one task in every host epoch.');
  const normalizedIdentity = Object.fromEntries(
    IDENTITY_FIELDS.map((field) => [field, text(releaseIdentity?.[field])]),
  );
  if (IDENTITY_FIELDS.some((field) => !normalizedIdentity[field])) {
    throw new Error('G5 release identity must contain all ten frozen fields.');
  }
  return { normalizedIdentity, resolvedOut: path.resolve(outDir) };
}

function resourceSummary(samples) {
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
    group.sort((left, right) => Date.parse(left.observed_at) - Date.parse(right.observed_at));
    const groupPeak = Math.max(...group.map((sample) => sample.rss_bytes));
    peak = Math.max(peak, groupPeak);
    growth = Math.max(growth, groupPeak - group[0].rss_bytes);
    for (let index = 1; index < group.length; index += 1) {
      const elapsed = Date.parse(group[index].observed_at) - Date.parse(group[index - 1].observed_at);
      if (elapsed > 0) {
        slope = Math.max(
          slope,
          Math.max(0, group[index].rss_bytes - group[index - 1].rss_bytes) * 60_000 / elapsed,
        );
      }
    }
  }
  return { peak, growth, slope };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function runQworkSoak({
  adapter,
  outDir,
  outputRoot,
  releaseIdentity,
  frameworkCommit,
  taskCount = QWORK_SOAK_DEFAULT_POLICY.minimum_tasks,
  restartCount = QWORK_SOAK_DEFAULT_POLICY.minimum_restarts,
  policy = QWORK_SOAK_DEFAULT_POLICY,
  taskTimeoutMs = 600_000,
  monitoringIntervalMs = 15_000,
  stableObservationIntervalMs = 1_000,
  runId = `qwork-soak-${new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14)}`,
  promptFactory = ({ marker }) => `请完成一次最小健康检查，并在回复中原样包含唯一标记 ${marker}。`,
} = {}) {
  const normalizedPolicy = { ...policy };
  const checked = validateOptions({
    adapter,
    outDir,
    releaseIdentity,
    frameworkCommit,
    taskCount,
    restartCount,
    policy: normalizedPolicy,
  });
  if (!isPositiveInteger(monitoringIntervalMs)
    || monitoringIntervalMs > normalizedPolicy.maximum_resource_sample_gap_ms) {
    throw new Error('G5 monitoring interval exceeds the audited maximum sample gap.');
  }
  if (!isPositiveInteger(stableObservationIntervalMs)) {
    throw new Error('G5 terminal stability interval must be a positive integer.');
  }
  const root = assertNewOutputDirectory(checked.resolvedOut, outputRoot);
  const releaseIdentitySha256 = qworkSoakReleaseIdentityFingerprint(checked.normalizedIdentity);
  const boundaries = computeRestartBoundaries(taskCount, restartCount);
  const startedAt = text(adapter.now?.() || new Date().toISOString());
  if (!isIso(startedAt)) throw new Error('G5 adapter returned an invalid run start time.');
  const report = {
    schema_version: QWORK_SOAK_REPORT_SCHEMA,
    run_id: text(runId),
    started_at: startedAt,
    ended_at: '',
    framework_commit: text(frameworkCommit),
    release_identity: checked.normalizedIdentity,
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
    tasks_completed: 0,
    tasks: [],
    restart_count: 0,
    restarts: [],
    identity_observations: [],
    crash_count: 0,
    crashes: [],
    resource_leak_detected: false,
    crash_ledger: null,
    resource_usage: null,
    external_artifacts: [],
    evidence_complete: false,
    passed: false,
  };
  const resourceSamples = [];
  const crashSamples = [];
  const unexpectedCrashes = [];
  let context = null;
  let monitor = null;
  let monitorFailure = null;

  const writeArtifact = (ownerType, ownerId, role, payload) => {
    const artifactId = `${ownerType}:${ownerId}:${role}`;
    if (report.external_artifacts.some((item) => item.artifact_id === artifactId)) {
      throw new Error(`G5 artifact identity was reused: ${artifactId}`);
    }
    const file = path.join(root, 'evidence', `${safeName(artifactId)}.json`);
    if (fs.existsSync(file)) throw new Error(`G5 artifact file was reused: ${file}`);
    const bytes = jsonBytes(payload);
    fs.writeFileSync(file, bytes, { mode: 0o600, flag: 'wx' });
    report.external_artifacts.push({
      artifact_id: artifactId,
      owner_type: ownerType,
      owner_id: ownerId,
      role,
      media_type: 'application/json',
      path: file,
      bytes: bytes.length,
      sha256: sha256Bytes(bytes),
    });
    return artifactId;
  };

  const recordSample = async () => {
    if (monitorFailure) return;
    try {
      const sample = await adapter.sampleProcesses({ context });
      const observedAt = text(sample?.observed_at || adapter.now?.() || new Date().toISOString());
      if (!isIso(observedAt) || !same(assertContext(sample?.context, 'G5 process sample'), context)) {
        throw new Error('G5 process sample is not bound to the active context.');
      }
      const roles = [
        ['host', context.host_pid, context.host_process_started_at, sample?.host],
        ['qwork_renderer', context.renderer_pid, context.renderer_process_started_at, sample?.renderer],
      ];
      for (const [role, pid, processStartedAt, processSample] of roles) {
        if (processSample?.alive !== true
          || processSample?.pid !== pid
          || text(processSample?.process_started_at) !== processStartedAt
          || !Number.isSafeInteger(processSample?.rss_bytes)
          || processSample.rss_bytes < 0) {
          throw new Error(`G5 ${role} process sample is invalid or no longer alive.`);
        }
        resourceSamples.push({
          sequence: resourceSamples.length + 1,
          observed_at: observedAt,
          process_role: role,
          pid,
          process_started_at: processStartedAt,
          session_id: context.session_id,
          cdp_endpoint: context.cdp_endpoint,
          rss_bytes: processSample.rss_bytes,
        });
      }
      const newCrashReports = Array.isArray(sample?.new_crash_reports) ? sample.new_crash_reports : [];
      const unexpectedHostExitCount = Number(sample?.unexpected_host_exit_count || 0);
      const rendererCrashCount = Number(sample?.renderer_crash_count || 0);
      if (newCrashReports.length || unexpectedHostExitCount || rendererCrashCount) {
        unexpectedCrashes.push({ observed_at: observedAt, new_crash_reports: newCrashReports });
        throw new Error('G5 crash monitor observed an unexpected host or renderer failure.');
      }
      crashSamples.push({
        sequence: crashSamples.length + 1,
        observed_at: observedAt,
        context,
        host_alive: true,
        renderer_alive: true,
        unexpected_host_exit_count: 0,
        renderer_crash_count: 0,
        crash_report_count: 0,
      });
    } catch (error) {
      monitorFailure = error;
    }
  };

  const startMonitor = async () => {
    if (monitor) throw new Error('G5 epoch monitor is already running.');
    await recordSample();
    if (monitorFailure) throw monitorFailure;
    const activeMonitor = { timer: null, pending: Promise.resolve() };
    activeMonitor.timer = setInterval(() => {
      activeMonitor.pending = activeMonitor.pending.then(recordSample);
    }, monitoringIntervalMs);
    activeMonitor.timer.unref?.();
    monitor = activeMonitor;
  };

  const stopMonitor = async () => {
    if (!monitor) return;
    const activeMonitor = monitor;
    clearInterval(activeMonitor.timer);
    await activeMonitor.pending;
    if (monitor === activeMonitor) monitor = null;
    await sleep(2);
    await recordSample();
    if (monitorFailure) throw monitorFailure;
  };

  const addIdentityObservation = async ({ observationId, phase, restartId = '' }) => {
    const readback = await adapter.readIdentity({
      observationId,
      phase,
      restartId,
      context,
      releaseIdentity: checked.normalizedIdentity,
    });
    assertIdentityReadback(
      readback,
      checked.normalizedIdentity,
      releaseIdentitySha256,
      context,
      observationId,
    );
    const observedAt = text(readback.observed_at);
    if (!isIso(observedAt)) throw new Error(`${observationId} identity timestamp is invalid.`);
    const observation = {
      schema_version: QWORK_SOAK_IDENTITY_OBSERVATION_SCHEMA,
      observation_id: observationId,
      phase,
      restart_id: restartId,
      observed_at: observedAt,
      context,
      release_identity_sha256: releaseIdentitySha256,
      capabilities_readback_attempts: structuredClone(
        readback.capabilities_readback_attempts || [],
      ),
      evidence_valid: true,
      ok: true,
      artifacts: {},
    };
    const payload = {
      schema_version: 'qbot-qwork-soak-identity-readback/v1',
      evidence_valid: true,
      observation_id: observationId,
      phase,
      restart_id: restartId,
      observed_at: observedAt,
      context,
      release_identity: checked.normalizedIdentity,
      release_identity_sha256: releaseIdentitySha256,
      capabilities_readback_attempts: structuredClone(observation.capabilities_readback_attempts),
      runtime: readback.runtime,
      control_plane_health: readback.control_plane_health,
      authoritative_readback: readback.authoritative_readback || null,
    };
    observation.artifacts.identity_readback = writeArtifact(
      'identity_observation',
      observationId,
      'identity_readback',
      payload,
    );
    report.identity_observations.push(observation);
    return observation;
  };

  const checkpoint = (status, error = null) => {
    const file = path.join(root, 'soak-checkpoint.json');
    const value = {
      schema_version: 'qbot-qwork-soak-checkpoint/v1',
      run_id: report.run_id,
      updated_at: text(adapter.now?.() || new Date().toISOString()),
      status,
      tasks_completed: report.tasks.length,
      restart_count: report.restarts.length,
      current_context: context,
      release_identity_sha256: releaseIdentitySha256,
      framework_commit: report.framework_commit,
      report_generated: false,
      error: error ? text(error?.stack || error?.message || error) : '',
    };
    const temporary = `${file}.tmp-${process.pid}`;
    fs.writeFileSync(temporary, jsonBytes(value), { mode: 0o600 });
    fs.renameSync(temporary, file);
    return file;
  };

  try {
    context = assertContext(await adapter.observeContext(), 'G5 startup');
    await addIdentityObservation({ observationId: 'startup', phase: 'startup' });
    await startMonitor();
    checkpoint('running');

    for (let sequence = 1; sequence <= taskCount; sequence += 1) {
      if (monitorFailure) throw monitorFailure;
      const marker = `QWORK_SOAK_${safeName(report.run_id).toUpperCase()}_${String(sequence).padStart(3, '0')}`;
      const prompt = text(promptFactory({ sequence, marker, runId: report.run_id }));
      if (!prompt || !prompt.includes(marker)) throw new Error(`G5 prompt ${sequence} does not contain its unique marker.`);
      const taskStartedAt = text(adapter.now?.() || new Date().toISOString());
      const dispatch = await adapter.dispatchTask({ sequence, marker, prompt, context, taskTimeoutMs });
      const dispatchedAt = text(dispatch?.dispatched_at);
      const send = await adapter.sendAndConfirm({
        sequence,
        marker,
        prompt,
        promptSha256: sha256Text(prompt),
        context,
        dispatch,
        taskTimeoutMs,
      });
      if (send?.confirmed !== true || send?.accepted_by_product !== true || send?.click_count !== 1
        || !text(send?.task_id) || !text(send?.user_message_id) || !isIso(send?.confirmed_at)) {
        throw new Error(`G5 task ${sequence} did not produce a strict one-click send receipt.`);
      }
      const terminal = await adapter.waitForStableTerminal({
        sequence,
        marker,
        prompt,
        promptSha256: sha256Text(prompt),
        taskId: text(send.task_id),
        userMessageId: text(send.user_message_id),
        context,
        taskTimeoutMs,
        stableObservationIntervalMs,
      });
      const stability = validateStableTerminalObservations({
        terminal,
        taskId: text(send.task_id),
        sessionId: context.session_id,
        promptSha256: sha256Text(prompt),
        marker,
        context,
      });
      const task = {
        schema_version: QWORK_SOAK_TASK_SCHEMA,
        sequence,
        task_id: text(send.task_id),
        marker,
        prompt,
        prompt_sha256: sha256Text(prompt),
        release_identity_sha256: releaseIdentitySha256,
        context,
        started_at: taskStartedAt,
        dispatched_at: dispatchedAt,
        send_confirmed_at: text(send.confirmed_at),
        terminal_at: text(terminal.completed_at || stability[0]?.observed_at),
        ended_at: text(terminal.ended_at || stability.at(-1)?.observed_at),
        executed: true,
        inherited: false,
        synthetic: false,
        result: 'succeeded',
        artifacts: {},
      };
      assertTaskTimestamps(task);
      const common = {
        evidence_valid: true,
        task_id: task.task_id,
        session_id: context.session_id,
        prompt_sha256: task.prompt_sha256,
        marker,
        release_identity_sha256: releaseIdentitySha256,
        context,
      };
      const receipts = {
        dispatch_receipt: {
          schema_version: 'qbot-qwork-soak-dispatch-receipt/v1',
          ...common,
          sequence,
          dispatched: true,
          dispatched_at: task.dispatched_at,
          observed: dispatch?.observed || null,
        },
        send_receipt: {
          schema_version: 'qbot-qwork-soak-send-receipt/v1',
          ...common,
          confirmed: true,
          accepted_by_product: true,
          click_count: 1,
          user_message_id: text(send.user_message_id),
          confirmed_at: task.send_confirmed_at,
          observed: send?.observed || null,
        },
        terminal_receipt: {
          schema_version: 'qbot-qwork-soak-terminal-receipt/v1',
          ...common,
          status: 'succeeded',
          running: false,
          reply_present: true,
          assistant_message_id: text(terminal.assistant_message_id),
          assistant_response: String(terminal.assistant_response),
          assistant_response_sha256: sha256Text(String(terminal.assistant_response)),
          completed_at: task.terminal_at,
          stability_observations: stability,
          observed: terminal?.observed || null,
        },
      };
      for (const role of TASK_RECEIPT_ROLES) {
        task.artifacts[role] = writeArtifact('task', task.task_id, role, receipts[role]);
      }
      report.tasks.push(task);
      report.tasks_completed = report.tasks.length;
      checkpoint('running');

      if (boundaries.has(sequence)) {
        await stopMonitor();
        const restartSequence = report.restarts.length + 1;
        const restartId = `restart-${restartSequence}`;
        const before = context;
        const beforeObservation = await addIdentityObservation({
          observationId: `${restartId}-before`,
          phase: 'restart-before',
          restartId,
        });
        const restartResult = await adapter.restartManagedHost({
          sequence: restartSequence,
          restartId,
          before,
          releaseIdentity: checked.normalizedIdentity,
          taskTimeoutMs,
        });
        context = assertContext(await adapter.observeContext(), `${restartId} replacement`);
        if (restartResult?.after && !same(assertContext(restartResult.after, restartId), context)) {
          throw new Error(`${restartId} adapter result does not match the observed replacement context.`);
        }
        assertRestartTupleChanged(before, context);
        const afterObservation = await addIdentityObservation({
          observationId: `${restartId}-after`,
          phase: 'restart-after',
          restartId,
        });
        const restart = {
          schema_version: QWORK_SOAK_RESTART_SCHEMA,
          sequence: restartSequence,
          restart_id: restartId,
          managed: true,
          recovered: true,
          release_identity_sha256: releaseIdentitySha256,
          started_at: text(restartResult?.started_at),
          stop_observed_at: text(restartResult?.stop_observed_at),
          launch_started_at: text(restartResult?.launch_started_at),
          recovered_at: text(restartResult?.recovered_at),
          ended_at: text(restartResult?.ended_at || adapter.now?.() || new Date().toISOString()),
          before,
          after: context,
          identity_observation_before_id: beforeObservation.observation_id,
          identity_observation_after_id: afterObservation.observation_id,
          artifacts: {},
        };
        const restartTimes = [
          restart.started_at,
          restart.stop_observed_at,
          restart.launch_started_at,
          restart.recovered_at,
          restart.ended_at,
        ];
        if (!restartTimes.every(isIso)
          || !(Date.parse(restart.started_at) < Date.parse(restart.stop_observed_at)
            && Date.parse(restart.stop_observed_at) <= Date.parse(restart.launch_started_at)
            && Date.parse(restart.launch_started_at) < Date.parse(restart.recovered_at)
            && Date.parse(restart.recovered_at) <= Date.parse(restart.ended_at))
          || Date.parse(beforeObservation.observed_at) > Date.parse(restart.started_at)
          || Date.parse(afterObservation.observed_at) < Date.parse(restart.recovered_at)
          || Date.parse(afterObservation.observed_at) > Date.parse(restart.ended_at)) {
          throw new Error(`${restartId} timeline is not strictly ordered around identity observations.`);
        }
        const restartReceipt = {
          schema_version: 'qbot-qwork-soak-restart-receipt/v1',
          evidence_valid: true,
          restart_id: restartId,
          sequence: restartSequence,
          managed: true,
          recovered: true,
          release_identity_sha256: releaseIdentitySha256,
          started_at: restart.started_at,
          stop_observed_at: restart.stop_observed_at,
          launch_started_at: restart.launch_started_at,
          recovered_at: restart.recovered_at,
          ended_at: restart.ended_at,
          before,
          after: context,
          old_host_exit_observed: restartResult?.old_host_exit_observed === true,
          new_host_process_observed: restartResult?.new_host_process_observed === true,
          session_file_replaced: restartResult?.session_file_replaced === true,
          cdp_reachable: restartResult?.cdp_reachable === true,
          authenticated: restartResult?.authenticated === true,
          workbench_ready: restartResult?.workbench_ready === true,
          capabilities_readable: restartResult?.capabilities_readable === true,
          runtime_identity_stable: restartResult?.runtime_identity_stable === true,
          observed: restartResult?.observed || null,
        };
        if (Object.entries(restartReceipt)
          .filter(([key]) => [
            'old_host_exit_observed',
            'new_host_process_observed',
            'session_file_replaced',
            'cdp_reachable',
            'authenticated',
            'workbench_ready',
            'capabilities_readable',
            'runtime_identity_stable',
          ].includes(key))
          .some(([, value]) => value !== true)) {
          throw new Error(`${restartId} did not prove a complete managed recovery.`);
        }
        restart.artifacts.restart_receipt = writeArtifact(
          'restart',
          restartId,
          'restart_receipt',
          restartReceipt,
        );
        report.restarts.push(restart);
        report.restart_count = report.restarts.length;
        await startMonitor();
        checkpoint('running');
      }
    }

    await stopMonitor();
    const finalObservation = await addIdentityObservation({ observationId: 'run-final', phase: 'run-final' });
    report.ended_at = text(adapter.now?.() || new Date().toISOString());
    if (!isIso(report.ended_at) || Date.parse(report.ended_at) <= Date.parse(finalObservation.observed_at)) {
      await sleep(2);
      report.ended_at = text(adapter.now?.() || new Date().toISOString());
    }
    if (Date.parse(report.ended_at) <= Date.parse(finalObservation.observed_at)) {
      throw new Error('G5 run-final timestamp did not precede the report boundary.');
    }
    const crashArtifactId = `crash_ledger:${report.run_id}:crash_ledger`;
    report.crash_ledger = {
      schema_version: QWORK_SOAK_CRASH_LEDGER_SCHEMA,
      evidence_valid: true,
      window_started_at: report.started_at,
      window_ended_at: report.ended_at,
      crash_count: 0,
      entries: [],
      unexpected_host_exits: [],
      renderer_crashes: [],
      crash_reports: [],
      monitoring_interval_ms: monitoringIntervalMs,
      monitored_process_roles: ['host', 'qwork_renderer'],
      intentional_restart_ids: report.restarts.map((item) => item.restart_id),
      monitored_contexts: [
        report.identity_observations[0].context,
        ...report.restarts.map((item) => item.after),
      ],
      monitor_samples: crashSamples,
      artifacts: { crash_ledger: crashArtifactId },
    };
    writeArtifact('crash_ledger', report.run_id, 'crash_ledger', report.crash_ledger);

    const metrics = resourceSummary(resourceSamples);
    const resourceArtifactId = `resource_usage:${report.run_id}:resource_usage`;
    report.resource_usage = {
      schema_version: QWORK_SOAK_RESOURCE_USAGE_SCHEMA,
      evidence_valid: true,
      window_started_at: report.started_at,
      window_ended_at: report.ended_at,
      sampling_interval_ms: monitoringIntervalMs,
      thresholds: {
        rss_peak_bytes: normalizedPolicy.maximum_rss_peak_bytes,
        rss_growth_bytes: normalizedPolicy.maximum_rss_growth_bytes,
        rss_slope_bytes_per_minute: normalizedPolicy.maximum_rss_slope_bytes_per_minute,
      },
      samples: resourceSamples,
      rss_peak_bytes: metrics.peak,
      rss_growth_bytes: metrics.growth,
      rss_slope_bytes_per_minute: metrics.slope,
      within_thresholds: metrics.peak <= normalizedPolicy.maximum_rss_peak_bytes
        && metrics.growth <= normalizedPolicy.maximum_rss_growth_bytes
        && metrics.slope <= normalizedPolicy.maximum_rss_slope_bytes_per_minute,
      leak_detected: metrics.peak > normalizedPolicy.maximum_rss_peak_bytes
        || metrics.growth > normalizedPolicy.maximum_rss_growth_bytes
        || metrics.slope > normalizedPolicy.maximum_rss_slope_bytes_per_minute,
      verdict: metrics.peak <= normalizedPolicy.maximum_rss_peak_bytes
        && metrics.growth <= normalizedPolicy.maximum_rss_growth_bytes
        && metrics.slope <= normalizedPolicy.maximum_rss_slope_bytes_per_minute
        ? 'no_leak'
        : 'leak_detected',
      artifacts: { resource_usage: resourceArtifactId },
    };
    report.resource_leak_detected = report.resource_usage.leak_detected;
    if (report.resource_leak_detected) throw new Error('G5 resource usage exceeded the frozen leak thresholds.');
    writeArtifact('resource_usage', report.run_id, 'resource_usage', report.resource_usage);

    report.tasks_completed = report.tasks.length;
    report.restart_count = report.restarts.length;
    report.crash_count = unexpectedCrashes.length;
    report.crashes = unexpectedCrashes;
    if (report.tasks_completed !== taskCount || report.restart_count !== restartCount || report.crash_count !== 0) {
      throw new Error('G5 completion counts do not match the requested live workload.');
    }
    report.evidence_complete = true;
    report.passed = true;
    const pendingReport = path.join(root, 'soak-report.pending.json');
    fs.writeFileSync(pendingReport, jsonBytes(report), { mode: 0o600, flag: 'wx' });
    const pendingSha256 = sha256Bytes(fs.readFileSync(pendingReport));
    const pendingAudit = readAndAuditQworkSoakReport({
      reportPath: pendingReport,
      reportSha256: pendingSha256,
      expectedReleaseIdentitySha256: releaseIdentitySha256,
      expectedReleaseIdentity: checked.normalizedIdentity,
      expectedFrameworkCommit: report.framework_commit,
      policy: normalizedPolicy,
    });
    if (pendingAudit.passed !== true || pendingAudit.decision !== 'PASS_STAGE') {
      fs.rmSync(pendingReport, { force: true });
      throw new Error(`G5 self-audit rejected the candidate report: ${pendingAudit.failures.join(', ')}`);
    }
    const reportPath = path.join(root, 'soak-report.json');
    fs.renameSync(pendingReport, reportPath);
    const reportSha256 = sha256Bytes(fs.readFileSync(reportPath));
    const audit = readAndAuditQworkSoakReport({
      reportPath,
      reportSha256,
      expectedReleaseIdentitySha256: releaseIdentitySha256,
      expectedReleaseIdentity: checked.normalizedIdentity,
      expectedFrameworkCommit: report.framework_commit,
      policy: normalizedPolicy,
    });
    if (audit.passed !== true || audit.decision !== 'PASS_STAGE') {
      fs.renameSync(reportPath, path.join(root, 'soak-report.rejected.json'));
      throw new Error(`G5 final self-audit rejected the report: ${audit.failures.join(', ')}`);
    }
    const auditPath = path.join(root, 'soak-report-audit.json');
    fs.writeFileSync(auditPath, jsonBytes(audit), { mode: 0o600, flag: 'wx' });
    checkpoint('completed');
    return {
      status: 'passed',
      decision: 'PASS_STAGE',
      out_dir: root,
      report_path: reportPath,
      report_sha256: reportSha256,
      audit_path: auditPath,
      audit,
    };
  } catch (error) {
    if (monitor) {
      const activeMonitor = monitor;
      clearInterval(activeMonitor.timer);
      await activeMonitor.pending.catch(() => {});
      if (monitor === activeMonitor) monitor = null;
    }
    let abortCleanup = null;
    let abortCleanupError = '';
    try {
      abortCleanup = await adapter.onAbort({ error, context, outDir: root });
      if (!abortCleanup || abortCleanup.evidence_valid !== true || abortCleanup.stopped !== true
        || !Number.isSafeInteger(abortCleanup.click_count)
        || abortCleanup.click_count < 0 || abortCleanup.click_count > 2) {
        throw new Error(`bounded visible abort cleanup did not prove a stopped task: ${text(abortCleanup?.reason || 'invalid readback')}`);
      }
    } catch (cleanupError) {
      abortCleanupError = text(cleanupError?.stack || cleanupError?.message || cleanupError);
    }
    const checkpointPath = checkpoint('failed', error);
    const failurePath = path.join(root, 'soak-failure.json');
    fs.writeFileSync(failurePath, jsonBytes({
      schema_version: 'qbot-qwork-soak-failure/v1',
      failed_at: text(adapter.now?.() || new Date().toISOString()),
      error: text(error?.stack || error?.message || error),
      abort_cleanup: abortCleanup,
      abort_cleanup_error: abortCleanupError,
      checkpoint_path: checkpointPath,
      report_generated: false,
    }), { mode: 0o600, flag: 'wx' });
    const cleanupSuffix = abortCleanupError ? `; abort cleanup also failed closed: ${abortCleanupError}` : '';
    throw Object.assign(new Error(`G5 soak failed closed: ${text(error?.message || error)}${cleanupSuffix}`), {
      cause: error,
      checkpointPath,
      failurePath,
    });
  }
}
