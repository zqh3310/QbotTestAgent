#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  DEFAULT_SESSION,
  PROJECT_ROOT,
  validatePinnedQworkUiUrl,
} from './config.mjs';
import {
  discoverWebviewProbes,
  probeWebviewPublicCapabilities,
  probeWebviewRuntimeReleaseStatus,
  withWebviewTargetClient,
} from './cdp-webview.mjs';
import {
  findFreePort,
  launchLiveTeams,
  processMatchesSession,
  readSession,
  settleRelaunchedLiveTeamsSession,
  stopIsolatedTeams,
} from './launcher.mjs';
import { remountPinnedManagedQworkUi } from './managed-qwork-ui.mjs';
import {
  executeUnderManagedRunnerLock,
  inspectNewManagedOutputPath,
} from './managed-runner-lock.mjs';
import {
  assessQworkReleaseIdentity,
  readQworkReleaseIdentity,
} from './qwork-release-identity.mjs';
import { readMacAppBundleIdentity } from './run-metadata.mjs';
import {
  applyManagedQbotProfileConfig,
  waitForStagedQbotServer,
} from './teams-profile-qbot-config.mjs';
import { runQworkSoak } from './qwork-soak-runner.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const TEAMS_ROOT = path.resolve(HERE, '..');
const OUTPUT_ROOT = path.join(TEAMS_ROOT, 'output');
const ORCHESTRATOR = path.join(PROJECT_ROOT, 'scripts', 'orchestrate-qwork-release-test.mjs');

function text(value) {
  return String(value ?? '').trim();
}

function normalizePrompt(value) {
  return String(value ?? '').replace(/\r\n?/g, '\n').trim();
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function sha256Text(value) {
  return createHash('sha256').update(String(value), 'utf8').digest('hex');
}

function processInfo(pid) {
  const numericPid = Number(pid);
  if (!Number.isSafeInteger(numericPid) || numericPid <= 1) {
    return { alive: false, pid: numericPid, process_started_at: '', rss_bytes: -1, command: '' };
  }
  try {
    const raw = execFileSync('ps', [
      '-p', String(numericPid), '-ww', '-o', 'lstart=,rss=,command=',
    ], { encoding: 'utf8' }).trim();
    const match = raw.match(/^(.{24})\s+(\d+)\s+([\s\S]+)$/);
    if (!match) throw new Error('unexpected ps output');
    const started = new Date(match[1].trim());
    if (!Number.isFinite(started.getTime())) throw new Error('invalid process start time');
    return {
      alive: true,
      pid: numericPid,
      process_started_at: started.toISOString(),
      rss_bytes: Number(match[2]) * 1024,
      command: match[3].trim(),
    };
  } catch {
    return { alive: false, pid: numericPid, process_started_at: '', rss_bytes: -1, command: '' };
  }
}

function sessionIdentity(session) {
  return `teams-${sha256Text([
    session?.pid,
    session?.process_started,
    session?.started_at,
    session?.port,
    session?.profile_alias,
  ].join('|')).slice(0, 24)}`;
}

function scanCrashReports() {
  const roots = [
    path.join(os.homedir(), 'Library', 'Logs', 'DiagnosticReports'),
    '/Library/Logs/DiagnosticReports',
  ];
  const reports = [];
  for (const root of roots) {
    let names = [];
    try { names = fs.readdirSync(root); } catch { continue; }
    for (const name of names) {
      if (!/(?:360Teams|QWork|qbot|Electron)/i.test(name)) continue;
      const file = path.join(root, name);
      try {
        const stat = fs.lstatSync(file);
        if (stat.isFile() && !stat.isSymbolicLink()) {
          reports.push(`${file}|${stat.size}|${stat.mtime.toISOString()}`);
        }
      } catch {}
    }
  }
  return new Set(reports);
}

function parseInteger(value, fallback, label, minimum = 1) {
  if (value == null || value === '') return fallback;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < minimum) throw new Error(`${label} must be an integer >= ${minimum}.`);
  return parsed;
}

export function parseQworkSoakCliOptions(argv = []) {
  const raw = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token?.startsWith('--')) throw new Error(`Unexpected argument: ${token || ''}`);
    const [name, inline] = token.slice(2).split(/=(.*)/s, 2);
    const next = argv[index + 1];
    if (inline != null) raw[name] = inline;
    else if (next != null && !next.startsWith('--')) {
      raw[name] = next;
      index += 1;
    } else raw[name] = true;
  }
  if (raw.help === true) return { help: true };
  if (!text(raw['state-dir'])) throw new Error('--state-dir is required.');
  if (!text(raw.out)) throw new Error('--out is required.');
  if (raw['gitlab-token-stdin'] !== true) {
    throw new Error('--gitlab-token-stdin is required and must not include a command-line value.');
  }
  const outDir = path.isAbsolute(text(raw.out))
    ? path.resolve(text(raw.out))
    : path.resolve(PROJECT_ROOT, text(raw.out));
  const relative = path.relative(OUTPUT_ROOT, outDir);
  if (relative.startsWith('..') || path.isAbsolute(relative) || relative === '') {
    throw new Error(`G5 output must be a new child directory of ${OUTPUT_ROOT}.`);
  }
  inspectNewManagedOutputPath({ outDir, outputRoot: OUTPUT_ROOT });
  return {
    help: false,
    gitLabTokenStdin: true,
    stateDir: path.resolve(text(raw['state-dir'])),
    outDir,
    sessionFile: path.resolve(text(raw.session || DEFAULT_SESSION)),
    taskCount: parseInteger(raw.tasks, 100, '--tasks'),
    restartCount: parseInteger(raw.restarts, 3, '--restarts'),
    taskTimeoutMs: parseInteger(raw['timeout-ms'], 600_000, '--timeout-ms', 1_000),
    monitoringIntervalMs: parseInteger(
      raw['monitoring-interval-ms'],
      15_000,
      '--monitoring-interval-ms',
      1_000,
    ),
    stableObservationIntervalMs: parseInteger(
      raw['stable-observation-interval-ms'],
      1_000,
      '--stable-observation-interval-ms',
      100,
    ),
  };
}

