import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  assertFrozenControlPlaneBinding,
  bindAbortCleanupTask,
  buildUnconfirmedG5SendReceipt,
  dispatchTrustedVisibleControlClick,
  parseQworkSoakCliOptions,
  readReleaseControlStatus,
  stopRunningTaskWithVisibleControl,
} from '../lib/qwork-soak-cli.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const TEAMS_ROOT = path.resolve(HERE, '..');

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

test('G5 CLI requires the valueless GitLab stdin flag', () => {
  const required = [
    '--state-dir', '/tmp/qwork-release-control',
    '--out', path.join(TEAMS_ROOT, 'output', 'new-soak'),
  ];
  assert.throws(() => parseQworkSoakCliOptions(required), /--gitlab-token-stdin is required/);
  assert.throws(
    () => parseQworkSoakCliOptions([...required, '--gitlab-token-stdin=secret']),
    /must not include a command-line value/,
  );
  const parsed = parseQworkSoakCliOptions([...required, '--gitlab-token-stdin']);
  assert.equal(parsed.gitLabTokenStdin, true);
});

test('release-control verification passes one token through stdin only', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'qwork-soak-token-'));
  const fakeOrchestrator = path.join(root, 'orchestrator.mjs');
  const secret = `glpat-soak-${process.pid}-${Date.now()}`;
  fs.writeFileSync(fakeOrchestrator, `
    import { createHash } from 'node:crypto';
    const chunks = [];
    for await (const chunk of process.stdin) chunks.push(chunk);
    const input = Buffer.concat(chunks).toString('utf8').trim();
    process.stdout.write(JSON.stringify({
      argv: process.argv.slice(2),
      stdin_sha256: createHash('sha256').update(input).digest('hex'),
      token_present_in_environment: Object.values(process.env).includes(input),
    }));
  `, { mode: 0o600 });

  const stateDir = path.join(root, 'control');
  const observed = readReleaseControlStatus(stateDir, Buffer.from(`${secret}\n`), {
    orchestratorPath: fakeOrchestrator,
    environment: { ...process.env },
  });
  assert.deepEqual(observed.argv, [
    'status', '--state-dir', stateDir, '--gitlab-token-stdin',
  ]);
  assert.equal(observed.stdin_sha256, sha256(secret));
  assert.equal(observed.token_present_in_environment, false);
  assert.equal(observed.argv.includes(secret), false);
});

test('release-control errors redact a child process that echoes the stdin token', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'qwork-soak-token-error-'));
  const fakeOrchestrator = path.join(root, 'orchestrator.mjs');
  const secret = `glpat-soak-error-${process.pid}-${Date.now()}`;
  fs.writeFileSync(fakeOrchestrator, `
    const chunks = [];
    for await (const chunk of process.stdin) chunks.push(chunk);
    process.stderr.write('rejected ' + Buffer.concat(chunks).toString('utf8').trim());
    process.exitCode = 7;
  `, { mode: 0o600 });

  assert.throws(
    () => readReleaseControlStatus('/tmp/control', Buffer.from(`${secret}\n`), {
      orchestratorPath: fakeOrchestrator,
      environment: { ...process.env },
    }),
    (error) => {
      assert.doesNotMatch(error.message, new RegExp(secret));
      assert.match(error.message, /\[REDACTED\]/);
      return true;
    },
  );
});

test('abort cleanup clicks the visible stop control once and proves the same task stopped', async () => {
  const states = [
    { captured_at: '2026-09-05T00:00:00.000Z', task_id: 'task-1', running: true },
    { captured_at: '2026-09-05T00:00:01.000Z', task_id: 'task-1', running: false },
  ];
  let current = states[0];
  let clickCount = 0;
  const result = await stopRunningTaskWithVisibleControl({
    taskId: 'task-1',
    readState: async () => {
      current = states.shift() || current;
      return current;
    },
    locateControl: async () => ({ visible: current.running, x: 10, y: 20 }),
    clickControl: async () => { clickCount += 1; },
    wait: async () => {},
    pollAttempts: 1,
    pollIntervalMs: 0,
  });
  assert.equal(result.stopped, true);
  assert.equal(result.click_count, 1);
  assert.equal(clickCount, 1);
  assert.equal(result.expected_task_id, 'task-1');
  assert.equal(result.observations.at(-1).task_id, 'task-1');
  assert.equal(result.observations.at(-1).running, false);
});

