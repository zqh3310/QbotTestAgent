import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  QWORK_SOAK_DEFAULT_POLICY,
  qworkSoakReleaseIdentityFingerprint,
  readAndAuditQworkSoakReport,
} from '../../src/lib/qwork-soak-report.mjs';
import { runQworkSoak } from '../lib/qwork-soak-runner.mjs';

const RELEASE_IDENTITY = Object.freeze({
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

const FRAMEWORK_COMMIT = 'e'.repeat(40);

function makeContext(epoch, startedAt) {
  return {
    host_pid: 50_000 + epoch,
    host_process_started_at: new Date(startedAt).toISOString(),
    renderer_pid: 60_000 + epoch,
    renderer_process_started_at: new Date(startedAt + 10).toISOString(),
    session_id: `managed-session-${epoch}`,
    cdp_endpoint: `http://127.0.0.1:${61_000 + epoch}`,
    webview_target_id: `qwork-target-${epoch}`,
  };
}

function sha256Text(value) {
  return createHash('sha256').update(String(value), 'utf8').digest('hex');
}

function createFakeAdapter({
  rejectSendAt = 0,
  preserveRestartTuple = false,
  stabilityMutation = '',
} = {}) {
  let clock = Date.parse('2026-09-05T00:00:00.000Z');
  let epoch = 0;
  let context = makeContext(epoch, clock - 60_000);
  let lastTask = null;
  const tick = (ms = 10) => {
    clock += ms;
    return new Date(clock).toISOString();
  };
  return {
    now: () => tick(),
    async observeContext() {
      tick();
      return structuredClone(context);
    },
    async readIdentity() {
      return {
        evidence_valid: true,
        ok: true,
        observed_at: tick(20),
        context: structuredClone(context),
        release_identity: structuredClone(RELEASE_IDENTITY),
        capabilities_readback_attempts: [{
          attempt: 1,
          timeout_ms: 2_000,
          started_at: tick(1),
          ended_at: tick(1),
          duration_ms: 1,
          ok: true,
          value_type: 'object',
          error: '',
        }],
        runtime: {
          top_level_version: RELEASE_IDENTITY.qwork_version,
          loaded_version: RELEASE_IDENTITY.qwork_version,
          compatibility_version: RELEASE_IDENTITY.qwork_version,
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
          origin: RELEASE_IDENTITY.control_plane_origin,
          backend_version: RELEASE_IDENTITY.backend_version,
        },
      };
    },
    async dispatchTask({ sequence, marker, prompt }) {
      lastTask = { sequence, marker, prompt };
      return { dispatched_at: tick(50), observed: { clean_draft: true } };
    },
    async sendAndConfirm({ sequence }) {
      if (sequence === rejectSendAt) {
        return {
          confirmed: false,
          accepted_by_product: false,
          click_count: 1,
          confirmed_at: '',
        };
      }
      return {
        confirmed: true,
        accepted_by_product: true,
        click_count: 1,
        task_id: `task-${sequence}`,
        user_message_id: `user-${sequence}`,
        confirmed_at: tick(50),
        observed: { user_message_exact: true },
      };
    },
    async waitForStableTerminal({ sequence, marker, taskId, promptSha256 }) {
      const assistantResponse = `健康检查已完成 ${marker}`;
      const completedAt = tick(100);
      const observations = [tick(20), tick(20), tick(20)].map((observedAt) => ({
        observed_at: observedAt,
        task_id: taskId,
        session_id: context.session_id,
        prompt_sha256: promptSha256,
        assistant_message_id: `assistant-${sequence}`,
        assistant_response: assistantResponse,
        response_sha256: sha256Text(assistantResponse),
        marker,
        context: structuredClone(context),
        running: false,
        status: 'succeeded',
      }));
      if (sequence === 1) {
        if (stabilityMutation === 'task') observations[1].task_id = 'other-task';
        if (stabilityMutation === 'message') observations[1].assistant_message_id = 'other-assistant';
        if (stabilityMutation === 'response') {
          observations[1].assistant_response = `${assistantResponse} changed`;
          observations[1].response_sha256 = sha256Text(observations[1].assistant_response);
        }
        if (stabilityMutation === 'running') observations[1].running = true;
        if (stabilityMutation === 'time') observations[1].observed_at = observations[0].observed_at;
      }
      return {
        status: 'succeeded',
        running: false,
        assistant_message_id: `assistant-${sequence}`,
        assistant_response: assistantResponse,
        completed_at: completedAt,
        ended_at: tick(20),
        stability_observations: observations,
        observed: { prompt: lastTask?.prompt },
      };
    },
    async sampleProcesses() {
      const observedAt = tick(5);
      return {
        observed_at: observedAt,
        context: structuredClone(context),
        host: {
          alive: true,
          pid: context.host_pid,
          process_started_at: context.host_process_started_at,
          rss_bytes: 100 * 1024 * 1024 + epoch * 1024,
        },
        renderer: {
          alive: true,
          pid: context.renderer_pid,
          process_started_at: context.renderer_process_started_at,
          rss_bytes: 200 * 1024 * 1024 + epoch * 1024,
        },
        unexpected_host_exit_count: 0,
        renderer_crash_count: 0,
        new_crash_reports: [],
      };
    },
    async restartManagedHost({ sequence, before }) {
      const startedAt = tick(20);
      const stopAt = tick(20);
      const launchAt = tick(20);
      const nextEpoch = epoch + 1;
      const nextContext = preserveRestartTuple
        ? structuredClone(before)
        : makeContext(nextEpoch, clock + 5);
      tick(20);
      epoch = nextEpoch;
      context = nextContext;
      const recoveredAt = tick(20);
      return {
        sequence,
        started_at: startedAt,
        stop_observed_at: stopAt,
        launch_started_at: launchAt,
        recovered_at: recoveredAt,
        after: structuredClone(context),
        old_host_exit_observed: true,
        new_host_process_observed: true,
        session_file_replaced: true,
        cdp_reachable: true,
        authenticated: true,
        workbench_ready: true,
        capabilities_readable: true,
        runtime_identity_stable: true,
      };
    },
    async onAbort() {
      return {
        evidence_valid: true,
        attempted: false,
        stopped: true,
        click_count: 0,
        method: 'fake-already-stopped',
        observations: [],
      };
    },
  };
}

function output(name) {
  const root = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), 'qwork-soak-runner-')));
  return path.join(root, name);
}

