import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

const RELEASE_IDENTITY_FIELDS = [
  'host.product',
  'host.version',
  'host.build',
  'host.app_path',
  'qwork.version',
  'qwork.url',
  'artifacts.host_info_plist_sha256',
  'artifacts.host_main_binary_sha256',
  'artifacts.qwork_index_sha256',
  'artifacts.qwork_install_metadata_sha256',
  'sources.deepbank.commit',
  'sources.deepbank.dirty',
  'control_plane.origin',
  'release_inputs.backend_version',
  'release_inputs.prompt_policy_version',
  'release_inputs.feature_flags_hash',
  'release_inputs.qwork_ui_git_commit',
  'release_inputs.qwork_build_id',
  'release_inputs.qwork_release_manifest_sha256',
  'model_tier',
  'timeout_ms',
];

const CASE_FINGERPRINT_FIELDS = [
  'id',
  'priority',
  'module',
  'submodule',
  'scenario',
  'precondition',
  'test_data',
  'selectors',
  'steps',
  'expected_result',
  'success_criteria',
  'failure_criteria',
  'evidence_required',
  'runner',
  'execution_level',
  'mandatory',
  'source_id',
  'source_type',
  'note',
  'user_journey',
  'blocking_level',
  'pipeline_policy',
  'second_review_required',
  'risk_domain',
  'oracle_type',
  'deterministic',
  'repeat_policy',
  'required_fixture',
  'hard_gate',
  'cleanup_policy',
  'version_scope',
  'known_bug_link',
  'production_signal',
  'contract_version',
  'product_baseline',
  'migration_disposition',
  'visible_action_contract',
  'state_readback_contract',
  'required_evidence_roles',
  'forbidden_shortcuts',
  'selector_contract',
  'identity_contract',
  'trusted_review_contract',
  'case_type',
  'automation_protocol',
  'state_fixture_contract',
  'api_event_oracle',
  'design_baseline_id',
  'design_baseline_file',
  'design_baseline_sha256',
  'visual_comparison_contract',
  'viewport_contract',
  'accessibility_contract',
  'branch_coverage',
  'traceability_tags',
];

function readJson(file, label) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    throw new Error(`${label}不可读：${file}：${error.message}`);
  }
}

function readPath(value, dotted) {
  return dotted.split('.').reduce((current, key) => current?.[key], value);
}

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value ?? null);
}

function sha256Text(value) {
  return createHash('sha256').update(String(value || ''), 'utf8').digest('hex');
}

function sha256File(file) {
  const hash = createHash('sha256');
  hash.update(fs.readFileSync(file));
  return hash.digest('hex');
}

function ensureInside(directory, file, label) {
  const root = path.resolve(directory);
  const resolved = path.resolve(file);
  const relative = path.relative(root, resolved);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
    if (resolved === root) throw new Error(`${label}不能指向目录本身：${resolved}`);
    if (relative.startsWith('..') || path.isAbsolute(relative)) {
      throw new Error(`${label}越出源批次目录：${resolved}`);
    }
  }
  return resolved;
}

export function caseDefinitionFingerprint(testCase = {}) {
  const identity = Object.fromEntries(
    CASE_FINGERPRINT_FIELDS.map((field) => [field, testCase?.[field] ?? '']),
  );
  return sha256Text(stableJson(identity));
}

export function compareReleaseIdentity(source, current) {
  const drift = [];
  for (const field of RELEASE_IDENTITY_FIELDS) {
    const before = readPath(source, field);
    const after = readPath(current, field);
    if (String(before ?? '') !== String(after ?? '')) {
      drift.push({ field, source: before ?? null, current: after ?? null });
    }
  }
  return { compatible: drift.length === 0, drift };
}

function parseImpactIds(value) {
  if (Array.isArray(value)) {
    return new Set(value.map((item) => String(item || '').trim()).filter(Boolean));
  }
  return new Set(String(value || '').split(/[,，\s]+/).map((item) => item.trim()).filter(Boolean));
}

