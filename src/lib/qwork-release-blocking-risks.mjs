import { createHash } from 'node:crypto';

export const QWORK_RELEASE_BLOCKING_RISK_SCHEMA = 'qbot-qwork-release-blocking-risk-attestation/v2';
export const QWORK_MR1552_EXECUTION_RUNNER_RISK_ID = 'deepbankv2-mr-1552-execution-runner-isolation/v1';
export const QWORK_MR1552_MERGE_COMMIT_SHA = '0720d31baf1d53bfd61e5428173d39b59472cdb7';
export const QWORK_MR1559_EXECUTION_RUNNER_SUCCESSOR_ID = 'deepbankv2-mr-1559-per-turn-utility-process/v1';
export const QWORK_MR1559_MERGE_COMMIT_SHA = '8de62614f6e0c5daa1e33d3357468967b958b006';
export const QWORK_MR1552_LEGACY_PROTECTED_PATHS = Object.freeze([
  'electron/execution-worker.cjs',
  'electron/host-core/agent/execution-worker-entry.cjs',
  'electron/host-core/agent/execution-worker-protocol.cjs',
  'electron/host-core/agent/execution-worker-supervisor.cjs',
  'electron/host-core/agent/execution-worker-process-lifecycle.cjs',
  'server/qbot-core/engine/engine.mjs',
]);
export const QWORK_MR1559_SUCCESSOR_PROTECTED_PATHS = Object.freeze([
  'electron/execution-worker.cjs',
  'electron/host-core/agent/execution-worker-entry.cjs',
  'electron/host-core/agent/execution-worker-manager.cjs',
  'electron/host-core/agent/execution-worker-supervisor.cjs',
  'electron/host-core/agent/execution-worker-process-lifecycle.cjs',
  'electron/host-core/agent/desktop-host-context.cjs',
  'electron/host-core/agent/embed-execution-worker.cjs',
]);
export const QWORK_RELEASE_BLOCKING_RISK_PROTECTED_PATHS = Object.freeze([
  ...new Set([...QWORK_MR1552_LEGACY_PROTECTED_PATHS, ...QWORK_MR1559_SUCCESSOR_PROTECTED_PATHS]),
]);

export const QWORK_MR1552_FAILURE_IDS = Object.freeze([
  'execution_runner_clean_exit_terminal_missing',
  'execution_runner_pressure_admission_disconnected',
  'execution_runner_message_isolation_missing',
]);
export const QWORK_RELEASE_BLOCKING_RISK_APPLICABILITY = Object.freeze({
  VERIFIED_APPLICABLE: 'VERIFIED_APPLICABLE',
  VERIFIED_NOT_APPLICABLE: 'VERIFIED_NOT_APPLICABLE',
  UNKNOWN: 'UNKNOWN',
});

const RELEASE_ANCESTRY_UNKNOWN = 'release_ancestry_unknown';
const SUCCESSOR_ANCESTRY_UNKNOWN = 'successor_ancestry_unknown';

const HEX40 = /^[a-f0-9]{40}$/iu;
const HEX64 = /^[a-f0-9]{64}$/iu;

function text(value) {
  return String(value ?? '').trim();
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stableValue(value[key])]));
  }
  return value;
}

