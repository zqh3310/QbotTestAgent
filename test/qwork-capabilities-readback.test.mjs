import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import {
  QWORK_CAPABILITIES_READBACK_PHASES,
  qworkCapabilitiesCanonicalProjection,
  qworkCapabilitiesReadbackEvidence,
  readStableQworkCapabilities,
  validateQworkCapabilitiesReadbackEvidence,
} from '../src/lib/qwork-capabilities-readback.mjs';

const baseCapabilities = () => ({
  selectedSkills: [],
  selectedConnectors: [],
  currentExpert: null,
  routing: { mode: 'auto' },
});

function projectionSignature(value) {
  return createHash('sha256').update(JSON.stringify({
    value_type: value.value_type,
    keys: value.keys,
    selection_fields: value.selection_fields,
  })).digest('hex');
}

test('uses one 15000ms cold load and exactly two 2000ms stable reads', async () => {
  const calls = [];
  const values = [
    baseCapabilities(),
    {
      routing: { mode: 'manual' },
      currentExpert: { id: 'dynamic-expert' },
      selectedConnectors: ['dynamic-connector'],
      selectedSkills: ['dynamic-skill'],
    },
    {
      selectedSkills: ['final-skill'],
      selectedConnectors: [],
      currentExpert: null,
      routing: { mode: 'auto' },
    },
  ];

  const result = await readStableQworkCapabilities(async (phase) => {
    calls.push(phase);
    return values[calls.length - 1];
  });

  assert.equal(result.ok, true);
  assert.equal(result.value, values[2], 'callers must receive stable_read_2 rather than the cold value');
  assert.deepEqual(calls, QWORK_CAPABILITIES_READBACK_PHASES.map((spec, index) => ({
    attempt: index + 1,
    phase: spec.phase,
    rendererTimeoutMs: spec.rendererTimeoutMs,
    nodeTimeoutMs: spec.nodeTimeoutMs,
  })));
  assert.deepEqual(result.probe_ledger.map((entry) => entry.phase), [
    'cold_load',
    'stable_read_1',
    'stable_read_2',
  ]);
  assert.deepEqual(result.probe_ledger.map((entry) => entry.renderer_timeout_ms), [15_000, 2_000, 2_000]);
  assert.deepEqual(result.probe_ledger.map((entry) => entry.node_timeout_ms), [15_500, 2_500, 2_500]);
  assert.ok(result.probe_ledger.every((entry) => entry.ok === true));
  assert.ok(result.probe_ledger.every(
    (entry) => entry.summary_signature_sha256 === result.summary_signature_sha256,
  ));
});

test('canonical projection ignores key order and dynamic selection values', () => {
  const first = baseCapabilities();
  const second = {
    routing: { mode: 'manual' },
    currentExpert: { id: 'changed' },
    selectedConnectors: ['changed'],
    selectedSkills: ['changed'],
  };
  assert.deepEqual(
    qworkCapabilitiesCanonicalProjection(first),
    qworkCapabilitiesCanonicalProjection(second),
  );
});

test('rejects key drift and stops after the drifting phase', async () => {
  let calls = 0;
  const result = await readStableQworkCapabilities(async () => {
    calls += 1;
    return calls === 2 ? { ...baseCapabilities(), unexpected: true } : baseCapabilities();
  });

  assert.equal(result.ok, false);
  assert.equal(calls, 2);
  assert.equal(result.probe_ledger.length, 2);
  assert.equal(result.probe_ledger[1].ok, false);
  assert.match(result.error, /signature drifted/);
});

test('rejects selection-field presence drift even when enumerable keys stay unchanged', async () => {
  let calls = 0;
  const result = await readStableQworkCapabilities(async () => {
    calls += 1;
    const value = { routing: { mode: 'auto' } };
    if (calls === 2) {
      Object.defineProperty(value, 'selectedSkills', {
        configurable: true,
        enumerable: false,
        value: [],
      });
    }
    return value;
  });

  assert.equal(result.ok, false);
  assert.equal(calls, 2);
  assert.deepEqual(result.probe_ledger[0].keys, result.probe_ledger[1].keys);
  assert.notDeepEqual(
    result.probe_ledger[0].selection_fields,
    result.probe_ledger[1].selection_fields,
  );
});

for (const [label, value, expectedType] of [
  ['null', null, 'null'],
  ['array', [], 'array'],
  ['string', 'not-an-object', 'string'],
]) {
  test(`rejects ${label} without entering a later phase`, async () => {
    let calls = 0;
    const result = await readStableQworkCapabilities(async () => {
      calls += 1;
      return value;
    });
    assert.equal(result.ok, false);
    assert.equal(calls, 1);
    assert.equal(result.probe_ledger[0].value_type, expectedType);
  });
}

test('Node hard timeout terminates a hanging callback and clears its timer', async () => {
  const scheduled = [];
  const cleared = [];
  const setTimeoutFn = (callback, timeoutMs) => {
    const handle = { timeoutMs };
    scheduled.push(handle);
    queueMicrotask(callback);
    return handle;
  };
  const clearTimeoutFn = (handle) => cleared.push(handle);
  let calls = 0;

  const result = await readStableQworkCapabilities(() => {
    calls += 1;
    return new Promise(() => {});
  }, { setTimeoutFn, clearTimeoutFn });

  assert.equal(result.ok, false);
  assert.equal(calls, 1);
  assert.deepEqual(scheduled.map((handle) => handle.timeoutMs), [15_500]);
  assert.deepEqual(cleared, scheduled);
  assert.match(result.error, /Node hard timeout/);
});

