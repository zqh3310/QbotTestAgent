#!/usr/bin/env node
import { createRequire } from 'node:module';
import http from 'node:http';

const require = createRequire(import.meta.url);
const { ws: WebSocket, wsServer: WebSocketServer } = require('playwright-core/lib/utilsBundle');
const CDP_DEBUG = process.env.QBOT_TEAMS360_CDP_DEBUG === '1';

const QWORK_RUNTIME_BRIDGE_SOURCE = String.raw`(() => {
  const root = globalThis;
  const bridgeVersion = 5;
  const installAgentTimeoutGuards = () => {
    const agent = root.agent;
    if (!agent || typeof agent.capabilities !== 'function') return;
    if (root.__teams360AgentCapabilitiesOwner === agent
      && agent.capabilities === root.__teams360WrappedAgentCapabilities) return;
    const original = agent.capabilities.bind(agent);
    const wrapped = (...args) => Promise.race([
      Promise.resolve().then(() => original(...args)),
      new Promise((_, reject) => root.setTimeout(
        () => reject(new Error('Teams QWork capabilities timed out after 5000ms')),
        5000,
      )),
    ]);
    try {
      agent.capabilities = wrapped;
      root.__teams360AgentCapabilitiesOwner = agent;
      root.__teams360WrappedAgentCapabilities = wrapped;
    } catch {}
  };
  const installVisibleSessionRenameFallback = () => {
    if (root.__teams360VisibleSessionRenameFallback) return;
    const handler = (event) => {
      const item = event.target?.closest?.('[data-testid^="session-item-"]');
      if (!item) return;
      const testId = String(item.getAttribute('data-testid') || '');
      const sessionId = testId.replace(/^session-item-/, '');
      if (!sessionId) return;
      root.setTimeout(() => {
        if (document.querySelector('[data-testid="session-rename-input-' + sessionId + '"]')) return;
        const rect = item.getBoundingClientRect();
        item.dispatchEvent(new MouseEvent('contextmenu', {
          bubbles: true,
          cancelable: true,
          view: root,
          button: 2,
          buttons: 2,
          clientX: rect.left + Math.min(24, Math.max(1, rect.width / 2)),
          clientY: rect.top + Math.min(18, Math.max(1, rect.height / 2)),
        }));
        root.setTimeout(() => {
          const rename = document.querySelector('[data-testid="session-rename-action"]');
          if (!rename) return;
          rename.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: root }));
          rename.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: root }));
          rename.click();
        }, 80);
      }, 180);
    };
    document.addEventListener('dblclick', handler, true);
    root.__teams360VisibleSessionRenameFallback = handler;
  };
  const install = () => {
    installAgentTimeoutGuards();
    installVisibleSessionRenameFallback();
    const bridge = root.__qbotE2E || root.__deepbankE2E || {};
    if (bridge.getConnectionView === bridge.__teams360WrappedGetConnectionView
      && bridge.getState === bridge.__teams360WrappedGetState
      && bridge.__teams360BridgeVersion === bridgeVersion) return bridge;
    const platformGetConnectionView = typeof bridge.__teams360OriginalGetConnectionView === 'function'
      ? bridge.__teams360OriginalGetConnectionView
      : typeof bridge.getConnectionView === 'function'
        && bridge.getConnectionView !== bridge.__teams360WrappedGetConnectionView
        ? bridge.getConnectionView.bind(bridge)
        : null;
    const platformGetState = typeof bridge.__teams360OriginalGetState === 'function'
      ? bridge.__teams360OriginalGetState
      : typeof bridge.getState === 'function'
        && bridge.getState !== bridge.__teams360WrappedGetState
        ? bridge.getState.bind(bridge)
        : null;
    const wrappedGetConnectionView = async () => {
      let platformView = null;
      try {
        platformView = await platformGetConnectionView?.();
      } catch {}
      const platformOptions = platformView?.runtimeOptions?.options;
      const platformTier = String(platformView?.runtimeOptions?.selected?.complianceTier || '').toUpperCase();
      const control = document.querySelector('[data-testid="composer-safety-level-menu"]');
      const tier = String(control?.textContent || '').trim().toUpperCase();
      const rect = control?.getBoundingClientRect?.();
      const visible = Boolean(control && rect && rect.width > 0 && rect.height > 0);
      if (!visible || !/^M[1-4]$/.test(tier)) {
        if (Array.isArray(platformOptions) && platformOptions.length > 0 && /^M[1-4]$/.test(platformTier)) {
          return platformView;
        }
        return platformView || {};
      }
      const matchingPlatformOption = Array.isArray(platformOptions)
        ? platformOptions.find((option) => String(option?.complianceTier || '').toUpperCase() === tier && !option?.disabled)
        : null;
      const selected = matchingPlatformOption || {
        source: 'teams360-qwork-ui',
        connectionId: 'teams360-qwork-ui',
        modelId: tier.toLowerCase(),
        connectionLabel: '360Teams QWork',
        modelLabel: tier,
        complianceTier: tier,
        runtimeFamily: 'teams360-qwork-ui',
        disabled: false,
      };
      return {
        ...(platformView || {}),
        authenticated: true,
        runtimeOptions: {
          ...(platformView?.runtimeOptions || {}),
          selected,
          options: Array.isArray(platformOptions) && platformOptions.length ? platformOptions : [selected],
          runtimeFamily: selected.runtimeFamily || platformView?.runtimeOptions?.runtimeFamily,
        },
      };
    };
    const wrappedGetState = async () => {
      let platformState = null;
      try { platformState = await platformGetState?.(); } catch {}
      if (!platformState?.activeId && typeof bridge.state === 'function') {
        try { platformState = await bridge.state(); } catch {}
      }
      if (platformState?.activeId) return { available: true, ...platformState };
      const candidates = [
        '[data-testid^="session-item-"][aria-current="true"]',
        '[data-testid^="session-item-"].active',
        '[data-testid^="session-item-"][data-active="true"]',
        '[data-testid*="task-item"].active',
        '[data-testid^="session-item-"].on',
        '[data-testid^="session-item-"].recent.on',
        '.side-task-item.active',
        '.task-item.active',
      ];
      const active = candidates.map((selector) => document.querySelector(selector)).find(Boolean) || null;
      const testId = String(active?.getAttribute?.('data-testid') || '');
      let activeId = String(
        active?.getAttribute?.('data-session-id')
        || active?.getAttribute?.('data-task-id')
        || testId.replace(/^(?:session|task)-item-/, '')
        || '',
      );
      if (!activeId && typeof bridge.currentSession === 'function') {
        try { activeId = String((await bridge.currentSession())?.id || ''); } catch {}
      }
      const running = Boolean(document.querySelector(
        '[data-testid="composer-stop"], [data-testid="stop-generation"], button[aria-label*="停止"], button[title*="停止"]',
      ));
      const messageCount = document.querySelectorAll(
        '[data-testid^="message-"], [data-testid*="message-row"], .message-row, .chat-message',
      ).length;
      const workspaceControl = document.querySelector(
        '[data-testid="composer-workspace-menu"], [data-testid="workspace-selector"], [data-testid*="workspace"]',
      );
      const cwd = String(
        workspaceControl?.getAttribute?.('data-cwd')
        || workspaceControl?.getAttribute?.('title')
        || platformState?.cwd
        || '',
      );
      return {
        ...(platformState || {}),
        available: Boolean(activeId || document.querySelector('[data-testid="qbot-app"]')),
        activeId,
        running,
        messageCount,
        cwd,
        source: 'teams360-qwork-ui',
      };
    };
    bridge.__teams360OriginalGetConnectionView = platformGetConnectionView;
    bridge.__teams360WrappedGetConnectionView = wrappedGetConnectionView;
    bridge.__teams360OriginalGetState = platformGetState;
    bridge.__teams360WrappedGetState = wrappedGetState;
    bridge.__teams360ConnectionViewBridge = true;
    bridge.__teams360BridgeVersion = bridgeVersion;
    bridge.getConnectionView = wrappedGetConnectionView;
    bridge.getState = wrappedGetState;
    if (!root.__qbotE2E) root.__qbotE2E = bridge;
    if (!root.__deepbankE2E) root.__deepbankE2E = bridge;
    return bridge;
  };
  install();
  if (root.__teams360ConnectionViewBridgeTimerVersion !== bridgeVersion) {
    clearInterval(root.__teams360ConnectionViewBridgeTimer);
    root.__teams360ConnectionViewBridgeTimer = setInterval(install, 250);
    root.__teams360ConnectionViewBridgeTimerVersion = bridgeVersion;
  }
  return true;
})()`;

