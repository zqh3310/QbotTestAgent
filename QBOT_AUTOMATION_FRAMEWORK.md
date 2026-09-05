# QBot 自动化测试框架使用手册

本文是 `/Users/qifu/Documents/QbotTestAgent` 的标准执行入口。后续 Agent 在设计、启动、监控、恢复或复核 QBot Casebook 前，必须先阅读本文；不得凭历史会话、旧命令或 raw `passed/failed` 自行推断。

## 1. 框架目标与边界

框架负责：

- 精确读取 Casebook、动作计划、会话轮次、证据角色和硬 Oracle。
- 操作真实 QWork 产品界面，保存按钮点击、状态读回、完整会话、附件、成果、Skill、专家、MCP 和工具调用证据。
- 每个 Case 生成不可变证据目录、`case-result.json` 和 `evidence-manifest.json`。
- 自动生成原始报告、截图图集、二次可信复核、框架修复清单和结果 Excel。
- 对协议漂移、发布身份漂移、缺少执行器、缺少 fixture、证据不完整、SHA 不一致和重复 runner 执行 fail-closed。

框架不负责：

- 修改 `/Users/qifu/Documents/deepbankV2`。该仓库对 QA Agent 只读。
- 用模拟文本冒充真实产品动作、真实工具调用或真实故障注入。
- 将 raw `passed` 直接当作可信通过或生产放行。
- 在缺少环境、账号、控制器或证据时补写结果。

## 2. 唯一可信入口

框架自动按 Case 契约分流：

- `qbot-core-beta/v2`：`src/lib/ui-agent-casebook-runner-v2.mjs`
- 现有 V1/V2/V4 与生产 Case：`src/lib/ui-agent-casebook-runner.mjs`
- 统一 CLI：`node src/cli.mjs ui-agent-casebook-run`
- 360Teams 正式包适配：`npm --prefix teams360-automation run casebook`

不要直接调用内部 runner 文件。统一入口会先读取 Casebook，再按 `contract_version` 选择执行器；同一批次混用 Core Beta v2 和其他协议会被拒绝。

当前标准门禁 Casebook：

| 用途 | 文件 | Sheet | Case 数 | SHA-256 |
|---|---|---|---:|---|
| 核心内测 | `PRD/QBot核心内测门禁Casebook_74条_2026-07-31.xlsx` | `核心内测Case` | 74 | `25c1c3df11e3d65ec0927edd5ddd2e693aa4bfdccdb92899fe3344a7f7dbe8f6` |
| QWork 核心生命线门禁 | `PRD/QBot核心生命线与新增MR生产灰度全量回归Casebook_16-12-70-160条_2026-09-05-r14.xlsx` | `核心生命线门禁` | 16 | `439f14686df4a1623015e3964b61a6943455c804938be2680a8d6fedde9bf2ed` |
| 生产灰度发布 | `PRD/QBot核心生命线与新增MR生产灰度全量回归Casebook_16-12-70-160条_2026-09-05-r14.xlsx` | `生产灰度门禁Case` | 70 | `439f14686df4a1623015e3964b61a6943455c804938be2680a8d6fedde9bf2ed` |
| 全量正常功能回归 | `PRD/QBot核心生命线与新增MR生产灰度全量回归Casebook_16-12-70-160条_2026-09-05-r14.xlsx` | `全量功能回归Case` | 160 | `439f14686df4a1623015e3964b61a6943455c804938be2680a8d6fedde9bf2ed` |
| QWork 日常回归 | `PRD/QWork日常回归自动化Casebook_最新变更回归_2026-08-18.xlsx` | `日常回归` | 83 个顶层 / 144 个叶子 | `c412ee6fc362cf613d599541151f766390c3e4281f6bcf2ab69f9d59346a76e6` |
| QWork 新增 MR 核心冒烟 | `PRD/QBot核心生命线与新增MR生产灰度全量回归Casebook_16-12-70-160条_2026-09-05-r14.xlsx` | `新增MR核心冒烟` | 12 | `439f14686df4a1623015e3964b61a6943455c804938be2680a8d6fedde9bf2ed` |

### 2.1 QWork 分层止损发布流程

同一候选发布唯一允许的执行顺序是：

1. `G0 静态与发布身份门禁`：框架 `main == origin/main` 且 tracked clean，Casebook
   路径/SHA、发布身份十字段、唯一 runner/宿主/session/CDP、WebView、公开
   capabilities、runtime release status 和 SIT health 全部精确成立。
2. `G1 核心生命线门禁`：16 条最小但完整的核心用户生命线。只有 16/16 真实执行、
   manifest 完整且逐 Case `trusted_pass`，才能启动 G2。
3. `G2 新增 MR 变更冒烟`：12 条固定有序 Case。只有 12/12 逐 Case 可信全绿，才能
   启动 G3。
4. `G3 生产风险门禁`：70 条完整串行风险门禁。只有 70/70 逐 Case 可信全绿，才能
   启动 G4。
5. `G4 全量正常功能回归`：160 条完整串行回归；前 70 条必须与 G3 同序同合同。
6. `G5 稳定性与受管重启 Soak`：至少 100 个任务、3 次受管重启、0 crash、无资源
   泄漏且证据完整。完成后才可进入既有五轮 70 条聚合门禁。

G1 固定顺序为：`BETA-INIT-001`、`BETA-INIT-002`、`BETA-INIT-003`、
`BETA-INIT-004`、`BETA-CHAT-001`、`BETA-CHAT-002`、`BETA-CHAT-007`、
`BETA-FILE-001`、`BETA-ART-001`、`BETA-TASK-008`、`BETA-HOST-003`、
`BETA-SEC-002`、`BETA-ROUTE-001`、`SIT-SKILL-007`、`SIT-HOME-002`、
`SIT-CONN-016`。能力审计必须为 16/16 executable、dispatchable、directly
runnable，其中 11 条 native、5 条 verified legacy，且
`strict_controller_required=0`、`unsupported_runtime=0`。

完整且同序、Case 类型和 `qbot-core-beta/v2` 均精确匹配的 G1 使用
`qwork-core-lifeline/v1` 合同：每条 Case 仍必须具备完整生产元数据、硬门禁和冻结发布
输入，但 16 条最小生命线不承担 G3/G4 的八大风险域全集覆盖，因此不得因缺少仅属于
后续风险层的域而在 Case 0 前误阻断。任一数量、顺序、ID、类型或协议漂移都会失去该
合同并恢复 `production-risk-gate/v1` 的完整风险域检查，继续 fail-closed。

G1-G4 每个阶段都必须使用独立能力审计、独立精确 `READY`、独立不可变执行目录和
逐 Case 可信复核；阶段之间不得继承结果。任一阶段出现产品 Bug、可信失败、可信阻塞、
framework/testcase issue、证据缺失、身份漂移或非精确 READY，当前候选立即 `NO_GO`，
所有后续阶段保持 `NOT_STARTED`。当前阶段可按现有安全策略完成独立 Case 诊断，但绝不
因此解锁下一阶段。raw `passed/failed`、诊断目标通过率和人工口头判断都不能驱动准入。

状态机只接受 `qbot-core-beta-pretest/v1` 的 Teams/production-gate/mandatory 报告；
`blockers` 必须显式为空，全部 checks 必须显式 `passed`，且 Git、唯一 runner、Casebook、
协议、发布身份、capabilities、runtime release、待激活更新和 health 等 G0 关键检查不得
缺项。仅修改顶层 `status=READY` 或伪造身份 fingerprint 永远不能获得阶段准入。

机器化编排入口为 `npm run qwork-release:orchestrate`。`init` 只接受新的控制目录、
文件名与 SHA 均精确匹配本节 r14 合同的正式 Casebook、十字段发布身份和强制
`--release-intake`；调用者还必须独立提供
`--expected-release-ref origin/release/0.1` 与当前观测的 40 位
`--expected-release-head`，以及独立普通文件
`--expected-release-observation <qbot-qwork-release-ref-observation/v1>`。观测文件必须与
intake 路径不同，固化来源、时间、仓库、ref、HEAD 和文件 SHA；本地 Git 来源还要以
只读 `rev-parse` 对账。私有仓库优先用 `npm run qwork-release:observe` 从关闭回显的
stdin 注入只读 token，固定查询 deepbankV2 GitLab API 两次并证明 HEAD 稳定；状态机命令
同样携带 `--gitlab-token-stdin` 做独立实时复核。三者必须全等，禁止从待验证 intake 自身
回填期望值。
`--gitlab-token-stdin` 在扫描器、独立观测器和状态机中都只能作为无值布尔开关单独传入；
`--gitlab-token-stdin=<value>`、后随参数值或重复开关必须在读取 stdin 前拒绝，错误不得
回显疑似 token。token 仍只能通过关闭回显的标准输入注入。
省略任一输入或显式传入 `--require-release-intake false` 都必须在创建控制状态前拒绝，
历史可选绑定不能作为正式计划。`readiness`
校验能力审计与 pretest 的精确 Case ID
顺序；`complete` 校验真实进度、未停止批次、完整 manifest、可信复核、选择的 Case ID
顺序和发布身份；`soak` 校验 G5。状态机只允许按 G0 -> G5 顺序推进。

控制目录固定包含 `release-test-plan.json`、`release-test-state.json`、
`release-test-integrity.json` 和 `events/*.json`；plan/state/integrity/event 均使用明确不兼容
的 `v2` schema，旧 `v1` 控制树不得静默续跑。所有命令必须持有 macOS `lockf` 或同等级
进程生命周期 advisory lock，崩溃遗留的普通锁文件不得形成 stale lock；控制目录及写入
目录必须由当前用户拥有、禁止 group/other 写入，并在耗时校验和每次写入前后复核
dev/inode/uid/mode。计划与状态分别计算独立 SHA-256，状态
每次变更必须令 `revision` 精确加一；每个事件记录变更前后 revision/state SHA，并以
`previous_event_sha256` 形成前向哈希链。任何计划、状态、integrity、事件数量、事件顺序、
历史事件或末事件 SHA 被改写，后续 `status/readiness/complete/soak` 都必须 fail-closed。
初始状态必须可由计划确定性重建并由 `initial_state_sha256` 锚定；每个事件必须同时保存
完整 `state_before/state_after`，加载时用事件的 `audit/phase/recorded_at` 重新执行状态
转换并与快照、链尾状态逐字节哈希对账，单纯重算事件链哈希不能绕过语义重放。
`init` 必须在同父目录的私有 staging 中完整 fsync 后一次原子 rename，不能暴露半控制树；
阶段更新必须先保存 write-ahead transaction，再写 event/state/integrity；若进程在其间退出，下一次持锁加载只可
回滚尚未提交事件的事务，或用严格绑定的尾事件幂等补齐 state/integrity，任何其它组合均
fail-closed。独立 release observation 必须先证明仓库 origin 是规范 deepbankV2 项目，再
实时查询 release ref：受管 Git credential 路径要求 remote、观测 HEAD、本地
remote-tracking ref 全等；stdin API 路径固定主机/项目、强制 HTTPS/TLS，并以两次稳定
branch read 与观测 HEAD 全等，不依赖本地陈旧 ref。只修改 origin URL 后复用旧观测无效。
观测输出目录必须从未存在，禁止复用调用前已经存在的空目录；创建和写入前后必须校验
全部祖先无符号链接、父目录与目标目录属于当前用户且不可被 group/other 写入，并绑定
父目录和目标目录的 dev/inode/uid/mode。观测 JSON 必须以 `O_EXCL/O_NOFOLLOW` 私有普通
文件落盘、fsync 并校验字节数与权限，任一漂移都必须 fail-closed。
`NO_GO` 不可逆，已登记的 readiness/completion 不得覆盖；修复后只能为新候选或新一轮
创建新的空控制目录，禁止手工改状态解锁后续阶段。

`complete` 不只看总数：summary、progress、run metadata 与可信复核中的 Case ID 必须
全部与本阶段准入顺序一致；summary 必须为 `passed` 且 raw passed=N、其它 raw 计数为
零，逐 Case manifest 必须为 `qbot-core-evidence/v2`、绑定同一 Case、非空 evidence 中
每项 `valid=true/missing=false/bytes>0/SHA-256`，missing/invalid role 为零。同时必须
证明 mandatory、M3、`core-beta-v2-forced-serial`、effective parallel=1、
single-host-pipeline=1、唯一宿主 PID、framework clean、无 stop diagnostic、
`executed=N/inherited=0/synthetic=0` 和十字段身份不漂移；任一缺失都不得 `PASS_STAGE`。

完成审计不能只信嵌入 summary 的 manifest：必须从每个 Case 目录重新读取磁盘
`evidence-manifest.json`，要求它与 progress/summary 中嵌入的 manifest 结构化全等；再对
每项证据执行 `lstat`，拒绝符号链接、目录和 Case 目录越界，实读文件字节数与 SHA-256
并与 manifest 精确比对；run/cases/Case/manifest/证据的每级祖先都必须非符号链接，且
realpath 仍位于不可变 run 根内。可信复核也必须是 run 根内普通文件，审计固化其实读
SHA-256；每个 Case 必须显式 `trusted=true` 且分类为 `trusted_pass` 或
`可信通过-用户可接受`，缺字段不能由总计数放行。Teams `run-metadata.json.profile` 的真实合同是
`{mode:"live", alias:"<non-empty>"}`，不是字符串 `mandatory`；`mandatory` 只从
summary 的 Casebook profile 校验。G0 也不能只信聚合 `ok`：公开 capabilities 必须可读
且为 object，health 必须逐字段满足 HTTP 200、DB/auth/auth.ready、环境和 backend
fingerprint，Teams/QWork/session、runtime 顶层/loaded/compatibility、
`updatePhase=idle`、`preparedRelease=null` 与十字段身份逐项一致，不得只凭身份字符串
或聚合状态推断。
G4 readiness 必须把自身前 70 个 Case ID 与状态机内已准入 G3 的 70 个 ID 精确同序比对，
不能只与静态 Casebook 自身做前缀比较。

每次 `readiness` 在写事件前都必须重新计算计划 Casebook 的磁盘 SHA，并重新验证当前
`branch=main`、`HEAD == origin/main == plan.framework.commit`、tracked clean，同时重读
独立 release HEAD 观测并校验文件 SHA。任一漂移直接拒绝且 revision/event 数保持不变。

G5 只接受磁盘 `qbot-qwork-soak-report/v1` 普通文件及其实读 SHA。报告必须列出至少 100
个唯一、真实执行且有时间/身份/独立证据的 task，至少 3 次受管重启的前后 PID、session、
CDP、恢复结果与证据，`startup/run-final` 和每次重启后的十字段身份观测，显式空 crash
账本，以及含阈值、至少两次采样和 `no_leak` 结论的资源账本；所有证据逐文件执行同一
祖先、realpath、bytes 和 SHA 校验。自报计数或单个 `passed=true` 不能解锁 G5。

#### G0 十字段权威身份合同

G0 的十字段不能只来自 CLI、环境变量、历史报告或人工作业记录。调用者仍须传入
预期值，但 pretest 必须通过 `qwork-release-identity-readback/v1` 从受管宿主、公开
runtime、OTA state/envelope 和当前已安装制品独立读回，再与预期逐字段全等：

| 字段 | 权威观测来源 |
|---|---|
| `teams_version` / `teams_build` | 当前受管 360Teams 应用包、进程与 session |
| `qwork_version` | versioned file URL、OTA `active/lastGood`、envelope、loaded runtime |
| `control_plane_origin` | 受管 session、renderer 实际配置与 health 请求 origin |
| `backend_version` | `GET /api/health/ready` 的环境与 fingerprint 组合值 |
| `prompt_policy_version` | `qwork-runtime-<version>-sha256-<desktop-agent-runtime.cjs SHA256>` |
| `feature_flags_hash` | `qwork-ui-code-manifest/v1` 对 `index.html` 和全部 JS/CSS 的规范化 SHA-256 |
| `qwork_ui_git_commit` | OTA active envelope `commitId`，并与公开 runtime `commitId` 全等 |
| `qwork_build_id` | OTA active release `id/version` 与 URL/state 版本交叉读回 |
| `qwork_release_manifest_sha256` | active envelope 原始文件字节 SHA-256，不是重排后的 JSON hash |

`feature_flags_hash` 是历史 CLI 字段名；在当前发布合同中的精确定义是上述 UI 代码
manifest SHA，不能替换成服务端 flags 文案、命令行任意 hash 或只计算入口 HTML。
`prompt_policy_version` 同理必须由当前安装的 desktop Agent runtime 字节派生，不能复用
上一候选值。

权威读回还必须证明：OTA `active == lastGood`、`pending=null`；state/envelope/release-set
identity 一致；host-core 缓存 archive 的实际 SHA-512 与 state/envelope 一致；UI 和
qbot-core `.installed.json` 为 ready、版本正确，其 integrity 精确等于 envelope asset
descriptor 的 SHA-512 fingerprint；目录和文件均为普通非符号链接且 realpath 不越出
release home；runtime 顶层、loaded、compatibility、commit、host-core digest 一致，
loaded runtime `verified=true`、`updatePhase=idle`、`preparedRelease=null`。任何字段
缺失、制品篡改、符号链接、路径逃逸、候选待激活或 runtime 漂移都必须在 Case 0 前
`BLOCKED`。

正式 runner 必须在 `startup`、每次 `replacement-renderer` 和 `run-final` 重做同一
权威读回。`run-metadata.json.release_observation` 固化首个基线，
`release_observation_checks[]` 追加各阶段 observation/state/envelope SHA；结束准入至少
要求 `startup + run-final`，任一重连观测也必须与基线全等。缺少结束观测、任何阶段
`ok!=true` 或 SHA 漂移时，即使所有 Case raw passed、可信计数全绿，也不得
`PASS_STAGE`。所有 `--production-gate true` 的 Teams 批次都必须显式携带匹配 READY 的
`--control-plane-url`，不只限于 `BETA-*` Case。

QWork 新增 MR 核心冒烟合同固定为以下 12 条有序 Case：
`MRSMOKE-ACT-001`、`MRSMOKE-WEB-001`、`MRSMOKE-WEB-002`、
`MRSMOKE-AUTH-001`、`MRSMOKE-AUTO-001`、`MRSMOKE-NAV-001`、
`MRSMOKE-ROUTE-001`、`MRSMOKE-SKILL-001`、`MRSMOKE-FAIL-001`、
`MRSMOKE-ART-001`、`MRSMOKE-ENTRY-001`、`MRSMOKE-CHART-001`。静态审计必须为
`12/12 executable`、`12/12 dispatchable`、`12/12 directly runnable`，其中
6 条使用原生 driver，6 条使用经过语义复核的 legacy driver，且
`strict_controller_required=0`、`unsupported_runtime=0`。只有完整数量、固定顺序、
固定 Case 类型和 `qbot-core-beta/v2` 全部精确匹配时，才允许使用
`qwork-mr-core-smoke/v1` 合同而不套用 70/160 的八大生产风险域完整性检查；任何
缺失、乱序、ID 或类型漂移都必须恢复生产风险域检查并在 Case 0 前 fail-closed。

该 12 条只承担新增 MR 的端到端核心冒烟：活动流、Web 搜索成功与 SSRF 拒绝、
工作空间授权边界、interval 到点调度、侧栏布局、同任务路由稳定、Skill 任务隔离、
失败脱敏、成果精确目录、新任务隔离和 qcharts-react 交互图表。原手工 Casebook 仍是主观视觉细节、极端参数
矩阵、首次系统权限/升级重启、多账号或受保护资源等人工边界的依据；12 条通过不得
替代这些手工检查，也不得等同于生产灰度门禁通过。

12 条不是首道部署门禁。它只允许在 G1 核心生命线 16/16 可信全绿后启动；其通过也
只能解锁 G3，不能替代 70/160 或 soak。G1-G4 均使用同一重新读回的冻结发布身份、
独立不可变输出目录、唯一 runner 和 Case 间串行，始终为 `inherited=0`、
`synthetic=0`。

`MRSMOKE-AUTO-001` 必须使用服务端合同允许的最小 `intervalMs=60000`，并以当前
时刻作为 `activeFrom`。服务端创建合同会把过去的 `activeFrom` 钳制到服务端当前
时刻，禁止再通过“回填一个 interval”伪造短期到点。runner 必须禁止 `runNow`，等待
真实 schedule occurrence，核对 occurrenceKey、scheduledFor/scheduledAt、sessionId
与 succeeded 终态。定向删除定义后还必须显式调用公开 `refresh()`，在有界窗口内
连续读回目标定义消失；DELETE 200 或本地异步 refresh 动作本身不能替代终态对账。

本版 r14 以 GitLab API freshness 从 r12 设计基线
`4693c5bd57b1170bed530e7559f9dc93a0b4a492` 扫描到
`origin/release/0.1@0cfdfa1ec9f18d2ef2e78d380b4b2896c6dc607c`。r14 继承 r12 已验证的
134 个 MR，并按 first-parent 顺序新增验证 36 个直接合入 MR，共审计 170 个；增量 IID
依次为：!1527、!1532、!1531、!1500、!1528、!1530、!1537、!1535、!1533、!1539、
!1529、!1538、!1536、!1541、!1544、!1547、!1548、!1546、!1540、!1550、!1511、
!1552、!1558、!1556、!1549、!1557、!1559、!1561、!1560、!1564、!1563、!1566、
!1568、!1569、!1570、!1572。全部 MR 的 changed paths、风险域、直接 Case、依赖闭包
和覆盖强度以工作簿 `近2天MR覆盖` 及绑定的 release intake 为准；静态合同不得冒充
桌面 E2E 结果。

r13 候选 `QBot核心生命线与新增MR生产灰度全量回归Casebook_16-12-70-160条_2026-09-04-r13.xlsx`
因 `MRSMOKE-WEB-001` 四轮 prompt/Oracle 不完整、`BETA-TASK-002.source_id` 重复，以及
生成器未在正式复制前强制四个 Sheet 的 protocol/runtime 审计而判定 `FAILED`，永久保留
但不得提交为正式入口或用于执行。r14 已修复上述问题，并在正式复制前要求 G1/G2/G3/G4
协议与 runtime 全绿；独立验收为 16/16、12/12、70/70、160/160，14 个 Sheet、15 张
渲染和公式检查全部通过。

r15 当前仅是待生成候选，目标文件名为
`PRD/QBot核心生命线与新增MR生产灰度全量回归Casebook_16-12-70-160条_2026-09-05-r15.xlsx`；
该文件尚未生成，也没有可登记的正式 SHA-256。生成、导出后审计、独立验收和干净 pushed
framework 基线全部完成前，r14 继续是唯一正式执行入口，任何 pretest、状态机或 runner
都不得提前切换到 r15，也不得为 r15 填写占位 SHA。最新只读设计 intake 为
`outputs/20260905133500_release01-r15-refresh-design-intake_framework-e23ea8f_casebook-r14/release-intake.json`，
文件 SHA-256 为 `a13c61b3c640462fc1465390671faf0ff5065132a260b640f887272b198b1370`；它只证明 r14
终点之后新增的 `!1573` 已合入 `origin/release/0.1@6d482c9ccbceb74d4ebf81610d980e5fe15def6c`，
用于设计映射，不具备生成或执行授权。正式生成前必须在最新干净 pushed framework commit
上从 r12 产品基线 `4693c5bd57b1170bed530e7559f9dc93a0b4a492` 以 `--max-commits 500`
重新完成 GitLab API 全量扫描；若 release HEAD 仍为上述提交，应得到 37 个 first-parent
增量 MR、171 个总 MR，并包含 `!1573` 的专用源码合同。本轮共 37 个增量 MR，累计 171 个总 MR。
Casebook 生成器只能显式接收该新
普通文件的 `--release-intake`、与文件实际字节重新计算值全等的
`--release-intake-sha256`、同一 `--expected-product-commit` 和非空 `--out`；
`!1573` 的桌面相邻映射固定同序为 `SIT-MEM-001`、`BETA-CHAT-001`、
`BETA-CHAT-002`、`BETA-CHAT-009`、`BETA-SEC-002`、`BETA-MCP-001`、
`BETA-MCP-002`、`BETA-HOST-003`、`BETA-INIT-001`、`BETA-ROUTE-001`、
`MRSMOKE-ROUTE-001`；内部 Feature/Recall/MCP 跨 session cadence、直属上级 Profile
归一化、bridge/host/runtime 接线和本地记忆关闭只由
`deepbankv2-mr-1573-memory-session-profile-stability/v1` 鉴证源码与测试声明，
`claim_scope=source_and_test_declarations`、`test_execution_attested=false`，不得用桌面
相邻链通过冒充这些内部合同已执行或通过。
`--out` 在调用前必须不存在，即使已存在目录为空也禁止复用。已存在的
`outputs/20260905_release01_casebook_16-12-70-160-r15` 因而无资格作为正式生成目录。
正式 r15 目标文件也必须在调用前不存在，生成器只能在 G1/G2/G3/G4 导出后协议与 runtime
能力分别达到 16/16、12/12、70/70、160/160 后原子排他发布；任何已有目标、审计失败或
中途产物都不得覆盖 r14 或取得正式身份。
生成器不得直接在 `--out` 或正式 `PRD` 目标中边构建边暴露文件：`--out` 的全部祖先必须
无符号链接，父目录和同父目录私有 staging 必须由当前用户拥有且禁止 group/other 写入，
并在构建前后绑定 device/inode/uid/mode。staging 树只允许当前用户拥有、不可被
group/other 写入且 link count 为 1 的普通文件/目录；全部文件和目录 fsync 后，只能通过
macOS `renamex_np(RENAME_EXCL | RENAME_NOFOLLOW_ANY)` 将 staging 一次排他原子提交为调用前
仍不存在的 `--out`；普通可覆盖空目录的 `rename` 不符合合同。正式 xlsx 必须从该已提交 artifact
重新实读，以 `O_EXCL|O_NOFOLLOW`、`0600` 临时普通文件写入并 fsync，再通过同目录 macOS
`renamex_np(RENAME_EXCL | RENAME_NOFOLLOW_ANY)` 排他原子发布，并复核 bytes/SHA-256/inode/link
count。目标抢占、祖先或目录
替换、symlink/hardlink、权限漂移或任一故障注入都必须 fail-closed；正式目标不得出现，
已经完成的诊断输出目录也不得被复用续写。
目录发布事务的状态固定为 `prepared -> renamed_pending_commit -> parent_synced -> committed`；
rename 之后直到父目录 fsync 和最终目录身份复核全部完成前都不得声明提交。正式文件事务
固定为 `prepared -> renamed_pending_commit -> parent_synced -> verified_pending_commit ->
committed`；排他 rename 后，父目录 fsync 和最终 bytes/SHA-256/inode/link count 复核任一
未完成时仍属于 pending。`committed` 之前任一步失败都必须先将本事务对象排他隔离到同父
目录 quarantine，并按冻结的 dev/inode/uid/size/SHA-256/mode 复核后保留，禁止按可变的
原最终名、临时名或 quarantine 名删除。身份冲突时必须恢复并保留第三方对象、报告
`rollback_conflict`；无法完成隔离、复核或恢复时报告 `rollback_incomplete`。成功提交不得
遗留任何 staging 或 quarantine；失败路径必须报告所保留对象的精确路径。

