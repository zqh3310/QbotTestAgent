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
| 生产灰度发布 | `PRD/QBot生产灰度与全量功能回归Casebook_160条_2026-08-11.xlsx` | `生产灰度门禁Case` | 70 | `1621632773aa4d8c958bc97fea35311ef69cc5574704009616a223c058b0a3e4` |
| 全量正常功能回归 | `PRD/QBot生产灰度与全量功能回归Casebook_160条_2026-08-11.xlsx` | `全量功能回归Case` | 160 | `1621632773aa4d8c958bc97fea35311ef69cc5574704009616a223c058b0a3e4` |
| QWork 日常回归 | `PRD/QWork日常回归自动化Casebook_83条_2026-08-12.xlsx` | `日常回归` | 83 个顶层 / 144 个叶子 | `8a62aac20e5abad4dd09bed3717e9f0665cf7285d436f22da8a1bc03f8856111` |

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
`SIT-HOME-013`、`SIT-HOME-014` 五条高频正常功能补齐，160 条全量再以五条
正常功能增量保持总数不变。

Casebook、Sheet、Case ID 顺序或 SHA 发生变化时，视为新测试合同，必须重新审计并更新本文。
当前设计基线是 `origin/release/0.1@686b862ea9553215c2563d87db8339096acecb9d`，
产品版本 `0.1.1`；`/Users/qifu/Documents/deepbankV2` 始终只读。
Casebook 生成器只需用 `git cat-file -e <commit>^{commit}` 证明该冻结设计提交仍可读取；
不得要求持续演进的 `origin/release/0.1` 永远指向旧设计提交，也不得因此改写冻结合同。

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
     PRD/QBot生产灰度与全量功能回归Casebook_160条_2026-08-11.xlsx
   ```

4. 执行能力审计：

   ```bash
   npm run core-beta:capability-audit -- \
     --casebook PRD/QBot生产灰度与全量功能回归Casebook_160条_2026-08-11.xlsx \
     --sheet 生产灰度门禁Case \
     --out outputs/gate70-capability-audit

   npm run core-beta:capability-audit -- \
     --casebook PRD/QBot生产灰度与全量功能回归Casebook_160条_2026-08-11.xlsx \
     --sheet 全量功能回归Case \
     --out outputs/full160-capability-audit
   ```

   审计报告必须是 `qbot-core-beta-capability-audit/v2`，且同时满足
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
     --casebook PRD/QWork日常回归自动化Casebook_83条_2026-08-12.xlsx \
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
     --casebook PRD/QBot生产灰度与全量功能回归Casebook_160条_2026-08-11.xlsx \
     --sheet 生产灰度门禁Case \
     --profile mandatory \
     --lane teams \
     --out outputs/<new-immutable-pretest-dir> \
     --expected-count 70 \
     --expected-sha256 1621632773aa4d8c958bc97fea35311ef69cc5574704009616a223c058b0a3e4 \
     --expected-teams-version "<teams-version>" \
     --expected-teams-build "<teams-build>" \
     --expected-qwork-version "<qwork-version>" \
     --expected-control-plane-origin "<exact-control-plane-origin>" \
     --native-ime-command "<managed-native-ime-input-command>" \
     --production-gate true \
     --backend-version "<backend-release-id>" \
     --prompt-policy-version "<prompt-policy-id>" \
     --feature-flags-hash "<feature-flags-sha256>"
   ```

   完整 160 条回归使用同一命令，将 Sheet 改为 `全量功能回归Case`、
   `--expected-count` 改为 `160`，SHA 保持不变。70 与 160 必须分别得到精确
   `READY`，不能用一个 Sheet 的 pretest 替代另一个。

   QWork 日常回归同样传 `--production-gate true`，用于冻结 Teams/QWork/control
   plane/backend/prompt policy/feature flags 并启用严格证据门禁；但它不是 70/160
   生产灰度风险域 Casebook，不得套用八大生产风险域完整覆盖检查。该分类只允许
   精确有序的 83 个顶层 ID、前 70 个 `compound` 和后 13 个独立 Case；任何缺失、
   重排或结构漂移均恢复完整生产风险域检查并在 Case 0 前 fail-closed。日常回归
   `READY` 只授权本轮 83 条执行，不等于 70/160 生产灰度放行。

   `core-beta:pretest` 只读检查 Git 分支/提交/tracked dirty、预检入口及其不变量测试是否已被 Git 跟踪、Casebook、协议、双框架测试、唯一 runner、宿主/session/CDP、QWork 登录目标、发布身份和逐 Case fixture 合同。Teams lane 的 control plane 必须同时核对受管 session 与 QWork renderer 实际读取的 `DEEPBANK_SERVER/QBOT_SERVER_URL`；只看启动参数或 session 声明不能通过。它不启动/重启 360Teams、不打开 QWork、不发送消息，也不生成 synthetic Case。只有报告结论为 `READY` 才允许启动真实 runner。

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

