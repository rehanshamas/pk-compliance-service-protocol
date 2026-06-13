"""Identity/KYC service: Customer CRUD, document upload, OCR, face match."""

from __future__ import annotations

from datetime import date
from uuid import UUID, uuid4

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.core.exceptions import NotFoundError, ValidationError
from app.core.file_validation import validate_file
from app.core.storage import get_bytes, upload_bytes
from app.modules.identity.models import (
    Customer,
    DocumentType,
    EDD_DOCUMENT_TYPES,
    IdentityDocument,
    KycStatus,
    RiskTier,
    VerificationResult,
    VerificationStatus,
    VerificationType,
)
from app.modules.identity.workflows import validate_transition
from app.core.usage import record_usage_event_async
from app.core.webhooks import notify_kyc_status_change

# ID document types (exclude selfie)
ID_DOCUMENT_TYPES = {DocumentType.cnic, DocumentType.passport, DocumentType.driving_license}

ALLOWED_CONTENT_TYPES = {"image/jpeg", "image/png", "image/jpg", "application/pdf"}
MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024  # 10MB


def _parse_dob(s: str | None) -> date | None:
    """Parse YYYY-MM-DD string to date. Returns None for empty/invalid."""
    if not s or not s.strip():
        return None
    try:
        return date.fromisoformat(s.strip()[:10])
    except (ValueError, TypeError):
        return None


