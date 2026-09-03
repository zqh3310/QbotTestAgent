import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const QWORK_RELEASE_INTAKE_SCHEMA = 'qbot-qwork-release-intake/v1';
export const QWORK_RELEASE_INTAKE_TOOL_VERSION = 'qbot-release-intake/1.2.0';
export const QWORK_RELEASE_INTAKE_REPORT = 'release-intake.json';
export const QWORK_RELEASE_INTAKE_DEFAULT_REF = 'origin/release/0.1';
export const QWORK_RELEASE_INTAKE_DEFAULT_GITLAB_HOST = 'gitlab.daikuan.qihoo.net';
export const QWORK_RELEASE_INTAKE_DEFAULT_GITLAB_PROJECT = 'songrongxin/deepbankv2';
export const QWORK_RELEASE_INTAKE_WINDOW_HOURS = 24;
export const QWORK_RELEASE_INTAKE_OVERLAP_HOURS = 48;
export const QWORK_RELEASE_INTAKE_FALLBACK_DAYS = 30;
export const QWORK_RELEASE_INTAKE_MAX_COMMITS = 500;
export const QWORK_RELEASE_INTAKE_MAX_MR_PAGES = 20;

const HEX40 = /^[a-f0-9]{40}$/i;
const HEX64 = /^[a-f0-9]{64}$/i;
const PRODUCT_PATH = /^(?:server|app|apps|packages|src|desktop|runtime|ui|web|components|electron)\//i;

function text(value) {
  return String(value ?? '').trim();
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stableValue(value[key])]));
  }
  return value;
}

export function stableJson(value) {
  return JSON.stringify(stableValue(value));
}

export function sha256Text(value) {
  return createHash('sha256').update(String(value), 'utf8').digest('hex');
}

