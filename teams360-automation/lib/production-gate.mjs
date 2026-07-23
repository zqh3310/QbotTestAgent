import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

export const DEFAULT_PRODUCTION_GATE_POLICY = Object.freeze({
  schema_version: 1,
  gate_name: 'QBot Teams-QWork production release gate',
  required_run_count: 5,
  required_repetitions_by_priority: { P0: 5, P1: 3 },
  maximum_flake_rate: 0.01,
  require_all_trusted_pass: true,
  require_raw_pass: true,
  require_explicit_case_metadata: true,
  required_risk_domains: [
    'functional',
    'security_privacy',
    'reliability_recovery',
    'performance_capacity',
    'compatibility_upgrade',
    'data_integrity_isolation',
    'external_navigation',
    'release_rollback',
  ],
  required_artifact_fingerprints: [
    'host_info_plist_sha256',
    'host_main_binary_sha256',
    'qwork_index_sha256',
    'qwork_install_metadata_sha256',
    'casebook_sha256',
  ],
  required_release_inputs: [
    'backend_version',
    'prompt_policy_version',
    'feature_flags_hash',
  ],
  require_framework_commit: true,
  require_clean_framework_source: true,
  require_deepbank_commit: true,
  require_clean_deepbank_source: false,
  require_calibration: true,
  calibration: {
    minimum_samples: 30,
    minimum_defect_samples: 20,
    minimum_p0_samples: 5,
    minimum_clean_samples: 5,
    minimum_detection_rate: 0.95,
    required_p0_detection_rate: 1,
    minimum_classification_accuracy: 0.95,
    maximum_false_positive_rate: 0.02,
  },
  require_independent_review: true,
  independent_review: {
    require_all_p0: true,
    trusted_pass_sample_rate: 0.2,
  },
});

const REVIEW_FILES = [
  '可信二次复核结果.json',
  '二次复核结构化结果.json',
  '可信终审报告.json',
];

const NON_PASS_STATUSES = new Set([
  'trusted_bug',
  'trusted_failure',
  'trusted_blocked',
  'framework_issue',
  'testcase_issue',
  'needs_review',
]);

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function sha256File(file) {
  const hash = createHash('sha256');
  hash.update(fs.readFileSync(file));
  return hash.digest('hex');
}

function sha256Text(value) {
  return createHash('sha256').update(String(value || '')).digest('hex');
}

function getPath(value, dotted) {
  return dotted.split('.').reduce((current, key) => current?.[key], value);
}

