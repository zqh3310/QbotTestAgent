# Deepbank / QBot Project Context

Use this reference only when a task needs project-specific grounding. Prefer current repository files over this summary when there is a conflict.

## Product Summary

QBot / Deepbank v2 is an embedded agent workbench:

- Electron desktop shell and React/Vite renderer.
- Node control plane exposed through HTTP/WS and `window.agent.*`.
- Shell-only Electron affordances under `window.agent.shell`.
- Runtime families: `claude-code` and `codex`.
- Provider/model/API-key selection is not the same as runtime family selection.
- Connection configuration is resolved through a server-owned redacted connection view.
- Standalone Electron and future 360Teams embedding share the same Lingxi OAuth2 session contract.
- Personal assistant context is local and uses `projectId: null`.
- Project-scoped execution belongs to project workspace/task entry points and can use bound ADK runtime pods.
- Postgres stores management metadata; SQLite stores local session indexes/runtime state; transcripts are JSONL files.

## Test-Relevant Product Areas

- App shell, navigation, login, version/status surfaces.
- Assistant thread, composer, attachments, AskUserQuestion, streaming, resume, artifacts.
- Runtime family and model/connection selection.
- Codex CLI path, Codex SDK path, OpenAI-compatible Responses proxy, and provider protocol conversion.
- GLM5.2-style domestic model routing as an M1/M2 class concern when configured by the platform.
- Claude Code path for parity and comparison.
- Skills, experts, MCP/connectors, skill marketplace/install/history.
- Project list/workbench, repo-backed project CRUD, GitLab config/files/issues/activity/members.
- Project runtime binding, ADK runtime discovery, workspace repo checkout, Linux-user/runtime isolation.
- Project automations, scheduled/manual runs, evidence projection to GitLab.
- Release lanes: local, macOS release, Windows packaging, remote dev integration.
- 360Teams embedded launch behavior.
- Compliance tiers M1-M4, redaction, token leakage, and external dependency blockers.

## Current Issue Domains

Local issue exports show active work across these domains:

- Teams embedding and product shell: #22, #121.
- Project assets, GitLab-backed projects, CRUD, runtime workspace, automation: #33, #92, #99, #100, #115, #118.
- Automation and knowledge loop: #34.
- Windows/macOS release and package publication: #45, #51.
- Context and skill governance: #48.
- Lingxi OAuth2 resource aggregation, LLM connections, MCPHub, SkillHub: #64, #66, #67, #68, #69, #70.
- UI/UX convergence: #78, #80, #81, #82, #83, #84, #85, #86, #87, #121.
- Codex runtime/protocol hardening and compliance-tier design: #88, #120.
- e2e macOS Docker/SQLite reliability: #122.

Closed or prior test work also matters for regression mapping:

- QBot Codex real product path: #116.
- Claude Code QBot real path: #117 when available in issue export or tracker context.
- Runtime feature matrix, surface drift, and contract tests: #101, #103, #107.
- Codex Responses proxy hardening: #110.

## Core Validation Commands

Use commands only after checking current repository docs and scoped AGENTS files:

```bash
npm run check
npm run build:ui
npm run e2e:doctor -- --scope=local
npm run e2e:local
npm run e2e:local:real
npm run e2e:qbot:codex:real
npm run e2e:qbot:codex:real -- --uiux-audit
npm run e2e:qbot:claude-code:real
npm run codex:doctor
npm run codex:smoke
npm run claude:doctor
npm run claude:smoke
npm run runtime-features:doctor
npm run runtime-features:test -- --family=codex
npm run runtime-features:report
npm run e2e:release:mac
npm run build:desktop
```

## Non-Negotiable Test Semantics

- Mock/local smoke proves boot or transport only; it does not prove real provider behavior.
- Real-provider or real-runtime lanes require explicit env gates and sanitized artifacts.
- A skipped real-provider lane is not a pass.
- A missing external dependency is a blocker or degraded condition, not a successful result.
- Secrets, runtime homes, DB files, `.env` content, provider keys, Lingxi/GitLab tokens, and raw private transcripts must never be copied into test cases, reports, or issue comments.
- UI must not directly talk to GitLab, ADK runtime servers, provider endpoints, or filesystem/process state.

