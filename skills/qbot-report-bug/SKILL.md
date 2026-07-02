---
name: qbot-report-bug
description: Create QBot/deepbankV2 GitLab bug issues from natural-language reports after first reading the repository .gitlab issue templates and label rules. Use when the user says "提bug", "提交bug", "报bug", "提缺陷", "创建bug issue", "按模板提issue", or asks Codex to file a QBot/deepbankV2 defect to GitLab using the repository Bug.md issue template and labels.
---

# QBot Bug Reporter

## Boundary

Treat the local `deepbankV2` repository as read-only. Do not edit source, templates, docs, tests, scripts, branches, commits, or MRs in that repository. This skill only reads the template/source if needed, prepares a Bug issue, uploads evidence images, and optionally submits it to GitLab.

## Mandatory Repository Governance Read

This is a hard rule from GitLab issue `#213`:
`https://gitlab.daikuan.qihoo.net/songrongxin/deepbankv2/-/issues/213`.
When the agent files issues, it must first read the repository `.gitlab/` templates and labels so the issue is standardized. Treat this as mandatory, not advisory.

Before drafting or submitting every Bug issue, read the current `deepbankV2` GitLab governance files from the repository, even if this skill has a bundled reference:

- `<deepbankV2>/.gitlab/issue_templates/Bug.md`
- `<deepbankV2>/.gitlab/README.md`
- `<deepbankV2>/.gitlab/scripts/gitlab_labels.sh`

Use the repository files as the source of truth for template sections, template routing, title/description expectations, and label names. Do not rely only on memory or this skill's reference. If the files are missing or label rules cannot be read, stop and report the blocker instead of submitting a loosely formatted issue.

## Workflow

1. Read the current repository Bug template and label rules listed above.
2. Parse the user's natural-language bug report into the Bug template fields.
3. Normalize the title:
   - prefix with `【Bug】` unless the title already starts with `【Bug】`, `[Bug]`, `[BUG]`, or an equivalent bug marker
   - keep any second category such as `【交互问题】` after `【Bug】`
4. If required details are missing, ask concise follow-up questions before submitting. Required details:
   - title or short summary
   - affected product area or visible entry
   - reproduction steps
   - actual result
   - expected result
   - evidence status: screenshot/log/report path, or "no evidence yet"
   - when the user provides a local screenshot/image path, preserve it in `attachments`, `screenshots`, `image_paths`, or `evidence_files` so the submit script uploads it to GitLab and embeds the returned Markdown in `### Evidence`
5. Classify labels only from the labels currently defined under `.gitlab`:
   - always include `kind/bug` and usually `status/ready`
   - add one or more area labels when clear: `area/ui`, `area/assistant-ui`, `area/electron`, `area/preload`, `area/server`, `area/db`, `area/runtime`, `area/skills`, `area/projects`, `area/e2e`, `area/docs`, `area/repo`
   - add `priority/high` only for blocker, data loss, unusable core flow, release blocker, or high-impact user-facing regression
6. Use `references/bug-template.md` only as a fallback orientation after reading the repository files.
7. Build an issue JSON payload and run `scripts/submit_gitlab_bug.py`. For screenshots, prefer:
   - `screenshots`: list of local image paths
   - `attachments`: list of `{ "path": "/absolute/file.png", "alt": "short description" }`
   The script also detects local image paths in `evidence`, `screenshot_report_path`, and `visual_finding.screenshot_report_path`.
8. If a GitLab token is unavailable, do not claim the issue was submitted. Return the generated Markdown draft and the exact command the user can run after setting a token.

## Submission Rules

Default GitLab target:

- base URL: `https://gitlab.daikuan.qihoo.net`
- project: `2166` (`songrongxin/deepbankv2`)
- template: `.gitlab/issue_templates/Bug.md`
- default local repo: `~/Documents/deepbankV2` on macOS/Linux or `%USERPROFILE%\Documents\deepbankV2` on Windows; pass `--repo` if different

Accepted token sources, in order:

- `GITLAB_TOKEN`
- `QBOT_FEEDBACK_GITLAB_TOKEN`
- `DEEPBANK_FEEDBACK_GITLAB_TOKEN`
- `QBOT_FEEDBACK_GITLAB_TOKEN_FILE`
- `DEEPBANK_FEEDBACK_GITLAB_TOKEN_FILE`
- `~/.config/qbot/gitlab-token` on macOS/Linux or `%USERPROFILE%\.config\qbot\gitlab-token` on Windows

When local screenshots/images are present, the script uploads them with the GitLab project uploads API before creating the issue. If upload fails, the script blocks submission by default with `attachment_upload_failed`; do not report the issue as filed until the upload and issue creation both succeed. Use `--no-upload-attachments` only when the user explicitly wants path-only evidence.

Before live submission, summarize the issue title, labels, and key repro path. Submit only when the user has clearly asked to file the issue and the required details are present. For ambiguous reports, produce a draft first.

## Script Usage

Create a temporary JSON payload, then run:

```bash
python3 <skill-dir>/scripts/submit_gitlab_bug.py --input /path/to/bug.json
```

To generate the final Markdown without submitting:

```bash
python3 <skill-dir>/scripts/submit_gitlab_bug.py --input /path/to/bug.json --print-only
```

The script reads `.gitlab/issue_templates/Bug.md`, `.gitlab/README.md`, and `.gitlab/scripts/gitlab_labels.sh` from `~/Documents/deepbankV2` by default. On Windows this resolves under `%USERPROFILE%\Documents\deepbankV2`. It prints JSON containing `status`, `title`, `labels`, `description`, `governance`, and, after successful submission, `issue_iid` and `issue_url`.
