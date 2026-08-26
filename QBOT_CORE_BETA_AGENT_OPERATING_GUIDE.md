# QBot Core Beta Agent 操作指南

适用对象：后续接手 `/Users/qifu/Documents/QbotTestAgent` 的 QA Agent。

规范性执行合同以
`/Users/qifu/Documents/QbotTestAgent/QBOT_AUTOMATION_FRAMEWORK.md` 为准。
本指南记录当前新增 MR 核心冒烟 12 条、70 条生产灰度发布门禁、160 条全量正常功能
回归，以及 QWork 日常回归 83 个顶层 / 144 个叶子 Case 的接手状态、启动顺序和
禁止事项。

## 1. 当前状态

- QWork `0.1.6-sit.3` 基于框架 `84ca05523a53403cbc8704162b41a8b6cbab119f`
  启动的第三轮生产灰度门禁批次永久冻结在
  `teams360-automation/output/20260826144400_sit-qwork-gray70_teams360-5.5.13-2119081949_qwork-0.1.6-sit.3_M3_serial_framework-84ca055_casebook-1621632`。
  已完成 `19/70`，全部真实执行且 `inherited=0/synthetic=0`；raw 为
  `passed=10/failed=9`，运行时分类为 `pass=10/bug=4/automation_error=5`。
  `BETA-CHAT-006` 停止后正文从 8 字变为 0 字、`BETA-CHAT-007` 同宿主 pinned
  remount 后侧栏零选中态、`BETA-CHAT-008` 20 任务派发后 pending 池为零，以及
  `BETA-CHAT-010` 已产生真实 composition 事件但输入文本不一致，均保留为 manifest
  完整的产品 Bug 候选；后续通过不得抹去。`BETA-FILE-001~005` 连续生成真实 fixture
  文件与 SHA，但共享附件适配器只读取旧宿主返回的 `attachments[]`，没有识别当前
  QWork `shell.stageFiles()` 返回的 `files[]`，因而把成功暂存误写为“未返回任何附件”，
  五条均缺少 prompt/task/send/reply/attachment_readback 角色并记录为
  `automation_error`。当前 UI 的产品合同要求将 `files[]` 精确映射为
  `qwork-file-input:` descriptor；框架仍须兼容旧 `stageAttachments/attachments[]`，
  但不得把两种 payload 混用或伪造内联附件。唯一 npm/Node runner 已停止，旧监控已
  暂停，受管 360Teams PID `9554` 保持不变。修复必须补双合同归一化与畸形 descriptor
  fail-closed invariant，完成全检、提交推送、新能力审计和精确 `.3 READY` 后，必须在
  新不可变目录从 `1/70` 完整串行重跑，`inherited=0`、`synthetic=0`。
- QWork `0.1.6-sit.3` 的第二轮生产灰度门禁批次永久冻结在
  `teams360-automation/output/20260826133303_sit-qwork-gray70_teams360-5.5.13-2119081949_qwork-0.1.6-sit.3_M3_serial_framework-001fa96_casebook-1621632`。
  已完成 `14/70`，全部真实执行且 `inherited=0/synthetic=0`。其中
  `BETA-CHAT-006` 停止后正文丢失、`BETA-CHAT-007` 刷新重开后侧栏零选中态、
  `BETA-CHAT-008` 20 任务派发后的 pending 池显示为零均保留为 manifest 完整的产品
  Bug 候选；`BETA-CHAT-009` 两轮敏感信息最小复述/拒绝泄露链路完成。
  `BETA-CHAT-010` 在原生 IME 产品动作前发生一次全页 Playwright 截图与 CDP fallback
  同时超时，manifest 因缺少 10 个角色而不完整；但随后同一 renderer 的
  `99-error.png`、断言截图和下一 Case 截图均立即成功，证明宿主/CDP 未失效，属于
  可恢复瞬态截图的 framework issue。旧截图函数把超时 promise 直接指向最终证据路径，
  且一次完整失败后没有新的 viewport 尝试。修复必须把每次 Playwright 尝试隔离到临时
  文件，只有完整非空图像才写入最终路径，并在非 target-closed 的首次全页主路径/fallback
  双失败后，以新的 CDP session 执行一次有界 viewport 重试；两次均失败仍须保留完整
  错误并 fail-closed。完成 invariant、双框架全检、提交推送、新能力审计和精确 `.3
  READY` 后，必须在新不可变目录从 `1/70` 完整串行重跑，`inherited=0`、
  `synthetic=0`。
- 当前用户要求先执行新增 MR 核心冒烟 12 条，再执行原生产灰度门禁 70 条。两批必须
  使用同一重新读回的 SIT 发布身份，但分别执行能力审计、精确 `READY`、独立不可变
  输出和逐 Case 可信复核；不得继承或合并原始结果。确认 framework/testcase issue 后，
  必须冻结旧目录、完成框架修复与提交推送、重新得到精确 `READY`，再从 `1/12` 或
  `1/70` 启动唯一串行 runner。
- QWork `0.1.6-sit.3` 的生产灰度门禁批次永久冻结在
  `teams360-automation/output/202608261253_sit-qwork-gray70_teams360-5.5.13-2119081949_qwork-0.1.6-sit.3_M3_serial_framework-9d14243_casebook-1621632`。
  已完成 `11/70`，全部真实执行且 `inherited=0/synthetic=0`，raw 为
  `passed=8/failed=3`，运行时分类为 `pass=8/bug=2/automation_error=1`。
  `BETA-CHAT-003` 的连续重复回复和 `BETA-CHAT-006` 停止后正文丢失均保留为产品
  Bug 候选，后续通过不得抹去。第 11 条 `BETA-CHAT-007` 刷新销毁旧 renderer 后，
  同一 360Teams PID `9554` 从宿主持久配置重新暴露
  `file:///Users/qifu/.deepbank-sit/ui/0.1.6-sit.2/index.html` 并得到
  `ERR_FILE_NOT_FOUND`；旧 hook 只等待冻结 `.3` 自行重挂载，未调用已有的同宿主
  host-owned pinned remount，最终缺少 `action_receipt`、`task_id`、
  `public_state_readback`、`cleanup_readback` 并停止剩余 59 条。这是确认的
  framework issue。修复必须在同一
  session、宿主 PID 和上游 CDP 内把 WebView 定向恢复到冻结 `.3`，重放 Teams 登录
  握手，重新校验 QWork/control plane/capabilities/workbench，重建代理并更新共享
  page；任何宿主重启或 PID/CDP 变化必须拒绝。全检、提交推送、新能力审计和精确
  `.3 READY` 后，必须在新不可变目录从 `1/70` 完整串行重跑，
  `inherited=0`、`synthetic=0`。
- MR 冒烟第 8 条曾因 verified-legacy `SIT-SKILL-SCOPE-001` 把发送前库存不一致
  blocker 错绑为 legacy ID 而硬停。修复后的合同是：driver ID 只选择实现；所有
  blocker、evidence、manifest 和 SHA 必须绑定外层 `MRSMOKE-SKILL-001`，并在有需要时
  额外记录 `legacy_case_id`。重新批次必须验证目标库存不一致保持 `bug`、七个发送链角色
  受校验 N/A，且错误 legacy ID 仍被拒绝。manifest 取 legacy 期望值时优先读当前
  外层状态的 `legacy_case_id`；若 `finishCase()` 只保留外层状态，则必须回读同一
  Case 的 `artifacts.core_beta_legacy_driver.legacy_case_id`，不得因状态字段缺失把
  合法的发送前产品 Bug 误判为框架问题。
