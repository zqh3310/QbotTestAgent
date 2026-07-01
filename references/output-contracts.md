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

## Issue Delta Work Packet

Use this packet when `gitlab-issue-monitor` detects material issue drift:

```yaml
agent: gitlab-issue-monitor
source_mode: live-gitlab | local-export | mixed | unavailable | stale-snapshot
source_timestamp: <timestamp or unknown>
baseline:
  state_file: <path>
  baseline_initialized: true | false
delta_summary:
  material_count: 0
  new_count: 0
  changed_count: 0
  state_change_count: 0
  removed_count: 0
material_deltas:
  - issue: "#123"
    title: <title>
    change: new | changed | state | removed
    changed_fields: []
    modules: []
    owner_agents: []
    required_action: add | edit | split | merge | deprecate | no_change | triage
test_plan_decision:
  required: true | false
  reason: <short reason>
  recommended_agents: []
workflow_plan:
  - step: 1
    agent: issue-intelligence-analyst
    action: <action>
blockers: []
```

If `source_mode` is not `live-gitlab`, the final user-facing report must state that issue freshness is snapshot-based, mixed, unavailable, or stale.

## Issue Intelligence Scope Packet

Use this packet before functional case or automation design. It is the handoff from `issue-intelligence-analyst` back to `qbot-test-chief`.

```yaml
agent: issue-intelligence-analyst
generated_at: <timestamp>
selection_policy: []
total_issues: 0
selected_product_issue_count: 0
excluded_issue_count: 0
test_design_issue_count: 0
selected_issues:
  - iid: 123
    scope_decision: include_product_scope
    scope_category: product_function_or_doc | product_requirement_body | product_bug_or_regression | product_dependency_constraint
    scope_confidence: high | medium | low
    scope_reason: <why this issue is selected>
    handoff_to_test_design: yes
    title: <title>
    state: opened | closed
    kind: <kind>
    priority: P0 | P1 | P2 | P3
    modules: <modules>
    product_requirement_summary: <short summary>
    explicit_constraints: <constraints or blockers>
    acceptance_source: <issue section used as requirement source>
    full_description: <full issue body>
excluded_issues:
  - iid: 456
    scope_decision: exclude_development_process
    scope_category: development_process | insufficient_product_requirement
    scope_confidence: high | medium | low
    scope_reason: <why this issue is excluded>
    exclusion_reason: <why no cases should be generated>
issue_scope_rows: []
handoff:
  next_agent: qbot-test-chief
  downstream_agents: []
  test_design_issue_iids: []
```

Functional and automation agents must consume only `selected_issues` with `handoff_to_test_design=yes`. Excluded issues may remain in audit evidence, but they must not generate functional cases or Codex flows.

## Test Plan Maintenance Packet

Use this packet when existing workbooks or JSON/CSV test assets need incremental updates:

```yaml
agent: test-plan-maintainer
source_baseline:
  workbook: <path or not provided>
  functional_cases: <path or not provided>
  automation_flows: <path or not provided>
change_summary:
  add: 0
  edit: 0
  split: 0
  merge: 0
  deprecate: 0
  no_change: 0
case_changes:
  - action: add | edit | split | merge | deprecate | no_change
    case_id: <existing or proposed>
    linked_issue: <issue id>
    reason: <why this change is required>
    owner_agent: <agent>
    preserves_id: true | false
automation_changes: []
layer_updates:
  s0: []
  s1: []
  s2: []
  s3: []
  a0: []
  a1: []
  a2: []
  a3: []
blackbox_risks: []
review_required: true
```

Maintenance must not silently delete coverage. Deprecated cases need a reason and, when applicable, a superseding case ID.

## Excel Test Case Columns

Functional test cases should be Excel-ready with these columns:

