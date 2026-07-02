# Qbot Test Agent Team Architecture

## Scope

This agent team is built for Deepbank v2 / QBot test work. It is not an implementation team for product features. Its first responsibility is to turn GitLab issues, repository contracts, and meeting requirements into:

- systematic functional test cases grouped by product module;
- Excel-ready test case tables;
- Codex-executable Windows and macOS operation test flows;
- runtime/protocol/skill-chain regression coverage for Codex CLI + GLM5.2 style model routing;
- bug-vs-optimization conclusions with evidence;
- issue drafts or issue-creation handoffs when gaps are confirmed.
- macOS QBot release package doctor/run automation with CDP screenshots, logs, and explicit blocked reasons.

## Source Context

Primary repository:

- `D:\deepbankV2`
- Git remote: `https://gitlab.daikuan.qihoo.net/songrongxin/deepbankv2.git`

Current local facts used to design this team:

- Deepbank v2 / QBot is an Electron + React workbench backed by a Node HTTP/WS control plane.
- Runtime families are `claude-code` and `codex`; provider/model connection config is separate and resolved through a redacted connection view.
- Personal assistant turns run locally; project turns can route through a bound ADK runtime server.
- Product surfaces include assistant chat, experts, skills, connectors/MCP, projects, GitLab-backed project workbench, automation, release lanes, 360Teams embedding, and runtime-family/provider selection.
- Existing test entrypoints include `npm run check`, `npm run build:ui`, `npm run e2e:local`, `npm run e2e:qbot:codex:real`, `npm run e2e:qbot:claude-code:real`, `npm run codex:smoke`, runtime feature matrix commands, and release/e2e lanes.
- QbotTestAgent package automation entrypoints include `npm run automation:package-doctor` and `npm run automation:package-run`, which launch macOS QBot release packages, connect Electron CDP, inspect visible controls, capture screenshots, and write package automation reports.
- GitLab issue exports are present locally under `D:\deepbankV2\issues` and root issue JSON files.

The remote GitLab web page was not reachable from the current web channel during creation; the local clone, origin URL, repository docs, and exported issue JSON were used as the source of truth for this first architecture pass.

## Team Topology

```mermaid
flowchart TD
  U["User / Tester Request"] --> M["qbot-test-chief"]
  M --> G["gitlab-issue-monitor"]
  M --> I["issue-intelligence-analyst"]
  M --> T["test-plan-maintainer"]
  M --> F["functional-test-case-designer"]
  M --> A["codex-os-automation-planner"]
  M --> V["test-case-reviewer"]
  M --> R["runtime-protocol-skill-chain-tester"]
  M --> X["cross-platform-e2e-validator"]
  M --> L["release-package-mac-automation-tester"]
  M --> P["ui-product-experience-tester"]
  M --> C["compliance-security-tester"]
  M --> D["test-data-fixture-planner"]
  M --> B["defect-triage-issue-reporter"]
  M --> E["evidence-quality-auditor"]
  G --> M
  I --> M
  T --> M
  F --> M
  A --> M
  V --> M
  R --> M
  X --> M
  L --> M
  P --> M
  C --> M
  D --> M
  B --> M
  E --> M
  M --> O["Final round result to user"]
```

## Agent Roster

| Agent | Type | Responsibility |
|---|---|---|
| `qbot-test-chief` | main | Owns orchestration, task routing, result synthesis, next-action planning, and the final user-facing result. |
| `gitlab-issue-monitor` | subagent | Monitors GitLab issue additions/changes, detects project scope drift, and recommends whether test plans need updates. |
| `issue-intelligence-analyst` | subagent | Reads GitLab issues and repository facts, filters product/function requirements from development-process issues, normalizes issue scope, modules, risk, and traceability. |
| `test-plan-maintainer` | subagent | Maintains existing test assets as issues change: add/edit/split/merge/deprecate cases, preserve stable IDs, update layers, and keep delta logs. |
| `functional-test-case-designer` | subagent | Designs complete functional test cases by module and prepares Excel-ready rows. |
| `codex-os-automation-planner` | subagent | Converts test intent into Codex-executable Windows/macOS operation procedures. |
| `test-case-reviewer` | subagent | Strictly reviews functional and Codex automation test cases for granularity, executable steps, expected results, traceability, coverage gaps, priority discipline, and evidence requirements. |
| `runtime-protocol-skill-chain-tester` | subagent | Tests Codex CLI, GLM5.2/protocol-conversion assumptions, long tasks, skill invocation, and multi-skill chains. |
| `cross-platform-e2e-validator` | subagent | Owns OS, packaging, local/release/dev e2e command selection and platform-specific executable flows. |
| `release-package-mac-automation-tester` | subagent | Owns macOS QBot release package doctor/run automation through QbotTestAgent scripts, including dmg/app discovery, quarantine cleanup, launch, Electron CDP inspection, screenshots, logs, and blocked reason reporting. |
| `ui-product-experience-tester` | subagent | Owns QBot UI/chat usability, visual/product behavior, accessibility, Teams/standalone shell experience. |
| `compliance-security-tester` | subagent | Owns M1-M4 compliance, secret redaction, auth/token boundaries, and data-leak negative cases. |
| `test-data-fixture-planner` | subagent | Owns fixtures, accounts, repo/test data readiness, skip/blocker semantics, and reproducibility. |
| `defect-triage-issue-reporter` | subagent | Decides bug vs optimization vs external dependency and drafts issue handoffs with evidence. |
| `evidence-quality-auditor` | subagent | Audits all outputs for false success, missing proof, redaction, traceability, and acceptance quality. |

