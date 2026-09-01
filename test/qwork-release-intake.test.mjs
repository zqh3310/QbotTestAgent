import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  QWORK_RELEASE_INTAKE_SCHEMA,
  QWORK_RELEASE_INTAKE_TOOL_VERSION,
  mapReleaseImpact,
  scanQworkReleaseIntake,
  sha256Text,
  stableJson,
  validateQworkReleaseIntake,
  writeQworkReleaseIntake,
} from '../src/lib/qwork-release-intake.mjs';
import { validateQworkReleaseIntakeBinding } from '../src/lib/qwork-release-test-plan.mjs';

function git(repo, ...args) {
  return execFileSync('git', args, { cwd: repo, encoding: 'utf8' }).trim();
}

function commit(repo, file, value, message) {
  fs.mkdirSync(path.dirname(path.join(repo, file)), { recursive: true });
  fs.writeFileSync(path.join(repo, file), value);
  git(repo, 'add', file);
  git(repo, 'commit', '-m', message);
  return git(repo, 'rev-parse', 'HEAD');
}

function fixtureRepo() {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'qbot-intake-repo-'));
  git(repo, 'init', '-b', 'main');
  git(repo, 'config', 'user.email', 'qa@example.invalid');
  git(repo, 'config', 'user.name', 'QA');
  const root = commit(repo, 'README.md', 'initial\n', 'initial');
  git(repo, 'checkout', '-b', 'release/0.1');
  const baseline = root;
  fs.mkdirSync(path.join(repo, 'server', 'automation'), { recursive: true });
  fs.writeFileSync(path.join(repo, 'server', 'automation', 'scheduler.mjs'), 'export const schedule = true;\n');
  git(repo, 'add', '.');
  git(repo, 'commit', '-m', "Merge branch 'feature/automation' into release/0.1 (!101)");
  const releaseHead = git(repo, 'rev-parse', 'HEAD');
  return { repo, baseline, releaseHead };
}

test('impact mapping stays conservative for unknown product paths', () => {
  const mapped = mapReleaseImpact({
    changedPaths: ['server/automation/scheduler.mjs', 'server/mystery/contract.mjs'],
    subject: 'automation scheduler !101',
    availableCaseIds: ['MRSMOKE-AUTO-001', 'MRSMOKE-ROUTE-001'],
  });
  assert.equal(mapped.direct_case_ids.includes('MRSMOKE-AUTO-001'), true);
  assert.deepEqual(mapped.unmapped_product_paths, ['server/mystery/contract.mjs']);
  assert.equal(mapped.mapping_status, 'BLOCKED');
});

test('known product paths and generated metadata are classified without false unknowns', () => {
  const mapped = mapReleaseImpact({
    changedPaths: [
      '.agent/context.yaml',
      'AGENTS.md',
      'package.json',
      'server/engine.mjs',
      'electron/desktop-agent-host.cjs',
      'src/components/assistant-ui/thread.tsx',
      'resources/builtin-skills/document-processing/SKILL.md',
      'scripts/e2e-module.test.mjs',
    ],
    subject: 'runtime and routing update',
    availableCaseIds: ['MRSMOKE-FAIL-001', 'MRSMOKE-NAV-001', 'MRSMOKE-SKILL-001'],
  });
  assert.deepEqual(mapped.unmapped_product_paths, []);
  assert.equal(mapped.static_dispositions.length, 3);
  assert.equal(mapped.direct_case_ids.includes('MRSMOKE-FAIL-001'), true);
  assert.equal(mapped.direct_case_ids.includes('MRSMOKE-NAV-001'), true);
  assert.equal(mapped.direct_case_ids.includes('MRSMOKE-SKILL-001'), true);
  assert.equal(mapped.required_stages.includes('G3'), true);
});

test('release intake uses commit ancestry and binds verified MR metadata', () => {
  const { repo, baseline, releaseHead } = fixtureRepo();
  try {
    const report = scanQworkReleaseIntake({
      repoRoot: repo,
      releaseRef: 'HEAD',
      baselineCommit: baseline,
      caseIds: ['MRSMOKE-AUTO-001', 'MRSMOKE-ROUTE-001', 'BETA-TASK-008'],
      frameworkCommit: 'a'.repeat(40),
      fetchLatest: false,
      gitlabReader: () => [{ iid: 101, title: 'automation scheduler', merge_commit_sha: releaseHead, labels: ['area/automation'], merged_at: '2026-08-31T01:00:00Z' }],
      now: new Date('2026-08-31T02:00:00Z'),
    });
    assert.equal(report.schema_version, QWORK_RELEASE_INTAKE_SCHEMA);
    assert.equal(report.decision, 'READY');
    assert.equal(report.scan_boundary.mode, 'commit_ancestry');
    assert.equal(report.scan_boundary.baseline_commit, baseline);
    assert.equal(report.merge_requests[0].metadata_verified, true);
    assert.equal(report.summary.direct_case_ids.includes('MRSMOKE-AUTO-001'), true);
    assert.equal(report.summary.dependency_case_ids.includes('BETA-TASK-008'), true);
    assert.equal(validateQworkReleaseIntake(report, { releaseRef: 'HEAD', releaseHead, frameworkCommit: 'a'.repeat(40) }).ok, true);
  } finally {
    fs.rmSync(repo, { recursive: true, force: true });
  }
});