function stableJson(value) {
  return JSON.stringify(stableValue(value));
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function gitBlobSha1(bytes) {
  return createHash('sha1')
    .update(`blob ${bytes.length}\0`, 'utf8')
    .update(bytes)
    .digest('hex');
}

function strictBase64Decode(value) {
  const normalized = String(value || '').replace(/\s+/gu, '');
  if (!normalized || !/^[A-Za-z0-9+/]*={0,2}$/u.test(normalized) || normalized.length % 4 !== 0) {
    throw new Error('file_content_base64_invalid');
  }
  const bytes = Buffer.from(normalized, 'base64');
  if (bytes.toString('base64') !== normalized) throw new Error('file_content_base64_noncanonical');
  return bytes;
}

function observeFile(file, expectedPath, releaseHead, failures) {
  const payload = file?.payload && typeof file.payload === 'object' ? file.payload : file;
  const prefix = `release_file:${expectedPath}`;
  const directSource = typeof file?.source === 'string' ? file.source : null;
  const error = text(file?.error);
  let bytes = Buffer.alloc(0);
  if (error) failures.push(`${prefix}:read_failed`);
  if (directSource !== null) {
    bytes = Buffer.from(directSource, 'utf8');
  } else if (!error) {
    if (text(payload?.file_path) !== expectedPath) failures.push(`${prefix}:path_mismatch`);
    if (text(file?.requested_ref) !== releaseHead) failures.push(`${prefix}:requested_ref_mismatch`);
    if (text(payload?.ref) !== releaseHead) failures.push(`${prefix}:ref_mismatch`);
    if (text(payload?.commit_id) !== releaseHead) failures.push(`${prefix}:commit_id_mismatch`);
    if (!HEX40.test(text(payload?.blob_id))) failures.push(`${prefix}:blob_id_invalid`);
    if (!HEX40.test(text(payload?.last_commit_id))) failures.push(`${prefix}:last_commit_id_invalid`);
    if (text(payload?.encoding).toLowerCase() !== 'base64') failures.push(`${prefix}:encoding_mismatch`);
    try {
      bytes = strictBase64Decode(payload?.content);
    } catch (decodeError) {
      failures.push(`${prefix}:${text(decodeError?.message) || 'decode_failed'}`);
    }
    if (!Number.isSafeInteger(Number(payload?.size)) || Number(payload?.size) !== bytes.length) {
      failures.push(`${prefix}:size_mismatch`);
    }
    if (bytes.length && HEX40.test(text(payload?.blob_id)) && text(payload.blob_id).toLowerCase() !== gitBlobSha1(bytes)) {
      failures.push(`${prefix}:blob_id_content_mismatch`);
    }
  }
  if (!bytes.length) failures.push(`${prefix}:content_empty`);
  return {
    source: bytes.toString('utf8'),
    observation: {
      path: expectedPath,
      requested_ref: directSource !== null ? releaseHead : text(file?.requested_ref),
      ref: directSource !== null ? releaseHead : text(payload?.ref),
      commit_id: directSource !== null ? releaseHead : text(payload?.commit_id),
      blob_id: directSource !== null ? gitBlobSha1(bytes) : text(payload?.blob_id),
      last_commit_id: directSource !== null ? releaseHead : text(payload?.last_commit_id),
      encoding: bytes.length ? 'base64' : text(payload?.encoding).toLowerCase(),
      bytes: bytes.length,
      sha256: bytes.length ? sha256(bytes) : '',
      content_base64: bytes.length ? bytes.toString('base64') : '',
      error,
    },
  };
}

function extractBalancedCall(source, marker) {
  const start = source.indexOf(marker);
  if (start < 0) return '';
  const brace = source.indexOf('{', start);
  if (brace < 0) return '';
  let depth = 0;
  let quote = '';
  let escaped = false;
  for (let index = brace; index < source.length; index += 1) {
    const char = source[index];
    if (quote) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === quote) quote = '';
      continue;
    }
    if (char === '"' || char === "'" || char === '`') {
      quote = char;
      continue;
    }
    if (char === '{') depth += 1;
    else if (char === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(brace + 1, index);
    }
  }
  return '';
}

function verifiedFirstParentCompare(ancestry, compareFrom, compareTo) {
  return text(ancestry?.source) === 'gitlab-api-compare-first-parent'
    && ancestry?.verified === true
    && ancestry?.first_parent_complete === true
    && text(ancestry?.compare_from) === compareFrom
    && text(ancestry?.compare_to) === compareTo
    && Number.isSafeInteger(Number(ancestry?.compare_commit_count))
    && Number(ancestry.compare_commit_count) > 0
    && !text(ancestry?.reason);
}

function mergeRelationship({ releaseHead, mergeCommitSha, descendantAncestry, predecessorAncestry }) {
  if (!HEX40.test(releaseHead)) {
    return { state: QWORK_RELEASE_BLOCKING_RISK_APPLICABILITY.UNKNOWN, source: 'release-head-invalid' };
  }
  if (releaseHead === mergeCommitSha) {
    return { state: QWORK_RELEASE_BLOCKING_RISK_APPLICABILITY.VERIFIED_APPLICABLE, source: 'release-head-is-origin-merge' };
  }
  const descendantVerified = verifiedFirstParentCompare(descendantAncestry, mergeCommitSha, releaseHead);
  const predecessorVerified = verifiedFirstParentCompare(predecessorAncestry, releaseHead, mergeCommitSha);
  if (descendantVerified && predecessorVerified) {
    return { state: QWORK_RELEASE_BLOCKING_RISK_APPLICABILITY.UNKNOWN, source: 'conflicting-first-parent-ancestry' };
  }
  if (descendantVerified) {
    return { state: QWORK_RELEASE_BLOCKING_RISK_APPLICABILITY.VERIFIED_APPLICABLE, source: 'gitlab-api-first-parent-ancestry' };
  }
  if (predecessorVerified) {
    return { state: QWORK_RELEASE_BLOCKING_RISK_APPLICABILITY.VERIFIED_NOT_APPLICABLE, source: 'gitlab-api-reverse-first-parent-ancestry' };
  }
  return { state: QWORK_RELEASE_BLOCKING_RISK_APPLICABILITY.UNKNOWN, source: 'first-parent-relationship-not-proven' };
}

