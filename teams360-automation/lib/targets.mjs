import fs from 'node:fs';
import path from 'node:path';
import { redactText, safeUrl } from './config.mjs';
import {
  captureWebviewScreenshot,
  discoverWebviewProbes,
  probeWebviewPublicCapabilities,
  probeWebviewRuntimeReleaseStatus,
  runWebviewSmoke,
} from './cdp-webview.mjs';

const QBOT_ENTRY_SELECTORS = [
  '[data-testid*="qbot" i]',
  '[data-action="deepbank"]',
  '[class*="qbot" i]',
  '[class*="deepbank-ball" i]',
];

export function scoreTargetProbe(probe = {}) {
  let score = 0;
  if (/teams360/i.test(String(probe.surface || ''))) score += 120;
  else if (probe.surface) score += 80;
  if (probe.markers?.navNewTask) score += 60;
  if (probe.markers?.composer) score += 50;
  if (probe.markers?.authLogin) score += 30;
  if (probe.markers?.assistantThread) score += 25;
  if (probe.markers?.qbotWorkbench) score += 220;
  if (probe.markers?.teamsQbotChat) score += 5;
  if (probe.markers?.teamsQbotSender) score += 5;
  if (probe.markers?.qbotText) score += 15;
  if (/qbot|deepbank/i.test(`${probe.url || ''} ${probe.title || ''}`)) score += 20;
  return score;
}

export function selectBestTarget(probes = []) {
  return [...probes]
    .map((probe) => ({ ...probe, score: scoreTargetProbe(probe) }))
    .sort((a, b) => b.score - a.score)[0] || null;
}

export async function inspectTeamsCdp({ cdpUrl, outputDir, openQbot = false, captureHost = false, smoke = false, allowWrite = false, prompt = '', expected = '', timeoutMs = 120_000, probePublicCapabilities = false, probeRuntimeReleaseStatus = false }) {
  const loaded = await import('playwright').catch((error) => ({ error }));
  if (loaded.error) throw new Error(`Playwright is unavailable: ${loaded.error.message}`);
  fs.mkdirSync(path.join(outputDir, 'screenshots'), { recursive: true });

  const browser = await loaded.chromium.connectOverCDP(cdpUrl);
  let snapshot = await collectTargetProbes(browser);
  let webviewProbes = await discoverWebviewProbes(cdpUrl, { timeoutMs: Math.min(timeoutMs, 10_000) });
  let probes = [...snapshot.probes, ...webviewProbes];
  let openedEntry = null;
  let best = selectBestTarget(probes.filter(isFullQbotProbe));

  if (!best && openQbot) {
    openedEntry = await tryOpenQwork(snapshot.pages);
    if (!openedEntry.clicked && !openedEntry.already_open) openedEntry = await tryOpenQbot(snapshot.pages);
    await delay(5000);
    snapshot = await collectTargetProbes(browser);
    webviewProbes = await discoverWebviewProbes(cdpUrl, { timeoutMs: Math.min(timeoutMs, 10_000) });
    probes = [...snapshot.probes, ...webviewProbes];
    best = selectBestTarget(probes.filter(isFullQbotProbe));
  }

  const scoredProbes = probes.map((probe) => ({ ...probe, score: scoreTargetProbe(probe) }));
  const serializableProbes = scoredProbes.map(stripRuntimeRefs);
  const hostLogin = scoredProbes.find((probe) => probe.markers?.teamsHostLogin);
  const result = {
    cdp_url: cdpUrl,
    page_count: snapshot.pages.length,
    frame_count: snapshot.probes.length,
    webview_count: webviewProbes.length,
    entry_open_attempt: openedEntry,
    targets: serializableProbes,
    qbot_target: best ? stripRuntimeRefs(best) : null,
    host_precondition: hostLogin
      ? { status: 'blocked', reason: '360Teams is waiting for QR-code login.' }
      : { status: 'ready', reason: '' },
    screenshots: {},
    public_capabilities: probePublicCapabilities
      ? await probeWebviewPublicCapabilities(best?.targetRef)
      : null,
    runtime_release_status: probeRuntimeReleaseStatus
      ? await probeWebviewRuntimeReleaseStatus(best?.targetRef)
      : null,
    smoke: { status: 'skipped', reason: 'Smoke was not requested.' },
  };

  const hostPage = findHostRootPage(snapshot.pages);
  if (captureHost && hostPage) {
    const file = path.join(outputDir, 'screenshots', 'teams-host.png');
    await hostPage.screenshot({ path: file, fullPage: false, timeout: 15_000 }).catch(() => {});
    if (fs.existsSync(file)) result.screenshots.teams_host = file;
  }

  if (best?.targetRef) {
    const file = path.join(outputDir, 'screenshots', 'qbot-target.png');
    if (await captureWebviewScreenshot(best.targetRef, file)) result.screenshots.qbot_target = file;
  } else if (best?.pageRef) {
    const file = path.join(outputDir, 'screenshots', 'qbot-target.png');
    await best.pageRef.screenshot({ path: file, fullPage: false, timeout: 15_000 }).catch(() => {});
    if (fs.existsSync(file)) result.screenshots.qbot_target = file;
  }

  if (smoke) {
    if (!allowWrite) {
      result.smoke = { status: 'blocked', reason: 'Smoke sends a test message. Re-run with --allow-write to confirm this scoped mutation.' };
    } else if (best?.targetRef) {
      result.smoke = await runWebviewSmoke({
        targetRef: best.targetRef,
        prompt,
        expected,
        outputDir,
        timeoutMs,
      });
    } else {
      result.smoke = await runSmoke({ best, allowWrite, prompt, outputDir, timeoutMs });
    }
  }
  return result;
}

