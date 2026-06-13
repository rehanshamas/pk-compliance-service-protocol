#!/usr/bin/env bash
# CIP single-command dev setup. Checks deps, starts infra, installs, migrates, seeds, runs app.
# Run from any dir: ./scripts/run-dev.sh   (or from workspace root: compliance/scripts/run-dev.sh)
#
# Usage:
#   ./scripts/run-dev.sh              — full setup + run
#   ./scripts/run-dev.sh --no-deps     — skip dependency checks/installs (assume ready)
#   ./scripts/run-dev.sh --no-seed     — skip database seed
#   ./scripts/run-dev.sh --backend-only  — start backend only
#   ./scripts/run-dev.sh --frontend-only — start frontend only

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMPLIANCE_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
BACKEND_DIR="$COMPLIANCE_DIR/backend"
FRONTEND_DIR="$COMPLIANCE_DIR/frontend"
VENV="$BACKEND_DIR/.venv"
BACKEND_PORT=8000
FRONTEND_PORT=3000

NO_DEPS=false
NO_SEED=false
BACKEND_ONLY=false
FRONTEND_ONLY=false

for arg in "$@"; do
  case "$arg" in
    --no-deps)       NO_DEPS=true ;;
    --no-seed)       NO_SEED=true ;;
    --backend-only)  BACKEND_ONLY=true ;;
    --frontend-only) FRONTEND_ONLY=true ;;
  esac
done

log()   { echo "[INFO]  $*"; }
log_ok() { echo "[OK]    $*"; }
log_skip() { echo "[SKIP]  $*"; }
log_warn() { echo "[WARN]  $*"; }
log_err() { echo "[ERROR] $*"; }

# --- Ensure we're in compliance dir ---
cd "$COMPLIANCE_DIR"

# --- Check Docker ---
check_docker() {
  if command -v docker &>/dev/null; then
    if docker compose version &>/dev/null || docker-compose version &>/dev/null 2>/dev/null; then
      log_ok "Docker found"
      return 0
    fi
    log_warn "Docker found but docker compose may not work"
  fi
  log_err "Docker not found. Install Docker Desktop: https://www.docker.com/products/docker-desktop/"
  exit 1
}

# --- Check Python ---
check_python() {
  local py=
  for cmd in python3.12 python3.11 python3; do
    if command -v "$cmd" &>/dev/null && "$cmd" -c "import sys; exit(0 if sys.version_info >= (3,11) else 1)" 2>/dev/null; then
      py=$cmd
      break
    fi
  done
  if [[ -z "$py" ]]; then
    log_err "Python 3.11+ not found. Install from https://www.python.org/ or use pyenv."
    exit 1
  fi
  log_ok "Python: $py"
  echo "$py"
}

# --- Check Node ---
check_node() {
  if command -v node &>/dev/null; then
    local ver
    ver=$(node -v 2>/dev/null || true)
    log_ok "Node: $ver"
    return 0
  fi
  log_err "Node.js not found. Install from https://nodejs.org/ (LTS)."
  exit 1
}

# --- Kill process on port (if in use), retry once ---
kill_port() {
  local port=$1
  if command -v lsof &>/dev/null; then
    local pids
    pids=$(lsof -ti:"$port" 2>/dev/null || true)
    if [[ -n "$pids" ]]; then
      log "Port $port in use (PID: $pids), killing..."
      echo "$pids" | xargs kill -9 2>/dev/null || true
      sleep 2
      # Retry: if still in use, kill again
      pids=$(lsof -ti:"$port" 2>/dev/null || true)
      if [[ -n "$pids" ]]; then
        echo "$pids" | xargs kill -9 2>/dev/null || true
        sleep 1
      fi
      log_ok "Port $port freed"
    fi
  fi
}

# --- Free port(s) before starting. Kills existing process, retries once. ---
free_ports() {
  if [[ "$BACKEND_ONLY" == true ]]; then
    kill_port "$BACKEND_PORT"
  elif [[ "$FRONTEND_ONLY" == true ]]; then
    kill_port "$FRONTEND_PORT"
  else
    kill_port "$BACKEND_PORT"
    kill_port "$FRONTEND_PORT"
  fi
}

# --- Print seed credentials (Admin, MLRO) ---
print_credentials() {
  echo ""
  echo "  ┌─────────────────────────────────────────────"
  echo "  │  Seed credentials (make seed)"
  echo "  ├─────────────────────────────────────────────"
  echo "  │  Admin:  admin@cip.pk / admin123"
  echo "  │  MLRO:   mlro@vasp.pk / demo123"
  echo "  │  Analyst: analyst@vasp.pk / demo123"
  echo "  └─────────────────────────────────────────────"
  echo ""
}

