import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {
  advanceQworkSmokeReplySettlement,
  discoverWebviewProbes,
  isQworkSmokePendingReply,
  QWORK_SMOKE_RUNNING_SELECTOR,
  summarizePublicCapabilities,
  summarizeRuntimeReleaseStatus,
  withWebviewTargetClient,
} from './cdp-webview.mjs';
import { redactText, safeUrl } from './config.mjs';

export const QWORK_APP_SANITY_SCHEMA = 'qbot-qwork-app-sanity/v1';
export const QWORK_APP_SANITY_EVIDENCE_SCHEMA = 'qbot-qwork-app-sanity-evidence/v1';
export const APP_SANITY_PASS = 'PASS_SANITY';
export const APP_SANITY_STOP = 'STOP_BEFORE_G0';
export const QWORK_APP_SANITY_ASSISTANT_BODY_SELECTOR = '.aui-assistant-message-content';
export const APP_SANITY_STEP_IDS = Object.freeze([
  'workbench_ready',
  'clean_new_task',
  'strict_send_exact_reply',
  'reopen_by_task_id',
  'experts_page',
  'skills_page',
  'connectors_page',
  'automations_page',
  'return_clean_new_task',
]);

const STEP_TIMEOUT_MS = 20_000;

function text(value) {
  return String(value ?? '').trim();
}

function sha256Buffer(value) {
  return createHash('sha256').update(value).digest('hex');
}

