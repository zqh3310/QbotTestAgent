import fs from 'node:fs';
import path from 'node:path';
import { assertRunMetadataHost } from './run-metadata.mjs';

const DISQUALIFYING_RUN_STATUSES = new Set(['aborted', 'interrupted', 'recovering', 'stopped']);

const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));

function sameIdSet(actual, expected) {
  const a = new Set(actual);
  const b = new Set(expected);
  return a.size === actual.length
    && b.size === expected.length
    && a.size === b.size
    && [...a].every((id) => b.has(id));
}

export function loadTrustedValidationSources({ manifestPath, baselineIds, targetHost }) {
  const absoluteManifest = path.resolve(manifestPath);
  if (!fs.existsSync(absoluteManifest)) throw new Error(`Trusted validation manifest is missing: ${absoluteManifest}`);
  const manifest = readJson(absoluteManifest);
  if (manifest.schema_version !== 1 || !Array.isArray(manifest.sources) || !manifest.sources.length) {
    throw new Error('Trusted validation manifest must use schema_version=1 and contain at least one source.');
  }
  const baseline = new Set(baselineIds || []);
  const seen = new Set();
  const loaded = [];
  for (const source of manifest.sources) {
    const outDir = path.resolve(path.dirname(absoluteManifest), String(source.out_dir || ''));
    const expectedIds = (source.expected_case_ids || []).map((id) => String(id));
    if (!expectedIds.length || !sameIdSet(expectedIds, expectedIds)) {
      throw new Error(`Validation source has empty or duplicate expected_case_ids: ${source.out_dir || '<empty>'}`);
    }
    const includeIds = (source.include_case_ids || expectedIds).map((id) => String(id));
    if (!includeIds.length || !sameIdSet(includeIds, includeIds)) {
      throw new Error(`Validation source has empty or duplicate include_case_ids: ${source.out_dir || '<empty>'}`);
    }
    const expectedSet = new Set(expectedIds);
    for (const id of includeIds) {
      if (!expectedSet.has(id)) throw new Error(`Included validation Case is not part of its complete run: ${id}`);
    }
    for (const id of expectedIds) {
      if (!baseline.has(id)) throw new Error(`Validation Case is outside the frozen baseline: ${id}`);
    }
    for (const id of includeIds) {
      if (seen.has(id)) throw new Error(`Validation Case appears in multiple sources: ${id}`);
      seen.add(id);
    }
    const files = {
      progress: path.join(outDir, 'automation-progress.json'),
      summary: path.join(outDir, 'automation-run-summary.json'),
      trusted: path.join(outDir, '可信二次复核结果.json'),
      metadata: path.join(outDir, 'run-metadata.json'),
    };
    for (const file of Object.values(files)) {
      if (!fs.existsSync(file)) throw new Error(`Validation source is incomplete: ${file}`);
    }
    const progress = readJson(files.progress);
    const summary = readJson(files.summary);
    const trusted = readJson(files.trusted);
    const metadata = readJson(files.metadata);
    const progressIds = (progress.results || []).map((item) => item.id);
    const trustedIds = (trusted.results || []).map((item) => item.id);
    const complete = Number(progress.completed) === expectedIds.length
      && Number(progress.total) === expectedIds.length
      && Number(summary.counts?.total) === expectedIds.length
      && Boolean(summary.ended_at)
      && progress.aborted !== true
      && progress.recovering !== true
      && progress.synthetic !== true
      && summary.aborted !== true
      && summary.synthetic !== true
      && !DISQUALIFYING_RUN_STATUSES.has(String(summary.status || '').toLowerCase());
    if (!complete) throw new Error(`Validation run is not a complete, non-synthetic terminal run: ${outDir}`);
    if (!sameIdSet(progressIds, expectedIds) || !sameIdSet(trustedIds, expectedIds)) {
      throw new Error(`Validation Case IDs do not match the frozen manifest: ${outDir}`);
    }
    if (!sameIdSet(metadata.selected_case_ids || [], expectedIds)) {
      throw new Error(`Validation run-metadata Case IDs do not match the frozen manifest: ${outDir}`);
    }
    const hostAudit = assertRunMetadataHost(metadata, targetHost);
    if (!hostAudit.ok) throw new Error(`Validation host identity mismatch in ${outDir}: ${hostAudit.errors.join('; ')}`);
    if (Number(metadata.timeout_ms) !== Number(targetHost.timeout_ms)) {
      throw new Error(`Validation timeout mismatch in ${outDir}: ${metadata.timeout_ms} != ${targetHost.timeout_ms}`);
    }
    const rejectedStatuses = new Set(source.reject_trusted_statuses || ['framework_issue', 'needs_review']);
    const includeSet = new Set(includeIds);
    const rejected = trusted.results.filter((item) => includeSet.has(item.id) && rejectedStatuses.has(item.trusted_status));
    if (rejected.length) {
      throw new Error(
        `Validation source contains non-terminal trusted classifications: `
        + rejected.map((item) => `${item.id}:${item.trusted_status}`).join(', '),
      );
    }
    const trustedTotal = Object.values(trusted.trusted_counts || {}).reduce((sum, value) => sum + Number(value || 0), 0);
    if (trustedTotal !== expectedIds.length) {
      throw new Error(`Validation trusted counts do not add up in ${outDir}: ${trustedTotal}/${expectedIds.length}`);
    }
    loaded.push({ outDir, expectedIds, includeIds, progress, summary, trusted, metadata, files });
  }
  return {
    manifest,
    sources: loaded,
    byId: new Map(loaded.flatMap((source) => {
      const includeSet = new Set(source.includeIds);
      return source.trusted.results
        .filter((item) => includeSet.has(item.id))
        .map((item) => [item.id, {
          ...item,
          validation_out_dir: source.outDir,
          validation_ended_at: source.summary.ended_at,
        }]);
    })),
  };
}
