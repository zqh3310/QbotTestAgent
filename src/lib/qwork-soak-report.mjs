import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export const QWORK_SOAK_REPORT_SCHEMA = 'qbot-qwork-soak-report/v1';
export const QWORK_SOAK_REPORT_AUDIT_SCHEMA = 'qbot-qwork-soak-report-audit/v1';
export const QWORK_SOAK_TASK_SCHEMA = 'qbot-qwork-soak-task/v1';
export const QWORK_SOAK_RESTART_SCHEMA = 'qbot-qwork-soak-restart/v1';
export const QWORK_SOAK_IDENTITY_OBSERVATION_SCHEMA = 'qbot-qwork-soak-identity-observation/v1';
export const QWORK_SOAK_CRASH_LEDGER_SCHEMA = 'qbot-qwork-soak-crash-ledger/v1';
export const QWORK_SOAK_RESOURCE_USAGE_SCHEMA = 'qbot-qwork-soak-resource-usage/v1';

export const QWORK_SOAK_DEFAULT_POLICY = Object.freeze({
  minimum_tasks: 100,
  minimum_restarts: 3,
  maximum_rss_peak_bytes: 2 * 1024 * 1024 * 1024,
  maximum_rss_growth_bytes: 100 * 1024 * 1024,
  maximum_rss_slope_bytes_per_minute: 128 * 1024 * 1024,
  maximum_resource_sample_gap_ms: 60_000,
  minimum_samples_per_process: 2,
});

