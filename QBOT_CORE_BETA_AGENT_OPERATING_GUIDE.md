# QBot Core Beta Agent 操作指南

适用对象：后续接手 `/Users/qifu/Documents/QbotTestAgent` 的 QA Agent。

规范性执行合同以
`/Users/qifu/Documents/QbotTestAgent/QBOT_AUTOMATION_FRAMEWORK.md` 为准。
本指南记录当前 70 条生产灰度发布门禁、160 条全量正常功能回归，以及本轮
QWork 日常回归 83 个顶层 / 144 个叶子 Case 的接手状态、启动顺序和禁止事项。

## 1. 当前状态

- 用户已明确要求启动 QWork 日常回归。本轮必须先完成框架基线提交推送和精确
  `READY` pretest，再启动唯一串行 runner；不得沿用先前暂停状态。
- 产品仓库 `/Users/qifu/Documents/deepbankV2` 只读，禁止修改。
- 产品设计基线：`origin/release/0.1`，
  commit `686b862ea9553215c2563d87db8339096acecb9d`，版本 `0.1.1`。
- 当前目标 lane：SIT。冻结发布身份为 360Teams `5.5.10` build `2119081439`、
  QWork `0.1.2-sit.7`、UI commit `4ddfa218`、backend
  `sit-health-ae3b6cafbc5ed123`、control plane
  `https://deepbank-control-sit.sandbox.deepbank.daikuan.qihoo.net`、模型 M3；pretest
  仍必须从当前受管宿主重新读回并精确匹配全部 release inputs，不能只信本文。
- 当前没有有效 runner，也没有有效 monitor；受管 360Teams PID `20115`、CDP
  `http://127.0.0.1:53155` 仅是待 pretest 的当前宿主候选，不得继承旧 runner PID、
  旧输出目录或旧监控。

本轮目标 Casebook：

```text
/Users/qifu/Documents/QbotTestAgent/PRD/QWork日常回归自动化Casebook_83条_2026-08-12.xlsx
Sheet: 日常回归
SHA-256: 8a62aac20e5abad4dd09bed3717e9f0665cf7285d436f22da8a1bc03f8856111
```

- 顶层 83：70 个 `compound` 父 Case + 13 个独立 `SIT-*` Case。
- 叶子 144：全部必须有独立目录、结果、manifest、截图、日志和 SHA。
- 静态能力审计必须为顶层 `83/83`、叶子 `144/144`、
  `strict_controller_required=0`、`unsupported_runtime=0`。
- 静态协议预检必须展开复合父 Case 并验证 Skill、Expert、MCP 上游均在使用前
  由本轮更早叶子建立；缺失或逆序依赖必须在 Case 0 前失败。
- `QW-ENTRY-002` 固定为 `BETA-INIT-004 + QWD-ENTRY-002`。后者是独立原生
  新任务 Auto/能力/附件/草稿隔离 driver，不依赖 Skill 安装账本。
- `QW-WS-001` 固定为独立原生 `QWD-WS-001`。driver 必须注册本 Case 唯一 A/B
  工作空间，从可见菜单按 `.wspick-path` 精确点击，分别读取标记并证明不同 taskId
  与固定 cwd；已建 A 任务只读，重开与 `listSessions` 读回一致，最后只定向删除
  A/B。不得再使用语义不足且曾按 `.first()` 误点“新建工作空间”的旧
  `SIT-HOME-052` 叶子替代。
- 全程只有一个 runner、一个受管 360Teams 宿主；外层 Case 和复合叶子都串行。
- legacy 多轮合同已从运行时 `buildConversationTurns()` 同源生成，并要求每轮都有
  非空 Oracle：`SIT-HOME-016=4`、`SIT-HOME-053=11`、
  `SIT-HOME-058=2`、`SIT-HOME-060=2`、`SIT-EXPERT-022=2`。
- `SIT-HOME-016` 的相关性按轮次匹配对应数字 Oracle：首轮 `100/70/12`，
  报名追问 `100 人`，到场追问 `70 人 + 70%`，成交追问 `12 单 + 约 17.1%`。
  禁止后续轮继续要求首轮全部数字或其他轮比例；数字或比例错配仍必须失败。

首轮历史框架问题保留在不可变目录
`teams360-automation/output/20260812165500_uat-qwork-daily83_teams360-5.3.0-2119080776_qwork-0.1.1-rc.4_M3_serial_framework-93b0958_casebook-c0119f4`：
旧映射把 `QW-ENTRY-002` 绑定到依赖 `deep_use[0]` 的 `BETA-SKILL-011`，而本轮
Skill 样本在第 40 个父 Case 后才建立，导致运行中抛异常并留下不完整 manifest。
该目录只用于历史取证；修复后必须以新 SHA、新 commit、新 pretest 和新目录从
1/83 全量重跑。

