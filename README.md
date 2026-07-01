# QbotTestAgent

QBot / Deepbank v2 test-agent team workspace.

This repository contains:

- Agent team architecture and specialist `SKILL.md` files.
- A local runner that reads Deepbank GitLab issues and generates test assets.
- Issue intelligence filtering that separates product/function requirements from development-process issues before case generation.
- Functional test cases for QBot / Deepbank v2.
- Codex executable Windows and macOS automation flow plans.
- Dynamic test-plan maintenance for continuously changing GitLab issues.
- Dedicated strict test-case review for granularity, executable paths, expected results, traceability, priority, and evidence requirements.
- Evidence-quality audit and issue monitor reports.

## Current Delivery

Final reviewed output:

```text
outputs/qbot-agent-team-review-2026-07-01/latest-live-product-scope-automation-executable-v7/
```

Key files:

- `outputs/qbot-agent-team-review-2026-07-01/latest-live-product-scope-automation-executable-v7/qbot-test-plan.xlsx`
- `outputs/qbot-agent-team-review-2026-07-01/latest-live-product-scope-automation-executable-v7/issue-intelligence-report.json`
- `outputs/qbot-agent-team-review-2026-07-01/latest-live-product-scope-automation-executable-v7/issue-intelligence-report.md`
- `outputs/qbot-agent-team-review-2026-07-01/latest-live-product-scope-automation-executable-v7/functional-test-cases.json`
- `outputs/qbot-agent-team-review-2026-07-01/latest-live-product-scope-automation-executable-v7/codex-automation-flows.json`
- `outputs/qbot-agent-team-review-2026-07-01/latest-live-product-scope-automation-executable-v7/codex-automation-flows.md`
- `outputs/qbot-agent-team-review-2026-07-01/latest-live-product-scope-automation-executable-v7/run-result.json`
- `outputs/qbot-agent-team-review-2026-07-01/automation-execution-review-v7/qbot-automation-execution-capability-review-2026-07-01.md`

Current generated counts:

- GitLab issues analyzed: 196
- Product/function issues selected: 98
- Development/process issues excluded: 98
- Functional test cases: 161
- Codex automation flows: 302
- Windows flows: 151
- macOS flows: 151
- Audit status: pass

## Validate

```powershell
npm run check
```

On macOS:

```bash
npm run check
```

## Execute Generated Automation

The generated `codex-automation-flows.json` is executable through the local runner. Use `automation-doctor` before any real run.

macOS daily local suite:

```bash
npm run automation:doctor -- --repo /Users/qifu/Documents/deepbankV2 --flows outputs/qbot-agent-team-review-2026-07-01/latest-live-product-scope-automation-executable-v7/codex-automation-flows.json --out outputs/automation-doctor-macos-daily --suite daily
npm run automation:run -- --repo /Users/qifu/Documents/deepbankV2 --flows outputs/qbot-agent-team-review-2026-07-01/latest-live-product-scope-automation-executable-v7/codex-automation-flows.json --out outputs/automation-run-macos-daily --suite daily
```

Windows daily local suite:

```powershell
npm run automation:doctor -- --repo D:\deepbankV2 --flows D:\QbotTestAgent\outputs\qbot-agent-team-review-2026-07-01\latest-live-product-scope-automation-executable-v7\codex-automation-flows.json --out D:\QbotTestAgent\outputs\automation-doctor-windows-daily --suite daily --os Windows
npm run automation:run -- --repo D:\deepbankV2 --flows D:\QbotTestAgent\outputs\qbot-agent-team-review-2026-07-01\latest-live-product-scope-automation-executable-v7\codex-automation-flows.json --out D:\QbotTestAgent\outputs\automation-run-windows-daily --suite daily --os Windows
```

Suites:

- `smoke`: A0 UI smoke only.
- `daily`: A0/A1 local mock or fixture flows.
- `local`: A0/A1 local and design-review checks.
- `real`: A2 real Lingxi/GitLab/SkillHub/LLM/MCP dependency flows.
- `release`: A3 release, desktop package, Teams-hosted, remote-dev, OS specialty flows.
- `all`: all levels.

Use `--dry-run` to generate scripts and reports without running product tests. Execution output is written to `automation-execution-report.json`, `automation-execution-report.md`, and per-flow `run.sh` or `run.ps1` plus stdout/stderr logs.

Each execution result includes an assertion checklist. The runner checks command exit code, timeout, case assertion carry-through, black-box assertion carry-through, stdout/stderr secret leakage, and expected evidence paths. Product-specific behavior assertions are enforced by QBot's own Playwright/runtime/release scripts through non-zero exits. Use `--strict-assertions` when missing evidence paths should fail the run instead of being reported as warnings.

## Regenerate From Live GitLab

```powershell
node src/cli.mjs run --repo D:\deepbankV2 --source live-gitlab --gitlab-host gitlab.daikuan.qihoo.net --gitlab-project songrongxin/deepbankv2 --out D:\QbotTestAgent\outputs\deepbank-live-all-issues --state D:\QbotTestAgent\state\issue-monitor-snapshot-live-all.json
```

On macOS:

```bash
node src/cli.mjs run --repo /path/to/deepbankV2 --source live-gitlab --gitlab-host gitlab.daikuan.qihoo.net --gitlab-project songrongxin/deepbankv2 --out outputs/deepbank-live-all-issues --state state/issue-monitor-snapshot-live-all.json
```

## Monitor Issue Changes

```powershell
node src/cli.mjs monitor --repo D:\deepbankV2 --source live-gitlab --gitlab-host gitlab.daikuan.qihoo.net --gitlab-project songrongxin/deepbankv2 --out D:\QbotTestAgent\outputs\monitor-live-check --state D:\QbotTestAgent\state\issue-monitor-snapshot-live-all.json
```

On macOS:

```bash
node src/cli.mjs monitor --repo /path/to/deepbankV2 --source live-gitlab --gitlab-host gitlab.daikuan.qihoo.net --gitlab-project songrongxin/deepbankv2 --out outputs/monitor-live-check --state state/issue-monitor-snapshot-live-all.json
```

The monitor output includes `delta_summary`, impacted modules, recommended agents, a `workflow_plan`, and an issue-intelligence scope report. Material issue changes should flow through:

```text
gitlab-issue-monitor -> issue-intelligence-analyst(product/function scope filter) -> qbot-test-chief -> test-plan-maintainer -> functional-test-case-designer -> codex-os-automation-planner -> specialist agents -> test-case-reviewer -> evidence-quality-auditor
```

Only issues selected by `issue-intelligence-report.json` with `handoff_to_test_design=yes` should produce functional cases and Codex flows. MR workflow, repo hooks, refactor/chore, CI/e2e infrastructure, governance, and development-process issues are kept in the scope report but excluded from case generation unless their body defines explicit product behavior.

Use live GitLab when current issue freshness matters. If live GitLab is unavailable, treat the result as snapshot-based or blocked, not current.

## Pre-Test Readiness

- Confirm `npm run check` passes on the machine that will generate or review artifacts.
- Confirm live GitLab reads are available before claiming current issue coverage.
- Keep generated temp outputs, credentials, tokens, `.env` files, and `node_modules` out of commits.
- If live GitLab is unavailable, report the run as blocked or degraded instead of reusing old snapshots as current data.
