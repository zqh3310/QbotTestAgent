import fs from 'node:fs';
import path from 'node:path';
import { safeUrl, redactText } from './config.mjs';
import {
  QWORK_CAPABILITIES_NODE_TIMEOUT_GRACE_MS,
  QWORK_CAPABILITIES_READBACK_PHASES,
  qworkCapabilitiesCanonicalProjection,
  qworkCapabilitiesPreProbeFailure,
  qworkCapabilitiesReadbackEvidence,
  readStableQworkCapabilities,
  validateQworkCapabilitiesReadbackEvidence,
} from '../../src/lib/qwork-capabilities-readback.mjs';

export async function discoverWebviewProbes(cdpUrl, { timeoutMs = 10_000 } = {}) {
  const response = await fetch(`${cdpUrl}/json/list`, {
    signal: AbortSignal.timeout(timeoutMs),
    redirect: 'manual',
  });
  if (!response.ok) throw new Error(`Unable to list 360Teams CDP targets: HTTP ${response.status}`);
  const targets = await response.json();
  const probes = [];
  for (const target of targets.filter((item) => item.type === 'webview')) {
    let runtime = { markers: {}, counts: {} };
    try {
      runtime = await withTargetClient(target.webSocketDebuggerUrl, async (client) => client.evaluate(`(() => {
        const visible = (selector) => {
          const element = document.querySelector(selector);
          if (!element) return false;
          const style = getComputedStyle(element);
          const rect = element.getBoundingClientRect();
          return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
        };
        const bodyText = document.body?.innerText || '';
        const qbotLocalUi = /qbot/i.test(document.title)
          || /\\/\\.deepbank(?:-(?:dev|local|uat|sit))?\\/ui\\//.test(location.pathname);
        const qbotBridgeReady = typeof globalThis.qbotRuntime === 'object' && typeof globalThis.agent === 'object';
        const qbotWorkbench = qbotLocalUi
          && qbotBridgeReady
          && (/新建任务/.test(bodyText) || visible('[data-testid="nav-new-task"]'));
        let controlPlaneOrigin = '';
        try {
          const configuredControlPlane = typeof process !== 'undefined'
            ? process.env.DEEPBANK_SERVER || process.env.QBOT_SERVER_URL || ''
            : '';
          controlPlaneOrigin = configuredControlPlane
            ? new URL(configuredControlPlane).origin
            : '';
        } catch {}
        return {
          controlPlaneOrigin,
          markers: {
            teamsQbotChat: /\\/miniapps\\/deepbank\\/home\\/chat\\//.test(location.pathname),
            qbotLocalUi,
            qbotBridgeReady,
            qbotWorkbench,
            composer: visible('[data-testid="composer-input"]')
              || visible('textarea')
              || visible('.ql-editor[contenteditable="true"]'),
            sendButton: Boolean(document.querySelector('[data-testid="composer-send"], button .deepbank-icon.icon-send_new')),
            assistantContent: Boolean(document.querySelector('.aiMsgWrapper, [class*="aiWrapper"]')),
          },
          counts: {
            messages: document.querySelectorAll('[class*="messageItem"]').length,
            assistants: document.querySelectorAll('.aiMsgWrapper, [class*="aiWrapper"]').length,
          },
        };
      })()`));
    } catch (error) {
      runtime = { markers: {}, counts: {}, probe_error: redactText(error.message) };
    }
    probes.push({
      target_type: 'webview',
      target_id: String(target.id || ''),
      parent_id: String(target.parentId || ''),
      url: safeUrl(target.url),
      title: redactText(target.title).slice(0, 200),
      surface: runtime.markers?.qbotWorkbench ? 'teams360-qwork-qbot' : '',
      control_plane_origin: safeUrl(runtime.controlPlaneOrigin || ''),
      markers: runtime.markers || {},
      counts: runtime.counts || {},
      probe_error: runtime.probe_error || '',
      targetRef: {
        id: String(target.id || ''),
        webSocketDebuggerUrl: String(target.webSocketDebuggerUrl || ''),
      },
    });
  }
  return probes;
}

