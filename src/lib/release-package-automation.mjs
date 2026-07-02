import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { ensureDir, timestampForPath, writeJsonFile, writeTextFile } from './fs.mjs';

const DEFAULT_MAC_APP = '/Applications/qbot.app';
const DEFAULT_TIMEOUT_SECONDS = 45;

export async function runReleasePackageAutomation({ mode = 'doctor', options = {}, root = process.cwd() } = {}) {
  const outDir = path.resolve(options.out || path.join(root, 'outputs', `release-package-${mode}-${timestampForPath()}`));
  ensureDir(outDir);
  const startedAt = new Date();
  const cleanup = [];
  const findings = [];
  const artifacts = {};
  let child = null;
  let status = 'pass';

  try {
    const target = resolveTarget(options);
    const runHome = path.join(outDir, 'runtime');
    const profileDir = path.join(runHome, 'chromium-profile');
    const logDir = path.join(outDir, 'logs');
    const screenshotDir = path.join(outDir, 'screenshots');
    ensureDir(runHome);
    ensureDir(profileDir);
    ensureDir(logDir);
    ensureDir(screenshotDir);

    const packageInfo = inspectPackage(target);
    if (packageInfo.status !== 'ready') findings.push(packageInfo.reason);
    if (target.dmg && shouldRemoveQuarantine(options)) {
      packageInfo.quarantine_removed_from_dmg = removeQuarantine(target.dmg);
      packageInfo.quarantine_after_cleanup = xattrContains(target.dmg, 'com.apple.quarantine');
    }

    const prepared = await prepareApp(target, { outDir, cleanup, removeQuarantine: shouldRemoveQuarantine(options) });
    if (prepared.status !== 'ready') findings.push(prepared.reason);

    const appInfo = prepared.appPath ? inspectMacApp(prepared.appPath) : {};
    if (prepared.appPath && shouldRemoveQuarantine(options)) {
      appInfo.quarantine_removed_from_app = removeQuarantine(prepared.appPath);
      appInfo.quarantine_after_cleanup = xattrContains(prepared.appPath, 'com.apple.quarantine');
    }

    const existing = listExistingQbotProcesses();
    if (existing.length) {
      findings.push(`Existing qbot process(es) detected before launch. The runner will not terminate user apps automatically: ${existing.map((item) => item.pid).join(', ')}`);
    }

    if (findings.length) {
      status = 'blocked';
      const report = buildReport({
        mode,
        status,
        startedAt,
        outDir,
        target,
        packageInfo,
        prepared,
        appInfo,
        existing,
        findings,
        artifacts,
      });
      writeOutputs(outDir, report);
      return report;
    }

    const port = options.port ? Number(options.port) : await findFreePort();
    const timeoutSeconds = Math.max(5, Number(options['timeout-seconds'] || DEFAULT_TIMEOUT_SECONDS));
    const launch = launchMacApp(prepared.appPath, {
      port,
      profileDir,
      logDir,
      extraArgs: splitArgs(options['extra-arg']),
      keepOpen: !!options['keep-open'],
      env: {
        ELECTRON_ENABLE_LOGGING: '1',
        DEEPBANK_TEST_HOME: path.join(runHome, 'deepbank-test-home'),
        QBOT_TEST_HOME: path.join(runHome, 'qbot-test-home'),
      },
    });
    child = launch.child;
    artifacts.stdout_log = launch.stdout;
    artifacts.stderr_log = launch.stderr;

    const cdp = await connectCdp({
      port,
      timeoutMs: timeoutSeconds * 1000,
      child,
      outDir,
      screenshotDir,
      clickTestId: options['click-testid'],
      typeText: options['type-text'],
      inputSelector: options['input-selector'],
      mode,
    });
    artifacts.initial_screenshot = cdp.artifacts.initial_screenshot;
    if (cdp.artifacts.after_action_screenshot) artifacts.after_action_screenshot = cdp.artifacts.after_action_screenshot;
    if (cdp.status !== 'pass') {
      status = cdp.status === 'blocked' ? 'blocked' : 'failed';
      findings.push(cdp.reason);
    } else if (cdp.operation?.status === 'blocked' || cdp.operation?.status === 'failed') {
      status = cdp.operation.status === 'blocked' ? 'blocked' : 'failed';
      findings.push(`Automation operation ${cdp.operation.action || 'unknown'} ${cdp.operation.status}: ${cdp.operation.reason || 'no reason provided'}`);
    }

    const report = buildReport({
      mode,
      status,
      startedAt,
      outDir,
      target,
      packageInfo,
      prepared,
      appInfo,
      existing,
      launch: {
        pid: child.pid,
        remote_debugging_port: port,
        stdout_log: launch.stdout,
        stderr_log: launch.stderr,
      },
      cdp,
      operation: cdp.operation,
      findings,
      artifacts,
    });
    writeOutputs(outDir, report);
    return report;
  } finally {
    if (child && !options['keep-open']) {
      terminateProcess(child);
    } else if (child) {
      child.unref();
    }
    for (const item of cleanup.reverse()) {
      try {
        item();
      } catch {
        // Cleanup failures are non-fatal after evidence is written.
      }
    }
  }
}