本版 r12 以 GitLab API freshness 从 r11 设计基线
`1970fe47ac681b36242b0be5c4175238f7d9918b` 扫描到
`origin/release/0.1@4693c5bd57b1170bed530e7559f9dc93a0b4a492`。扫描前后 branch HEAD
必须一致，compare first-parent 链必须完整，每个直接 merge commit 必须精确绑定一个
`state=merged`、`target_branch=release/0.1`、merge SHA 全等且 changes_count 完整的 MR；
任一漂移、compare 超时/缺失、changes overflow 或元数据不一致都必须 `BLOCKED`。
r12 继承 r11 已验证的 132 个 MR，并新增 2 个直接合入 MR `!1523`、`!1522`，共审计
134 个。r11 继承 r10 已验证的 131 个 MR，并新增 1 个直接合入 MR `!1526`。
r10 继承 r9 已验证的 130 个 MR，并新增 1 个直接合入 MR `!1516`。
r9 继承 r8 已验证的 73 个 MR，并新增 57 个直接合入 MR；其新增同序 IID 为：
!1459、!1462、!1393、!1430、!1463、!1464、!1465、!1468、!1466、!1469、!1454、
!1458、!1467、!1471、!1470、!1473、!1472、!1476、!1461、!1475、!1460、!1480、
!1477、!1484、!1481、!1494、!1474、!1488、!1495、!1496、!1491、!1492、!1498、
!1499、!1485、!1501、!1479、!1490、!1486、!1489、!1504、!1506、!1483、!1487、
!1497、!1508、!1512、!1514、!1515、!1509、!1503、!1513、!1518、!1519、!1524、
!1521、!1520。产品行为变更映射到现有 16/12/70/160 真实 Case；Dashboard、CI、eval、
文档/治理和纯可观测性变更保留静态合同审计，不新增桌面 QWork E2E Case，也不计入
16/12/70/160 桌面通过。新增合同还必须满足：

- !1359 的混合附件部分失败路径映射 `BETA-FILE-005/006/007` 与 `SIT-HOME-056`，核对有效附件保留、逐文件拒绝和原子回滚语义。
- !1361 的 Skill 安装 runtime fetch 注入映射 `MRSMOKE-SKILL-001` 与 `BETA-SKILL-001/002/003/004/005/014`，核对真实安装事务仍可复现且不会意外下载运行时。
- !1364 的编码 Windows 本地文件路径映射 `MRSMOKE-ART-001`、`BETA-ART-001` 与 `BETA-FILE-005`，核对 Markdown 文件链接解析、预览和打开入口。
- !1358 的成果按会话隔离映射 `MRSMOKE-ART-001` 与 `BETA-ART-001/002/003/004`，核对并行会话成果不串台。
- !1365 的自动化列表与响应式操作映射 `MRSMOKE-ACT-001`、`MRSMOKE-NAV-001`、`MRSMOKE-ENTRY-001` 与 `BETA-CHAT-007`，核对真实任务列表操作和侧栏/入口布局。
- !1428 的 Claude SDK 重试/fallback 变更映射 `MRSMOKE-FAIL-001`、`MRSMOKE-ROUTE-001`、`BETA-CHAT-005` 与 `BETA-PERF-003`，核对失败收敛、路由与长文本恢复。
- !1430 的首次工作台引导弹窗映射 `MRSMOKE-NAV-001`、`MRSMOKE-ENTRY-001`、`BETA-CHAT-007`、`SIT-INIT-002` 与 `SIT-HOME-051`，核对入口、侧栏和首次使用布局。
- !1443 的用户 workplace profile 注入映射 `MRSMOKE-AUTH-001`、`BETA-CHAT-001` 与 `BETA-CHAT-009`，核对组织上下文与脱敏边界。
- !1450 的 OTA quarantine loop 映射 `BETA-INIT-001` 与 `BETA-HOST-003`，核对运行时更新状态和宿主身份收敛。
- !1451 的 Claude fallback alias 映射 `MRSMOKE-FAIL-001`、`MRSMOKE-ROUTE-001` 与 `BETA-CHAT-005`，核对 fallback 身份和错误脱敏。
- !1374 的 Auto fallback/catalog authority 变更映射 `MRSMOKE-ROUTE-001`、`MRSMOKE-FAIL-001`、`BETA-CHAT-005` 与 `BETA-PERF-003`，核对 Auto fallback 来源、路由稳定性和长文本恢复。
- !1520 的 SDK 解压让出事件循环变更映射 `BETA-INIT-001/003`、`BETA-HOST-003`、`MRSMOKE-NAV-001` 与 `SIT-TEAMS-NEW-001/003`，核对运行时物化期间 Teams Tab 切换和宿主身份不阻塞。
- !1516 的 VPN 未连接明确提示与 retry 埋点变更精确映射 `MRSMOKE-FAIL-001`、`MRSMOKE-ROUTE-001`、`BETA-CHAT-005` 与 `BETA-PERF-003`，核对 VPN 错误提示、内部错误脱敏、同任务路由恢复、续写文案优先级与长文本重试收敛；禁止按文件名启发式泛化到其它 Case。
- !1526 的 Skill/Connector 误阻断修复与助手消息布局变更精确映射 `MRSMOKE-SKILL-001`、`MRSMOKE-FAIL-001`、`BETA-CHAT-006` 与 `BETA-PERF-003`，核对原生 Skill 判定不被服务端提前拒绝、连接器两次参数失败后同任务第三次可恢复成功，以及停止/长文本消息四层横向边界；禁止按目录或标题启发式泛化到其它 Case。
- !1523 的 Web 搜索固定次数误导修复精确映射 `MRSMOKE-WEB-001`、`MRSMOKE-WEB-002`、`BETA-CHAT-005` 与 `SIT-CONN-019`；只有 `MRSMOKE-WEB-001` 执行同一 task 四轮真实 provider 调用，`SIT-CONN-019` 保持单轮质量验证，禁止按 web 文件名启发式泛化。
- !1522 的 Claude Code SDK Header 注入变更精确映射 `MRSMOKE-ROUTE-001`、`BETA-CHAT-001`、`BETA-ROUTE-001` 与 `BETA-HOST-003`；Header 字节只由源码静态合同审计证明，桌面 E2E 只证明同任务多轮、fallback 连续性和宿主/runtime 稳定性，不声称 UI 或桌面证据已证明 Header 注入，禁止按 runtime 文件名启发式泛化。
- release intake 的 !1522 源码合同固定为 `deepbankv2-mr-1522-claude-turn-headers/v1`：
  merge SHA 必须为 `4693c5bd57b1170bed530e7559f9dc93a0b4a492`，完整 changes 必须恰为
  5 项，规范化 MR diff 必须为 18038 bytes、SHA-256
  `f1a9b0af3a286e55add0af61b7703af6f85a003d955ab7b6cdbe4704a6de4c80`。
  新文件 `server/qbot-core/models/claude-turn-headers.mjs` 必须可从 GitLab diff
  无损重建为 3673 bytes、111 行、SHA-256
  `e81904c2527675117a74d8227b1ee2761bfeb59093c7a4b65c63c4d4f5fcd62d`，并逐行唯一证明
  `User-Agent`、`x-session-id`、`x-turn-id`、`x-request-id`、`x-request-time` 的精确
  value source；同时必须逐行唯一证明宿主传递当前 turnId、引擎注入 Header、fallback
  保留 turnId 和复用 request context。报告必须包含带自身 SHA-256 的完整 attestation，
  与 MR 行通过 `source_contract_ids` 双向绑定并计入 summary；任一 merge/diff/源码字节、
  Header、接线、绑定、计数、attestation 缺失或伪造都写入 unresolved 并令 G0 `BLOCKED`。
- !1329 及同类 CI、Dashboard、eval、研究物料、工具链、version-only 变更只做静态合同审计；明确不新增桌面 QWork E2E Case，也不计入 16/12/70/160 桌面通过。

- `SIT-HOME-044` 的 picker/paste/drag 三入口统一进入 FileInput 合同；81 MiB
  必须发送前拒绝且保持零 task/消息/send，拒绝第三份不能抹去前两份附件。
- `MRSMOKE-AUTH-001` 与 `SIT-WORKSPACE-001` 删除本 Case cwd 后，必须在原 task
  重发并用 `workspace_missing_error_readback` 证明结构化
  `chat.workspace.cwd_missing`、原 cwd、`retryable=false` 和内部字段不泄漏。
- Web 搜索业务 Oracle、同 task runtime authority/provider receipt 与真实外链点击
  终态必须分离取证；外链结果使用 `external_navigation_trace` 记录
  `preview | external | blocked`，禁止把回复文本当成点击证据。
- `MRSMOKE-WEB-001` 必须在同一非空 task 连续四轮确认发送，每轮分别绑定唯一
  prompt SHA、runtime authority、materialized `builtin:qbot_web`、provider receipt 和
  截图，并生成 `web_search_quota_trace`。四个 provider receipt 必须有效且唯一，第四轮
  仍须完成真实 Web 调用且不得出现“最多三次”“额度用尽”“固定上限”“服务端拒绝”或
  `You can only search three times`、`The server rejected the fourth search`、
  `The search quota has been hit` 等同义误导；
  `SIT-CONN-019` 仍为独立单轮 Web 质量 Case，不得被四轮逻辑扩张。
  manifest 不能相信 trace 内自报的 prompt/截图元数据：必须以权威 Case 目录重新读取
  trace，逐轮重算 trim 后 prompt SHA，对四张唯一截图执行 lexical + realpath 边界检查和
  `lstat`，拒绝符号链接、目录、越界、非 JSON trace、过小截图，再按磁盘实际 bytes 与
  SHA-256 对账。`evidence_valid=true/oracle_valid=false` 的完整产品拒绝证据仍可进入
  manifest，不得误升为 framework issue。
- `MRSMOKE-SKILL-001` 固定路由到组合 driver `SIT-SKILL-MR-001`；成功依赖安装、
  失败依赖回滚与任务 A/B 隔离必须使用 6 个确定性 Fixture，并以
  `qbot-skill-install-attempt-ledger/v2` / `skill_install_attempt_ledger` 绑定
  personal scope、installAttempt、operationId、提交和回滚终态。通用 Fixture 准备
  只能定向清理作用域 Skill，不得在两笔事务前预装；必须先固化成功提交与失败回滚的
  双 attempt ledger，再从零 task、零消息、零发送、空能力草稿真实安装
  `qa-scope-isolation`，安装成功后才能进入任务 A/B 隔离。若安装被产品明确拒绝，必须
  以 `stage=skill_installation` 保存动作绑定失败、已安装库存目标不存在、前后截图、
  零发送守卫和受校验 N/A 角色；安装前后双 attempt ledger 的 SHA-256 必须字节级不变。
- `MRSMOKE-SKILL-001` 还必须生成 `skill_execution_trace`，将任务 A 的确认发送、同一
  taskId、原生 `Skill` tool-use/result、runtime authority、provider receipt 和截图绑定。
  Skill 是否可用由 Claude Code 原生工具执行结果判定；服务端提前返回
  `skill_runtime_materialization_unavailable`、`installed-but-not-mounted` 或
  `unknown skill` 属于产品 Oracle 失败，证据完整时不得误判为框架缺口。
- `MRSMOKE-FAIL-001` 使用原生 `qwork_mr_connector_retry_recovery` driver：保留原凭据
  脱敏检查后，在同一 task 依次对 `qbot_chart/render_chart` 发送两次空 data 参数和一次
  合法四点柱状图参数。三轮分别绑定 prompt SHA、确认发送、同一 taskId、tool-use/result、
  runtime authority、provider receipt 和截图，并生成 `connector_retry_recovery_trace`；
  前两轮必须是真实参数失败，第三轮必须真实成功，禁止 `connector_circuit_open` 或
  “本轮不再重试”。取证完整性与产品 Oracle 使用 `evidence_valid/oracle_valid` 分离。
- `BETA-CHAT-006` 与 `BETA-PERF-003` 必须生成 `horizontal_overflow_readback`，分别从
  assistant body、assistant message、message list 与 document 四层读取横向边界；任一层
  `scrollWidth-clientWidth>1px` 为产品 Bug，DOM/截图或 Case 绑定缺失才是框架问题。
- `MRSMOKE-CHART-001` 与门禁 `SIT-CONN-016` 必须绑定同一确认发送、taskId、session、
  runtime authority、provider receipt 和 `qbot_chart/render_chart` tool part；专项角色
  `interactive_chart_readback` 分离 `evidence_valid` 与 `oracle_valid`。合法 type/data
  四点 envelope 必须以唯一 `[data-testid="qcharts-react-container"] svg` 交互渲染，
  四个标签和固定数值可读，不得退化到静态或失败 fallback，四层横向边界为零，助手
  正文不得泄漏 SVG data URI、base64 或长编码。

`QBot生产灰度发布门禁Casebook_70条_2026-08-10.xlsx` 和
`QBot完整生产灰度门禁Casebook_184条_2026-08-03.xlsx` 只作为历史审计源保留，
不再是发布入口。其协议层 `executable=184` 不能证明真实执行能力；旧审计确认
其中 114 条依赖严格外部控制器。新版 70/160 两层要求
`directly_runnable=70/160`、`strict_controller_required=0`、
`unsupported_runtime=0`。160 条 Sheet 的前 70 条必须与门禁 Sheet 的 ID、顺序
和合同内容一致，后 90 条覆盖正常功能；网络异常、切换账号、受保护部署和纯故障
注入不进入这套常规回归。`BETA-REC-001`、`BETA-REC-002`、
`BETA-REC-004`、`BETA-TASK-003`、`BETA-EXPERT-016` 已从两个 Sheet 同步删除；
70 条门禁以 `SIT-SKILL-007`、`SIT-HOME-002`、`SIT-HOME-012`、
`SIT-HOME-013`、`SIT-CONN-016` 五条高频/高风险正常功能补齐，160 条全量再以五条
正常功能增量保持总数不变。
G4 的能力构成固定为 61 条原生/public-state、1 条原生 IME 选项和 98 条经过语义复核的
legacy executor，即 `61/1/98`；任一类别或总数漂移均须在能力审计阶段 fail-closed。

Casebook、Sheet、Case ID 顺序或 SHA 发生变化时，视为新测试合同，必须重新审计并更新本文。
当前待生成设计基线是 `origin/release/0.1@6d482c9ccbceb74d4ebf81610d980e5fe15def6c`，
产品版本 `0.1.7`；`/Users/qifu/Documents/deepbankV2` 始终只读。
本地 deepbankV2 缺少已验证历史 Git 对象时，Casebook 生成器允许以正式 GitLab API
intake 作为权威边界证明，但必须同时证明扫描前后 branch HEAD 稳定、compare first-parent
完整、每个 MR merge SHA 与目标分支全等且 changes `overflow=false`；任一字段缺失仍须
fail-closed。不得要求持续演进的 `origin/release/0.1` 永远指向旧设计提交，也不得因此
改写冻结合同。

全量 legacy 会话 Case 的 `conversation_turns` 必须复用 runner 的
`buildConversationTurns()` 生成真实交互轮次，并为每一轮写入非空 Oracle。
当前固定不变量为 `SIT-HOME-016=4`、`SIT-HOME-053=11`、
`SIT-HOME-058=2`、`SIT-HOME-060=2`、`SIT-EXPERT-022=2`；禁止把包含
“第一轮/第二轮”或长上下文脚本的完整测试数据压成一条 prompt。声明轮次优先于
运行时 fallback，因此轮次错误属于 Casebook 合同问题，必须在 capability audit
阶段失败，不得等正式批次中误判产品回复。

QWork 日常回归 Casebook 的 `A1:P84` 必须与用户提供的源工作簿 `日常回归`
Sheet 完全一致；其后机器列只承载自动化合同。70 个 `QW-*` 用户 Case 是
`compound` 父合同，严格按声明顺序串行执行叶子；13 个 `SIT-*` 是独立合同。
静态审计必须同时满足顶层 `83/83`、叶子 `144/144`、
`strict_controller_required=0` 和 `unsupported_runtime=0`。
静态协议预检还必须把复合父 Case 展开为真实叶子顺序，验证 Skill、Expert 和 MCP
账本依赖均在使用前由同一批次更早的叶子建立。缺少或逆序的上游不得拖到运行中
才抛异常；非 scoped 完整批次必须在 Case 0 前 fail-closed。`QW-ENTRY-002`
使用独立原生叶子 `QWD-ENTRY-002` 验证新任务默认 Auto、能力/附件/草稿隔离，
不得复用依赖 `BETA-SKILL-002~004` 账本的 `BETA-SKILL-011`。
`QW-WS-001` 固定使用独立原生叶子 `QWD-WS-001`，不得再映射到只覆盖默认工作区
和原生目录选择取消的 `SIT-HOME-052`。专项 driver 必须创建 Case 内唯一 A/B
目录与标记文件，通过公开工作空间 API 注册后，从新任务可见菜单按
`.wspick-path` 规范化全等匹配并真实点击 A/B；任务 A/B 必须形成不同 taskId，
各自公开 cwd 与标记回复必须匹配，已建 A 任务不得再显示可编辑工作空间入口，
重开 A 与 `listSessions` 中的两条 cwd 必须保持一致。无论成功或失败都只能定向
删除本 Case 注册的 A/B 路径，并保存 Case 内清理文件和 SHA。
`BETA-SEC-002` 与 `SIT-WORKSPACE-001` 的已授权目录 A 读取轮次必须使用专用
Case-aware Oracle：回复精确包含独立标记 `A_ALLOWED` 且不包含
`B_NOT_AUTHORIZED`、`PARENT_NOT_AUTHORIZED`、`SYMLINK_NOT_AUTHORIZED` 或
`TRAVERSAL_NOT_AUTHORIZED` 才可通过，禁止回退到中英文词面相关性。目录 A 写入轮次
必须确认已写入/创建/生成/保存、`result.txt` 或 `WORKSPACE_A_WRITE_OK`，任何明确
写入失败或秘密标记泄漏优先判失败；回复语义不能替代独立 artifact Oracle 对
`A/result.txt` 的位置、精确内容和 B 目录零同名文件读回。

## 3. 启动前硬门禁

每一轮必须按顺序执行：

1. 确认工作目录和框架提交：

   ```bash
   cd /Users/qifu/Documents/QbotTestAgent
   git fetch origin main
   git rev-parse HEAD
   git rev-parse origin/main
   ```

   正式门禁必须记录实际框架 commit。不要在执行中修改框架或 Casebook。

2. 校验框架：

   ```bash
   npm run check
   npm --prefix teams360-automation run check
   ```

3. 校验 Casebook：

   ```bash
   shasum -a 256 \
     PRD/QBot核心内测门禁Casebook_74条_2026-07-31.xlsx \
     PRD/QBot核心生命线与新增MR生产灰度全量回归Casebook_16-12-70-160条_2026-09-05-r14.xlsx
   ```

4. 执行能力审计：

   ```bash
   npm run core-beta:capability-audit -- \
     --casebook PRD/QBot核心生命线与新增MR生产灰度全量回归Casebook_16-12-70-160条_2026-09-05-r14.xlsx \
     --sheet 核心生命线门禁 \
     --out outputs/<new-core16-capability-audit-dir>

   npm run core-beta:capability-audit -- \
     --casebook PRD/QBot核心生命线与新增MR生产灰度全量回归Casebook_16-12-70-160条_2026-09-05-r14.xlsx \
     --sheet 生产灰度门禁Case \
     --out outputs/gate70-capability-audit

   npm run core-beta:capability-audit -- \
     --casebook PRD/QBot核心生命线与新增MR生产灰度全量回归Casebook_16-12-70-160条_2026-09-05-r14.xlsx \
     --sheet 全量功能回归Case \
     --out outputs/full160-capability-audit
   ```

   G1 报告必须为 `qbot-core-beta-capability-audit/v2`，固定 ID 顺序完全一致，且满足
   `protocol.executable_count=16`、`runtime_dispatch.dispatchable_count=16`、
   `capability_summary.directly_runnable_without_controller=16`、11 条 native、5 条
   verified legacy、`strict_controller_required=0` 和 `unsupported_runtime=0`。
   G3 报告必须同时满足
   `protocol.executable_count=70`、`runtime_dispatch.ok=true`、
   `runtime_dispatch.dispatchable_count=70`、
   `capability_summary.directly_runnable_without_controller=70`、
   `capability_summary.strict_controller_required=0` 和
   `capability_summary.unsupported_runtime=0`。仅有场景注册、但没有真实
   runtime 分发路径的 Case 必须在静态审计阶段失败，禁止拖到正式批次中途
   才报“缺少 executor”。全量 Sheet 还必须满足对应计数为 160，并确认前 70 个
   Case ID 与门禁 Sheet 完全同序。

   QWork 日常回归还必须单独运行：

   ```bash
   npm run core-beta:capability-audit -- \
     --casebook PRD/QWork日常回归自动化Casebook_最新变更回归_2026-08-18.xlsx \
     --sheet 日常回归 \
     --out outputs/<new-daily83-capability-audit-dir>
   ```

   该报告除顶层 `83/83` 外，还必须证明
   `leaf_runtime_dispatch.dispatchable_count=144`、
   `leaf_runtime_dispatch.unsupported_count=0`，且协议错误中不存在缺失或逆序的
   叶子上游依赖。

5. 执行统一真实运行前自检。以下以 360Teams 为例；所有字段必须替换为本轮冻结发布值：

   ```bash
   npm run core-beta:pretest -- \
     --casebook PRD/QBot核心生命线与新增MR生产灰度全量回归Casebook_16-12-70-160条_2026-09-05-r14.xlsx \
     --sheet 核心生命线门禁 \
     --profile mandatory \
     --lane teams \
     --out outputs/<new-immutable-pretest-dir> \
     --expected-count 16 \
     --expected-sha256 439f14686df4a1623015e3964b61a6943455c804938be2680a8d6fedde9bf2ed \
     --release-intake outputs/<new-immutable-release-intake-dir>/release-intake.json \
     --release-intake-sha256 "<release-intake-sha256>" \
     --require-release-intake true \
     --expected-teams-version "<teams-version>" \
     --expected-teams-build "<teams-build>" \
     --expected-qwork-version "<qwork-version>" \
     --expected-control-plane-origin "<exact-control-plane-origin>" \
     --production-gate true \
     --backend-version "<backend-release-id>" \
     --prompt-policy-version "<prompt-policy-id>" \
     --feature-flags-hash "<feature-flags-sha256>" \
     --qwork-ui-git-commit "<qwork-ui-commit>" \
     --qwork-build-id "<qwork-build-id>" \
     --qwork-release-manifest-sha256 "<manifest-sha256>"
   ```

   该命令首先只授权 G1。G1 可信通过后，G2/G3/G4 分别以同一命令改用
   `新增MR核心冒烟`/12、`生产灰度门禁Case`/70、`全量功能回归Case`/160；每阶段都
   必须重新读取发布身份、生成新 pretest 目录并取得精确 `READY`。一个 Sheet 的
   pretest 不能替代另一个。G3/G4 包含原生 IME Case，必须再传入并通过同一受管
   `--native-ime-command` 无副作用 probe。

   QWork 日常回归同样传 `--production-gate true`，用于冻结 Teams/QWork/control
   plane/backend/prompt policy/feature flags 并启用严格证据门禁；但它不是 70/160
   生产灰度风险域 Casebook，不得套用八大生产风险域完整覆盖检查。该分类只允许
   精确有序的 83 个顶层 ID、前 70 个 `compound` 和后 13 个独立 Case；任何缺失、
   重排或结构漂移均恢复完整生产风险域检查并在 Case 0 前 fail-closed。日常回归
   `READY` 只授权本轮 83 条执行，不等于 70/160 生产灰度放行。

   `core-beta:pretest` 只读检查 Git 分支/提交/tracked dirty、预检入口及其不变量测试是否已被 Git 跟踪、Casebook、协议、双框架测试、唯一 runner、宿主/session/CDP、QWork 登录目标、发布身份和逐 Case fixture 合同。Teams lane 的 control plane 必须同时核对受管 session 与 QWork renderer 实际读取的 `DEEPBANK_SERVER/QBOT_SERVER_URL`；只看启动参数或 session 声明不能通过。它不启动/重启 360Teams、不打开 QWork、不发送消息，也不生成 synthetic Case。只有报告结论为 `READY` 才允许启动真实 runner。

   Teams lane 的 pretest 还必须对已识别的精确 QWork WebView 执行一次只读
   `window.agent.capabilities()`，并把结构化投影和错误写入
   `runtime.teams_inspection.public_capabilities`。只有调用成功且返回非数组对象时
   `qwork_public_capabilities` 才可通过；接口缺失、超时、非对象、control-plane
   HTTP 4xx/5xx（包括 `invalid_launch_mode`）均必须在 Case 0 前令 pretest
   `BLOCKED`。可见 Composer、登录态和正确 release URL 不能替代该公开状态门禁，
   禁止在 capabilities 不可读时仍返回 `READY`。
   Teams lane 还必须对已冻结的 control plane 执行一次无凭据、只读
   `GET /api/health/ready`。只有 HTTP 200、`ok=true`、`ready=true`、
   `checks.db=true`、`checks.auth=true`、`auth.ready=true`，且响应 `env` 与 control
   plane 环境一致时，独立检查 `qwork_control_plane_health` 才可通过。框架必须按
   `<env>-health-<fingerprint>`（即 `env-health-fingerprint`）构造观测 backend identity，
   并与冻结 `--backend-version` 全等；`qwork_backend_identity` 不通过时同样在 Case 0
   前 `BLOCKED`。页面登录、capabilities 可读或调用者传入的 backend 字符串都不能替代
   这一真实健康与身份读回。
   正式 runner 内部的每次公开 capabilities 读回同样必须采用 2 秒单次超时、最多 3 次
   只读重试；最终状态证据保存 `capabilities_readback_attempts`（含耗时和错误），
   全部失败仍按不可读处理，绝不能让悬挂 IPC 阻塞串行批次或被缓存/可见文案替代。

   同一 Teams pretest 还必须只读调用公开 `window.agent.runtimeReleaseStatus()`，并将
   安全结构化投影写入 `runtime.teams_inspection.runtime_release_status`。顶层
   `releaseId/version`、`hostRuntimeCompatibility.runtimeReleaseId/runtimeVersion` 仍必须
   与 WebView URL 和 `--expected-qwork-version` 全部一致；API 缺失、超时、返回非对象、
   字段缺失或 runtime 身份漂移仍必须在 Case 0 前得到 `BLOCKED`。当前受开发确认的
   host-core 兼容性例外只把 `hostRuntimeCompatibility.versionsMatch`、
   `hostCoreVersion` 与 `runtimeVersion` 的不一致保留为结构化 `warning`，不再单独阻止
   `READY`；实际 host-core/runtime 版本、来源和路径必须完整写入报告，不能静默丢弃或
   把 warning 解释为兼容通过。`runtimeReleaseStatus.updatePhase` 还必须精确为 `idle`，
   且 `preparedRelease` 必须为空；`ready-to-activate`、`restart-required`、`activating`、
   其它非 idle 阶段、字段缺失或任一待激活候选均表示冻结身份可能在宿主生命周期内
   漂移，必须由独立 `qwork_runtime_update_activation_safe` 检查阻断 `READY`，不得被
   host-core warning 例外吞掉。

