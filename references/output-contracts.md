# Team Output Contracts

Use these contracts when producing artifacts in later phases. The current team creation phase only defines the contracts.

## Subagent Result Packet

Each subagent should return a compact packet:

```yaml
agent: <agent-name>
task: <assigned task>
scope:
  included: []
  excluded: []
sources_read: []
findings: []
test_cases: []
automation_flows: []
evidence:
  verified: []
  missing: []
  blocked: []
risks: []
recommendations: []
handoff:
  next_agent: <optional>
  reason: <optional>
```

## Excel Test Case Columns

Functional test cases should be Excel-ready with these columns:

| Column | Meaning |
|---|---|
| `case_id` | Stable ID, for example `QBOT-FUNC-AUTH-001`. |
| `module` | Product module, for example `Assistant`, `Projects`, `Runtime`, `Skills`, `Release`. |
| `submodule` | Narrow surface or feature. |
| `source_refs` | Issue IDs, docs, repo files, or meeting requirements. |
| `priority` | `P0`, `P1`, `P2`, or `P3`. |
| `test_type` | Functional, UI, API, integration, e2e, release, security, compatibility, compliance. |
| `platform` | Windows, macOS, both, server, runtime, or not applicable. |
| `preconditions` | Required env, data, account, runtime, model, or feature flag. |
| `steps` | Tester-readable steps. |
| `expected_result` | Observable expected outcome. |
| `negative_or_edge` | Whether this is a negative/edge case and why. |
| `automation_candidate` | Yes/no plus reason. |
| `evidence_required` | Screenshot, log, artifact, WS trace, transcript, GitLab note, DB check, etc. |
| `blocked_by` | External dependency, missing env, known issue, or empty when runnable. |
| `owner_agent` | Subagent responsible for maintaining this case. |

## Codex Executable Flow Columns

Codex automation flows should be OS-executable and audit-friendly:

| Column | Meaning |
|---|---|
| `flow_id` | Stable ID, for example `QBOT-CODEX-MAC-RUNTIME-001`. |
| `linked_case_ids` | Functional case IDs covered by this flow. |
| `os` | Windows or macOS. |
| `mode` | CLI, Electron UI, browser/UI, shell, hybrid. |
| `required_tools` | Codex CLI, PowerShell, bash/zsh, Playwright, Docker, etc. |
| `required_env` | Explicit env names only; never values. |
| `setup_steps` | Deterministic setup instructions. |
| `codex_prompt_or_command` | Prompt or command the automation agent should execute. |
| `ui_steps` | Manual-style UI operations when the OS automation must click/type. |
| `assertions` | Observable checks, artifact checks, and pass/fail criteria. |
| `evidence_paths` | Expected artifact paths or patterns. |
| `cleanup` | Non-destructive cleanup expectations. |
| `skip_or_block_rules` | Conditions that make the flow skipped or blocked. |

## Bug / Optimization Decision Fields

When deciding whether a finding is a bug:

```yaml
finding_id: <stable id>
summary: <short summary>
classification: bug | optimization | external-dependency | test-gap | question
confidence: high | medium | low
source_refs: []
expected_behavior: <from issue/docs/product contract>
actual_behavior: <observed behavior or missing evidence>
reproduction: <steps or not-run reason>
impact: <user/runtime/security/release impact>
recommended_action: <fix, issue, follow-up, monitor, no action>
issue_draft_needed: true | false
```

