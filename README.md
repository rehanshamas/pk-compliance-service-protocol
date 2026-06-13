# CIP — Compliance Infrastructure Platform

CIP is a B2B RegTech platform that provides outsourced AML/CFT compliance
infrastructure for Virtual Asset Service Providers (VASPs) operating in Pakistan.
It lets a VASP meet its statutory obligations — identity verification, sanctions
screening, transaction monitoring, investigations, and regulatory reporting —
through a single multi-tenant service.

CIP is a compliance service provider, not a VASP: it does not custody customer
assets. It is designed to operate as a Section 14 outsourced provider, with the
VASP remaining the primary regulated entity, under the Pakistan Virtual Assets
Act 2026, the PVARA NOC Regulations 2025, and the AMLA 2010.

---

## Capabilities

The platform is organised around five compliance pillars:

1. **Identity & CDD/EDD** — KYC onboarding with NADRA Verisys and Shufti Pro,
   a risk-based tier system, and an enhanced due diligence (EDD) workflow.
2. **Screening & TFS** — sanctions and PEP screening against UN, OFAC, EU,
   NACTA, and other lists, with fuzzy matching and ongoing re-screening.
3. **Transaction Monitoring** — a configurable rules engine (threshold,
   velocity, and pattern rules) that raises alerts for review.
4. **Investigations & Reporting** — case management, the ISAR workflow,
   goAML XML export for the FMU, and statutory Form A5/A6 generation.
5. **Blockchain Analytics** — wallet risk scoring across free (Blockscout),
   indexed (Subsquid), and optional commercial data sources.

## Architecture

```
Nginx (TLS, rate limiting)
├── Frontend  — Next.js 15 console
└── Backend   — FastAPI service
    ├── PostgreSQL 16   (primary datastore)
    ├── Redis 7         (cache + rate limiting)
    ├── MinIO / S3      (document & record storage, 7-year retention)
    ├── Celery Worker   (asynchronous tasks)
    └── Celery Beat     (scheduled tasks: list ingest, re-screening, monitoring)
```

### Tech stack

| Layer | Technology |
|-------|-----------|
| Backend API | FastAPI (Python 3.12), async SQLAlchemy 2.0, asyncpg |
| Frontend | Next.js 15, React 19, TypeScript, Tailwind CSS, Radix UI |
| Database | PostgreSQL 16 with Alembic migrations |
| Cache / queue | Redis 7 |
| Task queue | Celery 5 + Celery Beat |
| Object storage | MinIO (S3-compatible) |
| Reverse proxy | Nginx (TLS 1.2/1.3, HSTS, CSP) |
| Auth | JWT (RS256) + per-tenant API keys (SHA-256 hashed) |

## Repository layout

```
backend/        FastAPI service
  app/
    adapters/   Pluggable external-service adapters (mock/sandbox/real)
    core/       Auth, security, storage, rate limiting, audit middleware
    modules/    Domain modules (identity, screening, monitoring, …)
    workers/    Celery tasks and schedules
  alembic/      Database migrations
  tests/        Unit and integration tests
frontend/       Next.js 15 compliance console
sdks/           Browser and React Native KYC capture SDKs
infra/          Nginx and deployment configuration
scripts/        Operational scripts
```

## Feature modules

| Module | Purpose |
|--------|---------|
| auth | Login, token refresh, API key validation |
| identity | KYC/EDD, NADRA/Shufti verification, hosted verification sessions, risk scoring |
| screening | Sanctions screening, fuzzy matching, batch jobs |
| analytics | Blockchain wallet risk scoring |
| compliance | Cases, ISARs, STR/CTR, statutory forms, retention |
| alerts | Alert lifecycle, severity routing, assignment |
| monitoring | Transaction monitoring rules engine |
| billing | Plans, subscriptions, usage, invoicing |
| admin | Tenant management, audit logs, system health |
| tenants | Tenant self-service (API keys, webhooks, settings) |
| notifications | Email and in-app notifications |
| webhooks | Inbound provider callbacks and outbound dispatch |
| incidents | Incident management |

## Getting started

### Prerequisites

- Docker and Docker Compose
- Python 3.12+ and Node.js 20+ (for running services outside containers)

### Run locally

```bash
# 1. Configure the environment
cp .env.example .env
cd backend && python scripts/generate_jwt_keys.py && cd ..   # generate RS256 signing keys

# 2. Start the stack (Postgres, Redis, MinIO, backend, frontend)
make dev          # without Celery
make dev-full     # with Celery worker + beat

# 3. Apply migrations and seed demo data
make migrate
make seed
```

The backend serves the API and the frontend the console; see `docker-compose.yml`
for ports and service definitions.

### Common tasks

```bash
make test            # run the test suite (unit + integration)
make lint            # ruff + eslint
make typecheck       # mypy + tsc
make migration       # autogenerate a migration from model changes
make security-audit  # bandit + pip-audit
make load-test       # Locust load test
make help            # list all targets
```

## Authentication & roles

Access tokens are signed with RS256 (15-minute access, 7-day refresh). Service
integrations authenticate with per-tenant API keys. Six roles enforce access:
`platform_admin`, `platform_support`, `mlro`, `compliance_officer`, `analyst`,
and `developer`.

### Demo credentials (local seed only)

After `make seed`, the following accounts are available for local development:

- `admin@cip.pk` / `admin123` — Platform Admin
- `mlro@vasp.pk` / `demo123` — MLRO
- `analyst@vasp.pk` / `demo123` — Analyst

These are seed values for local use only and must never be used in any deployed
environment.

## Multi-tenancy & data protection

- Every customer-scoped query is filtered by `tenant_id`, enforced at the
  dependency-injection layer.
- All mutating requests are recorded in an immutable, insert-only audit log.
- Documents and records are retained for seven years with object versioning.
- Sensitive identity fields support optional Fernet (AES-256) field-level
  encryption.

External integrations (NADRA, Shufti, Blockscout, Subsquid) are implemented as
adapters with `mock`, `sandbox`, and `real` modes selected by environment
variables, so the platform runs end-to-end without live credentials.

## License

Copyright © 2026 Rehan Shamas. All rights reserved.

This project is **source-available, not open source**. You may view and evaluate
the code, but any reuse — using it in production, copying, modifying, distributing,
creating derivative works, or incorporating it into other software — requires
**prior written permission** from the copyright holder **and** clear attribution.

To request permission, contact **rehanshamas@hotmail.com**. See the full terms in
[LICENSE](LICENSE).