## Orchestration Rules

1. The main agent reads source context, creates work packets, and assigns only the needed subagents.
2. The GitLab monitor may run before issue analysis when the question is about new issue drift, new features, or whether the test plan must change.
3. `issue-intelligence-analyst` must classify issues before downstream test design. Only selected product/function issues with `handoff_to_test_design=yes` can generate functional cases or Codex flows.
4. Subagents return structured results to the main agent; they do not issue final user conclusions directly.
5. The main agent resolves conflicts by checking source facts first, then asks for clarification only when acceptance would change.
6. Every generated test case must trace back to at least one source: selected product/function issue, repository contract, meeting requirement, or observed behavior.
7. Missing live credentials, unavailable GitLab, blocked external dependencies, or skipped real-provider runs must be marked as blocked/skipped, not passed.
8. No agent may fabricate TestMind, GitLab, runtime, DB, UI, provider, MCP, model, log, or issue evidence.
9. Every material issue delta must pass through `test-plan-maintainer` before a workbook or automation package is delivered, unless the final report explicitly states why maintenance was skipped.
10. Any user-facing test case workbook, automation plan, or case redesign must pass `test-case-reviewer` before `evidence-quality-auditor`; if skipped, the final result must state the skip explicitly.
11. Mac release package automation must use `automation:package-doctor` / `automation:package-run` as the normal path, not Codex Computer Use, so the same checks can run on tester machines without Codex UI control.
12. Remote GitLab writes, issue creation, commits, pushes, or destructive environment changes require explicit user authorization.

## Dynamic Issue Loop

The team must assume QBot issue scope changes continuously. A normal dynamic update round is:

1. `gitlab-issue-monitor` compares live GitLab or the latest approved snapshot against the saved baseline.
2. `issue-intelligence-analyst` filters material deltas into selected product/function issues and excluded development-process issues, preserving full selected issue bodies for the main agent.
3. `qbot-test-chief` uses the selected issue handoff to assign downstream work; excluded issues do not generate cases or flows.
4. `test-plan-maintainer` decides add/edit/split/merge/deprecate/no-change for existing test assets, preserving IDs and traceability.
5. `functional-test-case-designer` drafts only the new or changed functional rows.
6. `codex-os-automation-planner` drafts only the new or changed automation flows and updates setup/cleanup/evidence contracts.
7. Specialist agents fill domain gaps for runtime, UI/UX, compliance, platform, fixture, or triage needs.
8. `release-package-mac-automation-tester` runs package doctor/run when a macOS dmg/app build is under test, then returns report paths and blocked/pass/fail evidence.
9. `test-case-reviewer` blocks vague, unexecutable, over-broad, misprioritized, or non-black-box ordinary-user cases.
10. `evidence-quality-auditor` verifies freshness, redaction, traceability, blocked/skipped semantics, and false-success risk.

Dynamic updates must never replace the whole workbook silently. They must include a delta summary and changed-case list.

## Standard Round Flow

1. Intake: main agent identifies objective, source scope, required artifacts, and success criteria.
2. Issue monitoring: GitLab monitor detects new/changed issues and reports whether test scope changed.
3. Issue scope: issue analyst filters product/function issues from development-process issues and returns selected issue bodies to the main agent.
4. Maintenance plan: test plan maintainer decides how existing cases and flows change.
5. Test design: functional designer produces Excel-ready new or changed cases and traceability.
6. Automation design: automation planner converts eligible cases into Windows/macOS Codex operation flows.
7. Test case review: test case reviewer challenges granularity, executable paths, expected results, coverage, priorities, and automation evidence requirements.
8. Release package validation: release package mac automation tester runs package doctor/run when the scope includes a macOS dmg/app build.
9. Specialist reviews: runtime, UI, compliance, cross-platform, and data agents fill domain gaps.
10. Triage: defect reporter classifies confirmed gaps and drafts issues when needed.
11. Audit: evidence auditor checks proof, redaction, traceability, and blocked/skipped semantics.
12. Synthesis: main agent returns the final round result and the next recommended action.

## File Layout

```text
D:\QbotTestAgent
|-- TEAM_ARCHITECTURE.md
|-- references
|   |-- deepbank-project-context.md
|   `-- output-contracts.md
`-- agents
    |-- qbot-test-chief
    |   `-- SKILL.md
    |-- gitlab-issue-monitor
    |   `-- SKILL.md
    |-- issue-intelligence-analyst
    |   `-- SKILL.md
    |-- test-plan-maintainer
    |   `-- SKILL.md
    |-- functional-test-case-designer
    |   `-- SKILL.md
    |-- codex-os-automation-planner
    |   `-- SKILL.md
    |-- test-case-reviewer
    |   `-- SKILL.md
    |-- runtime-protocol-skill-chain-tester
    |   `-- SKILL.md
    |-- cross-platform-e2e-validator
    |   `-- SKILL.md
    |-- release-package-mac-automation-tester
    |   `-- SKILL.md
    |-- ui-product-experience-tester
    |   `-- SKILL.md
    |-- compliance-security-tester
    |   `-- SKILL.md
    |-- test-data-fixture-planner
    |   `-- SKILL.md
    |-- defect-triage-issue-reporter
    |   `-- SKILL.md
    `-- evidence-quality-auditor
        `-- SKILL.md
```