本轮 SIT 冻结批次保留在不可变目录
`teams360-automation/output/20260813133654_sit-qwork-daily83_teams360-5.3.1-2119081159_qwork-0.1.2-rc.100_M3_serial_framework-7934570_casebook-979e95b`：
已可信完成 `26/83`，raw 为 `passed=18/failed=7/blocked=1`。第 27 条
`QW-WS-001` 同时暴露 testcase 覆盖不足和 runner 误点/弹窗清理问题，旧 runner
PID `19835` 已退出；后续 56 条没有执行。该目录永久冻结，不得续写。修复提交推送、
新 SHA 和 SIT `READY` 后，必须在新不可变目录从 `1/83` 串行全量重跑，
`inherited=0`、`synthetic=0`。

更新 Teams/QWork 后的最新冻结批次保留在不可变目录
`teams360-automation/output/20260814171810_sit-qwork-daily83_teams360-5.5.10-2119081439_qwork-0.1.2-sit.7_M3_serial_framework-2de27bf_casebook-8a62aac`：
已可信完成 `31/83`，raw 为 `passed=15/failed=15/blocked=1`。第 32 条
`QW-EXPERT-004` 的叶子 `SIT-EXPERT-006` 因框架仅匹配旧文案“手动填表创建”，
未使用产品已经提供的 `data-testid="expert-create-manual"`，在新版“高级手动创建”
入口处形成 framework issue；第 32 条未计入 completed，后续 51 条未执行。该目录
永久冻结；修复、提交推送和新 `READY` 后必须在新目录从 `1/83` 全量重跑。

修复专家入口定位后的首次新批次保留在不可变目录
`teams360-automation/output/20260814192300_sit-qwork-daily83_teams360-5.5.10-2119081439_qwork-0.1.2-sit.7_M3_serial_framework-bb6d6af_casebook-8a62aac`：
第 1 条 `QW-ENTRY-001/BETA-INIT-001` 在 `completed=0` 时触发 framework issue。
上一冻结批次留下“创建专家”路径选择弹窗，初始化进入系统设置前未关闭该安全弹窗，
导致真实设置入口被遮挡并在 5 秒点击窗口内超时。该目录永久冻结；框架必须为这一
精确弹窗保存安全关闭前后证据并确认 hidden，之后再次从 `1/83` 新目录全量重跑。

首次接入创建专家残留弹窗清理后的批次保留在不可变目录
`teams360-automation/output/20260814192707_sit-qwork-daily83_teams360-5.5.10-2119081439_qwork-0.1.2-sit.7_M3_serial_framework-f4eb326_casebook-8a62aac`：
第 1 条 `QW-ENTRY-001/BETA-INIT-001` 在 `completed=0` 时触发 framework issue。
框架按精确可访问名称定位到关闭图标，但该按钮没有 `innerText`，动作读回为空后被
误拒绝。该目录永久冻结；修复必须支持 `aria-label/title` 动作读回并保留精确安全
判定，之后完成全检、提交推送和新 `READY`，再从 `1/83` 新目录全量重跑。

修复空文本关闭图标后启动的批次保留在不可变目录
`teams360-automation/output/20260814193207_sit-qwork-daily83_teams360-5.5.10-2119081439_qwork-0.1.2-sit.7_M3_serial_framework-0dec0f6_casebook-8a62aac`：
已完成 `27/83`；第 28 条 `QW-WS-003` 的首叶子 `BETA-SEC-002` 已完整证明
同级目录、父目录、symlink 真实目标和 `../` 路径穿越全部 fail-closed 且零秘密
标记泄露，但框架仅对旧 `SIT-WORKSPACE-001` 配置了 Case-aware 安全 Oracle，
导致父目录、symlink 和路径穿越三段正确拒绝被通用“回复相关性”误判为产品 Bug。
runner 已在第二叶子执行中停止，PID `76558` 已退出；该目录永久冻结，不得续写。
修复必须让 `BETA-SEC-002` 与 `SIT-WORKSPACE-001` 共用精确边界拒绝语义，使用
本次四段原始回复与泄露/无关拒绝负例强化 invariant，完成全检、提交推送和新
`READY` 后再从 `1/83` 新目录全量重跑。

