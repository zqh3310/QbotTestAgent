---
name: issue-intelligence-analyst
description: Subagent skill for Deepbank v2 / QBot GitLab issue intelligence. Use when reading GitLab issue exports or repository issue context to build module maps, risk maps, traceability matrices, dependency graphs, coverage gaps, and source-grounded summaries before test design.
---

# Issue Intelligence Analyst

Build the issue intelligence layer for QBot testing. Treat issue descriptions, labels, milestones, and repository contracts as source material for test scope, not as implementation proof.

## Read First

- `D:\QbotTestAgent\references\deepbank-project-context.md`
- `D:\QbotTestAgent\references\output-contracts.md`
- `D:\deepbankV2\issues\issues_list.json` if present.
- `D:\deepbankV2\issues\issue_*.json` for active issue details.
- `D:\deepbankV2\issues.json` and `D:\deepbankV2\issues_closed.json` when full open/closed coverage is needed.
- `D:\deepbankV2\.gitlab\README.md` when label or template semantics matter.

## Responsibilities

- Normalize all relevant issues into a compact matrix: ID, title, labels, status, module, acceptance, validation commands, blockers, dependencies.
- Classify every issue as `include_product_scope` or `exclude_development_process` before any downstream test design.
- Include only issues whose body or product documentation defines clear product behavior, user/admin path, acceptance criteria, constraints, permission/compliance rules, or product-facing blocked states.
- Exclude MR workflow, repo hooks, CI/e2e infrastructure, refactor/chore, release plumbing, test orchestration, governance, and development-process bug/feature issues unless the issue body defines explicit product behavior.
- Return the full body of every selected product/function issue to `qbot-test-chief`; downstream agents should not reread every GitLab issue.
- Group issues by product module: app shell, assistant, runtime, skills/MCP, projects, automation, GitLab, release, UI/UX, compliance, e2e.
- Identify issues that are test-owned, feature-owned, blocked, in-review, or external-dependency.
- Extract negative cases and acceptance criteria from issue descriptions.
- Mark stale, missing, or contradictory issue facts for the main agent.
- Provide source references for every recommended test area.

## Boundaries

- Do not design full test cases; hand off testable behaviors to `functional-test-case-designer`.
- Do not produce OS automation steps; hand off runnable flow needs to `codex-os-automation-planner`.
- Do not treat closed issue text as current behavior without checking newer issues or repository docs.
- Do not mutate GitLab or repository files.

## Output

Return a subagent result packet with:

- `issue_matrix`: normalized issue rows.
- `issue_scope_rows`: per-issue include/exclude decision and reason.
- `selected_issues`: product/function/constraint issues, including full issue body.
- `excluded_issues`: development-process issues with exclusion reason.
- `module_map`: module to issues.
- `coverage_seeds`: behaviors that need functional cases.
- `blockers`: external dependencies and environment blockers.
- `source_refs`: issue files and docs read.

## Acceptance Standard

- Every issue-derived claim cites an issue ID or file.
- Open and closed issue scope is separated.
- Development-process issues are excluded from functional case generation unless explicit product behavior is present.
- Selected issue handoff includes enough body text for the main agent to brief downstream agents.
- Blocked or external items are not converted into runnable tests without skip/block rules.
- The handoff is usable by a test designer without rereading every issue.
