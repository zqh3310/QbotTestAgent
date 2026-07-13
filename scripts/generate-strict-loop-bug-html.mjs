import fs from 'node:fs/promises';
import path from 'node:path';

const repoRoot = process.cwd();
const progressPath = path.join(
  repoRoot,
  'autoTest/202607081804_43cases_strict_onecase_loop_汇总/逐条复核进度.md',
);
const outputPath = path.join(repoRoot, 'outputs/QBot_bug_candidates_evidence_2026-07-08.html');
const outputDir = path.dirname(outputPath);
const assetsDirName = 'QBot_bug_candidates_evidence_2026-07-08_assets';
const assetsDir = path.join(outputDir, assetsDirName);
const correctionReportPath = path.join(
  repoRoot,
  'outputs/QBot_bug_candidates_evidence_复核纠偏说明_2026-07-09.md',
);

const escapeHtml = (value) =>
  String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

const fileUrl = (value) => `file://${encodeURI(value)}`;
const relativeUrl = (value) => encodeURI(value).replaceAll('#', '%23');

const safeFilePart = (value) => {
  const cleaned = String(value ?? '')
    .replace(/[^a-zA-Z0-9._-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 120);
  return cleaned || 'screenshot.png';
};

const exists = async (value) => {
  try {
    await fs.access(value);
    return true;
  } catch {
    return false;
  }
};

const walkFiles = async (dir) => {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walkFiles(full)));
    } else {
      files.push(full);
    }
  }
  return files;
};

const readJson = async (value) => JSON.parse(await fs.readFile(value, 'utf8'));

const readTextIfExists = async (value) => {
  if (!value) return '';
  try {
    return await fs.readFile(value, 'utf8');
  } catch {
    return '';
  }
};

const parseProgressRows = (markdown) => {
  const rows = [];
  for (const line of markdown.split(/\r?\n/)) {
    if (!line.startsWith('|')) continue;
    if (line.includes('---')) continue;
    const cols = line
      .split('|')
      .slice(1, -1)
      .map((col) => col.trim());
    if (cols.length < 6 || cols[0] === '顺序') continue;
    const evidence = cols[5].replace(/^`|`$/g, '');
    rows.push({
      order: Number(cols[0]),
      caseId: cols[1],
      raw: cols[2],
      classification: cols[3],
      canContinue: cols[4],
      runDir: evidence,
    });
  }
  return rows;
};

const parseReviewSentences = (markdown) => {
  const map = new Map();
  const section = markdown.split('## 用户视角审批句')[1] || '';
  for (const line of section.split(/\r?\n/)) {
    const match = line.match(/^- (SIT-[A-Z]+-\d+)：(.+)$/);
    if (match) map.set(match[1], match[2].trim());
  }
  return map;
};

const collectCaseData = async (row) => {
  const files = await walkFiles(row.runDir);
  const resultPath = files.find((file) => path.basename(file) === 'case-result.json');
  const reportPath = files.find((file) => path.basename(file) === 'case-report.md');
  const transcriptPath = files.find((file) => path.basename(file) === 'transcript.txt');
  const replyDeltaPath = files.find((file) => path.basename(file) === 'reply-delta.txt');
  const imagePaths = files
    .filter((file) => /\.(png|jpe?g|webp)$/i.test(file))
    .sort((a, b) => path.basename(a).localeCompare(path.basename(b), 'zh-Hans-CN'));
  const result = resultPath ? await readJson(resultPath) : {};
  const transcriptText = await readTextIfExists(transcriptPath);
  const replyDeltaText = await readTextIfExists(replyDeltaPath);
  const reportText = await readTextIfExists(reportPath);
  return {
    ...row,
    result,
    caseDir: result.case_dir || (resultPath ? path.dirname(resultPath) : row.runDir),
    reportPath: result.case_report || reportPath || '',
    resultPath: resultPath || '',
    transcriptPath: transcriptPath || '',
    replyDeltaPath: replyDeltaPath || '',
    transcriptText,
    replyDeltaText,
    reportText,
    imagePaths,
  };
};