修复目录边界安全 Oracle 后启动的批次保留在不可变目录
`teams360-automation/output/20260814211300_sit-qwork-daily83_teams360-5.5.10-2119081439_qwork-0.1.2-sit.7_M3_serial_framework-69a86c7_casebook-8a62aac`：
已完成 `31/83`，raw 为 `passed=15/failed=16/blocked=0`。第 32 条
`QW-EXPERT-004` 的叶子 `SIT-EXPERT-006` 已打开新版手动创建表单、填满必填字段，
并读回稳定 `[data-testid="expert-create-submit"]`，但 runner 仍只按旧文案“创建”
查找提交按钮，未接受当前“保存草稿”，误报 `automation_error` 并停止；第三叶子
`SIT-EXPERT-009` 及后续 51 条未执行。该目录永久冻结。修复必须优先稳定 testid，
fallback 仅精确接受“创建/保存草稿”，同时拒绝发布、取消等其他动作；全检、提交
推送和新 `READY` 后必须在新目录从 `1/83` 全量重跑。

修复专家草稿提交定位后启动的批次保留在不可变目录
`teams360-automation/output/20260814231034_sit-qwork-daily83_teams360-5.5.10-2119081439_qwork-0.1.2-sit.7_M3_serial_framework-fefdef8_casebook-8a62aac`：
第 1 条 `QW-ENTRY-001` 完成；第 2 条 `QW-ENTRY-002` 的叶子
`QWD-ENTRY-002` 已真实选择 Skill `source-verification`，随后精确点击 Connector
`mcphub:risk`，但产品公开 `selectedConnectors` 仍为空。框架已保存点击回执、失败
截图、空 task、零消息、send count 不变、`pre-send-capability-failure.json` 和三份
`evidence_valid=true/oracle_valid=false` 专项读回；manifest 校验器却漏识别
`manual_connector_selection` stage，拒绝 7 个受校验 N/A 角色并误升级为
`automation_error`。该目录永久冻结；修复必须统一证据生成、manifest 和可信复核的
stage 集合，以本次真实结构强化 invariant，完成全检、提交推送和新 `READY` 后，
从 `1/83` 在新目录全量重跑并将该产品失败保持为可继续的 `bug`。

修复 Connector 发送前负向证据校验后启动的批次保留在不可变目录
`teams360-automation/output/20260814233300_sit-qwork-daily83_teams360-5.5.10-2119081439_qwork-0.1.2-sit.7_M3_serial_framework-fdfd2be_casebook-8a62aac`：
已完成 `6/83`，raw 为 `passed=4/failed=2/blocked=0`。第 7 条
`QW-CHAT-004` 的首叶子 `BETA-CHAT-005` 已完整通过；第二叶子
`BETA-PERF-003` 已确认发送长文本请求并连续采样 `240973ms/299` 次，产品全程仍在
生成，已出现 `4131` 字可归属正文，`performance-metrics.json` 完整且未复现自动跟随
漂移。框架在保存 #793 超时截图之前先写入 `reply-completion.json`，导致
`terminal_screenshot_sha256` 为空，manifest 将证据完整的产品超时误判为
`reply_incomplete/automation_error`；第三叶子 `SIT-ISSUE-793` 和后续 76 个父 Case
未执行。该目录永久冻结。修复必须在材料化回复前保存 `issue-793-after-timeout`，把
部分正文超时写为可信产品 Bug，再受管停止残留任务；只有超时证据或停止清理失败才
硬停止。完成 invariant、双框架全检、提交推送和新 `READY` 后，必须在新目录从
`1/83` 全量重跑。

修复 #793 超时证据顺序后启动的批次保留在不可变目录
`teams360-automation/output/20260815001100_sit-qwork-daily83_teams360-5.5.10-2119081439_qwork-0.1.2-sit.7_M3_serial_framework-dda57b3_casebook-8a62aac`：
已完成 `31/83`，raw 为 `passed=17/failed=14/blocked=0`。第 32 条
`QW-EXPERT-004` 的前两个叶子已完成；第三个叶子 `SIT-EXPERT-009` 开始时，
前一叶子留在当前发布包的“专家构建/专家工作台”。框架只重复点击已激活的
侧栏“专家·技能”，未点击产品已提供的稳定
`[data-testid="expert-builder-back"]`，随后误报缺少 `[data-testid="create-expert-top"]`，
异常路径的 manifest 缺失 `action_receipt/public_state_readback/cleanup_readback/product_action_trace`
并硬停止。该目录永久冻结；修复必须让后续专家/技能入口先通过稳定返回控件退出
构建页，完成 invariant、双框架全检、提交推送和新 `READY` 后，在新目录从
`1/83` 全量重跑。

