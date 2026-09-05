#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { assessUserCenteredOutcome } from '../../src/lib/ui-agent-casebook-runner.mjs';
import {
  coreBetaInitializationContinuationEvidenceVerdict,
  coreBetaInitializationSkillReinstallEvidenceVerdict,
} from '../../src/lib/ui-agent-casebook-runner-v2.mjs';
import { resolveScopedEvidence, validateStrictReviewOverride } from './review-evidence.mjs';

const input = process.argv[2];
if (!input) {
  console.error('Usage: node trusted-review.mjs <automation-output-directory>');
  process.exit(2);
}

const outDir = path.resolve(input);
const { progressPath, summaryPath } = resolveCanonicalRunInputs(outDir);
const progress = JSON.parse(fs.readFileSync(progressPath, 'utf8'));
const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
const runName = path.basename(outDir);
const legacyBaseline = /full_178_.*teams360_5\.2\.12-2119071778/.test(runName);
const hostMatch = runName.match(/teams360_(\d+\.\d+\.\d+)(?:-([0-9]+))?/);
const runMetadataPath = path.join(outDir, 'run-metadata.json');
const runMetadata = fs.existsSync(runMetadataPath)
  ? JSON.parse(fs.readFileSync(runMetadataPath, 'utf8'))
  : null;
const hostVersion = runMetadata?.host?.version || hostMatch?.[1] || '';
const hostBuild = runMetadata?.host?.build || hostMatch?.[2] || '';
const qworkVersion = runMetadata?.qwork?.version
  || runName.match(/qwork-(\d+\.\d+\.\d+)/)?.[1]
  || '';
const controlPlane = runMetadata?.control_plane?.origin
  || (/[_-]dev(?:[_-]|$)/i.test(runName) ? 'DEV' : '');
const modelTier = runMetadata?.model_tier || '';
const timeoutMs = Number(runMetadata?.timeout_ms || 0);
if (!hostVersion || !hostBuild || !qworkVersion || !controlPlane || !modelTier || !timeoutMs) {
  throw new Error(
    'Trusted review requires pinned host/QWork/control-plane identity. '
    + `Missing run-metadata.json fields under ${outDir}.`,
  );
}

export function resolveCanonicalRunInputs(directory) {
  const rootProgress = path.join(directory, 'automation-progress.json');
  const rootSummary = path.join(directory, 'automation-run-summary.json');
  const candidates = [[rootProgress, rootSummary]];
  const logsDir = path.join(directory, 'logs');
  if (fs.existsSync(logsDir)) {
    for (const name of fs.readdirSync(logsDir)) {
      const match = name.match(/^teams-recovery-pass-(\d+)-progress\.json$/);
      if (!match) continue;
      candidates.push([
        path.join(logsDir, name),
        path.join(logsDir, `teams-recovery-pass-${match[1]}-summary.json`),
      ]);
    }
  }
  const valid = candidates.flatMap(([candidateProgress, candidateSummary]) => {
    if (!fs.existsSync(candidateProgress) || !fs.existsSync(candidateSummary)) return [];
    try {
      const candidateProgressJson = JSON.parse(fs.readFileSync(candidateProgress, 'utf8'));
      const candidateSummaryJson = JSON.parse(fs.readFileSync(candidateSummary, 'utf8'));
      const results = Array.isArray(candidateProgressJson.results) ? candidateProgressJson.results : [];
      const total = Number(candidateProgressJson.total || candidateSummaryJson.counts?.total || 0);
      const complete = total > 0
        && Number(candidateProgressJson.completed) >= total
        && results.length >= total
        && Number(candidateSummaryJson.counts?.total) === total
        && Boolean(candidateSummaryJson.ended_at)
        && !['recovering', 'aborted', 'interrupted', 'stopped'].includes(String(candidateSummaryJson.status || '').toLowerCase())
        && candidateProgressJson.aborted !== true
        && candidateProgressJson.recovering !== true
        && candidateProgressJson.synthetic !== true;
      if (!complete) return [];
      return [{
        progressPath: candidateProgress,
        summaryPath: candidateSummary,
        endedAt: Date.parse(candidateSummaryJson.ended_at) || fs.statSync(candidateSummary).mtimeMs,
      }];
    } catch {
      return [];
    }
  }).sort((a, b) => b.endedAt - a.endedAt);
  if (!valid.length) {
    throw new Error(`No complete, non-synthetic Casebook result found under ${directory}`);
  }
  return valid[0];
}

const labels = {
  trusted_pass: '可信通过',
  trusted_bug: '可信 Bug',
  trusted_failure: '可信失败',
  trusted_blocked: '可信阻塞',
  framework_issue: '框架问题',
  testcase_issue: '用例问题',
  needs_review: '需人工复核',
};