# --- Start infra (Postgres, Redis, MinIO) ---
start_infra() {
  log "Starting Postgres, Redis, MinIO..."
  if docker compose up -d postgres redis minio 2>/dev/null || docker-compose up -d postgres redis minio 2>/dev/null; then
    log_ok "Infra started"
  else
    log_err "Failed to start docker services"
    exit 1
  fi
  log "Waiting for Postgres..."
  for i in {1..30}; do
    if docker compose exec -T postgres pg_isready -U cip -d cip &>/dev/null 2>/dev/null || \
       docker-compose exec -T postgres pg_isready -U cip -d cip &>/dev/null 2>/dev/null; then
      log_ok "Postgres ready"
      return 0
    fi
    sleep 1
  done
  log_err "Postgres did not become ready"
  exit 1
}

# --- Ensure .env ---
ensure_env() {
  if [[ ! -f "$COMPLIANCE_DIR/.env" ]]; then
    if [[ -f "$COMPLIANCE_DIR/.env.example" ]]; then
      cp "$COMPLIANCE_DIR/.env.example" "$COMPLIANCE_DIR/.env"
      log_ok "Created .env from .env.example"
    else
      log_warn "No .env or .env.example found"
    fi
  else
    log_skip ".env exists"
  fi
}

# --- Backend setup ---
setup_backend() {
  [[ "$FRONTEND_ONLY" == true ]] && return 0
  local py="${1:-python3}"

  if [[ "$NO_DEPS" != true ]]; then
    local need_pip=false
    if [[ ! -d "$VENV" ]]; then
      log "Creating backend venv..."
      "$py" -m venv "$VENV"
      log_ok "venv created"
      need_pip=true
    elif ! "$VENV/bin/python" -c "import uvicorn" 2>/dev/null; then
      log "Backend deps missing (uvicorn not found)"
      need_pip=true
    else
      log_skip "venv + deps exist"
    fi
    if [[ "$need_pip" == true ]]; then
      log "Installing backend deps..."
      (cd "$BACKEND_DIR" && "$VENV/bin/pip" install -e ".[dev]" -q)
      log_ok "Backend deps installed"
    fi
  fi

  log "Running migrations..."
  (cd "$BACKEND_DIR" && "$VENV/bin/alembic" upgrade head)
  log_ok "Migrations done"

  if [[ "$NO_SEED" != true ]] && [[ "$FRONTEND_ONLY" != true ]]; then
    log "Seeding database..."
    (cd "$BACKEND_DIR" && PYTHONPATH=. "$VENV/bin/python" ../infra/scripts/seed.py)
    log_ok "Seed done"
  fi
}

# --- Frontend setup ---
setup_frontend() {
  [[ "$BACKEND_ONLY" == true ]] && return 0
  if [[ "$NO_DEPS" != true ]]; then
    if [[ ! -d "$FRONTEND_DIR/node_modules" ]]; then
      log "Installing frontend deps..."
      (cd "$FRONTEND_DIR" && npm install --silent)
      log_ok "Frontend deps installed"
    else
      log_skip "Frontend deps already installed (node_modules exists)"
    fi
  else
    log_skip "Skipping npm install (--no-deps)"
  fi
}

# --- Start backend (blocks) ---
run_backend() {
  log "Starting backend on http://localhost:$BACKEND_PORT"
  cd "$BACKEND_DIR" && exec "$VENV/bin/uvicorn" app.main:app --reload --host 0.0.0.0 --port "$BACKEND_PORT"
}

# --- Start frontend (blocks) ---
run_frontend() {
  log "Starting frontend on http://localhost:$FRONTEND_PORT"
  cd "$FRONTEND_DIR" && exec npm run dev -- -p "$FRONTEND_PORT"
}

# --- Main ---
main() {
  log "CIP dev — single-command setup"
  log "Compliance dir: $COMPLIANCE_DIR"
  echo ""

  if [[ "$NO_DEPS" != true ]]; then
    check_docker
    PY=$(check_python)
    check_node
    echo ""
  fi

  # Start infra only if we need backend
  if [[ "$FRONTEND_ONLY" != true ]]; then
    start_infra
    ensure_env
    echo ""
  fi

  setup_backend "$PY"
  setup_frontend
  echo ""

  log "Freeing port(s) if in use..."
  free_ports
  print_credentials

  if [[ "$BACKEND_ONLY" == true ]]; then
    run_backend
  elif [[ "$FRONTEND_ONLY" == true ]]; then
    run_frontend
  else
    log "Starting backend (background) and frontend (foreground)..."
    log "Backend: http://localhost:$BACKEND_PORT"
    log "Frontend: http://localhost:$FRONTEND_PORT"
    log "Docs: http://localhost:$BACKEND_PORT/docs"
    log "Login: mlro@vasp.pk / demo123"
    echo ""
    (cd "$BACKEND_DIR" && "$VENV/bin/uvicorn" app.main:app --reload --host 0.0.0.0 --port "$BACKEND_PORT") &
    BACKEND_PID=$!
    trap "kill $BACKEND_PID 2>/dev/null || true; exit" EXIT INT TERM
    sleep 3
    run_frontend
  fi
}

main
