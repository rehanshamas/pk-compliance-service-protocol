"""Record retention service. Phase 5.6. 7-year lifecycle, deletion blocked within retention."""

import hashlib
from datetime import datetime, timedelta, timezone
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import NotFoundError, ValidationError
from app.core.storage import generate_presigned_download_url
from app.modules.compliance.models import Record


def compute_content_hash(content: bytes) -> str:
    """Compute SHA-256 hash for tamper-evidence (Reg. 13.2)."""
    return hashlib.sha256(content).hexdigest()


RETENTION_YEARS = 7


class RetentionService:
    """Store, retrieve, and manage retention-tracked records. Deletion blocked within 7-year period."""

    async def get_summary(
        self,
        db: AsyncSession,
        tenant_id: UUID,
    ) -> dict:
        """Return retention summary for tenant: policy, counts by type."""
        total_stmt = select(func.count()).select_from(Record).where(Record.tenant_id == tenant_id)
        total = (await db.scalar(total_stmt)) or 0

        # Count by record_type
        type_stmt = (
            select(Record.record_type, func.count())
            .where(Record.tenant_id == tenant_id)
            .group_by(Record.record_type)
        )
        result = await db.execute(type_stmt)
        by_type = {row[0]: row[1] for row in result.fetchall()}

        return {
            "retentionYears": RETENTION_YEARS,
            "totalRecords": total,
            "recordsByType": by_type,
            "policy": "7-year retention per AMLA 2010 and NOC Regulations. Deletion blocked within retention period.",
        }

    async def register(
        self,
        db: AsyncSession,
        tenant_id: UUID,
        record_type: str,
        file_key: str,
        *,
        record_ref_id: UUID | None = None,
        retention_years: int = RETENTION_YEARS,
        content: bytes | None = None,
    ) -> Record:
        """Register a record for retention tracking. retention_expires_at = created_at + retention_years.

        If `content` is provided, computes a SHA-256 hash for tamper-evidence (Reg. 13.2).
        """
        now = datetime.now(timezone.utc)
        expires_at = now + timedelta(days=retention_years * 365)
        content_hash = compute_content_hash(content) if content else None
        record = Record(
            tenant_id=tenant_id,
            record_type=record_type,
            record_ref_id=record_ref_id,
            file_key=file_key,
            content_hash=content_hash,
            retention_expires_at=expires_at,
        )
        db.add(record)
        await db.flush()
        return record

    async def list(
        self,
        db: AsyncSession,
        tenant_id: UUID,
        limit: int = 50,
        offset: int = 0,
        record_type: str | None = None,
    ) -> tuple[list[Record], int]:
        """List retention records for tenant."""
        base = select(Record).where(Record.tenant_id == tenant_id)
        if record_type:
            base = base.where(Record.record_type == record_type)
        count_stmt = select(func.count()).select_from(Record).where(Record.tenant_id == tenant_id)
        if record_type:
            count_stmt = count_stmt.where(Record.record_type == record_type)
        total = (await db.scalar(count_stmt)) or 0
        q = base.order_by(Record.created_at.desc()).limit(limit).offset(offset)
        result = await db.execute(q)
        return list(result.scalars().unique().all()), total

    async def get(self, db: AsyncSession, record_id: UUID, tenant_id: UUID) -> Record:
        """Get single record."""
        r = await db.execute(
            select(Record).where(Record.id == record_id, Record.tenant_id == tenant_id)
        )
        record = r.scalar_one_or_none()
        if not record:
            raise NotFoundError("Record not found")
        return record

    def get_download_url(self, record: Record, expires_in: int = 3600) -> str:
        """Return presigned URL for record file."""
        return generate_presigned_download_url(record.file_key, expires_in=expires_in)

    async def delete(self, db: AsyncSession, record_id: UUID, tenant_id: UUID) -> None:
        """Delete record. Blocks if retention period has not expired."""
        record = await self.get(db, record_id, tenant_id)
        now = datetime.now(timezone.utc)
        if record.retention_expires_at > now:
            raise ValidationError(
                "Record cannot be deleted: retention period has not expired",
                details={
                    "retentionExpiresAt": record.retention_expires_at.isoformat(),
                    "retentionYears": RETENTION_YEARS,
                },
            )
        await db.delete(record)
        await db.flush()


retention_service = RetentionService()
