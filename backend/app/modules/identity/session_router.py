"""KYC Session routes: hosted KYC flow for VASPs. Tenant-scoped + public endpoints."""

from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_auth_context
from app.core.exceptions import FeatureDisabledError, NotFoundError, ValidationError
from app.core.file_validation import validate_file
from app.database import get_db
from app.models.tenant import Tenant, User
from app.modules.identity.models import SessionStatus
from app.modules.identity.session_schemas import (
    CompleteStepRequest,
    KycSessionCreate,
    KycSessionResponse,
    KycSessionStatusResponse,
    KycSessionVerifyResponse,
)
from app.modules.identity.session_service import kyc_session_service

router = APIRouter()


def _require_tenant_id(auth: tuple[User | None, Tenant]) -> UUID:
    """Extract tenant_id from JWT user or API key tenant."""
    user, tenant = auth
    if user is not None:
        if not user.tenant_id:
            raise FeatureDisabledError("Platform admins use admin endpoints.")
        return user.tenant_id
    # API key auth — tenant is always set
    return tenant.id


def _session_response(session, web_url: str, mobile_url: str) -> KycSessionResponse:
    return KycSessionResponse(
        session_id=str(session.id),
        status=session.status.value if hasattr(session.status, "value") else str(session.status),
        current_step=session.current_step.value if hasattr(session.current_step, "value") else str(session.current_step),
        kyc_status=session.kyc_status,
        risk_tier=session.risk_tier,
        customer_id=str(session.customer_id) if session.customer_id else None,
        liveness_required=session.liveness_required,
        web_url=web_url,
        mobile_url=mobile_url,
        expires_at=session.expires_at.isoformat(),
        completed_at=session.completed_at.isoformat() if session.completed_at else None,
        created_at=session.created_at.isoformat(),
    )


# ---------------------------------------------------------------------------
# Authenticated endpoints (VASP creates and checks sessions)
# ---------------------------------------------------------------------------


@router.post("", response_model=KycSessionResponse, status_code=201)
async def create_kyc_session(
    body: KycSessionCreate,
    db: AsyncSession = Depends(get_db),
    auth: tuple = Depends(get_auth_context),
):
    """VASP creates a KYC session. Returns session_id + redirect URLs. Supports JWT or API key."""
    tenant_id = _require_tenant_id(auth)
    session = await kyc_session_service.create_session(
        db,
        tenant_id=tenant_id,
        external_ref=body.external_ref,
        customer_name=body.customer_name,
        customer_cnic=body.customer_cnic,
        customer_phone=body.customer_phone,
        customer_dob=body.customer_dob,
        customer_nationality=body.customer_nationality,
        verification_level=body.verification_level,
        upgrade_from_basic=body.upgrade_from_basic,
        web_callback_url=body.web_callback_url,
        mobile_callback_url=body.mobile_callback_url,
    )
    web_url, mobile_url = kyc_session_service.build_urls(session)
    return _session_response(session, web_url, mobile_url)


@router.get("/{session_id}", response_model=KycSessionStatusResponse)
async def get_kyc_session_status(
    session_id: UUID,
    db: AsyncSession = Depends(get_db),
    auth: tuple = Depends(get_auth_context),
):
    """VASP checks current status of a KYC session. Supports JWT or API key."""
    tenant_id = _require_tenant_id(auth)
    session = await kyc_session_service.get_session(db, session_id, tenant_id=tenant_id)
    if not session:
        raise NotFoundError(f"KYC session {session_id} not found")
    return KycSessionStatusResponse(
        session_id=str(session.id),
        status=session.status.value if hasattr(session.status, "value") else str(session.status),
        current_step=session.current_step.value if hasattr(session.current_step, "value") else str(session.current_step),
        kyc_status=session.kyc_status,
        risk_tier=session.risk_tier,
        customer_id=str(session.customer_id) if session.customer_id else None,
        completed_at=session.completed_at.isoformat() if session.completed_at else None,
    )


# ---------------------------------------------------------------------------
# Public endpoints (hosted verify page — session_id acts as auth token)
# ---------------------------------------------------------------------------


