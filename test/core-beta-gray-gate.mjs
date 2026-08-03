import assert from 'node:assert/strict';
import {
  auditCoreBetaRun,
  evaluateCoreBetaGrayGate,
} from '../src/lib/core-beta-gray-gate.mjs';

function greenRun(index, identity = 'release-identity-sha256', { soak = false } = {}) {
  const run = {
    run_id: `green-${index}`,
    total: 184,
    completed: 184,
    executed: 184,
    inherited: 0,
    synthetic: 0,
    unique_case_count: 184,
    release_identity_sha256: identity,
    release_identity_drift: [],
    trusted_counts: {
      trusted_pass: 184,
      trusted_bug: 0,
      trusted_fail: 0,
      trusted_blocked: 0,
      framework_issue: 0,
      testcase_issue: 0,
    },
    evidence: {
      complete_count: 184,
      missing_count: 0,
      invalid_count: 0,
      action_receipts_passed: 184,
    },
    single_runner_unique: true,
    cleanup_complete: true,
    fixtures_restored: true,
    live_product_executed: true,
    flaky_count: 0,
  };
  if (soak) {
    run.soak = {
      passed: true,
      tasks_completed: 100,
      restart_count: 3,
      evidence_complete: true,
      crash_count: 0,
      resource_leak_detected: false,
    };
  }
  return run;
}

assert.equal(auditCoreBetaRun(greenRun(1)).passed, true);

const go = evaluateCoreBetaGrayGate(
  Array.from({ length: 5 }, (_, index) => greenRun(
    index + 1,
    'release-identity-sha256',
    { soak: index === 4 },
  )),
);
assert.equal(go.decision, 'GO_CONTROLLED_GRAY');
assert.equal(go.release_identity_stable, true);
assert.equal(go.soak_passed, true);

const synthetic = greenRun(4);
synthetic.executed = 183;
synthetic.synthetic = 1;
const noGoSynthetic = evaluateCoreBetaGrayGate([
  greenRun(1),
  greenRun(2),
  greenRun(3),
  synthetic,
  greenRun(5, 'release-identity-sha256', { soak: true }),
]);
assert.equal(noGoSynthetic.decision, 'NO_GO');
assert.match(noGoSynthetic.runs[3].failures.join(','), /synthetic_must_be_0/);

const noGoDrift = evaluateCoreBetaGrayGate([
  greenRun(1),
  greenRun(2),
  greenRun(3),
  greenRun(4),
  greenRun(5, 'different-release', { soak: true }),
]);
assert.equal(noGoDrift.decision, 'NO_GO');
assert.equal(noGoDrift.release_identity_stable, false);

const noGoWithoutSoak = evaluateCoreBetaGrayGate(
  Array.from({ length: 5 }, (_, index) => greenRun(index + 1)),
);
assert.equal(noGoWithoutSoak.decision, 'NO_GO');
assert.match(noGoWithoutSoak.failures.join(','), /required_soak_not_passed/);

assert.throws(
  () => evaluateCoreBetaGrayGate([], { requiredConsecutiveRuns: 2 }),
  /3-5/,
);

console.log('core-beta gray gate ok');
