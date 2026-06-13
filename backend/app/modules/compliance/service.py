"""Case service: create, list, get, patch, add note, link alert, link customer.
   Isar service: create, list, get, submit_for_review, approve, reject, file_as_str.
"""

from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.exceptions import NotFoundError, ValidationError
from app.modules.compliance.workflows import validate_case_transition
from app.models.alert import Alert
from app.models.tenant import UserRole
from app.modules.identity.models import Customer
from app.modules.compliance.models import (
    Case,
    CaseAlertLink,
    CaseCustomerLink,
    CaseNote,
    CaseStatus,
    Isar,
    IsarStatus,
    StrReport,
    StrReportType,
    StrFilingStatus,
)
from app.core.usage import record_usage_event_async
from app.modules.compliance.goaml import generate_str_xml, generate_ctr_xml


class CaseService:
    async def create(
        self,
        db: AsyncSession,
        tenant_id: UUID,
        title: str,
        *,
        description: str | None = None,
        alert_id: UUID | None = None,
        assigned_to: UUID | None = None,
    ) -> Case:
        """Create case, optionally from alert."""
        case = Case(
            tenant_id=tenant_id,
            title=title,
            description=description,
            source_alert_id=alert_id,
            assigned_to=assigned_to,
        )
        db.add(case)
        await db.flush()

        if alert_id:
            link = CaseAlertLink(case_id=case.id, alert_id=alert_id)
            db.add(link)

        return case

    async def list(
        self,
        db: AsyncSession,
        tenant_id: UUID,
        limit: int = 50,
        offset: int = 0,
        status: str | None = None,
        search: str | None = None,
    ) -> tuple[list[Case], int]:
        """List cases with optional status filter."""
        base = select(Case).where(Case.tenant_id == tenant_id)
        if status:
            base = base.where(Case.status == CaseStatus(status))
        if search:
            base = base.where(Case.title.ilike(f"%{search}%"))

        count_stmt = select(func.count()).select_from(Case).where(Case.tenant_id == tenant_id)
        if status:
            count_stmt = count_stmt.where(Case.status == CaseStatus(status))
        if search:
            count_stmt = count_stmt.where(Case.title.ilike(f"%{search}%"))
        total = (await db.scalar(count_stmt)) or 0

        q = base.options(
            selectinload(Case.alert_links),
        ).order_by(Case.updated_at.desc()).limit(limit).offset(offset)
        result = await db.execute(q)
        return list(result.scalars().unique().all()), total

    async def get(
        self,
        db: AsyncSession,
        case_id: UUID,
        tenant_id: UUID,
    ) -> Case:
        """Get single case with notes, alert links, customer links."""
        q = (
            select(Case)
            .where(Case.id == case_id, Case.tenant_id == tenant_id)
            .options(
                selectinload(Case.notes),
                selectinload(Case.alert_links),
                selectinload(Case.customer_links),
            )
        )
        r = await db.execute(q)
        case = r.scalar_one_or_none()
        if not case:
            raise NotFoundError("Case not found")
        return case

    async def patch(
        self,
        db: AsyncSession,
        case_id: UUID,
        tenant_id: UUID,
        *,
        title: str | None = None,
        description: str | None = None,
        status: str | None = None,
        assigned_to: UUID | None = None,
        user_role: UserRole | None = None,
    ) -> Case:
        """Update case fields."""
        case = await self.get(db, case_id, tenant_id)
        # Block content edits on closed cases (only status change via reopen endpoint)
        if case.status in (CaseStatus.closed_no_action, CaseStatus.closed_str_filed):
            if title is not None or description is not None or assigned_to is not None:
                raise ValidationError(
                    "Cannot modify a closed case. Use the reopen endpoint to reopen it first.",
                    details={"status": case.status.value},
                )
        if title is not None:
            case.title = title
        if description is not None:
            case.description = description
        if status is not None:
            new_status = CaseStatus(status)
            validate_case_transition(case.status, new_status)
            # Closing a case requires MLRO or Compliance Officer role
            if new_status in (CaseStatus.closed_no_action, CaseStatus.closed_str_filed):
                if user_role and user_role not in (UserRole.mlro, UserRole.compliance_officer, UserRole.platform_admin):
                    raise ValidationError(
                        "Only MLRO or Compliance Officer can close cases",
                        details={"role": user_role.value if user_role else "unknown"},
                    )
            case.status = new_status
            if status in ("closed_no_action", "closed_str_filed"):
                case.closed_at = datetime.now(timezone.utc)
        if assigned_to is not None:
            case.assigned_to = assigned_to
        await db.flush()
        return case

    async def add_note(
        self,
        db: AsyncSession,
        case_id: UUID,
        tenant_id: UUID,
        user_id: UUID,
        content: str,
    ) -> CaseNote:
        """Add note to case."""
        case = await self.get(db, case_id, tenant_id)
        note = CaseNote(case_id=case.id, user_id=user_id, content=content)
        db.add(note)
        await db.flush()
        return note

    async def link_alert(
        self,
        db: AsyncSession,
        case_id: UUID,
        tenant_id: UUID,
        alert_id: UUID,
    ) -> Case:
        """Link alert to case. Validates alert exists and belongs to tenant."""
        case = await self.get(db, case_id, tenant_id)

        r = await db.execute(
            select(Alert).where(Alert.id == alert_id, Alert.tenant_id == tenant_id)
        )
        if not r.scalar_one_or_none():
            raise NotFoundError("Alert not found")

        existing = await db.execute(
            select(CaseAlertLink).where(
                CaseAlertLink.case_id == case_id,
                CaseAlertLink.alert_id == alert_id,
            )
        )
        if existing.scalar_one_or_none():
            return case

        link = CaseAlertLink(case_id=case_id, alert_id=alert_id)
        db.add(link)
        await db.flush()
        return case

    async def link_customer(
        self,
        db: AsyncSession,
        case_id: UUID,
        tenant_id: UUID,
        customer_id: UUID,
    ) -> Case:
        """Link customer to case. Validates customer exists and belongs to tenant."""
        from app.modules.identity.models import Customer

        case = await self.get(db, case_id, tenant_id)

        r = await db.execute(
            select(Customer).where(
                Customer.id == customer_id,
                Customer.tenant_id == tenant_id,
            )
        )
        if not r.scalar_one_or_none():
            raise NotFoundError("Customer not found")

        existing = await db.execute(
            select(CaseCustomerLink).where(
                CaseCustomerLink.case_id == case_id,
                CaseCustomerLink.customer_id == customer_id,
            )
        )
        if existing.scalar_one_or_none():
            return case

        link = CaseCustomerLink(case_id=case_id, customer_id=customer_id)
        db.add(link)
        await db.flush()
        return case

    def _linked_alerts_count(self, case: Case) -> int:
        """Count unique alerts: source_alert_id + alert_links (no double count)."""
        count = len(case.alert_links)
        if case.source_alert_id:
            if not any(l.alert_id == case.source_alert_id for l in case.alert_links):
                count += 1
        return count


