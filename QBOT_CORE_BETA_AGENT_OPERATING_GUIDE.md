# QBot Core Beta Agent 操作指南

适用对象：后续接手 `/Users/qifu/Documents/QbotTestAgent` 的 QA Agent。

本文是当前 Core Beta 74 条门禁工作的接力指南。规范性合同仍以
`/Users/qifu/Documents/QbotTestAgent/QBOT_AUTOMATION_FRAMEWORK.md` 为准；
本指南只回答“当前进度是什么、下一位 Agent 应该怎么安全继续”。

## 1. 当前基线

- 框架仓库：`/Users/qifu/Documents/QbotTestAgent`
- 产品仓库：`/Users/qifu/Documents/deepbankV2`，只读，禁止修改。
- 当前框架基线：以运行前 `git rev-parse HEAD` 的已推送 `main` 为准；不得使用本文中的历史提交启动。
- 要求：`main == origin/main`，tracked dirty=false。
- 当前没有有效 runner，也没有有效 monitor；不要继承旧 PID 或旧监控。
- 当前正式宿主身份：360Teams `5.2.41(2119080662)`。
- 当前 QWork 身份：UAT `0.0.30-rc.2`。
- 当前 control plane：
  `https://deepbank-control-uat.sandbox.deepbank.daikuan.qihoo.net`
- 当前模型档位：M3。

最近一次已冻结的 scoped 批次：

```text
/Users/qifu/Documents/QbotTestAgent/teams360-automation/output/20260807000421_uat-core-beta74-scoped55_teams360-5.2.41-2119080662_qwork-0.0.30-rc.2_M3_serial_framework-c012a5a
```

该批次完成 49/55 后，在 `BETA-MCP-002` 确认 framework issue：5 个固定
connector 均已进入真实手动模式并逐项点击、读回，其中 3 个成功选中，
`mcphub:dis` 与 `mcphub:wecom` 点击后产品返回 `selectedConnectors=[]`，属于
证据完整的产品失败。runner 错误地把“5 个业务 Oracle 全部通过”的布尔值写入
`capability-selection.json.valid`，导致 5 份结构化负向收据被 manifest 判为
`capability_selection/capability_execution_event` 无效并硬停止。该目录已冻结，
不得续写；修复必须分离 `evidence_valid` 与 `oracle_valid`，并在新推送干净基线上
从第 1 条完整重跑 55 条。

此前冻结的 scoped 批次：

```text
/Users/qifu/Documents/QbotTestAgent/teams360-automation/output/20260806222136_uat-core-beta74-scoped55_teams360-5.2.41-2119080662_qwork-0.0.30-rc.2_M3_serial_framework-80f8e53
```

该批次完成 49/55 后，在 `BETA-MCP-002` 确认 framework issue：新版手动连接器
模式已经通过真实可见 UI 点击并读回 `aria-checked=true`、
`connectorRouting.mode=manual`、28 个可见选项；随后 V2 runner 在按 key 点击首个
样本后调用未定义的 `coreBetaSelectedCapabilityIdentities`，抛出
`ReferenceError`，导致本 Case 的 action/public state/cleanup/selection/execution
五个角色尚未注册就硬停止。该目录已冻结，不得续写；修复和 invariant 通过后
必须在新的已推送干净基线上从第 1 条完整重跑 55 条。

此前冻结的 scoped 批次：

```text
/Users/qifu/Documents/QbotTestAgent/teams360-automation/output/20260806213321_uat-core-beta74-scoped55_teams360-5.2.41-2119080662_qwork-0.0.30-rc.2_M3_serial_framework-45f49ce
```

该批次完成 17/55 后，在 `BETA-FILE-004` 再次确认总计 Oracle 的 framework
issue：产品回复以 TSV 表格给出 `CSV（qbot-table.csv）` 与
`Excel（qbot-data-table-diff.xlsx）` 两个表头列，后续总计行在对应列明确给出
`182` 与 `215`，三处差异也全部正确；解析器只覆盖同行文件身份，没有把表头
列身份传播到后续总计行，错误输出 `totals=false`。第 18 条仅有中间证据，未形成
Case 结果。该目录已冻结，不得续写；修复后必须在新推送基线上从第 1 条完整重跑
55 条。