const RELEASE_IDENTITY_FIELDS = Object.freeze([
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

const TASK_ARTIFACT_ROLES = Object.freeze([
  'dispatch_receipt',
  'send_receipt',
  'terminal_receipt',
]);

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

function text(value) {
  return String(value ?? '').trim();
}

function sha256Bytes(value) {
  return createHash('sha256').update(value).digest('hex');
}

function sha256File(file) {
  return sha256Bytes(fs.readFileSync(file));
}

function sha256Text(value) {
  return sha256Bytes(Buffer.from(String(value), 'utf8'));
}

function isSha256(value) {
  return /^[a-f0-9]{64}$/.test(text(value));
}

function isCommit(value) {
  return /^[a-f0-9]{40}$/.test(text(value));
}

function isPositiveInteger(value) {
  return Number.isSafeInteger(value) && value > 0;
}

function isNonNegativeInteger(value) {
  return Number.isSafeInteger(value) && value >= 0;
}

function isoTime(value) {
  const raw = text(value);
  const timestamp = Date.parse(raw);
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString() === raw ? timestamp : Number.NaN;
}

function capabilitiesAttemptsValid(value) {
  if (!Array.isArray(value) || value.length < 1 || value.length > 3) return false;
  return value.every((attempt, index) => {
    const startedAt = isoTime(attempt?.started_at);
    const endedAt = isoTime(attempt?.ended_at);
    const succeeded = attempt?.ok === true;
    return attempt?.attempt === index + 1
      && attempt?.timeout_ms === 2_000
      && Number.isFinite(startedAt)
      && Number.isFinite(endedAt)
      && endedAt >= startedAt
      && isNonNegativeInteger(attempt?.duration_ms)
      && typeof attempt?.error === 'string'
      && (succeeded
        ? attempt?.value_type === 'object' && attempt.error === '' && index === value.length - 1
        : attempt?.value_type === '' && Boolean(text(attempt.error)) && index < value.length - 1);
  });
}

function pathInside(candidate, root) {
  const relative = path.relative(root, candidate);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function canonicalDarwinSystemAlias(file) {
  const resolved = path.resolve(file);
  if (process.platform !== 'darwin') return resolved;
  if (resolved === '/tmp' || resolved.startsWith('/tmp/')) return `/private${resolved}`;
  if (resolved === '/var' || resolved.startsWith('/var/')) return `/private${resolved}`;
  return resolved;
}

function strictDirectory(directory) {
  const resolved = path.resolve(directory);
  const stat = fs.lstatSync(resolved);
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error('directory_type');
  const real = fs.realpathSync(resolved);
  if (canonicalDarwinSystemAlias(resolved) !== real) throw new Error('directory_symlink_ancestor');
  return real;
}

function strictFileWithin(file, root) {
  if (!path.isAbsolute(text(file))) throw new Error('path_not_absolute');
  const realRoot = strictDirectory(root);
  const resolved = path.resolve(file);
  if (!pathInside(canonicalDarwinSystemAlias(resolved), realRoot)) throw new Error('path_boundary');
  const stat = fs.lstatSync(resolved);
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('file_type');
  const real = fs.realpathSync(resolved);
  if (canonicalDarwinSystemAlias(resolved) !== real || !pathInside(real, realRoot)) {
    throw new Error('file_symlink_or_escape');
  }
  return { path: resolved, realpath: real, stat };
}

function validCdpEndpoint(value) {
  try {
    const parsed = new URL(text(value));
    return parsed.protocol === 'http:'
      && ['127.0.0.1', 'localhost', '[::1]', '::1'].includes(parsed.hostname)
      && isPositiveInteger(Number(parsed.port));
  } catch {
    return false;
  }
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

function contextValid(value) {
  const normalized = contextValue(value);
  return isPositiveInteger(normalized.host_pid)
    && Number.isFinite(isoTime(normalized.host_process_started_at))
    && isPositiveInteger(normalized.renderer_pid)
    && Number.isFinite(isoTime(normalized.renderer_process_started_at))
    && Boolean(normalized.session_id)
    && validCdpEndpoint(normalized.cdp_endpoint)
    && Boolean(normalized.webview_target_id);
}

function contextEqual(left, right) {
  return stableJson(contextValue(left)) === stableJson(contextValue(right));
}

function contextActiveAt(value, observedAt) {
  return contextValid(value)
    && Number.isFinite(observedAt)
    && isoTime(value?.host_process_started_at) <= observedAt
    && isoTime(value?.renderer_process_started_at) <= observedAt;
}

function contextKey(value) {
  return stableJson(contextValue(value));
}

export function qworkSoakReleaseIdentityFingerprint(identity = {}) {
  const normalized = Object.fromEntries(RELEASE_IDENTITY_FIELDS.map((field) => [field, text(identity[field])]));
  return sha256Text(stableJson(normalized));
}

function releaseIdentityValid(identity = {}) {
  if (!identity || typeof identity !== 'object' || Array.isArray(identity)) return false;
  if (RELEASE_IDENTITY_FIELDS.some((field) => !text(identity[field]))) return false;
  if (!isSha256(identity.feature_flags_hash) || !isSha256(identity.qwork_release_manifest_sha256)) return false;
  if (!/^[a-f0-9]{7,40}$/.test(text(identity.qwork_ui_git_commit))) return false;
  try {
    return new URL(text(identity.control_plane_origin)).origin.replace(/\/$/, '')
      === text(identity.control_plane_origin).replace(/\/$/, '');
  } catch {
    return false;
  }
}

function normalizePolicy(policy = {}) {
  return {
    minimum_tasks: policy.minimum_tasks,
    minimum_restarts: policy.minimum_restarts,
    maximum_rss_peak_bytes: policy.maximum_rss_peak_bytes,
    maximum_rss_growth_bytes: policy.maximum_rss_growth_bytes,
    maximum_rss_slope_bytes_per_minute: policy.maximum_rss_slope_bytes_per_minute,
    maximum_resource_sample_gap_ms: policy.maximum_resource_sample_gap_ms,
    minimum_samples_per_process: policy.minimum_samples_per_process,
  };
}

function policyValid(policy) {
  return Object.values(policy).every(isPositiveInteger);
}

function intervalWithinMaximum(value, maximum) {
  return isPositiveInteger(value) && value <= maximum;
}

function addFailure(failures, code, owner = '') {
  failures.push(owner ? `${code}:${owner}` : code);
}

function validateReportArtifact({ report, reportPath, reportSha256, failures }) {
  if (!text(reportPath)) {
    addFailure(failures, 'soak_report_path_missing');
    return { root: '', reportFile: null };
  }
  const root = path.dirname(path.resolve(reportPath));
  try {
    const reportFile = strictFileWithin(path.resolve(reportPath), root);
    if (!isSha256(reportSha256) || sha256File(reportFile.path) !== text(reportSha256)) {
      addFailure(failures, 'soak_report_sha256_mismatch');
    }
    const disk = JSON.parse(fs.readFileSync(reportFile.path, 'utf8'));
    if (stableJson(disk) !== stableJson(report)) addFailure(failures, 'soak_report_disk_mismatch');
    return { root: strictDirectory(root), reportFile };
  } catch (error) {
    addFailure(failures, 'soak_report_file_invalid', text(error?.message));
    return { root: '', reportFile: null };
  }
}

function loadArtifacts(report, root, reportFile, failures) {
  const descriptors = Array.isArray(report?.external_artifacts) ? report.external_artifacts : [];
  if (!descriptors.length) addFailure(failures, 'soak_external_artifacts_missing');
  const byId = new Map();
  const realpaths = new Set();
  const inodes = new Set();
  for (const descriptor of descriptors) {
    const id = text(descriptor?.artifact_id);
    const ownerType = text(descriptor?.owner_type);
    const ownerId = text(descriptor?.owner_id);
    const role = text(descriptor?.role);
    if (!id || byId.has(id)) {
      addFailure(failures, 'soak_artifact_id_invalid', id || 'missing');
      continue;
    }
    if (!ownerType || !ownerId || !role || descriptor?.media_type !== 'application/json') {
      addFailure(failures, 'soak_artifact_descriptor_invalid', id);
      continue;
    }
    try {
      const inspected = strictFileWithin(descriptor.path, root);
      const inode = `${inspected.stat.dev}:${inspected.stat.ino}`;
      if (realpaths.has(inspected.realpath) || inodes.has(inode)
        || inspected.realpath === reportFile?.realpath
        || (reportFile && inode === `${reportFile.stat.dev}:${reportFile.stat.ino}`)) {
        addFailure(failures, 'soak_artifact_file_reused', id);
      }
      realpaths.add(inspected.realpath);
      inodes.add(inode);
      if (!isPositiveInteger(descriptor.bytes) || inspected.stat.size !== descriptor.bytes) {
        addFailure(failures, 'soak_artifact_bytes_mismatch', id);
      }
      if (!isSha256(descriptor.sha256) || sha256File(inspected.path) !== descriptor.sha256) {
        addFailure(failures, 'soak_artifact_sha256_mismatch', id);
      }
      const payload = JSON.parse(fs.readFileSync(inspected.path, 'utf8'));
      if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
        addFailure(failures, 'soak_artifact_json_object_required', id);
      }
      byId.set(id, { descriptor, inspected, payload });
    } catch (error) {
      addFailure(failures, 'soak_artifact_file_invalid', `${id}:${text(error?.message)}`);
    }
  }
  return { descriptors, byId };
}

function artifactPayload({ entity, ownerType, ownerId, role, artifacts, referenced, failures }) {
  const artifactId = text(entity?.artifacts?.[role]);
  const item = artifacts.byId.get(artifactId);
  if (!artifactId || !item) {
    addFailure(failures, 'soak_artifact_reference_missing', `${ownerType}:${ownerId}:${role}`);
    return null;
  }
  if (referenced.has(artifactId)) addFailure(failures, 'soak_artifact_reference_reused', artifactId);
  referenced.add(artifactId);
  if (item.descriptor.owner_type !== ownerType
    || item.descriptor.owner_id !== ownerId
    || item.descriptor.role !== role) {
    addFailure(failures, 'soak_artifact_owner_mismatch', artifactId);
  }
  return item.payload;
}

function exactArtifactRoles(entity, expected, failures, owner) {
  const actual = entity?.artifacts && typeof entity.artifacts === 'object' && !Array.isArray(entity.artifacts)
    ? Object.keys(entity.artifacts).sort()
    : [];
  if (stableJson(actual) !== stableJson([...expected].sort())) {
    addFailure(failures, 'soak_artifact_roles_mismatch', owner);
  }
}

function validateIdentityReadback(payload, observation, report, expectedFingerprint, failures) {
  const owner = text(observation?.observation_id) || 'missing';
  const identity = payload?.release_identity;
  const runtime = payload?.runtime;
  const health = payload?.control_plane_health;
  if (payload?.schema_version !== 'qbot-qwork-soak-identity-readback/v1'
    || payload?.evidence_valid !== true
    || text(payload?.observation_id) !== owner
    || text(payload?.phase) !== text(observation?.phase)
    || text(payload?.restart_id) !== text(observation?.restart_id)
    || text(payload?.observed_at) !== text(observation?.observed_at)
    || !contextEqual(payload?.context, observation?.context)
    || !releaseIdentityValid(identity)
    || stableJson(identity) !== stableJson(report.release_identity)
    || text(payload?.release_identity_sha256) !== expectedFingerprint
    || qworkSoakReleaseIdentityFingerprint(identity) !== expectedFingerprint) {
    addFailure(failures, 'soak_identity_readback_binding_invalid', owner);
  }
  if (!capabilitiesAttemptsValid(payload?.capabilities_readback_attempts)
    || stableJson(payload?.capabilities_readback_attempts)
      !== stableJson(observation?.capabilities_readback_attempts)) {
    addFailure(failures, 'soak_identity_capabilities_attempts_invalid', owner);
  }
  if (runtime?.top_level_version !== identity?.qwork_version
    || runtime?.loaded_version !== identity?.qwork_version
    || runtime?.compatibility_version !== identity?.qwork_version
    || runtime?.loaded_verified !== true
    || runtime?.update_phase !== 'idle'
    || runtime?.prepared_release !== null
    || runtime?.capabilities_readable !== true
    || runtime?.capabilities_type !== 'object'
    || runtime?.workbench_ready !== true
    || runtime?.authenticated !== true) {
    addFailure(failures, 'soak_identity_runtime_not_ready', owner);
  }
  if (health?.http_status !== 200 || health?.ok !== true || health?.ready !== true
    || health?.db_ready !== true || health?.auth_ready !== true
    || text(health?.origin).replace(/\/$/, '') !== text(identity?.control_plane_origin).replace(/\/$/, '')
    || text(health?.backend_version) !== text(identity?.backend_version)) {
    addFailure(failures, 'soak_identity_health_invalid', owner);
  }
}

function validateIdentityObservations({ report, artifacts, referenced, expectedFingerprint, failures }) {
  const observations = Array.isArray(report?.identity_observations) ? report.identity_observations : [];
  const byId = new Map();
  for (const observation of observations) {
    const id = text(observation?.observation_id);
    const observedAt = isoTime(observation?.observed_at);
    if (!id || byId.has(id)) addFailure(failures, 'soak_identity_observation_id_invalid', id || 'missing');
    if (observation?.schema_version !== QWORK_SOAK_IDENTITY_OBSERVATION_SCHEMA
      || observation?.evidence_valid !== true
      || observation?.ok !== true
      || !['startup', 'restart-before', 'restart-after', 'run-final'].includes(observation?.phase)
      || !Number.isFinite(observedAt)
      || !contextActiveAt(observation?.context, observedAt)
      || text(observation?.release_identity_sha256) !== expectedFingerprint) {
      addFailure(failures, 'soak_identity_observation_invalid', id || 'missing');
    }
    if (!capabilitiesAttemptsValid(observation?.capabilities_readback_attempts)) {
      addFailure(failures, 'soak_identity_capabilities_attempts_invalid', id || 'missing');
    }
    exactArtifactRoles(observation, ['identity_readback'], failures, `identity:${id}`);
    const payload = artifactPayload({
      entity: observation,
      ownerType: 'identity_observation',
      ownerId: id,
      role: 'identity_readback',
      artifacts,
      referenced,
      failures,
    });
    if (payload) validateIdentityReadback(payload, observation, report, expectedFingerprint, failures);
    if (id && !byId.has(id)) byId.set(id, observation);
  }
  return { observations, byId };
}

function validateTaskReceiptPayloads(task, payloads, failures) {
  const owner = text(task?.task_id) || 'missing';
  const expected = {
    task_id: owner,
    session_id: text(task?.context?.session_id),
    prompt_sha256: text(task?.prompt_sha256),
    marker: text(task?.marker),
  };
  const dispatch = payloads.dispatch_receipt;
  const send = payloads.send_receipt;
  const terminal = payloads.terminal_receipt;
  if (dispatch?.schema_version !== 'qbot-qwork-soak-dispatch-receipt/v1'
    || dispatch?.evidence_valid !== true || dispatch?.dispatched !== true
    || dispatch?.sequence !== task.sequence
    || text(dispatch?.task_id) !== expected.task_id
    || text(dispatch?.session_id) !== expected.session_id
    || text(dispatch?.prompt_sha256) !== expected.prompt_sha256
    || text(dispatch?.marker) !== expected.marker
    || text(dispatch?.release_identity_sha256) !== text(task?.release_identity_sha256)
    || text(dispatch?.dispatched_at) !== text(task?.dispatched_at)
    || !contextEqual(dispatch?.context, task?.context)) {
    addFailure(failures, 'soak_task_dispatch_receipt_invalid', owner);
  }
  if (send?.schema_version !== 'qbot-qwork-soak-send-receipt/v1'
    || send?.evidence_valid !== true || send?.confirmed !== true
    || send?.accepted_by_product !== true || send?.click_count !== 1
    || !text(send?.user_message_id)
    || text(send?.task_id) !== expected.task_id
    || text(send?.session_id) !== expected.session_id
    || text(send?.prompt_sha256) !== expected.prompt_sha256
    || text(send?.marker) !== expected.marker
    || text(send?.release_identity_sha256) !== text(task?.release_identity_sha256)
    || text(send?.confirmed_at) !== text(task?.send_confirmed_at)
    || !contextEqual(send?.context, task?.context)) {
    addFailure(failures, 'soak_task_send_receipt_invalid', owner);
  }
  const responseText = String(terminal?.assistant_response ?? '');
  const responseSha256 = sha256Text(responseText);
  const stability = Array.isArray(terminal?.stability_observations) ? terminal.stability_observations : [];
  const stabilityTimes = stability.map((item) => isoTime(item?.observed_at));
  const stabilityValid = stability.length >= 3 && stability.every((item, index) => (
    Number.isFinite(stabilityTimes[index])
    && (index === 0 || stabilityTimes[index] > stabilityTimes[index - 1])
    && text(item?.task_id) === expected.task_id
    && text(item?.session_id) === expected.session_id
    && text(item?.prompt_sha256) === expected.prompt_sha256
    && text(item?.assistant_message_id) === text(terminal?.assistant_message_id)
    && text(item?.response_sha256) === responseSha256
    && text(item?.marker) === expected.marker
    && contextEqual(item?.context, task?.context)
    && item?.running === false
    && item?.status === 'succeeded'
  ));
  if (terminal?.schema_version !== 'qbot-qwork-soak-terminal-receipt/v1'
    || terminal?.evidence_valid !== true || terminal?.status !== 'succeeded'
    || terminal?.running !== false || terminal?.reply_present !== true
    || !text(terminal?.assistant_message_id) || !responseText.trim()
    || !responseText.includes(expected.marker)
    || text(terminal?.assistant_response_sha256) !== responseSha256
    || text(terminal?.task_id) !== expected.task_id
    || text(terminal?.session_id) !== expected.session_id
    || text(terminal?.prompt_sha256) !== expected.prompt_sha256
    || text(terminal?.marker) !== expected.marker
    || text(terminal?.release_identity_sha256) !== text(task?.release_identity_sha256)
    || text(terminal?.completed_at) !== text(task?.terminal_at)
    || !contextEqual(terminal?.context, task?.context)
    || !stabilityValid) {
    addFailure(failures, 'soak_task_terminal_receipt_invalid', owner);
  }
  return {
    dispatch,
    send,
    terminal,
    stabilityTimes,
    userMessageId: text(send?.user_message_id),
    assistantMessageId: text(terminal?.assistant_message_id),
  };
}

function eventOverlaps(start, end, otherStart, otherEnd) {
  return start < otherEnd && otherStart < end;
}

function validateTasks({ report, artifacts, referenced, expectedFingerprint, failures }) {
  const tasks = Array.isArray(report?.tasks) ? report.tasks : [];
  if (tasks.length < report.policy.minimum_tasks || report.tasks_completed !== tasks.length) {
    addFailure(failures, 'soak_tasks_below_minimum');
  }
  const ids = new Set();
  const markers = new Set();
  const userMessageIds = new Set();
  const assistantMessageIds = new Set();
  const intervals = [];
  const reportStart = isoTime(report?.started_at);
  const reportEnd = isoTime(report?.ended_at);
  for (const [index, task] of tasks.entries()) {
    const id = text(task?.task_id);
    const marker = text(task?.marker);
    const prompt = String(task?.prompt ?? '');
    const startedAt = isoTime(task?.started_at);
    const dispatchedAt = isoTime(task?.dispatched_at);
    const sendAt = isoTime(task?.send_confirmed_at);
    const terminalAt = isoTime(task?.terminal_at);
    const endedAt = isoTime(task?.ended_at);
    if (!id || ids.has(id)) addFailure(failures, 'soak_task_id_invalid', id || `index-${index}`);
    if (!marker || markers.has(marker) || !prompt.includes(marker)) {
      addFailure(failures, 'soak_task_marker_invalid', id || `index-${index}`);
    }
    ids.add(id);
    markers.add(marker);
    if (task?.schema_version !== QWORK_SOAK_TASK_SCHEMA
      || task?.sequence !== index + 1
      || task?.executed !== true || task?.inherited !== false || task?.synthetic !== false
      || task?.result !== 'succeeded'
      || !prompt.trim() || text(task?.prompt_sha256) !== sha256Text(prompt)
      || text(task?.release_identity_sha256) !== expectedFingerprint
      || !contextActiveAt(task?.context, startedAt)
      || ![startedAt, dispatchedAt, sendAt, terminalAt, endedAt].every(Number.isFinite)
      || startedAt < reportStart || endedAt > reportEnd
      || !(startedAt < dispatchedAt && dispatchedAt <= sendAt && sendAt < terminalAt && terminalAt <= endedAt)) {
      addFailure(failures, 'soak_task_execution_invalid', id || `index-${index}`);
    }
    exactArtifactRoles(task, TASK_ARTIFACT_ROLES, failures, `task:${id}`);
    const payloads = Object.fromEntries(TASK_ARTIFACT_ROLES.map((role) => [role, artifactPayload({
      entity: task,
      ownerType: 'task',
      ownerId: id,
      role,
      artifacts,
      referenced,
      failures,
    })]));
    const receipt = validateTaskReceiptPayloads(task, payloads, failures);
    if (!receipt.userMessageId || userMessageIds.has(receipt.userMessageId)) {
      addFailure(failures, 'soak_task_user_message_id_invalid', id);
    }
    if (!receipt.assistantMessageId || assistantMessageIds.has(receipt.assistantMessageId)) {
      addFailure(failures, 'soak_task_assistant_message_id_invalid', id);
    }
    userMessageIds.add(receipt.userMessageId);
    assistantMessageIds.add(receipt.assistantMessageId);
    if (receipt.stabilityTimes.length
      && (receipt.stabilityTimes[0] < terminalAt || receipt.stabilityTimes.at(-1) > endedAt)) {
      addFailure(failures, 'soak_task_stability_timeline_invalid', id);
    }
    intervals.push({ id, start: startedAt, end: endedAt, context: task.context });
  }
  for (let index = 1; index < intervals.length; index += 1) {
    if (!Number.isFinite(intervals[index - 1].end)
      || !Number.isFinite(intervals[index].start)
      || intervals[index].start < intervals[index - 1].end) {
      addFailure(failures, 'soak_task_serial_timeline_invalid', intervals[index].id);
    }
  }
  return { tasks, intervals };
}

function validateRestartReceipt(restart, payload, expectedFingerprint, failures) {
  const id = text(restart?.restart_id) || 'missing';
  if (payload?.schema_version !== 'qbot-qwork-soak-restart-receipt/v1'
    || payload?.evidence_valid !== true
    || text(payload?.restart_id) !== id
    || payload?.sequence !== restart.sequence
    || payload?.managed !== true || payload?.recovered !== true
    || text(payload?.started_at) !== text(restart?.started_at)
    || text(payload?.stop_observed_at) !== text(restart?.stop_observed_at)
    || text(payload?.launch_started_at) !== text(restart?.launch_started_at)
    || text(payload?.recovered_at) !== text(restart?.recovered_at)
    || text(payload?.ended_at) !== text(restart?.ended_at)
    || text(payload?.release_identity_sha256) !== expectedFingerprint
    || !contextEqual(payload?.before, restart?.before)
    || !contextEqual(payload?.after, restart?.after)
    || payload?.old_host_exit_observed !== true
    || payload?.new_host_process_observed !== true
    || payload?.session_file_replaced !== true
    || payload?.cdp_reachable !== true
    || payload?.authenticated !== true
    || payload?.workbench_ready !== true
    || payload?.capabilities_readable !== true
    || payload?.runtime_identity_stable !== true) {
    addFailure(failures, 'soak_restart_receipt_invalid', id);
  }
}

function validateRestarts({
  report,
  observations,
  artifacts,
  referenced,
  expectedFingerprint,
  policy,
  failures,
}) {
  const restarts = Array.isArray(report?.restarts) ? report.restarts : [];
  if (restarts.length < report.policy.minimum_restarts || report.restart_count !== restarts.length) {
    addFailure(failures, 'soak_restarts_below_minimum');
  }
  const ids = new Set();
  const intervals = [];
  let previousAfter = null;
  for (const [index, restart] of restarts.entries()) {
    const id = text(restart?.restart_id);
    const startedAt = isoTime(restart?.started_at);
    const stopAt = isoTime(restart?.stop_observed_at);
    const launchAt = isoTime(restart?.launch_started_at);
    const recoveredAt = isoTime(restart?.recovered_at);
    const endedAt = isoTime(restart?.ended_at);
    const beforeObservation = observations.byId.get(text(restart?.identity_observation_before_id));
    const afterObservation = observations.byId.get(text(restart?.identity_observation_after_id));
    const beforeObservedAt = isoTime(beforeObservation?.observed_at);
    const afterObservedAt = isoTime(afterObservation?.observed_at);
    if (!id || ids.has(id)) addFailure(failures, 'soak_restart_id_invalid', id || `index-${index}`);
    ids.add(id);
    if (restart?.schema_version !== QWORK_SOAK_RESTART_SCHEMA
      || restart?.sequence !== index + 1 || restart?.managed !== true || restart?.recovered !== true
      || text(restart?.release_identity_sha256) !== expectedFingerprint
      || !contextValid(restart?.before) || !contextValid(restart?.after)
      || !contextActiveAt(restart?.before, startedAt)
      || !contextActiveAt(restart?.after, recoveredAt)
      || contextValue(restart.before).host_pid === contextValue(restart.after).host_pid
      || contextValue(restart.before).host_process_started_at === contextValue(restart.after).host_process_started_at
      || contextValue(restart.before).renderer_pid === contextValue(restart.after).renderer_pid
      || contextValue(restart.before).renderer_process_started_at === contextValue(restart.after).renderer_process_started_at
      || contextValue(restart.before).session_id === contextValue(restart.after).session_id
      || contextValue(restart.before).cdp_endpoint === contextValue(restart.after).cdp_endpoint
      || contextValue(restart.before).webview_target_id === contextValue(restart.after).webview_target_id
      || ![startedAt, stopAt, launchAt, recoveredAt, endedAt].every(Number.isFinite)
      || startedAt < isoTime(report?.started_at) || endedAt > isoTime(report?.ended_at)
      || !(startedAt < stopAt && stopAt <= launchAt && launchAt < recoveredAt && recoveredAt <= endedAt)) {
      addFailure(failures, 'soak_restart_invalid', id || `index-${index}`);
    }
    if (previousAfter && !contextEqual(previousAfter, restart?.before)) {
      addFailure(failures, 'soak_restart_continuity_invalid', id);
    }
    previousAfter = restart?.after;
    if (!beforeObservation || beforeObservation.phase !== 'restart-before'
      || text(beforeObservation.restart_id) !== id
      || !contextEqual(beforeObservation.context, restart?.before)
      || !Number.isFinite(beforeObservedAt)
      || beforeObservedAt > startedAt
      || startedAt - beforeObservedAt > policy.maximum_resource_sample_gap_ms) {
      addFailure(failures, 'soak_restart_before_observation_invalid', id);
    }
    if (!afterObservation || afterObservation.phase !== 'restart-after'
      || text(afterObservation.restart_id) !== id
      || !contextEqual(afterObservation.context, restart?.after)
      || !Number.isFinite(afterObservedAt)
      || afterObservedAt < recoveredAt
      || afterObservedAt > endedAt
      || afterObservedAt - recoveredAt > policy.maximum_resource_sample_gap_ms) {
      addFailure(failures, 'soak_restart_after_observation_invalid', id);
    }
    exactArtifactRoles(restart, ['restart_receipt'], failures, `restart:${id}`);
    const receipt = artifactPayload({
      entity: restart,
      ownerType: 'restart',
      ownerId: id,
      role: 'restart_receipt',
      artifacts,
      referenced,
      failures,
    });
    if (receipt) validateRestartReceipt(restart, receipt, expectedFingerprint, failures);
    intervals.push({ id, start: startedAt, end: endedAt, before: restart.before, after: restart.after });
  }
  for (let index = 1; index < intervals.length; index += 1) {
    if (intervals[index].start < intervals[index - 1].end) {
      addFailure(failures, 'soak_restart_timeline_invalid', intervals[index].id);
    }
  }
  return { restarts, intervals, ids: [...ids] };
}

function validateIdentityObservationSet(identityObservations, restartValidation, failures) {
  const expected = [
    { id: 'startup', phase: 'startup', restartId: '' },
    ...restartValidation.restarts.flatMap((restart) => [
      {
        id: text(restart?.identity_observation_before_id),
        phase: 'restart-before',
        restartId: text(restart?.restart_id),
      },
      {
        id: text(restart?.identity_observation_after_id),
        phase: 'restart-after',
        restartId: text(restart?.restart_id),
      },
    ]),
    { id: 'run-final', phase: 'run-final', restartId: '' },
  ];
  const actual = identityObservations.observations.map((observation) => ({
    id: text(observation?.observation_id),
    phase: text(observation?.phase),
    restartId: text(observation?.restart_id),
  }));
  if (stableJson(actual) !== stableJson(expected)) {
    addFailure(failures, 'soak_identity_observation_set_invalid');
  }
  const observedTimes = identityObservations.observations.map((observation) => (
    isoTime(observation?.observed_at)
  ));
  if (observedTimes.some((value, index) => (
    !Number.isFinite(value) || (index > 0 && value <= observedTimes[index - 1])
  ))) {
    addFailure(failures, 'soak_identity_observation_timeline_invalid');
  }
}

function buildEpochs(report, identityObservations, restartValidation, policy, failures) {
  const startup = identityObservations.byId.get('startup');
  const final = identityObservations.byId.get('run-final');
  if (!startup || startup.phase !== 'startup') addFailure(failures, 'soak_startup_identity_missing');
  if (!final || final.phase !== 'run-final') addFailure(failures, 'soak_run_final_identity_missing');
  if (startup && restartValidation.intervals[0]
    && !contextEqual(startup.context, restartValidation.intervals[0].before)) {
    addFailure(failures, 'soak_startup_restart_context_mismatch');
  }
  if (final && restartValidation.intervals.at(-1)
    && !contextEqual(final.context, restartValidation.intervals.at(-1).after)) {
    addFailure(failures, 'soak_final_restart_context_mismatch');
  }
  const reportStart = isoTime(report.started_at);
  const reportEnd = isoTime(report.ended_at);
  const startupAt = isoTime(startup?.observed_at);
  const finalAt = isoTime(final?.observed_at);
  if (!startup || !Number.isFinite(startupAt)
    || startupAt < reportStart
    || startupAt - reportStart > policy.maximum_resource_sample_gap_ms) {
    addFailure(failures, 'soak_startup_time_invalid');
  }
  if (!final || !Number.isFinite(finalAt)
    || finalAt > reportEnd
    || reportEnd - finalAt > policy.maximum_resource_sample_gap_ms) {
    addFailure(failures, 'soak_run_final_time_invalid');
  }
  const epochs = [];
  if (!startup) return epochs;
  let start = isoTime(startup.observed_at);
  let context = startup.context;
  for (const restart of restartValidation.intervals) {
    epochs.push({ start, end: restart.start, context });
    start = restart.end;
    context = restart.after;
  }
  epochs.push({ start, end: final ? isoTime(final.observed_at) : reportEnd, context });
  if (epochs.some((epoch) => !Number.isFinite(epoch.start) || !Number.isFinite(epoch.end) || epoch.end <= epoch.start)) {
    addFailure(failures, 'soak_identity_epoch_timeline_invalid');
  }
  if (new Set(epochs.map((epoch) => contextKey(epoch.context))).size !== epochs.length) {
    addFailure(failures, 'soak_identity_epoch_context_reused');
  }
  return epochs;
}

function bindTasksToEpochs(tasks, restarts, epochs, failures) {
  const epochTaskCounts = new Array(epochs.length).fill(0);
  for (const task of tasks.intervals) {
    if (restarts.intervals.some((restart) => eventOverlaps(task.start, task.end, restart.start, restart.end))) {
      addFailure(failures, 'soak_task_overlaps_restart', task.id);
    }
    const epochIndex = epochs.findIndex((epoch) => task.start >= epoch.start && task.end <= epoch.end);
    if (epochIndex < 0 || !contextEqual(task.context, epochs[epochIndex]?.context)) {
      addFailure(failures, 'soak_task_context_epoch_mismatch', task.id);
    } else {
      epochTaskCounts[epochIndex] += 1;
    }
  }
  if (epochTaskCounts.some((count) => count < 1)) addFailure(failures, 'soak_restart_epoch_without_task');
}

function validateCrashLedger({ report, restarts, epochs, artifacts, referenced, policy, failures }) {
  const ledger = report?.crash_ledger;
  const owner = text(report?.run_id);
  exactArtifactRoles(ledger, ['crash_ledger'], failures, 'crash-ledger');
  const payload = artifactPayload({
    entity: ledger,
    ownerType: 'crash_ledger',
    ownerId: owner,
    role: 'crash_ledger',
    artifacts,
    referenced,
    failures,
  });
  const samples = Array.isArray(ledger?.monitor_samples) ? ledger.monitor_samples : [];
  const epochSamples = new Map();
  let previousTime = Number.NEGATIVE_INFINITY;
  for (const [index, sample] of samples.entries()) {
    const observedAt = isoTime(sample?.observed_at);
    const epochIndex = epochs.findIndex((epoch) => observedAt >= epoch.start && observedAt <= epoch.end);
    if (sample?.sequence !== index + 1
      || !Number.isFinite(observedAt)
      || observedAt < previousTime
      || epochIndex < 0
      || !contextActiveAt(sample?.context, observedAt)
      || !contextEqual(sample?.context, epochs[epochIndex]?.context)
      || sample?.host_alive !== true
      || sample?.renderer_alive !== true
      || sample?.unexpected_host_exit_count !== 0
      || sample?.renderer_crash_count !== 0
      || sample?.crash_report_count !== 0) {
      addFailure(failures, 'soak_crash_monitor_sample_invalid', `index-${index}`);
    }
    previousTime = observedAt;
    if (!epochSamples.has(epochIndex)) epochSamples.set(epochIndex, []);
    epochSamples.get(epochIndex).push(observedAt);
  }
  for (const [index, epoch] of epochs.entries()) {
    const times = epochSamples.get(index) || [];
    if (times.length < 2
      || times[0] - epoch.start > policy.maximum_resource_sample_gap_ms
      || epoch.end - times.at(-1) > policy.maximum_resource_sample_gap_ms
      || times.some((value, sampleIndex) => sampleIndex > 0
        && (value <= times[sampleIndex - 1]
          || value - times[sampleIndex - 1] > policy.maximum_resource_sample_gap_ms))) {
      addFailure(failures, 'soak_crash_monitor_coverage_incomplete', `epoch-${index}`);
    }
  }
  if (ledger?.schema_version !== QWORK_SOAK_CRASH_LEDGER_SCHEMA
    || ledger?.evidence_valid !== true
    || text(ledger?.window_started_at) !== text(report?.started_at)
    || text(ledger?.window_ended_at) !== text(report?.ended_at)
    || ledger?.crash_count !== 0
    || !Array.isArray(ledger?.entries) || ledger.entries.length !== 0
    || !Array.isArray(ledger?.unexpected_host_exits) || ledger.unexpected_host_exits.length !== 0
    || !Array.isArray(ledger?.renderer_crashes) || ledger.renderer_crashes.length !== 0
    || !Array.isArray(ledger?.crash_reports) || ledger.crash_reports.length !== 0
    || !intervalWithinMaximum(
      ledger?.monitoring_interval_ms,
      policy.maximum_resource_sample_gap_ms,
    )
    || stableJson(ledger?.monitored_process_roles) !== stableJson(['host', 'qwork_renderer'])
    || stableJson(ledger?.intentional_restart_ids) !== stableJson(restarts.ids)
    || stableJson((ledger?.monitored_contexts || []).map(contextValue))
      !== stableJson(epochs.map((epoch) => contextValue(epoch.context)))) {
    addFailure(failures, 'soak_crash_ledger_invalid');
  }
  if (!payload || stableJson(payload) !== stableJson(ledger)) {
    addFailure(failures, 'soak_crash_ledger_disk_mismatch');
  }
  if (report?.crash_count !== 0 || !Array.isArray(report?.crashes) || report.crashes.length !== 0) {
    addFailure(failures, 'soak_crash_count_not_zero');
  }
}

function sampleProcessKey(sample) {
  return [
    text(sample?.process_role),
    sample?.pid,
    text(sample?.process_started_at),
    text(sample?.session_id),
    text(sample?.cdp_endpoint),
  ].join('|');
}

function expectedProcessKey(role, context) {
  const normalized = contextValue(context);
  return sampleProcessKey({
    process_role: role,
    pid: role === 'host' ? normalized.host_pid : normalized.renderer_pid,
    process_started_at: role === 'host'
      ? normalized.host_process_started_at
      : normalized.renderer_process_started_at,
    session_id: normalized.session_id,
    cdp_endpoint: normalized.cdp_endpoint,
  });
}

function validateResourceUsage({ report, epochs, artifacts, referenced, policy, failures }) {
  const resource = report?.resource_usage;
  const owner = text(report?.run_id);
  exactArtifactRoles(resource, ['resource_usage'], failures, 'resource-usage');
  const payload = artifactPayload({
    entity: resource,
    ownerType: 'resource_usage',
    ownerId: owner,
    role: 'resource_usage',
    artifacts,
    referenced,
    failures,
  });
  if (!payload || stableJson(payload) !== stableJson(resource)) {
    addFailure(failures, 'soak_resource_ledger_disk_mismatch');
  }
  const samples = Array.isArray(resource?.samples) ? resource.samples : [];
  const expectedThresholds = {
    rss_peak_bytes: policy.maximum_rss_peak_bytes,
    rss_growth_bytes: policy.maximum_rss_growth_bytes,
    rss_slope_bytes_per_minute: policy.maximum_rss_slope_bytes_per_minute,
  };
  const groups = new Map();
  let previousTime = Number.NEGATIVE_INFINITY;
  for (const [index, sample] of samples.entries()) {
    const observedAt = isoTime(sample?.observed_at);
    if (sample?.sequence !== index + 1 || !Number.isFinite(observedAt)
      || observedAt < previousTime || !['host', 'qwork_renderer'].includes(sample?.process_role)
      || !isPositiveInteger(sample?.pid) || !Number.isFinite(isoTime(sample?.process_started_at))
      || isoTime(sample?.process_started_at) > observedAt
      || !text(sample?.session_id) || !validCdpEndpoint(sample?.cdp_endpoint)
      || !isNonNegativeInteger(sample?.rss_bytes)) {
      addFailure(failures, 'soak_resource_sample_invalid', `index-${index}`);
    }
    previousTime = observedAt;
    const epochIndex = epochs.findIndex((epoch) => observedAt >= epoch.start && observedAt <= epoch.end);
    const expectedKey = epochIndex >= 0 ? expectedProcessKey(sample?.process_role, epochs[epochIndex].context) : '';
    const key = sampleProcessKey(sample);
    if (epochIndex < 0 || key !== expectedKey) {
      addFailure(failures, 'soak_resource_process_identity_mismatch', `index-${index}`);
    }
    const groupKey = `${epochIndex}:${key}`;
    if (!groups.has(groupKey)) groups.set(groupKey, []);
    groups.get(groupKey).push({ ...sample, observedAt });
  }
  const expectedGroupKeys = epochs.flatMap((epoch, index) => ['host', 'qwork_renderer'].map(
    (role) => `${index}:${expectedProcessKey(role, epoch.context)}`,
  ));
  let observedPeak = 0;
  let observedGrowth = 0;
  let observedSlope = 0;
  for (const groupKey of expectedGroupKeys) {
    const group = groups.get(groupKey) || [];
    const epochIndex = Number(groupKey.slice(0, groupKey.indexOf(':')));
    const epoch = epochs[epochIndex];
    if (group.length < policy.minimum_samples_per_process) {
      addFailure(failures, 'soak_resource_process_samples_insufficient', groupKey);
      continue;
    }
    if (group[0].observedAt - epoch.start > policy.maximum_resource_sample_gap_ms
      || epoch.end - group.at(-1).observedAt > policy.maximum_resource_sample_gap_ms) {
      addFailure(failures, 'soak_resource_epoch_coverage_incomplete', groupKey);
    }
    const firstRss = group[0].rss_bytes;
    const peak = Math.max(...group.map((sample) => sample.rss_bytes));
    observedPeak = Math.max(observedPeak, peak);
    observedGrowth = Math.max(observedGrowth, peak - firstRss);
    for (let index = 1; index < group.length; index += 1) {
      const elapsed = group[index].observedAt - group[index - 1].observedAt;
      if (elapsed <= 0 || elapsed > policy.maximum_resource_sample_gap_ms) {
        addFailure(failures, 'soak_resource_sample_gap_invalid', groupKey);
        continue;
      }
      const slope = Math.max(0, group[index].rss_bytes - group[index - 1].rss_bytes) * 60_000 / elapsed;
      observedSlope = Math.max(observedSlope, slope);
    }
  }
  if (resource?.schema_version !== QWORK_SOAK_RESOURCE_USAGE_SCHEMA
    || resource?.evidence_valid !== true
    || text(resource?.window_started_at) !== text(report?.started_at)
    || text(resource?.window_ended_at) !== text(report?.ended_at)
    || !intervalWithinMaximum(
      resource?.sampling_interval_ms,
      policy.maximum_resource_sample_gap_ms,
    )
    || stableJson(resource?.thresholds) !== stableJson(expectedThresholds)
    || resource?.rss_peak_bytes !== observedPeak
    || resource?.rss_growth_bytes !== observedGrowth
    || resource?.rss_slope_bytes_per_minute !== observedSlope
    || resource?.within_thresholds !== true
    || resource?.leak_detected !== false
    || resource?.verdict !== 'no_leak'
    || observedPeak > policy.maximum_rss_peak_bytes
    || observedGrowth > policy.maximum_rss_growth_bytes
    || observedSlope > policy.maximum_rss_slope_bytes_per_minute
    || report?.resource_leak_detected !== false) {
    addFailure(failures, 'soak_resource_leak_not_proven_absent');
  }
  return { sampleCount: samples.length, observedPeak, observedGrowth, observedSlope };
}

export function auditQworkSoakReport({
  report,
  reportPath = '',
  reportSha256 = '',
  expectedReleaseIdentitySha256 = '',
  expectedReleaseIdentity = null,
  expectedFrameworkCommit = '',
  policy = QWORK_SOAK_DEFAULT_POLICY,
} = {}) {
  const failures = [];
  const normalizedPolicy = normalizePolicy(policy);
  if (!policyValid(normalizedPolicy)) addFailure(failures, 'soak_policy_invalid');
  if (!report || typeof report !== 'object' || Array.isArray(report)) {
    return {
      schema_version: QWORK_SOAK_REPORT_AUDIT_SCHEMA,
      passed: false,
      decision: 'STOP_PIPELINE',
      failures: ['soak_report_object_required'],
      observed: {},
    };
  }
  const artifactInspection = validateReportArtifact({ report, reportPath, reportSha256, failures });
  const releaseIdentity = report.release_identity;
  const fingerprint = qworkSoakReleaseIdentityFingerprint(releaseIdentity);
  const reportStart = isoTime(report.started_at);
  const reportEnd = isoTime(report.ended_at);
  if (report.schema_version !== QWORK_SOAK_REPORT_SCHEMA) addFailure(failures, 'soak_schema_mismatch');
  if (!text(report.run_id)) addFailure(failures, 'soak_run_id_missing');
  if (!Number.isFinite(reportStart) || !Number.isFinite(reportEnd) || reportEnd <= reportStart) {
    addFailure(failures, 'soak_report_timeline_invalid');
  }
  if (!releaseIdentityValid(releaseIdentity)
    || !isSha256(expectedReleaseIdentitySha256)
    || text(report.release_identity_sha256) !== expectedReleaseIdentitySha256
    || fingerprint !== expectedReleaseIdentitySha256
    || (expectedReleaseIdentity && stableJson(expectedReleaseIdentity) !== stableJson(releaseIdentity))) {
    addFailure(failures, 'soak_release_identity_mismatch');
  }
  if (!isCommit(report.framework_commit)
    || !isCommit(expectedFrameworkCommit)
    || report.framework_commit !== expectedFrameworkCommit) {
    addFailure(failures, 'soak_framework_commit_mismatch');
  }
  if (stableJson(report.policy) !== stableJson(normalizedPolicy)) addFailure(failures, 'soak_policy_mismatch');
  if (report.execution?.mode !== 'live'
    || report.execution?.model_tier !== 'M3'
    || report.execution?.serial !== true
    || report.execution?.parallel !== 1
    || report.execution?.single_host_pipeline !== 1
    || report.execution?.inherited !== 0
    || report.execution?.synthetic !== 0) {
    addFailure(failures, 'soak_execution_provenance_invalid');
  }
  const artifacts = loadArtifacts(report, artifactInspection.root, artifactInspection.reportFile, failures);
  const referenced = new Set();
  const identityObservations = validateIdentityObservations({
    report,
    artifacts,
    referenced,
    expectedFingerprint: expectedReleaseIdentitySha256,
    failures,
  });
  const tasks = validateTasks({
    report,
    artifacts,
    referenced,
    expectedFingerprint: expectedReleaseIdentitySha256,
    failures,
  });
  const restarts = validateRestarts({
    report,
    observations: identityObservations,
    artifacts,
    referenced,
    expectedFingerprint: expectedReleaseIdentitySha256,
    policy: normalizedPolicy,
    failures,
  });
  validateIdentityObservationSet(identityObservations, restarts, failures);
  const epochs = buildEpochs(report, identityObservations, restarts, normalizedPolicy, failures);
  bindTasksToEpochs(tasks, restarts, epochs, failures);
  validateCrashLedger({ report, restarts, epochs, artifacts, referenced, policy: normalizedPolicy, failures });
  const resource = validateResourceUsage({
    report,
    epochs,
    artifacts,
    referenced,
    policy: normalizedPolicy,
    failures,
  });
  for (const id of artifacts.byId.keys()) {
    if (!referenced.has(id)) addFailure(failures, 'soak_artifact_orphaned', id);
  }
  if (report.evidence_complete !== true) addFailure(failures, 'soak_evidence_incomplete');
  if (report.passed !== true) addFailure(failures, 'soak_not_passed');
  const uniqueFailures = [...new Set(failures)];
  return {
    schema_version: QWORK_SOAK_REPORT_AUDIT_SCHEMA,
    generated_at: new Date().toISOString(),
    passed: uniqueFailures.length === 0,
    decision: uniqueFailures.length === 0 ? 'PASS_STAGE' : 'STOP_PIPELINE',
    failures: uniqueFailures,
    observed: {
      run_id: text(report.run_id),
      tasks_completed: tasks.tasks.length,
      restart_count: restarts.restarts.length,
      identity_observation_count: identityObservations.observations.length,
      crash_count: report.crash_count ?? null,
      resource_sample_count: resource.sampleCount,
      rss_peak_bytes: resource.observedPeak,
      rss_growth_bytes: resource.observedGrowth,
      rss_slope_bytes_per_minute: resource.observedSlope,
      release_identity_sha256: fingerprint,
      framework_commit: text(report.framework_commit),
      report_path: artifactInspection.reportFile?.realpath || '',
      report_sha256: text(reportSha256),
    },
  };
}

export function readAndAuditQworkSoakReport({ reportPath, reportSha256 = '', ...options } = {}) {
  let report = null;
  try {
    report = JSON.parse(fs.readFileSync(path.resolve(text(reportPath)), 'utf8'));
  } catch {
    return {
      schema_version: QWORK_SOAK_REPORT_AUDIT_SCHEMA,
      generated_at: new Date().toISOString(),
      passed: false,
      decision: 'STOP_PIPELINE',
      failures: ['soak_report_unreadable'],
      observed: { report_path: text(reportPath), report_sha256: text(reportSha256) },
    };
  }
  return auditQworkSoakReport({ report, reportPath, reportSha256, ...options });
}