# Roles permitted to approve/reject/file ISAR (MLRO, platform_admin)
ISAR_APPROVER_ROLES = {UserRole.mlro, UserRole.platform_admin}


class IsarService:
    async def create(
        self,
        db: AsyncSession,
        tenant_id: UUID,
        case_id: UUID | None,
        subject_customer_id: UUID,
        suspicion_type: str,
        narrative: str,
        *,
        supporting_evidence: dict | None = None,
        submitted_by: UUID | None = None,
        reporter_details: dict | None = None,
        customer_details: dict | None = None,
        transaction_details: dict | None = None,
        mlro_determination: dict | None = None,
    ) -> Isar:
        """Create ISAR draft (Form A7). Validates case and customer exist and belong to tenant.

        Supports all 5 Form A7 sections:
          1. Reporter Details
          2. Customer Details
          3. Transaction Details
          4. Suspicion Narrative (suspicion_type + narrative)
          5. MLRO Determination
        """
        from app.modules.identity.models import Customer

        if case_id:
            await case_service.get(db, case_id, tenant_id)
        r = await db.execute(
            select(Customer).where(
                Customer.id == subject_customer_id,
                Customer.tenant_id == tenant_id,
            )
        )
        if not r.scalar_one_or_none():
            raise NotFoundError("Customer not found")
        isar = Isar(
            tenant_id=tenant_id,
            case_id=case_id,
            subject_customer_id=subject_customer_id,
            suspicion_type=suspicion_type,
            narrative=narrative,
            supporting_evidence=supporting_evidence,
            reporter_details=reporter_details,
            customer_details=customer_details,
            transaction_details=transaction_details,
            mlro_determination=mlro_determination,
        )
        db.add(isar)
        await db.flush()
        record_usage_event_async(db, tenant_id, "compliance.isar")
        return isar

    async def update(
        self,
        db: AsyncSession,
        isar_id: UUID,
        tenant_id: UUID,
        *,
        suspicion_type: str | None = None,
        narrative: str | None = None,
        supporting_evidence: dict | None = None,
        reporter_details: dict | None = None,
        customer_details: dict | None = None,
        transaction_details: dict | None = None,
        mlro_determination: dict | None = None,
    ) -> Isar:
        """Update ISAR draft fields. Only drafts can be updated."""
        isar = await self.get(db, isar_id, tenant_id)
        if isar.status != IsarStatus.draft:
            raise ValidationError(
                "Only draft ISARs can be updated",
                details={"status": isar.status.value},
            )
        if suspicion_type is not None:
            isar.suspicion_type = suspicion_type
        if narrative is not None:
            isar.narrative = narrative
        if supporting_evidence is not None:
            isar.supporting_evidence = supporting_evidence
        if reporter_details is not None:
            isar.reporter_details = reporter_details
        if customer_details is not None:
            isar.customer_details = customer_details
        if transaction_details is not None:
            isar.transaction_details = transaction_details
        if mlro_determination is not None:
            isar.mlro_determination = mlro_determination
        await db.flush()
        return isar

    async def list(
        self,
        db: AsyncSession,
        tenant_id: UUID,
        limit: int = 50,
        offset: int = 0,
        status: str | None = None,
        case_id: UUID | None = None,
    ) -> tuple[list[Isar], int]:
        """List ISARs with optional filters."""
        base = select(Isar).where(Isar.tenant_id == tenant_id)
        if status:
            base = base.where(Isar.status == IsarStatus(status))
        if case_id:
            base = base.where(Isar.case_id == case_id)
        count_stmt = select(func.count()).select_from(Isar).where(Isar.tenant_id == tenant_id)
        if status:
            count_stmt = count_stmt.where(Isar.status == IsarStatus(status))
        if case_id:
            count_stmt = count_stmt.where(Isar.case_id == case_id)
        total = (await db.scalar(count_stmt)) or 0
        q = base.order_by(Isar.created_at.desc()).limit(limit).offset(offset)
        result = await db.execute(q)
        return list(result.scalars().unique().all()), total

    async def get(
        self,
        db: AsyncSession,
        isar_id: UUID,
        tenant_id: UUID,
    ) -> Isar:
        """Get single ISAR."""
        r = await db.execute(
            select(Isar).where(Isar.id == isar_id, Isar.tenant_id == tenant_id)
        )
        isar = r.scalar_one_or_none()
        if not isar:
            raise NotFoundError("ISAR not found")
        return isar

    async def submit_for_review(
        self,
        db: AsyncSession,
        isar_id: UUID,
        tenant_id: UUID,
        user_id: UUID,
    ) -> Isar:
        """draft -> submitted_for_review."""
        isar = await self.get(db, isar_id, tenant_id)
        if isar.status != IsarStatus.draft:
            raise ValidationError(
                "Only draft ISARs can be submitted for review",
                details={"status": isar.status.value},
            )
        isar.status = IsarStatus.submitted_for_review
        isar.submitted_by = user_id
        await db.flush()

        from app.modules.notifications.service import notify_isar_pending_review
        case_ref = f"Case {isar.case_id}"
        await notify_isar_pending_review(db, tenant_id, isar.id, case_ref)

        return isar

    async def approve(
        self,
        db: AsyncSession,
        isar_id: UUID,
        tenant_id: UUID,
        user_id: UUID,
        user_role: UserRole,
        *,
        notes: str | None = None,
    ) -> Isar:
        """submitted_for_review -> approved. MLRO/platform_admin only."""
        if user_role not in ISAR_APPROVER_ROLES:
            raise ValidationError(
                "Only MLRO or platform admin can approve ISAR",
                details={"role": user_role.value},
            )
        isar = await self.get(db, isar_id, tenant_id)
        if isar.status != IsarStatus.submitted_for_review:
            raise ValidationError(
                "ISAR must be submitted_for_review to approve",
                details={"status": isar.status.value},
            )
        isar.status = IsarStatus.approved
        isar.reviewed_by = user_id
        isar.approved_by = user_id
        isar.approved_at = datetime.now(timezone.utc)
        await db.flush()
        return isar

    async def reject(
        self,
        db: AsyncSession,
        isar_id: UUID,
        tenant_id: UUID,
        user_id: UUID,
        user_role: UserRole,
        *,
        rejection_rationale: str,
    ) -> Isar:
        """submitted_for_review -> rejected. MLRO/platform_admin only. Rationale required."""
        if user_role not in ISAR_APPROVER_ROLES:
            raise ValidationError(
                "Only MLRO or platform admin can reject ISAR",
                details={"role": user_role.value},
            )
        isar = await self.get(db, isar_id, tenant_id)
        if isar.status != IsarStatus.submitted_for_review:
            raise ValidationError(
                "ISAR must be submitted_for_review to reject",
                details={"status": isar.status.value},
            )
        isar.status = IsarStatus.rejected
        isar.reviewed_by = user_id
        isar.rejection_rationale = rejection_rationale
        await db.flush()
        return isar

    async def revise_rejected(
        self,
        db: AsyncSession,
        isar_id: UUID,
        tenant_id: UUID,
    ) -> Isar:
        """rejected -> draft. Allows analyst to revise and resubmit a rejected ISAR."""
        isar = await self.get(db, isar_id, tenant_id)
        if isar.status != IsarStatus.rejected:
            raise ValidationError(
                "Only rejected ISARs can be revised",
                details={"status": isar.status.value},
            )
        isar.status = IsarStatus.draft
        isar.rejection_rationale = None  # Clear old rejection
        isar.reviewed_by = None
        await db.flush()
        return isar

    async def file_as_str(
        self,
        db: AsyncSession,
        isar_id: UUID,
        tenant_id: UUID,
        user_id: UUID,
        user_role: UserRole,
    ) -> Isar:
        """approved -> filed_as_str. MLRO/platform_admin only."""
        if user_role not in ISAR_APPROVER_ROLES:
            raise ValidationError(
                "Only MLRO or platform admin can file ISAR as STR",
                details={"role": user_role.value},
            )
        isar = await self.get(db, isar_id, tenant_id)
        if isar.status != IsarStatus.approved:
            raise ValidationError(
                "ISAR must be approved to file as STR",
                details={"status": isar.status.value},
            )
        isar.status = IsarStatus.filed_as_str
        isar.filed_at = datetime.now(timezone.utc)
        await db.flush()

        # Auto-generate STR report for goAML
        try:
            from app.modules.identity.models import Customer as Cust
            from app.models.tenant import Tenant
            cust_r = await db.execute(select(Cust).where(Cust.id == isar.subject_customer_id, Cust.tenant_id == tenant_id))
            customer = cust_r.scalar_one_or_none()
            t_r = await db.execute(select(Tenant).where(Tenant.id == tenant_id))
            tenant = t_r.scalar_one_or_none()
            if customer and tenant:
                xml_str = generate_str_xml(isar, customer, tenant, schema_version="5.0.2")
                auto_report = StrReport(
                    tenant_id=tenant_id,
                    isar_id=isar_id,
                    report_type=StrReportType.str_,
                    goaml_xml=xml_str,
                    goaml_schema_version="5.0.2",
                    filing_status=StrFilingStatus.generated,
                )
                db.add(auto_report)
                await db.flush()
                record_usage_event_async(db, tenant_id, "compliance.str")
        except Exception as e:
            # STR generation failed - revert the filing status and raise
            isar.status = IsarStatus.approved  # Revert to approved
            isar.filed_at = None
            await db.flush()
            raise ValidationError(
                f"Failed to generate STR report: {str(e)}. ISAR remains in 'approved' status. Fix the issue and try again.",
                details={"error": str(e)},
            )

        return isar