function sha256File(file) {
  return sha256Buffer(fs.readFileSync(file));
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function allAssertionsPass(assertions) {
  const entries = Object.entries(assertions || {});
  return entries.length > 0 && entries.every(([, value]) => value === true);
}

export function exactAppSanityReplyMatches(actual, expected) {
  return text(actual) === text(expected) && text(expected).length > 0;
}

export function resolveAppSanityAssistantBody({ assistantBodyTexts = [] } = {}) {
  return [...assistantBodyTexts].map(text).filter(Boolean).at(-1) || '';
}

export async function executeAppSanitySequence({ driver, prompt, expected, onStep = async () => {} }) {
  const steps = [];
  let taskId = '';
  let stoppedAt = '';
  let failureReason = '';
  let finalCleanupAttempted = false;

  const runStep = async (stepId, operation) => {
    const startedAt = new Date().toISOString();
    try {
      const detail = await operation();
      const assertions = detail?.assertions || {};
      if (!allAssertionsPass(assertions)) {
        const assertionError = new Error(`App sanity assertions failed at ${stepId}.`);
        assertionError.assertions = assertions;
        assertionError.detail = detail?.detail || {};
        throw assertionError;
      }
      const step = {
        step_id: stepId,
        status: 'passed',
        started_at: startedAt,
        ended_at: new Date().toISOString(),
        assertions,
        detail: detail?.detail || {},
      };
      steps.push(step);
      await onStep(step);
      return detail;
    } catch (error) {
      const step = {
        step_id: stepId,
        status: 'failed',
        started_at: startedAt,
        ended_at: new Date().toISOString(),
        assertions: error?.assertions || {},
        detail: error?.detail || {},
        error: redactText(error?.message || String(error)).slice(0, 1200),
      };
      steps.push(step);
      await onStep(step);
      throw error;
    }
  };

  try {
    await runStep('workbench_ready', () => driver.workbenchReady());
    await runStep('clean_new_task', () => driver.openCleanNewTask());
    const send = await runStep('strict_send_exact_reply', () => driver.strictSend({ prompt, expected }));
    taskId = text(send?.detail?.task_id);
    if (!taskId) throw new Error('Strict send did not return a non-empty taskId.');
    await runStep('reopen_by_task_id', () => driver.reopenByTaskId({ taskId, prompt, expected }));
    await runStep('experts_page', () => driver.openExpertsPage());
    await runStep('skills_page', () => driver.openSkillsPage());
    await runStep('connectors_page', () => driver.openConnectorsPage());
    await runStep('automations_page', () => driver.openAutomationsPage());
    finalCleanupAttempted = true;
    await runStep('return_clean_new_task', () => driver.openCleanNewTask());
  } catch (error) {
    stoppedAt = steps.at(-1)?.step_id || 'startup';
    failureReason = redactText(error?.message || String(error)).slice(0, 1200);
    if (!finalCleanupAttempted) {
      finalCleanupAttempted = true;
      try {
        await runStep('return_clean_new_task', () => driver.openCleanNewTask());
      } catch (cleanupError) {
        failureReason = `${failureReason}; cleanup failed: ${redactText(cleanupError?.message || String(cleanupError))}`.slice(0, 1200);
      }
    }
  }

  const passed = !failureReason
    && steps.length === APP_SANITY_STEP_IDS.length
    && steps.every((step, index) => step.status === 'passed' && step.step_id === APP_SANITY_STEP_IDS[index]);
  return {
    status: passed ? 'passed' : 'failed',
    decision: passed ? APP_SANITY_PASS : APP_SANITY_STOP,
    diagnostic_only: true,
    release_gate_eligible: false,
    task_id: taskId,
    stopped_at: passed ? '' : stoppedAt,
    reason: passed ? 'All App-first P0 sanity assertions passed.' : failureReason || 'App sanity did not complete.',
    steps,
  };
}

export async function runManagedQworkAppSanity({
  cdpUrl,
  outputDir,
  prompt,
  expected,
  timeoutMs = 120_000,
  candidateIdentity = {},
}) {
  const traceFile = path.join(outputDir, 'qwork-app-sanity-trace.jsonl');
  if (fs.existsSync(traceFile)) throw new Error('App sanity output is not immutable: trace already exists.');
  const probes = await discoverWebviewProbes(cdpUrl, { timeoutMs: Math.min(timeoutMs, 10_000) });
  const qworkTargets = probes.filter((probe) => probe.surface === 'teams360-qwork-qbot');
  if (qworkTargets.length !== 1) {
    throw new Error(`App sanity requires exactly one QWork WebView; observed ${qworkTargets.length}.`);
  }
  const target = qworkTargets[0];
  const screenshotsDir = path.join(outputDir, 'screenshots');
  fs.mkdirSync(screenshotsDir, { mode: 0o700 });

  return withWebviewTargetClient(target.targetRef, async (client) => {
    const identity = await readLightweightIdentity(client, target, candidateIdentity);
    const screenshots = [];
    const recordScreenshot = async (name) => {
      const file = path.join(screenshotsDir, `${name}.png`);
      await captureClientScreenshot(client, file);
      const stat = fs.lstatSync(file);
      const evidence = {
        role: name,
        path: file,
        bytes: stat.size,
        sha256: sha256File(file),
        valid: stat.isFile() && !stat.isSymbolicLink() && stat.size > 0,
      };
      screenshots.push(evidence);
      return evidence;
    };
    await recordScreenshot('app-sanity-before');
    const driver = createCdpAppSanityDriver(client, timeoutMs);
    const sequence = await executeAppSanitySequence({
      driver,
      prompt,
      expected,
      onStep: async (step) => {
        const screenshot = await recordScreenshot(`step-${String(stepsafe(step.step_id))}`);
        const entry = { schema_version: QWORK_APP_SANITY_SCHEMA, ...step, screenshot };
        fs.appendFileSync(traceFile, `${JSON.stringify(entry)}\n`, { encoding: 'utf8', mode: 0o600 });
      },
    });
    await recordScreenshot('app-sanity-after');

    const nonReportEvidence = [
      ...screenshots,
      evidenceEntry(outputDir, traceFile, 'jsonl_trace'),
    ];
    const nonReportEvidenceValid = nonReportEvidence.length > 0
      && nonReportEvidence.every((item) => item.valid === true);
    const reportFile = path.join(outputDir, 'qwork-app-sanity-report.json');
    const report = {
      schema_version: QWORK_APP_SANITY_SCHEMA,
      generated_at: new Date().toISOString(),
      ...sequence,
      candidate_identity: identity,
      prompt_sha256: sha256Buffer(Buffer.from(text(prompt), 'utf8')),
      expected_reply: redactText(expected),
      trace_file: traceFile,
      screenshots,
    };
    if (!nonReportEvidenceValid) {
      report.status = 'failed';
      report.decision = APP_SANITY_STOP;
      report.reason = 'App sanity evidence is incomplete.';
    }
    fs.writeFileSync(reportFile, `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600 });
    const evidence = [
      ...nonReportEvidence,
      evidenceEntry(outputDir, reportFile, 'sanity_report'),
    ];
    const manifest = {
      schema_version: QWORK_APP_SANITY_EVIDENCE_SCHEMA,
      generated_at: new Date().toISOString(),
      decision: report.decision,
      diagnostic_only: true,
      release_gate_eligible: false,
      task_id: sequence.task_id,
      evidence_valid: evidence.length > 0 && evidence.every((item) => item.valid === true),
      evidence,
    };
    const manifestFile = path.join(outputDir, 'evidence-manifest.json');
    fs.writeFileSync(manifestFile, `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o600 });
    return { ...report, manifest_file: manifestFile, evidence_manifest: manifest };
  });
}

