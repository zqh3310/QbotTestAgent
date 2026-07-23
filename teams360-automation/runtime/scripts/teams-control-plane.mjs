#!/usr/bin/env node

import { spawn, execFileSync } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';

const [mode, qbotRoot, homeOverride, firstUrl = '', secondUrl = ''] = process.argv.slice(2);
if (!['skillhub', 'connector', 'capability'].includes(mode) || !qbotRoot) {
  console.error('Usage: teams-control-plane.mjs <skillhub|connector|capability> <qbot-root> <home> <fixture-url> [connector-url]');
  process.exit(2);
}

const port = 18900;
const home = path.resolve(homeOverride || path.join(process.cwd(), 'teams360-automation', 'state', 'control-plane-home'));
const logDir = path.join(home, 'logs');
const pidDir = path.join(home, 'pids');
const pidFile = path.join(pidDir, 'teams-control-plane.pid');
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
try {
  const listeners = execFileSync('lsof', ['-nP', `-tiTCP:${port}`, '-sTCP:LISTEN'], { encoding: 'utf8' })
    .trim().split(/\s+/).map(Number).filter((pid) => pid > 1);
  for (const pid of listeners) terminateGroup(pid);
} catch {}

const fixtureEnv = {
  ...process.env,
  PORT: String(port),
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

function health() {
  return new Promise((resolve) => {
    const request = http.get(`http://127.0.0.1:${port}/api/health`, { timeout: 1000 }, (response) => {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', (chunk) => { body += chunk; });
      response.on('end', () => {
        try {
          const payload = JSON.parse(body || '{}');
          resolve(response.statusCode === 200 && payload.ready === true && payload.env === 'dev');
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
  if (await health()) { ready = true; break; }
  try { process.kill(child.pid, 0); } catch { break; }
  await new Promise((resolve) => setTimeout(resolve, 250));
}
if (!ready) {
  const log = path.join(logDir, 'teams-control-plane.log');
  const detail = fs.existsSync(log) ? fs.readFileSync(log, 'utf8').slice(-8000) : 'no log';
  throw new Error(`Teams fixture control plane failed on ${port}: ${detail}`);
}

console.log(JSON.stringify({ status: 'ready', mode, pid: child.pid, port, home }));