CASEBOOK="$PWD/PRD/QBot生产灰度与全量功能回归Casebook_160条_2026-08-11.xlsx"
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
   CASEBOOK="$PWD/PRD/QBot生产灰度与全量功能回归Casebook_160条_2026-08-11.xlsx"
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
- `BETA-CHAT-008` 进入 completed 前必须通过专用强证据门禁：20 个 taskId 唯一，20 份确认发送回执与发送后截图完整，待回复池读回结构完整，20 条终态观察与截图完整，共享截止时间终态证据可用。产品 Oracle 失败可在上述证据完整时进入 completed 供 `trusted_bug` 复核；缺少任一批量证据时必须 `framework_issue` 并停止批次，即使通用 manifest 或 raw status 显示 passed 也不得继续。
- Skill/MCP/专家的创建、安装、授权、删除等生命周期变更，以及 HITL、重启、共享状态、故障注入、跨 Case 依赖和不满足精确 task ID 归属条件的多轮会话都是串行屏障。
- 非 Core Beta 旧协议不得同时启用单宿主 pipeline 和多 CDP `--parallel`；Core Beta v2 两者都会被强制降为有效值 `1`。
- pipeline 必须保存唯一 wave、task ID、能力绑定和 dispatch/collect 证据；重复 task ID 或跨 Case 取证立即视为框架异常。
- 多 CDP 并行执行的实时 `automation-progress.json` 与最终 summary 使用同一结果分区规则：`synthetic=true` 只能写入 `non_executed_diagnostics`，不得计入 `completed`、`results` 或状态计数。
- 历史 pipeline 回收结果进入 `completed` 前必须从调度包装项中解出原始 Case，并执行与串行路径完全相同的 manifest 完整性门禁；Core Beta v2 不得进入该路径。
- 结果分类优先级必须是 `automation_error` 高于 `blocked` 和 `bug`。顶层 `result_category` 之外还必须扫描失败的 step/assertion；只要其中存在 `category=automation_error`，后续前置阻塞、清理阻塞或产品断言都不得覆盖它。普通 prerequisite `blocked` 和 manifest 完整的产品 Bug 只记录结果并继续后续独立 Case；只有确认的 framework/testcase issue、manifest/取证不完整、身份漂移或运行宿主失效才停止当前批次进入自主修复闭环。
- 日常回归专项 JSON 证据必须使用 `evidence_valid` 表示取证结构、来源、Case
  绑定和文件完整性，使用 `oracle_valid` 表示产品行为是否符合预期。产品 Oracle
  失败时证据仍可为 `valid=true/evidence_valid=true/oracle_valid=false`，形成可信
  产品 Bug 并继续后续独立父 Case；不得把产品失败误升级为 framework stop。
  `QWD-EXPERT-002` 是只读专家目录/identity 审计，不要求虚假的能力选择或执行
  事件；`QWD-SEC-005` 是真实个人 LLM 连接、失败探针和脱敏审计，不要求虚假的
  会话轮次。通用类型校验不得覆盖具体 driver 的真实动作语义。
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
- Core Beta v2 进入系统设置前必须识别并关闭遮挡左下设置入口的终态 `skill-operation-feedback`，并确认提示已经消失；pending 提示没有安全关闭入口时必须有界等待或 fail-closed，禁止 `force` 点击遮挡层下方。设置导航必须同时兼容 QWork 0.0.29 的 `nav-settings-menu` 直达设置页和旧版 `nav-settings` 子菜单，且把 `assistant-config-view` 的加载态纳入同一有界等待合同。
- QWork 的 `[data-testid="runtime-update-ready-toast"]` 版本更新提示可能遮挡左下设置入口。每条 Case 开始和进入系统设置前都必须检查该提示；只允许在提示文案明确为“新版本已就绪/发现新版本”时真实点击精确的“稍后/跳过更新/暂不更新/以后再说”动作，保存前后截图和结构化账本并确认提示消失。禁止点击“立即更新”、使用 `force` 穿透遮挡或在运行中改变冻结发布身份；专用 toast 的按钮不匹配、点击失败、提示未消失或证据缺失时按 framework issue fail-closed。系统设置维护区中仅用通用 `[role="status"]` 展示“发现新版本，可点击立即更新”的内联版本状态不属于遮挡弹窗；只有同一 status 内真实存在精确安全的跳过按钮时才按弹窗处理，禁止因内联状态没有跳过按钮而追加 `automation_error`。
- 若前景“新建工作空间”模态框与底层版本更新提示同时存在，必须先在同一工作空间
  模态框内点击精确“取消/关闭”或明确关闭图标，等待模态框 hidden，并保存 before/after
  截图与结构化 ledger；之后才允许处理版本提示。该顺序适用于每条 Case 初始化和进入
  系统设置前；禁止 `force` 穿透、点击“确认”创建工作空间或点击“立即重启”。
- 通用 Case 收尾只统计真实可见的 `[role="dialog"]/.modal`。对阻塞清理的可见
  弹窗，只允许在同一弹窗内点击文案精确为“取消/关闭/跳过/稍后/以后再说”的
  安全动作，或明确的关闭图标，再等待弹窗消失；不得点击“确认/立即更新”等会改变
  产品数据或冻结发布身份的动作。`SIT-HOME-052` 必须按按钮文案精确匹配
  “打开本地工作空间/打开本地文件夹”，禁止使用 `.wspick-item.pick.first()`；若
  原生目录取消后残留“新建工作空间”弹窗，应点击其可见“取消/关闭”并留截图，
  不能让残留弹窗把已有产品结论覆盖成清理 `automation_error`。
