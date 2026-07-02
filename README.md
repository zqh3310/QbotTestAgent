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

When a real `automation-run` fails, the runner also writes `bug-issue-drafts.json`, `bug-issue-drafts.md`, and `gitlab-issue-creation-report.json` into the run output. These are local drafts by default. To create remote GitLab issues, use both `--create-gitlab-issues` and `--confirm-create-issues` with `GITLAB_TOKEN`, `GLAB_TOKEN`, or `PRIVATE_TOKEN` set:

```bash
npm run automation:run -- --repo /Users/qifu/Documents/deepbankV2 --flows outputs/qbot-agent-team-review-2026-07-01/latest-live-product-scope-automation-executable-v7/codex-automation-flows.json --out outputs/automation-run-macos-daily --suite daily --create-gitlab-issues --confirm-create-issues
```

Remote issue creation dedupes by a stable fingerprint before posting. Blocked runs caused by OS mismatch, missing env, or missing prerequisites are reported as blockers instead of being auto-filed as product bugs.

For long unattended runs, use `--suite all` on each OS runner separately. The runner writes `automation-progress.json` after every flow and can resume with the same output directory:

```bash
npm run automation:run -- --repo /Users/qifu/Documents/deepbankV2 --flows outputs/qbot-agent-team-review-2026-07-01/latest-live-product-scope-automation-executable-v7/codex-automation-flows.json --out outputs/full-run-macos --suite all --max-duration-minutes 480
npm run automation:run -- --repo /Users/qifu/Documents/deepbankV2 --flows outputs/qbot-agent-team-review-2026-07-01/latest-live-product-scope-automation-executable-v7/codex-automation-flows.json --out outputs/full-run-macos --suite all --resume
```

For multiple runners, split the selected flow list with `--shard N/M`:

```bash
npm run automation:run -- --repo /Users/qifu/Documents/deepbankV2 --flows outputs/qbot-agent-team-review-2026-07-01/latest-live-product-scope-automation-executable-v7/codex-automation-flows.json --out outputs/full-run-macos-shard-1 --suite all --shard 1/3
```

After fixes, rerun only previous failures:

```bash
npm run automation:run -- --repo /Users/qifu/Documents/deepbankV2 --flows outputs/qbot-agent-team-review-2026-07-01/latest-live-product-scope-automation-executable-v7/codex-automation-flows.json --out outputs/rerun-failed-macos --suite all --retry-failed-report outputs/full-run-macos/automation-execution-report.json
```

Each run also writes `automation-delivery-report.md`, which is the handoff summary for completed, failed, blocked, warning, bug draft, and GitLab issue creation counts.

## Validate macOS Release Package

Use this path when a tester has a delivered QBot `dmg` or installed `/Applications/qbot.app` and needs to verify that scripts can operate the product package directly. This does not depend on Codex Computer Use.

Doctor against an installed app:

```bash
npm run automation:package-doctor -- --app /Applications/qbot.app --out outputs/release-package-doctor-current --timeout-seconds 45
```

Doctor against a dmg:

```bash
npm run automation:package-doctor -- --dmg ~/Downloads/qbot.dmg --out outputs/release-package-doctor-dmg --timeout-seconds 45
```

Run a simple input operation after doctor passes:

```bash
npm run automation:package-run -- --app /Applications/qbot.app --out outputs/release-package-run-type --type-text "请帮我设计一个产品需求文档"
```

Run a click operation when the target exposes a `data-testid`:

```bash
npm run automation:package-run -- --app /Applications/qbot.app --out outputs/release-package-run-click --click-testid auth-login
```

Keep QBot open after the script finishes:

```bash
npm run automation:package-doctor -- --app /Applications/qbot.app --out outputs/release-package-doctor-current --keep-open
```

The package runner writes:

- `release-package-automation-report.json`
- `release-package-automation-report.md`
- `screenshots/qbot-initial.png`
- `screenshots/qbot-after-action.png` when an operation is attempted
- `logs/qbot.stdout.log`
- `logs/qbot.stderr.log`

If package launch, Gatekeeper/quarantine cleanup, Electron CDP connection, screenshot capture, visible control discovery, click, or typing is unavailable, the runner must return `blocked` or `failed` with a specific reason. It must not report a fake pass.

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
