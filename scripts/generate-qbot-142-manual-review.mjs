import fs from 'node:fs';
import path from 'node:path';

const runDir = '/Users/qifu/Documents/QbotTestAgent/autoTest/202607111310_full_142_latest-main_b08a6769_m3_frameworkfix3_自动化测试结果';
const outDir = '/Users/qifu/Documents/QbotTestAgent/outputs';
const htmlPath = path.join(outDir, '2026-07-11-qbot-142-人工复核最终报告.html');
const jsonPath = path.join(outDir, '2026-07-11-qbot-142-人工复核结构化结果.json');

const bugCases = new Set([
  'SIT-HOME-008', 'SIT-HOME-024',
  'SIT-HOME-031', 'SIT-HOME-032', 'SIT-HOME-033', 'SIT-HOME-035', 'SIT-HOME-036',
  'SIT-HOME-037', 'SIT-HOME-038', 'SIT-HOME-039', 'SIT-HOME-040', 'SIT-HOME-041',
  'SIT-HOME-042', 'SIT-EXPERT-013', 'SIT-ART-010',
]);

const caseIssueCases = new Set([
  'SIT-ART-003', 'SIT-ART-006', 'SIT-ART-015',
  'SIT-CONN-004', 'SIT-CONN-015',
  'SIT-EXPERT-009',
  'SIT-HOME-004', 'SIT-HOME-009', 'SIT-HOME-011', 'SIT-HOME-013',
  'SIT-HOME-014', 'SIT-HOME-018', 'SIT-HOME-055',
  'SIT-SKILL-003', 'SIT-SKILL-019', 'SIT-SKILL-025',
]);

const frameworkCases = new Set([
  'SIT-ART-009', 'SIT-ART-020',
  'SIT-EXPERT-005', 'SIT-EXPERT-012', 'SIT-EXPERT-020', 'SIT-EXPERT-021',
  'SIT-HOME-002', 'SIT-HOME-016', 'SIT-HOME-023', 'SIT-HOME-027', 'SIT-HOME-029',
  'SIT-HOME-043', 'SIT-HOME-044', 'SIT-HOME-045', 'SIT-HOME-046',
  'SIT-HOME-047', 'SIT-HOME-048', 'SIT-HOME-049', 'SIT-HOME-050', 'SIT-HOME-051', 'SIT-HOME-056',
  'SIT-SKILL-007', 'SIT-SKILL-009', 'SIT-SKILL-010',
]);

const rootBug = {
  'SIT-HOME-008': 'BUG-02', 'SIT-HOME-024': 'BUG-02',
  'SIT-HOME-031': 'BUG-01', 'SIT-HOME-032': 'BUG-01', 'SIT-HOME-033': 'BUG-01',
  'SIT-HOME-035': 'BUG-01', 'SIT-HOME-036': 'BUG-01', 'SIT-HOME-037': 'BUG-01',
  'SIT-HOME-038': 'BUG-01', 'SIT-HOME-039': 'BUG-01', 'SIT-HOME-040': 'BUG-01', 'SIT-HOME-041': 'BUG-01',
  'SIT-HOME-042': 'BUG-03', 'SIT-EXPERT-013': 'BUG-04', 'SIT-ART-010': 'BUG-05',
};

