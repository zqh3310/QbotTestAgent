#!/usr/bin/env bash
# QA-only helper: restart the already-built local QBot control plane with the
# runner-owned connector catalog (healthy / unreachable / needs_auth).
# No deepbankV2 file is modified; the normal restart command restores .env.
set -euo pipefail

ROOT_DIR="${1:?deepbankV2 root is required}"
MCPHUB_URL="${2:?MCPHub fixture URL is required}"
DEEPBANK_HOME_OVERRIDE="${3-}"

cd "$ROOT_DIR"

if [[ -f "$ROOT_DIR/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$ROOT_DIR/.env"
  set +a
fi

DEEPBANK_HOME="${DEEPBANK_HOME_OVERRIDE:-${DEEPBANK_HOME:-$ROOT_DIR/.deepbank-runtime/slim}}"
PORT="${PORT:-8900}"
LOG_DIR="$DEEPBANK_HOME/logs"
PID_DIR="$DEEPBANK_HOME/pids"
PID_FILE="$PID_DIR/dev-server.pid"
export DEEPBANK_HOME
export DEEPBANK_ENV=dev
export DEEPBANK_E2E=1
export DEEPBANK_MCPHUB_MOCK=0
export DEEPBANK_MCPHUB_URL="$MCPHUB_URL/api/openapi/servers?detail=true"
export DEEPBANK_MCPHUB_BASE_URL="$MCPHUB_URL"

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
  rm -f "$PID_FILE"
fi
for pid in $(lsof -tiTCP:"$PORT" -sTCP:LISTEN 2>/dev/null || true); do
  kill_tree "$pid"
done

for _ in {1..40}; do
  if ! lsof -nP -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; then break; fi
  sleep 0.25
done

nohup env \
  DEEPBANK_HOME="$DEEPBANK_HOME" \
  DEEPBANK_ENV=dev \
  DEEPBANK_E2E=1 \
  DEEPBANK_MCPHUB_MOCK=0 \
  DEEPBANK_MCPHUB_URL="$MCPHUB_URL/api/openapi/servers?detail=true" \
  DEEPBANK_MCPHUB_BASE_URL="$MCPHUB_URL" \
  npm run dev:server >"$LOG_DIR/dev-server.log" 2>&1 &

server_pid="$!"
printf '%s\n' "$server_pid" > "$PID_FILE"

for _ in {1..160}; do
  if curl -fsS "http://localhost:$PORT/api/health" >/dev/null 2>&1; then
    printf 'control plane restarted pid=%s connector_fixture=%s\n' "$server_pid" "$MCPHUB_URL"
    exit 0
  fi
  if ! kill -0 "$server_pid" 2>/dev/null; then
    tail -n 100 "$LOG_DIR/dev-server.log" >&2 || true
    exit 1
  fi
  sleep 0.25
done

tail -n 100 "$LOG_DIR/dev-server.log" >&2 || true
exit 1