export function summarizePublicCapabilities(value) {
  const projection = qworkCapabilitiesCanonicalProjection(value);
  return {
    ok: projection.value_type === 'object',
    ...projection,
  };
}

export function summarizeRuntimeReleaseStatus(value) {
  const validObject = value != null && typeof value === 'object' && !Array.isArray(value);
  const preparedReleasePresent = validObject
    && Object.prototype.hasOwnProperty.call(value, 'preparedRelease');
  const compatibility = validObject
    && value.hostRuntimeCompatibility != null
    && typeof value.hostRuntimeCompatibility === 'object'
    && !Array.isArray(value.hostRuntimeCompatibility)
    ? value.hostRuntimeCompatibility
    : null;
  const hostCore = validObject
    && value.hostCore != null
    && typeof value.hostCore === 'object'
    && !Array.isArray(value.hostCore)
    ? value.hostCore
    : null;
  const loadedRuntime = validObject
    && value.loadedRuntime != null
    && typeof value.loadedRuntime === 'object'
    && !Array.isArray(value.loadedRuntime)
    ? value.loadedRuntime
    : null;
  const preparedRelease = validObject
    && value.preparedRelease != null
    && typeof value.preparedRelease === 'object'
    && !Array.isArray(value.preparedRelease)
    ? value.preparedRelease
    : null;
  const text = (input) => String(input || '').trim();
  const bootstrapPresent = compatibility != null
    && Object.prototype.hasOwnProperty.call(compatibility, 'bootstrap');
  const bootstrap = bootstrapPresent
    && compatibility.bootstrap != null
    && typeof compatibility.bootstrap === 'object'
    && !Array.isArray(compatibility.bootstrap)
    ? compatibility.bootstrap
    : null;
  const bootstrapSummary = bootstrap ? {
    release_id: text(bootstrap.releaseId),
    version: text(bootstrap.version),
    host_core_digest: text(bootstrap.hostCoreDigest),
    release_set_digest: text(bootstrap.releaseSetDigest),
    source: text(bootstrap.source),
    path: redactText(text(bootstrap.path)).slice(0, 1200),
  } : null;
  return {
    ok: validObject,
    value_type: value == null ? String(value) : Array.isArray(value) ? 'array' : typeof value,
    keys: validObject ? Object.keys(value).sort() : [],
    release_id: validObject ? text(value.releaseId) : '',
    version: validObject ? text(value.version) : '',
    commit_id: validObject ? text(value.commitId) : '',
    release_source: validObject ? text(value.source) : '',
    channel: validObject ? text(value.channel) : '',
    update_phase: validObject ? text(value.updatePhase) : '',
    prepared_release_present: preparedReleasePresent,
    prepared_release_valid: preparedReleasePresent
      && (value.preparedRelease === null || preparedRelease != null),
    prepared_release: preparedRelease ? {
      release_id: text(preparedRelease.releaseId),
      version: text(preparedRelease.version),
      commit_id: text(preparedRelease.commitId),
      channel: text(preparedRelease.channel),
    } : null,
    host_core: hostCore ? {
      version: text(hostCore.version),
      source: text(hostCore.source),
      path: redactText(text(hostCore.path)).slice(0, 1200),
      integrity: text(hostCore.integrity),
    } : null,
    loaded_runtime: loadedRuntime ? {
      release_id: text(loadedRuntime.releaseId),
      version: text(loadedRuntime.version),
      source: text(loadedRuntime.source),
      verified: loadedRuntime.verified === true,
    } : null,
    host_runtime_compatibility: compatibility ? {
      present: true,
      host_source: text(compatibility.hostSource),
      host_core_version: text(compatibility.hostCoreVersion),
      runtime_release_id: text(compatibility.runtimeReleaseId),
      runtime_version: text(compatibility.runtimeVersion),
      host_core_digest: text(compatibility.hostCoreDigest),
      bootstrap: bootstrapSummary,
      bootstrap_present: bootstrapPresent,
      versions_match: compatibility.versionsMatch === true,
    } : {
      present: false,
      host_source: '',
      host_core_version: '',
      runtime_release_id: '',
      runtime_version: '',
      host_core_digest: '',
      bootstrap: null,
      bootstrap_present: false,
      versions_match: false,
    },
  };
}