const legacyManual = new Map(Object.entries({
  'SIT-HOME-003': ['trusted_blocked', '模型服务返回“暂时不可达/需连接公司 VPN”，属于服务或网络前置条件，不足以证明产品功能缺陷。'],
  'SIT-HOME-016': ['trusted_bug', '首轮回复正常，第二轮发送后等待 180 秒仍无新增回复；截图、会话和等待记录一致，确认多轮会话可靠性缺陷。'],
  'SIT-HOME-018': ['trusted_bug', '10 轮长会话中出现模型服务不可达，并在后续回复中重复输出 mitigation 内容；完整 transcript 与逐轮截图可复现。'],
  'SIT-HOME-028': ['trusted_blocked', '模型服务返回“暂时不可达/需连接公司 VPN”，属于服务或网络前置条件，不足以证明产品功能缺陷。'],
  'SIT-HOME-029': ['testcase_issue', '产品已移除“提示词美化”入口，本用例已过期，应从现行功能用例集中删除。'],
  'SIT-HOME-042': ['trusted_blocked', '360Teams 集成包未暴露原生文件引用能力，未真正执行 5 个附件上限校验。'],
  'SIT-HOME-043': ['trusted_blocked', '360Teams 集成包未暴露原生文件引用能力，未真正执行单文件大小限制校验。'],
  'SIT-HOME-044': ['trusted_blocked', '360Teams 集成包未暴露原生文件引用能力，未真正执行不支持格式校验。'],
  'SIT-HOME-045': ['trusted_blocked', '360Teams 集成包未暴露原生文件引用能力，未真正执行附件移除交互。'],
  'SIT-HOME-053': ['trusted_bug', '首轮回复正常，第二轮等待完整 600 秒仍无新增回复；会话连续性与等待证据充分。'],
  'SIT-HOME-057': ['trusted_bug', '信息不足时虽口头表示要澄清，却自行假设默认值并生成成果，还混入此前活动数据，确认上下文污染和不当补全。'],
  'SIT-HOME-058': ['trusted_bug', '用户补充 30 万预算、240 人和企微约束后，最终输出仍保留旧的 480 人目标，确认约束更新未完全生效。'],
  'SIT-HOME-061': ['trusted_pass', '关键截图明确展示“第1步/第2步/第3步”和后续检查清单；原 plan_steps=0 为渲染文本解析误判。'],
  'SIT-HOME-062': ['trusted_pass', '关键截图明确说明当前信息无法计算 ROI，并给出公式和所需输入；原断言误把示例值当作伪造结果。'],
  'SIT-HOME-064': ['trusted_pass', '关键截图展示 4 列且恰好 3 行的渲染表格；原断言错误地按 Markdown 竖线解析 DOM innerText。'],
  'SIT-EXPERT-006': ['trusted_bug', '创建表单提交后弹窗关闭，但“我的专家”仍为空，新专家不可见，截图与列表读取一致。'],
  'SIT-EXPERT-009': ['trusted_bug', '召唤依赖技能专家后向用户暴露远端控制面 HTTP 500，截图和会话证据一致。'],
  'SIT-EXPERT-011': ['framework_issue', '提交后截图仍停留在可编辑且“创建”按钮可用的表单，缺少可证明点击真正触发的事件证据，不能判为产品 Bug。'],
  'SIT-EXPERT-013': ['trusted_bug', '创建待删除专家后弹窗已关闭，但列表中无该专家，导致删除流程无法继续；截图与 DOM 读取一致。'],
  'SIT-SKILL-002': ['trusted_pass', '截图出现安装成功提示，已安装数量增加且目标技能显示“就绪”；原 sameInstalled 断言逻辑错误。'],
  'SIT-SKILL-013': ['trusted_pass', '物化后列表显示技能进入“就绪”或明确“未就绪/已补声明”终态，满足收敛要求；原状态断言错误。'],
  'SIT-SKILL-017': ['trusted_bug', '手动选择技能后消息已发送，但等待 180 秒无最终回复，输入 chip、发送与超时截图完整。'],
  'SIT-SKILL-025': ['framework_issue', '目标技能安装成功且显示就绪，但原断言提前终止，未执行首页手动技能菜单的选择验证，无法给出产品结论。'],
  'SIT-SKILL-026': ['trusted_bug', '双技能选择和删除同步正常，但重新打开手动技能菜单显示“还没安装技能”，无法恢复已删除 chip，截图证据明确。'],
  'SIT-CONN-007': ['trusted_pass', '重开详情后目标工具已变为“已停用”，启用数从 60 降到 59，说明状态已更新并持久化；原即时读回发生在 UI 状态稳定前。'],
  'SIT-CONN-015': ['trusted_failure', '私网访问被正确拦截且安全断言通过，但回复重复输出环境变量指引，属于可读性/用户体验失败，暂不升级为功能 Bug。'],
  'SIT-TEAMS-NEW-002': ['testcase_issue', '用例未实际关闭并重新进入 360Teams QWork，只检查了回复文案；现有证据不能验证宿主重开后的任务恢复。'],
  'SIT-TEAMS-NEW-003': ['testcase_issue', '用例只进入项目页，未创建并核验本地文件，也未读取 executionScope/projectId；现有证据不能验证执行位置。'],
  'SIT-TEAMS-DOC-001': ['testcase_issue', '用例只打开连接器菜单，未准备并访问有权限/无权限云文档；现有证据不能验证文档权限行为。'],
  'SIT-TASK-EDIT-001': ['framework_issue', '结束阶段截图等待字体加载超时；此前动作证据不足以形成可信产品结论。'],
  'SIT-TASK-REGEN-001': ['framework_issue', '结束阶段截图等待字体加载超时；此前动作证据不足以形成可信产品结论。'],
  'SIT-ART-CONFIRM-001': ['framework_issue', '结束阶段截图等待字体加载超时；此前动作证据不足以形成可信产品结论。'],
  'SIT-SKILL-SCOPE-001': ['framework_issue', '结束阶段截图等待字体加载超时；此前动作证据不足以形成可信产品结论。'],
  'SIT-MEM-001': ['framework_issue', '结束阶段截图等待字体加载超时；此前动作证据不足以形成可信产品结论。'],
  'SIT-TASK-RECOVER-001': ['framework_issue', '结束阶段截图等待字体加载超时；此前动作证据不足以形成可信产品结论。'],
  'SIT-RUNTIME-RECOVER-001': ['framework_issue', '结束阶段截图等待字体加载超时；此前动作证据不足以形成可信产品结论。'],
}));
const manual = legacyBaseline ? legacyManual : new Map();

const finalReviewOverrides = new Map();
const overrideAudit = [];
const rollingReviewPath = path.join(outDir, 'rolling-trusted-review.json');
const finalOverridePath = path.join(outDir, 'final-trusted-review-overrides.json');
const statusAliases = new Map([
  ['可信通过', 'trusted_pass'],
  ['可信 Bug', 'trusted_bug'],
  ['可信失败', 'trusted_failure'],
  ['可信阻塞', 'trusted_blocked'],
  ['框架问题', 'framework_issue'],
  ['用例问题', 'testcase_issue'],
  ['需人工复核', 'needs_review'],
]);

function loadReviewOverrides(file, { strict = false } = {}) {
  if (!fs.existsSync(file)) return;
  const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
  for (const item of parsed.results || []) {
    const trustedStatus = statusAliases.get(item.classification) || item.trusted_status;
    if (!item.id || !labels[trustedStatus]) continue;
    const result = progress.results.find((candidate) => candidate.id === item.id);
    if (!result) {
      if (strict) throw new Error(`Strict review override references unknown Case: ${item.id}`);
      continue;
    }
    if (strict) {
      const audit = validateStrictReviewOverride({ outDir, result, item, trustedStatus, source: path.basename(file) });
      overrideAudit.push(audit);
      if (!audit.ok) throw new Error(`Invalid strict review override ${item.id}: ${audit.errors.join('；')}`);
    }
    finalReviewOverrides.set(item.id, {
      trustedStatus,
      title: item.title || '',
      reason: item.reason,
      productObservation: item.product_observation || '',
      userOperation: item.user_operation || '',
      expectedOutcome: item.expected_outcome || '',
      userImpact: item.user_impact || '',
      explicitEvidence: Array.isArray(item.evidence) ? item.evidence : [],
      source: path.basename(file),
      visualMatch: typeof item.visual_match === 'boolean' ? item.visual_match : null,
      visualNote: item.visual_note || '',
      strict,
    });
  }
}

