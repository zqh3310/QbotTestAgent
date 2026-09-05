#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { evaluateCoreBetaGrayGate } from '../src/lib/core-beta-gray-gate.mjs';

const [input, output, runCount = '5', expectedCases = '70'] = process.argv.slice(2);
if (!input) {
  console.error('Usage: node scripts/evaluate-core-beta-gray-gate.mjs <runs.json> [output.json] [required-runs:5] [expected-cases:70]');
  process.exit(2);
}
let runs;
let inputFailure = '';
try {
  runs = JSON.parse(fs.readFileSync(path.resolve(input), 'utf8'));
} catch (error) {
  inputFailure = `runs_input_unreadable_or_invalid_json:${error?.message || error}`;
}
const result = inputFailure
  ? {
    schema_version: 'qbot-core-gray-gate/v2',
    generated_at: new Date().toISOString(),
    decision: 'NO_GO',
    pipeline_decision: 'STOP_PIPELINE',
    eligible_for_controlled_production_gray_internal_beta: false,
    failures: [inputFailure],
    runs: [],
  }
  : evaluateCoreBetaGrayGate(runs, {
    requiredConsecutiveRuns: Number(runCount),
    expectedCases: Number(expectedCases),
  });
if (output) {
  fs.mkdirSync(path.dirname(path.resolve(output)), { recursive: true });
  fs.writeFileSync(path.resolve(output), `${JSON.stringify(result, null, 2)}\n`);
}
console.log(JSON.stringify(result, null, 2));
process.exitCode = result.decision === 'GO_CONTROLLED_GRAY' ? 0 : 1;
