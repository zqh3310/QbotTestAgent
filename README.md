# QbotTestAgent

QBot / Deepbank v2 test-agent team workspace.

This repository contains:

- Agent team architecture and specialist `SKILL.md` files.
- A local runner that reads Deepbank GitLab issues and generates test assets.
- Functional test cases for QBot / Deepbank v2.
- Codex executable Windows and macOS automation flow plans.
- Evidence-quality audit and issue monitor reports.

## Current Delivery

Final reviewed output:

```text
outputs/deepbank-live-all-issues/
```

Key files:

- `outputs/deepbank-live-all-issues/qbot-test-plan.xlsx`
- `outputs/deepbank-live-all-issues/functional-test-cases.json`
- `outputs/deepbank-live-all-issues/codex-automation-flows.json`
- `outputs/deepbank-live-all-issues/codex-automation-flows.md`
- `outputs/deepbank-live-all-issues/run-result.json`

Current generated counts:

- GitLab issues analyzed: 132
- Functional test cases: 195
- Codex automation flows: 370
- Windows flows: 185
- macOS flows: 185
- Audit status: pass

## Validate

```powershell
npm run check
```

On macOS:

```bash
npm run check
```

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

## Pre-Test Readiness

- Confirm `npm run check` passes on the machine that will generate or review artifacts.
- Confirm live GitLab reads are available before claiming current issue coverage.
- Keep generated temp outputs, credentials, tokens, `.env` files, and `node_modules` out of commits.
- If live GitLab is unavailable, report the run as blocked or degraded instead of reusing old snapshots as current data.
