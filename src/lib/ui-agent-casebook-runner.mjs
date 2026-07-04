import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { ensureDir, slugify, writeJsonFile, writeTextFile } from './fs.mjs';
import { uploadAttachmentsInComposer } from './qbot-ui-attachments.mjs';

const DEFAULT_CDP_URL = 'http://127.0.0.1:9224';
const DEFAULT_TIMEOUT_MS = 120000;
const AUTH_BROWSER_CANDIDATES = [
  process.env.DEEPBANK_E2E_BROWSER_PATH,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
].filter(Boolean);

const TECHNICAL_FAILURE_PATTERNS = [
  /模型未配置/,
  /cannot execute/i,
  /desktop-local/i,
  /remote control-plane/i,
  /SkillHub 地址未配置/,
  /技能[^。\n]{0,80}(暂时不可用|暂不可用|不可用|未就绪)/,
  /扩展技能[^。\n]{0,80}(暂时不可用|暂不可用|不可用|未就绪)/,
  /DEEPBANK_[A-Z0-9_]+/,
  /Bearer\s+[A-Za-z0-9._-]+/,
  /client_secret/i,
  /access_token/i,
  /refresh_token/i,
  /\btraceback\b/i,
  /\buncaught\b/i,
  /\bexception\b/i,
  /发生内部错误/,
  /系统内部错误/,
  /错误码/,
];

