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
| 核心内测 | `PRD/QBot核心内测门禁Casebook_74条_2026-07-31.xlsx` | `核心内测Case` | 74 | `d72aba1cee18f6ec16d66c56920ae3e7b8f31106541cb275507dc4cfe328ba03` |
| 完整生产灰度 | `PRD/QBot完整生产灰度门禁Casebook_184条_2026-08-03.xlsx` | `核心内测Case` | 184 | `92cefc45dfb2ec56dd9da00e910abc26f56d545bb447d8d4648487aded4378d7` |

Casebook、Sheet、Case ID 顺序或 SHA 发生变化时，视为新测试合同，必须重新审计并更新本文。

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
     PRD/QBot完整生产灰度门禁Casebook_184条_2026-08-03.xlsx
   ```

4. 执行能力审计：

   ```bash
   npm run core-beta:capability-audit -- \
     --casebook PRD/QBot完整生产灰度门禁Casebook_184条_2026-08-03.xlsx \
     --sheet 核心内测Case \
     --out outputs/core-beta-capability-audit
   ```

   审计报告必须是 `qbot-core-beta-capability-audit/v2`，且同时满足
   `protocol.executable_count=184`、`runtime_dispatch.ok=true`、
   `runtime_dispatch.dispatchable_count=184` 和
   `capability_summary.unsupported_runtime=0`。仅有场景注册、但没有真实
   runtime 分发路径的 Case 必须在静态审计阶段失败，禁止拖到正式批次中途
   才报“缺少 executor”。

5. 执行统一真实运行前自检。以下以 360Teams 为例；所有字段必须替换为本轮冻结发布值：

   ```bash
   npm run core-beta:pretest -- \
     --casebook PRD/QBot完整生产灰度门禁Casebook_184条_2026-08-03.xlsx \
     --sheet 核心内测Case \
     --profile mandatory \
     --lane teams \
     --out outputs/<new-immutable-pretest-dir> \
     --expected-count 184 \
     --expected-sha256 92cefc45dfb2ec56dd9da00e910abc26f56d545bb447d8d4648487aded4378d7 \
     --expected-teams-version "<teams-version>" \
     --expected-teams-build "<teams-build>" \
     --expected-qwork-version "<qwork-version>" \
     --expected-control-plane-origin "<exact-control-plane-origin>" \
     --core-beta-fixture-control-url http://127.0.0.1:<fixture-port> \
     --production-gate true \
     --backend-version "<backend-release-id>" \
     --prompt-policy-version "<prompt-policy-id>" \
     --feature-flags-hash "<feature-flags-sha256>"
   ```

   `core-beta:pretest` 只读检查 Git 分支/提交/tracked dirty、预检入口及其不变量测试是否已被 Git 跟踪、Casebook、协议、双框架测试、唯一 runner、宿主/session/CDP、QWork 登录目标、发布身份和逐 Case fixture 合同。它不启动/重启 360Teams、不打开 QWork、不发送消息，也不生成 synthetic Case。只有报告结论为 `READY` 才允许启动真实 runner。

6. 冻结并记录发布身份：

   - 360Teams 版本和 build。
   - QWork runtime、UI URL、环境（DEV/UAT/PROD）。
   - backend、prompt policy、feature flags。
   - 模型档位和模型/引擎。
   - Casebook SHA、框架 commit、CDP、宿主 PID、profile、session。

7. 确认本轮只有一个受管 runner、一个固定宿主和一个不可变输出目录。禁止启动第二 runner。

8. 确认所需真实资源已经就绪。184 条中需要第二账号、OAuth、GitLab、重启、原生 IME、故障矩阵、安全矩阵、Auto 路由故障、能力激活快照、SQLite/Ask 竞态或受保护 UAT 部署的 Case，不得用普通 UI 会话替代。

## 4. Fixture 控制器合同

74 条和 184 条 Casebook 都包含不能由裸 UI 环境独立构造的场景。需要严格控制器的 Case 必须配置：

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

### 4.1 184 条新增高风险合同

完整生产灰度门禁在原 160 条基础上新增 24 条，全部属于一票否决范围：

- `BETA-ROUTE-001~006`：Auto 固定 Claude Code family、公司感知 M1–M4、保守 fallback、host-private router、CAS 与手动选择隔离；必须记录 `model_route_trace`。
- `BETA-CAP-001~004`：Skill/MCP auto/manual 四象限、Expert overlay、required/optional failure 和 stale/principal/generation fencing；必须记录 `activation_snapshot`。
- `BETA-STATE-001~004`：结构化 SQLite last-good、schema migration、Ask pending 重建、terminal receiver admission；必须记录 `sqlite_state_readback` 或 `ask_lifecycle_trace`。
- `BETA-MCP-015~016`：Teams owned Node stdio 生命周期和当前会话 model ID 权威覆盖；不得只凭回复文本判定。
- `BETA-DEPLOY-001~008`：Dashboard 策略、受保护迁移、Helm legacy 接管/重试/恢复、Ingress、诊断和 qbot-ui 退役。必须在隔离 UAT namespace 使用真实部署控制器，记录 `dashboard_policy_readback`、`deployment_receipt`、`migration_receipt` 或 `helm_lifecycle_trace`；本地 mock/fixture 不能替代。

上述 Case 均不得 pipeline 并发执行。缺少受保护环境、控制器或任一证据角色时只能 `trusted_blocked` 或 `framework_issue`，不能缩减后宣称完整生产门禁通过。

## 5. 直接连接 QBot/QWork 执行

适用于已经启动并登录、能够通过 CDP 访问的 QBot/QWork。产品环境必须在启动前由操作者确认；框架不会替操作者把 PROD、UAT 或 DEV 互相切换。

完整 184 条示例：

```bash
cd /Users/qifu/Documents/QbotTestAgent