首次接入专家构建页返回逻辑后的批次保留在不可变目录
`teams360-automation/output/20260815020900_sit-qwork-daily83_teams360-5.5.10-2119081439_qwork-0.1.2-sit.7_M3_serial_framework-7fcd0d7_casebook-8a62aac`：
已完成 `32/83`，raw 为 `passed=16/failed=16/blocked=0`。第 32 条
`QW-EXPERT-004` 三个叶子均完整落盘，证明 legacy 专家入口已经能从构建页返回；
第 33 条 `QW-EXPERT-005` 的首叶子 `BETA-EXPERT-003` 仍停在专家构建页。
根因是 Core Beta v2 `executeCoreBetaExpertCase()` 直接点击侧栏并立即断言
`[data-testid="experts-view"]`，绕过了只接入 legacy `openExpertsPage/openSkillsPage`
的恢复逻辑，因此在进入 Codex runtime 切换前抛出 `automation_error`，manifest
缺少 15 个执行角色，后续 4 个叶子和 50 个父 Case 未执行。该目录永久冻结；修复必须
让 Core Beta Expert、Core Beta Skill 和日常回归原生 Expert 的所有直接入口共享
构建页返回逻辑，以 invariant 禁止旁路。全检、提交推送和新 `READY` 后，仍须在新
目录从 `1/83` 全量串行重跑，`inherited=0`、`synthetic=0`。

修复全部专家构建页返回路径后启动的批次保留在不可变目录
`teams360-automation/output/20260815041400_sit-qwork-daily83_teams360-5.5.10-2119081439_qwork-0.1.2-sit.7_M3_serial_framework-80404d8_casebook-8a62aac`：
已完成 `6/83`，raw 为 `passed=2/failed=4/blocked=0`，全部已完成父 Case 和叶子
manifest 均完整。第 6 条 `QW-CHAT-003` 的叶子 `SIT-HOME-062` 收到完整真实回复，
明确说明缺少投入和收益、无法计算唯一 ROI，并给出
`ROI 的公式是：ROI =（带来收入 − 总投入）÷ 总投入`；其余 ROI 边界读回均为
`true`，但两套 runner 的公式正则既只兼容“ROI 公式是”、漏掉助词“的”，又不接受
“带来收入”这一自然回报操作数，因此把 `formula=false` 误报为产品 Bug。runner 在
第 7 条长回复 Case 执行中受管停止，PID
`50795` 及 npm 父进程均已退出，360Teams 宿主 PID `20115` 保留。该目录永久冻结，
包括第 7 条未完成材料在内均不得续写；修复必须同时覆盖 v2 与 legacy Oracle，以本轮
完整真实回复强化 invariant，并保留缺公式、操作数颠倒、伪造金额和借用旧事实负例。
完成双框架全检、提交推送和新 `READY` 后，必须在新目录从 `1/83` 全量串行重跑。

最新冻结的旧 55 条 scoped 批次：

```text
/Users/qifu/Documents/QbotTestAgent/teams360-automation/output/20260810165050_uat-core-beta74-scoped55_teams360-5.3.0-2119080776_qwork-0.1.1-rc.2_M3_serial_framework-af1a4a7
```

该目录及此前所有 55/74 scoped 目录只作为历史证据保留，禁止续写、继承或作为
发布结论。旧 55 条流程长期暴露过截图无界等待、回复/附件/成果 Oracle 误判、
Skill 清理超时对账、MCP 负向证据被标无效、产品 home 选择错误等框架问题。
后续修复不能抹去这些历史 issue，但也不得继续围绕旧 55 条启动新发布批次。

## 2. 当前正式 Casebook

生产灰度发布与全量功能回归唯一入口：

```text
/Users/qifu/Documents/QbotTestAgent/PRD/QBot生产灰度与全量功能回归Casebook_160条_2026-08-11.xlsx
```

- Sheet `生产灰度门禁Case`：70 条；70/70 executable、dispatchable、directly runnable。
- Sheet `全量功能回归Case`：160 条；160/160 executable、dispatchable、directly runnable。
- 160 条的前 70 条 ID、顺序和合同内容必须与门禁 Sheet 完全一致，后 90 条为正常功能增量。
- SHA-256：`1621632773aa4d8c958bc97fea35311ef69cc5574704009616a223c058b0a3e4`
- `strict_controller_required=0`
- `unsupported_runtime=0`
- 两个 Sheet 的 Case 间执行永久串行，有效 parallel/pipeline 均为 1

