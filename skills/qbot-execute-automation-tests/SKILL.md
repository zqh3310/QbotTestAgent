---
name: qbot-execute-automation-tests
description: Execute QBot Playwright UI Agent automation from PRD/Qbot_TestCase.xlsx, run the mandatory core regression set, archive screenshots/reports under autoTest, and output a result Excel. Use when the user says "执行自动化测试", "跑自动化测试", "QBot 自动化测试", "回归测试", "按 Qbot_TestCase 跑", or asks to run QBot automated UI tests and preserve evidence.
---

# QBot Automation Test Executor

## Boundary

The agent team is QA only. Treat `/Users/qifu/Documents/deepbankV2` as read-only unless the user explicitly overrides that rule in the same request. This skill may read QBot/deepbankV2 source, issues, templates, and runtime status, but must not patch, commit, or directly fix deepbankV2.

This skill owns automation orchestration in `QbotTestAgent`. Evidence and reports must be written under the QA workspace, not inside deepbankV2.

## Canonical Inputs

- V1 core source case workbook: `<QbotTestAgent>/PRD/V1版本核心功能自动化测试用例.xlsx`
- Preferred source case workbook: `<QbotTestAgent>/PRD/Qbot_自动化可执行测试用例_精确执行版_2026-07-03.xlsx`
- Fallback source case workbook: `<QbotTestAgent>/PRD/Qbot_TestCase.xlsx`
- Mandatory run definition: `references/core-case-map.json`
- Core/system scenario file: `references/core-system-scenarios.json`
- Evidence root: `<QbotTestAgent>/autoTest`

Every automation cycle must create a new timestamped run folder:

```text
autoTest/YYYYMMDDHHmm_自动化测试结果/
```

That folder must contain all screenshots, transcripts, case reports, logs, JSON summaries, LLM review packets when needed, and the result Excel for that run. The result Excel filename must be:

```text
YYYYMMDDHHmm_自动化测试结果.xlsx
```

Every run must also produce these run-level human-readable artifacts:

```text
最终自动化测试报告.md
所有证据截图图集.html
所有证据截图图集.md
```

The final report must include execution scope, environment/source information when available, module-level pass/fail/block counts, every executed case, operation evidence, failure/blocker explanations, and links to key screenshots and case reports. The screenshot galleries must group every saved screenshot by case so reviewers can inspect the UI evidence without opening each case directory manually.

## Mandatory Run Policy

When the user says "执行自动化测试" without further scope, run the `mandatory` profile from `references/core-case-map.json`.

Mandatory profile means:

- core conversation and user-value scenarios
- text, long text, structured data, image, TXT, MD, Office/PDF/PPT attachment paths
- product/operation expert-style complete task flows
- sensitive/internal information protection
- visible first-version modules except deep project/automation capability, because those are later-iteration entries unless the user explicitly requests full coverage
- input area, attachment entry, session management, personal settings, knowledge, connectors, experts, search, sidebar, welcome page, and chat module checks

Do not silently downgrade to a smoke test. If QBot is not running, CDP is unavailable, login is required, macOS file dialog permissions block upload, or screenshots cannot be captured, mark the affected cases as `blocked` with concrete reasons.

Attachment/document automation must prefer the Electron E2E bridge instead of macOS native file dialog control. QBot must be launched with `DEEPBANK_E2E=1` for document file paths to be accepted by `window.agent.shell.stageDocumentAttachments({ filePaths })`. If the connected QBot is not in E2E mode, report that QBot must be restarted by the automation launcher; do not ask testers to rely on osascript/macOS Accessibility as the primary path.

OAuth automation must not stop at "opened Safari" or ask the tester to click the authorization page manually. For login cases, the runner should:

- click QBot's `[data-testid="auth-login"]` entry;
- capture the OAuth authorize URL from the QBot E2E log when available, or from Safari's current tab as a fallback;
- complete Lingxi login/authorization with Playwright-controlled Chromium/Chrome;
- wait for the QBot auth attempt to become `authenticated`;
- return to the QBot window and assert the logged-in workbench is visible.

For fully automatic Lingxi login, configure credentials through environment variables before running:

