import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { writeJsonFile, writeTextFile } from './fs.mjs';

const CURL_BINARY = process.platform === 'win32' ? 'curl.exe' : 'curl';
const SECRET_PATTERNS = [
  [/sk-[A-Za-z0-9_-]{20,}/g, 'sk-REDACTED'],
  [/ghp_[A-Za-z0-9]{20,}/g, 'ghp_REDACTED'],
  [/glpat-[A-Za-z0-9_-]{20,}/g, 'glpat-REDACTED'],
  [/xox[baprs]-[A-Za-z0-9-]{20,}/g, 'xox-REDACTED'],
  [/-----BEGIN (?:RSA |OPENSSH |EC )?PRIVATE KEY-----[\s\S]+?-----END (?:RSA |OPENSSH |EC )?PRIVATE KEY-----/g, 'PRIVATE_KEY_REDACTED'],
];

export function buildIssueLoop({ report, outDir, options = {} }) {
  const drafts = buildBugIssueDrafts(report);
  const files = {
    drafts_json: path.join(outDir, 'bug-issue-drafts.json'),
    drafts_md: path.join(outDir, 'bug-issue-drafts.md'),
  };
  writeJsonFile(files.drafts_json, drafts);
  writeTextFile(files.drafts_md, renderBugIssueDrafts(drafts));

  const createRequested = Boolean(options['create-gitlab-issues']);
  const createConfirmed = Boolean(options['confirm-create-issues']);
  const creation = createRequested
    ? createGitLabIssues({
        drafts,
        host: options['gitlab-host'] || 'gitlab.daikuan.qihoo.net',
        projectPath: options['gitlab-project'] || 'songrongxin/deepbankv2',
        confirm: createConfirmed,
      })
    : {
        status: 'skipped',
        reason: 'Remote GitLab issue creation was not requested. Drafts were generated only.',
        created: [],
        existing: [],
        failed: [],
      };
  const creationFile = path.join(outDir, 'gitlab-issue-creation-report.json');
  writeJsonFile(creationFile, creation);

  return {
    status: drafts.length
      ? creation.status === 'created' || creation.status === 'partial' ? creation.status : 'drafted'
      : 'none',
    draft_count: drafts.length,
    created_count: creation.created.length,
    existing_count: creation.existing.length,
    failed_count: creation.failed.length,
    files: { ...files, creation_json: creationFile },
    creation,
  };
}

export function buildBugIssueDrafts(report) {
  const drafts = [];
  const failedResults = (report.results || []).filter((result) => shouldDraftIssue(result));
  for (const result of failedResults) {
    const fingerprint = fingerprintFor(report, result);
    const title = `[QBot 自动化失败][${report.suite}/${report.target_os}] ${result.flow_id}`;
    const body = renderDraftBody({ report, result, fingerprint });
    drafts.push({
      fingerprint,
      title,
      description: body,
      labels: labelsFor(report, result),
      classification: 'bug',
      confidence: result.assertion_status === 'failed' ? 'high' : 'medium',
      source: 'qbot-test-agent automation-run',
      flow_id: result.flow_id,
      linked_case_ids: result.linked_case_ids,
      suite: report.suite,
      os: result.os,
      automation_level: result.automation_level,
      execution_scope: result.execution_scope,
      status: result.status,
      assertion_status: result.assertion_status || '',
      reason: result.reason,
      issue_draft_needed: true,
    });
  }
  return drafts;
}

function shouldDraftIssue(result) {
  if (result.status === 'failed') return true;
  if (result.assertion_status === 'failed') return true;
  return false;
}

function fingerprintFor(report, result) {
  const text = [
    report.repo_root,
    report.flows_file,
    report.suite,
    report.target_os,
    result.flow_id,
    result.linked_case_ids,
    result.reason,
    result.assertion_status,
  ].join('|');
  return `qbot-auto-${createHash('sha256').update(text).digest('hex').slice(0, 16)}`;
}

