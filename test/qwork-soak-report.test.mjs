import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import {
  QWORK_SOAK_DEFAULT_POLICY,
  readAndAuditQworkSoakReport,
} from '../src/lib/qwork-soak-report.mjs';
import {
  SMALL_SOAK_POLICY,
  addOrphanQworkSoakArtifact,
  createQworkSoakFixture,
  persistQworkSoakFixture,
  rewriteQworkSoakArtifact,
  rewriteRawQworkSoakArtifact,
} from './helpers/qwork-soak-fixture.mjs';

const FAST_SMALL_POLICY = Object.freeze({
  ...SMALL_SOAK_POLICY,
  maximum_resource_sample_gap_ms: 1_000,
});

function cleanupFixture(t, fixture) {
  t.after(() => fs.rmSync(fixture.root, { recursive: true, force: true }));
  return fixture;
}

function audit(fixture) {
  return readAndAuditQworkSoakReport({
    reportPath: fixture.reportPath,
    reportSha256: fixture.reportSha256,
    expectedReleaseIdentitySha256: fixture.releaseIdentitySha256,
    expectedReleaseIdentity: fixture.releaseIdentity,
    expectedFrameworkCommit: fixture.frameworkCommit,
    policy: fixture.report.policy,
  });
}

function hasFailure(result, prefix) {
  return result.failures.some((failure) => failure === prefix || failure.startsWith(`${prefix}:`));
}

function descriptor(fixture, id) {
  return fixture.report.external_artifacts.find((item) => item.artifact_id === id);
}

test('strict disk-bound G5 report passes with 100 tasks and three managed restarts', (t) => {
  const fixture = cleanupFixture(t, createQworkSoakFixture());
  const result = audit(fixture);
  assert.equal(result.passed, true, result.failures.join(','));
  assert.equal(result.decision, 'PASS_STAGE');
  assert.equal(result.observed.tasks_completed, QWORK_SOAK_DEFAULT_POLICY.minimum_tasks);
  assert.equal(result.observed.restart_count, QWORK_SOAK_DEFAULT_POLICY.minimum_restarts);
  assert.equal(result.observed.identity_observation_count, 8);
});

test('plain-text placeholder evidence is rejected even when its bytes and SHA are updated', (t) => {
  const fixture = cleanupFixture(t, createQworkSoakFixture({
    taskCount: 4,
    policy: SMALL_SOAK_POLICY,
  }));
  rewriteRawQworkSoakArtifact(fixture, fixture.report.tasks[0].artifacts.dispatch_receipt, 'placeholder');
  const result = audit(fixture);
  assert.equal(result.passed, false);
  assert.ok(hasFailure(result, 'soak_artifact_file_invalid'));
});

test('task prompt, task, session and receipt binding drift is rejected', async (t) => {
  const mutations = [
    ['prompt', (payload) => { payload.prompt_sha256 = 'f'.repeat(64); }],
    ['task', (payload) => { payload.task_id = 'different-task'; }],
    ['session', (payload) => { payload.session_id = 'different-session'; }],
    ['context', (payload) => { payload.context.webview_target_id = 'different-target'; }],
  ];
  for (const [name, mutate] of mutations) {
    await t.test(name, (subtest) => {
      const fixture = cleanupFixture(subtest, createQworkSoakFixture({
        taskCount: 4,
        policy: SMALL_SOAK_POLICY,
      }));
      rewriteQworkSoakArtifact(fixture, fixture.report.tasks[0].artifacts.send_receipt, mutate);
      const result = audit(fixture);
      assert.equal(result.passed, false);
      assert.ok(hasFailure(result, 'soak_task_send_receipt_invalid'));
    });
  }
});

test('terminal stability cannot reuse another assistant message or renderer context', (t) => {
  const fixture = cleanupFixture(t, createQworkSoakFixture({
    taskCount: 4,
    policy: SMALL_SOAK_POLICY,
  }));
  rewriteQworkSoakArtifact(
    fixture,
    fixture.report.tasks[0].artifacts.terminal_receipt,
    (payload) => {
      payload.stability_observations[1].assistant_message_id = 'stale-assistant-message';
      payload.stability_observations[2].context.renderer_pid += 1;
    },
  );
  const result = audit(fixture);
  assert.equal(result.passed, false);
  assert.ok(hasFailure(result, 'soak_task_terminal_receipt_invalid'));
});

test('globally overlapping tasks are rejected despite individually valid timestamps', (t) => {
  const fixture = cleanupFixture(t, createQworkSoakFixture({
    taskCount: 4,
    policy: SMALL_SOAK_POLICY,
  }));
  fixture.report.tasks[1].started_at = new Date(
    Date.parse(fixture.report.tasks[0].ended_at) - 250,
  ).toISOString();
  persistQworkSoakFixture(fixture);
  const result = audit(fixture);
  assert.equal(result.passed, false);
  assert.ok(hasFailure(result, 'soak_task_serial_timeline_invalid'));
});