async function collectTargetProbes(browser) {
  const pages = browser.contexts().flatMap((context) => context.pages());
  const probes = [];
  for (let pageIndex = 0; pageIndex < pages.length; pageIndex += 1) {
    const page = pages[pageIndex];
    const title = await page.title().catch(() => '');
    const frames = page.frames();
    for (let frameIndex = 0; frameIndex < frames.length; frameIndex += 1) {
      const frame = frames[frameIndex];
      const raw = await frame.evaluate(() => {
        const runtime = globalThis.qbotRuntime || globalThis.deepbankRuntime || null;
        const surface = typeof runtime?.surface === 'string'
          ? runtime.surface
          : typeof runtime?.hostProfile === 'string' ? runtime.hostProfile : '';
        const visible = (selector) => {
          const element = document.querySelector(selector);
          if (!element) return false;
          const style = getComputedStyle(element);
          const rect = element.getBoundingClientRect();
          return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
        };
        const bodyText = document.body?.innerText || '';
        return {
          surface,
          markers: {
            navNewTask: visible('[data-testid="nav-new-task"]'),
            composer: visible('[data-testid="composer-input"]')
              || visible('textarea')
              || visible('.ql-editor[contenteditable="true"]'),
            authLogin: visible('[data-testid="auth-login"]'),
            assistantThread: visible('[data-testid="assistant-thread"]'),
            qbotText: /QBot|Q宝|新建任务/.test(bodyText),
            teamsText: /360Teams/.test(bodyText),
            teamsHostLogin: /扫码登录|请使用移动端\s*360Teams\s*扫码登录/.test(bodyText),
            teamsQbotSender: /\/miniapps\/deepbank\/home\/copilotSender/.test(location.pathname),
          },
        };
      }).catch(() => ({ surface: '', markers: {} }));
      probes.push({
        page_index: pageIndex,
        frame_index: frameIndex,
        is_main_frame: frame === page.mainFrame(),
        url: safeUrl(frame.url() || page.url()),
        title: redactText(title).slice(0, 200),
        surface: redactText(raw.surface).slice(0, 100),
        markers: raw.markers || {},
        pageRef: page,
        frameRef: frame,
      });
    }
  }
  return { pages, probes };
}

async function tryOpenQbot(pages) {
  for (const page of pages) {
    for (const selector of QBOT_ENTRY_SELECTORS) {
      const target = page.locator(selector).first();
      if (await target.isVisible().catch(() => false)) {
        await target.click({ force: true }).catch(async () => target.evaluate((element) => element.click()));
        return { clicked: true, method: 'selector', selector };
      }
    }
    for (const label of [/^QBot$/i, /^Q宝$/, /QBot|Q宝/]) {
      const target = page.getByText(label).first();
      if (await target.isVisible().catch(() => false)) {
        await target.click({ force: true }).catch(async () => target.evaluate((element) => element.click()));
        return { clicked: true, method: 'text', selector: String(label) };
      }
    }
  }
  return { clicked: false, reason: 'No visible QBot entry was found in the 360Teams renderer.' };
}

