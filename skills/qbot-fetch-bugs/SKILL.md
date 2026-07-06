---
name: qbot-fetch-bugs
description: Fetch all QBot/deepbankV2 GitLab Bug issues with latest statuses and export a timestamped Excel workbook. Use when the user says "获取所有bug", "获取所有 bug", "统计所有bug", "导出bug issue", "更新bug状态", "拉取最新缺陷", or asks for the current QBot/deepbankV2 bug list/status report.
---

# QBot Bug Fetcher

## Boundary

Treat `/Users/qifu/Documents/deepbankV2` as read-only. This skill only calls GitLab APIs and writes QA artifacts under the QbotTestAgent workspace. Do not modify deepbankV2 source, templates, docs, scripts, branches, commits, or merge requests.

## Output Contract

When the user asks to get all bugs, generate a new Excel file under the QbotTestAgent root `bug/` folder.

- Output folder: `<QbotTestAgent>/bug`
- File name format: `Qbot_Bug_Issues_YYYYMMDDHHMM.xlsx`
- Data source: `https://gitlab.daikuan.qihoo.net/songrongxin/deepbankv2`
- Bug issue scope: issues matching `kind/bug` label or issue title containing `bug`, `Bug`, or `【Bug】`
- Status must be freshly pulled from GitLab at execution time
- Bug links in Excel must be native hyperlinks
- Module classification must be based on actual product/function usage, not GitLab `area/*` labels

## Workflow

1. Run the bundled script from the QbotTestAgent workspace:

```bash
python3 <skill-dir>/scripts/fetch_gitlab_bugs.py
```

In this project, prefer RTK when available:

```bash
/Users/qifu/.local/bin/rtk proxy python3 skills/qbot-fetch-bugs/scripts/fetch_gitlab_bugs.py
```

2. Use the printed JSON summary to report:
   - output Excel path
   - total bug issue count
   - priority distribution
   - latest status distribution

3. If the script reports a missing GitLab token, tell the user to configure one of:
   - `GITLAB_TOKEN`
   - `QBOT_FEEDBACK_GITLAB_TOKEN`
   - `DEEPBANK_FEEDBACK_GITLAB_TOKEN`
   - `GITLAB_TOKEN_FILE`
   - `QBOT_FEEDBACK_GITLAB_TOKEN_FILE`
   - `DEEPBANK_FEEDBACK_GITLAB_TOKEN_FILE`
   - `~/.config/qbot/gitlab-token`

4. If the script reports a missing Python dependency, install `openpyxl`:

```bash
python3 -m pip install --user openpyxl
```

Then rerun the script.

## Script Behavior

The script creates these Excel sheets:

- `统计总览`: total count plus priority/status/module summaries
- `Bug明细`: one row per bug issue, including title, hyperlink, priority, actual product module, latest status, labels, assignees, timestamps, and classification basis
- `分类规则`: the priority, module, and status rules used for audit
- `数据源信息`: GitLab project, API parameters, token source, fetch time, and output path

Status rules:

- `已解决`: GitLab issue is closed, or status label indicates done/resolved/verified/closed
- `待验收`: status label indicates review/verification
- `处理中`: status label indicates in-progress/doing
- `待解决`: status label indicates ready/todo/open, or opened without a more specific status label

Priority rules:

- Prefer `priority/high`, `priority/medium`, and `priority/low` labels when present
- Otherwise infer from title and issue body:
  - `高`: release blocker, app crash, build/deploy failure, auth failure, core chat/agent unusable, data/security risk
  - `中`: important feature unavailable, interaction blocked, visible core entry failure, attachment/session/settings issue
  - `低`: visual style, copy, spacing, border, minor layout issues that do not block the core flow

Module rules:

- Do not use GitLab `area/*` labels for module ownership
- Classify by actual user-facing product area and issue content, such as login/auth, core chat, composer/attachments, experts, skills, connectors, knowledge, sessions/sidebar, projects/workspaces, settings, runtime/model execution, desktop client, Teams, automation/quality, deployment, or common UI layout

## Options

Useful script options:

```bash
python3 <skill-dir>/scripts/fetch_gitlab_bugs.py --output-dir /path/to/bug
python3 <skill-dir>/scripts/fetch_gitlab_bugs.py --project-path songrongxin/deepbankv2
python3 <skill-dir>/scripts/fetch_gitlab_bugs.py --base-url https://gitlab.daikuan.qihoo.net
python3 <skill-dir>/scripts/fetch_gitlab_bugs.py --write-json
```
