import assert from 'node:assert/strict';
import test from 'node:test';
import { probeWebviewPublicCapabilities } from '../lib/cdp-webview.mjs';

const TARGET = Object.freeze({ webSocketDebuggerUrl: 'ws://127.0.0.1:9222/devtools/page/qwork' });

function installFakeWebSocket(t, scripts) {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'WebSocket');
  const socketScript = Array.isArray(scripts) ? { evaluations: scripts } : scripts;
  class FakeWebSocket extends EventTarget {
    static instances = [];

    constructor(url) {
      super();
      this.url = url;
      this.closed = false;
      this.sent = [];
      this.timers = new Set();
      this.script = socketScript || {};
      this.evaluationIndex = 0;
      FakeWebSocket.instances.push(this);
      if (this.script.connect === 'never') return;
      this.schedule(() => this.dispatchEvent(new Event(
        this.script.connect === 'error' ? 'error' : 'open',
      )), this.script.connectDelayMs);
    }

    send(raw) {
      const message = JSON.parse(raw);
      this.sent.push(message);
      if (message.method === 'Runtime.enable') {
        if (this.script.runtimeEnable === 'never') return;
        if (this.script.runtimeEnable === 'error') {
          this.respondError(message.id, 'Runtime.enable failed', this.script.runtimeEnableDelayMs);
          return;
        }
        this.respond(message.id, {}, this.script.runtimeEnableDelayMs);
        return;
      }
      if (message.method !== 'Runtime.evaluate') return;
      const evaluation = Array.isArray(this.script.evaluations)
        ? this.script.evaluations[this.evaluationIndex++] || {}
        : this.script;
      if (evaluation.evaluate === 'never') return;
      const wrapper = Object.hasOwn(evaluation, 'wrapper')
        ? evaluation.wrapper
        : { ok: true, value: evaluation.value };
      this.respond(message.id, { result: { value: wrapper } }, evaluation.evaluateDelayMs);
    }

    schedule(callback, delayMs = 0) {
      if (!Number.isFinite(delayMs) || delayMs <= 0) {
        queueMicrotask(() => {
          if (!this.closed) callback();
        });
        return;
      }
      const timer = setTimeout(() => {
        this.timers.delete(timer);
        if (!this.closed) callback();
      }, delayMs);
      this.timers.add(timer);
    }

    respond(id, result, delayMs = 0) {
      this.schedule(() => this.dispatchEvent(new MessageEvent('message', {
        data: JSON.stringify({ id, result }),
      })), delayMs);
    }

    respondError(id, message, delayMs = 0) {
      this.schedule(() => this.dispatchEvent(new MessageEvent('message', {
        data: JSON.stringify({ id, error: { message } }),
      })), delayMs);
    }

    close() {
      if (this.closed) return;
      this.closed = true;
      for (const timer of this.timers) clearTimeout(timer);
      this.timers.clear();
      this.dispatchEvent(new Event('close'));
    }
  }
  Object.defineProperty(globalThis, 'WebSocket', {
    configurable: true,
    writable: true,
    value: FakeWebSocket,
  });
  t.after(() => {
    if (original) Object.defineProperty(globalThis, 'WebSocket', original);
    else delete globalThis.WebSocket;
  });
  return FakeWebSocket;
}

function assertLedgerShape(entry, { attempt, phase, timeoutMs, ok, valueType }) {
  assert.equal(entry.attempt, attempt);
  assert.equal(entry.phase, phase);
  assert.equal(entry.renderer_timeout_ms, timeoutMs);
  assert.equal(entry.node_timeout_ms, timeoutMs + 500);
  assert.match(entry.started_at, /^\d{4}-\d{2}-\d{2}T/);
  assert.match(entry.ended_at, /^\d{4}-\d{2}-\d{2}T/);
  assert.ok(Number.isSafeInteger(entry.duration_ms));
  assert.ok(entry.duration_ms >= 0);
  assert.equal(entry.ok, ok);
  assert.equal(entry.value_type, valueType);
  assert.equal(typeof entry.error, 'string');
  assert.equal(typeof entry.summary_signature_sha256, 'string');
}

