import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  auditCoreBetaRun,
  evaluateCoreBetaGrayGate,
} from '../src/lib/core-beta-gray-gate.mjs';
import { createQworkGrayGateFixture } from './helpers/qwork-gray-gate-fixture.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const temporaryRoot = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'qbot-gray-gate-')));

function sha256File(file) {
  return createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function legacySelfReportedRun(index, caseCount = 70) {
  return {
    run_id: `forged-${index}`,
    total: caseCount,
    completed: caseCount,
    executed: caseCount,
    inherited: 0,
    synthetic: 0,
    unique_case_count: caseCount,
    release_identity_sha256: 'a'.repeat(64),
    framework_commit: 'b'.repeat(40),
    trusted_counts: {
      trusted_pass: caseCount,
      trusted_bug: 0,
      trusted_fail: 0,
      trusted_blocked: 0,
      framework_issue: 0,
      testcase_issue: 0,
    },
    evidence: {
      complete_count: caseCount,
      missing_count: 0,
      invalid_count: 0,
      action_receipts_passed: caseCount,
    },
    single_runner_unique: true,
    cleanup_complete: true,
    fixtures_restored: true,
    live_product_executed: true,
    flaky_count: 0,
    soak: {
      passed: true,
      tasks_completed: 100,
      restart_count: 3,
      evidence_complete: true,
      crash_count: 0,
      resource_leak_detected: false,
    },
  };
}

function grayRunBinding(controlDir, {
  stageId = 'G3',
  runId = 'run-001',
  eventName = `0006-${stageId}-completion.json`,
  soakReport = null,
} = {}) {
  const planPath = path.join(controlDir, 'release-test-plan.json');
  const eventPath = path.join(controlDir, 'events', eventName);
  return {
    schema_version: 'qbot-core-gray-run/v2',
    run_id: runId,
    stage_id: stageId,
    control_dir: controlDir,
    release_plan: {
      path: planPath,
      sha256: fs.existsSync(planPath) ? sha256File(planPath) : '0'.repeat(64),
    },
    completion_event: {
      path: eventPath,
      sha256: fs.existsSync(eventPath) ? sha256File(eventPath) : '0'.repeat(64),
    },
    soak_report: soakReport,
  };
}

try {
  const forged = legacySelfReportedRun(1, 160);
  const forgedAudit = auditCoreBetaRun(forged);
  assert.equal(forgedAudit.passed, false);
  assert.ok(forgedAudit.failures.some((failure) => failure.includes('run_fields_mismatch')));

  const forgedGate = evaluateCoreBetaGrayGate([
    legacySelfReportedRun(1, 160),
    legacySelfReportedRun(2),
    legacySelfReportedRun(3),
    legacySelfReportedRun(4),
    legacySelfReportedRun(5),
  ]);
  assert.equal(forgedGate.decision, 'NO_GO');
  assert.equal(forgedGate.pipeline_decision, 'STOP_PIPELINE');
  assert.equal(forgedGate.consecutive_passing_runs, 0);
  assert.ok(forgedGate.runs.every((audit) => audit.passed === false));

  const validFixtureRoot = path.join(temporaryRoot, 'valid-five-run-fixture');
  fs.mkdirSync(validFixtureRoot);
  const fixture = createQworkGrayGateFixture({
    root: validFixtureRoot,
    repositoryRoot: root,
  });
  const go = evaluateCoreBetaGrayGate(fixture.runs);
  assert.equal(go.decision, 'GO_CONTROLLED_GRAY', go.failures.join(','));
  assert.equal(go.pipeline_decision, 'CONTINUE_CONTROLLED_GRAY');
  assert.equal(go.consecutive_passing_runs, 5);
  assert.equal(go.release_identity_stable, true);
  assert.equal(go.framework_commit_stable, true);
  assert.equal(go.casebook_stable, true);
  assert.equal(go.completion_times_strictly_increasing, true);
  assert.equal(go.provenance_unique, true);
  assert.equal(go.g3_equivalent_contract_stable, true);
  assert.equal(go.full_regression_passed, true);
  assert.equal(go.soak_passed, true);
  assert.ok(go.runs.every((audit) => audit.passed));

  const duplicateRunIdRoot = path.join(temporaryRoot, 'duplicate-run-id-fixture');
  fs.mkdirSync(duplicateRunIdRoot);
  const duplicateRunIdFixture = createQworkGrayGateFixture({
    root: duplicateRunIdRoot,
    repositoryRoot: root,
    targetRunIds: ['same-run-id', 'same-run-id'],
  });
  for (const index of [0, 1]) {
    const audit = auditCoreBetaRun(duplicateRunIdFixture.runs[index]);
    assert.equal(audit.passed, true, audit.failures.join(','));
  }
  assert.notEqual(
    duplicateRunIdFixture.runs[0].control_dir,
    duplicateRunIdFixture.runs[1].control_dir,
  );
  assert.notEqual(
    duplicateRunIdFixture.trees[0].stageArtifacts.G3.runDir,
    duplicateRunIdFixture.trees[1].stageArtifacts.G3.runDir,
  );
  const duplicateRunIdGate = evaluateCoreBetaGrayGate(duplicateRunIdFixture.runs);
  assert.equal(duplicateRunIdGate.decision, 'NO_GO');
  assert.equal(duplicateRunIdGate.pipeline_decision, 'STOP_PIPELINE');
  assert.ok(
    duplicateRunIdGate.failures.includes('reused_run_id'),
    duplicateRunIdGate.failures.join(','),
  );

  const duplicateReviewRoot = path.join(temporaryRoot, 'duplicate-review-sha-fixture');
  fs.mkdirSync(duplicateReviewRoot);
  const duplicateReviewFixture = createQworkGrayGateFixture({
    root: duplicateReviewRoot,
    repositoryRoot: root,
    targetTrustedReviewPayloadNonces: ['same-review-bytes', 'same-review-bytes'],
  });
  const duplicateReviewPaths = [0, 1].map(
    (index) => duplicateReviewFixture.trees[index].stageArtifacts.G3.trustedReviewPath,
  );
  const duplicateReviewStats = duplicateReviewPaths.map((reviewPath) => (
    fs.lstatSync(reviewPath, { bigint: true })
  ));
  assert.notEqual(duplicateReviewPaths[0], duplicateReviewPaths[1]);
  assert.notEqual(
    `${duplicateReviewStats[0].dev}:${duplicateReviewStats[0].ino}`,
    `${duplicateReviewStats[1].dev}:${duplicateReviewStats[1].ino}`,
  );
  assert.equal(sha256File(duplicateReviewPaths[0]), sha256File(duplicateReviewPaths[1]));
  for (const index of [0, 1]) {
    const audit = auditCoreBetaRun(duplicateReviewFixture.runs[index]);
    assert.equal(audit.passed, true, audit.failures.join(','));
  }
  const duplicateReviewGate = evaluateCoreBetaGrayGate(duplicateReviewFixture.runs);
  assert.equal(duplicateReviewGate.decision, 'NO_GO');
  assert.equal(duplicateReviewGate.pipeline_decision, 'STOP_PIPELINE');
  assert.ok(
    duplicateReviewGate.failures.includes('reused_trusted_review_sha256'),
    duplicateReviewGate.failures.join(','),
  );
  assert.equal(duplicateReviewGate.failures.includes('reused_trusted_review'), false);
  assert.equal(duplicateReviewGate.failures.includes('reused_trusted_review_inode'), false);

  const copiedRuns = fixture.runs.map((run) => structuredClone(run));
  copiedRuns[1] = structuredClone(copiedRuns[0]);
  const reused = evaluateCoreBetaGrayGate(copiedRuns);
  assert.equal(reused.decision, 'NO_GO');
  assert.equal(reused.pipeline_decision, 'STOP_PIPELINE');
  for (const failure of [
    'reused_run_id',
    'reused_control_dir',
    'reused_completion_event',
    'reused_completion_event_sha256',
    'reused_run_dir',
    'reused_trusted_review',
    'reused_trusted_review_sha256',
    'reused_evidence_tree_sha256',
    'reused_evidence_inode',
  ]) assert.ok(reused.failures.includes(failure), `${failure}: ${reused.failures.join(',')}`);

  const wrongSoakBinding = structuredClone(fixture.runs[4]);
  const g4ReviewPath = fixture.trees[4].stageArtifacts.G4.trustedReviewPath;
  wrongSoakBinding.soak_report = { path: g4ReviewPath, sha256: sha256File(g4ReviewPath) };
  const wrongSoakAudit = auditCoreBetaRun(wrongSoakBinding);
  assert.equal(wrongSoakAudit.passed, false);
  assert.ok(
    wrongSoakAudit.failures.some((failure) => failure.includes('soak_report_control_path_mismatch')),
    wrongSoakAudit.failures.join(','),
  );

  fs.appendFileSync(fixture.trees[0].events[0].path, ' ');
  const eventTamper = auditCoreBetaRun(fixture.runs[0]);
  assert.equal(eventTamper.passed, false);
  assert.ok(
    eventTamper.failures.some((failure) => failure.includes('event_hash_chain_mismatch')),
    eventTamper.failures.join(','),
  );

  fs.appendFileSync(fixture.trees[1].stageArtifacts.G3.trustedReviewPath, '\n');
  const reviewTamper = auditCoreBetaRun(fixture.runs[1]);
  assert.equal(reviewTamper.passed, false);
  assert.ok(
    reviewTamper.failures.some((failure) => failure.includes('sha256_mismatch')),
    reviewTamper.failures.join(','),
  );

  fs.appendFileSync(fixture.trees[2].stageArtifacts.G1.readiness.artifacts[0].path, '\n');
  const readinessTamper = auditCoreBetaRun(fixture.runs[2]);
  assert.equal(readinessTamper.passed, false);
  assert.ok(
    readinessTamper.failures.some((failure) => failure.includes('sha256_mismatch')),
    readinessTamper.failures.join(','),
  );

  fs.appendFileSync(fixture.trees[3].stageArtifacts.G3.markerFile, 'tampered\n');
  const evidenceTamper = auditCoreBetaRun(fixture.runs[3]);
  assert.equal(evidenceTamper.passed, false);
  assert.ok(
    evidenceTamper.failures.some((failure) => failure.includes('directory_sha256_mismatch')),
    evidenceTamper.failures.join(','),
  );

  fs.appendFileSync(
    path.join(fixture.trees[4].stageArtifacts.G4.runDir, 'automation-progress.json'),
    '\n',
  );
  const completionArtifactTamper = auditCoreBetaRun(fixture.runs[4]);
  assert.equal(completionArtifactTamper.passed, false);
  assert.ok(
    completionArtifactTamper.failures.some((failure) => failure.includes('sha256_mismatch')),
    completionArtifactTamper.failures.join(','),
  );

  const missingControl = grayRunBinding(path.join(temporaryRoot, 'missing-control'));
  const missingAudit = auditCoreBetaRun(missingControl);
  assert.equal(missingAudit.passed, false);
  assert.ok(missingAudit.failures.some((failure) => failure.includes('control_dir_missing')));

  const malformedControl = path.join(temporaryRoot, 'malformed-control');
  fs.mkdirSync(path.join(malformedControl, 'events'), { recursive: true });
  for (const name of [
    'release-test-plan.json',
    'release-test-state.json',
    'release-test-integrity.json',
  ]) fs.writeFileSync(path.join(malformedControl, name), '{}\n');
  fs.writeFileSync(path.join(malformedControl, 'unexpected.json'), '{}\n');
  const malformedAudit = auditCoreBetaRun(grayRunBinding(malformedControl));
  assert.equal(malformedAudit.passed, false);
  assert.ok(malformedAudit.failures.some((failure) => failure.includes('control_dir_layout_mismatch')));

  const symlinkControlTarget = path.join(temporaryRoot, 'control-target');
  fs.mkdirSync(symlinkControlTarget);
  const symlinkControl = path.join(temporaryRoot, 'control-link');
  fs.symlinkSync(symlinkControlTarget, symlinkControl);
  const symlinkAudit = auditCoreBetaRun(grayRunBinding(symlinkControl));
  assert.equal(symlinkAudit.passed, false);
  assert.ok(symlinkAudit.failures.some((failure) => failure.includes('control_dir_symlink')));

  const extraField = grayRunBinding(path.join(temporaryRoot, 'missing-extra'));
  extraField.total = 160;
  const extraFieldAudit = auditCoreBetaRun(extraField);
  assert.equal(extraFieldAudit.passed, false);
  assert.ok(extraFieldAudit.failures.some((failure) => failure.includes('run_fields_mismatch')));

  for (const [options, expectedFailure] of [
    [{ requiredConsecutiveRuns: 4 }, 'required_consecutive_runs_must_be_5'],
    [{ expectedCases: 69 }, 'fixed_case_policy_must_be_70_and_160'],
    [{ fullRegressionCases: 159 }, 'fixed_case_policy_must_be_70_and_160'],
    [{ minimumSoakTasks: 99 }, 'soak_policy_below_minimum'],
    [{ minimumSoakRestarts: 2 }, 'soak_policy_below_minimum'],
  ]) {
    const result = evaluateCoreBetaGrayGate([], options);
    assert.equal(result.decision, 'NO_GO');
    assert.equal(result.pipeline_decision, 'STOP_PIPELINE');
    assert.ok(result.failures.includes(expectedFailure));
  }

  const nonArray = evaluateCoreBetaGrayGate({ forged: true });
  assert.equal(nonArray.decision, 'NO_GO');
  assert.ok(nonArray.failures.includes('runs_must_be_array'));

  const invalidJson = path.join(temporaryRoot, 'invalid-runs.json');
  fs.writeFileSync(invalidJson, '{invalid json\n');
  const cli = spawnSync(process.execPath, [
    path.join(root, 'scripts', 'evaluate-core-beta-gray-gate.mjs'),
    invalidJson,
  ], { cwd: root, encoding: 'utf8' });
  assert.equal(cli.status, 1, cli.stderr || cli.stdout);
  const cliResult = JSON.parse(cli.stdout);
  assert.equal(cliResult.decision, 'NO_GO');
  assert.equal(cliResult.pipeline_decision, 'STOP_PIPELINE');
  assert.match(cliResult.failures.join(','), /runs_input_unreadable_or_invalid_json/);

  console.log('core-beta gray gate strict binding rejection ok');
} finally {
  fs.rmSync(temporaryRoot, { recursive: true, force: true });
}
