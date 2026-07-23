import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { ensureDir, slugify, timestampForPath, writeJsonFile, writeTextFile } from './fs.mjs';
import { uploadAttachmentsInComposer } from './qbot-ui-attachments.mjs';

const DEFAULT_CDP_URL = 'http://127.0.0.1:9224';
const DEFAULT_TIMEOUT_MS = 120000;
const DEFAULT_ROLE_PROMPT = path.resolve('references/playwright-ui-agent-role-prompt.md');

const TECHNICAL_FAILURE_PATTERNS = [
  /模型未配置/,
  /cannot execute/i,
  /desktop-local/i,
  /remote control-plane/i,
  /SkillHub 地址未配置/,
  /技能[^。\n]{0,60}(暂时不可用|暂不可用|不可用|未就绪)/,
  /扩展技能[^。\n]{0,60}(暂时不可用|暂不可用|不可用|未就绪)/,
  /DEEPBANK_[A-Z0-9_]+/,
  /Bearer\s+[A-Za-z0-9._-]+/,
  /client_secret/i,
  /access_token/i,
  /refresh_token/i,
  /\btraceback\b/i,
  /\buncaught\b/i,
  /\bexception\b/i,
  /发生错误/,
  /发生内部错误/,
  /系统内部错误/,
  /系统错误/,
  /错误码/,
];

