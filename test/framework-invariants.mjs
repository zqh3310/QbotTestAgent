import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import {
  attachmentReplyMissingEvidence,
  attachmentTaskPromptFromCase,
  assessUserCenteredOutcome,
  brokenAttachmentFabricationEvidence,
  buildCredibilityReview,
  buildSingleHostPipelineBatch,
  buildConversationTurns,
  caseAwareReplyAssertion,
  createControlPlaneFaultProxy,
  createConnectorRegressionServer,
  createSkillHubRegressionServer,
  countEnumeratedItems,
  forbiddenMatchesForCase,
  inferQbotHomeForElectronRestart,
  isContinuedOldLoginAnswer,
  isTransientCredentialRotation,
  isSuccessfulSendStep,
  latestAssistantReplyForPrompt,
  memoryLifecycleVerdict,
  modelServiceStateEvidence,
  obviousDuplicateEvidence,
  probeConnectorRegressionFixture,
  parseSingleHostPipelineSize,
  rawArtifactEventLeakEvidence,
  replyLooksRelevant,
  reviewCaseCredibility,
  selectManagedRuntimeProcess,
  singleHostPipelineEligibility,
  seedLocalSkillReadiness,
  sendReceiptEvidence,
  sentPromptFidelity,
  streamingScrollFollowVerdict,
  withReplyPollHardTimeout,
  webSearchQualityVerdict,
  validateProductionCasePlan,
} from '../src/lib/ui-agent-casebook-runner.mjs';
import { replaceUnpairedSurrogates, writeJsonFile } from '../src/lib/fs.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const runner = fs.readFileSync(path.join(root, 'src', 'lib', 'ui-agent-casebook-runner.mjs'), 'utf8');
const electronRestartHelper = fs.readFileSync(path.join(root, 'scripts', 'restart-qbot-electron-control-plane.sh'), 'utf8');
const skillHubRestartHelper = fs.readFileSync(path.join(root, 'scripts', 'restart-qbot-skillhub-control-plane.sh'), 'utf8');
const connectorFixtureRestartHelper = fs.readFileSync(path.join(root, 'scripts', 'restart-qbot-connector-fixture-control-plane.sh'), 'utf8');
const capabilityFixtureRestartHelper = fs.readFileSync(path.join(root, 'scripts', 'restart-qbot-capability-fixture-control-plane.sh'), 'utf8');
const skillHubFixtureManifest = JSON.parse(fs.readFileSync(path.join(root, 'testfixtures', 'skillhub-regression', 'manifest.json'), 'utf8'));
const coreGateCasebook = JSON.parse(fs.readFileSync(
  path.join(root, 'PRD', 'QBot核心上线门禁用例_Teams-QWork_2026-07-22_框架修复版.json'),
  'utf8',
));

