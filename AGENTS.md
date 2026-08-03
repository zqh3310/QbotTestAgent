# QbotTestAgent Project Memory

## QBot Automation Framework

- Before designing, starting, monitoring, resuming, or adjudicating any QBot Casebook run, read and follow `/Users/qifu/Documents/QbotTestAgent/QBOT_AUTOMATION_FRAMEWORK.md`.
- Treat that file as the canonical execution contract for the 74-Case internal-beta gate, the 160-Case production-gray gate, Core Beta v2 routing, 360Teams execution, fixture-controller preflight, evidence manifests, read-only monitoring, trusted adjudication, and multi-run release decisions.
- Never start a second runner, reuse a mutable output directory, bypass initialization or fixture preflight, mark synthetic/incomplete evidence completed, or treat raw `passed/failed` as a trusted conclusion.
- Before any real 74/160 Casebook batch, run `npm run core-beta:pretest -- ...` with the exact Casebook, Sheet, release identity, lane and fixture controller; only `READY` authorizes runner startup.
- If framework behavior, CLI options, evidence schemas, Casebook identity, or release-gate rules change, update `QBOT_AUTOMATION_FRAMEWORK.md` and its invariant tests in the same commit.

## Monitor Self-Healing Rule

- When read-only monitoring finds a confirmed `framework_issue` or `testcase_issue`, do not stop at reporting it. Preserve the current immutable output and diagnostics, stop the unique runner, pause the stale monitor, identify the root cause, and autonomously repair the QbotTestAgent framework or Casebook.
- Every repair must add or strengthen a regression/invariant test, update `QBOT_AUTOMATION_FRAMEWORK.md` when the contract changes, run the mandatory framework checks, and establish a clean pushed `main == origin/main` baseline before testing continues.
- Never edit or append to the failed output directory. Run a new pretest and continue in a new immutable output directory with one runner and the same frozen release identity. Core Beta v2 reruns the complete selected scope with `inherited=0` and `synthetic=0`; older protocols may resume only through their documented lineage and explicit impact rules.
- Preserve the original issue and evidence in release reporting. A later passing rerun never erases an earlier framework failure, testcase failure, product bug, or flake.
- Product defects are not framework repairs: do not modify `/Users/qifu/Documents/deepbankV2`. Record the defect and continue only with independent Cases when the Casebook fail policy and evidence integrity allow it.
- Do not auto-continue when safe repair is impossible, credentials or protected resources are missing, human approval is required, the requested release is unavailable, or release identity cannot be restored exactly. In those cases, keep the batch frozen and report the single concrete blocker.

## DeepbankV2 Boundary

- The agent team is a QA/test team for QBot/deepbankV2, not the development owner.
- Treat `/Users/qifu/Documents/deepbankV2` as read-only unless the user explicitly overrides this rule in the same request.
- Do not modify deepbankV2 source code, GitLab templates, scripts, docs, configs, generated files, tests, or package metadata.
- Do not create patches, commits, branches, merge requests, or direct fixes in deepbankV2.
- Allowed deepbankV2 actions are inspection, reading source/issues/templates, running non-mutating checks, and summarizing findings.
- Any recommended changes for deepbankV2 must be written as test findings, reports, issue drafts, or output artifacts under `/Users/qifu/Documents/QbotTestAgent/outputs`.
- If repository freshness is required, prefer `git fetch` first; only run `git pull --ff-only` when the user asks to ensure latest code and the worktree is clean.

## Bug Issue Reporting Rule

- This rule is required by GitLab issue https://gitlab.daikuan.qihoo.net/songrongxin/deepbankv2/-/issues/213.
- When the user asks to "提bug", "提交bug", "报bug", "提缺陷", or create a GitLab Bug issue for deepbankV2, first read `/Users/qifu/Documents/deepbankV2/.gitlab/issue_templates/Bug.md`, `/Users/qifu/Documents/deepbankV2/.gitlab/README.md`, and `/Users/qifu/Documents/deepbankV2/.gitlab/scripts/gitlab_labels.sh`.
- Use those live `.gitlab` template and label rules as the source of truth before drafting or submitting the issue.
- New Bug issue titles should use the `【Bug】` prefix, and labels should be selected from the repository-managed labels, normally including `kind/bug`, `status/ready`, and the relevant `area/*` label.
- Unless the user explicitly names another assignee, newly created QBot/deepbankV2 Bug issues should be assigned to Zhu Jie: GitLab user `zhujie`, name `朱杰`, user id `235`.
- After submitting a Bug issue through the API, verify the created issue title and labels from GitLab. If labels did not persist, report that clearly and list the labels the user should add manually.