function redactSecret(value, secret) {
  const raw = String(value ?? '');
  const secretText = Buffer.isBuffer(secret) ? secret.toString('utf8').trim() : text(secret);
  return secretText ? raw.split(secretText).join('[REDACTED]') : raw;
}

function readRequiredGitLabTokenStdin() {
  const token = fs.readFileSync(0);
  if (!Buffer.isBuffer(token) || !/\S/u.test(token.toString('utf8'))) {
    token?.fill?.(0);
    throw new Error('--gitlab-token-stdin was specified, but standard input was empty.');
  }
  return token;
}

export function readReleaseControlStatus(
  stateDir,
  gitLabToken,
  { orchestratorPath = ORCHESTRATOR, environment = process.env } = {},
) {
  if (!Buffer.isBuffer(gitLabToken) || !/\S/u.test(gitLabToken.toString('utf8'))) {
    throw new Error('Release-control status requires a non-empty GitLab token buffer from standard input.');
  }
  const tokenInput = Buffer.from(gitLabToken);
  let result;
  try {
    result = spawnSync(process.execPath, [
      orchestratorPath,
      'status',
      '--state-dir',
      stateDir,
      '--gitlab-token-stdin',
    ], {
      cwd: PROJECT_ROOT,
      encoding: 'utf8',
      timeout: 60_000,
      env: { ...environment },
      input: tokenInput,
    });
  } finally {
    tokenInput.fill(0);
  }
  if (result.status !== 0) {
    const diagnostic = text(redactSecret(result.stderr || result.error?.message, gitLabToken));
    throw new Error(`Release-control status validation failed: ${diagnostic || `exit ${result.status}`}`);
  }
  try {
    return JSON.parse(result.stdout);
  } catch {
    throw new Error('Release-control status did not return valid JSON.');
  }
}

export function assertG5ControlReady(control) {
  if (control?.command !== 'status' || !control?.plan || !control?.state || !control?.integrity) {
    throw new Error('G5 requires a fully validated release-control status snapshot.');
  }
  for (const stageId of ['G0', 'G1', 'G2', 'G3', 'G4']) {
    if (control.state.stages?.[stageId]?.status !== 'PASSED') {
      throw new Error(`G5 is blocked until ${stageId} is PASSED.`);
    }
  }
  if (control.state.stages?.G5?.status !== 'NOT_STARTED') {
    throw new Error(`G5 cannot start from state ${control.state.stages?.G5?.status || 'missing'}.`);
  }
  if (control.state.decision === 'NO_GO') throw new Error('G5 cannot start after an irreversible NO_GO decision.');
  return {
    releaseIdentity: structuredClone(control.plan.release_identity),
    frameworkCommit: text(control.plan.framework?.commit),
  };
}

function assertCleanFramework(frameworkCommit) {
  const read = (args) => text(execFileSync('git', args, { cwd: PROJECT_ROOT, encoding: 'utf8' }));
  const branch = read(['branch', '--show-current']);
  const head = read(['rev-parse', 'HEAD']);
  const remote = read(['rev-parse', 'origin/main']);
  const dirty = read(['status', '--porcelain', '--untracked-files=no']);
  if (branch !== 'main' || head !== frameworkCommit || remote !== frameworkCommit || dirty) {
    throw new Error(
      `G5 requires branch=main, HEAD=origin/main=framework commit, tracked clean; `
      + `observed branch=${branch || 'missing'} HEAD=${head || 'missing'} origin/main=${remote || 'missing'} dirty=${Boolean(dirty)}.`,
    );
  }
}

function uniqueQworkTarget(probes) {
  const candidates = probes.filter((probe) => probe.surface === 'teams360-qwork-qbot');
  if (candidates.length !== 1) {
    throw new Error(`G5 requires exactly one authenticated QWork WebView; found ${candidates.length}.`);
  }
  return candidates[0];
}

const SURFACE_STATE_EXPRESSION = String.raw`(async () => {
  const bridge = globalThis.window?.__qbotE2E || globalThis.window?.__deepbankE2E;
  const bounded = async (operation, label, timeoutMs = 5000) => {
    try {
      return await Promise.race([
        Promise.resolve().then(operation),
        new Promise((_, reject) => setTimeout(() => reject(new Error(label + ' timed out')), timeoutMs)),
      ]);
    } catch (error) {
      return { __error: String(error?.message || error) };
    }
  };
  const [state, session] = await Promise.all([
    typeof bridge?.state === 'function' ? bounded(() => bridge.state(), 'state') : null,
    typeof bridge?.currentSession === 'function' ? bounded(() => bridge.currentSession(), 'currentSession') : null,
  ]);
  const messageText = (message) => {
    if (typeof message?.content === 'string') return message.content;
    if (typeof message?.text === 'string') return message.text;
    return Array.isArray(message?.parts)
      ? message.parts.filter((part) => part?.t === 'text' || part?.type === 'text')
        .map((part) => String(part?.text || part?.content || '')).join('\n')
      : '';
  };
  const messages = Array.isArray(session?.messages) ? session.messages.map((message, index) => ({
    index,
    id: String(message?.id || message?.messageId || ''),
    role: String(message?.role || ''),
    text: messageText(message),
    status: String(message?.status || ''),
  })) : [];
  const composer = document.querySelector('[data-testid="composer-input"], .aui-composer-input');
  const composerText = composer
    ? String('value' in composer ? composer.value : composer.innerText || composer.textContent || '')
    : '';
  const visible = (element) => {
    if (!element) return false;
    const style = getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
  };
  return {
    captured_at: new Date().toISOString(),
    renderer_pid: Number(globalThis.process?.pid || 0),
    task_id: String(session?.id || state?.activeId || ''),
    running: Boolean(state?.running || session?.running),
    send_count: Number.isSafeInteger(state?.sendCount) ? state.sendCount : null,
    message_count: Number.isSafeInteger(state?.messageCount) ? state.messageCount : messages.length,
    messages,
    composer_visible: visible(composer),
    composer_text: composerText,
    nav_new_task_visible: visible(document.querySelector('[data-testid="nav-new-task"]')),
    workbench_ready: Boolean(
      document.querySelector('[data-testid="qbot-app"]')
      || document.querySelector('[data-testid="nav-new-task"]')
      || /新建任务/.test(String(document.body?.innerText || ''))
    ),
    state_error: String(state?.__error || ''),
    session_error: String(session?.__error || ''),
  };
})()`;