export function assessRuntimeReleaseStatus(summary, expectedVersion) {
  const expected = String(expectedVersion || '').trim();
  const compatibility = summary?.host_runtime_compatibility || {};
  const releaseIdentityMatches = Boolean(
    summary?.ok === true
    && expected
    && summary.release_id === expected
    && summary.version === expected
    && compatibility.runtime_release_id === expected
    && compatibility.runtime_version === expected
  );
  const hostRuntimeCompatible = Boolean(
    compatibility.present === true
    && compatibility.versions_match === true
    && compatibility.host_core_version
    && compatibility.runtime_version
    && compatibility.host_core_version === compatibility.runtime_version
  );
  const updateActivationSafe = Boolean(
    summary?.ok === true
    && summary.update_phase === 'idle'
    && summary.prepared_release_present === true
    && summary.prepared_release_valid === true
    && summary.prepared_release == null
  );
  return {
    ok: releaseIdentityMatches && hostRuntimeCompatible && updateActivationSafe,
    expected_version: expected,
    release_identity_matches: releaseIdentityMatches,
    host_runtime_compatible: hostRuntimeCompatible,
    update_activation_safe: updateActivationSafe,
  };
}

export async function probeWebviewPublicCapabilities(targetRef, options) {
  if (options !== undefined) {
    throw new Error(
      'QWork public capabilities probes use a fixed 15000ms cold load '
      + 'followed by exactly two fixed 2000ms stable reads.',
    );
  }
  const checkedAt = new Date().toISOString();
  const readWithClient = (client) => readStableQworkCapabilities(
    async ({ rendererTimeoutMs, nodeTimeoutMs }) => {
      const result = await client.evaluate(`(async () => {
          let timeoutId = null;
          try {
            if (typeof globalThis.window?.agent?.capabilities !== 'function') {
              throw new Error('missing window.agent.capabilities');
            }
            const timeout = new Promise((_, reject) => {
              timeoutId = setTimeout(
                () => reject(new Error('window.agent.capabilities timed out')),
                ${rendererTimeoutMs}
              );
            });
            const value = await Promise.race([
              globalThis.window.agent.capabilities(),
              timeout,
            ]);
            return { ok: true, value };
          } catch (error) {
            return { ok: false, error: String(error?.stack || error) };
          } finally {
            if (timeoutId !== null) clearTimeout(timeoutId);
          }
        })()`, nodeTimeoutMs);
      if (result?.ok !== true) {
        throw new Error(result?.error || 'window.agent.capabilities probe failed');
      }
      return result.value;
    },
  );
  let readback;
  if (!targetRef?.webSocketDebuggerUrl) {
    readback = qworkCapabilitiesPreProbeFailure({
      stage: 'target_discovery',
      errorCode: 'qwork_target_unavailable',
      error: 'The full QWork QBot WebView target is unavailable.',
    });
  } else {
    try {
      readback = await withTargetClient(
        targetRef.webSocketDebuggerUrl,
        readWithClient,
        { connectTimeoutMs: 10_000 },
      );
    } catch (error) {
      const stage = error?.cdpSetupStage === 'runtime_enable'
        ? 'runtime_enable'
        : 'cdp_connect';
      readback = qworkCapabilitiesPreProbeFailure({
        stage,
        errorCode: stage === 'runtime_enable'
          ? 'runtime_enable_failed'
          : 'cdp_connect_failed',
        error,
      });
    }
  }
  const evidence = qworkCapabilitiesReadbackEvidence(readback);
  const validation = validateQworkCapabilitiesReadbackEvidence(evidence);
  if (readback.ok && !validation.valid) {
    evidence.ok = false;
    evidence.error = `QWork capabilities evidence validation failed: ${validation.errors.join(',')}`;
  }
  const rendererTimeoutMs = QWORK_CAPABILITIES_READBACK_PHASES
    .reduce((total, phase) => total + phase.rendererTimeoutMs, 0);
  const nodeProbeTimeoutMs = rendererTimeoutMs
    + (QWORK_CAPABILITIES_READBACK_PHASES.length * QWORK_CAPABILITIES_NODE_TIMEOUT_GRACE_MS);
  const connectTimeoutMs = 10_000;
  const runtimeEnableTimeoutMs = 15_000;
  return {
    ...evidence,
    checked_at: checkedAt,
    total_renderer_timeout_ms: rendererTimeoutMs,
    total_node_probe_timeout_ms: nodeProbeTimeoutMs,
    connect_timeout_ms: connectTimeoutMs,
    runtime_enable_timeout_ms: runtimeEnableTimeoutMs,
    maximum_wall_clock_timeout_ms: connectTimeoutMs + runtimeEnableTimeoutMs + nodeProbeTimeoutMs,
    total_timeout_ms: connectTimeoutMs + runtimeEnableTimeoutMs + nodeProbeTimeoutMs,
    attempts: evidence.probe_ledger.map((entry) => ({
      attempt: entry.attempt,
      timeout_ms: entry.renderer_timeout_ms,
      started_at: entry.started_at,
      ended_at: entry.ended_at,
      duration_ms: entry.duration_ms,
      ok: entry.ok,
      value_type: entry.value_type,
      error: entry.error,
    })),
  };
}