loadReviewOverrides(rollingReviewPath);
loadReviewOverrides(finalOverridePath);
const visualAuditPath = path.join(outDir, 'visual-evidence-audit.json');
if (fs.existsSync(visualAuditPath)) {
  const parsed = JSON.parse(fs.readFileSync(visualAuditPath, 'utf8'));
  for (const item of parsed.results || []) {
    if (!item.id) continue;
    const existing = finalReviewOverrides.get(item.id) || {};
    const trustedStatus = statusAliases.get(item.classification) || item.trusted_status || existing.trustedStatus;
    if (!labels[trustedStatus]) continue;
    finalReviewOverrides.set(item.id, {
      ...existing,
      trustedStatus,
      title: item.title || existing.title || '',
      reason: item.reason || existing.reason || '',
      productObservation: item.product_observation || existing.productObservation || '',
      userOperation: item.user_operation || existing.userOperation || '',
      expectedOutcome: item.expected_outcome || existing.expectedOutcome || '',
      userImpact: item.user_impact || existing.userImpact || '',
      explicitEvidence: Array.isArray(item.evidence) && item.evidence.length ? item.evidence : existing.explicitEvidence || [],
      source: path.basename(visualAuditPath),
      visualMatch: typeof item.visual_match === 'boolean' ? item.visual_match : existing.visualMatch ?? null,
      visualNote: item.visual_note || existing.visualNote || '',
    });
  }
}
const adjudicatedOverridePath = path.join(outDir, 'adjudicated-trusted-review-overrides.json');
loadReviewOverrides(adjudicatedOverridePath, { strict: true });

const keyScreenshotNames = {
  'SIT-HOME-041': ['after_upload', 'turn_1_after_reply', 'final'],
  'SIT-HOME-016': ['turn_2_after_timeout', 'final'],
  'SIT-HOME-018': ['turn_4_after_reply', 'turn_7_after_reply', 'final'],
  'SIT-HOME-053': ['turn_2_after_timeout', 'final'],
  'SIT-HOME-057': ['turn_1_after_reply', 'final'],
  'SIT-HOME-058': ['turn_2_after_reply', 'final'],
  'SIT-EXPERT-006': ['after_create_list', 'after_create'],
  'SIT-EXPERT-009': ['依赖技能专家召唤验证_after_reply', 'final'],
  'SIT-EXPERT-013': ['expert-013_after_submit_list', 'final'],
  'SIT-EXPERT-015': ['expert_015_market', 'final'],
  'SIT-EXPERT-021': ['create_dialog', 'after_start_create', 'final'],
  'SIT-SKILL-017': ['手动-skill-强走会话_after_timeout', 'final'],
  'SIT-SKILL-026': ['skill_026_after_multi_select', 'skill_026_after_removal', 'manual_installed_skill_missing'],
  'SIT-CONN-015': ['私有网络访问防护_after_reply', 'final'],
  'SIT-HOME-061': ['turn_1_after_reply', 'final'],
  'SIT-HOME-062': ['turn_1_after_reply', 'final'],
  'SIT-HOME-064': ['turn_1_after_reply', 'final'],
  'SIT-SKILL-002': ['installed_after_install', 'after_skill_install'],
  'SIT-SKILL-013': ['skill_013_after_action', 'skill_013_materialization'],
  'SIT-CONN-007': ['connector_007_detail_reopen', 'connector_007_detail_before'],
  'SIT-ART-CONFIRM-001': ['成果生成请求_after_reply', 'artifact_panel', 'final'],
  'SIT-MEM-001': ['turn_1_after_reply', 'final'],
};

function resolveEvidenceFiles(evidence = [], result = null) {
  if (!result) return [];
  return resolveScopedEvidence(outDir, result, evidence)
    .filter((entry) => entry.exists && entry.in_case)
    .map((entry) => entry.file);
}

function classifyWithUserGate(result, trustedStatus, reason, override = null) {
  if (!['trusted_pass', 'trusted_bug'].includes(trustedStatus)) return [trustedStatus, reason, override, null];
  const intendedClassification = trustedStatus === 'trusted_bug' ? 'bug' : 'pass';
  const assessment = assessUserCenteredOutcome(result, {
    explicitEvidence: resolveEvidenceFiles(override?.explicitEvidence || [], result),
    intendedClassification,
    reviewReason: reason,
    productObservation: override?.productObservation || '',
    userOperationOverride: override?.userOperation || '',
    expectedOutcomeOverride: override?.expectedOutcome || '',
    userImpactOverride: override?.userImpact || '',
    verifiedReviewOverride: override?.strict === true,
    runRoot: outDir,
  });
  if (assessment.classification !== intendedClassification) {
    const downgradedStatus = assessment.classification === 'framework_issue'
      ? 'framework_issue'
      : assessment.classification === 'blocked'
        ? 'trusted_blocked'
        : 'needs_review';
    return [downgradedStatus, assessment.description, override, assessment];
  }
  return [trustedStatus, assessment.description, override, assessment];
}