class StrReportService:
    """Generate and list STR reports for goAML. Phase 5.3."""

    async def list(
        self,
        db: AsyncSession,
        tenant_id: UUID,
        limit: int = 50,
        offset: int = 0,
        report_type: str | None = None,
    ) -> tuple[list[StrReport], int]:
        """List STR reports for tenant."""
        base = select(StrReport).where(StrReport.tenant_id == tenant_id)
        if report_type:
            base = base.where(StrReport.report_type == StrReportType(report_type))
        count_stmt = select(func.count()).select_from(StrReport).where(StrReport.tenant_id == tenant_id)
        if report_type:
            count_stmt = count_stmt.where(StrReport.report_type == StrReportType(report_type))
        total = (await db.scalar(count_stmt)) or 0
        q = base.order_by(StrReport.created_at.desc()).limit(limit).offset(offset)
        result = await db.execute(q)
        return list(result.scalars().unique().all()), total

    async def get(
        self,
        db: AsyncSession,
        report_id: UUID,
        tenant_id: UUID,
    ) -> StrReport:
        """Get single STR report."""
        r = await db.execute(
            select(StrReport).where(
                StrReport.id == report_id,
                StrReport.tenant_id == tenant_id,
            )
        )
        report = r.scalar_one_or_none()
        if not report:
            raise NotFoundError("STR report not found")
        return report

    async def generate_from_isar(
        self,
        db: AsyncSession,
        isar_id: UUID,
        tenant_id: UUID,
        *,
        schema_version: str = "5.0.2",
    ) -> StrReport:
        """Generate STR XML from an approved or filed ISAR. Creates and stores StrReport."""
        from app.models.tenant import Tenant

        isar = await isar_service.get(db, isar_id, tenant_id)
        if isar.status not in (IsarStatus.approved, IsarStatus.filed_as_str):
            raise ValidationError(
                "ISAR must be approved or filed as STR to generate XML",
                details={"status": isar.status.value},
            )

        r = await db.execute(
            select(Customer).where(
                Customer.id == isar.subject_customer_id,
                Customer.tenant_id == tenant_id,
            )
        )
        customer = r.scalar_one_or_none()
        if not customer:
            raise NotFoundError("Subject customer not found")

        t = await db.execute(select(Tenant).where(Tenant.id == tenant_id))
        tenant = t.scalar_one_or_none()
        if not tenant:
            raise NotFoundError("Tenant not found")

        xml_str = generate_str_xml(isar, customer, tenant, schema_version=schema_version)
        from app.modules.compliance.goaml import validate_str_xml_if_configured
        validate_str_xml_if_configured(xml_str)

        report = StrReport(
            tenant_id=tenant_id,
            isar_id=isar_id,
            report_type=StrReportType.str_,
            goaml_xml=xml_str,
            goaml_schema_version=schema_version,
            filing_status=StrFilingStatus.generated,
        )
        db.add(report)
        await db.flush()
        record_usage_event_async(db, tenant_id, "compliance.str")
        return report