- 产品仓库 `/Users/qifu/Documents/deepbankV2` 只读，禁止修改。
- QWork `0.1.4-sit.27` 的首轮 MR 冒烟批次永久冻结在
  `teams360-automation/output/20260824101100_sit-qwork-mrsmoke11_teams360-5.5.13-2119081949_qwork-0.1.4-sit.27_M3_serial_framework-85213b9_casebook-8d361a9`。
  `MRSMOKE-ACT-001` 已形成 manifest 完整的活动折叠产品 Bug 候选；
  `MRSMOKE-WEB-001` 已真实发送、返回官方来源且 `web-search-quality` 业务 Oracle
  通过，但 verified-legacy 包装层未把同一 task 的公开 Web runtime authority 注册为
  `capability_selection/capability_execution_event`，导致文件虽存在却为无效诊断并
  触发 framework stop。修复必须使用 Case/legacy ID、prompt SHA、确认发送、taskId、
  `builtin:qbot_web` effective/materialized 路由与 `providerReceiptHash` 的结构化闭环，
  禁止用回复正文冒充工具调用；全检、提交推送、新能力审计和精确 `.27 READY` 后，
  从 `1/11` 在新不可变目录完整重跑，`inherited=0`、`synthetic=0`。
- 基于 `e624b97d8213116432798584f5480abf21de5c4a` 启动的第三轮 MR 冒烟批次
  永久冻结在
  `teams360-automation/output/20260824104200_sit-qwork-mrsmoke11_teams360-5.5.13-2119081949_qwork-0.1.4-sit.27_M3_serial_framework-e624b97_casebook-8d361a9`。
  已完成 `5/11`，全部真实执行且 `inherited=0/synthetic=0`；前两条保留活动折叠和
  Web 结果产品 Bug，`MRSMOKE-WEB-001` 的能力选择/执行角色已经按同 taskId 完整进入
  manifest。第 5 条 `MRSMOKE-AUTO-001` 以 `intervalMs=3600000`、过去一小时加 15 秒的
  `activeFrom` 期望短期到点，但 `release/0.1` 的服务端创建合同会执行
  `max(serverNow, requestedActiveFrom)`，真实定义因此回读为创建时刻起算、下一次运行
  在一小时后；runner 仅等待六分钟便错误停止。删除接口返回 200 后又未等待异步本地
  投影 refresh，误报 `definition_deleted=false`。修复必须改用合同允许的 60 秒最小
  interval、当前时刻起算，禁止 `runNow`，并在删除后显式 refresh、有界轮询目标定义
  消失；完成 invariant、全检、提交推送、新能力审计和精确 `.27 READY` 后，从
  `1/11` 在新不可变目录完整重跑，`inherited=0`、`synthetic=0`。
- 基于 `81bb6019db3c652cc9e1c6ee59f25499186f3939` 启动的第二轮 MR 冒烟批次
  永久冻结在
  `teams360-automation/output/20260824102900_sit-qwork-mrsmoke11_teams360-5.5.13-2119081949_qwork-0.1.4-sit.27_M3_serial_framework-81bb601_casebook-8d361a9`。
  第 1 条 `MRSMOKE-ACT-001` 再次形成 manifest 完整的活动折叠产品 Bug；第 2 条
  `MRSMOKE-WEB-001` 的 Web 结果、runtime authority、provider receipt、确认发送和
  taskId 均完整，但适配器在外层 action 物化 `task-id.json` 之前尝试读取该文件，得到
  空 taskId，并把本应注册的两个能力角色降为无效诊断，触发 framework stop。修复必须
  从唯一确认发送回执取得该时序窗口的 taskId，再与 Web 质量证据、runtime sessionId
  和外层 Case ID 全等；同 prompt 多 taskId 必须拒绝。完成 invariant、全检、提交推送、
  新能力审计和精确 `.27 READY` 后，仍须从 `1/11` 在新不可变目录完整重跑，
  `inherited=0`、`synthetic=0`。
- 产品设计基线：`origin/release/0.1`，
  commit `94205b1ed4ba2a44ea6a50aa5712a38da6dd30c3`，版本 `0.1.4`。
- 以下是历史 Daily83 SIT 批次的冻结身份，不得直接复用于当前 12 -> 70 任务：
  360Teams `5.5.13` build `2119081949`、
  QWork `0.1.4-sit.11`、UI commit `2cdcb9d7`、backend
  `sit-health-ae3b6cafbc5ed123`、control plane
  `https://deepbank-control-sit.sandbox.deepbank.daikuan.qihoo.net`、prompt policy
  `qwork-runtime-0.1.4-sit.11-sha256-18be77ef53f3fb2b185de5837386ee9180165a00999b06b72779bebbf894127d`、
  feature/UI SHA `db8d0d5c2200b0c5854c2ee179a4deb676dc2a934bc47db437f420a01f533817`、
  release manifest SHA `39f1c5fc19ef2899c7ddb449845d2451c833e5774c4eb5dc209d7ba71796246c`、
  release-set digest `8beb4c2be5aec05c7164fccee95764cffd5ed746db77a9928f130ea4cad04486`、
  模型 M3。当前任务 pretest 必须从当前受管宿主重新读回并精确匹配全部 release
  inputs，不能只信本文或历史批次。
- 历史 Daily83 runner 与 npm 父进程均已退出。原受管
  360Teams PID `73907` 已被产品 `app.relaunch` 替换为 PID `78313`，但旧
  `session.json` 尚未更新，且替换宿主的 WebView/启动参数不满足冻结 `.11` 身份，
  因此不属于可继续测试的有效宿主。新 pretest 前必须通过受管 launcher 精确恢复
  `.11`、SIT control plane、session 与 CDP，再次只读确认唯一宿主；不得继承旧
  runner PID、旧输出目录或旧监控。
- 历史 `framework-0e8ecdc_casebook-c412ee6` 批次曾在第 8 个顶层
  `QW-CHAT-005/BETA-CHAT-006` 发送前停止：SIT control plane 令公开
  `window.agent.capabilities()` 返回 HTTP 500 `invalid_launch_mode`，Skill、Connector
  和 Expert 隔离状态无法读取，框架正确禁止发送。该批次只完成 7/83 个顶层、
  17 个叶子，runner 已退出且输出永久冻结。旧 pretest 仅验证 WebView/Composer/
  release identity，未调用公开 capabilities，因此曾错误返回 `READY`；修复后的
  Teams pretest 必须以 `qwork_public_capabilities` 在 Case 0 前 fail-closed。

本轮目标 Casebook：