CASEBOOK="$PWD/PRD/QBot完整生产灰度门禁Casebook_184条_2026-08-03.xlsx"
OUT="$PWD/outputs/$(date +%Y%m%d%H%M)_core-beta-184_<release-id>"

npm run ui-agent:casebook-run -- \
  --casebook "$CASEBOOK" \
  --sheet 核心内测Case \
  --profile mandatory \
  --cdp http://127.0.0.1:9224 \
  --out "$OUT" \
  --model-tier M3 \
  --timeout-ms 600000 \
  --single-host-pipeline 20 \
  --core-beta-fixture-control-url http://127.0.0.1:<fixture-port> \
  --production-gate true \
  --backend-version "<backend-release-id>" \
  --prompt-policy-version "<prompt-policy-id>" \
  --feature-flags-hash "<feature-flags-sha256>"
```

核心 74 条只需替换 `CASEBOOK`，不要改变 Sheet。

执行单个或受影响 Case：

```bash
npm run ui-agent:casebook-run -- \
  --casebook "$CASEBOOK" \
  --sheet 核心内测Case \
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
  --sheet 核心内测Case \
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
  --sheet 核心内测Case \
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

由于 360Teams 包装器会在 runner 启动时补充受管重启能力，预检与 runner
观察到的“当前不可用 fixture”集合可能不同。scoped 合同因此要求 excluded
Case 覆盖运行时全部不可用 fixture Case；允许额外显式排除的 Case 仍只能是
Casebook 注册表中的专项 fixture Case，且必须写入
`additional_fixture_exclusion_ids`。这不会扩大可信结论，批次仍永久
`release_gate_eligible=false`；漏排任何运行时不可用 fixture Case 则继续
fail-closed。

## 6. 360Teams 正式包执行

360Teams 场景必须走专用适配层，不使用本地 QBot 的 `9224`，也不能直接操作 runner 临时 WebView/CDP 代理。

1. 停止普通 360Teams 客户端后，以已有登录 profile 启动受管宿主：

   ```bash
   npm --prefix teams360-automation run launch:live
   npm --prefix teams360-automation run doctor -- --open-qbot
   ```

2. 导出精确 Case ID 列表：

   ```bash
   CASEBOOK="$PWD/PRD/QBot完整生产灰度门禁Casebook_184条_2026-08-03.xlsx"
   PLAN="$(mktemp /tmp/qbot-core-beta-plan.XXXXXX.json)"

   python3 skills/qbot-execute-automation-tests/scripts/casebook_io.py export-cases \
     --casebook "$CASEBOOK" \
     --sheet 核心内测Case \
     --profile mandatory \
     --output "$PLAN"

   CASE_IDS="$(python3 -c 'import json,sys; print(",".join(x["id"] for x in json.load(open(sys.argv[1]))["cases"]))' "$PLAN")"
   ```