class CustomerService:
    async def create(
        self,
        db: AsyncSession,
        tenant_id: UUID,
        *,
        full_name: str,
        external_ref: str | None = None,
        dob: str | date | None = None,
        nationality: str | None = None,
        cnic_number: str | None = None,
        **kwargs,
    ) -> Customer:
        """Create customer for tenant."""
        dob_date = _parse_dob(dob) if isinstance(dob, str) else dob
        customer = Customer(
            tenant_id=tenant_id,
            external_ref=external_ref,
            full_name=full_name,
            dob=dob_date,
            nationality=nationality,
            cnic_number=cnic_number,
            business_purpose=kwargs.get("business_purpose"),
            expected_activity=kwargs.get("expected_activity"),
        )
        db.add(customer)
        await db.flush()
        await db.refresh(customer)
        return customer

    async def get_by_id(
        self, db: AsyncSession, customer_id: UUID, tenant_id: UUID
    ) -> Customer | None:
        """Get customer by id, scoped to tenant."""
        result = await db.execute(
            select(Customer).where(
                Customer.id == customer_id,
                Customer.tenant_id == tenant_id,
            )
        )
        return result.scalar_one_or_none()

    async def list(
        self,
        db: AsyncSession,
        tenant_id: UUID,
        *,
        limit: int = 50,
        offset: int = 0,
        kyc_status: str | None = None,
        risk_tier: str | None = None,
        search: str | None = None,
    ) -> tuple[list[Customer], int]:
        """List customers for tenant with optional filters."""
        q = select(Customer).where(Customer.tenant_id == tenant_id)
        count_q = select(func.count()).select_from(Customer).where(
            Customer.tenant_id == tenant_id
        )

        if search:
            search_filter = or_(
                Customer.full_name.ilike(f"%{search}%"),
                Customer.cnic_number.ilike(f"%{search}%"),
            )
            q = q.where(search_filter)
            count_q = count_q.where(search_filter)

        if kyc_status:
            try:
                status_enum = KycStatus(kyc_status)
                q = q.where(Customer.kyc_status == status_enum)
                count_q = count_q.where(Customer.kyc_status == status_enum)
            except ValueError:
                pass
        if risk_tier:
            try:
                tier_enum = RiskTier(risk_tier)
                q = q.where(Customer.risk_tier == tier_enum)
                count_q = count_q.where(Customer.risk_tier == tier_enum)
            except ValueError:
                pass

        total_result = await db.execute(count_q)
        total = total_result.scalar() or 0

        q = q.order_by(Customer.created_at.desc()).offset(offset).limit(limit)
        result = await db.execute(q)
        customers = list(result.scalars().all())
        return customers, total

    async def update(
        self,
        db: AsyncSession,
        customer_id: UUID,
        tenant_id: UUID,
        **kwargs,
    ) -> Customer:
        """Partial update. Raises NotFoundError if not found."""
        customer = await self.get_by_id(db, customer_id, tenant_id)
        if not customer:
            raise NotFoundError("Customer not found")

        if "dob" in kwargs:
            dob_val = kwargs.pop("dob")
            customer.dob = _parse_dob(dob_val) if isinstance(dob_val, str) else dob_val
        for key in ("external_ref", "full_name", "nationality", "cnic_number", "business_purpose", "expected_activity"):
            if key in kwargs and kwargs[key] is not None:
                setattr(customer, key, kwargs[key])
        if "risk_tier" in kwargs and kwargs["risk_tier"] is not None:
            try:
                customer.risk_tier = RiskTier(kwargs["risk_tier"])
            except ValueError:
                raise ValidationError("Invalid risk_tier")
        if "kyc_status" in kwargs and kwargs["kyc_status"] is not None:
            try:
                new_status = KycStatus(kwargs["kyc_status"])
                validate_transition(customer.kyc_status, new_status)
                old_status = customer.kyc_status.value
                customer.kyc_status = new_status
                await db.flush()
                await db.refresh(customer)
                await notify_kyc_status_change(db, customer, old_status)
                return customer
            except ValueError:
                raise ValidationError("Invalid kyc_status")

        await db.flush()
        await db.refresh(customer)
        return customer

    async def _get_routing_config(self, db: AsyncSession) -> dict:
        """Load identity provider routing config from system settings (cached in Redis)."""
        try:
            import redis.asyncio as aioredis
            import json
            r = aioredis.from_url(settings.redis_url)
            cached = await r.get("identity_routing_config")
            if cached:
                await r.aclose()
                return json.loads(cached)
            await r.aclose()
        except Exception:
            pass

        from app.modules.admin.settings_service import system_settings_service
        config = {
            "primary": await system_settings_service.get(db, "identity_primary_provider") or "nadra",
            "fallback": await system_settings_service.get(db, "identity_fallback_provider") or "shufti",
            "trigger": await system_settings_service.get(db, "identity_fallback_trigger") or "error",
            "timeout_ms": int(await system_settings_service.get(db, "identity_fallback_timeout_ms") or "5000"),
            "confidence_threshold": int(await system_settings_service.get(db, "identity_fallback_confidence_threshold") or "70"),
        }

        try:
            import redis.asyncio as aioredis
            import json
            r = aioredis.from_url(settings.redis_url)
            await r.setex("identity_routing_config", 60, json.dumps(config))
            await r.aclose()
        except Exception:
            pass

        return config

    async def verify_nadra(
        self,
        db: AsyncSession,
        customer_id: UUID,
        tenant_id: UUID,
    ) -> VerificationResult | dict:
        """
        Run identity verification with dynamic provider routing.

        Reads primary/fallback provider and trigger conditions from system settings.
        Supports: timeout fallback, error fallback, low_confidence fallback, always_both.
        """
        customer = await self.get_by_id(db, customer_id, tenant_id)
        if not customer:
            raise NotFoundError("Customer not found")
        if not customer.cnic_number:
            raise ValidationError(
                "Customer must have CNIC number for identity verification",
                details={"customer_id": str(customer_id)},
            )

        routing = await self._get_routing_config(db)
        primary = routing["primary"]
        fallback = routing["fallback"]
        trigger = routing["trigger"]

        async def _run_provider(provider_name: str):
            if provider_name == "shufti":
                return await self._verify_shufti(db, customer_id, tenant_id, customer)
            return await self._verify_nadra_sync(db, customer_id, tenant_id, customer)

        # Strategy: always_both — run both providers
        if trigger == "always_both" and fallback != "none":
            primary_result = await _run_provider(primary)
            await _run_provider(fallback)
            return primary_result

        # Strategy: try primary, fallback on error/timeout/low_confidence
        import asyncio
        try:
            if trigger == "timeout":
                timeout_s = routing["timeout_ms"] / 1000.0
                result = await asyncio.wait_for(_run_provider(primary), timeout=timeout_s)
            else:
                result = await _run_provider(primary)

            # Check for low confidence fallback
            if trigger == "low_confidence" and fallback != "none":
                if isinstance(result, VerificationResult):
                    threshold = routing["confidence_threshold"] / 100.0
                    if (result.confidence_score or 0) < threshold:
                        return await _run_provider(fallback)

            return result

        except (asyncio.TimeoutError, Exception):
            if fallback and fallback != "none":
                return await _run_provider(fallback)
            raise

    async def _verify_shufti(
        self,
        db: AsyncSession,
        customer_id: UUID,
        tenant_id: UUID,
        customer: Customer,
    ) -> dict:
        """Create Shufti e-IDV request. Returns verificationUrl for user to complete."""
        from app.adapters.shufti import create_eidv_request, generate_reference
        from app.modules.identity.models import ShuftiPendingVerification

        callback_url = getattr(settings, "shufti_callback_url", "") or ""
        if not callback_url:
            raise ValidationError(
                "SHUFTI_CALLBACK_URL must be set when using Shufti. "
                "E.g. https://your-api.example.com/api/v1/webhooks/shufti",
                details={"customer_id": str(customer_id)},
            )

        reference = generate_reference()
        result = await create_eidv_request(
            reference=reference,
            callback_url=callback_url,
            country="PK",
            verification_mode="any",
        )

        pending = ShuftiPendingVerification(
            reference=reference,
            customer_id=customer_id,
            tenant_id=tenant_id,
        )
        db.add(pending)
        await db.flush()
        await db.refresh(pending)

        return {
            "verificationUrl": result.verification_url,
            "reference": reference,
            "status": "pending",
            "customerId": str(customer_id),
        }

    async def _verify_nadra_sync(
        self,
        db: AsyncSession,
        customer_id: UUID,
        tenant_id: UUID,
        customer: Customer,
    ) -> VerificationResult:
        """Run NADRA verification (sync)."""
        from app.adapters.nadra import get_nadra_adapter

        adapter = get_nadra_adapter(settings.nadra_adapter)
        name = customer.full_name or ""
        dob_str = customer.dob.isoformat() if customer.dob else None
        result = await adapter.verify_cnic(
            cnic=customer.cnic_number,
            name=name,
            dob=dob_str,
        )

        status = VerificationStatus.pass_ if result.verified else VerificationStatus.fail
        provider_name = getattr(adapter, "provider_name", "nadra")
        if isinstance(provider_name, str) and provider_name == "nadra":
            provider_name = "mock_nadra"  # Fallback for base adapter
        vr = VerificationResult(
            customer_id=customer_id,
            tenant_id=tenant_id,
            verification_type=VerificationType.nadra,
            provider=provider_name,
            status=status,
            raw_response=result.raw_response,
            confidence_score=1.0 if result.verified else 0.0,
        )
        db.add(vr)
        await db.flush()

        if result.verified and customer.kyc_status == KycStatus.documents_uploaded:
            validate_transition(KycStatus.documents_uploaded, KycStatus.identity_verified)
            old_status = KycStatus.documents_uploaded.value
            customer.kyc_status = KycStatus.identity_verified
            await db.flush()
            await db.refresh(customer)
            await notify_kyc_status_change(db, customer, old_status)

        record_usage_event_async(db, tenant_id, "kyc.verification")

        await db.refresh(vr)
        return vr

    async def score_risk(
        self,
        db: AsyncSession,
        customer_id: UUID,
        tenant_id: UUID,
    ) -> Customer:
        """Run risk scoring for customer. Updates risk_tier, advances liveness_checked -> risk_scored."""
        customer = await self.get_by_id(db, customer_id, tenant_id)
        if not customer:
            raise NotFoundError("Customer not found")

        from app.modules.identity.risk_scoring import score_customer_risk

        # Check if customer has any PEP screening match
        from app.models.screening import ScreeningResult
        pep_check = await db.execute(
            select(ScreeningResult).where(
                ScreeningResult.tenant_id == tenant_id,
                ScreeningResult.screened_entity_name == customer.full_name,
                ScreeningResult.overall_status.in_(["potential_match", "confirmed_match"]),
            ).limit(1)
        )
        pep_result = pep_check.scalar_one_or_none()
        pep_match = False
        if pep_result and pep_result.matches:
            for m in pep_result.matches:
                if isinstance(m, dict) and m.get("source", "").lower() in ("pep", "opensanctions"):
                    pep_match = True
                    break
        result = score_customer_risk(
            nationality=customer.nationality,
            pep_match=pep_match,
        )
        customer.risk_tier = result.tier
        await db.flush()

        if customer.kyc_status == KycStatus.liveness_checked:
            validate_transition(KycStatus.liveness_checked, KycStatus.risk_scored)
            old_status = KycStatus.liveness_checked.value
            customer.kyc_status = KycStatus.risk_scored
            await db.flush()
            await db.refresh(customer)
            await notify_kyc_status_change(db, customer, old_status)
        elif customer.kyc_status == KycStatus.risk_scored:
            old_status = KycStatus.risk_scored.value
            if result.tier == RiskTier.prohibited:
                validate_transition(KycStatus.risk_scored, KycStatus.rejected)
                customer.kyc_status = KycStatus.rejected
                await db.flush()
            elif result.tier == RiskTier.high:
                validate_transition(KycStatus.risk_scored, KycStatus.edd_required)
                customer.kyc_status = KycStatus.edd_required
                await db.flush()
            if customer.kyc_status.value != old_status:
                await db.refresh(customer)
                await notify_kyc_status_change(db, customer, old_status)

        await db.refresh(customer)
        return customer

    async def run_kyc_pipeline(
        self,
        db: AsyncSession,
        customer_id: UUID,
        tenant_id: UUID,
    ) -> tuple[Customer, list[str]]:
        """
        Run CDD orchestrator: NADRA and/or risk scoring as applicable.
        Returns (customer, steps_run).
        """
        from app.modules.identity.orchestrator import run_kyc_pipeline as _run

        customer = await self.get_by_id(db, customer_id, tenant_id)
        if not customer:
            raise NotFoundError("Customer not found")

        result = await _run(
            db,
            customer,
            get_customer_fn=lambda d, cid, tid: self.get_by_id(d, cid, tid),
            verify_nadra_fn=self.verify_nadra,
            score_risk_fn=self.score_risk,
        )
        return result.customer, result.steps_run