test('abort cleanup refuses another task and never retries an ambiguous task switch', async () => {
  const states = [
    { captured_at: '2026-09-05T00:00:00.000Z', task_id: 'task-1', running: true },
    { captured_at: '2026-09-05T00:00:01.000Z', task_id: 'task-2', running: true },
  ];
  let current = states[0];
  let clickCount = 0;
  const result = await stopRunningTaskWithVisibleControl({
    taskId: 'task-1',
    readState: async () => {
      current = states.shift() || current;
      return current;
    },
    locateControl: async () => ({ visible: true, x: 10, y: 20 }),
    clickControl: async () => { clickCount += 1; },
    wait: async () => {},
    pollAttempts: 1,
    pollIntervalMs: 0,
  });
  assert.equal(result.stopped, false);
  assert.equal(result.reason, 'active_task_identity_drifted_after_click');
  assert.equal(result.click_count, 1);
  assert.equal(clickCount, 1);
});

test('G5 abort implementation has no preload cancellation bypass', () => {
  const source = fs.readFileSync(path.join(TEAMS_ROOT, 'lib', 'qwork-soak-cli.mjs'), 'utf8');
  assert.doesNotMatch(source, /cancelTurn|window\??\.agent\??\.cancel/);
  assert.match(source, /Input\.dispatchMouseEvent/);
  assert.match(source, /maximumClicks\s*=\s*2/);
});

test('trusted visible control dispatch emits exactly one physical press and release', async () => {
  const commands = [];
  let reads = 0;
  const client = {
    async evaluate() {
      reads += 1;
      return {
        visible: true,
        selector: '[data-testid="composer-send"]',
        label: '发送',
        x: 10,
        y: 20,
        width: 20,
        height: 20,
      };
    },
    async send(method, params) {
      commands.push({ method, params });
    },
  };
  const receipt = await dispatchTrustedVisibleControlClick(
    client,
    ['[data-testid="composer-send"]'],
    'test send',
  );
  assert.equal(reads, 2);
  assert.equal(receipt.click_count, 1);
  assert.equal(commands.filter((item) => item.params.type === 'mousePressed').length, 1);
  assert.equal(commands.filter((item) => item.params.type === 'mouseReleased').length, 1);
  assert.deepEqual(commands.map((item) => item.params.type), [
    'mouseMoved',
    'mousePressed',
    'mouseReleased',
  ]);
});

test('an unconfirmed send binds a running task for abort cleanup only', () => {
  const cleanupTaskId = bindAbortCleanupTask('', { running: true, task_id: 'task-cleanup-1' });
  const receipt = buildUnconfirmedG5SendReceipt({
    click: { click_count: 1 },
    before: { running: false, task_id: '' },
    after: { running: true, task_id: 'task-cleanup-1' },
    cleanupTaskId,
  });
  assert.equal(receipt.confirmed, false);
  assert.equal(receipt.accepted_by_product, false);
  assert.equal(receipt.confirmed_at, '');
  assert.equal('task_id' in receipt, false);
  assert.equal('user_message_id' in receipt, false);
  assert.deepEqual(receipt.observed.cleanup_task_binding, {
    task_id: 'task-cleanup-1',
    cleanup_only: true,
    confirmed_send: false,
  });
});

test('frozen, session and renderer control-plane origins must be identical', () => {
  const origin = 'https://deepbank-control-sit.sandbox.deepbank.daikuan.qihoo.net';
  assert.deepEqual(assertFrozenControlPlaneBinding({
    frozen: `${origin}/`,
    session: origin,
    renderer: `${origin}/health`,
  }), {
    frozen_origin: origin,
    session_origin: origin,
    renderer_origin: origin,
    all_equal: true,
  });
  assert.throws(() => assertFrozenControlPlaneBinding({
    frozen: origin,
    session: origin,
    renderer: 'https://unexpected.example.test',
  }), /control-plane identity mismatch/);
  assert.throws(() => assertFrozenControlPlaneBinding({
    frozen: origin,
    session: 'https://unexpected.example.test',
    renderer: origin,
  }), /control-plane identity mismatch/);
});