3. 启动唯一 runner：

   ```bash
   OUT="teams360-automation/output/$(date +%Y%m%d%H%M)_core-beta-184_<release-id>"

   npm --prefix teams360-automation run casebook -- \
     --casebook "$CASEBOOK" \
     --sheet 核心内测Case \
     --profile mandatory \
     --case "$CASE_IDS" \
     --model-tier M3 \
     --out "$OUT" \
     --timeout-ms 600000 \
     --single-host-pipeline 20 \
     --core-beta-fixture-control-url http://127.0.0.1:<fixture-port> \
     --production-gate true \
     --backend-version "<backend-release-id>" \
     --prompt-policy-version "<prompt-policy-id>" \
     --feature-flags-hash "<feature-flags-sha256>" \
     --qwork-ui-git-commit "<qwork-ui-commit>" \
     --qwork-build-id "<qwork-build-id>" \
     --qwork-release-manifest-sha256 "<manifest-sha256>"
   ```

Teams 适配层会管理 live-profile alias、session、上游 CDP、WebView 代理、宿主重连和内部重启命令。调用者不得传 `--restart-command`，不得连接临时代理执行额外 UI 操作，也不得把输出写到 `teams360-automation/output` 之外。

## 7. 批量、串行屏障与初始化

- `--single-host-pipeline N` 支持 `1–20`；`true` 等价于 `20`。
- 仅 Casebook 声明且运行时判定安全的独立会话可以批量 dispatch/collect。
- 附件、Skill/MCP/专家的创建安装授权删除、HITL、成果、重启、共享状态、故障注入和多轮会话都是串行屏障。
- 不得同时启用单宿主 pipeline 和多 CDP `--parallel`。
- pipeline 必须保存唯一 wave、task ID、能力绑定和 dispatch/collect 证据；重复 task ID 或跨 Case 取证立即视为框架异常。
- pipeline 回收结果进入 `completed` 前必须从调度包装项中解出原始 Case，并执行与串行路径完全相同的 Core Beta manifest 完整性门禁和 `automation_error` 硬停止；不得因 `{testCase,index,eligibility}` 包装对象使 `isCoreBetaCase` 判断失效。
- 模型无回复属于产品失败，不等于证据缺失。允许两种失败终态：一是完整等待窗口耗尽（`terminal_outcome=timed_out`，`waited_ms >= timeout_ms >= 60000`）；二是确认发送且真实进入运行态后已经停止、等待至少 `60000ms`、连续至少 3 次稳定采样仍无可归属助手正文（`terminal_outcome=no_reply`）。两者都必须保存明确 terminal reason、任务绑定、发送回执、终态截图及其 SHA-256，`reply_completion` 才可标记为“失败终态证据完整”；其产品完成状态仍必须为 `complete=false`，Case 仍判失败/bug，禁止借此形成 pass。没有“曾进入运行态”证据时不得把排队任务提前判为 `no_reply`。
- 全量执行必须先按固定顺序执行 `BETA-INIT-001` 至 `BETA-INIT-005`。初始化失败始终使本轮发布门禁为 NO-GO，但“发布阻断”与“执行停止”必须分离：`BETA-INIT-001` 失败、任一初始化 `automation_error`、仍处于 pending、或运行时/SDK/工作台/输入区/按钮/capabilities/页面读回任一不可用时必须停止；`BETA-INIT-002` 至 `BETA-INIT-004` 若留下 manifest 完整的可信产品 Bug，且上述公开可用性信号全部明确恢复，可以继续收集后续独立 Case 证据。降级继续必须在 Case 结果中保存 `initialization_continuation`，并明确 `release_gate_eligible=false`；后续通过不得覆盖或稀释初始化 Bug。
- Core Beta v2 的 `BETA-INIT-001` 至 `BETA-INIT-004` 必须从系统设置点击真实维护按钮；全量重初始化、Skill 重装和清空会话必须捕获与动作匹配的确认弹窗，禁止以直接调用 preload bridge 代替用户操作。
- 初始化动作必须证明本次点击引起了状态转换。优先取证按钮 busy/disabled 或维护区处理中状态；若动作短于轮询采样窗口，只有“动作前不存在、动作后新增、且与当前按钮精确匹配”的完成回执，加上确认弹窗和连续稳定终态，才可替代 transient busy。产品成功契约明确会刷新 renderer 的维护动作（当前仅清空全部会话），允许把确认动作后发生的主框架刷新作为因果动作信号，但仍必须同时满足匹配确认弹窗和刷新后的连续稳定终态；其他导航不得复用。陈旧完成文案不得复用。
- `BETA-INIT-001` 必须点击当前发布界面实际显示的“立即检查运行时”入口（当前 `assistant-prepare-python-runtimes`）；只有发布界面明确提供旧“检查更新运行时”入口时才兼容 `assistant-runtime-update-check`，不得因 testid 演进把可见入口误判为缺失。
- `BETA-INIT-001` 至 `BETA-INIT-004` 本身不发送模型请求，不能被全局模型档位门禁挡在初始化之前。若启动时连接视图尚未恢复，runner 只可把模型检查延后到真实初始化之后；首个需要模型的 Case 及其每次发送前仍必须读取连接视图并精确锁定请求档位，无可用档位时禁止发送。
- 重初始化或清空会话可能触发页面导航或 replacement renderer。runner 必须刷新共享 page、必要时重建受管 WebView 连接，并在同一 Case 内等待公开维护区、Claude/Codex SDK、工作台、输入区和 capabilities 连续稳定；默认最长等待 `600000ms`，不得把“正在准备”截图当作 ready。
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
产品动作失败本身不等于证据不完整：结构完整、包含 before/after 截图的 failed/blocked action receipt 仍是有效证据，最终业务结论可以是 `trusted_bug` 或 `trusted_blocked`。runner 只能把 manifest 完整的真实执行结果计入 `completed`；发现 synthetic、manifest 缺失/结构异常/不完整、角色无效或 SHA 缺失时，必须写 `framework-stop-diagnostic.json` 并停止，后续 Case 保持未执行，禁止批量补 synthetic blocked。
Case 0、预检或顶层异常为了保留诊断而生成的 synthetic 条目只能写入 `non_executed_diagnostics`；`automation-run-summary.json` 的 `counts`、`results`、可信复核和结果表均必须排除它们。不得再出现“Case 0 未执行但 summary total 等于完整选择集”的伪完成。
对已确认发送但无可归属助手回复的 Case，manifest 的“完整”只表示失败证据链完整，不表示产品回复完成。`reply-completion.json` 必须同时保存 `complete=false`、`terminal_failure=true`、`terminal_outcome=timed_out|no_reply`、发送回执、等待时长、失败原因和终态截图 SHA。`no_reply` 还必须保存 `observed_running_after_send=true`、`running_after=false`、`min_wait_ms>=60000` 和 `no_reply_stable_observations>=3`；缺少任一字段仍按框架异常停止。pipeline 不得在任务已停止且稳定无回复后继续把完整 `600000ms` 当作假进度，也不得逐条叠加无效等待。

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

