#!/usr/bin/env node

import { spawn, execFileSync } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import net from 'node:net';
import path from 'node:path';

const [mode, qbotRoot, homeOverride, firstUrl = '', secondUrl = ''] = process.argv.slice(2);
if (!['skillhub', 'connector', 'capability'].includes(mode) || !qbotRoot) {
  console.error('Usage: teams-control-plane.mjs <skillhub|connector|capability> <qbot-root> <home> <fixture-url> [connector-url]');
  process.exit(2);
}

const port = 18900;
const upstreamPort = 18901;
const home = path.resolve(homeOverride || path.join(process.cwd(), 'teams360-automation', 'state', 'control-plane-home'));
const logDir = path.join(home, 'logs');
const pidDir = path.join(home, 'pids');
const pidFile = path.join(pidDir, 'teams-control-plane.pid');
const proxyPidFile = path.join(pidDir, 'teams-control-plane-proxy.pid');
const runtimeReleaseEnvelopeFile = String(process.env.QBOT_QA_RUNTIME_RELEASE_ENVELOPE_FILE || '').trim();
fs.mkdirSync(logDir, { recursive: true });
fs.mkdirSync(pidDir, { recursive: true });

function terminateGroup(pid) {
  if (!Number.isInteger(pid) || pid <= 1) return;
  try { process.kill(-pid, 'SIGTERM'); } catch {
    try { process.kill(pid, 'SIGTERM'); } catch {}
  }
}

if (fs.existsSync(pidFile)) {
  const pid = Number(fs.readFileSync(pidFile, 'utf8').trim());
  terminateGroup(pid);
  fs.rmSync(pidFile, { force: true });
}
if (fs.existsSync(proxyPidFile)) {
  const pid = Number(fs.readFileSync(proxyPidFile, 'utf8').trim());
  terminateGroup(pid);
  fs.rmSync(proxyPidFile, { force: true });
}
for (const targetPort of [port, upstreamPort]) {
  try {
    const listeners = execFileSync('lsof', ['-nP', `-tiTCP:${targetPort}`, '-sTCP:LISTEN'], { encoding: 'utf8' })
      .trim().split(/\s+/).map(Number).filter((pid) => pid > 1);
    for (const pid of listeners) terminateGroup(pid);
  } catch {}
}

function portIsOpen(targetPort) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host: '127.0.0.1', port: targetPort });
    const finish = (open) => {
      socket.removeAllListeners();
      socket.destroy();
      resolve(open);
    };
    socket.setTimeout(250);
    socket.once('connect', () => finish(true));
    socket.once('timeout', () => finish(false));
    socket.once('error', () => finish(false));
  });
}

let portClosed = false;
for (let attempt = 0; attempt < 80; attempt += 1) {
  if (!await portIsOpen(port) && !await portIsOpen(upstreamPort)) {
    portClosed = true;
    break;
  }
  await new Promise((resolve) => setTimeout(resolve, 100));
}
if (!portClosed) {
  throw new Error(`Teams fixture control plane ports ${port}/${upstreamPort} remained occupied after terminating the previous fixture.`);
}

const fixtureEnv = {
  ...process.env,
  PORT: String(upstreamPort),
  DEEPBANK_HOME: home,
  DEEPBANK_ENV: 'dev',
  DEEPBANK_E2E: mode === 'connector' ? (secondUrl || '1') : '1',
  // Runner-owned fixture control planes must not inherit the developer
  // checkout's Lingxi provider from .env.  Their database intentionally has
  // no real DEV app session, so a real OAuth callback can only produce an
  // invalid_app_session loop after the managed Teams host is relaunched.
  // Keep authentication deterministic and local for fixture-only cases; the
  // ordinary DEV lane still exercises the real Lingxi session.
  DEEPBANK_AUTH_PROVIDER: 'mock',
};
if (mode === 'skillhub' || mode === 'capability') {
  fixtureEnv.DEEPBANK_SKILLHUB_RESOURCES_BASE_URL = firstUrl;
}
if (mode === 'connector') {
  fixtureEnv.DEEPBANK_MCPHUB_MOCK = '0';
  fixtureEnv.DEEPBANK_MCPHUB_URL = `${firstUrl.replace(/\/$/, '')}/api/openapi/servers?detail=true`;
  fixtureEnv.DEEPBANK_MCPHUB_BASE_URL = firstUrl;
  // Connector fixture cases use a deterministic mock agent, while the
  // product still enforces the requested tier before every send. Supply the
  // runner-owned M3 connection through the normal platform API instead of
  // silently falling back to M4 or borrowing external DEV model state.
  fixtureEnv.DEEPBANK_LLM_CONNECTIONS_MOCK = '0';
  fixtureEnv.DEEPBANK_LLM_CONNECTIONS_URL = `${firstUrl.replace(/\/$/, '')}/openapi/models/llm-connections`;
}
if (mode === 'capability') {
  fixtureEnv.DEEPBANK_MCPHUB_MOCK = '0';
  fixtureEnv.DEEPBANK_MCPHUB_URL = `${secondUrl.replace(/\/$/, '')}/api/openapi/servers?detail=true`;
  fixtureEnv.DEEPBANK_MCPHUB_BASE_URL = secondUrl;
}

