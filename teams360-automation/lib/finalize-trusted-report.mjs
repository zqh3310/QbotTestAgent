#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const input = process.argv[2];
if (!input) {
  console.error('Usage: node finalize-trusted-report.mjs <automation-output-directory>');
  process.exit(2);
}

const outDir = path.resolve(input);
const reviewPath = path.join(outDir, '二次复核结构化结果.json');
const summaryPath = path.join(outDir, 'automation-run-summary.json');
if (!fs.existsSync(reviewPath) || !fs.existsSync(summaryPath)) {
  throw new Error('The completed run summary and built-in second-review result are required.');
}

const review = JSON.parse(fs.readFileSync(reviewPath, 'utf8'));
const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
const items = Array.isArray(review.items) ? review.items : [];
const expectedTotal = Number(summary.counts?.total || review.counts?.total || 0);
if (expectedTotal !== 178 || items.length !== expectedTotal || !summary.ended_at) {
  throw new Error(`Expected one ended 178-Case run, got summary=${expectedTotal}, reviews=${items.length}.`);
}

const categoryFor = (value) => {
  const category = String(value || '');
  if (category.startsWith('可信通过')) return 'trusted_pass';
  if (category.includes('产品Bug候选')) return 'trusted_bug';
  if (category.startsWith('可信阻塞')) return 'trusted_blocked';
  if (category.includes('case需优化')) return 'needs_review';
  if (category.includes('用例问题')) return 'testcase_issue';
  if (category.includes('框架问题')) return 'framework_issue';
  return 'trusted_failure';
};

const labels = {
  trusted_pass: '可信通过',
  trusted_bug: '可信 Bug（候选）',
  trusted_failure: '可信失败',
  trusted_blocked: '可信阻塞',
  framework_issue: '框架问题',
  testcase_issue: '用例问题',
  needs_review: '需人工复核',
};

const normalized = items.map((item) => {
  const finalCategory = categoryFor(item.review_category);
  return {
    ...item,
    final_category: finalCategory,
    final_label: labels[finalCategory],
  };
});
const counts = Object.fromEntries(Object.keys(labels).map((key) => [
  key,
  normalized.filter((item) => item.final_category === key).length,
]));
if (Object.values(counts).reduce((sum, value) => sum + value, 0) !== expectedTotal) {
  throw new Error('Trusted category totals do not add up to 178.');
}

const qworkDisclosure = {
  mixed_versions: true,
  versions_observed: ['0.0.7', '0.0.8'],
  initial_version: '0.0.7',
  transition: 'SIT-EXPERT-020 的受控宿主重启期间 QWork 自动切换到 0.0.8；发现时保留了前 88 条结果并按用户授权从同一输出目录续跑。后续故障恢复阶段又回到 0.0.7。',
  comparability: '本批结果不是单一 QWork WebView 版本样本；Case 级版本归属在切换边界和后续恢复段未被完整记录，因此涉及 QWork 版本差异的结论须按混合版本解读。',
};

const payload = {
  report_version: 2,
  generated_at: new Date().toISOString(),
  run: {
    product: '360Teams',
    host_version: '5.2.16',
    host_build: '2119072065',
    control_plane: 'DEV',
    model_tier: 'M3',
    timeout_ms: 600000,
    total: expectedTotal,
    excluded: ['SIT-INIT-*', 'SIT-AUTH-*'],
    started_at: summary.started_at,
    ended_at: summary.ended_at,
    source_review: reviewPath,
    source_summary: summaryPath,
  },
  qwork_version_disclosure: qworkDisclosure,
  raw_counts_reference_only: summary.counts,
  trusted_counts: counts,
  methodology: [
    '以普通用户能否完成目标、理解结果和继续操作为最终判定口径；技术日志只确认执行有效。',
    '原始 passed/failed/blocked 只作为线索，不直接作为最终结论。',
    '描述与操作后截图不能直接互证的结果归入需人工复核，不计入可信通过或可信 Bug。',
  ],
  results: normalized,
};

const esc = (value) => String(value ?? '')
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#39;');
const compact = (value, max = 320) => {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim();
  return text.length > max ? `${text.slice(0, max)}…` : text;
};
const relativeEvidence = (file) => {
  if (!file) return '';
  const resolved = path.resolve(String(file));
  return resolved.startsWith(`${outDir}${path.sep}`) ? path.relative(outDir, resolved) : String(file);
};
const mdCell = (value) => compact(value).replaceAll('|', '\\|').replaceAll('\n', ' ');

const jsonPath = path.join(outDir, '可信终审报告.json');
fs.writeFileSync(jsonPath, `${JSON.stringify(payload, null, 2)}\n`);