若发现的是产品 Bug，监控不得把它改判为框架问题，也不得修改 deepbankV2；只在 Case 证据完整、fail policy 允许且后续 Case 独立时继续执行。若需要凭据、受保护资源、人工授权，或指定发布身份已经无法恢复，则不能安全自愈：保持冻结并向用户报告唯一具体阻塞，不得猜测、绕过或静默换环境。

## 10. 中断、修复与重跑

- 输出目录一旦产生真实 Case 结果，就视为不可变批次。
- 框架或 Case 修复后使用新的输出目录。
- Core Beta v2 的生产灰度轮次要求 `executed=total`、`inherited=0`、`synthetic=0`，因此正式 74/184 全量门禁不使用跨批次继承；中断后重新执行完整新批次。
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

## 12. 多轮生产灰度门禁

单轮全绿不授权生产。完整 184 条必须在同一冻结发布身份下连续通过 5 轮，且每轮满足：

- `total=completed=executed=unique_case_count=trusted_pass=184`
- `inherited=0`
- `synthetic=0`
- `trusted_bug/trusted_fail/trusted_blocked/framework_issue/testcase_issue=0`
- evidence complete 和 action receipts 均为 184，missing/invalid 为 0
- 单 runner 唯一、cleanup 完成、fixture 恢复、真实产品执行成立
- flaky 为 0

候选轮次中至少一轮还必须完成不少于 100 个任务和 3 次重启的 soak，且无 crash 或资源泄漏。

把各轮可信复核结果归一化为 `runs.json` 后执行：

```bash
npm run core-beta:gray-gate -- \
  /absolute/path/to/runs.json \
  /absolute/path/to/core-beta-gray-gate.json \
  5 \
  184
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