此前冻结的 scoped 批次：

```text
/Users/qifu/Documents/QbotTestAgent/teams360-automation/output/20260806203032_uat-core-beta74-scoped55_teams360-5.2.41-2119080662_qwork-0.0.30-rc.2_M3_serial_framework-5c9f1b5
```

该批次完成 17/55 后，在 `BETA-FILE-004` 确认总计 Oracle 的 framework issue：
产品回复明确给出 `总计：CSV = 182，XLSX = 215`，三处差异也全部正确，但
解析器没有按同一行的下一个文件身份切分数值区间，错误地把行尾 215 当作 CSV
总计并将 Case 误标为产品 Bug。第 18 条仅有中间证据，未形成 Case 结果。
该目录已冻结，不得续写；修复后必须在新推送基线上从第 1 条完整重跑 55 条。

此前冻结的 scoped 批次：

```text
/Users/qifu/Documents/QbotTestAgent/teams360-automation/output/20260806183239_uat-core-beta74-scoped55_teams360-5.2.41-2119080662_qwork-0.0.30-rc.2_M3_serial_framework-7b12d99
```

该批次完成 49/55 后，于 `BETA-MCP-002` 暴露 Core Beta v2 runner 只将
“打开连接器子菜单”当作手动模式成功，没有使用稳定 section
testid、最新可见 Portal、键盘回退，也没有真实点击
`composer-connector-mode-manual` 并读回手动列表与 routing/radio 状态。
因前置 reset 失败，本 Case 的 `capability_selection` 和
`capability_execution_event` 没有形成有效 manifest 证据，框架正确硬停。
该目录已冻结，不得续写；修复后必须在新的已推送干净基线上从第 1 条
完整重跑 55 条，不得只续跑剩余 5 条。

此前冻结的 scoped 批次：

```text
/Users/qifu/Documents/QbotTestAgent/teams360-automation/output/20260806163632_uat-core-beta74-scoped55_teams360-5.2.41-2119080662_qwork-0.0.30-rc.2_M3_serial_framework-dea7e07
```

该批次在更新后的 360Teams `5.2.41(2119080662)`、QWork `0.0.30-rc.2`
完成 48/55 后，于 `BETA-MCP-001` 暴露框架只识别旧 health probe 字段、没有识别
当前 connector catalog 的 `statusKind=ready` 与 `usable=true`，把 31 个目录项全部
误判为不健康；样本不足分支随后直接抛异常，导致 manifest 缺少 5 个角色并硬停止。
该目录已冻结，不得续写。修复必须兼容当前 catalog 合同、增加 MCP prerequisite
blocked 传播与 invariant，并在已推送干净基线上从第 1 条完整重跑 55 条。

此前冻结的 scoped 批次：

```text
/Users/qifu/Documents/QbotTestAgent/teams360-automation/output/20260806155958_uat-core-beta74-scoped55_teams360-5.2.38-2119080433_qwork-0.0.30-rc.1_M3_serial_framework-997972e
```

该批次完成 2/55 后，在 `BETA-INIT-002` 暴露框架让陈旧的可见“准备中 0%”
覆盖 Claude/Codex `ready/100%`、capabilities、工作台、输入区和维护按钮等结构化
ready 信号，并最终错误升级为 `automation_error`。该目录已冻结，不得续写；修复后
须在新产品身份上从第 1 条完整重跑 55 条。

更早的冻结批次：

```text
/Users/qifu/Documents/QbotTestAgent/teams360-automation/output/20260806141103_uat-core-beta74-scoped55_teams360-5.2.38-2119080433_qwork-0.0.30-rc.1_M3_serial_framework-245a3e7
```