export async function runUiAgentCasebookCommand({ options = {}, root = process.cwd() } = {}) {
  const startedAt = new Date();
  const casebook = resolveCasebook(root, options.casebook);
  const runStamp = timestampMinute();
  const outDir = path.resolve(options.out || createRunDir(path.join(root, 'autoTest'), `${runStamp}_自动化测试结果`));
  const casesFile = path.join(outDir, 'casebook-cases.json');
  const cdpUrl = String(options.cdp || process.env.QBOT_CDP_URL || DEFAULT_CDP_URL);
  const timeoutMs = Number(options['timeout-ms'] || DEFAULT_TIMEOUT_MS);
  const profile = String(options.profile || 'mandatory');
  const fixturesDir = path.resolve(options.fixtures || path.join(root, 'testflies'));
  const python = String(options.python || process.env.PYTHON || 'python3');
  const resultExcel = path.join(outDir, `${runStamp}_自动化测试结果.xlsx`);

  ensureDir(outDir);
  ensureDir(path.join(outDir, 'logs'));
  ensureDir(fixturesDir);

  const exportCommand = runPython({
    python,
    args: [
      path.join(root, 'skills', 'qbot-execute-automation-tests', 'scripts', 'casebook_io.py'),
      'export-cases',
      '--casebook',
      casebook,
      '--output',
      casesFile,
      '--profile',
      profile,
      ...(options.case ? ['--case', String(options.case)] : []),
      ...(options.limit ? ['--limit', String(options.limit)] : []),
    ],
    cwd: root,
  });
  writeTextFile(path.join(outDir, 'logs', 'export-cases.stdout.log'), exportCommand.stdout || '');
  writeTextFile(path.join(outDir, 'logs', 'export-cases.stderr.log'), exportCommand.stderr || '');
  if (exportCommand.status !== 0) {
    const summary = buildSummary({
      status: 'blocked',
      startedAt,
      outDir,
      casebook,
      resultExcel,
      profile,
      cdpUrl,
      results: [],
      reason: `导出测试用例失败：${exportCommand.stderr || exportCommand.error || 'unknown error'}`,
    });
    writeRunArtifacts(outDir, summary);
    return summary;
  }

  const casePlan = JSON.parse(fs.readFileSync(casesFile, 'utf8'));
  const selectedCases = casePlan.cases || [];
  writeTextFile(path.join(outDir, 'casebook-source.txt'), casebook);
  copyIfExists(casebook, path.join(outDir, `source-${path.basename(casebook)}`));
  if (!selectedCases.length) {
    const summary = buildSummary({
      status: 'blocked',
      startedAt,
      outDir,
      casebook,
      resultExcel,
      profile,
      cdpUrl,
      results: [],
      reason: '测试用例文档中没有匹配本次 profile/case/limit 的可执行用例。',
    });
    writeRunArtifacts(outDir, summary);
    await writeResultExcel({ python, root, casebook, outDir, summary, resultExcel });
    return summary;
  }

  if (options['skip-run'] === true) {
    const results = selectedCases.map((testCase, index) => buildSyntheticResult({
      outDir,
      testCase,
      index,
      status: 'blocked',
      resultCategory: 'blocked',
      reason: 'skip-run 模式：仅验证用例读取和结果文件生成，不执行 QBot UI。',
    }));
    const summary = buildSummary({
      status: 'dry-run',
      startedAt,
      outDir,
      casebook,
      resultExcel,
      profile,
      cdpUrl,
      results,
      reason: 'skip-run',
    });
    writeRunArtifacts(outDir, summary);
    await writeResultExcel({ python, root, casebook, outDir, summary, resultExcel });
    return summary;
  }

  const loaded = await loadPlaywright();
  if (loaded.error) {
    const results = selectedCases.map((testCase, index) => buildSyntheticResult({
      outDir,
      testCase,
      index,
      status: 'blocked',
      resultCategory: 'blocked',
      reason: `Playwright 未安装或无法加载：${loaded.error.message}`,
    }));
    const summary = buildSummary({
      status: 'blocked',
      startedAt,
      outDir,
      casebook,
      resultExcel,
      profile,
      cdpUrl,
      results,
      reason: `Playwright 未安装或无法加载：${loaded.error.message}`,
    });
    writeRunArtifacts(outDir, summary);
    await writeResultExcel({ python, root, casebook, outDir, summary, resultExcel });
    return summary;
  }

  let browser;
  try {
    browser = await loaded.chromium.connectOverCDP(cdpUrl);
    const page = await findQbotPage(browser);
    if (!page) {
      const results = selectedCases.map((testCase, index) => buildSyntheticResult({
        outDir,
        testCase,
        index,
        status: 'blocked',
        resultCategory: 'blocked',
        reason: `已连接 CDP ${cdpUrl}，但没有找到 QBot 页面。`,
      }));
      const summary = buildSummary({
        status: 'blocked',
        startedAt,
        outDir,
        casebook,
        resultExcel,
        profile,
        cdpUrl,
        results,
        reason: `已连接 CDP ${cdpUrl}，但没有找到 QBot 页面。`,
      });
      writeRunArtifacts(outDir, summary);
      await writeResultExcel({ python, root, casebook, outDir, summary, resultExcel });
      return summary;
    }

    page.setDefaultTimeout(12000);
    page.setDefaultNavigationTimeout(30000);
    page.on('dialog', async (dialog) => dialog.dismiss().catch(() => {}));
    const precheck = await inspectPrecheck(page, outDir);
    const results = [];
    for (let index = 0; index < selectedCases.length; index += 1) {
      const testCase = selectedCases[index];
      const caseDir = path.join(outDir, 'cases', `${String(index + 1).padStart(3, '0')}-${testCase.id}-${slugify(testCase.scenario)}`);
      ensureDir(caseDir);
      const result = await executeCasebookCase({
        page,
        testCase,
        caseDir,
        order: index + 1,
        timeoutMs,
        fixturesDir,
        precheck,
        options,
        playwright: loaded,
      });
      results.push(result);
      writeJsonFile(path.join(outDir, 'automation-progress.json'), {
        updated_at: new Date().toISOString(),
        completed: results.length,
        total: selectedCases.length,
        results,
      });
    }

    const summary = buildSummary({
      status: statusFromResults(results),
      startedAt,
      outDir,
      casebook,
      resultExcel,
      profile,
      cdpUrl,
      results,
      precheck,
    });
    writeRunArtifacts(outDir, summary);
    await writeResultExcel({ python, root, casebook, outDir, summary, resultExcel });
    return summary;
  } catch (error) {
    const results = selectedCases.map((testCase, index) => buildSyntheticResult({
      outDir,
      testCase,
      index,
      status: 'blocked',
      resultCategory: 'blocked',
      reason: `自动化框架异常：${error.message}`,
    }));
    const summary = buildSummary({
      status: 'blocked',
      startedAt,
      outDir,
      casebook,
      resultExcel,
      profile,
      cdpUrl,
      results,
      reason: error.message,
    });
    writeRunArtifacts(outDir, summary);
    await writeResultExcel({ python, root, casebook, outDir, summary, resultExcel });
    return summary;
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
}

function resolveCasebook(root, explicit) {
  if (explicit) return path.resolve(explicit);
  const prd = path.join(root, 'PRD');
  const preferred = path.join(prd, 'Qbot_自动化可执行测试用例_精确执行版_2026-07-03.xlsx');
  if (fs.existsSync(preferred)) return preferred;
  const precise = fs.existsSync(prd)
    ? fs.readdirSync(prd)
      .filter((name) => /精确执行版.*\.xlsx$/i.test(name))
      .sort()
      .reverse()
    : [];
  if (precise.length) return path.join(prd, precise[0]);
  return path.join(prd, 'Qbot_TestCase.xlsx');
}

function timestampMinute(date = new Date()) {
  const pad = (value) => String(value).padStart(2, '0');
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}${pad(date.getHours())}${pad(date.getMinutes())}`;
}

function createRunDir(root, baseName) {
  ensureDir(root);
  let candidate = path.join(root, baseName);
  if (!fs.existsSync(candidate)) return candidate;
  for (let i = 1; i < 100; i += 1) {
    candidate = path.join(root, `${baseName}-${String(i).padStart(2, '0')}`);
    if (!fs.existsSync(candidate)) return candidate;
  }
  return path.join(root, `${baseName}-${Date.now()}`);
}

function runPython({ python, args, cwd }) {
  const result = spawnSync(python, args, { cwd, encoding: 'utf8', maxBuffer: 1000 * 1000 * 80 });
  return {
    status: result.status,
    stdout: result.stdout,
    stderr: result.stderr,
    error: result.error?.message || '',
  };
}

async function executeCasebookCase({ page, testCase, caseDir, order, timeoutMs, fixturesDir, precheck, options, playwright }) {
  const state = {
    order,
    id: testCase.id,
    sheet: testCase.sheet,
    row_number: testCase.row_number,
    title: testCase.scenario,
    module: testCase.module,
    submodule: testCase.submodule,
    priority: testCase.priority,
    scenario: testCase.scenario,
    precondition: testCase.precondition,
    test_data: testCase.test_data,
    expected_result: testCase.expected_result,
    success_criteria: testCase.success_criteria,
    failure_criteria: testCase.failure_criteria,
    evidence_required: testCase.evidence_required,
    kind: testCase.kind,
    status: 'failed',
    result_category: 'bug',
    actual_result: '',
    conclusion: '',
    problem_description: '',
    case_dir: caseDir,
    case_report: path.join(caseDir, 'case-report.md'),
    started_at: new Date().toISOString(),
    ended_at: '',
    steps: [],
    assertions: [],
    screenshots: {},
    screenshots_flat: [],
    artifacts: {},
    llm_review: { status: 'not_needed' },
  };

  try {
    await clearUi(page);
    state.screenshots.before = await shot(page, caseDir, '01-before');
    if (precheck?.login_required && testCase.kind !== 'auth') {
      markBlocked(state, 'QBot 当前停留在登录页，非登录用例无法进入产品断言。');
      return await finishCase({ page, state, caseDir });
    }

    const selectors = parseSelectors(testCase.selectors);
    if (testCase.kind === 'conversation' || testCase.kind === 'attachment') {
      await executeConversationCase({ page, state, testCase, caseDir, timeoutMs, fixturesDir });
    } else if (testCase.kind === 'auth') {
      await executeAuthCase({ page, state, testCase, caseDir, selectors, options, playwright });
    } else {
      await executeUiCase({ page, state, testCase, caseDir, selectors });
    }

    await assertNoForbidden(page, state);
    await maybeRequestLlmReview({ page, state, testCase, caseDir, options });
    finalizeState(state);
    return await finishCase({ page, state, caseDir });
  } catch (error) {
    state.screenshots.error = await shot(page, caseDir, '99-error').catch((err) => ({ error: err.message }));
    const message = error.message || String(error);
    if (isEnvironmentBlocker(message)) markBlocked(state, message);
    else markFailed(state, message, 'bug');
    await maybeRequestLlmReview({ page, state, testCase, caseDir, options, force: true }).catch(() => {});
    return await finishCase({ page, state, caseDir });
  }
}

async function executeConversationCase({ page, state, testCase, caseDir, timeoutMs, fixturesDir }) {
  await openNewTask(page, state);
  const attachments = inferAttachments(testCase, fixturesDir);
  if (attachments.length) {
    const upload = await uploadAttachmentsInComposer(page, attachments);
    state.artifacts.upload = upload;
    state.screenshots.after_upload = await shot(page, caseDir, '02-after-upload');
    recordStep(
      state,
      '上传附件',
      '文件选择后应显示文件名和移除入口；如果环境阻塞，必须明确阻塞原因。',
      [
        upload.reason,
        upload.expected_names?.length ? `期望文件：${upload.expected_names.join(', ')}` : '',
        upload.visible_names?.length ? `页面可见文件：${upload.visible_names.join(', ')}` : '',
      ].filter(Boolean).join('；') || upload.status,
      upload.status === 'passed' ? 'passed' : upload.status === 'blocked' ? 'blocked' : 'failed',
      state.screenshots.after_upload,
    );
    if (upload.status !== 'passed') return;
  }

  const turns = buildConversationTurns(testCase, attachments);
  const replies = [];
  for (let index = 0; index < turns.length; index += 1) {
    const turn = turns[index];
    const turnNo = index + 1;
    const before = await conversationSnapshot(page);
    await fillComposer(page, turn.prompt, state, turn.label || `第 ${turnNo} 轮输入`);
    state.screenshots[`turn_${turnNo}_after_fill`] = await shot(page, caseDir, `${String(turnNo + 2).padStart(2, '0')}-turn-${turnNo}-after-fill`);
    await send(page, state, turn.label ? `发送${turn.label}` : `发送第 ${turnNo} 轮问题`);
    state.screenshots[`turn_${turnNo}_after_send`] = await shot(page, caseDir, `${String(turnNo + 3).padStart(2, '0')}-turn-${turnNo}-after-send`);
    const reply = await waitForReply(page, before, timeoutMs);
    state.screenshots[`turn_${turnNo}_after_reply`] = await shot(page, caseDir, `${String(turnNo + 4).padStart(2, '0')}-turn-${turnNo}-after-reply`);
    replies.push({ ...reply, label: turn.label || `第 ${turnNo} 轮` });
    recordAssertion(state, `Agent 有效回复（${turn.label || `第 ${turnNo} 轮`}）`, '应产生可读、与当前轮问题相关的回复。', reply.deltaText.trim().length > 15, `回复增量长度：${reply.deltaText.trim().length}`);
    recordAssertion(state, `回复相关性（${turn.label || `第 ${turnNo} 轮`}）`, '回复应围绕当前轮问题或测试数据作答。', replyLooksRelevant(reply.deltaText, testCase, turn.prompt), clip(reply.deltaText, 220));
  }
  state.artifacts.transcript = path.join(caseDir, 'transcript.txt');
  state.artifacts.reply_delta = path.join(caseDir, 'reply-delta.txt');
  writeTextFile(state.artifacts.transcript, replies.map((reply) => `## ${reply.label}\n\n${reply.fullText}`).join('\n\n---\n\n'));
  writeTextFile(state.artifacts.reply_delta, replies.map((reply) => `## ${reply.label}\n\n${reply.deltaText}`).join('\n\n---\n\n'));
  if (attachments.length) {
    recordAssertion(state, '附件上传证据', '附件类用例必须有上传结果和上传后截图。', state.artifacts.upload?.status === 'passed' && Boolean(state.screenshots.after_upload), state.artifacts.upload?.reason || '');
  }
}