| Column | Meaning |
|---|---|
| `case_id` | Stable ID, for example `QBOT-FUNC-AUTH-001`. |
| `maintenance_action` | `add`, `edit`, `split`, `merge`, `deprecate`, `no_change`, or `baseline` for core seed cases. |
| `module` | Product module, for example `Assistant`, `Projects`, `Runtime`, `Skills`, `Release`. |
| `submodule` | Narrow surface or feature. |
| `source_refs` | Issue IDs, docs, repo files, or meeting requirements. |
| `issue_state` | Source issue state or `baseline`. |
| `priority` | `P0`, `P1`, `P2`, or `P3`. |
| `regression_layer` | `S0` smoke, `S1` core regression, `S2` module regression, or `S3` full/specialty coverage. |
| `test_type` | Functional, UI, API, integration, e2e, release, security, compatibility, compliance. |
| `platform` | Windows, macOS, both, server, runtime, or not applicable. |
| `user_persona` | Target executor/user, such as ordinary QBot user, admin/operator, or dependency owner. |
| `execution_scope` | `local_mock_or_fixture`, `real_dependency`, `release_specialty`, `design_review`, or `blocked_dependency`. |
| `preconditions` | Required env, data, account, runtime, model, or feature flag. |
| `steps` | Tester-readable steps. |
| `expected_result` | Observable expected outcome. |
| `negative_or_edge` | Whether this is a negative/edge case and why. |
| `automation_candidate` | Yes/no plus reason. |
| `automation_level_target` | Target automation depth: `A0`, `A1`, `A2`, or `A3`. |
| `validation_commands` | Repository commands that can validate the case when prerequisites exist. |
| `evidence_required` | Screenshot, log, artifact, WS trace, transcript, GitLab note, DB check, etc. |
| `blackbox_gate` | Product-facing gate that prevents ordinary users from needing model/runtime/provider/Codex/Claude/MCP knowledge. |
| `acceptance_source` | Specific issue section or source text used as the expected behavior anchor. |
| `blocked_by` | External dependency, missing env, known issue, or empty when runnable. |
| `owner_agent` | Subagent responsible for maintaining this case. |

## Codex Executable Flow Columns

Codex automation flows should be OS-executable and audit-friendly:

| Column | Meaning |
|---|---|
| `flow_id` | Stable ID, for example `QBOT-CODEX-MAC-RUNTIME-001`. |
| `linked_case_ids` | Functional case IDs covered by this flow. |
| `os` | Windows or macOS. |
| `automation_level` | `A0` UI smoke, `A1` local mock/control-plane, `A2` real dependency, or `A3` release/platform specialty. |
| `execution_scope` | Scope inherited from the functional case. |
| `mode` | CLI, Electron UI, browser/UI, shell, hybrid. |
| `required_tools` | Codex CLI, PowerShell, bash/zsh, Playwright, Docker, etc. |
| `required_env` | Explicit env names only; never values. |
| `setup_steps` | Deterministic setup instructions. |
| `codex_prompt_or_command` | Prompt or command the automation agent should execute. |
| `ui_steps` | Manual-style UI operations when the OS automation must click/type. |
| `assertions` | Observable checks, artifact checks, and pass/fail criteria. |
| `blackbox_assertions` | Ordinary-user or admin/operator black-box assertions. |
| `evidence_paths` | Expected artifact paths or patterns. |
| `timeout_minutes` | Time budget before the flow must report failed/blocked instead of hanging. |
| `long_running_controls` | Polling, artifact preservation, timeout, and non-hanging completion rules. |
| `cleanup` | Non-destructive cleanup expectations. |
| `skip_or_block_rules` | Conditions that make the flow skipped or blocked. |

## Automation Execution Report

Use this report when a developer or test executor runs generated Codex automation flows through the local runner.

```yaml
command: automation-doctor | automation-run
status: pass | blocked | failed | incomplete
suite: smoke | daily | local | real | release | all
target_os: macOS | Windows
current_os: macOS | Windows
dry_run: true | false
progress: true | false
stop_reason: <empty or reason>
repo_root: <Deepbank repo>
flows_file: <codex-automation-flows.json>
selection:
  total_flows: 0
  selected_flows: 0
  completed_flows: 0
  remaining_flows: 0
  levels: []
  execution_scopes: []
doctor:
  status: pass | blocked
  package_json_exists: true | false
  required_scripts: []
  missing_scripts: []
  declared_env_names: []
  missing_env_names: []
  findings: []
summary:
  total: 0
  planned: 0
  passed: 0
  failed: 0
  blocked: 0
results:
  - flow_id: <flow>
    linked_case_ids: <case>
    status: planned | passed | failed | blocked
    reason: <why>
    assertion_status: planned | pass | pass-with-warnings | failed | blocked
    case_assertions: <flow assertion text>
    blackbox_assertions: <black-box assertion text>
    expected_evidence_paths: <artifact path patterns>
    assertion_checks:
      - name: command-exit-zero | no-timeout | case-assertions-recorded | blackbox-assertions-recorded | secret-scan-stdout-stderr | evidence:<pattern>
        status: pass | warning | failed | planned | blocked
        detail: <check result>
    script_path: <run.sh or run.ps1>
    stdout_path: <stdout.log>
    stderr_path: <stderr.log>
```