function resolveTarget(options) {
  const explicitApp = options.app ? path.resolve(String(options.app)) : '';
  const explicitDmg = options.dmg ? path.resolve(String(options.dmg)) : '';
  if (explicitApp) return { kind: 'app', source: explicitApp, app: explicitApp, dmg: '' };
  if (explicitDmg) return { kind: 'dmg', source: explicitDmg, app: '', dmg: explicitDmg };
  const latestDmg = findLatestDmg();
  if (latestDmg) return { kind: 'dmg', source: latestDmg, app: '', dmg: latestDmg };
  if (process.platform === 'darwin' && fs.existsSync(DEFAULT_MAC_APP)) return { kind: 'app', source: DEFAULT_MAC_APP, app: DEFAULT_MAC_APP, dmg: '' };
  return { kind: 'missing', source: '', app: '', dmg: '' };
}

function findLatestDmg() {
  if (process.platform !== 'darwin') return '';
  const candidates = [
    path.join(os.homedir(), 'Downloads'),
    path.join(os.homedir(), 'Desktop'),
  ];
  const files = [];
  for (const dir of candidates) {
    if (!fs.existsSync(dir)) continue;
    for (const name of fs.readdirSync(dir)) {
      if (/qbot.*\.dmg$/i.test(name) || /deepbank.*\.dmg$/i.test(name)) {
        const file = path.join(dir, name);
        const stat = fs.statSync(file);
        files.push({ file, mtimeMs: stat.mtimeMs });
      }
    }
  }
  files.sort((a, b) => b.mtimeMs - a.mtimeMs);
  return files[0]?.file || '';
}

function inspectPackage(target) {
  if (target.kind === 'missing') return { status: 'blocked', reason: 'No QBot dmg or app package was found. Provide --dmg or --app.' };
  if (!fs.existsSync(target.source)) return { status: 'blocked', reason: `Package path does not exist: ${target.source}` };
  const info = {
    status: 'ready',
    kind: target.kind,
    source: target.source,
    size_bytes: fs.statSync(target.source).size,
  };
  if (process.platform === 'darwin') {
    info.quarantine = xattrContains(target.source, 'com.apple.quarantine');
    if (target.kind === 'dmg') {
      info.image_info = runOptional('/usr/bin/hdiutil', ['imageinfo', target.source], { max: 4000 });
    }
  }
  return info;
}

async function prepareApp(target, { outDir, cleanup, removeQuarantine }) {
  if (process.platform !== 'darwin') {
    return { status: 'blocked', reason: `Release package automation is implemented for macOS first. Current platform: ${process.platform}` };
  }
  if (target.kind === 'app') {
    return fs.existsSync(path.join(target.app, 'Contents', 'Info.plist'))
      ? { status: 'ready', appPath: target.app, mounted: false }
      : { status: 'blocked', reason: `Invalid macOS app bundle: ${target.app}` };
  }
  if (target.kind !== 'dmg') return { status: 'blocked', reason: 'No runnable macOS app package was provided.' };
  if (removeQuarantine) removeQuarantineAttr(target.dmg);

  const existingApp = findMountedAppForDmg(target.dmg);
  if (existingApp) return { status: 'ready', appPath: existingApp, mounted: false, mount_reused: true };

  const mountPoint = path.join(outDir, 'dmg-mount');
  ensureDir(mountPoint);
  const attach = spawnSyncText('/usr/bin/hdiutil', ['attach', '-readonly', '-nobrowse', '-mountpoint', mountPoint, target.dmg], { timeout: 60000 });
  if (attach.status !== 0) {
    const fallback = findMountedAppForDmg(target.dmg);
    if (fallback) return { status: 'ready', appPath: fallback, mounted: false, mount_reused_after_busy: true, attach_stderr: attach.stderr };
    return { status: 'blocked', reason: `Failed to mount dmg: ${attach.stderr || attach.stdout || 'unknown error'}`, attach };
  }
  cleanup.push(() => {
    spawnSyncText('/usr/bin/hdiutil', ['detach', mountPoint, '-quiet'], { timeout: 30000 });
  });
  const appPath = findAppUnder(mountPoint);
  if (!appPath) return { status: 'blocked', reason: `Mounted dmg but no .app bundle was found under ${mountPoint}` };
  return { status: 'ready', appPath, mounted: true, mountPoint };
}

