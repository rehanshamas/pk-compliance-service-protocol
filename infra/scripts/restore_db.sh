#!/usr/bin/env sh
# Phase 8.4: PostgreSQL restore. Run from compliance/: make restore-db FILE=backups/cip_YYYYMMDD_HHMMSS.sql
# WARNING: Replaces current database. Terminates active connections.

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
COMPLIANCE_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$COMPLIANCE_DIR"

FILE="${1:-$FILE}"
if [ -z "$FILE" ] || [ ! -f "$FILE" ]; then
  echo "Usage: make restore-db FILE=backups/cip_YYYYMMDD_HHMMSS.sql"
  echo "Or:    ./infra/scripts/restore_db.sh backups/cip_20250115_120000.sql"
  exit 1
fi

if command -v docker >/dev/null 2>&1; then
  docker compose -f docker-compose.yml exec -T postgres psql -U cip -d postgres -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'cip' AND pid <> pg_backend_pid();" 2>/dev/null || true
  docker compose -f docker-compose.yml exec -T postgres psql -U cip -d cip < "$FILE"
  echo "Restored from $FILE"
elif command -v psql >/dev/null 2>&1; then
  psql -U cip -d postgres -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'cip' AND pid <> pg_backend_pid();" 2>/dev/null || true
  psql -U cip -d cip -f "$FILE"
  echo "Restored from $FILE"
else
  echo "Error: need docker compose (with postgres) or psql in PATH"
  exit 1
fi
