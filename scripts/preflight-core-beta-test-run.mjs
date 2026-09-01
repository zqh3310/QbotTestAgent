#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  classifyCoreBetaScopedFixtureExclusions,
  coreBetaScenarioSpec,
  validateCoreBetaCasePlan,
  validateCoreBetaScopedSelection,
} from '../src/lib/core-beta-case-protocol.mjs';
import {
  inspectCoreBetaFixtureReadiness,
  validateProductionCasePlan,
} from '../src/lib/ui-agent-casebook-runner-v2.mjs';
import {
  normalizeQworkReleaseIdentity,
  qworkReleaseIdentityFingerprint,
} from '../src/lib/qwork-release-test-plan.mjs';
import {
  sha256File as sha256ReleaseIntakeFile,
  validateQworkReleaseIntake,
} from '../src/lib/qwork-release-intake.mjs';
import {
  processMatchesSession,
  readSession,
} from '../teams360-automation/lib/launcher.mjs';
import {
  inspectManagedTeamsRestartCapability,
  validateLiveCasebookSession,
} from '../teams360-automation/lib/casebook-runner.mjs';
import { assessRuntimeReleaseStatus } from '../teams360-automation/lib/cdp-webview.mjs';
import {
  assessQworkReleaseIdentity,
  readQworkReleaseIdentity,
} from '../teams360-automation/lib/qwork-release-identity.mjs';
import { inspectTeamsCdp } from '../teams360-automation/lib/targets.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_SESSION = path.join(ROOT, 'teams360-automation', 'state', 'session.json');
const DEFAULT_TEAMS_APP = '/Applications/360Teams.app';
const TRUE_VALUES = new Set(['1', 'true', 'yes']);

function usage() {
  return `Core Beta real-run pretest (read-only)

Usage:
  npm run core-beta:pretest -- \\
    --casebook <xlsx> \\
    --sheet <exact-name> \\
    --profile mandatory \\
    --lane teams|local \\
    --out <new-directory> \\
    --expected-count <n> \\
    --expected-sha256 <sha256> \\
    --core-beta-fixture-control-url <loopback-url> \\
    [release identity options]

Teams production-gate identity options:
  --expected-teams-version <version>
  --expected-teams-build <build>
  --expected-qwork-version <version>
  --expected-control-plane-origin <https-origin>
  --backend-version <id>
  --prompt-policy-version <id>
  --feature-flags-hash <sha256>
  --qwork-ui-git-commit <commit>
  --qwork-build-id <id>
  --qwork-release-manifest-sha256 <sha256>
  --release-intake <release-intake.json>  G0 前置的只读 MR/源码扫描报告
  --release-intake-sha256 <sha256>        可选的报告文件 SHA-256
  --require-release-intake true           正式 release-gate 默认应开启
  --native-ime-command <command> Command used by the runner for BETA-CHAT-010.
                                  With QBOT_CORE_BETA_IME_PROBE=1 it must make
                                  no input and return the probe JSON contract.

Local lane:
  --cdp <loopback-url>            Default: http://127.0.0.1:9224
  --health-url <http-url>         Optional runtime/control-plane health endpoint
  --restart-command <command>     Required when selected Cases need managed restart

Controls:
  --production-gate true         Requires every frozen identity input
  --case <id[,id...]>             Optional targeted ordered selection
  --scoped-execution true        Explicit non-release subset execution
  --excluded-case <id[,id...]>   Exact Case IDs omitted from the scope
  --scope-reason <text>          Required immutable exclusion reason
  --no-framework-checks          Skip npm checks only for diagnostics/tests;
                                  never use for a formal release run

This command never starts a runner, launches/restarts 360Teams, opens QWork,
sends a message, or writes synthetic Case results. READY is required for a
full batch; READY_SCOPED only authorizes the exact matching scoped runner and
is never release-gate eligible.
`;
}

function parseArgs(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--')) throw new Error(`Unexpected argument: ${token}`);
    const [rawName, inlineValue] = token.slice(2).split(/=(.*)/s, 2);
    if (rawName === 'help') {
      options.help = true;
      continue;
    }
    if (rawName.startsWith('no-')) {
      options[rawName.slice(3)] = false;
      continue;
    }
    const value = inlineValue == null ? argv[index + 1] : inlineValue;
    if (value == null || String(value).startsWith('--')) {
      options[rawName] = true;
      continue;
    }
    options[rawName] = value;
    if (inlineValue == null) index += 1;
  }
  return options;
}

function sha256File(file) {
  return createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function commandResult(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd || ROOT,
    encoding: 'utf8',
    timeout: options.timeout || 180_000,
    env: process.env,
  });
  return {
    ok: result.status === 0,
    status: result.status,
    stdout: String(result.stdout || '').trim(),
    stderr: String(result.stderr || '').trim(),
    error: result.error?.message || '',
  };
}

function commandText(command, args, fallback = '') {
  const result = commandResult(command, args, { timeout: 30_000 });
  return result.ok ? result.stdout : fallback;
}

function inspectShellCommandAvailability(command) {
  const normalized = String(command || '').trim();
  if (!normalized) return { ok: false, reason: 'command_missing' };
  const syntax = commandResult('/bin/zsh', ['-n', '-c', normalized], { timeout: 10_000 });
  const resolution = commandResult('/bin/zsh', [
    '-fc',
    'words=(${(z)1}); (( ${#words[@]} > 0 )) || exit 2; '
      + 'entry="$words[1]"; if [[ "$entry" == */* ]]; then [[ -x "$entry" ]] && print -r -- "$entry"; '
      + 'else command -v -- "$entry"; fi',
    'qbot-command-probe',
    normalized,
  ], { timeout: 10_000 });
  return {
    ok: syntax.ok && resolution.ok,
    reason: syntax.ok ? (resolution.ok ? '' : 'command_entrypoint_unavailable') : 'command_syntax_invalid',
    entrypoint: resolution.ok ? resolution.stdout : '',
    syntax_ok: syntax.ok,
    resolution_ok: resolution.ok,
  };
}

