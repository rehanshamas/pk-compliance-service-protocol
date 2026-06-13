"""Incident reporting API. PVARA Sandbox Undertaking clauses 8-9."""

from datetime import datetime, timedelta, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user
from app.core.exceptions import NotFoundError, ValidationError
from app.database import get_db
from app.models.tenant import User, UserRole
from app.models.incident import Incident, IncidentSeverity, IncidentCategory, IncidentStatus

router = APIRouter()


def _require_tenant(user: User) -> UUID:
    if not user.tenant_id:
        from app.core.exceptions import FeatureDisabledError
        raise FeatureDisabledError("Platform admins use admin endpoints.")
    return user.tenant_id


def _incident_response(i: Incident) -> dict:
    now = datetime.now(timezone.utc)
    notification_remaining = max(0, (i.notification_deadline - now).total_seconds()) if i.notified_at is None and i.notification_deadline > now else 0
    report_remaining = max(0, (i.report_deadline - now).total_seconds()) if i.report_submitted_at is None and i.report_deadline > now else 0

    return {
        "id": str(i.id),
        "tenantId": str(i.tenant_id),
        "title": i.title,
        "severity": i.severity.value,
        "category": i.category.value,
        "status": i.status.value,
        "description": i.description,
        "detectedAt": i.detected_at.isoformat(),
        "notificationDeadline": i.notification_deadline.isoformat(),
        "notifiedAt": i.notified_at.isoformat() if i.notified_at else None,
        "notificationOverdue": i.notification_overdue,
        "notificationRemainingSeconds": int(notification_remaining),
        "reportDeadline": i.report_deadline.isoformat(),
        "detailedReport": i.detailed_report,
        "reportSubmittedAt": i.report_submitted_at.isoformat() if i.report_submitted_at else None,
        "reportOverdue": i.report_overdue,
        "reportRemainingSeconds": int(report_remaining),
        "affectedCustomersCount": i.affected_customers_count,
        "affectedSystems": i.affected_systems,
        "containmentSteps": i.containment_steps,
        "rootCause": i.root_cause,
        "remediationSteps": i.remediation_steps,
        "preventionMeasures": i.prevention_measures,
        "reportedBy": str(i.reported_by) if i.reported_by else None,
        "resolvedAt": i.resolved_at.isoformat() if i.resolved_at else None,
        "createdAt": i.created_at.isoformat(),
    }


