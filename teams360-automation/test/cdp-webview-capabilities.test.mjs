import assert from 'node:assert/strict';
import test from 'node:test';
import { probeWebviewPublicCapabilities } from '../lib/cdp-webview.mjs';

const TARGET = Object.freeze({ webSocketDebuggerUrl: 'ws://127.0.0.1:9222/devtools/page/qwork' });

function installFakeWebSocket(t, behavior) {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'WebSocket');
  class FakeWebSocket extends EventTarget {
    static instances = [];

    constructor(url) {
      super();
      this.url = url;
      this.closed = false;
      FakeWebSocket.instances.push(this);
      if (behavior === 'open-no-evaluate') {
        queueMicrotask(() => this.dispatchEvent(new Event('open')));
      } else if (behavior === 'connect-error') {
        queueMicrotask(() => this.dispatchEvent(new Event('error')));
      }
    }

    send(raw) {
      const message = JSON.parse(raw);
      if (behavior === 'open-no-evaluate' && message.method === 'Runtime.enable') {
        queueMicrotask(() => this.dispatchEvent(new MessageEvent('message', {
          data: JSON.stringify({ id: message.id, result: {} }),
        })));
      }
    }

    close() {
      if (this.closed) return;
      this.closed = true;
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

test('capabilities connect is bounded by the complete 2000ms attempt and closes its socket', async (t) => {
  const FakeWebSocket = installFakeWebSocket(t, 'never-open');
  const started = Date.now();
  const result = await probeWebviewPublicCapabilities(TARGET, { maxAttempts: 1 });
  const elapsed = Date.now() - started;
  assert.equal(result.ok, false);
  assert.equal(result.attempts.length, 1);
  assert.equal(result.attempts[0].timeout_ms, 2_000);
  assert.ok(elapsed >= 1_800, `attempt returned too early: ${elapsed}ms`);
  assert.ok(elapsed < 5_000, `attempt exceeded its bounded deadline: ${elapsed}ms`);
  assert.equal(FakeWebSocket.instances.length, 1);
  assert.equal(FakeWebSocket.instances[0].closed, true);
});

test('capabilities Runtime.evaluate shares the same complete 2000ms attempt deadline', async (t) => {
  const FakeWebSocket = installFakeWebSocket(t, 'open-no-evaluate');
  const started = Date.now();
  const result = await probeWebviewPublicCapabilities(TARGET, { maxAttempts: 1 });
  const elapsed = Date.now() - started;
  assert.equal(result.ok, false);
  assert.equal(result.attempts.length, 1);
  assert.equal(result.attempts[0].timeout_ms, 2_000);
  assert.ok(elapsed >= 1_800, `attempt returned too early: ${elapsed}ms`);
  assert.ok(elapsed < 5_000, `attempt exceeded its bounded deadline: ${elapsed}ms`);
  assert.equal(FakeWebSocket.instances[0].closed, true);
});

test('capabilities probing permits no more than three ordered attempts', async (t) => {
  installFakeWebSocket(t, 'connect-error');
  const result = await probeWebviewPublicCapabilities(TARGET, { maxAttempts: 3 });
  assert.equal(result.ok, false);
  assert.deepEqual(result.attempts.map((item) => item.attempt), [1, 2, 3]);
  assert.ok(result.attempts.every((item) => item.timeout_ms === 2_000));
  await assert.rejects(
    probeWebviewPublicCapabilities(TARGET, { maxAttempts: 4 }),
    /at most three attempts/,
  );
  await assert.rejects(
    probeWebviewPublicCapabilities(TARGET, { attemptTimeoutMs: 1_999 }),
    /require 2000ms attempts/,
  );
});
