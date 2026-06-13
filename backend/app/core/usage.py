"""Usage event recording for billable actions (Phase 2.11, 3.9)."""

from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Session

from app.models.usage_event import UsageEvent


def record_usage_event_async(
    db: AsyncSession,
    tenant_id: UUID,
    event_type: str,
    quantity: float = 1.0,
    metadata: dict | None = None,
) -> None:
    """Record a usage event (async)."""
    event = UsageEvent(
        tenant_id=tenant_id,
        event_type=event_type,
        quantity=quantity,
        metadata_=metadata or {},
    )
    db.add(event)


def record_usage_event_sync(
    db: Session,
    tenant_id: UUID,
    event_type: str,
    quantity: float = 1.0,
    metadata: dict | None = None,
) -> None:
    """Record a usage event (sync, for Celery workers)."""
    event = UsageEvent(
        tenant_id=tenant_id,
        event_type=event_type,
        quantity=quantity,
        metadata_=metadata or {},
    )
    db.add(event)
