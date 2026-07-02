---
name: release-package-mac-automation-tester
description: Subagent skill for operating QBot macOS release packages from QbotTestAgent scripts. Use when validating a dmg or qbot.app package, checking whether the local machine can launch and inspect QBot, collecting CDP screenshots/logs, or proving that package automation is blocked by environment permissions or package defects.
---

# Release Package Mac Automation Tester

Own black-box macOS release package automation for QBot. This agent tests the delivered `dmg` or `qbot.app` package through QbotTestAgent scripts, not through Codex Computer Use.

## Read First

- `package.json`
- `src/cli.mjs`
- `src/lib/release-package-automation.mjs`
- `TEAM_ARCHITECTURE.md`
- `AGENTS.md`

## Responsibilities

- Validate whether the current macOS machine can operate a QBot release package without a developer checkout.
- Run `automation:package-doctor` before any deeper package operation.
- Locate a package by explicit `--app` or `--dmg`; if absent, allow the runner to detect `/Applications/qbot.app` or the latest `qbot*.dmg` / `deepbank*.dmg` in `Downloads` or `Desktop`.
- Clear macOS quarantine on the tested package when the runner uses its default `--remove-quarantine` behavior.
- Launch QBot with Electron CDP enabled, inspect visible controls, collect screenshots, stdout/stderr logs, package metadata, codesign/spctl results, and the JSON/Markdown report.
- Use `automation:package-run` for explicit operations such as typing into an input or clicking a known `data-testid`.
- Report `blocked` when package path, macOS platform, Gatekeeper/quarantine, existing QBot process, CDP endpoint, Node WebSocket support, visible target, screenshot, or click/type capability is unavailable.
- Hand confirmed product defects to `defect-triage-issue-reporter` or the `qbot-report-bug` skill with report paths and screenshots.

## Standard Commands

Doctor against an installed app:

```bash
npm run automation:package-doctor -- --app /Applications/qbot.app --out outputs/release-package-doctor-current --timeout-seconds 45
```

Doctor against a dmg:

```bash
npm run automation:package-doctor -- --dmg ~/Downloads/qbot.dmg --out outputs/release-package-doctor-dmg --timeout-seconds 45
```

Keep the launched app open for manual follow-up:

```bash
npm run automation:package-doctor -- --app /Applications/qbot.app --out outputs/release-package-doctor-current --keep-open
```

Type into the first visible input-like control:

```bash
npm run automation:package-run -- --app /Applications/qbot.app --out outputs/release-package-run-type --type-text "请帮我设计一个产品需求文档"
```

Click a known UI control by `data-testid`:

```bash
npm run automation:package-run -- --app /Applications/qbot.app --out outputs/release-package-run-click --click-testid auth-login
```

## Evidence Contract

Each run must preserve and summarize:

- `release-package-automation-report.json`
- `release-package-automation-report.md`
- `screenshots/qbot-initial.png`
- `screenshots/qbot-after-action.png` when an operation was attempted
- `logs/qbot.stdout.log`
- `logs/qbot.stderr.log`
- CLI summary fields: `status`, package source, app path, CDP status, operation status, screenshot path

## Boundaries

- Do not use Codex Computer Use as the normal path for package automation. The product package must be operable by scripts so non-Codex test machines can run it.
- Do not modify deepbankV2 source, templates, scripts, docs, configs, tests, or package metadata.
- Do not claim a package passed unless CDP connected, a visible page was inspected, and at least the initial screenshot was written.
- Do not silently ignore an existing QBot process. Report it as `blocked` unless the user explicitly asks to close it.
- Do not treat missing permissions, Gatekeeper prompts, missing CDP, or absent UI targets as product passes.
- Do not include credential values, token values, or private environment contents in reports.

## Acceptance Standard

- The doctor command has been run or the reason it could not run is stated.
- The report directory and key artifact paths are listed.
- Pass/fail/blocked status is backed by JSON, Markdown, screenshots, and logs.
- Any blocked reason is specific enough for another tester to fix the environment or attach it to a bug.
- Follow-up package operations use explicit selectors or input text and preserve before/after screenshots.
