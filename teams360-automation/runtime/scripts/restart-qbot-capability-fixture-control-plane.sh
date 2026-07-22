#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "$0")/../../.." && pwd)"
QBOT_ROOT="${1:?deepbankV2 root is required}"
SKILLHUB_URL="${2:?SkillHub fixture URL is required}"
MCPHUB_URL="${3:?MCPHub fixture URL is required}"
QBOT_HOME="${4-}"
cd "$QBOT_ROOT"
if [[ -f .env ]]; then set -a; source .env; set +a; fi
exec node "$ROOT_DIR/teams360-automation/runtime/scripts/teams-control-plane.mjs" capability "$QBOT_ROOT" "$QBOT_HOME" "$SKILLHUB_URL" "$MCPHUB_URL"