function eligibleTerminalResult(result) {
  const status = String(result?.status || '').toLowerCase();
  const category = String(result?.result_category || '').toLowerCase();
  if (!['passed', 'failed'].includes(status)) {
    return { eligible: false, reason: `source_status=${status || 'missing'}不允许继承` };
  }
  if (category === 'automation_error' || /framework|automation_error/i.test(category)) {
    return { eligible: false, reason: `source_result_category=${category}不允许继承` };
  }
  return { eligible: true, reason: '' };
}

function validateEvidence(sourceOut, result) {
  const declared = String(result?.artifacts?.evidence_manifest || '');
  if (!declared) return { ok: false, reason: '源结果缺少 evidence manifest 路径' };
  let manifestFile;
  try {
    manifestFile = ensureInside(sourceOut, declared, 'evidence manifest');
  } catch (error) {
    return { ok: false, reason: error.message };
  }
  if (!fs.existsSync(manifestFile)) return { ok: false, reason: `evidence manifest 不存在：${manifestFile}` };
  const manifest = readJson(manifestFile, 'evidence manifest');
  if (manifest.complete !== true || (manifest.missing_roles || []).length) {
    return { ok: false, reason: `evidence manifest 不完整：missing=${(manifest.missing_roles || []).join(',')}` };
  }
  const actualManifestSha256 = sha256File(manifestFile);
  const declaredSha256 = String(result?.evidence_manifest?.manifest_sha256 || '');
  if (!declaredSha256 || declaredSha256 !== actualManifestSha256) {
    return { ok: false, reason: 'evidence manifest SHA-256 缺失或不匹配' };
  }
  const resultFile = ensureInside(
    sourceOut,
    path.join(String(result?.case_dir || ''), 'case-result.json'),
    'case-result',
  );
  if (!fs.existsSync(resultFile)) return { ok: false, reason: `case-result 不存在：${resultFile}` };
  return {
    ok: true,
    manifest_file: manifestFile,
    manifest_sha256: actualManifestSha256,
    result_file: resultFile,
    result_sha256: sha256File(resultFile),
  };
}

