"""Alerts API: list, get, patch."""

from uuid import UUID

from fastapi import APIRouter, Depends, Query

from app.database import get_db
from app.core.dependencies import get_current_user
from app.core.exceptions import FeatureDisabledError
from app.models.tenant import User
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.alerts.schemas import AlertResponse, AlertListResponse, AlertPatchRequest
from app.modules.alerts.service import alert_service

router = APIRouter()


def _require_tenant(user: User) -> UUID:
    if not user.tenant_id:
        raise FeatureDisabledError("Platform admins use admin endpoints for alerts.")
    return user.tenant_id


def _to_response(a) -> AlertResponse:
    return AlertResponse(
        id=str(a.id),
        tenantId=str(a.tenant_id),
        severity=a.severity.value,
        source=a.source_type.value,
        summary=a.summary,
        status=a.status.value,
        assignedTo=str(a.assigned_to) if a.assigned_to else None,
        sourceId=str(a.source_id),
        createdAt=a.created_at.isoformat(),
        resolvedAt=a.resolved_at.isoformat() if a.resolved_at else None,
    )


@router.get("", response_model=AlertListResponse)
async def list_alerts(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    limit: int = Query(50, le=100),
    offset: int = Query(0, ge=0),
    severity: str | None = Query(None),
    status: str | None = Query(None),
):
    """List alerts for tenant. Filter by severity and status."""
    tenant_id = _require_tenant(user)
    items, total = await alert_service.list(
        db, tenant_id=tenant_id, limit=limit, offset=offset,
        severity=severity, status=status,
    )
    return AlertListResponse(items=[_to_response(a) for a in items], total=total)


@router.get("/{alert_id}", response_model=AlertResponse)
async def get_alert(
    alert_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Get single alert."""
    tenant_id = _require_tenant(user)
    a = await alert_service.get(db, alert_id=alert_id, tenant_id=tenant_id)
    return _to_response(a)


@router.patch("/{alert_id}", response_model=AlertResponse)
async def patch_alert(
    alert_id: UUID,
    body: AlertPatchRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Update alert status and/or assigned_to."""
    tenant_id = _require_tenant(user)
    a = await alert_service.patch(
        db,
        alert_id=alert_id,
        tenant_id=tenant_id,
        status=body.status,
        assigned_to=UUID(body.assignedTo) if body.assignedTo else None,
    )
    return _to_response(a)
