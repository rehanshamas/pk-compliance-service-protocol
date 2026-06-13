"""CIP FastAPI application factory."""

from contextlib import asynccontextmanager
from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import engine, init_db
from app.core.exceptions import (
    CIPError,
    NotFoundError,
    AuthenticationError,
    AuthorizationError,
    ValidationError,
)
from app.core.audit import AuditMiddleware
from app.core.rate_limit import RateLimitMiddleware
from app.core.dependencies import get_current_user
from app.modules.auth.router import router as auth_router
from app.modules.tenants.router import router as tenants_router
from app.modules.screening.router import router as screening_router
from app.modules.identity.router import router as identity_router
from app.modules.admin.router import router as admin_router
from app.modules.alerts.router import router as alerts_router
from app.modules.compliance.router import router as compliance_router
from app.modules.compliance.isar_router import router as isar_router
from app.modules.compliance.reports_router import router as reports_router
from app.modules.compliance.form_a5_router import router as form_a5_router
from app.modules.compliance.form_a6_router import router as form_a6_router
from app.modules.compliance.retention_router import router as records_router
from app.modules.notifications.router import router as notifications_router
from app.modules.analytics.router import router as analytics_router
from app.modules.monitoring.router import router as monitoring_router
from app.modules.webhooks.shufti_router import router as shufti_webhook_router
from app.modules.billing.router import router as billing_router
from app.modules.admin.applications_router import router as applications_router
from app.modules.incidents.router import router as incidents_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup: init DB. Shutdown: dispose engine."""
    from app.core.logging import setup_logging
    setup_logging(settings.log_level)
    await init_db()
    # Initialize system settings defaults
    from app.database import async_session_maker
    from app.modules.admin.settings_service import system_settings_service
    async with async_session_maker() as session:
        await system_settings_service.initialize_defaults(session)
        await session.commit()
    yield
    await engine.dispose()


def create_app() -> FastAPI:
    # Disable public Swagger UI in production — frontend serves interactive docs instead
    is_prod = settings.environment == "production"
    app = FastAPI(
        title="CIP API",
        description="Compliance Infrastructure Platform — KYC, Screening, Analytics, Compliance Operations",
        version="1.0.0",
        docs_url=None if is_prod else "/docs",
        redoc_url=None if is_prod else "/redoc",
        # Keep openapi.json available (auth-gated route added below for frontend explorer)
        openapi_url="/openapi.json",
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    from app.core.security_headers import SecurityHeadersMiddleware
    app.add_middleware(SecurityHeadersMiddleware)
    app.add_middleware(AuditMiddleware)
    app.add_middleware(RateLimitMiddleware)

    app.include_router(auth_router, prefix="/api/v1/auth", tags=["auth"])
    app.include_router(tenants_router, prefix="/api/v1/tenants", tags=["tenants"])
    app.include_router(screening_router, prefix="/api/v1/screening", tags=["screening"])
    app.include_router(identity_router, prefix="/api/v1/customers", tags=["customers"])
    app.include_router(admin_router, prefix="/api/v1/admin", tags=["admin"])
    app.include_router(alerts_router, prefix="/api/v1/alerts", tags=["alerts"])
    app.include_router(compliance_router, prefix="/api/v1/cases", tags=["cases"])
    app.include_router(isar_router, prefix="/api/v1/isars", tags=["isars"])
    app.include_router(reports_router, prefix="/api/v1/reports/str", tags=["reports"])
    app.include_router(form_a5_router, prefix="/api/v1/reports/form-a5", tags=["reports"])
    app.include_router(form_a6_router, prefix="/api/v1/reports/form-a6", tags=["reports"])
    app.include_router(records_router, prefix="/api/v1/records", tags=["records"])
    app.include_router(notifications_router, prefix="/api/v1/notifications", tags=["notifications"])
    app.include_router(analytics_router, prefix="/api/v1/wallets", tags=["analytics"])
    app.include_router(monitoring_router, prefix="/api/v1/monitoring-rules", tags=["monitoring"])
    app.include_router(shufti_webhook_router, prefix="/api/v1/webhooks/shufti", tags=["webhooks"])
    app.include_router(billing_router, prefix="/api/v1/billing", tags=["billing"])
    app.include_router(applications_router, prefix="/api/v1/applications", tags=["applications"])
    app.include_router(incidents_router, prefix="/api/v1/incidents", tags=["incidents"])

    # Authenticated OpenAPI schema — filtered to tenant-facing endpoints only
    # Used by frontend API Explorer (no admin/internal routes exposed)
    TENANT_TAGS = {"auth", "tenants", "customers", "screening", "analytics", "alerts",
                   "cases", "isars", "reports", "records", "notifications", "monitoring", "billing", "incidents"}

    @app.get("/api/v1/developer/openapi.json")
    async def developer_openapi(
        user=Depends(get_current_user),
    ):
        """Authenticated OpenAPI schema with only tenant-facing endpoints."""
        from fastapi.openapi.utils import get_openapi
        from fastapi.responses import JSONResponse
        import copy

        full_schema = get_openapi(
            title=app.title,
            version=app.version,
            description="CIP REST API — Tenant endpoints for VASP integration",
            routes=app.routes,
        )
        filtered = copy.deepcopy(full_schema)
        filtered_paths = {}
        for path, methods in filtered.get("paths", {}).items():
            # Skip admin, webhook, and health endpoints
            if "/admin/" in path or "/webhooks/" in path or path.startswith("/health"):
                continue
            # Skip the developer endpoint itself
            if "/developer/" in path:
                continue
            filtered_paths[path] = methods
        filtered["paths"] = filtered_paths
        filtered["info"]["title"] = "CIP API — Developer Reference"
        return JSONResponse(content=filtered)

    @app.get("/api/v1/chat-config")
    async def chat_config():
        """Public: check if chat assistant is enabled."""
        from app.database import async_session_maker
        from app.modules.admin.settings_service import system_settings_service
        async with async_session_maker() as db:
            enabled = await system_settings_service.get_bool(db, "chat_assistant_enabled")
            welcome = await system_settings_service.get(db, "chat_assistant_welcome")
        return {"enabled": enabled, "welcomeMessage": welcome}

    @app.get("/health")
    async def health():
        return {"status": "ok"}

    @app.get("/health/ready")
    async def health_ready():
        from app.database import check_connections
        ok, msg = await check_connections()
        if not ok:
            return {"status": "unhealthy", "detail": msg}, 503
        return {"status": "ok"}

    @app.exception_handler(CIPError)
    async def cip_error_handler(request, exc: CIPError):
        from fastapi.responses import JSONResponse
        return JSONResponse(
            status_code=exc.status_code,
            content={
                "status": "error",
                "error": {
                    "code": exc.code,
                    "message": exc.message,
                    "details": exc.details,
                },
            },
        )

    return app


app = create_app()