test('capabilities uses one bounded cold load and two stable 2000ms readbacks', async (t) => {
  const first = {
    selectedSkills: null,
    selectedConnectors: [],
    currentExpert: null,
    routing: { mode: 'auto' },
  };
  const reordered = {
    routing: { mode: 'manual' },
    currentExpert: { id: 'dynamic-value-is-not-signed' },
    selectedConnectors: ['dynamic-connector'],
    selectedSkills: ['dynamic-skill'],
  };
  const FakeWebSocket = installFakeWebSocket(t, [
    { value: first },
    { value: reordered },
    { value: first },
  ]);

  const result = await probeWebviewPublicCapabilities(TARGET);

  assert.equal(result.ok, true);
  assert.equal(result.probe_started, true);
  assert.equal(Object.hasOwn(result, 'pre_probe_failure'), false);
  assert.equal(result.value_type, 'object');
  assert.equal(result.schema, 'qbot-qwork-capabilities-readback/v1');
  assert.equal(result.cold_load_timeout_ms, 15_000);
  assert.equal(result.stable_read_timeout_ms, 2_000);
  assert.equal(result.required_stable_readbacks, 2);
  assert.equal(result.total_renderer_timeout_ms, 19_000);
  assert.equal(result.total_node_probe_timeout_ms, 20_500);
  assert.equal(result.connect_timeout_ms, 10_000);
  assert.equal(result.runtime_enable_timeout_ms, 15_000);
  assert.equal(result.maximum_wall_clock_timeout_ms, 45_500);
  assert.equal(result.total_timeout_ms, 45_500);
  assert.deepEqual(result.probe_ledger.map((entry) => entry.phase), [
    'cold_load',
    'stable_read_1',
    'stable_read_2',
  ]);
  assertLedgerShape(result.probe_ledger[0], {
    attempt: 1,
    phase: 'cold_load',
    timeoutMs: 15_000,
    ok: true,
    valueType: 'object',
  });
  assertLedgerShape(result.probe_ledger[1], {
    attempt: 2,
    phase: 'stable_read_1',
    timeoutMs: 2_000,
    ok: true,
    valueType: 'object',
  });
  assertLedgerShape(result.probe_ledger[2], {
    attempt: 3,
    phase: 'stable_read_2',
    timeoutMs: 2_000,
    ok: true,
    valueType: 'object',
  });
  assert.match(result.summary_signature_sha256, /^[a-f0-9]{64}$/);
  assert.ok(result.probe_ledger.every(
    (entry) => entry.summary_signature_sha256 === result.summary_signature_sha256,
  ));
  assert.equal(result.attempts.length, 3);
  assert.equal(result.attempts[0].attempt, 1);
  assert.equal(result.attempts[0].timeout_ms, 15_000);
  assert.equal(result.attempts[0].ok, true);
  assert.equal(result.attempts[0].value_type, 'object');
  assert.equal(FakeWebSocket.instances.length, 1);
  assert.ok(FakeWebSocket.instances.every((socket) => socket.closed));
});

test('capabilities missing target is a pre-probe failure with no fabricated cold-load ledger', async () => {
  const result = await probeWebviewPublicCapabilities(null);

  assert.equal(result.ok, false);
  assert.equal(result.probe_started, false);
  assert.deepEqual(result.probe_ledger, []);
  assert.deepEqual(result.attempts, []);
  assert.deepEqual(result.pre_probe_failure, {
    schema: 'qbot-qwork-capabilities-pre-probe-failure/v1',
    stage: 'target_discovery',
    error_code: 'qwork_target_unavailable',
  });
  assert.match(result.error, /target is unavailable/i);
});

