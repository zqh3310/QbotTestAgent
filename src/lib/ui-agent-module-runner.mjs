import fs from 'node:fs';
import path from 'node:path';
import { ensureDir, slugify, timestampForPath, writeJsonFile, writeTextFile } from './fs.mjs';
import { uploadAttachmentsInComposer } from './qbot-ui-attachments.mjs';
import { runUiAgentCommand } from './ui-agent-runner.mjs';

const DEFAULT_CDP_URL = 'http://127.0.0.1:9224';
const DEFAULT_TIMEOUT_MS = 90000;

const TECHNICAL_FAILURE_PATTERNS = [
  /模型未配置/,
  /cannot execute/i,
  /desktop-local/i,
  /remote control-plane/i,
  /SkillHub 地址未配置/,
  /技能[^。\n]{0,80}(暂时不可用|暂不可用|不可用|未就绪)/,
  /DEEPBANK_[A-Z0-9_]+/,
  /\btraceback\b/i,
  /\buncaught\b/i,
  /\bexception\b/i,
  /发生内部错误/,
  /系统内部错误/,
  /错误码/,
];

export async function runUiAgentModuleCommand({ options = {}, root = process.cwd() } = {}) {
  const outDir = path.resolve(options.out || path.join(root, 'outputs', `qbot-ui-agent-module-run-${timestampForPath()}`));
  const fixturesDir = path.resolve(options.fixtures || path.join(root, 'testflies'));
  const cdpUrl = String(options.cdp || process.env.QBOT_CDP_URL || DEFAULT_CDP_URL);
  const startedAt = new Date();
  ensureDir(outDir);
  ensureDir(fixturesDir);

  await runUiAgentCommand({
    mode: 'fixtures',
    options: { fixtures: fixturesDir, out: path.join(outDir, '_fixtures') },
    root,
  });

  const cases = loadOrBuildCases({ options, fixturesDir });
  writeJsonFile(path.join(outDir, 'module-test-cases.json'), cases);
  writeTextFile(path.join(outDir, 'module-test-cases.md'), renderTestCases(cases));

  const loaded = await loadPlaywright();
  if (loaded.error) {
    const report = blockedReport({ outDir, cdpUrl, startedAt, cases, reason: `Playwright 未安装或无法加载：${loaded.error.message}` });
    writeReports(outDir, report);
    return report;
  }

  let browser;
  try {
    browser = await loaded.chromium.connectOverCDP(cdpUrl);
    const page = await findQbotPage(browser);
    if (!page) {
      const report = blockedReport({ outDir, cdpUrl, startedAt, cases, reason: `已连接 CDP ${cdpUrl}，但没有找到 QBot 页面。` });
      writeReports(outDir, report);
      return report;
    }
    page.setDefaultTimeout(12000);
    page.setDefaultNavigationTimeout(30000);
    page.on('dialog', async (dialog) => dialog.dismiss().catch(() => {}));

    const precheck = await inspectPrecheck(page, outDir);
    if (precheck.login_required && options['allow-login-page'] !== true) {
      const report = blockedReport({
        outDir,
        cdpUrl,
        startedAt,
        cases,
        precheck,
        reason: 'QBot 当前停留在登录页，需要先完成 Lingxi OAuth2 登录。',
      });
      writeReports(outDir, report);
      return report;
    }

    const selectedCases = selectCases(cases, options);
    const results = [];
    for (let index = 0; index < selectedCases.length; index += 1) {
      const testCase = selectedCases[index];
      const caseDir = path.join(outDir, 'cases', `${String(index + 1).padStart(2, '0')}-${testCase.id}-${slugify(testCase.title)}`);
      ensureDir(caseDir);
      const result = await executeCase({ page, testCase, caseDir, order: index + 1, timeoutMs: Number(options['timeout-ms'] || DEFAULT_TIMEOUT_MS) });
      results.push(result);
      writeJsonFile(path.join(outDir, 'ui-agent-module-progress.json'), {
        updated_at: new Date().toISOString(),
        completed: results.length,
        total: selectedCases.length,
        results,
      });
    }

    const summary = summarize(results);
    const report = {
      status: summary.failed || summary.blocked ? 'failed' : 'pass',
      command: 'ui-agent-module-run',
      started_at: startedAt.toISOString(),
      ended_at: new Date().toISOString(),
      out_dir: outDir,
      cdp_url: cdpUrl,
      precheck,
      cases: selectedCases,
      results,
      summary,
    };
    writeReports(outDir, report);
    return report;
  } catch (error) {
    const report = blockedReport({ outDir, cdpUrl, startedAt, cases, reason: error.message });
    writeReports(outDir, report);
    return report;
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
}

function loadOrBuildCases({ options, fixturesDir }) {
  if (options.cases) {
    const file = path.resolve(String(options.cases));
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    return Array.isArray(data) ? data : data.cases || [];
  }
  return buildModuleTestCases(fixturesDir);
}

function buildModuleTestCases(fixturesDir) {
  const f = (name) => path.join(fixturesDir, name);
  return [
    navCase('MOD-SEARCH-001', '搜索', '任务搜索入口可打开并输入关键词', 'P0', '[data-testid="sidebar-search"]', ['搜索到', '新会话'], {
      search_text: '新会话',
      expected_result: '搜索弹层可打开，输入关键词后仍展示可理解的搜索界面或匹配任务。',
    }),
    {
      id: 'MOD-SIDEBAR-002',
      module: '左侧栏',
      title: '左侧栏可收起并可通过顶部按钮恢复展开',
      priority: 'P0',
      type: 'sidebar-collapse-expand',
      scenario: '用户误触收起侧栏后，仍能通过顶部展开按钮恢复完整导航。',
      expected_result: '收起后出现展开按钮；点击展开后【新建任务】、【专家】等导航恢复可见。',
    },
    navCase('MOD-EXPERT-003', '专家', '专家入口展示专家角色与技能页签', 'P0', '[data-testid="nav-experts"]', ['专家', '技能', '通用助手'], {
      extra_actions: [{ selector: '[data-testid="skills-tab"]', expected_keywords: ['技能'] }, { selector: '[data-testid="experts-tab"]', expected_keywords: ['专家'] }],
    }),
    {
      id: 'MOD-EXPERT-004',
      module: '专家',
      title: '创建专家入口提供清晰创建方式',
      priority: 'P1',
      type: 'dialog',
      scenario: '用户希望创建一个新的专家角色。',
      start_selector: '[data-testid="nav-experts"]',
      target_selector: '[data-testid="create-expert-top"]',
      expected_keywords: ['开始创建', '手动填表'],
      expected_result: '点击创建后出现创建方式选择，不应无响应或直接报错。',
    },
    navCase('MOD-CONNECTOR-005', '连接器', '连接器列表展示可用连接器与工具入口', 'P1', '[data-testid="nav-connectors"]', ['连接器', '添加连接器', '已接入']),
    {
      id: 'MOD-CONNECTOR-006',
      module: '连接器',
      title: '添加连接器与查看工具弹窗可打开并可关闭',
      priority: 'P1',
      type: 'connector-dialogs',
      scenario: '用户查看已有连接器能力，并尝试进入添加连接器表单。',
      expected_result: '添加连接器弹窗包含必要字段；查看工具弹窗可打开并关闭。',
    },
    {
      id: 'MOD-KNOWLEDGE-007',
      module: '知识',
      title: '知识模块页签可切换并展示状态说明',
      priority: 'P1',
      type: 'knowledge-tabs',
      scenario: '用户查看知识引擎、知识源、本体、任务成果等配置。',
      expected_result: '各页签均可切换，页面展示对应内容和状态说明，不暴露内部错误。',
    },
    {
      id: 'MOD-KNOWLEDGE-008',
      module: '知识',
      title: '自然语言补充编辑区应有明确保存方式',
      priority: 'P1',
      type: 'knowledge-save',
      scenario: '用户在知识引擎里填写自然语言补充后，需要知道如何保存。',
      expected_result: '自然语言补充编辑框附近应提供明确的【保存】或等价操作入口；否则用户无法确认内容是否生效。',
    },
    navCase('MOD-AUTOMATION-009', '自动化', '自动化入口有明确页面反馈', 'P2', '[data-testid="nav-auto"]', ['自动化'], {
      expected_result: '第一版可不深测自动化能力，但入口点击后应有明确页面或占位说明。',
    }),
    navCase('MOD-PROJECT-010', '项目', '项目入口展示项目列表或蓝图占位', 'P2', '[data-testid="nav-projects"]', ['项目', '蓝图'], {
      expected_result: '第一版可不深测项目能力，但入口点击后应有明确页面或占位说明。',
    }),
    {
      id: 'MOD-WELCOME-011',
      module: '新建任务',
      title: '新建任务欢迎页展示分类和快捷任务',
      priority: 'P0',
      type: 'welcome',
      scenario: '用户首次进入新建任务，需要看到清晰的任务分类和快捷入口。',
      expected_result: '页面展示日常办公、代码开发、设计创意等分类，以及文档处理/数据洞察等快捷任务。',
    },
    {
      id: 'MOD-COMPOSER-012',
      module: '会话输入区',
      title: '底部 Craft、技能、连应用、M4 菜单可打开',
      priority: 'P0',
      type: 'composer-menus',
      scenario: '用户在输入区切换工作方式、技能、连接应用和思考等级。',
      expected_result: '所有菜单均能打开，菜单项文案对普通用户可理解，不出现内部错误。',
    },
    {
      id: 'MOD-UPLOAD-013',
      module: '附件',
      title: '加号附件入口可选择文件并清晰展示附件',
      priority: 'P0',
      type: 'upload-only',
      scenario: '用户通过输入区右侧【+】上传本地文件。',
      attachments: [f('qbot-text-brief.txt')],
      expected_result: '文件选择后，输入区应清晰展示附件卡片、文件名和移除入口。',
    },
    {
      id: 'MOD-DOCUMENT-014',
      module: '附件',
      title: '统一附件入口应明确支持图片、文本、PDF 和 Office 文档',
      priority: 'P1',
      type: 'attachment-affordance',
      scenario: '用户需要上传不同类型资料时，通过统一附件入口理解支持范围。',
      expected_result: '输入区应提供清晰的统一附件入口，文案或辅助信息能表达支持图片、文本、PDF、Office 文档等类型。',
    },
    {
      id: 'MOD-CHAT-015',
      module: '核心对话',
      title: '普通问候应得到自然、相关、无技术噪音的回复',
      priority: 'P0',
      type: 'chat',
      scenario: '普通用户发起基础问候。',
      prompt: '你好，请用一句话说明你是谁，并告诉我今天是星期几。不要出现内部技术配置名。',
      required_keywords: ['星期'],
      expected_result: 'Agent 回复应自然回答用户问题，不夹带 SkillHub、环境变量、运行时错误等技术信息。',
    },
    {
      id: 'MOD-CHAT-016',
      module: '核心对话',
      title: '多轮上下文应能记住并回答业务数字',
      priority: 'P0',
      type: 'multi-turn-chat',
      scenario: '用户在一个会话里连续追问业务数字。',
      prompts: [
        '请记住这个业务场景：活动报名100人，到场70人，成交12单。请先复述这三个数字。',
        '刚才这个业务场景里，成交单数是多少？只回答数字和一句解释。',
      ],
      required_keywords: ['12'],
      expected_result: '第二轮回复应基于上一轮上下文回答 12 单，不要求用户重复背景。',
    },
    {
      id: 'MOD-CHAT-017',
      module: '核心对话',
      title: '长文本输入应能摘要并输出行动项',
      priority: 'P0',
      type: 'chat',
      scenario: '运营或产品用户粘贴较长材料，要求 QBot 提炼结论。',
      prompt: `请阅读下面长文本，输出：1. 三句话摘要；2. 三条行动项；3. 一个风险提醒。\n\n${longText()}`,
      required_keywords: ['行动'],
      expected_result: 'Agent 应输出摘要、行动项和风险提醒，回复不卡死、不截断、不暴露内部错误。',
    },
    {
      id: 'MOD-ATTACH-018',
      module: '附件',
      title: '上传 TXT 后 Agent 应能读取并提取字段',
      priority: 'P0',
      type: 'chat',
      scenario: '用户上传 TXT 文件，请 QBot 读取内容并提取关键字段。',
      prompt: '请读取我刚上传的 TXT 文件，提取项目名称、优先级和三个验收点。如果无法读取，请明确说明。',
      attachments: [f('qbot-text-brief.txt')],
      required_keywords: ['优先级'],
      expected_result: 'Agent 应基于附件内容回答项目名称、优先级和验收点；如果不能读取，应明确说明而不是假装读取。',
    },
    {
      id: 'MOD-ATTACH-019',
      module: '附件',
      title: '上传图片后 Agent 应明确说明是否支持视觉理解',
      priority: 'P1',
      type: 'chat',
      scenario: '用户上传图片或视觉材料，测试多模态支持边界。',
      prompt: '请读取我刚上传的图片，说明图中主要表达了什么。如果当前不支持图片理解，请明确说明不支持。',
      attachments: [f('qbot-image-test.png')],
      expected_keywords: ['图片'],
      expected_result: '若支持多模态，应说明图片内容；若不支持，应明确提示不支持，不能编造图片内容。',
    },
    {
      id: 'MOD-ARTIFACT-020',
      module: '成果',
      title: '成果面板可打开并可关闭',
      priority: 'P1',
      type: 'artifact-panel',
      scenario: '用户查看或收起任务成果面板。',
      expected_result: '点击成果入口后右侧成果面板出现；关闭后回到正常会话视图。',
    },
    {
      id: 'MOD-SESSION-021',
      module: '会话列表',
      title: '会话右键菜单展示重命名和删除入口',
      priority: 'P0',
      type: 'session-context',
      scenario: '用户需要管理会话名称或删除会话。',
      expected_result: '右键会话后应展示【重命名】和【删除】入口；本用例只验证入口，不执行删除。',
    },
    {
      id: 'MOD-SETTINGS-022',
      module: '个人设置',
      title: '个人设置入口展示主题、人设和用户画像',
      priority: 'P1',
      type: 'settings',
      scenario: '用户进入个人设置查看默认配置。',
      expected_result: '个人设置页面展示界面主题、角色人设、用户画像等配置项，不被导航控件遮挡。',
    },
    {
      id: 'MOD-SETTINGS-023',
      module: '个人设置',
      title: '左侧栏收起状态进入个人设置标题不应被展开按钮遮挡',
      priority: 'P1',
      type: 'settings-collapsed-overlap',
      scenario: '用户收起左侧栏后进入个人设置。',
      expected_result: '个人设置标题与顶部展开按钮没有重叠，标题完整可读。',
    },
    {
      id: 'MOD-UPDATE-024',
      module: '检查更新',
      title: '检查更新入口展示版本和更新状态',
      priority: 'P2',
      type: 'check-updates',
      scenario: '用户从左下用户菜单检查 QBot 更新。',
      expected_result: '检查更新页面应展示当前版本、更新状态或明确的检查结果。',
    },
  ];
}

function navCase(id, module, title, priority, selector, expectedKeywords, extra = {}) {
  return {
    id,
    module,
    title,
    priority,
    type: 'navigation',
    scenario: extra.scenario || `用户进入${module}模块，确认入口反馈是否清晰。`,
    target_selector: selector,
    expected_keywords: expectedKeywords,
    expected_result: extra.expected_result || `点击后应展示${module}相关页面内容，不出现内部错误。`,
    ...extra,
  };
}

async function executeCase({ page, testCase, caseDir, order, timeoutMs }) {
  const startedAt = new Date();
  const state = {
    order,
    id: testCase.id,
    title: testCase.title,
    module: testCase.module,
    priority: testCase.priority,
    scenario: testCase.scenario,
    expected_result: testCase.expected_result,
    status: 'failed',
    conclusion: '',
    actual_result: '',
    problem_description: '',
    case_dir: caseDir,
    started_at: startedAt.toISOString(),
    ended_at: '',
    steps: [],
    screenshots: {},
    artifacts: {},
  };
  try {
    await clearUi(page);
    state.screenshots.before = await shot(page, caseDir, '01-before');
    switch (testCase.type) {
      case 'navigation':
        await runNavigation(page, testCase, state, caseDir);
        break;
      case 'sidebar-collapse-expand':
        await runSidebarCollapseExpand(page, state, caseDir);
        break;
      case 'dialog':
        await runDialog(page, testCase, state, caseDir);
        break;
      case 'connector-dialogs':
        await runConnectorDialogs(page, state, caseDir);
        break;
      case 'knowledge-tabs':
        await runKnowledgeTabs(page, state, caseDir);
        break;
      case 'knowledge-save':
        await runKnowledgeSave(page, state, caseDir);
        break;
      case 'welcome':
        await runWelcome(page, state, caseDir);
        break;
      case 'composer-menus':
        await runComposerMenus(page, state, caseDir);
        break;
      case 'upload-only':
        await runUploadOnly(page, testCase, state, caseDir);
        break;
      case 'attachment-affordance':
        await runAttachmentAffordance(page, state, caseDir);
        break;
      case 'chat':
        await runChat(page, testCase, state, caseDir, timeoutMs);
        break;
      case 'multi-turn-chat':
        await runMultiTurnChat(page, testCase, state, caseDir, timeoutMs);
        break;
      case 'artifact-panel':
        await runArtifactPanel(page, state, caseDir);
        break;
      case 'session-context':
        await runSessionContext(page, state, caseDir);
        break;
      case 'settings':
        await runSettings(page, state, caseDir);
        break;
      case 'settings-collapsed-overlap':
        await runSettingsCollapsedOverlap(page, state, caseDir);
        break;
      case 'check-updates':
        await runCheckUpdates(page, state, caseDir);
        break;
      default:
        throw new Error(`未知用例类型：${testCase.type}`);
    }
  } catch (error) {
    state.status = 'failed';
    state.actual_result = error.message;
    state.conclusion = `执行异常：${error.message}`;
    state.problem_description = buildProblemDescription(state, error.message);
    state.screenshots.error = await shot(page, caseDir, '99-error').catch((err) => ({ error: err.message }));
  } finally {
    state.ended_at = new Date().toISOString();
    state.artifacts.page_text = path.join(caseDir, 'page-text.txt');
    writeTextFile(state.artifacts.page_text, await bodyText(page).catch(() => ''));
    writeJsonFile(path.join(caseDir, 'case-result.json'), state);
    writeTextFile(path.join(caseDir, 'case-report.md'), renderCaseReport(state));
    await clearUi(page).catch(() => {});
    await ensureSidebarExpanded(page).catch(() => {});
  }
  return state;
}

async function runNavigation(page, testCase, state, caseDir) {
  await ensureSidebarExpanded(page, state);
  await click(page, testCase.target_selector, `点击【${testCase.module}】入口`, state);
  if (testCase.search_text) await typeIntoFirstVisible(page, ['input[placeholder*="搜索"]', 'input'], testCase.search_text, '输入搜索关键词', state);
  for (const action of testCase.extra_actions || []) {
    await click(page, action.selector, `点击附加入口 ${action.selector}`, state);
    await waitForKeywords(page, action.expected_keywords || [], 4000).catch(() => {});
    await assertKeywords(page, action.expected_keywords || [], state, `附加入口 ${action.selector}`);
  }
  const landed = await waitForKeywords(page, testCase.expected_keywords || [], 5000).catch(() => false);
  if (!landed && testCase.target_selector) {
    const locator = page.locator(testCase.target_selector).first();
    await locator.evaluate((el) => el.click()).catch(() => {});
    recordStep(state, '二次点击入口', '首次点击未进入目标页时应重新触发入口', `已对 ${testCase.target_selector} 执行 DOM click 兜底`, 'passed');
    await waitForKeywords(page, testCase.expected_keywords || [], 5000).catch(() => false);
  }
  const screenshot = await shot(page, caseDir, '02-after-navigation');
  state.screenshots.after_navigation = screenshot;
  await assertKeywords(page, testCase.expected_keywords || [], state, '页面关键词检查');
  await finalizeFromAssertions(page, state, '入口可点击且页面有可观察反馈。');
}

async function runSidebarCollapseExpand(page, state, caseDir) {
  await ensureSidebarExpanded(page, state);
  await click(page, '[data-testid="sidebar-collapse"]', '点击收起左侧栏', state);
  state.screenshots.collapsed = await shot(page, caseDir, '02-collapsed');
  const expandVisible = await visible(page.locator('[data-testid="sidebar-expand"]').first(), 2500);
  const collapseStillVisible = await visible(page.locator('[data-testid="sidebar-collapse"]').first(), 800);
  recordStep(
    state,
    '检查恢复按钮',
    '收起后应出现可恢复侧栏的顶部按钮',
    expandVisible ? '已看到 sidebar-expand 展开按钮' : collapseStillVisible ? '未看到 sidebar-expand，但仍可见 sidebar-collapse 恢复/切换按钮' : '未看到可恢复按钮',
    expandVisible || collapseStillVisible ? 'passed' : 'failed',
    state.screenshots.collapsed,
  );
  await click(page, expandVisible ? '[data-testid="sidebar-expand"]' : '[data-testid="sidebar-collapse"]', '点击恢复左侧栏', state);
  state.screenshots.expanded = await shot(page, caseDir, '03-expanded');
  const navVisible = await visible(page.locator('[data-testid="nav-new-task"]').first(), 2500);
  recordStep(state, '检查导航恢复', '展开后【新建任务】应可见', navVisible ? '【新建任务】已恢复可见' : '【新建任务】未恢复', navVisible ? 'passed' : 'failed', state.screenshots.expanded);
  await finalizeFromAssertions(page, state, '左侧栏收起/展开路径可用。');
}

async function runDialog(page, testCase, state, caseDir) {
  await ensureSidebarExpanded(page, state);
  if (testCase.start_selector) await click(page, testCase.start_selector, '进入前置页面', state);
  await click(page, testCase.target_selector, `点击【${testCase.title}】目标入口`, state);
  state.screenshots.dialog = await shot(page, caseDir, '02-dialog');
  await assertKeywords(page, testCase.expected_keywords || [], state, '弹窗关键词检查');
  await page.keyboard.press('Escape').catch(() => {});
  await finalizeFromAssertions(page, state, '弹窗可打开且内容可理解。');
}

async function runConnectorDialogs(page, state, caseDir) {
  await ensureSidebarExpanded(page, state);
  await click(page, '[data-testid="nav-connectors"]', '进入连接器页面', state);
  await click(page, 'button:has-text("添加连接器")', '点击【添加连接器】', state);
  state.screenshots.add_connector = await shot(page, caseDir, '02-add-connector');
  await assertKeywords(page, ['添加', '取消'], state, '添加连接器弹窗检查');
  await page.keyboard.press('Escape').catch(() => {});
  await click(page, '[data-testid^="connector-details-trigger-"]', '点击第一个【查看工具】', state);
  state.screenshots.connector_detail = await shot(page, caseDir, '03-connector-detail');
  await assertAnyKeyword(page, ['可见工具', '暂无可公开展示的工具', '上游可用工具', '本次会话可用工具'], state, '查看工具弹窗检查');
  await page.keyboard.press('Escape').catch(() => {});
  await finalizeFromAssertions(page, state, '连接器添加和查看工具入口均有反馈。');
}

async function runKnowledgeTabs(page, state, caseDir) {
  await ensureSidebarExpanded(page, state);
  await click(page, '[data-testid="nav-more"]', '进入知识页面', state);
  const tabs = [
    ['知识引擎', ['总开关', '自然语言补充']],
    ['知识源', ['知识源']],
    ['本体', ['本体']],
    ['任务成果', ['任务成果']],
  ];
  for (let index = 0; index < tabs.length; index += 1) {
    const [tab, keywords] = tabs[index];
    await click(page, `button:has-text("${tab}")`, `切换【${tab}】页签`, state);
    const screenshot = await shot(page, caseDir, `0${index + 2}-${slugify(tab)}`);
    state.screenshots[`tab_${index + 1}`] = screenshot;
    await assertKeywords(page, keywords, state, `${tab} 页签检查`);
  }
  await finalizeFromAssertions(page, state, '知识模块页签切换正常。');
}

async function runKnowledgeSave(page, state, caseDir) {
  await ensureSidebarExpanded(page, state);
  await click(page, '[data-testid="nav-more"]', '进入知识页面', state);
  await click(page, 'button:has-text("知识引擎")', '切换到知识引擎页签', state);
  const textarea = page.locator('textarea').first();
  const hasTextarea = await visible(textarea, 2500);
  state.screenshots.editor = await shot(page, caseDir, '02-natural-language-editor');
  recordStep(state, '检查自然语言补充编辑框', '应存在可编辑输入框', hasTextarea ? '已找到编辑框' : '未找到编辑框', hasTextarea ? 'passed' : 'failed', state.screenshots.editor);
  const hasSave = await page.getByRole('button', { name: /保存|应用|提交|确认/ }).first().isVisible({ timeout: 1200 }).catch(() => false)
    || await page.locator('button:has-text("保存"), button:has-text("应用"), button:has-text("提交"), button:has-text("确认")').first().isVisible({ timeout: 1200 }).catch(() => false);
  recordStep(state, '检查保存入口', '编辑区附近应有明确保存或应用入口', hasSave ? '检测到保存/应用类按钮' : '未检测到保存/应用类按钮', hasSave ? 'passed' : 'failed', state.screenshots.editor);
  await finalizeFromAssertions(page, state, hasSave ? '自然语言补充区有明确保存方式。' : '自然语言补充区缺少明确保存方式。');
}

async function runWelcome(page, state, caseDir) {
  await openNewTask(page, state);
  state.screenshots.welcome = await shot(page, caseDir, '02-welcome');
  await assertKeywords(page, ['日常办公', '代码开发', '设计创意'], state, '欢迎页分类检查');
  await assertAnyKeyword(page, ['文档处理', '数据洞察'], state, '欢迎页快捷任务检查');
  await finalizeFromAssertions(page, state, '新建任务欢迎页展示核心分类。');
}

async function runComposerMenus(page, state, caseDir) {
  await openNewTask(page, state);
  const menus = [
    ['Craft 菜单', 'button:has-text("Craft"), button:has-text("Ask"), button:has-text("Plan")', ['Craft', 'Ask', 'Plan']],
    ['技能菜单', '[data-testid="composer-skills-menu"]', ['禁用', '自动', '手动']],
    ['连应用菜单', '[data-testid="composer-connectors-menu"]', ['平台可用', '已接入']],
    ['M4 菜单', '[data-testid="composer-safety-level-menu"]', ['M4']],
  ];
  for (let index = 0; index < menus.length; index += 1) {
    const [name, selector, keywords] = menus[index];
    await click(page, selector, `打开${name}`, state);
    const screenshot = await shot(page, caseDir, `0${index + 2}-${slugify(name)}`);
    state.screenshots[`menu_${index + 1}`] = screenshot;
    await assertKeywords(page, keywords, state, `${name}内容检查`);
    await page.keyboard.press('Escape').catch(() => {});
  }
  await finalizeFromAssertions(page, state, '输入区核心菜单均可打开。');
}

async function runUploadOnly(page, testCase, state, caseDir) {
  await openNewTask(page, state);
  const upload = await uploadFiles(page, testCase.attachments || [], state);
  state.screenshots.after_upload = await shot(page, caseDir, '02-after-upload');
  state.artifacts.upload = upload;
  if (upload.status === 'blocked') {
    recordStep(
      state,
      '检查附件展示',
      '上传未被环境阻塞时才继续检查附件卡片',
      '上传步骤已被系统权限或环境条件阻塞，本轮不继续判定产品 UI 展示。',
      'blocked',
      state.screenshots.after_upload,
    );
    await finalizeFromAssertions(page, state, '附件上传被环境阻塞。');
    return;
  }
  const visibleNames = upload.visible_names || [];
  const expectedNames = upload.expected_names || [];
  const clear = upload.status === 'passed' && expectedNames.length && visibleNames.length === expectedNames.length;
  recordStep(
    state,
    '检查附件展示',
    '上传后应显示文件名和移除入口',
    clear ? `已显示文件名：${visibleNames.join(', ')}` : `上传状态：${upload.status}；可见文件名：${visibleNames.join(', ') || '无'}`,
    clear ? 'passed' : 'failed',
    state.screenshots.after_upload,
  );
  await finalizeFromAssertions(page, state, clear ? '附件上传后展示清晰。' : '附件上传后的文件名展示不清晰或无法确认。');
}

async function runAttachmentAffordance(page, state, caseDir) {
  await openNewTask(page, state);
  const button = page.locator('[data-testid="composer-add-attachment"]').first();
  if (!(await visible(button, 3000))) {
    recordStep(state, '检查统一附件入口', '输入区应存在统一附件入口', '未找到统一附件入口', 'failed');
    await finalizeFromAssertions(page, state, '统一附件入口可见。');
    return;
  }
  const label = await button.evaluate((el) => [
    el.textContent || '',
    el.getAttribute('aria-label') || '',
    el.getAttribute('title') || '',
  ].join(' ')).catch(() => '');
  await button.hover({ force: true }).catch(() => {});
  await page.waitForTimeout(800);
  state.screenshots.after_hover = await shot(page, caseDir, '02-attachment-affordance');
  const text = await bodyText(page);
  const surface = `${label}\n${text}`;
  for (const keyword of ['附件', '图片', '文本', 'PDF', 'Office']) {
    const ok = new RegExp(keyword, 'i').test(surface);
    recordStep(
      state,
      `检查附件入口文案：${keyword}`,
      `统一附件入口应表达支持范围，包含或可感知「${keyword}」`,
      ok ? `已检测到「${keyword}」` : `未检测到「${keyword}」`,
      ok ? 'passed' : 'failed',
      state.screenshots.after_hover,
    );
  }
  await finalizeFromAssertions(page, state, '统一附件入口支持范围表达清晰。');
}

async function runChat(page, testCase, state, caseDir, timeoutMs) {
  await openNewTask(page, state);
  if (testCase.attachments?.length) {
    state.artifacts.upload = await uploadFiles(page, testCase.attachments, state);
    state.screenshots.after_upload = await shot(page, caseDir, '02-after-upload');
    if (state.artifacts.upload.status !== 'passed') {
      await finalizeFromAssertions(page, state, '附件上传完成后再继续 Agent 回复校验。');
      return;
    }
  }
  const before = await bodyText(page);
  await fillComposer(page, testCase.prompt, state);
  state.screenshots.after_fill = await shot(page, caseDir, '03-after-fill');
  await send(page, state);
  state.screenshots.after_send = await shot(page, caseDir, '04-after-send');
  const reply = await waitForReply(page, before, timeoutMs);
  state.screenshots.after_reply = await shot(page, caseDir, '05-after-reply');
  state.artifacts.transcript = path.join(caseDir, 'transcript.txt');
  state.artifacts.reply_delta = path.join(caseDir, 'reply-delta.txt');
  writeTextFile(state.artifacts.transcript, reply.fullText);
  writeTextFile(state.artifacts.reply_delta, reply.deltaText);
  evaluateReply(testCase, reply, state);
  await finalizeFromAssertions(page, state, 'Agent 回复满足断言。');
}

async function runMultiTurnChat(page, testCase, state, caseDir, timeoutMs) {
  await openNewTask(page, state);
  let previous = await bodyText(page);
  const replies = [];
  for (let index = 0; index < testCase.prompts.length; index += 1) {
    await fillComposer(page, testCase.prompts[index], state, `输入第 ${index + 1} 轮问题`);
    state.screenshots[`round_${index + 1}_fill`] = await shot(page, caseDir, `0${index * 3 + 2}-round-${index + 1}-fill`);
    await send(page, state, `发送第 ${index + 1} 轮问题`);
    state.screenshots[`round_${index + 1}_send`] = await shot(page, caseDir, `0${index * 3 + 3}-round-${index + 1}-send`);
    const reply = await waitForReply(page, previous, timeoutMs);
    replies.push(reply);
    previous = reply.fullText;
    state.screenshots[`round_${index + 1}_reply`] = await shot(page, caseDir, `0${index * 3 + 4}-round-${index + 1}-reply`);
  }
  const combined = replies.map((reply, index) => `--- 第 ${index + 1} 轮 ---\n${reply.deltaText}`).join('\n\n');
  state.artifacts.transcript = path.join(caseDir, 'transcript.txt');
  state.artifacts.reply_delta = path.join(caseDir, 'reply-delta.txt');
  writeTextFile(state.artifacts.transcript, previous);
  writeTextFile(state.artifacts.reply_delta, combined);
  evaluateReply(testCase, { fullText: previous, deltaText: combined }, state);
  await finalizeFromAssertions(page, state, '多轮上下文回复满足断言。');
}

async function runArtifactPanel(page, state, caseDir) {
  await openNewTask(page, state);
  await click(page, '[data-testid="artifact-panel-open"]', '点击成果面板入口', state);
  state.screenshots.opened = await shot(page, caseDir, '02-artifact-opened');
  await assertAnyKeyword(page, ['概览', '成果'], state, '成果面板打开检查');
  await click(page, '[data-testid="artifact-panel-close"]', '点击关闭成果面板', state);
  state.screenshots.closed = await shot(page, caseDir, '03-artifact-closed');
  await finalizeFromAssertions(page, state, '成果面板可打开并关闭。');
}

async function runSessionContext(page, state, caseDir) {
  await ensureSidebarExpanded(page, state);
  const item = page.locator('[data-testid^="session-item-"]').first();
  if (!(await visible(item, 3000))) throw new Error('未找到可右键的会话项。');
  await item.click({ button: 'right', force: true });
  recordStep(state, '右键会话项', '应打开会话管理菜单', '已执行右键操作', 'passed');
  await page.waitForTimeout(800);
  state.screenshots.context_menu = await shot(page, caseDir, '02-session-context-menu');
  await assertKeywords(page, ['重命名', '删除'], state, '会话右键菜单检查');
  await page.keyboard.press('Escape').catch(() => {});
  await finalizeFromAssertions(page, state, '会话右键菜单入口可见。');
}

async function runSettings(page, state, caseDir) {
  await openSettings(page, state);
  state.screenshots.settings = await shot(page, caseDir, '02-settings');
  await assertKeywords(page, ['个人设置', '界面主题', '角色人设', '用户画像'], state, '个人设置内容检查');
  const overlap = await settingsHeaderOverlap(page);
  recordStep(state, '检查标题遮挡', '个人设置标题不应被顶部按钮遮挡', overlap ? '检测到标题与按钮区域重叠' : '未检测到标题遮挡', overlap ? 'failed' : 'passed', state.screenshots.settings);
  await finalizeFromAssertions(page, state, overlap ? '个人设置标题存在遮挡风险。' : '个人设置页面展示正常。');
}

async function runSettingsCollapsedOverlap(page, state, caseDir) {
  try {
    await openSettings(page, state);
    await click(page, '[data-testid="sidebar-collapse"]', '在个人设置页收起左侧栏', state);
    state.screenshots.collapsed_settings = await shot(page, caseDir, '02-collapsed-settings');
    await assertKeywords(page, ['个人设置'], state, '个人设置标题检查');
    const overlap = await settingsHeaderOverlap(page);
    recordStep(state, '检查收起状态标题遮挡', '标题与展开按钮不能重叠', overlap ? '检测到标题与展开按钮重叠' : '未检测到重叠', overlap ? 'failed' : 'passed', state.screenshots.collapsed_settings);
    await finalizeFromAssertions(page, state, overlap ? '左侧栏收起状态下个人设置标题被遮挡。' : '收起状态个人设置标题无遮挡。');
  } finally {
    await ensureSidebarExpanded(page, state);
  }
}

async function runCheckUpdates(page, state, caseDir) {
  await ensureSidebarExpanded(page, state);
  await click(page, '[data-testid="nav-settings-menu"]', '打开左下用户菜单', state);
  await clickAny(page, ['[data-testid="nav-check-updates"]', 'text=检查更新'], '点击【检查更新】', state);
  state.screenshots.check_updates = await shot(page, caseDir, '02-check-updates');
  await assertAnyKeyword(page, ['检查更新', '版本', '更新'], state, '检查更新页面内容');
  await finalizeFromAssertions(page, state, '检查更新页面有可观察反馈。');
}

async function openNewTask(page, state) {
  await clearUi(page);
  await ensureSidebarExpanded(page, state);
  await click(page, '[data-testid="nav-new-task"]', '点击【新建任务】', state);
  const composer = page.locator('[data-testid="composer-input"], .aui-composer-input').first();
  if (!(await visible(composer, 5000))) throw new Error('点击【新建任务】后未找到会话输入框。');
  await removeAttachments(page, state);
}

async function openSettings(page, state, { allowCollapsed = false } = {}) {
  if (!allowCollapsed) await ensureSidebarExpanded(page, state);
  const menu = page.locator('[data-testid="nav-settings-menu"]').first();
  if (!(await visible(menu, 2500)) && allowCollapsed) {
    await ensureSidebarExpanded(page, state);
  }
  await click(page, '[data-testid="nav-settings-menu"]', '打开左下用户菜单', state);
  await click(page, '[data-testid="nav-settings"]', '点击【个人设置】', state);
  await page.waitForTimeout(1000);
}

async function ensureSidebarExpanded(page, state = null) {
  if (await isSidebarActuallyExpanded(page)) return;
  const expand = page.locator('[data-testid="sidebar-expand"]').first();
  if (await visible(expand, 1500)) {
    await expand.click({ force: true }).catch(async () => expand.evaluate((el) => el.click()));
    if (state) recordStep(state, '展开左侧栏', '导航收起时应能自动展开', '已点击顶部展开按钮', 'passed');
    await waitForSidebarExpanded(page, 3000);
    return;
  }
  const collapse = page.locator('[data-testid="sidebar-collapse"]').first();
  if (await visible(collapse, 800)) {
    const rect = await collapse.boundingBox().catch(() => null);
    if (rect && rect.x < 0) {
      await collapse.evaluate((el) => el.click()).catch(() => {});
      if (state) recordStep(state, '展开左侧栏', '导航收起时应能自动展开', '已尝试点击侧栏切换按钮', 'passed');
      await waitForSidebarExpanded(page, 3000);
    }
  }
}

async function isSidebarActuallyExpanded(page) {
  return page.evaluate(() => {
    const sidebar = document.querySelector('[data-testid="qbot-sidebar"]');
    const nav = document.querySelector('[data-testid="nav-new-task"]');
    const sr = sidebar?.getBoundingClientRect();
    const nr = nav?.getBoundingClientRect();
    return Boolean(sr && sr.width > 120 && nr && nr.left >= 0 && nr.width > 80);
  }).catch(() => false);
}

async function waitForSidebarExpanded(page, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await isSidebarActuallyExpanded(page)) return true;
    await page.waitForTimeout(200);
  }
  return false;
}