const MODEL_TIER_EXPRESSION = String.raw`(async () => {
  const bridge = globalThis.window?.__qbotE2E || globalThis.window?.__deepbankE2E;
  const getView = async () => {
    const candidates = [];
    if (typeof globalThis.window?.agent?.getConnections === 'function') {
      try { candidates.push(await globalThis.window.agent.getConnections()); } catch {}
    }
    if (typeof bridge?.getConnectionView === 'function') {
      try { candidates.push(await bridge.getConnectionView()); } catch {}
    }
    return candidates.find((item) => Array.isArray(item?.runtimeOptions?.options)) || null;
  };
  const selectedMatches = (selected, target) => String(selected?.connectionId || '') === String(target?.connectionId || '')
    && String(selected?.modelId || '') === String(target?.modelId || '')
    && String(selected?.complianceTier || '').toUpperCase() === 'M3';
  const before = await getView();
  const options = Array.isArray(before?.runtimeOptions?.options) ? before.runtimeOptions.options : [];
  const selected = before?.runtimeOptions?.selected || null;
  const target = options.find((item) => String(item?.complianceTier || '').toUpperCase() === 'M3' && !item?.disabled)
    || (String(selected?.complianceTier || '').toUpperCase() === 'M3' ? selected : null);
  if (!target?.connectionId || !target?.modelId) {
    return { ok: false, reason: 'no available M3 connection', before };
  }
  if (!selectedMatches(selected, target)) {
    const selection = {
      source: target.source || selected?.source || 'platform',
      connectionId: target.connectionId,
      modelId: target.modelId,
      runtimeFamily: target.runtimeFamily || before?.runtimeOptions?.runtimeFamily || selected?.runtimeFamily,
    };
    if (typeof globalThis.window?.agent?.setConnection === 'function') {
      await globalThis.window.agent.setConnection(selection);
    } else if (typeof bridge?.setConnection === 'function') {
      await bridge.setConnection(selection);
    } else return { ok: false, reason: 'setConnection unavailable', before };
  }
  for (let attempt = 1; attempt <= 6; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, attempt === 1 ? 250 : 750));
    const after = await getView();
    const selectedAfter = after?.runtimeOptions?.selected || null;
    if (selectedMatches(selectedAfter, target)) {
      return { ok: true, requested: 'M3', selected: selectedAfter, attempts: attempt };
    }
  }
  return { ok: false, reason: 'M3 selection did not stabilize', before };
})()`;

async function stateWithClient(client) {
  const state = await client.evaluate(SURFACE_STATE_EXPRESSION);
  if (!state || state.state_error || state.session_error || !isFinite(Number(state.renderer_pid))) {
    throw new Error(`QWork state/session readback failed: ${state?.state_error || state?.session_error || 'invalid state'}`);
  }
  return state;
}

function exactPromptMessages(state, prompt, role = 'user') {
  const expected = normalizePrompt(prompt);
  return (state?.messages || []).filter((message) => (
    message.role === role && normalizePrompt(message.text) === expected
  ));
}

export function bindAbortCleanupTask(currentTaskId, state) {
  const current = text(currentTaskId);
  const observed = state?.running === true ? text(state?.task_id) : '';
  if (!observed) return current;
  if (current && current !== observed) {
    throw new Error('Abort cleanup task identity drifted after the physical send click.');
  }
  return observed;
}

export function buildUnconfirmedG5SendReceipt({ click, before, after, cleanupTaskId }) {
  const cleanup = text(cleanupTaskId);
  return {
    confirmed: false,
    accepted_by_product: false,
    click_count: 1,
    confirmed_at: '',
    observed: {
      click,
      before,
      after,
      cleanup_task_binding: cleanup ? {
        task_id: cleanup,
        cleanup_only: true,
        confirmed_send: false,
      } : null,
    },
  };
}

export function assertFrozenControlPlaneBinding({ frozen, session, renderer }) {
  const frozenOrigin = controlPlaneOrigin(frozen);
  const sessionOrigin = controlPlaneOrigin(session);
  const rendererOrigin = controlPlaneOrigin(renderer);
  if (!frozenOrigin || sessionOrigin !== frozenOrigin || rendererOrigin !== frozenOrigin) {
    throw new Error(
      'G5 control-plane identity mismatch: '
      + `frozen=${frozenOrigin || 'missing'} `
      + `session=${sessionOrigin || 'missing'} `
      + `renderer=${rendererOrigin || 'missing'}.`,
    );
  }
  return {
    frozen_origin: frozenOrigin,
    session_origin: sessionOrigin,
    renderer_origin: rendererOrigin,
    all_equal: true,
  };
}

function visibleControlExpression(selectors) {
  return `(() => {
    const selectors = ${JSON.stringify(selectors)};
    const visible = (element) => {
      if (!element) return false;
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.display !== 'none' && style.visibility !== 'hidden'
        && rect.width > 0 && rect.height > 0
        && !element.disabled && element.getAttribute('aria-disabled') !== 'true';
    };
    const matches = [];
    for (const selector of selectors) {
      for (const element of document.querySelectorAll(selector)) {
        if (visible(element)) matches.push({ selector, element });
      }
    }
    const match = matches.at(-1);
    if (!match) return { visible: false, selector: '', label: '', x: null, y: null, width: 0, height: 0 };
    const rect = match.element.getBoundingClientRect();
    return {
      visible: true,
      selector: match.selector,
      label: String(match.element.innerText || match.element.getAttribute('aria-label') || match.element.getAttribute('title') || ''),
      test_id: String(match.element.getAttribute('data-testid') || ''),
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
      width: rect.width,
      height: rect.height
    };
  })()`;
}

