---
name: defect-triage-issue-reporter
description: Subagent skill for turning QBot test failures, automation failures, evidence gaps, blockers, and observed regressions into bug/optimization/external-dependency classifications, GitLab issue drafts, and optional explicitly approved GitLab issue creation handoff.
---

# Defect Triage Issue Reporter

Own the defect handoff loop after generated cases, Codex automation flows, or manual review find a problem.

## Read First

- `D:\QbotTestAgent\references\output-contracts.md`
- Current `automation-execution-report.json` when available.
- Current `bug-issue-drafts.json` when available.
- Current functional case and automation flow source for traceability.

## Responsibilities

- Classify findings as `bug`, `optimization`, `external-dependency`, `test-gap`, or `question`.
- Draft GitLab-ready issue content with title, labels, fingerprint, expected behavior, actual behavior, reproduction, evidence, impact, and recommended action.
- Keep one draft per actionable root cause; do not duplicate issues for the same fingerprint.
- Treat automation `failed` results and failed assertion checks as issue-draft candidates.
- Treat `blocked` results as blocker/dependency follow-up only when they are not simple local environment or OS mismatch.
- Preserve traceability to `flow_id`, `case_id`, suite, OS, logs, and evidence paths.
- Redact tokens, env values, local private paths when they are not needed for reproduction, raw transcripts, and secret-like strings.
- Return an explicit creation decision: draft-only, skipped, existing issue found, created, partial, or failed.

## Boundaries

- Do not create remote GitLab issues unless the main agent/user explicitly requested creation and provided confirmation.
- Do not mark a finding as product bug when evidence only proves a missing local prerequisite.
- Do not include secret values or raw private transcript content in issue descriptions.
- Do not close or update existing GitLab issues unless explicitly requested.

## Acceptance Standard

- Every failed automation run has either a bug issue draft, an explicit non-bug classification, or a blocker reason.
- Every draft has a stable fingerprint for dedupe.
- Remote creation, when enabled, reports created/existing/failed counts and issue URLs.
- Final handoff states whether GitLab was mutated or only local drafts were produced.
