import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { DEFAULT_PRODUCTION_GATE_POLICY, evaluateProductionGate } from '../lib/production-gate.mjs';
import {
  LATEST_MAIN_BASELINE,
  PRODUCTION_CASEBOOK_CONTRACT_VERSION,
} from '../../src/lib/production-casebook-contract.mjs';

const ids = ['SIT-PROD-P0', 'SIT-PROD-P1'];
const allDomains = [
  'functional',
  'security_privacy',
  'reliability_recovery',
  'performance_capacity',
  'compatibility_upgrade',
  'data_integrity_isolation',
  'external_navigation',
  'release_rollback',
].join(',');

test('checked-in production policy stays synchronized with the code default', () => {
  const policy = JSON.parse(fs.readFileSync(new URL('../quality-gate/production-gate-policy.json', import.meta.url), 'utf8'));
  assert.deepEqual(policy, DEFAULT_PRODUCTION_GATE_POLICY);
});

function productionCase(id, priority) {
  return {
    id,
    priority,
    scenario: `${id} production gate fixture`,
    risk_domain: allDomains,
    oracle_type: 'UI+state+log+artifact-readback',
    deterministic: '是',
    repeat_policy: priority === 'P0' ? '5/5' : '3/3',
    required_fixture: 'controlled production-like fixture',
    hard_gate: '是',
    cleanup_policy: 'delete created task and files',
    version_scope: 'frozen RC only',
    production_signal: 'task_success_rate,error_rate',
    contract_version: PRODUCTION_CASEBOOK_CONTRACT_VERSION,
    product_baseline: `deepbankV2 origin/main@${LATEST_MAIN_BASELINE.commit}`,
    migration_disposition: 'retain_business_oracle',
    visible_action_contract: 'execute the numbered visible UI steps',
    state_readback_contract: 'UI plus independent public state readback',
    required_evidence_roles: 'case_report',
    forbidden_shortcuts: 'no bridge-only acceptance',
    selector_contract: 'stable testid or visible role only',
    identity_contract: 'freeze all release identity inputs',
    trusted_review_contract: 'independent evidence review required',
  };
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function sha256File(file) {
  return createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function fileEvidence(file) {
  const stat = fs.statSync(file);
  return {
    available: true,
    file,
    size: stat.size,
    mtime: stat.mtime.toISOString(),
    sha256: sha256File(file),
  };
}

function createRun(root, index, { drift = false, reviewStatus = '可信通过-用户可接受', missingMetadata = false } = {}) {
  const out = path.join(root, `run-${index}`);
  fs.mkdirSync(out, { recursive: true });
  const cases = [productionCase(ids[0], 'P0'), productionCase(ids[1], 'P1')];
  if (missingMetadata) cases[1].production_signal = '';
  const results = ids.map((id, order) => {
    const caseDir = path.join(out, 'cases', id);
    const caseReport = path.join(caseDir, 'case-report.md');
    fs.mkdirSync(caseDir, { recursive: true });
    fs.writeFileSync(caseReport, `${id} trusted evidence\n`);
    const evidenceManifest = path.join(caseDir, 'case-evidence-manifest.json');
    writeJson(evidenceManifest, {
      schema_version: 1,
      contract_version: PRODUCTION_CASEBOOK_CONTRACT_VERSION,
      case_id: id,
      complete: true,
      required_roles: ['case_report'],
      required_role_count: 1,
      satisfied_role_count: 1,
      missing_roles: [],
      role_evidence: { case_report: fileEvidence(caseReport) },
    });
    return {
      id,
      order: order + 1,
      status: 'passed',
      result_category: 'pass',
      case_dir: caseDir,
      artifacts: { evidence_manifest: evidenceManifest },
      evidence_manifest: {
        contract_version: PRODUCTION_CASEBOOK_CONTRACT_VERSION,
        complete: true,
        required_role_count: 1,
        satisfied_role_count: 1,
        missing_roles: [],
        manifest_sha256: sha256File(evidenceManifest),
      },
    };
  });
  writeJson(path.join(out, 'casebook-cases.json'), { selected_count: ids.length, cases });
  writeJson(path.join(out, 'automation-progress.json'), { completed: ids.length, total: ids.length, results });
  writeJson(path.join(out, 'automation-run-summary.json'), {
    status: 'passed',
    started_at: '2026-07-23T00:00:00.000Z',
    ended_at: '2026-07-23T00:01:00.000Z',
    counts: { total: ids.length, passed: ids.length, failed: 0, blocked: 0 },
    results,
  });
  const reviewItems = ids.map((id) => {
    const evidence = path.join(out, 'cases', id, 'case-report.md');
    return {
      id,
      review_category: id === ids[1] ? reviewStatus : '可信通过-用户可接受',
      reason: `${id} evidence independently matches the expected user outcome`,
      case_report: evidence,
    };
  });
  writeJson(path.join(out, '二次复核结构化结果.json'), {
    counts: { total: ids.length },
    items: reviewItems,
  });
  writeJson(path.join(out, 'run-metadata.json'), {
    schema_version: 2,
    host: { product: '360Teams', version: '9.9.9', build: '999', app_path: '/Applications/360Teams.app' },
    qwork: { version: '1.0.0', url: 'file:///tmp/qwork/1.0.0/index.html' },
    control_plane: { origin: 'https://control.example.test' },
    model_tier: 'M3',
    timeout_ms: 600000,
    artifacts: {
      algorithm: 'sha256',
      host_info_plist_sha256: 'a'.repeat(64),
      host_main_binary_sha256: 'b'.repeat(64),
      qwork_index_sha256: drift ? 'f'.repeat(64) : 'c'.repeat(64),
      qwork_install_metadata_sha256: 'd'.repeat(64),
      casebook_sha256: 'e'.repeat(64),
    },
    sources: {
      framework: { commit: '1'.repeat(40), dirty: false },
      deepbank: { commit: '2'.repeat(40), dirty: false },
    },
    release_inputs: {
      backend_version: 'backend-1',
      prompt_policy_version: 'prompt-1',
      feature_flags_hash: '3'.repeat(64),
      qwork_ui_git_commit: '4'.repeat(40),
      qwork_build_id: 'qwork-build-1',
      qwork_release_manifest_sha256: '5'.repeat(64),
    },
    selected_case_ids: ids,
  });
  return out;
}

function createTestPolicy(root) {
  const file = path.join(root, 'production-gate-test-policy.json');
  writeJson(file, { ...DEFAULT_PRODUCTION_GATE_POLICY, required_case_count: ids.length });
  return file;
}

function createCalibration(root, { falseNegative = false } = {}) {
  const file = path.join(root, 'calibration.json');
  const samples = [];
  for (let index = 0; index < 20; index += 1) {
    const p0 = index < 5;
    const evidence = path.join(root, 'fixtures', `bug-${index + 1}.json`);
    writeJson(evidence, { id: `BUG-${index + 1}`, injected: true });
    samples.push({
      id: `BUG-${String(index + 1).padStart(2, '0')}`,
      severity: p0 ? 'P0' : 'P1',
      expected_status: index % 2 ? 'framework_issue' : 'trusted_bug',
      actual_status: falseNegative && index === 0 ? 'trusted_pass' : index % 2 ? 'framework_issue' : 'trusted_bug',
      evidence: path.relative(root, evidence),
      evidence_sha256: createHash('sha256').update(fs.readFileSync(evidence)).digest('hex'),
    });
  }
  for (let index = 0; index < 10; index += 1) {
    const evidence = path.join(root, 'fixtures', `clean-${index + 1}.json`);
    writeJson(evidence, { id: `CLEAN-${index + 1}`, clean: true });
    samples.push({
      id: `CLEAN-${String(index + 1).padStart(2, '0')}`,
      severity: 'P1',
      expected_status: 'trusted_pass',
      actual_status: 'trusted_pass',
      evidence: path.relative(root, evidence),
      evidence_sha256: createHash('sha256').update(fs.readFileSync(evidence)).digest('hex'),
    });
  }
  writeJson(file, {
    schema_version: 1,
    generated_at: '2026-07-23T00:00:00.000Z',
    framework_commit: '1'.repeat(40),
    samples,
  });
  return file;
}

function createIndependentReview(root) {
  const file = path.join(root, 'independent-review.json');
  writeJson(file, {
    schema_version: 1,
    reviewer: 'independent-review-engine',
    reviewer_role: 'independent QA adjudicator',
    method: 'second_engine',
    independence_attestation: true,
    reviewed_at: '2026-07-23T00:00:00.000Z',
    results: [{ id: ids[0], classification: 'trusted_pass', evidence_checked: true, reason: 'Independent evidence chain agrees.' }],
  });
  return file;
}

test('production gate grants GO-CANARY only after five stable immutable runs and calibration', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'qbot-production-gate-pass-'));
  try {
    const runs = Array.from({ length: 5 }, (_, index) => createRun(root, index + 1));
    const result = evaluateProductionGate({
      runDirs: runs,
      policyPath: createTestPolicy(root),
      calibrationPath: createCalibration(root),
      independentReviewPath: createIndependentReview(root),
      reportOut: path.join(root, 'report'),
    });
    assert.equal(result.decision, 'GO-CANARY');
    assert.equal(result.full_production_release_allowed, false);
    assert.equal(result.counts.blockers, 0);
    assert.equal(result.stability.cases['SIT-PROD-P0'].trusted_pass, 5);
    assert.ok(fs.existsSync(result.files.json));
    assert.ok(fs.existsSync(result.files.html));
    assert.ok(fs.existsSync(result.files.manifest));
    const manifest = JSON.parse(fs.readFileSync(result.files.manifest, 'utf8'));
    assert.equal(manifest.runs.length, 5);
    assert.match(manifest.gate_inputs.calibration_sha256, /^[a-f0-9]{64}$/);
    assert.match(manifest.gate_inputs.independent_review_sha256, /^[a-f0-9]{64}$/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('production gate rejects insufficient P0 repetitions', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'qbot-production-gate-repeat-'));
  try {
    const runs = Array.from({ length: 3 }, (_, index) => createRun(root, index + 1));
    const result = evaluateProductionGate({
      runDirs: runs,
      policyPath: createTestPolicy(root),
      calibrationPath: createCalibration(root),
      independentReviewPath: createIndependentReview(root),
      reportOut: path.join(root, 'report'),
    });
    assert.equal(result.decision, 'NO-GO');
    assert.ok(result.blockers.some((item) => item.id === 'case_repetition_stability'));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('production gate rejects release artifact drift and a non-pass trusted result', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'qbot-production-gate-drift-'));
  try {
    const runs = Array.from({ length: 5 }, (_, index) => createRun(root, index + 1, {
      drift: index === 4,
      reviewStatus: index === 3 ? '可信失败-产品Bug候选' : '可信通过-用户可接受',
    }));
    const result = evaluateProductionGate({
      runDirs: runs,
      policyPath: createTestPolicy(root),
      calibrationPath: createCalibration(root),
      independentReviewPath: createIndependentReview(root),
      reportOut: path.join(root, 'report'),
    });
    assert.equal(result.decision, 'NO-GO');
    assert.ok(result.blockers.some((item) => /release_identity$/.test(item.id)));
    assert.ok(result.blockers.some((item) => /all_trusted_pass$/.test(item.id)));
    assert.ok(result.blockers.some((item) => item.id === 'flake_rate'));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('production gate rejects missing risk metadata and failed golden-defect calibration', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'qbot-production-gate-metadata-'));
  try {
    const runs = Array.from({ length: 5 }, (_, index) => createRun(root, index + 1, { missingMetadata: true }));
    const result = evaluateProductionGate({
      runDirs: runs,
      policyPath: createTestPolicy(root),
      calibrationPath: createCalibration(root, { falseNegative: true }),
      independentReviewPath: createIndependentReview(root),
      reportOut: path.join(root, 'report'),
    });
    assert.equal(result.decision, 'NO-GO');
    assert.ok(result.blockers.some((item) => item.id === 'case_metadata_complete'));
    assert.ok(result.blockers.some((item) => item.id === 'golden_defect_calibration'));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('production gate rejects a manifest that claims complete but contains tampered evidence', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'qbot-production-gate-tampered-evidence-'));
  try {
    const runs = Array.from({ length: 5 }, (_, index) => createRun(root, index + 1));
    fs.appendFileSync(path.join(runs[2], 'cases', ids[0], 'case-report.md'), 'tampered after manifest\n');
    const result = evaluateProductionGate({
      runDirs: runs,
      policyPath: createTestPolicy(root),
      calibrationPath: createCalibration(root),
      independentReviewPath: createIndependentReview(root),
      reportOut: path.join(root, 'report'),
    });
    assert.equal(result.decision, 'NO-GO');
    const blocker = result.blockers.find((item) => item.id.includes('case_evidence_manifests'));
    assert.ok(blocker);
    assert.match(blocker.detail, /case_report (?:size|sha256) mismatch/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('production gate rejects conflicting reviews and a dirty later framework round', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'qbot-production-gate-conflict-'));
  try {
    const runs = Array.from({ length: 5 }, (_, index) => createRun(root, index + 1));
    const conflictingItems = ids.map((id) => ({
      id,
      review_category: id === ids[0] ? '可信失败' : '可信通过-用户可接受',
      reason: `${id} deliberately conflicting adjudication`,
      case_report: path.join(runs[1], 'cases', id, 'case-report.md'),
    }));
    writeJson(path.join(runs[1], '可信二次复核结果.json'), { items: conflictingItems });
    const metadataFile = path.join(runs[4], 'run-metadata.json');
    const metadata = JSON.parse(fs.readFileSync(metadataFile, 'utf8'));
    metadata.sources.framework.dirty = true;
    writeJson(metadataFile, metadata);
    const result = evaluateProductionGate({
      runDirs: runs,
      policyPath: createTestPolicy(root),
      calibrationPath: createCalibration(root),
      independentReviewPath: createIndependentReview(root),
      reportOut: path.join(root, 'report'),
    });
    assert.equal(result.decision, 'NO-GO');
    assert.ok(result.blockers.some((item) => item.id.startsWith('review_consistency_')));
    assert.ok(result.blockers.some((item) => item.id.includes('framework_clean')));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
