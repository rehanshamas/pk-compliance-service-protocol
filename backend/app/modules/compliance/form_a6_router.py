"""Form A6 (Annual AML/CFT Return) API. Phase 5.5 / WS-6.

PVARA-compliant 8-section annual return with database-driven metrics
(sections 4-6) and manual input (sections 1-3, 7-8).
"""

from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from fastapi.responses import Response
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user
from app.core.exceptions import FeatureDisabledError, NotFoundError
from app.database import get_db
from app.models.tenant import User
from app.core.usage import record_usage_event_async
from app.modules.tenants.service import tenant_service
from app.modules.compliance.service import form_a6_service
from app.modules.compliance.forms import generate_form_a6_html

router = APIRouter()


def _require_tenant(user: User) -> UUID:
    if not user.tenant_id:
        raise FeatureDisabledError("Platform admins use admin endpoints for Form A6.")
    return user.tenant_id


def _parse_year(year: int) -> tuple[datetime, datetime]:
    """Return (start, end) of year in UTC."""
    start = datetime(year, 1, 1, tzinfo=timezone.utc)
    end = datetime(year, 12, 31, 23, 59, 59, 999999, tzinfo=timezone.utc)
    return start, end


# --- Manual input schemas for sections 1-3, 7 ---


class EntityProfileInput(BaseModel):
    """Section 1: Entity Profile (manual fields)."""
    legalName: str | None = None
    pvaraRegistrationNumber: str | None = None
    keyIndividuals: str | None = None


class GovernanceInput(BaseModel):
    """Section 2: Governance."""
    mlroAnnualStatement: str | None = None
    governanceChanges: str | None = None
    outsourcingChanges: str | None = None


class RiskAssessmentInput(BaseModel):
    """Section 3: Risk Assessment Update."""
    newRisks: str | None = None
    materialChanges: str | None = None
    emergingTrends: str | None = None


class IndependentAuditInput(BaseModel):
    """Section 7: Independent Audit."""
    findingsSummary: str | None = None
    remediationStatus: str | None = None
    outstandingGaps: str | None = None


class FormA6ManualInput(BaseModel):
    """Combined manual input for Form A6 sections 1-3, 7."""
    entityProfile: EntityProfileInput | None = None
    governance: GovernanceInput | None = None
    riskAssessment: RiskAssessmentInput | None = None
    independentAudit: IndependentAuditInput | None = None


class FormA6SubmitRequest(BaseModel):
    """POST body for generating Form A6 with manual input."""
    year: int = Field(..., ge=2020, le=2030)
    manualInput: FormA6ManualInput | None = None


async def _build_stats(db: AsyncSession, tenant_id: UUID, tenant, year: int, manual_input: FormA6ManualInput | None = None) -> dict:
    """Build full stats dict including DB aggregates and manual input."""
    start, end = _parse_year(year)
    training = 0
    if isinstance(tenant.feature_flags, dict):
        training = int(tenant.feature_flags.get("form_a6_training_hours", 0) or 0)
    stats = await form_a6_service.get_stats(db, tenant_id, start, end)
    stats["trainingHours"] = training

    # Inject manual input into stats for HTML generation
    if manual_input:
        mi = {}
        if manual_input.entityProfile:
            mi["entityProfile"] = manual_input.entityProfile.model_dump(exclude_none=True)
        if manual_input.governance:
            mi["governance"] = manual_input.governance.model_dump(exclude_none=True)
        if manual_input.riskAssessment:
            mi["riskAssessment"] = manual_input.riskAssessment.model_dump(exclude_none=True)
        if manual_input.independentAudit:
            mi["independentAudit"] = manual_input.independentAudit.model_dump(exclude_none=True)
        stats["manualInput"] = mi

    return stats


@router.get("/preview")
async def form_a6_preview(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    year: int = Query(..., ge=2020, le=2030, description="Reporting year"),
):
    """Return Form A6 aggregated stats for preview (JSON). DB-driven sections 4-6."""
    tenant_id = _require_tenant(user)
    tenant = await tenant_service.get_tenant(db, tenant_id)
    stats = await _build_stats(db, tenant_id, tenant, year)
    return {
        "tenantName": tenant.name,
        "tenantSlug": tenant.slug,
        "year": year,
        "startDate": _parse_year(year)[0].isoformat(),
        "endDate": _parse_year(year)[1].isoformat(),
        **stats,
    }


@router.get("/download")
async def form_a6_download(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    year: int = Query(..., ge=2020, le=2030, description="Reporting year"),
):
    """Generate and download Form A6 as HTML document (GET, no manual input)."""
    tenant_id = _require_tenant(user)
    tenant = await tenant_service.get_tenant(db, tenant_id)
    stats = await _build_stats(db, tenant_id, tenant, year)
    html = generate_form_a6_html(tenant, stats, year)
    record_usage_event_async(db, tenant_id, "form.a6")
    safe_name = "".join(c if c.isalnum() or c in "-_" else "_" for c in (tenant.slug or tenant.name or "annual-return"))
    filename = f"Form-A6-{safe_name}-{year}.html"
    return Response(
        content=html,
        media_type="text/html",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/download-docx")
async def form_a6_download_docx(
    year: int = Query(ge=2020, le=2030, default=2026),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Download Form A6 (Annual AML/CFT Return) as editable DOCX."""
    tenant_id = _require_tenant(user)
    tenant = await tenant_service.get_tenant(db, tenant_id)
    stats = await _build_stats(db, tenant_id, tenant, year)
    from app.modules.compliance.forms_docx import generate_form_a6_docx
    docx_bytes = generate_form_a6_docx(tenant, stats, year)
    record_usage_event_async(db, tenant_id, "form.a6")
    safe_slug = (tenant.slug or tenant.name or "annual-return").replace("/", "_")
    return Response(
        content=docx_bytes,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={"Content-Disposition": f'attachment; filename="Form-A6-{safe_slug}-{year}.docx"'},
    )


@router.get("/download-pdf")
async def form_a6_download_pdf(
    year: int = Query(ge=2020, le=2030, default=2026),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Download Form A6 (Annual AML/CFT Return) as PDF."""
    tenant_id = _require_tenant(user)
    tenant = await tenant_service.get_tenant(db, tenant_id)
    stats = await _build_stats(db, tenant_id, tenant, year)

    from app.modules.compliance.forms import generate_form_a6_html
    html = generate_form_a6_html(tenant, stats, year)

    from app.core.pdf import html_to_pdf
    pdf_bytes = html_to_pdf(html)

    from app.core.usage import record_usage_event_async
    record_usage_event_async(db, tenant_id, "form.a6")

    safe_slug = (tenant.slug or tenant.name or "form-a6").replace("/", "_")
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="Form-A6-{safe_slug}-{year}.pdf"'},
    )


@router.post("/generate")
async def form_a6_generate(
    body: FormA6SubmitRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Generate Form A6 with manual input for sections 1-3 and 7-8.

    Database metrics for sections 4-6 are automatically aggregated.
    Returns HTML document with all 8 PVARA sections.
    """
    tenant_id = _require_tenant(user)
    tenant = await tenant_service.get_tenant(db, tenant_id)
    stats = await _build_stats(db, tenant_id, tenant, body.year, body.manualInput)
    html = generate_form_a6_html(tenant, stats, body.year)
    record_usage_event_async(db, tenant_id, "form.a6")
    safe_name = "".join(c if c.isalnum() or c in "-_" else "_" for c in (tenant.slug or tenant.name or "annual-return"))
    filename = f"Form-A6-{safe_name}-{body.year}.html"
    return Response(
        content=html,
        media_type="text/html",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