test('clears all Node deadline timers after three successful reads', async () => {
  const handles = [];
  const cleared = [];
  const setTimeoutFn = (_callback, timeoutMs) => {
    const handle = { timeoutMs };
    handles.push(handle);
    return handle;
  };
  const result = await readStableQworkCapabilities(
    async () => baseCapabilities(),
    { setTimeoutFn, clearTimeoutFn: (handle) => cleared.push(handle) },
  );

  assert.equal(result.ok, true);
  assert.equal(handles.length, 3);
  assert.deepEqual(cleared, handles);
});

test('evidence projection retains the complete ledger without duplicating capability values', async () => {
  const result = await readStableQworkCapabilities(async () => baseCapabilities());
  const evidence = qworkCapabilitiesReadbackEvidence(result);

  assert.equal(Object.hasOwn(evidence, 'value'), false);
  assert.equal(evidence.probe_ledger.length, 3);
  assert.deepEqual(evidence.probe_ledger.map((entry) => entry.attempt), [1, 2, 3]);
  assert.ok(evidence.probe_ledger.every((entry) => Array.isArray(entry.keys)));
  assert.deepEqual(validateQworkCapabilitiesReadbackEvidence(result), {
    ok: true,
    valid: true,
    errors: [],
  });
  assert.deepEqual(validateQworkCapabilitiesReadbackEvidence(evidence), {
    ok: true,
    valid: true,
    errors: [],
  });
});

test('shared validator fails closed for phase, budget, timing, error, signature, or final projection drift', async () => {
  const result = await readStableQworkCapabilities(async () => baseCapabilities());
  for (const [expectedError, mutate] of [
    ['probe_not_started', (copy) => { copy.probe_started = false; }],
    ['pre_probe_failure_present', (copy) => {
      copy.pre_probe_failure = {
        schema: 'qbot-qwork-capabilities-pre-probe-failure/v1',
        stage: 'runtime_enable',
        error_code: 'forged',
      };
    }],
    ['probe_1_phase_invalid', (copy) => { copy.probe_ledger[0].phase = 'stable_read_0'; }],
    ['probe_2_renderer_timeout_invalid', (copy) => {
      copy.probe_ledger[1].renderer_timeout_ms = 1_999;
    }],
    ['probe_1_started_at_invalid', (copy) => { copy.probe_ledger[0].started_at = 'forged'; }],
    ['probe_1_ended_at_invalid', (copy) => { copy.probe_ledger[0].ended_at = 'forged'; }],
    ['probe_1_duration_invalid', (copy) => { copy.probe_ledger[0].duration_ms = -1; }],
    ['probe_1_duration_exceeds_node_timeout', (copy) => {
      copy.probe_ledger[0].duration_ms = 16_000;
    }],
    ['probe_1_elapsed_exceeds_node_timeout', (copy) => {
      copy.probe_ledger[0].ended_at = new Date(
        Date.parse(copy.probe_ledger[0].started_at) + 16_000,
      ).toISOString();
    }],
    ['probe_1_duration_timestamp_mismatch', (copy) => {
      copy.probe_ledger[0].duration_ms = 1_000;
    }],
    ['probe_1_ended_before_started', (copy) => {
      copy.probe_ledger[0].ended_at = new Date(
        Date.parse(copy.probe_ledger[0].started_at) - 1,
      ).toISOString();
    }],
    ['probe_2_started_before_previous_end', (copy) => {
      copy.probe_ledger[0].ended_at = new Date(
        Date.parse(copy.probe_ledger[0].started_at) + 1_000,
      ).toISOString();
      copy.probe_ledger[1].started_at = copy.probe_ledger[0].started_at;
    }],
    ['readback_error_present', (copy) => { copy.error = 'forged'; }],
    ['probe_3_signature_projection_mismatch', (copy) => {
      copy.probe_ledger[2].summary_signature_sha256 = '0'.repeat(64);
    }],
    ['keys_not_final', (copy) => { copy.keys = [...copy.keys, 'forged']; }],
    ['probe_1_selection_keys_mismatch', (copy) => {
      for (const entry of copy.probe_ledger) {
        entry.selection_fields.selectedSkills = false;
        entry.summary_signature_sha256 = projectionSignature(entry);
      }
      copy.selection_fields.selectedSkills = false;
      copy.summary_signature_sha256 = projectionSignature(copy);
    }],
  ]) {
    const copy = structuredClone(qworkCapabilitiesReadbackEvidence(result));
    mutate(copy);
    const validation = validateQworkCapabilitiesReadbackEvidence(copy);
    assert.equal(validation.valid, false);
    assert.ok(validation.errors.includes(expectedError), validation.errors.join(','));
  }
});

test('rejects an error sentinel even though it is an object', async () => {
  const result = await readStableQworkCapabilities(async () => ({ __error: 'renderer failed' }));
  assert.equal(result.ok, false);
  assert.match(result.error, /renderer failed/);
  assert.equal(result.probe_ledger.length, 1);
});
