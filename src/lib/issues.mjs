import path from 'node:path';
import { exists, hashText, listFilesRecursive, normalizeText, readJsonFile } from './fs.mjs';

function asIssueArray(value) {
  if (Array.isArray(value)) return value;
  if (value && typeof value === 'object' && Number.isFinite(value.iid)) return [value];
  return [];
}

function mergeIssue(base, incoming) {
  if (!base) return { ...incoming };
  const merged = { ...base, ...incoming };
  const baseDescription = normalizeText(base.description);
  const incomingDescription = normalizeText(incoming.description);
  if (baseDescription.length > incomingDescription.length) merged.description = base.description;
  const labels = new Set([...(base.labels || []), ...(incoming.labels || [])]);
  merged.labels = [...labels].sort();
  if (base.updated_at && incoming.updated_at) {
    merged.updated_at = new Date(incoming.updated_at) >= new Date(base.updated_at) ? incoming.updated_at : base.updated_at;
  }
  return merged;
}

function loadIssueFile(file, errors) {
  try {
    return asIssueArray(readJsonFile(file));
  } catch (error) {
    errors.push({ file, error: error.message });
    return [];
  }
}

export function loadIssues(repoRoot) {
  const byIid = new Map();
  const sources = [];
  const errors = [];
  const issuesList = path.join(repoRoot, 'issues', 'issues_list.json');
  const primaryFiles = [
    issuesList,
    path.join(repoRoot, 'issues.json'),
    path.join(repoRoot, 'issues_closed.json'),
  ].filter((file) => exists(file));

  for (const file of primaryFiles) {
    if (!exists(file)) continue;
    sources.push(file);
    for (const issue of loadIssueFile(file, errors)) {
      if (!Number.isFinite(issue.iid)) continue;
      byIid.set(issue.iid, mergeIssue(byIid.get(issue.iid), issue));
    }
  }

  const detailFiles = listFilesRecursive(path.join(repoRoot, 'issues'), (file) => /issue_\d+\.json$/i.test(path.basename(file)));

  for (const file of detailFiles) {
    sources.push(file);
    for (const issue of loadIssueFile(file, errors)) {
      if (!Number.isFinite(issue.iid)) continue;
      byIid.set(issue.iid, mergeIssue(byIid.get(issue.iid), issue));
    }
  }

  const issues = [...byIid.values()]
    .filter((issue) => Number.isFinite(issue.iid) && issue.iid > 0)
    .sort((a, b) => a.iid - b.iid)
    .map((issue) => normalizeIssue(issue));

  return { issues, sources: [...new Set(sources)].sort(), errors };
}

export function normalizeIssue(issue) {
  const labels = Array.isArray(issue.labels) ? issue.labels.slice().sort() : [];
  const description = normalizeText(issue.description);
  return {
    id: issue.id || null,
    iid: issue.iid,
    title: issue.title || '',
    description,
    state: issue.state || 'unknown',
    labels,
    created_at: issue.created_at || '',
    updated_at: issue.updated_at || '',
    closed_at: issue.closed_at || null,
    web_url: issue.web_url || '',
    milestone: issue.milestone?.title || '',
    task_completion_status: issue.task_completion_status || null,
    content_hash: hashText(JSON.stringify({
      title: issue.title || '',
      description,
      state: issue.state || '',
      labels,
      milestone: issue.milestone?.title || '',
    })),
  };
}

export function extractSection(description, heading) {
  const text = normalizeText(description);
  const pattern = new RegExp(`(^|\\n)#{2,4}\\s+${heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\n`, 'i');
  const match = pattern.exec(text);
  if (!match) return '';
  const start = match.index + match[0].length;
  const rest = text.slice(start);
  const next = /\n#{2,4}\s+/.exec(rest);
  return normalizeText(next ? rest.slice(0, next.index) : rest);
}

export function summarizeDescription(issue, maxLength = 360) {
  const candidates = ['Goal', 'Scope', 'Problem', 'Enhancement Goal', 'Verification Checklist', 'Negative Cases']
    .map((heading) => extractSection(issue.description, heading))
    .filter(Boolean);
  const source = candidates[0] || issue.description || issue.title;
  return normalizeText(source).replace(/\n+/g, ' ').slice(0, maxLength);
}
