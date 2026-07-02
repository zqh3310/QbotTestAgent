# QbotTestAgent Project Memory

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
- After submitting a Bug issue through the API, verify the created issue title and labels from GitLab. If labels did not persist, report that clearly and list the labels the user should add manually.

## Release Package Automation

- QbotTestAgent owns package-level QA automation for delivered QBot macOS test packages.
- Use `npm run automation:package-doctor` before `npm run automation:package-run`.
- The normal package automation path is script + Electron CDP + screenshots/logs, not Codex Computer Use, so tester machines without Codex UI control can run it.
- Package automation outputs belong under `/Users/qifu/Documents/QbotTestAgent/outputs`.
- A run with missing package, Gatekeeper/quarantine blocker, existing QBot process, missing CDP, unavailable screenshot/click/type capability, or permission failure must report `blocked` or `failed` with a concrete reason.