function stepsafe(value) {
  return String(value || '').replace(/[^a-z0-9_-]+/gi, '-').toLowerCase();
}

function evidenceEntry(outputDir, file, role) {
  const resolved = path.resolve(file);
  const relative = path.relative(path.resolve(outputDir), resolved);
  const stat = fs.lstatSync(resolved);
  const inRoot = relative !== '' && relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
  return {
    role,
    path: resolved,
    bytes: stat.size,
    sha256: sha256File(resolved),
    valid: inRoot && stat.isFile() && !stat.isSymbolicLink() && stat.size > 0,
  };
}

async function readLightweightIdentity(client, target, base) {
  const raw = await client.evaluate(`(async () => {
    const within = async (factory, timeoutMs) => {
      let timer;
      try {
        return await Promise.race([
          factory(),
          new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('timeout')), timeoutMs); }),
        ]);
      } finally { if (timer) clearTimeout(timer); }
    };
    let capabilities = null;
    let runtime = null;
    let capabilitiesError = '';
    let runtimeError = '';
    try { capabilities = await within(() => window.agent.capabilities(), 5000); } catch (error) { capabilitiesError = String(error); }
    try { runtime = await within(() => window.agent.runtimeReleaseStatus(), 5000); } catch (error) { runtimeError = String(error); }
    return { href: location.href, capabilities, runtime, capabilitiesError, runtimeError };
  })()`);
  const capabilities = summarizePublicCapabilities(raw?.capabilities);
  const runtime = summarizeRuntimeReleaseStatus(raw?.runtime);
  if (!runtime.ok) throw new Error('App sanity runtime identity is not readable.');
  return {
    ...base,
    cdp_url: safeUrl(base.cdp_url || ''),
    webview_target_id: target.target_id,
    qwork_url: safeUrl(raw.href || target.url),
    qwork_version: runtime.version,
    runtime_release: runtime,
    capabilities,
    capabilities_record_only: true,
    capabilities_blocks_app_sanity: false,
    identity_sha256: sha256Buffer(Buffer.from(JSON.stringify({
      base,
      target_id: target.target_id,
      qwork_url: safeUrl(raw.href || target.url),
      runtime,
      capabilities,
    }), 'utf8')),
  };
}

