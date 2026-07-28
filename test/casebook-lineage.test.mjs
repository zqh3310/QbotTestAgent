import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  buildCrossRunLineage,
  caseDefinitionFingerprint,
  compareReleaseIdentity,
} from '../src/lib/casebook-lineage.mjs';

function sha256File(file) {
  return createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function metadata(commit, overrides = {}) {
  const base = {
    host: { product: '360Teams', version: '5.2.23', build: '2119072648', app_path: '/Applications/360Teams.app' },
    qwork: { version: '0.0.15', url: 'file:///Users/test/.deepbank/ui/0.0.15/index.html' },
    artifacts: {
      host_info_plist_sha256: '1'.repeat(64),
      host_main_binary_sha256: '2'.repeat(64),
      qwork_index_sha256: '3'.repeat(64),
      qwork_install_metadata_sha256: '4'.repeat(64),
      casebook_sha256: '5'.repeat(64),
    },
    sources: {
      framework: { commit, dirty: false },
      deepbank: { commit: 'fixture-commit', dirty: false },
    },
    control_plane: { origin: 'https://qbot-api.360shuke.com' },
    release_inputs: {
      backend_version: 'prod-build',
      prompt_policy_version: 'prompt-build',
      feature_flags_hash: '6'.repeat(64),
      qwork_ui_git_commit: 'ui-commit',
      qwork_build_id: '0.0.15',
      qwork_release_manifest_sha256: '7'.repeat(64),
    },
    model_tier: 'M3',
    timeout_ms: 600000,
  };
  return { ...base, ...overrides };
}

function caseRow(id, scenario = '完成用户任务') {
  return {
    id,
    sheet: '业务功能Case',
    row_number: id === 'CASE-A' ? 2 : 3,
    priority: 'P0',
    module: '业务功能',
    scenario,
    steps: '1. 执行\n2. 读回',
    expected_result: '完成',
    success_criteria: '证据完整',
    failure_criteria: '目标未完成',
    required_evidence_roles: 'before_screenshot,action_screenshot,after_screenshot,case_report',
    contract_version: 'qbot-current-casebook/v4',
  };
}

function createSourceResult(sourceOut, testCase, {
  status = 'passed',
  resultCategory = 'pass',
  complete = true,
} = {}) {
  const caseDir = path.join(sourceOut, 'cases', `${testCase.id}`);
  const manifestFile = path.join(caseDir, 'case-evidence-manifest.json');
  const resultFile = path.join(caseDir, 'case-result.json');
  writeJson(manifestFile, {
    complete,
    missing_roles: complete ? [] : ['after_screenshot'],
  });
  const result = {
    order: 1,
    id: testCase.id,
    sheet: testCase.sheet,
    row_number: testCase.row_number,
    status,
    result_category: resultCategory,
    case_dir: caseDir,
    artifacts: { evidence_manifest: manifestFile },
    evidence_manifest: {
      complete,
      missing_roles: complete ? [] : ['after_screenshot'],
      manifest_sha256: sha256File(manifestFile),
    },
  };
  writeJson(resultFile, result);
  return result;
}

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'qbot-lineage-'));
  const sourceOut = path.join(root, 'source');
  const currentOut = path.join(root, 'current');
  fs.mkdirSync(sourceOut, { recursive: true });
  fs.mkdirSync(currentOut, { recursive: true });
  const cases = [caseRow('CASE-A'), caseRow('CASE-B')];
  writeJson(path.join(sourceOut, 'run-metadata.json'), metadata('old-framework'));
  writeJson(path.join(currentOut, 'run-metadata.json'), metadata('new-framework'));
  writeJson(path.join(sourceOut, 'casebook-cases.json'), { cases });
  const results = cases.map((item) => createSourceResult(sourceOut, item));
  writeJson(path.join(sourceOut, 'automation-progress.json'), {
    completed: results.length,
    total: results.length,
    results,
  });
  return { root, sourceOut, currentOut, cases };
}

test('case definition fingerprint is stable and changes with executable semantics', () => {
  const first = caseRow('CASE-A');
  assert.equal(caseDefinitionFingerprint(first), caseDefinitionFingerprint({ ...first }));
  assert.notEqual(caseDefinitionFingerprint(first), caseDefinitionFingerprint({ ...first, steps: 'changed' }));
  assert.equal(caseDefinitionFingerprint(first), caseDefinitionFingerprint({ ...first, row_number: 999 }));
});