export function qworkRuntimeBridgeSource() {
  return QWORK_RUNTIME_BRIDGE_SOURCE;
}

export function rewriteCdpPayload(value) {
  if (Array.isArray(value)) return value.map(rewriteCdpPayload);
  if (!value || typeof value !== 'object') return value;
  const copy = Object.fromEntries(Object.entries(value).map(([key, item]) => [key, rewriteCdpPayload(item)]));
  if (isQworkTargetInfo(copy)) copy.type = 'page';
  else if (isTargetInfo(copy) && copy.type === 'page') copy.type = 'other';
  return copy;
}

function isTargetInfo(value) {
  return Boolean((value?.targetId || value?.id) && typeof value?.type === 'string');
}

function isQworkTargetInfo(value) {
  return value?.type === 'webview'
    && (/^qbot$/i.test(String(value.title || '')) || /\/\.deepbank\/ui\//.test(String(value.url || '')));
}

export async function startCdpWebviewProxy({ upstream, port = 0 }) {
  const upstreamUrl = new URL(upstream);
  if (!['127.0.0.1', 'localhost', '::1', '[::1]'].includes(upstreamUrl.hostname)) {
    throw new Error('The 360Teams CDP proxy only accepts a loopback upstream.');
  }

  const server = http.createServer(async (request, response) => {
    try {
      const pathname = new URL(request.url || '/', 'http://127.0.0.1').pathname;
      if (/^\/json\/version\/?$/.test(pathname)) {
        const version = await fetchJson(new URL('/json/version', upstreamUrl));
        const address = server.address();
        version.webSocketDebuggerUrl = `ws://127.0.0.1:${address.port}/devtools/browser`;
        return sendJson(response, 200, version);
      }
      if (/^\/json\/list\/?$/.test(pathname)) {
        const targets = await fetchJson(new URL('/json/list', upstreamUrl));
        return sendJson(response, 200, rewriteCdpPayload(targets));
      }
      return sendJson(response, 404, { error: 'not found' });
    } catch (error) {
      return sendJson(response, 502, { error: error.message });
    }
  });

  const wss = new WebSocketServer({ noServer: true });
  let activeDownstream = null;
  server.on('upgrade', (request, socket, head) => {
    const pathname = new URL(request.url || '/', 'http://127.0.0.1').pathname;
    if (pathname !== '/devtools/browser') {
      socket.destroy();
      return;
    }
    wss.handleUpgrade(request, socket, head, (downstream) => {
      // The QWork lane is intentionally single-runner. A timed-out Playwright
      // connection can otherwise leave an auto-attach browser socket alive and make
      // the next connectOverCDP attempt hang. Terminate the stale client before
      // accepting the replacement.
      if (activeDownstream && activeDownstream !== downstream) terminateSocket(activeDownstream);
      activeDownstream = downstream;
      downstream.once('close', () => {
        if (activeDownstream === downstream) activeDownstream = null;
      });
      void relayBrowserSocket({ downstream, upstreamUrl });
    });
  });

  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen({ host: '127.0.0.1', port }, resolve);
  });
  const address = server.address();
  return {
    url: `http://127.0.0.1:${address.port}`,
    reset: async () => {
      if (activeDownstream) terminateSocket(activeDownstream);
      activeDownstream = null;
      await new Promise((resolve) => setTimeout(resolve, 100));
    },
    close: () => new Promise((resolve) => {
      for (const client of wss.clients) terminateSocket(client);
      wss.close(() => server.close(() => resolve()));
    }),
  };
}