@router.get("/{session_id}/verify", response_model=KycSessionVerifyResponse)
async def get_session_for_verify(
    session_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    """Public endpoint for the hosted KYC page. Session ID is the auth."""
    session = await kyc_session_service.get_session_public(db, session_id)
    if not session:
        raise NotFoundError("KYC session not found or expired")
    return KycSessionVerifyResponse(
        session_id=str(session.id),
        status=session.status.value if hasattr(session.status, "value") else str(session.status),
        current_step=session.current_step.value if hasattr(session.current_step, "value") else str(session.current_step),
        liveness_required=session.liveness_required,
        customer_name=session.customer_name,
        expires_at=session.expires_at.isoformat(),
        completed_at=session.completed_at.isoformat() if session.completed_at else None,
        kyc_status=session.kyc_status,
        risk_tier=session.risk_tier,
        web_callback_url=session.web_callback_url,
        mobile_callback_url=session.mobile_callback_url,
    )


@router.post("/{session_id}/upload-document")
async def upload_session_document(
    session_id: UUID,
    document_type: str = Form(..., description="cnic, passport, driving_license, selfie"),
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
):
    """Public: upload document for a KYC session. Session ID is the auth."""
    content = await file.read()
    content_type = file.content_type or "application/octet-stream"

    # Validate file: magic bytes, size, content-type match
    try:
        detected_type = validate_file(content, file.filename or "document", content_type)
        content_type = detected_type  # use detected type, not client-declared
    except ValueError as e:
        raise ValidationError(str(e))

    result = await kyc_session_service.upload_document(
        db,
        session_id,
        document_type=document_type,
        file_content=content,
        content_type=content_type,
    )
    return {"status": "success", "data": result}


@router.post("/{session_id}/process-frame")
async def process_verification_frame(
    session_id: UUID,
    step: str = Form(..., description="document_front, document_back, selfie, liveness, document_in_hand"),
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
):
    """
    Public: process a verification frame through the ML engine.

    Called by hosted page or SDK when user captures a frame.
    Returns: step result with OCR data, face match score, quality issues, pass/fail.
    """
    content = await file.read()

    # Size check
    max_size = 10 * 1024 * 1024
    if len(content) > max_size:
        raise ValidationError(f"File too large. Maximum: {max_size // (1024*1024)}MB")

    result = await kyc_session_service.process_frame(
        db,
        session_id,
        step=step,
        image_bytes=content,
    )
    return result


@router.post("/{session_id}/process-liveness")
async def process_liveness_frames(
    session_id: UUID,
    files: list[UploadFile] = File(..., description="Multiple frames for liveness analysis"),
    db: AsyncSession = Depends(get_db),
):
    """
    Public: process multiple liveness frames (blink + head turn sequence).

    Send 5-10 frames captured during the liveness challenge.
    """
    if len(files) < 3:
        raise ValidationError("At least 3 frames required for liveness verification")
    if len(files) > 20:
        raise ValidationError("Maximum 20 frames allowed")

    frames = []
    for f in files:
        content = await f.read()
        if len(content) > 5 * 1024 * 1024:
            raise ValidationError("Each frame must be under 5MB")
        frames.append(content)

    result = await kyc_session_service.process_frame(
        db,
        session_id,
        step="liveness",
        image_bytes=frames[0],
        extra_frames=frames[1:],
    )
    return result


@router.post("/{session_id}/complete-step")
async def complete_session_step(
    session_id: UUID,
    body: CompleteStepRequest,
    db: AsyncSession = Depends(get_db),
):
    """Public: advance KYC session to next step. Session ID is the auth."""
    session = await kyc_session_service.complete_step(
        db,
        session_id,
        step=body.step,
    )
    return {
        "status": "success",
        "data": {
            "session_id": str(session.id),
            "status": session.status.value if hasattr(session.status, "value") else str(session.status),
            "current_step": session.current_step.value if hasattr(session.current_step, "value") else str(session.current_step),
            "kyc_status": session.kyc_status,
            "risk_tier": session.risk_tier,
            "completed_at": session.completed_at.isoformat() if session.completed_at else None,
        },
    }
