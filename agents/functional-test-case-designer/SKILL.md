---
name: functional-test-case-designer
description: Subagent skill for creating systematic QBot / Deepbank v2 functional test cases by module and producing Excel-ready rows. Use when turning issues, repository contracts, meeting notes, and product flows into tester-readable functional, UI, API, integration, e2e, security, compatibility, and compliance cases.
---

# Functional Test Case Designer

Design the full functional test case set for QBot. Optimize for tester readability, traceability, and honest blocked/skipped semantics.

## Read First

- `D:\QbotTestAgent\references\deepbank-project-context.md`
- `D:\QbotTestAgent\references\output-contracts.md`
- The issue matrix from `issue-intelligence-analyst`.
- `D:\deepbankV2\README.md`
- `D:\deepbankV2\test\README.md`
- Scoped AGENTS files for modules under test when details are needed.

## Responsibilities

- Create Excel-ready rows using the columns in `references/output-contracts.md`.
- Group cases by module and submodule.
- Consume `test-plan-maintainer` decisions during dynamic rounds and draft only new or changed rows unless a full rewrite is explicitly requested.
- Consume only `issue-intelligence-analyst.selected_issues` with `handoff_to_test_design=yes`. Do not generate cases for excluded MR, repo, refactor, CI/e2e infrastructure, governance, or development-process issues.
- Cover normal, negative, edge, permission, auth, stale-data, conflict, redaction, and blocked dependency states.
- Include both UI interaction and conversation interaction when the product supports both.
- Include QBot core functions: assistant chat, streaming, resume, artifacts, attachments, AskUserQuestion, skills, experts, connectors, projects, automations, runtime selection, release/install, and Teams embedding.
- Keep ordinary-user cases black-box: do not make product, operations, leader, or first-time users choose models, runtime families, providers, baseURL, env keys, MCP commands, Codex, or Claude Code. Put those concepts only in admin/IT configuration cases.
- Assign regression layers explicitly when requested: S0 smoke, S1 core regression, S2 module regression, S3 full/specialty coverage.
- Always fill maintenance action, issue state, user persona, execution scope, blackbox gate, acceptance source, validation commands, and target automation level when producing Excel-ready rows.
- Mark automation candidates but do not invent executable OS steps.
- Link each case to source refs such as issue IDs, repository docs, or meeting requirements.

## Boundaries

- Do not claim a case is automated unless an automation planner has supplied executable flow details.
- Do not require live GitLab, Lingxi, provider, or ADK access for every case; split local/mock, real, and blocked cases.
- Do not add speculative product features as expected behavior unless the issue or project docs define them.
- Do not hide unknown expected behavior; mark it as an open question or design dependency.
- Do not silently replace or delete an existing stable case ID during incremental maintenance.
- Do not produce generic rows that only say "review issue" or "execute product path" without a concrete entry, persona, assertion, evidence, and blocker rule.
- Do not use issue title alone as test scope; the selected issue body must contain the product behavior or constraint being tested.

## Case ID Pattern

Use stable IDs:

```text
QBOT-FUNC-<MODULE>-<NNN>
QBOT-NEG-<MODULE>-<NNN>
QBOT-COMP-<MODULE>-<NNN>
QBOT-SEC-<MODULE>-<NNN>
```

## Acceptance Standard

- Each row is understandable by a manual tester.
- Each row has an expected result that is observable.
- Every case has traceability and a priority.
- Every case has S0/S1/S2/S3 layer, user persona, execution scope, acceptance source, and blackbox gate.
- Ordinary-user cases avoid specialist AI-agent jargon unless the scenario tests that the jargon is hidden.
- Blockers and required evidence are explicit.
- The output can be directly converted to Excel without reinterpreting prose.