function findMountedAppForDmg(dmg) {
  const info = spawnSyncText('/usr/bin/hdiutil', ['info'], { timeout: 10000 });
  const lines = `${info.stdout}\n${info.stderr}`.split(/\r?\n/);
  const mounts = [];
  let inImage = false;
  for (const line of lines) {
    if (line.includes('image-path') && line.includes(dmg)) inImage = true;
    if (inImage && /\t\/.+/.test(line)) {
      const mount = line.split('\t').pop();
      if (mount && fs.existsSync(mount)) mounts.push(mount.trim());
    }
    if (line.startsWith('================================================')) inImage = false;
  }
  for (const mount of mounts) {
    const app = findAppUnder(mount);
    if (app) return app;
  }
  return '';
}

function findAppUnder(root) {
  if (!fs.existsSync(root)) return '';
  const entries = fs.readdirSync(root, { withFileTypes: true });
  for (const entry of entries) {
    const file = path.join(root, entry.name);
    if (entry.isDirectory() && entry.name.endsWith('.app') && fs.existsSync(path.join(file, 'Contents', 'Info.plist'))) return file;
  }
  return '';
}

function inspectMacApp(appPath) {
  const plist = path.join(appPath, 'Contents', 'Info.plist');
  const executable = plistValue(plist, 'CFBundleExecutable') || path.basename(appPath, '.app');
  const bundleId = plistValue(plist, 'CFBundleIdentifier');
  const name = plistValue(plist, 'CFBundleName');
  const version = plistValue(plist, 'CFBundleShortVersionString');
  const executablePath = path.join(appPath, 'Contents', 'MacOS', executable);
  return {
    app_path: appPath,
    name,
    bundle_id: bundleId,
    version,
    executable,
    executable_path: executablePath,
    executable_exists: fs.existsSync(executablePath),
    quarantine: xattrContains(appPath, 'com.apple.quarantine'),
    codesign: runOptional('/usr/bin/codesign', ['-dv', appPath], { max: 4000, mergeStderr: true }),
    spctl: runOptional('/usr/sbin/spctl', ['--assess', '--type', 'execute', '-vv', appPath], { max: 4000, mergeStderr: true }),
  };
}

function launchMacApp(appPath, { port, profileDir, logDir, extraArgs = [], env = {}, keepOpen = false }) {
  const appInfo = inspectMacApp(appPath);
  if (!appInfo.executable_exists) throw new Error(`Missing app executable: ${appInfo.executable_path}`);
  const stdout = path.join(logDir, 'qbot.stdout.log');
  const stderr = path.join(logDir, 'qbot.stderr.log');
  const args = [
    `--remote-debugging-port=${port}`,
    '--remote-allow-origins=*',
    `--user-data-dir=${profileDir}`,
    ...extraArgs,
  ];
  const child = spawn(appInfo.executable_path, args, {
    detached: keepOpen,
    stdio: ['ignore', fs.openSync(stdout, 'w'), fs.openSync(stderr, 'w')],
    env: { ...process.env, ...env },
  });
  return { child, stdout, stderr, args };
}