export async function probeWebviewRuntimeReleaseStatus(targetRef) {
  const checkedAt = new Date().toISOString();
  if (!targetRef?.webSocketDebuggerUrl) {
    return {
      ok: false,
      checked_at: checkedAt,
      source: 'window.agent.runtimeReleaseStatus',
      error: 'The full QWork QBot WebView target is unavailable.',
    };
  }
  try {
    const result = await withTargetClient(targetRef.webSocketDebuggerUrl, async (client) => client.evaluate(`(async () => {
      try {
        if (typeof globalThis.window?.agent?.runtimeReleaseStatus !== 'function') {
          throw new Error('missing window.agent.runtimeReleaseStatus');
        }
        return { ok: true, value: await globalThis.window.agent.runtimeReleaseStatus() };
      } catch (error) {
        return { ok: false, error: String(error?.stack || error) };
      }
    })()`));
    if (result?.ok !== true) {
      return {
        ok: false,
        checked_at: checkedAt,
        source: 'window.agent.runtimeReleaseStatus',
        error: redactText(result?.error || 'window.agent.runtimeReleaseStatus probe failed').slice(0, 1200),
      };
    }
    const summary = summarizeRuntimeReleaseStatus(result.value);
    return {
      ...summary,
      checked_at: checkedAt,
      source: 'window.agent.runtimeReleaseStatus',
      error: summary.ok ? '' : 'window.agent.runtimeReleaseStatus returned a non-object value',
    };
  } catch (error) {
    return {
      ok: false,
      checked_at: checkedAt,
      source: 'window.agent.runtimeReleaseStatus',
      error: redactText(error?.message || String(error)).slice(0, 1200),
    };
  }
}

export async function captureWebviewScreenshot(targetRef, file) {
  if (!targetRef?.webSocketDebuggerUrl) return false;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  return withTargetClient(targetRef.webSocketDebuggerUrl, async (client) => {
    await client.send('Page.enable');
    const result = await client.send('Page.captureScreenshot', { format: 'png', fromSurface: true });
    if (!result?.data) return false;
    fs.writeFileSync(file, Buffer.from(result.data, 'base64'));
    return true;
  }).catch(() => false);
}

