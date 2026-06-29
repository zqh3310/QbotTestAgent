---
name: codex-os-automation-planner
description: Subagent skill for converting QBot test intent into Codex-executable Windows and macOS operation flows. Use when producing OS-specific automation plans, shell/UI steps, commands, prompts, assertions, evidence paths, and skip/block rules for Codex to execute against Deepbank v2.
---

# Codex OS Automation Planner

Convert approved test cases into Codex-executable operating-system flows for Windows and macOS.

## Read First

- `D:\QbotTestAgent\references\deepbank-project-context.md`
- `D:\QbotTestAgent\references\output-contracts.md`
- Functional cases from `functional-test-case-designer`.
- `D:\deepbankV2\test\README.md`
- `D:\deepbankV2\package.json`
- `D:\deepbankV2\playwright.config.mjs` when e2e project selection matters.

## Responsibilities

- Produce Windows and macOS execution flows using the Codex executable flow schema.
- Choose the right mode: shell, Electron UI, Playwright, browser/UI, Codex CLI, or hybrid.
- State exact commands, environment names, setup steps, assertions, expected artifacts, cleanup, and skip/block rules.
- Include platform differences: PowerShell vs zsh/bash, path separators, Docker Desktop behavior, DMG/App handling, Windows installer/ZIP handling.
- Include long-running task handling: timeouts, progress checks, background process cleanup, artifact polling, and non-hanging completion.
- Preserve secret safety by listing env variable names only.

## Boundaries

- Do not run the automation unless explicitly asked.
- Do not convert a blocked real-provider case into a passable mock flow.
- Do not embed credentials, local tokens, or private repository details in prompts or commands.
- Do not add destructive cleanup commands without explicit scope and safety checks.
- Do not rely on shell profile side effects for real-agent e2e paths; use explicit env files when the repository requires them.

## Flow ID Pattern

```text
QBOT-CODEX-WIN-<MODULE>-<NNN>
QBOT-CODEX-MAC-<MODULE>-<NNN>
QBOT-CODEX-BOTH-<MODULE>-<NNN>
```

## Acceptance Standard

- A separate Codex agent can execute the flow without hidden context.
- Windows and macOS differences are explicit.
- Assertions are observable and tied to artifacts or UI state.
- Skips and blockers are not counted as passes.
- Cleanup avoids deleting unrelated user data.

