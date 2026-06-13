"""Shufti Pro callback webhook. Receives verification.accepted/verification.declined."""

import json
import logging
from uuid import UUID

from fastapi import APIRouter, Request, Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import async_session_maker
from app.adapters.shufti import _verify_signature
from app.modules.identity.models import (
    Customer,
    KycStatus,
    ShuftiPendingVerification,
    VerificationResult,
    VerificationStatus,
    VerificationType,
)
from app.modules.identity.workflows import validate_transition
from app.core.webhooks import notify_kyc_status_change

logger = logging.getLogger(__name__)

router = APIRouter()


async def _process_shufti_callback(payload: dict) -> bool:
    """Process Shufti callback. Create VerificationResult, update KYC status. Returns True if handled."""
    reference = payload.get("reference")
    event = payload.get("event")
    if not reference:
        logger.warning("Shufti callback missing reference")
        return False

    async with async_session_maker() as db:
        result = await db.execute(
            select(ShuftiPendingVerification).where(
                ShuftiPendingVerification.reference == reference
            )
        )
        pending = result.scalar_one_or_none()
        if not pending:
            logger.warning("Shufti callback unknown reference: %s", reference)
            return True  # Idempotent: treat as handled to avoid retries

        customer_id = pending.customer_id
        tenant_id = pending.tenant_id

        # Delete pending so we don't process twice
        await db.delete(pending)
        await db.flush()

        # Final events only
        if event == "verification.accepted":
            status = VerificationStatus.pass_
        elif event == "verification.declined":
            status = VerificationStatus.fail
        else:
            logger.info("Shufti callback ignoring event: %s", event)
            await db.commit()
            return True

        vr = VerificationResult(
            customer_id=customer_id,
            tenant_id=tenant_id,
            verification_type=VerificationType.nadra,
            provider="shufti_eidv_pro",
            status=status,
            raw_response=payload,
            confidence_score=1.0 if status == VerificationStatus.pass_ else 0.0,
        )
        db.add(vr)
        await db.flush()

        # Advance KYC when pass
        cust_result = await db.execute(select(Customer).where(Customer.id == customer_id, Customer.tenant_id == tenant_id))
        customer = cust_result.scalar_one_or_none()
        if customer and status == VerificationStatus.pass_ and customer.kyc_status == KycStatus.documents_uploaded:
            validate_transition(KycStatus.documents_uploaded, KycStatus.identity_verified)
            old_status = KycStatus.documents_uploaded.value
            customer.kyc_status = KycStatus.identity_verified
            await db.flush()
            await db.refresh(customer)
            await notify_kyc_status_change(db, customer, old_status)

        await db.commit()

    logger.info("Shufti callback processed: reference=%s event=%s customer=%s", reference, event, customer_id)
    return True


@router.post("", status_code=200)
async def shufti_webhook(request: Request) -> Response:
    """
    Shufti Pro callback. Register this URL in Shufti backoffice.
    Verifies signature, creates VerificationResult, updates KYC status.
    """
    raw_body = (await request.body()).decode("utf-8", errors="replace")
    signature = request.headers.get("Signature") or request.headers.get("HTTP_SIGNATURE")

    secret = getattr(settings, "shufti_secret_key", "") or ""
    if not _verify_signature(raw_body, signature, secret):
        logger.warning("Shufti callback invalid signature")
        return Response(status_code=401, content="Invalid signature")

    try:
        payload = json.loads(raw_body)
    except json.JSONDecodeError as e:
        logger.warning("Shufti callback invalid JSON: %s", e)
        return Response(status_code=400, content="Invalid JSON")

    await _process_shufti_callback(payload)
    return Response(status_code=200, content="OK")
