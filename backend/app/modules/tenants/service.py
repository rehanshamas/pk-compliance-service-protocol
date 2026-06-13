"""Tenant service: get current tenant for authenticated user."""

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import NotFoundError
from app.models.tenant import Tenant


class TenantService:
    async def get_tenant(self, db: AsyncSession, tenant_id: UUID) -> Tenant:
        result = await db.execute(select(Tenant).where(Tenant.id == tenant_id))
        tenant = result.scalar_one_or_none()
        if not tenant:
            raise NotFoundError("Tenant not found")
        return tenant

    async def update_outsourcing_register(
        self, db: AsyncSession, tenant_id: UUID, register: list[dict]
    ) -> Tenant:
        """Update tenant outsourcing register (Form A5). Phase 5.4."""
        tenant = await self.get_tenant(db, tenant_id)
        tenant.outsourcing_register = register
        await db.flush()
        return tenant


tenant_service = TenantService()
