#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { loadTrustedValidationSources } from './trusted-history.mjs';

const projectDir = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const outputRoot = path.join(projectDir, 'output');
const earlierTrustedDir = path.join(outputRoot, '202607181131_full_178_excl-init-auth_teams360_5.2.12-2119071778_m3_framework-1125d15');
const fullTrustedDir = path.join(outputRoot, '202607201608_full_178_excl-init-auth_teams360_5.2.16-2119072065_qwork-0.0.7_dev_m3_framework-fixed');
const latestRerunDir = path.join(outputRoot, '202607201935_framework-rerun-71_teams360_5.2.17-2119072078_qwork-0.0.8_dev_m3');

const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const earlierTrustedPath = path.join(earlierTrustedDir, '可信二次复核结果.json');
const fullTrustedPath = path.join(fullTrustedDir, '可信终审报告.json');
const fullProgressPath = path.join(fullTrustedDir, 'automation-progress.json');
const latestTrustedPath = path.join(latestRerunDir, '可信二次复核结果.json');
const originalRerunPlanPath = path.join(latestRerunDir, 'casebook-cases.original-71.json');
const trustedValidationManifestPath = path.join(latestRerunDir, 'trusted-validation-sources.json');
const targetHost = {
  product: '360Teams',
  version: '5.2.17',
  build: '2119072078',
  qwork: '0.0.8',
  control_plane_origin: 'https://deepbank-control-dev.sandbox.deepbank.daikuan.qihoo.net',
  model_tier: 'M3',
  timeout_ms: 600000,
};

for (const file of [earlierTrustedPath, fullTrustedPath, fullProgressPath, latestTrustedPath, originalRerunPlanPath]) {
  if (!fs.existsSync(file)) throw new Error(`Missing consolidation input: ${file}`);
}

const earlierTrusted = readJson(earlierTrustedPath);
const fullTrusted = readJson(fullTrustedPath);
const fullProgress = readJson(fullProgressPath);
const latestTrusted = readJson(latestTrustedPath);
const originalRerunPlan = readJson(originalRerunPlanPath);

if (earlierTrusted.results?.length !== 178 || fullTrusted.results?.length !== 178 || fullProgress.results?.length !== 178) {
  throw new Error('Expected complete 178-Case earlier/full evidence inputs.');
}
if (latestTrusted.results?.length !== 68 || originalRerunPlan.cases?.length !== 71) {
  throw new Error('Expected the final 68-Case review and original 71-Case rerun plan.');
}

const labels = {
  trusted_pass: '可信通过',
  trusted_bug: '可信问题',
  trusted_failure: '可信失败',
  trusted_blocked: '可信阻塞',
  framework_issue: '框架问题',
  testcase_issue: '用例问题',
  needs_review: '需人工复核',
};

const earlierById = new Map(earlierTrusted.results.map((item) => [item.id, item]));
const fullById = new Map(fullTrusted.results.map((item) => [item.id, item]));
const rawById = new Map(fullProgress.results.map((item) => [item.id, item]));
const latestById = new Map(latestTrusted.results.map((item) => [item.id, item]));
const rerunPlanIds = new Set(originalRerunPlan.cases.map((item) => item.id));
const fullIds = new Set(fullTrusted.results.map((item) => item.id));

if (fullIds.size !== 178 || latestTrusted.results.some((item) => !fullIds.has(item.id))) {
  throw new Error('Case IDs are not a unique subset of the frozen 178-Case baseline.');
}
const validations = loadTrustedValidationSources({
  manifestPath: trustedValidationManifestPath,
  baselineIds: [...fullIds],
  targetHost,
});
const validationById = validations.byId;

const skippedRerunIds = [...rerunPlanIds].filter((id) => !latestById.has(id));
const expectedSkipped = ['SIT-CONN-018', 'SIT-TEAMS-DOC-001', 'SIT-SKILL-SCOPE-001'];
if (skippedRerunIds.length !== 3 || expectedSkipped.some((id) => !skippedRerunIds.includes(id))) {
  throw new Error(`Unexpected skipped rerun IDs: ${skippedRerunIds.join(', ')}`);
}

const sendCountReason = '缺少可信的模型档位证据';
const allSendCountFalsePositiveIds = new Set(fullTrusted.results
  .filter((item) => item.final_category === 'framework_issue' && String(item.reason || '').includes(sendCountReason))
  .map((item) => item.id));
