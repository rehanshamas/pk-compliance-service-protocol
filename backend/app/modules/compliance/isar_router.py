"""ISAR (Form A7) API: create, list, get, update, submit, approve, reject, file-as-str.

PVARA-compliant Form A7 with 5 sections:
  1. Reporter Details
  2. Customer Details
  3. Transaction Details
  4. Suspicion Narrative
  5. MLRO Determination
"""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response

from app.core.dependencies import get_current_user
from app.core.exceptions import FeatureDisabledError, NotFoundError
from app.database import get_db
from app.models.tenant import User
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.compliance.schemas import (
    IsarCreateRequest,
    IsarUpdateRequest,
    IsarResponse,
    IsarListResponse,
    IsarApproveRequest,
    IsarRejectRequest,
)
from app.modules.compliance.service import isar_service

router = APIRouter()


def _require_tenant(user: User) -> UUID:
    if not user.tenant_id:
        raise FeatureDisabledError("Platform admins use admin endpoints for ISARs.")
    return user.tenant_id


def _isar_to_response(i) -> IsarResponse:
    return IsarResponse(
        id=str(i.id),
        tenantId=str(i.tenant_id),
        caseId=str(i.case_id) if i.case_id else None,
        subjectCustomerId=str(i.subject_customer_id),
        suspicionType=i.suspicion_type,
        narrative=i.narrative,
        supportingEvidence=i.supporting_evidence,
        status=i.status.value,
        submittedBy=str(i.submitted_by) if i.submitted_by else None,
        reviewedBy=str(i.reviewed_by) if i.reviewed_by else None,
        approvedBy=str(i.approved_by) if i.approved_by else None,
        createdAt=i.created_at.isoformat(),
        approvedAt=i.approved_at.isoformat() if i.approved_at else None,
        filedAt=i.filed_at.isoformat() if i.filed_at else None,
        rejectionRationale=i.rejection_rationale,
        # Form A7 structured sections
        reporterDetails=i.reporter_details,
        customerDetails=i.customer_details,
        transactionDetails=i.transaction_details,
        mlroDetermination=i.mlro_determination,
    )


