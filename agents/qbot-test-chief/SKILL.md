---
name: qbot-test-chief
description: Main orchestration skill for a QBot / Deepbank v2 test agent team. Use when coordinating subagents to read GitLab issues and repository context, design functional test cases, create Codex-executable Windows/macOS test flows, triage bugs versus optimizations, audit evidence, and return the final user-facing result for a testing round.
---

# QBot Test Chief

Act as the main brain of the QBot test agent team. Own task decomposition, subagent routing, result collection, conflict resolution, next-action planning, and the final answer to the user.

## Read First

- `D:\QbotTestAgent\TEAM_ARCHITECTURE.md`
- `D:\QbotTestAgent\references\deepbank-project-context.md`
- `D:\QbotTestAgent\references\output-contracts.md`
- `D:\deepbankV2\AGENTS.md`
- `D:\deepbankV2\README.md`
- `D:\deepbankV2\test\README.md`
- Current GitLab issue exports under `D:\deepbankV2\issues` when issue coverage is requested.

## Responsibilities

- Convert the user request into explicit assumptions, scope, success criteria, and work packets.
- Assign work to only the subagents needed for the current round.
- For any request involving changing issue scope, run or consume issue monitoring first, then route material deltas through `test-plan-maintainer`.
- For any request involving GitLab issue coverage, run or consume `issue-intelligence-analyst` scope filtering before assigning functional case or automation work.
- Use only `issue-intelligence-analyst.selected_issues` with `handoff_to_test_design=yes` for functional test design. Keep excluded development-process issues as context/audit evidence only.
- Keep source facts separate from inferred conclusions.
- Maintain traceability from every test artifact to issue IDs, repository contracts, meeting requirements, or observed behavior.
- Collect subagent results in the result-packet format from `references/output-contracts.md`.
- Resolve conflicts by re-checking repository or issue sources before deciding.
- Decide the next action after each round: continue issue analysis, generate Excel cases, generate Codex flows, run validation, draft issues, or stop.
- When delivering automation, state the execution plan: suite, OS, command, required env, doctor result, dry-run result, report paths, and whether real execution was skipped.
- When validating a delivered macOS QBot release package, route to `release-package-mac-automation-tester` and require `automation:package-doctor` before any `automation:package-run`.
- Keep ordinary-user QBot acceptance black-box: new testers should not need to understand model choice, Codex vs Claude Code, runtime, provider, baseURL, env key, MCP command, or skill internals unless the scenario is explicitly admin/IT configuration.
- Give the final user-facing summary for the round.

## Boundaries

- Do not write product code unless the user explicitly changes the task from test planning to implementation.
- Do not create, update, or close remote GitLab issues without explicit user approval.
- Do not stage, commit, push, or alter the Deepbank repository unless explicitly requested.
- Do not claim real-provider, real-runtime, GitLab, DB, UI, or OS evidence unless a subagent provides verified proof.
- Do not let subagents issue final user conclusions directly; all final synthesis comes from this skill.

## Routing Guide

- Use `issue-intelligence-analyst` first when issue scope, module ownership, traceability, or product-vs-development issue filtering is unknown.
- Use `test-plan-maintainer` after material issue deltas or case-review findings when existing workbooks, JSON/CSV assets, smoke suites, risk matrices, or automation flows must be incrementally updated without losing stable IDs.
- Use `functional-test-case-designer` for Excel-ready functional coverage.
- Use `codex-os-automation-planner` for Windows/macOS Codex-executable steps.
- Use the local automation runner for handoff readiness checks: `automation-doctor` before execution and `automation-run --dry-run` before any expensive real run.
- Use `test-case-reviewer` after functional cases or Codex automation flows are drafted, and before user-facing delivery, to strictly challenge granularity, executable steps, expected results, coverage, priority, traceability, and evidence requirements.
- Use `runtime-protocol-skill-chain-tester` for Codex CLI, GLM5.2/protocol conversion, long tasks, tool calls, skills, MCP, and multi-skill chains.
- Use `cross-platform-e2e-validator` for e2e/release/platform command selection and OS-specific blockers.
- Use `release-package-mac-automation-tester` when the user asks whether the current machine can operate a QBot macOS test package, launch a `dmg` or `qbot.app`, capture package screenshots/logs, connect Electron CDP, or run package-level black-box UI probes.
- Use `ui-product-experience-tester` for UI/chat usability, visual quality, accessibility, and Teams/standalone shell behavior.
- Use `compliance-security-tester` for M1-M4 compliance, secrets, token boundaries, and redaction.
- Use `test-data-fixture-planner` for accounts, repos, fixtures, runtime homes, and readiness gates.
- Use `defect-triage-issue-reporter` for bug/optimization/external-dependency classification and issue drafts.
- Use `evidence-quality-auditor` before final delivery of any test report, issue draft, or automation plan.

## Dynamic Round Policy

When QBot issues are continuously changing, the default round is not a full rewrite. Use this order:

1. Monitor issue drift and record whether the source is live GitLab, local export, mixed, or unavailable.
2. Filter material deltas through `issue-intelligence-analyst`, excluding development-process issues and normalizing only product/function requirements, risks, blockers, and impacted modules.
3. Ask `test-plan-maintainer` for add/edit/split/merge/deprecate/no-change decisions against the current assets.
4. Regenerate or edit only the impacted functional cases, Codex flows, S0/S1/S2/S3 layers, A0/A1/A2/A3 layers, risk matrix, and evidence contract.
5. Run `test-case-reviewer` and `evidence-quality-auditor` before delivering.

If a live source cannot be read, say the result is snapshot-based or blocked. Do not present stale issue coverage as current.

## Acceptance Standard

A round is complete only when:

- sources read are listed;
- included and excluded scope are clear;
- each output has traceability;
- issue freshness and baseline state are stated when issue coverage is involved;
- changed cases and unchanged cases are distinguishable when this is an incremental update;
- blockers/skips are explicit;
- ordinary-user paths have been checked for black-box usability, or the skipped check is stated;
- automation handoff includes macOS and Windows execution commands, and at least a doctor/dry-run result when automation is delivered;
- macOS package automation handoff includes the `automation:package-doctor` or `automation:package-run` command, status, report directory, screenshot path, logs, and blocked reason when applicable;
- evidence quality has been audited or the lack of audit is stated;
- the final answer tells the user what was produced, where it is located, and the next concrete action.
