"""Admin routes: pipelines, tenants, audit. Platform admin only."""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import PlainTextResponse

from app.database import get_db
from app.core.dependencies import require_platform_admin
from app.models.tenant import User
from app.modules.admin.schemas import (
    PipelinesResponse,
    PipelineHealthItem,
    AdminTenantListResponse,
    AdminTenantResponse,
    AdminTenantDetailResponse,
    AdminTenantCreateRequest,
    AdminTenantPatchRequest,
    AdminTenantRotateKeyResponse,
    AdminAuditListResponse,
    AdminAuditEntryResponse,
)
from app.modules.admin.tenant_service import admin_tenant_service
from app.modules.admin.usage_service import admin_usage_service
from app.modules.admin.audit_service import admin_audit_service
from app.modules.screening.service import screening_service
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter()


def _tenant_to_response(t, users_count: int) -> AdminTenantResponse:
    return AdminTenantResponse(
        id=str(t.id),
        name=t.name,
        slug=t.slug,
        status=t.status.value,
        featureFlags=t.feature_flags or {},
        usersCount=users_count,
        createdAt=t.created_at.isoformat(),
        webhookUrl=t.webhook_url,
        hasApiKey=bool(t.api_key_hash),
    )


def _tenant_to_detail_response(t, users_count: int):
    reg = t.outsourcing_register
    if reg is not None and not isinstance(reg, list):
        reg = [reg] if isinstance(reg, dict) else []
    users = [
        {"id": str(u.id), "email": u.email, "fullName": u.full_name, "role": u.role.value, "isActive": u.is_active}
        for u in (t.users or [])
    ]
    return AdminTenantDetailResponse(
        id=str(t.id),
        name=t.name,
        slug=t.slug,
        status=t.status.value,
        featureFlags=t.feature_flags or {},
        usersCount=users_count,
        createdAt=t.created_at.isoformat(),
        webhookUrl=t.webhook_url,
        hasApiKey=bool(t.api_key_hash),
        outsourcingRegister=reg,
        users=users,
    )


TASK_BY_SOURCE = {
    "un": "ingest_un_sanctions",
    "ofac": "ingest_ofac_sdn",
    "eu": "ingest_eu_sanctions",
    "nacta": "ingest_nacta_proscribed",
    "pep": "ingest_peps",
}


@router.get("/pipelines", response_model=PipelinesResponse)
async def get_pipelines(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_platform_admin),
):
    """Ingestion health for all sanctions list sources. Platform admin only."""
    health = await screening_service.get_ingestion_health(db)
    items = [
        PipelineHealthItem(
            source=h.source.value.upper(),
            status=h.status,
            lastRunAt=h.last_run_at.isoformat() if h.last_run_at else None,
            recordsCount=h.records_count,
            lastError=h.last_error,
        )
        for h in health
    ]
    return PipelinesResponse(pipelines=items)


@router.post("/pipelines/{source}/trigger")
async def trigger_pipeline(
    source: str,
    user: User = Depends(require_platform_admin),
):
    """Manually trigger ingestion for a source (un, ofac, eu, nacta, pep)."""
    task_name = TASK_BY_SOURCE.get((source or "").lower())
    if not task_name:
        raise HTTPException(400, f"Invalid source. Use: {list(TASK_BY_SOURCE.keys())}")
    from app.workers.celery_app import app as celery_app
    task = celery_app.send_task(task_name)
    return {"status": "triggered", "source": source.upper(), "taskId": task.id}


# Admin tenant management (Phase 5.8)

@router.get("/tenants", response_model=AdminTenantListResponse)
async def list_tenants(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_platform_admin),
    limit: int = Query(50, le=100, ge=1),
    offset: int = Query(0, ge=0),
    status: str | None = Query(None, description="Filter by status"),
):
    """List all tenants. Platform admin only."""
    tenants, total = await admin_tenant_service.list(db, limit=limit, offset=offset, status=status)
    items = []
    for t in tenants:
        count = await admin_tenant_service.users_count(db, t.id)
        items.append(_tenant_to_response(t, count))
    return AdminTenantListResponse(items=items, total=total)


@router.get("/tenants/{tenant_id}", response_model=AdminTenantDetailResponse)
async def get_tenant(
    tenant_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_platform_admin),
):
    """Get tenant detail with users. Platform admin only."""
    tenant = await admin_tenant_service.get(db, tenant_id)
    count = len(tenant.users)
    return _tenant_to_detail_response(tenant, count)


