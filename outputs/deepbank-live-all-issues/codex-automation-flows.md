# Codex Windows/macOS Executable Flow Plan

## QBOT-CODEX-WIN-ASSISTANT-001

- Linked cases: QBOT-FUNC-ASSISTANT-001
- OS: Windows
- Mode: hybrid shell + Electron UI
- Required tools: Codex; PowerShell; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $env:DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
Set-Location $env:DEEPBANK_REPO
npm run check
npm run build:ui
npm run e2e:doctor -- --scope=local
npm run e2e:local
```

### Assertions
The turn streams visibly, reaches a terminal done state, remains resumable, and does not expose runtime internals.
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
If required env, provider, GitLab, Docker, or OS prerequisite is missing, mark blocked/not-run with reason.

## QBOT-CODEX-MAC-ASSISTANT-002

- Linked cases: QBOT-FUNC-ASSISTANT-001
- OS: macOS
- Mode: hybrid shell + Electron UI
- Required tools: Codex; zsh/bash; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
cd "$DEEPBANK_REPO"
npm run check
npm run build:ui
npm run e2e:doctor -- --scope=local
npm run e2e:local
```

### Assertions
The turn streams visibly, reaches a terminal done state, remains resumable, and does not expose runtime internals.
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
If required env, provider, GitLab, Docker, or OS prerequisite is missing, mark blocked/not-run with reason.

## QBOT-CODEX-WIN-RUNTIME-PROTOCOL-003

- Linked cases: QBOT-FUNC-RUNTIME-001
- OS: Windows
- Mode: hybrid shell + Electron UI
- Required tools: Codex; PowerShell; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $env:DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
Set-Location $env:DEEPBANK_REPO
npm run check
npm run codex:doctor
npm run codex:smoke
npm run e2e:doctor -- --scope=local
npm run e2e:local
```

### Assertions
Codex turn completes through the product path with mapped events, sanitized artifacts, and no false claim for SDK-only features.
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
Requires configured Codex/provider path for real evidence.

## QBOT-CODEX-MAC-RUNTIME-PROTOCOL-004

- Linked cases: QBOT-FUNC-RUNTIME-001
- OS: macOS
- Mode: hybrid shell + Electron UI
- Required tools: Codex; zsh/bash; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
cd "$DEEPBANK_REPO"
npm run check
npm run codex:doctor
npm run codex:smoke
npm run e2e:doctor -- --scope=local
npm run e2e:local
```

### Assertions
Codex turn completes through the product path with mapped events, sanitized artifacts, and no false claim for SDK-only features.
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
Requires configured Codex/provider path for real evidence.

## QBOT-CODEX-WIN-SKILLS-MCP-EXPERTS-005

- Linked cases: QBOT-FUNC-SKILLS-001
- OS: Windows
- Mode: shell + Codex CLI/runtime artifacts
- Required tools: Codex; PowerShell; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $env:DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
Set-Location $env:DEEPBANK_REPO
npm run check
npm run codex:doctor
npm run codex:smoke
```

### Assertions
QBot invokes required skills without leaking internals, handles unavailable skills explicitly, and produces a coherent final result.
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
If required env, provider, GitLab, Docker, or OS prerequisite is missing, mark blocked/not-run with reason.

## QBOT-CODEX-MAC-SKILLS-MCP-EXPERTS-006

- Linked cases: QBOT-FUNC-SKILLS-001
- OS: macOS
- Mode: shell + Codex CLI/runtime artifacts
- Required tools: Codex; zsh/bash; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
cd "$DEEPBANK_REPO"
npm run check
npm run codex:doctor
npm run codex:smoke
```

### Assertions
QBot invokes required skills without leaking internals, handles unavailable skills explicitly, and produces a coherent final result.
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
If required env, provider, GitLab, Docker, or OS prerequisite is missing, mark blocked/not-run with reason.

## QBOT-CODEX-WIN-PROJECTS-GITLAB-007

- Linked cases: QBOT-FUNC-PROJECTS-001
- OS: Windows
- Mode: hybrid shell + Electron UI
- Required tools: Codex; PowerShell; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $env:DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
Set-Location $env:DEEPBANK_REPO
npm run check
npm run build:ui
npm run e2e:doctor -- --scope=local
npm run e2e:local
```

### Assertions
Project behaves as a QBot workspace with redacted GitLab evidence and explicit auth/stale/conflict states.
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
Live private GitLab acceptance depends on Lingxi OAuth2 to GitLab token exchange.

## QBOT-CODEX-MAC-PROJECTS-GITLAB-008

- Linked cases: QBOT-FUNC-PROJECTS-001
- OS: macOS
- Mode: hybrid shell + Electron UI
- Required tools: Codex; zsh/bash; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
cd "$DEEPBANK_REPO"
npm run check
npm run build:ui
npm run e2e:doctor -- --scope=local
npm run e2e:local
```

### Assertions
Project behaves as a QBot workspace with redacted GitLab evidence and explicit auth/stale/conflict states.
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
Live private GitLab acceptance depends on Lingxi OAuth2 to GitLab token exchange.

## QBOT-CODEX-WIN-COMPLIANCE-SECURITY-009

- Linked cases: QBOT-SEC-COMPLIANCE-001
- OS: Windows
- Mode: shell
- Required tools: Codex; PowerShell; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $env:DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
Set-Location $env:DEEPBANK_REPO
npm run check
npm run build:ui
```

### Assertions
Compliance tier boundaries are enforced, M4 does not carry prohibited history, and no secrets appear in UI/API/logs.
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
Future-state design until compliance tier implementation lands.

## QBOT-CODEX-MAC-COMPLIANCE-SECURITY-010

- Linked cases: QBOT-SEC-COMPLIANCE-001
- OS: macOS
- Mode: shell
- Required tools: Codex; zsh/bash; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
cd "$DEEPBANK_REPO"
npm run check
npm run build:ui
```

### Assertions
Compliance tier boundaries are enforced, M4 does not carry prohibited history, and no secrets appear in UI/API/logs.
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
Future-state design until compliance tier implementation lands.

## QBOT-CODEX-WIN-E2E-RELEASE-PLATFORM-011

- Linked cases: QBOT-FUNC-E2E-RELEASE-ISSUE-001-MAIN
- OS: Windows
- Mode: hybrid shell + Electron UI
- Required tools: Codex; PowerShell; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $env:DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
Set-Location $env:DEEPBANK_REPO
npm run check
npm run e2e:doctor -- --scope=local
npm run e2e:local
npm run build:desktop
```

### Assertions
## 目的 - 将当前 e2e 从“单个 common 工具文件 + 零散脚本”整理为边界清晰的模块化结构。 - 降低后续增加 local / release / CI 变体时的耦合和认知成本。 - 保持现有对外入口不变：`npm run e2e`、`npm run e2e:local`、`npm run e2e:release:mac`。 ## 当前现状 - Playwright 配置已按 local / release / setup / teardown 分层，入口稳定。 - 运行时编排、进程管理、HTTP/WS、macOS / DMG、Electron 启动等工具集中在 `test/e2e/support/common.mjs`，文件过大且职责混杂。 - setup / spec / teardown 
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
If required env, provider, GitLab, Docker, or OS prerequisite is missing, mark blocked/not-run with reason.

## QBOT-CODEX-MAC-E2E-RELEASE-PLATFORM-012

- Linked cases: QBOT-FUNC-E2E-RELEASE-ISSUE-001-MAIN
- OS: macOS
- Mode: hybrid shell + Electron UI
- Required tools: Codex; zsh/bash; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
cd "$DEEPBANK_REPO"
npm run check
npm run e2e:doctor -- --scope=local
npm run e2e:local
npm run e2e:release:mac
```

### Assertions
## 目的 - 将当前 e2e 从“单个 common 工具文件 + 零散脚本”整理为边界清晰的模块化结构。 - 降低后续增加 local / release / CI 变体时的耦合和认知成本。 - 保持现有对外入口不变：`npm run e2e`、`npm run e2e:local`、`npm run e2e:release:mac`。 ## 当前现状 - Playwright 配置已按 local / release / setup / teardown 分层，入口稳定。 - 运行时编排、进程管理、HTTP/WS、macOS / DMG、Electron 启动等工具集中在 `test/e2e/support/common.mjs`，文件过大且职责混杂。 - setup / spec / teardown 
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
If required env, provider, GitLab, Docker, or OS prerequisite is missing, mark blocked/not-run with reason.

## QBOT-CODEX-WIN-PROJECTS-GITLAB-013

- Linked cases: QBOT-FUNC-PROJECTS-ISSUE-002-MAIN
- OS: Windows
- Mode: hybrid shell + Electron UI
- Required tools: Codex; PowerShell; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $env:DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
Set-Location $env:DEEPBANK_REPO
npm run check
npm run build:ui
npm run e2e:doctor -- --scope=local
npm run e2e:local
```

### Assertions
## 背景与当前项目全貌 ### 当前项目定位 Deepbank v2 当前是一个“本地可跑、云端形态先行”的 embedded agent workbench 原型，核心目标是保持 UI 契约稳定，同时将本地 Electron 体验逐步演进到未来可嵌 Web / 360Teams / 云端控制面的形态。 ### 当前仓库模块梳理 - `src/`：React UI 主体。   - `App.tsx` 负责顶层视图切换与任务/成果面板组合。   - `runtime.tsx` 负责 `window.agent.*` 桥接后的前端运行态、会话切换、WS 事件接收、运行状态展示。   - `components/assistant-ui/` 为对话线程、工具卡、reasoning 等 assistant-ui 适配
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
Requires explicit real-provider environment.

## QBOT-CODEX-MAC-PROJECTS-GITLAB-014

- Linked cases: QBOT-FUNC-PROJECTS-ISSUE-002-MAIN
- OS: macOS
- Mode: hybrid shell + Electron UI
- Required tools: Codex; zsh/bash; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
cd "$DEEPBANK_REPO"
npm run check
npm run build:ui
npm run e2e:doctor -- --scope=local
npm run e2e:local
```

### Assertions
## 背景与当前项目全貌 ### 当前项目定位 Deepbank v2 当前是一个“本地可跑、云端形态先行”的 embedded agent workbench 原型，核心目标是保持 UI 契约稳定，同时将本地 Electron 体验逐步演进到未来可嵌 Web / 360Teams / 云端控制面的形态。 ### 当前仓库模块梳理 - `src/`：React UI 主体。   - `App.tsx` 负责顶层视图切换与任务/成果面板组合。   - `runtime.tsx` 负责 `window.agent.*` 桥接后的前端运行态、会话切换、WS 事件接收、运行状态展示。   - `components/assistant-ui/` 为对话线程、工具卡、reasoning 等 assistant-ui 适配
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
Requires explicit real-provider environment.

## QBOT-CODEX-WIN-PROJECTS-GITLAB-015

- Linked cases: QBOT-NEG-PROJECTS-ISSUE-002-NEG
- OS: Windows
- Mode: hybrid shell + Electron UI
- Required tools: Codex; PowerShell; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $env:DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
Set-Location $env:DEEPBANK_REPO
npm run check
npm run build:ui
npm run e2e:doctor -- --scope=local
npm run e2e:local
```

### Assertions
The product reports blocked/failed/degraded state truthfully and produces no fabricated success evidence.
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
Requires explicit real-provider environment.

## QBOT-CODEX-MAC-PROJECTS-GITLAB-016

- Linked cases: QBOT-NEG-PROJECTS-ISSUE-002-NEG
- OS: macOS
- Mode: hybrid shell + Electron UI
- Required tools: Codex; zsh/bash; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
cd "$DEEPBANK_REPO"
npm run check
npm run build:ui
npm run e2e:doctor -- --scope=local
npm run e2e:local
```

### Assertions
The product reports blocked/failed/degraded state truthfully and produces no fabricated success evidence.
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
Requires explicit real-provider environment.

## QBOT-CODEX-WIN-RUNTIME-PROTOCOL-017

- Linked cases: QBOT-FUNC-RUNTIME-ISSUE-003-MAIN
- OS: Windows
- Mode: hybrid shell + Electron UI
- Required tools: Codex; PowerShell; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $env:DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
Set-Location $env:DEEPBANK_REPO
npm run check
npm run codex:doctor
npm run codex:smoke
npm run e2e:doctor -- --scope=local
npm run e2e:local
```

### Assertions
**Background**: Codex and Claude Code both need explicit, repo-managed local smoke gates, but their real host routing lives in different local configuration surfaces. **Problem to solve**: Make `claude:*` and `codex:*` smoke deterministic from the repository while respecting the local DeepSeek routing sources. The scripts may extract facts from `~/.zshrc` an
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
If required env, provider, GitLab, Docker, or OS prerequisite is missing, mark blocked/not-run with reason.

## QBOT-CODEX-MAC-RUNTIME-PROTOCOL-018

- Linked cases: QBOT-FUNC-RUNTIME-ISSUE-003-MAIN
- OS: macOS
- Mode: hybrid shell + Electron UI
- Required tools: Codex; zsh/bash; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
cd "$DEEPBANK_REPO"
npm run check
npm run codex:doctor
npm run codex:smoke
npm run e2e:doctor -- --scope=local
npm run e2e:local
```

### Assertions
**Background**: Codex and Claude Code both need explicit, repo-managed local smoke gates, but their real host routing lives in different local configuration surfaces. **Problem to solve**: Make `claude:*` and `codex:*` smoke deterministic from the repository while respecting the local DeepSeek routing sources. The scripts may extract facts from `~/.zshrc` an
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
If required env, provider, GitLab, Docker, or OS prerequisite is missing, mark blocked/not-run with reason.

## QBOT-CODEX-WIN-RUNTIME-PROTOCOL-019

