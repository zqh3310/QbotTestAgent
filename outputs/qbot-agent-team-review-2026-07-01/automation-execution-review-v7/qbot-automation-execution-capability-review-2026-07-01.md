# QBot 自动化执行能力审查报告

审查日期：2026-07-01  
审查对象：QbotTestAgent 自动化生成与执行能力，参照 Qbot 源码 `/Users/qifu/Documents/deepbankV2`

## 结论

QbotTestAgent 之前只有“Codex 自动化流计划”，不足以证明自动化可以跑起来。本轮已补齐执行层：新增 `automation-doctor` 和 `automation-run`，可把生成的 `codex-automation-flows.json` 转成 macOS bash 或 Windows PowerShell 脚本并执行。

最合适的执行方案不是另起一套 UI 自动化框架，而是让 QbotTestAgent 负责选择、分层、编排和出报告，底层直接调用 Qbot 源码已有脚本体系：

- 本地 UI / Electron：`npm run e2e:doctor -- --scope=local`、`npm run e2e:local`
- UI/UX 可见状态：`npm run uiux:audit -- --scope=local`
- Runtime 能力矩阵：`npm run runtime-features:doctor`、`npm run runtime-features:test -- --tier=fixture`
- 真实 Codex 产品链路：`npm run e2e:qbot:codex:real`
- 真实 Claude Code 产品链路：`npm run e2e:qbot:claude-code:real`
- macOS release：`npm run e2e:release:mac`
- Windows release：`npm run release:prepare/build/verify -- --platform=win`

## 已补齐能力

1. 新增执行器：`/Users/qifu/Documents/QbotTestAgent/src/lib/automation-executor.mjs`
   - 支持 `automation-doctor`、`automation-run`
   - 支持 `smoke / daily / local / real / release / all` 套件
   - 支持 `--os Windows|macOS`、`--flow-id`、`--case-id`、`--level`、`--limit`、`--dry-run`
   - macOS 使用 `/bin/bash`，Windows 使用 `powershell.exe`
   - 输出 `automation-execution-report.json/md`、每条 flow 的 `run.sh` 或 `run.ps1`、stdout/stderr

2. 优化自动化流生成：
   - A0/A1 不再夹带 `build:desktop`、`e2e:release:*`、`release:*`、真实 provider/Codex/Claude 命令
   - A0/A1 不再声明 `ANTHROPIC_*`、`CODEX_*`、`GITLAB_TOKEN` 等真实依赖 env
   - Windows A3 不再生成 `e2e:release:mac`
   - Windows A3 改为 Qbot 源码支持的 `release:* --platform=win`
   - UI/UX 类 flow 补充 `uiux:audit`
   - Runtime A1 flow 补充 fixture 级 `runtime-features:test -- --tier=fixture`
   - A2 真实链路补充 `e2e:qbot:codex:real` 和 `e2e:qbot:claude-code:real`

3. 更新 Agent 约束：
   - `codex-os-automation-planner` 必须产出 runner 可执行的 OS 脚本
   - `cross-platform-e2e-validator` 必须区分 macOS bash 和 Windows PowerShell
   - `qbot-test-chief` 必须交付自动化执行命令和 doctor/dry-run 证据

## 最新产物

最终产物目录：

`/Users/qifu/Documents/QbotTestAgent/outputs/qbot-agent-team-review-2026-07-01/latest-live-product-scope-automation-executable-v7`

生成结果：

- GitLab issue：196
- 产品/功能类 issue：98
- 排除开发过程类 issue：98
- 功能用例：161
- 双端自动化 flow：302
- 审计状态：pass

规则检查结果：

- A0/A1 中 release 命令数量：0
- A0/A1 中真实依赖/Codex/Claude 命令数量：0
- A0/A1 中外部真实 env 声明数量：0
- Windows flow 中 macOS release 命令数量：0
- macOS flow 中 Windows platform 命令数量：0

## 执行验证

macOS daily doctor：

`/Users/qifu/Documents/QbotTestAgent/outputs/qbot-agent-team-review-2026-07-01/automation-doctor-macos-daily-v7/automation-execution-report.md`

- 状态：pass
- 选择 flow：6
- 缺失脚本：无
- 缺失 env：无

macOS daily dry-run：

`/Users/qifu/Documents/QbotTestAgent/outputs/qbot-agent-team-review-2026-07-01/automation-dry-run-macos-daily-v7/automation-execution-report.md`

- 状态：pass
- 计划执行 flow：5
- 已生成 `run.sh`

macOS A1 实跑：

`/Users/qifu/Documents/QbotTestAgent/outputs/qbot-agent-team-review-2026-07-01/automation-run-macos-a1-context-v7/automation-execution-report.md`