function classify(result) {
  const runBoundInitializationEvidence = coreBetaInitializationContinuationEvidenceVerdict(
    result,
    { runRoot: outDir },
  );
  if (
    runBoundInitializationEvidence.applicable
    && runBoundInitializationEvidence.required
    && (
      runBoundInitializationEvidence.valid !== true
      || runBoundInitializationEvidence.safe !== true
    )
  ) {
    const reason = `初始化连续性证据未绑定当前运行目录：${runBoundInitializationEvidence.reason}`;
    return [
      'framework_issue',
      reason,
      null,
      {
        classification: 'framework_issue',
        description: reason,
        userOperation: '执行初始化维护用例',
        expected: '动作、维护终态、恢复工作台与 manifest 必须从当前不可变运行目录重放。',
        observed: runBoundInitializationEvidence.reason,
        impact: '证据可能来自其它批次，不能据此判断产品通过或 Bug。',
        alignedScreenshots: [],
        screenshotReason: '运行根目录绑定门禁优先于截图和人工覆盖。',
        gates: { initialization_continuation_evidence_valid: false },
        missingGates: ['initialization_continuation_evidence_valid'],
        initializationContinuationEvidence: runBoundInitializationEvidence,
      },
    ];
  }
  const runBoundSkillReinstallEvidence = runBoundInitializationEvidence.skill_reinstall_evidence
    || coreBetaInitializationSkillReinstallEvidenceVerdict(result, { runRoot: outDir });
  if (runBoundSkillReinstallEvidence.applicable && runBoundSkillReinstallEvidence.valid !== true) {
    const reason = `INIT-003 专项证据未绑定当前运行目录：${runBoundSkillReinstallEvidence.reason}`;
    return [
      'framework_issue',
      reason,
      null,
      {
        classification: 'framework_issue',
        description: reason,
        userOperation: '重装 Skill 运行层',
        expected: '专项证据必须全部位于当前不可变运行目录的 cases 子树内。',
        observed: runBoundSkillReinstallEvidence.reason,
        impact: '证据可能来自其它批次，不能据此判断产品通过或 Bug。',
        alignedScreenshots: [],
        screenshotReason: '运行根目录绑定门禁优先于截图和人工覆盖。',
        gates: { skill_reinstall_run_root_bound: false },
        missingGates: ['skill_reinstall_run_root_bound'],
        skillReinstallEvidence: runBoundSkillReinstallEvidence,
      },
    ];
  }
  if (/^BETA-INIT-00[1-4]$/.test(String(result?.id || ''))) {
    const initializationAssessment = assessUserCenteredOutcome(result, { runRoot: outDir });
    if (
      initializationAssessment.gates?.initialization_continuation_safe === false
      || initializationAssessment.gates?.skill_reinstall_readiness_evidence_valid === false
    ) {
      return [
        'framework_issue',
        initializationAssessment.description,
        null,
        initializationAssessment,
      ];
    }
  }
  if (finalReviewOverrides.has(result.id)) {
    const override = finalReviewOverrides.get(result.id);
    return classifyWithUserGate(result, override.trustedStatus, override.reason, override);
  }
  if (manual.has(result.id)) {
    const [trustedStatus, reason] = manual.get(result.id);
    return classifyWithUserGate(result, trustedStatus, reason);
  }
  const evidence = resultEvidenceText(result);
  if (result.id === 'SIT-HOME-031'
    && /QBot 核心对话能力测试/.test(evidence)
    && /(?:优先级\s*[：:]?\s*P0|P0)/i.test(evidence)) {
    return classifyWithUserGate(result, 'trusted_pass', '真实 TXT 已通过原生附件桥进入会话，回复准确提取项目名、P0 优先级和关键内容；原语义相关性断言为误判。');
  }
  if (result.id === 'SIT-HOME-047' && /inputVisible=false|未出现.*输入|重命名.*未/.test(evidence)) {
    return classifyWithUserGate(result, 'trusted_bug', '已通过真实会话侧栏创建新会话，但双击标题后未出现重命名输入框，动作与截图证据一致。');
  }
  if (result.id === 'SIT-EXPERT-011' && /Unknown skill:/i.test(evidence)) {
    return classifyWithUserGate(result, 'trusted_bug', '专家已成功创建、可见并被召唤，但实际调用其私有技能返回 Unknown skill；创建链路成立，能力执行缺陷可信。');
  }
  const assessment = assessUserCenteredOutcome(result, { runRoot: outDir });
  if (assessment.classification === 'pass') return ['trusted_pass', assessment.description, null, assessment];
  if (assessment.classification === 'bug') return ['trusted_bug', assessment.description, null, assessment];
  if (assessment.classification === 'blocked') return ['trusted_blocked', blockerReason(result.actual_result), null, assessment];
  if (assessment.classification === 'framework_issue') return ['framework_issue', assessment.description, null, assessment];
  return ['needs_review', assessment.description, null, assessment];
}

function resultEvidenceText(result) {
  const values = [result.actual_result, result.conclusion];
  for (const key of ['transcript', 'reply_delta']) {
    const file = result.artifacts?.[key];
    if (!file || !fs.existsSync(file)) continue;
    try { values.push(fs.readFileSync(file, 'utf8')); } catch {}
  }
  return values.filter(Boolean).join('\n');
}

function blockerReason(actual = '') {
  const text = String(actual);
  if (text.includes('prepareTaskInContext unavailable')) return '360Teams 集成 WebView 未暴露成果任务上下文准备能力，无法进入真实成果流。';
  if (text.includes('native file reference')) return '360Teams 集成包未暴露原生文件引用能力，附件场景无法真实执行。';
  if (text.includes('项目运行时') || text.includes('project runtime')) return '当前测试账号/环境未绑定可用项目运行时。';
  if (text.includes('restart') || text.includes('重启')) return '该场景需要重启或故障注入；集成包测试禁止切换宿主和注入本地运行时。';
  if (text.includes('连接器') || text.includes('connector')) return '测试环境缺少满足场景的健康/授权/故障态连接器数据。';
  if (text.includes('技能') || text.includes('skill')) return '测试环境缺少满足场景的技能 fixture 或可控故障态数据。';
  return '所需测试数据、宿主能力或账号前置条件不满足，现有证据不能形成产品结论。';
}

function existingScreenshots(result) {
  const values = [];
  for (const value of Object.values(result.screenshots || {})) {
    if (typeof value === 'string' && value.endsWith('.png') && fs.existsSync(value)) values.push(value);
  }
  for (const value of result.screenshots_flat || []) {
    if (typeof value === 'string' && value.endsWith('.png') && fs.existsSync(value)) values.push(value);
  }
  return [...new Set(values)];
}