async function clearUi(page) {
  for (let i = 0; i < 3; i += 1) await page.keyboard.press('Escape').catch(() => {});
  await page.waitForTimeout(300);
}

async function removeAttachments(page, state) {
  const remove = page.locator('button:has-text("Remove file"), button[aria-label*="Remove"], button[aria-label*="移除"]').first();
  for (let i = 0; i < 3; i += 1) {
    if (!(await visible(remove, 300))) break;
    await remove.click({ force: true }).catch(() => {});
    if (state) recordStep(state, '清理输入区已有附件', '新用例开始前输入区不应残留附件', '已移除一个已有附件', 'passed');
    await page.waitForTimeout(300);
  }
}

async function uploadFiles(page, files, state) {
  const result = await uploadAttachmentsInComposer(page, files);
  const status = result.status === 'passed' ? 'passed' : result.status === 'blocked' ? 'blocked' : 'failed';
  recordStep(
    state,
    '上传附件',
    '文件选择后应显示文件名和移除入口；如受系统权限限制应明确阻塞原因',
    [
      result.reason,
      result.expected_names?.length ? `期望文件：${result.expected_names.join(', ')}` : '',
      result.visible_names?.length ? `页面可见文件：${result.visible_names.join(', ')}` : '',
      typeof result.has_remove === 'boolean' ? `移除入口：${result.has_remove ? '有' : '无'}` : '',
    ].filter(Boolean).join('；'),
    status,
  );
  return result;
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
  recordStep(state, action, '输入框应可输入完整测试内容', text.slice(0, 180), 'passed');
}

