#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const item = argv[i];
    if (!item.startsWith('--')) continue;
    const key = item.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) args[key] = true;
    else {
      args[key] = next;
      i += 1;
    }
  }
  return args;
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function exists(file) {
  return Boolean(file) && fs.existsSync(file);
}

function fileSize(file) {
  try {
    return fs.statSync(file).size;
  } catch {
    return 0;
  }
}

function screenshotList(result) {
  const flat = Array.isArray(result.screenshots_flat) ? result.screenshots_flat : [];
  const fromMap = Object.values(result.screenshots || {}).filter((item) => typeof item === 'string');
  return Array.from(new Set(flat.concat(fromMap)));
}

function sentPrompts(result) {
  return (result.steps || [])
    .filter((step) => /^(输入(?!区)|第\d+轮|第一轮|第二轮|追问|基于附件)/.test(String(step.action || '')))
    .map((step) => String(step.actual || ''));
}

function hasMetadata(text) {
  return /测试场景：|用户输入\/测试数据：|详细执行步骤|执行步骤：|预期结果：|成功判定：|失败判定：|证据要求：|请像真实 QBot 用户任务一样处理|要求：回复必须符合用户问题逻辑/.test(String(text || ''));
}

function auditSmokeFunctionalDepth(result) {
  const id = String(result.id || '');
  if (!/^SMK-(SKILL|EXPERT)-/.test(id)) return [];
  const issues = [];
  const steps = result.steps || [];
  const assertions = result.assertions || [];
  const actions = steps.map((step) => String(step.action || '')).join('\n');
  const actionAndAssertions = `${actions}\n${assertions.map((item) => `${item.name || ''} ${item.expected || ''} ${item.actual || ''}`).join('\n')}`;
  const concreteKeywords = /切换|搜索|安装|删除|刷新|模式|手动|禁用|导入|召唤|创建|分类|提交|输入|发送|详情|卡片|通用助手/;
  if (steps.length < 2 && result.status !== 'blocked') {
    issues.push('SMK功能用例操作步骤过少，无法证明按真实执行路径测试');
  }
  if (!concreteKeywords.test(actionAndAssertions) && result.status !== 'blocked') {
    issues.push('SMK功能用例缺少具体业务操作，只看到泛入口点击');
  }
  if (/^SMK-SKILL-/.test(id) && result.status !== 'blocked') {
    if (!/(技能页|技能分区|技能市场|技能模式|导入技能|禁用技能|手动选择)/.test(actionAndAssertions)) {
      issues.push('技能功能用例缺少技能页/技能菜单的专用断言');
    }
  }
  if (/^SMK-EXPERT-/.test(id) && result.status !== 'blocked') {
    if (!/(专家页|专家详情|召唤|创建专家|自建专家|通用助手|专家市场)/.test(actionAndAssertions)) {
      issues.push('专家功能用例缺少专家页/专家行为的专用断言');
    }
  }
  return issues;
}