function createCdpAppSanityDriver(client, timeoutMs) {
  const deadlineMs = Math.max(60_000, Number(timeoutMs) || 120_000);
  return {
    async workbenchReady() {
      const state = await readAppSanityState(client);
      return {
        assertions: {
          qbot_app_visible: state.qbotApp,
          navigation_visible: state.navNewTask && state.navExperts && state.navConnectors && state.navAuto,
          composer_visible: state.composer,
          runtime_idle: state.running === false,
        },
        detail: projectState(state),
      };
    },
    async openCleanNewTask() {
      const click = await dispatchTrustedTestIdClick(client, 'nav-new-task');
      const state = await waitForState(client, (value) => value.composer
        && value.composerText === ''
        && value.userCount === 0
        && value.assistantCount === 0
        && value.activeTaskId === '', STEP_TIMEOUT_MS);
      return {
        assertions: {
          new_task_clicked: click.evidence_valid === true,
          composer_empty: state.composer && state.composerText === '',
          no_messages: state.userCount === 0 && state.assistantCount === 0,
          no_active_task_id: state.activeTaskId === '',
          no_explicit_capability_chips: state.capabilityChipCount === 0,
        },
        detail: { ...projectState(state), click_receipt: click },
      };
    },
    async strictSend({ prompt, expected }) {
      const before = await readAppSanityState(client);
      const prepared = await prepareComposer(client, prompt);
      const preparedState = await readAppSanityState(client);
      if (!prepared || preparedState.composerText !== text(prompt)) {
        throw new Error('App sanity could not prepare the exact prompt.');
      }
      const trustedClick = await dispatchTrustedTestIdClick(client, 'composer-send');
      const startedAt = new Date().toISOString();
      const deadline = Date.now() + deadlineMs;
      let state = before;
      let stableText = '';
      let stableSince = 0;
      let stableSamples = 0;
      let sawRunning = false;
      let complete = false;
      while (Date.now() < deadline) {
        state = await readAppSanityState(client);
        sawRunning ||= state.running === true;
        const settlement = advanceQworkSmokeReplySettlement({
          beforeAssistantCount: before.assistantCount,
          state,
          stableText,
          stableSince,
          stableSamples,
        });
        stableText = settlement.stableText;
        stableSince = settlement.stableSince;
        stableSamples = settlement.stableSamples;
        if (settlement.complete) {
          complete = true;
          break;
        }
        await delay(400);
      }
      const auxiliary = {
        send_count_increased: Number.isSafeInteger(before.sendCount)
          && Number.isSafeInteger(state.sendCount) && state.sendCount === before.sendCount + 1,
        task_id_created: before.activeTaskId === '' && Boolean(state.activeTaskId),
        message_count_increased: Number.isSafeInteger(before.messageCount)
          && Number.isSafeInteger(state.messageCount) && state.messageCount > before.messageCount,
        running_observed: sawRunning,
      };
      const userAdded = state.userCount === before.userCount + 1 && text(state.lastUser) === text(prompt);
      const replyExact = exactAppSanityReplyMatches(state.lastAssistant, expected);
      return {
        assertions: {
          one_real_click: trustedClick.physical_input === true
            && trustedClick.click_count === 1
            && trustedClick.press_count === 1
            && trustedClick.release_count === 1,
          exact_user_message_added_once: userAdded,
          auxiliary_state_changed: Object.values(auxiliary).some(Boolean),
          non_empty_task_id: Boolean(state.activeTaskId),
          assistant_message_added: state.assistantCount === before.assistantCount + 1,
          reply_settled: complete && state.running === false && state.sendButtonVisible === true,
          exact_reply: replyExact,
        },
        detail: {
          task_id: state.activeTaskId,
          strict_send_receipt: {
            ...trustedClick,
            retry_count: 0,
            confirmed: userAdded && Object.values(auxiliary).some(Boolean),
            confirmed_at: userAdded ? startedAt : '',
            task_id: state.activeTaskId,
            auxiliary,
          },
          final_state: projectState(state),
        },
      };
    },
    async reopenByTaskId({ taskId, prompt, expected }) {
      const intermediateNewTask = await this.openCleanNewTask();
      const click = await dispatchTrustedSessionClick(client, taskId);
      const state = await waitForState(client, (value) => value.activeTaskId === taskId
        && value.userCount > 0 && value.assistantCount > 0, STEP_TIMEOUT_MS);
      return {
        assertions: {
          intermediate_clean_new_task: allAssertionsPass(intermediateNewTask?.assertions),
          exact_session_clicked: click.evidence_valid === true,
          task_id_stable: state.activeTaskId === taskId,
          user_message_persisted: text(state.lastUser) === text(prompt),
          exact_reply_persisted: exactAppSanityReplyMatches(state.lastAssistant, expected),
          terminal_state_restored: state.running === false && state.sendButtonVisible === true,
        },
        detail: {
          ...projectState(state),
          intermediate_new_task: intermediateNewTask?.detail || {},
          click_receipt: click,
        },
      };
    },
    async openExpertsPage() {
      const click = await dispatchTrustedTestIdClick(client, 'nav-experts');
      const state = await waitForState(client, (value) => value.expertsView, STEP_TIMEOUT_MS);
      return {
        assertions: {
          experts_navigation_clicked: click.evidence_valid === true,
          experts_view_visible: state.expertsView,
          experts_tab_visible: state.expertsTab,
          skills_tab_visible: state.skillsTab,
          no_expert_error: !state.expertError,
        }, detail: { ...projectState(state), click_receipt: click },
      };
    },
    async openSkillsPage() {
      const click = await dispatchTrustedTestIdClick(client, 'skills-tab');
      const state = await waitForState(client, (value) => value.skillsView && !value.skillsLoading, STEP_TIMEOUT_MS);
      return {
        assertions: {
          skills_tab_clicked: click.evidence_valid === true,
          skills_view_visible: state.skillsView,
          skills_catalog_settled: !state.skillsLoading,
          no_skill_catalog_error: !state.skillsError,
        }, detail: { ...projectState(state), click_receipt: click },
      };
    },
    async openConnectorsPage() {
      const click = await dispatchTrustedTestIdClick(client, 'nav-connectors');
      const state = await waitForState(client, (value) => value.connectorsView && !value.connectorsLoading, STEP_TIMEOUT_MS);
      return {
        assertions: {
          connectors_navigation_clicked: click.evidence_valid === true,
          connectors_view_visible: state.connectorsView,
          connectors_catalog_settled: !state.connectorsLoading,
          no_connector_load_error: !state.connectorsError,
        }, detail: { ...projectState(state), click_receipt: click },
      };
    },
    async openAutomationsPage() {
      const click = await dispatchTrustedTestIdClick(client, 'nav-auto');
      const state = await waitForState(client, (value) => value.automationsView, STEP_TIMEOUT_MS);
      return {
        assertions: {
          automations_navigation_clicked: click.evidence_valid === true,
          automations_view_visible: state.automationsView,
        }, detail: { ...projectState(state), click_receipt: click },
      };
    },
  };
}