class DocumentService:
    async def upload(
        self,
        db: AsyncSession,
        customer_id: UUID,
        tenant_id: UUID,
        *,
        document_type: str,
        file_content: bytes,
        content_type: str,
    ) -> IdentityDocument:
        """Upload document for customer. On first document, transitions initiated -> documents_uploaded."""
        # Magic byte validation (prevents content-type spoofing)
        try:
            detected_type = validate_file(file_content, f"{document_type}.bin", content_type.lower())
            content_type = detected_type  # Use the validated detected type
        except ValueError as exc:
            raise ValidationError(str(exc), details={"content_type": content_type})

        result = await db.execute(
            select(Customer).where(
                Customer.id == customer_id,
                Customer.tenant_id == tenant_id,
            )
        )
        customer = result.scalar_one_or_none()
        if not customer:
            raise NotFoundError("Customer not found")

        try:
            doc_type = DocumentType(document_type)
        except ValueError:
            raise ValidationError(
                "Invalid document_type. Allowed: cnic, passport, driving_license, selfie, proof_of_address, bank_statement",
                details={"document_type": document_type},
            )
        if doc_type in EDD_DOCUMENT_TYPES:
            if customer.kyc_status != KycStatus.edd_in_progress:
                raise ValidationError(
                    "EDD documents (proof_of_address, bank_statement) only when customer is in edd_in_progress",
                    details={"kyc_status": customer.kyc_status.value},
                )

        ext = "pdf" if "pdf" in content_type else "jpg"
        key = f"{tenant_id}/customers/{customer_id}/documents/{uuid4().hex}.{ext}"
        upload_bytes(key, file_content, content_type)

        doc = IdentityDocument(
            customer_id=customer_id,
            tenant_id=tenant_id,
            document_type=doc_type,
            file_key=key,
            content_type=content_type,
            file_size_bytes=len(file_content),
        )
        db.add(doc)
        await db.flush()

        if customer.kyc_status == KycStatus.initiated:
            validate_transition(KycStatus.initiated, KycStatus.documents_uploaded)
            old_status = KycStatus.initiated.value
            customer.kyc_status = KycStatus.documents_uploaded
            await db.flush()
            await notify_kyc_status_change(db, customer, old_status)

        # OCR for ID documents (Phase 4.4)
        if doc_type in ID_DOCUMENT_TYPES:
            from app.adapters.ocr import extract_id_fields

            ocr_result = extract_id_fields(file_content, content_type)
            doc.ocr_data = {
                "full_name": ocr_result.full_name,
                "dob": ocr_result.dob,
                "cnic_number": ocr_result.cnic_number,
                "raw_text": ocr_result.raw_text[:2000] if ocr_result.raw_text else None,
                "confidence": ocr_result.confidence,
            }
            await db.flush()

            ocr_status = (
                VerificationStatus.pass_
                if ocr_result.confidence >= 0.6 and (ocr_result.full_name or ocr_result.cnic_number)
                else VerificationStatus.inconclusive
            )
            vr_ocr = VerificationResult(
                customer_id=customer_id,
                tenant_id=tenant_id,
                verification_type=VerificationType.document_ocr,
                provider="tesseract",
                status=ocr_status,
                raw_response=doc.ocr_data,
                confidence_score=ocr_result.confidence,
            )
            db.add(vr_ocr)
            await db.flush()

            if ocr_status == VerificationStatus.pass_ and customer.kyc_status == KycStatus.documents_uploaded:
                validate_transition(KycStatus.documents_uploaded, KycStatus.identity_verified)
                old_status = KycStatus.documents_uploaded.value
                customer.kyc_status = KycStatus.identity_verified
                await db.flush()
                await notify_kyc_status_change(db, customer, old_status)

        # Face match when selfie uploaded and we have an ID doc (Phase 4.5)
        if doc_type == DocumentType.selfie:
            id_docs = await db.execute(
                select(IdentityDocument).where(
                    IdentityDocument.tenant_id == tenant_id,
                    IdentityDocument.customer_id == customer_id,
                    IdentityDocument.document_type.in_(list(ID_DOCUMENT_TYPES)),
                ).order_by(IdentityDocument.created_at.asc()).limit(1)
            )
            id_doc = id_docs.scalar_one_or_none()
            if id_doc:
                from app.adapters.face import compare_faces

                id_bytes = get_bytes(id_doc.file_key)
                fm_result = compare_faces(
                    id_bytes,
                    file_content,
                    threshold=settings.face_match_threshold,
                )
                fm_status = (
                    VerificationStatus.pass_
                    if fm_result.verified
                    else VerificationStatus.fail
                )
                vr_face = VerificationResult(
                    customer_id=customer_id,
                    tenant_id=tenant_id,
                    verification_type=VerificationType.face_match,
                    provider=fm_result.model or "deepface",
                    status=fm_status,
                    raw_response={
                        "verified": fm_result.verified,
                        "distance": fm_result.distance,
                        "threshold": fm_result.threshold,
                    },
                    confidence_score=1.0 - fm_result.distance if fm_result.distance <= 1 else 0,
                )
                db.add(vr_face)
                await db.flush()

                if fm_result.verified and customer.kyc_status == KycStatus.identity_verified:
                    validate_transition(KycStatus.identity_verified, KycStatus.liveness_checked)
                    old_status = KycStatus.identity_verified.value
                    customer.kyc_status = KycStatus.liveness_checked
                    await db.flush()
                    await notify_kyc_status_change(db, customer, old_status)

        # Also run face match when ID doc uploaded and we already have a selfie
        if doc_type in ID_DOCUMENT_TYPES and customer.kyc_status == KycStatus.identity_verified:
            selfie_docs = await db.execute(
                select(IdentityDocument).where(
                    IdentityDocument.tenant_id == tenant_id,
                    IdentityDocument.customer_id == customer_id,
                    IdentityDocument.document_type == DocumentType.selfie,
                ).order_by(IdentityDocument.created_at.asc()).limit(1)
            )
            selfie_doc = selfie_docs.scalar_one_or_none()
            if selfie_doc:
                from app.adapters.face import compare_faces

                selfie_bytes = get_bytes(selfie_doc.file_key)
                fm_result = compare_faces(
                    file_content,
                    selfie_bytes,
                    threshold=settings.face_match_threshold,
                )
                fm_status = (
                    VerificationStatus.pass_
                    if fm_result.verified
                    else VerificationStatus.fail
                )
                vr_face = VerificationResult(
                    customer_id=customer_id,
                    tenant_id=tenant_id,
                    verification_type=VerificationType.face_match,
                    provider=fm_result.model or "deepface",
                    status=fm_status,
                    raw_response={
                        "verified": fm_result.verified,
                        "distance": fm_result.distance,
                        "threshold": fm_result.threshold,
                    },
                    confidence_score=1.0 - fm_result.distance if fm_result.distance <= 1 else 0,
                )
                db.add(vr_face)
                await db.flush()

                if fm_result.verified:
                    validate_transition(KycStatus.identity_verified, KycStatus.liveness_checked)
                    old_status = KycStatus.identity_verified.value
                    customer.kyc_status = KycStatus.liveness_checked
                    await db.flush()
                    await notify_kyc_status_change(db, customer, old_status)

        await db.refresh(doc)
        return doc

    async def list_documents(
        self,
        db: AsyncSession,
        customer_id: UUID,
        tenant_id: UUID,
    ) -> list[IdentityDocument]:
        """List documents for customer. Tenant-isolated."""
        if not await customer_service.get_by_id(db, customer_id, tenant_id):
            raise NotFoundError("Customer not found")
        result = await db.execute(
            select(IdentityDocument)
            .where(
                IdentityDocument.customer_id == customer_id,
                IdentityDocument.tenant_id == tenant_id,
            )
            .order_by(IdentityDocument.created_at.asc())
        )
        return list(result.scalars().all())

    async def list_verification_results(
        self,
        db: AsyncSession,
        customer_id: UUID,
        tenant_id: UUID,
    ) -> list[VerificationResult]:
        """List verification results for customer. Tenant-isolated."""
        if not await customer_service.get_by_id(db, customer_id, tenant_id):
            raise NotFoundError("Customer not found")
        result = await db.execute(
            select(VerificationResult)
            .where(
                VerificationResult.customer_id == customer_id,
                VerificationResult.tenant_id == tenant_id,
            )
            .order_by(VerificationResult.created_at.asc())
        )
        return list(result.scalars().all())


document_service = DocumentService()
customer_service = CustomerService()