test('release identity permits framework and casebook changes but rejects product drift', () => {
  const source = metadata('old');
  const current = metadata('new');
  current.artifacts.casebook_sha256 = '9'.repeat(64);
  assert.equal(compareReleaseIdentity(source, current).compatible, true);
  current.host.version = '5.2.24';
  const compared = compareReleaseIdentity(source, current);
  assert.equal(compared.compatible, false);
  assert.ok(compared.drift.some((item) => item.field === 'host.version'));
});

test('cross-run lineage inherits only unaffected terminal results with complete hashed evidence', () => {
  const { root, sourceOut, currentOut, cases } = fixture();
  try {
    const built = buildCrossRunLineage({
      sourceOut,
      currentOut,
      selectedCases: cases,
      impactCaseIds: ['CASE-B'],
      generatedAt: '2026-07-27T00:00:00.000Z',
    });
    assert.equal(built.manifest.counts.inherited, 1);
    assert.equal(built.manifest.counts.rerun, 1);
    assert.equal(built.inheritedByIndex.get(0).id, 'CASE-A');
    assert.equal(built.inheritedByIndex.get(0).execution_provenance, 'inherited');
    assert.equal(built.inheritedByIndex.has(1), false);
    assert.equal(built.manifest.decisions[1].reason, 'declared_impact');
    assert.equal(fs.existsSync(built.file), true);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('cross-run lineage reruns changed, incomplete, and automation-error cases', () => {
  const { root, sourceOut, currentOut, cases } = fixture();
  try {
    const sourceProgressFile = path.join(sourceOut, 'automation-progress.json');
    const progress = JSON.parse(fs.readFileSync(sourceProgressFile, 'utf8'));
    progress.results[0] = createSourceResult(sourceOut, cases[0], {
      status: 'failed',
      resultCategory: 'automation_error',
    });
    writeJson(sourceProgressFile, progress);
    const changedCases = [cases[0], { ...cases[1], steps: 'changed' }];
    const built = buildCrossRunLineage({
      sourceOut,
      currentOut,
      selectedCases: changedCases,
      impactCaseIds: ['UNRELATED-FRAMEWORK-CASE'],
    });
    assert.equal(built.manifest.counts.inherited, 0);
    assert.match(built.manifest.decisions[0].reason, /automation_error/);
    assert.equal(built.manifest.decisions[1].reason, 'case_definition_changed');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('cross-run lineage fails closed without impact declaration or with partial impact under release drift', () => {
  const { root, sourceOut, currentOut, cases } = fixture();
  try {
    assert.throws(
      () => buildCrossRunLineage({ sourceOut, currentOut, selectedCases: cases }),
      /必须显式声明/,
    );
    const drifted = metadata('new-framework');
    drifted.qwork.version = '0.0.16';
    writeJson(path.join(currentOut, 'run-metadata.json'), drifted);
    assert.throws(
      () => buildCrossRunLineage({
        sourceOut,
        currentOut,
        selectedCases: cases,
        impactCaseIds: ['CASE-A'],
      }),
      /发布身份不一致/,
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('cross-run lineage permits release drift only with impact-all and inherits nothing', () => {
  const { root, sourceOut, currentOut, cases } = fixture();
  try {
    const drifted = metadata('new-framework');
    drifted.host.version = '5.2.24';
    drifted.qwork.version = '0.0.18';
    drifted.qwork.url = 'file:///Users/test/.deepbank/ui/0.0.18/index.html';
    drifted.release_inputs.prompt_policy_version = 'prompt-build-0.0.18';
    writeJson(path.join(currentOut, 'run-metadata.json'), drifted);

    const built = buildCrossRunLineage({
      sourceOut,
      currentOut,
      selectedCases: cases,
      impactAll: true,
      generatedAt: '2026-07-28T00:00:00.000Z',
    });

    assert.equal(built.manifest.release_identity_compatible, false);
    assert.ok(built.manifest.release_identity_drift.some((item) => item.field === 'host.version'));
    assert.ok(built.manifest.release_identity_drift.some((item) => item.field === 'qwork.version'));
    assert.equal(built.manifest.impact.all, true);
    assert.equal(built.manifest.counts.selected, 2);
    assert.equal(built.manifest.counts.inherited, 0);
    assert.equal(built.manifest.counts.rerun, 2);
    assert.equal(built.manifest.decisions.length, 2);
    assert.ok(built.manifest.decisions.every((item) => item.reason === 'impact_all'));
    assert.equal(built.inheritedByIndex.size, 0);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