test('capabilities connection failure is pre-probe and closes its socket', async (t) => {
  const FakeWebSocket = installFakeWebSocket(t, { connect: 'error' });
  const result = await probeWebviewPublicCapabilities(TARGET);

  assert.equal(result.ok, false);
  assert.equal(result.probe_started, false);
  assert.deepEqual(result.probe_ledger, []);
  assert.deepEqual(result.attempts, []);
  assert.deepEqual(result.pre_probe_failure, {
    schema: 'qbot-qwork-capabilities-pre-probe-failure/v1',
    stage: 'cdp_connect',
    error_code: 'cdp_connect_failed',
  });
  assert.match(result.error, /connect|WebSocket|CDP/i);
  assert.equal(FakeWebSocket.instances.length, 1);
  assert.equal(FakeWebSocket.instances[0].closed, true);
  assert.equal(
    FakeWebSocket.instances[0].sent.some((message) => message.method === 'Runtime.evaluate'),
    false,
  );
});

test('capabilities Runtime.enable failure is pre-probe and never dispatches Runtime.evaluate', async (t) => {
  const FakeWebSocket = installFakeWebSocket(t, { runtimeEnable: 'error' });
  const result = await probeWebviewPublicCapabilities(TARGET);

  assert.equal(result.ok, false);
  assert.equal(result.probe_started, false);
  assert.deepEqual(result.probe_ledger, []);
  assert.deepEqual(result.attempts, []);
  assert.deepEqual(result.pre_probe_failure, {
    schema: 'qbot-qwork-capabilities-pre-probe-failure/v1',
    stage: 'runtime_enable',
    error_code: 'runtime_enable_failed',
  });
  assert.match(result.error, /Runtime\.enable failed/);
  assert.equal(FakeWebSocket.instances.length, 1);
  assert.equal(FakeWebSocket.instances[0].closed, true);
  assert.deepEqual(
    FakeWebSocket.instances[0].sent.map((message) => message.method),
    ['Runtime.enable'],
  );
});

test('capabilities stable Runtime.evaluate is bounded by the 500ms Node grace', async (t) => {
  const value = { selectedSkills: [], selectedConnectors: [], currentExpert: null };
  const FakeWebSocket = installFakeWebSocket(t, [
    { value },
    { evaluate: 'never' },
  ]);
  const started = Date.now();
  const result = await probeWebviewPublicCapabilities(TARGET);
  const elapsed = Date.now() - started;

  assert.equal(result.ok, false);
  assert.ok(elapsed >= 2_300, `stable read returned too early: ${elapsed}ms`);
  assert.ok(elapsed < 5_000, `stable read exceeded its bounded deadline: ${elapsed}ms`);
  assert.deepEqual(result.probe_ledger.map((entry) => entry.phase), [
    'cold_load',
    'stable_read_1',
  ]);
  assertLedgerShape(result.probe_ledger[1], {
    attempt: 2,
    phase: 'stable_read_1',
    timeoutMs: 2_000,
    ok: false,
    valueType: '',
  });
  assert.match(result.probe_ledger[1].error, /timeout/i);
  assert.ok(FakeWebSocket.instances.every((socket) => socket.closed));
});

test('capabilities setup overhead does not consume the stable renderer deadline', async (t) => {
  const value = { selectedSkills: [], selectedConnectors: [], currentExpert: null };
  const FakeWebSocket = installFakeWebSocket(t, {
    connectDelayMs: 400,
    runtimeEnableDelayMs: 400,
    evaluations: [
      { value },
      { value, evaluateDelayMs: 1_850 },
      { value },
    ],
  });
  const started = Date.now();

  const result = await probeWebviewPublicCapabilities(TARGET);
  const elapsed = Date.now() - started;

  assert.equal(result.ok, true);
  assert.ok(elapsed >= 2_500, `slow setup/readback completed implausibly early: ${elapsed}ms`);
  assert.ok(elapsed < 4_000, `Node hard timeout failed to bound the phase: ${elapsed}ms`);
  assert.equal(result.probe_ledger[1].renderer_timeout_ms, 2_000);
  assert.equal(result.probe_ledger[1].node_timeout_ms, 2_500);
  const stableEvaluate = FakeWebSocket.instances[0].sent.filter(
    (message) => message.method === 'Runtime.evaluate',
  )[1];
  assert.ok(stableEvaluate, 'stable_read_1 must dispatch Runtime.evaluate');
  assert.match(
    stableEvaluate.params.expression,
    /window\.agent\.capabilities timed out'[\s\S]*?2000\s*\)/,
  );
  assert.ok(FakeWebSocket.instances.every((socket) => socket.closed));
});