test('managed restart rejects PID/session/CDP/target and identity-observation drift', async (t) => {
  await t.test('restart tuple does not replace session, CDP and target', (subtest) => {
    const fixture = cleanupFixture(subtest, createQworkSoakFixture({
      taskCount: 4,
      policy: SMALL_SOAK_POLICY,
    }));
    const restart = fixture.report.restarts[0];
    restart.after.session_id = restart.before.session_id;
    restart.after.cdp_endpoint = restart.before.cdp_endpoint;
    restart.after.webview_target_id = restart.before.webview_target_id;
    persistQworkSoakFixture(fixture);
    const result = audit(fixture);
    assert.equal(result.passed, false);
    assert.ok(hasFailure(result, 'soak_restart_invalid'));
  });

  await t.test('restart after observation points at a different process tuple', (subtest) => {
    const fixture = cleanupFixture(subtest, createQworkSoakFixture({
      taskCount: 4,
      policy: SMALL_SOAK_POLICY,
    }));
    fixture.report.identity_observations[2].context = {
      ...fixture.report.identity_observations[2].context,
      renderer_pid: fixture.report.identity_observations[2].context.renderer_pid + 1,
    };
    persistQworkSoakFixture(fixture);
    const result = audit(fixture);
    assert.equal(result.passed, false);
    assert.ok(hasFailure(result, 'soak_restart_after_observation_invalid'));
  });
});

test('extra or reordered identity observations cannot be smuggled into the chain', (t) => {
  const fixture = cleanupFixture(t, createQworkSoakFixture({
    taskCount: 4,
    policy: SMALL_SOAK_POLICY,
  }));
  const extra = structuredClone(fixture.report.identity_observations[0]);
  extra.observation_id = 'unbound-extra-observation';
  fixture.report.identity_observations.splice(1, 0, extra);
  persistQworkSoakFixture(fixture);
  const result = audit(fixture);
  assert.equal(result.passed, false);
  assert.ok(hasFailure(result, 'soak_identity_observation_set_invalid'));
});

test('identity capabilities attempt ledgers are disk-bound and fail closed on deletion or tampering', async (t) => {
  const mutations = [
    ['deleted', (fixture, observation, payload) => {
      delete payload.capabilities_readback_attempts;
    }],
    ['timeout-drift', (fixture, observation, payload) => {
      observation.capabilities_readback_attempts[0].timeout_ms = 5_000;
      payload.capabilities_readback_attempts[0].timeout_ms = 5_000;
    }],
    ['failed-final-attempt', (fixture, observation, payload) => {
      for (const target of [observation, payload]) {
        target.capabilities_readback_attempts[0].ok = false;
        target.capabilities_readback_attempts[0].value_type = '';
        target.capabilities_readback_attempts[0].error = 'timed out';
      }
    }],
    ['non-sequential-attempt', (fixture, observation, payload) => {
      for (const target of [observation, payload]) {
        target.capabilities_readback_attempts[0].attempt = 2;
      }
    }],
  ];
  for (const [name, mutate] of mutations) {
    await t.test(name, (subtest) => {
      const fixture = cleanupFixture(subtest, createQworkSoakFixture({
        taskCount: 4,
        policy: SMALL_SOAK_POLICY,
      }));
      const observation = fixture.report.identity_observations[0];
      rewriteQworkSoakArtifact(
        fixture,
        observation.artifacts.identity_readback,
        (payload) => mutate(fixture, observation, payload),
      );
      const result = audit(fixture);
      assert.equal(result.passed, false);
      assert.ok(
        hasFailure(result, 'soak_identity_capabilities_attempts_invalid'),
        result.failures.join(','),
      );
    });
  }
});

