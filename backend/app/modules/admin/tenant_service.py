"""Admin tenant service: list, get, create, patch, delete, rotate API key. Phase 5.8."""

import hashlib
import re
import secrets
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.exceptions import NotFoundError, ValidationError
from app.models.tenant import Tenant, TenantStatus, User


def _slugify(name: str) -> str:
    """Convert name to slug: lowercase, replace non-alnum with hyphens."""
    s = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
    return s or "tenant"


class AdminTenantService:
    async def list(
        self,
        db: AsyncSession,
        limit: int = 50,
        offset: int = 0,
        status: str | None = None,
    ) -> tuple[list[Tenant], int]:
        base = select(Tenant)
        if status:
            base = base.where(Tenant.status == TenantStatus(status))
        count_stmt = select(func.count()).select_from(Tenant)
        if status:
            count_stmt = count_stmt.where(Tenant.status == TenantStatus(status))
        total = (await db.scalar(count_stmt)) or 0
        q = base.order_by(Tenant.created_at.desc()).limit(limit).offset(offset)
        result = await db.execute(q)
        tenants = list(result.scalars().all())
        return tenants, total

    async def get(self, db: AsyncSession, tenant_id: UUID) -> Tenant:
        r = await db.execute(
            select(Tenant)
            .where(Tenant.id == tenant_id)
            .options(selectinload(Tenant.users))
        )
        t = r.scalar_one_or_none()
        if not t:
            raise NotFoundError("Tenant not found")
        return t

    async def create(
        self,
        db: AsyncSession,
        name: str,
        slug: str | None = None,
    ) -> Tenant:
        slug = (slug or _slugify(name)).lower()
        if not slug:
            slug = "tenant"
        existing = await db.execute(select(Tenant).where(Tenant.slug == slug))
        if existing.scalar_one_or_none():
            raise ValidationError(
                f"Tenant with slug '{slug}' already exists",
                details={"slug": slug},
            )
        tenant = Tenant(
            name=name.strip(),
            slug=slug,
            status=TenantStatus.trial,
        )
        db.add(tenant)
        await db.flush()
        return tenant

    async def patch(
        self,
        db: AsyncSession,
        tenant_id: UUID,
        name: str | None = None,
        status: str | None = None,
        feature_flags: dict | None = None,
        webhook_url: str | None = None,
    ) -> Tenant:
        tenant = await self.get(db, tenant_id)
        if name is not None:
            tenant.name = name.strip()
        if status is not None:
            tenant.status = TenantStatus(status)
        if feature_flags is not None:
            tenant.feature_flags = feature_flags
        if webhook_url is not None:
            tenant.webhook_url = webhook_url.strip() or None
        await db.flush()
        return tenant

    async def delete(self, db: AsyncSession, tenant_id: UUID) -> None:
        """Terminate tenant: set status to terminated. Does not hard-delete."""
        tenant = await self.get(db, tenant_id)
        tenant.status = TenantStatus.terminated
        await db.flush()

    async def rotate_api_key(
        self,
        db: AsyncSession,
        tenant_id: UUID,
    ) -> str:
        """Generate new API key, store hash, return plain key (shown once)."""
        tenant = await self.get(db, tenant_id)
        raw_key = f"cip_live_{secrets.token_urlsafe(24)}"
        key_hash = hashlib.sha256(raw_key.encode()).hexdigest()
        tenant.api_key_hash = key_hash
        await db.flush()
        return raw_key

    async def revoke_api_key(self, db: AsyncSession, tenant_id: UUID) -> None:
        """Revoke tenant's API key. Platform admin only."""
        tenant = await self.get(db, tenant_id)
        tenant.api_key_hash = None
        await db.flush()

    async def users_count(self, db: AsyncSession, tenant_id: UUID) -> int:
        r = await db.scalar(
            select(func.count()).select_from(User).where(User.tenant_id == tenant_id)
        )
        return r or 0


admin_tenant_service = AdminTenantService()