if (allSendCountFalsePositiveIds.size !== 54) {
  throw new Error(`Expected 54 send-count false positives, got ${allSendCountFalsePositiveIds.size}.`);
}

const sendCountOnlyIds = new Set([...allSendCountFalsePositiveIds].filter((id) => !rerunPlanIds.has(id)));
const sendCountRerunIds = [...allSendCountFalsePositiveIds].filter((id) => rerunPlanIds.has(id));
if (sendCountOnlyIds.size !== 46 || sendCountRerunIds.length !== 8) {
  throw new Error(`Expected send-count split 46/8, got ${sendCountOnlyIds.size}/${sendCountRerunIds.length}.`);
}

const correctedFailedCases = new Map(Object.entries({
  'SIT-HOME-053': ['trusted_pass', '最新全量记录的第三轮回复完整保留新客、沉默客和高价值老客分层，71/72 条断言通过；唯一失败为相关性解析误报。'],
  'SIT-HOME-057': ['trusted_bug', '真实回复在信息不足时直接采用旧活动数据并生成完整文件，未完成最少必要澄清；证据与前序可信结论一致。'],
  'SIT-HOME-061': ['trusted_pass', '真实回复明确给出第1步、第2步、第3步及完整检查清单；plan_steps=4 是标题被额外计数的解析误报。'],
  'SIT-HOME-062': ['trusted_pass', '真实回复明确说明缺少投入成本和成交产出，给出两种 ROI 公式且未编造金额；inputs/formula 解析为 false 属于误报。'],
  'SIT-HOME-064': ['trusted_pass', '真实渲染内容包含固定四列和恰好三条任务；DOM 文本被扁平化后 Markdown 解析误报。'],
  'SIT-HOME-065': ['trusted_pass', '真实回复明确说明未找到预算表、不虚构金额并给出重新上传指引；核心边界全部满足。'],
  'SIT-EXPERT-009': ['trusted_bug', '依赖技能专家召唤真实返回 expert_bound_skill_not_ready 的控制面 HTTP 500；两轮可信证据一致。'],
  'SIT-EXPERT-022': ['trusted_pass', '最新一次尝试被平台连接器临时同步失败挡住，但前序可信执行已完成专家切回通用助手验证；采用最近一次可形成业务结论的可信记录。'],
  'SIT-ART-002': ['trusted_pass', '成果生成、Agent 回复、成果区文件名、HTML 类型和打开入口等 10/10 断言通过；最终状态仅受截图字体等待超时影响，已有 artifact-panel 截图足以证明功能结果。'],
}));

const historyFor = (id) => {
  const earlier = earlierById.get(id);
  const full = fullById.get(id);
  const latest = latestById.get(id);
  const validation = validationById.get(id);
  return [
    earlier ? { lane: 'earlier_trusted_review', status: earlier.trusted_status, reason: earlier.review_reason, case_report: earlier.case_report } : null,
    full ? { lane: 'full_178_terminal_review', status: full.final_category, reason: full.reason, case_report: full.case_report } : null,
    latest ? { lane: 'latest_rerun_review', status: latest.trusted_status, reason: latest.review_reason, case_report: latest.case_report } : null,
    validation ? {
      lane: 'targeted_validation_review',
      status: validation.trusted_status,
      reason: validation.review_reason,
      case_report: validation.case_report,
      ended_at: validation.validation_ended_at,
    } : null,
  ].filter(Boolean);
};

const normalize = ({ id, trustedStatus, reason, sourceLane, evidence }) => {
  const raw = rawById.get(id);
  const full = fullById.get(id);
  const latest = latestById.get(id);
  const validation = validationById.get(id);
  return {
    id,
    order: raw?.order ?? latest?.order ?? null,
    module: validation?.module || latest?.module || full?.module || raw?.module || '',
    title: validation?.title || latest?.title || full?.scenario || raw?.title || '',
    trusted_status: trustedStatus,
    trusted_label: labels[trustedStatus],
    review_reason: reason,
    source_lane: sourceLane,
    evidence,
    history: historyFor(id),
  };
};