const reason = {
  'SIT-HOME-008': '回复暴露 desktop-local、远端控制面/认证配置等实现细节，普通用户可见。',
  'SIT-HOME-024': '切换模块后回复暴露 desktop-local、DEEPBANK_SURFACE 等内部运行信息。',
  'SIT-HOME-031': 'TXT 已显示在附件区并随消息发送，Agent 明确称未收到附件。',
  'SIT-HOME-032': 'Markdown 已显示在附件区并随消息发送，Agent 未获得内容。',
  'SIT-HOME-033': 'DOCX 已显示在附件区并随消息发送，Agent 未获得内容。',
  'SIT-HOME-035': 'PDF 已显示在附件区并随消息发送，Agent 未获得内容。',
  'SIT-HOME-036': 'PPT 已显示在附件区并随消息发送，Agent 未获得内容。',
  'SIT-HOME-037': 'PNG 已显示在附件区并随消息发送，Agent 未获得视觉内容。',
  'SIT-HOME-038': '3 张图片均显示并随消息发送，Agent 称未收到附件。',
  'SIT-HOME-039': '图片和文档均显示并随消息发送，Agent 无法区分或读取。',
  'SIT-HOME-040': 'Word/Excel/PDF/PPT 均显示并随消息发送，Agent 称未收到附件。',
  'SIT-HOME-041': 'JSON/CSV/HTML/JS 均显示并随消息发送，Agent 称未收到附件。',
  'SIT-HOME-042': '一次上传 6 个文档，界面全部接收，未触发“最多 5 个”限制。',
  'SIT-EXPERT-013': '自建专家创建成功；点击删除并确认后，该专家仍在“我的专家”中。',
  'SIT-ART-010': 'first.md/second.md 实际已生成，但成果预览显示路径无法读取，点击第二项后仍停留在 first.md。',

  'SIT-ART-003': '请求未明确要求创建实际成果，不能用“成果面板为空”反推 raw artifact 事件泄漏。',
  'SIT-ART-006': '请求只要求“需要本地软件打开的文件”，Agent 选择 HTML；测试数据未限定 PDF/Office/图片。',
  'SIT-ART-015': '仅命中“defer defer”重复检测，未证明危险脚本被执行。',
  'SIT-CONN-004': '回复已说明连接器能力和信息来源，相关性断言误判。',
  'SIT-CONN-015': '重复检测命中工具标签“调用连接器 qbot_web · web_crawl”，不是重复回复。',
  'SIT-EXPERT-009': '绑定的技能本身不可用/未准备就绪，测试数据不满足可执行前提。',
  'SIT-HOME-004': '自动选择了 skill-creator-qbot 处理活动验收标准，技能与任务不匹配并引发澄清/超时。',
  'SIT-HOME-009': '回复实际给出了测试执行方案，相关性断言误判。',
  'SIT-HOME-011': '在新草稿里要求继续“刚才专家身份”但没有提供会议材料或可继承上下文。',
  'SIT-HOME-013': '回复围绕安全级别解释，相关性断言过严。',
  'SIT-HOME-014': '新草稿首轮发送“继续刚才回答”，无法验证任务创建后的安全级别只读。',
  'SIT-HOME-018': '仅命中固定提示词“用户看到的提示”，不构成上下文丢失或泄漏。',
  'SIT-HOME-055': 'Agent 正确拒绝读取受限路径；断言因敏感关键词本身而误报。',
  'SIT-SKILL-003': '取“第一个已安装技能”作为删除对象，可能选中内置/不可删除技能。',
  'SIT-SKILL-019': '仅命中“优先级：P0｜类型：异常”的重复规则，业务回复本身可读。',
  'SIT-SKILL-025': '回复明确说明所选技能用途，相关性断言误判。',

  'SIT-ART-009': '截图中右上角关闭 X 清晰可见；框架只找 data-testid，错误报告“无关闭入口”。',
  'SIT-ART-020': '截图中右上角关闭 X 清晰可见；框架未识别，后续关闭/重开步骤没有真正执行。另有同名成果重复展示，需单独用例确认。',
  'SIT-EXPERT-005': '截图已显示首页“专家构建师”标签，框架选择器未识别。',
  'SIT-EXPERT-012': '框架删除选择器漏掉产品实际的 .exp-recent-del，无法验证移除。',
  'SIT-EXPERT-020': '重启后截图中“最近召唤”已显示新建专家，框架只提取到分区标题。',
  'SIT-EXPERT-021': '与 EXPERT-005 相同：专家构建师已选中但框架未识别，创建对话未继续。',
  'SIT-HOME-002': '用例开始前的连接器模式重置失败，业务提示未发送。',
  'SIT-HOME-016': '用例要求复述并追问 100/70/12，实际却发送“今天星期几”等其他提示词。',
  'SIT-HOME-023': '停止生成用例被错误路由成附件读取提示，未执行停止动作。',
  'SIT-HOME-027': '通用 UI handler 未真实验证空输入发送。',
  'SIT-HOME-029': '未点击提示词美化入口，无法验证改写。',
  'SIT-HOME-043': '应上传 >30MB 文件，实际使用小体积 qbot-pdf-summary.pdf 代替。',
  'SIT-HOME-044': '未构造总量 >80MB 的真实附件集合。',
  'SIT-HOME-045': '应上传不支持的 .bin，实际上传了受支持的 TXT。',
  'SIT-HOME-046': '使用文件注入而非真实拖拽事件，未验证拖拽等价性。',
  'SIT-HOME-047': '未执行双击标题和保存重命名。',
  'SIT-HOME-048': '未执行右键并验证菜单。',
  'SIT-HOME-049': '未执行删除和二次确认完整链路。',
  'SIT-HOME-050': '未执行标题搜索及 Esc 关闭链路。',
  'SIT-HOME-051': '未执行侧栏收起/展开和遮挡检测。',
  'SIT-HOME-056': '未可靠执行“删除其中一个附件”，不能把 Agent 未读附件归因于删除逻辑。',
  'SIT-SKILL-007': '切换禁用后菜单自动关闭，框架未重新打开即查找自动/手动项。',
  'SIT-SKILL-009': '未注入 SkillHub 未配置环境，不能验证对应产品化提示。',
  'SIT-SKILL-010': '未注入 401/403 响应，当前账号状态不满足场景。',
};

