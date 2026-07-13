#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';

const DEFAULT_REVIEW =
  'outputs/QBot_m3_latest_43cases_revised_review_2026-07-09.json';
const DEFAULT_OUT = 'outputs/QBot_m3_latest_43cases_annotated_evidence_2026-07-09.html';

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

const args = parseArgs(process.argv.slice(2));
const root = process.cwd();
const reviewPath = path.resolve(root, args.review || DEFAULT_REVIEW);
const outputPath = path.resolve(root, args.out || DEFAULT_OUT);
const outputDir = path.dirname(outputPath);
const assetDirName = `${path.basename(outputPath, path.extname(outputPath))}_assets`;
const assetDir = path.join(outputDir, assetDirName);

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function escapeAttr(value) {
  return escapeHtml(value).replaceAll('\n', ' ');
}

function safeFilePart(value) {
  return String(value ?? '')
    .replace(/[^a-zA-Z0-9._-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 120) || 'evidence';
}

function clip(value, length = 260) {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim();
  return text.length > length ? `${text.slice(0, length)}...` : text;
}

async function readJson(file) {
  return JSON.parse(await fs.readFile(file, 'utf8'));
}

async function readTextIfExists(file) {
  if (!file) return '';
  try {
    return await fs.readFile(file, 'utf8');
  } catch {
    return '';
  }
}

async function exists(file) {
  try {
    await fs.access(file);
    return true;
  } catch {
    return false;
  }
}

function relativeHref(file) {
  return encodeURI(path.relative(outputDir, file)).replaceAll('#', '%23');
}

function fileUrl(file) {
  return `file://${encodeURI(file)}`;
}

function classificationKind(classification) {
  if (/Bug|失败/.test(classification)) return 'bug';
  if (/阻塞/.test(classification)) return 'blocked';
  return 'pass';
}

function primaryReason(item, result, sourceReview) {
  const reportText = item.review_sentence || item.user_view_conclusion || sourceReview?.user_view_conclusion || '';
  const match = reportText.match(/用户操作：(.+?)；用户看到：(.+?)；审批理由：(.+?)；证据：/);
  if (match) {
    return {
      operation: match[1],
      observed: match[2],
      reason: match[3],
    };
  }
  return {
    operation: result.scenario || result.title || item.id,
    observed: result.actual_result || result.conclusion || '',
    reason: item.classification,
  };
}

function imageByPattern(screenshots, patterns, used = new Set()) {
  for (const pattern of patterns) {
    const found = screenshots.find((file) => {
      if (used.has(file)) return false;
      const name = path.basename(file);
      return pattern instanceof RegExp ? pattern.test(name) : name.includes(pattern);
    });
    if (found) {
      used.add(found);
      return found;
    }
  }
  return '';
}

function roleForImage(file) {
  const name = path.basename(file);
  if (/model-tier/i.test(name)) return '模型档位证据';
  if (/01-before|before/i.test(name)) return '操作前状态';
  if (/after-upload/i.test(name)) return '上传后证据';
  if (/after-fill/i.test(name)) return '提问前证据';
  if (/after-send/i.test(name)) return '发送后证据';
  if (/after-reply/i.test(name)) return '回复后证据';
  if (/after-timeout|timeout/i.test(name)) return '等待超时证据';
  if (/artifact-panel/i.test(name)) return '成果区证据';
  if (/connector/i.test(name)) return '连接器操作证据';
  if (/skill/i.test(name)) return '技能操作证据';
  if (/expert|open-experts|general/i.test(name)) return '专家操作证据';
  if (/assertion/i.test(name)) return '断言结果证据';
  return '关键证据';
}

function groupName(id) {
  if (/SIT-HOME-03[1-7]/.test(id)) return '附件读取';
  if (/SIT-HOME/.test(id)) return '首页会话';
  if (/SIT-EXPERT/.test(id)) return '专家';
  if (/SIT-SKILL/.test(id)) return '技能';
  if (/SIT-CONN/.test(id)) return '连接器';
  if (/SIT-ART/.test(id)) return '成果';
  return '其他';
}

function chooseScreens(item, result) {
  const screenshots = (item.screenshots || result.screenshots_flat || [])
    .filter(Boolean)
    .filter((file, index, arr) => arr.indexOf(file) === index);
  const used = new Set();
  const id = item.id;
  const selected = [];
  const add = (patterns) => {
    const file = imageByPattern(screenshots, patterns, used);
    if (file) selected.push(file);
  };

  add([/01-before/, /before/]);

  if (/SIT-HOME-03[1-7]/.test(id)) {
    add([/after-upload/]);
    add([/after-fill/]);
    add([/after-send/]);
    add([/after-reply/, /03-assertion/]);
  } else if (/SIT-HOME-00[1-3]/.test(id)) {
    add([/after-fill/]);
    add([/after-send/]);
    add([/after-reply/]);
    add([/03-assertion/]);
  } else if (/SIT-ART/.test(id)) {
    add([/after-fill/]);
    add([/after-send/]);
    add([/after-reply/]);
    add([/artifact-panel/, /03-assertion/]);
  } else if (/SIT-HOME-0(04|05|06)/.test(id)) {
    add([/expert-summoned/, /expert-detail/, /open-experts/]);
    add([/manual-skill-selected/, /manual-connector-selected/, /skill-mode-manual/, /connector-mode-manual/]);
    add([/after-send/]);
    add([/after-reply/, /03-assertion/]);
  } else if (/SIT-HOME-0(15|16|17|18|19|53|55)/.test(id)) {
    add([/after-fill/, /turn-1-after-fill/]);
    add([/after-send/, /turn-1-after-send/]);
    add([/after-reply/, /turn-\d+-after-reply/, /03-assertion/]);
  } else if (/SIT-EXPERT/.test(id)) {
    add([/open-experts/, /expert-001-page/]);
    add([/after-start-create/, /after-create/, /after-submit/, /after-general/, /after-summon/, /03-assertion/]);
  } else if (/SIT-SKILL/.test(id)) {
    add([/open-skills/, /skill-001/, /skill-after/, /skill-installed/, /skill-python/, /skill-node/]);
    add([/skill-mode/, /after-fill/]);
    add([/after-reply/, /03-assertion/]);
  } else if (/SIT-CONN/.test(id)) {
    add([/connectors-view/, /connector-mode/]);
    add([/after-fill/]);
    add([/after-reply/, /03-assertion/]);
  }

  add([/03-assertion/]);
  if (selected.length < 2) add([/model-tier/]);
  if (selected.length < 2) {
    for (const file of screenshots) {
      if (!used.has(file)) {
        used.add(file);
        selected.push(file);
      }
      if (selected.length >= 2) break;
    }
  }
  return selected.slice(0, 5);
}

function renderLinks(item) {
  const links = [
    ['Case 目录', item.case_dir],
    ['case-report.md', item.case_report],
    ['case-result.json', item.case_result],
    ['transcript.txt', item.transcript],
    ['reply-delta.txt', item.reply_delta],
  ].filter(([, file]) => file);
  return links
    .map(([label, file]) => `<a href="${fileUrl(file)}" target="_blank">${escapeHtml(label)}</a>`)
    .join('');
}

function renderEvidenceCard(item, result, evidenceShots, index) {
  const kind = classificationKind(item.classification);
  const reason = primaryReason(item, result);
  const figures = evidenceShots
    .map((shot, shotIndex) => `
      <figure>
        <a class="shot" href="${relativeHref(shot.imagePath)}" data-caption="${escapeAttr(`${item.id} · ${shot.role}`)}" data-case="${escapeAttr(item.id)}">
          <img src="${relativeHref(shot.imagePath)}" alt="${escapeAttr(`${item.id} ${shot.role}`)}" loading="lazy">
        </a>
        <figcaption>
          <b>${escapeHtml(shot.role)}</b>
          <span>原始关键截图</span>
          <a href="${relativeHref(shot.imagePath)}" target="_blank">打开原图</a>
        </figcaption>
      </figure>`)
    .join('');
  return `
    <section class="case-card ${kind}" id="${escapeAttr(item.id)}">
      <div class="case-head">
        <div>
          <div class="meta">#${index + 1} · ${escapeHtml(item.id)} · ${escapeHtml(groupName(item.id))}</div>
          <h2>${escapeHtml(result.title || result.scenario || item.id)}</h2>
        </div>
        <div class="badges">
          <span>${escapeHtml(item.classification)}</span>
          <span>M3: ${escapeHtml(item.m3 || '未记录')}</span>
          <span>${evidenceShots.length} 张关键图</span>
        </div>
      </div>
      ${item.corrected ? `<p class="correction">${escapeHtml(item.correction)}</p>` : ''}
      <div class="rationale">
        <p><b>用户操作：</b>${escapeHtml(clip(reason.operation, 420))}</p>
        <p><b>用户看到：</b>${escapeHtml(clip(reason.observed, 700))}</p>
        <p><b>审批理由：</b>${escapeHtml(clip(reason.reason, 520))}</p>
      </div>
      <div class="links">${renderLinks(item)}</div>
      <div class="shots">${figures}</div>
    </section>
  `;
}

function renderHtml({ review, cards }) {
  const counts = review.counts || {};
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>QBot M3 门禁证据报告</title>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; background: #f6f7f9; color: #1f2937; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", Arial, sans-serif; line-height: 1.55; }
    .top { position: sticky; top: 0; z-index: 10; background: rgba(255,255,255,.96); border-bottom: 1px solid #d9dee8; padding: 14px 24px; }
    .top h1 { margin: 0 0 4px; font-size: 22px; }
    .sub { color: #667085; font-size: 13px; }
    .wrap { max-width: 1480px; margin: 0 auto; padding: 22px 24px 64px; }
    .metrics { display: grid; grid-template-columns: repeat(6, minmax(120px, 1fr)); gap: 12px; margin-bottom: 14px; }
    .metric { background: #fff; border: 1px solid #dfe3ea; border-radius: 8px; padding: 14px; }
    .metric b { display: block; font-size: 26px; }
    .metric span { color: #667085; font-size: 13px; }
    .toc { display: flex; flex-wrap: wrap; gap: 8px; margin: 14px 0 22px; }
    .toc a { text-decoration: none; color: #344054; background: #eef2f7; border: 1px solid #d8dee8; border-radius: 6px; padding: 6px 9px; font-size: 12px; }
    .case-card { background: #fff; border: 1px solid #dfe3ea; border-left: 6px solid #98a2b3; border-radius: 8px; margin: 16px 0; padding: 16px; }
    .case-card.pass { border-left-color: #16a34a; }
    .case-card.bug { border-left-color: #ef4444; }
    .case-card.blocked { border-left-color: #f97316; }
    .case-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; }
    .meta { color: #667085; font-size: 13px; }
    h2 { font-size: 18px; margin: 4px 0 10px; }
    .badges { display: flex; gap: 8px; flex-wrap: wrap; justify-content: flex-end; }
    .badges span { border-radius: 999px; background: #eef2f7; border: 1px solid #d8dee8; padding: 5px 9px; white-space: nowrap; font-size: 12px; }
    .pass .badges span:first-child { color: #166534; background: #ecfdf3; border-color: #abefc6; }
    .bug .badges span:first-child { color: #b42318; background: #fef3f2; border-color: #fecdca; }
    .blocked .badges span:first-child { color: #b54708; background: #fff7ed; border-color: #fed7aa; }
    .correction { background: #ecfdf3; border: 1px solid #abefc6; border-radius: 6px; padding: 10px; }
    .rationale { display: grid; gap: 8px; margin: 10px 0; }
    .rationale p { margin: 0; background: #f8fafc; border: 1px solid #e5e7eb; border-radius: 6px; padding: 9px; }
    .links { display: flex; gap: 8px; flex-wrap: wrap; margin: 10px 0 14px; }
    .links a { color: #175cd3; background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 6px; padding: 6px 8px; text-decoration: none; font-size: 13px; }
    .shots { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 12px; }
    figure { margin: 0; border: 1px solid #e4e7ec; border-radius: 8px; background: #f8fafc; overflow: hidden; }
    figure img { display: block; width: 100%; height: 220px; object-fit: contain; background: #fff; }
    figcaption { padding: 9px 10px; font-size: 12px; color: #475467; }
    figcaption b, figcaption span { display: block; word-break: break-word; }
    figcaption a { color: #175cd3; text-decoration: none; }
    .lightbox { position: fixed; inset: 0; background: rgba(10, 13, 18, .94); z-index: 30; display: none; grid-template-rows: auto 1fr auto; }
    .lightbox.open { display: grid; }
    .lb-bar { display: flex; align-items: center; justify-content: space-between; color: #fff; padding: 12px 16px; }
    .lb-bar button, .lb-nav button { border: 0; border-radius: 6px; background: #fff; color: #111827; padding: 8px 12px; cursor: pointer; }
    .lb-stage { display: flex; align-items: center; justify-content: center; min-height: 0; }
    .lb-stage img { max-width: 96vw; max-height: 82vh; background: #fff; object-fit: contain; }
    .lb-caption { color: #d0d5dd; padding: 10px 16px; text-align: center; }
    .lb-nav { position: absolute; inset: 50% 16px auto 16px; transform: translateY(-50%); display: flex; justify-content: space-between; pointer-events: none; }
    .lb-nav button { pointer-events: auto; font-size: 22px; }
    @media (max-width: 900px) { .top { position: static; } .metrics { grid-template-columns: repeat(2, 1fr); } .case-head { display: block; } .shots { grid-template-columns: 1fr; } }
  </style>
</head>
<body>
  <header class="top">
    <h1>QBot M3 门禁证据报告</h1>
    <div class="sub">来源：${escapeHtml(review.run_dir)} · 展示原始关键截图</div>
  </header>
  <main class="wrap">
    <div class="metrics">
      <div class="metric"><b>${counts.total ?? 0}</b><span>执行用例</span></div>
      <div class="metric"><b>${counts.trusted ?? 0}</b><span>可信证据</span></div>
      <div class="metric"><b>${counts.pass ?? 0}</b><span>可信通过</span></div>
      <div class="metric"><b>${counts.bug ?? 0}</b><span>Bug 候选</span></div>
      <div class="metric"><b>${counts.blocked ?? 0}</b><span>可信阻塞</span></div>
      <div class="metric"><b>${(((counts.trust_rate ?? 0) * 100).toFixed(1))}%</b><span>证据可信度</span></div>
    </div>
    <div class="toc">
      ${review.items.map((item) => `<a href="#${escapeAttr(item.id)}">${escapeHtml(item.id)}</a>`).join('\n')}
    </div>
    ${cards.join('\n')}
  </main>
  <div class="lightbox" id="lightbox">
    <div class="lb-bar"><span id="lbCounter"></span><button id="lbClose">关闭</button></div>
    <div class="lb-stage"><img id="lbImg" src="" alt=""></div>
    <div class="lb-nav"><button id="lbPrev">‹</button><button id="lbNext">›</button></div>
    <div class="lb-caption" id="lbCaption"></div>
  </div>
  <script>
    const shots = Array.from(document.querySelectorAll('a.shot')).map((a) => ({ href: a.href, caption: a.dataset.caption || '' }));
    let current = 0;
    const lb = document.getElementById('lightbox');
    const img = document.getElementById('lbImg');
    const cap = document.getElementById('lbCaption');
    const counter = document.getElementById('lbCounter');
    function show(index) {
      if (!shots.length) return;
      current = (index + shots.length) % shots.length;
      img.src = shots[current].href;
      cap.textContent = shots[current].caption;
      counter.textContent = (current + 1) + ' / ' + shots.length;
      lb.classList.add('open');
    }
    document.querySelectorAll('a.shot').forEach((a, index) => a.addEventListener('click', (event) => {
      event.preventDefault();
      show(index);
    }));
    document.getElementById('lbClose').onclick = () => lb.classList.remove('open');
    document.getElementById('lbPrev').onclick = () => show(current - 1);
    document.getElementById('lbNext').onclick = () => show(current + 1);
    document.addEventListener('keydown', (event) => {
      if (!lb.classList.contains('open')) return;
      if (event.key === 'Escape') lb.classList.remove('open');
      if (event.key === 'ArrowLeft') show(current - 1);
      if (event.key === 'ArrowRight') show(current + 1);
    });
  </script>
</body>
</html>
`;
}

async function copyOriginal(source, destination) {
  await fs.copyFile(source, destination);
}

async function main() {
  const review = await readJson(reviewPath);
  const sourceReviewItems = new Map();
  if (review.source_review_json && await exists(review.source_review_json)) {
    const sourceReview = await readJson(review.source_review_json);
    for (const sourceItem of sourceReview.items || []) {
      sourceReviewItems.set(sourceItem.id, sourceItem);
    }
  }
  await fs.rm(assetDir, { recursive: true, force: true });
  await fs.mkdir(assetDir, { recursive: true });

  const cards = [];
  const manifest = {
    generated_at: new Date().toISOString(),
    review: reviewPath,
    output: outputPath,
    assets_dir: assetDir,
    counts: review.counts,
    items: [],
  };

  let totalEvidence = 0;
  for (const [index, item] of review.items.entries()) {
    const result = await readJson(item.case_result);
    const selected = chooseScreens(item, result);
    const evidenceShots = [];

    for (const [shotIndex, image] of selected.entries()) {
      if (!(await exists(image))) continue;
      const role = roleForImage(image);
      const base = `${String(index + 1).padStart(2, '0')}-${item.id}-${String(shotIndex + 1).padStart(2, '0')}-${safeFilePart(path.basename(image, path.extname(image)))}`;
      const imagePath = path.join(assetDir, `${base}${path.extname(image) || '.png'}`);
      await copyOriginal(image, imagePath);
      evidenceShots.push({
        source: image,
        role,
        imagePath,
      });
      totalEvidence += 1;
    }

    manifest.items.push({
      id: item.id,
      classification: item.classification,
      case_result: item.case_result,
      case_report: item.case_report,
      evidence_count: evidenceShots.length,
      evidence: evidenceShots.map((shot) => ({
        role: shot.role,
        source: shot.source,
        image: shot.imagePath,
      })),
    });
    cards.push(renderEvidenceCard({
      ...item,
      review_sentence: sourceReviewItems.get(item.id)?.user_view_conclusion || '',
    }, result, evidenceShots, index));
  }

  manifest.total_evidence_images = totalEvidence;
  await fs.writeFile(outputPath, renderHtml({ review, cards }));
  await fs.writeFile(path.join(outputDir, `${path.basename(outputPath, '.html')}.json`), `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(JSON.stringify({
    output: outputPath,
    manifest: path.join(outputDir, `${path.basename(outputPath, '.html')}.json`),
    assets_dir: assetDir,
    cases: review.items.length,
    evidence_images: totalEvidence,
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