- 状态：pass
- 实际执行 flow：`QBOT-CODEX-MAC-CONTEXT-GOVERNANCE-154`
- 真实调用 Qbot 源码：`npm run check`、`npm run build:ui`
- 结果：exit 0，stdout 记录了 context/skills/lint/typecheck/syntax/vite build 成功

Windows daily doctor from macOS：

`/Users/qifu/Documents/QbotTestAgent/outputs/qbot-agent-team-review-2026-07-01/automation-doctor-windows-daily-from-macos-v7/automation-execution-report.md`

- 状态：blocked
- 原因：当前机器是 macOS，不能执行 Windows flow
- 缺失脚本：无
- 缺失 env：无
- 判断：这是正确阻断，不是自动化能力缺失；需要 Windows runner 实机验证

macOS release doctor：

`/Users/qifu/Documents/QbotTestAgent/outputs/qbot-agent-team-review-2026-07-01/automation-doctor-macos-release-v7/automation-execution-report.md`

- doctor 脚本检查：pass
- suite 状态：blocked
- 52 条 release flow 中 22 条可计划，30 条因真实依赖 env 缺失 blocked
- 缺失 env：`ANTHROPIC_BASE_URL`、`ANTHROPIC_API_KEY or ANTHROPIC_AUTH_TOKEN`、`ANTHROPIC_MODEL`、`CODEX_HOME`、`CODEX_PROFILE`、`DEEPBANK_E2E_LINGXI_USERNAME`、`DEEPBANK_E2E_LINGXI_PASSWORD`、`GITLAB_TOKEN`
- 判断：真实依赖缺失不能算 pass，当前阻断符合严格测试标准

## 双端执行命令

macOS daily：

```bash
npm run automation:doctor -- --repo /Users/qifu/Documents/deepbankV2 --flows outputs/qbot-agent-team-review-2026-07-01/latest-live-product-scope-automation-executable-v7/codex-automation-flows.json --out outputs/qbot-agent-team-review-2026-07-01/automation-doctor-macos-daily-v7 --suite daily
npm run automation:run -- --repo /Users/qifu/Documents/deepbankV2 --flows outputs/qbot-agent-team-review-2026-07-01/latest-live-product-scope-automation-executable-v7/codex-automation-flows.json --out outputs/qbot-agent-team-review-2026-07-01/automation-run-macos-daily --suite daily
```

Windows daily，需要在 Windows 机器上执行：

```powershell
npm run automation:doctor -- --repo D:\deepbankV2 --flows D:\QbotTestAgent\outputs\qbot-agent-team-review-2026-07-01\latest-live-product-scope-automation-executable-v7\codex-automation-flows.json --out D:\QbotTestAgent\outputs\automation-doctor-windows-daily --suite daily --os Windows
npm run automation:run -- --repo D:\deepbankV2 --flows D:\QbotTestAgent\outputs\qbot-agent-team-review-2026-07-01\latest-live-product-scope-automation-executable-v7\codex-automation-flows.json --out D:\QbotTestAgent\outputs\automation-run-windows-daily --suite daily --os Windows
```

Windows release：

```powershell
npm run automation:doctor -- --repo D:\deepbankV2 --flows D:\QbotTestAgent\outputs\qbot-agent-team-review-2026-07-01\latest-live-product-scope-automation-executable-v7\codex-automation-flows.json --out D:\QbotTestAgent\outputs\automation-doctor-windows-release --suite release --os Windows
npm run automation:run -- --repo D:\deepbankV2 --flows D:\QbotTestAgent\outputs\qbot-agent-team-review-2026-07-01\latest-live-product-scope-automation-executable-v7\codex-automation-flows.json --out D:\QbotTestAgent\outputs\automation-run-windows-release --suite release --os Windows
```

## 剩余风险

1. 当前 macOS 机器不能证明 Windows flow 实跑通过，只能证明 Windows flow 已生成 PowerShell 脚本、脚本名存在、不会混入 macOS release 命令。
2. Qbot 源码目前有 Windows release artifact verify 能力，但没有等价的 `e2e:release:win` 安装启动 UI 回归脚本。Windows release 当前覆盖到 `release:prepare/build/verify --platform=win`，建议后续 Qbot 项目补一个 Windows installer launch smoke。
3. A2/A3 真实依赖必须提供 env 后才能实跑；缺 env 时应保持 blocked，不能降级成 pass。

## 专家判断

本轮之后，QbotTestAgent 的自动化能力从“计划可读”提升到了“可执行、可 doctor、可 dry-run、可实跑一部分本地 flow”。对开发移交后的执行方案，建议固定为：

`issue-intelligence -> functional cases -> codex automation flows -> automation-doctor -> automation-run -> execution report`

底层自动化继续复用 Qbot 源码自己的 Playwright/Electron/Node wrapper。这样最贴近项目实际，也最利于开发团队维护。
