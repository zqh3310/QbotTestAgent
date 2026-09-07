import { createHash } from 'node:crypto';

export const QWORK_CAPABILITIES_COLD_LOAD_TIMEOUT_MS = 15_000;
export const QWORK_CAPABILITIES_STABLE_READ_TIMEOUT_MS = 2_000;
export const QWORK_CAPABILITIES_NODE_TIMEOUT_GRACE_MS = 500;
const QWORK_CAPABILITIES_TIMING_TOLERANCE_MS = 250;

export const QWORK_CAPABILITIES_READBACK_PHASES = Object.freeze([
  Object.freeze({
    phase: 'cold_load',
    rendererTimeoutMs: QWORK_CAPABILITIES_COLD_LOAD_TIMEOUT_MS,
    nodeTimeoutMs: QWORK_CAPABILITIES_COLD_LOAD_TIMEOUT_MS
      + QWORK_CAPABILITIES_NODE_TIMEOUT_GRACE_MS,
  }),
  Object.freeze({
    phase: 'stable_read_1',
    rendererTimeoutMs: QWORK_CAPABILITIES_STABLE_READ_TIMEOUT_MS,
    nodeTimeoutMs: QWORK_CAPABILITIES_STABLE_READ_TIMEOUT_MS
      + QWORK_CAPABILITIES_NODE_TIMEOUT_GRACE_MS,
  }),
  Object.freeze({
    phase: 'stable_read_2',
    rendererTimeoutMs: QWORK_CAPABILITIES_STABLE_READ_TIMEOUT_MS,
    nodeTimeoutMs: QWORK_CAPABILITIES_STABLE_READ_TIMEOUT_MS
      + QWORK_CAPABILITIES_NODE_TIMEOUT_GRACE_MS,
  }),
]);

function valueType(value) {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value;
}

export function qworkCapabilitiesCanonicalProjection(value) {
  const type = valueType(value);
  const valid = type === 'object';
  return {
    value_type: type,
    keys: valid ? Object.keys(value).sort() : [],
    selection_fields: {
      selectedSkills: valid && Object.hasOwn(value, 'selectedSkills'),
      selectedConnectors: valid && Object.hasOwn(value, 'selectedConnectors'),
      currentExpert: valid && Object.hasOwn(value, 'currentExpert'),
    },
  };
}

export function qworkCapabilitiesCanonicalSignature(value) {
  const projection = qworkCapabilitiesCanonicalProjection(value);
  return createHash('sha256').update(JSON.stringify(projection)).digest('hex');
}

function compactError(error) {
  return String(error?.message || error || 'unknown capabilities readback error')
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 1200);
}

function failedReadback(probeLedger, error) {
  return {
    schema: 'qbot-qwork-capabilities-readback/v1',
    ok: false,
    source: 'window.agent.capabilities',
    probe_started: probeLedger.length > 0,
    value: null,
    error: compactError(error),
    summary_signature_sha256: '',
    value_type: '',
    keys: [],
    selection_fields: {
      selectedSkills: false,
      selectedConnectors: false,
      currentExpert: false,
    },
    cold_load_timeout_ms: QWORK_CAPABILITIES_COLD_LOAD_TIMEOUT_MS,
    stable_read_timeout_ms: QWORK_CAPABILITIES_STABLE_READ_TIMEOUT_MS,
    required_stable_readbacks: 2,
    probe_ledger: probeLedger,
  };
}

const QWORK_CAPABILITIES_PRE_PROBE_FAILURE_STAGES = new Set([
  'target_discovery',
  'cdp_connect',
  'runtime_enable',
]);

export function qworkCapabilitiesPreProbeFailure({
  stage,
  errorCode,
  error,
} = {}) {
  const normalizedStage = String(stage || '').trim();
  const normalizedErrorCode = String(errorCode || '').trim();
  if (!QWORK_CAPABILITIES_PRE_PROBE_FAILURE_STAGES.has(normalizedStage)) {
    throw new Error('Invalid QWork capabilities pre-probe failure stage.');
  }
  if (!normalizedErrorCode) {
    throw new Error('QWork capabilities pre-probe failure requires an error code.');
  }
  return {
    ...failedReadback([], error),
    probe_started: false,
    pre_probe_failure: {
      schema: 'qbot-qwork-capabilities-pre-probe-failure/v1',
      stage: normalizedStage,
      error_code: normalizedErrorCode,
    },
  };
}