class FormA6Service:
    """Aggregate stats for Form A6 annual return (PVARA 8-section). Phase 5.5 / WS-6."""

    async def get_stats(
        self,
        db: AsyncSession,
        tenant_id: UUID,
        start_date: datetime,
        end_date: datetime,
        *,
        training_hours: int = 0,
    ) -> dict:
        """Aggregate compliance stats for date range.

        Returns metrics for PVARA Form A6 sections 4-6:
          Section 4: CDD Metrics (customers onboarded, high-risk, PEP, refused, exited)
          Section 5: Transaction Monitoring (alerts total, escalated, closed, pending)
          Section 6: STR/CTR Reporting (STRs filed, CTRs filed, suspicion categories)
        Plus screenings conducted and training hours.
        """
        from app.models.screening import ScreeningResult
        from app.modules.identity.models import RiskTier, KycStatus

        # --- Section 4: CDD Metrics ---
        customers_stmt = select(func.count()).select_from(Customer).where(
            Customer.tenant_id == tenant_id,
            Customer.created_at >= start_date,
            Customer.created_at <= end_date,
        )
        customers_high_risk_stmt = select(func.count()).select_from(Customer).where(
            Customer.tenant_id == tenant_id,
            Customer.created_at >= start_date,
            Customer.created_at <= end_date,
            Customer.risk_tier == RiskTier.high,
        )
        customers_refused_stmt = select(func.count()).select_from(Customer).where(
            Customer.tenant_id == tenant_id,
            Customer.created_at >= start_date,
            Customer.created_at <= end_date,
            Customer.kyc_status == KycStatus.rejected,
        )

        # --- Section 5: Transaction Monitoring ---
        from app.models.alert import Alert, AlertStatus as AStatus

        alerts_total_stmt = select(func.count()).select_from(Alert).where(
            Alert.tenant_id == tenant_id,
            Alert.created_at >= start_date,
            Alert.created_at <= end_date,
        )
        alerts_escalated_stmt = select(func.count()).select_from(Alert).where(
            Alert.tenant_id == tenant_id,
            Alert.created_at >= start_date,
            Alert.created_at <= end_date,
            Alert.status == AStatus.escalated,
        )
        alerts_closed_stmt = select(func.count()).select_from(Alert).where(
            Alert.tenant_id == tenant_id,
            Alert.created_at >= start_date,
            Alert.created_at <= end_date,
            Alert.status.in_([AStatus.resolved, AStatus.false_alarm]),
        )
        alerts_pending_stmt = select(func.count()).select_from(Alert).where(
            Alert.tenant_id == tenant_id,
            Alert.created_at >= start_date,
            Alert.created_at <= end_date,
            Alert.status.in_([AStatus.open, AStatus.investigating]),
        )

        # --- Section 6: STR/CTR ---
        screenings_stmt = select(func.count()).select_from(ScreeningResult).where(
            ScreeningResult.tenant_id == tenant_id,
            ScreeningResult.created_at >= start_date,
            ScreeningResult.created_at <= end_date,
        )
        strs_stmt = select(func.count()).select_from(StrReport).where(
            StrReport.tenant_id == tenant_id,
            StrReport.report_type == StrReportType.str_,
            StrReport.created_at >= start_date,
            StrReport.created_at <= end_date,
        )
        ctrs_stmt = select(func.count()).select_from(StrReport).where(
            StrReport.tenant_id == tenant_id,
            StrReport.report_type == StrReportType.ctr,
            StrReport.created_at >= start_date,
            StrReport.created_at <= end_date,
        )

        # Suspicion categories from ISARs filed in the period
        suspicion_cats_stmt = (
            select(Isar.suspicion_type, func.count())
            .where(
                Isar.tenant_id == tenant_id,
                Isar.status == IsarStatus.filed_as_str,
                Isar.filed_at >= start_date,
                Isar.filed_at <= end_date,
            )
            .group_by(Isar.suspicion_type)
        )

        # Execute all queries
        customers = (await db.scalar(customers_stmt)) or 0
        customers_high_risk = (await db.scalar(customers_high_risk_stmt)) or 0
        customers_refused = (await db.scalar(customers_refused_stmt)) or 0
        alerts_total = (await db.scalar(alerts_total_stmt)) or 0
        alerts_escalated = (await db.scalar(alerts_escalated_stmt)) or 0
        alerts_closed = (await db.scalar(alerts_closed_stmt)) or 0
        alerts_pending = (await db.scalar(alerts_pending_stmt)) or 0
        screenings = (await db.scalar(screenings_stmt)) or 0
        strs = (await db.scalar(strs_stmt)) or 0
        ctrs = (await db.scalar(ctrs_stmt)) or 0

        # Suspicion categories
        cats_result = await db.execute(suspicion_cats_stmt)
        cats_rows = cats_result.all()
        suspicion_categories = ", ".join(f"{row[0]} ({row[1]})" for row in cats_rows) if cats_rows else "N/A"

        return {
            # Section 4: CDD
            "customersOnboarded": customers,
            "customersHighRisk": customers_high_risk,
            "customersPep": 0,  # TODO: Populate when is_pep flag is added to Customer model (requires PEP source tracking on screening matches)
            "customersRefused": customers_refused,
            "customersExited": 0,  # Exit/offboard not tracked; placeholder
            # Section 5: Transaction Monitoring
            "alertsTotal": alerts_total,
            "alertsEscalated": alerts_escalated,
            "alertsClosed": alerts_closed,
            "alertsPending": alerts_pending,
            # Section 6: STR/CTR
            "screeningsConducted": screenings,
            "strsFiled": strs,
            "ctrsFiled": ctrs,
            "suspicionCategories": suspicion_categories,
            # Legacy
            "trainingHours": training_hours,
        }


case_service = CaseService()
isar_service = IsarService()
str_report_service = StrReportService()
form_a6_service = FormA6Service()