export async function withWebviewTargetClient(targetRef, callback) {
  if (!targetRef?.webSocketDebuggerUrl || typeof callback !== 'function') {
    throw new Error('A QWork WebView target and callback are required.');
  }
  const endpoint = new URL(String(targetRef.webSocketDebuggerUrl));
  if (!['ws:', 'wss:'].includes(endpoint.protocol)
    || !['127.0.0.1', 'localhost', '[::1]', '::1'].includes(endpoint.hostname)) {
    throw new Error('QWork WebView CDP targets must use a loopback WebSocket endpoint.');
  }
  return withTargetClient(endpoint.href, callback);
}

const QWORK_SMOKE_REPLY_STABLE_MS = 1200;
const QWORK_SMOKE_REPLY_STABLE_SAMPLES = 3;

export const QWORK_SMOKE_RUNNING_SELECTOR = [
  '[data-testid="composer-cancel"]',
  '[data-testid="composer-stop"]',
  '[data-testid="stop-generation"]',
  'button[aria-label*="停止"]',
  'button[title*="停止"]',
].join(', ');

const QWORK_SMOKE_PENDING_REPLY_PATTERNS = Object.freeze([
  /思考中|处理中|生成中|正在连接/u,
  /已经接住了[\s\S]{0,40}正在把回应接回来/u,
  /开场热身有点久[\s\S]{0,40}已经上场/u,
]);

export function isQworkSmokePendingReply(value) {
  const reply = String(value || '').trim();
  return Boolean(reply && QWORK_SMOKE_PENDING_REPLY_PATTERNS.some((pattern) => pattern.test(reply)));
}

export function advanceQworkSmokeReplySettlement({
  beforeAssistantCount,
  state,
  stableText = '',
  stableSince = 0,
  stableSamples = 0,
  now = Date.now(),
  stableWindowMs = QWORK_SMOKE_REPLY_STABLE_MS,
  requiredStableSamples = QWORK_SMOKE_REPLY_STABLE_SAMPLES,
}) {
  const reply = String(state?.lastAssistant || '').trim();
  const pending = isQworkSmokePendingReply(reply);
  const candidate = Boolean(
    Number.isSafeInteger(beforeAssistantCount)
    && Number.isSafeInteger(state?.assistantCount)
    && state.assistantCount > beforeAssistantCount
    && reply
    && state?.running === false
    && state?.sendButtonVisible === true
    && !pending,
  );
  if (!candidate) {
    return {
      complete: false,
      candidate: false,
      pending,
      reply,
      stableText: '',
      stableSince: 0,
      stableSamples: 0,
    };
  }
  const sameCandidate = reply === stableText && Number.isFinite(stableSince) && stableSince > 0;
  const candidateSince = sameCandidate ? stableSince : now;
  const candidateSamples = sameCandidate && Number.isSafeInteger(stableSamples) && stableSamples > 0
    ? stableSamples + 1
    : 1;
  return {
    complete: sameCandidate
      && candidateSamples >= requiredStableSamples
      && now - candidateSince >= stableWindowMs,
    candidate: true,
    pending: false,
    reply,
    stableText: reply,
    stableSince: candidateSince,
    stableSamples: candidateSamples,
  };
}