async function send(page, state, action = '点击发送') {
  await click(page, '[data-testid="composer-send"]', action, state);
}

async function waitForReply(page, beforeText, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  let last = '';
  let stable = 0;
  while (Date.now() < deadline) {
    const fullText = await bodyText(page);
    const deltaText = diffText(beforeText, fullText);
    const hasDelta = deltaText.trim().length > 15 || fullText.length > beforeText.length + 15;
    const generating = /思考中|生成中|正在|Stop generating/i.test(fullText) || await page.locator('button[aria-label*="Stop"], button[aria-label*="停止"], button:has-text("停止")').first().isVisible({ timeout: 200 }).catch(() => false);
    if (hasDelta && forbiddenMatches(deltaText || fullText).length) return { fullText, deltaText };
    if (hasDelta && !generating) {
      if (fullText === last) stable += 1;
      else {
        last = fullText;
        stable = 0;
      }
      if (stable >= 2) return { fullText, deltaText };
    }
    await page.waitForTimeout(1000);
  }
  throw new Error(`等待 Agent 回复超时（${timeoutMs}ms）。`);
}

function evaluateReply(testCase, reply, state) {
  const text = `${reply.deltaText}\n${reply.fullText}`;
  const forbidden = forbiddenMatches(reply.deltaText || reply.fullText);
  recordStep(state, '检查回复有效性', 'Agent 应产生有效回复', reply.deltaText.trim().length > 15 ? '已检测到有效回复增量' : '回复过短或未检测到有效增量', reply.deltaText.trim().length > 15 ? 'passed' : 'failed');
  recordStep(state, '检查技术噪音', '回复不应暴露内部配置、运行时错误或技术异常', forbidden.length ? `检测到：${forbidden.join(', ')}` : '未检测到技术噪音', forbidden.length ? 'failed' : 'passed');
  for (const keyword of testCase.required_keywords || []) {
    recordStep(state, `检查必需关键词：${keyword}`, `回复必须包含 ${keyword}`, text.includes(keyword) ? `已包含 ${keyword}` : `未包含 ${keyword}`, text.includes(keyword) ? 'passed' : 'failed');
  }
  for (const keyword of testCase.expected_keywords || []) {
    recordStep(state, `检查期望关键词：${keyword}`, `回复最好包含 ${keyword}`, text.includes(keyword) ? `已包含 ${keyword}` : `未包含 ${keyword}`, text.includes(keyword) ? 'passed' : 'failed');
  }
}

