#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const value = (name) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : '';
};
const baseDir = path.resolve(value('--base'));
const overlayDirs = args.flatMap((token, index) => token === '--overlay' ? [path.resolve(args[index + 1])] : []);
const outDir = path.resolve(value('--out'));
if (!value('--base') || !overlayDirs.length || !value('--out')) {
  console.error('Usage: merge-runs.mjs --base <out> --overlay <out> [--overlay <out>] --out <composite-out>');
  process.exit(2);
}

function progress(dir) {
  const file = path.join(dir, 'automation-progress.json');
  const payload = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!Array.isArray(payload.results)) throw new Error(`Run has no result list: ${file}`);
  return payload;
}

const base = progress(baseDir);
const order = base.results.map((result) => result.id);
if (new Set(order).size !== order.length) throw new Error('Base run contains duplicate Case IDs.');
const latest = new Map(base.results.map((result) => [result.id, { ...result, source_run: baseDir }]));
for (const dir of overlayDirs) {
  for (const result of progress(dir).results) {
    if (!latest.has(result.id)) throw new Error(`Overlay Case is outside base scope: ${result.id}`);
    latest.set(result.id, { ...result, source_run: dir });
  }
}
const results = order.map((id) => latest.get(id));
const counts = { total: results.length, passed: 0, failed: 0, blocked: 0 };
for (const result of results) {
  if (result.status === 'passed') counts.passed += 1;
  else if (result.status === 'blocked') counts.blocked += 1;
  else counts.failed += 1;
}
fs.mkdirSync(outDir, { recursive: true });
const now = new Date().toISOString();
fs.writeFileSync(path.join(outDir, 'automation-progress.json'), `${JSON.stringify({
  schema_version: 1,
  updated_at: now,
  completed: results.length,
  total: results.length,
  composite: true,
  source_runs: [baseDir, ...overlayDirs],
  results,
}, null, 2)}\n`);
fs.writeFileSync(path.join(outDir, 'automation-run-summary.json'), `${JSON.stringify({
  schema_version: 1,
  status: 'completed',
  generated_at: now,
  composite: true,
  source_runs: [baseDir, ...overlayDirs],
  counts,
}, null, 2)}\n`);
console.log(JSON.stringify({ out_dir: outDir, source_runs: [baseDir, ...overlayDirs], counts }, null, 2));