async function executeAuthCase({ page, state, testCase, caseDir, selectors, options, playwright }) {
  const text = await bodyText(page);
  const loginVisible = await visible(page.locator('[data-testid="auth-login"]').first(), 1200);
  if (!loginVisible && /qbot-app|工作台|新建任务|专家|连接器/.test(`${text}\n${testCase.expected_result}`)) {
    state.screenshots.auth_observation = await shot(page, caseDir, '02-auth-observation');
    recordStep(state, '观察当前鉴权状态', '应能判断当前登录/工作台状态。', '当前已在工作台或未展示登录按钮。', 'passed', state.screenshots.auth_observation);
    recordAssertion(state, '已处于登录后工作台', '页面应展示工作台核心入口。', /新建任务|专家|连接器|知识/.test(text), clip(text, 180));
    return;
  }
  const logPosition = currentFileSize(options['qbot-stderr-log']);
  const target = selectors.find((item) => item.selector.includes('auth-login')) || { selector: '[data-testid="auth-login"]' };
  await clickSelector(page, target.selector, '点击登录入口', state);
  state.screenshots.after_auth_click = await shot(page, caseDir, '02-after-auth-click');
  recordStep(state, '触发 OAuth 登录', '点击后应打开或生成 Lingxi OAuth 授权链接。', '已点击登录入口。', 'passed', state.screenshots.after_auth_click);

  const authorize = await resolveAuthorizeUrl({ options, logPosition, caseDir });
  if (!authorize.url) {
    markBlocked(state, authorize.reason || '未捕获到 OAuth 授权 URL，无法继续自动认证。');
    return;
  }
  state.artifacts.auth_url_source = authorize.source;
  recordStep(
    state,
    '捕获 OAuth 授权链接',
    '自动化应能拿到本次登录 attempt 对应的授权 URL。',
    `已从 ${authorize.source} 捕获授权链接，attempt=${attemptIdFromAuthorizeUrl(authorize.url) || 'unknown'}。`,
    'passed',
  );

  const authResult = await completeOauthAuthorization({
    authorizeUrl: authorize.url,
    playwright,
    caseDir,
    options,
  });
  state.artifacts.auth_browser = authResult.artifacts;
  recordStep(
    state,
    '完成 Lingxi 授权',
    '自动化应在浏览器中完成登录/认证，并等待服务端 attempt 变为 authenticated。',
    authResult.reason,
    authResult.status,
    authResult.artifacts?.after_auth_screenshot || authResult.artifacts?.authorize_screenshot || '',
  );
  if (authResult.status !== 'passed') {
    markBlocked(state, authResult.reason);
    return;
  }

  const workbench = await waitForQbotWorkbench(page, 90000);
  state.screenshots.after_auth_success = await shot(page, caseDir, '05-after-auth-success');
  recordAssertion(
    state,
    '登录后工作台可用',
    '完成授权后 QBot 应回到登录后工作台，并展示新建任务/专家/连接器/知识等入口。',
    workbench.ok,
    workbench.reason,
  );
}

async function executeUiCase({ page, state, testCase, caseDir, selectors }) {
  await ensureSidebarExpanded(page, state);
  const clicked = await clickBestEntry(page, testCase, selectors, state);
  await page.waitForTimeout(1000);
  state.screenshots.after_action = await shot(page, caseDir, '02-after-action');
  if (!clicked) {
    recordStep(state, '执行入口定位', '应能根据用例入口或 selector 定位可操作入口。', '未找到可点击入口。', 'failed', state.screenshots.after_action);
    return;
  }
  const actualText = await bodyText(page);
  state.artifacts.page_text = path.join(caseDir, 'page-text-after-action.txt');
  writeTextFile(state.artifacts.page_text, actualText);
  const expectedKeywords = expectedKeywordsForCase(testCase);
  if (expectedKeywords.length) {
    const hit = expectedKeywords.some((keyword) => actualText.includes(keyword));
    recordAssertion(state, '页面预期文案', `页面应出现与场景相关的文案：${expectedKeywords.join(' / ')}`, hit, hit ? '已命中至少一个预期文案。' : '未命中预期文案。');
  } else {
    recordAssertion(state, '页面可观察反馈', '操作后页面应有可观察内容或状态变化。', actualText.trim().length > 20, `页面文本长度：${actualText.trim().length}`);
    state.llm_review.status = 'needed';
  }
}

function currentFileSize(file) {
  if (!file) return 0;
  try {
    return fs.existsSync(file) ? fs.statSync(file).size : 0;
  } catch {
    return 0;
  }
}

async function resolveAuthorizeUrl({ options, logPosition = 0, caseDir }) {
  const explicit = String(options['auth-url'] || '').trim();
  if (explicit) return { url: explicit, source: '--auth-url' };

  const logFile = options['qbot-stderr-log'] ? path.resolve(String(options['qbot-stderr-log'])) : '';
  if (logFile) {
    const fromLog = await waitForAuthorizeUrlInLog(logFile, logPosition, 30000);
    if (fromLog) return { url: fromLog, source: logFile };
  }

  const fromSafari = safariCurrentAuthorizeUrl();
  if (fromSafari) {
    writeTextFile(path.join(caseDir, 'auth-url-source.txt'), 'Safari current tab URL was used as OAuth authorize URL.\n');
    return { url: fromSafari, source: 'Safari 当前标签页' };
  }

  return {
    url: '',
    source: '',
    reason: logFile
      ? `未在 ${logFile} 或 Safari 当前标签页中捕获到 OAuth 授权 URL。`
      : '未提供 --qbot-stderr-log，且 Safari 当前标签页不是 OAuth 授权 URL。',
  };
}

async function waitForAuthorizeUrlInLog(logFile, startPosition = 0, timeoutMs = 30000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const url = latestAuthorizeUrlFromLog(logFile, startPosition);
    if (url) return url;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  return '';
}

function latestAuthorizeUrlFromLog(logFile, startPosition = 0) {
  try {
    if (!fs.existsSync(logFile)) return '';
    const fd = fs.openSync(logFile, 'r');
    try {
      const stat = fs.fstatSync(fd);
      const offset = Math.min(Math.max(0, startPosition), stat.size);
      const length = stat.size - offset;
      if (length <= 0) return '';
      const buffer = Buffer.alloc(length);
      fs.readSync(fd, buffer, 0, length, offset);
      const text = buffer.toString('utf8');
      const matches = Array.from(text.matchAll(/\[qbot-e2e-open-external\]\s+(\S+)/g)).map((match) => match[1]);
      return matches.reverse().find((url) => isAuthorizeUrl(url)) || '';
    } finally {
      fs.closeSync(fd);
    }
  } catch {
    return '';
  }
}

function safariCurrentAuthorizeUrl() {
  if (process.platform !== 'darwin') return '';
  const script = 'tell application "Safari" to get URL of current tab of front window';
  const result = spawnSync('/usr/bin/osascript', ['-e', script], { encoding: 'utf8', timeout: 8000 });
  const url = String(result.stdout || '').trim();
  return isAuthorizeUrl(url) ? url : '';
}

