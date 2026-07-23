import fs from 'node:fs';
import path from 'node:path';
import { ensureDir, timestampForPath, writeJsonFile, writeTextFile } from './fs.mjs';

const DEFAULT_CDP_URL = 'http://127.0.0.1:9224';
const DEFAULT_OUT_DIR_NAME = `qbot-ui-agent-explore-${timestampForPath()}`;

export async function runUiAgentExploreCommand({ options = {}, root = process.cwd() } = {}) {
  const outDir = path.resolve(options.out || path.join(root, 'outputs', DEFAULT_OUT_DIR_NAME));
  const fixturesDir = path.resolve(options.fixtures || path.join(root, 'testflies'));
  const cdpUrl = String(options.cdp || process.env.QBOT_CDP_URL || DEFAULT_CDP_URL);
  ensureDir(outDir);
  ensureDir(fixturesDir);
  ensureExplorerFixture(fixturesDir);

  const startedAt = new Date();
  const loaded = await loadPlaywright();
  if (loaded.error) {
    const report = blockedReport({ outDir, cdpUrl, startedAt, reason: `Playwright 未安装或无法加载：${loaded.error.message}` });
    writeExploreReports(outDir, report);
    return report;
  }

  let browser;
  try {
    browser = await loaded.chromium.connectOverCDP(cdpUrl);
    const page = await findQbotPage(browser);
    if (!page) {
      const report = blockedReport({ outDir, cdpUrl, startedAt, reason: `已连接 CDP ${cdpUrl}，但没有找到 QBot 页面。` });
      writeExploreReports(outDir, report);
      return report;
    }
    page.setDefaultTimeout(10000);
    page.setDefaultNavigationTimeout(30000);
    const dialogs = [];
    page.on('dialog', async (dialog) => {
      dialogs.push({ type: dialog.type(), message: dialog.message(), defaultValue: dialog.defaultValue() });
      await dialog.dismiss().catch(() => {});
    });

    const actions = [];
    const snapshots = [];
    await snapshot(page, outDir, snapshots, '00-initial', '初始页面');
    const initialText = await bodyText(page);
    const loginRequired = await page.locator('[data-testid="auth-login"]').first().isVisible({ timeout: 1000 }).catch(() => false)
      || /登录工作台|OAuth2 登录|使用 Lingxi/.test(initialText);
    if (loginRequired) {
      const report = {
        status: 'blocked',
        command: 'ui-agent-explore',
        reason: 'QBot 当前停在登录页，需要先完成 Lingxi OAuth2 登录。',
        started_at: startedAt.toISOString(),
        ended_at: new Date().toISOString(),
        out_dir: outDir,
        cdp_url: cdpUrl,
        actions,
        snapshots,
        feature_map: buildFeatureMap(snapshots, actions),
      };
      writeExploreReports(outDir, report);
      return report;
    }

    await exploreSidebar(page, outDir, actions, snapshots);
    await exploreDeepPages(page, outDir, actions, snapshots);
    await exploreNewTaskAndComposer(page, outDir, actions, snapshots, fixturesDir);
    await exploreWelcomeShortcuts(page, outDir, actions, snapshots);
    await exploreArtifactPanel(page, outDir, actions, snapshots);
    await exploreSessionContextMenu(page, outDir, actions, snapshots);
    await exploreProfileMenu(page, outDir, actions, snapshots);

    await snapshot(page, outDir, snapshots, '99-final', '探索结束状态');
    const report = {
      status: 'pass',
      command: 'ui-agent-explore',
      started_at: startedAt.toISOString(),
      ended_at: new Date().toISOString(),
      out_dir: outDir,
      cdp_url: cdpUrl,
      actions,
      dialogs,
      snapshots,
      feature_map: buildFeatureMap(snapshots, actions),
    };
    writeExploreReports(outDir, report);
    return report;
  } catch (error) {
    const report = blockedReport({ outDir, cdpUrl, startedAt, reason: error.message });
    writeExploreReports(outDir, report);
    return report;
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
}

async function exploreSidebar(page, outDir, actions, snapshots) {
  await ensureSidebarExpanded(page);
  await safeClick(page, outDir, actions, snapshots, {
    id: 'sidebar-search',
    name: '搜索任务',
    selector: '[data-testid="sidebar-search"]',
    type: 'search',
    expected: '打开任务搜索弹层。',
  });
  await page.keyboard.press('Escape').catch(() => {});

  await safeClick(page, outDir, actions, snapshots, {
    id: 'sidebar-collapse',
    name: '收起/展开左侧栏',
    selector: '[data-testid="sidebar-collapse"]',
    type: 'layout',
    expected: '切换左侧栏宽度或收起状态。',
  });
  await safeClick(page, outDir, actions, snapshots, {
    id: 'sidebar-collapse-restore',
    name: '恢复左侧栏',
    selector: '[data-testid="sidebar-collapse"]',
    type: 'layout',
    expected: '恢复左侧栏，避免影响后续探索。',
  });
  await ensureSidebarExpanded(page);

  const navItems = [
    ['nav-experts', '专家入口', '[data-testid="nav-experts"]', 'expert', '专家角色/技能相关入口。'],
    ['nav-connectors', '连接器入口', '[data-testid="nav-connectors"]', 'connector', '外部应用/工具连接入口。'],
    ['nav-more', '知识入口', '[data-testid="nav-more"]', 'knowledge', '知识源/成果相关入口。'],
    ['nav-auto', '自动化入口', '[data-testid="nav-auto"]', 'automation', '自动化模块入口，第一版可先记录不深测。'],
    ['nav-projects', '项目入口', '[data-testid="nav-projects"]', 'project', '项目模块入口，第一版可先记录不深测。'],
  ];
  for (const [id, name, selector, type, expected] of navItems) {
    await safeClick(page, outDir, actions, snapshots, { id, name, selector, type, expected });
    await page.keyboard.press('Escape').catch(() => {});
  }
}

async function exploreDeepPages(page, outDir, actions, snapshots) {
  await exploreExpertsDeep(page, outDir, actions, snapshots);
  await exploreConnectorsDeep(page, outDir, actions, snapshots);
  await exploreKnowledgeDeep(page, outDir, actions, snapshots);
  await exploreProjectsDeep(page, outDir, actions, snapshots);
}

async function exploreExpertsDeep(page, outDir, actions, snapshots) {
  await ensureSidebarExpanded(page);
  await safeClick(page, outDir, actions, snapshots, {
    id: 'deep-experts-entry',
    name: '进入专家模块',
    selector: '[data-testid="nav-experts"]',
    type: 'expert',
    expected: '打开专家市场/技能页。',
  });
  await safeClick(page, outDir, actions, snapshots, {
    id: 'deep-experts-tab-experts',
    name: '专家页签',
    selector: '[data-testid="experts-tab"]',
    type: 'expert-tab',
    expected: '展示专家角色列表和通用助手。',
  });
  await safeClick(page, outDir, actions, snapshots, {
    id: 'deep-experts-create',
    name: '创建专家入口',
    selector: '[data-testid="create-expert-top"]',
    type: 'expert-create',
    expected: '进入或展示专家创建流程入口。',
  });
  await page.keyboard.press('Escape').catch(() => {});
  await safeClick(page, outDir, actions, snapshots, {
    id: 'deep-experts-tab-skills',
    name: '技能页签',
    selector: '[data-testid="skills-tab"]',
    type: 'expert-tab',
    expected: '展示技能列表。',
  });
}

async function exploreConnectorsDeep(page, outDir, actions, snapshots) {
  await ensureSidebarExpanded(page);
  await safeClick(page, outDir, actions, snapshots, {
    id: 'deep-connectors-entry',
    name: '进入连接器模块',
    selector: '[data-testid="nav-connectors"]',
    type: 'connector',
    expected: '打开连接器列表。',
  });
  await safeClick(page, outDir, actions, snapshots, {
    id: 'deep-connectors-add',
    name: '添加连接器入口',
    selector: 'button:has-text("添加连接器")',
    type: 'connector-add',
    expected: '打开添加连接器弹窗。',
  });
  await page.keyboard.press('Escape').catch(() => {});
  await safeClick(page, outDir, actions, snapshots, {
    id: 'deep-connectors-detail',
    name: '连接器查看工具',
    selector: '[data-testid^="connector-details-trigger-"]',
    type: 'connector-detail',
    expected: '打开连接器工具列表弹窗。',
  });
  await page.keyboard.press('Escape').catch(() => {});
  const refreshAction = {
    id: 'deep-connectors-refresh',
    name: '刷新连接器目录',
    selector: 'button[title="刷新连接器目录"]',
    type: 'connector-refresh',
    expected: '刷新连接器目录。',
  };
  actions.push({ ...refreshAction, status: 'recorded_only', reason: '刷新会触发网络请求，本轮只记录入口，不点击。' });
}

async function exploreKnowledgeDeep(page, outDir, actions, snapshots) {
  await ensureSidebarExpanded(page);
  await safeClick(page, outDir, actions, snapshots, {
    id: 'deep-knowledge-entry',
    name: '进入知识模块',
    selector: '[data-testid="nav-more"]',
    type: 'knowledge',
    expected: '打开知识页。',
  });
  const tabs = [
    ['deep-knowledge-engine', '知识引擎页签', 'button:has-text("知识引擎")', 'knowledge-tab', '展示知识路由总开关、只用本体、优先级与自然语言补充。'],
    ['deep-knowledge-sources', '知识源页签', 'button:has-text("知识源")', 'knowledge-tab', '展示知识源配置。'],
    ['deep-knowledge-ontology', '本体页签', 'button:has-text("本体")', 'knowledge-tab', '展示本体待维护状态。'],
    ['deep-knowledge-artifacts', '任务成果页签', 'button:has-text("任务成果")', 'knowledge-tab', '展示任务成果搜索和文件列表。'],
  ];
  for (const [id, name, selector, type, expected] of tabs) {
    await safeClick(page, outDir, actions, snapshots, { id, name, selector, type, expected });
  }
  actions.push({
    id: 'deep-knowledge-switches',
    name: '知识开关组',
    type: 'knowledge-switch',
    status: 'recorded_only',
    reason: '总开关、只用本体、各知识源开关会改变用户配置，本轮只记录，不点击。',
  });
}

async function exploreProjectsDeep(page, outDir, actions, snapshots) {
  await ensureSidebarExpanded(page);
  await safeClick(page, outDir, actions, snapshots, {
    id: 'deep-projects-entry',
    name: '进入项目模块',
    selector: '[data-testid="nav-projects"]',
    type: 'project',
    expected: '打开项目列表和项目蓝图。',
  });
  actions.push({
    id: 'deep-projects-create',
    name: '新建项目入口',
    selector: '[data-testid="projects-create-button"]',
    type: 'project-create',
    status: 'recorded_only',
    reason: '项目为后续迭代模块，且新建项目可能创建数据，本轮只记录入口。',
  });
  actions.push({
    id: 'deep-projects-templates',
    name: '项目蓝图卡片',
    type: 'project-template',
    status: 'recorded_only',
    reason: '已在控件清单记录项目蓝图卡片；点击可能进入项目创建流程，本轮不点击。',
  });
}

async function exploreNewTaskAndComposer(page, outDir, actions, snapshots, fixturesDir) {
  await ensureSidebarExpanded(page);
  await safeClick(page, outDir, actions, snapshots, {
    id: 'nav-new-task',
    name: '新建任务',
    selector: '[data-testid="nav-new-task"]',
    type: 'task',
    expected: '进入新任务会话页，展示输入框和底部工具。',
  });

  const composerSnapshot = await snapshot(page, outDir, snapshots, 'composer-baseline', '新建任务会话区');
  const composerControls = composerSnapshot.controls.filter((control) => control.group === 'composer');
  writeJsonFile(path.join(outDir, 'composer-controls.json'), composerControls);

  const menuItems = [
    ['composer-craft-menu', 'Craft 模式菜单', 'button:has-text("Craft")', 'composer-menu', '打开 Craft / 回答方式选择。'],
    ['composer-skills-menu', '技能菜单', '[data-testid="composer-skills-menu"]', 'composer-menu', '打开技能选择菜单。'],
    ['composer-connectors-menu', '连应用菜单', '[data-testid="composer-connectors-menu"]', 'composer-menu', '打开连接应用菜单。'],
    ['composer-safety-level-menu', '思考等级/安全级别菜单', '[data-testid="composer-safety-level-menu"]', 'composer-menu', '打开 M4 等级选择菜单。'],
  ];
  for (const [id, name, selector, type, expected] of menuItems) {
    await safeClick(page, outDir, actions, snapshots, { id, name, selector, type, expected });
    await page.keyboard.press('Escape').catch(() => {});
  }

  await safeClick(page, outDir, actions, snapshots, {
    id: 'composer-feedback',
    name: '快速反馈入口',
    selector: '[data-testid="composer-feedback"]',
    type: 'composer-button',
    expected: '打开快速反馈或反馈相关面板。',
  });
  await page.keyboard.press('Escape').catch(() => {});

  await probeFileChooser(page, outDir, actions, snapshots, {
    id: 'composer-add-attachment',
    name: '加号附件入口',
    selector: '[data-testid="composer-add-attachment"]',
    files: [path.join(fixturesDir, 'explore-upload.txt')],
  });

  await probeFileChooser(page, outDir, actions, snapshots, {
    id: 'composer-add-document',
    name: '添加文档入口',
    selector: '[data-testid="composer-add-document"]',
    files: [path.join(fixturesDir, 'explore-upload.txt')],
  });

  await exploreUnknownComposerButtons(page, outDir, actions, snapshots);
}

async function exploreWelcomeShortcuts(page, outDir, actions, snapshots) {
  await ensureSidebarExpanded(page);
  await safeClick(page, outDir, actions, snapshots, {
    id: 'deep-new-task-for-welcome',
    name: '回到新建任务欢迎页',
    selector: '[data-testid="nav-new-task"]',
    type: 'task',
    expected: '展示欢迎页分类和快捷任务。',
  });
  const shortcuts = await page.evaluate(() => [...document.querySelectorAll('button')]
    .map((el, index) => {
      const rect = el.getBoundingClientRect();
      const text = (el.innerText || el.getAttribute('aria-label') || el.title || '').trim();
      return { index, text, visible: rect.width > 0 && rect.height > 0 };
    })
    .filter((item) => item.visible && /日常办公|代码开发|设计创意|文档处理|数据洞察/.test(item.text))).catch(() => []);
  writeJsonFile(path.join(outDir, 'welcome-shortcuts.json'), shortcuts);
  actions.push({
    id: 'welcome-shortcuts',
    name: '欢迎页分类和快捷任务',
    type: 'welcome',
    status: 'recorded_only',
    reason: '源码显示快捷任务按钮是 SuggestionPrimitive.Trigger send，点击会直接发送任务；本轮只记录，不点击。',
    shortcuts,
  });
  await snapshot(page, outDir, snapshots, 'deep-welcome-shortcuts', '欢迎页分类和快捷任务');
}

async function exploreArtifactPanel(page, outDir, actions, snapshots) {
  await safeClick(page, outDir, actions, snapshots, {
    id: 'deep-artifact-open',
    name: '成果面板入口',
    selector: '[data-testid="artifact-panel-open"]',
    type: 'artifact',
    expected: '打开右侧成果面板。',
  });
  await safeClick(page, outDir, actions, snapshots, {
    id: 'deep-artifact-close',
    name: '关闭成果面板',
    selector: '[data-testid="artifact-panel-close"], .artifact-close',
    type: 'artifact',
    expected: '关闭右侧成果面板。',
  });
}

async function exploreSessionContextMenu(page, outDir, actions, snapshots) {
  await ensureSidebarExpanded(page);
  const item = page.locator('[data-testid^="session-item-"]').first();
  if (!(await item.isVisible({ timeout: 1500 }).catch(() => false))) {
    actions.push({ id: 'deep-session-context-menu', name: '会话右键菜单', type: 'session', status: 'not_found', reason: '未找到会话列表项。' });
    return;
  }
  await item.click({ button: 'right', force: true }).catch(() => {});
  await page.waitForTimeout(600);
  const snap = await snapshot(page, outDir, snapshots, 'deep-session-context-menu', '会话右键菜单');
  actions.push({
    id: 'deep-session-context-menu',
    name: '会话右键菜单',
    type: 'session',
    status: 'clicked',
    reason: '右键会话后展示重命名、删除入口；删除会改变数据，本轮不点击。',
    screenshot: snap.screenshot,
  });
  await page.keyboard.press('Escape').catch(() => {});
}

async function exploreUnknownComposerButtons(page, outDir, actions, snapshots) {
  const buttons = await page.evaluate(() => {
    const composer = document.querySelector('[data-testid="composer-shell"]') || document.body;
    return [...composer.querySelectorAll('button,[role="button"]')].map((el, index) => {
      const rect = el.getBoundingClientRect();
      const text = (el.innerText || el.getAttribute('aria-label') || el.title || '').trim();
      return {
        index,
        testid: el.getAttribute('data-testid') || '',
        text,
        aria: el.getAttribute('aria-label') || '',
        title: el.title || '',
        className: String(el.className || ''),
        x: Math.round(rect.x),
        y: Math.round(rect.y),
        w: Math.round(rect.width),
        h: Math.round(rect.height),
        visible: rect.width > 0 && rect.height > 0,
      };
    }).filter((item) => item.visible);
  }).catch(() => []);
  const candidates = buttons
    .filter((button) => !button.testid)
    .filter((button) => !/Send message|发送|停止|Stop|Cancel|Remove file/i.test(`${button.text} ${button.aria} ${button.title}`))
    .slice(0, 8);
  for (const button of candidates) {
    const id = `composer-unknown-${button.index}`;
    const name = button.text || button.aria || button.title || `未知图标按钮 ${button.index}`;
    await safeClickByIndex(page, outDir, actions, snapshots, {
      id,
      name,
      buttonIndex: button.index,
      expected: '探索会话区未命名图标按钮的作用。',
    });
    await page.keyboard.press('Escape').catch(() => {});
  }
}

async function exploreProfileMenu(page, outDir, actions, snapshots) {
  await ensureSidebarExpanded(page);
  await safeClick(page, outDir, actions, snapshots, {
    id: 'nav-settings-menu',
    name: '左下用户入口',
    selector: '[data-testid="nav-settings-menu"]',
    type: 'profile',
    expected: '打开用户菜单，展示个人设置、检查更新、退出等入口。',
  });
  await safeClick(page, outDir, actions, snapshots, {
    id: 'nav-check-updates',
    name: '检查更新',
    selector: '[data-testid="nav-check-updates"]',
    type: 'profile',
    expected: '进入检查更新页面，展示当前版本和更新状态。',
  });
  await ensureSidebarExpanded(page);
  await safeClick(page, outDir, actions, snapshots, {
    id: 'nav-settings-menu-for-settings',
    name: '重新打开用户菜单',
    selector: '[data-testid="nav-settings-menu"]',
    type: 'profile',
    expected: '重新打开用户菜单以进入个人设置。',
  });
  await safeClick(page, outDir, actions, snapshots, {
    id: 'nav-settings',
    name: '个人设置',
    selector: '[data-testid="nav-settings"]',
    type: 'settings',
    expected: '进入个人设置页面。',
  });
  await page.keyboard.press('Escape').catch(() => {});
}

async function ensureSidebarExpanded(page) {
  const expand = page.locator('[data-testid="sidebar-expand"]').first();
  if (await expand.isVisible({ timeout: 500 }).catch(() => false)) {
    await expand.click({ force: true }).catch(() => {});
    await page.waitForTimeout(700);
  }
}

async function safeClick(page, outDir, actions, snapshots, action) {
  const locator = page.locator(action.selector).first();
  const visible = await locator.isVisible({ timeout: 1500 }).catch(() => false);
  if (!visible) {
    actions.push({ ...action, status: 'not_found', reason: '未在当前页面找到入口。' });
    return null;
  }
  if (isDestructiveAction(action)) {
    actions.push({ ...action, status: 'recorded_only', reason: '疑似退出/删除/发送/提交等会改变状态的动作，仅记录不点击。' });
    return null;
  }
  await locator.click({ force: true }).catch(async (error) => {
    actions.push({ ...action, status: 'failed', reason: error.message });
  });
  await page.waitForTimeout(900);
  const snap = await snapshot(page, outDir, snapshots, action.id, action.name);
  actions.push({ ...action, status: 'clicked', screenshot: snap.screenshot, controls_count: snap.controls.length });
  return snap;
}

async function safeClickByIndex(page, outDir, actions, snapshots, action) {
  if (isDestructiveAction(action)) {
    actions.push({ ...action, status: 'recorded_only', reason: '疑似破坏性动作，仅记录不点击。' });
    return null;
  }
  const clicked = await page.evaluate((index) => {
    const composer = document.querySelector('[data-testid="composer-shell"]') || document.body;
    const buttons = [...composer.querySelectorAll('button,[role="button"]')].filter((el) => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    });
    const el = buttons[index];
    if (!el) return false;
    el.click();
    return true;
  }, action.buttonIndex).catch(() => false);
  if (!clicked) {
    actions.push({ ...action, status: 'not_found', reason: '未找到对应序号的会话区按钮。' });
    return null;
  }
  await page.waitForTimeout(900);
  const snap = await snapshot(page, outDir, snapshots, action.id, action.name);
  actions.push({ ...action, status: 'clicked', screenshot: snap.screenshot, controls_count: snap.controls.length });
  return snap;
}