async function connectCdp({ port, timeoutMs, child, screenshotDir, clickTestId, typeText, inputSelector, mode }) {
  const started = Date.now();
  let version = null;
  while (Date.now() - started < timeoutMs) {
    if (child.exitCode !== null) {
      return { status: 'failed', reason: `QBot exited before CDP became available. exitCode=${child.exitCode}`, artifacts: {}, operation: { status: 'not_run' } };
    }
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json/version`);
      if (res.ok) {
        version = await res.json();
        break;
      }
    } catch {
      // keep polling
    }
    await sleep(500);
  }
  if (!version) {
    return { status: 'blocked', reason: `CDP endpoint did not become available on port ${port}.`, artifacts: {}, operation: { status: 'blocked' } };
  }

  const pages = await fetchJson(`http://127.0.0.1:${port}/json/list`);
  const page = pages.find((item) => item.type === 'page' && item.webSocketDebuggerUrl) || pages.find((item) => item.webSocketDebuggerUrl);
  if (!page) return { status: 'blocked', reason: 'CDP connected but no debuggable QBot page was found.', version, pages, artifacts: {}, operation: { status: 'blocked' } };
  if (typeof WebSocket === 'undefined') return { status: 'blocked', reason: 'Node.js WebSocket global is unavailable. Use Node.js 22+.', version, pages, artifacts: {}, operation: { status: 'blocked' } };

  const cdp = await openCdp(page.webSocketDebuggerUrl);
  try {
    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');
    await sleep(1500);
    const pageSummary = await evaluate(cdp, pageSummaryExpression());
    const initialShot = await captureScreenshot(cdp, path.join(screenshotDir, 'qbot-initial.png'));
    const operation = await performOperation(cdp, pageSummary, { clickTestId, typeText, inputSelector, mode });
    let afterShot = '';
    if (operation.status !== 'not_run') {
      afterShot = await captureScreenshot(cdp, path.join(screenshotDir, 'qbot-after-action.png'));
    }
    return {
      status: 'pass',
      reason: operation.status === 'blocked' || operation.status === 'failed'
        ? `QBot package launched, CDP connected, DOM inspected, screenshot captured; automation operation ${operation.status}.`
        : 'QBot package launched, CDP connected, DOM inspected, screenshot captured, and automation operation completed.',
      version,
      pages: pages.map((item) => ({ id: item.id, type: item.type, title: item.title, url: item.url })),
      page,
      page_summary: pageSummary,
      operation,
      artifacts: {
        initial_screenshot: initialShot,
        after_action_screenshot: afterShot,
      },
    };
  } finally {
    cdp.close();
  }
}

async function performOperation(cdp, pageSummary, { clickTestId, typeText, inputSelector, mode }) {
  if (clickTestId) {
    const target = await evaluate(cdp, elementBoxExpression(`[data-testid="${escapeForSelector(clickTestId)}"]`));
    if (!target) return { status: 'blocked', action: 'click', reason: `No visible element found for data-testid=${clickTestId}` };
    await clickPoint(cdp, target.x + target.w / 2, target.y + target.h / 2);
    return { status: 'passed', action: 'click', target };
  }

  if (typeText || inputSelector) {
    const selector = inputSelector || 'textarea,input,[contenteditable="true"]';
    const target = await evaluate(cdp, elementBoxExpression(selector));
    if (!target) return { status: 'blocked', action: 'type', reason: `No visible input found for selector ${selector}` };
    await clickPoint(cdp, target.x + Math.min(20, target.w / 2), target.y + Math.min(20, target.h / 2));
    await cdp.send('Input.insertText', { text: String(typeText || 'QBot automation smoke') });
    const value = await evaluate(cdp, `(() => { const el = document.querySelector(${JSON.stringify(selector)}); return el ? (el.value || el.innerText || el.textContent || '') : ''; })()`);
    return { status: 'passed', action: 'type', target, value: String(value).slice(0, 200) };
  }

  const firstControl = (pageSummary.controls || []).find((item) => item.visible && item.w > 0 && item.h > 0);
  if (!firstControl) {
    return { status: 'blocked', action: 'mouse-move', reason: 'No visible control was found for a safe mouse-move probe.' };
  }
  await cdp.send('Input.dispatchMouseEvent', {
    type: 'mouseMoved',
    x: firstControl.x + Math.min(10, firstControl.w / 2),
    y: firstControl.y + Math.min(10, firstControl.h / 2),
  });
  return {
    status: mode === 'doctor' ? 'limited_pass' : 'passed',
    action: 'mouse-move',
    reason: mode === 'doctor'
      ? 'Safe non-mutating mouse move was dispatched. Use --click-testid or --type-text for deeper package-run operations.'
      : 'Safe non-mutating mouse move was dispatched because no explicit click/type target was provided.',
    target: firstControl,
  };
}

function pageSummaryExpression() {
  return `(() => {
    const controls = [...document.querySelectorAll('button,[role="button"],textarea,input,[contenteditable="true"],a')].slice(0, 100).map((el, i) => {
      const r = el.getBoundingClientRect();
      return {
        i,
        tag: el.tagName,
        role: el.getAttribute('role'),
        testid: el.getAttribute('data-testid'),
        text: (el.innerText || el.value || el.getAttribute('aria-label') || el.title || el.placeholder || '').trim().slice(0, 120),
        x: r.x,
        y: r.y,
        w: r.width,
        h: r.height,
        visible: r.width > 0 && r.height > 0,
      };
    });
    return {
      title: document.title,
      url: location.href,
      readyState: document.readyState,
      bodyText: (document.body?.innerText || '').slice(0, 2000),
      runtime: window.qbotRuntime || null,
      hasAgent: !!window.agent,
      controls,
      editableCount: [...document.querySelectorAll('textarea,input,[contenteditable="true"]')].filter((el) => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
      }).length,
    };
  })()`;
}

function elementBoxExpression(selector) {
  return `(() => {
    const el = document.querySelector(${JSON.stringify(selector)});
    if (!el) return null;
    const r = el.getBoundingClientRect();
    if (!(r.width > 0 && r.height > 0)) return null;
    return {
      tag: el.tagName,
      role: el.getAttribute('role'),
      testid: el.getAttribute('data-testid'),
      text: (el.innerText || el.value || el.getAttribute('aria-label') || el.title || el.placeholder || '').trim().slice(0, 120),
      x: r.x,
      y: r.y,
      w: r.width,
      h: r.height,
    };
  })()`;
}

async function openCdp(wsUrl) {
  let id = 0;
  const pending = new Map();
  const ws = new WebSocket(wsUrl);
  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(JSON.stringify(msg.error)));
      else resolve(msg.result);
    }
  };
  await new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = reject;
  });
  return {
    send(method, params = {}) {
      const call = { id: ++id, method, params };
      ws.send(JSON.stringify(call));
      return new Promise((resolve, reject) => pending.set(call.id, { resolve, reject }));
    },
    close() {
      ws.close();
    },
  };
}

