# QBot Core Beta Agent 操作指南

适用对象：后续接手 `/Users/qifu/Documents/QbotTestAgent` 的 QA Agent。

规范性执行合同以
`/Users/qifu/Documents/QbotTestAgent/QBOT_AUTOMATION_FRAMEWORK.md` 为准。
本指南记录当前 70 条生产灰度发布门禁与 160 条全量正常功能回归的接手状态、
启动顺序和禁止事项。

## 1. 当前状态

- 测试已按用户要求暂停。当前不得启动 pretest、runner 或 monitor。
- 产品仓库 `/Users/qifu/Documents/deepbankV2` 只读，禁止修改。
- 产品设计基线：`origin/release/0.1`，
  commit `686b862ea9553215c2563d87db8339096acecb9d`，版本 `0.1.1`。
- 下一轮目标 lane：UAT。实际 360Teams、QWork、control plane、backend、
  prompt policy、feature flags 和模型身份必须在用户恢复测试后重新读取并冻结，
  不得沿用历史值。
- 当前没有有效 runner，也没有有效 monitor；不要继承旧 PID、旧 CDP 或旧监控。

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
- SHA-256：`c4e1110770ad28787d34cfcd6973d27852a9f9151b4ecdbc9bdebbdd055da177`
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
- `BETA-EXPERT-001`：发布记录严格等于 `owned=true` 专家集合。
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
  --expected-sha256 c4e1110770ad28787d34cfcd6973d27852a9f9151b4ecdbc9bdebbdd055da177 \
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
`--expected-count 160` 和同一 SHA 执行 pretest；同样只接受 `READY`。测试当前暂停，
本次更新不得实际运行这两个 pretest。

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

## 8. 执行与自愈

- Core Beta v2 Case 间永久串行；`BETA-CHAT-008` 的 20 任务是单 Case 内部合同。
- Agent 澄清/推荐选项由框架点击精确“跳过/跳过（用默认）”并留证，不使用
  Computer Use。
- 产品 Bug 在证据完整且后续 Case 独立时继续；不得修改 deepbankV2。
- 普通 prerequisite `blocked` 记录后继续独立 Case，不得覆盖更高优先级的
  `automation_error`。
- 确认 `framework_issue` 或 `testcase_issue` 时，冻结旧目录、停止唯一 runner、
  修复框架/Casebook、强化 invariant、全检、提交推送、重新 pretest，并在新目录
  从 1/70 或 1/160 完整重跑所选 Sheet。停止旧 runner 只是保护证据，不是允许
  放弃后续 Case。
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

本次任务只更新 Casebook、执行器、动态能力门禁、文档和回归基线；测试保持暂停。
完成代码提交和推送不等于 70/160 条已经执行，也不等于允许生产灰度。下一轮必须
由用户明确恢复测试后，从新的 UAT release identity、对应 Sheet 的 `READY`
pretest 和 1/70 或 1/160 开始。