export async function readStableQworkCapabilities(readCapabilities, {
  setTimeoutFn = globalThis.setTimeout,
  clearTimeoutFn = globalThis.clearTimeout,
} = {}) {
  if (typeof readCapabilities !== 'function') {
    return failedReadback([], 'missing capabilities read function');
  }
  if (typeof setTimeoutFn !== 'function' || typeof clearTimeoutFn !== 'function') {
    return failedReadback([], 'invalid Node timeout implementation');
  }

  const probeLedger = [];
  let expectedSignature = '';
  let finalValue = null;
  let finalProjection = null;

  for (const [index, spec] of QWORK_CAPABILITIES_READBACK_PHASES.entries()) {
    const startedAt = new Date().toISOString();
    const startedAtMs = Date.now();
    let timeoutHandle = null;
    let projection = null;
    let signature = '';
    try {
      const operation = Promise.resolve().then(() => readCapabilities({
        attempt: index + 1,
        phase: spec.phase,
        rendererTimeoutMs: spec.rendererTimeoutMs,
        nodeTimeoutMs: spec.nodeTimeoutMs,
      }));
      const nodeDeadline = new Promise((_, reject) => {
        timeoutHandle = setTimeoutFn(
          () => reject(new Error(
            `QWork capabilities ${spec.phase} Node hard timeout after ${spec.nodeTimeoutMs}ms`,
          )),
          spec.nodeTimeoutMs,
        );
      });
      const value = await Promise.race([operation, nodeDeadline]);
      projection = qworkCapabilitiesCanonicalProjection(value);
      if (projection.value_type !== 'object' || value?.__error) {
        throw new Error(
          value?.__error
            ? `QWork capabilities ${spec.phase} failed: ${compactError(value.__error)}`
            : `QWork capabilities ${spec.phase} returned ${projection.value_type}, expected object`,
        );
      }
      signature = qworkCapabilitiesCanonicalSignature(value);
      const ledgerEntry = {
        attempt: index + 1,
        phase: spec.phase,
        renderer_timeout_ms: spec.rendererTimeoutMs,
        node_timeout_ms: spec.nodeTimeoutMs,
        started_at: startedAt,
        ended_at: new Date().toISOString(),
        duration_ms: Math.max(0, Date.now() - startedAtMs),
        ok: true,
        error: '',
        ...projection,
        summary_signature_sha256: signature,
      };
      probeLedger.push(ledgerEntry);

      if (!expectedSignature) expectedSignature = signature;
      else if (signature !== expectedSignature) {
        ledgerEntry.ok = false;
        ledgerEntry.error = 'QWork capabilities canonical signature drifted';
        return failedReadback(probeLedger, ledgerEntry.error);
      }
      finalValue = value;
      finalProjection = projection;
    } catch (error) {
      probeLedger.push({
        attempt: index + 1,
        phase: spec.phase,
        renderer_timeout_ms: spec.rendererTimeoutMs,
        node_timeout_ms: spec.nodeTimeoutMs,
        started_at: startedAt,
        ended_at: new Date().toISOString(),
        duration_ms: Math.max(0, Date.now() - startedAtMs),
        ok: false,
        error: compactError(error),
        value_type: projection?.value_type || '',
        keys: projection?.keys || [],
        selection_fields: projection?.selection_fields || {
          selectedSkills: false,
          selectedConnectors: false,
          currentExpert: false,
        },
        summary_signature_sha256: signature,
      });
      return failedReadback(probeLedger, error);
    } finally {
      if (timeoutHandle !== null) clearTimeoutFn(timeoutHandle);
    }
  }

  return {
    schema: 'qbot-qwork-capabilities-readback/v1',
    ok: true,
    source: 'window.agent.capabilities',
    probe_started: true,
    value: finalValue,
    error: '',
    summary_signature_sha256: expectedSignature,
    ...finalProjection,
    cold_load_timeout_ms: QWORK_CAPABILITIES_COLD_LOAD_TIMEOUT_MS,
    stable_read_timeout_ms: QWORK_CAPABILITIES_STABLE_READ_TIMEOUT_MS,
    required_stable_readbacks: 2,
    probe_ledger: probeLedger,
  };
}