```bash
export DEEPBANK_E2E_LINGXI_USERNAME='your-domain-account'
export DEEPBANK_E2E_LINGXI_PASSWORD='your-password'
```

Do not write credentials into reports, screenshots metadata, Git commits, or casebooks. If credentials are missing and the authorization page requires login, mark the login case as `blocked` with that reason.

Conversation automation must execute true multi-turn scenarios as multiple UI turns. If test data contains `普通问题：...；追问：...` or similar first-round/follow-up structure, send the first question, wait for a valid reply and screenshot, then send the follow-up, wait again, and preserve per-turn evidence. Do not collapse multi-turn test data into a single prompt.

## Execution Workflow

1. Confirm the project root is `QbotTestAgent`.
2. Read `references/core-case-map.json` and use the `mandatory` profile unless the user requested `full` or a specific case list.
3. For first-version core regression, use `PRD/V1版本核心功能自动化测试用例.xlsx`. For the older full product casebook, use `PRD/Qbot_自动化可执行测试用例_精确执行版_2026-07-03.xlsx` or `PRD/Qbot_TestCase.xlsx`.
4. Execute the standard casebook-driven Playwright UI Agent runner:

```bash
npm run ui-agent:casebook-run -- --casebook PRD/V1版本核心功能自动化测试用例.xlsx --profile mandatory
```

5. Read `<run_dir>/automation-run-report.md` and `<run_dir>/YYYYMMDDHHmm_自动化测试结果.xlsx`.
7. Summarize in Chinese:
   - executed case count
   - passed / failed / blocked count
   - failed cases with concise bug descriptions
   - blocked cases with concrete blocker reason
   - evidence root and result Excel path

## Commands

Normal mandatory run:

```bash
npm run ui-agent:casebook-run -- --casebook PRD/V1版本核心功能自动化测试用例.xlsx --profile mandatory
```

Full run:

```bash
npm run ui-agent:casebook-run -- --casebook PRD/V1版本核心功能自动化测试用例.xlsx --profile full
```

Run only specific cases:

```bash
npm run ui-agent:casebook-run -- --case AUTO-0152,AUTO-0201
```

Use a non-default CDP endpoint:

```bash
npm run ui-agent:casebook-run -- --cdp http://127.0.0.1:9224
```

Run a specific auth case against an already-launched qbot-dev package:

```bash
npm run ui-agent:casebook-run -- --case AUTO-0001 --cdp http://127.0.0.1:<port> --qbot-stderr-log <run>/logs/qbot.stderr.log
```

Validate casebook/result generation without operating QBot:

```bash
npm run ui-agent:casebook-run -- --profile mandatory --limit 2 --skip-run
```

## Evidence Requirements

Each executed case must preserve:

- operation steps
- expected result
- actual result
- conclusion
- at least one screenshot, or a clear `blocked` reason if screenshot capture is unavailable
- transcript / reply delta when the case includes Agent conversation
- case-level JSON and Markdown report
- an LLM review request file when deterministic automation cannot decide whether the observed behavior meets the expected result

The run-level folder must include:

- `automation-run-summary.json`
- `automation-run-report.md`
- `最终自动化测试报告.md`
- `所有证据截图图集.html`
- `所有证据截图图集.md`
- `YYYYMMDDHHmm_自动化测试结果.xlsx`
- `logs/*.log`
- `cases/**` evidence directories

## Result Interpretation

Use these terms consistently:

- `passed`: the user-visible behavior met the test goal and evidence exists.
- `failed`: the test ran and observed a product defect or assertion failure.
- `blocked`: the test could not reach the product assertion because of environment, login, permission, CDP, missing package, or file-picker automation limitations.
- `needs_llm_review`: Playwright completed the operation and captured evidence, but deterministic assertions cannot decide whether the result fits user/product logic. Use the generated `llm-review-request.md` before final classification.

Never report an automation run as successful just because the command completed. The result is based on case assertions and evidence.

## Bug Filing

If the user asks to file bugs after a run, use the `qbot-report-bug` skill. Do not directly create GitLab issues from this skill. Include the case report and screenshot paths from `autoTest/<timestamp>/...` as evidence.
