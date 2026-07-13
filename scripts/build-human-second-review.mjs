import fs from 'node:fs';
import path from 'node:path';

const out = '/Users/qifu/Documents/QbotTestAgent/autoTest/202607112130_full_142_latest-main_8736fcac_m3_framework-clean';
const summary = JSON.parse(fs.readFileSync(path.join(out, 'automation-run-summary.json'), 'utf8'));

const confirmedBugIds = new Set([
  'SIT-HOME-005',
  'SIT-HOME-029',
  'SIT-CONN-010',
  'SIT-ART-001',
  'SIT-ART-006',
  'SIT-ART-007',
]);

// These cases selected M3 before clicking New Task. New Task reset the visible tier to M2,
// and there was no second M3 selection before Send. They cannot prove the requested M3 lane.
const modelTierInvalidIds = new Set([
  'SIT-HOME-015','SIT-HOME-016','SIT-HOME-017','SIT-HOME-018','SIT-HOME-019',
  'SIT-HOME-031','SIT-HOME-032','SIT-HOME-033','SIT-HOME-034','SIT-HOME-035',
  'SIT-HOME-036','SIT-HOME-037','SIT-HOME-007','SIT-HOME-008','SIT-HOME-009',
  'SIT-HOME-010','SIT-HOME-020','SIT-HOME-021','SIT-HOME-022','SIT-HOME-024',
  'SIT-HOME-025','SIT-HOME-038','SIT-HOME-039','SIT-HOME-040','SIT-HOME-041',
  'SIT-HOME-026','SIT-HOME-028','SIT-HOME-030','SIT-HOME-053','SIT-HOME-054',
  'SIT-SKILL-006',
]);

const additionalInconclusive = new Map([
  ['SIT-HOME-023', '框架没有留下“点击停止”的操作步骤；只证明发送后 running=true，不能据 stopped=false 判产品 Bug。'],
  ['SIT-HOME-052', '只命中泛化页面文案，没有真正打开本地工作空间。'],
  ['SIT-SKILL-002', '截图仍为“正在安装”，未证明目标技能完成安装并进入已安装列表。'],
  ['SIT-SKILL-004', '选择的是因 keyring/browser_auth 被拒的 Outlook 技能，没有验证 Python 隔离运行时自动准备。'],
  ['SIT-SKILL-005', '选择的是因 self_mcp 被拒的技能，没有验证 Node 隔离运行时自动准备。'],
  ['SIT-SKILL-013', '截图仍为“待物化/正在准备”，没有触发并等待就绪或失败终态。'],
  ['SIT-SKILL-020', '只看到“正在安装”，没有比较安装记录数量，不能证明双击未产生重复记录。'],
  ['SIT-SKILL-025', '安装未完成即进入首页，最终调用的是“创建 Skill”，不是刚安装的目标技能。'],
  ['SIT-ART-002', '只证明 HTML 出现在成果概览，没有点击并验证预览/打开。'],
  ['SIT-ART-005', '工作目录位于隐藏的 .runtime，预览被路径安全策略拒绝；属于测试环境阻塞。'],
  ['SIT-ART-010', '两个成果都只进入“隐藏/受保护路径无法读取”页，未验证实际预览内容切换。'],
  ['SIT-ART-015', '隐藏 .runtime 路径导致 HTML 根本未加载，executed=false 不能证明沙箱拦截了脚本。'],
  ['SIT-ART-018', '测试数据只说生成三种文件、没有主题或内容，Agent 合理要求澄清；用例数据不足。'],
]);

const correctedPassIds = new Set(['SIT-HOME-012', 'SIT-ART-003']);

const bugReasons = new Map([
  ['SIT-HOME-005', '连接器从“禁用”再次切到“手动”后，UI 仍保持禁用；截图与 aria/class 状态一致。'],
  ['SIT-HOME-029', '点击提示词美化后输入仍为“帮我复盘活动”，没有任何改写或错误提示。'],
  ['SIT-CONN-010', 'M3 回复把 2026-07-11 说成周五，实际为周六；日期事实错误。'],
  ['SIT-ART-001', '只生成一个 qbot_v1_summary.md，成果区却登记为 2 个同名成果。'],
  ['SIT-ART-006', 'M3 生成 PDF 连续执行依赖安装/脚本命令，180 秒仍未结束，也没有可理解的超时或失败收口。'],
  ['SIT-ART-007', '只生成一个 test-output.md，成果区却显示两个同名成果；同时该用例的“工作区文件模式”本身未被框架验证。'],
]);

