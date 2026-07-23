#!/usr/bin/env node

import path from 'node:path';
import { evaluateProductionGate, writeDefaultProductionGatePolicy } from './production-gate.mjs';

function parse(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--')) throw new Error(`Unexpected argument: ${token}`);
    const [name, inline] = token.slice(2).split(/=(.*)/s, 2);
    const next = argv[index + 1];
    if (inline != null) options[name] = inline;
    else if (next && !next.startsWith('--')) {
      options[name] = next;
      index += 1;
    } else options[name] = true;
  }
  return options;
}

const options = parse(process.argv.slice(2));
if (options['write-default-policy']) {
  const file = writeDefaultProductionGatePolicy(String(options['write-default-policy']));
  console.log(JSON.stringify({ policy: file }, null, 2));
  process.exit(0);
}

const rawRuns = String(options.runs || options.run || '').trim();
if (!rawRuns) {
  console.error('Usage: node production-gate-cli.mjs --runs <run1,run2,...> [--policy file] [--calibration file] [--independent-review file] [--report-out dir]\n       node production-gate-cli.mjs --write-default-policy <file>');
  process.exit(2);
}
const runDirs = rawRuns.split(/[,\n]+/).map((item) => path.resolve(item.trim())).filter(Boolean);
const result = evaluateProductionGate({
  runDirs,
  policyPath: options.policy ? path.resolve(String(options.policy)) : '',
  calibrationPath: options.calibration ? path.resolve(String(options.calibration)) : '',
  independentReviewPath: options['independent-review'] ? path.resolve(String(options['independent-review'])) : '',
  reportOut: options['report-out'] ? path.resolve(String(options['report-out'])) : '',
});
console.log(JSON.stringify({ decision: result.decision, counts: result.counts, files: result.files }, null, 2));
if (result.decision !== 'GO-CANARY') process.exitCode = 1;