const blockerGroup = {
  'SIT-HOME-030': ['框架/会话前置', '缺少 --auth-session-file 与 --qbot-home，无法安全构造带当前对话摘要的反馈会话。'],
  'SIT-EXPERT-015': ['账号/数据态', '需要专家市场空数据账号；当前市场存在卡片。'],
  'SIT-EXPERT-019': ['账号/数据态', '没有稳定可用的产品经理业务专家。'],
  'SIT-EXPERT-022': ['账号/数据态', '没有稳定可用的业务专家用于身份切换。'],
  'SIT-SKILL-004': ['账号/数据态', 'Python runtime 候选技能显示“装不上”，没有可执行安装入口。'],
  'SIT-SKILL-005': ['账号/数据态', 'Node runtime 候选技能显示“装不上”，没有可执行安装入口。'],
  'SIT-SKILL-011': ['账号/数据态', '缺少 installStatus=rejected 的测试技能。'],
  'SIT-SKILL-012': ['账号/数据态', '缺少 auto_declared 测试技能。'],
  'SIT-SKILL-013': ['账号/数据态', '缺少 pending/materializing 测试技能。'],
  'SIT-SKILL-014': ['账号/数据态', '缺少有新版本的已安装技能。'],
  'SIT-SKILL-015': ['账号/数据态', '缺少历史版本/回退入口。'],
  'SIT-SKILL-018': ['账号/数据态', '场景要求零已安装技能，当前账号已有技能。'],
  'SIT-SKILL-026': ['账号/数据态', '需要至少 2 个可选择已安装技能，当前仅 1 个。'],
  'SIT-CONN-008': ['账号/数据态', '没有 unreachable 连接器和重试入口。'],
  'SIT-CONN-009': ['账号/数据态', '没有 needs_auth 连接器和授权弹窗。'],
  'SIT-CONN-014': ['账号/数据态', '需要无平台/自定义连接器的空账号。'],
  'SIT-CONN-018': ['账号/数据态', '手动菜单中没有 needs_auth/unreachable 条目。'],
  'SIT-SKILL-021': ['故障注入', '需要断网/恢复或等价的 E2E 安装失败注入。'],
  'SIT-SKILL-022': ['故障注入', '需要技能卸载失败注入。'],
  'SIT-CONN-012': ['故障注入', '需要连接器运行中健康度降级注入。'],
  'SIT-CONN-013': ['故障注入', '需要连接器目录请求失败注入。'],
  'SIT-ART-011': ['故障注入', '需要安全删除成果文件的受控注入。'],
  'SIT-ART-012': ['故障注入', '需要不可读权限 fixture。'],
  'SIT-ART-013': ['项目上下文', '缺少受控项目上下文和项目文件断言条件。'],
  'SIT-ART-014': ['项目上下文', '缺少受控项目上下文和项目会话关联条件。'],
};