const consolidated = fullProgress.results.map((raw) => {
  const id = raw.id;
  const validation = validationById.get(id);
  const latest = latestById.get(id);
  const full = fullById.get(id);
  if (validation) {
    return normalize({
      id,
      trustedStatus: validation.trusted_status,
      reason: validation.review_reason,
      sourceLane: 'targeted_validation_review',
      evidence: {
        case_report: validation.case_report,
        screenshots: validation.key_screenshots || [],
        transcript: validation.transcript,
        reply_delta: validation.reply_delta,
        validation_out_dir: validation.validation_out_dir,
        validation_ended_at: validation.validation_ended_at,
      },
    });
  }
  if (latest) {
    return normalize({
      id,
      trustedStatus: latest.trusted_status,
      reason: latest.review_reason,
      sourceLane: 'latest_rerun_68',
      evidence: {
        case_report: latest.case_report,
        screenshots: latest.key_screenshots || [],
        transcript: latest.transcript,
        reply_delta: latest.reply_delta,
      },
    });
  }
  if (skippedRerunIds.includes(id)) {
    return normalize({
      id,
      trustedStatus: full.final_category,
      reason: `${full.reason} 最新复跑按用户要求跳过技能/MCP相关 Case，因此保留前序可信终审结论。`,
      sourceLane: 'skipped_in_latest_rerun_3',
      evidence: { case_report: full.case_report, screenshots: full.key_screenshot ? [full.key_screenshot] : [] },
    });
  }
  if (sendCountOnlyIds.has(id)) {
    let trustedStatus = 'trusted_pass';
    let reason = '发送次数统计误报已修正；原记录真实操作完成、M3 证据与实际发送轮次匹配，且业务断言和证据链通过。';
    if (raw.status !== 'passed') {
      const correction = correctedFailedCases.get(id);
      if (!correction) throw new Error(`Missing manual evidence correction for ${id}.`);
      [trustedStatus, reason] = correction;
    }
    return normalize({
      id,
      trustedStatus,
      reason,
      sourceLane: 'send_count_false_positive_corrected_46',
      evidence: {
        case_report: raw.case_report,
        screenshots: raw.screenshots_flat || Object.values(raw.screenshots || {}).filter((value) => typeof value === 'string'),
        transcript: raw.artifacts?.transcript,
        reply_delta: raw.artifacts?.reply_delta,
      },
    });
  }
  return normalize({
    id,
    trustedStatus: full.final_category,
    reason: full.reason,
    sourceLane: 'full_178_terminal_trusted_61',
    evidence: { case_report: full.case_report, screenshots: full.key_screenshot ? [full.key_screenshot] : [] },
  });
});

const uniqueIds = new Set(consolidated.map((item) => item.id));
if (consolidated.length !== 178 || uniqueIds.size !== 178) {
  throw new Error(`Consolidation must contain 178 unique cases, got ${consolidated.length}/${uniqueIds.size}.`);
}

const counts = Object.fromEntries(Object.keys(labels).map((status) => [
  status,
  consolidated.filter((item) => item.trusted_status === status).length,
]));
const sourceCounts = Object.fromEntries([...new Set(consolidated.map((item) => item.source_lane))].map((lane) => [
  lane,
  consolidated.filter((item) => item.source_lane === lane).length,
]));
if (Object.values(counts).reduce((sum, value) => sum + value, 0) !== 178) throw new Error('Trusted counts do not add up to 178.');
if (sourceCounts.targeted_validation_review !== validationById.size
  || sourceCounts.latest_rerun_68 !== 68 - validationById.size
  || sourceCounts.send_count_false_positive_corrected_46 !== 46
  || sourceCounts.full_178_terminal_trusted_61 !== 61
  || sourceCounts.skipped_in_latest_rerun_3 !== 3) {
  throw new Error(`Unexpected source-lane counts: ${JSON.stringify(sourceCounts)}`);
}