function isAuthorizeUrl(value) {
  const text = String(value || '').trim();
  if (!/^https?:\/\//i.test(text)) return false;
  return /\/login\/oauth|\/api\/auth\/mock\/authorize|redirect_uri=|redirectUri=|attemptId=|attempt_id=/.test(text);
}

function authorizeUrlParams(authorizeUrl) {
  const parsed = new URL(authorizeUrl);
  const params = [parsed.searchParams];
  const hash = parsed.hash ? parsed.hash.slice(1) : '';
  if (hash) {
    const query = hash.includes('?') ? hash.slice(hash.indexOf('?') + 1) : hash;
    if (query.includes('=')) params.push(new URLSearchParams(query));
  }
  return params;
}

function attemptIdFromAuthorizeUrl(authorizeUrl) {
  try {
    const parsed = new URL(authorizeUrl);
    const directPathMatch = parsed.pathname.match(/\/api\/auth\/callback\/([^/?#]+)/);
    if (directPathMatch) return decodeURIComponent(directPathMatch[1]);

    for (const params of authorizeUrlParams(authorizeUrl)) {
      const direct = params.get('attemptId') || params.get('attempt_id');
      if (direct) return direct;
    }

    for (const params of authorizeUrlParams(authorizeUrl)) {
      const redirectUri = params.get('redirect_uri') || params.get('redirectUri') || '';
      const redirectMatch = redirectUri.match(/\/api\/auth\/callback\/([^/?#]+)/);
      if (redirectMatch) return decodeURIComponent(redirectMatch[1]);
    }
  } catch {
    return '';
  }
  return '';
}

function baseUrlFromAuthorizeUrl(authorizeUrl) {
  const parsed = new URL(authorizeUrl);
  const directPathMatch = parsed.pathname.match(/\/api\/auth\/callback\//);
  if (directPathMatch) return parsed.origin;
  for (const params of authorizeUrlParams(authorizeUrl)) {
    const redirectUri = params.get('redirect_uri') || params.get('redirectUri') || '';
    if (!redirectUri) continue;
    try {
      const redirect = new URL(redirectUri);
      if (/\/api\/auth\/callback\//.test(redirect.pathname)) return redirect.origin;
    } catch {
      // Ignore invalid redirect_uri values.
    }
  }
  return parsed.origin;
}

async function completeOauthAuthorization({ authorizeUrl, playwright, caseDir, options }) {
  const artifacts = {};
  const baseUrl = baseUrlFromAuthorizeUrl(authorizeUrl);
  const attemptId = attemptIdFromAuthorizeUrl(authorizeUrl);
  if (!attemptId) return { status: 'blocked', reason: 'OAuth 授权 URL 中没有解析到 attemptId。', artifacts };

  const existing = await readAuthAttempt(baseUrl, attemptId).catch(() => null);
  if (existing?.status === 'authenticated' && existing.auth?.sessionToken) {
    return { status: 'passed', reason: '授权 attempt 已是 authenticated。', artifacts };
  }
  if (/\/api\/auth\/mock\/authorize/.test(new URL(authorizeUrl).pathname)) {
    const response = await fetch(authorizeUrl, { redirect: 'follow' });
    await response.text().catch(() => '');
    const auth = await waitForAttemptAuth(baseUrl, attemptId, 30000);
    return {
      status: auth?.sessionToken ? 'passed' : 'blocked',
      reason: auth?.sessionToken ? 'Mock OAuth 已完成。' : 'Mock OAuth 未返回 sessionToken。',
      artifacts,
    };
  }

  const credentials = authCredentials(options);
  const executablePath = resolveAuthBrowserExecutable();
  const launchOptions = {
    headless: options['auth-headed'] === true ? false : true,
  };
  if (executablePath) launchOptions.executablePath = executablePath;

  let browser;
  try {
    browser = await playwright.chromium.launch(launchOptions);
  } catch (error) {
    return {
      status: 'blocked',
      reason: `无法启动 Playwright 认证浏览器：${error.message}`,
      artifacts,
    };
  }

  const context = await browser.newContext();
  const authPage = await context.newPage();
  try {
    await authPage.goto(authorizeUrl, { waitUntil: 'domcontentloaded', timeout: 180000 });
    artifacts.authorize_screenshot = await shot(authPage, caseDir, '03-auth-browser-authorize');

    const approve = await clickAuthorizationButton(authPage, 7000);
    if (approve.clicked) {
      artifacts.approve_click = approve;
    } else {
      if (!credentials) {
        artifacts.login_page_text = path.join(caseDir, 'auth-browser-page-text.txt');
        writeTextFile(artifacts.login_page_text, await authPage.locator('body').innerText({ timeout: 5000 }).catch(() => ''));
        return {
          status: 'blocked',
          reason: '授权页需要账号密码登录，但未配置 DEEPBANK_E2E_LINGXI_USERNAME / DEEPBANK_E2E_LINGXI_PASSWORD 或 --auth-username/--auth-password。',
          artifacts,
        };
      }
      const username = authPage.getByPlaceholder('请输入域账号(user-jk)').or(authPage.locator('input[type="text"], input:not([type])').first());
      const password = authPage.getByPlaceholder('请输入密码').or(authPage.locator('input[type="password"]').first());
      if (!(await visible(username, 20000)) || !(await visible(password, 5000))) {
        artifacts.login_page_text = path.join(caseDir, 'auth-browser-page-text.txt');
        writeTextFile(artifacts.login_page_text, await authPage.locator('body').innerText({ timeout: 5000 }).catch(() => ''));
        return { status: 'blocked', reason: 'Lingxi 登录页未展示可识别的账号/密码输入框。', artifacts };
      }
      await username.fill(credentials.username);
      await password.fill(credentials.password);
      await authPage.getByRole('button', { name: /登录|Sign in/i }).first().click({ force: true });
      const postLoginApprove = await clickAuthorizationButton(authPage, 45000);
      artifacts.post_login_approve_click = postLoginApprove;
    }

    await authPage.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
    artifacts.after_auth_screenshot = await shot(authPage, caseDir, '04-auth-browser-after-submit');
    const auth = await waitForAttemptAuth(baseUrl, attemptId, 180000);
    return {
      status: auth?.sessionToken ? 'passed' : 'blocked',
      reason: auth?.sessionToken ? 'Lingxi OAuth attempt 已认证成功。' : 'Lingxi OAuth attempt 未返回 sessionToken。',
      artifacts,
    };
  } catch (error) {
    artifacts.error_screenshot = await shot(authPage, caseDir, '04-auth-browser-error').catch(() => '');
    return { status: 'blocked', reason: `Playwright 认证流程失败：${error.message}`, artifacts };
  } finally {
    await context.close().catch(() => {});
    await browser.close().catch(() => {});
  }
}

function authCredentials(options) {
  const username = String(options['auth-username'] || process.env.DEEPBANK_E2E_LINGXI_USERNAME || '').trim();
  const password = String(options['auth-password'] || process.env.DEEPBANK_E2E_LINGXI_PASSWORD || '');
  if (!username || !password) return null;
  return { username, password };
}

function resolveAuthBrowserExecutable() {
  return AUTH_BROWSER_CANDIDATES.find((candidate) => candidate && fs.existsSync(candidate)) || '';
}

async function readAuthAttempt(baseUrl, attemptId) {
  const response = await fetch(`${baseUrl}/api/auth/attempt/${encodeURIComponent(attemptId)}`, {
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) throw new Error(`auth attempt read failed: ${response.status}`);
  return await response.json();
}

async function waitForAttemptAuth(baseUrl, attemptId, timeoutMs = 180000) {
  const deadline = Date.now() + timeoutMs;
  let last = null;
  while (Date.now() < deadline) {
    last = await readAuthAttempt(baseUrl, attemptId).catch((error) => ({ status: 'read_error', error: error.message }));
    if (last?.status === 'authenticated' && last.auth?.sessionToken) return last.auth;
    if (last?.status === 'error') throw new Error(last.error || 'login failed');
    await new Promise((resolve) => setTimeout(resolve, 800));
  }
  throw new Error(`等待 OAuth attempt 认证超时，最后状态：${last?.status || 'unknown'}`);
}

async function clickAuthorizationButton(page, timeoutMs = 7000) {
  const started = Date.now();
  const labels = /认证|授权|同意|确认/;
  while (Date.now() - started < timeoutMs) {
    const roleButton = page.getByRole('button', { name: labels }).first();
    if (await visible(roleButton, 500)) {
      await roleButton.click({ force: true });
      return { clicked: true, strategy: 'role=button[name=认证|授权|同意|确认]' };
    }

    const textButton = page.locator('button').filter({ hasText: labels }).first();
    if (await visible(textButton, 500)) {
      await textButton.click({ force: true });
      return { clicked: true, strategy: 'button:has-text(认证|授权|同意|确认)' };
    }

    const domClicked = await page.evaluate(() => {
      const wanted = ['认证', '授权', '同意', '确认'];
      const isVisible = (el) => {
        const style = window.getComputedStyle(el);
        const rect = el.getBoundingClientRect();
        return style && style.visibility !== 'hidden' && style.display !== 'none' && rect.width > 0 && rect.height > 0;
      };
      const candidates = Array.from(document.querySelectorAll('button,input[type="button"],input[type="submit"],a,[role="button"]'));
      for (const el of candidates) {
        const text = `${el.textContent || ''} ${el.getAttribute('aria-label') || ''} ${el.getAttribute('value') || ''}`.trim();
        if (!wanted.some((label) => text.includes(label))) continue;
        if (!isVisible(el)) continue;
        if ('disabled' in el && el.disabled) continue;
        el.click();
        return { clicked: true, text };
      }
      return { clicked: false, text: document.body?.innerText?.slice(0, 300) || '' };
    }).catch((error) => ({ clicked: false, error: error.message }));
    if (domClicked.clicked) {
      return { clicked: true, strategy: 'dom-text-click', text: domClicked.text };
    }

    await page.waitForTimeout(500);
  }
  return { clicked: false, strategy: 'not-found', timeoutMs };
}

async function waitForQbotWorkbench(page, timeoutMs = 90000) {
  const deadline = Date.now() + timeoutMs;
  let reloaded = false;
  let lastText = '';
  while (Date.now() < deadline) {
    const loginVisible = await page.locator('[data-testid="auth-login"]').first().isVisible({ timeout: 300 }).catch(() => false);
    lastText = await bodyText(page).catch(() => '');
    const hasWorkbench = /新建任务/.test(lastText) && /专家|连接器|知识/.test(lastText);
    if (!loginVisible && hasWorkbench) return { ok: true, reason: '已进入 QBot 工作台，核心导航入口可见。' };
    if (!reloaded && Date.now() > deadline - timeoutMs + 30000) {
      reloaded = true;
      await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
    }
    await page.waitForTimeout(1000);
  }
  return { ok: false, reason: `完成 OAuth 后未在 ${timeoutMs}ms 内进入工作台；页面文本：${clip(lastText, 220)}` };
}

async function clickBestEntry(page, testCase, selectors, state) {
  const moduleEntry = moduleSelector(testCase.module, testCase.scenario);
  if (moduleEntry && await tryClick(page, moduleEntry, `进入模块：${testCase.module}`, state)) return true;
  for (const item of selectors) {
    if (await tryClick(page, item.selector, `点击用例入口：${item.label || item.selector}`, state)) return true;
  }
  const textEntry = textEntryFor(testCase);
  if (textEntry && await tryClick(page, `text=${textEntry}`, `点击文本入口：${textEntry}`, state)) return true;
  return false;
}

function parseSelectors(raw) {
  const out = [];
  const text = String(raw || '');
  for (const match of text.matchAll(/\[data-testid=["']([^"']+)["']\]/g)) {
    out.push({ selector: `[data-testid="${match[1]}"]`, label: match[1] });
  }
  for (const match of text.matchAll(/(?:Selector|selector|按 selector|按 Selector)[：:]\s*([^。\n]+)/g)) {
    const parts = match[1].split(/[;；,，]/).map((item) => item.trim()).filter(Boolean);
    for (const part of parts) {
      if (/^[a-z0-9-]+$/i.test(part)) out.push({ selector: `[data-testid="${part}"]`, label: part });
    }
  }
  for (const match of text.matchAll(/role=button\[name=([^\]]+)\]/g)) {
    out.push({ selector: `role=button[name=${match[1]}]`, label: match[0] });
  }
  for (const match of text.matchAll(/text=([^\n;；]+)/g)) {
    out.push({ selector: `text=${match[1].trim()}`, label: match[1].trim() });
  }
  return dedupe(out, (item) => item.selector);
}

function moduleSelector(module, scenario = '') {
  const text = `${module || ''} ${scenario || ''}`;
  if (/专家|技能/.test(text)) return '[data-testid="nav-experts"]';
  if (/连接器|连应用/.test(text)) return '[data-testid="nav-connectors"]';
  if (/知识|成果/.test(text)) return '[data-testid="nav-more"]';
  if (/项目/.test(text)) return '[data-testid="nav-projects"]';
  if (/自动化/.test(text)) return '[data-testid="nav-auto"]';
  if (/设置|个人|主题|用户画像|人设|更新/.test(text)) return '[data-testid="nav-settings-menu"]';
  if (/会话|输入|新建任务|对话|附件|全局界面/.test(text)) return '[data-testid="nav-new-task"]';
  return '';
}

function textEntryFor(testCase) {
  const text = `${testCase.scenario || ''} ${testCase.steps || ''}`;
  const match = text.match(/【([^】]{1,16})】/);
  return match?.[1] || '';
}

async function tryClick(page, selector, action, state) {
  try {
    const locator = locatorFor(page, selector).first();
    if (!(await visible(locator, 1500))) return false;
    await locator.click({ force: true }).catch(async () => locator.evaluate((el) => el.click()));
    recordStep(state, action, `入口应可见且可点击：${selector}`, '已点击。', 'passed');
    await page.waitForTimeout(700);
    return true;
  } catch {
    return false;
  }
}

async function clickSelector(page, selector, action, state) {
  const ok = await tryClick(page, selector, action, state);
  if (!ok) throw new Error(`未找到入口：${selector}`);
}

function locatorFor(page, selector) {
  if (selector.startsWith('text=')) return page.getByText(selector.slice(5), { exact: false });
  const role = selector.match(/^role=button\[name=(.+)\]$/);
  if (role) {
    const raw = role[1];
    if (raw.startsWith('/') && raw.endsWith('/')) return page.getByRole('button', { name: new RegExp(raw.slice(1, -1)) });
    return page.getByRole('button', { name: raw.replace(/^["']|["']$/g, '') });
  }
  return page.locator(selector);
}

async function openNewTask(page, state) {
  await clearUi(page);
  await ensureSidebarExpanded(page, state);
  await clickSelector(page, '[data-testid="nav-new-task"]', '点击【新建任务】', state);
  const composer = page.locator('[data-testid="composer-input"], .aui-composer-input').first();
  if (!(await visible(composer, 5000))) throw new Error('点击【新建任务】后未找到会话输入框。');
}

async function ensureSidebarExpanded(page, state = null) {
  const expanded = await page.evaluate(() => {
    const sidebar = document.querySelector('[data-testid="qbot-sidebar"]');
    const nav = document.querySelector('[data-testid="nav-new-task"]');
    const sr = sidebar?.getBoundingClientRect();
    const nr = nav?.getBoundingClientRect();
    return Boolean(sr && sr.width > 120 && nr && nr.left >= 0 && nr.width > 80);
  }).catch(() => false);
  if (expanded) return;
  const expand = page.locator('[data-testid="sidebar-expand"]').first();
  if (await visible(expand, 1500)) {
    await expand.click({ force: true }).catch(async () => expand.evaluate((el) => el.click()));
    if (state) recordStep(state, '展开左侧栏', '导航收起时应能自动展开。', '已点击展开按钮。', 'passed');
    await page.waitForTimeout(800);
  }
}

async function fillComposer(page, text, state, action = '输入测试问题') {
  const input = page.locator('[data-testid="composer-input"], .aui-composer-input').first();
  if (!(await visible(input, 5000))) throw new Error('未找到会话输入框。');
  await input.click({ force: true });
  const tag = await input.evaluate((el) => el.tagName.toLowerCase()).catch(() => '');
  const editable = await input.evaluate((el) => el.getAttribute('contenteditable') === 'true').catch(() => false);
  if (tag === 'textarea' || tag === 'input') await input.fill(text);
  else if (editable) {
    await page.keyboard.press(process.platform === 'darwin' ? 'Meta+A' : 'Control+A');
    await page.keyboard.insertText(text);
  } else {
    await input.fill(text);
  }
  recordStep(state, action, '输入框应可输入完整测试内容。', clip(text, 180), 'passed');
}

async function send(page, state, action = '点击发送') {
  await clickSelector(page, '[data-testid="composer-send"]', action, state);
}

async function waitForReply(page, beforeState, timeoutMs) {
  const before = typeof beforeState === 'object' && beforeState
    ? beforeState
    : { bodyText: String(beforeState || ''), assistantCount: 0, latestAssistantText: '' };
  const deadline = Date.now() + timeoutMs;
  let last = '';
  let stable = 0;
  let lastCandidate = '';
  let lastFullText = before.bodyText || '';
  while (Date.now() < deadline) {
    const snapshot = await conversationSnapshot(page);
    const fullText = snapshot.bodyText;
    lastFullText = fullText;
    const candidate = latestAssistantReplySince(snapshot, before);
    const deltaText = candidate || diffText(before.bodyText || '', fullText);
    lastCandidate = candidate || lastCandidate || deltaText;
    const hasDelta = deltaText.trim().length > 15 || fullText.length > (before.bodyText || '').length + 15;
    const generating = await isAgentGenerating(page);
    if (hasDelta && forbiddenMatches(deltaText).length) return { fullText, deltaText };
    if (hasDelta && !generating) {
      if (deltaText === last) stable += 1;
      else {
        last = deltaText;
        stable = 0;
      }
      if (stable >= 2) return { fullText, deltaText };
    }
    await page.waitForTimeout(1000);
  }
  if (String(lastCandidate || '').trim().length > 15) {
    return { fullText: lastFullText, deltaText: String(lastCandidate || '').trim() };
  }
  throw new Error(`等待 Agent 回复超时（${timeoutMs}ms）。`);
}

async function conversationSnapshot(page) {
  const body = await bodyText(page).catch(() => '');
  const assistantTexts = await page.locator('[data-role="assistant"]').allInnerTexts().catch(() => []);
  const normalizedAssistantTexts = assistantTexts.map(cleanAssistantText).filter(Boolean);
  return {
    bodyText: body,
    assistantTexts: normalizedAssistantTexts,
    assistantCount: normalizedAssistantTexts.length,
    latestAssistantText: normalizedAssistantTexts.at(-1) || '',
  };
}

function latestAssistantReplySince(snapshot, before) {
  const texts = snapshot.assistantTexts || [];
  const beforeCount = Number(before.assistantCount || 0);
  const newer = texts.slice(beforeCount).filter((text) => text && text !== before.latestAssistantText);
  if (newer.length) return cleanAssistantText(newer.at(-1));
  const latest = cleanAssistantText(snapshot.latestAssistantText || '');
  if (latest && latest !== cleanAssistantText(before.latestAssistantText || '')) return latest;
  return '';
}

function cleanAssistantText(text) {
  return String(text || '')
    .replace(/\bCopy\b/g, '')
    .replace(/重新生成/g, '')
    .replace(/\bMore\b/g, '')
    .replace(/上一条\s*\d+\s*\/\s*\d+\s*下一条/g, '')
    .replace(/▋/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

async function isAgentGenerating(page) {
  const selectors = [
    '[data-testid="agent-status-running"]',
    '[aria-label*="Stop generating"]',
    '[aria-label*="停止"]',
    'button:has-text("停止")',
  ];
  for (const selector of selectors) {
    if (await page.locator(selector).first().isVisible({ timeout: 150 }).catch(() => false)) return true;
  }
  const statusText = await page.locator('[data-testid="agent-status"], .agent-status, [class*="agent-status"]').first().innerText({ timeout: 150 }).catch(() => '');
  return /思考中|生成中|运行中|执行中/i.test(statusText);
}

function buildPrompt(testCase, attachments) {
  const data = expandTestData(testCase.test_data || testCase.scenario);
  const lines = [
    `测试场景：${testCase.scenario}`,
    '',
    `用户输入/测试数据：${data}`,
    '',
    '请像真实 QBot 用户任务一样处理上面的请求，直接给出对用户有帮助的结果。',
    '要求：回复必须符合用户问题逻辑，不要输出环境变量、token、baseURL、SkillHub 未配置、堆栈或内部运行时信息。',
  ];
  if (attachments.length) {
    lines.push('', '我已经上传了附件。请优先读取附件内容；如果无法读取某个附件，请明确说明无法读取，不要假装已读取。');
  }
  return lines.join('\n');
}

function buildConversationTurns(testCase, attachments) {
  const data = expandTestData(testCase.test_data || testCase.scenario);
  const split = splitFollowUpData(data);
  if (!split) return [{ label: '第一轮', prompt: buildPrompt(testCase, attachments) }];
  return [
    {
      label: '第一轮问题',
      prompt: [
        `测试场景：${testCase.scenario}`,
        '',
        `用户问题：${split.question}`,
        '',
        '请像真实 QBot 用户任务一样处理上面的请求，直接给出对用户有帮助的结果。',
        '要求：回复必须符合用户问题逻辑，不要输出环境变量、token、baseURL、SkillHub 未配置、堆栈或内部运行时信息。',
      ].join('\n'),
    },
    {
      label: '第二轮追问',
      prompt: split.followUp,
    },
  ];
}

function splitFollowUpData(value) {
  const text = String(value || '').trim();
  const match = text.match(/(?:普通问题|问题|第一轮)[：:]\s*([\s\S]*?)(?:[；;]\s*|\n+)\s*(?:追问|第二轮)[：:]\s*([\s\S]+)/);
  if (!match) return null;
  const question = match[1].trim();
  const followUp = match[2].trim();
  if (!question || !followUp) return null;
  return { question, followUp };
}

function expandTestData(value) {
  const text = String(value || '');
  if (/5000\s*字/.test(text)) {
    return Array.from({ length: 30 }, (_, index) => `第${index + 1}段：QBot 面向产品、运营和管理者，用户希望不用选择模型或 Agent，只通过自然语言描述目标，系统自动理解上下文、处理资料、生成清晰结论。测试重点包括长文本输入不卡死、回复结构清楚、不要暴露内部配置、能够继续多轮追问。`).join('\n');
  }
  if (/多轮对话/.test(text)) return '请记住：活动报名100人，到场70人，成交12单。先复述这三个数字，再说明成交单数是多少。';
  if (/全部工具入口/.test(text)) return '请简单说明当前输入区附近有哪些可用工具入口，并说明每个入口适合什么任务。';
  if (/当前有哪些文件/.test(text)) return '当前有哪些文件？';
  if (!text || /正常账号|已登录账号|测试账号/.test(text)) return '你好，请用一句话说明你是谁，并回答今天适合做什么测试。';
  return text;
}

function inferAttachments(testCase, fixturesDir) {
  const files = [];
  const add = (name) => {
    const file = path.join(fixturesDir, name);
    if (fs.existsSync(file)) files.push(file);
  };
  const explicitText = String(testCase.test_data || '');
  for (const match of explicitText.matchAll(/(?:testflies\/)?([A-Za-z0-9_.-]+\.(?:txt|md|markdown|docx|xlsx|xls|pdf|pptx|png|jpg|jpeg|json|csv|html|js|svg))/gi)) {
    add(match[1]);
  }
  if (files.length) return dedupe(files, (item) => item);

  const text = `${testCase.scenario}\n${testCase.test_data}\n${testCase.precondition || ''}`;
  if (/TXT|文本|txt/i.test(text)) add('qbot-text-brief.txt');
  if (/Markdown|MD|md/i.test(text)) add('qbot-requirement.md');
  if (/Word|docx/i.test(text)) add('qbot-word-report.docx');
  if (/Excel|xlsx|表格/i.test(text)) add('qbot-data-table.xlsx');
  if (/PDF/i.test(text)) add('qbot-pdf-summary.pdf');
  if (/PPT|pptx/i.test(text)) add('qbot-slide-deck.pptx');
  if (/图片|图像|视觉|多模态|PNG/i.test(text)) add('qbot-image-test.png');
  if (/JSON/i.test(text)) add('qbot-data.json');
  if (/CSV/i.test(text)) add('qbot-table.csv');
  if (/HTML/i.test(text)) add('qbot-page.html');
  if (/(^|[^A-Za-z0-9_])(JS|JavaScript|\.js|代码附件|代码文件)([^A-Za-z0-9_]|$)/i.test(text)) add('qbot-script.js');
  if (!files.length && testCase.kind === 'attachment') add('qbot-text-brief.txt');
  return dedupe(files, (item) => item);
}

function expectedKeywordsForCase(testCase) {
  const candidates = [testCase.module, testCase.submodule]
    .concat(Array.from(String(testCase.scenario || '').matchAll(/【([^】]+)】/g)).map((m) => m[1]))
    .filter((item) => item && String(item).length >= 2 && String(item).length <= 12);
  return dedupe(candidates.map(String), (item) => item);
}

function replyLooksRelevant(reply, testCase, prompt = '') {
  const text = String(reply || '');
  if (text.length < 15) return false;
  const keywords = expectedKeywordsForCase(testCase).filter((item) => !/全局|界面|核心|功能/.test(item));
  if (!keywords.length) return true;
  const promptTokens = String(prompt || testCase.test_data || '')
    .split(/[，。；;、\s:：]+/)
    .filter((item) => item.length >= 2 && item.length <= 12);
  return keywords.some((keyword) => text.includes(keyword))
    || promptTokens.some((keyword) => text.includes(keyword))
    || text.includes(String(testCase.test_data || '').slice(0, 8));
}

async function assertNoForbidden(page, state) {
  const text = await assertionTextForForbidden(page, state);
  const matches = forbiddenMatches(text);
  recordAssertion(
    state,
    '安全与技术噪音',
    '页面和回复不得暴露 token、环境变量、baseURL、SkillHub 未配置、堆栈或内部错误。',
    matches.length === 0,
    matches.length ? `检测到：${matches.join(', ')}` : '未检测到敏感信息或内部技术错误。',
  );
}

async function assertionTextForForbidden(page, state) {
  const replyDelta = state.artifacts?.reply_delta;
  if (replyDelta && fs.existsSync(replyDelta)) return fs.readFileSync(replyDelta, 'utf8');
  const latestAssistant = await latestAssistantText(page);
  if (latestAssistant) return latestAssistant;
  return stripKnownTestText(await bodyText(page).catch(() => ''), state);
}

async function latestAssistantText(page) {
  const texts = await page.locator('[data-role="assistant"]').allInnerTexts().catch(() => []);
  return cleanAssistantText(texts.map(cleanAssistantText).filter(Boolean).at(-1) || '');
}

function stripKnownTestText(text, state) {
  let out = String(text || '');
  for (const value of [state.id, state.scenario, state.test_data, state.expected_result, state.success_criteria, state.failure_criteria]) {
    const item = String(value || '').trim();
    if (item) out = out.split(item).join('');
  }
  for (const step of state.steps || []) {
    const actual = String(step.actual || '').trim();
    if (actual) out = out.split(actual).join('');
  }
  return out;
}

async function maybeRequestLlmReview({ page, state, testCase, caseDir, options, force = false }) {
  const needs = force || state.llm_review.status === 'needed' || state.assertions.some((item) => item.status === 'needs_llm_review');
  if (!needs) return;
  const pageText = await bodyText(page).catch(() => '');
  const prompt = [
    '# QBot 自动化测试 LLM 复核请求',
    '',
    '你是严格的软件测试专家。请根据测试场景、预期结果、实际结果和截图路径，判断本用例最终应为 passed / failed / blocked / other。',
    '',
    `用例ID：${state.id}`,
    `模块：${state.module}`,
    `测试场景：${state.scenario}`,
    '',
    '## 前置条件',
    state.precondition || '无',
    '',
    '## 测试数据',
    state.test_data || '无',
    '',
    '## 预期结果',
    state.expected_result || '无',
    '',
    '## 当前自动化观察',
    state.steps.map((step, index) => `${index + 1}. ${step.action} / 预期：${step.expected} / 实际：${step.actual} / 状态：${step.status}`).join('\n'),
    '',
    '## 页面文本片段',
    clip(pageText, 2500),
    '',
    '## 关键截图',
    state.screenshots_flat.concat(Object.values(state.screenshots).filter((item) => typeof item === 'string')).join('\n') || '无截图',
    '',
    '请输出 JSON：{"status":"passed|failed|blocked|other","result_category":"pass|bug|blocked|other","reason":"...","bug_description":"..."}',
  ].join('\n');
  const file = path.join(caseDir, 'llm-review-request.md');
  writeTextFile(file, prompt);
  state.llm_review = { status: 'needed', prompt_file: file };
  if (options['llm-review-command']) {
    const result = spawnSync(String(options['llm-review-command']), [file], { encoding: 'utf8', maxBuffer: 1000 * 1000 * 5 });
    writeTextFile(path.join(caseDir, 'llm-review.stdout.log'), result.stdout || '');
    writeTextFile(path.join(caseDir, 'llm-review.stderr.log'), result.stderr || '');
    const parsed = parseJsonFromText(result.stdout);
    if (parsed?.status) {
      state.llm_review = { ...state.llm_review, status: 'completed', result: parsed };
      state.status = parsed.status;
      state.result_category = parsed.result_category || (parsed.status === 'failed' ? 'bug' : parsed.status);
      state.actual_result = parsed.reason || state.actual_result;
      if (parsed.bug_description) state.problem_description = parsed.bug_description;
    }
  }
}

function finalizeState(state) {
  if (state.status === 'blocked') return;
  if (state.llm_review?.status === 'needed') {
    const hardFailures = state.assertions.filter((item) => item.status === 'failed');
    if (!hardFailures.length) {
      state.status = 'needs_llm_review';
      state.result_category = 'needs_llm_review';
      state.actual_result = '自动化已完成操作和证据采集，但预期结果需要结合用户体验逻辑由 LLM 复核。';
      state.conclusion = '需LLM复核';
      return;
    }
  }
  const failedAssertions = state.assertions.filter((item) => item.status === 'failed');
  const failedSteps = state.steps.filter((item) => item.status === 'failed');
  const blockedSteps = state.steps.filter((item) => item.status === 'blocked');
  if (blockedSteps.length) {
    markBlocked(state, blockedSteps.map((item) => item.actual).join('；'));
  } else if (failedAssertions.length || failedSteps.length) {
    const reason = failedAssertions.concat(failedSteps).map((item) => `${item.name || item.action}：${item.actual}`).join('；');
    markFailed(state, reason, 'bug');
  } else {
    state.status = 'passed';
    state.result_category = 'pass';
    state.actual_result = '执行步骤完成，客观断言通过，证据已保存。';
    state.conclusion = '通过';
  }
}

async function finishCase({ page, state, caseDir }) {
  state.ended_at = new Date().toISOString();
  state.screenshots.final = state.screenshots.final || await shot(page, caseDir, '03-assertion').catch(() => '');
  state.screenshots_flat = dedupe(Object.values(state.screenshots).filter((item) => typeof item === 'string'), (item) => item);
  if (!state.screenshots_flat.length && state.status !== 'blocked') {
    markFailed(state, '证据不完整：未保存任何截图。', 'automation_error');
  }
  if (state.status === 'failed' && !state.problem_description) {
    state.problem_description = buildProblemDescription(state);
  }
  writeJsonFile(path.join(caseDir, 'case-result.json'), state);
  writeTextFile(path.join(caseDir, 'case-report.md'), renderCaseReport(state));
  return state;
}

function markBlocked(state, reason) {
  state.status = 'blocked';
  state.result_category = 'blocked';
  state.actual_result = reason;
  state.conclusion = `阻塞：${reason}`;
  recordStep(state, '阻塞判定', '达到产品断言前的环境、登录、权限或自动化能力应可用。', reason, 'blocked');
}

function markFailed(state, reason, category = 'bug') {
  state.status = 'failed';
  state.result_category = category;
  state.actual_result = reason;
  state.conclusion = `失败：${reason}`;
  state.problem_description = buildProblemDescription(state);
}

function recordStep(state, action, expected, actual, status, screenshot = '') {
  state.steps.push({ action, expected, actual, status, screenshot });
}

function recordAssertion(state, name, expected, ok, actual) {
  state.assertions.push({ name, expected, actual, status: ok ? 'passed' : 'failed' });
}

function buildProblemDescription(state) {
  const screenshot = state.screenshots_flat?.at?.(-1) || Object.values(state.screenshots || {}).filter((item) => typeof item === 'string').at(-1) || '';
  return [
    `【Bug】${state.module || 'QBot'} - ${state.scenario}`,
    '',
    `测试场景：${state.scenario}`,
    '',
    `前置条件：${state.precondition || '无'}`,
    '',
    `测试数据：${state.test_data || '无'}`,
    '',
    `执行路径：${state.steps.map((step, index) => `${index + 1}. ${step.action} -> ${step.actual}`).join('；') || '见 case-report'}`,
    '',
    `预期结果：${state.expected_result || state.success_criteria || '见测试用例'}`,
    '',
    `实际结果：${state.actual_result || state.conclusion}`,
    '',
    '影响：该问题会影响普通用户完成当前功能路径或判断 Agent 回复是否可信。',
    '',
    `关键截图：${screenshot || '见用例证据目录'}`,
  ].join('\n');
}

async function clearUi(page) {
  for (let i = 0; i < 3; i += 1) await page.keyboard.press('Escape').catch(() => {});
  await page.waitForTimeout(300);
}

async function inspectPrecheck(page, outDir) {
  const screenshot = await shot(page, outDir, 'precheck-page-state');
  const text = await bodyText(page);
  return {
    screenshot,
    login_required: /登录工作台|OAuth2 登录|使用 Lingxi/.test(text) || await page.locator('[data-testid="auth-login"]').first().isVisible({ timeout: 500 }).catch(() => false),
    text_excerpt: text.slice(0, 1200),
  };
}

async function shot(page, dir, name) {
  const file = path.join(dir, `${name}.png`);
  ensureDir(path.dirname(file));
  await page.screenshot({ path: file, fullPage: true });
  return file;
}

async function bodyText(page) {
  return redact(await page.locator('body').innerText({ timeout: 8000 }).catch(() => ''));
}

function redact(text) {
  return String(text || '')
    .replace(/(Bearer\s+)[A-Za-z0-9._-]+/gi, '$1[REDACTED]')
    .replace(/([?&](?:token|access_token|refresh_token|client_secret|password)=)[^&#\s]+/gi, '$1[REDACTED]');
}

function forbiddenMatches(text) {
  return TECHNICAL_FAILURE_PATTERNS.map((pattern) => String(text || '').match(pattern)?.[0] || '').filter(Boolean);
}

function diffText(before, after) {
  const a = String(before || '');
  const b = String(after || '');
  let index = 0;
  while (index < a.length && index < b.length && a[index] === b[index]) index += 1;
  return b.slice(index).trim();
}

async function visible(locator, timeout = 1000) {
  return locator.waitFor({ state: 'visible', timeout }).then(() => true).catch(() => false);
}

async function loadPlaywright() {
  try {
    return await import('playwright');
  } catch (error) {
    return { error };
  }
}

async function findQbotPage(browser) {
  const deadline = Date.now() + 20000;
  while (Date.now() < deadline) {
    const pages = browser.contexts().flatMap((context) => context.pages());
    const candidates = pages.filter((page) => page.url() && page.url() !== 'about:blank');
    const qbot = candidates.find((page) => /qbot|localhost|127\.0\.0\.1|deepbank/i.test(`${page.url()} ${page.title()}`));
    if (qbot) {
      await qbot.waitForLoadState('domcontentloaded').catch(() => {});
      return qbot;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  return null;
}

function isEnvironmentBlocker(message) {
  return /CDP|登录页|未找到 QBot 页面|Playwright|权限|quarantine|无法连接|file chooser|Accessibility|辅助功能/i.test(String(message || ''));
}

function buildSyntheticResult({ outDir, testCase, index, status, resultCategory, reason }) {
  const caseDir = path.join(outDir, 'cases', `${String(index + 1).padStart(3, '0')}-${testCase.id}-${slugify(testCase.scenario)}`);
  ensureDir(caseDir);
  const result = {
    order: index + 1,
    id: testCase.id,
    sheet: testCase.sheet,
    row_number: testCase.row_number,
    title: testCase.scenario,
    module: testCase.module,
    submodule: testCase.submodule,
    priority: testCase.priority,
    scenario: testCase.scenario,
    precondition: testCase.precondition,
    test_data: testCase.test_data,
    expected_result: testCase.expected_result,
    status,
    result_category: resultCategory,
    actual_result: reason,
    conclusion: `${status}：${reason}`,
    problem_description: '',
    case_dir: caseDir,
    case_report: path.join(caseDir, 'case-report.md'),
    started_at: new Date().toISOString(),
    ended_at: new Date().toISOString(),
    steps: [{ action: '框架前置检查', expected: '自动化执行环境可用。', actual: reason, status }],
    assertions: [],
    screenshots: {},
    screenshots_flat: [],
    artifacts: {},
    llm_review: { status: 'not_needed' },
  };
  writeJsonFile(path.join(caseDir, 'case-result.json'), result);
  writeTextFile(path.join(caseDir, 'case-report.md'), renderCaseReport(result));
  return result;
}

function countResults(results) {
  return {
    total: results.length,
    passed: results.filter((item) => item.status === 'passed').length,
    failed: results.filter((item) => item.status === 'failed').length,
    blocked: results.filter((item) => item.status === 'blocked').length,
    needs_llm_review: results.filter((item) => item.status === 'needs_llm_review').length,
    other: results.filter((item) => !['passed', 'failed', 'blocked', 'needs_llm_review'].includes(item.status)).length,
  };
}

function statusFromResults(results) {
  const counts = countResults(results);
  if (counts.failed) return 'failed';
  if (counts.blocked) return 'blocked';
  if (counts.needs_llm_review) return 'needs_llm_review';
  return 'passed';
}

function buildSummary({ status, startedAt, outDir, casebook, resultExcel, profile, cdpUrl, results, reason = '', precheck = null }) {
  return {
    command: 'ui-agent-casebook-run',
    status,
    reason,
    out_dir: outDir,
    run_dir: outDir,
    casebook,
    result_excel: resultExcel,
    profile,
    cdp_url: cdpUrl,
    started_at: startedAt.toISOString(),
    ended_at: new Date().toISOString(),
    precheck,
    counts: countResults(results),
    results: results.map((result) => ({
      ...result,
      screenshots_flat: result.screenshots_flat?.length ? result.screenshots_flat : Object.values(result.screenshots || {}).filter((item) => typeof item === 'string'),
    })),
  };
}

function writeRunArtifacts(outDir, summary) {
  writeJsonFile(path.join(outDir, 'automation-run-summary.json'), summary);
  writeTextFile(path.join(outDir, 'automation-run-report.md'), renderRunReport(summary));
}

async function writeResultExcel({ python, root, casebook, outDir, summary, resultExcel }) {
  const summaryFile = path.join(outDir, 'automation-run-summary.json');
  summary.result_excel = resultExcel;
  writeRunArtifacts(outDir, summary);
  const result = runPython({
    python,
    args: [
      path.join(root, 'skills', 'qbot-execute-automation-tests', 'scripts', 'casebook_io.py'),
      'write-results',
      '--casebook',
      casebook,
      '--summary',
      summaryFile,
      '--output',
      resultExcel,
    ],
    cwd: root,
  });
  writeTextFile(path.join(outDir, 'logs', 'write-results.stdout.log'), result.stdout || '');
  writeTextFile(path.join(outDir, 'logs', 'write-results.stderr.log'), result.stderr || '');
  if (result.status !== 0) {
    summary.result_excel_error = result.stderr || result.error || 'unknown error';
    writeRunArtifacts(outDir, summary);
  }
}

function renderRunReport(summary) {
  const lines = [
    '# QBot Playwright UI Agent 自动化测试报告',
    '',
    `- 状态：${summary.status}`,
    `- 输出目录：${summary.run_dir}`,
    `- 结果Excel：${summary.result_excel}`,
    `- 用例源：${summary.casebook}`,
    `- Profile：${summary.profile}`,
    `- CDP：${summary.cdp_url}`,
    `- 开始时间：${summary.started_at}`,
    `- 结束时间：${summary.ended_at}`,
    '',
    '## 汇总',
    '',
    `- 总用例数：${summary.counts.total}`,
    `- 通过：${summary.counts.passed}`,
    `- 失败：${summary.counts.failed}`,
    `- 阻塞：${summary.counts.blocked}`,
    `- 需LLM复核：${summary.counts.needs_llm_review}`,
    '',
    '## 明细',
    '',
    '| 序号 | 用例ID | 模块 | 优先级 | 状态 | 分类 | 实际结果 | 证据 |',
    '| --- | --- | --- | --- | --- | --- | --- | --- |',
  ];
  for (const result of summary.results) {
    lines.push(`| ${result.order} | ${result.id} | ${esc(result.module)} | ${result.priority || ''} | ${result.status} | ${result.result_category || ''} | ${esc(clip(result.actual_result || result.conclusion || '', 180))} | ${result.case_report || result.case_dir || ''} |`);
  }
  const failed = summary.results.filter((item) => item.status === 'failed' && item.result_category === 'bug');
  if (failed.length) {
    lines.push('', '## Bug 候选', '');
    for (const item of failed) {
      lines.push(`### ${item.id} ${item.scenario}`, '', item.problem_description || item.actual_result || '断言失败', '');
    }
  }
  const blocked = summary.results.filter((item) => item.status === 'blocked');
  if (blocked.length) {
    lines.push('', '## 阻塞', '');
    for (const item of blocked) lines.push(`- ${item.id} ${item.scenario}: ${item.actual_result}`);
  }
  const review = summary.results.filter((item) => item.status === 'needs_llm_review');
  if (review.length) {
    lines.push('', '## 需 LLM 复核', '');
    for (const item of review) lines.push(`- ${item.id} ${item.scenario}: ${item.llm_review?.prompt_file || '见用例目录'}`);
  }
  return `${lines.join('\n')}\n`;
}

function renderCaseReport(result) {
  const lines = [
    `# ${result.id} ${result.scenario || result.title}`,
    '',
    '## 用例信息',
    '',
    `- 模块：${result.module || ''}`,
    `- 子功能：${result.submodule || ''}`,
    `- 优先级：${result.priority || ''}`,
    `- 测试场景：${result.scenario || ''}`,
    `- 前置条件：${result.precondition || ''}`,
    `- 测试数据：${result.test_data || ''}`,
    '',
    '## 预期结果',
    '',
    result.expected_result || '',
    '',
    '## 操作步骤与断言',
    '',
    '| 序号 | 操作/断言 | 预期 | 实际 | 状态 | 截图 |',
    '| --- | --- | --- | --- | --- | --- |',
    ...result.steps.map((step, index) => `| ${index + 1} | ${esc(step.action)} | ${esc(step.expected)} | ${esc(step.actual)} | ${step.status} | ${step.screenshot || ''} |`),
    ...result.assertions.map((item, index) => `| A${index + 1} | ${esc(item.name)} | ${esc(item.expected)} | ${esc(item.actual)} | ${item.status} |  |`),
    '',
    '## 实际结果',
    '',
    result.actual_result || '',
    '',
    '## 测试结论',
    '',
    result.conclusion || result.status,
    '',
    '## 测试证据',
    '',
    ...Object.entries(result.screenshots || {}).map(([key, value]) => `- ${key}：${typeof value === 'string' ? value : JSON.stringify(value)}`),
    ...Object.entries(result.artifacts || {}).map(([key, value]) => `- ${key}：${typeof value === 'string' ? value : JSON.stringify(value)}`),
    result.llm_review?.prompt_file ? `- LLM复核文件：${result.llm_review.prompt_file}` : '',
    '',
  ].filter((line) => line !== undefined);
  if (result.problem_description) lines.push('## 缺陷描述', '', result.problem_description, '');
  return `${lines.join('\n')}\n`;
}

function parseJsonFromText(text) {
  try {
    return JSON.parse(text);
  } catch {
    const match = String(text || '').match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}

function copyIfExists(src, dest) {
  if (fs.existsSync(src)) {
    ensureDir(path.dirname(dest));
    fs.copyFileSync(src, dest);
  }
}

function dedupe(items, keyFn) {
  const seen = new Set();
  const out = [];
  for (const item of items) {
    const key = keyFn(item);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

function clip(text, max = 1000) {
  const value = String(text || '');
  return value.length > max ? `${value.slice(0, max - 8)}...[截断]` : value;
}

function esc(text) {
  return String(text || '').replace(/\|/g, '/').replace(/\n/g, ' ');
}
