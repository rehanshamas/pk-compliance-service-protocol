"""Tenant routes: GET /tenants/me, PATCH /tenants/me (outsourcing config), settings, users."""

from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.tenant import User as UserModel, UserRole
from app.modules.tenants.schemas import TenantResponse, TenantPatchRequest
from app.modules.tenants.service import tenant_service
from app.core.dependencies import get_current_user
from app.core.exceptions import NotFoundError, ValidationError
from app.core.auth import hash_password

router = APIRouter()


@router.get("/me", response_model=TenantResponse)
async def get_me(
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    """Return current tenant for authenticated user. Platform admins have no tenant."""
    if not user.tenant_id:
        raise NotFoundError("Platform admins have no tenant context. Use admin endpoints.")
    tenant = await tenant_service.get_tenant(db, user.tenant_id)
    reg = tenant.outsourcing_register
    if reg is not None and not isinstance(reg, list):
        reg = [reg] if isinstance(reg, dict) else []
    return TenantResponse(
        id=str(tenant.id),
        name=tenant.name,
        slug=tenant.slug,
        status=tenant.status.value,
        feature_flags=tenant.feature_flags or {},
        outsourcingRegister=reg,
    )


@router.patch("/me", response_model=TenantResponse)
async def patch_me(
    body: TenantPatchRequest,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    """Update tenant settings (e.g. outsourcing register for Form A5). Platform admins have no tenant."""
    if not user.tenant_id:
        raise NotFoundError("Platform admins have no tenant context.")
    if body.outsourcingRegister is not None:
        tenant = await tenant_service.update_outsourcing_register(
            db, user.tenant_id, body.outsourcingRegister
        )
    else:
        tenant = await tenant_service.get_tenant(db, user.tenant_id)
    reg = tenant.outsourcing_register
    if reg is not None and not isinstance(reg, list):
        reg = [reg] if isinstance(reg, dict) else []
    return TenantResponse(
        id=str(tenant.id),
        name=tenant.name,
        slug=tenant.slug,
        status=tenant.status.value,
        feature_flags=tenant.feature_flags or {},
        outsourcingRegister=reg,
    )


# --------------- Settings endpoints ---------------


def _get_tenant_or_raise(user):
    """Helper to get tenant from user or raise NotFoundError."""
    tenant = user.tenant
    if not tenant:
        raise NotFoundError("Tenant not found")
    return tenant


@router.get("/me/settings")
async def get_tenant_settings(
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    """Get all tenant settings including feature flags."""
    tenant = _get_tenant_or_raise(user)
    return {
        "status": "success",
        "data": {
            "feature_flags": tenant.feature_flags or {},
            "webhook_url": tenant.webhook_url,
            "outsourcing_register": tenant.outsourcing_register,
        },
    }


@router.get("/me/settings/visibility")
async def get_settings_visibility(
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    """Get which settings sections are visible for the current tenant (VASP portal).
    Reads from admin-configured vasp_config system settings.
    """
    from app.modules.admin.settings_service import system_settings_service
    config = await system_settings_service.get_vasp_config(db)
    return {"status": "success", "data": config}


@router.patch("/me/settings/screening")
async def update_screening_settings(
    body: dict,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    """Update tenant screening configuration."""
    tenant = _get_tenant_or_raise(user)
    flags = dict(tenant.feature_flags or {})
    if "fuzzy_threshold" in body:
        flags["screening_fuzzy_threshold"] = body["fuzzy_threshold"]
    if "sources_enabled" in body:
        flags["screening_sources"] = body["sources_enabled"]
    if "ongoing_monitoring_enabled" in body:
        flags["ongoing_monitoring_enabled"] = body["ongoing_monitoring_enabled"]
    tenant.feature_flags = flags
    return {"status": "success", "data": flags}


@router.post("/me/webhooks/test")
async def test_webhook(
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    """Send a test payload to the configured webhook URL."""
    tenant = _get_tenant_or_raise(user)
    url = tenant.webhook_url
    if not url or not url.strip():
        raise ValidationError("No webhook URL configured. Set one first.")

    from app.core.webhooks import deliver_webhook_sync
    result = deliver_webhook_sync(
        url.strip(),
        "test.ping",
        {"message": "CIP webhook test", "tenantId": str(tenant.id)},
        api_key_hash=tenant.api_key_hash,
    )
    return {
        "status": "success",
        "data": {
            "delivered": result["success"],
            "statusCode": result["status_code"],
            "error": result["error"],
        },
    }


@router.patch("/me/settings/webhooks")
async def update_webhook_settings(
    body: dict,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    """Update tenant webhook URL."""
    tenant = _get_tenant_or_raise(user)
    if "webhook_url" in body:
        tenant.webhook_url = body["webhook_url"]
    return {"status": "success", "data": {"webhook_url": tenant.webhook_url}}


@router.patch("/me/settings/retention")
async def update_retention_settings(
    body: dict,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    """Update tenant retention policy settings."""
    tenant = _get_tenant_or_raise(user)
    flags = dict(tenant.feature_flags or {})
    if "retention_years" in body:
        flags["retention_years"] = body["retention_years"]
    if "auto_delete_expired" in body:
        flags["auto_delete_expired"] = body["auto_delete_expired"]
    tenant.feature_flags = flags
    return {"status": "success", "data": flags}


@router.patch("/me/settings/analytics")
async def update_analytics_settings(
    body: dict,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    """Update tenant analytics preferences (which layers to use)."""
    tenant = _get_tenant_or_raise(user)
    flags = dict(tenant.feature_flags or {})
    for key in [
        "analytics_layer1_enabled",
        "analytics_layer2_enabled",
        "analytics_layer3_enabled",
        "analytics_default_depth",
    ]:
        if key in body:
            flags[key] = body[key]
    tenant.feature_flags = flags
    return {"status": "success", "data": flags}


# --------------- Team / User management ---------------


@router.get("/me/users")
async def list_tenant_users(
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    """List users in the current tenant."""
    if not user.tenant_id:
        raise NotFoundError("Tenant not found")
    result = await db.execute(
        select(UserModel).where(
            UserModel.tenant_id == user.tenant_id,
            UserModel.is_active.is_(True),
        )
    )
    users = result.scalars().all()
    return {
        "status": "success",
        "data": [
            {
                "id": str(u.id),
                "email": u.email,
                "fullName": u.full_name,
                "role": u.role.value,
                "isActive": u.is_active,
                "lastLoginAt": u.last_login_at.isoformat() if u.last_login_at else None,
            }
            for u in users
        ],
    }


@router.post("/me/users")
async def invite_tenant_user(
    body: dict,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    """Create a new user in the current tenant."""
    if not user.tenant_id:
        raise NotFoundError("Tenant not found")

    email = body.get("email", "").strip().lower()
    full_name = body.get("full_name", "").strip()
    role = body.get("role", "analyst")
    password = body.get("password", "")

    if not email or not full_name or not password:
        raise ValidationError("email, full_name, and password are required")

    existing = await db.execute(select(UserModel).where(UserModel.email == email))
    if existing.scalar_one_or_none():
        raise ValidationError("User with this email already exists")

    new_user = UserModel(
        tenant_id=user.tenant_id,
        email=email,
        password_hash=hash_password(password),
        full_name=full_name,
        role=UserRole(role),
        is_active=True,
    )
    db.add(new_user)
    await db.flush()
    return {
        "status": "success",
        "data": {
            "id": str(new_user.id),
            "email": new_user.email,
            "role": new_user.role.value,
        },
    }


@router.patch("/me/users/{user_id}")
async def update_tenant_user(
    user_id: UUID,
    body: dict,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    """Update a user in the current tenant (deactivate, change role)."""
    if not user.tenant_id:
        raise NotFoundError("Tenant not found")
    from app.core.exceptions import AuthorizationError
    if user.role.value not in ("mlro", "compliance_officer"):
        raise AuthorizationError("Only MLRO or Compliance Officer can manage team members")

    result = await db.execute(select(UserModel).where(
        UserModel.id == user_id, UserModel.tenant_id == user.tenant_id
    ))
    target = result.scalar_one_or_none()
    if not target:
        raise NotFoundError("User not found")

    if "is_active" in body:
        target.is_active = body["is_active"]
    if "role" in body:
        target.role = UserRole(body["role"])
    if "full_name" in body:
        target.full_name = body["full_name"]

    return {
        "status": "success",
        "data": {
            "id": str(target.id),
            "email": target.email,
            "role": target.role.value,
            "isActive": target.is_active,
        },
    }


# --------------- API Key management ---------------


@router.post("/me/api-keys")
async def create_api_key(
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    """Generate a new API key for the tenant. Only MLROs can do this."""
    from app.core.exceptions import AuthorizationError
    if user.role.value not in ("mlro", "compliance_officer"):
        raise AuthorizationError("Only MLRO or Compliance Officer can manage API keys")

    tenant = user.tenant
    if not tenant:
        raise NotFoundError("Tenant not found")

    import secrets
    raw_key = f"cip_live_{secrets.token_urlsafe(32)}"
    from app.core.auth import hash_api_key
    tenant.api_key_hash = hash_api_key(raw_key)

    return {
        "status": "success",
        "data": {
            "api_key": raw_key,
            "message": "Store this key securely — it will not be shown again.",
        },
    }


@router.delete("/me/api-keys")
async def revoke_api_key(
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    """Revoke the current API key."""
    from app.core.exceptions import AuthorizationError
    if user.role.value not in ("mlro", "compliance_officer"):
        raise AuthorizationError("Only MLRO or Compliance Officer can manage API keys")

    tenant = user.tenant
    if not tenant:
        raise NotFoundError("Tenant not found")

    tenant.api_key_hash = None
    return {"status": "success", "data": {"message": "API key revoked."}}


@router.get("/me/api-keys")
async def get_api_key_status(
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    """Check if an API key is currently active."""
    tenant = user.tenant
    if not tenant:
        raise NotFoundError("Tenant not found")

    return {
        "status": "success",
        "data": {
            "has_key": tenant.api_key_hash is not None,
            "key_preview": "cip_live_****" if tenant.api_key_hash else None,
        },
    }
