# QBot Core Beta Agent 操作指南

适用对象：后续接手 `/Users/qifu/Documents/QbotTestAgent` 的 QA Agent。

本文是当前 Core Beta 70 条门禁工作的接力指南。规范性合同仍以
`/Users/qifu/Documents/QbotTestAgent/QBOT_AUTOMATION_FRAMEWORK.md` 为准；
本指南只回答“当前进度是什么、下一位 Agent 应该怎么安全继续”。

## 1. 当前基线

- 框架仓库：`/Users/qifu/Documents/QbotTestAgent`
- 产品仓库：`/Users/qifu/Documents/deepbankV2`，只读，禁止修改。
- 当前框架基线：以运行前 `git rev-parse HEAD` 的已推送 `main` 为准；不得使用本文中的历史提交启动。
- 要求：`main == origin/main`，tracked dirty=false。
- 当前没有有效 runner，也没有有效 monitor；不要继承旧 PID 或旧监控。
- 当前正式宿主身份：360Teams `5.2.38(2119080433)`。
- 当前 QWork 身份：UAT `0.0.29`。
- 当前 control plane：
  `https://deepbank-control-uat.sandbox.deepbank.daikuan.qihoo.net`
- 当前模型档位：M3。

最近一次确认可用的 scoped 预检：

```text
/Users/qifu/Documents/QbotTestAgent/outputs/20260805084049_uat-core-beta70-scoped55-pretest_framework-71b25fa_teams-5.2.38_qwork-0.0.29/core-beta-pretest-report.json
```

该预检结果为 `READY_SCOPED`，27 checks，0 blockers。

## 2. 当前 Casebook 和执行范围

当前 Core Beta 70 条 Casebook：

```text
/Users/qifu/Documents/QbotTestAgent/outputs/qbot-core-gate-redesign-20260730/QBot核心内测Casebook_MR源码严选门禁_70条_2026-07-30.xlsx
```

- Sheet：`核心内测Case`
- SHA-256：`108ccbb6cadabcfd323ed408217c1bf2082244a272ae2532ccf370b7977aa27c`
- 静态能力审计：70/70 executable，70/70 dispatchable，unsupported=0。
- 当前可裸 UI 执行范围：55/70。
- 当前排除范围：15 条真实 fixture provider 不可用 Case。
- 当前 scoped 执行永久 `release_gate_eligible=false`，即使 55 条全绿，也不能宣称完整 70 条发布门禁通过。

当前 15 条排除 Case：

```text
BETA-INIT-005,BETA-CHAT-010,BETA-ART-005,BETA-SKILL-013,BETA-SKILL-015,BETA-EXPERT-006,BETA-EXPERT-007,BETA-EXPERT-011,BETA-EXPERT-013,BETA-MCP-008,BETA-REC-001,BETA-REC-002,BETA-REC-003,BETA-REC-004,BETA-AUTH-001
```

完整 70 条要作为发布门禁，必须补齐这些 Case 需要的真实 fixture provider，
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
- Teams 适配层：88/88。

静态能力审计：

```bash
OUT_AUDIT="$PWD/outputs/$(date +%Y%m%d%H%M)_core70-capability-audit"
npm run core-beta:capability-audit -- \
  --casebook "$PWD/outputs/qbot-core-gate-redesign-20260730/QBot核心内测Casebook_MR源码严选门禁_70条_2026-07-30.xlsx" \
  --sheet 核心内测Case \
  --out "$OUT_AUDIT" \
  --profile mandatory
```

必须满足：

- `protocol.ok=true`
- `protocol.case_count=70`
- `runtime_dispatch.ok=true`
- `runtime_dispatch.unsupported_count=0`

## 5. 当前 55 条 scoped 预检

如果用户要求继续执行当前 55 条，先用最近成功预检报告取出精确选择集：

```bash
cd /Users/qifu/Documents/QbotTestAgent

SOURCE_PRETEST="$PWD/outputs/20260805084049_uat-core-beta70-scoped55-pretest_framework-71b25fa_teams-5.2.38_qwork-0.0.29/core-beta-pretest-report.json"
CASEBOOK="$PWD/outputs/qbot-core-gate-redesign-20260730/QBot核心内测Casebook_MR源码严选门禁_70条_2026-07-30.xlsx"
CASE_IDS="$(jq -r '.scope.selected_case_ids | join(",")' "$SOURCE_PRETEST")"
EXCLUDED_CASE_IDS="$(jq -r '.scope.excluded_case_ids | join(",")' "$SOURCE_PRETEST")"

npm run core-beta:pretest -- \
  --casebook "$CASEBOOK" \
  --sheet 核心内测Case \
  --profile mandatory \
  --lane teams \
  --out "$PWD/outputs/$(date +%Y%m%d%H%M)_uat-core-beta70-scoped55-pretest_framework-$(git rev-parse --short HEAD)" \
  --expected-count 55 \
  --expected-sha256 108ccbb6cadabcfd323ed408217c1bf2082244a272ae2532ccf370b7977aa27c \
  --production-gate true \
  --expected-teams-version 5.2.38 \
  --expected-teams-build 2119080433 \
  --expected-qwork-version 0.0.29 \
  --expected-control-plane-origin https://deepbank-control-uat.sandbox.deepbank.daikuan.qihoo.net \
  --backend-version uat-health-cd24c9d3b3cf5dca \
  --prompt-policy-version qwork-runtime-0.0.29-sha256-29d64654090a26f5222ad7ea1e9b63888a1546742e14482ef9cde631d03015ef \
  --feature-flags-hash 47809cea8774e0b84e4bd50aec6498a4d96850bb1b5b59257f396bd0f48fb315 \
  --case "$CASE_IDS" \
  --scoped-execution true \
  --excluded-case "$EXCLUDED_CASE_IDS" \
  --scope-reason fixture_provider_unavailable
```

只有新报告返回 `READY_SCOPED` 且 0 blockers，才允许启动 scoped runner。

如果 360Teams、QWork、control plane、backend、prompt policy 或 feature flags
任一字段变化，必须重新冻结发布身份并更新命令。不要沿用上面的值假装同一发布。

## 6. 启动唯一 runner

只有通过第 5 节预检后才启动。输出目录必须新建，不得复用旧目录：

```bash
OUT="$PWD/teams360-automation/output/$(date +%Y%m%d%H%M%S)_uat-core-beta70-scoped55_teams360-5.2.38-2119080433_qwork-0.0.29_M3_serial_framework-$(git rev-parse --short HEAD)"

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
  --prompt-policy-version qwork-runtime-0.0.29-sha256-29d64654090a26f5222ad7ea1e9b63888a1546742e14482ef9cde631d03015ef \
  --feature-flags-hash 47809cea8774e0b84e4bd50aec6498a4d96850bb1b5b59257f396bd0f48fb315 \
  --qwork-build-id 0.0.29 \
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

- 当前框架具备执行 70 条 Core Beta Case 的能力。
- 当前没有 fixture provider 时，只能执行 55 条 scoped 范围。
- 55 条 scoped 全绿只能证明范围内核心能力有效。

不能说：

- 55 条 scoped 全绿等于完整 70 条门禁通过。
- `READY_SCOPED` 等于可发布。
- raw passed 等于 trusted pass。
- 后续重试通过可以抹去旧批次中已取证的产品缺陷、框架问题或 flaky。

完整 70 条发布门禁必须补齐 15 条 fixture provider，预检返回 `READY`，再在同一冻结发布身份下执行完整门禁和多轮可信复核。