@router.post("", response_model=IsarResponse, status_code=201)
async def create_isar(
    body: IsarCreateRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Create ISAR draft (Form A7 with all 5 sections)."""
    tenant_id = _require_tenant(user)
    case_id = UUID(body.caseId) if body.caseId else None
    subject_customer_id = UUID(body.subjectCustomerId)

    isar = await isar_service.create(
        db,
        tenant_id=tenant_id,
        case_id=case_id,
        subject_customer_id=subject_customer_id,
        suspicion_type=body.suspicionType,
        narrative=body.narrative,
        supporting_evidence=body.supportingEvidence,
        reporter_details=body.reporterDetails.model_dump(exclude_none=True) if body.reporterDetails else None,
        customer_details=body.customerDetails.model_dump(exclude_none=True) if body.customerDetails else None,
        transaction_details=body.transactionDetails.model_dump(exclude_none=True) if body.transactionDetails else None,
        mlro_determination=body.mlroDetermination.model_dump(exclude_none=True) if body.mlroDetermination else None,
    )
    return _isar_to_response(isar)


@router.patch("/{isar_id}", response_model=IsarResponse)
async def update_isar(
    isar_id: UUID,
    body: IsarUpdateRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Update ISAR draft fields (Form A7 sections). Only drafts can be updated."""
    tenant_id = _require_tenant(user)
    isar = await isar_service.update(
        db,
        isar_id=isar_id,
        tenant_id=tenant_id,
        suspicion_type=body.suspicionType,
        narrative=body.narrative,
        supporting_evidence=body.supportingEvidence,
        reporter_details=body.reporterDetails.model_dump(exclude_none=True) if body.reporterDetails else None,
        customer_details=body.customerDetails.model_dump(exclude_none=True) if body.customerDetails else None,
        transaction_details=body.transactionDetails.model_dump(exclude_none=True) if body.transactionDetails else None,
        mlro_determination=body.mlroDetermination.model_dump(exclude_none=True) if body.mlroDetermination else None,
    )
    return _isar_to_response(isar)


@router.get("", response_model=IsarListResponse)
async def list_isars(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    limit: int = Query(50, le=100, ge=1),
    offset: int = Query(0, ge=0),
    status: str | None = Query(None, description="Filter by status"),
    caseId: str | None = Query(None, description="Filter by case ID"),
):
    """List ISARs for tenant. Filter by status/case."""
    tenant_id = _require_tenant(user)
    case_id = UUID(caseId) if caseId else None
    items, total = await isar_service.list(
        db,
        tenant_id=tenant_id,
        limit=limit,
        offset=offset,
        status=status,
        case_id=case_id,
    )
    return IsarListResponse(items=[_isar_to_response(i) for i in items], total=total)


@router.get("/{isar_id}", response_model=IsarResponse)
async def get_isar(
    isar_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Get single ISAR."""
    tenant_id = _require_tenant(user)
    isar = await isar_service.get(db, isar_id=isar_id, tenant_id=tenant_id)
    return _isar_to_response(isar)


@router.post("/{isar_id}/submit", response_model=IsarResponse)
async def submit_isar_for_review(
    isar_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Submit ISAR for review: draft -> submitted_for_review."""
    tenant_id = _require_tenant(user)
    isar = await isar_service.submit_for_review(
        db, isar_id=isar_id, tenant_id=tenant_id, user_id=user.id
    )
    return _isar_to_response(isar)


@router.post("/{isar_id}/approve", response_model=IsarResponse)
async def approve_isar(
    isar_id: UUID,
    body: IsarApproveRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Approve ISAR: submitted_for_review -> approved. MLRO/platform_admin only."""
    tenant_id = _require_tenant(user)
    isar = await isar_service.approve(
        db,
        isar_id=isar_id,
        tenant_id=tenant_id,
        user_id=user.id,
        user_role=user.role,
        notes=body.notes,
    )
    return _isar_to_response(isar)


@router.post("/{isar_id}/reject", response_model=IsarResponse)
async def reject_isar(
    isar_id: UUID,
    body: IsarRejectRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Reject ISAR: submitted_for_review -> rejected. MLRO/platform_admin only. Rationale required."""
    tenant_id = _require_tenant(user)
    isar = await isar_service.reject(
        db,
        isar_id=isar_id,
        tenant_id=tenant_id,
        user_id=user.id,
        user_role=user.role,
        rejection_rationale=body.rejectionRationale,
    )
    return _isar_to_response(isar)


@router.post("/{isar_id}/revise", response_model=IsarResponse)
async def revise_rejected_isar(
    isar_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Revise a rejected ISAR: rejected -> draft. Allows analyst to fix and resubmit."""
    tenant_id = _require_tenant(user)
    isar = await isar_service.revise_rejected(db, isar_id=isar_id, tenant_id=tenant_id)
    return _isar_to_response(isar)


@router.post("/{isar_id}/file-as-str", response_model=IsarResponse)
async def file_isar_as_str(
    isar_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """File ISAR as STR: approved -> filed_as_str. MLRO/platform_admin only."""
    tenant_id = _require_tenant(user)
    isar = await isar_service.file_as_str(
        db,
        isar_id=isar_id,
        tenant_id=tenant_id,
        user_id=user.id,
        user_role=user.role,
    )
    return _isar_to_response(isar)


@router.get("/{isar_id}/download-pdf")
async def isar_download_pdf(
    isar_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Download ISAR as Form A7 PDF."""
    tenant_id = _require_tenant(user)
    isar = await isar_service.get(db, isar_id=isar_id, tenant_id=tenant_id)
    from app.modules.tenants.service import tenant_service
    tenant = await tenant_service.get_tenant(db, tenant_id)

    try:
        from app.modules.compliance.forms import generate_isar_html
        html = generate_isar_html(isar, tenant)

        from app.core.pdf import html_to_pdf
        pdf_bytes = html_to_pdf(html)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"PDF generation failed: {str(e)}")

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="Form-A7-ISAR-{isar_id}.pdf"'},
    )


@router.get("/{isar_id}/download-docx")
async def isar_download_docx(
    isar_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Download ISAR as Form A7 editable DOCX. MLRO can edit before signing."""
    tenant_id = _require_tenant(user)
    isar = await isar_service.get(db, isar_id=isar_id, tenant_id=tenant_id)
    from app.modules.tenants.service import tenant_service
    tenant = await tenant_service.get_tenant(db, tenant_id)

    customer = None
    if isar.subject_customer_id:
        from app.modules.identity.service import customer_service
        customer = await customer_service.get_by_id(db, isar.subject_customer_id, tenant_id)

    try:
        from app.modules.compliance.forms_docx import generate_isar_docx
        docx_bytes = generate_isar_docx(isar, tenant, customer)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"DOCX generation failed: {str(e)}")

    return Response(
        content=docx_bytes,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={"Content-Disposition": f'attachment; filename="Form-A7-ISAR-{isar_id}.docx"'},
    )