function riskApplicability(releaseHead, originAncestry, releaseBeforeOriginAncestry) {
  const relationship = mergeRelationship({
    releaseHead,
    mergeCommitSha: QWORK_MR1552_MERGE_COMMIT_SHA,
    descendantAncestry: originAncestry,
    predecessorAncestry: releaseBeforeOriginAncestry,
  });
  if (releaseHead === QWORK_MR1552_MERGE_COMMIT_SHA
    && relationship.state === QWORK_RELEASE_BLOCKING_RISK_APPLICABILITY.VERIFIED_APPLICABLE) {
    return { ...relationship, source: 'release-head-is-mr-1552-merge' };
  }
  return relationship;
}

function successorArchitecture(releaseHead, successorAncestry, releaseBeforeSuccessorAncestry) {
  const relationship = mergeRelationship({
    releaseHead,
    mergeCommitSha: QWORK_MR1559_MERGE_COMMIT_SHA,
    descendantAncestry: successorAncestry,
    predecessorAncestry: releaseBeforeSuccessorAncestry,
  });
  if (relationship.state === QWORK_RELEASE_BLOCKING_RISK_APPLICABILITY.VERIFIED_APPLICABLE) {
    return {
      relationship,
      architecture: 'per-turn-utility-process/v1',
      activation_source: releaseHead === QWORK_MR1559_MERGE_COMMIT_SHA
        ? 'release-head-is-mr-1559-merge'
        : 'gitlab-api-first-parent-successor-ancestry',
      assertion_owner: {
        contract_id: QWORK_MR1559_EXECUTION_RUNNER_SUCCESSOR_ID,
        mr_iid: '1559',
        merge_commit_sha: QWORK_MR1559_MERGE_COMMIT_SHA,
      },
      protected_paths: QWORK_MR1559_SUCCESSOR_PROTECTED_PATHS,
    };
  }
  if (relationship.state === QWORK_RELEASE_BLOCKING_RISK_APPLICABILITY.VERIFIED_NOT_APPLICABLE) {
    return {
      relationship,
      architecture: 'shared-worker-registry/v1',
      activation_source: 'verified-release-precedes-mr-1559-use-mr-1552-assertions',
      assertion_owner: {
        contract_id: QWORK_MR1552_EXECUTION_RUNNER_RISK_ID,
        mr_iid: '1552',
        merge_commit_sha: QWORK_MR1552_MERGE_COMMIT_SHA,
      },
      protected_paths: QWORK_MR1552_LEGACY_PROTECTED_PATHS,
    };
  }
  return {
    relationship,
    architecture: 'unknown',
    activation_source: 'mr-1559-first-parent-relationship-not-proven',
    assertion_owner: null,
    protected_paths: QWORK_RELEASE_BLOCKING_RISK_PROTECTED_PATHS,
  };
}

function ancestryProjection(ancestry = {}) {
  return {
    source: text(ancestry.source),
    compare_from: text(ancestry.compare_from),
    compare_to: text(ancestry.compare_to),
    compare_commit_count: Number.isSafeInteger(Number(ancestry.compare_commit_count))
      ? Number(ancestry.compare_commit_count) : 0,
    first_parent_complete: ancestry.first_parent_complete === true,
    verified: ancestry.verified === true,
    reason: text(ancestry.reason),
  };
}

function originAncestryProjection(ancestry, mergeCommitSha, releaseHead) {
  if (releaseHead !== mergeCommitSha) return ancestryProjection(ancestry);
  return {
    source: 'release-head-is-origin-merge',
    compare_from: mergeCommitSha,
    compare_to: releaseHead,
    compare_commit_count: 0,
    first_parent_complete: true,
    verified: true,
    reason: '',
  };
}

export function qworkReleaseBlockingRiskProtectedPaths({
  releaseHead,
  successorAncestry = {},
  releaseBeforeSuccessorAncestry = {},
} = {}) {
  return [...successorArchitecture(
    text(releaseHead),
    successorAncestry,
    releaseBeforeSuccessorAncestry,
  ).protected_paths];
}