async function click(page, selector, action, state) {
  const locator = page.locator(selector).first();
  await clickLocator(locator, action, state, selector);
  await page.waitForTimeout(1200);
}

async function clickAny(page, selectors, action, state) {
  for (const selector of selectors) {
    const locator = selector.startsWith('text=')
      ? page.getByText(selector.slice(5), { exact: true }).first()
      : page.locator(selector).first();
    if (await visible(locator, 1200)) {
      await clickLocator(locator, action, state, selector);
      await page.waitForTimeout(1200);
      return;
    }
  }
  recordStep(state, action, `应能点击任一入口：${selectors.join(' / ')}`, '入口不可见', 'failed');
  throw new Error(`未找到入口：${selectors.join(' / ')}`);
}

async function clickLocator(locator, action, state, selector = '') {
  if (!(await visible(locator, 5000))) {
    recordStep(state, action, `入口应可见：${selector || action}`, '入口不可见', 'failed');
    throw new Error(`未找到入口：${selector || action}`);
  }
  try {
    await locator.click({ force: true });
    recordStep(state, action, `入口应可点击：${selector || action}`, '已点击', 'passed');
  } catch (error) {
    await locator.evaluate((el) => el.click());
    recordStep(state, action, `入口应可点击：${selector || action}`, `常规点击失败，已使用 DOM click 兜底：${error.message.split('\n')[0]}`, 'passed');
  }
}

