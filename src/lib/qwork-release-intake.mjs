import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  QWORK_RELEASE_SOURCE_CONTRACTS,
  auditCurrentReleaseSourceContract,
  auditKnownReleaseSourceContracts,
  releaseSourceContractProtectedPaths,
  releaseSourceContractTrigger,
  resolveCurrentReleaseHeaderContract,
  resolveReleaseSourceContracts,
  validateReleaseSourceContractsForReport,
} from './qwork-release-source-contracts.mjs';
import {
  QWORK_MR1552_EXECUTION_RUNNER_RISK_ID,
  QWORK_MR1552_MERGE_COMMIT_SHA,
  QWORK_MR1559_EXECUTION_RUNNER_SUCCESSOR_ID,
  QWORK_MR1559_MERGE_COMMIT_SHA,
  auditQworkReleaseBlockingRisk,
  qworkReleaseBlockingRiskProtectedPaths,
  validateQworkReleaseBlockingRisksForReport,
} from './qwork-release-blocking-risks.mjs';

export const QWORK_RELEASE_INTAKE_SCHEMA = 'qbot-qwork-release-intake/v1';
export const QWORK_RELEASE_INTAKE_TOOL_VERSION = 'qbot-release-intake/1.5.0';
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
const KNOWN_PRODUCT_PATHS = Object.freeze([
  /^server\/(?:qbot-core|control-plane|shared|expert-definition)\//i,
  /^server\/[^/]+$/i,
  /^src\//i,
  /^electron\//i,
  /^assets\/lib\/ui\//i,
  /^resources\/builtin-skills\//i,
  /^db\/(?:migrations|migration-manifests)\//i,
  /^\.deepbank-runtime\//i,
  /^(?:model-vision-capability|runtime-family|runtime-paths|release-identity|chart-tool-result|connection-view|diagram-tool-result)\.(?:mjs|cjs|js|ts|tsx)$/i,
  /^package(?:-lock)?\.json$/i,
]);

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

function isKnownProductSourcePath(filePath) {
  const normalized = text(filePath).replaceAll('\\', '/');
  if (staticDisposition(normalized)) return false;
  return KNOWN_PRODUCT_PATHS.some((pattern) => pattern.test(normalized));
}

