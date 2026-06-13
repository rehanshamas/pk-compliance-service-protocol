"""Alert service: list, get, patch. Alert creation is in screening flow."""

from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import NotFoundError
from app.models.alert import Alert, AlertSeverity, AlertSourceType, AlertStatus


class AlertService:
    async def list(
        self,
        db: AsyncSession,
        tenant_id: UUID,
        limit: int = 50,
        offset: int = 0,
        severity: str | None = None,
        status: str | None = None,
    ) -> tuple[list[Alert], int]:
        base = select(Alert).where(Alert.tenant_id == tenant_id)
        if severity:
            base = base.where(Alert.severity == AlertSeverity(severity))
        if status:
            base = base.where(Alert.status == AlertStatus(status))

        count_stmt = select(func.count()).select_from(Alert).where(Alert.tenant_id == tenant_id)
        if severity:
            count_stmt = count_stmt.where(Alert.severity == AlertSeverity(severity))
        if status:
            count_stmt = count_stmt.where(Alert.status == AlertStatus(status))
        total = (await db.scalar(count_stmt)) or 0
        q = base.order_by(Alert.created_at.desc()).limit(limit).offset(offset)
        result = await db.execute(q)
        return list(result.scalars().all()), total

    async def get(self, db: AsyncSession, alert_id: UUID, tenant_id: UUID) -> Alert:
        r = await db.execute(
            select(Alert).where(Alert.id == alert_id, Alert.tenant_id == tenant_id)
        )
        a = r.scalar_one_or_none()
        if not a:
            raise NotFoundError("Alert not found")
        return a

    async def patch(
        self,
        db: AsyncSession,
        alert_id: UUID,
        tenant_id: UUID,
        status: str | None = None,
        assigned_to: UUID | None = None,
    ) -> Alert:
        a = await self.get(db, alert_id, tenant_id)
        if status is not None:
            a.status = AlertStatus(status)
            if status in ("resolved", "false_alarm"):
                from datetime import datetime, timezone
                a.resolved_at = datetime.now(timezone.utc)
        if assigned_to is not None:
            a.assigned_to = assigned_to
        await db.flush()
        return a

    async def create_for_screening_result(
        self,
        db: AsyncSession,
        tenant_id: UUID,
        screening_result: "ScreeningResult",
    ) -> Alert | None:
        """Create alert when screening has matches. Returns None if no matches or alert already exists."""
        from app.models.screening import ScreeningResult

        if not screening_result.matches:
            return None

        # Avoid duplicate alert for same screening result (tenant-scoped)
        existing = await db.execute(
            select(Alert).where(
                Alert.tenant_id == tenant_id,
                Alert.source_type == AlertSourceType.screening,
                Alert.source_id == screening_result.id,
            )
        )
        if existing.scalars().first():
            return None

        severity_str = severity_from_screening_match(
            screening_result.matches, screening_result.overall_status.value
        )
        top = screening_result.matches[0]
        source_label = (top.get("source") or "watchlist").upper()
        summary = f"Screening match: {screening_result.screened_entity_name} — {source_label} (score {top.get('score', 0)})"

        alert = Alert(
            tenant_id=tenant_id,
            source_type=AlertSourceType.screening,
            source_id=screening_result.id,
            rule_id=None,
            severity=AlertSeverity(severity_str),
            status=AlertStatus.open,
            summary=summary[:500],
        )
        db.add(alert)
        await db.flush()

        from app.modules.notifications.service import notify_new_alert
        await notify_new_alert(db, tenant_id, alert.id, summary)

        return alert


alert_service = AlertService()


def severity_from_screening_match(matches: list[dict], overall_status: str) -> str:
    """
    Derive alert severity from screening match. Source + score based.
    """
    if not matches:
        return "low"
    top = matches[0]
    score = top.get("score", 0) or 0
    source = (top.get("source") or "").lower()

    # Missing/zero score: treat safely as low (don't over-alert)
    if score <= 0:
        return "low"

    # Sanctions lists: higher base severity
    sanctions = ("un", "ofac", "eu", "nacta")
    is_sanctions = source in sanctions

    if is_sanctions:
        if score >= 90:
            return "critical"
        if score >= 80:
            return "high"
        return "medium"
    # PEP and others
    if score >= 90:
        return "high"
    if score >= 80:
        return "medium"
    return "low"


def create_alert_for_screening_sync(db, tenant_id: UUID, screening_result) -> None:
    """
    Sync helper for Celery batch task. Creates alert when screening has matches.
    Uses SQLAlchemy sync Session.
    """
    from sqlalchemy.orm import Session

    if not screening_result.matches:
        return
    existing = db.execute(
        select(Alert).where(
            Alert.tenant_id == tenant_id,
            Alert.source_type == AlertSourceType.screening,
            Alert.source_id == screening_result.id,
        )
    ).scalars().first()
    if existing:
        return
    severity_str = severity_from_screening_match(
        screening_result.matches, screening_result.overall_status.value
    )
    top = screening_result.matches[0]
    source_label = (top.get("source") or "watchlist").upper()
    summary = f"Screening match: {screening_result.screened_entity_name} — {source_label} (score {top.get('score', 0)})"
    alert = Alert(
        tenant_id=tenant_id,
        source_type=AlertSourceType.screening,
        source_id=screening_result.id,
        rule_id=None,
        severity=AlertSeverity(severity_str),
        status=AlertStatus.open,
        summary=summary[:500],
    )
    db.add(alert)
    db.flush()

    from app.modules.notifications.service import notify_new_alert_sync
    notify_new_alert_sync(db, tenant_id, alert.id, summary[:500])