export function buildCrossRunLineage({
  sourceOut,
  currentOut,
  selectedCases = [],
  impactCaseIds = [],
  impactAll = false,
  generatedAt = new Date().toISOString(),
} = {}) {
  const sourceDirectory = path.resolve(String(sourceOut || ''));
  const currentDirectory = path.resolve(String(currentOut || ''));
  if (!sourceOut || !fs.existsSync(sourceDirectory)) {
    throw new Error(`--resume-from 源批次不存在：${sourceDirectory}`);
  }
  if (sourceDirectory === currentDirectory) {
    throw new Error('--resume-from 必须指向只读旧批次，不能与当前输出目录相同。');
  }
  const impacts = parseImpactIds(impactCaseIds);
  if (!impactAll && impacts.size === 0) {
    throw new Error('跨 framework commit 续跑必须显式声明 --impact-case 或 --impact-all true。');
  }

  const sourceMetadataFile = path.join(sourceDirectory, 'run-metadata.json');
  const currentMetadataFile = path.join(currentDirectory, 'run-metadata.json');
  const sourceCasesFile = path.join(sourceDirectory, 'casebook-cases.json');
  const sourceProgressFile = path.join(sourceDirectory, 'automation-progress.json');
  const sourceMetadata = readJson(sourceMetadataFile, '源 run-metadata');
  const currentMetadata = readJson(currentMetadataFile, '当前 run-metadata');
  const identity = compareReleaseIdentity(sourceMetadata, currentMetadata);
  if (!identity.compatible && !impactAll) {
    throw new Error(`跨批次发布身份不一致，禁止继承：${identity.drift.map((item) => item.field).join(', ')}`);
  }
  if (sourceMetadata?.sources?.framework?.dirty !== false) {
    throw new Error('源批次 framework dirty 不是 false，禁止继承。');
  }
  if (currentMetadata?.sources?.framework?.dirty !== false) {
    throw new Error('当前批次 framework dirty 不是 false，禁止继承。');
  }

  const sourcePlan = readJson(sourceCasesFile, '源 casebook-cases');
  const sourceProgress = readJson(sourceProgressFile, '源 automation-progress');
  const sourceCasesById = new Map((sourcePlan.cases || []).map((item) => [String(item.id || ''), item]));
  const sourceResultsById = new Map((sourceProgress.results || []).map((item) => [String(item.id || ''), item]));
  const inheritedByIndex = new Map();
  const decisions = [];

  for (let index = 0; index < selectedCases.length; index += 1) {
    const testCase = selectedCases[index];
    const id = String(testCase?.id || '');
    let decision = 'rerun';
    let reason = '';
    const sourceCase = sourceCasesById.get(id);
    const sourceResult = sourceResultsById.get(id);
    if (impactAll || impacts.has(id)) {
      reason = impactAll ? 'impact_all' : 'declared_impact';
    } else if (!sourceCase) {
      reason = 'source_case_missing';
    } else if (caseDefinitionFingerprint(sourceCase) !== caseDefinitionFingerprint(testCase)) {
      reason = 'case_definition_changed';
    } else if (!sourceResult) {
      reason = 'source_result_missing';
    } else {
      const terminal = eligibleTerminalResult(sourceResult);
      if (!terminal.eligible) {
        reason = terminal.reason;
      } else {
        const evidence = validateEvidence(sourceDirectory, sourceResult);
        if (!evidence.ok) {
          reason = evidence.reason;
        } else {
          decision = 'inherited';
          reason = 'same_release_same_case_complete_evidence';
          inheritedByIndex.set(index, {
            ...sourceResult,
            order: index + 1,
            case_index: index,
            sheet: testCase.sheet,
            row_number: testCase.row_number,
            execution_provenance: 'inherited',
            lineage: {
              source_out: sourceDirectory,
              source_framework_commit: String(sourceMetadata?.sources?.framework?.commit || ''),
              current_framework_commit: String(currentMetadata?.sources?.framework?.commit || ''),
              source_case_result: evidence.result_file,
              source_case_result_sha256: evidence.result_sha256,
              source_evidence_manifest: evidence.manifest_file,
              source_evidence_manifest_sha256: evidence.manifest_sha256,
              inherited_at: generatedAt,
            },
          });
        }
      }
    }
    decisions.push({
      order: index + 1,
      id,
      sheet: testCase.sheet,
      row_number: testCase.row_number,
      case_fingerprint: caseDefinitionFingerprint(testCase),
      decision,
      reason,
    });
  }

  fs.mkdirSync(currentDirectory, { recursive: true });
  const manifest = {
    schema_version: 1,
    generated_at: generatedAt,
    mode: 'immutable-cross-framework-resume',
    source_out: sourceDirectory,
    current_out: currentDirectory,
    source_framework_commit: String(sourceMetadata?.sources?.framework?.commit || ''),
    current_framework_commit: String(currentMetadata?.sources?.framework?.commit || ''),
    release_identity_compatible: identity.compatible,
    release_identity_drift: identity.drift,
    impact: {
      all: Boolean(impactAll),
      case_ids: [...impacts].sort(),
    },
    counts: {
      selected: selectedCases.length,
      inherited: inheritedByIndex.size,
      rerun: selectedCases.length - inheritedByIndex.size,
    },
    files: {
      source_run_metadata: sourceMetadataFile,
      source_run_metadata_sha256: sha256File(sourceMetadataFile),
      source_casebook_cases: sourceCasesFile,
      source_casebook_cases_sha256: sha256File(sourceCasesFile),
      source_progress: sourceProgressFile,
      source_progress_sha256: sha256File(sourceProgressFile),
    },
    decisions,
  };
  const file = path.join(currentDirectory, 'run-lineage.json');
  const temporary = `${file}.tmp-${process.pid}`;
  fs.writeFileSync(temporary, `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o600 });
  fs.renameSync(temporary, file);
  return { file, manifest, inheritedByIndex };
}