export function mapReleaseImpact({ changedPaths: paths = [], subject = '', body = '', branch = '', labels = [], availableCaseIds = [] } = {}) {
  const files = [...new Set(paths.map((item) => text(item)).filter(Boolean))];
  const staticFiles = files.filter((file) => staticDisposition(file));
  const productFiles = files.filter((file) => !staticDisposition(file));
  const knownProductFiles = productFiles.filter((file) => isKnownProductSourcePath(file));
  const unknownFiles = productFiles.filter((file) => !isKnownProductSourcePath(file));
  // Prefix paths with a slash so path rules also match when several paths are
  // joined into one searchable string (rules use ^|/ boundaries).
  // Purely static MRs (CI/Dashboard/docs/tests) must never become desktop E2E
  // impact merely because a branch title contains a word such as "runtime".
  const searchableFiles = knownProductFiles.length ? knownProductFiles : [];
  const searchText = knownProductFiles.length
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
  const unmappedPaths = [
    ...unknownFiles,
    ...knownProductFiles.filter((file) => !IMPACT_RULES.some((candidate) => (
      candidate.patterns.some((pattern) => pattern.test(file))
    ))),
  ];
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
    known_product_paths: knownProductFiles,
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

function readCurrentReleaseContractFiles({ readGitLab, releaseHead, contracts, apiErrors }) {
  const protectedPaths = [...new Set(contracts.flatMap(releaseSourceContractProtectedPaths))];
  return protectedPaths.map((filePath) => {
    const endpoint = `repository/files/${encodeURIComponent(filePath)}?ref=${encodeURIComponent(releaseHead)}`;
    try {
      return {
        path: filePath,
        requested_ref: releaseHead,
        payload: readGitLab(endpoint),
      };
    } catch (error) {
      const message = redact(error?.message || 'repository file read failed');
      apiErrors.push(`source contract current release file ${filePath}: ${message}`);
      return {
        path: filePath,
        requested_ref: releaseHead,
        error: message,
      };
    }
  });
}

function readCurrentReleaseBlockingRiskFiles({ readGitLab, releaseHead, protectedPaths, apiErrors }) {
  return protectedPaths.map((filePath) => {
    const endpoint = `repository/files/${encodeURIComponent(filePath)}?ref=${encodeURIComponent(releaseHead)}`;
    try {
      return { path: filePath, requested_ref: releaseHead, payload: readGitLab(endpoint) };
    } catch (error) {
      const message = redact(error?.message || 'repository file read failed');
      apiErrors.push(`blocking risk current release file ${filePath}: ${message}`);
      return { path: filePath, requested_ref: releaseHead, error: message };
    }
  });
}

function verifyCurrentReleaseContractAncestry({ readGitLab, releaseHead, contract, apiErrors }) {
  const compareFrom = text(contract?.merge_commit_sha);
  const base = {
    compare_from: compareFrom,
    compare_to: releaseHead,
    compare_commit_count: 0,
    first_parent_complete: false,
    verified: false,
    reason: '',
  };
  if (compareFrom === releaseHead) {
    return {
      ...base,
      source: 'release-head-is-origin-merge',
      first_parent_complete: true,
      verified: true,
    };
  }
  if (!HEX40.test(compareFrom) || !HEX40.test(releaseHead)) {
    return { ...base, source: 'gitlab-api-compare-first-parent', reason: 'compare_identity_invalid' };
  }
  try {
    const compare = readGitLab(`repository/compare?from=${compareFrom}&to=${releaseHead}&straight=true`);
    const chain = reconstructFirstParentChain({
      compare,
      baselineCommit: compareFrom,
      releaseHead,
    });
    return {
      ...base,
      source: 'gitlab-api-compare-first-parent',
      compare_commit_count: Array.isArray(compare?.commits) ? compare.commits.length : 0,
      first_parent_complete: chain.ok,
      verified: chain.ok,
      reason: chain.ok ? '' : (chain.reason || 'origin_merge_ancestry_not_proven'),
    };
  } catch (error) {
    const message = redact(error?.message || 'source contract ancestry read failed');
    apiErrors.push(`source contract ${contract.contract_id} ancestry: ${message}`);
    return { ...base, source: 'gitlab-api-compare-first-parent', reason: message };
  }
}

function verifyReleaseBeforeContractAncestry({ readGitLab, releaseHead, contract, apiErrors }) {
  const compareTo = text(contract?.merge_commit_sha);
  const base = {
    source: 'gitlab-api-compare-first-parent',
    compare_from: releaseHead,
    compare_to: compareTo,
    compare_commit_count: 0,
    first_parent_complete: false,
    verified: false,
    reason: '',
  };
  if (compareTo === releaseHead) return { ...base, reason: 'compare_identities_equal' };
  if (!HEX40.test(compareTo) || !HEX40.test(releaseHead)) {
    return { ...base, reason: 'compare_identity_invalid' };
  }
  try {
    const compare = readGitLab(`repository/compare?from=${releaseHead}&to=${compareTo}&straight=true`);
    const chain = reconstructFirstParentChain({
      compare,
      baselineCommit: releaseHead,
      releaseHead: compareTo,
    });
    return {
      ...base,
      compare_commit_count: Array.isArray(compare?.commits) ? compare.commits.length : 0,
      first_parent_complete: chain.ok,
      verified: chain.ok,
      reason: chain.ok ? '' : (chain.reason || 'release_predecessor_ancestry_not_proven'),
    };
  } catch (error) {
    const message = redact(error?.message || 'reverse source contract ancestry read failed');
    apiErrors.push(`release before ${contract.contract_id} ancestry: ${message}`);
    return { ...base, reason: message };
  }
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

function mrAttributionKind({ commit, mr, branch } = {}) {
  const commitSha = text(commit?.id);
  const parentCount = Array.isArray(commit?.parent_ids) ? commit.parent_ids.length : 0;
  if (text(mr?.state) !== 'merged' || text(mr?.target_branch) !== branch) return '';
  if (parentCount > 1 && text(mr?.merge_commit_sha) === commitSha) return 'merge_mr';
  if (parentCount === 1 && text(mr?.squash_commit_sha) === commitSha) return 'squash_mr';
  return '';
}

function validateChangesAttribution({ commit, mr, changesPayload, branch, attributionKind } = {}) {
  if (!changesPayload || !Array.isArray(changesPayload.changes) || changesPayload.changes.length === 0) {
    throw new Error('MR changes 缺失或为空');
  }
  if (changesPayload.overflow === true) throw new Error('MR changes overflow，无法证明完整源码变更集合');
  if (text(changesPayload.state) !== 'merged'
    || text(changesPayload.target_branch) !== branch
    || text(changesPayload.iid) !== text(mr?.iid)) {
    throw new Error('MR changes 元数据与 first-parent commit 不一致');
  }
  const commitSha = text(commit?.id);
  if (attributionKind === 'merge_mr' && text(changesPayload.merge_commit_sha) !== commitSha) {
    throw new Error('MR changes merge_commit_sha 与多父 first-parent commit 不一致');
  }
  if (attributionKind === 'squash_mr' && text(changesPayload.squash_commit_sha) !== commitSha) {
    throw new Error('MR changes squash_commit_sha 与单父 first-parent commit 不一致');
  }
  for (const field of ['merge_commit_sha', 'squash_commit_sha']) {
    if (text(changesPayload[field]) !== text(mr?.[field])) {
      throw new Error(`MR changes ${field} 与 commit-to-MR 元数据不一致`);
    }
  }
  if (!/^\d+$/.test(text(changesPayload.changes_count))) {
    throw new Error(`MR changes_count 非精确整数：${text(changesPayload.changes_count) || '(missing)'}`);
  }
  const declaredChanges = Number(changesPayload.changes_count);
  if (declaredChanges !== changesPayload.changes.length) {
    throw new Error(`MR changes 不完整：declared=${declaredChanges} actual=${changesPayload.changes.length}`);
  }
}

function scanWithGitLabApi({
  readGitLab,
  releaseRef,
  baselineCommit = '',
  previousIntake = null,
  casebookBaselineCommit = '',
  requireGitLabMetadata = true,
  sourceContracts = QWORK_RELEASE_SOURCE_CONTRACTS,
  maxCommits = QWORK_RELEASE_INTAKE_MAX_COMMITS,
  now = new Date(),
} = {}) {
  if (typeof readGitLab !== 'function') throw new Error('GitLab API freshness 需要只读 reader');
  const effectiveSourceContracts = resolveReleaseSourceContracts(sourceContracts);
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
  const selected = chain.commits;
  const limited = selected.slice(0, Number(maxCommits) || QWORK_RELEASE_INTAKE_MAX_COMMITS);
  const scannedCommits = [];
  const metadata = [];
  const unverified = [];
  const commitAccounting = [];
  const unattributedDirectCommits = [];
  const originSourceContractAttestations = [];
  for (const commit of limited) {
    const commitSha = text(commit.id);
    const parentCount = Array.isArray(commit.parent_ids) ? commit.parent_ids.length : 0;
    let mrRows = [];
    let mr = null;
    let changesPayload = null;
    let attributionKind = '';
    try {
      mrRows = readGitLab(`repository/commits/${commitSha}/merge_requests`);
      if (!Array.isArray(mrRows)) throw new Error('commit merge requests 返回不是数组');
      const matches = mrRows.map((row) => ({
        row,
        kind: mrAttributionKind({ commit, mr: row, branch }),
      })).filter((candidate) => candidate.kind);
      if (matches.length !== 1) throw new Error(`精确 MR 数量必须为1，actual=${matches.length}`);
      [{ row: mr, kind: attributionKind }] = matches;
      changesPayload = readGitLab(`merge_requests/${mr.iid}/changes`);
      validateChangesAttribution({ commit, mr, changesPayload, branch, attributionKind });
      const attestations = auditKnownReleaseSourceContracts({
        iid: changesPayload.iid,
        state: changesPayload.state,
        targetBranch: changesPayload.target_branch,
        mergeCommitSha: changesPayload.merge_commit_sha,
        changesCount: changesPayload.changes_count,
        changes: changesPayload.changes,
      }, effectiveSourceContracts);
      originSourceContractAttestations.push(...attestations);
      const changed = apiChangedPaths(changesPayload.changes);
      scannedCommits.push({
        commit: commitSha,
        authored_at: text(commit.committed_date || commit.created_at || commit.authored_date),
        subject: text(commit.title || commit.message),
        body: text(commit.message),
        mr: text(mr.iid),
        branch: text(mr.source_branch || commit.title),
        parent: text(commit.parent_ids[0]),
        parent_count: parentCount,
        ...changed,
      });
      metadata.push({
        iid: text(mr.iid),
        title: text(mr.title),
        description_sha256: mr.description ? sha256Text(mr.description) : '',
        labels: parseLabels(mr.labels),
        merged_at: text(mr.merged_at || commit.committed_date || commit.created_at),
        merge_commit_sha: text(mr.merge_commit_sha),
        web_url: text(mr.web_url),
        source_branch: text(mr.source_branch),
        state: text(mr.state),
        target_branch: text(mr.target_branch),
        attribution_kind: attributionKind,
        squash_commit_sha: text(mr.squash_commit_sha),
        source: 'gitlab-api-changes',
        verified: true,
        commit: commitSha,
      });
      commitAccounting.push({
        commit: commitSha,
        parent_count: parentCount,
        classification: attributionKind,
        mr_iid: text(mr.iid),
        attribution_verified: true,
        reason: '',
      });
    } catch (error) {
      const iid = text(mr?.iid) || commitSha;
      unverified.push(iid);
      const reason = redact(error.message);
      apiErrors.push(`commit ${commitSha}: ${reason}`);
      const classification = parentCount > 1 ? 'merge_mr' : 'unattributed_direct_commit';
      commitAccounting.push({
        commit: commitSha,
        parent_count: parentCount,
        classification,
        mr_iid: text(mr?.iid),
        attribution_verified: false,
        reason,
      });
      if (classification === 'unattributed_direct_commit') unattributedDirectCommits.push(commitSha);
    }
  }
  const sourceContractMergeRequests = scannedCommits.map((commit, index) => ({
    iid: text(metadata[index]?.iid),
    commit: text(commit?.commit),
    changed_paths: Array.isArray(commit?.paths) ? commit.paths : [],
  }));
  const ancestryByContractId = new Map(effectiveSourceContracts.map((contract) => [
    contract.contract_id,
    verifyCurrentReleaseContractAncestry({
      readGitLab,
      releaseHead,
      contract,
      apiErrors,
    }),
  ]));
  const sourceContractAttestations = effectiveSourceContracts.map((contract) => {
    const originAttestations = originSourceContractAttestations
      .filter((attestation) => text(attestation?.contract_id) === contract.contract_id);
    const originAttestation = originAttestations.length === 1 ? originAttestations[0] : null;
    const ancestry = ancestryByContractId.get(contract.contract_id);
    const headerResolution = resolveCurrentReleaseHeaderContract(contract, {
      contracts: effectiveSourceContracts,
      ancestryByContractId,
    });
    const files = readCurrentReleaseContractFiles({
      readGitLab,
      releaseHead,
      contracts: [contract, headerResolution.owner],
      apiErrors,
    });
    const attestation = auditCurrentReleaseSourceContract({
      releaseHead,
      targetBranch: branch,
      originAncestry: ancestry,
      files,
      mergeRequests: sourceContractMergeRequests,
      originAttestation,
      contract,
      currentHeaderContract: headerResolution.owner,
      currentHeaderLineage: headerResolution.lineage,
    });
    if (originAttestations.length > 1) {
      const value = structuredClone(attestation);
      delete value.attestation_sha256;
      value.failures.push(`origin_change_attestation_count:${originAttestations.length}`);
      value.status = 'BLOCKED';
      value.verified = false;
      return { ...value, attestation_sha256: sha256Text(stableJson(value)) };
    }
    return attestation;
  });
  const sourceContractFailures = sourceContractAttestations.flatMap((attestation) => {
    if (attestation.verified === true && attestation.status === 'VERIFIED' && attestation.failures.length === 0) return [];
    const reasons = attestation.failures.length ? attestation.failures.join(',') : 'attestation_not_verified';
    return [`${attestation.contract_id}:${reasons}`];
  });
  const blockingRiskAncestry = verifyCurrentReleaseContractAncestry({
    readGitLab,
    releaseHead,
    contract: {
      contract_id: QWORK_MR1552_EXECUTION_RUNNER_RISK_ID,
      merge_commit_sha: QWORK_MR1552_MERGE_COMMIT_SHA,
    },
    apiErrors,
  });
  const blockingRiskSuccessorAncestry = verifyCurrentReleaseContractAncestry({
    readGitLab,
    releaseHead,
    contract: {
      contract_id: QWORK_MR1559_EXECUTION_RUNNER_SUCCESSOR_ID,
      merge_commit_sha: QWORK_MR1559_MERGE_COMMIT_SHA,
    },
    apiErrors,
  });
  const releaseBeforeBlockingRiskAncestry = verifyReleaseBeforeContractAncestry({
    readGitLab,
    releaseHead,
    contract: {
      contract_id: QWORK_MR1552_EXECUTION_RUNNER_RISK_ID,
      merge_commit_sha: QWORK_MR1552_MERGE_COMMIT_SHA,
    },
    apiErrors,
  });
  const releaseBeforeBlockingRiskSuccessorAncestry = verifyReleaseBeforeContractAncestry({
    readGitLab,
    releaseHead,
    contract: {
      contract_id: QWORK_MR1559_EXECUTION_RUNNER_SUCCESSOR_ID,
      merge_commit_sha: QWORK_MR1559_MERGE_COMMIT_SHA,
    },
    apiErrors,
  });
  const blockingRiskApplicable = releaseHead === QWORK_MR1552_MERGE_COMMIT_SHA
    || blockingRiskAncestry.verified === true;
  const blockingRiskProtectedPaths = qworkReleaseBlockingRiskProtectedPaths({
    releaseHead,
    successorAncestry: blockingRiskSuccessorAncestry,
    releaseBeforeSuccessorAncestry: releaseBeforeBlockingRiskSuccessorAncestry,
  });
  const blockingRiskAttestation = auditQworkReleaseBlockingRisk({
    releaseHead,
    originAncestry: blockingRiskAncestry,
    releaseBeforeOriginAncestry: releaseBeforeBlockingRiskAncestry,
    successorAncestry: blockingRiskSuccessorAncestry,
    releaseBeforeSuccessorAncestry: releaseBeforeBlockingRiskSuccessorAncestry,
    files: blockingRiskApplicable
      ? readCurrentReleaseBlockingRiskFiles({
        readGitLab,
        releaseHead,
        protectedPaths: blockingRiskProtectedPaths,
        apiErrors,
      })
      : [],
  });
  const blockingRisks = [blockingRiskAttestation];
  const blockingRiskFailures = [
    ...blockingRiskAttestation.failure_ids,
    ...blockingRiskAttestation.evidence_failures,
  ].map((failure) => `${blockingRiskAttestation.risk_id}:${failure}`);
  let after = null;
  try {
    after = readGitLab(`repository/branches/${encodedBranch}`);
  } catch (error) {
    apiErrors.push(redact(error.message));
  }
  const releaseHeadAfter = text(after?.commit?.id);
  const compareComplete = Boolean(boundaryCandidate && chain.ok && limited.length === selected.length);
  const mergeCommitCount = commitAccounting.filter((item) => item.classification === 'merge_mr').length;
  const squashMrCommitCount = commitAccounting.filter((item) => item.classification === 'squash_mr').length;
  const unattributedDirectCommitCount = commitAccounting
    .filter((item) => item.classification === 'unattributed_direct_commit').length;
  const attributedMrCommitCount = commitAccounting
    .filter((item) => item.attribution_verified === true && ['merge_mr', 'squash_mr'].includes(item.classification)).length;
  const sourceContractsVerified = sourceContractFailures.length === 0;
  const blockingRisksVerified = blockingRiskFailures.length === 0;
  const verified = Boolean(
    HEX40.test(releaseHead)
    && releaseHeadAfter === releaseHead
    && compareComplete
    && commitAccounting.length === selected.length
    && mergeCommitCount + squashMrCommitCount + unattributedDirectCommitCount === selected.length
    && unattributedDirectCommitCount === 0
    && scannedCommits.length === selected.length
    && metadata.length === selected.length
    && attributedMrCommitCount === selected.length
    && unverified.length === 0
    && apiErrors.length === 0
    && sourceContractsVerified
    && blockingRisksVerified,
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
    commitAccounting,
    unattributedDirectCommits,
    metadataAudit: {
      metadata,
      api_errors: apiErrors,
      unverified,
      api_available: apiErrors.length === 0,
    },
    sourceContracts: sourceContractAttestations,
    sourceContractFailures,
    blockingRisks,
    blockingRiskFailures,
    freshness: {
      mode: 'gitlab-api',
      verified,
      branch,
      branch_head_before: releaseHead,
      branch_head_after: releaseHeadAfter,
      compare_from: boundaryCandidate?.commit || '',
      compare_to: releaseHead,
      compare_commit_count: Array.isArray(compare?.commits) ? compare.commits.length : 0,
      first_parent_commit_count: selected.length,
      accounted_commit_count: commitAccounting.length,
      merge_commit_count: mergeCommitCount,
      squash_mr_commit_count: squashMrCommitCount,
      unattributed_direct_commit_count: unattributedDirectCommitCount,
      attributed_mr_commit_count: attributedMrCommitCount,
      first_parent_merge_count: mergeCommitCount + squashMrCommitCount,
      first_parent_complete: compareComplete,
      mr_changes_verified_count: metadata.length,
      source_contract_count: sourceContractAttestations.length,
      source_contract_verified_count: sourceContractAttestations.filter((item) => item.verified === true && item.status === 'VERIFIED').length,
      source_contract_current_count: sourceContractAttestations.length,
      source_contract_current_verified_count: sourceContractAttestations
        .filter((item) => item.verified === true && item.status === 'VERIFIED').length,
      source_contract_origin_count: sourceContractAttestations
        .filter((item) => item.origin_change_attestation !== null).length,
      source_contract_origin_verified_count: sourceContractAttestations
        .filter((item) => item.origin_change_attestation?.verified === true
          && item.origin_change_attestation?.status === 'VERIFIED').length,
      source_contracts_verified: sourceContractsVerified,
      blocking_risk_count: blockingRisks.length,
      blocking_risk_applicable_count: blockingRisks.filter((item) => item.applicable === true).length,
      blocking_risk_verified_count: blockingRisks.filter((item) => item.verified === true).length,
      blocking_risk_failure_count: blockingRiskFailures.length,
      blocking_risks_verified: blockingRisksVerified,
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

function validateApiCommitAccounting(report) {
  const freshness = report?.policy?.api_freshness;
  if (!freshness) return { ok: true, failures: [] };
  const failures = [];
  const accounting = Array.isArray(report?.commit_accounting) ? report.commit_accounting : null;
  if (!accounting) return { ok: false, failures: ['rows_missing'] };
  const validClassifications = new Set(['merge_mr', 'squash_mr', 'unattributed_direct_commit']);
  const commits = new Set();
  for (const [index, row] of accounting.entries()) {
    const commit = text(row?.commit);
    const parentCount = Number(row?.parent_count);
    const classification = text(row?.classification);
    if (!HEX40.test(commit)) failures.push(`commit_invalid:${index}`);
    if (commits.has(commit)) failures.push(`commit_duplicate:${commit || index}`);
    commits.add(commit);
    if (!Number.isSafeInteger(parentCount) || parentCount < 1) failures.push(`parent_count_invalid:${commit || index}`);
    if (!validClassifications.has(classification)) failures.push(`classification_invalid:${commit || index}`);
    if (classification === 'merge_mr' && parentCount <= 1) failures.push(`merge_parent_count_invalid:${commit || index}`);
    if (['squash_mr', 'unattributed_direct_commit'].includes(classification) && parentCount !== 1) {
      failures.push(`single_parent_count_invalid:${commit || index}`);
    }
    if (classification === 'squash_mr' && row?.attribution_verified !== true) {
      failures.push(`squash_attribution_invalid:${commit || index}`);
    }
    if (classification === 'unattributed_direct_commit' && row?.attribution_verified !== false) {
      failures.push(`direct_attribution_invalid:${commit || index}`);
    }
    if (row?.attribution_verified === true && !text(row?.mr_iid)) failures.push(`verified_mr_iid_missing:${commit || index}`);
    if (row?.attribution_verified === false && !text(row?.reason)) failures.push(`unverified_reason_missing:${commit || index}`);
  }
  const mergeCount = accounting.filter((row) => row?.classification === 'merge_mr').length;
  const squashCount = accounting.filter((row) => row?.classification === 'squash_mr').length;
  const directRows = accounting.filter((row) => row?.classification === 'unattributed_direct_commit');
  const verifiedMrRows = accounting.filter((row) => (
    row?.attribution_verified === true && ['merge_mr', 'squash_mr'].includes(row?.classification)
  ));
  const exactCount = (field, expected) => {
    const actual = Number(freshness?.[field]);
    if (!Number.isSafeInteger(actual) || actual !== expected) failures.push(`${field}_mismatch`);
  };
  exactCount('first_parent_commit_count', accounting.length);
  exactCount('accounted_commit_count', accounting.length);
  exactCount('merge_commit_count', mergeCount);
  exactCount('squash_mr_commit_count', squashCount);
  exactCount('unattributed_direct_commit_count', directRows.length);
  exactCount('attributed_mr_commit_count', verifiedMrRows.length);
  exactCount('first_parent_merge_count', mergeCount + squashCount);
  exactCount('mr_changes_verified_count', verifiedMrRows.length);
  if (mergeCount + squashCount + directRows.length !== accounting.length) failures.push('classification_total_mismatch');
  const unresolvedDirect = Array.isArray(report?.unresolved?.unattributed_direct_commits)
    ? report.unresolved.unattributed_direct_commits.map(text).sort() : null;
  const expectedDirect = directRows.map((row) => text(row.commit)).sort();
  if (!unresolvedDirect || stableJson(unresolvedDirect) !== stableJson(expectedDirect)) {
    failures.push('unattributed_direct_commits_mismatch');
  }
  const mergeRequests = Array.isArray(report?.merge_requests) ? report.merge_requests : [];
  const expectedMrCommits = verifiedMrRows.map((row) => text(row.commit)).sort();
  const actualMrCommits = mergeRequests.map((row) => text(row?.commit)).sort();
  if (stableJson(actualMrCommits) !== stableJson(expectedMrCommits)) failures.push('merge_request_commits_mismatch');
  if (Number(report?.summary?.scanned_commit_count) !== mergeRequests.length) failures.push('summary_scanned_commit_count_mismatch');
  if (Number(report?.summary?.merge_request_count) !== mergeRequests.filter((row) => text(row?.iid)).length) {
    failures.push('summary_merge_request_count_mismatch');
  }
  if (freshness.verified === true && (directRows.length > 0
    || verifiedMrRows.length !== accounting.length
    || failures.length > 0)) {
    failures.push('verified_with_incomplete_commit_accounting');
  }
  return { ok: failures.length === 0, failures: [...new Set(failures)] };
}

export function validateQworkReleaseIntake(report, {
  releaseRef = '',
  releaseHead = '',
  casebookSha256 = '',
  frameworkCommit = '',
  requireReady = true,
  requireFreshRef = false,
  sourceContracts = QWORK_RELEASE_SOURCE_CONTRACTS,
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
  const commitAccountingValidation = validateApiCommitAccounting(report);
  failures.push(...commitAccountingValidation.failures.map((failure) => `commit_accounting:${failure}`));
  const apiFreshnessVerified = Boolean(apiFreshness
    && apiFreshness.mode === 'gitlab-api'
    && apiFreshness.verified === true
    && HEX40.test(text(apiFreshness.branch_head_before))
    && apiFreshness.branch_head_before === apiFreshness.branch_head_after
    && apiFreshness.branch_head_before === report?.release?.head
    && apiFreshness.first_parent_complete === true
    && commitAccountingValidation.ok
    && Number(apiFreshness.unattributed_direct_commit_count) === 0
    && Number(apiFreshness.mr_changes_verified_count) === Number(apiFreshness.first_parent_merge_count)
    && apiFreshness.source_contracts_verified === true
    && apiFreshness.blocking_risks_verified === true);
  if (requireFreshRef && report?.policy?.fetch_latest !== true && !apiFreshnessVerified) failures.push('release_ref_not_freshly_verified');
  if (!HEX40.test(text(report?.release?.head))) failures.push('release_head_invalid');
  if (report?.scan_boundary?.mode === 'commit_ancestry' && !report.scan_boundary.ancestry_verified) failures.push('ancestry_not_verified');
  if (report?.unresolved?.unmapped_product_paths?.length) failures.push('unmapped_product_paths');
  if (report?.unresolved?.unverified_mr_metadata?.length) failures.push('unverified_mr_metadata');
  if (report?.unresolved?.unattributed_direct_commits?.length) failures.push('unattributed_direct_commits');
  if (report?.unresolved?.source_contract_failures?.length) failures.push('source_contract_failures');
  const sourceContractValidation = validateReleaseSourceContractsForReport(report, sourceContracts);
  failures.push(...sourceContractValidation.failures.map((failure) => `source_contract:${failure}`));
  if (report?.policy?.api_freshness || report?.blocking_risks?.length) {
    const blockingRiskValidation = validateQworkReleaseBlockingRisksForReport(report);
    failures.push(...blockingRiskValidation.failures.map((failure) => `blocking_risk:${failure}`));
  }
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
  sourceContracts = QWORK_RELEASE_SOURCE_CONTRACTS,
  fetchLatest = true,
  now = new Date(),
  windowHours = QWORK_RELEASE_INTAKE_WINDOW_HOURS,
  fallbackDays = QWORK_RELEASE_INTAKE_FALLBACK_DAYS,
  maxCommits = QWORK_RELEASE_INTAKE_MAX_COMMITS,
  freshnessSource = 'git',
} = {}) {
  const root = path.resolve(repoRoot || '.');
  const effectiveSourceContracts = resolveReleaseSourceContracts(sourceContracts);
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
    sourceContracts: effectiveSourceContracts,
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
  const sourceContractAttestations = apiScan?.sourceContracts || [];
  const blockingRisks = apiScan?.blockingRisks || [];
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
      attribution_kind: metadata.attribution_kind || (commit.parent_count > 1 ? 'merge_mr' : ''),
      merge_commit_sha: text(metadata.merge_commit_sha),
      squash_commit_sha: text(metadata.squash_commit_sha),
      changed_paths: commit.paths,
      diff_sha256: commit.diff_sha256,
      diff_bytes: commit.diff_bytes,
      numstat: commit.numstat,
      source_contract_ids: effectiveSourceContracts
        .filter((contract) => releaseSourceContractTrigger({
          iid: metadata.iid,
          commit: commit.commit,
          changed_paths: commit.paths,
        }, contract).triggered)
        .map((contract) => contract.contract_id),
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
    unattributed_direct_commits: [...new Set(apiScan?.unattributedDirectCommits || [])].sort(),
    api_errors: metadataAudit.api_errors,
    source_contract_failures: [...new Set(apiScan?.sourceContractFailures || [])],
    blocking_risk_failures: [...new Set(apiScan?.blockingRiskFailures || [])],
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
  if (unresolved.unattributed_direct_commits.length) {
    blockers.push(`first-parent 链存在无法可信归因到 merged MR 的单父提交：${unresolved.unattributed_direct_commits.join(',')}`);
  }
  if (requireGitLabMetadata && unresolved.api_errors.length && scannedCommits.length) blockers.push('GitLab 只读 API 不可用，不能确认 MR 元数据');
  if (unresolved.source_contract_failures.length) blockers.push('源码静态合同审计未通过，不能确认受保护源码字节与接线关系');
  if (unresolved.blocking_risk_failures.length) blockers.push('release 阻断风险审计未通过，存在必须在 G0 修复的 P1 执行隔离缺陷');
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
      source_contract_count: sourceContractAttestations.length,
      source_contract_verified_count: sourceContractAttestations.filter((item) => item.verified === true && item.status === 'VERIFIED').length,
      source_contract_current_count: sourceContractAttestations.length,
      source_contract_current_verified_count: sourceContractAttestations
        .filter((item) => item.verified === true && item.status === 'VERIFIED').length,
      source_contract_origin_count: sourceContractAttestations
        .filter((item) => item.origin_change_attestation !== null).length,
      source_contract_origin_verified_count: sourceContractAttestations
        .filter((item) => item.origin_change_attestation?.verified === true
          && item.origin_change_attestation?.status === 'VERIFIED').length,
      source_contract_failure_count: unresolved.source_contract_failures.length,
      blocking_risk_count: blockingRisks.length,
      blocking_risk_applicable_count: blockingRisks.filter((item) => item.applicable === true).length,
      blocking_risk_verified_count: blockingRisks.filter((item) => item.verified === true && item.status === 'VERIFIED').length,
      blocking_risk_failure_count: unresolved.blocking_risk_failures.length,
    },
    commit_accounting: apiScan?.commitAccounting || [],
    merge_requests: mergeRequests,
    source_contracts: sourceContractAttestations,
    blocking_risks: blockingRisks,
    unresolved,
    blockers,
    integrity: { content_sha256: '' },
  };
  const sourceContractValidation = validateReleaseSourceContractsForReport(report, effectiveSourceContracts);
  unresolved.source_contract_failures = [...sourceContractValidation.unresolved_failures];
  report.summary.source_contract_failure_count = unresolved.source_contract_failures.length;
  if (!sourceContractValidation.ok) {
    if (report.policy.api_freshness) {
      report.policy.api_freshness.verified = false;
      report.policy.api_freshness.source_contracts_verified = false;
    }
    if (!blockers.includes('源码静态合同审计未通过，不能确认受保护源码字节与接线关系')) {
      blockers.push('源码静态合同审计未通过，不能确认受保护源码字节与接线关系');
    }
    report.decision = 'BLOCKED';
  }
  const convergedSourceContractValidation = validateReleaseSourceContractsForReport(report, effectiveSourceContracts);
  const accountingFailures = convergedSourceContractValidation.failures.filter((failure) => [
    'source_contract_unresolved_missing',
    'source_contract_unresolved_duplicate',
    'source_contract_unresolved_mismatch',
    'source_contract_summary_count_mismatch',
    'source_contract_summary_verified_count_mismatch',
    'source_contract_summary_failure_count_mismatch',
  ].includes(failure));
  if (accountingFailures.length) {
    throw new Error(`release intake 源码合同报告无法收敛：${accountingFailures.join(',')}`);
  }
  const blockingRiskValidation = validateQworkReleaseBlockingRisksForReport(report);
  unresolved.blocking_risk_failures = [...blockingRiskValidation.unresolved_failures];
  report.summary.blocking_risk_failure_count = unresolved.blocking_risk_failures.length;
  if (unresolved.blocking_risk_failures.length) {
    if (report.policy.api_freshness) {
      report.policy.api_freshness.verified = false;
      report.policy.api_freshness.blocking_risks_verified = false;
    }
    if (!blockers.includes('release 阻断风险审计未通过，存在必须在 G0 修复的 P1 执行隔离缺陷')) {
      blockers.push('release 阻断风险审计未通过，存在必须在 G0 修复的 P1 执行隔离缺陷');
    }
    report.decision = 'BLOCKED';
  }
  const withoutHash = structuredClone(report);
  delete withoutHash.integrity.content_sha256;
  report.integrity.content_sha256 = sha256Text(stableJson(withoutHash));
  if (report.decision === 'READY') {
    const validation = validateQworkReleaseIntake(report, { requireReady: true, sourceContracts: effectiveSourceContracts });
    if (!validation.ok) {
      throw new Error(`release intake 生成后自校验失败：${validation.failures.join(',')}`);
    }
  }
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
  const blockingRiskEvidence = (Array.isArray(report.blocking_risks) ? report.blocking_risks : [])
    .flatMap((risk) => [
      `### \`${text(risk?.risk_id) || 'unknown-risk'}\``,
      '',
      `- MR：\`!${text(risk?.mr_iid) || 'unknown'}\`，merge \`${text(risk?.merge_commit_sha) || 'unknown'}\``,
      `- 当前 release：\`${text(risk?.release_head) || 'unknown'}\``,
      `- 适用：${risk?.applicable === true ? '是' : '否'}（${text(risk?.activation_source) || 'unknown'}）`,
      `- 架构断言：\`${text(risk?.architecture) || 'unknown'}\`（${text(risk?.architecture_activation_source) || 'unknown'}）`,
      `- 断言 owner：\`${text(risk?.assertion_owner?.contract_id) || 'unknown'}\` / MR \`!${text(risk?.assertion_owner?.mr_iid) || 'unknown'}\``,
      `- 状态：\`${text(risk?.status) || 'unknown'}\`，attestation \`${text(risk?.attestation_sha256) || 'missing'}\``,
      `- 失败断言：${Array.isArray(risk?.failure_ids) && risk.failure_ids.length
        ? risk.failure_ids.map((id) => `\`${text(id)}\``).join('、')
        : '无'}`,
      `- 证据读取失败：${Array.isArray(risk?.evidence_failures) && risk.evidence_failures.length
        ? risk.evidence_failures.map((item) => `\`${text(item)}\``).join('、')
        : '无'}`,
      '',
      '断言观测：',
      '',
      ...(Array.isArray(risk?.checks) ? risk.checks.map((check) => (
        `- \`${text(check?.id) || 'unknown-check'}\`：${check?.passed === true ? 'PASS' : check?.passed === false ? 'FAIL' : 'N/A'}；\`${JSON.stringify(check?.observations || {})}\``
      )) : []),
      '',
      '源码证据：',
      '',
      ...(Array.isArray(risk?.source_files) ? risk.source_files.map((file) => (
        `- \`${text(file?.path) || 'unknown-path'}\`：bytes=${Number(file?.bytes) || 0}，sha256=\`${text(file?.sha256) || 'missing'}\`，commit=\`${text(file?.commit_id) || 'missing'}\`，blob=\`${text(file?.blob_id) || 'missing'}\``
      )) : []),
      '',
    ]);
  const lines = [
    '# QWork Release Intake', '',
    `- 决策：**${report.decision}**`,
    `- release：\`${report.release.ref}@${report.release.head}\``,
    `- 扫描边界：${report.scan_boundary.mode}（${report.scan_boundary.source}）`,
    `- 直接合入 MR：${report.summary.merge_request_count}`,
    `- first-parent 提交核算：${report.policy.api_freshness
      ? `${report.policy.api_freshness.accounted_commit_count}/${report.policy.api_freshness.first_parent_commit_count}`
      : '本地 Git 模式'}`,
    `- 源码静态合同：${report.summary.source_contract_verified_count}/${report.summary.source_contract_count} 已验证`,
    `- 阻断风险审计：${report.summary.blocking_risk_verified_count}/${report.summary.blocking_risk_applicable_count} 个适用风险已验证`,
    `- 直接影响 Case：${report.summary.direct_case_ids.join(', ') || '无'}`,
    `- 依赖闭包 Case：${report.summary.dependency_case_ids.join(', ') || '无'}`,
    `- 未映射产品路径：${report.unresolved.unmapped_product_paths.join(', ') || '无'}`,
    `- 未验证 MR：${report.unresolved.unverified_mr_metadata.join(', ') || '无'}`,
    `- 未归因 direct commit：${report.unresolved.unattributed_direct_commits.join(', ') || '无'}`,
    `- 源码合同失败：${report.unresolved.source_contract_failures.join(', ') || '无'}`,
    `- 阻断风险失败：${report.unresolved.blocking_risk_failures.join(', ') || '无'}`,
    '',
    ...(report.blockers.length ? ['## 阻塞项', '', ...report.blockers.map((item) => `- ${item}`), ''] : []),
    ...(blockingRiskEvidence.length ? [
      '## 阻断风险证据', '',
      '以下内容来自当前 release HEAD 的 GitLab 只读源码读回；它证明静态风险状态，不声称产品测试已执行。', '',
      ...blockingRiskEvidence,
    ] : []),
    '该报告只读生成；正式 runner 启动后不得重新获取 MR 或改变测试范围。', '',
  ];
  fs.writeFileSync(markdownFile, `${lines.join('\n')}\n`, { flag: 'wx', mode: 0o600 });
  fs.writeFileSync(shaFile, `${artifactSha256}  ${QWORK_RELEASE_INTAKE_REPORT}\n`, { flag: 'wx', mode: 0o600 });
  return { json: jsonFile, markdown: markdownFile, sha256: shaFile, artifact_sha256: artifactSha256 };
}