async function evaluate(cdp, expression) {
  const result = await cdp.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) throw new Error(`Runtime.evaluate failed: ${JSON.stringify(result.exceptionDetails)}`);
  return result.result?.value;
}

async function captureScreenshot(cdp, file) {
  const shot = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  fs.writeFileSync(file, Buffer.from(shot.data, 'base64'));
  return file;
}

async function clickPoint(cdp, x, y) {
  await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
  await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
}

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Fetch failed ${res.status}: ${url}`);
  return res.json();
}

async function findFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      server.close(() => resolve(port));
    });
    server.on('error', reject);
  });
}

function buildReport({
  mode,
  status,
  startedAt,
  outDir,
  target,
  packageInfo,
  prepared = {},
  appInfo = {},
  existing = [],
  launch = null,
  cdp = null,
  operation = null,
  findings = [],
  artifacts = {},
}) {
  return {
    command: `release-package-${mode}`,
    status,
    generated_at: new Date().toISOString(),
    started_at: startedAt.toISOString(),
    out_dir: outDir,
    platform: process.platform,
    package: {
      kind: target.kind,
      source: target.source,
      app_path: prepared.appPath || target.app || '',
      mounted: !!prepared.mounted,
      mount_reused: !!prepared.mount_reused,
    },
    package_info: packageInfo,
    app_info: appInfo,
    existing_qbot_processes_before_launch: existing,
    launch,
    cdp: cdp ? {
      status: cdp.status,
      reason: cdp.reason,
      browser: cdp.version?.Browser || '',
      page_title: cdp.page_summary?.title || '',
      page_url: cdp.page_summary?.url || '',
      ready_state: cdp.page_summary?.readyState || '',
      runtime: cdp.page_summary?.runtime || null,
      has_agent_bridge: !!cdp.page_summary?.hasAgent,
      visible_control_count: (cdp.page_summary?.controls || []).filter((item) => item.visible).length,
      editable_count: cdp.page_summary?.editableCount ?? 0,
      visible_controls: (cdp.page_summary?.controls || []).filter((item) => item.visible).slice(0, 20),
    } : null,
    operation: operation || { status: 'not_run' },
    findings,
    artifacts,
  };
}

function writeOutputs(outDir, report) {
  writeJsonFile(path.join(outDir, 'release-package-automation-report.json'), report);
  writeTextFile(path.join(outDir, 'release-package-automation-report.md'), renderReport(report));
}

function renderReport(report) {
  return [
    '# QBot Release Package Automation Report',
    '',
    `- Status: ${report.status}`,
    `- Command: ${report.command}`,
    `- Package: ${report.package.source || 'none'}`,
    `- App: ${report.package.app_path || 'none'}`,
    `- Platform: ${report.platform}`,
    `- CDP: ${report.cdp?.status || 'not-run'}`,
    `- Operation: ${report.operation?.status || 'not-run'} (${report.operation?.action || 'none'})`,
    `- Initial screenshot: ${report.artifacts.initial_screenshot || 'none'}`,
    `- After-action screenshot: ${report.artifacts.after_action_screenshot || 'none'}`,
    `- Stdout log: ${report.artifacts.stdout_log || report.launch?.stdout_log || 'none'}`,
    `- Stderr log: ${report.artifacts.stderr_log || report.launch?.stderr_log || 'none'}`,
    '',
    '## Findings',
    ...(report.findings.length ? report.findings.map((item) => `- ${item}`) : ['- None']),
    '',
    '## Visible Controls',
    ...((report.cdp?.visible_controls || []).length
      ? report.cdp.visible_controls.map((item) => `- ${item.testid || item.tag}: ${item.text || '(empty)'} @ ${Math.round(item.x)},${Math.round(item.y)} ${Math.round(item.w)}x${Math.round(item.h)}`)
      : ['- None']),
    '',
  ].join('\n');
}

function shouldRemoveQuarantine(options) {
  return options['remove-quarantine'] !== false;
}

function removeQuarantine(file) {
  return removeQuarantineAttr(file).status === 0;
}

function removeQuarantineAttr(file) {
  return spawnSyncText('/usr/bin/xattr', ['-dr', 'com.apple.quarantine', file], { timeout: 30000 });
}

function xattrContains(file, name) {
  const result = spawnSyncText('/usr/bin/xattr', ['-l', file], { timeout: 10000 });
  return `${result.stdout}\n${result.stderr}`.includes(name);
}

function plistValue(plist, key) {
  const result = spawnSyncText('/usr/libexec/PlistBuddy', ['-c', `Print :${key}`, plist], { timeout: 10000 });
  return result.status === 0 ? result.stdout.trim() : '';
}

function runOptional(command, args, { max = 2000, mergeStderr = false } = {}) {
  const result = spawnSyncText(command, args, { timeout: 20000 });
  const text = mergeStderr ? `${result.stdout}${result.stderr}` : result.stdout || result.stderr;
  return text.slice(0, max);
}

function spawnSyncText(command, args, options = {}) {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    maxBuffer: 10 * 1024 * 1024,
    ...options,
  });
  return {
    status: result.status ?? (result.error ? 1 : 0),
    stdout: result.stdout || '',
    stderr: result.stderr || (result.error ? result.error.message : ''),
  };
}

function listExistingQbotProcesses() {
  const result = spawnSyncText('/bin/ps', ['axww', '-o', 'pid=', '-o', 'ppid=', '-o', 'stat=', '-o', 'command='], { timeout: 10000 });
  return result.stdout.split(/\r?\n/)
    .map((line) => {
      const match = line.trim().match(/^(\d+)\s+(\d+)\s+(\S+)\s+(.+)$/);
      if (!match) return null;
      return { pid: Number(match[1]), ppid: Number(match[2]), stat: match[3], command: match[4] };
    })
    .filter(Boolean)
    .filter((item) => {
      const command = item.command || '';
      return command.startsWith('/Applications/qbot.app/Contents/MacOS/qbot')
        || /^\/.+\/qbot\.app\/Contents\/MacOS\/qbot(?:\s|$)/.test(command)
        || /^\/.+\/qbot\.app\/Contents\/Frameworks\/qbot Helper(?: |$|\()/u.test(command);
    })
    .map((line) => {
      return line;
    });
}

function terminateProcess(child) {
  if (!child || child.exitCode !== null) return;
  try {
    child.kill('SIGTERM');
  } catch {
    return;
  }
}

function splitArgs(value) {
  if (!value || value === true) return [];
  if (Array.isArray(value)) return value.flatMap(splitArgs);
  return String(value).split(/\s+/).map((item) => item.trim()).filter(Boolean);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function escapeForSelector(value) {
  return String(value).replace(/"/g, '\\"');
}