test('startup, run-final and restart observations must be fresh at their boundaries', async (t) => {
  const mutations = [
    ['stale-startup', (fixture) => {
      fixture.report.identity_observations[0].observed_at = new Date(
        Date.parse(fixture.report.started_at)
          + fixture.report.policy.maximum_resource_sample_gap_ms + 1,
      ).toISOString();
    }, 'soak_startup_time_invalid'],
    ['stale-run-final', (fixture) => {
      fixture.report.identity_observations.at(-1).observed_at = new Date(
        Date.parse(fixture.report.ended_at)
          - fixture.report.policy.maximum_resource_sample_gap_ms - 1,
      ).toISOString();
    }, 'soak_run_final_time_invalid'],
    ['stale-restart-before', (fixture) => {
      const restart = fixture.report.restarts[0];
      const observation = fixture.report.identity_observations.find((item) => (
        item.observation_id === restart.identity_observation_before_id
      ));
      observation.observed_at = new Date(
        Date.parse(restart.started_at)
          - fixture.report.policy.maximum_resource_sample_gap_ms - 1,
      ).toISOString();
    }, 'soak_restart_before_observation_invalid'],
    ['stale-restart-after', (fixture) => {
      const restart = fixture.report.restarts[0];
      const observation = fixture.report.identity_observations.find((item) => (
        item.observation_id === restart.identity_observation_after_id
      ));
      observation.observed_at = new Date(
        Date.parse(restart.recovered_at)
          + fixture.report.policy.maximum_resource_sample_gap_ms + 1,
      ).toISOString();
      restart.ended_at = observation.observed_at;
      const receiptId = restart.artifacts.restart_receipt;
      rewriteQworkSoakArtifact(fixture, receiptId, (payload) => {
        payload.ended_at = restart.ended_at;
      });
    }, 'soak_restart_after_observation_invalid'],
  ];
  for (const [name, mutate, expectedFailure] of mutations) {
    await t.test(name, (subtest) => {
      const fixture = cleanupFixture(subtest, createQworkSoakFixture({
        taskCount: 4,
        policy: SMALL_SOAK_POLICY,
      }));
      mutate(fixture);
      persistQworkSoakFixture(fixture);
      const result = audit(fixture);
      assert.equal(result.passed, false);
      assert.ok(hasFailure(result, expectedFailure), result.failures.join(','));
    });
  }
});

test('declared crash and RSS sampling intervals may be stricter than the maximum', (t) => {
  const fixture = cleanupFixture(t, createQworkSoakFixture({
    taskCount: 4,
    policy: SMALL_SOAK_POLICY,
  }));
  rewriteQworkSoakArtifact(fixture, fixture.artifactIds.crashLedger, (payload) => {
    payload.monitoring_interval_ms = Math.floor(
      fixture.report.policy.maximum_resource_sample_gap_ms / 2,
    );
  }, { mirror: 'crash_ledger' });
  rewriteQworkSoakArtifact(fixture, fixture.artifactIds.resourceUsage, (payload) => {
    payload.sampling_interval_ms = Math.floor(
      fixture.report.policy.maximum_resource_sample_gap_ms / 2,
    );
  }, { mirror: 'resource_usage' });
  const result = audit(fixture);
  assert.equal(result.passed, true, result.failures.join(','));
});

test('crash ledger rejects both non-empty crashes and incomplete continuous coverage', async (t) => {
  await t.test('non-empty crash event', (subtest) => {
    const fixture = cleanupFixture(subtest, createQworkSoakFixture({
      taskCount: 4,
      policy: SMALL_SOAK_POLICY,
    }));
    rewriteQworkSoakArtifact(fixture, fixture.artifactIds.crashLedger, (payload) => {
      payload.entries.push({ type: 'renderer-crash' });
    }, { mirror: 'crash_ledger' });
    const result = audit(fixture);
    assert.equal(result.passed, false);
    assert.ok(hasFailure(result, 'soak_crash_ledger_invalid'));
  });

  await t.test('monitoring gap', (subtest) => {
    const fixture = cleanupFixture(subtest, createQworkSoakFixture({
      taskCount: 4,
      policy: SMALL_SOAK_POLICY,
    }));
    rewriteQworkSoakArtifact(fixture, fixture.artifactIds.crashLedger, (payload) => {
      payload.monitor_samples = payload.monitor_samples.filter((sample) => (
        sample.context.session_id !== 'soak-session-1'
      ));
      payload.monitor_samples.forEach((sample, index) => { sample.sequence = index + 1; });
    }, { mirror: 'crash_ledger' });
    const result = audit(fixture);
    assert.equal(result.passed, false);
    assert.ok(hasFailure(result, 'soak_crash_monitor_coverage_incomplete'));
  });
});