export async function runWebviewSmoke({ targetRef, prompt, expected, outputDir, timeoutMs = 120_000 }) {
  if (!targetRef?.webSocketDebuggerUrl) {
    return { status: 'blocked', reason: 'The full QWork QBot WebView target is unavailable.' };
  }
  const beforeFile = path.join(outputDir, 'screenshots', 'smoke-before-send.png');
  const afterFile = path.join(outputDir, 'screenshots', 'smoke-after-reply.png');
  const traceFile = path.join(outputDir, 'qwork-smoke-trace.jsonl');
  const trace = (stage, detail = {}) => {
    fs.appendFileSync(traceFile, `${JSON.stringify({ at: new Date().toISOString(), stage, ...detail })}\n`);
  };
  trace('connect');
  return withTargetClient(targetRef.webSocketDebuggerUrl, async (client) => {
    await client.evaluate(`(() => {
      const button = document.querySelector('[data-testid="nav-new-task"]');
      if (!button) return false;
      button.click();
      return true;
    })()`);
    const newTaskDeadline = Date.now() + 15_000;
    let before = await readQworkSmokeChatState(client);
    while (Date.now() < newTaskDeadline
      && (!before.composer || before.userCount > 0 || before.assistantCount > 0 || before.composerText)) {
      await delay(250);
      before = await readQworkSmokeChatState(client);
    }
    trace('new-task-ready', before);
    if (!before.composer) return { status: 'blocked', reason: 'The full QWork QBot composer was not found.' };
    if (before.userCount > 0 || before.assistantCount > 0) {
      return { status: 'blocked', reason: 'QWork did not finish creating a clean task before the smoke timeout.' };
    }

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
    if (!prepared) return { status: 'blocked', reason: 'The QWork QBot composer could not be prepared.' };
    await client.send('Input.insertText', { text: prompt });
    await delay(300);
    trace('prompt-inserted');
    await captureWithClient(client, beforeFile);

    const sent = await client.evaluate(`(() => {
      const button = document.querySelector('[data-testid="composer-send"]');
      if (!button || button.disabled) return false;
      button.click();
      return true;
    })()`);
    if (!sent) return { status: 'blocked', reason: 'The full QWork QBot send button did not become enabled.' };
    trace('message-sent');

    const deadline = Date.now() + timeoutMs;
    let state = before;
    let stableText = '';
    let stableSince = 0;
    let stableSamples = 0;
    let lastTraceState = '';
    let replyCompleted = false;
    let settlement = advanceQworkSmokeReplySettlement({
      beforeAssistantCount: before.assistantCount,
      state,
      stableText,
      stableSince,
      stableSamples,
    });
    while (Date.now() < deadline) {
      state = await readQworkSmokeChatState(client);
      settlement = advanceQworkSmokeReplySettlement({
        beforeAssistantCount: before.assistantCount,
        state,
        stableText,
        stableSince,
        stableSamples,
      });
      stableText = settlement.stableText;
      stableSince = settlement.stableSince;
      stableSamples = settlement.stableSamples;
      const traceState = `${state.userCount}:${state.assistantCount}:${state.running}:${state.sendButtonVisible}:${state.lastAssistant}`;
      if (traceState !== lastTraceState) {
        trace('poll-change', {
          userCount: state.userCount,
          assistantCount: state.assistantCount,
          replyLength: state.lastAssistant.length,
          running: state.running,
          sendButtonVisible: state.sendButtonVisible,
          pendingReply: settlement.pending,
        });
        lastTraceState = traceState;
      }
      if (settlement.complete) {
        replyCompleted = true;
        break;
      }
      await delay(400);
    }
    trace(replyCompleted ? 'reply-settled' : 'reply-timeout', {
      userCount: state.userCount,
      assistantCount: state.assistantCount,
      replyLength: state.lastAssistant.length,
      running: state.running,
      sendButtonVisible: state.sendButtonVisible,
      stableSamples,
      pendingReply: isQworkSmokePendingReply(state.lastAssistant),
    });
    await captureWithClient(client, afterFile);
    const screenshots = [beforeFile, afterFile].filter((file) => fs.existsSync(file));
    const userMessageAdded = state.userCount > before.userCount && state.lastUser.includes(prompt);
    if (!userMessageAdded) {
      return { status: 'failed', reason: 'The QWork composer did not add a new user message.', screenshots };
    }
    if (!replyCompleted) {
      return {
        status: 'failed',
        reason: 'No new completed AI reply was observed in the full QWork QBot WebView before timeout.',
        reply_excerpt: redactText(state.lastAssistant).slice(0, 500),
        assertions: {
          user_message_added: userMessageAdded,
          assistant_message_added: state.assistantCount > before.assistantCount,
          reply_completed: false,
          reply_contains_expected: false,
        },
        screenshots,
      };
    }
    if (/模型未配置|请联系管理员|模型服务暂时不可达|连接公司 VPN/.test(state.lastAssistant)) {
      return {
        status: 'blocked',
        reason: 'QWork accepted the test message, but its QBot runtime reported that the model is not configured.',
        reply_excerpt: redactText(state.lastAssistant).slice(0, 500),
        assertions: {
          user_message_added: userMessageAdded,
          assistant_message_added: true,
          reply_completed: true,
          reply_contains_expected: false,
        },
        screenshots,
      };
    }
    if (expected && !state.lastAssistant.includes(expected)) {
      return {
        status: 'failed',
        reason: `The new AI reply did not contain the expected text: ${redactText(expected)}`,
        reply_excerpt: redactText(state.lastAssistant).slice(0, 500),
        assertions: {
          user_message_added: userMessageAdded,
          assistant_message_added: state.assistantCount > before.assistantCount,
          reply_completed: true,
          reply_contains_expected: false,
        },
        screenshots,
      };
    }
    return {
      status: 'passed',
      prompt: redactText(prompt),
      expected: redactText(expected),
      reply_excerpt: redactText(state.lastAssistant).slice(0, 500),
      assertions: {
        user_message_added: userMessageAdded,
        assistant_message_added: state.assistantCount > before.assistantCount,
        reply_completed: true,
        reply_contains_expected: expected ? state.lastAssistant.includes(expected) : true,
      },
      screenshots,
    };
  });
}