async function locateVisibleControl(client, selectors) {
  return client.evaluate(visibleControlExpression(selectors));
}

export async function dispatchTrustedVisibleControlClick(client, selectors, label) {
  if (!client || typeof client.evaluate !== 'function' || typeof client.send !== 'function'
    || !Array.isArray(selectors) || selectors.length === 0) {
    throw new Error(`${label} requires a CDP client and explicit selectors.`);
  }
  const before = await locateVisibleControl(client, selectors);
  const x = Number(before?.x);
  const y = Number(before?.y);
  if (before?.visible !== true || !Number.isFinite(x) || !Number.isFinite(y)) {
    throw new Error(`${label} did not resolve to a visible enabled control.`);
  }
  const dispatchedAt = new Date().toISOString();
  await client.send('Input.dispatchMouseEvent', {
    type: 'mouseMoved', x, y, button: 'none', clickCount: 0,
  });
  await client.send('Input.dispatchMouseEvent', {
    type: 'mousePressed', x, y, button: 'left', clickCount: 1,
  });
  await client.send('Input.dispatchMouseEvent', {
    type: 'mouseReleased', x, y, button: 'left', clickCount: 1,
  });
  const after = await locateVisibleControl(client, selectors);
  return {
    evidence_valid: true,
    input_source: 'cdp-Input.dispatchMouseEvent',
    physical_input: true,
    click_count: 1,
    dispatched_at: dispatchedAt,
    control_before: before,
    control_after: after,
  };
}

const VISIBLE_STOP_CONTROL_EXPRESSION = String.raw`(() => {
  const selectors = [
    '[data-testid="composer-cancel"]',
    '.aui-composer-cancel',
    'button[aria-label*="停止生成"]',
    'button[aria-label*="停止回复"]',
    'button[title*="停止生成"]',
    'button[title*="停止回复"]'
  ];
  const visible = (element) => {
    if (!element) return false;
    const style = getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return style.display !== 'none' && style.visibility !== 'hidden'
      && rect.width > 0 && rect.height > 0
      && !element.disabled && element.getAttribute('aria-disabled') !== 'true';
  };
  for (const selector of selectors) {
    const element = [...document.querySelectorAll(selector)].find(visible);
    if (!element) continue;
    const rect = element.getBoundingClientRect();
    return {
      visible: true,
      selector,
      label: String(element.innerText || element.getAttribute('aria-label') || element.getAttribute('title') || ''),
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
      width: rect.width,
      height: rect.height
    };
  }
  return { visible: false, selector: '', label: '', x: null, y: null, width: 0, height: 0 };
})()`;

export async function stopRunningTaskWithVisibleControl({
  taskId,
  readState,
  locateControl,
  clickControl,
  wait = sleep,
  maximumClicks = 2,
  pollAttempts = 20,
  pollIntervalMs = 250,
}) {
  const expectedTaskId = text(taskId);
  if (!expectedTaskId || typeof readState !== 'function' || typeof locateControl !== 'function'
    || typeof clickControl !== 'function' || typeof wait !== 'function') {
    throw new Error('Abort cleanup requires a task-bound visible stop-control adapter.');
  }
  if (!Number.isSafeInteger(maximumClicks) || maximumClicks < 1 || maximumClicks > 2
    || !Number.isSafeInteger(pollAttempts) || pollAttempts < 1
    || !Number.isSafeInteger(pollIntervalMs) || pollIntervalMs < 0) {
    throw new Error('Abort cleanup bounds are invalid.');
  }

  const observations = [];
  const actions = [];
  let clickCount = 0;
  const observe = async (phase) => {
    const state = await readState();
    const control = await locateControl();
    const item = {
      phase,
      observed_at: text(state?.captured_at || new Date().toISOString()),
      task_id: text(state?.task_id),
      running: state?.running,
      control: structuredClone(control || { visible: false }),
    };
    observations.push(item);
    return { state, control: control || { visible: false } };
  };

  for (let attempt = 1; attempt <= maximumClicks; attempt += 1) {
    const before = await observe(`attempt-${attempt}-before`);
    if (text(before.state?.task_id) !== expectedTaskId) {
      return {
        evidence_valid: true,
        attempted: clickCount > 0,
        stopped: false,
        click_count: clickCount,
        reason: 'active_task_identity_drifted',
        expected_task_id: expectedTaskId,
        observations,
        actions,
      };
    }
    if (before.state?.running === false && before.control?.visible !== true) {
      return {
        evidence_valid: true,
        attempted: clickCount > 0,
        stopped: true,
        click_count: clickCount,
        method: clickCount ? 'cdp-visible-stop-control' : 'already-stopped',
        expected_task_id: expectedTaskId,
        observations,
        actions,
      };
    }
    if (before.state?.running !== true || before.control?.visible !== true) {
      return {
        evidence_valid: true,
        attempted: clickCount > 0,
        stopped: false,
        click_count: clickCount,
        reason: before.state?.running === true ? 'visible_stop_control_unavailable' : 'running_state_unreadable',
        expected_task_id: expectedTaskId,
        observations,
        actions,
      };
    }

    const action = await clickControl(before.control);
    actions.push(action == null ? null : structuredClone(action));
    clickCount += 1;
    for (let poll = 1; poll <= pollAttempts; poll += 1) {
      await wait(pollIntervalMs);
      const after = await observe(`attempt-${attempt}-poll-${poll}`);
      if (text(after.state?.task_id) !== expectedTaskId) {
        return {
          evidence_valid: true,
          attempted: true,
          stopped: false,
          click_count: clickCount,
          reason: 'active_task_identity_drifted_after_click',
          expected_task_id: expectedTaskId,
          observations,
          actions,
        };
      }
      if (after.state?.running === false && after.control?.visible !== true) {
        return {
          evidence_valid: true,
          attempted: true,
          stopped: true,
          click_count: clickCount,
          method: 'cdp-visible-stop-control',
          expected_task_id: expectedTaskId,
          observations,
          actions,
        };
      }
    }
  }

  return {
    evidence_valid: true,
    attempted: true,
    stopped: false,
    click_count: clickCount,
    reason: 'task_still_running_after_bounded_visible_stop_clicks',
    expected_task_id: expectedTaskId,
    observations,
    actions,
  };
}