能力构成：

- 70 条门禁：60 条原生/public-state、1 条原生 IME 选项、9 条经过语义复核的 legacy executor。
- 160 条全量：上述 70 条 + 90 条经过语义复核的正常功能 legacy executor；合计 60/1/99。

新版已删除网络异常、connection-cache fault、切换账号、第二账号授权、受保护部署
和纯故障注入等低频或当前框架不能无条件真实执行的场景。全量增量明确排除
`SIT-HOME-025`、`SIT-TASK-RECOVER-001`、`SIT-ISSUE-800`、`SIT-CONN-008`、
`SIT-TEAMS-DOC-001`、`SIT-RUNTIME-RECOVER-001` 和 `SIT-FILE-NEW-001`。
`BETA-INIT-005` 属于历史网络故障注入，不得拼回门禁。当前门禁初始化固定为
`BETA-INIT-001~004`。

本轮进一步从两个 Sheet 同步剔除 `BETA-REC-001`、`BETA-REC-002`、
`BETA-REC-004`、`BETA-TASK-003`、`BETA-EXPERT-016`，这些 Case
不得进入70条门禁或160条全量回归。门禁以 `SIT-SKILL-007`、
`SIT-HOME-002`、`SIT-HOME-012`、`SIT-HOME-013`、`SIT-HOME-014`
五条高频正常功能补齐；全量功能池新增 `SIT-HOME-028`、`SIT-HOME-046`、
`SIT-HOME-051`、`SIT-CONN-005`、`SIT-HOME-048`，因此总量仍为70/160。

新增或重写的关键回归：

- `BETA-TASK-008`：空闲态第一次物理 Arrow 只建立边界握手，第二次才进入历史；同时覆盖未发送草稿恢复、任务隔离和重开持久化。
- `BETA-ROUTE-001`：模型菜单按当前 SDK family/protocol 过滤。
- `BETA-EXPERT-007`：单账号串行发布研究、数据、交付三类本轮专家。
- `BETA-EXPERT-001`：发布记录严格等于 `owned=true` 专家集合；从干净草稿发送确定性短提示，证明新 taskId 以及 expert/version/release/最近召唤 identity 全链一致，禁止继承上一条 Case 的 taskId。
- `BETA-ART-001`：受管 HTML 网页预览、分享入口和宿主隔离。

Casebook 的设计依据包括 2026-08-03 至 2026-08-11 直接合入
`origin/release/0.1` 的 MR、最新产品源码和历史 Casebook 收敛审计。MR 映射、
删除清单、覆盖矩阵、执行配置和发布准入均在工作簿独立 Sheet 中。

## 3. 发布级门禁

单轮全绿不授权生产。候选身份必须至少完成 1 轮 160/160 全量正常功能可信全绿，
并在同一冻结发布身份下累计连续 5 轮 70/70 门禁可信全绿；160 条轮次因为前 70 条
合同完全相同，可计为其中 1 轮。另需至少一个候选轮次完成不少于 100 个任务、
3 次受管重启的 soak，三项全部满足才可进入 1%-5% 受控生产灰度。

每轮必须同时满足：

- `total=completed=executed=unique_case_count=trusted_pass=70`
- `inherited=0`
- `synthetic=0`
- `trusted_bug/trusted_fail/trusted_blocked/framework_issue/testcase_issue=0`
- manifest、动作收据、任务归属和清理证据全部完整，missing/invalid=0
- 单 runner、Case 间串行、发布身份全程不漂移
- flaky=0

160 条全量轮次对应要求把上述计数从 70 改为 160。后 90 条不能拆算为额外门禁
轮次，160 批次不完整、非可信全绿或发布身份漂移时，既不满足全量回归，也不能把
其前缀计入连续门禁。

任一轮出现非 pass、阻塞、框架问题、Case 问题、证据缺失或身份漂移，该轮不计入
连续全绿，连续计数归零。`GO_CONTROLLED_GRAY` 只允许受控灰度，不等于 GA。

## 4. 接手只读确认

用户恢复测试后，先执行：

```bash
cd /Users/qifu/Documents/QbotTestAgent
git fetch origin main
git rev-parse HEAD
git rev-parse origin/main
git status --short --untracked-files=no
pgrep -af 'ui-agent-casebook-run|casebook-runner|core-beta.*run' || true
find "$HOME/.codex/automations" -maxdepth 2 -type f -name 'automation.toml' -print 2>/dev/null || true
```