async function typeIntoFirstVisible(page, selectors, text, action, state) {
  for (const selector of selectors) {
    const locator = page.locator(selector).first();
    if (await visible(locator, 800)) {
      await locator.fill(text).catch(async () => {
        await locator.click({ force: true });
        await page.keyboard.insertText(text);
      });
      recordStep(state, action, '输入框应可输入关键词', text, 'passed');
      return;
    }
  }
  recordStep(state, action, '应存在可输入的搜索框', '未找到可输入控件', 'failed');
}

async function assertKeywords(page, keywords, state, name) {
  const text = await bodyText(page);
  for (const keyword of keywords) {
    const ok = text.includes(keyword);
    recordStep(state, name, `页面应包含「${keyword}」`, ok ? `已检测到「${keyword}」` : `未检测到「${keyword}」`, ok ? 'passed' : 'failed');
  }
  const forbidden = forbiddenMatches(text);
  if (forbidden.length) recordStep(state, '检查页面技术错误', '页面不应暴露内部错误', `检测到：${forbidden.join(', ')}`, 'failed');
}

async function waitForKeywords(page, keywords, timeoutMs) {
  if (!keywords.length) return true;
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const text = await bodyText(page);
    if (keywords.every((keyword) => text.includes(keyword))) return true;
    await page.waitForTimeout(300);
  }
  return false;
}

