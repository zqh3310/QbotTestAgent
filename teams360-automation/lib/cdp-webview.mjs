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
        const qbotLocalUi = /qbot/i.test(document.title) || /\\/\\.deepbank\\/ui\\//.test(location.pathname);
        const qbotBridgeReady = typeof globalThis.qbotRuntime === 'object' && typeof globalThis.agent === 'object';
        const qbotWorkbench = qbotLocalUi
          && qbotBridgeReady
          && (/新建任务/.test(bodyText) || visible('[data-testid="nav-new-task"]'));
        return {
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
