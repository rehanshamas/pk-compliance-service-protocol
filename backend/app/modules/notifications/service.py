"""Notification service: create, list, mark read. Triggers: alert, ISAR, deadline, SLA. Phase 5.7."""

from __future__ import annotations

from uuid import UUID

from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import NotFoundError
from app.models.notification import Notification
from app.models.tenant import User, UserRole


class NotificationService:
    async def create_for_user(
        self,
        db: AsyncSession,
        user_id: UUID,
        tenant_id: UUID,
        ntype: str,
        message: str,
        link: str | None = None,
    ) -> Notification:
        n = Notification(
            user_id=user_id,
            tenant_id=tenant_id,
            type=ntype,
            message=message[:500],
            link=link,
        )
        db.add(n)
        await db.flush()
        return n

    async def create_for_tenant_mlros(
        self,
        db: AsyncSession,
        tenant_id: UUID,
        ntype: str,
        message: str,
        link: str | None = None,
        send_email: bool = True,
    ) -> list[Notification]:
        """Create in-app notifications for all MLRO and compliance_officer users in tenant."""
        from app.adapters.email import send_email as do_send_email

        r = await db.execute(
            select(User)
            .where(User.tenant_id == tenant_id, User.is_active)
            .where(User.role.in_([UserRole.mlro, UserRole.compliance_officer]))
        )
        users = list(r.scalars().all())
        created = []
        for u in users:
            n = await self.create_for_user(db, u.id, tenant_id, ntype, message, link)
            created.append(n)
            if send_email:
                do_send_email(
                    u.email,
                    f"CIP: {ntype}",
                    message,
                    body_html=f"<p>{message}</p><p><a href=\"{link or '#'}\">View</a></p>" if link else None,
                )
        return created

    async def list(
        self,
        db: AsyncSession,
        user_id: UUID,
        limit: int = 50,
        offset: int = 0,
        unread_only: bool = False,
    ) -> tuple[list[Notification], int, int]:
        base = select(Notification).where(Notification.user_id == user_id)
        if unread_only:
            base = base.where(Notification.read == False)

        count_stmt = select(func.count()).select_from(Notification).where(Notification.user_id == user_id)
        unread_stmt = select(func.count()).select_from(Notification).where(
            Notification.user_id == user_id, Notification.read == False
        )
        total = (await db.scalar(count_stmt)) or 0
        unread_count = (await db.scalar(unread_stmt)) or 0

        q = base.order_by(Notification.created_at.desc()).limit(limit).offset(offset)
        result = await db.execute(q)
        return list(result.scalars().all()), total, unread_count

    async def mark_read(
        self, db: AsyncSession, user_id: UUID, notification_ids: list[UUID] | None = None
    ) -> int:
        if notification_ids:
            await db.execute(
                update(Notification)
                .where(
                    Notification.user_id == user_id,
                    Notification.id.in_(notification_ids),
                )
                .values(read=True)
            )
            return len(notification_ids)
        r = await db.execute(
            update(Notification).where(Notification.user_id == user_id).values(read=True)
        )
        return r.rowcount or 0


notification_service = NotificationService()


async def notify_new_alert(db: AsyncSession, tenant_id: UUID, alert_id: UUID, summary: str) -> None:
    """Trigger: new alert created. Notify MLROs."""
    link = f"/cases?alert={alert_id}"
    await notification_service.create_for_tenant_mlros(
        db, tenant_id, "new_alert", f"New alert: {summary}", link=link, send_email=True
    )


async def notify_isar_pending_review(db: AsyncSession, tenant_id: UUID, isar_id: UUID, case_ref: str) -> None:
    """Trigger: ISAR submitted for review."""
    link = f"/reports/isars/{isar_id}"
    await notification_service.create_for_tenant_mlros(
        db, tenant_id, "isar_pending_review",
        f"ISAR pending review: {case_ref}", link=link, send_email=True
    )


async def notify_deadline_approaching(db: AsyncSession, user_id: UUID, tenant_id: UUID, msg: str, link: str | None) -> None:
    """Trigger: deadline approaching."""
    await notification_service.create_for_user(db, user_id, tenant_id, "deadline_approaching", msg, link)


async def notify_case_sla(db: AsyncSession, tenant_id: UUID, case_id: UUID, msg: str) -> None:
    """Trigger: case SLA breach/warning."""
    link = f"/cases/{case_id}"
    await notification_service.create_for_tenant_mlros(db, tenant_id, "case_sla", msg, link=link, send_email=True)


def notify_new_alert_sync(db, tenant_id: UUID, alert_id: UUID, summary: str) -> None:
    """Sync version for Celery batch task. Creates in-app notifications + emails for MLROs."""
    from sqlalchemy import select
    from app.adapters.email import send_email as do_send_email

    r = db.execute(
        select(User)
        .where(User.tenant_id == tenant_id, User.is_active)
        .where(User.role.in_([UserRole.mlro, UserRole.compliance_officer]))
    )
    users = list(r.scalars().all())
    link = f"/cases?alert={alert_id}"
    msg = f"New alert: {summary}"
    for u in users:
        n = Notification(
            user_id=u.id,
            tenant_id=tenant_id,
            type="new_alert",
            message=msg[:500],
            link=link,
        )
        db.add(n)
        do_send_email(u.email, "CIP: new_alert", msg, body_html=f"<p>{msg}</p><p><a href=\"{link}\">View</a></p>")
    db.flush()