function labelsFor(report, result) {
  const labels = new Set([
    'qbot-test-agent',
    'kind/bug',
    'source/automation',
    `suite/${safeLabel(report.suite)}`,
    `os/${safeLabel(result.os)}`,
    `level/${safeLabel(result.automation_level)}`,
  ]);
  if (result.execution_scope) labels.add(`scope/${safeLabel(result.execution_scope)}`);
  return [...labels];
}

function safeLabel(value) {
  return String(value || 'unknown').replace(/[^A-Za-z0-9_.-]+/g, '-').replace(/^-|-$/g, '') || 'unknown';
}

function renderDraftBody({ report, result, fingerprint }) {
  const stdoutTail = tailFile(result.stdout_path);
  const stderrTail = tailFile(result.stderr_path);
  const checks = result.assertion_checks || [];
  return [
    `Fingerprint: \`${fingerprint}\``,
    '',
    '## Summary',
    '',
    `QBot automation flow \`${result.flow_id}\` failed in suite \`${report.suite}\` on \`${report.target_os}\`.`,
    '',
    '## Failure',
    '',
    `- Status: \`${result.status}\``,
    `- Reason: ${redact(result.reason || '')}`,
    `- Assertion status: \`${result.assertion_status || 'unknown'}\``,
    `- Exit code: \`${result.exit_code ?? 'unknown'}\``,
    `- Signal: \`${result.signal ?? 'none'}\``,
    `- Duration: \`${result.duration_ms ?? 'unknown'}ms\``,
    '',
    '## Traceability',
    '',
    `- Flow: \`${result.flow_id}\``,
    `- Linked case: \`${result.linked_case_ids}\``,
    `- Automation level: \`${result.automation_level}\``,
    `- Execution scope: \`${result.execution_scope}\``,
    `- Repo: \`${report.repo_root}\``,
    `- Flows file: \`${report.flows_file}\``,
    `- Script path: \`${result.script_path}\``,
    `- Stdout path: \`${result.stdout_path}\``,
    `- Stderr path: \`${result.stderr_path}\``,
    '',
    '## Expected Behavior',
    '',
    redact(result.case_assertions || 'No case assertions were recorded.'),
    '',
    '## Black-Box Gate',
    '',
    redact(result.blackbox_assertions || 'No black-box assertions were recorded.'),
    '',
    '## Assertion Checks',
    '',
    ...(checks.length ? checks.map((check) => `- ${check.status}: ${check.name} - ${redact(check.detail || '')}`) : ['- No assertion checks recorded.']),
    '',
    '## Reproduction',
    '',
    'Run the same generated automation flow:',
    '',
    '```bash',
    `node src/cli.mjs automation-run --repo "${report.repo_root}" --flows "${report.flows_file}" --out "<new-output-dir>" --suite ${report.suite} --flow-id ${result.flow_id}`,
    '```',
    '',
    '## Stdout Tail',
    '',
    '```text',
    stdoutTail || '(empty)',
    '```',
    '',
    '## Stderr Tail',
    '',
    '```text',
    stderrTail || '(empty)',
    '```',
    '',
    '## Recommended Action',
    '',
    '- Treat this as an automation-found bug until triage proves it is an environment or test-data issue.',
    '- Do not mark the linked case as passed until this failure has a fix, explicit waiver, or updated blocker.',
    '',
  ].join('\n');
}

function tailFile(file, maxLines = 80) {
  if (!file || !fs.existsSync(file)) return '';
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
  return redact(lines.slice(-maxLines).join('\n'));
}

function redact(value) {
  let text = String(value || '');
  for (const [pattern, replacement] of SECRET_PATTERNS) text = text.replace(pattern, replacement);
  return text;
}

