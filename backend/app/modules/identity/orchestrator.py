"""CDD/EDD orchestrator (Phase 4.9). Chains steps 4.3–4.8. High risk → EDD. Prohibited → reject."""

from dataclasses import dataclass
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.identity.models import (
    Customer,
    KycStatus,
    VerificationResult,
    VerificationType,
)


@dataclass
class OrchestratorResult:
    """Result of running KYC pipeline."""

    customer: Customer
    steps_run: list[str]
    message: str


async def _has_verification(
    db: AsyncSession, customer_id: UUID, vtype: VerificationType
) -> bool:
    """Check if customer has a verification result of given type."""
    r = await db.execute(
        select(VerificationResult.id).where(
            VerificationResult.customer_id == customer_id,
            VerificationResult.verification_type == vtype,
        ).limit(1)
    )
    return r.scalar_one_or_none() is not None


async def run_kyc_pipeline(
    db: AsyncSession,
    customer: Customer,
    *,
    get_customer_fn,
    verify_nadra_fn,
    score_risk_fn,
) -> OrchestratorResult:
    """
    Run all applicable automated KYC steps for customer.

    Chains: NADRA (when documents_uploaded/identity_verified + CNIC + no NADRA) →
            Risk scoring (when liveness_checked).

    High risk → EDD (handled by score_risk). Prohibited → reject (handled by score_risk).
    """
    steps_run: list[str] = []
    customer_id = customer.id
    tenant_id = customer.tenant_id

    # Step 1: NADRA if at documents_uploaded/identity_verified, has CNIC, no NADRA result
    if customer.kyc_status in (
        KycStatus.documents_uploaded,
        KycStatus.identity_verified,
    ) and customer.cnic_number:
        has_nadra = await _has_verification(db, customer_id, VerificationType.nadra)
        if not has_nadra:
            await verify_nadra_fn(db, customer_id, tenant_id)
            steps_run.append("nadra")
            customer = await get_customer_fn(db, customer_id, tenant_id)

    # Step 2: Risk scoring if at liveness_checked
    if customer and customer.kyc_status == KycStatus.liveness_checked:
        customer = await score_risk_fn(db, customer_id, tenant_id)
        steps_run.append("risk_scoring")

    if not steps_run:
        message = "No automated steps to run. Upload documents, verify NADRA, or complete liveness to advance."
    else:
        message = f"Ran: {', '.join(steps_run)}"

    return OrchestratorResult(customer=customer, steps_run=steps_run, message=message)