function backendIdentity(body) {
  const environment = text(body?.env).toLowerCase();
  const fingerprint = text(body?.fingerprint).toLowerCase();
  return environment && /^[a-f0-9]{16}$/.test(fingerprint)
    ? `${environment}-health-${fingerprint}`
    : '';
}

function controlPlaneOrigin(value) {
  try {
    const parsed = new URL(text(value));
    if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) return '';
    return parsed.origin;
  } catch {
    return '';
  }
}

export function createTeamsQworkSoakAdapter({ sessionFile, releaseIdentity }) {
  let pinnedUiUrl = '';
  let activeTarget = null;
  let currentContext = null;
  let activeTaskId = '';
  const crashBaseline = scanCrashReports();

  const targetAndSession = async () => {
    const session = readSession(sessionFile);
    if (!session || session.profile_mode !== 'live' || !processMatchesSession(session)) {
      throw new Error('The unique managed live 360Teams session is unavailable.');
    }
    const target = uniqueQworkTarget(await discoverWebviewProbes(session.cdp_url));
    return { session, target };
  };

  const requireActiveTarget = async (context) => {
    const found = await targetAndSession();
    if (found.target.target_id !== context.webview_target_id
      || found.session.cdp_url !== context.cdp_endpoint
      || sessionIdentity(found.session) !== context.session_id) {
      throw new Error('The managed QWork target drifted during a serial G5 operation.');
    }
    activeTarget = found.target;
    return found;
  };

  const adapter = {
    now: () => new Date().toISOString(),

    async observeContext() {
      const { session, target } = await targetAndSession();
      const surface = await withWebviewTargetClient(target.targetRef, stateWithClient);
      const host = processInfo(session.pid);
      const renderer = processInfo(surface.renderer_pid);
      if (!host.alive || !renderer.alive || !surface.workbench_ready || !surface.composer_visible) {
        throw new Error('The managed host, renderer, workbench, or composer is not ready.');
      }
      pinnedUiUrl ||= validatePinnedQworkUiUrl(target.url).url;
      if (new URL(target.url).href !== pinnedUiUrl) throw new Error('The pinned QWork UI URL drifted.');
      activeTarget = target;
      currentContext = {
        host_pid: host.pid,
        host_process_started_at: host.process_started_at,
        renderer_pid: renderer.pid,
        renderer_process_started_at: renderer.process_started_at,
        session_id: sessionIdentity(session),
        cdp_endpoint: session.cdp_url,
        webview_target_id: target.target_id,
      };
      return structuredClone(currentContext);
    },

    async readIdentity({ context }) {
      const { session, target } = await requireActiveTarget(context);
      const controlPlaneBinding = assertFrozenControlPlaneBinding({
        frozen: releaseIdentity.control_plane_origin,
        session: session.control_plane_origin,
        renderer: target.control_plane_origin,
      });
      const rendererControlPlane = controlPlaneBinding.renderer_origin;
      const [runtime, capabilities, surface, hostBundle, healthResponse] = await Promise.all([
        probeWebviewRuntimeReleaseStatus(target.targetRef),
        probeWebviewPublicCapabilities(target.targetRef),
        withWebviewTargetClient(target.targetRef, async (client) => client.evaluate(String.raw`(async () => {
          const auth = typeof globalThis.window?.agent?.getAuthStatus === 'function'
            ? await Promise.race([
              globalThis.window.agent.getAuthStatus(),
              new Promise((_, reject) => setTimeout(() => reject(new Error('auth timeout')), 5000)),
            ]).catch(() => null)
            : null;
          return {
            observed_at: new Date().toISOString(),
            authenticated: auth?.authenticated === true,
            workbench_ready: Boolean(
              document.querySelector('[data-testid="qbot-app"]')
              || document.querySelector('[data-testid="nav-new-task"]')
              || /新建任务/.test(String(document.body?.innerText || ''))
            ),
          };
        })()`)),
        Promise.resolve(readMacAppBundleIdentity(session.app_path)),
        fetch(`${releaseIdentity.control_plane_origin.replace(/\/$/, '')}/api/health/ready`, {
          method: 'GET',
          redirect: 'manual',
          signal: AbortSignal.timeout(10_000),
          headers: { accept: 'application/json' },
        }).then(async (response) => ({
          status: response.status,
          ok: response.ok,
          body: await response.json().catch(() => null),
        })).catch((error) => ({ status: 0, ok: false, body: null, error: text(error?.message || error) })),
      ]);
      const qworkReadback = readQworkReleaseIdentity({
        qworkUiUrl: target.url,
        runtimeReleaseStatus: runtime,
      });
      const qworkAssessment = assessQworkReleaseIdentity(qworkReadback, releaseIdentity);
      const observed = {
        teams_version: hostBundle.version,
        teams_build: hostBundle.build,
        qwork_version: qworkReadback.observed?.qwork_version,
        control_plane_origin: rendererControlPlane,
        backend_version: backendIdentity(healthResponse.body),
        prompt_policy_version: qworkReadback.observed?.prompt_policy_version,
        feature_flags_hash: qworkReadback.observed?.feature_flags_hash,
        qwork_ui_git_commit: qworkReadback.observed?.qwork_ui_git_commit,
        qwork_build_id: qworkReadback.observed?.qwork_build_id,
        qwork_release_manifest_sha256: qworkReadback.observed?.qwork_release_manifest_sha256,
      };
      const identityMatches = Object.keys(releaseIdentity).every(
        (field) => text(observed[field]) === text(releaseIdentity[field]),
      );
      const healthBody = healthResponse.body || {};
      const healthReady = healthResponse.ok === true
        && healthResponse.status === 200
        && healthBody.ok === true
        && healthBody.ready === true
        && healthBody.checks?.db === true
        && healthBody.checks?.auth === true
        && healthBody.auth?.ready === true
        && observed.backend_version === releaseIdentity.backend_version;
      const runtimeReady = runtime.ok === true
        && runtime.version === releaseIdentity.qwork_version
        && runtime.loaded_runtime?.version === releaseIdentity.qwork_version
        && runtime.loaded_runtime?.verified === true
        && runtime.host_runtime_compatibility?.runtime_version === releaseIdentity.qwork_version
        && runtime.update_phase === 'idle'
        && runtime.prepared_release_present === true
        && runtime.prepared_release_valid === true
        && runtime.prepared_release === null;
      return {
        evidence_valid: true,
        ok: identityMatches
          && qworkAssessment.ok === true
          && runtimeReady
          && capabilities.ok === true
          && surface.authenticated === true
          && surface.workbench_ready === true
          && healthReady,
        observed_at: surface.observed_at,
        context: structuredClone(context),
        release_identity: observed,
        capabilities_readback_attempts: structuredClone(capabilities.attempts || []),
        runtime: {
          top_level_version: runtime.version,
          loaded_version: runtime.loaded_runtime?.version || '',
          compatibility_version: runtime.host_runtime_compatibility?.runtime_version || '',
          loaded_verified: runtime.loaded_runtime?.verified === true,
          update_phase: runtime.update_phase,
          prepared_release: runtime.prepared_release,
          capabilities_readable: capabilities.ok === true,
          capabilities_type: capabilities.value_type,
          workbench_ready: surface.workbench_ready === true,
          authenticated: surface.authenticated === true,
        },
        control_plane_health: {
          http_status: healthResponse.status,
          ok: healthResponse.ok === true && healthBody.ok === true,
          ready: healthBody.ready === true,
          db_ready: healthBody.checks?.db === true,
          auth_ready: healthBody.checks?.auth === true && healthBody.auth?.ready === true,
          origin: releaseIdentity.control_plane_origin,
          backend_version: observed.backend_version,
        },
        authoritative_readback: {
          qwork: qworkReadback,
          qwork_assessment: qworkAssessment,
          runtime,
          capabilities,
          control_plane_binding: controlPlaneBinding,
          host_bundle: hostBundle,
          health: healthResponse,
        },
      };
    },

    async dispatchTask({ sequence, context }) {
      activeTaskId = '';
      const { target } = await requireActiveTarget(context);
      return withWebviewTargetClient(target.targetRef, async (client) => {
        const beforeClick = await stateWithClient(client);
        const click = await dispatchTrustedVisibleControlClick(
          client,
          ['[data-testid="nav-new-task"]'],
          `G5 task ${sequence} New Task action`,
        );
        const deadline = Date.now() + 20_000;
        let state = null;
        while (Date.now() < deadline) {
          state = await stateWithClient(client);
          if (!state.task_id && state.message_count === 0 && state.messages.length === 0
            && state.composer_visible && state.workbench_ready) break;
          await sleep(250);
        }
        if (state?.task_id || state?.message_count !== 0 || state?.messages?.length !== 0
          || !state?.composer_visible || !state?.workbench_ready) {
          throw new Error(`G5 task ${sequence} did not enter a clean draft.`);
        }
        const model = await client.evaluate(MODEL_TIER_EXPRESSION);
        if (model?.ok !== true) throw new Error(`G5 task ${sequence} could not freeze M3: ${model?.reason || 'unknown'}`);
        return {
          dispatched_at: new Date().toISOString(),
          observed: {
            before_click: beforeClick,
            new_task_action: click,
            clean_draft: state,
            model_tier: model,
          },
        };
      });
    },

    async sendAndConfirm({ sequence, prompt, context }) {
      const { target } = await requireActiveTarget(context);
      return withWebviewTargetClient(target.targetRef, async (client) => {
        const prepared = await client.evaluate(String.raw`(() => {
          const input = document.querySelector('[data-testid="composer-input"], .aui-composer-input');
          if (!input) return false;
          input.focus();
          if ('value' in input) {
            const prototype = input.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
            const setter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
            if (setter) setter.call(input, ''); else input.value = '';
            input.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'deleteContentBackward', data: null }));
          } else {
            const selection = getSelection();
            const range = document.createRange();
            range.selectNodeContents(input);
            selection.removeAllRanges();
            selection.addRange(range);
            document.execCommand('delete', false);
          }
          return true;
        })()`);
        if (!prepared) throw new Error(`G5 task ${sequence} composer is unavailable.`);
        await client.send('Input.insertText', { text: prompt });
        await sleep(200);
        const before = await stateWithClient(client);
        if (normalizePrompt(before.composer_text) !== normalizePrompt(prompt)) {
          throw new Error(`G5 task ${sequence} prompt fidelity failed before send.`);
        }
        const model = await client.evaluate(MODEL_TIER_EXPRESSION);
        if (model?.ok !== true) throw new Error(`G5 task ${sequence} lost M3 before send.`);
        const beforeClick = await stateWithClient(client);
        const click = await dispatchTrustedVisibleControlClick(client, [
          '[data-testid="composer-send"]',
          '[aria-label="发送消息"]',
          '[aria-label*="发送"]',
          'button[title*="发送"]',
          '.aui-composer-send',
          '.composer-send',
        ], `G5 task ${sequence} send action`);
        const beforeMatches = exactPromptMessages(beforeClick, prompt).length;
        const deadline = Date.now() + 15_000;
        let after = beforeClick;
        while (Date.now() < deadline) {
          after = await stateWithClient(client);
          const matches = exactPromptMessages(after, prompt);
          const userAdded = matches.length === beforeMatches + 1;
          const auxiliary = Number(after.send_count) > Number(beforeClick.send_count)
            || Number(after.message_count) > Number(beforeClick.message_count)
            || Boolean(after.task_id && after.task_id !== beforeClick.task_id)
            || (after.running === true && beforeClick.running !== true)
            || (normalizePrompt(beforeClick.composer_text) === normalizePrompt(prompt)
              && normalizePrompt(after.composer_text) === '');
          activeTaskId = bindAbortCleanupTask(activeTaskId, after);
          if (userAdded && auxiliary && after.task_id && text(matches.at(-1)?.id)) {
            if (activeTaskId && activeTaskId !== text(after.task_id)) {
              throw new Error(`G5 task ${sequence} cleanup task binding drifted during send confirmation.`);
            }
            activeTaskId = text(after.task_id);
            return {
              confirmed: true,
              accepted_by_product: true,
              click_count: 1,
              task_id: text(after.task_id),
              user_message_id: text(matches.at(-1).id),
              confirmed_at: text(after.captured_at),
              observed: { click, before: beforeClick, after, model_tier: model },
            };
          }
          await sleep(250);
        }
        return buildUnconfirmedG5SendReceipt({
          click,
          before: beforeClick,
          after,
          cleanupTaskId: activeTaskId,
        });
      });
    },

    async waitForStableTerminal({
      sequence,
      marker,
      prompt,
      promptSha256,
      taskId,
      context,
      taskTimeoutMs,
      stableObservationIntervalMs,
    }) {
      const { target } = await requireActiveTarget(context);
      return withWebviewTargetClient(target.targetRef, async (client) => {
        const deadline = Date.now() + taskTimeoutMs;
        const observations = [];
        let stableSignature = '';
        let assistant = null;
        let last = null;
        const stableObservation = (state, message) => {
          const assistantResponse = String(message?.text || '');
          return {
            observed_at: text(state?.captured_at),
            task_id: text(state?.task_id),
            session_id: text(context?.session_id),
            prompt_sha256: text(promptSha256),
            assistant_message_id: text(message?.id),
            assistant_response: assistantResponse,
            response_sha256: sha256Text(assistantResponse),
            marker,
            context: structuredClone(context),
            running: state?.running,
            status: 'succeeded',
          };
        };
        while (Date.now() < deadline) {
          last = await stateWithClient(client);
          if (last.task_id !== taskId) throw new Error(`G5 task ${sequence} active task identity drifted.`);
          const userIndex = [...last.messages].map((message) => ({
            ...message,
            exact: message.role === 'user' && normalizePrompt(message.text) === normalizePrompt(prompt),
          })).findLastIndex((message) => message.exact);
          assistant = userIndex >= 0
            ? last.messages.slice(userIndex + 1).findLast((message) => message.role === 'assistant' && text(message.text))
            : null;
          const candidate = last.running === false
            && text(assistant?.id)
            && text(assistant?.text).includes(marker);
          if (candidate) {
            const signature = sha256Text(JSON.stringify({
              task_id: taskId,
              assistant_message_id: assistant.id,
              response_sha256: sha256Text(assistant.text),
              marker,
              running: false,
            }));
            if (signature === stableSignature) {
              observations.push(stableObservation(last, assistant));
            } else {
              stableSignature = signature;
              observations.length = 0;
              observations.push(stableObservation(last, assistant));
            }
            if (observations.length >= 3) {
              activeTaskId = '';
              return {
                status: 'succeeded',
                running: false,
                assistant_message_id: text(assistant.id),
                assistant_response: String(assistant.text),
                completed_at: observations[0].observed_at,
                ended_at: observations.at(-1).observed_at,
                stability_observations: observations,
                observed: { final_state: last },
              };
            }
            await sleep(stableObservationIntervalMs);
            continue;
          }
          stableSignature = '';
          observations.length = 0;
          await sleep(500);
        }
        throw new Error(`G5 task ${sequence} did not reach a marker-bound stable terminal state within ${taskTimeoutMs}ms.`);
      });
    },

    async sampleProcesses({ context }) {
      const host = processInfo(context.host_pid);
      const renderer = processInfo(context.renderer_pid);
      const currentCrashes = scanCrashReports();
      const newCrashReports = [...currentCrashes].filter((item) => !crashBaseline.has(item));
      return {
        observed_at: new Date().toISOString(),
        context: structuredClone(context),
        host,
        renderer,
        unexpected_host_exit_count: host.alive ? 0 : 1,
        renderer_crash_count: renderer.alive ? 0 : 1,
        new_crash_reports: newCrashReports,
      };
    },

    async restartManagedHost({ before }) {
      const previous = readSession(sessionFile);
      if (!previous || !processMatchesSession(previous) || !pinnedUiUrl) {
        throw new Error('G5 managed restart lost its exact source session or pinned UI.');
      }
      const sessionBeforeStat = fs.lstatSync(sessionFile);
      const startedAt = new Date().toISOString();
      const stopped = stopIsolatedTeams(sessionFile);
      if (stopped.status !== 'stopped') throw new Error(`Managed stop failed: ${stopped.status}`);
      const oldHostExitObserved = !processInfo(before.host_pid).alive;
      if (!oldHostExitObserved) throw new Error('Old managed host remained alive after the exact stop operation.');
      const stopObservedAt = new Date().toISOString();
      let port = await findFreePort();
      while (port === Number(previous.port)) port = await findFreePort();
      applyManagedQbotProfileConfig({
        profileDir: previous.profile_dir,
        serverUrl: releaseIdentity.control_plane_origin,
        uiUrl: pinnedUiUrl,
        backupFile: `${sessionFile}.qbot-soak-profile-backup.json`,
      });
      const launchStartedAt = new Date().toISOString();
      await launchLiveTeams({
        appPath: previous.app_path,
        profileDir: previous.profile_dir,
        profileAlias: previous.profile_alias,
        sessionFile,
        port,
        timeoutMs: 60_000,
        environment: {
          DEEPBANK_SURFACE: 'workbench',
          DEEPBANK_UI_URL: pinnedUiUrl,
          QBOT_SURFACE: 'workbench',
          QBOT_UI_URL: pinnedUiUrl,
          QBOT_SERVER_URL: releaseIdentity.control_plane_origin,
          DEEPBANK_SERVER: releaseIdentity.control_plane_origin,
        },
      });
      const settled = await settleRelaunchedLiveTeamsSession(sessionFile, {
        settleMs: 10_000,
        timeoutMs: 90_000,
      });
      const staged = await waitForStagedQbotServer(
        previous.profile_dir,
        releaseIdentity.control_plane_origin,
        30_000,
      );
      if (!staged.ok) throw new Error('Replacement Teams host did not retain the frozen control plane.');
      const remount = await remountPinnedManagedQworkUi(settled.cdp_url, pinnedUiUrl, {
        timeoutMs: 120_000,
        settleMs: 2_000,
      });
      const after = await adapter.observeContext();
      const recoveredAt = new Date().toISOString();
      const sessionAfterStat = fs.lstatSync(sessionFile);
      const sessionFileReplaced = sessionBeforeStat.dev !== sessionAfterStat.dev
        || sessionBeforeStat.ino !== sessionAfterStat.ino;
      return {
        started_at: startedAt,
        stop_observed_at: stopObservedAt,
        launch_started_at: launchStartedAt,
        recovered_at: recoveredAt,
        after,
        old_host_exit_observed: oldHostExitObserved,
        new_host_process_observed: processMatchesSession(readSession(sessionFile)),
        session_file_replaced: sessionFileReplaced,
        cdp_reachable: after.cdp_endpoint === settled.cdp_url,
        authenticated: remount.authenticated === true,
        workbench_ready: remount.workbenchReady === true,
        capabilities_readable: remount.capabilitiesReady === true,
        runtime_identity_stable: true,
        observed: { staged, remount },
      };
    },

    async onAbort() {
      if (!activeTaskId) {
        return {
          evidence_valid: true,
          attempted: false,
          stopped: true,
          click_count: 0,
          method: 'no-active-task',
          observations: [],
        };
      }
      if (!activeTarget?.targetRef) {
        return {
          evidence_valid: false,
          attempted: false,
          stopped: false,
          click_count: 0,
          reason: 'active_webview_target_unavailable',
          expected_task_id: activeTaskId,
          observations: [],
          actions: [],
        };
      }
      const cleanup = await withWebviewTargetClient(activeTarget.targetRef, async (client) => (
        stopRunningTaskWithVisibleControl({
          taskId: activeTaskId,
          readState: () => stateWithClient(client),
          locateControl: () => client.evaluate(VISIBLE_STOP_CONTROL_EXPRESSION),
          clickControl: () => dispatchTrustedVisibleControlClick(client, [
            '[data-testid="composer-cancel"]',
            '.aui-composer-cancel',
            'button[aria-label*="停止生成"]',
            'button[aria-label*="停止回复"]',
            'button[title*="停止生成"]',
            'button[title*="停止回复"]',
          ], 'G5 abort cleanup stop action'),
        })
      ));
      if (cleanup?.stopped === true) activeTaskId = '';
      return cleanup;
    },
  };
  return adapter;
}