function auditLegacySharedWorkerChecks(sourceByPath) {
  const controller = sourceByPath.get('electron/execution-worker.cjs') || '';
  const supervisor = sourceByPath.get('electron/host-core/agent/execution-worker-supervisor.cjs') || '';
  const terminalHelper = extractBalancedCall(controller, 'function terminalFor(');
  const exitHandler = extractBalancedCall(controller, "runner.on('exit'");
  const messageHandler = extractBalancedCall(controller, "runner.on('message'");
  const pressureBranch = extractBalancedCall(messageHandler, "operation === 'worker.pressure'");
  const supervisorMessageHandler = extractBalancedCall(supervisor, 'const onMessage = (raw) =>');
  const supervisorReject = extractBalancedCall(supervisorMessageHandler, 'catch (error)');

  const boundedTypedTerminal = /operation\s*:\s*['"]execution\.terminal['"]/u.test(terminalHelper)
    && /deadlineAt\s*:\s*Date\.now\(\)\s*\+/u.test(terminalHelper);
  const conditionalExitTerminal = /if\s*\(\s*exitCode[^)]*\)\s*process\.parentPort\.postMessage\s*\(\s*terminalFor\s*\(\s*startMessage/u.test(exitHandler);
  const exitTerminal = /postMessage\s*\(\s*terminalFor\s*\(\s*startMessage/u.test(exitHandler)
    && !conditionalExitTerminal;
  const cleanExitPassed = Boolean(boundedTypedTerminal && exitTerminal);

  const pressureForwarded = /postMessage\s*\(/u.test(pressureBranch)
    && /operation\s*:\s*['"]worker\.pressure['"]/u.test(pressureBranch);
  const supervisorConsumesPressure = /executionWorkerPressureFromMessage\s*\(\s*message/u.test(supervisorMessageHandler)
    && /message\.operation\s*!==\s*['"]worker\.pressure['"]/u.test(supervisor);
  const pressurePassed = Boolean(pressureForwarded && supervisorConsumesPressure);

  const validatesRunnerEnvelope = /validateEnvelope\s*\(\s*runnerMessage\s*,\s*\{\s*direction\s*:\s*['"]worker-to-host['"]/u.test(messageHandler);
  const targetedTermination = /runner\.terminate\s*\(/u.test(messageHandler)
    && /terminalFor\s*\(\s*startMessage/u.test(messageHandler);
  const sharedKillOnProtocolReject = /(?:child\?*\.kill|terminateChild)\s*\(/u.test(supervisorReject);
  const isolationPassed = Boolean(validatesRunnerEnvelope && targetedTermination && !sharedKillOnProtocolReject);

  return [
    {
      id: QWORK_MR1552_FAILURE_IDS[0],
      passed: cleanExitPassed,
      observations: { bounded_typed_terminal: boundedTypedTerminal, unsettled_exit_always_emits_terminal: exitTerminal },
    },
    {
      id: QWORK_MR1552_FAILURE_IDS[1],
      passed: pressurePassed,
      observations: { controller_forwards_top_level_pressure: pressureForwarded, supervisor_consumes_top_level_pressure: supervisorConsumesPressure },
    },
    {
      id: QWORK_MR1552_FAILURE_IDS[2],
      passed: isolationPassed,
      observations: { controller_validates_runner_envelope: validatesRunnerEnvelope, invalid_runner_is_terminated_with_terminal: targetedTermination, supervisor_protocol_reject_kills_shared_process: sharedKillOnProtocolReject },
    },
  ];
}

function auditPerTurnUtilityProcessChecks(sourceByPath) {
  const entry = sourceByPath.get('electron/execution-worker.cjs') || '';
  const manager = sourceByPath.get('electron/host-core/agent/execution-worker-manager.cjs') || '';
  const supervisor = sourceByPath.get('electron/host-core/agent/execution-worker-supervisor.cjs') || '';
  const desktopHost = sourceByPath.get('electron/host-core/agent/desktop-host-context.cjs') || '';

  const unsettledExitUsesTypedFailure = /executionWorkerExitFailure\s*\(/u.test(supervisor)
    && /rejectPending\s*\(/u.test(supervisor);
  const pressureAdmissionClosed = /execution_worker_pressure_admission_closed/u.test(manager);
  const onePendingPerTurn = /maxPendingRequests\s*:\s*1/u.test(manager);
  const restartDisabled = /maxRestarts\s*:\s*0/u.test(manager);
  const pressurePassed = pressureAdmissionClosed && onePendingPerTurn && restartDisabled;

  const supervisorCreatedPerAcquire = /supervisorFactory\s*\(/u.test(manager);
  const requestIndexed = /executions\.set\s*\(\s*requestId\s*,\s*record\s*\)/u.test(manager);
  const requestReleased = /executions\.delete\s*\(\s*requestId\s*\)/u.test(manager)
    && /await\s+supervisor\.stop\s*\(\s*\)/u.test(manager);
  const leaseAcquired = /executionWorkerLease\s*=\s*await\s+[^;\n]*\.acquire\s*\(/u.test(desktopHost)
    || /executionWorkerLease\s*=\s*await\s+executionWorkerManager\.acquire\s*\(/u.test(desktopHost);
  const leaseReleased = /await\s+executionWorkerLease\?\.release\?\.\s*\(\s*\)/u.test(desktopHost)
    || /await\s+executionWorkerLease\?\.release\?\s*\(\s*\)/u.test(desktopHost);
  const stableSingleTurnEntry = /require\s*\(\s*['"]\.\/host-core\/agent\/execution-worker-entry\.cjs['"]\s*\)/u.test(entry);
  const sharedWorkerRegistryAbsent = !/\bnew\s+Worker\s*\(/u.test(entry)
    && !/\brunners\s*=\s*new\s+Map\s*\(/u.test(entry);
  const isolationPassed = supervisorCreatedPerAcquire
    && requestIndexed
    && requestReleased
    && leaseAcquired
    && leaseReleased
    && stableSingleTurnEntry
    && sharedWorkerRegistryAbsent;

  return [
    {
      id: QWORK_MR1552_FAILURE_IDS[0],
      passed: unsettledExitUsesTypedFailure,
      observations: {
        supervisor_unsettled_exit_uses_typed_failure: unsettledExitUsesTypedFailure,
        supervisor_rejects_pending_on_exit: /rejectPending\s*\(/u.test(supervisor),
      },
    },
    {
      id: QWORK_MR1552_FAILURE_IDS[1],
      passed: pressurePassed,
      observations: {
        manager_pressure_admission_closed: pressureAdmissionClosed,
        per_turn_max_pending_requests_one: onePendingPerTurn,
        per_turn_restarts_disabled: restartDisabled,
      },
    },
    {
      id: QWORK_MR1552_FAILURE_IDS[2],
      passed: isolationPassed,
      observations: {
        manager_creates_supervisor_per_acquire: supervisorCreatedPerAcquire,
        manager_indexes_execution_by_request_id: requestIndexed,
        release_deletes_request_and_stops_supervisor: requestReleased,
        desktop_host_acquires_execution_lease: leaseAcquired,
        desktop_host_releases_execution_lease: leaseReleased,
        stable_single_turn_entry: stableSingleTurnEntry,
        shared_worker_registry_absent: sharedWorkerRegistryAbsent,
      },
    },
  ];
}

export function auditQworkReleaseBlockingRisk({
  releaseHead,
  originAncestry = {},
  releaseBeforeOriginAncestry = {},
  successorAncestry = {},
  releaseBeforeSuccessorAncestry = {},
  files = [],
} = {}) {
  const normalizedHead = text(releaseHead);
  const activation = riskApplicability(normalizedHead, originAncestry, releaseBeforeOriginAncestry);
  const architecture = successorArchitecture(
    normalizedHead,
    successorAncestry,
    releaseBeforeSuccessorAncestry,
  );
  const applicable = activation.state === QWORK_RELEASE_BLOCKING_RISK_APPLICABILITY.VERIFIED_APPLICABLE
    ? true
    : activation.state === QWORK_RELEASE_BLOCKING_RISK_APPLICABILITY.VERIFIED_NOT_APPLICABLE
      ? false
      : null;
  const fileFailures = [];
  const sourceFiles = [];
  const sourceByPath = new Map();
  if (applicable === true) {
    for (const protectedPath of architecture.protected_paths) {
      const matches = files.filter((file) => text(file?.path || file?.payload?.file_path) === protectedPath);
      if (matches.length !== 1) fileFailures.push(`release_file:${protectedPath}:count:${matches.length}`);
      const observed = observeFile(matches[0] || { path: protectedPath, error: 'missing' }, protectedPath, normalizedHead, fileFailures);
      sourceFiles.push(observed.observation);
      sourceByPath.set(protectedPath, observed.source);
    }
  }
  const architectureKnown = architecture.relationship.state !== QWORK_RELEASE_BLOCKING_RISK_APPLICABILITY.UNKNOWN;
  const checks = applicable === true && architectureKnown
    ? architecture.architecture === 'per-turn-utility-process/v1'
      ? auditPerTurnUtilityProcessChecks(sourceByPath)
      : auditLegacySharedWorkerChecks(sourceByPath)
    : QWORK_MR1552_FAILURE_IDS.map((id) => ({ id, passed: null, observations: {} }));
  const failureIds = applicable === true && architectureKnown
    ? checks.filter((check) => check.passed !== true).map((check) => check.id)
    : [];
  const evidenceFailures = [
    ...(activation.state === QWORK_RELEASE_BLOCKING_RISK_APPLICABILITY.UNKNOWN
      ? [RELEASE_ANCESTRY_UNKNOWN] : []),
    ...(applicable === true && !architectureKnown ? [SUCCESSOR_ANCESTRY_UNKNOWN] : []),
    ...(applicable === true ? fileFailures : []),
  ];
  const uniqueEvidenceFailures = [...new Set(evidenceFailures)];
  const verified = applicable === true
    && architectureKnown
    && failureIds.length === 0
    && uniqueEvidenceFailures.length === 0;
  const status = activation.state === QWORK_RELEASE_BLOCKING_RISK_APPLICABILITY.VERIFIED_NOT_APPLICABLE
    ? 'NOT_APPLICABLE'
    : verified
      ? 'VERIFIED'
      : 'BLOCKED';
  const value = {
    schema_version: QWORK_RELEASE_BLOCKING_RISK_SCHEMA,
    risk_id: QWORK_MR1552_EXECUTION_RUNNER_RISK_ID,
    mr_iid: '1552',
    merge_commit_sha: QWORK_MR1552_MERGE_COMMIT_SHA,
    release_head: normalizedHead,
    applicability: activation.state,
    applicable,
    activation_source: activation.source,
    architecture: architecture.architecture,
    successor_applicability: architecture.relationship.state,
    architecture_activation_source: architecture.activation_source,
    assertion_owner: architecture.assertion_owner,
    origin_ancestry: originAncestryProjection(
      originAncestry,
      QWORK_MR1552_MERGE_COMMIT_SHA,
      normalizedHead,
    ),
    release_before_origin_ancestry: ancestryProjection(releaseBeforeOriginAncestry),
    successor_ancestry: originAncestryProjection(
      successorAncestry,
      QWORK_MR1559_MERGE_COMMIT_SHA,
      normalizedHead,
    ),
    release_before_successor_ancestry: ancestryProjection(releaseBeforeSuccessorAncestry),
    successor: {
      contract_id: QWORK_MR1559_EXECUTION_RUNNER_SUCCESSOR_ID,
      mr_iid: '1559',
      merge_commit_sha: QWORK_MR1559_MERGE_COMMIT_SHA,
    },
    test_execution_attested: false,
    status,
    verified,
    protected_paths: [...architecture.protected_paths],
    source_files: sourceFiles,
    checks,
    failure_ids: failureIds,
    evidence_failures: uniqueEvidenceFailures,
  };
  return { ...value, attestation_sha256: sha256(stableJson(value)) };
}

function expectedUnresolved(risks) {
  return risks.flatMap((risk) => [
    ...(Array.isArray(risk?.failure_ids) ? risk.failure_ids : [])
      .map((failureId) => `${risk.risk_id}:${failureId}`),
    ...(Array.isArray(risk?.evidence_failures) ? risk.evidence_failures : [])
      .map((failure) => `${risk.risk_id}:${failure}`),
  ]);
}

const SOURCE_FILE_FIELDS = Object.freeze([
  'blob_id',
  'bytes',
  'commit_id',
  'content_base64',
  'encoding',
  'error',
  'last_commit_id',
  'path',
  'ref',
  'requested_ref',
  'sha256',
]);

function blockingRiskAuditFilesFromEvidence(sourceFiles) {
  return (Array.isArray(sourceFiles) ? sourceFiles : []).map((file) => {
    if (text(file?.error)) {
      return {
        path: text(file?.path),
        requested_ref: text(file?.requested_ref),
        error: text(file?.error),
      };
    }
    return {
      path: text(file?.path),
      requested_ref: text(file?.requested_ref),
      payload: {
        file_path: text(file?.path),
        ref: text(file?.ref),
        commit_id: text(file?.commit_id),
        blob_id: text(file?.blob_id),
        last_commit_id: text(file?.last_commit_id),
        encoding: text(file?.encoding),
        size: file?.bytes,
        content: typeof file?.content_base64 === 'string' ? file.content_base64 : '',
      },
    };
  });
}

function validateSourceFileEvidence(sourceFiles, expectedPaths, releaseHead) {
  const failures = [];
  if (!Array.isArray(sourceFiles)) return ['blocking_risk_source_files_missing'];
  if (sourceFiles.length !== expectedPaths.length) {
    failures.push(`blocking_risk_source_file_count:${sourceFiles.length}`);
  }
  for (const [index, file] of sourceFiles.entries()) {
    const label = text(file?.path) || `index-${index}`;
    if (!file || typeof file !== 'object' || Array.isArray(file)) {
      failures.push(`blocking_risk_source_file_invalid:${label}`);
      continue;
    }
    if (stableJson(Object.keys(file).sort()) !== stableJson([...SOURCE_FILE_FIELDS].sort())) {
      failures.push(`blocking_risk_source_file_fields_mismatch:${label}`);
    }
    if (text(file.path) !== expectedPaths[index]) failures.push(`blocking_risk_source_file_path_mismatch:${label}`);
    if (text(file.requested_ref) !== releaseHead) failures.push(`blocking_risk_source_file_requested_ref_mismatch:${label}`);
    const error = text(file.error);
    if (error) {
      if (text(file.ref) || text(file.commit_id) || text(file.blob_id) || text(file.last_commit_id)
        || text(file.encoding) || Number(file.bytes) !== 0 || text(file.sha256) || text(file.content_base64)) {
        failures.push(`blocking_risk_source_file_error_projection_mismatch:${label}`);
      }
      continue;
    }
    if (text(file.ref) !== releaseHead) failures.push(`blocking_risk_source_file_ref_mismatch:${label}`);
    if (text(file.commit_id) !== releaseHead) failures.push(`blocking_risk_source_file_commit_id_mismatch:${label}`);
    if (!HEX40.test(text(file.blob_id))) failures.push(`blocking_risk_source_file_blob_id_invalid:${label}`);
    if (!HEX40.test(text(file.last_commit_id))) failures.push(`blocking_risk_source_file_last_commit_id_invalid:${label}`);
    if (text(file.encoding).toLowerCase() !== 'base64') failures.push(`blocking_risk_source_file_encoding_mismatch:${label}`);
    let bytes = Buffer.alloc(0);
    try {
      bytes = strictBase64Decode(file.content_base64);
    } catch (error_) {
      failures.push(`blocking_risk_source_file_${text(error_?.message) || 'decode_failed'}:${label}`);
    }
    if (bytes.length && HEX40.test(text(file.blob_id))
      && text(file.blob_id).toLowerCase() !== gitBlobSha1(bytes)) {
      failures.push(`blocking_risk_source_file_blob_id_content_mismatch:${label}`);
    }
    if (!Number.isSafeInteger(Number(file.bytes)) || Number(file.bytes) <= 0 || Number(file.bytes) !== bytes.length) {
      failures.push(`blocking_risk_source_file_bytes_mismatch:${label}`);
    }
    if (!HEX64.test(text(file.sha256)) || text(file.sha256) !== sha256(bytes)) {
      failures.push(`blocking_risk_source_file_sha256_mismatch:${label}`);
    }
  }
  return failures;
}

export function validateQworkReleaseBlockingRisksForReport(report) {
  const failures = [];
  const risks = Array.isArray(report?.blocking_risks) ? report.blocking_risks : [];
  if (!Array.isArray(report?.blocking_risks)) failures.push('blocking_risks_missing');
  if (risks.length !== 1) failures.push(`blocking_risk_count:${risks.length}`);
  const risk = risks.find((item) => item?.risk_id === QWORK_MR1552_EXECUTION_RUNNER_RISK_ID);
  let replayedRisk = null;
  if (!risk) failures.push('blocking_risk_mr1552_missing');
  if (risk) {
    if (risk.schema_version !== QWORK_RELEASE_BLOCKING_RISK_SCHEMA) failures.push('blocking_risk_schema_mismatch');
    if (risk.merge_commit_sha !== QWORK_MR1552_MERGE_COMMIT_SHA) failures.push('blocking_risk_merge_sha_mismatch');
    if (risk.release_head !== report?.release?.head) failures.push('blocking_risk_release_head_mismatch');
    if (risk.test_execution_attested !== false) failures.push('blocking_risk_test_execution_attestation_mismatch');
    if (risk?.successor?.contract_id !== QWORK_MR1559_EXECUTION_RUNNER_SUCCESSOR_ID
      || text(risk?.successor?.mr_iid) !== '1559'
      || risk?.successor?.merge_commit_sha !== QWORK_MR1559_MERGE_COMMIT_SHA) {
      failures.push('blocking_risk_successor_identity_mismatch');
    }
    const expectedActivation = riskApplicability(
      text(report?.release?.head),
      risk.origin_ancestry,
      risk.release_before_origin_ancestry,
    );
    const expectedApplicable = expectedActivation.state === QWORK_RELEASE_BLOCKING_RISK_APPLICABILITY.VERIFIED_APPLICABLE
      ? true
      : expectedActivation.state === QWORK_RELEASE_BLOCKING_RISK_APPLICABILITY.VERIFIED_NOT_APPLICABLE
        ? false
        : null;
    if (risk.applicability !== expectedActivation.state) failures.push('blocking_risk_applicability_mismatch');
    if (risk.applicable !== expectedApplicable) failures.push('blocking_risk_applicable_mismatch');
    if (risk.activation_source !== expectedActivation.source) failures.push('blocking_risk_activation_source_mismatch');
    const expectedArchitecture = successorArchitecture(
      text(report?.release?.head),
      risk.successor_ancestry,
      risk.release_before_successor_ancestry,
    );
    if (risk.architecture !== expectedArchitecture.architecture) failures.push('blocking_risk_architecture_mismatch');
    if (risk.successor_applicability !== expectedArchitecture.relationship.state) {
      failures.push('blocking_risk_successor_applicability_mismatch');
    }
    if (risk.architecture_activation_source !== expectedArchitecture.activation_source) {
      failures.push('blocking_risk_architecture_activation_source_mismatch');
    }
    if (stableJson(risk.assertion_owner) !== stableJson(expectedArchitecture.assertion_owner)) {
      failures.push('blocking_risk_assertion_owner_mismatch');
    }
    if (stableJson(risk.protected_paths) !== stableJson([...expectedArchitecture.protected_paths])) {
      failures.push('blocking_risk_protected_paths_mismatch');
    }
    const sourceFilePaths = Array.isArray(risk.source_files)
      ? risk.source_files.map((file) => text(file?.path)) : [];
    const expectedSourceFilePaths = expectedApplicable === true ? [...expectedArchitecture.protected_paths] : [];
    if (stableJson(sourceFilePaths) !== stableJson(expectedSourceFilePaths)) {
      failures.push('blocking_risk_source_file_paths_mismatch');
    }
    failures.push(...validateSourceFileEvidence(
      risk.source_files,
      expectedSourceFilePaths,
      text(report?.release?.head),
    ));
    replayedRisk = auditQworkReleaseBlockingRisk({
      releaseHead: text(report?.release?.head),
      originAncestry: risk.origin_ancestry,
      releaseBeforeOriginAncestry: risk.release_before_origin_ancestry,
      successorAncestry: risk.successor_ancestry,
      releaseBeforeSuccessorAncestry: risk.release_before_successor_ancestry,
      files: blockingRiskAuditFilesFromEvidence(risk.source_files),
    });
    if (stableJson(risk) !== stableJson(replayedRisk)) failures.push('blocking_risk_replay_mismatch');
    const copy = structuredClone(risk);
    delete copy.attestation_sha256;
    if (!HEX64.test(text(risk.attestation_sha256)) || sha256(stableJson(copy)) !== risk.attestation_sha256) {
      failures.push('blocking_risk_attestation_sha256_mismatch');
    }
    const checks = Array.isArray(risk.checks) ? risk.checks : [];
    const ids = checks.map((check) => check?.id);
    if (stableJson(ids) !== stableJson(QWORK_MR1552_FAILURE_IDS)) failures.push('blocking_risk_check_ids_mismatch');
    const architectureKnown = expectedArchitecture.relationship.state
      !== QWORK_RELEASE_BLOCKING_RISK_APPLICABILITY.UNKNOWN;
    const derivedFailureIds = expectedApplicable === true && architectureKnown
      ? checks.filter((check) => check?.passed !== true).map((check) => check.id)
      : [];
    if (!Array.isArray(risk.failure_ids)
      || stableJson(risk.failure_ids) !== stableJson(derivedFailureIds)) failures.push('blocking_risk_failure_ids_mismatch');
    const evidenceFailures = Array.isArray(risk.evidence_failures) ? risk.evidence_failures : [];
    const derivedVerified = expectedApplicable === true
      && architectureKnown
      && derivedFailureIds.length === 0
      && evidenceFailures.length === 0;
    const expectedStatus = expectedActivation.state === QWORK_RELEASE_BLOCKING_RISK_APPLICABILITY.VERIFIED_NOT_APPLICABLE
      ? 'NOT_APPLICABLE'
      : derivedVerified
        ? 'VERIFIED'
        : 'BLOCKED';
    if (risk.verified !== derivedVerified) failures.push('blocking_risk_verified_mismatch');
    if (risk.status !== expectedStatus) failures.push('blocking_risk_status_mismatch');
  }
  const canonicalRisks = replayedRisk ? [replayedRisk] : risks;
  const unresolved = expectedUnresolved(canonicalRisks);
  const actualUnresolved = report?.unresolved?.blocking_risk_failures;
  if (!Array.isArray(actualUnresolved)) failures.push('blocking_risk_unresolved_missing');
  else if (stableJson(actualUnresolved) !== stableJson(unresolved)) failures.push('blocking_risk_unresolved_mismatch');
  const applicableCount = canonicalRisks.filter((item) => item?.applicable === true).length;
  const verifiedCount = canonicalRisks.filter((item) => item?.verified === true && item?.status === 'VERIFIED').length;
  if (Number(report?.summary?.blocking_risk_count) !== risks.length) failures.push('blocking_risk_summary_count_mismatch');
  if (Number(report?.summary?.blocking_risk_applicable_count) !== applicableCount) failures.push('blocking_risk_summary_applicable_count_mismatch');
  if (Number(report?.summary?.blocking_risk_verified_count) !== verifiedCount) failures.push('blocking_risk_summary_verified_count_mismatch');
  if (Number(report?.summary?.blocking_risk_failure_count) !== unresolved.length) failures.push('blocking_risk_summary_failure_count_mismatch');
  if (report?.policy?.api_freshness && report.policy.api_freshness.blocking_risks_verified !== (unresolved.length === 0)) {
    failures.push('blocking_risk_freshness_verified_mismatch');
  }
  if (unresolved.length && report?.decision !== 'BLOCKED') failures.push('blocking_risk_failure_without_blocked_decision');
  return { ok: failures.length === 0, failures, unresolved_failures: unresolved };
}
