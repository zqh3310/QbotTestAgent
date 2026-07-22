# 360Teams-hosted QBot automation

This folder is an independent adapter for the installed 360Teams application. It does not import or change the existing local-QBot runner under `src/`, does not use port `9224`, and does not reuse the live 360Teams profile.

## Safety model

- Dedicated profile: `teams360-automation/state/profile`
- Live-profile CDP alias: `teams360-automation/state/live-profile-alias` (symlink only; no credential copy)
- Dedicated state: `teams360-automation/state/session.json`
- Dedicated output: `teams360-automation/output/`
- Random loopback-only CDP port by default
- Child-scoped `DEEPBANK_E2E=1` so packaged QBot exposes its supported QA attachment/workspace/state bridges
- Refuses to launch while a regular 360Teams main process is running
- Never kills, replaces, or reuses a pre-existing 360Teams process
- `doctor` is read-only unless `--open-qbot` is supplied
- `smoke` refuses to send a message unless `--allow-write` is supplied
- Reports redact `app_secret`, access tokens, refresh tokens, bearer values, URL query strings, and fragments

## Workflow

Run from the QbotTestAgent root:

```bash
npm --prefix teams360-automation run check
npm --prefix teams360-automation run launch:live
```

Quit the regular 360Teams client manually before `launch:live`. This lane uses the existing
logged-in profile and adds only a loopback CDP port. 360Teams 5.2.12 uses Electron 42,
whose Chromium runtime ignores remote-debugging switches for the default profile path.
The adapter therefore passes an adapter-owned symlink alias as `--user-data-dir`; the alias
resolves to the existing signed-in profile, preserves the QWork bootstrap, and does not copy
or inspect OAuth credentials. The process guard still requires the regular client to be
fully stopped before this controlled instance starts.

`npm run launch` remains available as an isolated-profile diagnostic lane, but it is not a
valid QWork functional-test lane for the current package. Symlinks resolving into the live
profile are rejected in this isolated mode.

Discover 360Teams pages, frames and QBot WebView targets:

```bash
npm --prefix teams360-automation run doctor -- --open-qbot
```

For full Casebook runs, the wrapper reads the managed `launch:live` session, verifies that
it uses the existing signed-in live profile, and starts/stops its WebView CDP proxy
automatically. It does not seed OAuth tokens or read credentials from the Keychain. The
proxy exposes the QWork QBot WebView as a Playwright `page` and adds a Teams-only readback
bridge for the visible `composer-safety-level-menu`. This lets the runner verify that M3
is selected even when the embedded package does not expose the local-QBot `runtimeOptions`
API. The bridge never changes the selected model and is not loaded by the local-QBot lane.

Use the Teams-only Casebook wrapper for real batches:

```bash
npm --prefix teams360-automation run casebook -- \
  --casebook PRD/QBot系统SIT测试用例.xlsx \
  --profile full \
  --case SIT-HOME-001,SIT-HOME-002 \
  --model-tier M3 \
  --out teams360-automation/output/<run-name> \
  --timeout-ms 600000
```

`--cdp` remains available for diagnostics with a caller-managed loopback proxy, but normal
functional runs should omit it and use the recorded live session. Isolated profiles and
token-seeded login state are deliberately rejected for functional Casebook execution.

The wrapper retries the flaky initial QWork CDP attach and hands the successful browser
connection directly to the existing runner. It refuses local-QBot restart commands and
refuses output paths outside this folder, so the local-QBot execution lane remains unchanged.

The current managed 360Teams session exposes one QWork WebView, so it remains a single worker.
Chromium does not support `Target.createTarget` for this embedded WebView; attempting to run
five cases against the same page would mix composers, attachments, sessions, and screenshots.
Use the root multi-CDP scheduler only after five independently launched and signed-in QWork
App workers are available. The scheduler will then run five parallel-safe cases at a time,
serialize shared expert/skill/connector state, and put all App-restart cases at the end.

### Teams-only fault and fixture lane

Cases that need SkillHub catalogs, MCPHub connector states, control-plane faults, or a host
restart use `teams360-automation/runtime/`. The compatibility shims preserve the shared
Casebook semantics while enforcing these boundaries:

- only the PID and live profile recorded in `state/session.json` may be restarted;
- the packaged QBot WebView is relaunched inside 360Teams, never the local QBot Electron app;
- the runner-owned control plane uses `127.0.0.1:18900`, leaving local QBot port `8900` alone;
- fixture state uses `state/control-plane-home`, separate from local QBot homes;
- every fault/fixture Case restores the original packaged control-plane origin before the
  next normal Case.

The caller still cannot pass `--restart-command`. The Teams adapter derives its restore
command from the live WebView's existing `DEEPBANK_SERVER` and keeps it internal.

Run the scoped message smoke only after doctor passes:

```bash
npm --prefix teams360-automation run smoke -- --allow-write
```

Stop only the isolated process recorded by this adapter:

```bash
npm --prefix teams360-automation run stop
```

## Expected blockers

- `A regular 360Teams instance is already running`: quit the normal client manually during a controlled window, then run `launch` again. The adapter will not stop it automatically.
- `live profile alias is not a symlink/points elsewhere`: remove or repair only `teams360-automation/state/live-profile-alias`; never replace the real 360Teams profile.
- `exited before CDP became ready`: the client rejected the isolated startup for another host-level reason; inspect the report and do not bypass the process guard.
- `CDP is reachable, but no QBot target`: log in to the isolated 360Teams profile and run `doctor -- --open-qbot` again.
- `composer was not found`: CDP works, but QBot is in a guest target or host shape that needs an additional discovery rule. Add it only in this folder.
