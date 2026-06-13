"""Notification API schemas. Phase 5.7."""

from pydantic import BaseModel


class NotificationResponse(BaseModel):
    id: str
    type: str
    message: str
    timestamp: str
    read: bool
    link: str | None = None


class NotificationListResponse(BaseModel):
    items: list[NotificationResponse]
    total: int
    unreadCount: int


class NotificationMarkReadRequest(BaseModel):
    ids: list[str] | None = None  # None = mark all as read