async function relayBrowserSocket({ downstream, upstreamUrl }) {
  let upstream = null;
  const queued = [];
  let stabilizationDeadline = 0;
  let downstreamClosed = false;
  const closeBoth = () => {
    terminateSocket(upstream);
    terminateSocket(downstream);
  };
  // Playwright sends Browser.getVersion immediately after the WebSocket upgrade.
  // Register this listener before the asynchronous /json/version lookup; otherwise
  // the first CDP packet can be lost and connectOverCDP waits until its timeout.
  downstream.on('message', (data) => {
    if (!stabilizationDeadline) stabilizationDeadline = Date.now() + 3_000;
    const text = String(data);
    debugCdpMessage('downstream', text, Date.now() < stabilizationDeadline);
    if (upstream?.readyState === WebSocket.OPEN) upstream.send(text);
    else queued.push(text);
  });
  downstream.on('close', () => {
    downstreamClosed = true;
    closeBoth();
  });
  downstream.on('error', () => {
    downstreamClosed = true;
    closeBoth();
  });
  try {
    const version = await fetchJson(new URL('/json/version', upstreamUrl));
    if (downstreamClosed || downstream.readyState !== WebSocket.OPEN) return;
    upstream = new WebSocket(version.webSocketDebuggerUrl);
    upstream.on('open', () => {
      for (const data of queued.splice(0)) upstream.send(data);
    });
    upstream.on('message', (data) => {
      if (downstream.readyState !== WebSocket.OPEN) return;
      try {
        const message = JSON.parse(String(data));
        debugCdpMessage('upstream', message, Date.now() < stabilizationDeadline);
        // Do not inject the QWork bridge while Playwright is still attaching the
        // WebView. Concurrent Runtime.evaluate and initialization commands race in
        // Electron 42 and can leave connectOverCDP waiting indefinitely. The wrapper
        // explicitly installs the bridge immediately after the browser is connected.
        downstream.send(JSON.stringify(rewriteCdpPayload(message)));
      } catch {
        downstream.send(data);
      }
    });
    upstream.on('close', closeBoth);
    upstream.on('error', closeBoth);
  } catch {
    closeBoth();
  }
}