function chooseScreenshots(result, limit = 2, assessment = null, explicitEvidence = []) {
  const entries = result.screenshots || {};
  const selected = [];
  for (const file of assessment?.alignedScreenshots || []) {
    if (fs.existsSync(file) && !selected.includes(file)) selected.push(file);
  }
  for (const file of resolveEvidenceFiles(explicitEvidence, result)) {
    if (/\.png$/i.test(file) && !selected.includes(file)) selected.push(file);
  }
  for (const name of keyScreenshotNames[result.id] || []) {
    const direct = entries[name];
    const fuzzy = Object.entries(entries).find(([key, value]) => key.includes(name) || path.basename(value).includes(name))?.[1];
    const file = direct || fuzzy;
    if (file && fs.existsSync(file) && !selected.includes(file)) selected.push(file);
  }
  const candidates = existingScreenshots(result);
  const scored = candidates
    .map((file) => ({
      file,
      score: /timeout|after.reply|after.submit|after.create|after.action|reopen|assertion|missing|no.retry|error|market|dialog|panel|artifact|preview/i.test(path.basename(file)) ? 2 :
        /final/i.test(path.basename(file)) ? 0 : -1,
    }))
    .sort((a, b) => b.score - a.score);
  for (const { file, score } of scored) {
    if (score <= 0) continue;
    if (!selected.includes(file)) selected.push(file);
    if (selected.length >= limit) break;
  }
  return selected.slice(0, limit);
}

function rel(file) {
  return path.relative(outDir, file).split(path.sep).join('/');
}