export function sha256File(file) {
  return createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function redact(value, secret = '') {
  const output = text(value);
  return secret ? output.split(secret).join('[REDACTED]') : output;
}

function runGit(repoRoot, args, { allowFailure = false } = {}) {
  try {
    return execFileSync('git', args, {
      cwd: repoRoot,
      encoding: 'utf8',
      maxBuffer: 100 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
  } catch (error) {
    if (allowFailure) return '';
    const stderr = redact(error.stderr || error.message || 'git command failed');
    throw new Error(`git ${args.join(' ')} 失败：${stderr}`);
  }
}

function runGitStatus(repoRoot, args) {
  return runGit(repoRoot, args, { allowFailure: true });
}

function parseCommitRecord(record) {
  const [commit, authoredAt, subject, ...bodyParts] = record.split('\x1f');
  const body = bodyParts.join('\x1f');
  const mr = (subject.match(/!(\d+)/) || body.match(/!(\d+)/) || [])[1] || '';
  const branch = (subject.match(/Merge (?:branch|remote-tracking branch) ['"]([^'"]+)['"]/) || [])[1]
    || subject;
  return { commit: text(commit), authored_at: text(authoredAt), subject: text(subject), body, mr, branch };
}

function normalizeReleaseBranch(releaseRef) {
  return text(releaseRef)
    .replace(/^refs\/remotes\/origin\//, '')
    .replace(/^origin\//, '')
    .replace(/^refs\/heads\//, '');
}

function commitParents(repoRoot, commit) {
  return runGit(repoRoot, ['rev-list', '--parents', '-n', '1', commit]).split(/\s+/).filter(Boolean).slice(1);
}

function changedPaths(repoRoot, commit) {
  const parents = commitParents(repoRoot, commit);
  const parent = parents[0] || `${commit}^`;
  const names = runGitStatus(repoRoot, ['diff', '--name-only', parent, commit]);
  const diff = runGitStatus(repoRoot, ['diff', '--no-ext-diff', '--unified=0', parent, commit]);
  const numstat = runGitStatus(repoRoot, ['diff', '--numstat', parent, commit]);
  return {
    paths: names.split('\n').map(text).filter(Boolean),
    diff_sha256: sha256Text(diff),
    diff_bytes: Buffer.byteLength(diff, 'utf8'),
    numstat: numstat.split('\n').map(text).filter(Boolean),
    parent,
    parent_count: parents.length,
  };
}

function parseTime(value) {
  const millis = Date.parse(value || '');
  return Number.isFinite(millis) ? new Date(millis) : null;
}

function isoNow() {
  return new Date().toISOString();
}

function addHours(date, hours) {
  return new Date(date.getTime() + hours * 60 * 60 * 1000);
}

function addDays(date, days) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

function isAncestor(repoRoot, ancestor, descendant) {
  if (!HEX40.test(ancestor) || !HEX40.test(descendant)) return false;
  try {
    execFileSync('git', ['merge-base', '--is-ancestor', ancestor, descendant], {
      cwd: repoRoot,
      stdio: 'ignore',
    });
    return true;
  } catch {
    return false;
  }
}

function resolveBoundary({
  repoRoot,
  releaseHead,
  baselineCommit = '',
  previousIntake = null,
  casebookBaselineCommit = '',
  now = new Date(),
  windowHours = QWORK_RELEASE_INTAKE_WINDOW_HOURS,
  fallbackDays = QWORK_RELEASE_INTAKE_FALLBACK_DAYS,
} = {}) {
  const candidates = [
    { commit: text(baselineCommit), source: 'explicit_baseline_commit' },
    {
      commit: ['READY', 'PASS'].includes(text(previousIntake?.decision || previousIntake?.status))
        ? text(previousIntake?.release?.head) : '',
      source: 'previous_intake_head',
    },
    { commit: text(casebookBaselineCommit), source: 'casebook_design_baseline' },
  ].filter((candidate) => HEX40.test(candidate.commit));
  const usable = candidates.find((candidate) => isAncestor(repoRoot, candidate.commit, releaseHead));
  const windowEnd = now;
  if (usable) {
    return {
      mode: 'commit_ancestry',
      source: usable.source,
      baseline_commit: usable.commit,
      window_start: null,
      window_end: windowEnd.toISOString(),
      ancestry_verified: true,
      fallback_reason: '',
    };
  }
  const requestedStart = addHours(now, -Number(windowHours || QWORK_RELEASE_INTAKE_WINDOW_HOURS));
  const fallbackStart = addDays(now, -Number(fallbackDays || QWORK_RELEASE_INTAKE_FALLBACK_DAYS));
  const attempted = candidates.length ? 'baseline_not_ancestor_or_missing' : 'baseline_not_provided';
  return {
    mode: 'time_window_fallback',
    source: 'time_window_fallback',
    baseline_commit: '',
    window_start: fallbackStart.toISOString(),
    requested_window_start: requestedStart.toISOString(),
    window_end: windowEnd.toISOString(),
    ancestry_verified: false,
    fallback_reason: attempted,
  };
}

function enumerateCommits({ repoRoot, releaseHead, boundary, maxCommits }) {
  const range = boundary.mode === 'commit_ancestry' && boundary.baseline_commit
    ? `${boundary.baseline_commit}..${releaseHead}`
    : releaseHead;
  const format = '%H%x1f%aI%x1f%s%x1f%B%x1e';
  const args = ['log', '--first-parent', '--reverse', '--max-count', String(maxCommits), `--pretty=format:${format}`];
  if (boundary.mode === 'commit_ancestry') args.splice(2, 0, range);
  else args.splice(2, 0, range, `--since=${boundary.window_start}`, `--until=${boundary.window_end}`);
  const raw = runGit(repoRoot, args, { allowFailure: true });
  return raw.split('\x1e').map((record) => record.trim()).filter(Boolean).map((record) => parseCommitRecord(record));
}

function parseLabels(value) {
  if (Array.isArray(value)) return value.map(text).filter(Boolean);
  return text(value).split(/[,，]/).map(text).filter(Boolean);
}

function rule(caseIds, featureDomain, riskDomain, patterns, requiredStage = 'G2') {
  return { case_ids: caseIds, feature_domain: featureDomain, risk_domain: riskDomain, patterns, required_stage: requiredStage };
}

const IMPACT_RULES = Object.freeze([
  rule(['MRSMOKE-AUTO-001', 'MRSMOKE-ROUTE-001', 'BETA-TASK-008'], '自动化与调度', '调度/任务隔离', [/automation|schedule|scheduler|interval|trigger|task-list|task_list/i], 'G2'),
  rule(['MRSMOKE-SKILL-001', 'SIT-SKILL-007'], 'Skill 与运行时能力', '能力安装/隔离', [/skill|skillhub|agent\/skills|runtime-fetch|resources\/builtin-skills|runtime-family|scripts\/agent-skills/i], 'G2'),
  rule(['MRSMOKE-CHART-001', 'SIT-CONN-016'], '连接器与交互图表', '工具调用/交互渲染', [/qcharts?|interactive.?chart|chart-tool|render_chart|connector|mcp|connection-view|diagram-tool-result/i], 'G2'),
  rule(['MRSMOKE-WEB-001', 'MRSMOKE-WEB-002'], 'Web 搜索与外链', '网络访问/SSRF', [/web-search|web_search|search-provider|ssrf|external-navigation|browser|managed-http-proxy|searxng/i], 'G2'),
  rule(['MRSMOKE-AUTH-001', 'BETA-SEC-002', 'BETA-CHAT-009'], '工作空间与安全', '授权/路径边界/脱敏', [/workspace|cwd|auth|authorization|credential|secret|symlink|path-traversal|security|db\/(?:migration|migrations)|organization-identity|control-plane-scope|server\/localdb/i], 'G2'),
  rule(['MRSMOKE-ART-001', 'BETA-ART-001', 'BETA-FILE-005'], '附件与成果', '文件输入/成果隔离', [/attachment|file-input|file_input|artifact|preview|markdown|upload|local-file|file-ingress/i], 'G2'),
  rule(['MRSMOKE-NAV-001', 'MRSMOKE-ENTRY-001', 'BETA-CHAT-007'], '导航与桌面 UI', '入口/会话列表/布局', [/sidebar|navigation|responsive|composer|chat-ui|history|entry|desktop-ui|(?:^|\/)src\/(?:App|app|main|Sidebar|AutomationView|components\/|activity-grouping)|(?:^|\/)src\/[^/]+\.(?:css|d\.ts)$|(?:app|expert-center|qbot)\.css/i], 'G2'),
  rule(['MRSMOKE-FAIL-001', 'MRSMOKE-ROUTE-001', 'BETA-CHAT-005'], '路由与失败收敛', '模型路由/重试/fallback', [/route|routing|fallback|retry|provider|model-sdk|error-redact|server\/(?:engine|llm-connections|prompt-|runtime-terminal|model-auto-routing)|electron\/(?:chat-user-error|client-error|preload)|(?:^|\/)src\/chat-(?:user-)?error|package(?:-lock)?\.json/i], 'G2'),
  rule(['BETA-INIT-001', 'BETA-HOST-003'], '宿主与发布运行时', 'OTA/宿主/版本身份', [/electron|desktop|teams|host-core|ota|quarantine|bootstrap|release|runtime|update|electron\/desktop-agent-host|\.deepbank-runtime|teams360\.host-sync|deploy\/(?:helm|k8s)\/qbot/i], 'G1'),
  // The repository was reorganized into explicit server/control-plane/qbot-core
  // domains.  These are known product locations, but a single file can affect
  // more than one user journey.  Keep the mapping deliberately broad so a
  // refactor cannot silently escape the real-device gates.
  rule([
    'MRSMOKE-ACT-001', 'MRSMOKE-WEB-001', 'MRSMOKE-WEB-002', 'MRSMOKE-AUTH-001',
    'MRSMOKE-AUTO-001', 'MRSMOKE-NAV-001', 'MRSMOKE-ROUTE-001', 'MRSMOKE-SKILL-001',
    'MRSMOKE-FAIL-001', 'MRSMOKE-ART-001', 'MRSMOKE-ENTRY-001', 'MRSMOKE-CHART-001',
  ], '已知产品源码目录', '跨域回归', [
    /(?:^|\/)server\/(?:qbot-core|control-plane|shared|expert-definition)\//i,
    /(?:^|\/)server\/[^/]+(?:\.[^/]+)?$/i,
    /(?:^|\/)src\//i,
    /(?:^|\/)electron\//i,
    /(?:^|\/)assets\/lib\/ui\//i,
    /(?:^|\/)resources\/builtin-skills\//i,
    /(?:^|\/)db\/(?:migrations|migration-manifests)\//i,
    /(?:^|\/)\.deepbank-runtime\//i,
    /(?:^|\/)(?:model-vision-capability|runtime-family|runtime-paths|release-identity|chart-tool-result|connection-view|diagram-tool-result)\.(?:mjs|cjs|ts|tsx)$/i,
  ], 'G2'),
]);

function staticDisposition(filePath) {
  const normalized = text(filePath).replaceAll('\\', '/');
  if (/^\.architecture\.ya?ml$/i.test(normalized)) return 'Repository-architecture-only';
  if (/^\.codex\/(?:environments\/environment\.toml|hooks\.json)$/i.test(normalized)) return 'Codex-governance-only';
  if (/^(?:CONTEXT\.md)$/i.test(normalized)) return 'Agent-metadata-only';
  if (/^(?:\.agent|\.agents|\.claude)\//i.test(normalized)
    || /(?:^|\/)(?:AGENTS|CLAUDE)\.md$/i.test(normalized)) return 'Agent-metadata-only';
  if (/^\.gitlab\//i.test(normalized) || /^\.gitlab-ci\.yml$|^\.github\//i.test(normalized)) return 'CI/governance-only';
  if (/^dashboard\//i.test(normalized) || /dashboard-admin|dashboard-admin-routes/i.test(normalized)) return 'Dashboard-only';
  if (/^eval\//i.test(normalized)) return 'Eval-only';
  if (/^(?:docs?|research|benchmark|openspec)\//i.test(normalized)) return 'Research/docs-only';
  if (/^(?:server\/(?:[^/]+\/)*docs|dashboard\/docs)\//i.test(normalized)) return 'Research/docs-only';
  if (/^(?:test|tests|testcase|scripts|toolchain)\//i.test(normalized)) return 'Toolchain/test-only';
  if (/^deploy\/dashboard\//i.test(normalized)) return 'Dashboard-only';
  if (/^deploy\//i.test(normalized)) return 'Deployment-only';
  if (/^(?:schemas?)\//i.test(normalized)) return 'Schema-contract-only';
  if (/^(?:\.env(?:\..*)?|\.gitignore|\.gitattributes|CODEOWNERS)$/i.test(normalized)) return 'Repository-metadata-only';
  if (/^(?:README|LICENSE|CHANGELOG)(?:\.|$)/i.test(normalized)) return 'Research/docs-only';
  return '';
}

function isProductSourcePath(filePath) {
  const normalized = text(filePath).replaceAll('\\', '/');
  if (staticDisposition(normalized)) return false;
  if (/^(?:README|LICENSE|CHANGELOG)(?:\.|$)/i.test(normalized)) return false;
  return PRODUCT_PATH.test(normalized) || Boolean(normalized);
}

export function mapReleaseImpact({ changedPaths: paths = [], subject = '', body = '', branch = '', labels = [], availableCaseIds = [] } = {}) {
  const files = [...new Set(paths.map((item) => text(item)).filter(Boolean))];
  const staticFiles = files.filter((file) => staticDisposition(file));
  const productFiles = files.filter((file) => isProductSourcePath(file));
  // Prefix paths with a slash so path rules also match when several paths are
  // joined into one searchable string (rules use ^|/ boundaries).
  // Purely static MRs (CI/Dashboard/docs/tests) must never become desktop E2E
  // impact merely because a branch title contains a word such as "runtime".
  const searchableFiles = productFiles.length ? productFiles : [];
  const searchText = productFiles.length
    ? `${branch} ${subject} ${body} ${searchableFiles.map((file) => `/${file}`).join(' ')} ${labels.join(' ')}`
    : '';
  const matchedRules = IMPACT_RULES.filter((candidate) => candidate.patterns.some((pattern) => pattern.test(searchText)));
  const direct = new Set(matchedRules.flatMap((candidate) => candidate.case_ids));
  const available = new Set(availableCaseIds.map(text).filter(Boolean));
  const allDirect = [...direct];
  const directAvailable = available.size ? allDirect.filter((id) => available.has(id)) : allDirect;
  const outOfScope = available.size ? allDirect.filter((id) => !available.has(id)) : [];
  // A title-level match can select the right Case set, but it cannot certify
  // every changed source file. Unknown product paths stay blocking until a
  // path rule (or an explicit Casebook mapping) covers that exact path.
  const unmappedPaths = productFiles.filter((file) => !IMPACT_RULES.some((candidate) => candidate.patterns.some((pattern) => pattern.test(file))));
  const domains = [...new Set(matchedRules.map((candidate) => candidate.feature_domain))];
  const risks = [...new Set(matchedRules.map((candidate) => candidate.risk_domain))];
  const requiredStages = new Set(['G1']);
  for (const candidate of matchedRules) requiredStages.add(candidate.required_stage);
  // Stage selection is based on the complete impact set, not only the current
  // Sheet projection. A smoke scan can still discover a BETA/SIT dependency
  // that requires the later production-risk gate.
  if (allDirect.some((id) => /^BETA-/.test(id))) requiredStages.add('G3');
  if (allDirect.some((id) => /^SIT-/.test(id))) requiredStages.add('G3');
  if (allDirect.some((id) => /^MRSMOKE-/.test(id))) requiredStages.add('G2');
  return {
    changed_paths: files,
    static_paths: staticFiles,
    product_paths: productFiles,
    feature_domains: domains,
    risk_domains: risks,
    direct_case_ids: allDirect.sort(),
    in_scope_case_ids: directAvailable.sort(),
    out_of_scope_case_ids: outOfScope.sort(),
    unmapped_product_paths: [...new Set(unmappedPaths)].sort(),
    static_dispositions: [...new Set(staticFiles.map((file) => ({ path: file, disposition: staticDisposition(file) })))],
    required_stages: [...requiredStages].filter(Boolean).sort(),
    mapping_status: unmappedPaths.length ? 'BLOCKED' : allDirect.length || staticFiles.length ? 'MAPPED' : 'UNKNOWN',
  };
}

function dependencyClosure(caseIds, availableCaseIds = []) {
  // Dependencies may live on another stage Sheet; keep them in the intake even
  // when the current Casebook projection contains only the smoke Cases.
  const available = new Set(availableCaseIds.map(text));
  const dependencies = new Set();
  const add = (...ids) => ids.forEach((id) => {
    if (available.size === 0 || available.has(id) || /^BETA-|^SIT-/.test(id)) dependencies.add(id);
  });
  for (const id of caseIds) {
    if (id === 'MRSMOKE-AUTO-001') add('BETA-TASK-008', 'BETA-ROUTE-001');
    if (id === 'MRSMOKE-SKILL-001') add('SIT-SKILL-007', 'BETA-SKILL-001', 'BETA-SKILL-002', 'BETA-SKILL-003', 'BETA-SKILL-004', 'BETA-SKILL-005', 'BETA-SKILL-014');
    if (id === 'MRSMOKE-AUTH-001') add('BETA-SEC-002', 'SIT-WORKSPACE-001');
    if (id === 'MRSMOKE-CHART-001') add('SIT-CONN-016');
    if (id === 'MRSMOKE-WEB-001' || id === 'MRSMOKE-WEB-002') add('BETA-CHAT-005', 'SIT-CONN-019');
    if (id === 'MRSMOKE-ART-001') add('BETA-ART-001', 'BETA-ART-002', 'BETA-ART-003', 'BETA-ART-004');
    if (id === 'MRSMOKE-FAIL-001' || id === 'MRSMOKE-ROUTE-001') add('BETA-CHAT-005', 'BETA-PERF-003');
    if (id === 'MRSMOKE-NAV-001' || id === 'MRSMOKE-ENTRY-001') add('BETA-CHAT-007');
    if (id === 'MRSMOKE-ACT-001') add('BETA-CHAT-007');
  }
  return [...dependencies].sort();
}

function curlConfig(url, token) {
  const escapedUrl = String(url).replaceAll('\\', '\\\\').replaceAll('"', '\\"');
  const escapedToken = String(token || '').replaceAll('\\', '\\\\').replaceAll('"', '\\"');
  return [
    `url = "${escapedUrl}"`,
    'silent',
    'show-error',
    'insecure',
    'max-time = 60',
    escapedToken ? `header = "PRIVATE-TOKEN: ${escapedToken}"` : '',
  ].filter(Boolean).join('\n') + '\n';
}

export function createGitLabReadOnlyReader({ host = QWORK_RELEASE_INTAKE_DEFAULT_GITLAB_HOST, projectPath = QWORK_RELEASE_INTAKE_DEFAULT_GITLAB_PROJECT, token = '' } = {}) {
  const encodedProject = encodeURIComponent(projectPath);
  const base = `https://${host}/api/v4/projects/${encodedProject}`;
  return (endpoint) => {
    const url = `${base}/${endpoint.replace(/^\//, '')}`;
    try {
      const stdout = execFileSync(process.platform === 'win32' ? 'curl.exe' : 'curl', ['--config', '-'], {
        input: curlConfig(url, token),
        encoding: 'utf8',
        maxBuffer: 50 * 1024 * 1024,
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      return JSON.parse(stdout);
    } catch (error) {
      const stderr = redact(error.stderr || error.message || 'GitLab API 请求失败', token);
      throw new Error(`GitLab 只读 API ${endpoint} 失败：${stderr}`);
    }
  };
}

function mergeRequestMetadata({ commits, readGitLab, requireGitLabMetadata = true, targetBranch = 'release/0.1' } = {}) {
  const byCommit = new Map();
  const byIid = new Map();
  const apiErrors = [];
  if (typeof readGitLab === 'function') {
    try {
      const endpointBase = 'merge_requests?state=merged&target_branch=release%2F0.1&per_page=100&order_by=updated_at&sort=desc';
      for (let page = 1; page <= QWORK_RELEASE_INTAKE_MAX_MR_PAGES; page += 1) {
        const rows = readGitLab(`${endpointBase}&page=${page}`);
        if (!Array.isArray(rows)) throw new Error('返回不是数组');
        for (const row of rows) {
          const iid = text(row.iid);
          if (iid) byIid.set(iid, row);
          if (text(row.merge_commit_sha)) byCommit.set(text(row.merge_commit_sha), row);
        }
        if (rows.length < 100) break;
      }
    } catch (error) {
      apiErrors.push(redact(error.message));
    }
  }
  const metadata = [];
  for (const commit of commits) {
    const row = byCommit.get(commit.commit) || (commit.mr ? byIid.get(commit.mr) : null);
    const iid = text(row?.iid || commit.mr);
    const verified = Boolean(row
      && iid
      && text(row.state) === 'merged'
      && text(row.target_branch) === targetBranch
      && text(row.merge_commit_sha) === commit.commit);
    const source = row ? 'gitlab-api' : 'git-commit-message';
    metadata.push({
      iid,
      title: text(row?.title || commit.subject),
      description_sha256: row?.description ? sha256Text(row.description) : '',
      labels: parseLabels(row?.labels),
      merged_at: text(row?.merged_at || commit.authored_at),
      merge_commit_sha: text(row?.merge_commit_sha || commit.commit),
      web_url: text(row?.web_url),
      source_branch: text(row?.source_branch),
      state: text(row?.state),
      target_branch: text(row?.target_branch),
      source,
      verified,
      commit: commit.commit,
    });
  }
  const missing = metadata.filter((item) => !item.iid || (requireGitLabMetadata && !item.verified));
  return {
    metadata,
    api_errors: apiErrors,
    unverified: missing.map((item) => item.iid || item.commit),
    api_available: apiErrors.length === 0 && typeof readGitLab === 'function',
  };
}

function apiBoundaryCandidates({ baselineCommit = '', previousIntake = null, casebookBaselineCommit = '' } = {}) {
  return [
    { commit: text(baselineCommit), source: 'explicit_baseline_commit' },
    {
      commit: ['READY', 'PASS'].includes(text(previousIntake?.decision || previousIntake?.status))
        ? text(previousIntake?.release?.head) : '',
      source: 'previous_intake_head',
    },
    { commit: text(casebookBaselineCommit), source: 'casebook_design_baseline' },
  ].filter((candidate) => HEX40.test(candidate.commit));
}

function reconstructFirstParentChain({ compare, baselineCommit, releaseHead } = {}) {
  if (baselineCommit === releaseHead) return { ok: true, commits: [] };
  if (!compare || !Array.isArray(compare.commits)) {
    return { ok: false, reason: 'compare_commits_missing', commits: [] };
  }
  if (compare.compare_timeout === true) {
    return { ok: false, reason: 'compare_timeout', commits: [] };
  }
  const commitMap = new Map(compare.commits
    .filter((item) => HEX40.test(text(item?.id)))
    .map((item) => [text(item.id), item]));
  const reversed = [];
  const seen = new Set();
  let cursor = releaseHead;
  while (cursor !== baselineCommit) {
    if (seen.has(cursor)) return { ok: false, reason: 'first_parent_cycle', commits: [] };
    seen.add(cursor);
    const row = commitMap.get(cursor);
    if (!row) return { ok: false, reason: `first_parent_commit_missing:${cursor}`, commits: [] };
    const parents = Array.isArray(row.parent_ids) ? row.parent_ids.map(text).filter(Boolean) : [];
    if (!parents.length) return { ok: false, reason: `first_parent_missing:${cursor}`, commits: [] };
    reversed.push(row);
    cursor = parents[0];
    if (!HEX40.test(cursor)) return { ok: false, reason: `first_parent_invalid:${row.id}`, commits: [] };
  }
  return { ok: true, commits: reversed.reverse() };
}

function apiChangedPaths(changes = []) {
  const normalized = changes.map((change) => ({
    old_path: text(change?.old_path),
    new_path: text(change?.new_path),
    new_file: Boolean(change?.new_file),
    renamed_file: Boolean(change?.renamed_file),
    deleted_file: Boolean(change?.deleted_file),
    diff: String(change?.diff || ''),
  }));
  const diffText = normalized.map((item) => stableJson(item)).join('\n');
  return {
    paths: [...new Set(normalized.map((item) => item.new_path || item.old_path).filter(Boolean))],
    diff_sha256: sha256Text(diffText),
    diff_bytes: Buffer.byteLength(diffText, 'utf8'),
    numstat: [],
  };
}

function scanWithGitLabApi({
  readGitLab,
  releaseRef,
  baselineCommit = '',
  previousIntake = null,
  casebookBaselineCommit = '',
  requireGitLabMetadata = true,
  maxCommits = QWORK_RELEASE_INTAKE_MAX_COMMITS,
  now = new Date(),
} = {}) {
  if (typeof readGitLab !== 'function') throw new Error('GitLab API freshness 需要只读 reader');
  const branch = normalizeReleaseBranch(releaseRef);
  const encodedBranch = encodeURIComponent(branch);
  const apiErrors = [];
  let before = null;
  try {
    before = readGitLab(`repository/branches/${encodedBranch}`);
  } catch (error) {
    apiErrors.push(redact(error.message));
  }
  const releaseHead = text(before?.commit?.id);
  const candidates = apiBoundaryCandidates({ baselineCommit, previousIntake, casebookBaselineCommit });
  let boundaryCandidate = null;
  let compare = null;
  let chain = { ok: false, reason: 'branch_head_unavailable', commits: [] };
  const compareAttempts = [];
  if (HEX40.test(releaseHead)) {
    for (const candidate of candidates) {
      try {
        const response = readGitLab(`repository/compare?from=${candidate.commit}&to=${releaseHead}&straight=true`);
        const attempt = reconstructFirstParentChain({ compare: response, baselineCommit: candidate.commit, releaseHead });
        compareAttempts.push({ baseline_commit: candidate.commit, source: candidate.source, ok: attempt.ok, reason: attempt.reason || '' });
        if (attempt.ok) {
          boundaryCandidate = candidate;
          compare = response;
          chain = attempt;
          break;
        }
      } catch (error) {
        compareAttempts.push({ baseline_commit: candidate.commit, source: candidate.source, ok: false, reason: redact(error.message) });
      }
    }
  }
  if (!boundaryCandidate && candidates.length === 0) chain = { ok: false, reason: 'baseline_not_provided', commits: [] };
  const selected = chain.commits.filter((commit) => Array.isArray(commit.parent_ids) && commit.parent_ids.length > 1);
  const limited = selected.slice(0, Number(maxCommits) || QWORK_RELEASE_INTAKE_MAX_COMMITS);
  const scannedCommits = [];
  const metadata = [];
  const unverified = [];
  for (const commit of limited) {
    const commitSha = text(commit.id);
    let mrRows = [];
    let mr = null;
    let changesPayload = null;
    try {
      mrRows = readGitLab(`repository/commits/${commitSha}/merge_requests`);
      if (!Array.isArray(mrRows)) throw new Error('commit merge requests 返回不是数组');
      const matches = mrRows.filter((row) => text(row?.merge_commit_sha) === commitSha
        && text(row?.target_branch) === branch
        && text(row?.state) === 'merged');
      if (matches.length !== 1) throw new Error(`精确 MR 数量必须为1，actual=${matches.length}`);
      [mr] = matches;
      changesPayload = readGitLab(`merge_requests/${mr.iid}/changes`);
      if (!changesPayload || !Array.isArray(changesPayload.changes) || changesPayload.changes.length === 0) {
        throw new Error('MR changes 缺失或为空');
      }
      if (changesPayload.overflow === true) throw new Error('MR changes overflow，无法证明完整源码变更集合');
      if (text(changesPayload.state) !== 'merged'
        || text(changesPayload.target_branch) !== branch
        || text(changesPayload.merge_commit_sha) !== commitSha
        || text(changesPayload.iid) !== text(mr.iid)) {
        throw new Error('MR changes 元数据与 first-parent merge commit 不一致');
      }
      if (!/^\d+$/.test(text(changesPayload.changes_count))) {
        throw new Error(`MR changes_count 非精确整数：${text(changesPayload.changes_count) || '(missing)'}`);
      }
      const declaredChanges = Number(changesPayload.changes_count);
      if (declaredChanges !== changesPayload.changes.length) {
        throw new Error(`MR changes 不完整：declared=${declaredChanges} actual=${changesPayload.changes.length}`);
      }
      const changed = apiChangedPaths(changesPayload.changes);
      scannedCommits.push({
        commit: commitSha,
        authored_at: text(commit.committed_date || commit.created_at || commit.authored_date),
        subject: text(commit.title || commit.message),
        body: text(commit.message),
        mr: text(mr.iid),
        branch: text(mr.source_branch || commit.title),
        parent: text(commit.parent_ids[0]),
        parent_count: commit.parent_ids.length,
        ...changed,
      });
      metadata.push({
        iid: text(mr.iid),
        title: text(mr.title),
        description_sha256: mr.description ? sha256Text(mr.description) : '',
        labels: parseLabels(mr.labels),
        merged_at: text(mr.merged_at || commit.committed_date || commit.created_at),
        merge_commit_sha: commitSha,
        web_url: text(mr.web_url),
        source_branch: text(mr.source_branch),
        state: text(mr.state),
        target_branch: text(mr.target_branch),
        source: 'gitlab-api-changes',
        verified: true,
        commit: commitSha,
      });
    } catch (error) {
      const iid = text(mr?.iid) || commitSha;
      unverified.push(iid);
      apiErrors.push(`commit ${commitSha}: ${redact(error.message)}`);
    }
  }
  let after = null;
  try {
    after = readGitLab(`repository/branches/${encodedBranch}`);
  } catch (error) {
    apiErrors.push(redact(error.message));
  }
  const releaseHeadAfter = text(after?.commit?.id);
  const compareComplete = Boolean(boundaryCandidate && chain.ok && limited.length === selected.length);
  const verified = Boolean(
    HEX40.test(releaseHead)
    && releaseHeadAfter === releaseHead
    && compareComplete
    && scannedCommits.length === selected.length
    && metadata.length === selected.length
    && unverified.length === 0,
  );
  return {
    releaseHead,
    boundary: {
      mode: 'commit_ancestry',
      source: boundaryCandidate?.source || 'gitlab_api_compare',
      baseline_commit: boundaryCandidate?.commit || '',
      window_start: null,
      window_end: now.toISOString(),
      ancestry_verified: Boolean(boundaryCandidate && chain.ok),
      fallback_reason: boundaryCandidate ? '' : (chain.reason || 'gitlab_api_compare_not_proven'),
      verification_source: 'gitlab-api',
      compare_attempts: compareAttempts,
    },
    scannedCommits,
    metadataAudit: {
      metadata,
      api_errors: apiErrors,
      unverified,
      api_available: apiErrors.length === 0,
    },
    freshness: {
      mode: 'gitlab-api',
      verified,
      branch,
      branch_head_before: releaseHead,
      branch_head_after: releaseHeadAfter,
      compare_from: boundaryCandidate?.commit || '',
      compare_to: releaseHead,
      compare_commit_count: Array.isArray(compare?.commits) ? compare.commits.length : 0,
      first_parent_merge_count: selected.length,
      first_parent_complete: compareComplete,
      mr_changes_verified_count: metadata.length,
    },
  };
}

function loadCaseIds({ caseIds = [], casebookPath = '', sheet = '', python = 'python3' } = {}) {
  const explicit = caseIds.map(text).filter(Boolean);
  if (explicit.length || !casebookPath) return explicit;
  const helper = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../skills/qbot-execute-automation-tests/scripts/casebook_io.py');
  if (!fs.existsSync(helper)) return [];
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'qbot-release-intake-'));
  const output = path.join(tempDir, 'cases.json');
  try {
    execFileSync(python, [helper, 'export-cases', '--casebook', path.resolve(casebookPath), '--sheet', sheet, '--profile', 'all', '--output', output], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 50 * 1024 * 1024 });
    const value = JSON.parse(fs.readFileSync(output, 'utf8'));
    return Array.isArray(value.cases) ? value.cases.map((item) => text(item.id)).filter(Boolean) : [];
  } catch {
    return [];
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

export function validateQworkReleaseIntake(report, {
  releaseRef = '',
  releaseHead = '',
  casebookSha256 = '',
  frameworkCommit = '',
  requireReady = true,
  requireFreshRef = false,
} = {}) {
  const failures = [];
  if (report?.schema_version !== QWORK_RELEASE_INTAKE_SCHEMA) failures.push('schema_mismatch');
  if (report?.tool?.version !== QWORK_RELEASE_INTAKE_TOOL_VERSION) failures.push('tool_version_mismatch');
  if (requireReady && report?.decision !== 'READY') failures.push(`decision_${report?.decision || 'missing'}`);
  if (!Array.isArray(report?.blockers)) failures.push('blockers_missing');
  if (report?.decision === 'READY' && Array.isArray(report.blockers) && report.blockers.length) failures.push('ready_with_blockers');
  if (report?.decision === 'BLOCKED' && Array.isArray(report.blockers) && report.blockers.length === 0) failures.push('blocked_without_reason');
  if (releaseRef && text(report?.release?.ref) !== text(releaseRef)) failures.push('release_ref_mismatch');
  if (releaseHead && text(report?.release?.head) !== text(releaseHead)) failures.push('release_head_mismatch');
  if (casebookSha256 && text(report?.casebook?.sha256).toLowerCase() !== text(casebookSha256).toLowerCase()) failures.push('casebook_sha256_mismatch');
  if (frameworkCommit && text(report?.framework?.commit) !== text(frameworkCommit)) failures.push('framework_commit_mismatch');
  const apiFreshness = report?.policy?.api_freshness;
  const apiFreshnessVerified = Boolean(apiFreshness
    && apiFreshness.mode === 'gitlab-api'
    && apiFreshness.verified === true
    && HEX40.test(text(apiFreshness.branch_head_before))
    && apiFreshness.branch_head_before === apiFreshness.branch_head_after
    && apiFreshness.branch_head_before === report?.release?.head
    && apiFreshness.first_parent_complete === true
    && Number(apiFreshness.mr_changes_verified_count) === Number(apiFreshness.first_parent_merge_count));
  if (requireFreshRef && report?.policy?.fetch_latest !== true && !apiFreshnessVerified) failures.push('release_ref_not_freshly_verified');
  if (!HEX40.test(text(report?.release?.head))) failures.push('release_head_invalid');
  if (report?.scan_boundary?.mode === 'commit_ancestry' && !report.scan_boundary.ancestry_verified) failures.push('ancestry_not_verified');
  if (report?.unresolved?.unmapped_product_paths?.length) failures.push('unmapped_product_paths');
  if (report?.unresolved?.unverified_mr_metadata?.length) failures.push('unverified_mr_metadata');
  if (report?.integrity?.content_sha256) {
    const copy = structuredClone(report);
    delete copy.integrity.content_sha256;
    if (sha256Text(stableJson(copy)) !== report.integrity.content_sha256) failures.push('content_sha256_mismatch');
  } else failures.push('content_sha256_missing');
  return { ok: failures.length === 0, failures };
}

export function scanQworkReleaseIntake({
  repoRoot,
  releaseRef = QWORK_RELEASE_INTAKE_DEFAULT_REF,
  baselineCommit = '',
  casebookBaselineCommit = '',
  previousIntakeFile = '',
  casebookPath = '',
  casebookSha256 = '',
  sheet = '',
  caseIds = [],
  frameworkCommit = '',
  gitlabReader,
  gitlabHost = QWORK_RELEASE_INTAKE_DEFAULT_GITLAB_HOST,
  gitlabProject = QWORK_RELEASE_INTAKE_DEFAULT_GITLAB_PROJECT,
  gitlabToken = '',
  requireGitLabMetadata = true,
  fetchLatest = true,
  now = new Date(),
  windowHours = QWORK_RELEASE_INTAKE_WINDOW_HOURS,
  fallbackDays = QWORK_RELEASE_INTAKE_FALLBACK_DAYS,
  maxCommits = QWORK_RELEASE_INTAKE_MAX_COMMITS,
  freshnessSource = 'git',
} = {}) {
  const root = path.resolve(repoRoot || '.');
  const previousIntake = previousIntakeFile && fs.existsSync(previousIntakeFile)
    ? JSON.parse(fs.readFileSync(previousIntakeFile, 'utf8')) : null;
  const reader = gitlabReader || createGitLabReadOnlyReader({ host: gitlabHost, projectPath: gitlabProject, token: gitlabToken });
  const useApiFreshness = text(freshnessSource) === 'gitlab-api';
  if (!useApiFreshness && fetchLatest) {
    const refName = text(releaseRef).replace(/^origin\//, '');
    const remote = text(releaseRef).startsWith('origin/') ? 'origin' : 'origin';
    runGit(root, ['fetch', '--no-tags', '--prune', remote, refName]);
  }
  const apiScan = useApiFreshness ? scanWithGitLabApi({
    readGitLab: reader,
    releaseRef,
    baselineCommit,
    previousIntake,
    casebookBaselineCommit,
    requireGitLabMetadata,
    maxCommits,
    now,
  }) : null;
  const releaseHead = apiScan?.releaseHead || runGit(root, ['rev-parse', releaseRef]);
  if (!HEX40.test(releaseHead)) throw new Error(`release ref 解析失败：${releaseRef}`);
  const boundary = apiScan?.boundary || resolveBoundary({ repoRoot: root, releaseHead, baselineCommit, previousIntake, casebookBaselineCommit, now, windowHours, fallbackDays });
  const commits = useApiFreshness ? [] : enumerateCommits({ repoRoot: root, releaseHead, boundary, maxCommits: Number(maxCommits) || QWORK_RELEASE_INTAKE_MAX_COMMITS });
  const scannedCommits = apiScan?.scannedCommits || commits.map((commit) => ({ ...commit, ...changedPaths(root, commit.commit) }));
  const ids = loadCaseIds({ caseIds, casebookPath, sheet });
  const metadataAudit = apiScan?.metadataAudit || mergeRequestMetadata({
    commits: scannedCommits,
    readGitLab: reader,
    requireGitLabMetadata,
    targetBranch: normalizeReleaseBranch(releaseRef),
  });
  const mergeRequests = scannedCommits.map((commit, index) => {
    const metadata = metadataAudit.metadata[index];
    const impact = mapReleaseImpact({ changedPaths: commit.paths, subject: commit.subject, body: commit.body, branch: commit.branch, labels: metadata.labels, availableCaseIds: ids });
    return {
      iid: metadata.iid,
      commit: commit.commit,
      parent: commit.parent,
      parent_count: commit.parent_count,
      title: metadata.title,
      branch: metadata.source_branch || commit.branch,
      merged_at: metadata.merged_at,
      labels: metadata.labels,
      web_url: metadata.web_url,
      metadata_source: metadata.source,
      metadata_verified: metadata.verified,
      changed_paths: commit.paths,
      diff_sha256: commit.diff_sha256,
      diff_bytes: commit.diff_bytes,
      numstat: commit.numstat,
      impact,
    };
  });
  const directCases = [...new Set(mergeRequests.flatMap((item) => item.impact.direct_case_ids))].sort();
  const dependencyCases = dependencyClosure(directCases, ids);
  const unmappedProductPaths = [...new Set(mergeRequests.flatMap((item) => item.impact.unmapped_product_paths))].sort();
  const unresolved = {
    unmapped_product_paths: unmappedProductPaths,
    out_of_scope_case_ids: [...new Set(mergeRequests.flatMap((item) => item.impact.out_of_scope_case_ids))].sort(),
    unverified_mr_metadata: metadataAudit.unverified,
    api_errors: metadataAudit.api_errors,
  };
  const blockers = [];
  if (boundary.mode === 'time_window_fallback') {
    blockers.push('无法证明扫描起点与 release HEAD 的祖先关系；时间窗口仅可作诊断兜底，正式执行必须提供可验证基线');
  }
  if (useApiFreshness && !apiScan?.freshness?.verified) {
    blockers.push('GitLab API freshness 未完整证明 branch HEAD、compare first-parent 链、MR changes 与扫描后 HEAD 稳定');
  }
  if (unresolved.unmapped_product_paths.length) blockers.push(`存在未映射产品源码路径：${unresolved.unmapped_product_paths.join(',')}`);
  if (requireGitLabMetadata && unresolved.unverified_mr_metadata.length) blockers.push(`MR 元数据未被 GitLab API 验证：${unresolved.unverified_mr_metadata.join(',')}`);
  if (requireGitLabMetadata && unresolved.api_errors.length && scannedCommits.length) blockers.push('GitLab 只读 API 不可用，不能确认 MR 元数据');
  if (Number(maxCommits) <= 0) blockers.push('max_commits 必须为正数');
  const report = {
    schema_version: QWORK_RELEASE_INTAKE_SCHEMA,
    generated_at: isoNow(),
    tool: { name: 'qbot-release-intake', version: QWORK_RELEASE_INTAKE_TOOL_VERSION },
    decision: blockers.length ? 'BLOCKED' : 'READY',
    release: { ref: text(releaseRef), head: releaseHead, repository: root },
    framework: { commit: text(frameworkCommit), tracked_clean_required: true },
    casebook: { path: text(casebookPath), sheet: text(sheet), sha256: text(casebookSha256).toLowerCase(), available_case_count: ids.length, available_case_ids: ids },
    scan_boundary: boundary,
    policy: {
      source_of_truth: 'commit-ancestry-first',
      time_window_is_fallback: true,
      daily_window_hours: QWORK_RELEASE_INTAKE_WINDOW_HOURS,
      overlap_hours: QWORK_RELEASE_INTAKE_OVERLAP_HOURS,
      fallback_days: Number(fallbackDays) || QWORK_RELEASE_INTAKE_FALLBACK_DAYS,
      fetch_latest: !useApiFreshness && Boolean(fetchLatest),
      api_freshness: apiScan?.freshness || null,
      metadata_read_only: true,
      require_gitlab_metadata: Boolean(requireGitLabMetadata),
      runner_must_not_rescan: true,
    },
    summary: {
      scanned_commit_count: scannedCommits.length,
      merge_request_count: mergeRequests.filter((item) => item.iid).length,
      direct_case_ids: directCases,
      dependency_case_ids: dependencyCases,
      required_stages: [...new Set(mergeRequests.flatMap((item) => item.impact.required_stages))].sort(),
      static_only_count: mergeRequests.filter((item) => item.impact.mapping_status === 'MAPPED' && item.impact.direct_case_ids.length === 0).length,
      unknown_count: mergeRequests.filter((item) => item.impact.mapping_status === 'UNKNOWN').length,
    },
    merge_requests: mergeRequests,
    unresolved,
    blockers,
    integrity: { content_sha256: '' },
  };
  const withoutHash = structuredClone(report);
  delete withoutHash.integrity.content_sha256;
  report.integrity.content_sha256 = sha256Text(stableJson(withoutHash));
  return report;
}

export function writeQworkReleaseIntake({ report, outDir } = {}) {
  const root = path.resolve(outDir || '');
  if (!root) throw new Error('release intake 输出目录不能为空');
  if (fs.existsSync(root) && fs.readdirSync(root).length) throw new Error(`release intake 输出目录必须是新的不可变目录：${root}`);
  fs.mkdirSync(root, { recursive: true });
  const jsonFile = path.join(root, QWORK_RELEASE_INTAKE_REPORT);
  const markdownFile = path.join(root, 'release-intake.md');
  const shaFile = path.join(root, 'release-intake.sha256');
  const payload = `${JSON.stringify(report, null, 2)}\n`;
  fs.writeFileSync(jsonFile, payload, { flag: 'wx', mode: 0o600 });
  const artifactSha256 = sha256File(jsonFile);
  const lines = [
    '# QWork Release Intake', '',
    `- 决策：**${report.decision}**`,
    `- release：\`${report.release.ref}@${report.release.head}\``,
    `- 扫描边界：${report.scan_boundary.mode}（${report.scan_boundary.source}）`,
    `- 直接合入 MR：${report.summary.merge_request_count}`,
    `- 直接影响 Case：${report.summary.direct_case_ids.join(', ') || '无'}`,
    `- 依赖闭包 Case：${report.summary.dependency_case_ids.join(', ') || '无'}`,
    `- 未映射产品路径：${report.unresolved.unmapped_product_paths.join(', ') || '无'}`,
    `- 未验证 MR：${report.unresolved.unverified_mr_metadata.join(', ') || '无'}`,
    '',
    ...(report.blockers.length ? ['## 阻塞项', '', ...report.blockers.map((item) => `- ${item}`), ''] : []),
    '该报告只读生成；正式 runner 启动后不得重新获取 MR 或改变测试范围。', '',
  ];
  fs.writeFileSync(markdownFile, `${lines.join('\n')}\n`, { flag: 'wx', mode: 0o600 });
  fs.writeFileSync(shaFile, `${artifactSha256}  ${QWORK_RELEASE_INTAKE_REPORT}\n`, { flag: 'wx', mode: 0o600 });
  return { json: jsonFile, markdown: markdownFile, sha256: shaFile, artifact_sha256: artifactSha256 };
}