async function assertAnyKeyword(page, keywords, state, name) {
  const text = await bodyText(page);
  const hit = keywords.find((keyword) => text.includes(keyword));
  recordStep(state, name, `页面应至少包含：${keywords.join(' / ')}`, hit ? `已检测到「${hit}」` : '未检测到任一关键词', hit ? 'passed' : 'failed');
}

async function finalizeFromAssertions(page, state, passMessage) {
  const failedSteps = state.steps.filter((step) => step.status === 'failed');
  const blockedSteps = state.steps.filter((step) => step.status === 'blocked');
  const text = await bodyText(page).catch(() => '');
  if (blockedSteps.length) {
    state.status = 'blocked';
    state.actual_result = blockedSteps.map((step) => step.actual).join('；');
    state.conclusion = `阻塞：${state.actual_result}`;
  } else if (failedSteps.length) {
    state.status = 'failed';
    state.actual_result = failedSteps.map((step) => `${step.action}：${step.actual}`).join('；');
    state.conclusion = `失败：${state.actual_result}`;
    state.problem_description = buildProblemDescription(state, state.actual_result);
  } else {
    state.status = 'passed';
    state.actual_result = passMessage;
    state.conclusion = `通过：${passMessage}`;
  }
  const forbidden = forbiddenMatches(text);
  if (forbidden.length && state.status === 'passed') {
    state.status = 'failed';
    state.actual_result = `页面或回复出现技术噪音：${forbidden.join(', ')}`;
    state.conclusion = `失败：${state.actual_result}`;
    state.problem_description = buildProblemDescription(state, state.actual_result);
  }
}