- Core Beta v2 根 runner 和 360Teams 截图保护器的 Playwright 截图、fallback CDP session 创建、`Page.captureScreenshot` 和 session `detach` 清理必须分别受硬超时约束。截图已经成功固化时，清理期 `detach` 超时只能写入 runner 日志并继续返回截图，禁止让无界清理等待卡在 Case 0；截图本身超时或缺少有效图像数据仍按证据失败 fail-closed。
- `framework-stop-diagnostic.json` 必须传播到最终 summary：`status` 不得为 `passed`，`stopped=true`，并保留 `planned/completed/unexecuted`、停止原因与停止 Case。360Teams 包装器对 stopped、非 passed 或计划未完成的 summary 必须返回非零退出码，不能只看已完成结果中的 `failed/blocked` 计数。
- Core Beta 清理证据必须证明清理桥动作全部成功且技能、连接器、专家选择明确为空。优先使用 `agent.capabilities` 读回；Teams 中该 IPC 被超时保护器中止时，必须在不重复执行清理动作的前提下最多执行三次有界只读尝试，并把每次成功/错误写入 `capabilities_readback_attempts`。任一次读回得到权威空态即可继续；全部尝试失败且当前页面没有可见输入区时，框架必须通过受管 `openNewTask` 导航到干净 composer 表面，只重新采集可见状态和 E2E 状态，不得再次调用任一清理桥或把导航算作第四次 capabilities 尝试。此时允许组合使用首次精确为空的禁用桥回执、输入区无能力 chip、`__qbotE2E.state/currentSession` 的空专家身份和无专家头像作为独立交叉读回，并在 `cleanup_surface_recovery`、`pre_navigation_selection_readbacks` 和导航后截图中保存证据；旧版分离控件还必须明确显示“禁用”，新版统一“+”菜单必须有可见输入区。全部读回超时、恢复导航失败、只有动作返回值、缺少可见状态或任一来源仍有残留时必须保持 `cleanup_readback.valid=false`，不得把未知状态当作清理完成。
- 当前页面已经是可见统一“+”菜单 Composer 时，三次 `agent.capabilities` 只读均超时不触发导航。只有同一 Case 的发送前 `core_beta_composer_control_reset.isolation_readback` 已权威证明 Skill、Connector、Expert 全部为空，三个清理桥均成功，当前 Composer 可见且 Skill/Connector chip 与专家头像仍全部为空时，才允许以 `pre_cleanup_and_visible_ui` 作为清理交叉读回继续；任一发送前字段不可读、桥失败、可见残留或少于三次受管只读尝试仍须 fail-closed。
- 清理终态还必须有界读取公开 `agent.init()`，只保留当前 active/draft context 的最小能力字段并与 `__qbotE2E.state.activeId/isDraft` 精确绑定。当 `agent.capabilities` 超时且没有可用的发送前权威空态时，只有 `agent.init()` 对同一当前 context 明确返回 `skills/connectors/expert` 三者均为 `null` 或空数组、三个清理桥均成功、当前统一 Composer 可见且无 Skill/Connector chip 与专家头像，才允许以 `agent.init_context_and_visible_ui` 继续。`agent.init()` 超时、active/draft 绑定不一致、任一字段省略、任一可见残留或清理桥失败仍须 fail-closed；不得读取其他会话空态替代当前任务。
- 新版统一“+”菜单通过公共能力桥隔离 Case 前置技能或连接器状态时，优先使用 `agent.capabilities` 中 `selectedSkills`、`selectedConnectors` 或 `connectorRouting.mode` 的明确读回；若当前 QWork capabilities 省略对应字段，只有 `setSkillsDisabled()` 或 `setConnectorsDisabled()` 明确返回空数组才可确认禁用态。桥返回 `undefined`、`null`、非数组或调用失败都不得把未知状态判为禁用成功；自动态只接受 capabilities 或对应 `set*Auto()` 的明确 `null`。
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
- `BETA-SKILL-014` 每个不可变批次必须从 Case 目录派生唯一、合法的 `qa-meeting-minutes-<digest>` fixture slug，并把该精确名称写入每一轮真实 prompt；不得复用固定 `meeting-minutes`、覆盖已有用户 Skill，或把前序冻结批次的残留当成本轮产物。创建入口选择证据必须同时包含发送前 exact `skillhub:global/skill-creator-qwork`、每轮发送后的同一 taskId 快照、实际 prompts 和发送后终态。产品 QWork home 必须优先从当前冻结的 versioned `file://.../ui/<version>/index.html` 推导；Teams 为受管重启/控制面 fixture 注入的 `--qbot-home` 不能覆盖该产品 release home，只有非 file UI 无法推导时才允许回退。产物必须独立读回该产品 QWork home 下 `.claude/skills/<slug>/SKILL.md` 与 `.agents/skills/<slug>/SKILL.md`，校验普通文件、非符号链接、frontmatter name、`agent_created: true`、非空 description、字节数和一致 SHA；同时证明内部 creator 未混入普通市场库存。证据结构完整与业务 Oracle 必须分开：双投影缺失或产品未创建时，专项文件仍应 `valid=true/evidence_valid=true/oracle_valid=false` 并形成可继续批次的产品 Bug；只有路径/读回/task-bound 证据本身缺失才属于 framework issue。证据固化后，清理阶段只能删除基线中不存在且精确匹配本轮唯一 slug 的两个投影目录，以及 QWork home 内 Claude project memory 下文件名、正文均精确绑定该 slug 的新增非符号链接记忆文件，并保存 `skill-creator-fixture-cleanup.json`；任一预存、越界、符号链接、删除失败或残留都必须以 `automation_error` fail-closed。
- `BETA-EXPERT-001` 必须先通过真实【新建任务】进入 `taskId=null/messageCount=0` 的干净草稿，再按 `display.label` 搜索目标专家，执行一次 `recordRecent` 与 `setExpert`，发送 Casebook 冻结的确定性短提示并生成本 Case 自己的新 taskId。新 taskId 必须非空且不等于进入本 Case 前观察到的上游 taskId；expertId/versionId/releaseId 必须在选择读回、发送后任务、`setExpert` 回执和最近召唤中一致。`recordRecent` 与 `setExpert` 是一次性状态变更，必须与后续只读公开 `window.agent.capabilities()` 分离；`expertLifecycle` 只承载专家目录/草稿生命周期方法，不得假设或调用 `expertLifecycle.capabilities()`。Teams IPC 首次超时时，只允许对 capabilities 最多执行三次有界重试并保存逐次账本；不得重复召唤、重复写最近列表或重复设置专家。首次失败后恢复成功必须继续完成当前 Case；三次读回均失败且没有独立公开状态可验证精确专家 identity 时，才按 framework issue fail-closed。发布记录读回必须始终写 `valid=true/evidence_valid=true` 表示结构化取证完成，并用 `oracle_valid` 表示可见ID/计数是否严格等于 `owned=true` 集合；产品列表为空或计数错误属于证据完整的产品 Bug，不得把 `product_state_diff` 标成 manifest invalid。
- `BETA-EXPERT-002/003` 必须把 Expert Builder 业务 Oracle 与证据有效性分开。产品没有创建本轮 owner-isolated ExpertDraft、复用历史草稿/历史 staged Skill、没有调用所需 authoring tool 或只在回复中声称完成时，仍须保存绑定当前 task 的 baseline/after draft inventory、复用 identity、完整 reply records、tool trace、dependency/content/path 负向读回；这些专项文件必须为 `valid=true/evidence_valid=true/oracle_valid=false`，Case 记产品 Bug并继续后续独立 Case。只有 baseline/after inventory、当前 task 绑定、回复终态或结构化 tool trace 本身缺失/越界时，才允许令证据无效并按 framework issue fail-closed。产品失败不得通过 `valid=false` 或提前 return 造成 `expert_draft_lifecycle`、`expert_dependency_graph`、`artifact_path_sha256`、`content_readback` manifest 缺失。
- `BETA-EXPERT-003` 切换 Codex runtime 时，若产品桥精确返回“没有匹配协议的 LLM connection”，框架必须在调用 `setExpert` 和发送前捕获公开 connection view、错误码/文案、前后任务/runtime/专家/草稿快照及截图。只有目标 Codex connection 确实不存在、任务未创建消息、send count 未变化、runtime/专家/草稿均未变更时，才能生成 `qbot-core-beta-runtime-prerequisite/v1` 并记为普通 `blocked`；本 Case 不可能产生的 Expert Builder、能力选择/执行和 task/prompt/reply 角色可由该文件显式标为 `not_applicable`，manifest 仍须完整并继续后续独立 Case。未知错误、connection view 缺失、已发生发送/专家选择/草稿变化或 blocker 文件校验失败一律保持 `automation_error` 并进入框架自愈闭环。
- `BETA-EXPERT-007` 只能发布本轮 suite ledger 中由 `BETA-EXPERT-002/003/004` 写入的 `claude-code_draft/codex_draft/manual_draft`。任一上游 Case 未产生对应账本键时，框架必须先建立空任务零能力状态，忽略账号内全部历史草稿，生成与当前 Case、三条上游来源和缺失键精确绑定的 `qbot-core-beta-expert-prerequisite/v1` blocker；`expert_publish_operation`、`restart_trace`、`credential_redaction_scan` 和能力选择/执行角色可受校验地标为 N/A，action receipt、公开状态和 cleanup 仍须真实完整，Case 记可信 `blocked` 并继续。账本键存在但 draftId/etag 残缺、空态读回失败、blocker 身份/路径/缺失键漂移或 N/A 越权仍属于 `automation_error`，必须冻结并进入自愈闭环；禁止直接抛异常、复用历史草稿或只补 synthetic 结果。
- `BETA-EXPERT-008~016` 中依赖已发布专家的 Case 必须使用本轮 suite ledger 中按上游 Case 写入的精确 expertId/releaseId/versionId，并与 live expert inventory 三字段完全一致。账本键缺失时必须忽略账号内所有其他 active expert，建立空任务零能力状态，生成 `qbot-core-beta-expert-prerequisite/v1` 可信 blocked 并继续；本轮身份存在但产品目录不可见时形成证据完整的产品 Bug 并继续；账本身份字段残缺、空态读回失败、blocker 越出当前 Case 目录或 N/A 角色越权时属于 `automation_error` 并冻结自愈。禁止 `activeReleaseId` 任意 fallback。
- `BETA-MCP-001` 必须以当前 connector catalog 的 `statusKind=ready`、`usable=true` 以及有效工具开关为权威可用状态，同时兼容独立 health probe 的 `healthy/ready` 终态；`skipped/stdio_not_probed` 不能覆盖 catalog 已接入状态。只读工具判定必须排除 create/update/delete/send/write 等破坏性动作，即使其错误携带只读 hint 也不得放行，并按冻结的 backend、prompt policy、feature flags 和 QWork 构建身份计算选择种子，依次从文档、搜索、数据、协作、可视化五类确定性选择唯一 key。若真实目录缺少任一分类或可用样本不足 5 个，框架必须建立与当前 Case 精确绑定的结构化空任务零能力读回，生成 `qbot-core-beta-mcp-prerequisite/v1` 可信 blocked；`BETA-MCP-002~008` 必须从同一 suite ledger 验证并传播该 blocker，将未发生的 task/prompt/reply/能力执行及故障诊断角色显式标记 N/A 后继续后续独立 Case。禁止直接抛异常、随机换用其他 connector、把目录短缺写成 manifest 缺失，或让 prerequisite `blocked` 覆盖已经发生的 `automation_error`。
- MCP 目录 bridge 成功返回可解析结构但 `items=[]` 时，空目录本身是完整的产品负向读回，不是证据缺失：`capability_inventory` 必须写为 `valid=true/evidence_valid=true/oracle_valid=false`，并由上述 prerequisite 形成可信 blocked 后继续。证据有效性只能由固定 bridge 来源、原始目录结构、显式读取错误和规范化 `items` 数组判定，禁止再使用 `items.length > 0`。bridge 超时/异常、原始目录不可解析或 `items` 非数组时仍须写为证据无效并按 framework issue 硬停止。
- Agent 澄清/推荐选项仍按统一策略自动点击精确“跳过/跳过（用默认）/关闭并使用默认答案”并保存前后证据。因此正式 Casebook 的测试数据和首轮 prompt 必须自包含且确定，不得保留“目标问题”“给定问题”等占位语句，也不得依赖运行时澄清来补齐主题、时间点或业务 Oracle。`BETA-EXPERT-008` 必须冻结 as-of 日期、具体研究主题和至少两个官方来源要求。
- framework/testcase issue 若使批次在 `BETA-SKILL-003/004` 安装后、`BETA-SKILL-012` 清理前中止，后续初始化不得忽略遗留 Skill，也不得人工或用临时 CDP 脚本卸载。先永久冻结源批次，再在同一发布身份、同一 Casebook 和同一 Teams 输出根的新目录中单独执行 `BETA-SKILL-001`，并传入 `--core-beta-cleanup-from <frozen-source-out>`。框架只允许导入源批次的 `core-beta-suite-ledger.json`，且必须验证 003/004 为真实 executed 且 manifest 完整、10 个 qualified identity 唯一、与安装前基线无重叠、安装尝试账本完整、Casebook SHA 和宿主/QWork/control plane/release inputs/产物指纹完全一致；验证结果、源账本 SHA、源 progress SHA 和目标 identity 必须写入 `core-beta-run-owned-skill-cleanup-source.json`。任何漂移或缺失都 fail-closed。若产品在清理前已升级且旧发布无法精确恢复，只允许显式增加 `--core-beta-cleanup-release-migration true`；该例外仍要求同一 360Teams 产品和 App 路径、同一 live profile alias、同一 control plane、同一 QWork release root、QWork version 与 versioned file URL 精确绑定、同一模型档位、Casebook SHA 不变且新旧制品 SHA 完整，并在 v2 清理来源记录中同时保存新旧身份哈希、差异字段和逐项门禁结果。未显式授权或任一安全检查失败时继续 fail-closed；跨发布清理只移除旧冻结账本中精确记录的 QA identity，不能继承任何旧 Case 结果。清理 Case 必须逐项仅移除当前仍存在的目标 identity；调用产品 `uninstallSkill(name)` 时必须传入与真实 UI 相同的非空字符串 name，禁止传入 catalog 对象，并保存 identity、request name 和 API 收据的一一对应账本。API `ok=true` 只表示动作收据，不能单独证明清理成功；框架必须在最长 `60000ms` 的有界窗口内轮询真实 `catalog.installed`，要求全部目标 `remaining=0` 且至少连续 2 次读回缺席，同时证明无基线 Skill 变化，才可令 `cleanup_verdict.valid=true` 并生成完整 manifest。若一次完整轮询后仍有目标存在，框架只可对该轮权威读回仍存在的同一批 run-owned identity 再执行有界幂等卸载，最多 3 轮；每轮都必须保留精确 identity/name、API 回执和完整缺席轮询账本，禁止扩展到基线或其他 Skill。若精确卸载调用只返回已知的 `control-plane request timed out`，不得在 API 回执处提前抛错；只有请求 identity/name 一一对应、该 identity 已纳入同一次有界轮询、全部目标连续至少 2 次权威缺席且基线 Skill 完全未变时，才允许把该歧义超时记录为 `terminal_reconciled=true` 并计入有效清理。3 轮后目标仍存在、读回不足、identity 不匹配、权限/业务错误或其他非超时错误一律不得对账，继续以 `automation_error` fail-closed。清理成功后仍须新 pretest、新不可变目录和完整 selected scope 重跑，清理批次本身不能计入门禁结果。
- 受管 360Teams WebView 在刷新验证时可能销毁当前 CDP target。执行刷新并重开任务的 Case 必须识别 closed target 或 execution context destroyed，重建受管 CDP 连接、接管 replacement QWork renderer、更新共享 page 并保存重连账本；不得把预期的 renderer replacement 直接落成不完整 manifest。
- replacement renderer 或受管宿主恢复必须始终以本轮首次连接后冻结并写入 `run-metadata.json` 的 QWork versioned file URL 为唯一 pin。Teams profile、刷新后临时 renderer 或宿主内置 manifest 中出现的旧 URL 只能作为漂移观测，不能覆盖冻结身份。Case 内的 renderer refresh/reload 必须先在上游 CDP 有界等待同一 pinned QWork WebView 自行 remount，再重建代理并以禁用宿主恢复的方式接管 replacement renderer；不得因为 WebView 短暂消失就停止或重启整个 360Teams。remount 超时必须保留 automation error 并进入自愈闭环，禁止用隐式宿主重启改变 Case 动作语义。
- 360Teams 适配层只可在首批 Case 开始前的 preconnect 周期执行一次受管宿主恢复，并在恢复后获得一个最长 `60000ms` 的有界验证窗口。历史合同中的显式 managed-host restart 完成后，重连 hook 只能接管已经由该 Case 动作启动的新宿主，不得再追加一次恢复；接管成功前必须重新校验 Teams/QWork/control plane 与全部发布 artifact，并把新 PID 追加到 `run-metadata.json.observed_host_pids`。当前 70/160 不包含宿主重启 Case，因此 Case 执行阶段出现未声明 PID 变化属于 framework issue。
- 模型无回复属于产品失败，不等于证据缺失。允许两种失败终态：一是完整等待窗口耗尽（`terminal_outcome=timed_out`，`waited_ms >= timeout_ms >= 60000`）；二是确认发送且真实进入运行态后已经停止、等待至少 `60000ms`、连续至少 3 次稳定采样仍无可归属助手正文（`terminal_outcome=no_reply`）。两者都必须保存明确 terminal reason、任务绑定、发送回执、终态截图及其 SHA-256，`reply_completion` 才可标记为“失败终态证据完整”；其产品完成状态仍必须为 `complete=false`，Case 仍判失败/bug，禁止借此形成 pass。写入 `no_reply` 前必须重新采集一次仅限当前 `assistant-thread` 的结构化消息时间线，同时精确绑定当前 taskId 和本轮 prompt；分支/追问消息即使不位于首个 `message-list` 包装下也必须被采集。终态复核已存在任何非空的 prompt 绑定助手正文时必须返回真实回复，短回复不受通用整页差分长度门槛限制；缺 taskId、缺 prompt 绑定或任务漂移必须 fail-closed，禁止归类产品 `no_reply`。没有“曾进入运行态”证据时也不得把排队任务提前判为 `no_reply`。
- 停止生成 Case 必须先绑定当前 task，并同时观察到 `running=true`、停止入口可见和非空助手正文增量后才能点击停止。正文必须通过独立正文节点读取，明确排除 reasoning/思考摘要、chain-of-thought、处理中状态和工具区域；即使这些区域已有较长可见文本，只要正文仍为空就禁止点击停止。停止前必须保存 `partial-reply-precondition-readback.json` 和可见片段截图；停止后必须保存 `stop-generation-readback.json`，证明原 task 已结束运行、`partial_chars_before_click>0` 且 `retained_chars>0`。前置不成立时框架禁止点击停止，不得把“还没生成任何正文”误报为产品丢失部分内容。若已确认发送、绑定 task、观察到运行态和停止入口，但完整 `90000ms` 窗口内正文仍为空，必须保存包含 `timeout` 的终态截图并以 `terminal_outcome=timed_out` 写齐 prompt、send receipt、transcript、reply delta 和 reply completion，将其判为证据完整的产品失败；少于 `60000ms`、缺少 task、确认发送回执或终态截图时仍须 fail-closed。失败证据落盘后可调用受管超时清理停止残留运行态，但清理点击必须明确标记 `cleanup_click_is_case_action=false`，不得冒充本 Case 的停止操作；清理失败才升级为 `automation_error`。停止后追问必须使用当前 task 上下文的确定性 Oracle，不得用通用分词相关性将合理说明误报为产品 Bug。
- 用户真实点击停止后的终态必须以 `terminal_outcome=user_stopped` 材料化全部标准会话角色：`prompt`、`send_receipt`、`transcript`、`reply_delta`、`reply_completion`。`reply_completion.complete` 必须为 `false`，`terminal_failure` 必须为 `false`。只有确认发送 prompt SHA、停止前后 taskId、`running=true -> false`、停止点击、停止前非空 partial、停止后 retained 读回（允许为 0 以记录产品丢失）以及前后截图 SHA 全部精确闭环时，`evidence_complete` 才可为 `true`；`partial_preserved` 与 `retained_chars` 单独承载产品 Oracle，丢失时必须判产品 Bug，但不能把证据完整的产品失败升级成 manifest 缺失。禁止把用户停止伪装成普通 `completed`，也禁止因这一受支持的非 completed 终态造成框架硬停止。
- 串行与 single-host pipeline 的每次回复轮询都必须识别 Agent 澄清/推荐选项面板。仅当页面存在精确的“跳过”“跳过（用默认）”或“关闭并使用默认答案”入口，且同一 surface 具有问句或标准 dialog/多选项结构时，runner 才可逐页点击默认跳过；每次处理必须保存问题、选项、动作、前后截图和 `assistant_confirmation_interactions` 账本，然后继续等待同一 task ID 的回复。不得因问句文案变化漏处理，也不得把普通产品向导的“跳过”误点为 Agent 答案。
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
- `BETA-ART-001` 的“交互式 HTML”允许无远程资源的内联脚本；安全性不能用“文件中完全没有 `<script>`”替代。runner 必须在成果区同时看到并逐项打开 Markdown 与 HTML，确认 Markdown 源码包含 A=12、B=8；HTML 必须进入当前 QWork 受管网页预览、内容可见、分享按钮 enabled、分享对话框无错误，同时不得在宿主 DOM 留下执行标记或非白名单弹窗。旧源码查看器只能作为补充安全证据：若存在，脚本文本可见但查看器内不得创建真实 `script`/`iframe` DOM；它不能替代网页预览或分享 Oracle。任一成果只存在于工作区而未进入当前任务成果区、网页预览/分享不可用，或 HTML 污染宿主，均为产品失败；证据完整时不得升级成框架问题。
- `BETA-ART-001` 的网页预览只有在 iframe 正文或已解码快照真实可见、全部 loading 状态消失且没有预览错误时才算内容完成；`web-preview-loading`、刷新状态或只有空 iframe 不能通过。分享动作必须等待分享对话框进入 ready 并读回非空分享 URL；只看到 sharing 对话框不得通过。
- `BETA-TASK-008` 的干净“新建任务”属于草稿态，权威状态必须是 `activeId=null`、`isDraft=true`、`messageCount=0` 和非空 `draftInstanceId`；不得要求框架伪造第二个 taskId。空闲 Composer 的第一次物理 `ArrowUp` 只建立外边界握手且输入不得变化，第二次物理 `ArrowUp` 才进入历史；新草稿和重开原任务都必须按同一两阶段握手复核。隔离 Oracle 仍必须证明新草稿两次 `ArrowUp` 都为空，并能按原 taskId 重开旧任务后在第二次 `ArrowUp` 回放最新输入。
- `BETA-ROUTE-001` 的期望模型集合必须复刻当前产品菜单策略：以当前任务 `runtimeFamily` 为准；桌面 Auto 或 `manual_override_auto` 状态且 `manualModelOptions` 非空时优先使用该集合，否则使用 `runtimeOptions.options`，再按 disabled、runtime family、Claude Code=anthropic、Codex=response 和 M1-M4 过滤。DOM 读回必须从 `composer-safety-level-option-<tier>-<modelId>` 和所属 `data-tier` 分组还原同一多重集合。
- `BETA-ART-004` 必须从真实 PPTX slide XML 与 PDF 文本页读回执行业务 Oracle，不能用“PPTX 可解压、PDF 至少一页”代替。两者都必须恰好五页且无空白页；PPTX 五个页标题必须逐项出现在 PDF；两种格式都必须命中曝光 1000、点击 100、转化 20；PPTX 至少一页必须同时承载三项指标和足够的可见绘图 shape，证明漏斗图表实际存在。PDF 文本优先使用 `pdftotext`，不可用时使用 PyMuPDF 结构化逐页提取；两个适配器都不可用时不得判产品通过。对应回复还必须同时命中 PPTX、PDF、五页和三项固定指标，并由专用 Case Oracle 先于通用相关性判断。
- 通用回复相关性只用于拦截明显答非所问，不能替代 Case 的确定性业务 Oracle。确定性主题/结果规则必须先于通用文本长度门槛执行，使“项目代号是 Orion。”等完整短答案能够通过，同时保留未命中业务结果的短文本反例。中文长提示不得依赖整句 token 精确重合；漏斗数字、活动方案、ROI、PDF 结论页码、CSV/XLSX 差异与总计等核心任务必须以“主题词 + 业务结果词”联合校验，并同时保留无关回复反例。成果回复若重复了请求中的精确文件名并明确说明已生成/写入，应视为主题相关；`BETA-ART-003` 必须同时命中 XLSX/Excel、CSV 以及 `SUM`/合计/总计 Oracle，不得因长中文 prompt 分词失败而误报产品 Bug，也不得放行仅生成其中一个文件的回复。Core Beta v2 的 `conversation_turns` 若未显式填写 `turn`，必须按数组顺序生成稳定的 `第1轮`、`第2轮` 标签，证据文件、动作回执和断言中不得出现 `undefined`。`BETA-FILE-001` 必须校验三条第 1 页结论及 PDF 已知锚点；页码既可逐条标注，也可用“三条结论均位于第 1 页”或“第 1 页包含以下三条结论”等无歧义范围语句统一绑定，但否定绑定、页码分散或只有页码没有已知锚点仍必须失败。`BETA-FILE-004` 必须使用专用 `qbot-data-table-diff.xlsx`，校验三处数值差异和双方总计，不能复用数值完全相同的通用表格。双方总计必须与各自 CSV/XLSX 文件标签、对应表格行，或先与文件唯一绑定再用于总计行的无歧义字母/数字表别名（如 `表 A/表 B`、`表1/表2`）关联；独立的 `总计/合计` 表头可以约束其后连续的文件标识数据行，且每行仍须按本行 CSV/XLSX 身份核对对应总计，不能只约束第一条数据行。行首 `总计/合计` 可以同时约束同一行的多个已绑定别名，但每个别名只允许读取到下一个表别名前的独立数值区间，防止交换总计误通过。允许表格列和求和算式等真实表达，但不得依赖跨段固定字符窗口，也不得用正文中散落的 `182/215` 形成通过。固定 `100/70/12` 的四轮数字记忆脚本只能由精确 Case ID `SIT-HOME-016` 使用，不得按“业务数字追问”等场景词误路由 Core Beta Case。该 Case 的首轮要求 `100/70/12`，报名追问只要求正确的 `100 人`，到场追问要求 `70 人 + 70%`，成交追问要求 `12 单 + 约 17.1%`；后续轮不得继续要求首轮全部数字或其他轮比例，数字或比例错配仍必须失败。若确定性 Oracle 已满足而通用相关性单独失败，必须按框架/Casebook 误判处理，不得上报为产品 Bug。
- 登录测试点回复的通用相关性必须采用双锚点：请求明确包含登录测试，回复同时命中账号/密码/验证码/凭证/会话等登录主题和测试/验证/流程/异常/安全等结果词。正常登录链路、错误凭证和退出后 token/session/cookie 失效等真实答案不得误判为不相关；无关天气回复仍必须失败。该通用判断不替代 `SIT-TASK-EDIT-001` 对历史消息编辑入口和编辑后分支状态的产品 Oracle。
- `SIT-HOME-062` 的边界 Oracle 必须把“无法/不能计算”和“算不出/算不了/得不出 ROI”等中文等价表达识别为明确的数据不足说明；输入 Oracle 必须把“成本/总投入/投入金额”识别为成本侧，把“收益/收入/总回报/成交金额/成交总额/成交额/成交单数与客单价”识别为回报侧；公式必须在同一 ROI 表达式中保持 `(回报-投入)/投入` 的操作数顺序，并兼容全角括号、普通或 Unicode 减号、`/` 或 `÷`，以及“ROI 公式是 ROI = ...”等无害重复前缀。由“比如/例如/示例”或明确条件句引出的金额只作为计算示例，不得误判成产品编造；“先假设某金额”等替用户代填的未提供值仍须失败。回复实际借用旧任务的报名/到场数字、渠道或“上一组活动”等事实必须失败，但“不会/不得/拒绝使用上次数据”等否定性边界说明不得误报为借用。缺任一输入侧、缺公式、公式顺序错误、编造金额或跨任务事实泄漏均不得因正文散落出现同义词而通过。
- `SIT-HOME-062` 的公式操作数允许产品直接使用裸词“投入”，例如 `ROI =（收入 − 投入）÷ 投入`；该兼容不得放行 `(投入-收入)/投入` 等操作数顺序错误。
- `BETA-FILE-001` 的正文先声明“三条关键结论如下”，紧接着以独立行 `第 1 页` 或 `第 1 页（全文仅 1 页）` 作为后续列表的范围标题时，属于无歧义统一页码绑定。该页码标题必须紧跟结论引导语且整行不得含否定文案；否定标题、分散页码或只有页码没有已知 fixture 锚点仍必须失败。
- 当任务明确要求附件/文件的“文件名和大小”时，通用相关性必须认可同时包含带扩展名文件名与带数值单位大小的回复，即使 prompt 没有预先写出运行时附件名。该规则必须同时保留缺少文件名、缺少大小和无关回复的负例，不能放宽为任意附件回复通过；`BETA-FILE-007` 的合法恢复分支还必须继续满足专用附件读回 Oracle。
- `BETA-FILE-001` 的结构化表格若有明确“页码/Page”列，三条独立结论分别标注 `P1`、`Page 1` 或 `第 1 页`，也属于逐条页码绑定；少于三条或任一结论标到其它页仍必须失败。fixture 身份既可由正文标题 `QBot PDF Summary` 证明，也可由精确冻结文件名 `qbot-pdf-summary.pdf` 证明，但后者必须同时命中 Agent 读取目标、摘要、风险和产品友好四组内容锚点；Agent 读取目标允许“Agent 读取 PDF”与“Agent 的 PDF 读取能力”等等价词序，只回显文件名或页码不得通过。Agent 先记录某个附件适配器失败、随后明确完成 fallback 解析并给出正确 fixture 内容时，不得用跨句宽松正则把“改用附件工具…附件引用”拼接成“未收到附件”；只有连贯、明确的未读取/未收到/需重传终态才可触发附件丢失 Oracle。
- `BETA-FILE-004` 的行首 `总计/合计` 可以同时约束同一行的多个直接 CSV/XLSX 文件标签或已绑定表别名。表别名允许字母、阿拉伯数字或中文数字，例如 `表 A/表 B`、`表1/表2` 和 `表格一/表格二`，但必须先与唯一文件身份绑定。解析器必须把每个身份的数值区间截断在下一个文件标签或表别名前，分别核对 182/215；不得读取到行尾并把后一个文件的总计错配给前一个，也不得放行双方总计交换的反例。
- `BETA-FILE-004` 还必须识别制表符或 Markdown pipe 结构化表格中的列身份：当表头用不同列明确绑定 CSV 与 XLSX/Excel，后续 `总计/合计` 行可以沿用同一列位置而不重复文件名。解析器必须逐列核对 182/215，并保留交换两列总计必失败的 invariant；禁止脱离表头列映射，仅因总计行散落出现两个数字而通过。
- `BETA-FILE-004` 的文件行若受 `表格\t合计` 等结构化表头约束，合计单元格可以先展示权威总计、再在同一单元格用括号列出验算因子，例如 `qbot-table.csv\t182（100 + 70 + 12）`。解析器必须按表头定位合计单元格并核对展示总计，不能把括号内最后一个因子 `12` 误当总计；双方展示总计交换时仍必须失败。
- `BETA-FILE-004` 的结论段可以用 `表格 B（xlsx）高于表格 A（csv）` 等短文件身份重述已绑定别名。解析器必须在下一个表别名提及时截断身份片段，不能把后一个表的 CSV/XLSX 身份吞进前一个别名并污染已正确绑定的双方总计；别名绑定歧义或双方总计交换仍必须失败。
- `BETA-FILE-008` 的剪贴板入口必须区分“事件派发成功”和 DOM `dispatchEvent()` 的返回值：产品 paste handler 调用 `preventDefault()` 时返回 `false`，只要派发调用本身成功且 Composer 附件数与精确文件名发生预期变化，就属于已派发并被产品接收。`BETA-FILE-008/009` 的入口、预览、删除或去重 Oracle 失败属于产品负向结果；只要动作回执和 Composer 快照结构完整且后续操作安全，场景必须继续发送并固化 prompt、taskId、send receipt、transcript、reply delta/completion 及附件读回，不得在产品断言后提前返回。附件专项 artifact 的 `valid/evidence_valid` 只表示证据结构有效，产品是否符合 Oracle 必须单独写入 `oracle_valid`；不得用 `valid=false` 把证据完整的产品 Bug 升级成 framework stop。
- `QWD-ENTRY-002` 在建立任务 A 前准备 Skill/Connector 显式选择表面并各点击一个稳定 identity；任一旧版 manual 控件或新版具体能力控件已定位且点击已派发、但产品状态未生效时，`resetComposerControls` 必须保留失败交互，具体能力选择阶段则直接保留当前交互，不得被后续动作覆盖。若截图、空任务、零消息、发送计数不变和对应能力空选择均完整，runner 必须物化发送前产品失败 blocker，把未发生的 task/prompt/send/transcript/reply/capability execution 角色标为受校验 N/A，并为 `qwork_daily_readback`、`composer_attachment_state`、`data_integrity_readback` 写入 `evidence_valid=true/oracle_valid=false` 的负向证据。manifest 必须完整、结果保持 `bug` 并继续后续独立父 Case；失败交互、零发送读回或截图任一缺失仍是 `automation_error`。
- `BETA-PERF-003`、`SIT-ISSUE-793` 等 #793 长文本滚动场景除原始 `thread-scroll-samples.json` 外，必须生成并注册 `performance_metrics` 角色。正式性能证据使用 `qbot-core-beta-performance-metrics/v1`，绑定 Case ID、有效样本数、生成态样本数、观察时长、滚动距离/高度、漂移判定、同 Case 目录内的原始样本绝对路径与 SHA-256。缺文件、空壳 JSON、样本越界、SHA 不一致或样本数不一致均属于 framework issue，必须硬停止并按新不可变目录全量重跑；产品滚动 Oracle 失败但上述证据完整时仍归类产品 Bug，并继续后续独立父 Case。
- Core Beta 叶子复用 legacy driver 时，driver 分流身份只用于选择执行逻辑；所有专项证据、manifest 和 SHA 归属必须使用原始 Core Beta 叶子合同 ID。禁止把 `SIT-*` legacy 身份写入 `BETA-*` 叶子的 Case 绑定字段，或反向跨 Case 复用证据。
- 当前 70 条全量执行必须先按固定顺序执行 `BETA-INIT-001` 至 `BETA-INIT-004`。`BETA-INIT-005` 是已删除的历史 connection-cache/network-fault 注入场景，不得拼回当前发布门禁。初始化失败始终使本轮发布门禁为 NO-GO，但“发布阻断”与“执行停止”必须分离：任一初始化 `automation_error`、仍处于 pending、或运行时/SDK/工作台/输入区/按钮/capabilities/页面读回任一不可用时必须停止；`BETA-INIT-001` 至 `BETA-INIT-004` 若留下 manifest 完整的可信产品 Bug，且上述公开可用性信号全部明确恢复，可以继续收集后续独立 Case 证据。系统设置页可能完整遮住 composer，维护终态采样中的 `composer_ready=false` 不能单独证明输入区失效；仅在明确产品失败后，框架必须通过真实【新建任务】入口返回干净草稿，保存前后截图、空任务隔离和公开状态读回，并以该恢复表面的可见 composer 作为独立信号。入口、干净草稿、截图或公开读回任一失败仍须停止，禁止只凭 capabilities 推断输入区可用。降级继续必须在 Case 结果中保存 `initialization_continuation` 和 `initialization-continuation-surface.json`，并明确 `release_gate_eligible=false`；后续通过不得覆盖或稀释初始化 Bug。
- Core Beta v2 的 `BETA-INIT-001` 至 `BETA-INIT-004` 必须从系统设置点击真实维护按钮；全量重初始化、Skill 重装和清空会话必须捕获与动作匹配的确认弹窗，禁止以直接调用 preload bridge 代替用户操作。
- `BETA-INIT-004` 点击清空前必须通过公开 `listSessions/getRunning` 枚举全部会话，只对真实 `running=true` 的会话调用按 ID 取消，并连续至少 3 次读回全部 idle；枚举、取消、稳定读回和前后截图必须写入独立不可变账本。若第一次真实 UI 清空明确返回 `active-session`，只能再次执行相同 idle 对账后重试一次真实 UI 清空，重试仍须重新捕获确认弹窗并使用不覆盖首次证据的截图；不得直接调用 `sessionsPurgeAllEnvs` 绕过 UI，不得盲等完整 Case 超时，也不得无限重试。清单不可读、取消失败或重试后仍被拒绝均为 `automation_error`，触发框架自愈与新目录全量重跑。
- 初始化动作必须证明本次点击引起了状态转换。优先取证按钮 busy/disabled 或维护区处理中状态；若动作短于轮询采样窗口，只有“动作前不存在、动作后新增、且与当前按钮精确匹配”的完成回执，加上确认弹窗和连续稳定终态，才可替代 transient busy。产品成功契约明确会刷新 renderer 的维护动作（当前仅清空全部会话），允许把确认动作后发生的主框架刷新作为因果动作信号，但仍必须同时满足匹配确认弹窗和刷新后的连续稳定终态；其他导航不得复用。陈旧完成文案不得复用。
- `BETA-INIT-001` 必须点击当前发布界面实际显示的“立即检查运行时”入口（当前 `assistant-prepare-python-runtimes`）；只有发布界面明确提供旧“检查更新运行时”入口时才兼容 `assistant-runtime-update-check`，不得因 testid 演进把可见入口误判为缺失。
- `BETA-INIT-001` 至 `BETA-INIT-004` 本身不发送模型请求，不能被全局模型档位门禁挡在初始化之前，可信复核也不得因这四条没有 `model_tier_before_send` 而判为框架问题。若启动时连接视图尚未恢复，runner 只可把模型检查延后到真实初始化之后；首个需要模型的 Case 及其每次发送前仍必须读取连接视图并精确锁定请求档位，无可用档位时禁止发送。
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

