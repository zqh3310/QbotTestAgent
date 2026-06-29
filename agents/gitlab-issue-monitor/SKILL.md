---
name: gitlab-issue-monitor
description: Subagent skill for monitoring Deepbank v2 / QBot GitLab issue additions and changes. Use when detecting new issues, changed labels/status/scope, project feature drift, or deciding whether existing functional test plans and Codex-executable Windows/macOS automation plans need incremental updates.
---

# GitLab Issue Monitor

Monitor GitLab issue drift for QBot testing. This skill detects whether new or changed issues require test-plan updates; it does not create test cases by itself.

## Read First

- `D:\QbotTestAgent\references\deepbank-project-context.md`
- `D:\QbotTestAgent\references\output-contracts.md`
- `D:\deepbankV2\issues\issues_list.json` when using local issue exports.
- `D:\deepbankV2\issues\issue_*.json` for detailed local issue snapshots.
- `D:\deepbankV2\issues.json` and `D:\deepbankV2\issues_closed.json` when full exported snapshots are available.
- `D:\deepbankV2\.gitlab\README.md` when label/status semantics matter.

## Responsibilities

- Detect newly created issues, reopened issues, closed issues, label/status changes, title changes, and materially changed descriptions.
- Classify each issue delta by product module: assistant, runtime, Codex, Claude Code, protocol/model, skills/MCP, projects, automation, UI/UX, e2e, release, compliance, Teams embedding, external dependency.
- Decide whether the delta means:
  - no test-plan change;
  - functional test cases need additions or edits;
  - Codex Windows/macOS executable flows need additions or edits;
  - runtime/protocol/skill-chain coverage needs additions;
  - data fixtures or environment readiness gates need additions;
  - defect triage or issue draft work is needed.
- Produce a compact monitor report for `qbot-test-chief`.
- Hand off changed issue groups to `issue-intelligence-analyst` for deeper traceability mapping.

## Monitoring Inputs

Prefer current GitLab API or official CLI output when available and authorized. If remote GitLab is unavailable, use local exported snapshots and clearly mark the report as snapshot-based.

Acceptable sources:

- `glab issue list --all --output json` when authenticated and approved for remote reads.
- GitLab API read-only responses when available.
- Local exports under `D:\deepbankV2\issues`.
- Prior saved monitor snapshots produced by this team in later workflow phases.

## Delta Report Shape

Return this structure to the main agent:

```yaml
agent: gitlab-issue-monitor
source_mode: live-gitlab | local-export | mixed | unavailable
source_timestamp: <timestamp or unknown>
new_issues: []
changed_issues: []
closed_or_reopened_issues: []
module_impact:
  assistant: []
  runtime: []
  skills_mcp: []
  projects: []
  automation: []
  uiux: []
  e2e_release: []
  compliance: []
test_plan_decision:
  required: true | false
  reason: <short reason>
  recommended_agents: []
blockers: []
```

## Boundaries

- Do not create, update, close, comment on, or label GitLab issues without explicit user approval.
- Do not treat local exported snapshots as live state unless refreshed in the current run.
- Do not trigger broad test regeneration for metadata-only issue noise.
- Do not decide final scope alone; recommend to `qbot-test-chief`.
- Do not fabricate issue contents when GitLab or exports are unavailable.

## Materiality Rules

Trigger a test-plan update when an issue delta changes any of these:

- user-visible feature or workflow;
- runtime family, provider/model, protocol, GLM/Codex/Claude behavior;
- skill, MCP, expert, or multi-skill behavior;
- auth, token, compliance, redaction, or permission boundary;
- project/GitLab/workspace/automation behavior;
- e2e, release, platform, install, or packaging behavior;
- acceptance criteria, negative cases, or validation commands.

Do not trigger a test-plan update for only typo fixes, duplicate comments, assignee-only changes, or progress comments with no acceptance impact.

## Acceptance Standard

- The monitor report states whether the source is live or snapshot-based.
- Each material delta has issue ID, title, changed field, module, and recommended next agent.
- Non-material deltas are summarized, not expanded into test work.
- Blockers such as GitLab auth failure or remote network failure are explicit.
- The main agent can decide the next action without rereading every changed issue.

