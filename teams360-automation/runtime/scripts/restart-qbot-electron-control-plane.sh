#!/usr/bin/env bash
# Teams-only compatibility shim for the shared Casebook fault-injection hooks.
# It never starts the local QBot Electron app. It restarts only the exact managed
# 360Teams process recorded by teams360-automation/state/session.json.
set -euo pipefail

_QBOT_ROOT_IGNORED="${1-}"
CONTROL_PLANE_URL="${2:?control-plane URL is required}"
EXPECTED_QWORK_UI_URL="${5-}"
AGENT_MOCK="${6:-0}"

if [[ "$AGENT_MOCK" != "0" && "$AGENT_MOCK" != "1" ]]; then
  echo "agent-mock flag must be 0 or 1, received: $AGENT_MOCK" >&2
  exit 2
fi

if [[ "$CONTROL_PLANE_URL" == "http://127.0.0.1:8900" || "$CONTROL_PLANE_URL" == "http://localhost:8900" ]]; then
  CONTROL_PLANE_URL="http://127.0.0.1:18900"
fi

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
if [[ "$EXPECTED_QWORK_UI_URL" =~ ^file://.*/\.deepbank(-dev|-local|-uat|-sit)?/ui/[^/]+/index\.html ]]; then
  exec node "$ROOT_DIR/lib/relaunch-managed-host.mjs" "$CONTROL_PLANE_URL" "$EXPECTED_QWORK_UI_URL" "$AGENT_MOCK"
fi
exec node "$ROOT_DIR/lib/relaunch-managed-host.mjs" "$CONTROL_PLANE_URL" "" "$AGENT_MOCK"