manifest 缺失、`complete=false`、`missing_roles` 非空、SHA 不一致、Case 目录越界或 synthetic 结果进入 completed，全部属于框架异常。
产品动作失败本身不等于证据不完整：结构完整、包含 before/after 或明确 terminal 终态截图的 failed/blocked action receipt 仍是有效证据，最终业务结论可以是 `trusted_bug` 或 `trusted_blocked`。可信复核必须把 `category=bug` 且已保存用户可见失败终态的动作视为已执行，不得仅因步骤 `status=failed` 或失败证据正文包含普通“自动化”文字而改判为框架问题。runner 只能把 manifest 完整的真实执行结果计入 `completed`；发现 synthetic、manifest 缺失/结构异常/不完整、角色无效或 SHA 缺失时，必须写 `framework-stop-diagnostic.json` 并停止，后续 Case 保持未执行，禁止批量补 synthetic blocked。
Case 0、预检或顶层异常为了保留诊断而生成的 synthetic 条目只能写入 `non_executed_diagnostics`；`automation-run-summary.json` 的 `counts`、`results`、可信复核和结果表均必须排除它们。不得再出现“Case 0 未执行但 summary total 等于完整选择集”的伪完成。
对已确认发送但无可归属助手回复的 Case，manifest 的“完整”只表示失败证据链完整，不表示产品回复完成。`reply-completion.json` 必须同时保存 `complete=false`、`terminal_failure=true`、`terminal_outcome=timed_out|no_reply`、发送回执、等待时长、失败原因和终态截图 SHA。`no_reply` 还必须保存 `observed_running_after_send=true`、`running_after=false`、`min_wait_ms>=60000`、`no_reply_stable_observations>=3`、`terminal_reconciliation_performed=true`、`terminal_reconciliation_task_bound=true`、`terminal_reconciliation_prompt_bound=true` 和 `terminal_reconciliation_reply_present=false`；缺少任一字段仍按框架异常停止。pipeline 不得在任务已停止且稳定无回复后继续把完整 `600000ms` 当作假进度，也不得逐条叠加无效等待。

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
- 明确 identity drift、重复 runner、manifest 不完整仍 completed 或 synthetic completed 时，立即停止并冻结当前批次；随后按第 9.1 节自主修复、校验并在新不可变目录重新执行，除非命中其中明确列出的不可自动恢复条件。

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

把各轮可信复核结果归一化为 `runs.json` 后执行：

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
