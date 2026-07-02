# deepbankV2 Bug Issue Field Mapping

Use this mapping only after reading the live repository files under the local `deepbankV2/.gitlab` directory. The live `.gitlab/issue_templates/Bug.md`, `.gitlab/README.md`, and `.gitlab/scripts/gitlab_labels.sh` are the source of truth.

New Bug issue titles should start with `【Bug】`, followed by a second category when useful, for example `【Bug】【交互问题】...`.

## Required User-Facing Inputs

- title: concise symptom and affected surface
- affected entry: where the user sees it, such as login page, chat composer, expert selector, knowledge entry, connector entry, settings, runtime response, packaging flow
- reproduction steps: smallest repeatable sequence
- actual result: what happened
- expected result: what should happen
- evidence: screenshot path, report path, logs, console message, request/response, or explicit "no evidence yet"; local screenshot/image paths should be passed in `screenshots`, `image_paths`, `evidence_files`, or `attachments` for GitLab upload

## Template Sections

### Problem

- Short summary
- Observed symptom:
  - UI behavior regression
  - Electron / preload transport failure
  - REST / WS service failure
  - local runtime or DB failure
  - E2E or tooling regression
  - documentation or governance regression
- Expected result

### Scope

- In scope: the behavior that should be fixed
- Non-goals: unrelated refactors, later iteration features, or broad redesigns

### Affected Areas

Map user-facing areas to GitLab labels and template checkboxes:

- UI and visible interaction: `area/ui`
- assistant chat UI/component behavior: `area/assistant-ui`
- desktop app shell, window, menu, packaging: `area/electron`
- preload bridge or IPC transport: `area/preload`
- REST/WS/API/service logic: `area/server`
- persistence, session, SQLite/Postgres: `area/db`
- Codex/Claude/local runtime execution: `area/runtime`
- expert/skill loading: `area/skills`
- project/task workspace flow: `area/projects`
- automated test failure: `area/e2e`
- docs or GitLab governance: `area/docs` or `area/repo`

### Reproduction

Record:

- Node version, if known
- OS, if known
- execution mode: IPC, HTTP-WS, release app, or unknown
- numbered steps
- actual result
- expected result

### Evidence

Include available evidence paths or snippets. For automated UI evidence, include screenshot path, report path, selector/surface/run id when available. When submitting live issues through `scripts/submit_gitlab_bug.py`, local image files are uploaded to GitLab and embedded as Markdown in this section.

### Deterministic Visual Finding

Use `not a visual/UI issue` unless the bug is visual. For visual/UI bugs, record whether it is a selector-level finding or a repeated system-level visual regression.

### Verification

Keep default validation suggestions:

- `npm run check`
- `npm run build:ui` when UI or preload behavior changed
- re-run the reproduction path after fix

## Priority Guidance

- P0 / high: app cannot launch, login impossible, data loss, core chat unusable, release blocker, security/permission boundary broken
- P1: common user workflow broken with workaround
- P2: edge case, confusing UI, partial degradation
- P3: low-frequency polish or wording issue

Only add `priority/high` for P0 or strong P1.