@router.post("", status_code=201)
async def create_incident(
    body: dict,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Report a new incident. Automatically sets 1-hour notification and 48-hour report deadlines."""
    tenant_id = _require_tenant(user)

    now = datetime.now(timezone.utc)
    detected_at = now  # Default to now, can be overridden
    if body.get("detected_at"):
        try:
            detected_at = datetime.fromisoformat(body["detected_at"].replace("Z", "+00:00"))
        except (ValueError, AttributeError):
            pass

    incident = Incident(
        tenant_id=tenant_id,
        title=body.get("title", "Untitled Incident"),
        severity=IncidentSeverity(body.get("severity", "high")),
        category=IncidentCategory(body.get("category", "other")),
        description=body.get("description", ""),
        detected_at=detected_at,
        notification_deadline=detected_at + timedelta(hours=1),
        report_deadline=detected_at + timedelta(hours=48),
        affected_systems=body.get("affected_systems"),
        affected_customers_count=body.get("affected_customers_count"),
        containment_steps=body.get("containment_steps"),
        reported_by=user.id,
    )
    db.add(incident)
    await db.flush()

    # Notify all MLROs
    from app.modules.notifications.service import notification_service
    from sqlalchemy import select as sel
    from app.models.tenant import User as UserModel
    mlros = await db.execute(
        sel(UserModel).where(
            UserModel.tenant_id == tenant_id,
            UserModel.is_active.is_(True),
            UserModel.role.in_([UserRole.mlro, UserRole.compliance_officer]),
        )
    )
    for mlro in mlros.scalars().all():
        await notification_service.create_for_user(
            db, mlro.id, tenant_id, "incident_reported",
            f"INCIDENT: {incident.title} — Severity: {incident.severity.value}. Authority notification due within 1 hour.",
            link=f"/incidents/{incident.id}",
        )

    # Webhook notification
    from app.core.webhooks import get_tenant_webhook_url, deliver_webhook
    import asyncio
    url = await get_tenant_webhook_url(db, tenant_id)
    if url:
        asyncio.create_task(deliver_webhook(url, {
            "event": "incident.reported",
            "data": {
                "incidentId": str(incident.id),
                "title": incident.title,
                "severity": incident.severity.value,
                "category": incident.category.value,
                "notificationDeadline": incident.notification_deadline.isoformat(),
                "reportDeadline": incident.report_deadline.isoformat(),
            },
        }))

    await db.refresh(incident)
    return _incident_response(incident)


@router.get("")
async def list_incidents(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    limit: int = Query(50, le=100),
    offset: int = Query(0, ge=0),
    status: str | None = Query(None),
    severity: str | None = Query(None),
):
    """List incidents for tenant."""
    tenant_id = _require_tenant(user)
    base = select(Incident).where(Incident.tenant_id == tenant_id)
    count_q = select(func.count()).select_from(Incident).where(Incident.tenant_id == tenant_id)

    if status:
        base = base.where(Incident.status == IncidentStatus(status))
        count_q = count_q.where(Incident.status == IncidentStatus(status))
    if severity:
        base = base.where(Incident.severity == IncidentSeverity(severity))
        count_q = count_q.where(Incident.severity == IncidentSeverity(severity))

    total = (await db.scalar(count_q)) or 0
    result = await db.execute(base.order_by(Incident.created_at.desc()).limit(limit).offset(offset))
    items = result.scalars().all()

    return {"items": [_incident_response(i) for i in items], "total": total}


@router.get("/{incident_id}")
async def get_incident(
    incident_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Get incident details."""
    tenant_id = _require_tenant(user)
    result = await db.execute(
        select(Incident).where(Incident.id == incident_id, Incident.tenant_id == tenant_id)
    )
    incident = result.scalar_one_or_none()
    if not incident:
        raise NotFoundError("Incident not found")
    return _incident_response(incident)


@router.post("/{incident_id}/notify-authority")
async def mark_authority_notified(
    incident_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Mark that the authority (PVARA) has been notified. Records timestamp and checks if within 1-hour deadline."""
    tenant_id = _require_tenant(user)
    result = await db.execute(
        select(Incident).where(Incident.id == incident_id, Incident.tenant_id == tenant_id)
    )
    incident = result.scalar_one_or_none()
    if not incident:
        raise NotFoundError("Incident not found")

    now = datetime.now(timezone.utc)
    incident.notified_at = now
    incident.status = IncidentStatus.authority_notified
    incident.notification_overdue = now > incident.notification_deadline
    await db.flush()

    return _incident_response(incident)


@router.post("/{incident_id}/submit-report")
async def submit_detailed_report(
    incident_id: UUID,
    body: dict,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Submit the detailed 48-hour incident report."""
    tenant_id = _require_tenant(user)
    result = await db.execute(
        select(Incident).where(Incident.id == incident_id, Incident.tenant_id == tenant_id)
    )
    incident = result.scalar_one_or_none()
    if not incident:
        raise NotFoundError("Incident not found")

    now = datetime.now(timezone.utc)

    # Update detailed report fields
    incident.detailed_report = {
        "nature_and_scope": body.get("nature_and_scope", ""),
        "timeline_of_events": body.get("timeline_of_events", ""),
        "affected_data_or_systems": body.get("affected_data_or_systems", ""),
        "containment_actions": body.get("containment_actions", ""),
        "root_cause_analysis": body.get("root_cause_analysis", ""),
        "remediation_steps": body.get("remediation_steps", ""),
        "prevention_measures": body.get("prevention_measures", ""),
        "submitted_by": user.full_name,
        "submitted_at": now.isoformat(),
    }
    incident.report_submitted_at = now
    incident.report_overdue = now > incident.report_deadline
    incident.status = IncidentStatus.report_submitted

    # Update fields if provided
    if body.get("root_cause"):
        incident.root_cause = body["root_cause"]
    if body.get("remediation_steps"):
        incident.remediation_steps = body["remediation_steps"]
    if body.get("prevention_measures"):
        incident.prevention_measures = body["prevention_measures"]
    if body.get("affected_customers_count") is not None:
        incident.affected_customers_count = body["affected_customers_count"]

    await db.flush()
    return _incident_response(incident)


@router.patch("/{incident_id}")
async def update_incident(
    incident_id: UUID,
    body: dict,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Update incident details (containment, root cause, resolution)."""
    tenant_id = _require_tenant(user)
    result = await db.execute(
        select(Incident).where(Incident.id == incident_id, Incident.tenant_id == tenant_id)
    )
    incident = result.scalar_one_or_none()
    if not incident:
        raise NotFoundError("Incident not found")

    for field in ["title", "description", "containment_steps", "root_cause", "remediation_steps", "prevention_measures", "affected_systems"]:
        if field in body and body[field] is not None:
            setattr(incident, field, body[field])

    if "affected_customers_count" in body:
        incident.affected_customers_count = body["affected_customers_count"]

    if "status" in body:
        new_status = IncidentStatus(body["status"])
        incident.status = new_status
        if new_status == IncidentStatus.resolved:
            incident.resolved_at = datetime.now(timezone.utc)

    if "severity" in body:
        incident.severity = IncidentSeverity(body["severity"])

    await db.flush()
    return _incident_response(incident)


@router.post("/{incident_id}/resolve")
async def resolve_incident(
    incident_id: UUID,
    body: dict | None = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Mark incident as resolved."""
    tenant_id = _require_tenant(user)
    result = await db.execute(
        select(Incident).where(Incident.id == incident_id, Incident.tenant_id == tenant_id)
    )
    incident = result.scalar_one_or_none()
    if not incident:
        raise NotFoundError("Incident not found")

    incident.status = IncidentStatus.resolved
    incident.resolved_at = datetime.now(timezone.utc)
    if body and body.get("resolution_notes"):
        incident.prevention_measures = (incident.prevention_measures or "") + "\n\nResolution: " + body["resolution_notes"]

    await db.flush()
    return _incident_response(incident)