## Release Package Automation

- QbotTestAgent owns package-level QA automation for delivered QBot macOS test packages.
- Use `npm run automation:package-doctor` before `npm run automation:package-run`.
- The normal package automation path is script + Electron CDP + screenshots/logs, not Codex Computer Use, so tester machines without Codex UI control can run it.
- Package automation outputs belong under `/Users/qifu/Documents/QbotTestAgent/outputs`.
- A run with missing package, Gatekeeper/quarantine blocker, existing QBot process, missing CDP, unavailable screenshot/click/type capability, or permission failure must report `blocked` or `failed` with a concrete reason.

## Local Main Slim Startup Automation

- When testing the latest local QBot source, start `/Users/qifu/Documents/deepbankV2` with the local `.env` file and `./restart-qbot-slim.sh`; do not use the old `dev:ui + remote dev backend` lane unless a test explicitly asks for it.
- The expected local source setup is:
  - `.env` in the deepbankV2 root, ignored by Git, with local control plane `DEEPBANK_SERVER=http://localhost:8900` and `DEEPBANK_AUTH_PROVIDER=lingxi`.
  - local Postgres available on `localhost:5433`.
  - `restart-qbot-slim.sh` in the deepbankV2 root, launched from a persistent shell/session so the background server and Electron processes remain alive.
  - Electron must expose CDP on `http://127.0.0.1:9224`; if the script does not provide it, add/run with `--remote-debugging-port=9224` for QA automation.
- Before running non-login cases, verify all of these are true:
  - `http://localhost:8900/api/health` returns `ready=true`, `env=dev`, and Lingxi `canLogin=true`;
  - Electron CDP at `http://127.0.0.1:9224/json/version` is reachable;
  - QBot main window, not just the browser auth page, shows the logged-in workbench with entries such as `新建任务`, `专家`, `技能`, `连接器`, `知识`, `成果`, and the current user.
- In E2E/slim mode, QBot may log `[qbot-e2e-open-external]` instead of opening the browser automatically. If the login button does not launch Safari, read the latest OAuth URL from the Electron log and open it in Safari for manual Lingxi authentication.
- OAuth success must be judged by the QBot main window entering the workbench. If the browser remains on the Lingxi `已登录账号/认证` page but QBot main window is logged in, treat the login precondition as satisfied.
- If login cannot be completed, stop before functional cases and mark login/precondition as `blocked`; do not continue into non-login cases and do not report those results as valid.

## Report Hub Publishing

- QbotTestAgent reports that need team sharing should be uploaded to Report Hub (`https://report-share.daikuan.qihoo.net`) after the local artifact is generated under `/Users/qifu/Documents/QbotTestAgent/outputs`.
- Use the report-hub Codex plugin documented at `https://gitlab.daikuan.qihoo.net/360jr-base-comm/ops-cc-marketplace/-/blob/main/README_REPORT_HUB.md`.
- If the plugin is not available, install or update it with:
  - `/plugin marketplace update ops-marketplace`
  - `/plugin install report-hub@ops-marketplace --scope user`
  - `/reload-plugins`
- Before uploading to a private or internal directory, run `/report-login` and confirm the target directory is visible. Unauthenticated uploads are only allowed to `tmp`, which is temporary and retained for 30 days.
- Upload supported report formats with `/report-upload <file-path> <directory-path-or-id>`. The file path comes first, and the Report Hub directory comes second. Directory paths may include nested subdirectories, which the plugin can create when permissions allow.
- Prefer stable project paths such as `QbotTestAgent/<report-type>/<YYYY-MM-DD>/` once the root directory has been created and permissioned by ops. Do not treat `tmp` URLs as durable QA evidence.
- After upload, capture the returned Report Hub URL in the run summary or final response so the report can be opened and shared later.