function classify(result) {
  if (result.status === 'blocked') return ['可信阻塞', result.actual_result];
  if (confirmedBugIds.has(result.id)) return ['确认Bug', bugReasons.get(result.id)];
  if (modelTierInvalidIds.has(result.id)) {
    return ['不可信/待重跑', '发送前实际界面已回到 M2；报告中的 M3 证据发生在点击“新建任务”之前，不能代表本轮消息在 M3 执行。'];
  }
  if (additionalInconclusive.has(result.id)) return ['不可信/待重跑', additionalInconclusive.get(result.id)];
  if (correctedPassIds.has(result.id)) {
    const why = result.id === 'SIT-HOME-012'
      ? '三种工作模式的 capability 与工具条读回均正确；失败只来自回复相关性误判。'
      : '聊天正文没有 raw artifact/JSON 事件；重复的是允许展示的“新建文件”工具过程。';
    return ['可信通过', why];
  }
  if (result.status === 'passed') return ['可信通过', '核心操作/断言有可回读结果，且未发现模型档位顺序、测试数据或证据缺口。'];
  return ['不可信/待重跑', '原始失败没有形成可排除框架、模型档位或用例数据影响的产品证据。'];
}

const items = summary.results.map((result) => {
  const [review_status, review_reason] = classify(result);
  const screenshot = result.screenshots?.final || result.screenshots_flat?.at?.(-1) || '';
  return {
    id: result.id,
    module: result.module,
    scenario: result.scenario,
    raw_status: result.status,
    review_status,
    review_reason,
    actual_result: result.actual_result,
    case_report: result.case_report,
    screenshot,
  };
});

const counts = Object.fromEntries(['可信通过','确认Bug','可信阻塞','不可信/待重跑'].map(k => [k, items.filter(x => x.review_status === k).length]));
if (items.length !== 142 || counts['可信通过'] !== 74 || counts['确认Bug'] !== 6 || counts['可信阻塞'] !== 18 || counts['不可信/待重跑'] !== 44) {
  throw new Error(`unexpected counts: ${JSON.stringify(counts)} total=${items.length}`);
}

const bugGroups = [
  {
    title: '连接器模式无法从禁用恢复到手动',
    severity: 'P1', ids: ['SIT-HOME-005'],
    conclusion: '确认 Bug。首次手动可选，切到禁用后再次点击手动不生效，工具条、选中态和说明文案都仍是“禁用连接器”。',
  },
  {
    title: '提示词美化按钮无效果且无反馈',
    severity: 'P1', ids: ['SIT-HOME-029'],
    conclusion: '确认 Bug。点击后文本逐字不变，也没有“无需优化/优化失败”等反馈。',
  },
  {
    title: 'M3 长任务/PDF 生成无法在 180 秒内收口',
    severity: 'P1', ids: ['SIT-ART-006'],
    conclusion: '确认 Bug。持续安装依赖和尝试脚本，超过 180 秒仍处于执行中；产品没有超时、失败原因或可恢复提示。',
  },
  {
    title: '成果区同一路径被重复登记和重复计数',
    severity: 'P1', ids: ['SIT-ART-001','SIT-ART-007'],
    conclusion: '确认 Bug。单次只生成一个文件，但概览显示两个同名成果并把总数记为 2。',
  },
  {
    title: 'M3 回复的日期与星期不一致',
    severity: 'P2', ids: ['SIT-CONN-010'],
    conclusion: '确认 Bug。回复“2026-07-11（周五）”，实际 2026-07-11 为周六。连接器禁用本身通过，但回答事实错误。',
  },
];

