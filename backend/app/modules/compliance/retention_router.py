"""Record retention API. Phase 5.6. GET summary, list, download URL. Deletion blocked within retention."""

from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user
from app.core.exceptions import FeatureDisabledError
from app.database import get_db
from app.models.tenant import User
from app.modules.compliance.retention import retention_service

router = APIRouter()


def _require_tenant(user: User) -> UUID:
    if not user.tenant_id:
        raise FeatureDisabledError("Platform admins use admin endpoints for retention.")
    return user.tenant_id


@router.get("/retention")
async def get_retention_summary(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Return retention policy and record counts for tenant. GET /records/retention."""
    tenant_id = _require_tenant(user)
    return await retention_service.get_summary(db, tenant_id)


@router.get("")
async def list_records(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    limit: int = Query(50, le=100, ge=1),
    offset: int = Query(0, ge=0),
    recordType: str | None = Query(None, description="Filter by record type"),
):
    """List retention-tracked records for tenant."""
    tenant_id = _require_tenant(user)
    items, total = await retention_service.list(
        db, tenant_id, limit=limit, offset=offset, record_type=recordType
    )
    return {
        "items": [
            {
                "id": str(r.id),
                "tenantId": str(r.tenant_id),
                "recordType": r.record_type,
                "recordRefId": str(r.record_ref_id) if r.record_ref_id else None,
                "retentionExpiresAt": r.retention_expires_at.isoformat(),
                "createdAt": r.created_at.isoformat(),
            }
            for r in items
        ],
        "total": total,
    }


@router.get("/{record_id}/download-url")
async def get_download_url(
    record_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    expiresIn: int = Query(3600, ge=60, le=86400),
):
    """Return time-limited presigned URL for record file download."""
    tenant_id = _require_tenant(user)
    record = await retention_service.get(db, record_id, tenant_id)
    url = retention_service.get_download_url(record, expires_in=expiresIn)
    return {"downloadUrl": url, "expiresIn": expiresIn}