async function probeFileChooser(page, outDir, actions, snapshots, action) {
  const locator = page.locator(action.selector).first();
  if (!(await locator.isVisible({ timeout: 1500 }).catch(() => false))) {
    actions.push({ ...action, status: 'not_found', reason: '未找到上传入口。' });
    return;
  }
  const chooserPromise = page.waitForEvent('filechooser', { timeout: 2500 }).catch(() => null);
  await locator.click({ force: true });
  const chooser = await chooserPromise;
  if (!chooser) {
    await page.waitForTimeout(800);
    const snap = await snapshot(page, outDir, snapshots, action.id, action.name);
    actions.push({ ...action, status: 'clicked_no_filechooser', reason: '点击后未触发系统文件选择器。', screenshot: snap.screenshot });
    await page.keyboard.press('Escape').catch(() => {});
    return;
  }
  await chooser.setFiles(action.files);
  await page.waitForTimeout(1500);
  const text = await bodyText(page);
  const controls = await collectControls(page);
  const expectedNames = action.files.map((file) => path.basename(file));
  const visibleNames = expectedNames.filter((name) => text.includes(name));
  const attachmentChipVisible = controls.some((control) => /Document attachment|Remove file|附件/.test(`${control.text} ${control.aria} ${control.title}`));
  const snap = await snapshot(page, outDir, snapshots, action.id, action.name);
  actions.push({
    ...action,
    status: visibleNames.length ? 'filechooser_verified'
      : attachmentChipVisible ? 'filechooser_chip_visible' : 'filechooser_unverified',
    expected_names: expectedNames,
    visible_names: visibleNames,
    attachment_chip_visible: attachmentChipVisible,
    reason: visibleNames.length
      ? `页面显示上传文件名：${visibleNames.join(', ')}`
      : attachmentChipVisible
        ? `已触发系统文件选择器并出现附件卡片，但页面未显示文件名：${expectedNames.join(', ')}`
        : `已触发系统文件选择器并传入文件，但页面未显示文件名或附件卡片：${expectedNames.join(', ')}`,
    screenshot: snap.screenshot,
  });
}