6. 冻结并记录发布身份：

   - 360Teams 版本和 build。
   - QWork runtime、UI URL、环境（DEV/UAT/PROD）。
   - backend、prompt policy、feature flags。
   - 模型档位和模型/引擎。
   - Casebook SHA、框架 commit、CDP、宿主 PID、profile、session。

7. 确认本轮只有一个受管 runner、一个固定宿主和一个不可变输出目录。禁止启动第二 runner。

8. 确认所需真实资源已经就绪。70 条门禁只保留无低频故障注入的稳定路径；其中
   原生 IME 必须由 pretest 实测对应命令可用。不得运行中临时排除这些 Case，也
   不得降级成 scoped 发布门禁。

运行时初始化与 Case 清理还有两项证据判定不变量：

- 技能安装终态必须绑定当前目标 Skill 的稳定名称或 slug。当前技能的可见已安装动作、
  `getSkillsCatalog().installed` 精确 identity、已安装页同名卡片，或
  `技能「<当前名称>」安装成功，本机对账已完成` 明确回执，均属于成功终态并优先于
  页面其他区域无关的“同步中/正在同步”文案；目标技能自身仍 pending、明确失败，或
  成功回执属于其他技能时不得误判成功。市场卡因 React 回收而漂移时，必须以同名已
  安装目录读回兜底，legacy 与 Core Beta v2 执行器遵守同一合同。若市场卡回收后只
  出现不含 Skill 名称的通用安装失败行，只有该行在精确目标安装点击前不存在、点击后
  新增、已安装库存读回成功且精确目标仍不存在时，才可绑定本次动作并以稳定来源
  `installed-tab-new-explicit-failure-after-targeted-install` 判为产品失败；动作前已存在
  的同文案、目标已安装、库存不可读或前后截图缺失均不得归因，必须 fail-closed。
- “立即检查运行时”允许以按钮 busy/disabled、处理中状态，或相对动作前新增的精确
  完成回执证明动作发生；当前发布包的 `完成：Python N 个就绪；Node N 个就绪`
  属于有效完成回执，动作前已存在的同文案仍不得复用。
- 能力清理以独立公开状态的最终读回为准。`selectedSkills/selectedConnectors` 的空数组
  表示显式禁用，`null` 表示 Auto 且无显式选择，两者在 `currentExpert=null` 时都满足
  “无当前任务能力残留”。只有三个清理桥均精确返回
  `desktop-local context mutation was superseded`，且上述公开读回完整成立时，才允许把
  这组幂等 superseded 记录为诊断后继续；任一真实能力残留、其他桥错误、字段缺失、
  公开状态不可读或弹窗未关闭仍必须 fail-closed。
- 普通 Case 的输入区隔离目标是“没有显式能力残留”，不是强制把新版产品的 Auto
  空态改写为旧版 disabled。准备阶段调用清理桥后，若公开读回精确为
  `selectedSkills=null`、`selectedConnectors=null`、`currentExpert=null`，且可见
  Skill chip、附件和场景 tag 均为空，必须接受为干净 Auto 空态并继续发送；`null`
  兼容只适用于 reset/隔离路径，不得放宽专门验证 disabled 模式的产品 Oracle。
  任一选择非空、专家残留、字段缺失、桥调用失败或 UI 残留仍须 fail-closed。
- 统一“+”菜单兼容两种受支持合同：旧版存在 Skill/Connector manual 控件时必须
  真实点击控件并读回列表/radio；新版在“+ > 技能/连接器”后直接展示列表时，打开
  section 只是建立可选择表面，不代表已经进入 manual。只有 section 已真实打开、搜索/
  列表（或明确空态）已渲染、公开 `selectedSkills/selectedConnectors` 可读，才允许继续
  点击具体能力；点击后还必须从公开选择数组读回同一稳定 identity。单凭菜单文字、
  单凭 routing、打开列表，或旧控件仍存在但未点击都不得判定选择完成。
- 日常回归专家目录审计必须兼容两代公开 preload 合同：旧版读取
  `window.agent.getExpertsCatalog()`，新版读取 `window.agent.expertLifecycle.catalog()`。
  新版 `{expertId, view, draft}` 投影必须归一化为 expert、display、version 和 release
  稳定身份后再执行空名称、裸 UUID、重复 identity 与同名可区分性 Oracle；接口缺失
  或结构无法归一化属于 framework issue，不得因直接调用不存在的方法中途硬停止。
- 专家创建路径必须优先使用稳定的 `[data-testid="expert-create-manual"]` 定位手动创建
  入口，并兼容旧文案“手动填表创建”和新版文案“高级手动创建”。`SIT-EXPERT-006`
  的路径断言与所有调用 `openManualCreateExpertModal()` 的场景必须遵守同一合同；稳定
  testid 可见时不得因展示文案演进误报 framework issue，进入后仍须独立读回完整表单。
- 前一叶子留在“专家构建/专家工作台”时，重复点击已激活的侧栏“专家·技能”不能
  证明已返回专家中心。后续专家或技能 Case 必须先检测稳定
  `[data-testid="expert-builder-back"]`；可见时必须真实点击并等待其 hidden，再读取
  `[data-testid="create-expert-top"]` 或技能页签。旧版回退只允许可见
  `button.expert-center-back` 且文案精确为“返回专家中心”。返回入口点击失败、未消失或
  返回后中心控件不可读仍属于 framework issue，不得继续查找下一个页面的控件。
  该恢复合同覆盖全部入口，不只覆盖 legacy `openExpertsPage/openSkillsPage`：Core Beta
  Expert 生命周期、Core Beta Skill 生命周期和 QWork 日常回归原生 Expert driver
  在断言 `experts-view/skills-view` 前都必须调用同一返回逻辑；任何直接点击侧栏后立刻
  断言中心页面的旁路都必须由 invariant 拒绝。
- 手动创建表单提交必须优先使用稳定的 `[data-testid="expert-create-submit"]`；旧版
  fallback 只允许精确“创建”或“保存草稿”。表单证据必须读回提交按钮是否存在、
  精确文案和 disabled 状态。不得因新版把“创建”演进为“保存草稿”误报 framework
  issue，也不得把“保存并发布/立即发布/取消”等其他动作当作创建草稿提交。
- 专家发布异步轮询必须遵守当前公开 preload 合同
  `getOperation(operationId, draftId, expectedRevision)`。`draftId` 和
  `expectedRevision` 必须与发起 `publish` 时的同一草稿和 CAS 完全一致；禁止只传
  `operationId`。只传一个参数会被主进程按缺失草稿 fail-closed 为
  `ExpertContractError: expert draft was not found`，属于框架调用错误，不能误记产品
  Bug 或留下 incomplete manifest。
- `BETA-EXPERT-012` 的维护对话只有在 `reply_incomplete === false` 且
  `timeout_cleanup_ok === true` 时，才允许读取修改后草稿、打开完整配置或执行任何发布
  点击。任一字段缺失、回复未终态或超时清理失败都必须立即按 automation error
  fail-closed；只保留此前已产生的回复/清理诊断，禁止与仍运行的 Agent 并发进入配置或
  产生新 version/release。
- `QWD-EXPERT-009` 请求组织可见范围时，公开专家生命周期接口若精确返回
  `ExpertContractError: expert audience is not supported`，这是已到达产品判断点的
  产品拒绝，不得让异常逃逸并生成 incomplete manifest。runner 必须保存创建前后专家/
  草稿库存、Case 内失败截图、干净草稿与零消息/零发送/空能力读回，把未发生的会话链
  角色以受校验 N/A 标记，同时为专家生命周期、发布、identity、runtime 和 history
  角色写入 `evidence_valid=true/oracle_valid=false` 的负向证据；证据完整时记产品 Bug
  并继续后续独立父 Case，任何错误文案漂移、状态变化或证据缺口仍按 framework issue
  fail-closed。

## 4. Fixture 合同

当前 70 条生产灰度门禁的静态审计必须证明 `strict_controller_required=0`，
因此不依赖通用逐 Case 外部控制器。`public_product_state` Case 由 runner 原生
执行；原生 IME 使用 `--native-ime-command`，且同一命令必须在
`QBOT_CORE_BETA_IME_PROBE=1` 时不输入任何内容，并返回
`qbot-core-beta-native-ime-probe/v1`，证明 Accessibility 权限和中文输入源就绪。
Teams lane 的 runner 在调用该命令前必须先激活受管 `360Teams`，并通过
System Events 读回 `frontmost=360Teams`；只有物理宿主激活成功后，才能对当前
replacement WebView 依次执行 `bringToFront`、真实 Composer 点击和 DOM focus，
并读回 `document.hasFocus()`、`document.activeElement` 与 Composer 可见性全部成立。
受管 QWork 的版本化 UI 允许位于 `~/.deepbank/ui`、`~/.deepbank-dev/ui`、
`~/.deepbank-local/ui`、`~/.deepbank-uat/ui` 或 `~/.deepbank-sit/ui`。目标发现、
CDP 代理、重连、宿主重挂载、固定 UI 校验和发布环境判定必须使用同一组 release
home；SIT 控制面与 `~/.deepbank-sit/ui` 必须同时判定为 `SIT`，不得误报为
QWork 未挂载或降级成 DEV。
macOS 在应用切换瞬间可能短暂无任何 `frontmost` application process；宿主激活
必须在有界次数内重新执行 activate 并逐次保存 command status、前台进程与错误读回。
瞬时空读回或 `-1719` 不得在首次采样就终止 Case；有界重试后仍不能精确读回
`360Teams` 才属于 framework issue 并 fail-closed。

附件暂存必须兼容两代受支持的 Electron 宿主合同，但不得混淆 descriptor：

- 当前 QWork 优先调用公开 `window.agent.shell.stageFiles({filePaths})`。成功结果使用
  `files[]`，每项必须完整包含 `schemaVersion=1`、非空 `fileId/absolutePath/displayName`、
  非负安全整数 `byteSize`、非空 `sourceKind/storageKind`。runner 必须按当前 UI 的
  `qwork-file-input:` 编码精确构造 Composer descriptor，保留路径引用语义；禁止改写成
  内联文本、data URL 或旧附件 payload。
- 旧发布仅在 `stageFiles` 不存在时回退 `stageAttachments({filePaths})`，并只接受其
  `attachments[]` 与 `qbot-document-attachment:` 旧 descriptor。若返回同时包含
  `files[]` 与 `attachments[]`，以 `files[]` 为权威，禁止用旧数组覆盖当前合同。
- 任一 descriptor 字段缺失、类型不合法、桥返回不可解析结构或暂存成功却没有可用
  文件时必须在 Composer 变更前 fail-closed，并保留桥方法、合同类型和 rejection
  诊断。产品明确拒绝可形成负向产品证据；框架不得因读取错字段而留下缺少
  prompt/task/send/reply 的不完整 manifest。

宿主激活、WebView 聚焦和 Composer 点击的顺序不得颠倒；仅调用 DOM `focus()` 不能
证明 macOS 键盘 first responder 仍属于受管宿主。原生命令返回 0 但 Composer 零文本且没有任何
composition 事件时，必须立即记为 framework issue，禁止继续等待或点击发送，也
禁止盲目重放原生命令造成重复输入。若前台焦点成立且已产生真实 composition 事件，
但最终文本或事件闭环不满足 Oracle，则应保存截图、事件 trace、零 task/消息/发送计数
变更读回，把发送后角色以受校验的 N/A 负向证据补齐，归类产品 Bug 并继续独立 Case。
当前 70/160 不包含 `managed_teams_restart` 或 `managed_runtime_restart` Case，
pretest 不得把 `--restart-command` 当作正式 Casebook 的启动前置；受管重启只在
独立 soak 或历史 74/184 回归合同中按对应规则验证。

以下严格控制器合同仅适用于历史 74/184 或未来重新纳入的隔离矩阵，不得用于
把当前 70 条之外的 Case 临时拼回发布门禁。

历史 74 条和 184 条 Casebook 包含不能由裸 UI 环境独立构造的场景。需要严格控制器的 Case 必须配置：

```text
--core-beta-fixture-control-url http://127.0.0.1:<port>
```

仓库提供统一、仅监听 loopback 的控制器入口：

```bash
npm run core-beta:fixture-controller -- \
  --providers /absolute/path/to/real-provider-manifest.json \
  --work-dir "$PWD/.runtime/core-beta-fixture-controller" \
  --host 127.0.0.1 \
  --port 58432
```

Provider manifest 的结构示例位于
`config/core-beta-fixture-providers.example.json`。示例不是可运行 provider，
不得直接用于正式预检。每个 provider 都必须是可执行 argv，必须从 stdin
读取 `qbot-core-beta-fixture-provider-request/v1`，并在 preflight 返回
`qbot-core-beta-fixture-provider-response/v1`。控制器会实际启动 provider 探针，
逐 Case 比对 adapter、driver、executor route、contract、action、evidence 与
Oracle；缺 provider、探针超时/失败、字段不一致、lease 不匹配或 execute
响应不是 `qbot-core-beta-driver-response/v1` 时 fail-closed。Provider
stdout/stderr 不回显，只保留字节数与 SHA-256，防止凭据进入预检报告。

控制器不会把 manifest 声明本身当作能力，也不会生成测试证据。第二账号、
OAuth、GitLab QA namespace、签名升级/回退包、故障注入、真实 IME 和受管
重启仍须由对应测试环境提供，并由 provider 探针实测成功后才能进入
`ready_cases`。

控制器 preflight 必须逐 Case 返回：

- `case_id`
- `driver`
- `executor_route`
- `contract_sha256`
- 完整 `action_ids`
- 完整 `evidence_roles`
- 全部硬 Oracle 的 `oracle_sha256s`

控制器 execute 必须返回：

- `schema_version=qbot-core-beta-driver-response/v1`
- 每个动作的开始/结束时间、`passed` 状态和证据引用
- 每个硬 Oracle 的结果和证据引用
- Case 声明的所有非 runner 证据文件

控制器会为每个 lease 创建独立 `evidence_output_dir`，provider 只能把证据写入
这个目录。符号链接、目录、空文件、超过大小上限、未声明角色或 realpath
越出 lease evidence root 的文件一律拒绝；runner 还会再次校验 evidence root
边界后才复制进当前 Case 目录并重新计算 SHA-256。字段不匹配、证据为空、
路径越界或控制器不可用时，必须在 Case 0 前或当前 Case 收尾时停止；禁止绕过。

### 4.1 历史 184 条控制器场景

完整生产灰度门禁在原 160 条基础上新增 24 条，全部属于一票否决范围：

- `BETA-ROUTE-001~006`：Auto 固定 Claude Code family、公司感知 M1–M4、保守 fallback、host-private router、CAS 与手动选择隔离；必须记录 `model_route_trace`。
- `BETA-CAP-001~004`：Skill/MCP auto/manual 四象限、Expert overlay、required/optional failure 和 stale/principal/generation fencing；必须记录 `activation_snapshot`。
- `BETA-STATE-001~004`：结构化 SQLite last-good、schema migration、Ask pending 重建、terminal receiver admission；必须记录 `sqlite_state_readback` 或 `ask_lifecycle_trace`。
- `BETA-MCP-015~016`：Teams owned Node stdio 生命周期和当前会话 model ID 权威覆盖；不得只凭回复文本判定。
- `BETA-DEPLOY-001~008`：Dashboard 策略、受保护迁移、Helm legacy 接管/重试/恢复、Ingress、诊断和 qbot-ui 退役。必须在隔离 UAT namespace 使用真实部署控制器，记录 `dashboard_policy_readback`、`deployment_receipt`、`migration_receipt` 或 `helm_lifecycle_trace`；本地 mock/fixture 不能替代。

上述历史 Case 不属于当前 70 条桌面发布门禁。若未来重新纳入，必须先实现原生
执行器或完整严格控制器、补充不变量测试并形成新的 Casebook SHA，不能在运行时
缩减或临时拼接后宣称当前发布门禁通过。

## 5. 直接连接 QBot/QWork 执行

适用于已经启动并登录、能够通过 CDP 访问的 QBot/QWork。产品环境必须在启动前由操作者确认；框架不会替操作者把 PROD、UAT 或 DEV 互相切换。

完整 70 条示例；完整 160 条只需把 `SHEET` 和输出目录中的数量改为对应值：

```bash
cd /Users/qifu/Documents/QbotTestAgent

CASEBOOK="$PWD/PRD/QBot核心生命线与新增MR生产灰度全量回归Casebook_16-12-70-160条_2026-09-05-r14.xlsx"
SHEET="生产灰度门禁Case" # 全量回归使用：全量功能回归Case
OUT="$PWD/outputs/$(date +%Y%m%d%H%M)_core-beta-70_<release-id>"

npm run ui-agent:casebook-run -- \
  --casebook "$CASEBOOK" \
  --sheet "$SHEET" \
  --profile mandatory \
  --cdp http://127.0.0.1:9224 \
  --out "$OUT" \
  --model-tier M3 \
  --timeout-ms 600000 \
  --single-host-pipeline 1 \
  --native-ime-command "<managed-native-ime-input-command>" \
  --production-gate true \
  --backend-version "<backend-release-id>" \
  --prompt-policy-version "<prompt-policy-id>" \
  --feature-flags-hash "<feature-flags-sha256>"
```

历史 74 条核心内测只可用于非发布回归；不得仅替换 Casebook 后把它解释为当前
生产灰度门禁。

执行单个或受影响 Case：

```bash
npm run ui-agent:casebook-run -- \
  --casebook "$CASEBOOK" \
  --sheet "$SHEET" \
  --profile mandatory \
  --case BETA-CHAT-001,BETA-SKILL-001 \
  --cdp http://127.0.0.1:9224 \
  --out "$PWD/outputs/$(date +%Y%m%d%H%M)_targeted" \
  --core-beta-fixture-control-url http://127.0.0.1:<fixture-port>
```

只验证读取、协议和 fixture preflight：

```bash
npm run ui-agent:casebook-run -- \
  --casebook "$CASEBOOK" \
  --sheet "$SHEET" \
  --profile mandatory \
  --out "$PWD/outputs/$(date +%Y%m%d%H%M)_preflight" \
  --core-beta-fixture-control-url http://127.0.0.1:<fixture-port> \
  --skip-run
```

`--skip-run` 生成的是 dry-run/synthetic 诊断结果，不能计入可信通过、稳定轮次或生产放行。

### 5.1 显式缩减范围批次

当真实 fixture provider 暂不可用、且操作者明确要求先执行其余基础功能时，
只允许使用显式 scoped lane。它不会修改 Casebook，也不能作为 74/184 门禁或
生产放行证据：

```bash
npm run core-beta:pretest -- \
  --casebook "$CASEBOOK" \
  --sheet "$SHEET" \
  --profile mandatory \
  --case "$SELECTED_CASE_IDS" \
  --expected-count <selected-count> \
  --expected-sha256 <full-casebook-sha256> \
  --scoped-execution true \
  --excluded-case "$EXCLUDED_FIXTURE_CASE_IDS" \
  --scope-reason fixture_provider_unavailable \
  ...冻结发布身份参数
```

scoped 预检必须返回 `READY_SCOPED`。框架会再次读取完整 Case 集，证明选择集
严格等于“完整 Case 集减去 excluded Case”、顺序未漂移、排除项覆盖当前
缺少 provider 的 fixture Case，并且仍以前四个本地初始化 Case 开场。真实
runner 必须携带完全相同的 `--case`、`--scoped-execution`、
`--excluded-case` 和 `--scope-reason`。输出中的 `scoped-execution.json`、
summary `scope` 以及 `release_gate_eligible=false` 永久标记该批次；即使全部
可信通过，也只能得出范围内基础功能结论。

历史 74/184 scoped 回归中，360Teams 包装器可能在 runner 启动时补充受管重启
能力，预检与 runner 观察到的“当前不可用 fixture”集合可能不同。该历史 scoped
合同因此要求 excluded Case 覆盖运行时全部不可用 fixture Case；允许额外显式
排除的 Case 仍只能是 Casebook 注册表中的专项 fixture Case，且必须写入
`additional_fixture_exclusion_ids`。这不会扩大可信结论，批次仍永久
`release_gate_eligible=false`；漏排任何运行时不可用 fixture Case 则继续
fail-closed。

显式 scoped 范围还必须计算跨 Case 上游依赖。若已选择的下游 Case 依赖一个
被排除的发布、安装、版本或授权 Case，预检以 warning 列出 dependency gap；
runner 到达该下游 Case 时必须从本轮不可变 suite ledger 生成可信 prerequisite
blocked，补齐当前 Case 的显式 N/A manifest 后继续后续独立 Case。禁止使用账号
中任意既有 active Skill、Expert、release 或 version 代替本轮缺失身份，也禁止把
这种可信 blocked 误判为 framework stop。

## 6. 360Teams 正式包执行

360Teams 场景必须走专用适配层，不使用本地 QBot 的 `9224`，也不能直接操作 runner 临时 WebView/CDP 代理。

1. 停止普通 360Teams 客户端后，以已有登录 profile 启动受管宿主：

   ```bash
   npm --prefix teams360-automation run launch:live
   npm --prefix teams360-automation run doctor -- --open-qbot
   ```

2. 导出精确 Case ID 列表：

   ```bash
   CASEBOOK="$PWD/PRD/QBot核心生命线与新增MR生产灰度全量回归Casebook_16-12-70-160条_2026-09-05-r14.xlsx"
   SHEET="生产灰度门禁Case" # 全量回归使用：全量功能回归Case
   PLAN="$(mktemp /tmp/qbot-core-beta-plan.XXXXXX)"

   python3 skills/qbot-execute-automation-tests/scripts/casebook_io.py export-cases \
     --casebook "$CASEBOOK" \
     --sheet "$SHEET" \
     --profile mandatory \
     --output "$PLAN"

   CASE_IDS="$(python3 -c 'import json,sys; print(",".join(x["id"] for x in json.load(open(sys.argv[1]))["cases"]))' "$PLAN")"
   ```

3. 启动唯一 runner：

   ```bash
   OUT="teams360-automation/output/$(date +%Y%m%d%H%M)_core-beta-70_<release-id>"

   npm --prefix teams360-automation run casebook -- \
     --casebook "$CASEBOOK" \
     --sheet "$SHEET" \
     --profile mandatory \
     --case "$CASE_IDS" \
     --model-tier M3 \
     --out "$OUT" \
     --timeout-ms 600000 \
     --single-host-pipeline 1 \
     --native-ime-command "<same-command-from-ready-pretest>" \
     --production-gate true \
     --control-plane-url "<exact-control-plane-origin>" \
     --backend-version "<backend-release-id>" \
     --prompt-policy-version "<prompt-policy-id>" \
     --feature-flags-hash "<feature-flags-sha256>" \
     --qwork-ui-git-commit "<qwork-ui-commit>" \
     --qwork-build-id "<qwork-build-id>" \
     --qwork-release-manifest-sha256 "<manifest-sha256>"
   ```

Teams 适配层会管理 live-profile alias、session、上游 CDP、WebView 代理、宿主重连和内部重启命令。调用者不得传 `--restart-command`，不得连接临时代理执行额外 UI 操作，也不得把输出写到 `teams360-automation/output` 之外。