test('G5 runner materializes 100 serial tasks and three full managed restarts accepted by the disk auditor', async () => {
  const outDir = output('success');
  const result = await runQworkSoak({
    adapter: createFakeAdapter(),
    outDir,
    releaseIdentity: RELEASE_IDENTITY,
    frameworkCommit: FRAMEWORK_COMMIT,
    monitoringIntervalMs: 60_000,
  });
  assert.equal(result.status, 'passed');
  assert.equal(result.decision, 'PASS_STAGE');
  assert.equal(result.audit.observed.tasks_completed, 100);
  assert.equal(result.audit.observed.restart_count, 3);
  const report = JSON.parse(fs.readFileSync(result.report_path, 'utf8'));
  const startup = report.identity_observations.find((item) => item.observation_id === 'startup');
  assert.equal(startup.capabilities_readback_attempts.length, 1);
  assert.equal(startup.capabilities_readback_attempts[0].timeout_ms, 2_000);
  const identityArtifact = report.external_artifacts.find((item) => (
    item.artifact_id === startup.artifacts.identity_readback
  ));
  const identityPayload = JSON.parse(fs.readFileSync(identityArtifact.path, 'utf8'));
  assert.deepEqual(
    identityPayload.capabilities_readback_attempts,
    startup.capabilities_readback_attempts,
  );
  const audit = readAndAuditQworkSoakReport({
    reportPath: result.report_path,
    reportSha256: result.report_sha256,
    expectedReleaseIdentitySha256: qworkSoakReleaseIdentityFingerprint(RELEASE_IDENTITY),
    expectedReleaseIdentity: RELEASE_IDENTITY,
    expectedFrameworkCommit: FRAMEWORK_COMMIT,
    policy: QWORK_SOAK_DEFAULT_POLICY,
  });
  assert.equal(audit.passed, true, audit.failures.join('\n'));
});

