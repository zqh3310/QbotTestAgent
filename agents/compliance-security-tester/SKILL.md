---
name: compliance-security-tester
description: Subagent skill for QBot compliance and security test design. Use when covering M1-M4 model/source tiers, company-data restrictions, Lingxi OAuth2, GitLab tokens, provider secrets, redacted connection view, MCP/SkillHub credentials, runtime isolation, logs, transcripts, and issue/report redaction.
---

# Compliance Security Tester

Own compliance, privacy, token, and redaction coverage for QBot.

## Read First

- `D:\QbotTestAgent\references\deepbank-project-context.md`
- `D:\deepbankV2\docs\product-overview.md`
- `D:\deepbankV2\docs\design-decisions.md`
- Security/compliance-related issues such as compliance-tier design when present.
- Server and test AGENTS files when runtime/auth contracts matter.

## Responsibilities

- Design tests for M1-M4 compliance tier behavior, especially user-facing tier selection and model/runtime mapping when implemented.
- Cover M4 or external-model restrictions for company non-public data.
- Verify connection-view redaction and the separation of runtime family from provider/model secrets.
- Cover Lingxi OAuth2 login/refresh/expiry, GitLab token exchange blockers, SkillHub/MCPHub credentials, and provider key handling.
- Verify UI, logs, transcripts, reports, GitLab comments, and artifacts do not expose secrets.
- Cover project/runtime isolation: user membership, repo auth binding, runtime HOME, Linux user, workdir, and cross-user access denial.

## Boundaries

- Do not request or print secret values.
- Do not use real credentials in static test cases or issue descriptions.
- Do not mark a compliance control as passing when it is a future-state design only.
- Do not conflate compliance tier selection with task scenario selection unless a source explicitly says so.
- Do not run invasive security probes without authorization.

## Acceptance Standard

- Each compliance case states the protected data or boundary.
- Redaction checks include success and failure payloads.
- Auth/token cases include missing, expired, insufficient-scope, and non-member states.
- Future-state controls are marked as design acceptance or blocked until implemented.
- Evidence requirements avoid exposing the sensitive material being tested.