只有以下条件同时成立才能继续：

- `HEAD == origin/main`
- tracked dirty=false
- 正式 Casebook 已被 Git 跟踪且 SHA 精确一致
- 没有旧 runner
- 没有指向旧目录的 monitor

然后运行：

```bash
npm run check
npm --prefix teams360-automation run check

npm run core-beta:capability-audit -- \
  --casebook PRD/QBot生产灰度与全量功能回归Casebook_160条_2026-08-11.xlsx \
  --sheet 生产灰度门禁Case \
  --profile mandatory \
  --out outputs/<new-gate70-capability-audit-dir>

npm run core-beta:capability-audit -- \
  --casebook PRD/QBot生产灰度与全量功能回归Casebook_160条_2026-08-11.xlsx \
  --sheet 全量功能回归Case \
  --profile mandatory \
  --out outputs/<new-full160-capability-audit-dir>
```

两个能力审计必须分别为 70/70 和 160/160 executable、dispatchable、
`directly_runnable_without_controller=70/160`、`strict_controller_required=0`、
`unsupported_runtime=0`。

## 5. Native IME

`BETA-CHAT-010` 必须使用 `--native-ime-command` 或
`QBOT_CORE_BETA_NATIVE_IME_COMMAND`。该命令有两种模式：

1. pretest 设置 `QBOT_CORE_BETA_IME_PROBE=1` 时，不得产生任何输入，必须输出：

   ```json
   {"schema_version":"qbot-core-beta-native-ime-probe/v1","ok":true,"non_mutating":true,"accessibility_permission":true,"input_source_ready":true}
   ```

2. runner 模式读取 `QBOT_CORE_BETA_IME_TEXT`、
   `QBOT_CORE_BETA_IME_TEXT_BASE64` 和 `QBOT_CORE_BETA_CASE_ID`，通过 macOS
   真实输入源完成组合输入和候选确认。禁止 DOM 合成 composition 事件。

Teams lane 的 runner 必须先激活受管 `360Teams` 并通过 System Events 读回
`frontmost=360Teams`，再把当前 QWork WebView `bringToFront`、真实点击并聚焦
Composer；读回 DOM 前台焦点成立后才能执行同一命令。宿主激活必须早于 WebView
和 Composer 聚焦，禁止颠倒顺序。命令返回 0 但零文本、零 composition 事件属于
framework issue；已产生真实事件但文本 Oracle 失败属于可继续批次的产品 Bug，必须
保存零发送负向证据，禁止发送错误文本或盲目重放命令。

当前 70/160 已删除全部需要 `managed_teams_restart` 或
`managed_runtime_restart` 的正式 Case。pretest 不得要求 `--restart-command`；
受管重启只属于独立 soak 或历史 74/184 回归，不得重新拼入当前 Casebook。

## 6. 正式 pretest

用户恢复测试、真实版本身份已经重新读取后，创建新的不可变 pretest 目录：

```bash
CASEBOOK="$PWD/PRD/QBot生产灰度与全量功能回归Casebook_160条_2026-08-11.xlsx"

npm run core-beta:pretest -- \
  --casebook "$CASEBOOK" \
  --sheet 生产灰度门禁Case \
  --profile mandatory \
  --lane teams \
  --out "$PWD/outputs/<new-immutable-pretest-dir>" \
  --expected-count 70 \
  --expected-sha256 1621632773aa4d8c958bc97fea35311ef69cc5574704009616a223c058b0a3e4 \
  --expected-teams-version "<actual-teams-version>" \
  --expected-teams-build "<actual-teams-build>" \
  --expected-qwork-version "<actual-qwork-version>" \
  --expected-control-plane-origin "<exact-uat-origin>" \
  --native-ime-command "<managed-native-ime-command>" \
  --production-gate true \
  --backend-version "<backend-release-id>" \
  --prompt-policy-version "<prompt-policy-id>" \
  --feature-flags-hash "<feature-flags-sha256>"
```

只接受 `READY`。`READY_SCOPED`、Case 数少于 70、缺少 IME probe、身份字段缺失、
tracked dirty 或 runner 已存在都不得启动正式批次。
pretest 不启动/重启 Teams、不打开 QWork、不发送消息，也不生成 synthetic Case。
全量 160 条必须另行以同一 Casebook、`--sheet 全量功能回归Case`、
`--expected-count 160` 和同一 SHA 执行 pretest；同样只接受 `READY`。它们与本轮
日常回归是不同测试合同，不能用 70/160 的 pretest 替代本轮 83 条 pretest。

