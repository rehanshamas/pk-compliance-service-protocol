"""STR/CTR reports API: list, generate, download. Phase 5.3."""

from uuid import UUID

from fastapi import APIRouter, Depends, Query
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user
from app.core.exceptions import FeatureDisabledError
from app.database import get_db
from app.models.tenant import User

from app.modules.compliance.schemas import (
    StrReportResponse,
    StrReportListResponse,
    StrReportGenerateRequest,
)
from app.modules.compliance.service import str_report_service

router = APIRouter()


def _require_tenant(user: User) -> UUID:
    if not user.tenant_id:
        raise FeatureDisabledError("Platform admins use admin endpoints for reports.")
    return user.tenant_id


def _report_to_response(r) -> StrReportResponse:
    return StrReportResponse(
        id=str(r.id),
        tenantId=str(r.tenant_id),
        isarId=str(r.isar_id),
        reportType=r.report_type.value,
        goamlSchemaVersion=r.goaml_schema_version,
        filingStatus=r.filing_status.value,
        createdAt=r.created_at.isoformat(),
    )


@router.get("", response_model=StrReportListResponse)
async def list_str_reports(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    limit: int = Query(50, le=100, ge=1),
    offset: int = Query(0, ge=0),
    reportType: str | None = Query(None, description="Filter: str | ctr"),
):
    """List STR/CTR reports for tenant."""
    tenant_id = _require_tenant(user)
    items, total = await str_report_service.list(
        db, tenant_id=tenant_id, limit=limit, offset=offset, report_type=reportType
    )
    return StrReportListResponse(
        items=[_report_to_response(r) for r in items],
        total=total,
    )


@router.post("/generate", response_model=StrReportResponse, status_code=201)
async def generate_str_report(
    body: StrReportGenerateRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Generate goAML STR XML from an approved or filed ISAR. Stores report for download."""
    tenant_id = _require_tenant(user)
    isar_id = UUID(body.isarId)
    report = await str_report_service.generate_from_isar(
        db,
        isar_id=isar_id,
        tenant_id=tenant_id,
        schema_version=body.schemaVersion,
    )
    return _report_to_response(report)


@router.get("/{report_id}/download")
async def download_str_report(
    report_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Download STR report as XML file for goAML submission."""
    tenant_id = _require_tenant(user)
    report = await str_report_service.get(db, report_id=report_id, tenant_id=tenant_id)
    filename = f"STR-{report.isar_id}.xml"
    return Response(
        content=report.goaml_xml,
        media_type="application/xml",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