test('dependency closure keeps cross-sheet prerequisites in the intake', () => {
  const { repo, baseline } = fixtureRepo();
  try {
    const report = scanQworkReleaseIntake({
      repoRoot: repo,
      releaseRef: 'HEAD',
      baselineCommit: baseline,
      caseIds: ['MRSMOKE-AUTO-001'],
      frameworkCommit: 'a'.repeat(40),
      fetchLatest: false,
      requireGitLabMetadata: false,
      gitlabReader: () => [],
    });
    assert.equal(report.summary.dependency_case_ids.includes('BETA-TASK-008'), true);
    assert.equal(report.summary.dependency_case_ids.includes('BETA-ROUTE-001'), true);
  } finally {
    fs.rmSync(repo, { recursive: true, force: true });
  }
});

test('intake falls back to a bounded time window when ancestry is unavailable', () => {
  const { repo } = fixtureRepo();
  try {
    const report = scanQworkReleaseIntake({
      repoRoot: repo,
      releaseRef: 'HEAD',
      baselineCommit: 'b'.repeat(40),
      caseIds: ['MRSMOKE-AUTO-001'],
      frameworkCommit: 'a'.repeat(40),
      fetchLatest: false,
      requireGitLabMetadata: false,
      gitlabReader: () => [],
      now: new Date('2026-08-31T02:00:00Z'),
      fallbackDays: 30,
    });
    assert.equal(report.scan_boundary.mode, 'time_window_fallback');
    assert.equal(report.scan_boundary.ancestry_verified, false);
    assert.match(report.scan_boundary.fallback_reason, /baseline/);
    assert.equal(report.policy.time_window_is_fallback, true);
    assert.equal(report.decision, 'BLOCKED');
    assert.match(report.blockers.join('\n'), /祖先关系/);
  } finally {
    fs.rmSync(repo, { recursive: true, force: true });
  }
});

test('GitLab MR intake paginates beyond the first 100 rows', () => {
  const { repo, baseline, releaseHead } = fixtureRepo();
  try {
    const calls = [];
    const report = scanQworkReleaseIntake({
      repoRoot: repo,
      releaseRef: 'HEAD',
      baselineCommit: baseline,
      caseIds: ['MRSMOKE-AUTO-001'],
      frameworkCommit: 'a'.repeat(40),
      fetchLatest: false,
      gitlabReader: (endpoint) => {
        calls.push(endpoint);
        if (endpoint.endsWith('page=1')) {
          return Array.from({ length: 100 }, (_, index) => ({
            iid: String(index + 1),
            merge_commit_sha: index === 0 ? releaseHead : '0'.repeat(40),
          }));
        }
        return [{ iid: '101', merge_commit_sha: '1'.repeat(40) }];
      },
    });
    assert.equal(calls.length, 2);
    assert.equal(calls[1].endsWith('page=2'), true);
    assert.equal(report.merge_requests[0].metadata_verified, true);
  } finally {
    fs.rmSync(repo, { recursive: true, force: true });
  }
});

test('intake output is immutable and content hash is validated', () => {
  const { repo, baseline } = fixtureRepo();
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'qbot-intake-out-'));
  fs.rmSync(out, { recursive: true, force: true });
  try {
    const report = scanQworkReleaseIntake({
      repoRoot: repo,
      releaseRef: 'HEAD',
      baselineCommit: baseline,
      caseIds: ['MRSMOKE-AUTO-001'],
      frameworkCommit: 'a'.repeat(40),
      fetchLatest: false,
      requireGitLabMetadata: false,
      gitlabReader: () => [],
    });
    const files = writeQworkReleaseIntake({ report, outDir: out });
    assert.equal(fs.existsSync(files.json), true);
    assert.equal(validateQworkReleaseIntake(JSON.parse(fs.readFileSync(files.json, 'utf8')), { requireReady: false }).ok, true);
    assert.throws(() => writeQworkReleaseIntake({ report, outDir: out }), /新的不可变目录/);
    assert.equal(typeof stableJson(report), 'string');
  } finally {
    fs.rmSync(repo, { recursive: true, force: true });
    fs.rmSync(out, { recursive: true, force: true });
  }
});

test('a bound intake cannot cross release, Casebook, or framework identity', () => {
  const report = {
    schema_version: QWORK_RELEASE_INTAKE_SCHEMA,
    tool: { version: QWORK_RELEASE_INTAKE_TOOL_VERSION },
    decision: 'READY',
    release: { ref: 'origin/release/0.1', head: 'c'.repeat(40) },
    framework: { commit: 'd'.repeat(40) },
    casebook: { sha256: 'e'.repeat(64) },
    scan_boundary: { mode: 'commit_ancestry', ancestry_verified: true },
    unresolved: { unmapped_product_paths: [], unverified_mr_metadata: [] },
    blockers: [],
    integrity: { content_sha256: '' },
  };
  const withoutHash = structuredClone(report);
  delete withoutHash.integrity.content_sha256;
  report.integrity.content_sha256 = sha256Text(stableJson(withoutHash));
  const plan = {
    policy: { release_intake_required: true },
    release_intake: {
      schema_version: QWORK_RELEASE_INTAKE_SCHEMA,
      sha256: 'f'.repeat(64),
      content_sha256: report.integrity.content_sha256,
      release_ref: report.release.ref,
      release_head: report.release.head,
    },
    casebook: { sha256: report.casebook.sha256 },
    framework: { commit: report.framework.commit },
  };
  const accepted = validateQworkReleaseIntakeBinding({ plan, report, reportSha256: 'f'.repeat(64) });
  assert.equal(accepted.ok, true);
  const drifted = validateQworkReleaseIntakeBinding({
    plan: { ...plan, framework: { commit: '0'.repeat(40) } },
    report,
    reportSha256: 'f'.repeat(64),
  });
  assert.equal(drifted.ok, false);
  assert.equal(drifted.failures.some((item) => item.includes('framework_commit')), true);
});
