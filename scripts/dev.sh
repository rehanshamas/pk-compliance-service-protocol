#!/usr/bin/env bash
# CIP dev script — hard-restart backend, frontend, or both.
# Kills any process on port 8000 (backend) and/or 3000 (frontend), then starts services.
#
# Usage (run from compliance/):
#   ./scripts/dev.sh backend   — kill :8000, start backend
#   ./scripts/dev.sh frontend  — kill :3000, start frontend
#   ./scripts/dev.sh both      — kill :8000 & :3000, start both (backend in bg, frontend in fg)

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMPLIANCE_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
BACKEND_PORT=8000
FRONTEND_PORT=3000

kill_port() {
  local port=$1
  if command -v lsof &>/dev/null; then
    local pids
    pids=$(lsof -ti:"$port" 2>/dev/null || true)
    if [[ -n "$pids" ]]; then
      echo "Killing process(es) on port $port: $pids"
      echo "$pids" | xargs kill -9 2>/dev/null || true
      sleep 1
    else
      echo "Port $port is free."
    fi
  else
    echo "lsof not found; skipping port $port cleanup."
  fi
}

start_backend() {
  echo "Starting backend on :$BACKEND_PORT..."
  cd "$COMPLIANCE_DIR/backend" && exec .venv/bin/uvicorn app.main:app --reload --host 0.0.0.0 --port "$BACKEND_PORT"
}

start_frontend() {
  echo "Starting frontend on :$FRONTEND_PORT..."
  cd "$COMPLIANCE_DIR/frontend" && exec npm run dev -- -p "$FRONTEND_PORT" --hostname 127.0.0.1
}

case "${1:-}" in
  backend)
    kill_port "$BACKEND_PORT"
    start_backend
    ;;
  frontend)
    kill_port "$FRONTEND_PORT"
    start_frontend
    ;;
  both)
    kill_port "$BACKEND_PORT"
    kill_port "$FRONTEND_PORT"
    (cd "$COMPLIANCE_DIR/backend" && .venv/bin/uvicorn app.main:app --reload --host 0.0.0.0 --port "$BACKEND_PORT") &
    BACKEND_PID=$!
    sleep 3
    trap "kill $BACKEND_PID 2>/dev/null || true; exit" EXIT INT TERM
    (cd "$COMPLIANCE_DIR/frontend" && npm run dev -- -p "$FRONTEND_PORT" --hostname 127.0.0.1)
    ;;
  *)
    echo "Usage: $0 {backend|frontend|both}"
    echo ""
    echo "  backend  — hard-restart backend (port 8000)"
    echo "  frontend — hard-restart frontend (port 3000)"
    echo "  both     — hard-restart both (backend in background, frontend in foreground)"
    exit 1
    ;;
esac