function esc(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function compact(value, max = 500) {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim();
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

const reviewed = progress.results.map((result) => {
  const [trustedStatus, reviewReason, override = null, assessment = null] = classify(result);
  const bugScreenshotLimit = Math.min(3, keyScreenshotNames[result.id]?.length || 2);
  const screenshots = chooseScreenshots(
    result,
    trustedStatus === 'trusted_bug' ? bugScreenshotLimit : 2,
    assessment,
    override?.explicitEvidence || [],
  );
  const transcript = result.artifacts?.transcript;
  const replyDelta = result.artifacts?.reply_delta;
  return {
    id: result.id,
    order: result.order,
    module: result.module,
    submodule: result.submodule,
    title: override?.title || result.title,
    raw_status: result.status,
    raw_category: result.result_category,
    trusted_status: trustedStatus,
    trusted_label: labels[trustedStatus],
    review_reason: reviewReason,
    expert_review_reason: override?.reason || '',
    product_observation: override?.productObservation || '',
    review_source: override?.source || 'evidence-heuristic',
    visual_evidence_match: override?.visualMatch ?? null,
    visual_evidence_note: override?.visualNote || '',
    explicit_evidence: override?.explicitEvidence || [],
    expected_result: result.expected_result,
    actual_result: result.actual_result,
    assertions: result.assertions || [],
    key_screenshots: screenshots,
    key_screenshot_reason: assessment?.screenshotReason || '',
    evidence_alignment: assessment?.gates || null,
    user_operation: assessment?.userOperation || '',
    expected_user_outcome: assessment?.expected || '',
    observed_user_outcome: assessment?.observed || '',
    user_impact: assessment?.impact || '',
    case_report: result.case_report,
    transcript: transcript && fs.existsSync(transcript) ? transcript : null,
    reply_delta: replyDelta && fs.existsSync(replyDelta) ? replyDelta : null,
  };
});

const counts = Object.fromEntries(Object.keys(labels).map((key) => [key, reviewed.filter((item) => item.trusted_status === key).length]));
const total = Object.values(counts).reduce((sum, value) => sum + value, 0);
const expectedTotal = Number(summary.counts?.total || progress.total || reviewed.length);
if (total !== reviewed.length || reviewed.length !== expectedTotal) {
  throw new Error(`Expected ${expectedTotal} reviewed cases, got total=${total}, results=${reviewed.length}`);
}
const userSkippedCaseIds = expectedTotal === 68
  ? ['SIT-CONN-018', 'SIT-TEAMS-DOC-001', 'SIT-SKILL-SCOPE-001']
  : [];

const payload = {
  review_version: 3,
  generated_at: new Date().toISOString(),
  host: {
    product: '360Teams',
    version: hostVersion,
    build: hostBuild,
    qwork: qworkVersion,
    control_plane: controlPlane,
    model_tier: modelTier,
    timeout_ms: timeoutMs,
  },
  scope: {
    total: expectedTotal,
    excluded: ['SIT-INIT-*', 'SIT-AUTH-*'],
    user_skipped_case_ids: userSkippedCaseIds,
    source_progress: progressPath,
    source_summary: summaryPath,
  },
  raw_counts: summary.counts,
  trusted_counts: counts,
  methodology: [
    '最终结论以普通用户能否完成目标、能否理解结果、能否继续操作为准；技术日志只用于确认执行有效，不能替代用户结论。',
    '可信 Bug 必须同时具备：真实用户操作、失败的用户结果、明确用户影响、与描述直接对应的操作后截图，以及独立硬错误或目标功能结构化读回；raw failed 与语义关键词断言不能单独升级。',
    'V4 Case 必须使用 schema 2 的逐编号步骤显式执行证据；旧式位置匹配、全局关键词匹配或 synthetic 恢复结果一律不能形成可信产品结论。',
    '可信通过必须同时具备：核心用户动作已执行、全部用户成功标准通过、没有未解释失败、操作后截图与会话/成果证据一致。',
    '可信通过还要求普通用户看得懂并能继续或自助恢复；界面出现原始 HTTP/JSON、内部测试文案、内部路径或堆栈时不能通过。',
    '即使 Case 原定主目标通过，只要执行中暴露了独立且明确影响用户的缺陷，也必须从可信通过中移除。',
    '可信通过和可信 Bug 均需目视检查主截图；报告标题必须描述实际现象，不能直接拿“应当……”式 Case 名称冒充缺陷标题。',
    'before、模型档位、fixture、输入后、发送后和泛化 final 截图不能单独证明 Bug 或通过。',
    '报告中的 Bug 描述固定包含用户操作、预期、实际看到和用户影响，截图优先使用复核人显式指定的证据路径。',
    '严格终审覆盖必须使用同一 Case 目录内的操作后结果截图；跨 Case 证据、before/发送后空画面或不存在文件会令报告生成直接失败。',
    '若可信通过需要推翻原失败的用户断言，覆盖文件必须逐条记录 resolved_failures、理由与证据，禁止只写“误判”放行。',
  ],
  override_audit: overrideAudit,
  results: reviewed,
};

const jsonPath = path.join(outDir, '可信二次复核结果.json');
fs.writeFileSync(jsonPath, `${JSON.stringify(payload, null, 2)}\n`);

const groups = Object.keys(labels).map((key) => [key, reviewed.filter((item) => item.trusted_status === key)]);
const md = [];
md.push('# 360Teams 集成 QBot 全量自动化可信二次复核报告', '');
md.push(`- 宿主：360Teams ${hostVersion}${hostBuild ? `（${hostBuild}）` : ''}`, `- 控制面：${controlPlane}`, `- QWork：${qworkVersion}`, `- 模型档位：${modelTier}`, `- 单 Case 超时：${timeoutMs}ms`, `- 范围：${expectedTotal} 条有效业务 Case，排除全部 SIT-INIT-* 与 SIT-AUTH-*`);
if (userSkippedCaseIds.length) md.push(`- 用户要求跳过 ${userSkippedCaseIds.length} 条未完成技能/MCP Case：${userSkippedCaseIds.join('、')}（不计入 ${expectedTotal} 条分母）`);
md.push('');
md.push('## 结论', '');
md.push(`原始结果为通过 ${summary.counts.passed}、失败 ${summary.counts.failed}、阻塞 ${summary.counts.blocked}；经逐条证据复核后，可信通过 ${counts.trusted_pass}、可信 Bug ${counts.trusted_bug}、可信失败 ${counts.trusted_failure}、可信阻塞 ${counts.trusted_blocked}、框架问题 ${counts.framework_issue}、用例问题 ${counts.testcase_issue}、需人工复核 ${counts.needs_review}。`, '');
md.push('本轮不能用原始通过率代替可信通过率。可信通过率为 ' + `${(counts.trusted_pass / expectedTotal * 100).toFixed(1)}%` + '；可形成产品结论的 Case 为可信通过、可信 Bug 和可信失败，共 ' + `${counts.trusted_pass + counts.trusted_bug + counts.trusted_failure}` + ' 条。', '');
md.push('## 复核方法', '');
for (const line of payload.methodology) md.push(`- ${line}`);
md.push('');
for (const [key, items] of groups) {
  md.push(`## ${labels[key]}（${items.length}）`, '');
  if (!items.length) {
    md.push('无。', '');
    continue;
  }
  md.push('| Case | 模块 | 标题 | 复核结论 | 关键证据 |', '|---|---|---|---|---|');
  for (const item of items) {
    const links = [];
    for (const file of item.key_screenshots) links.push(`[截图](${encodeURI(rel(file))})`);
    if (item.transcript) links.push(`[会话](${encodeURI(rel(item.transcript))})`);
    if (item.case_report && fs.existsSync(item.case_report)) links.push(`[原始报告](${encodeURI(rel(item.case_report))})`);
    md.push(`| ${item.id} | ${String(item.module || '').replaceAll('|', '\\|')} | ${String(item.title || '').replaceAll('|', '\\|')} | ${String(item.review_reason).replaceAll('|', '\\|')} | ${links.join(' / ')} |`);
  }
  md.push('');
}
md.push('## 证据完整性说明', '');
md.push(`- 原始通过 ${summary.counts?.passed || 0} 条，仍逐条核对核心用户动作、成功标准、截图和产物/会话证据。`, `- 原始 automation_error 按框架问题处理；原始 blocked 按真实宿主能力/数据前置复核，不冒充产品失败。`, '- 描述与截图不能直接互证的 Case 统一降为“需人工复核”，不进入可信通过率和可信 Bug 清单。', '');
const mdPath = path.join(outDir, '可信二次复核报告.md');
fs.writeFileSync(mdPath, `${md.join('\n')}\n`);

const bugItems = reviewed.filter((item) => item.trusted_status === 'trusted_bug');
const cards = bugItems.map((item) => {
  const images = item.key_screenshots.map((file, index) => {
    const src = esc(encodeURI(rel(file)));
    const caption = `${item.id} · 证据 ${index + 1}/${item.key_screenshots.length} · ${path.basename(file)}`;
    return `<button class="shot" type="button" data-src="${src}" data-caption="${esc(caption)}" aria-label="放大 ${esc(caption)}"><img loading="lazy" src="${src}" alt="${esc(caption)}"><span>${esc(path.basename(file))}</span></button>`;
  }).join('');
  const links = [
    item.case_report && fs.existsSync(item.case_report) ? `<a href="${esc(encodeURI(rel(item.case_report)))}">原始 Case 报告</a>` : '',
    item.transcript ? `<a href="${esc(encodeURI(rel(item.transcript)))}">完整会话</a>` : '',
    item.reply_delta ? `<a href="${esc(encodeURI(rel(item.reply_delta)))}">回复增量</a>` : '',
  ].filter(Boolean).join(' · ');
  return `<article class="card">
    <div class="head"><span class="badge ${esc(item.trusted_status)}">${esc(item.trusted_label)}</span><code>${esc(item.id)}</code></div>
    <h2>${esc(item.title)}</h2>
    <p class="reason"><b>复核判定：</b>${esc(item.review_reason)}</p>
    <details open><summary>用户视角四项结论</summary><p><b>用户操作：</b>${esc(item.user_operation)}</p><p><b>预期：</b>${esc(item.expected_user_outcome)}</p><p><b>实际看到：</b>${esc(item.observed_user_outcome)}</p><p><b>用户影响：</b>${esc(item.user_impact)}</p><p><b>截图匹配：</b>${esc(item.key_screenshot_reason)}</p></details>
    <div class="shots">${images}</div>
    <p class="links">${links}</p>
  </article>`;
}).join('\n');

const html = `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>360Teams 集成 QBot 产品 Bug 复核证据</title>
<style>
:root{color-scheme:light;--bg:#f4f6f8;--card:#fff;--ink:#172033;--muted:#667085;--bug:#b42318;--line:#e4e7ec}*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.wrap{max-width:1180px;margin:auto;padding:36px 22px 72px}.hero{background:linear-gradient(135deg,#15253c,#274765);color:#fff;padding:30px;border-radius:20px;box-shadow:0 18px 40px #15253c2b}.hero h1{margin:0 0 8px;font-size:30px}.hero p{margin:4px 0;color:#d7e1ec}.stats{display:flex;gap:12px;flex-wrap:wrap;margin-top:18px}.stat{background:#ffffff16;border:1px solid #ffffff26;border-radius:12px;padding:10px 14px}.stat b{font-size:22px}.note{margin:22px 0;color:var(--muted)}.kbd{display:inline-block;border:1px solid #cbd5e1;border-bottom-width:2px;border-radius:5px;background:#fff;padding:0 6px;color:#344054;font:12px/1.7 ui-monospace,SFMono-Regular,Menlo,monospace}.grid{display:grid;gap:20px}.card{background:var(--card);border:1px solid var(--line);border-radius:18px;padding:22px;box-shadow:0 8px 22px #1018280a}.head{display:flex;align-items:center;gap:10px}.badge{padding:3px 10px;border-radius:999px;font-weight:700}.trusted_bug{background:#fee4e2;color:var(--bug)}h2{font-size:21px;margin:10px 0}.reason{font-weight:500}.card details{border-top:1px solid var(--line);padding-top:10px}.shots{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:12px;margin-top:16px}.shot{display:block;width:100%;padding:0;background:#eef1f5;border-radius:12px;overflow:hidden;border:1px solid var(--line);cursor:zoom-in;color:var(--muted);text-align:left}.shot:hover,.shot:focus-visible{border-color:#175cd3;box-shadow:0 0 0 3px #175cd320;outline:none}.shot img{display:block;width:100%;height:280px;object-fit:contain;background:#eef1f5}.shot span{display:block;padding:7px 10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:12px}.links a{color:#175cd3;text-decoration:none}.links a:hover{text-decoration:underline}code{color:var(--muted)}.lightbox[hidden]{display:none}.lightbox{position:fixed;z-index:1000;inset:0;background:#07111df2;color:#fff;display:grid;grid-template-columns:72px minmax(0,1fr) 72px;grid-template-rows:auto minmax(0,1fr) auto;gap:10px;padding:18px}.lightbox-top{grid-column:1/-1;display:flex;align-items:center;justify-content:space-between;gap:14px}.lightbox-caption{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.icon-btn{width:48px;height:48px;border:1px solid #ffffff45;border-radius:999px;background:#ffffff18;color:#fff;font-size:30px;cursor:pointer}.icon-btn:hover,.icon-btn:focus-visible{background:#ffffff30;outline:2px solid #8ec5ff;outline-offset:2px}.nav{align-self:center}.viewer{min-width:0;min-height:0;overflow:auto;display:flex;align-items:center;justify-content:center;border-radius:12px;background:#0007}.viewer img{display:block;max-width:100%;max-height:100%;transform-origin:center center;transition:transform .12s ease;cursor:zoom-in}.toolbar{grid-column:1/-1;display:flex;align-items:center;justify-content:center;gap:10px}.toolbar button{border:1px solid #ffffff45;border-radius:8px;background:#ffffff18;color:#fff;padding:7px 13px;cursor:pointer}.zoom-label{min-width:56px;text-align:center;font-variant-numeric:tabular-nums}.lightbox-help{color:#cbd5e1;font-size:13px}@media(max-width:700px){.wrap{padding:18px 12px 48px}.hero{padding:22px}.shot img{height:auto}.lightbox{grid-template-columns:48px minmax(0,1fr) 48px;padding:8px}.icon-btn{width:42px;height:42px}.lightbox-help{display:none}}
</style></head><body><main class="wrap">
<section class="hero"><h1>360Teams 集成 QBot 产品 Bug 复核证据</h1><p>360Teams ${esc(hostVersion)}${hostBuild ? `（${esc(hostBuild)}）` : ''} · QWork ${esc(qworkVersion)} · ${esc(controlPlane)} · ${esc(modelTier)} · ${expectedTotal} 条有效业务 Case</p><p>本页仅收录重新核对操作、断言、截图、transcript 与 reply-delta 后仍成立的产品 Bug；框架、用例、阻塞和证据不足项均未混入。</p><div class="stats"><span class="stat"><b>${counts.trusted_bug}</b><br>复核确认产品 Bug</span></div></section>
<p class="note">生成时间：${esc(payload.generated_at)}。点击截图全屏放大；使用 <span class="kbd">←</span> <span class="kbd">→</span> 切换，<span class="kbd">+</span> <span class="kbd">−</span> 缩放，<span class="kbd">0</span> 复位，<span class="kbd">Esc</span> 关闭。</p>
<section class="grid">${cards}</section>
</main>
<div class="lightbox" id="lightbox" role="dialog" aria-modal="true" aria-label="证据截图查看器" hidden>
  <div class="lightbox-top"><span class="lightbox-caption" id="lightbox-caption"></span><span class="lightbox-help">←/→ 切换 · +/- 缩放 · 0 复位 · Esc 关闭</span><button class="icon-btn" id="lightbox-close" type="button" aria-label="关闭">×</button></div>
  <button class="icon-btn nav" id="lightbox-prev" type="button" aria-label="上一张">‹</button>
  <div class="viewer" id="lightbox-viewer"><img id="lightbox-image" alt="放大的证据截图"></div>
  <button class="icon-btn nav" id="lightbox-next" type="button" aria-label="下一张">›</button>
  <div class="toolbar"><button id="zoom-out" type="button">缩小 −</button><span class="zoom-label" id="zoom-label">100%</span><button id="zoom-in" type="button">放大 ＋</button><button id="zoom-reset" type="button">适应窗口</button></div>
</div>
<script>
(() => {
  const shots = Array.from(document.querySelectorAll('.shot'));
  const box = document.getElementById('lightbox');
  const image = document.getElementById('lightbox-image');
  const caption = document.getElementById('lightbox-caption');
  const viewer = document.getElementById('lightbox-viewer');
  const zoomLabel = document.getElementById('zoom-label');
  let current = 0;
  let scale = 1;

  const renderScale = () => {
    image.style.transform = 'scale(' + scale + ')';
    image.style.cursor = scale > 1 ? 'zoom-out' : 'zoom-in';
    zoomLabel.textContent = Math.round(scale * 100) + '%';
  };
  const resetZoom = () => { scale = 1; viewer.scrollTo(0, 0); renderScale(); };
  const show = (index) => {
    current = (index + shots.length) % shots.length;
    const shot = shots[current];
    image.src = shot.dataset.src;
    image.alt = shot.dataset.caption;
    caption.textContent = (current + 1) + '/' + shots.length + ' · ' + shot.dataset.caption;
    resetZoom();
  };
  const open = (index) => {
    show(index);
    box.hidden = false;
    document.body.style.overflow = 'hidden';
    document.getElementById('lightbox-close').focus();
  };
  const close = () => {
    box.hidden = true;
    document.body.style.overflow = '';
    shots[current]?.focus();
  };
  const zoom = (delta) => { scale = Math.min(4, Math.max(0.5, Number((scale + delta).toFixed(2)))); renderScale(); };
  shots.forEach((shot, index) => shot.addEventListener('click', () => open(index)));
  document.getElementById('lightbox-close').addEventListener('click', close);
  document.getElementById('lightbox-prev').addEventListener('click', () => show(current - 1));
  document.getElementById('lightbox-next').addEventListener('click', () => show(current + 1));
  document.getElementById('zoom-in').addEventListener('click', () => zoom(0.25));
  document.getElementById('zoom-out').addEventListener('click', () => zoom(-0.25));
  document.getElementById('zoom-reset').addEventListener('click', resetZoom);
  image.addEventListener('click', () => scale > 1 ? resetZoom() : zoom(0.5));
  box.addEventListener('click', (event) => { if (event.target === box) close(); });
  document.addEventListener('keydown', (event) => {
    if (box.hidden) return;
    if (event.key === 'ArrowLeft') show(current - 1);
    else if (event.key === 'ArrowRight') show(current + 1);
    else if (event.key === 'Escape') close();
    else if (event.key === '+' || event.key === '=') zoom(0.25);
    else if (event.key === '-' || event.key === '_') zoom(-0.25);
    else if (event.key === '0') resetZoom();
  });
})();
</script></body></html>`;
const htmlPath = path.join(outDir, '可信Bug复核证据.html');
const legacyBugHtmlPath = path.join(outDir, '可信Bug证据.html');
fs.writeFileSync(htmlPath, html);
fs.writeFileSync(legacyBugHtmlPath, html);

const allRows = reviewed.map((item) => {
  const links = [];
  for (const file of item.key_screenshots) links.push(`<a href="${esc(encodeURI(rel(file)))}">截图</a>`);
  if (item.transcript) links.push(`<a href="${esc(encodeURI(rel(item.transcript)))}">会话</a>`);
  if (item.reply_delta) links.push(`<a href="${esc(encodeURI(rel(item.reply_delta)))}">回复增量</a>`);
  if (item.case_report && fs.existsSync(item.case_report)) links.push(`<a href="${esc(encodeURI(rel(item.case_report)))}">Case 报告</a>`);
  return `<tr><td>${item.order}</td><td><code>${esc(item.id)}</code></td><td>${esc(`${item.raw_status}/${item.raw_category}`)}</td><td><span class="badge ${esc(item.trusted_status)}">${esc(item.trusted_label)}</span></td><td>${esc(item.review_reason)}${item.product_observation ? `<br><small>${esc(item.product_observation)}</small>` : ''}</td><td>${links.join(' · ')}</td></tr>`;
}).join('\n');
const allStats = Object.entries(labels).map(([key, label]) => `<span class="stat"><b>${counts[key]}</b><br>${esc(label)}</span>`).join('');
const scopeNotice = userSkippedCaseIds.length
  ? `有效分母 ${expectedTotal}；排除 INIT/AUTH；${userSkippedCaseIds.join('、')} 按用户要求跳过且不计入分母。`
  : `有效分母 ${expectedTotal}；排除 INIT/AUTH；本报告只覆盖当前完整、非合成运行中的 Case。`;
const detailedHtml = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>360Teams × QBot ${expectedTotal} Case 可信二次复核报告</title><style>
:root{--bg:#f4f7fb;--card:#fff;--ink:#172033;--muted:#667085;--line:#dfe5ec}*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:14px/1.55 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.wrap{max-width:1500px;margin:auto;padding:28px}.hero{padding:28px;border-radius:18px;color:#fff;background:linear-gradient(135deg,#12263f,#24577b)}h1{margin:0 0 8px}.hero p{margin:4px 0;color:#d8e5ef}.notice{margin:18px 0;padding:15px 18px;border:1px solid #f4c066;border-radius:12px;background:#fff7e8}.stats{display:flex;gap:10px;flex-wrap:wrap;margin-top:18px}.stat{background:#ffffff18;border:1px solid #ffffff2a;border-radius:10px;padding:8px 12px}.stat b{font-size:21px}.table-wrap{overflow:auto;background:#fff;border:1px solid var(--line);border-radius:14px;margin-top:18px}table{border-collapse:collapse;width:100%;min-width:1250px}th,td{padding:10px 12px;border-bottom:1px solid var(--line);text-align:left;vertical-align:top}th{position:sticky;top:0;background:#eef3f8}.badge{display:inline-block;white-space:nowrap;padding:3px 8px;border-radius:999px;font-weight:650}.trusted_pass{background:#dcfae6;color:#087443}.trusted_bug{background:#fee4e2;color:#b42318}.trusted_failure{background:#ffead5;color:#b54708}.trusted_blocked{background:#f2f4f7;color:#344054}.framework_issue{background:#e0f2fe;color:#075985}.testcase_issue{background:#ede9fe;color:#5b21b6}.needs_review{background:#fff4cc;color:#7a4d00}small{color:var(--muted)}a{color:#175cd3;text-decoration:none}@media(max-width:900px){.wrap{padding:12px}}
</style></head><body><main class="wrap"><section class="hero"><h1>360Teams × QBot ${expectedTotal} Case 可信二次复核报告</h1><p>360Teams ${esc(hostVersion)}${hostBuild ? `（${esc(hostBuild)}）` : ''} · QWork ${esc(qworkVersion)} · ${esc(controlPlane)} · M3 · 600000ms</p><p>原始状态只作线索；以下分类来自操作、截图、transcript、reply-delta、成果、附件与日志交叉核验。</p><div class="stats">${allStats}</div></section><section class="notice"><b>范围说明：</b>${esc(scopeNotice)}</section><section class="table-wrap"><table><thead><tr><th>顺序</th><th>Case</th><th>原始线索</th><th>可信分类</th><th>复核依据</th><th>证据</th></tr></thead><tbody>${allRows}</tbody></table></section></main></body></html>`;
const detailedHtmlPath = path.join(outDir, '可信二次复核报告.html');
fs.writeFileSync(detailedHtmlPath, detailedHtml);

console.log(JSON.stringify({ outDir, counts, files: { markdown: mdPath, json: jsonPath, html: detailedHtmlPath, bug_html: htmlPath } }, null, 2));
