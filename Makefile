# CIP Monorepo — Common commands
# Run from compliance/ directory

.PHONY: run dev stop test test-e2e lint typecheck migrate migration seed security-audit load-test clean help

help:
	@echo "CIP Makefile targets:"
	@echo "  make run        — One-command dev: check deps, start infra, migrate, seed, run backend+frontend"
	@echo "  make dev        — Start Postgres, Redis, MinIO, backend, frontend (requires Docker)"
	@echo "  make dev-local  — Start backend + frontend only (requires Postgres, Redis, MinIO running locally)"
	@echo "  make stop       — Stop all containers"
	@echo "  make test       — Run backend tests (pytest)"
	@echo "  make test-e2e   — Run frontend E2E (Playwright)"
	@echo "  make lint       — Lint backend + frontend"
	@echo "  make typecheck  — Type check backend + frontend"
	@echo "  make migrate    — Alembic upgrade head"
	@echo "  make migration  — Create new Alembic migration"
	@echo "  make seed       — Seed development data"
	@echo "  make security-audit — Phase 8.1: Bandit (SAST) + pip-audit (CVEs)"
	@echo "  make load-test  — Phase 8.2: Locust load test (backend must be running)"
	@echo "  make backup-db  — Phase 8.4: PostgreSQL backup to ./backups/"
	@echo "  make restore-db — Phase 8.4: Restore from FILE=backups/cip_YYYYMMDD_HHMMSS.sql"
	@echo "  make s3-versioning — Phase 8.4: Enable versioning on S3/MinIO cip-records bucket"
	@echo "  make clean      — Remove containers, volumes"

# One-command dev: deps check, infra, migrate, seed, backend+frontend
run:
	./scripts/run-dev.sh

dev:
	docker compose up -d postgres redis minio
	@echo "Waiting for Postgres..."
	@sleep 3
	$(MAKE) migrate
	docker compose up backend frontend

dev-full:
	docker compose --profile full up -d postgres redis minio
	@echo "Waiting for Postgres..."
	@sleep 3
	$(MAKE) migrate
	docker compose --profile full up backend celery-worker celery-beat frontend

# Run migrate only. Use when running backend/frontend manually (no Docker).
# See README "Running without Docker" for full steps.
dev-local:
	@echo "Running migrations. Start backend and frontend in separate terminals:"
	@echo "  Terminal 1: cd backend && uvicorn app.main:app --reload --port 8000"
	@echo "  Terminal 2: cd frontend && npm run dev"
	$(MAKE) migrate

# Hard-restart: kill processes on ports 3000/8000, then start backend/frontend/both.
# Usage: make dev-restart-backend | make dev-restart-frontend | make dev-restart
dev-restart-backend:
	./scripts/dev.sh backend

dev-restart-frontend:
	./scripts/dev.sh frontend

dev-restart: dev-restart-both

dev-restart-both:
	./scripts/dev.sh both

stop:
	docker compose down

test:
	cd backend && pip install -e ".[dev]" && pytest -v

# E2E requires: make dev (backend on :8000, frontend on :3000) and make seed.
# Run make dev in another terminal before make test-e2e.
test-e2e:
	cd frontend && PLAYWRIGHT_BROWSERS_PATH=.playwright-browsers npx playwright install chromium && npm run build && PLAYWRIGHT_BROWSERS_PATH=.playwright-browsers npx playwright test

lint:
	cd backend && ruff check . && ruff format --check .
	cd frontend && npm run lint

typecheck:
	cd backend && mypy app/ || true
	cd frontend && npx tsc --noEmit

migrate:
	cd backend && alembic upgrade head

migration:
	cd backend && alembic revision --autogenerate -m "auto"

seed:
	cd backend && PYTHONPATH=. python ../infra/scripts/seed.py

# Phase 8.1: Security audit — Bandit (SAST) + pip-audit (CVEs)
security-audit:
	cd backend && pip install -e ".[dev]" -q && bandit -r app -ll -x tests && pip-audit

# Phase 8.2: Load testing — Locust (auth, screening, analytics). Backend must be on :8000, run make seed first.
load-test:
	cd backend && pip install -e ".[dev]" -q && locust -f locustfile.py --headless -H http://localhost:8000 -u 50 -r 10 --run-time 60s

# Phase 8.4: Backup & recovery. Run from compliance/. Requires docker compose postgres or pg_dump/psql.
backup-db:
	./infra/scripts/backup_db.sh

restore-db:
	@if [ -z "$(FILE)" ]; then echo "Usage: make restore-db FILE=backups/cip_YYYYMMDD_HHMMSS.sql"; exit 1; fi
	./infra/scripts/restore_db.sh "$(FILE)"

# Phase 8.4: Enable S3/MinIO bucket versioning. Requires MinIO/S3 running and .env configured.
s3-versioning:
	cd backend && PYTHONPATH=. python ../infra/scripts/enable_s3_versioning.py

clean:
	docker compose down -v
	rm -rf backend/.pytest_cache backend/__pycache__ backend/app/__pycache__
	rm -rf frontend/.next frontend/node_modules/.cache