export async function readQworkSmokeChatState(client) {
  const runningSelector = JSON.stringify(QWORK_SMOKE_RUNNING_SELECTOR);
  return client.evaluate(`(() => {
    const visibleElements = (selector) => [...document.querySelectorAll(selector)].filter((element) => {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
    });
    const visible = (selector) => visibleElements(selector).length > 0;
    const runningSelector = ${runningSelector};
    const sendButtonVisible = visible('[data-testid="composer-send"], button[type="submit"]');
    const userNodes = [...document.querySelectorAll('.aui-user-message-content')]
      .filter((element) => (element.textContent || '').trim());
    const assistantNodes = [...document.querySelectorAll('.aui-assistant-message-root')]
      .filter((element) => (element.textContent || '').trim());
    return {
      composer: Boolean(document.querySelector('[data-testid="composer-input"][contenteditable="true"]')),
      composerText: document.querySelector('[data-testid="composer-input"]')?.innerText?.trim() || '',
      userCount: userNodes.length,
      lastUser: userNodes.length ? (userNodes.at(-1).innerText || userNodes.at(-1).textContent || '') : '',
      assistantCount: assistantNodes.length,
      running: visible(runningSelector),
      sendButtonVisible,
      lastAssistant: assistantNodes.length
        ? (assistantNodes.at(-1).querySelector('.aui-assistant-message-content')?.innerText
          || assistantNodes.at(-1).innerText
          || assistantNodes.at(-1).textContent
          || '')
        : '',
    };
  })()`);
}

async function captureWithClient(client, file) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  await client.send('Page.enable').catch(() => {});
  const result = await client.send('Page.captureScreenshot', { format: 'png', fromSurface: true }).catch(() => null);
  if (result?.data) fs.writeFileSync(file, Buffer.from(result.data, 'base64'));
}

