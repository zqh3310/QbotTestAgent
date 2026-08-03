import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createCoreBetaFixtureController } from '../src/lib/core-beta-fixture-controller.mjs';

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'qbot-core-beta-fixture-controller-'));
const providerScript = path.join(tempRoot, 'provider.mjs');
fs.writeFileSync(providerScript, `
const chunks = [];
for await (const chunk of process.stdin) chunks.push(chunk);
const request = JSON.parse(Buffer.concat(chunks).toString('utf8'));
const requirement = request.requirement;
if (request.phase === 'preflight') {
  process.stdout.write(JSON.stringify({
    schema_version: 'qbot-core-beta-fixture-provider-response/v1',
    ok: true,
    phase: 'preflight',
    ...requirement,
    supported_phases: ['prepare', 'execute', 'restore']
  }));
} else if (request.phase === 'prepare') {
  process.stdout.write(JSON.stringify({ ok: true, lease_id: 'provider-lease-1' }));
} else if (request.phase === 'execute') {
  process.stdout.write(JSON.stringify({
    schema_version: 'qbot-core-beta-driver-response/v1',
    ok: true,
    status: 'passed',
    case_id: requirement.case_id,
    driver: requirement.driver,
    executor_route: requirement.executor_route,
    contract_sha256: requirement.contract_sha256,
    acknowledged_action_ids: requirement.action_ids,
    operations: [],
    assertions: [],
    oracle_results: [],
    evidence_files: {}
  }));
} else if (request.phase === 'restore') {
  process.stdout.write(JSON.stringify({ ok: true, restored: true }));
} else {
  process.stdout.write(JSON.stringify({ ok: false, reason: 'unsupported phase' }));
}
`);

const requirement = {
  case_id: 'BETA-TEST-001',
  adapter: 'test_adapter',
  driver: 'test_driver',
  executor_route: 'core-beta/scenario/beta-test-001/v1',
  contract_sha256: 'a'.repeat(64),
  action_ids: ['prepare', 'execute', 'verify'],
  evidence_roles: ['before_screenshot', 'action_receipt', 'after_screenshot', 'test_trace'],
  oracle_sha256s: ['b'.repeat(64)],
};

function writeManifest(providers) {
  const manifest = path.join(tempRoot, `providers-${Math.random().toString(16).slice(2)}.json`);
  fs.writeFileSync(manifest, `${JSON.stringify({
    schema_version: 'qbot-core-beta-fixture-providers/v1',
    providers,
  }, null, 2)}\n`);
  return manifest;
}

async function withController(providers, callback) {
  const controller = createCoreBetaFixtureController({
    providerManifest: writeManifest(providers),
    workDir: path.join(tempRoot, `runtime-${Math.random().toString(16).slice(2)}`),
  });
  const address = await controller.listen({ port: 0 });
  try {
    await callback(`http://127.0.0.1:${address.port}`);
  } finally {
    await controller.close();
  }
}

test('fixture controller fails closed when a requested Case has no executable provider', async () => {
  await withController([], async (baseUrl) => {
    const response = await fetch(`${baseUrl}/v1/core-beta/preflight`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        schema_version: 'qbot-core-beta-fixture-preflight/v1',
        required_adapters: ['test_adapter'],
        cases: [requirement],
      }),
    });
    assert.equal(response.status, 424);
    const body = await response.json();
    assert.equal(body.ok, false);
    assert.deepEqual(body.ready_adapters, []);
    assert.deepEqual(body.ready_cases, []);
    assert.equal(body.unavailable_cases[0].reason, 'provider_missing');
  });
});

test('fixture controller probes exact Case contract and enforces lease lifecycle', async () => {
  await withController([{
    id: 'test-provider',
    adapter: 'test_adapter',
    case_ids: [requirement.case_id],
    command: [process.execPath, providerScript],
    cwd: tempRoot,
    timeout_ms: 5_000,
  }], async (baseUrl) => {
    const health = await fetch(`${baseUrl}/health`).then((response) => response.json());
    assert.equal(health.ok, true);
    assert.equal(health.provider_count, 1);

    const preflightResponse = await fetch(`${baseUrl}/v1/core-beta/preflight`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        schema_version: 'qbot-core-beta-fixture-preflight/v1',
        required_adapters: ['test_adapter'],
        cases: [requirement],
      }),
    });
    assert.equal(preflightResponse.status, 200);
    const preflight = await preflightResponse.json();
    assert.equal(preflight.ok, true);
    assert.deepEqual(preflight.ready_adapters, ['test_adapter']);
    assert.equal(preflight.ready_cases[0].contract_sha256, requirement.contract_sha256);
    assert.equal(preflight.ready_cases[0].probe.stdout_bytes > 0, true);
    assert.equal(Object.hasOwn(preflight.ready_cases[0].probe, 'stdout'), false);

    const executeWithoutLease = await fetch(
      `${baseUrl}/v1/core-beta/cases/${requirement.case_id}/execute`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...requirement, fixture_control: requirement.adapter }),
      },
    );
    assert.equal(executeWithoutLease.status, 409);

    const prepareResponse = await fetch(
      `${baseUrl}/v1/core-beta/cases/${requirement.case_id}/prepare`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...requirement, fixture_control: requirement.adapter }),
      },
    );
    assert.equal(prepareResponse.status, 200);
    const prepared = await prepareResponse.json();
    assert.equal(prepared.ok, true);
    assert.equal(prepared.lease_id, 'provider-lease-1');

    const executeResponse = await fetch(
      `${baseUrl}/v1/core-beta/cases/${requirement.case_id}/execute`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          ...requirement,
          fixture_control: requirement.adapter,
          lease_id: prepared.lease_id,
        }),
      },
    );
    assert.equal(executeResponse.status, 200);
    const executed = await executeResponse.json();
    assert.equal(executed.schema_version, 'qbot-core-beta-driver-response/v1');
    assert.equal(executed.case_id, requirement.case_id);

    const restoreResponse = await fetch(
      `${baseUrl}/v1/core-beta/cases/${requirement.case_id}/restore`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          ...requirement,
          fixture_control: requirement.adapter,
          lease_id: prepared.lease_id,
        }),
      },
    );
    assert.equal(restoreResponse.status, 200);
    const restored = await restoreResponse.json();
    assert.equal(restored.restored, true);

    const repeatedRestore = await fetch(
      `${baseUrl}/v1/core-beta/cases/${requirement.case_id}/restore`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          ...requirement,
          fixture_control: requirement.adapter,
          lease_id: prepared.lease_id,
        }),
      },
    );
    assert.equal(repeatedRestore.status, 409);
  });
});
