import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { writeReport } from '../lib/report.mjs';

test('diagnostic Markdown exposes partial module coverage and cannot invent missing target discovery', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qwork-report-'));
  try {
    const files = writeReport(dir, { command: 'core-smoke', status: 'blocked', diagnostic_only: true,
      release_gate_eligible: false, core_smoke: { identity_stable: true,
        candidate_identity: { framework_commit: 'abc123', qwork_version: '0.1.11' },
        counts: { planned: 4, passed: 3, blocked: 1 },
        results: [{ module: 'mcp', status: 'blocked', reason: 'fixture_unavailable' },
          { module: 'expert', status: 'passed' }] } });
    const markdown = fs.readFileSync(files.markdown, 'utf8');
    for (const expected of ['mcp: blocked', 'expert: passed', 'Release gate eligible: false',
      'Framework commit: abc123', 'QWork version: 0.1.11', '"blocked":1', 'qwork-core-smoke-report.json']) {
      assert.ok(markdown.includes(expected), expected);
    }
    assert.ok(!markdown.includes('QBot target found: no'));
    assert.ok(!markdown.includes('Status: not-run'));
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