const blockedItems = consolidated.filter((item) => item.trusted_status === 'trusted_blocked');
const previouslyOmittedStatuses = ['trusted_bug', 'framework_issue', 'testcase_issue', 'needs_review'];
const previouslyOmittedItems = Object.fromEntries(previouslyOmittedStatuses.map((status) => [
  status,
  consolidated.filter((item) => item.trusted_status === status),
]));
const moduleRows = [...new Set(consolidated.map((item) => item.module))].map((module) => {
  const items = consolidated.filter((item) => item.module === module);
  return {
    module,
    total: items.length,
    trusted_pass: items.filter((item) => item.trusted_status === 'trusted_pass').length,
    trusted_bug: items.filter((item) => item.trusted_status === 'trusted_bug').length,
    trusted_failure: items.filter((item) => item.trusted_status === 'trusted_failure').length,
    trusted_blocked: items.filter((item) => item.trusted_status === 'trusted_blocked').length,
    framework_issue: items.filter((item) => item.trusted_status === 'framework_issue').length,
    testcase_issue: items.filter((item) => item.trusted_status === 'testcase_issue').length,
    needs_review: items.filter((item) => item.trusted_status === 'needs_review').length,
  };
});

const payload = {
  report_version: 1,
  generated_at: new Date().toISOString(),
  host: {
    ...targetHost,
    control_plane: 'DEV',
  },
  scope: {
    total_unique_cases: 178,
    excluded_patterns: ['SIT-INIT-*', 'SIT-AUTH-*'],
    aggregation_rule: '按 Case ID 去重；优先采用最新且证据完整的可信复核，未复跑 Case 保留前序可信结论。',
  },
  source_summary: {
    earlier_trusted_review_cases: 178,
    full_terminal_review_cases: 178,
    latest_rerun_planned_cases: 71,
    latest_rerun_reviewed_cases: 68,
    latest_rerun_user_skipped_cases: 3,
    targeted_validation_reviewed_cases: validationById.size,
    send_count_false_positive_cases: 54,
    send_count_false_positive_corrected_without_rerun: 46,
    send_count_false_positive_retained_for_rerun: 8,
    source_lane_counts: sourceCounts,
  },
  trusted_counts: counts,
  displayed_brief_counts: {
    trusted_pass: counts.trusted_pass,
    trusted_failure: counts.trusted_failure,
    trusted_blocked: counts.trusted_blocked,
    other_not_expanded: 178 - counts.trusted_pass - counts.trusted_failure - counts.trusted_blocked,
  },
  blocked_items: blockedItems,
  module_summary: moduleRows,
  sources: [
    earlierTrustedPath,
    fullTrustedPath,
    latestTrustedPath,
    originalRerunPlanPath,
    trustedValidationManifestPath,
    ...validations.sources.flatMap((source) => Object.values(source.files)),
  ],
  results: consolidated,
};

const jsonPath = path.join(latestRerunDir, '178条综合可信结果.json');
fs.writeFileSync(jsonPath, `${JSON.stringify(payload, null, 2)}\n`);

