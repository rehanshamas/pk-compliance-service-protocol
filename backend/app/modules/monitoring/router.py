"""Monitoring rules API: CRUD for transaction monitoring rules. Phase 6.6."""

from uuid import UUID

from fastapi import APIRouter, Depends, Query

from app.core.dependencies import get_current_user
from app.core.exceptions import FeatureDisabledError, NotFoundError
from app.database import get_db
from app.models.tenant import User
from app.modules.monitoring.schemas import (
    MonitoringRuleCreate,
    MonitoringRulePatch,
    MonitoringRuleResponse,
    MonitoringRuleListResponse,
)
from app.modules.monitoring.service import monitoring_service
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter()


def _require_tenant(user: User) -> UUID | None:
    """Return tenant_id. Platform admins can list/create tenant-scoped or platform rules."""
    return user.tenant_id


def _to_response(r) -> MonitoringRuleResponse:
    return MonitoringRuleResponse(
        id=str(r.id),
        tenantId=str(r.tenant_id) if r.tenant_id else None,
        name=r.name,
        description=r.description,
        ruleType=r.rule_type.value,
        conditions=r.conditions or {},
        severity=r.severity.value,
        enabled=r.enabled,
        createdAt=r.created_at.isoformat(),
        updatedAt=r.updated_at.isoformat(),
    )


@router.get("", response_model=MonitoringRuleListResponse)
async def list_rules(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    includePlatformDefaults: bool = Query(
        True,
        description="Include platform-wide default rules (tenant_id=null)",
    ),
):
    """List monitoring rules for tenant. Merges tenant rules + platform defaults when requested."""
    tenant_id = _require_tenant(user)
    if not tenant_id and user.role.value not in ("platform_admin", "platform_support"):
        raise FeatureDisabledError("Platform admins use admin endpoints for rules.")
    items, total = await monitoring_service.list_rules(
        db,
        tenant_id=tenant_id,
        limit=limit,
        offset=offset,
        include_platform_defaults=includePlatformDefaults,
    )
    return MonitoringRuleListResponse(
        items=[_to_response(r) for r in items],
        total=total,
    )


@router.post("", response_model=MonitoringRuleResponse)
async def create_rule(
    body: MonitoringRuleCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Create a monitoring rule. Tenant-scoped unless platform admin creates platform default."""
    tenant_id = _require_tenant(user)
    # Platform admins can set tenantId=null for platform defaults
    rule_tenant_id = tenant_id
    if user.role.value in ("platform_admin", "platform_support") and body.tenantId is None:
        rule_tenant_id = None
    elif body.tenantId and user.role.value in ("platform_admin", "platform_support"):
        rule_tenant_id = UUID(body.tenantId)
    elif not tenant_id:
        raise FeatureDisabledError("Tenant required to create rules.")
    r = await monitoring_service.create_rule(
        db,
        tenant_id=rule_tenant_id,
        name=body.name,
        description=body.description,
        rule_type=body.ruleType,
        conditions=body.conditions,
        severity=body.severity,
        enabled=body.enabled,
    )
    return _to_response(r)


@router.get("/{rule_id}", response_model=MonitoringRuleResponse)
async def get_rule(
    rule_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Get a single monitoring rule."""
    tenant_id = _require_tenant(user)
    r = await monitoring_service.get_rule(
        db, rule_id=rule_id, tenant_id=tenant_id, allow_platform_admin=user.role.value in ("platform_admin", "platform_support")
    )
    return _to_response(r)


@router.patch("/{rule_id}", response_model=MonitoringRuleResponse)
async def patch_rule(
    rule_id: UUID,
    body: MonitoringRulePatch,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Update a monitoring rule."""
    tenant_id = _require_tenant(user)
    r = await monitoring_service.patch_rule(
        db,
        rule_id=rule_id,
        tenant_id=tenant_id,
        allow_platform_admin=user.role.value in ("platform_admin", "platform_support"),
        name=body.name,
        description=body.description,
        rule_type=body.ruleType,
        conditions=body.conditions,
        severity=body.severity,
        enabled=body.enabled,
    )
    return _to_response(r)


@router.delete("/{rule_id}")
async def delete_rule(
    rule_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Delete a monitoring rule."""
    tenant_id = _require_tenant(user)
    await monitoring_service.delete_rule(
        db,
        rule_id=rule_id,
        tenant_id=tenant_id,
        allow_platform_admin=user.role.value in ("platform_admin", "platform_support"),
    )
    return {"status": "deleted"}
