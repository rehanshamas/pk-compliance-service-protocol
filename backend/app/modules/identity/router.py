"""Identity/KYC routes: customer CRUD. Tenant-scoped."""

from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, Query, UploadFile
from sqlalchemy import select, func

from app.core.dependencies import get_current_user
from app.core.exceptions import FeatureDisabledError
from app.database import get_db
from app.models.tenant import User, UserRole
from app.core.exceptions import NotFoundError, AuthorizationError
from app.modules.identity.models import FreezeRecord, KycStatus
from app.modules.identity.schemas import (
    CustomerCreate,
    CustomerDetail,
    CustomerListResponse,
    CustomerUpdate,
    DocumentDetail,
    DocumentListResponse,
    EddApproveRequest,
    EddCaseDetail,
    EddRejectRequest,
    EddSubmitSourceOfFunds,
    FreezeRecordDetail,
    FreezeRecordListResponse,
    FreezeRequest,
    RunKycResponse,
    ShuftiPendingDetail,
    UnfreezeRequest,
    VerificationResultDetail,
    VerificationResultListResponse,
)
from app.modules.identity.service import customer_service, document_service
from app.modules.identity.edd_service import edd_service
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter()


def _require_tenant(user: User) -> UUID:
    if not user.tenant_id:
        raise FeatureDisabledError("Platform admins use admin endpoints for customers.")
    return user.tenant_id