正式 Core Beta runner 必须显式携带与对应 `READY/READY_SCOPED` pretest 相同的
`--control-plane-url`。启动前必须依次验证 session pin、QWork renderer 实际环境和
run metadata 三者同源；任一缺失或漂移都必须在第 1 条 Case 前 fail-closed，且禁止
用 renderer 观察值静默改写已经冻结的受管 session。

Teams 预连接在一次连接周期内最多接受一次已完成的受管宿主恢复。恢复完成后若 QWork WebView 已连接、但模型入口或 capabilities 尚未就绪，必须在同一宿主上继续有界读回；不得再次重启宿主、重复延长截止时间，或形成永不收敛的恢复循环。超过恢复后的验证窗口仍未就绪时必须明确失败，由自愈闭环判定环境阻塞或框架问题。干净草稿的可见模型入口允许处于 `Auto`，这只证明工作台已加载，不能记为 M3 证据；初始化后首个模型 Case 及其每次发送前仍必须真实选择并精确读回本轮要求的 M3。

受管宿主恢复还必须完成整套 release 的第二阶段激活。host-core 重启并把目标版本化
WebView 重挂载成功后，helper 必须先只读 `runtimeReleaseStatus()`：只有
`updatePhase=ready-to-activate`、`preparedRelease.releaseId/version` 与冻结版本全等，
且 `hostRuntimeCompatibility.hostCoreVersion` 已为冻结版本时，才允许通过公开
`runtimeActivatePreparedRelease()` 派发一次激活。`restart-required` 表示宿主重启尚未
收敛，禁止调用或模拟激活；候选、host-core 或版本任一漂移同样 fail-closed。激活会
替换 renderer，helper 必须跟随同一宿主 `<webview>`，连续读回 WebView URL、登录、
capabilities、workbench、顶层/loaded/compatibility runtime 全部为冻结版本，
`updatePhase=idle` 且 `preparedRelease=null` 后才能返回 ready。激活失败、replacement
未收敛或任一终态不完整时，保留精确公开状态并走现有事务回滚；回滚重启不得自动再次
激活，以免把一次失败动作变成无界重试。

## 7. 批量、串行屏障与初始化

- Core Beta v2 的 Case 间执行永久强制串行：`--parallel` 和 `--single-host-pipeline` 的有效值都固定为 `1`。调用者即使传入大于 `1` 的历史参数，precheck 也必须同时记录 requested/effective 值和 `core-beta-v2-forced-serial` policy，runner 不得进入多 CDP 调度或外层 pipeline。
- `compound` 父 Case 不是批处理别名。父 Case 的叶子必须在同一外层串行位置按
  Casebook 顺序逐条执行，每个叶子使用独立不可变目录、独立 `case-result.json`、
  `evidence-manifest.json`、截图、日志和 SHA。父级
  `compound-evidence-manifest.json` 必须校验叶子数量、顺序、合同 SHA、结果 SHA
  和证据完整性；任一叶子缺失、乱序、漂移或证据无效都不得完成父 Case。
- 复合父 Case 因已执行叶子的框架门禁中断时，聚合 manifest 必须把后续叶子明确写为
  `status=not_executed`、`validation_error=subcase_not_executed`，路径保持为空；不得把
  未执行叶子伪装成 runtime 根目录越界证据，也不得与实际已执行但无效的叶子混为一类。
- 非 Core Beta 旧协议仍可使用 `--single-host-pipeline N`（`1–20`），但不改变 Core Beta v2 的强制串行合同。
- Core Beta Casebook 中保留的 `pipeline_policy` 和 `batch_size` 只描述 Case 自身的动作/证据合同，不能授权 Case 间并发。
- `BETA-CHAT-008` 的 `conversation_dispatch_collect_20` 是单个 Case 内部自带的 20 任务调度器，不属于 Case 间并发。该 Case 必须独占外层串行位置；运行时为 20 个唯一 marker 逐条新建任务、确认发送并固化唯一 taskId。
- `BETA-CHAT-008` 每个确认发送后必须立即持久化 `batch-dispatch-ledger.json` 和发送后截图；末条派发后、统一回收前必须保存覆盖全部 20 个 taskId 的 `batch-pending-pool.json`，并验证至少 5 条显示正在执行。回收必须在同一共享截止时间内逐 taskId 轮询，保存 `batch-collect-observations.ndjson`、逐任务终态截图、`batch-collect-ledger.json` 和 `batch-collection-summary.json`，不得按当前页面或单条通用回复猜测归属。
- `BETA-CHAT-008` 逐 taskId 回收时必须与普通回复轮询使用同一 Agent 澄清面板策略：识别精确“跳过/跳过（用默认）/关闭并使用默认答案”入口，保存问题、选项和前后截图后继续该 task。共享截止时间仍有任务运行时，只要 20 条确认发送、taskId、观察和终态截图完整，必须生成 manifest 有效的产品超时/失败证据；固化终态后再受管停止残留运行任务，并明确 `cleanup_click_is_case_action=false`。不得把证据完整的批量产品超时写成 `reply_incomplete`，也不得让残留澄清面板把清理读回误升级为框架问题。
- `BETA-CHAT-008` 进入可信放行前必须通过专用强证据门禁：20 个 taskId 唯一，20 份确认发送回执与发送后截图完整，待回复池读回结构完整，20 条终态观察与截图完整，共享截止时间终态证据可用。产品 Oracle 失败可在上述证据完整时进入可信 Bug 复核；缺少任一批量证据时，当前 Case 必须记录为 `failed/automation_error` 并保存缺口诊断，然后继续后续 Case。该证据缺口会令整轮发布 `NO-GO`，但不再把 Case 级质量判定误当成执行中断。
- Skill/MCP/专家的创建、安装、授权、删除等生命周期变更，以及 HITL、重启、共享状态、故障注入、跨 Case 依赖和不满足精确 task ID 归属条件的多轮会话都是串行屏障。
- 非 Core Beta 旧协议不得同时启用单宿主 pipeline 和多 CDP `--parallel`；Core Beta v2 两者都会被强制降为有效值 `1`。
- pipeline 必须保存唯一 wave、task ID、能力绑定和 dispatch/collect 证据；重复 task ID 或跨 Case 取证立即视为框架异常。
- 多 CDP 并行执行的实时 `automation-progress.json` 与最终 summary 使用同一结果分区规则：`synthetic=true` 只能写入 `non_executed_diagnostics`，不得计入 `completed`、`results` 或状态计数。
- 历史 pipeline 回收结果进入 `completed` 前必须从调度包装项中解出原始 Case，并执行与串行路径完全相同的 manifest 完整性门禁；Core Beta v2 不得进入该路径。
- 结果分类优先级必须是 `automation_error` 高于 `blocked` 和 `bug`。顶层 `result_category` 之外还必须扫描失败的 step/assertion；只要其中存在 `category=automation_error`，后续前置阻塞、清理阻塞或产品断言都不得覆盖它。任何已经开始执行的 Case（包括 `passed`、`failed`、`blocked` 和 `automation_error`）都必须先写入明确的 `case-result.json`、进度和证据诊断，再继续下一个独立 Case；单 Case 的 manifest/取证不完整只影响可信复核和发布放行，不得中断后续执行。只有 CDP、renderer、受管宿主确实失效，或批次级身份/控制面已经无法继续执行时，才允许停止批次并进入自主修复闭环。
- 日常回归专项 JSON 证据必须使用 `evidence_valid` 表示取证结构、来源、Case
  绑定和文件完整性，使用 `oracle_valid` 表示产品行为是否符合预期。产品 Oracle
  失败时证据仍可为 `valid=true/evidence_valid=true/oracle_valid=false`，形成可信
  产品 Bug 并继续后续独立父 Case；不得把产品失败误升级为 framework stop。
  `QWD-EXPERT-002` 是只读专家目录/identity 审计，不要求虚假的能力选择或执行
  事件；`QWD-SEC-005` 是真实个人 LLM 连接、失败探针和脱敏审计，不要求虚假的
  会话轮次。通用类型校验不得覆盖具体 driver 的真实动作语义。
- `SIT-SKILL-007` 在 legacy 与 Core Beta v2 中必须执行同一用户合同：从新任务只读
  默认技能状态，通过可见“+ > 技能”列表选择稳定 identity，独立读回句内 Skill chip
  与 `selectedSkills` 一致，再点击 chip 的可见移除入口并证明两者同步清空。不得退化为
  仅调用 `setSkillsDisabled/setSkillsAuto` 的旧三态 smoke。任何能力动作只有在控件或
  公共 bridge 已定位、动作已派发且公开状态可读时，业务终态未生效才归为产品 Bug；
  locator、派发、公开读回或证据缺失仍为 `automation_error`。
- `QWD-WS-001` 在 A 发送前若已注册路径没有出现在可见菜单，或精确路径控件已
  真实点击但公开 cwd 未生效，必须停止向未知 cwd 发送。只有空 task、零消息、
  send count 不变、无 prompt/send receipt、失败截图及 SHA、A/B 注册 identity、
  两条定向删除回执与清理文件 SHA 全部 Case 绑定时，发送链角色才可受校验地标为
  N/A，结果保持证据完整的产品 Bug 并继续后续父 Case；不得抛异常覆盖为
  `automation_error`。若 B 选择在 A 会话完成后失败，必须保留 A 的真实
  task/prompt/reply，重开同一 A taskId/cwd 后固化负向读回，不得把已发生的 A
  会话标为 N/A。控件/菜单未定位、公开状态不可读、重开失败、清理目标漂移、文件
  越界或 SHA/manifest 不完整才是 framework issue。
- Core Beta v2 打开系统设置时，若设置壳已经显示“正在加载个人设置”，必须先在 30–180 秒有界窗口内等待运行时维护区出现；只有明确加载错误或窗口耗尽才能失败，禁止继续点击背景设置菜单并误报“个人设置入口缺失”。
- Core Beta v2 与 legacy runner 进入系统设置或左下用户菜单前，都必须识别并关闭遮挡左下设置入口的终态 `skill-operation-feedback`，并确认提示已经消失；pending 提示没有安全关闭入口时必须有界等待或 fail-closed，禁止 `force` 或 DOM `evaluate().click()` 穿透遮挡层。设置导航必须同时兼容 QWork 0.0.29 的 `nav-settings-menu` 直达设置页和旧版 `nav-settings` 子菜单，且把 `assistant-config-view` 的加载态纳入同一有界等待合同。日常设置/脱敏、`SIT-INIT-009`、`SIT-AUTH-005`、Skill 物化与 Skill 审计拒装必须复用各自 runner 的同一安全入口，不得保留旁路点击。
- QWork 的 `[data-testid="runtime-update-ready-toast"]` 版本更新提示可能遮挡左下设置入口。每条 Case 开始和进入系统设置前都必须检查该提示。正式不可变批次一旦读到“新版本已就绪/发现新版本”，必须保存提示、候选版本、冻结版本、按钮文案、截图与 SHA，保持提示原样且以 `runtime-update-activation-risk` framework issue 硬停止；不得再依赖点击“稍后/跳过更新/暂不更新/以后再说”保证宿主生命周期稳定，因为产品可能在提示消失后延迟执行 `app.relaunch`。禁止点击“立即更新”、使用 `force` 穿透遮挡、在原目录恢复或继续发送；修复/恢复精确发布身份后只能新 pretest、新目录全量重跑。该硬停止在抛出前还必须固化 `action_receipt`、`public_state_readback`、`cleanup_readback` 三类完整停止证据，避免把预期的发布风险阻塞二次误报为 manifest 缺失；这些证据只记录“未执行任何产品动作”，不得伪造通过。无 Case 状态的非正式诊断清理仍只允许精确安全跳过动作。系统设置维护区中仅用通用 `[role="status"]` 展示“发现新版本，可点击立即更新”的内联版本状态不属于待激活弹窗；没有安全跳过按钮时不得误报遮挡框架错误。
- 若前景“新建工作空间”模态框与底层版本更新提示同时存在，必须先在同一工作空间
  模态框内点击精确“取消/关闭”或明确关闭图标，等待模态框 hidden，并保存 before/after
  截图与结构化 ledger；之后才允许处理版本提示。该顺序适用于每条 Case 初始化和进入
  系统设置前；禁止 `force` 穿透、点击“确认”创建工作空间或点击“立即重启”。
- 上一条 Case 或冻结批次可能留下“创建专家”路径选择弹窗。每条 Case 初始化和进入
  系统设置前必须精确验证同一弹窗同时包含“创建专家”“开始创建”和受支持的手动创建
  入口，只允许点击同一弹窗内精确“取消/关闭”或明确关闭图标，等待 hidden，并保存
  before/after 截图与结构化 ledger。禁止点击“开始创建”或手动创建入口，也不得把
  普通专家详情弹窗纳入该清理规则。关闭图标可能只有 `aria-label/title` 而没有
  `innerText`；安全动作名称必须按可见文本、`aria-label`、`title` 的顺序读回，
  不得因空 `innerText` 拒绝已经由精确可访问名称定位的关闭按钮。
- 通用 Case 收尾只统计真实可见的 `[role="dialog"]/.modal`。对阻塞清理的可见
  弹窗，只允许在同一弹窗内点击文案精确为“取消/关闭/跳过/稍后/以后再说”的
  安全动作，或明确的关闭图标，再等待弹窗消失；不得点击“确认/立即更新”等会改变
  产品数据或冻结发布身份的动作。`SIT-HOME-052` 必须按按钮文案精确匹配
  “打开本地工作空间/打开本地文件夹”，禁止使用 `.wspick-item.pick.first()`；若
  原生目录取消后残留“新建工作空间”弹窗，应点击其可见“取消/关闭”并留截图，
  不能让残留弹窗把已有产品结论覆盖成清理 `automation_error`。
- Core Beta v2 根 runner 和 360Teams 截图保护器的 Playwright 截图、fallback CDP session 创建、`Page.captureScreenshot` 和 session `detach` 清理必须分别受硬超时约束。截图已经成功固化时，清理期 `detach` 超时只能写入 runner 日志并继续返回截图，禁止让无界清理等待卡在 Case 0；截图本身超时或缺少有效图像数据仍按证据失败 fail-closed。
- Core Beta v2 根 runner 的正式截图必须先写入 Case 目录外的隔离临时文件，只有非空图像完整返回后才写入最终证据路径，防止已经超时但尚未取消的 Playwright promise 迟到覆盖有效截图。全页 `page.screenshot` 与其新建 CDP session fallback 同时出现非 target-closed 瞬态失败时，只允许等待一个短有界间隔，再用 `fullPage=false/captureBeyondViewport=false` 和新的 CDP session 重试一次；重试成功形成正常截图证据，重试仍失败才抛出包含两次主路径/fallback 原因的 framework error。`Target closed`、`Session closed` 或宿主/renderer 失效不得用截图重试掩盖。
- `framework-stop-diagnostic.json` 必须传播到最终 summary：`status` 不得为 `passed`，`stopped=true`，并保留 `planned/completed/unexecuted`、停止原因与停止 Case。停止 Case 不得计入 completed，但必须以 `non_executed_diagnostic` 进入二次复核结构化结果、`framework_issue` 统计和 `框架修复清单.md`；不得因可信复核只遍历 completed 结果而错误报告“框架问题数为 0”。待激活更新等批次级身份风险若发生在 `compound` 叶子，叶子必须在自身诊断落盘后立即中断后续叶子，并将同一 `batch_stop_reason` 传播到父 Case；根 runner 必须移除刚加入进度的停止父 Case，再生成批次停止诊断，禁止继续下一个父 Case。360Teams 包装器对 stopped、非 passed 或计划未完成的 summary 必须返回非零退出码，不能只看已完成结果中的 `failed/blocked` 计数。
- Core Beta 清理证据必须证明清理桥动作全部成功且技能、连接器、专家选择明确为空。优先使用 `agent.capabilities` 读回；Teams 中该 IPC 被超时保护器中止时，必须在不重复执行清理动作的前提下最多执行三次有界只读尝试，并把每次成功/错误写入 `capabilities_readback_attempts`。任一次读回得到权威空态即可继续；全部尝试失败且当前页面没有可见输入区时，框架必须通过受管 `openNewTask` 导航到干净 composer 表面，只重新采集可见状态和 E2E 状态，不得再次调用任一清理桥或把导航算作第四次 capabilities 尝试。此时允许组合使用首次精确为空的禁用桥回执、输入区无能力 chip、`__qbotE2E.state/currentSession` 的空专家身份和无专家头像作为独立交叉读回，并在 `cleanup_surface_recovery`、`pre_navigation_selection_readbacks` 和导航后截图中保存证据；旧版分离控件还必须明确显示“禁用”，新版统一“+”菜单必须有可见输入区。全部读回超时、恢复导航失败、只有动作返回值、缺少可见状态或任一来源仍有残留时必须保持 `cleanup_readback.valid=false`，不得把未知状态当作清理完成。
- 当前页面已经是可见统一“+”菜单 Composer 且 Skill/Connector chip 与专家头像均明确为空时，三次 `agent.capabilities` 只读均超时不触发导航；此时只有同一 Case 的发送前 `core_beta_composer_control_reset.isolation_readback` 已权威证明 Skill、Connector、Expert 全部为空、三个清理桥均成功，才允许以 `pre_cleanup_and_visible_ui` 作为清理交叉读回继续。若 Composer 可见但 chip/头像字段缺失、不可证明为空或存在任一残留，能力读回三次耗尽后必须通过一次受管 `openNewTask` 恢复可见空 Composer，再只读采集可见状态和 E2E 状态；不得重复清理桥或把导航算作第四次 capabilities 尝试。恢复后仍有残留、恢复失败或少于三次受管只读尝试仍须 fail-closed。
- 清理终态还必须有界读取公开 `agent.init()`，只保留当前 active/draft context 的最小能力字段并与 `__qbotE2E.state.activeId/isDraft` 精确绑定。当 `agent.capabilities` 超时且没有可用的发送前权威空态时，只有 `agent.init()` 对同一当前 context 明确返回 `skills/connectors/expert` 三者均为 `null` 或空数组、三个清理桥均成功、当前统一 Composer 可见且无 Skill/Connector chip 与专家头像，才允许以 `agent.init_context_and_visible_ui` 继续。`agent.init()` 超时、active/draft 绑定不一致、任一字段省略、任一可见残留或清理桥失败仍须 fail-closed；不得读取其他会话空态替代当前任务。
- 新版统一“+”菜单通过公共能力桥隔离 Case 前置技能或连接器状态时，优先使用 `agent.capabilities` 中 `selectedSkills`、`selectedConnectors` 或 `connectorRouting.mode` 的明确读回；若当前 QWork capabilities 省略对应字段，明确返回空数组仍可确认禁用态。QWork 0.1.6-sit.8 的 legacy `setSkillsDisabled()` / `setConnectorsDisabled()` 兼容桥可合法返回 `null`，但不得单独放行；只有同一当前 draft 的 `agent.init()` 明确绑定且 `skills`、`connectors`、`expert` 均为空，`__qbotE2E` 状态明确为空、统一 Composer 可见且无 Skill/Connector chip 与专家头像，同时所有已调用清理桥无错误时，才可通过交叉读回确认。桥返回 `undefined`、非数组、调用失败、上下文绑定不一致或任一空态缺失仍必须 fail-closed；自动态只接受 capabilities 或对应 `set*Auto()` 的明确 `null`。
- 新版统一“+”菜单的手动 Skill/Connector 选择必须执行真实可见 UI 动作：优先通过 `composer-plus-section-skill` 或 `composer-plus-section-connector` 定位入口，始终选取最新可见 Portal，并依次支持 hover、click、`ArrowRight`、`Enter` 回退路径。完整开启流程允许最多三次有界重试，每次重试前必须关闭残留 Portal 和工作空间菜单；三次仍不可见时必须保存截图、尝试次数和明确的 `automation_error`，禁止静默返回 `false` 后由同级能力操作覆盖失败现场。可见 Portal 内没有 mode/option，但搜索/列表与 `.composer-plus-empty` 明确可见时，属于合法的空库存表面，不得误判为子菜单未打开；需要选择具体 Skill/Connector 的 Case 必须以空任务、空选择、零消息、发送计数不变、空态截图和 Case 绑定 prerequisite 补齐 N/A manifest，记可信 `blocked` 后继续独立 Case。旧版若存在 `composer-skill-mode-manual` 或 `composer-connector-mode-manual`，必须真实点击并以 radio/公开状态确认；rc.100 式直接列表没有独立 manual 控件，打开列表只证明表面可操作，不能要求点击具体能力前 routing 已经是 manual。runner 必须点击稳定 `composer-*-option-*`，再由 `selectedSkills/selectedConnectors` 读回同一 identity 才算选择完成。控件未定位、点击未派发或公开字段不可读属于 `automation_error`；点击已派发但产品未进入期望状态属于证据完整的产品 Bug。`BETA-MCP-002` 必须对 5 个固定样本逐项保存 Case 绑定、序号、key、点击后的瞬时 `selectedConnectors`、稍后的公开持久化读回、前后 task/capabilities、工具清单、健康状态、可见状态、唯一截图及 SHA，并始终生成、注册 `capability_selection` 与 `capability_execution_event`。精确 connector 点击后未选中、瞬时读回选中但稍后的公开读回再次为空，或第 N 个样本的手动模式控件已真实点击但产品仍读回 auto/未选中，只要当前样本同时证明任务为空、未运行、消息数为 0、send count 未变化且两阶段公开状态完整，仍属于一份有效的结构化产品负向收据，循环必须继续固化剩余样本。5 份收据齐全时，任一 connector 或模式 Oracle 失败必须写为 `valid=true/evidence_valid=true/oracle_valid=false` 的产品 Bug；只有收据数量、唯一 key/序号、控件定位、点击派发、瞬时或持久化读回、任务零变更守卫、截图/SHA 或公开结构字段缺失时才可令证据无效并按 framework issue 停止。样本循环内禁止提前 `return` 丢失专项 artifact，也不得以诊断占位文件代替。
- `SIT-HOME-057` 的“最少澄清”Oracle 必须同时覆盖可见回复文本与 QWork 结构化推荐/澄清面板。每个面板只有在精确使用安全的“跳过/跳过（用默认）”动作、与当前轮 `label + prompt SHA`、确认发送、非空 taskId 绑定，并保存同 Case 目录内非空 before/after 截图及各自 SHA-256，且面板真实关闭或推进时，才可把主题/目标、汇报对象、数据来源或截止时间计入澄清维度。任一捕获到的当前轮面板缺少上述绑定或截图证据时属于 `automation_error`，不得只扫描最终正文后误报产品 Bug，也不得用未绑定的历史面板放宽 Oracle；即使澄清维度足够，回复编造业务数字仍必须记产品 Bug。
- 通用输入区 reset 汇总不得把已经确认的能力产品失败覆盖成 `automation_error`：只有控件定位、点击派发、状态读取、残留清理或证据生成本身失败时才属于框架错误。若 Skill/Connector 控件已真实点击但发送前产品状态未生效，runner 必须生成 `qbot-core-beta-pre-send-capability-failure/v1`：`capability_selection` 保存目标 identity、可见控件、点击回执、`aria-checked`、手动列表/空态和失败截图，并写为 `valid=true/evidence_valid=true/oracle_valid=false`；同时必须以前后公开状态证明 active task 为空、running=false、message count 为 0、send count 未变化、选择为空且没有 prompt/send receipt。只有该零变更证据完整时，`capability_execution_event`、`prompt`、`task_id`、`send_receipt`、`transcript`、`reply_delta`、`reply_completion` 才可显式标记 N/A，Case 作为 manifest 完整的产品 Bug 进入 completed 并继续后续独立 Case；任一字段、截图、SHA、Case 绑定或目录边界缺失/漂移仍须 `automation_error` 硬停止。
- `SIT-HOME-043/044` 的单文件 30 MiB 与总量 80 MiB 发送前拒绝必须生成
  `qbot-core-beta-pre-send-attachment-rejection/v1`。只有拒绝类型与 Case 精确绑定、
  提示文案匹配、信息弹窗已通过受管通道安全关闭、Composer 附件为空、前后公开
  active task 为空且 running=false、message/send count 可读并保持不变、没有 prompt
  或 send receipt，同时拒绝前与关闭后截图及弹窗结构化证据都位于当前 Case 目录且
  SHA-256 一致时，`task_id`、`prompt`、`send_receipt`、`transcript`、`reply_delta`、
  `reply_completion` 才可严格标记 N/A。任一字段、角色集合、Case 绑定、截图、SHA、
  公开状态或目录边界缺失/篡改必须重新 fail-closed；该豁免不得用于普通会话、
  `BETA-FILE-007` 的合法恢复发送分支或任何真实发送 Case。