test('an intermediate RSS peak is rejected even when the first and final samples look normal', (t) => {
  const fixture = cleanupFixture(t, createQworkSoakFixture({
    taskCount: 4,
    policy: FAST_SMALL_POLICY,
  }));
  const firstRss = fixture.report.resource_usage.samples[0].rss_bytes;
  const lastRss = fixture.report.resource_usage.samples.at(-1).rss_bytes;
  rewriteQworkSoakArtifact(fixture, fixture.artifactIds.resourceUsage, (payload) => {
    const hostSamples = payload.samples.filter((sample) => (
      sample.process_role === 'host' && sample.session_id === 'soak-session-0'
    ));
    hostSamples[1].rss_bytes = firstRss + fixture.report.policy.maximum_rss_growth_bytes + 1;
    payload.rss_peak_bytes = hostSamples[1].rss_bytes;
    payload.rss_growth_bytes = 0;
    payload.within_thresholds = true;
    payload.leak_detected = false;
    payload.verdict = 'no_leak';
  }, { mirror: 'resource_usage' });
  assert.equal(fixture.report.resource_usage.samples[0].rss_bytes, firstRss);
  assert.equal(fixture.report.resource_usage.samples.at(-1).rss_bytes, lastRss);
  const result = audit(fixture);
  assert.equal(result.passed, false);
  assert.ok(hasFailure(result, 'soak_resource_leak_not_proven_absent'));
  assert.ok(result.observed.rss_growth_bytes > fixture.report.policy.maximum_rss_growth_bytes);
});

test('rapid RSS growth slope is rejected below the absolute growth threshold', (t) => {
  const fixture = cleanupFixture(t, createQworkSoakFixture({
    taskCount: 4,
    policy: FAST_SMALL_POLICY,
  }));
  rewriteQworkSoakArtifact(fixture, fixture.artifactIds.resourceUsage, (payload) => {
    const hostSamples = payload.samples.filter((sample) => (
      sample.process_role === 'host' && sample.session_id === 'soak-session-0'
    ));
    hostSamples[1].rss_bytes = hostSamples[0].rss_bytes + 2 * 1024 * 1024;
  }, { mirror: 'resource_usage' });
  const result = audit(fixture);
  assert.equal(result.passed, false);
  assert.ok(hasFailure(result, 'soak_resource_leak_not_proven_absent'));
  assert.ok(result.observed.rss_growth_bytes < fixture.report.policy.maximum_rss_growth_bytes);
  assert.ok(
    result.observed.rss_slope_bytes_per_minute
      > fixture.report.policy.maximum_rss_slope_bytes_per_minute,
  );
});

test('resource samples reject PID, process-start and session identity drift', async (t) => {
  const mutations = [
    ['pid', (sample) => { sample.pid += 100; }],
    ['process-start', (sample) => { sample.process_started_at = sample.observed_at; }],
    ['session', (sample) => { sample.session_id = 'stale-session'; }],
  ];
  for (const [name, mutate] of mutations) {
    await t.test(name, (subtest) => {
      const fixture = cleanupFixture(subtest, createQworkSoakFixture({
        taskCount: 4,
        policy: FAST_SMALL_POLICY,
      }));
      rewriteQworkSoakArtifact(fixture, fixture.artifactIds.resourceUsage, (payload) => {
        mutate(payload.samples[0]);
      }, { mirror: 'resource_usage' });
      const result = audit(fixture);
      assert.equal(result.passed, false);
      assert.ok(hasFailure(result, 'soak_resource_process_identity_mismatch'));
    });
  }
});

test('symlink, shared inode and orphan evidence are rejected', async (t) => {
  await t.test('symlink', (subtest) => {
    const fixture = cleanupFixture(subtest, createQworkSoakFixture({
      taskCount: 4,
      policy: SMALL_SOAK_POLICY,
    }));
    const item = descriptor(fixture, fixture.report.tasks[0].artifacts.dispatch_receipt);
    const target = path.join(fixture.root, 'unlisted-target.json');
    fs.copyFileSync(item.path, target);
    fs.unlinkSync(item.path);
    fs.symlinkSync(target, item.path);
    const result = audit(fixture);
    assert.equal(result.passed, false);
    assert.ok(hasFailure(result, 'soak_artifact_file_invalid'));
  });

  await t.test('shared inode', (subtest) => {
    const fixture = cleanupFixture(subtest, createQworkSoakFixture({
      taskCount: 4,
      policy: SMALL_SOAK_POLICY,
    }));
    const first = descriptor(fixture, fixture.report.tasks[0].artifacts.dispatch_receipt);
    const second = descriptor(fixture, fixture.report.tasks[1].artifacts.dispatch_receipt);
    fs.unlinkSync(second.path);
    fs.linkSync(first.path, second.path);
    const result = audit(fixture);
    assert.equal(result.passed, false);
    assert.ok(hasFailure(result, 'soak_artifact_file_reused'));
  });

  await t.test('orphan', (subtest) => {
    const fixture = cleanupFixture(subtest, createQworkSoakFixture({
      taskCount: 4,
      policy: SMALL_SOAK_POLICY,
    }));
    addOrphanQworkSoakArtifact(fixture);
    const result = audit(fixture);
    assert.equal(result.passed, false);
    assert.ok(hasFailure(result, 'soak_artifact_orphaned'));
  });
});
