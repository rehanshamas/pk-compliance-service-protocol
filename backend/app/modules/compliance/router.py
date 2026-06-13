"""Cases API: create, list, get, patch, notes, link alert/customer."""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query

from app.database import get_db
from app.core.dependencies import get_current_user
from app.core.exceptions import FeatureDisabledError, NotFoundError, ValidationError
from app.models.tenant import User
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.compliance.models import CaseStatus
from app.modules.compliance.schemas import (
    CaseCreateRequest,
    CasePatchRequest,
    CaseResponse,
    CaseListResponse,
    CaseNoteCreateRequest,
    CaseNoteResponse,
)
from app.modules.compliance.service import case_service

router = APIRouter()


def _require_tenant(user: User) -> UUID:
    if not user.tenant_id:
        raise FeatureDisabledError("Platform admins use admin endpoints for cases.")
    return user.tenant_id


def _case_to_response(c, linked_count: int, assigned_name: str | None = None) -> CaseResponse:
    return CaseResponse(
        id=str(c.id),
        tenantId=str(c.tenant_id),
        title=c.title,
        description=c.description,
        status=c.status.value,
        linkedAlertsCount=linked_count,
        assignedTo=assigned_name or (str(c.assigned_to) if c.assigned_to else None),
        createdAt=c.created_at.isoformat(),
        updatedAt=c.updated_at.isoformat(),
    )


@router.post("", response_model=CaseResponse)
async def create_case(
    body: CaseCreateRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Create case, optionally from alert."""
    tenant_id = _require_tenant(user)
    alert_id = UUID(body.alertId) if body.alertId else None
    assigned_to = UUID(body.assignedTo) if body.assignedTo else None

    if alert_id:
        from app.models.alert import Alert
        from sqlalchemy import select
        r = await db.execute(select(Alert).where(Alert.id == alert_id, Alert.tenant_id == tenant_id))
        if not r.scalar_one_or_none():
            raise NotFoundError("Alert not found")

    case = await case_service.create(
        db,
        tenant_id=tenant_id,
        title=body.title,
        description=body.description,
        alert_id=alert_id,
        assigned_to=assigned_to,
    )
    # Count known at create: 1 if from alert else 0 (avoids lazy load)
    count = 1 if alert_id else 0
    return _case_to_response(case, count)


@router.get("", response_model=CaseListResponse)
async def list_cases(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    limit: int = Query(50, le=100),
    offset: int = Query(0, ge=0),
    status: str | None = Query(None),
    search: str | None = Query(None, description="Search by case title"),
):
    """List cases for tenant. Filter by status."""
    tenant_id = _require_tenant(user)
    items, total = await case_service.list(
        db, tenant_id=tenant_id, limit=limit, offset=offset, status=status, search=search
    )
    out = []
    for c in items:
        count = case_service._linked_alerts_count(c)
        out.append(_case_to_response(c, count))
    return CaseListResponse(items=out, total=total)


@router.get("/{case_id}", response_model=CaseResponse)
async def get_case(
    case_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Get single case with notes, linked alerts, linked customers."""
    tenant_id = _require_tenant(user)
    case = await case_service.get(db, case_id=case_id, tenant_id=tenant_id)
    count = case_service._linked_alerts_count(case)
    return _case_to_response(case, count)


@router.patch("/{case_id}", response_model=CaseResponse)
async def patch_case(
    case_id: UUID,
    body: CasePatchRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Update case: title, description, status, assigned_to."""
    tenant_id = _require_tenant(user)
    assigned_to = UUID(body.assignedTo) if body.assignedTo else None
    case = await case_service.patch(
        db,
        case_id=case_id,
        tenant_id=tenant_id,
        title=body.title,
        description=body.description,
        status=body.status,
        assigned_to=assigned_to,
        user_role=user.role,
    )
    count = case_service._linked_alerts_count(case)
    return _case_to_response(case, count)


@router.post("/{case_id}/reopen", response_model=CaseResponse)
async def reopen_case(
    case_id: UUID,
    body: dict | None = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Reopen a closed case (closed_no_action only). MLRO/platform_admin only. Cannot reopen STR-filed cases."""
    from app.models.tenant import UserRole
    tenant_id = _require_tenant(user)
    if user.role not in (UserRole.mlro, UserRole.platform_admin, UserRole.compliance_officer):
        raise ValidationError("Only MLRO or Compliance Officer can reopen cases")

    case = await case_service.get(db, case_id=case_id, tenant_id=tenant_id)
    if case.status != CaseStatus.closed_no_action:
        if case.status == CaseStatus.closed_str_filed:
            raise ValidationError("Cannot reopen a case that has been filed as STR. STR filing is final.")
        raise ValidationError(f"Only closed cases can be reopened. Current status: {case.status.value}")

    case.status = CaseStatus.open
    case.closed_at = None
    await db.flush()

    # Add automatic note documenting the reopen
    reason = (body or {}).get("reason", "Reopened by MLRO")
    note = await case_service.add_note(db, case_id=case_id, tenant_id=tenant_id, user_id=user.id, content=f"[CASE REOPENED] {reason}")

    count = case_service._linked_alerts_count(case)
    return _case_to_response(case, count)


@router.post("/{case_id}/notes", response_model=CaseNoteResponse)
async def add_case_note(
    case_id: UUID,
    body: CaseNoteCreateRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Add note to case."""
    tenant_id = _require_tenant(user)
    note = await case_service.add_note(
        db,
        case_id=case_id,
        tenant_id=tenant_id,
        user_id=user.id,
        content=body.content,
    )
    return CaseNoteResponse(
        id=str(note.id),
        caseId=str(note.case_id),
        userId=str(note.user_id),
        content=note.content,
        createdAt=note.created_at.isoformat(),
    )


@router.post("/{case_id}/alerts/{alert_id}")
async def link_alert_to_case(
    case_id: UUID,
    alert_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Link alert to case."""
    tenant_id = _require_tenant(user)
    await case_service.link_alert(db, case_id=case_id, tenant_id=tenant_id, alert_id=alert_id)
    return {"linked": True}


@router.post("/{case_id}/customers/{customer_id}")
async def link_customer_to_case(
    case_id: UUID,
    customer_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Link customer to case."""
    tenant_id = _require_tenant(user)
    await case_service.link_customer(db, case_id=case_id, tenant_id=tenant_id, customer_id=customer_id)
    return {"linked": True}