export function renderBugIssueDrafts(drafts) {
  const lines = ['# QBot Automation Bug Issue Drafts', ''];
  lines.push(`- Draft count: ${drafts.length}`);
  lines.push('');
  if (!drafts.length) {
    lines.push('No bug issue drafts were generated.');
    lines.push('');
    return lines.join('\n');
  }
  for (const draft of drafts) {
    lines.push(`## ${draft.title}`);
    lines.push('');
    lines.push(`- Fingerprint: \`${draft.fingerprint}\``);
    lines.push(`- Labels: ${draft.labels.join(', ')}`);
    lines.push(`- Flow: \`${draft.flow_id}\``);
    lines.push(`- Linked case: \`${draft.linked_case_ids}\``);
    lines.push(`- Reason: ${draft.reason}`);
    lines.push('');
    lines.push('```markdown');
    lines.push(draft.description);
    lines.push('```');
    lines.push('');
  }
  return lines.join('\n');
}

function createGitLabIssues({ drafts, host, projectPath, confirm }) {
  if (!drafts.length) {
    return { status: 'none', reason: 'No failed automation result requires an issue.', created: [], existing: [], failed: [] };
  }
  if (!confirm) {
    return {
      status: 'skipped',
      reason: 'Creation requested but not confirmed. Re-run with --confirm-create-issues to create remote GitLab issues.',
      created: [],
      existing: [],
      failed: [],
    };
  }
  const token = process.env.GITLAB_TOKEN || process.env.GLAB_TOKEN || process.env.PRIVATE_TOKEN || '';
  if (!token) {
    return {
      status: 'failed',
      reason: 'Missing GITLAB_TOKEN, GLAB_TOKEN, or PRIVATE_TOKEN.',
      created: [],
      existing: [],
      failed: drafts.map((draft) => ({ fingerprint: draft.fingerprint, title: draft.title, error: 'missing token' })),
    };
  }

  const created = [];
  const existing = [];
  const failed = [];
  for (const draft of drafts) {
    try {
      const duplicate = findExistingIssue({ host, projectPath, token, fingerprint: draft.fingerprint });
      if (duplicate) {
        existing.push({ fingerprint: draft.fingerprint, iid: duplicate.iid, web_url: duplicate.web_url, title: duplicate.title });
        continue;
      }
      const issue = postIssue({ host, projectPath, token, draft });
      created.push({ fingerprint: draft.fingerprint, iid: issue.iid, web_url: issue.web_url, title: issue.title });
    } catch (error) {
      failed.push({ fingerprint: draft.fingerprint, title: draft.title, error: error.message || String(error) });
    }
  }
  return {
    status: failed.length ? (created.length || existing.length ? 'partial' : 'failed') : 'created',
    reason: failed.length ? 'Some issue creations failed.' : 'GitLab issue creation loop completed.',
    created,
    existing,
    failed,
  };
}

function gitlabApiUrl(host, projectPath, endpoint) {
  return `https://${host}/api/v4/projects/${encodeURIComponent(projectPath)}/${endpoint}`;
}

function curlJson(args) {
  const stdout = execFileSync(CURL_BINARY, args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    maxBuffer: 10 * 1024 * 1024,
  });
  return JSON.parse(stdout || 'null');
}

function findExistingIssue({ host, projectPath, token, fingerprint }) {
  const url = `${gitlabApiUrl(host, projectPath, 'issues')}?state=opened&search=${encodeURIComponent(fingerprint)}`;
  const issues = curlJson(['-k', '-sS', '--fail', '--max-time', '60', '--header', `PRIVATE-TOKEN: ${token}`, url]);
  return Array.isArray(issues) ? issues.find((issue) => String(issue.description || '').includes(fingerprint) || String(issue.title || '').includes(fingerprint)) : null;
}

function postIssue({ host, projectPath, token, draft }) {
  return curlJson([
    '-k',
    '-sS',
    '--fail',
    '--max-time',
    '60',
    '--request',
    'POST',
    '--header',
    `PRIVATE-TOKEN: ${token}`,
    '--data-urlencode',
    `title=${draft.title}`,
    '--data-urlencode',
    `description=${draft.description}`,
    '--data-urlencode',
    `labels=${draft.labels.join(',')}`,
    gitlabApiUrl(host, projectPath, 'issues'),
  ]);
}