export function usage() {
  return `360Teams QWork G5 live soak runner

Usage:
  npm --prefix teams360-automation run soak -- \\
    --state-dir /absolute/release-control \\
    --out teams360-automation/output/<new-immutable-dir> \\
    --gitlab-token-stdin

Options:
  --session <file>                       Managed live-session file
  --tasks <n>                            Real serial tasks (minimum 100)
  --restarts <n>                         Full managed restarts (minimum 3)
  --timeout-ms <ms>                      Per-task terminal timeout
  --monitoring-interval-ms <ms>          Host/renderer sample interval (<=60000)
  --stable-observation-interval-ms <ms>  Delay between three terminal observations
  --gitlab-token-stdin                  Read the GitLab token once from stdin for release-control verification
`;
}

export async function runQworkSoakCli(argv = process.argv.slice(2)) {
  const options = parseQworkSoakCliOptions(argv);
  if (options.help) return { help: usage() };
  const gitLabToken = readRequiredGitLabTokenStdin();
  let control;
  try {
    control = readReleaseControlStatus(options.stateDir, gitLabToken);
  } finally {
    gitLabToken.fill(0);
  }
  const authorized = assertG5ControlReady(control);
  assertCleanFramework(authorized.frameworkCommit);
  if (fs.existsSync(options.outDir)) throw new Error(`G5 output already exists: ${options.outDir}`);
  const session = readSession(options.sessionFile);
  if (!session || session.profile_mode !== 'live' || !processMatchesSession(session)) {
    throw new Error('G5 requires the unique existing managed live 360Teams session.');
  }
  const adapter = createTeamsQworkSoakAdapter({
    sessionFile: options.sessionFile,
    releaseIdentity: authorized.releaseIdentity,
  });
  return runQworkSoak({
    adapter,
    outDir: options.outDir,
    releaseIdentity: authorized.releaseIdentity,
    frameworkCommit: authorized.frameworkCommit,
    taskCount: options.taskCount,
    restartCount: options.restartCount,
    taskTimeoutMs: options.taskTimeoutMs,
    monitoringIntervalMs: options.monitoringIntervalMs,
    stableObservationIntervalMs: options.stableObservationIntervalMs,
    outputRoot: OUTPUT_ROOT,
  });
}

if (path.resolve(process.argv[1] || '') === fileURLToPath(import.meta.url)) {
  try {
    const argv = process.argv.slice(2);
    if (!argv.includes('--help')) {
      const lock = executeUnderManagedRunnerLock({
        entrypoint: fileURLToPath(import.meta.url),
        argv,
        binding: { runner: 'qwork-soak', argv },
      });
      if (lock.reexecuted) {
        process.exitCode = lock.status;
        process.exit();
      }
    }
    const result = await runQworkSoakCli();
    if (result?.help) process.stdout.write(result.help);
    else process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } catch (error) {
    process.stderr.write(`${text(error?.stack || error?.message || error)}\n`);
    process.exitCode = 1;
  }
}
