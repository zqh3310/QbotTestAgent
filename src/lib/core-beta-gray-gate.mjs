const REQUIRED_TRUSTED_ZERO = Object.freeze([
  'trusted_bug',
  'trusted_fail',
  'trusted_blocked',
  'framework_issue',
  'testcase_issue',
]);

function firstDefined(object, paths, fallback = undefined) {
  for (const dottedPath of paths) {
    const value = String(dottedPath).split('.').reduce(
      (current, key) => current == null ? undefined : current[key],
      object,
    );
    if (value !== undefined && value !== null) return value;
  }
  return fallback;
}

function finiteNumber(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function truthyStrict(value) {
  return value === true || value === 'true' || value === 1 || value === '1';
}

function releaseIdentityFingerprint(run) {
  const explicit = firstDefined(run, [
    'release_identity_sha256',
    'release_identity.fingerprint',
    'identity.fingerprint',
    'run_metadata.release_identity_sha256',
  ]);
  if (String(explicit || '').trim()) return String(explicit).trim();
  const identity = firstDefined(run, ['release_identity', 'identity', 'run_metadata.release_identity']);
  if (!identity || typeof identity !== 'object' || Array.isArray(identity)) return '';
  return JSON.stringify(identity, Object.keys(identity).sort());
}

function trustedCount(run, category) {
  return finiteNumber(firstDefined(run, [
    `trusted_counts.${category}`,
    `adjudication.${category}`,
    `summary.${category}`,
    category,
  ]));
}

function numericSignal(run, names) {
  return finiteNumber(firstDefined(run, names));
}

function auditCoreBetaSoak(run, {
  minimumTasks = 100,
  minimumRestarts = 3,
} = {}) {
  const tasksCompleted = numericSignal(run, [
    'soak.tasks_completed',
    'performance.soak.tasks_completed',
    'summary.soak.tasks_completed',
  ]);
  const restartCount = numericSignal(run, [
    'soak.restart_count',
    'performance.soak.restart_count',
    'summary.soak.restart_count',
  ]);
  const evidenceComplete = firstDefined(run, [
    'soak.evidence_complete',
    'performance.soak.evidence_complete',
    'summary.soak.evidence_complete',
  ]);
  const passed = firstDefined(run, [
    'soak.passed',
    'performance.soak.passed',
    'summary.soak.passed',
  ]);
  const crashCount = numericSignal(run, [
    'soak.crash_count',
    'performance.soak.crash_count',
    'summary.soak.crash_count',
  ]);
  const resourceLeakDetected = firstDefined(run, [
    'soak.resource_leak_detected',
    'performance.soak.resource_leak_detected',
    'summary.soak.resource_leak_detected',
  ]);
  const failures = [];
  if (!truthyStrict(passed)) failures.push('soak_not_passed');
  if (tasksCompleted == null || tasksCompleted < minimumTasks) {
    failures.push(`soak_tasks_min_${minimumTasks}_actual_${tasksCompleted}`);
  }
  if (restartCount == null || restartCount < minimumRestarts) {
    failures.push(`soak_restarts_min_${minimumRestarts}_actual_${restartCount}`);
  }
  if (!truthyStrict(evidenceComplete)) failures.push('soak_evidence_not_complete');
  if (crashCount !== 0) failures.push(`soak_crash_count_must_be_0_actual_${crashCount}`);
  if (resourceLeakDetected !== false && resourceLeakDetected !== 'false' && resourceLeakDetected !== 0) {
    failures.push('soak_resource_leak_not_proven_absent');
  }
  return {
    passed: failures.length === 0,
    failures,
    observed: {
      tasks_completed: tasksCompleted,
      restart_count: restartCount,
      evidence_complete: truthyStrict(evidenceComplete),
      crash_count: crashCount,
      resource_leak_detected: resourceLeakDetected,
    },
  };
}

export function auditCoreBetaRun(run, { expectedCases = 184 } = {}) {
  const failures = [];
  const runId = String(firstDefined(run, ['run_id', 'id', 'name'], '') || '').trim();
  const total = numericSignal(run, ['total', 'case_count', 'summary.total']);
  const completed = numericSignal(run, ['completed', 'summary.completed']);
  const executed = numericSignal(run, ['executed', 'execution.executed', 'summary.executed']);
  const inherited = numericSignal(run, ['inherited', 'execution.inherited', 'summary.inherited']);
  const synthetic = numericSignal(run, ['synthetic', 'execution.synthetic', 'summary.synthetic']);
  const trustedPass = trustedCount(run, 'trusted_pass');
  const evidenceComplete = numericSignal(run, [
    'evidence.complete',
    'evidence.complete_count',
    'evidence_manifest.complete_count',
    'summary.evidence_complete',
  ]);
  const evidenceMissing = numericSignal(run, [
    'evidence.missing',
    'evidence.missing_count',
    'evidence_manifest.missing_count',
    'summary.evidence_missing',
  ]);
  const evidenceInvalid = numericSignal(run, [
    'evidence.invalid',
    'evidence.invalid_count',
    'evidence_manifest.invalid_count',
    'summary.evidence_invalid',
  ]);
  const uniqueCaseCount = numericSignal(run, [
    'unique_case_count',
    'execution.unique_case_count',
    'summary.unique_case_count',
  ]);
  const actionReceiptsPassed = numericSignal(run, [
    'evidence.action_receipts_passed',
    'action_receipts.passed_case_count',
    'summary.action_receipts_passed',
  ]);
  const identity = releaseIdentityFingerprint(run);
  const drift = firstDefined(run, [
    'release_identity_drift',
    'identity.drift',
    'run_lineage.release_identity_drift',
  ]);
  const runnerUnique = firstDefined(run, [
    'single_runner_unique',
    'runner.unique',
    'single_host_pipeline.unique',
  ]);
  const cleanupComplete = firstDefined(run, [
    'cleanup.complete',
    'cleanup_complete',
    'summary.cleanup_complete',
  ]);
  const fixturesRestored = firstDefined(run, [
    'fixtures.restored',
    'fixtures_restored',
    'summary.fixtures_restored',
  ]);
  const liveProductExecuted = firstDefined(run, [
    'live_product_executed',
    'execution.live_product_executed',
    'summary.live_product_executed',
  ]);
  const flakyCount = numericSignal(run, [
    'flaky_count',
    'summary.flaky_count',
    'adjudication.flaky_count',
  ]);

  if (!runId) failures.push('run_id_missing');
  if (total !== expectedCases) failures.push(`total_expected_${expectedCases}_actual_${total}`);
  if (completed !== expectedCases) failures.push(`completed_expected_${expectedCases}_actual_${completed}`);
  if (executed !== expectedCases) failures.push(`executed_expected_${expectedCases}_actual_${executed}`);
  if (inherited !== 0) failures.push(`inherited_must_be_0_actual_${inherited}`);
  if (synthetic !== 0) failures.push(`synthetic_must_be_0_actual_${synthetic}`);
  if (uniqueCaseCount !== expectedCases) failures.push(`unique_case_count_expected_${expectedCases}_actual_${uniqueCaseCount}`);
  if (trustedPass !== expectedCases) failures.push(`trusted_pass_expected_${expectedCases}_actual_${trustedPass}`);
  for (const category of REQUIRED_TRUSTED_ZERO) {
    const count = trustedCount(run, category);
    if (count !== 0) failures.push(`${category}_must_be_0_actual_${count}`);
  }
  if (evidenceComplete !== expectedCases) failures.push(`evidence_complete_expected_${expectedCases}_actual_${evidenceComplete}`);
  if (evidenceMissing !== 0) failures.push(`evidence_missing_must_be_0_actual_${evidenceMissing}`);
  if (evidenceInvalid !== 0) failures.push(`evidence_invalid_must_be_0_actual_${evidenceInvalid}`);
  if (actionReceiptsPassed !== expectedCases) {
    failures.push(`action_receipts_passed_expected_${expectedCases}_actual_${actionReceiptsPassed}`);
  }
  if (!identity) failures.push('release_identity_fingerprint_missing');
  if (Array.isArray(drift) ? drift.length > 0 : Boolean(drift && Object.keys(drift).length)) {
    failures.push('release_identity_drift_present');
  }
  if (!truthyStrict(runnerUnique)) failures.push('single_runner_uniqueness_not_proven');
  if (!truthyStrict(cleanupComplete)) failures.push('cleanup_not_complete');
  if (!truthyStrict(fixturesRestored)) failures.push('fixtures_not_restored');
  if (!truthyStrict(liveProductExecuted)) failures.push('live_product_execution_not_proven');
  if (flakyCount !== 0) failures.push(`flaky_count_must_be_0_actual_${flakyCount}`);

  return {
    run_id: runId,
    release_identity_fingerprint: identity,
    passed: failures.length === 0,
    failures,
    observed: {
      total,
      completed,
      executed,
      inherited,
      synthetic,
      unique_case_count: uniqueCaseCount,
      trusted_pass: trustedPass,
      evidence_complete: evidenceComplete,
      evidence_missing: evidenceMissing,
      evidence_invalid: evidenceInvalid,
      action_receipts_passed: actionReceiptsPassed,
      flaky_count: flakyCount,
    },
  };
}

export function evaluateCoreBetaGrayGate(runs, {
  expectedCases = 184,
  requiredConsecutiveRuns = 5,
  minimumSoakTasks = 100,
  minimumSoakRestarts = 3,
} = {}) {
  if (!Number.isInteger(requiredConsecutiveRuns)
    || requiredConsecutiveRuns < 3
    || requiredConsecutiveRuns > 5) {
    throw new Error('requiredConsecutiveRuns 必须是 3-5 的整数');
  }
  const audits = (Array.isArray(runs) ? runs : []).map((run) => auditCoreBetaRun(run, { expectedCases }));
  let consecutivePassing = 0;
  for (let index = audits.length - 1; index >= 0; index -= 1) {
    if (!audits[index].passed) break;
    consecutivePassing += 1;
  }
  const candidate = audits.slice(-requiredConsecutiveRuns);
  const candidateRuns = (Array.isArray(runs) ? runs : []).slice(-requiredConsecutiveRuns);
  const identities = new Set(candidate.map((item) => item.release_identity_fingerprint).filter(Boolean));
  const identityStable = candidate.length === requiredConsecutiveRuns && identities.size === 1;
  const soakAudits = candidateRuns.map((run) => auditCoreBetaSoak(run, {
    minimumTasks: minimumSoakTasks,
    minimumRestarts: minimumSoakRestarts,
  }));
  const passingSoakIndex = soakAudits.findIndex((item) => item.passed);
  const soakPassed = passingSoakIndex >= 0;
  const eligible = consecutivePassing >= requiredConsecutiveRuns && identityStable && soakPassed;
  const failures = [];
  if (audits.length < requiredConsecutiveRuns) {
    failures.push(`insufficient_runs_expected_${requiredConsecutiveRuns}_actual_${audits.length}`);
  }
  if (consecutivePassing < requiredConsecutiveRuns) {
    failures.push(`insufficient_consecutive_green_expected_${requiredConsecutiveRuns}_actual_${consecutivePassing}`);
  }
  if (!identityStable) failures.push('release_identity_not_stable_across_candidate_runs');
  if (!soakPassed) failures.push('required_soak_not_passed_in_candidate_runs');

  return {
    schema_version: 'qbot-core-gray-gate/v1',
    generated_at: new Date().toISOString(),
    expected_cases_per_run: expectedCases,
    required_consecutive_runs: requiredConsecutiveRuns,
    observed_run_count: audits.length,
    consecutive_passing_runs: consecutivePassing,
    release_identity_stable: identityStable,
    soak_required: {
      minimum_tasks: minimumSoakTasks,
      minimum_restarts: minimumSoakRestarts,
    },
    soak_passed: soakPassed,
    soak_passing_candidate_run_index: passingSoakIndex,
    soak_runs: soakAudits,
    eligible_for_controlled_production_gray_internal_beta: eligible,
    decision: eligible ? 'GO_CONTROLLED_GRAY' : 'NO_GO',
    scope: '受控生产灰度内测；不等同于正式GA',
    failures,
    runs: audits,
  };
}