- `BETA-CHAT-010` 的 `ime-event-trace.json` 必须把取证完整性与输入业务 Oracle 分离：原生命令成功、composer 焦点成立且真实事件非空时写 `evidence_valid=true`；只有字节级读回一致并同时出现 `compositionstart/compositionend` 时写 `oracle_valid=true`。真实事件完整但中文组合或读回不符时，保留兼容字段 `valid=false`、写 `evidence_valid=true/oracle_valid=false`，并结合零 task、零消息、send count 未变化、失败截图和 SHA 形成发送前产品 Bug；该 trace 在 manifest 中必须视为有效证据并继续后续独立 Case。原生命令零文本零事件、焦点失败、命令失败、事件文件损坏或 `evidence_valid=false` 仍属于 framework issue 并硬停止。通用 JSON 证据校验在显式存在 `evidence_valid` 时必须以它判定证据完整性，只有旧格式缺少该字段时才回退到 `valid`；不得再用业务 `valid=false` 覆盖有效负向证据。
- 同一 Case 先把技能切到手动模式、随后设置连接器或其他同级输入区控件时，QWork 可以关闭当前技能 Portal 而保留 `manual` 模式。精确选择固定 Skill 前，runner 必须重新读取当前可见技能菜单；若已关闭，必须通过 `composer-plus-section-skill` 重新打开最新可见 Portal 后再按精确身份选择。不得把这种可恢复的菜单关闭状态直接写成 `automation_error`，也不得从整页或隐藏旧 Portal 中定位 Skill。
- `BETA-SKILL-003/004` 必须对固定 5 个样本逐项保存安装前、pending、终态截图、`skill-operation-feedback` 结构化操作/API 收据和 `catalog.installed` 读回，并分别记录服务端安装与本机 reconcile 结论。产品反馈已经进入 error/success 终态时必须立即收尾该项，禁止继续空等完整超时；若当前样本已观察到带身份的 pending，随后出现不重复技能名的通用 error/success 文案，该终态仍绑定当前动作。反馈持续 pending 时必须等待完整有界窗口并保存 `terminal_outcome=timed_out`、等待时长和终态截图，禁止把未等满窗口的 pending 当作完整失败。安装按钮已真实点击但产品返回失败或未进入已安装终态时，必须继续其余固定样本，将完整取证文件标记为 `valid=true`、业务结果标记为 `oracle_valid=false`，并形成证据完整的产品 Bug；不得直接抛异常造成 manifest 缺失。失败项只能进入安装尝试账本，不得写入成功安装账本，也不得随机换样本。缺少任一动作、截图、结构化反馈或读回，点击本身无法执行，或取证失败时仍属于框架异常并 fail-closed。
- `BETA-SKILL-002` 冻结 10 个确定性市场样本时，必须为每个样本按 `Skill detail README/markdown → detail body/readme → catalog.market description/desc` 的顺序冻结 prompt source 原文、来源类型、字节数和 SHA-256；`deep_use` 前 5 个样本的来源可用性同时作为本 Case 的业务 Oracle。安装后的简化 `catalog.installed` 条目不得覆盖或替代冻结内容。`BETA-SKILL-006~011` 派生两轮任务和 Oracle 时只能使用并校验该冻结来源；内容或 SHA 漂移属于 framework issue。若冻结账本完整但目标 Skill 的 README/body/description 确实全部为空，必须在选择能力或发送前生成 `skill_prompt_source_unavailable` 可信 prerequisite blocked，把未发生的 prompt/task/reply 角色显式标记 N/A，形成完整 manifest 后继续后续独立 Case；禁止先选择 Skill 再抛异常并丢失 manifest，也禁止发送泛化占位任务。
- 固定 10 个 Skill 的安装尝试全部形成完整终态收据后，若成功数不足 10，框架必须从精确的本轮安装尝试账本生成 `qbot-core-beta-upstream-prerequisite/v1` 阻塞证据。`BETA-SKILL-005` 等依赖完整安装集的 Case，以及 `BETA-SKILL-006~011` 中目标 identity 本身安装失败的 Case，必须记为上游前置阻塞，禁止发送、随机换 Skill 或把同一上游失败重复报成当前 Case 的新产品 Bug；未发生的 prompt/task/reply 角色只能在阻塞文件位于当前 Case 目录、账本 SHA 和目标 Case 均验证通过时显式标记 `not_applicable`，不得用伪 taskId、空回复或 synthetic 证据补齐 manifest。命中阻塞时必须走标准串行阻塞取证。`BETA-SKILL-012` 即使因上游短缺而阻塞，也必须先定向清理本轮实际安装成功的 identity，并证明没有影响基线技能；安装尝试账本不完整、目标身份不匹配、阻塞文件越界或清理证据缺失仍属于框架异常并 fail-closed。清理已经产生失败的 `automation_error` 时，后续上游 blocker 只能写入 `secondary_blockers`，不得把最终结果改写成 `blocked`。
- Daily83 的受控 Skill 回归叶子在 Teams lane 必须把 `createSkillHubRegressionServer()`
  返回的完整 `fixture` 传入 Core Beta v2 `restartWithSkillHubFault()`。当
  `fixture.skills` 非空时，V2 必须先安装
  `createTeamsSkillFixtureController(fixture.skills)` 的 stateful renderer adapter，覆盖
  catalog、install、uninstall、update、revert 和 reconcile 六条公开 Skill 生命周期，
  将 fixture 的 active-version 切换同步到 renderer controller，并保持冻结的 SIT control
  plane 不变；只有没有 fixture 的 401/403/未配置专项才允许
  使用 `forbidden/unavailable` 空市场 fallback。禁止因 `overrideUrl` 非空把正常回归
  fixture 降级为空目录，或把 Teams renderer adapter 再指向本地 fixture control plane。
  统一“+ > 技能”菜单读取的是 `window.agent.capabilities().skills` 时，adapter 还必须
  通过带原始 capabilities 快照的受控 Node handler 按当前安装状态合并 Fixture 条目，
  保留原始公开字段；仅拦截 `/api/skills/catalog` 不能证明 Fixture 已进入可选择菜单。
  未安装 Fixture 不得提前注入，安装/卸载后的 capabilities 读回必须随 controller 状态
  变化，缺少目标条目仍按 framework issue fail-closed。
  Fixture 的 `reconcileSkills` 必须返回带 `slug/name/runtimeName` 身份的结构化 `ready` 和 `materialized`
  条目；`selection` 指向的已就绪 Skill 必须继续出现在 `ready`。禁止返回裸字符串或只报告
  本次状态变化，否则产品客户端会把无法按 identity 回读的成功安装事务误判为未就绪并回滚。
  任一回归 fixture 丢失、声明 Skill 未进入 market、Node handler 未派发或生命周期路由
  缺失均属于 framework issue，必须冻结批次并从 1/83 完整自愈重跑。
- Teams 包内 `window.agent` 可能由 Electron `contextBridge` 暴露为冻结对象；给
  `window.agent.getSkillsCatalog/installSkill/...` 直接赋值后没有抛错，不代表替换已经
  生效。renderer adapter 安装必须逐方法验证实际 wrapper identity；方法不可写时，只能
  在全局 `agent` 属性可安全替换时安装包含原公开表面与受控 wrapper 的 facade，并在清理
  时恢复同一个原始 agent/属性描述符。方法和全局属性均不可替换时必须在叶子产品动作前
  fail-closed，禁止继续读取真实 SIT Skill 市场。stateful Skill adapter 还必须用不存在的
  probe identity 依次调用 catalog/install/uninstall/update/revert/reconcile，证明六次调用
  精确到达 Node controller 且没有命中正式控制面；探针事件验证后必须清空。每个真实叶子
  的 fixture 准备阶段还必须再次观察到独立的 controller 事件（至少包含定向
  `uninstallSkill`），不得用探针事件冒充 Case 动作或在实际事件为空时继续执行。
- stateful renderer adapter 的绑定或六条生命周期探针首次失败时，框架必须先保存
  binding report、每条 probe 结果与 controller 事件、Node registry、renderer
  control stack/owner、agent 与方法属性描述符、精确错误 message/stack，再关闭本次
  adapter。只有关闭后 Node registry 为空、确认没有其他 Case adapter 正在活动时，
  才允许执行一次清理后的全新 binding/reprobe；最多两次，禁止循环重试或在其他活动
  adapter 上执行破坏性清理。第二次仍失败或关闭后仍有活动 adapter 时必须在产品动作前
  fail-closed。`qbot-teams-skill-fixture-adapter/v2` 必须保留全部尝试；若最终失败，
  `qbot-core-beta-renderer-adapter-framework-failure/v1` 必须把未发生的 task/prompt/reply/
  capability 角色严格标为 N/A，使 framework-failure 取证完整，同时当前 Case 记录为
  `failed/automation_error` 并继续后续 Case；若 renderer/宿主因此不可用，再按批次级
  执行能力规则停止并进入自愈。首个精确
  automation failure 必须写入 `primary_failure` 和 trace；后续通用 action/manifest/
  machine-assertion 汇总只能进入 failure history，不得覆盖根因。
- 确定性 Skill Fixture 的每次市场查找都必须重新进入【技能市场】，清空上一次
  搜索，真实点击稳定 `[data-testid="skills-catalog-refresh"]`，等待刷新与渲染收敛后
  再按归一化的 slug/name marker 搜索。重复点击已激活的市场页签不等于刷新
  React catalog state；刷新控件缺失、点击未派发、加载未收敛或目标未出现时，
  legacy 与 Core Beta v2 都必须保存 `skill-fixture-catalog-lookups.json`，记录旧查询、
  刷新动作/终态、归一化 marker、可见卡片和精确错误，并在产品动作前
  fail-closed。不得复用上一个 Fixture 查询的旧市场卡片。
- 目标 Skill 市场卡片出现后，不得仅因卡片正文含“同步中”或安装按钮暂时
  `disabled` 就把“没有可点击安装入口”归因于产品拒绝。需要安装的路径必须在同一
  目标卡片上对 `.skill-install` 做有界只读轮询，逐次记录可见性、`disabled`/
  `aria-disabled`、CSS disabled 状态和卡片文案；按钮恢复可点击后才允许唯一一次
  安装点击。轮询超时必须把诊断写回 `skill-fixture-catalog-lookups.json` 并归类为
  `automation_error`，不得生成伪造的产品失败或继续派发第二次安装。
- `BETA-SKILL-014` 每个不可变批次必须从 Case 目录派生唯一、合法的 `qa-meeting-minutes-<digest>` fixture slug，并把该精确名称写入每一轮真实 prompt；不得复用固定 `meeting-minutes`、覆盖已有用户 Skill，或把前序冻结批次的残留当成本轮产物。创建入口选择证据必须同时包含发送前 exact `skillhub:global/skill-creator-qwork`、每轮发送后的同一 taskId 快照、实际 prompts 和发送后终态。产品 QWork home 必须优先从当前冻结的 versioned `file://.../ui/<version>/index.html` 推导；Teams 为受管重启/控制面 fixture 注入的 `--qbot-home` 不能覆盖该产品 release home，只有非 file UI 无法推导时才允许回退。产物必须独立读回该产品 QWork home 下 `.claude/skills/<slug>/SKILL.md` 与 `.agents/skills/<slug>/SKILL.md`，校验普通文件、非符号链接、frontmatter name、`agent_created: true`、非空 description、字节数和一致 SHA；同时证明内部 creator 未混入普通市场库存。证据结构完整与业务 Oracle 必须分开：双投影缺失或产品未创建时，专项文件仍应 `valid=true/evidence_valid=true/oracle_valid=false` 并形成可继续批次的产品 Bug；只有路径/读回/task-bound 证据本身缺失才属于 framework issue。证据固化后，清理阶段只能删除基线中不存在且精确匹配本轮唯一 slug 的两个投影目录，以及 QWork home 内 Claude project memory 下文件名、正文均精确绑定该 slug 的新增非符号链接记忆文件，并保存 `skill-creator-fixture-cleanup.json`；任一预存、越界、符号链接、删除失败或残留都必须以 `automation_error` fail-closed。
- `BETA-EXPERT-001` 必须先通过真实【新建任务】进入 `taskId=null/messageCount=0` 的干净草稿，再按 `display.label` 搜索目标专家，执行一次 `recordRecent` 与 `setExpert`，发送 Casebook 冻结的确定性短提示并生成本 Case 自己的新 taskId。新 taskId 必须非空且不等于进入本 Case 前观察到的上游 taskId；expertId/versionId/releaseId 必须在选择读回、发送后任务、`setExpert` 回执和最近召唤中一致。`recordRecent` 与 `setExpert` 是一次性状态变更，必须与后续只读公开 `window.agent.capabilities()` 分离；`expertLifecycle` 只承载专家目录/草稿生命周期方法，不得假设或调用 `expertLifecycle.capabilities()`。Teams IPC 首次超时时，只允许对 capabilities 最多执行三次有界重试并保存逐次账本；不得重复召唤、重复写最近列表或重复设置专家。首次失败后恢复成功必须继续完成当前 Case；三次读回均失败且没有独立公开状态可验证精确专家 identity 时，才按 framework issue fail-closed。发布记录读回必须始终写 `valid=true/evidence_valid=true` 表示结构化取证完成，并用 `oracle_valid` 表示可见ID/计数是否严格等于 `owned=true` 集合；产品列表为空或计数错误属于证据完整的产品 Bug，不得把 `product_state_diff` 标成 manifest invalid。
- `SIT-EXPERT-022` 必须在专家首轮发送前、点击通用助手后分别保存公开 `capabilities.currentExpert` 读回，并把专家选择/清空映射为 `capability_selection`。切换成功时，两轮 prompt、各自非空 taskId、完整回复终态和切换回执必须映射为 `capability_execution_event`；产品 Oracle 另外要求两轮 taskId 相同。若两轮 taskId 均非空但不一致，证据仍必须写 `valid=true/evidence_valid=true/oracle_valid=false` 并记产品 Bug；任一 taskId 缺失才属于 task 绑定证据不完整。入口缺失或点击失败时，必须显式记录第二轮未执行及其原因，不得伪造 prompt/回复。入口缺失、入口点击失败、点击后 Composer 不可用、公开专家身份未清空或回复仍泄漏旧专家身份时，证据结构完整则同样记产品 Bug；只有 capabilities 读回、task 绑定、回复终态或证据文件本身缺失时才允许以 framework issue fail-closed。legacy 与 v2 runner 必须共享这一合同，禁止把已完成的专家切换产品路径因缺少证据角色误停在 compound 中。
- `BETA-EXPERT-002/003` 必须把 Expert Builder 业务 Oracle 与证据有效性分开。产品没有创建本轮 owner-isolated ExpertDraft、复用历史草稿/历史 staged Skill、没有调用所需 authoring tool 或只在回复中声称完成时，仍须保存绑定当前 task 的 baseline/after draft inventory、复用 identity、完整 reply records、tool trace、dependency/content/path 负向读回；这些专项文件必须为 `valid=true/evidence_valid=true/oracle_valid=false`，Case 记产品 Bug并继续后续独立 Case。只有 baseline/after inventory、当前 task 绑定、回复终态或结构化 tool trace 本身缺失/越界时，才允许令证据无效并按 framework issue fail-closed。产品失败不得通过 `valid=false` 或提前 return 造成 `expert_draft_lifecycle`、`expert_dependency_graph`、`artifact_path_sha256`、`content_readback` manifest 缺失。
- `BETA-EXPERT-003` 切换 Codex runtime 时，若产品桥精确返回“没有匹配协议的 LLM connection”，或因当前 Claude 会话已固定而返回错误码 `model_runtime_family_pinned`/文案“已固定本会话的模型，不能切换执行方式”，框架必须在调用 `setExpert` 和发送前捕获公开 connection view、错误码/文案、前后任务/runtime/专家/草稿快照及截图。只有目标 Codex connection 确实不存在、任务未创建消息、send count 未变化、runtime/专家/草稿均未变更时，才能生成 `qbot-core-beta-runtime-prerequisite/v1` 并记为普通 `blocked`；本 Case 不可能产生的 Expert Builder、能力选择/执行和 task/prompt/reply 角色可由该文件显式标为 `not_applicable`，manifest 仍须完整并继续后续独立 Case。未知错误、目标 connection 实际存在、connection view 缺失、已发生发送/专家选择/草稿变化或 blocker 文件校验失败一律保持 `automation_error` 并进入框架自愈闭环。
- `BETA-EXPERT-007` 只能发布本轮 suite ledger 中由 `BETA-EXPERT-002/003/004` 写入的 `claude-code_draft/codex_draft/manual_draft`。任一上游 Case 未产生对应账本键时，框架必须先建立空任务零能力状态，忽略账号内全部历史草稿，生成与当前 Case、三条上游来源和缺失键精确绑定的 `qbot-core-beta-expert-prerequisite/v1` blocker；`expert_publish_operation`、`restart_trace`、`credential_redaction_scan` 和能力选择/执行角色可受校验地标为 N/A，action receipt、公开状态和 cleanup 仍须真实完整，Case 记可信 `blocked` 并继续。草稿并发身份兼容两代公开 bridge：旧版使用非空 `etag`，新版使用正整数 `revision`；上游只有同时取得 draftId 和其中一种公开 CAS 才能写入成功账本，发布必须传回同一种 CAS。blocker 生成器、N/A manifest 校验器和发布执行器必须共享这一 CAS 口径，禁止生成端接受 `revision`、manifest 端再硬要求 `etag`。账本键存在但 draftId/CAS 残缺、CAS 类型/值自相矛盾、空态读回失败、blocker 身份/路径/缺失键漂移或 N/A 越权仍属于 `automation_error`，必须冻结并进入自愈闭环；禁止直接抛异常、伪造 etag、复用历史草稿或只补 synthetic 结果。
- `BETA-EXPERT-008~016` 中依赖已发布专家的 Case 必须使用本轮 suite ledger 中按上游 Case 写入的精确 expertId/releaseId/versionId，并与 live expert inventory 三字段完全一致。账本键缺失时必须忽略账号内所有其他 active expert，建立空任务零能力状态，生成 `qbot-core-beta-expert-prerequisite/v1` 可信 blocked 并继续；本轮身份存在但产品目录不可见时形成证据完整的产品 Bug 并继续；账本身份字段残缺、空态读回失败、blocker 越出当前 Case 目录或 N/A 角色越权时属于 `automation_error` 并冻结自愈。禁止 `activeReleaseId` 任意 fallback。
- `BETA-MCP-001` 必须以当前 connector catalog 的 `statusKind=ready`、`usable=true` 以及有效工具开关为权威可用状态，同时兼容独立 health probe 的 `healthy/ready` 终态；`skipped/stdio_not_probed` 不能覆盖 catalog 已接入状态。只读工具判定必须排除 create/update/delete/send/write 等破坏性动作，即使其错误携带只读 hint 也不得放行，并按冻结的 backend、prompt policy、feature flags 和 QWork 构建身份计算选择种子，依次从文档、搜索、数据、协作、可视化五类确定性选择唯一 key。若真实目录缺少任一分类或可用样本不足 5 个，框架必须建立与当前 Case 精确绑定的结构化空任务零能力读回，生成 `qbot-core-beta-mcp-prerequisite/v1` 可信 blocked；`BETA-MCP-002~008` 必须从同一 suite ledger 验证并传播该 blocker，将未发生的 task/prompt/reply/能力执行及故障诊断角色显式标记 N/A 后继续后续独立 Case。禁止直接抛异常、随机换用其他 connector、把目录短缺写成 manifest 缺失，或让 prerequisite `blocked` 覆盖已经发生的 `automation_error`。
- MCP 目录 bridge 成功返回可解析结构但 `items=[]` 时，空目录本身是完整的产品负向读回，不是证据缺失：`capability_inventory` 必须写为 `valid=true/evidence_valid=true/oracle_valid=false`，并由上述 prerequisite 形成可信 blocked 后继续。证据有效性只能由固定 bridge 来源、原始目录结构、显式读取错误和规范化 `items` 数组判定，禁止再使用 `items.length > 0`。bridge 超时/异常、原始目录不可解析或 `items` 非数组时仍须写为证据无效并按 framework issue 硬停止。
- Agent 澄清/推荐选项仍按统一策略自动点击精确“跳过/跳过（用默认）/关闭并使用默认答案”并保存前后证据。因此正式 Casebook 的测试数据和首轮 prompt 必须自包含且确定，不得保留“目标问题”“给定问题”等占位语句，也不得依赖运行时澄清来补齐主题、时间点或业务 Oracle。`BETA-EXPERT-008` 必须冻结 as-of 日期、具体研究主题和至少两个官方来源要求。
- `SIT-EXPERT-002` 与 `SIT-EXPERT-022` 在专家页缺少稳定
  `[data-testid="expert-general-assistant"]`，或入口可见但真实点击失败时，属于用户可见
  的产品负向结果。runner 必须保存专家页正文、失败截图、失败 action receipt 与
  `category=bug` 断言，然后正常执行公开状态、产品动作 trace 和清理读回收尾；不得让
  通用 `clickSelector()` 抛异常造成 manifest 缺失。只有专家页导航、页面读回、截图或
  通用证据材料化本身失败时，才按 `automation_error` 硬停止。