```text
/Users/qifu/Documents/QbotTestAgent/PRD/QWork日常回归自动化Casebook_最新变更回归_2026-08-18.xlsx
Sheet: 日常回归
SHA-256: c412ee6fc362cf613d599541151f766390c3e4281f6bcf2ab69f9d59346a76e6
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

修复 ROI 自然公式语义后启动的最新冻结批次保留在不可变目录
`teams360-automation/output/20260815045500_sit-qwork-daily83_teams360-5.5.10-2119081439_qwork-0.1.2-sit.7_M3_serial_framework-b7dc666_casebook-8a62aac`：
已完成 `18/83`，raw 为 `passed=12/failed=6/blocked=0`；第 19 条
`QW-ART-001` 未计入 completed。其第二个叶子 `SIT-ART-001` 连续处理第五张权限
确认面板时，真实点击已经让后台命令从 `Find git repo root and status` 推进到
`List PRD directory contents`，但下一张面板的问题和“跳过”文案完全相同。旧框架用
动态 locator 重新绑定到新按钮，再以同文案误判原面板仍可见，抛出
`Agent 推荐选项默认跳过失败：clicked=true stillVisible=true`，导致该叶子 manifest
不完整并触发框架硬停止；后续 64 条未执行。该目录永久冻结。修复必须同时覆盖 v2
和 legacy：点击前固定按钮/surface DOM 实例，识别同文案 replacement；产品复用同一
DOM 时以去除计时噪声后的工具进展作为后备；原实例和进展均未变化时继续 fail-closed，
普通“跳过向导”不得被误处理。完成 invariant、双框架全检、提交推送和新 `READY` 后，
必须在新不可变目录从 `1/83` 全量串行重跑，`inherited=0`、`synthetic=0`。旧批次已确认
的产品 Bug 和 `BETA-ART-001` 产品负向证据继续保留，后续通过不得抹去。

修复重复 Agent 推荐面板和专家草稿 `revision` CAS 后启动的最新冻结批次保留在
`teams360-automation/output/20260815082930_sit-qwork-daily83_teams360-5.5.10-2119081439_qwork-0.1.2-sit.7_M3_serial_framework-ec9683d_casebook-8a62aac`：
已完成 `6/83`。第 6 条 `QW-CHAT-003` 的叶子 `SIT-HOME-062` 收到完整真实回复，
明确仅凭报名/到场无法计算唯一 ROI，列出活动总投入成本与收益两个缺口，没有编造金额、
没有借用旧任务事实，并给出 `ROI = (收益 − 投入成本) ÷ 投入成本 × 100%`。两套
runner 的成本操作数只接受“投入/投入金额/总投入/成本”，漏掉自然表达“投入成本”，
导致 `formula=false` 并把正确产品回复误记为 Bug。runner 已在第 7 条产生材料时受管
停止，未完成内容不计入 completed；该目录永久冻结，不得续写。修复必须同时覆盖 legacy
与 v2，以本次完整回复强化正例，并保留缺公式、成本/收益操作数颠倒、编造金额和借用旧
事实等负例。完成全检、提交推送、新能力审计和精确 `READY` 后，必须在新目录从
`1/83` 全量串行重跑，`inherited=0`、`synthetic=0`。

修复 ROI 与重复推荐面板后启动的最新冻结批次保留在
`teams360-automation/output/20260815090600_sit-qwork-daily83_teams360-5.5.10-2119081439_qwork-0.1.2-sit.7_M3_serial_framework-3bd4de1_casebook-8a62aac`：
已完成 `21/83`，raw 为 `passed=14/failed=6/blocked=1`；第 22 条已有未完成材料，
但未计入 completed。`QW-ART-003` 的叶子 `SIT-ART-022` 已生成完整真实活动复盘，
包含 `触达 12,000`、`打开 860`、`报名 240`、`到场 170`、`投诉 28`、两组比例、
两个公式和风险，但 Core Beta v2 runner 直接以 `content.includes('12000')` 核对原始数，
漏掉 legacy runner 已有的数字分组符归一化，因而得到 `data=false` 并误报产品 Bug。
这是确认的 framework issue；旧 runner PID `943` 已停止，360Teams 宿主 PID `20115`
保留。该目录永久冻结，不得续写或继承。修复必须让两套 runner 共享同一事实归一化
合同，并以千分位完整正例及逐项缺失负例强化 invariant；全检、提交推送、新能力审计
和精确 `READY` 后，必须在新目录从 `1/83` 全量串行重跑，`inherited=0`、
`synthetic=0`。

修复成果事实数字分组后启动的最新冻结批次保留在
`teams360-automation/output/20260815103800_sit-qwork-daily83_teams360-5.5.10-2119081439_qwork-0.1.2-sit.7_M3_serial_framework-917927a_casebook-8a62aac`：
已完成 `23/83`，raw 为 `passed=13/failed=9/blocked=1`；第 24 条已有未完成材料，
但未计入 completed。第 22 条 `QW-ART-004/BETA-ART-004` 已真实生成五页 PPTX/PDF，
页数、空白页、五个标题及曝光 1000、点击 100、转化 20 全部满足；PPTX 第 2 页还以
三层同中心、纵向排列、等高且宽度递减的 `roundRect` 真实绘制漏斗。框架却把
`rect/roundRect` 全部排除在图表几何之外，得到 `pptx_chart_candidate_slides=[]`，
把正确产物误报为产品 Bug。这是确认的 framework issue；runner PID `44851` 及 npm
父进程已经停止，360Teams 宿主 PID `20115` 保留。该目录永久冻结，不得续写或继承。
修复必须接受上述严格矩形漏斗结构，同时以等宽卡片和中心错位矩形作为负例；完成全检、
提交推送、新能力审计和精确 `READY` 后，必须在新目录从 `1/83` 全量串行重跑，
`inherited=0`、`synthetic=0`。

修复矩形漏斗识别后启动的最新冻结批次保留在
`teams360-automation/output/20260815120147_sit-qwork-daily83_teams360-5.5.10-2119081439_qwork-0.1.2-sit.7_M3_serial_framework-d05bc71_casebook-8a62aac`：
已完成 `32/83`，raw 为 `passed=17/failed=14/blocked=1`；第 33 条
`QW-EXPERT-005` 未计入 completed。其叶子 `BETA-EXPERT-007` 正确识别
`claude-code_draft/codex_draft` 缺失，建立空任务零能力状态并生成完整可信
`run-owned-expert-publish-prerequisite.json`；唯一存在的 `manual_draft` 使用当前公开
bridge 的合法 `revision=2` CAS。runner 生成端已接受 revision，但 manifest 校验器
仍硬要求非空 `etag`，错误拒绝五个声明的 N/A 角色并触发 framework stop。runner
PID `89573` 及 npm 父进程已退出，360Teams 宿主 PID `20115` 保留；该目录永久冻结。
修复必须让 blocker、manifest 和发布执行共享 `etag|revision` CAS 合同，并以本次
revision blocker 正例及 CAS 类型/值矛盾负例强化 invariant；完成全检、提交推送、
新能力审计和精确 `READY` 后，必须在新目录从 `1/83` 全量串行重跑，
`inherited=0`、`synthetic=0`。

修复专家草稿 `revision` CAS manifest 合同后启动的最新冻结批次保留在
`teams360-automation/output/20260815140553_sit-qwork-daily83_teams360-5.5.10-2119081439_qwork-0.1.2-sit.7_M3_serial_framework-050f19c_casebook-8a62aac`：
已完成 `34/83`，raw 为 `passed=15/failed=17/blocked=2`；第 35 条
`QW-EXPERT-007` 未计入 completed。其前两个叶子已分别形成完整可信 blocked 与产品
Bug；第三叶子 `SIT-EXPERT-002` 已打开专家页并证明当前发布包没有稳定“通用助手”
入口，但旧 `executeExpertSmoke010()` 直接调用通用 `clickSelector()`，抛出
`未找到入口：[data-testid="expert-general-assistant"]`，漏掉
`action_receipt/public_state_readback/cleanup_readback/product_action_trace` 后硬停止。
runner PID `52074` 及 npm 父进程均已退出，360Teams 宿主 PID `20115` 保留；该目录
永久冻结。修复必须让 legacy 与 v2 runner 把入口缺失或点击失败材料化为证据完整的
产品 Bug，只有导航、取证或收尾失败才硬停止；完成全检、提交推送、新能力审计和精确
`READY` 后，必须在新目录从 `1/83` 全量串行重跑，`inherited=0`、`synthetic=0`。

修复组织可见专家产品拒绝取证后启动的批次保留在
`teams360-automation/output/20260815162044_sit-qwork-daily83_teams360-5.5.10-2119081439_qwork-0.1.2-sit.7_M3_serial_framework-9030f79_casebook-8a62aac`：
已完成 `36/83`，raw 为 `passed=17/failed=17/blocked=2`。第 37 条
`QW-EXPERT-009/QWD-EXPERT-009` 请求组织可见专家时，产品公开接口明确拒绝
`ExpertContractError: expert audience is not supported`，但旧框架让异常逃逸并遗漏
17 个证据角色，误升级为 `automation_error` 后硬停止。该目录永久冻结；修复提交
`afd48ec453501d1fb34ade0273215dc833cdfb6d` 已让这一精确产品拒绝生成完整负向证据、
保持产品 Bug 并继续后续独立父 Case。

基于上述修复启动的批次保留在
`teams360-automation/output/20260815184445_sit-qwork-daily83_teams360-5.5.10-2119081439_qwork-0.1.2-sit.7_M3_serial_framework-afd48ec_casebook-8a62aac`：
已完成 `6/83`，raw 为 `passed=1/failed=4/blocked=1`；第 7 条只有未完成现场，不计入
completed。第 6 条 `QW-CHAT-003` 的 `SIT-HOME-062` 回复明确说明收益与投入均缺失、
无法直接计算 ROI，并给出正确公式
`(活动带来的总营收 - 活动总投入) / 活动总投入`，金额只用于明确示例，也未借用旧任务
事实。两套 runner 的回报操作数遗漏“营收”，得到 `formula=false` 并误报产品 Bug。
该目录永久冻结；修复必须让 legacy 与 v2 同时接受“活动带来的总营收”，并保留投入在前、
缺回报输入、编造金额和借用旧事实等负例。完成全检、提交推送、新能力审计和精确
`READY` 后，必须在新目录从 `1/83` 全量串行重跑，`inherited=0`、`synthetic=0`。

修复“活动带来的总营收” ROI 语义后启动的最新冻结批次保留在
`teams360-automation/output/20260815192019_sit-qwork-daily83_teams360-5.5.10-2119081439_qwork-0.1.2-sit.7_M3_serial_framework-239a983_casebook-8a62aac`：
磁盘最终快照为已完成 `30/83`，raw 为 `passed=18/failed=11/blocked=1`，分类为
`pass=18/bug=11/blocked=1`；第 31 条 `QW-EXPERT-003` 只有未完成现场，不计入
completed。第 28 条 `QW-WS-003/BETA-SEC-002` 的产品已准确读取目录 A 标记
`A_ALLOWED`，随后对同级 B、父目录、symlink 真实目标和 `../` 路径穿越全部拒绝且
零秘密泄漏；框架虽然已覆盖四个拒绝轮次，却让合法读取和写入轮次回退到通用
`replyLooksRelevant()`，将本轮真实中文回复误判为不相关。停止信号生效前第 29、30 条
已完整落盘；唯一 runner 已退出，360Teams 宿主 PID `20115` 保留。该目录永久冻结，
不得续写或继承。修复必须让 legacy 与 v2 对合法 A 读取精确匹配 `A_ALLOWED`、对 A 写入
使用明确成功/失败语义，并继续由独立 artifact Oracle 验证文件；完成 invariant、双框架
全检、提交推送、新能力审计和精确 `READY` 后，必须在新目录从 `1/83` 全量串行重跑，
`inherited=0`、`synthetic=0`。

升级到 QWork `0.1.2-sit.12` 并促进最新 Casebook 后启动的冻结批次保留在
`teams360-automation/output/20260818115000_sit-qwork-daily83_teams360-5.5.10-2119081439_qwork-0.1.2-sit.12_M3_serial_framework-2796007_casebook-c412ee6`：
已完成 `34/83`，raw 为 `passed=17/failed=16/blocked=1`。第 35 条
`QW-EXPERT-007` 未计入 completed；其第二个叶子 `SIT-EXPERT-022` 已真实完成
专家选择、专家首轮回复、切回通用助手与第二轮身份隔离，但 legacy 路径没有把
两个专项文件注册为 `capability_selection/capability_execution_event`，manifest 因此不完整，
第三个叶子 `SIT-EXPERT-002` 未执行。旧 runner PID `90362` 已退出，该目录永久
冻结。修复必须让 legacy/v2 共享专家选择、公开 `currentExpert` 清空、同 taskId 双轮
回复和负向点击路径证据合同；全检、提交推送、新能力审计和精确 `.12 READY` 后，
必须在新不可变目录从 `1/83` 全量串行重跑，`inherited=0`、`synthetic=0`。

修复专家切换证据角色后启动的最新冻结批次保留在
`teams360-automation/output/20260818144000_sit-qwork-daily83_teams360-5.5.10-2119081439_qwork-0.1.2-sit.12_M3_serial_framework-ed6adb1_casebook-c412ee6`：
已完成 `34/83`；第 35 条 `QW-EXPERT-007` 未计入 completed。其叶子
`SIT-EXPERT-022` 已真实完成专家首轮回复、点击通用助手、公开
`currentExpert=null` 和通用助手第二轮回复；两轮分别绑定非空 taskId
`3f03cc5d-4555-4358-b2ba-d5cd9b077b8e` 与
`de8a05d5-ee72-47f4-9f2b-8878bcbdb64e`。旧框架把 `sameTask=false` 错误纳入
`secondReplyEvidenceValid`，导致完整负向产品证据被标为 manifest 无效并触发
framework stop。runner PID `76409` 已退出，360Teams PID `50464` 保留；该目录永久
冻结。修复必须把“两轮 taskId 均非空、回复终态与切换读回完整”判为
`evidence_valid=true`，只把 taskId 不一致写入 `oracle_valid=false` 和产品 Bug；任一
taskId 缺失仍须 fail-closed。完成双框架 invariant、全检、提交推送、新能力审计和
精确 `.12 READY` 后，必须在新目录从 `1/83` 全量串行重跑，
`inherited=0`、`synthetic=0`。

升级到 QWork `0.1.4-sit.2` 后启动的冻结批次保留在
`teams360-automation/output/20260818194100_sit-qwork-daily83_teams360-5.5.10-2119081439_qwork-0.1.4-sit.2_M3_serial_framework-a2bc4c0_casebook-c412ee6`：
已完成 `40/83`；第 41 条未计入 completed。`SIT-SKILL-025` 的目标 Skill 安装控件
已真实点击并得到明确产品拒绝，但旧框架未按发送前安装失败合同形成完整负向证据，
触发 framework stop。该目录永久冻结；修复提交 `959e67a4cc869dbc3a58a4e6efd23d89ed360037`
已统一安装拒绝生成器、manifest N/A 和可信复核口径。后续通过不得抹去该框架问题。

基于 `959e67a` 启动的最新冻结批次保留在
`teams360-automation/output/20260818222900_sit-qwork-daily83_teams360-5.5.10-2119081439_qwork-0.1.4-sit.2_M3_serial_framework-959e67a_casebook-c412ee6`：
已完成 `6/83`，raw 为 `passed=2/failed=4/blocked=0`；第 7 条 `QW-CHAT-004`
未计入 completed。首叶子 `BETA-CHAT-005` 已确认发送并绑定 taskId，真实进入生成态，
在约 `243s` 的 `258` 次采样后稳定停止且零可归属助手正文；专项滚动 executor 却把
终态写成 `completed`，遗漏 `no_reply` 的等待、稳定采样、task/prompt 复核和终态截图
字段，导致 `reply_completion=reply_incomplete` 并触发 framework stop。runner PID
`7938` 与 npm 父进程 `7923` 已退出，360Teams PID `89152` 保留；该目录永久冻结。
修复必须让专项长文本路径先从确认发送回执冻结 taskId，对结构化时间线执行 prompt
绑定终态复核，保存 `issue-793-after-terminal-no-reply` 后材料化 manifest-valid
`terminal_outcome=no_reply` 产品 Bug 并继续独立父 Case；同时把未完成停止 Case 作为
`non_executed_diagnostic` 传播到二次复核和框架修复清单。完成全检、提交推送、新
能力审计和精确 `.2 READY` 后，必须在新目录从 `1/83` 全量串行重跑，
`inherited=0`、`synthetic=0`。

基于 `50c9a31d18ad4ff518ce7eb11dca89f2cd9e6fac` 启动的最新冻结批次保留在
`teams360-automation/output/20260818233400_sit-qwork-daily83_teams360-5.5.10-2119081439_qwork-0.1.4-sit.2_M3_serial_framework-50c9a31_casebook-c412ee6`：
已完成 `40/83`，raw 为 `passed=17/failed=21/blocked=2`，全部 40 个顶层结果均为
真实执行且 `inherited=0/synthetic=0`；第 41 条 `QW-SKILL-001` 未计入 completed。
其叶子 `SIT-SKILL-002` 已真实点击精确 Skill 安装控件，产品随后显示
`安装失败：Skill package path is forbidden: scripts/yapi_sync_lib/credentials.py`，
且目标未进入已安装列表。React 回收市场卡后，旧框架既无法从漂移 locator 绑定目标，
又拒绝把新出现但不重复 Skill 名称的通用失败绑定到本次点击，因而把完整产品拒绝误升
为 `automation_error` 并停止。runner PID `40701` 与 npm 父进程 `40684` 已退出，受管
360Teams PID `89152` 保留；该目录永久冻结。修复必须同时覆盖 legacy 与 v2：在点击前
冻结页面/反馈基线，只有通用明确失败在点击后新增、已安装库存可读且目标精确不存在时，
才以 `installed-tab-new-explicit-failure-after-targeted-install` 和
`action_bound=true/baseline_absent=true` 材料化产品 Bug；陈旧同文案、目标已安装、
库存或截图缺失仍须 fail-closed。完成全检、提交推送、新能力审计和精确 `.2 READY`
后，必须在新不可变目录从 `1/83` 全量串行重跑，`inherited=0`、`synthetic=0`。

基于 `7c104b391b2ebc57e603877b5b7be66ef8a2b0cc` 启动的冻结批次保留在
`teams360-automation/output/20260819021800_sit-qwork-daily83_teams360-5.5.10-2119081439_qwork-0.1.4-sit.2_M3_serial_framework-7c104b3_casebook-c412ee6`：
已完成 `40/83`，raw 为 `passed=13/failed=25/blocked=2`，全部为真实执行且
`inherited=0/synthetic=0`；第 41 条 `QW-SKILL-002` 未计入 completed。其叶子
`SIT-SKILL-007` 的 manifest 与动作、公开状态、截图和清理证据均完整，但 Core Beta v2
仍执行了旧 disabled/auto/manual 三态 smoke，而不是当前 Casebook 要求的可见技能选择、
句内 chip、公开读回与移除闭环；同时 `setSkillsDisabled` 已派发且 bridge/capabilities
均精确读回 `selectedSkills=null` 的产品负向终态被误标为 `automation_error`，导致其余
两个叶子未执行并触发 compound framework stop。runner PID `23719` 与 npm 父进程
`23697` 已退出，受管 360Teams PID `89152` 保留；该目录永久冻结。修复必须同步 v2
与 legacy 的动作分类口径，并用 invariant 禁止 v2 再退化到旧三态 smoke；完成本轮
run-owned Skill 定向清理、全检、提交推送、新能力审计和精确 `.2 READY` 后，必须在
新不可变目录从 `1/83` 全量串行重跑，`inherited=0`、`synthetic=0`。
该定向清理的冻结源叶子位于 `QW-SKILL-001.subcase_results`；清理源解析必须记录
`QW-SKILL-001 -> BETA-SKILL-002/003/004` 唯一路径，并验证路径上全部结果均为
真实 executed、非 synthetic 且叶子 manifest 完整，禁止因只扫描顶层 progress 而
跳过清理或改用临时产品脚本。
Daily83 清理命令仍使用 `--case BETA-SKILL-001`；该专用参数组合必须绕过共享入口的
顶层预导出，并由 v2 从完整 Sheet 的唯一 `QW-SKILL-001.compound_subcases` 路径只选择
该叶子。`casebook-cases.json.cleanup_selection.result_path_ids` 必须精确记录这条路径。

基于 `f48448f3df981ac3f3cbd4b1dcf12544a3cda100` 启动的最新冻结批次保留在
`teams360-automation/output/20260819052600_sit-qwork-daily83_teams360-5.5.10-2119081439_qwork-0.1.4-sit.2_M3_serial_framework-f48448f_casebook-c412ee6`：
已完成 `7/83`，raw 为 `passed=2/failed=5`，可信运行时分类为 `pass=2/product bug=5`，
全部为真实执行且 `inherited=0/synthetic=0`；18 个叶子结果文件已落盘，第 8 个顶层
`QW-CHAT-005` 未计入 completed。其叶子 `BETA-CHAT-006` 已确认发送并绑定 task
`6461543e-8614-4c57-b157-382ebfe67ea3`，等待 `55821ms` 后同时观察到
`running=true`、停止入口可见和 `45` 字正文 partial，并保存停止前截图。旧 runner
随后复用该截图前取得的 locator；产品在点击前替换或移除了停止控件，Playwright
`click` 失败后又对 stale locator 执行最长 12 秒的 `evaluate()` fallback，异常逃逸并
遗漏标准会话与收尾证据角色，触发 framework stop。runner PID `21137` 与 npm 父进程
`21115` 已退出，受管 360Teams PID `89152` 保留，旧监控已暂停；该目录永久冻结。
修复提交 `84c5d77e5ebe6982d38eb9af52c066d9c175e8dc` 已让 v2 与 legacy 每次点击前重新定位
当前停止控件，只对同一仍运行 task 进行一次短重试；同一 task 在点击前自然完成时写齐
确认发送、task、截图、完整会话和公开状态，以 `completed_before_stop`、
`stop_action_performed=false` 形成完整 blocked 证据并禁止继续追问。后续必须基于包含
该修复与本指南更新的干净 pushed main，重新执行能力审计和精确 `.2 READY`，再在新
不可变目录从 `1/83` 全量串行重跑，`inherited=0`、`synthetic=0`。

基于 `39be8a535dc993d571f8fda1590d57805b7cb570` 启动的最新冻结批次保留在
`teams360-automation/output/20260819063300_sit-qwork-daily83_teams360-5.5.10-2119081439_qwork-0.1.4-sit.2_M3_serial_framework-39be8a5_casebook-c412ee6`：
已完成 `42/83`，可信运行时分类为 `pass=19/product bug=20/blocked=3`，全部为真实执行
且 `inherited=0/synthetic=0`；第 43 条 `QW-SKILL-004` 未计入 completed。其叶子
`BETA-SKILL-011` 形成有效上游 blocked；下一叶子 `SIT-SKILL-026` 缺少
`task_id/prompt/send_receipt/transcript/reply_delta/reply_completion/capability_selection/
capability_execution_event`，第三叶子 `SIT-SKILL-SCOPE-001` 未执行。根因是 legacy
`restartWithSkillHubFault()` 已在 Teams lane 使用
`createTeamsSkillFixtureController(fixture.skills)`，但 Core Beta v2 调用方未传
`fixture`，V2 restart 又把非空 `overrideUrl` 直接降级成 `forbidden` 空市场 adapter，
导致 `qa-python-runtime/qa-node-runtime` 从市场消失并在发送前留下不完整 manifest。
runner PID `55433` 与 npm 父进程 `55415` 已退出，受管 360Teams PID `89152` 保留，
监控已暂停；该目录永久冻结。修复必须让 V2 传递 fixture、使用 stateful Node handler
覆盖 Skill catalog/install/uninstall/update/revert/reconcile，并在 renderer adapter 下
保持冻结 SIT control plane。完成 invariant、双框架全检、提交推送、run-owned Skill
定向清理、新能力审计和精确 `.2 READY` 后，必须在新目录从 `1/83` 全量串行重跑，
`inherited=0`、`synthetic=0`。

基于 `dea5da1b54b1f7d296fc0aa09d602e14c233d7b3` 启动的后续冻结批次保留在
`teams360-automation/output/20260819095300_sit-qwork-daily83_teams360-5.5.10-2119081439_qwork-0.1.4-sit.2_M3_serial_framework-dea5da1_casebook-c412ee6`：
已完成 `42/83`，独立 manifest/SHA 复核得到顶层 `trusted_pass=15`、
`trusted_bug=24`、`trusted_blocked=3`；这些父 Case 下的 89 个叶子为
`trusted_pass=45`、`trusted_bug=31`、`trusted_blocked=13`，全部 `executed`、
manifest 完整且无路径、字节数或 SHA 漂移。
第 43 条 `QW-SKILL-004` 是未完成 stop diagnostic，不计入 completed；其
`BETA-SKILL-011` 另有一份完整可信 blocked 叶子，`SIT-SKILL-026` 已执行但缺少
`task_id/prompt/send_receipt/transcript/reply_delta/reply_completion/capability_selection/
capability_execution_event`，`SIT-SKILL-SCOPE-001` 未执行。runner PID `60683`、npm
父进程 `60668` 均已退出，受管 360Teams PID `89152` 保留，旧监控已暂停；该目录
永久冻结。

本次根因是 Teams 包内 Electron `contextBridge` 暴露的 `window.agent` 方法被冻结，
而 `dea5da1` 的 renderer adapter 只执行逐方法赋值并无绑定验证；赋值未生效后 UI 继续
读取真实 SIT 市场，Node controller 的事件为空。修复合同要求 adapter 在方法不可写时
安装并验证可恢复的完整 agent facade；六条 Skill 生命周期必须用无副作用 probe identity
逐条到达 stateful controller，随后清空探针事件，并在每个真实叶子准备后再次要求非空
定向 controller 事件。方法与全局 agent 均不可替换、生命周期探针缺项或真实准备事件为空
时，都必须在叶子产品动作前以 `automation_error/framework_issue` fail-closed。完成双框架
全检、提交推送、run-owned Skill 定向清理、新能力审计和精确 `.2 READY` 后，只能在新
不可变目录从 `1/83` 全量串行重跑，`inherited=0`、`synthetic=0`。

基于 `43a5c33c1ad3dfa9a23a7e88e85fa86eba0482b5` 启动的最新冻结批次保留在
`teams360-automation/output/20260819130930_sit-qwork-daily83_teams360-5.5.10-2119081439_qwork-0.1.4-sit.2_M3_serial_framework-43a5c33_casebook-c412ee6`：
已可信完成 `42/83`，顶层为 `pass=16/bug=23/blocked=3`；对应 89 个完成叶子为
`pass=46/bug=30/blocked=13`。第 43 条 `QW-SKILL-004` 与叶子 `SIT-SKILL-026`
均不计入 completed；后者只有 M3 选择，execute receipt 为 `step_count=1`、
`assertion_count=0`、`task_id=null`，缺少 task/prompt/send/reply 与能力选择/执行角色，
且 exact adapter 失败原因被通用 manifest 错误覆盖。runner PID `60215` 与 npm 父进程
`60198` 已退出，受管 360Teams PID `89152` 保留；该目录永久冻结。

同一 QWork host 的后续只读诊断确认当前 `window.agent` 与六条生命周期方法可替换，
`installRendererControlAdapter()` 连续 20 次安装、探针和关闭均成功，因此不能把冻结
失败继承为永久 `contextBridge` 不支持；最可信分类是长批次中的瞬态/stale renderer
adapter 或 Playwright binding 状态。修复必须为首次绑定/探针失败保存完整 registry、
owner、stack、属性描述符、binding report、probe/controller 事件和 error stack；只有
关闭后没有其他活动 adapter 时允许一次 clean rebind。持久失败必须用
`qbot-core-beta-renderer-adapter-framework-failure/v1` 完整材料化产品动作前的 N/A
角色，并保留首个 exact `primary_failure`，禁止再被 action/manifest 汇总覆盖。完成
invariant、双框架全检、提交推送、run-owned Skill 定向清理、新能力审计和精确 `.2
READY` 后，仍须在新不可变目录从 `1/83` 全量串行重跑，`inherited=0`、
`synthetic=0`。

基于 `0dfe6364d0b2f90d6943577c6a04cbad2b70c5e6` 启动的最新冻结批次保留在
`teams360-automation/output/20260819163030_sit-qwork-daily83_teams360-5.5.10-2119081439_qwork-0.1.4-sit.2_M3_serial_framework-0dfe636_casebook-c412ee6`：
已完成 `42/83`，顶层为 `pass=16/bug=23/blocked=3`，全部真实执行且
`inherited=0/synthetic=0`。第 43 条 `QW-SKILL-004` 未进入 completed；其叶子
`SIT-SKILL-026` 的 renderer fixture adapter 安装、六条生命周期探针与
`qa-python-runtime` 安装均成功，但接着查找 `qa-node-runtime` 时页面只重复点击
已激活的【技能市场】，未触发稳定 catalog refresh，React 继续显示旧/真实市场卡片，
从而将确定性 Fixture 缺卡误升为不完整 `automation_error`。runner 与 npm 父进程
均已退出，受管宿主 PID `89152` 保留，该目录永久冻结。修复必须使 legacy/v2
每次确定性 Fixture 查找都清空旧搜索、点击
`[data-testid="skills-catalog-refresh"]`、等待渲染收敛、按归一化 marker 搜索并保存
`skill-fixture-catalog-lookups.json`。完成 invariant、双框架全检、提交推送、定向清理、
新能力审计和精确 `.2 READY` 后，仍只能在新目录从 `1/83` 全量串行重跑，
`inherited=0`、`synthetic=0`。

升级到 QWork `0.1.4-sit.11` 后基于
`304565d2bf8479579c22ef106986953f82565bfb` 启动的最新冻结批次保留在
`teams360-automation/output/20260820153125_sit-qwork-daily83_teams360-5.5.13-2119081949_qwork-0.1.4-sit.11_M3_serial_framework-304565d_casebook-c412ee6`：
已完成 `15/83`，全部真实执行且 `inherited=0/synthetic=0`；第 16 条
`QW-FILE-006` 未进入 completed。叶子 `BETA-FILE-007` 已完成四类发送前拒绝、
合法附件恢复上传与确认发送，并在完整 `600000ms` 窗口后保留了点名
`qbot-text-brief.txt/228 字节` 的可归属回复与受验证超时终态。旧矩阵却用
`valid=false` 同时表示产品 Oracle 失败和证据无效，使 manifest 误拒绝
`attachment_readback` 并触发 framework stop。runner 和 npm 父进程已正常退出，受管
宿主 PID `73907` 保留，该目录永久冻结。修复必须使矩阵以
`valid/evidence_valid` 表示结构与终态证据完整性，以 `oracle_valid` 表示稳定完成且
文件名/大小正确；受验证超时必须保持产品 Bug 并继续后续独立叶子。完成
invariant、双框架全检、提交推送、新能力审计和精确 `.11 READY` 后，仍只能在新
不可变目录从 `1/83` 全量串行重跑，`inherited=0`、`synthetic=0`。

修复附件恢复矩阵后基于 `4c61168a3c4f881e9717248680f6bb7dae429a59` 启动的
冻结批次保留在
`teams360-automation/output/20260820202144_sit-qwork-daily83_teams360-5.5.13-2119081949_qwork-0.1.4-sit.11_M3_serial_framework-4c61168_casebook-c412ee6`：
已完成 `6/83`，全部真实执行且 `inherited=0/synthetic=0`；第 7 条
`QW-CHAT-004` 未进入 completed。首叶子 `BETA-CHAT-005` 在约 240 秒内生成
约 6591 字但未稳定完成，证据完整并保留为产品 Bug。第二叶子
`BETA-PERF-003` 在北京时间 `22:27:21` 读到
`新版本已就绪 v0.1.4-sit.17 / 稍后 / 立即重启`，runner 精确点击“稍后”且前后
截图证明提示已消失；宿主仍在 `22:30:42` 记录
`markQuitIntent reason=app.relaunch source=app.relaunch-wrapper`，关闭已确认发送并
绑定 taskId 的页面。新宿主 PID `78313` 丢失原 `--qbot-server` 参数，WebView 漂移为
`~/.deepbank-sit/ui/0.1.1/index.html`，旧 session PID `73907` 失效；该历史行为同时
保留为“稍后仍延迟重启并丢失发布 pin”的产品生命周期缺陷。框架在
`page.waitForTimeout(750)` 首先抛出 target closed，导致已有滚动样本、正式性能角色
与会话终态未落盘，形成 framework issue 并正确冻结目录。修复必须使正式不可变批次
检测到待激活更新时先保存候选/冻结版本、提示、按钮、截图与 SHA，保持提示原样并在
发送前硬停止；#793 采样还必须持续落盘 prompt SHA、确认发送、taskId、最后会话快照、
滚动样本和性能指标，renderer 关闭时保留主因而不伪造可信终态。完成 invariant、双框架
全检、提交推送、精确恢复 `.11`、新能力审计和新 `READY` 后，只能在新不可变目录
从 `1/83` 全量串行重跑，`inherited=0`、`synthetic=0`。

QWork `0.1.6-sit.3` 生产灰度 70 条批次
`teams360-automation/output/20260826160839_sit-qwork-gray70_teams360-5.5.13-2119081949_qwork-0.1.6-sit.3_M3_serial_framework-47f0294_casebook-1621632`
永久冻结。第 1~11 条真实落盘，raw 为 `passed=9/failed=2`；其中
`BETA-CHAT-006` 停止后正文从 8 字变为 0 字、`BETA-CHAT-007` 刷新重开后侧栏
`selected_count=0`，两者 manifest 完整，作为历史产品 Bug 候选保留。第 12 条
`BETA-CHAT-008` 首次读到待激活更新 `0.1.6-sit.4`，冻结版本仍为
`0.1.6-sit.3`；框架虽保持提示原样并保存截图与三类停止证据，却因
`coreBetaBatchStopReason()` 退化为空返回，没有将该批次级发布身份风险传播到根
runner，继续把第 12~52 条写成 `automation_error`，第 53 条仅留下未完成停止材料。
这些后续记录均不得视为独立 Case 结论，也不得续写、继承或用于放行。该批次没有
`core-beta-suite-ledger`、Skill 安装尝试账本或 run-owned Skill identity，更新提示在
所有 Skill 产品动作前已阻断，因此本轮无需 Skill 清理专跑。修复必须让独立 Case 和
`compound` 叶子在停止证据落盘后传播同一 `batch_stop_reason`，立即停止后续叶子/
Case，生成 `framework-stop-diagnostic.json`，并将停止 Case 排除在 `completed` 外；
修复提交 `7abeca58b02292d6d7cd5cf13feefbe42bcf3b01` 后执行的只读 pretest
`outputs/20260826164835_qwork-sit3-gray70-pretest_framework-7abeca5_casebook-1621632`
又暴露同源 pretest 缺口：公开状态已为 `update_phase=restart-required`，但投影遗漏
`preparedRelease=0.1.6-sit.4`，报告仍错误给出 `READY/0 blockers`；该报告无效，绝不
授权 runner。pretest 必须新增非 warning 的 `qwork_runtime_update_activation_safe`，
只接受 `updatePhase=idle` 且 `preparedRelease=null`。完成 invariant、双框架全检、
再次提交推送并精确恢复 `.3` 后，只能新能力审计、新
`READY`、新不可变目录从 `1/70` 全量串行重跑，`inherited=0`、`synthetic=0`。

最新冻结的旧 55 条 scoped 批次：

```text
/Users/qifu/Documents/QbotTestAgent/teams360-automation/output/20260810165050_uat-core-beta74-scoped55_teams360-5.3.0-2119080776_qwork-0.1.1-rc.2_M3_serial_framework-af1a4a7
```

该目录及此前所有 55/74 scoped 目录只作为历史证据保留，禁止续写、继承或作为
发布结论。旧 55 条流程长期暴露过截图无界等待、回复/附件/成果 Oracle 误判、
Skill 清理超时对账、MCP 负向证据被标无效、产品 home 选择错误等框架问题。
后续修复不能抹去这些历史 issue，但也不得继续围绕旧 55 条启动新发布批次。

## 2. 当前正式 Casebook

新增 MR 核心冒烟入口：

```text
/Users/qifu/Documents/QbotTestAgent/PRD/QBot新增MR核心冒烟与生产灰度全量回归Casebook_12-70-160条_2026-08-26.xlsx
Sheet: 新增MR核心冒烟
SHA-256: d09e0294ff912e4f559fbaa1143d06ad612da173dcebe1a1e5004ec6a1865f1d
```

- 固定顺序：`MRSMOKE-ACT-001`、`MRSMOKE-WEB-001`、`MRSMOKE-WEB-002`、
  `MRSMOKE-AUTH-001`、`MRSMOKE-AUTO-001`、`MRSMOKE-NAV-001`、
  `MRSMOKE-ROUTE-001`、`MRSMOKE-SKILL-001`、`MRSMOKE-FAIL-001`、
  `MRSMOKE-ART-001`、`MRSMOKE-ENTRY-001`、`MRSMOKE-CHART-001`。
- 能力构成为 6 条原生 driver、6 条经过语义复核的 legacy driver；必须满足
  12/12 executable、dispatchable、directly runnable，
  `strict_controller_required=0`、`unsupported_runtime=0`。
- 完整固定计划使用 `qwork-mr-core-smoke/v1`，冻结全部 release inputs，但不冒充
  70/160 八大生产风险域门禁。缺失、乱序、ID 或 Case 类型漂移必须 fail-closed。
- 自动化覆盖活动流、Web 搜索与 SSRF、目录授权、interval 真实到点、侧栏布局、
  路由稳定、Skill 隔离、失败脱敏、成果目录、新任务隔离和 qcharts-react 交互图表。主观视觉细节、极端参数
  矩阵、首次系统权限/升级重启、多账号或受保护资源继续按合并版手工 Casebook 执行，
  不在 12 条通过结论中豁免。
- 本版以北京时间 2026-08-24 至 2026-08-26 的 first-parent 为准，共审计 35 个
  `origin/release/0.1` 直接合入 MR；工作簿 `近2天MR覆盖` Sheet 对每个 merge commit
  给出可执行 Case 映射或 Dashboard/CI/设计静态合同审计，静态审计不得冒充桌面 E2E。
- MR !1329 只修改 `.gitlab-ci.yml` 中的单元测试物料镜像 digest，固定映射为 CI-only
  静态合同审计；不新增桌面 Case，且不计入 12/70/160 桌面通过。
- `MRSMOKE-AUTO-001` 固定 `intervalMs=60000`、`activeFrom=当前时刻`，禁止
  `runNow` 和过去时间回填；删除 definition 后必须 `refresh()` 并有界读回消失。
- `MRSMOKE-SKILL-001` 固定通过组合 driver `SIT-SKILL-MR-001` 执行成功依赖事务、
  失败依赖回滚和任务 A/B 隔离；6 个确定性 Fixture 与
  `qbot-skill-install-attempt-ledger/v2` 必须绑定 personal installAttempt、operationId、
  提交/回滚终态，外层证据和 blocker 仍只能绑定 `MRSMOKE-SKILL-001`。
- picker/paste/drag 附件统一入口、81 MiB 发送前拒绝、cwd 删除后的
  `chat.workspace.cwd_missing`、Web runtime authority/provider receipt 与真实外链
  `preview | external | blocked` 均已进入机器证据合同；对应角色为
  `workspace_missing_error_readback`、`skill_install_attempt_ledger` 和
  `external_navigation_trace`。
- `MRSMOKE-CHART-001` 与门禁 `SIT-CONN-016` 共用 `interactive_chart_readback`：
  确认发送、taskId、session、runtime authority、provider receipt 与同轮
  `qbot_chart/render_chart` tool part 必须绑定；合法四点 type/data envelope 必须以
  唯一 qcharts-react SVG 交互渲染，四个标签和数值可读，禁止静态/失败 fallback、
  横向溢出和 SVG/base64 编码泄漏。`evidence_valid` 与产品 `oracle_valid` 必须分离。
- 执行顺序固定为：12 条能力审计与精确 `READY` -> 12 条全量串行执行和逐 Case
  可信复核 -> 70 条能力审计与独立精确 `READY` -> 70 条全量串行执行和逐 Case
  可信复核。两批各用新不可变目录，均为 `inherited=0`、`synthetic=0`。

生产灰度发布与全量功能回归唯一入口：

```text
/Users/qifu/Documents/QbotTestAgent/PRD/QBot新增MR核心冒烟与生产灰度全量回归Casebook_12-70-160条_2026-08-26.xlsx
```

- Sheet `生产灰度门禁Case`：70 条；70/70 executable、dispatchable、directly runnable。
- Sheet `全量功能回归Case`：160 条；160/160 executable、dispatchable、directly runnable。
- 160 条的前 70 条 ID、顺序和合同内容必须与门禁 Sheet 完全一致，后 90 条为正常功能增量。
- SHA-256：`d09e0294ff912e4f559fbaa1143d06ad612da173dcebe1a1e5004ec6a1865f1d`
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
`SIT-HOME-002`、`SIT-HOME-012`、`SIT-HOME-013`、`SIT-CONN-016`
五条高频正常功能补齐；全量功能池新增 `SIT-HOME-028`、`SIT-HOME-046`、
`SIT-HOME-051`、`SIT-CONN-005`、`SIT-HOME-048`，因此总量仍为70/160。

新增或重写的关键回归：

- `BETA-TASK-008`：空闲态第一次物理 Arrow 只建立边界握手，第二次才进入历史；同时覆盖未发送草稿恢复、任务隔离和重开持久化。
- `BETA-ROUTE-001`：模型菜单按当前 SDK family/protocol 过滤。
- `BETA-EXPERT-007`：单账号串行发布研究、数据、交付三类本轮专家。
- 专家草稿发布 CAS 必须按当前公开 bridge 读回：旧版为非空 `etag`，新版为正整数
  `revision`。三个上游只在 draftId 与真实 CAS 同时完整时写 suite ledger；不得用
  展示读回覆盖 mutation identity，也不得伪造 etag。
- `BETA-EXPERT-001`：发布记录严格等于 `owned=true` 专家集合；从干净草稿发送确定性短提示，证明新 taskId 以及 expert/version/release/最近召唤 identity 全链一致，禁止继承上一条 Case 的 taskId。
- `BETA-ART-001`：受管 HTML 网页预览、分享入口和宿主隔离。

Casebook 的设计依据包括 2026-08-24 至 2026-08-26 直接合入
`origin/release/0.1` 的 35 个 MR、最新产品源码和历史 Casebook 收敛审计。MR 映射、
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
  --casebook PRD/QBot新增MR核心冒烟与生产灰度全量回归Casebook_12-70-160条_2026-08-26.xlsx \
  --sheet 生产灰度门禁Case \
  --profile mandatory \
  --out outputs/<new-gate70-capability-audit-dir>

npm run core-beta:capability-audit -- \
  --casebook PRD/QBot新增MR核心冒烟与生产灰度全量回归Casebook_12-70-160条_2026-08-26.xlsx \
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
CASEBOOK="$PWD/PRD/QBot新增MR核心冒烟与生产灰度全量回归Casebook_12-70-160条_2026-08-26.xlsx"

npm run core-beta:pretest -- \
  --casebook "$CASEBOOK" \
  --sheet 生产灰度门禁Case \
  --profile mandatory \
  --lane teams \
  --out "$PWD/outputs/<new-immutable-pretest-dir>" \
  --expected-count 70 \
  --expected-sha256 d09e0294ff912e4f559fbaa1143d06ad612da173dcebe1a1e5004ec6a1865f1d \
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
`c412ee6fc362cf613d599541151f766390c3e4281f6bcf2ab69f9d59346a76e6`；其余
Teams/QWork/SIT 发布身份参数必须从当前受管宿主重新读取。只有精确 `READY`
授权 runner，任何 tracked dirty、身份漂移、旧 runner 或 Casebook 漂移都必须
在 Case 0 前失败。

Teams pretest 必须在精确 QWork WebView 上只读调用一次
`window.agent.capabilities()`。报告中的 `qwork_public_capabilities` 只有在调用成功且
返回结构化对象时才能通过；接口缺失、超时、非对象或 control-plane HTTP 4xx/5xx
均必须得到 `BLOCKED`。页面已登录、Composer 可见、版本与 control plane identity
匹配都不能替代该检查。

Teams pretest 还必须只读调用 `window.agent.runtimeReleaseStatus()`。报告仍要求
顶层 release、兼容性内 runtime、WebView URL 与 `--expected-qwork-version` 全等；
runtime API/字段不可读、返回非对象或 runtime 身份漂移仍必须在 Case 0 前 `BLOCKED`。
经开发确认的 host-core 兼容性例外只将 `hostRuntimeCompatibility.versionsMatch`、
`hostCoreVersion` 与 `runtimeVersion` 的不一致记为结构化 warning，不再单独阻止
`READY`。报告必须保留实际 host-core/runtime 版本、来源和路径，warning 不得被解释为
版本兼容通过。

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
- Expert 发布轮询必须把发起发布时的同一 `operationId`、`draftId` 和 CAS 一并传给
  `expertLifecycle.getOperation`。缺少 draft/CAS 导致的 `expert draft was not found`
  是框架合同错误，必须自愈后从新目录全量重跑，不能当产品 Bug 或普通 blocked。
- 确认 `framework_issue` 或 `testcase_issue` 时，冻结旧目录、停止唯一 runner、
  修复框架/Casebook、强化 invariant、全检、提交推送、重新 pretest，并在新目录
  从 1/70、1/160 或本轮 1/83 完整重跑所选 Sheet。停止旧 runner 只是保护证据，不是允许
  放弃后续 Case。
- 日常回归专项证据的 `evidence_valid` 与产品 `oracle_valid` 必须分离。产品
  Oracle 失败但取证完整时记产品 Bug 并继续后续独立父 Case；取证或框架失败时，
  当前已开始执行的 Case 必须先落盘 `failed/automation_error` 或 `blocked`、进度和
  根因诊断，再继续后续独立 Case。只有 CDP、renderer、受管宿主或批次级发布身份
  已经失去执行能力时才进入自愈硬停止。结果优先级始终为
  `automation_error > bug > blocked > pass`，后置 blocker 不得覆盖框架错误。
- 已安装 Skill 在可见手动列表中缺失、但列表仍有其它选项时，必须按
  `inventory_mismatch=true` 的发送前产品失败交互材料化：保留稳定目标 identity、
  列表结构、公开空选择、失败截图和零发送守卫，显式 N/A 后继续独立父 Case。只有
  列表为空、公开状态/截图/目录边界不完整或 identity 无法绑定时才升级为
  `automation_error`；legacy 与 v2 runner 必须共享该分类。
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
- “新建工作空间”模态框与版本更新提示同时出现时，处理顺序固定为：先在前景
  工作空间弹窗内执行精确“取消/关闭”或明确关闭图标，确认 hidden，保存前后截图
  和结构化 ledger；再只读取底层待激活更新提示。正式不可变批次必须保留提示、
  候选/冻结版本和截图后硬停止，禁止点击“稍后/跳过更新”后继续发送，也禁止
  `force` 穿透、点击“确认”或点击“立即重启”。
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

本次任务要求实际执行新增 MR 核心冒烟 12 条和原生产灰度门禁 70 条。完成 Casebook、
执行器、文档、提交和推送只是启动前置，不等于 Case 已执行；必须继续读取当前 SIT
release identity，分别得到 `新增MR核心冒烟` 与 `生产灰度门禁Case` 的精确 `READY`。
先从 1/12 启动唯一 runner 并完成逐 Case 可信复核，再从 1/70 以独立目录启动唯一
runner。最终结论必须分别报告两批真实执行、raw/可信分类、证据完整性和发布身份，
禁止只报 raw `passed/failed`，也不得用 12 条冒烟替代 70 条门禁。