const logFd = fs.openSync(path.join(logDir, 'teams-control-plane.log'), 'a');
const child = spawn('npm', ['run', 'dev:server'], {
  cwd: path.resolve(qbotRoot),
  env: fixtureEnv,
  detached: true,
  stdio: ['ignore', logFd, logFd],
});
child.unref();
fs.closeSync(logFd);
fs.writeFileSync(pidFile, `${child.pid}\n`);

function health(targetPort) {
  return new Promise((resolve) => {
    const request = http.get(`http://127.0.0.1:${targetPort}/api/health`, { timeout: 1000 }, (response) => {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', (chunk) => { body += chunk; });
      response.on('end', () => {
        try {
          const payload = JSON.parse(body || '{}');
          resolve(
            response.statusCode === 200
            && payload.ready === true
            && payload.env === 'dev'
            && payload.auth?.provider?.id === 'mock',
          );
        } catch {
          resolve(false);
        }
      });
    });
    request.on('timeout', () => { request.destroy(); resolve(false); });
    request.on('error', () => resolve(false));
  });
}

let ready = false;
for (let attempt = 0; attempt < 160; attempt += 1) {
  if (await health(upstreamPort)) { ready = true; break; }
  try { process.kill(child.pid, 0); } catch { break; }
  await new Promise((resolve) => setTimeout(resolve, 250));
}
if (!ready) {
  const log = path.join(logDir, 'teams-control-plane.log');
  const detail = fs.existsSync(log) ? fs.readFileSync(log, 'utf8').slice(-8000) : 'no log';
  throw new Error(`Teams fixture control plane failed on ${upstreamPort}: ${detail}`);
}

const proxyScript = path.resolve(path.dirname(new URL(import.meta.url).pathname), 'teams-control-plane-proxy.mjs');
const proxyLogFd = fs.openSync(path.join(logDir, 'teams-control-plane-proxy.log'), 'a');
const proxy = spawn(process.execPath, [
  proxyScript,
  String(port),
  String(upstreamPort),
  runtimeReleaseEnvelopeFile,
], {
  detached: true,
  stdio: ['ignore', proxyLogFd, proxyLogFd],
});
proxy.unref();
fs.closeSync(proxyLogFd);
fs.writeFileSync(proxyPidFile, `${proxy.pid}\n`);

let proxyReady = false;
for (let attempt = 0; attempt < 80; attempt += 1) {
  if (await health(port)) {
    proxyReady = true;
    break;
  }
  try { process.kill(proxy.pid, 0); } catch { break; }
  await new Promise((resolve) => setTimeout(resolve, 100));
}
if (!proxyReady) {
  terminateGroup(proxy.pid);
  terminateGroup(child.pid);
  const proxyLog = path.join(logDir, 'teams-control-plane-proxy.log');
  const detail = fs.existsSync(proxyLog) ? fs.readFileSync(proxyLog, 'utf8').slice(-8000) : 'no proxy log';
  throw new Error(`Teams fixture control-plane proxy failed on ${port}: ${detail}`);
}

console.log(JSON.stringify({
  status: 'ready',
  mode,
  pid: child.pid,
  proxyPid: proxy.pid,
  port,
  upstreamPort,
  runtimeReleaseEnvelope: runtimeReleaseEnvelopeFile || '',
  home,
}));