function compact(value, max = 220) {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim();
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

function mapReviewCategory(value) {
  const category = String(value || '');
  if (category === 'trusted_pass' || category.startsWith('可信通过')) return 'trusted_pass';
  if (category === 'trusted_bug' || category.includes('产品Bug候选') || category.includes('可信 Bug')) return 'trusted_bug';
  if (category === 'trusted_blocked' || category.startsWith('可信阻塞')) return 'trusted_blocked';
  if (category === 'framework_issue' || category.includes('框架问题')) return 'framework_issue';
  if (category === 'testcase_issue' || category.includes('用例问题') || category.includes('case需优化')) return 'testcase_issue';
  if (category === 'trusted_failure' || category.startsWith('可信失败')) return 'trusted_failure';
  return 'needs_review';
}

function isRecognizedReviewCategory(value, { allowNeedsReview = false } = {}) {
  const mapped = mapReviewCategory(value);
  if (mapped !== 'needs_review') return true;
  return allowNeedsReview && /^(needs_review|待复核)$/i.test(String(value || '').trim());
}

function parseReviewFile(file) {
  const parsed = readJson(file);
  const source = Array.isArray(parsed.results) ? parsed.results : Array.isArray(parsed.items) ? parsed.items : [];
  const items = source.map((item) => ({
    id: String(item.id || '').trim(),
    status: mapReviewCategory(item.trusted_status || item.final_category || item.review_category || item.classification),
    reason: item.reason || item.user_view_conclusion || '',
    evidence: item.case_report || item.key_screenshot || '',
  })).filter((item) => item.id);
  return { file, items, parsed };
}

function reviewSignature(items) {
  return items.map((item) => `${item.id}:${item.status}`).sort();
}

function resolveReview(outDir) {
  const candidates = [];
  for (const name of REVIEW_FILES) {
    const file = path.join(outDir, name);
    if (!fs.existsSync(file)) continue;
    candidates.push(parseReviewFile(file));
  }
  if (!candidates.length) return { file: '', items: [], parsed: null, candidates: [], conflicts: [] };
  const baseline = candidates[0];
  const signature = reviewSignature(baseline.items);
  const conflicts = candidates.slice(1)
    .filter((candidate) => !sameJson(reviewSignature(candidate.items), signature))
    .map((candidate) => candidate.file);
  return { ...baseline, candidates: candidates.map((item) => item.file), conflicts };
}

function normalizeDomain(value) {
  const aliases = new Map([
    ['功能', 'functional'],
    ['安全', 'security_privacy'],
    ['安全隐私', 'security_privacy'],
    ['可靠性', 'reliability_recovery'],
    ['稳定性', 'reliability_recovery'],
    ['恢复', 'reliability_recovery'],
    ['性能', 'performance_capacity'],
    ['容量', 'performance_capacity'],
    ['兼容', 'compatibility_upgrade'],
    ['升级', 'compatibility_upgrade'],
    ['数据', 'data_integrity_isolation'],
    ['隔离', 'data_integrity_isolation'],
    ['外链', 'external_navigation'],
    ['webview', 'external_navigation'],
    ['发布', 'release_rollback'],
    ['回滚', 'release_rollback'],
  ]);
  const normalized = String(value || '').trim().toLowerCase().replace(/[\s/-]+/g, '_');
  return aliases.get(normalized) || normalized;
}

function domainsFor(testCase) {
  return String(testCase.risk_domain || '')
    .split(/[,，;；|、\n]+/)
    .map(normalizeDomain)
    .filter(Boolean);
}

function releaseIdentity(metadata) {
  return {
    host: {
      product: metadata?.host?.product || '',
      version: metadata?.host?.version || '',
      build: metadata?.host?.build || '',
    },
    qwork: {
      version: metadata?.qwork?.version || '',
      url: metadata?.qwork?.url || '',
    },
    control_plane: metadata?.control_plane?.origin || '',
    model_tier: metadata?.model_tier || '',
    timeout_ms: Number(metadata?.timeout_ms || 0),
    artifacts: metadata?.artifacts || {},
    release_inputs: metadata?.release_inputs || {},
    framework_commit: metadata?.sources?.framework?.commit || '',
    framework_dirty: metadata?.sources?.framework?.dirty,
    deepbank_commit: metadata?.sources?.deepbank?.commit || '',
    deepbank_dirty: metadata?.sources?.deepbank?.dirty,
    selected_case_ids: [...new Set(metadata?.selected_case_ids || [])].sort(),
  };
}

function sameJson(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function createGateCollector() {
  const checks = [];
  const add = (id, passed, detail, severity = 'blocker') => {
    checks.push({ id, status: passed ? 'passed' : severity, detail: compact(detail, 600) });
    return passed;
  };
  return { checks, add };
}

function validateCaseMetadata(cases, policy, add) {
  if (!policy.require_explicit_case_metadata) return;
  const required = [
    'risk_domain',
    'oracle_type',
    'deterministic',
    'repeat_policy',
    'required_fixture',
    'hard_gate',
    'cleanup_policy',
    'version_scope',
    'production_signal',
  ];
  const missing = [];
  const invalid = [];
  for (const testCase of cases) {
    const absent = required.filter((field) => !String(testCase[field] || '').trim());
    if (absent.length) missing.push(`${testCase.id}:${absent.join(',')}`);
    if (testCase.deterministic && !/^(是|否|true|false|yes|no|deterministic|stochastic)$/i.test(String(testCase.deterministic).trim())) {
      invalid.push(`${testCase.id}:deterministic=${testCase.deterministic}`);
    }
    if (testCase.repeat_policy && !/\d+/.test(String(testCase.repeat_policy))) {
      invalid.push(`${testCase.id}:repeat_policy=${testCase.repeat_policy}`);
    }
  }
  add('case_metadata_complete', missing.length === 0,
    missing.length ? `${missing.length}/${cases.length} Case 缺少生产风险元数据：${missing.slice(0, 12).join('；')}` : `${cases.length} Case 生产风险元数据完整。`);
  add('case_metadata_values_valid', invalid.length === 0,
    invalid.length ? `${invalid.length} 项生产元数据格式无效：${invalid.slice(0, 12).join('；')}` : 'deterministic 与 repeat_policy 均为可执行格式。');

  const covered = new Set(cases.flatMap(domainsFor));
  const missingDomains = (policy.required_risk_domains || []).filter((domain) => !covered.has(normalizeDomain(domain)));
  add('risk_domains_covered', missingDomains.length === 0,
    missingDomains.length ? `缺少风险域：${missingDomains.join(', ')}` : `风险域覆盖：${[...covered].sort().join(', ')}`);
  const domainsWithoutHardGate = (policy.required_risk_domains || []).filter((domain) => {
    const normalized = normalizeDomain(domain);
    return !cases.some((testCase) => domainsFor(testCase).includes(normalized) && /^(是|true|yes|p0|阻断上线)$/i.test(String(testCase.hard_gate || '').trim()));
  });
  add('risk_domains_have_hard_gate', domainsWithoutHardGate.length === 0,
    domainsWithoutHardGate.length ? `这些风险域没有明确的一票否决 Case：${domainsWithoutHardGate.join(', ')}` : '所有必需风险域均至少有一条明确硬门禁 Case。');
}

function validateCalibration(calibrationFile, policy, add) {
  if (!calibrationFile) {
    add('golden_defect_calibration', !policy.require_calibration,
      policy.require_calibration ? '缺少黄金缺陷集校准结果。' : '策略未要求黄金缺陷集校准。');
    return null;
  }
  if (!fs.existsSync(calibrationFile)) {
    add('golden_defect_calibration', false, `黄金缺陷集校准文件不存在：${calibrationFile}`);
    return null;
  }
  const parsed = readJson(calibrationFile);
  const samples = Array.isArray(parsed.samples) ? parsed.samples : [];
  const defectSamples = samples.filter((item) => mapReviewCategory(item.expected_status) !== 'trusted_pass');
  const detected = defectSamples.filter((item) => mapReviewCategory(item.actual_status) !== 'trusted_pass');
  const p0 = defectSamples.filter((item) => String(item.severity || '').toUpperCase() === 'P0');
  const p0Detected = p0.filter((item) => mapReviewCategory(item.actual_status) !== 'trusted_pass');
  const correct = samples.filter((item) => mapReviewCategory(item.expected_status) === mapReviewCategory(item.actual_status));
  const clean = samples.filter((item) => mapReviewCategory(item.expected_status) === 'trusted_pass');
  const falsePositive = clean.filter((item) => mapReviewCategory(item.actual_status) !== 'trusted_pass');
  const metrics = {
    samples: samples.length,
    defect_samples: defectSamples.length,
    detection_rate: defectSamples.length ? detected.length / defectSamples.length : 0,
    p0_detection_rate: p0.length ? p0Detected.length / p0.length : 0,
    classification_accuracy: samples.length ? correct.length / samples.length : 0,
    false_positive_rate: clean.length ? falsePositive.length / clean.length : 0,
  };
  const target = policy.calibration || {};
  const calibrationDir = path.dirname(calibrationFile);
  const malformed = samples.filter((item) => !String(item.id || '').trim()
    || !String(item.expected_status || '').trim()
    || !String(item.actual_status || '').trim()
    || !String(item.evidence || '').trim()
    || !isRecognizedReviewCategory(item.expected_status)
    || !isRecognizedReviewCategory(item.actual_status, { allowNeedsReview: true }));
  const invalidEvidence = samples.filter((item) => {
    const evidence = String(item.evidence || '').trim();
    const evidenceFile = path.isAbsolute(evidence) ? evidence : path.resolve(calibrationDir, evidence);
    const expectedHash = String(item.evidence_sha256 || '').trim();
    return !evidence
      || !fs.existsSync(evidenceFile)
      || !/^[a-f0-9]{64}$/i.test(expectedHash)
      || sha256File(evidenceFile) !== expectedHash;
  });
  const duplicateIds = samples.map((item) => String(item.id || '')).filter((id, index, values) => id && values.indexOf(id) !== index);
  const frameworkCommitMatches = String(parsed.framework_commit || '').trim()
    && String(parsed.framework_commit || '').trim() === String(policy.__framework_commit || '').trim();
  const generatedAtValid = !Number.isNaN(Date.parse(String(parsed.generated_at || '')));
  const ok = generatedAtValid
    && samples.length >= Number(target.minimum_samples || 1)
    && defectSamples.length >= Number(target.minimum_defect_samples || 1)
    && p0.length >= Number(target.minimum_p0_samples || 1)
    && clean.length >= Number(target.minimum_clean_samples || 1)
    && malformed.length === 0
    && invalidEvidence.length === 0
    && duplicateIds.length === 0
    && frameworkCommitMatches
    && metrics.detection_rate >= Number(target.minimum_detection_rate || 0)
    && metrics.p0_detection_rate >= Number(target.required_p0_detection_rate || 0)
    && metrics.classification_accuracy >= Number(target.minimum_classification_accuracy || 0)
    && metrics.false_positive_rate <= Number(target.maximum_false_positive_rate ?? 1);
  add('golden_defect_calibration', ok,
    `generated_at_valid=${generatedAtValid} samples=${metrics.samples}/${target.minimum_samples} defects=${metrics.defect_samples}/${target.minimum_defect_samples} P0_samples=${p0.length}/${target.minimum_p0_samples} clean=${clean.length}/${target.minimum_clean_samples} detection=${(metrics.detection_rate * 100).toFixed(2)}% P0=${(metrics.p0_detection_rate * 100).toFixed(2)}% accuracy=${(metrics.classification_accuracy * 100).toFixed(2)}% false_positive=${(metrics.false_positive_rate * 100).toFixed(2)}% malformed=${malformed.length} invalid_evidence=${invalidEvidence.length} duplicate=${duplicateIds.length} framework_commit_match=${Boolean(frameworkCommitMatches)}`);
  return metrics;
}

function validateIndependentReview(file, baselineCases, latestStatuses, policy, add) {
  if (!file) {
    add('independent_review', !policy.require_independent_review,
      policy.require_independent_review ? '缺少独立复核结果。' : '策略未要求独立复核。');
    return null;
  }
  if (!fs.existsSync(file)) {
    add('independent_review', false, `独立复核文件不存在：${file}`);
    return null;
  }
  const parsed = readJson(file);
  const results = Array.isArray(parsed.results) ? parsed.results : [];
  const byId = new Map(results.map((item) => [String(item.id || '').trim(), item]));
  const p0 = baselineCases.filter((item) => String(item.priority || '').toUpperCase() === 'P0');
  const trustedPass = baselineCases.filter((item) => latestStatuses.get(item.id) === 'trusted_pass');
  const sampleTarget = Math.ceil(trustedPass.length * Number(policy.independent_review?.trusted_pass_sample_rate || 0));
  const reviewedPass = trustedPass.filter((item) => byId.has(item.id));
  const missingP0 = policy.independent_review?.require_all_p0
    ? p0.filter((item) => !byId.has(item.id)).map((item) => item.id)
    : [];
  const disagreements = results.filter((item) => latestStatuses.has(item.id)
    && mapReviewCategory(item.classification || item.trusted_status) !== latestStatuses.get(item.id));
  const incompleteEvidence = results.filter((item) => item.evidence_checked !== true || !String(item.reason || '').trim());
  const reviewedAtValid = !Number.isNaN(Date.parse(String(parsed.reviewed_at || '')));
  const validMethod = /^(human|second_engine|human_plus_engine|人工|第二引擎|人工\+第二引擎)$/i.test(String(parsed.method || '').trim());
  const ok = Boolean(String(parsed.reviewer || '').trim())
    && Boolean(String(parsed.reviewer_role || '').trim())
    && parsed.independence_attestation === true
    && reviewedAtValid
    && validMethod
    && missingP0.length === 0
    && reviewedPass.length >= sampleTarget
    && disagreements.length === 0
    && incompleteEvidence.length === 0;
  add('independent_review', ok,
    `reviewer=${parsed.reviewer || 'missing'} role=${parsed.reviewer_role || 'missing'} method=${parsed.method || 'missing'} independent=${parsed.independence_attestation === true} reviewed_at_valid=${reviewedAtValid} reviewed=${results.length} P0_missing=${missingP0.length} trusted_pass_sample=${reviewedPass.length}/${sampleTarget} disagreements=${disagreements.length} incomplete_evidence=${incompleteEvidence.length}`);
  return { reviewed: results.length, missing_p0: missingP0, disagreements: disagreements.map((item) => item.id), incomplete_evidence: incompleteEvidence.map((item) => item.id), pass_sample: reviewedPass.length, pass_sample_target: sampleTarget };
}

function loadRun(outDir, add) {
  const directory = path.resolve(outDir);
  const summaryFile = path.join(directory, 'automation-run-summary.json');
  const progressFile = path.join(directory, 'automation-progress.json');
  const metadataFile = path.join(directory, 'run-metadata.json');
  const casesFile = path.join(directory, 'casebook-cases.json');
  for (const file of [summaryFile, progressFile, metadataFile, casesFile]) {
    add(`input_${path.basename(file)}_${path.basename(directory)}`, fs.existsSync(file), fs.existsSync(file) ? file : `缺少 ${file}`);
  }
  if (![summaryFile, progressFile, metadataFile, casesFile].every(fs.existsSync)) return null;
  const summary = readJson(summaryFile);
  const progress = readJson(progressFile);
  const metadata = readJson(metadataFile);
  const casePlan = readJson(casesFile);
  const review = resolveReview(directory);
  add(`input_review_${path.basename(directory)}`, Boolean(review.file), review.file || '缺少可信二次复核结构化结果。');
  add(`review_consistency_${path.basename(directory)}`, review.conflicts.length === 0,
    review.conflicts.length ? `多份可信复核报告结论冲突：${review.candidates.join(', ')}` : `复核报告一致性通过，共 ${review.candidates.length} 份。`);
  return {
    outDir: directory,
    files: { summaryFile, progressFile, metadataFile, casesFile, reviewFile: review.file },
    summary,
    progress,
    metadata,
    casePlan,
    review,
  };
}

function buildQaManifest(runs, policy, { policyPath = '', calibrationPath = '', independentReviewPath = '' } = {}) {
  const identity = releaseIdentity(runs[0]?.metadata);
  const inputHash = (file) => file && fs.existsSync(file) ? sha256File(file) : '';
  return {
    schema_version: 1,
    generated_at: new Date().toISOString(),
    gate_policy: policy.gate_name,
    release_identity: identity,
    gate_inputs: {
      policy_sha256: policyPath && fs.existsSync(policyPath) ? sha256File(policyPath) : sha256Text(JSON.stringify(policy)),
      calibration_sha256: inputHash(calibrationPath),
      independent_review_sha256: inputHash(independentReviewPath),
    },
    runs: runs.map((run) => ({
      source_run: run.outDir,
      case_count: (run.casePlan.cases || []).length,
      case_plan_sha256: sha256File(run.files.casesFile),
      run_metadata_sha256: sha256File(run.files.metadataFile),
      summary_sha256: sha256File(run.files.summaryFile),
      progress_sha256: sha256File(run.files.progressFile),
      review_sha256: inputHash(run.files.reviewFile),
    })),
  };
}

export function evaluateProductionGate({
  runDirs = [],
  policyPath = '',
  calibrationPath = '',
  independentReviewPath = '',
  reportOut = '',
} = {}) {
  const policy = policyPath ? { ...DEFAULT_PRODUCTION_GATE_POLICY, ...readJson(path.resolve(policyPath)) } : { ...DEFAULT_PRODUCTION_GATE_POLICY };
  policy.required_repetitions_by_priority = {
    ...DEFAULT_PRODUCTION_GATE_POLICY.required_repetitions_by_priority,
    ...(policy.required_repetitions_by_priority || {}),
  };
  policy.calibration = { ...DEFAULT_PRODUCTION_GATE_POLICY.calibration, ...(policy.calibration || {}) };
  policy.independent_review = { ...DEFAULT_PRODUCTION_GATE_POLICY.independent_review, ...(policy.independent_review || {}) };
  const { checks, add } = createGateCollector();
  const uniqueRunDirs = [...new Set(runDirs.map((item) => path.resolve(String(item || ''))).filter(Boolean))];
  add('minimum_run_count', uniqueRunDirs.length >= Number(policy.required_run_count || 1),
    `提供 ${uniqueRunDirs.length} 轮，策略要求至少 ${policy.required_run_count} 轮。`);
  const runs = uniqueRunDirs.map((dir) => loadRun(dir, add)).filter(Boolean);
  if (!runs.length) {
    return finalizeGate({ policy, checks, runs: [], calibration: null, independentReview: null, reportOut });
  }

  const baseline = runs[0];
  const baselineCases = baseline.casePlan.cases || [];
  const baselineIds = baselineCases.map((item) => String(item.id || '')).filter(Boolean);
  add('case_ids_unique', baselineIds.length > 0 && new Set(baselineIds).size === baselineIds.length,
    `baseline cases=${baselineIds.length} unique=${new Set(baselineIds).size}`);
  validateCaseMetadata(baselineCases, policy, add);

  const referenceIdentity = releaseIdentity(baseline.metadata);
  const repetitions = new Map(baselineIds.map((id) => [id, { total: 0, trusted_pass: 0, statuses: [] }]));
  const latestStatuses = new Map();
  let totalOutcomes = 0;
  let nonPassOutcomes = 0;
  for (const [index, run] of runs.entries()) {
    const label = `run_${index + 1}_${path.basename(run.outDir)}`;
    const cases = run.casePlan.cases || [];
    const ids = cases.map((item) => String(item.id || '')).filter(Boolean);
    const summaryIds = (run.summary.results || []).map((item) => String(item.id || '')).filter(Boolean);
    const progressIds = (run.progress.results || []).map((item) => String(item.id || '')).filter(Boolean);
    const reviewIds = run.review.items.map((item) => item.id);
    const expected = [...baselineIds].sort();
    add(`${label}_release_identity`, sameJson(releaseIdentity(run.metadata), referenceIdentity),
      sameJson(releaseIdentity(run.metadata), referenceIdentity) ? '发布候选身份与基线一致。' : '发布候选身份、Case 集或内容哈希发生漂移。');
    add(`${label}_case_set`, sameJson([...ids].sort(), expected), `case_plan=${ids.length} baseline=${expected.length}`);
    const summaryIsTerminal = Boolean(run.summary.ended_at)
      && !run.summary.synthetic
      && !run.summary.recovering
      && !run.summary.aborted
      && !['aborted', 'interrupted', 'recovering', 'stopped'].includes(String(run.summary.status || '').toLowerCase());
    add(`${label}_summary_complete`, summaryIsTerminal
      && Number(run.summary.counts?.total || 0) === expected.length
      && summaryIds.length === expected.length
      && sameJson([...summaryIds].sort(), expected),
    `status=${run.summary.status} ended_at=${run.summary.ended_at || 'missing'} synthetic=${Boolean(run.summary.synthetic)} recovering=${Boolean(run.summary.recovering)} aborted=${Boolean(run.summary.aborted)} summary=${summaryIds.length}/${expected.length}`);
    add(`${label}_progress_complete`, Number(run.progress.completed || 0) === expected.length
      && Number(run.progress.total || 0) === expected.length
      && progressIds.length === expected.length
      && !run.progress.recovering && !run.progress.synthetic && !run.progress.aborted,
    `completed=${run.progress.completed}/${run.progress.total} recovering=${Boolean(run.progress.recovering)} synthetic=${Boolean(run.progress.synthetic)} aborted=${Boolean(run.progress.aborted)}`);
    add(`${label}_review_complete`, reviewIds.length === expected.length && sameJson([...reviewIds].sort(), expected),
      `review=${reviewIds.length}/${expected.length}`);
    const invalidReviewEvidence = run.review.items.filter((item) => {
      const evidence = String(item.evidence || '').trim();
      const evidenceFile = path.isAbsolute(evidence) ? evidence : path.resolve(run.outDir, evidence);
      return !String(item.reason || '').trim()
        || !evidence
        || !fs.existsSync(evidenceFile)
        || !evidence.includes(item.id);
    });
    add(`${label}_review_evidence`, invalidReviewEvidence.length === 0,
      invalidReviewEvidence.length ? `${invalidReviewEvidence.length} 条可信结论缺少本 Case 可回读证据或具体理由：${invalidReviewEvidence.slice(0, 20).map((item) => item.id).join(', ')}` : `${run.review.items.length}/${expected.length} 条可信结论均可回读本 Case 证据。`);
    add(`${label}_framework_clean`, !policy.require_clean_framework_source || run.metadata?.sources?.framework?.dirty === false,
      `framework dirty=${String(run.metadata?.sources?.framework?.dirty)}`);
    add(`${label}_deepbank_clean`, !policy.require_clean_deepbank_source || run.metadata?.sources?.deepbank?.dirty === false,
      `deepbank dirty=${String(run.metadata?.sources?.deepbank?.dirty)}`);
    if (policy.require_raw_pass) {
      add(`${label}_raw_pass`, run.summary.status === 'passed'
        && Number(run.summary.counts?.passed || 0) === expected.length,
      `status=${run.summary.status} passed=${run.summary.counts?.passed || 0}/${expected.length}`);
    }
    const byReview = new Map(run.review.items.map((item) => [item.id, item.status]));
    const nonPass = expected.filter((id) => byReview.get(id) !== 'trusted_pass');
    add(`${label}_all_trusted_pass`, !policy.require_all_trusted_pass || nonPass.length === 0,
      nonPass.length ? `${nonPass.length} 条非可信通过：${nonPass.slice(0, 20).map((id) => `${id}:${byReview.get(id) || 'missing'}`).join(', ')}` : `${expected.length}/${expected.length} 可信通过。`);
    for (const id of expected) {
      const status = byReview.get(id) || 'needs_review';
      const item = repetitions.get(id) || { total: 0, trusted_pass: 0, statuses: [] };
      item.total += 1;
      item.statuses.push(status);
      if (status === 'trusted_pass') item.trusted_pass += 1;
      repetitions.set(id, item);
      latestStatuses.set(id, status);
      totalOutcomes += 1;
      if (status !== 'trusted_pass') nonPassOutcomes += 1;
    }
  }

  for (const field of policy.required_artifact_fingerprints || []) {
    add(`artifact_${field}`, /^[a-f0-9]{64}$/i.test(String(referenceIdentity.artifacts?.[field] || '')),
      referenceIdentity.artifacts?.[field] ? `${field}=${referenceIdentity.artifacts[field]}` : `缺少发布物内容指纹 ${field}`);
  }
  for (const field of policy.required_release_inputs || []) {
    const value = String(referenceIdentity.release_inputs?.[field] || '');
    const valid = field.endsWith('_hash') ? /^[a-f0-9]{64}$/i.test(value) : Boolean(value.trim());
    add(`release_input_${field}`, valid,
      referenceIdentity.release_inputs?.[field] ? `${field}=${referenceIdentity.release_inputs[field]}` : `缺少开发/发布侧输入 ${field}`);
  }
  add('framework_commit', !policy.require_framework_commit || /^[a-f0-9]{7,64}$/i.test(referenceIdentity.framework_commit),
    referenceIdentity.framework_commit || '缺少自动化框架 commit。');
  add('framework_clean', !policy.require_clean_framework_source || baseline.metadata?.sources?.framework?.dirty === false,
    `framework dirty=${String(baseline.metadata?.sources?.framework?.dirty)}`);
  add('deepbank_commit', !policy.require_deepbank_commit || /^[a-f0-9]{7,64}$/i.test(referenceIdentity.deepbank_commit),
    referenceIdentity.deepbank_commit || '缺少 deepbankV2/fixture commit。');
  add('deepbank_clean', !policy.require_clean_deepbank_source || baseline.metadata?.sources?.deepbank?.dirty === false,
    `deepbank dirty=${String(baseline.metadata?.sources?.deepbank?.dirty)}`);

  const priorityById = new Map(baselineCases.map((item) => [item.id, String(item.priority || 'P1').toUpperCase()]));
  const insufficient = [];
  for (const [id, item] of repetitions) {
    const priority = priorityById.get(id) || 'P1';
    const required = Number(policy.required_repetitions_by_priority?.[priority] || policy.required_run_count || 1);
    if (item.trusted_pass < required) insufficient.push(`${id}:${item.trusted_pass}/${required}`);
  }
  add('case_repetition_stability', insufficient.length === 0,
    insufficient.length ? `${insufficient.length} 条重复次数不足或非全绿：${insufficient.slice(0, 24).join(', ')}` : '所有 Case 达到按优先级要求的可信通过重复次数。');
  const flakeRate = totalOutcomes ? nonPassOutcomes / totalOutcomes : 1;
  add('flake_rate', flakeRate <= Number(policy.maximum_flake_rate ?? 0),
    `non_pass=${nonPassOutcomes}/${totalOutcomes} flake_rate=${(flakeRate * 100).toFixed(3)}% threshold=${(Number(policy.maximum_flake_rate || 0) * 100).toFixed(3)}%`);

  policy.__framework_commit = referenceIdentity.framework_commit;
  const calibration = validateCalibration(calibrationPath ? path.resolve(calibrationPath) : '', policy, add);
  delete policy.__framework_commit;
  const independentReview = validateIndependentReview(
    independentReviewPath ? path.resolve(independentReviewPath) : '',
    baselineCases,
    latestStatuses,
    policy,
    add,
  );
  const manifest = buildQaManifest(runs, policy, {
    policyPath: policyPath ? path.resolve(policyPath) : '',
    calibrationPath: calibrationPath ? path.resolve(calibrationPath) : '',
    independentReviewPath: independentReviewPath ? path.resolve(independentReviewPath) : '',
  });
  return finalizeGate({ policy, checks, runs, calibration, independentReview, reportOut, manifest, flakeRate, repetitions });
}

function finalizeGate({ policy, checks, runs, calibration, independentReview, reportOut, manifest = null, flakeRate = 1, repetitions = new Map() }) {
  const blockers = checks.filter((item) => item.status === 'blocker');
  const warnings = checks.filter((item) => item.status === 'warning');
  const decision = blockers.length ? 'NO-GO' : 'GO-CANARY';
  const payload = {
    schema_version: 1,
    generated_at: new Date().toISOString(),
    decision,
    full_production_release_allowed: false,
    next_stage: decision === 'GO-CANARY'
      ? '仅允许进入受控生产灰度；灰度指标与回滚验证通过后由发布系统决定逐步放量。'
      : '修复全部 blocker 后，使用同一不可变发布候选版本重新执行。',
    policy,
    counts: { checks: checks.length, passed: checks.filter((item) => item.status === 'passed').length, blockers: blockers.length, warnings: warnings.length },
    run_dirs: runs.map((item) => item.outDir),
    release_candidate_manifest: manifest,
    stability: {
      run_count: runs.length,
      flake_rate: flakeRate,
      cases: Object.fromEntries([...repetitions.entries()]),
    },
    calibration,
    independent_review: independentReview,
    checks,
    blockers,
    warnings,
  };
  const destination = path.resolve(reportOut || runs.at(-1)?.outDir || process.cwd());
  fs.mkdirSync(destination, { recursive: true });
  const json = path.join(destination, 'production-quality-gate.json');
  const markdown = path.join(destination, 'production-quality-gate.md');
  const html = path.join(destination, 'production-quality-gate.html');
  const manifestFile = path.join(destination, 'qa-release-candidate-manifest.json');
  fs.writeFileSync(json, `${JSON.stringify(payload, null, 2)}\n`);
  if (manifest) fs.writeFileSync(manifestFile, `${JSON.stringify(manifest, null, 2)}\n`);
  fs.writeFileSync(markdown, renderMarkdown(payload));
  fs.writeFileSync(html, renderHtml(payload));
  return { ...payload, files: { json, markdown, html, manifest: manifest ? manifestFile : '' } };
}

function renderMarkdown(gate) {
  const lines = [
    '# QBot Teams-QWork 生产质量门禁',
    '',
    `- 决策：**${gate.decision}**`,
    `- 全量生产放行：否（${gate.next_stage}）`,
    `- 检查：${gate.counts.passed}/${gate.counts.checks} 通过；${gate.counts.blockers} blocker；${gate.counts.warnings} warning`,
    `- 执行轮数：${gate.stability.run_count}`,
    `- Flaky/非可信通过比例：${(gate.stability.flake_rate * 100).toFixed(3)}%`,
    '',
    '## 硬门禁检查',
    '',
    '| 检查 | 状态 | 说明 |',
    '|---|---|---|',
    ...gate.checks.map((item) => `| ${item.id} | ${item.status} | ${String(item.detail || '').replaceAll('|', '\\|')} |`),
    '',
    '## 结论',
    '',
    gate.next_stage,
    '',
  ];
  return `${lines.join('\n')}\n`;
}

function esc(value) {
  return String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
}

function renderHtml(gate) {
  const rows = gate.checks.map((item) => `<tr><td><code>${esc(item.id)}</code></td><td><span class="badge ${esc(item.status)}">${esc(item.status)}</span></td><td>${esc(item.detail)}</td></tr>`).join('');
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>QBot 生产质量门禁</title><style>
body{margin:0;background:#f5f7fb;color:#172033;font:14px/1.55 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.wrap{max-width:1280px;margin:auto;padding:28px}.hero{padding:26px;border-radius:16px;color:white;background:${gate.decision === 'GO-CANARY' ? 'linear-gradient(135deg,#087443,#12b76a)' : 'linear-gradient(135deg,#7a271a,#d92d20)'}.stats{display:flex;gap:12px;flex-wrap:wrap;margin:18px 0}.stat{background:white;border:1px solid #dfe5ec;border-radius:12px;padding:13px 16px}.table{overflow:auto;background:white;border:1px solid #dfe5ec;border-radius:14px}table{border-collapse:collapse;width:100%}th,td{padding:10px 12px;border-bottom:1px solid #e7ebf0;text-align:left;vertical-align:top}th{background:#eef3f8}.badge{padding:3px 8px;border-radius:999px;font-weight:700}.passed{background:#dcfae6;color:#087443}.blocker{background:#fee4e2;color:#b42318}.warning{background:#fff4cc;color:#7a4d00}code{font-size:12px}</style></head><body><main class="wrap"><section class="hero"><h1>${esc(gate.decision)}</h1><p>${esc(gate.next_stage)}</p></section><section class="stats"><div class="stat"><b>${gate.counts.passed}/${gate.counts.checks}</b><br>检查通过</div><div class="stat"><b>${gate.counts.blockers}</b><br>Blocker</div><div class="stat"><b>${gate.stability.run_count}</b><br>稳定性轮数</div><div class="stat"><b>${(gate.stability.flake_rate * 100).toFixed(3)}%</b><br>Flaky/非可信通过</div></section><section class="table"><table><thead><tr><th>检查</th><th>状态</th><th>说明</th></tr></thead><tbody>${rows}</tbody></table></section></main></body></html>`;
}

export function writeDefaultProductionGatePolicy(file) {
  const target = path.resolve(file);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, `${JSON.stringify(DEFAULT_PRODUCTION_GATE_POLICY, null, 2)}\n`);
  return target;
}

export function isKnownNonPassStatus(value) {
  return NON_PASS_STATUSES.has(mapReviewCategory(value));
}