本轮日常回归使用 `日常回归` Sheet、`--expected-count 83` 和 SHA
`8a62aac20e5abad4dd09bed3717e9f0665cf7285d436f22da8a1bc03f8856111`；其余
Teams/QWork/SIT 发布身份参数必须从当前受管宿主重新读取。只有精确 `READY`
授权 runner，任何 tracked dirty、身份漂移、旧 runner 或 Casebook 漂移都必须
在 Case 0 前失败。

日常回归仍传 `--production-gate true` 来冻结全部 release inputs 并启用严格证据
门禁，但不承担 70/160 专属的八大生产风险域完整覆盖。框架只能对完整有序的 83 个
顶层 ID、前 70 个 `compound` 和后 13 个独立 Case 识别该合同；任何缺失、重排或
结构漂移必须恢复生产风险域检查并 fail-closed。83 条 `READY` 仅授权日常回归，
不能作为 70/160 生产灰度放行证据。

## 7. 启动唯一 runner

只有第 6 节精确 pretest 为 `READY` 后才允许：

```bash
PLAN="$(mktemp /tmp/qbot-gray70-plan.XXXXXX)"
python3 skills/qbot-execute-automation-tests/scripts/casebook_io.py export-cases \
  --casebook "$CASEBOOK" \
  --sheet 生产灰度门禁Case \
  --profile mandatory \
  --output "$PLAN"
CASE_IDS="$(python3 -c 'import json,sys; print(",".join(x["id"] for x in json.load(open(sys.argv[1]))["cases"]))' "$PLAN")"

OUT="$PWD/teams360-automation/output/<new-immutable-gray70-run-dir>"
npm --prefix teams360-automation run casebook -- \
  --casebook "$CASEBOOK" \
  --sheet 生产灰度门禁Case \
  --profile mandatory \
  --case "$CASE_IDS" \
  --model-tier M3 \
  --out "$OUT" \
  --timeout-ms 600000 \
  --single-host-pipeline 1 \
  --native-ime-command "<same-command-from-ready-pretest>" \
  --production-gate true \
  --control-plane-url "<exact-uat-origin>" \
  --backend-version "<backend-release-id>" \
  --prompt-policy-version "<prompt-policy-id>" \
  --feature-flags-hash "<feature-flags-sha256>" \
  --qwork-ui-git-commit "<qwork-ui-commit>" \
  --qwork-build-id "<qwork-build-id>" \
  --qwork-release-manifest-sha256 "<manifest-sha256>"
```

不得传 `--restart-command`，不得传 fixture controller，不得使用 scoped execution，
不得排除任何 Case，不得写入旧输出目录。
完整 160 条使用其自己的 `READY` pretest，将导出与 runner 的 Sheet 都改为
`全量功能回归Case`，输出目录改为新的 `full160` 不可变目录；不得与 70 条 runner
并发，也不得在两个 Sheet 之间继承结果。

日常回归启动时必须从 `日常回归` 导出全部 83 个顶层 Case ID，runner 使用同一
Casebook、同一 Sheet、同一冻结身份和新不可变目录。不得把 144 个叶子展开为外层
并发任务；复合父 Case 由 v2 runner 内部按声明顺序执行叶子。有效
`--single-host-pipeline` 和 `--parallel` 均为 1。

## 8. 执行与自愈

- Core Beta v2 Case 间永久串行；`BETA-CHAT-008` 的 20 任务是单 Case 内部合同。
- Agent 澄清/推荐选项由框架点击精确“跳过/跳过（用默认）”并留证，不使用
  Computer Use。
- `BETA-INIT-004` 清空会话前，框架必须枚举所有公开会话、仅停止真实 running
  会话并连续 3 次读回全部 idle。首次真实 UI 清空若明确返回 `active-session`，只允许
  再次完成 idle 对账后重试一次真实 UI 清空；两次点击都必须保留独立确认弹窗、截图和
  动作账本。禁止直接调用 preload 清空、盲等 10 分钟或无限重试。
- 产品 Bug 在证据完整且后续 Case 独立时继续；不得修改 deepbankV2。
- 普通 prerequisite `blocked` 记录后继续独立 Case，不得覆盖更高优先级的
  `automation_error`。