async function snapshot(page, outDir, snapshots, id, name) {
  const safeId = id.replace(/[^a-zA-Z0-9._-]+/g, '-');
  const screenshot = path.join(outDir, `${String(snapshots.length).padStart(2, '0')}-${safeId}.png`);
  await page.screenshot({ path: screenshot, fullPage: true }).catch(() => null);
  const controls = await collectControls(page);
  const text = await bodyText(page);
  const textFile = path.join(outDir, `${String(snapshots.length).padStart(2, '0')}-${safeId}.txt`);
  writeTextFile(textFile, text);
  const snapshotData = {
    id,
    name,
    screenshot,
    text_file: textFile,
    url: page.url(),
    controls,
    visible_text_excerpt: text.slice(0, 1200),
  };
  snapshots.push(snapshotData);
  writeJsonFile(path.join(outDir, `${String(snapshots.length - 1).padStart(2, '0')}-${safeId}.controls.json`), controls);
  return snapshotData;
}

async function collectControls(page) {
  return page.evaluate(() => {
    const groupOf = (el) => {
      if (el.closest('[data-testid="composer-shell"]')) return 'composer';
      if (el.closest('.side-nav') || el.closest('.side-scroll') || el.closest('aside')) return 'sidebar';
      if (el.closest('[role="dialog"], .modal, .popover, .menu, [data-radix-popper-content-wrapper]')) return 'overlay';
      return 'main';
    };
    return [...document.querySelectorAll('button,[role="button"],a,input,textarea,select,[contenteditable="true"]')]
      .map((el, index) => {
        const rect = el.getBoundingClientRect();
        const text = (el.innerText || el.value || el.getAttribute('aria-label') || el.title || el.placeholder || '').trim();
        return {
          index,
          group: groupOf(el),
          tag: el.tagName.toLowerCase(),
          role: el.getAttribute('role') || '',
          testid: el.getAttribute('data-testid') || '',
          primitive: el.getAttribute('data-uiux-primitive') || '',
          text: text.slice(0, 160),
          aria: el.getAttribute('aria-label') || '',
          title: el.title || '',
          placeholder: el.getAttribute('placeholder') || '',
          disabled: Boolean(el.disabled || el.getAttribute('aria-disabled') === 'true'),
          x: Math.round(rect.x),
          y: Math.round(rect.y),
          w: Math.round(rect.width),
          h: Math.round(rect.height),
          visible: rect.width > 0 && rect.height > 0,
        };
      })
      .filter((item) => item.visible)
      .sort((a, b) => (a.y - b.y) || (a.x - b.x));
  }).catch(() => []);
}