const conciseTitle = (item) => {
  const actual = item.result?.actual_result || item.result?.conclusion || item.result?.title || '';
  const base = item.result?.title || item.result?.scenario || item.caseId;
  const cleaned = actual
    .replace(/^失败[:：]\s*/, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (cleaned && cleaned.length <= 90) return cleaned;
  return base;
};

const severity = (caseId) => {
  if (/SIT-HOME-0(18|19|31|32|33|34|35|36|37|53|55)/.test(caseId)) return 'P0';
  if (/SIT-HOME-0(04|06|15)/.test(caseId)) return 'P1';
  if (/SIT-EXPERT-00[125]/.test(caseId)) return 'P1';
  return 'P2';
};

const renderLinks = (item) => {
  const links = [
    ['Run 目录', item.runDir],
    ['Case 目录', item.caseDir],
    ['case-report.md', item.reportPath],
    ['case-result.json', item.resultPath],
    ['transcript.txt', item.transcriptPath],
    ['reply-delta.txt', item.replyDeltaPath],
  ].filter(([, href]) => href);
  return links
    .map(([label, href]) => `<a href="${fileUrl(href)}" target="_blank">${escapeHtml(label)}</a>`)
    .join('\n');
};

const chooseFirstImage = (item, patterns, used = new Set()) => {
  for (const pattern of patterns) {
    const found = item.imagePaths.find((image) => {
      const name = path.basename(image);
      if (used.has(image)) return false;
      return pattern instanceof RegExp ? pattern.test(name) : name.includes(pattern);
    });
    if (found) {
      used.add(found);
      return found;
    }
  }
  return '';
};

const replyBodyText = (item) =>
  String(item.replyDeltaText || '')
    .replace(/^## .+$/gm, '')
    .replace(/^---$/gm, '')
    .trim();

const combinedResultText = (item) =>
  [
    item.result?.actual_result,
    item.result?.conclusion,
    item.result?.error,
    item.reportText,
    item.replyDeltaText,
  ]
    .filter(Boolean)
    .join('\n');

const isConversationNoReadableReply = (item) => {
  const id = item.caseId;
  const text = combinedResultText(item);
  if (
    /等待 Agent 回复完成超时|回复增量长度：0|没有任何可读助手正文|无可读助手正文|未返回任何附件处理内容|没有展示任何可读|没有任何助手正文/.test(
      text,
    )
  ) {
    return true;
  }
  if (
    /SIT-HOME-(018|019|031|032|033|034|035|036|037|053|055)$/.test(id) ||
    /SIT-SKILL-006$/.test(id) ||
    /SIT-ART-00[123]$/.test(id) ||
    /SIT-EXPERT-002$/.test(id)
  ) {
    return replyBodyText(item).length === 0;
  }
  return false;
};

const hasReadableReply = (item) => replyBodyText(item).length > 20 && !isConversationNoReadableReply(item);

const replyWaitLabel = (item) =>
  isConversationNoReadableReply(item) ? '等待超时后（无可读回复）' : '回复后（有可读内容）';

const replyWaitDescription = (item, fallback = '回复后页面状态。') => {
  if (isConversationNoReadableReply(item)) {
    return '该截图不是 Agent 回复内容；它只证明发送后等待结束，当前会话仍没有可读助手正文。空回复/超时结论以 case-result.json 和 reply-delta.txt 为准。';
  }
  return fallback;
};

const resultExcerpt = (item) => {
  const text = String(item.result?.actual_result || item.result?.conclusion || '').replace(/\s+/g, ' ');
  return text.length > 360 ? `${text.slice(0, 360)}...` : text;
};

const buildEvidenceSlots = (item) => {
  const id = item.caseId;
  const used = new Set();
  const slots = [];
  const add = (label, description, patterns, required = true) => {
    const image = chooseFirstImage(item, patterns, used);
    slots.push({ label, description, image, required });
  };

  if (/SIT-HOME-03[1-7]/.test(id)) {
    add('操作前', '进入隔离新任务，确认没有上一轮附件/技能/连接器污染。', [/01-before/, /composer-controls-reset/]);
    add('提问前/上传后', '目标附件已真实进入输入区，应能看到文件名或附件卡片。', [/02-after-upload/]);
    add('提问中', '用户基于附件的真实提问已填入输入区。', [/after-fill/, /03-turn-1-after-fill/]);
    add('发送后', '用户问题和附件已发送到当前会话。', [/after-send/, /04-turn-1-after-send/]);
    add(replyWaitLabel(item), replyWaitDescription(item), [/after-reply/, /05-turn-1-after-reply/]);
    return slots;
  }

  if (/SIT-ART/.test(id)) {
    add('操作前', '进入隔离新任务，清理技能/附件状态。', [/01-before/, /composer-controls-reset/]);
    add('提问前', '成果生成请求已填入输入区。', [/after-fill/, /成果生成请求-after-fill/]);
    add('发送后', '成果生成请求已发送到当前会话。', [/after-send/, /成果生成请求-after-send/]);
    add(replyWaitLabel(item), replyWaitDescription(item), [/after-reply/, /成果生成请求-after-reply/]);
    add('结果页/成果区', '打开成果区验证实际产物列表为空或缺少目标文件。', [/artifact-panel/]);
    return slots;
  }

  if (/SIT-CONN-00[34]/.test(id)) {
    add('操作前', '进入隔离新任务，确认输入区状态已重置。', [/01-before/, /composer-controls-reset/]);
    add('选择工具前', '打开当前输入区连接器菜单。', [/connector-mode-manual/, /connector-mode-disabled/]);
    add('选择工具后', '点击手动/禁用后选中态仍未变化。', [/connector-mode-disabled/, /connector-mode-manual/]);
    add('断言结果', '断言截图保留三态切换失败的页面状态。', [/03-assertion/]);
    return slots;
  }

  if (/SIT-CONN-00[12]/.test(id)) {
    add('操作前', '进入连接器模块前的页面状态。', [/01-before/]);
    add('页面操作后', '连接器页/内置工具区域实际加载状态。', [/connectors-view/, /02-connectors-view/]);
    add('断言结果', '保留目录或内置工具加载失败证据。', [/03-assertion/]);
    return slots;
  }

  if (/SIT-EXPERT-002/.test(id)) {
    add('操作前', '进入专家模块前或新任务状态。', [/01-before/]);
    add('选择工具前', '打开专家页并准备切换为通用助手。', [/open-experts/]);
    add('选择工具后', '点击通用助手后回到首页输入区，专家身份应清空。', [/expert-010-after-general/]);
    add('提问中', '普通助手问题应已填入输入区；缺失则需要重跑补证据。', [/after-fill/, /turn-1-after-fill/]);
    add('发送后', '普通助手问题应已发送；缺失则需要重跑补证据。', [/after-send/, /turn-1-after-send/]);
    add(replyWaitLabel(item), replyWaitDescription(item), [/expert-010-after-reply/, /after-reply/]);
    return slots;
  }

  if (/SIT-EXPERT-00[15]|SIT-EXPERT-021/.test(id)) {
    add('操作前', '进入专家模块前或新任务状态。', [/01-before/]);
    add('选择/创建入口', '专家页、创建弹窗或通用助手入口已真实点击。', [/open-experts/, /create-dialog/, /02-create-dialog/, /expert-detail/, /general/]);
    add('操作后', '点击后的页面状态或返回首页状态。', [/after-start-create/, /03-after-start-create/, /after-submit/, /03-assertion/]);
    add('断言结果', '保留产品异常结果。', [/03-assertion/, /expert-001-page/, /expert-010-after-reply/]);
    return slots;
  }

  if (/SIT-EXPERT-006/.test(id)) {
    add('操作前', '进入专家创建表单前状态。', [/01-before/, /open-experts/]);
    add('填写中', '手动填写专家名、简介和职责。', [/after-fill/, /expert-008/]);
    add('提交后', '提交后弹窗仍停留或未进入我的专家。', [/after-submit/, /modal/]);
    add('断言结果', '保留创建失败证据。', [/03-assertion/]);
    return slots;
  }

  if (/SIT-SKILL-006/.test(id)) {
    add('操作前', '进入隔离新任务，清理输入区状态。', [/01-before/, /composer-controls-reset/]);
    add('选择工具前', '打开技能菜单并切换为禁用技能。', [/disabled/, /skill-009-disabled/, /skill-mode-disabled/]);
    add('提问前', '普通问题已填入输入区。', [/after-fill/, /skill-009-after-fill/]);
    add('发送后', '普通问题应已发送；缺失则需要重跑补证据。', [/after-send/, /skill-009-after-send/]);
    add(replyWaitLabel(item), replyWaitDescription(item), [/after-reply/, /skill-009-after-reply/]);
    return slots;
  }

  if (/SIT-HOME-0(04|06)/.test(id)) {
    add('操作前', '进入隔离新任务，清理上一轮状态。', [/01-before/, /composer-controls-reset/]);
    add('选择工具前', '进入专家/技能/连接器选择路径。', [/open-experts/, /expert-detail-for-combo/]);
    add('选择工具后', '专家、技能或连接器状态已选择完成。', [/manual-skill-selected/, /expert-summoned/, /connector-mode/]);
    add('提问中/发送后', '组合能力问题已发送。', [/after-send/, /组合能力会话-after-send/]);
    add(replyWaitLabel(item), replyWaitDescription(item, '回复暴露内部技能标识/加载失败等用户不可接受信息。'), [/after-reply/, /组合能力会话-after-reply/]);
    return slots;
  }

  if (/SIT-HOME-0(18)/.test(id)) {
    add('操作前', '进入隔离新任务，确认当前会话状态。', [/01-before/, /composer-controls-reset/]);
    add('第1轮提问前', '第1轮真实用户问题已填入输入区。', [/03-turn-1-after-fill/]);
    add('第1轮发送后', '第1轮问题已发送到当前会话。', [/04-turn-1-after-send/]);
    add(replyWaitLabel(item), replyWaitDescription(item), [/05-turn-1-after-reply/]);
    add('第10轮提问前', '第10轮追问已填入输入区。', [/12-turn-10-after-fill/]);
    add('第10轮发送后', '第10轮追问已发送到当前会话。', [/13-turn-10-after-send/]);
    add('第10轮等待超时后（无可读回复）', replyWaitDescription(item), [/14-turn-10-after-reply/]);
    return slots;
  }

  if (/SIT-HOME-053/.test(id)) {
    add('操作前', '进入隔离新任务，确认当前会话状态。', [/01-before/, /composer-controls-reset/]);
    add('第1轮提问前', '第1轮真实用户问题已填入输入区。', [/03-turn-1-after-fill/]);
    add('第1轮发送后', '第1轮问题已发送到当前会话。', [/04-turn-1-after-send/]);
    add(replyWaitLabel(item), replyWaitDescription(item), [/05-turn-1-after-reply/]);
    add('第11轮提问前', '第11轮追问已填入输入区。', [/13-turn-11-after-fill/]);
    add('第11轮发送后', '第11轮追问已发送到当前会话。', [/14-turn-11-after-send/]);
    add('第11轮等待超时后（无可读回复）', replyWaitDescription(item), [/15-turn-11-after-reply/]);
    return slots;
  }

  if (/SIT-HOME-0(15|19|55)/.test(id)) {
    add('操作前', '进入隔离新任务，确认当前会话状态。', [/01-before/, /composer-controls-reset/]);
    add('提问前', '用户真实问题已填入输入区。', [/after-fill/, /05-turn-1-after-fill/]);
    add('提问中/发送后', '用户问题已发送到当前会话。', [/after-send/, /05-turn-1-after-send/]);
    add(replyWaitLabel(item), replyWaitDescription(item, '回复后出现身份错误，或未给出清晰安全拒绝。'), [/after-reply/, /05-turn-1-after-reply/, /14-turn-10-after-reply/, /15-turn-11-after-reply/]);
    return slots;
  }

  add('操作前', '进入当前 case 的起始状态。', [/01-before/]);
  add('关键操作后', '当前 case 的主要页面或会话结果。', [/after-reply/, /after-upload/, /artifact-panel/, /connectors-view/, /03-assertion/]);
  return slots;
};

const selectedImagesForAssets = (item) =>
  buildEvidenceSlots(item)
    .map((slot) => slot.image)
    .filter(Boolean);

const evidenceAudit = (item) => {
  const slots = buildEvidenceSlots(item);
  const missingRequired = slots.filter((slot) => slot.required && !slot.image);
  const noReadableReply = isConversationNoReadableReply(item);
  const readableReply = hasReadableReply(item);
  const resultText = resultExcerpt(item);

  if (missingRequired.length > 0) {
    return {
      kind: 'needs-rerun',
      label: '证据链不完整，需重跑补证据',
      detail: `缺少关键槽位：${missingRequired.map((slot) => slot.label).join('、')}。这类结果不能直接作为 Bug 截图证据使用。`,
      slots,
      missingRequired,
      noReadableReply,
      readableReply,
      resultText,
    };
  }

  if (noReadableReply) {
    return {
      kind: 'no-reply',
      label: '空回复/超时证据，不是 Agent 回复截图',
      detail:
        '截图只能证明用户已发送问题并等待结束；页面没有可读助手正文。是否构成 Bug 需要结合 case-result.json 的超时/回复增量为 0 结论和 reply-delta.txt 空内容判断。',
      slots,
      missingRequired,
      noReadableReply,
      readableReply,
      resultText,
    };
  }

  return {
    kind: 'complete',
    label: '证据链完整',
    detail: readableReply
      ? '已覆盖操作前、关键操作、发送/提交后和可读产品结果，截图与 case-result/reply-delta 可相互印证。'
      : '已覆盖操作前、关键页面操作和产品结果，适用于页面类或配置类 Bug。',
    slots,
    missingRequired,
    noReadableReply,
    readableReply,
    resultText,
  };
};

const evidenceAuditClass = (kind) => {
  if (kind === 'needs-rerun') return 'audit-rerun';
  if (kind === 'no-reply') return 'audit-noreply';
  return 'audit-complete';
};

const renderEvidenceAudit = (item) => {
  const audit = evidenceAudit(item);
  const extra =
    audit.noReadableReply && audit.resultText
      ? `<pre class="result-excerpt">${escapeHtml(audit.resultText)}</pre>`
      : '';
  const missing = audit.missingRequired.length
    ? `<div class="missing-list">缺失槽位：${escapeHtml(
        audit.missingRequired.map((slot) => slot.label).join('、'),
      )}</div>`
    : '';
  return `
    <div class="evidence-audit ${evidenceAuditClass(audit.kind)}">
      <b>证据复核结论：${escapeHtml(audit.label)}</b>
      <p>${escapeHtml(audit.detail)}</p>
      ${missing}
      ${extra}
    </div>`;
};

const renderShots = (item) =>
  buildEvidenceSlots(item)
    .map((slot, index) => {
      if (!slot.image) {
        return `
    <figure class="shot missing-shot">
      <div class="missing-box">需重跑补证据</div>
      <figcaption><b>${escapeHtml(slot.label)}</b><br>${escapeHtml(
        slot.description,
      )}<br><span>该槽位缺失，不能用其他截图替代。</span></figcaption>
    </figure>`;
      }
      const caption = `${slot.label} · ${path.basename(slot.image)}`;
      const assetHref = item.imageAssetByPath?.get(slot.image)?.href || fileUrl(slot.image);
      return `
    <figure class="shot">
      <a href="${assetHref}" class="lightbox-trigger" data-case="${escapeHtml(
        item.caseId,
      )}" data-caption="${escapeHtml(caption)}"><img src="${assetHref}" alt="${escapeHtml(
        `${item.caseId} ${slot.label}`,
      )}" loading="lazy"></a>
      <figcaption><b>${escapeHtml(slot.label)}</b><br>${escapeHtml(
        path.basename(slot.image),
      )}<br><span>${escapeHtml(slot.description)}</span></figcaption>
    </figure>`;
    })
    .join('\n');

const renderSection = (item, index, reviewSentence, kind) => {
  const isBlocker = kind === 'blocker';
  const cls = isBlocker ? 'blocker' : 'bug';
  const tagCls = isBlocker ? 'sev block-tag' : 'sev';
  const tag = isBlocker ? '阻塞' : severity(item.caseId);
  const title = isBlocker
    ? item.result?.title || item.result?.scenario || item.caseId
    : conciseTitle(item);
  const reason = reviewSentence || item.result?.actual_result || item.result?.conclusion || '未记录审批句。';
  const audit = evidenceAudit(item);
  return `
  <section class="${cls} ${evidenceAuditClass(audit.kind)}-card" id="${escapeHtml(item.caseId)}">
    <div class="bug-head">
      <div>
        <div class="meta">#${index + 1} · ${escapeHtml(item.caseId)} · ${escapeHtml(
          item.result?.module || '',
        )} / ${escapeHtml(item.result?.submodule || '')}</div>
        <h2>${escapeHtml(title)}</h2>
      </div>
      <div class="tags">
        <span class="${tagCls}">${escapeHtml(tag)}</span>
        <span class="audit-tag ${evidenceAuditClass(audit.kind)}">${escapeHtml(audit.label)}</span>
      </div>
    </div>
    <p class="reason">${escapeHtml(reason)}</p>
    ${renderEvidenceAudit(item)}
    <div class="links">${renderLinks(item)}</div>
    <details open>
      <summary>关键证据截图 ${buildEvidenceSlots(item).filter((slot) => slot.image).length}/${buildEvidenceSlots(item).length} 张</summary>
      <div class="shots">${renderShots(item)}</div>
    </details>
  </section>`;
};

const markdownBullet = (item, reviewSentence) => {
  const audit = evidenceAudit(item);
  const slots = buildEvidenceSlots(item);
  const slotLines = slots
    .map((slot) => `  - ${slot.label}：${slot.image || '缺失，需重跑补证据'}`)
    .join('\n');
  const resultLine = audit.resultText ? `\n- case-result 摘要：${audit.resultText}` : '';
  return `### ${item.caseId} ${item.result?.title || item.result?.scenario || ''}\n\n- 证据复核结论：${audit.label}\n- 复核说明：${audit.detail}\n- 用户视角审批：${reviewSentence || '未记录审批句'}${resultLine}\n- case-report：${item.reportPath || '缺失'}\n- case-result：${item.resultPath || '缺失'}\n- transcript：${item.transcriptPath || '无'}\n- reply-delta：${item.replyDeltaPath || '无'}\n- 关键截图槽位：\n${slotLines}\n`;
};

const writeCorrectionReport = async (rows, bugItems, blockerItems, reviewSentences, auditCounts) => {
  const completeBugs = bugItems.filter((item) => evidenceAudit(item).kind === 'complete');
  const noReplyBugs = bugItems.filter((item) => evidenceAudit(item).kind === 'no-reply');
  const rerunBugs = bugItems.filter((item) => evidenceAudit(item).kind === 'needs-rerun');
  const markdown = `# QBot Bug 候选证据复核纠偏说明

生成日期：2026-07-09

## 结论

原 HTML 证据页中存在误导性口径：部分 case 的截图没有 Agent 回复，却被标成“等待 Agent 回复后”。这类截图不能作为“回复后内容”的证据，只能证明用户发送后等待结束，页面仍无可读助手正文。

本次已重生成 HTML：/Users/qifu/Documents/QbotTestAgent/outputs/QBot_bug_candidates_evidence_2026-07-08.html

当前口径：

- 已执行/复核结果：${rows.length} 条
- Bug 候选：${bugItems.length} 条
- 证据链完整 Bug：${auditCounts.complete} 条
- 空回复/超时证据：${auditCounts.noReply} 条
- 需重跑补证据：${auditCounts.needsRerun} 条
- 可信阻塞：${blockerItems.length} 条

## 使用规则

- “证据链完整 Bug”可以继续作为 Bug 候选复盘材料。
- “空回复/超时证据”不能说截图里有 Agent 回复；必须同时引用发送后截图、等待超时截图、case-result.json 和 reply-delta.txt。
- “需重跑补证据”不能作为可提交 Bug 证据，需要先补齐缺失截图链路。

## 证据链完整 Bug

${completeBugs
  .map((item) => markdownBullet(item, reviewSentences.get(item.caseId)))
  .join('\n')}

## 空回复/超时证据

${noReplyBugs
  .map((item) => markdownBullet(item, reviewSentences.get(item.caseId)))
  .join('\n')}

## 需重跑补证据

${rerunBugs
  .map((item) => markdownBullet(item, reviewSentences.get(item.caseId)))
  .join('\n')}

## 可信阻塞

${blockerItems
  .map((item) => markdownBullet(item, reviewSentences.get(item.caseId)))
  .join('\n')}
`;
  await fs.writeFile(correctionReportPath, markdown);
};

const prepareImageAssets = async (items) => {
  await fs.rm(assetsDir, { recursive: true, force: true });
  await fs.mkdir(assetsDir, { recursive: true });
  for (const item of items) {
    item.imageAssets = [];
    item.imageAssetByPath = new Map();
    const selectedImages = selectedImagesForAssets(item);
    for (const [index, imagePath] of selectedImages.entries()) {
      const extension = path.extname(imagePath) || '.png';
      const base = safeFilePart(path.basename(imagePath, extension));
      const fileName = `${String(item.order).padStart(2, '0')}-${item.caseId}-${String(
        index + 1,
      ).padStart(2, '0')}-${base}${extension}`;
      const dest = path.join(assetsDir, fileName);
      await fs.copyFile(imagePath, dest);
      item.imageAssets.push({
        href: relativeUrl(`${assetsDirName}/${fileName}`),
        dest,
      });
      item.imageAssetByPath.set(imagePath, {
        href: relativeUrl(`${assetsDirName}/${fileName}`),
        dest,
      });
    }
  }
};

const main = async () => {
  const markdown = await fs.readFile(progressPath, 'utf8');
  const rows = parseProgressRows(markdown);
  const reviewSentences = parseReviewSentences(markdown);
  const bugRows = rows.filter((row) => row.classification === '可信失败-产品Bug候选');
  const blockerRows = rows.filter((row) => row.classification === '可信阻塞-环境或数据');
  const bugItems = [];
  for (const row of bugRows) {
    if (!(await exists(row.runDir))) throw new Error(`missing run dir: ${row.runDir}`);
    bugItems.push(await collectCaseData(row));
  }
  const blockerItems = [];
  for (const row of blockerRows) {
    if (!(await exists(row.runDir))) throw new Error(`missing run dir: ${row.runDir}`);
    blockerItems.push(await collectCaseData(row));
  }
  await prepareImageAssets([...bugItems, ...blockerItems]);
  const bugAudits = bugItems.map((item) => evidenceAudit(item));
  const auditCounts = {
    complete: bugAudits.filter((audit) => audit.kind === 'complete').length,
    noReply: bugAudits.filter((audit) => audit.kind === 'no-reply').length,
    needsRerun: bugAudits.filter((audit) => audit.kind === 'needs-rerun').length,
  };
  const bugImageCount = bugItems.reduce((sum, item) => sum + item.imageAssets.length, 0);
  const toc = [...bugItems, ...blockerItems]
    .map((item) => {
      const suffix = item.classification === '可信阻塞-环境或数据' ? ' 阻塞' : '';
      return `<a href="#${escapeHtml(item.caseId)}">${escapeHtml(item.caseId + suffix)}</a>`;
    })
    .join('');
  const html = `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>QBot Bug 候选证据复核</title>
  <style>
    :root { color-scheme: light; --bg:#f6f7fb; --panel:#fff; --ink:#172033; --muted:#667085; --line:#d8deea; --brand:#1f5eff; --danger:#c7362f; --ok:#0f766e; --warn:#a15c00; --soft-danger:#fff1f0; --soft-warn:#fff8e8; --soft-ok:#eefdf8; }
    * { box-sizing: border-box; }
    body { margin:0; font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Arial,"PingFang SC","Hiragino Sans GB",sans-serif; background:var(--bg); color:var(--ink); }
    header { background:var(--bg); border-bottom:1px solid var(--line); }
    .wrap { max-width:1280px; margin:0 auto; padding:24px; }
    h1 { margin:0 0 8px; font-size:30px; line-height:1.2; }
    .sub { margin:0; color:var(--muted); line-height:1.7; }
    .stats { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:12px; margin-top:18px; }
    .stat { background:var(--panel); border:1px solid var(--line); border-radius:10px; padding:14px; }
    .stat b { display:block; font-size:24px; margin-bottom:4px; }
    .stat.warn { border-color:#f3cf75; background:#fffaf0; }
    .stat.danger { border-color:#ffc2bd; background:#fff6f5; }
    .toc { display:flex; flex-wrap:wrap; gap:8px; margin-top:18px; }
    .toc a { color:var(--brand); background:#eef3ff; border:1px solid #d8e3ff; padding:7px 10px; border-radius:999px; text-decoration:none; font-size:13px; }
    main.wrap { padding-top:18px; }
    .bug, .blocker { background:var(--panel); border:1px solid var(--line); border-radius:12px; padding:18px; margin:16px 0; box-shadow:0 8px 24px rgba(17,24,39,.04); }
    .bug-head { display:flex; justify-content:space-between; gap:16px; align-items:flex-start; }
    .meta { color:var(--muted); font-size:13px; margin-bottom:6px; }
    h2 { margin:0; font-size:20px; line-height:1.35; }
    .tags { display:flex; flex-wrap:wrap; justify-content:flex-end; gap:8px; flex:0 0 auto; max-width:420px; }
    .sev { flex:0 0 auto; color:#fff; background:var(--danger); border-radius:999px; padding:6px 10px; font-weight:700; font-size:13px; }
    .block-tag { background:var(--warn); }
    .audit-tag { flex:0 0 auto; border-radius:999px; padding:6px 10px; font-weight:700; font-size:13px; border:1px solid transparent; }
    .audit-complete { color:#075e54; background:#dff8ef; border-color:#a7ead7; }
    .audit-noreply { color:#7a4b00; background:#fff1c8; border-color:#ffd77c; }
    .audit-rerun { color:#9d1c16; background:#ffe4e1; border-color:#ffb4ad; }
    .reason { margin:14px 0; line-height:1.8; }
    .evidence-audit { margin:12px 0 14px; padding:12px 14px; border-radius:10px; border:1px solid var(--line); line-height:1.7; }
    .evidence-audit p { margin:5px 0 0; }
    .evidence-audit.audit-complete { background:var(--soft-ok); border-color:#b7eadb; color:#0b5d53; }
    .evidence-audit.audit-noreply { background:var(--soft-warn); border-color:#f0d18c; color:#6d4a00; }
    .evidence-audit.audit-rerun { background:var(--soft-danger); border-color:#ffc4bf; color:#8a1d18; }
    .missing-list { margin-top:8px; font-weight:700; }
    .result-excerpt { margin:10px 0 0; padding:10px; white-space:pre-wrap; overflow-wrap:anywhere; background:rgba(255,255,255,.7); border:1px solid rgba(0,0,0,.08); border-radius:8px; font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace; font-size:12px; line-height:1.6; color:inherit; }
    .links { display:flex; flex-wrap:wrap; gap:8px; margin:10px 0 14px; }
    .links a { color:#0b4abf; background:#f2f6ff; border:1px solid #d6e4ff; text-decoration:none; padding:7px 10px; border-radius:8px; font-size:13px; }
    details { border-top:1px solid var(--line); padding-top:12px; }
    summary { cursor:pointer; font-weight:700; margin-bottom:12px; }
    .shots { display:grid; grid-template-columns:repeat(auto-fill,minmax(260px,1fr)); gap:14px; }
    .shot { margin:0; border:1px solid var(--line); border-radius:10px; overflow:hidden; background:#fbfcff; }
    .shot a { display:block; cursor:zoom-in; }
    .shot img { display:block; width:100%; height:190px; object-fit:contain; background:#eef1f7; border-bottom:1px solid var(--line); }
    .shot figcaption { padding:8px 10px; color:var(--muted); font-size:12px; overflow-wrap:anywhere; min-height:72px; line-height:1.45; }
    .shot figcaption b { color:var(--ink); font-size:13px; }
    .shot figcaption span { color:#667085; }
    .missing-shot { border-style:dashed; background:#f8fafc; }
    .missing-box { height:190px; display:flex; align-items:center; justify-content:center; color:#8a94a6; background:repeating-linear-gradient(45deg,#f2f4f7,#f2f4f7 10px,#eef1f6 10px,#eef1f6 20px); border-bottom:1px solid var(--line); font-weight:700; }
    .note { margin-top:14px; padding:12px; background:#fffdf0; border:1px solid #f3e7a3; border-radius:10px; color:#675d1d; line-height:1.7; }
    .lightbox { position:fixed; inset:0; z-index:99; display:none; grid-template-rows:auto minmax(0,1fr) auto; background:rgba(10,15,25,.94); color:#fff; }
    .lightbox.open { display:grid; }
    .lightbox-top { display:flex; align-items:center; justify-content:space-between; gap:12px; padding:12px 16px; border-bottom:1px solid rgba(255,255,255,.18); }
    .lightbox-title { min-width:0; font-weight:700; line-height:1.4; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .lightbox-actions { display:flex; align-items:center; gap:8px; flex:0 0 auto; }
    .lightbox-button, .lightbox-link { border:1px solid rgba(255,255,255,.35); background:rgba(255,255,255,.12); color:#fff; border-radius:8px; padding:8px 11px; font:inherit; text-decoration:none; cursor:pointer; }
    .lightbox-button:hover, .lightbox-link:hover { background:rgba(255,255,255,.22); }
    .lightbox-body { position:relative; min-height:0; display:flex; align-items:center; justify-content:center; padding:18px 72px; }
    .lightbox-image { max-width:100%; max-height:100%; object-fit:contain; box-shadow:0 14px 48px rgba(0,0,0,.45); background:#f8fafc; }
    .lightbox-nav { position:absolute; top:50%; transform:translateY(-50%); width:48px; height:72px; border:1px solid rgba(255,255,255,.32); background:rgba(255,255,255,.13); color:#fff; border-radius:10px; font-size:34px; line-height:1; cursor:pointer; }
    .lightbox-nav:hover { background:rgba(255,255,255,.24); }
    .lightbox-prev { left:16px; }
    .lightbox-next { right:16px; }
    .lightbox-footer { display:flex; justify-content:space-between; gap:12px; padding:10px 16px; border-top:1px solid rgba(255,255,255,.18); color:rgba(255,255,255,.82); font-size:13px; }
    .lightbox-caption { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    @media (max-width:720px) { .wrap{padding:16px;} .stats{grid-template-columns:1fr 1fr;} .bug-head{display:block;} .tags{justify-content:flex-start;margin-top:10px;} .sev{display:inline-block;} .shots{grid-template-columns:1fr;} }
    @media (max-width:720px) { .lightbox-body{padding:12px 46px;} .lightbox-nav{width:36px;height:58px;font-size:26px;} .lightbox-prev{left:6px;} .lightbox-next{right:6px;} .lightbox-footer{display:block;} }
  </style>
</head>
<body>
  <header>
    <div class="wrap">
      <h1>QBot Bug 候选证据复核</h1>
      <p class="sub">生成时间：2026-07-09。范围：当前 43 条严格单 Case Loop 结果。本页重新按证据链复核 ${bugItems.length} 个产品 Bug 候选和 ${blockerItems.length} 个可信阻塞；空回复截图只按“等待超时/无可读回复”记录，不再写成 Agent 回复后证据。</p>
      <div class="stats">
        <div class="stat"><b>${rows.length}</b><span>已执行/复核结果</span></div>
        <div class="stat"><b>${bugItems.length}</b><span>Bug 候选</span></div>
        <div class="stat warn"><b>${auditCounts.noReply}</b><span>空回复/超时证据</span></div>
        <div class="stat danger"><b>${auditCounts.needsRerun}</b><span>需重跑补证据</span></div>
      </div>
      <div class="stats">
        <div class="stat"><b>${auditCounts.complete}</b><span>证据链完整 Bug</span></div>
        <div class="stat"><b>${blockerItems.length}</b><span>可信阻塞</span></div>
        <div class="stat"><b>${bugImageCount}</b><span>Bug 关键证据图</span></div>
        <div class="stat"><b>${bugItems.length + blockerItems.length}</b><span>本页卡片数</span></div>
      </div>
      <div class="note">说明：本页是证据纠偏版。截图按“操作前 / 选择工具或页面 / 提问前或上传后 / 发送后 / 等待超时或回复结果 / 结果页”槽位展示；缺少槽位会直接标记“需重跑补证据”，不会用相同或无关截图替代。带“空回复/超时证据”的卡片，关键事实来自 case-result.json 和 reply-delta.txt，截图本身不代表存在 Agent 回复。</div>
      <div class="note">补充说明：完整纠偏清单已落盘到 /Users/qifu/Documents/QbotTestAgent/outputs/QBot_bug_candidates_evidence_复核纠偏说明_2026-07-09.md。</div>
      <nav class="toc">${toc}</nav>
    </div>
  </header>
  <main class="wrap">
    ${bugItems
      .map((item, index) => renderSection(item, index, reviewSentences.get(item.caseId), 'bug'))
      .join('\n')}
    ${blockerItems
      .map((item, index) =>
        renderSection(item, bugItems.length + index, reviewSentences.get(item.caseId), 'blocker'),
      )
      .join('\n')}
  </main>
  <div class="lightbox" id="lightbox" aria-hidden="true">
    <div class="lightbox-top">
      <div class="lightbox-title" id="lightbox-title">证据截图</div>
      <div class="lightbox-actions">
        <a class="lightbox-link" id="lightbox-open" href="#" target="_blank" rel="noopener">打开原图</a>
        <button class="lightbox-button" type="button" id="lightbox-close" aria-label="关闭预览">关闭</button>
      </div>
    </div>
    <div class="lightbox-body">
      <button class="lightbox-nav lightbox-prev" type="button" id="lightbox-prev" aria-label="上一张">‹</button>
      <img class="lightbox-image" id="lightbox-image" alt="证据截图全屏预览">
      <button class="lightbox-nav lightbox-next" type="button" id="lightbox-next" aria-label="下一张">›</button>
    </div>
    <div class="lightbox-footer">
      <div class="lightbox-caption" id="lightbox-caption"></div>
      <div id="lightbox-count"></div>
    </div>
  </div>
  <script>
    (() => {
      const triggers = Array.from(document.querySelectorAll('.lightbox-trigger'));
      const box = document.getElementById('lightbox');
      const image = document.getElementById('lightbox-image');
      const title = document.getElementById('lightbox-title');
      const caption = document.getElementById('lightbox-caption');
      const count = document.getElementById('lightbox-count');
      const openLink = document.getElementById('lightbox-open');
      const closeButton = document.getElementById('lightbox-close');
      const prevButton = document.getElementById('lightbox-prev');
      const nextButton = document.getElementById('lightbox-next');
      let current = 0;

      const setImage = (index) => {
        if (!triggers.length) return;
        current = (index + triggers.length) % triggers.length;
        const trigger = triggers[current];
        const href = trigger.getAttribute('href');
        const caseId = trigger.dataset.case || '';
        const shotCaption = trigger.dataset.caption || '';
        image.src = href;
        openLink.href = href;
        title.textContent = caseId ? caseId + ' 证据截图' : '证据截图';
        caption.textContent = shotCaption;
        count.textContent = String(current + 1) + ' / ' + String(triggers.length);
      };

      const open = (index) => {
        setImage(index);
        box.classList.add('open');
        box.setAttribute('aria-hidden', 'false');
        document.body.style.overflow = 'hidden';
      };

      const close = () => {
        box.classList.remove('open');
        box.setAttribute('aria-hidden', 'true');
        document.body.style.overflow = '';
        image.removeAttribute('src');
      };

      triggers.forEach((trigger, index) => {
        trigger.addEventListener('click', (event) => {
          event.preventDefault();
          open(index);
        });
      });
      closeButton.addEventListener('click', close);
      prevButton.addEventListener('click', () => setImage(current - 1));
      nextButton.addEventListener('click', () => setImage(current + 1));
      box.addEventListener('click', (event) => {
        if (event.target === box) close();
      });
      document.addEventListener('keydown', (event) => {
        if (!box.classList.contains('open')) return;
        if (event.key === 'Escape') close();
        if (event.key === 'ArrowLeft') setImage(current - 1);
        if (event.key === 'ArrowRight') setImage(current + 1);
      });
    })();
  </script>
</body>
</html>`;
  await fs.mkdir(outputDir, { recursive: true });
  await fs.writeFile(outputPath, html);
  await writeCorrectionReport(rows, bugItems, blockerItems, reviewSentences, auditCounts);
  console.log(outputPath);
  console.log(correctionReportPath);
  console.log(
    JSON.stringify(
      {
        reviewed: rows.length,
        bugs: bugItems.length,
        blockers: blockerItems.length,
        bugKeyImageCount: bugImageCount,
        assetImageCount: bugItems
          .concat(blockerItems)
          .reduce((sum, item) => sum + item.imageAssets.length, 0),
        assetsDir,
      },
      null,
      2,
    ),
  );
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