- 确认 `framework_issue` 或 `testcase_issue` 时，冻结旧目录、停止唯一 runner、
  修复框架/Casebook、强化 invariant、全检、提交推送、重新 pretest，并在新目录
  从 1/70、1/160 或本轮 1/83 完整重跑所选 Sheet。停止旧 runner 只是保护证据，不是允许
  放弃后续 Case。
- 日常回归专项证据的 `evidence_valid` 与产品 `oracle_valid` 必须分离。产品
  Oracle 失败但取证完整时记产品 Bug 并继续后续独立父 Case；只有取证、清理、
  合同、宿主或框架失败才进入自愈硬停止。结果优先级始终为
  `automation_error > bug > blocked > pass`，后置 blocker 不得覆盖框架错误。
- `QWD-ENTRY-002` 的 Skill/Connector 手动模式准备若出现真实点击后未生效，必须
  保留被后续同级操作覆盖前的失败交互，并以截图、空任务、零消息、发送计数不变、
  空能力选择生成完整发送前负向证据。此时发送链角色使用受校验 N/A，日常回归
  专项角色必须为 `evidence_valid=true/oracle_valid=false`；结果保持产品 `bug` 并
  继续独立 Case。只有负向证据本身不完整时才允许升级为 `automation_error` 硬停。
- `QWD-WS-001` 的 A 发送前选择若出现注册路径不可见或真实点击后 cwd 未生效，
  必须禁止发送，以空任务/零消息/send count 不变、无发送证据、Case 内截图和
  A/B 定向清理文件及 SHA 形成受校验 N/A；证据完整时保持产品 `bug` 并继续，
  禁止抛异常覆盖。B 阶段失败时 A 会话已经发生，必须保留其完整会话证据并重开
  同一 A taskId/cwd，不能将 A 标 N/A。任何注册、控件定位、公开读回、重开、
  定向清理或 SHA 缺口仍是 `automation_error`，触发新目录全量重跑。
- 弹窗清理仅允许在同一可见弹窗内点击精确“取消/关闭/跳过/稍后/以后再说”或
  明确关闭图标。`SIT-HOME-052` 只可按按钮文案精确点击“打开本地工作空间/文件夹”；
  原生选择取消后若残留“新建工作空间”，点击可见“取消/关闭”并留证，不得按
  `.wspick-item.pick.first()` 误点，也不得让残留弹窗覆盖产品结论。
- “新建工作空间”模态框与版本更新提示同时出现时，清理顺序固定为：先在前景
  工作空间弹窗内执行精确“取消/关闭”或明确关闭图标，确认 hidden，保存前后截图
  和结构化 ledger；再处理底层“稍后/跳过更新”。每条 Case 初始化和进入系统设置
  前都必须遵守；禁止 `force` 穿透、点击“确认”或点击“立即重启”。
- `SIT-HOME-057` 若通过结构化推荐/澄清面板询问主题、对象、数据来源或截止时间，
  必须把每个面板绑定当前轮 prompt SHA、确认发送、taskId、前后截图及 SHA 后计入
  最少澄清 Oracle；不得因最终正文未重复面板文案而误报产品 Bug。面板证据缺失时
  属于框架问题，不能把未知交互当作澄清通过。
- 只有凭据/授权/受保护资源缺失、指定发布身份无法恢复或 pretest 明确阻塞时，
  才能保持暂停并报告唯一具体 blocker。

## 9. 只读监控与可信复核

监控不得操作 QWork、不得连接 runner 临时代理、不得启动第二 runner。每次至少报告：

- 北京时间、`completed/70`、executed/inherited/synthetic
- 最后完成 Case 的 raw status、可信分类和 manifest 完整性
- 当前 Case、progress 更新时间、最新证据 mtime、无进度时长
- runner/宿主 PID、Teams/QWork/control plane/CDP
- framework commit、`main == origin/main`、tracked dirty

summary 完整后逐 Case 复核，分类仅允许：

```text
trusted_pass
trusted_fail
trusted_blocked
trusted_bug
framework_issue
testcase_issue
```

raw `passed/failed` 不能直接用于发布。后续重跑通过不能抹去历史产品 Bug、框架
问题、Case 问题或 flaky 记录。

## 10. 当前交付边界

本次任务要求实际执行日常回归 83 个顶层 Case。完成 Casebook、执行器、文档、
提交和推送只是启动前置，不等于 Case 已执行；必须继续读取当前 SIT release
identity，得到 `日常回归` Sheet 的精确 `READY`，再从 1/83 启动唯一 runner。
最终结论必须同时报告 83 个顶层和 144 个叶子的真实执行/证据完整性，禁止只报
raw `passed/failed`。