const coreGateIds = coreGateCasebook.cases.map((item) => item.id);
assert.equal(coreGateIds.length, 92, '核心门禁用例簿必须保持 92 条');
assert.equal(new Set(coreGateIds).size, 92, '核心门禁用例簿 Case ID 必须唯一');
assert.equal(coreGateIds[0], 'SIT-INIT-002', '核心门禁用例簿首条必须是安装初始化入口');
assert.equal(coreGateIds.at(-1), 'SIT-AUTH-005', '核心门禁用例簿末条必须是退出登录闭环');
for (const id of [
  'SIT-INIT-004',
  'SIT-INIT-025',
  'SIT-AUTH-003',
  'SIT-HOME-050',
  'SIT-SKILL-026',
  'SIT-SKILL-032',
  'SIT-TEAMS-DOC-001',
]) {
  const item = coreGateCasebook.cases.find((candidate) => candidate.id === id);
  assert.ok(item, `核心门禁修订用例缺失：${id}`);
  for (const field of ['steps', 'success_criteria', 'evidence_required']) {
    assert.ok(String(item[field] || '').trim(), `${id} 缺少 ${field}`);
  }
}
const coreGateById = new Map(coreGateCasebook.cases.map((item) => [item.id, item]));
assert.match(coreGateById.get('SIT-AUTH-003').steps, /关闭并重新打开.*live profile/, 'AUTH-003 必须把宿主重开写成核心步骤');
assert.match(coreGateById.get('SIT-HOME-050').evidence_required, /搜索命中截图.*Esc 关闭后截图/, 'HOME-050 必须要求两张结果对齐截图');
assert.match(coreGateById.get('SIT-SKILL-026').precondition, /qa-python-runtime.*qa-node-runtime/, 'SKILL-026 必须使用两项确定性 Fixture');
assert.match(coreGateById.get('SIT-SKILL-032').evidence_required, /原始请求.*只保存在脱敏证据 JSON/, 'SKILL-032 必须分离用户结论与原始证据');
assert.match(coreGateById.get('SIT-TEAMS-DOC-001').steps, /按 key 选择 Teams Document QA/, 'Teams 文档必须按 key 显式选择连接器');
assert.match(
  runner,
  /if \(projectSource !== 'gitlab'\)[\s\S]{0,500}普通项目使用当前选中运行时启动/,
  '普通项目不得被 GitLab workspace.ready 前置条件误阻塞',
);
assert.match(
  runner,
  /selectManualSkillByName\(page, state, caseDir, skillName, \{ ensureMode: false \}\)/,
  '多技能选择不得在每次点击前重复切换手动模式并清空上一技能',
);
assert.match(
  runner,
  /selectManualSkillByName\(page, state, caseDir, removedSkill, \{ ensureMode: false \}\)/,
  '多技能恢复不得重复切换手动模式并清空未删除技能',
);
assert.match(
  runner,
  /saveProjectRuntimeBinding\(project\.id, selectedRuntime\.runtimeId, true\)/,
  '专用 QA GitLab 项目未绑定时应通过产品 bridge 选择 enabled 运行时准备测试数据',
);
assert.match(
  runner,
  /Number\(b\.source !== 'gitlab'\) - Number\(a\.source !== 'gitlab'\)/,
  '项目成果用例应优先复用现有普通项目，避免无谓选择未绑定的 GitLab 项目',
);
assert.doesNotMatch(
  runner,
  /!projectId \|\| \(selectedProject\?\.source === 'gitlab'/,
  'createProject 不能被当作将未绑定 GitLab 项目转换为本地可执行项目的兜底',
);
assert.match(
  runner,
  /state\._composerPreparedSend[\s\S]{0,1400}composerUserTextValue/,
  '能力 chip composer 发送前应剔除 chip 文本校验用户正文，不能用 fill 清空 selectedSkills',
);
assert.match(runner, /createProject bridge 20000ms 未返回/, '项目测试数据 bridge 必须有硬超时，不能拖满整条 Case');

assert.deepEqual(
  forbiddenMatchesForCase('已收到：__DEEPBANK_E2E_ASK__', 'SIT-HITL-002'),
  [],
  'HITL 可见交互夹具自身的精确 E2E 触发标记不应被复核器误报为产品泄漏',
);
assert.deepEqual(
  forbiddenMatchesForCase('已收到：DEEPBANK_E2E_ASK', 'SIT-HITL-002'),
  [],
  'HITL 夹具标记被 QWork 去除外围下划线后的精确可见形式也不应误报',
);
assert.ok(
  forbiddenMatchesForCase('已收到：__DEEPBANK_E2E_ASK__', 'SIT-HOME-001').length > 0,
  'HITL E2E 标记在其他 Case 中仍必须作为技术噪音拦截',
);
assert.ok(
  forbiddenMatchesForCase('__DEEPBANK_E2E_ASK__ DEEPBANK_UNEXPECTED_SECRET', 'SIT-HITL-002')
    .some((item) => item.includes('DEEPBANK_UNEXPECTED_SECRET')),
  'HITL 精确豁免不得吞掉同一回复里的其他 DEEPBANK_* 泄漏',
);

const pipelineCase = (id, overrides = {}) => ({
  id,
  kind: 'conversation',
  module: '首页',
  submodule: '会话',
  scenario: '独立单轮业务问答',
  precondition: '已登录工作台',
  test_data: '请总结本周活动数据并给出三条建议。',
  expected_result: '返回清晰、相关的业务建议。',
  ...overrides,
});
assert.equal(parseSingleHostPipelineSize(true), 5, '布尔开关默认开启 5 会话流水线');
assert.equal(parseSingleHostPipelineSize('1'), 1, '流水线大小 1 等价于串行');
assert.throws(() => parseSingleHostPipelineSize('6'), /1-5/, '单宿主流水线不得超过 5');
assert.equal(singleHostPipelineEligibility(pipelineCase('SIT-HOME-061')).eligible, true, '白名单单轮纯会话允许流水线派发');
assert.equal(singleHostPipelineEligibility(pipelineCase('SIT-HOME-061', { test_data: '请读取上传附件并总结。' })).eligible, false, '附件语义即使 ID 在白名单也必须串行');
assert.equal(singleHostPipelineEligibility(pipelineCase('SIT-HITL-002')).eligible, false, 'HITL Case 不得进入单宿主流水线');
assert.equal(isTransientCredentialRotation('Lingxi credential changed during the management request'), true, 'Lingxi 管理请求凭证轮换必须进入一次安全恢复');
assert.equal(isTransientCredentialRotation('普通业务失败，请稍后重试'), false, '未知业务错误不得盲目按凭证轮换重试');
const plannedPipeline = buildSingleHostPipelineBatch([
  pipelineCase('SIT-HOME-061'),
  pipelineCase('SIT-HOME-062'),
  pipelineCase('SIT-HOME-063'),
  pipelineCase('SIT-HOME-064'),
  pipelineCase('SIT-HOME-065'),
  pipelineCase('SIT-HOME-054'),
], 0, 5);
assert.deepEqual(plannedPipeline.map((entry) => entry.testCase.id), [
  'SIT-HOME-061',
  'SIT-HOME-062',
  'SIT-HOME-063',
  'SIT-HOME-064',
  'SIT-HOME-065',
], '单宿主流水线单波最多派发 5 条');
assert.deepEqual(buildSingleHostPipelineBatch([
  pipelineCase('SIT-HOME-061'),
  pipelineCase('SIT-HITL-002'),
  pipelineCase('SIT-HOME-062'),
], 0, 5).map((entry) => entry.testCase.id), ['SIT-HOME-061'], '流水线不得跨越串行安全屏障重排 Case');
assert.equal(caseAwareReplyAssertion(
  pipelineCase('SIT-HOME-061'),
  { prompt: '先给3步执行计划，再给检查清单。', label: '第一轮' },
  '第 1 步：数据核对\n第 2 步：用户反馈分析\n第 3 步：结论落地\n检查清单：数据核对、用户反馈、风险、负责人、截止时间。',
).ok, true, '计划判定应识别“第 1 步/第 2 步/第 3 步”格式');
assert.equal(caseAwareReplyAssertion(
  pipelineCase('SIT-HOME-062'),
  { prompt: '缺少收入和成本时怎么算 ROI？', label: '第一轮' },
  '当前无法计算。ROI = （活动带来的收益 − 活动成本） / 活动成本 × 100%，请补充收入与成本。',
).ok, true, 'ROI 判定应接受带业务修饰词和全角括号的等价公式');
assert.equal(caseAwareReplyAssertion(
  pipelineCase('SIT-HOME-064'),
  { prompt: '输出固定四列三行 Markdown 表格。', label: '第一轮' },
  '事项\t负责人\t截止日期\t状态\n核对报名数据\t张三\t7月18日\t进行中\n复核短信到达率\t李四\t7月19日\t未开始\n提交复盘\t王五\t7月20日\t未开始',
).ok, true, 'Markdown 表格判定应接受 QWork 渲染后 DOM 的四列制表符文本');

assert.equal(webSearchQualityVerdict(
  '1. 更新 A（2026-07-20）：https://openai.com/news/update-a\n2. 更新 B（2026-07-18）：https://openai.com/index/update-b',
  '网页搜索 qbot_web 已完成',
).ok, true, 'Web 搜索质量门禁应接受带官方链接、日期和真实工具证据的回复');
assert.equal(webSearchQualityVerdict(
  '最近更新很多，但这里不提供来源。',
  '',
).ok, false, 'Web 搜索质量门禁不得接受无来源、无日期、无工具证据的模型自述');
assert.equal(memoryLifecycleVerdict({
  markdownReply: '默认格式是 Markdown。',
  excelReply: '默认格式已改为 Excel。',
  deletedReply: '目前没有固定偏好，请指定格式。',
}).ok, true, '记忆门禁应接受跨任务读取、修改和删除均正确的证据');
assert.equal(memoryLifecycleVerdict({
  markdownReply: '默认格式是 Markdown。',
  excelReply: '默认格式仍是 Markdown。',
  deletedReply: '默认格式是 Excel。',
}).ok, false, '记忆门禁必须拒绝旧值残留或删除后继续注入');
assert.equal(caseAwareReplyAssertion(
  pipelineCase('SIT-MEM-001'),
  { prompt: '我的默认测试报告格式是什么？', label: '新任务读取 Excel 偏好' },
  '根据你此前的设定，你的默认测试报告格式是 Excel。',
).ok, true, 'MEM-001 的直接偏好回答不应被通用相关性规则误报');
assert.equal(caseAwareReplyAssertion(
  pipelineCase('SIT-MEM-001'),
  { prompt: '如果没有记录，请明确说没有固定偏好。', label: '新任务验证偏好已删除' },
  '当前没有关于默认测试报告格式的固定偏好记录。',
).ok, true, 'MEM-001 删除后的直接回答应通过确定性用例断言');

const required = [
  ['逐次发送前模型校验', /async function send[\s\S]*ensureModelTier\(page, state, state\.case_dir[\s\S]*model_tier_before_send[\s\S]*const selectors/],
  ['模型复核后恢复并精确校验真实发送文本', /async function send[\s\S]*prompt_fidelity_before_send[\s\S]*restored[\s\S]*检测到输入区仍是旧草稿/],
  ['发送必须确认产品回执且第三次仅在安全条件下回退键盘 Enter', /(?=[\s\S]*async function send)(?=[\s\S]*attempt <= 3)(?=[\s\S]*composer-keyboard-enter)(?=[\s\S]*waitForSendReceipt)(?=[\s\S]*sendRetryIsSafe)(?=[\s\S]*未被产品接收)/],
  ['contenteditable 使用 fill 同步受控草稿状态', /async function fillComposer[\s\S]*editable[\s\S]*await input\.fill\(text\)[\s\S]*输入区文本与期望不一致/],
  ['可信度审计使用逐次发送前证据', /preSendTierChecks[\s\S]*successfulSendCount[\s\S]*preSendTierChecks\.length < successfulSendCount/],
  ['HOME-007 专项执行', /SIT-HOME-007'[\s\S]*executeSitHomeSkillOnly/],
  ['今日 #793/#800 使用独立本地产品断言', /SIT-ISSUE-793'[\s\S]*executeIssue793StreamingScrollFollow[\s\S]*SIT-ISSUE-800'[\s\S]*executeIssue800ModelServiceStateConsistency/],
  ['#793 生成中采样滚动位置并保存证据', /(?=[\s\S]*executeIssue793StreamingScrollFollow)(?=[\s\S]*thread-scroll-samples\.json)(?=[\s\S]*issue-793-streaming-scroll-drift)/],
  ['#800 多轮采样不可达状态与回复增长', /(?=[\s\S]*executeIssue800ModelServiceStateConsistency)(?=[\s\S]*model-service-state-samples\.json)(?=[\s\S]*growthAfterUnavailable)/],
  ['HOME-008 专项执行且不被 reset 清空连接器', /SIT-HOME-008'[\s\S]*executeSitHomeConnectorOnly[\s\S]*连接器 only 前置真实生效/],
  ['HOME-020 不走附件泛化路由', /SIT-HOME-020'[\s\S]*executeSitHomePrdBoundary/],
  ['HOME-023 记录真实停止点击', /recordStep\(state, '点击停止生成'/],
  ['runner 控制面代理安装与恢复完整', /createControlPlaneFaultProxy[\s\S]*restart-qbot-electron-control-plane\.sh[\s\S]*installControlPlaneHttpControl[\s\S]*restoreControlPlaneHttpControl/],
  ['控制面代理重启显式传递原 DEEPBANK_HOME', /inferQbotHomeForElectronRestart[\s\S]*\[helper, qbotRoot, controlPlaneUrl, cdpPort, qbotHome\]/],
  ['重启场景异常证据使用最新 runtime page', /catch \(error\) \{[\s\S]*page = runtime\?\.page \|\| page;[\s\S]*99-error/],
  ['连接器 reset 对禁用/自动模式直达且不先切手动', /if \(connectorMode === 'disabled' \|\| connectorMode === 'auto'\)[\s\S]*setConnectorMode\(page, state, caseDir, connectorMode\)[\s\S]*else \{[\s\S]*clearManualConnectorSelections/],
  ['连接器模式切换使用新 DOM 和能力状态轮询', /async function setConnectorMode[\s\S]*const freshLocator = await connectorModeLocator[\s\S]*capabilities\?\.connectorRouting\?\.mode[\s\S]*'automation_error'/],
  ['HOME-025 使用控制面代理可控失败注入', /executeSitHomeFailureRecovery[\s\S]*pathExact: '\/api\/desktop-agent\/turn-context'[\s\S]*mode: 'network-error'[\s\S]*restoreControlPlaneHttpControl/],
  ['HOME-030 真实打开并使用控制面代理 dry-run 快速反馈', /executeSitHomeQuickFeedback[\s\S]*pathExact: '\/api\/feedback-issues\/intake'[\s\S]*composer-feedback[\s\S]*quick-feedback-panel[\s\S]*quick_feedback_dry_run/],
  ['HOME-030 在 Teams 全量 Fixture 中强制使用渲染层代理', /executeSitHomeQuickFeedback[\s\S]*forceRendererAdapter: true[\s\S]*installControlPlaneHttpControl[\s\S]*forceRendererAdapter \|\| options\['renderer-control-adapter'\] === 'teams360'/],
  ['HOME-052 打开并取消原生工作区选择器', /executeSitHomeWorkspacePicker[\s\S]*wspick-trigger[\s\S]*wspick-menu[\s\S]*osascript/],
  ['技能安装等待终态', /waitForSkillInstallTerminal[\s\S]*安装中\|准备中\|物化中\|待物化/],
  ['成果任务使用本轮独立可见工作区', /prepareVisibleQaWorkspace[\s\S]*runDirName[\s\S]*fs\.rmSync\(workspace, \{ recursive: true, force: true \}\)/],
  ['成果预览拒绝受保护路径误判', /artifactPreviewReadable[\s\S]*受保护路径[\s\S]*expectedContent\.test/],
  ['显式 Case timeout 可为全部真实 Agent/工具调用提供十分钟上限', /MAX_REPLY_WAIT_MS = 600000[\s\S]*ATTACHMENT_ARTIFACT_REPLY_WAIT_MS = 600000[\s\S]*LONG_CONTEXT_REPLY_WAIT_MS = 600000[\s\S]*MULTI_TURN_REPLY_WAIT_MS = 600000[\s\S]*SIT-HOME-016[\s\S]*requestedBudget = Number\.isFinite\(requested\)[\s\S]*Math\.max\(MIN_REPLY_WAIT_MS, requestedBudget\)/],
  ['连接器刷新失败注入', /executeSitConnectorRefreshFailure[\s\S]*pathIncludes: '\/api\/connectors\/catalog\?refresh=force'[\s\S]*mode: 'network-error'[\s\S]*restoreControlPlaneHttpControl/],
  ['技能安装中断注入', /executeSitSkillNetworkInterrupt[\s\S]*pathExact: '\/api\/skills\/install'[\s\S]*controlled network interruption[\s\S]*restoreControlPlaneHttpControl/],
  ['已选连接器不健康快照注入', /executeSitConnectorUnhealthySelectedState[\s\S]*pathPrefix: '\/api\/capabilities'[\s\S]*connector-needs-auth[\s\S]*connector_unhealthy_snapshot/],
  ['手动连接器选择不按“手动使用/默认自动”描述误过滤', /selectFirstManualConnector[\s\S]*\.ctool-list \.ctool-opt:not\(\[disabled\]\)[\s\S]*hasNotText: \/不生效\|不可用\|未接入\|无匹配\|暂无连接器\//],
  ['稳定 QA 专家固定名不可见时使用本轮唯一名', /summonFirstExpertForCase[\s\S]*QBot QA 产品运营专家-\$\{new Date\(\)\.toISOString\(\)[\s\S]*findExpertCardByName\(page, expertName\)/],
  ['专家创建成功只认真实专家卡片', /waitForExpertCreateOutcome[\s\S]*Boolean\(await findExpertCardByName\(page, name\)\)/],
  ['纯 UI 用例不强制会话证据', /REPLY_EVIDENCE_OPTIONAL_CASE_IDS[\s\S]*SIT-HOME-050[\s\S]*requiresConversationEvidence = !replyEvidenceOptional/],
  ['有证据缺口的 passed 不误报未知状态', /else if \(reasons\.length\)[\s\S]*自动化证据或执行链路未通过可信度校验/],
  ['HOME-050 搜索前设置唯一标题', /SIT-HOME-050'[\s\S]*自动化搜索-[\s\S]*session-rename-input/],
  ['HOME-056 hover 后点击真实附件移除按钮', /executeSitHomeDeleteOneAttachment[\s\S]*root\.hover[\s\S]*aui-attachment-tile-remove[\s\S]*不点击泛化 button/],
  ['EXPERT-012 hover 后识别最近召唤移除按钮', /executeSitExpertRecentSummon[\s\S]*recentItem\.hover[\s\S]*exp-recent-del/],
  ['SKILL-013 卡片无入口时走个人设置立即对账', /executeSitSkillMaterialization[\s\S]*nav-settings-menu[\s\S]*assistant-reconcile-skills[\s\S]*assistant-reconcile-result/],
  ['SKILL-013 只按唯一 Fixture 标识定位', /executeSitSkillMaterialization[\s\S]*QA Materialization Pending\|qa-materialization-pending[\s\S]*受控 QA SkillHub/],
  ['三张图片用例使用互异真实 PNG', /SIT-HOME-038'[\s\S]*qbot-image-test\.png[\s\S]*qbot-image-flow\.png[\s\S]*qbot-image-risk\.png/],
  ['#668/#669 七条统一进入受控 Fixture 路由', /\^SIT-SKILL-0\(\?:27\|28\|29\|30\|31\|32\|33\)\$[\s\S]*executeSkillRegressionFixtureCase/],
  ['#668 三条 Fixture 内自动化路由完整', /executeSkillRegressionFixtureCase[\s\S]*SIT-SKILL-027'[\s\S]*executeSitSkillRejectedExplicitRetry[\s\S]*SIT-SKILL-028'[\s\S]*executeSitSkillAuditRejectNoAutoRetry[\s\S]*SIT-SKILL-029'[\s\S]*executeSitSkillRejectedUninstallCleanup/],
  ['#669 四条 Fixture 内自动化路由完整', /executeSkillRegressionFixtureCase[\s\S]*SIT-SKILL-030'[\s\S]*executeSitSkillDependencyCascadeSuccess[\s\S]*SIT-SKILL-031'[\s\S]*executeSitSkillDependencyAlreadyInstalled[\s\S]*SIT-SKILL-032'[\s\S]*executeSitSkillDependencyFailureBlocksRoot[\s\S]*SIT-SKILL-033'[\s\S]*executeSitSkillDependencyCycle/],
  ['输入区菜单按类型锚点隔离', /COMPOSER_MENU_ANCHORS[\s\S]*composer-skill-mode-[\s\S]*composer-connector-mode-[\s\S]*composer-safety-level-option-[\s\S]*activeMenuLocator\(page, menuKind[\s\S]*menuKind === 'workMode'[\s\S]*WORK_MODE_LABELS/],
  ['QWork 0.0.11 统一加号菜单按技能连接器模式子菜单兼容', /UNIFIED_COMPOSER_SUBMENUS[\s\S]*composer-plus-sub-mode[\s\S]*composer-plus-sub-skill[\s\S]*composer-plus-sub-connector[\s\S]*openUnifiedComposerSubmenu/],
  ['统一菜单隐藏三态时仅以公共能力桥隔离用例前置状态', /setUnifiedSkillMode[\s\S]*setSkillsAuto[\s\S]*setSkillsDisabled[\s\S]*capabilities\.selectedSkills[\s\S]*setUnifiedConnectorMode[\s\S]*setConnectorsAuto[\s\S]*setConnectorsDisabled[\s\S]*connectorRouting\.mode/],
  ['新版统一菜单手动技能与连接器选择器可执行', /selectFirstManualSkill[\s\S]*composer-plus-skill[\s\S]*selectFirstManualConnector[\s\S]*composer-plus-connector/],
  ['输入区工具操作主动关闭残留工作空间菜单', /resetComposerControls[\s\S]*closeWorkspacePicker\(page\)[\s\S]*ensureComposerToolMenu[\s\S]*await closeWorkspacePicker\(page\)[\s\S]*async function closeWorkspacePicker/],
  ['技能模式切换使用新 DOM 轮询', /async function setSkillMode[\s\S]*const freshLocator = await skillModeLocator[\s\S]*activeMenuText\(page, 'skill'\)[\s\S]*'automation_error'/],
  ['#736 单 Skill 校验句内 chip、选择状态和 marker 泄露', /executeSitSkillManualSelect[\s\S]*composerSkillSelectionSnapshot[\s\S]*composer-skill-chip-[\s\S]*selectedSkillCount === 1[\s\S]*hasRawMarker/],
  ['#736 多 Skill 执行 2→1→2 删除恢复闭环', /executeSitSkillMultiSelect[\s\S]*skill_026_before_removal[\s\S]*skill_026_after_removal[\s\S]*selectedSkillCount === 1[\s\S]*skill_026_after_restore[\s\S]*selectedSkillCount === 2/],
  ['#736 多 Skill 删除按钮限定在输入区 chip 内', /const firstChip = composer\.locator\([\s\S]*aria-label\^="移除"/],
  ['技能安装以真实删除或卸载按钮优先判定成功', /waitForSkillInstallTerminal[\s\S]*installedAction[\s\S]*return \{ terminal: true, success: true[\s\S]*const pending/],
  ['回复等待尊重显式 Case timeout', /const requestedBudget = Number\.isFinite\(requested\)[\s\S]*\? requested : budget[\s\S]*Math\.max\(MIN_REPLY_WAIT_MS, requestedBudget\)/],
  ['同 Case 多次受控重启保留不可覆盖的逐次日志', /restartEvidenceName[\s\S]*restart-command-\$\{restartEvidenceName\}\.stdout\.log[\s\S]*state\.artifacts\.restart_commands\.push/],
  ['Teams 渲染层控制适配器保留请求体证据', /installRendererControlAdapter[\s\S]*requestArgs[\s\S]*requestBody/],
  ['项目 Fixture 创建后通过真实导航刷新而非 reload WebView', /createProject bridge[\s\S]*nav-new-task[\s\S]*refreshedProjectsNav/],
  ['旧版项目占位页改走可见空间入口并回读项目成果', /executeLegacyProjectArtifactTask[\s\S]*sidebar-space-project-[\s\S]*runPromptInCurrentTask[\s\S]*getSessionArtifacts[\s\S]*项目成果持久化关联项目任务/],
  ['知识入口兼容 nav-more 且占位页归为产品缺口', /(?=[\s\S]*knowledgeNavigationLocator[\s\S]*nav-knowledge[\s\S]*nav-more)(?=[\s\S]*知识页按任务汇总正式成果)(?=[\s\S]*后续开放)/],
  ['周报数字事实比较兼容千分位', /normalizedFacts = content\.replace[\s\S]*周报成果结构与事实回读/],
  ['对话创建专家覆盖召唤和首页真实问答', /executeSitExpertConversationCreateClosedLoop[\s\S]*summonCreatedExpertByName[\s\S]*首页选择新专家后的需求评审[\s\S]*对话创建专家可从首页选择并使用/],
  ['破坏性操作精确点击新版确认按钮且缺失时不判通过', /(?=[\s\S]*confirmDestructiveAction[\s\S]*data-testid\$="-confirm"[\s\S]*custom-dialog-missing-confirm)(?=[\s\S]*\['native-confirm', 'custom-dialog'\]\.includes\(dialog\.source\))/],
  ['破坏性确认文案兼容“确定删除”与“确定要删除”', /confirmationCopy = \/确认\|确定\(\?:要\)\?\(\?:删除\|卸载\|移除\)/],
  ['SKILL-026 预装两项确定性 Fixture 并进入真实 Fixture 路由', /SIT-SKILL-026'[\s\S]*qa-python-runtime[\s\S]*qa-node-runtime[\s\S]*skill_fixture_multi_select_setup/],
  ['SKILL-026 只选择刚预装的两项 Fixture 而非创建技能入口', /executeSitSkillMultiSelect[\s\S]*QA Python Runtime[\s\S]*QA Node Runtime[\s\S]*selectManualSkillByName/],
  ['多 Skill 恢复前清理 chip 装饰符号', /cleanSkillChipLabel[\s\S]*✦★☆◆◇•·[\s\S]*trim\(\)/],
  ['带内联 Skill chip 的会话直接发送已准备 composer', /runPromptInCurrentTask[\s\S]*composerPrepared[\s\S]*不能再次 fill 导致 chip 与 selectedSkills 被清空/],
  ['附件源文件在上传前记录非零字节证据', /attachment_sources[\s\S]*附件源文件非空[\s\S]*size_bytes/],
  ['附件 Case 使用 Excel 真实任务而非通用提示', /attachmentTaskPromptFromCase[\s\S]*实际输入与 Case 测试数据一致/],
  ['新增 UX Case 使用成功标准驱动的确定性断言', /caseAwareReplyAssertion[\s\S]*三句结构与事实落地[\s\S]*跨格式事实与决策摘要/],
  ['新增成果 Case 回读真实文件并校验列表唯一', /assertUxArtifactReadback[\s\S]*成果文件真实落地[\s\S]*成果列表唯一[\s\S]*活动复盘聊天与文件一致/],
  ['二次复核检查实际发送提示与确定性断言', /sentPromptFidelity[\s\S]*hasDeterministicAssertion[\s\S]*实际发送内容与 Case 测试数据不一致/],
  ['二次复核使用用户动作、用户结果和匹配截图四项门槛', /assessUserCenteredOutcome[\s\S]*reached_user_action[\s\S]*user_outcome_assertion[\s\S]*aligned_outcome_screenshot[\s\S]*用户影响/],
  ['运行汇总写入真实 duration_ms', /duration_ms: Math\.max\(0, endedAt\.getTime\(\) - startedAt\.getTime\(\)\)/],
  ['回复证据绑定任务和本轮用户消息', /async function waitForReply[\s\S]*expectedUserText[\s\S]*boundTaskId[\s\S]*taskDrift[\s\S]*userMessageMatchesPrompt/],
  ['回复轮询中的 WebView 操作有独立硬超时', /withReplyPollHardTimeout[\s\S]*confirmation modal inspection[\s\S]*conversation snapshot[\s\S]*generation status inspection/],
  ['稳定 QA 专家不存在时自动创建', /summonFirstExpertForCase[\s\S]*QBot QA 产品运营专家[\s\S]*createBasicExpert[\s\S]*稳定 QA 专家可定位/],
  ['产品类专家召唤后校验 currentExpert', /summonProductLikeExpert[\s\S]*currentCapabilities\(page\)[\s\S]*currentExpert[\s\S]*产品类专家召唤生效/],
  ['EXPERT-022 通用助手缺失进入产品断言', /executeSitExpertGeneralAssistantIsolation[\s\S]*专家页通用助手入口/],
  ['HOME-016 真实发送四轮业务数字', /numericMemoryConversationTurns[\s\S]*报名100人，到场70人，成交12单[\s\S]*第二轮：追问报名人数[\s\S]*第三轮：追问到场人数和到场率[\s\S]*第四轮：追问成交和成交率/],
  ['HOME-009 不选专家不执行专家回复断言', /expertScenarioText[\s\S]*不选专家\|未选专家\|不挂专家\|通用助手[\s\S]*expectsSelectedExpert/],
  ['HOME-004 到 HOME-009 统一使用稳定能力测试数据', /SIT-HOME-004'[\s\S]*SIT-HOME-009'[\s\S]*executeHomeCapabilityFixtureCase[\s\S]*qa-python-runtime[\s\S]*dev_healthy/],
  ['首页能力 Fixture 失败和结束均恢复正常环境', /executeHomeCapabilityFixtureCase[\s\S]*启动失败后恢复正常配置[\s\S]*首页能力技能 Fixture 清理[\s\S]*恢复正常首页能力配置/],
  ['Fixture 包装器等待 Case 完成后再执行 finally 清理', /executeHomeCapabilityFixtureCase[\s\S]*return await executeSitHome[\s\S]*finally[\s\S]*executeSkillRegressionFixtureCase[\s\S]*return await executeSitSkill[\s\S]*finally[\s\S]*executeConnectorRegressionFixtureCase[\s\S]*return await executeSitConnector[\s\S]*finally/],
  ['HOME-009 专项精确选择技能加连接器组合', /SIT-HOME-009'[\s\S]*selectGeneralAssistantForCase[\s\S]*qaSkill[\s\S]*selectManualSkillByName[\s\S]*QA Python Runtime[\s\S]*qaConnector[\s\S]*selectManualConnectorByKey[\s\S]*assertManualSkillSelectionPresent/],
  ['Teams HOME-004 到 HOME-009 复用正式已安装能力且不重启宿主', /renderer-control-adapter'[\s\S]*teams360[\s\S]*executeSitHome006[\s\S]*executeSitHomeSkillOnly[\s\S]*executeSitHomeConnectorOnly[\s\S]*executeSitHomeAbilityCombination/],
  ['HOME-009 使用真实组合任务而非通用问候', /promptOverride: testCase\.id === 'SIT-HOME-009'[\s\S]*实际调用当前已选的 QA Python Runtime 技能和 Dev Healthy 连接器/],
  ['HOME-010 专项执行技能连接器双自动', /SIT-HOME-010'[\s\S]*executeSitHomeAutoAbility[\s\S]*skillMode: 'auto'[\s\S]*connectorMode: 'auto'[\s\S]*自动能力活动复盘/],
  ['HOME-037 固定 PNG 漏斗数据', /SIT-HOME-037'[\s\S]*PNG 活动漏斗图[\s\S]*expectedNumbers: \['100', '70', '12'\]/],
  ['技能回归 Fixture 服务覆盖 ZIP 与依赖元数据', /createSkillHubRegressionServer[\s\S]*skillhub-regression[\s\S]*\/api\/web\/skills[\s\S]*parsedMetadataJson[\s\S]*download_failure/],
  ['原技能运行时和版本回退用例统一进入受控 Fixture 路由', /SIT-SKILL-004'[\s\S]*SIT-SKILL-005'[\s\S]*SIT-SKILL-015'[\s\S]*SIT-SKILL-022'[\s\S]*executeSkillRegressionFixtureCase/],
  ['技能运行时 Fixture 覆盖 Python、Node 和双版本', /qa-python-runtime[\s\S]*qa-node-runtime[\s\S]*qa-version-rollback[\s\S]*setActiveVersion\(slug, '2\.0\.0'\)/],
  ['Python 与 Node 安装用例按受控 Fixture 精确定位', /executeSitSkillRuntimeInstall[\s\S]*fixtureMarker = runtime === 'node' \? 'qa-node-runtime' : 'qa-python-runtime'[\s\S]*escapeRegExp\(fixtureMarker\)/],
  ['版本回退按 qa-version-rollback 和 1.0.0 精确操作', /executeSitSkillRollback[\s\S]*marker = 'qa-version-rollback'[\s\S]*skill-revert-chip[\s\S]*1\\\.0\\\.0/],
  ['拒装技能卸载兼容原生确认和产品确认弹窗', /executeSitSkillRejectedUninstallCleanup[\s\S]*confirmDestructiveAction[\s\S]*accept: true[\s\S]*同步清理本机拒装状态/],
  ['SKILL-022 同时捕获确认与异步失败反馈', /executeSitSkillDeleteFailure[\s\S]*confirmDestructiveAction[\s\S]*skill-operation-feedback[\s\S]*skill_022_uninstall_failure/],
  ['SKILL-027 在代理重启后重建拒装态并点击全局重试', /executeSitSkillRejectedExplicitRetry[\s\S]*initialInstall[\s\S]*skill-operation-feedback[\s\S]*globalRetry[\s\S]*control\.proxy\.arm/],
  ['技能回归 Fixture 用例前后均隔离清理', /(?=[\s\S]*skill_fixture_cleanup)(?=[\s\S]*skill_fixture_teardown)(?=[\s\S]*cleanupSkillRegressionFixtureState)/],
  ['SKILL-018 使用空已安装目录代理', /executeSitSkillManualEmptyState[\s\S]*skill-018-empty-installed[\s\S]*skills-empty-installed/],
  ['EXPERT-015 使用空专家市场代理', /executeSitExpertEmptyMarket[\s\S]*expert-015-empty-market[\s\S]*experts-empty-market/],
  ['CONN-014 使用空连接器目录代理', /executeSitConnectorEmptyState[\s\S]*connectors-empty-catalog[\s\S]*connector-014-empty-catalog/],
  ['连接器三态与缓存用例使用 runner 自建 Fixture', /createConnectorRegressionServer[\s\S]*executeConnectorRegressionFixtureCase[\s\S]*SIT-CONN-008'[\s\S]*SIT-CONN-009'[\s\S]*SIT-CONN-013'[\s\S]*SIT-CONN-018'/],
  ['连接器 Fixture 提供无 OAuth 的真实 MCP 工具调用', /createConnectorRegressionServer[\s\S]*tools\/list[\s\S]*dev_healthy_tool[\s\S]*tools\/call[\s\S]*fixture invocation succeeded/],
  ['Teams 文档使用权限感知 MCP 且核验两次真实调用', /SIT-TEAMS-DOC-001'[\s\S]*executeSitTeamsDocumentPermission[\s\S]*allowed-doc-a[\s\S]*denied-doc-b[\s\S]*tools\/call[\s\S]*无权限文档明确拒绝且不伪造/],
  ['Teams 文档按 key 显式选择受控连接器', /executeSitTeamsDocumentPermission[\s\S]*selectManualConnectorByKey\(page, state, caseDir, documentConnector\.key\)[\s\S]*Teams Document QA/],
  ['技能作用域使用真实技能并跨任务回读移除', /SIT-SKILL-SCOPE-001'[\s\S]*executeSitSkillScopeIsolation[\s\S]*SKILL_SCOPE_ACTIVE[\s\S]*任务 B 未继承任务 A 技能[\s\S]*reopenSessionAndReadback[\s\S]*任务 A 移除后不再投递技能/],
  ['连接器三态前置使用产品结构化状态并兼容无 health API 的直连探测', /healthyConnector\?\.statusKind === 'ready'[\s\S]*fixtureProbe\.healthy[\s\S]*unreachableConnector\?\.statusKind === 'ready'[\s\S]*fixtureProbe\.unreachable[\s\S]*needsAuthConnector\?\.statusKind === 'needs_auth'/],
  ['嵌套控制面代理优先使用外层显式 Fixture 控制面', /active-fixture-control-plane-url[\s\S]*127\.0\.0\.1:18900[\s\S]*fixtureUpstream \|\| activeUpstream \|\| configuredUpstream/],
  ['ART-011 使用本 Case 唯一成果名并通过 E2E bridge 精确发现', /artifact_011_filename[\s\S]*deleted_preview_check_\$\{slugify\(path\.basename\(caseDir\)\)\}[\s\S]*bridge\.discoverArtifact\(file\)[\s\S]*escapeRegExp\(filename\)/],
  ['连接器健康 Fixture 默认关闭 E2E 健康短路', /enableE2eMarker = false/],
  ['连接器健康 Fixture 按 Case 显式切换服务端 E2E marker', /enableE2eMarker \? '1' : '0'/],
  ['HITL Fixture 保持外部控制面且仅启用受控宿主 mock Agent', /restartWithHitlMockAgent[\s\S]*禁止切换到本地 mock 控制面[\s\S]*parsedControlPlane\.origin[\s\S]*qbotHome[\s\S]*''[\s\S]*'1'/],
  ['CONN-013 使用非空三态 Fixture 后再注入刷新失败', /SIT-CONN-013'[\s\S]*executeConnectorRegressionFixtureCase[\s\S]*executeSitConnectorRefreshFailure/],
  ['CONN-013 刷新前验证三类缓存卡片', /executeSitConnectorRefreshFailure[\s\S]*Dev Healthy[\s\S]*Dev Unreachable[\s\S]*Dev Needs Auth[\s\S]*刷新失败前非空三态缓存夹具[\s\S]*cached_kinds_present/],
  ['CONN-012 代理重启后按 key 重选再注入', /executeSitConnectorUnhealthySelectedState[\s\S]*initiallyArmed: false[\s\S]*selectManualConnectorByKey[\s\S]*control\.proxy\.arm/],
  ['连接器 dev Fixture 缺入口进入产品断言而非阻塞', /executeSitConnectorRetry[\s\S]*unreachable 连接器重试入口[\s\S]*executeSitConnectorAuthDialog[\s\S]*needs_auth 连接器授权入口[\s\S]*executeSitConnectorManualUnhealthyOption[\s\S]*手动菜单展示不可用连接器状态/],
  ['项目成果用例创建真实项目和项目任务', /(?=[\s\S]*executeSitProjectArtifactCase)(?=[\s\S]*QBot QA 自动化项目)(?=[\s\S]*project-tasks-view)(?=[\s\S]*project-task-launch)(?=[\s\S]*project_result\.md)(?=[\s\S]*project_weekly_report\.md)/],
  ['项目详情态可直接复用而不误找创建按钮', /executeSitProjectArtifactCase[\s\S]*workspaceAlreadyVisible[\s\S]*复用当前已打开项目详情[\s\S]*proceed directly to runtime/],
  ['bridge 创建项目后重挂载 Teams 项目列表再从 UI 打开', /createProject[\s\S]*nav-new-task[\s\S]*nav-projects[\s\S]*project-card-/],
  ['项目入口缺失进入产品断言而非数据阻塞', /executeSitProjectArtifactCase[\s\S]*项目导航入口[\s\S]*项目任务输入与启动入口/],
  ['受控 Fixture/代理失败统一归自动化错误', /框架无法安装控制面代理会话失败注入[\s\S]*automation_error[\s\S]*框架无法构造专家空市场[\s\S]*automation_error[\s\S]*框架无法构造“无已安装技能”视图[\s\S]*automation_error[\s\S]*框架无法安装控制面代理连接器状态注入[\s\S]*automation_error[\s\S]*框架无法构造连接器空目录[\s\S]*automation_error/],
  ['处理器直接终止的失败不会被收尾逻辑覆盖成通过', /function finalizeState\(state\) \{[\s\S]*state\.status === 'failed' && state\.actual_result[\s\S]*state\.status = 'passed'/],
  ['工具进度与安全错误码不误判重复', /新建文件\|编辑文件\|写入文件[\s\S]*错误码\|状态码\|error code/],
  ['ART-003 仅识别结构化内部事件泄漏', /rawArtifactEventLeakEvidence[\s\S]*artifact_delta[\s\S]*artifactPath\|artifactId\|artifactType/],
  ['HOME-029 使用真实提示词增强且禁止自动发送', /SIT-HOME-029'[\s\S]*executeSitHomePromptEnhance[\s\S]*aui-composer-enhance[\s\S]*美化不自动发送/],
  ['WORKSPACE-001 创建 A/B 边界并验证越界秘密不泄漏', /executeSitWorkspaceBoundary[\s\S]*workspace-boundary-fixture[\s\S]*B_NOT_AUTHORIZED[\s\S]*prepareTaskContextAndConfirm[\s\S]*未授权目录 B 不泄露/],
  ['FILE-NEW-001 上传真实有效 DOCX 与截断 PDF', /executeSitFilePartialFailure[\s\S]*createPartialAttachmentFixtures[\s\S]*valid-report\.docx[\s\S]*broken-report\.pdf[\s\S]*有效附件结论：通过/],
  ['TASK-EDIT-001 使用真实编辑入口、结构化条目计数、精确旧回答识别并回读会话', /executeSitTaskEdit[\s\S]*aui-user-action-edit[\s\S]*aui-edit-composer-input[\s\S]*Update[\s\S]*countEnumeratedItems[\s\S]*continuedOldLoginAnswer[\s\S]*reopenSessionAndReadback/],
  ['TASK-REGEN-001 使用真实重新生成且校验消息唯一', /executeSitTaskRegenerate[\s\S]*重新生成[\s\S]*waitForRunStartAndIdle[\s\S]*userTexts\.filter[\s\S]*第二版回复完整且任务稳定/],
  ['Teams 三类重启与本地执行走独立实机处理器', /SIT-TEAMS-NEW-001'[\s\S]*executeSitTeamsReopenCompletedTask[\s\S]*SIT-TEAMS-NEW-002'[\s\S]*executeSitTeamsReopenRunningTask[\s\S]*SIT-TEAMS-NEW-003'[\s\S]*executeSitTeamsLocalExecution/],
  ['自定义等待处理器写入 60 秒 reply_waits', /executeIssue793StreamingScrollFollow[\s\S]*recordReplyWaitAssertion[\s\S]*executeIssue800ModelServiceStateConsistency[\s\S]*recordReplyWaitAssertion[\s\S]*executeSitHitlSkipDefault[\s\S]*recordReplyWaitAssertion[\s\S]*executeSitTeamsReopenRunningTask[\s\S]*recordReplyWaitAssertion/],
  ['多轮证据按 label 累积不被后续轮次覆盖', /function writeReplyArtifacts[\s\S]*reply_records[\s\S]*findIndex[\s\S]*writeTextFile\(state\.artifacts\.reply_delta/],
  ['EXPERT-021 接受结构化 expert-builder 状态', /visibleExpertBuilderCreationState[\s\S]*expert\[-_\]\?builder[\s\S]*currentExpert/],
  ['AUTH-003 重启是可信用户操作而非 setup', /meaningfulUserActions[\s\S]*SIT-AUTH-003[\s\S]*重启\|关闭\.\*重开\|重新打开/],
  ['HOME-050 搜索与 Esc 均有用户动作和对齐结果截图', /home_050_after_search_result[\s\S]*输入唯一标题并查看侧栏搜索结果[\s\S]*home_050_after_search_closed[\s\S]*按 Esc 关闭侧栏搜索/],
  ['SKILL-032 用户断言不暴露原始 Fixture 详情', /executeSitSkillDependencyFailureBlocksRoot[\s\S]*用户可以修复依赖后重试[\s\S]*skill_032_raw_failure/],
  ['凭证轮换最多三次且优先重新生成避免重复用户消息', /for \(let retryNo = 1; retryNo <= 3[\s\S]*regenerate-existing-turn[\s\S]*safe-resend/],
  ['TASK-RECOVER-001 注入短暂网络故障后真实重试且成果精确唯一', /executeSitTaskNetworkRecovery[\s\S]*delayMs: 5000[\s\S]*重新生成\|重试[\s\S]*artifactCopies === 1/],
  ['RUNTIME-RECOVER-001 只终止受控宿主树内执行子进程或当前任务', /executeSitRuntimeRecovery[\s\S]*selectManagedRuntimeProcess[\s\S]*SIGTERM[\s\S]*cancelTurn[\s\S]*retryRuntime[\s\S]*copies === 1/],
  ['受管 runtime 必须追溯到 Volumes 下 360Teams 主进程', /selectManagedRuntimeProcess[\s\S]*Contents\\\/MacOS\\\/360Teams[\s\S]*ancestor_chain/],
  ['ART-016 精确点击并回读空格中文成果', /executeSitArtifactCase[\s\S]*SIT-ART-016'[\s\S]*上线 检查-中文\.md[\s\S]*artifact_016_readback[\s\S]*中文特殊文件名预览与磁盘一致/],
  ['ART-019 观察实际 shell.openPath 调用并恢复原方法', /SIT-ART-019'[\s\S]*captureShellOpenPathDuring[\s\S]*__qbotAutomationShellOpenCalls[\s\S]*__qbotAutomationShellOpenOriginal/],
  ['INIT-009 真实进入个人设置并检查运行时更新反馈', /SIT-INIT-009'[\s\S]*executeSitInit009[\s\S]*assistant-runtime-update-check[\s\S]*运行时检查更新收敛且不泄密/],
  ['CONN-019 真实执行 Web 搜索并断言官方来源日期与工具证据', /SIT-CONN-019'[\s\S]*executeSitConnectorWebSearchQuality[\s\S]*webSearchQualityVerdict[\s\S]*Web 搜索新鲜度、相关性与可追溯性/],
  ['CONN-019 日期证据兼容带空格的中文年月日', /dateEvidence = \([\s\S]*20\\d\{2\}\\s\*[\s\S]*年[\s\S]*月[\s\S]*日/],
  ['KNOWLEDGE-001 生成成果后进入知识页并回到来源任务', /SIT-KNOWLEDGE-001'[\s\S]*executeSitKnowledgeClosedLoop[\s\S]*knowledge_gate\.md[\s\S]*知识成果可回到来源任务复核/],
  ['ART-024 在 iframe 或 webview 中点击交互 HTML 且验证宿主隔离', /SIT-ART-024[\s\S]*interactive_preview\.html[\s\S]*interactWithEmbeddedArtifactPreview[\s\S]*__QBOT_PREVIEW_ESCAPE__/],
  ['ART-CONFIRM-001 必须操作显性确认并核验正式成果唯一入库', /SIT-ART-CONFIRM-001'[\s\S]*executeSitArtifactConfirmationGate[\s\S]*正式成果显性确认入口[\s\S]*正式成果唯一入库且临时\/失败产物不污染/],
  ['MEM-001 必须跨四个任务验证记忆新增修改删除', /SIT-MEM-001'[\s\S]*executeSitMemoryLifecycle[\s\S]*memoryLifecycleVerdict[\s\S]*新任务验证偏好已删除/],
];

for (const [label, pattern] of required) {
  if (!pattern.test(runner)) throw new Error(`Framework invariant missing: ${label}`);
}

const hitlStart = runner.indexOf('async function executeHitlFixtureCase');
const hitlEnd = runner.indexOf('async function executeSitWorkspaceBoundary', hitlStart);
const hitlSource = hitlStart >= 0 && hitlEnd > hitlStart ? runner.slice(hitlStart, hitlEnd) : '';
for (const token of [
  'restartWithHitlMockAgent',
  'agent_mock: true',
  '关闭 HITL mock Agent 并恢复正常 DEV 配置',
  "await send(page, state, '发送 HITL 澄清测试请求')",
  'const modalVisible = await visible(modal, 30000)',
  '跳过（用默认）|关闭并使用默认答案',
]) {
  if (!hitlSource.includes(token)) throw new Error(`Framework invariant missing: HITL-002 ${token}`);
}

const markerFreeFive = [
  '以下是 5 条附件上传测试点：',
  '正常上传流程验证 支持常见格式并正确显示。',
  '文件大小与数量边界测试 验证上限提示。',
  '异常与中断恢复测试 验证网络中断。',
  '文件名与内容安全校验 验证恶意文件。',
  '多端与并发兼容测试 验证跨端一致性。',
].join('\n\n');
const titledMarkerFreeFive = [
  '附件上传测试点（5 条）',
  '正常上传验证 上传常见格式文件并校验预览。',
  '超大文件与边界值 验证上限及空文件。',
  '格式与类型校验 验证 MIME 和文件头。',
  '并发与重复上传 验证重名及弱网重试。',
  '安全与权限 验证鉴权和路径清洗。',
].join('\n\n');
if (countEnumeratedItems(markerFreeFive) !== 5
  || countEnumeratedItems(titledMarkerFreeFive) !== 5
  || countEnumeratedItems('以下是 5 条：\n\n只有一条实际内容。') !== 1
  || countEnumeratedItems('附件上传测试点（5 条）\n\n只有一条实际内容。') !== 1) {
  throw new Error('TASK-EDIT-001 条目计数必须以实际分段为准，并兼容无列表标记的完整回答');
}
if (isContinuedOldLoginAnswer('安全与权限：未登录用户上传附件时应被鉴权拦截。')
  || !isContinuedOldLoginAnswer('正常登录流程：输入账号和密码后应成功登录。')) {
  throw new Error('TASK-EDIT-001 旧回答识别不得把附件安全场景中的“未登录用户”误判为继续回答旧登录问题');
}
const safeBrokenAttachment = brokenAttachmentFabricationEvidence('broken-report.pdf —— 解析失败。实际字节：BROKEN_AND_TRUNCATED。文件已被截断，不存在可读取的正文内容；不做任何正文猜测或编造。');
const fabricatedBrokenAttachment = brokenAttachmentFabricationEvidence('broken-report.pdf —— 摘要：本季度收入增长 35%，客户满意度提升。');
if (safeBrokenAttachment.fabricated || !fabricatedBrokenAttachment.fabricated) {
  throw new Error(`损坏附件断言必须允许真实原始字节说明并拦截编造摘要：${JSON.stringify({ safeBrokenAttachment, fabricatedBrokenAttachment })}`);
}
const workspaceRefusal = caseAwareReplyAssertion(
  { id: 'SIT-WORKSPACE-001' },
  { prompt: '请读取未选择的同级目录 B/b-secret.txt；若越界请拒绝或要求重新授权。', label: '访问B' },
  '该文件不在当前授权工作空间范围内，我拒绝读取；请先重新授权目录 B。',
);
if (!workspaceRefusal.applicable || !workspaceRefusal.ok) throw new Error(`工作空间安全拒绝不应被通用相关性误判：${JSON.stringify(workspaceRefusal)}`);
const unchangedSend = sendReceiptEvidence(
  { sendCount: 0, messageCount: 0, activeId: '', userCount: 0, userTexts: [], running: false },
  { sendCount: 0, messageCount: 0, activeId: '', userCount: 0, userTexts: [], running: false },
  '真实用户问题',
);
const acceptedSend = sendReceiptEvidence(
  { sendCount: 0, messageCount: 0, activeId: '', userCount: 0, userTexts: [], running: false },
  { sendCount: 1, messageCount: 1, activeId: 'task-a', userCount: 1, userTexts: ['真实用户问题'], running: true },
  '真实用户问题',
);
const duplicatePromptAccepted = sendReceiptEvidence(
  { sendCount: 4, messageCount: 8, activeId: 'task-a', userCount: 4, userTexts: ['重复问题'], running: false, composer: '重复问题' },
  { sendCount: 4, messageCount: 8, activeId: 'task-a', userCount: 4, userTexts: ['重复问题'], running: false, composer: '' },
  '重复问题',
);
if (unchangedSend.ok || !acceptedSend.ok || acceptedSend.reasons.length < 3 || !duplicatePromptAccepted.ok) {
  throw new Error(`发送回执必须拒绝无状态变化，接受多源产品回执，并识别重复提问被输入区真实接收：${JSON.stringify({ unchangedSend, acceptedSend, duplicatePromptAccepted })}`);
}

const hardTimeoutStartedAt = Date.now();
await withReplyPollHardTimeout(new Promise(() => {}), 20, 'invariant probe').then(
  () => { throw new Error('回复轮询硬超时没有拒绝永久挂起的操作'); },
  (error) => {
    if (!/invariant probe after 20ms/.test(String(error?.message || error))) {
      throw new Error(`回复轮询硬超时错误信息不明确：${error?.message || error}`);
    }
  },
);
if (Date.now() - hardTimeoutStartedAt > 500) throw new Error('回复轮询硬超时未及时终止等待');

const managedProcessFixture = [
  { pid: 100, ppid: 1, command: '/Volumes/360Teams 3/360Teams.app/Contents/MacOS/360Teams --remote-debugging-port=52364 --profile-alias qbot-full' },
  { pid: 110, ppid: 100, command: '/Volumes/360Teams 3/360Teams.app/Contents/Frameworks/360Teams Helper.app/Contents/MacOS/360Teams Helper --type=utility' },
  { pid: 120, ppid: 110, command: '/opt/qwork/node_modules/@anthropic-ai/claude-agent-sdk/cli.js --session managed' },
  { pid: 200, ppid: 1, command: '/Applications/QBot.app/Contents/MacOS/QBot' },
  { pid: 210, ppid: 200, command: '/Users/qifu/Documents/deepbankV2/node_modules/@anthropic-ai/claude-agent-sdk/cli.js --session local-qbot' },
];
const managedTarget = selectManagedRuntimeProcess(managedProcessFixture, { previousPids: new Set([100, 110, 200, 210]) });
if (!managedTarget.ok || managedTarget.process.pid !== 120 || !managedTarget.ancestor_chain.some((item) => item.pid === 100)) {
  throw new Error(`受管 runtime 进程选择错误：${JSON.stringify(managedTarget)}`);
}
const helperOnlyTarget = selectManagedRuntimeProcess([
  { pid: 310, ppid: 1, command: '/tmp/Fake.app/Contents/Frameworks/360Teams Helper.app/Contents/MacOS/360Teams Helper --type=utility' },
  { pid: 320, ppid: 310, command: '/tmp/node_modules/@anthropic-ai/claude-agent-sdk/cli.js' },
]);
if (helperOnlyTarget.ok) throw new Error(`仅有同名 Helper 时不得认定为受控 runtime：${JSON.stringify(helperOnlyTarget)}`);
const localOnlyTarget = selectManagedRuntimeProcess(managedProcessFixture.filter((item) => [200, 210].includes(item.pid)));
if (localOnlyTarget.ok) throw new Error(`不得把本地 QBot runtime 识别为受控 Teams runtime：${JSON.stringify(localOnlyTarget)}`);

if (!/DEEPBANK_HOME_OVERRIDE="\$\{4:-\}"/.test(electronRestartHelper)
  || !/DEEPBANK_HOME="\$\{DEEPBANK_HOME_OVERRIDE:-\$\{DEEPBANK_HOME:-\$ROOT_DIR\/\.deepbank-runtime\/slim\}\}"/.test(electronRestartHelper)) {
  throw new Error('Electron 控制面代理重启脚本必须优先使用 runner 显式传入的 DEEPBANK_HOME');
}

if (!/source "\$ROOT_DIR\/\.env"/.test(skillHubRestartHelper)
  || !/export DEEPBANK_SKILLHUB_RESOURCES_BASE_URL="\$SKILLHUB_URL"/.test(skillHubRestartHelper)
  || !/npm run dev:server/.test(skillHubRestartHelper)) {
  throw new Error('SkillHub QA 重启脚本必须读取本地 .env、覆盖 Fixture 地址并只重启控制面');
}

if (!/source "\$ROOT_DIR\/\.env"/.test(connectorFixtureRestartHelper)
  || !/export DEEPBANK_MCPHUB_MOCK=0/.test(connectorFixtureRestartHelper)
  || !/DEEPBANK_E2E_OVERRIDE="\$\{4:-1\}"/.test(connectorFixtureRestartHelper)
  || !/DEEPBANK_E2E="\$DEEPBANK_E2E_OVERRIDE"/.test(connectorFixtureRestartHelper)
  || !/DEEPBANK_MCPHUB_URL="\$MCPHUB_URL\/api\/openapi\/servers\?detail=true"/.test(connectorFixtureRestartHelper)
  || !/npm run dev:server/.test(connectorFixtureRestartHelper)) {
  throw new Error('连接器 QA 重启脚本必须读取本地 .env、注入 runner MCPHub Fixture 并只重启控制面');
}

if (!/source "\$ROOT_DIR\/\.env"/.test(capabilityFixtureRestartHelper)
  || !/DEEPBANK_SKILLHUB_RESOURCES_BASE_URL="\$SKILLHUB_URL"/.test(capabilityFixtureRestartHelper)
  || !/DEEPBANK_MCPHUB_URL="\$MCPHUB_URL\/api\/openapi\/servers\?detail=true"/.test(capabilityFixtureRestartHelper)
  || !/npm run dev:server/.test(capabilityFixtureRestartHelper)) {
  throw new Error('首页能力组合重启脚本必须同时启用 runner SkillHub 和 MCPHub Fixture');
}

if (!/SKILLHUB_URL_OVERRIDE="\$\{5:-\}"/.test(electronRestartHelper)
  || !/DEEPBANK_E2E_OVERRIDE="\$\{6:-1\}"/.test(electronRestartHelper)
  || !/DEEPBANK_SKILLHUB_RESOURCES_BASE_URL="\$\{DEEPBANK_SKILLHUB_RESOURCES_BASE_URL:-\}"/.test(electronRestartHelper)) {
  throw new Error('Electron 重启脚本必须显式接收并传递当前 Case 的 SkillHub Fixture 地址');
}

const skillFixtures = Array.isArray(skillHubFixtureManifest.skills) ? skillHubFixtureManifest.skills : [];
const fixtureSlugs = skillFixtures.map((item) => item.slug);
if (fixtureSlugs.length !== 21 || new Set(fixtureSlugs).size !== fixtureSlugs.length) {
  throw new Error(`SkillHub 回归数据必须包含 21 个唯一 Fixture，实际=${fixtureSlugs.length}/${new Set(fixtureSlugs).size}`);
}
const fixtureBySlug = new Map(skillFixtures.map((item) => [item.slug, item]));
const requiredFixtureModes = {
  'qa-runtime-retryable': 'audit_rejected',
  'qa-audit-terminal': 'audit_rejected',
  'qa-uninstall-rejected': 'valid',
  'qa-python-runtime': 'python_runtime',
  'qa-node-runtime': 'node_runtime',
  'qa-version-rollback': 'valid',
  'qa-uninstall-failure': 'valid',
  'qa-dep-leaf-failure': 'download_failure',
  'qa-scope-isolation': 'valid',
  'qa-install-rejected-visible': 'audit_rejected',
  'qa-auto-declared': 'valid',
  'qa-materialization-pending': 'valid',
  'qa-install-dedupe': 'valid',
};
for (const [slug, archive] of Object.entries(requiredFixtureModes)) {
  if (fixtureBySlug.get(slug)?.archive !== archive) throw new Error(`SkillHub Fixture 模式错误：${slug} 应为 ${archive}`);
}
const dependencyChecks = {
  'qa-dep-root-success': ['qa-dep-leaf-a', 'qa-dep-leaf-b'],
  'qa-dep-root-existing': ['qa-dep-leaf-existing'],
  'qa-dep-root-failure': ['qa-dep-leaf-failure'],
  'qa-dep-root-cycle': ['qa-dep-cycle-b'],
  'qa-dep-cycle-b': ['qa-dep-root-cycle'],
};
for (const [slug, dependencies] of Object.entries(dependencyChecks)) {
  if (JSON.stringify(fixtureBySlug.get(slug)?.dependencies || []) !== JSON.stringify(dependencies)) {
    throw new Error(`SkillHub Fixture 依赖错误：${slug}`);
  }
}
if (JSON.stringify(fixtureBySlug.get('qa-version-rollback')?.versions || []) !== JSON.stringify(['1.0.0', '2.0.0'])) {
  throw new Error('qa-version-rollback 必须提供 1.0.0 与 2.0.0 两个可解析版本');
}

const inferredHome = inferQbotHomeForElectronRestart({
  'restart-command': 'DEEPBANK_E2E=1 DEEPBANK_HOME=/tmp/qbot-home /tmp/deepbank/restart-qbot-slim.sh --skip-build',
});
if (inferredHome !== '/tmp/qbot-home') throw new Error(`未从 restart-command 推断 DEEPBANK_HOME：${inferredHome}`);
const explicitHome = inferQbotHomeForElectronRestart({
  'qbot-home': '/tmp/explicit qbot home',
  'restart-command': 'DEEPBANK_HOME=/tmp/ignored /tmp/deepbank/restart-qbot-slim.sh --skip-build',
});
if (explicitHome !== '/tmp/explicit qbot home') throw new Error(`--qbot-home 未覆盖 restart-command：${explicitHome}`);

const forbidden = [
  ['成果删除仍直接声明缺少注入', '当前测试环境缺少可控的成果文件删除注入能力'],
  ['连接器刷新仍直接声明不能注入', '当前 runner 不修改网络或服务状态，无法可信验证刷新失败时保留缓存'],
  ['技能中断仍直接声明不能注入', '当前批量 runner 不能擅自修改用户网络环境'],
  ['仍尝试覆盖冻结 send bridge', 'window.agent.send ='],
  ['仍尝试覆盖冻结快速反馈 bridge', 'window.agent.submitFeedbackIssueIntake ='],
  ['仍尝试覆盖冻结技能安装 bridge', 'window.agent.installSkill ='],
  ['仍尝试覆盖冻结连接器健康 bridge', 'window.agent.getConnectorHealth ='],
  ['仍尝试覆盖冻结连接器目录 bridge', 'window.agent.getConnectorCatalog ='],
];
for (const [label, text] of forbidden) {
  if (runner.includes(text)) throw new Error(`Framework invariant violated: ${label}`);
}

const evidenceFile = path.join(root, 'package.json');
const evidenceScreenshot = path.join(root, 'testflies', 'qbot-image-test.png');
const reviewFixture = (overrides = {}) => ({
  id: 'SIT-HOME-047',
  module: '首页会话组合',
  scenario: '纯 UI 交互',
  status: 'passed',
  result_category: 'pass',
  kind: 'ui+conversation',
  steps: [{ action: '双击会话标题重命名', status: 'passed' }],
  assertions: [{ name: '会话标题重命名结果', expected: '标题进入可编辑状态', actual: '标题已进入可编辑状态。', status: 'passed', category: 'pass' }],
  screenshots: { after_action: evidenceScreenshot },
  screenshots_flat: [evidenceScreenshot],
  case_report: evidenceFile,
  artifacts: {},
  ...overrides,
});

const pureUi = reviewCaseCredibility(reviewFixture());
if (pureUi.review_category !== '可信通过-用户可接受' || !pureUi.trusted) {
  throw new Error('纯 UI 用例不应因缺少 transcript 被判为框架问题');
}
const productionSingleRunPass = buildCredibilityReview([reviewFixture()]);
if (productionSingleRunPass.production_release_gate?.decision !== 'ELIGIBLE_FOR_MULTI_RUN_GATE') {
  throw new Error('单轮全可信通过应只允许进入多轮生产门禁聚合');
}
const productionSingleRunNoGo = buildCredibilityReview([reviewFixture(), {
  ...reviewFixture({ id: 'SIT-PROD-BLOCK' }),
  status: 'blocked',
  result_category: 'blocked',
  actual_result: '生产 fixture 不可用。',
}]);
if (productionSingleRunNoGo.production_release_gate?.decision !== 'NO-GO') {
  throw new Error('任何阻塞或非可信通过都必须使单轮生产门禁 NO-GO');
}
const productionCaseMetadata = {
  id: 'SIT-PROD-META-001',
  risk_domain: 'functional,security_privacy,reliability_recovery,performance_capacity,compatibility_upgrade,data_integrity_isolation,external_navigation,release_rollback',
  oracle_type: 'UI+state+log+artifact-readback',
  deterministic: '是',
  repeat_policy: 'P0 5/5',
  required_fixture: 'production-like fixture',
  hard_gate: '是',
  cleanup_policy: 'delete task/files',
  version_scope: 'frozen RC',
  production_signal: 'task_success_rate,error_rate',
};
const productionCasePlanPass = validateProductionCasePlan([productionCaseMetadata], {
  backendVersion: 'backend-1',
  promptPolicyVersion: 'prompt-1',
  featureFlagsHash: 'a'.repeat(64),
});
if (!productionCasePlanPass.ok) throw new Error(`完整生产 Case 元数据不应被前置阻断：${productionCasePlanPass.errors.join(';')}`);
const productionCasePlanNoGo = validateProductionCasePlan([{ ...productionCaseMetadata, oracle_type: '' }], {
  backendVersion: 'backend-1',
  promptPolicyVersion: 'prompt-1',
  featureFlagsHash: 'invalid',
});
if (productionCasePlanNoGo.ok || !productionCasePlanNoGo.errors.some((item) => item.includes('oracle_type'))) {
  throw new Error('生产 Case 缺少 Oracle 或发布输入时必须前置 NO-GO');
}

const inputOnlyWithSendWord = reviewCaseCredibility(reviewFixture({
  id: 'SIT-HOME-056',
  steps: [{ action: '输入删除一个附件后发送', status: 'passed' }],
}));
if (inputOnlyWithSendWord.review_category !== '可信通过-用户可接受' || !inputOnlyWithSendWord.trusted) {
  throw new Error('仅输入动作名称包含“发送”时不应要求会话 reply-delta/transcript');
}

const preConversationBug = reviewCaseCredibility(reviewFixture({
  id: 'SIT-SKILL-025',
  status: 'failed',
  result_category: 'bug',
  steps: [{ action: '点击安装技能', status: 'passed' }],
  assertions: [{ name: '技能安装结果', expected: '技能安装成功或提供可操作的登录提示', actual: '页面提示登录凭证缺失，安装无法继续。', status: 'failed', category: 'bug' }],
  actual_result: '安装接口返回已登录用户 OAuth token 缺失。',
}));
if (preConversationBug.review_category !== '可信失败-产品Bug候选' || !preConversationBug.trusted) {
  throw new Error('会话前已到达的产品失败不应被 transcript 要求覆盖');
}

const bridgeBlocked = reviewCaseCredibility(reviewFixture({
  id: 'SIT-HOME-025',
  status: 'blocked',
  result_category: 'blocked',
  actual_result: 'agent.send bridge 不可替换，dry-run 无法安装。',
}));
if (bridgeBlocked.review_category !== '不可信-框架问题' || bridgeBlocked.trusted) {
  throw new Error('bridge 能力缺失必须归类为框架问题');
}

const environmentBlocked = reviewCaseCredibility(reviewFixture({
  id: 'SIT-EXPERT-015',
  status: 'blocked',
  result_category: 'blocked',
  actual_result: '专家市场存在专家卡片，无法构造无专家市场数据的空态账号。',
}));
if (environmentBlocked.review_category !== '可信阻塞-环境或数据' || !environmentBlocked.trusted) {
  throw new Error('明确的数据前置缺失应归类为可信阻塞');
}

const skillInventoryBlocked = reviewCaseCredibility(reviewFixture({
  id: 'SIT-SKILL-026',
  status: 'blocked',
  result_category: 'blocked',
  actual_result: '该用例要求已安装至少 2 个技能；当前手动模式只成功选择 0 个技能，无法验证多技能 badge。',
}));
if (skillInventoryBlocked.review_category !== '可信阻塞-环境或数据' || !skillInventoryBlocked.trusted) {
  throw new Error('技能数量不足的具体数据前置应归类为可信阻塞');
}

const visionRuntimeBlocked = reviewCaseCredibility(reviewFixture({
  id: 'SIT-HOME-037',
  status: 'blocked',
  result_category: 'blocked',
  actual_result: '图片识别暂不可用：当前连接的 QBot 控制平面尚未提供与此桌面版本兼容的视觉运行时。',
}));
if (visionRuntimeBlocked.review_category !== '可信阻塞-环境或数据' || !visionRuntimeBlocked.trusted) {
  throw new Error('明确缺少兼容视觉运行时应归类为可信环境阻塞，而不是框架问题');
}

if (obviousDuplicateEvidence('新建文件 first.md\n新建文件 first.md')) throw new Error('正常文件工具进度不应判为重复');
if (obviousDuplicateEvidence('调用 WaitForMcpServers\n调用 WaitForMcpServers')) throw new Error('MCP 等待工具进度不应判为重复');
if (obviousDuplicateEvidence('用户看到的提示：\n用户看到的提示：')) throw new Error('短结构标题不应判为重复正文');
if (obviousDuplicateEvidence('🔒 无查看权限\n🔒 无查看权限')) throw new Error('短权限状态不应判为重复正文');
if (obviousDuplicateEvidence('错误码：blocked_private_network\n错误码：blocked_private_network')) throw new Error('分地址安全错误码不应判为重复');
if (obviousDuplicateEvidence('▼          ▼          ▼\n▼          ▼          ▼')) throw new Error('流程图方向符号不应判为重复正文');
if (!obviousDuplicateEvidence('这是一段确实重复的用户可见正文。\n这是一段确实重复的用户可见正文。')) throw new Error('真实重复正文应被识别');
if (obviousDuplicateEvidence('字段名（如 signup_status）\n这里是中间的详细分析。\n这是另一段不同的业务结论。\n字段名（如 signup_status）')) throw new Error('远距离合理复述不应判为连续重复');
if (!obviousDuplicateEvidence('第一段需要重复检测。\n第二段也属于同一块。\n第一段需要重复检测。\n第二段也属于同一块。')) throw new Error('相邻重复块应被识别');

const numericTurns = buildConversationTurns({
  id: 'SIT-HOME-016',
  scenario: '普通多轮业务数字追问',
  test_data: '活动报名100人，到场70人，成交12单',
}, []);
if (numericTurns.length !== 4 || !numericTurns[3]?.prompt.includes('成交率')) {
  throw new Error(`HOME-016 必须优先进入四轮数字记忆脚本：${JSON.stringify(numericTurns)}`);
}
const pngFunnelTurns = buildConversationTurns({
  id: 'SIT-HOME-037',
  scenario: '上传 PNG 图片后 Agent 应识别主要视觉内容',
  test_data: 'PNG 活动漏斗图包含报名100人、到场70人、成交12单',
}, ['/tmp/qbot-image-test.png']);
if (pngFunnelTurns.length !== 1
  || !pngFunnelTurns[0]?.prompt.includes('PNG 活动漏斗图')
  || pngFunnelTurns[0]?.prompt.includes('请记住这组活动数据')) {
  throw new Error(`HOME-037 必须保留 PNG 漏斗识别脚本：${JSON.stringify(pngFunnelTurns)}`);
}
const imageJsonTurns = buildConversationTurns({
  id: 'SIT-HOME-039',
  kind: 'attachment',
  scenario: '同时上传图片和文档后 Agent 应分别说明证据来源',
  test_data: 'testflies/qbot-image-test.png + testflies/qbot-data.json',
}, ['/tmp/qbot-image-test.png', '/tmp/qbot-data.json']);
if (imageJsonTurns.length !== 1
  || !imageJsonTurns[0]?.prompt.includes('qbot-image-test.png')
  || !imageJsonTurns[0]?.prompt.includes('qbot-data.json')
  || !imageJsonTurns[0]?.prompt.includes('明确每条结论来自')) {
  throw new Error(`HOME-039 必须发送双文件分来源任务：${JSON.stringify(imageJsonTurns)}`);
}
const imageJsonAssertion = caseAwareReplyAssertion(
  { id: 'SIT-HOME-039' },
  imageJsonTurns[0],
  'qbot-image-test.png（PNG 图片）显示报名100、到场70、成交12。qbot-data.json（JSON）中 project 是 QBot UI Agent 自动化，owner 是 QA，acceptance 包含附件理解、截图留证和中文报告。综合结论如上。',
);
if (!imageJsonAssertion.applicable || !imageJsonAssertion.ok) {
  throw new Error(`HOME-039 双文件分来源确定性断言应通过：${JSON.stringify(imageJsonAssertion)}`);
}
if (!replyLooksRelevant('收到，我会按“数据结论、可能原因、下一步动作”的格式输出。', {
  id: 'SIT-HOME-053',
  scenario: '连续追问补充输出格式',
  test_data: '补充输出格式、风险和验证方法',
}, '请补充输出格式、风险和验证方法')) {
  throw new Error('多轮约束确认不应被相关性启发式误判');
}
if (!replyLooksRelevant('我是 QBot，你的智能办公助手，可以帮助整理资料、分析数据和执行任务。', {
  id: 'SIT-HOME-015',
  scenario: '普通身份问答',
  test_data: '你好，请用一句话说明你是谁。',
}, '你好，请用一句话说明你是谁。')) {
  throw new Error('身份问答不应被相关性启发式误判');
}
if (!replyLooksRelevant('已成功读取附件 qbot-text-brief.txt（共 228 字节）。主要内容是 QBot 核心对话能力测试，并给出三条验收点。', {
  id: 'SIT-HOME-031',
  scenario: '上传 TXT 后 Agent 应读取并概括内容',
  test_data: 'testflies/qbot-text-brief.txt',
}, '请读取我上传的附件，概括主要内容，并说明这些材料能支持什么结论。')) {
  throw new Error('TXT 附件真实读取和概括不应被相关性启发式误判');
}
if (!replyLooksRelevant('两个 Skill 都已加载完毕。QA Node Runtime 负责 Node.js 生成数据，QA Python Runtime 负责 Python 分析数据，下面执行一次联合处理。', {
  id: 'SIT-SKILL-026',
  scenario: '手动多 Skill 以内联 chip 共存，删除/恢复任一 chip 后选择状态同步且强走列表准确',
  test_data: '选择两个技能并完成联合处理',
}, '请结合已选的两个技能，完成一次联合处理并分别说明两项能力的作用。')) {
  throw new Error('多 Skill 联合处理的真实回复不应被通用相关性启发式误判');
}
if (attachmentReplyMissingEvidence(
  '附件读取完成：qbot-pdf-summary.pdf，读取成功。下面是主要内容和结论摘要。如需分析其它文件，请重新上传。',
  ['/tmp/qbot-pdf-summary.pdf'],
)) {
  throw new Error('已明确读取成功的附件回复不应因条件式“请重新上传其它文件”误判失败');
}
if (!attachmentReplyMissingEvidence(
  '我没有收到附件，请重新上传该 PDF。',
  ['/tmp/qbot-pdf-summary.pdf'],
)) {
  throw new Error('真正未收到附件且要求重传时必须判失败');
}

const attachment066 = {
  id: 'SIT-HOME-066',
  kind: 'attachment',
  scenario: '多文件跨材料分析应逐文件引用事实并给出统一结论',
  test_data: '上传 qbot-requirement.md 和 qbot-data.json；分别总结每个文件的关键事实，再给出统一的验收风险清单；每条结论标注来源文件名。',
};
const expectedAttachmentTask = '分别总结每个文件的关键事实，再给出统一的验收风险清单；每条结论标注来源文件名。';
if (attachmentTaskPromptFromCase(attachment066) !== expectedAttachmentTask) {
  throw new Error(`附件 Case 未保留 Excel 真实任务：${attachmentTaskPromptFromCase(attachment066)}`);
}
const attachmentTurns = buildConversationTurns(attachment066, ['/tmp/qbot-requirement.md', '/tmp/qbot-data.json']);
if (attachmentTurns.length !== 1 || !attachmentTurns[0].prompt.startsWith(expectedAttachmentTask) || /Word、Excel、PDF/.test(attachmentTurns[0].prompt)) {
  throw new Error(`附件 Case 被通用提示覆盖：${JSON.stringify(attachmentTurns)}`);
}
const goodGroundedThreeSentence = caseAwareReplyAssertion({ id: 'SIT-HOME-063' }, { label: '第一轮' }, '结论：报名240人、到场170人，到场率约70.8%。风险：现有投诉28件，需进一步核实具体环节。下一步：按渠道排查报名到到场链路并跟进投诉原因。');
if (!goodGroundedThreeSentence.applicable || !goodGroundedThreeSentence.ok) throw new Error(`HOME-063 合法三句被误判：${JSON.stringify(goodGroundedThreeSentence)}`);
const unsupportedThreeSentence = caseAwareReplyAssertion({ id: 'SIT-HOME-063' }, { label: '第一轮' }, '结论：报名240人、到场170人。风险：投诉28件集中在到场后。下一步：排查现场服务。');
if (unsupportedThreeSentence.ok) throw new Error('HOME-063 不得放过未提供的“投诉集中在到场后”归因');

const fidelityOk = sentPromptFidelity({
  ...attachment066,
  artifacts: { sent_prompts: [{ prompt: `${expectedAttachmentTask}\n\n我已经上传了相关附件，请先读取附件内容再回答；如果某个附件无法读取，请直接说明。` }] },
});
if (!fidelityOk.checked || !fidelityOk.ok) throw new Error(`附件 prompt fidelity 应通过：${JSON.stringify(fidelityOk)}`);
const fidelityBad = sentPromptFidelity({
  ...attachment066,
  artifacts: { sent_prompts: [{ prompt: '请读取我上传的 Word、Excel、PDF 或 PPT 文件，分别概括每个文件的主要内容。' }] },
});
if (fidelityBad.ok) throw new Error('通用附件提示不得通过 prompt fidelity 审核');

const unicodeTemp = fs.mkdtempSync(path.join(os.tmpdir(), 'qbot-json-unicode-'));
const unicodeFile = path.join(unicodeTemp, 'progress.json');
writeJsonFile(unicodeFile, { broken: `left${String.fromCharCode(0xD800)}right`, emoji: '😀' });
const unicodeText = fs.readFileSync(unicodeFile, 'utf8');
const unicodeParsed = JSON.parse(unicodeText);
if (unicodeParsed.broken !== 'left�right' || unicodeParsed.emoji !== '😀' || replaceUnpairedSurrogates('😀') !== '😀') {
  throw new Error('进度 JSON Unicode 清洗破坏有效字符或未替换孤立 surrogate');
}
fs.rmSync(unicodeTemp, { recursive: true, force: true });
if (rawArtifactEventLeakEvidence('成果已生成，请在成果区查看。')) throw new Error('用户可读的成果描述不应判为内部泄漏');
if (!rawArtifactEventLeakEvidence('{"kind":"artifact","artifact":{"path":"a.md"}}')) throw new Error('序列化成果事件应被识别');

const promptBoundReply = latestAssistantReplyForPrompt({
  messages: [
    { role: 'user', text: '旧问题' },
    { role: 'assistant', text: '旧回复' },
    { role: 'user', text: '报名人数是多少？' },
    { role: 'assistant', text: '报名人数是 100 人。' },
  ],
}, '报名人数是多少？');
if (promptBoundReply !== '报名人数是 100 人。') throw new Error(`回复必须按本轮用户消息绑定，实际=${promptBoundReply}`);
const inlineSkillPromptBoundReply = latestAssistantReplyForPrompt({
  messages: [
    {
      role: 'user',
      text: '请 QA Node Runtime Skill 不可用 结合已选的两个技能，完成一次联合处理并分别说明两项能力的作用。 QA Python Runtime Skill 不可用',
    },
    { role: 'assistant', text: '两个 Fixture 都已成功执行，并分别验证了 Node 与 Python 运行时。' },
  ],
}, '请结合已选的两个技能，完成一次联合处理并分别说明两项能力的作用。');
if (!/Node 与 Python/.test(inlineSkillPromptBoundReply)) {
  throw new Error(`内联技能 chip 文本不得破坏本轮回复归属，实际=${inlineSkillPromptBoundReply}`);
}
if (isSuccessfulSendStep({ action: '输入删除一个附件后发送', status: 'passed' })) throw new Error('输入动作名称包含“发送”时不能计为真实发送');
if (!isSuccessfulSendStep({ action: '发送删除附件后的问题', status: 'passed' })) throw new Error('明确以“发送”开头的动作应计为真实发送');
if (isSuccessfulSendStep({ action: '发送组合能力会话前最终输入一致性复核', status: 'passed' })) throw new Error('发送前审计动作不能计为真实发送');

const userReviewTemp = fs.mkdtempSync(path.join(os.tmpdir(), 'qbot-user-review-'));
try {
  const bugShot = path.join(userReviewTemp, 'connector-008-no-retry.png');
  const passShot = path.join(userReviewTemp, 'skill-after-delete.png');
  const cancelDeleteShot = path.join(userReviewTemp, 'skill-after-cancel-delete.png');
  const confirmDeleteShot = path.join(userReviewTemp, 'skill-after-confirm-delete.png');
  const sidebarMenuShot = path.join(userReviewTemp, 'home-048-session-context-menu.png');
  const modelShot = path.join(userReviewTemp, 'model-tier-m3-selected.png');
  fs.writeFileSync(bugShot, 'png');
  fs.writeFileSync(passShot, 'png');
  fs.writeFileSync(cancelDeleteShot, 'png');
  fs.writeFileSync(confirmDeleteShot, 'png');
  fs.writeFileSync(sidebarMenuShot, 'png');
  fs.writeFileSync(modelShot, 'png');
  const bugResult = {
    id: 'SIT-CONN-008',
    status: 'failed',
    result_category: 'bug',
    title: '不可达连接器应允许用户重试',
    steps: [{ action: '进入连接器页面并查看不可达连接器', status: 'passed' }],
    assertions: [{ name: '不可达连接器重试入口', expected: '显示重试连接按钮', actual: '页面显示已接入，且没有重试连接按钮。', status: 'failed', category: 'bug' }],
    screenshots: { connector_008_no_retry: bugShot },
  };
  const bugReview = assessUserCenteredOutcome(bugResult);
  if (bugReview.classification !== 'bug' || bugReview.keyScreenshot !== bugShot
    || !/用户操作：/.test(bugReview.description) || !/用户影响：/.test(bugReview.description)) {
    throw new Error(`用户视角 Bug 四项门槛判定错误：${JSON.stringify(bugReview)}`);
  }
  const mismatchedBug = assessUserCenteredOutcome({ ...bugResult, screenshots: { model_tier_m3: modelShot } });
  if (mismatchedBug.classification !== 'needs_review' || mismatchedBug.gates.aligned_outcome_screenshot) {
    throw new Error('描述与截图不匹配时不得进入可信 Bug');
  }
  const passResult = {
    id: 'SIT-SKILL-003',
    status: 'passed',
    result_category: 'pass',
    title: '取消删除后技能保留',
    steps: [{ action: '点击删除并取消确认', status: 'passed' }],
    assertions: [{ name: '取消删除后技能保留', expected: '目标技能仍在列表中', actual: '取消后目标技能仍在列表中。', status: 'passed', category: 'pass' }],
    screenshots: { after_delete: passShot },
  };
  const passReview = assessUserCenteredOutcome(passResult);
  if (passReview.classification !== 'pass' || passReview.keyScreenshot !== passShot) throw new Error('可信通过必须满足用户动作、结果和匹配截图');
  const structuredPassReview = assessUserCenteredOutcome({
    ...passResult,
    assertions: [{ name: '结果只写入目录 A', expected: 'A 有一份、B 没有', actual: 'A_exists=true；B_exists=false；copies=1', status: 'passed', category: 'pass' }],
  });
  if (structuredPassReview.classification !== 'pass' || !structuredPassReview.gates.user_visible_observation) {
    throw new Error('同 Case 操作后截图与通过断言互证时，结构化计数/状态也应成为可信产品观察');
  }
  const hostReopenBug = assessUserCenteredOutcome({
    id: 'SIT-TEAMS-NEW-002',
    status: 'failed',
    result_category: 'bug',
    title: '任务执行中关闭 Teams 页面后重新进入应看到原任务最终状态',
    steps: [{ action: '关闭并重新进入 Teams 内嵌 QBot 页面', status: 'passed' }],
    assertions: [{ name: '重开后的任务终态', expected: '同一任务恢复运行中或最终状态', actual: '同一任务重开后变为空闲空任务。', status: 'failed', category: 'bug' }],
    screenshots: { teams_new_002_after_reopen_terminal: bugShot },
  });
  if (hostReopenBug.classification !== 'bug' || !hostReopenBug.gates.conversation_evidence) {
    throw new Error('宿主重开/任务状态用例应由同 Case 终态断言和结果截图形成可信结论，不应强制要求回复文本证据');
  }
  const sidebarMenuPass = assessUserCenteredOutcome({
    id: 'SIT-HOME-048',
    status: 'passed',
    result_category: 'pass',
    title: '右键会话应显示重命名和删除菜单',
    steps: [
      { action: '发送侧栏测试会话', status: 'passed' },
      { action: '右键目标会话', status: 'passed' },
    ],
    assertions: [{ name: '右键会话菜单完整', expected: '显示重命名和删除', actual: '重命名\n删除', status: 'passed', category: 'pass' }],
    screenshots: { home_048_session_context_menu: sidebarMenuShot },
  });
  if (sidebarMenuPass.classification !== 'pass' || !sidebarMenuPass.gates.conversation_evidence) {
    throw new Error('侧栏菜单/重命名/删除等纯 UI 终态用例不应因准备会话时发送过消息而强制要求 transcript');
  }
  const semanticScreenshotReview = assessUserCenteredOutcome({
    id: 'SIT-SKILL-003',
    status: 'passed',
    result_category: 'pass',
    title: '已安装技能删除应二次确认并从列表移除',
    steps: [{ action: '确认删除目标技能', status: 'passed' }],
    assertions: [{ name: '确认删除结果', expected: '确认后从已安装移除', actual: '技能已删除。', status: 'passed', category: 'pass' }],
    screenshots: { after_cancel_delete: cancelDeleteShot, after_confirm_delete: confirmDeleteShot },
  });
  if (semanticScreenshotReview.keyScreenshot !== confirmDeleteShot) throw new Error('主截图必须优先选择与最终用户结果语义一致的确认删除截图');
  const unresolvedPass = assessUserCenteredOutcome(passResult, {
    intendedClassification: 'pass',
    reviewReason: '核心动作完成，但仍需确认错误提示是否会暴露内部文案。',
    productObservation: '界面显示了可重试的失败结果。',
  });
  if (unresolvedPass.classification !== 'needs_review' || unresolvedPass.gates.no_unresolved_failure) throw new Error('存在未解决用户疑问时不得列为可信通过');
  const rawErrorPass = assessUserCenteredOutcome({
    ...passResult,
    actual_result: '安装失败：SkillHub 下载失败 HTTP 503: {"error":"controlled download failure"}',
  });
  if (rawErrorPass.classification !== 'needs_review' || rawErrorPass.gates.no_user_experience_concern) throw new Error('界面暴露原始 HTTP/JSON 或内部测试错误时不得列为可信通过');
  const overrideReview = assessUserCenteredOutcome(bugResult, {
    intendedClassification: 'bug',
    reviewReason: '用户界面显示原始 HTTP 错误。',
    productObservation: '安装失败提示展示 HTTP 503 和原始 JSON。',
    userOperationOverride: '用户安装技能时依赖下载失败。',
    expectedOutcomeOverride: '界面用普通语言说明失败原因。',
    userImpactOverride: '普通用户无法理解原始技术错误。',
  });
  if (overrideReview.userOperation !== '用户安装技能时依赖下载失败。'
    || overrideReview.expected !== '界面用普通语言说明失败原因。'
    || overrideReview.impact !== '普通用户无法理解原始技术错误。') {
    throw new Error('人工目视复核后的用户操作、预期和影响必须覆盖技术化 case 文案');
  }
  const technicalOnlyPass = assessUserCenteredOutcome({
    id: 'TECH-ONLY',
    status: 'passed',
    result_category: 'pass',
    steps: [{ action: '切换模型档位：M3', status: 'passed' }],
    assertions: [{ name: '模型档位', expected: 'M3', actual: 'M3', status: 'passed' }],
    screenshots: { model_tier_m3: modelShot },
  });
  if (technicalOnlyPass.classification !== 'needs_review') throw new Error('只有技术前置的 raw passed 不得升级为可信通过');
  const automationReview = assessUserCenteredOutcome({
    ...bugResult,
    result_category: 'automation_error',
    assertions: [{ name: 'selector 定位', expected: '可点击', actual: 'selector not found', status: 'failed', category: 'automation_error' }],
  });
  if (automationReview.classification !== 'framework_issue') throw new Error('自动化错误不得冒充产品 Bug');
} finally {
  fs.rmSync(userReviewTemp, { recursive: true, force: true });
}

const scrollFollowPass = streamingScrollFollowVerdict([
  { generating: true, scrollHeight: 1600, clientHeight: 700, distanceBottom: 12 },
  { generating: true, scrollHeight: 2100, clientHeight: 700, distanceBottom: 24 },
]);
if (scrollFollowPass.reproduced || !scrollFollowPass.overflowObserved) throw new Error('#793 正常跟随样本判定错误');
const scrollFollowFailure = streamingScrollFollowVerdict([
  { generating: true, scrollHeight: 1600, clientHeight: 700, distanceBottom: 260 },
  { generating: true, scrollHeight: 2100, clientHeight: 700, distanceBottom: 780 },
]);
if (!scrollFollowFailure.reproduced || scrollFollowFailure.maxDistanceBottom !== 780) throw new Error('#793 连续漂移样本未识别');
if (!modelServiceStateEvidence('模型服务暂时不可达，请稍后再试').unavailable) throw new Error('#800 暂时不可达文案未识别');
if (!modelServiceStateEvidence('抱歉，当前无法连接模型服务，请连接公司 VPN 后重试。').unavailable) throw new Error('#800 VPN 引导文案未识别');
if (modelServiceStateEvidence('模型已正常完成回答。').unavailable) throw new Error('#800 正常回复不应误判不可达');

const upstreamServer = http.createServer((req, res) => {
  if (req.url?.startsWith('/api/capabilities')) {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({
      connectors: [{ key: 'qa-connector', label: 'QA Connector', statusKind: 'ready', statusLabel: '可用' }],
      connectorRouting: {
        mode: 'auto',
        explicitConnectorIds: [],
        effectiveConnectorIds: ['qa-connector'],
        unavailableRequiredConnectors: [],
      },
    }));
    return;
  }
  if (req.url?.startsWith('/api/skills/catalog')) {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ installed: [{ slug: 'qa-installed', name: 'QA Installed' }], market: [{ slug: 'qa-market' }] }));
    return;
  }
  if (req.url?.startsWith('/api/experts/catalog')) {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ recommended: [{ id: 'expert-1' }], all: [{ id: 'expert-1' }], categories: [{ id: 'all' }] }));
    return;
  }
  if (req.url?.startsWith('/api/connectors/catalog')) {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ connectors: [{ key: 'connector-1' }], builtinTools: [{ key: 'qbot_web' }] }));
    return;
  }
  res.writeHead(404, { 'content-type': 'application/json' });
  res.end('{}');
});
await new Promise((resolve, reject) => {
  upstreamServer.once('error', reject);
  upstreamServer.listen(0, '127.0.0.1', resolve);
});
const upstreamPort = upstreamServer.address().port;
const proxy = await createControlPlaneFaultProxy({
  upstreamUrl: `http://127.0.0.1:${upstreamPort}`,
  rules: [
    { id: 'fixed', method: 'POST', pathExact: '/api/fixed', mode: 'fixed-response', status: 200, body: { ok: false, msg: '受控失败' } },
    { id: 'network', method: 'GET', pathExact: '/api/network-error', mode: 'network-error', errorMessage: '受控网络错误' },
    { id: 'transform', method: 'GET', pathPrefix: '/api/capabilities', mode: 'transform-json', transform: 'connector-needs-auth', connectorKey: 'qa-connector' },
    { id: 'skills-empty', method: 'GET', pathPrefix: '/api/skills/catalog', mode: 'transform-json', transform: 'skills-empty-installed' },
    { id: 'experts-empty', method: 'GET', pathPrefix: '/api/experts/catalog', mode: 'transform-json', transform: 'experts-empty-market' },
    { id: 'connectors-empty', method: 'GET', pathPrefix: '/api/connectors/catalog', mode: 'transform-json', transform: 'connectors-empty-catalog' },
    { id: 'observe', method: 'GET', pathExact: '/api/observed', mode: 'observe' },
  ],
});
const proxyPort = new URL(proxy.url).port;
const readJson = (requestPath, { method = 'GET', body = '' } = {}) => new Promise((resolve, reject) => {
  const request = http.request({ hostname: '127.0.0.1', port: proxyPort, path: requestPath, method }, (response) => {
    const chunks = [];
    response.on('data', (chunk) => chunks.push(chunk));
    response.on('end', () => {
      try { resolve({ status: response.statusCode, body: JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}') }); } catch (error) { reject(error); }
    });
  });
  request.on('error', reject);
  if (body) request.write(body);
  request.end();
});
try {
  proxy.arm();
  const fixed = await readJson('/api/fixed', { method: 'POST', body: '{"name":"qa"}' });
  if (fixed.body.ok !== false || fixed.body.msg !== '受控失败') throw new Error('控制面代理固定响应注入失败');
  const transformed = await readJson('/api/capabilities?draftTask=1');
  if (transformed.body.connectors?.[0]?.statusKind !== 'needs_auth') throw new Error('控制面代理 JSON 转换注入失败');
  if (transformed.body.connectorRouting?.mode !== 'manual'
    || !transformed.body.connectorRouting?.explicitConnectorIds?.includes('qa-connector')
    || transformed.body.connectorRouting?.effectiveConnectorIds?.includes('qa-connector')
    || transformed.body.connectorRouting?.unavailableRequiredConnectors?.[0]?.statusKind !== 'needs_auth') {
    throw new Error('控制面代理未同步更新连接器路由状态');
  }
  const emptySkills = await readJson('/api/skills/catalog');
  if (emptySkills.body.installed?.length !== 0 || emptySkills.body.market?.length !== 1) throw new Error('技能已安装空态转换错误');
  const emptyExperts = await readJson('/api/experts/catalog');
  if (emptyExperts.body.recommended?.length !== 0 || emptyExperts.body.all?.length !== 0 || emptyExperts.body.categories?.length !== 0) throw new Error('专家市场空态转换错误');
  const emptyConnectors = await readJson('/api/connectors/catalog');
  if (emptyConnectors.body.connectors?.length !== 0 || emptyConnectors.body.builtinTools?.[0]?.key !== 'qbot_web') throw new Error('连接器目录空态转换错误');
  const networkError = await readJson('/api/network-error');
  if (networkError.status !== 503 || !networkError.body.error.includes('受控网络错误')) throw new Error('控制面代理网络错误注入失败');
  await readJson('/api/observed');
  if (proxy.state.hits.length !== 7 || !proxy.state.hits.find((item) => item.id === 'fixed')?.requestBody.includes('qa')) {
    throw new Error('控制面代理证据采集失败');
  }
} finally {
  await proxy.close();
  await new Promise((resolve) => upstreamServer.close(resolve));
}

const connectorFixtureServer = await createConnectorRegressionServer();
try {
  const readiness = await probeConnectorRegressionFixture(connectorFixtureServer);
  if (!readiness.ok || !readiness.catalog || !readiness.healthy || !readiness.unreachable) {
    throw new Error(`连接器 Fixture runner-side readiness 探测失败：${JSON.stringify(readiness)}`);
  }
  const catalog = await fetch(`${connectorFixtureServer.url}/api/openapi/servers?detail=true`).then((response) => response.json());
  const servers = catalog?.data?.servers || [];
  if (!servers.find((item) => item.name === 'dev_healthy' && item.status === 'connected')) throw new Error('连接器 Fixture 缺少 healthy 条目');
  if (servers.find((item) => item.name === 'dev_healthy')?.runtimeInvocation?.authorization) throw new Error('dev_healthy Fixture 不应依赖 OAuth token');
  if (!servers.find((item) => item.name === 'dev_unreachable')) throw new Error('连接器 Fixture 缺少 unreachable 条目');
  if (!servers.find((item) => item.name === 'dev_needs_auth' && item.status === 'oauth_required')) throw new Error('连接器 Fixture 缺少 needs_auth 条目');
  const healthyProbe = await fetch(`${connectorFixtureServer.url}/mcp/healthy`, { method: 'POST', body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-03-26' } }) });
  const toolsList = await fetch(`${connectorFixtureServer.url}/mcp/healthy`, { method: 'POST', body: JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} }) }).then((response) => response.json());
  const toolCall = await fetch(`${connectorFixtureServer.url}/mcp/healthy`, { method: 'POST', body: JSON.stringify({ jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'dev_healthy_tool', arguments: {} } }) }).then((response) => response.json());
  const unreachableProbe = await fetch(`${connectorFixtureServer.url}/mcp/unreachable`, { method: 'POST', body: '{}' });
  if (healthyProbe.status !== 200 || unreachableProbe.status !== 503 || toolsList?.result?.tools?.[0]?.name !== 'dev_healthy_tool' || toolCall?.result?.isError !== false) {
    throw new Error('连接器 Fixture 健康探测或真实工具调用终态错误');
  }
} finally {
  await connectorFixtureServer.close();
}

const documentFixtureServer = await createConnectorRegressionServer({ includeDocumentFixture: true });
try {
  const catalog = await fetch(`${documentFixtureServer.url}/api/openapi/servers?detail=true`).then((response) => response.json());
  const documentServer = catalog?.data?.servers?.find((item) => item.name === 'teams_doc_fixture');
  if (documentServer?.status !== 'connected' || documentServer?.tools?.[0]?.name !== 'teams_document_read') {
    throw new Error(`Teams 文档 Fixture 目录错误：${JSON.stringify(documentServer)}`);
  }
  const allowed = await fetch(`${documentFixtureServer.url}/mcp/documents`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 11, method: 'tools/call', params: { name: 'teams_document_read', arguments: { document_id: 'allowed-doc-a' } } }),
  }).then((response) => response.json());
  const denied = await fetch(`${documentFixtureServer.url}/mcp/documents`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 12, method: 'tools/call', params: { name: 'teams_document_read', arguments: { document_id: 'denied-doc-b' } } }),
  }).then((response) => response.json());
  const calls = documentFixtureServer.state.hits.filter((item) => item.rpcMethod === 'tools/call');
  if (!allowed?.result?.content?.[0]?.text?.includes('TEAMS_DOC_ALLOWED_20260716')
    || denied?.result?.isError !== true
    || !denied?.result?.content?.[0]?.text?.includes('无权限')
    || calls.length !== 2
    || calls[0]?.rpcParams?.arguments?.document_id !== 'allowed-doc-a'
    || calls[1]?.rpcParams?.arguments?.document_id !== 'denied-doc-b') {
    throw new Error(`Teams 文档 Fixture 权限闭环错误：allowed=${JSON.stringify(allowed)} denied=${JSON.stringify(denied)} calls=${JSON.stringify(calls)}`);
  }
} finally {
  await documentFixtureServer.close();
}

const skillStateRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'qbot-skill-state-'));
try {
  const emptyLocal = new DatabaseSync(path.join(skillStateRoot, 'local.db'));
  emptyLocal.exec('CREATE TABLE installed_skills (name TEXT PRIMARY KEY, slug TEXT, runtime_name TEXT, readiness_status TEXT, next_action TEXT, install_status TEXT, updated_at INTEGER)');
  emptyLocal.close();
  const hashedPath = path.join(skillStateRoot, 'qbot-dev-fixture.db');
  const hashed = new DatabaseSync(hashedPath);
  hashed.exec('CREATE TABLE installed_skills (name TEXT PRIMARY KEY, slug TEXT, runtime_name TEXT, readiness_status TEXT, next_action TEXT, install_status TEXT, updated_at INTEGER)');
  hashed.prepare('INSERT INTO installed_skills(name, slug, runtime_name, readiness_status) VALUES (?, ?, ?, ?)')
    .run('skillhub__global__qa-uninstall-rejected', 'qa-uninstall-rejected', 'skillhub__global__qa-uninstall-rejected', 'projected_for_both');
  hashed.close();
  const seeded = seedLocalSkillReadiness(skillStateRoot, 'qa-uninstall-rejected', 'runtime_projection_failed');
  if (!seeded.ok || seeded.dbPath !== hashedPath) throw new Error(`技能状态库候选选择错误：${JSON.stringify(seeded)}`);
  const readback = new DatabaseSync(hashedPath, { readOnly: true });
  const readiness = readback.prepare('SELECT readiness_status, next_action FROM installed_skills WHERE slug=?').get('qa-uninstall-rejected');
  readback.close();
  if (readiness?.readiness_status !== 'runtime_projection_failed' || readiness?.next_action !== 'retry_projection') {
    throw new Error(`技能未就绪状态写入错误：${JSON.stringify(readiness)}`);
  }
} finally {
  fs.rmSync(skillStateRoot, { recursive: true, force: true });
}

const fixtureSmokeRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'qbot-skillhub-fixture-'));
const fixtureServer = await createSkillHubRegressionServer(fixtureSmokeRoot);
try {
  const discovery = await fetch(`${fixtureServer.url}/api/web/skills?q=&page=0&size=100`).then((response) => response.json());
  if (discovery?.data?.items?.length !== 21 || discovery?.data?.total !== 21) throw new Error('SkillHub Fixture discovery 未返回完整 21 条分页数据');
  const discoveryBySlug = new Map(discovery.data.items.map((item) => [item.slug, item]));
  if (discoveryBySlug.get('qa-install-rejected-visible')?.installStatus !== 'rejected'
    || discoveryBySlug.get('qa-auto-declared')?.resolutionMode !== 'AUTO_DECLARED'
    || discoveryBySlug.get('qa-materialization-pending')?.materializationStatus !== 'pending') {
    throw new Error(`SkillHub Fixture 状态元数据不完整：${JSON.stringify(Object.fromEntries(discoveryBySlug))}`);
  }
  const rootVersion = await fetch(`${fixtureServer.url}/api/v1/skills/global/qa-dep-root-success/versions/1.0.0`).then((response) => response.json());
  const dependencies = rootVersion?.data?.parsedMetadataJson?.dependencies?.map((item) => item.slug);
  if (JSON.stringify(dependencies) !== JSON.stringify(['qa-dep-leaf-a', 'qa-dep-leaf-b'])) {
    throw new Error(`SkillHub Fixture 版本依赖元数据错误：${JSON.stringify(dependencies)}`);
  }
  const archiveResponse = await fetch(`${fixtureServer.url}/api/v1/skills/global/qa-runtime-retryable/versions/1.0.0/download`);
  const archiveMagic = Buffer.from(await archiveResponse.arrayBuffer()).subarray(0, 2).toString('utf8');
  if (!archiveResponse.ok || archiveMagic !== 'PK') throw new Error('SkillHub Fixture ZIP 下载不可用');
  const failedDownload = await fetch(`${fixtureServer.url}/api/v1/skills/global/qa-dep-leaf-failure/versions/1.0.0/download`);
  if (failedDownload.status !== 503) throw new Error(`SkillHub 受控下载失败未返回 503：${failedDownload.status}`);
  const pythonFiles = await fetch(`${fixtureServer.url}/api/v1/skills/global/qa-python-runtime/versions/1.0.0/files`).then((response) => response.json());
  if (!pythonFiles?.data?.files?.some((item) => item.filePath === 'run.py')) throw new Error('Python Runtime Fixture 缺少 run.py 元数据');
  const nodeFiles = await fetch(`${fixtureServer.url}/api/v1/skills/global/qa-node-runtime/versions/1.0.0/files`).then((response) => response.json());
  if (!nodeFiles?.data?.files?.some((item) => item.filePath === 'package.json') || !nodeFiles?.data?.files?.some((item) => item.filePath === 'run.js')) {
    throw new Error('Node Runtime Fixture 缺少 package.json/run.js 元数据');
  }
  const rollbackV1 = await fetch(`${fixtureServer.url}/api/v1/skills/global/qa-version-rollback/resolve?version=1.0.0`).then((response) => response.json());
  if (rollbackV1?.data?.version !== '1.0.0') throw new Error('版本回退 Fixture 无法显式解析 1.0.0');
  fixtureServer.setActiveVersion('qa-version-rollback', '2.0.0');
  const rollbackV2 = await fetch(`${fixtureServer.url}/api/v1/skills/global/qa-version-rollback/resolve`).then((response) => response.json());
  if (rollbackV2?.data?.version !== '2.0.0' || !String(rollbackV2?.data?.downloadUrl || '').endsWith('/versions/2.0.0/download')) {
    throw new Error('版本回退 Fixture 切换后未解析到 2.0.0');
  }
  const rollbackArchive = await fetch(`${fixtureServer.url}/api/v1/skills/global/qa-version-rollback/versions/2.0.0/download`);
  if (!rollbackArchive.ok || Buffer.from(await rollbackArchive.arrayBuffer()).subarray(0, 2).toString('utf8') !== 'PK') {
    throw new Error('版本回退 Fixture 2.0.0 ZIP 不可用');
  }
} finally {
  await fixtureServer.close();
  fs.rmSync(fixtureSmokeRoot, { recursive: true, force: true });
}

console.log('framework invariants ok');