function buildFeatureMap(snapshots, actions) {
  const allControls = snapshots.flatMap((snapshot) => snapshot.controls.map((control) => ({
    snapshot: snapshot.id,
    snapshot_name: snapshot.name,
    ...control,
  })));
  const unique = new Map();
  for (const control of allControls) {
    const key = control.testid || `${control.group}:${control.tag}:${control.text}:${control.aria}:${control.title}:${control.placeholder}`;
    if (!unique.has(key)) unique.set(key, { ...control, seen_in: [control.snapshot] });
    else unique.get(key).seen_in.push(control.snapshot);
  }
  return {
    total_snapshots: snapshots.length,
    total_actions: actions.length,
    clicked_actions: actions.filter((action) => action.status === 'clicked' || String(action.status).startsWith('filechooser')).length,
    controls: [...unique.values()],
    actions,
  };
}

function writeExploreReports(outDir, report) {
  writeJsonFile(path.join(outDir, 'ui-agent-explore-report.json'), report);
  writeTextFile(path.join(outDir, 'ui-agent-explore-report.md'), renderExploreReport(report));
  writeJsonFile(path.join(outDir, 'qbot-feature-map.json'), report.feature_map || {});
}

function renderExploreReport(report) {
  const controls = report.feature_map?.controls || [];
  return [
    '# QBot Playwright UI Agent 全入口探索报告',
    '',
    `- 状态：${report.status}`,
    `- 输出目录：${report.out_dir}`,
    `- CDP：${report.cdp_url}`,
    `- 开始时间：${report.started_at}`,
    `- 结束时间：${report.ended_at}`,
    report.reason ? `- 原因：${report.reason}` : '',
    '',
    '## 探索结论',
    '',
    `- 截图快照数：${report.snapshots?.length || 0}`,
    `- 执行动作数：${report.actions?.length || 0}`,
    `- 去重控件数：${controls.length}`,
    '',
    '## 已执行入口',
    '',
    '| 入口 | 类型 | 状态 | 说明 | 截图 |',
    '| --- | --- | --- | --- | --- |',
    ...(report.actions || []).map((action) => `| ${escapeMd(action.name || action.id)} | ${escapeMd(action.type || '')} | ${escapeMd(action.status)} | ${escapeMd(action.reason || action.expected || '')} | ${escapeMd(action.screenshot || '')} |`),
    '',
    '## 控件清单',
    '',
    '| 分组 | 控件 | testid | aria/title/placeholder | 首次截图 |',
    '| --- | --- | --- | --- | --- |',
    ...controls.map((control) => `| ${escapeMd(control.group)} | ${escapeMd(control.text || control.tag)} | ${escapeMd(control.testid)} | ${escapeMd(control.aria || control.title || control.placeholder)} | ${escapeMd(control.snapshot_name)} |`),
    '',
    '## 截图快照',
    '',
    ...(report.snapshots || []).map((snapshot) => `- ${snapshot.name}：${snapshot.screenshot}`),
    '',
  ].filter(Boolean).join('\n');
}