const provisional = [
  {
    title: '附件已在 UI 展示，但 M2 会话未收到或读取了错误文件，并暴露原始 LiteLLM 错误',
    ids: ['SIT-HOME-032','SIT-HOME-035','SIT-HOME-037','SIT-HOME-038'],
    note: '现象本身严重，但这些消息实际在 M2 执行；HOME-032 明确显示 GLM-5.2 非多模态和原始 API Error。先修复 M3 选择顺序后复跑再决定是否报 M3 产品 Bug。',
  },
  {
    title: '敏感数据虽遮罩原值，但继续推导出生日期、性别、地区和银行卡归属',
    ids: ['SIT-HOME-054'],
    note: '属于隐私最小化风险；本次实际在 M2，建议在正确 M3 下复验后按安全/隐私 Bug 处理。',
  },
  {
    title: '多条 M2 会话长时间停在思考中或无正文',
    ids: ['SIT-HOME-018','SIT-HOME-019','SIT-HOME-031','SIT-HOME-034','SIT-HOME-036','SIT-HOME-008','SIT-HOME-009','SIT-HOME-010','SIT-HOME-024','SIT-HOME-039','SIT-HOME-040','SIT-HOME-041','SIT-HOME-026','SIT-HOME-028','SIT-HOME-053'],
    note: '是明确的 M2 稳定性信号，但不能当作本轮 M3 失败。应以正确 M3 顺序重跑；若仍复现，合并为一个 Agent 执行无响应/无超时兜底 Bug。',
  },
];

const blockedGroups = [
  {name:'账号/目录状态不满足', ids:['SIT-EXPERT-015','SIT-EXPERT-019','SIT-EXPERT-022','SIT-SKILL-014','SIT-SKILL-015','SIT-SKILL-018','SIT-SKILL-022','SIT-CONN-008','SIT-CONN-009','SIT-CONN-014','SIT-CONN-018','SIT-ART-012']},
  {name:'缺少可控故障注入', ids:['SIT-SKILL-021','SIT-CONN-012','SIT-CONN-013','SIT-ART-011']},
  {name:'缺少可控项目上下文', ids:['SIT-ART-013','SIT-ART-014']},
];

const jsonPath = path.join(out, '人工二次复核_2026-07-13.json');
fs.writeFileSync(jsonPath, JSON.stringify({generated_at:new Date().toISOString(), counts, bugGroups, provisional, blockedGroups, items}, null, 2));

const ids = (xs) => xs.map(x => `\`${x}\``).join('、');
const md = [];
md.push('# QBot 142 条全量执行人工二次复核');
md.push('', `- 原始统计：96 通过 / 28 失败 / 18 阻塞`, `- 人工复核：**${counts['可信通过']} 可信通过 / ${counts['确认Bug']} 个确认 Bug 证据用例 / ${counts['可信阻塞']} 可信阻塞 / ${counts['不可信/待重跑']} 不可信或待重跑**`);
md.push('', '## 最重要的可信度发现', '', '- 有 31 条会话在“切 M3”之后又点击了“新建任务”；新任务把可见档位重置成 M2，发送前没有再切回 M3。报告把这些错误记成了 M3。', '- 原始 96 条通过中只有 72 条仍可信；另有 HOME-012、ART-003 两条原始失败应纠正为通过，所以最终可信通过为 74。', '- 28 条原始失败中，确认 Bug 证据 3 条（HOME-005、HOME-029、ART-006）；HOME-012、ART-003 是误报，其余受 M2、框架操作缺失、环境路径或用例数据影响。另有 3 条原始通过在人工复核时发现了产品问题。');
md.push('', '## 确认 Bug', '');
for (const b of bugGroups) md.push(`### ${b.severity} ${b.title}`, '', `- 证据用例：${ids(b.ids)}`, `- 结论：${b.conclusion}`, '');
md.push('## 强 Bug 信号，但需按正确 M3 重跑确认', '');
for (const b of provisional) md.push(`### ${b.title}`, '', `- 用例：${ids(b.ids)}`, `- 结论：${b.note}`, '');
md.push('## 阻塞复核', '');
for (const g of blockedGroups) md.push(`- ${g.name}（${g.ids.length}）：${ids(g.ids)}`);
md.push('', '这些阻塞均有与当前账号/环境状态一致的证据，不应报产品 Bug。缺少故障注入的 4 条仍属于自动化框架能力缺口。');
for (const status of ['可信通过','确认Bug','可信阻塞','不可信/待重跑']) {
  md.push('', `## ${status}（${counts[status]}）`, '', '| ID | 原始状态 | 场景 | 人工结论 |', '| --- | --- | --- | --- |');
  for (const x of items.filter(x=>x.review_status===status)) md.push(`| ${x.id} | ${x.raw_status} | ${x.scenario.replaceAll('|','/')} | ${x.review_reason.replaceAll('|','/').replaceAll('\n',' ')} |`);
}
const mdPath = path.join(out, '人工二次复核_2026-07-13.md');
fs.writeFileSync(mdPath, md.join('\n'));