该批次完成 37/55 后，在 `BETA-EXPERT-002` 暴露框架将“产品复用历史草稿、
未创建本轮 owner draft”的完整负向读回误标为无效证据，导致 4 个专项角色
manifest 缺失并错误停止。该目录已冻结，不得续写。产品 Bug、此前确认的其他
产品缺陷以及 17 条未执行 Case 都必须保留在最终报告；框架修复后须从第 1 条
完整重跑 55 条，`inherited=0`、`synthetic=0`。

再早的冻结批次：

```text
/Users/qifu/Documents/QbotTestAgent/teams360-automation/output/20260806125939_uat-core-beta74-scoped55_teams360-5.2.38-2119080433_qwork-0.0.30-rc.1_M3_serial_framework-62fd6ff
```

该批次完成 22/55 后，在 `BETA-ART-003` 确认 Core Beta v2 回复相关性
误报和 `第undefined轮` 证据标签的 framework issue；第 23 条仅有中间证据，
未形成 Case 结果。该目录已冻结，不得续写。修复后必须基于本指南中的
正式 74 条 Casebook 新建 pretest 和 runner 输出目录，从第 1 条重跑
55 条，不得继承本批次的 22 条结果。

## 2. 当前 Casebook 和执行范围

当前正式 Core Beta 74 条 Casebook：

```text
/Users/qifu/Documents/QbotTestAgent/PRD/QBot核心内测门禁Casebook_74条_2026-07-31.xlsx
```

- Sheet：`核心内测Case`
- SHA-256：`25c1c3df11e3d65ec0927edd5ddd2e693aa4bfdccdb92899fe3344a7f7dbe8f6`
- 静态能力审计：74/74 executable，74/74 dispatchable，unsupported=0。
- 当前可执行选择集：55/74。
- 当前排除范围：19 条，包括 15 条真实 fixture provider 不可用 Case和 4 条不属于原 scoped 55 选择集的新增专家 Case。
- 当前 scoped 执行永久 `release_gate_eligible=false`，即使 55 条全绿，也不能宣称完整 74 条发布门禁通过。

当前 19 条排除 Case：

```text
BETA-INIT-005,BETA-CHAT-010,BETA-ART-005,BETA-SKILL-013,BETA-SKILL-015,BETA-EXPERT-006,BETA-EXPERT-007,BETA-EXPERT-011,BETA-EXPERT-013,BETA-EXPERT-017,BETA-EXPERT-018,BETA-EXPERT-019,BETA-EXPERT-020,BETA-MCP-008,BETA-REC-001,BETA-REC-002,BETA-REC-003,BETA-REC-004,BETA-AUTH-001
```

完整 74 条要作为发布门禁，必须补齐这些 Case 需要的真实 fixture provider，
重新跑 `READY` 预检，而不是 `READY_SCOPED`。

## 3. 接手后第一件事

任何 Agent 接手后先执行只读确认：

```bash
cd /Users/qifu/Documents/QbotTestAgent
git fetch origin main
git rev-parse HEAD
git rev-parse origin/main
git status --short --untracked-files=no
pgrep -af 'ui-agent-casebook-run|casebook-runner|core-beta.*run' || true
find "$HOME/.codex/automations" -maxdepth 2 -type f -name 'automation.toml' -print 2>/dev/null || true
```

期望：

- `HEAD` 等于 `origin/main`。
- tracked dirty=false。
- 没有正在执行的 Casebook runner。
- 没有指向旧目录的 monitor。

如果发现旧 runner 或旧 monitor，先判断是否属于当前用户明确要求的批次。
不能确认时，不要继续启动新 runner；先报告并清理 stale 监控。

## 4. 必跑自检

框架或测试启动前必须跑：

```bash
cd /Users/qifu/Documents/QbotTestAgent
npm run check
npm --prefix teams360-automation run check
```

最近基线通过情况：

- 根框架：80/80。
- Teams 适配层：89/89。