function blockedReport({ outDir, cdpUrl, startedAt, reason }) {
  return {
    status: 'blocked',
    command: 'ui-agent-explore',
    reason,
    started_at: startedAt.toISOString(),
    ended_at: new Date().toISOString(),
    out_dir: outDir,
    cdp_url: cdpUrl,
    actions: [],
    snapshots: [],
    feature_map: { controls: [], actions: [] },
  };
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
    if (/\.deepbank(?:-dev)?\/ui\/|deepbank/i.test(url)) score += 100;
    if (/\/apps\/qbot\b|[/?#]qbot\b/i.test(url)) score += 30;
    if (/localhost|127\.0\.0\.1/i.test(url)) score += 5;
    ranked.push({ page, score, title, url });
  }
  return ranked.sort((left, right) => right.score - left.score);
}

async function bodyText(page) {
  return redact(await page.locator('body').innerText({ timeout: 8000 }).catch(() => ''));
}

function redact(text) {
  return String(text || '')
    .replace(/(Bearer\s+)[A-Za-z0-9._-]+/gi, '$1[REDACTED]')
    .replace(/([?&](?:token|access_token|refresh_token|client_secret|password)=)[^&#\s]+/gi, '$1[REDACTED]');
}

function isDestructiveAction(action) {
  return /退出|删除|移到废纸篓|发送|Send message|停止|Stop|Cancel|确认|提交|Remove file/.test(`${action.name || ''} ${action.id || ''}`);
}

function ensureExplorerFixture(fixturesDir) {
  const file = path.join(fixturesDir, 'explore-upload.txt');
  if (!fs.existsSync(file)) fs.writeFileSync(file, 'QBot UI Agent explore upload fixture.\n', 'utf8');
}

function escapeMd(text) {
  return String(text || '').replace(/\|/g, '/').replace(/\n/g, ' ');
}