function auditResult(result) {
  const issues = [];
  const shots = screenshotList(result);
  if (!result.id) issues.push('缺少用例ID');
  if (!result.case_report || !exists(result.case_report)) issues.push('缺少 case-report.md');
  if (!exists(path.join(result.case_dir || '', 'case-result.json'))) issues.push('缺少 case-result.json');
  if (!shots.length) issues.push('缺少截图证据');
  for (const shot of shots) {
    if (!exists(shot)) issues.push(`截图不存在：${shot}`);
    else if (fileSize(shot) < 1000) issues.push(`截图文件过小，可能无效：${shot}`);
  }

  const prompts = sentPrompts(result);
  for (const prompt of prompts) {
    if (hasMetadata(prompt)) issues.push('发送给 QBot 的内容包含测试用例元数据');
  }
  issues.push(...auditSmokeFunctionalDepth(result));

  const smokeUiCase = /^SMK-(SKILL|EXPERT)-/.test(String(result.id || ''));
  if ((['conversation', 'attachment'].includes(result.kind) && !smokeUiCase) || prompts.length) {
    const replyDelta = result.artifacts?.reply_delta;
    const transcript = result.artifacts?.transcript;
    if (result.status !== 'blocked' && !exists(replyDelta)) issues.push('对话类用例缺少 reply-delta.txt');
    if (result.status !== 'blocked' && !exists(transcript)) issues.push('对话类用例缺少 transcript.txt');
  }

  if (result.status === 'passed') {
    const assertions = result.assertions || [];
    if (!assertions.length) issues.push('通过用例缺少断言记录');
    if (assertions.some((item) => item.status === 'failed')) issues.push('通过用例存在失败断言');
    if (!/证据已保存|断言通过|通过/.test(String(result.actual_result || result.conclusion || ''))) {
      issues.push('通过用例实际结果描述不清晰');
    }
  } else if (result.status === 'failed') {
    if (!result.problem_description) issues.push('失败用例缺少缺陷描述');
    if (!result.actual_result) issues.push('失败用例缺少实际结果');
  } else if (result.status === 'blocked') {
    if (!result.actual_result && !result.conclusion) issues.push('阻塞用例缺少阻塞原因');
  } else if (result.status === 'needs_llm_review') {
    if (!result.llm_review?.prompt_file || !exists(result.llm_review.prompt_file)) issues.push('LLM复核用例缺少复核请求文件');
  } else {
    issues.push(`未知状态：${result.status}`);
  }

  return {
    id: result.id,
    scenario: result.scenario || result.title || '',
    status: result.status,
    credible: issues.length === 0,
    issues,
    case_report: result.case_report,
    key_screenshot: shots.at(-1) || '',
  };
}

function renderMarkdown(summary, audited) {
  const failed = audited.filter((item) => !item.credible);
  const lines = [
    '# 批次测试报告可信度审计',
    '',
    `- 批次目录：${summary.run_dir || summary.out_dir}`,
    `- 用例数：${audited.length}`,
    `- 可信：${audited.length - failed.length}`,
    `- 不可信：${failed.length}`,
    `- 结论：${failed.length ? '不可信，需要修正或重跑问题用例' : '可信，可以进入下一组'}`,
    '',
    '## 明细',
    '',
  ];
  for (const item of audited) {
    lines.push(`- ${item.id} ${item.scenario}：${item.status} / ${item.credible ? '可信' : '不可信'}`);
    lines.push(`  - 报告：${item.case_report || ''}`);
    if (item.key_screenshot) lines.push(`  - 关键截图：${item.key_screenshot}`);
    if (item.issues.length) lines.push(`  - 问题：${item.issues.join('；')}`);
  }
  return `${lines.join('\n')}\n`;
}

const args = parseArgs(process.argv.slice(2));
const batchDir = path.resolve(args['batch-dir'] || '');
const summaryFile = path.join(batchDir, 'automation-run-summary.json');
if (!batchDir || !exists(summaryFile)) {
  console.error('缺少 --batch-dir，或该目录下没有 automation-run-summary.json');
  process.exit(2);
}

const summary = readJson(summaryFile);
const audited = (summary.results || []).map(auditResult);
const passed = audited.every((item) => item.credible);
const output = {
  status: passed ? 'credible' : 'not_credible',
  audited_at: new Date().toISOString(),
  batch_dir: batchDir,
  counts: {
    total: audited.length,
    credible: audited.filter((item) => item.credible).length,
    not_credible: audited.filter((item) => !item.credible).length,
  },
  results: audited,
};
fs.writeFileSync(path.join(batchDir, 'credibility-audit.json'), `${JSON.stringify(output, null, 2)}\n`, 'utf8');
fs.writeFileSync(path.join(batchDir, 'credibility-audit.md'), renderMarkdown(summary, audited), 'utf8');
console.log(JSON.stringify(output, null, 2));
process.exit(passed ? 0 : 3);