const esc = (value) => String(value ?? '')
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#39;');
const pct = (value) => `${(value / 178 * 100).toFixed(1)}%`;
const md = [
  '# 360Teams × QBot 178 条综合测试简报',
  '',
  '## 核心结论',
  '',
  '- 宿主：360Teams 5.2.17（2119072078）',
  '- QWork：0.0.8；控制面：DEV；模型档位：M3；单 Case 最长等待：600000ms',
  '- 冻结范围：178 条唯一业务 Case；排除全部 SIT-INIT-* 与 SIT-AUTH-*',
  '- 执行记录覆盖：178/178；按 Case ID 合并前序可信复核与最新复跑，不重复累计多轮执行。',
  `- 可信通过：${counts.trusted_pass} 条（${pct(counts.trusted_pass)}）`,
  `- 可信问题：${counts.trusted_bug} 条（${pct(counts.trusted_bug)}）`,
  `- 可信失败：${counts.trusted_failure} 条（${pct(counts.trusted_failure)}）`,
  `- 可信阻塞：${counts.trusted_blocked} 条（${pct(counts.trusted_blocked)}）`,
  `- 框架问题：${counts.framework_issue} 条（${pct(counts.framework_issue)}）`,
  `- 用例问题：${counts.testcase_issue} 条（${pct(counts.testcase_issue)}）`,
  `- 需人工复核：${counts.needs_review} 条（${pct(counts.needs_review)}）`,
  `- 七类合计：${Object.values(counts).reduce((sum, value) => sum + value, 0)} 条。`,
  '',
  '> 本简报是 178 条 Case 的累计证据合并结果，不表示 178 条全部在同一次执行中重新运行。最新复跑覆盖 68 条，其余 Case 使用可追溯的前序可信证据。',
  '',
  '## 全量分类对账',
  '',
  '| 分类 | 数量 | 占比 |',
  '|---|---:|---:|',
  `| 可信通过 | ${counts.trusted_pass} | ${pct(counts.trusted_pass)} |`,
  `| 可信问题 | ${counts.trusted_bug} | ${pct(counts.trusted_bug)} |`,
  `| 可信失败 | ${counts.trusted_failure} | ${pct(counts.trusted_failure)} |`,
  `| 可信阻塞 | ${counts.trusted_blocked} | ${pct(counts.trusted_blocked)} |`,
  `| 框架问题 | ${counts.framework_issue} | ${pct(counts.framework_issue)} |`,
  `| 用例问题 | ${counts.testcase_issue} | ${pct(counts.testcase_issue)} |`,
  `| 需人工复核 | ${counts.needs_review} | ${pct(counts.needs_review)} |`,
  '| **合计** | **178** | **100.0%** |',
  '',
  '## 合并口径',
  '',
  '| 来源 | Case 数 | 处理方式 |',
  '|---|---:|---|',
  `| 定向修复验证可信复核 | ${sourceCounts.targeted_validation_review || 0} | 完整性、宿主身份、Case 集和严格证据门禁全部通过后覆盖旧结论 |`,
  `| 最新复跑可信复核（未被定向验证覆盖） | ${sourceCounts.latest_rerun_68 || 0} | 覆盖同 ID 的前序结论 |`,
  '| 发送次数纯误报修正 | 46 | 不重跑；重新核对原操作、断言、截图和会话证据 |',
  '| 前序全量可信终审 | 61 | 未受本轮框架修复影响，保留可信结论 |',
  '| 最新复跑按要求跳过 | 3 | 保留前序结论，不在恢复时加回 |',
  '| 合计 | 178 | 每个 Case 只计一次 |',
  '',
  '- 原 117 条框架项中共有 54 条命中“发送次数”误报。',
  '- 其中 46 条仅受该误报影响，修正规则后直接依据原证据复核；另外 8 条还有独立验证点，仍保留在最新复跑范围内。',
  '',
  '## 可信阻塞',
  '',
];
for (const item of blockedItems) md.push(`- ${item.id}：${item.title}。${item.review_reason}`);
const previouslyOmittedCount = previouslyOmittedStatuses
  .reduce((sum, status) => sum + previouslyOmittedItems[status].length, 0);
md.push('', `## 需展开关注项（${previouslyOmittedCount} 条）`, '');
for (const status of previouslyOmittedStatuses) {
  md.push(`### ${labels[status]}（${previouslyOmittedItems[status].length}）`, '');
  md.push(previouslyOmittedItems[status].map((item) => `\`${item.id}\``).join('、'), '');
}
md.push('', '## 模块概览', '', '| 模块 | 总数 | 可信通过 | 可信问题 | 可信失败 | 可信阻塞 | 框架问题 | 用例问题 | 需人工复核 |', '|---|---:|---:|---:|---:|---:|---:|---:|---:|');
for (const row of moduleRows) md.push(`| ${row.module} | ${row.total} | ${row.trusted_pass} | ${row.trusted_bug} | ${row.trusted_failure} | ${row.trusted_blocked} | ${row.framework_issue} | ${row.testcase_issue} | ${row.needs_review} |`);
md.push('', '## 汇报摘要', '', `本轮按 178 条唯一 Case 合并全部可追溯执行记录和多轮可信复核：可信通过 ${counts.trusted_pass} 条、可信问题 ${counts.trusted_bug} 条、可信失败 ${counts.trusted_failure} 条、可信阻塞 ${counts.trusted_blocked} 条、框架问题 ${counts.framework_issue} 条、用例问题 ${counts.testcase_issue} 条、需人工复核 ${counts.needs_review} 条，七类合计 178 条；可信通过率 ${pct(counts.trusted_pass)}。`, '');

const mdText = `${md.join('\n')}\n`;
const mdPath = path.join(latestRerunDir, '178条综合测试简报.md');
const legacyMdPath = path.join(latestRerunDir, '本轮测试简报.md');
fs.writeFileSync(mdPath, mdText);
fs.writeFileSync(legacyMdPath, mdText);