test('G5 runner waits for the current in-flight process sample before crossing a host epoch', async () => {
  const deferred = () => {
    let resolve;
    const promise = new Promise((accept) => { resolve = accept; });
    return { promise, resolve };
  };
  const outDir = output('in-flight-monitor-stop');
  const adapter = createFakeAdapter();
  const sampleStarted = deferred();
  const releaseSample = deferred();
  const restartStarted = deferred();
  const events = [];
  let sampleCallCount = 0;
  const sampleProcesses = adapter.sampleProcesses.bind(adapter);
  const waitForStableTerminal = adapter.waitForStableTerminal.bind(adapter);
  const restartManagedHost = adapter.restartManagedHost.bind(adapter);

  adapter.sampleProcesses = async (...args) => {
    sampleCallCount += 1;
    const sample = await sampleProcesses(...args);
    if (sampleCallCount === 2) {
      events.push(`sample-start:${sample.context.session_id}`);
      sampleStarted.resolve();
      await releaseSample.promise;
      events.push(`sample-finish:${sample.context.session_id}`);
    }
    return sample;
  };
  adapter.waitForStableTerminal = async (args) => {
    const terminal = await waitForStableTerminal(args);
    if (args.sequence === 25) await sampleStarted.promise;
    return terminal;
  };
  adapter.restartManagedHost = async (args) => {
    events.push(`restart-start:${args.before.session_id}`);
    restartStarted.resolve();
    return restartManagedHost(args);
  };

  const run = runQworkSoak({
    adapter,
    outDir,
    releaseIdentity: RELEASE_IDENTITY,
    frameworkCommit: FRAMEWORK_COMMIT,
    monitoringIntervalMs: 1,
  });
  await sampleStarted.promise;
  const restartedBeforeSampleFinished = await Promise.race([
    restartStarted.promise.then(() => true),
    new Promise((resolve) => setTimeout(() => resolve(false), 50)),
  ]);
  releaseSample.resolve();
  if (restartedBeforeSampleFinished) await run.catch(() => {});
  assert.equal(restartedBeforeSampleFinished, false, events.join(','));

  const result = await run;
  assert.equal(result.status, 'passed');
  const sampleFinishedAt = events.indexOf('sample-finish:managed-session-0');
  const firstRestartAt = events.indexOf('restart-start:managed-session-0');
  assert.ok(sampleFinishedAt >= 0, events.join(','));
  assert.ok(firstRestartAt > sampleFinishedAt, events.join(','));
});

test('G5 runner fails closed without a report when strict send confirmation is absent', async () => {
  const outDir = output('send-failure');
  await assert.rejects(
    runQworkSoak({
      adapter: createFakeAdapter({ rejectSendAt: 2 }),
      outDir,
      releaseIdentity: RELEASE_IDENTITY,
      frameworkCommit: FRAMEWORK_COMMIT,
    }),
    /strict one-click send receipt/,
  );
  assert.equal(fs.existsSync(path.join(outDir, 'soak-report.json')), false);
  assert.equal(JSON.parse(fs.readFileSync(path.join(outDir, 'soak-checkpoint.json'))).report_generated, false);
});

test('G5 runner fails closed when a managed restart does not replace every context field', async () => {
  const outDir = output('restart-failure');
  await assert.rejects(
    runQworkSoak({
      adapter: createFakeAdapter({ preserveRestartTuple: true }),
      outDir,
      releaseIdentity: RELEASE_IDENTITY,
      frameworkCommit: FRAMEWORK_COMMIT,
    }),
    /did not replace the full host tuple/,
  );
  assert.equal(fs.existsSync(path.join(outDir, 'soak-report.json')), false);
  assert.equal(fs.existsSync(path.join(outDir, 'soak-failure.json')), true);
});

for (const [mutation, expected] of [
  ['task', /observation 2 task identity drifted/],
  ['message', /observation 2 assistant message identity drifted/],
  ['response', /observation 2 assistant response drifted/],
  ['running', /observation 2 was not a successful stopped state/],
  ['time', /observation 2 timestamp is not strictly increasing/],
]) {
  test(`G5 runner rejects raw terminal stability ${mutation} drift instead of rewriting it`, async () => {
    const outDir = output(`stability-${mutation}`);
    await assert.rejects(
      runQworkSoak({
        adapter: createFakeAdapter({ stabilityMutation: mutation }),
        outDir,
        releaseIdentity: RELEASE_IDENTITY,
        frameworkCommit: FRAMEWORK_COMMIT,
      }),
      expected,
    );
    assert.equal(fs.existsSync(path.join(outDir, 'soak-report.json')), false);
    const failure = JSON.parse(fs.readFileSync(path.join(outDir, 'soak-failure.json')));
    assert.equal(failure.abort_cleanup.stopped, true);
  });
}