@router.post("/tenants", response_model=AdminTenantResponse, status_code=201)
async def create_tenant(
    body: AdminTenantCreateRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_platform_admin),
):
    """Create tenant. Platform admin only."""
    tenant = await admin_tenant_service.create(db, name=body.name, slug=body.slug)
    return _tenant_to_response(tenant, 0)


@router.patch("/tenants/{tenant_id}", response_model=AdminTenantResponse)
async def patch_tenant(
    tenant_id: UUID,
    body: AdminTenantPatchRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_platform_admin),
):
    """Update tenant. Platform admin only."""
    tenant = await admin_tenant_service.patch(
        db,
        tenant_id,
        name=body.name,
        status=body.status,
        feature_flags=body.featureFlags,
        webhook_url=body.webhookUrl,
    )
    count = await admin_tenant_service.users_count(db, tenant_id)
    return _tenant_to_response(tenant, count)


@router.delete("/tenants/{tenant_id}", status_code=204)
async def delete_tenant(
    tenant_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_platform_admin),
):
    """Terminate tenant (sets status to terminated). Platform admin only."""
    await admin_tenant_service.delete(db, tenant_id)


# Admin usage metering (Phase 5.9)

@router.get("/usage/export")
async def export_usage_csv(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_platform_admin),
    tenantId: UUID | None = Query(None),
    dateRange: int = Query(30, ge=1, le=365),
):
    """Export usage as CSV. Platform admin only."""
    csv_str = await admin_usage_service.export_csv(
        db, tenant_id=tenantId, days=dateRange
    )
    return PlainTextResponse(
        csv_str,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=usage_export.csv"},
    )


@router.get("/usage")
async def get_usage(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_platform_admin),
    tenantId: UUID | None = Query(None, description="Filter by tenant"),
    dateRange: int = Query(30, ge=1, le=365, description="Days to aggregate"),
):
    """Usage dashboard: per-tenant totals, daily breakdown for charts. Platform admin only."""
    data = await admin_usage_service.get_usage(
        db, tenant_id=tenantId, days=dateRange
    )
    return data


@router.post("/tenants/{tenant_id}/rotate-api-key", response_model=AdminTenantRotateKeyResponse)
async def rotate_tenant_api_key(
    tenant_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_platform_admin),
):
    """Generate new API key. Returns plain key once; store securely. Platform admin only."""
    raw_key = await admin_tenant_service.rotate_api_key(db, tenant_id)
    return AdminTenantRotateKeyResponse(apiKey=raw_key)


@router.post("/tenants/{tenant_id}/revoke-api-key", status_code=200)
async def revoke_tenant_api_key(
    tenant_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_platform_admin),
):
    """Revoke tenant's API key. Platform admin only."""
    await admin_tenant_service.revoke_api_key(db, tenant_id)
    return {"status": "success", "message": "API key revoked"}


# Admin audit log (Phase 5.10)

@router.get("/audit", response_model=AdminAuditListResponse)
async def get_audit(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_platform_admin),
    tenantId: UUID | None = Query(None, description="Filter by tenant"),
    action: str | None = Query(None, description="Filter by action"),
    resourceType: str | None = Query(None, description="Filter by resource type"),
    dateRange: int = Query(30, ge=1, le=365, description="Days to look back (7, 30, 90)"),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
):
    """Cross-tenant audit log search. Platform admin only."""
    items, total = await admin_audit_service.list(
        db,
        tenant_id=tenantId,
        action=action,
        resource_type=resourceType,
        days=dateRange,
        limit=limit,
        offset=offset,
    )
    return AdminAuditListResponse(
        items=[AdminAuditEntryResponse(**x) for x in items],
        total=total,
    )


# --- System Health ---

@router.get("/system/health")
async def get_system_health(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_platform_admin),
):
    """Detailed system health: Postgres, Redis, Blockscout, Subsquid, NADRA, SMTP."""
    from app.modules.admin.health_service import get_system_health
    return await get_system_health(db)


# --- Identity Verification Routing ---

@router.get("/settings/identity-routing")
async def get_identity_routing(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_platform_admin),
):
    """Get identity verification provider routing configuration."""
    from app.modules.admin.settings_service import system_settings_service
    keys = [
        "identity_primary_provider",
        "identity_fallback_provider",
        "identity_fallback_trigger",
        "identity_fallback_timeout_ms",
        "identity_fallback_confidence_threshold",
    ]
    result = {}
    for key in keys:
        result[key] = await system_settings_service.get(db, key)
    return {"status": "success", "data": result}