const md = [
  '# 360Teams × QBot 178 Case 可信终审报告',
  '',
  '## 范围与口径',
  '',
  '- 360Teams：5.2.16（2119072065）',
  '- 控制面：DEV',
  '- 模型档位：M3；单 Case timeout：600000ms',
  '- 范围：178 条唯一业务 Case；排除全部 SIT-INIT-* 与 SIT-AUTH-*',
  `- 执行时间：${summary.started_at} 至 ${summary.ended_at}`,
  '- 原始状态只作参考；以下结论来自逐条证据二次复核。',
  '',
  '## QWork 混合版本披露',
  '',
  `- ${qworkDisclosure.transition}`,
  `- ${qworkDisclosure.comparability}`,
  '',
  '## 可信分类',
  '',
  '| 分类 | 数量 |',
  '|---|---:|',
  ...Object.entries(labels).map(([key, label]) => `| ${label} | ${counts[key]} |`),
  '',
  `原始统计仅供追溯：通过 ${summary.counts?.passed || 0}、失败 ${summary.counts?.failed || 0}、阻塞 ${summary.counts?.blocked || 0}；未直接用于上述可信分类。`,
  '',
  '## 逐 Case 终审',
  '',
  '| Case | 模块 | 原始线索 | 可信分类 | 复核理由 | 建议 | 证据 |',
  '|---|---|---|---|---|---|---|',
];
for (const item of normalized) {
  const report = relativeEvidence(item.case_report);
  const screenshot = relativeEvidence(item.key_screenshot);
  const evidence = [
    report ? `[Case 报告](${encodeURI(report)})` : '',
    screenshot ? `[关键截图](${encodeURI(screenshot)})` : '',
  ].filter(Boolean).join(' / ');
  md.push(`| ${mdCell(item.id)} | ${mdCell(item.module)} | ${mdCell(`${item.raw_status}/${item.raw_category}`)} | ${item.final_label} | ${mdCell(`${item.step_match || ''} ${item.evidence_completeness || ''} ${item.reason || ''}`)} | ${mdCell(item.action)} | ${evidence} |`);
}
const mdPath = path.join(outDir, '可信终审报告.md');
fs.writeFileSync(mdPath, `${md.join('\n')}\n`);

const stats = Object.entries(labels).map(([key, label]) => `<div class="stat ${key}"><b>${counts[key]}</b><span>${esc(label)}</span></div>`).join('');
const rows = normalized.map((item) => {
  const report = relativeEvidence(item.case_report);
  const screenshot = relativeEvidence(item.key_screenshot);
  const links = [
    report ? `<a href="${esc(encodeURI(report))}">Case 报告</a>` : '',
    screenshot ? `<a href="${esc(encodeURI(screenshot))}">关键截图</a>` : '',
  ].filter(Boolean).join(' · ');
  return `<tr><td><code>${esc(item.id)}</code></td><td>${esc(item.module)}</td><td>${esc(`${item.raw_status}/${item.raw_category}`)}</td><td><span class="badge ${item.final_category}">${esc(item.final_label)}</span></td><td><details><summary>${esc(compact(item.reason || item.evidence_completeness, 110))}</summary><p><b>步骤：</b>${esc(item.step_match)}</p><p><b>证据：</b>${esc(item.evidence_completeness)}</p><p><b>用户视角：</b>${esc(item.user_view_conclusion)}</p><p><b>建议：</b>${esc(item.action)}</p></details></td><td>${links}</td></tr>`;
}).join('\n');
const html = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>360Teams × QBot 可信终审报告</title><style>
:root{--bg:#f4f7fb;--card:#fff;--ink:#172033;--muted:#667085;--line:#dfe5ec}*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:14px/1.55 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.wrap{max-width:1480px;margin:auto;padding:32px}.hero{padding:28px;border-radius:18px;color:#fff;background:linear-gradient(135deg,#12263f,#24577b)}h1{margin:0 0 8px}.hero p{margin:4px 0;color:#d8e5ef}.notice{margin:20px 0;padding:16px 18px;border:1px solid #f4c066;border-radius:12px;background:#fff7e8}.stats{display:grid;grid-template-columns:repeat(7,minmax(120px,1fr));gap:10px;margin:20px 0}.stat{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:14px}.stat b{display:block;font-size:25px}.stat span{color:var(--muted)}.table-wrap{overflow:auto;background:#fff;border:1px solid var(--line);border-radius:14px}table{border-collapse:collapse;width:100%;min-width:1200px}th,td{padding:10px 12px;border-bottom:1px solid var(--line);text-align:left;vertical-align:top}th{position:sticky;top:0;background:#eef3f8}.badge{display:inline-block;white-space:nowrap;padding:3px 8px;border-radius:999px;font-weight:650}.trusted_pass{background:#dcfae6;color:#087443}.trusted_bug{background:#fee4e2;color:#b42318}.trusted_failure{background:#ffead5;color:#b54708}.trusted_blocked{background:#f2f4f7;color:#344054}.framework_issue{background:#e0f2fe;color:#075985}.testcase_issue{background:#ede9fe;color:#5b21b6}.needs_review{background:#fff4cc;color:#7a4d00}details summary{cursor:pointer}a{color:#175cd3;text-decoration:none}@media(max-width:900px){.wrap{padding:14px}.stats{grid-template-columns:repeat(2,1fr)}}
</style></head><body><main class="wrap"><section class="hero"><h1>360Teams × QBot 178 Case 可信终审报告</h1><p>360Teams 5.2.16（2119072065） · DEV · M3 · 600000ms</p><p>178 条唯一业务 Case；排除全部 INIT/AUTH；原始状态不直接作为终审结论。</p></section><section class="notice"><b>QWork 混合版本披露：</b>${esc(qworkDisclosure.transition)} ${esc(qworkDisclosure.comparability)}</section><section class="stats">${stats}</section><section class="table-wrap"><table><thead><tr><th>Case</th><th>模块</th><th>原始线索</th><th>可信分类</th><th>逐条复核</th><th>证据</th></tr></thead><tbody>${rows}</tbody></table></section></main></body></html>`;
const htmlPath = path.join(outDir, '可信终审报告.html');
fs.writeFileSync(htmlPath, html);

console.log(JSON.stringify({ counts, files: { markdown: mdPath, json: jsonPath, html: htmlPath } }, null, 2));
