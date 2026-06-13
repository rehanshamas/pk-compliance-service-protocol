"""EDD (Enhanced Due Diligence) workflow service. Phase 4.10."""

from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import NotFoundError, ValidationError
from app.core.webhooks import notify_kyc_status_change
from app.models.tenant import UserRole
from app.modules.identity.models import Customer, EddApprovalStatus, EddCase, KycStatus
from app.modules.identity.workflows import validate_transition

# Roles permitted to approve/reject EDD (senior management)
EDD_APPROVER_ROLES = {UserRole.mlro, UserRole.platform_admin}


class EddService:
    async def start_edd(
        self,
        db: AsyncSession,
        customer_id: UUID,
        tenant_id: UUID,
    ) -> tuple[Customer, EddCase]:
        """Start EDD: edd_required -> edd_in_progress, create EddCase."""
        customer = await self._get_customer(db, customer_id, tenant_id)
        if customer.kyc_status != KycStatus.edd_required:
            raise ValidationError(
                "Customer must be in edd_required to start EDD",
                details={"kyc_status": customer.kyc_status.value},
            )
        existing = await db.execute(
            select(EddCase).where(
                EddCase.customer_id == customer_id,
                EddCase.tenant_id == tenant_id,
            )
        )
        if existing.scalar_one_or_none():
            raise ValidationError("EDD case already exists for this customer")

        validate_transition(KycStatus.edd_required, KycStatus.edd_in_progress)
        old_status = KycStatus.edd_required.value
        customer.kyc_status = KycStatus.edd_in_progress
        await db.flush()
        await db.refresh(customer)
        await notify_kyc_status_change(db, customer, old_status)

        edd_case = EddCase(
            customer_id=customer_id,
            tenant_id=tenant_id,
            approval_status=EddApprovalStatus.pending,
        )
        db.add(edd_case)
        await db.flush()
        await db.refresh(customer)
        await db.refresh(edd_case)
        return customer, edd_case

    async def get_edd_case(
        self,
        db: AsyncSession,
        customer_id: UUID,
        tenant_id: UUID,
    ) -> EddCase | None:
        """Get EDD case for customer. Returns None if not found."""
        await self._get_customer(db, customer_id, tenant_id)
        result = await db.execute(
            select(EddCase).where(
                EddCase.customer_id == customer_id,
                EddCase.tenant_id == tenant_id,
            )
        )
        return result.scalar_one_or_none()

    async def submit_source_of_funds(
        self,
        db: AsyncSession,
        customer_id: UUID,
        tenant_id: UUID,
        *,
        source_of_funds: str,
        source_of_funds_verified: bool = False,
    ) -> EddCase:
        """Submit source of funds for EDD case."""
        edd_case = await self.get_edd_case(db, customer_id, tenant_id)
        if not edd_case:
            raise NotFoundError("EDD case not found. Start EDD first.")
        if edd_case.approval_status != EddApprovalStatus.pending:
            raise ValidationError(
                "Cannot update source of funds after approval decision",
                details={"approval_status": edd_case.approval_status.value},
            )
        edd_case.source_of_funds = source_of_funds
        edd_case.source_of_funds_verified = source_of_funds_verified
        await db.flush()
        await db.refresh(edd_case)
        return edd_case

    async def approve(
        self,
        db: AsyncSession,
        customer_id: UUID,
        tenant_id: UUID,
        user_id: UUID,
        user_role: UserRole,
        *,
        notes: str | None = None,
    ) -> tuple[Customer, EddCase]:
        """Senior approval: EDD case approved -> customer approved."""
        if user_role not in EDD_APPROVER_ROLES:
            raise ValidationError(
                "Only MLRO or platform admin can approve EDD",
                details={"role": user_role.value},
            )
        edd_case = await self.get_edd_case(db, customer_id, tenant_id)
        if not edd_case:
            raise NotFoundError("EDD case not found")
        if edd_case.approval_status != EddApprovalStatus.pending:
            raise ValidationError(
                "EDD case already has approval decision",
                details={"approval_status": edd_case.approval_status.value},
            )
        customer = await self._get_customer(db, customer_id, tenant_id)
        if customer.kyc_status != KycStatus.edd_in_progress:
            raise ValidationError(
                "Customer must be in edd_in_progress for approval",
                details={"kyc_status": customer.kyc_status.value},
            )

        validate_transition(KycStatus.edd_in_progress, KycStatus.approved)
        edd_case.approval_status = EddApprovalStatus.approved
        edd_case.approved_by = user_id
        edd_case.approved_at = datetime.now(timezone.utc)
        edd_case.approval_notes = notes
        old_status = KycStatus.edd_in_progress.value
        customer.kyc_status = KycStatus.approved
        await db.flush()
        await db.refresh(customer)
        await db.refresh(edd_case)
        await notify_kyc_status_change(db, customer, old_status)
        return customer, edd_case

    async def reject(
        self,
        db: AsyncSession,
        customer_id: UUID,
        tenant_id: UUID,
        user_id: UUID,
        user_role: UserRole,
        *,
        notes: str,
    ) -> tuple[Customer, EddCase]:
        """Senior rejection: EDD case rejected -> customer rejected."""
        if user_role not in EDD_APPROVER_ROLES:
            raise ValidationError(
                "Only MLRO or platform admin can reject EDD",
                details={"role": user_role.value},
            )
        edd_case = await self.get_edd_case(db, customer_id, tenant_id)
        if not edd_case:
            raise NotFoundError("EDD case not found")
        if edd_case.approval_status != EddApprovalStatus.pending:
            raise ValidationError(
                "EDD case already has approval decision",
                details={"approval_status": edd_case.approval_status.value},
            )
        customer = await self._get_customer(db, customer_id, tenant_id)
        if customer.kyc_status != KycStatus.edd_in_progress:
            raise ValidationError(
                "Customer must be in edd_in_progress for rejection",
                details={"kyc_status": customer.kyc_status.value},
            )

        validate_transition(KycStatus.edd_in_progress, KycStatus.rejected)
        edd_case.approval_status = EddApprovalStatus.rejected
        edd_case.approved_by = user_id
        edd_case.approved_at = datetime.now(timezone.utc)
        edd_case.approval_notes = notes
        old_status = KycStatus.edd_in_progress.value
        customer.kyc_status = KycStatus.rejected
        await db.flush()
        await db.refresh(customer)
        await db.refresh(edd_case)
        await notify_kyc_status_change(db, customer, old_status)
        return customer, edd_case

    async def _get_customer(
        self,
        db: AsyncSession,
        customer_id: UUID,
        tenant_id: UUID,
    ) -> Customer:
        from app.modules.identity.service import customer_service

        customer = await customer_service.get_by_id(db, customer_id, tenant_id)
        if not customer:
            raise NotFoundError("Customer not found")
        return customer


edd_service = EddService()