const esc = (s='') => String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const rel = (p='') => p ? path.relative(out,p).split(path.sep).map(encodeURIComponent).join('/') : '';
const bugShots = bugGroups.flatMap(b => b.ids.map(id => items.find(x=>x.id===id))).filter(Boolean);
const cards = items.map(x => `<article class="case" data-status="${esc(x.review_status)}" data-q="${esc(`${x.id} ${x.scenario} ${x.review_reason}`.toLowerCase())}">
  <div class="case-head"><span class="badge ${x.review_status==='确认Bug'?'bad':x.review_status==='可信通过'?'ok':x.review_status==='可信阻塞'?'block':'warn'}">${esc(x.review_status)}</span><code>${esc(x.id)}</code><span class="raw">原始 ${esc(x.raw_status)}</span></div>
  <h3>${esc(x.scenario)}</h3><p>${esc(x.review_reason)}</p>
  <div class="links"><a href="${rel(x.case_report)}">case report</a>${x.screenshot?`<button class="shot" data-src="${rel(x.screenshot)}" data-caption="${esc(x.id+' '+x.scenario)}">查看截图</button>`:''}</div>
</article>`).join('\n');
const html = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>QBot 142 人工二次复核</title><style>
:root{--bg:#f5f7fb;--card:#fff;--text:#182033;--muted:#667085;--line:#e5e9f2;--ok:#087a55;--bad:#c93636;--warn:#a96500;--block:#5c55b9}*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font:14px/1.55 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.wrap{max-width:1440px;margin:auto;padding:32px}.hero{background:#12213a;color:#fff;border-radius:20px;padding:30px}.hero h1{margin:0 0 10px;font-size:30px}.stats{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-top:20px}.stat{background:#ffffff12;border:1px solid #ffffff20;padding:16px;border-radius:14px}.stat b{font-size:30px;display:block}.section{margin-top:26px}.bugs{display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:14px}.bug{background:var(--card);border-left:5px solid var(--bad);padding:18px;border-radius:12px;box-shadow:0 4px 16px #1820330b}.bug h3{margin:0 0 8px}.controls{position:sticky;top:0;z-index:3;background:#f5f7fbdd;backdrop-filter:blur(10px);padding:14px 0;display:flex;gap:8px;flex-wrap:wrap}.controls button,.controls input,.shot{border:1px solid var(--line);background:#fff;padding:9px 12px;border-radius:9px}.controls input{min-width:280px}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(360px,1fr));gap:12px}.case{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:16px}.case h3{font-size:16px;margin:9px 0}.case p{color:var(--muted);margin:0 0 12px}.case-head{display:flex;align-items:center;gap:8px}.raw{margin-left:auto;color:var(--muted)}.badge{padding:3px 8px;border-radius:999px;color:#fff}.ok{background:var(--ok)}.bad{background:var(--bad)}.warn{background:var(--warn)}.block{background:var(--block)}.links{display:flex;gap:8px;align-items:center}.links a{color:#1b5fc1}.shot{cursor:pointer;color:#1b5fc1}.hidden{display:none!important}#viewer{position:fixed;inset:0;background:#000e;z-index:20;display:none;align-items:center;justify-content:center;padding:28px}#viewer.open{display:flex}#viewer img{max-width:96vw;max-height:88vh;object-fit:contain}#caption{position:absolute;left:24px;right:24px;bottom:8px;color:#fff;text-align:center}#close{position:absolute;right:20px;top:16px;color:#fff;font-size:34px;cursor:pointer}.hint{color:#cbd5e1;font-size:13px}@media(max-width:760px){.wrap{padding:16px}.stats{grid-template-columns:repeat(2,1fr)}.grid{grid-template-columns:1fr}}
</style></head><body><div class="wrap"><section class="hero"><h1>QBot 142 条全量执行 · 人工二次复核</h1><p>严格按 M3 实际执行顺序、核心操作、断言、transcript 与截图重新判断。原始 96/28/18 不能直接用于汇报。</p><div class="stats"><div class="stat"><b>${counts['可信通过']}</b>可信通过</div><div class="stat"><b>${counts['确认Bug']}</b>确认 Bug 证据用例</div><div class="stat"><b>${counts['可信阻塞']}</b>可信阻塞</div><div class="stat"><b>${counts['不可信/待重跑']}</b>不可信/待重跑</div></div></section>
<section class="section"><h2>关键可信度问题</h2><div class="bug"><h3>31 条消息实际在 M2，不是报告声称的 M3</h3><p>框架先选择 M3，再点击“新建任务”；新任务把界面恢复到 M2，而发送前未重新选择 M3。原始通过中只有 72 条仍可信，加上两条纠正误报后最终为 74 条可信通过。</p></div></section>
<section class="section"><h2>确认 Bug</h2><div class="bugs">${bugGroups.map(b=>`<div class="bug"><h3>${esc(b.severity+' '+b.title)}</h3><p><b>${esc(b.ids.join('、'))}</b></p><p>${esc(b.conclusion)}</p></div>`).join('')}</div></section>
<section class="section"><h2>强 Bug 信号（正确 M3 复跑后定案）</h2><div class="bugs">${provisional.map(b=>`<div class="bug" style="border-left-color:var(--warn)"><h3>${esc(b.title)}</h3><p><b>${esc(b.ids.join('、'))}</b></p><p>${esc(b.note)}</p></div>`).join('')}</div></section>
<section class="section"><h2>142 条逐项复核</h2><div class="controls"><button data-filter="all">全部 142</button><button data-filter="可信通过">可信通过 ${counts['可信通过']}</button><button data-filter="确认Bug">确认Bug ${counts['确认Bug']}</button><button data-filter="可信阻塞">可信阻塞 ${counts['可信阻塞']}</button><button data-filter="不可信/待重跑">待重跑 ${counts['不可信/待重跑']}</button><input id="search" placeholder="搜索 ID、场景或原因"></div><div class="grid">${cards}</div></section></div>
<div id="viewer"><span id="close">×</span><img alt="证据截图"><div id="caption"></div><div class="hint" style="position:absolute;top:20px;left:20px">← / → 切换截图，Esc 关闭</div></div><script>
let filter='all';const cases=[...document.querySelectorAll('.case')],search=document.querySelector('#search');function apply(){const q=search.value.trim().toLowerCase();for(const c of cases)c.classList.toggle('hidden',!(filter==='all'||c.dataset.status===filter)||!c.dataset.q.includes(q))}document.querySelectorAll('[data-filter]').forEach(b=>b.onclick=()=>{filter=b.dataset.filter;apply()});search.oninput=apply;
const viewer=document.querySelector('#viewer'),img=viewer.querySelector('img'),cap=document.querySelector('#caption');let shots=[],idx=0;function openShot(btn){shots=[...document.querySelectorAll('.case:not(.hidden) .shot')];idx=Math.max(0,shots.indexOf(btn));show()}function show(){const b=shots[idx];if(!b)return;img.src=b.dataset.src;cap.textContent=b.dataset.caption;viewer.classList.add('open')}document.querySelectorAll('.shot').forEach(b=>b.onclick=()=>openShot(b));document.querySelector('#close').onclick=()=>viewer.classList.remove('open');viewer.onclick=e=>{if(e.target===viewer)viewer.classList.remove('open')};document.onkeydown=e=>{if(!viewer.classList.contains('open'))return;if(e.key==='Escape')viewer.classList.remove('open');if(e.key==='ArrowRight'){idx=(idx+1)%shots.length;show()}if(e.key==='ArrowLeft'){idx=(idx-1+shots.length)%shots.length;show()}};
</script></body></html>`;
const htmlPath = path.join(out, '人工二次复核_2026-07-13.html');
fs.writeFileSync(htmlPath, html);
console.log(JSON.stringify({counts,jsonPath,mdPath,htmlPath}, null, 2));
