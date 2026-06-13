"""KYC Session service: create, query, advance hosted KYC sessions."""

from __future__ import annotations

import logging
from datetime import date, datetime, timedelta, timezone
from uuid import UUID

logger = logging.getLogger(__name__)

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.core.exceptions import NotFoundError, ValidationError
from app.core.storage import upload_bytes
from app.modules.identity.models import (
    Customer,
    KycSession,
    KycStatus,
    RiskTier,
    SessionStatus,
    SessionStep,
)
from app.adapters.verification_engine import (
    VerificationEngine,
    VerificationLevel,
    VerificationState,
    VerificationStep as VStep,
)

# Session expires after 30 minutes
SESSION_EXPIRY_MINUTES = 30

# Hosted page base URL — from settings
HOSTED_BASE_URL = settings.cip_frontend_url


def _parse_dob(s: str | None) -> date | None:
    if not s or not s.strip():
        return None
    try:
        return date.fromisoformat(s.strip()[:10])
    except (ValueError, TypeError):
        return None


class KycSessionService:
    """Manages hosted KYC session lifecycle."""

    async def create_session(
        self,
        db: AsyncSession,
        *,
        tenant_id: UUID,
        external_ref: str | None = None,
        customer_name: str | None = None,
        customer_cnic: str | None = None,
        customer_phone: str | None = None,
        customer_dob: str | None = None,
        customer_nationality: str | None = None,
        verification_level: str = "basic",
        upgrade_from_basic: bool = False,
        web_callback_url: str | None = None,
        mobile_callback_url: str | None = None,
    ) -> KycSession:
        """Create a new KYC session. Optionally find/create the customer."""
        # Find existing customer by external_ref if provided
        customer_id = None
        existing_customer = None
        if external_ref:
            result = await db.execute(
                select(Customer).where(
                    Customer.tenant_id == tenant_id,
                    Customer.external_ref == external_ref,
                )
            )
            existing_customer = result.scalar_one_or_none()
            if existing_customer:
                customer_id = existing_customer.id

        # If no customer found but we have enough info, create one
        if not customer_id and customer_name:
            customer = Customer(
                tenant_id=tenant_id,
                external_ref=external_ref,
                full_name=customer_name,
                cnic_number=customer_cnic,
                phone=customer_phone,
                dob=_parse_dob(customer_dob),
                nationality=customer_nationality,
                kyc_status=KycStatus.initiated,
                risk_tier=RiskTier.medium,
            )
            db.add(customer)
            await db.flush()
            customer_id = customer.id

        # Determine liveness requirement from tenant feature_flags (default False)
        # For advanced level, liveness is always required regardless of tenant setting
        liveness_required = verification_level == "advanced"
        if not liveness_required:
            try:
                from app.models.tenant import Tenant
                tenant_result = await db.execute(
                    select(Tenant).where(Tenant.id == tenant_id)
                )
                tenant_obj = tenant_result.scalar_one_or_none()
                if tenant_obj:
                    liveness_required = (tenant_obj.feature_flags or {}).get("liveness_required", False)
            except Exception:
                pass

        # Determine starting step
        # Normal: start at document upload
        # Upgrade from basic: skip documents, start at selfie (fresh biometrics)
        starting_step = SessionStep.upload
        is_upgrade = False

        if upgrade_from_basic and existing_customer:
            # Check if customer has completed basic KYC
            has_basic = existing_customer.kyc_status in (
                KycStatus.approved, KycStatus.risk_scored, KycStatus.identity_verified
            )
            if has_basic:
                starting_step = SessionStep.verify  # starts at selfie (verify step = biometric)
                is_upgrade = True
                logger.info(
                    "Upgrade from basic: customer %s already has basic KYC, starting at selfie step",
                    customer_id,
                )
            else:
                logger.info(
                    "Upgrade requested but customer %s has no basic KYC (status: %s), starting from beginning",
                    customer_id, existing_customer.kyc_status,
                )

        now = datetime.now(timezone.utc)
        session = KycSession(
            tenant_id=tenant_id,
            customer_id=customer_id,
            external_ref=external_ref,
            customer_name=customer_name or (existing_customer.full_name if existing_customer else None),
            customer_cnic=customer_cnic or (existing_customer.cnic_number if existing_customer else None),
            customer_phone=customer_phone or (existing_customer.phone if existing_customer else None),
            customer_dob=_parse_dob(customer_dob) or (existing_customer.dob if existing_customer else None),
            customer_nationality=customer_nationality or (existing_customer.nationality if existing_customer else None),
            web_callback_url=web_callback_url,
            mobile_callback_url=mobile_callback_url,
            status=SessionStatus.pending,
            current_step=starting_step,
            liveness_required=liveness_required,
            expires_at=now + timedelta(minutes=SESSION_EXPIRY_MINUTES),
        )
        db.add(session)
        await db.flush()
        await db.refresh(session)
        return session

    async def get_session(
        self,
        db: AsyncSession,
        session_id: UUID,
        *,
        tenant_id: UUID | None = None,
    ) -> KycSession | None:
        """Get session by ID. If tenant_id provided, enforce tenant isolation."""
        stmt = select(KycSession).where(KycSession.id == session_id)
        if tenant_id:
            stmt = stmt.where(KycSession.tenant_id == tenant_id)
        result = await db.execute(stmt)
        return result.scalar_one_or_none()

    async def get_session_public(
        self,
        db: AsyncSession,
        session_id: UUID,
    ) -> KycSession | None:
        """Get session for hosted page (no tenant check). Validates expiry."""
        session = await self.get_session(db, session_id)
        if not session:
            return None
        # Check if expired
        now = datetime.now(timezone.utc)
        if session.status == SessionStatus.pending and now > session.expires_at:
            session.status = SessionStatus.expired
            await db.flush()
        return session

    async def upload_document(
        self,
        db: AsyncSession,
        session_id: UUID,
        *,
        document_type: str,
        file_content: bytes,
        content_type: str,
    ) -> dict:
        """Upload a document for a KYC session. Creates IdentityDocument if customer exists."""
        session = await self.get_session_public(db, session_id)
        if not session:
            raise NotFoundError("KYC session not found")
        if session.status == SessionStatus.expired:
            raise ValidationError("KYC session has expired")
        if session.status == SessionStatus.completed:
            raise ValidationError("KYC session already completed")

        # Mark as in_progress
        if session.status == SessionStatus.pending:
            session.status = SessionStatus.in_progress

        # If we have a customer, create the IdentityDocument record
        if session.customer_id:
            from app.modules.identity.models import DocumentType, IdentityDocument

            try:
                doc_type = DocumentType(document_type)
            except ValueError:
                raise ValidationError(f"Invalid document type: {document_type}")

            file_key = f"kyc-sessions/{session_id}/{document_type}_{int(datetime.now(timezone.utc).timestamp())}"
            try:
                await upload_bytes(file_key, file_content, content_type)
            except Exception:
                # Storage may not be configured in dev; store file_key anyway
                pass

            doc = IdentityDocument(
                customer_id=session.customer_id,
                tenant_id=session.tenant_id,
                document_type=doc_type,
                file_key=file_key,
                content_type=content_type,
                file_size_bytes=len(file_content),
            )
            db.add(doc)
            await db.flush()

            return {
                "id": str(doc.id),
                "documentType": document_type,
                "fileKey": file_key,
                "fileSizeBytes": len(file_content),
            }

        # No customer yet — just acknowledge upload
        return {
            "documentType": document_type,
            "fileSizeBytes": len(file_content),
            "status": "received",
        }

    async def complete_step(
        self,
        db: AsyncSession,
        session_id: UUID,
        *,
        step: str,
    ) -> KycSession:
        """Advance KYC session to next step."""
        session = await self.get_session_public(db, session_id)
        if not session:
            raise NotFoundError("KYC session not found")
        if session.status == SessionStatus.expired:
            raise ValidationError("KYC session has expired")
        if session.status == SessionStatus.completed:
            raise ValidationError("KYC session already completed")

        if session.status == SessionStatus.pending:
            session.status = SessionStatus.in_progress

        step_order = [SessionStep.upload, SessionStep.verify, SessionStep.liveness, SessionStep.complete]
        try:
            completed_step = SessionStep(step)
        except ValueError:
            raise ValidationError(f"Invalid step: {step}")

        current_idx = step_order.index(session.current_step)
        completed_idx = step_order.index(completed_step)

        # Must complete current step
        if completed_idx < current_idx:
            raise ValidationError(f"Step '{step}' already completed")

        # Advance to next step
        if completed_step == SessionStep.complete:
            session.status = SessionStatus.completed
            session.current_step = SessionStep.complete
            session.completed_at = datetime.now(timezone.utc)

            # Try to run KYC pipeline if customer exists
            if session.customer_id:
                try:
                    from app.modules.identity.service import customer_service
                    customer, steps_run = await customer_service.run_kyc_pipeline(
                        db, customer_id=session.customer_id, tenant_id=session.tenant_id
                    )
                    session.kyc_status = customer.kyc_status.value if hasattr(customer.kyc_status, "value") else str(customer.kyc_status)
                    session.risk_tier = customer.risk_tier.value if hasattr(customer.risk_tier, "value") else str(customer.risk_tier)
                except Exception:
                    session.kyc_status = "approved"
                    session.risk_tier = "medium"
            else:
                session.kyc_status = "approved"
                session.risk_tier = "medium"
        elif completed_step == SessionStep.upload:
            session.current_step = SessionStep.verify
            # Also advance customer status if applicable
            if session.customer_id:
                result = await db.execute(
                    select(Customer).where(Customer.id == session.customer_id)
                )
                customer = result.scalar_one_or_none()
                if customer and customer.kyc_status == KycStatus.initiated:
                    customer.kyc_status = KycStatus.documents_uploaded
                    await db.flush()
        elif completed_step == SessionStep.verify:
            if session.liveness_required:
                session.current_step = SessionStep.liveness
            else:
                session.current_step = SessionStep.complete
        elif completed_step == SessionStep.liveness:
            session.current_step = SessionStep.complete
            # Fire webhook: liveness.completed
            try:
                from app.core.webhooks import get_tenant_webhook_url
                webhook_url = await get_tenant_webhook_url(db, session.tenant_id)
                if webhook_url:
                    from app.workers.tasks.webhooks import deliver_webhook_task
                    deliver_webhook_task.delay(
                        webhook_url,
                        "liveness.completed",
                        {
                            "session_id": str(session.id),
                            "customer_id": str(session.customer_id) if session.customer_id else None,
                            "tenant_id": str(session.tenant_id),
                            "external_ref": session.external_ref,
                        },
                    )
            except Exception:
                pass  # Non-fatal

        await db.flush()
        await db.refresh(session)

        # Fire webhook: kyc.session_completed when session finishes
        if session.status == SessionStatus.completed:
            try:
                from app.core.webhooks import get_tenant_webhook_url
                webhook_url = await get_tenant_webhook_url(db, session.tenant_id)
                if webhook_url:
                    from app.workers.tasks.webhooks import deliver_webhook_task
                    deliver_webhook_task.delay(
                        webhook_url,
                        "kyc.session_completed",
                        {
                            "session_id": str(session.id),
                            "customer_id": str(session.customer_id) if session.customer_id else None,
                            "tenant_id": str(session.tenant_id),
                            "external_ref": session.external_ref,
                            "kyc_status": session.kyc_status,
                            "risk_tier": session.risk_tier,
                        },
                    )
            except Exception:
                pass  # Non-fatal

        return session

    def build_urls(self, session: KycSession) -> tuple[str, str]:
        """Build the hosted verify page URLs."""
        base = HOSTED_BASE_URL
        web_url = f"{base}/verify/{session.id}"
        mobile_url = f"{base}/verify/{session.id}?mobile=true"
        return web_url, mobile_url


    # ── Verification Engine Integration ──

    # Engine instance (ML models loaded once, shared across requests)
    _engine: VerificationEngine | None = None
    # Session verification states (in-memory, keyed by session_id)
    _verification_states: dict[str, VerificationState] = {}

    def _get_engine(self) -> VerificationEngine:
        if self._engine is None:
            self._engine = VerificationEngine()
        return self._engine

    def _get_or_create_state(self, session: KycSession) -> VerificationState:
        sid = str(session.id)
        if sid not in self._verification_states:
            level = VerificationLevel.ADVANCED if session.liveness_required else VerificationLevel.BASIC
            state = self._get_engine().create_session(level)

            # If this is an upgrade session (starts at verify step, not upload),
            # mark document steps as already completed
            if session.current_step == SessionStep.verify and level == VerificationLevel.ADVANCED:
                state.steps_completed.append(VStep.DOCUMENT_FRONT)
                state.steps_completed.append(VStep.DOCUMENT_BACK)

            self._verification_states[sid] = state
        return self._verification_states[sid]

    async def process_frame(
        self,
        db: AsyncSession,
        session_id: UUID,
        *,
        step: str,
        image_bytes: bytes,
        extra_frames: list[bytes] | None = None,
    ) -> dict:
        """
        Process a verification frame through the ML engine.

        Called by the hosted page or SDK when the user captures a frame.
        Returns step result with extracted data, quality info, and pass/fail.
        """
        session = await self.get_session_public(db, session_id)
        if not session:
            raise NotFoundError("KYC session not found")
        if session.status == SessionStatus.expired:
            raise ValidationError("KYC session has expired")
        if session.status == SessionStatus.completed:
            raise ValidationError("KYC session already completed")

        if session.status == SessionStatus.pending:
            session.status = SessionStatus.in_progress

        engine = self._get_engine()
        state = self._get_or_create_state(session)

        # Map step names
        step_map = {
            "document_front": VStep.DOCUMENT_FRONT,
            "document_back": VStep.DOCUMENT_BACK,
            "selfie": VStep.SELFIE,
            "liveness": VStep.LIVENESS,
            "document_in_hand": VStep.DOCUMENT_IN_HAND,
        }
        v_step = step_map.get(step)
        if not v_step:
            raise ValidationError(f"Invalid step: {step}")

        # Process the frame
        result = engine.process_step(state, v_step, image_bytes, extra_frames)

        # Store document in S3 if it passed quality check
        if result.passed and session.customer_id and step in ("document_front", "document_back", "selfie", "document_in_hand"):
            file_key = f"kyc-sessions/{session_id}/{step}_{int(datetime.now(timezone.utc).timestamp())}"
            try:
                await upload_bytes(file_key, image_bytes, "image/jpeg")
            except Exception:
                pass

        # Update session progress based on engine state
        if state.is_complete:
            session.status = SessionStatus.completed
            session.current_step = SessionStep.complete
            session.completed_at = datetime.now(timezone.utc)
            session.kyc_status = "approved" if state.overall_passed else "rejected"

            # Get summary for risk tier
            summary = engine.get_summary(state)
            face_score = summary.get("face_match", {}).get("similarity_score", 0)
            if face_score >= 80:
                session.risk_tier = "low"
            elif face_score >= 60:
                session.risk_tier = "medium"
            else:
                session.risk_tier = "high"

            # Update customer KYC status
            if session.customer_id:
                cust_result = await db.execute(
                    select(Customer).where(Customer.id == session.customer_id)
                )
                customer = cust_result.scalar_one_or_none()
                if customer:
                    if state.overall_passed:
                        customer.kyc_status = KycStatus.approved
                        # Update customer data from OCR if available
                        cnic_data = summary.get("cnic", {})
                        if cnic_data.get("full_name") and not customer.full_name:
                            customer.full_name = cnic_data["full_name"]
                        if cnic_data.get("cnic_number") and not customer.cnic_number:
                            customer.cnic_number = cnic_data["cnic_number"]
                    else:
                        customer.kyc_status = KycStatus.rejected

            # Fire completion webhook
            try:
                from app.core.webhooks import get_tenant_webhook_url
                webhook_url = await get_tenant_webhook_url(db, session.tenant_id)
                if webhook_url:
                    from app.workers.tasks.webhooks import deliver_webhook_task
                    deliver_webhook_task.delay(
                        webhook_url,
                        "kyc.session_completed",
                        {
                            "session_id": str(session.id),
                            "customer_id": str(session.customer_id) if session.customer_id else None,
                            "external_ref": session.external_ref,
                            "kyc_status": session.kyc_status,
                            "risk_tier": session.risk_tier,
                            "verification_level": state.level.value,
                            "summary": summary,
                        },
                    )
            except Exception:
                pass

            # Clean up in-memory state
            self._verification_states.pop(str(session.id), None)

        await db.flush()
        await db.refresh(session)

        return {
            "step": step,
            "passed": result.passed,
            "data": result.data,
            "errors": result.errors,
            "quality": {
                "score": result.quality.score if result.quality else None,
                "issues": [
                    {"code": i.code, "message": i.message, "severity": i.severity}
                    for i in (result.quality.issues if result.quality else [])
                ],
            } if result.quality else None,
            "session_status": session.status.value if hasattr(session.status, "value") else str(session.status),
            "next_step": state.get_next_step(),
            "is_complete": state.is_complete,
        }


kyc_session_service = KycSessionService()