function debugCdpMessage(direction, value, stabilize = false) {
  if (!CDP_DEBUG && !stabilize) return;
  try {
    const message = typeof value === 'string' ? JSON.parse(value) : value;
    const targetInfo = message?.params?.targetInfo || message?.result?.targetInfo || null;
    console.error(JSON.stringify({
      direction,
      id: message?.id ?? null,
      method: message?.method || '',
      sessionId: message?.sessionId || message?.params?.sessionId || '',
      target: targetInfo ? {
        targetId: targetInfo.targetId || '',
        type: targetInfo.type || '',
        title: targetInfo.title || '',
        url: targetInfo.url || '',
        attached: targetInfo.attached ?? null,
      } : null,
      hasError: Boolean(message?.error),
    }));
  } catch {
    console.error(JSON.stringify({ direction, parse_error: true }));
  }
}

function terminateSocket(socket) {
  if (!socket) return;
  if (typeof socket.terminate === 'function') {
    socket.terminate();
    return;
  }
  if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) socket.close();
}

async function fetchJson(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
  if (!response.ok) throw new Error(`Upstream CDP returned HTTP ${response.status}`);
  return response.json();
}

function sendJson(response, status, value) {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  response.end(`${JSON.stringify(value, null, 2)}\n`);
}

function parseCli(argv) {
  const values = {};
  for (let index = 0; index < argv.length; index += 2) {
    const name = argv[index];
    const value = argv[index + 1];
    if (!name?.startsWith('--') || value == null) throw new Error(`Invalid argument: ${name || ''}`);
    values[name.slice(2)] = value;
  }
  const upstream = String(values.upstream || '');
  const port = Number(values.port || 0);
  if (!upstream) throw new Error('--upstream is required.');
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error(`Invalid --port: ${values.port}`);
  return { upstream, port };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const proxy = await startCdpWebviewProxy(parseCli(process.argv.slice(2)));
  console.log(JSON.stringify({ status: 'ready', proxy_url: proxy.url }));
  const stop = async () => {
    await proxy.close();
    process.exit(0);
  };
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
}