function recordStep(state, action, expected, actual, status, screenshot = '') {
  state.steps.push({ action, expected, actual, status, screenshot });
}

async function inspectPrecheck(page, outDir) {
  const screenshot = await shot(page, outDir, 'precheck-page-state');
  const text = await bodyText(page);
  return {
    screenshot,
    login_required: /登录工作台|OAuth2 登录|使用 Lingxi/.test(text) || await page.locator('[data-testid="auth-login"]').first().isVisible({ timeout: 500 }).catch(() => false),
    text_excerpt: text.slice(0, 1000),
  };
}

async function settingsHeaderOverlap(page) {
  return page.evaluate(() => {
    const buttons = [...document.querySelectorAll('[data-testid="sidebar-expand"], [data-testid="sidebar-collapse"], button')];
    const heading = [...document.querySelectorAll('h1,h2,[role="heading"],body *')]
      .find((el) => (el.textContent || '').trim() === '个人设置');
    const control = buttons.find((el) => {
      const text = (el.textContent || el.getAttribute('aria-label') || '').trim();
      return el.getAttribute('data-testid') === 'sidebar-expand' || el.getAttribute('data-testid') === 'sidebar-collapse' || /展开|收起/.test(text);
    });
    if (!heading || !control) return false;
    const a = heading.getBoundingClientRect();
    const b = control.getBoundingClientRect();
    return !(a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top);
  }).catch(() => false);
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
    const ranked = await rankQbotPageCandidates(candidates);
    const qbot = ranked[0]?.score > 0 ? ranked[0].page : null;
    if (qbot) {
      await qbot.waitForLoadState('domcontentloaded').catch(() => {});
      return qbot;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
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
    if (/\.deepbank(?:-(?:dev|local|uat|sit))?\/ui\/|deepbank/i.test(url)) score += 100;
    if (/\/apps\/qbot\b|[/?#]qbot\b/i.test(url)) score += 30;
    if (/localhost|127\.0\.0\.1/i.test(url)) score += 5;
    ranked.push({ page, score, title, url });
  }
  return ranked.sort((left, right) => right.score - left.score);
}

function selectCases(cases, options) {
  let selected = [...cases];
  if (options.case) {
    const wanted = new Set(String(options.case).split(',').map((item) => item.trim()).filter(Boolean));
    selected = selected.filter((item) => wanted.has(item.id));
  }
  if (options.limit) selected = selected.slice(0, Number(options.limit));
  return selected;
}

function summarize(results) {
  return {
    total: results.length,
    passed: results.filter((item) => item.status === 'passed').length,
    failed: results.filter((item) => item.status === 'failed').length,
    blocked: results.filter((item) => item.status === 'blocked').length,
  };
}

function blockedReport({ outDir, cdpUrl, startedAt, cases = [], precheck = null, reason }) {
  return {
    status: 'blocked',
    command: 'ui-agent-module-run',
    reason,
    started_at: startedAt.toISOString(),
    ended_at: new Date().toISOString(),
    out_dir: outDir,
    cdp_url: cdpUrl,
    precheck,
    cases,
    results: [],
    summary: summarize([]),
  };
}

function writeReports(outDir, report) {
  writeJsonFile(path.join(outDir, 'ui-agent-module-report.json'), report);
  writeTextFile(path.join(outDir, 'ui-agent-module-report.md'), renderRunReport(report));
}

function renderRunReport(report) {
  const lines = [
    '# QBot 全功能模块 Playwright UI Agent 自动化测试报告',
    '',
    `- 状态：${report.status}`,
    `- 输出目录：${report.out_dir}`,
    `- CDP：${report.cdp_url}`,
    `- 开始时间：${report.started_at}`,
    `- 结束时间：${report.ended_at}`,
    '',
    '## 汇总',
    '',
    `- 总用例数：${report.summary?.total || 0}`,
    `- 通过：${report.summary?.passed || 0}`,
    `- 失败：${report.summary?.failed || 0}`,
    `- 阻塞：${report.summary?.blocked || 0}`,
    '',
  ];
  if (report.reason) lines.push(`阻塞原因：${report.reason}`, '');
  if (report.results?.length) {
    lines.push('| 序号 | 模块 | 用例 | 优先级 | 结论 | 实际结果 | 报告 |');
    lines.push('| --- | --- | --- | --- | --- | --- | --- |');
    for (const result of report.results) {
      lines.push(`| ${result.order} | ${esc(result.module)} | ${esc(result.title)} | ${result.priority} | ${result.status} | ${esc(result.actual_result)} | ${path.join(result.case_dir, 'case-report.md')} |`);
    }
    const bugs = report.results.filter((result) => result.status === 'failed' && result.problem_description);
    if (bugs.length) {
      lines.push('', '## 失败用例 Bug 描述', '');
      for (const result of bugs) {
        lines.push(`### ${result.id} ${result.title}`, '', result.problem_description, '');
      }
    }
  }
  return `${lines.join('\n')}\n`;
}

function renderTestCases(cases) {
  return [
    '# QBot 全功能模块自动化测试用例',
    '',
    '| ID | 模块 | 优先级 | 测试场景 | 预期结果 |',
    '| --- | --- | --- | --- | --- |',
    ...cases.map((item) => `| ${item.id} | ${esc(item.module)} | ${item.priority} | ${esc(item.scenario)} | ${esc(item.expected_result)} |`),
    '',
  ].join('\n');
}

function renderCaseReport(result) {
  const lines = [
    `# ${result.id} ${result.title}`,
    '',
    '## 用例信息',
    '',
    `- 功能模块：${result.module}`,
    `- 优先级：${result.priority}`,
    `- 测试场景：${result.scenario}`,
    `- 用例目录：${result.case_dir}`,
    '',
    '## 预期结果',
    '',
    result.expected_result,
    '',
    '## 操作步骤',
    '',
    '| 步骤 | 操作 | 预期 | 实际 | 结论 | 截图 |',
    '| --- | --- | --- | --- | --- | --- |',
    ...result.steps.map((step, index) => `| ${index + 1} | ${esc(step.action)} | ${esc(step.expected)} | ${esc(step.actual)} | ${step.status} | ${step.screenshot || ''} |`),
    '',
    '## 实际结果',
    '',
    result.actual_result || '无',
    '',
    '## 测试结论',
    '',
    result.conclusion || result.status,
    '',
    '## 测试证据',
    '',
    ...Object.entries(result.screenshots || {}).map(([key, value]) => `- ${key}：${typeof value === 'string' ? value : JSON.stringify(value)}`),
    ...Object.entries(result.artifacts || {}).filter(([, value]) => typeof value === 'string').map(([key, value]) => `- ${key}：${value}`),
    '',
  ];
  if (result.problem_description) {
    lines.push('## 失败问题描述', '', result.problem_description, '');
  }
  return `${lines.join('\n')}\n`;
}

function buildProblemDescription(result, actual) {
  const screenshots = Object.values(result.screenshots || {}).filter((item) => typeof item === 'string');
  const screenshot = screenshots[screenshots.length - 1] || '';
  return [
    `【Bug】${result.module} - ${result.title}`,
    '',
    `测试场景：${result.scenario}`,
    '',
    `预期结果：${result.expected_result}`,
    '',
    `实际结果：${actual}`,
    '',
    '影响：该问题会影响普通用户对功能入口或 Agent 回复能力的理解与使用，可能造成用户无法完成当前任务或误判功能是否可用。',
    '',
    `证据截图：${screenshot || '见用例目录截图'}`,
  ].join('\n');
}

function esc(text) {
  return String(text || '').replace(/\|/g, '/').replace(/\n/g, ' ');
}

function longText() {
  return Array.from({ length: 10 }, (_, index) => `第${index + 1}段：QBot 面向产品、运营和管理者，核心体验应当是用户直接描述目标，系统自动理解上下文、处理资料、生成结构化回复。测试时要关注多轮上下文、长文本摘要、附件读取、异常提示是否用户友好，以及回复是否暴露底层模型、运行时、环境变量或内部服务错误。`).join('\n');
}