@router.patch("/settings/identity-routing")
async def update_identity_routing(
    body: dict,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_platform_admin),
):
    """Update identity verification provider routing configuration."""
    from app.modules.admin.settings_service import system_settings_service
    allowed = {
        "identity_primary_provider",
        "identity_fallback_provider",
        "identity_fallback_trigger",
        "identity_fallback_timeout_ms",
        "identity_fallback_confidence_threshold",
    }
    updates = {k: str(v) for k, v in body.items() if k in allowed}
    results = await system_settings_service.bulk_update(db, updates)
    return {"status": "success", "data": results}


# --- Notification Preferences ---

@router.get("/settings/notifications")
async def get_notification_preferences(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_platform_admin),
):
    """Get notification preference settings."""
    from app.modules.admin.settings_service import system_settings_service
    keys = [
        "notif_admin_email_enabled",
        "notif_admin_email_on_application",
        "notif_admin_email_on_pipeline_failure",
        "notif_admin_email_on_system_health",
        "notif_tenant_email_alerts_enabled",
        "notif_tenant_webhook_enabled",
        "notif_tenant_daily_digest",
        "notif_smtp_provider",
    ]
    result = {}
    for key in keys:
        result[key] = await system_settings_service.get(db, key)
    return {"status": "success", "data": result}


@router.patch("/settings/notifications")
async def update_notification_preferences(
    body: dict,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_platform_admin),
):
    """Update notification preference settings."""
    from app.modules.admin.settings_service import system_settings_service
    allowed = {
        "notif_admin_email_enabled",
        "notif_admin_email_on_application",
        "notif_admin_email_on_pipeline_failure",
        "notif_admin_email_on_system_health",
        "notif_tenant_email_alerts_enabled",
        "notif_tenant_webhook_enabled",
        "notif_tenant_daily_digest",
        "notif_smtp_provider",
    }
    updates = {k: str(v) for k, v in body.items() if k in allowed}
    results = await system_settings_service.bulk_update(db, updates)
    return {"status": "success", "data": results}


# --- Chat Assistant Settings ---

@router.get("/settings/chat")
async def get_chat_settings(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_platform_admin),
):
    """Get chat assistant configuration."""
    from app.modules.admin.settings_service import system_settings_service
    return {
        "status": "success",
        "data": {
            "enabled": await system_settings_service.get_bool(db, "chat_assistant_enabled"),
            "welcome_message": await system_settings_service.get(db, "chat_assistant_welcome"),
        },
    }


@router.patch("/settings/chat")
async def update_chat_settings(
    body: dict,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_platform_admin),
):
    """Toggle chat assistant on/off, update welcome message."""
    from app.modules.admin.settings_service import system_settings_service
    updates = {}
    if "enabled" in body:
        updates["chat_assistant_enabled"] = str(body["enabled"]).lower()
    if "welcome_message" in body:
        updates["chat_assistant_welcome"] = str(body["welcome_message"])
    results = await system_settings_service.bulk_update(db, updates)
    return {"status": "success", "data": results}


# --- System Settings ---

@router.get("/settings")
async def list_settings(
    category: str | None = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_platform_admin),
):
    from app.modules.admin.settings_service import system_settings_service
    return {"status": "success", "data": await system_settings_service.get_all(db, category)}


@router.patch("/settings")
async def update_settings(
    body: dict,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_platform_admin),
):
    from app.modules.admin.settings_service import system_settings_service
    results = await system_settings_service.bulk_update(db, body)
    return {"status": "success", "data": results}


# --- VASP Settings Visibility (admin config) ---

@router.get("/settings/vasp-config")
async def get_vasp_config(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_platform_admin),
):
    """Get VASP settings visibility toggles. Platform admin only."""
    from app.modules.admin.settings_service import system_settings_service
    config = await system_settings_service.get_vasp_config(db)
    return {"status": "success", "data": config}


@router.patch("/settings/vasp-config")
async def update_vasp_config(
    body: dict,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_platform_admin),
):
    """Update VASP settings visibility toggles. Platform admin only."""
    from app.modules.admin.settings_service import system_settings_service
    updates = {k: bool(v) for k, v in body.items() if isinstance(v, bool)}
    config = await system_settings_service.update_vasp_config(db, updates)
    return {"status": "success", "data": config}