静态能力审计：

```bash
OUT_AUDIT="$PWD/outputs/$(date +%Y%m%d%H%M)_core74-capability-audit"
npm run core-beta:capability-audit -- \
  --casebook "$PWD/PRD/QBot核心内测门禁Casebook_74条_2026-07-31.xlsx" \
  --sheet 核心内测Case \
  --out "$OUT_AUDIT" \
  --profile mandatory
```

必须满足：

- `protocol.ok=true`
- `protocol.case_count=74`
- `runtime_dispatch.ok=true`
- `runtime_dispatch.unsupported_count=0`

## 5. 当前 55 条 scoped 预检

如果用户要求继续执行当前 55 条，必须从正式 74 条 Casebook 重新导出并计算精确选择集：

```bash
cd /Users/qifu/Documents/QbotTestAgent

CASEBOOK="$PWD/PRD/QBot核心内测门禁Casebook_74条_2026-07-31.xlsx"
EXCLUDED_CASE_IDS="BETA-INIT-005,BETA-CHAT-010,BETA-ART-005,BETA-SKILL-013,BETA-SKILL-015,BETA-EXPERT-006,BETA-EXPERT-007,BETA-EXPERT-011,BETA-EXPERT-013,BETA-EXPERT-017,BETA-EXPERT-018,BETA-EXPERT-019,BETA-EXPERT-020,BETA-MCP-008,BETA-REC-001,BETA-REC-002,BETA-REC-003,BETA-REC-004,BETA-AUTH-001"
PLAN="$(mktemp /tmp/qbot-core74-plan.XXXXXX)"
python3 skills/qbot-execute-automation-tests/scripts/casebook_io.py export-cases \
  --casebook "$CASEBOOK" --sheet 核心内测Case --profile mandatory --output "$PLAN"
CASE_IDS="$(node -e 'const fs=require("fs"); const p=JSON.parse(fs.readFileSync(process.argv[1])); const x=new Set(process.argv[2].split(",")); process.stdout.write(p.cases.map(c=>c.id).filter(id=>!x.has(id)).join(","))' "$PLAN" "$EXCLUDED_CASE_IDS")"

npm run core-beta:pretest -- \
  --casebook "$CASEBOOK" \
  --sheet 核心内测Case \
  --profile mandatory \
  --lane teams \
  --out "$PWD/outputs/$(date +%Y%m%d%H%M)_uat-core-beta74-scoped55-pretest_framework-$(git rev-parse --short HEAD)" \
  --expected-count 55 \
  --expected-sha256 25c1c3df11e3d65ec0927edd5ddd2e693aa4bfdccdb92899fe3344a7f7dbe8f6 \
  --production-gate true \
  --expected-teams-version 5.2.41 \
  --expected-teams-build 2119080662 \
  --expected-qwork-version 0.0.30-rc.2 \
  --expected-control-plane-origin https://deepbank-control-uat.sandbox.deepbank.daikuan.qihoo.net \
  --backend-version uat-health-cd24c9d3b3cf5dca \
  --prompt-policy-version qwork-runtime-0.0.30-rc.2-sha256-84175ee2581496a57bb1ec7ad63b466fca503930b8d66729ce2a979f97f3215b \
  --feature-flags-hash ac777398cf2f23a7fe636328f1defd45c1f4dc8d6e835b4d04a31a0052a752bc \
  --case "$CASE_IDS" \
  --scoped-execution true \
  --excluded-case "$EXCLUDED_CASE_IDS" \
  --scope-reason fixture_provider_unavailable
```

只有新报告返回 `READY_SCOPED` 且 0 blockers，才允许启动 scoped runner。
预检会把 `BETA-EXPERT-008/009/010/012/014/015/016` 列为上游发布 Case 已排除
的 dependency gaps；这不是 pretest blocker。runner 到达这些 Case 时必须使用
本轮 suite ledger 精确身份；账本缺失则生成可信 prerequisite blocked 并继续，
禁止回退到账号中其他 active expert。