@router.get("/onboarding-stats")
async def onboarding_stats(
    days: int = Query(14, ge=1, le=90),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Daily KYC onboarding counts for the last N days (for overview chart)."""
    from datetime import datetime, timedelta, timezone
    from sqlalchemy import func, cast, Date
    from app.modules.identity.models import Customer

    tenant_id = _require_tenant(user)
    since = datetime.now(timezone.utc) - timedelta(days=days)
    result = await db.execute(
        select(
            cast(Customer.created_at, Date).label("date"),
            func.count().label("count"),
        )
        .where(Customer.tenant_id == tenant_id, Customer.created_at >= since)
        .group_by(cast(Customer.created_at, Date))
        .order_by(cast(Customer.created_at, Date))
    )
    rows = result.all()
    return {
        "status": "success",
        "data": [{"date": str(r.date), "count": r.count} for r in rows],
    }


@router.get("", response_model=CustomerListResponse)
async def list_customers(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    limit: int = Query(50, le=100, ge=1),
    offset: int = Query(0, ge=0),
    status: str | None = Query(None, description="Filter by kyc_status"),
    risk_tier: str | None = Query(None, description="Filter by risk_tier"),
    search: str | None = Query(None, description="Search by name or CNIC"),
):
    """List customers for tenant."""
    tenant_id = _require_tenant(user)
    items, total = await customer_service.list(
        db,
        tenant_id=tenant_id,
        limit=limit,
        offset=offset,
        kyc_status=status,
        risk_tier=risk_tier,
        search=search,
    )
    return CustomerListResponse(
        items=[
            CustomerDetail(
                id=str(c.id),
                tenantId=str(c.tenant_id),
                externalRef=c.external_ref,
                fullName=c.full_name,
                dob=c.dob.isoformat() if c.dob else None,
                nationality=c.nationality,
                cnicNumber=c.cnic_number,
                businessPurpose=c.business_purpose,
                expectedActivity=c.expected_activity,
                riskTier=c.risk_tier.value,
                kycStatus=c.kyc_status.value,
                createdAt=c.created_at.isoformat(),
                updatedAt=c.updated_at.isoformat(),
            )
            for c in items
        ],
        total=total,
    )


@router.get("/{customer_id}", response_model=CustomerDetail)
async def get_customer(
    customer_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Get customer by ID. Tenant-isolated."""
    tenant_id = _require_tenant(user)
    customer = await customer_service.get_by_id(db, customer_id=customer_id, tenant_id=tenant_id)
    if not customer:
        raise NotFoundError(f"Customer {customer_id} not found")
    return CustomerDetail(
        id=str(customer.id),
        tenantId=str(customer.tenant_id),
        externalRef=customer.external_ref,
        fullName=customer.full_name,
        dob=customer.dob.isoformat() if customer.dob else None,
        nationality=customer.nationality,
        cnicNumber=customer.cnic_number,
        businessPurpose=customer.business_purpose,
        expectedActivity=customer.expected_activity,
        riskTier=customer.risk_tier.value,
        kycStatus=customer.kyc_status.value,
        createdAt=customer.created_at.isoformat(),
        updatedAt=customer.updated_at.isoformat(),
    )


@router.get("/{customer_id}/documents", response_model=DocumentListResponse)
async def list_documents(
    customer_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """List documents for customer. Tenant-isolated."""
    tenant_id = _require_tenant(user)
    docs = await document_service.list_documents(db, customer_id=customer_id, tenant_id=tenant_id)
    return DocumentListResponse(
        items=[
            DocumentDetail(
                id=str(d.id),
                customerId=str(d.customer_id),
                documentType=d.document_type.value,
                fileKey=d.file_key,
                contentType=d.content_type,
                fileSizeBytes=d.file_size_bytes,
                ocrData=d.ocr_data,
                createdAt=d.created_at.isoformat(),
            )
            for d in docs
        ]
    )


@router.get("/{customer_id}/verification-results", response_model=VerificationResultListResponse)
async def list_verification_results(
    customer_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """List verification results (OCR, face match, etc.) for customer."""
    tenant_id = _require_tenant(user)
    results = await document_service.list_verification_results(
        db, customer_id=customer_id, tenant_id=tenant_id
    )
    return VerificationResultListResponse(
        items=[
            VerificationResultDetail(
                id=str(r.id),
                customerId=str(r.customer_id),
                verificationType=r.verification_type.value,
                provider=r.provider,
                status=r.status.value,
                confidenceScore=r.confidence_score,
                rawResponse=r.raw_response,
                createdAt=r.created_at.isoformat(),
            )
            for r in results
        ]
    )


@router.post(
    "/{customer_id}/verify-nadra",
    response_model=VerificationResultDetail | ShuftiPendingDetail,
    status_code=201,
    summary="Run identity verification (NADRA or Shufti e-IDV)",
)
async def verify_nadra(
    customer_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    Run identity verification. Provider from IDENTITY_VERIFICATION_PROVIDER (nadra | shufti).
    - NADRA: Synchronous. Returns VerificationResult.
    - Shufti: Async. Returns verificationUrl for user to complete; callback creates result.
    """
    tenant_id = _require_tenant(user)
    result = await customer_service.verify_nadra(
        db, customer_id=customer_id, tenant_id=tenant_id
    )
    if isinstance(result, dict):
        return ShuftiPendingDetail(**result)
    return VerificationResultDetail(
        id=str(result.id),
        customerId=str(result.customer_id),
        verificationType=result.verification_type.value,
        provider=result.provider,
        status=result.status.value,
        confidenceScore=result.confidence_score,
        rawResponse=result.raw_response,
        createdAt=result.created_at.isoformat(),
    )


@router.post("/{customer_id}/run-kyc", response_model=RunKycResponse)
async def run_kyc(
    customer_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Run CDD orchestrator: NADRA and/or risk scoring as applicable."""
    tenant_id = _require_tenant(user)
    customer, steps_run = await customer_service.run_kyc_pipeline(
        db, customer_id=customer_id, tenant_id=tenant_id
    )
    msg = (
        f"Ran: {', '.join(steps_run)}"
        if steps_run
        else "No automated steps to run. Upload documents, verify NADRA, or complete liveness to advance."
    )
    return RunKycResponse(
        customer=CustomerDetail(
            id=str(customer.id),
            tenantId=str(customer.tenant_id),
            externalRef=customer.external_ref,
            fullName=customer.full_name,
            dob=customer.dob.isoformat() if customer.dob else None,
            nationality=customer.nationality,
            cnicNumber=customer.cnic_number,
            riskTier=customer.risk_tier.value,
            kycStatus=customer.kyc_status.value,
            createdAt=customer.created_at.isoformat(),
            updatedAt=customer.updated_at.isoformat(),
        ),
        stepsRun=steps_run,
        message=msg,
    )


@router.post("/{customer_id}/score-risk", response_model=CustomerDetail)
async def score_risk(
    customer_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Run risk scoring for customer. Updates risk_tier, advances liveness_checked -> risk_scored."""
    tenant_id = _require_tenant(user)
    customer = await customer_service.score_risk(
        db, customer_id=customer_id, tenant_id=tenant_id
    )
    return CustomerDetail(
        id=str(customer.id),
        tenantId=str(customer.tenant_id),
        externalRef=customer.external_ref,
        fullName=customer.full_name,
        dob=customer.dob.isoformat() if customer.dob else None,
        nationality=customer.nationality,
        cnicNumber=customer.cnic_number,
        businessPurpose=customer.business_purpose,
        expectedActivity=customer.expected_activity,
        riskTier=customer.risk_tier.value,
        kycStatus=customer.kyc_status.value,
        createdAt=customer.created_at.isoformat(),
        updatedAt=customer.updated_at.isoformat(),
    )


@router.get("/{customer_id}/edd", response_model=EddCaseDetail)
async def get_edd_case(
    customer_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Get EDD case for customer. Returns 404 if no EDD case."""
    tenant_id = _require_tenant(user)
    edd = await edd_service.get_edd_case(db, customer_id=customer_id, tenant_id=tenant_id)
    if not edd:
        raise NotFoundError("EDD case not found")
    return EddCaseDetail(
        id=str(edd.id),
        customerId=str(edd.customer_id),
        sourceOfFunds=edd.source_of_funds,
        sourceOfFundsVerified=edd.source_of_funds_verified,
        approvalStatus=edd.approval_status.value,
        approvedBy=str(edd.approved_by) if edd.approved_by else None,
        approvedAt=edd.approved_at.isoformat() if edd.approved_at else None,
        approvalNotes=edd.approval_notes,
        createdAt=edd.created_at.isoformat(),
        updatedAt=edd.updated_at.isoformat(),
    )


@router.post("/{customer_id}/start-edd", response_model=EddCaseDetail, status_code=201)
async def start_edd(
    customer_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Start EDD: edd_required -> edd_in_progress. Creates EddCase."""
    tenant_id = _require_tenant(user)
    customer, edd_case = await edd_service.start_edd(db, customer_id=customer_id, tenant_id=tenant_id)
    return EddCaseDetail(
        id=str(edd_case.id),
        customerId=str(edd_case.customer_id),
        sourceOfFunds=edd_case.source_of_funds,
        sourceOfFundsVerified=edd_case.source_of_funds_verified,
        approvalStatus=edd_case.approval_status.value,
        approvedBy=str(edd_case.approved_by) if edd_case.approved_by else None,
        approvedAt=edd_case.approved_at.isoformat() if edd_case.approved_at else None,
        approvalNotes=edd_case.approval_notes,
        createdAt=edd_case.created_at.isoformat(),
        updatedAt=edd_case.updated_at.isoformat(),
    )


@router.patch("/{customer_id}/edd", response_model=EddCaseDetail)
async def submit_source_of_funds(
    customer_id: UUID,
    body: EddSubmitSourceOfFunds,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Submit source of funds for EDD case."""
    tenant_id = _require_tenant(user)
    edd = await edd_service.submit_source_of_funds(
        db, customer_id=customer_id, tenant_id=tenant_id, **body.model_dump()
    )
    return EddCaseDetail(
        id=str(edd.id),
        customerId=str(edd.customer_id),
        sourceOfFunds=edd.source_of_funds,
        sourceOfFundsVerified=edd.source_of_funds_verified,
        approvalStatus=edd.approval_status.value,
        approvedBy=str(edd.approved_by) if edd.approved_by else None,
        approvedAt=edd.approved_at.isoformat() if edd.approved_at else None,
        approvalNotes=edd.approval_notes,
        createdAt=edd.created_at.isoformat(),
        updatedAt=edd.updated_at.isoformat(),
    )


@router.post("/{customer_id}/edd/approve", response_model=CustomerDetail)
async def approve_edd(
    customer_id: UUID,
    body: EddApproveRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Senior management approval. MLRO/platform_admin only. Customer -> approved."""
    tenant_id = _require_tenant(user)
    customer, _ = await edd_service.approve(
        db, customer_id=customer_id, tenant_id=tenant_id,
        user_id=user.id, user_role=user.role, notes=body.notes
    )
    return CustomerDetail(
        id=str(customer.id),
        tenantId=str(customer.tenant_id),
        externalRef=customer.external_ref,
        fullName=customer.full_name,
        dob=customer.dob.isoformat() if customer.dob else None,
        nationality=customer.nationality,
        cnicNumber=customer.cnic_number,
        businessPurpose=customer.business_purpose,
        expectedActivity=customer.expected_activity,
        riskTier=customer.risk_tier.value,
        kycStatus=customer.kyc_status.value,
        createdAt=customer.created_at.isoformat(),
        updatedAt=customer.updated_at.isoformat(),
    )


@router.post("/{customer_id}/edd/reject", response_model=CustomerDetail)
async def reject_edd(
    customer_id: UUID,
    body: EddRejectRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Senior management rejection. MLRO/platform_admin only. Customer -> rejected."""
    tenant_id = _require_tenant(user)
    customer, _ = await edd_service.reject(
        db, customer_id=customer_id, tenant_id=tenant_id,
        user_id=user.id, user_role=user.role, notes=body.notes
    )
    return CustomerDetail(
        id=str(customer.id),
        tenantId=str(customer.tenant_id),
        externalRef=customer.external_ref,
        fullName=customer.full_name,
        dob=customer.dob.isoformat() if customer.dob else None,
        nationality=customer.nationality,
        cnicNumber=customer.cnic_number,
        businessPurpose=customer.business_purpose,
        expectedActivity=customer.expected_activity,
        riskTier=customer.risk_tier.value,
        kycStatus=customer.kyc_status.value,
        createdAt=customer.created_at.isoformat(),
        updatedAt=customer.updated_at.isoformat(),
    )


@router.post("", response_model=CustomerDetail, status_code=201)
async def create_customer(
    body: CustomerCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Create customer, start KYC."""
    tenant_id = _require_tenant(user)
    dob_parsed = None
    if body.dob:
        from datetime import datetime
        try:
            dob_parsed = datetime.strptime(body.dob, "%Y-%m-%d").date()
        except ValueError:
            pass  # Keep None if invalid format
    customer = await customer_service.create(
        db,
        tenant_id=tenant_id,
        external_ref=body.external_ref,
        full_name=body.full_name,
        dob=dob_parsed,
        nationality=body.nationality,
        cnic_number=body.cnic_number,
        business_purpose=body.business_purpose,
        expected_activity=body.expected_activity,
    )
    return CustomerDetail(
        id=str(customer.id),
        tenantId=str(customer.tenant_id),
        externalRef=customer.external_ref,
        fullName=customer.full_name,
        dob=customer.dob.isoformat() if customer.dob else None,
        nationality=customer.nationality,
        cnicNumber=customer.cnic_number,
        businessPurpose=customer.business_purpose,
        expectedActivity=customer.expected_activity,
        riskTier=customer.risk_tier.value,
        kycStatus=customer.kyc_status.value,
        createdAt=customer.created_at.isoformat(),
        updatedAt=customer.updated_at.isoformat(),
    )


@router.patch("/{customer_id}", response_model=CustomerDetail)
async def update_customer(
    customer_id: UUID,
    body: CustomerUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Update customer. Tenant-isolated."""
    tenant_id = _require_tenant(user)
    payload = body.model_dump(exclude_unset=True)
    if "dob" in payload and payload["dob"]:
        from datetime import datetime
        try:
            payload["dob"] = datetime.strptime(payload["dob"], "%Y-%m-%d").date()
        except (ValueError, TypeError):
            payload.pop("dob", None)
    elif "dob" in payload and payload["dob"] is None:
        payload["dob"] = None
    customer = await customer_service.update(
        db,
        customer_id=customer_id,
        tenant_id=tenant_id,
        **payload,
    )
    return CustomerDetail(
        id=str(customer.id),
        tenantId=str(customer.tenant_id),
        externalRef=customer.external_ref,
        fullName=customer.full_name,
        dob=customer.dob.isoformat() if customer.dob else None,
        nationality=customer.nationality,
        cnicNumber=customer.cnic_number,
        businessPurpose=customer.business_purpose,
        expectedActivity=customer.expected_activity,
        riskTier=customer.risk_tier.value,
        kycStatus=customer.kyc_status.value,
        createdAt=customer.created_at.isoformat(),
        updatedAt=customer.updated_at.isoformat(),
    )


@router.post("/{customer_id}/documents", response_model=DocumentDetail, status_code=201)
async def upload_document(
    customer_id: UUID,
    document_type: str = Form(..., description="cnic, passport, driving_license, or selfie"),
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Upload identity document for customer. On first doc, transitions initiated -> documents_uploaded."""
    tenant_id = _require_tenant(user)
    content = await file.read()
    content_type = file.content_type or "application/octet-stream"
    doc = await document_service.upload(
        db,
        customer_id=customer_id,
        tenant_id=tenant_id,
        document_type=document_type,
        file_content=content,
        content_type=content_type,
    )
    return DocumentDetail(
        id=str(doc.id),
        customerId=str(doc.customer_id),
        documentType=doc.document_type.value,
        fileKey=doc.file_key,
        contentType=doc.content_type,
        fileSizeBytes=doc.file_size_bytes,
        ocrData=doc.ocr_data,
        createdAt=doc.created_at.isoformat(),
    )


# ---------------------------------------------------------------------------
# Asset Freeze endpoints — PVARA NOC Regulation 12.2
# ---------------------------------------------------------------------------

def _freeze_detail(fr: FreezeRecord) -> FreezeRecordDetail:
    """Map a FreezeRecord ORM object to its Pydantic response."""
    return FreezeRecordDetail(
        id=str(fr.id),
        tenantId=str(fr.tenant_id),
        customerId=str(fr.customer_id),
        screeningResultId=str(fr.screening_result_id) if fr.screening_result_id else None,
        alertId=str(fr.alert_id) if fr.alert_id else None,
        freezeType=fr.freeze_type,
        matchedList=fr.matched_list,
        matchedName=fr.matched_name,
        matchScore=fr.match_score,
        status=fr.status,
        frozenAt=fr.frozen_at.isoformat(),
        reportedToFmuAt=fr.reported_to_fmu_at.isoformat() if fr.reported_to_fmu_at else None,
        unfrozenAt=fr.unfrozen_at.isoformat() if fr.unfrozen_at else None,
        unfreezeReason=fr.unfreeze_reason,
        frozenBy=str(fr.frozen_by) if fr.frozen_by else None,
        notes=fr.notes,
        createdAt=fr.created_at.isoformat(),
        updatedAt=fr.updated_at.isoformat(),
    )


@router.post("/{customer_id}/freeze", response_model=FreezeRecordDetail, status_code=201)
async def freeze_customer(
    customer_id: UUID,
    body: FreezeRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Freeze customer assets per PVARA Reg. 12.2. Sets kyc_status to frozen, creates FreezeRecord."""
    # Only MLRO, Compliance Officer, or platform admin can freeze
    if user.role not in (UserRole.mlro, UserRole.compliance_officer, UserRole.platform_admin):
        raise AuthorizationError("Only MLRO or Compliance Officer can freeze customer accounts")
    tenant_id = _require_tenant(user)
    customer = await customer_service.get_by_id(db, customer_id=customer_id, tenant_id=tenant_id)
    if not customer:
        raise NotFoundError(f"Customer {customer_id} not found")

    # Set customer status to frozen
    old_status = customer.kyc_status.value if hasattr(customer.kyc_status, "value") else str(customer.kyc_status)
    customer.kyc_status = KycStatus.frozen
    await db.flush()

    # Create freeze record
    fr = FreezeRecord(
        tenant_id=tenant_id,
        customer_id=customer_id,
        screening_result_id=UUID(body.screening_result_id) if body.screening_result_id else None,
        alert_id=UUID(body.alert_id) if body.alert_id else None,
        freeze_type=body.freeze_type,
        matched_list=body.matched_list,
        matched_name=body.matched_name,
        match_score=body.match_score,
        status="frozen",
        frozen_by=user.id,
        notes=body.notes,
    )
    db.add(fr)
    await db.flush()

    # Webhook notification
    try:
        from app.core.webhooks import get_tenant_webhook_url, deliver_webhook
        import asyncio

        webhook_url = await get_tenant_webhook_url(db, tenant_id)
        if webhook_url:
            payload = {
                "event": "customer.frozen",
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "data": {
                    "customerId": str(customer_id),
                    "customerName": customer.full_name,
                    "freezeType": body.freeze_type,
                    "matchedList": body.matched_list,
                    "frozenAt": fr.frozen_at.isoformat(),
                    "action_required": "Report freeze to FMU immediately",
                },
            }
            asyncio.create_task(deliver_webhook(webhook_url.strip(), payload))
    except Exception:
        pass  # Non-fatal

    # In-app notification for MLROs
    try:
        from app.modules.notifications.service import notification_service

        msg = (
            f"ASSET FREEZE: {customer.full_name} frozen — {body.freeze_type.upper()}"
            f" ({body.matched_list or 'sanctions'} match). Report to FMU immediately."
        )
        link = f"/kyc/customers/{customer_id}"
        await notification_service.create_for_tenant_mlros(
            db, tenant_id, "asset_freeze", msg, link=link, send_email=True
        )
    except Exception:
        pass  # Non-fatal

    return _freeze_detail(fr)


@router.post("/{customer_id}/report-freeze-to-fmu", response_model=FreezeRecordDetail)
async def report_freeze_to_fmu(
    customer_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Mark the most recent active freeze as reported to FMU."""
    tenant_id = _require_tenant(user)
    result = await db.execute(
        select(FreezeRecord)
        .where(
            FreezeRecord.customer_id == customer_id,
            FreezeRecord.tenant_id == tenant_id,
            FreezeRecord.status == "frozen",
        )
        .order_by(FreezeRecord.frozen_at.desc())
        .limit(1)
    )
    fr = result.scalar_one_or_none()
    if not fr:
        raise NotFoundError("No active freeze record found for this customer")

    fr.status = "reported_to_fmu"
    fr.reported_to_fmu_at = datetime.now(timezone.utc)
    await db.flush()
    return _freeze_detail(fr)


@router.post("/{customer_id}/unfreeze", response_model=FreezeRecordDetail)
async def unfreeze_customer(
    customer_id: UUID,
    body: UnfreezeRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Unfreeze customer. MLRO or platform_admin only."""
    tenant_id = _require_tenant(user)

    if user.role not in (UserRole.mlro, UserRole.platform_admin):
        raise AuthorizationError("Only MLRO or platform admin can unfreeze customers")

    customer = await customer_service.get_by_id(db, customer_id=customer_id, tenant_id=tenant_id)
    if not customer:
        raise NotFoundError(f"Customer {customer_id} not found")

    # Find the active freeze record
    result = await db.execute(
        select(FreezeRecord)
        .where(
            FreezeRecord.customer_id == customer_id,
            FreezeRecord.tenant_id == tenant_id,
            FreezeRecord.status.in_(["frozen", "reported_to_fmu"]),
        )
        .order_by(FreezeRecord.frozen_at.desc())
        .limit(1)
    )
    fr = result.scalar_one_or_none()
    if not fr:
        raise NotFoundError("No active freeze record found for this customer")

    fr.status = "unfrozen"
    fr.unfrozen_at = datetime.now(timezone.utc)
    fr.unfreeze_reason = body.reason
    if body.notes:
        fr.notes = (fr.notes or "") + f"\n[Unfreeze] {body.notes}"
    await db.flush()

    # Revert customer status
    if body.reason == "false_positive_confirmed":
        customer.kyc_status = KycStatus.rejected
    else:
        # Revert to approved if previously approved, otherwise rejected
        customer.kyc_status = KycStatus.rejected
    await db.flush()

    return _freeze_detail(fr)


@router.post("/{customer_id}/beneficial-owners", status_code=201)
async def add_beneficial_owner(
    customer_id: UUID,
    body: dict,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Add a beneficial owner to a customer. Auto-screens against sanctions lists."""
    tenant_id = _require_tenant(user)
    customer = await customer_service.get_by_id(db, customer_id, tenant_id)
    if not customer:
        raise NotFoundError("Customer not found")

    from app.modules.identity.models import BeneficialOwner
    bo = BeneficialOwner(
        tenant_id=tenant_id,
        customer_id=customer_id,
        full_name=body.get("full_name", ""),
        cnic_number=body.get("cnic_number"),
        nationality=body.get("nationality"),
        ownership_percentage=body.get("ownership_percentage"),
        relationship=body.get("relationship"),
    )
    db.add(bo)
    await db.flush()

    # Auto-screen the beneficial owner
    from app.modules.screening.service import screening_service
    try:
        result = await screening_service.check(
            db, tenant_id=tenant_id,
            name=bo.full_name,
        )
        from datetime import datetime, timezone
        bo.last_screened_at = datetime.now(timezone.utc)
        if result.matches:
            bo.screening_status = "potential_match"
        else:
            bo.screening_status = "clear"
        await db.flush()
    except Exception:
        pass  # Screening failure shouldn't block BO creation

    await db.refresh(bo)
    return {
        "id": str(bo.id),
        "customerId": str(bo.customer_id),
        "fullName": bo.full_name,
        "cnicNumber": bo.cnic_number,
        "ownershipPercentage": bo.ownership_percentage,
        "relationship": bo.relationship,
        "screeningStatus": bo.screening_status,
    }


@router.get("/{customer_id}/beneficial-owners")
async def list_beneficial_owners(
    customer_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """List beneficial owners for a customer."""
    tenant_id = _require_tenant(user)
    from app.modules.identity.models import BeneficialOwner
    from sqlalchemy import select
    result = await db.execute(
        select(BeneficialOwner).where(
            BeneficialOwner.customer_id == customer_id,
            BeneficialOwner.tenant_id == tenant_id,
        ).order_by(BeneficialOwner.created_at)
    )
    bos = result.scalars().all()
    return {
        "items": [
            {
                "id": str(bo.id),
                "customerId": str(bo.customer_id),
                "fullName": bo.full_name,
                "cnicNumber": bo.cnic_number,
                "ownershipPercentage": bo.ownership_percentage,
                "relationship": bo.relationship,
                "screeningStatus": bo.screening_status,
                "lastScreenedAt": bo.last_screened_at.isoformat() if bo.last_screened_at else None,
            }
            for bo in bos
        ]
    }


@router.get("/{customer_id}/freeze-records", response_model=FreezeRecordListResponse)
async def list_customer_freeze_records(
    customer_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """List all freeze records for a customer."""
    tenant_id = _require_tenant(user)
    result = await db.execute(
        select(FreezeRecord)
        .where(FreezeRecord.customer_id == customer_id, FreezeRecord.tenant_id == tenant_id)
        .order_by(FreezeRecord.frozen_at.desc())
    )
    records = list(result.scalars().all())
    return FreezeRecordListResponse(
        items=[_freeze_detail(fr) for fr in records],
        total=len(records),
    )


@router.get("/freeze-records/all", response_model=FreezeRecordListResponse)
async def list_all_freeze_records(
    limit: int = Query(50, le=200, ge=1),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """List freeze records. Platform admin sees all tenants; tenant users see own tenant only."""
    base = select(FreezeRecord)
    if user.tenant_id:
        base = base.where(FreezeRecord.tenant_id == user.tenant_id)

    count_q = select(func.count()).select_from(base.subquery())
    total = (await db.scalar(count_q)) or 0

    result = await db.execute(
        base.order_by(FreezeRecord.frozen_at.desc()).limit(limit).offset(offset)
    )
    records = list(result.scalars().all())
    return FreezeRecordListResponse(
        items=[_freeze_detail(fr) for fr in records],
        total=total,
    )
