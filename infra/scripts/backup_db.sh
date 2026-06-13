#!/usr/bin/env sh
# Phase 8.4: PostgreSQL backup. Run from compliance/: make backup-db
# Requires: docker compose postgres running, or PGHOST/PGUSER/PGPASSWORD set for direct pg_dump.

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
COMPLIANCE_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$COMPLIANCE_DIR"

BACKUP_DIR="${BACKUP_DIR:-./backups}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
FILENAME="cip_${TIMESTAMP}.sql"
OUTPUT="${BACKUP_DIR}/${FILENAME}"

mkdir -p "$BACKUP_DIR"

if command -v docker >/dev/null 2>&1 && docker compose -f docker-compose.yml exec -T postgres pg_dump -U cip cip > "$OUTPUT" 2>/dev/null; then
  echo "Backup written to $OUTPUT"
elif command -v pg_dump >/dev/null 2>&1; then
  pg_dump -U cip -d cip --clean --if-exists -f "$OUTPUT"
  echo "Backup written to $OUTPUT"
else
  echo "Error: need docker compose (with postgres) or pg_dump in PATH"
  exit 1
fi
