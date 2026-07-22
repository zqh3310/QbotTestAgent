#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "$0")/../../.." && pwd)"
QBOT_ROOT="${1:?deepbankV2 root is required}"
MCPHUB_URL="${2:?MCPHub fixture URL is required}"
QBOT_HOME="${3-}"
E2E="${4:-1}"
cd "$QBOT_ROOT"
if [[ -f .env ]]; then set -a; source .env; set +a; fi
exec node "$ROOT_DIR/teams360-automation/runtime/scripts/teams-control-plane.mjs" connector "$QBOT_ROOT" "$QBOT_HOME" "$MCPHUB_URL" "$E2E"