function probeNativeImeCommand(command) {
  const availability = inspectShellCommandAvailability(command);
  if (!availability.ok) return { ...availability, probe_ok: false };
  const result = spawnSync('/bin/zsh', ['-lc', String(command)], {
    cwd: ROOT,
    encoding: 'utf8',
    timeout: 30_000,
    env: {
      ...process.env,
      QBOT_CORE_BETA_IME_PROBE: '1',
      QBOT_CORE_BETA_IME_TEXT: '',
      QBOT_CORE_BETA_IME_TEXT_BASE64: '',
      QBOT_CORE_BETA_CASE_ID: 'PRETEST-PROBE',
    },
  });
  const stdout = String(result.stdout || '').trim();
  let body = null;
  for (const line of stdout.split('\n').map((item) => item.trim()).filter(Boolean).reverse()) {
    try {
      body = JSON.parse(line);
      break;
    } catch {
      // Ignore non-JSON diagnostic lines; only the final probe contract is retained.
    }
  }
  const contractOk = result.status === 0
    && body?.schema_version === 'qbot-core-beta-native-ime-probe/v1'
    && body?.ok === true
    && body?.non_mutating === true
    && body?.accessibility_permission === true
    && body?.input_source_ready === true;
  return {
    ...availability,
    ok: availability.ok && contractOk,
    probe_ok: contractOk,
    status: result.status,
    schema_version: String(body?.schema_version || ''),
    non_mutating: body?.non_mutating === true,
    accessibility_permission: body?.accessibility_permission === true,
    input_source_ready: body?.input_source_ready === true,
    stdout_bytes: Buffer.byteLength(stdout),
    stdout_sha256: createHash('sha256').update(stdout).digest('hex'),
    reason: contractOk
      ? ''
      : String(body?.reason || result.error?.message || 'native_ime_probe_contract_failed'),
  };
}

function isGitTracked(file) {
  const relative = path.relative(ROOT, file);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) return false;
  return commandResult('git', ['ls-files', '--error-unmatch', '--', relative], {
    timeout: 30_000,
  }).ok;
}

function normalizeOrigin(value) {
  if (!value) return '';
  const url = new URL(String(value));
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
    throw new Error(`Invalid credential-free HTTP(S) origin: ${value}`);
  }
  return url.origin;
}

function expectedControlPlaneEnvironment(origin) {
  if (!origin) return '';
  const { hostname } = new URL(origin);
  if (hostname === 'qbot-api.360shuke.com') return 'prod';
  if (/uat/i.test(hostname)) return 'uat';
  if (/sit/i.test(hostname)) return 'sit';
  if (['127.0.0.1', 'localhost', '::1'].includes(hostname)) return 'local';
  return 'dev';
}

function assessControlPlaneHealth(response, {
  controlPlaneOrigin = '',
  expectedBackendVersion = '',
} = {}) {
  const body = response?.body != null && typeof response.body === 'object' && !Array.isArray(response.body)
    ? response.body
    : null;
  const environment = String(body?.env || '').trim().toLowerCase();
  const fingerprint = String(body?.fingerprint || '').trim().toLowerCase();
  const expectedEnvironment = expectedControlPlaneEnvironment(controlPlaneOrigin);
  const observedBackendVersion = environment && /^[a-f0-9]{16}$/i.test(fingerprint)
    ? `${environment}-health-${fingerprint}`
    : '';
  const ready = Boolean(
    response?.ok === true
    && response?.status === 200
    && body?.ok === true
    && body?.ready === true
    && body?.checks?.db === true
    && body?.checks?.auth === true
    && body?.auth?.ready === true
  );
  const environmentMatches = Boolean(
    environment
    && expectedEnvironment
    && environment === expectedEnvironment
  );
  const backendIdentityMatches = Boolean(
    observedBackendVersion
    && expectedBackendVersion
    && observedBackendVersion === expectedBackendVersion
  );
  return {
    ok: ready && environmentMatches && backendIdentityMatches,
    control_plane_origin: controlPlaneOrigin,
    endpoint: controlPlaneOrigin ? `${controlPlaneOrigin}/api/health/ready` : '',
    http_ok: response?.ok === true,
    http_status: Number(response?.status || 0),
    ready,
    environment,
    expected_environment: expectedEnvironment,
    environment_matches: environmentMatches,
    fingerprint,
    observed_backend_version: observedBackendVersion,
    expected_backend_version: expectedBackendVersion,
    backend_identity_matches: backendIdentityMatches,
    checks: {
      db: body?.checks?.db === true,
      auth: body?.checks?.auth === true,
    },
    auth: {
      ready: body?.auth?.ready === true,
      provider_id: String(body?.auth?.provider?.id || ''),
      can_login: body?.auth?.provider?.canLogin === true,
    },
    error: response?.ok === true ? '' : String(response?.reason || 'control plane health probe failed'),
  };
}

function normalizeLoopbackUrl(value) {
  const url = new URL(String(value));
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error(`Invalid CDP URL: ${value}`);
  if (!['127.0.0.1', 'localhost', '[::1]', '::1'].includes(url.hostname)) {
    throw new Error(`CDP/fixture URL must use loopback: ${value}`);
  }
  return url.origin;
}

async function fetchJson(url, timeoutMs = 5000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal });
    const body = await response.json().catch(() => null);
    return {
      ok: response.ok && body != null,
      status: response.status,
      body,
      reason: response.ok && body != null ? '' : `HTTP ${response.status} or non-JSON response`,
    };
  } catch (error) {
    return { ok: false, status: 0, body: null, reason: error?.message || String(error) };
  } finally {
    clearTimeout(timer);
  }
}

function plistValue(appPath, key) {
  const plist = path.join(appPath, 'Contents', 'Info.plist');
  if (!fs.existsSync(plist)) return '';
  return commandText('/usr/libexec/PlistBuddy', ['-c', `Print :${key}`, plist]);
}