async function prepareComposer(client, prompt) {
  const prepared = await client.evaluate(`(() => {
    const editor = document.querySelector('[data-testid="composer-input"][contenteditable="true"]');
    if (!editor) return false;
    editor.focus();
    const selection = getSelection();
    const range = document.createRange();
    range.selectNodeContents(editor);
    selection.removeAllRanges();
    selection.addRange(range);
    document.execCommand('delete', false);
    return true;
  })()`);
  if (!prepared) return false;
  await client.send('Input.insertText', { text: String(prompt) });
  await delay(250);
  return true;
}

export async function dispatchTrustedTestIdClick(client, testId) {
  return dispatchTrustedVisibleSelectorClick(
    client,
    `[data-testid="${String(testId).replaceAll('"', '\\"')}"]`,
    `App sanity ${testId}`,
  );
}

async function dispatchTrustedSessionClick(client, taskId) {
  return dispatchTrustedTestIdClick(client, `session-item-${String(taskId)}`);
}

export async function dispatchTrustedVisibleSelectorClick(client, selector, label) {
  if (!client || typeof client.evaluate !== 'function' || typeof client.send !== 'function') {
    throw new Error(`${label} requires a CDP client.`);
  }
  const control = await client.evaluate(`(() => {
    const selector = ${JSON.stringify(String(selector))};
    const controls = [...document.querySelectorAll(selector)].filter((element) => {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.display !== 'none' && style.visibility !== 'hidden'
        && rect.width > 0 && rect.height > 0
        && !element.disabled && element.getAttribute('aria-disabled') !== 'true';
    });
    if (controls.length !== 1) return { visible: false, match_count: controls.length };
    const element = controls[0];
    const rect = element.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    const withinViewport = x >= 0 && y >= 0 && x < innerWidth && y < innerHeight;
    const hit = withinViewport ? document.elementFromPoint(x, y) : null;
    const hitTarget = hit === element || (hit && element.contains(hit));
    return {
      visible: withinViewport && Boolean(hitTarget),
      match_count: 1,
      within_viewport: withinViewport,
      hit_target: Boolean(hitTarget),
      test_id: String(element.getAttribute('data-testid') || ''),
      x,
      y,
      width: rect.width,
      height: rect.height,
    };
  })()`);
  const x = Number(control?.x);
  const y = Number(control?.y);
  if (control?.visible !== true || !Number.isFinite(x) || !Number.isFinite(y)) {
    throw new Error(`${label} did not resolve to exactly one visible, enabled, unobscured in-viewport control.`);
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
  return {
    evidence_valid: true,
    input_source: 'cdp-Input.dispatchMouseEvent',
    physical_input: true,
    click_count: 1,
    press_count: 1,
    release_count: 1,
    dispatched_at: dispatchedAt,
    control,
  };
}

async function waitForState(client, predicate, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  let state = await readAppSanityState(client);
  while (Date.now() < deadline) {
    if (predicate(state)) return state;
    await delay(250);
    state = await readAppSanityState(client);
  }
  return state;
}

async function readAppSanityState(client) {
  const runningSelector = JSON.stringify(QWORK_SMOKE_RUNNING_SELECTOR);
  const assistantBodySelector = JSON.stringify(QWORK_APP_SANITY_ASSISTANT_BODY_SELECTOR);
  const state = await client.evaluate(`(async () => {
    const visibleElements = (selector) => [...document.querySelectorAll(selector)].filter((element) => {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
    });
    const visible = (selector) => visibleElements(selector).length > 0;
    const visibleExactText = (selector, expected) => visibleElements(selector)
      .some((element) => (element.textContent || '').trim() === expected);
    let e2e = null;
    try { e2e = await globalThis.__qbotE2E?.getState?.(); } catch {}
    const userNodes = [...document.querySelectorAll('.aui-user-message-content, [data-role="user"]')]
      .filter((element) => (element.textContent || '').trim());
    const assistantNodes = [...document.querySelectorAll('.aui-assistant-message-root')]
      .filter((element) => (element.textContent || '').trim());
    const assistantBodyNodes = [...document.querySelectorAll(${assistantBodySelector})]
      .filter((element) => (element.textContent || '').trim());
    const activeTaskId = document.querySelector('[data-testid="qbot-app"]')?.getAttribute('data-active-session-id')
      || e2e?.activeId || '';
    return {
      qbotApp: visible('[data-testid="qbot-app"]'),
      navNewTask: visible('[data-testid="nav-new-task"]'),
      navExperts: visible('[data-testid="nav-experts"]'),
      navConnectors: visible('[data-testid="nav-connectors"]'),
      navAuto: visible('[data-testid="nav-auto"]'),
      composer: visible('[data-testid="composer-input"][contenteditable="true"]'),
      composerText: document.querySelector('[data-testid="composer-input"]')?.innerText?.trim() || '',
      sendButtonVisible: visible('[data-testid="composer-send"]'),
      running: typeof e2e?.running === 'boolean' ? e2e.running : visible(${runningSelector}),
      sendCount: Number.isSafeInteger(e2e?.sendCount) ? e2e.sendCount : null,
      messageCount: Number.isSafeInteger(e2e?.messageCount) ? e2e.messageCount : userNodes.length + assistantBodyNodes.length,
      activeTaskId: String(activeTaskId || ''),
      userCount: userNodes.length,
      lastUser: userNodes.length ? (userNodes.at(-1).innerText || userNodes.at(-1).textContent || '') : '',
      assistantCount: assistantBodyNodes.length,
      assistantRootCount: assistantNodes.length,
      assistantBodyTexts: assistantBodyNodes.map((element) => element.innerText || element.textContent || ''),
      capabilityChipCount: visibleElements('[data-testid="composer-selection-chips"] [data-testid*="chip"], [data-testid="composer-skill-chip"], [data-testid="composer-connector-chip"], [data-testid="composer-expert-chip"]').length,
      expertsView: visible('[data-testid="experts-view"]'),
      expertsTab: visible('[data-testid="experts-tab"]')
        || visibleExactText('[role="tab"][aria-selected="true"]', '\u4e13\u5bb6'),
      skillsTab: visible('[data-testid="skills-tab"]'),
      expertError: visible('[data-testid="expert-center-error"]'),
      skillsView: visible('[data-testid="skills-view"]'),
      skillsLoading: visible('[data-testid="skills-catalog-loading"]'),
      skillsError: visible('[data-testid="skills-catalog-sync-error"]'),
      connectorsView: visible('[data-testid="connectors-view"]'),
      connectorsLoading: visible('[data-testid="connectors-loading"], [data-testid="connectors-refreshing"]'),
      connectorsError: visible('[data-testid="connectors-load-error"]'),
      automationsView: visible('[data-testid="automation-view"]'),
    };
  })()`);
  return {
    ...state,
    lastAssistant: resolveAppSanityAssistantBody(state),
  };
}

function projectState(state) {
  return {
    active_task_id: state.activeTaskId || '',
    user_count: state.userCount,
    assistant_count: state.assistantCount,
    running: state.running,
    send_button_visible: state.sendButtonVisible,
    composer_visible: state.composer,
    composer_text_length: text(state.composerText).length,
    capability_chip_count: state.capabilityChipCount,
    views: {
      experts: state.expertsView,
      skills: state.skillsView,
      connectors: state.connectorsView,
      automations: state.automationsView,
    },
    pending_reply: isQworkSmokePendingReply(state.lastAssistant),
  };
}

async function captureClientScreenshot(client, file) {
  await client.send('Page.enable');
  const result = await client.send('Page.captureScreenshot', {
    format: 'png',
    fromSurface: true,
    captureBeyondViewport: false,
  });
  if (!result?.data) throw new Error('App sanity screenshot is empty.');
  fs.writeFileSync(file, Buffer.from(result.data, 'base64'), { mode: 0o600 });
}