test('capabilities CDP command preserves the 500ms return-path grace', async (t) => {
  const value = { selectedSkills: [], selectedConnectors: [], currentExpert: null };
  const FakeWebSocket = installFakeWebSocket(t, [
    { value },
    { value, evaluateDelayMs: 2_200 },
    { value },
  ]);

  const result = await probeWebviewPublicCapabilities(TARGET);

  assert.equal(result.ok, true);
  assert.equal(result.probe_ledger[1].renderer_timeout_ms, 2_000);
  assert.equal(result.probe_ledger[1].node_timeout_ms, 2_500);
  assert.equal(FakeWebSocket.instances.length, 1);
  assert.equal(FakeWebSocket.instances[0].closed, true);
});

test('capabilities rejects a missing bridge', async (t) => {
  const FakeWebSocket = installFakeWebSocket(t, [
    { wrapper: { ok: false, error: 'missing window.agent.capabilities' } },
  ]);
  const result = await probeWebviewPublicCapabilities(TARGET);

  assert.equal(result.ok, false);
  assert.equal(result.probe_started, true);
  assert.equal(result.probe_ledger[0].phase, 'cold_load');
  assert.match(result.probe_ledger[0].error, /missing window\.agent\.capabilities/);
  assert.equal(FakeWebSocket.instances[0].closed, true);
});

test('capabilities rejects a non-object cold value with its observed type', async (t) => {
  const FakeWebSocket = installFakeWebSocket(t, [{ value: [] }]);
  const result = await probeWebviewPublicCapabilities(TARGET);

  assert.equal(result.ok, false);
  assert.equal(result.probe_ledger.length, 1);
  assert.equal(result.probe_ledger[0].value_type, 'array');
  assert.match(result.probe_ledger[0].error, /returned array, expected object/);
  assert.equal(FakeWebSocket.instances[0].closed, true);
});

test('capabilities blocks when the canonical structured summary signature drifts', async (t) => {
  const stable = { selectedSkills: [], selectedConnectors: [], currentExpert: null };
  const drifted = { ...stable, unexpectedField: true };
  const FakeWebSocket = installFakeWebSocket(t, [
    { value: stable },
    { value: stable },
    { value: drifted },
  ]);

  const result = await probeWebviewPublicCapabilities(TARGET);

  assert.equal(result.ok, false);
  assert.equal(result.summary_signature_sha256, '');
  assert.equal(result.probe_ledger.length, 3);
  assert.equal(result.probe_ledger[0].ok, true);
  assert.equal(result.probe_ledger[1].ok, true);
  assert.equal(result.probe_ledger[2].ok, false);
  assert.match(result.probe_ledger[2].error, /signature drifted/);
  assert.notEqual(
    result.probe_ledger[0].summary_signature_sha256,
    result.probe_ledger[2].summary_signature_sha256,
  );
  assert.ok(FakeWebSocket.instances.every((socket) => socket.closed));
});

test('capabilities probe rejects weakened or unbounded phase policies', async () => {
  await assert.rejects(
    probeWebviewPublicCapabilities(TARGET, { maxAttempts: 2 }),
    /exactly two fixed 2000ms stable reads/,
  );
  await assert.rejects(
    probeWebviewPublicCapabilities(TARGET, { attemptTimeoutMs: 1_999 }),
    /exactly two fixed 2000ms stable reads/,
  );
  await assert.rejects(
    probeWebviewPublicCapabilities(TARGET, { coldLoadTimeoutMs: 15_001 }),
    /fixed 15000ms cold load/,
  );
  await assert.rejects(
    probeWebviewPublicCapabilities(TARGET, { coldLoadTimeoutMs: Number.POSITIVE_INFINITY }),
    /fixed 15000ms cold load/,
  );
  await assert.rejects(
    probeWebviewPublicCapabilities(TARGET, { coldLoadTimeoutMs: Number.NaN }),
    /fixed 15000ms cold load/,
  );
});