function canonicalProjectionSignature(projection) {
  return createHash('sha256').update(JSON.stringify({
    value_type: String(projection?.value_type || ''),
    keys: Array.isArray(projection?.keys) ? [...projection.keys] : [],
    selection_fields: {
      selectedSkills: projection?.selection_fields?.selectedSkills === true,
      selectedConnectors: projection?.selection_fields?.selectedConnectors === true,
      currentExpert: projection?.selection_fields?.currentExpert === true,
    },
  })).digest('hex');
}

function strictIsoTimestamp(value) {
  if (typeof value !== 'string' || !value) return Number.NaN;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString() === value
    ? timestamp
    : Number.NaN;
}

export function validateQworkCapabilitiesReadbackEvidence(readback) {
  const errors = [];
  const object = readback && typeof readback === 'object' && !Array.isArray(readback)
    ? readback
    : null;
  if (!object) {
    return { ok: false, valid: false, errors: ['readback_not_object'] };
  }
  if (object.schema !== 'qbot-qwork-capabilities-readback/v1') errors.push('schema_invalid');
  if (object.ok !== true) errors.push('readback_not_ok');
  if (object.source !== 'window.agent.capabilities') errors.push('source_invalid');
  if (object.probe_started !== true) errors.push('probe_not_started');
  if (Object.hasOwn(object, 'pre_probe_failure')) errors.push('pre_probe_failure_present');
  if (object.error !== '') errors.push('readback_error_present');
  if (object.cold_load_timeout_ms !== QWORK_CAPABILITIES_COLD_LOAD_TIMEOUT_MS) {
    errors.push('cold_load_timeout_invalid');
  }
  if (object.stable_read_timeout_ms !== QWORK_CAPABILITIES_STABLE_READ_TIMEOUT_MS) {
    errors.push('stable_read_timeout_invalid');
  }
  if (object.required_stable_readbacks !== 2) errors.push('stable_read_count_invalid');

  const ledger = Array.isArray(object.probe_ledger) ? object.probe_ledger : [];
  if (ledger.length !== QWORK_CAPABILITIES_READBACK_PHASES.length) {
    errors.push('probe_ledger_length_invalid');
  }
  let previousEndedAt = Number.NaN;
  for (const [index, spec] of QWORK_CAPABILITIES_READBACK_PHASES.entries()) {
    const entry = ledger[index];
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      errors.push(`probe_${index + 1}_missing`);
      continue;
    }
    if (entry.attempt !== index + 1) errors.push(`probe_${index + 1}_attempt_invalid`);
    if (entry.phase !== spec.phase) errors.push(`probe_${index + 1}_phase_invalid`);
    if (entry.renderer_timeout_ms !== spec.rendererTimeoutMs) {
      errors.push(`probe_${index + 1}_renderer_timeout_invalid`);
    }
    if (entry.node_timeout_ms !== spec.nodeTimeoutMs) {
      errors.push(`probe_${index + 1}_node_timeout_invalid`);
    }
    const startedAt = strictIsoTimestamp(entry.started_at);
    const endedAt = strictIsoTimestamp(entry.ended_at);
    if (!Number.isFinite(startedAt)) errors.push(`probe_${index + 1}_started_at_invalid`);
    if (!Number.isFinite(endedAt)) errors.push(`probe_${index + 1}_ended_at_invalid`);
    if (Number.isFinite(startedAt) && Number.isFinite(endedAt) && endedAt < startedAt) {
      errors.push(`probe_${index + 1}_ended_before_started`);
    }
    const elapsedMs = Number.isFinite(startedAt) && Number.isFinite(endedAt)
      ? endedAt - startedAt
      : Number.NaN;
    if (Number.isFinite(elapsedMs)
      && elapsedMs > spec.nodeTimeoutMs + QWORK_CAPABILITIES_TIMING_TOLERANCE_MS) {
      errors.push(`probe_${index + 1}_elapsed_exceeds_node_timeout`);
    }
    if (Number.isFinite(startedAt)
      && Number.isFinite(previousEndedAt)
      && startedAt < previousEndedAt) {
      errors.push(`probe_${index + 1}_started_before_previous_end`);
    }
    if (Number.isFinite(endedAt)) previousEndedAt = endedAt;
    const durationValid = Number.isSafeInteger(entry.duration_ms) && entry.duration_ms >= 0;
    if (!durationValid) {
      errors.push(`probe_${index + 1}_duration_invalid`);
    } else {
      if (entry.duration_ms > spec.nodeTimeoutMs + QWORK_CAPABILITIES_TIMING_TOLERANCE_MS) {
        errors.push(`probe_${index + 1}_duration_exceeds_node_timeout`);
      }
      if (Number.isFinite(elapsedMs)
        && Math.abs(entry.duration_ms - elapsedMs) > QWORK_CAPABILITIES_TIMING_TOLERANCE_MS) {
        errors.push(`probe_${index + 1}_duration_timestamp_mismatch`);
      }
    }
    if (entry.ok !== true) errors.push(`probe_${index + 1}_not_ok`);
    if (entry.value_type !== 'object') errors.push(`probe_${index + 1}_value_type_invalid`);
    if (entry.error !== '') errors.push(`probe_${index + 1}_error_present`);
    const keys = Array.isArray(entry.keys) ? entry.keys : null;
    if (!keys
      || keys.some((key) => typeof key !== 'string')
      || new Set(keys).size !== keys.length
      || keys.some((key, keyIndex) => keyIndex > 0 && keys[keyIndex - 1] > key)) {
      errors.push(`probe_${index + 1}_keys_invalid`);
    }
    const selection = entry.selection_fields;
    if (!selection
      || typeof selection !== 'object'
      || ['selectedSkills', 'selectedConnectors', 'currentExpert']
        .some((key) => typeof selection[key] !== 'boolean')) {
      errors.push(`probe_${index + 1}_selection_fields_invalid`);
    } else if (keys && ['selectedSkills', 'selectedConnectors', 'currentExpert']
      .some((key) => selection[key] !== keys.includes(key))) {
      errors.push(`probe_${index + 1}_selection_keys_mismatch`);
    }
    if (!/^[a-f0-9]{64}$/.test(String(entry.summary_signature_sha256 || ''))) {
      errors.push(`probe_${index + 1}_signature_invalid`);
    } else if (entry.summary_signature_sha256 !== canonicalProjectionSignature(entry)) {
      errors.push(`probe_${index + 1}_signature_projection_mismatch`);
    }
  }

  const topSignature = String(object.summary_signature_sha256 || '');
  if (!/^[a-f0-9]{64}$/.test(topSignature)) errors.push('summary_signature_invalid');
  if (ledger.some((entry) => entry?.summary_signature_sha256 !== topSignature)) {
    errors.push('probe_signatures_not_stable');
  }
  const finalEntry = ledger.at(-1);
  if (object.value_type !== finalEntry?.value_type) errors.push('value_type_not_final');
  if (JSON.stringify(object.keys) !== JSON.stringify(finalEntry?.keys)) errors.push('keys_not_final');
  if (JSON.stringify(object.selection_fields) !== JSON.stringify(finalEntry?.selection_fields)) {
    errors.push('selection_fields_not_final');
  }
  if (topSignature && topSignature !== canonicalProjectionSignature(object)) {
    errors.push('summary_signature_projection_mismatch');
  }
  if (Object.hasOwn(object, 'value')) {
    const valueProjection = qworkCapabilitiesCanonicalProjection(object.value);
    if (valueProjection.value_type !== 'object') errors.push('value_not_object');
    if (JSON.stringify(valueProjection) !== JSON.stringify({
      value_type: object.value_type,
      keys: object.keys,
      selection_fields: object.selection_fields,
    })) errors.push('value_projection_mismatch');
  }

  return { ok: errors.length === 0, valid: errors.length === 0, errors };
}

export function qworkCapabilitiesReadbackEvidence(readback) {
  if (!readback || typeof readback !== 'object') return null;
  const { value: _value, ...evidence } = readback;
  return {
    ...evidence,
    probe_ledger: Array.isArray(evidence.probe_ledger)
      ? evidence.probe_ledger.map((entry) => ({
        ...entry,
        keys: Array.isArray(entry.keys) ? [...entry.keys] : [],
        selection_fields: { ...(entry.selection_fields || {}) },
      }))
      : [],
  };
}