如果 360Teams、QWork、control plane、backend、prompt policy 或 feature flags
任一字段变化，必须重新冻结发布身份并更新命令。不要沿用上面的值假装同一发布。

## 6. 启动唯一 runner

只有通过第 5 节预检后才启动。输出目录必须新建，不得复用旧目录：

```bash
OUT="$PWD/teams360-automation/output/$(date +%Y%m%d%H%M%S)_uat-core-beta74-scoped55_teams360-5.2.41-2119080662_qwork-0.0.30-rc.2_M3_serial_framework-$(git rev-parse --short HEAD)"

npm --prefix teams360-automation run casebook -- \
  --casebook "$CASEBOOK" \
  --sheet 核心内测Case \
  --profile mandatory \
  --case "$CASE_IDS" \
  --model-tier M3 \
  --out "$OUT" \
  --timeout-ms 600000 \
  --single-host-pipeline 1 \
  --production-gate true \
  --backend-version uat-health-cd24c9d3b3cf5dca \
  --prompt-policy-version qwork-runtime-0.0.30-rc.2-sha256-84175ee2581496a57bb1ec7ad63b466fca503930b8d66729ce2a979f97f3215b \
  --feature-flags-hash ac777398cf2f23a7fe636328f1defd45c1f4dc8d6e835b4d04a31a0052a752bc \
  --qwork-build-id 0.0.30-rc.2 \
  --scoped-execution true \
  --excluded-case "$EXCLUDED_CASE_IDS" \
  --scope-reason fixture_provider_unavailable
```

启动后先验证真的在执行，再创建监控：

```bash
pgrep -af 'ui-agent-casebook-run|casebook-runner|core-beta.*run' || true
ls -lt "$OUT" "$OUT"/logs 2>/dev/null
jq '{completed,total,updated_at,current_case,results:(.results|length)}' "$OUT/automation-progress.json" 2>/dev/null
```

不要只看 PID。必须确认 `automation-progress.json`、runner log、证据目录或
run metadata 在持续更新。若没有真实会话、没有 taskId、没有证据 mtime 变化，
先诊断，不要创建 monitor。

Core Beta v2 的 Case 间执行固定串行。即使旧命令残留 `--parallel > 1` 或
`--single-host-pipeline > 1`，runner 的有效值也必须是 `1`，precheck 必须记录
`core-beta-v2-forced-serial`。`BETA-CHAT-008` 的 20 任务派发是单个 Case 内部合同，
不是 Case 间并行。

若 QWork 显示遮挡左下设置入口的“新版本已就绪”提示，框架会在 Case 开始和
进入系统设置前点击精确的“稍后/跳过更新”并保存前后证据；不得点击“立即更新”
或在批次中改变冻结发布身份。

刷新或受管宿主重启后，Teams 恢复器必须继续使用本轮首次连接冻结的精确
QWork versioned file URL。profile 或临时 renderer 中的旧版本只能触发漂移恢复，
不得成为新的 pin；恢复后必须再次校验 URL、模型档位和 capabilities。

Agent 澄清/推荐选项弹窗继续由框架点击精确“跳过/跳过（用默认）”并留证，
不使用 Computer Use。正式 Case prompt 必须已经包含主题、日期和 Oracle，不能
依赖弹窗补充测试数据。

初始化维护终态要同时读取可见文案和结构化状态。可见区域持续显示“准备中/处理中”，
但 Claude/Codex SDK、runtime loaded、维护按钮、capabilities、工作台和输入区连续至少
3 次全部 ready 时，应固化为 `product_ui_state_conflict` 产品 Bug，并在页面仍可读时
以 `initialization_continuation.safe=true` 继续后续独立 Case。只有结构化状态也未 ready
或证据不完整时才保持 pending 并在有界超时后触发框架硬停止。

## 7. 监控规则

