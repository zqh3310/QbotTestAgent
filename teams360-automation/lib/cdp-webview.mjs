import fs from 'node:fs';
import path from 'node:path';
import { safeUrl, redactText } from './config.mjs';

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
  const validObject = value != null && typeof value === 'object' && !Array.isArray(value);
  return {
    ok: validObject,
    value_type: value == null ? String(value) : Array.isArray(value) ? 'array' : typeof value,
    keys: validObject ? Object.keys(value).sort() : [],
    selection_fields: validObject ? {
      selectedSkills: Object.hasOwn(value, 'selectedSkills'),
      selectedConnectors: Object.hasOwn(value, 'selectedConnectors'),
      currentExpert: Object.hasOwn(value, 'currentExpert'),
    } : {
      selectedSkills: false,
      selectedConnectors: false,
      currentExpert: false,
    },
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

export async function probeWebviewPublicCapabilities(targetRef) {
  const checkedAt = new Date().toISOString();
  if (!targetRef?.webSocketDebuggerUrl) {
    return {
      ok: false,
      checked_at: checkedAt,
      source: 'window.agent.capabilities',
      error: 'The full QWork QBot WebView target is unavailable.',
    };
  }
  try {
    const result = await withTargetClient(targetRef.webSocketDebuggerUrl, async (client) => client.evaluate(`(async () => {
      try {
        if (typeof globalThis.window?.agent?.capabilities !== 'function') {
          throw new Error('missing window.agent.capabilities');
        }
        return { ok: true, value: await globalThis.window.agent.capabilities() };
      } catch (error) {
        return { ok: false, error: String(error?.stack || error) };
      }
    })()`));
    if (result?.ok !== true) {
      return {
        ok: false,
        checked_at: checkedAt,
        source: 'window.agent.capabilities',
        error: redactText(result?.error || 'window.agent.capabilities probe failed').slice(0, 1200),
      };
    }
    const value = result.value;
    const summary = summarizePublicCapabilities(value);
    return {
      ...summary,
      checked_at: checkedAt,
      source: 'window.agent.capabilities',
      error: summary.ok ? '' : 'window.agent.capabilities returned a non-object value',
    };
  } catch (error) {
    return {
      ok: false,
      checked_at: checkedAt,
      source: 'window.agent.capabilities',
      error: redactText(error?.message || String(error)).slice(0, 1200),
    };
  }
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
    let before = await readChatState(client);
    while (Date.now() < newTaskDeadline
      && (!before.composer || before.userCount > 0 || before.assistantCount > 0 || before.composerText)) {
      await delay(250);
      before = await readChatState(client);
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
    let lastTraceState = '';
    while (Date.now() < deadline) {
      state = await readChatState(client);
      const traceState = `${state.userCount}:${state.assistantCount}:${state.lastAssistant}`;
      if (traceState !== lastTraceState) {
        trace('poll-change', {
          userCount: state.userCount,
          assistantCount: state.assistantCount,
          replyLength: state.lastAssistant.length,
        });
        lastTraceState = traceState;
      }
      const newAssistant = state.assistantCount > before.assistantCount;
      const reply = state.lastAssistant.trim();
      const pendingReply = /思考中|处理中|生成中|正在连接/.test(reply);
      if (newAssistant && reply && !pendingReply) {
        if (reply === stableText) {
          if (Date.now() - stableSince >= 1200) break;
        } else {
          stableText = reply;
          stableSince = Date.now();
        }
      }
      await delay(400);
    }
    trace('reply-settled', {
      userCount: state.userCount,
      assistantCount: state.assistantCount,
      replyLength: state.lastAssistant.length,
    });
    await captureWithClient(client, afterFile);
    const screenshots = [beforeFile, afterFile].filter((file) => fs.existsSync(file));
    const userMessageAdded = state.userCount > before.userCount && state.lastUser.includes(prompt);
    if (!userMessageAdded) {
      return { status: 'failed', reason: 'The QWork composer did not add a new user message.', screenshots };
    }
    if (state.assistantCount <= before.assistantCount || !state.lastAssistant.trim()) {
      return { status: 'failed', reason: 'No new completed AI reply was observed in the full QWork QBot WebView.', screenshots };
    }
    if (/模型未配置|请联系管理员|模型服务暂时不可达|连接公司 VPN/.test(state.lastAssistant)) {
      return {
        status: 'blocked',
        reason: 'QWork accepted the test message, but its QBot runtime reported that the model is not configured.',
        reply_excerpt: redactText(state.lastAssistant).slice(0, 500),
        assertions: {
          user_message_added: userMessageAdded,
          assistant_message_added: true,
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
        reply_contains_expected: expected ? state.lastAssistant.includes(expected) : true,
      },
      screenshots,
    };
  });
}

async function readChatState(client) {
  return client.evaluate(`(() => {
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

async function withTargetClient(webSocketDebuggerUrl, callback) {
  const client = await TargetCdpClient.connect(webSocketDebuggerUrl);
  try {
    await client.send('Runtime.enable');
    return await callback(client);
  } finally {
    client.close();
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
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Timed out connecting to the QBot WebView CDP target.')), timeoutMs);
      socket.addEventListener('open', () => {
        clearTimeout(timer);
        resolve();
      }, { once: true });
      socket.addEventListener('error', () => {
        clearTimeout(timer);
        reject(new Error('Unable to connect to the QBot WebView CDP target.'));
      }, { once: true });
    });
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

  async evaluate(expression) {
    const result = await this.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
      userGesture: true,
    });
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