- framework/testcase issue 若使批次在 `BETA-SKILL-003/004` 安装后、`BETA-SKILL-012` 清理前中止，后续初始化不得忽略遗留 Skill，也不得人工或用临时 CDP 脚本卸载。先永久冻结源批次，再在同一发布身份、同一 Casebook 和同一 Teams 输出根的新目录中单独执行 `BETA-SKILL-001`，并传入 `--core-beta-cleanup-from <frozen-source-out>`。Daily83 CLI 仍请求叶子 ID `--case BETA-SKILL-001`；共享入口必须把该特殊清理直接路由到 v2，v2 只为清理选择导出完整 Sheet，从唯一 `QW-SKILL-001.compound_subcases` 路径解析叶子并在 `casebook-cases.json.cleanup_selection` 记录路径，禁止执行整个父 Case。框架只允许导入源批次的 `core-beta-suite-ledger.json`，且必须验证 003/004 为真实 executed 且 manifest 完整、10 个 qualified identity 唯一、与安装前基线无重叠、安装尝试账本完整、Casebook SHA 和宿主/QWork/control plane/release inputs/产物指纹完全一致；Daily83 的 `BETA-SKILL-002/003/004` 位于 `QW-SKILL-001.subcase_results` 时，必须按唯一父子路径解析，并验证父级到叶子的全部 provenance 都为真实 executed，重复、synthetic 或非 executed 路径一律拒绝。验证结果、父子路径、源账本 SHA、源 progress SHA 和目标 identity 必须写入 `core-beta-run-owned-skill-cleanup-source.json`。任何漂移或缺失都 fail-closed。若产品在清理前已升级且旧发布无法精确恢复，只允许显式增加 `--core-beta-cleanup-release-migration true`；该例外仍要求同一 360Teams 产品和 App 路径、同一 live profile alias、同一 control plane、同一 QWork release root、QWork version 与 versioned file URL 精确绑定、同一模型档位、Casebook SHA 不变且新旧制品 SHA 完整，并在 v2 清理来源记录中同时保存新旧身份哈希、差异字段和逐项门禁结果。未显式授权或任一安全检查失败时继续 fail-closed；跨发布清理只移除旧冻结账本中精确记录的 QA identity，不能继承任何旧 Case 结果。清理 Case 必须逐项仅移除当前仍存在的目标 identity；调用产品 `uninstallSkill(name)` 时必须传入与真实 UI 相同的非空字符串 name，禁止传入 catalog 对象，并保存 identity、request name 和 API 收据的一一对应账本。API `ok=true` 只表示动作收据，不能单独证明清理成功；框架必须在最长 `60000ms` 的有界窗口内轮询真实 `catalog.installed`，要求全部目标 `remaining=0` 且至少连续 2 次读回缺席，同时证明无基线 Skill 变化，才可令 `cleanup_verdict.valid=true` 并生成完整 manifest。若一次完整轮询后仍有目标存在，框架只可对该轮权威读回仍存在的同一批 run-owned identity 再执行有界幂等卸载，最多 3 轮；每轮都必须保留精确 identity/name、API 回执和完整缺席轮询账本，禁止扩展到基线或其他 Skill。若精确卸载调用只返回已知的 `control-plane request timed out`，不得在 API 回执处提前抛错；只有请求 identity/name 一一对应、该 identity 已纳入同一次有界轮询、全部目标连续至少 2 次权威缺席且基线 Skill 完全未变时，才允许把该歧义超时记录为 `terminal_reconciled=true` 并计入有效清理。3 轮后目标仍存在、读回不足、identity 不匹配、权限/业务错误或其他非超时错误一律不得对账，继续以 `automation_error` fail-closed。清理成功后仍须新 pretest、新不可变目录和完整 selected scope 重跑，清理批次本身不能计入门禁结果。
- 受管 360Teams WebView 在刷新验证时可能销毁当前 CDP target。执行刷新并重开任务的 Case 必须识别 closed target 或 execution context destroyed，重建受管 CDP 连接、接管 replacement QWork renderer、更新共享 page 并保存重连账本；不得把预期的 renderer replacement 直接落成不完整 manifest。
- replacement renderer 或受管宿主恢复必须始终以本轮首次连接后冻结并写入 `run-metadata.json` 的 QWork versioned file URL 为唯一 pin。Teams profile、刷新后临时 renderer 或宿主内置 manifest 中出现的旧 URL 只能作为漂移观测，不能覆盖冻结身份。Case 内的 renderer refresh/reload 必须通过上游 CDP 在同一 360Teams 宿主的 `<webview>` 上执行 host-owned pinned remount：若 renderer 已自行恢复则只验证终态；若暂时缺失或暴露陈旧 URL，则必须把 `src` 定向恢复为冻结 URL，并通过 WebView reload 重放 Teams 自动登录握手。重挂载前后受管 session、宿主 PID 和上游 CDP 必须完全不变；随后才能重建代理，重新校验冻结 QWork URL、control plane、登录态、capabilities 和 workbench，并更新共享 page。不得因为 WebView 短暂消失或陈旧 URL 而停止或重启整个 360Teams。remount 超时、宿主 PID/CDP 变化或冻结身份复核失败必须保留 automation error 并进入自愈闭环，禁止用隐式宿主重启改变 Case 动作语义。
- 360Teams 适配层只可在首批 Case 开始前的 preconnect 周期执行一次受管宿主恢复，并在恢复后获得一个最长 `60000ms` 的有界验证窗口。历史合同中的显式 managed-host restart 完成后，重连 hook 只能接管已经由该 Case 动作启动的新宿主，不得再追加一次恢复；接管成功前必须重新校验 Teams/QWork/control plane 与全部发布 artifact，并把新 PID 追加到 `run-metadata.json.observed_host_pids`。当前 70/160 不包含宿主重启 Case，因此 Case 执行阶段出现未声明 PID 变化属于 framework issue。
- 模型无回复属于产品失败，不等于证据缺失。允许两种失败终态：一是完整等待窗口耗尽（`terminal_outcome=timed_out`，`waited_ms >= timeout_ms >= 60000`）；二是确认发送且真实进入运行态后已经停止、等待至少 `60000ms`、连续至少 3 次稳定采样仍无可归属助手正文（`terminal_outcome=no_reply`）。两者都必须保存明确 terminal reason、任务绑定、发送回执、终态截图及其 SHA-256，`reply_completion` 才可标记为“失败终态证据完整”；其产品完成状态仍必须为 `complete=false`，Case 仍判失败/bug，禁止借此形成 pass。写入 `no_reply` 前必须重新采集一次仅限当前 `assistant-thread` 的结构化消息时间线，同时精确绑定当前 taskId 和本轮 prompt；分支/追问消息即使不位于首个 `message-list` 包装下也必须被采集。终态复核已存在任何非空的 prompt 绑定助手正文时必须返回真实回复，短回复不受通用整页差分长度门槛限制；缺 taskId、缺 prompt 绑定或任务漂移必须 fail-closed，禁止归类产品 `no_reply`。没有“曾进入运行态”证据时也不得把排队任务提前判为 `no_reply`。
- 停止生成 Case 必须先绑定当前 task，并同时观察到 `running=true`、停止入口可见和非空助手正文增量后才能点击停止。正文必须通过独立正文节点读取，明确排除 reasoning/思考摘要、chain-of-thought、处理中状态和工具区域；即使这些区域已有较长可见文本，只要正文仍为空就禁止点击停止。停止前必须保存 `partial-reply-precondition-readback.json` 和可见片段截图；停止后必须保存 `stop-generation-readback.json`，证明原 task 已结束运行、`partial_chars_before_click>0` 且 `retained_chars>0`。前置不成立时框架禁止点击停止，不得把“还没生成任何正文”误报为产品丢失部分内容。若已确认发送、绑定 task、观察到运行态和停止入口，但完整 `90000ms` 窗口内正文仍为空，必须保存包含 `timeout` 的终态截图并以 `terminal_outcome=timed_out` 写齐 prompt、send receipt、transcript、reply delta 和 reply completion，将其判为证据完整的产品失败；少于 `60000ms`、缺少 task、确认发送回执或终态截图时仍须 fail-closed。失败证据落盘后可调用受管超时清理停止残留运行态，但清理点击必须明确标记 `cleanup_click_is_case_action=false`，不得冒充本 Case 的停止操作；清理每次尝试前必须重新读取公开运行态并重新定位当前可见停止控件，最多两次短超时点击，只有同一非空 taskId、公开状态可读、`running=false` 且停止控件消失才算成功；清理失败才升级为 `automation_error`。停止后追问必须使用当前 task 上下文的确定性 Oracle，不得用通用分词相关性将合理说明误报为产品 Bug。
- 用户真实点击停止后的终态必须以 `terminal_outcome=user_stopped` 材料化全部标准会话角色：`prompt`、`send_receipt`、`transcript`、`reply_delta`、`reply_completion`。`reply_completion.complete` 必须为 `false`，`terminal_failure` 必须为 `false`。只有确认发送 prompt SHA、停止前后 taskId、`running=true -> false`、停止点击、停止前非空 partial、停止后 retained 读回（允许为 0 以记录产品丢失）以及前后截图 SHA 全部精确闭环时，`evidence_complete` 才可为 `true`；`partial_preserved` 与 `retained_chars` 单独承载产品 Oracle，丢失时必须判产品 Bug，但不能把证据完整的产品失败升级成 manifest 缺失。禁止把用户停止伪装成普通 `completed`，也禁止因这一受支持的非 completed 终态造成框架硬停止。
- 停止前置截图与真实点击之间不得复用旧 locator，也不得使用会继续等待 detached DOM 的 `locator.evaluate()` fallback。runner 必须在点击前重新读取同一 task 的公开运行态，并重新定位最新可见停止入口；第一次短超时点击因控件替换失败时，只允许在同一 task 仍为 `running=true` 且最新停止入口可见时再重定位重试一次。若重新定位时同一 task 已自然完成且停止入口已消失，必须记录 `outcome=completed_before_stop`、`stop_action_performed=false`，保存前后截图、确认发送、task 绑定、当前完整 transcript/reply/state 与标准会话角色，将本次停止验证记为证据完整的 `blocked` 并禁止继续追问或重发；不得伪造停止点击，也不得因此留下 incomplete manifest。task 漂移、公开状态不可读、同一 task 仍运行但最新停止入口不可见，或两次短点击均失败，仍属于 framework issue 并 fail-closed。
- 串行与 single-host pipeline 的每次回复轮询都必须识别 Agent 澄清/推荐选项面板。仅当页面存在精确的“跳过”“跳过（用默认）”或“关闭并使用默认答案”入口，且同一 surface 具有问句或标准 dialog/多选项结构时，runner 才可逐页点击默认跳过；每次处理必须保存问题、选项、动作、前后截图和 `assistant_confirmation_interactions` 账本，然后继续等待同一 task ID 的回复。不得因问句文案变化漏处理，也不得把普通产品向导的“跳过”误点为 Agent 答案。
- 推荐选项点击后的消费判定必须绑定点击前捕获的按钮和所属 surface DOM 实例，禁止用会自动重绑的 locator 判断原面板是否仍存在。原按钮或 surface 已 detached/hidden，且当前重新定位到另一张合法 Agent 面板时，即使问题文案和“跳过”按钮完全相同，也必须判定原点击已消费并继续逐页处理；产品复用同一 DOM 和同一文案时，只允许以去除计时文本后的 assistant-thread 工具/命令进展指纹变化作为后备推进证据。每次交互账本必须记录原实例状态、replacement、surface signature 和进展指纹 SHA。原实例仍可见、surface 文案未变且工具进展指纹未变时必须 fail-closed；普通“跳过向导”仍不得进入该策略。
- 360Teams 附件拒绝弹窗必须由受管框架闭环处理，不得依赖人工点击或 Computer Use。Core Beta v2 优先把 Playwright `dialog` 文案与 macOS Accessibility `AXSheet` 文案精确绑定，并只点击唯一的 `OK`、`确定` 或 `知道了`。部分 Teams/Electron 组合不会把 JavaScript `alert` 暴露为 `AXSheet`；此时仅允许 Playwright 对“附件类型不支持/上传失败/数量或大小超限”白名单 `alert` 执行 `accept`，且必须在接受前保存 Playwright 原始文案、类型、派发前截图、原生屏幕截图和结构化账本，接受后保存关闭截图并验证弹窗已关闭、页面恢复响应、Composer 附件为空以及未创建任务/未发送。缺任一证据、非 `alert`、多按钮、破坏性、无关或文案不一致弹窗必须 fail-closed。若多个白名单 alert 排队，点击后出现不同文案的下一张 AXSheet，表示原弹窗已经关闭，清理循环必须继续处理下一张；同文案仍在才视为未关闭。每条 Case 和 pipeline 派发开始前必须先按同一白名单清理上轮残留弹窗，再做 Escape/DOM 清理。
- 成果 HTML 预览失败可能留下文案精确为“无法在 QWork 内预览该 HTML 文件 <path>.html”的单按钮 `AXSheet`。前一叶子必须保留该产品失败；下一叶子的通用前置清理只允许对上述精确文案且唯一按钮为 `OK/确定/知道了` 的提示执行安全确认，并保存原生 before、页面 after、关闭读回和结构化 ledger。该兼容不能放宽附件拒绝专项 Oracle，也不能接受多按钮、破坏性或其他未知错误提示。
- `BETA-FILE-006` 的不支持类型、单文件超限和总大小超限必须各自在新建的干净草稿内证明 `activeId` 为空、`sendCount/messageCount` 不变、`running=false` 且 Composer 附件数为 0，再聚合为 `attachment_readback` 和独立 `composer_attachment_state`。不得跨三次“新建任务”比较批次前后的全局 `messageCount`，因为正常草稿隔离会清空旧消息，该变化不能作为发送证据或失败依据。
- 附件 prompt 一致性检查只适用于真实附件 Case（附件类型、`BETA-FILE-*`，或场景明确要求上传/读取文件）。成果生成 Case 即使文案包含 Markdown、HTML、Excel 等扩展名，也不得被当成附件 Case，不能用描述性 `test_data` 覆盖 Casebook 声明的 `conversation_turns.prompt`。
- Core Beta v2 附件 executor 必须在协议层冻结 `BETA-FILE-001~005` 的精确文件名、数量和顺序，并把该映射并入 Case 合同哈希与 pretest 本地 fixture 检查。运行时实际准备的附件账本必须与协议映射逐项完全一致；缺文件、多文件、顺序漂移或用通用附件替代专用 fixture 都属于 `automation_error/framework_issue`，必须在发送前 fail-closed，禁止让 Agent 对错误输入作答后再把合理回复误报为产品 Bug。
- 所有复用 legacy driver 的附件叶子同样必须在调用 `uploadAttachmentsInComposer` 前建立真实源文件账本，逐项记录路径、文件名、非零大小和 SHA-256；materializer 只能从该账本物化 `attachment_name_size_sha256`。文件已落盘但未注册角色、事后补写或仅凭文件名/关键字推断都属于框架问题。`SIT-HOME-056` 必须先记录 TXT、Markdown、JSON 三个源文件，再执行上传和按卡片删除。`BETA-FILE-010` 还必须从受管 QBot 日志冻结本 Case 开始/结束偏移、最多 1 MiB 的有界窗口 SHA-256 和字节数，原始日志正文不得复制进 `log_excerpt`；日志缺失、轮转或截断必须 fail-closed。
- `compound` 父 Case 聚合为 `blocked` 时，必须把首个阻塞叶子的具体 `blocked_reason` 传播到父结果，同时保留叶子 ID 与状态摘要。二次可信复核必须能够区分明确的账号/数据/权限前置与框架能力缺失；只有父级泛化状态、没有具体叶子原因时不得判为可信阻塞。
- `BETA-FILE-002` 必须上传互异的 `qbot-image-flow.png` 与 `qbot-image-risk.png`，真实删除并恢复其中一张，最终 Composer 仍精确包含两张图片后才能发送。回复 Oracle 必须同时命中 `QBot Release Flow`（允许标准中文等价标题“QBot 发布流程”）的 INPUT/ANALYZE/DELIVER 与发布证据门禁，以及 `Release Risk Matrix`（允许标准中文等价标题“发布风险矩阵”）的 IMPACT/PROBABILITY 和 P0/P1/P2 锚点；轴名允许标准中文等价词“影响/影响程度”和“概率/可能性”，风险标签允许 `data loss/数据丢失`、`timeout/超时`、`copy/数据复制` 的精确中英文等价词，P0/P1/P2 与对应风险标签之间允许空白、项目符号、冒号、短横线和 Markdown 标记等常见等价格式，但两张图标题、两组轴以及 P0/P1/P2 与三组风险标签的一一对应仍须全部精确命中。只上传或只识别一张图片不得产生可信产品结论。
- `BETA-FILE-005` 的 JSON、HTML、JS、日志必须由同一 Case 运行时确定性生成，四个文件共享 `QBOT-BETA-REQ-20260729`、`UPSTREAM_TIMEOUT`、`upstream_service_timeout` 和 `retryable=true`。回复必须识别四种格式并沿 requestId 关联错误码、根因和重试结论；不得复用不含 requestId 的通用 fixture。
- 成果证据必须把“证据文件结构有效”和“产品业务 Oracle 通过”分开记录：`valid` 只表示证据 JSON 可解析、取证动作已完成，产品侧文件缺失、格式不符、内容不符或预览失败写入 `oracle_valid=false` 并形成 `trusted_bug/trusted_fail`，不得仅因产品失败把 `artifact_path_sha256`、`artifact_content_readback`、`artifact_preview` 或 `svg_dom_readback` 标成 manifest 无效。真正的证据缺失、空文件、越界、坏 JSON 或截图采集失败仍须 fail-closed。
- `SIT-ART-021/022` 的成果事实回读必须在 legacy 与 Core Beta v2 runner 中使用同一数字分组符归一化合同：只移除两个数字之间的英文逗号、中文逗号或下划线，再核对全部期望事实。`12,000`、`12，000` 和 `12_000` 必须与 `12000` 等价；缺少任一期望原始数仍必须失败。禁止一套 runner 归一化而另一套直接执行原始字符串 `includes`，从而把完整真实成果误报为产品 Bug。
- `BETA-ART-001` 的“交互式 HTML”允许无远程资源的内联脚本；安全性不能用“文件中完全没有 `<script>`”替代。runner 必须在成果区同时看到并逐项打开 Markdown 与 HTML，确认 Markdown 源码包含 A=12、B=8；HTML 必须进入当前 QWork 受管网页预览、内容可见、分享按钮 enabled、分享对话框无错误，同时不得在宿主 DOM 留下执行标记或非白名单弹窗。旧源码查看器只能作为补充安全证据：若存在，脚本文本可见但查看器内不得创建真实 `script`/`iframe` DOM；它不能替代网页预览或分享 Oracle。任一成果只存在于工作区而未进入当前任务成果区、网页预览/分享不可用，或 HTML 污染宿主，均为产品失败；证据完整时不得升级成框架问题。
- `BETA-ART-001` 的网页预览只有在 iframe 正文或已解码快照真实可见、全部 loading 状态消失且没有预览错误时才算内容完成；`web-preview-loading`、刷新状态或只有空 iframe 不能通过。分享动作必须等待分享对话框进入 ready 并读回非空分享 URL；只看到 sharing 对话框不得通过。
- `BETA-TASK-008` 的干净“新建任务”属于草稿态，权威状态必须是 `activeId=null`、`isDraft=true`、`messageCount=0` 和非空 `draftInstanceId`；不得要求框架伪造第二个 taskId。空闲 Composer 的第一次物理 `ArrowUp` 只建立外边界握手且输入不得变化，第二次物理 `ArrowUp` 才进入历史；新草稿和重开原任务都必须按同一两阶段握手复核。隔离 Oracle 仍必须证明新草稿两次 `ArrowUp` 都为空，并能按原 taskId 重开旧任务后在第二次 `ArrowUp` 回放最新输入。
- `BETA-ROUTE-001` 的期望模型集合必须复刻当前产品菜单策略：以当前任务 `runtimeFamily` 为准；桌面 Auto 或 `manual_override_auto` 状态且 `manualModelOptions` 非空时优先使用该集合，否则使用 `runtimeOptions.options`，再按 disabled、runtime family、Claude Code=anthropic、Codex=response 和 M1-M4 过滤。DOM 读回必须从 `composer-safety-level-option-<tier>-<modelId>` 和所属 `data-tier` 分组还原同一多重集合。
- 每条需要固定模型档位的 Case 在发送前都必须重新读取连接视图。若前一条 Case
  结束在技能、专家或其他非 Composer 页面，首次读回没有 `runtimeOptions` 时，runner
  必须先通过公开【新建任务】入口恢复到干净工作台，再执行一次只读连接视图读回，并
  在模型证据中保存恢复动作、是否成功和第二次读回结果；恢复后仍不可读或档位不可用
  才可保持 `blocked`。不得直接把技能页等非 Composer 表面写成“无法切换模型档位”，
  也不得复用上一 Case 的模型选择证据。
- `BETA-ART-004` 必须从真实 PPTX slide XML 与 PDF 文本页读回执行业务 Oracle，不能用“PPTX 可解压、PDF 至少一页”代替。两者都必须恰好五页且无空白页；PPTX 五个页标题必须逐项出现在 PDF；两种格式都必须命中曝光 1000、点击 100、转化 20；PPTX 至少一页必须同时承载三项指标和足够的可见绘图 shape，证明漏斗图表实际存在。漏斗几何既可由非矩形图形或 chart/media 承载，也可由至少三层同中心、纵向排列、等高且宽度逐层显著递减的 `rect/roundRect` 承载；普通等宽卡片、横向指标卡或错位矩形不得通过。PDF 文本优先使用 `pdftotext`，不可用时使用 PyMuPDF 结构化逐页提取；两个适配器都不可用时不得判产品通过。对应回复还必须同时命中 PPTX、PDF、五页和三项固定指标，并由专用 Case Oracle 先于通用相关性判断。
- 通用回复相关性只用于拦截明显答非所问，不能替代 Case 的确定性业务 Oracle。确定性主题/结果规则必须先于通用文本长度门槛执行，使“项目代号是 Orion。”等完整短答案能够通过，同时保留未命中业务结果的短文本反例。中文长提示不得依赖整句 token 精确重合；漏斗数字、活动方案、ROI、PDF 结论页码、CSV/XLSX 差异与总计等核心任务必须以“主题词 + 业务结果词”联合校验，并同时保留无关回复反例。成果回复若重复了请求中的精确文件名并明确说明已生成/写入，应视为主题相关；`BETA-ART-003` 必须同时命中 XLSX/Excel、CSV 以及 `SUM`/合计/总计 Oracle，不得因长中文 prompt 分词失败而误报产品 Bug，也不得放行仅生成其中一个文件的回复。Core Beta v2 的 `conversation_turns` 若未显式填写 `turn`，必须按数组顺序生成稳定的 `第1轮`、`第2轮` 标签，证据文件、动作回执和断言中不得出现 `undefined`。`BETA-FILE-001` 必须校验三条第 1 页结论及 PDF 已知锚点；页码既可逐条标注，也可用“三条结论均位于第 1 页”或“第 1 页包含以下三条结论”等无歧义范围语句统一绑定，但否定绑定、页码分散或只有页码没有已知锚点仍必须失败。`BETA-FILE-004` 必须使用专用 `qbot-data-table-diff.xlsx`，校验三处数值差异和双方总计，不能复用数值完全相同的通用表格。双方总计必须与各自 CSV/XLSX 文件标签、对应表格行，或先与文件唯一绑定再用于总计行的无歧义字母/数字表别名（如 `表 A/表 B`、`表1/表2`）关联；独立的 `总计/合计` 表头可以约束其后连续的文件标识数据行，且每行仍须按本行 CSV/XLSX 身份核对对应总计，不能只约束第一条数据行。行首 `总计/合计` 可以同时约束同一行的多个已绑定别名，但每个别名只允许读取到下一个表别名前的独立数值区间，防止交换总计误通过。允许表格列和求和算式等真实表达，但不得依赖跨段固定字符窗口，也不得用正文中散落的 `182/215` 形成通过。固定 `100/70/12` 的四轮数字记忆脚本只能由精确 Case ID `SIT-HOME-016` 使用，不得按“业务数字追问”等场景词误路由 Core Beta Case。该 Case 的首轮要求 `100/70/12`，报名追问只要求正确的 `100 人`，到场追问要求 `70 人 + 70%`，成交追问要求 `12 单 + 约 17.1%`；后续轮不得继续要求首轮全部数字或其他轮比例，数字或比例错配仍必须失败。若确定性 Oracle 已满足而通用相关性单独失败，必须按框架/Casebook 误判处理，不得上报为产品 Bug。
- 登录测试点回复的通用相关性必须采用双锚点：请求明确包含登录测试，回复同时命中账号/密码/验证码/凭证/会话等登录主题和测试/验证/流程/异常/安全等结果词。正常登录链路、错误凭证和退出后 token/session/cookie 失效等真实答案不得误判为不相关；无关天气回复仍必须失败。该通用判断不替代 `SIT-TASK-EDIT-001` 对历史消息编辑入口和编辑后分支状态的产品 Oracle。
- `SIT-HOME-062` 的边界 Oracle 必须把“无法/不能计算”和“算不出/算不了/得不出 ROI”等中文等价表达识别为明确的数据不足说明；输入 Oracle 必须把“成本/总投入/投入金额”识别为成本侧，把“收益/收入/营收/总回报/成交金额/成交总额/成交额/成交单数与客单价”识别为回报侧；公式必须在同一 ROI 表达式中保持 `(回报-投入)/投入` 的操作数顺序，回报操作数兼容“带来收入/带来的收益/产生收入/活动带来的总营收”等自然表达，并兼容全角括号、普通或 Unicode 减号、`/` 或 `÷`，以及“ROI 公式是 ROI = ...”“ROI 的公式是 ROI = ...”等自然前缀和无害重复前缀。由“比如/例如/示例”或明确条件句引出的金额只作为计算示例，不得误判成产品编造；“先假设某金额”等替用户代填的未提供值仍须失败。回复实际借用旧任务的报名/到场数字、渠道或“上一组活动”等事实必须失败，但“不会/不得/拒绝使用上次数据”等否定性边界说明不得误报为借用。缺任一输入侧、缺公式、公式顺序错误、编造金额或跨任务事实泄漏均不得因正文散落出现同义词而通过。
- `SIT-HOME-062` 的公式成本操作数允许“投入”“投入金额”“投入成本”“总投入”“总投入成本”和“成本”等等价表达，例如 `ROI =（收入 − 投入）÷ 投入` 或 `ROI =（收益 − 投入成本）÷ 投入成本`；该兼容不得放行 `(投入-收入)/投入`、`(投入成本-收益)/投入成本` 等操作数顺序错误。
- `BETA-FILE-001` 的正文先声明“三条关键结论如下”，紧接着以独立行 `第 1 页` 或 `第 1 页（全文仅 1 页）` 作为后续列表的范围标题时，属于无歧义统一页码绑定。该页码标题必须紧跟结论引导语且整行不得含否定文案；否定标题、分散页码或只有页码没有已知 fixture 锚点仍必须失败。
- 当任务明确要求附件/文件的“文件名和大小”时，通用相关性必须认可同时包含带扩展名文件名与带数值单位大小的回复，即使 prompt 没有预先写出运行时附件名。该规则必须同时保留缺少文件名、缺少大小和无关回复的负例，不能放宽为任意附件回复通过；`BETA-FILE-007` 的合法恢复分支还必须继续满足专用附件读回 Oracle。
- `BETA-FILE-007` 的 `attachment-limit-recovery-matrix.json` 必须分离证据完整性与产品 Oracle：`valid/evidence_valid` 只表示四类拒绝、合法附件源与上传、确认发送、task 绑定和标准回复终态证据都可验证；`oracle_valid` 才表示回复已稳定完成且精确点名合法文件的文件名与大小。完整等待窗口后以受验证的 `timed_out/no_reply` 收尾时，必须保持 `attachment_readback` 有效并记产品 Bug；不得因 `oracle_valid=false` 把它升级为 incomplete manifest/framework issue。
- `BETA-FILE-001` 的结构化表格若有明确“页码/Page”列，三条独立结论分别标注 `P1`、`Page 1` 或 `第 1 页`，也属于逐条页码绑定；少于三条或任一结论标到其它页仍必须失败。fixture 身份既可由正文标题 `QBot PDF Summary` 证明，也可由精确冻结文件名 `qbot-pdf-summary.pdf` 证明，但后者必须同时命中 Agent 读取目标、摘要、风险和产品友好四组内容锚点；Agent 读取目标允许“Agent 读取 PDF”与“Agent 的 PDF 读取能力”等等价词序，只回显文件名或页码不得通过。Agent 先记录某个附件适配器失败、随后明确完成 fallback 解析并给出正确 fixture 内容时，不得用跨句宽松正则把“改用附件工具…附件引用”拼接成“未收到附件”；只有连贯、明确的未读取/未收到/需重传终态才可触发附件丢失 Oracle。
- `BETA-FILE-004` 的行首 `总计/合计` 可以同时约束同一行的多个直接 CSV/XLSX 文件标签或已绑定表别名。表别名允许字母、阿拉伯数字或中文数字，例如 `表 A/表 B`、`表1/表2` 和 `表格一/表格二`，但必须先与唯一文件身份绑定。解析器必须把每个身份的数值区间截断在下一个文件标签或表别名前，分别核对 182/215；不得读取到行尾并把后一个文件的总计错配给前一个，也不得放行双方总计交换的反例。
- `BETA-FILE-004` 还必须识别制表符或 Markdown pipe 结构化表格中的列身份：当表头用不同列明确绑定 CSV 与 XLSX/Excel，后续 `总计/合计` 行可以沿用同一列位置而不重复文件名。解析器必须逐列核对 182/215，并保留交换两列总计必失败的 invariant；禁止脱离表头列映射，仅因总计行散落出现两个数字而通过。
- `BETA-FILE-004` 的文件行若受 `表格\t合计` 等结构化表头约束，合计单元格可以先展示权威总计、再在同一单元格用括号列出验算因子，例如 `qbot-table.csv\t182（100 + 70 + 12）`。解析器必须按表头定位合计单元格并核对展示总计，不能把括号内最后一个因子 `12` 误当总计；双方展示总计交换时仍必须失败。
- `BETA-FILE-004` 的结论段可以用 `表格 B（xlsx）高于表格 A（csv）` 等短文件身份重述已绑定别名。解析器必须在下一个表别名提及时截断身份片段，不能把后一个表的 CSV/XLSX 身份吞进前一个别名并污染已正确绑定的双方总计；别名绑定歧义或双方总计交换仍必须失败。
- `BETA-FILE-008` 的剪贴板入口必须区分“事件派发成功”和 DOM `dispatchEvent()` 的返回值：产品 paste handler 调用 `preventDefault()` 时返回 `false`，只要派发调用本身成功且 Composer 附件数与精确文件名发生预期变化，就属于已派发并被产品接收。`BETA-FILE-008/009` 的入口、预览、删除或去重 Oracle 失败属于产品负向结果；只要动作回执和 Composer 快照结构完整且后续操作安全，场景必须继续发送并固化 prompt、taskId、send receipt、transcript、reply delta/completion 及附件读回，不得在产品断言后提前返回。附件专项 artifact 的 `valid/evidence_valid` 只表示证据结构有效，产品是否符合 Oracle 必须单独写入 `oracle_valid`；不得用 `valid=false` 把证据完整的产品 Bug 升级成 framework stop。
- `QWD-ENTRY-002` 在建立任务 A 前准备 Skill/Connector 显式选择表面并各点击一个稳定 identity；任一旧版 manual 控件或新版具体能力控件已定位且点击已派发、但产品状态未生效时，`resetComposerControls` 必须保留失败交互，具体能力选择阶段则直接保留当前交互，不得被后续动作覆盖。若截图、空任务、零消息、发送计数不变和对应能力空选择均完整，runner 必须物化发送前产品失败 blocker，把未发生的 task/prompt/send/transcript/reply/capability execution 角色标为受校验 N/A，并为 `qwork_daily_readback`、`composer_attachment_state`、`data_integrity_readback` 写入 `evidence_valid=true/oracle_valid=false` 的负向证据。manifest 必须完整、结果保持 `bug` 并继续后续独立父 Case；失败交互、零发送读回或截图任一缺失仍是 `automation_error`。
- 发送前能力失败的证据生成器、manifest N/A 校验器与可信复核必须共享同一交互
  stage 集合：`skill_installation`、`manual_mode`、`manual_skill_selection`、
  `manual_connector_selection`。`skill_installation` 只接受已定位并真实点击当前
  目标 Skill 安装控件、出现明确安装失败/拒绝/禁止/不可用/授权失败终态、已安装列表
  精确读回目标不存在、失败页与已安装页截图均完整的产品负向证据；仅 pending、终态
  文案不明确、目标已出现在已安装列表或任一读回/截图缺失时仍须 fail-closed。无目标
  名称的通用失败还必须通过动作前/后文本差异证明本次点击新增，并把
  `action_bound=true`、`baseline_absent=true` 写入失败反馈；陈旧同文案不得复用。安装前
  和失败后还必须满足同一空 task、零消息、send count 不变、空选择及无 prompt/send
  receipt 守卫，才能将未发生的会话链与 capability execution 角色标为 N/A。不得出现
  生成器接受 Connector 具体选择失败、而
  manifest 再因漏识别该 stage 拒绝已验证 N/A 角色并把产品 Bug 升级成
  `automation_error` 的分叉口径。