export async function runUiAgentCommand({ mode = 'doctor', options = {}, root = process.cwd() } = {}) {
  const outDir = path.resolve(options.out || path.join(root, 'outputs', `qbot-ui-agent-${mode}-${timestampForPath()}`));
  const fixturesDir = path.resolve(options.fixtures || path.join(root, 'testflies'));
  const rolePromptPath = path.resolve(options['role-prompt'] || path.join(root, 'references/playwright-ui-agent-role-prompt.md'));
  const rolePrompt = readRolePrompt(rolePromptPath);
  ensureDir(outDir);
  writeTextFile(path.join(outDir, 'ui-agent-role-prompt.md'), rolePrompt);

  if (mode === 'fixtures') {
    const fixtures = generateUiAgentFixtures({ fixturesDir });
    const report = {
      status: 'pass',
      command: 'ui-agent-fixtures',
      out_dir: outDir,
      fixtures_dir: fixturesDir,
      role_prompt_path: rolePromptPath,
      fixtures,
    };
    writeJsonFile(path.join(outDir, 'ui-agent-fixtures-report.json'), report);
    writeTextFile(path.join(outDir, 'ui-agent-fixtures-report.md'), renderFixturesReport(report));
    return report;
  }

  const fixtures = generateUiAgentFixtures({ fixturesDir });
  const scenarios = loadScenarios({ options, fixturesDir });
  writeJsonFile(path.join(outDir, 'ui-agent-scenarios.json'), scenarios);
  writeJsonFile(path.join(outDir, 'ui-agent-fixtures.json'), fixtures);

  const startedAt = new Date();
  const cdpUrl = String(options.cdp || process.env.QBOT_CDP_URL || DEFAULT_CDP_URL);
  const browserState = await connectQbotPage({ cdpUrl, outDir, mode });
  if (browserState.status !== 'pass') {
    const report = {
      status: 'blocked',
      command: `ui-agent-${mode}`,
      started_at: startedAt.toISOString(),
      ended_at: new Date().toISOString(),
      out_dir: outDir,
      cdp_url: cdpUrl,
      fixtures_dir: fixturesDir,
      role_prompt_path: rolePromptPath,
      fixtures,
      scenarios,
      doctor: browserState,
      results: [],
      summary: summarizeResults([]),
    };
    writeUiAgentReports(outDir, report);
    return report;
  }

  const { browser, page } = browserState;
  try {
    const doctor = await inspectQbotPage(page, outDir);
    if (mode === 'doctor') {
      const report = {
        status: doctor.status,
        command: 'ui-agent-doctor',
        started_at: startedAt.toISOString(),
        ended_at: new Date().toISOString(),
        out_dir: outDir,
        cdp_url: cdpUrl,
        fixtures_dir: fixturesDir,
        role_prompt_path: rolePromptPath,
        fixtures,
        scenarios,
        doctor,
        results: [],
        summary: summarizeResults([]),
      };
      writeUiAgentReports(outDir, report);
      return report;
    }

    if (doctor.login_required && options['allow-login-page'] !== true) {
      const report = {
        status: 'blocked',
        command: 'ui-agent-run',
        started_at: startedAt.toISOString(),
        ended_at: new Date().toISOString(),
        out_dir: outDir,
        cdp_url: cdpUrl,
        fixtures_dir: fixturesDir,
        role_prompt_path: rolePromptPath,
        fixtures,
        scenarios,
        doctor,
        results: [{
          id: 'PRECHECK-LOGIN',
          title: '登录态前置检查',
          status: 'blocked',
          reason: 'QBot 当前停在登录页。请先完成 Lingxi OAuth2 登录，再运行 ui-agent-run。',
          screenshots: doctor.screenshots,
        }],
        summary: summarizeResults([{ status: 'blocked' }]),
      };
      writeUiAgentReports(outDir, report);
      return report;
    }

    const selectedScenarios = selectScenarios(scenarios, options);
    const results = [];
    for (let index = 0; index < selectedScenarios.length; index += 1) {
      const scenario = selectedScenarios[index];
      const caseDir = path.join(outDir, 'cases', `${String(index + 1).padStart(2, '0')}-${scenario.id}-${slugify(scenario.title)}`);
      ensureDir(caseDir);
      const result = await runScenario({ page, scenario, caseDir, order: index + 1, options });
      results.push(result);
      writeJsonFile(path.join(outDir, 'ui-agent-progress.json'), {
        updated_at: new Date().toISOString(),
        completed: results.length,
        total: selectedScenarios.length,
        results,
      });
    }

    const summary = summarizeResults(results);
    const report = {
      status: summary.failed || summary.blocked ? 'failed' : 'pass',
      command: 'ui-agent-run',
      started_at: startedAt.toISOString(),
      ended_at: new Date().toISOString(),
      out_dir: outDir,
      cdp_url: cdpUrl,
      fixtures_dir: fixturesDir,
      role_prompt_path: rolePromptPath,
      doctor,
      scenarios: selectedScenarios,
      results,
      summary,
    };
    writeUiAgentReports(outDir, report);
    return report;
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
}

function readRolePrompt(file) {
  try {
    return fs.readFileSync(file, 'utf8');
  } catch {
    try {
      return fs.readFileSync(DEFAULT_ROLE_PROMPT, 'utf8');
    } catch {
      return [
        '# Playwright UI Agent 角色提示词',
        '',
        '你是 QBot 的资深 AI Agent 产品测试专家。只从真实用户视角操作 UI，保留截图、transcript、断言和中文报告；不要假装通过。',
        '',
      ].join('\n');
    }
  }
}

async function loadPlaywright() {
  try {
    return await import('playwright');
  } catch (error) {
    return { error };
  }
}

async function connectQbotPage({ cdpUrl, outDir }) {
  const loaded = await loadPlaywright();
  if (loaded.error) {
    return {
      status: 'blocked',
      reason: `Playwright 未安装或无法加载：${loaded.error.message}`,
      checks: { playwright: false },
    };
  }

  try {
    const browser = await loaded.chromium.connectOverCDP(cdpUrl);
    const page = await findQbotPage(browser);
    if (!page) {
      await browser.close().catch(() => {});
      return {
        status: 'blocked',
        reason: `已连接 CDP ${cdpUrl}，但没有找到 QBot 页面。`,
        checks: { playwright: true, cdp: true, qbotPage: false },
      };
    }
    page.setDefaultTimeout(12000);
    page.setDefaultNavigationTimeout(30000);
    return {
      status: 'pass',
      browser,
      page,
      checks: { playwright: true, cdp: true, qbotPage: true },
      screenshot: await safeScreenshot(page, path.join(outDir, 'doctor-connected-page.png')),
    };
  } catch (error) {
    return {
      status: 'blocked',
      reason: `无法连接 QBot CDP：${error.message}`,
      checks: { playwright: true, cdp: false, qbotPage: false },
    };
  }
}

async function findQbotPage(browser) {
  const deadline = Date.now() + 20000;
  while (Date.now() < deadline) {
    const pages = browser.contexts().flatMap((context) => context.pages());
    const candidates = pages.filter((page) => page.url() && page.url() !== 'about:blank');
    const ranked = await rankQbotPageCandidates(candidates);
    const qbot = ranked[0]?.score > 0 ? ranked[0].page : null;
    if (qbot) {
      await qbot.waitForLoadState('domcontentloaded').catch(() => {});
      return qbot;
    }
    await sleep(500);
  }
  return null;
}

async function rankQbotPageCandidates(candidates) {
  const ranked = [];
  for (const page of candidates) {
    const url = page.url();
    const title = await page.title().catch(() => '');
    let score = 0;
    if (/\bQWork\b/i.test(title)) score += 120;
    if (/QBot|deepbank/i.test(title)) score += 80;
    if (/\.deepbank(?:-dev)?\/ui\/|deepbank/i.test(url)) score += 100;
    if (/\/apps\/qbot\b|[/?#]qbot\b/i.test(url)) score += 30;
    if (/localhost|127\.0\.0\.1/i.test(url)) score += 5;
    ranked.push({ page, score, title, url });
  }
  return ranked.sort((left, right) => right.score - left.score);
}

async function inspectQbotPage(page, outDir) {
  await page.waitForTimeout(1000);
  const screenshot = await safeScreenshot(page, path.join(outDir, 'doctor-page-state.png'));
  const text = await bodyText(page);
  const loginRequired = await locatorVisible(page.locator('[data-testid="auth-login"]').first(), 800)
    || /登录工作台|OAuth2 登录|使用 Lingxi/.test(text);
  const composer = await findComposer(page).catch(() => null);
  const newTaskVisible = await locatorVisible(page.locator('[data-testid="nav-new-task"]').first(), 800);
  const upload = await inspectUploadCapability(page);
  const runtime = await page.evaluate(() => window.qbotRuntime || window.deepbankRuntime || null).catch(() => null);
  const controls = await collectVisibleControls(page);
  return {
    status: loginRequired ? 'blocked' : (composer || newTaskVisible) ? 'pass' : 'blocked',
    login_required: loginRequired,
    reason: loginRequired
      ? 'QBot 当前停在登录页，需要先完成 Lingxi OAuth2 登录。'
      : composer ? 'QBot 工作台已在会话页，可直接操作。'
        : newTaskVisible ? 'QBot 已登录但当前不在会话页，运行用例时会先点击【新建任务】进入会话。' : '未找到会话输入框或新建任务入口。',
    runtime,
    composer: composer ? { found: true, selector: composer.selector } : { found: false },
    upload,
    visible_controls: controls,
    screenshots: { page_state: screenshot },
    visible_text_excerpt: text.slice(0, 1200),
  };
}

async function runScenario({ page, scenario, caseDir, order, options }) {
  if (scenario.type === 'navigation') {
    return runNavigationScenario({ page, scenario, caseDir, order });
  }

  const startedAt = new Date();
  const screenshots = {};
  const steps = [];
  const attachments = resolveAttachments(scenario.attachments || []);
  const timeoutMs = Number(options['timeout-ms'] || scenario.timeout_ms || DEFAULT_TIMEOUT_MS);
  let uploadResult = null;
  let status = 'failed';
  let reason = '';
  let transcript = '';
  let replyText = '';
  let scores = {};

  try {
    await openNewTask(page, steps);
    screenshots.before = await safeScreenshot(page, path.join(caseDir, '01-before.png'));

    uploadResult = attachments.length
      ? await attachFiles(page, attachments, steps)
      : { status: 'skipped', attached: [], reason: '本场景无附件。' };
    screenshots.after_attachment = await safeScreenshot(page, path.join(caseDir, '02-after-attachment.png'));
    if (attachments.length && uploadResult.status !== 'passed') {
      const assertions = {
        passed: [],
        failed: [`附件上传状态不可确认：${uploadResult.reason || 'unknown'}`],
        warnings: [],
        forbidden_matches: [],
      };
      status = uploadResult.status === 'blocked' ? 'blocked' : 'failed';
      reason = assertions.failed.join('；');
      scores = scoreScenario({ status, assertions, uploadResult, replyText: '' });
      steps.push({ action: '自动断言与评分', status, text: reason });
      const result = {
        order,
        id: scenario.id,
        title: scenario.title,
        priority: scenario.priority || 'P1',
        status,
        reason,
        started_at: startedAt.toISOString(),
        ended_at: new Date().toISOString(),
        case_dir: caseDir,
        prompt: scenario.prompt,
        attachments,
        upload: uploadResult,
        assertions,
        scores,
        screenshots,
        transcript_file: null,
        reply_delta_file: null,
        steps,
      };
      writeJsonFile(path.join(caseDir, 'case-result.json'), result);
      writeTextFile(path.join(caseDir, 'case-report.md'), renderCaseReport(result));
      return result;
    }

    const prompt = buildScenarioPrompt(scenario, uploadResult);
    const beforeText = await bodyText(page);
    await fillComposer(page, prompt, steps);
    screenshots.after_fill = await safeScreenshot(page, path.join(caseDir, '03-after-fill.png'));
    await sendMessage(page, steps);
    screenshots.after_send = await safeScreenshot(page, path.join(caseDir, '04-after-send.png'));

    const reply = await waitForReply(page, beforeText, { timeoutMs });
    screenshots.after_reply = await safeScreenshot(page, path.join(caseDir, '05-after-reply.png'));
    transcript = reply.fullText;
    replyText = reply.deltaText;
    writeTextFile(path.join(caseDir, 'transcript.txt'), transcript);
    writeTextFile(path.join(caseDir, 'reply-delta.txt'), replyText);

    const assertions = evaluateScenario({ scenario, replyText, transcript, uploadResult });
    status = assertions.failed.length ? 'failed' : 'passed';
    reason = assertions.failed.join('；') || '场景通过。';
    scores = scoreScenario({ status, assertions, uploadResult, replyText });
    steps.push({
      action: '自动断言与评分',
      status,
      text: reason,
    });

    const result = {
      order,
      id: scenario.id,
      title: scenario.title,
      priority: scenario.priority || 'P1',
      status,
      reason,
      started_at: startedAt.toISOString(),
      ended_at: new Date().toISOString(),
      case_dir: caseDir,
      prompt,
      attachments,
      upload: uploadResult,
      assertions,
      scores,
      screenshots,
      transcript_file: path.join(caseDir, 'transcript.txt'),
      reply_delta_file: path.join(caseDir, 'reply-delta.txt'),
      steps,
    };
    writeJsonFile(path.join(caseDir, 'case-result.json'), result);
    writeTextFile(path.join(caseDir, 'case-report.md'), renderCaseReport(result));
    return result;
  } catch (error) {
    screenshots.error = await safeScreenshot(page, path.join(caseDir, '99-error.png'));
    transcript = await bodyText(page).catch(() => '');
    writeTextFile(path.join(caseDir, 'transcript.txt'), transcript);
    reason = error.message;
    const assertions = {
      passed: [],
      failed: [error.message],
      warnings: [],
      forbidden_matches: forbiddenMatches(transcript),
    };
    scores = scoreScenario({ status: 'failed', assertions, uploadResult: null, replyText: transcript });
    const result = {
      order,
      id: scenario.id,
      title: scenario.title,
      priority: scenario.priority || 'P1',
      status: 'failed',
      reason,
      started_at: startedAt.toISOString(),
      ended_at: new Date().toISOString(),
      case_dir: caseDir,
      prompt: scenario.prompt,
      attachments,
      upload: uploadResult,
      assertions,
      scores,
      screenshots,
      transcript_file: path.join(caseDir, 'transcript.txt'),
      steps,
    };
    writeJsonFile(path.join(caseDir, 'case-result.json'), result);
    writeTextFile(path.join(caseDir, 'case-report.md'), renderCaseReport(result));
    return result;
  }
}

async function runNavigationScenario({ page, scenario, caseDir, order }) {
  const startedAt = new Date();
  const screenshots = {};
  const steps = [];
  let status = 'failed';
  let reason = '';

  try {
    screenshots.before = await safeScreenshot(page, path.join(caseDir, '01-before.png'));
    await clickScenarioTarget(page, scenario, steps);
    await page.waitForTimeout(Number(scenario.wait_ms || 1200));
    screenshots.after_click = await safeScreenshot(page, path.join(caseDir, '02-after-click.png'));

    const pageText = await bodyText(page);
    const controls = await collectVisibleControls(page);
    writeTextFile(path.join(caseDir, 'page-text-after-click.txt'), pageText);
    writeJsonFile(path.join(caseDir, 'visible-controls-after-click.json'), controls);

    const assertions = evaluateNavigationScenario({ scenario, pageText, controls });
    status = assertions.failed.length ? 'failed' : 'passed';
    reason = assertions.failed.join('；') || '入口可点击且页面有可观察反馈。';
    const scores = scoreScenario({
      status,
      assertions,
      uploadResult: null,
      replyText: pageText,
    });
    steps.push({
      action: '自动断言与评分',
      status,
      text: reason,
    });

    const result = {
      order,
      id: scenario.id,
      title: scenario.title,
      priority: scenario.priority || 'P1',
      status,
      reason,
      started_at: startedAt.toISOString(),
      ended_at: new Date().toISOString(),
      case_dir: caseDir,
      prompt: scenario.user_goal || '',
      attachments: [],
      upload: null,
      assertions,
      scores,
      screenshots,
      transcript_file: path.join(caseDir, 'page-text-after-click.txt'),
      reply_delta_file: null,
      steps,
    };
    writeJsonFile(path.join(caseDir, 'case-result.json'), result);
    writeTextFile(path.join(caseDir, 'case-report.md'), renderCaseReport(result));
    return result;
  } catch (error) {
    screenshots.error = await safeScreenshot(page, path.join(caseDir, '99-error.png'));
    const pageText = await bodyText(page).catch(() => '');
    writeTextFile(path.join(caseDir, 'page-text-after-click.txt'), pageText);
    const assertions = {
      passed: [],
      failed: [error.message],
      warnings: [],
      forbidden_matches: forbiddenMatches(pageText),
    };
    const scores = scoreScenario({ status: 'failed', assertions, uploadResult: null, replyText: pageText });
    const result = {
      order,
      id: scenario.id,
      title: scenario.title,
      priority: scenario.priority || 'P1',
      status: 'failed',
      reason: error.message,
      started_at: startedAt.toISOString(),
      ended_at: new Date().toISOString(),
      case_dir: caseDir,
      prompt: scenario.user_goal || '',
      attachments: [],
      upload: null,
      assertions,
      scores,
      screenshots,
      transcript_file: path.join(caseDir, 'page-text-after-click.txt'),
      steps,
    };
    writeJsonFile(path.join(caseDir, 'case-result.json'), result);
    writeTextFile(path.join(caseDir, 'case-report.md'), renderCaseReport(result));
    return result;
  }
}

async function clickScenarioTarget(page, scenario, steps) {
  if (scenario.target_selector) {
    const locator = page.locator(scenario.target_selector).first();
    if (await locatorVisible(locator, 3000)) {
      await locator.click({ force: true });
      steps.push({
        action: `点击入口：${scenario.entry_name || scenario.target_selector}`,
        selector: scenario.target_selector,
        status: 'passed',
        text: scenario.user_goal,
      });
      return;
    }
  }

  if (scenario.target_text) {
    const locator = page.getByText(scenario.target_text, { exact: true }).first();
    if (await locatorVisible(locator, 3000)) {
      await locator.click({ force: true });
      steps.push({
        action: `点击入口：${scenario.entry_name || scenario.target_text}`,
        selector: `text=${scenario.target_text}`,
        status: 'passed',
        text: scenario.user_goal,
      });
      return;
    }
  }

  throw new Error(`未找到入口：${scenario.entry_name || scenario.target_selector || scenario.target_text || scenario.id}`);
}

function evaluateNavigationScenario({ scenario, pageText, controls }) {
  const failed = [];
  const passed = [];
  const warnings = [];
  const text = String(pageText || '');
  const forbidden = forbiddenMatches(text);
  if (forbidden.length) failed.push(`页面出现技术错误或内部配置暴露：${forbidden.join(', ')}`);
  else passed.push('页面未暴露常见技术错误/内部配置。');
  if (text.trim().length > 20 || controls.length) passed.push('点击后页面有可观察内容或控件。');
  else failed.push('点击后未检测到有效页面内容或控件。');
  for (const keyword of scenario.expected_keywords || []) {
    if (text.includes(keyword)) passed.push(`页面包含预期文案：${keyword}`);
    else warnings.push(`未检测到预期文案：${keyword}`);
  }
  return {
    passed,
    failed,
    warnings,
    forbidden_matches: forbidden,
  };
}

async function openNewTask(page, steps) {
  await page.keyboard.press('Escape').catch(() => {});
  const locator = page.locator('[data-testid="nav-new-task"]').first();
  if (await locatorVisible(locator, 2500)) {
    await locator.click({ force: true });
    await page.waitForTimeout(1000);
    if (!(await ensureChatComposer(page))) {
      await page.keyboard.press('Escape').catch(() => {});
      await locator.click({ force: true });
      await page.waitForTimeout(1200);
    }
    if (!(await ensureChatComposer(page))) {
      const text = await bodyText(page).catch(() => '');
      throw new Error(`点击【新建任务】后未进入会话输入区，未检测到 composer-input/composer-send。当前页面片段：${text.slice(0, 180)}`);
    }
    steps.push({ action: '点击【新建任务】', selector: '[data-testid="nav-new-task"]', status: 'passed' });
    return;
  }
  const byText = page.getByText('新建任务', { exact: true }).first();
  await byText.click({ force: true, timeout: 8000 });
  await page.waitForTimeout(1000);
  if (!(await ensureChatComposer(page))) {
    const text = await bodyText(page).catch(() => '');
    throw new Error(`点击【新建任务】后未进入会话输入区，未检测到 composer-input/composer-send。当前页面片段：${text.slice(0, 180)}`);
  }
  steps.push({ action: '点击【新建任务】', selector: 'text=新建任务', status: 'passed' });
}

async function ensureChatComposer(page) {
  const input = page.locator('[data-testid="composer-input"], .aui-composer-input').first();
  const send = page.locator('[data-testid="composer-send"], .aui-composer-send').first();
  return (await locatorVisible(input, 1500)) && (await locatorVisible(send, 1500));
}

async function findComposer(page) {
  const selectors = [
    '[data-testid="composer-input"]',
    '.aui-composer-input',
    '[aria-label*="Message"]',
  ];
  for (const selector of selectors) {
    const locator = page.locator(selector).first();
    if (await locatorVisible(locator, 1000)) return { selector, locator };
  }
  throw new Error('未找到 QBot 会话输入框。');
}

async function fillComposer(page, prompt, steps) {
  const { selector, locator } = await findComposer(page);
  await locator.click({ force: true });
  const tag = await locator.evaluate((el) => el.tagName.toLowerCase()).catch(() => '');
  const editable = await locator.evaluate((el) => el.getAttribute('contenteditable') === 'true').catch(() => false);
  if (tag === 'textarea' || tag === 'input') {
    await locator.fill(prompt);
  } else if (editable) {
    await page.keyboard.press(process.platform === 'darwin' ? 'Meta+A' : 'Control+A');
    await page.keyboard.insertText(prompt);
  } else {
    await locator.fill(prompt);
  }
  steps.push({ action: '输入测试问题', selector, status: 'passed', text: prompt.slice(0, 180) });
}

async function sendMessage(page, steps) {
  const candidates = [
    '[data-testid="composer-send"]',
    'button[aria-label*="Send"]',
    'button[aria-label*="发送"]',
    'button:has-text("Send message")',
    'button:has-text("发送")',
    '[data-testid*="send"]',
  ];
  for (const selector of candidates) {
    const locator = page.locator(selector).first();
    if (await locatorVisible(locator, 1200)) {
      await locator.click({ force: true });
      steps.push({ action: '点击发送', selector, status: 'passed' });
      return;
    }
  }
  const roleButton = page.getByRole('button', { name: /send message|发送|提交/i }).first();
  if (await locatorVisible(roleButton, 1200)) {
    await roleButton.click({ force: true });
    steps.push({ action: '点击发送', selector: 'role=button[name~=send]', status: 'passed' });
    return;
  }
  throw new Error('未找到发送按钮。');
}

async function attachFiles(page, filePaths, steps) {
  const result = await uploadAttachmentsInComposer(page, filePaths);
  steps.push({
    action: '上传附件',
    selector: result.method || '[data-testid="composer-add-attachment"]',
    status: result.status,
    text: [
      result.reason,
      result.expected_names?.length ? `期望文件：${result.expected_names.join(', ')}` : '',
      result.visible_names?.length ? `页面可见文件：${result.visible_names.join(', ')}` : '',
    ].filter(Boolean).join('；'),
  });
  return result;
}

async function waitForReply(page, beforeText, { timeoutMs }) {
  const deadline = Date.now() + timeoutMs;
  let lastText = '';
  let stableSince = 0;
  while (Date.now() < deadline) {
    const text = await bodyText(page);
    const deltaText = diffText(beforeText, text);
    const hasNewText = deltaText.trim().length > 20 || text.length > beforeText.length + 20;
    const generating = await isGenerating(page, text);
    const forbidden = forbiddenMatches(deltaText || text);
    if (hasNewText && forbidden.length) {
      return { fullText: text, deltaText, forbidden, terminal: 'technical_failure' };
    }
    if (hasNewText && !generating) {
      if (text === lastText) {
        stableSince += 1;
      } else {
        lastText = text;
        stableSince = 0;
      }
      if (stableSince >= 3) return { fullText: text, deltaText, forbidden, terminal: 'stable' };
    }
    await sleep(1000);
  }
  throw new Error(`等待 Agent 回复超时（${timeoutMs}ms）。`);
}

async function isGenerating(page, text) {
  const stopSelectors = [
    'button[aria-label*="Stop"]',
    'button[aria-label*="停止"]',
    'button:has-text("停止")',
    'button:has-text("Stop generating")',
  ];
  for (const selector of stopSelectors) {
    const locator = page.locator(selector).first();
    if (await locatorVisible(locator, 300)) return true;
  }
  return /思考中|生成中|正在|Stop generating/i.test(text || '');
}

function buildScenarioPrompt(scenario, uploadResult) {
  const lines = [
    scenario.prompt,
  ];
  if (scenario.attachments?.length) {
    lines.push('');
    lines.push('附件处理要求：请优先读取我刚刚上传的附件内容；如果你无法读取附件，请明确说明无法读取哪个文件，不要假装已经读取。');
    if (uploadResult?.status !== 'passed') {
      lines.push(`自动化提示：本轮附件上传状态为 ${uploadResult?.status || 'unknown'}，本地文件路径如下：`);
      for (const file of scenario.attachments) lines.push(`- ${file}`);
    }
  }
  return lines.join('\n');
}

function evaluateScenario({ scenario, replyText, transcript, uploadResult }) {
  const failed = [];
  const passed = [];
  const warnings = [];
  const text = `${replyText}\n${transcript}`;
  const forbidden = forbiddenMatches(replyText || transcript);
  if (forbidden.length) failed.push(`回复中出现技术错误或内部配置暴露：${forbidden.join(', ')}`);
  else passed.push('回复未暴露常见技术错误/内部配置。');
  if (!replyText || replyText.trim().length < 20) failed.push('回复内容过短或没有检测到有效增量。');
  else passed.push('检测到有效 Agent 回复。');
  if (scenario.attachments?.length) {
    if (uploadResult?.status === 'passed') passed.push('附件已通过 UI 上传入口提交。');
    else failed.push(`附件上传状态不可确认：${uploadResult?.reason || 'unknown'}`);
  }
  for (const keyword of scenario.expected_keywords || []) {
    if (text.includes(keyword)) passed.push(`包含预期关键词：${keyword}`);
    else warnings.push(`未检测到预期关键词：${keyword}`);
  }
  for (const keyword of scenario.required_keywords || []) {
    if (text.includes(keyword)) passed.push(`包含必需关键词：${keyword}`);
    else failed.push(`缺少必需关键词：${keyword}`);
  }
  return {
    passed,
    failed,
    warnings,
    forbidden_matches: forbidden,
  };
}

function scoreScenario({ status, assertions, uploadResult, replyText }) {
  const base = status === 'passed' ? 8 : 4;
  const penalty = (assertions?.warnings?.length || 0) + (assertions?.failed?.length || 0) * 2;
  const attachmentPenalty = uploadResult?.status === 'blocked' ? 1 : 0;
  const replyBonus = String(replyText || '').length > 200 ? 1 : 0;
  const productEase = clamp(base - penalty - attachmentPenalty, 1, 10);
  const practicality = clamp(base - (assertions?.failed?.length || 0) * 2 + replyBonus, 1, 10);
  const evidenceQuality = clamp(9 - (assertions?.failed?.length || 0), 1, 10);
  return {
    product_ease_of_use: productEase,
    practical_value: practicality,
    reply_relevance: practicality,
    evidence_quality: evidenceQuality,
    scoring_note: '启发式评分：基于是否完成 UI 操作、回复是否有效、是否出现技术错误、附件是否上传、证据是否完整。',
  };
}

function selectScenarios(scenarios, options) {
  let selected = [...scenarios];
  if (options.case) {
    const wanted = new Set(String(options.case).split(',').map((item) => item.trim()).filter(Boolean));
    selected = selected.filter((scenario) => wanted.has(scenario.id));
  }
  if (options.limit) selected = selected.slice(0, Number(options.limit));
  return selected;
}

function loadScenarios({ options, fixturesDir }) {
  if (options.scenarios) {
    const file = path.resolve(String(options.scenarios));
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    return Array.isArray(data) ? data : data.scenarios || [];
  }
  return defaultScenarios(fixturesDir);
}

function defaultScenarios(fixturesDir) {
  const f = (name) => path.join(fixturesDir, name);
  return [
    {
      id: 'CORE-TEXT-001',
      title: '普通多轮对话第一轮：基础问答应自然回复',
      priority: 'P0',
      prompt: '你好，请用一句话说明你是谁，并告诉我今天是星期几。回答面向普通办公用户，不要出现内部技术配置名。',
      expected_keywords: ['QBot'],
    },
    {
      id: 'CORE-CONTEXT-002',
      title: '多轮上下文：记住业务数字并计算转化率',
      priority: 'P0',
      prompt: '请记住这个业务场景：活动报名100人，到场70人，成交12单。请先复述这三个数字，再计算到场率和到场到成交转化率。',
      expected_keywords: ['100', '70', '12'],
    },
    {
      id: 'CORE-LONGTEXT-003',
      title: '长文本处理：摘要与行动项',
      priority: 'P0',
      prompt: `请阅读下面长文本，输出：1. 三句话摘要；2. 三条行动项；3. 一个风险提醒。\n\n${longChineseText()}`,
      expected_keywords: ['行动'],
    },
    {
      id: 'CORE-TXT-004',
      title: '附件处理：TXT 文件摘要',
      priority: 'P0',
      prompt: '请读取我上传的 TXT 文件，提取项目名称、优先级和三个验收点。',
      attachments: [f('qbot-text-brief.txt')],
      expected_keywords: ['QBot'],
    },
    {
      id: 'CORE-MD-005',
      title: '附件处理：Markdown 需求文档理解',
      priority: 'P0',
      prompt: '请读取我上传的 Markdown 文件，按“背景/用户故事/验收标准/风险”整理成测试人员能看懂的摘要。',
      attachments: [f('qbot-requirement.md')],
      expected_keywords: ['验收'],
    },
    {
      id: 'CORE-OFFICE-006',
      title: '附件处理：Word Excel PDF PPT 多文件混合',
      priority: 'P0',
      prompt: '请读取我上传的 Word、Excel、PDF、PPT 文件，汇总这些材料共同表达的主题，并指出每类文件提供了什么信息。',
      attachments: [
        f('qbot-word-report.docx'),
        f('qbot-data-table.xlsx'),
        f('qbot-pdf-summary.pdf'),
        f('qbot-slide-deck.pptx'),
      ],
      expected_keywords: ['Word', 'Excel', 'PDF', 'PPT'],
    },
    {
      id: 'CORE-IMAGE-007',
      title: '多模态：图片或视觉附件理解',
      priority: 'P1',
      prompt: '请读取我上传的图片/视觉文件，说明图中主要表达了什么。如果无法识别图片，请明确说明不支持图片理解。',
      attachments: [f('qbot-visual-test.svg'), f('qbot-image-test.png')],
      expected_keywords: ['图片'],
    },
    {
      id: 'CORE-STRUCTURED-008',
      title: '结构化数据处理：JSON CSV HTML 代码',
      priority: 'P1',
      prompt: '请读取我上传的 JSON、CSV、HTML 和 JS 文件，分别说明它们是什么类型的信息，并指出其中最值得测试关注的字段或逻辑。',
      attachments: [
        f('qbot-data.json'),
        f('qbot-table.csv'),
        f('qbot-page.html'),
        f('qbot-script.js'),
      ],
      expected_keywords: ['JSON', 'CSV'],
    },
    {
      id: 'NAV-EXPERTS-009',
      type: 'navigation',
      title: '入口探索：专家入口可进入并提供清晰反馈',
      priority: 'P0',
      entry_name: '专家',
      target_selector: '[data-testid="nav-experts"]',
      user_goal: '普通用户希望进入专家入口，确认是否能选择或理解专家角色。',
      expected_keywords: ['专家'],
    },
    {
      id: 'NAV-CONNECTORS-010',
      type: 'navigation',
      title: '入口探索：连接器入口可进入并提供清晰反馈',
      priority: 'P1',
      entry_name: '连接器',
      target_selector: '[data-testid="nav-connectors"]',
      user_goal: '普通用户希望查看可连接的外部应用或工具，确认入口是否可用、状态是否易懂。',
      expected_keywords: ['连接器'],
    },
    {
      id: 'NAV-KNOWLEDGE-011',
      type: 'navigation',
      title: '入口探索：知识入口可进入并说明知识来源状态',
      priority: 'P1',
      entry_name: '知识',
      target_selector: '[data-testid="nav-more"]',
      user_goal: '普通用户希望查看知识来源配置，确认入口状态、开关和不可用说明是否能理解。',
      expected_keywords: ['知识'],
    },
    {
      id: 'NAV-SETTINGS-012',
      type: 'navigation',
      title: '入口探索：个人设置入口可进入并展示个人默认项',
      priority: 'P1',
      entry_name: '个人设置',
      target_selector: '[data-testid="nav-settings-menu"]',
      user_goal: '普通用户希望进入个人设置，查看主题、角色人设、用户画像等默认项。',
      expected_keywords: ['个人设置', '界面主题'],
    },
  ];
}

function generateUiAgentFixtures({ fixturesDir }) {
  ensureDir(fixturesDir);
  const files = [];
  const write = (name, content, encoding = 'utf8') => {
    const file = path.join(fixturesDir, name);
    fs.writeFileSync(file, content, encoding);
    files.push(file);
    return file;
  };

  write('qbot-text-brief.txt', [
    '项目名称：QBot 核心对话能力测试',
    '优先级：P0',
    '验收点：',
    '1. Agent 能理解普通文本问题。',
    '2. Agent 能识别附件中的关键字段。',
    '3. Agent 回复不暴露内部环境变量或底层运行时错误。',
  ].join('\n'));
  write('qbot-requirement.md', [
    '# QBot 需求样例',
    '',
    '## 背景',
    '非技术用户希望通过自然语言完成办公任务。',
    '',
    '## 用户故事',
    '作为产品运营，我希望把活动数据交给 QBot，让它帮我总结问题和行动项。',
    '',
    '## 验收标准',
    '- 能理解附件内容。',
    '- 能输出结构化结论。',
    '- 不要求用户选择模型或 Agent。',
    '',
    '## 风险',
    '如果回复出现内部配置项，会降低用户信任。',
  ].join('\n'));
  write('qbot-table.csv', 'name,type,value\n报名人数,metric,100\n到场人数,metric,70\n成交单数,metric,12\n');
  write('qbot-data.json', JSON.stringify({
    project: 'QBot UI Agent 自动化',
    owner: 'QA',
    acceptance: ['多轮对话', '附件理解', '截图留证', '中文报告'],
    risk: '回复混入内部技术错误',
  }, null, 2));
  write('qbot-page.html', '<!doctype html><html><head><title>QBot Fixture</title></head><body><h1>QBot 测试页面</h1><p data-risk="internal-error">重点检查用户是否能理解回复。</p></body></html>\n');
  write('qbot-script.js', 'export function conversionRate(arrived, sold) { return sold / arrived; }\nconsole.log(conversionRate(70, 12));\n');
  write('qbot-visual-test.svg', '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360"><rect width="640" height="360" fill="#f7faf8"/><rect x="60" y="70" width="160" height="80" fill="#dcefe4" stroke="#15803d"/><text x="84" y="118" font-size="24" fill="#0f172a">输入资料</text><path d="M230 110 H395" stroke="#2563eb" stroke-width="8" marker-end="url(#a)"/><rect x="410" y="70" width="170" height="80" fill="#e0ecff" stroke="#2563eb"/><text x="440" y="118" font-size="24" fill="#0f172a">结构化回复</text><defs><marker id="a" markerWidth="10" markerHeight="10" refX="10" refY="5" orient="auto"><path d="M0 0 L10 5 L0 10z" fill="#2563eb"/></marker></defs><text x="70" y="245" font-size="22" fill="#475569">目标：验证 QBot 能理解视觉流程图</text></svg>\n');
  const imageGenerator = path.resolve(process.cwd(), 'scripts', 'generate-qa-image-fixtures.py');
  const generatedImages = spawnSync(String(process.env.PYTHON || 'python3'), [imageGenerator, fixturesDir], { encoding: 'utf8' });
  if (generatedImages.error || generatedImages.status !== 0) {
    throw new Error(`生成图片 fixture 失败：${generatedImages.error?.message || generatedImages.stderr || generatedImages.stdout || generatedImages.status}`);
  }
  for (const name of ['qbot-image-test.png', 'qbot-image-flow.png', 'qbot-image-risk.png']) files.push(path.join(fixturesDir, name));
  writeDocx(path.join(fixturesDir, 'qbot-word-report.docx'));
  files.push(path.join(fixturesDir, 'qbot-word-report.docx'));
  writeXlsx(path.join(fixturesDir, 'qbot-data-table.xlsx'));
  files.push(path.join(fixturesDir, 'qbot-data-table.xlsx'));
  writeSimplePdf(path.join(fixturesDir, 'qbot-pdf-summary.pdf'));
  files.push(path.join(fixturesDir, 'qbot-pdf-summary.pdf'));
  writePptx(path.join(fixturesDir, 'qbot-slide-deck.pptx'));
  files.push(path.join(fixturesDir, 'qbot-slide-deck.pptx'));

  return files.map((file) => ({
    path: file,
    name: path.basename(file),
    bytes: fs.statSync(file).size,
  }));
}

function writeDocx(file) {
  writeStoredZip(file, {
    '[Content_Types].xml': '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>',
    '_rels/.rels': '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
    'word/document.xml': '<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>QBot Word 测试报告：核心要求是让 Agent 读取文档、总结主题、输出验收点。</w:t></w:r></w:p><w:p><w:r><w:t>验收点包括多轮对话、附件理解、截图留证、中文报告。</w:t></w:r></w:p></w:body></w:document>',
  });
}

function writeXlsx(file) {
  writeStoredZip(file, {
    '[Content_Types].xml': '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>',
    '_rels/.rels': '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
    'xl/workbook.xml': '<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="QBot数据" sheetId="1" r:id="rId1"/></sheets></workbook>',
    'xl/_rels/workbook.xml.rels': '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>',
    'xl/worksheets/sheet1.xml': '<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>指标</t></is></c><c r="B1" t="inlineStr"><is><t>数值</t></is></c></row><row r="2"><c r="A2" t="inlineStr"><is><t>报名人数</t></is></c><c r="B2"><v>100</v></c></row><row r="3"><c r="A3" t="inlineStr"><is><t>到场人数</t></is></c><c r="B3"><v>70</v></c></row><row r="4"><c r="A4" t="inlineStr"><is><t>成交单数</t></is></c><c r="B4"><v>12</v></c></row></sheetData></worksheet>',
  });
}

function writePptx(file) {
  writeStoredZip(file, {
    '[Content_Types].xml': '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/><Override PartName="/ppt/slides/slide1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/></Types>',
    '_rels/.rels': '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/></Relationships>',
    'ppt/presentation.xml': '<?xml version="1.0" encoding="UTF-8"?><p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><p:sldIdLst><p:sldId id="256" r:id="rId1"/></p:sldIdLst><p:sldSz cx="9144000" cy="5143500"/></p:presentation>',
    'ppt/_rels/presentation.xml.rels': '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide1.xml"/></Relationships>',
    'ppt/slides/slide1.xml': '<?xml version="1.0" encoding="UTF-8"?><p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/><p:sp><p:nvSpPr><p:cNvPr id="2" name="Title"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:t>QBot PPT 测试：多模态与附件理解</a:t></a:r></a:p><a:p><a:r><a:t>重点：上传、摘要、结构化输出、截图留证。</a:t></a:r></a:p></p:txBody></p:sp></p:spTree></p:cSld></p:sld>',
  });
}

function writeStoredZip(file, entries) {
  const chunks = [];
  const central = [];
  let offset = 0;
  for (const [name, content] of Object.entries(entries)) {
    const nameBuffer = Buffer.from(name);
    const data = Buffer.isBuffer(content) ? content : Buffer.from(content);
    const crc = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 6);
    local.writeUInt16LE(0, 8);
    local.writeUInt16LE(0, 10);
    local.writeUInt16LE(0, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBuffer.length, 26);
    local.writeUInt16LE(0, 28);
    chunks.push(local, nameBuffer, data);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0, 8);
    centralHeader.writeUInt16LE(0, 10);
    centralHeader.writeUInt16LE(0, 12);
    centralHeader.writeUInt16LE(0, 14);
    centralHeader.writeUInt32LE(crc, 16);
    centralHeader.writeUInt32LE(data.length, 20);
    centralHeader.writeUInt32LE(data.length, 24);
    centralHeader.writeUInt16LE(nameBuffer.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE(0, 38);
    centralHeader.writeUInt32LE(offset, 42);
    central.push(centralHeader, nameBuffer);
    offset += local.length + nameBuffer.length + data.length;
  }
  const centralSize = central.reduce((sum, chunk) => sum + chunk.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(Object.keys(entries).length, 8);
  end.writeUInt16LE(Object.keys(entries).length, 10);
  end.writeUInt32LE(centralSize, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);
  fs.writeFileSync(file, Buffer.concat([...chunks, ...central, end]));
}

function crc32(buffer) {
  let crc = ~0;
  for (const byte of buffer) {
    crc ^= byte;
    for (let i = 0; i < 8; i += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (~crc) >>> 0;
}

function writeSimplePdf(file) {
  const textLines = [
    'QBot PDF Summary',
    'Core goal: verify Agent can read PDF fixture.',
    'Acceptance: summarize, find risks, keep product-friendly wording.',
  ];
  const stream = `BT /F1 16 Tf 72 720 Td (${escapePdf(textLines[0])}) Tj 0 -32 Td (${escapePdf(textLines[1])}) Tj 0 -32 Td (${escapePdf(textLines[2])}) Tj ET`;
  const objects = [
    '1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n',
    '2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj\n',
    '3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >> endobj\n',
    `4 0 obj << /Length ${Buffer.byteLength(stream)} >> stream\n${stream}\nendstream endobj\n`,
    '5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj\n',
  ];
  let body = '%PDF-1.4\n';
  const offsets = [0];
  for (const obj of objects) {
    offsets.push(Buffer.byteLength(body));
    body += obj;
  }
  const xrefOffset = Buffer.byteLength(body);
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i < offsets.length; i += 1) {
    body += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  body += `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  fs.writeFileSync(file, body, 'binary');
}

function escapePdf(text) {
  return String(text).replace(/[()\\]/g, '\\$&');
}

function resolveAttachments(items) {
  return items.map((item) => path.resolve(String(item)));
}

async function safeScreenshot(page, file) {
  try {
    ensureDir(path.dirname(file));
    await page.screenshot({ path: file, fullPage: true });
    return file;
  } catch (error) {
    return { error: error.message };
  }
}

async function bodyText(page) {
  return redact(await page.locator('body').innerText({ timeout: 8000 }).catch(() => ''));
}

function redact(text) {
  return String(text || '')
    .replace(/(Bearer\s+)[A-Za-z0-9._-]+/gi, '$1[REDACTED]')
    .replace(/([?&](?:token|access_token|refresh_token|client_secret|password)=)[^&#\s]+/gi, '$1[REDACTED]');
}

async function locatorVisible(locator, timeout = 1000) {
  return locator.waitFor({ state: 'visible', timeout }).then(() => true).catch(() => false);
}

async function inspectUploadCapability(page) {
  const fileInputCount = await page.locator('input[type="file"]').count().catch(() => 0);
  const attachmentButton = await Promise.any([
    locatorVisible(page.locator('[data-testid*="attachment"]').first(), 500),
    locatorVisible(page.locator('button:has-text("Add Attachment")').first(), 500),
    locatorVisible(page.locator('button:has-text("添加文档")').first(), 500),
  ].map((promise) => promise.catch(() => false))).catch(() => false);
  return {
    file_input_count: fileInputCount,
    attachment_button_visible: Boolean(attachmentButton),
    likely_supported: fileInputCount > 0 || Boolean(attachmentButton),
  };
}

async function collectVisibleControls(page) {
  return page.evaluate(() => [...document.querySelectorAll('button,[role="button"],textarea,input,[contenteditable="true"],a')]
    .slice(0, 80)
    .map((el) => {
      const r = el.getBoundingClientRect();
      return {
        tag: el.tagName,
        testid: el.getAttribute('data-testid'),
        text: (el.innerText || el.value || el.getAttribute('aria-label') || el.title || el.placeholder || '').trim().slice(0, 120),
        visible: r.width > 0 && r.height > 0,
        x: Math.round(r.x),
        y: Math.round(r.y),
        w: Math.round(r.width),
        h: Math.round(r.height),
      };
    })
    .filter((item) => item.visible)
    .slice(0, 30)).catch(() => []);
}

function forbiddenMatches(text) {
  return TECHNICAL_FAILURE_PATTERNS
    .map((pattern) => String(text || '').match(pattern)?.[0] || '')
    .filter(Boolean);
}

function diffText(before, after) {
  const a = String(before || '');
  const b = String(after || '');
  let index = 0;
  while (index < a.length && index < b.length && a[index] === b[index]) index += 1;
  return b.slice(index).trim();
}

function summarizeResults(results) {
  return {
    total: results.length,
    passed: results.filter((item) => item.status === 'passed').length,
    failed: results.filter((item) => item.status === 'failed').length,
    blocked: results.filter((item) => item.status === 'blocked').length,
  };
}

function writeUiAgentReports(outDir, report) {
  writeJsonFile(path.join(outDir, 'ui-agent-report.json'), report);
  writeTextFile(path.join(outDir, 'ui-agent-report.md'), renderUiAgentReport(report));
}

function renderUiAgentReport(report) {
  const lines = [
    '# QBot Playwright UI Agent 测试报告',
    '',
    `- 状态：${report.status}`,
    `- 命令：${report.command}`,
    `- 输出目录：${report.out_dir}`,
    `- CDP：${report.cdp_url || 'n/a'}`,
    `- 测试文件目录：${report.fixtures_dir || 'n/a'}`,
    `- 角色提示词：${report.role_prompt_path || 'n/a'}`,
    `- 开始时间：${report.started_at || 'n/a'}`,
    `- 结束时间：${report.ended_at || 'n/a'}`,
    '',
    '## 前置检查',
    '',
    `- 登录态：${report.doctor?.login_required ? '需要登录' : '已进入工作台或无需登录'}`,
    `- 输入框：${report.doctor?.composer?.found ? `已找到（${report.doctor.composer.selector}）` : '未找到'}`,
    `- 附件能力：${report.doctor?.upload?.likely_supported ? '页面存在上传入口迹象' : '未检测到明确上传入口'}`,
    `- 截图：${report.doctor?.screenshots?.page_state || report.doctor?.screenshot || '无'}`,
    '',
    '## 观察到的功能入口',
    '',
    ...((report.doctor?.visible_controls || []).length
      ? report.doctor.visible_controls.map((item) => `- ${item.testid || item.tag}：${item.text || '(无文案)'} @ ${item.x},${item.y} ${item.w}x${item.h}`)
      : ['- 未采集到可见控件']),
    '',
    '## 汇总',
    '',
    `- 总数：${report.summary?.total || 0}`,
    `- 通过：${report.summary?.passed || 0}`,
    `- 失败：${report.summary?.failed || 0}`,
    `- 阻塞：${report.summary?.blocked || 0}`,
    '',
  ];

  if (report.results?.length) {
    lines.push('| 序号 | 用例 | 优先级 | 状态 | 易用性 | 实用性 | 证据 | 原因 |');
    lines.push('| --- | --- | --- | --- | --- | --- | --- | --- |');
    for (const result of report.results) {
      lines.push(`| ${result.order || ''} | ${escapeMd(result.title || result.id)} | ${result.priority || ''} | ${result.status} | ${result.scores?.product_ease_of_use ?? ''} | ${result.scores?.practical_value ?? ''} | ${result.scores?.evidence_quality ?? ''} | ${escapeMd(result.reason || '')} |`);
    }
    lines.push('');
    lines.push('## 单用例报告');
    lines.push('');
    for (const result of report.results) {
      lines.push(`- ${result.id}：${result.case_dir ? path.join(result.case_dir, 'case-report.md') : result.reason || ''}`);
    }
  } else if (report.doctor?.reason) {
    lines.push('## 阻塞原因');
    lines.push('');
    lines.push(`- ${report.doctor.reason}`);
  }
  lines.push('');
  return lines.join('\n');
}

function renderCaseReport(result) {
  return [
    `# ${result.id} ${result.title}`,
    '',
    `- 状态：${result.status}`,
    `- 优先级：${result.priority}`,
    `- 原因：${result.reason}`,
    `- 用例目录：${result.case_dir}`,
    '',
    '## 操作步骤',
    '',
    ...(result.steps || []).map((step, index) => `${index + 1}. ${step.action}：${step.status}${step.selector ? `（${step.selector}）` : ''}${step.text ? `\n   - ${step.text}` : ''}`),
    '',
    '## 评分',
    '',
    `- 易用性：${result.scores?.product_ease_of_use ?? ''}/10`,
    `- 实用性：${result.scores?.practical_value ?? ''}/10`,
    `- 回复相关性：${result.scores?.reply_relevance ?? ''}/10`,
    `- 证据质量：${result.scores?.evidence_quality ?? ''}/10`,
    '',
    '## 断言',
    '',
    ...(result.assertions?.passed || []).map((item) => `- PASS：${item}`),
    ...(result.assertions?.warnings || []).map((item) => `- WARN：${item}`),
    ...(result.assertions?.failed || []).map((item) => `- FAIL：${item}`),
    '',
    '## 截图',
    '',
    ...Object.entries(result.screenshots || {}).map(([key, value]) => `- ${key}：${typeof value === 'string' ? value : JSON.stringify(value)}`),
    '',
    `Transcript：${result.transcript_file || '无'}`,
    '',
  ].join('\n');
}

function renderFixturesReport(report) {
  return [
    '# QBot UI Agent 测试文件生成报告',
    '',
    `- 状态：${report.status}`,
    `- 目录：${report.fixtures_dir}`,
    '',
    '| 文件 | 大小 |',
    '| --- | --- |',
    ...report.fixtures.map((item) => `| ${item.path} | ${item.bytes} |`),
    '',
  ].join('\n');
}

function escapeMd(text) {
  return String(text || '').replace(/\|/g, '/').replace(/\n/g, ' ');
}

function longChineseText() {
  return Array.from({ length: 8 }, (_, index) => `第${index + 1}段：QBot 面向产品、运营和管理者，核心体验应当是用户直接描述目标，系统自动理解上下文、处理资料、生成结构化回复。测试时要关注多轮上下文、长文本摘要、附件读取、异常提示是否用户友好，以及回复是否暴露底层模型、运行时、环境变量或内部服务错误。`).join('\n');
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