const bugGroups = [
  ['BUG-01', 'P0', '附件在 UI 中已成功发送，但 Agent 收不到/读不到', '10 条：TXT、MD、DOCX、PDF、PPT、PNG、多图片、混合附件、Office 组合、代码/数据组合；Excel 单文件用例通过，说明不是所有附件统一失效。'],
  ['BUG-02', 'P1', '普通回复暴露内部运行/环境技术信息', '2 条：desktop-local、远端控制面、DEEPBANK_AUTH_PROVIDER/DEEPBANK_SURFACE 等实现细节出现在用户回复。'],
  ['BUG-03', 'P1', '文档附件最多 5 个的限制未执行', '1 条：6 个附件全部进入附件区，未看到超限提示。'],
  ['BUG-04', 'P1', '自建专家删除确认后仍保留', '1 条：创建、进入详情、删除确认链完整，删除后仍可见。'],
  ['BUG-05', 'P1', '成果文件存在但内嵌预览无法读取/切换不生效', '1 条：first.md 与 second.md 均实际生成，预览报路径不可读，点击第二项后标题仍为 first.md。'],
];

const esc = (s = '') => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const caseDirs = fs.readdirSync(path.join(runDir, 'cases')).sort();
const cases = [];
for (const dir of caseDirs) {
  const resultFile = path.join(runDir, 'cases', dir, 'case-result.json');
  if (!fs.existsSync(resultFile)) continue;
  const data = JSON.parse(fs.readFileSync(resultFile, 'utf8'));
  const id = data.case_id ?? data.id ?? data.case?.id ?? data.test_case_id ?? data.metadata?.case_id;
  const title = data.title ?? data.case?.title ?? data.name ?? dir;
  let review;
  if (data.status === 'passed') review = 'trusted_pass';
  else if (data.status === 'blocked') review = 'trusted_blocked';
  else if (bugCases.has(id)) review = 'trusted_bug';
  else if (caseIssueCases.has(id)) review = 'case_issue';
  else if (frameworkCases.has(id)) review = 'framework_untrusted';
  else throw new Error(`Unclassified case: ${id} (${data.status})`);
  const pngs = fs.readdirSync(path.dirname(resultFile)).filter(f => f.endsWith('.png'));
  const priority = /after-upload|after-reply|assertion|after-delete|first-preview|second-preview|close-missing|after-restart|after-start-create/;
  const selected = pngs.filter(f => priority.test(f)).slice(0, review === 'trusted_bug' ? 4 : 1);
  cases.push({id, title, rawStatus:data.status, review, reason: reason[id] ?? blockerGroup[id]?.[1] ?? '原始通过证据链完整。', blockerGroup:blockerGroup[id]?.[0] ?? null, rootBug:rootBug[id] ?? null, dir, screenshots:selected.map(f => path.join(runDir, 'cases', dir, f))});
}

const count = key => cases.filter(c => c.review === key).length;
const summary = {
  total: cases.length,
  raw: {passed:cases.filter(c=>c.rawStatus==='passed').length, failed:cases.filter(c=>c.rawStatus==='failed').length, blocked:cases.filter(c=>c.rawStatus==='blocked').length},
  manual: {trusted_pass:count('trusted_pass'), trusted_bug:count('trusted_bug'), trusted_blocked:count('trusted_blocked'), case_issue:count('case_issue'), framework_untrusted:count('framework_untrusted')},
  credible_evidence: cases.length - count('framework_untrusted'),
  root_bug_count: bugGroups.length,
};
if (summary.total !== 142 || summary.manual.trusted_pass !== 62 || summary.manual.trusted_bug !== 15 || summary.manual.trusted_blocked !== 25 || summary.manual.case_issue !== 16 || summary.manual.framework_untrusted !== 24) throw new Error(`Unexpected summary: ${JSON.stringify(summary)}`);

fs.mkdirSync(outDir, {recursive:true});
fs.writeFileSync(jsonPath, JSON.stringify({generatedAt:new Date().toISOString(), runDir, sourceRevision:'b08a67694a91dbedcb20a8870d6ba0d293d09fbf', summary, bugGroups:bugGroups.map(([id,priority,title,evidence])=>({id,priority,title,evidence})), cases}, null, 2));