async function withTargetClient(webSocketDebuggerUrl, callback, {
  connectTimeoutMs = 10_000,
  operationTimeoutMs = 0,
  timeoutLabel = 'QBot WebView CDP operation',
} = {}) {
  const deadlineAt = operationTimeoutMs > 0 ? Date.now() + operationTimeoutMs : 0;
  const remainingTimeoutMs = () => {
    if (!deadlineAt) return 15_000;
    const remaining = deadlineAt - Date.now();
    if (remaining <= 0) throw new Error(`${timeoutLabel} timed out.`);
    return remaining;
  };
  let client = null;
  let deadlineTimer = null;
  try {
    const operation = (async () => {
      try {
        client = await TargetCdpClient.connect(
          webSocketDebuggerUrl,
          deadlineAt ? Math.min(connectTimeoutMs, remainingTimeoutMs()) : connectTimeoutMs,
        );
      } catch (error) {
        error.cdpSetupStage = 'cdp_connect';
        throw error;
      }
      try {
        await client.send('Runtime.enable', {}, remainingTimeoutMs());
      } catch (error) {
        error.cdpSetupStage = 'runtime_enable';
        throw error;
      }
      return callback(client, { deadlineAt, remainingTimeoutMs });
    })();
    if (!deadlineAt) return await operation;
    const deadline = new Promise((_, reject) => {
      deadlineTimer = setTimeout(
        () => reject(new Error(`${timeoutLabel} timed out.`)),
        operationTimeoutMs,
      );
    });
    return await Promise.race([operation, deadline]);
  } finally {
    if (deadlineTimer) clearTimeout(deadlineTimer);
    client?.close();
  }
}

class TargetCdpClient {
  constructor(socket) {
    this.socket = socket;
    this.nextId = 0;
    this.pending = new Map();
    socket.addEventListener('message', (event) => {
      const message = JSON.parse(String(event.data));
      const pending = this.pending.get(message.id);
      if (!pending) return;
      this.pending.delete(message.id);
      clearTimeout(pending.timer);
      message.error ? pending.reject(new Error(message.error.message)) : pending.resolve(message.result);
    });
    socket.addEventListener('close', () => {
      for (const pending of this.pending.values()) {
        clearTimeout(pending.timer);
        pending.reject(new Error('The QBot WebView CDP target closed.'));
      }
      this.pending.clear();
    });
  }

  static async connect(url, timeoutMs = 10_000) {
    const socket = new WebSocket(url);
    try {
      await new Promise((resolve, reject) => {
        let timer = null;
        const cleanup = () => {
          if (timer) clearTimeout(timer);
          socket.removeEventListener('open', onOpen);
          socket.removeEventListener('error', onError);
          socket.removeEventListener('close', onClose);
        };
        const settle = (callback, value) => {
          cleanup();
          callback(value);
        };
        const onOpen = () => settle(resolve);
        const onError = () => settle(reject, new Error('Unable to connect to the QBot WebView CDP target.'));
        const onClose = () => settle(reject, new Error('The QBot WebView CDP target closed before connecting.'));
        socket.addEventListener('open', onOpen, { once: true });
        socket.addEventListener('error', onError, { once: true });
        socket.addEventListener('close', onClose, { once: true });
        timer = setTimeout(() => {
          settle(reject, new Error('Timed out connecting to the QBot WebView CDP target.'));
        }, timeoutMs);
      });
    } catch (error) {
      try { socket.close(); } catch {}
      throw error;
    }
    return new TargetCdpClient(socket);
  }

  send(method, params = {}, timeoutMs = 15_000) {
    return new Promise((resolve, reject) => {
      const id = ++this.nextId;
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`CDP command timed out: ${method}`));
      }, timeoutMs);
      this.pending.set(id, { resolve, reject, timer });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }

  async evaluate(expression, timeoutMs = 15_000) {
    const result = await this.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
      userGesture: true,
    }, timeoutMs);
    if (result?.exceptionDetails) throw new Error(result.exceptionDetails.text || 'QBot WebView evaluation failed.');
    return result?.result?.value;
  }

  close() {
    try { this.socket.close(); } catch {}
  }
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
