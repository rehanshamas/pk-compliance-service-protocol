"""Notifications API: list, mark read. Phase 5.7."""

from uuid import UUID

from fastapi import APIRouter, Depends, Query

from app.core.dependencies import get_current_user
from app.core.exceptions import FeatureDisabledError
from app.database import get_db
from app.models.tenant import User
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.notifications.schemas import (
    NotificationResponse,
    NotificationListResponse,
    NotificationMarkReadRequest,
)
from app.modules.notifications.service import notification_service

router = APIRouter()


def _require_user(user: User) -> UUID:
    if not user.id:
        raise FeatureDisabledError("User required for notifications.")
    return user.id


def _to_response(n) -> NotificationResponse:
    return NotificationResponse(
        id=str(n.id),
        type=n.type,
        message=n.message,
        timestamp=n.created_at.isoformat(),
        read=n.read,
        link=n.link,
    )


@router.get("", response_model=NotificationListResponse)
async def list_notifications(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    limit: int = Query(50, le=100, ge=1),
    offset: int = Query(0, ge=0),
    unreadOnly: bool = Query(False, description="Filter to unread only"),
):
    """List notifications for current user."""
    user_id = _require_user(user)
    if not user.tenant_id:
        return NotificationListResponse(items=[], total=0, unreadCount=0)
    items, total, unread_count = await notification_service.list(
        db, user_id, limit=limit, offset=offset, unread_only=unreadOnly
    )
    return NotificationListResponse(
        items=[_to_response(n) for n in items],
        total=total,
        unreadCount=unread_count,
    )


@router.post("/mark-read")
async def mark_notifications_read(
    body: NotificationMarkReadRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Mark notifications as read. Pass ids or leave empty to mark all."""
    user_id = _require_user(user)
    ids = [UUID(x) for x in body.ids] if body.ids and len(body.ids) > 0 else None
    count = await notification_service.mark_read(db, user_id, notification_ids=ids)
    return {"markedCount": count}
