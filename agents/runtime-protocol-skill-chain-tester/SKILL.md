---
name: runtime-protocol-skill-chain-tester
description: Subagent skill for QBot runtime, protocol, and skill-chain test design. Use when covering Codex CLI as the future framework, GLM5.2 or domestic model routing, OpenAI-compatible Responses protocol conversion, Claude Code parity, long tasks, AskUserQuestion, tool calls, MCP, skill invocation, and multi-skill chaining.
---

# Runtime Protocol Skill-Chain Tester

Own runtime-family, model/protocol, and skill-chain coverage for QBot.

## Read First

- `D:\QbotTestAgent\references\deepbank-project-context.md`
- `D:\deepbankV2\docs\design-decisions.md`
- `D:\deepbankV2\test\runtime-features\README.md`
- `D:\deepbankV2\server\AGENTS.md`
- `D:\deepbankV2\test\AGENTS.md`
- Existing runtime mappings under `D:\deepbankV2\test\runtime-features`.

## Responsibilities

- Define coverage for Codex CLI, Codex SDK, Responses proxy, and OpenAI-compatible protocol conversion.
- Include GLM5.2-style domestic model routing as a platform connection/config test when the repository or environment exposes it.
- Compare Codex and Claude Code behavior only where product contracts require parity.
- Cover long tasks, streaming `done`, resume, AskUserQuestion, tool-call rendering, tool results, artifacts, and failure states.
- Cover skill install/use, expert-triggered skills, MCP connector use, multi-skill chains, missing skill, unsupported Codex skill convention, and redaction.
- Distinguish SDK-direct support, product-path support, watchlist behavior, product gaps, and non-goals.
- Recommend exact validation lanes: runtime feature matrix, qbot Codex real, qbot Claude real, local real, or mock WS.

## Boundaries

- Do not claim GLM5.2 behavior unless a configured provider path or artifact proves it.
- Do not claim SDK-direct features are QBot product features unless server/UI product paths expose them.
- Do not use mock smoke as proof of provider semantics.
- Do not assert exact model prose as the main signal; prefer structural runtime events and artifacts.
- Do not leak prompts or transcripts containing sensitive data.

## Acceptance Standard

- Every runtime claim is classified as product-path, SDK-direct, watchlist, product-gap, unsupported, or non-goal.
- Long-task and skill-chain cases include terminal-state and non-hanging assertions.
- Protocol conversion cases include raw event, Deepbank WS, transcript, and redaction evidence requirements.
- Blocked real-provider cases include the missing env/dependency reason.

