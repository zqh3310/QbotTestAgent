#!/usr/bin/env bash
# QA fault-injection helper: restart only the Electron client against a
# runner-owned control-plane proxy.  The deepbankV2 server and repository stay
# untouched; the normal restart command restores the original client later.
set -euo pipefail

ROOT_DIR="${1:?deepbankV2 root is required}"
CONTROL_PLANE_URL="${2:?control-plane URL is required}"
CDP_PORT="${3:-9224}"
DEEPBANK_HOME_OVERRIDE="${4:-}"
SKILLHUB_URL_OVERRIDE="${5:-}"
DEEPBANK_E2E_OVERRIDE="${6:-1}"

cd "$ROOT_DIR"

if [[ -f "$ROOT_DIR/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$ROOT_DIR/.env"
  set +a
fi

DEEPBANK_HOME="${DEEPBANK_HOME_OVERRIDE:-${DEEPBANK_HOME:-$ROOT_DIR/.deepbank-runtime/slim}}"
DEEPBANK_AUTH_PROVIDER="${DEEPBANK_AUTH_PROVIDER:-mock}"
if [[ -n "$SKILLHUB_URL_OVERRIDE" ]]; then
  DEEPBANK_SKILLHUB_RESOURCES_BASE_URL="$SKILLHUB_URL_OVERRIDE"
fi
LOG_DIR="$DEEPBANK_HOME/logs"
PID_DIR="$DEEPBANK_HOME/pids"
PID_FILE="$PID_DIR/electron.pid"
ELECTRON_BIN="$ROOT_DIR/node_modules/.bin/electron"

[[ -x "$ELECTRON_BIN" ]] || { echo "missing Electron binary: $ELECTRON_BIN" >&2; exit 1; }
mkdir -p "$LOG_DIR" "$PID_DIR"

children_of() {
  pgrep -P "$1" 2>/dev/null || true
}

kill_tree() {
  local pid="$1" child
  [[ -n "$pid" ]] || return 0
  kill -0 "$pid" 2>/dev/null || return 0
  for child in $(children_of "$pid"); do
    kill_tree "$child"
  done
  kill "$pid" 2>/dev/null || true
}

if [[ -f "$PID_FILE" ]]; then
  old_pid="$(tr -dc '0-9' < "$PID_FILE" 2>/dev/null || true)"
  [[ -n "$old_pid" ]] && kill_tree "$old_pid"
fi
pkill -f "$ROOT_DIR/node_modules/electron/dist/Electron" 2>/dev/null || true
pkill -f "$ROOT_DIR.*electron \\." 2>/dev/null || true
sleep 1

nohup env \
  npm_lifecycle_event=start \
  DEEPBANK_HOME="$DEEPBANK_HOME" \
  DEEPBANK_SERVER="$CONTROL_PLANE_URL" \
  DEEPBANK_AUTH_PROVIDER="$DEEPBANK_AUTH_PROVIDER" \
  DEEPBANK_SKILLHUB_RESOURCES_BASE_URL="${DEEPBANK_SKILLHUB_RESOURCES_BASE_URL:-}" \
  DEEPBANK_E2E="$DEEPBANK_E2E_OVERRIDE" \
  DEEPBANK_ENV=dev \
  "$ELECTRON_BIN" . \
  --remote-debugging-port="$CDP_PORT" \
  >"$LOG_DIR/electron.log" 2>&1 &

printf '%s\n' "$!" > "$PID_FILE"
printf 'electron restarted pid=%s server=%s cdp=%s\n' "$!" "$CONTROL_PLANE_URL" "$CDP_PORT"