function findRunnerProcesses() {
  const output = commandText('ps', ['ax', '-o', 'pid=,command=']);
  return output.split('\n').map((line) => line.trim()).filter((line) => (
    /(?:src\/cli\.mjs\s+ui-agent-casebook-run|teams360-automation\/lib\/casebook-runner\.mjs)/.test(line)
    && !line.includes('preflight-core-beta-test-run')
  ));
}

function markdown(report) {
  const lines = [
    '# Core Beta 真实测试启动前自检',
    '',
    `- 结论：**${report.status}**`,
    `- 生成时间：${report.generated_at}`,
    `- Casebook：\`${report.casebook.path}\``,
    `- Sheet：\`${report.casebook.sheet}\``,
    `- SHA-256：\`${report.casebook.sha256 || ''}\``,
    `- Case：${report.casebook.case_count ?? 0}`,
    `- Lane：${report.lane}`,
    '',
    '| 检查 | 状态 | 说明 |',
    '|---|---|---|',
    ...report.checks.map((check) => (
      `| ${String(check.id).replaceAll('|', '\\|')} | ${check.status}`
      + ` | ${String(check.detail || '').replaceAll('|', '\\|').replaceAll('\n', '<br>')} |`
    )),
    '',
  ];
  if (report.blockers.length) {
    lines.push('## 阻塞项', '', ...report.blockers.map((item) => `- ${item}`), '');
  }
  lines.push(
    '只有 `READY` 才能启动完整批次；`READY_SCOPED` 只允许启动完全匹配的 scoped runner，且不具备发布门禁资格。本报告不包含任何 synthetic Case 结果。',
    '',
  );
  return `${lines.join('\n')}\n`;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    process.stdout.write(usage());
    return 0;
  }

  const required = ['casebook', 'sheet', 'lane', 'out'];
  const missing = required.filter((name) => !String(options[name] || '').trim());
  if (missing.length) throw new Error(`Missing required options: ${missing.map((item) => `--${item}`).join(', ')}`);
  const lane = String(options.lane);
  if (!['teams', 'local'].includes(lane)) throw new Error('--lane must be teams or local');

  const outDir = path.resolve(String(options.out));
  if (fs.existsSync(outDir) && fs.readdirSync(outDir).length) {
    throw new Error(`Pretest output must be a new immutable directory: ${outDir}`);
  }
  fs.mkdirSync(path.join(outDir, 'logs'), { recursive: true });
  const casebook = path.resolve(String(options.casebook));
  const sheet = String(options.sheet);
  const profile = String(options.profile || 'mandatory');
  const productionGate = TRUE_VALUES.has(String(options['production-gate'] || '').toLowerCase());
  const releaseIntakeRequired = productionGate
    && String(options['require-release-intake'] ?? 'true').toLowerCase() !== 'false';
  const scopedExecution = TRUE_VALUES.has(String(options['scoped-execution'] || '').toLowerCase());
  const checks = [];
  const blockers = [];
  const addCheck = (id, ok, detail, { warning = false } = {}) => {
    const status = ok ? 'passed' : warning ? 'warning' : 'blocked';
    checks.push({ id, status, detail });
    if (!ok && !warning) blockers.push(`${id}: ${detail}`);
  };

  let releaseIntake = null;
  let releaseIntakeSha256 = '';
  const releaseIntakePath = String(options['release-intake'] || '').trim();

  const head = commandText('git', ['rev-parse', 'HEAD']);
  const originMain = commandText('git', ['rev-parse', 'origin/main']);
  const branch = commandText('git', ['branch', '--show-current']);
  addCheck('git_branch_main', branch === 'main', `branch=${branch || '(unknown)'}`);
  addCheck('git_head_matches_origin_main', Boolean(head) && head === originMain, `HEAD=${head || '(unknown)'} origin/main=${originMain || '(unknown)'}`);
  const trackedDirty = commandText('git', ['status', '--porcelain', '--untracked-files=no']);
  addCheck('git_tracked_clean', !trackedDirty, trackedDirty || 'tracked dirty=false');
  const requiredFrameworkEntrypoints = [
    fileURLToPath(import.meta.url),
    path.join(ROOT, 'scripts', 'core-beta-fixture-controller.mjs'),
    path.join(ROOT, 'scripts', 'orchestrate-qwork-release-test.mjs'),
    path.join(ROOT, 'scripts', 'scan-qwork-release-intake.mjs'),
    path.join(ROOT, 'src', 'lib', 'core-beta-fixture-controller.mjs'),
    path.join(ROOT, 'src', 'lib', 'qwork-release-test-plan.mjs'),
    path.join(ROOT, 'src', 'lib', 'qwork-release-intake.mjs'),
    path.join(ROOT, 'test', 'core-beta-pretest.mjs'),
    path.join(ROOT, 'test', 'core-beta-fixture-controller.mjs'),
    path.join(ROOT, 'test', 'qwork-release-test-plan.test.mjs'),
    path.join(ROOT, 'test', 'qwork-release-intake.test.mjs'),
  ];
  const untrackedFrameworkEntrypoints = requiredFrameworkEntrypoints
    .filter((file) => !isGitTracked(file))
    .map((file) => path.relative(ROOT, file));
  addCheck(
    'git_framework_entrypoints_tracked',
    untrackedFrameworkEntrypoints.length === 0,
    untrackedFrameworkEntrypoints.length
      ? `untracked=${untrackedFrameworkEntrypoints.join(',')}`
      : 'pretest implementation and invariant test are tracked by Git',
  );

  const runnerProcesses = findRunnerProcesses();
  addCheck('single_runner_precondition', runnerProcesses.length === 0, runnerProcesses.length
    ? `Existing runner processes: ${runnerProcesses.join('; ')}`
    : 'No existing Casebook runner');

  const runFrameworkChecks = options['framework-checks'] !== false;
  if (runFrameworkChecks) {
    const rootCheck = commandResult('npm', ['run', 'check'], { timeout: 300_000 });
    fs.writeFileSync(path.join(outDir, 'logs', 'root-check.log'), `${rootCheck.stdout}\n${rootCheck.stderr}\n`);
    addCheck('root_framework_check', rootCheck.ok, rootCheck.ok ? 'npm run check passed' : `exit=${rootCheck.status}; ${rootCheck.stderr || rootCheck.error}`);
    const teamsCheck = commandResult('npm', ['--prefix', 'teams360-automation', 'run', 'check'], { timeout: 300_000 });
    fs.writeFileSync(path.join(outDir, 'logs', 'teams-check.log'), `${teamsCheck.stdout}\n${teamsCheck.stderr}\n`);
    addCheck('teams_framework_check', teamsCheck.ok, teamsCheck.ok ? 'Teams check passed' : `exit=${teamsCheck.status}; ${teamsCheck.stderr || teamsCheck.error}`);
  } else {
    addCheck('framework_checks_skipped', false, 'Framework checks were explicitly skipped; not valid for a formal release run', { warning: !productionGate });
  }

  addCheck('casebook_exists', fs.existsSync(casebook) && fs.statSync(casebook).isFile(), casebook);
  addCheck(
    'casebook_git_tracked',
    fs.existsSync(casebook) && isGitTracked(casebook),
    isGitTracked(casebook) ? 'Casebook is tracked by Git' : `untracked=${path.relative(ROOT, casebook)}`,
  );
  let casebookSha = '';
  let cases = [];
  let fullCases = [];
  let protocol = null;
  let scope = null;
  if (fs.existsSync(casebook) && fs.statSync(casebook).isFile()) {
    casebookSha = sha256File(casebook);
    const expectedSha = String(options['expected-sha256'] || '').trim().toLowerCase();
    addCheck(
      'casebook_sha256',
      Boolean(expectedSha) && casebookSha === expectedSha,
      `actual=${casebookSha}; expected=${expectedSha || '(missing --expected-sha256)'}`,
    );
    const exportedFile = path.join(outDir, 'casebook-cases.json');
    const exporter = commandResult(String(options.python || process.env.PYTHON || 'python3'), [
      path.join(ROOT, 'skills', 'qbot-execute-automation-tests', 'scripts', 'casebook_io.py'),
      'export-cases',
      '--casebook', casebook,
      '--sheet', sheet,
      '--profile', profile,
      '--output', exportedFile,
      ...(options.case ? ['--case', String(options.case)] : []),
    ], { timeout: 120_000 });
    fs.writeFileSync(path.join(outDir, 'logs', 'export-cases.log'), `${exporter.stdout}\n${exporter.stderr}\n`);
    addCheck('casebook_exact_sheet_export', exporter.ok, exporter.ok
      ? `sheet=${sheet}; profile=${profile}`
      : `exit=${exporter.status}; ${exporter.stderr || exporter.error}`);
    if (exporter.ok) {
      cases = JSON.parse(fs.readFileSync(exportedFile, 'utf8')).cases || [];
      const ids = cases.map((item) => item.id);
      const expectedCount = Number(options['expected-count']);
      addCheck('case_count', Number.isInteger(expectedCount) && cases.length === expectedCount,
        `actual=${cases.length}; expected=${Number.isInteger(expectedCount) ? expectedCount : '(missing --expected-count)'}`);
      addCheck('case_id_unique', new Set(ids).size === ids.length, `unique=${new Set(ids).size}; total=${ids.length}`);
      if (scopedExecution) {
        const fullCasesFile = path.join(outDir, 'casebook-full-cases.json');
        const fullExporter = commandResult(String(options.python || process.env.PYTHON || 'python3'), [
          path.join(ROOT, 'skills', 'qbot-execute-automation-tests', 'scripts', 'casebook_io.py'),
          'export-cases',
          '--casebook', casebook,
          '--sheet', sheet,
          '--profile', profile,
          '--output', fullCasesFile,
        ], { timeout: 120_000 });
        fs.writeFileSync(path.join(outDir, 'logs', 'export-full-cases.log'), `${fullExporter.stdout}\n${fullExporter.stderr}\n`);
        addCheck('scoped_full_casebook_export', fullExporter.ok, fullExporter.ok
          ? `sheet=${sheet}; profile=${profile}`
          : `exit=${fullExporter.status}; ${fullExporter.stderr || fullExporter.error}`);
        if (fullExporter.ok) {
          fullCases = JSON.parse(fs.readFileSync(fullCasesFile, 'utf8')).cases || [];
          const excludedCaseIds = String(options['excluded-case'] || '')
            .split(/[,，\s]+/).map((item) => item.trim()).filter(Boolean);
          scope = validateCoreBetaScopedSelection({
            fullCases,
            selectedCases: cases,
            excludedCaseIds,
            reason: options['scope-reason'] || '',
          });
          addCheck('scoped_selection_contract', scope.ok, scope.ok
            ? `selected=${scope.selected_count}; excluded=${scope.excluded_count}; release_gate_eligible=false`
            : scope.errors.join('; '));
          const dependencyGaps = Array.isArray(scope.dependency_gaps) ? scope.dependency_gaps : [];
          addCheck(
            'scoped_upstream_dependency_visibility',
            dependencyGaps.length === 0,
            dependencyGaps.length
              ? '以下 Case 的本轮上游已被显式排除，runner 必须生成可信 prerequisite blocked 并继续，禁止使用账号中的任意资源替代：'
                + dependencyGaps.map((item) => `${item.case_id}<-${item.excluded_upstream_case_ids.join('+')}`).join(',')
              : 'selected Case 的跨 Case 上游依赖闭合',
            { warning: true },
          );
          const fullFixtureReadiness = await inspectCoreBetaFixtureReadiness({
            options: {
              ...options,
              'core-beta-fixture-control-url': '',
            },
            cases: fullCases,
          });
          const unavailableFixtureIds = Array.isArray(fullFixtureReadiness?.missing_case_ids)
            ? fullFixtureReadiness.missing_case_ids
            : [];
          const fixtureExclusionCoverage = classifyCoreBetaScopedFixtureExclusions({
            unavailableCaseIds: unavailableFixtureIds,
            excludedCaseIds: scope.excluded_case_ids,
          });
          if (!fixtureExclusionCoverage.ok) {
            scope.ok = false;
            scope.errors.push(
              'excluded Case 必须覆盖当前环境全部不可用 fixture Case；'
              + `missing=${fixtureExclusionCoverage.missing_unavailable_fixture_case_ids.join(',')}; `
              + `actual=${scope.excluded_case_ids.join(',')}`,
            );
          }
          addCheck(
            'scoped_exclusions_cover_unavailable_fixtures',
            fixtureExclusionCoverage.ok,
            fixtureExclusionCoverage.ok
              ? `unavailable=${unavailableFixtureIds.length}; additional_explicit_fixture_exclusions=${fixtureExclusionCoverage.additional_fixture_exclusion_ids.length}`
              : `missing unavailable fixture cases=${fixtureExclusionCoverage.missing_unavailable_fixture_case_ids.join(',')}; actual=${scope.excluded_case_ids.join(',')}`,
          );
          Object.assign(scope, fixtureExclusionCoverage);
          scope.full_fixture_readiness = fullFixtureReadiness;
          fs.writeFileSync(path.join(outDir, 'scoped-execution.json'), `${JSON.stringify(scope, null, 2)}\n`);
        }
      } else {
        addCheck(
          'scoped_execution_not_implicit',
          !options['excluded-case'] && !options['scope-reason'],
          'scoped options require --scoped-execution true',
        );
      }
      protocol = validateCoreBetaCasePlan(cases, {
        fixtureRoot: path.join(ROOT, 'testflies'),
        allowPartialInitialization: scopedExecution && scope?.ok === true,
        allowDependencyGaps: scopedExecution && scope?.ok === true,
      });
      addCheck('core_beta_protocol', protocol.ok && protocol.executable_count === cases.length,
        protocol.ok ? `executable=${protocol.executable_count}/${cases.length}` : protocol.errors.slice(0, 20).join('; '));
    }
  }

  if (productionGate && cases.length) {
    const releaseAudit = validateProductionCasePlan(cases, {
      backendVersion: options['backend-version'] || '',
      promptPolicyVersion: options['prompt-policy-version'] || '',
      featureFlagsHash: options['feature-flags-hash'] || '',
    });
    addCheck('release_identity_inputs', releaseAudit.ok, releaseAudit.ok
      ? 'backend/prompt/feature-flags fixed'
      : releaseAudit.errors.slice(0, 20).join('; '));
  }

  if (releaseIntakeRequired) {
    const intakeExists = Boolean(releaseIntakePath && fs.existsSync(path.resolve(releaseIntakePath)));
    if (intakeExists) {
      const resolvedIntake = path.resolve(releaseIntakePath);
      try {
        releaseIntake = JSON.parse(fs.readFileSync(resolvedIntake, 'utf8'));
        releaseIntakeSha256 = sha256ReleaseIntakeFile(resolvedIntake);
        const expectedSha = String(options['release-intake-sha256'] || '').trim().toLowerCase();
        const shaMatches = !expectedSha || releaseIntakeSha256 === expectedSha;
        const binding = validateQworkReleaseIntake(releaseIntake, {
          casebookSha256,
          frameworkCommit: head,
          requireReady: true,
        });
        const ok = binding.ok && shaMatches && releaseIntake.decision === 'READY';
        addCheck('qwork_release_intake', ok,
          ok
            ? `release=${releaseIntake.release?.ref}@${releaseIntake.release?.head}; report_sha256=${releaseIntakeSha256}`
            : `扫描报告不可作为准入：${binding.failures.join(',')}${shaMatches ? '' : `; sha256=${releaseIntakeSha256} expected=${expectedSha}`}`);
      } catch (error) {
        addCheck('qwork_release_intake', false, `报告不可读：${error.message}`);
      }
    } else {
      addCheck('qwork_release_intake', false, '正式 release-gate 必须先运行 npm run qwork-release:scan 并提供报告');
    }
  } else {
    addCheck('qwork_release_intake', true, '非正式 release-gate；未要求 release intake', { warning: true });
  }

  const fixtureControls = new Set(cases.map((testCase) => (
    coreBetaScenarioSpec(testCase)?.fixture_control || ''
  )).filter(Boolean));
  const needsManagedRestart = fixtureControls.has('managed_teams_restart')
    || fixtureControls.has('managed_runtime_restart');
  const needsNativeIme = fixtureControls.has('native_ime_input');
  const effectiveFixtureOptions = { ...options };
  const fixtureCapabilities = {};

  if (needsManagedRestart) {
    if (lane === 'teams') {
      const callerRestartAbsent = !String(options['restart-command'] || '').trim();
      addCheck(
        'teams_restart_command_is_wrapper_managed',
        callerRestartAbsent,
        callerRestartAbsent
          ? 'caller restart command absent; Teams wrapper owns the restart command'
          : 'Teams pretest must not accept caller --restart-command',
      );
      fixtureCapabilities.managed_restart = inspectManagedTeamsRestartCapability();
      addCheck(
        'teams_managed_restart_capability',
        fixtureCapabilities.managed_restart.ok,
        JSON.stringify(fixtureCapabilities.managed_restart),
      );
      if (fixtureCapabilities.managed_restart.ok) {
        effectiveFixtureOptions['restart-command'] = fixtureCapabilities.managed_restart.entrypoint;
      }
    } else {
      fixtureCapabilities.managed_restart = inspectShellCommandAvailability(options['restart-command']);
      addCheck(
        'local_managed_restart_capability',
        fixtureCapabilities.managed_restart.ok,
        JSON.stringify(fixtureCapabilities.managed_restart),
      );
    }
  }

  if (needsNativeIme) {
    const nativeImeCommand = String(
      options['native-ime-command'] || process.env.QBOT_CORE_BETA_NATIVE_IME_COMMAND || '',
    ).trim();
    fixtureCapabilities.native_ime = probeNativeImeCommand(nativeImeCommand);
    addCheck(
      'native_ime_command_capability',
      fixtureCapabilities.native_ime.ok,
      JSON.stringify(fixtureCapabilities.native_ime),
    );
    if (nativeImeCommand) effectiveFixtureOptions['native-ime-command'] = nativeImeCommand;
  }

  let fixtureReadiness = null;
  if (cases.length && protocol?.ok) {
    const fixtureUrl = String(options['core-beta-fixture-control-url'] || '').trim();
    if (fixtureUrl) normalizeLoopbackUrl(fixtureUrl);
    fixtureReadiness = await inspectCoreBetaFixtureReadiness({
      options: {
        ...effectiveFixtureOptions,
        'core-beta-fixture-control-url': fixtureUrl,
      },
      cases,
    });
    fs.writeFileSync(
      path.join(outDir, 'core-beta-fixture-readiness.json'),
      `${JSON.stringify(fixtureReadiness, null, 2)}\n`,
    );
    addCheck('fixture_controller_contract', fixtureReadiness.ok, fixtureReadiness.ok
      ? `mode=${fixtureReadiness.mode}; cases=${cases.length}`
      : fixtureReadiness.reason);
  }

  let runtime = { fixture_capabilities: fixtureCapabilities };
  if (lane === 'teams') {
    const appPath = path.resolve(String(options.app || DEFAULT_TEAMS_APP));
    const teamsVersion = plistValue(appPath, 'CFBundleShortVersionString');
    const teamsBuild = plistValue(appPath, 'CFBundleVersion');
    runtime.teams = { app_path: appPath, version: teamsVersion, build: teamsBuild };
    addCheck('teams_app', fs.existsSync(appPath) && Boolean(teamsVersion) && Boolean(teamsBuild),
      `${appPath} ${teamsVersion || '(no version)'}(${teamsBuild || 'no build'})`);
    const expectedTeamsVersion = String(options['expected-teams-version'] || '');
    const expectedTeamsBuild = String(options['expected-teams-build'] || '');
    addCheck('teams_release_identity',
      Boolean(expectedTeamsVersion) && Boolean(expectedTeamsBuild)
        && teamsVersion === expectedTeamsVersion && teamsBuild === expectedTeamsBuild,
      `actual=${teamsVersion}(${teamsBuild}); expected=${expectedTeamsVersion || '(missing)'}(${expectedTeamsBuild || 'missing'})`);

    const sessionFile = path.resolve(String(options.session || DEFAULT_SESSION));
    const session = readSession(sessionFile);
    runtime.session_file = sessionFile;
    runtime.session = session;
    let sessionShapeOk = false;
    try {
      validateLiveCasebookSession(session);
      sessionShapeOk = true;
    } catch (error) {
      addCheck('managed_live_session', false, error.message);
    }
    if (sessionShapeOk) {
      addCheck('managed_live_session', true, `pid=${session.pid}; cdp=${session.cdp_url}`);
      addCheck('managed_session_process', processMatchesSession(session),
        processMatchesSession(session) ? `pid=${session.pid} matches session` : `stale or mismatched pid=${session.pid}`);
      const expectedOrigin = normalizeOrigin(options['expected-control-plane-origin'] || '');
      const actualOrigin = session?.control_plane_origin ? normalizeOrigin(session.control_plane_origin) : '';
      addCheck('control_plane_identity',
        Boolean(expectedOrigin) && actualOrigin === expectedOrigin,
        `actual=${actualOrigin || '(missing)'}; expected=${expectedOrigin || '(missing --expected-control-plane-origin)'}`);
      const expectedBackendVersion = String(options['backend-version'] || '').trim();
      const controlPlaneHealthResponse = expectedOrigin
        ? await fetchJson(`${expectedOrigin}/api/health/ready`, 5000)
        : { ok: false, status: 0, body: null, reason: 'Missing --expected-control-plane-origin' };
      const controlPlaneHealth = assessControlPlaneHealth(controlPlaneHealthResponse, {
        controlPlaneOrigin: expectedOrigin,
        expectedBackendVersion,
      });
      runtime.control_plane_health = controlPlaneHealth;
      addCheck('qwork_control_plane_health',
        controlPlaneHealth.ready && controlPlaneHealth.environment_matches,
        controlPlaneHealth.ready
          ? `env=${controlPlaneHealth.environment}; db=${controlPlaneHealth.checks.db}; auth=${controlPlaneHealth.checks.auth}; provider=${controlPlaneHealth.auth.provider_id || '(missing)'}`
          : controlPlaneHealth.error || `HTTP ${controlPlaneHealth.http_status}; ready=${controlPlaneHealth.ready}; env=${controlPlaneHealth.environment || '(missing)'}`);
      addCheck('qwork_backend_identity',
        controlPlaneHealth.backend_identity_matches,
        `actual=${controlPlaneHealth.observed_backend_version || '(missing)'}; expected=${expectedBackendVersion || '(missing --backend-version)'}; fingerprint=${controlPlaneHealth.fingerprint || '(missing)'}`);
      if (processMatchesSession(session)) {
        const cdpUrl = normalizeLoopbackUrl(session.cdp_url);
        const cdp = await fetchJson(`${cdpUrl}/json/version`, 5000);
        addCheck('teams_cdp', cdp.ok, cdp.ok
          ? `${cdpUrl}; browser=${cdp.body?.Browser || '(unknown)'}`
          : `${cdpUrl}; ${cdp.reason}`);
        if (cdp.ok) {
          const inspectionDir = path.join(outDir, 'teams-doctor');
          const inspection = await inspectTeamsCdp({
            cdpUrl,
            outputDir: inspectionDir,
            openQbot: false,
            captureHost: false,
            smoke: false,
            timeoutMs: 30_000,
            probePublicCapabilities: true,
            probeRuntimeReleaseStatus: true,
          });
          runtime.teams_inspection = inspection;
          addCheck('qwork_target_logged_in',
            Boolean(inspection.qbot_target) && inspection.host_precondition?.status !== 'blocked',
            inspection.qbot_target
              ? `target=${inspection.qbot_target.url || inspection.qbot_target.title || 'identified'}`
              : inspection.host_precondition?.reason || 'No ready QWork/QBot target');
          const publicCapabilities = inspection.public_capabilities;
          addCheck('qwork_public_capabilities', publicCapabilities?.ok === true,
            publicCapabilities?.ok
              ? `source=${publicCapabilities.source}; keys=${publicCapabilities.keys.join(',')}`
              : publicCapabilities?.error || 'window.agent.capabilities was not probed');
          const actualQworkOrigin = normalizeOrigin(
            inspection.qbot_target?.control_plane_origin || '',
          );
          addCheck('qwork_control_plane_identity',
            Boolean(expectedOrigin) && actualQworkOrigin === expectedOrigin,
            `renderer_actual=${actualQworkOrigin || '(missing)'}; expected=${expectedOrigin || '(missing --expected-control-plane-origin)'}`);
          const qworkUrl = String(inspection.qbot_target?.url || '');
          const versionMatch = qworkUrl.match(/\/ui\/([^/]+)\/index\.html/);
          const qworkVersion = versionMatch?.[1] || '';
          const expectedQworkVersion = String(options['expected-qwork-version'] || '');
          const runtimeReleaseStatus = inspection.runtime_release_status;
          const runtimeReleaseAssessment = assessRuntimeReleaseStatus(
            runtimeReleaseStatus,
            expectedQworkVersion,
          );
          runtime.qwork = {
            url: qworkUrl,
            version: qworkVersion,
            runtime_release_status: runtimeReleaseStatus,
            runtime_release_assessment: runtimeReleaseAssessment,
          };
          const qworkReleaseIdentityReadback = readQworkReleaseIdentity({
            qworkUiUrl: qworkUrl,
            runtimeReleaseStatus,
          });
          const qworkReleaseIdentityAssessment = assessQworkReleaseIdentity(
            qworkReleaseIdentityReadback,
            {
              qwork_version: expectedQworkVersion,
              prompt_policy_version: options['prompt-policy-version'],
              feature_flags_hash: options['feature-flags-hash'],
              qwork_ui_git_commit: options['qwork-ui-git-commit'],
              qwork_build_id: options['qwork-build-id'],
              qwork_release_manifest_sha256: options['qwork-release-manifest-sha256'],
            },
          );
          runtime.qwork.release_identity_readback = qworkReleaseIdentityReadback;
          runtime.qwork.release_identity_assessment = qworkReleaseIdentityAssessment;
          addCheck('qwork_release_identity',
            Boolean(expectedQworkVersion) && qworkVersion === expectedQworkVersion,
            `actual=${qworkVersion || '(unavailable)'}; expected=${expectedQworkVersion || '(missing --expected-qwork-version)'}`);
          addCheck('qwork_runtime_release_status', runtimeReleaseStatus?.ok === true,
            runtimeReleaseStatus?.ok
              ? `source=${runtimeReleaseStatus.source}; release=${runtimeReleaseStatus.release_id}; version=${runtimeReleaseStatus.version}`
              : runtimeReleaseStatus?.error || 'window.agent.runtimeReleaseStatus was not probed');
          addCheck('qwork_runtime_release_identity', runtimeReleaseAssessment.release_identity_matches,
            `top_level=${runtimeReleaseStatus?.release_id || '(missing)'}/${runtimeReleaseStatus?.version || '(missing)'}; compatibility=${runtimeReleaseStatus?.host_runtime_compatibility?.runtime_release_id || '(missing)'}/${runtimeReleaseStatus?.host_runtime_compatibility?.runtime_version || '(missing)'}; expected=${expectedQworkVersion || '(missing --expected-qwork-version)'}`);
          addCheck('qwork_runtime_update_activation_safe', runtimeReleaseAssessment.update_activation_safe,
            `update_phase=${runtimeReleaseStatus?.update_phase || '(missing)'}; prepared_release=${runtimeReleaseStatus?.prepared_release_present !== true ? '(missing)' : runtimeReleaseStatus?.prepared_release_valid !== true ? '(invalid)' : runtimeReleaseStatus?.prepared_release?.release_id || runtimeReleaseStatus?.prepared_release?.version || '(none)'}`);
          addCheck('qwork_host_runtime_compatibility', runtimeReleaseAssessment.host_runtime_compatible,
            `host_core=${runtimeReleaseStatus?.host_runtime_compatibility?.host_core_version || '(missing)'}; runtime=${runtimeReleaseStatus?.host_runtime_compatibility?.runtime_version || '(missing)'}; versions_match=${runtimeReleaseStatus?.host_runtime_compatibility?.versions_match === true}`,
            { warning: true });
          addCheck('qwork_release_artifact_identity', qworkReleaseIdentityReadback.ok === true,
            qworkReleaseIdentityReadback.ok
              ? `release=${qworkReleaseIdentityReadback.observed.qwork_version}; envelope_sha256=${qworkReleaseIdentityReadback.observed.qwork_release_manifest_sha256}; commit=${qworkReleaseIdentityReadback.observed.qwork_ui_git_commit}`
              : qworkReleaseIdentityReadback.error
                || JSON.stringify(qworkReleaseIdentityReadback.consistency?.errors || []));
          addCheck(
            'qwork_release_identity_observed_matches_expected',
            qworkReleaseIdentityAssessment.ok === true,
            qworkReleaseIdentityAssessment.ok
              ? `observed_sha256=${qworkReleaseIdentityReadback.observed_sha256}`
              : `mismatches=${JSON.stringify(qworkReleaseIdentityAssessment.mismatches)}`,
          );
        }
      }
    }
  } else {
    const cdpUrl = normalizeLoopbackUrl(options.cdp || 'http://127.0.0.1:9224');
    const cdp = await fetchJson(`${cdpUrl}/json/version`, 5000);
    runtime.local = { cdp_url: cdpUrl, cdp };
    addCheck('local_qbot_cdp', cdp.ok, cdp.ok
      ? `${cdpUrl}; browser=${cdp.body?.Browser || '(unknown)'}`
      : `${cdpUrl}; ${cdp.reason}`);
    if (options['health-url']) {
      const healthUrl = new URL(String(options['health-url'])).href;
      const health = await fetchJson(healthUrl, 5000);
      runtime.local.health = health;
      addCheck('local_runtime_health', health.ok && health.body?.ready === true,
        health.ok ? JSON.stringify(health.body) : health.reason);
    }
  }

  if (productionGate) {
    const requiredFrozen = [
      ...(lane === 'teams'
        ? ['expected-teams-version', 'expected-teams-build', 'expected-qwork-version', 'expected-control-plane-origin']
        : []),
      'backend-version',
      'prompt-policy-version',
      'feature-flags-hash',
      'qwork-ui-git-commit',
      'qwork-build-id',
      'qwork-release-manifest-sha256',
    ];
    const missingFrozen = requiredFrozen.filter((name) => !String(options[name] || '').trim());
    addCheck('frozen_product_identity_complete', missingFrozen.length === 0,
      missingFrozen.length ? `missing=${missingFrozen.map((name) => `--${name}`).join(',')}` : 'complete');
    const releaseHashesValid = /^[a-f0-9]{64}$/i.test(String(options['feature-flags-hash'] || ''))
      && /^[a-f0-9]{64}$/i.test(String(options['qwork-release-manifest-sha256'] || ''));
    addCheck('frozen_product_identity_hashes', releaseHashesValid,
      `feature_flags_hash=${options['feature-flags-hash'] || '(missing)'}; release_manifest_sha256=${options['qwork-release-manifest-sha256'] || '(missing)'}`);
  }

  const frozenReleaseIdentity = normalizeQworkReleaseIdentity({
    teams_version: options['expected-teams-version'],
    teams_build: options['expected-teams-build'],
    qwork_version: options['expected-qwork-version'],
    control_plane_origin: options['expected-control-plane-origin'],
    backend_version: options['backend-version'],
    prompt_policy_version: options['prompt-policy-version'],
    feature_flags_hash: options['feature-flags-hash'],
    qwork_ui_git_commit: options['qwork-ui-git-commit'],
    qwork_build_id: options['qwork-build-id'],
    qwork_release_manifest_sha256: options['qwork-release-manifest-sha256'],
  });
  const observedReleaseIdentity = normalizeQworkReleaseIdentity({
    teams_version: runtime?.teams?.version,
    teams_build: runtime?.teams?.build,
    qwork_version: runtime?.qwork?.release_identity_readback?.observed?.qwork_version
      || runtime?.qwork?.version,
    control_plane_origin: runtime?.session?.control_plane_origin,
    backend_version: runtime?.control_plane_health?.observed_backend_version,
    prompt_policy_version: runtime?.qwork?.release_identity_readback?.observed?.prompt_policy_version,
    feature_flags_hash: runtime?.qwork?.release_identity_readback?.observed?.feature_flags_hash,
    qwork_ui_git_commit: runtime?.qwork?.release_identity_readback?.observed?.qwork_ui_git_commit,
    qwork_build_id: runtime?.qwork?.release_identity_readback?.observed?.qwork_build_id,
    qwork_release_manifest_sha256: runtime?.qwork?.release_identity_readback?.observed
      ?.qwork_release_manifest_sha256,
  });
  if (productionGate && lane === 'teams') {
    addCheck(
      'release_identity_observed_matches_expected',
      JSON.stringify(observedReleaseIdentity) === JSON.stringify(frozenReleaseIdentity),
      `observed=${JSON.stringify(observedReleaseIdentity)}; expected=${JSON.stringify(frozenReleaseIdentity)}`,
    );
  }

  const report = {
    schema_version: 'qbot-core-beta-pretest/v1',
    generated_at: new Date().toISOString(),
    status: blockers.length ? 'BLOCKED' : scopedExecution ? 'READY_SCOPED' : 'READY',
    lane,
    production_gate: productionGate,
    release_gate_eligible: !scopedExecution,
    release_identity: {
      expected: frozenReleaseIdentity,
      observed: observedReleaseIdentity,
      fingerprint: qworkReleaseIdentityFingerprint(frozenReleaseIdentity),
      observed_fingerprint: qworkReleaseIdentityFingerprint(observedReleaseIdentity),
    },
    scope,
    framework: {
      branch,
      head,
      origin_main: originMain,
      tracked_dirty: trackedDirty || '',
      required_entrypoints: requiredFrameworkEntrypoints.map((file) => path.relative(ROOT, file)),
      untracked_entrypoints: untrackedFrameworkEntrypoints,
    },
    casebook: {
      path: casebook,
      sheet,
      profile,
      sha256: casebookSha,
      expected_sha256: String(options['expected-sha256'] || ''),
      case_count: cases.length,
      expected_count: Number(options['expected-count']) || null,
      first_case_id: cases[0]?.id || '',
      last_case_id: cases.at(-1)?.id || '',
      case_ids: cases.map((testCase) => testCase.id),
    },
    release_intake: releaseIntake ? {
      path: path.resolve(releaseIntakePath),
      sha256: releaseIntakeSha256,
      content_sha256: releaseIntake.integrity?.content_sha256 || '',
      release_ref: releaseIntake.release?.ref || '',
      release_head: releaseIntake.release?.head || '',
      required_stages: releaseIntake.summary?.required_stages || [],
    } : null,
    fixture: fixtureReadiness,
    runtime,
    checks,
    blockers,
  };
  fs.writeFileSync(path.join(outDir, 'core-beta-pretest-report.json'), `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(path.join(outDir, 'core-beta-pretest-report.md'), markdown(report));
  process.stdout.write(`${JSON.stringify({
    status: report.status,
    report: path.join(outDir, 'core-beta-pretest-report.json'),
    checks: checks.length,
    blockers: blockers.length,
  }, null, 2)}\n`);
  return blockers.length ? 2 : 0;
}

let exitCode = 0;
try {
  exitCode = await main();
} catch (error) {
  process.stderr.write(`Core Beta pretest failed: ${error?.message || error}\n`);
  exitCode = 2;
}
process.exit(exitCode);