Execution status rules:

- `automation-doctor` must pass before real execution.
- `automation-run --dry-run` validates suite selection and scripts without running product tests.
- `automation-run` executes only flows for the current OS by default.
- Missing package scripts, OS mismatch, missing real/release env, blocked dependency, timeout, or non-zero exit cannot be counted as pass.
- Windows execution uses PowerShell; macOS execution uses `/bin/bash`.
- The runner performs generic assertions: command exit code, timeout, assertion text carry-through, black-box assertion carry-through, stdout/stderr secret scan, and evidence path discovery.
- Product-specific assertions are delegated to QBot's own Playwright, runtime-feature, release-verify, lint, typecheck, and build scripts. Their failing assertions must produce non-zero exit.
- Missing evidence paths are warnings by default unless `--strict-assertions` is used; secret-like output always fails the assertion checklist.
- Long unattended runs must write `automation-progress.json` after every flow and `automation-delivery-report.md` at the end.
- `--resume` continues from `automation-progress.json` in the same output directory.
- `--shard N/M` splits the selected flow list for multiple runners.
- `--max-duration-minutes` stops with status `incomplete` after the configured window; resume can continue later.
- `--retry-failed-report <automation-execution-report.json>` selects only previously failed flows.

## Bug Issue Loop Report

Automation execution must close the loop for failed results by generating local issue drafts. Remote GitLab mutation is opt-in only.

```yaml
issue_loop:
  status: none | drafted | skipped | created | partial | failed
  draft_count: 0
  created_count: 0
  existing_count: 0
  failed_count: 0
  files:
    drafts_json: <bug-issue-drafts.json>
    drafts_md: <bug-issue-drafts.md>
    creation_json: <gitlab-issue-creation-report.json>
  creation:
    status: skipped | created | partial | failed | none
    reason: <why>
    created:
      - fingerprint: <stable dedupe id>
        iid: 123
        web_url: <GitLab URL>
        title: <title>
    existing: []
    failed: []
```

Rules:

- `automation-run` failed results must generate `bug-issue-drafts.json` and `bug-issue-drafts.md`.
- Drafts include title, labels, fingerprint, expected behavior, actual behavior, reproduction, logs, assertion checks, and recommended action.
- The runner must not create remote GitLab issues unless `--create-gitlab-issues --confirm-create-issues` is passed and a token is available.
- Remote creation dedupes by fingerprint before posting.
- `blocked` due to OS mismatch, missing local env, or missing prerequisite is not automatically classified as a product bug.

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

## Test Case Review Finding Fields

When reviewing functional cases or Codex automation flows, the test-case reviewer should return actionable findings:

```yaml
review_id: <stable id>
severity: critical | major | minor
case_id: <case id, flow id, range, or sheet/row reference>
issue_ref: <issue id, doc, source file, or requirement>
reviewer_rule: granularity | traceability | precondition | test_data | steps | expected_result | failure_criteria | priority | coverage | automation | evidence
problem: <specific defect in the test case>
why_it_matters: <execution, product, or release risk>
required_fix: <exact change required before approval>
approval_blocking: true | false
```

Critical examples:

- A case has no executable UI path.
- A case mixes multiple independent scenarios without being marked as an end-to-end flow.
- Automation asks Codex to use shell/API shortcuts when the scenario is supposed to simulate a human using QBot UI.
- A QBot prompt/reply case does not require full prompt, full response, and screenshots as evidence.
- An issue body defines multiple product behaviors but the test suite covers only the title.