- Linked cases: QBOT-FUNC-RUNTIME-ISSUE-004-MAIN
- OS: Windows
- Mode: hybrid shell + Electron UI
- Required tools: Codex; PowerShell; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $env:DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
Set-Location $env:DEEPBANK_REPO
npm run check
npm run codex:doctor
npm run codex:smoke
npm run e2e:doctor -- --scope=local
npm run e2e:local
```

### Assertions
**Background**: Deepbank v2 already has the necessary foundations for a cross-agent development workflow: - `.agent/context.yaml` is the canonical source for generated `AGENTS.md`, `CLAUDE.md`, and scoped context. - `.agent/skills-src/**` is the canonical source for generated Codex and Claude Code skills. - `.gitlab/**` defines issue templates, MR templates,
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
If required env, provider, GitLab, Docker, or OS prerequisite is missing, mark blocked/not-run with reason.

## QBOT-CODEX-MAC-RUNTIME-PROTOCOL-020

- Linked cases: QBOT-FUNC-RUNTIME-ISSUE-004-MAIN
- OS: macOS
- Mode: hybrid shell + Electron UI
- Required tools: Codex; zsh/bash; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
cd "$DEEPBANK_REPO"
npm run check
npm run codex:doctor
npm run codex:smoke
npm run e2e:doctor -- --scope=local
npm run e2e:local
```

### Assertions
**Background**: Deepbank v2 already has the necessary foundations for a cross-agent development workflow: - `.agent/context.yaml` is the canonical source for generated `AGENTS.md`, `CLAUDE.md`, and scoped context. - `.agent/skills-src/**` is the canonical source for generated Codex and Claude Code skills. - `.gitlab/**` defines issue templates, MR templates,
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
If required env, provider, GitLab, Docker, or OS prerequisite is missing, mark blocked/not-run with reason.

## QBOT-CODEX-WIN-ASSISTANT-021

- Linked cases: QBOT-FUNC-ASSISTANT-ISSUE-005-MAIN
- OS: Windows
- Mode: hybrid shell + Electron UI
- Required tools: Codex; PowerShell; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $env:DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
Set-Location $env:DEEPBANK_REPO
npm run check
npm run build:ui
npm run e2e:doctor -- --scope=local
npm run e2e:local
npm run build:desktop
```

### Assertions
**In scope**: - 修复 `server/engine.mjs` 的 turn 结束条件 - 必要时补充 release-http 回归验证说明 **Non-goals**: - 不把产品改成单轮问答 - 不改 renderer 的 chat 交互模式 - 不改变 session / resume 的多轮会话语义
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
If required env, provider, GitLab, Docker, or OS prerequisite is missing, mark blocked/not-run with reason.

## QBOT-CODEX-MAC-ASSISTANT-022

- Linked cases: QBOT-FUNC-ASSISTANT-ISSUE-005-MAIN
- OS: macOS
- Mode: hybrid shell + Electron UI
- Required tools: Codex; zsh/bash; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
cd "$DEEPBANK_REPO"
npm run check
npm run build:ui
npm run e2e:doctor -- --scope=local
npm run e2e:local
npm run e2e:release:mac
```

### Assertions
**In scope**: - 修复 `server/engine.mjs` 的 turn 结束条件 - 必要时补充 release-http 回归验证说明 **Non-goals**: - 不把产品改成单轮问答 - 不改 renderer 的 chat 交互模式 - 不改变 session / resume 的多轮会话语义
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
If required env, provider, GitLab, Docker, or OS prerequisite is missing, mark blocked/not-run with reason.

## QBOT-CODEX-WIN-SKILLS-MCP-EXPERTS-023

- Linked cases: QBOT-FUNC-SKILLS-MCP-ISSUE-006-MAIN
- OS: Windows
- Mode: hybrid shell + Electron UI
- Required tools: Codex; PowerShell; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $env:DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
Set-Location $env:DEEPBANK_REPO
npm run check
npm run codex:doctor
npm run codex:smoke
npm run e2e:doctor -- --scope=local
npm run e2e:local
```

### Assertions
**Background**: Parent: #4 Deepbank v2 has a mature `.gitlab` issue-template set and label taxonomy, but issue creation still depends on ad hoc prompting. The `issue-intake` skill should turn a user's rough request into a reviewable GitLab issue that a top open-source maintainer would accept for planning and implementation. **Current problem**: Agents can cr
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
If required env, provider, GitLab, Docker, or OS prerequisite is missing, mark blocked/not-run with reason.

## QBOT-CODEX-MAC-SKILLS-MCP-EXPERTS-024

- Linked cases: QBOT-FUNC-SKILLS-MCP-ISSUE-006-MAIN
- OS: macOS
- Mode: hybrid shell + Electron UI
- Required tools: Codex; zsh/bash; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
cd "$DEEPBANK_REPO"
npm run check
npm run codex:doctor
npm run codex:smoke
npm run e2e:doctor -- --scope=local
npm run e2e:local
```

### Assertions
**Background**: Parent: #4 Deepbank v2 has a mature `.gitlab` issue-template set and label taxonomy, but issue creation still depends on ad hoc prompting. The `issue-intake` skill should turn a user's rough request into a reviewable GitLab issue that a top open-source maintainer would accept for planning and implementation. **Current problem**: Agents can cr
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
If required env, provider, GitLab, Docker, or OS prerequisite is missing, mark blocked/not-run with reason.

## QBOT-CODEX-WIN-SKILLS-MCP-EXPERTS-025

- Linked cases: QBOT-FUNC-SKILLS-MCP-ISSUE-007-MAIN
- OS: Windows
- Mode: hybrid shell + Electron UI
- Required tools: Codex; PowerShell; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $env:DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
Set-Location $env:DEEPBANK_REPO
npm run check
npm run codex:doctor
npm run codex:smoke
npm run e2e:doctor -- --scope=local
npm run e2e:local
```

### Assertions
**Background**: Parent: #4 The repository's issue templates make issue descriptions the accepted source of truth for scope, plan, and verification. A code agent implementing work should start from an issue, not from loose chat context. **Current problem**: Agents can implement issue-linked work incorrectly when they: - read only the title and not the full is
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
If required env, provider, GitLab, Docker, or OS prerequisite is missing, mark blocked/not-run with reason.

## QBOT-CODEX-MAC-SKILLS-MCP-EXPERTS-026

- Linked cases: QBOT-FUNC-SKILLS-MCP-ISSUE-007-MAIN
- OS: macOS
- Mode: hybrid shell + Electron UI
- Required tools: Codex; zsh/bash; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
cd "$DEEPBANK_REPO"
npm run check
npm run codex:doctor
npm run codex:smoke
npm run e2e:doctor -- --scope=local
npm run e2e:local
```

### Assertions
**Background**: Parent: #4 The repository's issue templates make issue descriptions the accepted source of truth for scope, plan, and verification. A code agent implementing work should start from an issue, not from loose chat context. **Current problem**: Agents can implement issue-linked work incorrectly when they: - read only the title and not the full is
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
If required env, provider, GitLab, Docker, or OS prerequisite is missing, mark blocked/not-run with reason.

## QBOT-CODEX-WIN-SKILLS-MCP-EXPERTS-027

- Linked cases: QBOT-FUNC-SKILLS-MCP-ISSUE-008-MAIN
- OS: Windows
- Mode: hybrid shell + Electron UI
- Required tools: Codex; PowerShell; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $env:DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
Set-Location $env:DEEPBANK_REPO
npm run check
npm run codex:doctor
npm run codex:smoke
npm run e2e:doctor -- --scope=local
npm run e2e:local
```

### Assertions
**Background**: Parent: #4 The repository's MR templates define delivery expectations: linked issue, summary, validation evidence, risk, rollback, and review focus. Agents need a reusable workflow to convert local diffs into high-quality draft MRs without losing issue linkage or validation evidence. **Current problem**: MR creation can become weak or inconsi
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
If required env, provider, GitLab, Docker, or OS prerequisite is missing, mark blocked/not-run with reason.

## QBOT-CODEX-MAC-SKILLS-MCP-EXPERTS-028

- Linked cases: QBOT-FUNC-SKILLS-MCP-ISSUE-008-MAIN
- OS: macOS
- Mode: hybrid shell + Electron UI
- Required tools: Codex; zsh/bash; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
cd "$DEEPBANK_REPO"
npm run check
npm run codex:doctor
npm run codex:smoke
npm run e2e:doctor -- --scope=local
npm run e2e:local
```

### Assertions
**Background**: Parent: #4 The repository's MR templates define delivery expectations: linked issue, summary, validation evidence, risk, rollback, and review focus. Agents need a reusable workflow to convert local diffs into high-quality draft MRs without losing issue linkage or validation evidence. **Current problem**: MR creation can become weak or inconsi
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
If required env, provider, GitLab, Docker, or OS prerequisite is missing, mark blocked/not-run with reason.

## QBOT-CODEX-WIN-SKILLS-MCP-EXPERTS-029

- Linked cases: QBOT-FUNC-SKILLS-MCP-ISSUE-009-MAIN
- OS: Windows
- Mode: hybrid shell + Electron UI
- Required tools: Codex; PowerShell; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $env:DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
Set-Location $env:DEEPBANK_REPO
npm run check
npm run codex:doctor
npm run codex:smoke
npm run e2e:doctor -- --scope=local
npm run e2e:local
```

### Assertions
**Background**: Parent: #4 Code review is a maintainer quality gate. A code agent addressing review should read the MR diff and comments, classify feedback, fix actionable findings, preserve scope discipline, rerun validation, and respond with evidence. **Current problem**: Review response can become unreliable when agents: - read only a summary and not the 
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
If required env, provider, GitLab, Docker, or OS prerequisite is missing, mark blocked/not-run with reason.

## QBOT-CODEX-MAC-SKILLS-MCP-EXPERTS-030

- Linked cases: QBOT-FUNC-SKILLS-MCP-ISSUE-009-MAIN
- OS: macOS
- Mode: hybrid shell + Electron UI
- Required tools: Codex; zsh/bash; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
cd "$DEEPBANK_REPO"
npm run check
npm run codex:doctor
npm run codex:smoke
npm run e2e:doctor -- --scope=local
npm run e2e:local
```

### Assertions
**Background**: Parent: #4 Code review is a maintainer quality gate. A code agent addressing review should read the MR diff and comments, classify feedback, fix actionable findings, preserve scope discipline, rerun validation, and respond with evidence. **Current problem**: Review response can become unreliable when agents: - read only a summary and not the 
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
If required env, provider, GitLab, Docker, or OS prerequisite is missing, mark blocked/not-run with reason.

## QBOT-CODEX-WIN-SKILLS-MCP-EXPERTS-031

- Linked cases: QBOT-FUNC-SKILLS-MCP-ISSUE-010-MAIN
- OS: Windows
- Mode: hybrid shell + Electron UI
- Required tools: Codex; PowerShell; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $env:DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
Set-Location $env:DEEPBANK_REPO
npm run check
npm run codex:doctor
npm run codex:smoke
npm run e2e:doctor -- --scope=local
npm run e2e:local
```

### Assertions
**Background**: Parent: #4 Deepbank v2 uses generated agent context and generated skill projections. The repository already warns agents not to hand-edit generated files and to update canonical sources instead. This governance is important enough to deserve its own reusable skill. **Current problem**: Agents maintaining `.agent` or `.gitlab` assets can make 
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
If required env, provider, GitLab, Docker, or OS prerequisite is missing, mark blocked/not-run with reason.

## QBOT-CODEX-MAC-SKILLS-MCP-EXPERTS-032

- Linked cases: QBOT-FUNC-SKILLS-MCP-ISSUE-010-MAIN
- OS: macOS
- Mode: hybrid shell + Electron UI
- Required tools: Codex; zsh/bash; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
cd "$DEEPBANK_REPO"
npm run check
npm run codex:doctor
npm run codex:smoke
npm run e2e:doctor -- --scope=local
npm run e2e:local
```

### Assertions
**Background**: Parent: #4 Deepbank v2 uses generated agent context and generated skill projections. The repository already warns agents not to hand-edit generated files and to update canonical sources instead. This governance is important enough to deserve its own reusable skill. **Current problem**: Agents maintaining `.agent` or `.gitlab` assets can make 
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
If required env, provider, GitLab, Docker, or OS prerequisite is missing, mark blocked/not-run with reason.

## QBOT-CODEX-WIN-RUNTIME-PROTOCOL-033

- Linked cases: QBOT-FUNC-RUNTIME-ISSUE-011-MAIN
- OS: Windows
- Mode: shell + Codex CLI/runtime artifacts
- Required tools: Codex; PowerShell; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $env:DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
Set-Location $env:DEEPBANK_REPO
npm run check
npm run codex:doctor
npm run codex:smoke
```

### Assertions
**Background**: Deepbank already generates agent context from `.agent/context.yaml` through `scripts/agent-context.mjs`, and the repo already splits root and module scopes. The architecture also depends on a stable `window.agent.*` bridge, `DEEPBANK_HOME`, local SQLite runtime state, Postgres metadata, and multi-turn Claude Agent SDK sessions. A recent relea
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
Requires explicit real-provider environment.

## QBOT-CODEX-MAC-RUNTIME-PROTOCOL-034

- Linked cases: QBOT-FUNC-RUNTIME-ISSUE-011-MAIN
- OS: macOS
- Mode: shell + Codex CLI/runtime artifacts
- Required tools: Codex; zsh/bash; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
cd "$DEEPBANK_REPO"
npm run check
npm run codex:doctor
npm run codex:smoke
```

### Assertions
**Background**: Deepbank already generates agent context from `.agent/context.yaml` through `scripts/agent-context.mjs`, and the repo already splits root and module scopes. The architecture also depends on a stable `window.agent.*` bridge, `DEEPBANK_HOME`, local SQLite runtime state, Postgres metadata, and multi-turn Claude Agent SDK sessions. A recent relea
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
Requires explicit real-provider environment.

## QBOT-CODEX-WIN-RUNTIME-PROTOCOL-035

- Linked cases: QBOT-NEG-RUNTIME-ISSUE-011-NEG
- OS: Windows
- Mode: shell + Codex CLI/runtime artifacts
- Required tools: Codex; PowerShell; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $env:DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
Set-Location $env:DEEPBANK_REPO
npm run check
npm run codex:doctor
npm run codex:smoke
```

### Assertions
The product reports blocked/failed/degraded state truthfully and produces no fabricated success evidence.
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
Requires explicit real-provider environment.

## QBOT-CODEX-MAC-RUNTIME-PROTOCOL-036

- Linked cases: QBOT-NEG-RUNTIME-ISSUE-011-NEG
- OS: macOS
- Mode: shell + Codex CLI/runtime artifacts
- Required tools: Codex; zsh/bash; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
cd "$DEEPBANK_REPO"
npm run check
npm run codex:doctor
npm run codex:smoke
```

### Assertions
The product reports blocked/failed/degraded state truthfully and produces no fabricated success evidence.
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
Requires explicit real-provider environment.

## QBOT-CODEX-WIN-ASSISTANT-037

- Linked cases: QBOT-FUNC-ASSISTANT-ISSUE-012-MAIN
- OS: Windows
- Mode: hybrid shell + Electron UI
- Required tools: Codex; PowerShell; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $env:DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
Set-Location $env:DEEPBANK_REPO
npm run check
npm run build:ui
npm run codex:doctor
npm run codex:smoke
npm run e2e:doctor -- --scope=local
npm run e2e:local
npm run build:desktop
```

### Assertions
**Background**: 当前仓库已经具备 Electron 桌面构建、DMG release e2e、GitLab issue/MR 模板、以及基于 `.agent/skills-src/` 的 repository skill 构建链路，但还没有一套面向 GitLab Release 的 repo-owned workflow、显式 skill、以及与当前技术栈契合的发布脚本。参考仓库 `/Users/wangxiangyu/PycharmProjects/deepbank-cc-marketplace-ws1` 已经沉淀了“短命令 skill + prepare/dry-run/release 分层 + GitLab 发布对象同步”的思路；当前仓库需要吸收这种结构化 workflow，但不能直接搬用
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
Requires explicit real-provider environment.

## QBOT-CODEX-MAC-ASSISTANT-038

- Linked cases: QBOT-FUNC-ASSISTANT-ISSUE-012-MAIN
- OS: macOS
- Mode: hybrid shell + Electron UI
- Required tools: Codex; zsh/bash; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
cd "$DEEPBANK_REPO"
npm run check
npm run build:ui
npm run codex:doctor
npm run codex:smoke
npm run e2e:doctor -- --scope=local
npm run e2e:local
npm run e2e:release:mac
```

### Assertions
**Background**: 当前仓库已经具备 Electron 桌面构建、DMG release e2e、GitLab issue/MR 模板、以及基于 `.agent/skills-src/` 的 repository skill 构建链路，但还没有一套面向 GitLab Release 的 repo-owned workflow、显式 skill、以及与当前技术栈契合的发布脚本。参考仓库 `/Users/wangxiangyu/PycharmProjects/deepbank-cc-marketplace-ws1` 已经沉淀了“短命令 skill + prepare/dry-run/release 分层 + GitLab 发布对象同步”的思路；当前仓库需要吸收这种结构化 workflow，但不能直接搬用
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
Requires explicit real-provider environment.

## QBOT-CODEX-WIN-ASSISTANT-039

- Linked cases: QBOT-NEG-ASSISTANT-ISSUE-012-NEG
- OS: Windows
- Mode: hybrid shell + Electron UI
- Required tools: Codex; PowerShell; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $env:DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
Set-Location $env:DEEPBANK_REPO
npm run check
npm run build:ui
npm run codex:doctor
npm run codex:smoke
npm run e2e:doctor -- --scope=local
npm run e2e:local
npm run build:desktop
```

### Assertions
The product reports blocked/failed/degraded state truthfully and produces no fabricated success evidence.
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
Requires explicit real-provider environment.

## QBOT-CODEX-MAC-ASSISTANT-040

- Linked cases: QBOT-NEG-ASSISTANT-ISSUE-012-NEG
- OS: macOS
- Mode: hybrid shell + Electron UI
- Required tools: Codex; zsh/bash; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
cd "$DEEPBANK_REPO"
npm run check
npm run build:ui
npm run codex:doctor
npm run codex:smoke
npm run e2e:doctor -- --scope=local
npm run e2e:local
npm run e2e:release:mac
```

### Assertions
The product reports blocked/failed/degraded state truthfully and produces no fabricated success evidence.
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
Requires explicit real-provider environment.

## QBOT-CODEX-WIN-SKILLS-MCP-EXPERTS-041

- Linked cases: QBOT-FUNC-SKILLS-MCP-ISSUE-013-MAIN
- OS: Windows
- Mode: shell + Codex CLI/runtime artifacts
- Required tools: Codex; PowerShell; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $env:DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
Set-Location $env:DEEPBANK_REPO
npm run check
npm run codex:doctor
npm run codex:smoke
```

### Assertions
**Background**: Parent design: #4. Related child skill issues: #6, #7, #8, #9, #10. Related draft MR: !5. Deepbank v2 now has a repo-managed GitLab workflow skill suite for Codex and Claude Code. The first version establishes the correct lifecycle surfaces and uses GitLab official CLI `glab` for remote operations. A follow-up refinement is needed to turn the
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
If required env, provider, GitLab, Docker, or OS prerequisite is missing, mark blocked/not-run with reason.

## QBOT-CODEX-MAC-SKILLS-MCP-EXPERTS-042

- Linked cases: QBOT-FUNC-SKILLS-MCP-ISSUE-013-MAIN
- OS: macOS
- Mode: shell + Codex CLI/runtime artifacts
- Required tools: Codex; zsh/bash; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
cd "$DEEPBANK_REPO"
npm run check
npm run codex:doctor
npm run codex:smoke
```

### Assertions
**Background**: Parent design: #4. Related child skill issues: #6, #7, #8, #9, #10. Related draft MR: !5. Deepbank v2 now has a repo-managed GitLab workflow skill suite for Codex and Claude Code. The first version establishes the correct lifecycle surfaces and uses GitLab official CLI `glab` for remote operations. A follow-up refinement is needed to turn the
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
If required env, provider, GitLab, Docker, or OS prerequisite is missing, mark blocked/not-run with reason.

## QBOT-CODEX-WIN-SKILLS-MCP-EXPERTS-043

- Linked cases: QBOT-FUNC-SKILLS-MCP-ISSUE-014-MAIN
- OS: Windows
- Mode: hybrid shell + Electron UI
- Required tools: Codex; PowerShell; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $env:DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
Set-Location $env:DEEPBANK_REPO
npm run check
npm run codex:doctor
npm run codex:smoke
npm run e2e:doctor -- --scope=local
npm run e2e:local
```

### Assertions
**Exact files or paths**: - `.agent/skills-src/mr-delivery/**` - `.agent/skills-src/review-address/**` - `.agent/skills-src/*/references/gitlab-maintainer-workflow.md` - `.gitlab/README.md` - `scripts/gitlab-mr-discussions.mjs` - generated `.agents/skills/**`, `.claude/skills/**`, and `.agent/compiled/skills-manifest.json` **Operational impact**: - MR delive
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
If required env, provider, GitLab, Docker, or OS prerequisite is missing, mark blocked/not-run with reason.

## QBOT-CODEX-MAC-SKILLS-MCP-EXPERTS-044

- Linked cases: QBOT-FUNC-SKILLS-MCP-ISSUE-014-MAIN
- OS: macOS
- Mode: hybrid shell + Electron UI
- Required tools: Codex; zsh/bash; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
cd "$DEEPBANK_REPO"
npm run check
npm run codex:doctor
npm run codex:smoke
npm run e2e:doctor -- --scope=local
npm run e2e:local
```

### Assertions
**Exact files or paths**: - `.agent/skills-src/mr-delivery/**` - `.agent/skills-src/review-address/**` - `.agent/skills-src/*/references/gitlab-maintainer-workflow.md` - `.gitlab/README.md` - `scripts/gitlab-mr-discussions.mjs` - generated `.agents/skills/**`, `.claude/skills/**`, and `.agent/compiled/skills-manifest.json` **Operational impact**: - MR delive
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
If required env, provider, GitLab, Docker, or OS prerequisite is missing, mark blocked/not-run with reason.

## QBOT-CODEX-WIN-PROJECTS-GITLAB-045

- Linked cases: QBOT-FUNC-PROJECTS-ISSUE-015-MAIN
- OS: Windows
- Mode: hybrid shell + Electron UI
- Required tools: Codex; PowerShell; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $env:DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
Set-Location $env:DEEPBANK_REPO
npm run check
npm run build:ui
npm run e2e:doctor -- --scope=local
npm run e2e:local
```

### Assertions
**Background**: Deepbank v2 需要在不依赖 Teams 侧接入的前提下，作为完整且独立可运行的 app 形态具备真实登录能力。 **Problem or task**: 当前仍是 `local-user` / `uid` mock，HTTP/WS 只做了透传，没有标准 OAuth2、没有 Lingxi provider、没有组织信息绑定，导致用户身份、权限边界、重启恢复都不成立。 **Desired outcome**: 用户可以通过浏览器完成标准 OAuth2 登录，系统用 refresh token 恢复会话；按 `domainAccount` 绑定平台用户，并持久化 `companyEmail` / `mdmCode` / `deptCode` / `deptName` / 部门
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
Lingxi OAuth2 to GitLab token exchange dependency.

## QBOT-CODEX-MAC-PROJECTS-GITLAB-046

- Linked cases: QBOT-FUNC-PROJECTS-ISSUE-015-MAIN
- OS: macOS
- Mode: hybrid shell + Electron UI
- Required tools: Codex; zsh/bash; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
cd "$DEEPBANK_REPO"
npm run check
npm run build:ui
npm run e2e:doctor -- --scope=local
npm run e2e:local
```

### Assertions
**Background**: Deepbank v2 需要在不依赖 Teams 侧接入的前提下，作为完整且独立可运行的 app 形态具备真实登录能力。 **Problem or task**: 当前仍是 `local-user` / `uid` mock，HTTP/WS 只做了透传，没有标准 OAuth2、没有 Lingxi provider、没有组织信息绑定，导致用户身份、权限边界、重启恢复都不成立。 **Desired outcome**: 用户可以通过浏览器完成标准 OAuth2 登录，系统用 refresh token 恢复会话；按 `domainAccount` 绑定平台用户，并持久化 `companyEmail` / `mdmCode` / `deptCode` / `deptName` / 部门
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
Lingxi OAuth2 to GitLab token exchange dependency.

## QBOT-CODEX-WIN-PROJECTS-GITLAB-047

- Linked cases: QBOT-NEG-PROJECTS-ISSUE-015-NEG
- OS: Windows
- Mode: hybrid shell + Electron UI
- Required tools: Codex; PowerShell; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $env:DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
Set-Location $env:DEEPBANK_REPO
npm run check
npm run build:ui
npm run e2e:doctor -- --scope=local
npm run e2e:local
```

### Assertions
The product reports blocked/failed/degraded state truthfully and produces no fabricated success evidence.
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
Lingxi OAuth2 to GitLab token exchange dependency.

## QBOT-CODEX-MAC-PROJECTS-GITLAB-048

- Linked cases: QBOT-NEG-PROJECTS-ISSUE-015-NEG
- OS: macOS
- Mode: hybrid shell + Electron UI
- Required tools: Codex; zsh/bash; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
cd "$DEEPBANK_REPO"
npm run check
npm run build:ui
npm run e2e:doctor -- --scope=local
npm run e2e:local
```

### Assertions
The product reports blocked/failed/degraded state truthfully and produces no fabricated success evidence.
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
Lingxi OAuth2 to GitLab token exchange dependency.

## QBOT-CODEX-WIN-SKILLS-MCP-EXPERTS-049

- Linked cases: QBOT-FUNC-SKILLS-MCP-ISSUE-016-MAIN
- OS: Windows
- Mode: hybrid shell + Electron UI
- Required tools: Codex; PowerShell; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $env:DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
Set-Location $env:DEEPBANK_REPO
npm run check
npm run codex:doctor
npm run codex:smoke
npm run e2e:doctor -- --scope=local
npm run e2e:local
npm run build:desktop
```

### Assertions
- [x] `npm run skills:build` - [x] `npm run skills:check` - [x] `npm run check` - [x] `node --test scripts/release/lib.test.mjs` - [x] `npm run release:prepare -- --channel=alpha --version 0.0.1-alpha.1` - [x] `npm run release:build -- --channel=alpha --version 0.0.1-alpha.1` - [x] `npm run release:publish -- --channel=alpha --version 0.0.1-alpha.1 --dry-run
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
If required env, provider, GitLab, Docker, or OS prerequisite is missing, mark blocked/not-run with reason.

## QBOT-CODEX-MAC-SKILLS-MCP-EXPERTS-050

- Linked cases: QBOT-FUNC-SKILLS-MCP-ISSUE-016-MAIN
- OS: macOS
- Mode: hybrid shell + Electron UI
- Required tools: Codex; zsh/bash; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
cd "$DEEPBANK_REPO"
npm run check
npm run codex:doctor
npm run codex:smoke
npm run e2e:doctor -- --scope=local
npm run e2e:local
npm run e2e:release:mac
```

### Assertions
- [x] `npm run skills:build` - [x] `npm run skills:check` - [x] `npm run check` - [x] `node --test scripts/release/lib.test.mjs` - [x] `npm run release:prepare -- --channel=alpha --version 0.0.1-alpha.1` - [x] `npm run release:build -- --channel=alpha --version 0.0.1-alpha.1` - [x] `npm run release:publish -- --channel=alpha --version 0.0.1-alpha.1 --dry-run
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
If required env, provider, GitLab, Docker, or OS prerequisite is missing, mark blocked/not-run with reason.

## QBOT-CODEX-WIN-PROJECTS-GITLAB-051

- Linked cases: QBOT-FUNC-PROJECTS-ISSUE-017-MAIN
- OS: Windows
- Mode: hybrid shell + Electron UI
- Required tools: Codex; PowerShell; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $env:DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
Set-Location $env:DEEPBANK_REPO
npm run check
npm run build:ui
npm run e2e:doctor -- --scope=local
npm run e2e:local
```

### Assertions
**Background**: Milestone `Deepbank v2 最终形态里程碑` 已明确写出产品边界：Deepbank 不是另一套 Teams，Teams 已经具备的 IM / 待办 / T5T / 云文档 / 日程 / 我的团队 / 通讯录，不应在 Deepbank 里再做一级产品功能。 `docs/360teams-integration.md` 和 `docs/product-overview.md` 也已经给出一致方向：Deepbank 要保持独立可运行，但对 Teams 只能做薄嵌入、跳转、登录态透传和必要上下文传递。 **Current problem**: 仓库里仍然混有一部分 Teams-like 外壳和占位页面，容易继续把 Deepbank 做成“第二个 Teams 的壳”： -
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
Requires explicit real-provider environment.

## QBOT-CODEX-MAC-PROJECTS-GITLAB-052

- Linked cases: QBOT-FUNC-PROJECTS-ISSUE-017-MAIN
- OS: macOS
- Mode: hybrid shell + Electron UI
- Required tools: Codex; zsh/bash; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
cd "$DEEPBANK_REPO"
npm run check
npm run build:ui
npm run e2e:doctor -- --scope=local
npm run e2e:local
```

### Assertions
**Background**: Milestone `Deepbank v2 最终形态里程碑` 已明确写出产品边界：Deepbank 不是另一套 Teams，Teams 已经具备的 IM / 待办 / T5T / 云文档 / 日程 / 我的团队 / 通讯录，不应在 Deepbank 里再做一级产品功能。 `docs/360teams-integration.md` 和 `docs/product-overview.md` 也已经给出一致方向：Deepbank 要保持独立可运行，但对 Teams 只能做薄嵌入、跳转、登录态透传和必要上下文传递。 **Current problem**: 仓库里仍然混有一部分 Teams-like 外壳和占位页面，容易继续把 Deepbank 做成“第二个 Teams 的壳”： -
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
Requires explicit real-provider environment.

## QBOT-CODEX-WIN-PROJECTS-GITLAB-053

- Linked cases: QBOT-NEG-PROJECTS-ISSUE-017-NEG
- OS: Windows
- Mode: hybrid shell + Electron UI
- Required tools: Codex; PowerShell; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $env:DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
Set-Location $env:DEEPBANK_REPO
npm run check
npm run build:ui
npm run e2e:doctor -- --scope=local
npm run e2e:local
```

### Assertions
The product reports blocked/failed/degraded state truthfully and produces no fabricated success evidence.
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
Requires explicit real-provider environment.

## QBOT-CODEX-MAC-PROJECTS-GITLAB-054

- Linked cases: QBOT-NEG-PROJECTS-ISSUE-017-NEG
- OS: macOS
- Mode: hybrid shell + Electron UI
- Required tools: Codex; zsh/bash; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
cd "$DEEPBANK_REPO"
npm run check
npm run build:ui
npm run e2e:doctor -- --scope=local
npm run e2e:local
```

### Assertions
The product reports blocked/failed/degraded state truthfully and produces no fabricated success evidence.
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
Requires explicit real-provider environment.

## QBOT-CODEX-WIN-RUNTIME-PROTOCOL-055

- Linked cases: QBOT-FUNC-RUNTIME-ISSUE-018-MAIN
- OS: Windows
- Mode: hybrid shell + Electron UI
- Required tools: Codex; PowerShell; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $env:DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
Set-Location $env:DEEPBANK_REPO
npm run check
npm run codex:doctor
npm run codex:smoke
npm run e2e:doctor -- --scope=local
npm run e2e:local
```

### Assertions
**Background**: - Milestone #1 把 Deepbank v2 的最终形态定义为统一 `window.agent.*` 契约的 agent workbench，其中“云端 agent runtime 打通”是项目任务上云的关键前置。 - 当前仓库已经把目标蓝图收敛为“控制面 / 执行面”分离：个人任务保持本地，项目任务在绑定 runtime 后走远端 ADK runtime。 - 本地开发依赖的 ADK 仓库路径是 `/Users/wangxiangyu/PycharmProjects/deepbank-adk-master/adk`，后续联调与验证都以这份本地 checkout 为准。 **Problem or task**: - 需要把 Deepbank 的项目任务从本地双目录执行
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
If required env, provider, GitLab, Docker, or OS prerequisite is missing, mark blocked/not-run with reason.

## QBOT-CODEX-MAC-RUNTIME-PROTOCOL-056

- Linked cases: QBOT-FUNC-RUNTIME-ISSUE-018-MAIN
- OS: macOS
- Mode: hybrid shell + Electron UI
- Required tools: Codex; zsh/bash; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
cd "$DEEPBANK_REPO"
npm run check
npm run codex:doctor
npm run codex:smoke
npm run e2e:doctor -- --scope=local
npm run e2e:local
```

### Assertions
**Background**: - Milestone #1 把 Deepbank v2 的最终形态定义为统一 `window.agent.*` 契约的 agent workbench，其中“云端 agent runtime 打通”是项目任务上云的关键前置。 - 当前仓库已经把目标蓝图收敛为“控制面 / 执行面”分离：个人任务保持本地，项目任务在绑定 runtime 后走远端 ADK runtime。 - 本地开发依赖的 ADK 仓库路径是 `/Users/wangxiangyu/PycharmProjects/deepbank-adk-master/adk`，后续联调与验证都以这份本地 checkout 为准。 **Problem or task**: - 需要把 Deepbank 的项目任务从本地双目录执行
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
If required env, provider, GitLab, Docker, or OS prerequisite is missing, mark blocked/not-run with reason.

## QBOT-CODEX-WIN-UI-UX-057

- Linked cases: QBOT-FUNC-UIUX-ISSUE-019-MAIN
- OS: Windows
- Mode: hybrid shell + Electron UI
- Required tools: Codex; PowerShell; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $env:DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
Set-Location $env:DEEPBANK_REPO
npm run check
npm run build:ui
npm run e2e:doctor -- --scope=local
npm run e2e:local
npm run build:desktop
```

### Assertions
**Background**: `#15` 已把 Lingxi OAuth2 / org / PG 依赖正式带入 standalone runtime；`#16` 已把 alpha/stable internal GitLab Release page 打通；`#17` 明确 Deepbank 保持独立 workbench，Teams 只做薄桥接；`#18` 承接项目任务的云端 ADK runtime server pod；`#20` 承接 Deepbank remote control-plane server，把 PG、OAuth/org、provider/config/secret 收敛到服务端。 本 issue 的方向已重构：`bundled-server` 方案完全废弃。桌面 DMG 不再打包或启动 
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
Requires explicit real-provider environment.

## QBOT-CODEX-MAC-UI-UX-058

- Linked cases: QBOT-FUNC-UIUX-ISSUE-019-MAIN
- OS: macOS
- Mode: hybrid shell + Electron UI
- Required tools: Codex; zsh/bash; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
cd "$DEEPBANK_REPO"
npm run check
npm run build:ui
npm run e2e:doctor -- --scope=local
npm run e2e:local
npm run e2e:release:mac
```

### Assertions
**Background**: `#15` 已把 Lingxi OAuth2 / org / PG 依赖正式带入 standalone runtime；`#16` 已把 alpha/stable internal GitLab Release page 打通；`#17` 明确 Deepbank 保持独立 workbench，Teams 只做薄桥接；`#18` 承接项目任务的云端 ADK runtime server pod；`#20` 承接 Deepbank remote control-plane server，把 PG、OAuth/org、provider/config/secret 收敛到服务端。 本 issue 的方向已重构：`bundled-server` 方案完全废弃。桌面 DMG 不再打包或启动 
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
Requires explicit real-provider environment.

## QBOT-CODEX-WIN-UI-UX-059

- Linked cases: QBOT-NEG-UIUX-ISSUE-019-NEG
- OS: Windows
- Mode: hybrid shell + Electron UI
- Required tools: Codex; PowerShell; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $env:DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
Set-Location $env:DEEPBANK_REPO
npm run check
npm run build:ui
npm run e2e:doctor -- --scope=local
npm run e2e:local
npm run build:desktop
```

### Assertions
The product reports blocked/failed/degraded state truthfully and produces no fabricated success evidence.
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
Requires explicit real-provider environment.

## QBOT-CODEX-MAC-UI-UX-060

- Linked cases: QBOT-NEG-UIUX-ISSUE-019-NEG
- OS: macOS
- Mode: hybrid shell + Electron UI
- Required tools: Codex; zsh/bash; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
cd "$DEEPBANK_REPO"
npm run check
npm run build:ui
npm run e2e:doctor -- --scope=local
npm run e2e:local
npm run e2e:release:mac
```

### Assertions
The product reports blocked/failed/degraded state truthfully and produces no fabricated success evidence.
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
Requires explicit real-provider environment.

## QBOT-CODEX-WIN-PROJECTS-GITLAB-061

- Linked cases: QBOT-FUNC-PROJECTS-ISSUE-020-MAIN
- OS: Windows
- Mode: hybrid shell + Electron UI
- Required tools: Codex; PowerShell; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $env:DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
Set-Location $env:DEEPBANK_REPO
npm run check
npm run build:ui
npm run e2e:doctor -- --scope=local
npm run e2e:local
```

### Assertions
**Background**: `#15` 已经把 Lingxi OAuth2、组织信息绑定和 Postgres 管理数据变成 Deepbank standalone runtime 的真实依赖；`#16` 已经打通 internal GitLab Release / DMG 发布面；`#17` 明确 Deepbank 不是 Teams 原生域复制品，而是独立 workbench + Teams 薄桥接。 现在方向有重大调整：`bundled-server` 形态废弃，桌面 DMG 不再内置并启动完整 `server/index.mjs` 控制面，也不再把 PG、Lingxi、org、provider master secret 这类共享配置分发到客户端。Deepbank 需要建设一个独立的 remote co
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
Requires explicit real-provider environment.

## QBOT-CODEX-MAC-PROJECTS-GITLAB-062

- Linked cases: QBOT-FUNC-PROJECTS-ISSUE-020-MAIN
- OS: macOS
- Mode: hybrid shell + Electron UI
- Required tools: Codex; zsh/bash; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
cd "$DEEPBANK_REPO"
npm run check
npm run build:ui
npm run e2e:doctor -- --scope=local
npm run e2e:local
```

### Assertions
**Background**: `#15` 已经把 Lingxi OAuth2、组织信息绑定和 Postgres 管理数据变成 Deepbank standalone runtime 的真实依赖；`#16` 已经打通 internal GitLab Release / DMG 发布面；`#17` 明确 Deepbank 不是 Teams 原生域复制品，而是独立 workbench + Teams 薄桥接。 现在方向有重大调整：`bundled-server` 形态废弃，桌面 DMG 不再内置并启动完整 `server/index.mjs` 控制面，也不再把 PG、Lingxi、org、provider master secret 这类共享配置分发到客户端。Deepbank 需要建设一个独立的 remote co
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
Requires explicit real-provider environment.

## QBOT-CODEX-WIN-PROJECTS-GITLAB-063

- Linked cases: QBOT-NEG-PROJECTS-ISSUE-020-NEG
- OS: Windows
- Mode: hybrid shell + Electron UI
- Required tools: Codex; PowerShell; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $env:DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
Set-Location $env:DEEPBANK_REPO
npm run check
npm run build:ui
npm run e2e:doctor -- --scope=local
npm run e2e:local
```

### Assertions
The product reports blocked/failed/degraded state truthfully and produces no fabricated success evidence.
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
Requires explicit real-provider environment.

## QBOT-CODEX-MAC-PROJECTS-GITLAB-064

- Linked cases: QBOT-NEG-PROJECTS-ISSUE-020-NEG
- OS: macOS
- Mode: hybrid shell + Electron UI
- Required tools: Codex; zsh/bash; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
cd "$DEEPBANK_REPO"
npm run check
npm run build:ui
npm run e2e:doctor -- --scope=local
npm run e2e:local
```

### Assertions
The product reports blocked/failed/degraded state truthfully and produces no fabricated success evidence.
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
Requires explicit real-provider environment.

## QBOT-CODEX-WIN-RUNTIME-PROTOCOL-065

- Linked cases: QBOT-FUNC-RUNTIME-ISSUE-021-MAIN
- OS: Windows
- Mode: hybrid shell + Electron UI
- Required tools: Codex; PowerShell; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $env:DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
Set-Location $env:DEEPBANK_REPO
npm run check
npm run build:ui
npm run codex:doctor
npm run codex:smoke
npm run e2e:doctor -- --scope=local
npm run e2e:local
```

### Assertions
**Background**: - 总体里程碑：[Deepbank v2 最终形态里程碑](https://gitlab.daikuan.qihoo.net/songrongxin/deepbankv2/-/milestones/1)。 - `#19` / `#20` 已经把 control-plane / release 边界拆开；这个 issue 处理的是另一条主干：deepbankv2 的 agent runtime execution layer 目前只有 Claude Code，需要把 runtime 本身抽象出来，支持 Claude Code / Codex SDK 两个 runtime family。 - 当前代码里，真正执行 turn 的路径仍然硬编码在 Claude Agent SDK 上；C
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
If required env, provider, GitLab, Docker, or OS prerequisite is missing, mark blocked/not-run with reason.

## QBOT-CODEX-MAC-RUNTIME-PROTOCOL-066

- Linked cases: QBOT-FUNC-RUNTIME-ISSUE-021-MAIN
- OS: macOS
- Mode: hybrid shell + Electron UI
- Required tools: Codex; zsh/bash; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
cd "$DEEPBANK_REPO"
npm run check
npm run build:ui
npm run codex:doctor
npm run codex:smoke
npm run e2e:doctor -- --scope=local
npm run e2e:local
```

### Assertions
**Background**: - 总体里程碑：[Deepbank v2 最终形态里程碑](https://gitlab.daikuan.qihoo.net/songrongxin/deepbankv2/-/milestones/1)。 - `#19` / `#20` 已经把 control-plane / release 边界拆开；这个 issue 处理的是另一条主干：deepbankv2 的 agent runtime execution layer 目前只有 Claude Code，需要把 runtime 本身抽象出来，支持 Claude Code / Codex SDK 两个 runtime family。 - 当前代码里，真正执行 turn 的路径仍然硬编码在 Claude Agent SDK 上；C
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
If required env, provider, GitLab, Docker, or OS prerequisite is missing, mark blocked/not-run with reason.

## QBOT-CODEX-WIN-UI-UX-067

- Linked cases: QBOT-FUNC-UIUX-ISSUE-022-MAIN
- OS: Windows
- Mode: hybrid shell + Electron UI
- Required tools: Codex; PowerShell; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $env:DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
Set-Location $env:DEEPBANK_REPO
npm run check
npm run build:ui
```

### Assertions
**Background**: 总体里程碑 [Deepbank v2 最终形态里程碑](https://gitlab.daikuan.qihoo.net/songrongxin/deepbankv2/-/milestones/1) 已经把最终产品形态说清楚了：deepbankv2 要既能独立运行，又能被 360Teams 以独立 Electron 进程形态嵌入；控制面和 runtime 走 remote-server / direct-runtime 的路线，Teams 只应该是宿主入口，而不是业务运行时。 这里需要额外澄清一个关键事实，避免后续实现走偏： - deepbankv2 仓库里现有的 `teams360` 相关内容，属于**早期为了演示“deepbankv2 能被宿主嵌入”而留下的过时 demo 产
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
Requires explicit real-provider environment.

## QBOT-CODEX-MAC-UI-UX-068

- Linked cases: QBOT-FUNC-UIUX-ISSUE-022-MAIN
- OS: macOS
- Mode: hybrid shell + Electron UI
- Required tools: Codex; zsh/bash; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
cd "$DEEPBANK_REPO"
npm run check
npm run build:ui
```

### Assertions
**Background**: 总体里程碑 [Deepbank v2 最终形态里程碑](https://gitlab.daikuan.qihoo.net/songrongxin/deepbankv2/-/milestones/1) 已经把最终产品形态说清楚了：deepbankv2 要既能独立运行，又能被 360Teams 以独立 Electron 进程形态嵌入；控制面和 runtime 走 remote-server / direct-runtime 的路线，Teams 只应该是宿主入口，而不是业务运行时。 这里需要额外澄清一个关键事实，避免后续实现走偏： - deepbankv2 仓库里现有的 `teams360` 相关内容，属于**早期为了演示“deepbankv2 能被宿主嵌入”而留下的过时 demo 产
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
Requires explicit real-provider environment.

## QBOT-CODEX-WIN-UI-UX-069

- Linked cases: QBOT-NEG-UIUX-ISSUE-022-NEG
- OS: Windows
- Mode: hybrid shell + Electron UI
- Required tools: Codex; PowerShell; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $env:DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
Set-Location $env:DEEPBANK_REPO
npm run check
npm run build:ui
```

### Assertions
The product reports blocked/failed/degraded state truthfully and produces no fabricated success evidence.
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
Requires explicit real-provider environment.

## QBOT-CODEX-MAC-UI-UX-070

- Linked cases: QBOT-NEG-UIUX-ISSUE-022-NEG
- OS: macOS
- Mode: hybrid shell + Electron UI
- Required tools: Codex; zsh/bash; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
cd "$DEEPBANK_REPO"
npm run check
npm run build:ui
```

### Assertions
The product reports blocked/failed/degraded state truthfully and produces no fabricated success evidence.
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
Requires explicit real-provider environment.

## QBOT-CODEX-WIN-PROJECTS-GITLAB-071

- Linked cases: QBOT-FUNC-PROJECTS-ISSUE-023-MAIN
- OS: Windows
- Mode: hybrid shell + Electron UI
- Required tools: Codex; PowerShell; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $env:DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
Set-Location $env:DEEPBANK_REPO
npm run check
npm run build:ui
npm run e2e:doctor -- --scope=local
npm run e2e:local
```

### Assertions
**Background**: - `#20` 已经把 remote control-plane server、PG、secret 边界和 release-only 验证路径立起来了，但 `Config Center` 这条线仍然残留一部分 local SQLite 事实来源。 - 现状里，`server/localdb.mjs` 仍在持久化 `scenes`、`roleScenes`、`userRole`、`thirdParty`；`server/index.mjs` 也还在通过 `/api/config/*` 直接读写这些 localdb 数据。 - 与此相对，`assistant-config`、`projects`、`workspaces`、runtime registry/binding、auth/p
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
Requires explicit real-provider environment.

## QBOT-CODEX-MAC-PROJECTS-GITLAB-072

- Linked cases: QBOT-FUNC-PROJECTS-ISSUE-023-MAIN
- OS: macOS
- Mode: hybrid shell + Electron UI
- Required tools: Codex; zsh/bash; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
cd "$DEEPBANK_REPO"
npm run check
npm run build:ui
npm run e2e:doctor -- --scope=local
npm run e2e:local
```

### Assertions
**Background**: - `#20` 已经把 remote control-plane server、PG、secret 边界和 release-only 验证路径立起来了，但 `Config Center` 这条线仍然残留一部分 local SQLite 事实来源。 - 现状里，`server/localdb.mjs` 仍在持久化 `scenes`、`roleScenes`、`userRole`、`thirdParty`；`server/index.mjs` 也还在通过 `/api/config/*` 直接读写这些 localdb 数据。 - 与此相对，`assistant-config`、`projects`、`workspaces`、runtime registry/binding、auth/p
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
Requires explicit real-provider environment.

## QBOT-CODEX-WIN-PROJECTS-GITLAB-073

- Linked cases: QBOT-NEG-PROJECTS-ISSUE-023-NEG
- OS: Windows
- Mode: hybrid shell + Electron UI
- Required tools: Codex; PowerShell; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $env:DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
Set-Location $env:DEEPBANK_REPO
npm run check
npm run build:ui
npm run e2e:doctor -- --scope=local
npm run e2e:local
```

### Assertions
The product reports blocked/failed/degraded state truthfully and produces no fabricated success evidence.
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
Requires explicit real-provider environment.

## QBOT-CODEX-MAC-PROJECTS-GITLAB-074

- Linked cases: QBOT-NEG-PROJECTS-ISSUE-023-NEG
- OS: macOS
- Mode: hybrid shell + Electron UI
- Required tools: Codex; zsh/bash; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
cd "$DEEPBANK_REPO"
npm run check
npm run build:ui
npm run e2e:doctor -- --scope=local
npm run e2e:local
```

### Assertions
The product reports blocked/failed/degraded state truthfully and produces no fabricated success evidence.
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
Requires explicit real-provider environment.

## QBOT-CODEX-WIN-SKILLS-MCP-EXPERTS-075

- Linked cases: QBOT-FUNC-SKILLS-MCP-ISSUE-024-MAIN
- OS: Windows
- Mode: hybrid shell + Electron UI
- Required tools: Codex; PowerShell; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $env:DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
Set-Location $env:DEEPBANK_REPO
npm run check
npm run codex:doctor
npm run codex:smoke
npm run e2e:doctor -- --scope=local
npm run e2e:local
```

### Assertions
Bring the repository-owned `$desktop-release` skill guidance in line with the accepted #19 remote-server-only release contract and the #20/#25 remote control-plane changes.
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
If required env, provider, GitLab, Docker, or OS prerequisite is missing, mark blocked/not-run with reason.

## QBOT-CODEX-MAC-SKILLS-MCP-EXPERTS-076

- Linked cases: QBOT-FUNC-SKILLS-MCP-ISSUE-024-MAIN
- OS: macOS
- Mode: hybrid shell + Electron UI
- Required tools: Codex; zsh/bash; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
cd "$DEEPBANK_REPO"
npm run check
npm run codex:doctor
npm run codex:smoke
npm run e2e:doctor -- --scope=local
npm run e2e:local
```

### Assertions
Bring the repository-owned `$desktop-release` skill guidance in line with the accepted #19 remote-server-only release contract and the #20/#25 remote control-plane changes.
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
If required env, provider, GitLab, Docker, or OS prerequisite is missing, mark blocked/not-run with reason.

## QBOT-CODEX-WIN-RUNTIME-PROTOCOL-077

- Linked cases: QBOT-FUNC-RUNTIME-ISSUE-025-MAIN
- OS: Windows
- Mode: hybrid shell + Electron UI
- Required tools: Codex; PowerShell; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $env:DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
Set-Location $env:DEEPBANK_REPO
npm run check
npm run build:ui
npm run codex:doctor
npm run codex:smoke
npm run e2e:doctor -- --scope=local
npm run e2e:local
```

### Assertions
**Background**: - `#20` is moving Deepbank toward an independent remote control-plane server. The desktop app should connect to a remote HTTP/WS control plane instead of carrying a bundled server or server-side secrets. - Current local verification already proves a Docker-built `server/Dockerfile` image can run with Postgres and be consumed by the local Elec
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
If required env, provider, GitLab, Docker, or OS prerequisite is missing, mark blocked/not-run with reason.

## QBOT-CODEX-MAC-RUNTIME-PROTOCOL-078

- Linked cases: QBOT-FUNC-RUNTIME-ISSUE-025-MAIN
- OS: macOS
- Mode: hybrid shell + Electron UI
- Required tools: Codex; zsh/bash; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
cd "$DEEPBANK_REPO"
npm run check
npm run build:ui
npm run codex:doctor
npm run codex:smoke
npm run e2e:doctor -- --scope=local
npm run e2e:local
```

### Assertions
**Background**: - `#20` is moving Deepbank toward an independent remote control-plane server. The desktop app should connect to a remote HTTP/WS control plane instead of carrying a bundled server or server-side secrets. - Current local verification already proves a Docker-built `server/Dockerfile` image can run with Postgres and be consumed by the local Elec
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
If required env, provider, GitLab, Docker, or OS prerequisite is missing, mark blocked/not-run with reason.

## QBOT-CODEX-WIN-E2E-RELEASE-PLATFORM-079

- Linked cases: QBOT-FUNC-E2E-RELEASE-ISSUE-026-MAIN
- OS: Windows
- Mode: hybrid shell + Electron UI
- Required tools: Codex; PowerShell; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $env:DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
Set-Location $env:DEEPBANK_REPO
npm run check
npm run e2e:doctor -- --scope=local
npm run e2e:local
npm run build:desktop
```

### Assertions
Provide a live internal dev public descriptor so the dev release verify command can complete against a real remote control-plane instead of the committed placeholder slot.
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
If required env, provider, GitLab, Docker, or OS prerequisite is missing, mark blocked/not-run with reason.

## QBOT-CODEX-MAC-E2E-RELEASE-PLATFORM-080

- Linked cases: QBOT-FUNC-E2E-RELEASE-ISSUE-026-MAIN
- OS: macOS
- Mode: hybrid shell + Electron UI
- Required tools: Codex; zsh/bash; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
cd "$DEEPBANK_REPO"
npm run check
npm run e2e:doctor -- --scope=local
npm run e2e:local
npm run e2e:release:mac
```

### Assertions
Provide a live internal dev public descriptor so the dev release verify command can complete against a real remote control-plane instead of the committed placeholder slot.
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
If required env, provider, GitLab, Docker, or OS prerequisite is missing, mark blocked/not-run with reason.

## QBOT-CODEX-WIN-SKILLS-MCP-EXPERTS-081

- Linked cases: QBOT-FUNC-SKILLS-MCP-ISSUE-027-MAIN
- OS: Windows
- Mode: shell + Codex CLI/runtime artifacts
- Required tools: Codex; PowerShell; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $env:DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
Set-Location $env:DEEPBANK_REPO
npm run check
npm run codex:doctor
npm run codex:smoke
```

### Assertions
**Exact files or paths**: - `.agent/skills-src/agent-context-audit/**` - `.agent/skills-src/agent-governance-maintenance/skill.yaml` - `.agent/skills-src/issue-implement/skill.yaml` - generated skill projections under `.agents/skills/**`, `.claude/skills/**`, and `.agent/compiled/skills-manifest.json` **Operational impact**: - none for runtime behavior - imp
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
If required env, provider, GitLab, Docker, or OS prerequisite is missing, mark blocked/not-run with reason.

## QBOT-CODEX-MAC-SKILLS-MCP-EXPERTS-082

- Linked cases: QBOT-FUNC-SKILLS-MCP-ISSUE-027-MAIN
- OS: macOS
- Mode: shell + Codex CLI/runtime artifacts
- Required tools: Codex; zsh/bash; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
cd "$DEEPBANK_REPO"
npm run check
npm run codex:doctor
npm run codex:smoke
```

### Assertions
**Exact files or paths**: - `.agent/skills-src/agent-context-audit/**` - `.agent/skills-src/agent-governance-maintenance/skill.yaml` - `.agent/skills-src/issue-implement/skill.yaml` - generated skill projections under `.agents/skills/**`, `.claude/skills/**`, and `.agent/compiled/skills-manifest.json` **Operational impact**: - none for runtime behavior - imp
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
If required env, provider, GitLab, Docker, or OS prerequisite is missing, mark blocked/not-run with reason.

## QBOT-CODEX-WIN-CONTEXT-GOVERNANCE-083

- Linked cases: QBOT-FUNC-CONTEXT-GOVERNANCE-ISSUE-028-MAIN
- OS: Windows
- Mode: shell
- Required tools: Codex; PowerShell; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $env:DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
Set-Location $env:DEEPBANK_REPO
npm run check
npm run build:ui
```

### Assertions
Because milestone note/discussion endpoints are not available in this project, this issue is the canonical live progress tracker for milestone #1.
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
Lingxi OAuth2 to GitLab token exchange dependency.

## QBOT-CODEX-MAC-CONTEXT-GOVERNANCE-084

- Linked cases: QBOT-FUNC-CONTEXT-GOVERNANCE-ISSUE-028-MAIN
- OS: macOS
- Mode: shell
- Required tools: Codex; zsh/bash; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
cd "$DEEPBANK_REPO"
npm run check
npm run build:ui
```

### Assertions
Because milestone note/discussion endpoints are not available in this project, this issue is the canonical live progress tracker for milestone #1.
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
Lingxi OAuth2 to GitLab token exchange dependency.

## QBOT-CODEX-WIN-CONTEXT-GOVERNANCE-085

- Linked cases: QBOT-NEG-CONTEXT-GOVERNANCE-ISSUE-028-NEG
- OS: Windows
- Mode: shell
- Required tools: Codex; PowerShell; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $env:DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
Set-Location $env:DEEPBANK_REPO
npm run check
npm run build:ui
```

### Assertions
The product reports blocked/failed/degraded state truthfully and produces no fabricated success evidence.
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
Lingxi OAuth2 to GitLab token exchange dependency.

## QBOT-CODEX-MAC-CONTEXT-GOVERNANCE-086

- Linked cases: QBOT-NEG-CONTEXT-GOVERNANCE-ISSUE-028-NEG
- OS: macOS
- Mode: shell
- Required tools: Codex; zsh/bash; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
cd "$DEEPBANK_REPO"
npm run check
npm run build:ui
```

### Assertions
The product reports blocked/failed/degraded state truthfully and produces no fabricated success evidence.
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
Lingxi OAuth2 to GitLab token exchange dependency.

## QBOT-CODEX-WIN-UI-UX-087

- Linked cases: QBOT-FUNC-UIUX-ISSUE-029-MAIN
- OS: Windows
- Mode: hybrid shell + Electron UI
- Required tools: Codex; PowerShell; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $env:DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
Set-Location $env:DEEPBANK_REPO
npm run check
npm run build:ui
```

### Assertions
**Background**: - Milestone #1 treats real identity and WS authentication as a P0 first-layer gate. - #15 and #20 already delivered the major building blocks: Lingxi OAuth2, app-session persistence, authenticated HTTP middleware, remote-control-plane server shape, and a token-backed WS path. - Repository review shows #29 is now a contract-closure issue, not 
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
Lingxi OAuth2 to GitLab token exchange dependency.

## QBOT-CODEX-MAC-UI-UX-088

- Linked cases: QBOT-FUNC-UIUX-ISSUE-029-MAIN
- OS: macOS
- Mode: hybrid shell + Electron UI
- Required tools: Codex; zsh/bash; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
cd "$DEEPBANK_REPO"
npm run check
npm run build:ui
```

### Assertions
**Background**: - Milestone #1 treats real identity and WS authentication as a P0 first-layer gate. - #15 and #20 already delivered the major building blocks: Lingxi OAuth2, app-session persistence, authenticated HTTP middleware, remote-control-plane server shape, and a token-backed WS path. - Repository review shows #29 is now a contract-closure issue, not 
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
Lingxi OAuth2 to GitLab token exchange dependency.

## QBOT-CODEX-WIN-UI-UX-089

- Linked cases: QBOT-NEG-UIUX-ISSUE-029-NEG
- OS: Windows
- Mode: hybrid shell + Electron UI
- Required tools: Codex; PowerShell; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $env:DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
Set-Location $env:DEEPBANK_REPO
npm run check
npm run build:ui
```

### Assertions
The product reports blocked/failed/degraded state truthfully and produces no fabricated success evidence.
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
Lingxi OAuth2 to GitLab token exchange dependency.

## QBOT-CODEX-MAC-UI-UX-090

- Linked cases: QBOT-NEG-UIUX-ISSUE-029-NEG
- OS: macOS
- Mode: hybrid shell + Electron UI
- Required tools: Codex; zsh/bash; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
cd "$DEEPBANK_REPO"
npm run check
npm run build:ui
```

### Assertions
The product reports blocked/failed/degraded state truthfully and produces no fabricated success evidence.
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
Lingxi OAuth2 to GitLab token exchange dependency.

## QBOT-CODEX-WIN-UI-UX-091

- Linked cases: QBOT-FUNC-UIUX-ISSUE-030-MAIN
- OS: Windows
- Mode: hybrid shell + Electron UI
- Required tools: Codex; PowerShell; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $env:DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
Set-Location $env:DEEPBANK_REPO
npm run check
npm run build:ui
```

### Assertions
**Background**: - The milestone already states that platform user-bound Anthropic / LLM connections should be consumed by Deepbank, and user-defined Anthropic connections must coexist. - Current Config Center and runtime selection logic still treat provider/model as local configuration rather than a control-plane sourced capability. - This gap needed to stay
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
If required env, provider, GitLab, Docker, or OS prerequisite is missing, mark blocked/not-run with reason.

## QBOT-CODEX-MAC-UI-UX-092

- Linked cases: QBOT-FUNC-UIUX-ISSUE-030-MAIN
- OS: macOS
- Mode: hybrid shell + Electron UI
- Required tools: Codex; zsh/bash; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
cd "$DEEPBANK_REPO"
npm run check
npm run build:ui
```

### Assertions
**Background**: - The milestone already states that platform user-bound Anthropic / LLM connections should be consumed by Deepbank, and user-defined Anthropic connections must coexist. - Current Config Center and runtime selection logic still treat provider/model as local configuration rather than a control-plane sourced capability. - This gap needed to stay
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
If required env, provider, GitLab, Docker, or OS prerequisite is missing, mark blocked/not-run with reason.

## QBOT-CODEX-WIN-RUNTIME-PROTOCOL-093

- Linked cases: QBOT-FUNC-RUNTIME-ISSUE-031-MAIN
- OS: Windows
- Mode: hybrid shell + Electron UI
- Required tools: Codex; PowerShell; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $env:DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
Set-Location $env:DEEPBANK_REPO
npm run check
npm run build:ui
npm run codex:doctor
npm run codex:smoke
```

### Assertions
**Background**: - The milestone explicitly calls out SkillHub as a separate module that must eventually enter the runtime in a controlled way. - Current skill installation is still tied to local cookie / marketplace snapshot style behavior and does not have a clean control-plane-backed identity and authorization boundary. - This work depends on authenticated
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
If required env, provider, GitLab, Docker, or OS prerequisite is missing, mark blocked/not-run with reason.

## QBOT-CODEX-MAC-RUNTIME-PROTOCOL-094

- Linked cases: QBOT-FUNC-RUNTIME-ISSUE-031-MAIN
- OS: macOS
- Mode: hybrid shell + Electron UI
- Required tools: Codex; zsh/bash; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
cd "$DEEPBANK_REPO"
npm run check
npm run build:ui
npm run codex:doctor
npm run codex:smoke
```

### Assertions
**Background**: - The milestone explicitly calls out SkillHub as a separate module that must eventually enter the runtime in a controlled way. - Current skill installation is still tied to local cookie / marketplace snapshot style behavior and does not have a clean control-plane-backed identity and authorization boundary. - This work depends on authenticated
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
If required env, provider, GitLab, Docker, or OS prerequisite is missing, mark blocked/not-run with reason.

## QBOT-CODEX-WIN-PROJECTS-GITLAB-095

- Linked cases: QBOT-FUNC-PROJECTS-ISSUE-032-MAIN
- OS: Windows
- Mode: shell
- Required tools: Codex; PowerShell; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $env:DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
Set-Location $env:DEEPBANK_REPO
npm run check
npm run build:ui
npm run e2e:doctor -- --scope=local
npm run e2e:local
```

### Assertions
**Background**: - 第一版 Electron 客户端尚未放出，不需要保留旧 transcript 形态的兼容路径。 - 当前实现把 transcript 同时写到 JSONL 和 `sessions.messages` shadow，并在读路径上做 lazy migration，这会把一个本来应当单一的存储契约拆成两套逻辑。 - 这次工作要做的是纯重构收敛：让 transcript 以文件为唯一事实源，DB 只保留会话元数据 / 索引 / 状态。 **Current problem**: - session 读路径仍会检查 `sessions.messages`，并把历史内容迁移到 JSONL。 - session 写路径仍会维护 `sessions.messages` 作为 shadow co
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
If required env, provider, GitLab, Docker, or OS prerequisite is missing, mark blocked/not-run with reason.

## QBOT-CODEX-MAC-PROJECTS-GITLAB-096

- Linked cases: QBOT-FUNC-PROJECTS-ISSUE-032-MAIN
- OS: macOS
- Mode: shell
- Required tools: Codex; zsh/bash; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
cd "$DEEPBANK_REPO"
npm run check
npm run build:ui
npm run e2e:doctor -- --scope=local
npm run e2e:local
```

### Assertions
**Background**: - 第一版 Electron 客户端尚未放出，不需要保留旧 transcript 形态的兼容路径。 - 当前实现把 transcript 同时写到 JSONL 和 `sessions.messages` shadow，并在读路径上做 lazy migration，这会把一个本来应当单一的存储契约拆成两套逻辑。 - 这次工作要做的是纯重构收敛：让 transcript 以文件为唯一事实源，DB 只保留会话元数据 / 索引 / 状态。 **Current problem**: - session 读路径仍会检查 `sessions.messages`，并把历史内容迁移到 JSONL。 - session 写路径仍会维护 `sessions.messages` 作为 shadow co
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
If required env, provider, GitLab, Docker, or OS prerequisite is missing, mark blocked/not-run with reason.

## QBOT-CODEX-WIN-RUNTIME-PROTOCOL-097

- Linked cases: QBOT-FUNC-RUNTIME-ISSUE-033-MAIN
- OS: Windows
- Mode: shell + Codex CLI/runtime artifacts
- Required tools: Codex; PowerShell; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $env:DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
Set-Location $env:DEEPBANK_REPO
npm run check
npm run codex:doctor
npm run codex:smoke
```

### Assertions
**Background**: - The milestone calls out project assets synchronization as a separate gap. - The cloud runtime path and the project workspace model need a clear asset pull/push contract. - This must be separated from the ADK runtime execution issue so the storage/sync semantics are explicit. **Problem or task**: - Define and implement a project asset synchr
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
If required env, provider, GitLab, Docker, or OS prerequisite is missing, mark blocked/not-run with reason.

## QBOT-CODEX-MAC-RUNTIME-PROTOCOL-098

- Linked cases: QBOT-FUNC-RUNTIME-ISSUE-033-MAIN
- OS: macOS
- Mode: shell + Codex CLI/runtime artifacts
- Required tools: Codex; zsh/bash; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
cd "$DEEPBANK_REPO"
npm run check
npm run codex:doctor
npm run codex:smoke
```

### Assertions
**Background**: - The milestone calls out project assets synchronization as a separate gap. - The cloud runtime path and the project workspace model need a clear asset pull/push contract. - This must be separated from the ADK runtime execution issue so the storage/sync semantics are explicit. **Problem or task**: - Define and implement a project asset synchr
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
If required env, provider, GitLab, Docker, or OS prerequisite is missing, mark blocked/not-run with reason.

## QBOT-CODEX-WIN-PROJECTS-GITLAB-099

- Linked cases: QBOT-FUNC-PROJECTS-ISSUE-034-MAIN
- OS: Windows
- Mode: hybrid shell + Electron UI
- Required tools: Codex; PowerShell; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $env:DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
Set-Location $env:DEEPBANK_REPO
npm run check
npm run build:ui
npm run e2e:doctor -- --scope=local
npm run e2e:local
```

### Assertions
**Background**: - The milestone says automation / knowledge is still largely conceptual. - The current UI surfaces exist, but the actual workflow and storage contract are not established. - This should be an independent product workstream rather than a leftover UI placeholder. **Problem or task**: - Define the automation / knowledge closure for project work.
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
If required env, provider, GitLab, Docker, or OS prerequisite is missing, mark blocked/not-run with reason.

## QBOT-CODEX-MAC-PROJECTS-GITLAB-100

- Linked cases: QBOT-FUNC-PROJECTS-ISSUE-034-MAIN
- OS: macOS
- Mode: hybrid shell + Electron UI
- Required tools: Codex; zsh/bash; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
cd "$DEEPBANK_REPO"
npm run check
npm run build:ui
npm run e2e:doctor -- --scope=local
npm run e2e:local
```

### Assertions
**Background**: - The milestone says automation / knowledge is still largely conceptual. - The current UI surfaces exist, but the actual workflow and storage contract are not established. - This should be an independent product workstream rather than a leftover UI placeholder. **Problem or task**: - Define the automation / knowledge closure for project work.
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
If required env, provider, GitLab, Docker, or OS prerequisite is missing, mark blocked/not-run with reason.

## QBOT-CODEX-WIN-PROJECTS-GITLAB-101

- Linked cases: QBOT-FUNC-PROJECTS-ISSUE-035-MAIN
- OS: Windows
- Mode: hybrid shell + Electron UI
- Required tools: Codex; PowerShell; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $env:DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
Set-Location $env:DEEPBANK_REPO
npm run check
npm run build:ui
npm run e2e:doctor -- --scope=local
npm run e2e:local
```

### Assertions
**Background**: - Milestone #1 treats user-level resource isolation, project member permissions, and multi-instance session persistence as one P0 first-layer foundation. - #29 already closed the authenticated HTTP/WS identity boundary; this issue does not reopen identity mechanics. - The code now keeps `activeId` / `draftCtx` in Postgres-backed control-plane
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
If required env, provider, GitLab, Docker, or OS prerequisite is missing, mark blocked/not-run with reason.

## QBOT-CODEX-MAC-PROJECTS-GITLAB-102

- Linked cases: QBOT-FUNC-PROJECTS-ISSUE-035-MAIN
- OS: macOS
- Mode: hybrid shell + Electron UI
- Required tools: Codex; zsh/bash; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
cd "$DEEPBANK_REPO"
npm run check
npm run build:ui
npm run e2e:doctor -- --scope=local
npm run e2e:local
```

### Assertions
**Background**: - Milestone #1 treats user-level resource isolation, project member permissions, and multi-instance session persistence as one P0 first-layer foundation. - #29 already closed the authenticated HTTP/WS identity boundary; this issue does not reopen identity mechanics. - The code now keeps `activeId` / `draftCtx` in Postgres-backed control-plane
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
If required env, provider, GitLab, Docker, or OS prerequisite is missing, mark blocked/not-run with reason.

## QBOT-CODEX-WIN-UI-UX-103

- Linked cases: QBOT-FUNC-UIUX-ISSUE-036-MAIN
- OS: Windows
- Mode: hybrid shell + Electron UI
- Required tools: Codex; PowerShell; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $env:DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
Set-Location $env:DEEPBANK_REPO
npm run check
npm run build:ui
```

### Assertions
**Background**: - Milestone #1 still requires the first-screen / first-layer product loop to feel complete, stable, and obviously branded. - The current shell still reads as the existing Strata / WorkBuddy-inspired orange theme in `src/App.tsx`, `src/Sidebar.tsx`, and `src/app.css`. That is acceptable as a placeholder, but not as the final company-branded ex
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
If required env, provider, GitLab, Docker, or OS prerequisite is missing, mark blocked/not-run with reason.

## QBOT-CODEX-MAC-UI-UX-104

- Linked cases: QBOT-FUNC-UIUX-ISSUE-036-MAIN
- OS: macOS
- Mode: hybrid shell + Electron UI
- Required tools: Codex; zsh/bash; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
cd "$DEEPBANK_REPO"
npm run check
npm run build:ui
```

### Assertions
**Background**: - Milestone #1 still requires the first-screen / first-layer product loop to feel complete, stable, and obviously branded. - The current shell still reads as the existing Strata / WorkBuddy-inspired orange theme in `src/App.tsx`, `src/Sidebar.tsx`, and `src/app.css`. That is acceptable as a placeholder, but not as the final company-branded ex
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
If required env, provider, GitLab, Docker, or OS prerequisite is missing, mark blocked/not-run with reason.

## QBOT-CODEX-WIN-E2E-RELEASE-PLATFORM-105

- Linked cases: QBOT-FUNC-E2E-RELEASE-ISSUE-037-MAIN
- OS: Windows
- Mode: hybrid shell + Electron UI
- Required tools: Codex; PowerShell; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $env:DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
Set-Location $env:DEEPBANK_REPO
npm run check
npm run e2e:doctor -- --scope=local
npm run e2e:local
npm run build:desktop
```

### Assertions
## Background This issue freezes the current multica private-deploy baseline observed in the real cluster on 2026-06-26. ## Deployment Structure - namespace: `multica` - Helm release: `multica` / revision `11` / chart `multica-0.1.0` - `multica-backend`: 1/1 Running, image `harbor.qihoo.net/finloan-dev/multica-backend:v0.3.30` - `multica-frontend`: 1/1 Runni
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
If required env, provider, GitLab, Docker, or OS prerequisite is missing, mark blocked/not-run with reason.

## QBOT-CODEX-MAC-E2E-RELEASE-PLATFORM-106

- Linked cases: QBOT-FUNC-E2E-RELEASE-ISSUE-037-MAIN
- OS: macOS
- Mode: hybrid shell + Electron UI
- Required tools: Codex; zsh/bash; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
cd "$DEEPBANK_REPO"
npm run check
npm run e2e:doctor -- --scope=local
npm run e2e:local
npm run e2e:release:mac
```

### Assertions
## Background This issue freezes the current multica private-deploy baseline observed in the real cluster on 2026-06-26. ## Deployment Structure - namespace: `multica` - Helm release: `multica` / revision `11` / chart `multica-0.1.0` - `multica-backend`: 1/1 Running, image `harbor.qihoo.net/finloan-dev/multica-backend:v0.3.30` - `multica-frontend`: 1/1 Runni
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
If required env, provider, GitLab, Docker, or OS prerequisite is missing, mark blocked/not-run with reason.

## QBOT-CODEX-WIN-SKILLS-MCP-EXPERTS-107

- Linked cases: QBOT-FUNC-SKILLS-MCP-ISSUE-038-MAIN
- OS: Windows
- Mode: shell + Codex CLI/runtime artifacts
- Required tools: Codex; PowerShell; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $env:DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
Set-Location $env:DEEPBANK_REPO
npm run check
npm run codex:doctor
npm run codex:smoke
```

### Assertions
**Exact files or paths**: - `.agent/skills-src/issue-intake/skill.yaml` - `.agent/skills-src/issue-implement/skill.yaml` - `.agent/skills-src/issue-delivery/skill.yaml` - `.agent/skills-src/issue-delivery/references/issue-delivery-workflow.md` - `.agent/skills-src/mr-delivery/skill.yaml` - generated `.agents/skills/**` and `.claude/skills/**` **Operational i
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
If required env, provider, GitLab, Docker, or OS prerequisite is missing, mark blocked/not-run with reason.

## QBOT-CODEX-MAC-SKILLS-MCP-EXPERTS-108

- Linked cases: QBOT-FUNC-SKILLS-MCP-ISSUE-038-MAIN
- OS: macOS
- Mode: shell + Codex CLI/runtime artifacts
- Required tools: Codex; zsh/bash; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
cd "$DEEPBANK_REPO"
npm run check
npm run codex:doctor
npm run codex:smoke
```

### Assertions
**Exact files or paths**: - `.agent/skills-src/issue-intake/skill.yaml` - `.agent/skills-src/issue-implement/skill.yaml` - `.agent/skills-src/issue-delivery/skill.yaml` - `.agent/skills-src/issue-delivery/references/issue-delivery-workflow.md` - `.agent/skills-src/mr-delivery/skill.yaml` - generated `.agents/skills/**` and `.claude/skills/**` **Operational i
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
If required env, provider, GitLab, Docker, or OS prerequisite is missing, mark blocked/not-run with reason.

## QBOT-CODEX-WIN-UI-UX-109

- Linked cases: QBOT-FUNC-UIUX-ISSUE-039-MAIN
- OS: Windows
- Mode: hybrid shell + Electron UI
- Required tools: Codex; PowerShell; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $env:DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
Set-Location $env:DEEPBANK_REPO
npm run check
npm run build:ui
npm run e2e:doctor -- --scope=local
npm run e2e:local
```

### Assertions
**Background**: - Milestone #1 already has the remote-server-only release contract (#19), the remote control-plane / auth boundary (#20, #29), and the owner/member/session boundary (#35). - But the desktop product transport is still split in the codebase: electron/preload.cjs falls back to IPC / embedded runtime when DEEPBANK_SERVER is unset, while local tes
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
If required env, provider, GitLab, Docker, or OS prerequisite is missing, mark blocked/not-run with reason.

## QBOT-CODEX-MAC-UI-UX-110

- Linked cases: QBOT-FUNC-UIUX-ISSUE-039-MAIN
- OS: macOS
- Mode: hybrid shell + Electron UI
- Required tools: Codex; zsh/bash; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
cd "$DEEPBANK_REPO"
npm run check
npm run build:ui
npm run e2e:doctor -- --scope=local
npm run e2e:local
```

### Assertions
**Background**: - Milestone #1 already has the remote-server-only release contract (#19), the remote control-plane / auth boundary (#20, #29), and the owner/member/session boundary (#35). - But the desktop product transport is still split in the codebase: electron/preload.cjs falls back to IPC / embedded runtime when DEEPBANK_SERVER is unset, while local tes
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
If required env, provider, GitLab, Docker, or OS prerequisite is missing, mark blocked/not-run with reason.

## QBOT-CODEX-WIN-SKILLS-MCP-EXPERTS-111

- Linked cases: QBOT-FUNC-SKILLS-MCP-ISSUE-040-MAIN
- OS: Windows
- Mode: hybrid shell + Electron UI
- Required tools: Codex; PowerShell; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $env:DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
Set-Location $env:DEEPBANK_REPO
npm run check
npm run codex:doctor
npm run codex:smoke
npm run e2e:doctor -- --scope=local
npm run e2e:local
```

### Assertions
**Exact files or paths**: - `.agent/skills-src/desktop-release/skill.yaml` - `.agent/skills-src/desktop-release/references/release-workflow.md` - generated `.agents/skills/desktop-release/**` - generated `.claude/skills/desktop-release/**` **Operational impact**: - desktop-release guidance should default to the dev integration environment for release-oriente
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
If required env, provider, GitLab, Docker, or OS prerequisite is missing, mark blocked/not-run with reason.

## QBOT-CODEX-MAC-SKILLS-MCP-EXPERTS-112

- Linked cases: QBOT-FUNC-SKILLS-MCP-ISSUE-040-MAIN
- OS: macOS
- Mode: hybrid shell + Electron UI
- Required tools: Codex; zsh/bash; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
cd "$DEEPBANK_REPO"
npm run check
npm run codex:doctor
npm run codex:smoke
npm run e2e:doctor -- --scope=local
npm run e2e:local
```

### Assertions
**Exact files or paths**: - `.agent/skills-src/desktop-release/skill.yaml` - `.agent/skills-src/desktop-release/references/release-workflow.md` - generated `.agents/skills/desktop-release/**` - generated `.claude/skills/desktop-release/**` **Operational impact**: - desktop-release guidance should default to the dev integration environment for release-oriente
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
If required env, provider, GitLab, Docker, or OS prerequisite is missing, mark blocked/not-run with reason.

## QBOT-CODEX-WIN-SKILLS-MCP-EXPERTS-113

- Linked cases: QBOT-FUNC-SKILLS-MCP-ISSUE-041-MAIN
- OS: Windows
- Mode: hybrid shell + Electron UI
- Required tools: Codex; PowerShell; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $env:DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
Set-Location $env:DEEPBANK_REPO
npm run check
npm run codex:doctor
npm run codex:smoke
npm run e2e:doctor -- --scope=local
npm run e2e:local
```

### Assertions
**Background**: - The repository's current desktop release workflow is macOS-first. The release docs and `desktop-release` skill describe DMG-oriented `functional` / `distribution` packaging with env-scoped `local|dev|prod` release material, but they do not define a Windows client build lane. - `package.json` currently exposes a macOS DMG target only. Reposi
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
If required env, provider, GitLab, Docker, or OS prerequisite is missing, mark blocked/not-run with reason.

## QBOT-CODEX-MAC-SKILLS-MCP-EXPERTS-114

- Linked cases: QBOT-FUNC-SKILLS-MCP-ISSUE-041-MAIN
- OS: macOS
- Mode: hybrid shell + Electron UI
- Required tools: Codex; zsh/bash; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
cd "$DEEPBANK_REPO"
npm run check
npm run codex:doctor
npm run codex:smoke
npm run e2e:doctor -- --scope=local
npm run e2e:local
```

### Assertions
**Background**: - The repository's current desktop release workflow is macOS-first. The release docs and `desktop-release` skill describe DMG-oriented `functional` / `distribution` packaging with env-scoped `local|dev|prod` release material, but they do not define a Windows client build lane. - `package.json` currently exposes a macOS DMG target only. Reposi
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
If required env, provider, GitLab, Docker, or OS prerequisite is missing, mark blocked/not-run with reason.

## QBOT-CODEX-WIN-SKILLS-MCP-EXPERTS-115

- Linked cases: QBOT-FUNC-SKILLS-MCP-ISSUE-042-MAIN
- OS: Windows
- Mode: hybrid shell + Electron UI
- Required tools: Codex; PowerShell; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $env:DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
Set-Location $env:DEEPBANK_REPO
npm run check
npm run build:ui
npm run codex:doctor
npm run codex:smoke
```

### Assertions
**Exact files or paths**: - `.agent/skills-src/electron-local-startup/skill.yaml` - `.agent/skills-src/electron-local-startup/references/startup-matrix.md` - generated `.agents/skills/electron-local-startup/**` - generated `.claude/skills/electron-local-startup/**` - generated `.agent/compiled/skills-manifest.json` **Operational impact**: Add an explicit-onl
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
If required env, provider, GitLab, Docker, or OS prerequisite is missing, mark blocked/not-run with reason.

## QBOT-CODEX-MAC-SKILLS-MCP-EXPERTS-116

- Linked cases: QBOT-FUNC-SKILLS-MCP-ISSUE-042-MAIN
- OS: macOS
- Mode: hybrid shell + Electron UI
- Required tools: Codex; zsh/bash; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
cd "$DEEPBANK_REPO"
npm run check
npm run build:ui
npm run codex:doctor
npm run codex:smoke
```

### Assertions
**Exact files or paths**: - `.agent/skills-src/electron-local-startup/skill.yaml` - `.agent/skills-src/electron-local-startup/references/startup-matrix.md` - generated `.agents/skills/electron-local-startup/**` - generated `.claude/skills/electron-local-startup/**` - generated `.agent/compiled/skills-manifest.json` **Operational impact**: Add an explicit-onl
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
If required env, provider, GitLab, Docker, or OS prerequisite is missing, mark blocked/not-run with reason.

## QBOT-CODEX-WIN-UI-UX-117

- Linked cases: QBOT-FUNC-UIUX-ISSUE-043-MAIN
- OS: Windows
- Mode: hybrid shell + Electron UI
- Required tools: Codex; PowerShell; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $env:DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
Set-Location $env:DEEPBANK_REPO
npm run check
npm run build:ui
npm run e2e:doctor -- --scope=local
npm run e2e:local
```

### Assertions
Build a comprehensive, agent-friendly UI/UX audit framework for the Deepbank Electron workbench that can precisely identify current and future front-end style, contrast, layout, accessibility, interaction, and information-architecture defects across local source Electron and packaged Electron flows. The outcome is not a one-off screenshot bundle. The require
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
If required env, provider, GitLab, Docker, or OS prerequisite is missing, mark blocked/not-run with reason.

## QBOT-CODEX-MAC-UI-UX-118

- Linked cases: QBOT-FUNC-UIUX-ISSUE-043-MAIN
- OS: macOS
- Mode: hybrid shell + Electron UI
- Required tools: Codex; zsh/bash; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
cd "$DEEPBANK_REPO"
npm run check
npm run build:ui
npm run e2e:doctor -- --scope=local
npm run e2e:local
```

### Assertions
Build a comprehensive, agent-friendly UI/UX audit framework for the Deepbank Electron workbench that can precisely identify current and future front-end style, contrast, layout, accessibility, interaction, and information-architecture defects across local source Electron and packaged Electron flows. The outcome is not a one-off screenshot bundle. The require
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
If required env, provider, GitLab, Docker, or OS prerequisite is missing, mark blocked/not-run with reason.

## QBOT-CODEX-WIN-UI-UX-119

- Linked cases: QBOT-NEG-UIUX-ISSUE-043-NEG
- OS: Windows
- Mode: hybrid shell + Electron UI
- Required tools: Codex; PowerShell; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $env:DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
Set-Location $env:DEEPBANK_REPO
npm run check
npm run build:ui
npm run e2e:doctor -- --scope=local
npm run e2e:local
```

### Assertions
The product reports blocked/failed/degraded state truthfully and produces no fabricated success evidence.
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
If required env, provider, GitLab, Docker, or OS prerequisite is missing, mark blocked/not-run with reason.

## QBOT-CODEX-MAC-UI-UX-120

- Linked cases: QBOT-NEG-UIUX-ISSUE-043-NEG
- OS: macOS
- Mode: hybrid shell + Electron UI
- Required tools: Codex; zsh/bash; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
cd "$DEEPBANK_REPO"
npm run check
npm run build:ui
npm run e2e:doctor -- --scope=local
npm run e2e:local
```

### Assertions
The product reports blocked/failed/degraded state truthfully and produces no fabricated success evidence.
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
If required env, provider, GitLab, Docker, or OS prerequisite is missing, mark blocked/not-run with reason.

## QBOT-CODEX-WIN-SKILLS-MCP-EXPERTS-121

- Linked cases: QBOT-FUNC-SKILLS-MCP-ISSUE-044-MAIN
- OS: Windows
- Mode: hybrid shell + Electron UI
- Required tools: Codex; PowerShell; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $env:DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
Set-Location $env:DEEPBANK_REPO
npm run check
npm run codex:doctor
npm run codex:smoke
npm run e2e:doctor -- --scope=local
npm run e2e:local
```

### Assertions
**Background**: - Milestone #1 and tracker #28 define the first-layer product loop, but the repo still lacks a first-class horizontal governance capability that can distinguish architecture/context drift from product-direction drift and route each one into the right repair path. - The repository already has agent-facing issue workflows (`issue-intake`, `issu
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
If required env, provider, GitLab, Docker, or OS prerequisite is missing, mark blocked/not-run with reason.

## QBOT-CODEX-MAC-SKILLS-MCP-EXPERTS-122

- Linked cases: QBOT-FUNC-SKILLS-MCP-ISSUE-044-MAIN
- OS: macOS
- Mode: hybrid shell + Electron UI
- Required tools: Codex; zsh/bash; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
cd "$DEEPBANK_REPO"
npm run check
npm run codex:doctor
npm run codex:smoke
npm run e2e:doctor -- --scope=local
npm run e2e:local
```

### Assertions
**Background**: - Milestone #1 and tracker #28 define the first-layer product loop, but the repo still lacks a first-class horizontal governance capability that can distinguish architecture/context drift from product-direction drift and route each one into the right repair path. - The repository already has agent-facing issue workflows (`issue-intake`, `issu
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
If required env, provider, GitLab, Docker, or OS prerequisite is missing, mark blocked/not-run with reason.

## QBOT-CODEX-WIN-SKILLS-MCP-EXPERTS-123

- Linked cases: QBOT-FUNC-SKILLS-MCP-ISSUE-045-MAIN
- OS: Windows
- Mode: hybrid shell + Electron UI
- Required tools: Codex; PowerShell; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $env:DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
Set-Location $env:DEEPBANK_REPO
npm run check
npm run codex:doctor
npm run codex:smoke
npm run e2e:doctor -- --scope=local
npm run e2e:local
npm run build:desktop
```

### Assertions
**Background**: - The current desktop release workflow already supports macOS `functional` / `distribution` lanes and an opt-in Windows `functional` lane. - Repository review confirmed that Windows is still incomplete relative to macOS: `--platform=win --profile=distribution` is blocked, Windows signing inputs are not preflighted, and Windows distribution ve
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
If required env, provider, GitLab, Docker, or OS prerequisite is missing, mark blocked/not-run with reason.

## QBOT-CODEX-MAC-SKILLS-MCP-EXPERTS-124

- Linked cases: QBOT-FUNC-SKILLS-MCP-ISSUE-045-MAIN
- OS: macOS
- Mode: hybrid shell + Electron UI
- Required tools: Codex; zsh/bash; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
cd "$DEEPBANK_REPO"
npm run check
npm run codex:doctor
npm run codex:smoke
npm run e2e:doctor -- --scope=local
npm run e2e:local
npm run e2e:release:mac
```

### Assertions
**Background**: - The current desktop release workflow already supports macOS `functional` / `distribution` lanes and an opt-in Windows `functional` lane. - Repository review confirmed that Windows is still incomplete relative to macOS: `--platform=win --profile=distribution` is blocked, Windows signing inputs are not preflighted, and Windows distribution ve
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
If required env, provider, GitLab, Docker, or OS prerequisite is missing, mark blocked/not-run with reason.

## QBOT-CODEX-WIN-SKILLS-MCP-EXPERTS-125

- Linked cases: QBOT-FUNC-SKILLS-MCP-ISSUE-046-MAIN
- OS: Windows
- Mode: shell + Codex CLI/runtime artifacts
- Required tools: Codex; PowerShell; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $env:DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
Set-Location $env:DEEPBANK_REPO
npm run check
npm run codex:doctor
npm run codex:smoke
```

### Assertions
**In scope**: - Add `Enhancement.md` issue and MR templates. - Make `.gitlab/README.md` map `Enhancement -> kind/enhancement`. - Update `issue-intake`, `product-direction-audit`, and `mr-delivery` guidance to route enhancement work and use stable `glab` lookup commands. - Keep generated skill projections buildable from canonical sources. **Non-goals**: - Cha
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
If required env, provider, GitLab, Docker, or OS prerequisite is missing, mark blocked/not-run with reason.

## QBOT-CODEX-MAC-SKILLS-MCP-EXPERTS-126

- Linked cases: QBOT-FUNC-SKILLS-MCP-ISSUE-046-MAIN
- OS: macOS
- Mode: shell + Codex CLI/runtime artifacts
- Required tools: Codex; zsh/bash; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
cd "$DEEPBANK_REPO"
npm run check
npm run codex:doctor
npm run codex:smoke
```

### Assertions
**In scope**: - Add `Enhancement.md` issue and MR templates. - Make `.gitlab/README.md` map `Enhancement -> kind/enhancement`. - Update `issue-intake`, `product-direction-audit`, and `mr-delivery` guidance to route enhancement work and use stable `glab` lookup commands. - Keep generated skill projections buildable from canonical sources. **Non-goals**: - Cha
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
If required env, provider, GitLab, Docker, or OS prerequisite is missing, mark blocked/not-run with reason.

## QBOT-CODEX-WIN-SKILLS-MCP-EXPERTS-127

- Linked cases: QBOT-FUNC-SKILLS-MCP-ISSUE-047-MAIN
- OS: Windows
- Mode: hybrid shell + Electron UI
- Required tools: Codex; PowerShell; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $env:DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
Set-Location $env:DEEPBANK_REPO
npm run check
npm run codex:doctor
npm run codex:smoke
npm run e2e:doctor -- --scope=local
npm run e2e:local
npm run build:desktop
```

### Assertions
**Background**: - The desktop release workflow now has one consistent path for macOS and Windows: start from source, build installable client artifacts, bind the release to the shared dev integration environment by default, and publish the result to the GitLab Release page. - `uat` and `prod` exist as explicit env slots, but they are placeholders for now and
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
If required env, provider, GitLab, Docker, or OS prerequisite is missing, mark blocked/not-run with reason.

## QBOT-CODEX-MAC-SKILLS-MCP-EXPERTS-128

- Linked cases: QBOT-FUNC-SKILLS-MCP-ISSUE-047-MAIN
- OS: macOS
- Mode: hybrid shell + Electron UI
- Required tools: Codex; zsh/bash; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
cd "$DEEPBANK_REPO"
npm run check
npm run codex:doctor
npm run codex:smoke
npm run e2e:doctor -- --scope=local
npm run e2e:local
npm run e2e:release:mac
```

### Assertions
**Background**: - The desktop release workflow now has one consistent path for macOS and Windows: start from source, build installable client artifacts, bind the release to the shared dev integration environment by default, and publish the result to the GitLab Release page. - `uat` and `prod` exist as explicit env slots, but they are placeholders for now and
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
If required env, provider, GitLab, Docker, or OS prerequisite is missing, mark blocked/not-run with reason.

## QBOT-CODEX-WIN-SKILLS-MCP-EXPERTS-129

- Linked cases: QBOT-FUNC-SKILLS-MCP-ISSUE-048-MAIN
- OS: Windows
- Mode: hybrid shell + Electron UI
- Required tools: Codex; PowerShell; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $env:DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
Set-Location $env:DEEPBANK_REPO
npm run check
npm run codex:doctor
npm run codex:smoke
npm run e2e:doctor -- --scope=local
npm run e2e:local
```

### Assertions
**Background**: - The repository already has a strong agent infra skeleton: canonical context source, generated context projections, skill sources, generated skill projections, generator scripts, and GitLab workflow assets. - What is still missing is not more prose. The missing layer is long-horizon governance: versioning, lifecycle, drift response, ownershi
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
If required env, provider, GitLab, Docker, or OS prerequisite is missing, mark blocked/not-run with reason.

## QBOT-CODEX-MAC-SKILLS-MCP-EXPERTS-130

- Linked cases: QBOT-FUNC-SKILLS-MCP-ISSUE-048-MAIN
- OS: macOS
- Mode: hybrid shell + Electron UI
- Required tools: Codex; zsh/bash; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
cd "$DEEPBANK_REPO"
npm run check
npm run codex:doctor
npm run codex:smoke
npm run e2e:doctor -- --scope=local
npm run e2e:local
```

### Assertions
**Background**: - The repository already has a strong agent infra skeleton: canonical context source, generated context projections, skill sources, generated skill projections, generator scripts, and GitLab workflow assets. - What is still missing is not more prose. The missing layer is long-horizon governance: versioning, lifecycle, drift response, ownershi
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
If required env, provider, GitLab, Docker, or OS prerequisite is missing, mark blocked/not-run with reason.

## QBOT-CODEX-WIN-SKILLS-MCP-EXPERTS-131

- Linked cases: QBOT-FUNC-SKILLS-MCP-ISSUE-049-MAIN
- OS: Windows
- Mode: hybrid shell + Electron UI
- Required tools: Codex; PowerShell; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $env:DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
Set-Location $env:DEEPBANK_REPO
npm run check
npm run codex:doctor
npm run codex:smoke
npm run e2e:doctor -- --scope=local
npm run e2e:local
```

### Assertions
**Background**: - Deepbank already split governance into separate lanes: `agent-context-audit` for architecture/context drift, `product-direction-audit` for milestone/issue drift, and `agent-governance-maintenance` for canonical mutation. - The GitLab issue family already has `issue-intake`, `issue-implement`, `mr-delivery`, and `issue-delivery` as a deliver
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
If required env, provider, GitLab, Docker, or OS prerequisite is missing, mark blocked/not-run with reason.

## QBOT-CODEX-MAC-SKILLS-MCP-EXPERTS-132

- Linked cases: QBOT-FUNC-SKILLS-MCP-ISSUE-049-MAIN
- OS: macOS
- Mode: hybrid shell + Electron UI
- Required tools: Codex; zsh/bash; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
cd "$DEEPBANK_REPO"
npm run check
npm run codex:doctor
npm run codex:smoke
npm run e2e:doctor -- --scope=local
npm run e2e:local
```

### Assertions
**Background**: - Deepbank already split governance into separate lanes: `agent-context-audit` for architecture/context drift, `product-direction-audit` for milestone/issue drift, and `agent-governance-maintenance` for canonical mutation. - The GitLab issue family already has `issue-intake`, `issue-implement`, `mr-delivery`, and `issue-delivery` as a deliver
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
If required env, provider, GitLab, Docker, or OS prerequisite is missing, mark blocked/not-run with reason.

## QBOT-CODEX-WIN-RUNTIME-PROTOCOL-133

- Linked cases: QBOT-FUNC-RUNTIME-ISSUE-050-MAIN
- OS: Windows
- Mode: shell + Codex CLI/runtime artifacts
- Required tools: Codex; PowerShell; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $env:DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
Set-Location $env:DEEPBANK_REPO
npm run check
npm run codex:doctor
npm run codex:smoke
```

### Assertions
**Background**: - The repository already has a generic `test-regression` umbrella skill and the broader issue/MR workflow skills, but local agent-runtime regressions still need a narrower, provider-aware regression family. - Codex and Claude Code do not fail in the same places. Their runtime surfaces differ across transport, rendering, approvals, plan/questi
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
If required env, provider, GitLab, Docker, or OS prerequisite is missing, mark blocked/not-run with reason.

## QBOT-CODEX-MAC-RUNTIME-PROTOCOL-134

- Linked cases: QBOT-FUNC-RUNTIME-ISSUE-050-MAIN
- OS: macOS
- Mode: shell + Codex CLI/runtime artifacts
- Required tools: Codex; zsh/bash; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
cd "$DEEPBANK_REPO"
npm run check
npm run codex:doctor
npm run codex:smoke
```

### Assertions
**Background**: - The repository already has a generic `test-regression` umbrella skill and the broader issue/MR workflow skills, but local agent-runtime regressions still need a narrower, provider-aware regression family. - Codex and Claude Code do not fail in the same places. Their runtime surfaces differ across transport, rendering, approvals, plan/questi
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
If required env, provider, GitLab, Docker, or OS prerequisite is missing, mark blocked/not-run with reason.

## QBOT-CODEX-WIN-ASSISTANT-135

- Linked cases: QBOT-FUNC-ASSISTANT-ISSUE-052-MAIN
- OS: Windows
- Mode: hybrid shell + Electron UI
- Required tools: Codex; PowerShell; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $env:DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
Set-Location $env:DEEPBANK_REPO
npm run check
npm run build:ui
npm run codex:doctor
npm run codex:smoke
npm run e2e:doctor -- --scope=local
npm run e2e:local
```

### Assertions
Create the parent coordination issue for a parallel Deepbank Electron UI/UX regression and repair campaign. This issue consumes the completed #43 UI/UX audit framework and turns it into a low-coupling feature-domain operating contract for multiple code agents working in separate git worktrees. The parent issue must make it obvious which agent owns which app 
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
If required env, provider, GitLab, Docker, or OS prerequisite is missing, mark blocked/not-run with reason.

## QBOT-CODEX-MAC-ASSISTANT-136

- Linked cases: QBOT-FUNC-ASSISTANT-ISSUE-052-MAIN
- OS: macOS
- Mode: hybrid shell + Electron UI
- Required tools: Codex; zsh/bash; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
cd "$DEEPBANK_REPO"
npm run check
npm run build:ui
npm run codex:doctor
npm run codex:smoke
npm run e2e:doctor -- --scope=local
npm run e2e:local
```

### Assertions
Create the parent coordination issue for a parallel Deepbank Electron UI/UX regression and repair campaign. This issue consumes the completed #43 UI/UX audit framework and turns it into a low-coupling feature-domain operating contract for multiple code agents working in separate git worktrees. The parent issue must make it obvious which agent owns which app 
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
If required env, provider, GitLab, Docker, or OS prerequisite is missing, mark blocked/not-run with reason.

## QBOT-CODEX-WIN-ASSISTANT-137

- Linked cases: QBOT-FUNC-ASSISTANT-ISSUE-053-MAIN
- OS: Windows
- Mode: hybrid shell + Electron UI
- Required tools: Codex; PowerShell; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $env:DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
Set-Location $env:DEEPBANK_REPO
npm run check
npm run build:ui
npm run e2e:doctor -- --scope=local
npm run e2e:local
```

### Assertions
Fix 9 accessibility and UX findings in the ArtifactPanel component (`src/ArtifactPanel.tsx`) and its scoped CSS (`.artifact/*`, `.fileitem/*` in `src/app.css`) to improve keyboard accessibility, semantic structure, text truncation, error handling, and loading UX. **Parent**: #52 **Feature domain**: `UIUX-ARTIFACT-PANEL` **Worktree path**: `/Users/wangxiangyu
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
If required env, provider, GitLab, Docker, or OS prerequisite is missing, mark blocked/not-run with reason.

## QBOT-CODEX-MAC-ASSISTANT-138

- Linked cases: QBOT-FUNC-ASSISTANT-ISSUE-053-MAIN
- OS: macOS
- Mode: hybrid shell + Electron UI
- Required tools: Codex; zsh/bash; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
cd "$DEEPBANK_REPO"
npm run check
npm run build:ui
npm run e2e:doctor -- --scope=local
npm run e2e:local
```

### Assertions
Fix 9 accessibility and UX findings in the ArtifactPanel component (`src/ArtifactPanel.tsx`) and its scoped CSS (`.artifact/*`, `.fileitem/*` in `src/app.css`) to improve keyboard accessibility, semantic structure, text truncation, error handling, and loading UX. **Parent**: #52 **Feature domain**: `UIUX-ARTIFACT-PANEL` **Worktree path**: `/Users/wangxiangyu
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
If required env, provider, GitLab, Docker, or OS prerequisite is missing, mark blocked/not-run with reason.

## QBOT-CODEX-WIN-ASSISTANT-139

- Linked cases: QBOT-FUNC-ASSISTANT-ISSUE-054-MAIN
- OS: Windows
- Mode: hybrid shell + Electron UI
- Required tools: Codex; PowerShell; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $env:DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
Set-Location $env:DEEPBANK_REPO
npm run check
npm run build:ui
npm run codex:doctor
npm run codex:smoke
npm run e2e:doctor -- --scope=local
npm run e2e:local
```

### Assertions
### Claim: UIUX-ASSISTANT-THREAD - Parent: #52 - Feature domain: `UIUX-ASSISTANT-THREAD` - Worktree path: `/Users/wangxiangyu/PycharmProjects/deepbankv2-ws3` - Branch: `issue-52-uiux-assistant-thread` - Primary code boundary: `src/components/assistant-ui/thread.tsx`; `src/App.tsx` statusbar only - Audit contract: `reports/uiux-audit/<run-id>/report.json`, `s
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
If required env, provider, GitLab, Docker, or OS prerequisite is missing, mark blocked/not-run with reason.

## QBOT-CODEX-MAC-ASSISTANT-140

- Linked cases: QBOT-FUNC-ASSISTANT-ISSUE-054-MAIN
- OS: macOS
- Mode: hybrid shell + Electron UI
- Required tools: Codex; zsh/bash; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
cd "$DEEPBANK_REPO"
npm run check
npm run build:ui
npm run codex:doctor
npm run codex:smoke
npm run e2e:doctor -- --scope=local
npm run e2e:local
```

### Assertions
### Claim: UIUX-ASSISTANT-THREAD - Parent: #52 - Feature domain: `UIUX-ASSISTANT-THREAD` - Worktree path: `/Users/wangxiangyu/PycharmProjects/deepbankv2-ws3` - Branch: `issue-52-uiux-assistant-thread` - Primary code boundary: `src/components/assistant-ui/thread.tsx`; `src/App.tsx` statusbar only - Audit contract: `reports/uiux-audit/<run-id>/report.json`, `s
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
If required env, provider, GitLab, Docker, or OS prerequisite is missing, mark blocked/not-run with reason.

## QBOT-CODEX-WIN-PROJECTS-GITLAB-141

- Linked cases: QBOT-FUNC-PROJECTS-ISSUE-055-MAIN
- OS: Windows
- Mode: hybrid shell + Electron UI
- Required tools: Codex; PowerShell; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $env:DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
Set-Location $env:DEEPBANK_REPO
npm run check
npm run build:ui
npm run e2e:doctor -- --scope=local
npm run e2e:local
```

### Assertions
Run and repair the `UIUX-PROJECTS` feature-domain UI/UX regression slice for the Deepbank Projects surface. **Parent**: #52 **Feature domain**: `UIUX-PROJECTS` **Worktree path**: `/Users/wangxiangyu/PycharmProjects/deepbankv2-ws5` **Branch**: `fix/uiux-projects-52` **Primary code boundary**: `src/ProjectsView.tsx` plus project-scoped selectors in `src/app.cs
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
If required env, provider, GitLab, Docker, or OS prerequisite is missing, mark blocked/not-run with reason.

## QBOT-CODEX-MAC-PROJECTS-GITLAB-142

- Linked cases: QBOT-FUNC-PROJECTS-ISSUE-055-MAIN
- OS: macOS
- Mode: hybrid shell + Electron UI
- Required tools: Codex; zsh/bash; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
cd "$DEEPBANK_REPO"
npm run check
npm run build:ui
npm run e2e:doctor -- --scope=local
npm run e2e:local
```

### Assertions
Run and repair the `UIUX-PROJECTS` feature-domain UI/UX regression slice for the Deepbank Projects surface. **Parent**: #52 **Feature domain**: `UIUX-PROJECTS` **Worktree path**: `/Users/wangxiangyu/PycharmProjects/deepbankv2-ws5` **Branch**: `fix/uiux-projects-52` **Primary code boundary**: `src/ProjectsView.tsx` plus project-scoped selectors in `src/app.cs
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
If required env, provider, GitLab, Docker, or OS prerequisite is missing, mark blocked/not-run with reason.

## QBOT-CODEX-WIN-UI-UX-143

- Linked cases: QBOT-FUNC-UIUX-ISSUE-056-MAIN
- OS: Windows
- Mode: hybrid shell + Electron UI
- Required tools: Codex; PowerShell; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $env:DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
Set-Location $env:DEEPBANK_REPO
npm run check
npm run build:ui
npm run e2e:doctor -- --scope=local
npm run e2e:local
```

### Assertions
Claim `UIUX-AUTH-SHELL` as an audit-first UI/UX regression domain and make the auth shell a first-class deterministic capture target for #43's audit flow.
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
If required env, provider, GitLab, Docker, or OS prerequisite is missing, mark blocked/not-run with reason.

## QBOT-CODEX-MAC-UI-UX-144

- Linked cases: QBOT-FUNC-UIUX-ISSUE-056-MAIN
- OS: macOS
- Mode: hybrid shell + Electron UI
- Required tools: Codex; zsh/bash; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
cd "$DEEPBANK_REPO"
npm run check
npm run build:ui
npm run e2e:doctor -- --scope=local
npm run e2e:local
```

### Assertions
Claim `UIUX-AUTH-SHELL` as an audit-first UI/UX regression domain and make the auth shell a first-class deterministic capture target for #43's audit flow.
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
If required env, provider, GitLab, Docker, or OS prerequisite is missing, mark blocked/not-run with reason.

## QBOT-CODEX-WIN-ASSISTANT-145

- Linked cases: QBOT-FUNC-ASSISTANT-ISSUE-057-MAIN
- OS: Windows
- Mode: hybrid shell + Electron UI
- Required tools: Codex; PowerShell; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $env:DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
Set-Location $env:DEEPBANK_REPO
npm run check
npm run build:ui
npm run e2e:doctor -- --scope=local
npm run e2e:local
```

### Assertions
Fix the QFIN sidebar navigation surface so the real UI/UX audit no longer reports contrast defects on the sidebar itself.
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
If required env, provider, GitLab, Docker, or OS prerequisite is missing, mark blocked/not-run with reason.

## QBOT-CODEX-MAC-ASSISTANT-146

- Linked cases: QBOT-FUNC-ASSISTANT-ISSUE-057-MAIN
- OS: macOS
- Mode: hybrid shell + Electron UI
- Required tools: Codex; zsh/bash; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
cd "$DEEPBANK_REPO"
npm run check
npm run build:ui
npm run e2e:doctor -- --scope=local
npm run e2e:local
```

### Assertions
Fix the QFIN sidebar navigation surface so the real UI/UX audit no longer reports contrast defects on the sidebar itself.
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
If required env, provider, GitLab, Docker, or OS prerequisite is missing, mark blocked/not-run with reason.

## QBOT-CODEX-WIN-SKILLS-MCP-EXPERTS-147

- Linked cases: QBOT-FUNC-SKILLS-MCP-ISSUE-058-MAIN
- OS: Windows
- Mode: hybrid shell + Electron UI
- Required tools: Codex; PowerShell; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $env:DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
Set-Location $env:DEEPBANK_REPO
npm run check
npm run build:ui
npm run codex:doctor
npm run codex:smoke
npm run e2e:doctor -- --scope=local
npm run e2e:local
```

### Assertions
**In scope**: - `src/ExpertsView.tsx` - experts / skills scoped selectors in `src/app.css` - QFIN-specific overrides in `src/qfin.css` only when they are clearly scoped to the Experts / Skills surface - local audit validation against `reports/uiux-audit/uiux-local-mqw2tc4v/` **Non-goals**: - Do not change sidebar, projects, config center, artifact panel, ass
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
If required env, provider, GitLab, Docker, or OS prerequisite is missing, mark blocked/not-run with reason.

## QBOT-CODEX-MAC-SKILLS-MCP-EXPERTS-148

- Linked cases: QBOT-FUNC-SKILLS-MCP-ISSUE-058-MAIN
- OS: macOS
- Mode: hybrid shell + Electron UI
- Required tools: Codex; zsh/bash; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
cd "$DEEPBANK_REPO"
npm run check
npm run build:ui
npm run codex:doctor
npm run codex:smoke
npm run e2e:doctor -- --scope=local
npm run e2e:local
```

### Assertions
**In scope**: - `src/ExpertsView.tsx` - experts / skills scoped selectors in `src/app.css` - QFIN-specific overrides in `src/qfin.css` only when they are clearly scoped to the Experts / Skills surface - local audit validation against `reports/uiux-audit/uiux-local-mqw2tc4v/` **Non-goals**: - Do not change sidebar, projects, config center, artifact panel, ass
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
If required env, provider, GitLab, Docker, or OS prerequisite is missing, mark blocked/not-run with reason.

## QBOT-CODEX-WIN-SKILLS-MCP-EXPERTS-149

- Linked cases: QBOT-FUNC-SKILLS-MCP-ISSUE-059-MAIN
- OS: Windows
- Mode: hybrid shell + Electron UI
- Required tools: Codex; PowerShell; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $env:DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
Set-Location $env:DEEPBANK_REPO
npm run check
npm run build:ui
npm run codex:doctor
npm run codex:smoke
npm run e2e:doctor -- --scope=local
npm run e2e:local
```

### Assertions
Fix the `UIUX-EXPERTS-SKILLS` feature-domain UI/UX regression slice for the Deepbank Experts + Skills surface. **Parent**: #52 **Feature domain**: `UIUX-EXPERTS-SKILLS` **Worktree path**: `/Users/wangxiangyu/PycharmProjects/deepbankv2` **Branch**: `fix/uiux-experts-skills-52` **Primary code boundary**: `src/ExpertsView.tsx` plus experts/skills-scoped CSS sel
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
If required env, provider, GitLab, Docker, or OS prerequisite is missing, mark blocked/not-run with reason.

## QBOT-CODEX-MAC-SKILLS-MCP-EXPERTS-150

- Linked cases: QBOT-FUNC-SKILLS-MCP-ISSUE-059-MAIN
- OS: macOS
- Mode: hybrid shell + Electron UI
- Required tools: Codex; zsh/bash; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
cd "$DEEPBANK_REPO"
npm run check
npm run build:ui
npm run codex:doctor
npm run codex:smoke
npm run e2e:doctor -- --scope=local
npm run e2e:local
```

### Assertions
Fix the `UIUX-EXPERTS-SKILLS` feature-domain UI/UX regression slice for the Deepbank Experts + Skills surface. **Parent**: #52 **Feature domain**: `UIUX-EXPERTS-SKILLS` **Worktree path**: `/Users/wangxiangyu/PycharmProjects/deepbankv2` **Branch**: `fix/uiux-experts-skills-52` **Primary code boundary**: `src/ExpertsView.tsx` plus experts/skills-scoped CSS sel
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
If required env, provider, GitLab, Docker, or OS prerequisite is missing, mark blocked/not-run with reason.

## QBOT-CODEX-WIN-SKILLS-MCP-EXPERTS-151

- Linked cases: QBOT-FUNC-SKILLS-MCP-ISSUE-060-MAIN
- OS: Windows
- Mode: shell + Codex CLI/runtime artifacts
- Required tools: Codex; PowerShell; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $env:DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
Set-Location $env:DEEPBANK_REPO
npm run check
npm run codex:doctor
npm run codex:smoke
```

### Assertions
**Exact files or paths**: - `.gitlab/README.md` - `.gitlab/issue_templates/**` - `.gitlab/scripts/gitlab_labels.sh` - `.agent/context.yaml` when durable `.gitlab` guidance changes - `.agent/skills-src/issue-intake/**` - `.agent/skills-src/issue-implement/**` - `.agent/skills-src/issue-delivery/**` - `.agent/skills-src/mr-delivery/**` - generated context / sk
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
If required env, provider, GitLab, Docker, or OS prerequisite is missing, mark blocked/not-run with reason.

## QBOT-CODEX-MAC-SKILLS-MCP-EXPERTS-152

- Linked cases: QBOT-FUNC-SKILLS-MCP-ISSUE-060-MAIN
- OS: macOS
- Mode: shell + Codex CLI/runtime artifacts
- Required tools: Codex; zsh/bash; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
cd "$DEEPBANK_REPO"
npm run check
npm run codex:doctor
npm run codex:smoke
```

### Assertions
**Exact files or paths**: - `.gitlab/README.md` - `.gitlab/issue_templates/**` - `.gitlab/scripts/gitlab_labels.sh` - `.agent/context.yaml` when durable `.gitlab` guidance changes - `.agent/skills-src/issue-intake/**` - `.agent/skills-src/issue-implement/**` - `.agent/skills-src/issue-delivery/**` - `.agent/skills-src/mr-delivery/**` - generated context / sk
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
If required env, provider, GitLab, Docker, or OS prerequisite is missing, mark blocked/not-run with reason.

## QBOT-CODEX-WIN-CONTEXT-GOVERNANCE-153

- Linked cases: QBOT-FUNC-CONTEXT-GOVERNANCE-ISSUE-061-MAIN
- OS: Windows
- Mode: shell
- Required tools: Codex; PowerShell; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $env:DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
Set-Location $env:DEEPBANK_REPO
npm run check
npm run build:ui
```

### Assertions
**Exact files or paths**: - `.agent/context.yaml` - generated context projections: `AGENTS.md`, `CLAUDE.md`, `docs/AGENTS.md`, `docs/CLAUDE.md`, `.agent/compiled/**`, `.agent/compiled/manifest.json` - `README.md` - `docs/product-overview.md` - `docs/design-decisions.md` - `docs/implementation-blueprint.md` - non-behavioral comments only when they directly co
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
If required env, provider, GitLab, Docker, or OS prerequisite is missing, mark blocked/not-run with reason.

## QBOT-CODEX-MAC-CONTEXT-GOVERNANCE-154

- Linked cases: QBOT-FUNC-CONTEXT-GOVERNANCE-ISSUE-061-MAIN
- OS: macOS
- Mode: shell
- Required tools: Codex; zsh/bash; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
cd "$DEEPBANK_REPO"
npm run check
npm run build:ui
```

### Assertions
**Exact files or paths**: - `.agent/context.yaml` - generated context projections: `AGENTS.md`, `CLAUDE.md`, `docs/AGENTS.md`, `docs/CLAUDE.md`, `.agent/compiled/**`, `.agent/compiled/manifest.json` - `README.md` - `docs/product-overview.md` - `docs/design-decisions.md` - `docs/implementation-blueprint.md` - non-behavioral comments only when they directly co
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
If required env, provider, GitLab, Docker, or OS prerequisite is missing, mark blocked/not-run with reason.

## QBOT-CODEX-WIN-ASSISTANT-155

- Linked cases: QBOT-FUNC-ASSISTANT-ISSUE-062-MAIN
- OS: Windows
- Mode: hybrid shell + Electron UI
- Required tools: Codex; PowerShell; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $env:DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
Set-Location $env:DEEPBANK_REPO
npm run check
npm run build:ui
npm run codex:doctor
npm run codex:smoke
npm run e2e:doctor -- --scope=local
npm run e2e:local
```

### Assertions
**In scope**: - `src/AskModal.tsx` - ask bridge helpers in `src/runtime.tsx` - ask modal styles in `src/app.css` - mock ask path in `server/engine.mjs` for `DEEPBANK_E2E=1` - ask-modal audit coverage in `test/e2e/support/uiux-audit.mjs` and `test/e2e/uiux-audit.spec.mjs` - typed ask bridge shapes in `src/ask-types.ts` and `src/global.d.ts` **Non-goals**: - D
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
If required env, provider, GitLab, Docker, or OS prerequisite is missing, mark blocked/not-run with reason.

## QBOT-CODEX-MAC-ASSISTANT-156

- Linked cases: QBOT-FUNC-ASSISTANT-ISSUE-062-MAIN
- OS: macOS
- Mode: hybrid shell + Electron UI
- Required tools: Codex; zsh/bash; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
cd "$DEEPBANK_REPO"
npm run check
npm run build:ui
npm run codex:doctor
npm run codex:smoke
npm run e2e:doctor -- --scope=local
npm run e2e:local
```

### Assertions
**In scope**: - `src/AskModal.tsx` - ask bridge helpers in `src/runtime.tsx` - ask modal styles in `src/app.css` - mock ask path in `server/engine.mjs` for `DEEPBANK_E2E=1` - ask-modal audit coverage in `test/e2e/support/uiux-audit.mjs` and `test/e2e/uiux-audit.spec.mjs` - typed ask bridge shapes in `src/ask-types.ts` and `src/global.d.ts` **Non-goals**: - D
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
If required env, provider, GitLab, Docker, or OS prerequisite is missing, mark blocked/not-run with reason.

## QBOT-CODEX-WIN-RUNTIME-PROTOCOL-157

- Linked cases: QBOT-FUNC-RUNTIME-ISSUE-063-MAIN
- OS: Windows
- Mode: hybrid shell + Electron UI
- Required tools: Codex; PowerShell; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $env:DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
Set-Location $env:DEEPBANK_REPO
npm run check
npm run codex:doctor
npm run codex:smoke
npm run e2e:doctor -- --scope=local
npm run e2e:local
```

### Assertions
**Exact files or behaviors to cover**: - `scripts/e2e-local-real.mjs` validates real-runtime ADK source prerequisites before it spawns the local Playwright/electron dependency stack. - `scripts/e2e-prerequisites.mjs` exposes a focused ADK source prerequisite collector that can be unit-tested without running Docker, Playwright, or real providers. - `scripts/a
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
If required env, provider, GitLab, Docker, or OS prerequisite is missing, mark blocked/not-run with reason.

## QBOT-CODEX-MAC-RUNTIME-PROTOCOL-158

- Linked cases: QBOT-FUNC-RUNTIME-ISSUE-063-MAIN
- OS: macOS
- Mode: hybrid shell + Electron UI
- Required tools: Codex; zsh/bash; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
cd "$DEEPBANK_REPO"
npm run check
npm run codex:doctor
npm run codex:smoke
npm run e2e:doctor -- --scope=local
npm run e2e:local
```

### Assertions
**Exact files or behaviors to cover**: - `scripts/e2e-local-real.mjs` validates real-runtime ADK source prerequisites before it spawns the local Playwright/electron dependency stack. - `scripts/e2e-prerequisites.mjs` exposes a focused ADK source prerequisite collector that can be unit-tested without running Docker, Playwright, or real providers. - `scripts/a
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
If required env, provider, GitLab, Docker, or OS prerequisite is missing, mark blocked/not-run with reason.

## QBOT-CODEX-WIN-SKILLS-MCP-EXPERTS-159

- Linked cases: QBOT-FUNC-SKILLS-MCP-ISSUE-064-MAIN
- OS: Windows
- Mode: hybrid shell + Electron UI
- Required tools: Codex; PowerShell; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $env:DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
Set-Location $env:DEEPBANK_REPO
npm run check
npm run build:ui
npm run codex:doctor
npm run codex:smoke
```

### Assertions
**Background**: Deepbank v2 already owns the Electron/UI contract and the remote control-plane boundary. The next integration layer is to let the same Lingxi OAuth2 user automatically see resources that already exist in three company/platform systems: - Deepbank platform LLM connections, including OpenAI-compatible, Anthropic-compatible, and Responses API-co
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
Requires explicit real-provider environment.

## QBOT-CODEX-MAC-SKILLS-MCP-EXPERTS-160

- Linked cases: QBOT-FUNC-SKILLS-MCP-ISSUE-064-MAIN
- OS: macOS
- Mode: hybrid shell + Electron UI
- Required tools: Codex; zsh/bash; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
cd "$DEEPBANK_REPO"
npm run check
npm run build:ui
npm run codex:doctor
npm run codex:smoke
```

### Assertions
**Background**: Deepbank v2 already owns the Electron/UI contract and the remote control-plane boundary. The next integration layer is to let the same Lingxi OAuth2 user automatically see resources that already exist in three company/platform systems: - Deepbank platform LLM connections, including OpenAI-compatible, Anthropic-compatible, and Responses API-co
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
Requires explicit real-provider environment.

## QBOT-CODEX-WIN-SKILLS-MCP-EXPERTS-161

- Linked cases: QBOT-NEG-SKILLS-MCP-ISSUE-064-NEG
- OS: Windows
- Mode: hybrid shell + Electron UI
- Required tools: Codex; PowerShell; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $env:DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
Set-Location $env:DEEPBANK_REPO
npm run check
npm run build:ui
npm run codex:doctor
npm run codex:smoke
```

### Assertions
The product reports blocked/failed/degraded state truthfully and produces no fabricated success evidence.
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
Requires explicit real-provider environment.

## QBOT-CODEX-MAC-SKILLS-MCP-EXPERTS-162

- Linked cases: QBOT-NEG-SKILLS-MCP-ISSUE-064-NEG
- OS: macOS
- Mode: hybrid shell + Electron UI
- Required tools: Codex; zsh/bash; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
cd "$DEEPBANK_REPO"
npm run check
npm run build:ui
npm run codex:doctor
npm run codex:smoke
```

### Assertions
The product reports blocked/failed/degraded state truthfully and produces no fabricated success evidence.
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
Requires explicit real-provider environment.

## QBOT-CODEX-WIN-RUNTIME-PROTOCOL-163

- Linked cases: QBOT-FUNC-RUNTIME-ISSUE-065-MAIN
- OS: Windows
- Mode: hybrid shell + Electron UI
- Required tools: Codex; PowerShell; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $env:DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
Set-Location $env:DEEPBANK_REPO
npm run check
npm run build:ui
npm run codex:doctor
npm run codex:smoke
```

### Assertions
**Background**: #30 delivered the local Deepbank v2 redacted connection-view foundation. The new requirement is to let the same Lingxi OAuth2-authenticated user see and use their Deepbank platform LLM connections inside the Deepbank v2 Electron app. Deepbank BE provides a direct user-level LLM connections API based on the Lingxi OAuth2 access token. Deepbank
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
If required env, provider, GitLab, Docker, or OS prerequisite is missing, mark blocked/not-run with reason.

## QBOT-CODEX-MAC-RUNTIME-PROTOCOL-164

- Linked cases: QBOT-FUNC-RUNTIME-ISSUE-065-MAIN
- OS: macOS
- Mode: hybrid shell + Electron UI
- Required tools: Codex; zsh/bash; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
cd "$DEEPBANK_REPO"
npm run check
npm run build:ui
npm run codex:doctor
npm run codex:smoke
```

### Assertions
**Background**: #30 delivered the local Deepbank v2 redacted connection-view foundation. The new requirement is to let the same Lingxi OAuth2-authenticated user see and use their Deepbank platform LLM connections inside the Deepbank v2 Electron app. Deepbank BE provides a direct user-level LLM connections API based on the Lingxi OAuth2 access token. Deepbank
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
If required env, provider, GitLab, Docker, or OS prerequisite is missing, mark blocked/not-run with reason.

## QBOT-CODEX-WIN-RUNTIME-PROTOCOL-165

- Linked cases: QBOT-NEG-RUNTIME-ISSUE-065-NEG
- OS: Windows
- Mode: hybrid shell + Electron UI
- Required tools: Codex; PowerShell; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $env:DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
Set-Location $env:DEEPBANK_REPO
npm run check
npm run build:ui
npm run codex:doctor
npm run codex:smoke
```

### Assertions
The product reports blocked/failed/degraded state truthfully and produces no fabricated success evidence.
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
If required env, provider, GitLab, Docker, or OS prerequisite is missing, mark blocked/not-run with reason.

## QBOT-CODEX-MAC-RUNTIME-PROTOCOL-166

- Linked cases: QBOT-NEG-RUNTIME-ISSUE-065-NEG
- OS: macOS
- Mode: hybrid shell + Electron UI
- Required tools: Codex; zsh/bash; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
cd "$DEEPBANK_REPO"
npm run check
npm run build:ui
npm run codex:doctor
npm run codex:smoke
```

### Assertions
The product reports blocked/failed/degraded state truthfully and produces no fabricated success evidence.
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
If required env, provider, GitLab, Docker, or OS prerequisite is missing, mark blocked/not-run with reason.

## QBOT-CODEX-WIN-RUNTIME-PROTOCOL-167

- Linked cases: QBOT-FUNC-RUNTIME-ISSUE-067-MAIN
- OS: Windows
- Mode: hybrid shell + Electron UI
- Required tools: Codex; PowerShell; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $env:DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
Set-Location $env:DEEPBANK_REPO
npm run check
npm run build:ui
npm run codex:doctor
npm run codex:smoke
```

### Assertions
**Background**: Deepbank v2 already has MCP connector plumbing in `server/engine.mjs`, `src/ConnectorsView.tsx`, project connector selection, and composer connector toggles. Today those resources are local/config-driven. MCPHub already exposes OpenAPI generation and server/spec endpoints, so the new requirement is to load company-private MCPHub resources for
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
If required env, provider, GitLab, Docker, or OS prerequisite is missing, mark blocked/not-run with reason.

## QBOT-CODEX-MAC-RUNTIME-PROTOCOL-168

- Linked cases: QBOT-FUNC-RUNTIME-ISSUE-067-MAIN
- OS: macOS
- Mode: hybrid shell + Electron UI
- Required tools: Codex; zsh/bash; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
cd "$DEEPBANK_REPO"
npm run check
npm run build:ui
npm run codex:doctor
npm run codex:smoke
```

### Assertions
**Background**: Deepbank v2 already has MCP connector plumbing in `server/engine.mjs`, `src/ConnectorsView.tsx`, project connector selection, and composer connector toggles. Today those resources are local/config-driven. MCPHub already exposes OpenAPI generation and server/spec endpoints, so the new requirement is to load company-private MCPHub resources for
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
If required env, provider, GitLab, Docker, or OS prerequisite is missing, mark blocked/not-run with reason.

## QBOT-CODEX-WIN-RUNTIME-PROTOCOL-169

- Linked cases: QBOT-FUNC-RUNTIME-ISSUE-069-MAIN
- OS: Windows
- Mode: hybrid shell + Electron UI
- Required tools: Codex; PowerShell; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $env:DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
Set-Location $env:DEEPBANK_REPO
npm run check
npm run build:ui
npm run codex:doctor
npm run codex:smoke
```

### Assertions
**Background**: #31 delivered the first-layer SkillHub install/cache/update/revert mechanics. The new requirement is to stop treating SkillHub as a service-token-only catalog and let Deepbank v2 server load SkillHub resources for the same Lingxi OAuth2-authenticated user. SkillHub already exposes read/resolve/download/visibility controllers and OpenAPI docs,
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
If required env, provider, GitLab, Docker, or OS prerequisite is missing, mark blocked/not-run with reason.

## QBOT-CODEX-MAC-RUNTIME-PROTOCOL-170

- Linked cases: QBOT-FUNC-RUNTIME-ISSUE-069-MAIN
- OS: macOS
- Mode: hybrid shell + Electron UI
- Required tools: Codex; zsh/bash; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
cd "$DEEPBANK_REPO"
npm run check
npm run build:ui
npm run codex:doctor
npm run codex:smoke
```

### Assertions
**Background**: #31 delivered the first-layer SkillHub install/cache/update/revert mechanics. The new requirement is to stop treating SkillHub as a service-token-only catalog and let Deepbank v2 server load SkillHub resources for the same Lingxi OAuth2-authenticated user. SkillHub already exposes read/resolve/download/visibility controllers and OpenAPI docs,
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
If required env, provider, GitLab, Docker, or OS prerequisite is missing, mark blocked/not-run with reason.

## QBOT-CODEX-WIN-UI-UX-171

- Linked cases: QBOT-FUNC-UIUX-ISSUE-071-MAIN
- OS: Windows
- Mode: hybrid shell + Electron UI
- Required tools: Codex; PowerShell; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $env:DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
Set-Location $env:DEEPBANK_REPO
npm run check
npm run build:ui
npm run e2e:doctor -- --scope=local
npm run e2e:local
```

### Assertions
Regress the Config Center surface under the #43 UI/UX audit framework and remove any deterministic Config Center defects that are proven within the claimed `UIUX-CONFIG-CENTER` domain.
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
If required env, provider, GitLab, Docker, or OS prerequisite is missing, mark blocked/not-run with reason.

## QBOT-CODEX-MAC-UI-UX-172

- Linked cases: QBOT-FUNC-UIUX-ISSUE-071-MAIN
- OS: macOS
- Mode: hybrid shell + Electron UI
- Required tools: Codex; zsh/bash; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
cd "$DEEPBANK_REPO"
npm run check
npm run build:ui
npm run e2e:doctor -- --scope=local
npm run e2e:local
```

### Assertions
Regress the Config Center surface under the #43 UI/UX audit framework and remove any deterministic Config Center defects that are proven within the claimed `UIUX-CONFIG-CENTER` domain.
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
If required env, provider, GitLab, Docker, or OS prerequisite is missing, mark blocked/not-run with reason.

## QBOT-CODEX-WIN-UI-UX-173

- Linked cases: QBOT-NEG-UIUX-ISSUE-072-MAIN
- OS: Windows
- Mode: hybrid shell + Electron UI
- Required tools: Codex; PowerShell; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $env:DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
Set-Location $env:DEEPBANK_REPO
npm run check
npm run build:ui
npm run e2e:doctor -- --scope=local
npm run e2e:local
```

### Assertions
**In scope**: - Fix the current QFIN sidebar logo contrast issue in `src/Sidebar.tsx` / sidebar-scoped QFIN styling. - Add deterministic audit coverage for image/non-text logo contrast and sidebar expanded states. - Seed enough local audit data to render multiple sessions, at least one project, at least one workspace, and expanded `任务` / `空间` rows. - Fix the
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
If required env, provider, GitLab, Docker, or OS prerequisite is missing, mark blocked/not-run with reason.

## QBOT-CODEX-MAC-UI-UX-174

- Linked cases: QBOT-NEG-UIUX-ISSUE-072-MAIN
- OS: macOS
- Mode: hybrid shell + Electron UI
- Required tools: Codex; zsh/bash; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
cd "$DEEPBANK_REPO"
npm run check
npm run build:ui
npm run e2e:doctor -- --scope=local
npm run e2e:local
```

### Assertions
**In scope**: - Fix the current QFIN sidebar logo contrast issue in `src/Sidebar.tsx` / sidebar-scoped QFIN styling. - Add deterministic audit coverage for image/non-text logo contrast and sidebar expanded states. - Seed enough local audit data to render multiple sessions, at least one project, at least one workspace, and expanded `任务` / `空间` rows. - Fix the
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
If required env, provider, GitLab, Docker, or OS prerequisite is missing, mark blocked/not-run with reason.

## QBOT-CODEX-WIN-UI-UX-175

- Linked cases: QBOT-NEG-UIUX-ISSUE-072-NEG
- OS: Windows
- Mode: hybrid shell + Electron UI
- Required tools: Codex; PowerShell; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $env:DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
Set-Location $env:DEEPBANK_REPO
npm run check
npm run build:ui
npm run e2e:doctor -- --scope=local
npm run e2e:local
```

### Assertions
The product reports blocked/failed/degraded state truthfully and produces no fabricated success evidence.
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
If required env, provider, GitLab, Docker, or OS prerequisite is missing, mark blocked/not-run with reason.

## QBOT-CODEX-MAC-UI-UX-176

- Linked cases: QBOT-NEG-UIUX-ISSUE-072-NEG
- OS: macOS
- Mode: hybrid shell + Electron UI
- Required tools: Codex; zsh/bash; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
cd "$DEEPBANK_REPO"
npm run check
npm run build:ui
npm run e2e:doctor -- --scope=local
npm run e2e:local
```

### Assertions
The product reports blocked/failed/degraded state truthfully and produces no fabricated success evidence.
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
If required env, provider, GitLab, Docker, or OS prerequisite is missing, mark blocked/not-run with reason.

## QBOT-CODEX-WIN-E2E-RELEASE-PLATFORM-177

- Linked cases: QBOT-FUNC-E2E-RELEASE-ISSUE-073-MAIN
- OS: Windows
- Mode: hybrid shell + Electron UI
- Required tools: Codex; PowerShell; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $env:DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
Set-Location $env:DEEPBANK_REPO
npm run check
npm run e2e:doctor -- --scope=local
npm run e2e:local
npm run build:desktop
```

### Assertions
**Exact files or paths**: - `scripts/gitlab-milestone-tracker.mjs` - `scripts/gitlab-milestone-tracker.test.mjs` - `.gitlab/README.md` - `package.json` **Operational impact**: - Maintain milestone `#1` coverage and tracker `#28` hygiene through one repo-managed script. - Allow maintainers to audit current drift before mutating GitLab state. - Compress redund
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
If required env, provider, GitLab, Docker, or OS prerequisite is missing, mark blocked/not-run with reason.

## QBOT-CODEX-MAC-E2E-RELEASE-PLATFORM-178

- Linked cases: QBOT-FUNC-E2E-RELEASE-ISSUE-073-MAIN
- OS: macOS
- Mode: hybrid shell + Electron UI
- Required tools: Codex; zsh/bash; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
cd "$DEEPBANK_REPO"
npm run check
npm run e2e:doctor -- --scope=local
npm run e2e:local
npm run e2e:release:mac
```

### Assertions
**Exact files or paths**: - `scripts/gitlab-milestone-tracker.mjs` - `scripts/gitlab-milestone-tracker.test.mjs` - `.gitlab/README.md` - `package.json` **Operational impact**: - Maintain milestone `#1` coverage and tracker `#28` hygiene through one repo-managed script. - Allow maintainers to audit current drift before mutating GitLab state. - Compress redund
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
If required env, provider, GitLab, Docker, or OS prerequisite is missing, mark blocked/not-run with reason.

## QBOT-CODEX-WIN-ASSISTANT-179

- Linked cases: QBOT-FUNC-ASSISTANT-ISSUE-074-MAIN
- OS: Windows
- Mode: hybrid shell + Electron UI
- Required tools: Codex; PowerShell; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $env:DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
Set-Location $env:DEEPBANK_REPO
npm run check
npm run build:ui
npm run codex:doctor
npm run codex:smoke
npm run e2e:doctor -- --scope=local
npm run e2e:local
```

### Assertions
**Exact files or behaviors to cover**: - Parent: #52. - Feature domain: UIUX-CROSS-SWEEP. - Worktree path: `/Users/wangxiangyu/PycharmProjects/deepbankv2-ws5`. - Branch: `issue-52-uiux-cross-sweep`. - Primary code boundary: validation-only; no direct code fix domain. - Audit scope: compare local source Electron and packaged release UI/UX audit artifacts from
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
If required env, provider, GitLab, Docker, or OS prerequisite is missing, mark blocked/not-run with reason.

## QBOT-CODEX-MAC-ASSISTANT-180

- Linked cases: QBOT-FUNC-ASSISTANT-ISSUE-074-MAIN
- OS: macOS
- Mode: hybrid shell + Electron UI
- Required tools: Codex; zsh/bash; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
cd "$DEEPBANK_REPO"
npm run check
npm run build:ui
npm run codex:doctor
npm run codex:smoke
npm run e2e:doctor -- --scope=local
npm run e2e:local
```

### Assertions
**Exact files or behaviors to cover**: - Parent: #52. - Feature domain: UIUX-CROSS-SWEEP. - Worktree path: `/Users/wangxiangyu/PycharmProjects/deepbankv2-ws5`. - Branch: `issue-52-uiux-cross-sweep`. - Primary code boundary: validation-only; no direct code fix domain. - Audit scope: compare local source Electron and packaged release UI/UX audit artifacts from
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
If required env, provider, GitLab, Docker, or OS prerequisite is missing, mark blocked/not-run with reason.

## QBOT-CODEX-WIN-ASSISTANT-181

- Linked cases: QBOT-FUNC-ASSISTANT-ISSUE-075-MAIN
- OS: Windows
- Mode: hybrid shell + Electron UI
- Required tools: Codex; PowerShell; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $env:DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
Set-Location $env:DEEPBANK_REPO
npm run check
npm run build:ui
npm run e2e:doctor -- --scope=local
npm run e2e:local
```

### Assertions
**Exact files or behaviors to cover**: - Assistant settings surface: role/profile config, connection view, default runtime family, local development mode, Codex runtime provider fields, JSON textarea fields, save feedback, and dirty state. - Primary code boundary: `src/AssistantConfig.tsx`. - Audit tooling boundary: `test/e2e/support/uiux-audit.mjs` and `tes
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
If required env, provider, GitLab, Docker, or OS prerequisite is missing, mark blocked/not-run with reason.

## QBOT-CODEX-MAC-ASSISTANT-182

- Linked cases: QBOT-FUNC-ASSISTANT-ISSUE-075-MAIN
- OS: macOS
- Mode: hybrid shell + Electron UI
- Required tools: Codex; zsh/bash; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
cd "$DEEPBANK_REPO"
npm run check
npm run build:ui
npm run e2e:doctor -- --scope=local
npm run e2e:local
```

### Assertions
**Exact files or behaviors to cover**: - Assistant settings surface: role/profile config, connection view, default runtime family, local development mode, Codex runtime provider fields, JSON textarea fields, save feedback, and dirty state. - Primary code boundary: `src/AssistantConfig.tsx`. - Audit tooling boundary: `test/e2e/support/uiux-audit.mjs` and `tes
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
If required env, provider, GitLab, Docker, or OS prerequisite is missing, mark blocked/not-run with reason.

## QBOT-CODEX-WIN-SKILLS-MCP-EXPERTS-183

- Linked cases: QBOT-FUNC-SKILLS-MCP-ISSUE-076-MAIN
- OS: Windows
- Mode: hybrid shell + Electron UI
- Required tools: Codex; PowerShell; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $env:DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
Set-Location $env:DEEPBANK_REPO
npm run check
npm run build:ui
npm run codex:doctor
npm run codex:smoke
npm run e2e:doctor -- --scope=local
npm run e2e:local
```

### Assertions
Regress the Connectors surface under the #43 UI/UX audit framework and remove any deterministic Connectors defects that are proven within the claimed `UIUX-CONNECTORS` domain.
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
If required env, provider, GitLab, Docker, or OS prerequisite is missing, mark blocked/not-run with reason.

## QBOT-CODEX-MAC-SKILLS-MCP-EXPERTS-184

- Linked cases: QBOT-FUNC-SKILLS-MCP-ISSUE-076-MAIN
- OS: macOS
- Mode: hybrid shell + Electron UI
- Required tools: Codex; zsh/bash; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
cd "$DEEPBANK_REPO"
npm run check
npm run build:ui
npm run codex:doctor
npm run codex:smoke
npm run e2e:doctor -- --scope=local
npm run e2e:local
```

### Assertions
Regress the Connectors surface under the #43 UI/UX audit framework and remove any deterministic Connectors defects that are proven within the claimed `UIUX-CONNECTORS` domain.
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
If required env, provider, GitLab, Docker, or OS prerequisite is missing, mark blocked/not-run with reason.

## QBOT-CODEX-WIN-ASSISTANT-185

- Linked cases: QBOT-NEG-ASSISTANT-ISSUE-077-MAIN
- OS: Windows
- Mode: hybrid shell + Electron UI
- Required tools: Codex; PowerShell; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $env:DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
Set-Location $env:DEEPBANK_REPO
npm run check
npm run build:ui
npm run codex:doctor
npm run codex:smoke
npm run e2e:doctor -- --scope=local
npm run e2e:local
```

### Assertions
**In scope**: - `src/app.css` scoped fixes for ArtifactPanel close/file path contrast and Assistant Thread tool caret / composer focus visibility. - `src/qfin.css` scoped fix for the Skills intro copy contrast residual. - `test/e2e/support/uiux-audit.mjs` false-positive cleanup for intended scroll containers reported as `layout/clipped-text`. - Validation vi
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
If required env, provider, GitLab, Docker, or OS prerequisite is missing, mark blocked/not-run with reason.

## QBOT-CODEX-MAC-ASSISTANT-186

- Linked cases: QBOT-NEG-ASSISTANT-ISSUE-077-MAIN
- OS: macOS
- Mode: hybrid shell + Electron UI
- Required tools: Codex; zsh/bash; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
cd "$DEEPBANK_REPO"
npm run check
npm run build:ui
npm run codex:doctor
npm run codex:smoke
npm run e2e:doctor -- --scope=local
npm run e2e:local
```

### Assertions
**In scope**: - `src/app.css` scoped fixes for ArtifactPanel close/file path contrast and Assistant Thread tool caret / composer focus visibility. - `src/qfin.css` scoped fix for the Skills intro copy contrast residual. - `test/e2e/support/uiux-audit.mjs` false-positive cleanup for intended scroll containers reported as `layout/clipped-text`. - Validation vi
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
If required env, provider, GitLab, Docker, or OS prerequisite is missing, mark blocked/not-run with reason.

## QBOT-CODEX-WIN-ASSISTANT-187

- Linked cases: QBOT-NEG-ASSISTANT-ISSUE-077-NEG
- OS: Windows
- Mode: hybrid shell + Electron UI
- Required tools: Codex; PowerShell; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $env:DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
Set-Location $env:DEEPBANK_REPO
npm run check
npm run build:ui
npm run codex:doctor
npm run codex:smoke
npm run e2e:doctor -- --scope=local
npm run e2e:local
```

### Assertions
The product reports blocked/failed/degraded state truthfully and produces no fabricated success evidence.
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
If required env, provider, GitLab, Docker, or OS prerequisite is missing, mark blocked/not-run with reason.

## QBOT-CODEX-MAC-ASSISTANT-188

- Linked cases: QBOT-NEG-ASSISTANT-ISSUE-077-NEG
- OS: macOS
- Mode: hybrid shell + Electron UI
- Required tools: Codex; zsh/bash; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
cd "$DEEPBANK_REPO"
npm run check
npm run build:ui
npm run codex:doctor
npm run codex:smoke
npm run e2e:doctor -- --scope=local
npm run e2e:local
```

### Assertions
The product reports blocked/failed/degraded state truthfully and produces no fabricated success evidence.
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
If required env, provider, GitLab, Docker, or OS prerequisite is missing, mark blocked/not-run with reason.

## QBOT-CODEX-WIN-ASSISTANT-189

- Linked cases: QBOT-FUNC-ASSISTANT-ISSUE-078-MAIN
- OS: Windows
- Mode: hybrid shell + Electron UI
- Required tools: Codex; PowerShell; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $env:DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
Set-Location $env:DEEPBANK_REPO
npm run check
npm run build:ui
npm run codex:doctor
npm run codex:smoke
npm run e2e:doctor -- --scope=local
npm run e2e:local
```

### Assertions
**Background**: Deepbank 已形成明确的品牌方向，但视觉权威仍分散在 `src/index.css`、`src/app.css`、`src/qfin.css` 三层；`src/components/ui/*` 只覆盖少量原语，主要业务视图仍大量使用页面级 class 和原生控件重样式。 **Current problem**: 现有 `uiux-audit` 能稳定找出 contrast、focus、boundary、clipping 等确定性问题，但这些问题在多个模块反复出现，说明当前更大的缺口是主题语义、共享原语和视觉治理没有形成单一权威，而不是单点 bug 尚未关闭。 **Design goal**: 建立一个长期运行的视觉系统收敛父项：统一审查规则、统一 issue 路由、统一父子
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
If required env, provider, GitLab, Docker, or OS prerequisite is missing, mark blocked/not-run with reason.

## QBOT-CODEX-MAC-ASSISTANT-190

- Linked cases: QBOT-FUNC-ASSISTANT-ISSUE-078-MAIN
- OS: macOS
- Mode: hybrid shell + Electron UI
- Required tools: Codex; zsh/bash; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
cd "$DEEPBANK_REPO"
npm run check
npm run build:ui
npm run codex:doctor
npm run codex:smoke
npm run e2e:doctor -- --scope=local
npm run e2e:local
```

### Assertions
**Background**: Deepbank 已形成明确的品牌方向，但视觉权威仍分散在 `src/index.css`、`src/app.css`、`src/qfin.css` 三层；`src/components/ui/*` 只覆盖少量原语，主要业务视图仍大量使用页面级 class 和原生控件重样式。 **Current problem**: 现有 `uiux-audit` 能稳定找出 contrast、focus、boundary、clipping 等确定性问题，但这些问题在多个模块反复出现，说明当前更大的缺口是主题语义、共享原语和视觉治理没有形成单一权威，而不是单点 bug 尚未关闭。 **Design goal**: 建立一个长期运行的视觉系统收敛父项：统一审查规则、统一 issue 路由、统一父子
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
If required env, provider, GitLab, Docker, or OS prerequisite is missing, mark blocked/not-run with reason.

## QBOT-CODEX-WIN-SKILLS-MCP-EXPERTS-191

- Linked cases: QBOT-FUNC-SKILLS-MCP-ISSUE-079-MAIN
- OS: Windows
- Mode: hybrid shell + Electron UI
- Required tools: Codex; PowerShell; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $env:DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
Set-Location $env:DEEPBANK_REPO
npm run check
npm run build:ui
npm run codex:doctor
npm run codex:smoke
```

### Assertions
**Background**: 当前仓库已经具备 skill build、GitLab 模板和 uiux-audit 证据链，但 UI/UX 视觉治理仍分散在多个 prompt、issue 描述和局部约定中。 **Current problem**: 缺少一个可复用的 visual-review workflow，使 UI/UX 审查结论能够稳定落到 issue-intake、.gitlab 模板和父子 issue 编排上。 **Design goal**: 把视觉审查、issue 路由和 GitLab 契约固化为长期可复用的治理机制。 **Best-practice target**: - visual-review 负责审查与 handoff，issue-intake 负责建单。 - GitLab 模板能显
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
If required env, provider, GitLab, Docker, or OS prerequisite is missing, mark blocked/not-run with reason.

## QBOT-CODEX-MAC-SKILLS-MCP-EXPERTS-192

- Linked cases: QBOT-FUNC-SKILLS-MCP-ISSUE-079-MAIN
- OS: macOS
- Mode: hybrid shell + Electron UI
- Required tools: Codex; zsh/bash; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
cd "$DEEPBANK_REPO"
npm run check
npm run build:ui
npm run codex:doctor
npm run codex:smoke
```

### Assertions
**Background**: 当前仓库已经具备 skill build、GitLab 模板和 uiux-audit 证据链，但 UI/UX 视觉治理仍分散在多个 prompt、issue 描述和局部约定中。 **Current problem**: 缺少一个可复用的 visual-review workflow，使 UI/UX 审查结论能够稳定落到 issue-intake、.gitlab 模板和父子 issue 编排上。 **Design goal**: 把视觉审查、issue 路由和 GitLab 契约固化为长期可复用的治理机制。 **Best-practice target**: - visual-review 负责审查与 handoff，issue-intake 负责建单。 - GitLab 模板能显
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
If required env, provider, GitLab, Docker, or OS prerequisite is missing, mark blocked/not-run with reason.

## QBOT-CODEX-WIN-ASSISTANT-193

- Linked cases: QBOT-FUNC-ASSISTANT-ISSUE-080-MAIN
- OS: Windows
- Mode: hybrid shell + Electron UI
- Required tools: Codex; PowerShell; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $env:DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
Set-Location $env:DEEPBANK_REPO
npm run check
npm run build:ui
npm run e2e:doctor -- --scope=local
npm run e2e:local
```

### Assertions
**In scope**: - 定义 token authority 与品牌覆写边界 - 收敛字体、色板、surface/ring/border/status 语义 - 为后续模块 lane 提供可消费的 foundation contract **Non-goals**: - 不直接完成每个模块的细节修复 - 不在这个 issue 里重写所有业务布局
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
If required env, provider, GitLab, Docker, or OS prerequisite is missing, mark blocked/not-run with reason.

## QBOT-CODEX-MAC-ASSISTANT-194

- Linked cases: QBOT-FUNC-ASSISTANT-ISSUE-080-MAIN
- OS: macOS
- Mode: hybrid shell + Electron UI
- Required tools: Codex; zsh/bash; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
cd "$DEEPBANK_REPO"
npm run check
npm run build:ui
npm run e2e:doctor -- --scope=local
npm run e2e:local
```

### Assertions
**In scope**: - 定义 token authority 与品牌覆写边界 - 收敛字体、色板、surface/ring/border/status 语义 - 为后续模块 lane 提供可消费的 foundation contract **Non-goals**: - 不直接完成每个模块的细节修复 - 不在这个 issue 里重写所有业务布局
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
If required env, provider, GitLab, Docker, or OS prerequisite is missing, mark blocked/not-run with reason.

## QBOT-CODEX-WIN-ASSISTANT-195

- Linked cases: QBOT-FUNC-ASSISTANT-ISSUE-081-MAIN
- OS: Windows
- Mode: hybrid shell + Electron UI
- Required tools: Codex; PowerShell; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $env:DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
Set-Location $env:DEEPBANK_REPO
npm run check
npm run build:ui
npm run e2e:doctor -- --scope=local
npm run e2e:local
```

### Assertions
**In scope**: - 建立按钮/输入/chip/tab/dialog/state 的 shared primitive contract - 识别最应该被 primitive 化的重复 page-local patterns - 为模块 lane 提供复用入口 **Non-goals**: - 不在本 issue 里完成所有模块迁移 - 不把局部 copy/layout 调整混入 primitive API 设计
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
If required env, provider, GitLab, Docker, or OS prerequisite is missing, mark blocked/not-run with reason.

## QBOT-CODEX-MAC-ASSISTANT-196

- Linked cases: QBOT-FUNC-ASSISTANT-ISSUE-081-MAIN
- OS: macOS
- Mode: hybrid shell + Electron UI
- Required tools: Codex; zsh/bash; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
cd "$DEEPBANK_REPO"
npm run check
npm run build:ui
npm run e2e:doctor -- --scope=local
npm run e2e:local
```

### Assertions
**In scope**: - 建立按钮/输入/chip/tab/dialog/state 的 shared primitive contract - 识别最应该被 primitive 化的重复 page-local patterns - 为模块 lane 提供复用入口 **Non-goals**: - 不在本 issue 里完成所有模块迁移 - 不把局部 copy/layout 调整混入 primitive API 设计
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
If required env, provider, GitLab, Docker, or OS prerequisite is missing, mark blocked/not-run with reason.

## QBOT-CODEX-WIN-UI-UX-197

- Linked cases: QBOT-FUNC-UIUX-ISSUE-082-MAIN
- OS: Windows
- Mode: hybrid shell + Electron UI
- Required tools: Codex; PowerShell; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $env:DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
Set-Location $env:DEEPBANK_REPO
npm run check
npm run build:ui
```

### Assertions
**In scope**: - 登录壳、侧栏、状态条、全局 shell rhythm 与 state consistency - 仅处理 app-shell scope 内的 convergence **Non-goals**: - 不吸收 assistant thread 或 projects/workspace 细节 - 不在本 issue 定义 foundation token authority
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
If required env, provider, GitLab, Docker, or OS prerequisite is missing, mark blocked/not-run with reason.

## QBOT-CODEX-MAC-UI-UX-198

- Linked cases: QBOT-FUNC-UIUX-ISSUE-082-MAIN
- OS: macOS
- Mode: hybrid shell + Electron UI
- Required tools: Codex; zsh/bash; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
cd "$DEEPBANK_REPO"
npm run check
npm run build:ui
```

### Assertions
**In scope**: - 登录壳、侧栏、状态条、全局 shell rhythm 与 state consistency - 仅处理 app-shell scope 内的 convergence **Non-goals**: - 不吸收 assistant thread 或 projects/workspace 细节 - 不在本 issue 定义 foundation token authority
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
If required env, provider, GitLab, Docker, or OS prerequisite is missing, mark blocked/not-run with reason.

## QBOT-CODEX-WIN-ASSISTANT-199

- Linked cases: QBOT-FUNC-ASSISTANT-ISSUE-083-MAIN
- OS: Windows
- Mode: hybrid shell + Electron UI
- Required tools: Codex; PowerShell; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $env:DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
Set-Location $env:DEEPBANK_REPO
npm run check
npm run build:ui
npm run e2e:doctor -- --scope=local
npm run e2e:local
```

### Assertions
**In scope**: - thread hierarchy - composer / tool chrome states - artifact side-panel consistency - AskUserQuestion modal alignment **Non-goals**: - 不吸收 foundation token redesign - 不处理 projects / config / experts surfaces
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
If required env, provider, GitLab, Docker, or OS prerequisite is missing, mark blocked/not-run with reason.

## QBOT-CODEX-MAC-ASSISTANT-200

- Linked cases: QBOT-FUNC-ASSISTANT-ISSUE-083-MAIN
- OS: macOS
- Mode: hybrid shell + Electron UI
- Required tools: Codex; zsh/bash; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
cd "$DEEPBANK_REPO"
npm run check
npm run build:ui
npm run e2e:doctor -- --scope=local
npm run e2e:local
```

### Assertions
**In scope**: - thread hierarchy - composer / tool chrome states - artifact side-panel consistency - AskUserQuestion modal alignment **Non-goals**: - 不吸收 foundation token redesign - 不处理 projects / config / experts surfaces
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
If required env, provider, GitLab, Docker, or OS prerequisite is missing, mark blocked/not-run with reason.

## QBOT-CODEX-WIN-PROJECTS-GITLAB-201

- Linked cases: QBOT-FUNC-PROJECTS-ISSUE-084-MAIN
- OS: Windows
- Mode: hybrid shell + Electron UI
- Required tools: Codex; PowerShell; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $env:DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
Set-Location $env:DEEPBANK_REPO
npm run check
npm run build:ui
npm run e2e:doctor -- --scope=local
npm run e2e:local
```

### Assertions
**In scope**: - 项目列表卡片与搜索 - workspace tabs、config rail、members/tasks/results - 项目内操作 affordance 与 scan path **Non-goals**: - 不重写项目业务流程或权限模型 - 不吸收 foundation / primitives 全局定义
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
If required env, provider, GitLab, Docker, or OS prerequisite is missing, mark blocked/not-run with reason.

## QBOT-CODEX-MAC-PROJECTS-GITLAB-202

- Linked cases: QBOT-FUNC-PROJECTS-ISSUE-084-MAIN
- OS: macOS
- Mode: hybrid shell + Electron UI
- Required tools: Codex; zsh/bash; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
cd "$DEEPBANK_REPO"
npm run check
npm run build:ui
npm run e2e:doctor -- --scope=local
npm run e2e:local
```

### Assertions
**In scope**: - 项目列表卡片与搜索 - workspace tabs、config rail、members/tasks/results - 项目内操作 affordance 与 scan path **Non-goals**: - 不重写项目业务流程或权限模型 - 不吸收 foundation / primitives 全局定义
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
If required env, provider, GitLab, Docker, or OS prerequisite is missing, mark blocked/not-run with reason.

## QBOT-CODEX-WIN-SKILLS-MCP-EXPERTS-203

- Linked cases: QBOT-FUNC-SKILLS-MCP-ISSUE-085-MAIN
- OS: Windows
- Mode: hybrid shell + Electron UI
- Required tools: Codex; PowerShell; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $env:DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
Set-Location $env:DEEPBANK_REPO
npm run check
npm run build:ui
npm run codex:doctor
npm run codex:smoke
```

### Assertions
**In scope**: - expert cards - skill market/install/history subtabs - chip、copy hierarchy、marketplace state expression **Non-goals**: - 不改变技能安装/市场业务逻辑 - 不在本 issue 重做 foundation tokens
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
If required env, provider, GitLab, Docker, or OS prerequisite is missing, mark blocked/not-run with reason.

## QBOT-CODEX-MAC-SKILLS-MCP-EXPERTS-204

- Linked cases: QBOT-FUNC-SKILLS-MCP-ISSUE-085-MAIN
- OS: macOS
- Mode: hybrid shell + Electron UI
- Required tools: Codex; zsh/bash; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
cd "$DEEPBANK_REPO"
npm run check
npm run build:ui
npm run codex:doctor
npm run codex:smoke
```

### Assertions
**In scope**: - expert cards - skill market/install/history subtabs - chip、copy hierarchy、marketplace state expression **Non-goals**: - 不改变技能安装/市场业务逻辑 - 不在本 issue 重做 foundation tokens
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
If required env, provider, GitLab, Docker, or OS prerequisite is missing, mark blocked/not-run with reason.

## QBOT-CODEX-WIN-ASSISTANT-205

- Linked cases: QBOT-FUNC-ASSISTANT-ISSUE-086-MAIN
- OS: Windows
- Mode: hybrid shell + Electron UI
- Required tools: Codex; PowerShell; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $env:DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
Set-Location $env:DEEPBANK_REPO
npm run check
npm run build:ui
npm run codex:doctor
npm run codex:smoke
npm run e2e:doctor -- --scope=local
npm run e2e:local
```

### Assertions
**In scope**: - AssistantConfig - ConfigCenter - ConnectorsView - shared form and danger-action semantics inside config family **Non-goals**: - 不调整连接配置或运行时业务契约 - 不在本 issue 重建 foundation/primitives authority
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
If required env, provider, GitLab, Docker, or OS prerequisite is missing, mark blocked/not-run with reason.

## QBOT-CODEX-MAC-ASSISTANT-206

- Linked cases: QBOT-FUNC-ASSISTANT-ISSUE-086-MAIN
- OS: macOS
- Mode: hybrid shell + Electron UI
- Required tools: Codex; zsh/bash; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
cd "$DEEPBANK_REPO"
npm run check
npm run build:ui
npm run codex:doctor
npm run codex:smoke
npm run e2e:doctor -- --scope=local
npm run e2e:local
```

### Assertions
**In scope**: - AssistantConfig - ConfigCenter - ConnectorsView - shared form and danger-action semantics inside config family **Non-goals**: - 不调整连接配置或运行时业务契约 - 不在本 issue 重建 foundation/primitives authority
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
If required env, provider, GitLab, Docker, or OS prerequisite is missing, mark blocked/not-run with reason.

## QBOT-CODEX-WIN-UI-UX-207

- Linked cases: QBOT-FUNC-UIUX-ISSUE-087-MAIN
- OS: Windows
- Mode: hybrid shell + Electron UI
- Required tools: Codex; PowerShell; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $env:DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
Set-Location $env:DEEPBANK_REPO
npm run check
npm run build:ui
npm run e2e:doctor -- --scope=local
npm run e2e:local
```

### Assertions
**Exact files or behaviors to cover**: - `test/e2e/support/uiux-audit.mjs` - `reports/uiux-audit/**` grouping and routing quality - cross-surface residual classification for visual convergence work **Current gap**: 当前 audit 已能稳定产出 deterministic findings 和 issue-intake packet，但 residual classification、误报治理、systemic grouping 和 module routing 仍需要单独的测试/规则治理 lane
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
If required env, provider, GitLab, Docker, or OS prerequisite is missing, mark blocked/not-run with reason.

## QBOT-CODEX-MAC-UI-UX-208

- Linked cases: QBOT-FUNC-UIUX-ISSUE-087-MAIN
- OS: macOS
- Mode: hybrid shell + Electron UI
- Required tools: Codex; zsh/bash; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
cd "$DEEPBANK_REPO"
npm run check
npm run build:ui
npm run e2e:doctor -- --scope=local
npm run e2e:local
```

### Assertions
**Exact files or behaviors to cover**: - `test/e2e/support/uiux-audit.mjs` - `reports/uiux-audit/**` grouping and routing quality - cross-surface residual classification for visual convergence work **Current gap**: 当前 audit 已能稳定产出 deterministic findings 和 issue-intake packet，但 residual classification、误报治理、systemic grouping 和 module routing 仍需要单独的测试/规则治理 lane
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
If required env, provider, GitLab, Docker, or OS prerequisite is missing, mark blocked/not-run with reason.

## QBOT-CODEX-WIN-RUNTIME-PROTOCOL-209

- Linked cases: QBOT-FUNC-RUNTIME-ISSUE-088-MAIN
- OS: Windows
- Mode: hybrid shell + Electron UI
- Required tools: Codex; PowerShell; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $env:DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
Set-Location $env:DEEPBANK_REPO
npm run check
npm run build:ui
npm run codex:doctor
npm run codex:smoke
```

### Assertions
**Exact files or module boundaries**: - `server/` remote-control connection resolution, runtime adapter paths, and local protocol conversion code. - `connection-view.mjs` and type surfaces that expose proxy-backed Codex capability metadata. - `src/` model-selection UI labels that mark OpenAI-compatible Codex use as proxy-backed. - `test/e2e/` smoke and real-
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
Issue status is blocked.

## QBOT-CODEX-MAC-RUNTIME-PROTOCOL-210

- Linked cases: QBOT-FUNC-RUNTIME-ISSUE-088-MAIN
- OS: macOS
- Mode: hybrid shell + Electron UI
- Required tools: Codex; zsh/bash; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
cd "$DEEPBANK_REPO"
npm run check
npm run build:ui
npm run codex:doctor
npm run codex:smoke
```

### Assertions
**Exact files or module boundaries**: - `server/` remote-control connection resolution, runtime adapter paths, and local protocol conversion code. - `connection-view.mjs` and type surfaces that expose proxy-backed Codex capability metadata. - `src/` model-selection UI labels that mark OpenAI-compatible Codex use as proxy-backed. - `test/e2e/` smoke and real-
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
Issue status is blocked.

## QBOT-CODEX-WIN-RUNTIME-PROTOCOL-211

- Linked cases: QBOT-NEG-RUNTIME-ISSUE-088-NEG
- OS: Windows
- Mode: hybrid shell + Electron UI
- Required tools: Codex; PowerShell; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $env:DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
Set-Location $env:DEEPBANK_REPO
npm run check
npm run build:ui
npm run codex:doctor
npm run codex:smoke
```

### Assertions
The product reports blocked/failed/degraded state truthfully and produces no fabricated success evidence.
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
Issue status is blocked.

## QBOT-CODEX-MAC-RUNTIME-PROTOCOL-212

- Linked cases: QBOT-NEG-RUNTIME-ISSUE-088-NEG
- OS: macOS
- Mode: hybrid shell + Electron UI
- Required tools: Codex; zsh/bash; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
cd "$DEEPBANK_REPO"
npm run check
npm run build:ui
npm run codex:doctor
npm run codex:smoke
```

### Assertions
The product reports blocked/failed/degraded state truthfully and produces no fabricated success evidence.
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
Issue status is blocked.

## QBOT-CODEX-WIN-ASSISTANT-213

- Linked cases: QBOT-NEG-ASSISTANT-ISSUE-089-MAIN
- OS: Windows
- Mode: hybrid shell + Electron UI
- Required tools: Codex; PowerShell; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $env:DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
Set-Location $env:DEEPBANK_REPO
npm run check
npm run build:ui
npm run codex:doctor
npm run codex:smoke
npm run e2e:doctor -- --scope=local
npm run e2e:local
```

### Assertions
**In scope**: - Fix the macOS release package so the app includes the matching Claude Code SDK native binary: `node_modules/@anthropic-ai/claude-agent-sdk-darwin-arm64/claude`. - Add a release verification guard that fails mac artifact verification when the packaged app lacks that darwin native binary. - Add focused release-helper tests for the new guard. - 
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
If required env, provider, GitLab, Docker, or OS prerequisite is missing, mark blocked/not-run with reason.

## QBOT-CODEX-MAC-ASSISTANT-214

- Linked cases: QBOT-NEG-ASSISTANT-ISSUE-089-MAIN
- OS: macOS
- Mode: hybrid shell + Electron UI
- Required tools: Codex; zsh/bash; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
cd "$DEEPBANK_REPO"
npm run check
npm run build:ui
npm run codex:doctor
npm run codex:smoke
npm run e2e:doctor -- --scope=local
npm run e2e:local
```

### Assertions
**In scope**: - Fix the macOS release package so the app includes the matching Claude Code SDK native binary: `node_modules/@anthropic-ai/claude-agent-sdk-darwin-arm64/claude`. - Add a release verification guard that fails mac artifact verification when the packaged app lacks that darwin native binary. - Add focused release-helper tests for the new guard. - 
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
If required env, provider, GitLab, Docker, or OS prerequisite is missing, mark blocked/not-run with reason.

## QBOT-CODEX-WIN-ASSISTANT-215

- Linked cases: QBOT-NEG-ASSISTANT-ISSUE-089-NEG
- OS: Windows
- Mode: hybrid shell + Electron UI
- Required tools: Codex; PowerShell; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $env:DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
Set-Location $env:DEEPBANK_REPO
npm run check
npm run build:ui
npm run codex:doctor
npm run codex:smoke
npm run e2e:doctor -- --scope=local
npm run e2e:local
```

### Assertions
The product reports blocked/failed/degraded state truthfully and produces no fabricated success evidence.
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
If required env, provider, GitLab, Docker, or OS prerequisite is missing, mark blocked/not-run with reason.

## QBOT-CODEX-MAC-ASSISTANT-216

- Linked cases: QBOT-NEG-ASSISTANT-ISSUE-089-NEG
- OS: macOS
- Mode: hybrid shell + Electron UI
- Required tools: Codex; zsh/bash; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
cd "$DEEPBANK_REPO"
npm run check
npm run build:ui
npm run codex:doctor
npm run codex:smoke
npm run e2e:doctor -- --scope=local
npm run e2e:local
```

### Assertions
The product reports blocked/failed/degraded state truthfully and produces no fabricated success evidence.
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
If required env, provider, GitLab, Docker, or OS prerequisite is missing, mark blocked/not-run with reason.

## QBOT-CODEX-WIN-ASSISTANT-217

- Linked cases: QBOT-FUNC-ASSISTANT-ISSUE-090-MAIN
- OS: Windows
- Mode: hybrid shell + Electron UI
- Required tools: Codex; PowerShell; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $env:DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
Set-Location $env:DEEPBANK_REPO
npm run check
npm run build:ui
npm run e2e:doctor -- --scope=local
npm run e2e:local
```

### Assertions
**Background**: 当前仓库已引入新的 `assets/lib/ui` UI 资产库，包含奇富科技品牌资产、设计 token、13 套主题 JSON、图标库、组件编目、模式文档、i18n 索引和主题引擎说明。Deepbank renderer 仍主要依赖 `src/app.css` / `src/qfin.css` 的页面级 class、硬编码色值和少量 `src/components/ui/*` 原语，尚未真正以新素材库为权威构建组件体系。 **Problem or task**: 把 `assets/lib/ui` 从“素材迁移目录”升级为 Deepbank UI 系统的实现依据：建立主题系统、图标系统、共享组件原语和模块级替换路径，完成现有主要 UI surface 的组件化替换和主题适配。 
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
If required env, provider, GitLab, Docker, or OS prerequisite is missing, mark blocked/not-run with reason.

## QBOT-CODEX-MAC-ASSISTANT-218

- Linked cases: QBOT-FUNC-ASSISTANT-ISSUE-090-MAIN
- OS: macOS
- Mode: hybrid shell + Electron UI
- Required tools: Codex; zsh/bash; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
cd "$DEEPBANK_REPO"
npm run check
npm run build:ui
npm run e2e:doctor -- --scope=local
npm run e2e:local
```

### Assertions
**Background**: 当前仓库已引入新的 `assets/lib/ui` UI 资产库，包含奇富科技品牌资产、设计 token、13 套主题 JSON、图标库、组件编目、模式文档、i18n 索引和主题引擎说明。Deepbank renderer 仍主要依赖 `src/app.css` / `src/qfin.css` 的页面级 class、硬编码色值和少量 `src/components/ui/*` 原语，尚未真正以新素材库为权威构建组件体系。 **Problem or task**: 把 `assets/lib/ui` 从“素材迁移目录”升级为 Deepbank UI 系统的实现依据：建立主题系统、图标系统、共享组件原语和模块级替换路径，完成现有主要 UI surface 的组件化替换和主题适配。 
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
If required env, provider, GitLab, Docker, or OS prerequisite is missing, mark blocked/not-run with reason.

## QBOT-CODEX-WIN-ASSISTANT-219

- Linked cases: QBOT-NEG-ASSISTANT-ISSUE-090-NEG
- OS: Windows
- Mode: hybrid shell + Electron UI
- Required tools: Codex; PowerShell; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $env:DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
Set-Location $env:DEEPBANK_REPO
npm run check
npm run build:ui
npm run e2e:doctor -- --scope=local
npm run e2e:local
```

### Assertions
The product reports blocked/failed/degraded state truthfully and produces no fabricated success evidence.
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
If required env, provider, GitLab, Docker, or OS prerequisite is missing, mark blocked/not-run with reason.

## QBOT-CODEX-MAC-ASSISTANT-220

- Linked cases: QBOT-NEG-ASSISTANT-ISSUE-090-NEG
- OS: macOS
- Mode: hybrid shell + Electron UI
- Required tools: Codex; zsh/bash; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
cd "$DEEPBANK_REPO"
npm run check
npm run build:ui
npm run e2e:doctor -- --scope=local
npm run e2e:local
```

### Assertions
The product reports blocked/failed/degraded state truthfully and produces no fabricated success evidence.
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
If required env, provider, GitLab, Docker, or OS prerequisite is missing, mark blocked/not-run with reason.

## QBOT-CODEX-WIN-ASSISTANT-221

- Linked cases: QBOT-NEG-ASSISTANT-ISSUE-091-MAIN
- OS: Windows
- Mode: hybrid shell + Electron UI
- Required tools: Codex; PowerShell; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $env:DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
Set-Location $env:DEEPBANK_REPO
npm run check
npm run build:ui
npm run codex:doctor
npm run codex:smoke
npm run e2e:doctor -- --scope=local
npm run e2e:local
```

### Assertions
**In scope**: - Fix the server-side remote runtime event-to-chat mapping for bound project sessions. - Keep remote runtime artifacts mirrored to the project workspace/artifact surface without rendering artifact/log text in the assistant thread. - Persist the final assistant transcript from the remote task status message, with an artifact fallback only when n
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
If required env, provider, GitLab, Docker, or OS prerequisite is missing, mark blocked/not-run with reason.

## QBOT-CODEX-MAC-ASSISTANT-222

- Linked cases: QBOT-NEG-ASSISTANT-ISSUE-091-MAIN
- OS: macOS
- Mode: hybrid shell + Electron UI
- Required tools: Codex; zsh/bash; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
cd "$DEEPBANK_REPO"
npm run check
npm run build:ui
npm run codex:doctor
npm run codex:smoke
npm run e2e:doctor -- --scope=local
npm run e2e:local
```

### Assertions
**In scope**: - Fix the server-side remote runtime event-to-chat mapping for bound project sessions. - Keep remote runtime artifacts mirrored to the project workspace/artifact surface without rendering artifact/log text in the assistant thread. - Persist the final assistant transcript from the remote task status message, with an artifact fallback only when n
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
If required env, provider, GitLab, Docker, or OS prerequisite is missing, mark blocked/not-run with reason.

## QBOT-CODEX-WIN-ASSISTANT-223

- Linked cases: QBOT-NEG-ASSISTANT-ISSUE-091-NEG
- OS: Windows
- Mode: hybrid shell + Electron UI
- Required tools: Codex; PowerShell; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $env:DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
Set-Location $env:DEEPBANK_REPO
npm run check
npm run build:ui
npm run codex:doctor
npm run codex:smoke
npm run e2e:doctor -- --scope=local
npm run e2e:local
```

### Assertions
The product reports blocked/failed/degraded state truthfully and produces no fabricated success evidence.
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
If required env, provider, GitLab, Docker, or OS prerequisite is missing, mark blocked/not-run with reason.

## QBOT-CODEX-MAC-ASSISTANT-224

- Linked cases: QBOT-NEG-ASSISTANT-ISSUE-091-NEG
- OS: macOS
- Mode: hybrid shell + Electron UI
- Required tools: Codex; zsh/bash; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
cd "$DEEPBANK_REPO"
npm run check
npm run build:ui
npm run codex:doctor
npm run codex:smoke
npm run e2e:doctor -- --scope=local
npm run e2e:local
```

### Assertions
The product reports blocked/failed/degraded state truthfully and produces no fabricated success evidence.
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
If required env, provider, GitLab, Docker, or OS prerequisite is missing, mark blocked/not-run with reason.

## QBOT-CODEX-WIN-RUNTIME-PROTOCOL-225

- Linked cases: QBOT-FUNC-RUNTIME-ISSUE-092-MAIN
- OS: Windows
- Mode: hybrid shell + Electron UI
- Required tools: Codex; PowerShell; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $env:DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
Set-Location $env:DEEPBANK_REPO
npm run check
npm run build:ui
npm run codex:doctor
npm run codex:smoke
```

### Assertions
**Background**: The WorkBuddy project module can be reduced to a repository plus issues, activity, members, agent assets, and runtime workspace. WorkBuddy adapts GitHub and TAPD as well; Deepbank only needs the private GitLab path. The user's analysis is directionally correct: project storage and collaboration should live in GitLab, and cloud execution shoul
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
Lingxi OAuth2 to GitLab token exchange dependency.

## QBOT-CODEX-MAC-RUNTIME-PROTOCOL-226

- Linked cases: QBOT-FUNC-RUNTIME-ISSUE-092-MAIN
- OS: macOS
- Mode: hybrid shell + Electron UI
- Required tools: Codex; zsh/bash; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
cd "$DEEPBANK_REPO"
npm run check
npm run build:ui
npm run codex:doctor
npm run codex:smoke
```

### Assertions
**Background**: The WorkBuddy project module can be reduced to a repository plus issues, activity, members, agent assets, and runtime workspace. WorkBuddy adapts GitHub and TAPD as well; Deepbank only needs the private GitLab path. The user's analysis is directionally correct: project storage and collaboration should live in GitLab, and cloud execution shoul
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
Lingxi OAuth2 to GitLab token exchange dependency.

## QBOT-CODEX-WIN-RUNTIME-PROTOCOL-227

- Linked cases: QBOT-NEG-RUNTIME-ISSUE-092-NEG
- OS: Windows
- Mode: hybrid shell + Electron UI
- Required tools: Codex; PowerShell; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $env:DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
Set-Location $env:DEEPBANK_REPO
npm run check
npm run build:ui
npm run codex:doctor
npm run codex:smoke
```

### Assertions
The product reports blocked/failed/degraded state truthfully and produces no fabricated success evidence.
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
Lingxi OAuth2 to GitLab token exchange dependency.

## QBOT-CODEX-MAC-RUNTIME-PROTOCOL-228

- Linked cases: QBOT-NEG-RUNTIME-ISSUE-092-NEG
- OS: macOS
- Mode: hybrid shell + Electron UI
- Required tools: Codex; zsh/bash; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
cd "$DEEPBANK_REPO"
npm run check
npm run build:ui
npm run codex:doctor
npm run codex:smoke
```

### Assertions
The product reports blocked/failed/degraded state truthfully and produces no fabricated success evidence.
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
Lingxi OAuth2 to GitLab token exchange dependency.

## QBOT-CODEX-WIN-PROJECTS-GITLAB-229

- Linked cases: QBOT-FUNC-PROJECTS-ISSUE-093-MAIN
- OS: Windows
- Mode: hybrid shell + Electron UI
- Required tools: Codex; PowerShell; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $env:DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
Set-Location $env:DEEPBANK_REPO
npm run check
npm run build:ui
npm run e2e:doctor -- --scope=local
npm run e2e:local
```

### Assertions
**Background**: The accepted architecture makes GitLab project/repo the project source of truth and Deepbank DB the control-plane link/cache/runtime-binding layer. **Problem**: Current `projects` rows store `instruction`, `work_dir`, `skills`, `experts`, `connectors`, and local `project_members` as authoritative state. That shape prevents GitLab repo-based p
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
If required env, provider, GitLab, Docker, or OS prerequisite is missing, mark blocked/not-run with reason.

## QBOT-CODEX-MAC-PROJECTS-GITLAB-230

- Linked cases: QBOT-FUNC-PROJECTS-ISSUE-093-MAIN
- OS: macOS
- Mode: hybrid shell + Electron UI
- Required tools: Codex; zsh/bash; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
cd "$DEEPBANK_REPO"
npm run check
npm run build:ui
npm run e2e:doctor -- --scope=local
npm run e2e:local
```

### Assertions
**Background**: The accepted architecture makes GitLab project/repo the project source of truth and Deepbank DB the control-plane link/cache/runtime-binding layer. **Problem**: Current `projects` rows store `instruction`, `work_dir`, `skills`, `experts`, `connectors`, and local `project_members` as authoritative state. That shape prevents GitLab repo-based p
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
If required env, provider, GitLab, Docker, or OS prerequisite is missing, mark blocked/not-run with reason.

## QBOT-CODEX-WIN-PROJECTS-GITLAB-231

- Linked cases: QBOT-NEG-PROJECTS-ISSUE-093-NEG
- OS: Windows
- Mode: hybrid shell + Electron UI
- Required tools: Codex; PowerShell; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $env:DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
Set-Location $env:DEEPBANK_REPO
npm run check
npm run build:ui
npm run e2e:doctor -- --scope=local
npm run e2e:local
```

### Assertions
The product reports blocked/failed/degraded state truthfully and produces no fabricated success evidence.
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
If required env, provider, GitLab, Docker, or OS prerequisite is missing, mark blocked/not-run with reason.

## QBOT-CODEX-MAC-PROJECTS-GITLAB-232

- Linked cases: QBOT-NEG-PROJECTS-ISSUE-093-NEG
- OS: macOS
- Mode: hybrid shell + Electron UI
- Required tools: Codex; zsh/bash; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
cd "$DEEPBANK_REPO"
npm run check
npm run build:ui
npm run e2e:doctor -- --scope=local
npm run e2e:local
```

### Assertions
The product reports blocked/failed/degraded state truthfully and produces no fabricated success evidence.
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
If required env, provider, GitLab, Docker, or OS prerequisite is missing, mark blocked/not-run with reason.

## QBOT-CODEX-WIN-RUNTIME-PROTOCOL-233

- Linked cases: QBOT-FUNC-RUNTIME-ISSUE-094-MAIN
- OS: Windows
- Mode: shell + Codex CLI/runtime artifacts
- Required tools: Codex; PowerShell; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $env:DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
Set-Location $env:DEEPBANK_REPO
npm run check
npm run codex:doctor
npm run codex:smoke
```

### Assertions
**Background**: Repo-owned config replaces DB-stored `instruction`, `skills`, `experts`, and `connectors`. `.deepbank/project.yaml` is the canonical Deepbank project config entrypoint. **Problem**: The current ADK GitLab file tool is read-oriented (`search`, `get`, `get_files`). GitLab-backed project config requires create/update/delete file operations, bran
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
If required env, provider, GitLab, Docker, or OS prerequisite is missing, mark blocked/not-run with reason.

## QBOT-CODEX-MAC-RUNTIME-PROTOCOL-234

- Linked cases: QBOT-FUNC-RUNTIME-ISSUE-094-MAIN
- OS: macOS
- Mode: shell + Codex CLI/runtime artifacts
- Required tools: Codex; zsh/bash; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
cd "$DEEPBANK_REPO"
npm run check
npm run codex:doctor
npm run codex:smoke
```

### Assertions
**Background**: Repo-owned config replaces DB-stored `instruction`, `skills`, `experts`, and `connectors`. `.deepbank/project.yaml` is the canonical Deepbank project config entrypoint. **Problem**: The current ADK GitLab file tool is read-oriented (`search`, `get`, `get_files`). GitLab-backed project config requires create/update/delete file operations, bran
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
If required env, provider, GitLab, Docker, or OS prerequisite is missing, mark blocked/not-run with reason.

## QBOT-CODEX-WIN-RUNTIME-PROTOCOL-235

- Linked cases: QBOT-NEG-RUNTIME-ISSUE-094-NEG
- OS: Windows
- Mode: shell + Codex CLI/runtime artifacts
- Required tools: Codex; PowerShell; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $env:DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
Set-Location $env:DEEPBANK_REPO
npm run check
npm run codex:doctor
npm run codex:smoke
```

### Assertions
The product reports blocked/failed/degraded state truthfully and produces no fabricated success evidence.
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
If required env, provider, GitLab, Docker, or OS prerequisite is missing, mark blocked/not-run with reason.

## QBOT-CODEX-MAC-RUNTIME-PROTOCOL-236

- Linked cases: QBOT-NEG-RUNTIME-ISSUE-094-NEG
- OS: macOS
- Mode: shell + Codex CLI/runtime artifacts
- Required tools: Codex; zsh/bash; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
cd "$DEEPBANK_REPO"
npm run check
npm run codex:doctor
npm run codex:smoke
```

### Assertions
The product reports blocked/failed/degraded state truthfully and produces no fabricated success evidence.
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
If required env, provider, GitLab, Docker, or OS prerequisite is missing, mark blocked/not-run with reason.

## QBOT-CODEX-WIN-PROJECTS-GITLAB-237

- Linked cases: QBOT-FUNC-PROJECTS-ISSUE-095-MAIN
- OS: Windows
- Mode: hybrid shell + Electron UI
- Required tools: Codex; PowerShell; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $env:DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
Set-Location $env:DEEPBANK_REPO
npm run check
npm run build:ui
npm run e2e:doctor -- --scope=local
npm run e2e:local
```

### Assertions
**Background**: WorkBuddy plan maps naturally to GitLab issues with status labels; activity maps to events, notes, assignment changes, commits, MRs, and webhooks; members map to GitLab project/group members. **Problem**: Deepbank currently manages project members locally and has no GitLab-backed plan/activity surface. **Desired outcome**: Deepbank project wo
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
If required env, provider, GitLab, Docker, or OS prerequisite is missing, mark blocked/not-run with reason.

## QBOT-CODEX-MAC-PROJECTS-GITLAB-238

- Linked cases: QBOT-FUNC-PROJECTS-ISSUE-095-MAIN
- OS: macOS
- Mode: hybrid shell + Electron UI
- Required tools: Codex; zsh/bash; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
cd "$DEEPBANK_REPO"
npm run check
npm run build:ui
npm run e2e:doctor -- --scope=local
npm run e2e:local
```

### Assertions
**Background**: WorkBuddy plan maps naturally to GitLab issues with status labels; activity maps to events, notes, assignment changes, commits, MRs, and webhooks; members map to GitLab project/group members. **Problem**: Deepbank currently manages project members locally and has no GitLab-backed plan/activity surface. **Desired outcome**: Deepbank project wo
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
If required env, provider, GitLab, Docker, or OS prerequisite is missing, mark blocked/not-run with reason.

## QBOT-CODEX-WIN-PROJECTS-GITLAB-239

- Linked cases: QBOT-NEG-PROJECTS-ISSUE-095-NEG
- OS: Windows
- Mode: hybrid shell + Electron UI
- Required tools: Codex; PowerShell; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $env:DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
Set-Location $env:DEEPBANK_REPO
npm run check
npm run build:ui
npm run e2e:doctor -- --scope=local
npm run e2e:local
```

### Assertions
The product reports blocked/failed/degraded state truthfully and produces no fabricated success evidence.
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
If required env, provider, GitLab, Docker, or OS prerequisite is missing, mark blocked/not-run with reason.

## QBOT-CODEX-MAC-PROJECTS-GITLAB-240

- Linked cases: QBOT-NEG-PROJECTS-ISSUE-095-NEG
- OS: macOS
- Mode: hybrid shell + Electron UI
- Required tools: Codex; zsh/bash; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
cd "$DEEPBANK_REPO"
npm run check
npm run build:ui
npm run e2e:doctor -- --scope=local
npm run e2e:local
```

### Assertions
The product reports blocked/failed/degraded state truthfully and produces no fabricated success evidence.
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
If required env, provider, GitLab, Docker, or OS prerequisite is missing, mark blocked/not-run with reason.

## QBOT-CODEX-WIN-RUNTIME-PROTOCOL-241

- Linked cases: QBOT-FUNC-RUNTIME-ISSUE-096-MAIN
- OS: Windows
- Mode: hybrid shell + Electron UI
- Required tools: Codex; PowerShell; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $env:DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
Set-Location $env:DEEPBANK_REPO
npm run check
npm run codex:doctor
npm run codex:smoke
npm run e2e:doctor -- --scope=local
npm run e2e:local
```

### Assertions
**Background**: ADK already supports pod-first hosted runtime, Linux-user identity, durable workspace repo resources, project-dir uniqueness, and provider process ownership. Deepbank already routes bound project turns to ADK runtime A2A streaming. **Problem**: Deepbank runtime binding currently derives project paths from runtime metadata or local project roo
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
Lingxi OAuth2 to GitLab token exchange dependency.

## QBOT-CODEX-MAC-RUNTIME-PROTOCOL-242

- Linked cases: QBOT-FUNC-RUNTIME-ISSUE-096-MAIN
- OS: macOS
- Mode: hybrid shell + Electron UI
- Required tools: Codex; zsh/bash; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
cd "$DEEPBANK_REPO"
npm run check
npm run codex:doctor
npm run codex:smoke
npm run e2e:doctor -- --scope=local
npm run e2e:local
```

### Assertions
**Background**: ADK already supports pod-first hosted runtime, Linux-user identity, durable workspace repo resources, project-dir uniqueness, and provider process ownership. Deepbank already routes bound project turns to ADK runtime A2A streaming. **Problem**: Deepbank runtime binding currently derives project paths from runtime metadata or local project roo
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
Lingxi OAuth2 to GitLab token exchange dependency.

## QBOT-CODEX-WIN-RUNTIME-PROTOCOL-243

- Linked cases: QBOT-NEG-RUNTIME-ISSUE-096-NEG
- OS: Windows
- Mode: hybrid shell + Electron UI
- Required tools: Codex; PowerShell; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $env:DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
Set-Location $env:DEEPBANK_REPO
npm run check
npm run codex:doctor
npm run codex:smoke
npm run e2e:doctor -- --scope=local
npm run e2e:local
```

### Assertions
The product reports blocked/failed/degraded state truthfully and produces no fabricated success evidence.
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
Lingxi OAuth2 to GitLab token exchange dependency.

## QBOT-CODEX-MAC-RUNTIME-PROTOCOL-244

- Linked cases: QBOT-NEG-RUNTIME-ISSUE-096-NEG
- OS: macOS
- Mode: hybrid shell + Electron UI
- Required tools: Codex; zsh/bash; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
cd "$DEEPBANK_REPO"
npm run check
npm run codex:doctor
npm run codex:smoke
npm run e2e:doctor -- --scope=local
npm run e2e:local
```

### Assertions
The product reports blocked/failed/degraded state truthfully and produces no fabricated success evidence.
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
Lingxi OAuth2 to GitLab token exchange dependency.

## QBOT-CODEX-WIN-RUNTIME-PROTOCOL-245

- Linked cases: QBOT-FUNC-RUNTIME-ISSUE-097-MAIN
- OS: Windows
- Mode: shell + Codex CLI/runtime artifacts
- Required tools: Codex; PowerShell; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $env:DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
Set-Location $env:DEEPBANK_REPO
npm run check
npm run codex:doctor
npm run codex:smoke
```

### Assertions
**Background**: Project skills and MCP should be repo-owned so capability changes are versioned, reviewable, auditable, and naturally travel with the GitLab repo. **Problem**: Claude project-scope skills/MCP have ADK support. Codex currently materializes MCP into `CODEX_HOME/config.toml`, but ADK Codex provider reports `skills=[]` and supports no skill insta
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
If required env, provider, GitLab, Docker, or OS prerequisite is missing, mark blocked/not-run with reason.

## QBOT-CODEX-MAC-RUNTIME-PROTOCOL-246

- Linked cases: QBOT-FUNC-RUNTIME-ISSUE-097-MAIN
- OS: macOS
- Mode: shell + Codex CLI/runtime artifacts
- Required tools: Codex; zsh/bash; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
cd "$DEEPBANK_REPO"
npm run check
npm run codex:doctor
npm run codex:smoke
```

### Assertions
**Background**: Project skills and MCP should be repo-owned so capability changes are versioned, reviewable, auditable, and naturally travel with the GitLab repo. **Problem**: Claude project-scope skills/MCP have ADK support. Codex currently materializes MCP into `CODEX_HOME/config.toml`, but ADK Codex provider reports `skills=[]` and supports no skill insta
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
If required env, provider, GitLab, Docker, or OS prerequisite is missing, mark blocked/not-run with reason.

## QBOT-CODEX-WIN-RUNTIME-PROTOCOL-247

- Linked cases: QBOT-NEG-RUNTIME-ISSUE-097-NEG
- OS: Windows
- Mode: shell + Codex CLI/runtime artifacts
- Required tools: Codex; PowerShell; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $env:DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
Set-Location $env:DEEPBANK_REPO
npm run check
npm run codex:doctor
npm run codex:smoke
```

### Assertions
The product reports blocked/failed/degraded state truthfully and produces no fabricated success evidence.
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
If required env, provider, GitLab, Docker, or OS prerequisite is missing, mark blocked/not-run with reason.

## QBOT-CODEX-MAC-RUNTIME-PROTOCOL-248

- Linked cases: QBOT-NEG-RUNTIME-ISSUE-097-NEG
- OS: macOS
- Mode: shell + Codex CLI/runtime artifacts
- Required tools: Codex; zsh/bash; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
cd "$DEEPBANK_REPO"
npm run check
npm run codex:doctor
npm run codex:smoke
```

### Assertions
The product reports blocked/failed/degraded state truthfully and produces no fabricated success evidence.
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
If required env, provider, GitLab, Docker, or OS prerequisite is missing, mark blocked/not-run with reason.

## QBOT-CODEX-WIN-ASSISTANT-249

- Linked cases: QBOT-FUNC-ASSISTANT-ISSUE-098-MAIN
- OS: Windows
- Mode: hybrid shell + Electron UI
- Required tools: Codex; PowerShell; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $env:DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
Set-Location $env:DEEPBANK_REPO
npm run check
npm run build:ui
npm run e2e:doctor -- --scope=local
npm run e2e:local
```

### Assertions
**Background**: The current prototype UI still contains DB-backed instructions, skills, experts, connectors, members, runtime binding, and local artifact assumptions. **Problem**: Once GitLab becomes project source of truth, `ProjectsView` and related `window.agent.*` contracts must display GitLab projects, plan issues, activity, members, repo config, runtim
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
Lingxi OAuth2 to GitLab token exchange dependency.

## QBOT-CODEX-MAC-ASSISTANT-250

- Linked cases: QBOT-FUNC-ASSISTANT-ISSUE-098-MAIN
- OS: macOS
- Mode: hybrid shell + Electron UI
- Required tools: Codex; zsh/bash; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
cd "$DEEPBANK_REPO"
npm run check
npm run build:ui
npm run e2e:doctor -- --scope=local
npm run e2e:local
```

### Assertions
**Background**: The current prototype UI still contains DB-backed instructions, skills, experts, connectors, members, runtime binding, and local artifact assumptions. **Problem**: Once GitLab becomes project source of truth, `ProjectsView` and related `window.agent.*` contracts must display GitLab projects, plan issues, activity, members, repo config, runtim
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
Lingxi OAuth2 to GitLab token exchange dependency.

## QBOT-CODEX-WIN-ASSISTANT-251

- Linked cases: QBOT-NEG-ASSISTANT-ISSUE-098-NEG
- OS: Windows
- Mode: hybrid shell + Electron UI
- Required tools: Codex; PowerShell; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $env:DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
Set-Location $env:DEEPBANK_REPO
npm run check
npm run build:ui
npm run e2e:doctor -- --scope=local
npm run e2e:local
```

### Assertions
The product reports blocked/failed/degraded state truthfully and produces no fabricated success evidence.
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
Lingxi OAuth2 to GitLab token exchange dependency.

## QBOT-CODEX-MAC-ASSISTANT-252

- Linked cases: QBOT-NEG-ASSISTANT-ISSUE-098-NEG
- OS: macOS
- Mode: hybrid shell + Electron UI
- Required tools: Codex; zsh/bash; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
cd "$DEEPBANK_REPO"
npm run check
npm run build:ui
npm run e2e:doctor -- --scope=local
npm run e2e:local
```

### Assertions
The product reports blocked/failed/degraded state truthfully and produces no fabricated success evidence.
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
Lingxi OAuth2 to GitLab token exchange dependency.

## QBOT-CODEX-WIN-RUNTIME-PROTOCOL-253

- Linked cases: QBOT-FUNC-RUNTIME-ISSUE-100-MAIN
- OS: Windows
- Mode: hybrid shell + Electron UI
- Required tools: Codex; PowerShell; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $env:DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
Set-Location $env:DEEPBANK_REPO
npm run check
npm run build:ui
npm run codex:doctor
npm run codex:smoke
npm run e2e:doctor -- --scope=local
npm run e2e:local
```

### Assertions
**Behaviors to cover**: - #93 project meta/domain contract, redacted payloads, historical-local state boundary. - #94 repo/file/branch/MR adapter, `.deepbank/project.yaml`, conflicts, protected branch paths. - #95 issues/events/members adapter normalization, status labels, assignee filters, permission denial. - #96 ADK workspace repo runtime binding, auth bi
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
Lingxi OAuth2 to GitLab token exchange dependency.

## QBOT-CODEX-MAC-RUNTIME-PROTOCOL-254

- Linked cases: QBOT-FUNC-RUNTIME-ISSUE-100-MAIN
- OS: macOS
- Mode: hybrid shell + Electron UI
- Required tools: Codex; zsh/bash; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
cd "$DEEPBANK_REPO"
npm run check
npm run build:ui
npm run codex:doctor
npm run codex:smoke
npm run e2e:doctor -- --scope=local
npm run e2e:local
```

### Assertions
**Behaviors to cover**: - #93 project meta/domain contract, redacted payloads, historical-local state boundary. - #94 repo/file/branch/MR adapter, `.deepbank/project.yaml`, conflicts, protected branch paths. - #95 issues/events/members adapter normalization, status labels, assignee filters, permission denial. - #96 ADK workspace repo runtime binding, auth bi
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
Lingxi OAuth2 to GitLab token exchange dependency.

## QBOT-CODEX-WIN-RUNTIME-PROTOCOL-255

- Linked cases: QBOT-NEG-RUNTIME-ISSUE-100-NEG
- OS: Windows
- Mode: hybrid shell + Electron UI
- Required tools: Codex; PowerShell; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $env:DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
Set-Location $env:DEEPBANK_REPO
npm run check
npm run build:ui
npm run codex:doctor
npm run codex:smoke
npm run e2e:doctor -- --scope=local
npm run e2e:local
```

### Assertions
The product reports blocked/failed/degraded state truthfully and produces no fabricated success evidence.
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
Lingxi OAuth2 to GitLab token exchange dependency.

## QBOT-CODEX-MAC-RUNTIME-PROTOCOL-256

- Linked cases: QBOT-NEG-RUNTIME-ISSUE-100-NEG
- OS: macOS
- Mode: hybrid shell + Electron UI
- Required tools: Codex; zsh/bash; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
cd "$DEEPBANK_REPO"
npm run check
npm run build:ui
npm run codex:doctor
npm run codex:smoke
npm run e2e:doctor -- --scope=local
npm run e2e:local
```

### Assertions
The product reports blocked/failed/degraded state truthfully and produces no fabricated success evidence.
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
Lingxi OAuth2 to GitLab token exchange dependency.

## QBOT-CODEX-WIN-RUNTIME-PROTOCOL-257

- Linked cases: QBOT-FUNC-RUNTIME-ISSUE-101-MAIN
- OS: Windows
- Mode: hybrid shell + Electron UI
- Required tools: Codex; PowerShell; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $env:DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
Set-Location $env:DEEPBANK_REPO
npm run check
npm run codex:doctor
npm run codex:smoke
npm run e2e:doctor -- --scope=local
npm run e2e:local
```

### Assertions
**Exact files or behaviors to cover**: - Runtime family selection and local execution for Claude Code and Codex through server/engine.mjs and runtime-family.mjs. - Deepbank websocket/session transcript contract: part, stat, toolresult, ask, done, error, cancel, agentSessionId, resume/session continuity, and JSONL transcript persistence. - SDK raw event/messa
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
Requires explicit real-provider environment.

## QBOT-CODEX-MAC-RUNTIME-PROTOCOL-258

- Linked cases: QBOT-FUNC-RUNTIME-ISSUE-101-MAIN
- OS: macOS
- Mode: hybrid shell + Electron UI
- Required tools: Codex; zsh/bash; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
cd "$DEEPBANK_REPO"
npm run check
npm run codex:doctor
npm run codex:smoke
npm run e2e:doctor -- --scope=local
npm run e2e:local
```

### Assertions
**Exact files or behaviors to cover**: - Runtime family selection and local execution for Claude Code and Codex through server/engine.mjs and runtime-family.mjs. - Deepbank websocket/session transcript contract: part, stat, toolresult, ask, done, error, cancel, agentSessionId, resume/session continuity, and JSONL transcript persistence. - SDK raw event/messa
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
Requires explicit real-provider environment.

## QBOT-CODEX-WIN-RUNTIME-PROTOCOL-259

- Linked cases: QBOT-NEG-RUNTIME-ISSUE-101-NEG
- OS: Windows
- Mode: hybrid shell + Electron UI
- Required tools: Codex; PowerShell; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $env:DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
Set-Location $env:DEEPBANK_REPO
npm run check
npm run codex:doctor
npm run codex:smoke
npm run e2e:doctor -- --scope=local
npm run e2e:local
```

### Assertions
The product reports blocked/failed/degraded state truthfully and produces no fabricated success evidence.
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
Requires explicit real-provider environment.

## QBOT-CODEX-MAC-RUNTIME-PROTOCOL-260

- Linked cases: QBOT-NEG-RUNTIME-ISSUE-101-NEG
- OS: macOS
- Mode: hybrid shell + Electron UI
- Required tools: Codex; zsh/bash; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
cd "$DEEPBANK_REPO"
npm run check
npm run codex:doctor
npm run codex:smoke
npm run e2e:doctor -- --scope=local
npm run e2e:local
```

### Assertions
The product reports blocked/failed/degraded state truthfully and produces no fabricated success evidence.
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
Requires explicit real-provider environment.

## QBOT-CODEX-WIN-RUNTIME-PROTOCOL-261

- Linked cases: QBOT-FUNC-RUNTIME-ISSUE-102-MAIN
- OS: Windows
- Mode: hybrid shell + Electron UI
- Required tools: Codex; PowerShell; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $env:DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
Set-Location $env:DEEPBANK_REPO
npm run check
npm run codex:doctor
npm run codex:smoke
npm run e2e:doctor -- --scope=local
npm run e2e:local
```

### Assertions
**Exact files or behaviors to cover**: - Add extractor tooling under scripts/ and structured output under ignored test-results/runtime-features/ plus a reviewable classified baseline under test/runtime-features/ when appropriate. - Parse installed package versions from node_modules/@anthropic-ai/claude-agent-sdk/package.json and node_modules/@openai/codex-sd
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
Requires explicit real-provider environment.

## QBOT-CODEX-MAC-RUNTIME-PROTOCOL-262

- Linked cases: QBOT-FUNC-RUNTIME-ISSUE-102-MAIN
- OS: macOS
- Mode: hybrid shell + Electron UI
- Required tools: Codex; zsh/bash; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
cd "$DEEPBANK_REPO"
npm run check
npm run codex:doctor
npm run codex:smoke
npm run e2e:doctor -- --scope=local
npm run e2e:local
```

### Assertions
**Exact files or behaviors to cover**: - Add extractor tooling under scripts/ and structured output under ignored test-results/runtime-features/ plus a reviewable classified baseline under test/runtime-features/ when appropriate. - Parse installed package versions from node_modules/@anthropic-ai/claude-agent-sdk/package.json and node_modules/@openai/codex-sd
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
Requires explicit real-provider environment.

## QBOT-CODEX-WIN-RUNTIME-PROTOCOL-263

- Linked cases: QBOT-NEG-RUNTIME-ISSUE-102-NEG
- OS: Windows
- Mode: hybrid shell + Electron UI
- Required tools: Codex; PowerShell; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $env:DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
Set-Location $env:DEEPBANK_REPO
npm run check
npm run codex:doctor
npm run codex:smoke
npm run e2e:doctor -- --scope=local
npm run e2e:local
```

### Assertions
The product reports blocked/failed/degraded state truthfully and produces no fabricated success evidence.
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
Requires explicit real-provider environment.

## QBOT-CODEX-MAC-RUNTIME-PROTOCOL-264

- Linked cases: QBOT-NEG-RUNTIME-ISSUE-102-NEG
- OS: macOS
- Mode: hybrid shell + Electron UI
- Required tools: Codex; zsh/bash; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
cd "$DEEPBANK_REPO"
npm run check
npm run codex:doctor
npm run codex:smoke
npm run e2e:doctor -- --scope=local
npm run e2e:local
```

### Assertions
The product reports blocked/failed/degraded state truthfully and produces no fabricated success evidence.
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
Requires explicit real-provider environment.

## QBOT-CODEX-WIN-RUNTIME-PROTOCOL-265

- Linked cases: QBOT-FUNC-RUNTIME-ISSUE-103-MAIN
- OS: Windows
- Mode: shell + Codex CLI/runtime artifacts
- Required tools: Codex; PowerShell; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $env:DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
Set-Location $env:DEEPBANK_REPO
npm run check
npm run codex:doctor
npm run codex:smoke
```

### Assertions
**Exact files or behaviors to cover**: - Introduce pure normalization helpers or thin wrappers where provider adapters are currently embedded in server/engine.mjs or runtime-family.mjs. - Add synthetic raw event fixtures for Claude SDKMessage families and Codex ThreadEvent streams. - Assert normalized Deepbank outputs for part, stat, toolresult, ask, done, e
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
Requires explicit real-provider environment.

## QBOT-CODEX-MAC-RUNTIME-PROTOCOL-266

- Linked cases: QBOT-FUNC-RUNTIME-ISSUE-103-MAIN
- OS: macOS
- Mode: shell + Codex CLI/runtime artifacts
- Required tools: Codex; zsh/bash; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
cd "$DEEPBANK_REPO"
npm run check
npm run codex:doctor
npm run codex:smoke
```

### Assertions
**Exact files or behaviors to cover**: - Introduce pure normalization helpers or thin wrappers where provider adapters are currently embedded in server/engine.mjs or runtime-family.mjs. - Add synthetic raw event fixtures for Claude SDKMessage families and Codex ThreadEvent streams. - Assert normalized Deepbank outputs for part, stat, toolresult, ask, done, e
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
Requires explicit real-provider environment.

## QBOT-CODEX-WIN-RUNTIME-PROTOCOL-267

- Linked cases: QBOT-NEG-RUNTIME-ISSUE-103-NEG
- OS: Windows
- Mode: shell + Codex CLI/runtime artifacts
- Required tools: Codex; PowerShell; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $env:DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
Set-Location $env:DEEPBANK_REPO
npm run check
npm run codex:doctor
npm run codex:smoke
```

### Assertions
The product reports blocked/failed/degraded state truthfully and produces no fabricated success evidence.
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
Requires explicit real-provider environment.

## QBOT-CODEX-MAC-RUNTIME-PROTOCOL-268

- Linked cases: QBOT-NEG-RUNTIME-ISSUE-103-NEG
- OS: macOS
- Mode: shell + Codex CLI/runtime artifacts
- Required tools: Codex; zsh/bash; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
cd "$DEEPBANK_REPO"
npm run check
npm run codex:doctor
npm run codex:smoke
```

### Assertions
The product reports blocked/failed/degraded state truthfully and produces no fabricated success evidence.
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
Requires explicit real-provider environment.

## QBOT-CODEX-WIN-ASSISTANT-269

- Linked cases: QBOT-FUNC-ASSISTANT-ISSUE-104-MAIN
- OS: Windows
- Mode: hybrid shell + Electron UI
- Required tools: Codex; PowerShell; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $env:DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
Set-Location $env:DEEPBANK_REPO
npm run check
npm run build:ui
npm run codex:doctor
npm run codex:smoke
npm run e2e:doctor -- --scope=local
npm run e2e:local
```

### Assertions
**Exact files or behaviors to cover**: - Add Claude Code cases to the runtime feature case registry from #106. - Cover streaming text/thinking, built-in tools, AskUserQuestion, subagent/Task/Agent delegation, parallel subagents, MCP tools/elicitation, permission denial, hook lifecycle, plan mode, resume, cancel, and transcript persistence. - Capture both raw
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
Requires explicit real-provider environment.

## QBOT-CODEX-MAC-ASSISTANT-270

- Linked cases: QBOT-FUNC-ASSISTANT-ISSUE-104-MAIN
- OS: macOS
- Mode: hybrid shell + Electron UI
- Required tools: Codex; zsh/bash; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
cd "$DEEPBANK_REPO"
npm run check
npm run build:ui
npm run codex:doctor
npm run codex:smoke
npm run e2e:doctor -- --scope=local
npm run e2e:local
```

### Assertions
**Exact files or behaviors to cover**: - Add Claude Code cases to the runtime feature case registry from #106. - Cover streaming text/thinking, built-in tools, AskUserQuestion, subagent/Task/Agent delegation, parallel subagents, MCP tools/elicitation, permission denial, hook lifecycle, plan mode, resume, cancel, and transcript persistence. - Capture both raw
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
Requires explicit real-provider environment.

## QBOT-CODEX-WIN-ASSISTANT-271

- Linked cases: QBOT-NEG-ASSISTANT-ISSUE-104-NEG
- OS: Windows
- Mode: hybrid shell + Electron UI
- Required tools: Codex; PowerShell; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $env:DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
Set-Location $env:DEEPBANK_REPO
npm run check
npm run build:ui
npm run codex:doctor
npm run codex:smoke
npm run e2e:doctor -- --scope=local
npm run e2e:local
```

### Assertions
The product reports blocked/failed/degraded state truthfully and produces no fabricated success evidence.
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
Requires explicit real-provider environment.

## QBOT-CODEX-MAC-ASSISTANT-272

- Linked cases: QBOT-NEG-ASSISTANT-ISSUE-104-NEG
- OS: macOS
- Mode: hybrid shell + Electron UI
- Required tools: Codex; zsh/bash; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
cd "$DEEPBANK_REPO"
npm run check
npm run build:ui
npm run codex:doctor
npm run codex:smoke
npm run e2e:doctor -- --scope=local
npm run e2e:local
```

### Assertions
The product reports blocked/failed/degraded state truthfully and produces no fabricated success evidence.
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
Requires explicit real-provider environment.

## QBOT-CODEX-WIN-RUNTIME-PROTOCOL-273

- Linked cases: QBOT-FUNC-RUNTIME-ISSUE-105-MAIN
- OS: Windows
- Mode: hybrid shell + Electron UI
- Required tools: Codex; PowerShell; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $env:DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
Set-Location $env:DEEPBANK_REPO
npm run check
npm run codex:doctor
npm run codex:smoke
npm run e2e:doctor -- --scope=local
npm run e2e:local
```

### Assertions
**Exact files or behaviors to cover**: - Add Codex cases to the runtime feature case registry from #106. - Cover ThreadEvent lifecycle: thread.started, turn.started, item.started, item.updated, item.completed, turn.completed, turn.failed, and error. - Cover ThreadItem types: agent_message, reasoning, command_execution, file_change, mcp_tool_call, web_search,
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
Requires explicit real-provider environment.

## QBOT-CODEX-MAC-RUNTIME-PROTOCOL-274

- Linked cases: QBOT-FUNC-RUNTIME-ISSUE-105-MAIN
- OS: macOS
- Mode: hybrid shell + Electron UI
- Required tools: Codex; zsh/bash; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
cd "$DEEPBANK_REPO"
npm run check
npm run codex:doctor
npm run codex:smoke
npm run e2e:doctor -- --scope=local
npm run e2e:local
```

### Assertions
**Exact files or behaviors to cover**: - Add Codex cases to the runtime feature case registry from #106. - Cover ThreadEvent lifecycle: thread.started, turn.started, item.started, item.updated, item.completed, turn.completed, turn.failed, and error. - Cover ThreadItem types: agent_message, reasoning, command_execution, file_change, mcp_tool_call, web_search,
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
Requires explicit real-provider environment.

## QBOT-CODEX-WIN-RUNTIME-PROTOCOL-275

- Linked cases: QBOT-NEG-RUNTIME-ISSUE-105-NEG
- OS: Windows
- Mode: hybrid shell + Electron UI
- Required tools: Codex; PowerShell; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $env:DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
Set-Location $env:DEEPBANK_REPO
npm run check
npm run codex:doctor
npm run codex:smoke
npm run e2e:doctor -- --scope=local
npm run e2e:local
```

### Assertions
The product reports blocked/failed/degraded state truthfully and produces no fabricated success evidence.
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
Requires explicit real-provider environment.

## QBOT-CODEX-MAC-RUNTIME-PROTOCOL-276

- Linked cases: QBOT-NEG-RUNTIME-ISSUE-105-NEG
- OS: macOS
- Mode: hybrid shell + Electron UI
- Required tools: Codex; zsh/bash; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
cd "$DEEPBANK_REPO"
npm run check
npm run codex:doctor
npm run codex:smoke
npm run e2e:doctor -- --scope=local
npm run e2e:local
```

### Assertions
The product reports blocked/failed/degraded state truthfully and produces no fabricated success evidence.
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
Requires explicit real-provider environment.

## QBOT-CODEX-WIN-ASSISTANT-277

- Linked cases: QBOT-FUNC-ASSISTANT-ISSUE-106-MAIN
- OS: Windows
- Mode: hybrid shell + Electron UI
- Required tools: Codex; PowerShell; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $env:DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
Set-Location $env:DEEPBANK_REPO
npm run check
npm run build:ui
npm run codex:doctor
npm run codex:smoke
npm run e2e:doctor -- --scope=local
npm run e2e:local
```

### Assertions
**Exact files or behaviors to cover**: - Add a case registry under test/runtime-features/ with schema validation. - Add runner tooling under scripts/ that supports deterministic fixture mode, local mock/WS mode, SDK-direct mode, and gated real-provider mode. - Save raw SDK JSONL, normalized WS events, transcript excerpts, redaction reports, run metadata, and
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
Requires explicit real-provider environment.

## QBOT-CODEX-MAC-ASSISTANT-278

- Linked cases: QBOT-FUNC-ASSISTANT-ISSUE-106-MAIN
- OS: macOS
- Mode: hybrid shell + Electron UI
- Required tools: Codex; zsh/bash; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
cd "$DEEPBANK_REPO"
npm run check
npm run build:ui
npm run codex:doctor
npm run codex:smoke
npm run e2e:doctor -- --scope=local
npm run e2e:local
```

### Assertions
**Exact files or behaviors to cover**: - Add a case registry under test/runtime-features/ with schema validation. - Add runner tooling under scripts/ that supports deterministic fixture mode, local mock/WS mode, SDK-direct mode, and gated real-provider mode. - Save raw SDK JSONL, normalized WS events, transcript excerpts, redaction reports, run metadata, and
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
Requires explicit real-provider environment.

## QBOT-CODEX-WIN-ASSISTANT-279

- Linked cases: QBOT-NEG-ASSISTANT-ISSUE-106-NEG
- OS: Windows
- Mode: hybrid shell + Electron UI
- Required tools: Codex; PowerShell; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $env:DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
Set-Location $env:DEEPBANK_REPO
npm run check
npm run build:ui
npm run codex:doctor
npm run codex:smoke
npm run e2e:doctor -- --scope=local
npm run e2e:local
```

### Assertions
The product reports blocked/failed/degraded state truthfully and produces no fabricated success evidence.
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
Requires explicit real-provider environment.

## QBOT-CODEX-MAC-ASSISTANT-280

- Linked cases: QBOT-NEG-ASSISTANT-ISSUE-106-NEG
- OS: macOS
- Mode: hybrid shell + Electron UI
- Required tools: Codex; zsh/bash; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
cd "$DEEPBANK_REPO"
npm run check
npm run build:ui
npm run codex:doctor
npm run codex:smoke
npm run e2e:doctor -- --scope=local
npm run e2e:local
```

### Assertions
The product reports blocked/failed/degraded state truthfully and produces no fabricated success evidence.
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
Requires explicit real-provider environment.

## QBOT-CODEX-WIN-RUNTIME-PROTOCOL-281

- Linked cases: QBOT-FUNC-RUNTIME-ISSUE-107-MAIN
- OS: Windows
- Mode: hybrid shell + Electron UI
- Required tools: Codex; PowerShell; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $env:DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
Set-Location $env:DEEPBANK_REPO
npm run check
npm run codex:doctor
npm run codex:smoke
npm run e2e:doctor -- --scope=local
npm run e2e:local
```

### Assertions
**Exact files or behaviors to cover**: - Generate Markdown and JSON coverage matrix artifacts from the #102 surface extractor, #106 case registry, and latest case run results. - Group output by runtime family, shared axes, feature class, stability tier, support status, owner issue, and coverage tier. - Add drift checks for SDK version changes, raw event/item
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
Requires explicit real-provider environment.

## QBOT-CODEX-MAC-RUNTIME-PROTOCOL-282

- Linked cases: QBOT-FUNC-RUNTIME-ISSUE-107-MAIN
- OS: macOS
- Mode: hybrid shell + Electron UI
- Required tools: Codex; zsh/bash; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
cd "$DEEPBANK_REPO"
npm run check
npm run codex:doctor
npm run codex:smoke
npm run e2e:doctor -- --scope=local
npm run e2e:local
```

### Assertions
**Exact files or behaviors to cover**: - Generate Markdown and JSON coverage matrix artifacts from the #102 surface extractor, #106 case registry, and latest case run results. - Group output by runtime family, shared axes, feature class, stability tier, support status, owner issue, and coverage tier. - Add drift checks for SDK version changes, raw event/item
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
Requires explicit real-provider environment.

## QBOT-CODEX-WIN-RUNTIME-PROTOCOL-283

- Linked cases: QBOT-NEG-RUNTIME-ISSUE-107-NEG
- OS: Windows
- Mode: hybrid shell + Electron UI
- Required tools: Codex; PowerShell; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $env:DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
Set-Location $env:DEEPBANK_REPO
npm run check
npm run codex:doctor
npm run codex:smoke
npm run e2e:doctor -- --scope=local
npm run e2e:local
```

### Assertions
The product reports blocked/failed/degraded state truthfully and produces no fabricated success evidence.
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
Requires explicit real-provider environment.

## QBOT-CODEX-MAC-RUNTIME-PROTOCOL-284

- Linked cases: QBOT-NEG-RUNTIME-ISSUE-107-NEG
- OS: macOS
- Mode: hybrid shell + Electron UI
- Required tools: Codex; zsh/bash; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
cd "$DEEPBANK_REPO"
npm run check
npm run codex:doctor
npm run codex:smoke
npm run e2e:doctor -- --scope=local
npm run e2e:local
```

### Assertions
The product reports blocked/failed/degraded state truthfully and produces no fabricated success evidence.
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
Requires explicit real-provider environment.

## QBOT-CODEX-WIN-UI-UX-285

- Linked cases: QBOT-FUNC-UIUX-ISSUE-108-MAIN
- OS: Windows
- Mode: hybrid shell + Electron UI
- Required tools: Codex; PowerShell; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $env:DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
Set-Location $env:DEEPBANK_REPO
npm run check
npm run build:ui
npm run e2e:doctor -- --scope=local
npm run e2e:local
```

### Assertions
**Background**: Deepbank milestone #1 expects the qbot Electron app to behave like a releaseable internal desktop workbench: Electron/product transport remains HTTP/WS remote-control-plane-only, release artifacts are env/profile/platform scoped, and release notes/GitLab Releases use auditable tag boundaries. Today the app has `package.json` version `0.0.1`, 
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
If required env, provider, GitLab, Docker, or OS prerequisite is missing, mark blocked/not-run with reason.

## QBOT-CODEX-MAC-UI-UX-286

- Linked cases: QBOT-FUNC-UIUX-ISSUE-108-MAIN
- OS: macOS
- Mode: hybrid shell + Electron UI
- Required tools: Codex; zsh/bash; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
cd "$DEEPBANK_REPO"
npm run check
npm run build:ui
npm run e2e:doctor -- --scope=local
npm run e2e:local
```

### Assertions
**Background**: Deepbank milestone #1 expects the qbot Electron app to behave like a releaseable internal desktop workbench: Electron/product transport remains HTTP/WS remote-control-plane-only, release artifacts are env/profile/platform scoped, and release notes/GitLab Releases use auditable tag boundaries. Today the app has `package.json` version `0.0.1`, 
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
If required env, provider, GitLab, Docker, or OS prerequisite is missing, mark blocked/not-run with reason.

## QBOT-CODEX-WIN-UI-UX-287

- Linked cases: QBOT-NEG-UIUX-ISSUE-108-NEG
- OS: Windows
- Mode: hybrid shell + Electron UI
- Required tools: Codex; PowerShell; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $env:DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
Set-Location $env:DEEPBANK_REPO
npm run check
npm run build:ui
npm run e2e:doctor -- --scope=local
npm run e2e:local
```

### Assertions
The product reports blocked/failed/degraded state truthfully and produces no fabricated success evidence.
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
If required env, provider, GitLab, Docker, or OS prerequisite is missing, mark blocked/not-run with reason.

## QBOT-CODEX-MAC-UI-UX-288

- Linked cases: QBOT-NEG-UIUX-ISSUE-108-NEG
- OS: macOS
- Mode: hybrid shell + Electron UI
- Required tools: Codex; zsh/bash; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
cd "$DEEPBANK_REPO"
npm run check
npm run build:ui
npm run e2e:doctor -- --scope=local
npm run e2e:local
```

### Assertions
The product reports blocked/failed/degraded state truthfully and produces no fabricated success evidence.
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
If required env, provider, GitLab, Docker, or OS prerequisite is missing, mark blocked/not-run with reason.

## QBOT-CODEX-WIN-UI-UX-289

- Linked cases: QBOT-FUNC-UIUX-ISSUE-109-MAIN
- OS: Windows
- Mode: hybrid shell + Electron UI
- Required tools: Codex; PowerShell; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $env:DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
Set-Location $env:DEEPBANK_REPO
npm run check
npm run build:ui
npm run e2e:doctor -- --scope=local
npm run e2e:local
```

### Assertions
**In scope**: - Rework the unauthenticated Qbot auth shell markup and styles so it is a restrained workbench login surface, not a landing/hero composition. - Keep the same Lingxi OAuth2 / mock OAuth2 login behavior and `window.agent.*` auth flow. - Add audit rules that detect auth-shell composition regressions such as excessive card radius, oversized login c
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
If required env, provider, GitLab, Docker, or OS prerequisite is missing, mark blocked/not-run with reason.

## QBOT-CODEX-MAC-UI-UX-290

- Linked cases: QBOT-FUNC-UIUX-ISSUE-109-MAIN
- OS: macOS
- Mode: hybrid shell + Electron UI
- Required tools: Codex; zsh/bash; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
cd "$DEEPBANK_REPO"
npm run check
npm run build:ui
npm run e2e:doctor -- --scope=local
npm run e2e:local
```

### Assertions
**In scope**: - Rework the unauthenticated Qbot auth shell markup and styles so it is a restrained workbench login surface, not a landing/hero composition. - Keep the same Lingxi OAuth2 / mock OAuth2 login behavior and `window.agent.*` auth flow. - Add audit rules that detect auth-shell composition regressions such as excessive card radius, oversized login c
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
If required env, provider, GitLab, Docker, or OS prerequisite is missing, mark blocked/not-run with reason.

## QBOT-CODEX-WIN-RUNTIME-PROTOCOL-291

- Linked cases: QBOT-FUNC-RUNTIME-ISSUE-110-MAIN
- OS: Windows
- Mode: hybrid shell + Electron UI
- Required tools: Codex; PowerShell; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $env:DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
Set-Location $env:DEEPBANK_REPO
npm run check
npm run build:ui
npm run codex:doctor
npm run codex:smoke
npm run e2e:doctor -- --scope=local
npm run e2e:local
```

### Assertions
**In scope**: - Productize the existing server/runtime-owned proxy path into a supervised local compatibility component. - Keep Codex provider materialization as `wire_api=responses`; never introduce `wire_api=chat`. - Keep the proxy loopback-only, bearer-protected, redacted, and tied to server/runtime lifecycle. - Add explicit behavior for unsupported Respo
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
Requires explicit real-provider environment.

## QBOT-CODEX-MAC-RUNTIME-PROTOCOL-292

- Linked cases: QBOT-FUNC-RUNTIME-ISSUE-110-MAIN
- OS: macOS
- Mode: hybrid shell + Electron UI
- Required tools: Codex; zsh/bash; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
cd "$DEEPBANK_REPO"
npm run check
npm run build:ui
npm run codex:doctor
npm run codex:smoke
npm run e2e:doctor -- --scope=local
npm run e2e:local
```

### Assertions
**In scope**: - Productize the existing server/runtime-owned proxy path into a supervised local compatibility component. - Keep Codex provider materialization as `wire_api=responses`; never introduce `wire_api=chat`. - Keep the proxy loopback-only, bearer-protected, redacted, and tied to server/runtime lifecycle. - Add explicit behavior for unsupported Respo
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
Requires explicit real-provider environment.

## QBOT-CODEX-WIN-RUNTIME-PROTOCOL-293

- Linked cases: QBOT-NEG-RUNTIME-ISSUE-110-NEG
- OS: Windows
- Mode: hybrid shell + Electron UI
- Required tools: Codex; PowerShell; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $env:DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
Set-Location $env:DEEPBANK_REPO
npm run check
npm run build:ui
npm run codex:doctor
npm run codex:smoke
npm run e2e:doctor -- --scope=local
npm run e2e:local
```

### Assertions
The product reports blocked/failed/degraded state truthfully and produces no fabricated success evidence.
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
Requires explicit real-provider environment.

## QBOT-CODEX-MAC-RUNTIME-PROTOCOL-294

- Linked cases: QBOT-NEG-RUNTIME-ISSUE-110-NEG
- OS: macOS
- Mode: hybrid shell + Electron UI
- Required tools: Codex; zsh/bash; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
cd "$DEEPBANK_REPO"
npm run check
npm run build:ui
npm run codex:doctor
npm run codex:smoke
npm run e2e:doctor -- --scope=local
npm run e2e:local
```

### Assertions
The product reports blocked/failed/degraded state truthfully and produces no fabricated success evidence.
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
Requires explicit real-provider environment.

## QBOT-CODEX-WIN-ASSISTANT-295

- Linked cases: QBOT-NEG-ASSISTANT-ISSUE-111-MAIN
- OS: Windows
- Mode: hybrid shell + Electron UI
- Required tools: Codex; PowerShell; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $env:DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
Set-Location $env:DEEPBANK_REPO
npm run check
npm run build:ui
npm run e2e:doctor -- --scope=local
npm run e2e:local
```

### Assertions
**In scope**: - Fix the active assistant thread renderer in `src/components/assistant-ui/thread.tsx` so user messages no longer render `QbotLogo` and align to the right. - Adjust the related Qbot theme CSS in `src/qbot.css` and any active fallback thread code only when needed to prevent stale selectors from preserving the incorrect identity layout. - Update 
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
If required env, provider, GitLab, Docker, or OS prerequisite is missing, mark blocked/not-run with reason.

## QBOT-CODEX-MAC-ASSISTANT-296

- Linked cases: QBOT-NEG-ASSISTANT-ISSUE-111-MAIN
- OS: macOS
- Mode: hybrid shell + Electron UI
- Required tools: Codex; zsh/bash; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
cd "$DEEPBANK_REPO"
npm run check
npm run build:ui
npm run e2e:doctor -- --scope=local
npm run e2e:local
```

### Assertions
**In scope**: - Fix the active assistant thread renderer in `src/components/assistant-ui/thread.tsx` so user messages no longer render `QbotLogo` and align to the right. - Adjust the related Qbot theme CSS in `src/qbot.css` and any active fallback thread code only when needed to prevent stale selectors from preserving the incorrect identity layout. - Update 
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
If required env, provider, GitLab, Docker, or OS prerequisite is missing, mark blocked/not-run with reason.

## QBOT-CODEX-WIN-ASSISTANT-297

- Linked cases: QBOT-NEG-ASSISTANT-ISSUE-111-NEG
- OS: Windows
- Mode: hybrid shell + Electron UI
- Required tools: Codex; PowerShell; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $env:DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
Set-Location $env:DEEPBANK_REPO
npm run check
npm run build:ui
npm run e2e:doctor -- --scope=local
npm run e2e:local
```

### Assertions
The product reports blocked/failed/degraded state truthfully and produces no fabricated success evidence.
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
If required env, provider, GitLab, Docker, or OS prerequisite is missing, mark blocked/not-run with reason.

## QBOT-CODEX-MAC-ASSISTANT-298

- Linked cases: QBOT-NEG-ASSISTANT-ISSUE-111-NEG
- OS: macOS
- Mode: hybrid shell + Electron UI
- Required tools: Codex; zsh/bash; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
cd "$DEEPBANK_REPO"
npm run check
npm run build:ui
npm run e2e:doctor -- --scope=local
npm run e2e:local
```

### Assertions
The product reports blocked/failed/degraded state truthfully and produces no fabricated success evidence.
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
If required env, provider, GitLab, Docker, or OS prerequisite is missing, mark blocked/not-run with reason.

## QBOT-CODEX-WIN-ASSISTANT-299

- Linked cases: QBOT-NEG-ASSISTANT-ISSUE-112-MAIN
- OS: Windows
- Mode: hybrid shell + Electron UI
- Required tools: Codex; PowerShell; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $env:DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
Set-Location $env:DEEPBANK_REPO
npm run check
npm run build:ui
npm run codex:doctor
npm run codex:smoke
npm run e2e:doctor -- --scope=local
npm run e2e:local
```

### Assertions
Clicking the global Qbot/Assistant entry and asking a normal personal question could fail with: ```text remote runtime stream failed: 404 {"detail":"Runtime not found: remote-dev-runtime","error":"RuntimeNotFoundError"} ``` This is a product-boundary bug. The global Assistant entry is the personal/local agent runtime surface. Project-bound remote ADK runtime
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
If required env, provider, GitLab, Docker, or OS prerequisite is missing, mark blocked/not-run with reason.

## QBOT-CODEX-MAC-ASSISTANT-300

- Linked cases: QBOT-NEG-ASSISTANT-ISSUE-112-MAIN
- OS: macOS
- Mode: hybrid shell + Electron UI
- Required tools: Codex; zsh/bash; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
cd "$DEEPBANK_REPO"
npm run check
npm run build:ui
npm run codex:doctor
npm run codex:smoke
npm run e2e:doctor -- --scope=local
npm run e2e:local
```

### Assertions
Clicking the global Qbot/Assistant entry and asking a normal personal question could fail with: ```text remote runtime stream failed: 404 {"detail":"Runtime not found: remote-dev-runtime","error":"RuntimeNotFoundError"} ``` This is a product-boundary bug. The global Assistant entry is the personal/local agent runtime surface. Project-bound remote ADK runtime
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
If required env, provider, GitLab, Docker, or OS prerequisite is missing, mark blocked/not-run with reason.

## QBOT-CODEX-WIN-ASSISTANT-301

- Linked cases: QBOT-NEG-ASSISTANT-ISSUE-112-NEG
- OS: Windows
- Mode: hybrid shell + Electron UI
- Required tools: Codex; PowerShell; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $env:DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
Set-Location $env:DEEPBANK_REPO
npm run check
npm run build:ui
npm run codex:doctor
npm run codex:smoke
npm run e2e:doctor -- --scope=local
npm run e2e:local
```

### Assertions
The product reports blocked/failed/degraded state truthfully and produces no fabricated success evidence.
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
If required env, provider, GitLab, Docker, or OS prerequisite is missing, mark blocked/not-run with reason.

## QBOT-CODEX-MAC-ASSISTANT-302

- Linked cases: QBOT-NEG-ASSISTANT-ISSUE-112-NEG
- OS: macOS
- Mode: hybrid shell + Electron UI
- Required tools: Codex; zsh/bash; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
cd "$DEEPBANK_REPO"
npm run check
npm run build:ui
npm run codex:doctor
npm run codex:smoke
npm run e2e:doctor -- --scope=local
npm run e2e:local
```

### Assertions
The product reports blocked/failed/degraded state truthfully and produces no fabricated success evidence.
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
If required env, provider, GitLab, Docker, or OS prerequisite is missing, mark blocked/not-run with reason.

## QBOT-CODEX-WIN-ASSISTANT-303

- Linked cases: QBOT-FUNC-ASSISTANT-ISSUE-113-MAIN
- OS: Windows
- Mode: hybrid shell + Electron UI
- Required tools: Codex; PowerShell; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $env:DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
Set-Location $env:DEEPBANK_REPO
npm run check
npm run build:ui
npm run e2e:doctor -- --scope=local
npm run e2e:local
```

### Assertions
**In scope**: - `src/qbot.css` soft-boundary and composer visual convergence. - Minimal adjustments in `src/components/assistant-ui/thread.tsx`, `src/ComposerTools.tsx`, or `src/ComposerExtras.tsx` only if CSS cannot produce the target safely. - Visual tuning of app shell/sidebar, assistant first screen, composer, scene/tool chips, auth card/button boundarie
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
If required env, provider, GitLab, Docker, or OS prerequisite is missing, mark blocked/not-run with reason.

## QBOT-CODEX-MAC-ASSISTANT-304

- Linked cases: QBOT-FUNC-ASSISTANT-ISSUE-113-MAIN
- OS: macOS
- Mode: hybrid shell + Electron UI
- Required tools: Codex; zsh/bash; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
cd "$DEEPBANK_REPO"
npm run check
npm run build:ui
npm run e2e:doctor -- --scope=local
npm run e2e:local
```

### Assertions
**In scope**: - `src/qbot.css` soft-boundary and composer visual convergence. - Minimal adjustments in `src/components/assistant-ui/thread.tsx`, `src/ComposerTools.tsx`, or `src/ComposerExtras.tsx` only if CSS cannot produce the target safely. - Visual tuning of app shell/sidebar, assistant first screen, composer, scene/tool chips, auth card/button boundarie
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
If required env, provider, GitLab, Docker, or OS prerequisite is missing, mark blocked/not-run with reason.

## QBOT-CODEX-WIN-ASSISTANT-305

- Linked cases: QBOT-NEG-ASSISTANT-ISSUE-114-MAIN
- OS: Windows
- Mode: hybrid shell + Electron UI
- Required tools: Codex; PowerShell; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $env:DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
Set-Location $env:DEEPBANK_REPO
npm run check
npm run build:ui
npm run codex:doctor
npm run codex:smoke
npm run e2e:doctor -- --scope=local
npm run e2e:local
```

### Assertions
**In scope**: - Harden Electron `shell:listFiles` and `shell:readFile` path filtering for private runtime roots/files under the local runtime home. - Add UI/UX audit assertions that the artifact panel does not expose `local.db`, SQLite sidecar files, runtime logs, or transcript paths. - Add product e2e assertions for an actual rendered qbot chat turn: user m
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
Requires explicit real-provider environment.

## QBOT-CODEX-MAC-ASSISTANT-306

- Linked cases: QBOT-NEG-ASSISTANT-ISSUE-114-MAIN
- OS: macOS
- Mode: hybrid shell + Electron UI
- Required tools: Codex; zsh/bash; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
cd "$DEEPBANK_REPO"
npm run check
npm run build:ui
npm run codex:doctor
npm run codex:smoke
npm run e2e:doctor -- --scope=local
npm run e2e:local
```

### Assertions
**In scope**: - Harden Electron `shell:listFiles` and `shell:readFile` path filtering for private runtime roots/files under the local runtime home. - Add UI/UX audit assertions that the artifact panel does not expose `local.db`, SQLite sidecar files, runtime logs, or transcript paths. - Add product e2e assertions for an actual rendered qbot chat turn: user m
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
Requires explicit real-provider environment.

## QBOT-CODEX-WIN-ASSISTANT-307

- Linked cases: QBOT-NEG-ASSISTANT-ISSUE-114-NEG
- OS: Windows
- Mode: hybrid shell + Electron UI
- Required tools: Codex; PowerShell; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $env:DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
Set-Location $env:DEEPBANK_REPO
npm run check
npm run build:ui
npm run codex:doctor
npm run codex:smoke
npm run e2e:doctor -- --scope=local
npm run e2e:local
```

### Assertions
The product reports blocked/failed/degraded state truthfully and produces no fabricated success evidence.
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
Requires explicit real-provider environment.

## QBOT-CODEX-MAC-ASSISTANT-308

- Linked cases: QBOT-NEG-ASSISTANT-ISSUE-114-NEG
- OS: macOS
- Mode: hybrid shell + Electron UI
- Required tools: Codex; zsh/bash; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
cd "$DEEPBANK_REPO"
npm run check
npm run build:ui
npm run codex:doctor
npm run codex:smoke
npm run e2e:doctor -- --scope=local
npm run e2e:local
```

### Assertions
The product reports blocked/failed/degraded state truthfully and produces no fabricated success evidence.
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
Requires explicit real-provider environment.

## QBOT-CODEX-WIN-RUNTIME-PROTOCOL-309

- Linked cases: QBOT-FUNC-RUNTIME-ISSUE-115-MAIN
- OS: Windows
- Mode: hybrid shell + Electron UI
- Required tools: Codex; PowerShell; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $env:DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
Set-Location $env:DEEPBANK_REPO
npm run check
npm run build:ui
npm run codex:doctor
npm run codex:smoke
npm run e2e:doctor -- --scope=local
npm run e2e:local
```

### Assertions
**Background**: GitLab-backed projects now have the core building blocks needed for project-scoped automation: GitLab repo/config APIs, GitLab issue/activity/member read models, project runtime binding, and ADK pod-first runtime workspace provisioning. The project workspace still shows “自动化” as a placeholder, so users cannot define repeatable project tasks, 
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
Lingxi OAuth2 to GitLab token exchange dependency.

## QBOT-CODEX-MAC-RUNTIME-PROTOCOL-310

- Linked cases: QBOT-FUNC-RUNTIME-ISSUE-115-MAIN
- OS: macOS
- Mode: hybrid shell + Electron UI
- Required tools: Codex; zsh/bash; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
cd "$DEEPBANK_REPO"
npm run check
npm run build:ui
npm run codex:doctor
npm run codex:smoke
npm run e2e:doctor -- --scope=local
npm run e2e:local
```

### Assertions
**Background**: GitLab-backed projects now have the core building blocks needed for project-scoped automation: GitLab repo/config APIs, GitLab issue/activity/member read models, project runtime binding, and ADK pod-first runtime workspace provisioning. The project workspace still shows “自动化” as a placeholder, so users cannot define repeatable project tasks, 
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
Lingxi OAuth2 to GitLab token exchange dependency.

## QBOT-CODEX-WIN-RUNTIME-PROTOCOL-311

- Linked cases: QBOT-NEG-RUNTIME-ISSUE-115-NEG
- OS: Windows
- Mode: hybrid shell + Electron UI
- Required tools: Codex; PowerShell; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $env:DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
Set-Location $env:DEEPBANK_REPO
npm run check
npm run build:ui
npm run codex:doctor
npm run codex:smoke
npm run e2e:doctor -- --scope=local
npm run e2e:local
```

### Assertions
The product reports blocked/failed/degraded state truthfully and produces no fabricated success evidence.
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
Lingxi OAuth2 to GitLab token exchange dependency.

## QBOT-CODEX-MAC-RUNTIME-PROTOCOL-312

- Linked cases: QBOT-NEG-RUNTIME-ISSUE-115-NEG
- OS: macOS
- Mode: hybrid shell + Electron UI
- Required tools: Codex; zsh/bash; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
cd "$DEEPBANK_REPO"
npm run check
npm run build:ui
npm run codex:doctor
npm run codex:smoke
npm run e2e:doctor -- --scope=local
npm run e2e:local
```

### Assertions
The product reports blocked/failed/degraded state truthfully and produces no fabricated success evidence.
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
Lingxi OAuth2 to GitLab token exchange dependency.

## QBOT-CODEX-WIN-RUNTIME-PROTOCOL-313

- Linked cases: QBOT-FUNC-RUNTIME-ISSUE-116-MAIN
- OS: Windows
- Mode: hybrid shell + Electron UI
- Required tools: Codex; PowerShell; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $env:DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
Set-Location $env:DEEPBANK_REPO
npm run check
npm run build:ui
npm run codex:doctor
npm run codex:smoke
npm run e2e:doctor -- --scope=local
npm run e2e:local
```

### Assertions
**Exact files or behaviors to cover**: - qbot Codex runtime selection and connection selection through `window.agent.*`, `/api/context/connection`, `connectionView`, `llmSelections`, and `server/index.mjs` materialization into `session.llmConnection` / `session.llmSelection`. - Codex execution through `server/engine.mjs`, `runtime-family.mjs`, and the Codex 
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
Requires explicit real-provider environment.

## QBOT-CODEX-MAC-RUNTIME-PROTOCOL-314

- Linked cases: QBOT-FUNC-RUNTIME-ISSUE-116-MAIN
- OS: macOS
- Mode: hybrid shell + Electron UI
- Required tools: Codex; zsh/bash; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
cd "$DEEPBANK_REPO"
npm run check
npm run build:ui
npm run codex:doctor
npm run codex:smoke
npm run e2e:doctor -- --scope=local
npm run e2e:local
```

### Assertions
**Exact files or behaviors to cover**: - qbot Codex runtime selection and connection selection through `window.agent.*`, `/api/context/connection`, `connectionView`, `llmSelections`, and `server/index.mjs` materialization into `session.llmConnection` / `session.llmSelection`. - Codex execution through `server/engine.mjs`, `runtime-family.mjs`, and the Codex 
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
Requires explicit real-provider environment.

## QBOT-CODEX-WIN-RUNTIME-PROTOCOL-315

- Linked cases: QBOT-NEG-RUNTIME-ISSUE-116-NEG
- OS: Windows
- Mode: hybrid shell + Electron UI
- Required tools: Codex; PowerShell; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $env:DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
Set-Location $env:DEEPBANK_REPO
npm run check
npm run build:ui
npm run codex:doctor
npm run codex:smoke
npm run e2e:doctor -- --scope=local
npm run e2e:local
```

### Assertions
The product reports blocked/failed/degraded state truthfully and produces no fabricated success evidence.
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
Requires explicit real-provider environment.

## QBOT-CODEX-MAC-RUNTIME-PROTOCOL-316

- Linked cases: QBOT-NEG-RUNTIME-ISSUE-116-NEG
- OS: macOS
- Mode: hybrid shell + Electron UI
- Required tools: Codex; zsh/bash; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
cd "$DEEPBANK_REPO"
npm run check
npm run build:ui
npm run codex:doctor
npm run codex:smoke
npm run e2e:doctor -- --scope=local
npm run e2e:local
```

### Assertions
The product reports blocked/failed/degraded state truthfully and produces no fabricated success evidence.
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
Requires explicit real-provider environment.

## QBOT-CODEX-WIN-RUNTIME-PROTOCOL-317

- Linked cases: QBOT-FUNC-RUNTIME-ISSUE-117-MAIN
- OS: Windows
- Mode: hybrid shell + Electron UI
- Required tools: Codex; PowerShell; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $env:DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
Set-Location $env:DEEPBANK_REPO
npm run check
npm run build:ui
npm run codex:doctor
npm run codex:smoke
npm run e2e:doctor -- --scope=local
npm run e2e:local
```

### Assertions
**Exact files or behaviors to cover**: - qbot Claude Code runtime selection and connection/execution selection through `window.agent.*`, `/api/context/connection`, `connectionView`, `llmSelections`, and `server/index.mjs` materialization into `session.llmConnection` / `session.llmSelection` where explicit LLM connections are supported. - Claude Code executio
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
Requires explicit real-provider environment.

## QBOT-CODEX-MAC-RUNTIME-PROTOCOL-318

- Linked cases: QBOT-FUNC-RUNTIME-ISSUE-117-MAIN
- OS: macOS
- Mode: hybrid shell + Electron UI
- Required tools: Codex; zsh/bash; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
cd "$DEEPBANK_REPO"
npm run check
npm run build:ui
npm run codex:doctor
npm run codex:smoke
npm run e2e:doctor -- --scope=local
npm run e2e:local
```

### Assertions
**Exact files or behaviors to cover**: - qbot Claude Code runtime selection and connection/execution selection through `window.agent.*`, `/api/context/connection`, `connectionView`, `llmSelections`, and `server/index.mjs` materialization into `session.llmConnection` / `session.llmSelection` where explicit LLM connections are supported. - Claude Code executio
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
Requires explicit real-provider environment.

## QBOT-CODEX-WIN-RUNTIME-PROTOCOL-319

- Linked cases: QBOT-NEG-RUNTIME-ISSUE-117-NEG
- OS: Windows
- Mode: hybrid shell + Electron UI
- Required tools: Codex; PowerShell; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $env:DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
Set-Location $env:DEEPBANK_REPO
npm run check
npm run build:ui
npm run codex:doctor
npm run codex:smoke
npm run e2e:doctor -- --scope=local
npm run e2e:local
```

### Assertions
The product reports blocked/failed/degraded state truthfully and produces no fabricated success evidence.
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
Requires explicit real-provider environment.

## QBOT-CODEX-MAC-RUNTIME-PROTOCOL-320

- Linked cases: QBOT-NEG-RUNTIME-ISSUE-117-NEG
- OS: macOS
- Mode: hybrid shell + Electron UI
- Required tools: Codex; zsh/bash; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
cd "$DEEPBANK_REPO"
npm run check
npm run build:ui
npm run codex:doctor
npm run codex:smoke
npm run e2e:doctor -- --scope=local
npm run e2e:local
```

### Assertions
The product reports blocked/failed/degraded state truthfully and produces no fabricated success evidence.
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
Requires explicit real-provider environment.

## QBOT-CODEX-WIN-PROJECTS-GITLAB-321

- Linked cases: QBOT-FUNC-PROJECTS-ISSUE-118-MAIN
- OS: Windows
- Mode: hybrid shell + Electron UI
- Required tools: Codex; PowerShell; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $env:DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
Set-Location $env:DEEPBANK_REPO
npm run check
npm run build:ui
npm run e2e:doctor -- --scope=local
npm run e2e:local
```

### Assertions
**Background**: #92 defines the Deepbank project module as a private GitLab-backed adapter: GitLab owns repo/config/issues/activity/members/files/MRs, Deepbank owns UX orchestration plus redacted meta/cache/cursor/runtime binding/setup state, and ADK owns execution through repo checkout workspaces. The original product direction is: a Deepbank project maps t
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
Lingxi OAuth2 to GitLab token exchange dependency.

## QBOT-CODEX-MAC-PROJECTS-GITLAB-322

- Linked cases: QBOT-FUNC-PROJECTS-ISSUE-118-MAIN
- OS: macOS
- Mode: hybrid shell + Electron UI
- Required tools: Codex; zsh/bash; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
cd "$DEEPBANK_REPO"
npm run check
npm run build:ui
npm run e2e:doctor -- --scope=local
npm run e2e:local
```

### Assertions
**Background**: #92 defines the Deepbank project module as a private GitLab-backed adapter: GitLab owns repo/config/issues/activity/members/files/MRs, Deepbank owns UX orchestration plus redacted meta/cache/cursor/runtime binding/setup state, and ADK owns execution through repo checkout workspaces. The original product direction is: a Deepbank project maps t
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
Lingxi OAuth2 to GitLab token exchange dependency.

## QBOT-CODEX-WIN-PROJECTS-GITLAB-323

- Linked cases: QBOT-NEG-PROJECTS-ISSUE-118-NEG
- OS: Windows
- Mode: hybrid shell + Electron UI
- Required tools: Codex; PowerShell; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $env:DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
Set-Location $env:DEEPBANK_REPO
npm run check
npm run build:ui
npm run e2e:doctor -- --scope=local
npm run e2e:local
```

### Assertions
The product reports blocked/failed/degraded state truthfully and produces no fabricated success evidence.
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
Lingxi OAuth2 to GitLab token exchange dependency.

## QBOT-CODEX-MAC-PROJECTS-GITLAB-324

- Linked cases: QBOT-NEG-PROJECTS-ISSUE-118-NEG
- OS: macOS
- Mode: hybrid shell + Electron UI
- Required tools: Codex; zsh/bash; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
cd "$DEEPBANK_REPO"
npm run check
npm run build:ui
npm run e2e:doctor -- --scope=local
npm run e2e:local
```

### Assertions
The product reports blocked/failed/degraded state truthfully and produces no fabricated success evidence.
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
Lingxi OAuth2 to GitLab token exchange dependency.

## QBOT-CODEX-WIN-ASSISTANT-325

- Linked cases: QBOT-FUNC-ASSISTANT-ISSUE-119-MAIN
- OS: Windows
- Mode: hybrid shell + Electron UI
- Required tools: Codex; PowerShell; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $env:DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
Set-Location $env:DEEPBANK_REPO
npm run check
npm run build:ui
npm run e2e:doctor -- --scope=local
npm run e2e:local
```

### Assertions
**In scope**: - Review and, if needed, extend `uiux-audit` coverage for the assistant composer action area. - Update the composer attachment control styling so it has a clear visible affordance on the active Qbot theme. - Re-run the audit to prove the rule/tooling change catches the pre-fix state and is green after the fix. **Non-goals**: - No redesign of th
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
If required env, provider, GitLab, Docker, or OS prerequisite is missing, mark blocked/not-run with reason.

## QBOT-CODEX-MAC-ASSISTANT-326

- Linked cases: QBOT-FUNC-ASSISTANT-ISSUE-119-MAIN
- OS: macOS
- Mode: hybrid shell + Electron UI
- Required tools: Codex; zsh/bash; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
cd "$DEEPBANK_REPO"
npm run check
npm run build:ui
npm run e2e:doctor -- --scope=local
npm run e2e:local
```

### Assertions
**In scope**: - Review and, if needed, extend `uiux-audit` coverage for the assistant composer action area. - Update the composer attachment control styling so it has a clear visible affordance on the active Qbot theme. - Re-run the audit to prove the rule/tooling change catches the pre-fix state and is green after the fix. **Non-goals**: - No redesign of th
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
If required env, provider, GitLab, Docker, or OS prerequisite is missing, mark blocked/not-run with reason.

## QBOT-CODEX-WIN-RUNTIME-PROTOCOL-327

- Linked cases: QBOT-FUNC-RUNTIME-ISSUE-120-MAIN
- OS: Windows
- Mode: hybrid shell + Electron UI
- Required tools: Codex; PowerShell; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $env:DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
Set-Location $env:DEEPBANK_REPO
npm run check
npm run build:ui
npm run codex:doctor
npm run codex:smoke
```

### Assertions
**Background**：依据《奇富科技大模型使用安全操作指引 V1.0》附录1，AI 来源分 **M1–M4 合规档位**（M1 奇富自有 / M2 可信源·私有云 / M3 境内外部 / M4 境外外部）。当前 qbot composer 直接暴露「运行时(Claude Code)」「模型」两个裸选择器，让用户选 runtime/model。 **Current problem**：用户被要求理解并选择 runtime/model；而模型需适配调试、供给会变。同时 codex 档位（M2/M3/M4 默认）的人设/记忆/技能/agentic 工具链不完整（见 #88 及相邻 gap）。 **Design goal**：用户只选「合规档位」与「任务场景」，**不直接选 runtime/model**；档位
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
If required env, provider, GitLab, Docker, or OS prerequisite is missing, mark blocked/not-run with reason.

## QBOT-CODEX-MAC-RUNTIME-PROTOCOL-328

- Linked cases: QBOT-FUNC-RUNTIME-ISSUE-120-MAIN
- OS: macOS
- Mode: hybrid shell + Electron UI
- Required tools: Codex; zsh/bash; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
cd "$DEEPBANK_REPO"
npm run check
npm run build:ui
npm run codex:doctor
npm run codex:smoke
```

### Assertions
**Background**：依据《奇富科技大模型使用安全操作指引 V1.0》附录1，AI 来源分 **M1–M4 合规档位**（M1 奇富自有 / M2 可信源·私有云 / M3 境内外部 / M4 境外外部）。当前 qbot composer 直接暴露「运行时(Claude Code)」「模型」两个裸选择器，让用户选 runtime/model。 **Current problem**：用户被要求理解并选择 runtime/model；而模型需适配调试、供给会变。同时 codex 档位（M2/M3/M4 默认）的人设/记忆/技能/agentic 工具链不完整（见 #88 及相邻 gap）。 **Design goal**：用户只选「合规档位」与「任务场景」，**不直接选 runtime/model**；档位
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
If required env, provider, GitLab, Docker, or OS prerequisite is missing, mark blocked/not-run with reason.

## QBOT-CODEX-WIN-ASSISTANT-329

- Linked cases: QBOT-FUNC-ASSISTANT-ISSUE-121-MAIN
- OS: Windows
- Mode: hybrid shell + Electron UI
- Required tools: Codex; PowerShell; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $env:DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
Set-Location $env:DEEPBANK_REPO
npm run check
npm run build:ui
npm run e2e:doctor -- --scope=local
npm run e2e:local
```

### Assertions
**In scope**：`src/Sidebar.tsx`（去 logo + 间距 + 子菜单 + 登录态并入 + 底部版本行 + 弹层语义收敛）、`src/brand.ts`（name→QBot）、`src/app.css`、`src/qbot.css`、引用相关 testid 的 `test/e2e/*`。 **Non-goals**：不删任何底层视图/路由；不动任务场景；其它 app-shell 收敛归 #82。
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
If required env, provider, GitLab, Docker, or OS prerequisite is missing, mark blocked/not-run with reason.

## QBOT-CODEX-MAC-ASSISTANT-330

- Linked cases: QBOT-FUNC-ASSISTANT-ISSUE-121-MAIN
- OS: macOS
- Mode: hybrid shell + Electron UI
- Required tools: Codex; zsh/bash; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
cd "$DEEPBANK_REPO"
npm run check
npm run build:ui
npm run e2e:doctor -- --scope=local
npm run e2e:local
```

### Assertions
**In scope**：`src/Sidebar.tsx`（去 logo + 间距 + 子菜单 + 登录态并入 + 底部版本行 + 弹层语义收敛）、`src/brand.ts`（name→QBot）、`src/app.css`、`src/qbot.css`、引用相关 testid 的 `test/e2e/*`。 **Non-goals**：不删任何底层视图/路由；不动任务场景；其它 app-shell 收敛归 #82。
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
If required env, provider, GitLab, Docker, or OS prerequisite is missing, mark blocked/not-run with reason.

## QBOT-CODEX-WIN-E2E-RELEASE-PLATFORM-331

- Linked cases: QBOT-NEG-E2E-RELEASE-ISSUE-122-MAIN
- OS: Windows
- Mode: hybrid shell + Electron UI
- Required tools: Codex; PowerShell; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $env:DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
Set-Location $env:DEEPBANK_REPO
npm run check
npm run e2e:doctor -- --scope=local
npm run e2e:local
npm run build:desktop
```

### Assertions
**In scope**：让 macOS 本地 e2e 对"宿主 seed 本地 SQLite + 服务端读"这类用例可靠（改 e2e harness）。 **Non-goals**：不改产品代码；不改 CI（CI 正常）。
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
If required env, provider, GitLab, Docker, or OS prerequisite is missing, mark blocked/not-run with reason.

## QBOT-CODEX-MAC-E2E-RELEASE-PLATFORM-332

- Linked cases: QBOT-NEG-E2E-RELEASE-ISSUE-122-MAIN
- OS: macOS
- Mode: hybrid shell + Electron UI
- Required tools: Codex; zsh/bash; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
cd "$DEEPBANK_REPO"
npm run check
npm run e2e:doctor -- --scope=local
npm run e2e:local
npm run e2e:release:mac
```

### Assertions
**In scope**：让 macOS 本地 e2e 对"宿主 seed 本地 SQLite + 服务端读"这类用例可靠（改 e2e harness）。 **Non-goals**：不改产品代码；不改 CI（CI 正常）。
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
If required env, provider, GitLab, Docker, or OS prerequisite is missing, mark blocked/not-run with reason.

## QBOT-CODEX-WIN-E2E-RELEASE-PLATFORM-333

- Linked cases: QBOT-NEG-E2E-RELEASE-ISSUE-122-NEG
- OS: Windows
- Mode: hybrid shell + Electron UI
- Required tools: Codex; PowerShell; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $env:DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
Set-Location $env:DEEPBANK_REPO
npm run check
npm run e2e:doctor -- --scope=local
npm run e2e:local
npm run build:desktop
```

### Assertions
The product reports blocked/failed/degraded state truthfully and produces no fabricated success evidence.
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
If required env, provider, GitLab, Docker, or OS prerequisite is missing, mark blocked/not-run with reason.

## QBOT-CODEX-MAC-E2E-RELEASE-PLATFORM-334

- Linked cases: QBOT-NEG-E2E-RELEASE-ISSUE-122-NEG
- OS: macOS
- Mode: hybrid shell + Electron UI
- Required tools: Codex; zsh/bash; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
cd "$DEEPBANK_REPO"
npm run check
npm run e2e:doctor -- --scope=local
npm run e2e:local
npm run e2e:release:mac
```

### Assertions
The product reports blocked/failed/degraded state truthfully and produces no fabricated success evidence.
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
If required env, provider, GitLab, Docker, or OS prerequisite is missing, mark blocked/not-run with reason.

## QBOT-CODEX-WIN-RUNTIME-PROTOCOL-335

- Linked cases: QBOT-FUNC-RUNTIME-ISSUE-123-MAIN
- OS: Windows
- Mode: hybrid shell + Electron UI
- Required tools: Codex; PowerShell; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $env:DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
Set-Location $env:DEEPBANK_REPO
npm run check
npm run build:ui
npm run codex:doctor
npm run codex:smoke
npm run e2e:doctor -- --scope=local
npm run e2e:local
npm run build:desktop
```

### Assertions
**Background**: - Deepbank desktop release is now remote-server-only: packaged desktop artifacts must contain only public remote descriptors, must not package server fallback payloads, and must connect to an environment-scoped remote control-plane. - The current shared `dev` k8s integration environment is already represented by `deploy/k8s/dev/`, `scripts/k8
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
If required env, provider, GitLab, Docker, or OS prerequisite is missing, mark blocked/not-run with reason.

## QBOT-CODEX-MAC-RUNTIME-PROTOCOL-336

- Linked cases: QBOT-FUNC-RUNTIME-ISSUE-123-MAIN
- OS: macOS
- Mode: hybrid shell + Electron UI
- Required tools: Codex; zsh/bash; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
cd "$DEEPBANK_REPO"
npm run check
npm run build:ui
npm run codex:doctor
npm run codex:smoke
npm run e2e:doctor -- --scope=local
npm run e2e:local
npm run e2e:release:mac
```

### Assertions
**Background**: - Deepbank desktop release is now remote-server-only: packaged desktop artifacts must contain only public remote descriptors, must not package server fallback payloads, and must connect to an environment-scoped remote control-plane. - The current shared `dev` k8s integration environment is already represented by `deploy/k8s/dev/`, `scripts/k8
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
If required env, provider, GitLab, Docker, or OS prerequisite is missing, mark blocked/not-run with reason.

## QBOT-CODEX-WIN-RUNTIME-PROTOCOL-337

- Linked cases: QBOT-NEG-RUNTIME-ISSUE-123-NEG
- OS: Windows
- Mode: hybrid shell + Electron UI
- Required tools: Codex; PowerShell; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $env:DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
Set-Location $env:DEEPBANK_REPO
npm run check
npm run build:ui
npm run codex:doctor
npm run codex:smoke
npm run e2e:doctor -- --scope=local
npm run e2e:local
npm run build:desktop
```

### Assertions
The product reports blocked/failed/degraded state truthfully and produces no fabricated success evidence.
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
If required env, provider, GitLab, Docker, or OS prerequisite is missing, mark blocked/not-run with reason.

## QBOT-CODEX-MAC-RUNTIME-PROTOCOL-338

- Linked cases: QBOT-NEG-RUNTIME-ISSUE-123-NEG
- OS: macOS
- Mode: hybrid shell + Electron UI
- Required tools: Codex; zsh/bash; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
cd "$DEEPBANK_REPO"
npm run check
npm run build:ui
npm run codex:doctor
npm run codex:smoke
npm run e2e:doctor -- --scope=local
npm run e2e:local
npm run e2e:release:mac
```

### Assertions
The product reports blocked/failed/degraded state truthfully and produces no fabricated success evidence.
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
If required env, provider, GitLab, Docker, or OS prerequisite is missing, mark blocked/not-run with reason.

## QBOT-CODEX-WIN-SKILLS-MCP-EXPERTS-339

- Linked cases: QBOT-FUNC-SKILLS-MCP-ISSUE-124-MAIN
- OS: Windows
- Mode: shell + Codex CLI/runtime artifacts
- Required tools: Codex; PowerShell; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $env:DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
Set-Location $env:DEEPBANK_REPO
npm run check
npm run codex:doctor
npm run codex:smoke
```

### Assertions
**Background**: 「专家」板块当前是开发期占位实现：专家以本地插件目录(`~/.deepbank/plugins/marketplaces/experts/plugins/<id>/agents/<id>.md`)的 `.md` 文件形态存在，由 `server/engine.mjs#listExperts()` 扫文件得到，`writeExpertFile()` 写文件。没有 server 端目录、没有归属(owner)、没有可见性(visibility)、没有审核、没有 admin、没有分类。磁盘上现存 6 个内置占位专家 + 1 个测试自建专家，均为一次性开发数据。 **Current problem**: - 专家是「本地文件真值」，多端/多用户无统一目录，无法做「我的专家 / 推荐 / 
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
If required env, provider, GitLab, Docker, or OS prerequisite is missing, mark blocked/not-run with reason.

## QBOT-CODEX-MAC-SKILLS-MCP-EXPERTS-340

- Linked cases: QBOT-FUNC-SKILLS-MCP-ISSUE-124-MAIN
- OS: macOS
- Mode: shell + Codex CLI/runtime artifacts
- Required tools: Codex; zsh/bash; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
cd "$DEEPBANK_REPO"
npm run check
npm run codex:doctor
npm run codex:smoke
```

### Assertions
**Background**: 「专家」板块当前是开发期占位实现：专家以本地插件目录(`~/.deepbank/plugins/marketplaces/experts/plugins/<id>/agents/<id>.md`)的 `.md` 文件形态存在，由 `server/engine.mjs#listExperts()` 扫文件得到，`writeExpertFile()` 写文件。没有 server 端目录、没有归属(owner)、没有可见性(visibility)、没有审核、没有 admin、没有分类。磁盘上现存 6 个内置占位专家 + 1 个测试自建专家，均为一次性开发数据。 **Current problem**: - 专家是「本地文件真值」，多端/多用户无统一目录，无法做「我的专家 / 推荐 / 
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
If required env, provider, GitLab, Docker, or OS prerequisite is missing, mark blocked/not-run with reason.

## QBOT-CODEX-WIN-SKILLS-MCP-EXPERTS-341

- Linked cases: QBOT-FUNC-SKILLS-MCP-ISSUE-125-MAIN
- OS: Windows
- Mode: hybrid shell + Electron UI
- Required tools: Codex; PowerShell; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $env:DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
Set-Location $env:DEEPBANK_REPO
npm run check
npm run codex:doctor
npm run codex:smoke
npm run e2e:doctor -- --scope=local
npm run e2e:local
```

### Assertions
**Background**: #124 的前置数据地基。当前专家=本地插件目录 `.md`(`engine.mjs#listExperts` 扫文件),skill 分散在 `installed_skills`(SQLite)/`market_skills`(PG)/`.claude/skills/*`,均无归属/可见性/绑定。 **Problem or task**: 建立 server 端 PG 数据模型,把专家与「专家↔skill 绑定」「skill 可见性」沉到库里,并提供 seed 机制。 **Desired outcome**: 一套可被 #124 各 lane 复用的表 + seed 脚本;专家/私有 skill 有归属与可见性;**不迁移现存 6+1 占位专家**,生产清库。
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
If required env, provider, GitLab, Docker, or OS prerequisite is missing, mark blocked/not-run with reason.

## QBOT-CODEX-MAC-SKILLS-MCP-EXPERTS-342

- Linked cases: QBOT-FUNC-SKILLS-MCP-ISSUE-125-MAIN
- OS: macOS
- Mode: hybrid shell + Electron UI
- Required tools: Codex; zsh/bash; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
cd "$DEEPBANK_REPO"
npm run check
npm run codex:doctor
npm run codex:smoke
npm run e2e:doctor -- --scope=local
npm run e2e:local
```

### Assertions
**Background**: #124 的前置数据地基。当前专家=本地插件目录 `.md`(`engine.mjs#listExperts` 扫文件),skill 分散在 `installed_skills`(SQLite)/`market_skills`(PG)/`.claude/skills/*`,均无归属/可见性/绑定。 **Problem or task**: 建立 server 端 PG 数据模型,把专家与「专家↔skill 绑定」「skill 可见性」沉到库里,并提供 seed 机制。 **Desired outcome**: 一套可被 #124 各 lane 复用的表 + seed 脚本;专家/私有 skill 有归属与可见性;**不迁移现存 6+1 占位专家**,生产清库。
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
If required env, provider, GitLab, Docker, or OS prerequisite is missing, mark blocked/not-run with reason.

## QBOT-CODEX-WIN-CONTEXT-GOVERNANCE-343

- Linked cases: QBOT-FUNC-CONTEXT-GOVERNANCE-ISSUE-126-MAIN
- OS: Windows
- Mode: shell
- Required tools: Codex; PowerShell; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $env:DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
Set-Location $env:DEEPBANK_REPO
npm run check
npm run build:ui
```

### Assertions
**Background**: #124 改版后专家走 server 端目录,客户端**直接从 server 取**(不做本地同步)。 **Problem or task**: 提供四分区 Catalog API,统一可见性过滤。 **Desired outcome**: 客户端四分区(为您推荐/最近召唤/全部专家/我的专家)由 server 接口驱动,只见「公开 + 我的」。
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
Issue status is blocked.

## QBOT-CODEX-MAC-CONTEXT-GOVERNANCE-344

- Linked cases: QBOT-FUNC-CONTEXT-GOVERNANCE-ISSUE-126-MAIN
- OS: macOS
- Mode: shell
- Required tools: Codex; zsh/bash; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
cd "$DEEPBANK_REPO"
npm run check
npm run build:ui
```

### Assertions
**Background**: #124 改版后专家走 server 端目录,客户端**直接从 server 取**(不做本地同步)。 **Problem or task**: 提供四分区 Catalog API,统一可见性过滤。 **Desired outcome**: 客户端四分区(为您推荐/最近召唤/全部专家/我的专家)由 server 接口驱动,只见「公开 + 我的」。
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
Issue status is blocked.

## QBOT-CODEX-WIN-CONTEXT-GOVERNANCE-345

- Linked cases: QBOT-NEG-CONTEXT-GOVERNANCE-ISSUE-126-NEG
- OS: Windows
- Mode: shell
- Required tools: Codex; PowerShell; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $env:DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
Set-Location $env:DEEPBANK_REPO
npm run check
npm run build:ui
```

### Assertions
The product reports blocked/failed/degraded state truthfully and produces no fabricated success evidence.
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
Issue status is blocked.

## QBOT-CODEX-MAC-CONTEXT-GOVERNANCE-346

- Linked cases: QBOT-NEG-CONTEXT-GOVERNANCE-ISSUE-126-NEG
- OS: macOS
- Mode: shell
- Required tools: Codex; zsh/bash; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
cd "$DEEPBANK_REPO"
npm run check
npm run build:ui
```

### Assertions
The product reports blocked/failed/degraded state truthfully and produces no fabricated success evidence.
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
Issue status is blocked.

## QBOT-CODEX-WIN-ASSISTANT-347

- Linked cases: QBOT-FUNC-ASSISTANT-ISSUE-127-MAIN
- OS: Windows
- Mode: hybrid shell + Electron UI
- Required tools: Codex; PowerShell; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $env:DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
Set-Location $env:DEEPBANK_REPO
npm run check
npm run build:ui
npm run e2e:doctor -- --scope=local
npm run e2e:local
```

### Assertions
**Background**: #124 中,自建专家默认私有可直接用;仅当要**发布给他人用**时才需审核。 **Problem or task**: 实现「发布申请 → admin 审核 → 通过转公开」闭环 + 助理配置内的 admin 审核位。 **Desired outcome**: 用户可对自己的私有专家发起发布申请;admin(个人白名单)在助理配置看到待审列表并通过/驳回;通过后 `visibility` 转 public。
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
Issue status is blocked.

## QBOT-CODEX-MAC-ASSISTANT-348

- Linked cases: QBOT-FUNC-ASSISTANT-ISSUE-127-MAIN
- OS: macOS
- Mode: hybrid shell + Electron UI
- Required tools: Codex; zsh/bash; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
cd "$DEEPBANK_REPO"
npm run check
npm run build:ui
npm run e2e:doctor -- --scope=local
npm run e2e:local
```

### Assertions
**Background**: #124 中,自建专家默认私有可直接用;仅当要**发布给他人用**时才需审核。 **Problem or task**: 实现「发布申请 → admin 审核 → 通过转公开」闭环 + 助理配置内的 admin 审核位。 **Desired outcome**: 用户可对自己的私有专家发起发布申请;admin(个人白名单)在助理配置看到待审列表并通过/驳回;通过后 `visibility` 转 public。
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
Issue status is blocked.

## QBOT-CODEX-WIN-ASSISTANT-349

- Linked cases: QBOT-NEG-ASSISTANT-ISSUE-127-NEG
- OS: Windows
- Mode: hybrid shell + Electron UI
- Required tools: Codex; PowerShell; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $env:DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
Set-Location $env:DEEPBANK_REPO
npm run check
npm run build:ui
npm run e2e:doctor -- --scope=local
npm run e2e:local
```

### Assertions
The product reports blocked/failed/degraded state truthfully and produces no fabricated success evidence.
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
Issue status is blocked.

## QBOT-CODEX-MAC-ASSISTANT-350

- Linked cases: QBOT-NEG-ASSISTANT-ISSUE-127-NEG
- OS: macOS
- Mode: hybrid shell + Electron UI
- Required tools: Codex; zsh/bash; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
cd "$DEEPBANK_REPO"
npm run check
npm run build:ui
npm run e2e:doctor -- --scope=local
npm run e2e:local
```

### Assertions
The product reports blocked/failed/degraded state truthfully and produces no fabricated success evidence.
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
Issue status is blocked.

## QBOT-CODEX-WIN-SKILLS-MCP-EXPERTS-351

- Linked cases: QBOT-FUNC-SKILLS-MCP-ISSUE-128-MAIN
- OS: Windows
- Mode: hybrid shell + Electron UI
- Required tools: Codex; PowerShell; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $env:DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
Set-Location $env:DEEPBANK_REPO
npm run check
npm run build:ui
npm run codex:doctor
npm run codex:smoke
```

### Assertions
**Background**: WorkBuddy 专家(=plugin)可绑 skill,且 skill 可内置于专家、不进市场(SKILL.md 自带 `visibility` 字段)。#124 据此支持「隐式/私有 skill」。 **Problem or task**: 提供「创建专家的专家」(Meta),一次性产出 1 份专家 MD + N 份私有 skill MD,统一入库。 **Desired outcome**: 用户通过 Meta 专家对话即可生成可直接用(私有)的新专家及其私有 skill,零污染技能市场。
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
Issue status is blocked.

## QBOT-CODEX-MAC-SKILLS-MCP-EXPERTS-352

- Linked cases: QBOT-FUNC-SKILLS-MCP-ISSUE-128-MAIN
- OS: macOS
- Mode: hybrid shell + Electron UI
- Required tools: Codex; zsh/bash; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
cd "$DEEPBANK_REPO"
npm run check
npm run build:ui
npm run codex:doctor
npm run codex:smoke
```

### Assertions
**Background**: WorkBuddy 专家(=plugin)可绑 skill,且 skill 可内置于专家、不进市场(SKILL.md 自带 `visibility` 字段)。#124 据此支持「隐式/私有 skill」。 **Problem or task**: 提供「创建专家的专家」(Meta),一次性产出 1 份专家 MD + N 份私有 skill MD,统一入库。 **Desired outcome**: 用户通过 Meta 专家对话即可生成可直接用(私有)的新专家及其私有 skill,零污染技能市场。
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
Issue status is blocked.

## QBOT-CODEX-WIN-SKILLS-MCP-EXPERTS-353

- Linked cases: QBOT-NEG-SKILLS-MCP-ISSUE-128-NEG
- OS: Windows
- Mode: hybrid shell + Electron UI
- Required tools: Codex; PowerShell; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $env:DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
Set-Location $env:DEEPBANK_REPO
npm run check
npm run build:ui
npm run codex:doctor
npm run codex:smoke
```

### Assertions
The product reports blocked/failed/degraded state truthfully and produces no fabricated success evidence.
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
Issue status is blocked.

## QBOT-CODEX-MAC-SKILLS-MCP-EXPERTS-354

- Linked cases: QBOT-NEG-SKILLS-MCP-ISSUE-128-NEG
- OS: macOS
- Mode: hybrid shell + Electron UI
- Required tools: Codex; zsh/bash; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
cd "$DEEPBANK_REPO"
npm run check
npm run build:ui
npm run codex:doctor
npm run codex:smoke
```

### Assertions
The product reports blocked/failed/degraded state truthfully and produces no fabricated success evidence.
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
Issue status is blocked.

## QBOT-CODEX-WIN-SKILLS-MCP-EXPERTS-355

- Linked cases: QBOT-FUNC-SKILLS-MCP-ISSUE-129-MAIN
- OS: Windows
- Mode: shell + Codex CLI/runtime artifacts
- Required tools: Codex; PowerShell; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $env:DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
Set-Location $env:DEEPBANK_REPO
npm run check
npm run codex:doctor
npm run codex:smoke
```

### Assertions
**Background**: #124 把专家升级为 server 端目录 + seed 机制。机制(脚本/表)是工程交付;**生产到底初始化哪些专家、各自人设内容**是产品/内容决策,与工程解耦。 **Problem or task**: 沉淀「生产初始专家清单」:列出生产上线要内置哪些专家、各自定位与人设要点。 **Desired outcome**: 一份可喂给子#1 seed 脚本的生产专家清单 + 人设内容(opus 原创、银行域、合规口径)。
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
Issue status is blocked.

## QBOT-CODEX-MAC-SKILLS-MCP-EXPERTS-356

- Linked cases: QBOT-FUNC-SKILLS-MCP-ISSUE-129-MAIN
- OS: macOS
- Mode: shell + Codex CLI/runtime artifacts
- Required tools: Codex; zsh/bash; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
cd "$DEEPBANK_REPO"
npm run check
npm run codex:doctor
npm run codex:smoke
```

### Assertions
**Background**: #124 把专家升级为 server 端目录 + seed 机制。机制(脚本/表)是工程交付;**生产到底初始化哪些专家、各自人设内容**是产品/内容决策,与工程解耦。 **Problem or task**: 沉淀「生产初始专家清单」:列出生产上线要内置哪些专家、各自定位与人设要点。 **Desired outcome**: 一份可喂给子#1 seed 脚本的生产专家清单 + 人设内容(opus 原创、银行域、合规口径)。
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
Issue status is blocked.

## QBOT-CODEX-WIN-SKILLS-MCP-EXPERTS-357

- Linked cases: QBOT-NEG-SKILLS-MCP-ISSUE-129-NEG
- OS: Windows
- Mode: shell + Codex CLI/runtime artifacts
- Required tools: Codex; PowerShell; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $env:DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
Set-Location $env:DEEPBANK_REPO
npm run check
npm run codex:doctor
npm run codex:smoke
```

### Assertions
The product reports blocked/failed/degraded state truthfully and produces no fabricated success evidence.
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
Issue status is blocked.

## QBOT-CODEX-MAC-SKILLS-MCP-EXPERTS-358

- Linked cases: QBOT-NEG-SKILLS-MCP-ISSUE-129-NEG
- OS: macOS
- Mode: shell + Codex CLI/runtime artifacts
- Required tools: Codex; zsh/bash; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
cd "$DEEPBANK_REPO"
npm run check
npm run codex:doctor
npm run codex:smoke
```

### Assertions
The product reports blocked/failed/degraded state truthfully and produces no fabricated success evidence.
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
Issue status is blocked.

## QBOT-CODEX-WIN-RUNTIME-PROTOCOL-359

- Linked cases: QBOT-FUNC-RUNTIME-ISSUE-130-MAIN
- OS: Windows
- Mode: shell + Codex CLI/runtime artifacts
- Required tools: Codex; PowerShell; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $env:DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
Set-Location $env:DEEPBANK_REPO
npm run check
npm run codex:doctor
npm run codex:smoke
```

### Assertions
**Background**: #124 把专家/skill 真值迁到 server 端 PG。但运行时当前仍从**本地文件**取专家人设——`server/engine.mjs:495` 用 `readMd('plugins/marketplaces/experts/plugins/<expert>/agents/<expert>.md')` 读本地 `.md` 注入 `expertPrompt`。改版后这条注入路径必须改读 PG,且要把专家**绑定的 skill**(含私有/隐式 skill)真正注入运行时。 **Problem or task**: 让运行时按「server 端专家记录 + 绑定 skill」注入,而非本地文件。 **Desired outcome**: 选定专家后,其 PG 正文 + 绑
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
Issue status is blocked.

## QBOT-CODEX-MAC-RUNTIME-PROTOCOL-360

- Linked cases: QBOT-FUNC-RUNTIME-ISSUE-130-MAIN
- OS: macOS
- Mode: shell + Codex CLI/runtime artifacts
- Required tools: Codex; zsh/bash; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
cd "$DEEPBANK_REPO"
npm run check
npm run codex:doctor
npm run codex:smoke
```

### Assertions
**Background**: #124 把专家/skill 真值迁到 server 端 PG。但运行时当前仍从**本地文件**取专家人设——`server/engine.mjs:495` 用 `readMd('plugins/marketplaces/experts/plugins/<expert>/agents/<expert>.md')` 读本地 `.md` 注入 `expertPrompt`。改版后这条注入路径必须改读 PG,且要把专家**绑定的 skill**(含私有/隐式 skill)真正注入运行时。 **Problem or task**: 让运行时按「server 端专家记录 + 绑定 skill」注入,而非本地文件。 **Desired outcome**: 选定专家后,其 PG 正文 + 绑
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
Issue status is blocked.

## QBOT-CODEX-WIN-RUNTIME-PROTOCOL-361

- Linked cases: QBOT-NEG-RUNTIME-ISSUE-130-NEG
- OS: Windows
- Mode: shell + Codex CLI/runtime artifacts
- Required tools: Codex; PowerShell; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $env:DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
Set-Location $env:DEEPBANK_REPO
npm run check
npm run codex:doctor
npm run codex:smoke
```

### Assertions
The product reports blocked/failed/degraded state truthfully and produces no fabricated success evidence.
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
Issue status is blocked.

## QBOT-CODEX-MAC-RUNTIME-PROTOCOL-362

- Linked cases: QBOT-NEG-RUNTIME-ISSUE-130-NEG
- OS: macOS
- Mode: shell + Codex CLI/runtime artifacts
- Required tools: Codex; zsh/bash; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
cd "$DEEPBANK_REPO"
npm run check
npm run codex:doctor
npm run codex:smoke
```

### Assertions
The product reports blocked/failed/degraded state truthfully and produces no fabricated success evidence.
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
Issue status is blocked.

## QBOT-CODEX-WIN-UI-UX-363

- Linked cases: QBOT-FUNC-UIUX-ISSUE-131-MAIN
- OS: Windows
- Mode: hybrid shell + Electron UI
- Required tools: Codex; PowerShell; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $env:DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
Set-Location $env:DEEPBANK_REPO
npm run check
npm run build:ui
npm run e2e:doctor -- --scope=local
npm run e2e:local
```

### Assertions
**In scope**：`src/Sidebar.tsx`（左下 user 入口与菜单结构）、`src/App.tsx`（新增检查更新 view 分支）、`src/AssistantConfig.tsx` 或轻量 view 组件（只读版本展示）、`src/app.css` / `src/qbot.css`（菜单分组与版本模块样式）、相关 `test/e2e/*` 断言更新。 **Non-goals**：不实现真实更新检查、下载、安装、自动更新状态或网络请求；不改 Electron autoUpdater；不删除团队配置/助理/助理配置路由；不改变 auth/session/runtime contract；不做 #82 其它 app-shell 收敛。
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
Requires explicit real-provider environment.

## QBOT-CODEX-MAC-UI-UX-364

- Linked cases: QBOT-FUNC-UIUX-ISSUE-131-MAIN
- OS: macOS
- Mode: hybrid shell + Electron UI
- Required tools: Codex; zsh/bash; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
cd "$DEEPBANK_REPO"
npm run check
npm run build:ui
npm run e2e:doctor -- --scope=local
npm run e2e:local
```

### Assertions
**In scope**：`src/Sidebar.tsx`（左下 user 入口与菜单结构）、`src/App.tsx`（新增检查更新 view 分支）、`src/AssistantConfig.tsx` 或轻量 view 组件（只读版本展示）、`src/app.css` / `src/qbot.css`（菜单分组与版本模块样式）、相关 `test/e2e/*` 断言更新。 **Non-goals**：不实现真实更新检查、下载、安装、自动更新状态或网络请求；不改 Electron autoUpdater；不删除团队配置/助理/助理配置路由；不改变 auth/session/runtime contract；不做 #82 其它 app-shell 收敛。
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
Requires explicit real-provider environment.

## QBOT-CODEX-WIN-UI-UX-365

- Linked cases: QBOT-NEG-UIUX-ISSUE-131-NEG
- OS: Windows
- Mode: hybrid shell + Electron UI
- Required tools: Codex; PowerShell; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $env:DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
Set-Location $env:DEEPBANK_REPO
npm run check
npm run build:ui
npm run e2e:doctor -- --scope=local
npm run e2e:local
```

### Assertions
The product reports blocked/failed/degraded state truthfully and produces no fabricated success evidence.
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
Requires explicit real-provider environment.

## QBOT-CODEX-MAC-UI-UX-366

- Linked cases: QBOT-NEG-UIUX-ISSUE-131-NEG
- OS: macOS
- Mode: hybrid shell + Electron UI
- Required tools: Codex; zsh/bash; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
cd "$DEEPBANK_REPO"
npm run check
npm run build:ui
npm run e2e:doctor -- --scope=local
npm run e2e:local
```

### Assertions
The product reports blocked/failed/degraded state truthfully and produces no fabricated success evidence.
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
Requires explicit real-provider environment.

## QBOT-CODEX-WIN-SKILLS-MCP-EXPERTS-367

- Linked cases: QBOT-FUNC-SKILLS-MCP-ISSUE-132-MAIN
- OS: Windows
- Mode: shell + Codex CLI/runtime artifacts
- Required tools: Codex; PowerShell; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $env:DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
Set-Location $env:DEEPBANK_REPO
npm run check
npm run codex:doctor
npm run codex:smoke
```

### Assertions
**Background**: 技能市场目录 `market_skills` 当前是 `seed-skills.mjs` **一次性快照 SkillHub**(`skill.daikuan.qihoo.net`),服务从本地表读、运行时不连 SkillHub。 **Current problem**: 快照=会过期,SkillHub 上新增/改动不会自动同步,要重跑脚本刷新——存在「两边同步」负担。 **Design goal**: 决定 `market_skills` 的取数策略,消除或明确同步负担。
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
Issue status is blocked.

## QBOT-CODEX-MAC-SKILLS-MCP-EXPERTS-368

- Linked cases: QBOT-FUNC-SKILLS-MCP-ISSUE-132-MAIN
- OS: macOS
- Mode: shell + Codex CLI/runtime artifacts
- Required tools: Codex; zsh/bash; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
cd "$DEEPBANK_REPO"
npm run check
npm run codex:doctor
npm run codex:smoke
```

### Assertions
**Background**: 技能市场目录 `market_skills` 当前是 `seed-skills.mjs` **一次性快照 SkillHub**(`skill.daikuan.qihoo.net`),服务从本地表读、运行时不连 SkillHub。 **Current problem**: 快照=会过期,SkillHub 上新增/改动不会自动同步,要重跑脚本刷新——存在「两边同步」负担。 **Design goal**: 决定 `market_skills` 的取数策略,消除或明确同步负担。
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
Issue status is blocked.

## QBOT-CODEX-WIN-SKILLS-MCP-EXPERTS-369

- Linked cases: QBOT-NEG-SKILLS-MCP-ISSUE-132-NEG
- OS: Windows
- Mode: shell + Codex CLI/runtime artifacts
- Required tools: Codex; PowerShell; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $env:DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
Set-Location $env:DEEPBANK_REPO
npm run check
npm run codex:doctor
npm run codex:smoke
```

### Assertions
The product reports blocked/failed/degraded state truthfully and produces no fabricated success evidence.
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
Issue status is blocked.

## QBOT-CODEX-MAC-SKILLS-MCP-EXPERTS-370

- Linked cases: QBOT-NEG-SKILLS-MCP-ISSUE-132-NEG
- OS: macOS
- Mode: shell + Codex CLI/runtime artifacts
- Required tools: Codex; zsh/bash; Node.js 22+; npm; Docker when e2e/release path requires it

### Setup
Set $DEEPBANK_REPO to the Deepbank repository path.
Confirm dependencies are installed with npm install when node_modules is missing.
Run repository doctor command when the selected validation path requires it.

### Command / Prompt
```bash
cd "$DEEPBANK_REPO"
npm run check
npm run codex:doctor
npm run codex:smoke
```

### Assertions
The product reports blocked/failed/degraded state truthfully and produces no fabricated success evidence.
No skipped or blocked prerequisite is counted as pass.
No token, API key, runtime home, raw private transcript, or secret value appears in visible output or saved artifacts.

### Skip / Block Rules
Issue status is blocked.