const labels = {trusted_pass:'可信通过',trusted_bug:'可信 Bug',trusted_blocked:'可信阻塞',case_issue:'用例/断言问题',framework_untrusted:'框架不可信'};
const classes = {trusted_pass:'pass',trusted_bug:'bug',trusted_blocked:'blocked',case_issue:'caseissue',framework_untrusted:'framework'};
const caseRows = cases.map(c => `<tr data-kind="${c.review}"><td>${esc(c.id)}</td><td>${esc(c.title)}</td><td><span class="tag ${classes[c.review]}">${labels[c.review]}</span></td><td>${esc(c.rootBug ?? c.blockerGroup ?? '')}</td><td>${esc(c.reason)}</td><td>${c.screenshots.length ? `<button class="shot" data-images='${esc(JSON.stringify(c.screenshots))}'>查看 ${c.screenshots.length} 张</button>` : '—'}</td></tr>`).join('\n');
const bugRows = bugGroups.map(([id,p,t,e]) => `<tr><td>${id}</td><td><span class="tag ${p==='P0'?'bug':'blocked'}">${p}</span></td><td>${esc(t)}</td><td>${esc(e)}</td></tr>`).join('\n');

const html = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>QBot 142 条全量测试人工复核报告</title><style>
:root{--bg:#f5f7fb;--card:#fff;--text:#172033;--muted:#667085;--line:#e4e8f0;--pass:#137a4b;--bug:#c62f2f;--block:#b26700;--case:#5d50b8;--fw:#586174}*{box-sizing:border-box}body{margin:0;background:var(--bg);font:14px/1.55 -apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC",sans-serif;color:var(--text)}main{max-width:1480px;margin:auto;padding:28px}.hero,.panel{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:22px;margin-bottom:18px;box-shadow:0 4px 18px #22304a0b}h1{font-size:28px;margin:0 0 8px}h2{font-size:20px;margin:0 0 14px}.muted{color:var(--muted)}.grid{display:grid;grid-template-columns:repeat(5,minmax(150px,1fr));gap:12px}.metric{padding:16px;border-radius:12px;background:#f8fafc;border:1px solid var(--line)}.metric b{display:block;font-size:26px}.tag{display:inline-block;padding:3px 9px;border-radius:999px;color:#fff;white-space:nowrap}.pass{background:var(--pass)}.bug{background:var(--bug)}.blocked{background:var(--block)}.caseissue{background:var(--case)}.framework{background:var(--fw)}table{width:100%;border-collapse:collapse}th,td{text-align:left;vertical-align:top;padding:10px;border-bottom:1px solid var(--line)}th{position:sticky;top:0;background:#f8fafc;z-index:2}.filters{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px}.filters button,.shot{border:1px solid var(--line);background:#fff;border-radius:8px;padding:7px 10px;cursor:pointer}.filters button.active{background:#172033;color:#fff}.note{padding:12px;border-left:4px solid var(--block);background:#fff8ec;border-radius:8px;margin:10px 0}.modal{position:fixed;inset:0;background:#070b12ee;display:none;z-index:20;align-items:center;justify-content:center}.modal.open{display:flex}.modal img{max-width:95vw;max-height:92vh;object-fit:contain}.close,.prev,.next,.full{position:fixed;color:#fff;background:#1b2332cc;border:1px solid #ffffff55;border-radius:9px;font-size:22px;padding:8px 13px;cursor:pointer}.close{right:18px;top:14px}.full{right:72px;top:14px;font-size:14px}.prev{left:18px;top:48%}.next{right:18px;top:48%}.caption{position:fixed;left:18px;bottom:12px;color:#fff;background:#0009;padding:7px 10px;border-radius:7px;max-width:85vw;word-break:break-all}@media(max-width:900px){main{padding:12px}.grid{grid-template-columns:1fr 1fr}.tablewrap{overflow:auto}th{position:static}}
</style></head><body><main><section class="hero"><h1>QBot 最新 142 条全量测试：人工证据复核报告</h1><div class="muted">执行：2026-07-11 13:10–16:30（Asia/Shanghai）｜deepbankV2 main：b08a6769｜M3｜本地 dev + Lingxi 登录｜人工复核以截图、步骤、断言和运行产物交叉判断</div><div class="note"><b>结论：</b>原始结果为 62 通过 / 55 失败 / 25 阻塞。人工复核后，确认 62 条可信通过、15 条可信 Bug 证据（聚合 5 个 Bug）、25 条可信阻塞；16 条属于用例/断言问题，24 条属于框架执行不可信。可信证据覆盖 118/142（83.1%），但其中 16 条不能作为产品通过或失败。</div><div class="grid"><div class="metric"><span>可信通过</span><b style="color:var(--pass)">62</b></div><div class="metric"><span>可信 Bug case</span><b style="color:var(--bug)">15</b></div><div class="metric"><span>可信阻塞</span><b style="color:var(--block)">25</b></div><div class="metric"><span>用例/断言问题</span><b style="color:var(--case)">16</b></div><div class="metric"><span>框架不可信</span><b style="color:var(--fw)">24</b></div></div></section>
<section class="panel"><h2>确认的 5 个 Bug 方向</h2><div class="tablewrap"><table><thead><tr><th>编号</th><th>优先级</th><th>结论</th><th>证据范围</th></tr></thead><tbody>${bugRows}</tbody></table></div><div class="note">ART-020 截图还出现同名 HTML 成果重复两条，但该用例没有完成关闭/重开动作，暂列“待单独复现观察”，不计入 5 个确认 Bug。</div></section>
<section class="panel"><h2>阻塞原因汇总</h2><p>25 条阻塞均有明确原因：账号/数据态 16 条、故障注入 6 条、项目上下文 2 条、框架/会话前置 1 条。它们是“可信阻塞”，不代表产品通过或失败。</p></section>
<section class="panel"><h2>142 条逐条人工结论</h2><div class="filters"><button class="active" data-filter="all">全部 142</button><button data-filter="trusted_pass">可信通过 62</button><button data-filter="trusted_bug">可信 Bug 15</button><button data-filter="trusted_blocked">可信阻塞 25</button><button data-filter="case_issue">用例/断言 16</button><button data-filter="framework_untrusted">框架不可信 24</button></div><div class="tablewrap"><table><thead><tr><th>Case</th><th>标题</th><th>人工结论</th><th>归因</th><th>详细理由</th><th>截图</th></tr></thead><tbody>${caseRows}</tbody></table></div></section>
</main><div class="modal" id="modal"><button class="close" title="Esc">×</button><button class="full" title="F">全屏</button><button class="prev" title="←">‹</button><img alt="证据截图"><button class="next" title="→">›</button><div class="caption"></div></div><script>
const rows=[...document.querySelectorAll('tbody tr[data-kind]')];document.querySelectorAll('.filters button').forEach(b=>b.onclick=()=>{document.querySelectorAll('.filters button').forEach(x=>x.classList.remove('active'));b.classList.add('active');const f=b.dataset.filter;rows.forEach(r=>r.style.display=f==='all'||r.dataset.kind===f?'':'none')});
const modal=document.querySelector('#modal'),img=modal.querySelector('img'),cap=modal.querySelector('.caption');let images=[],index=0;function show(){img.src='file://'+encodeURI(images[index]);cap.textContent=(index+1)+' / '+images.length+'  '+images[index]}function close(){modal.classList.remove('open');img.src=''}function move(d){if(!images.length)return;index=(index+d+images.length)%images.length;show()}document.querySelectorAll('.shot').forEach(b=>b.onclick=()=>{images=JSON.parse(b.dataset.images);index=0;modal.classList.add('open');show()});modal.querySelector('.close').onclick=close;modal.querySelector('.prev').onclick=()=>move(-1);modal.querySelector('.next').onclick=()=>move(1);modal.querySelector('.full').onclick=()=>{if(!document.fullscreenElement)modal.requestFullscreen();else document.exitFullscreen()};modal.onclick=e=>{if(e.target===modal)close()};document.addEventListener('keydown',e=>{if(!modal.classList.contains('open'))return;if(e.key==='Escape')close();if(e.key==='ArrowLeft')move(-1);if(e.key==='ArrowRight')move(1);if(e.key.toLowerCase()==='f'){if(!document.fullscreenElement)modal.requestFullscreen();else document.exitFullscreen()}});
</script></body></html>`;
fs.writeFileSync(htmlPath, html);
console.log(JSON.stringify({htmlPath,jsonPath,summary}, null, 2));