- 当目标 Skill 已通过本轮安装终态和库存对账，但可见手动列表仍展示其它选项且缺少
  该目标时，这是产品库存不一致，不是自动化找不到控件。runner 必须写入同一
  `qbot-core-beta-capability-interaction/v1` 交互的
  `inventory_mismatch=true`、`selection_surface_located=true`、目标稳定 identity、
  手动列表结构、公开 `selectedSkills` 读回和失败截图；此变体允许
  `control_located=false/click_dispatched=false`，但只有列表、公开状态、截图和零发送
  守卫完整时才归类 `bug` 并由 `qbot-core-beta-pre-send-capability-failure/v1` 补齐
  N/A manifest。列表为空、公开状态不可读、目标身份不稳定或截图/目录边界缺失仍须
  `automation_error`，legacy 与 Core Beta v2 必须使用同一口径。尤其
  `SIT-SKILL-SCOPE-001` 的 verified-legacy driver 在发送前遇到这一库存不一致时，
  必须调用同一零发送材料化路径后返回；不得只保留交互诊断文件并让 manifest 把
  task/prompt/send/transcript/reply/capability 角色误判为缺失。
- verified-legacy driver 只用于选择执行逻辑；外层 Core Beta Case 才是证据、manifest、
  SHA 和 blocker 的唯一归属。执行器可以在内部使用 `SIT-SKILL-SCOPE-001`，但发送前
  负向证据的 `dependent_case_id` 必须为 `MRSMOKE-SKILL-001`，并可额外记录
  `legacy_case_id=SIT-SKILL-SCOPE-001`。manifest 校验必须以 `core_beta_case_id`
  作为 `expectedCaseId`；legacy 期望值优先取当前外层状态的 `legacy_case_id`，若
  `finishCase()` 只保留外层状态，则必须从同一 Case 的
  `artifacts.core_beta_legacy_driver.legacy_case_id` 回读。两种来源都必须拒绝缺失、
  错误或漂移的 legacy 映射；禁止把 legacy driver ID 当作外层合同 ID。
- `BETA-PERF-003`、`SIT-ISSUE-793` 等 #793 长文本滚动场景除原始 `thread-scroll-samples.json` 外，必须生成并注册 `performance_metrics` 角色。正式性能证据使用 `qbot-core-beta-performance-metrics/v1`，绑定 Case ID、有效样本数、生成态样本数、观察时长、滚动距离/高度、漂移判定、同 Case 目录内的原始样本绝对路径与 SHA-256。缺文件、空壳 JSON、样本越界、SHA 不一致或样本数不一致均属于 framework issue，必须硬停止并按新不可变目录全量重跑；产品滚动 Oracle 失败但上述证据完整时仍归类产品 Bug，并继续后续独立父 Case。
- #793 观察窗口内必须持续原子覆盖 `thread-scroll-samples.json`、`performance-metrics.json` 和 `issue-793-streaming-checkpoint.json`。checkpoint 至少绑定当前 Case、prompt SHA、确认发送回执、taskId、最后一次结构化会话快照、样本数、性能文件和采样阶段；采样间隔必须使用独立计时器，不能因旧 page 的 `waitForTimeout` 在宿主重启时先抛异常而丢失已有账本。renderer/宿主关闭后仍按 framework issue 硬停止，checkpoint 只保护诊断，不得把不完整会话伪装成可信产品终态。
- #793 长文本在完整观察窗口结束时若已有可归属助手正文但仍处于生成态，必须先保存
  `issue-793-after-timeout` 终态截图及 SHA，再材料化 `terminal_outcome=timed_out`、
  `assistant_reply_present=true`、完整等待时长、确认发送回执和明确失败原因；随后通过受管
  停止入口清理残留运行态。该终态属于证据完整的产品超时，Case 记产品 Bug 并继续后续
  独立父 Case；禁止先写 `reply-completion.json`、后补截图而被 manifest 误判为
  `reply_incomplete`。超时截图、等待窗口、发送回执或受管停止清理任一缺失/失败时仍按
  framework issue fail-closed。
- #793 专项长文本观察若确认发送后真实进入运行态，随后停止且至少等待 60 秒、连续
  至少 3 次采样仍为零正文，必须从确认发送回执冻结 taskId，并对当前
  `assistant-thread` 结构化时间线执行同 taskId、同 prompt 终态复核。复核仍无正文时，
  先保存 `issue-793-after-terminal-no-reply` 终态截图及 SHA，再材料化完整
  `terminal_outcome=no_reply`；该结果是证据完整的产品 Bug，必须继续后续独立父 Case。
  若终态出现任意 prompt 绑定正文则恢复真实回复；taskId/prompt 无法绑定、截图缺失或
  复核字段不完整仍按 framework issue fail-closed。专项观察不得绕过通用 no-reply
  证据合同，也不得把稳定停止后的零回复误写成 `completed` 或 `blocked`。
- Core Beta 叶子复用 legacy driver 时，driver 分流身份只用于选择执行逻辑；所有专项证据、manifest 和 SHA 归属必须使用原始 Core Beta 叶子合同 ID。禁止把 `SIT-*` legacy 身份写入 `BETA-*` 叶子的 Case 绑定字段，或反向跨 Case 复用证据。
- `BETA-HOST-003` 复用 `SIT-TEAMS-NEW-003` 时，legacy driver 的结构化
  `teams_local_execution` 必须在当前 Case 内归一化为真实的
  `host_lifecycle_trace` 和 `data_integrity_readback`。归一化必须校验外层/legacy Case
  ID、driver、task/session、实际 execution target（并单独记录是否符合
  `desktop-local` 期望）、cwd、源文件存在性、非空字节数、SHA-256 和目标内容；源文件可以位于受管桌面工作空间，但必须复制为当前 Case 内的普通文件，
  并在证据中同时保留源路径和 Case 内路径。`verified-legacy-product-action-trace` 必须
  是当前 Case 内 `qbot-core-beta-verified-legacy-trace/v1` 且 `evidence_valid=true`。
  产品 Oracle 的 `oracle_valid=false` 不得抹掉完整证据，但空文件、`valid=false` 占位、
  Case 外 trace、字段/身份/cwd 漂移均必须 fail-closed，禁止把占位 JSON 当作真实角色。
- Core Beta v2 在 renderer 导航瞬态期间执行 `page.evaluate()` 时，只允许最多 3 次有界
  只读重试；每次重试前等待新文档加载，并在公共状态快照保存尝试序号、耗时、瞬态标记和
  错误原因。`target/page/browser closed`、CDP 断开或不可恢复错误不得重试；全部瞬态
  重试失败必须保留原始诊断并按 framework issue 处理，禁止用缓存状态或空壳证据继续。
- `MRSMOKE-WEB-001` 复用 `SIT-CONN-019` verified-legacy Web driver 时，
  `capability_selection` 与 `capability_execution_event` 必须由同一 Case 的
  `web-search-quality.json`、确认发送 prompt、taskId 和公开
  `e2eCurrentTurnAuthority` 共同注册。能力选择必须精确包含
  `connectorRouting.effectiveConnectorIds=builtin:qbot_web`；执行事件还必须包含
  同一当前轮的 materialized connector、非 unsupported 状态和有效
  `providerReceiptHash`。Case ID、legacy ID、prompt SHA、taskId 或确认发送任一漂移，
  或 runtime authority/provider receipt 缺失时必须 fail-closed。回复正文、链接、
  工具名称文字和 raw `webSearchQualityVerdict` 均不能单独冒充能力选择或执行事件；
  Web 结果业务 Oracle 与上述证据完整性继续分离。
  verified-legacy trace 的生成时点早于外层 Core Beta action 物化通用
  `task-id.json`；该时序窗口不得把尚不存在的 task 文件当作能力缺失。只有与当前
  prompt 精确一致、带非空 `confirmed_at`、`receipt.ok=true`、用户消息精确匹配且
  全部成功尝试收敛到唯一 `activeId` 的确认发送回执，才可提供 taskId；随后仍须与
  `web-search-quality.task_id`、runtime `diagnostics.sessionId` 和外层 Case ID 全等。
  同 prompt 出现多个确认 taskId、发送回执缺失或任一身份漂移必须 fail-closed。
- 所有确认发送回执必须同时满足两类独立信号：当前会话相对发送前新增了一条与本轮
  prompt 规范化全等的用户消息，并且 `sendCount`、`messageCount`、非空 taskId 变化、
  `running` 启动或输入区从精确 prompt 清空中至少一项辅助变化成立。重复发送相同 prompt
  时必须比较相同用户消息的出现次数，不能因旧末条消息仍等于 prompt 而复用旧回执。
  单独 sendCount、messageCount、activeId、running 或 composer 清空都不得确认发送，
  也不得据此提供 taskId、启动回复等待或把发送后证据角色标为适用。
- `MRSMOKE-AUTH-001` 与 `SIT-WORKSPACE-001` 删除当前 task 的 cwd 后允许一种严格的
  产品负向发送终态：发送控件已真实点击且仅点击一次，本轮用户消息没有新增，但至少
  一项辅助状态发生变化，因此框架明确禁止重试；发送前后非空 taskId 必须稳定、终态
  `running=false`，并连续至少 3 次读回同一 session/消息/可见回复签名。该终态必须写成
  `qbot-workspace-rejected-send-receipt/v1`，保持 `confirmed_at` 为空，使用
  `evidence_valid=true/oracle_valid=false`、`accepted_by_product=false` 和
  `retry_safe=false` 表示“真实动作证据完整，但产品未接收本轮消息”。它可以满足
  `send_receipt` 证据角色并把当前 Case 归为产品 Bug，但绝不能冒充确认发送、提供新的
  taskId 或进入回复等待。点击缺失、重复点击、task 漂移、仍在运行、没有辅助变化、仍可
  安全重试、前后快照/稳定读回不完整或本轮用户消息其实已新增时，继续按
  `automation_error` fail-closed。legacy 与 Core Beta v2 必须共享同一生成和校验口径。
- 当前 70 条全量执行必须先按固定顺序执行 `BETA-INIT-001` 至 `BETA-INIT-004`。`BETA-INIT-005` 是已删除的历史 connection-cache/network-fault 注入场景，不得拼回当前发布门禁。初始化失败始终使本轮发布门禁为 NO-GO，但“发布阻断”与“执行停止”必须分离：任一初始化 `automation_error`、仍处于 pending、或运行时/SDK/工作台/输入区/按钮/capabilities/页面读回任一不可用时，当前 Case 必须记录为 `failed/automation_error` 或 `blocked`，保留根因和诊断，并继续后续 Case；只有同时失去 CDP/renderer/宿主执行能力时才停止。`BETA-INIT-001` 至 `BETA-INIT-004` 若留下 manifest 完整的可信产品 Bug，且上述公开可用性信号全部明确恢复，可以继续收集后续独立 Case 证据。系统设置页可能完整遮住 composer，维护终态采样中的 `composer_ready=false` 不能单独证明输入区失效；仅在明确产品失败后，框架必须通过真实【新建任务】入口返回干净草稿，保存前后截图、空任务隔离和公开状态读回，并以该恢复表面的可见 composer 作为独立信号。入口、干净草稿、截图或公开读回任一失败仍须把当前 Case 记为明确失败，不得只凭 capabilities 推断输入区可用。降级继续必须在 Case 结果中保存 `initialization_continuation` 和 `initialization-continuation-surface.json`，并明确 `release_gate_eligible=false`；后续通过不得覆盖或稀释初始化 Bug。
- Core Beta v2 的 `BETA-INIT-001` 至 `BETA-INIT-004` 必须从系统设置点击真实维护按钮；全量重初始化、Skill 重装和清空会话必须捕获与动作匹配的确认弹窗，禁止以直接调用 preload bridge 代替用户操作。
- `BETA-INIT-004` 点击清空前必须通过公开 `listSessions/getRunning` 枚举全部会话，只对真实 `running=true` 的会话调用按 ID 取消，并连续至少 3 次读回全部 idle；枚举、取消、稳定读回和前后截图必须写入独立不可变账本。若第一次真实 UI 清空明确返回 `active-session`，只能再次执行相同 idle 对账后重试一次真实 UI 清空，重试仍须重新捕获确认弹窗并使用不覆盖首次证据的截图；不得直接调用 `sessionsPurgeAllEnvs` 绕过 UI，不得盲等完整 Case 超时，也不得无限重试。清单不可读、取消失败或重试后仍被拒绝均为 `automation_error`，触发框架自愈与新目录全量重跑。
- 初始化动作必须证明本次点击引起了状态转换。优先取证按钮 busy/disabled 或维护区处理中状态；若动作短于轮询采样窗口，只有“动作前不存在、动作后新增、且与当前按钮精确匹配”的完成回执，加上确认弹窗和连续稳定终态，才可替代 transient busy。产品成功契约明确会刷新 renderer 的维护动作（当前仅清空全部会话），允许把确认动作后发生的主框架刷新作为因果动作信号，但仍必须同时满足匹配确认弹窗和刷新后的连续稳定终态；其他导航不得复用。陈旧完成文案不得复用。
- `BETA-INIT-001` 必须点击当前发布界面实际显示的“立即检查运行时”入口（当前 `assistant-prepare-python-runtimes`）；只有发布界面明确提供旧“检查更新运行时”入口时才兼容 `assistant-runtime-update-check`，不得因 testid 演进把可见入口误判为缺失。
- `BETA-INIT-001` 至 `BETA-INIT-004` 本身不发送模型请求，不能被全局模型档位门禁挡在初始化之前，可信复核也不得因这四条没有 `model_tier_before_send` 而判为框架问题。若启动时连接视图尚未恢复，runner 只可把模型检查延后到真实初始化之后；首个需要模型的 Case 及其每次发送前仍必须读取连接视图并精确锁定请求档位，无可用档位时禁止发送。
- `BETA-INIT-001` 至 `BETA-INIT-004` 的失败只有在 `initialization_action_observation.action_observed=true`，且 `qbot-core-beta-initialization-continuation/v1` 结构完整、`safe=true` 时，才可保留为产品 Bug 并继续收集后续独立 Case 证据。连续执行合同必须显式绑定同一 Case，并同时证明非 pending、产品失败来源、runtime/SDK/维护按钮/capabilities/页面读回可用，以及系统设置遮挡输入区时通过真实【新建任务】恢复的干净工作台。字段缺失、类型畸形、来源与终态不一致或任一信号不可读时，必须优先归为 `failed/automation_error`，可信复核固定为 `framework_issue`；人工说明、manual override、final override、安全拒绝或其它用户视角快捷分类均不得绕过。升级分类时必须保留原始产品失败候选及 reason，再追加初始化连续性失败，重复复核不得重复追加或抹除历史。
- `BETA-INIT-003` 不能只凭通用 runtime/SDK/capabilities ready 或“技能运行环境已清理”文案通过。真实点击和破坏性确认后，必须读取重装前后完整 `getSkillsCatalog()`，以前后 `sourcePlatform/namespace/slug/installedVersion|version|revision|packageDigest|fingerprint` 四元 identity 集合全等、非空且唯一为安装账本 Oracle；重装后 `syncStatus=idle` 必须连续至少 3 次，每个已安装项必须进入明确 ready 终态，`installStatus=ok` 与 `unready/python_runtime_failed` 并存属于产品失败，空 catalog、identity/readiness 缺失或重复属于证据失败。Case 必须生成 `qbot-core-beta-skill-reinstall-readiness-verdict/v1` 和 `skill_reinstall_readiness_verdict` manifest 角色，并引用同 Case 目录内的维护读回、终态采样、catalog 采样和终态截图。无论专项 Oracle 成功或形成证据完整的产品失败，收尾都必须通过真实【新建任务】恢复干净工作台，并另行生成 `qbot-core-beta-initialization-continuation-surface/v1` 与唯一独立 manifest 角色 `initialization_continuation_surface`；该角色不得由 `product_action_trace`、`skill_reinstall_readiness_verdict` 或通用 `initialization_continuation` 代替。恢复证据必须绑定同一 `BETA-INIT-003`，同时证明非空 `draftInstanceId`、`taskId=null`、`messageCount=0`、`sendCount=0`、`running=false`、Skill 与 Connector 选择均为空数组、Expert 为空，并固化互异的恢复前/后 PNG 普通文件路径、bytes 和 SHA-256。可信复核不得相信 verdict、surface、嵌入 manifest 或汇总的自报摘要：必须从可信不可变 run root 重新打开 JSON 和所有引用，逐级 `lstat` 拒绝符号链接、目录、Case/run root 越界和读取期间文件替换，以磁盘实际 bytes/SHA/schema/case/action/method/testid/确认/稳定采样重新执行 catalog 与 continuation Oracle，并与 verdict/surface/manifest 逐字段全等。任何引用伪造、漂移、缺失、角色重复或重放不一致一律为 `framework_issue`，且优先于人工/最终覆盖。Casebook 生成器必须把该完整合同同步写入含本 Case 的 `核心生命线门禁`、`生产灰度门禁Case`、`全量功能回归Case` 三张执行 Sheet，并在 `证据与断言` Sheet 汇总该独立角色；固定 G2 `新增MR核心冒烟` 不含 `BETA-INIT-003`，不得为其伪造适用性。
- 重初始化或清空会话可能触发页面导航或 replacement renderer。runner 必须刷新共享 page、必要时重建受管 WebView 连接，并在同一 Case 内等待公开维护区、Claude/Codex SDK、工作台、输入区和 capabilities 连续稳定；默认最长等待 `600000ms`，不得把“正在准备”截图当作 ready。
- 若维护区可见文案持续显示“准备中/处理中”，但 Claude/Codex SDK 均为 `ready/100%`，且运行时 loaded、维护按钮、capabilities、工作台和输入区连续至少 3 次全部可用，框架必须把该稳定矛盾固化为 `product_ui_state_conflict` 产品 Bug：终态为 `failed=true/pending=false`，专项证据 `evidence_valid=true/oracle_valid=false`。`BETA-INIT-001` 至 `BETA-INIT-004` 在页面读回也完整时必须写入 `initialization_continuation.safe=true` 并继续后续独立 Case；不得继续空等到超时后误报 `automation_error`。`BETA-INIT-001` 的运行时检查若得到明确失败终态，但 runtime loaded、Claude/Codex SDK、维护按钮、capabilities、工作台、输入区和页面读回全部可用，也适用同一安全降级合同。任一结构化信号未 ready 时仍按真实 pending 处理，并在有界超时后 fail-closed。
- 初始化异常必须保存原始 `message`、`stack`、动作回执和终态采样文件；最终结论可以是 `framework_issue`，但不得只留下“精准断言未全部成立”而丢失根因。
- 每轮全量初始化的目标是相对干净且可审计，不是删除用户真实数据。只能清理 runner 创建并被账本标记的 QA 资源。

## 8. 输出目录和必查证据

批次根目录至少应包含：

- `automation-progress.json`
- `automation-run-summary.json`
- `automation-run-report.md`
- `最终自动化测试报告.md`
- `二次复核报告.md`
- `二次复核结构化结果.json`
- `框架修复清单.md`
- `所有证据截图图集.html`
- `所有证据截图图集.md`
- `core-beta-protocol-preflight.json`
- `core-beta-fixture-readiness.json`
- `single-host-pipeline.json`（使用 pipeline 时）
- `logs/`

每个已执行 Case 目录至少检查：

- `case-result.json`
- `evidence-manifest.json`
- 编号步骤的 before/action/after 截图
- action receipt 和公开状态读回
- prompt、task ID、send receipt、完整 transcript、reply delta、reply completion
- 附件、成果、Skill、专家、MCP、工具调用或清理专项证据
- 证据文件存在、非空、SHA-256 与 manifest 一致且路径位于当前 Case 目录

manifest 缺失、`complete=false`、`missing_roles` 非空、SHA 不一致、Case 目录越界或 synthetic 结果进入可信 completed，全部属于框架异常；已开始执行的真实 Case 仍必须以 `failed/automation_error` 或 `blocked` 落盘并继续后续 Case。
产品动作失败本身不等于证据不完整：结构完整、包含 before/after 或明确 terminal 终态截图的 failed/blocked action receipt 仍是有效证据，最终业务结论可以是 `trusted_bug` 或 `trusted_blocked`。可信复核必须把 `category=bug` 且已保存用户可见失败终态的动作视为已执行，不得仅因步骤 `status=failed` 或失败证据正文包含普通“自动化”文字而改判为框架问题。runner 只能把 manifest 完整的真实执行结果计入可信放行；发现 synthetic、manifest 缺失/结构异常/不完整、角色无效或 SHA 缺失时，必须把当前真实 Case 记为 `failed/automation_error`，写入 `execution_completion.evidence_complete=false` 和根因诊断，然后继续。只有同时导致 CDP/renderer/宿主不可用时，才写 `framework-stop-diagnostic.json` 停止剩余 Case，禁止批量补 synthetic blocked。
Case 0、预检或顶层异常为了保留诊断而生成的 synthetic 条目只能写入 `non_executed_diagnostics`；`automation-run-summary.json` 的 `counts`、`results`、可信复核和结果表均必须排除它们。不得再出现“Case 0 未执行但 summary total 等于完整选择集”的伪完成。
对已确认发送但无可归属助手回复的 Case，manifest 的“完整”只表示失败证据链完整，不表示产品回复完成。`reply-completion.json` 必须同时保存 `complete=false`、`terminal_failure=true`、`terminal_outcome=timed_out|no_reply`、发送回执、等待时长、失败原因和终态截图 SHA。`no_reply` 还必须保存 `observed_running_after_send=true`、`running_after=false`、`min_wait_ms>=60000`、`no_reply_stable_observations>=3`、`terminal_reconciliation_performed=true`、`terminal_reconciliation_task_bound=true`、`terminal_reconciliation_prompt_bound=true` 和 `terminal_reconciliation_reply_present=false`；缺少任一字段时当前 Case 记 `failed/automation_error` 并继续后续 Case；仅在同时失去 CDP/renderer/宿主能力时停止批次。pipeline 不得在任务已停止且稳定无回复后继续把完整 `600000ms` 当作假进度，也不得逐条叠加无效等待。

## 9. 长批次只读监控

监控不得操作 QWork UI、不得连接 runner 临时 CDP/WebView 代理、不得启动第二 runner。

每次至少读取并记录：

- 北京时间。
- `completed/total`、`inherited/executed/synthetic`。
- 最后完成 Case 的 raw status、result category、execution provenance 和 manifest 完整性。
- 当前 Case/等待阶段。
- `automation-progress.json.updated_at`。
- 最新证据路径和 mtime。
- 唯一 runner、宿主 PID 和存活状态。
- Teams/QWork/环境/模型/CDP/框架 commit/tracked dirty。
- 无进度时长。

20 分钟无进度时，先只读核验当前 Case、账本、runner 日志、宿主日志和等待窗口。PID 存活不能单独证明正在执行：必须同时核验确认发送、taskId、运行态变化、轮询/账本/证据 mtime。任务仍真实运行时只等待；若已确认从运行态停止、等待至少 60 秒且连续 3 次无回复稳定采样，必须形成 `no_reply` 产品失败终态并继续独立 Case，不能继续空等到 600000ms。runner 消失且没有完整 summary 时只报告，不自动重启或续写。

### 9.1 监控发现 Issue 后的自主修复闭环

只读监控发现明确 `framework_issue` 或 `testcase_issue` 后，不能只通知用户并永久停在现场。后续 Agent 必须按以下顺序自主闭环：

1. 立即保存当前账本、日志、`framework-stop-diagnostic.json`、不完整 manifest 和最新证据；停止唯一 runner，并暂停指向旧批次的监控。
2. 将当前输出目录永久冻结。不得在原目录补写、删除失败结果、覆盖证据或把未执行 Case 补成 synthetic。
3. 在 `/Users/qifu/Documents/QbotTestAgent` 内定位根因，修复框架或 Casebook；不得修改 `/Users/qifu/Documents/deepbankV2` 来消除测试失败。
4. 每个修复必须新增或强化能够复现根因的回归/invariant，并按第 13 节运行全部强制校验。合同变化同时更新本文。
5. 修复只有在 `main == origin/main`、tracked dirty=false、检查通过且发布身份仍能精确恢复时才算可用于续测；正式 runner 不得基于未提交或未推送的框架启动。
6. 重新执行正式 pretest。只有新报告为 `READY` 或显式缩减范围时为 `READY_SCOPED`，才可在新的不可变输出目录启动唯一 runner。
7. Core Beta v2 必须重新执行本轮完整 selected scope，保持 `inherited=0`、`synthetic=0`；旧协议只有满足第 10 节 lineage/impact 合同时才允许恢复。
8. 用新 automation 替换或更新旧监控，使其只跟踪新目录和新 runner。旧批次仍必须进入最终发布报告，后续通过不得抹去原始 issue 或 flaky 记录。

