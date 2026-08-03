#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { evaluateCoreBetaGrayGate } from '../src/lib/core-beta-gray-gate.mjs';

const [input, output, runCount = '5', expectedCases = '184'] = process.argv.slice(2);
if (!input) {
  console.error('Usage: node scripts/evaluate-core-beta-gray-gate.mjs <runs.json> [output.json] [required-runs:3-5] [expected-cases]');
  process.exit(2);
}
const runs = JSON.parse(fs.readFileSync(path.resolve(input), 'utf8'));
const result = evaluateCoreBetaGrayGate(runs, {
  requiredConsecutiveRuns: Number(runCount),
  expectedCases: Number(expectedCases),
});
if (output) {
  fs.mkdirSync(path.dirname(path.resolve(output)), { recursive: true });
  fs.writeFileSync(path.resolve(output), `${JSON.stringify(result, null, 2)}\n`);
}
console.log(JSON.stringify(result, null, 2));
process.exitCode = result.decision === 'GO_CONTROLLED_GRAY' ? 0 : 1;