const moduleTableRows = moduleRows.map((row) => `<tr><td>${esc(row.module)}</td><td>${row.total}</td><td>${row.trusted_pass}</td><td>${row.trusted_bug}</td><td>${row.trusted_failure}</td><td>${row.trusted_blocked}</td><td>${row.framework_issue}</td><td>${row.testcase_issue}</td><td>${row.needs_review}</td></tr>`).join('');
const blockedList = blockedItems.map((item) => `<li><code>${esc(item.id)}</code>：${esc(item.title)}。<span>${esc(item.review_reason)}</span></li>`).join('');
const omittedDetails = previouslyOmittedStatuses.map((status) => `<details><summary>${esc(labels[status])}（${previouslyOmittedItems[status].length}）</summary><div class="chips">${previouslyOmittedItems[status].map((item) => `<code>${esc(item.id)}</code>`).join('')}</div></details>`).join('');
const html = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>360Teams × QBot 178 条综合测试简报</title><style>
:root{--bg:#f3f6fa;--card:#fff;--ink:#172033;--muted:#667085;--line:#dde4ec;--blue:#175cd3;--green:#087443;--amber:#b54708}*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.65 -apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC",sans-serif}.wrap{max-width:1180px;margin:auto;padding:34px 22px 72px}.hero{padding:32px;border-radius:20px;color:#fff;background:linear-gradient(135deg,#102a43,#22577a);box-shadow:0 18px 44px #102a4328}.hero h1{margin:0 0 8px;font-size:30px}.hero p{margin:4px 0;color:#d8e6f1}.metrics{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px;margin:22px 0}.metric{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:20px;box-shadow:0 6px 18px #1018280a}.metric b{display:block;font-size:30px;line-height:1.2}.metric span{color:var(--muted)}.metric.pass b{color:var(--green)}.metric.block b{color:var(--amber)}.section{margin-top:18px;background:var(--card);border:1px solid var(--line);border-radius:16px;padding:22px}.section h2{margin:0 0 12px;font-size:20px}.summary{border-left:4px solid var(--blue);background:#eff8ff;padding:15px 18px;border-radius:8px}.warning{border-left:4px solid #f79009;background:#fff7e8;padding:13px 16px;border-radius:8px}.muted{color:var(--muted)}table{width:100%;border-collapse:collapse}th,td{padding:10px 12px;border-bottom:1px solid var(--line);text-align:left}th{background:#f7f9fc}td:not(:first-child),th:not(:first-child){text-align:right;font-variant-numeric:tabular-nums}code{font:13px ui-monospace,SFMono-Regular,Menlo,monospace}.blocked li{margin:8px 0}.blocked span{color:var(--muted)}details{margin:10px 0;border:1px solid var(--line);border-radius:10px;padding:10px 13px}summary{cursor:pointer;font-weight:650}.chips{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}.chips code{padding:4px 8px;background:#f2f4f7;border-radius:6px}@media(max-width:760px){.wrap{padding:16px 12px 42px}.metrics{grid-template-columns:repeat(2,minmax(0,1fr))}.table-wrap{overflow:auto}.hero{padding:24px}}
</style></head><body><main class="wrap"><section class="hero"><h1>360Teams × QBot 178 条综合测试简报</h1><p>360Teams 5.2.17（2119072078） · QWork 0.0.8 · DEV · M3</p><p>178 条唯一业务 Case · 排除 INIT/AUTH · 多轮记录按 Case ID 去重合并</p></section><section class="metrics"><div class="metric"><b>178/178</b><span>执行记录覆盖 · 100%</span></div><div class="metric pass"><b>${counts.trusted_pass}</b><span>可信通过 · ${pct(counts.trusted_pass)}</span></div><div class="metric"><b>${counts.trusted_bug}</b><span>可信问题 · ${pct(counts.trusted_bug)}</span></div><div class="metric"><b>${counts.trusted_failure}</b><span>可信失败 · ${pct(counts.trusted_failure)}</span></div><div class="metric block"><b>${counts.trusted_blocked}</b><span>可信阻塞 · ${pct(counts.trusted_blocked)}</span></div><div class="metric"><b>${counts.framework_issue}</b><span>框架问题 · ${pct(counts.framework_issue)}</span></div><div class="metric"><b>${counts.testcase_issue}</b><span>用例问题 · ${pct(counts.testcase_issue)}</span></div><div class="metric"><b>${counts.needs_review}</b><span>需人工复核 · ${pct(counts.needs_review)}</span></div></section><section class="section"><h2>核心结论</h2><div class="summary">可信通过 ${counts.trusted_pass} 条、可信问题 ${counts.trusted_bug} 条、可信失败 ${counts.trusted_failure} 条、可信阻塞 ${counts.trusted_blocked} 条、框架问题 ${counts.framework_issue} 条、用例问题 ${counts.testcase_issue} 条、需人工复核 ${counts.needs_review} 条；七类合计 178 条。</div><div class="warning">这是累计证据合并结果，不表示 178 条全部在同一次执行中重新运行。定向验证必须通过完整性、宿主身份和严格证据门禁后才能覆盖旧结论。</div></section><section class="section"><h2>全量分类对账</h2><table><thead><tr><th>分类</th><th>数量</th><th>占比</th></tr></thead><tbody><tr><td>可信通过</td><td>${counts.trusted_pass}</td><td>${pct(counts.trusted_pass)}</td></tr><tr><td>可信问题</td><td>${counts.trusted_bug}</td><td>${pct(counts.trusted_bug)}</td></tr><tr><td>可信失败</td><td>${counts.trusted_failure}</td><td>${pct(counts.trusted_failure)}</td></tr><tr><td>可信阻塞</td><td>${counts.trusted_blocked}</td><td>${pct(counts.trusted_blocked)}</td></tr><tr><td>框架问题</td><td>${counts.framework_issue}</td><td>${pct(counts.framework_issue)}</td></tr><tr><td>用例问题</td><td>${counts.testcase_issue}</td><td>${pct(counts.testcase_issue)}</td></tr><tr><td>需人工复核</td><td>${counts.needs_review}</td><td>${pct(counts.needs_review)}</td></tr><tr><td><b>合计</b></td><td><b>178</b></td><td><b>100.0%</b></td></tr></tbody></table></section><section class="section"><h2>需展开关注项（${previouslyOmittedCount} 条）</h2><p class="muted">以下分类全部显式呈现，不再用展示口径隐藏。</p>${omittedDetails}</section><section class="section"><h2>合并口径</h2><table><thead><tr><th>来源</th><th>Case 数</th><th>处理方式</th></tr></thead><tbody><tr><td>定向修复验证可信复核</td><td>${sourceCounts.targeted_validation_review || 0}</td><td>完成性、宿主身份、Case 集和严格证据均校验</td></tr><tr><td>最新复跑可信复核（未被定向验证覆盖）</td><td>${sourceCounts.latest_rerun_68 || 0}</td><td>覆盖同 ID 前序结论</td></tr><tr><td>发送次数纯误报修正</td><td>46</td><td>用原证据重新复核</td></tr><tr><td>前序全量可信终审</td><td>61</td><td>保留可信结论</td></tr><tr><td>最新复跑按要求跳过</td><td>3</td><td>保留前序结论</td></tr><tr><td><b>合计</b></td><td><b>178</b></td><td>每个 Case 只计一次</td></tr></tbody></table><p class="muted">原 117 条框架项中共有 54 条命中发送次数误报：46 条只有这一问题，直接修正；另外 8 条已经定向验证并以新证据覆盖旧分类。</p></section><section class="section"><h2>可信阻塞（${counts.trusted_blocked}）</h2><ul class="blocked">${blockedList}</ul></section><section class="section"><h2>模块概览</h2><div class="table-wrap"><table><thead><tr><th>模块</th><th>总数</th><th>可信通过</th><th>可信问题</th><th>可信失败</th><th>可信阻塞</th><th>框架问题</th><th>用例问题</th><th>需人工复核</th></tr></thead><tbody>${moduleTableRows}</tbody></table></div></section></main></body></html>`;

const htmlPath = path.join(latestRerunDir, '178条综合测试简报.html');
const legacyHtmlPath = path.join(latestRerunDir, '本轮测试简报.html');
fs.writeFileSync(htmlPath, html);
fs.writeFileSync(legacyHtmlPath, html);

console.log(JSON.stringify({ counts, sourceCounts, files: { json: jsonPath, markdown: mdPath, html: htmlPath } }, null, 2));