对具备自动恢复条件的 framework/testcase issue，“停止旧 runner”只是证据保护步骤，不是任务终态。执行 Agent 必须在同一闭环内继续完成修复、检查、提交推送、新 pretest 和新不可变目录完整重跑；禁止以“批次已停止”或“后续 Case 未执行”作为最终交付。只有凭据/受保护资源缺失、需要人工授权、发布身份无法精确恢复或 pretest 明确阻塞时，才允许冻结并报告唯一具体 blocker。

若发现的是产品 Bug，监控不得把它改判为框架问题，也不得修改 deepbankV2；只在 Case 证据完整、fail policy 允许且后续 Case 独立时继续执行。若需要凭据、受保护资源、人工授权，或指定发布身份已经无法恢复，则不能安全自愈：保持冻结并向用户报告唯一具体阻塞，不得猜测、绕过或静默换环境。

## 10. 中断、修复与重跑

- 输出目录一旦产生真实 Case 结果，就视为不可变批次。
- 框架或 Case 修复后使用新的输出目录。
- Core Beta v2 的正式轮次要求所选 Sheet 全量真实执行：门禁为
  `executed=total=70`，全量回归为 `executed=total=160`，两者都必须
  `inherited=0`、`synthetic=0`。因此当前 70/160 正式批次都不使用跨批次继承；
  中断后在新不可变目录重新执行同一完整 Sheet。
- QWork 日常回归同样要求 `executed=total=83`、顶层 Case 唯一数为 83、
  全部 144 个叶子有独立完整证据，并且 `inherited=0`、`synthetic=0`。
  任一 framework/testcase 修复后必须新 pretest、新不可变目录，并从 1/83
  全量重跑；旧目录永久保留，不允许续写或只续跑剩余父 Case。
- 旧协议的 360Teams lineage 只有在显式 `--resume-from` 加 `--impact-case` 或 `--impact-all true` 时允许使用，且源批次必须冻结、证据完整、发布身份兼容。
- 发布身份变化时必须执行全量新批次，不能继承旧发布结果。
- 明确 identity drift、重复 runner、manifest 不完整仍被标记为可信 completed 或 synthetic completed 时，先把已开始的当前 Case 落盘为 `failed/automation_error` 并保留诊断；仅当 identity/宿主/控制面已经无法继续执行时才停止并冻结批次。其余情况继续记录后续 Case，批次完成后按第 9.1 节自主修复、校验并在新不可变目录重新执行，除非命中其中明确列出的不可自动恢复条件。

## 11. 可信复核规则

执行结束后必须逐 Case 复核，不能采用 raw 结论。标准分类：

- `trusted_pass`
- `trusted_fail`
- `trusted_blocked`
- `trusted_bug`
- `framework_issue`
- `testcase_issue`

复核顺序：

1. 编号步骤是否逐项执行。
2. before/action/after 是否对应真实按钮和真实状态变化。
3. prompt、task ID、transcript、reply delta 是否属于同一任务。
4. Agent 回复是否完整、相关、终态且没有底层错误泄漏。
5. Skill、专家、MCP 是否按稳定身份真正选择并产生任务绑定执行事件。
6. 附件、成果、工具调用、清理和公开状态是否有独立读回。
7. manifest、SHA、日志和产品功能是否一致。

只有证据完整且用户视角合理的结果才能归类为 `trusted_pass`。框架问题和 Case 问题必须先修复再重跑受影响范围；产品 Bug 必须保留可复现步骤和证据。

回复相关性必须采用与 Case 业务意图绑定的语义规则；不得仅因中文 prompt 是超过长度阈值的长句、通用分词未命中，就把明显覆盖核心业务名词与交付要求的回复判成产品 Bug。新增业务主题的相关性规则必须同时补充正例与负例 invariant，避免放宽后接纳无关回复。
`BETA-SEC-002` 与 `SIT-WORKSPACE-001` 的目录边界探测必须优先使用 Case-aware
安全 Oracle，不得回退到通用关键词相关性。对未授权同级目录、父目录、symlink
真实目标和 `../` 路径穿越，回复只有同时明确拒绝、给出可理解的授权/工作空间/越界
原因，并且没有复述 `B_NOT_AUTHORIZED`、`PARENT_NOT_AUTHORIZED`、
`SYMLINK_NOT_AUTHORIZED` 或 `TRAVERSAL_NOT_AUTHORIZED` 秘密标记时才通过；
只说“无法处理”的无关拒绝和任何秘密标记泄露仍必须失败。专用安全 Oracle 已满足时，
不得再追加通用“回复相关性”失败或把正确 fail-closed 产品行为记为 Bug。
同名附件 identity 场景要求通用相关性识别“剩余/保留附件、顺序、唯一标记/identity”的组合语义；回复明确列出剩余文件及其唯一标记时不得因长中文 prompt 分词失败误报产品 Bug，同时仍须以负例证明无关回复不会通过。专项 Oracle 继续独立核对上传账本、删除目标、剩余顺序、保留标记和已删标记缺失，通用相关性不得替代这些精确断言。

敏感信息检测必须区分“变量名/配置说明”和“真实凭据值”。Skill、连接器或管理界面中仅出现 `QBOT_LINGXI_ACCESS_TOKEN`、`DEEPBANK_SERVER` 等变量名，或出现 `[REDACTED]`、`<redacted>`、`***` 等明确脱敏占位时，不得判为产品泄漏；出现 Bearer/JWT、私钥、凭据字段赋值、内部环境变量实值或未豁免的 E2E 内部标记时仍必须失败。变量名误判污染 Case 结论属于 framework issue，必须冻结批次并按第 9.1 节完整自愈重跑。

## 12. 多轮生产灰度门禁

单轮全绿不授权生产。候选发布身份必须先完成至少 1 轮完整 160 条正常功能回归，
满足 `total=completed=executed=unique_case_count=trusted_pass=160`、
`inherited=synthetic=0`、全部证据完整、全部可信非 pass 分类为 0。160 条 Sheet 的
前 70 条与门禁合同完全相同，因此该轮前缀可计入下述 5 轮门禁中的 1 轮；后 90 条
不能拆算为额外门禁轮次，不完整的 160 批次也不能计数。

完整 70 条还必须在同一冻结发布身份下连续通过 5 轮，且每轮满足：

- `total=completed=executed=unique_case_count=trusted_pass=70`
- `inherited=0`
- `synthetic=0`
- `trusted_bug/trusted_fail/trusted_blocked/framework_issue/testcase_issue=0`
- evidence complete 和 action receipts 均为 70，missing/invalid 为 0
- 单 runner 唯一、cleanup 完成、fixture 恢复、真实产品执行成立
- flaky 为 0

候选轮次中至少一轮还必须完成不少于 100 个任务和 3 次重启的 soak，且无 crash 或资源泄漏。只有“至少1轮160/160 + 累计5轮70/70 + soak”全部成立，才可评估受控灰度。

G5 的唯一输入是新不可变目录内的磁盘 `qbot-qwork-soak-report/v1`。报告和所有外部证据
必须是同一目录树内互不复用的普通 JSON 文件；校验器逐级拒绝符号链接与路径逃逸，并
实读每个文件的 realpath、device/inode、bytes 和 SHA-256。每个真实 task 都必须唯一绑定
prompt/marker、task/session、完整 host/renderer context，以及相互独立的 dispatch、严格
确认发送和成功终态 receipt；终态至少包含三次同 task、同消息、同正文 SHA、`running=false`
的稳定观察。任务全局严格串行，`executed=true/inherited=false/synthetic=false`，每个宿主
epoch 至少完成一个 task，禁止把计数、文本占位或重复证据文件当作执行证明。

每次受管重启必须替换 host PID/process-start、renderer PID/process-start、session、CDP
endpoint 和 WebView target 的完整 tuple，并以有界新鲜的 `restart-before/restart-after`
十字段身份读回闭合；身份观察集合只能是 `startup + 每次重启前后 + run-final`，首尾观察
距离报告边界及重启观察距离对应边界均不得超过策略最大采样间隔。crash ledger 必须连续
覆盖每个 epoch，明确列出零 unexpected host exit、零 renderer crash 和零 crash report；
资源账本必须对每个 epoch 的 host 与 renderer 分别至少采样两次。声明的监控/采样间隔须为
正整数且可小于、不得大于策略上限；实际首尾覆盖和相邻采样间隔同样不得超限。RSS peak、
从各进程 epoch 首样本到中途峰值的 growth、相邻样本最大增长 slope 必须由磁盘样本重算并
同时低于阈值，不能只比较首尾 RSS 或信任 `no_leak` 自报。

G1-G4 已按状态机可信通过后，先用唯一受管宿主生成新的 G5 磁盘报告。Token 只通过
关闭回显的标准输入进入本次只读状态复核，不进入 argv、环境变量、文件或 Git 配置：

```bash
IFS= read -r -s QBOT_G5_GITLAB_TOKEN
printf '\n'
printf '%s\n' "$QBOT_G5_GITLAB_TOKEN" | npm --prefix teams360-automation run soak -- \
  --state-dir /absolute/path/to/release-control \
  --out /Users/qifu/Documents/QbotTestAgent/teams360-automation/output/<new-immutable-soak-dir> \
  --tasks 100 \
  --restarts 3 \
  --gitlab-token-stdin
unset QBOT_G5_GITLAB_TOKEN
```

`casebook-runner.mjs` 与 `qwork-soak-cli.mjs` 共用同一个 macOS `lockf` 进程生命周期锁；
两者竞争时只能有一个进入执行。锁文件固定为
`teams360-automation/runtime/.qwork-managed-runner.lock`，仅该精确运行时文件被
`.gitignore` 忽略，不能泛化忽略 `runtime/`。输出路径必须位于受管输出根下、此前不存在，
且全链路不得包含符号链接。报告生成并通过自身磁盘审计后，再使用同一控制目录登记 G5：

```bash
npm run qwork-release:orchestrate -- soak \
  --state-dir /absolute/path/to/release-control \
  --soak-report /absolute/path/to/new-immutable-soak/soak-report.json
```

只有磁盘复核得到 `qbot-qwork-soak-completion-audit/v1`、`passed=true`、
`decision=PASS_STAGE` 才完成 G5。报告的十字段身份 SHA 和 40 位 framework commit 必须
分别与计划及本轮候选全等。

五轮聚合不接受人工归一化的 `total/completed/trusted_counts/evidence` 等摘要。`runs.json`
必须精确包含 5 个 `qbot-core-gray-run/v2` 项，每项只绑定一个独立状态机控制树及其中的
G3 或 G4 completion event：

```json
{
  "schema_version": "qbot-core-gray-run/v2",
  "run_id": "<必须等于 completion evidence tree 的目录名>",
  "stage_id": "G3|G4",
  "control_dir": "/absolute/path/to/independent-release-control",
  "release_plan": {"path": "/absolute/path/to/release-test-plan.json", "sha256": "<64-hex-file-sha256>"},
  "completion_event": {"path": "/absolute/path/to/events/NNNN-G3|G4-completion.json", "sha256": "<64-hex-file-sha256>"},
  "soak_report": null
}
```

聚合器必须从初始状态重放每个控制树的完整 event/state/hash 链，对每个 event 的外部文件
和目录树重新计算 SHA-256，并通过 `applyQworkStageAudit()` 重新执行磁盘
`auditQworkStageCompletion()`；调用者自报计数永远不能放行。五轮的 release identity、
framework commit、正式 Casebook 路径/SHA、G3 等价 Case ID 顺序和完整 Case 合同必须
全等，completion 时间严格递增；控制目录、completion event、所有阶段 run directory、
可信复核、证据树及其路径、内容 SHA-256、device/inode 不得跨轮复用，五项 `run_id` 也必须
唯一。至少一项必须是完整可信的 G4 160/160，
其前 70 条与各 G3 等价轮次同序同合同，并且该项只计一个 70 等价轮次。

五轮中精确一项可带非空 `soak_report`，且只能挂在 G4 项上。对应同一控制树必须存在目标
G4 completion 之后唯一的 G5 `PASS_STAGE` completion event，G5 event 的磁盘报告路径/SHA、
计划身份和 framework commit 必须与该绑定全等。旧式内嵌 Soak 自报、独立于状态机的
Soak 报告、混合 framework commit、重复证据或任何非法策略均结构化返回
`decision=NO_GO`、`pipeline_decision=STOP_PIPELINE`，不得抛出未捕获异常。

```bash
npm run core-beta:gray-gate -- \
  /absolute/path/to/runs.json \
  /absolute/path/to/core-beta-gray-gate.json \
  5 \
  70
```

仅 `decision=GO_CONTROLLED_GRAY` 表示可进入受控生产灰度内测，不等同于正式 GA。

360Teams 现有生产策略还可执行：

```bash
npm --prefix teams360-automation run production-gate -- \
  --runs <run1,run2,run3,run4,run5> \
  --report-out teams360-automation/output/<gate-report>
```

## 13. Agent 交付要求

每次执行或框架变更，最终说明必须包含：

- 框架 commit、Casebook SHA、发布身份和环境。
- 执行命令和输出目录。
- Case 数、执行/继承/synthetic 数。
- raw 与可信分类统计。
- framework/testcase issue。
- 关键报告、截图图集、证据目录链接。
- 是否满足下一阶段门禁；若不满足，给出唯一明确原因和重跑范围。

修改框架、Casebook 协议或本文后，至少运行：

```bash
npm run check
npm --prefix teams360-automation run check
node src/cli.mjs ui-agent-casebook-run --help
npm run core-beta:pretest -- --help
git diff --check
```

未经上述校验，不得提交为新的框架基线。

## 14. 每轮执行前的 release intake 与变更影响扫描

快速迭代项目不能只依赖固定的“最近两天 MR”列表。每一个新的正式候选在 G0 和正式
pretest 之前都必须先生成一次只读 `qbot-qwork-release-intake/v1` 报告，并将报告文件
SHA-256 绑定到本轮 Casebook、QbotTestAgent framework commit 和 release/0.1 HEAD。
推荐入口为：

```bash
npm run qwork-release:scan -- \
  --repo /Users/qifu/Documents/deepbankV2 \
  --release-ref origin/release/0.1 \
  --freshness-source gitlab-api \
  --gitlab-token-stdin \
  --casebook <Casebook.xlsx> --sheet <exact-name> \
  --baseline-commit <last-accepted-release-commit> \
  --framework-commit <QbotTestAgent-main-commit> \
  --out outputs/<new-immutable-release-intake>
```

扫描器只读刷新 release 引用，枚举 first-parent 的直接合入提交，读取每个提交的真实
changed paths/diff SHA，并通过一次次独立的 GitLab 只读 API 请求核对 MR iid、标题、标签、
合并提交 SHA 和时间。GitLab Token 只能使用关闭回显的标准输入临时注入 curl 的 stdin；
不得出现在命令参数、环境持久化、日志、报告或 Git 配置中。扫描器不修改 deepbankV2，
不自动改写冻结 Casebook，也不产生任何 Case 结果。

正式状态计划只能接受 `mode=gitlab-api` 且 branch HEAD 前后稳定、first-parent
`commit_accounting` 闭合、全部 MR changes、current-release source contracts 和 blocking
risk 均独立验证通过的 intake。`fetch_latest=true` 的本地 Git 扫描只可用于诊断，不能
替代 GitLab API freshness；删除或弱化上述证明后即使重新计算报告内容 SHA，也必须拒绝。
GitLab changes 若标记 `renamed_file=true`，风险映射和源码合同必须同时保留并审计
`old_path` 与 `new_path`，禁止因新路径落入 docs/static 区而丢弃旧产品源码路径。

通过 current-release Files API 读取的每个受保护文件，`blob_id` 必须精确等于按
`sha1("blob <byte-length>\\0" + content-bytes)` 计算的 Git blob SHA-1；仅有合法 40 位
格式、size/ref/commit 匹配不足以通过。正式 Casebook 还必须是可读的普通非符号链接文件，
显式 Sheet 必须存在并导出至少一个唯一 Case ID，调用者声明 SHA-256 必须与磁盘字节一致。
文件、Sheet、导出、唯一性或 SHA 任一失败都令 intake `BLOCKED`，不得静默降级为空 Case 集。

`qbot-release-intake/1.5.0` 必须逐一核算 compare 的完整 first-parent 链，不得只筛选多父
merge commit。多父提交只能由 `merge_commit_sha` 全等的唯一 merged MR 归因；单父提交
只能由 `squash_commit_sha` 全等的唯一 merged MR 归因，并继续核对 target branch、state
和完整 changes。其余单父提交必须进入 `unattributed_direct_commits` 并 `BLOCKED`。报告
必须保留逐提交 `commit_accounting`，且 `first_parent_commit_count == accounted_commit_count ==
merge_commit_count + squash_mr_commit_count + unattributed_direct_commit_count`；验证器必须从
账本独立重算全部计数，即使攻击者重算报告内容 SHA 也不能放行不闭合的核算。
对带版本区间的阻断风险还必须分别请求“风险 merge → 当前 HEAD”和“当前 HEAD → 风险
merge”的 first-parent compare；后继架构切换点同样双向证明。只有反向链完整时才可判定
`VERIFIED_NOT_APPLICABLE`，正反向均不完整、API 错误或两边同时声称完整都必须保持
`UNKNOWN/BLOCKED`。

从 `qbot-release-intake/1.6.0` 起，intake 复核还必须按 first-parent 顺序逐条重放 MR
语义：MR IID/commit/parent/parent_count/merge 或 squash 归因必须与
`commit_accounting` 一一绑定，元数据必须来自 `gitlab-api-changes` 且保持
`state=merged`、目标分支正确。复核器必须用报告中冻结的 commit subject/body、source
branch、labels、changed paths 和 Casebook Case ID 重新计算每个 MR 的 impact、源码合同
触发集、全局直接 Case、依赖闭包、所需阶段、静态/未知计数和 unresolved 集合。删除、
换序或改写任一行后即使重算报告内容 SHA，也必须 `BLOCKED`。GitLab token 的传输目标固定
为 `https://gitlab.daikuan.qihoo.net` 的 `songrongxin/deepbankv2` API，必须保持 TLS
证书校验并限制为 HTTPS；禁止使用 `insecure/-k`、自定义主机或自定义项目承载正式 token。

MR !1559 后继架构的阻断风险证明固定使用
`qbot-qwork-release-blocking-risk-attestation/v3`。审计器必须先词法剔除注释、模板和正则
正文，并把普通字符串只作为真实调用参数/赋值值处理，禁止用注释或死字符串中的 token
放行。clean-exit 必须在 `onExit` 函数体内形成
`rejectPending(executionWorkerExitFailure(...))` 嵌套调用；pressure 必须从 acquisition
实现沿真实调用链到达 admission `if`，并在同一 supervisor factory 调用中固定
`maxPendingRequests: 1`、`maxRestarts: 0`；request set 与其 `release` 闭包的 delete/stop
必须属于同一 acquisition。desktop host 还必须在同一函数的同一个 `try/finally` 中获取并
释放同名 lease，入口必须是顶层真实 `require(...)`。旧 v2 证明或任一作用域/调用链断裂
均须重新扫描并 `BLOCKED`，不得靠重算报告 SHA 复用。

正式扫描默认必须成功刷新 `release-ref`。Git fetch 的只读凭据与 GitLab API token 是两条
独立链路：前者应由受管机器的短期只读 credential helper 提供，后者才通过本命令的 stdin
注入。`--no-fetch` 只允许用于诊断或已由外部可信观测证明 ref 新鲜的场景；不能把本地旧
remote-tracking ref 宣称为最新候选，fetch 认证失败时正式流程保持 `BLOCKED`。

扫描边界按以下优先级确定：

1. 上一次已接受 intake 的 release HEAD 到当前 HEAD；
2. 当前 Casebook 设计基线 commit 到当前 HEAD；
3. 只有在祖先关系无法证明、分支被重写或历史缺失时，才使用时间窗口兜底。

默认日常窗口为最近 24 小时，并与上一次扫描重叠 48 小时；每日回归至少回看 7 天；
发布候选优先使用完整 commit ancestry，不以固定天数替代；周期性完整审计使用最近 14 天
或 100 个 first-parent commit（取较大者）。祖先不可证明时自动扩大到最近 30 天，仍不能
确定边界则 `BLOCKED`。因此时间窗口是补偿机制，commit ancestry 才是权威边界。

扫描结果把 MR 映射为 feature/risk domain、直接 Case、共享依赖闭包和所需阶段。核心
门禁永远先于受影响 Case：任何产品行为变更至少要求 G1，随后才按映射解锁 G2/G3/G4。
静态 CI、Dashboard、eval、文档和工具链变更保留静态合同审计，不冒充桌面 E2E。未知
产品源码路径、未验证 MR 元数据、Casebook SHA/framework/release HEAD 不一致，均必须
在 Case 0 前阻断；扫描器不能以“可能已有覆盖”放行，也不能自行新增或删除 Case。
路径分类必须先匹配显式静态白名单，再匹配显式产品源码白名单；只有白名单内产品路径
可进入语义 Case 映射。陌生路径即使文件名、MR 标题、分支或标签含有 auth、runtime、
skill、automation 等已知关键词，也必须保留为未映射产品路径并 fail-closed。
已登记的 MR 源码合同属于同一 fail-closed intake，但鉴证分为两层且必须独立命名、计数：
每次正式 GitLab API 扫描都要为注册表中的全部合同生成 current-release 持续性鉴证，
从当前 release HEAD 重新读取受保护文件，并证明该 HEAD 对合同 origin merge 的完整祖先关系；
它只证明当前 release 仍保有声明的源码与测试声明，不能冒充本轮 MR changes 鉴证或测试执行结果。
只有目标 MR 位于本次增量范围时，才必须从本次只读 GitLab changes 原文重新生成并验证
`origin_change_attestation`；目标 MR 不在本次增量范围时该字段必须为空，不得凭空生成。
两层鉴证均不能复用 Casebook 文案、历史报告、本地 checkout 或桌面 E2E 结果。
current-release 持续性鉴证中的 integration binding 默认仍要求全文件
`occurrence_count == 1`。唯一例外是 MR !1540 的 `feature_check_body_absent_test` 与
`test_profile_report_exact_body`：两者必须携带不可变 owner scope，以精确的顶层
`test('...')` 声明作为唯一 start anchor，范围到下一个顶层 `test(` 或 EOF，不能用块内
任意 `});` 提前截断。owner 必须唯一，目标 binding 及同一 scope 中 URL、method、body
三个 required fragment 必须各精确出现一次；全文件可因后续测试复用而出现多次，但报告
必须同时保留全文件 `occurrence_count`、scope `owner_occurrence_count/occurrence_count` 和
逐 required fragment 的 `occurrence_count`。删除、移入错误 test、复制 owner block、缺少
URL/method/body 或对其它 binding 产生重复，均必须 `BLOCKED`。origin changes 鉴证继续
要求每条新增声明精确出现一次，forbidden fragment 在两层鉴证中都必须精确为 0。

路径分类采用显式白名单：`.gitlab/`、`scripts/`、`eval/`、`openspec/`、`schemas/`、
`deploy/`、`test*` 和目录内 `AGENTS.md`/`CLAUDE.md` 只进入静态合同；已知的
`server/qbot-core/`、`server/control-plane/`、`server/shared/`、`server/expert-definition/`、
`src/`、`electron/`、`assets/lib/ui/`、`resources/builtin-skills/`、数据库迁移和受管
runtime 目录按跨域产品影响映射到完整核心冒烟集合。任何不在这些静态或产品白名单中的
路径仍视为未映射产品路径并保持 `BLOCKED`，不能用 MR 标题或“已有覆盖”绕过。

MR/提交阶段可以运行同一模块的轻量 diff 扫描，快速给出推荐 Case 集合，但不产生发布
结论，也不能替代正式 G0。正式 runner 启动后冻结扫描报告和测试范围，不重新获取 MR，
只监控 release SHA、运行时身份、OTA 和 health；发现漂移立即冻结当前不可变批次。

正式 pretest 可通过 `--release-intake <release-intake.json>` 和
`--release-intake-sha256 <sha256>` 绑定报告；`--production-gate true` 默认要求该绑定。
正式 production-gate 中该门禁不可通过 `--require-release-intake false` 关闭，报告文件
SHA-256 必须显式提供且为 64 位有效值。pretest 必须再次强制
`mode=gitlab-api` freshness，并把报告中的规范 release ref、Casebook 绝对路径、精确 Sheet
以及有序 Case ID 列表与本次实际导出逐项全等比对；同一工作簿其它 Sheet、重排 Case、
仅有 `fetch_latest=true` 的本地 Git 报告或重算内容哈希后的替换报告均不得准入。
状态机 `init` 无条件要求并封印同一 intake 路径、文件 SHA 与内容身份，不能通过省略参数或
`--require-release-intake false` 关闭；同时必须显式接收独立的
`--expected-release-ref origin/release/0.1`、当前 40 位 `--expected-release-head` 和独立
`--expected-release-observation` 普通文件，不得用 intake 内的 ref/HEAD 对自身作比较。
计划中的 intake 绑定必须具有正确 schema、绝对路径、
文件 SHA、内容 SHA、固定 ref 和合法 HEAD，空对象或任一字段缺失都无效。每次 `readiness`
都必须从计划绑定路径重新读取磁盘报告，并强制接收、校验非空 64 位文件 SHA，再核对报告
内容哈希、release HEAD、Casebook SHA、framework commit 和 `READY` 决策；文件缺失、仅
重排 JSON、内容或 SHA 被替换、属于旧候选时均 fail-closed，且不得写事件或推进 revision。