监控只能读文件和进程状态，不得操作 QWork UI，不得连接 runner 临时 CDP/WebView
代理，不得启动第二 runner。

每次监控至少报告：

- 北京时间。
- `completed/55`、executed/inherited/synthetic。
- 最后完成 Case 的 raw status、result category、execution provenance。
- manifest complete/missing/invalid。
- 当前 Case 或等待阶段。
- `automation-progress.json.updated_at`。
- 最新证据路径和 mtime。
- 唯一 runner PID、宿主 PID、Teams/QWork/control plane/CDP。
- framework commit、main==origin/main、tracked dirty。
- 无进度时长。

20 分钟无进度时，先只读核验当前 Case、runner 日志、managed-360teams.log 和
600000ms 等待窗口。任务仍真实运行就等；已确认停止且稳定无回复时，应形成
`no_reply` 产品失败终态，不能无限空等。

## 8. Issue 后自愈

监控发现 confirmed `framework_issue` 或 `testcase_issue` 时，不要只报告。

必须按顺序做：

1. 保全当前输出目录、日志、诊断和证据。
2. 停止唯一 runner，暂停旧 monitor。
3. 冻结旧输出目录，禁止补写或覆盖。
4. 在 QbotTestAgent 修框架或 Casebook，禁止修改 deepbankV2。
5. 增加或强化 regression/invariant。
6. 跑 `npm run check` 和 `npm --prefix teams360-automation run check`。
7. 更新 `QBOT_AUTOMATION_FRAMEWORK.md`，如果合同变化。
8. 提交并 push，确保 `main == origin/main`、tracked dirty=false。
9. 重新跑 pretest。
10. 新建不可变输出目录，从完整 selected scope 重跑，Core Beta v2 保持
    `inherited=0`、`synthetic=0`。

上述第 1 步停止旧 runner 只用于保护不可变证据，不是允许结束执行。只要发布身份、
凭据和受保护资源仍可恢复，Agent 必须继续完成第 4–10 步并启动新完整串行批次，
不得停在“修复完成但后续未执行”的状态。

产品 Bug 不属于框架修复。证据完整且 fail policy 允许时，可以继续后续独立
Case；普通 prerequisite `blocked` 也只记录后继续独立 Case。失败 step/assertion
中已有 `category=automation_error` 时，其优先级高于顶层 `blocked` 或 `bug`，必须
按 framework issue 进入上述自主闭环。初始化硬门禁类抖动必须保留缺陷，不得因
后续重试通过而抹去。

## 9. 结果复核

summary total=55 后停止执行性操作，逐 Case 可信复核。不能采用 raw 结论。

复核必须检查：

- 编号步骤是否严格执行。
- before/action/after 是否对应真实动作和状态变化。
- prompt、taskId、send receipt、transcript、reply delta 是否属于同一任务。
- 回复是否完整、相关、终态，且没有底层错误泄漏。
- Skill、专家、MCP 是否真的选择并产生任务绑定执行事件。
- 附件、成果、工具调用、清理和公开状态是否有独立读回。
- manifest、SHA、日志和产品功能是否一致。

输出分类只能是：

```text
trusted_pass
trusted_fail
trusted_blocked
trusted_bug
framework_issue
testcase_issue
```

## 10. 什么结论可以说，什么不能说

可以说：

- 当前框架具备执行 74 条 Core Beta Case 的能力。
- 当前没有 fixture provider 时，只能执行 55 条 scoped 范围。
- 55 条 scoped 全绿只能证明范围内核心能力有效。

不能说：

- 55 条 scoped 全绿等于完整 74 条门禁通过。
- `READY_SCOPED` 等于可发布。
- raw passed 等于 trusted pass。
- 后续重试通过可以抹去旧批次中已取证的产品缺陷、框架问题或 flaky。

完整 74 条发布门禁必须补齐所需 fixture provider，预检返回 `READY`，再在同一冻结发布身份下执行完整门禁和多轮可信复核。