async function tryOpenQwork(pages) {
  const host = findHostRootPage(pages);
  if (!host) return { clicked: false, reason: 'The 360Teams host root page was not found.' };
  if (host.url().includes('#/main/apps/qbot')) {
    return { clicked: false, already_open: true, method: 'route', selector: '#/main/apps/qbot' };
  }
  const target = host.locator('.sidenav-item').filter({ hasText: 'QWork' }).first();
  if (!await target.isVisible().catch(() => false)) {
    return { clicked: false, reason: 'The visible QWork sidebar entry was not found.' };
  }
  await target.click();
  return { clicked: true, method: 'sidebar', selector: '.sidenav-item:has-text("QWork")' };
}

function findHostRootPage(pages) {
  return pages.find((page) => {
    try {
      const url = new URL(page.url());
      return url.origin === 'http://localhost:33013' && url.pathname === '/';
    } catch {
      return false;
    }
  }) || null;
}

export function isFullQbotProbe(probe) {
  return Boolean(
    probe?.markers?.qbotLocalUi
    && probe?.markers?.qbotBridgeReady
    && probe?.markers?.qbotWorkbench,
  );
}

async function runSmoke({ best, allowWrite, prompt, outputDir, timeoutMs }) {
  if (!best || best.score < 30 || !best.frameRef || !best.pageRef) {
    return { status: 'blocked', reason: 'No QBot target is available for smoke execution.' };
  }
  if (!allowWrite) {
    return { status: 'blocked', reason: 'Smoke sends a test message. Re-run with --allow-write to confirm this scoped mutation.' };
  }
  const root = best.frameRef;
  const bodyText = await root.locator('body').innerText().catch(() => '');
  if (await root.locator('[data-testid="auth-login"]').first().isVisible().catch(() => false)
    || /登录工作台|使用 Lingxi|OAuth2 登录/.test(bodyText)) {
    return { status: 'blocked', reason: 'The isolated QBot profile is not logged in.' };
  }

  const newTask = root.locator('[data-testid="nav-new-task"]').first();
  if (await newTask.isVisible().catch(() => false)) await newTask.click({ force: true });
  const composer = await firstVisible(root, [
    '[data-testid="composer-input"]',
    'textarea',
    '[contenteditable="true"]',
  ]);
  if (!composer) return { status: 'blocked', reason: 'QBot composer was not found in the Teams target.' };
  const send = await firstVisible(root, ['[data-testid="composer-send"]', 'button[type="submit"]']);
  const teamsSend = send || await firstVisible(root, ['button[type="button"]:has(.deepbank-icon.icon-send_new)']);
  if (!teamsSend) return { status: 'blocked', reason: 'QBot send button was not found in the Teams target.' };

  const assistantSelector = '[data-testid^="assistant-message"], [data-role="assistant"], .assistant-message';
  const beforeCount = await root.locator(assistantSelector).count().catch(() => 0);
  await composer.fill(prompt).catch(async () => {
    await composer.click();
    await composer.press(process.platform === 'darwin' ? 'Meta+A' : 'Control+A');
    await composer.pressSequentially(prompt);
  });
  const beforeFile = path.join(outputDir, 'screenshots', 'smoke-before-send.png');
  await best.pageRef.screenshot({ path: beforeFile, fullPage: false, timeout: 15_000 }).catch(() => {});
  await teamsSend.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
  await teamsSend.click({ timeout: 5000 });

  const deadline = Date.now() + timeoutMs;
  let reply = '';
  while (Date.now() < deadline) {
    const messages = root.locator(assistantSelector);
    const count = await messages.count().catch(() => 0);
    if (count > beforeCount) {
      reply = await messages.nth(count - 1).innerText().catch(() => '');
      const running = await root.locator('[data-testid="agent-status-running"]').first().isVisible().catch(() => false);
      if (reply.trim() && !running) break;
    }
    await delay(500);
  }
  const afterFile = path.join(outputDir, 'screenshots', 'smoke-after-reply.png');
  await best.pageRef.screenshot({ path: afterFile, fullPage: false, timeout: 15_000 }).catch(() => {});
  if (!reply.trim()) return { status: 'failed', reason: 'No completed assistant reply was observed before timeout.', screenshots: [beforeFile, afterFile] };
  return {
    status: 'passed',
    prompt: redactText(prompt),
    reply_excerpt: redactText(reply).slice(0, 500),
    screenshots: [beforeFile, afterFile].filter((file) => fs.existsSync(file)),
  };
}

async function firstVisible(root, selectors) {
  for (const selector of selectors) {
    const locator = root.locator(selector).first();
    if (await locator.isVisible().catch(() => false)) return locator;
  }
  return null;
}

function stripRuntimeRefs(probe) {
  const { pageRef, frameRef, targetRef, ...serializable } = probe;
  return serializable;
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
