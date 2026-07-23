#!/usr/bin/env node

import fs from 'node:fs';
import http from 'node:http';

const [listenPortText = '18900', upstreamPortText = '18901', envelopePath = ''] = process.argv.slice(2);
const listenPort = Number(listenPortText);
const upstreamPort = Number(upstreamPortText);

if (!Number.isInteger(listenPort) || !Number.isInteger(upstreamPort)) {
  throw new Error('teams-control-plane-proxy requires numeric listen and upstream ports');
}

let runtimeReleaseEnvelope = null;
if (envelopePath) {
  const parsed = JSON.parse(fs.readFileSync(envelopePath, 'utf8'));
  const releaseId = String(parsed?.assignment?.releaseId || '');
  const release = parsed?.catalog?.releases?.[releaseId];
  const signature = parsed?.catalog?.signature;
  if (!releaseId || !release || signature?.algorithm !== 'Ed25519' || !signature?.keyId || !signature?.value) {
    throw new Error('fixture runtime-release envelope is incomplete or unsigned');
  }
  runtimeReleaseEnvelope = parsed;
}

// QWork 0.0.12 moved secret-bearing connector materialization out of the
// renderer-visible turn-context response. The frozen fixture control plane
// predates that split, so the loopback-only proxy adapts its already
// authenticated public response to the new Electron-main-only route.
//
// The adapter is deliberately fail-closed:
// - it never calls or weakens an external control plane;
// - a successful public turn-context must be observed first;
// - the private request must carry a bearer credential; and
// - only the platform resource bundle is retained, never the public response
//   or its pre-materialized credential-bearing MCP configuration.
let cachedPrivateRuntimeContext = null;

function sendJson(response, statusCode, payload) {
  const body = Buffer.from(JSON.stringify(payload));
  response.writeHead(statusCode, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': String(body.length),
    'cache-control': 'no-store, private, max-age=0',
    pragma: 'no-cache',
    expires: '0',
    vary: 'Authorization',
  });
  response.end(body);
}

function hasPrivateBearer(request) {
  return /^Bearer\s+\S+$/i.test(String(request.headers.authorization || '').trim());
}

function cachePrivateRuntimeContext(upstreamBody) {
  try {
    const parsed = JSON.parse(upstreamBody.toString('utf8'));
    const platformResourcesBundle = parsed?.platformResourcesBundle;
    if (!platformResourcesBundle || typeof platformResourcesBundle !== 'object') return false;
    cachedPrivateRuntimeContext = {
      platformResourcesBundle,
      qbotVisionRuntime: {},
      redacted: true,
    };
    console.log(JSON.stringify({
      event: 'private-runtime-context-cached',
      resourceCount: Array.isArray(platformResourcesBundle.resources)
        ? platformResourcesBundle.resources.length
        : 0,
    }));
    return true;
  } catch {
    return false;
  }
}

const server = http.createServer((request, response) => {
  const url = new URL(String(request.url || '/'), `http://127.0.0.1:${listenPort}`);
  if (request.method === 'GET' && url.pathname === '/api/runtime-release' && runtimeReleaseEnvelope) {
    const body = Buffer.from(JSON.stringify(runtimeReleaseEnvelope));
    response.writeHead(200, {
      'content-type': 'application/json; charset=utf-8',
      'content-length': String(body.length),
      'cache-control': 'no-store',
    });
    response.end(body);
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/desktop-agent/private-runtime-context') {
    if (!hasPrivateBearer(request)) {
      sendJson(response, 403, { error: 'private_runtime_context_forbidden' });
      return;
    }
    if (!cachedPrivateRuntimeContext) {
      sendJson(response, 503, { error: 'private_runtime_context_unavailable' });
      return;
    }
    console.log(JSON.stringify({ event: 'private-runtime-context-served' }));
    sendJson(response, 200, cachedPrivateRuntimeContext);
    return;
  }

  // Preserve the public loopback Host header. The mock OAuth server derives
  // authorize/callback URLs from Host; replacing it with the private upstream
  // port leaks 18901 into the response and correctly trips the runner's
  // same-origin credential guard. The upstream address is already fixed by
  // the socket destination below, so changing Host is unnecessary.
  const headers = { ...request.headers };
  const captureTurnContext = request.method === 'POST'
    && url.pathname === '/api/desktop-agent/turn-context';
  const upstream = http.request({
    host: '127.0.0.1',
    port: upstreamPort,
    method: request.method,
    path: request.url,
    headers,
  }, (upstreamResponse) => {
    if (!captureTurnContext) {
      response.writeHead(upstreamResponse.statusCode || 502, upstreamResponse.headers);
      upstreamResponse.pipe(response);
      return;
    }
    const chunks = [];
    let size = 0;
    upstreamResponse.on('data', (chunk) => {
      size += chunk.length;
      if (size <= 10 * 1024 * 1024) chunks.push(chunk);
    });
    upstreamResponse.on('end', () => {
      const body = size <= 10 * 1024 * 1024 ? Buffer.concat(chunks) : Buffer.alloc(0);
      if ((upstreamResponse.statusCode || 500) >= 200 && (upstreamResponse.statusCode || 500) < 300) {
        cachePrivateRuntimeContext(body);
      }
      response.writeHead(upstreamResponse.statusCode || 502, upstreamResponse.headers);
      response.end(body);
    });
  });
  upstream.setTimeout(30_000, () => upstream.destroy(new Error('fixture control-plane upstream timeout')));
  upstream.on('error', () => {
    if (!response.headersSent) {
      response.writeHead(502, { 'content-type': 'application/json; charset=utf-8' });
    }
    response.end(JSON.stringify({ error: 'fixture_control_plane_proxy_failed' }));
  });
  request.pipe(upstream);
});

server.on('clientError', (_error, socket) => {
  socket.end('HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n');
});

server.listen(listenPort, '127.0.0.1', () => {
  const releaseId = String(runtimeReleaseEnvelope?.assignment?.releaseId || '');
  console.log(JSON.stringify({
    status: 'ready',
    listenPort,
    upstreamPort,
    runtimeRelease: releaseId || 'upstream',
  }));
});
