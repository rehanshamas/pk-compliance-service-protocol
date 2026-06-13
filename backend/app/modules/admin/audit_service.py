"""Admin audit log: cross-tenant search with filters, paginated. Phase 5.10."""

from datetime import datetime, timedelta, timezone
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.audit_log import AuditLog
from app.models.tenant import Tenant, User


class AdminAuditService:
    async def list(
        self,
        db: AsyncSession,
        tenant_id: UUID | None = None,
        action: str | None = None,
        resource_type: str | None = None,
        days: int = 30,
        limit: int = 50,
        offset: int = 0,
    ) -> tuple[list[dict], int]:
        """List audit entries with filters. Returns (items, total)."""
        start = datetime.now(timezone.utc) - timedelta(days=days)

        base = select(AuditLog).where(AuditLog.created_at >= start)
        if tenant_id:
            base = base.where(AuditLog.tenant_id == tenant_id)
        if action:
            base = base.where(AuditLog.action == action)
        if resource_type:
            base = base.where(AuditLog.resource_type == resource_type)

        count_stmt = select(func.count()).select_from(AuditLog).where(AuditLog.created_at >= start)
        if tenant_id:
            count_stmt = count_stmt.where(AuditLog.tenant_id == tenant_id)
        if action:
            count_stmt = count_stmt.where(AuditLog.action == action)
        if resource_type:
            count_stmt = count_stmt.where(AuditLog.resource_type == resource_type)

        total = (await db.scalar(count_stmt)) or 0
        q = base.order_by(AuditLog.created_at.desc()).limit(limit).offset(offset)
        result = await db.execute(q)
        entries = list(result.scalars().all())

        tenant_ids = {e.tenant_id for e in entries if e.tenant_id}
        user_ids = {e.user_id for e in entries if e.user_id}

        tenants: dict[UUID, str] = {}
        if tenant_ids:
            r = await db.execute(select(Tenant.id, Tenant.name).where(Tenant.id.in_(tenant_ids)))
            for row in r.all():
                tenants[row.id] = row.name

        users: dict[UUID, str] = {}
        if user_ids:
            r = await db.execute(select(User.id, User.full_name).where(User.id.in_(user_ids)))
            for row in r.all():
                users[row.id] = row.full_name

        items = []
        for e in entries:
            tenant_name = tenants.get(e.tenant_id, "Platform") if e.tenant_id else "Platform"
            user_name = users.get(e.user_id, "System") if e.user_id else "System"
            items.append({
                "id": str(e.id),
                "tenantId": str(e.tenant_id) if e.tenant_id else None,
                "tenantName": tenant_name,
                "user": user_name,
                "action": e.action,
                "resourceType": e.resource_type,
                "resourceId": str(e.resource_id) if e.resource_id else None,
                "createdAt": e.created_at.isoformat(),
                "payload": e.payload,
            })
        return items, total


admin_audit_service = AdminAuditService()
